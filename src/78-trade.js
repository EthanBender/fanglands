// ============================================================================
// TRADE AND FOLLOW — tap another knight: Trade, Follow, Close.
// Owner (2026-09-25): "and you should be able to click other players to trade or follow them"
// A tap (or a click, or a right-click) on another knight on your map opens a small card at them, drawn with the HUD kit:
// their name (with the gold ADMIN pill for an admin), Trade, Follow (Stop following while you do) and Close. Tapping a
// knight never swings and never walks.
//   FOLLOW walks your knight after theirs with the tap-to-walk pathing, re-planned as they move, about a tile behind, and
//   stands still beside them. It ends when you move yourself (stick, keys, a tap somewhere), when they leave your map, or
//   on Stop following. A plaque says who you follow. Nothing is sent: the friend sees nothing at all.
//   TRADE is RuneScape's, and the world decides it (docs/ONLINE.md, "Trading"): an ask; "Sam wants to trade" with Accept
//   and No on the other screen; then a trade window with both offers and your pack; any change un-accepts both; Accept on
//   both sides opens "Are you sure?", which shows exactly what each of you gets; when both confirm, the Room (which holds
//   both offers as the only truth) tells both games at once and each takes out what it gave and puts in what it got, once.
//   A disconnect, a map change, walking away, falling or closing the window ends it and nothing moves. A pack too full is
//   refused before anything moves, in plain words.
// Feature file: HOOKS, NET.on, and four core functions wrapped by reassignment (tapAt, tapPick, tapLabelFor, tapCancel:
// the 69-axestump and 91-cloudkingdom trick) so a tap on a knight is ours and a manual move ends a follow.
// window.TRADE = { openMenu, closeMenu, menu, follow, stopFollow, following, ask, answer, add, take, accept, confirm, close,
//   cur, asks, packList, fits, apply } — 73-players' Friends panel calls follow / stopFollow; the simulations drive the rest.
// State saved with the knight: player.trades = { done: ['t12', ...] } (the finished trades already in this save).
// ============================================================================
{
  const PICK_R = 22;                 // px: a tap this close to a knight's middle (or on its name tag) is a tap on the knight
  const ASK_NEAR = 4 * TILE;         // px: close enough to ask (the world allows five tiles; one spare for the walk)
  const STOP = 1.3 * TILE;           // px: a follower this close stands still ...
  const GO = 2 * TILE;               // ... and walks again when the friend is further than this
  const REPATH = 0.35;               // s: how often the way to a moving friend is planned again
  const LOST = 3;                    // s: no way to the friend for this long and the follow gives up
  const ASK_LIFE = 30;               // s: an ask on this screen goes when the world's does (it also says trade_ask_off)
  const KEEP = 300;                  // player.trades.done keeps the newest 300 finished trades
  const MAX_ITEMS = 12;              // different things in one offer (the world's TRADE_ITEMS)
  const KEEP_FOLLOW = new Set(['blocked', 'stale', 'lost', 'done']);   // tapCancel reasons that do not end a follow
  const fmt = n => HK.fmtInt(n);
  const REMOTE = () => (window.PLAYERS ? PLAYERS.remote : {});
  const me = () => NET.me;
  const mapId = () => (window.PLAYERS ? PLAYERS.mapId() : 'over');
  const online = () => !!(window.NET && NET.online());
  const isKey = id => !!(window.KEYRING && KEYRING.KEYS && KEYRING.KEYS[id]);
  const itemName = id => ITEMS[id] ? ITEMS[id].name : 'something new';
  const words = (list) => {
    if (!list || !list.length) return 'nothing';
    const one = it => it.id === 'coins' ? fmt(it.qty) + (it.qty === 1 ? ' coin' : ' coins') : (it.qty > 1 ? fmt(it.qty) + ' ' : '') + itemName(it.id);
    const l = list.map(one); return l.length === 1 ? l[0] : l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1];
  };

  const TR = {
    menu: null,        // { n } the knight whose card is open
    follow: null,      // { n, then: 'trade' | null, repathT, goal, still, lost }
    asks: [],          // questions put to us: [{ from, role, at }]
    asking: null,      // { to, at } our question out
    cur: null,         // the open trade: { id, with, ver, stage, mine, theirs, acc: [me, them], conf: [me, them], sel, page, note }
    waiting: [],       // 't<tid>' keys whose ack waits for a cloud push that holds them
    internal: false,   // a follow step is cancelling the tap state itself
    askPanel: null,    // the asker whose question is up as a small panel (on a crowded screen)
    cardCache: {},     // where each card sits, so it does not hunt about every frame
  };
  const ensure = () => { if (!player.trades || typeof player.trades !== 'object' || !Array.isArray(player.trades.done)) player.trades = { done: [] }; return player.trades; };
  HOOKS.newGame.push(() => { player.trades = { done: [] }; TR.menu = null; TR.asks.length = 0; TR.asking = null; TR.cur = null; TR.follow = null; });

  // ---------- which knight is under a screen point ----------
  function knightAt(sx, sy) {
    const wx = sx + cam.x, wy = sy + cam.y, my = mapId(), R = REMOTE();
    let best = null;
    for (const n in R) {
      const e = R[n]; if (e.map !== my) continue;
      const x = e.shown.x, y = e.shown.y, onMech = !!e.mech;
      // the body (a circle a little above the feet) or the name tag over the head (73-players notes where it drew the
      // tag: a tall machine's is high over it)
      const tag = typeof e.tagTop === 'number' && Number.isFinite(e.tagTop) ? e.tagTop - y : (onMech ? -46 : -33);
      const body = dist(wx, wy, x, y - (onMech ? 12 : 8)), tagHit = Math.abs(wx - x) <= 40 && wy >= y + tag - 10 && wy <= y + tag + 10;
      const d = body <= (onMech ? 30 : PICK_R) ? body : tagHit ? PICK_R : Infinity;
      if (d < Infinity && (!best || d < best.d)) best = { d, n, e, wx, wy };
    }
    return best;
  }
  // tapPick (17-tap) learns knights: the knight wins unless a monster is closer to the finger
  { const _tapPick = tapPick;
    tapPick = function (sx, sy) {
      const p = _tapPick(sx, sy);
      if (!online()) return p;
      const k = knightAt(sx, sy); if (!k) return p;
      if (p && p.kind === 'monster' && dist(k.wx, k.wy, p.monster.x, p.monster.y) < k.d) return p;
      return { kind: 'knight', n: k.n, wx: k.wx, wy: k.wy, tx: Math.floor(k.wx / TILE), ty: Math.floor(k.wy / TILE) };
    }; }
  // a long press on a knight names them
  { const _tapLabelFor = tapLabelFor;
    tapLabelFor = function (p) { if (p && p.kind === 'knight') { const e = REMOTE()[p.n]; return p.n + (e ? ' · lv ' + e.lv : ''); } return _tapLabelFor(p); }; }
  // a tap: on a knight it opens the card (no swing, no walk); anywhere else while a card is open it only closes the card
  { const _tapAt = tapAt;
    tapAt = function (sx, sy) {
      if (player.dead || paused || (typeof title !== 'undefined' && title.active)) return _tapAt(sx, sy);
      const p = tapPick(sx, sy);
      if (p && p.kind === 'knight') { tap.lastTap = null; openMenu(p.n); return true; }
      if (TR.menu) { TR.menu = null; tap.lastTap = null; return true; }
      return _tapAt(sx, sy);
    }; }
  // a manual move (and any other tap) ends a follow; the follow's own re-planning does not
  { const _tapCancel = tapCancel;
    tapCancel = function (why) {
      const r = _tapCancel.apply(this, arguments);
      if (TR.follow && !TR.internal && !KEEP_FOLLOW.has(why)) stopFollow(why === 'manual' ? 'manual' : 'other');
      return r;
    }; }
  // a right-click is a click: no browser menu over the game
  try { if (canvas && canvas.addEventListener) canvas.addEventListener('contextmenu', e => { if (e && e.preventDefault) e.preventDefault(); }); } catch (e) { }

  // ---------- the card ----------
  function openMenu(n) { if (!REMOTE()[n]) return false; if (panel === 'knight') closePanel(); TR.menu = { n }; sfx('ui'); return true; }
  function closeMenu() { const was = TR.menu; TR.menu = null; if (was && panel === 'knight') closePanel(); }

  // A free place for a card of w x h near (ax, ay) on screen: clear of every tap target already on screen (8 px on touch),
  // of the knight, of the notice lane, of the stick and of the notch / home bands. The four sides first, then a widening
  // search. Kept while nothing it depends on changes, so the card does not hunt about.
  function placeCard(id, w, h, ax, ay) {
    const L = HK.cur(), S = L.S || { t: 0, r: 0, b: 0, l: 0 }, pad = touchMode() ? 8 : 4;
    const key = [VW, VH, w, h, Math.round(ax / 12), Math.round(ay / 12), buttons.length, touchMode()].join('|');
    const c = TR.cardCache[id]; if (c && c.key === key) return c.r;
    const kept = c && !c.r.crowded && c.r.w === w && c.r.h === h && Math.abs(c.ax - ax) < 60 && Math.abs(c.ay - ay) < 60 ? c.r : null;
    const avoid = [];
    // every piece the layout knows (its controls, the drawn ribbons and the belt strap, the scroll, the lanes), then every
    // tap target already on screen this frame
    for (const it of L.items || []) { if (it.knight) continue; if (it.k === 'c' && it.r > 0) avoid.push({ k: 'c', x: it.x, y: it.y, r: it.r, pad: it.tap ? pad : 2 }); else if (it.w > 0 && it.h > 0) avoid.push({ k: 'r', x: it.x, y: it.y, w: it.w, h: it.h, pad: it.tap ? pad : 2 }); }
    for (const b of buttons) { if (b.offscreen || !(b.w > 0)) continue; avoid.push(b.r ? { k: 'c', x: b.cx != null ? b.cx : b.x + b.w / 2, y: b.cy != null ? b.cy : b.y + b.h / 2, r: b.r, pad } : { k: 'r', x: b.x, y: b.y, w: b.w, h: b.h, pad }); }
    if (L.knight) avoid.push(Object.assign({ k: 'r', pad: 2 }, L.knight));
    if (L.notice) avoid.push(Object.assign({ k: 'r', pad: 3 }, L.notice));
    if (L.stick) avoid.push({ k: 'c', x: L.stick.x, y: L.stick.y, r: L.stick.keep, pad: 2 });
    for (const z of HK.bands(L)) avoid.push(Object.assign({ pad: 1 }, z));
    avoid.push({ k: 'r', x: ax - 22, y: ay - 40, w: 44, h: 60, pad: 4 });   // the knight the card is about
    const x0 = S.l + 6, x1 = VW - S.r - 6 - w, y0 = S.t + 6, y1 = VH - S.b - 6 - h;
    const free = (x, y) => { const r = { k: 'r', x, y, w, h }; return avoid.every(a => HK.gapBetween(a, r) >= a.pad); };
    const cl = (x, y) => [clamp(x, x0, Math.max(x0, x1)), clamp(y, y0, Math.max(y0, y1))];
    const tries = [[ax + 28, ay - h / 2], [ax - 28 - w, ay - h / 2], [ax - w / 2, ay - 52 - h], [ax - w / 2, ay + 26]];
    let r = kept && free(kept.x, kept.y) ? kept : null;   // a card that still fits where it is stays there
    for (const [x, y] of r ? [] : tries) { const [cx, cy] = cl(x, y); if (free(cx, cy)) { r = { x: cx, y: cy }; break; } }
    for (let rad = 16; !r && rad <= 640; rad += 16) {
      for (let a = 0; a < 16 && !r; a++) { const ang = a / 16 * Math.PI * 2, [cx, cy] = cl(ax - w / 2 + Math.cos(ang) * rad, ay - h / 2 + Math.sin(ang) * rad); if (free(cx, cy)) r = { x: cx, y: cy }; }
    }
    if (!r) { const [cx, cy] = cl(tries[0][0], tries[0][1]); r = { x: cx, y: cy, crowded: true }; }
    r = { x: Math.round(r.x), y: Math.round(r.y), w, h, crowded: !!r.crowded };
    TR.cardCache[id] = { key, r, ax, ay };
    return r;
  }
  // A card: a vellum plate with a name line (the ADMIN pill after an admin's name), an optional sentence, and plate
  // buttons 44 px tall (it is a HUD piece, touch or mouse), stacked or in one row, whichever shape finds a free place
  // (`shapes`: column counts to try, in order). Answers its rect, or null when no shape fits anywhere near the knight.
  function drawCard(g, id, ax, ay, head, rows, shapes) {
    const R = 44, G = 8, sf = HK.FS(600, 12), lh = Math.round(15 * HK.k() * 10) / 10;
    let pick = null;
    for (const cols of shapes) {
      const w = cols === 1 ? 172 : cols * 100 + (cols - 1) * G + 24;
      const sub = head.sub ? HK.wrap(g, head.sub, w - 24, 2, sf).lines : [];
      const nRows = Math.ceil(rows.length / cols);
      const h = 12 + 20 + (sub.length ? 4 + sub.length * lh : 0) + 10 + nRows * R + (nRows - 1) * G + 12;
      const r = placeCard(id + ':' + cols, w, h, ax, ay);
      if (!r.crowded) { pick = { cols, w, h, sub, r }; break; }
    }
    if (!pick) return null;   // no free place at them on this screen: the caller opens the same thing as a small panel
    const { cols, w, h, sub, r } = pick;
    HK.vellumPlate(g, r.x, r.y, w, h, { edge: head.edge || null });
    const admin = head.role === 'admin', gold = window.PLAYERS ? PLAYERS.GOLD : '#f5c542';
    let size = 14; while (size > 10 && HK.tw(g, head.name, HK.FC(800, size)) > w - 24 - (admin ? 52 : 0)) size -= 0.5;
    const nw = HK.tw(g, head.name, HK.FC(800, size));
    HK.text(g, head.name, r.x + 12, r.y + 12 + 15, { font: HK.FC(800, size), color: admin ? gold : HK.T.friend, shadow: 'rgba(0,0,0,0.9)', box: { x: r.x + 12, y: r.y + 8, w: w - 24, h: 24 }, fitId: 'trade:card:name' });
    if (admin && window.PLAYERS) PLAYERS.adminPill(g, r.x + 12 + nw + 6, r.y + 12 + 10, 9);
    sub.forEach((l, i) => HK.text(g, l, r.x + 12, r.y + 12 + 20 + 4 + (i + 1) * lh - 3, { font: sf, color: HK.T.ink, box: { x: r.x + 12, y: r.y + 30, w: w - 24, h: sub.length * lh + 8 }, fitId: 'trade:card:sub' }));
    const by0 = r.y + 12 + 20 + (sub.length ? 4 + sub.length * lh : 0) + 10, bw = Math.floor((w - 24 - (cols - 1) * G) / cols);
    rows.forEach((b, i) => {
      const cx = i % cols, cy = Math.floor(i / cols);
      platePush(g, r.x + 12 + cx * (bw + G), by0 + cy * (R + G), bw, R, b.label, b.word, b.action, b.tone || null, { name: b.name || b.word, keys: b.keys || [] });
    });
    return { x: r.x, y: r.y, w, h };
  }

  // The knight's card and the "wants to trade" card: the same buttons as a small panel on a screen too crowded to hold them
  // beside the knight (an upright iPhone SE: the notice lane and the knight fill the middle).
  function menuRows(n) {
    const fol = !!TR.follow && TR.follow.n === n, asked = TR.asks.some(a => a.from === n);
    return [
      { label: 'knight:trade', word: asked ? 'Accept trade' : 'Trade', emblem: 'coin', tone: 'primary', name: asked ? `${n} asked you: trade` : `Trade with ${n}`, action: () => { closeMenu(); ask(n); } },
      { label: 'knight:follow', word: fol ? 'Stop following' : 'Follow', emblem: 'friends', name: fol ? `Stop following ${n}` : `Follow ${n}`, action: () => { closeMenu(); if (fol) stopFollow('menu'); else follow(n); } },
      { label: 'knight:close', word: 'Close', emblem: 'close', action: closeMenu },
    ];
  }
  function askRows(from) {
    return [
      { label: 'ask:yes', word: 'Accept', emblem: 'tick', tone: 'primary', name: `Trade with ${from}`, action: () => answer(from, true) },
      { label: 'ask:no', word: 'No', emblem: 'close', name: 'Say no', action: () => answer(from, false) },
    ];
  }
  HOOKS.hud.push(g => {
    if (paused || !online()) return;
    const R = REMOTE(), my = mapId();
    // the knight's card: while they are on our map, no other panel is open and nobody is talking
    const m = TR.menu, e = m && R[m.n];
    if (m && m.panel && panel !== 'knight') TR.menu = null;   // its panel was closed (the seal, a tap outside)
    else if (m && (!e || e.map !== my || (panel && panel !== 'knight') || dialog.cur || player.dead)) closeMenu();
    else if (m && panel !== 'knight') {
      if (!drawCard(g, 'menu', e.shown.x - cam.x, e.shown.y - cam.y - 10, { name: m.n, role: e.role }, menuRows(m.n), [1, 3])) { m.panel = true; openPanel('knight', m.n); }
    }
    // a question put to us: the newest one, as a card at the asker (or near the top when they are off screen)
    TR.asks = TR.asks.filter(a => time - a.at < ASK_LIFE);
    if (TR.askPanel && panel !== 'tradeask') { const from = TR.askPanel; TR.askPanel = null; if (TR.asks.some(a => a.from === from)) answer(from, false); }   // its panel closed unanswered: that is a No
    const q = TR.asks[TR.asks.length - 1];
    if (q && !TR.cur && panel !== 'tradeask') {
      if (panel || dialog.cur) HK.addPlaque(g, { id: 'tradeask', emblem: 'coin', name: 'TRADE?', sub: `${q.from} wants to trade`, nameColor: HK.T.goldHi });
      else {
        const qe = R[q.from], on = qe && qe.map === my;
        const ax = on ? qe.shown.x - cam.x : VW / 2, ay = on ? qe.shown.y - cam.y - 10 : VH * 0.3;
        if (!drawCard(g, 'ask', ax, ay, { name: q.from, role: q.role, sub: `${q.from} wants to trade with you.`, edge: 'rgba(247,220,143,0.9)' }, askRows(q.from), [2, 1])) { TR.askPanel = q.from; openPanel('tradeask', q.from); }
      }
    }
    // following: a plaque that says so
    const f = TR.follow;
    if (f) HK.addPlaque(g, { id: 'follow', emblem: 'friends', name: 'Following ' + f.n, sub: touchMode() ? 'Move the stick to stop' : 'Move to stop', nameColor: HK.T.friend });
  });
  // the two cards as small panels (the book's frame): the name, a sentence, and the same buttons
  function cardPanel(g, title, role, sub, rows, cols) {
    const R = HK.row(), G = touchMode() ? 8 : 6, room = panelRoom(cols > 1 ? 340 : 320, VH), w = room.w, iw = w - 36;
    const nRows = Math.ceil(rows.length / cols), h = 62 + nRows * R + (nRows - 1) * G + 18;
    const { px, py } = panelBox(g, w, h, title, sub);
    if (role === 'admin' && window.PLAYERS) { let ts = 18; while (ts > 12 && HK.tw(g, title, HK.FC(800, ts)) > iw - 60 - HK.row()) ts -= 0.5; PLAYERS.adminPill(g, px + 18 + HK.tw(g, title, HK.FC(800, ts)) + 8, py + 24, 10); }
    const bw = Math.floor((iw - (cols - 1) * G) / cols);
    rows.forEach((b, i) => platePush(g, px + 18 + (i % cols) * (bw + G), py + 62 + Math.floor(i / cols) * (R + G), bw, R, b.label, b.word, b.action, b.tone || null, { emblem: b.emblem, name: b.name || b.word, keys: b.keys || [] }));
  }
  HOOKS.panel.knight = g => {
    const n = String(panelArg || ''), e = REMOTE()[n];
    if (!TR.menu || TR.menu.n !== n || !e) { TR.menu = null; closePanel(); return; }
    cardPanel(g, n, e.role, `Level ${e.lv}. What would you like to do?`, menuRows(n), 1);
  };
  HOOKS.panel.tradeask = g => {
    const from = String(panelArg || ''), q = TR.asks.find(a => a.from === from);
    if (!q || TR.cur) { TR.askPanel = null; closePanel(); return; }
    cardPanel(g, 'Trade?', null, `${from} wants to trade with you.`, askRows(from), 2);
  };

  // ---------- follow ----------
  function follow(n, then) {
    const e = REMOTE()[n];
    if (!online()) { notify('You are not connected.'); return false; }
    if (!e || e.map !== mapId()) { notify(`${n} is somewhere else.`); return false; }
    TR.internal = true; try { tapCancel('retarget'); } finally { TR.internal = false; }
    TR.follow = { n, then: then || null, repathT: 0, goal: null, still: false, lost: 0 };
    if (window.PLAYERS) PLAYERS.follow(n);   // the friend's mark on the world map (73-players)
    tap.kind = 'follow';
    return true;
  }
  function stopFollow(why) {
    const f = TR.follow; if (!f) return;
    TR.follow = null;
    if (window.PLAYERS && PLAYERS.following === f.n) PLAYERS.follow(null);
    if (tap.kind === 'follow') { TR.internal = true; try { tapCancel('done'); } finally { TR.internal = false; } }
    if (why === 'gone') notify(`${f.n} left this place, so you stopped following.`);
    else if (why === 'lost') notify(`You can't find a way to ${f.n}.`);
  }
  HOOKS.update.push(dt => {
    const f = TR.follow;
    if (f) {
      const e = REMOTE()[f.n];
      if (!online() || !e || e.map !== mapId()) stopFollow('gone');
      else if (player.dead) stopFollow('dead');
      else {
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        if (f.then === 'trade' && d <= ASK_NEAR) { const n = f.n; stopFollow('arrived'); sendAsk(n); }
        else if (d <= STOP || (f.still && d <= GO)) {
          f.still = true; f.goal = null;
          if (tap.path && tap.path.length) tapSetPath([]);
          tap.kind = 'follow';
          if (!player.moving && d > 4) tapFace(e.x, e.y);
        } else {
          f.still = false; f.repathT -= dt;
          const gt = { tx: Math.floor(e.x / TILE), ty: Math.floor(e.y / TILE) };
          if (!tap.path || !tap.path.length || !f.goal || gt.tx !== f.goal.tx || gt.ty !== f.goal.ty || f.repathT <= 0) {
            f.repathT = REPATH;
            const path = tapPathTo(gt.tx, gt.ty, true);
            if (path && path.length) { f.goal = gt; f.lost = 0; tap.goal = gt; tapSetPath(path); }
            else { f.lost += REPATH; if (f.lost >= LOST) stopFollow('lost'); }
          }
          if (TR.follow) tap.kind = 'follow';   // keeps tapActive() true, so the stick and the keys end it (07-update)
        }
      }
    }
    // the trade window closed some other way than the world (the close seal, a tap outside, another panel): the trade is off
    if (TR.cur && (panel !== 'trade' || player.dead || !online())) {
      const c = TR.cur; TR.cur = null;
      if (online()) NET.send({ t: 'trade_close', id: c.id });
      if (panel === 'trade') closePanel();
      notify(player.dead ? 'You fell, so the trade is off. Nothing was swapped.' : !online() ? 'The connection dropped, so the trade is off. Nothing was swapped.' : 'You closed the trade. Nothing was swapped.');
    }
    if (TR.waiting.length) checkWaiting();
    if (TR.menu && pressed.has('Escape')) closeMenu();
  });

  // ---------- asking ----------
  function sendAsk(n) {
    if (!online()) { notify('You are not connected.'); return false; }
    if (!NET.send({ t: 'trade_ask', to: n })) { notify('That did not go through. Try again.'); return false; }
    return true;
  }
  // Trade on the card: close enough, ask now; further, walk up first (a follow that asks when it gets there)
  function ask(n) {
    const e = REMOTE()[n];
    if (!online()) { notify('You are not connected.'); return false; }
    if (TR.cur) { notify('Finish your trade first.'); return false; }
    if (!e || e.map !== mapId()) { notify(`${n} is somewhere else.`); return false; }
    if (Math.hypot(e.x - player.x, e.y - player.y) <= ASK_NEAR) return sendAsk(n);
    notify(`Walking up to ${n} to trade.`);
    return follow(n, 'trade');
  }
  function answer(from, yes) {
    TR.asks = TR.asks.filter(a => a.from !== from);
    if (TR.askPanel === from) { TR.askPanel = null; if (panel === 'tradeask') closePanel(); }
    if (!online()) return false;
    NET.send({ t: 'trade_answer', from, yes: !!yes });
    sfx('ui');
    return true;
  }

  // ---------- the pack, the offers, and whether it all fits ----------
  const packHas = id => { let n = 0; for (const s of player.inv) if (s && s.id === id) n += s.qty; return n; };
  const offered = id => { const c = TR.cur; if (!c) return 0; const it = c.mine.find(x => x.id === id); return it ? it.qty : 0; };
  // what the pack can still offer: one entry per item (not the keyring's), in pack order, with what is left of it
  function packList() {
    const out = [], seen = new Set();
    for (const s of player.inv) {
      if (!s || !ITEMS[s.id] || isKey(s.id) || seen.has(s.id)) continue;
      seen.add(s.id);
      const have = packHas(s.id) - offered(s.id);
      if (have > 0) out.push({ id: s.id, have });
    }
    return out;
  }
  // Would the pack hold `get` once `give` is out of it? 'ok', 'full', or 'new' (an item this game does not know).
  function fits(give, get) {
    const inv = player.inv.map(s => s ? { id: s.id, qty: s.qty } : null);
    for (const it of give || []) {
      let left = it.qty;
      for (let i = inv.length - 1; i >= 0 && left > 0; i--) { const s = inv[i]; if (s && s.id === it.id) { const take = Math.min(s.qty, left); s.qty -= take; left -= take; if (s.qty <= 0) inv[i] = null; } }
    }
    for (const it of get || []) {
      const def = ITEMS[it.id]; if (!def) return 'new';
      const stack = def.stack || 1; let left = it.qty;
      for (const s of inv) if (s && s.id === it.id && s.qty < stack && left > 0) { const take = Math.min(stack - s.qty, left); s.qty += take; left -= take; }
      for (let i = 0; i < inv.length && left > 0; i++) if (!inv[i]) { const take = Math.min(stack, left); inv[i] = { id: it.id, qty: take }; left -= take; }
      if (left > 0) return 'full';
    }
    return 'ok';
  }
  function sendOffer(items) {
    const c = TR.cur; if (!c) return false;
    c.mine = items; c.acc = [false, false]; c.note = null;   // shown at once; the world's trade_state is the truth a moment later
    return NET.send({ t: 'trade_offer', id: c.id, items });
  }
  function add(id, n) {
    const c = TR.cur; if (!c || c.stage !== 'offer' || !ITEMS[id] || isKey(id)) return false;
    const have = packHas(id) - offered(id); n = Math.min(Math.floor(n), have); if (!(n > 0)) return false;
    const items = c.mine.map(x => ({ ...x })), it = items.find(x => x.id === id);
    if (it) it.qty += n; else { if (items.length >= MAX_ITEMS) { notify('That is as many different things as one trade can hold.'); return false; } items.push({ id, qty: n }); }
    sfx('ui'); return sendOffer(items);
  }
  function take(id, n) {
    const c = TR.cur; if (!c || c.stage !== 'offer') return false;
    const items = c.mine.map(x => ({ ...x })), i = items.findIndex(x => x.id === id); if (i < 0) return false;
    items[i].qty -= Math.min(items[i].qty, Math.floor(n)); if (items[i].qty <= 0) items.splice(i, 1);
    sfx('ui'); return sendOffer(items);
  }
  // before Accept and Confirm: still holding everything offered, and room for what comes back
  function ready() {
    const c = TR.cur;
    const short = c.mine.find(it => packHas(it.id) < it.qty);
    if (short) { sendOffer(c.mine.map(it => ({ id: it.id, qty: Math.min(it.qty, packHas(it.id)) })).filter(it => it.qty > 0)); notify("You don't have all of that any more, so your offer changed."); return false; }
    const f = fits(c.mine, c.theirs);
    if (f !== 'ok') { NET.send({ t: 'trade_full', id: c.id, why: f === 'new' ? 'new' : 'full' }); return false; }
    return true;
  }
  function accept() { const c = TR.cur; if (!c || c.stage !== 'offer' || c.acc[0] || (!c.mine.length && !c.theirs.length)) return false; if (!ready()) return false; sfx('ui'); return NET.send({ t: 'trade_accept', id: c.id, ver: c.ver }); }
  function confirm() { const c = TR.cur; if (!c || c.stage !== 'confirm' || c.conf[0]) return false; if (!ready()) return false; sfx('ui'); return NET.send({ t: 'trade_confirm', id: c.id, ver: c.ver }); }
  function close() { if (!TR.cur) return false; closePanel(); return true; }   // the update hook sends trade_close and says so

  // ---------- a finished trade: out what you gave, in what you got, exactly once ----------
  const cloudOn = () => !!(window.CLOUD && typeof CLOUD.active === 'function' && CLOUD.active());
  const cloudHolds = key => !!(window.CLOUD && typeof CLOUD.known === 'string' && CLOUD.known.indexOf('"' + key + '"') >= 0);
  function ackSoon(key) {
    if (!cloudOn()) { if (online()) NET.send({ t: 'trade_ack', tid: +key.slice(1) }); return; }
    if (!TR.waiting.includes(key)) { TR.waiting.push(key); while (TR.waiting.length > KEEP) TR.waiting.shift(); }
    if (!cloudHolds(key)) { try { CLOUD.push(true); } catch (e) { } }
    checkWaiting();
  }
  function checkWaiting() {
    if (!online()) return;
    for (let i = TR.waiting.length - 1; i >= 0; i--) { const key = TR.waiting[i]; if ((cloudHolds(key) || !cloudOn()) && NET.send({ t: 'trade_ack', tid: +key.slice(1) })) TR.waiting.splice(i, 1); }
  }
  const cleanList = l => Array.isArray(l) ? l.filter(it => it && typeof it.id === 'string' && Number.isInteger(it.qty) && it.qty > 0) : [];
  function apply(tid, withN, gave, got) {
    if (!Number.isInteger(tid)) return 'bad';
    const d = ensure(), key = 't' + tid;
    if (d.done.includes(key)) { ackSoon(key); return 'again'; }
    // on the title screen save() writes nothing: leave it for the world to send again after the next welcome
    if (typeof title !== 'undefined' && title.active) return 'later';
    gave = cleanList(gave); got = cleanList(got);
    // an item this game does not know: nothing moves here, nothing is acked, and the world sends it again after a reload
    if (got.some(it => !ITEMS[it.id])) { notify('That trade needs the newest game. Reload the page to get it.'); return 'new'; }
    for (const it of gave) if (!isKey(it.id)) removeItem(it.id, Math.min(it.qty, packHas(it.id)));
    let banked = false, dropped = false;
    for (const it of got) {
      const inPack = Math.min(it.qty, Math.max(0, roomFor(it.id)));
      if (inPack > 0) addItem(it.id, inPack);
      let left = it.qty - inPack;
      if (left > 0 && bankAdd(it.id, left)) { left = 0; banked = true; }
      if (left > 0) { drops.push({ x: player.x + rint(-10, 10), y: player.y + rint(-10, 10), id: it.id, qty: left, t: 0 }); dropped = true; }
    }
    d.done.push(key); while (d.done.length > KEEP) d.done.shift();
    notify(`Traded with ${withN || 'a friend'}: you gave ${words(gave)} and got ${words(got)}.`);
    if (got.length) floatText(player.x, player.y - 30, '+' + words(got), ITEMS[got[0].id].color || '#f5c542');
    if (banked) notify('Your pack was full, so some of it went to your bank.');
    if (dropped) notify('Your pack and your bank were full, so some of it fell at your feet.');
    sfx('coins'); save();
    ackSoon(key);
    return 'done';
  }

  // ---------- the wire ----------
  const said = (n, mine, theirs) => n && n === me() ? mine : theirs;
  NET.on('welcome', () => { TR.asks.length = 0; TR.asking = null; TR.cur = null; TR.menu = null; if (panel === 'trade') closePanel(); });
  NET.on('offline', () => { TR.asks.length = 0; TR.asking = null; if (TR.follow) stopFollow('offline'); TR.menu = null; });
  NET.on('trade_asked', m => { if (!m || typeof m.to !== 'string') return; TR.asking = { to: m.to, at: time }; notify(`You asked ${m.to} to trade.`); });
  NET.on('trade_ask', m => {
    if (!m || typeof m.from !== 'string') return;
    TR.asks = TR.asks.filter(a => a.from !== m.from); TR.asks.push({ from: m.from, role: m.role === 'admin' ? 'admin' : 'player', at: time });
    sfx('open');
  });
  NET.on('trade_ask_off', m => { if (m && typeof m.from === 'string') TR.asks = TR.asks.filter(a => a.from !== m.from); });
  const NO = {
    self: () => "You can't trade with yourself.",
    offline: n => `${n} is not online.`,
    map: n => `${n} is somewhere else.`,
    far: n => `Walk up to ${n} first.`,
    busy: n => said(n, 'Finish your trade first.', `${n} is trading with someone else.`),
    dead: n => said(n, "You can't trade while you are down.", `${n} can't trade right now.`),
    wait: n => `You asked ${n} already. Wait for an answer.`,
    declined: n => `${n} said no to trading.`,
    timeout: n => `${n} did not answer.`,
    gone: () => 'That question is over.',
    bad: () => 'That did not work.',
  };
  NET.on('trade_no', m => {
    if (!m) return;
    if (TR.asking && (!m.n || m.n === TR.asking.to)) TR.asking = null;
    const n = typeof m.n === 'string' && m.n ? m.n : 'Your friend';
    notify((NO[m.code] || NO.bad)(n));
  });
  NET.on('trade_open', m => {
    if (!m || !Number.isInteger(m.id) || typeof m.with !== 'string') return;
    TR.asks = TR.asks.filter(a => a.from !== m.with); TR.asking = null; TR.menu = null;
    if (TR.follow) stopFollow('trade');
    TR.cur = { id: m.id, with: m.with, ver: m.ver || 1, stage: 'offer', mine: [], theirs: [], acc: [false, false], conf: [false, false], sel: null, page: 0, packPage: 0, note: null };
    openPanel('trade'); sfx('open');
  });
  NET.on('trade_state', m => {
    const c = TR.cur; if (!m || !c || m.id !== c.id) return;
    const was = c.stage;
    c.ver = m.ver; c.stage = m.stage === 'confirm' ? 'confirm' : 'offer';
    c.mine = cleanList(m.mine); c.theirs = cleanList(m.theirs);
    c.acc = Array.isArray(m.acc) ? [!!m.acc[0], !!m.acc[1]] : [false, false];
    c.conf = Array.isArray(m.conf) ? [!!m.conf[0], !!m.conf[1]] : [false, false];
    if (c.stage !== was) { c.page = 0; c.sel = null; if (c.stage === 'confirm') c.note = null; }
    if (c.sel && c.sel.from === 'mine' && !c.mine.some(x => x.id === c.sel.id)) c.sel = null;
  });
  NET.on('trade_note', m => {
    const c = TR.cur; if (!m || !c || m.id !== c.id) return;
    const n = typeof m.n === 'string' ? m.n : '';
    c.note = m.code === 'new' ? said(n, 'Your game needs updating for this trade. Reload the page.', `${n} needs the newest game for this trade.`)
      : said(n, 'Your pack is too full for this trade.', `${n}'s pack is too full for this trade.`);
    notify(c.note);
  });
  NET.on('trade_end', m => {
    const c = TR.cur; if (!m || !c || m.id !== c.id) return;
    TR.cur = null; if (panel === 'trade') closePanel();
    const n = typeof m.n === 'string' && m.n ? m.n : 'Your friend';
    const why = {
      closed: said(n, 'You closed the trade.', `${n} closed the trade.`),
      left: `${n} left, so the trade is off.`,
      far: said(n, 'You walked away, so the trade is off.', `${n} walked away, so the trade is off.`),
      dead: said(n, 'You fell, so the trade is off.', `${n} fell, so the trade is off.`),
    }[m.code] || 'That trade is over.';
    notify(why + ' Nothing was swapped.');
  });
  NET.on('trade_done', m => {
    if (!m) return;
    const c = TR.cur;
    if (c && m.id === c.id) { TR.cur = null; if (panel === 'trade') closePanel(); }
    apply(m.tid, typeof m.with === 'string' ? m.with : null, m.gave, m.got);
  });

  // ---------- the trade window ----------
  const T = () => HK.T;
  function pouchBtn(g, x, y, P, it, label, sel, name, action) {
    const st = HK.stateOf(label);
    drawSlot(g, x, y, P, it, sel, st);
    if (label) buttons.push({ x, y, w: P, h: P, label, action, up: true, name });
  }
  // one side's offer: a vellum plate with a row of pouches (edge green once that side accepted)
  function offerGrid(g, x, y, w, rows, per, P, G, GP, list, mine, accepted) {
    const PH = Math.round(P * 1.04), h = Math.max(1, rows) * (PH + G) - G + 2 * GP;
    HK.vellumPlate(g, x, y, w, h, { edge: accepted ? 'rgba(138,216,131,0.9)' : null });
    if (!list.length) HK.text(g, 'Nothing yet', x + w / 2, y + h / 2 + 5, { font: HK.FS(600, 12), align: 'center', color: T().inkMute, box: { x: x + 4, y, w: w - 8, h }, fitId: 'trade:nothing' });
    const c = TR.cur, ox = x + Math.round((w - (per * P + (per - 1) * G)) / 2);
    list.slice(0, per * Math.max(1, rows)).forEach((it, i) => {
      const px = ox + (i % per) * (P + G), py = y + GP + Math.floor(i / per) * (PH + G) + Math.round(P * 0.04);
      if (mine) pouchBtn(g, px, py, P, it, 'trade:mine:' + it.id + ':', !!c.sel && c.sel.from === 'mine' && c.sel.id === it.id, `${itemName(it.id)}: ${fmt(it.qty)} offered. Tap to take some back.`, () => { c.sel = { from: 'mine', id: it.id }; });
      else pouchBtn(g, px, py, P, it, null, false);
    });
    return h;
  }
  // a column head: "You give" / "Sam gives", with a green tick once that side accepted
  function colHead(g, x, y, w, words0, accepted) {
    let size = 13; while (size > 9 && HK.tw(g, words0, HK.FC(800, size)) > w - 22) size -= 0.5;
    HK.text(g, words0, x, y + 14, { font: HK.FC(800, size), color: T().goldHi, shadow: 'rgba(0,0,0,0.9)', box: { x, y, w: w - 20, h: 18 }, fitId: 'trade:head' });
    if (accepted) HK.emblem(g, 'tick', Math.min(x + w - 9, x + HK.tw(g, words0, HK.FC(800, size)) + 12), y + 9, 14, T().good);
  }
  // the words under the offers: what is going on, in one or two lines
  function statusLine(c) {
    if (c.note) return { s: c.note, color: T().warn };
    if (c.sel && c.sel.from === 'pack') { const it = packList().find(x => x.id === c.sel.id); return { s: it ? `${itemName(it.id)}: you have ${fmt(it.have)} more. How many?` : 'Tap something in your pack.', color: T().ink }; }
    if (c.sel && c.sel.from === 'mine') { const it = c.mine.find(x => x.id === c.sel.id); return { s: it ? `${itemName(it.id)}: ${fmt(it.qty)} in your offer. Take some back?` : 'Tap something in your offer.', color: T().ink }; }
    if (c.stage === 'confirm') {
      if (c.conf[0]) return { s: `You confirmed. Waiting for ${c.with}.`, color: T().good };
      if (c.conf[1]) return { s: `${c.with} confirmed. Confirm if this is right.`, color: T().goldHi };
      return { s: 'Check it carefully. Nothing moves until you both confirm.', color: T().ink };
    }
    if (!c.mine.length && !c.theirs.length) return { s: `Tap something in your pack to offer it to ${c.with}.`, color: T().ink };
    if (c.acc[0]) return { s: `You accepted. Waiting for ${c.with}.`, color: T().good };
    if (c.acc[1]) return { s: `${c.with} accepted. Accept if it looks right.`, color: T().goldHi };
    return { s: 'Any change un-accepts you both. Accept when it looks right.', color: T().ink };
  }
  // the footer: Accept / Decline, or the amounts for what you picked
  function footer(g, c, x, y, w) {
    const R = HK.row(), G = touchMode() ? 8 : 6, list = [];
    if (c.sel && c.sel.from === 'pack') {
      const id = c.sel.id, it = packList().find(q => q.id === id), have = it ? it.have : 0;
      if (have >= 1) list.push({ label: 'trade:add:one', word: 'Add 1', action: () => add(id, 1) });
      if (have > 10) list.push({ label: 'trade:add:ten', word: 'Add 10', action: () => add(id, 10) });
      if (have > 100 && w >= 420) list.push({ label: 'trade:add:hundred', word: 'Add 100', action: () => add(id, 100) });
      if (have > 1) list.push({ label: 'trade:add:all', word: 'Add all', tone: 'primary', action: () => add(id, have) });
      list.push({ label: 'trade:back', word: 'Back', action: () => { c.sel = null; } });
    } else if (c.sel && c.sel.from === 'mine') {
      const id = c.sel.id, it = c.mine.find(q => q.id === id), qty = it ? it.qty : 0;
      if (qty > 1) list.push({ label: 'trade:take:one', word: 'Take 1', action: () => take(id, 1) });
      list.push({ label: 'trade:take:all', word: qty > 1 ? 'Take all' : 'Take back', tone: 'primary', action: () => take(id, qty) });
      list.push({ label: 'trade:back', word: 'Back', action: () => { c.sel = null; } });
    } else if (c.stage === 'confirm') {
      list.push({ label: 'trade:confirm', word: c.conf[0] ? 'Confirmed' : 'Confirm', tone: 'primary', on: c.conf[0], enabled: !c.conf[0], action: confirm });
      list.push({ label: 'trade:decline', word: 'Decline', tone: 'danger', action: close });
    } else {
      const can = !c.acc[0] && (c.mine.length > 0 || c.theirs.length > 0);
      list.push({ label: 'trade:accept', word: c.acc[0] ? 'Accepted' : 'Accept', tone: 'primary', on: c.acc[0], enabled: can, action: accept });
      list.push({ label: 'trade:decline', word: 'Decline', tone: 'danger', action: close });
    }
    const bw = Math.min(touchMode() ? 132 : 116, Math.floor((w - (list.length - 1) * G) / list.length)), total = list.length * bw + (list.length - 1) * G;
    let bx = x + w - total;
    for (const b of list) { platePush(g, bx, y, bw, R, b.label, b.word, b.action, b.tone || null, { enabled: b.enabled !== false, on: !!b.on, name: b.word }); bx += bw + G; }
    return total;
  }
  function wrapStatus(g, c, w) { const st = statusLine(c), f = HK.FS(600, 12); return { st, f, lines: HK.wrap(g, st.s, w, 2, f).lines }; }

  // Three ways to lay the window out, the first that fits the room: WIDE (your offer, theirs and your pack side by side),
  // STACKED (the two offers side by side, your pack under them), and TABS (Offers | Your pack, one at a time, the pack in
  // pages) for small screens and big offers. Pouches stay 44 px on touch in every one.
  function tradePlan(g, c) {
    const t = touchMode(), P = t ? 44 : 38, G = t ? 8 : 6, PH = Math.round(P * 1.04), step = PH + G, R = HK.row(), GP = 4, CG = 10;
    const lh = Math.round(15 * HK.k() * 10) / 10, room = panelRoom(900, VH), iw = room.w - 36, headH = 22, top = 62;
    const span = n => n * P + (n - 1) * G, perIn = w => Math.max(1, Math.floor((w - 2 * GP + G) / (P + G))), gridH = rows => Math.max(1, rows) * step - G + 2 * GP;
    const pack = packList(), n = Math.max(c.mine.length, c.theirs.length, 1);
    const sf = HK.FS(600, 12), statusLines = w => HK.wrap(g, statusLine(c).s, w, 2, sf).lines.length;
    const footWide = Math.min(iw - 170, 5 * ((t ? 132 : 116) + G));   // buttons beside the words when the window is wide
    const foot = wideFoot => 12 + (wideFoot ? 0 : statusLines(iw) * lh + 8) + R + 12;
    const base = { t, P, G, PH, step, R, GP, CG, lh, room, iw, headH, top, span, perIn, gridH, pack, sf, footWide };
    // wide
    for (const per of [4, 3]) {
      const colW = span(per) + 2 * GP, packW = iw - 2 * colW - 2 * CG;
      if (packW < span(4) + 2 * GP) continue;
      const pPer = perIn(packW), oRows = Math.ceil(n / per), pRows = Math.max(1, Math.ceil(pack.length / pPer));
      const body = headH + Math.max(gridH(oRows), gridH(pRows)), fb = foot(true);
      if (top + body + fb <= room.h) return Object.assign(base, { mode: 'wide', per, colW, packW, pPer, oRows, pRows, body, foot: fb, wideFoot: true, h: top + body + fb });
    }
    // stacked
    { const colW = Math.floor((iw - CG) / 2), per = perIn(colW), pPer = perIn(iw), oRows = Math.ceil(n / per), pRows = Math.max(1, Math.ceil(pack.length / pPer));
      const body = headH + gridH(oRows) + 12 + headH + gridH(pRows), fb = foot(false);
      if (top + body + fb <= room.h) return Object.assign(base, { mode: 'stack', per, colW, packW: iw, pPer, oRows, pRows, body, foot: fb, wideFoot: false, h: top + body + fb }); }
    // tabs
    { const wideFoot = iw >= 560, fb = foot(wideFoot), tabsH = R + 10;
      const colW = Math.floor((iw - CG) / 2), per = perIn(colW), oRows = Math.ceil(n / per), pPer = perIn(iw);
      const avail = room.h - top - tabsH - fb - headH;
      const oRowsFit = Math.max(1, Math.floor((avail - 2 * GP + G) / step));
      let pRows = Math.max(1, Math.ceil(pack.length / pPer)), paging = false;
      if (top + tabsH + headH + gridH(pRows) + fb > room.h) { paging = true; pRows = Math.max(1, Math.floor((room.h - top - tabsH - fb - R - 6 - 2 * GP + G) / step)); }
      const offerBody = headH + gridH(Math.min(oRows, oRowsFit)), packBody = (paging ? R + 6 : headH) + gridH(pRows);
      const body = tabsH + Math.max(offerBody, packBody);
      return Object.assign(base, { mode: 'tabs', per, colW, packW: iw, pPer, oRows: Math.min(oRows, oRowsFit), pRows, paging, tabsH, body, foot: fb, wideFoot, h: Math.min(room.h, top + body + fb) }); }
  }

  HOOKS.panel.trade = (g, narrow) => {
    const c = TR.cur; if (!c) { closePanel(); return; }
    // a picked thing that is gone (all of it offered, or all of it taken back) is not picked any more
    if (c.sel && c.sel.from === 'pack' && !packList().some(x => x.id === c.sel.id)) c.sel = null;
    if (c.sel && c.sel.from === 'mine' && !c.mine.some(x => x.id === c.sel.id)) c.sel = null;
    if (c.stage === 'confirm') return drawConfirm(g, c);
    const L = tradePlan(g, c), { t, P, G, step, R, GP, CG, lh, iw, headH, gridH, pack, sf } = L;
    const tap0 = t ? 'Tap' : 'Click';
    const { px, py, h } = panelBox(g, L.room.w, L.h, 'Trade with ' + c.with, `${tap0} your things to offer them. Nothing moves until you both accept, then confirm.`);
    const x0 = px + 18; let y = py + L.top;
    const view = L.mode === 'tabs' ? (c.view === 'pack' ? 'pack' : 'offers') : 'both';
    if (L.mode === 'tabs') {
      const tw2 = Math.floor((iw - G) / 2);
      platePush(g, x0, y, tw2, R, 'trade:view:offers', 'Offers', () => { c.view = 'offers'; }, view === 'offers' ? 'primary' : null, { on: view === 'offers', name: 'The two offers' });
      platePush(g, x0 + tw2 + G, y, tw2, R, 'trade:view:pack', 'Your pack', () => { c.view = 'pack'; }, view === 'pack' ? 'primary' : null, { on: view === 'pack', name: 'Your pack: tap something to offer it' });
      y += L.tabsH;
    }
    // the two offers
    if (view !== 'pack') {
      const mx = x0, tx = x0 + L.colW + CG;
      colHead(g, mx, y, L.colW, 'You give', c.acc[0]);
      colHead(g, tx, y, L.colW, c.with + ' gives', c.acc[1]);
      offerGrid(g, mx, y + headH, L.colW, L.oRows, L.per, P, G, GP, c.mine, true, c.acc[0]);
      offerGrid(g, tx, y + headH, L.colW, L.oRows, L.per, P, G, GP, c.theirs, false, c.acc[1]);
    }
    // the pack
    if (view !== 'offers') {
      const kx = L.mode === 'wide' ? x0 + 2 * L.colW + 2 * CG : x0, ky = L.mode === 'stack' ? y + headH + gridH(L.oRows) + 12 : y, packW = L.packW;
      const perPage = L.pPer * L.pRows, pages = Math.max(1, Math.ceil(pack.length / perPage));
      c.packPage = clamp(c.packPage || 0, 0, pages - 1);
      const paging = !!L.paging, headRow = paging ? R + 6 : headH;
      HK.text(g, 'Your pack', kx, ky + (paging ? R / 2 + 5 : 14), { font: HK.FC(800, 13), color: T().goldHi, shadow: 'rgba(0,0,0,0.9)', box: { x: kx, y: ky, w: Math.min(packW, 110), h: paging ? R : 18 }, fitId: 'trade:head' });
      if (paging) {
        const bw = t ? 52 : 40;
        platePush(g, kx + packW - bw, ky, bw, R, 'trade:pack:next', '', () => { c.packPage = Math.min(pages - 1, c.packPage + 1); }, null, { enabled: c.packPage < pages - 1, name: 'The next page' });
        platePush(g, kx + packW - 2 * bw - G, ky, bw, R, 'trade:pack:prev', '', () => { c.packPage = Math.max(0, c.packPage - 1); }, null, { enabled: c.packPage > 0, name: 'The page before' });
        g.fillStyle = g.strokeStyle = c.packPage > 0 ? T().goldHi : T().inkMute; HK.EM.chevronL(g, kx + packW - 1.5 * bw - G, ky + R / 2, 12);
        g.fillStyle = g.strokeStyle = c.packPage < pages - 1 ? T().goldHi : T().inkMute; HK.EM.chevronR(g, kx + packW - bw / 2, ky + R / 2, 12);
        HK.text(g, `${c.packPage + 1} / ${pages}`, kx + 120, ky + R / 2 + 5, { font: HK.FC(800, 12), color: T().inkDim, box: { x: kx + 116, y: ky, w: packW - 2 * bw - G - 124, h: R }, fitId: 'trade:packpage' });
      }
      const gy = ky + headRow, packH = gridH(L.pRows);
      HK.vellumPlate(g, kx, gy, packW, packH);
      const shown = pack.slice(c.packPage * perPage, (c.packPage + 1) * perPage);
      if (!pack.length) HK.text(g, c.mine.length ? 'All of it is in your offer.' : 'Your pack is empty.', kx + packW / 2, gy + packH / 2 + 5, { font: HK.FS(600, 12), align: 'center', color: T().inkMute, box: { x: kx + 4, y: gy, w: packW - 8, h: packH }, fitId: 'trade:packnone' });
      const pox = kx + Math.round((packW - (L.pPer * P + (L.pPer - 1) * G)) / 2);
      shown.forEach((it, i) => {
        const px2 = pox + (i % L.pPer) * (P + G), py2 = gy + GP + Math.floor(i / L.pPer) * step + Math.round(P * 0.04);
        pouchBtn(g, px2, py2, P, { id: it.id, qty: it.have }, 'trade:pack:' + it.id + ':', !!c.sel && c.sel.from === 'pack' && c.sel.id === it.id, `${itemName(it.id)}: you have ${fmt(it.have)}. Tap to offer some.`, () => { c.sel = { from: 'pack', id: it.id }; c.note = null; });
      });
    }
    // the words and the footer
    const fy = py + h - 12 - R, st = statusLine(c);
    if (L.wideFoot) {
      const used = footer(g, c, x0, fy, L.footWide), sw = iw - used - 12;
      const ls = HK.wrap(g, st.s, sw, 2, sf).lines;
      ls.forEach((l, i) => HK.text(g, l, x0, fy + R / 2 + 5 + (i - (ls.length - 1) / 2) * lh, { font: sf, color: st.color, box: { x: x0, y: fy, w: sw, h: R }, fitId: 'trade:status' }));
    } else {
      const ls = HK.wrap(g, st.s, iw, 2, sf).lines, sh = ls.length * lh + 8, sy = fy - 12 - sh + 8;
      ls.forEach((l, i) => HK.text(g, l, x0, sy + (i + 1) * lh, { font: sf, color: st.color, box: { x: x0, y: sy, w: iw, h: sh }, fitId: 'trade:status' }));
      footer(g, c, x0, fy, iw);
    }
  };

  // "Are you sure?": exactly what each of you gets, in words, with the pictures
  function drawConfirm(g, c) {
    const t = touchMode(), R = HK.row(), G = t ? 8 : 6, lh = Math.round(15 * HK.k() * 10) / 10;
    const room = panelRoom(720, VH), iw = room.w - 36, colW = Math.floor((iw - 16) / 2);
    const lf = HK.FS(700, 13), stat = wrapStatus(g, c, iw), statusH = stat.lines.length * lh + 8;
    const entry = it => HK.wrap(g, (it.id === 'coins' ? fmt(it.qty) + ' ' + (it.qty === 1 ? 'coin' : 'coins') : fmt(it.qty) + ' ' + itemName(it.id)), colW - 16 - 30, 2, lf).lines;
    const rowsOf = list => list.map(it => { const ls = entry(it); return { it, ls, h: Math.max(26, ls.length * lh + 8) }; });
    const A = rowsOf(c.theirs), B = rowsOf(c.mine);   // A: what you get (their offer); B: what they get (yours)
    const headH = 22, fixed = 62 + headH + 12 + statusH + R + 14;
    const avail = room.h - fixed - 16;
    const paginate = rows => { const pg = [[]]; let used = 0; for (const r of rows) { if (used + r.h > avail && pg[pg.length - 1].length) { pg.push([]); used = 0; } pg[pg.length - 1].push(r); used += r.h; } return pg; };
    let pa = paginate(A), pb = paginate(B), pages = Math.max(pa.length, pb.length), pagerH = 0;
    if (pages > 1) { pagerH = R + 8; const av2 = avail - pagerH; const pg2 = rows => { const pg = [[]]; let used = 0; for (const r of rows) { if (used + r.h > av2 && pg[pg.length - 1].length) { pg.push([]); used = 0; } pg[pg.length - 1].push(r); used += r.h; } return pg; }; pa = pg2(A); pb = pg2(B); pages = Math.max(pa.length, pb.length); }
    c.page = clamp(c.page || 0, 0, pages - 1);
    const listH = Math.max(40, ...[pa, pb].map(p => Math.max(0, ...p.map(pg => pg.reduce((s, r) => s + r.h, 0))))) + 16;
    const h = Math.min(room.h, 62 + headH + listH + 12 + pagerH + statusH + R + 14);
    const { px, py } = panelBox(g, room.w, h, 'Are you sure?', `Trade with ${c.with}. This is exactly what each of you gets.`);
    const x0 = px + 18, y0 = py + 62;
    const side = (x, head, pagesL, accepted) => {
      colHead(g, x, y0, colW, head, accepted);
      HK.vellumPlate(g, x, y0 + headH, colW, listH, { edge: accepted ? 'rgba(138,216,131,0.9)' : null });
      const rows = pagesL[c.page] || [];
      if (!rows.length && c.page === 0) HK.text(g, 'Nothing', x + colW / 2, y0 + headH + listH / 2 + 5, { font: HK.FS(600, 13), align: 'center', color: T().inkMute, box: { x: x + 4, y: y0 + headH, w: colW - 8, h: listH }, fitId: 'trade:nothing' });
      let yy = y0 + headH + 8;
      for (const r of rows) {
        drawItemIcon(g, r.it.id, x + 8 + 11, yy + r.h / 2, 18);
        r.ls.forEach((l, i) => HK.text(g, l, x + 8 + 30, yy + r.h / 2 + 5 + (i - (r.ls.length - 1) / 2) * lh, { font: lf, color: T().ink, box: { x: x + 36, y: yy, w: colW - 16 - 28, h: r.h }, fitId: 'trade:line' }));
        yy += r.h;
      }
    };
    side(x0, 'You get', pa, c.conf[0]);
    side(x0 + colW + 16, c.with + ' gets', pb, c.conf[1]);
    let y = y0 + headH + listH + 12;
    if (pages > 1) { rowPager(g, x0, y, iw, c.page, pages, p => { c.page = p; }); y += pagerH; }
    stat.lines.forEach((l, i) => HK.text(g, l, x0, y + (i + 1) * lh, { font: stat.f, color: stat.st.color, box: { x: x0, y, w: iw, h: statusH }, fitId: 'trade:status' }));
    footer(g, c, x0, py + h - 14 - R, iw);
  }

  window.TRADE = {
    openMenu, closeMenu, get menu() { return TR.menu; },
    follow, stopFollow, get following() { return TR.follow ? TR.follow.n : null },
    ask, answer, add, take, accept, confirm, close, get cur() { return TR.cur; }, get asks() { return TR.asks; },
    packList, fits, apply, knightAt, placeCard,
  };

  // ---------- self-test ----------
  const P = 'trade: ';
  HOOKS.selfTest.push((check, F, h) => {
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake };
    const made = [];
    const fake = { call: async () => ({}), open: () => { const s = { readyState: 1, sent: [], send(str) { const m = JSON.parse(str); s.sent.push(m); if (m.t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'Cohen', at: 1, keeper: 'Cohen', role: 'player' }) }); }, close() { s.readyState = 3; if (s.onclose) s.onclose(); } }; made.push(s); return s; } };
    NET.disconnect(); NET.enabled = true; NET.token = 'trade-test'; NET.useFake(fake); NET.connect();
    const sock = made[0], feed = m => sock.onmessage({ data: JSON.stringify(m) });
    const sent = t => sock.sent.filter(m => m.t === t), mark = () => sock.sent.length, since = (k, t) => sock.sent.slice(k).filter(m => m.t === t);
    const dc = dialog.cur, dq = dialog.queue.slice(); dialog.cur = null; dialog.queue.length = 0;
    const mech0 = player.mech, inv0 = player.inv.map(s => s ? { ...s } : null), bank0 = player.bank.slice(), trades0 = player.trades, t0 = window.__forceTouch;
    player.mech = null; closePanel(); h.peace(true); player.hp = player.maxHp; window.__forceTouch = false;
    const o = h.openSpot(ATLAS.world.tx(40), ATLAS.world.ty(24)); F.tp(o.x, o.y); F.step([]);
    const knight = (n, dx, dy, extra) => feed(Object.assign({ t: 'p', n, map: 'over', x: Math.round(player.x + dx), y: Math.round(player.y + dy), fx: -1, fy: 0, mv: false, wt: 0, hp: 20, mhp: 20, lv: 7, look: null, mech: null, dead: false, def: 100, act: null, role: 'player' }, extra || {}));
    const screen = (wx, wy) => { render(); return [wx - cam.x, wy - cam.y]; };
    const click = (sx, sy, id) => { pointerDown(sx, sy, id); pointerUp(id, sx, sy); render(); };
    const btn = l => buttons.find(b => b.label === l);
    const empty = () => new Array(INV_SLOTS).fill(null);
    try {
      // 1. a tap on a knight opens the card (Trade, Follow, Close), and neither swings nor walks; a tap on the ground does not
      { knight('Ava', 96, 0); F.step([]); render();
        const e = REMOTE().Ava; const [sx, sy] = screen(e.shown.x, e.shown.y - 8);
        player.attackT = 0; player.attackCd = 0; tapCancel('manual'); tap.lastTap = null;
        click(sx, sy, 'mouse'); click(sx, sy, 'mouse');   // twice, quickly: a double-tap on a knight is not a swing either
        const opened = !!TR.menu && TR.menu.n === 'Ava', noSwing = !(player.attackT > 0), noWalk = !player.walkPath && !tap.kind;
        const three = ['knight:trade', 'knight:follow', 'knight:close'].every(l => !!btn(l));
        const label = tapLabelFor(tapPick(sx, sy));
        click(btn('knight:close').x + 5, btn('knight:close').y + 5, 'mouse'); const closed = TR.menu === null && !btn('knight:trade');
        // the ground beside the knight: a walk, no card
        const [gx, gy] = screen(player.x - 2 * TILE, player.y); click(gx, gy, 'mouse'); const ground = TR.menu === null && tap.kind === 'walk'; tapCancel('manual');
        // with a card open, a tap on the ground only closes it
        click(sx, sy, 'mouse'); click(gx, gy, 'mouse'); const swallowed = TR.menu === null && !player.walkPath && !tap.kind;
        check(P + 'a tap (or click) on another knight opens their card with Trade, Follow and Close, and neither swings nor walks; Close closes it; a tap on the ground walks and opens no card; with a card open a tap elsewhere only closes it; a long press names the knight',
          opened && noSwing && noWalk && three && closed && ground && swallowed && /^Ava/.test(String(label)), { opened, noSwing, noWalk, three, closed, ground, swallowed, label }); }
      // 2. the card sits clear of every other control, on screen, 44 px on touch, at every size, touch and mouse, and names
      //    an admin with the ADMIN pill; where the screen is too crowded beside the knight it is a small panel instead
      { const restore = panelSizeSaver(), problems = [], how = {}; let tried = 0;
        const frame = where => { const fc = HK.audit.fitCtx(); HK.FIT.on = true; HK.FIT.log.length = 0; HK.DRAWN.on = true; HK.DRAWN.log.length = 0; try { drawHud(fc); } finally { HK.FIT.on = false; HK.DRAWN.on = false; } const out = HK.audit.fitIssues(where).filter(q => /trade:card|button|panel:/.test(q)); HK.FIT.log.length = 0; return out; };
        try {
          for (const [w, hh] of HK.audit.SIZES) { let sized = false; for (const tch of [true, false]) {
            if (!panelSetSize(w, hh)) continue; sized = true; window.__forceTouch = tch; const where = `${w}x${hh} ${tch ? 'touch' : 'mouse'}`;
            for (const which of ['menu', 'ask']) {
              closePanel(); TR.menu = null; TR.asks = []; TR.askPanel = null; TR.cardCache = {};
              F.tp(o.x, o.y); F.step([]); knight('Ava', 60, 0, { role: 'admin' });
              if (which === 'menu') TR.menu = { n: 'Ava' }; else TR.asks = [{ from: 'Ava', role: 'admin', at: time }];
              render(); frame(where); render();
              const labels = which === 'menu' ? ['knight:trade', 'knight:follow', 'knight:close'] : ['ask:yes', 'ask:no'];
              const asPanel = panel === (which === 'menu' ? 'knight' : 'tradeask');
              how[where + ' ' + which] = asPanel ? 'panel' : 'card';
              if (asPanel) problems.push(...panelFrame(where + ' ' + which + ' panel'));
              else { problems.push(...frame(where)); for (const q of HK.audit.frameIssues(where)) if (/knight:|ask:/.test(q)) problems.push(q); }
              for (const l of labels) if (!btn(l)) problems.push(where + ': no ' + l);
            }
          } if (sized) tried++; }
        } finally { closePanel(); TR.menu = null; TR.asks = []; TR.askPanel = null; window.__forceTouch = false; restore(); render(); }
        const cards = Object.values(how).filter(v => v === 'card').length;
        check(P + 'the knight card and the "wants to trade" card: at all 8 sizes, touch and mouse, beside the knight with every button 44 px on touch and clear of every other control, the knight, the notice lane and the bands (or, where the screen is too crowded for that, the same buttons in a small panel), every word inside its plate',
          tried === 8 && problems.length === 0 && cards >= 16, { tried, cards, how, problems: problems.slice(0, 8), total: problems.length }); }
      // 3. follow: the knight walks after a friend who keeps moving, stops beside them, and a key press ends it
      { F.tp(o.x, o.y); F.step([]); const ex = player.x + 6 * TILE, ey = player.y;
        knight('Ava', 6 * TILE, 0); F.step([]); TR.menu = { n: 'Ava' }; render(); btn('knight:follow').action(); render();
        const on = TRADE.following === 'Ava' && PLAYERS.following === 'Ava' && TR.menu === null;
        let plaque = false; { HK.FRAME.plaqueIds = []; render(); plaque = (HK.FRAME.plaqueIds || []).includes('follow'); }
        const d0 = Math.hypot(ex - player.x, ey - player.y);
        // Ava walks east a tile every half second; the follower keeps up
        let fx = ex;
        for (let i = 0; i < 6; i++) { fx += TILE / 2; feed({ t: 'p', n: 'Ava', map: 'over', x: Math.round(fx), y: Math.round(ey), fx: 1, fy: 0, mv: true, wt: 0, hp: 20, mhp: 20, lv: 7, look: null, mech: null, dead: false, def: 100, act: null }); F.sim(30, []); }
        F.sim(120, []);
        const gap = Math.hypot(fx - player.x, ey - player.y), stood = gap <= GO + 4 && gap >= 24 && !player.moving;
        const x1 = player.x; F.sim(10, ['KeyA']); const ended = TRADE.following === null && PLAYERS.following === null && player.x < x1;
        check(P + 'Follow walks after a friend who keeps moving (re-planned as they go), stands about a tile behind them, shows a plaque, and a key press ends it',
          on && plaque && d0 > 5 * TILE && stood && ended, { on, plaque, d0: Math.round(d0), gap: Math.round(gap), moving: player.moving, ended }); }
      // 3b. a tap on the ground ends a follow; a friend leaving the map ends it with a word
      { F.tp(o.x, o.y); F.step([]); knight('Ava', 3 * TILE, 0); follow('Ava'); F.sim(5, []); const [gx, gy] = screen(player.x - 2 * TILE, player.y); click(gx, gy, 'mouse'); const byTap = TRADE.following === null && tap.kind === 'walk'; tapCancel('manual');
        follow('Ava'); feed({ t: 'left', n: 'Ava', map: 'over' }); F.step([]); const byLeave = TRADE.following === null && !!notice && /left this place/.test(notice.text);
        check(P + 'a tap somewhere else ends a follow (and walks there); the friend leaving your map ends it and says so', byTap && byLeave, { byTap, byLeave }); }
      // 4. Trade asks when close, and walks up first when not; an ask put to us is a card with Accept / No
      { F.tp(o.x, o.y); F.step([]); knight('Ava', 2 * TILE, 0); const k0 = mark();
        TR.menu = { n: 'Ava' }; render(); btn('knight:trade').action(); const asked = since(k0, 'trade_ask').length === 1 && since(k0, 'trade_ask')[0].to === 'Ava';
        feed({ t: 'trade_asked', to: 'Ava' }); const told = !!notice && notice.text === 'You asked Ava to trade.';
        knight('Ben', 9 * TILE, 0); const k1 = mark(); ask('Ben'); const walks = TRADE.following === 'Ben' && since(k1, 'trade_ask').length === 0;
        for (let i = 0; i < 400 && TRADE.following; i++) F.step([]);
        const thenAsked = since(k1, 'trade_ask').some(m => m.to === 'Ben') && TRADE.following === null;
        feed({ t: 'trade_no', code: 'declined', n: 'Ben' }); const no = !!notice && notice.text === 'Ben said no to trading.';
        feed({ t: 'trade_ask', from: 'Ava', role: 'player' }); render(); const card = !!btn('ask:yes') && !!btn('ask:no');
        const k2 = mark(); btn('ask:no').action(); render(); const said = since(k2, 'trade_answer').length === 1 && since(k2, 'trade_answer')[0].yes === false && !btn('ask:yes');
        feed({ t: 'trade_ask', from: 'Ava', role: 'player' }); feed({ t: 'trade_ask_off', from: 'Ava' }); render(); const off = !btn('ask:yes');
        check(P + 'Trade asks a knight within reach; a far one is walked up to first and then asked; a No is said plainly; an ask put to us is a card with Accept and No that answers the world, and goes when the world says so',
          asked && told && walks && thenAsked && no && card && said && off, { asked, told, walks, thenAsked, no, card, said, off }); }
      // 5. the trade window with a fake wire: offer from the pack, any change un-accepts, accept, are you sure, confirm, done once
      { F.tp(o.x, o.y); F.step([]); knight('Ava', 60, 0); player.inv = empty(); addItem('bread', 8); addItem('coins', 3); player.trades = { done: [] };
        const k0 = mark();
        feed({ t: 'trade_ask', from: 'Ava', role: 'player' }); render(); btn('ask:yes').action();
        const answered = since(k0, 'trade_answer').some(m => m.from === 'Ava' && m.yes === true);
        feed({ t: 'trade_open', id: 7, with: 'Ava', ver: 1 }); feed({ t: 'trade_state', id: 7, ver: 1, stage: 'offer', mine: [], theirs: [], acc: [false, false], conf: [false, false] }); render();
        const open = panel === 'trade' && !!btn('trade:pack:bread:') && !!btn('disabled:trade:accept');
        btn('trade:pack:bread:').action(); render(); const amounts = !!btn('trade:add:one') && !!btn('trade:add:all') && !btn('trade:add:ten');
        btn('trade:add:all').action(); render();
        const off1 = since(k0, 'trade_offer'); const offerSent = off1.length === 1 && JSON.stringify(off1[0]) === JSON.stringify({ t: 'trade_offer', id: 7, items: [{ id: 'bread', qty: 8 }] });
        const packGone = !btn('trade:pack:bread:') && countItem('bread') === 8;
        // take three back
        feed({ t: 'trade_state', id: 7, ver: 2, stage: 'offer', mine: [{ id: 'bread', qty: 8 }], theirs: [], acc: [false, false], conf: [false, false] }); render();
        btn('trade:mine:bread:').action(); render(); btn('trade:take:one').action(); btn('trade:take:one').action(); btn('trade:take:one').action();
        const took = sent('trade_offer').slice(-1)[0].items[0].qty === 5; render(); btn('trade:back').action();
        feed({ t: 'trade_state', id: 7, ver: 5, stage: 'offer', mine: [{ id: 'bread', qty: 5 }], theirs: [{ id: 'coins', qty: 20 }], acc: [false, false], conf: [false, false] }); render();
        btn('trade:accept').action(); const acc = sent('trade_accept').slice(-1)[0]; const accepted = !!acc && acc.id === 7 && acc.ver === 5;
        feed({ t: 'trade_state', id: 7, ver: 5, stage: 'offer', mine: [{ id: 'bread', qty: 5 }], theirs: [{ id: 'coins', qty: 20 }], acc: [true, false], conf: [false, false] }); render();
        const waits = !!btn('disabled:trade:accept');
        // Ava changes her offer: the world un-accepts both; the window says so and Accept is live again
        feed({ t: 'trade_state', id: 7, ver: 6, stage: 'offer', mine: [{ id: 'bread', qty: 5 }], theirs: [{ id: 'coins', qty: 21 }], acc: [false, false], conf: [false, false] }); render();
        const unaccepted = !!btn('trade:accept') && TR.cur.acc[0] === false && TR.cur.ver === 6;
        feed({ t: 'trade_state', id: 7, ver: 7, stage: 'offer', mine: [{ id: 'bread', qty: 5 }], theirs: [{ id: 'coins', qty: 20 }], acc: [false, true], conf: [false, false] }); render();
        btn('trade:accept').action();
        feed({ t: 'trade_state', id: 7, ver: 7, stage: 'confirm', mine: [{ id: 'bread', qty: 5 }], theirs: [{ id: 'coins', qty: 20 }], acc: [true, true], conf: [false, false] }); render();
        const sure = panel === 'trade' && !!btn('trade:confirm') && !btn('trade:pack:bread:');
        btn('trade:confirm').action(); const conf = sent('trade_confirm').slice(-1)[0]; const confirmed = !!conf && conf.ver === 7;
        const nothingYet = countItem('bread') === 8 && countItem('coins') === 3;
        const k1 = mark();
        feed({ t: 'trade_done', tid: 41, id: 7, with: 'Ava', gave: [{ id: 'bread', qty: 5 }], got: [{ id: 'coins', qty: 20 }] });
        const once1 = countItem('bread') === 3 && countItem('coins') === 23 && panel !== 'trade' && TR.cur === null && player.trades.done.includes('t41') && since(k1, 'trade_ack').length === 1 && since(k1, 'trade_ack')[0].tid === 41;
        feed({ t: 'trade_done', tid: 41, id: null, with: 'Ava', gave: [{ id: 'bread', qty: 5 }], got: [{ id: 'coins', qty: 20 }] });
        const once2 = countItem('bread') === 3 && countItem('coins') === 23 && since(k1, 'trade_ack').length === 2;
        check(P + 'the trade window with a fake wire: Accept answers the ask; your pack offers (Add 1 / Add all), your offer takes back; Accept sends the version shown and waits; a change un-accepts; "Are you sure?" confirms; trade_done takes out and puts in exactly once (a repeat only acks)',
          answered && open && amounts && offerSent && packGone && took && accepted && waits && unaccepted && sure && confirmed && nothingYet && once1 && once2, { answered, open, amounts, offerSent, packGone, took, accepted, waits, unaccepted, sure, confirmed, nothingYet, once1, once2, bread: countItem('bread'), coins: countItem('coins') }); }
      // 6. cancellation moves nothing: the world's trade_end, and the window closed by hand (trade_close goes out)
      { player.inv = empty(); addItem('bread', 5); addItem('coins', 3); const snap = JSON.stringify(player.inv);
        feed({ t: 'trade_open', id: 8, with: 'Ava', ver: 1 }); feed({ t: 'trade_state', id: 8, ver: 2, stage: 'confirm', mine: [{ id: 'bread', qty: 5 }], theirs: [{ id: 'coins', qty: 20 }], acc: [true, true], conf: [false, true] });
        feed({ t: 'trade_end', id: 8, code: 'far', n: 'Ava' }); F.step([]);
        const ended = TR.cur === null && panel !== 'trade' && JSON.stringify(player.inv) === snap && !!notice && notice.text === 'Ava walked away, so the trade is off. Nothing was swapped.';
        const k0 = mark(); feed({ t: 'trade_open', id: 9, with: 'Ava', ver: 1 }); render(); btn('×').action(); F.step([]);
        const closed = TR.cur === null && since(k0, 'trade_close').length === 1 && since(k0, 'trade_close')[0].id === 9 && JSON.stringify(player.inv) === snap;
        feed({ t: 'trade_open', id: 10, with: 'Ava', ver: 1 }); render(); btn('trade:decline').action(); F.step([]);
        const declined = TR.cur === null && sent('trade_close').slice(-1)[0].id === 10;
        feed({ t: 'trade_done', tid: 42, id: 99, with: 'Ava', gave: [], got: [{ id: 'no_such_thing_yet', qty: 1 }] });
        const newer = JSON.stringify(player.inv) === snap && !player.trades.done.includes('t42') && !sent('trade_ack').some(m => m.tid === 42);
        check(P + 'a trade that ends (the world says so, the close seal, Decline) moves nothing and closes the window; a finished trade with an item this game does not know moves nothing and is not acked',
          ended && closed && declined && newer, { ended, closed, declined, newer }); }
      // 7. a full pack is refused before anything moves: Accept sends trade_full, and the note names whose pack
      { player.inv = new Array(INV_SLOTS).fill(null).map(() => ({ id: 'iron_dagger', qty: 1 })); player.inv[0] = { id: 'coins', qty: 5 };
        feed({ t: 'trade_open', id: 11, with: 'Ava', ver: 1 }); feed({ t: 'trade_state', id: 11, ver: 2, stage: 'offer', mine: [{ id: 'coins', qty: 5 }], theirs: [{ id: 'bread', qty: 1 }, { id: 'wood', qty: 1 }], acc: [false, false], conf: [false, false] }); render();
        const k0 = mark(); btn('trade:accept').action();
        const full = since(k0, 'trade_full').length === 1 && since(k0, 'trade_accept').length === 0;
        feed({ t: 'trade_note', id: 11, code: 'full', n: 'Cohen' }); const mine = !!notice && notice.text === 'Your pack is too full for this trade.';
        feed({ t: 'trade_note', id: 11, code: 'full', n: 'Ava' }); const theirs = !!notice && notice.text === "Ava's pack is too full for this trade.";
        const fitsOk = fits([{ id: 'coins', qty: 5 }], [{ id: 'bread', qty: 1 }]) === 'ok' && fits([], [{ id: 'bread', qty: 1 }]) === 'full' && fits([], [{ id: 'nope_new', qty: 1 }]) === 'new';
        closePanel(); F.step([]);
        check(P + "a pack too full: Accept sends trade_full instead (nothing moves), and the note says whose: \"Your pack is too full for this trade.\" / \"Ava's pack is too full for this trade.\"", full && mine && theirs && fitsOk, { full, mine, theirs, fitsOk }); }
      // 8. the keyring never offers; party hats do
      { player.inv = empty(); addItem('party_hat_purple', 1); const keyId = window.KEYRING ? Object.keys(KEYRING.KEYS)[0] : null; if (keyId) player.inv[5] = { id: keyId, qty: 1 };
        feed({ t: 'trade_open', id: 12, with: 'Ava', ver: 1 }); render();
        const hat = !!btn('trade:pack:party_hat_purple:'), noKey = !keyId || (!btn('trade:pack:' + keyId + ':') && add(keyId, 1) === false);
        closePanel(); F.step([]);
        check(P + 'a party hat can be offered like anything else; a keyring item cannot', hat && noKey, { hat, noKey, keyId }); }
      // 9. the trade window and "Are you sure?" at every size, touch and mouse, normal and Large text: controls 44 px on touch
      //    (26 with a mouse), 8 px apart (4), on screen, out of the bands, every word inside its box
      { const restore = panelSizeSaver(), text0 = SETTINGS.get('text'), problems = []; let tried = 0;
        const many = ['bread', 'coins', 'wood', 'stone', 'coal', 'iron_ore', 'raw_shrimp', 'spider_silk', 'bronze_axe', 'iron_sword', 'party_hat_red', 'meat_pie'].filter(id => ITEMS[id]);
        try {
          for (const [w, hh] of HK.audit.SIZES) {
            if (!panelSetSize(w, hh)) continue; tried++;
            for (const tch of [true, false]) for (const big of ['normal', 'large']) for (const scene of ['offer', 'pick', 'full', 'confirm']) {
              window.__forceTouch = tch; SETTINGS.set('text', big);
              player.inv = empty(); many.forEach((id, i) => { player.inv[i] = { id, qty: i % 2 ? 250 : 1 }; }); for (let i = many.length; i < INV_SLOTS; i++) player.inv[i] = { id: 'iron_dagger', qty: 1 };
              TR.cur = { id: 20, with: 'Maximilian', ver: 3, stage: scene === 'confirm' ? 'confirm' : 'offer', mine: scene === 'full' ? many.slice(0, 12).map(id => ({ id, qty: 1 })) : [{ id: 'bread', qty: 1 }], theirs: many.slice(0, scene === 'full' || scene === 'confirm' ? 12 : 3).map((id, i) => ({ id, qty: i * 1000 + 1 })), acc: [false, true], conf: [false, true], sel: scene === 'pick' ? { from: 'pack', id: 'coins' } : null, page: 0, packPage: 0, note: scene === 'full' ? "Maximilian's pack is too full for this trade." : null };
              closePanel(); panel = 'trade';
              problems.push(...panelFrame(`trade ${scene} ${w}x${hh} ${tch ? 'touch' : 'mouse'} ${big}`));
              if (!buttons.some(b => /trade:(accept|confirm|add:all)/.test(b.label))) problems.push(`trade ${scene} ${w}x${hh}: no footer`);
            }
          }
        } finally { TR.cur = null; panel = null; window.__forceTouch = false; SETTINGS.set('text', text0); restore(); render(); }
        const src = String(HOOKS.panel.trade) + String(drawConfirm), dots = !/…|…/.test(src);
        check(P + 'the trade window (offering, picking an amount, twelve things each with a full-pack note) and "Are you sure?" at all 8 sizes, touch and mouse, normal and Large text: controls 44 px on touch (26 with a mouse), 8 px apart (4), on screen, out of the bands, every word inside its box (no "...")',
          tried === 8 && problems.length === 0 && dots, { tried, dots, problems: problems.slice(0, 10), total: problems.length }); }
      // 10. with the cloud save on, the ack waits until the cloud holds a save with the trade in it
      if (window.CLOUD && window.LOGIN) { player.inv = empty(); addItem('bread', 5); player.trades = { done: [] };
        const puts = [], call0 = fake.call; let putsDown = true;
        fake.call = (method, path, body) => { if (method === 'PUT' && path === '/api/save') { puts.push(body); if (putsDown) return { __threw: new Error('down') }; return { at: 1 }; } return {}; };
        const LG = window.LOGIN, play0 = LG.playing; CLOUD.reset(); LG.playing = true;
        const k0 = mark(); feed({ t: 'trade_done', tid: 55, id: null, with: 'Ava', gave: [{ id: 'bread', qty: 5 }], got: [{ id: 'coins', qty: 9 }] });
        const waits = since(k0, 'trade_ack').length === 0 && player.trades.done.includes('t55') && countItem('coins') === 9;
        putsDown = false; save(); CLOUD.flush(); F.sim(5, []);
        const after = since(k0, 'trade_ack').length === 1 && cloudHolds('t55');
        CLOUD.reset(); LG.playing = play0; fake.call = call0;
        check(P + 'with the cloud save on, the ack waits while the push fails and goes out once the cloud holds a save with that trade in it', waits && after, { waits, after, puts: puts.length }); }
    } finally {
      TR.menu = null; TR.asks = []; TR.asking = null; TR.cur = null; if (TR.follow) stopFollow('test'); TR.waiting.length = 0; TR.cardCache = {};
      NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null;
      for (const n in REMOTE()) delete REMOTE()[n];
      player.inv = inv0; player.bank = bank0; player.trades = trades0; player.mech = mech0; window.__forceTouch = t0;
      dialog.cur = dc; dialog.queue.length = 0; dialog.queue.push(...dq); closePanel(); tapCancel('manual'); h.peace(false); notice = null; render();
    }
  });
}
