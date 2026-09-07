// ============================================================================
// SYSTEMS: physics, combat, gathering, crafting stations, NPC talk, death
// ============================================================================
// ---------- physics ----------
function collides(x, y, r, who = 'person') {
  const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (!solidFor(tileAt(tx, ty), who)) continue;
    const cx = clamp(x, tx * TILE, tx * TILE + TILE), cy = clamp(y, ty * TILE, ty * TILE + TILE);
    if (dist(x, y, cx, cy) < r) return true;
  }
  return false;
}
function moveEntity(e, dx, dy, who = 'person') {
  if (dx && !collides(e.x + dx, e.y, e.r, who)) e.x += dx;
  if (dy && !collides(e.x, e.y + dy, e.r, who)) e.y += dy;
  e.x = clamp(e.x, e.r, MAP_W * TILE - e.r); e.y = clamp(e.y, e.r, MAP_H * TILE - e.r);
}
const playerWho = () => player.mech ? 'beast' : 'player';
// the given point if it is free, else the nearest free tile centre in an expanding ring (up to 6 tiles); null if nothing is free
function safeSpot(x, y, r = 13, who = 'person') {
  if (!collides(x, y, r, who)) return { x, y };
  const ctx = Math.floor(x / TILE), cty = Math.floor(y / TILE);
  for (let ring = 0; ring <= 6; ring++) {
    let best = null;
    for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
      const tx = ctx + dx, ty = cty + dy; if (!inMap(tx, ty)) continue;
      const px = tc(tx), py = tc(ty); if (collides(px, py, r, who)) continue;
      const d = dist(x, y, px, py); if (!best || d < best.d) best = { x: px, y: py, d };
    }
    if (best) return { x: best.x, y: best.y };
  }
  return null;
}
function circleHitsTile(x, y, r, tx, ty) {
  const cx = clamp(x, tx * TILE, tx * TILE + TILE), cy = clamp(y, ty * TILE, ty * TILE + TILE);
  return dist(x, y, cx, cy) < r;
}
const INTERESTING_TILES = new Set([T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.PLANK, T.FIRE, T.OVEN, T.SIGN, T.WATER, T.DUMMY, T.GRAVE, T.SOIL, T.CROP, T.ANVIL, T.FORGE, T.WORKBENCH, T.ALCHEMY, T.WORKSHOP, T.CHEST, T.LODESTONE, T.BED, T.WRECK, T.MECH, T.CART, T.AXESTUMP, T.STONECIRCLE, T.GOLDPILE, T.COUNTER, T.THRONE, T.TRAP, T.STUMP, T.RUBBLE]);
const INTERESTING = t => INTERESTING_TILES.has(t);
function frontTile(e, reach = 36) {
  const own = { tx: Math.floor(e.x / TILE), ty: Math.floor(e.y / TILE) };
  const step = { tx: own.tx + Math.round(e.facing.x), ty: own.ty + Math.round(e.facing.y) };
  const cands = [step];
  for (const r of [reach, reach + 26]) {
    const t = { tx: Math.floor((e.x + e.facing.x * r) / TILE), ty: Math.floor((e.y + e.facing.y * r) / TILE) };
    if ((t.tx !== own.tx || t.ty !== own.ty) && !cands.some(c => c.tx === t.tx && c.ty === t.ty)) cands.push(t);
  }
  for (const t of cands) if (INTERESTING(tileAt(t.tx, t.ty))) return t;
  return cands[0];
}
function npcInFront() {
  let best = null;
  for (const n of NPCS) {
    const d = dist(player.x, player.y, n.px, n.py);
    if (d > 118) continue;
    if (insideBuilding(Math.floor(player.x / TILE), Math.floor(player.y / TILE)) !== insideBuilding(Math.floor(n.px / TILE), Math.floor(n.py / TILE))) continue; // no talking through walls
    const dot = ((n.px - player.x) * player.facing.x + (n.py - player.y) * player.facing.y) / (d || 1);
    if (dot < 0.2 && d > 30) continue;
    if (!best || d < best.d) best = { n, d };
  }
  return best ? best.n : null;
}

// ---------- combat maths (RuneScape-style rolls) ----------
const accuracy = (att, def) => att > def ? 1 - (def + 2) / (2 * (att + 1)) : att / (2 * (def + 1));
function playerMaxHit(ranged = false) {
  if (ranged) { const a = arrowSlot(); const str = a >= 0 ? ITEMS[player.inv[a].id].arrow.str : 0; return 1 + Math.floor((skillLv('range') + 8) * (str + 64) / 320); }
  return 2 + Math.floor((skillLv('melee') + 8) * (gearBonus('str') + 64) / 300) + (player.mech ? 8 : 0);
}
function playerAttackRoll(ranged = false) { return ranged ? (skillLv('range') + 8) * (64 + gearBonus('att')) : (skillLv('melee') + 8) * (64 + gearBonus('att') + (player.mech ? 20 : 0)); }
function playerDefRoll() { return (skillLv('defence') + 8) * (64 + gearBonus('def') + (player.mech ? 30 : 0)); }
function rollHit(attRoll, defRoll, maxHit) { if (!(maxHit > 0)) return 0; return Math.random() < accuracy(attRoll, defRoll) ? rint(1, maxHit) : 0; }
function recordHit(dmg) { if (dmg > player.highestHit) { player.highestHit = dmg; if (dmg > 1) floatText(player.x, player.y - 44, `New highest hit: ${dmg}!`, '#ffd166', 13); } }
const bloodColor = type => ({ goblin: '#7ac943', sapper: '#7ac943', brute: '#5a9a33', boar: '#b5651d', spider: '#5a5a6a', sheep: '#f2f2ec', cow: '#8b5a3a', wolf: '#7a7068', walker: '#8f96a3' })[type] || '#c0504d';

function playerAttack() {
  if (player.attackCd > 0 || player.dead) return;
  player.action = null;
  const w = weaponDef();
  if (w && w.weapon.ranged && !player.mech) { shootArrow(w); return; }
  player.attackT = 0.22; player.attackCd = player.mech ? 0.8 : w ? w.weapon.cd : 0.6; sfx('swing');
  const perk = player.mech ? 'knockback' : w && w.weapon.perk;
  const reach = player.mech ? 70 : w ? 58 : 36, arc = perk === 'cleave' ? -0.3 : 0.35;
  let hitSomething = false;
  for (const m of monsters) {
    if (m.dead) continue;
    const d = dist(player.x, player.y, m.x, m.y);
    if (d > reach + m.r) continue;
    const dot = ((m.x - player.x) * player.facing.x + (m.y - player.y) * player.facing.y) / (d || 1);
    if (dot < arc) continue;
    const dmg = rollHit(playerAttackRoll(), (MONSTER_DEFS[m.type].def + 8) * 64, playerMaxHit());
    hitMonster(m, dmg, perk === 'knockback' ? 46 : 14); hitSomething = true;
  }
  const ft = frontTile(player, 40);
  if (tileAt(ft.tx, ft.ty) === T.DUMMY) {
    const dmg = rollHit(playerAttackRoll(), 9 * 64, playerMaxHit()); const cx = tc(ft.tx), cy = tc(ft.ty);
    floatText(cx, cy - 30, dmg ? `-${dmg}` : 'miss', dmg ? '#ffd166' : '#8fb4ff'); burst(cx, cy - 6, '#d9c88a', 5, 50); recordHit(dmg);
    gainXp('melee', dmg); hitSomething = true;
  }
  if (!hitSomething && !w && !player.mech) notify('You swing your fists. Find a weapon.');
}
function shootArrow(w) {
  const a = arrowSlot(); if (a < 0) { notify('No arrows. Craft stone arrows at a workbench (logs + stone).'); return; }
  player.attackT = 0.22; player.attackCd = w.weapon.cd;
  const arrowId = player.inv[a].id; removeItem(arrowId, 1); sfx('bow');
  projectiles.push({ kind: 'arrow', x: player.x + player.facing.x * 16, y: player.y + player.facing.y * 16, vx: player.facing.x * 420, vy: player.facing.y * 420, t: 0, life: 0.9, str: ITEMS[arrowId].arrow.str, owner: 'player' });
}
function throwBomb(slot) {
  if (player.attackCd > 0) return;
  removeItem('bomb', 1); player.attackT = 0.22; player.attackCd = 0.6;
  projectiles.push({ kind: 'bomb', x: player.x, y: player.y, vx: player.facing.x * 300, vy: player.facing.y * 300, t: 0, life: 0.6, owner: 'player' });
}
function explode(x, y, radius, dmgMin, dmgMax, owner) {
  burst(x, y, '#ff8a1a', 26, 200); burst(x, y, '#3a3a3a', 14, 120); floatText(x, y - 20, 'BOOM', '#ff8a1a', 18); sfx('boom');
  if (owner === 'player') { for (const m of monsters) if (!m.dead && dist(m.x, m.y, x, y) < radius + m.r) hitMonster(m, rint(dmgMin, dmgMax), 30, true); }
  else if (dist(player.x, player.y, x, y) < radius + player.r) hurtPlayer(rint(dmgMin, dmgMax), x, y, true);
}
// source: 'player' (XP, highest hit, offences) or 'companion' (none of those; HOOKS.hit receives it as the third argument)
function hitMonster(m, dmg, knock = 14, fromBomb = false, source = 'player') {
  const def = MONSTER_DEFS[m.type];
  m.hurtT = 0.18; m.angry = true; if (!def.harmless) m.state = 'chase';
  const kx = (m.x - player.x), ky = (m.y - player.y), kd = Math.hypot(kx, ky) || 1;
  moveEntity(m, kx / kd * knock, ky / kd * knock, 'beast');
  if (dmg <= 0) { floatText(m.x, m.y - m.r - 6, 'miss', '#8fb4ff', 13); sfx('miss'); return; }
  m.hp -= dmg; sfx('hit');
  floatText(m.x, m.y - m.r - 6, `-${dmg}`, '#ffd166');
  burst(m.x, m.y, bloodColor(m.type), 6, 70);
  if (source === 'player') recordHit(dmg);
  for (const h of HOOKS.hit) h(m, dmg, source);
  if (!fromBomb && source === 'player') gainXp(weaponDef() && weaponDef().weapon.ranged && !player.mech ? 'range' : 'melee', dmg * 4);
  if (m.hp <= 0) killMonster(m);
}
function rollDrops(def, x, y) {
  const d = def.drops || {}; const out = [];
  for (const [id, a, b] of d.always || []) out.push({ id, qty: rint(a, b) });
  if (d.table) { const total = d.table.reduce((s, r) => s + r[3], 0); let roll = Math.random() * total; for (const [id, a, b, w] of d.table) { roll -= w; if (roll <= 0) { if (id !== 'nothing') out.push({ id, qty: rint(a, b) }); break; } } }
  if (d.rare && Math.random() < 1 / d.rare.chance) { const total = d.rare.table.reduce((s, r) => s + r[3], 0); let roll = Math.random() * total; for (const [id, a, b, w] of d.rare.table) { roll -= w; if (roll <= 0) { out.push({ id, qty: rint(a, b), rare: true }); break; } } }
  for (const o of out) { drops.push({ x: x + rint(-14, 14), y: y + rint(-14, 14), id: o.id, qty: o.qty, t: 0, rare: !!o.rare }); if (o.rare) { levelBanner = { text: 'RARE DROP', sub: ITEMS[o.id].name, t: 3 }; burst(x, y, '#f5c542', 30, 160); } }
}
function killMonster(m) {
  const d = MONSTER_DEFS[m.type];
  m.dead = true; m.deadT = 0; m.respawnT = (d.respawn || 25) + Math.random() * 10;
  player.kills += 1;
  burst(m.x, m.y, bloodColor(m.type), 16, 120);
  rollDrops(d, m.x, m.y);
  for (const h of HOOKS.kill) h(m);
  if (m.type === 'goblin' && quest.stage === 3) { quest.kills += 1; if (quest.kills >= 3) advanceQuest(4); else save(); }
  if (d.mech) { const tx = Math.floor(m.x / TILE), ty = Math.floor(m.y / TILE); if (PLACEABLE_ON.has(tileAt(tx, ty))) changeTile(tx, ty, T.WRECK); say('The walker falls in a heap of barrel and iron. A goblin scrambles out and runs. The wreck stays. Bring iron bars and scrap, and it could walk again.', 'The Voice'); if (quest.stage === 7) { quest.walkerKilled = true; save(); } }
}
function hurtPlayer(dmg, fromX, fromY, sure = false) {
  if (player.dead) return;
  if (player.mech) dmg = Math.ceil(dmg * 0.5);
  if (dmg <= 0) { floatText(player.x, player.y - 24, 'miss', '#8fb4ff', 13); return; }
  player.hurtT = 0.25; player.sinceHurt = 0; player.action = null;
  const kx = player.x - fromX, ky = player.y - fromY, kd = Math.hypot(kx, ky) || 1;
  moveEntity(player, kx / kd * 12, ky / kd * 12, playerWho());
  if (player.mech) { player.mech.hp -= dmg; floatText(player.x, player.y - 34, `-${dmg} (walker)`, '#ffb347'); if (player.mech.hp <= 0) wreckMech(); return; }
  player.hp -= dmg; sfx('hurt');
  floatText(player.x, player.y - 24, `-${dmg}`, '#ff6b6b');
  gainXp('defence', Math.ceil(dmg * 1.5));
  for (const h of HOOKS.hurt) h(dmg, fromX, fromY);
  if (player.hp <= 0) die();
}
// bedSpawn is the bed's own tile; the knight wakes on the nearest free tile next to it (a bed against a wall must not put him in the wall)
function respawnPoint() { const p = player.bedSpawn || (player.visitedVillage ? VILLAGE_SPAWN : SPAWN); return safeSpot(p.x, p.y, 13, 'person') || safeSpot(VILLAGE_SPAWN.x, VILLAGE_SPAWN.y, 13, 'person') || SPAWN; }
function die() {
  player.hp = 0; player.dead = true; player.deadT = 0; player.deaths += 1; closePanel(); player.action = null; sfx('death');
  if (player.mech) { player.mech = null; }
  const items = player.inv.filter(Boolean);
  const lostPrevious = deathKeep && deathKeep.items.length > 0;
  // an empty pack does not replace the chest: what Death holds from last time stays where it is
  if (items.length) deathKeep = { items };
  player.inv = new Array(INV_SLOTS).fill(null);
  if (items.length) say(lostPrevious ? "You fell again. What Death held before is his now. What you carried, he keeps in his chest. Find his house." : "You fell. Death has your pack in his chest. His house has a coffin for a door. One stands by the cave, one in Thistledown.", 'The Voice');
  else if (lostPrevious) say('You fell with empty hands. Death still keeps what he had. Get up, knight.', 'The Voice');
  else say('You fell. Get up, knight.', 'The Voice');
}

// ---------- gathering (timed actions, tool + level gated) ----------
const GATHER = {
  [T.TREE]: { skill: 'woodcutting', tool: 'axe', lv: 1, xp: 25, item: 'wood', fall: 1, leaves: T.STUMP, regrow: 30, label: 'tree' },
  [T.OAK]: { skill: 'woodcutting', tool: 'axe', lv: 5, xp: 37, item: 'oak_log', fall: 0.25, leaves: T.STUMP, regrow: 60, label: 'oak' },
  [T.ROCK]: { skill: 'mining', tool: 'pickaxe', lv: 1, xp: 17, item: 'stone', fall: 1, leaves: T.RUBBLE, regrow: 30, label: 'rock' },
  [T.IRON]: { skill: 'mining', tool: 'pickaxe', lv: 5, xp: 35, item: 'iron_ore', fall: 1, leaves: T.RUBBLE, regrow: 45, label: 'iron rock' },
  [T.COAL]: { skill: 'mining', tool: 'pickaxe', lv: 10, xp: 50, item: 'coal', fall: 1, leaves: T.RUBBLE, regrow: 60, label: 'coal rock' },
};
function startGather(tx, ty) {
  const t = tileAt(tx, ty), g = GATHER[t];
  const tier = hasTool(g.tool);
  if (!tier) { notify(g.tool === 'axe' ? 'You need an axe. There was one in a stump outside the cave.' : 'You need a pickaxe. There is one in a cart at Grey Quarry.'); return; }
  if (skillLv(g.skill) < g.lv) { notify(`You need ${SKILL_DEFS.find(s => s.key === g.skill).name} level ${g.lv} for this ${g.label}.`); return; }
  if (!canFit(g.item, 1)) { notify('Your pack is full.'); return; }
  player.action = { type: g.tool === 'axe' ? 'chop' : 'mine', tx, ty, t: 0, need: Math.max(0.9, 2.2 - tier * 0.4), tier };
}
function finishGather() {
  const a = player.action, t = tileAt(a.tx, a.ty), g = GATHER[t]; player.action = null;
  if (!g) return;
  const chance = Math.min(0.9, 0.35 + (skillLv(g.skill) - g.lv) * 0.02 + a.tier * 0.1);
  burst(tc(a.tx), tc(a.ty), g.tool === 'axe' ? '#8b5a2b' : '#9a9da5', 6, 60);
  if (Math.random() > chance) { player.action = { ...a, t: 0 }; return; } // swing again
  giveOrDrop(g.item, 1, player.x, player.y); gainXp(g.skill, g.xp); sfx('chop');
  if (Math.random() < g.fall) { changeTile(a.tx, a.ty, g.leaves); regrow.push({ i: idx(a.tx, a.ty), t, timer: g.regrow }); }
  else player.action = { ...a, t: 0 };
  save();
}
function startFishing(tx, ty) {
  if (!hasTool('rod')) { notify('Fish flick under the surface. You need a fishing rod (Marta sells them).'); return; }
  if (!canFit('raw_shrimp', 1)) { notify('Your pack is full.'); return; }
  player.action = { type: 'fish', t: 0, need: 1.8, tx, ty };
}
function finishFishing() {
  const lv = skillLv('fishing');
  const chance = Math.min(0.9, 0.45 + lv * 0.02);
  const a = player.action; player.action = { ...a, t: 0 };
  if (Math.random() > chance) return;
  const trout = lv >= 5 && Math.random() < 0.45;
  const id = trout ? 'raw_trout' : 'raw_shrimp';
  giveOrDrop(id, 1, player.x, player.y); gainXp('fishing', trout ? 30 : 10); sfx('fish');
  burst(tc(a.tx), tc(a.ty), '#bfe3ff', 8, 50);
}
function startCook() {
  const slot = player.inv.findIndex(s => s && ITEMS[s.id].cook);
  if (slot < 0) { notify('Nothing raw to cook. Fish, farm, or hunt.'); return; }
  player.action = { type: 'cook', t: 0, need: 1.2, raw: player.inv[slot].id };
}
function finishCook() {
  const raw = player.action.raw; player.action = null;
  if (!countItem(raw)) return;
  const out = ITEMS[raw].cook; const burn = Math.max(0, 0.3 - skillLv('cooking') * 0.03);
  removeItem(raw, 1);
  if (Math.random() < burn) { addItem('burnt_food', 1); floatText(player.x, player.y - 30, 'Burnt!', '#8b8b8b'); }
  else { addItem(out, 1); gainXp('cooking', 30); floatText(player.x, player.y - 30, `Cooked ${ITEMS[out].name}`, '#ffb347'); }
  burst(player.x + player.facing.x * 30, player.y + player.facing.y * 30, '#ffb347', 8, 60); save();
  if (player.inv.some(s => s && ITEMS[s.id].cook)) startCook();
}
function startLightFire(logId) {
  const { tx, ty } = frontTile(player, 40); const t = tileAt(tx, ty);
  if (!PLACEABLE_ON.has(t) || t === T.FLOOR || insideBuilding(tx, ty)) { notify('Light it on open ground in front of you.'); return; }
  if (circleHitsTile(player.x, player.y, player.r + 1, tx, ty)) { notify('Step back a little.'); return; }
  player.action = { type: 'light', t: 0, need: 1.5, tx, ty, log: logId, under: t };
}
function finishLightFire() {
  const a = player.action; player.action = null;
  if (!countItem(a.log)) return;
  removeItem(a.log, 1); changeTile(a.tx, a.ty, T.FIRE); fires.push({ i: idx(a.tx, a.ty), timer: 90, under: a.under }); sfx('fire');
  gainXp('firemaking', ITEMS[a.log].burn); burst(tc(a.tx), tc(a.ty), '#ffb347', 14, 80); save();
}
// ---------- farming ----------
function startTill(tx, ty) {
  if (!hasTool('hoe')) { notify('You need a hoe to till the ground. Greta sells them in the square.'); return; }
  player.action = { type: 'till', t: 0, need: 1.2, tx, ty };
}
function finishTill() { const a = player.action; player.action = null; changeTile(a.tx, a.ty, T.SOIL); gainXp('farming', 5); burst(tc(a.tx), tc(a.ty), '#6a4a2e', 8, 50); save(); }
function plantSeed(tx, ty) {
  const slot = player.inv.findIndex(s => s && ITEMS[s.id].seed);
  if (slot < 0) { notify('Tilled soil. Plant a seed here (Greta sells potato seed; goblins drop it too).'); return; }
  removeItem(player.inv[slot].id, 1); changeTile(tx, ty, T.CROP); crops.push({ i: idx(tx, ty), stage: 0, t: 0 }); gainXp('farming', 8); floatText(player.x, player.y - 30, 'Planted', '#7ee787'); save();
}
function harvest(tx, ty) {
  const c = crops.find(c => c.i === idx(tx, ty));
  if (!c || c.stage < 3) { notify(c ? 'Still growing. Come back soon.' : 'Nothing to harvest.'); return; }
  crops = crops.filter(x => x !== c); changeTile(tx, ty, T.SOIL);
  const n = rint(2, 4); giveOrDrop('potato', n, player.x, player.y); gainXp('farming', 15 * n); burst(tc(tx), tc(ty), '#c9a66b', 10, 60); save();
}
// ---------- crafting and stations ----------
// smithing and smelting are timed: materials stay in the pack until the hammer falls (finishCraft), so a cancelled swing (moving, a hit, closing the panel) costs nothing
function craft(recipe) {
  if (player.action && (player.action.type === 'smith' || player.action.type === 'smelt')) { notify('Still working. Wait for the hammer.'); return false; }
  if (recipe.skill && skillLv(recipe.skill) < recipe.lv) { notify(`Needs ${SKILL_DEFS.find(s => s.key === recipe.skill).name} ${recipe.lv}.`); return false; }
  for (const [id, q] of recipe.needs) if (countItem(id) < q) { notify(`Need ${q} ${ITEMS[id].name}.`); return false; }
  if (recipe.station === 'anvil' && !hasTool('hammer')) { notify('You need a hammer (Marta or Brakka sells one).'); return false; }
  if (!craftFits(recipe)) { notify('Your pack is full.'); return false; }
  if (recipe.station === 'anvil' || recipe.station === 'forge') { player.action = { type: recipe.station === 'anvil' ? 'smith' : 'smelt', t: 0, need: recipe.station === 'anvil' ? 1.8 : 1.5, recipe }; return true; }
  return finishCraft(recipe);
}
// does the product fit once the materials are gone? (a 1-bar dagger fits in the bar's own slot)
function craftFits(recipe) {
  const inv0 = player.inv.map(s => s ? { ...s } : null);
  for (const [id, q] of recipe.needs) removeItem(id, q);
  const ok = canFit(recipe.out, recipe.qty);
  for (let i = 0; i < inv0.length; i++) player.inv[i] = inv0[i];
  return ok;
}
function finishCraft(recipe) {
  for (const [id, q] of recipe.needs) if (countItem(id) < q) { notify(`Need ${q} ${ITEMS[id].name}.`); return false; }
  if (!craftFits(recipe)) { notify('Your pack is full.'); return false; }
  for (const [id, q] of recipe.needs) removeItem(id, q);
  addItem(recipe.out, recipe.qty); if (recipe.skill) gainXp(recipe.skill, recipe.xp); sfx(recipe.station === 'anvil' ? 'anvil' : 'craft');
  floatText(player.x, player.y - 30, `+${recipe.qty} ${ITEMS[recipe.out].name}`, ITEMS[recipe.out].color); burst(player.x + player.facing.x * 30, player.y + player.facing.y * 30, '#ffd166', 8, 60); save();
  return true;
}
function placeAction(id) {
  if (player.dead || player.mech) return;
  if (!id) id = ['plank', 'door', 'bed', 'lodestone', 'workbench', 'goblin_trap'].find(k => countItem(k) > 0);
  if (!id || countItem(id) <= 0) { notify('Nothing to place. Craft planks (C) first.'); return; }
  const def = ITEMS[id]; const t2 = T[def.place];
  const { tx, ty } = frontTile(player, 40);
  const t = tileAt(tx, ty);
  if (!PLACEABLE_ON.has(t)) { notify('Cannot place there.'); return; }
  if (t === T.COBBLE && inVillageBounds(tc(tx), tc(ty))) { notify('The guards would not like that on the street.'); return; }
  for (const m of monsters) if (!m.dead && circleHitsTile(m.x, m.y, m.r + 2, tx, ty)) { notify('Something is in the way.'); return; }
  for (const d of drops) if (circleHitsTile(d.x, d.y, 8, tx, ty)) { notify('Pick that up first.'); return; }
  for (const n of NPCS) if (circleHitsTile(n.px, n.py, 16, tx, ty)) { notify('Someone is standing there.'); return; }
  const ox = player.x, oy = player.y;
  changeTile(tx, ty, t2);
  for (let k = 0; k < 12 && circleHitsTile(player.x, player.y, player.r + 1, tx, ty) && SOLID.has(t2); k++) {
    const nx = player.x - player.facing.x * 2.5, ny = player.y - player.facing.y * 2.5;
    if (collides(nx, ny, player.r, 'player')) break;
    player.x = nx; player.y = ny;
  }
  if (SOLID.has(t2) && circleHitsTile(player.x, player.y, player.r + 1, tx, ty)) { changeTile(tx, ty, t); player.x = ox; player.y = oy; notify('No room. Step back a little.'); return; }
  removeItem(id, 1); burst(tc(tx), tc(ty), '#c8a06a', 8, 50);
  if (t2 === T.LODESTONE) { player.home = safeSpot(tc(tx), tc(ty) + TILE, 13, 'person') || { x: tc(tx), y: tc(ty) + TILE }; notify('Lodestone placed. This is home now. Press H to return (5 minute cooldown).'); }
  save();
}
function useItem(slot) {
  const s = player.inv[slot]; if (!s) return;
  const def = ITEMS[s.id];
  if (def.heal) {
    if (player.hp >= player.maxHp) { notify('You are at full health.'); return; }
    player.hp = Math.min(player.maxHp, player.hp + def.heal); removeItem(s.id, 1); floatText(player.x, player.y - 30, `+${def.heal}`, '#7ee787'); burst(player.x, player.y, '#7ee787', 6, 40); sfx('eat');
  } else if (def.weapon || def.armour) { if (player.mech) { notify('Climb out of the walker first (X).'); return; } equipItem(slot); }
  else if (def.throwable) throwBomb(slot);
  else if (def.place) placeAction(s.id);
  else if (def.burn) startLightFire(s.id);
  else if (def.seed) notify('Plant it: till grass with a hoe (E), then press E on the soil.');
  else if (def.tool === 'rod') notify('Stand at the water and press E to fish.');
  else if (def.tool === 'axe') notify('Face a tree and press E.');
  else if (def.tool === 'pickaxe') notify('Face a rock and press E.');
  else if (def.tool === 'hoe') notify('Face grass and press E to till it.');
  else if (def.cook) notify('Cook this at a fire: face the fire and press E.');
  else if (def.arrow) notify('Equip a shortbow and press Space to shoot.');
  else notify(`${def.name}: worth ${def.value} coins each.`);
}
// ---------- world interaction ----------
function useAction() {
  if (player.dead) return;
  if (player.mech) { const ft = frontTile(player); if (tileAt(ft.tx, ft.ty) === T.PLANK) { changeTile(ft.tx, ft.ty, T.GRASS); burst(tc(ft.tx), tc(ft.ty), '#8b5a2b', 12, 80); notify('The walker crushes the planks.'); } else notify('Press X to climb out of the walker.'); return; }
  const npc = npcInFront();
  const { tx, ty } = frontTile(player);
  const t = tileAt(tx, ty);
  // a wandering villager standing in front of a board, station or door does not block it
  if (npc && !(npc.wander && (SOLID.has(t) || PUSH_THROUGH.has(t)))) { talkTo(npc); return; }
  const b = buildingAt(tx, ty);
  if (t === T.SIGN) { say("→ THISTLEDOWN, 1 mile.   → GREY QUARRY, north.   → HOLLOWFORD (crossed out, burned at the edges).", 'Signpost'); if (quest.stage === 4) advanceQuest(5); return; }
  if (t === T.CHEST) { if (b && b.coffin) { openPanel('coffin'); return; } if (b && b.id === 'bank') { openPanel('bank'); return; } openLootChest(tx, ty); return; }
  if (t === T.GOLDPILE) { notify("Death's gold. He is watching. Leave it."); return; }
  if (t === T.GRAVE) { say('Here lies the last knight of Hollowford. The road took him. The road takes everyone.', 'Gravestone'); return; }
  if (t === T.STONECIRCLE) { player.hp = player.maxHp; burst(player.x, player.y, '#b58cff', 20, 100); say('The old stones hum. Your wounds close. Someone built this long before goblins.', 'The Voice'); return; }
  if (t === T.DUMMY) { notify(`Swing (Space) at the dummy. Your highest hit so far: ${player.highestHit}.`); return; }
  if (t === T.AXESTUMP) { if (!player.tookAxe) { player.tookAxe = true; changeTile(tx, ty, T.STUMP); giveOrDrop('bronze_axe', 1, player.x, player.y); say('A bronze axe, left in a stump. Someone came this way before you. Trees are yours now.', 'The Voice'); save(); } return; }
  if (t === T.CART) { if (!player.tookPick) { player.tookPick = true; giveOrDrop('bronze_pickaxe', 1, player.x, player.y); notify('A bronze pickaxe from the miners’ cart. Face a rock and press E.'); save(); } else notify('An empty miners’ cart.'); return; }
  if (t === T.WATER) { startFishing(tx, ty); return; }
  if (t === T.FIRE || t === T.OVEN) { startCook(); return; }
  if (t === T.SOIL) { plantSeed(tx, ty); return; }
  if (t === T.CROP) { harvest(tx, ty); return; }
  if (t === T.ANVIL) { openPanel('station', 'anvil'); return; }
  if (t === T.FORGE) { openPanel('station', 'forge'); return; }
  if (t === T.WORKBENCH) { openPanel('station', 'workbench'); return; }
  if (t === T.WORKSHOP) { openPanel('station', 'workshop'); return; }
  if (t === T.ALCHEMY) { openPanel('station', 'alchemy'); return; }
  if (t === T.LODESTONE) { player.home = safeSpot(tc(tx), tc(ty) + TILE, 13, 'person') || { x: tc(tx), y: tc(ty) + TILE }; notify('Home set here. Press H to return (5 minute cooldown).'); save(); return; }
  if (t === T.BED) { const near = nearestTileOfType(tx, ty, T.LODESTONE, 6); if (b && b.id !== undefined && !player.home) { /* inn / house beds */ } if (near || (b && b.id === 'inn' && player.innRested)) { player.bedSpawn = { x: tc(tx), y: tc(ty) }; player.hp = player.maxHp; say(near ? 'You sleep. The lodestone hums. You will wake here if you fall.' : 'You sleep well. You will wake here if you fall.', 'The Voice'); save(); } else notify(b && b.id === 'inn' ? 'Pay Dorran for the room first.' : 'A bed needs a lodestone within a few tiles to hold your spirit. Craft one at a workbench.'); return; }
  if (t === T.WRECK) { repairMech(tx, ty); return; }
  if (t === T.MECH) { enterMech(tx, ty); return; }
  if (t === T.TRAP) { changeTile(tx, ty, T.GRASS); giveOrDrop('goblin_trap', 1, player.x, player.y); return; }
  if (t === T.COUNTER || t === T.THRONE) { notify(t === T.THRONE ? "The Duke's seat. Speak to him, not the chair." : 'Speak to whoever is behind the counter.'); return; }
  if (GATHER[t]) { startGather(tx, ty); return; }
  if (t === T.STUMP || t === T.RUBBLE) { notify(t === T.STUMP ? 'A stump. It will grow back.' : 'Rubble. The rock will settle again.'); return; }
  if (t === T.PLANK) { changeTile(tx, ty, T.GRASS); giveOrDrop('plank', 1, player.x, player.y); burst(tc(tx), tc(ty), '#8b5a2b', 6, 60); save(); return; }
  for (const h of HOOKS.use) if (h(t, tx, ty, b)) return;
  if (t === T.GRASS || t === T.DIRT) { if (hasTool('hoe') && !inVillageBounds(tc(tx), tc(ty)) || (t === T.GRASS && hasTool('hoe'))) { startTill(tx, ty); return; } }
  notify('Nothing to use here. Face a tree, rock, water, fire, station or person and press E.');
}
function nearestTileOfType(tx, ty, type, radius) { for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) if (tileAt(tx + dx, ty + dy) === type) return { tx: tx + dx, ty: ty + dy }; return null; }
function openLootChest(tx, ty) {
  const key = tx + ',' + ty;
  if (player.chests.includes(key)) { notify('Empty. Someone has been here.'); return; }
  player.chests.push(key);
  for (const [id, q] of [['coins', 60], ['ruined_helm', 1], ['bronze_dagger', 1], ['stone_arrow', 10]]) giveOrDrop(id, q, player.x, player.y);
  say('An old chest under the fallen tower. Coins, a dented helm, a dagger, a bundle of arrows. Whoever kept watch here is long gone.', 'The Voice'); burst(tc(tx), tc(ty), '#f5c542', 20, 100); save();
}
function goHome() {
  if (!player.home) { notify('No home yet. Craft a lodestone at a workbench and place it.'); return; }
  const left = HOME_COOLDOWN - (time - player.homeCd);
  if (left > 0) { notify(`The lodestone is still cold. ${Math.ceil(left)}s.`); return; }
  if (player.mech) { notify('Climb out of the walker first.'); return; }
  const spot = safeSpot(player.home.x, player.home.y, 13, 'player'); // a plank placed under the lodestone later must not make H a trap
  if (!spot) { notify('Home is buried. Clear the ground around the lodestone.'); return; }
  burst(player.x, player.y, '#7ec8ff', 30, 160); player.x = spot.x; player.y = spot.y; player.homeCd = time; player.action = null;
  burst(player.x, player.y, '#7ec8ff', 30, 160); notify('Home.'); save();
}
// ---------- the goblin walker ----------
function repairMech(tx, ty) {
  if (countItem('iron_bar') < 3 || countItem('goblin_scrap') < 4) { notify(`A wrecked walker. Repair needs 3 iron bars and 4 goblin scrap (you have ${countItem('iron_bar')} and ${countItem('goblin_scrap')}).`); return; }
  removeItem('iron_bar', 3); removeItem('goblin_scrap', 4); changeTile(tx, ty, T.MECH); burst(tc(tx), tc(ty), '#ffb347', 20, 100); gainXp('crafting', 120);
  say('Barrel, boiler, four iron legs and a seat sized for a goblin. It will hold a knight. Press E to climb in.', 'The Voice'); save();
}
function enterMech(tx, ty) {
  changeTile(tx, ty, T.DIRT); player.mech = { hp: 130, maxHp: 130 }; player.x = tc(tx); player.y = tc(ty); player.r = 20; player.speed = 115; player.action = null;
  notify('You are in the walker. Space stomps (knockback). X climbs out. Doors are too small for it.'); save();
}
// the pilot never lands inside a tree or a wall: the walker is parked, then the knight takes the nearest free spot; no free spot = no climbing out
function exitMech() {
  if (!player.mech) return;
  const { tx, ty } = frontTile(player, 44); const t = tileAt(tx, ty);
  const own = { tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) };
  const spot = PLACEABLE_ON.has(t) && !(tx === own.tx && ty === own.ty) ? { tx, ty } : own;
  const onOwn = spot.tx === own.tx && spot.ty === own.ty, prev = tileAt(spot.tx, spot.ty), mech = player.mech;
  changeTile(spot.tx, spot.ty, T.MECH);
  const want = onOwn ? { x: player.x - player.facing.x * TILE, y: player.y - player.facing.y * TILE } : { x: player.x, y: player.y };
  const free = safeSpot(want.x, want.y, 13, 'player');
  if (!free) { changeTile(spot.tx, spot.ty, prev); notify('No room to climb out here. Drive somewhere open.'); return; }
  player.mech = null; player.r = 13; player.speed = 175; player.mechHp = mech.hp;
  player.x = free.x; player.y = free.y;
  notify('You climb out. The walker waits.'); save();
}
function wreckMech() {
  const own = { tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) };
  player.mech = null; player.r = 13; player.speed = 175;
  const prev = tileAt(own.tx, own.ty), placeable = PLACEABLE_ON.has(prev);
  if (placeable) changeTile(own.tx, own.ty, T.WRECK);
  let free = safeSpot(player.x - player.facing.x * TILE, player.y - player.facing.y * TILE, 13, 'player');
  if (!free && placeable) { changeTile(own.tx, own.ty, prev); free = safeSpot(player.x, player.y, 13, 'player'); } // no room for both: the wreck is lost, the knight is not
  if (free) { player.x = free.x; player.y = free.y; }
  burst(player.x, player.y, '#ff8a1a', 30, 160); say('The walker gives out under you. It can be repaired again: iron bars and scrap.', 'The Voice');
}
// ---------- talking ----------
function talkTo(n) {
  { const dx = n.px - player.x, dy = n.py - player.y, d = Math.hypot(dx, dy) || 1; player.facing = { x: dx / d, y: dy / d }; }
  if (HOOKS.talkBefore[n.role] && HOOKS.talkBefore[n.role](n)) return; // a feature file may take over a core role for some stages
  if (n.role === 'shop') { const lines = { general: "Rods, axes, bread, a bit of everything. What do you need, knight?", bakery: "Fresh from the oven. Bread is 8. The pie is worth every coin.", seeds: "Potato seed, two coins. A hoe if you haven't one. Till, plant, wait, eat.", smith: "Bring me a hammer and iron bars and I'll show you the anvil. Ore goes in the forge first." }; say(lines[n.shop] || 'Buying or selling?', n.name); openPanel('shop', n.shop); }
  else if (n.role === 'trader') { say("Pelts, tusks, wool, silk, goblin scrap. I pay full price, no haggling.", n.name); openPanel('shop', 'trader'); }
  else if (n.role === 'bank') { say("Your pack is small and the world is big. Leave what you like with me. It will be here.", n.name); openPanel('bank'); }
  else if (n.role === 'inn') { if (coins() >= 5) { payCoins(5); player.hp = player.maxHp; player.innRested = true; say("Five coins. Hot stew and a bed by the fire. Sleep in it if you want to wake here.", n.name); burst(player.x, player.y, '#7ee787', 10, 40); save(); } else say("A bed's five coins. Come back with coin.", n.name); }
  else if (n.role === 'tinker') { say("Workbench for bows, doors, beds and lodestones. That table for traps and iron arrows. The bubbling one for bombs. Mind your eyebrows.", n.name); }
  else if (n.role === 'death') { say(deathKeep ? "I have your things. They are in the chest. My fee is fair. It always is." : "Not yet. But you will be back. Everyone comes back to me.", 'Death'); openPanel('coffin'); }
  else if (n.role === 'duke') {
    if (quest.stage < 5) say("The road is dangerous, traveller. Speak to me when you have proven yourself on it.", n.name);
    else if (quest.stage === 5) advanceQuest(6);
    else if (quest.stage === 6) { if (skillLv('melee') >= 5 && skillLv('woodcutting') >= 3) advanceQuest(7); else say(`Not yet. Melee ${skillLv('melee')} of 5, Woodcutting ${skillLv('woodcutting')} of 3. Hale's dummies help, and the forest is right outside the gate.`, n.name); }
    else if (quest.stage === 7) { if (quest.walkerKilled) advanceQuest(8); else say("The walker still stands in their camp. East, past the gate, follow the road.", n.name); }
    else say("Rest while you can, knight. Hollowford waits.", n.name);
  }
  else if (n.role === 'trainer') { say(`Hit the dummies. They'll show you your best strike. Your highest hit is ${player.highestHit}. It's slower than real fighting, but nothing hits back.`, n.name); }
  else if (n.role === 'hermit') {
    if (quest.wren === 'none') { quest.wren = 'active'; say("A knight, out here? Then you can do me a turn. Cave spiders spin the finest silk. Five strands and I'll string you a bow.", n.name); save(); }
    else if (quest.wren === 'active') { if (countItem('spider_silk') >= 5) { removeItem('spider_silk', 5); quest.wren = 'done'; giveOrDrop('shortbow', 1, player.x, player.y); giveOrDrop('stone_arrow', 20, player.x, player.y); gainXp('range', 60); say("Good silk. Here: a shortbow, and arrows to learn with. Space shoots. Keep the wolves at arm's length.", n.name); levelBanner = { text: 'QUEST COMPLETE', sub: "Wren's Silk", t: 3 }; save(); } else say(`Five strands of spider silk. You have ${countItem('spider_silk')}. The cave by the road is full of them.`, n.name); }
    else say("The bow treating you well? Wolves hate it.", n.name);
  }
  else if (n.role === 'bread') {
    if (quest.bread === 'none') { quest.bread = 'active'; say("Dude. Dude. Could you get me a loaf of bread? Rosalind's, over there. I'll make it worth your while.", n.name); save(); }
    else if (quest.bread === 'active') {
      if (countItem('bread')) { removeItem('bread', 1); quest.bread = 'done'; giveOrDrop('coins', 30, player.x, player.y); gainXp('cooking', 40); say("Give me that. Ha! You're alright, knight. Here, thirty coins, and don't tell Rosalind I never paid her back.", n.name); levelBanner = { text: 'QUEST COMPLETE', sub: 'A Loaf for Tobin', t: 3 }; save(); }
      else say("Still hungry. Bakery's right there. Eight coins, or bake something yourself.", n.name);
    } else say("Best bread in Thistledown. Thanks again, knight.", n.name);
  }
  else if (n.role === 'villager') say(pick(n.lines), n.name);
  else if (HOOKS.talk[n.role]) HOOKS.talk[n.role](n);
}
// ---------- death's chest ----------
function coffinFee() {
  if (window.__kidmode) return 0; // kid mode: Death returns everything for free
  if (!deathKeep) return 0;
  let fee = 0; for (const s of deathKeep.items) { if (s.id === 'coins') continue; const v = ITEMS[s.id].value * s.qty; if (v >= 20) fee += Math.ceil(v * 0.25); }
  return fee;
}
// the fee is charged per item, only for what actually fits in the pack; what stays in the chest keeps its fee for next time (no double charge)
const itemFee = (id, qty) => { if (id === 'coins') return 0; const v = ITEMS[id].value * qty; return v >= 20 ? Math.ceil(v * 0.25) : 0; };
function reclaimFromDeath() {
  if (!deathKeep) return;
  // Death takes his share from the coins he already holds, then from your pack
  const held = deathKeep.items.find(s => s.id === 'coins'); let purse = held ? held.qty : 0;
  const left = []; let took = 0, short = 0;
  for (const s of deathKeep.items) {
    if (s.id === 'coins') continue;
    const can = Math.min(s.qty, roomFor(s.id));
    const fee = itemFee(s.id, can);
    if (can <= 0) { left.push({ id: s.id, qty: s.qty }); continue; }
    if (fee > purse + coins()) { left.push({ id: s.id, qty: s.qty }); short = Math.max(short, fee - purse - coins()); continue; }
    const fromPurse = Math.min(purse, fee); purse -= fromPurse; if (fee - fromPurse > 0) payCoins(fee - fromPurse);
    addItem(s.id, can); took += can;
    if (can < s.qty) left.push({ id: s.id, qty: s.qty - can });
  }
  if (purse > 0) { addItem('coins', purse); took += purse; } // never fails: coins that do not fit land at your feet
  deathKeep = left.length ? { items: left } : null;
  if (!took && short > 0) { notify(`Death wants ${short} more coins. You have ${coins()}.`); return; }
  say(left.length ? (short > 0 ? "Coin first, knight. I keep the rest until you have it." : "Your pack is full. I will keep the rest. For now.") : "Take them. We will meet again. Everyone does.", 'Death');
  if (!deathKeep) closePanel();
  save();
}
