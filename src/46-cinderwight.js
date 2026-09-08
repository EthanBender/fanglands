// ============================================================================
// THE CINDERWIGHT — the new face in the last stretch (level 66)
// The audit found twenty levels with nothing new to fight: ash drakes (30) carried the knight all the
// way to The Fang (80). This is what walks that stretch.
//
// What it is: the dragons burn everything in the Ashfields, and not all of it stays down. A cinderwight
// is a burnt dead thing that got back up: no legs, it drifts on its own ash, long arms, a cracked-open
// chest with an ember where a heart should be. Some of them wandered through the crypt into the
// Afterlands, which is why the dead there give them room.
//
// THE MECHANIC — the heart on the ground (the thing you must answer):
//   Every 14 seconds of a fight the wight pulls its own ember heart out and sets it on the ground behind
//   itself. Look at its chest: an ember burning in there means the heart is home, a dark hole means the
//   heart is out. While the heart burns:
//     - the wight heals 14 hp a second (it will out-heal a slow knight),
//     - the ground within two tiles of the wight is too hot to stand on: 5-9 damage a second,
//     - the wight will not stray more than three tiles from its heart, so the fight moves to the ember.
//   Break the ember (40 hp, a swing or two, any weapon) and the wight goes COLD: three seconds stunned,
//   five seconds where every hit lands twice (and pays the damage xp twice), and no new heart for twelve
//   seconds. Leave the ember alone and it burns out on its own after ten seconds, 140 hp better off.
//
// Where it lives: three in the deep Ashfields (never on the track in, the dung farm or the lair
// approach) and two inside the Afterlands instance. Nowhere else.
// Feature file: registers through HOOKS only, edits no core file. window.CINDERWIGHT is the test handle.
// ============================================================================
{
  const WIGHT = 'cinderwight', HEART = 'cinder_heart';
  // the fight's numbers, all in one place
  const KINDLE_EVERY = 14;        // seconds of fighting before it sets its heart down
  const KINDLE_AFTER_BREAK = 12;  // and after you break one
  const HEART_HP = 40, HEART_LIFE = 10;
  const FEED_HEAL = 14;           // hp a second while the heart burns
  const HEAT_EVERY = 1, HEAT_R = 2 * TILE, HEAT_MIN = 5, HEAT_MAX = 9;
  const TETHER = 3 * TILE;        // how far it will leave its heart
  const COLD_STUN = 3, COLD_TIME = 5;
  // the Ashfields anchors: deep south-east of dragon country, clear of Dunstan's farm (y 96-107), the
  // track in and the lair approach (y 103-107), and clear of The Fang's lair (x 2-34). The real spots are
  // searched out from these at world-gen so nothing wakes in lava, obsidian or a dead tree.
  const ASH_ANCHORS = [[88, 122], [70, 126], [46, 122]];
  const MIN_Y = 116, MIN_X = 44, SPOT_APART = 8;
  // Inside the Afterlands (60 x 40). Both sit in the empty southern flats, well clear of the two routes the
  // instance is built around — the crypt steps (30,3) down to the graveyard (13,27), and the crypt steps
  // across to Count Ashvane (46,18). A wight sees eight tiles and breaks its leash fourteen from home, so
  // neither spot can reach a knight walking either route, and a level-40 quest boss stays a level-40 fight.
  // The self-test measures both distances off the live tile grid; do not move these without rerunning it.
  const AFTER_ANCHORS = [[26, 36], [52, 36]];   // resolve to (26,36) south of the graveyard and (53,35) south of the chapel
  const ASH_SPOTS = [], AFTER_SPOTS = [];
  const STATS = { kindled: 0, broken: 0, burnedOut: 0, healed: 0, heatHits: 0, lastHeat: 0, coldHits: 0, lastCold: 0 };
  const CQ = () => quest.cinderwight || (quest.cinderwight = { taught: false });

  // ---------- the monsters ----------
  // The drop table pays for the trip: obsidian and dragon scales feed the Smithing recipes at 42-45, coal
  // and dragon bone sell, grave dust every kill, and one kill in twenty-four hands over a vampire fang or
  // mithril bars. Only items that already exist, so nothing here is a trophy with no use.
  const has = id => id === 'nothing' || !!ITEMS[id];
  MONSTER_DEFS[WIGHT] = {
    name: 'Cinderwight', level: 66, r: 20, hp: 520, att: 62, maxHit: 26, def: 46, speed: 108, aggro: true, sight: 8 * TILE, respawn: 240,
    drops: {
      always: [['coins', 150, 280], ['grave_dust', 1, 2]].filter(r => has(r[0])),
      table: [['obsidian', 1, 2, 10], ['dragon_bone', 1, 2, 8], ['coal', 2, 4, 7], ['dragon_scale', 1, 1, 5], ['nothing', 0, 0, 10]].filter(r => has(r[0])),
      rare: { chance: 24, table: [['vampire_fang', 1, 1, 3], ['mithril_bar', 2, 3, 2]].filter(r => has(r[0])) },
    },
  };
  // The heart is a real thing you fight, so it is a monster: any weapon reaches it, it has hit points and
  // a health bar, and a tap on the iPad walks the knight over and swings. Level 1 on purpose — it pays the
  // core's 4 xp a point of damage and nothing else (the kill bonus in 30-ashdrake starts at level 10), and
  // it carries no drops: the loot is on the wight.
  MONSTER_DEFS[HEART] = {
    name: 'Cinder heart', level: 1, r: 10, hp: HEART_HP, att: 0, maxHit: 0, def: 1, speed: 0, aggro: false, harmless: true, sight: 0, respawn: 0, drops: {},
  };

  // ---------- sprites ----------
  // A tall burnt husk drifting on its own ash: no legs, long arms with charcoal fingers, ribs open at the
  // front and a skull with the jaw hanging. The chest is the tell — an ember means the heart is home, a
  // dark smoking hole means the heart is on the ground and the wight is drinking it back.
  HOOKS.drawMonster[WIGHT] = (g, e, hurt) => {
    const fx = e.facing.x, fy = e.facing.y, t = time;
    const feeding = !!(e.heart && !e.heart.dead), cold = (e.coldT || 0) > 0;
    const body = hurt ? '#ffb0b0' : cold ? '#4b515c' : '#2f2a2b';
    const bone = hurt ? '#ffd8d8' : cold ? '#9fb6cc' : '#6b5c50';
    const ember = cold ? '#7ec8ff' : '#ff7a2a';
    const drift = Math.sin(t * 2.2) * 2, swing = e.moving ? Math.sin(e.walkT) * 4 : Math.sin(t * 1.6) * 2;
    const reach = e.attackT > 0 ? 8 : 0;
    // the ash it stands in
    g.fillStyle = cold ? 'rgba(150,180,210,0.30)' : 'rgba(150,130,110,0.35)';
    for (const [ox, oy, rx, ry] of [[-6, 12, 10, 5], [6, 14, 9, 4], [0, 16, 13, 5]]) { g.beginPath(); g.ellipse(ox, oy, rx, ry, 0, 0, 7); g.fill(); }
    g.save(); g.translate(0, drift);
    // trunk
    g.fillStyle = body; g.beginPath(); g.moveTo(-8, 14); g.lineTo(-9, -12); g.quadraticCurveTo(-7, -22, 0, -24); g.quadraticCurveTo(7, -22, 9, -12); g.lineTo(8, 14); g.closePath(); g.fill();
    // two long arms, charcoal fingers on the ends
    g.lineCap = 'round';
    for (const side of [-1, 1]) {
      const sx = side * 8, sy = -14, ex = side * (15 + reach) + fx * reach, ey = 6 + side * swing + fy * reach * 0.4;
      g.strokeStyle = body; g.lineWidth = 5; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(side * 17, -4, ex, ey); g.stroke();
      g.strokeStyle = bone; g.lineWidth = 1.6;
      for (let c = -1; c <= 1; c++) { g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + side * 4 + c * 2, ey + 6 + Math.abs(c) * 1.5); g.stroke(); }
    }
    // ribs
    g.strokeStyle = bone; g.lineWidth = 1.8;
    for (let k = 0; k < 4; k++) { const y = -18 + k * 5; g.beginPath(); g.moveTo(-7, y); g.quadraticCurveTo(0, y + 3, 7, y); g.stroke(); }
    // the chest: ember at home, or a smoking hole while the heart is out
    if (feeding) {
      g.fillStyle = '#120e0c'; g.beginPath(); g.ellipse(0, -8, 5.5, 6.5, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(150,140,130,0.5)';
      for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(Math.sin(t * 2 + k) * 3, -14 - ((t * 10 + k * 4) % 12), 1.6, 0, 7); g.fill(); }
    } else {
      const gr = g.createRadialGradient(0, -8, 1, 0, -8, 12); gr.addColorStop(0, ember); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, -8, 12, 0, 7); g.fill();
      g.fillStyle = ember; g.beginPath(); g.ellipse(0, -8, 3.5, 4.5, 0, 0, 7); g.fill();
    }
    // skull, sockets lit from inside, jaw hanging (and dropping open on a swing)
    g.fillStyle = body; g.beginPath(); g.ellipse(fx * 1.5, -30 + fy * 1.5, 7.5, 8, 0, 0, 7); g.fill();
    g.fillStyle = '#120e0c'; g.beginPath(); g.ellipse(fx * 2 - 3, -30 + fy * 2, 2, 2.4, 0, 0, 7); g.ellipse(fx * 2 + 3, -30 + fy * 2, 2, 2.4, 0, 0, 7); g.fill();
    g.fillStyle = ember; g.beginPath(); g.arc(fx * 2 - 3, -30 + fy * 2, 1.1, 0, 7); g.arc(fx * 2 + 3, -30 + fy * 2, 1.1, 0, 7); g.fill();
    g.strokeStyle = bone; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-4, -25); g.quadraticCurveTo(0, -19 + (e.attackT > 0 ? 4 : 0), 4, -25); g.stroke();
    // embers coming off the shoulders
    g.fillStyle = ember;
    for (let k = 0; k < 4; k++) { const a = t * 1.4 + k * 1.7; g.globalAlpha = 0.35 + 0.3 * Math.sin(a * 2); g.beginPath(); g.arc(Math.sin(a) * 11, -22 - ((t * 14 + k * 6) % 18), 1.4, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    g.restore();
  };
  // the heart: a cracked black lump with fire inside it, breathing
  HOOKS.drawMonster[HEART] = (g, e) => {
    const t = time, pulse = 0.75 + Math.sin(t * 5 + (e.x + e.y) * 0.01) * 0.25;
    const gr = g.createRadialGradient(0, 0, 1, 0, 0, 22 * pulse); gr.addColorStop(0, 'rgba(255,150,60,0.55)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 22 * pulse, 0, 7); g.fill();
    g.fillStyle = '#2a201c'; g.beginPath(); g.ellipse(0, 0, 9, 8, 0, 0, 7); g.fill();
    g.fillStyle = '#ff7a2a';
    for (const [ox, oy, r] of [[-3, -2, 2.6], [3, 1, 2.2], [0, 3, 1.8], [2, -4, 1.6]]) { g.beginPath(); g.arc(ox, oy, r * pulse, 0, 7); g.fill(); }
    g.fillStyle = '#ffd166'; g.beginPath(); g.arc(0, 0, 2.2 * pulse, 0, 7); g.fill();
    g.globalAlpha = 0.5; g.fillStyle = '#ff9a4a';
    for (let k = 0; k < 3; k++) { const a = t * 3 + k * 2.1; g.beginPath(); g.arc(Math.sin(a) * 5, -8 - ((t * 16 + k * 5) % 14), 1.5, 0, 7); g.fill(); }
    g.globalAlpha = 1;
  };

  // ---------- where they stand ----------
  // No tile is carved: a spot only counts if the 3x3 around it is already soft ground (ash, grass, dirt or
  // ashes), so lava, obsidian, dead trees, bones and the shrine are all left exactly as dragon country
  // built them. This hook runs last of all the world hooks, so what it reads is the finished map.
  HOOKS.world.push((rnd, api) => {
    ASH_SPOTS.length = 0;
    const af = REGIONS.find(r => r.name === 'The Ashfields');
    if (!af) return;                                    // no dragon country (27-dragons absent): nothing to stand on
    const lair = REGIONS.find(r => r.name === "The Fang's Lair");
    const SOFT = ['ASH', 'GRASS', 'DIRT', 'ASHES'].filter(n => n in T).map(n => T[n]);
    const inLair = (x, y) => !!lair && x >= lair.x0 && x <= lair.x1 && y >= lair.y0 && y <= lair.y1;
    const okSpot = (x, y) => {
      if (x < Math.max(af.x0 + 1, MIN_X) || x > af.x1 - 1 || y < Math.max(af.y0, MIN_Y) || y > af.y1 - 1) return false;
      if (inLair(x, y)) return false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!SOFT.includes(api.tileAt(x + dx, y + dy))) return false;
      if (MONSTER_SPAWNS.some(s => dist(s.tx, s.ty, x, y) < SPOT_APART)) return false;
      if (ASH_SPOTS.some(s => dist(s[0], s[1], x, y) < SPOT_APART)) return false;
      return true;
    };
    for (const [ax, ay] of ASH_ANCHORS) {
      let found = null;
      for (let r = 0; r <= 16 && !found; r++) for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (okSpot(ax + dx, ay + dy)) found = [ax + dx, ay + dy];
      }
      if (found) ASH_SPOTS.push(found);
    }
    api.spawnList(WIGHT, ASH_SPOTS);
  });

  // The Afterlands (35-night) is an instance, built once when it was defined. Two wights are added to its
  // spawn list here, on ground its own build already left open — the instance's tiles are not touched.
  {
    const inst = window.INSTANCES && typeof INSTANCES.get === 'function' ? INSTANCES.get('afterlands') : null;
    if (inst && inst.tiles) {
      const at = (x, y) => (x >= 0 && y >= 0 && x < inst.w && y < inst.h) ? inst.tiles[y * inst.w + x] : T.WALL;
      const clear = (x, y) => {
        if (x < 2 || y < 2 || x > inst.w - 3 || y > inst.h - 3) return false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (SOLID.has(at(x + dx, y + dy))) return false;
        return !inst.spawns.some(([, sx, sy]) => dist(sx, sy, x, y) < 6);
      };
      for (const [ax, ay] of AFTER_ANCHORS) {
        let found = null;
        for (let r = 0; r <= 10 && !found; r++) for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (clear(ax + dx, ay + dy)) found = [ax + dx, ay + dy];
        }
        if (found) { AFTER_SPOTS.push(found); inst.spawns.push([WIGHT, found[0], found[1]]); }
      }
    }
  }

  // ---------- the fight ----------
  const heartOf = m => (m.heart && !m.heart.dead && monsters.includes(m.heart)) ? m.heart : null;
  function makeHeart(owner, x, y) {
    return { type: HEART, x, y, home: { x, y }, r: MONSTER_DEFS[HEART].r, hp: HEART_HP, maxHp: HEART_HP, speed: 0, angry: false, state: 'idle',
      wanderT: 9e9, wander: { x: 0, y: 0 }, attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 9e9, facing: { x: 0, y: 1 }, walkT: 0, moving: false, stunT: 0,
      emberT: 0, owner };
  }
  function kindle(m) {
    const dx = m.x - player.x, dy = m.y - player.y, d = Math.hypot(dx, dy) || 1;   // behind it, away from the knight
    const want = { x: m.x + dx / d * 1.5 * TILE, y: m.y + dy / d * 1.5 * TILE };
    const sp = safeSpot(want.x, want.y, MONSTER_DEFS[HEART].r, 'beast') || safeSpot(m.x, m.y, MONSTER_DEFS[HEART].r, 'beast') || { x: m.x, y: m.y };
    const heart = makeHeart(m, sp.x, sp.y);
    monsters.push(heart); m.heart = heart; m.kindleT = KINDLE_EVERY; m.heatT = HEAT_EVERY; STATS.kindled++;
    burst(m.x, m.y - 8, '#ff7a2a', 18, 120); burst(sp.x, sp.y, '#ff9a4a', 22, 90); sfx('fire');
    floatText(m.x, m.y - m.r - 24, 'It sets its heart down', '#ff8a3a', 13);
    const q = CQ();
    if (!q.taught) { q.taught = true; say('It has pulled its own heart out and put it on the ground. While that ember burns it heals faster than you can cut, and the ash round it will scald you. Break the ember.', 'The Voice'); }
  }
  function burnOut(heart) {
    const m = heart.owner;
    burst(heart.x, heart.y, '#6a6058', 16, 70); floatText(heart.x, heart.y - 18, 'the heart burns out', '#9a8f86', 12);
    if (m) { m.heart = null; m.kindleT = KINDLE_EVERY; }
    STATS.burnedOut++;
  }
  HOOKS.update.push(dt => {
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      if (m.type === HEART) {
        if (m.dead) { monsters.splice(i, 1); continue; }          // broken: the kill hook below already told the wight
        m.x = m.home.x; m.y = m.home.y;                           // an ember on the ground stays put: the core's crowd-shoving must not walk it about
        m.emberT += dt;
        if (m.emberT >= HEART_LIFE) { burnOut(m); monsters.splice(i, 1); }
        continue;
      }
      if (m.type !== WIGHT) continue;
      if (m.dead) { const h = heartOf(m); if (h) h.emberT = HEART_LIFE; m.heart = null; m.coldT = 0; m.kindleT = KINDLE_EVERY; continue; }
      m.coldT = Math.max(0, (m.coldT || 0) - dt);
      const heart = heartOf(m); if (!heart) m.heart = null;
      if (heart) {
        // drinking: it heals, the ash round it scalds, and it will not leave the ember behind
        if (m.hp < m.maxHp) { const heal = Math.min(FEED_HEAL * dt, m.maxHp - m.hp); m.hp += heal; STATS.healed += heal; }
        const d = dist(m.x, m.y, heart.x, heart.y);
        if (d > TETHER) { const back = Math.min(m.speed * dt, d - TETHER); moveEntity(m, (heart.x - m.x) / d * back, (heart.y - m.y) / d * back, 'beast'); }
        m.heatT = (m.heatT ?? HEAT_EVERY) - dt;
        if (m.heatT <= 0) {
          m.heatT = HEAT_EVERY;
          if (!player.dead && !window.__peace && dist(m.x, m.y, player.x, player.y) < HEAT_R + player.r) {
            const dmg = rint(HEAT_MIN, HEAT_MAX); STATS.heatHits++; STATS.lastHeat = dmg;
            hurtPlayer(dmg, m.x, m.y, true); floatText(player.x, player.y - 44, 'too hot', '#ff8a3a', 12); burst(player.x, player.y, '#ff9a4a', 6, 60);
          }
        }
      } else if (m.state === 'chase' && m.stunT <= 0 && !window.__peace) {
        // the clock only runs while it is fighting you, so the first heart lands well into the fight
        m.kindleT = Math.max(0, (m.kindleT ?? KINDLE_EVERY) - dt);
        if (m.kindleT <= 0 && !player.dead) kindle(m);
      } else if (m.state === 'return') m.kindleT = KINDLE_EVERY;   // it lost you: the clock starts again next time
    }
  });
  // cold: for five seconds after its heart is broken every hit lands twice, and the second half pays the
  // core's own 4 xp a point. HOOKS.hit runs before hitMonster's death check, so a killing blow still kills.
  HOOKS.hit.push((m, dmg, source) => {
    if (m.type !== WIGHT || !((m.coldT || 0) > 0) || !(dmg > 0)) return;
    m.hp -= dmg; STATS.coldHits++; STATS.lastCold = dmg;
    floatText(m.x, m.y - m.r - 22, `-${dmg} cold`, '#8fd3ff', 13); burst(m.x, m.y, '#8fd3ff', 6, 60);
    // the same 4 xp a point the core paid for the first half, to the same skill (a bomb is the one case
    // the core pays nothing for and this does: a bomb on a cold wight is a fair enough trade)
    if (source === 'player') gainXp(weaponDef() && weaponDef().weapon.ranged && !player.mech ? 'range' : 'melee', dmg * 4);
  });
  HOOKS.kill.push(m => {
    if (m.type === HEART) {
      const w = m.owner; STATS.broken++;
      if (w && !w.dead) {
        w.heart = null; w.stunT = Math.max(w.stunT || 0, COLD_STUN); w.coldT = COLD_TIME; w.kindleT = KINDLE_AFTER_BREAK;
        burst(w.x, w.y, '#8fd3ff', 22, 120); floatText(w.x, w.y - w.r - 24, 'It goes cold', '#8fd3ff', 14); sfx('boss');
      }
      return;
    }
    if (m.type === WIGHT) { const h = heartOf(m); if (h) h.emberT = HEART_LIFE; m.heart = null; m.coldT = 0; }
  });
  HOOKS.newGame.push(() => { quest.cinderwight = { taught: false }; for (const k in STATS) STATS[k] = 0; });

  // ---------- HUD: what it is doing, while it is near ----------
  // The core already paints a generic boss bar for anything level 25 or better with 300+ hp inside twelve
  // tiles (10-hud.js drawBossBars), and a cinderwight passes that rule, so the core bar is already showing
  // its name, its level and its hit points at HUD_LAYOUT.bossBarY. This panel never repeats any of that and
  // never sits on top of it: it steps down past the bars and carries only the mechanic — what to do right
  // now, and how much ember is left. If no bar is up for this wight (further than twelve tiles, or two other
  // big things took the only two bar slots) it puts the hit points back so the panel still reads on its own.
  const BOSS_H = 48, BOSS_GAP = 8;   // one core boss bar, and the gap the core leaves under it
  const bossBarList = () => monsters.filter(b => !b.dead && b.type !== 'the_fang' && MONSTER_DEFS[b.type]
    && MONSTER_DEFS[b.type].level >= 25 && MONSTER_DEFS[b.type].hp >= 300
    && dist(b.x, b.y, player.x, player.y) <= 12 * TILE).slice(0, 2);
  function wightPanel(g) {
    let best = null;
    for (const m of monsters) {
      if (m.type !== WIGHT || m.dead) continue;
      const feeding = !!heartOf(m), cold = (m.coldT || 0) > 0;
      if (!feeding && !cold) continue;
      const d = dist(m.x, m.y, player.x, player.y); if (d > 14 * TILE) continue;
      if (!best || d < best.d) best = { m, d, feeding, cold };
    }
    if (!best) return;
    const { m, feeding } = best, heart = heartOf(m);
    const bars = bossBarList(), onBar = bars.indexOf(m) >= 0;
    const col = feeding ? '#ff8a3a' : '#8fd3ff';
    const lay = typeof HUD_LAYOUT !== 'undefined' ? HUD_LAYOUT : null;
    const w = lay && lay.short ? 180 : Math.min(236, VW - 28), x = 14;
    const hpRow = !onBar;                        // only when the core bar is not already showing them
    const emberY = hpRow ? 42 : 27;              // where the ember bar sits inside the panel
    const h = feeding ? emberY + 18 : hpRow ? 48 : 28;
    const touchFloor = (isTouch && lay && !lay.short) ? lay.hotbarY + lay.hotbarH + 12 : 0;
    // the boss bars are drawn before every HUD hook and do not move the shared cursor, so step past them here
    const bossFloor = (bars.length && lay) ? lay.bossBarY + bars.length * (BOSS_H + BOSS_GAP) : 0;
    const y = Math.max(HUD.leftY, touchFloor, bossFloor, 84);   // shared left-HUD cursor: stack under whatever drew above
    HUD.leftY = y + h + 6;
    roundRect(g, x, y, w, h, 10); g.fillStyle = 'rgba(10,14,22,0.82)'; g.fill(); g.strokeStyle = col; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#e6edf3'; g.font = `700 14px ${DISPLAY}`; g.textAlign = 'left'; g.fillText('CINDERWIGHT', x + 12, y + 19);
    g.fillStyle = col; g.font = 'bold 11px sans-serif'; g.textAlign = 'right';
    g.fillText(feeding ? 'BREAK THE HEART' : 'COLD · HIT IT NOW', x + w - 12, y + 19);
    if (hpRow) {
      g.fillStyle = '#2a2f3a'; roundRect(g, x + 12, y + 27, w - 24, 11, 5); g.fill();
      g.fillStyle = '#e63946'; roundRect(g, x + 12, y + 27, (w - 24) * clamp(m.hp / m.maxHp, 0, 1), 11, 5); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText(`${Math.ceil(m.hp)} / ${m.maxHp}`, x + w / 2, y + 36);
    }
    if (feeding && heart) {
      g.fillStyle = '#2a2f3a'; roundRect(g, x + 12, y + emberY, w - 24, 9, 4); g.fill();
      g.fillStyle = col; roundRect(g, x + 12, y + emberY, (w - 24) * clamp(heart.hp / heart.maxHp, 0, 1), 9, 4); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText(`heart ${Math.ceil(heart.hp)} / ${heart.maxHp}`, x + w / 2, y + emberY + 8);
    }
  }
  HOOKS.hud.push(wightPanel);

  // ---------- the book (44-wiki) ----------
  // Both pages build themselves out of MONSTER_DEFS and the spawn lists; what a page cannot work out on
  // its own is written here and merged over it — how the fight actually goes, and where the heart appears.
  if (window.WIKI && typeof WIKI.add === 'function') {
    WIKI.add('monsters', {
      id: WIGHT, name: MONSTER_DEFS[WIGHT].name,   // add() defaults name to the id, so it is passed back in
      blurb: `It comes at you the moment it sees you, and it fights with its own heart. About ${KINDLE_EVERY} seconds into the fight it pulls the ember out of its chest and puts it on the ground behind itself — watch its chest go dark, that is the tell. While that ember burns the wight heals ${FEED_HEAL} hp a second, the ash within two tiles of it scalds you for ${HEAT_MIN}-${HEAT_MAX} a second, and it will not go more than three tiles from the ember. Break the ember and the wight goes cold: ${COLD_STUN} seconds stunned, ${COLD_TIME} seconds where every hit lands twice, and no new heart for ${KINDLE_AFTER_BREAK}. Leave the ember alone and it burns out after ${HEART_LIFE} seconds, with the wight ${FEED_HEAL * HEART_LIFE} hp better off. Bring food.`,
    });
    WIKI.add('monsters', {
      id: HEART, name: MONSTER_DEFS[HEART].name,
      where: ['The Ashfields — wherever a cinderwight is fighting', 'The Afterlands — the same'],
      blurb: `Not a creature of its own: a cinderwight's heart, taken out and set on the ground so the wight can drink the heat back. It has ${HEART_HP} hit points and almost no defence, so a swing or two breaks it, and breaking it is how you beat the wight. It carries nothing: the loot is on the wight.`,
    });
  }

  // ---------- tell the progression audit (42-playthrough reads HOOKS.xpSource) ----------
  if (HOOKS.xpSource) HOOKS.xpSource.push(add => {
    const D = MONSTER_DEFS[WIGHT], xp = D.hp * 4 + D.level * 10;         // 2080 damage xp + 660 kill bonus = 2740
    // the audit's own kill-time maths, at the level this opens: best sword the loadout table gives, armour 76
    const sword = ITEMS.mithril_sword ? ITEMS.mithril_sword : ITEMS.steel_sword, w = sword.weapon, L = D.level;
    const acc = (a, d) => a > d ? 1 - (d + 2) / (2 * (a + 1)) : a / (2 * (d + 1));
    const maxHit = 2 + Math.floor((L + 8) * (w.str + 64) / 300);
    const dps = acc((L + 8) * (64 + w.att), (D.def + 8) * 64) * (1 + maxHit) / 2 / w.cd;
    const secs = (D.hp + HEART_HP) / dps + 3;                             // the heart has to be broken too
    const perHour = MONSTER_SPAWNS.filter(s => s.type === WIGHT).length * 3600 / D.respawn;
    add('melee', 'a cinderwight kill (level 66)', L, xp, secs, `${Math.round(perHour)}/h in the Ashfields, two more in the Afterlands; one heart broken per kill`, xp * perHour);
  });

  window.CINDERWIGHT = {
    WIGHT, HEART, ASH_SPOTS, AFTER_SPOTS, heartOf, kindle, panel: wightPanel,
    NUMBERS: { KINDLE_EVERY, KINDLE_AFTER_BREAK, HEART_HP, HEART_LIFE, FEED_HEAL, HEAT_EVERY, HEAT_R, HEAT_MIN, HEAT_MAX, TETHER, COLD_STUN, COLD_TIME },
    get stats() { return { ...STATS }; },
  };

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'cinderwight: ';
    const D = MONSTER_DEFS[WIGHT], HD = MONSTER_DEFS[HEART];
    const af = REGIONS.find(r => r.name === 'The Ashfields'), lair = REGIONS.find(r => r.name === "The Fang's Lair");
    const homeT = m => ({ x: Math.floor(m.home.x / TILE), y: Math.floor(m.home.y / TILE) });
    const ws = monsters.filter(m => m.type === WIGHT);
    const hp0 = player.hp, mech0 = player.mech, r0 = player.r, speed0 = player.speed;
    // these checks are made on foot: a mech soaks the scald, and an instance will not take one through the door
    if (player.mech) { player.mech = null; player.r = 13; player.speed = typeof BASE_SPEED !== 'undefined' ? BASE_SPEED : 175; }
    h.peace(true); window.__kidmode = false;

    // 1. the creature and where it stands
    { const homes = ws.map(homeT);
      const inAsh = !!af && homes.every(p => p.x >= af.x0 && p.x <= af.x1 && p.y >= af.y0 && p.y <= af.y1);
      const deep = homes.every(p => p.y >= MIN_Y && p.x >= MIN_X);
      const open = homes.every(p => !SOLID.has(tileAt(p.x, p.y)));
      const outOfLair = !lair || homes.every(p => !(p.x >= lair.x0 && p.x <= lair.x1 && p.y >= lair.y0 && p.y <= lair.y1));
      const apart = homes.every((p, i) => homes.every((q, j) => i === j || dist(p.x, p.y, q.x, q.y) >= SPOT_APART));
      check(P + 'three level-66 cinderwights stand on open ground deep in the Ashfields (520 hp, att 62, max hit 26, def 46, speed 108, aggressive, sight 8 tiles, 240 s respawn)',
        ws.length === 3 && D.level === 66 && D.hp === 520 && D.att === 62 && D.maxHit === 26 && D.def === 46 && D.speed === 108 && D.aggro === true && D.respawn === 240 && D.sight === 8 * TILE
        && ws.every(m => m.maxHp === 520) && inAsh && deep && open && outOfLair && apart,
        { n: ws.length, homes: homes.map(p => [p.x, p.y]), inAsh, deep, open, outOfLair, apart }); }

    // 2. the heart is a real target with no free loot on it
    check(P + 'its heart is a thing you can hit: 40 hp, level 1, harmless, no drops of its own',
      HD.hp === HEART_HP && HD.level === 1 && HD.harmless === true && HD.aggro === false && HD.maxHit === 0 && HD.speed === 0
      && !HD.drops.always && !HD.drops.table && !HD.drops.rare && typeof HOOKS.drawMonster[HEART] === 'function' && typeof HOOKS.drawMonster[WIGHT] === 'function',
      { hp: HD.hp, level: HD.level, drops: Object.keys(HD.drops).length });

    // 3. you can walk to one: from the track down into the Ashfields, no teleport
    { const target = ws.map(homeT).sort((a, b) => a.x - b.x || a.y - b.y)[0];
      F.tp(60, 100); const r = F.walkTo(target.x, target.y, 8000);
      const at = { x: Math.floor(player.x / TILE), y: Math.floor(player.y / TILE) };
      check(P + 'a cinderwight is reachable on foot from the track into the Ashfields (60,100)',
        typeof r === 'number' && Math.abs(at.x - target.x) <= 1 && Math.abs(at.y - target.y) <= 1,
        { steps: r, target: [target.x, target.y], stoppedAt: [at.x, at.y] }); }

    // 4. the mechanic, on clear ground away from dragon country so nothing else joins in
    { // a lane in the open fields that is already clear for thirteen tiles east and two either side: the
      // wight is 20 px wide and has to do real walking here, so the lane is found on the live map (no tile
      // is changed) rather than assumed
      const findLane = (cx, cy) => {
        for (let r = 0; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx, y = cy + dy;
          if (!inMap(x - 3, y - 3) || !inMap(x + 12, y + 3) || inVillageBounds(tc(x), tc(y))) continue;
          let ok = true;
          for (let yy = y - 2; yy <= y + 2 && ok; yy++) for (let xx = x - 2; xx <= x + 11 && ok; xx++) if (SOLID.has(tileAt(xx, yy)) || insideBuilding(xx, yy)) ok = false;
          if (ok) return { x, y };
        }
        return h.openSpot(cx, cy);
      };
      const o = findLane(66, 52), m = ws[0];
      // a hired hero swings at whatever stands beside the knight, ember included, so park them well away
      // for this block (they are put back exactly as they were at the end of it)
      const C = (window.FANGLANDS && FANGLANDS.companion && FANGLANDS.companion.comp) ? FANGLANDS.companion.comp() : null;
      const cBack = C && C.id ? { mode: C.mode, x: C.x, y: C.y } : null;
      if (cBack) { C.mode = 'stay'; C.x = tc(o.x) - 30 * TILE; C.y = tc(o.y); }
      const back = { x: m.x, y: m.y, home: { x: m.home.x, y: m.home.y }, dead: m.dead, hp: m.hp };
      const others = monsters.filter(x => x !== m && !x.dead && dist(x.x, x.y, tc(o.x), tc(o.y)) < 16 * TILE);
      const otherStun = others.map(x => x.stunT || 0); for (const x of others) x.stunT = 999;
      const clearHeart = () => { const hh = m.heart; if (hh) { const i = monsters.indexOf(hh); if (i >= 0) monsters.splice(i, 1); } m.heart = null; };
      const wake = (kindleIn = 0) => {
        clearHeart(); m.dead = false; m.deadT = 0; m.hp = m.maxHp; m.x = tc(o.x + 2); m.y = tc(o.y); m.home = { x: m.x, y: m.y };
        m.state = 'chase'; m.angry = true; m.stunT = 0; m.coldT = 0; m.heatT = HEAT_EVERY; m.attackCd = 999; m.speed = 0; m.kindleT = kindleIn;
      };
      F.tp(o.x, o.y); player.hp = 5000; player.hurtT = 0; h.peace(false);

      // 4a. it plants the heart behind itself, and its chest goes dark
      wake(0); F.sim(2, []);
      const heart = m.heart;
      const planted = !!heart && monsters.includes(heart) && heart.type === HEART && heart.hp === HEART_HP && heart.owner === m
        && dist(heart.x, heart.y, m.x, m.y) < 3 * TILE && dist(heart.x, heart.y, player.x, player.y) > dist(m.x, m.y, player.x, player.y);
      check(P + 'after 14 s of a fight it sets its heart on the ground behind itself (40 hp, further from you than the wight is)',
        planted && CINDERWIGHT.NUMBERS.KINDLE_EVERY === 14,
        { planted: !!heart, heartHp: heart && heart.hp, awayFromKnight: heart && +(dist(heart.x, heart.y, player.x, player.y) - dist(m.x, m.y, player.x, player.y)).toFixed(1) });


      // 4a-ii. the panel must not print on top of the core's boss bar. 10-hud.js paints a generic bar for
      // anything level 25+ with 300+ hp inside twelve tiles, and a cinderwight is one of those, so both used
      // to land on the same rectangle. Recorded here for real: every fillText the core bar and this panel
      // emit for one frame. No two may share a point, the panel must start below the bar, and while the bar
      // is up the panel must not repeat the hit points. Take any other big monster out of the list first so
      // the bar under test is certainly this wight's (the core shows at most two).
      { const roster = monsters.slice();
        for (const b of roster) {
          if (b === m || b.dead || b.type === 'the_fang' || !MONSTER_DEFS[b.type]) continue;
          if (MONSTER_DEFS[b.type].level < 25 || MONSTER_DEFS[b.type].hp < 300) continue;
          if (dist(b.x, b.y, player.x, player.y) > 12 * TILE) continue;
          const i = monsters.indexOf(b); if (i >= 0) monsters.splice(i, 1);
        }
        const marks = [], nop = () => { };
        const rec = new Proxy({}, { get: (t, k) => k === 'measureText' ? (() => ({ width: 10 }))
          : k === 'fillText' ? ((s, tx, ty) => { marks.push({ s, x: Math.round(tx), y: Math.round(ty) }); })
          : (k === 'createLinearGradient' || k === 'createRadialGradient') ? (() => ({ addColorStop: nop }))
          : typeof k === 'string' ? nop : undefined, set: () => true });
        const leftBack = HUD.leftY;
        HUD.leftY = 82; drawBossBars(rec, HUD_LAYOUT.bossBarY);      // the core draws its bars first, every frame
        const nBar = marks.length, barred = marks.some(t => t.s === 'CINDERWIGHT');
        CINDERWIGHT.panel(rec);
        HUD.leftY = leftBack; monsters.length = 0; for (const b of roster) monsters.push(b);
        const mine = marks.slice(nBar);
        const top = mine.length ? Math.min(...mine.map(t => t.y)) : -1;
        const hpLines = mine.filter(t => /^\d+ \/ \d+$/.test(t.s)).length;
        let clash = null;
        for (let i = 0; i < marks.length && !clash; i++) for (let j = i + 1; j < marks.length && !clash; j++)
          if (marks[i].x === marks[j].x && marks[i].y === marks[j].y) clash = [marks[i].s, marks[j].s, marks[i].x, marks[i].y];
        check(P + 'its HUD panel stacks under the core boss bar: nothing overprints, and it does not repeat the hit points the bar already shows',
          barred && nBar >= 3 && mine.length >= 2 && !clash && top >= HUD_LAYOUT.bossBarY + 48 + 8 && hpLines === 0
          && mine.some(t => t.s === 'BREAK THE HEART') && mine.some(t => /^heart \d+ \/ \d+$/.test(t.s)),
          { bossBarTexts: nBar, bossBarDrewWight: barred, panelTexts: mine.map(t => [t.s, t.x, t.y]), panelTopY: top, bossBarY: HUD_LAYOUT.bossBarY, repeatedHpLines: hpLines, clash }); }
      // 4b. while it burns: 14 hp a second back, and the ash scalds
      if (heart) {
        m.hp = 300; const before = m.hp; F.sim(60, []); const healed = m.hp - before;
        player.hp = 5000; player.hurtT = 0; m.heatT = 0.5; const php = player.hp; F.sim(40, []); const burn = php - player.hp;
        check(P + 'while the heart burns the wight heals 14 hp a second and the ash within two tiles scalds for 5-9',
          healed > 13.5 && healed < 14.5 && burn >= HEAT_MIN && burn <= HEAT_MAX && CINDERWIGHT.stats.heatHits >= 1,
          { healed: +healed.toFixed(2), burn, heatHits: CINDERWIGHT.stats.heatHits });

        // 4c. it will not leave its heart: walk away and it comes after you, then stops three tiles from the ember
        m.speed = D.speed; player.hp = 5000; F.tp(o.x + 9, o.y); F.sim(360, []);   // 6 s: long enough to step round its own ember and reach the end of the tether
        const away = dist(m.x, m.y, heart.x, heart.y), stayed = heart.x === heart.home.x && heart.y === heart.home.y;
        check(P + 'it follows you only as far as three tiles from its burning heart, and the ember itself never moves',
          away >= 2 * TILE && away <= TETHER + 12 && stayed && !heart.dead,
          { fromHeart: +(away / TILE).toFixed(2), tetherTiles: TETHER / TILE, emberStayed: stayed });
        m.speed = 0;

        // 4d. break it: three seconds stunned, cold, no new heart for twelve
        // (a swung weapon, not a bow: an arrow would need arrows in the pack and the xp would go to Range)
        { const wd = weaponDef(); if (!wd || !wd.weapon || wd.weapon.ranged) { if (countItem('iron_dagger') < 1) h.give('iron_dagger', 1); equipItem(player.inv.findIndex(s => s && s.id === 'iron_dagger')); } }
        const b0 = CINDERWIGHT.stats.broken;
        player.hp = 5000; F.tp(o.x, o.y);
        for (let i = 0; i < 60 && !heart.dead; i++) { heart.x = player.x + 34; heart.y = player.y; player.facing = { x: 1, y: 0 }; player.attackCd = 0; F.press('Space'); }
        const stunned = m.stunT, cold = m.coldT, wait = m.kindleT, cleared = m.heart === null;
        F.sim(1, []);
        check(P + 'breaking the heart stuns the wight for 3 s, leaves it cold for 5 s, and holds the next heart back 12 s',
          heart.dead && CINDERWIGHT.stats.broken === b0 + 1 && stunned >= COLD_STUN - 0.1 && Math.abs(cold - COLD_TIME) < 0.1 && Math.abs(wait - KINDLE_AFTER_BREAK) < 0.1 && cleared && !monsters.includes(heart),
          { broke: heart.dead, stunned: +stunned.toFixed(2), cold: +cold.toFixed(2), wait: +wait.toFixed(2), cleared, stillListed: monsters.includes(heart) });

        // 4e. cold: every hit lands twice, and the second half pays the same 4 xp a point
        { m.coldT = COLD_TIME; m.hp = 400; const c0 = CINDERWIGHT.stats.coldHits, xp0 = player.skills.melee.xp, was = m.hp;
          const ranged = !!(weaponDef() && weaponDef().weapon.ranged);
          hitMonster(m, 10, 0);
          const twice = was - m.hp === 20, paid = ranged ? player.skills.range.xp : player.skills.melee.xp;
          check(P + 'while it is cold every hit lands twice and pays the damage xp twice',
            twice && CINDERWIGHT.stats.coldHits === c0 + 1 && (ranged || paid === xp0 + 80),
            { dealt: was - m.hp, coldHits: CINDERWIGHT.stats.coldHits - c0, meleeXp: player.skills.melee.xp - xp0, ranged });
          m.coldT = 0; m.hp = m.maxHp; }

        // 4f. left alone the ember burns out after ten seconds and the wight can kindle again
        { const o0 = CINDERWIGHT.stats.burnedOut; m.stunT = 0; m.coldT = 0; m.kindleT = 0; m.state = 'chase'; F.tp(o.x, o.y); player.hp = 5000; F.sim(2, []);
          const h2 = m.heart; let out = false, again = false;
          if (h2) { h2.emberT = HEART_LIFE; F.sim(1, []); out = !monsters.includes(h2) && m.heart === null && CINDERWIGHT.stats.burnedOut === o0 + 1; again = Math.abs(m.kindleT - KINDLE_EVERY) < 0.1; }
          check(P + 'an ember nobody breaks burns out after 10 s and the wight goes back on its 14 s clock', !!h2 && out && again,
            { kindled: !!h2, burnedOut: CINDERWIGHT.stats.burnedOut - o0, kindleT: h2 ? +m.kindleT.toFixed(2) : null }); }
      }
      // put everything back
      clearHeart(); h.peace(true);
      m.dead = back.dead; m.hp = back.dead ? 0 : back.hp; m.x = back.home.x; m.y = back.home.y; m.home = back.home; m.speed = D.speed;
      m.state = 'idle'; m.stunT = 0; m.coldT = 0; m.kindleT = KINDLE_EVERY; m.attackCd = 0;
      others.forEach((x, i) => { x.stunT = otherStun[i]; });
      if (cBack) { C.mode = cBack.mode; C.x = cBack.x; C.y = cBack.y; }
      player.hp = Math.min(hp0, player.maxHp); player.hurtT = 0; }

    // 5. the drop table: what it pays, and the odds add up to 100
    { const keep = drops, banner = levelBanner; drops = [];
      const seen = {}; let everyKill = true, rolls = 2000;
      for (let i = 0; i < rolls; i++) {
        const n = drops.length; rollDrops(D, -9999, -9999); const got = drops.slice(n);
        if (!got.some(d => d.id === 'coins') || !got.some(d => d.id === 'grave_dust')) everyKill = false;
        for (const d of got) seen[d.id] = (seen[d.id] || 0) + 1;
      }
      drops = keep; levelBanner = banner;
      const table = D.drops.table, total = table.reduce((s, r) => s + r[3], 0);
      const pcts = table.map(r => r[3] * 100 / total), sum = pcts.reduce((a, b) => a + b, 0);
      const tableIds = table.filter(r => r[0] !== 'nothing').map(r => r[0]);
      const rareIds = D.drops.rare.table.map(r => r[0]);
      const allSeen = tableIds.concat(rareIds).every(id => seen[id] > 0);
      check(P + 'drops: coins and grave dust every kill, one weighted row every kill (odds add to exactly 100%), and 1 kill in 24 pays a fang or mithril',
        everyKill && Math.abs(sum - 100) < 1e-9 && total === 40 && allSeen && seen.coins === rolls && seen.grave_dust === rolls
        && D.drops.rare.chance === 24 && pcts.length === 5,
        { rolls, sum: +sum.toFixed(6), weightTotal: total, pcts: pcts.map(p => +p.toFixed(2)), seen }); }

    // 6. two of them walk the Afterlands, and you can reach one from the crypt steps
    { const inst = window.INSTANCES && typeof INSTANCES.get === 'function' ? INSTANCES.get('afterlands') : null;
      const listed = inst ? inst.spawns.filter(s => s[0] === WIGHT) : [];
      let entered = false, inside = 0, walked = null, left = false, region = null, nearRoute = -1, fromCount = -1, routeLens = null;
      if (inst && !player.mech && !window.__instance) {
        entered = INSTANCES.enter('afterlands', [14, 70]);
        if (entered) {
          region = player.region;
          const there = monsters.filter(m => m.type === WIGHT && !m.dead); inside = there.length;
          // Measured on the live tile grid, not assumed: how close does either wight sit to the two routes the
          // Afterlands is built around? 35-night's own self-test asserts both of them — the crypt steps to Count
          // Ashvane, and the crypt steps to the graveyard at (13,27). A wight sees eight tiles and chases, so a
          // wight parked near either route turns a level-40 quest boss into a level-66 fight for a knight who is
          // only walking past. It also breaks its leash fourteen tiles from home, so it must start further off
          // than that from the count or it can follow you into that fight anyway.
          const ent = inst.entry, boss = inst.spawns.find(s => s[0] === inst.boss) || [null, 46, 18];
          const routes = [F.bfs(ent[0], ent[1], boss[1], boss[2]), F.bfs(ent[0], ent[1], 13, 27)];
          routeLens = routes.map(r => (r ? r.length : 0));
          const homes = there.map(homeT);
          if (homes.length && routes.every(Boolean)) {
            nearRoute = Math.min(...homes.map(p => Math.min(...routes.map(r => Math.min(...r.map(([rx, ry]) => dist(rx, ry, p.x, p.y)))))));
            fromCount = Math.min(...homes.map(p => dist(p.x, p.y, boss[1], boss[2])));
          }
          if (there.length) { const t = homes.slice().sort((a, b) => a.x - b.x || a.y - b.y)[0]; walked = F.walkTo(t.x, t.y, 8000); }
          left = INSTANCES.leave();
        }
      }
      check(P + 'two cinderwights stand in the Afterlands on ground its own build left open, and one is walkable from the crypt steps',
        listed.length === 2 && listed.every(([, x, y]) => !SOLID.has(inst.tiles[y * inst.w + x])) && entered === true && inside === 2
        && typeof walked === 'number' && region === 'The Afterlands' && left === true && window.__instance === null,
        { listed: listed.map(([, x, y]) => [x, y]), entered, inside, walkSteps: walked, region, left, instance: window.__instance });
      check(P + 'neither Afterlands wight sits on a quest route: both are more than 10 tiles off the walk to Count Ashvane and the walk to the graveyard (it sees 8), and more than 14 tiles from the count (its leash), so the count stays a level-40 fight',
        nearRoute > 10 && fromCount > 14 && !!routeLens && routeLens.every(n => n > 10),
        { nearestRouteTiles: +nearRoute.toFixed(1), fromCountTiles: +fromCount.toFixed(1), routeLens }); }

    // 7. the book tells you how the fight goes, on both pages, with the odds it really rolls
    { const w = window.WIKI ? WIKI.get('monsters', WIGHT) : null, hh = window.WIKI ? WIKI.get('monsters', HEART) : null;
      const drop = id => w && w.drops.find(r => r.id === id);
      check(P + 'the wiki page names it, puts it in both places, explains the heart, and lists the drop odds it really rolls',
        !!w && w.name === 'Cinderwight' && w.level === 66 && w.where.includes('The Ashfields') && w.where.includes('The Afterlands')
        && /ember/.test(w.blurb) && /heals 14 hp a second/.test(w.blurb) && Math.abs(w.tablePct - 100) < 0.01
        && !!drop('coins') && drop('coins').pct === 100 && !!drop('obsidian') && Math.abs(drop('obsidian').pct - 25) < 0.01
        && !!drop('vampire_fang') && Math.abs(drop('vampire_fang').pct - 2.5) < 0.01
        && !!hh && hh.name === 'Cinder heart' && hh.drops.length === 0 && hh.where.length === 2 && /breaking it is how you beat the wight/.test(hh.blurb),
        { name: w && w.name, where: w && w.where, tablePct: w && +w.tablePct.toFixed(2), heart: hh && hh.name, heartWhere: hh && hh.where.length }); }

    player.hp = Math.min(hp0, player.maxHp); player.mech = mech0; player.r = r0; player.speed = speed0; player.hurtT = 0; h.peace(false);
  });
}
