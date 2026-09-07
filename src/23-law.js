// ============================================================================
// LAW — consequences for attacking Thistledown.
// A wanted level (0–3) in player.law, hostile guards while wanted, shops that refuse you,
// reinforcements at the gates, and a Captain of the Watch who takes fines and buys goblin scrap.
// Registered entirely through HOOKS; no core file is edited.
// ============================================================================
const LAW_GUARD_TYPES = ['guard_m', 'guard_f'];
const LAW_HIT_TIMER = 120;     // seconds before the wanted level starts to decay after an offence
const LAW_DECAY = 60;          // seconds per level of decay once it starts
const LAW_KILL_FINE = 150;     // coins added to the fine for killing a guard
const LAW_LEVEL_FINE = 25;     // coins per wanted star when settling with the captain
const LAW_SCRAP_PAY = 5;       // coins per goblin scrap handed in
const LAW_ARM_RANGE = 8 * TILE; // guards within this range of the player are set hostile every tick while wanted
const LAW_TEMP_POSTS = [[86, 32], [139, 32]]; // reinforcement posts: just inside the west and east gates
const LAW_CAPTAIN = { id: 'captain', name: 'Captain Roderick', x: 110, y: 41, tunic: '#a8302a', hair: '#4a2a14', helmet: true, beard: true, role: 'captain' };
let lawArmed = false; // true while guards have been told to fight; stand them down when wanted returns to 0

const lawIsGuard = m => LAW_GUARD_TYPES.includes(m.type);
function law() { if (!player.law) player.law = { wanted: 0, timer: 0, fines: 0 }; return player.law; }
const lawStars = n => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));
const lawFine = () => law().fines + law().wanted * LAW_LEVEL_FINE;
const lawOwes = () => law().wanted > 0 || law().fines > 0;

// ---------- offences ----------
function lawOffend(level) {
  const L = law(); const before = L.wanted;
  L.wanted = clamp(level, 0, 3); L.timer = LAW_HIT_TIMER;
  if (L.wanted > before) {
    floatText(player.x, player.y - 42, 'WANTED ' + '★'.repeat(L.wanted), '#ff6b6b', 16);
    notify(L.wanted >= 3 ? 'The whole watch is after you! Reinforcements at the gates.' : `The watch is after you! Wanted ${lawStars(L.wanted)}`);
    if (before === 0) say("Striking the watch inside the walls? The Captain will want words. And coin.", 'The Voice');
    save();
  }
}
HOOKS.hit.push((m, dmg, source) => {
  if (source && source !== 'player') return; // your hero's swings are not your offences
  if (!lawIsGuard(m) || !inVillageBounds(m.x, m.y)) return;
  lawOffend(law().wanted + 1);
});
HOOKS.kill.push(m => {
  if (!lawIsGuard(m)) return;
  const L = law(); L.fines += LAW_KILL_FINE;
  lawOffend(3);
  notify(`A guard is down. Fine: ${L.fines} coins.`);
  say(`A guard of Thistledown, dead by a knight's hand. That is a ${LAW_KILL_FINE} coin fine, and the Captain will not forget it.`, 'The Voice');
  save();
});

// ---------- guards: arm, reinforce, stand down ----------
function lawTempGuard(tx, ty) {
  const d = MONSTER_DEFS.guard_m;
  return {
    type: 'guard_m', x: tc(tx), y: tc(ty), home: { x: tc(tx), y: tc(ty) },
    r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: true, state: 'idle', wanderT: 1,
    wander: { x: 0, y: 0 }, attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 0, facing: { x: 1, y: 0 }, walkT: 0, moving: false, stunT: 0, temp: true,
  };
}
function lawSpawnReinforcements() {
  for (const [tx, ty] of LAW_TEMP_POSTS) { monsters.push(lawTempGuard(tx, ty)); burst(tc(tx), tc(ty), 'rgba(255,255,255,0.7)', 12, 70); }
}
function lawStandDown() {
  for (const m of monsters) if (lawIsGuard(m) && !m.dead) { m.angry = false; m.state = 'return'; }
  if (monsters.some(m => m.temp)) monsters = monsters.filter(m => !m.temp);
  lawArmed = false;
}
function lawArrest() {
  // The watch caught you (you fell while wanted): the stars become fine, the guards stand down. No death loops in town.
  const L = law();
  L.fines += L.wanted * LAW_LEVEL_FINE; L.wanted = 0; L.timer = 0;
  lawStandDown();
  say(`The watch drags you to the gate and turns out your pockets. You owe the town ${L.fines} coins. Pay the Captain by the castle.`, LAW_CAPTAIN.name);
  save();
}

HOOKS.update.push(dt => {
  const L = law();
  if (L.wanted > 0 && player.dead) lawArrest();
  if (L.wanted > 0) {
    L.timer -= dt;
    if (L.timer <= 0) {
      L.wanted -= 1; L.timer = L.wanted > 0 ? LAW_DECAY : 0;
      notify(L.wanted > 0 ? `The watch is losing interest. Wanted ${lawStars(L.wanted)}` : L.fines > 0 ? 'The watch has lost interest. Your fine still stands.' : 'The watch has lost interest in you.');
      save();
    }
  }
  const hasTemp = monsters.some(m => m.temp);
  if (L.wanted >= 3 && !hasTemp && !player.dead) lawSpawnReinforcements();
  if (L.wanted === 0 && hasTemp) monsters = monsters.filter(m => !m.temp);
  if (L.wanted > 0) {
    lawArmed = true;
    if (!player.dead && !window.__peace) {
      for (const m of monsters) {
        if (m.dead || !lawIsGuard(m)) continue;
        if (dist(m.x, m.y, player.x, player.y) < LAW_ARM_RANGE) { m.angry = true; m.state = 'chase'; }
      }
    }
    if (L.wanted >= 2 && (panel === 'shop' || panel === 'bank') && inVillageBounds(player.x, player.y)) { closePanel(); notify('Not while the watch is after you.'); } // only Thistledown's own shops know the watch
  } else if (lawArmed) lawStandDown();
});

// ---------- the Captain of the Watch ----------
NPCS.push(initNpc({ ...LAW_CAPTAIN }));
const LAW_CAPTAIN_LINES = [
  'Keep your sword for goblins, knight. The watch has long memories.',
  'Five coins a piece for goblin scrap. The smith melts it into spearheads.',
  'Quiet day. Let us keep it that way.',
  'The Duke keeps the keep. I keep the streets.',
];
HOOKS.talk.captain = n => {
  if (lawOwes()) {
    const cost = lawFine();
    if (coins() >= cost) say(`Raising a hand to the watch, knight? That is ${cost} coins. Pay it and the matter is closed.`, n.name);
    else say(`You owe the town ${cost} coins and you carry ${coins()}. Come back with coin, and leave the watch alone until you do.`, n.name);
  } else say(pick(LAW_CAPTAIN_LINES), n.name);
  openPanel('captain');
};
HOOKS.panel.captain = (g, narrow) => {
  const L = law(); const cost = lawFine(); const scrap = countItem('goblin_scrap');
  const { px, py, w, h } = panelBox(g, 440, 262, 'Captain of the Watch', lawOwes() ? `Wanted ${lawStars(L.wanted)} · fine ${cost} coins` : 'Thistledown is at peace with you.');
  g.fillStyle = '#c9d1d9'; g.font = '13px sans-serif'; g.textAlign = 'left';
  const parts = [];
  if (L.fines) parts.push(`${L.fines} for the guard${L.fines > LAW_KILL_FINE ? 's' : ''} you cut down`);
  if (L.wanted) parts.push(`${L.wanted * LAW_LEVEL_FINE} for ${L.wanted} star${L.wanted > 1 ? 's' : ''}`);
  wrapText(g, lawOwes() ? `Settle up and the watch stands down: ${parts.join(', and ')}.` : `The watch buys goblin scrap at ${LAW_SCRAP_PAY} coins a piece. You carry ${scrap}.`, px + 18, py + 78, w - 36, 18);
  const canPay = lawOwes() && coins() >= cost;
  button(g, px + 18, py + 122, w - 36, 36, lawOwes() ? `Pay fine (${cost} coins)` : 'Pay fine (nothing owed)', () => {
    const due = lawFine(); if (!lawOwes()) return;
    if (!payCoins(due)) { notify(`Not enough coins. The fine is ${due}.`); return; }
    L.wanted = 0; L.timer = 0; L.fines = 0; lawStandDown();
    floatText(player.x, player.y - 30, `-${due} coins`, '#ffd166');
    levelBanner = { text: 'FINE PAID', sub: 'The watch stands down', t: 2.6 };
    say('Paid in full. The watch stands down. Keep it that way, knight.', LAW_CAPTAIN.name);
    closePanel(); save();
  }, canPay ? '#8b2e2e' : '#2a2f3a', canPay);
  button(g, px + 18, py + 166, w - 36, 36, `Hand in goblin scrap (${scrap} × ${LAW_SCRAP_PAY} coins)`, () => {
    const n = countItem('goblin_scrap'); if (!n) { notify('You have no goblin scrap.'); return; }
    removeItem('goblin_scrap', n); const pay = n * LAW_SCRAP_PAY;
    giveOrDrop('coins', pay, player.x, player.y, true); floatText(player.x, player.y - 30, `+${pay} coins`, '#ffd166');
    notify(`The Captain takes ${n} scrap and pays ${pay} coins.`); save();
  }, scrap > 0 ? '#238636' : '#2a2f3a', scrap > 0);
  button(g, px + 18, py + h - 44, w - 36, 30, 'Close', closePanel, '#21262d');
};

// ---------- HUD ----------
HOOKS.hud.push((g, narrow) => {
  if (!lawOwes()) return;
  const L = law();
  const qh = quest.tracked && activeQuests().includes(quest.tracked) ? 54 : 0;
  const touch = typeof isTouch !== 'undefined' && isTouch, short = touch && VH < 500;
  let y = HUD.leftY; // shared left-HUD cursor (under the HP box; hooks stack instead of overprinting)
  { const _lay = typeof HUD_LAYOUT !== 'undefined' ? HUD_LAYOUT : null; const _touchFloor = (isTouch && _lay && !_lay.short) ? _lay.hotbarY + _lay.hotbarH + 12 : 0; y = Math.max(y, _touchFloor); } // below the hotbar on touch layouts (HUD_LAYOUT from 13-ux)
  const tag = (text, fill, stroke, color) => {
    g.font = 'bold 12px sans-serif'; const tw = Math.ceil(g.measureText(text).width) + 24;
    roundRect(g, 14, y, tw, 24, 8); g.fillStyle = fill; g.fill(); g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = color; g.textAlign = 'left'; g.fillText(text, 26, y + 16); y += 30;
  };
  if (L.wanted > 0) tag(`WANTED ${lawStars(L.wanted)}  ${Math.ceil(L.timer)}s`, 'rgba(120,20,20,0.85)', '#f85149', '#fff');
  if (L.fines > 0) tag(`Fine: ${lawFine()} coins`, 'rgba(90,60,10,0.85)', '#d29922', '#ffd166');
  HUD.leftY = y; // each tag already advanced y by its height + 6
});

// ---------- quest entry ----------
QUEST_DEFS.law = { name: 'The Watch' };
HOOKS.activeQuests.push(() => lawOwes() ? ['law'] : []);
HOOKS.questText.law = () => `Settle with the Captain of the Watch by the castle gate (fine ${lawFine()} coins).`;
HOOKS.newGame.push(() => { player.law = { wanted: 0, timer: 0, fines: 0 }; lawArmed = false; });

// ---------- self-test ----------
HOOKS.selfTest.push((check, F, h) => {
  const reset = () => { const L = law(); L.wanted = 0; L.timer = 0; L.fines = 0; };
  const guardOf = (tx, ty) => monsters.filter(m => lawIsGuard(m) && !m.temp).sort((a, b) => dist(a.home.x, a.home.y, tc(tx), tc(ty)) - dist(b.home.x, b.home.y, tc(tx), tc(ty)))[0];
  h.peace(false); closePanel(); reset(); F.sim(2, []);
  { const c = NPCS.find(n => n.id === 'captain'); check('law: Captain of the Watch stands by the castle portcullis', !!c && c.role === 'captain' && c.helmet && c.beard && Math.abs(c.x - 110) <= 1 && Math.abs(c.y - 41) <= 1 && !SOLID.has(tileAt(c.x, c.y)), c && { x: c.x, y: c.y, tile: tileAt(c.x, c.y) }); }
  // hit a guard in town → wanted 1, guard hostile
  F.tp(112, 30); player.hp = player.maxHp;
  const guard = guardOf(112, 30); guard.dead = false; guard.hp = guard.maxHp; guard.x = tc(113); guard.y = tc(30); guard.state = 'idle'; guard.angry = false; guard.stunT = 0;
  hitMonster(guard, 1, 0);
  const w1 = law().wanted, t1 = law().timer;
  let hostile = false, steps = 0; for (; steps < 60 && !hostile; steps++) { F.step([]); hostile = guard.angry && guard.state === 'chase'; }
  check('law: hitting a town guard raises wanted to 1 and the guard turns hostile', w1 === 1 && t1 > 100 && hostile, { wanted: w1, timer: +t1.toFixed(1), hostile, steps });
  check('law: The Watch quest shows while wanted', activeQuests().includes('law') && QUEST_DEFS.law && /Captain of the Watch/.test(questText('law')), { text: questText('law') });
  // kill a guard → wanted 3, fine 150, reinforcements at the gates
  guard.x = tc(113); guard.y = tc(30); guard.hp = 1; hitMonster(guard, 5, 0);
  F.sim(2, []);
  { const temps = monsters.filter(m => m.temp); const atGates = temps.length === 2 && temps.every(m => m.type === 'guard_m' && LAW_TEMP_POSTS.some(([x, y]) => Math.abs(m.home.x - tc(x)) < 1 && Math.abs(m.home.y - tc(y)) < 1));
    check('law: killing a guard sets wanted 3, a 150 coin fine, and two extra guards at the gates', guard.dead && law().wanted === 3 && law().fines === 150 && atGates, { wanted: law().wanted, fines: law().fines, temps: temps.length }); }
  // shops and the bank refuse you while wanted ≥ 2
  h.peace(true);
  { openPanel('shop', 'general'); F.sim(2, []); const shopClosed = panel !== 'shop'; openPanel('bank'); F.sim(2, []); const bankClosed = panel !== 'bank';
    check('law: shop and bank panels close while wanted ≥ 2', shopClosed && bankClosed && notice && /watch/.test(notice.text), { shopClosed, bankClosed, notice: notice && notice.text }); }
  // decay: one level per timer expiry, next timer is 60s
  law().timer = 0.05; F.sim(10, []);
  check('law: wanted decays one level when the timer runs out (then 60s per level)', law().wanted === 2 && law().timer > 55 && law().timer <= LAW_DECAY, { wanted: law().wanted, timer: +law().timer.toFixed(1) });
  // pay the captain: fine = fines + wanted×25
  law().wanted = 3; law().timer = 120; F.sim(2, []);
  drops.length = 0; h.give('coins', 500); const c0 = coins(); const cost = lawFine();
  { const r = F.talk('captain'); const clicked = F.clickButton('Pay fine'); F.sim(2, []);
    const calm = monsters.filter(m => lawIsGuard(m) && !m.dead).every(m => !m.angry); const temps = monsters.filter(m => m.temp).length;
    check('law: paying the captain clears wanted and fines, costs fines + 25 per star, guards stand down, gate guards leave', clicked && law().wanted === 0 && law().fines === 0 && coins() === c0 - cost && cost === 150 + 75 && calm && temps === 0 && !activeQuests().includes('law'), { walk: r, clicked, cost, coins: coins(), expected: c0 - cost, calm, temps }); }
  // scrap bounty: 5 coins per goblin scrap
  { drops.length = 0; dialog.queue.length = 0; advanceDialog(); h.give('goblin_scrap', 3); const c1 = coins(), n = countItem('goblin_scrap'); F.talk('captain'); const payDisabled = !F.clickButton('Pay fine'); const clicked = F.clickButton('Hand in goblin scrap'); F.sim(2, []);
    check('law: captain pays 5 coins per goblin scrap; pay button is off when clean', clicked && payDisabled && n >= 3 && coins() === c1 + n * LAW_SCRAP_PAY && countItem('goblin_scrap') === 0 && dialog.cur && dialog.cur.who === LAW_CAPTAIN.name, { scrap: n, coins: coins(), expected: c1 + n * LAW_SCRAP_PAY, payDisabled, who: dialog.cur && dialog.cur.who }); closePanel(); }
  // falling while wanted = arrested: stars become fine, no death loop
  { law().wanted = 2; law().timer = 120; law().fines = 0; player.dead = true; player.deadT = 0; F.sim(2, []); const arrested = law().wanted === 0 && law().fines === 50; F.sim(200, []); check('law: dying while wanted turns the stars into a fine and stands the watch down', arrested && !player.dead, { arrested, fines: law().fines, dead: player.dead }); }
  reset(); lawStandDown(); h.peace(false); closePanel(); F.sim(2, []);
});
