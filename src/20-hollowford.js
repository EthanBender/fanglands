// ============================================================================
// CHAPTER 4 — HOLLOWFORD AND THE BARRELBEAST (feature file; registers through HOOKS only)
// The town the goblins burned, south of their camp. Survivors hide in the chapel crypt.
// A boss machine — the Barrelbeast — stamps through the square. Bring it down, then tell Old Tam.
// ============================================================================
{
  // ---------- region ----------
  const HF_REGION = { name: 'Hollowford', sub: 'What the goblins left', x0: 122, y0: 66, x1: 156, y1: 92 };
  REGIONS.unshift(HF_REGION);
  const hfIn = (tx, ty) => tx >= HF_REGION.x0 && tx <= HF_REGION.x1 && ty >= HF_REGION.y0 && ty <= HF_REGION.y1;
  const HF_SQUARE = { x: 140, y: 80 }; // the cracked well
  const HF_HATCH = { x: 147, y: 70 };  // Pip's cellar
  const HF_BEAST_HOME = { x: 140, y: 86 };
  // feature state lives in quest.hollowford (saved with the quest); created lazily for old saves
  const HF = () => quest.hollowford || (quest.hollowford = { rewarded: false, beastKilled: false, wreck: null });
  HOOKS.newGame.push(() => { quest.hollowford = { rewarded: false, beastKilled: false, wreck: null }; });

  // ---------- tiles ----------
  const T_SCORCH = addTile('SCORCH', { placeableOn: true, tex: 'scorch', mini: '#3a3330' }); // burned ground
  const T_WELL = addTile('WELL', { solid: true, tex: 'scorch', mini: '#8d9098' });            // cracked town well
  const T_HATCH = addTile('HATCH', { tex: 'dirt', mini: '#6b4a2a' });                          // cellar hatch (walk over it)
  const T_BEAM = addTile('BEAM', { solid: true, tex: 'scorch', mini: '#2a2420' });             // fallen charred roof beam
  { // scorched-earth ground texture, same procedural style as the core tiles
    const rnd = mulberry32(4041);
    for (let v = 0; v < 3; v++) makeTex('scorch' + v, g => {
      const grad = g.createLinearGradient(0, 0, TILE, TILE); grad.addColorStop(0, '#3d3632'); grad.addColorStop(1, '#2b2624');
      g.fillStyle = grad; g.fillRect(0, 0, TILE, TILE);
      for (let i = 0; i < 26; i++) { g.fillStyle = rnd() < 0.5 ? '#4a423c' : '#221e1b'; g.beginPath(); g.ellipse(rnd() * TILE, rnd() * TILE, 2 + rnd() * 4, 1 + rnd() * 2.5, rnd() * 3, 0, 7); g.fill(); }
      for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(190,190,195,0.32)'; g.beginPath(); g.arc(rnd() * TILE, rnd() * TILE, 0.7 + rnd(), 0, 7); g.fill(); } // ash flecks
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.2;
      for (let i = 0; i < 2; i++) { const x = rnd() * TILE, y = rnd() * TILE; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 20, y + (rnd() - 0.5) * 20); g.lineTo(x + (rnd() - 0.5) * 26, y + (rnd() - 0.5) * 26); g.stroke(); }
      if (v === 1) for (let i = 0; i < 2; i++) { g.fillStyle = 'rgba(255,120,40,0.35)'; g.beginPath(); g.arc(rnd() * TILE, rnd() * TILE, 1.4, 0, 7); g.fill(); } // a last ember
    });
  }

  // ---------- the Barrelbeast ----------
  MONSTER_DEFS.barrelbeast = {
    name: 'The Barrelbeast', level: 28, r: 30, hp: 400, att: 26, maxHit: 16, def: 24, speed: 55, aggro: true, sight: 7 * TILE, respawn: 600,
    drops: { always: [['goblin_scrap', 8, 12], ['iron_bar', 2, 4], ['steel_bar', 1, 2], ['coins', 80, 160]], rare: { chance: 3, table: [['steel_battleaxe', 1, 1, 1], ['steel_body', 1, 1, 1]] } },
  };
  // sprite: a huge iron-banded barrel on four thick legs, a boiler with a chimney, a goblin crew on the deck, a spiked ram in front
  HOOKS.drawMonster.barrelbeast = (g, e, hurt) => {
    const ang = Math.atan2(e.facing.y, e.facing.x), t = time, p2 = e.hp <= e.maxHp * 0.5;
    // legs
    g.strokeStyle = '#2e2e36'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4, ph = e.moving ? Math.sin(e.walkT * 0.55 + k * 1.6) * 8 : 0;
      const hx = Math.cos(a) * 24, hy = Math.sin(a) * 14 + 6, kx = Math.cos(a) * 44, ky = Math.sin(a) * 30 + 12 + ph, fx = Math.cos(a) * 54, fy = Math.sin(a) * 44 + 26;
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      g.fillStyle = '#3a3a42'; g.beginPath(); g.ellipse(fx, fy + 2, 9, 5, 0, 0, 7); g.fill();
      g.fillStyle = '#8f96a3'; g.beginPath(); g.arc(kx, ky, 4, 0, 7); g.fill();
    }
    // barrel body with stave seams, a highlight and four iron bands with rivets
    g.fillStyle = hurt ? '#ffb0b0' : '#6a4022'; g.beginPath(); g.ellipse(0, 0, 38, 28, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 2; for (const oy of [-19, -8, 3, 14]) { const hw = 38 * Math.sqrt(1 - (oy / 28) ** 2); g.beginPath(); g.moveTo(-hw, oy); g.lineTo(hw, oy); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.ellipse(-6, -12, 22, 7, 0, 0, 7); g.fill();
    g.strokeStyle = '#2e2e36'; g.lineWidth = 5;
    for (const ox of [-24, -8, 8, 24]) { const hh = 28 * Math.sqrt(1 - (ox / 38) ** 2); g.beginPath(); g.moveTo(ox, -hh); g.lineTo(ox, hh); g.stroke(); g.fillStyle = '#8f96a3'; for (const ry of [-0.6, 0, 0.6]) { g.beginPath(); g.arc(ox, ry * hh, 1.8, 0, 7); g.fill(); } }
    if (p2) { g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(12, -20); g.lineTo(18, -8); g.lineTo(10, 2); g.lineTo(20, 14); g.stroke(); } // cracked staves
    // boiler, brass ring, firebox glow, chimney and steam
    g.fillStyle = '#4a4a52'; g.beginPath(); g.arc(-16, -22, 11, 0, 7); g.fill();
    g.strokeStyle = '#c9a02a'; g.lineWidth = 2; g.beginPath(); g.arc(-16, -22, 8, 0, 7); g.stroke();
    const glow = p2 ? 0.55 + Math.sin(t * 12) * 0.35 : 0.25 + Math.sin(t * 4) * 0.1;
    g.fillStyle = `rgba(255,${p2 ? 90 : 150},40,${glow})`; g.beginPath(); g.arc(-16, -22, 5, 0, 7); g.fill();
    g.fillStyle = '#3a3a42'; g.fillRect(-19, -40, 6, 12);
    for (let k = 0; k < 3; k++) { const ph = (t * 0.6 + k * 0.33) % 1; g.fillStyle = `rgba(${p2 ? 90 : 220},${p2 ? 80 : 220},${p2 ? 80 : 230},${0.45 * (1 - ph)})`; g.beginPath(); g.arc(-16 + Math.sin(t * 3 + k) * 4, -42 - ph * 26, 4 + ph * 6, 0, 7); g.fill(); }
    // bomb chute on the deck (lit when the boiler is cracked)
    g.fillStyle = '#2e2e36'; g.fillRect(14, -24, 10, 14); g.fillStyle = '#1b1b20'; g.beginPath(); g.ellipse(19, -24, 5, 2.5, 0, 0, 7); g.fill();
    if (p2) { g.fillStyle = '#ffb347'; g.beginPath(); g.arc(19, -26, 2 + Math.sin(t * 20), 0, 7); g.fill(); }
    // goblin crew
    const gob = (x, y, hat, lever) => {
      g.fillStyle = '#6fbf3f'; g.beginPath(); g.arc(x, y, 5.5, 0, 7); g.fill();
      g.beginPath(); g.moveTo(x - 4, y - 2); g.lineTo(x - 10, y - 5); g.lineTo(x - 4, y + 1); g.closePath(); g.moveTo(x + 4, y - 2); g.lineTo(x + 10, y - 5); g.lineTo(x + 4, y + 1); g.closePath(); g.fill();
      g.fillStyle = '#d62828'; g.beginPath(); g.arc(x - 2, y - 1, 1.2, 0, 7); g.arc(x + 2, y - 1, 1.2, 0, 7); g.fill();
      if (hat === 'goggles') { g.fillStyle = '#8a6a3a'; g.beginPath(); g.arc(x, y - 2, 6, Math.PI, 0); g.fill(); g.fillStyle = '#c9ccd3'; g.beginPath(); g.arc(x + 2, y - 2, 2, 0, 7); g.fill(); }
      else if (hat === 'helm') { g.fillStyle = '#5a5a62'; g.beginPath(); g.arc(x, y - 2, 6, Math.PI, 0); g.fill(); }
      if (lever) { g.save(); g.translate(x + 7, y); g.rotate(Math.sin(t * 6) * 0.5 - 0.6); g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -12); g.stroke(); g.fillStyle = '#d62828'; g.beginPath(); g.arc(0, -12, 2.5, 0, 7); g.fill(); g.restore(); }
    };
    gob(-4, -8, null, true); gob(9, -3, 'goggles', false); gob(-8, 7, 'helm', false);
    // pennant
    g.strokeStyle = '#4a3218'; g.lineWidth = 2; g.beginPath(); g.moveTo(2, -14); g.lineTo(2, -48); g.stroke();
    g.fillStyle = '#7a2e2e'; g.beginPath(); g.moveTo(2, -48); g.lineTo(18 + Math.sin(t * 5) * 3, -43); g.lineTo(2, -37); g.closePath(); g.fill();
    // spiked ram, thrust forward on attack
    g.save(); g.rotate(ang); const ext = e.attackT > 0 ? 14 : 0;
    g.fillStyle = '#2e2e36'; g.fillRect(28, -6, 20 + ext, 12); g.fillStyle = '#3a3a42'; g.fillRect(46 + ext, -11, 8, 22);
    g.fillStyle = '#8f96a3'; for (const oy of [-8, 0, 8]) { g.beginPath(); g.moveTo(54 + ext, oy - 3); g.lineTo(63 + ext, oy); g.lineTo(54 + ext, oy + 3); g.closePath(); g.fill(); }
    g.restore();
  };
  HOOKS.hit.push(m => { if (m.type === 'barrelbeast') burst(m.x, m.y - 10, '#8f96a3', 5, 70); });
  // phase 2: under half hp the cracked boiler spits sticky bombs at a knight within 6 tiles, every ~3 s
  HOOKS.update.push(dt => {
    const hf = HF();
    if (quest.stage === 8 && player.region === 'Hollowford') advanceQuest(9);
    if (quest.stage === 9 && hf.beastKilled) advanceQuest(10);
    if (quest.stage === 10 && hf.rewarded) advanceQuest(11);
    for (const m of monsters) {
      if (m.type !== 'barrelbeast' || m.dead) continue;
      const p2 = m.hp <= m.maxHp * 0.5;
      if (!p2) { m.phase2 = false; continue; }
      if (!m.phase2) { m.phase2 = true; m.bombCd = 0.8; floatText(m.x, m.y - m.r - 30, 'The boiler screams!', '#ff8a1a', 14); burst(m.x, m.y - 20, '#ff8a1a', 20, 120); say('Its boiler is cracked. Now it will spit. Keep moving, knight.', 'The Voice'); }
      m.bombCd = (m.bombCd ?? 0.8) - dt;
      const dp = dist(m.x, m.y, player.x, player.y);
      if (m.state === 'chase' && !window.__peace && !player.dead && dp <= 6 * TILE && m.bombCd <= 0) {
        m.bombCd = 3; m.attackT = 0.2; const dx = player.x - m.x, dy = player.y - m.y, d = dp || 1, sp = 240;
        projectiles.push({ kind: 'sticky', x: m.x + 10, y: m.y - 14, vx: dx / d * sp, vy: dy / d * sp, t: 0, life: dp / sp, fuse: 1.3, owner: 'monster' });
        m.bombsFired = (m.bombsFired || 0) + 1; burst(m.x + 10, m.y - 20, '#3a3a3a', 6, 60);
      }
    }
  });
  // death: a wreck like the walker's, a banner, the story moves on
  HOOKS.kill.push(m => {
    if (m.type !== 'barrelbeast') return;
    const hf = HF(); hf.beastKilled = true;
    const tx = Math.floor(m.x / TILE), ty = Math.floor(m.y / TILE); let spot = null;
    for (let r = 0; r <= 2 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) if (PLACEABLE_ON.has(tileAt(tx + dx, ty + dy)) && !insideBuilding(tx + dx, ty + dy)) spot = { tx: tx + dx, ty: ty + dy };
    if (spot) { changeTile(spot.tx, spot.ty, T.WRECK); hf.wreck = [spot.tx, spot.ty]; }
    burst(m.x, m.y, '#ff8a1a', 40, 220); burst(m.x, m.y, '#3a3a3a', 24, 140);
    say('The Barrelbeast tips, groans, and comes apart. Boiler, barrel, four iron legs. The goblin crew runs for the trees.', 'The Voice');
    say('The wreck stays. Iron bars and scrap would set it walking again, smaller. Hollowford is quiet now. Go to the chapel and tell them.', 'The Voice');
    if (quest.stage === 9) advanceQuest(10); else save();
  });

  // ---------- main quest, stages 8–11 ----------
  HOOKS.mainQuest[8] = { text: () => 'Take the road south from the Goblin Camp to Hollowford.', onEnter: () => {
    say('Hollowford lies south of their camp. The road was broken the night it burned. Go and see what is left, knight.', 'Duke Ferrin');
    say('If anyone still lives there, tell them Thistledown has not forgotten them.', 'Duke Ferrin');
  } };
  HOOKS.mainQuest[9] = { text: () => 'Hollowford is ash. Find the survivors in the chapel, and bring down the Barrelbeast that stamps through the ruins.', onEnter: () => {
    say('Hollowford. Or what the goblins left of it.', 'The Voice');
    say('Listen. That stamping is not the walker you fought. It is bigger. Find the living first. The chapel still has its walls.', 'The Voice');
  } };
  HOOKS.mainQuest[10] = { text: () => 'The Barrelbeast is down. Tell Old Tam in the chapel crypt that Hollowford is safe.', onEnter: () => {
    levelBanner = { text: 'CHAPTER 4 COMPLETE', sub: 'Hollowford', t: 4 }; burst(player.x, player.y, '#ffe066', 30, 160);
  } };
  HOOKS.mainQuest[11] = { text: () => 'Chapter 4 complete. More is being built.', onEnter: () => {
    levelBanner = { text: 'HOLLOWFORD BREATHES', sub: 'The survivors are safe', t: 3.5 };
    say('Chapter 4 is done. What comes after Hollowford is still being built.', 'Fanglands');
  } };

  // ---------- survivors ----------
  NPCS.push(initNpc({ id: 'tam', name: 'Old Tam', x: 126, y: 88, tunic: '#5a5048', hair: '#d9d0c0', beard: true, role: 'survivor', leader: true }));
  NPCS.push(initNpc({ id: 'nell', name: 'Nell', x: 128, y: 89, tunic: '#6a4a4a', hair: '#3a2a1a', woman: true, role: 'survivor',
    lines: ["Don't go near the square. It stands in the square.", 'We had a well. It stood on the well.', 'Tam knows what to do. Tam always knows.'],
    after: ["It's really gone? Pip, it's gone!", 'I can hear birds again.', "We'll need planks. So many planks."] }));
  NPCS.push(initNpc({ id: 'pip', name: 'Pip', x: 126, y: 86, tunic: '#4a5a6a', hair: '#c9843a', role: 'survivor',
    lines: ['I saw it. It has goblins ON it. On TOP of it.', "I'm not scared. Nell is scared.", 'My house had a cellar. I hid under the hatch for two days.'],
    after: ['You broke it! Can I see the wreck? Can I?', "When I'm big I'm going to be a knight.", 'Nell says we can go outside now.'] }));
  HOOKS.talk.survivor = n => {
    const hf = HF();
    if (!n.leader) { say(pick(hf.beastKilled ? n.after : n.lines), n.name); return; }
    if (!hf.beastKilled) { say('Keep your voice down, knight. It walks past every hour. A barrel the size of a house on iron legs, and goblins riding on top of it.', n.name); say('It stood on our well. It walked through the chapel wall. Bring it down and Hollowford can breathe again.', n.name); }
    else if (!hf.rewarded) {
      hf.rewarded = true; giveOrDrop('coins', 200, player.x, player.y); giveOrDrop('steel_helm', 1, player.x, player.y); gainXp('defence', 120);
      say("It's down? The Barrelbeast is DOWN? Nell. Pip. Come up, it's down.", n.name);
      say("Here. Two hundred coins, all Hollowford has left, and the captain's steel helm. He'd want a knight to wear it. Thank you.", n.name);
      burst(player.x, player.y, '#f5c542', 24, 120);
      if (quest.stage === 10) advanceQuest(11); else save();
    } else say("We're digging out the well. When Hollowford has a roof again, there'll be a chair in it for you, knight.", n.name);
  };
  HOOKS.use.push((t, tx, ty) => {
    if (t === T_WELL) { say(HF().rewarded ? 'The survivors are clearing the well. Water again, soon.' : 'Cracked and dry. Something very heavy stood on it.', 'The Well'); return true; }
    if (t === T_HATCH) { say(HF().beastKilled ? 'The hatch stands open. Whoever hid here has gone up to the chapel.' : 'A cellar hatch, barred from below. A small voice: "Go away. No. Wait. Are you a knight? The chapel. Tam is in the chapel. Go quietly."', 'Cellar hatch'); return true; }
    if (t === T_BEAM) { notify('A charred roof beam. Still warm.'); return true; }
    return false;
  });

  // ---------- world: torn palisade, road south, the ruined town ----------
  HOOKS.world.push((rnd, api) => {
    const R = HF_REGION, set = api.setTile, at = api.tileAt;
    const SOFT = [T.GRASS, T.DIRT, T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM, T.STUMP, T.SAND];
    const carve = (pts, w, tile) => { for (let s = 0; s < pts.length - 1; s++) { const [ax, ay] = pts[s], [bx, by] = pts[s + 1], steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)); for (let k = 0; k <= steps; k++) { const x = Math.round(ax + (bx - ax) * k / steps), y = Math.round(ay + (by - ay) * k / steps); for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) if (Math.abs(dx) + Math.abs(dy) <= w && SOFT.includes(at(x + dx, y + dy))) set(x + dx, y + dy, tile); } } };
    const fill = (x0, y0, x1, y1, tile) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, tile); };
    // the goblins dragged the Barrelbeast out through the south palisade; the gap is still there
    for (let x = 149; x <= 151; x++) set(x, 40, T.DIRT);
    const ROAD = [[150, 39], [150, 50], [146, 58], [141, 64], [140, 68]];
    carve(ROAD, 1, T.DIRT); api.road(ROAD, T.DIRT, 2, 0.25);
    // clear the town footprint, then scorch it (worst at the centre)
    for (let y = R.y0; y <= R.y1; y++) for (let x = R.x0; x <= R.x1; x++) {
      if ([T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM].includes(at(x, y))) set(x, y, T.GRASS);
      if (at(x, y) !== T.GRASS) continue;
      const d = dist(x, y, HF_SQUARE.x, HF_SQUARE.y) / 18, r = rnd();
      if (r < 0.8 - d * 0.5) set(x, y, T_SCORCH); else if (r < 0.86 - d * 0.45) set(x, y, T.ASHES);
    }
    // streets and the square
    fill(139, 66, 141, 90, T.DIRT); fill(124, 77, 155, 79, T.DIRT); fill(135, 75, 145, 83, T.DIRT); fill(128, 80, 128, 83, T.DIRT);
    fill(135, 84, 143, 90, T_SCORCH); // the yard where the beast stamps
    // burned houses: broken wall fragments, rubble, ash inside
    const ruin = (x0, y0, x1, y1, door) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const edge = x === x0 || x === x1 || y === y0 || y === y1, corner = (x === x0 || x === x1) && (y === y0 || y === y1), r = rnd();
        if (edge) set(x, y, corner || r < 0.6 ? T.HWALL : r < 0.78 ? T.RUBBLE : T.ASHES);
        else set(x, y, r < 0.12 ? T.RUBBLE : r < 0.5 ? T.ASHES : T_SCORCH);
      }
      set(door[0], door[1], T.ASHES); set(door[0], door[1] + (door[1] === y0 ? 1 : -1), T.ASHES); // doorway and the step inside
    };
    ruin(126, 68, 131, 73, [128, 73]); ruin(133, 69, 137, 72, [135, 72]); ruin(144, 68, 149, 72, [146, 72]);
    ruin(151, 73, 155, 76, [153, 76]); ruin(144, 84, 149, 88, [146, 84]); ruin(151, 82, 155, 86, [153, 82]);
    set(135, 70, T.ANVIL); set(135, 71, T.ASHES);                                 // the smith's anvil survived the fire
    set(HF_HATCH.x, HF_HATCH.y, T_HATCH); set(146, 71, T.ASHES); set(147, 71, T.ASHES); // Pip's cellar
    set(127, 70, T_BEAM); set(148, 86, T_BEAM); set(153, 84, T_BEAM);
    // the chapel: stone walls, the east end collapsed, the crypt at the west end still whole
    for (let y = 84; y <= 91; y++) for (let x = 124; x <= 133; x++) { const edge = x === 124 || x === 133 || y === 84 || y === 91; set(x, y, edge ? T.CWALL : x <= 128 ? T.FLOOR : T.ASHES); }
    set(128, 84, T.DIRT); set(129, 84, T.DIRT);                          // the doorway, doors long gone
    set(133, 86, T.RUBBLE); set(133, 87, T_SCORCH); set(133, 88, T.RUBBLE); // where the beast walked through the wall
    set(131, 86, T.RUBBLE); set(130, 89, T.RUBBLE); set(132, 88, T_BEAM); set(131, 85, T_BEAM);
    set(126, 90, T.TABLE); set(125, 85, T.SHELF);                         // the altar and what they saved
    // the square: cracked well, fallen beams
    set(HF_SQUARE.x, HF_SQUARE.y, T_WELL); set(136, 76, T_BEAM); set(144, 82, T_BEAM);
    // burned trees on the outskirts (never beside a street or a doorway)
    for (let i = 0; i < 40; i++) {
      const x = R.x0 + Math.floor(rnd() * (R.x1 - R.x0 + 1)), y = R.y0 + Math.floor(rnd() * (R.y1 - R.y0 + 1));
      if (dist(x, y, HF_SQUARE.x, HF_SQUARE.y) < 12) continue;
      const ok = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => [T.GRASS, T_SCORCH, T.ASHES].includes(at(x + dx, y + dy)));
      if (ok) set(x, y, T.STUMP);
    }
    for (const [x, y] of [[128, 74], [135, 73], [146, 73], [153, 77], [146, 83], [153, 81]]) set(x, y, T_SCORCH); // doorsteps stay clear
    // goblin patrols and the beast
    api.spawnList('goblin', [[140, 70], [133, 78], [148, 78], [153, 89]]);
    api.spawnList('sapper', [[143, 66], [130, 80]]);
    api.spawnList('brute', [[150, 74], [128, 75]]);
    api.spawnList('barrelbeast', [[HF_BEAST_HOME.x, HF_BEAST_HOME.y]]);
  });

  // ---------- props ----------
  const drawWell = (g, tx, ty) => {
    const cx = tc(tx), cy = tc(ty), hf = HF();
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx + 2, cy + 14, 22, 9, 0, 0, 7); g.fill();
    g.fillStyle = '#7c7f87'; g.beginPath(); g.ellipse(cx, cy + 4, 21, 14, 0, 0, 7); g.fill();
    g.fillStyle = '#5f626a'; g.beginPath(); g.ellipse(cx, cy + 8, 21, 12, 0, 0, Math.PI); g.fill(); // outer face in shadow
    for (let k = 0; k < 11; k++) { const a = k / 11 * Math.PI * 2; g.fillStyle = ['#8d9098', '#979aa2', '#83868e'][k % 3]; g.beginPath(); g.ellipse(cx + Math.cos(a) * 17, cy + 3 + Math.sin(a) * 10.5, 5, 3.5, a, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.stroke(); }
    g.fillStyle = hf.rewarded ? '#2a3a4a' : '#1e1f24'; g.beginPath(); g.ellipse(cx, cy + 2, 12, 7, 0, 0, 7); g.fill();
    if (hf.rewarded) { g.fillStyle = `rgba(120,180,230,${0.35 + Math.sin(time * 2) * 0.15})`; g.beginPath(); g.ellipse(cx, cy + 3, 8, 4, 0, 0, 7); g.fill(); }
    g.fillStyle = '#3a3330'; g.beginPath(); g.moveTo(cx + 12, cy - 6); g.lineTo(cx + 22, cy + 2); g.lineTo(cx + 13, cy + 8); g.closePath(); g.fill(); // the chunk the beast broke off
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 14, cy + 10); g.lineTo(cx - 8, cy + 4); g.lineTo(cx - 10, cy - 2); g.moveTo(cx + 4, cy + 14); g.lineTo(cx + 8, cy + 9); g.stroke(); // cracks
    g.fillStyle = '#2a1e14'; g.fillRect(cx - 18, cy - 30, 5, 34); g.fillRect(cx + 13, cy - 30, 5, 22);
    g.save(); g.translate(cx - 16, cy - 30); g.rotate(0.35); g.fillStyle = '#4a3218'; g.fillRect(0, -2, 26, 4); g.restore(); // the crossbar hangs broken
    g.strokeStyle = '#c9b676'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx + 6, cy - 22); g.lineTo(cx + 8, cy + 2); g.stroke();
    g.fillStyle = 'rgba(15,12,10,0.4)'; g.beginPath(); g.ellipse(cx - 6, cy - 2, 9, 4, 0.4, 0, 7); g.fill(); // soot
  };
  const drawBeam = (g, tx, ty) => {
    const cx = tc(tx), cy = tc(ty), v = (tx * 5 + ty * 3) % 3;
    g.save(); g.translate(cx, cy + 4); g.rotate(v === 0 ? 0.5 : v === 1 ? -0.7 : 0.15);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(2, 8, 24, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#1f1a17'; g.fillRect(-22, -6, 44, 12); g.fillStyle = '#2c2522'; g.fillRect(-22, -6, 44, 4);
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1; for (let k = -18; k < 20; k += 7) { g.beginPath(); g.moveTo(k, -6); g.lineTo(k + 3, 6); g.stroke(); } // char checks
    for (const [ox, k] of [[-12, 0], [4, 1], [16, 2]]) { g.fillStyle = `rgba(255,${110 + k * 20},40,${0.35 + Math.sin(time * 4 + k * 2 + tx) * 0.3})`; g.beginPath(); g.arc(ox, 1, 1.8, 0, 7); g.fill(); } // embers
    g.restore();
  };
  const drawHatch = (g, tx, ty) => {
    const x = tx * TILE, y = ty * TILE, open = HF().beastKilled;
    g.fillStyle = '#2a1e14'; g.fillRect(x + 5, y + 7, 38, 34);
    if (open) { g.fillStyle = '#0d0b09'; g.fillRect(x + 8, y + 10, 32, 28); g.fillStyle = `rgba(255,200,120,${0.25 + Math.sin(time * 3) * 0.1})`; g.fillRect(x + 10, y + 24, 28, 12); g.fillStyle = '#5a3a1e'; g.fillRect(x + 8, y + 2, 32, 9); g.fillStyle = '#3a3a42'; g.fillRect(x + 10, y + 5, 28, 2); }
    else { for (let k = 0; k < 3; k++) { g.fillStyle = k % 2 ? '#5a3a1e' : '#6b4a2a'; g.fillRect(x + 8, y + 10 + k * 10, 32, 9); } g.fillStyle = '#3a3a42'; g.fillRect(x + 8, y + 13, 32, 3); g.fillRect(x + 8, y + 31, 32, 3); g.strokeStyle = '#8f96a3'; g.lineWidth = 2; g.beginPath(); g.arc(x + 24, y + 25, 4, 0, 7); g.stroke(); }
    g.fillStyle = 'rgba(15,12,10,0.35)'; g.beginPath(); g.ellipse(x + 14, y + 12, 10, 5, 0.3, 0, 7); g.fill(); // soot
  };
  const drawSoot = (g, tx, ty, t) => {
    const x = tx * TILE, y = ty * TILE, v = (tx * 7 + ty * 3) % 3;
    const grad = g.createLinearGradient(0, y, 0, y + TILE); grad.addColorStop(0, 'rgba(20,16,14,0.55)'); grad.addColorStop(1, 'rgba(20,16,14,0.18)'); g.fillStyle = grad; g.fillRect(x, y, TILE, TILE);
    g.fillStyle = 'rgba(15,12,10,0.55)'; for (const [ox, oy, r] of [[10 + v * 8, 8, 9], [36 - v * 6, 20 + v * 4, 7], [18 + v * 4, 38, 6]]) { g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.6, v, 0, 7); g.fill(); }
    if (t === T.HWALL) { g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 6, y + 4 + v * 6); g.lineTo(x + 22, y + 20); g.lineTo(x + 16, y + 34); g.lineTo(x + 30, y + 44); g.stroke(); }
  };
  const drawSmoke = (g, tx, ty) => {
    const cx = tc(tx), cy = tc(ty);
    for (let k = 0; k < 2; k++) { const ph = (time * 0.3 + tx * 0.13 + ty * 0.07 + k * 0.5) % 1; g.fillStyle = `rgba(120,120,130,${0.22 * (1 - ph)})`; g.beginPath(); g.arc(cx + Math.sin(time + tx + k) * 6, cy - 6 - ph * 44, 5 + ph * 11, 0, 7); g.fill(); }
  };
  HOOKS.draw.push((g, items, cam) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 2);
    if (x1 < HF_REGION.x0 || x0 > HF_REGION.x1 || y1 < HF_REGION.y0 || y0 > HF_REGION.y1) return;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      if (t === T_WELL) items.push({ y: ty * TILE + TILE - 6, draw: () => drawWell(g, tx, ty) });
      else if (t === T_BEAM) items.push({ y: ty * TILE + TILE - 8, draw: () => drawBeam(g, tx, ty) });
      else if (t === T_HATCH) items.push({ y: ty * TILE - 2 * TILE, draw: () => drawHatch(g, tx, ty) }); // ground level: before anything standing near it
      else if ((t === T.HWALL || t === T.CWALL) && hfIn(tx, ty)) items.push({ y: ty * TILE - 2 * TILE, draw: () => drawSoot(g, tx, ty, t) });
      else if (t === T_SCORCH && hfIn(tx, ty) && (tx * 31 + ty * 17) % 13 === 0) items.push({ y: ty * TILE + TILE + 60, draw: () => drawSmoke(g, tx, ty) });
    }
  });

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const hf = HF(); h.peace(true); projectiles = [];
    { const r = REGIONS.find(r => r.name === 'Hollowford'); const path = F.bfs(150, 41, 140, 76), camp = F.bfs(150, 31, 150, 41);
      check('Hollowford: region in the south-east, road from the camp gap reaches it', !!r && regionAt(140, 80).name === 'Hollowford' && !!path && !!camp && tileAt(150, 41) === T.DIRT, { path: path && path.length, camp: camp && camp.length }); }
    { let hw = 0, cw = 0, sc = 0; for (let y = HF_REGION.y0; y <= HF_REGION.y1; y++) for (let x = HF_REGION.x0; x <= HF_REGION.x1; x++) { const t = tileAt(x, y); if (t === T.HWALL) hw++; else if (t === T.CWALL) cw++; else if (t === T_SCORCH) sc++; }
      const s = NPCS.filter(n => n.role === 'survivor');
      check('Hollowford: burned ruins, collapsed chapel, cracked well, cellar, three survivors in the crypt', hw >= 40 && cw >= 20 && sc >= 80 && s.length === 3 && s.every(n => regionAt(n.x, n.y).name === 'Hollowford' && tileAt(n.x, n.y) === T.FLOOR) && tileAt(HF_SQUARE.x, HF_SQUARE.y) === T_WELL && tileAt(HF_HATCH.x, HF_HATCH.y) === T_HATCH, { hw, cw, sc, survivors: s.length }); }
    { const d = MONSTER_DEFS.barrelbeast, bb = monsters.find(m => m.type === 'barrelbeast');
      check('Barrelbeast spawned in Hollowford: lv 28, 400 hp, max hit 16, def 24, speed 55, aggro, sight 7, respawn 600, boss drops', !!bb && d.level === 28 && d.hp === 400 && d.maxHit === 16 && d.def === 24 && d.speed === 55 && d.aggro && d.sight === 7 * TILE && d.respawn === 600 && d.drops.always.length === 4 && d.drops.rare.chance === 3 && regionAt(Math.floor(bb.home.x / TILE), Math.floor(bb.home.y / TILE)).name === 'Hollowford' && typeof HOOKS.drawMonster.barrelbeast === 'function', { found: !!bb, hp: bb && bb.maxHp }); }
    { const before = quest.stage; if (quest.stage < 8) quest.stage = 8; hf.beastKilled = false; hf.rewarded = false; F.tp(140, 68); F.sim(3, []);
      check('entering Hollowford after Chapter 3 opens Chapter 4 (stage 9, area banner)', quest.stage === 9 && player.region === 'Hollowford' && !!areaBanner && areaBanner.name === 'Hollowford', { before, stage: quest.stage, banner: areaBanner && areaBanner.name }); }
    { const bb = monsters.find(m => m.type === 'barrelbeast'); F.tp(137, 86); bb.dead = false; bb.hp = 150; bb.phase2 = false; bb.stunT = 0; bb.x = player.x + 4 * TILE; bb.y = player.y; bb.home = { x: bb.x, y: bb.y }; bb.state = 'idle';
      const hp0 = player.hp; player.hp = 5000; h.peace(false); const n0 = bb.bombsFired || 0; F.sim(240, []); const fired = (bb.bombsFired || 0) - n0; const sticky = projectiles.some(p => p.kind === 'sticky' && p.owner === 'monster');
      h.peace(true); projectiles = []; player.hp = Math.min(hp0, player.maxHp); player.hurtT = 0;
      check('Barrelbeast phase 2: under half hp it spits sticky bombs at a knight within 6 tiles', fired >= 1 && bb.phase2 === true, { fired, sticky, state: bb.state, hp: bb.hp }); }
    { const bb = monsters.find(m => m.type === 'barrelbeast'); F.tp(137, 87); player.facing = { x: 1, y: 0 }; bb.dead = false; bb.hp = 1; bb.stunT = 0; bb.state = 'idle';
      for (let i = 0; i < 80 && !bb.dead; i++) { bb.x = player.x + 50; bb.y = player.y; bb.stunT = 0; player.attackCd = 0; F.press('Space'); F.sim(3, []); }
      const w = hf.wreck;
      check('Barrelbeast dies into a wreck: CHAPTER 4 COMPLETE banner, stage 10', bb.dead && hf.beastKilled && !!w && tileAt(w[0], w[1]) === T.WRECK && quest.stage === 10 && !!levelBanner && levelBanner.text === 'CHAPTER 4 COMPLETE', { dead: bb.dead, wreck: w, stage: quest.stage, banner: levelBanner && levelBanner.text }); }
    { let free = player.inv.filter(s => !s).length; for (let i = player.inv.length - 1; i >= 0 && free < 2; i--) { const s = player.inv[i]; if (s && s.id !== 'coins' && !ITEMS[s.id].weapon && !ITEMS[s.id].armour) { player.inv[i] = null; free++; } }
      const c0 = coins(); const r = F.talk('tam');
      check('survivor leader rewards the knight after the kill: 200 coins + steel helm, stage 11', typeof r === 'number' && hf.rewarded && (coins() === c0 + 200 || drops.some(d => d.id === 'coins' && d.qty === 200)) && (countItem('steel_helm') >= 1 || drops.some(d => d.id === 'steel_helm')) && quest.stage === 11, { r, coins: coins() - c0, helm: countItem('steel_helm'), stage: quest.stage }); }
    { dialog.queue.length = 0; dialog.cur = null; const r1 = F.goAdjacent(HF_HATCH.x, HF_HATCH.y, 3000); F.press('KeyE'); F.sim(2, []); const hatch = dialog.cur && /hatch/.test(dialog.cur.text);
      dialog.queue.length = 0; dialog.cur = null; const r2 = F.goAdjacent(HF_SQUARE.x, HF_SQUARE.y, 3000); F.press('KeyE'); F.sim(2, []); const well = dialog.cur && /well/.test(dialog.cur.text);
      check('the cellar hatch and the cracked well answer E', typeof r1 === 'number' && typeof r2 === 'number' && !!hatch && !!well, { r1, r2, hatch: dialog.cur && dialog.cur.text }); }
    { const st = quest.stage; const texts = [8, 9, 10, 11].map(s => { quest.stage = s; return questText('main'); }); quest.stage = st;
      check('Chapter 4 quest log reads for stages 8–11', texts.every(t => typeof t === 'string' && t.length > 10) && new Set(texts).size === 4 && /Hollowford/.test(texts[0]) && /Barrelbeast/.test(texts[1]) && /Old Tam/.test(texts[2]) && /Chapter 4 complete/.test(texts[3]), { texts }); }
    h.peace(false); projectiles = [];
  });
}
