// ============================================================================
// THE TEACHER SCREEN — the teacher view, round 2 (docs/ONLINE.md, "The teacher view")
// Owner (6 Oct 2026): "proportions are off maybe they need to be scalable, being able to click a player and monitor their POV
// would be nice, also all of this should work through just the standard login. I don't wanna have to convey separate webpages
// and authentication pages in this and that."
// A teacher signs in on the game's own card (71-login: her name in Knight's name, her password in Secret word, Play). The
// world answers {teacher: true, token, name, expires} and the card opens THIS screen instead of the game: the page never
// loads a knight, never plays, never saves, never opens a knight's socket. It fills the window at every size: the chat on the
// left, the live map (or the kid being watched, 79-view) in the middle, who is on on the right, with dividers a teacher drags
// (remembered on this device); under 900 px the map sits on top and the chat or the list under it.
//
//   TEACHERSCREEN.open({token, name, expires})   from the card: teacher mode on, the screen built, the socket opened
//   TEACHERSCREEN.pristine                       true until a knight is loaded on this page (title.startSlot): a teacher's
//                                                answer on a page that is not pristine reloads it first (71-login, J1)
//   TEACHERSCREEN.make(env)                      the screen itself, over any window/document (the self-tests give it a
//                                                small stand-in DOM)
//   TEACHERSCREEN.layoutLabels(view, places, dots, measure, prev)   the map's names, laid out (pure; online/test reads it)
//
// The token lives only in this file's closures: never localStorage, sessionStorage, a cookie or a URL; the socket's address
// carries a single-use ticket. What this page keeps: localStorage 'fanglands.teacher.layout' (the panes' sizes as fractions,
// and the Watch zoom) and sessionStorage 'fanglands.teacher.bye' (why the last screen ended, a code; never a secret).
// Everything is built with createElement and textContent: no HTML from anywhere.
// Feature file: wraps title.startSlot by reassignment (pristine); 79-view does the drawing. window.TEACHERSCREEN.
// ============================================================================
{
  const LAYOUT_KEY = 'fanglands.teacher.layout', BYE_KEY = 'fanglands.teacher.bye';
  const PING = '{"t":"ping"}', PING_MS = 25000, IDLE_MS = 60 * 60000, IDLE_WARN_MS = 2 * 60000, BACKOFF_MAX = 300, TRIES_MAX = 30;
  const AWAY_MS = 30000, STALE_MS = 10000, FLAG_MS = 10 * 60000, CONFIRM_MS = 5000, TOAST_MS = 8000, CHAT_KEEP_MS = 60 * 60000;
  const HINT_MS = 10000, HIDDEN_MS = 60000, WAIT_MS = 3000, PAUSED_MS = 5000, STATUS_MS = 20000, LABEL_EVERY = 1000;
  const NO_RECONNECT = [4008, 4010, 4011, 4012, 4013, 4014];
  // the panes (docs/ONLINE.md, "The teacher view", the layout): wide at 900 px and over
  const WIDE_MIN = 900, CHAT_MIN = 260, WHO_MIN = 280, MID_MIN = 380, SIDE_MAX = 0.4, CHAT_DEF = 0.24, WHO_DEF = 0.26;
  const SPLIT_DEF = 0.55, SPLIT_MIN = 240, SPLIT_MAX = 0.75, FOLD_H = 420, KEY_STEP = 24;
  // narrow and watching a kid: his screen gets more of the window (its own fraction, dragged and saved the same way)
  const WSPLIT_DEF = 0.7, WSPLIT_MAX = 0.82;
  const TIGHT = 700;   // under this the bar may take a second row
  const ZOOM_MIN = 0.6, ZOOM_MAX = 2, ZOOM_STEP = 1.25;
  const SAY_MAX = 120;   // a teacher's chat line: the game chat's own cap (74-chat MAX, filter.js checkChat)
  const divW = coarse => coarse ? 20 : 12;
  const BYE = {
    4010: 'You signed out.',
    idle: 'You were signed out because nothing was pressed for an hour.',
    4011: 'Your sign-in ran out for today. Sign in again to keep watching.',
    4012: 'Ethan turned this sign-in off.',
    4013: 'Your password was changed. Sign in with the new one.',
    4014: 'Too many teacher screens are open. Close one and try again.',
    4008: 'That was too many taps at once. Sign in again.',
    fresh: 'Sign in once more to open the teacher view.',
  };
  const PAL = { bg: '#14161a', panel: '#1b1e24', line: '#2c3038', text: '#d7dae0', dim: '#a9b0bb', name: '#9bc1ff', admin: '#f5c542', amber: '#ffb86b', red: '#ff7b7b', green: '#3fb950' };
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));

  const TS = { pristine: true, active: false, screen: null, BYE, BYE_KEY, LAYOUT_KEY, CHAT_MIN, WHO_MIN, MID_MIN, WIDE_MIN };
  window.TEACHERSCREEN = TS;
  // the page is pristine until a knight is loaded on it: then its memory holds that kid's world, which a teacher never sees
  { const _start = title.startSlot; title.startSlot = function () { TS.pristine = false; return _start.apply(this, arguments); }; }

  // ---------- the panes' sizes (pure) ----------
  // Wide: {chat, mid, who, d} in px, the middle at least MID_MIN, each side between its minimum and 40% of the width; null
  // when the window cannot hold 260 + 380 + 280 and the dividers (or is under 900 px): then the screen is narrow.
  function wideSizes(W, fr, coarse) {
    const d = divW(coarse);
    if (!(W >= WIDE_MIN) || W < CHAT_MIN + MID_MIN + WHO_MIN + 2 * d) return null;
    const lf = fr && Number.isFinite(fr.l) ? fr.l : CHAT_DEF, rf = fr && Number.isFinite(fr.r) ? fr.r : WHO_DEF;
    let chat = cl(Math.round(lf * W), CHAT_MIN, Math.max(CHAT_MIN, Math.floor(SIDE_MAX * W)));
    let who = cl(Math.round(rf * W), WHO_MIN, Math.max(WHO_MIN, Math.floor(SIDE_MAX * W)));
    let over = chat + who + 2 * d + MID_MIN - W;
    while (over > 0) {
      const a = chat - CHAT_MIN, b = who - WHO_MIN; if (a <= 0 && b <= 0) break;
      if (b >= a) { const t = Math.min(over, b); who -= t; over -= t; } else { const t = Math.min(over, a); chat -= t; over -= t; }
    }
    return { chat, who, mid: W - chat - who - 2 * d, d };
  }
  // Narrow: the map's height in px over the panes' height H (default 55%, at least 240 px, at most 75%)
  function narrowSplit(H, split, max = SPLIT_MAX, def = SPLIT_DEF) {
    const f = Number.isFinite(split) ? split : def;
    const lo = Math.min(SPLIT_MIN, H * max), hi = Math.max(lo, H * max);
    return Math.round(cl(f * H, lo, hi));
  }
  // what this device remembers of the layout: fractions only, every read and write in try (a private window may throw)
  function readLayout(ls) {
    const out = { v: 1, wide: { l: CHAT_DEF, r: WHO_DEF }, narrow: { split: SPLIT_DEF, wsplit: WSPLIT_DEF }, zoom: 1 };
    let raw = null; try { raw = ls ? ls.getItem(LAYOUT_KEY) : null; } catch (e) { raw = null; }
    if (!raw) return out;
    let o = null; try { o = JSON.parse(raw); } catch (e) { return out; }
    if (!o || o.v !== 1) return out;
    const f = (v, lo, hi, d) => Number.isFinite(v) && v >= lo && v <= hi ? v : d;
    if (o.wide) { out.wide.l = f(o.wide.l, 0.05, SIDE_MAX, CHAT_DEF); out.wide.r = f(o.wide.r, 0.05, SIDE_MAX, WHO_DEF); }
    if (o.narrow) { out.narrow.split = f(o.narrow.split, 0.1, SPLIT_MAX, SPLIT_DEF); out.narrow.wsplit = f(o.narrow.wsplit, 0.1, WSPLIT_MAX, WSPLIT_DEF); }
    out.zoom = f(o.zoom, ZOOM_MIN, ZOOM_MAX, 1);
    return out;
  }
  function writeLayout(ls, L) {
    try { if (ls) ls.setItem(LAYOUT_KEY, JSON.stringify({ v: 1, wide: { l: +L.wide.l.toFixed(4), r: +L.wide.r.toFixed(4) }, narrow: { split: +L.narrow.split.toFixed(4), wsplit: +(L.narrow.wsplit || WSPLIT_DEF).toFixed(4) }, zoom: +L.zoom.toFixed(3) })); return true; } catch (e) { return false; }
  }

  // ---------- the map's names (pure): one label per place, by priority, never over another or over a knight ----------
  // view {s (px per tile), x, y (where tile 0,0 is), w, h (the pane), fit (the scale the whole map fits at), font (px),
  //       obstacles: [{x, y, w, h}] (the map's own controls over it: +, −, Whole map, Key; pane px)}
  // places [{name, kind, box: [x0, y0, x1, y1], anchor: [x, y], depth, area, owns(tx, ty)}] (teacher-map.json's labels)
  // dots [{n, x, y, sel, flag}] in pane px; measure(text, font) -> px; prev {name: [tx, ty]} where each name sat last time.
  // Answers {clusters: [{x, y, r, ks}], dots: [{x, y, r, k, ox, oy}], tags: [{n, x, y, w, h}], labels: [{name, x, y, w, h, cx,
  // cy, tx, ty, font}]}; a name that fits nowhere at this zoom is left out (its dot stays). A knight whose dot would sit under
  // a control is drawn just beside it (ox, oy: where he really is; the page draws a thin line there), so every knight can be
  // seen and tapped. The big places a teacher knows the map by (MAJOR_AREA tiles and over) are placed before any name tag.
  // (LABELS:BEGIN ... LABELS:END: online/test/teacher-labels.test.mjs runs this function as it is written here)
  // LABELS:BEGIN
  function layoutLabels(view, places, dots, measure, prev) {
    const INSET = 6, PAD = 4, MERGE = 24, DOT_R = 7, CL_R = 13, MAJOR_AREA = 2000;
    const out = { clusters: [], dots: [], tags: [], labels: [] };
    const obst = (view.obstacles || []).filter(o => o && o.w > 0 && o.h > 0);
    // 0. a knight under one of the map's controls is moved just clear of it (the side nearest, inside the pane)
    const clear0 = CL_R + PAD;
    const nudge = d => {
      let x = d.x, y = d.y;
      if (!obst.length) return d;
      for (let pass = 0; pass < 3; pass++) {
        const o = obst.find(q => x > q.x - clear0 && x < q.x + q.w + clear0 && y > q.y - clear0 && y < q.y + q.h + clear0);
        if (!o) break;
        const x0 = CL_R + 2, x1 = Math.max(x0, view.w - CL_R - 2), y0 = CL_R + 2, y1 = Math.max(y0, view.h - CL_R - 2);
        const under = (cx, cy) => obst.some(q => cx > q.x - clear0 && cx < q.x + q.w + clear0 && cy > q.y - clear0 && cy < q.y + q.h + clear0);
        const c = [[o.x - clear0, y], [o.x + o.w + clear0, y], [x, o.y - clear0], [x, o.y + o.h + clear0]]
          .map(([cx, cy]) => [cl(cx, x0, x1), cl(cy, y0, y1)]).filter(([cx, cy]) => !under(cx, cy))
          .sort((a, b) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y));
        if (!c.length) break;
        x = c[0][0]; y = c[0][1];
      }
      return x === d.x && y === d.y ? d : { x, y };
    };
    // 1. the dots are fixed (but for 0); within 24 px they merge into a count circle
    const groups = [];
    for (const d0 of dots || []) {
      const at = nudge(d0), d = at === d0 ? d0 : Object.assign({}, d0, { x: at.x, y: at.y, ox: d0.x, oy: d0.y });
      const g = groups.find(q => Math.hypot(q.x - d.x, q.y - d.y) < MERGE);
      if (g) { g.ks.push(d); g.x = (g.x * (g.ks.length - 1) + d.x) / g.ks.length; g.y = (g.y * (g.ks.length - 1) + d.y) / g.ks.length; }
      else groups.push({ x: d.x, y: d.y, ks: [d] });
    }
    const circles = [];
    for (const g of groups) {
      if (g.ks.length > 1) { const at = nudge(g), c = { x: at.x, y: at.y, r: CL_R, ks: g.ks }; out.clusters.push(c); circles.push(c); }
      else { const k = g.ks[0], c = { x: g.x, y: g.y, r: DOT_R, k }; if (k.ox != null) { c.ox = k.ox; c.oy = k.oy; } out.dots.push(c); circles.push(c); }
    }
    const boxes = [];
    const underControl = b => obst.some(o => b.x < o.x + o.w + PAD && o.x < b.x + b.w + PAD && b.y < o.y + o.h + PAD && o.y < b.y + b.h + PAD);
    const inside = b => b.x >= INSET && b.y >= INSET && b.x + b.w <= view.w - INSET && b.y + b.h <= view.h - INSET && !underControl(b);
    const hitsBox = b => boxes.some(o => b.x < o.x + o.w + PAD && o.x < b.x + b.w + PAD && b.y < o.y + o.h + PAD && o.y < b.y + b.h + PAD);
    const hitsDot = (b, skip) => circles.some(c => c !== skip && (() => { const nx = cl(c.x, b.x, b.x + b.w), ny = cl(c.y, b.y, b.y + b.h); return Math.hypot(c.x - nx, c.y - ny) < c.r + PAD; })());
    // the places: depth first, then the bigger, then an area before a region; the first spot that fits wins
    const font = Math.max(13, view.font || 13) + (view.s >= view.fit * 4 ? 2 : view.s >= view.fit * 2 ? 1 : 0);
    const FONT = '600 ' + font + 'px sans-serif', LH = Math.round(font * 1.35);
    const order = (places || []).filter(p => p && p.box && p.anchor && p.kind !== 'door').slice().sort((a, b) => (b.depth - a.depth) || (b.area - a.area) || ((a.kind === 'area' ? 0 : 1) - (b.kind === 'area' ? 0 : 1)) || (a.name < b.name ? -1 : 1));
    const seen = new Set();
    const placeAll = list => { for (const p of list) {
      if (seen.has(p.name)) continue;
      const bw = (p.box[2] - p.box[0] + 1) * view.s, bh = (p.box[3] - p.box[1] + 1) * view.s;
      const w = Math.ceil(measure(p.name, FONT)) + 6, h = LH;
      // a name may be a little wider than its place; a big place's (a teacher finds her way by them) up to half as wide again:
      // on the Great Spread's 400 x 280 map the whole map draws every place a third smaller, and Thistledown's name is
      // wider than the town at a laptop's whole map. It is still never over another name or a knight, and centred on its ground
      if (w > (p.area >= MAJOR_AREA ? 1.5 : 1.1) * bw || h > bh) continue;
      const ax = view.x + (p.anchor[0] + 0.5) * view.s, ay = view.y + (p.anchor[1] + 0.5) * view.s;
      const cands = [];
      const last = prev && prev[p.name];
      if (last) cands.push([view.x + last[0] * view.s, view.y + last[1] * view.s]);
      cands.push([ax, ay]);
      for (const f of [0.6, -0.6, 1.2, -1.2]) cands.push([ax, ay + f * bh]);
      for (const f of [0.25, -0.25]) cands.push([ax + f * bw, ay]);
      // then anywhere on its own ground, nearest the anchor first (a crowd of knights round the anchor still leaves room)
      const grid = [];
      for (let i = 1; i < 8; i++) for (let j = 1; j < 8; j++) grid.push([view.x + (p.box[0] + (p.box[2] - p.box[0] + 1) * i / 8) * view.s, view.y + (p.box[1] + (p.box[3] - p.box[1] + 1) * j / 8) * view.s]);
      grid.sort((u, q) => Math.hypot(u[0] - ax, u[1] - ay) - Math.hypot(q[0] - ax, q[1] - ay));
      // (a spot found this way keeps 4 px more from the pane's edge, so a small pan never moves the name to another spot)
      for (const c of grid) cands.push([c[0], c[1], 4]);
      for (const [cx, cy, more] of cands) {
        // the box is laid on whole pixels first, and its own centre must be on the place's ground (a candidate on the very
        // edge of a narrow place could otherwise round onto the next place's tile: seen on the Great Spread's map)
        const b = { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h };
        const tx = (b.x + w / 2 - view.x) / view.s, ty = (b.y + h / 2 - view.y) / view.s;
        if (!p.owns(Math.floor(tx), Math.floor(ty))) continue;
        if (!inside(b) || hitsBox(b) || hitsDot(b, null)) continue;
        if (more && !(b.x >= INSET + more && b.y >= INSET + more && b.x + b.w <= view.w - INSET - more && b.y + b.h <= view.h - INSET - more)) continue;
        boxes.push(b); seen.add(p.name);
        out.labels.push({ name: p.name, x: b.x, y: b.y, w, h, cx: b.x + w / 2, cy: b.y + h / 2, tx, ty, font });
        break;
      }
    } };
    // 2. the big places first (a teacher finds her way by them), then the name tags: the selected or flagged knight first,
    // then the rest by name; right, left, above, below the dot. A tag with no room is left out (the dot stays, tap it).
    placeAll(order.filter(p => p.area >= MAJOR_AREA));
    const TAG_FONT = '700 14px sans-serif', TAG_H = 20;
    const singles = out.dots.slice().sort((a, b) => ((b.k.sel ? 2 : 0) + (b.k.flag ? 1 : 0)) - ((a.k.sel ? 2 : 0) + (a.k.flag ? 1 : 0)) || (String(a.k.n).toLowerCase() < String(b.k.n).toLowerCase() ? -1 : 1));
    for (const c of singles) {
      const w = Math.ceil(measure(c.k.n, TAG_FONT)) + 8, h = TAG_H, gap = PAD;
      const tries = [{ x: c.x + c.r + gap, y: c.y - h / 2 }, { x: c.x - c.r - gap - w, y: c.y - h / 2 }, { x: c.x - w / 2, y: c.y - c.r - gap - h }, { x: c.x - w / 2, y: c.y + c.r + gap }];
      for (const t of tries) { const b = { x: Math.round(t.x), y: Math.round(t.y), w, h }; if (inside(b) && !hitsBox(b) && !hitsDot(b, c)) { boxes.push(b); out.tags.push({ n: c.k.n, x: b.x, y: b.y, w, h }); break; } }
    }
    // 3. the other places, in the same order, wherever there is still room
    placeAll(order);
    // 4. the instance doors (kind 'door', anchor = the door tile): named only at twice the fit or more, under, over, right
    // or left of the mark, by the same rules (never over a name or a knight, inside the pane), after every place
    if (view.s >= view.fit * 2) {
      const DFONT = '600 13px sans-serif', DH = 18;
      for (const p of (places || []).filter(q => q && q.kind === 'door' && q.anchor)) {
        if (seen.has(p.name)) continue;
        const mx = view.x + (p.anchor[0] + 0.5) * view.s, my = view.y + (p.anchor[1] + 0.5) * view.s, w = Math.ceil(measure(p.name, DFONT)) + 6;
        for (const [cx, cy] of [[mx, my + 6 + DH / 2], [mx, my - 6 - DH / 2], [mx + 6 + w / 2, my], [mx - 6 - w / 2, my]]) {
          const b = { x: Math.round(cx - w / 2), y: Math.round(cy - DH / 2), w, h: DH };
          if (!inside(b) || hitsBox(b) || hitsDot(b, null)) continue;
          boxes.push(b); seen.add(p.name);
          out.labels.push({ name: p.name, x: b.x, y: b.y, w, h: DH, cx: b.x + w / 2, cy: b.y + DH / 2, tx: (cx - view.x) / view.s, ty: (cy - view.y) / view.s, font: 13, door: true });
          break;
        }
      }
    }
    return out;
  }
  // LABELS:END

  // ---------- the CSS (the palette above; html's font-size scales everything) ----------
  const CSS = `
html.tv-on{font-size:clamp(15px,calc(0.35vw + 11px),18px)}
html.tv-on,html.tv-on body{background:${PAL.bg}}
#tv{position:fixed;inset:0;display:flex;flex-direction:column;background:${PAL.bg};color:${PAL.text};font:1rem/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;z-index:40;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);-webkit-text-size-adjust:100%;overflow:hidden}
#tv *{box-sizing:border-box}
#tv[hidden],#tv [hidden]{display:none!important}
#tv button{min-height:44px;min-width:44px;padding:0 .85rem;font:inherit;font-size:1rem;color:${PAL.text};background:#262a33;border:1px solid #3a3f4b;border-radius:8px;cursor:pointer;touch-action:manipulation;-webkit-appearance:none;appearance:none}
#tv button:hover{background:#30353f}
#tv button:focus-visible{outline:2px solid ${PAL.name};outline-offset:1px}
#tv button.blue{background:#2f4a73;border-color:#4f78b3;color:#fff;font-weight:700}
#tv button.red{border-color:${PAL.red};color:#ffd9d9}
#tv button.redfill{background:#6b2a2a;border-color:${PAL.red};color:#fff}
#tv button.amber{border-color:${PAL.amber}}
#tv button.on{background:#34405a;border-color:${PAL.name}}
#tv button.chip{border-radius:22px;background:#23272f}
#tv .btns{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#tv .dim{color:${PAL.dim}}
#tv .small{font-size:.87rem}
#tv .warn{color:${PAL.red}}
#tv .lbl{font-weight:600}
#tv .pill{display:inline-block;background:${PAL.admin};color:#1b1604;font-weight:700;font-size:.87rem;line-height:1.3;padding:0 .45rem;border-radius:9px;margin-left:6px}
#tv .tag{display:inline-block;font-size:.87rem;line-height:1.4;padding:0 .45rem;border-radius:10px;border:1px solid ${PAL.amber};color:${PAL.amber};margin-left:6px}
#tv .tag.red{border-color:${PAL.red};color:${PAL.red}}
#tv-bar{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;min-height:48px;padding:2px 8px;border-bottom:1px solid ${PAL.line};background:#171a1f}
#tv-bar .title{font-weight:700;white-space:nowrap}
#tv-bar .mid{flex:1;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;justify-content:center;min-width:0}
#tv-bar .right{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;justify-content:flex-end;min-width:0}
#tv-bar button,#tv-bar span{white-space:nowrap;flex:none}
#tv-bar .me{min-width:0;flex:0 1 auto;overflow:hidden;text-overflow:ellipsis}
#tv.narrow #tv-bar{flex-wrap:nowrap;gap:8px}
#tv.narrow #tv-bar .mid{flex-wrap:nowrap;gap:8px 12px}
#tv.narrow #tv-bar .long,#tv.narrow #tv-flagged{display:none}
#tv.tight #tv-bar{flex-wrap:wrap}
#tv.tight #tv-bar .mid{order:3;flex-basis:100%;justify-content:flex-start;min-height:44px;flex-wrap:wrap}
#tv .live{color:${PAL.green};font-weight:700;white-space:nowrap}
#tv .live::before{content:"";display:inline-block;width:.6rem;height:.6rem;border-radius:50%;background:currentColor;margin-right:6px}
#tv .live.amber{color:${PAL.amber}}
#tv .live.red{color:${PAL.red}}
#tv .paused{color:${PAL.amber};font-weight:600}
#tv-flagged.zero{color:${PAL.dim}}
#tv-flagged.some{border-color:${PAL.red};color:#ffd9d9}
#tv-hint{color:${PAL.amber}}
#tv-banners{flex:none;display:flex;flex-direction:column}
#tv .banner{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:4px 12px;min-height:52px;background:#3a2c14;border-bottom:1px solid #6b5020;color:#ffe2b8}
#tv .banner.idle{background:#22324a;border-color:#35527a;color:#dbe8ff}
#tv-panes{flex:1 1 0;min-height:0;display:flex;flex-direction:row;position:relative}
#tv.narrow #tv-panes{flex-direction:column;overflow-y:auto;overscroll-behavior:contain}
#tv .pane{display:flex;flex-direction:column;min-width:0;min-height:0;background:${PAL.panel};overflow:hidden;position:relative}
#tv .pane>header{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;padding:4px 10px;min-height:52px;border-bottom:1px solid ${PAL.line}}
#tv .pane>header h2{font-size:1.05rem;margin:0;flex:1;min-width:7rem}
#tv .scroll{flex:1 1 0;min-height:0;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
#tv .foot{flex:none;border-top:1px solid ${PAL.line};padding:8px 10px;display:flex;flex-direction:column;gap:8px}
#tv-chat,#tv-who{flex:none}
#tv-mid{flex:1 1 0;min-width:${MID_MIN}px}
#tv.narrow #tv-chat,#tv.narrow #tv-who{flex:1 0 220px;width:auto!important}
#tv.narrow #tv-mid{flex:none;min-width:0}
#tv .div{flex:none;position:relative;background:${PAL.bg};touch-action:none;outline:none;z-index:2}
#tv .div.v{width:12px;cursor:col-resize}
#tv .div.h{height:12px;cursor:row-resize}
#tv.coarse .div.v{width:20px}
#tv.coarse .div.h{height:20px}
#tv .div .line{position:absolute;background:${PAL.line}}
#tv .div.v .line{left:50%;top:0;bottom:0;width:1px}
#tv .div.h .line{top:50%;left:0;right:0;height:1px}
#tv .div .grip{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:6px;height:44px;border-radius:3px;background:#3a3f4b}
#tv .div.h .grip{width:44px;height:6px}
#tv .div .grab{position:absolute;inset:0 -16px}
#tv.coarse .div .grab{inset:0 -12px}
#tv .div.h .grab{inset:-16px 0}
#tv.coarse .div.h .grab{inset:-12px 0}
#tv .div:hover .line,#tv .div.drag .line,#tv .div:focus-visible .line{background:#6fa8ff;width:2px}
#tv .div.h:hover .line,#tv .div.h.drag .line,#tv .div.h:focus-visible .line{height:2px;width:auto}
#tv .div:hover .grip,#tv .div.drag .grip,#tv .div:focus-visible .grip{background:#6fa8ff}
#tv-switch{flex:none;display:flex;gap:8px;padding:4px 8px;height:56px;border-bottom:1px solid ${PAL.line};background:${PAL.panel}}
#tv-switch button{flex:1;height:48px}
#tv .ln{position:relative;padding:.6rem .65rem .6rem .9rem;min-height:44px;border-left:4px solid transparent;overflow-wrap:anywhere}
#tv .ln .t{color:${PAL.dim};margin-right:8px;font-variant-numeric:tabular-nums}
#tv .ln .n{color:${PAL.name};font-weight:700}
#tv .ln .n.admin{color:${PAL.admin}}
#tv .ln.masked{border-left-color:${PAL.amber}}
#tv .ln .hid{display:inline-block;color:${PAL.amber};font-size:.87rem;margin-left:6px}
#tv .ln.ev{color:${PAL.dim}}
#tv-say{flex:none;display:flex;gap:8px;align-items:center;padding:8px 10px;border-top:1px solid ${PAL.line}}
#tv-say input{flex:1 1 0;min-width:0;min-height:44px;box-sizing:border-box;font:inherit;font-size:16px;padding:0 .7rem;color:${PAL.text};background:#101216;border:1px solid #3a3f4b;border-radius:8px;-webkit-appearance:none;appearance:none}
#tv-say input::placeholder{color:${PAL.dim}}
#tv-say input:focus{outline:2px solid ${PAL.name};outline-offset:1px}
#tv-say button{flex:none}
#tv .ln.ev.filter{border-left-color:${PAL.red}}
#tv .ln.div0{color:${PAL.dim};font-size:.87rem;text-align:center;padding:8px;border-left:0}
#tv .ln.tap{cursor:pointer}
#tv .ln.tap:hover{background:#20242b}
#tv .ln.sel{background:#24324a}
#tv .ln.sel .n{text-decoration:underline}
#tv-newlines{position:absolute;left:50%;transform:translateX(-50%);bottom:8px;z-index:3}
#tv .box{position:relative;flex:1 1 0;min-height:0;display:flex;flex-direction:column}
#tv-mapbox{position:relative;flex:1 1 0;min-height:0;background:#0d1a2b;touch-action:none;overflow:hidden}
#tv-map{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;cursor:grab}
#tv-zoom{position:absolute;right:8px;bottom:8px;display:flex;gap:8px;z-index:2}
#tv-zoom button{background:rgba(27,30,36,.94)}
#tv-keybox{position:absolute;left:8px;top:8px;z-index:2;display:flex;flex-direction:column;align-items:flex-start;gap:8px;max-width:calc(100% - 16px)}
#tv-keybox button{background:rgba(27,30,36,.94)}
#tv-key{background:rgba(20,22,26,.92);border:1px solid ${PAL.line};border-radius:8px;padding:6px 10px;font-size:.87rem}
#tv-pick{position:absolute;background:${PAL.panel};border:1px solid ${PAL.line};border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:8px;max-height:60%;overflow:auto;z-index:4;min-width:10rem}
#tv-empty{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);background:rgba(20,22,26,.88);padding:8px 14px;border-radius:8px;z-index:1}
#tv-inside{flex:none;border-top:1px solid ${PAL.line};padding:6px 10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;max-height:30%;overflow:auto}
#tv-watch{display:flex;flex-direction:column;flex:1 1 0;min-height:0}
#tv-povhead{flex:none;display:flex;flex-direction:column;border-bottom:1px solid ${PAL.line}}
#tv-povhead .row1{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:4px 8px;min-height:52px}
#tv-povhead .what{flex:1;min-width:8rem;font-weight:700}
#tv.narrow #tv-povhead .row1{gap:4px 8px;padding:4px 8px 2px}
#tv.narrow #tv-povhead .what{order:9;flex-basis:100%;font-size:.93rem}
#tv.narrow #tv-povhead .only{display:none}
#tv-povhead .row2{padding:0 10px 6px;display:flex;flex-direction:column;gap:2px}
#tv-povhead .state{color:${PAL.amber}}
#tv-watchbox{position:relative;flex:1 1 0;min-height:0;background:#0b0f14;overflow:hidden}
#tv-glass{position:absolute;inset:0;z-index:2;touch-action:none;cursor:pointer}
#tv-card0{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:min(30rem,calc(100% - 24px));background:rgba(20,22,26,.94);border:1px solid ${PAL.line};border-radius:10px;padding:14px 16px;z-index:3;line-height:1.45}
#tv-strip{flex:none;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:6px 8px;border-top:1px solid ${PAL.line}}
#tv .row{display:flex;align-items:center;gap:8px;padding:6px 10px;min-height:56px;border-bottom:1px solid #23262d;cursor:pointer}
#tv .row:hover{background:#20242b}
#tv .row.sel{background:#26303f}
#tv .row .txt{flex:1;min-width:0}
#tv .row .nm{font-weight:700;color:${PAL.name}}
#tv .row .nm.admin{color:${PAL.admin}}
#tv .row .l2{color:${PAL.dim};font-size:.93rem}
#tv-card{flex:none;max-height:50%;overflow:auto;overscroll-behavior:contain;border-bottom:2px solid #4f78b3;background:#20252d;padding:8px 10px 10px;display:flex;flex-direction:column;gap:8px}
#tv-card .head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#tv-card .who{font-weight:700;font-size:1.1rem;color:${PAL.name};flex:1;min-width:6rem}
#tv-card .who.admin{color:${PAL.admin}}
#tv .fold{width:100%;text-align:left;border-radius:0;border-left:0;border-right:0;background:#1f232a;font-weight:600}
#tv .act{padding:8px 10px;border-bottom:1px solid #23262d;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
#tv .act .txt{flex:1;min-width:10rem}
#tv-toast{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 10px;border-top:1px solid ${PAL.line};background:#22324a;min-height:56px;z-index:4}
#tv-toast.bad{background:#4a2222}
#tv-sheet{flex:1 0 220px;min-height:0;background:${PAL.panel};border-top:2px solid #4f78b3;overflow:auto;overscroll-behavior:contain}
#tv-sheet #tv-card{max-height:none;border-bottom:0;background:${PAL.panel}}
#tv-pausemenu{position:absolute;z-index:8;background:${PAL.panel};border:1px solid ${PAL.line};border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:8px;min-width:14rem}
`;

  // ---------- the screen ----------
  // env: { win, doc, fetch, WebSocket, now, setTimeout, clearTimeout, setInterval, clearInterval, ls, ss, beacon(url, body),
  //        replace(url), raf(fn), RO (ResizeObserver or null), coarse, view (79-view or a stand-in), canvas (the game's) }
  function make(env) {
    const W = env.win, D = env.doc;
    const now = () => env.now();
    // the session token: in this closure only (never on S, which a page script could reach through a handle; never stored)
    let token = null;
    const S = {
      me: null, expires: 0, notice: true, startedAt: 0,
      knights: [], inside: [], gone: [], acts: [], sentOff: [], chatPause: null, frameAt: 0, lastArrive: 0,
      lines: [], hidden: {}, flags: {}, flagLines: [], selected: null, filter: 'all', follow: true, newLines: 0,
      ws: null, status: 'off', tries: 0, timer: null, bye: null, wantOnVisible: false, gaveUp: false, connecting: false,
      lastInput: now(), confirm: null, toast: null, req: 0, pending: {}, tab: 'chat', unread: 0,
      foldGone: true, foldDone: false, pick: null, pauseMenu: false, keyOpen: false, mapView: null,
      layout: readLayout(env.ls), narrow: false, sizes: null, folded: false,
      watch: null, watchWant: null, hiddenSince: 0, hiddenView: null, ended: false,
      labels: null, labelPrev: {}, labelAt: 0, dragging: false, sent: [],
    };
    const ui = {};

    // ---------- DOM helpers (textContent only) ----------
    function el(tag, cls, text) { const e = D.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = String(text); return e; }
    function btn(text, fn, cls) { const b = el('button', cls || '', text); b.type = 'button'; b.addEventListener('click', ev => { if (ev && ev.stopPropagation) ev.stopPropagation(); fn(ev); }); return b; }
    function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }
    const hm = ms => { const d = new Date(ms); return (d.getHours() % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0'); };
    const clock = ms => { const d = new Date(ms); return hm(ms) + ' ' + (d.getHours() < 12 ? 'am' : 'pm'); };
    const mins = ms => Math.max(1, Math.ceil(ms / 60000));
    const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    const dayEndLocal = t => { const d = new Date(t); d.setHours(23, 59, 59, 999); return d.getTime(); };
    const lc = s => String(s || '').toLowerCase();
    const rect = e => (e && e.getBoundingClientRect) ? e.getBoundingClientRect() : { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 };
    const winW = () => W.innerWidth || 1280, winH = () => W.innerHeight || 800;

    // ---------- build ----------
    function build() {
      if (!D.getElementById || !D.getElementById('tv-css')) { const st = el('style'); st.id = 'tv-css'; st.textContent = CSS; (D.head || D.body).appendChild(st); }
      const root = el('div'); root.id = 'tv'; ui.root = root;
      if (env.coarse) root.className = 'coarse';
      // the bar
      const bar = el('header'); bar.id = 'tv-bar';
      const mid = el('div', 'mid'), right = el('div', 'right');
      ui.live = el('span', 'live', 'Reconnecting…');
      ui.retry = btn('Try again', () => { S.tries = 0; S.gaveUp = false; connect(); }); ui.retry.hidden = true;
      ui.count = el('span', '', '0 on'); ui.chatState = el('span', '', 'Chat is on');
      ui.pauseBtn = btn('Pause chat', () => { S.pauseMenu = !S.pauseMenu; renderPauseMenu(); }); ui.pauseBtn.id = 'tv-pausebtn';
      ui.flagged = btn('0 to look at', () => { S.filter = 'flagged'; S.tab = 'chat'; renderChat(); renderTabs(); scrollChatEnd(); }); ui.flagged.id = 'tv-flagged';
      mid.append(ui.live, ui.retry, ui.count, ui.chatState, ui.pauseBtn, ui.flagged);
      ui.meLine = el('span', 'dim me', ''); ui.meName = el('span', '', ''); ui.meUntil = el('span', 'long', ''); ui.meLine.append(ui.meName, ui.meUntil);
      ui.signout = btn('Sign out', () => signOut()); ui.signout.id = 'tv-signout';
      right.append(ui.meLine, ui.signout);
      const title0 = el('div', 'title'); title0.append(el('span', 'long', 'Fanglands — '), el('span', '', 'Teacher view'));
      bar.append(title0, mid, right);
      root.appendChild(bar);
      ui.pauseMenu = el('div'); ui.pauseMenu.id = 'tv-pausemenu'; ui.pauseMenu.hidden = true; root.appendChild(ui.pauseMenu);
      ui.banners = el('div'); ui.banners.id = 'tv-banners'; root.appendChild(ui.banners);
      const panes = el('main'); panes.id = 'tv-panes'; ui.panes = panes;
      // chat
      const chat = el('section', 'pane'); chat.id = 'tv-chat'; ui.chat = chat;
      const ch = el('header'); const h2 = el('h2', '', 'Chat'); h2.appendChild(el('span', 'dim small', ' · the last hour'));
      ui.fAll = btn('All lines', () => { S.filter = 'all'; renderChat(); scrollChatEnd(); });
      ui.fFlag = btn('Only flagged', () => { S.filter = 'flagged'; renderChat(); scrollChatEnd(); });
      const fb = el('div', 'btns'); fb.append(ui.fAll, ui.fFlag); ch.append(h2, fb);
      const box = el('div', 'box');
      ui.chatScroll = el('div', 'scroll'); ui.chatList = el('div'); ui.chatScroll.appendChild(ui.chatList);
      ui.chatScroll.addEventListener('scroll', () => { const s = ui.chatScroll; const atEnd = s.scrollTop + s.clientHeight >= s.scrollHeight - 24; if (atEnd !== S.follow) { S.follow = atEnd; if (atEnd) { S.newLines = 0; renderNewLines(); } } });
      ui.newLines = btn('0 new lines', () => { S.follow = true; S.newLines = 0; scrollChatEnd(); renderNewLines(); }, 'blue'); ui.newLines.id = 'tv-newlines'; ui.newLines.hidden = true;
      box.append(ui.chatScroll, ui.newLines);
      // the teacher's own line in the game chat (owner, 7 Oct): under her own name, in the admins' gold, to everyone; always
      // shown under the chat (wide or narrow, folded or not). Enter or Send; the text waits in the box if the world says no.
      ui.say = el('div'); ui.say.id = 'tv-say';
      ui.sayInput = el('input'); ui.sayInput.type = 'text'; ui.sayInput.maxLength = SAY_MAX; ui.sayInput.autocomplete = 'off';
      ui.sayInput.setAttribute('autocapitalize', 'sentences'); ui.sayInput.setAttribute('enterkeyhint', 'send'); ui.sayInput.setAttribute('aria-label', 'Say something in the game chat');
      ui.sayInput.placeholder = sayHint();
      ui.sayInput.addEventListener('keydown', sayKey);
      ui.sayBtn = btn('Send', () => sayLine(), 'blue');
      ui.say.append(ui.sayInput, ui.sayBtn);
      ui.chatFoot = el('div', 'foot'); ui.chatFoot.id = 'tv-chatfoot';
      chat.append(ch, box, ui.say, ui.chatFoot);
      // the middle: the map, or the kid being watched
      const midp = el('section', 'pane'); midp.id = 'tv-mid'; ui.mid = midp;
      ui.mapPane = el('div', 'box'); ui.mapPane.id = 'tv-mappane';
      const mh = el('header'); mh.style.cssText = 'flex:none;display:flex;align-items:center;gap:8px;padding:4px 10px;min-height:52px;border-bottom:1px solid ' + PAL.line; ui.mapHead = el('h2', '', 'World map'); ui.mapHead.style.cssText = 'font-size:1.05rem;margin:0;flex:1;min-width:7rem'; mh.appendChild(ui.mapHead);
      ui.mapBox = el('div'); ui.mapBox.id = 'tv-mapbox';
      ui.canvas = el('canvas'); ui.canvas.id = 'tv-map'; ui.canvas.setAttribute('aria-label', 'The world map with a dot for every knight');
      const zoom = el('div'); zoom.id = 'tv-zoom'; ui.zoom = zoom;
      zoom.append(btn('+', () => zoomBy(1.4)), btn('−', () => zoomBy(1 / 1.4)), btn('Whole map', () => { S.mapView = null; relabel(true); drawMap(); }));
      ui.keyBox = el('div'); ui.keyBox.id = 'tv-keybox';
      ui.key = el('div', '', 'Blue: playing. Grey: away. Amber ring: chat off. Gold ring: admin. Red ring: the word filter, the last 10 minutes.'); ui.key.id = 'tv-key'; ui.key.hidden = true;
      ui.keyBtn = btn('Key', () => { S.keyOpen = !S.keyOpen; ui.key.hidden = !S.keyOpen; ui.keyBtn.className = S.keyOpen ? 'on' : ''; relabel(true); drawMap(); });
      ui.keyBox.append(ui.keyBtn, ui.key);
      ui.pick = el('div'); ui.pick.id = 'tv-pick'; ui.pick.hidden = true;
      ui.empty = el('div', 'dim', 'Nobody is on right now.'); ui.empty.id = 'tv-empty';
      ui.mapBox.append(ui.canvas, ui.keyBox, zoom, ui.pick, ui.empty);
      ui.inside = el('div'); ui.inside.id = 'tv-inside';
      ui.mapPane.append(mh, ui.mapBox, ui.inside);
      ui.watchPane = el('div'); ui.watchPane.id = 'tv-watch'; ui.watchPane.hidden = true;
      ui.povHead = el('div'); ui.povHead.id = 'tv-povhead';
      const r1 = el('div', 'row1'), r2 = el('div', 'row2');
      ui.back = btn('Back to the map', () => back(), 'blue');
      ui.what = el('div', 'what'); ui.whatText = el('span', '', ''); ui.whatLive = el('span', 'live', 'Live'); ui.whatLive.style.marginLeft = '8px'; ui.what.append(ui.whatText, ui.whatLive);
      ui.closer = btn('Closer', () => zoomView(ZOOM_STEP)); ui.wider = btn('Wider', () => zoomView(1 / ZOOM_STEP)); ui.fit = btn('Fit', () => zoomView(0));
      r1.append(ui.back, ui.what, ui.closer, ui.wider, ui.fit);
      ui.only = el('div', 'dim small only', ''); ui.state = el('div', 'state small', ''); ui.state2 = el('div', 'dim small', '');
      r2.append(ui.only, ui.state, ui.state2);
      ui.povHead.append(r1, r2);
      ui.watchBox = el('div'); ui.watchBox.id = 'tv-watchbox';
      ui.glass = el('div'); ui.glass.id = 'tv-glass'; ui.glass.setAttribute('aria-label', "The kid's screen: tap a knight to pick him");
      ui.card0 = el('div'); ui.card0.id = 'tv-card0'; ui.card0.hidden = true;
      ui.watchBox.append(ui.glass, ui.card0);
      ui.strip = el('div'); ui.strip.id = 'tv-strip'; ui.strip.hidden = true;
      ui.watchPane.append(ui.povHead, ui.watchBox, ui.strip);
      midp.append(ui.mapPane, ui.watchPane);
      // who is on
      const who = el('section', 'pane'); who.id = 'tv-who'; ui.who = who;
      const wh = el('header'); ui.whoHead = el('h2', '', 'Who is on (0)'); wh.appendChild(ui.whoHead);
      ui.card = el('div'); ui.card.id = 'tv-card'; ui.card.hidden = true;
      ui.whoScroll = el('div', 'scroll'); ui.whoList = el('div'); ui.whoScroll.appendChild(ui.whoList);
      ui.toast = el('div'); ui.toast.id = 'tv-toast'; ui.toast.hidden = true;
      who.append(wh, ui.card, ui.whoScroll, ui.toast);
      // dividers, the narrow switch, the sheet
      ui.div1 = divider('v', 'Resize the chat'); ui.div2 = divider('v', 'Resize the list'); ui.hdiv = divider('h', 'Resize the map');
      ui.switch = el('nav'); ui.switch.id = 'tv-switch';
      ui.tChat = btn('Chat', () => { S.tab = 'chat'; S.unread = 0; renderTabs(); scrollChatEnd(); }); ui.tWho = btn('Who is on (0)', () => { S.tab = 'who'; renderTabs(); });
      ui.switch.append(ui.tChat, ui.tWho);
      ui.sheet = el('div'); ui.sheet.id = 'tv-sheet'; ui.sheet.hidden = true;
      panes.append(chat, ui.div1, midp, ui.div2, who, ui.hdiv, ui.switch, ui.sheet);
      root.appendChild(panes);
      D.body.appendChild(root);
      mapInput(); glassInput();
      // a key the game would hear is stopped at the screen (05-input listens on window and would take arrows, space and Tab)
      for (const t of ['keydown', 'keyup', 'keypress']) root.addEventListener(t, ev => { if (ev.stopPropagation) ev.stopPropagation(); });
      if (env.RO) {
        try {
          const ro = new env.RO(() => layout());
          ro.observe(root); ro.observe(ui.chat); ro.observe(ui.mapBox); ro.observe(ui.watchBox);
          ui.ro = ro;
        } catch (e) { ui.ro = null; }
      }
    }

    // ---------- the layout: wide (three panes, two dividers) or narrow (the map, a divider, one list) ----------
    function layout() {
      if (!ui.root) return;
      const w = winW(), sizes = wideSizes(w, S.layout.wide, env.coarse);
      S.narrow = !sizes; S.sizes = sizes;
      ui.root.className = (env.coarse ? 'coarse' : '') + (S.narrow ? ' narrow' : '') + (w < TIGHT ? ' tight' : '');
      if (sizes) {
        ui.chat.style.width = sizes.chat + 'px'; ui.who.style.width = sizes.who + 'px'; ui.mid.style.height = '';
        ui.chat.hidden = false; ui.who.hidden = false; ui.div1.hidden = false; ui.div2.hidden = false; ui.hdiv.hidden = true; ui.switch.hidden = true; ui.sheet.hidden = true;
        ui.mid.style.order = ''; ui.chat.style.order = ''; ui.who.style.order = '';
      } else {
        const ph = rect(ui.panes).height || (winH() - 120);
        ui.mid.style.height = (S.watch ? narrowSplit(ph, S.layout.narrow.wsplit, WSPLIT_MAX, WSPLIT_DEF) : narrowSplit(ph, S.layout.narrow.split)) + 'px';
        ui.mid.style.order = '1'; ui.hdiv.style.order = '2'; ui.switch.style.order = '3'; ui.chat.style.order = '4'; ui.who.style.order = '4'; ui.sheet.style.order = '5';
        ui.chat.style.width = ''; ui.who.style.width = '';
        ui.div1.hidden = true; ui.div2.hidden = true; ui.hdiv.hidden = false;
      }
      renderCard(); renderTabs(); renderToast(); renderChatFoot(); renderBar();
      sizeMap(); sizeWatch();
    }
    // ---------- the dividers ----------
    function divider(dir, label) {
      const d = el('div', 'div ' + dir); d.setAttribute('role', 'separator'); d.setAttribute('aria-orientation', dir === 'v' ? 'vertical' : 'horizontal'); d.setAttribute('aria-label', label); d.tabIndex = 0;
      d.append(el('div', 'line'), el('div', 'grip'), el('div', 'grab'));
      let drag = null;
      d.addEventListener('pointerdown', ev => { drag = { id: ev.pointerId }; try { d.setPointerCapture(ev.pointerId); } catch (e) { } d.classList.add('drag'); S.dragging = true; if (ev.preventDefault) ev.preventDefault(); });
      d.addEventListener('pointermove', ev => { if (!drag) return; moveDivider(d, ev.clientX, ev.clientY); });
      const up = () => { if (!drag) return; drag = null; d.classList.remove('drag'); S.dragging = false; saveSoon(); relabel(true); };
      d.addEventListener('pointerup', up); d.addEventListener('pointercancel', up); d.addEventListener('lostpointercapture', up);
      d.addEventListener('keydown', ev => {
        const k = ev.key; let step = 0;
        if (k === 'ArrowLeft' || k === 'ArrowUp') step = -KEY_STEP; else if (k === 'ArrowRight' || k === 'ArrowDown') step = KEY_STEP;
        else if (k === 'Home') step = -1e6; else if (k === 'End') step = 1e6; else return;
        if (ev.preventDefault) ev.preventDefault();
        nudgeDivider(d, step); saveSoon();
      });
      d.addEventListener('dblclick', () => resetDivider(d));
      return d;
    }
    function bounds() {
      const w = winW(), d = divW(env.coarse), s = S.sizes || wideSizes(w, S.layout.wide, env.coarse);
      return { w, d, s };
    }
    // the chat's width (div1) or the list's (div2), clamped so every pane keeps its minimum; the map's height (hdiv)
    function setChat(px) { const { w, d, s } = bounds(); if (!s) return; const max = Math.min(Math.floor(SIDE_MAX * w), w - s.who - 2 * d - MID_MIN); S.layout.wide.l = cl(Math.round(px), CHAT_MIN, Math.max(CHAT_MIN, max)) / w; layout(); }
    function setWho(px) { const { w, d, s } = bounds(); if (!s) return; const max = Math.min(Math.floor(SIDE_MAX * w), w - s.chat - 2 * d - MID_MIN); S.layout.wide.r = cl(Math.round(px), WHO_MIN, Math.max(WHO_MIN, max)) / w; layout(); }
    function setSplit(px) {
      const ph = rect(ui.panes).height || (winH() - 120), max = S.watch ? WSPLIT_MAX : SPLIT_MAX, lo = Math.min(SPLIT_MIN, ph * max), f = cl(px, lo, ph * max) / Math.max(1, ph);
      if (S.watch) S.layout.narrow.wsplit = f; else S.layout.narrow.split = f;
      layout();
    }
    function moveDivider(d, x, y) {
      const pr = rect(ui.panes), dd = divW(env.coarse);
      if (d === ui.div1) setChat(x - pr.left - dd / 2);
      else if (d === ui.div2) setWho(pr.right - x - dd / 2);
      else setSplit(y - pr.top - dd / 2);
    }
    function nudgeDivider(d, step) {
      const s = S.sizes;
      if (d === ui.div1 && s) setChat(s.chat + step);
      else if (d === ui.div2 && s) setWho(s.who - step);
      else if (d === ui.hdiv) setSplit((parseFloat(ui.mid.style.height) || 300) + step);
    }
    function resetDivider(d) {
      if (d === ui.div1) S.layout.wide.l = CHAT_DEF; else if (d === ui.div2) S.layout.wide.r = WHO_DEF; else if (S.watch) S.layout.narrow.wsplit = WSPLIT_DEF; else S.layout.narrow.split = SPLIT_DEF;
      layout(); saveSoon();
    }
    let saveTimer = null;
    function saveSoon() { if (saveTimer) env.clearTimeout(saveTimer); saveTimer = env.setTimeout(() => { saveTimer = null; writeLayout(env.ls, S.layout); }, 300); }

    // ---------- calls and the socket ----------
    // a call's answer may come at once (the self-test's stand-ins) or as a promise (a browser): the flow runs on callbacks
    const when = (v, ok, bad) => { if (v && typeof v.then === 'function') { v.then(ok, bad); return; } ok(v); };
    function ticket(cb) {
      let p; try { p = env.fetch('/api/teacher/ticket', { method: 'POST', headers: { authorization: 'Bearer ' + token }, credentials: 'omit', cache: 'no-store' }); } catch (e) { return cb({ net: true }); }
      when(p, r => {
        if (!r) return cb({ net: true });
        if (r.status === 401) return cb({ dead: true });
        let j; try { j = r.json(); } catch (e) { return cb({ net: true }); }
        when(j, data => cb(r.ok && data && typeof data.ticket === 'string' ? { ticket: data.ticket } : { net: true }), () => cb({ net: true }));
      }, () => cb({ net: true }));
    }
    function wsUrl(t) { const l = W.location || { protocol: 'https:', host: '' }; return (l.protocol === 'https:' ? 'wss://' : 'ws://') + l.host + '/api/teacher/ws?ticket=' + encodeURIComponent(t); }
    function connect() {
      if (!token || S.bye || S.ended || S.connecting) return;
      if (D.hidden) { S.wantOnVisible = true; return; }
      if (S.timer) { env.clearTimeout(S.timer); S.timer = null; }
      if (S.ws) return;
      setStatus('connecting');
      S.connecting = true;
      ticket(t => {
        S.connecting = false;
        if (S.ended || S.ws) return;
        if (t.dead) return ended(4011);
        if (!t.ticket) return retryLater();
        let ws;
        try { ws = new env.WebSocket(wsUrl(t.ticket)); } catch (e) { return retryLater(); }
        S.ws = ws;
        ws.onopen = () => { S.tries = 0; setStatus('live'); };
        ws.onmessage = ev => { let m = null; try { m = JSON.parse(ev.data); } catch (e) { return; } onMessage(m); };
        ws.onclose = ev => {
          if (S.ws === ws) S.ws = null;
          const code = (ev && ev.code) || 1006;
          if (S.bye || NO_RECONNECT.includes(code)) return ended(S.bye || code);
          if (!token || S.ended) return;
          if (S.watch) { S.hiddenView = S.watch.n; stopWatch(); }
          retryLater();
        };
        ws.onerror = () => { };
      });
    }
    function retryLater() {
      S.ws = null; S.tries++;
      if (S.tries >= TRIES_MAX) { S.gaveUp = true; setStatus('off'); return; }
      setStatus('connecting');
      const secs = Math.min(BACKOFF_MAX, Math.pow(2, S.tries - 1));
      S.timer = env.setTimeout(() => { S.timer = null; connect(); }, secs * 1000);
    }
    // the screen is over (the world closed it, the session ran out, signed out, idle): back to the card with why
    function ended(code) {
      if (S.ended) return;
      S.ended = true;
      if (S.timer) { env.clearTimeout(S.timer); S.timer = null; }
      if (S.watch) stopWatch(false);
      const ws = S.ws; S.ws = null; if (ws) { try { ws.onclose = null; ws.close(1000); } catch (e) { } }
      token = null; S.status = 'off';
      try { if (env.ss) env.ss.setItem(BYE_KEY, String(BYE[code] ? code : 4011)); } catch (e) { }
      env.replace('/');
    }
    function setStatus(s) { S.status = s; renderBar(); }
    function send(obj) {
      if (!S.ws || S.ws.readyState !== 1) { say('Not connected. The line will come back by itself.', true); return null; }
      const req = ++S.req; obj.req = req;
      try { S.ws.send(JSON.stringify(obj)); } catch (e) { return null; }
      S.pending[req] = obj; S.sent.push(obj.t);
      return req;
    }
    // Sign out: the session ends at once (the beacon), the reason waits for the card, the page starts again on the card
    function signOut(code) {
      if (S.ended) return;
      logoutBeacon();
      ended(code || 4010);
    }
    function logoutBeacon() { if (!token) return; try { env.beacon('/api/teacher/logout', JSON.stringify({ token })); } catch (e) { } }

    // ---------- what the world says ----------
    function onMessage(m) {
      if (!m || typeof m.t !== 'string') return;
      S.lastArrive = now();
      switch (m.t) {
        case 'w_hello': S.me = String(m.me || ''); if (ui.sayInput) ui.sayInput.placeholder = sayHint(); S.expires = +m.expires || 0; S.notice = m.notice !== false; setStatus('live'); if (S.hiddenView && !D.hidden) { const n = S.hiddenView; S.hiddenView = null; watch(n); } break;
        case 'w_all': {
          S.lines = [];
          const backlog = Array.isArray(m.chat) ? m.chat : [];
          if (backlog.length) S.lines.push({ kind: 'div', text: 'Earlier, before you opened this' });
          for (const c of backlog) S.lines.push(lineOf(c));
          takeKnights(m); takeActs(m);
          renderChat(); scrollChatEnd(); renderAll();
          break;
        }
        case 'w_k': takeKnights(m); renderWho(); relabel(false); drawMap(); renderMapHead(); renderInside(); renderCard(); renderBar(); renderPov(); break;
        case 'w_chat': addLine(lineOf(m)); break;
        case 'w_event': {
          if ((m.kind === 'strike' || m.kind === 'words') && m.n) { S.flags[lc(m.n)] = now(); S.flagLines.push(now()); }
          addLine({ kind: 'ev', at: m.at || now(), text: String(m.text || ''), filter: m.kind === 'strike' || m.kind === 'words', n: m.n || null });
          if (m.kind === 'strike' || m.kind === 'words') drawMap();
          break;
        }
        case 'w_acts': takeActs(m); renderWho(); renderCard(); renderChatFoot(); renderBanners(); renderBar(); break;
        case 'w_ok': {
          const asked = S.pending[m.req]; delete S.pending[m.req];
          if (!m.text) break;
          const mine = S.acts[0] && S.acts[0].teacher === S.me && !S.acts[0].undoneAt ? S.acts[0] : null;
          if (asked && (asked.t === 'w_mute' || asked.t === 'w_off') && mine) toast(m.text, mine.id); else say(m.text);
          break;
        }
        case 'w_no': {
          const asked = S.pending[m.req]; delete S.pending[m.req];
          if (asked && asked.t === 'w_view' && S.watchWant === asked.n) S.watchWant = null;
          // a line the world did not take (too fast, nothing in it): back in the box to send again
          if (asked && asked.t === 'w_say' && ui.sayInput && !ui.sayInput.value) ui.sayInput.value = asked.text;
          say(m.text || 'That did not go through.', true);
          break;
        }
        case 'w_vstart': startWatch(m); break;
        case 'w_v': if (S.watch && m.v === S.watch.v && m.m && typeof m.m.t === 'string') onView(m.m); break;
        case 'w_vend': if (S.watch && m.v === S.watch.v) { S.watch.ended = String(m.text || ''); env.view.freeze(); renderPov(); } break;
        case 'w_vinfo': if (S.watch && m.v === S.watch.v) { S.watch.limit = m.limit || null; renderPov(); } break;
        // the world is done with this screen: back to the card at once (the close that follows is not waited for)
        case 'w_bye': S.bye = m.code; ended(m.code); break;
        default: break;
      }
    }
    const lineOf = c => ({ kind: 'line', at: +c.at || now(), n: String(c.n || '?'), text: String(c.text || ''), role: c.role === 'admin' || c.teacher === true ? 'admin' : 'player', masked: !!c.masked, teacher: c.teacher === true });
    // ---------- the teacher's own line ----------
    // Enter in the box sends. Heard on the window in the capture phase too (start()): the card's own guard (71-login) stops
    // every key typed in a text box there, so the box itself never hears it on the real page; each press is taken once
    function sayKey(ev) {
      if (!ev || ev.key !== 'Enter' || ev._said || !ui.sayInput || ev.target !== ui.sayInput) return;
      ev._said = true; if (ev.preventDefault) ev.preventDefault();
      sayLine();
    }
    function sayHint() { return S.me ? 'Say to all, as ' + S.me : 'Say to all'; }
    function sayLine() {
      if (!ui.sayInput) return;
      const text = String(ui.sayInput.value || '').replace(/\s+/g, ' ').trim().slice(0, SAY_MAX);
      if (!text) { ui.sayInput.value = ''; return; }
      if (send({ t: 'w_say', text })) ui.sayInput.value = '';
    }
    function takeKnights(m) { S.knights = Array.isArray(m.knights) ? m.knights : []; S.inside = Array.isArray(m.inside) ? m.inside : []; S.gone = Array.isArray(m.gone) ? m.gone : []; S.frameAt = now(); }
    function takeActs(m) {
      if (Array.isArray(m.acts)) S.acts = m.acts;
      if (Array.isArray(m.sentOff)) S.sentOff = m.sentOff;
      S.chatPause = m.chatPause && m.chatPause.until ? { until: +m.chatPause.until, by: String(m.chatPause.by || ''), act: m.chatPause.act } : null;
    }
    function addLine(l) {
      const cut = now() - CHAT_KEEP_MS;
      while (S.lines.length > 600 || (S.lines.length && S.lines[0].kind !== 'div' && S.lines[0].at < cut)) S.lines.shift();
      S.lines.push(l);
      if (l.kind === 'line' && l.masked) { S.hidden[lc(l.n)] = (S.hidden[lc(l.n)] || 0) + 1; S.flagLines.push(now()); }
      if (S.filter === 'flagged' && !flaggedLine(l)) { renderBar(); return; }
      ui.chatList.appendChild(lineEl(l));
      if (S.tab !== 'chat' && S.narrow) { S.unread++; renderTabs(); }
      if (S.follow) scrollChatEnd(); else { S.newLines++; renderNewLines(); }
      renderBar();
      if (l.kind === 'line' && l.masked) renderWho();
    }

    // ---------- the bar and the banners ----------
    function flaggedCount() { const cut = now() - FLAG_MS; S.flagLines = S.flagLines.filter(t => t > cut); return S.flagLines.length; }
    function pauseNow() { return S.chatPause && S.chatPause.until > now() ? S.chatPause : null; }
    function renderBar() {
      if (!ui.live) return;
      const st = S.status, gave = S.gaveUp;
      ui.live.textContent = st === 'live' ? 'Live' : gave ? 'Not connected' : 'Reconnecting…';
      ui.live.className = 'live' + (st === 'live' ? '' : gave ? ' red' : ' amber');
      ui.retry.hidden = !gave;
      ui.count.textContent = S.knights.length + ' on';
      const p = pauseNow();
      ui.chatState.textContent = p ? (S.narrow ? 'Paused · ' + mmss(p.until - now()) : 'Chat paused · ' + mmss(p.until - now()) + ' left') : S.narrow ? 'Chat on' : 'Chat is on';
      ui.chatState.className = p ? 'paused' : '';
      // pausing lives in the bar's menu when the chat's own controls are folded away (narrow, or a short chat pane)
      ui.pauseBtn.hidden = !(S.narrow || S.folded);
      ui.pauseBtn.textContent = p ? 'Turn chat back on' : 'Pause chat';
      const n = flaggedCount();
      ui.flagged.textContent = n + ' to look at'; ui.flagged.className = n ? 'some' : 'zero';
      ui.meName.textContent = S.me || ''; ui.meUntil.textContent = S.expires ? ' · signed in until ' + clock(S.expires) : '';
      ui.meLine.title = (S.me || '') + (S.expires ? ' · signed in until ' + clock(S.expires) : '');
    }
    function renderPauseMenu() {
      const m = ui.pauseMenu; clear(m);
      if (!S.pauseMenu) { m.hidden = true; return; }
      const p = pauseNow();
      if (p) { S.pauseMenu = false; m.hidden = true; chatOn(); return; }
      m.hidden = false;
      m.appendChild(el('div', 'lbl', 'Pause chat for everyone:'));
      for (const [span, label] of [['5m', '5 minutes'], ['15m', '15 minutes'], ['1h', '1 hour']]) m.appendChild(btn(label, () => { S.pauseMenu = false; m.hidden = true; send({ t: 'w_pause', span }); }));
      m.appendChild(btn('Cancel', () => { S.pauseMenu = false; m.hidden = true; }));
      m.appendChild(el('div', 'dim small', 'Admins and teachers can still talk while chat is paused.'));
      // narrow: the flagged lines live here (the bar has no room for them)
      if (S.narrow) { const n = flaggedCount(); m.appendChild(btn(n + ' to look at', () => { S.pauseMenu = false; m.hidden = true; S.filter = 'flagged'; S.tab = 'chat'; S.unread = 0; renderChat(); renderTabs(); scrollChatEnd(); })); }
      const r = rect(ui.pauseBtn), rr = rect(ui.root);
      if (r.height) { m.style.top = Math.round(r.bottom - rr.top + 4) + 'px'; m.style.left = Math.round(Math.max(8, Math.min(r.left - rr.left, winW() - 240))) + 'px'; }
      else { m.style.top = '96px'; m.style.left = '8px'; }
    }
    function chatOn() { send({ t: 'w_chaton' }); }
    function renderBanners() {
      if (!ui.banners) return;
      clear(ui.banners);
      const p = pauseNow();
      if (p) { const b = el('div', 'banner'); b.append(el('span', '', 'Chat is paused for everyone until ' + clock(p.until) + ' (' + (p.by || 'a teacher') + ' paused it).'), btn('Turn chat back on', chatOn, 'amber')); ui.banners.appendChild(b); }
      const idle = now() - S.lastInput;
      if (idle >= IDLE_MS) { const b = el('div', 'banner idle'); b.appendChild(el('span', '', 'Still watching? Tap anywhere to stay signed in. Signing out in ' + mmss(IDLE_MS + IDLE_WARN_MS - idle) + '.')); ui.banners.appendChild(b); }
    }
    function renderTabs() {
      if (!ui.tChat) return;
      const sheetUp = S.narrow && !!selectedKnight();
      ui.switch.hidden = !S.narrow || sheetUp;
      ui.sheet.hidden = !sheetUp;
      if (S.narrow) { ui.chat.hidden = sheetUp || S.tab !== 'chat'; ui.who.hidden = sheetUp || S.tab !== 'who'; }
      ui.tChat.textContent = 'Chat' + (S.unread ? ' (' + S.unread + ' new)' : '');
      ui.tWho.textContent = 'Who is on (' + S.knights.length + ')';
      ui.tChat.className = S.tab === 'chat' ? 'on' : ''; ui.tWho.className = S.tab === 'who' ? 'on' : '';
    }

    // ---------- the chat ----------
    const flaggedLine = l => (l.kind === 'line' && l.masked) || (l.kind === 'ev' && l.filter);
    function lineEl(l) {
      if (l.kind === 'div') return el('div', 'ln div0', l.text);
      const d = el('div', 'ln' + (l.kind === 'ev' ? ' ev' + (l.filter ? ' filter' : '') : '') + (l.kind === 'line' && l.masked ? ' masked' : ''));
      d.appendChild(el('span', 't', hm(l.at)));
      if (l.n && !l.teacher) { d._n = lc(l.n); if (S.selected && d._n === lc(S.selected)) d.className += ' sel'; d.className += ' tap'; d.setAttribute('role', 'button'); d.tabIndex = 0; d.addEventListener('click', () => select(l.n)); }
      if (l.kind === 'ev') { d.appendChild(el('span', '', l.text)); return d; }
      d.appendChild(el('span', 'n' + (l.role === 'admin' ? ' admin' : ''), l.n));
      if (l.role === 'admin') d.appendChild(el('span', 'pill', l.teacher ? 'TEACHER' : 'ADMIN'));
      d.appendChild(el('span', '', ': ' + l.text));
      if (l.masked) d.appendChild(el('span', 'hid', 'Words hidden'));
      return d;
    }
    function renderChat() {
      if (!ui.chatList) return;
      clear(ui.chatList);
      for (const l of S.lines) if (S.filter === 'all' || flaggedLine(l)) ui.chatList.appendChild(lineEl(l));
      if (S.filter === 'flagged' && !S.lines.some(flaggedLine)) ui.chatList.appendChild(el('div', 'ln div0', 'Nothing flagged in the last hour.'));
      ui.fAll.className = S.filter === 'all' ? 'on' : ''; ui.fFlag.className = S.filter === 'flagged' ? 'on' : '';
      S.newLines = 0; renderNewLines();
    }
    function scrollChatEnd() { if (ui.chatScroll) { ui.chatScroll.scrollTop = ui.chatScroll.scrollHeight; S.follow = true; } }
    function renderNewLines() { if (!ui.newLines) return; ui.newLines.hidden = !S.newLines; ui.newLines.textContent = S.newLines + ' new line' + (S.newLines === 1 ? '' : 's'); }
    // the chat's footer: pause for everyone (folded into the bar's menu when the chat pane is under 420 px tall, or narrow)
    function renderChatFoot() {
      const c = ui.chatFoot; if (!c) return;
      const h = rect(ui.chat).height;
      S.folded = !S.narrow && h > 0 && h < FOLD_H;
      clear(c);
      c.hidden = S.narrow || S.folded;
      const p = pauseNow();
      if (p) { c.appendChild(el('div', 'lbl', 'Chat is paused until ' + clock(p.until) + '.')); const b = el('div', 'btns'); b.appendChild(btn('Turn chat back on', chatOn, 'amber')); c.appendChild(b); }
      else { c.appendChild(el('div', 'lbl', 'Pause chat for everyone:')); const b = el('div', 'btns'); for (const [span, label] of [['5m', '5 minutes'], ['15m', '15 minutes'], ['1h', '1 hour']]) b.appendChild(btn(label, () => send({ t: 'w_pause', span }))); c.appendChild(b); }
      c.appendChild(el('div', 'dim small', 'Admins and teachers can still talk while chat is paused.'));
      if (ui.pauseBtn) ui.pauseBtn.hidden = !(S.narrow || S.folded);
    }

    // ---------- knights ----------
    function knightOf(n) {
      const l = lc(n);
      const k = S.knights.find(x => lc(x.n) === l);
      if (k) return k;
      const g = S.gone.find(x => lc(x.n) === l);
      if (!g) return null;
      const so = S.sentOff.find(x => lc(x.n) === l);
      return { n: g.n, role: 'player', gone: g.at, map: null, place: null, doing: null, muted: null, sentOff: so ? +so.until || 1 : 0 };
    }
    const selectedKnight = () => S.selected ? knightOf(S.selected) : null;
    function mutedOf(k) {
      if (!k || !k.muted) return null;
      const until = k.muted.left === -1 ? Infinity : S.frameAt + k.muted.left * 1000;
      if (until <= now()) return null;
      return { until, by: k.muted.by, today: until !== Infinity && until >= dayEndLocal(now()) - 60000 };
    }
    function awayOf(k) { return !!k.away || (S.frameAt && now() - S.lastArrive > AWAY_MS); }
    const onFor = since => { const m = Math.max(0, Math.floor((now() - (+since || now())) / 60000)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; };
    const lineTwo = k => k.gone ? 'left ' + clock(k.gone) : (k.place || 'Somewhere in the world') + ' · ' + (awayOf(k) ? 'Away from the game' : k.doing || 'Standing still') + ' · on for ' + onFor(k.since);
    function tagsEl(k) {
      const box = el('span');
      if (k.role === 'admin') box.appendChild(el('span', 'pill', 'ADMIN'));
      const mu = mutedOf(k);
      if (mu) box.appendChild(el('span', 'tag', mu.until === Infinity ? 'Muted' : mu.today ? 'Muted today' : 'Muted ' + mins(mu.until - now()) + ' min'));
      const hid = S.hidden[lc(k.n)]; if (hid) box.appendChild(el('span', 'tag', 'Words hidden ' + hid));
      if (k.sentOff) box.appendChild(el('span', 'tag red', 'Sent off today'));
      return box;
    }
    function rowEl(k) {
      const r = el('div', 'row' + (S.selected && lc(S.selected) === lc(k.n) ? ' sel' : ''));
      r.setAttribute('role', 'button'); r.tabIndex = 0; r._n = lc(k.n);
      r.addEventListener('click', () => select(k.n, true));
      const t = el('div', 'txt'), l1 = el('div');
      l1.appendChild(el('span', 'nm' + (k.role === 'admin' ? ' admin' : ''), k.n)); l1.appendChild(tagsEl(k));
      t.append(l1, el('div', 'l2', lineTwo(k)));
      r.appendChild(t);
      if (!k.gone) { const watching = S.watch && lc(S.watch.n) === lc(k.n); r.appendChild(btn(watching ? 'Back to the map' : 'Watch', () => watching ? back() : watch(k.n), 'blue')); }
      return r;
    }
    function renderWho() {
      if (!ui.whoList) return;
      const st = ui.whoScroll.scrollTop;
      clear(ui.whoList);
      ui.whoHead.textContent = 'Who is on (' + S.knights.length + ')';
      const list = S.knights.slice().sort((a, b) => lc(a.n) < lc(b.n) ? -1 : 1);
      if (!list.length) ui.whoList.appendChild(el('div', 'act dim', 'Nobody is on right now.'));
      for (const k of list) ui.whoList.appendChild(rowEl(k));
      const on = new Set(list.map(k => lc(k.n)));
      const gone = S.gone.filter(g => !on.has(lc(g.n)));
      if (gone.length) {
        ui.whoList.appendChild(btn((S.foldGone ? '▸ ' : '▾ ') + 'Left in the last 30 minutes (' + gone.length + ')', () => { S.foldGone = !S.foldGone; renderWho(); }, 'fold'));
        if (!S.foldGone) for (const g of gone) ui.whoList.appendChild(rowEl(knightOf(g.n)));
      }
      if (S.sentOff.length) {
        ui.whoList.appendChild(el('div', 'act lbl', 'Sent off for today'));
        for (const s of S.sentOff) {
          const r = el('div', 'act'), at = (S.acts.find(a => a.id === s.act) || {}).at;
          r.appendChild(el('span', 'txt', s.n + ' — ' + (s.by || 'a teacher') + (at ? ', ' + clock(at) : '')));
          if (s.act) r.appendChild(btn('Let ' + s.n + ' back in', () => send({ t: 'w_undo', act: s.act })));
          ui.whoList.appendChild(r);
        }
      }
      ui.whoList.appendChild(btn((S.foldDone ? '▸ ' : '▾ ') + 'Done today (' + S.acts.length + ')', () => { S.foldDone = !S.foldDone; renderWho(); }, 'fold'));
      if (!S.foldDone) {
        if (!S.acts.length) ui.whoList.appendChild(el('div', 'act dim', 'Nothing yet today.'));
        for (const a of S.acts) {
          const r = el('div', 'act');
          r.appendChild(el('span', 'txt', clock(a.at) + '  ' + actWords(a)));
          if (a.inForce) r.appendChild(btn('Undo', () => send({ t: 'w_undo', act: a.id })));
          else r.appendChild(el('span', 'dim', a.undoneAt ? '(undone by ' + (a.undoneBy || 'someone') + ')' : '(over)'));
          ui.whoList.appendChild(r);
        }
      }
      ui.whoScroll.scrollTop = st;
      renderTabs();
    }
    function actWords(a) {
      if (a.act === 'mute') { const d = a.until - a.at; return a.teacher + ' muted ' + a.target + (Math.abs(d - 600000) < 2000 ? ' for 10 minutes' : Math.abs(d - 3600000) < 2000 ? ' for 1 hour' : ' for the rest of today'); }
      if (a.act === 'sendoff') return a.teacher + ' sent ' + a.target + ' off for the rest of the day';
      if (a.act === 'pause') { const m = Math.round((a.until - a.at) / 60000); return a.teacher + ' paused chat for everyone for ' + (m === 60 ? '1 hour' : m + ' minutes'); }
      return a.teacher + ' ' + a.act + ' ' + (a.target || '');
    }
    // ---------- the Knight card: the one place for a kid's controls ----------
    function renderCard() {
      const c = ui.card; if (!c) return;
      clear(c);
      const k = selectedKnight();
      // narrow: the card is the sheet under the map; wide: docked at the top of Who is on
      const host = S.narrow ? ui.sheet : ui.who;
      if (S.narrow) { if (c.parentNode !== ui.sheet) ui.sheet.appendChild(c); }
      else if (c.parentNode !== ui.who) ui.who.insertBefore(c, ui.whoScroll);
      c.hidden = !k;
      if (!host) return;
      if (!k) { renderTabs(); return; }
      const head = el('div', 'head');
      head.append(el('div', 'who' + (k.role === 'admin' ? ' admin' : ''), k.n), btn('Close', () => select(null)));
      c.appendChild(head);
      c.appendChild(el('div', 'dim', lineTwo(k)));
      const tg = tagsEl(k); if (tg.firstChild) c.appendChild(tg);
      const top = el('div', 'btns');
      const watching = S.watch && lc(S.watch.n) === lc(k.n);
      if (!k.gone) top.appendChild(btn(watching ? 'Back to the map' : 'Watch', () => watching ? back() : watch(k.n), 'blue'));
      if (!k.gone && k.map === 'over') top.appendChild(btn('Show on map', () => showOnMap(k.n)));
      if (top.firstChild) c.appendChild(top);
      if (k.role === 'admin') { c.appendChild(el('div', '', k.n + ' is an admin. Only Ethan can do that.')); renderTabs(); return; }
      if (!k.sentOff) c.appendChild(muteLine(k));
      c.appendChild(offEl(k));
      renderTabs();
    }
    function muteLine(k) {
      const box = el('div', 'btns');
      const mu = mutedOf(k);
      if (mu && mu.by === 'teacher') {
        const a = S.acts.find(x => x.act === 'mute' && x.inForce && lc(x.target) === lc(k.n));
        box.appendChild(el('div', '', k.n + ' is muted ' + (mu.today ? 'for the rest of today' : 'for ' + mins(mu.until - now()) + ' more minute' + (mins(mu.until - now()) === 1 ? '' : 's')) + (a ? ' (' + a.teacher + ').' : '.')));
        if (a) box.appendChild(btn('Undo', () => send({ t: 'w_undo', act: a.id })));
        return box;
      }
      if (mu) { box.appendChild(el('div', '', k.n + ' is muted by an admin.')); return box; }
      box.append(btn('Mute 10 min', () => mute(k.n, '10m')), btn('Mute 1 hour', () => mute(k.n, '1h')), btn('Mute rest of today', () => mute(k.n, 'today')));
      return box;
    }
    function mute(n, span) { send({ t: 'w_mute', n, span }); }
    // Send off for today: two taps; the question goes back by itself after 5 s
    function offEl(k) {
      const box = el('div', 'btns');
      if (k.sentOff) {
        box.appendChild(el('div', 'warn', k.n + ' is sent off for today.'));
        const so = S.sentOff.find(x => lc(x.n) === lc(k.n));
        if (so && so.act) box.appendChild(btn('Let ' + k.n + ' back in', () => send({ t: 'w_undo', act: so.act })));
        return box;
      }
      if (S.confirm && lc(S.confirm.n) === lc(k.n) && S.confirm.until > now()) {
        box.appendChild(el('div', '', 'Send ' + k.n + ' off Fanglands until midnight? ' + k.n + "'s knight is safe and saved."));
        box.append(btn('Yes, send ' + k.n + ' off', () => { S.confirm = null; send({ t: 'w_off', n: k.n }); renderCard(); }, 'redfill'), btn('Cancel', () => { S.confirm = null; renderCard(); }));
        return box;
      }
      box.appendChild(btn('Send off for today', () => { armSendOff(k.n); }, 'red'));
      return box;
    }
    function armSendOff(n) { S.confirm = { n, until: now() + CONFIRM_MS }; renderCard(); }
    // ---------- the toast: the answer to every tap ----------
    function toast(text, actId, bad, ms) {
      if (S.toast && S.toast.timer) env.clearTimeout(S.toast.timer);
      S.toast = { text, act: actId, bad: !!bad, timer: env.setTimeout(() => { S.toast = null; renderToast(); }, ms || TOAST_MS) };
      renderToast();
    }
    function say(text, bad) { toast(text, null, bad); }
    // wide: a strip at the bottom of Who is on; narrow: a strip of its own above the sheet (or under the list)
    function placeToast() {
      const t = ui.toast; if (!t || !ui.panes) return;
      if (S.narrow) { if (t.parentNode !== ui.panes || t.nextSibling !== ui.sheet) ui.panes.insertBefore(t, ui.sheet); t.style.order = '5'; }
      else { if (t.parentNode !== ui.who) ui.who.appendChild(t); t.style.order = ''; }
    }
    function renderToast() {
      const t = ui.toast; if (!t) return;
      placeToast(); clear(t);
      t.className = S.toast && S.toast.bad ? 'bad' : '';
      if (!S.toast) { t.hidden = true; return; }
      t.hidden = false;
      t.appendChild(el('span', 'txt', S.toast.text));
      if (S.toast.act) { const id = S.toast.act; t.appendChild(btn('Undo', () => { send({ t: 'w_undo', act: id }); S.toast = null; renderToast(); })); }
    }
    function select(n, fromList) {
      S.selected = n && S.selected && lc(S.selected) === lc(n) && fromList ? null : (n || null);
      S.confirm = null; S.pick = null; if (ui.pick) ui.pick.hidden = true;
      if (S.selected && !fromList && !S.knights.some(k => lc(k.n) === lc(S.selected)) && S.gone.some(g => lc(g.n) === lc(S.selected))) S.foldGone = false;
      renderWho(); renderCard(); relabel(true); drawMap(); markChat();
      if (S.selected && !S.narrow) revealCard();
    }
    function markChat() { if (!ui.chatList) return; const want = S.selected ? lc(S.selected) : null; for (const c of ui.chatList.children) if (c._n) c.classList.toggle('sel', c._n === want); }
    function revealCard() { if (ui.card && ui.card.scrollTop != null) ui.card.scrollTop = 0; }

    // ---------- the map ----------
    const MAP = { data: null, img: null, places: [], doors: [], W: 0, H: 0, TILE: 48, cells: null };
    function loadMap() {
      if (env.mapData) { MAP.data = env.mapData; return takeMap(MAP.data); }
      let p; try { p = env.fetch('/teacher-map.json', { credentials: 'omit' }); } catch (e) { return; }
      when(p, r => { if (!r || !r.ok) return; let j; try { j = r.json(); } catch (e) { return; } when(j, d => { MAP.data = d; takeMap(d); }, () => { }); }, () => { });
    }
    function takeMap(m) {
      if (!m || !m.W || !Array.isArray(m.grid)) return;
      MAP.W = m.W; MAP.H = m.H; MAP.TILE = m.TILE || 48;
      const n = m.W * m.H, cells = new Int32Array(n).fill(-1), solid = new Uint8Array(n);
      let i = 0; for (let k = 0; k + 1 < m.grid.length; k += 2) { cells.fill(m.grid[k], i, Math.min(n, i + m.grid[k + 1])); i += m.grid[k + 1]; }
      i = 0; let v = 0; for (const c of (m.fixed || [])) { if (v) solid.fill(1, i, Math.min(n, i + c)); i += c; v ^= 1; }
      MAP.cells = cells;
      MAP.places = (m.labels || []).map(p => { const own = new Set(p.idx); return Object.assign({}, p, { owns: (tx, ty) => tx >= 0 && ty >= 0 && tx < m.W && ty < m.H && own.has(cells[ty * m.W + tx]) }); });
      MAP.doors = Object.values(m.doors || {});
      // the doors go through the same layout as the places' names (only named at twice the fit)
      for (const d of MAP.doors) MAP.places.push({ name: d.name, kind: 'door', anchor: [d.x, d.y], box: [d.x, d.y, d.x, d.y], depth: -1, area: 0, owns: () => true });
      const pal = ['#4f6b45', '#5a5f3e', '#6b5a43', '#4c6656', '#5d6a48', '#55644c', '#62584a', '#4a6a5e', '#676447', '#5b5f52', '#4f5f42', '#6a6150', '#58704f', '#61674a', '#4d5d4a', '#6c5e46'];
      const SEA = [29, 58, 92];
      const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      const colourOf = idx => { const p = m.places[idx]; if (!p || /sea/.test(p.id)) return SEA; return hex(pal[idx % pal.length]); };
      const cv = D.createElement('canvas'); cv.width = m.W; cv.height = m.H;
      const g = cv.getContext && cv.getContext('2d');
      if (g && g.createImageData) {
        const img = g.createImageData(m.W, m.H);
        for (let k = 0; k < n; k++) { const c = colourOf(cells[k]), f = solid[k] ? 0.62 : 1; img.data[k * 4] = c[0] * f; img.data[k * 4 + 1] = c[1] * f; img.data[k * 4 + 2] = c[2] * f; img.data[k * 4 + 3] = 255; }
        g.putImageData(img, 0, 0);
        MAP.img = cv;
      }
      relabel(true); drawMap();
    }
    function fitView(w, h) { const s = Math.min(w / MAP.W, h / MAP.H); return { s, x: (w - MAP.W * s) / 2, y: (h - MAP.H * s) / 2 }; }
    // S.mapView: null (the whole map fits, kept on every resize) or {rel, cx, cy}: the zoom over the fit and the tile at the
    // middle of the pane, both kept on a resize
    function viewOf(w, h) {
      const fit = fitView(w, h);
      if (!S.mapView) return Object.assign({ fit: fit.s, w, h }, fit);
      const s = fit.s * S.mapView.rel;
      return { s, x: w / 2 - S.mapView.cx * s, y: h / 2 - S.mapView.cy * s, fit: fit.s, w, h };
    }
    function boxSize() { const b = rect(ui.mapBox); return b.width ? { w: b.width, h: b.height } : null; }
    function zoomBy(f, cx, cy) {
      const box = boxSize(); if (!box || !MAP.W) return;
      const v = viewOf(box.w, box.h), fit = fitView(box.w, box.h);
      const rel = cl((v.s * f) / fit.s, 1, 24);
      cx = cx == null ? box.w / 2 : cx; cy = cy == null ? box.h / 2 : cy;
      const tx = (cx - v.x) / v.s, ty = (cy - v.y) / v.s, s = fit.s * rel;
      const nx = cx - tx * s, ny = cy - ty * s;
      S.mapView = rel <= 1.000001 ? null : { rel, cx: (box.w / 2 - nx) / s, cy: (box.h / 2 - ny) / s };
      relabel(true); drawMap();
    }
    function panBy(dx, dy) {
      const box = boxSize(); if (!box || !MAP.W) return;
      const v = viewOf(box.w, box.h); const rel = v.s / v.fit;
      S.mapView = { rel, cx: (box.w / 2 - (v.x + dx)) / v.s, cy: (box.h / 2 - (v.y + dy)) / v.s };
    }
    function sizeMap() {
      const box = boxSize(), cv = ui.canvas; if (!box || !cv) return;
      const dpr = Math.min(W.devicePixelRatio || 1, 2);
      const cw = Math.round(box.w * dpr), ch = Math.round(box.h * dpr);
      if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; relabel(true); }
      drawMap();
    }
    // the knights out in the world as pane points
    function dotsOf(v) {
      const out = [], t = now();
      for (const k of S.knights) if (k.map === 'over' && k.x != null && k.y != null) {
        const f = S.flags[lc(k.n)];
        out.push({ n: k.n, k, x: v.x + (k.x / MAP.TILE) * v.s, y: v.y + (k.y / MAP.TILE) * v.s, sel: !!(S.selected && lc(S.selected) === lc(k.n)), flag: !!(f && t - f < FLAG_MS) });
      }
      return out;
    }
    const measure = (() => { let g = null; return (text, font) => { if (!g) { const c = D.createElement('canvas'); g = c.getContext ? c.getContext('2d') : null; } if (!g || !g.measureText) return String(text).length * 8; g.font = font; const w = g.measureText(String(text)).width; return Number.isFinite(w) && w > 0 ? w : String(text).length * 8; }; })();
    const rootFont = () => { try { return parseFloat(W.getComputedStyle(D.documentElement).fontSize) || 15.5; } catch (e) { return 15.5; } };
    // the names, laid out again at zoom end, pan end, a resize and a new frame (at most once a second); during a drag the
    // last layout is only moved along
    // the map's own controls over the canvas (+, −, Whole map; Key and its legend; the empty-map note), in pane px: names
    // and knights are kept off them
    function obstacles() {
      const b = rect(ui.mapBox), out = [];
      for (const e of [ui.zoom, ui.keyBox, ui.empty]) {
        if (!e || e.hidden) continue;
        const r = rect(e); if (!(r.width > 0 && r.height > 0)) continue;
        out.push({ x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height });
      }
      return out;
    }
    function relabel(force) {
      const box = boxSize(); if (!box || !MAP.W) { S.labels = null; return; }
      const t = now();
      if (!force && S.labels && t - S.labelAt < LABEL_EVERY) return;
      if (S.dragging && S.labels && !force) return;
      const v = viewOf(box.w, box.h);
      const res = layoutLabels(Object.assign({ font: 0.85 * rootFont(), obstacles: obstacles() }, v), MAP.places, dotsOf(v), measure, S.labelPrev);
      const prev = {}; for (const l of res.labels) prev[l.name] = [l.tx, l.ty];
      S.labelPrev = prev; S.labels = { at: v, res, frameAt: S.frameAt, w: box.w, h: box.h }; S.labelAt = t;
    }
    let drawQueued = false;
    function drawMap() {
      if (drawQueued) return; drawQueued = true;
      env.raf(() => { drawQueued = false; paint(); });
    }
    function paint() {
      renderMapHead();
      if (ui.empty) ui.empty.hidden = S.knights.length > 0;
      if (S.watch) return;
      const box = boxSize(), cv = ui.canvas; if (!box || !cv || !cv.getContext) return;
      const g = cv.getContext('2d'); if (!g) return;
      const sc = cv.width / box.w || 1;
      g.setTransform(sc, 0, 0, sc, 0, 0);
      g.fillStyle = '#0d1a2b'; g.fillRect(0, 0, box.w, box.h);
      if (!MAP.W) return;
      const v = viewOf(box.w, box.h);
      if (MAP.img) { g.imageSmoothingEnabled = false; g.drawImage(MAP.img, v.x, v.y, MAP.W * v.s, MAP.H * v.s); }
      // the names, the dots and the tags from one layout (made again on a new frame, a zoom, a resize, the end of a drag);
      // during a drag the last layout is only moved along with the map
      let lay = S.labels;
      if (!lay || Math.abs(lay.at.s - v.s) > 1e-9 || lay.w !== box.w || lay.h !== box.h || (!S.dragging && lay.frameAt !== S.frameAt)) { relabel(true); lay = S.labels; }
      const dx = lay ? v.x - lay.at.x : 0, dy = lay ? v.y - lay.at.y : 0;
      const mv = o => Object.assign({}, o, { x: o.x + dx, y: o.y + dy }, o.ox != null ? { ox: o.ox + dx, oy: o.oy + dy } : {}, o.cx != null ? { cx: o.cx + dx, cy: o.cy + dy } : {});
      const res = lay ? { clusters: lay.res.clusters.map(mv), dots: lay.res.dots.map(mv), tags: lay.res.tags.map(mv), labels: lay.res.labels.map(mv) } : { clusters: [], dots: [], tags: [], labels: [] };
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const l of res.labels) {
        g.font = '600 ' + l.font + 'px -apple-system, "Segoe UI", sans-serif';
        g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(l.name, l.cx, l.cy); g.fillStyle = l.door ? '#d7dae0' : '#f0e6c8'; g.fillText(l.name, l.cx, l.cy);
      }
      // the instance doors: a mark, named only at 2x the fit or more
      for (const d of MAP.doors) {
        const x = v.x + (d.x + 0.5) * v.s, y = v.y + (d.y + 0.5) * v.s;
        if (x < -8 || y < -8 || x > box.w + 8 || y > box.h + 8) continue;
        g.fillStyle = '#0b0d10'; g.fillRect(x - 4, y - 4, 8, 8); g.strokeStyle = '#f0e6c8'; g.lineWidth = 1.5; g.strokeRect(x - 4, y - 4, 8, 8);
      }
      // the knights: dots and count circles where they are (one moved clear of a control has a thin line to where he is)
      const t = now(), stale = S.lastArrive && t - S.lastArrive > AWAY_MS;
      for (const d of res.dots) if (d.ox != null) { g.beginPath(); g.moveTo(d.ox, d.oy); g.lineTo(d.x, d.y); g.strokeStyle = '#6fa8ff'; g.lineWidth = 1.5; g.stroke(); }
      for (const c of res.clusters) {
        g.beginPath(); g.arc(c.x, c.y, 13, 0, Math.PI * 2); g.fillStyle = '#2f4a73'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#0b0d10'; g.stroke();
        g.fillStyle = '#fff'; g.font = '700 14px -apple-system, sans-serif'; g.fillText(String(c.ks.length), c.x, c.y + 1);
        if (c.ks.some(k => k.sel)) { g.beginPath(); g.arc(c.x, c.y, 17, 0, Math.PI * 2); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
      }
      for (const d of res.dots) {
        const k = d.k.k, away = k.away || stale;
        g.beginPath(); g.arc(d.x, d.y, 7, 0, Math.PI * 2); g.fillStyle = away ? '#8a90a0' : '#6fa8ff'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#0b0d10'; g.stroke();
        if (mutedOf(k)) { g.beginPath(); g.arc(d.x, d.y, 9.5, 0, Math.PI * 2); g.strokeStyle = PAL.amber; g.lineWidth = 2.5; g.stroke(); }
        if (k.role === 'admin') { g.beginPath(); g.arc(d.x, d.y, mutedOf(k) ? 12 : 9.5, 0, Math.PI * 2); g.strokeStyle = PAL.admin; g.lineWidth = 2.5; g.stroke(); }
        if (d.k.flag) { g.beginPath(); g.arc(d.x, d.y, 15, 0, Math.PI * 2); g.strokeStyle = PAL.red; g.lineWidth = 2.5; g.stroke(); }
        if (d.k.sel) { g.beginPath(); g.arc(d.x, d.y, 18, 0, Math.PI * 2); g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.stroke(); }
      }
      g.font = '700 14px -apple-system, "Segoe UI", sans-serif'; g.textAlign = 'left';
      for (const tg of res.tags) { g.lineWidth = 4; g.strokeStyle = '#0b0d10'; g.strokeText(tg.n, tg.x + 4, tg.y + tg.h / 2); g.fillStyle = '#ffffff'; g.fillText(tg.n, tg.x + 4, tg.y + tg.h / 2); }
      S.drawn = { v, res, labels: res.labels, obstacles: obstacles() };
    }
    function renderMapHead() {
      if (!ui.mapHead) return;
      const n = S.knights.length, out = S.knights.filter(k => k.map === 'over').length;
      const stale = S.lastArrive && now() - S.lastArrive > STALE_MS;
      ui.mapHead.textContent = stale ? 'World map — Last update ' + hm(S.lastArrive) : 'World map — ' + n + ' knight' + (n === 1 ? '' : 's') + ' on: ' + out + ' out in the world, ' + (n - out) + ' inside places.';
    }
    function renderInside() {
      const box = ui.inside; if (!box) return;
      clear(box);
      if (!S.inside.length) { box.appendChild(el('span', 'dim', 'Inside places: nobody.')); return; }
      box.appendChild(el('span', 'dim', 'Inside places:'));
      for (const g of S.inside) box.appendChild(btn((g.place === 'Their own island' ? 'Their own islands' : g.place) + ': ' + g.names.join(', '), () => select(g.names[0]), 'chip'));
    }
    function showOnMap(n) {
      if (S.watch) back();
      const k = S.knights.find(x => lc(x.n) === lc(n)), box = boxSize();
      S.selected = n;
      if (k && k.map === 'over' && k.x != null && box && MAP.W) S.mapView = { rel: Math.max(4, S.mapView ? S.mapView.rel : 1), cx: k.x / MAP.TILE, cy: k.y / MAP.TILE };
      renderWho(); renderCard(); relabel(true); drawMap();
    }
    function tapMap(px, py) {
      const box = boxSize(); if (!box || !MAP.W) return;
      const v = viewOf(box.w, box.h);
      // what is drawn (a knight moved clear of a control is tapped where he is drawn)
      const res = S.drawn && S.drawn.res ? S.drawn.res : layoutLabels(Object.assign({ font: 0, obstacles: obstacles() }, v), [], dotsOf(v), measure, null);
      let best = null, bd = 22;
      for (const c of res.clusters.concat(res.dots)) { const d = Math.hypot(c.x - px, c.y - py); if (d <= bd) { bd = d; best = c; } }
      if (!best) { S.pick = null; ui.pick.hidden = true; return; }
      if (best.k) return select(best.k.n);
      clear(ui.pick); ui.pick.hidden = false;
      for (const k of best.ks.slice().sort((a, b) => lc(a.n) < lc(b.n) ? -1 : 1)) ui.pick.appendChild(btn(k.n, () => { ui.pick.hidden = true; select(k.n); }));
      ui.pick.style.left = Math.max(8, Math.min(box.w - 180, best.x + 16)) + 'px'; ui.pick.style.top = Math.max(8, Math.min(box.h - 120, best.y - 20)) + 'px';
    }
    function mapInput() {
      const c = ui.canvas, ptrs = new Map(); let drag = null, pinch = null, moved = 0;
      const pos = ev => { const b = rect(c); return { x: ev.clientX - b.left, y: ev.clientY - b.top }; };
      c.addEventListener('pointerdown', ev => { try { c.setPointerCapture(ev.pointerId); } catch (e) { } ptrs.set(ev.pointerId, pos(ev)); moved = 0; if (ptrs.size === 1) drag = pos(ev); if (ptrs.size === 2) { const [a, b] = Array.from(ptrs.values()); pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; } });
      c.addEventListener('pointermove', ev => {
        if (!ptrs.has(ev.pointerId)) return;
        const p = pos(ev); ptrs.set(ev.pointerId, p);
        if (ptrs.size === 2 && pinch) { const [a, b] = Array.from(ptrs.values()); const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch.d > 0) zoomBy(d / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2); pinch.d = d; moved += 10; return; }
        if (drag) { const dx = p.x - drag.x, dy = p.y - drag.y; moved += Math.abs(dx) + Math.abs(dy); if (moved > 6) { S.dragging = true; panBy(dx, dy); drawMap(); } drag = p; }
      });
      const up = ev => { const p = ptrs.get(ev.pointerId); ptrs.delete(ev.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) { const wasDrag = S.dragging; S.dragging = false; if (moved <= 6 && p) tapMap(p.x, p.y); else if (wasDrag) { relabel(true); drawMap(); } drag = null; } };
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', ev => { ptrs.delete(ev.pointerId); drag = null; pinch = null; S.dragging = false; relabel(true); drawMap(); });
      c.addEventListener('wheel', ev => { if (ev.preventDefault) ev.preventDefault(); const p = pos(ev); zoomBy(ev.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y); }, { passive: false });
    }

    // ---------- Watch: one kid's point of view ----------
    function watch(n) {
      if (!n) return;
      // wide: his Knight card docks at the top of Who is on, so Mute and Send off are at hand while watching him (narrow has
      // the strip under his screen)
      if (!S.narrow && !(S.selected && lc(S.selected) === lc(n))) select(n);
      if (S.watch && lc(S.watch.n) === lc(n)) return;
      S.watchWant = n;
      send({ t: 'w_view', n });
    }
    function startWatch(m) {
      const n = String(m.n || '');
      S.watchWant = null; S.hiddenView = null;
      if (S.watch && lc(S.watch.n) !== lc(n)) stopWatch(false);
      S.watch = { n, v: m.v, map: m.map, place: m.place, role: m.role, old: !!m.old, monsters: m.monsters === 'live' ? 'live' : 'friends', limit: m.limit || null, ended: '', at: now(), status: '', statusAt: 0 };
      ui.mapPane.hidden = true; ui.watchPane.hidden = false;
      if (S.narrow) ui.strip.hidden = false;
      layout();
      env.view.start(m.v, m, { box: ui.watchBox, zoom: S.layout.zoom });
      sizeWatch();
      if (env.canvas) env.canvas.style.display = 'block';
      renderPov(); renderWho(); renderCard();
    }
    // Back to the map (Esc, another kid, a hidden tab, the line down, signing out): the world stops the view
    function back() {
      if (!S.watch) return;
      send({ t: 'w_unview' });
      stopWatch(true);
    }
    function stopWatch(render) {
      S.watch = null;
      try { env.view.stop(); } catch (e) { }
      if (env.canvas) env.canvas.style.display = 'none';
      ui.watchPane.hidden = true; ui.mapPane.hidden = false; ui.strip.hidden = true; ui.card0.hidden = true;
      if (render !== false) { layout(); renderWho(); renderCard(); relabel(true); drawMap(); }
    }
    function onView(m) {
      const w = S.watch;
      if (m.t === 'muted' || m.t === 'unmuted' || m.t === 'chat_pause' || m.t === 'strike') {
        const n = w.n;
        w.status = m.t === 'muted' ? (m.by === 'pause' ? n + ' tried to chat while chat is paused.' : n + "'s chat is off" + (m.left > 0 ? ' for ' + mins(m.left * 1000) + ' more minute' + (mins(m.left * 1000) === 1 ? '' : 's') : '') + '.')
          : m.t === 'unmuted' ? n + "'s chat is back on."
            : m.t === 'strike' ? 'The word filter warned ' + n + '.'
              : (m.left > 0 ? 'Chat is paused for everyone.' : 'Chat is back on for everyone.');
        w.statusAt = now(); renderPov(); return;
      }
      env.view.feed(m);
      if (m.t === 'p' && m.n === w.n) { const was = w.lastP; w.lastP = now(); if (!was || w.paused) renderPov(); }
    }
    function zoomView(f) {
      S.layout.zoom = f === 0 ? 1 : cl(S.layout.zoom * f, ZOOM_MIN, ZOOM_MAX);
      env.view.setZoom(S.layout.zoom); saveSoon(); renderPov();
    }
    function sizeWatch() {
      if (!ui.watchBox) return;
      const r = rect(ui.watchBox);
      env.view.setPane(r.width, r.height);
    }
    const pron = () => { const st = env.view.state || {}; return st.girl ? { his: 'her', he: 'she' } : { his: 'his', he: 'he' }; };
    // the POV's header: who, where, what he is doing, the line's state, and the plain words for what this view can't show
    function renderPov() {
      const w = S.watch; if (!w || !ui.what) return;
      const k = S.knights.find(x => lc(x.n) === lc(w.n));
      const place = k ? k.place : w.place, doing = k ? (awayOf(k) ? 'Away from the game' : k.doing) : null;
      ui.whatText.textContent = 'Watching ' + w.n + (place ? ' · ' + place : '') + (doing ? ' · ' + doing : '');
      const t = now(), st = env.view.state || {}, p = pron(), n = w.n;
      const lastP = st.lastPAt ? t - (st.lastPAt - (env.view.clockOffset || 0)) : null;
      ui.only.textContent = 'Only watching: taps here do nothing in ' + n + "'s game.";
      ui.glass.title = ui.only.textContent; ui.what.title = ui.only.textContent;
      let state = '', live = true;
      if (w.ended) { state = w.ended; live = false; }
      else if (!w.lastP && t - w.at >= WAIT_MS) { state = 'Waiting for ' + n + "'s game…"; live = false; }
      else if (w.lastP && t - w.lastP >= PAUSED_MS) { state = n + "'s game is paused or in the background. This is the last thing it showed. Last seen " + hm(w.lastP) + '.'; live = false; w.paused = true; }
      else w.paused = false;
      ui.state.textContent = state;
      ui.whatLive.hidden = !live;
      const notes = [];
      if (w.old) notes.push(n + "'s game is an older version. What you see may be a little off.");
      if (w.limit === 'day') notes.push('Monsters near ' + n + ' show only when a friend is near ' + (p.he === 'she' ? 'her' : 'him') + ' (the daily limit for watching is used up).');
      else if (w.limit === 'streams') notes.push('Monsters near ' + n + ' show only when a friend is near ' + (p.he === 'she' ? 'her' : 'him') + ' (three kids are already being watched this way).');
      else if (w.monsters === 'friends') notes.push('Monsters near ' + n + ' show when a friend is near ' + (p.he === 'she' ? 'her' : 'him') + ' or ' + p.his + ' game is reloaded.');
      if (w.status && t - w.statusAt < STATUS_MS) notes.push(w.status);
      ui.state2.textContent = notes.join(' ');
      // his island, or a place this page can't draw: a card instead of the canvas
      let card = '';
      if (st.house) card = n + ' is on ' + p.his + ' own island. What ' + p.he + ' built there stays on ' + p.his + ' game, so it is not shown here. ' + (p.he === 'she' ? 'Her' : 'His') + ' chat still shows here.';
      else if (st.unknown) card = "This view can't draw that place yet. Reload the page to update.";
      ui.card0.textContent = card; ui.card0.hidden = !card;
      ui.closer.disabled = S.layout.zoom >= ZOOM_MAX - 1e-6; ui.wider.disabled = S.layout.zoom <= ZOOM_MIN + 1e-6;
      // narrow: one line under his screen with his controls at hand
      if (S.narrow) {
        clear(ui.strip); ui.strip.hidden = false;
        ui.strip.append(btn(n, () => select(n)), btn('Mute', () => select(n)), btn('Send off', () => { select(n); armSendOff(n); }, 'red'));
        // (Back to the map is the first button over his screen; the strip repeats it only where there is room on one line)
        if (winW() >= 600) ui.strip.appendChild(btn('Back to the map', () => back()));
      } else ui.strip.hidden = true;
    }
    function glassInput() {
      const gl = ui.glass;
      const stop = ev => { if (ev.stopPropagation) ev.stopPropagation(); if (ev.preventDefault && ev.type !== 'pointerdown') ev.preventDefault(); };
      gl.addEventListener('pointerdown', stop);
      gl.addEventListener('touchstart', ev => { if (ev.stopPropagation) ev.stopPropagation(); }, { passive: true });
      gl.addEventListener('click', ev => {
        stop(ev);
        const b = rect(gl), n = env.view.knightAt(ev.clientX - b.left, ev.clientY - b.top);
        if (n) select(n);
      });
      gl.addEventListener('wheel', ev => { stop(ev); }, { passive: false });
    }

    // ---------- once a second: the clocks on screen (no calls) ----------
    function tick() {
      if (!token || S.ended) return;
      const t = now(), idle = t - S.lastInput;
      if (idle >= IDLE_MS + IDLE_WARN_MS) return signOut('idle');
      if (S.expires && t >= S.expires) return ended(4011);
      if (S.confirm && S.confirm.until <= t) { S.confirm = null; renderCard(); }
      // a hidden tab stops watching after a minute (the world stops the view), and starts again when it is seen
      if (D.hidden && S.watch && S.hiddenSince && t - S.hiddenSince >= HIDDEN_MS) { S.hiddenView = S.watch.n; back(); }
      renderBar(); renderBanners(); renderMapHead(); renderPov();
    }
    function renderAll() { renderBar(); renderBanners(); renderChatFoot(); renderWho(); renderCard(); renderInside(); renderTabs(); renderToast(); relabel(true); drawMap(); }

    // ---------- the screen's life ----------
    function start(a) {
      token = a.token; S.me = a.name; S.expires = +a.expires || 0; S.startedAt = now(); S.lastInput = now();
      S.bye = null; S.tries = 0; S.gaveUp = false; S.status = 'connecting'; S.ended = false;
      build(); layout(); renderAll();
      // the shared-computer hint: the toast for the first 10 s (never in the bar, so nothing moves when it goes)
      toast("On a shared computer, press Sign out when you're done.", null, false, HINT_MS);
      loadMap(); connect();
      const touched = () => { const was = now() - S.lastInput >= IDLE_MS; S.lastInput = now(); if (was) renderBanners(); };
      for (const t of ['pointerdown', 'keydown', 'touchstart', 'wheel', 'click']) D.addEventListener(t, touched, { passive: true, capture: true });
      D.addEventListener('visibilitychange', () => {
        if (D.hidden) { S.hiddenSince = now(); return; }
        S.hiddenSince = 0;
        if (token && !S.ws && (S.wantOnVisible || S.timer)) { S.wantOnVisible = false; if (S.timer) { env.clearTimeout(S.timer); S.timer = null; } connect(); }
        if (S.hiddenView && S.ws && S.ws.readyState === 1) { const n = S.hiddenView; S.hiddenView = null; watch(n); }
      });
      // leaving the page signs out: a shared classroom computer is never left signed in
      W.addEventListener('pagehide', () => { if (!token) return; logoutBeacon(); token = null; });
      W.addEventListener('pageshow', ev => { if (ev && ev.persisted) { try { if (env.ss) env.ss.setItem(BYE_KEY, '4010'); } catch (e) { } S.ended = true; env.replace('/'); } });
      W.addEventListener('resize', () => layout());
      // every key: Esc goes back to the map; none reaches the game (05-input would take arrows, space and Tab)
      W.addEventListener('keydown', ev => {
        sayKey(ev);
        if (ev.key === 'Escape' && S.watch) { back(); if (ev.preventDefault) ev.preventDefault(); if (ev.stopPropagation) ev.stopPropagation(); return; }
        const t = ev.target; if (!(t && ui.root && ui.root.contains && ui.root.contains(t))) { if (ev.stopPropagation) ev.stopPropagation(); }
      }, true);
      for (const tp of ['keyup', 'keypress']) W.addEventListener(tp, ev => { const t = ev.target; if (!(t && ui.root && ui.root.contains && ui.root.contains(t))) { if (ev.stopPropagation) ev.stopPropagation(); } }, true);
      // the ping: the runtime answers it without waking the world (exactly this text)
      env.setInterval(() => { if (S.ws && S.ws.readyState === 1) { try { S.ws.send(PING); } catch (e) { } } }, PING_MS);
      env.setInterval(tick, 1000);
    }
    return { S, ui, start, onMessage, signOut, watch, back, select, layout, relabel, paint, tick, layoutLabels, MAP, takeMap, moveDivider, nudgeDivider, resetDivider, setChat, setWho, setSplit, viewOf, renderPov, armSendOff, signedIn: () => !!token };
  }

  // ---------- teacher mode on the real page ----------
  // The page stops being a game for good (a reload is the only way back): no socket of a knight's, nothing sent, nothing
  // saved, the canvas hidden, the sound off, every key and tap kept from the game; the token stays in this file's closures.
  function enterMode() {
    TS.active = true;
    try { if (window.LOGIN) { LOGIN.hide(); LOGIN.showing = false; } } catch (e) { }
    try { if (window.CHAT && CHAT.isOpen && CHAT.isOpen()) CHAT.close(); } catch (e) { }
    NET.disconnect(); NET.enabled = false; NET.send = () => false; NET.token = null;
    title.active = true; SAVE_LOCK = true;
    // the sound is off in memory only: no audio context (the one a tap on the card made is closed, and the taps that would
    // make another are taken away). audioMuted is the device's own setting (43-settings saves it): it is never touched
    for (const t of ['keydown', 'pointerdown', 'touchstart']) { try { window.removeEventListener(t, audioStart); } catch (e) { } }
    try { if (audioCtx && audioCtx.close) audioCtx.close(); } catch (e) { }
    audioCtx = null;
    try { canvas.style.display = 'none'; } catch (e) { }
    try { document.documentElement.classList.add('tv-on'); } catch (e) { }
    if (window.VIEW) VIEW.install();
  }
  TS.open = a => openWith(a, realEnv(), enterMode);
  function realEnv() {
    return {
      win: window, doc: document, fetch: (u, o) => window.fetch(u, o), WebSocket: window.WebSocket, now: () => Date.now(),
      setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: id => clearTimeout(id), setInterval: (f, ms) => setInterval(f, ms), clearInterval: id => clearInterval(id),
      ls: (() => { try { return window.localStorage; } catch (e) { return null; } })(), ss: (() => { try { return window.sessionStorage; } catch (e) { return null; } })(),
      beacon: (url, body) => { try { if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))) return; } catch (e) { } try { fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true, credentials: 'omit' }).catch(() => { }); } catch (e) { } },
      // (the card's own address: '/' on fanglands.com; a local world's '/?online' keeps its query)
      replace: url => { try { location.replace(url + (location.search || '')); } catch (e) { } },
      raf: f => (window.requestAnimationFrame ? window.requestAnimationFrame(f) : setTimeout(f, 16)),
      RO: typeof ResizeObserver !== 'undefined' ? ResizeObserver : null,
      coarse: !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches),
      view: window.VIEW, canvas,
    };
  }
  function openWith(a, env, enter) {
    if (!a || typeof a.token !== 'string' || !a.token) return false;
    if (TS.screen) return false;
    enter();
    const scr = make(env);
    scr.start(a);
    // what a page script (and the real-browser proof) may see of the open screen: a copy of what it shows, never S, never
    // the token (which lives in make()'s closure only)
    TS.screen = {
      peek: () => { const S = scr.S; return { status: S.status, me: S.me, expires: S.expires, knights: S.knights.map(k => k.n), selected: S.selected, narrow: S.narrow, sizes: S.sizes ? Object.assign({}, S.sizes) : null, folded: S.folded, watching: S.watch ? S.watch.n : null, drawn: S.drawn ? JSON.parse(JSON.stringify({ labels: S.drawn.labels, obstacles: S.drawn.obstacles, dots: S.drawn.res.dots.map(d => ({ x: d.x, y: d.y, r: d.r, n: d.k.n })), clusters: S.drawn.res.clusters.map(c => ({ x: c.x, y: c.y, r: c.r, n: c.ks.length })), tags: S.drawn.res.tags })) : null }; },
      // the real-browser proof's two clocks: nothing pressed for that long; the session's end reached
      idleFor: ms => { scr.S.lastInput = Date.now() - ms; },
      expireNow: () => { scr.S.expires = Date.now() - 1; },
    };
    return true;
  };
  // J1 (71-login): a teacher's answer on a page that already held a kid's world: the session ends at once and the page
  // starts again, so the screen opens on a fresh page (the card says to sign in once more)
  TS.fresh = token => {
    try { const body = JSON.stringify({ token }); if (navigator.sendBeacon) navigator.sendBeacon('/api/teacher/logout', new Blob([body], { type: 'application/json' })); else fetch('/api/teacher/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => { }); } catch (e) { }
    try { sessionStorage.setItem(BYE_KEY, 'fresh'); } catch (e) { }
    try { location.replace('/' + (location.search || '')); } catch (e) { }
  };
  Object.assign(TS, { make, layoutLabels, wideSizes, narrowSplit, readLayout, writeLayout, CSS, enterMode });
  // (the self-test opens the screen exactly as TS.open does, over a stand-in page and without teacher mode)
  const openForTest = openWith;

  // ---------- self-test: the screen over a small stand-in DOM, a fake clock, socket and fetch ----------
  function fakePage(opts = {}) {
    let html = 0;
    class El {
      constructor(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null; this._text = ''; this.className = ''; this.attrs = {}; this.style = {}; this.hidden = false; this.disabled = false; this.id = ''; this.listeners = {}; this.scrollTop = 0; this.scrollHeight = 0; this.clientHeight = 0; this.type = ''; this.width = 0; this.height = 0; this._rect = null; }
      get firstChild() { return this.children[0] || null; }
      get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._text; }
      // as a browser's: setting the text leaves one text node, and a child appended after it keeps it
      set textContent(v) { for (const c of this.children) c.parentNode = null; this.children = []; this._text = ''; const s0 = String(v); if (s0) { const t = new El('#text'); t._text = s0; t.parentNode = this; this.children.push(t); } }
      set innerHTML(v) { html++; }
      get classList() { const self = this; const set = () => new Set(String(self.className).split(/\s+/).filter(Boolean)); return { add: (...c) => { const s = set(); c.forEach(x => s.add(x)); self.className = [...s].join(' '); }, remove: (...c) => { const s = set(); c.forEach(x => s.delete(x)); self.className = [...s].join(' '); }, contains: c => set().has(c), toggle: (c, on) => { const s = set(); if (on === undefined ? !s.has(c) : on) s.add(c); else s.delete(c); self.className = [...s].join(' '); } }; }
      appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
      append(...cs) { for (const c of cs) this.appendChild(c); }
      insertBefore(c, ref) { if (!ref) return this.appendChild(c); if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; const i = this.children.indexOf(ref); this.children.splice(i < 0 ? this.children.length : i, 0, c); return c; }
      get nextSibling() { const p = this.parentNode; if (!p) return null; return p.children[p.children.indexOf(this) + 1] || null; }
      removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; }
      contains(e) { for (let x = e; x; x = x.parentNode) if (x === this) return true; return false; }
      setAttribute(k, v) { this.attrs[k] = String(v); }
      getAttribute(k) { return this.attrs[k]; }
      addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
      fire(t, ev = {}) { for (const f of this.listeners[t] || []) f(Object.assign({ type: t, target: this, preventDefault() { }, stopPropagation() { } }, ev)); }
      setPointerCapture() { }
      getBoundingClientRect() { const r = this._rect || (this.id === 'tv-chat' ? { width: 300, height: opts.chatH || 600 } : this.id === 'tv-mapbox' || this.id === 'tv-watchbox' ? { width: 600, height: 500 } : { width: 0, height: 0 }); return Object.assign({ left: 0, top: 0, right: r.width, bottom: r.height }, r); }
      getContext() { return null; }
      focus() { }
      get visible() { for (let e = this; e; e = e.parentNode) if (e.hidden) return false; return true; }
    }
    const all = root => { const out = []; const walk = e => { out.push(e); e.children.forEach(walk); }; walk(root); return out; };
    const clock = { t: Date.UTC(2026, 9, 6, 14, 0, 0) };
    const timers = new Map(); let seq = 0;
    const doc = { hidden: false, listeners: {}, addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }, createElement: tag => new El(tag), getElementById: () => null, documentElement: new El('html') };
    doc.body = new El('body'); doc.head = new El('head');
    const ls = {}, ss = {}, calls = [], socks = [], beacons = [], replaced = [], winL = {};
    const store = (o, failing) => ({ getItem: k => { if (failing) throw new Error('private'); return k in o ? o[k] : null; }, setItem: (k, v) => { if (failing) throw new Error('private'); o[k] = String(v); }, removeItem: k => { delete o[k]; } });
    class WS { constructor(url) { this.url = url; this.readyState = 0; this.sent = []; socks.push(this); } send(s) { this.sent.push(s); } close() { this.readyState = 3; } open() { this.readyState = 1; if (this.onopen) this.onopen(); } recv(m) { this.onmessage({ data: JSON.stringify(m) }); } drop(code) { this.readyState = 3; if (this.onclose) this.onclose({ code }); } }
    const reply = (status, body) => ({ ok: status < 300, status, json: () => body });   // answers at once (no promise)
    let ticketN = 0;
    const view = { started: [], fed: [], stopped: 0, frozen: 0, zoom: 1, pane: null, state: { lastPAt: 0, house: false, unknown: false, girl: false }, start(v, f) { this.started.push([v, f]); }, feed(m) { this.fed.push(m); }, stop() { this.stopped++; }, freeze() { this.frozen++; }, setZoom(z) { this.zoom = z; return z; }, setPane(w, h) { this.pane = [w, h]; }, knightAt: () => 'Sam' };
    const win = { innerWidth: opts.width || 1280, innerHeight: opts.height || 800, devicePixelRatio: 2, location: { protocol: 'https:', host: 'fanglands.com' }, addEventListener: (t, f) => { (winL[t] = winL[t] || []).push(f); }, getComputedStyle: () => ({ fontSize: '15.5px' }) };
    const env = {
      win, doc, WebSocket: WS, now: () => clock.t,
      fetch: (url, o = {}) => { calls.push({ url, o }); if (url === '/api/teacher/ticket') return reply(200, { ticket: 'tk' + (++ticketN) }); return reply(404, {}); },
      setTimeout: (f, ms) => { const id = ++seq; timers.set(id, { at: clock.t + (ms || 0), f }); return id; }, clearTimeout: id => timers.delete(id),
      setInterval: (f, ms) => { const id = ++seq; timers.set(id, { at: clock.t + ms, f, every: ms }); return id; }, clearInterval: id => timers.delete(id),
      ls: store(ls, opts.privateMode), ss: store(ss, false), beacon: (url, body) => beacons.push({ url, body }), replace: url => replaced.push(url), raf: f => f(), RO: null, coarse: false, view, canvas: { style: {} },
      mapData: opts.map || null,
    };
    const advance = ms => { const end = clock.t + ms; for (;;) { let nx = null; for (const [id, t] of timers) if (t.at <= end && (!nx || t.at < nx[1].at)) nx = [id, t]; if (!nx) break; clock.t = nx[1].at; if (nx[1].every) nx[1].at += nx[1].every; else timers.delete(nx[0]); nx[1].f(); } clock.t = end; };
    const P = { env, doc, win, clock, ls, ss, calls, socks, beacons, replaced, view, advance, winL, html: () => html, all: () => all(doc.body), El };
    P.text = () => all(doc.body).filter(e => e.visible).map(e => e._text).join('\n');
    P.find = (txt, tag) => all(doc.body).find(e => e.visible && (!tag || e.tagName === tag) && e.textContent === txt) || null;
    P.byId = id => all(doc.body).find(e => e.id === id) || null;
    P.click = e => { if (!e) throw new Error('nothing to click'); e.fire('click'); };
    P.ws = () => socks[socks.length - 1];
    P.sent = t => socks.flatMap(s => s.sent).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(m => m && m.t === t);
    return P;
  }
  TS.fakePage = fakePage;
  HOOKS.selfTest.push((check) => {
    const P0 = 'teacher screen: ';
    const T0 = Date.UTC(2026, 9, 6, 14, 0, 0);
    const ANS = { token: 'ab'.repeat(32), name: 'Mrs Smith', expires: T0 + 36000000 };
    const KN = [{ n: 'Sam', role: 'player', map: 'over', place: 'Thistledown', x: 4800, y: 1400, doing: 'Walking', since: T0 - 40 * 60000, away: false, muted: null, sentOff: 0 },
      { n: 'Ava', role: 'admin', map: 'over', place: 'Thistledown', x: 5000, y: 1500, doing: 'Fighting', since: T0 - 30 * 60000, away: false, muted: null, sentOff: 0 }];
    const live = (P, expires) => { const s = make(P.env); s.start(Object.assign({}, ANS, expires ? { expires } : {})); P.ws().open(); P.ws().recv({ t: 'w_hello', me: 'Mrs Smith', expires: expires || ANS.expires, now: P.clock.t, tz: 'America/Toronto', notice: true }); P.ws().recv({ t: 'w_all', at: P.clock.t, knights: KN, inside: [], gone: [], chatPause: null, acts: [], sentOff: [], chat: [] }); return s; };
    // the token: never stored, never in an address; the socket's address carries only the ticket
    const P = fakePage(), s = live(P), tok = ANS.token;
    {
      const leaked = JSON.stringify(P.ls).includes(tok) || JSON.stringify(P.ss).includes(tok) || P.socks.some(w => w.url.includes(tok)) || JSON.stringify(P.win.location).includes(tok);
      const urlOk = P.socks.length === 1 && /^wss:\/\/fanglands\.com\/api\/teacher\/ws\?ticket=tk1$/.test(P.ws().url);
      const ticketAuth = P.calls.some(c => c.url === '/api/teacher/ticket' && c.o.headers && c.o.headers.authorization === 'Bearer ' + tok);
      check(P0 + 'the token is never in localStorage, sessionStorage, the address or the socket\'s address; the socket carries only a single-use ticket', !leaked && urlOk && ticketAuth, { leaked, url: P.ws() && P.ws().url, ticketAuth });
    }
    // NEGATIVE: the screen opened as the card opens it (TS.open's own path, over a stand-in page): the token is reachable from
    // none of window.TEACHERSCREEN, window.LOGIN and window.VIEW (their own fields, deep), nor from what TEACHERSCREEN.screen
    // shows a page script (peek)
    {
      const reach = (root, needle) => { const seen = new Set(), stack = [[root, 0]]; while (stack.length) { const [o, d] = stack.pop(); if (typeof o === 'string') { if (o.includes(needle)) return true; continue; } if (!o || (typeof o !== 'object' && typeof o !== 'function') || seen.has(o) || d > 7) continue; seen.add(o); if (typeof Node !== 'undefined' && o instanceof Node) continue; let ks = []; try { ks = Object.keys(o); } catch (e) { } for (const k of ks) { let v; try { v = o[k]; } catch (e) { continue; } stack.push([v, d + 1]); } } return false; };
      const was = TS.screen, Pg = fakePage(), secret = 'cd'.repeat(32);
      TS.screen = null;
      let opened = false, kept = [], peeked = true, hasS = true;
      try {
        opened = openForTest(Object.assign({}, ANS, { token: secret }), Pg.env, () => { });
        Pg.ws().open(); Pg.ws().recv({ t: 'w_hello', me: 'Mrs Smith', expires: ANS.expires, now: Pg.clock.t, tz: 'America/Toronto', notice: true });
        kept = ['TEACHERSCREEN', 'LOGIN', 'VIEW'].filter(g => window[g] && reach(window[g], secret));
        peeked = JSON.stringify(TS.screen.peek()).includes(secret);
        hasS = 'S' in TS.screen || Object.values(TS.screen).some(v => v && typeof v === 'object' && 'ws' in v);
      } finally { TS.screen = was; }
      check(P0 + 'NEGATIVE: opened as the card opens it, the token is reachable from none of TEACHERSCREEN, LOGIN and VIEW, TEACHERSCREEN.screen has no S, and what it shows (peek) has no token; the ticket call still carries it', opened && kept.length === 0 && !peeked && !hasS && Pg.calls.some(c => c.url === '/api/teacher/ticket' && c.o.headers.authorization === 'Bearer ' + secret), { opened, kept, peeked, hasS });
    }
    // NEGATIVE: a kid's token left on this device and the page coming back into view open no knight socket (teacher mode
    // turns the wire off: 70-net's visibilitychange asks NET.connect, which refuses with the wire off)
    {
      const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, send: NET.send };
      let opened = 0;
      try {
        NET.useFake({ call: () => ({}), open: () => { opened++; return { readyState: 1, send() { }, close() { } }; } });
        NET.enabled = false; NET.token = 'a-kids-token'; NET.send = () => false;
        const tried = NET.connect();
        check(P0 + 'NEGATIVE: a kid\'s token on this device and the page becoming visible open no knight socket while the teacher screen is up', tried === false && opened === 0 && NET.sock === null, { tried, opened });
      } finally { NET.useFake(was.fake); NET.enabled = was.enabled; NET.token = was.token; NET.send = was.send; NET.status = 'off'; }
    }
    // the dividers: dragged, clamped to the minimums, saved 300 ms after letting go, and read back on a new page
    {
      const sz0 = Object.assign({}, s.S.sizes);
      s.setChat(10); const minChat = s.S.sizes.chat; s.setChat(5000); const maxChat = s.S.sizes.chat;
      s.setWho(10); const minWho = s.S.sizes.who; s.setChat(400); s.setWho(330);
      P.advance(299); const early = P.ls[LAYOUT_KEY];
      s.ui.div1.fire('keydown', { key: 'ArrowRight' }); P.advance(301);
      const saved = P.ls[LAYOUT_KEY] ? JSON.parse(P.ls[LAYOUT_KEY]) : null;
      const P2 = fakePage(); P2.ls[LAYOUT_KEY] = P.ls[LAYOUT_KEY]; const s2 = make(P2.env); s2.start(ANS);
      const back = !!(saved && s2.S.sizes && s2.S.sizes.chat === Math.round(saved.wide.l * 1280));
      const P3 = fakePage({ privateMode: true }); const s3 = make(P3.env); s3.start(ANS); s3.setChat(400); P3.advance(400);
      const priv = !!(s3.S.sizes && s3.S.sizes.chat === 400);
      s.resetDivider(s.ui.div1); s.resetDivider(s.ui.div2);
      check(P0 + 'the dividers: the chat and the list keep 260 / 280 px and at most 40%, the map 380, a drag is saved 300 ms after letting go (as fractions), a new page reads it back, a private window that throws still works, a double tap resets', sz0.chat === 307 && sz0.who === 333 && minChat === CHAT_MIN && maxChat === Math.floor(SIDE_MAX * 1280) && minWho === WHO_MIN && early === undefined && !!saved && saved.v === 1 && Math.abs(saved.wide.l - 424 / 1280) < 1e-3 && back && priv && s.S.sizes.chat === 307, { sz0, minChat, maxChat, minWho, early, saved, back, priv });
    }
    // the pause controls fold into the bar under 420 px of chat
    {
      const P4 = fakePage({ chatH: 380 }); const s4 = make(P4.env); s4.start(ANS);
      const folded = s4.S.folded === true && s4.ui.chatFoot.hidden === true && s4.ui.pauseBtn.hidden === false;
      const unfolded = s.S.folded === false && s.ui.chatFoot.hidden === false && s.ui.pauseBtn.hidden === true;
      check(P0 + 'the chat\'s pause controls fold into the bar\'s Pause chat menu when the chat pane is under 420 px tall', folded && unfolded, { folded, unfolded });
    }
    // the teacher's own line (owner, 7 Oct): the box under the chat sends w_say on Send and on Enter, is there wide, narrow
    // and folded, keeps a refused line, sends nothing blank, and draws the world's line as the teacher's (gold, TEACHER, no tap)
    {
      const Ps = fakePage(); const ss = live(Ps);
      ss.ui.sayInput.value = '  Hello   everyone  '; Ps.click(ss.ui.sayBtn);
      const sent1 = Ps.sent('w_say'), one = sent1.length === 1 && sent1[0].text === 'Hello everyone' && ss.ui.sayInput.value === '';
      ss.ui.sayInput.value = 'Time to pack up'; ss.ui.sayInput.fire('keydown', { key: 'Enter' });
      const sent2 = Ps.sent('w_say'), enter = sent2.length === 2 && sent2[1].text === 'Time to pack up' && ss.ui.sayInput.value === '';
      Ps.ws().recv({ t: 'w_no', req: sent2[1].req, code: 'slow', text: 'Wait a moment before the next line.' });
      const kept = ss.ui.sayInput.value === 'Time to pack up';
      ss.ui.sayInput.value = '   '; Ps.click(ss.ui.sayBtn); const blank = Ps.sent('w_say').length === 2;
      // on the real page the card's guard stops a key typed in a text box at the window: Enter is heard there, and taken once
      ss.ui.sayInput.value = 'Line up at the door';
      const kev = { type: 'keydown', key: 'Enter', target: ss.ui.sayInput, preventDefault() { }, stopPropagation() { } };
      for (const f of Ps.winL.keydown || []) f(kev); ss.ui.sayInput.fire('keydown', kev);
      const winEnter = Ps.sent('w_say').length === 3 && Ps.sent('w_say')[2].text === 'Line up at the door';
      Ps.ws().recv({ t: 'w_chat', at: Ps.clock.t, n: 'Mrs Smith', text: 'Hello everyone', role: 'admin', masked: false, teacher: true });
      const row = ss.ui.chatList.children[ss.ui.chatList.children.length - 1];
      const drawn = !!row && /Mrs Smith/.test(row.textContent) && /TEACHER/.test(row.textContent) && row.children.some(c => c.className === 'n admin') && row._n === undefined;
      const shown = ss.ui.say.visible && ss.ui.sayInput.maxLength === 120 && ss.ui.sayInput.placeholder === 'Say to all, as Mrs Smith';
      const Pn = fakePage({ width: 768, height: 1024 }); const sn = live(Pn);
      const narrow = sn.S.narrow === true && sn.ui.say.visible;
      const Pf = fakePage({ chatH: 380 }); const sf = live(Pf);
      const folded = sf.S.folded === true && sf.ui.say.visible;
      check(P0 + "the teacher's chat box: Send and Enter (heard on the window too, taken once) send w_say (trimmed, at most 120), a refused line stays in the box, a blank one sends nothing, the world's line shows as hers in gold with TEACHER; there wide, narrow and folded", one && enter && kept && blank && winEnter && drawn && shown && narrow && folded, { one, enter, kept, blank, winEnter, drawn, shown, narrow, folded, row: row && row.textContent });
    }
    // the two-tap send-off, back by itself after 5 s; a toast for every w_no
    {
      s.select('Sam');
      const first = s.ui.card.visible && !!P.find('Send off for today', 'BUTTON');
      P.click(P.find('Send off for today', 'BUTTON'));
      const asked = !!P.find("Send Sam off Fanglands until midnight? Sam's knight is safe and saved.") && P.sent('w_off').length === 0;
      P.advance(5100); s.tick();
      const backAgain = !!P.find('Send off for today', 'BUTTON') && P.sent('w_off').length === 0;
      P.click(P.find('Send off for today', 'BUTTON')); P.click(P.find('Yes, send Sam off', 'BUTTON'));
      const offSent = P.sent('w_off').length === 1 && P.sent('w_off')[0].n === 'Sam';
      const nos = [];
      for (const [code, text] of [['gone', 'Sam is not on now.'], ['admin', 'Ava is an admin. Only Ethan can do that.'], ['slow', "That's a lot at once. Wait a few minutes, or ask Ethan."], ['daycap', "You've sent 20 knights off today. Ask Ethan."], ['longer', 'Sam is already muted for longer.'], ['changed', 'Someone else changed that since, so it was left as it is.'], ['busy', 'Too many kids are being watched right now. Try again in a minute.']]) { P.ws().recv({ t: 'w_no', req: 999, code, text }); nos.push(s.ui.toast.visible && s.ui.toast.textContent === text); }
      check(P0 + 'Send off takes two taps ("Send Sam off Fanglands until midnight? Sam\'s knight is safe and saved."), goes back by itself after 5 s, and every w_no shows in the toast', first && asked && backAgain && offSent && nos.every(Boolean), { first, asked, backAgain, offSent, nos });
    }
    // an admin's card: Watch and Show on map, never a mute or a send-off
    {
      s.select('Ava');
      const admin = !!P.find('Ava is an admin. Only Ethan can do that.') && !!P.find('Show on map', 'BUTTON') && !P.find('Mute 10 min', 'BUTTON') && !P.find('Send off for today', 'BUTTON');
      check(P0 + 'an admin\'s Knight card has Watch and Show on map and "Ava is an admin. Only Ethan can do that." and no mute or send-off (D2)', admin, { admin });
    }
    // Watch: w_view, the world's w_vstart starts the view, w_v feeds it, Back to the map stops it (w_unview)
    {
      s.select('Sam');
      const watchBtn = P.all().find(e => e.visible && e.tagName === 'BUTTON' && e.textContent === 'Watch' && s.ui.card.contains(e));
      P.click(watchBtn);
      const asks = P.sent('w_view');
      P.ws().recv({ t: 'w_vstart', req: asks[0] && asks[0].req, v: 7, n: 'Sam', map: 'over', place: 'Thistledown', keeper: { t: 'keeper', map: 'over', n: 'Sam' }, me: null, others: [], parties: [], old: false, monsters: 'live', limit: null });
      P.ws().recv({ t: 'w_v', v: 7, m: { t: 'p', n: 'Sam', map: 'over', x: 1, y: 2 } }); P.ws().recv({ t: 'w_v', v: 6, m: { t: 'p', n: 'Sam', map: 'over', x: 9, y: 9 } });
      const watching = asks.length === 1 && asks[0].n === 'Sam' && P.view.started.length === 1 && P.view.fed.length === 1 && P.view.fed[0].x === 1 && !s.ui.watchPane.hidden && s.ui.mapPane.hidden && /^Watching Sam · Thistledown · Walking/.test(s.ui.what.textContent);
      const only = s.ui.only.textContent === "Only watching: taps here do nothing in Sam's game.";
      const cardBack = !!P.all().find(e => e.visible && e.tagName === 'BUTTON' && e.textContent === 'Back to the map' && s.ui.card.contains(e));
      P.ws().recv({ t: 'w_v', v: 7, m: { t: 'muted', left: 600, by: 'teacher' } });
      const status = /Sam's chat is off for 10 more minutes\./.test(s.ui.state2.textContent) && P.view.fed.length === 1;
      P.ws().recv({ t: 'w_vend', v: 7, n: 'Sam', why: 'left', at: P.clock.t, text: 'Sam left the game at 10:00 am.' });
      const endedOk = P.view.frozen === 1 && s.ui.state.textContent === 'Sam left the game at 10:00 am.';
      P.click(s.ui.back);
      const stopped = P.sent('w_unview').length === 1 && P.view.stopped === 1 && s.ui.watchPane.hidden && !s.ui.mapPane.hidden;
      check(P0 + 'Watch: the card\'s Watch sends w_view, the world\'s w_vstart opens his view, only frames of this view (v) are fed, a status frame goes to the header only, w_vend freezes it with the world\'s words, Back to the map sends w_unview and brings the map back', watching && only && cardBack && status && endedOk && stopped, { watching, only, cardBack, status, endedOk, stopped, what: s.ui.what.textContent, state2: s.ui.state2.textContent });
    }
    // Watch from a Who row (wide): his Knight card docks at the top of Who is on, so his Mute and Send off are on screen while
    // watching him (the old page left the card shut: the teacher had to know to tap the row's words instead)
    {
      const Pw = fakePage(), sw = live(Pw);
      const row = Pw.all().find(e => e.visible && e.className && /\brow\b/.test(e.className) && e._n === 'sam');
      const b = row && row.children.find(c => c.tagName === 'BUTTON' && c.textContent === 'Watch');
      Pw.click(b);
      const card = sw.ui.card.visible && sw.S.selected === 'Sam' && !!Pw.all().find(e => e.visible && e.tagName === 'BUTTON' && e.textContent === 'Mute 10 min' && sw.ui.card.contains(e));
      check(P0 + 'Watch on a Who row (wide) also opens his Knight card, with Mute 10 min and Send off for today on screen; w_view is sent', card && Pw.sent('w_view').length === 1 && !!Pw.find('Send off for today', 'BUTTON'), { card, sel: sw.S.selected, sent: Pw.sent('w_view').length });
    }
    // narrow (an iPad upright): watching a kid gives his screen 70% of the panes (the map's own 55% comes back after), and
    // Closer, Wider and Fit sit on the same row as Back to the map
    {
      const Pn = fakePage({ width: 768, height: 1024 }), sn = live(Pn);
      const h0 = parseFloat(sn.ui.mid.style.height);
      sn.watch('Sam'); Pn.ws().recv({ t: 'w_vstart', v: 3, n: 'Sam', map: 'over', place: 'Thistledown', keeper: { t: 'keeper', map: 'over', n: 'Sam' }, me: null, others: [], parties: [], old: false, monsters: 'live', limit: null });
      const h1 = parseFloat(sn.ui.mid.style.height);
      const row1 = sn.ui.back.parentNode, same = [sn.ui.closer, sn.ui.wider, sn.ui.fit].every(b => b.parentNode === row1);
      sn.back(); const h2 = parseFloat(sn.ui.mid.style.height);
      check(P0 + 'narrow: watching gives his screen 70% of the panes (' + h1 + ' px, the map ' + h0 + ' px), Closer, Wider and Fit share Back to the map\'s row, and the map\'s split comes back', sn.S.narrow && h0 === Math.round(0.55 * (1024 - 120)) && h1 === Math.round(0.7 * (1024 - 120)) && same && h2 === h0, { h0, h1, h2, same });
    }
    // grep gate: no innerHTML here or in 79-view (everything is textContent)
    {
      const src = typeof window.__gameSource === 'string' ? window.__gameSource : (typeof document !== 'undefined' && document.scripts ? Array.from(document.scripts).map(x => x.textContent).join('\n') : '');
      const part = name => { const i = src.indexOf('// ---- src/' + name + ' ----'); if (i < 0) return null; const j = src.indexOf('// ---- src/', i + 10); return src.slice(i, j < 0 ? undefined : j); };
      const files = ['79-teacherscreen.js', '79-view.js'].map(part);
      const bad = /\.(inner|outer)HTML\s*=(?!=)|insertAdjacentHTML/;
      const noHtml = files.every(f => f !== null && !bad.test(f.replace('set innerHTML(v) { html++; }', '')));
      check(P0 + 'grep gate: no innerHTML, outerHTML or insertAdjacentHTML in 79-teacherscreen or 79-view; the stand-in DOM saw no HTML written', (src ? noHtml : true) && P.html() === 0, { noHtml, src: !!src, html: P.html() });
    }
    // idle: the banner after 60 minutes, signed out ('idle') 2 minutes later; pagehide sends the logout beacon; w_bye and
    // Sign out go back to the card with their reason
    {
      const P5 = fakePage(); const s5 = live(P5);
      P5.advance(IDLE_MS + 1000); s5.tick();
      const banner = s5.ui.banners.textContent === 'Still watching? Tap anywhere to stay signed in. Signing out in 1:59.';
      P5.advance(IDLE_WARN_MS); s5.tick();
      const idleOut = P5.ss[BYE_KEY] === 'idle' && P5.replaced.length === 1 && P5.replaced[0] === '/' && P5.beacons.length === 1 && JSON.parse(P5.beacons[0].body).token === tok;
      const P6 = fakePage(); live(P6); for (const f of P6.winL.pagehide || []) f({});
      const hide = P6.beacons.length === 1 && P6.beacons[0].url === '/api/teacher/logout' && JSON.parse(P6.beacons[0].body).token === tok;
      const P7 = fakePage(); const s7 = live(P7); P7.ws().recv({ t: 'w_bye', code: 4012, text: 'Ethan turned this sign-in off.' });
      const bye = P7.ss[BYE_KEY] === '4012' && P7.replaced[0] === '/' && !s7.signedIn();
      const P8 = fakePage(); const s8 = live(P8); P8.click(s8.ui.signout);
      const out = P8.ss[BYE_KEY] === '4010' && P8.replaced[0] === '/' && P8.beacons.length === 1 && !s8.signedIn();
      const P9 = fakePage(); const s9 = live(P9, T0 + 30 * 60000); P9.advance(30 * 60000 + 1500);
      const midnight = P9.ss[BYE_KEY] === '4011' && P9.replaced[0] === '/';
      check(P0 + 'idle: "Still watching? ... Signing out in 1:59." after an hour, signed out (idle) two minutes later; pagehide sends the logout beacon; w_bye, Sign out and the end of the session go back to the card with their reason (a code in sessionStorage, never the token)', banner && idleOut && hide && bye && out && midnight, { banner, text: s5.ui.banners.textContent, idleOut, hide, bye, out, midnight, ss: P5.ss });
    }
    // the hint beside Sign out for the first 10 s
    {
      const P10 = fakePage(); const s10 = live(P10);
      const HINT = "On a shared computer, press Sign out when you're done.";
      const shown = s10.ui.toast.visible && s10.ui.toast.textContent === HINT;
      // never in the bar (the bar's height never changes when it goes: the old one stacked the bar's words for 10 s)
      const bar = P10.byId('tv-bar'), inBar = !!(bar && P10.all().some(e => bar.contains(e) && e._text === HINT));
      P10.advance(HINT_MS - 500); const still = s10.ui.toast.visible;
      P10.advance(700);
      check(P0 + '"On a shared computer, press Sign out when you\'re done." shows as the toast for the first 10 s, then goes; it is never in the bar', shown && still && !inBar && !s10.ui.toast.visible && !P10.find(HINT), { shown, still, inBar, after: s10.ui.toast.visible });
    }
    // the layout's sizes
    {
      const w1024 = wideSizes(1024, null, false), w1280 = wideSizes(1280, null, false), w1920 = wideSizes(1920, null, false), w899 = wideSizes(899, null, false), w768 = wideSizes(768, null, false);
      check(P0 + 'wide at 1024 is 260 | 460 | 280 (two 12 px dividers), at 1280 307 | 616 | 333, at 1920 461 | 936 | 499; 899 and 768 are narrow; the narrow map is 55% of the panes', !!w1024 && w1024.chat === 260 && w1024.mid === 460 && w1024.who === 280 && !!w1280 && w1280.chat === 307 && w1280.mid === 616 && !!w1920 && w1920.chat === 461 && w1920.mid === 936 && w1920.who === 499 && w899 === null && w768 === null && narrowSplit(1000, null) === 550 && narrowSplit(300, null) === 225, { w1024, w1280, w1920 });
    }
  });
}
