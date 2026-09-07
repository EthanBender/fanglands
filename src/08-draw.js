// ============================================================================
// DRAWING: people, creatures, props, buildings, item icons
// ============================================================================
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

function drawWeaponInHand(g, e, ang, shape, color) {
  const swing = e.attackT > 0 ? (1 - e.attackT / 0.22) : 0;
  const a = ang + (e.attackT > 0 ? lerp(-1.4, 1.2, swing) : 0.9);
  g.save(); g.rotate(a);
  if (shape === 'sword') { g.fillStyle = color; g.fillRect(6, -2.5, 30, 5); g.fillStyle = '#7a4d22'; g.fillRect(4, -5, 4, 10); g.fillStyle = '#4a2e13'; g.fillRect(-4, -2.2, 8, 4.4); }
  else if (shape === 'dagger') { g.fillStyle = color; g.beginPath(); g.moveTo(5, -2.5); g.lineTo(22, 0); g.lineTo(5, 2.5); g.closePath(); g.fill(); g.fillStyle = '#4a2e13'; g.fillRect(-4, -2, 9, 4); }
  else if (shape === 'axe' || shape === 'battleaxe') { g.fillStyle = '#6b4a2a'; g.fillRect(-4, -2, 30, 4); g.fillStyle = color; g.beginPath(); g.moveTo(18, -3); g.quadraticCurveTo(30, -12, 32, 0); g.quadraticCurveTo(30, 12, 18, 3); g.closePath(); g.fill(); if (shape === 'battleaxe') { g.beginPath(); g.moveTo(18, -3); g.quadraticCurveTo(8, -12, 6, 0); g.quadraticCurveTo(8, 12, 18, 3); g.closePath(); g.fill(); } }
  else if (shape === 'warhammer') { g.fillStyle = '#6b4a2a'; g.fillRect(-4, -2, 30, 4); g.fillStyle = color; g.fillRect(20, -8, 12, 16); }
  else if (shape === 'bow') { g.strokeStyle = color; g.lineWidth = 3; g.beginPath(); g.arc(8, 0, 14, -1.3, 1.3); g.stroke(); g.strokeStyle = '#e9eef5'; g.lineWidth = 1; g.beginPath(); g.moveTo(8 + Math.cos(-1.3) * 14, Math.sin(-1.3) * 14); g.lineTo(8 + Math.cos(1.3) * 14, Math.sin(1.3) * 14); g.stroke(); }
  g.restore();
}
function drawHuman(g, e, look) {
  const fx = e.facing.x, fy = e.facing.y, ang = Math.atan2(fy, fx), hurt = e.hurtT > 0;
  if (look.weapon) drawWeaponInHand(g, e, ang, look.weapon.shape, look.weapon.color);
  else if (look.spear) { const a = ang + (e.attackT > 0 ? -0.2 : 0.75); g.save(); g.rotate(a); g.fillStyle = '#8a6a3a'; g.fillRect(-14, -1.5, 40, 3); g.fillStyle = '#c9ccd3'; g.beginPath(); g.moveTo(26, -4); g.lineTo(36, 0); g.lineTo(26, 4); g.closePath(); g.fill(); g.restore(); }
  else if (look.fists && e.attackT > 0) { const swing = 1 - e.attackT / 0.22; g.fillStyle = '#e8b790'; g.beginPath(); g.arc(Math.cos(ang) * (10 + swing * 16), Math.sin(ang) * (10 + swing * 16), 4, 0, 7); g.fill(); }
  if (look.tool) { const sw = look.toolSwing ? Math.sin(time * 14) * 0.6 : 0; g.save(); g.rotate(ang - 0.7 + sw); g.fillStyle = '#8a6a3a'; g.fillRect(2, -1.5, 26, 3); g.fillStyle = look.toolColor || '#b8863a'; if (look.tool === 'axe') { g.beginPath(); g.moveTo(20, -3); g.quadraticCurveTo(30, -10, 30, 0); g.quadraticCurveTo(30, 10, 20, 3); g.closePath(); g.fill(); } else if (look.tool === 'pickaxe') { g.beginPath(); g.moveTo(24, -2); g.quadraticCurveTo(30, -8, 34, -6); g.lineTo(30, 0); g.lineTo(34, 6); g.quadraticCurveTo(30, 8, 24, 2); g.closePath(); g.fill(); } else if (look.tool === 'hammer') { g.fillRect(20, -6, 10, 12); } else if (look.tool === 'hoe') { g.fillRect(24, -5, 5, 10); } g.restore(); }
  if (look.rod) { g.save(); g.rotate(ang - 0.6); g.strokeStyle = '#8a6a3a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(4, 0); g.lineTo(34, -4); g.stroke(); g.strokeStyle = '#e9eef5'; g.lineWidth = 1; g.beginPath(); g.moveTo(34, -4); g.lineTo(44, 10 + Math.sin(time * 3) * 2); g.stroke(); g.restore(); }
  // body
  g.fillStyle = hurt ? '#ff9a9a' : look.tunic; g.beginPath(); g.ellipse(0, 3, 12, 11, 0, 0, 7); g.fill();
  if (look.woman) { g.fillStyle = hurt ? '#ffb0b0' : look.tunic; g.beginPath(); g.ellipse(0, 9, 13, 6, 0, 0, 7); g.fill(); }
  if (look.apron) { g.fillStyle = '#efe6d4'; g.beginPath(); g.ellipse(0, 6, 7, 7, 0, 0, 7); g.fill(); }
  if (look.body) { g.fillStyle = look.body; g.beginPath(); g.ellipse(0, 3, 11, 9, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-6, -2); g.lineTo(6, -2); g.moveTo(-8, 4); g.lineTo(8, 4); g.stroke(); }
  if (look.shield) { g.fillStyle = look.shield; g.beginPath(); g.moveTo(-16, -6); g.lineTo(-8, -6); g.lineTo(-8, 6); g.lineTo(-12, 10); g.lineTo(-16, 6); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.stroke(); }
  g.fillStyle = look.shoulder || '#9aa3b2'; g.beginPath(); g.arc(-10, -1, 4.5, 0, 7); g.arc(10, -1, 4.5, 0, 7); g.fill();
  g.fillStyle = hurt ? '#ffc7b0' : (look.skin || '#e8b790'); g.beginPath(); g.arc(0, -8, 8, 0, 7); g.fill();
  if (look.beard) { g.fillStyle = look.hair; g.beginPath(); g.ellipse(0, -3, 6, 4, 0, 0, Math.PI); g.fill(); }
  if (look.helm) { g.fillStyle = look.helm; g.beginPath(); g.arc(0, -9, 9, Math.PI, 0); g.fill(); g.fillRect(-9, -9, 18, 3); if (look.wings) { g.fillStyle = '#f5f0d8'; g.beginPath(); g.moveTo(-9, -12); g.lineTo(-18, -22); g.lineTo(-8, -16); g.closePath(); g.moveTo(9, -12); g.lineTo(18, -22); g.lineTo(8, -16); g.closePath(); g.fill(); } }
  else { g.fillStyle = look.hair; g.beginPath(); g.arc(0, -11, 8, Math.PI, 0); g.fill(); if (look.woman) { g.beginPath(); g.ellipse(-8, -6, 3, 7, 0, 0, 7); g.ellipse(8, -6, 3, 7, 0, 0, 7); g.fill(); } }
  if (look.crown) { g.fillStyle = '#f5c542'; g.beginPath(); g.moveTo(-8, -14); g.lineTo(-8, -20); g.lineTo(-4, -16); g.lineTo(0, -22); g.lineTo(4, -16); g.lineTo(8, -20); g.lineTo(8, -14); g.closePath(); g.fill(); }
  g.fillStyle = '#222'; g.beginPath(); g.arc(-3 + fx * 2, -7 + fy * 2, 1.4, 0, 7); g.arc(3 + fx * 2, -7 + fy * 2, 1.4, 0, 7); g.fill();
}
function drawGhost(g, e, big) {
  const s = big ? 1.5 : 1, bob = Math.sin(time * 2) * 3;
  g.save(); g.translate(0, bob); g.scale(s, s);
  // scythe
  g.save(); g.rotate(-0.9); g.strokeStyle = '#5a4a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-6, 22); g.lineTo(18, -26); g.stroke(); g.fillStyle = '#c9ccd3'; g.beginPath(); g.moveTo(18, -26); g.quadraticCurveTo(0, -40, -16, -30); g.quadraticCurveTo(2, -32, 16, -22); g.closePath(); g.fill(); g.restore();
  g.fillStyle = 'rgba(200,210,230,0.85)'; g.beginPath(); g.moveTo(-13, 10); g.quadraticCurveTo(-14, -18, 0, -18); g.quadraticCurveTo(14, -18, 13, 10); for (let k = 0; k < 4; k++) g.quadraticCurveTo(13 - k * 6.5 - 3, 16 + Math.sin(time * 4 + k) * 2, 13 - (k + 1) * 6.5, 10); g.closePath(); g.fill();
  g.fillStyle = 'rgba(120,130,160,0.9)'; g.beginPath(); g.arc(0, -8, 8, 0, 7); g.fill();
  g.fillStyle = '#0b0f14'; g.beginPath(); g.ellipse(-3, -8, 2, 3, 0, 0, 7); g.ellipse(3, -8, 2, 3, 0, 0, 7); g.fill();
  g.restore();
}
function playerLook() {
  const w = weaponDef();
  const look = { tunic: '#3b6fb6', hair: '#5a3a1e', shoulder: player.equip.body ? ITEMS[player.equip.body].color : '#9aa3b2' };
  if (player.equip.helm) look.helm = ITEMS[player.equip.helm].color;
  if (player.equip.body) look.body = ITEMS[player.equip.body].color;
  if (player.equip.shield) look.shield = ITEMS[player.equip.shield].color;
  const a = player.action;
  if (a && (a.type === 'chop' || a.type === 'mine' || a.type === 'till' || a.type === 'smith')) { look.tool = a.type === 'chop' ? 'axe' : a.type === 'mine' ? 'pickaxe' : a.type === 'till' ? 'hoe' : 'hammer'; look.toolSwing = true; look.toolColor = a.tier === 2 ? '#a9adb5' : '#b8863a'; }
  else if (a && a.type === 'fish') look.rod = true;
  else if (w) look.weapon = w; else look.fists = true;
  return look;
}
function drawMech(g, e, hurt, pilot) {
  const bob = e.moving ? Math.sin(e.walkT * 0.7) * 3 : 0, ang = Math.atan2(e.facing.y, e.facing.x);
  g.save(); g.translate(0, bob);
  g.strokeStyle = '#3a3a42'; g.lineWidth = 5; g.lineCap = 'round';
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4, ph = e.moving ? Math.sin(e.walkT * 0.7 + k * 1.6) * 5 : 0; g.beginPath(); g.moveTo(Math.cos(a) * 12, Math.sin(a) * 8 + 6); g.lineTo(Math.cos(a) * 24, Math.sin(a) * 18 + 10 + ph); g.lineTo(Math.cos(a) * 30, Math.sin(a) * 26 + 16); g.stroke(); }
  g.fillStyle = hurt ? '#ffb0b0' : '#7a4a2a'; g.beginPath(); g.ellipse(0, 0, 20, 17, 0, 0, 7); g.fill();
  g.strokeStyle = '#3a3a42'; g.lineWidth = 3; for (const oy of [-8, 0, 8]) { g.beginPath(); g.moveTo(-19, oy); g.lineTo(19, oy); g.stroke(); }
  g.fillStyle = '#5a5a62'; g.beginPath(); g.arc(-10, -14, 5, 0, 7); g.fill(); // boiler
  g.fillStyle = 'rgba(220,220,230,0.5)'; g.beginPath(); g.arc(-12 + Math.sin(time * 5) * 2, -22 - (time * 20) % 8, 4, 0, 7); g.fill(); // steam
  g.save(); g.rotate(ang); g.fillStyle = '#3a3a42'; g.fillRect(14, -4, e.attackT > 0 ? 30 : 18, 8); g.fillStyle = '#8f96a3'; g.fillRect(e.attackT > 0 ? 40 : 28, -7, 8, 14); g.restore();
  if (pilot) { g.save(); g.translate(0, -6); g.scale(0.7, 0.7); drawHuman(g, { facing: e.facing, hurtT: 0, attackT: 0 }, pilot); g.restore(); }
  else { g.fillStyle = '#6fbf3f'; g.beginPath(); g.arc(0, -8, 6, 0, 7); g.fill(); g.fillStyle = '#d62828'; g.beginPath(); g.arc(-2, -9, 1.3, 0, 7); g.arc(2, -9, 1.3, 0, 7); g.fill(); }
  g.restore();
}
function drawCharacter(g, e, kind) {
  const bob = e.moving ? Math.sin(e.walkT) * 2 : 0;
  const fx = e.facing.x, fy = e.facing.y, ang = Math.atan2(fy, fx);
  g.save(); g.translate(e.x, e.y);
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, e.r * 0.85, e.r * 0.9, e.r * 0.45, 0, 0, 7); g.fill();
  g.translate(0, kind === 'walker' || kind === 'playermech' ? 0 : bob);
  const hurt = e.hurtT > 0;
  if (kind === 'player') drawHuman(g, e, playerLook());
  else if (kind === 'playermech') drawMech(g, e, hurt, playerLook());
  else if (kind === 'walker') drawMech(g, e, hurt, null);
  else if (kind === 'guard_m' || kind === 'guard_f') drawHuman(g, e, { tunic: '#7a2e2e', hair: kind === 'guard_f' ? '#c9843a' : '#2a1a0a', helm: '#8f96a3', spear: true, woman: kind === 'guard_f', shoulder: '#8f96a3' });
  else if (kind === 'goblin' || kind === 'sapper' || kind === 'brute') {
    const s = kind === 'brute' ? 1.35 : 1; g.scale(s, s);
    if (kind === 'sapper') { g.fillStyle = '#4a3a2a'; g.beginPath(); g.ellipse(-11, 4, 6, 7, 0, 0, 7); g.fill(); g.fillStyle = '#2f2f35'; g.beginPath(); g.arc(-11, 2, 3.5, 0, 7); g.fill(); }
    g.save(); g.rotate(ang + (e.attackT > 0 ? -0.6 + (1 - e.attackT / 0.2) * 1.4 : 0.7));
    if (kind === 'brute') { g.fillStyle = '#6b4a2a'; g.fillRect(2, -2, 22, 4); g.fillStyle = '#5a5a62'; g.fillRect(20, -7, 9, 14); } else { g.fillStyle = '#c9ccd3'; g.fillRect(6, -1.5, 14, 3); g.fillStyle = '#5a3a1e'; g.fillRect(2, -2, 5, 4); }
    g.restore();
    g.fillStyle = hurt ? '#ffb0b0' : kind === 'brute' ? '#5a9a33' : '#6fbf3f'; g.beginPath(); g.ellipse(0, 3, 11, 10, 0, 0, 7); g.fill();
    g.fillStyle = hurt ? '#ffc0c0' : kind === 'brute' ? '#74b048' : '#8ad35a'; g.beginPath(); g.arc(0, -7, 8, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-7, -9); g.lineTo(-16, -14); g.lineTo(-6, -4); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(7, -9); g.lineTo(16, -14); g.lineTo(6, -4); g.closePath(); g.fill();
    g.fillStyle = '#d62828'; g.beginPath(); g.arc(-3 + fx * 2, -7 + fy * 2, 1.7, 0, 7); g.arc(3 + fx * 2, -7 + fy * 2, 1.7, 0, 7); g.fill();
    if (kind === 'sapper') { g.fillStyle = '#8a6a3a'; g.beginPath(); g.arc(0, -10, 9, Math.PI, 0); g.fill(); g.fillStyle = '#c9ccd3'; g.beginPath(); g.arc(3, -9, 3, 0, 7); g.fill(); } // goggles
    else if (kind === 'brute') { g.fillStyle = '#5a5a62'; g.beginPath(); g.arc(0, -9, 9, Math.PI, 0); g.fill(); }
    else { g.strokeStyle = '#4a3a2a'; g.lineWidth = 2; g.beginPath(); g.arc(0, -8, 8.5, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  } else if (kind === 'boar') {
    g.save(); g.rotate(ang);
    g.fillStyle = hurt ? '#ffb0b0' : '#7a4a2a'; g.beginPath(); g.ellipse(-2, 0, 16, 11, 0, 0, 7); g.fill();
    g.fillStyle = hurt ? '#ffc0c0' : '#8c5a36'; g.beginPath(); g.ellipse(9, 0, 8, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#5a3520'; g.beginPath(); g.ellipse(16, 0, 3.5, 3, 0, 0, 7); g.fill();
    g.strokeStyle = '#f2e9d8'; g.lineWidth = 2; g.beginPath(); g.moveTo(13, -4); g.lineTo(18, -7); g.moveTo(13, 4); g.lineTo(18, 7); g.stroke();
    g.fillStyle = '#222'; g.beginPath(); g.arc(11, -4, 1.4, 0, 7); g.arc(11, 4, 1.4, 0, 7); g.fill();
    g.fillStyle = '#4a2c18'; g.beginPath(); g.moveTo(-12, -8); g.lineTo(-2, -12); g.lineTo(6, -9); g.lineTo(-2, -9); g.closePath(); g.fill();
    g.restore();
  } else if (kind === 'wolf') {
    g.save(); g.rotate(ang);
    g.fillStyle = hurt ? '#ffb0b0' : '#6e6660'; g.beginPath(); g.ellipse(-3, 0, 15, 8, 0, 0, 7); g.fill();
    g.fillStyle = hurt ? '#ffc0c0' : '#7a7068'; g.beginPath(); g.ellipse(10, 0, 8, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#3a3330'; g.beginPath(); g.ellipse(17, 0, 3, 2.5, 0, 0, 7); g.fill();
    g.fillStyle = '#5a5048'; g.beginPath(); g.moveTo(6, -5); g.lineTo(9, -12); g.lineTo(12, -5); g.closePath(); g.moveTo(6, 5); g.lineTo(9, 12); g.lineTo(12, 5); g.closePath(); g.fill();
    g.fillStyle = '#e8c04a'; g.beginPath(); g.arc(12, -3, 1.3, 0, 7); g.arc(12, 3, 1.3, 0, 7); g.fill();
    g.strokeStyle = '#6e6660'; g.lineWidth = 3; g.beginPath(); g.moveTo(-17, 0); g.quadraticCurveTo(-24, -4 + Math.sin(time * 6) * 3, -26, 2); g.stroke();
    g.restore();
  } else if (kind === 'spider') {
    g.save(); g.rotate(ang);
    g.strokeStyle = hurt ? '#ffb0b0' : '#2e2a33'; g.lineWidth = 1.5; g.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const ph = Math.sin(e.walkT * 1.5 + i) * (e.moving ? 2.5 : 0); const lx = -5 + i * 3.5; g.beginPath(); g.moveTo(lx, 0); g.lineTo(lx - 2, -8 - ph); g.lineTo(lx - 5, -11 - ph); g.moveTo(lx, 0); g.lineTo(lx - 2, 8 + ph); g.lineTo(lx - 5, 11 + ph); g.stroke(); }
    g.fillStyle = hurt ? '#ffb0b0' : '#3a3440'; g.beginPath(); g.ellipse(-2, 0, 6, 4.5, 0, 0, 7); g.fill();
    g.fillStyle = hurt ? '#ffc0c0' : '#4a4452'; g.beginPath(); g.arc(5, 0, 3, 0, 7); g.fill();
    g.fillStyle = '#e63946'; g.beginPath(); g.arc(6.5, -1.2, 0.8, 0, 7); g.arc(6.5, 1.2, 0.8, 0, 7); g.fill();
    g.restore();
  } else if (kind === 'sheep') {
    g.save(); g.rotate(ang);
    g.fillStyle = hurt ? '#ffd0d0' : '#f2f2ec'; for (const [ox, oy, r] of [[-6, -5, 7], [-8, 4, 7], [0, 6, 7], [2, -6, 7], [-2, 0, 9], [6, 1, 6]]) { g.beginPath(); g.arc(ox, oy, r, 0, 7); g.fill(); }
    g.fillStyle = '#2b2b2b'; g.beginPath(); g.ellipse(12, 0, 6, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(14, -2, 1.3, 0, 7); g.arc(14, 2, 1.3, 0, 7); g.fill();
    g.fillStyle = '#2b2b2b'; g.beginPath(); g.ellipse(10, -6, 3, 1.5, -0.4, 0, 7); g.ellipse(10, 6, 3, 1.5, 0.4, 0, 7); g.fill();
    g.restore();
  } else if (kind === 'cow') {
    g.save(); g.rotate(ang);
    g.fillStyle = hurt ? '#ffd0d0' : '#f1e9dc'; g.beginPath(); g.ellipse(-2, 0, 17, 12, 0, 0, 7); g.fill();
    g.fillStyle = hurt ? '#ffb0b0' : '#5a3a28'; for (const [ox, oy, r] of [[-9, -4, 5], [2, 5, 6], [-4, 6, 3]]) { g.beginPath(); g.arc(ox, oy, r, 0, 7); g.fill(); }
    g.fillStyle = hurt ? '#ffc0c0' : '#e8dccb'; g.beginPath(); g.ellipse(13, 0, 8, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#e9a9a0'; g.beginPath(); g.ellipse(18, 0, 4, 3.5, 0, 0, 7); g.fill();
    g.strokeStyle = '#d8d0c0'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(10, -6); g.lineTo(9, -12); g.moveTo(10, 6); g.lineTo(9, 12); g.stroke();
    g.fillStyle = '#222'; g.beginPath(); g.arc(14, -3.5, 1.4, 0, 7); g.arc(14, 3.5, 1.4, 0, 7); g.fill();
    g.restore();
  } else if (HOOKS.drawMonster[kind]) HOOKS.drawMonster[kind](g, e, hurt);
  g.restore();
}
function drawNpc(g, n) {
  const e = { x: n.px, y: n.py, r: 13, facing: n.facing, hurtT: 0, attackT: 0, moving: n.moving, walkT: n.walkT };
  const near = dist(player.x, player.y, e.x, e.y) < 110;
  if (near && !n.moving) e.facing = { x: Math.sign(player.x - e.x) || 0, y: Math.sign(player.y - e.y) || 1 };
  g.save(); g.translate(e.x, e.y + (n.moving ? Math.sin(n.walkT) * 2 : 0));
  if (!n.ghost) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, 11, 12, 6, 0, 0, 7); g.fill(); }
  if (n.ghost) drawGhost(g, e, true);
  else drawHuman(g, e, { tunic: n.tunic, hair: n.hair, apron: n.apron, helm: n.helmet ? '#8f96a3' : null, crown: n.crown, woman: n.woman, beard: n.beard, spear: n.helmet, shoulder: n.crown ? '#c9a36a' : '#7a6a5a' });
  g.restore();
  if (near) { g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(n.name, e.x, e.y - (n.ghost ? 44 : 26)); g.fillStyle = n.ghost ? '#b58cff' : '#ffe9a8'; g.fillText(n.name, e.x, e.y - (n.ghost ? 44 : 26)); }
}
// ---------- props ----------
function drawTreeProp(g, tx, ty, oak) {
  const cx = tc(tx), cy = tc(ty), v = variant[idx(tx, ty)], s = oak ? 1.3 : 1;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 14, 16 * s, 7 * s, 0, 0, 7); g.fill();
  g.fillStyle = oak ? '#5a3a1e' : '#6b4a2a'; g.fillRect(cx - 5 * s, cy - 4, 10 * s, 20);
  const tone = oak ? ['#2f6a2a', '#3d8a38', '#245222'] : [['#2f8a3a', '#3ea54a', '#276f30'], ['#33914a', '#48ad5c', '#2a7a3c'], ['#3a8a2e', '#4fa63e', '#2f7024']][v];
  const canopy = [[0, -14, 20], [-13, -6, 15], [13, -6, 15], [0, -2, 15], [-8, -20, 12], [8, -20, 12]];
  for (let i = 0; i < canopy.length; i++) { const [ox, oy, r] = canopy[i]; g.fillStyle = tone[i % 3]; g.beginPath(); g.arc(cx + ox * s, cy + oy * s, r * s, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.arc(cx - 6 * s, cy - 20 * s, 7 * s, 0, 7); g.fill();
}
function drawStumpProp(g, tx, ty) { const cx = tc(tx), cy = tc(ty); g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(cx, cy + 8, 12, 5, 0, 0, 7); g.fill(); g.fillStyle = '#6b4a2a'; g.fillRect(cx - 9, cy - 4, 18, 12); g.fillStyle = '#c9a36a'; g.beginPath(); g.ellipse(cx, cy - 4, 9, 5, 0, 0, 7); g.fill(); g.strokeStyle = '#8a6a3a'; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy - 4, 5, 2.5, 0, 0, 7); g.stroke(); }
function drawRockProp(g, tx, ty, kind) {
  const cx = tc(tx), cy = tc(ty), v = variant[idx(tx, ty)];
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 12, 18, 7, 0, 0, 7); g.fill();
  const pts = [[-18, 6], [-14, -8], [-4, -14], [8, -12], [17, -3], [15, 9], [2, 13], [-10, 12]];
  g.fillStyle = kind === 'iron' ? '#7d6e62' : kind === 'coal' ? '#4a4a52' : ['#8d9098', '#979aa2', '#83868e'][v]; g.beginPath(); for (const [x, y] of pts) g.lineTo(cx + x, cy + y); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(cx - 10, cy - 6); g.lineTo(cx - 2, cy - 12); g.lineTo(cx + 6, cy - 10); g.lineTo(cx - 4, cy - 4); g.closePath(); g.fill();
  if (kind === 'iron') { g.fillStyle = '#c47a3a'; for (const [ox, oy] of [[-8, 2], [4, -4], [8, 6], [-2, 8]]) { g.beginPath(); g.arc(cx + ox, cy + oy, 2.2, 0, 7); g.fill(); } }
  if (kind === 'coal') { g.fillStyle = '#1e1e24'; for (const [ox, oy] of [[-8, 2], [4, -4], [8, 6], [-2, 8]]) { g.beginPath(); g.arc(cx + ox, cy + oy, 2.6, 0, 7); g.fill(); } }
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 6, cy + 2); g.lineTo(cx + 3, cy + 6); g.lineTo(cx + 9, cy + 1); g.stroke();
}
function drawRubbleProp(g, tx, ty) { const cx = tc(tx), cy = tc(ty); g.fillStyle = '#8d9098'; for (const [ox, oy, r] of [[-10, 4, 6], [4, 6, 5], [-2, -4, 4], [10, -2, 4], [2, 0, 3]]) { g.beginPath(); g.arc(cx + ox, cy + oy, r, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.stroke(); } }
function drawSignProp(g, tx, ty) {
  const cx = tc(tx), cy = tc(ty);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 16, 9, 4, 0, 0, 7); g.fill();
  g.fillStyle = '#6b4a2a'; g.fillRect(cx - 3, cy - 30, 6, 48);
  for (const [oy, label, burned] of [[-42, 'THISTLEDOWN', false], [-26, 'GREY QUARRY', false], [-10, 'HOLLOWFORD', true]]) {
    g.fillStyle = burned ? '#8a7350' : '#c9a36a'; g.beginPath(); g.moveTo(cx - 34, cy + oy - 7); g.lineTo(cx + 22, cy + oy - 7); g.lineTo(cx + 32, cy + oy + 1); g.lineTo(cx + 22, cy + oy + 9); g.lineTo(cx - 34, cy + oy + 9); g.closePath(); g.fill();
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#4a2e13'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText(label, cx - 4, cy + oy + 4);
    if (burned) { g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 28, cy + oy + 1); g.lineTo(cx + 20, cy + oy + 2); g.stroke(); }
  }
}
function drawFenceProp(g, tx, ty, gate) {
  const x = tx * TILE, y = ty * TILE;
  const H = t => t === T.FENCE || t === T.GATE;
  const h = H(tileAt(tx - 1, ty)) || H(tileAt(tx + 1, ty)), v = H(tileAt(tx, ty - 1)) || H(tileAt(tx, ty + 1));
  g.fillStyle = gate ? '#a58455' : '#8a6a3a';
  if (h || !v) { g.fillRect(x, y + 18, TILE, 5); g.fillRect(x, y + 30, TILE, 5); if (gate) { g.fillRect(x + 4, y + 18, 4, 17); g.fillRect(x + 40, y + 18, 4, 17); } }
  if (v || !h) { g.fillRect(x + 21, y, 5, TILE); if (gate) { g.fillRect(x + 12, y + 4, 22, 4); g.fillRect(x + 12, y + 40, 22, 4); } }
  if (!gate) { g.fillStyle = '#6b4a2a'; g.fillRect(x + 20, y + 12, 8, 26); g.fillStyle = '#a58455'; g.fillRect(x + 21, y + 12, 3, 24); }
}
function drawDoorProp(g, tx, ty, coffin) {
  const x = tx * TILE, y = ty * TILE;
  if (coffin) { g.fillStyle = '#2a2a33'; g.beginPath(); g.moveTo(x + 14, y + 2); g.lineTo(x + 34, y + 2); g.lineTo(x + 42, y + 16); g.lineTo(x + 36, y + 46); g.lineTo(x + 12, y + 46); g.lineTo(x + 6, y + 16); g.closePath(); g.fill(); g.strokeStyle = '#8b8b9a'; g.lineWidth = 2; g.stroke(); g.strokeStyle = '#6a6a7a'; g.beginPath(); g.moveTo(x + 24, y + 8); g.lineTo(x + 24, y + 40); g.moveTo(x + 14, y + 18); g.lineTo(x + 34, y + 18); g.stroke(); return; }
  g.fillStyle = '#6b4a2a'; g.fillRect(x + 8, y + 2, 32, 44); g.fillStyle = '#8a5a2b'; g.fillRect(x + 11, y + 5, 12, 38); g.fillRect(x + 25, y + 5, 12, 38);
  g.fillStyle = '#f5c542'; g.beginPath(); g.arc(x + 32, y + 26, 2.2, 0, 7); g.fill();
}
function drawPortcullisProp(g, tx, ty) { const x = tx * TILE, y = ty * TILE; g.fillStyle = '#3a3a42'; for (let k = 0; k < 5; k++) g.fillRect(x + 4 + k * 10, y, 3, TILE); for (let k = 0; k < 4; k++) g.fillRect(x, y + 6 + k * 12, TILE, 3); }
function drawFireProp(g, tx, ty) {
  const cx = tc(tx), cy = tc(ty);
  g.fillStyle = '#5a5a60'; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(a) * 16, cy + Math.sin(a) * 12 + 4, 4.5, 0, 7); g.fill(); }
  g.fillStyle = '#6b4a2a'; g.save(); g.translate(cx, cy + 4); g.rotate(0.5); g.fillRect(-12, -3, 24, 6); g.rotate(-1); g.fillRect(-12, -3, 24, 6); g.restore();
  for (let k = 0; k < 3; k++) { const ph = Math.sin(time * 9 + k * 2) * 3; g.fillStyle = ['#ff6a1a', '#ffa030', '#ffe066'][k]; g.beginPath(); g.moveTo(cx - 9 + k * 3, cy + 4); g.quadraticCurveTo(cx - 12 + k * 4, cy - 10 - ph, cx + (k - 1) * 3, cy - 22 - ph * 1.5 - k * 4); g.quadraticCurveTo(cx + 12 - k * 4, cy - 10 + ph, cx + 9 - k * 3, cy + 4); g.closePath(); g.fill(); }
  const gr = g.createRadialGradient(cx, cy, 5, cx, cy, 60); gr.addColorStop(0, 'rgba(255,170,60,0.28)'); gr.addColorStop(1, 'rgba(255,170,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 60, 0, 7); g.fill();
}
function drawAshesProp(g, tx, ty) { const cx = tc(tx), cy = tc(ty); g.fillStyle = '#3a3330'; g.beginPath(); g.ellipse(cx, cy + 4, 14, 8, 0, 0, 7); g.fill(); g.fillStyle = '#6e6660'; for (const [ox, oy] of [[-6, 2], [4, 0], [0, 6]]) { g.beginPath(); g.arc(cx + ox, cy + oy, 2.5, 0, 7); g.fill(); } }
function drawDummyProp(g, tx, ty) {
  const cx = tc(tx), cy = tc(ty);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 14, 10, 5, 0, 0, 7); g.fill();
  g.fillStyle = '#6b4a2a'; g.fillRect(cx - 3, cy - 4, 6, 22); g.fillRect(cx - 16, cy - 6, 32, 5);
  g.fillStyle = '#d9c88a'; g.beginPath(); g.ellipse(cx, cy - 2, 9, 11, 0, 0, 7); g.fill();
  g.fillStyle = '#c9b676'; g.beginPath(); g.arc(cx, cy - 16, 7, 0, 7); g.fill();
  g.strokeStyle = '#7a5a36'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 5, cy - 4); g.lineTo(cx + 5, cy + 2); g.moveTo(cx + 5, cy - 4); g.lineTo(cx - 5, cy + 2); g.stroke();
}
function drawGraveProp(g, tx, ty) {
  const cx = tc(tx), cy = tc(ty);
  g.fillStyle = '#5a4a3a'; g.beginPath(); g.ellipse(cx, cy + 8, 16, 9, 0, 0, 7); g.fill();
  g.fillStyle = '#8d9098'; g.beginPath(); g.moveTo(cx - 9, cy + 4); g.lineTo(cx - 9, cy - 10); g.arc(cx, cy - 10, 9, Math.PI, 0); g.lineTo(cx + 9, cy + 4); g.closePath(); g.fill();
  g.strokeStyle = '#4a4d54'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy - 14); g.lineTo(cx, cy - 2); g.moveTo(cx - 4, cy - 10); g.lineTo(cx + 4, cy - 10); g.stroke();
}
function drawCropProp(g, tx, ty) {
  const cx = tc(tx), cy = tc(ty); const c = crops.find(c => c.i === idx(tx, ty)); const stage = c ? c.stage : 0;
  g.strokeStyle = '#4c9134'; g.lineWidth = 2; g.lineCap = 'round';
  for (let k = 0; k < 3; k++) { const x = cx - 12 + k * 12, h = 4 + stage * 5; g.beginPath(); g.moveTo(x, cy + 8); g.lineTo(x, cy + 8 - h); g.stroke(); if (stage >= 1) { g.fillStyle = '#5aa33e'; g.beginPath(); g.ellipse(x - 3, cy + 6 - h * 0.6, 3, 2, -0.5, 0, 7); g.ellipse(x + 3, cy + 4 - h * 0.8, 3, 2, 0.5, 0, 7); g.fill(); } }
  if (stage >= 3) { g.fillStyle = '#e8e26b'; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(cx - 12 + k * 12, cy - 12, 2.5, 0, 7); g.fill(); } }
}
function drawFurniture(g, tx, ty, t) {
  const x = tx * TILE, y = ty * TILE, cx = tc(tx), cy = tc(ty);
  if (t === T.COUNTER) { g.fillStyle = '#6b4a2a'; g.fillRect(x + 2, y + 10, TILE - 4, 32); g.fillStyle = '#a5763f'; g.fillRect(x + 2, y + 6, TILE - 4, 8); g.strokeStyle = '#4a3218'; g.lineWidth = 1; g.strokeRect(x + 6, y + 18, 14, 18); g.strokeRect(x + 28, y + 18, 14, 18); }
  else if (t === T.TABLE) { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x + 8, y + 36, 32, 6); g.fillStyle = '#8a5a2b'; g.fillRect(x + 6, y + 10, 36, 26); g.fillStyle = '#a5763f'; g.fillRect(x + 8, y + 12, 32, 22); g.fillStyle = '#5a3a1e'; g.fillRect(x + 8, y + 34, 4, 8); g.fillRect(x + 36, y + 34, 4, 8); }
  else if (t === T.BED) { g.fillStyle = '#5a3a1e'; g.fillRect(x + 4, y + 2, TILE - 8, TILE - 4); g.fillStyle = '#c94a5a'; g.fillRect(x + 7, y + 14, TILE - 14, TILE - 18); g.fillStyle = '#f2f2ec'; g.fillRect(x + 7, y + 5, TILE - 14, 12); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.strokeRect(x + 7, y + 5, TILE - 14, 12); }
  else if (t === T.SHELF) { g.fillStyle = '#6b4a2a'; g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4); for (let k = 0; k < 3; k++) { g.fillStyle = '#4a3218'; g.fillRect(x + 4, y + 6 + k * 13, TILE - 8, 3); for (let j = 0; j < 4; j++) { g.fillStyle = ['#c0504d', '#3b6fb6', '#e8c04a', '#5aa33e', '#b58cff'][(k + j + tx) % 5]; g.fillRect(x + 6 + j * 10, y + 9 + k * 13, 7, 8); } } }
  else if (t === T.ANVIL) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 14, 16, 6, 0, 0, 7); g.fill(); g.fillStyle = '#5a3a1e'; g.fillRect(cx - 10, cy + 2, 20, 12); g.fillStyle = '#4a4a52'; g.beginPath(); g.moveTo(cx - 16, cy - 8); g.lineTo(cx + 18, cy - 8); g.lineTo(cx + 22, cy - 4); g.lineTo(cx + 12, cy + 2); g.lineTo(cx - 8, cy + 2); g.lineTo(cx - 12, cy - 2); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(cx - 14, cy - 8, 30, 3); }
  else if (t === T.FORGE) { g.fillStyle = '#4a4a52'; g.fillRect(x + 4, y + 4, TILE - 8, TILE - 8); g.fillStyle = '#2a2a30'; g.fillRect(x + 12, y + 16, TILE - 24, 22); const gl = 0.6 + Math.sin(time * 6) * 0.2; g.fillStyle = `rgba(255,120,30,${gl})`; g.fillRect(x + 15, y + 20, TILE - 30, 14); g.fillStyle = `rgba(255,220,80,${gl})`; g.fillRect(x + 19, y + 24, TILE - 38, 6); const gr = g.createRadialGradient(cx, cy, 5, cx, cy, 50); gr.addColorStop(0, 'rgba(255,140,40,0.25)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 50, 0, 7); g.fill(); }
  else if (t === T.OVEN) { g.fillStyle = '#8a7a6a'; g.fillRect(x + 4, y + 4, TILE - 8, TILE - 8); g.fillStyle = '#3a2a1a'; g.beginPath(); g.arc(cx, cy + 6, 12, Math.PI, 0); g.lineTo(cx + 12, cy + 16); g.lineTo(cx - 12, cy + 16); g.closePath(); g.fill(); g.fillStyle = `rgba(255,140,40,${0.5 + Math.sin(time * 5) * 0.2})`; g.beginPath(); g.arc(cx, cy + 8, 7, Math.PI, 0); g.lineTo(cx + 7, cy + 14); g.lineTo(cx - 7, cy + 14); g.closePath(); g.fill(); }
  else if (t === T.WORKBENCH) { g.fillStyle = '#8a5a2b'; g.fillRect(x + 4, y + 10, TILE - 8, 26); g.fillStyle = '#a5763f'; g.fillRect(x + 6, y + 12, TILE - 12, 22); g.fillStyle = '#5a3a1e'; g.fillRect(x + 6, y + 34, 5, 8); g.fillRect(x + 37, y + 34, 5, 8); g.fillStyle = '#8f96a3'; g.fillRect(x + 12, y + 16, 8, 3); g.fillRect(x + 30, y + 20, 3, 10); g.fillStyle = '#c9a36a'; g.fillRect(x + 22, y + 24, 12, 4); }
  else if (t === T.WORKSHOP) { g.fillStyle = '#5a5a62'; g.fillRect(x + 4, y + 10, TILE - 8, 26); g.fillStyle = '#6e6e78'; g.fillRect(x + 6, y + 12, TILE - 12, 22); g.fillStyle = '#3a3a42'; g.fillRect(x + 6, y + 34, 5, 8); g.fillRect(x + 37, y + 34, 5, 8); g.strokeStyle = '#c47a3a'; g.lineWidth = 2; g.beginPath(); g.arc(cx - 8, cy, 6, 0, 7); g.stroke(); g.beginPath(); g.arc(cx + 6, cy + 2, 4, 0, 7); g.stroke(); g.fillStyle = '#8f96a3'; g.fillRect(cx + 10, cy - 6, 8, 3); }
  else if (t === T.ALCHEMY) { g.fillStyle = '#4a3a5a'; g.fillRect(x + 4, y + 10, TILE - 8, 26); g.fillStyle = '#3a2a4a'; g.fillRect(x + 6, y + 34, 5, 8); g.fillRect(x + 37, y + 34, 5, 8); for (let k = 0; k < 3; k++) { g.fillStyle = ['#7ee787', '#b58cff', '#58a6ff'][k]; g.beginPath(); g.arc(x + 14 + k * 10, y + 22, 4, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x + 12 + k * 10, y + 12, 4, 8); } g.fillStyle = `rgba(126,231,135,${0.4 + Math.sin(time * 4) * 0.2})`; g.beginPath(); g.arc(x + 14, y + 10 - (time * 10 % 6), 2, 0, 7); g.fill(); }
  else if (t === T.THRONE) { g.fillStyle = '#5a2e7a'; g.fillRect(x + 8, y + 2, TILE - 16, TILE - 6); g.fillStyle = '#f5c542'; g.fillRect(x + 8, y + 2, TILE - 16, 5); g.fillRect(x + 8, y + 2, 4, TILE - 6); g.fillRect(x + TILE - 12, y + 2, 4, TILE - 6); g.fillStyle = '#7a3e9a'; g.fillRect(x + 14, y + 22, TILE - 28, 16); }
  else if (t === T.CHEST) { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x + 8, y + 36, 32, 6); g.fillStyle = '#8a5a2b'; g.fillRect(x + 8, y + 12, 32, 26); g.fillStyle = '#6b4a2a'; g.fillRect(x + 8, y + 10, 32, 10); g.fillStyle = '#f5c542'; g.fillRect(x + 21, y + 18, 6, 7); g.strokeStyle = '#4a3218'; g.lineWidth = 1; g.strokeRect(x + 8, y + 10, 32, 28); }
  else if (t === T.RUG) { g.fillStyle = '#7a2e2e'; g.fillRect(x + 3, y + 3, TILE - 6, TILE - 6); g.strokeStyle = '#f5c542'; g.lineWidth = 2; g.strokeRect(x + 8, y + 8, TILE - 16, TILE - 16); }
  else if (t === T.GOLDPILE) { g.fillStyle = '#c9a02a'; g.beginPath(); g.ellipse(cx, cy + 8, 20, 12, 0, 0, 7); g.fill(); g.fillStyle = '#f5c542'; g.beginPath(); g.ellipse(cx, cy, 16, 10, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(cx - 2, cy - 8, 10, 6, 0, 0, 7); g.fill(); g.fillStyle = '#fff2a8'; for (const [ox, oy] of [[-8, 2], [4, -6], [8, 4], [-2, -2]]) { g.beginPath(); g.arc(cx + ox, cy + oy, 2, 0, 7); g.fill(); } }
  else if (t === T.STALL) { g.fillStyle = '#6b4a2a'; g.fillRect(x + 4, y + 20, TILE - 8, 20); g.fillStyle = '#a5763f'; g.fillRect(x + 4, y + 18, TILE - 8, 6); for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#c0504d' : '#f2f2ec'; g.fillRect(x + k * 12, y - 6, 12, 14); } g.fillStyle = '#5a3a1e'; g.fillRect(x + 2, y + 8, 3, 12); g.fillRect(x + TILE - 5, y + 8, 3, 12); g.fillStyle = '#e8c04a'; g.beginPath(); g.arc(x + 14, y + 14, 3, 0, 7); g.arc(x + 30, y + 14, 3, 0, 7); g.fill(); }
  else if (t === T.LODESTONE) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 14, 14, 6, 0, 0, 7); g.fill(); g.fillStyle = '#4a5a72'; g.beginPath(); g.moveTo(cx - 12, cy + 12); g.lineTo(cx - 6, cy - 16); g.lineTo(cx + 6, cy - 16); g.lineTo(cx + 12, cy + 12); g.closePath(); g.fill(); const gl = 0.5 + Math.sin(time * 3) * 0.3; g.fillStyle = `rgba(126,200,255,${gl})`; g.beginPath(); g.moveTo(cx - 5, cy + 6); g.lineTo(cx - 2, cy - 10); g.lineTo(cx + 2, cy - 10); g.lineTo(cx + 5, cy + 6); g.closePath(); g.fill(); }
  else if (t === T.TRAP) { g.strokeStyle = '#8f96a3'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 14, 0, Math.PI); g.stroke(); g.beginPath(); g.arc(cx, cy, 14, Math.PI, 0); g.stroke(); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14); g.lineTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8); g.stroke(); } g.fillStyle = '#c47a3a'; g.beginPath(); g.arc(cx, cy, 3, 0, 7); g.fill(); }
  else if (t === T.WRECK || t === T.MECH) { const e = { x: cx, y: cy, r: 20, facing: { x: 0, y: 1 }, hurtT: 0, attackT: 0, moving: false, walkT: 0 }; g.save(); g.translate(cx, cy); if (t === T.WRECK) { g.rotate(0.35); g.globalAlpha = 0.85; } drawMech(g, e, false, null); if (t === T.WRECK) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(0, -8, 7, 0, 7); g.fill(); } g.restore(); if (t === T.WRECK) { g.fillStyle = 'rgba(80,80,90,0.5)'; g.beginPath(); g.arc(cx + 12 + Math.sin(time * 2) * 3, cy - 30 - (time * 12 % 10), 5, 0, 7); g.fill(); } }
  else if (t === T.CART) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 14, 20, 6, 0, 0, 7); g.fill(); g.fillStyle = '#6b4a2a'; g.fillRect(cx - 18, cy - 8, 36, 18); g.fillStyle = '#8a5a2b'; g.fillRect(cx - 16, cy - 6, 32, 14); g.fillStyle = '#3a3a42'; g.beginPath(); g.arc(cx - 10, cy + 12, 6, 0, 7); g.arc(cx + 10, cy + 12, 6, 0, 7); g.fill(); if (!player.tookPick) { g.save(); g.translate(cx + 2, cy - 4); g.rotate(-0.6); g.fillStyle = '#8a6a3a'; g.fillRect(-10, -1.5, 22, 3); g.fillStyle = '#b8863a'; g.beginPath(); g.moveTo(10, -2); g.quadraticCurveTo(16, -8, 20, -6); g.lineTo(16, 0); g.lineTo(20, 6); g.quadraticCurveTo(16, 8, 10, 2); g.closePath(); g.fill(); g.restore(); } }
  else if (t === T.AXESTUMP) { drawStumpProp(g, tx, ty); g.save(); g.translate(cx + 2, cy - 12); g.rotate(-1.1); g.fillStyle = '#8a6a3a'; g.fillRect(-4, -1.5, 26, 3); g.fillStyle = '#b8863a'; g.beginPath(); g.moveTo(18, -3); g.quadraticCurveTo(28, -10, 28, 0); g.quadraticCurveTo(28, 10, 18, 3); g.closePath(); g.fill(); g.restore(); const gr = g.createRadialGradient(cx, cy - 8, 4, cx, cy - 8, 40); gr.addColorStop(0, 'rgba(255,245,200,0.35)'); gr.addColorStop(1, 'rgba(255,245,200,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy - 8, 40, 0, 7); g.fill(); }
  else if (t === T.STONECIRCLE) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 14, 12, 5, 0, 0, 7); g.fill(); g.fillStyle = '#6e7178'; g.beginPath(); g.moveTo(cx - 10, cy + 14); g.lineTo(cx - 8, cy - 22); g.lineTo(cx + 6, cy - 24); g.lineTo(cx + 10, cy + 14); g.closePath(); g.fill(); g.strokeStyle = `rgba(181,140,255,${0.4 + Math.sin(time * 2 + tx) * 0.3})`; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 2, cy - 14); g.lineTo(cx + 2, cy - 4); g.lineTo(cx - 2, cy + 4); g.stroke(); }
  else if (t === T.FLOWERS) { for (let k = 0; k < 4; k++) { const fx = x + 10 + (k % 2) * 24 + ((tx * 7 + k) % 5), fy = y + 12 + Math.floor(k / 2) * 22; g.strokeStyle = '#3f7d2b'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(fx, fy + 8); g.lineTo(fx, fy); g.stroke(); g.fillStyle = ['#e85d75', '#f5c542', '#f2f2ec', '#b58cff'][(k + tx + ty) % 4]; for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; g.beginPath(); g.arc(fx + Math.cos(a) * 3, fy + Math.sin(a) * 3, 2, 0, 7); g.fill(); } g.fillStyle = '#ffe066'; g.beginPath(); g.arc(fx, fy, 1.5, 0, 7); g.fill(); } }
  else if (t === T.MUSHROOM) { for (let k = 0; k < 3; k++) { const mx = x + 12 + k * 12, my = y + 26 + (k % 2) * 8; g.fillStyle = '#e8dccb'; g.fillRect(mx - 2, my, 4, 8); g.fillStyle = k === 1 ? '#c0504d' : '#a97a3b'; g.beginPath(); g.arc(mx, my, 6, Math.PI, 0); g.fill(); if (k === 1) { g.fillStyle = '#f2f2ec'; g.beginPath(); g.arc(mx - 2, my - 3, 1.2, 0, 7); g.arc(mx + 2, my - 2, 1.2, 0, 7); g.fill(); } } }
}
function drawTower(g, cx, cy) {
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx + 6, cy + 20, 26, 10, 0, 0, 7); g.fill();
  g.fillStyle = '#6e7178'; g.beginPath(); g.arc(cx, cy, 24, 0, 7); g.fill();
  g.fillStyle = '#7c7f87'; g.beginPath(); g.arc(cx, cy, 20, 0, 7); g.fill();
  g.fillStyle = '#5a2e7a'; g.beginPath(); g.moveTo(cx - 22, cy - 4); g.lineTo(cx, cy - 58); g.lineTo(cx + 22, cy - 4); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(cx - 22, cy - 4); g.lineTo(cx, cy - 58); g.lineTo(cx - 4, cy - 4); g.closePath(); g.fill();
  g.fillStyle = '#f5c542'; g.beginPath(); g.moveTo(cx, cy - 58); g.lineTo(cx, cy - 72); g.lineTo(cx + 12, cy - 67); g.lineTo(cx, cy - 62); g.closePath(); g.fill();
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.fillStyle = '#5a5d64'; g.fillRect(cx + Math.cos(a) * 22 - 3, cy + Math.sin(a) * 22 - 3, 6, 6); }
}
function drawBuilding(g, b) {
  const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 6, y + 8, w, h);
  g.fillStyle = b.stone ? '#6e7178' : '#c9b78f'; g.fillRect(x, y + h - 16, w, 16);
  if (b.door !== undefined) { const dx = x + b.door * TILE; g.fillStyle = b.coffin ? '#2a2a33' : '#5a3a1e'; if (b.coffin) { g.beginPath(); g.moveTo(dx + 14, y + h - 22); g.lineTo(dx + 34, y + h - 22); g.lineTo(dx + 40, y + h - 12); g.lineTo(dx + 36, y + h); g.lineTo(dx + 12, y + h); g.lineTo(dx + 8, y + h - 12); g.closePath(); g.fill(); g.strokeStyle = '#8b8b9a'; g.lineWidth = 1.5; g.stroke(); } else { g.fillRect(dx + 12, y + h - 18, 24, 18); g.fillStyle = '#f5c542'; g.beginPath(); g.arc(dx + 30, y + h - 9, 2, 0, 7); g.fill(); } }
  g.fillStyle = b.roof; g.fillRect(x, y, w, h - 16);
  const shade = g.createLinearGradient(x, y, x, y + h - 16); shade.addColorStop(0, 'rgba(255,255,255,0.18)'); shade.addColorStop(0.5, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = shade; g.fillRect(x, y, w, h - 16);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; for (let ry = y + 10; ry < y + h - 16; ry += 10) { g.beginPath(); g.moveTo(x, ry); g.lineTo(x + w, ry); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y + (h - 16) / 2 - 2, w, 4);
  if (!b.coffin) { g.fillStyle = '#7a5a3a'; g.fillRect(x + w - 30, y + 8, 12, 22); g.fillStyle = '#3a2a1a'; g.fillRect(x + w - 32, y + 6, 16, 4); }
  if (b.sign) { g.fillStyle = b.coffin ? '#2a2a33' : '#efe2c4'; g.fillRect(x + w / 2 - 36, y + h - 34, 72, 16); g.strokeStyle = b.coffin ? '#8b8b9a' : '#6b4a2a'; g.strokeRect(x + w / 2 - 36, y + h - 34, 72, 16); g.fillStyle = b.coffin ? '#b58cff' : '#3a2a1a'; g.font = `700 10px ${DISPLAY}`; g.textAlign = 'center'; g.fillText(b.sign, x + w / 2, y + h - 22); }
}
function drawSword(g) {
  const { x, y } = SWORD_POS; const pulse = 0.85 + Math.sin(time * 3) * 0.15;
  const grad = g.createRadialGradient(x, y, 4, x, y, 60 * pulse); grad.addColorStop(0, 'rgba(255,245,200,0.55)'); grad.addColorStop(1, 'rgba(255,245,200,0)');
  g.fillStyle = grad; g.beginPath(); g.arc(x, y, 60 * pulse, 0, 7); g.fill();
  g.save(); g.translate(x, y - 4 + Math.sin(time * 2) * 3); g.rotate(-0.8);
  g.fillStyle = '#c9a36a'; g.fillRect(-16, -2.5, 30, 5); g.fillStyle = '#7a4d22'; g.fillRect(-19, -5, 4, 10); g.fillStyle = '#4a2e13'; g.fillRect(-26, -2.2, 8, 4.4);
  g.restore();
}
function drawItemIcon(g, id, x, y, size = 18) {
  const def = ITEMS[id]; const s = size / 18;
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = def.color; g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2;
  switch (def.shape) {
    case 'coins': g.fillStyle = '#c9a02a'; g.beginPath(); g.ellipse(2, 3, 8, 4, 0, 0, 7); g.fill(); g.fillStyle = '#f5c542'; g.beginPath(); g.ellipse(-1, 0, 8, 4, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(1, -4, 8, 4, 0, 0, 7); g.fill(); g.strokeStyle = '#b8891a'; g.beginPath(); g.ellipse(1, -4, 4, 2, 0, 0, 7); g.stroke(); break;
    case 'log': g.save(); g.rotate(-0.5); g.fillRect(-10, -4, 20, 8); g.strokeRect(-10, -4, 20, 8); g.fillStyle = '#e8d3a8'; g.beginPath(); g.ellipse(10, 0, 3, 4, 0, 0, 7); g.fill(); g.restore(); break;
    case 'rock': g.beginPath(); for (const [px, py] of [[-9, 3], [-7, -4], [-2, -8], [5, -7], [9, -1], [7, 6], [0, 8], [-6, 7]]) g.lineTo(px, py); g.closePath(); g.fill(); g.stroke(); if (id === 'iron_ore') { g.fillStyle = '#c47a3a'; g.beginPath(); g.arc(-3, 0, 2, 0, 7); g.arc(3, 3, 1.6, 0, 7); g.fill(); } break;
    case 'bar': g.beginPath(); g.moveTo(-10, 4); g.lineTo(-7, -4); g.lineTo(8, -4); g.lineTo(11, 4); g.closePath(); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-6, -3, 10, 2); break;
    case 'plank': g.fillRect(-10, -3, 20, 6); g.strokeRect(-10, -3, 20, 6); g.fillStyle = '#4a3218'; g.beginPath(); g.arc(-7, 0, 1, 0, 7); g.arc(7, 0, 1, 0, 7); g.fill(); break;
    case 'door': g.fillRect(-6, -9, 12, 18); g.strokeRect(-6, -9, 12, 18); g.fillStyle = '#f5c542'; g.beginPath(); g.arc(3, 1, 1.3, 0, 7); g.fill(); break;
    case 'bed': g.fillStyle = '#5a3a1e'; g.fillRect(-9, -7, 18, 14); g.fillStyle = '#c94a5a'; g.fillRect(-7, -1, 14, 6); g.fillStyle = '#f2f2ec'; g.fillRect(-7, -5, 14, 4); break;
    case 'lodestone': g.fillStyle = '#4a5a72'; g.beginPath(); g.moveTo(-7, 8); g.lineTo(-4, -8); g.lineTo(4, -8); g.lineTo(7, 8); g.closePath(); g.fill(); g.fillStyle = '#7ec8ff'; g.beginPath(); g.moveTo(-3, 5); g.lineTo(-1, -5); g.lineTo(1, -5); g.lineTo(3, 5); g.closePath(); g.fill(); break;
    case 'bench': g.fillRect(-10, -4, 20, 8); g.stroke(); g.fillStyle = '#5a3a1e'; g.fillRect(-8, 4, 3, 5); g.fillRect(5, 4, 3, 5); break;
    case 'trap': g.strokeStyle = '#8f96a3'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 7, 0, 7); g.stroke(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 7, Math.sin(a) * 7); g.lineTo(Math.cos(a) * 4, Math.sin(a) * 4); g.stroke(); } break;
    case 'scrap': g.beginPath(); g.moveTo(-8, -5); g.lineTo(7, -8); g.lineTo(9, 5); g.lineTo(-5, 8); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#c9d4e2'; g.fillRect(-2, -2, 4, 4); break;
    case 'powder': g.fillStyle = '#8a6a3a'; g.beginPath(); g.moveTo(-7, 8); g.lineTo(-5, -4); g.lineTo(5, -4); g.lineTo(7, 8); g.closePath(); g.fill(); g.fillStyle = '#4a4a52'; g.beginPath(); g.ellipse(0, -5, 5, 2.5, 0, 0, 7); g.fill(); break;
    case 'silk': g.strokeStyle = def.color; g.lineWidth = 1.4; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(0, 0, 3 + k * 3, 0, 7); g.stroke(); } for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); g.stroke(); } break;
    case 'wool': for (const [px, py] of [[-5, -3], [4, -4], [-3, 4], [5, 3], [0, 0]]) { g.beginPath(); g.arc(px, py, 5, 0, 7); g.fill(); } g.beginPath(); g.arc(0, 0, 8, 0, 7); g.stroke(); break;
    case 'pelt': g.beginPath(); g.moveTo(-9, -6); g.lineTo(-4, -9); g.lineTo(4, -9); g.lineTo(9, -6); g.lineTo(7, 8); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke(); break;
    case 'tusk': g.beginPath(); g.moveTo(-8, 6); g.quadraticCurveTo(0, -10, 9, -4); g.quadraticCurveTo(2, -4, -5, 8); g.closePath(); g.fill(); g.stroke(); break;
    case 'seed': for (const [px, py] of [[-4, -2], [3, -4], [0, 3], [5, 3]]) { g.beginPath(); g.ellipse(px, py, 3, 2, 0.5, 0, 7); g.fill(); } break;
    case 'potato': g.beginPath(); g.ellipse(0, 0, 8, 6, 0.3, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#8a6a3a'; g.beginPath(); g.arc(-3, -1, 1, 0, 7); g.arc(3, 2, 1, 0, 7); g.fill(); break;
    case 'meat': g.beginPath(); g.ellipse(0, 0, 9, 6, -0.4, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#f2e9d8'; g.beginPath(); g.arc(-6, 3, 2.5, 0, 7); g.fill(); break;
    case 'fish': g.beginPath(); g.ellipse(-1, 0, 8, 4.5, 0, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.moveTo(6, 0); g.lineTo(11, -4); g.lineTo(11, 4); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#222'; g.beginPath(); g.arc(-5, -1, 1, 0, 7); g.fill(); break;
    case 'bread': g.beginPath(); g.ellipse(0, 0, 9, 5.5, 0, 0, 7); g.fill(); g.stroke(); g.strokeStyle = '#8a5a2b'; g.beginPath(); g.moveTo(-5, -2); g.lineTo(-3, 2); g.moveTo(-1, -2); g.lineTo(1, 2); g.moveTo(3, -2); g.lineTo(5, 2); g.stroke(); break;
    case 'pie': g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#e8c07a'; g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill(); break;
    case 'rod': g.strokeStyle = '#8a6a3a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-9, 9); g.lineTo(8, -8); g.stroke(); g.strokeStyle = '#e9eef5'; g.lineWidth = 1; g.beginPath(); g.moveTo(8, -8); g.lineTo(10, 4); g.stroke(); g.fillStyle = '#c0504d'; g.beginPath(); g.arc(10, 5, 1.8, 0, 7); g.fill(); break;
    case 'sword': g.save(); g.rotate(-0.8); g.fillStyle = def.color; g.fillRect(-4, -2, 14, 4); g.fillStyle = '#7a4d22'; g.fillRect(-6, -4, 3, 8); g.fillStyle = '#4a2e13'; g.fillRect(-11, -1.8, 6, 3.6); g.restore(); break;
    case 'dagger': g.save(); g.rotate(-0.8); g.beginPath(); g.moveTo(-2, -2); g.lineTo(10, 0); g.lineTo(-2, 2); g.closePath(); g.fill(); g.fillStyle = '#4a2e13'; g.fillRect(-8, -1.5, 6, 3); g.restore(); break;
    case 'axe': case 'battleaxe': g.save(); g.rotate(-0.8); g.fillStyle = '#6b4a2a'; g.fillRect(-10, -1.5, 18, 3); g.fillStyle = def.color; g.beginPath(); g.moveTo(4, -3); g.quadraticCurveTo(12, -9, 12, 0); g.quadraticCurveTo(12, 9, 4, 3); g.closePath(); g.fill(); if (def.shape === 'battleaxe') { g.beginPath(); g.moveTo(4, -3); g.quadraticCurveTo(-4, -9, -4, 0); g.quadraticCurveTo(-4, 9, 4, 3); g.closePath(); g.fill(); } g.restore(); break;
    case 'warhammer': g.save(); g.rotate(-0.8); g.fillStyle = '#6b4a2a'; g.fillRect(-10, -1.5, 18, 3); g.fillStyle = def.color; g.fillRect(4, -5, 7, 10); g.restore(); break;
    case 'pickaxe': g.save(); g.rotate(-0.8); g.fillStyle = '#8a6a3a'; g.fillRect(-9, -1.5, 18, 3); g.fillStyle = def.color; g.beginPath(); g.moveTo(6, -2); g.quadraticCurveTo(10, -7, 13, -5); g.lineTo(10, 0); g.lineTo(13, 5); g.quadraticCurveTo(10, 7, 6, 2); g.closePath(); g.fill(); g.restore(); break;
    case 'hoe': g.save(); g.rotate(-0.8); g.fillStyle = '#8a6a3a'; g.fillRect(-9, -1.5, 18, 3); g.fillStyle = def.color; g.fillRect(8, -4, 3, 8); g.restore(); break;
    case 'hammer': g.save(); g.rotate(-0.8); g.fillStyle = '#8a6a3a'; g.fillRect(-9, -1.5, 16, 3); g.fillStyle = '#5a5a62'; g.fillRect(5, -5, 6, 10); g.restore(); break;
    case 'bow': g.strokeStyle = def.color; g.lineWidth = 2.5; g.beginPath(); g.arc(-3, 0, 9, -1.2, 1.2); g.stroke(); g.strokeStyle = '#e9eef5'; g.lineWidth = 1; g.beginPath(); g.moveTo(-3 + Math.cos(-1.2) * 9, Math.sin(-1.2) * 9); g.lineTo(-3 + Math.cos(1.2) * 9, Math.sin(1.2) * 9); g.stroke(); break;
    case 'arrow': g.strokeStyle = '#8a6a3a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-9, 8); g.lineTo(7, -7); g.stroke(); g.fillStyle = def.color; g.beginPath(); g.moveTo(7, -7); g.lineTo(9, -2); g.lineTo(3, -4); g.closePath(); g.fill(); g.fillStyle = '#e63946'; g.beginPath(); g.moveTo(-9, 8); g.lineTo(-8, 4); g.lineTo(-5, 7); g.closePath(); g.fill(); break;
    case 'bomb': g.fillStyle = '#2f2f35'; g.beginPath(); g.arc(0, 2, 7, 0, 7); g.fill(); g.strokeStyle = '#8a6a3a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(2, -5); g.quadraticCurveTo(5, -9, 8, -8); g.stroke(); g.fillStyle = '#ffb347'; g.beginPath(); g.arc(8, -8, 1.8, 0, 7); g.fill(); break;
    case 'helm': g.beginPath(); g.arc(0, 1, 8, Math.PI, 0); g.lineTo(8, 5); g.lineTo(-8, 5); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#222'; g.fillRect(-5, 1, 10, 2); break;
    case 'body': g.beginPath(); g.moveTo(-8, -6); g.lineTo(-4, -9); g.lineTo(4, -9); g.lineTo(8, -6); g.lineTo(7, 8); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.moveTo(-5, -2); g.lineTo(5, -2); g.moveTo(-5, 3); g.lineTo(5, 3); g.stroke(); break;
    case 'legs': g.beginPath(); g.moveTo(-7, -8); g.lineTo(7, -8); g.lineTo(7, 8); g.lineTo(2, 8); g.lineTo(0, -1); g.lineTo(-2, 8); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke(); break;
    case 'shield': g.beginPath(); g.moveTo(-8, -8); g.lineTo(8, -8); g.lineTo(8, 2); g.lineTo(0, 9); g.lineTo(-8, 2); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#7a2e2e'; g.fillRect(-1, -6, 2, 10); g.fillRect(-5, -2, 10, 2); break;
    default: g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill(); g.stroke();
  }
  g.restore();
}
function drawDrop(g, d) {
  const y = d.y + Math.sin(d.t * 4) * 2;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(d.x, d.y + 7, 7, 3, 0, 0, 7); g.fill();
  if (d.rare) { const gr = g.createRadialGradient(d.x, y, 2, d.x, y, 26); gr.addColorStop(0, 'rgba(245,197,66,0.5)'); gr.addColorStop(1, 'rgba(245,197,66,0)'); g.fillStyle = gr; g.beginPath(); g.arc(d.x, y, 26, 0, 7); g.fill(); }
  drawItemIcon(g, d.id, d.x, y, 16);
}
