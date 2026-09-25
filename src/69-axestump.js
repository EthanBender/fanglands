// ============================================================================
// THE AXE IN THE STUMP — the first tool a knight finds, made impossible to walk past.
//
// The owner, testing, found it is not obvious there is an axe in this stump, and a lot of people would
// walk right by it. The old drawing was a thin brown stick on a small brown stump on brown dirt.
// Now, while the axe is still there:
//   - it is drawn stuck in the stump: a steel head bitten into the wood, the handle up at an angle,
//     outlined so it reads against dirt and grass, on a stump a size bigger than a chopped one;
//   - the blade glints every couple of seconds, a warm glow breathes around it, and a gold arrow bobs over it;
//   - standing near it, a plate says how to take it (E, or tap it on the iPad);
//   - tapping anywhere on the drawn axe (handle included, which pokes into the tile above) takes it,
//     and E / USE beside it takes it even when the knight is not facing it square;
//   - the Voice points at it the moment the knight steps out of the cave, the quest line says to take it,
//     and the quest marker (minimap arrow, world map ring, quest box) sits on it while stages 2 and 3 last;
//     after that, while it is still in the stump and the knight carries no axe, the world map keeps a ring on it.
// Once taken the tile is an ordinary STUMP (06-systems), so none of this draws or points any more.
//
// Wraps by reassignment with explicit args (docs/EXTENDING.md): mapTargets, questText, advanceQuest,
// useAction, tapPick. The drawing is drawAxeStump, called from drawFurniture (08-draw) for T.AXESTUMP.
// ============================================================================
const AXE_T = { x: 23, y: 9 };                         // 02-world puts the axe stump here, by the cave mouth
const AXE = { T: AXE_T, drawn: 0 };                    // drawn: frames the axe was drawn (the self-test reads it)
window.AXE = AXE;
function axeWaiting() { return !player.tookAxe && !window.__instance && tileAt(AXE_T.x, AXE_T.y) === T.AXESTUMP; }
AXE.waiting = axeWaiting;

// ---------- the drawing ----------
function drawAxeStump(g, tx, ty) {
  const cx = tc(tx), cy = tc(ty);
  AXE.drawn++;
  const glow = 0.5 + 0.5 * Math.sin(time * 2.4);
  // a warm glow that breathes, under everything
  { const gr = g.createRadialGradient(cx, cy - 12, 4, cx, cy - 12, 52); gr.addColorStop(0, `rgba(255,236,170,${0.22 + 0.16 * glow})`); gr.addColorStop(1, 'rgba(255,236,170,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy - 12, 52, 0, 7); g.fill(); }
  // the stump, a good size bigger than a chopped one, so it reads under the axe
  g.save(); g.translate(cx, cy + 8); g.scale(1.6, 1.6); g.translate(-cx, -(cy + 8)); drawStumpProp(g, tx, ty); g.restore();
  // the cut: a dark slit across the top where the blade went in, and two chips of wood knocked out
  const topY = cy - 11;
  g.fillStyle = 'rgba(40,24,10,0.9)'; g.beginPath(); g.ellipse(cx + 1, topY + 1, 8, 2, 0.57, 0, 7); g.fill();
  g.fillStyle = '#e0bd84'; g.fillRect(cx - 15, topY + 13, 4, 2); g.fillRect(cx + 12, topY + 16, 3, 2);
  // the axe: the blade's edge sits in the cut, the head above it, the handle rising up and to the left
  const a = -1.0, ca = Math.cos(a), sa = Math.sin(a), E = -13;           // E: the edge, in the head's own frame
  const hx = cx + 1 - E * ca, hy = topY + 1 - E * sa;                     // the head's centre, placed so the edge lands in the cut
  g.save(); g.translate(hx, hy); g.rotate(a);
  // handle: dark outline, wood, a lighter stripe, a leather grip and a knob at the far end
  g.fillStyle = '#24160b'; roundRect(g, -3.6, -40, 7.2, 42, 3.6); g.fill();
  g.fillStyle = '#a0692f'; roundRect(g, -2.3, -38.7, 4.6, 39.4, 2.3); g.fill();
  g.fillStyle = '#d2a05c'; g.fillRect(-1.2, -36, 1.2, 32);
  g.fillStyle = '#5a2e1a'; g.fillRect(-2.3, -38, 4.6, 10);
  g.strokeStyle = '#8a4a2a'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-2.3, -36.5 + k * 3.2); g.lineTo(2.3, -35 + k * 3.2); g.stroke(); }
  g.fillStyle = '#24160b'; g.beginPath(); g.arc(0, -40, 3.8, 0, 7); g.fill(); g.fillStyle = '#6b3a1e'; g.beginPath(); g.arc(0, -40, 2.4, 0, 7); g.fill();
  // head: the poll on the handle, the blade flaring out to the edge (pointing down into the stump once rotated)
  g.beginPath(); g.moveTo(4, -5); g.lineTo(4, 5); g.lineTo(-4, 4.5); g.quadraticCurveTo(-8, 6.5, -13, 10); g.quadraticCurveTo(-15.5, 0, -13, -10); g.quadraticCurveTo(-8, -6.5, -4, -4.5); g.closePath();
  g.lineWidth = 3.4; g.strokeStyle = '#161b22'; g.stroke();
  { const sg = g.createLinearGradient(0, -9, 0, 9); sg.addColorStop(0, '#f2f5f8'); sg.addColorStop(0.5, '#b9c1cc'); sg.addColorStop(1, '#7d8591'); g.fillStyle = sg; } g.fill();
  // the ground edge, bright, and the wedge that holds the handle
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-12.2, -8); g.quadraticCurveTo(-14.4, 0, -12.2, 8); g.stroke();
  g.fillStyle = '#6b7380'; g.beginPath(); g.arc(0, 0, 1.6, 0, 7); g.fill();
  // a glint that runs down the blade every 2.2 seconds
  const ph = (time % 2.2) / 2.2;
  if (ph < 0.3) { const s = Math.sin(ph / 0.3 * Math.PI), yy = -9 + ph / 0.3 * 18; g.strokeStyle = `rgba(255,255,255,${0.95 * s})`; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-3, yy * 0.45); g.lineTo(-12.5, yy); g.stroke(); }
  g.restore();
  // the glint's star: flares on the blade on the same beat, big enough to catch the eye across the screen
  if (ph < 0.3) {
    const s = Math.sin(ph / 0.3 * Math.PI), lx = -10, ly = -6, px = hx + lx * ca - ly * sa, py = hy + lx * sa + ly * ca, r = 4 + 12 * s;
    g.save(); g.translate(px, py); g.rotate(time * 1.5); g.fillStyle = `rgba(255,255,255,${0.95 * s})`;
    g.beginPath(); for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * 0.2 : r, an = k * Math.PI / 4; g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } g.closePath(); g.fill(); g.restore();
  }
  // a gold arrow bobbing over it, pointing down at the axe
  { const bob = Math.sin(time * 3.2) * 4, ax = cx - 2, ay = cy - 62 + bob;
    g.beginPath(); g.moveTo(ax - 10, ay - 8); g.lineTo(ax + 10, ay - 8); g.lineTo(ax + 10, ay - 2); g.lineTo(ax + 4, ay - 2); g.lineTo(ax + 4, ay); g.lineTo(ax + 11, ay); g.lineTo(ax, ay + 12); g.lineTo(ax - 11, ay); g.lineTo(ax - 4, ay); g.lineTo(ax - 4, ay - 2); g.lineTo(ax - 10, ay - 2); g.closePath();
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.stroke(); g.fillStyle = '#f5c542'; g.fill(); }
}

// ---------- "take the axe" plate, drawn over everything nearby while the knight is close ----------
HOOKS.draw.push((g, items) => {
  if (!axeWaiting() || player.dead) return;
  const cx = tc(AXE_T.x), cy = tc(AXE_T.y);
  if (dist(player.x, player.y, cx, cy) > 3 * TILE) return;
  items.push({ y: 1e9, draw: () => {
    const text = touchMode() ? 'Tap the axe to take it' : `${keyName('E')}: take the axe`;
    g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
    // over the arrow; but on a phone the top of the screen is HUD, so when that spot is under it the plate sits under the knight's
    // feet and names the USE button (the axe itself may be under the HUD, where a tap would not reach it)
    const H = HUD_LAYOUT, top = (y0, h) => (y0 || 0) < VH / 2 ? (y0 || 0) + (h || 0) : 0, floor = Math.max(H.topStackBottom || 0, top(H.questY, H.questH), top(H.hotbarY, H.hotbarH)) + 6;
    let lx = cx - 2, y = cy - 100;
    let say2 = text;
    if (y - Math.round(cam.y) < floor) { lx = player.x; y = player.y + 30; say2 = `${keyName('E')}: take the axe`; }
    const w = g.measureText(say2).width + 20, x = lx - w / 2;
    g.fillStyle = 'rgba(13,17,23,0.88)'; roundRect(g, x, y, w, 24, 8); g.fill();
    g.strokeStyle = '#f5c542'; g.lineWidth = 1.5; roundRect(g, x, y, w, 24, 8); g.stroke();
    g.fillStyle = '#ffe066'; g.fillText(say2, lx, y + 16.5);
  } });
});

// ---------- the quest marker sits on it while the knight is leaving the cave and fighting his first goblins ----------
const AXE_LABEL = 'The axe in the stump';
{
  const _mapTargets = mapTargets;
  mapTargets = function () {
    const out = _mapTargets();
    if (!axeWaiting()) return out;
    if (quest.stage === 2 || quest.stage === 3) {
      const i = out.findIndex(t => t.id === 'main');
      if (i >= 0) out[i] = { x: AXE_T.x, y: AXE_T.y, label: AXE_LABEL, id: 'main' };
    } else if (quest.stage > 3 && !hasTool('axe')) out.push({ x: AXE_T.x, y: AXE_T.y, label: AXE_LABEL, id: 'axe' });
    return out;
  };
}

// ---------- the quest line says it in plain words ----------
{
  const _questText = questText;
  questText = function (id = 'main') {
    if (id === 'main' && quest.stage === 3 && !HOOKS.questText.main && axeWaiting())
      return `Take the axe from the stump (${touchMode() ? 'tap it' : keyName('E')}). Then beat goblins (${quest.kills}/3).`;
    return _questText(id);
  };
}

// ---------- the Voice points at it as the knight steps out of the cave ----------
{
  const _advanceQuest = advanceQuest;
  advanceQuest = function (stage) {
    if (stage === 3 && quest.stage < 3 && axeWaiting())
      say(`See that stump by the cave? Someone left an axe stuck in it. ${touchMode() ? 'Tap it' : 'Walk up and press E'} to take it. You will need it for trees.`, 'The Voice');
    return _advanceQuest(stage);
  };
}

// ---------- E / USE beside it takes it, even when the knight is not facing it square ----------
{
  const _useAction = useAction;
  useAction = function () {
    if (!player.dead && !player.mech && axeWaiting() && dist(player.x, player.y, tc(AXE_T.x), tc(AXE_T.y)) <= 1.6 * TILE && !npcInFront()) {
      const ft = frontTile(player);
      if (!INTERESTING(tileAt(ft.tx, ft.ty))) {
        const dx = tc(AXE_T.x) - player.x, dy = tc(AXE_T.y) - player.y, d = Math.hypot(dx, dy) || 1;
        player.facing = { x: dx / d, y: dy / d };
      }
    }
    return _useAction();
  };
}

// ---------- a tap anywhere on the drawn axe (the handle and the arrow poke into the tile above) is a tap on the stump ----------
{
  const _tapPick = tapPick;
  tapPick = function (sx, sy) {
    const p = _tapPick(sx, sy);
    if (!p || (p.kind !== 'walk' && p.kind !== 'wall') || !axeWaiting()) return p;
    const cx = tc(AXE_T.x), cy = tc(AXE_T.y);
    if (p.wx >= cx - 34 && p.wx <= cx + 22 && p.wy >= cy - 76 && p.wy <= cy + 24)
      return { kind: 'use', wx: p.wx, wy: p.wy, tx: AXE_T.x, ty: AXE_T.y, t: T.AXESTUMP };
    return p;
  };
}

// ---------- self-test ----------
HOOKS.selfTest.push((check, F, h) => {
  if (window.__instance) return;
  const saved = { stage: quest.stage, kills: quest.kills, took: player.tookAxe, tile: tileAt(AXE_T.x, AXE_T.y), x: player.x, y: player.y, facing: { ...player.facing }, axes: countItem('bronze_axe'), tracked: quest.tracked, untracked: quest.untrackedByPlayer, touch: window.__forceTouch, drops: drops.length, peace: window.__peace };
  const reset = () => { dialog.cur = null; dialog.queue.length = 0; };
  const put = () => { changeTile(AXE_T.x, AXE_T.y, T.AXESTUMP); player.tookAxe = false; };
  h.peace(true);
  // 1. stepping out of the cave: the Voice points at the stump first, the quest line and the marker are on it
  { put(); reset(); quest.stage = 2; quest.kills = 0; advanceQuest(3); const first = dialog.queue[0] && dialog.queue[0].text;
    const main = mapTargets().find(t => t.id === 'main'); const qt = questText('main');
    check('axe: out of the cave the Voice points at the stump, the quest says take the axe, the marker sits on the stump', /axe stuck in it/.test(first || '') && main && main.x === AXE_T.x && main.y === AXE_T.y && /^Take the axe from the stump/.test(qt) && /\(0\/3\)/.test(qt), { first, main, qt }); reset(); }
  // 2. drawn while it waits: a frame on screen near it draws the axe; a tap on the handle (the tile above) is a use on the stump
  { F.tp(AXE_T.x + 2, AXE_T.y); render(); const d0 = AXE.drawn; render(); const drawn = AXE.drawn > d0;
    const sx = tc(AXE_T.x) - 18 - cam.x, sy = tc(AXE_T.y) - 34 - cam.y; const p = tapPick(sx, sy);
    const handle = !!p && p.kind === 'use' && p.tx === AXE_T.x && p.ty === AXE_T.y;
    check('axe: drawn while it waits, and a tap on its handle (the tile above the stump) targets the stump', drawn && handle, { drawn, pick: p && { kind: p.kind, tx: p.tx, ty: p.ty } }); }
  // 3. E beside it, facing away, takes it: the axe in the pack, the tile an ordinary stump, the marker back on the signpost
  //    (the press runs at the stage the suite was on, so no stage-3 hook fires out of turn)
  { quest.stage = saved.stage; F.tp(AXE_T.x + 1, AXE_T.y + 1); player.facing = { x: 1, y: 0 }; const n0 = countItem('bronze_axe'), dr0 = drops.length; F.press('KeyE'); F.sim(3, []);
    const got = countItem('bronze_axe') === n0 + 1 || drops.slice(dr0).some(d => d.id === 'bronze_axe');
    const took = player.tookAxe && got && tileAt(AXE_T.x, AXE_T.y) === T.STUMP;
    quest.stage = 3; const main = mapTargets().find(t => t.id === 'main'); const back = main && main.x === MAP_TARGETS[3].x && main.y === MAP_TARGETS[3].y && !mapTargets().some(t => t.id === 'axe');
    render(); const d0 = AXE.drawn; render(); const gone = AXE.drawn === d0 && !/axe/.test(questText('main')); quest.stage = saved.stage;
    check('axe: E beside the stump (facing away) takes it; after that it is an ordinary stump, not drawn, not marked', took && back && gone, { took, got, n0, tile: tileAt(AXE_T.x, AXE_T.y), main, gone }); reset(); }
  // 4. later in the story, still in the stump and no axe carried: a ring on the world map, not the main marker
  { put(); quest.stage = 6; const inv = player.inv.map(s => s ? { ...s } : null), eq = { ...player.equip };
    for (let i = 0; i < player.inv.length; i++) { const s = player.inv[i]; if (s && ITEMS[s.id].tool === 'axe') player.inv[i] = null; } for (const k of EQUIP_SLOTS) if (player.equip[k] && ITEMS[player.equip[k]].tool === 'axe') player.equip[k] = null;
    const ring = mapTargets().find(t => t.id === 'axe'); const main = mapTargets().find(t => t.id === 'main');
    player.inv = inv; player.equip = eq;
    check('axe: later, while it is still in the stump and the knight has no axe, the world map rings it (the main marker stays on the story)', !!ring && ring.x === AXE_T.x && main && main.x !== AXE_T.x, { ring, main }); }
  // put everything back
  if (countItem('bronze_axe') > saved.axes) removeItem('bronze_axe', countItem('bronze_axe') - saved.axes);
  drops.length = Math.min(drops.length, saved.drops);
  changeTile(AXE_T.x, AXE_T.y, saved.tile); player.tookAxe = saved.took; quest.stage = saved.stage; quest.kills = saved.kills;
  quest.tracked = saved.tracked; quest.untrackedByPlayer = saved.untracked; window.__forceTouch = saved.touch;
  player.x = saved.x; player.y = saved.y; player.facing = saved.facing; reset(); window.__peace = saved.peace;
});
