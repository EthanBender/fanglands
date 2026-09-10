// ============================================================================
// MAP MARKERS — icons for the places that matter, on the minimap and on the world map.
// Banks, shops and stalls, quest givers (notice boards and the folk who hand out work),
// every way down (a dungeon door, a mine shaft, the crypt, the coal cart), every way up
// (the ladder out of Deepholm, the wind shrine), the docks and every lodestone.
//
// A marker is hidden until the knight has been within 12 tiles of its tile. What he has found
// is remembered in quest.markers (saved with the game) and reset by HOOKS.newGame.
//
// Feature file: registers through HOOKS and wraps four core functions by reassignment (the
// accepted trick — 13-ux wraps say/notify, 43-settings wraps drawMinimap/pointerDown, 44-wiki
// wraps update): drawMinimap (glyphs over the little map), drawPanels (glyphs, legend and the
// show/hide toggle over the world map), pointerDown and pointerMove (where the finger or the
// mouse is, so a marker can be tapped or hovered for its name).
//
// Registry for other features: window.MARKERS.add({ x, y, kind, label }) — kind is one of
// bank | shop | quest | down | up | dock | lodestone. One marker to a tile: a feature's own wins over
// one this file worked out from the world.
// ============================================================================
{
  const DISCOVER = 12;       // tiles: a marker becomes known when the knight comes this close to it
  const HIT = 13;            // px: how near a tap or the mouse must be to name a marker on the world map
  const MINI_R = 4.2;        // glyph radius on the minimap (3.4 on a phone-sized one)
  const MAP_R = 5.2;         // glyph radius on the world map

  // ---------- the kinds ----------
  const KINDS = [
    { id: 'bank', name: 'Bank', colour: '#f5c542' },
    { id: 'shop', name: 'Shop', colour: '#e0883a' },
    { id: 'quest', name: 'Quest', colour: '#ffe066' },
    { id: 'down', name: 'Way down', colour: '#b58cff' },
    { id: 'up', name: 'Way up', colour: '#5ad1a0' },
    { id: 'dock', name: 'Dock', colour: '#c9a36a' },
    { id: 'lodestone', name: 'Lodestone', colour: '#7ec8ff' },
  ];
  const KIND = {}; for (const k of KINDS) KIND[k.id] = k;

  // ---------- state ----------
  // quest.markers.seen keys a marker by kind and tile, so a save carries no raw tile id (the map remaps on load)
  function st() {
    if (!quest.markers || typeof quest.markers !== 'object') quest.markers = { seen: {}, show: true };
    const s = quest.markers;
    if (!s.seen || typeof s.seen !== 'object') s.seen = {};
    if (typeof s.show !== 'boolean') s.show = true;
    return s;
  }
  HOOKS.newGame.push(() => { quest.markers = { seen: {}, show: true }; dirty = true; selected = null; hover = null; });

  const built = [];   // everything this file works out from the world itself, rebuilt at every world-gen
  const extra = [];   // whatever another feature added through MARKERS.add
  let cache = null, cacheDiffs = -1, dirty = true;
  let selected = null, hover = null, pointer = null;
  let lastMini = [], lastMap = null;

  const keyOf = m => m.kind + ':' + m.x + ',' + m.y;
  function make(kind, x, y, label) {
    if (!KIND[kind] || typeof x !== 'number' || typeof y !== 'number') return null;
    const m = { kind, x: Math.round(x), y: Math.round(y), label: String(label || KIND[kind].name) };
    m.key = keyOf(m);
    return m;
  }
  function add(spec) {
    const m = spec && make(spec.kind, spec.x, spec.y, spec.label);
    if (!m) return null;
    if (extra.some(o => o.x === m.x && o.y === m.y)) return null;
    extra.push(m); dirty = true;
    return m;
  }

  // ---------- what the world already holds ----------
  const SHOP_BY_ID = { dunstan: 'dung' };                 // his NPC record carries the role, not the shop key
  const SHOP_BY_ROLE = { trader: 'trader' };              // 06-systems opens Fennick's stall as shop 'trader'
  const QUEST_ROLES = { duke: 1, bread: 1, hermit: 1, captain: 1, warden: 1, survivor: 1, dungfarmer: 1 };
  // people who live on a feature's own list rather than in NPCS (dwarves, elves): found live through TAP_PEOPLE
  const PEOPLE = {
    brunhild: { kind: 'shop', shop: 'dwarf' },
    lira: { kind: 'shop', shop: 'elf_range' },
    thessaly: { kind: 'shop', shop: 'elf_weaver' },
    thrain: { kind: 'quest', label: 'King Thrain' },
    aelith: { kind: 'quest', label: 'Queen Aelith' },
  };
  // Salt Pete keeps to himself: 26-boats exports no handle for his shack, so his tile is written down here.
  // The self-test checks the tile is still on Gull Isle and still sells what SHOPS.saltpete sells.
  const PETE = { x: 181, y: 14, shop: 'saltpete' };
  // tiles that are a place in their own right. Looked up by NAME: a feature file's tile id depends on load order.
  const TILE_MARKS = {
    BOARD: { kind: 'quest', label: 'Notice board' },
    REBUILD_BOARD: { kind: 'quest', label: 'Rebuilding board' },
    GUILD_BOARD: { kind: 'quest', label: 'Guild board' },
    DUNGEON_DOOR: { kind: 'down', label: 'A way underground' },
    CRYPT_DOOR: { kind: 'down', label: 'The crypt' },
    SHAFT: { kind: 'down', label: 'Mine shaft to Deepholm' },
    COAL_CART: { kind: 'down', label: 'The coal road' },
    LADDER_UP: { kind: 'up', label: 'Ladder up to the quarry' },
    WIND_SHRINE: { kind: 'up', label: 'Wind shrine' },
    DOCK: { kind: 'dock', label: 'Dock', cluster: 5 },
    LODESTONE: { kind: 'lodestone', label: 'Lodestone' },
  };
  const markTiles = () => { const out = []; for (const name in TILE_MARKS) { const id = tileId(name); if (id !== null) out.push([id, TILE_MARKS[name]]); } return out; };

  const shopName = key => (SHOPS[key] && SHOPS[key].name) || null;
  // a shopkeeper or a quest giver standing indoors is marked on the door: that is where a knight walks to
  function spotFor(n) {
    const b = insideBuilding(n.x, n.y);
    if (b) {
      if (b.door !== undefined) return { x: b.x + b.door, y: b.y + b.h - 1 };
      if (b.doorTop !== undefined) return { x: b.x + b.doorTop, y: b.y };
    }
    return { x: n.x, y: n.y };
  }
  const SEA_NAMES = { 'The Grey Sea': 1, 'The Wilds': 1, 'Goblin Fields': 1 };
  function dockLabel(x, y) {
    for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const t = tileAt(x + dx, y + dy);
      if (t !== T.SAND && t !== T.GRASS && t !== T.DIRT && t !== T.COBBLE) continue;
      const name = regionAt(x + dx, y + dy).name;
      if (!SEA_NAMES[name]) return name + ' dock';
    }
    return 'The dock';
  }

  function buildAll() {
    built.length = 0;
    const taken = new Set();
    const put = (kind, x, y, label) => {
      const m = make(kind, x, y, label);
      if (!m || !inMap(m.x, m.y) || taken.has(m.x + ',' + m.y)) return null;
      taken.add(m.x + ',' + m.y); built.push(m); return m;
    };
    // 1. instance doors — the name of the place on the other side
    if (window.INSTANCES && INSTANCES.list) {
      for (const id of INSTANCES.list()) {
        const inst = INSTANCES.get(id);
        if (inst && inst.door) put('down', inst.door[0], inst.door[1], inst.name);
      }
    }
    // 2. shops and banks kept by the core NPCs
    for (const n of NPCS) {
      const key = n.shop || SHOP_BY_ID[n.id] || SHOP_BY_ROLE[n.role];
      const s = spotFor(n);
      if (key && shopName(key)) put('shop', s.x, s.y, shopName(key));
      else if (n.role === 'bank') { const b = insideBuilding(n.x, n.y); put('bank', s.x, s.y, (b && b.name) || n.name); }
    }
    // 3. shopkeepers and rulers on a feature's own list (17-tap's people registry finds them live)
    if (typeof tapPeople === 'function') {
      for (const p of tapPeople()) {
        const def = PEOPLE[p.id]; if (!def) continue;
        const label = def.shop ? shopName(def.shop) : def.label;
        if (label) put(def.kind, Math.floor(p.x / TILE), Math.floor(p.y / TILE), label);
      }
    }
    if (shopName(PETE.shop)) put('shop', PETE.x, PETE.y, shopName(PETE.shop));
    // 4. quest givers among the core NPCs (only the leader of a huddle, so four survivors are one marker)
    for (const n of NPCS) {
      if (!QUEST_ROLES[n.role]) continue;
      if (n.role === 'survivor' && !n.leader) continue;
      const s = spotFor(n);
      put('quest', s.x, s.y, n.name);
    }
    // 5. the tiles that are places: boards, doors, shafts, ladders, shrines, docks
    const marks = markTiles(); const byId = new Map(marks);
    const docks = [];
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const def = byId.get(map[idx(x, y)]); if (!def) continue;
      if (def.cluster) {
        if (docks.some(d => Math.hypot(d.x - x, d.y - y) <= def.cluster)) continue;
        const m = put(def.kind, x, y, dockLabel(x, y)); if (m) docks.push(m);
        continue;
      }
      put(def.kind, x, y, def.label);
    }
    dirty = true;
  }
  HOOKS.world.push(() => buildAll()); // 61 registers last, so every other feature's tiles are already down

  // ---------- markers that appear as the game is played (a lodestone placed, the crypt opened) ----------
  // mapDiffs holds every tile the knight has changed, so this is a short scan, not a sweep of the map.
  function fromDiffs() {
    const out = []; const byId = new Map(markTiles());
    for (const [i, t] of mapDiffs) {
      const def = byId.get(t); if (!def) continue;
      const x = i % MAP_W, y = Math.floor(i / MAP_W);
      const m = make(def.kind, x, y, def.cluster ? dockLabel(x, y) : def.label);
      if (m) out.push(m);
    }
    return out;
  }
  function rebuild() {
    const seenTile = new Set(), out = [];
    for (const m of extra.concat(built, fromDiffs())) {   // a feature's own marker wins the tile over one worked out here
      const t = m.x + ',' + m.y; if (seenTile.has(t)) continue;
      seenTile.add(t); out.push(m);
    }
    out.sort((a, b) => a.y - b.y || a.x - b.x);
    cache = out; cacheDiffs = mapDiffs.size; dirty = false;
  }
  const inInstance = () => !!(window.INSTANCES && INSTANCES.active && INSTANCES.active());
  function all() {
    if (inInstance()) return cache || [];   // the map under the knight is the dungeon's, not the world's
    if (!cache || dirty || cacheDiffs !== mapDiffs.size) rebuild();
    return cache;
  }
  const known = () => { const s = st().seen; return all().filter(m => s[m.key]); };
  const kindsInUse = () => { const have = {}; for (const m of known()) have[m.kind] = 1; return KINDS.filter(k => have[k.id]); };

  // ---------- discovery ----------
  let sinceScan = 0;
  function discover() {
    if (inInstance() || player.dead) return 0;
    const s = st(), ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
    let found = 0;
    for (const m of all()) { if (s.seen[m.key]) continue; if (Math.hypot(m.x - ptx, m.y - pty) <= DISCOVER) { s.seen[m.key] = 1; found++; } }
    if (found) save();
    return found;
  }
  HOOKS.update.push(dt => {
    sinceScan += dt;
    if (sinceScan >= 0.4) { sinceScan = 0; discover(); }
    if (panel !== 'map') { selected = null; hover = null; }
    if (pressed.has('KeyP')) toggleShow();
  });
  HOOKS.keyHelp.push({ action: 'Map markers on or off', codes: ['KeyP'] }); // 43-settings lists it on the Controls line

  function setShow(on) { const s = st(); s.show = !!on; selected = null; save(); }
  function toggleShow() { const s = st(); setShow(!s.show); notify(s.show ? 'Map markers on.' : 'Map markers off.'); }

  // ---------- the glyphs: drawn shapes, small enough for a minimap, plain enough to read ----------
  function drawGlyph(g, kind, cx, cy, r) {
    const K = KIND[kind]; if (!K) return;
    g.save(); g.translate(cx, cy);
    g.fillStyle = 'rgba(8,11,17,0.88)'; g.beginPath(); g.arc(0, 0, r + 1.7, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 1; g.stroke();
    const s = r, c = K.colour;
    if (kind === 'bank') {                       // a strongbox: a banded chest with a lock
      g.fillStyle = c; g.fillRect(-s * 0.85, -s * 0.7, s * 1.7, s * 1.4);
      g.fillStyle = 'rgba(8,11,17,0.85)'; g.fillRect(-s * 0.85, -s * 0.18, s * 1.7, s * 0.36);
      g.beginPath(); g.arc(0, 0, s * 0.26, 0, 7); g.fill();
    } else if (kind === 'shop') {                // a market stall: an awning over a counter
      g.fillStyle = 'rgba(8,11,17,0.85)'; g.fillRect(-s * 0.72, -s * 0.1, s * 1.44, s * 0.95);
      g.fillStyle = c; g.beginPath(); g.moveTo(-s, -s * 0.1); g.lineTo(0, -s * 0.95); g.lineTo(s, -s * 0.1); g.closePath(); g.fill();
      g.fillStyle = c; g.fillRect(-s * 0.72, s * 0.6, s * 1.44, s * 0.25);
    } else if (kind === 'quest') {               // work to be had: a mark on a disc
      g.fillStyle = c; g.beginPath(); g.arc(0, 0, s * 0.95, 0, 7); g.fill();
      g.fillStyle = 'rgba(8,11,17,0.9)'; g.fillRect(-s * 0.16, -s * 0.62, s * 0.32, s * 0.78);
      g.beginPath(); g.arc(0, s * 0.44, s * 0.19, 0, 7); g.fill();
    } else if (kind === 'down' || kind === 'up') { // a doorway with an arrow through it
      const dn = kind === 'down';
      g.fillStyle = 'rgba(8,11,17,0.9)'; g.fillRect(-s * 0.9, -s * 0.9, s * 1.8, s * 1.8);
      g.fillStyle = c; g.fillRect(-s * 0.9, dn ? -s * 0.9 : s * 0.62, s * 1.8, s * 0.28);
      g.beginPath();
      if (dn) { g.moveTo(-s * 0.6, -s * 0.3); g.lineTo(s * 0.6, -s * 0.3); g.lineTo(0, s * 0.75); }
      else { g.moveTo(-s * 0.6, s * 0.3); g.lineTo(s * 0.6, s * 0.3); g.lineTo(0, -s * 0.75); }
      g.closePath(); g.fill();
    } else if (kind === 'dock') {                // a boat at a jetty
      g.fillStyle = c; g.beginPath(); g.moveTo(-s * 0.9, s * 0.1); g.lineTo(s * 0.9, s * 0.1); g.lineTo(s * 0.5, s * 0.7); g.lineTo(-s * 0.5, s * 0.7); g.closePath(); g.fill();
      g.fillRect(-s * 0.12, -s * 0.9, s * 0.24, s * 1.0);
      g.beginPath(); g.moveTo(s * 0.06, -s * 0.9); g.lineTo(s * 0.75, -s * 0.15); g.lineTo(s * 0.06, -s * 0.15); g.closePath(); g.fill();
    } else {                                      // lodestone: the standing stone, as it is drawn in the world
      g.fillStyle = c; g.beginPath(); g.moveTo(-s * 0.7, s * 0.85); g.lineTo(-s * 0.35, -s * 0.9); g.lineTo(s * 0.35, -s * 0.9); g.lineTo(s * 0.7, s * 0.85); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(-s * 0.13, -s * 0.55, s * 0.26, s * 1.1);
    }
    g.restore();
  }

  // ---------- the minimap ----------
  function drawMiniMarkers(g, x, y, size) {
    lastMini = [];
    if (!st().show || inInstance()) return;
    if (typeof x !== 'number' || !(size > 0)) return;
    const tilesAcross = 44, scale = size / tilesAcross;
    const sx = clamp(player.x / TILE - tilesAcross / 2, 0, MAP_W - tilesAcross), sy = clamp(player.y / TILE - tilesAcross / 2, 0, MAP_H - tilesAcross);
    const r = size < 120 ? 3.4 : MINI_R;
    g.save(); roundRect(g, x, y, size, size, 10); g.clip();
    for (const m of known()) {
      const mx = x + (m.x + 0.5 - sx) * scale, my = y + (m.y + 0.5 - sy) * scale;
      if (mx < x - r || mx > x + size + r || my < y - r || my > y + size + r) continue;
      // a corner of a town can hold six places inside four tiles: on a map this small they would stack into
      // a smudge, so the second glyph within a glyph's width of one already drawn waits for the world map
      if (lastMini.some(p => Math.hypot(p.x - mx, p.y - my) < r * 1.9)) continue;
      drawGlyph(g, m.kind, mx, my, r);
      lastMini.push({ key: m.key, x: mx, y: my, r });
    }
    // the core draws the white "you" dot before this hook: put it back on top so a glyph never hides the knight
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + (player.x / TILE - sx) * scale, y + (player.y / TILE - sy) * scale, 3.5, 0, 7); g.fill();
    g.restore();
  }
  let boxRect = null;
  { const _render = render; render = function () { const r = _render.apply(this, arguments); boxRect = dialog.cur && dialogRect ? { ...dialogRect } : null; return r; }; }
  { const _load = load; load = function () { const r = _load.apply(this, arguments); dirty = true; return r; }; } // a fresh mapDiffs can be the same size as the old one
  {
    const _drawMinimap = drawMinimap;
    drawMinimap = function (g, x, y, size) {
      const r = _drawMinimap.apply(this, arguments);
      if (window.SETTINGS && SETTINGS.get('minimap') === false) return r; // the minimap is switched off: nothing was drawn
      drawMiniMarkers(g, x, y, size);
      return r;
    };
  }

  // ---------- the world map ----------
  // The key and the show/hide toggle sit in a strip along the foot of the map image. The core's own
  // "tap anywhere to close" rect (label 'mapimage') is cut back to where the strip starts and given a marker
  // hit-test, so no new rect is laid over it and a tap on the key is simply absorbed by the panel.
  // The key is capped three ways so it can never eat the map it explains: three rows at most, then glyphs
  // without their words, and if even that will not fit, no key at all.
  const MAX_ROWS = 3, STRIP_SHARE = 0.34;
  function legendLayout(g, ix, iy, iw, ih, narrow) {
    const pad = 8, bw = narrow ? 84 : 96, bh = 26, rowH = 14;
    const cells = st().show ? kindsInUse() : [];
    g.font = 'bold 10px sans-serif';
    const avail = Math.max(40, iw - pad * 2 - bw - pad);
    const wrap = named => {
      const rows = []; let row = [], used = 0;
      for (const k of cells) {
        const name = named ? k.name : '';
        const w = Math.min(avail, (named ? 16 + g.measureText(name).width + 10 : 18));
        if (row.length && used + w > avail) { rows.push(row); row = []; used = 0; }
        row.push({ kind: k.id, name, w }); used += w;
      }
      if (row.length) rows.push(row);
      return rows;
    };
    let rows = wrap(true);
    if (rows.length > MAX_ROWS) rows = wrap(false);     // the words will not fit this map: the glyphs alone are the key
    let stripH = Math.max(bh, rows.length * rowH) + pad * 2;
    let showRows = rows.length > 0;
    if (stripH > Math.max(bh + pad * 2, ih * STRIP_SHARE) || stripH > ih - 24) { stripH = bh + pad * 2; showRows = false; }
    let sy = iy + ih - stripH;
    // A talk box can sit across the foot of the map, and 05-input gives a button the tap before the box gets it:
    // a toggle buried under the words would swallow "tap to continue". So the key floats up clear of the box.
    const box = dialog.cur ? boxRect : null;
    if (box && box.y < sy + stripH && box.y + box.h > sy) sy = clamp(box.y - stripH - 6, iy + 4, iy + ih - stripH);
    const out = { pad, bw, bh, rowH, stripH, x: ix, y: sy, w: iw, h: stripH, rows: showRows ? rows : [], cells: [] };
    out.toggle = { x: ix + iw - pad - bw, y: sy + (stripH - bh) / 2, w: bw, h: bh };
    let cy = sy + pad + rowH / 2;
    for (const r of out.rows) { let cx = ix + pad; for (const c of r) { out.cells.push({ kind: c.kind, name: c.name, x: cx, y: cy, w: c.w, h: rowH }); cx += c.w; } cy += rowH; }
    return out;
  }
  function drawWorldMarkers(g, narrow) {
    lastMap = null;
    const bi = buttons.findIndex(b => b.label === 'mapimage');
    if (bi < 0) return;
    const img = buttons[bi], ix = img.x, iy = img.y, iw = img.w, ih = img.h, sc = iw / MAP_W;
    const lay = legendLayout(g, ix, iy, iw, ih, narrow);
    const L = { ix, iy, iw, ih, sc, glyphs: [], strip: { x: lay.x, y: lay.y, w: lay.w, h: lay.h }, toggle: lay.toggle, cells: lay.cells };
    g.save(); roundRect(g, ix, iy, iw, ih, 8); g.clip();
    // the strip first, then the glyphs: a marker that happens to fall down here is still visible on top of it
    roundRect(g, lay.x + 2, lay.y, lay.w - 4, lay.h - 2, 8); g.fillStyle = 'rgba(8,11,17,0.86)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 1; g.stroke();
    for (const c of lay.cells) {
      drawGlyph(g, c.kind, c.x + 8, c.y, 5);
      g.fillStyle = '#c9d1d9'; g.font = 'bold 10px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(c.name, c.x + 16, c.y); g.textBaseline = 'alphabetic';
    }
    if (st().show) {
      for (const m of known()) {
        const mx = ix + (m.x + 0.5) * sc, my = iy + (m.y + 0.5) * sc;
        if (mx < ix - MAP_R || mx > ix + iw + MAP_R || my < iy - MAP_R || my > iy + ih + MAP_R) continue;
        drawGlyph(g, m.kind, mx, my, MAP_R);
        L.glyphs.push({ key: m.key, x: mx, y: my, r: MAP_R });
      }
      // the knight's own white dot again, over the glyphs, so he can always find himself
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ix + player.x / TILE * sc, iy + player.y / TILE * sc, 4, 0, 7); g.fill();
      const named = (selected && known().find(m => m.key === selected)) || (hover && known().find(m => m.key === hover));
      if (named) drawLabel(g, named, L);
    }
    g.restore();
    // the core's close-everywhere rect must not swallow taps on the key — and the key moves when a talk box
    // pushes it up, so cut the rect at where the strip actually is, not at a fixed height off the bottom
    img.h = Math.max(0, lay.y - iy);
    const close = img.action;
    img.action = () => { const m = pointer && hitAt(pointer.x, pointer.y); if (m) { selected = selected === m.key ? null : m.key; sfx('open'); } else { selected = null; close(); } };
    button(g, lay.toggle.x, lay.toggle.y, lay.toggle.w, lay.toggle.h, st().show ? 'Markers: On' : 'Markers: Off', () => setShow(!st().show), st().show ? '#238636' : '#21262d');
    buttons[buttons.length - 1].label = 'markers:toggle'; // the drawn word stays On / Off; the harness finds it by key
    lastMap = L;
  }
  function drawLabel(g, m, L) {
    const mx = L.ix + (m.x + 0.5) * L.sc, my = L.iy + (m.y + 0.5) * L.sc;
    g.font = 'bold 12px sans-serif';
    const bw = g.measureText(m.label).width + 20, bh = 22;
    let bx = clamp(mx - bw / 2, L.ix + 4, L.ix + L.iw - bw - 4), by = my - bh - 11;
    if (by < L.iy + 4) by = my + 11;
    roundRect(g, bx, by, bw, bh, 6); g.fillStyle = 'rgba(8,11,17,0.94)'; g.fill();
    g.strokeStyle = KIND[m.kind].colour; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#e6edf3'; g.textAlign = 'center'; g.fillText(m.label, bx + bw / 2, by + 15);
    g.strokeStyle = KIND[m.kind].colour; g.lineWidth = 1.5; g.beginPath(); g.arc(mx, my, MAP_R + 4, 0, 7); g.stroke();
  }
  function hitAt(sx, sy) {
    const L = lastMap; if (!L || !st().show) return null;
    let best = null;
    for (const g of L.glyphs) { const d = Math.hypot(sx - g.x, sy - g.y); if (d <= HIT && (!best || d < best.d)) best = { key: g.key, d }; }
    return best ? known().find(m => m.key === best.key) || null : null;
  }
  {
    const _drawPanels = drawPanels;
    drawPanels = function (g, narrow) { const r = _drawPanels.apply(this, arguments); if (panel === 'map') drawWorldMarkers(g, narrow); return r; };
    const _pointerDown = pointerDown;
    pointerDown = function (x, y) { pointer = { x, y }; return _pointerDown.apply(this, arguments); };
    const _pointerMove = pointerMove;
    pointerMove = function (x, y, id) {
      if (id === 'mouse' && panel === 'map' && !selected) { const m = hitAt(x, y); hover = m ? m.key : null; }
      return _pointerMove.apply(this, arguments);
    };
  }

  window.MARKERS = {
    add, all, known, KINDS, KIND, DISCOVER,
    kindsInUse, discover, state: st, show: () => st().show, setShow, toggle: toggleShow,
    refresh: () => { dirty = true; return all(); },
    rebuildWorld: buildAll,
    get: key => all().find(m => m.key === key) || null,
    at: (x, y) => all().find(m => m.x === x && m.y === y) || null,
    hitAt, layout: legendLayout, MAX_ROWS, STRIP_SHARE,
    selected: () => selected && (known().find(m => m.key === selected) || null),
    hovered: () => hover && (known().find(m => m.key === hover) || null),
    get lastMini() { return lastMini; },
    get lastMap() { return lastMap; },
  };

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'markers: ';
    const s0 = { ...st(), seen: { ...st().seen } };
    const prevPanel = panel, prevTouch = window.__forceTouch, dc = dialog.cur, dq = dialog.queue.slice();
    dialog.cur = null; dialog.queue.length = 0; paused = false; closePanel(); h.peace(true);
    if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave();
    const seeAll = () => { const s = st(); s.seen = {}; for (const m of all()) s.seen[m.key] = 1; };
    const at = (x, y) => all().find(m => m.x === x && m.y === y);
    try {
      // ---- every bank, shop and stall is on the map, at the tile a knight walks to ----
      { seeAll();
        const bank = BUILDINGS.find(b => b.id === 'bank');
        const bankM = at(bank.x + bank.door, bank.y + bank.h - 1);
        const missing = [], wrong = [];
        // Tinkerton's lab is a room of its own behind a door: its marker is the way down, under the same name
        for (const k in SHOPS) { const m = all().find(x => x.label === SHOPS[k].name); if (!m) missing.push(k); else if (m.kind !== (k === 'tinkerton' ? 'down' : 'shop')) wrong.push(k + ':' + m.kind); }
        const doorOf = id => { const b = BUILDINGS.find(b => b.id === id); return b && at(b.x + b.door, b.y + b.h - 1); };
        const store = doorOf('store'), bakery = doorOf('bakery'), smithy = doorOf('smithy');
        const greta = NPCS.find(n => n.id === 'greta'), fennick = NPCS.find(n => n.id === 'fennick');
        const stalls = STALLS.every(s2 => { const n = NPCS.find(x => x.id === s2.npc); return !!at(n.x, n.y); });
        const pete = at(PETE.x, PETE.y);
        check(P + 'every shop in SHOPS has a marker, the village shops sit on their doors, both stalls are marked and the bank is the bank door',
          missing.length === 0 && wrong.length === 0
          && !!bankM && bankM.kind === 'bank' && bankM.label === bank.name
          && !!store && store.label === SHOPS.general.name && !!bakery && bakery.label === SHOPS.bakery.name && !!smithy && smithy.label === SHOPS.smith.name
          && stalls && !!at(greta.x, greta.y) && at(greta.x, greta.y).label === SHOPS.seeds.name && !!at(fennick.x, fennick.y)
          && !!pete && pete.kind === 'shop' && pete.label === SHOPS.saltpete.name && regionAt(PETE.x, PETE.y).name === 'Gull Isle',
          { missing, wrong, bank: bankM && bankM.label, pete: pete && pete.label, peteRegion: regionAt(PETE.x, PETE.y).name, total: all().length }); }
      // ---- every instance door, every shaft, ladder and shrine ----
      { const doors = [], bad = [];
        for (const id of INSTANCES.list()) { const inst = INSTANCES.get(id); if (!inst.door) continue; doors.push(id); const m = at(inst.door[0], inst.door[1]); if (!m || m.kind !== 'down' || m.label !== inst.name) bad.push(id + ':' + (m ? m.kind + '/' + m.label : 'none')); }
        const tileMark = (name, kind) => { const t = tileId(name); if (t === null) return 'no tile'; for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (map[idx(x, y)] === t) { const m = at(x, y); return m && m.kind === kind ? true : 'missing at ' + x + ',' + y; } return 'no such tile on the map'; };
        const shaft = tileMark('SHAFT', 'down'), ladder = tileMark('LADDER_UP', 'up'), shrine = tileMark('WIND_SHRINE', 'up'), cart = tileMark('COAL_CART', 'down');
        const cartAt = window.COALMINE && at(COALMINE.CART_T.x, COALMINE.CART_T.y); // 53-coalmine picks the berth at world-gen
        const ups = all().filter(m => m.kind === 'up').length, downs = all().filter(m => m.kind === 'down').length, docks = all().filter(m => m.kind === 'dock').length;
        check(P + 'every instance door is a way down under the name of the place, and the mine shaft, the Deepholm ladder, the wind shrine and the coal cart are all marked; every mooring is a dock',
          doors.length >= 2 && bad.length === 0 && shaft === true && ladder === true && shrine === true && cart === true
          && !!cartAt && cartAt.kind === 'down' && ups >= 2 && downs >= doors.length + 2 && docks === 4,
          { doors, bad, shaft, ladder, shrine, cart, cartAt: cartAt && [cartAt.x, cartAt.y], ups, downs, docks }); }
      // ---- quest givers ----
      { const boardId = tileId('BOARD'); const boards = [];
        for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (map[idx(x, y)] === boardId) boards.push([x, y]);
        const boardsMarked = boards.length >= 2 && boards.every(([x, y]) => { const m = at(x, y); return m && m.kind === 'quest'; });
        const givers = ['duke', 'tobin', 'wren', 'captain', 'brann', 'tam'];
        const bad = [];
        for (const id of givers) { const n = NPCS.find(x => x.id === id); if (!n) { bad.push(id + ':gone'); continue; } const sp = spotFor(n); const m = at(sp.x, sp.y); if (!m || m.kind !== 'quest' || m.label !== n.name) bad.push(id + ':' + (m ? m.kind + '/' + m.label : 'none')); }
        const nell = NPCS.find(n => n.id === 'nell'); const onlyLeader = !nell || !at(nell.x, nell.y); // one marker for the huddle, not four
        check(P + 'both notice boards and the folk who hand out work (the Duke, Tobin, Wren, the Captain, the Warden, Old Tam) are quest markers; a huddle of survivors is one marker',
          boardsMarked && bad.length === 0 && onlyLeader, { boards, bad, onlyLeader }); }
      // ---- a marker stays hidden until the knight has been near it ----
      { const s = st(); const spot = h.openSpot(40, 24);
        const m = all().find(x => x.kind === 'bank') || all()[0];
        if (!m) throw new Error('no markers to hide');
        delete s.seen[m.key];
        F.tp(spot.x, spot.y); F.step([]); discover();
        const hiddenFar = !known().some(x => x.key === m.key);
        F.tp(m.x + DISCOVER + 3, m.y); discover();
        const stillHidden = !known().some(x => x.key === m.key);
        F.tp(m.x + DISCOVER - 2, m.y); discover();
        const foundNear = known().some(x => x.key === m.key);
        // and a hidden marker is not drawn on the minimap either
        delete s.seen[m.key]; F.tp(spot.x, spot.y); render();
        const notOnMini = !lastMini.some(p => p.key === m.key);
        s.seen[m.key] = 1; F.tp(m.x, m.y); render();
        const onMini = lastMini.some(p => p.key === m.key) && lastMini.length > 0;
        check(P + `a marker is hidden until the knight comes within ${DISCOVER} tiles of its tile, and a hidden one is not drawn on the minimap`,
          !!m && hiddenFar && stillHidden && foundNear && notOnMini && onMini,
          { marker: m && m.label, hiddenFar, stillHidden, foundNear, notOnMini, onMini, mini: lastMini.length }); }
      // ---- discovery survives save and load ----
      { const s = st(); const far = h.openSpot(40, 24); F.tp(far.x, far.y); F.step([]);
        const list = all().filter(m => Math.hypot(m.x - far.x, m.y - far.y) > DISCOVER + 4);
        const m = list[0], m2 = list[list.length - 1];
        if (!m || !m2 || m === m2) throw new Error('not enough markers away from ' + far.x + ',' + far.y);
        s.seen = {}; s.seen[m.key] = 1; s.show = false; save();
        quest.markers = { seen: {}, show: true };
        const cleared = !known().some(x => x.key === m.key);
        const ok = load(); F.sim(2, []);
        const kept = known().some(x => x.key === m.key), notKept = !known().some(x => x.key === m2.key);
        const showKept = st().show === false;
        st().show = true;
        // walking up to a place writes it down there and then, not at the next autosave
        delete st().seen[m2.key]; F.tp(far.x, far.y); save();
        const before = JSON.parse(localStorage.getItem(SAVE_KEY));
        const beforeHad = !!(before.quest.markers && before.quest.markers.seen[m2.key]);
        F.tp(m2.x, m2.y); discover();
        const after = JSON.parse(localStorage.getItem(SAVE_KEY));
        const wroteItself = !!(after.quest.markers && after.quest.markers.seen[m2.key]);
        check(P + 'what the knight has found (and whether markers are shown) is saved and comes back on load, nothing he has not found comes with it, and a new find is written down the moment he makes it',
          ok && !!m && !!m2 && m !== m2 && cleared && kept && notKept && showKept && !beforeHad && wroteItself,
          { ok, cleared, kept, notKept, showKept, beforeHad, wroteItself, one: m && m.label, other: m2 && m2.label }); }
      // ---- the legend lists the kinds that are on the map, and nothing else ----
      { const s = st(); st().show = true;
        // only two kinds found so far: the legend must show two rows, not seven
        const want = ['bank', 'dock'];
        s.seen = {}; for (const m of all()) if (want.includes(m.kind)) s.seen[m.key] = 1;
        openPanel('map'); render();
        const few = (lastMap ? lastMap.cells : []).map(c => c.kind).sort();
        seeAll(); render();
        const many = (lastMap ? lastMap.cells : []).map(c => c.kind).sort();
        const fromMarkers = [...new Set(known().map(m => m.kind))].sort();
        const allSeven = KINDS.every(k => fromMarkers.includes(k.id));
        // one lodestone of the knight's own, put down at play, is a marker too
        const lodeBefore = all().filter(m => m.kind === 'lodestone').length;
        const o = h.openSpot(44, 26); changeTile(o.x, o.y, T.LODESTONE); MARKERS.refresh(); const lode = at(o.x, o.y);
        changeTile(o.x, o.y, T.GRASS); MARKERS.refresh();
        const gone = !at(o.x, o.y) && all().filter(m => m.kind === 'lodestone').length === lodeBefore;
        check(P + 'the legend lists exactly the kinds the knight has found — two when he has found two, all seven when he has found them all; a lodestone put down at play becomes a marker and goes when it goes',
          few.join() === want.join() && many.join() === fromMarkers.join() && many.length === KINDS.length && allSeven && !!lode && lode.kind === 'lodestone' && gone,
          { few, many, fromMarkers, allSeven, lode: !!lode, gone }); }
      // ---- the toggle in the world map hides and shows them ----
      { seeAll(); st().show = true; openPanel('map'); render();
        if (!lastMap) throw new Error('the world map drew no marker layer');
        const on = lastMap.glyphs.length; const wasOn = st().show;
        const clicked = F.clickButton('markers:toggle'); render();
        const offState = st().show;                              // read now: the flag is flipped back further down
        const off = lastMap.glyphs.length, offMini = (drawHud(ctx), lastMini.length);
        const legendGone = lastMap.cells.length === 0 && !!lastMap.toggle;
        const back = F.clickButton('markers:toggle'); render();
        const onState = st().show, onAgain = lastMap.glyphs.length;
        check(P + 'the Markers toggle in the world map panel hides every glyph (map, minimap and legend) and brings them back',
          wasOn && on > 5 && clicked && offState === false && off === 0 && offMini === 0 && legendGone && back && onState === true && onAgain === on,
          { on, off, offMini, legendGone, onAgain, wasOn, clicked, offState, back, onState }); }
      // ---- tapping a marker names it; the mouse hovering one names it too ----
      { seeAll(); st().show = true; openPanel('map'); render();
        const L = lastMap;
        if (!L || !L.glyphs.length) throw new Error('no glyph on the world map to tap');
        const g0 = L.glyphs[Math.floor(L.glyphs.length / 2)]; const want = known().find(m => m.key === g0.key);
        pointerDown(g0.x, g0.y, 'mouse'); render();
        const named = MARKERS.selected(); const stillOpen = panel === 'map';
        pointerDown(g0.x, g0.y, 'mouse'); render(); const untapped = MARKERS.selected() === null && panel === 'map';
        pointerMove(g0.x, g0.y, 'mouse'); const hovered = MARKERS.hovered();
        pointerMove(L.ix + 2, L.iy + 2, 'mouse'); const unhovered = MARKERS.hovered() === null;
        // a tap on the key itself is absorbed by the panel: it must not close the map out from under a reader
        render(); const K = lastMap;
        const keyPt = { x: K.strip.x + 20, y: K.strip.y + K.strip.h / 2 };
        const clearOfToggle = keyPt.x < K.toggle.x;
        pointerDown(keyPt.x, keyPt.y, 'mouse'); render();
        const keyKept = panel === 'map' && st().show === true;
        // a tap on empty map still closes the panel, the way it always did
        const empty = { x: L.ix + L.iw - 4, y: L.iy + 4 };
        const far = !L.glyphs.some(p => Math.hypot(p.x - empty.x, p.y - empty.y) <= HIT);
        pointerDown(empty.x, empty.y, 'mouse'); const closed = panel === null;
        check(P + 'a tap on a marker names it (and a second tap clears it); the mouse hovering one names it; a tap on the key is absorbed; a tap on empty map still closes the map',
          !!named && named.key === g0.key && named.label === want.label && stillOpen && untapped && !!hovered && hovered.key === g0.key && unhovered && clearOfToggle && keyKept && far && closed,
          { named: named && named.label, stillOpen, untapped, hovered: hovered && hovered.label, unhovered, keyKept, closed }); }
      // ---- MARKERS.add is a registry another feature can use ----
      { const before = all().length;
        const spot = h.openSpot(48, 30);
        const m = MARKERS.add({ x: spot.x, y: spot.y, kind: 'quest', label: 'Test post' });
        const dup = MARKERS.add({ x: spot.x, y: spot.y, kind: 'bank', label: 'Second' });
        const bad = MARKERS.add({ x: spot.x + 4, y: spot.y, kind: 'nonsense', label: 'No' });
        const listed = !!at(spot.x, spot.y) && at(spot.x, spot.y).label === 'Test post' && all().length === before + 1;
        extra.length = 0; dirty = true;
        check(P + 'MARKERS.add registers a place for another feature: one marker to a tile, an unknown kind is refused',
          !!m && dup === null && bad === null && listed && all().length === before, { listed, after: all().length, before }); }
      // ---- layout: nothing overlaps, nothing off-screen, at four viewports ----
      { seeAll(); st().show = true;
        const own = k => Object.getOwnPropertyDescriptor(window, k);
        const saved = { w: own('innerWidth'), h: own('innerHeight') };
        const setSize = (w, hh) => { try { window.innerWidth = w; window.innerHeight = hh; } catch (e) { } render(); return VW === w && VH === hh; };
        const inside = r => r.x >= 0 && r.y >= 0 && r.x + r.w <= VW && r.y + r.h <= VH;
        const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        const problems = []; let tried = 0;
        for (const [w, hh] of [[390, 844], [844, 390], [768, 1024], [1280, 800]]) {
          if (!setSize(w, hh)) continue; tried++;
          openPanel('map'); render();
          const L = lastMap;
          if (!L) { problems.push(`${w}x${hh}: nothing drawn`); continue; }
          if (!inside(L.toggle)) problems.push(`${w}x${hh}: toggle off-screen`);
          if (!inside(L.strip)) problems.push(`${w}x${hh}: legend strip off-screen`);
          if (!L.glyphs.length) problems.push(`${w}x${hh}: no markers drawn`);
          // the panel's own buttons (from the × onward): none may overlap another
          const ci = buttons.findIndex(b => b.label === '×');
          const rects = buttons.slice(Math.max(0, ci)).filter(b => b.w > 0 && b.h > 0);
          for (const r of rects) if (!inside(r)) problems.push(`${w}x${hh}: ${r.label} off-screen`);
          for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (overlap(rects[i], rects[j])) problems.push(`${w}x${hh}: ${rects[i].label} × ${rects[j].label}`);
          // no glyph may sit under the toggle button, and every legend cell must stay inside the strip
          for (const gl of L.glyphs) { const r = { x: gl.x - gl.r, y: gl.y - gl.r, w: gl.r * 2, h: gl.r * 2 }; if (overlap(r, L.toggle)) problems.push(`${w}x${hh}: marker ${gl.key} under the toggle`); }
          for (const c of L.cells) { const r = { x: c.x, y: c.y - c.h / 2, w: c.w, h: c.h }; if (!(r.x >= L.strip.x && r.x + r.w <= L.strip.x + L.strip.w + 1 && r.y >= L.strip.y && r.y + r.h <= L.strip.y + L.strip.h + 1)) problems.push(`${w}x${hh}: legend cell ${c.kind} outside the strip`); }
          // a talk box over the foot of the map must not bury the key or its button: they lift clear of it
          say('A'.repeat(150) + ' ' + 'word '.repeat(20), 'The Voice'); F.step([]); render(); render();
          const D = dialogRect && { ...dialogRect }; const L2 = lastMap;
          if (!D) problems.push(`${w}x${hh}: no talk box drawn`);
          else if (!L2) problems.push(`${w}x${hh}: no marker layer under a talk box`);
          else {
            if (overlap(L2.toggle, D)) problems.push(`${w}x${hh}: the toggle is under the talk box`);
            if (overlap(L2.strip, D)) problems.push(`${w}x${hh}: the key is under the talk box`);
            if (L2.strip.y < L2.iy - 0.01 || L2.strip.y + L2.strip.h > L2.iy + L2.ih + 0.01) problems.push(`${w}x${hh}: the key left the map`);
            const ci2 = buttons.findIndex(b => b.label === '×');
            const r2 = buttons.slice(Math.max(0, ci2)).filter(b => b.w > 0 && b.h > 0);
            for (let i = 0; i < r2.length; i++) for (let j = i + 1; j < r2.length; j++) if (overlap(r2[i], r2[j])) problems.push(`${w}x${hh} with a talk box: ${r2[i].label} × ${r2[j].label}`);
          }
          dialog.cur = null; dialog.queue.length = 0; render();
          closePanel();
        }
        if (saved.w) { Object.defineProperty(window, 'innerWidth', saved.w); Object.defineProperty(window, 'innerHeight', saved.h); }
        render();
        check(P + 'world map: legend, toggle and every glyph fit, and no two panel buttons overlap, at 390x844, 844x390, 768x1024 and 1280x800',
          tried === 4 && problems.length === 0, { tried, problems: problems.slice(0, 8) }); }
      // ---- the key stays a key: real letter widths (the headless canvas measures every string as 10 px) ----
      { seeAll(); st().show = true;
        const fake = { font: '', measureText: t => ({ width: String(t).length * 6.2 }) }; // about bold 10px sans-serif
        const sizes = [[314, 217], [724, 250], [692, 479], [724, 501]];  // the map image at 390x844, 844x390, 768x1024, 1280x800
        const want = kindsInUse().map(k => k.id).sort().join();
        const bad = []; let widest = 0;
        for (const [iw, ih] of sizes) for (const narrow of [true, false]) {
          const L = MARKERS.layout(fake, 0, 0, iw, ih, narrow);
          widest = Math.max(widest, L.h / ih);
          if (L.h > Math.max(42, ih * STRIP_SHARE) + 0.01) bad.push(`${iw}x${ih}: strip ${Math.round(L.h)} of ${ih}`);
          if (L.rows.length > MAX_ROWS) bad.push(`${iw}x${ih}: ${L.rows.length} rows`);
          if (!L.rows.length) bad.push(`${iw}x${ih}: no key at all`);
          if (L.cells.map(c => c.kind).sort().join() !== want) bad.push(`${iw}x${ih}: key lists ${L.cells.length} of 7`);
          if (L.toggle.x + L.toggle.w > L.x + L.w + 0.01) bad.push(`${iw}x${ih}: toggle outside the strip`);
          for (const c of L.cells) {
            if (c.x < L.x - 0.01 || c.x + c.w > L.toggle.x + 0.01) bad.push(`${iw}x${ih}: cell ${c.kind} runs into the toggle`);
            if (c.y - c.h / 2 < L.y - 0.01 || c.y + c.h / 2 > L.y + L.h + 0.01) bad.push(`${iw}x${ih}: cell ${c.kind} outside the strip`);
          }
        }
        check(P + `the key names every kind in use, keeps clear of the toggle, stays inside its strip and never takes more than a third of the map, at real letter widths and all four viewports`,
          bad.length === 0, { bad: bad.slice(0, 6), deepest: +widest.toFixed(2) }); }
      // ---- nothing of the overworld leaks into a dungeon ----
      { seeAll(); closePanel(); const before = all().length;
        F.tp(23, 3); F.face(22, 3); F.press('KeyE'); F.sim(2, []);
        const inside = INSTANCES.active() === 'spider_den';
        render(); const miniInside = lastMini.length;
        const n0 = Object.keys(st().seen).length; discover(); const noNewFinds = Object.keys(st().seen).length === n0;
        if (inside) INSTANCES.leave(); F.sim(2, []); render();
        check(P + 'inside a dungeon the overworld markers are not drawn and nothing new is discovered; they come back outside',
          inside && miniInside === 0 && noNewFinds && all().length === before && lastMini.length > 0,
          { inside, miniInside, noNewFinds, after: all().length, before, outside: lastMini.length }); }
    } catch (e) {
      // a throw in here would take the whole suite down with it: report it as the failure it is
      check(P + 'the marker checks ran to the end without throwing', false, { error: String(e && e.message || e) });
    } finally {
      if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave();
      quest.markers = { seen: { ...s0.seen }, show: s0.show };
      extra.length = 0; dirty = true; selected = null; hover = null;
      panel = prevPanel; window.__forceTouch = prevTouch; h.peace(false);
      dialog.cur = dc; dialog.queue.length = 0; dialog.queue.push(...dq);
      notice = null; save(); render();
    }
  });
}
