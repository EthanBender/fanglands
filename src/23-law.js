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
// the wanted level in plain words (stars are only ever DRAWN, on the WANTED plaque and in the Captain's panel)
const lawStars = n => `${n} of 3 star${n === 1 ? '' : 's'}`;
const lawFine = () => law().fines + law().wanted * LAW_LEVEL_FINE;
const lawOwes = () => law().wanted > 0 || law().fines > 0;

// ---------- offences ----------
function lawOffend(level) {
  const L = law(); const before = L.wanted;
  L.wanted = clamp(level, 0, 3); L.timer = LAW_HIT_TIMER;
  if (L.wanted > before) {
    floatText(player.x, player.y - 42, `WANTED: ${L.wanted} star${L.wanted === 1 ? '' : 's'}`, '#ff6b6b', 16);
    notify(L.wanted >= 3 ? 'The whole watch is after you! Reinforcements at the gates.' : `The watch is after you! Wanted: ${lawStars(L.wanted)}.`);
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
      notify(L.wanted > 0 ? `The watch is losing interest. Wanted: ${lawStars(L.wanted)}.` : L.fines > 0 ? 'The watch has lost interest. Your fine still stands.' : 'The watch has lost interest in you.');
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
// The Captain's panel wears the book frame (panelBox). The wanted level is DRAWN (three stars, the lit ones gold) beside
// the words, the reason for the fine is one plain sentence, and the verbs are iron plate buttons a kit row tall:
// green (the choice to make) when it can be done, greyed and inert when it cannot. Nothing here is danger red.
const LAW_PAD = 18;
function lawDrawStars(g, x, cy, n, r = 8) {
  for (let i = 0; i < 3; i++) {
    const sx = x + r + i * (r * 2 + 4);
    HK.starPath(g, sx, cy, r, r * 0.42);
    g.fillStyle = i < n ? HK.T.goldHi : 'rgba(0,0,0,0.5)'; g.fill();
    g.strokeStyle = i < n ? '#3a2708' : 'rgba(217,178,92,0.45)'; g.lineWidth = 1; g.stroke();
  }
  return 3 * (r * 2 + 4) - 4;
}
HOOKS.panel.captain = (g, narrow) => {
  const L = law(); const cost = lawFine(); const scrap = countItem('goblin_scrap');
  const rh = HK.row(), gap = rh >= 44 ? 10 : 8;
  const w = Math.min(460, VW - 20), inner = w - LAW_PAD * 2;
  const parts = [];
  if (L.fines) parts.push(`${L.fines} for the guard${L.fines > LAW_KILL_FINE ? 's' : ''} you cut down`);
  if (L.wanted) parts.push(`${L.wanted * LAW_LEVEL_FINE} for ${L.wanted} star${L.wanted > 1 ? 's' : ''}`);
  const words = lawOwes() ? `Settle up and the watch stands down: ${parts.join(', and ')}.` : `The watch buys goblin scrap at ${LAW_SCRAP_PAY} coins a piece. You carry ${scrap}.`;
  const f = HK.FS(600, 14), lh = Math.round(14 * HK.k() * 1.42);
  const lines = HK.wrap(g, words, inner, 10, f).lines;
  const starRow = L.wanted > 0 ? 30 : 0;
  const h = 62 + starRow + lines.length * lh + 16 + 3 * rh + 2 * gap + 18;
  const sub = !lawOwes() ? 'Thistledown is at peace with you.' : L.wanted ? `Wanted: ${lawStars(L.wanted)} · fine ${cost} coins` : `Fine to pay: ${cost} coins`;
  const { px, py, h: ph } = panelBox(g, w, h, 'Captain of the Watch', sub);
  let y = py + 62;
  if (starRow) {
    HK.text(g, 'WANTED', px + LAW_PAD, y + 16, { font: HK.FC(800, 13), color: HK.T.bad });
    const sw = lawDrawStars(g, px + LAW_PAD + HK.tw(g, 'WANTED', HK.FC(800, 13)) + 10, y + 11, L.wanted);
    HK.text(g, L.timer > 0 ? `${Math.ceil(L.timer)} s` : '', px + LAW_PAD + HK.tw(g, 'WANTED', HK.FC(800, 13)) + 10 + sw + 10, y + 16, { font: HK.FC(800, 12), color: HK.T.inkDim });
    y += starRow;
  }
  lines.forEach((ln, i) => HK.text(g, ln, px + LAW_PAD, y + 14 + i * lh, { font: f, color: HK.T.ink, box: { x: px + LAW_PAD, y, w: inner, h: lh }, fitId: 'captain:words' }));
  y += lines.length * lh + 16;
  const canPay = lawOwes() && coins() >= cost;
  // the verbs sit at the foot of the page (a short screen clips the page, never the buttons)
  y = Math.min(y, py + ph - 18 - 3 * rh - 2 * gap);
  button(g, px + LAW_PAD, y, inner, rh, lawOwes() ? `Pay fine (${cost} coins)` : 'Pay fine (nothing owed)', () => {
    const due = lawFine(); if (!lawOwes()) return;
    if (!payCoins(due)) { notify(`Not enough coins. The fine is ${due}.`); return; }
    L.wanted = 0; L.timer = 0; L.fines = 0; lawStandDown();
    floatText(player.x, player.y - 30, `-${due} coins`, '#ffd166');
    levelBanner = { text: 'FINE PAID', sub: 'The watch stands down', t: 2.6 };
    say('Paid in full. The watch stands down. Keep it that way, knight.', LAW_CAPTAIN.name);
    closePanel(); save();
  }, '#238636', canPay);
  y += rh + gap;
  button(g, px + LAW_PAD, y, inner, rh, `Hand in goblin scrap (${scrap} for ${scrap * LAW_SCRAP_PAY} coins)`, () => {
    const n = countItem('goblin_scrap'); if (!n) { notify('You have no goblin scrap.'); return; }
    removeItem('goblin_scrap', n); const pay = n * LAW_SCRAP_PAY;
    giveOrDrop('coins', pay, player.x, player.y, true); floatText(player.x, player.y - 30, `+${pay} coins`, '#ffd166');
    notify(`The Captain takes ${n} scrap and pays ${pay} coins.`); save();
  }, '#238636', scrap > 0);
  y += rh + gap;
  button(g, px + LAW_PAD, y, inner, rh, 'Close', closePanel, '#21262d');
};

// ---------- HUD ----------
// Two PLAQUES in the kit's reserved column (src/59-hudkit.js HK.addPlaque), no hand placing:
//   WANTED: a skull roundel, the word, the wanted level as DRAWN stars (never star characters), the seconds until the
//           watch loses interest, and a red edge (red = danger: the watch is coming for you).
//   FINE TO PAY: a coin roundel, the exact coins, and an amber edge (something to settle, not something chasing you).
// The first of several field sets that fits the plaque column's width, so no word is ever squeezed out of its plate.
// It measures the way the kit's plaque lays out (src/59-hudkit.js plaque(): a 36 px roundel, the name in Cinzel shrinking
// to 9 px and no further, the value on the right in Cinzel 11, drawn stars 16 px each, one line of sans under it).
// (A local copy in each world-status file: HK.addPlaque could take such a list itself.)
const lawFitFields = (g, list) => {
  const P = HK.cur().plaques, w = P && P[0] ? P[0].w : 0;
  if (!w) return list[0];
  for (const o of list) {
    const tx = (o.emblem || o.portrait) ? 48 : 10, rw = o.right != null && o.right !== '' ? HK.tw(g, String(o.right), HK.FC(800, 11)) + 12 : 0, stars = o.stars ? o.stars.of * 16 + 6 : 0;
    if (HK.tw(g, String(o.name || ''), HK.FC(800, 9)) > w - 14 - rw - stars - tx) continue;
    if (o.sub && o.frac == null && HK.tw(g, String(o.sub), HK.FS(600, 12)) > w - 14 - tx) continue;
    return o;
  }
  return list[list.length - 1];
};
// on a narrow plaque column (a landscape phone) the longer words give way to shorter ones, in this order
function lawPlaques(g) {
  const L = law(), out = [];
  if (L.wanted > 0) {
    const s = Math.max(0, Math.ceil(L.timer)), base = { id: 'wanted', emblem: 'skull', name: 'WANTED', stars: { n: L.wanted, of: 3 }, edge: HK.T.gules };
    out.push(lawFitFields(g, [{ right: `${s} s`, sub: 'The watch is after you' }, { right: `${s} s`, sub: 'The watch wants you' }, { right: null, sub: `${s} s left` }].map(o => Object.assign({}, base, o))));
  }
  if (L.fines > 0) {
    const base = { id: 'fine', emblem: 'coin', right: `${lawFine()} coins`, edge: HK.T.warn };
    out.push(lawFitFields(g, [{ name: 'FINE TO PAY', sub: 'Pay the Captain' }, { name: 'FINE', sub: 'Pay the Captain' }].map(o => Object.assign({}, base, o))));
  }
  return out;
}
HOOKS.hud.push((g, narrow) => {
  if (!lawOwes()) return;
  for (const p of lawPlaques(g)) HK.addPlaque(g, p);
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

// ---------- self-test: the plaques and the Captain's words ----------
// WANTED and FINE TO PAY come through the kit (HK.addPlaque) with the spec's fields, and nothing the law paints (the
// plaques, the Captain's panel, the notices and the floating word) carries a star CHARACTER: stars are drawn shapes.
HOOKS.selfTest.push((check, F, h) => {
  const L0 = JSON.parse(JSON.stringify(law())), p0 = paused, fl0 = floaters.length, n0 = notice;
  const rec = [], add0 = HK.addPlaque, fc = HK.audit.fitCtx();
  let painted = '';
  const recCtx = new Proxy({}, {
    get: (t, k) => (k === 'fillText' || k === 'strokeText') ? (s => { painted += String(s) + '\n'; }) : fc[k],
    set: (t, k, v) => { fc[k] = v; return true; },
  });
  HK.addPlaque = (g, o) => { rec.push({ o: Object.assign({}, o), r: add0(g, o) }); return rec[rec.length - 1].r; };
  const STAR = /[★☆]/;
  const out = {};
  try {
    paused = false; closePanel();
    const L = law(); L.wanted = 2; L.timer = 37.2; L.fines = 150;
    rec.length = 0; drawHud(recCtx);
    const w = rec.find(q => q.o.id === 'wanted'), f = rec.find(q => q.o.id === 'fine');
    out.wanted = w && w.o; out.fine = f && f.o;
    const okW = !!w && !!w.r && w.o.emblem === 'skull' && w.o.name === 'WANTED' && w.o.stars && w.o.stars.n === 2 && w.o.stars.of === 3 && w.o.right === '38 s' && w.o.edge === HK.T.gules;
    const okF = !!f && !!f.r && f.o.emblem === 'coin' && f.o.name === 'FINE TO PAY' && f.o.right === `${150 + 2 * LAW_LEVEL_FINE} coins` && f.o.edge === HK.T.warn;
    // only a wanted level, no fine: one plaque; nothing owed: none
    L.fines = 0; rec.length = 0; drawHud(fc); const onlyW = rec.filter(q => q.o.id === 'wanted' || q.o.id === 'fine').map(q => q.o.id).join();
    L.wanted = 0; L.timer = 0; rec.length = 0; drawHud(fc); const clean = rec.filter(q => q.o.id === 'wanted' || q.o.id === 'fine').length;
    // the Captain's panel with a wanted level, and the words the law says out loud
    L.wanted = 2; L.timer = 37.2; L.fines = 150; openPanel('captain'); drawHud(recCtx);
    const panelWords = painted.includes('Wanted: 2 of 3 stars') && painted.includes('Captain of the Watch');
    closePanel();
    L.wanted = 0; L.timer = 0; L.fines = 0; floaters.length = fl0; lawOffend(2);
    const said = [notice && notice.text, ...floaters.slice(fl0).map(q => q.text)].filter(Boolean);
    const floatOk = floaters.slice(fl0).some(q => q.text === 'WANTED: 2 stars');
    out.said = said; out.onlyW = onlyW; out.clean = clean; out.panelWords = panelWords;
    check('law: WANTED and FINE TO PAY come through HK.addPlaque in reserved slots (a skull, 2 drawn stars of 3, the seconds, a red edge; a coin, the exact coins, an amber edge), and nothing the law paints or says carries a star character: the Captain says "Wanted: 2 of 3 stars", the floating word says "WANTED: 2 stars"',
      okW && okF && onlyW === 'wanted' && clean === 0 && panelWords && floatOk && !STAR.test(painted) && !said.some(s => STAR.test(s)), out);
  } finally {
    HK.addPlaque = add0; closePanel(); paused = p0;
    Object.assign(law(), L0); floaters.length = fl0; notice = n0; dialog.cur = null; dialog.queue.length = 0; lawStandDown(); save();
  }
});
