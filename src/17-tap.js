// ============================================================================
// TAP-TO-MOVE — point-and-click, RuneScape style, for iPads and mice. Additive: the joystick and the keys are untouched.
// 05-input records a press (pointerDown) and hands it to tapRelease (pointerUp); a still finger becomes a tap, a moved one
// was a joystick drag. The player-movement block in 07-update asks tapVector(dt) for a direction when no key or stick is
// active and calls tapCancel('manual') when one is. Everything else (chasing, using, chopping until the tree falls,
// the marker, the long-press label) lives in the update / draw / hud hooks below.
// State: player.walkPath (the tile path, saved harmlessly) + player.tapTarget (monster index) mirror the module `tap`.
// ============================================================================
const tap = {
  path: null,        // [[tx, ty], ...] remaining waypoints; the same array as player.walkPath
  kind: null,        // 'walk' | 'item' | 'npc' | 'use' | 'monster'
  target: null,      // monster (kind monster) or npc (kind npc)
  goal: null,        // {tx, ty} tile the path was built for
  goalPx: null,      // exact pixel the last waypoint should land on (drops)
  useTile: null,     // {tx, ty, t} for kind 'use'
  gather: null,      // {tx, ty, t} while a chop / mine / fish keeps re-issuing
  marker: null,      // {x, y, t, color} the ring at the destination
  label: null,       // {text, x, y} long-press context label
  blockedT: 0, repathed: false, wantMove: false, lastX: 0, lastY: 0, repathT: 0, reissueT: 0, reissues: 0,
  lastTap: null,     // {x, y, at} for double-tap
};
// Feature people. Files with their own NPC lists (24-dwarves, 25-elves, 33-goblincity's townsfolk, 41-guild's staff, 36-skycity's winged folk)
// push one function here that returns the live list [{ x, y, r, id, name, talk }] in pixels — empty when out of reach (inside a dungeon,
// or before the guild has staff). talk() is the same call the feature's E handler makes, so a tap opens exactly the line E opens.
const TAP_PEOPLE = [];
function tapPeople() { const out = []; TAP_PEOPLE.forEach((f, li) => { const l = f(); if (l) for (const p of l) if (p && p.talk) { p.list = li; out.push(p); } }); return out; } // list + id name one person (ids repeat across features: the guild's Pip, the goblins' pip)
// the winged folk export their list and talk handler on window.SKYCITY (they are only reachable inside the Aerie instance)
TAP_PEOPLE.push(() => (window.SKYCITY && window.INSTANCES && INSTANCES.active() === 'aerie') ? SKYCITY.SKY_NPCS.map(n => ({ x: n.px, y: n.py, r: 13, id: n.id, name: n.name, talk: () => SKYCITY.talk(n) })) : []);
const TAP_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const TAP_WALLS = new Set([T.WALL, T.HWALL, T.CWALL, T.FENCE, T.STALL, T.TABLE, T.SHELF]);
const TAP_NAMES = { TREE: 'Tree', OAK: 'Oak', ROCK: 'Rock', IRON: 'Iron rock', COAL: 'Coal rock', WATER: 'Water', FIRE: 'Fire', OVEN: 'Oven', ANVIL: 'Anvil', FORGE: 'Forge', WORKBENCH: 'Workbench', WORKSHOP: "Tinker's table", ALCHEMY: 'Alchemy table', CHEST: 'Chest', SIGN: 'Signpost', DUMMY: 'Training dummy', GRAVE: 'Gravestone', SOIL: 'Tilled soil', CROP: 'Crop', BED: 'Bed', LODESTONE: 'Lodestone', WRECK: 'Wrecked walker', MECH: 'Goblin walker', CART: "Miners' cart", AXESTUMP: 'Axe in a stump', STONECIRCLE: 'Standing stones', GOLDPILE: "Death's gold", TRAP: 'Goblin trap', STUMP: 'Stump', RUBBLE: 'Rubble', PLANK: 'Plank', DOOR: 'Door', GATE: 'Gate', PORTCULLIS: 'Portcullis', COFFINDOOR: 'Coffin door', COUNTER: 'Counter', THRONE: 'Throne', TABLE: 'Table', SHELF: 'Shelf', STALL: 'Stall', WALL: 'Wall', HWALL: 'Wall', CWALL: 'Wall', FENCE: 'Fence', FLOWERS: 'Flowers', MUSHROOM: 'Mushrooms', ASHES: 'Ashes', GRASS: 'Grass', DIRT: 'Dirt', SAND: 'Sand', COBBLE: 'Cobbles', FLOOR: 'Floor', CAVE: 'Cave floor', RUG: 'Rug' };
let _tapTileNames = null;
function tapTileName(t) {
  if (!_tapTileNames || _tapTileNames.n !== Object.keys(T).length) { _tapTileNames = { n: Object.keys(T).length, by: {} }; for (const k in T) _tapTileNames.by[T[k]] = k; }
  const k = _tapTileNames.by[t]; if (!k) return 'Ground';
  if (TAP_NAMES[k]) return TAP_NAMES[k];
  const w = k.replace(/^T_/, '').toLowerCase().replace(/_/g, ' '); return w.charAt(0).toUpperCase() + w.slice(1);
}
// 4-neighbour BFS in a 61×61 window around the start; SOLID (for `who`) blocks except the goal tile. Returns waypoints after the start tile, goal last.
function tapBfs(sx, sy, gx, gy, who) {
  const R = 30, x0 = Math.max(0, sx - R), y0 = Math.max(0, sy - R), x1 = Math.min(MAP_W - 1, sx + R), y1 = Math.min(MAP_H - 1, sy + R);
  if (gx < x0 || gx > x1 || gy < y0 || gy > y1 || !inMap(sx, sy)) return null;
  const W = x1 - x0 + 1, H = y1 - y0 + 1;
  const prev = new Int32Array(W * H).fill(-1), q = new Int32Array(W * H); let qh = 0, qt = 0;
  const s = (sy - y0) * W + (sx - x0), goal = (gy - y0) * W + (gx - x0);
  prev[s] = s; q[qt++] = s;
  while (qh < qt) {
    const c = q[qh++]; if (c === goal) break;
    const cx = c % W, cy = (c / W) | 0;
    for (const [dx, dy] of TAP_DIRS) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx; if (prev[n] !== -1) continue;
      if (n !== goal && solidFor(map[idx(nx + x0, ny + y0)], who)) continue;
      prev[n] = c; q[qt++] = n;
    }
  }
  if (prev[goal] === -1) return null;
  const path = []; let c = goal; while (c !== s) { path.push([c % W + x0, ((c / W) | 0) + y0]); c = prev[c]; }
  return path.reverse();
}
const tapWho = () => (typeof playerWho === 'function' ? playerWho() : 'player');
const tapTile = () => ({ tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) });
const tapActive = () => !!(tap.kind || tap.gather || tap.path || player.walkPath || player.tapTarget != null); // 07-update: any manual input cancels all of it
function tapSetPath(path) { tap.path = path; player.walkPath = path; tap.blockedT = 0; tap.wantMove = false; }
function tapCancel(why) {
  tap.path = null; player.walkPath = null; player.tapTarget = null;
  tap.kind = null; tap.target = null; tap.goal = null; tap.goalPx = null; tap.useTile = null; tap.gather = null;
  tap.blockedT = 0; tap.repathed = false; tap.wantMove = false; tap.reissues = 0;
  if (why === 'manual' || why === 'dead') { tap.marker = null; tap.label = null; }
  else if (tap.marker) tap.marker.fade = true;
}
// path to a tile; adjacent = stop on the tile before it (the nearest reachable neighbour, which BFS finds by itself)
function tapPathTo(tx, ty, adjacent) {
  const own = tapTile();
  let path = tapBfs(own.tx, own.ty, tx, ty, tapWho());
  if (!path) return null;
  if (adjacent) path.pop();
  if (path.length && path[path.length - 1][0] === own.tx && path[path.length - 1][1] === own.ty) path.pop();
  return path;
}
function tapFace(x, y) { const dx = x - player.x, dy = y - player.y, d = Math.hypot(dx, dy) || 1; player.facing = { x: dx / d, y: dy / d }; }
function tapReach(m) { const w = weaponDef(); return (player.mech ? 70 : w && w.weapon.ranged ? 3 * TILE : w ? 58 : 36) + (m ? m.r : 0) - 6; }
// what is under a screen point: monster (r + 8 px), npc (20 px), drop (16 px), else the tile
function tapPick(sx, sy) {
  const wx = sx + cam.x, wy = sy + cam.y, tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  let best = null;
  for (const m of monsters) { if (m.dead) continue; const d = dist(wx, wy, m.x, m.y); if (d <= m.r + 8 && (!best || d < best.d)) best = { d, monster: m }; }
  if (best) return { kind: 'monster', monster: best.monster, wx, wy, tx, ty };
  for (const n of NPCS) { const d = dist(wx, wy, n.px, n.py); if (d <= 20 && (!best || d < best.d)) best = { d, npc: n }; }
  if (best) return { kind: 'npc', npc: best.npc, wx, wy, tx, ty };
  for (const p of tapPeople()) { const d = dist(wx, wy, p.x, p.y); if (d <= 20 && (!best || d < best.d)) best = { d, person: p }; }
  if (best) return { kind: 'person', person: best.person, wx, wy, tx, ty };
  for (const d of drops) { const dd = dist(wx, wy, d.x, d.y); if (dd <= 16 && (!best || dd < best.d)) best = { d: dd, drop: d }; }
  if (best) return { kind: 'item', drop: best.drop, wx, wy, tx, ty };
  if (!inMap(tx, ty)) return null;
  const t = tileAt(tx, ty);
  if (PUSH_THROUGH.has(t) && !solidFor(t, tapWho())) return { kind: 'walk', wx, wy, tx, ty, t };
  if (TAP_WALLS.has(t)) return { kind: 'wall', wx, wy, tx, ty, t };
  if (INTERESTING(t) || SOLID.has(t) || PUSH_THROUGH.has(t)) return { kind: 'use', wx, wy, tx, ty, t };
  return { kind: 'walk', wx, wy, tx, ty, t };
}
function tapLabelFor(p) {
  if (!p) return null;
  if (p.kind === 'monster') { const def = MONSTER_DEFS[p.monster.type]; return `${def.name} · lv ${def.level}`; }
  if (p.kind === 'npc') return p.npc.name;
  if (p.kind === 'person') return p.person.name;
  if (p.kind === 'item') { const def = ITEMS[p.drop.id]; return def ? (p.drop.qty > 1 ? `${def.name} × ${p.drop.qty}` : def.name) : 'Something'; }
  const b = buildingAt(p.tx, p.ty); const t = p.t;
  if (b && (TAP_WALLS.has(t) || PUSH_THROUGH.has(t))) return b.name || tapTileName(t);
  return tapTileName(t);
}
function tapMark(x, y, color) { tap.marker = { x, y, t: 0, color, fade: false }; }
// a real tap (or a long-press release) at a screen point
function tapAt(sx, sy) {
  if (player.dead || paused || (typeof title !== 'undefined' && title.active)) return false;
  const p = tapPick(sx, sy); if (!p) return false;
  // double-tap anywhere = swing the way you face (touch keeps its SWING button too)
  if (tap.lastTap && time - tap.lastTap.at < 0.3 && dist(sx, sy, tap.lastTap.x, tap.lastTap.y) < 30) { tap.lastTap = null; playerAttack(); return true; }
  tap.lastTap = { x: sx, y: sy, at: time };
  const own = tapTile();
  if (p.kind === 'walk' && p.tx === own.tx && p.ty === own.ty) return false; // your own tile: nothing
  tapCancel('retarget');
  let path = null;
  if (p.kind === 'monster') {
    const m = p.monster; path = tapPathTo(Math.floor(m.x / TILE), Math.floor(m.y / TILE), false);
    if (!path && dist(player.x, player.y, m.x, m.y) > tapReach(m)) { notify("You can't get there."); return false; }
    tap.kind = 'monster'; tap.target = m; player.tapTarget = monsters.indexOf(m); tap.goal = { tx: Math.floor(m.x / TILE), ty: Math.floor(m.y / TILE) }; tapSetPath(path || []); tapMark(m.x, m.y, '#ff6b6b'); return true;
  }
  if (p.kind === 'npc') {
    const n = p.npc; path = tapPathTo(Math.floor(n.px / TILE), Math.floor(n.py / TILE), true);
    if (!path && dist(player.x, player.y, n.px, n.py) > 64) { notify("You can't get there."); return false; }
    tap.kind = 'npc'; tap.target = n; tap.goal = { tx: Math.floor(n.px / TILE), ty: Math.floor(n.py / TILE) }; tapSetPath(path || []); tapMark(n.px, n.py, '#f5c542'); return true;
  }
  if (p.kind === 'person') {
    const q = p.person; path = tapPathTo(Math.floor(q.x / TILE), Math.floor(q.y / TILE), true);
    if (!path && dist(player.x, player.y, q.x, q.y) > 64) { notify("You can't get there."); return false; }
    tap.kind = 'person'; tap.target = q; tap.goal = { tx: Math.floor(q.x / TILE), ty: Math.floor(q.y / TILE) }; tapSetPath(path || []); tapMark(q.x, q.y, '#f5c542'); return true;
  }
  if (p.kind === 'item') {
    const d = p.drop; path = tapPathTo(Math.floor(d.x / TILE), Math.floor(d.y / TILE), false);
    if (!path) { notify("You can't get there."); return false; }
    tap.kind = 'item'; tap.target = d; tap.goal = { tx: p.tx, ty: p.ty }; tap.goalPx = { x: d.x, y: d.y }; tapSetPath(path); tapMark(d.x, d.y, '#ffffff'); return true;
  }
  if (p.kind === 'use') {
    path = tapPathTo(p.tx, p.ty, true);
    if (!path) { notify("You can't get there."); return false; }
    tap.kind = 'use'; tap.useTile = { tx: p.tx, ty: p.ty, t: p.t }; tap.goal = { tx: p.tx, ty: p.ty }; tapSetPath(path); tapMark(tc(p.tx), tc(p.ty), '#f5c542'); return true;
  }
  // plain ground (or a wall: stop beside it)
  path = tapPathTo(p.tx, p.ty, p.kind === 'wall' || solidFor(p.t, tapWho()));
  if (!path) { notify("You can't get there."); return false; }
  tap.kind = 'walk'; tap.goal = { tx: p.tx, ty: p.ty }; tapSetPath(path); tapMark(tc(p.tx), tc(p.ty), '#ffffff'); return true;
}
// 05-input: pointerUp hands the finished press here. A press that moved ≥ 10 px was a drag (joystick), never a tap.
function tapRelease(p) {
  tap.label = null;
  if (!p || p.moved >= 10) return false;
  const held = Math.max(p.held || 0, (nowMs() - p.t0) / 1000);
  if (held > 0.25 && held < 0.4) return false; // neither a tap nor a long-press
  return tapAt(p.x, p.y);
}
// 07-update: the direction to walk this tick (null when there is no path). Clamped so the last step lands on the waypoint.
function tapVector(dt) {
  if (!tap.path || tap.path !== player.walkPath) { if (player.walkPath || tap.path) tapCancel('stale'); return null; }
  while (tap.path.length) {
    const [wx, wy] = tap.path[0]; const last = tap.path.length === 1 && tap.goalPx;
    const gx = last ? tap.goalPx.x : tc(wx), gy = last ? tap.goalPx.y : tc(wy);
    const dx = gx - player.x, dy = gy - player.y, d = Math.hypot(dx, dy);
    if (d < (tap.path.length === 1 ? 5 : 8)) { tap.path.shift(); continue; }
    const step = player.speed * dt || 1; tap.wantMove = true; tap.lastX = player.x; tap.lastY = player.y;
    return { x: dx / d, y: dy / d, m: Math.min(1, d / step) };
  }
  return null;
}
function tapUseNow() {
  const u = tap.useTile; if (!u) return;
  tapFace(tc(u.tx), tc(u.ty));
  const t = tileAt(u.tx, u.ty);
  useAction();
  if (GATHER[t] || t === T.WATER) { tap.gather = { tx: u.tx, ty: u.ty, t }; tap.reissues = 0; tap.reissueT = 0.4; }
  tap.kind = null; tap.useTile = null; tap.goal = null; tapSetPath(null); player.walkPath = null; if (tap.marker) tap.marker.fade = true;
}
HOOKS.update.push(dt => {
  // the press timer for long-press labels (wall clock is a fallback: the test harness ticks dt, the browser ticks both)
  if (touch.press) {
    const p = touch.press; p.held = (p.held || 0) + dt;
    const held = Math.max(p.held, (nowMs() - p.t0) / 1000);
    if (held > 8) touch.press = null;
    else if (p.moved < 10 && held >= 0.4 && !tap.label && !paused) { const pk = tapPick(p.x, p.y); const onStick = touch.stickId === p.id && (!pk || pk.kind === 'walk' || pk.kind === 'wall'); const text = onStick ? null : tapLabelFor(pk); if (text) tap.label = { text, x: p.x, y: p.y }; } // a still thumb on the stick over plain ground is not a question
  }
  if (tap.marker) { tap.marker.t += dt; if (tap.marker.fade && tap.marker.t > 0.6) tap.marker = null; }
  if (player.dead) { if (tap.kind || tap.gather || tap.path) tapCancel('dead'); return; }
  if (tap.path && tap.path !== player.walkPath) tapCancel('stale');
  tap.repathT = Math.max(0, tap.repathT - dt); tap.reissueT = Math.max(0, tap.reissueT - dt);
  // blocked for more than half a second: re-path once from where we stand, then give up
  if (tap.wantMove && tap.path) {
    tap.wantMove = false;
    if (dist(player.x, player.y, tap.lastX, tap.lastY) < 0.3) tap.blockedT += dt; else tap.blockedT = 0;
    if (tap.blockedT > 0.5) {
      tap.blockedT = 0;
      if (tap.repathed || !tap.goal) { tapCancel('blocked'); return; }
      tap.repathed = true; const adj = tap.kind === 'use' || tap.kind === 'npc' || tap.kind === 'person'; const np = tapPathTo(tap.goal.tx, tap.goal.ty, adj);
      if (!np) { tapCancel('blocked'); return; } tapSetPath(np);
    }
  }
  if (tap.kind === 'monster') {
    const m = tap.target;
    if (!m || m.dead) { tapCancel('done'); return; }
    if (tap.marker) { tap.marker.x = m.x; tap.marker.y = m.y; }
    const d = dist(player.x, player.y, m.x, m.y);
    if (d <= tapReach(m)) { if (tap.path && tap.path.length) tapSetPath([]); tapFace(m.x, m.y); player.moving = false; if (player.attackCd <= 0) playerAttack(); }
    else {
      const gt = { tx: Math.floor(m.x / TILE), ty: Math.floor(m.y / TILE) };
      if ((!tap.path || !tap.path.length || gt.tx !== tap.goal.tx || gt.ty !== tap.goal.ty) && tap.repathT <= 0) {
        tap.repathT = 0.25; const np = tapPathTo(gt.tx, gt.ty, false);
        if (np) { tap.goal = gt; tapSetPath(np); } else if (!tap.path || !tap.path.length) tapCancel('lost');
      }
    }
    return;
  }
  if (tap.kind === 'npc') {
    const n = tap.target; if (!n) { tapCancel('done'); return; }
    const own = tapTile(), same = insideBuilding(own.tx, own.ty) === insideBuilding(Math.floor(n.px / TILE), Math.floor(n.py / TILE)); // no talking through walls
    const d = dist(player.x, player.y, n.px, n.py);
    if (d <= 64 && same) {
      tapSetPath(null); player.walkPath = null; tapFace(n.px, n.py); player.moving = false;
      if (!player.mech && npcInFront() === n) useAction(); else if (!player.mech) talkTo(n); else useAction();
      tapCancel('done'); return;
    }
    if (!tap.path || !tap.path.length) {
      if (tap.repathed) { tapFace(n.px, n.py); if (d <= 118) useAction(); tapCancel('done'); return; }
      tap.repathed = true; const gt = { tx: Math.floor(n.px / TILE), ty: Math.floor(n.py / TILE) }; const np = tapPathTo(gt.tx, gt.ty, true);
      if (!np || !np.length) { tapFace(n.px, n.py); if (d <= 118) useAction(); tapCancel('done'); return; }
      tap.goal = gt; tapSetPath(np);
    }
    return;
  }
  if (tap.kind === 'person') {
    const q0 = tap.target; if (!q0) { tapCancel('done'); return; }
    const q = tapPeople().find(p => p.list === q0.list && p.id === q0.id); if (!q) { tapCancel('lost'); return; } // the live one: the guild staff walk, a dungeon door hides the townsfolk
    if (tap.marker) { tap.marker.x = q.x; tap.marker.y = q.y; }
    const own = tapTile(), same = insideBuilding(own.tx, own.ty) === insideBuilding(Math.floor(q.x / TILE), Math.floor(q.y / TILE)); // no talking through walls
    const d = dist(player.x, player.y, q.x, q.y);
    if (d <= 64 && same) {
      tapSetPath(null); player.walkPath = null; tapFace(q.x, q.y); player.moving = false;
      if (player.mech) useAction(); else q.talk();
      tapCancel('done'); return;
    }
    if (!tap.path || !tap.path.length) {
      if (tap.repathed) { tapFace(q.x, q.y); if (d <= 100 && !player.mech) q.talk(); tapCancel('done'); return; }
      tap.repathed = true; const gt = { tx: Math.floor(q.x / TILE), ty: Math.floor(q.y / TILE) }; const np = tapPathTo(gt.tx, gt.ty, true);
      if (!np || !np.length) { tapFace(q.x, q.y); if (d <= 100 && !player.mech) q.talk(); tapCancel('done'); return; }
      tap.goal = gt; tapSetPath(np);
    }
    return;
  }
  if (tap.kind === 'use') {
    if (!tap.path || !tap.path.length) {
      const u = tap.useTile, own = tapTile();
      if (Math.max(Math.abs(u.tx - own.tx), Math.abs(u.ty - own.ty)) > 1 && !tap.repathed) { tap.repathed = true; const np = tapPathTo(u.tx, u.ty, true); if (np && np.length) { tapSetPath(np); return; } }
      tapUseNow();
    }
    return;
  }
  if (tap.kind === 'item' || tap.kind === 'walk') { if (!tap.path || !tap.path.length) tapCancel('done'); }
  // one tap chops the whole tree: when a gather action ends and the tile is still there, swing again
  if (tap.gather) {
    const g = tap.gather;
    if (tileAt(g.tx, g.ty) !== g.t) { tap.gather = null; return; }
    { const own = tapTile(); if (Math.max(Math.abs(g.tx - own.tx), Math.abs(g.ty - own.ty)) > 1) { tap.gather = null; return; } } // walked away
    if (player.action) { tap.reissues = 0; return; }
    if (player.hurtT > 0 || player.attackT > 0) { tap.gather = null; return; } // interrupted by a hit or a swing
    if (tap.reissueT > 0) return;
    if (tap.reissues >= 2) { tap.gather = null; return; }
    tap.reissues += 1; tap.reissueT = 0.4; tapFace(tc(g.tx), tc(g.ty)); useAction();
  }
});
HOOKS.newGame.push(() => { tapCancel('manual'); tap.lastTap = null; tap.marker = null; touch.press = null; });
// destination ring (shrinks in, then breathes) + faint dots along the path
HOOKS.draw.push((g, items) => {
  if (tap.path && tap.path.length > 1) items.push({ y: -1e9, draw: () => { g.fillStyle = 'rgba(255,255,255,0.22)'; for (let i = 0; i < tap.path.length - 1; i++) { const [x, y] = tap.path[i]; g.beginPath(); g.arc(tc(x), tc(y), 2.5, 0, 7); g.fill(); } } });
  const mk = tap.marker; if (!mk) return;
  items.push({ y: -1e9 + 1, draw: () => {
    const k = clamp(mk.t / 0.45, 0, 1); const r = lerp(22, 9, k) + (k >= 1 ? Math.sin(time * 6) * 1.5 : 0);
    const a = mk.fade ? clamp(1 - (mk.t - 0.3) / 0.3, 0, 1) : 1;
    g.save(); g.globalAlpha = 0.75 * a; g.strokeStyle = mk.color; g.lineWidth = 2.5; g.beginPath(); g.arc(mk.x, mk.y, r, 0, 7); g.stroke();
    g.globalAlpha = 0.25 * a; g.fillStyle = mk.color; g.beginPath(); g.arc(mk.x, mk.y, Math.max(2, r * 0.35), 0, 7); g.fill(); g.restore();
  } });
});
// long-press label, drawn in screen space above the finger
HOOKS.hud.push(g => {
  const l = tap.label; if (!l || paused) return;
  g.font = 'bold 12px sans-serif'; const w = Math.max(60, g.measureText(l.text).width + 20), h = 26;
  const x = clamp(l.x - w / 2, 6, VW - w - 6), y = clamp(l.y - 54, 6, VH - h - 6);
  roundRect(g, x, y, w, h, 8); g.fillStyle = 'rgba(10,14,22,0.9)'; g.fill(); g.strokeStyle = '#f5c542'; g.lineWidth = 1; g.stroke();
  g.fillStyle = '#e6edf3'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(l.text, x + w / 2, y + h / 2); g.textBaseline = 'alphabetic';
});
// ---------- self-test ----------
HOOKS.selfTest.push((check, F, h) => {
  const prevTouch = window.__forceTouch; window.__forceTouch = false;
  const dc = dialog.cur, dq = dialog.queue.slice(); dialog.cur = null; dialog.queue.length = 0; closePanel(); paused = false; touch.press = null; touch.stickId = null; touch.active = false; tap.lastTap = null;
  h.peace(true); h.clearJunk(); if (!hasTool('axe')) h.give('bronze_axe', 1);
  const screen = (wx, wy) => { render(); return [wx - cam.x, wy - cam.y]; };
  const tapWorld = (wx, wy) => { const [sx, sy] = screen(wx, wy); pointerDown(sx, sy, 'mouse'); pointerUp('mouse'); return [sx, sy]; };
  const untilPath = (max) => { let s = 0; while (s < max && tap.path && tap.path.length) { F.step([]); s++; } return s; };
  // wandering monsters and stray drops near a test spot would change what a tap lands on: park them 20 tiles east for the duration
  const parked = []; const clearArea = o => { for (const m of monsters) { if (!m.dead && dist(m.x, m.y, tc(o.x), tc(o.y)) < 8 * TILE) { parked.push({ m, x: m.x, y: m.y, state: m.state }); m.x += 20 * TILE; m.state = 'idle'; } } for (const d of drops) if (dist(d.x, d.y, tc(o.x), tc(o.y)) < 8 * TILE) { parked.push({ d, x: d.x }); d.x += 20 * TILE; } };
  const unpark = () => { for (const p of parked) { if (p.m) { p.m.x = p.x; p.m.y = p.y; p.m.state = p.state; } else { p.d.x = p.x; } } parked.length = 0; };
  // 1. tap open ground 4 tiles east → walk there
  { const o = h.openSpot(40, 24); clearArea(o); F.tp(o.x, o.y); F.step([]); const gx = o.x + 4, gy = o.y; const t3 = tileAt(o.x + 3, gy), t4 = tileAt(gx, gy); changeTile(gx, gy, T.GRASS); changeTile(o.x + 3, gy, T.GRASS);
    tapWorld(tc(gx), tc(gy)); const started = !!player.walkPath && player.walkPath.length >= 3 && tap.kind === 'walk';
    const s = untilPath(200); F.step([]);
    const arrived = dist(player.x, player.y, tc(gx), tc(gy)) <= 8, cleared = !player.walkPath && tap.kind === null;
    check('tap: a tap 4 tiles east walks there and clears the path on arrival', started && arrived && cleared && s < 200, { started, arrived, cleared, steps: s, at: [+(player.x / TILE).toFixed(1), +(player.y / TILE).toFixed(1)] });
    F.tp(o.x, o.y); changeTile(o.x + 3, gy, t3); changeTile(gx, gy, t4); }
  // 2. tap your own tile → nothing
  { tapWorld(player.x, player.y); F.step([]); check('tap: your own tile does nothing', !player.walkPath && !tap.kind, { kind: tap.kind }); }
  // 3. tap a tree 3 tiles east → walk beside it, chop starts, and the log arrives without another tap
  { const o = h.openSpot(44, 26); clearArea(o); F.tp(o.x, o.y); F.step([]); const tx = o.x + 3, ty = o.y; const t0 = tileAt(tx, ty); changeTile(tx, ty, T.TREE);
    if (!canFit('wood', 1)) { const i = player.inv.findIndex(s => s && !ITEMS[s.id].tool && !ITEMS[s.id].weapon && !ITEMS[s.id].armour && s.id !== 'coins'); if (i >= 0) player.inv[i] = null; }
    const w0 = countItem('wood'); tapWorld(tc(tx), tc(ty)); const started = tap.kind === 'use' && !!player.walkPath;
    const s = untilPath(200); F.sim(2, []);
    const adjacent = Math.max(Math.abs(Math.floor(player.x / TILE) - tx), Math.abs(Math.floor(player.y / TILE) - ty)) === 1;
    const chopping = !!player.action && player.action.type === 'chop' && player.action.tx === tx && player.action.ty === ty;
    const r = F.untilAction(900, () => countItem('wood') > w0);
    check('tap: a tree 3 tiles away → stand beside it, chop starts, the log comes with no second tap', started && s < 200 && adjacent && chopping && typeof r === 'number' && countItem('wood') > w0, { started, s, adjacent, chopping, r, wood: countItem('wood') - w0, notice: notice && notice.text });
    F.sim(3, []); tap.gather = null; player.action = null; regrow = regrow.filter(x => x.i !== idx(tx, ty)); changeTile(tx, ty, t0); }
  // 4. tap a goblin 5 tiles east (hp 1) → chase and kill it
  { const o = h.openSpot(40, 20); clearArea(o); F.tp(o.x, o.y); for (let k = 1; k <= 5; k++) changeTile(o.x + k, o.y, T.GRASS); F.step([]);
    const gob = monsters.find(m => m.type === 'goblin'); const gs = { x: gob.x, y: gob.y, dead: gob.dead, home: { ...gob.home }, hp: gob.hp, respawnT: gob.respawnT };
    gob.dead = false; gob.hp = 1; gob.x = tc(o.x + 5); gob.y = tc(o.y); gob.home = { x: gob.x, y: gob.y }; gob.state = 'idle'; gob.stunT = 0; gob.wanderT = 99; gob.wander = { x: 0, y: 0 }; gob.attackCd = 99;
    const k0 = player.kills; tapWorld(gob.x, gob.y); const targeted = tap.kind === 'monster' && tap.target === gob && player.tapTarget === monsters.indexOf(gob);
    let s = 0; while (s < 400 && !gob.dead) { F.step([]); s++; gob.attackCd = 99; } F.step([]);
    check('tap: a goblin 5 tiles away → walk up, swing, it dies, the target clears', targeted && gob.dead && player.kills === k0 + 1 && s < 400 && tap.kind === null && player.tapTarget === null, { targeted, dead: gob.dead, s, kind: tap.kind });
    gob.x = gs.x; gob.y = gs.y; gob.dead = gs.dead; gob.home = gs.home; gob.hp = gs.hp; gob.respawnT = gs.respawnT; gob.state = 'idle'; gob.attackCd = 0; drops = drops.filter(d => dist(d.x, d.y, tc(o.x + 5), tc(o.y)) > 60); }
  // 5. tap Tobin in Thistledown → walk over and he talks
  { const n = NPCS.find(n => n.id === 'tobin'); n.px = n.home.x; n.py = n.home.y; F.tp(n.x, n.y + 3); for (const v of NPCS) if (v.wander && dist(v.px, v.py, n.px, n.py) < 5 * TILE) { v.px = v.home.x + 6 * TILE; v.py = v.home.y; v.wanderT = 8; v.dir = null; }
    const bread0 = quest.bread; F.step([]); dialog.cur = null; dialog.queue.length = 0;
    tapWorld(n.px, n.py); const started = tap.kind === 'npc' && tap.target === n;
    let s = 0; while (s < 300 && tap.kind === 'npc') { F.step([]); s++; } F.step([]);
    const said = (dialog.cur && dialog.cur.who === 'Tobin') || dialog.queue.some(d => d.who === 'Tobin');
    check('tap: an NPC (Tobin) → walk beside him and he speaks', started && s < 300 && said, { started, s, who: dialog.cur && dialog.cur.who, qn: dialog.queue.length });
    quest.bread = bread0; dialog.cur = null; dialog.queue.length = 0; }
  // 6. manual input cancels the path
  { const o = h.openSpot(40, 24); clearArea(o); F.tp(o.x, o.y); F.step([]); const gx = o.x + 4, gy = o.y; changeTile(gx, gy, T.GRASS); tapWorld(tc(gx), tc(gy)); const had = !!player.walkPath && player.walkPath.length > 0; F.sim(5, []); F.sim(5, ['KeyA']);
    check('tap: a key press cancels the walk', had && !player.walkPath && tap.kind === null && dist(player.x, player.y, tc(gx), tc(gy)) > 40, { had, kind: tap.kind }); }
  // 7. a drag on the joystick zone is a joystick move, never a path; a tap there still walks
  { window.__forceTouch = true; const o = h.openSpot(40, 24); clearArea(o); F.tp(o.x, o.y); F.step([]); const x0 = player.x;
    const zx = VW / 2 - 100, zy = VH / 2 + 70; // left half (where a touch starts the stick), over the open ground beside the knight
    pointerDown(zx, zy, 7); const stick = touch.stickId === 7 && touch.active; pointerMove(zx + 50, zy, 7); F.sim(10, []); const moved = player.x > x0 + 5; pointerUp(7); F.step([]);
    const noPath = !player.walkPath && tap.kind === null && !touch.active;
    F.tp(o.x, o.y); F.step([]); pointerDown(zx, zy, 8); pointerUp(8); const tapWalks = !!player.walkPath && tap.kind === 'walk'; tapCancel('manual');
    check('tap: a drag on the joystick zone moves the stick and makes no path; a still tap there walks', stick && moved && noPath && tapWalks, { stick, moved, noPath, tapWalks }); }
  // 8. long-press on a monster shows its name, release targets it
  { const o = h.openSpot(40, 20); clearArea(o); F.tp(o.x, o.y); F.step([]); const gob = monsters.find(m => m.type === 'goblin'); const gs = { x: gob.x, y: gob.y, dead: gob.dead, home: { ...gob.home } };
    gob.dead = false; gob.x = tc(o.x + 2); gob.y = tc(o.y); gob.home = { x: gob.x, y: gob.y }; gob.state = 'idle'; gob.stunT = 0; gob.wanderT = 99; gob.wander = { x: 0, y: 0 }; gob.attackCd = 99;
    const [sx, sy] = screen(gob.x, gob.y); pointerDown(sx, sy, 9); F.sim(30, []); const label = tap.label && tap.label.text; const named = !!label && label.includes(MONSTER_DEFS.goblin.name);
    pointerUp(9); const targeted = tap.kind === 'monster' && tap.target === gob && !tap.label; tapCancel('manual');
    check('tap: holding on a monster shows "name · lv", releasing targets it', named && targeted, { label, targeted });
    pointerDown(sx, sy, 10); F.sim(30, []); const hold2 = tap.label && tap.label.text; pointerUp(10); tapCancel('manual');
    const [tsx, tsy] = screen(tc(o.x + 1), tc(o.y + 1)); pointerDown(tsx, tsy, 11); F.sim(30, []); const groundLabel = tap.label && tap.label.text; pointerUp(11); tapCancel('manual');
    check('tap: long-press labels name the ground too', hold2 === label && typeof groundLabel === 'string' && groundLabel.length > 0, { hold2, groundLabel });
    gob.x = gs.x; gob.y = gs.y; gob.dead = gs.dead; gob.home = gs.home; gob.state = 'idle'; gob.attackCd = 0; }
  // 9. double-tap = swing
  { const o = h.openSpot(40, 24); clearArea(o); F.tp(o.x, o.y); F.step([]); player.attackCd = 0; player.attackT = 0; const [sx, sy] = screen(tc(o.x + 2), tc(o.y)); pointerDown(sx, sy, 12); pointerUp(12); F.step([]); pointerDown(sx, sy, 13); pointerUp(13);
    check('tap: a double-tap swings', player.attackT > 0, { attackT: player.attackT }); tapCancel('manual'); F.sim(40, []); }
  // 10. feature people (TAP_PEOPLE): a tap on a dwarf, an elf, a goblin townsgoblin, the winged queen or the guild staff walks up and opens the very line E opens
  { const drainD = () => { dialog.cur = null; dialog.queue.length = 0; };
    const firstLine = () => { const d = dialog.cur || dialog.queue[0]; return d ? d.who + ' | ' + d.text : null; };
    const viaE = (px, py, tx, ty) => { closePanel(); F.tp(px, py); F.step([]); F.face(tx, ty); drainD(); F.press('KeyE'); F.sim(2, []); const l = firstLine(); closePanel(); drainD(); return l; };
    const viaTap = (px, py, wx, wy, max = 400) => { closePanel(); F.tp(px, py); F.step([]); drainD(); tap.lastTap = null; tapCancel('manual'); tapWorld(wx, wy); const kind = tap.kind, who = tap.target && tap.target.name; let s = 0; while (s < max && tap.kind === 'person') { F.step([]); s++; } F.step([]); const l = firstLine(); closePanel(); drainD(); return { kind, who, s, line: l, at: [+(player.x / TILE).toFixed(1), +(player.y / TILE).toFixed(1)] }; };
    const same = (name, e, t, extra) => check(`tap: ${name} — a tap walks up and opens the same first line E opens`, !!e && t.kind === 'person' && t.line === e && t.s < 400, Object.assign({ e, tap: t }, extra || {}));
    const inst = () => window.INSTANCES ? INSTANCES.active() : null; if (inst()) INSTANCES.leave();
    // dwarves (24): Brunhild the smith in Deepholm's forge hall, before the forge is lit
    if (typeof quest.dwarf !== 'undefined' || REGIONS.some(r => r.name === 'Deepholm')) { const snap = JSON.stringify(quest.dwarf === undefined ? null : quest.dwarf); quest.dwarf = { stage: 0, chests: [], visited: true }; clearArea({ x: 12, y: 83 });
      const e = viaE(12, 82, 12, 81); const t = viaTap(12, 85, tc(12), tc(81)); same('Brunhild (24-dwarves)', e, t); quest.dwarf = JSON.parse(snap); if (quest.dwarf === null) delete quest.dwarf; }
    // elves (25): Thessaly the weaver in Sylvaris, before the Queen's task is done
    if (REGIONS.some(r => r.name === 'Sylvaris')) { const snap = JSON.stringify(quest.elves === undefined ? null : quest.elves); if (!quest.elves) { F.tp(133, 128); F.step([]); } if (quest.elves) quest.elves.stage = 0; clearArea({ x: 133, y: 129 });
      const e = viaE(132, 129, 133, 129); const t = viaTap(130, 129, tc(133), tc(129)); same('Thessaly (25-elves)', e, t); quest.elves = JSON.parse(snap); if (quest.elves === null) delete quest.elves; }
    // the goblin townsfolk (33): Grubb the cook inside his cookhouse, mid-quest without the beef
    if (REGIONS.some(r => r.name === 'Grubmarket')) { const snap = JSON.stringify(quest.tinker === undefined ? null : quest.tinker); quest.tinker = { stage: 1, parts: {}, visited: true, rematch: false, kills: 0 }; clearArea({ x: 216, y: 24 });
      const e = viaE(216, 24, 216, 23); const t = viaTap(215, 24, tc(216), tc(23)); same('Grubb the cook (33-goblincity)', e, t); quest.tinker = JSON.parse(snap); if (quest.tinker === null) delete quest.tinker; }
    // the winged folk (36): Queen Seraphel in the Aerie's hall, asked and not yet paid
    if (window.SKYCITY && window.INSTANCES && INSTANCES.get && INSTANCES.get('aerie')) { const snap = JSON.stringify(quest.sky === undefined ? null : quest.sky); const ok = INSTANCES.enter('aerie', [62, 7]); F.sim(2, []); const q = SKYCITY.SQ(); q.stage = 2;
      const e = ok ? viaE(25, 7, 25, 6) : null; const t = ok ? viaTap(25, 9, tc(25), tc(6)) : { kind: null }; same('Queen Seraphel (36-skycity, inside the Aerie)', e, t, { entered: ok, inst: inst() }); if (inst()) INSTANCES.leave(); drainD(); quest.sky = JSON.parse(snap); if (quest.sky === null) delete quest.sky; }
    // the guild staff (41): Pip inside the hall door at rank 4 (pick() pinned so both probes draw the same line)
    if (typeof quest.rebuild !== 'undefined' || BUILDINGS.some(b => b.id === 'guild_hall') || REGIONS.some(r => r.name === 'Hollowford')) { const snap = JSON.stringify(quest.guild === undefined ? null : quest.guild); const R = Math.random; Math.random = () => 0;
      quest.guild = Object.assign({}, quest.guild || {}, { founded: true, rank: 4, jobsDone: 12, cooldowns: {}, active: null }); F.tp(153, 71); F.sim(2, []); clearArea({ x: 153, y: 70 });
      const e = viaE(153, 71, 153, 70); const t = viaTap(153, 71, tc(153), tc(70)); Math.random = R; same('Pip of the guild staff (41-guild)', e, t); quest.guild = JSON.parse(snap); if (quest.guild === null) delete quest.guild; F.sim(2, []); }
    // a long-press on one of them names them
    { window.__forceTouch = true; const people = tapPeople(); window.__forceTouch = false; check('tap: TAP_PEOPLE is a registry of functions returning live people (x, y, id, name, talk)', Array.isArray(TAP_PEOPLE) && TAP_PEOPLE.length >= 1 && people.every(p => typeof p.x === 'number' && typeof p.talk === 'function' && typeof p.name === 'string'), { lists: TAP_PEOPLE.length, live: people.length }); }
  }
  unpark(); window.__forceTouch = prevTouch; h.peace(false); touch.press = null; dialog.cur = dc; dialog.queue.push(...dq); tapCancel('manual');
});
