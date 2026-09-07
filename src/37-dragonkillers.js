// ============================================================================
// DRAGON KILLERS — the end quest (Cohen's designs B and C).
//  • Dragon items: dragons drop them rarely, bosses very rarely (the stronger the boss, the better the odds), The Fang 1 in 3.
//  • Gating: Warden Brann bars the road into the Ashfields at (60,96) until Hollowford is avenged (stage 11); a tree line
//    along Wolfwood's southern edge (y 95) makes the road the only way in. The lair gate still needs stage 14; Aerie needs the flute.
//  • The group: at stage 14 with the Song of Above sung, Duke Ferrin forms the Dragon Killers — your companion, Sergeant Hale and
//    Sir Garrick — and gives you the dragon horn. Hale and Garrick appear beside you inside the lair as 'ally_knight' monsters
//    (neutral, untouchable) and hit The Fang every 1.2 s while within two tiles of it. The Fang itself is summoned on the lair's
//    circle (28-thefang owns the circle, the horn item and the summoning). After the kill the allies go home.
// Feature file: HOOKS only. The Duke's stage-14 talk is delegated here by 28-thefang through window.DRAGON_KILLERS.duke.
// ============================================================================
{
  const LAIR_NAME = "The Fang's Lair";
  const RED = '#c0504d';

  // ---------- dragon items ----------
  Object.assign(ITEMS, {
    dragon_helm: { name: 'Dragon helm', value: 6000, color: RED, shape: 'helm', stack: 1, armour: { slot: 'helm', def: 40 } },
    dragon_spear: { name: 'Dragon spear', value: 8000, color: RED, shape: 'warhammer', stack: 1, weapon: { str: 45, att: 44, cd: 0.5, perk: 'knockback' } },
    dragon_shield: { name: 'Dragon shield', value: 6000, color: RED, shape: 'shield', stack: 1, armour: { slot: 'shield', def: 36 } },
    dragon_body: { name: 'Dragon platebody', value: 9000, color: RED, shape: 'body', stack: 1, armour: { slot: 'body', def: 70 } },
  });
  if (!ITEMS.dragon_horn) ITEMS.dragon_horn = { name: 'Dragon horn', value: 1500, color: '#e8dcc0', shape: 'tusk', stack: 1 };
  for (const k of ['dragon_helm', 'dragon_spear', 'dragon_shield', 'dragon_body', 'dragon_horn']) { ITEMS[k].id = k; ITEMS[k].stack = 1; }
  const DRAGON_ITEMS = ['dragon_spear', 'dragon_helm', 'dragon_shield', 'dragon_body'];

  // ---------- drop chances ----------
  const FIXED = { green_dragon: 1 / 150, red_dragon: 1 / 60, ash_drake: 1 / 300, the_fang: 1 / 3 };
  const BOSSES = ['walker', 'bulldozer', 'barrelbeast', 'brood_mother', 'gnasher', 'count_ashvane'];
  function chance(type) {
    if (type in FIXED) return FIXED[type];
    if (BOSSES.includes(type) && MONSTER_DEFS[type]) return Math.min(1 / 20, (MONSTER_DEFS[type].level || 0) / 1500);
    return 0;
  }
  const stats = { drops: 0, last: null };
  HOOKS.kill.push(m => {
    const c = chance(m.type);
    if (!c || Math.random() >= c) return;
    const id = DRAGON_ITEMS[Math.floor(Math.random() * DRAGON_ITEMS.length)];
    drops.push({ x: m.x + rint(-14, 14), y: m.y + rint(-14, 14), id, qty: 1, t: 0, rare: true });
    // the RARE DROP banner, unless a bigger one (THE FANG IS SLAIN, DUNGEON CLEARED: t 4–5) is up; the float and the sparks say it regardless
    if (!levelBanner || levelBanner.t <= 3) levelBanner = { text: 'RARE DROP', sub: ITEMS[id].name, t: 3.5 };
    floatText(m.x, m.y - m.r - 30, ITEMS[id].name + '!', RED, 17); sfx('quest');
    burst(m.x, m.y, RED, 30, 160); burst(m.x, m.y, '#f5c542', 20, 120);
    stats.drops++; stats.last = id;
  });

  // ---------- quest state ----------
  const freshDK = () => ({ formed: false, gate: false, slainWith: false });
  const DK = () => { let q = quest.dk; if (!q || typeof q !== 'object') q = quest.dk = freshDK(); return q; };
  const skyDone = () => !!(quest.sky && quest.sky.stage === 'done');
  const fangQ = () => quest.fang || {};
  HOOKS.newGame.push(() => { quest.dk = freshDK(); });

  // ---------- the warden's gate on the road into the Ashfields ----------
  const WARDEN_GATE = addTile('WARDEN_GATE', { solid: true, tex: 'dirt', mini: '#8a6a3a' });
  const GATE_T = [[59, 96], [60, 96], [61, 96]];
  const WARDEN_POST = { x: 60, y: 95 }, WARDEN_ASIDE = { x: 62, y: 97 }; // he stands on the road before his gate (the core clears the tile under an NPC, so not on the gate itself)
  const warden = initNpc({ id: 'brann', name: 'Warden Brann', x: WARDEN_POST.x, y: WARDEN_POST.y, tunic: '#4a4f5a', hair: '#3a2a1a', helmet: true, beard: true, role: 'warden' });
  NPCS.push(warden);
  const gateClosed = () => GATE_T.some(([x, y]) => tileAt(x, y) === WARDEN_GATE);
  HOOKS.world.push((rnd, api) => {
    // Wolfwood's southern edge grows thick: y 95 is trees except the road, so the warden's gate is the only way south
    // (and the jungle's western edge, x 100, closes the way round from the east)
    const open = t => !SOLID.has(t) && !PUSH_THROUGH.has(t);
    for (let x = 1; x <= 99; x++) { if (x >= 59 && x <= 61) continue; if (open(api.tileAt(x, 95))) api.setTile(x, 95, T.TREE); }
    for (let y = 96; y <= 138; y++) if (open(api.tileAt(100, y))) api.setTile(100, y, T.TREE);
    for (let x = 59; x <= 61; x++) if (open(api.tileAt(x, 95))) api.setTile(x, 95, T.DIRT);
    for (const [x, y] of GATE_T) api.setTile(x, y, WARDEN_GATE);
  });
  function openGate(quiet) {
    for (const [x, y] of GATE_T) if (tileAt(x, y) === WARDEN_GATE) changeTile(x, y, T.DIRT);
    if (!quiet) { burst(tc(60), tc(96), '#8a6a3a', 24, 120); sfx('open'); }
    const q = DK(); if (!q.gate) { q.gate = true; if (!quiet) say("Hollowford avenged? Then the Duke's order is lifted. The road south is yours, knight. It goes to Dunstan's farm, and past that, to the dragons.", warden.name); save(); }
  }
  function closeGate() { for (const [x, y] of GATE_T) if (tileAt(x, y) !== WARDEN_GATE) changeTile(x, y, WARDEN_GATE); }
  function placeWarden() {
    const want = gateClosed() ? WARDEN_POST : WARDEN_ASIDE, px = tc(want.x), py = tc(want.y);
    if (warden.px !== px || warden.py !== py) { warden.px = px; warden.py = py; warden.home = { x: px, y: py }; warden.facing = gateClosed() ? { x: 0, y: -1 } : { x: -1, y: 0 }; }
  }
  HOOKS.talk.warden = n => {
    if (gateClosed()) { say("Turn back, traveller. South of here is the Ashfields, and the Ashfields are dragon country. The Duke's order: nobody passes until Hollowford is settled.", n.name); say(quest.stage >= 8 ? "Hollowford still burns, last I heard. Go and see to it, and I will open this road myself." : "There is a village east of Thistledown that needs a knight more than the dragons do.", n.name); }
    else say("Road's open. Straight down to Dunstan's dung farm, then it is ash and dragons all the way to the lava. Mind yourself, knight.", n.name);
  };
  HOOKS.use.push(t => { if (t === WARDEN_GATE) { HOOKS.talk.warden(warden); return true; } return false; });

  // ---------- main quest texts and map target for stage 14 ----------
  const prev14 = HOOKS.mainQuest[14] || {};
  HOOKS.mainQuest[14] = { ...prev14, text: () => {
    const s = quest.sky ? quest.sky.stage : 0;
    if (s !== 'done') return s === 1 ? 'The Fang waits. First, the Song of Above: play the wind flute at the wind shrine on the Grey Quarry heights.' : s === 2 ? 'The Fang waits. First, the Song of Above: bring Queen Seraphel of Aerie 5 dragon scales and 3 cloud essence.' : 'Salved against fire. The Fang waits, but first: Old Wren in Wolfwood knows the Song of Above.';
    if (!DK().formed) return 'Gather the Dragon Killers: speak to Duke Ferrin.';
    if (fangQ().summoned) return 'The Fang answers the horn. Kill it, with the Dragon Killers at your side!';
    return "Ride with the Dragon Killers to The Fang's lair in the far south-west and sound the dragon horn on the summoning circle.";
  } };
  { const base14 = MAP_TARGETS[14] || { x: 18, y: 108, label: "The Fang's lair" };
    Object.defineProperty(MAP_TARGETS, 14, { configurable: true, enumerable: true, get() {
      const s = quest.sky ? quest.sky.stage : 0;
      if (s !== 'done') return s === 1 || s === 2 ? { x: 58, y: 3, label: 'The wind shrine' } : { x: 30, y: 78, label: 'Old Wren' };
      if (!DK().formed) return { x: 112, y: 49, label: 'Duke Ferrin' };
      return base14;
    } }); }

  // ---------- the Duke forms the Dragon Killers (called by 28-thefang's talkBefore.duke at stage 14) ----------
  const compId = () => (player.companion && player.companion.id) || null;
  const compName = () => compId() === 'sera' ? 'Sera' : compId() === 'garrick' ? 'Garrick' : null;
  function duke(n) {
    const q = DK();
    if (!skyDone()) {
      say("The Fang? No sword arm alone has ever come back from that lair, knight. There is an old song that says the sky itself once fought it.", n.name);
      say(quest.sky && quest.sky.stage ? "The Song of Above. You carry Wren's flute; go up and have it sung. Then come back to me and I will give you a company." : "Old Wren, in Wolfwood, hums it: the Song of Above. Ask him. Have it sung, and come back to me.", n.name);
      return true;
    }
    if (!q.formed) {
      q.formed = true;
      const names = [compName(), 'Sergeant Hale', compId() === 'garrick' ? null : 'Sir Garrick'].filter(Boolean);
      say("Sung? Then Thistledown rides. I name you the Dragon Killers: " + names.join(', ') + " and you, knight, at the head.", n.name);
      say("Hale and Garrick will meet you inside the lair. And take this: a dragon horn, from the last one that tried. The Fang sleeps under the lava. Sound the horn on the old circle in its lair and it will come up to answer.", n.name);
      giveOrDrop('dragon_horn', 1, player.x, player.y);
      levelBanner = { text: 'THE DRAGON KILLERS', sub: names.join(' · ') + ' · you', t: 4.5 }; sfx('quest'); burst(player.x, player.y, '#f5c542', 40, 200);
      save(); return true;
    }
    say("The Dragon Killers are yours, knight. Hale and Garrick wait for you inside the lair. Sound the horn on the circle, and the Fang will come.", n.name);
    return true;
  }

  // ---------- allies ----------
  MONSTER_DEFS.ally_knight = { name: 'Dragon Killer', level: 30, r: 13, hp: 999, att: 40, maxHit: 15, def: 40, speed: 170, aggro: false, harmless: true, sight: 0, respawn: 1e9, human: true, drops: {} };
  const ALLY_DEFS = [
    { id: 'hale', name: 'Sergeant Hale', look: { tunic: '#4a4f5a', hair: '#2a1a0a', helm: '#8f96a3', spear: true, shoulder: '#8f96a3' } },
    { id: 'garrick', name: 'Sir Garrick', look: { tunic: '#7a2e2e', hair: '#8a7a6a', helm: '#c9ccd3', beard: true, weapon: ITEMS.steel_sword || ITEMS.iron_sword, shoulder: '#c9ccd3' } },
  ];
  const ALLY_CD = 1.2, ALLY_ATT = (30 + 8) * (64 + 40), ALLY_MAX = 15;
  const allies = () => monsters.filter(m => m.type === 'ally_knight');
  const wantedAllies = () => ALLY_DEFS.filter(d => d.id !== compId());
  function freeSpotNear(x, y) {
    if (!collides(x, y, 13, 'person')) return { x, y };
    for (let r = 1; r < 8; r++) for (let a = 0; a < 12; a++) { const ang = a / 12 * Math.PI * 2; const nx = x + Math.cos(ang) * r * 18, ny = y + Math.sin(ang) * r * 18; if (!collides(nx, ny, 13, 'person')) return { x: nx, y: ny }; }
    return { x, y };
  }
  function spawnAlly(def, i) {
    const side = i % 2 ? 1 : -1, p = freeSpotNear(player.x - player.facing.x * 44 + player.facing.y * 34 * side, player.y - player.facing.y * 44 - player.facing.x * 34 * side);
    const m = { type: 'ally_knight', x: p.x, y: p.y, home: { x: p.x, y: p.y }, r: 13, hp: 999, maxHp: 999, speed: 170, angry: false, state: 'idle', wanderT: 99, wander: { x: 0, y: 0 }, attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 0, facing: { x: 0, y: 1 }, walkT: 0, moving: false, stunT: 0,
      ally: def.id, allyName: def.name, allyCd: 0.6 + i * 0.4, allySwings: 0, stuckT: 0 };
    monsters.push(m); burst(m.x, m.y, '#9fe0b0', 16, 90); floatText(m.x, m.y - 30, def.name, '#9fe0b0', 13);
    return m;
  }
  function removeAllies(farewell) {
    const list = allies(); if (!list.length) return;
    for (const m of list) { burst(m.x, m.y, '#9fe0b0', 12, 70); if (farewell) floatText(m.x, m.y - 30, 'Well fought, knight!', '#9fe0b0', 13); }
    monsters = monsters.filter(m => m.type !== 'ally_knight');
  }
  function stepToward(m, tx, ty, dt, stopAt) {
    const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
    if (d <= stopAt) { m.moving = false; return; }
    const ux = dx / d, uy = dy / d, step = Math.min(m.speed * dt, d - stopAt), bx = m.x, by = m.y;
    moveEntity(m, ux * step, uy * step, 'person');
    if (Math.abs(m.x - bx) < 0.01 && Math.abs(m.y - by) < 0.01) { const s = Math.floor(time * 0.7) % 2 ? 1 : -1; moveEntity(m, -uy * step * s, ux * step * s, 'person'); m.stuckT += dt; } else m.stuckT = 0;
    m.facing = { x: ux, y: uy }; m.moving = true; m.walkT += dt * 8;
  }
  HOOKS.update.push(dt => {
    const q = DK(), fq = fangQ();
    const inLair = player.region === LAIR_NAME && !(window.INSTANCES && INSTANCES.active());
    // the warden's road
    if (quest.stage >= 11 && gateClosed()) openGate(false);
    placeWarden();
    // the group appears inside the lair while the hunt is on, and goes home when it is over
    const present = allies();
    const want = q.formed && inLair && !fq.slain && !player.dead;
    if (want) wantedAllies().forEach((d, i) => { if (!present.some(m => m.ally === d.id)) spawnAlly(d, i); });
    else if (present.length) removeAllies(false);
    if (!want) return;
    const fang = monsters.find(o => o.type === 'the_fang' && !o.dead);
    allies().forEach((m, i) => {
      // untouchable, never hostile, never driven by the core's wander
      m.hp = m.maxHp; m.dead = false; m.stunT = 0; m.state = 'idle'; m.angry = false; m.wanderT = 99; m.wander = { x: 0, y: 0 };
      m.allyCd = Math.max(0, (m.allyCd || 0) - dt);
      const dp = dist(m.x, m.y, player.x, player.y);
      if (fang) {
        const d = dist(m.x, m.y, fang.x, fang.y), inRange = d <= fang.r + 2 * TILE;
        if (!inRange) stepToward(m, fang.x, fang.y, dt, fang.r + m.r + 12);
        else { m.moving = false; m.facing = { x: (fang.x - m.x) / (d || 1), y: (fang.y - m.y) / (d || 1) }; }
        if (inRange && m.allyCd <= 0) {
          m.allyCd = ALLY_CD; m.attackT = 0.22; m.allySwings = (m.allySwings || 0) + 1;
          hitMonster(fang, rollHit(ALLY_ATT, (MONSTER_DEFS.the_fang.def + 8) * 64, ALLY_MAX), 10, true, 'monster');
        }
      } else {
        const side = i % 2 ? 1 : -1, tx = player.x - player.facing.x * 50 + player.facing.y * 34 * side, ty = player.y - player.facing.y * 50 - player.facing.x * 34 * side;
        if (dp > 12 * TILE || (m.stuckT > 2.5 && dp > 4 * TILE)) { const p = freeSpotNear(tx, ty); m.x = p.x; m.y = p.y; m.stuckT = 0; burst(m.x, m.y, '#9fe0b0', 8, 50); }
        else if (dist(m.x, m.y, tx, ty) > 24) stepToward(m, tx, ty, dt, 8);
        else { m.moving = false; if (dp > 1) m.facing = { x: (player.x - m.x) / dp, y: (player.y - m.y) / dp }; }
      }
      if (dp < 22 && dp > 0) moveEntity(m, (m.x - player.x) / dp * 40 * dt, (m.y - player.y) / dp * 40 * dt, 'person');
    });
  });
  HOOKS.kill.push(m => {
    if (m.type !== 'the_fang') return;
    const q = DK(); if (!q.formed) return;
    q.slainWith = true;
    if (allies().length) { say("Hale wipes his blade. 'Sergeant Hale reporting: dragon dead. Thistledown will not believe a word of it.' The Dragon Killers turn for home.", 'Sergeant Hale'); removeAllies(true); }
  });
  HOOKS.drawMonster.ally_knight = (g, e, hurt) => {
    const def = ALLY_DEFS.find(d => d.id === e.ally) || ALLY_DEFS[0];
    drawHuman(g, e, def.look);
    g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(e.allyName || def.name, 0, 26); g.fillStyle = '#9fe0b0'; g.fillText(e.allyName || def.name, 0, 26);
  };

  // ---------- debug handle (28-thefang's Duke talk calls .duke at stage 14) ----------
  window.DRAGON_KILLERS = { chance, DK, duke, allies, ALLY_DEFS, WARDEN_GATE, GATE_T, openGate, closeGate, warden, stats, DRAGON_ITEMS };

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
    const said = re => [dialog.cur, ...dialog.queue].some(l => l && re.test(l.text));
    const makeRoom = n => { h.clearJunk(); for (let i = player.inv.length - 1; i >= 0 && player.inv.filter(s => !s).length < n; i--) { const s = player.inv[i]; if (s && s.id !== 'coins' && !ITEMS[s.id].weapon && !ITEMS[s.id].armour && !ITEMS[s.id].tool && !/^dragon/.test(s.id)) player.inv[i] = null; } };
    h.peace(true); closePanel(); if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave();
    const st0 = quest.stage, dk0 = JSON.stringify(DK());
    // items and chances
    check('dk: dragon items exist (helm def 40, spear str 45 / att 44 / knockback, shield def 36, body def 70, red)', ITEMS.dragon_helm.armour.def === 40 && ITEMS.dragon_helm.value === 6000 && ITEMS.dragon_spear.weapon.str === 45 && ITEMS.dragon_spear.weapon.att === 44 && ITEMS.dragon_spear.weapon.cd === 0.5 && ITEMS.dragon_spear.weapon.perk === 'knockback' && ITEMS.dragon_spear.shape === 'warhammer' && ITEMS.dragon_spear.value === 8000 && ITEMS.dragon_shield.armour.def === 36 && ITEMS.dragon_body.armour.def === 70 && ITEMS.dragon_body.value === 9000 && [ITEMS.dragon_helm, ITEMS.dragon_spear, ITEMS.dragon_shield, ITEMS.dragon_body].every(d => d.color === RED && d.stack === 1) && !!ITEMS.dragon_horn && !!ITEMS.dragon_bone, {});
    check('dk: drop chances — green 1/150, red 1/60, Fang 1/3, bosses min(1/20, level/1500), nothing for the rest', chance('green_dragon') === 1 / 150 && chance('red_dragon') === 1 / 60 && chance('the_fang') === 1 / 3 && chance('barrelbeast') === Math.min(1 / 20, MONSTER_DEFS.barrelbeast.level / 1500) && chance('walker') === MONSTER_DEFS.walker.level / 1500 && chance('brood_mother') === MONSTER_DEFS.brood_mother.level / 1500 && chance('bulldozer') === MONSTER_DEFS.bulldozer.level / 1500 && chance('barrelbeast') > chance('walker') && chance('goblin') === 0 && chance('wolf') === 0, { barrelbeast: chance('barrelbeast'), walker: chance('walker') });
    // a forced kill (Math.random → 0) drops the dragon spear with the RARE DROP banner
    { const m = monsters.find(x => x.type === 'red_dragon'); const rnd0 = Math.random; let dropped = false, banner = null, rare = false, drops0 = stats.drops;
      if (m) { const keep = { x: m.x, y: m.y, home: { ...m.home } }; m.dead = false; m.hp = 5; m.stunT = 0; m.x = player.x + 300; m.y = player.y; drops = drops.filter(d => d.id !== 'dragon_spear');
        try { Math.random = () => 0; hitMonster(m, 5, 0, true, 'monster'); } finally { Math.random = rnd0; }
        const d = drops.find(x => x.id === 'dragon_spear'); dropped = !!d; rare = !!(d && d.rare); banner = levelBanner && levelBanner.text + ' / ' + levelBanner.sub;
        drops = drops.filter(x => !['dragon_spear', 'mithril_bar', 'dragon_dung', 'dragon_scale', 'coins'].includes(x.id) || dist(x.x, x.y, m.x, m.y) > 60);
        m.dead = false; m.hp = m.maxHp; m.x = keep.x; m.y = keep.y; m.home = keep.home; m.state = 'idle'; }
      check('dk: a red dragon killed with Math.random stubbed to 0 drops a dragon spear (rare, RARE DROP banner)', !!m && dropped && rare && stats.drops === drops0 + 1 && stats.last === 'dragon_spear' && /^RARE DROP \/ Dragon spear$/.test(banner || ''), { found: !!m, dropped, rare, banner }); }
    // the warden's gate: closed below stage 11, opens at 11
    { closeGate(); quest.stage = 7; F.sim(2, []); // 7: below 11 and nothing auto-advances it (Hollowford's file walks 8→11 on its own once the beast is dead)
      const closed = GATE_T.every(([x, y]) => tileAt(x, y) === WARDEN_GATE) && SOLID.has(WARDEN_GATE) && collides(tc(60), tc(96), 13, 'player') && Math.floor(warden.px / TILE) === WARDEN_POST.x && Math.floor(warden.py / TILE) === WARDEN_POST.y;
      let treeLine = 0; for (let x = 1; x <= 99; x++) if (x < 59 || x > 61) { const t = tileAt(x, 95); if (SOLID.has(t)) treeLine++; } for (let y = 96; y <= 138; y++) if (SOLID.has(tileAt(100, y))) treeLine++;
      drain(); F.tp(60, 93); F.face(60, 94); F.press('KeyE'); F.sim(2, []); const spoke = dialog.cur && dialog.cur.who === 'Warden Brann' && /Turn back/.test(dialog.cur.text);
      const blocked = !F.bfs(60, 94, 60, 98);
      quest.stage = 11; DK().gate = false; drain(); F.sim(2, []);
      const opened = GATE_T.every(([x, y]) => tileAt(x, y) === T.DIRT) && !collides(tc(60), tc(96), 13, 'player') && !!F.bfs(60, 94, 60, 98) && Math.floor(warden.px / TILE) === WARDEN_ASIDE.x && DK().gate === true && said(/road south is yours/);
      check('dk: Warden Brann bars the road into the Ashfields (59..61,96) below stage 11 — trees close Wolfwood\'s edge — and the gate opens at stage 11', closed && treeLine === 96 + 43 && spoke && blocked && opened, { closed, treeLine, spoke, blocked, opened, gate: GATE_T.map(([x, y]) => tileAt(x, y)) });
      quest.stage = st0; F.sim(1, []); }
    // the Duke forms the group at stage 14 once the Song is sung
    { quest.stage = 14; quest.sky = Object.assign(quest.sky || {}, { stage: 2 }); quest.dk = freshDK(); if (quest.fang) quest.fang.summoned = false; while (countItem('dragon_horn') > 0) removeItem('dragon_horn', countItem('dragon_horn')); makeRoom(2);
      drain(); F.tp(111, 48); const r1 = F.talk('duke'); const early = !DK().formed && dialog.cur && dialog.cur.who === 'Duke Ferrin' && said(/Song of Above/) && /Song of Above|wind shrine|Seraphel/.test(questText('main')) && MAP_TARGETS[14].label === 'The wind shrine';
      quest.sky.stage = 'done'; const dukeTarget = /Dragon Killers/.test(questText('main')) && MAP_TARGETS[14].label === 'Duke Ferrin';
      drain(); const r2 = F.talk('duke'); F.sim(2, []);
      const horn = countItem('dragon_horn') === 1 || drops.some(d => d.id === 'dragon_horn');
      check('dk: at stage 14 the Duke wants the Song first; with it sung he forms the Dragon Killers (Hale, Garrick, your companion) and gives the dragon horn', typeof r1 === 'number' && early && dukeTarget && typeof r2 === 'number' && DK().formed && horn && !!levelBanner && levelBanner.text === 'THE DRAGON KILLERS' && /summoning circle|lair/.test(questText('main')) && MAP_TARGETS[14].label === "The Fang's lair", { r1, r2, early, dukeTarget, formed: DK().formed, horn, banner: levelBanner && levelBanner.text });
      for (const d of drops) if (d.id === 'dragon_horn') { d.taken = true; addItem('dragon_horn', 1); } drops = drops.filter(d => !d.taken); }
    // allies appear in the lair; The Fang is absent until the horn sounds on the circle
    const fq = quest.fang; const fang = monsters.find(m => m.type === 'the_fang');
    if (!fq || !fang || !window.INSTANCES) { check('dk: The Fang and its lair are present for the group tests', false, { fq: !!fq, fang: !!fang }); quest.stage = st0; h.peace(false); return; }
    const slain0 = fq.slain;
    { fq.slain = false; fq.summoned = false; removeAllies(false); F.tp(18, 112); F.sim(3, []);
      const list = allies(), want = wantedAllies();
      const spawned = list.length === want.length && want.every(d => list.some(m => m.ally === d.id && m.allyName === d.name)) && list.every(m => !m.angry && !m.dead && dist(m.x, m.y, player.x, player.y) < 4 * TILE) && MONSTER_DEFS.ally_knight.level === 30 && MONSTER_DEFS.ally_knight.human && !MONSTER_DEFS.ally_knight.aggro && MONSTER_DEFS.ally_knight.harmless;
      const absent = fang.dead && fang.respawnT === Infinity;
      check('dk: entering the lair with the group formed spawns Hale and Garrick beside you (lv 30, neutral, human); The Fang is absent until summoned', spawned && absent, { allies: list.map(m => m.allyName), want: want.map(d => d.name), fangDead: fang.dead, region: player.region }); }
    { const circle = F.nearestTile([T.SUMMON_CIRCLE], { x: tc(18), y: tc(118) }); let noHorn = false, answered = false, banner = null;
      if (circle) { const hornSlot = player.inv.findIndex(s => s && s.id === 'dragon_horn'); const hornStack = hornSlot >= 0 ? player.inv[hornSlot] : null; if (hornSlot >= 0) player.inv[hornSlot] = null;
        F.tp(circle.x, circle.y - 1); F.face(circle.x, circle.y); drain(); F.press('KeyE'); F.sim(2, []); noHorn = fang.dead && !fq.summoned && dialog.cur && /sounded|horn|Duke/.test(dialog.cur.text);
        if (hornStack) player.inv[hornSlot] = hornStack; else addItem('dragon_horn', 1);
        drain(); F.face(circle.x, circle.y); F.press('KeyE'); F.sim(2, []); answered = !fang.dead && fq.summoned === true && fang.hp === fang.maxHp; banner = levelBanner && levelBanner.text; }
      check('dk: the summoning circle needs the dragon horn; sounding it brings The Fang up (THE FANG ANSWERS)', !!circle && noHorn && answered && banner === 'THE FANG ANSWERS', { circle, noHorn, answered, banner }); }
    // the allies hit the Fang while within two tiles of it
    { fang.dead = false; fang.hp = fang.maxHp; fang.element = 'fire'; fang.elemT = 0; fang.state = 'idle'; fang.stunT = 0; fang.x = tc(18); fang.y = tc(121); F.tp(18, 116);
      for (const m of allies()) { m.x = fang.x + rint(-30, 30); m.y = fang.y - fang.r - 20; m.allyCd = 0; m.allySwings = 0; }
      const rnd0 = Math.random; try { Math.random = () => 0.1; F.sim(150, []); } finally { Math.random = rnd0; }
      const swings = allies().reduce((s, m) => s + (m.allySwings || 0), 0);
      check('dk: allies within two tiles of The Fang swing at it every 1.2 s and it takes the hits; they take none', swings >= 2 && fang.hp < fang.maxHp && allies().every(m => m.hp === m.maxHp && !m.dead), { swings, hp: fang.hp, allies: allies().length }); }
    // the kill: stage 15, the allies go home, the quest log names the Dragon Killers
    { quest.stage = 14; F.tp(18, 114); player.facing = { x: 0, y: 1 }; fang.hp = 1; fang.element = 'fire'; fang.elemT = 0; fang.state = 'idle'; fang.stunT = 0; drops = drops.filter(d => d.id !== 'fang_of_the_fang');
      for (let i = 0; i < 150 && !fang.dead; i++) { fang.x = player.x; fang.y = player.y + 70; fang.stunT = 0; player.attackCd = 0; F.press('Space'); F.sim(3, []); }
      F.sim(3, []);
      check('dk: killing the summoned Fang with the group → stage 15, the Dragon Killers go home, the log reads for it', fang.dead && fq.slain && quest.stage === 15 && allies().length === 0 && DK().slainWith && /Dragon Killers/.test(questText('main')) && /Duke Ferrin/.test(questText('main')), { dead: fang.dead, stage: quest.stage, allies: allies().length, text: questText('main') });
      drops = drops.filter(d => !(['coins', 'fang_of_the_fang', 'mithril_bar', 'dragon_scale'].includes(d.id) && dist(d.x, d.y, fang.x, fang.y) < 120)); }
    // tidy: the Fang stays slain as the lair's own test left it; the group is formed and done
    fq.slain = slain0 || fq.slain; quest.stage = st0; while (countItem('dragon_horn') > 0) removeItem('dragon_horn', 1); removeAllies(false); F.tp(111, 48); F.sim(2, []); drain(); closePanel(); h.peace(false); save();
    void dk0;
  });
}
