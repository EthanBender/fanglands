// ============================================================================
// WHAT THE DEAD LEAVE BEHIND — three grades of grave, and a night that empties the ground
// Owner's design, in his words: "All crosses that have been created during a day should spawn between
// midnight and dawn, so that there are no crosses at dawn." — "If you kill low level mobs like say goblins
// it is a wood cross, and it raises a weak skeleton, and they drop bones, which can be used as a building
// resource and a crafting resource — to make like a bone throne, or bone decorations in your house like a
// bone torch. Then mid-level monsters can be the zombies. And then higher level monsters should have a stone
// gravestone, that when they are summoned they are zombie brutes, which are like a 2x2 tile zombie with a big
// huge weapon, and they do low damage but they have very high health, and if you kill them they have a rare
// chance at dropping necromancy equipment."
//
// So the map remembers your day. Everything two-legged you put down leaves a marker where it fell, and the
// marker is cut to the size of what you killed:
//   level 1–8    a wooden cross      → a skeleton comes up
//   level 9–19   a grave             → a zombie comes up
//   level 20+    a carved headstone  → a ZOMBIE BRUTE comes up
// Those two lines are where the roster actually breaks. Everything two-legged you meet before Thistledown is
// level 8 or under (goblin soldier 2, goblin sapper 7). The goblin war and the town guard sit in the middle
// (goblin brute 9, town guard 12). Nothing two-legged exists between 13 and 19 — the next one up is the castle
// guard and the dwarf guard at 20, then the Gnasher 22, the elf sentinel 25, the sky sentinel 35. So the
// thresholds are drawn at a real cliff in the world rather than at a round number.
//
// The night: one day is 600 game seconds (35-night: 420 light, 60 dusk, then dark). So the dark runs 480 → 600,
// MIDNIGHT is the middle of it at 540 and DAWN is 600. Every grave laid during a day is given its own hour
// between 540 and 594 — spread across the window, never all at once — and when its hour comes something comes
// up out of it. A grave you are not standing near cannot raise anything a player would ever meet, so it is not
// raised: at 594 whatever is left crumbles, and the knight is told at dawn how many got up somewhere he was
// not. Either way there is no cross left standing at dawn, anywhere on the map, which is what the owner asked
// for. (Raising monsters 100 tiles away would either break 35-night's four-at-a-time budget or fill the
// monster list with things nobody will ever walk to.)
//
// Bones are the point of the low tier. A skeleton always drops them, a zombie carries a few, a brute is worth
// a pack of them, and the calm dead of the Afterlands respawn, so there is a renewable supply. Bones BUILD:
//   bone fence   4 bones             a wall that costs no wood
//   bone torch   3 bones + dust      a green flame that never goes out, and real light after dark
//   bone chime   5 bones + silk      it rattles when something risen comes within eight tiles
//   skull post   8 bones             nothing rises within five tiles of it: a camp you can sleep in
//   bone throne  20 bones + 2 dust   sit on it and the dead within twelve tiles kneel for twenty seconds
// Every piece is crafted at a workbench, placed with Q or by tapping it in the pack, and lifted again with E
// (the throne has a button, since E on it sits down) — and the ground it stood on comes back exactly, by NAME,
// so a piece on a house floor lifts back to floor and one on sand lifts back to sand. There is no house file on
// master yet: these use the core's own placeAction, so they go down anywhere the core allows, indoors included.
// Feature file: registers through HOOKS only, edits no core file. window.GRAVES and window.UNDEAD expose it.
// ============================================================================
{
  // ---------- the marker ----------
  // It is NOT a tile. A tile carries one texture, so a grave tile painted grass turned dirt roads and ash
  // fields green underneath the cross. Markers are drawn over whatever ground they stand on, and the list in
  // quest.graves is the only record — so a grave can never repaint the ground or block a path.

  const MAX_MARKERS = 40;        // the map remembers your last forty kills, not every kill you ever made
  const RISE_RADIUS = 14;        // tiles: a grave this close to the knight can put something up
  const RISE_MAX = 3;            // risen at once, so a big graveyard is a long night and not a wall of bodies
  const BRUTE_MAX = 1;           // never two brutes at once: one is a fight, two is a wall

  // the clock, read from 35-night so there is one source for it (with the shipped numbers as the fallback)
  const DAY = () => (window.NIGHT && NIGHT.DAY) || 600;
  const DARK = () => ((window.NIGHT && NIGHT.LIGHT) || 420) + ((window.NIGHT && NIGHT.DUSK) || 60); // 480: dark begins
  const MIDNIGHT = () => (DARK() + DAY()) / 2;   // 540
  const LAST_CALL = () => DAY() - 6;             // 594: after this nothing new comes up; what is left crumbles
  const dayNow = () => player.dayTime || 0;
  const isNight = () => !!window.NIGHT && NIGHT.phase() === 'night';

  // ---------- the three grades ----------
  const GRADES = {
    cross: { name: 'Wooden cross', upTo: 8, rises: 'skeleton', line: 'Two sticks lashed together. Something small will come up out of it tonight.' },
    grave: { name: 'Grave', upTo: 19, rises: 'zombie', line: 'Turned earth and a timber cross. A zombie will come up out of it tonight.' },
    stone: { name: 'Headstone', upTo: Infinity, rises: 'zombie_brute', line: 'Cut stone, for someone who mattered. What comes up out of this one is enormous.' },
  };
  const gradeFor = level => level <= GRADES.cross.upTo ? 'cross' : level <= GRADES.grave.upTo ? 'grave' : 'stone';

  // ---------- who gets a grave ----------
  // You bury the two-legged: goblins, guards, sentinels — the things that carry a weapon. Animals, machines,
  // dragons and the great beasts leave nothing, and neither do the dead: a skeleton you put down does not earn
  // a second cross, or the night would never end.
  const GOBLIN_KIN = ['goblin', 'sapper', 'brute', 'goblin_archer', 'castle_guard', 'gnasher'];
  const UNDEAD_KIN = new Set(['zombie', 'zombie_calm', 'grave_zombie', 'grave_zombie_calm', 'vampire', 'count_ashvane', 'skeleton', 'zombie_brute']);
  const isGoblinKin = type => {
    if (GOBLIN_KIN.includes(type)) return true;
    const d = MONSTER_DEFS[type];
    return !!d && !d.mech && /goblin/i.test(d.name || '');
  };
  const buriable = type => {
    const d = MONSTER_DEFS[type];
    if (!d || d.mech || d.harmless || d.undead || UNDEAD_KIN.has(type)) return false;
    return !!d.human || isGoblinKin(type);
  };

  // ---------- the list ----------
  const marks = () => {
    if (!Array.isArray(quest.graves)) quest.graves = [];
    for (const m of quest.graves) {                       // an old save carries markers with no grade and no hour
      if (!m.g || !GRADES[m.g]) m.g = 'grave';
      if (typeof m.wake !== 'number') m.wake = nextHour();
    }
    return quest.graves;
  };
  const tally = () => quest.graveNight || (quest.graveNight = { rose: 0, lost: 0 });
  HOOKS.newGame.push(() => { quest.graves = []; quest.graveNight = { rose: 0, lost: 0 }; quest.boneGround = {}; quest.graveTold = {}; });

  // every grave gets its own hour between midnight and last call, on the night that follows the moment it was laid
  function nextHour() {
    const d = DAY(), t = dayNow(), k = Math.floor(t / d), into = t - k * d;
    const base = (into < MIDNIGHT() ? k : k + 1) * d;
    return base + MIDNIGHT() + Math.random() * (LAST_CALL() - MIDNIGHT());
  }
  const crumbleAt = m => Math.floor(m.wake / DAY()) * DAY() + LAST_CALL();

  // markers are saved as plain tile coordinates, so nothing depends on a tile id
  let groundSet = null;
  const BURIABLE_GROUND = () => groundSet || (groundSet = new Set([T.GRASS, T.DIRT, T.SAND, T.SCORCH, T.ASH].filter(t => t !== undefined)));
  const canBury = (tx, ty) => BURIABLE_GROUND().has(tileAt(tx, ty));
  const markerAt = (tx, ty) => marks().find(m => m.x === tx && m.y === ty) || null;
  const layMarker = (tx, ty, grade = 'grave') => {
    if (!inMap(tx, ty)) return false;
    if (!canBury(tx, ty)) return false;                              // you cannot bury anyone in a wall or a river
    if (buildingAt(tx, ty)) return false;
    const list = marks();
    if (list.some(m => m.x === tx && m.y === ty)) return false;
    list.push({ x: tx, y: ty, g: GRADES[grade] ? grade : 'grave', wake: nextHour() });
    while (list.length > MAX_MARKERS) list.shift();                   // the oldest is simply forgotten; no ground to put back
    return true;
  };
  const removeMarker = m => { const list = marks(); const i = list.indexOf(m); if (i >= 0) list.splice(i, 1); burst(tc(m.x), tc(m.y), '#6a5a3a', 8, 50); };

  // ---------- something falls, a marker goes up ----------
  const told = () => quest.graveTold || (quest.graveTold = {});
  const layForKill = m => {
    if (!m || !buriable(m.type)) return false;
    if (window.INSTANCES && INSTANCES.active()) return false;         // dungeons keep their own dead
    const grade = gradeFor(MONSTER_DEFS[m.type].level | 0);
    const tx = Math.floor(m.x / TILE), ty = Math.floor(m.y / TILE);
    let laid = layMarker(tx, ty, grade);
    if (!laid) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (layMarker(tx + dx, ty + dy, grade)) { laid = true; break; }
    if (laid && grade === 'stone' && !told().stone) {                 // the first big one you put down
      told().stone = true;
      say('That one gets cut stone. Whatever is under it was somebody. Do not stand here at midnight unless you want to meet it.', 'The Voice');
    }
    return laid;
  };
  HOOKS.kill.push(layForKill);
  // the first skeleton you put back down teaches the whole bone economy in one line
  HOOKS.kill.push(m => {
    if (!m || m.type !== 'skeleton' || told().bones) return;
    told().bones = true;
    say('Bones. Keep them. A workbench turns bones into a fence, a torch that never goes out, a chime that hears the dead coming, a post that keeps the ground shut, and a throne to sit on.', 'The Voice');
  });

  // ---------- the monsters that come up ----------
  MONSTER_DEFS.skeleton = {
    name: 'Skeleton', level: 8, r: 12, hp: 26, att: 9, maxHit: 5, def: 5, speed: 100, aggro: true, sight: 6 * TILE, respawn: 0, undead: true,
    drops: { always: [['bone', 1, 3]], table: [['nothing', 0, 0, 5], ['coins', 4, 10, 6], ['bone', 1, 2, 5], ['rotten_cloth', 1, 1, 3], ['stone_arrow', 3, 6, 2]] },
  };
  // 2×2 tiles across (r 44 against a 48 px tile), 600 health, and the smallest hit of anything dead — a grind,
  // not a danger. Slow enough to walk away from, patient enough to follow you while you do.
  MONSTER_DEFS.zombie_brute = {
    name: 'Zombie brute', level: 26, r: 44, hp: 600, att: 24, maxHit: 6, def: 22, speed: 55, aggro: true, sight: 7 * TILE, respawn: 0, undead: true,
    drops: {
      always: [['bone', 4, 8], ['coins', 40, 80]],
      table: [['grave_dust', 1, 2, 6], ['grave_iron', 1, 3, 6], ['nothing', 0, 0, 3], ['coal', 1, 3, 3], ['steel_bar', 1, 1, 2]],
      rare: { chance: 12, table: [['necro_hood', 1, 1, 5], ['necro_robe', 1, 1, 4], ['soul_lantern', 1, 1, 3], ['bone_staff', 1, 1, 2], ['necro_tome', 1, 1, 1]] },
    },
  };
  for (const k of ['zombie', 'grave_zombie']) if (MONSTER_DEFS[k]) MONSTER_DEFS[k].undead = true;

  const makeRisen = (type, x, y, grade) => {
    const d = MONSTER_DEFS[type];
    return {
      type, x, y, home: { x, y }, r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: d.aggro, state: 'idle', wanderT: Math.random() * 2,
      wander: { x: 0, y: 0 }, attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 0, facing: { x: 1, y: 0 }, walkT: 0, moving: false, stunT: 0,
      night: true, grave: grade, fromGrave: true,
    };
  };
  const risenAlive = () => monsters.filter(m => m.grave && !m.dead).length;
  const brutesAlive = () => monsters.filter(m => m.grave && m.type === 'zombie_brute' && !m.dead).length;

  // ---------- the skull post keeps the ground shut ----------
  const POST_WARD = 5;   // tiles
  const postNear = (tx, ty) => {
    for (let dy = -POST_WARD; dy <= POST_WARD; dy++) for (let dx = -POST_WARD; dx <= POST_WARD; dx++) if (tileAt(tx + dx, ty + dy) === T_POST) return true;
    return false;
  };

  // ---------- the rising ----------
  function tryRise(m) {
    if (window.__instance || window.__peace || player.dead) return false;   // __peace is the self-test's "monsters ignore you"
    const px = Math.floor(player.x / TILE), py = Math.floor(player.y / TILE);
    if (Math.abs(m.x - px) > RISE_RADIUS || Math.abs(m.y - py) > RISE_RADIUS) return false;
    if (dist(tc(m.x), tc(m.y), player.x, player.y) < 3 * TILE) return false;             // never under your own feet
    if (window.NIGHT && NIGHT.inNoGo && NIGHT.inNoGo(m.x, m.y)) return false;            // towns and cities bury their dead properly
    const type = GRADES[m.g].rises, d = MONSTER_DEFS[type];
    if (risenAlive() >= RISE_MAX) return false;
    if (type === 'zombie_brute' && brutesAlive() >= BRUTE_MAX) return false;
    const want = { x: tc(m.x), y: tc(m.y) };
    const spot = collides(want.x, want.y, d.r, 'beast') ? safeSpot(want.x, want.y, d.r, 'beast') : want;
    if (!spot || dist(spot.x, spot.y, want.x, want.y) > 2.5 * TILE) return false;        // no room for it: it waits
    const e = makeRisen(type, spot.x, spot.y, m.g);
    monsters.push(e);
    burst(e.x, e.y + 8, m.g === 'stone' ? '#8d9098' : '#6a5a3a', 18, 80);
    floatText(e.x, e.y - d.r - 16, m.g === 'stone' ? 'The stone splits' : 'The cross falls', '#c9ccd3', 12);
    sfx(m.g === 'stone' ? 'boom' : 'chop');
    removeMarker(m); tally().rose++;
    return true;
  }
  function crumble(m, told) {
    burst(tc(m.x), tc(m.y), '#8a8a7a', 10, 60);
    if (told) floatText(tc(m.x), tc(m.y) - 20, told, '#8b949e', 12);
    removeMarker(m); tally().lost++;
  }

  let phaseWas = 'day';
  HOOKS.update.push(dt => {
    if (window.__instance) return;   // an instance replaces `map`, so tileAt would read a dungeon floor under
    const t = dayNow();              // every overworld marker. The graveyard waits; last call catches up on the
                                     // first tick back on the surface, so dawn still finds nothing standing.

    // dawn: say what the night did with your graveyard, then start a fresh tally
    const ph = window.NIGHT ? NIGHT.phase() : 'day';
    if (phaseWas === 'night' && ph !== 'night') {
      const q = tally();
      if (q.rose || q.lost) {
        const bits = [];
        if (q.rose) bits.push(q.rose === 1 ? 'One came up in the night' : `${q.rose} came up in the night`);
        if (q.lost) bits.push(q.lost === 1 ? 'one got up somewhere you were not' : `${q.lost} got up somewhere you were not`);
        notify('Dawn. ' + bits.join(', ') + '. No cross is left standing.');
      }
      quest.graveNight = { rose: 0, lost: 0 };
    }
    phaseWas = ph;

    const list = marks(); if (!list.length) return;
    for (const m of list.slice()) {
      if (!canBury(m.x, m.y) || buildingAt(m.x, m.y)) { const i = list.indexOf(m); if (i >= 0) list.splice(i, 1); continue; } // built over
      if (t < m.wake) continue;
      if (t >= crumbleAt(m)) { crumble(m, null); continue; }            // last call: dawn takes what is left
      if (!isNight()) continue;
      if (postNear(m.x, m.y)) { crumble(m, 'the post holds it down'); continue; }
      tryRise(m);
    }
  });

  // ---------- the brute's own trick: it lifts the slab over its head and brings it down ----------
  const SLAM_EVERY = 5, SLAM_WIND = 0.8, SLAM_R = 1.6 * TILE, SLAM_PUSH = 42;
  function slam(m) {
    m.wind = 0; m.slamHit = true; m.slamDmg = 0; m.slamPush = 0;
    burst(m.x + m.facing.x * 40, m.y + m.facing.y * 40, '#8d9098', 22, 130);
    burst(m.x + m.facing.x * 40, m.y + m.facing.y * 40, '#5a4530', 12, 90);
    floatText(m.x, m.y - m.r - 20, 'SLAM', '#ff8a1a', 16); sfx('boom');
    if (window.__peace || player.dead) return;
    if (dist(m.x, m.y, player.x, player.y) > SLAM_R + player.r) return;
    const dmg = rint(3, 7); m.slamDmg = dmg;
    hurtPlayer(dmg, m.x, m.y, true);
    const bx = player.x, by = player.y, dx = player.x - m.x, dy = player.y - m.y, d = Math.hypot(dx, dy) || 1;
    moveEntity(player, dx / d * SLAM_PUSH, dy / d * SLAM_PUSH, playerWho());
    m.slamPush = dist(bx, by, player.x, player.y);
  }
  HOOKS.update.push(dt => {
    for (const m of monsters) {
      if (m.type !== 'zombie_brute' || m.dead) continue;
      if (m.wind > 0) { m.wind -= dt; if (m.wind <= 0) slam(m); continue; }
      m.slamT = (m.slamT === undefined ? SLAM_EVERY : m.slamT) - dt;
      if (window.__peace || player.dead || m.stunT > 0 || m.state !== 'chase') continue;
      if (m.slamT > 0) continue;
      if (dist(m.x, m.y, player.x, player.y) > SLAM_R + player.r + 20) continue;
      m.wind = SLAM_WIND; m.slamT = SLAM_EVERY; m.attackT = 0.25;
      floatText(m.x, m.y - m.r - 20, 'lifts the slab', '#c9ccd3', 12);
    }
  });

  // ---------- items: bones, five things to build, five things a necromancer wants ----------
  Object.assign(ITEMS, {
    bone: { name: 'Bones', value: 12, color: '#e8e2d0', shape: 'bone', stack: 50 },
    // building
    bone_fence: { name: 'Bone fence', value: 30, color: '#ded7c2', shape: 'bonefence', place: 'BONE_FENCE' },
    bone_torch: { name: 'Bone torch', value: 60, color: '#dcd6c2', shape: 'bonetorch', place: 'BONE_TORCH' },
    bone_chime: { name: 'Bone chime', value: 80, color: '#d8d2be', shape: 'bonechime', place: 'BONE_CHIME' },
    skull_post: { name: 'Skull post', value: 120, color: '#e4ded0', shape: 'skullpost', place: 'SKULL_POST' },
    bone_throne: { name: 'Bone throne', value: 400, color: '#e0dac6', shape: 'bonethrone', place: 'BONE_THRONE' },
    // the old zombie loot stays: the owner asked for the mace long before the tiers existed
    skull_mace: { name: 'Skull mace', value: 1600, color: '#cfd3d8', shape: 'warhammer', stack: 1, weapon: { str: 26, att: 12, cd: 0.7, perk: 'knockback' } },
    grave_iron: { name: 'Grave iron', value: 45, color: '#7a7f86', shape: 'bar', stack: 50 },
    // necromancy: the brute's rare table. The skill that reads these is the next thing to be built.
    bone_staff: { name: 'Bone staff', value: 1800, color: '#e2dcc8', shape: 'bonestaff', stack: 1, weapon: { str: 18, att: 26, cd: 0.5, perk: 'cleave' } },
    necro_hood: { name: "Necromancer's hood", value: 900, color: '#2a2333', shape: 'helm', stack: 1, armour: { slot: 'helm', def: 10 } },
    necro_robe: { name: "Necromancer's robe", value: 1400, color: '#241d2e', shape: 'body', stack: 1, armour: { slot: 'body', def: 16 } },
    soul_lantern: { name: 'Soul lantern', value: 1100, color: '#9fe8b0', shape: 'lantern', stack: 1, armour: { slot: 'shield', def: 6 } },
    necro_tome: { name: 'Grave-writ', value: 2500, color: '#3a2a22', shape: 'tome', stack: 1 },
  });
  const BONE_BUILD = ['bone_fence', 'bone_torch', 'bone_chime', 'skull_post', 'bone_throne'];
  const NECRO = ['bone_staff', 'necro_hood', 'necro_robe', 'soul_lantern', 'necro_tome'];
  for (const k of ['bone', ...BONE_BUILD, 'skull_mace', 'grave_iron', ...NECRO]) { ITEMS[k].id = k; if (!ITEMS[k].stack) ITEMS[k].stack = (ITEMS[k].weapon || ITEMS[k].armour || k === 'necro_tome') ? 1 : 50; }

  // ---------- tiles for the bone pieces ----------
  const T_FENCE = addTile('BONE_FENCE', { solid: true, tex: 'grass', mini: '#ded7c2' });
  const T_TORCH = addTile('BONE_TORCH', { solid: true, tex: 'grass', mini: '#8ee8a0' });
  const T_CHIME = addTile('BONE_CHIME', { solid: true, tex: 'grass', mini: '#d8d2be' });
  const T_POST = addTile('SKULL_POST', { solid: true, tex: 'grass', mini: '#e4ded0' });
  const T_THRONE = addTile('BONE_THRONE', { solid: true, tex: 'dirt', mini: '#e0dac6' });
  const TILE_ITEM = { [T_FENCE]: 'bone_fence', [T_TORCH]: 'bone_torch', [T_CHIME]: 'bone_chime', [T_POST]: 'skull_post', [T_THRONE]: 'bone_throne' };
  for (const t of [T_FENCE, T_TORCH, T_CHIME, T_POST, T_THRONE]) INTERESTING_TILES.add(t);   // so a tap on the iPad reaches them

  // ---------- recipes ----------
  const BONE_RECIPES = [
    { out: 'bone_fence', qty: 1, needs: [['bone', 4]], station: 'workbench', skill: 'crafting', lv: 2, xp: 20, label: '4 Bones → Bone fence' },
    { out: 'bone_torch', qty: 1, needs: [['bone', 3], ['grave_dust', 1]], station: 'workbench', skill: 'crafting', lv: 4, xp: 45, label: '3 Bones + Grave dust → Bone torch' },
    { out: 'bone_chime', qty: 1, needs: [['bone', 5], ['spider_silk', 1]], station: 'workbench', skill: 'crafting', lv: 6, xp: 60, label: '5 Bones + Spider silk → Bone chime' },
    { out: 'skull_post', qty: 1, needs: [['bone', 8]], station: 'workbench', skill: 'crafting', lv: 8, xp: 90, label: '8 Bones → Skull post' },
    { out: 'bone_throne', qty: 1, needs: [['bone', 20], ['grave_dust', 2]], station: 'workbench', skill: 'crafting', lv: 12, xp: 300, label: '20 Bones + 2 Grave dust → Bone throne' },
  ];
  // 42-playthrough's progression audit reads RECIPES itself, so these declare themselves; no HOOKS.xpSource line
  // is needed and a second one would double-count them in the report.
  for (const r of BONE_RECIPES) RECIPES.push(r);

  // ---------- the bone throne: every recipe that eats bones, and a seat the dead respect ----------
  const boneRecipes = () => RECIPES.filter(r => r.needs.some(([id]) => id === 'bone'));  // a later file that adds one appears here for free
  const KNEEL_R = 12 * TILE, KNEEL_FOR = 20, THRONE_CD = 60;
  const kneel = () => {
    let n = 0;
    for (const m of monsters) {
      if (m.dead || !m.grave || dist(m.x, m.y, player.x, player.y) > KNEEL_R) continue;
      m.kneelT = KNEEL_FOR; m.state = 'return'; m.angry = false; m.wander = { x: 0, y: 0 };
      burst(m.x, m.y - 10, '#9fe8b0', 10, 50); n++;
    }
    player.throneCd = time; closePanel();
    if (n) { say(`You sit. ${n === 1 ? 'The one that was coming for you kneels' : `All ${n} of them kneel`}, and shuffles away. It lasts about twenty seconds.`, 'The Voice'); }
    else notify('You sit on a throne of bones. Nothing dead is close enough to care.');
    return n;
  };
  HOOKS.update.push(dt => {
    for (const m of monsters) {
      if (!m.kneelT || m.dead) continue;
      m.kneelT -= dt;
      if (m.kneelT > 0) { if (m.state === 'chase') m.state = 'return'; m.angry = false; }
      else { m.kneelT = 0; m.angry = !!MONSTER_DEFS[m.type].aggro; }
    }
  });
  // twenty bones is a real build, so it must come back up again: the panel carries the lift, since E on the
  // throne is already the way you sit down at it
  let throneAt = null;
  const liftThrone = () => {
    if (!throneAt || tileAt(throneAt.x, throneAt.y) !== T_THRONE) { closePanel(); return false; }
    const back = tileId(ground()[throneAt.x + ',' + throneAt.y]);
    changeTile(throneAt.x, throneAt.y, back === null || back === undefined ? T.GRASS : back);
    delete ground()[throneAt.x + ',' + throneAt.y];
    giveOrDrop('bone_throne', 1, player.x, player.y);
    burst(tc(throneAt.x), tc(throneAt.y), '#e8e2d0', 14, 70); notify('You take the throne apart and carry it.'); closePanel(); save();
    return true;
  };
  HOOKS.panel.bones = (g, narrow) => {
    const list = boneRecipes();
    const cd = Math.max(0, THRONE_CD - (time - (player.throneCd || -1e9)));
    const { px, py, w } = panelBox(g, 430, 76 + list.length * 40 + 100, 'Bone throne', `Bones in your pack: ${countItem('bone')} · Crafting level ${skillLv('crafting')}`);
    list.forEach((r, i) => {
      const y = py + 70 + i * 40, has = r.needs.every(([id, q]) => countItem(id) >= q), lvOk = !r.skill || skillLv(r.skill) >= r.lv;
      button(g, px + 18, y, w - 36, 34, r.label + (r.lv > 1 ? `  (lv ${r.lv})` : ''), () => craft(r), has && lvOk ? '#238636' : '#2a2f3a', has && lvOk);
    });
    const y0 = py + 70 + list.length * 40 + 8;
    button(g, px + 18, y0, w - 36, 36, cd > 0 ? `Sit again in ${Math.ceil(cd)}s` : 'Sit — the dead kneel', kneel, cd > 0 ? '#2a2f3a' : '#5a2e7a', cd <= 0);
    button(g, px + 18, y0 + 44, w - 36, 32, 'Take the throne back up', liftThrone, '#21262d');
  };

  // ---------- placing and picking back up ----------
  // The ground a bone piece was put on is remembered by NAME, so lifting it puts back sand, ash or dirt rather
  // than the core's flat "it is grass now".
  const ground = () => quest.boneGround || (quest.boneGround = {});
  const _placeAction = placeAction;
  placeAction = function (id) {
    if (!id) {
      const core = ['plank', 'door', 'bed', 'lodestone', 'workbench', 'goblin_trap'].find(k => countItem(k) > 0);
      id = core || BONE_BUILD.find(k => countItem(k) > 0);
      if (!id) return _placeAction();
    }
    if (!BONE_BUILD.includes(id)) return _placeAction(id);
    if (player.dead || player.mech) return;
    const ft = frontTile(player, 40), was = tileAt(ft.tx, ft.ty), had = countItem(id);
    _placeAction(id);
    if (countItem(id) === had - 1 && tileAt(ft.tx, ft.ty) === T[ITEMS[id].place]) {
      ground()[ft.tx + ',' + ft.ty] = tileName(was);   // by NAME: a save must never carry a raw tile id
      burst(tc(ft.tx), tc(ft.ty), '#e8e2d0', 10, 60);   // no xp for putting it down: place-and-lift would be a free loop
    }
  };
  HOOKS.use.push((t, tx, ty) => {
    if (t === T_THRONE) { throneAt = { x: tx, y: ty }; openPanel('bones'); return true; }
    const id = TILE_ITEM[t];
    if (id) {
      const back = tileId(ground()[tx + ',' + ty]);
      changeTile(tx, ty, back === null || back === undefined ? T.GRASS : back);
      delete ground()[tx + ',' + ty];
      giveOrDrop(id, 1, player.x, player.y);
      burst(tc(tx), tc(ty), '#e8e2d0', 8, 60); save();
      return true;
    }
    const m = markerAt(tx, ty);
    if (m) {
      const g0 = GRADES[m.g];
      const left = Math.max(0, m.wake - dayNow());
      notify(`${g0.name}. ${g0.line}${isNight() && left < 30 ? ' The ground is moving.' : ''}`);
      return true;
    }
    return false;
  });

  // ---------- the bone chime hears them coming ----------
  const CHIME_R = 8 * TILE;
  const UND = { rattle: 0, lastRattle: 0, lights: [], sweep: 0 };
  HOOKS.update.push(dt => {
    UND.rattle = Math.max(0, UND.rattle - dt);
    UND.sweep += dt; if (UND.sweep < 0.25) return; UND.sweep = 0;
    if (UND.rattle > 0 || window.__instance || !isNight()) return;
    if (!monsters.some(m => !m.dead && (m.grave || m.night) && dist(m.x, m.y, player.x, player.y) < CHIME_R + 6 * TILE)) return;
    const x0 = Math.floor((player.x - CHIME_R) / TILE), x1 = Math.floor((player.x + CHIME_R) / TILE);
    const y0 = Math.floor((player.y - CHIME_R) / TILE), y1 = Math.floor((player.y + CHIME_R) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (tileAt(tx, ty) !== T_CHIME) continue;
      const near = monsters.find(m => !m.dead && (m.grave || m.night) && dist(m.x, m.y, tc(tx), tc(ty)) < CHIME_R);
      if (!near) continue;
      UND.rattle = 3; UND.lastRattle = time;
      floatText(tc(tx), tc(ty) - 26, 'rattle', '#d8d2be', 12); sfx('ui');
      return;
    }
  });

  // ---------- art ----------
  const femur = (g, x0, y0, x1, y1, w, col) => {
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    const k = w * 0.85, a = Math.atan2(y1 - y0, x1 - x0), nx = Math.cos(a + Math.PI / 2) * k * 0.7, ny = Math.sin(a + Math.PI / 2) * k * 0.7;
    g.fillStyle = col;
    for (const [px, py] of [[x0, y0], [x1, y1]]) { g.beginPath(); g.arc(px + nx, py + ny, k, 0, 7); g.arc(px - nx, py - ny, k, 0, 7); g.fill(); }
  };
  const skull = (g, x, y, r, col, dark) => {
    g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillRect(x - r * 0.5, y, r, r * 0.8);
    g.fillStyle = dark;
    g.beginPath(); g.ellipse(x - r * 0.42, y - r * 0.1, r * 0.26, r * 0.32, 0, 0, 7); g.ellipse(x + r * 0.42, y - r * 0.1, r * 0.26, r * 0.32, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x, y + r * 0.14); g.lineTo(x - r * 0.16, y + r * 0.48); g.lineTo(x + r * 0.16, y + r * 0.48); g.closePath(); g.fill();
    for (let k = -1; k <= 1; k++) g.fillRect(x + k * r * 0.3 - r * 0.05, y + r * 0.6, r * 0.1, r * 0.25);
  };

  // ---------- the markers, drawn ----------
  function drawMound(g, x, y) {
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x, y + 10, 11, 4.5, 0, 0, 7); g.fill();
    g.fillStyle = '#5a4530'; g.beginPath(); g.ellipse(x, y + 8, 10, 4.5, 0, 0, 7); g.fill();
    g.fillStyle = '#6b5238'; g.beginPath(); g.ellipse(x - 1, y + 7, 8, 3.4, 0, 0, 7); g.fill();
    g.fillStyle = '#4a3826';
    for (const [ox, oy, r] of [[-5, 8, 1.8], [4, 9, 1.5], [0, 6, 1.4], [6, 6, 1.2]]) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, 7); g.fill(); }
  }
  function drawWoodCross(g, x, y) {
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(x, y + 9, 7, 3, 0, 0, 7); g.fill();
    g.fillStyle = '#5f4a33'; for (const [ox, oy, r] of [[-3, 8, 1.4], [3, 9, 1.1], [1, 6, 1]]) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, 7); g.fill(); }
    g.save(); g.translate(x, y); g.rotate(0.09);
    g.fillStyle = '#b9a882'; g.fillRect(-1.2, -13, 2.4, 20);      // two sticks, not a plank: this one was cheap
    g.fillRect(-5, -8, 10, 2.2);
    g.fillStyle = '#8a7a5a'; g.fillRect(-1.2, -13, 1, 20);
    g.strokeStyle = '#6a5a3a'; g.lineWidth = 1; g.beginPath(); g.arc(0, -7, 2.6, 0, 7); g.stroke();  // the cord that holds it together
    g.restore();
  }
  function drawTimberCross(g, x, y) {
    drawMound(g, x, y);
    g.fillStyle = '#6b4f2a'; g.fillRect(x - 1.6, y - 12, 3.2, 20);
    g.fillStyle = '#7a5a32'; g.fillRect(x - 6, y - 7, 12, 3);
  }
  function drawHeadstone(g, x, y) {
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(x, y + 10, 13, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#7b7f86'; g.fillRect(x - 12, y + 5, 24, 4);                 // the flagstone it stands on
    g.fillStyle = '#8d9098';                                                    // the slab, round-topped
    g.beginPath(); g.moveTo(x - 9, y + 6); g.lineTo(x - 9, y - 8); g.quadraticCurveTo(x - 9, y - 17, x, y - 17); g.quadraticCurveTo(x + 9, y - 17, x + 9, y - 8); g.lineTo(x + 9, y + 6); g.closePath(); g.fill();
    g.fillStyle = '#a6abb3';
    g.beginPath(); g.moveTo(x - 7, y + 5); g.lineTo(x - 7, y - 8); g.quadraticCurveTo(x - 7, y - 15, x - 1, y - 15); g.lineTo(x - 1, y + 5); g.closePath(); g.fill();
    g.fillStyle = '#5f6268'; g.fillRect(x + 6, y - 12, 3, 18);                  // the shadowed edge
    g.strokeStyle = '#63666c'; g.lineWidth = 1.1;                               // chiselled lines nobody can read now
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x - 5, y - 8 + k * 4); g.lineTo(x + 4, y - 8 + k * 4); g.stroke(); }
    g.fillStyle = '#6e7178'; g.beginPath(); g.moveTo(x + 9, y - 14); g.lineTo(x + 4, y - 16); g.lineTo(x + 9, y - 9); g.closePath(); g.fill(); // a chip off the corner
  }
  HOOKS.draw.push((g, items) => {
    if (window.__instance) return;
    const list = marks(); if (!list.length) return;
    const x0 = cam.x / TILE - 2, x1 = (cam.x + VW) / TILE + 2, y0 = cam.y / TILE - 2, y1 = (cam.y + VH) / TILE + 2;
    for (const m of list) {
      if (m.x < x0 || m.x > x1 || m.y < y0 || m.y > y1) continue;
      const restless = isNight(), soon = restless && dayNow() > m.wake - 10;
      items.push({ y: tc(m.y), draw: () => {
        const shake = soon ? Math.sin(time * 30 + m.x) * 1.5 : 0;
        const x = tc(m.x) + shake, y = tc(m.y);
        if (m.g === 'cross') drawWoodCross(g, x, y); else if (m.g === 'stone') drawHeadstone(g, x, y); else drawTimberCross(g, x, y);
        if (restless) {
          const p = 0.35 + Math.sin(time * 3 + m.x + m.y) * 0.2;
          g.fillStyle = `rgba(126,231,135,${p * (soon ? 0.6 : 0.35)})`;
          g.beginPath(); g.ellipse(tc(m.x), y + 8, m.g === 'stone' ? 12 : 10, 5, 0, 0, 7); g.fill();
        }
      } });
    }
  });

  // ---------- the bone pieces, drawn ----------
  function drawBoneFence(g, tx, ty) {
    const x = tc(tx), y = tc(ty), pale = '#ded7c2';
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(x, y + 15, 20, 5, 0, 0, 7); g.fill();
    for (const ox of [-16, 0, 16]) femur(g, x + ox, y + 14, x + ox, y - 12, 3.4, pale);
    g.strokeStyle = '#c9c2ac'; g.lineWidth = 2.6; g.lineCap = 'round';          // two ribs lashed across
    for (const oy of [-6, 4]) { g.beginPath(); g.moveTo(x - 20, y + oy); g.quadraticCurveTo(x, y + oy - 3, x + 20, y + oy); g.stroke(); }
    g.strokeStyle = '#6a5a3a'; g.lineWidth = 1.2;
    for (const ox of [-16, 0, 16]) for (const oy of [-6, 4]) { g.beginPath(); g.arc(x + ox, y + oy, 3, 0, 7); g.stroke(); }
  }
  function drawBoneTorch(g, tx, ty) {
    const x = tc(tx), y = tc(ty), f = Math.sin(time * 8 + tx) * 2;
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x, y + 15, 9, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#5a4530'; g.beginPath(); g.ellipse(x, y + 13, 8, 3.4, 0, 0, 7); g.fill();
    femur(g, x, y + 13, x, y - 12, 4, '#dcd6c2');
    g.fillStyle = 'rgba(126,231,135,0.9)';                                      // the flame: green, and it never goes out
    g.beginPath(); g.moveTo(x - 5, y - 14); g.quadraticCurveTo(x - 2 + f, y - 24, x, y - 30 - f); g.quadraticCurveTo(x + 2 + f, y - 24, x + 5, y - 14); g.closePath(); g.fill();
    g.fillStyle = 'rgba(220,255,220,0.95)';
    g.beginPath(); g.moveTo(x - 2.2, y - 15); g.quadraticCurveTo(x + f * 0.5, y - 21, x, y - 25); g.quadraticCurveTo(x - f * 0.5, y - 20, x + 2.2, y - 15); g.closePath(); g.fill();
  }
  function drawBoneChime(g, tx, ty) {
    const x = tc(tx), y = tc(ty), hard = UND.rattle > 0;
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(x, y + 15, 14, 4.5, 0, 0, 7); g.fill();
    femur(g, x - 13, y + 14, x - 13, y - 14, 3, '#d8d2be');
    femur(g, x + 13, y + 14, x + 13, y - 14, 3, '#d8d2be');
    g.strokeStyle = '#d8d2be'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 13, y - 13); g.quadraticCurveTo(x, y - 20, x + 13, y - 13); g.stroke();
    for (let k = 0; k < 4; k++) {
      const sw = Math.sin(time * (hard ? 9 : 1.6) + k * 1.3) * (hard ? 4 : 1.2);
      const bx = x - 9 + k * 6;
      g.strokeStyle = '#8a7a5a'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(bx, y - 16); g.lineTo(bx + sw, y - 6); g.stroke();
      femur(g, bx + sw, y - 6, bx + sw * 1.2, y + 2, 2, '#efe9d8');
    }
    if (hard) { g.fillStyle = 'rgba(216,210,190,0.6)'; for (const s of [-1, 1]) { g.beginPath(); g.arc(x + s * 22, y - 12, 2.2, 0, 7); g.fill(); } }
  }
  function drawSkullPost(g, tx, ty) {
    const x = tc(tx), y = tc(ty);
    if (isNight()) {                                                            // at night you can see how far it reaches
      g.strokeStyle = 'rgba(159,232,176,0.16)'; g.lineWidth = 2; g.setLineDash([7, 7]);
      g.beginPath(); g.ellipse(x, y, POST_WARD * TILE, POST_WARD * TILE * 0.62, 0, 0, 7); g.stroke(); g.setLineDash([]);
    }
    g.fillStyle = 'rgba(0,0,0,0.24)'; g.beginPath(); g.ellipse(x, y + 15, 10, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#5a4530'; g.beginPath(); g.ellipse(x, y + 13, 9, 3.6, 0, 0, 7); g.fill();
    g.fillStyle = '#cfc8b4'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x, y + 11 - k * 5, 4.5 - k * 0.2, 2.6, 0, 0, 7); g.fill(); }   // stacked spine
    skull(g, x, y - 18, 8, '#e4ded0', '#2a2620');
    g.fillStyle = 'rgba(159,232,176,0.5)';                                      // a light behind the eyes
    g.beginPath(); g.arc(x - 3.4, y - 19, 1.5, 0, 7); g.arc(x + 3.4, y - 19, 1.5, 0, 7); g.fill();
  }
  function drawBoneThrone(g, tx, ty) {
    const x = tc(tx), y = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 16, 20, 6, 0, 0, 7); g.fill();
    g.strokeStyle = '#d3ccb6'; g.lineWidth = 2.4; g.lineCap = 'round';          // the back: ribs, tallest in the middle
    for (let k = -3; k <= 3; k++) { const h = 26 - Math.abs(k) * 3.5; g.beginPath(); g.moveTo(x + k * 4.5, y - 4); g.quadraticCurveTo(x + k * 5.5, y - 4 - h * 0.7, x + k * 3, y - 4 - h); g.stroke(); }
    g.fillStyle = '#e0dac6'; g.fillRect(x - 15, y - 4, 30, 7);                  // the seat
    g.fillStyle = '#c6bfa8'; g.fillRect(x - 15, y + 2, 30, 3);
    femur(g, x - 15, y + 14, x - 15, y - 3, 3.4, '#dcd6c2');                    // legs
    femur(g, x + 15, y + 14, x + 15, y - 3, 3.4, '#dcd6c2');
    femur(g, x - 17, y - 5, x - 11, y - 14, 3, '#dcd6c2');                      // arms
    femur(g, x + 17, y - 5, x + 11, y - 14, 3, '#dcd6c2');
    skull(g, x - 14, y - 17, 5.5, '#e8e2d0', '#2a2620');                        // one on each shoulder
    skull(g, x + 14, y - 17, 5.5, '#e8e2d0', '#2a2620');
  }
  HOOKS.draw.push((g, items) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE));
    UND.lights = [];
    for (let ty = y0; ty <= y1 + 1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      if (t === T_FENCE) items.push({ y: ty * TILE + TILE - 6, draw: () => drawBoneFence(g, tx, ty) });
      else if (t === T_TORCH) { items.push({ y: ty * TILE + TILE - 6, draw: () => drawBoneTorch(g, tx, ty) }); UND.lights.push({ x: tc(tx), y: tc(ty) - 14, r: 130 }); }
      else if (t === T_CHIME) items.push({ y: ty * TILE + TILE - 6, draw: () => drawBoneChime(g, tx, ty) });
      else if (t === T_POST) items.push({ y: ty * TILE + TILE - 6, draw: () => drawSkullPost(g, tx, ty) });
      else if (t === T_THRONE) items.push({ y: ty * TILE + TILE - 6, draw: () => drawBoneThrone(g, tx, ty) });
    }
    if (player.equip && player.equip.shield === 'soul_lantern') UND.lights.push({ x: player.x, y: player.y, r: 150 });
    // the night overlay from 35-night is drawn at 1e9 - 0.5; these go straight on top of it, so a bone torch
    // and the soul lantern actually push the dark back instead of glowing behind it
    if (UND.lights.length) items.push({ y: 1e9 - 0.45, draw: () => {
      const a = window.NIGHT && NIGHT.overlay ? NIGHT.overlay() : 0; if (a <= 0.002) return;
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const L of UND.lights) {
        const sx = L.x - cam.x, sy = L.y - cam.y; if (sx < -L.r || sy < -L.r || sx > VW + L.r || sy > VH + L.r) continue;
        const gr = g.createRadialGradient(sx, sy, 6, sx, sy, L.r);
        gr.addColorStop(0, `rgba(150,255,180,${0.5 * a})`); gr.addColorStop(0.5, `rgba(110,220,150,${0.22 * a})`); gr.addColorStop(1, 'rgba(110,220,150,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, L.r, 0, 7); g.fill();
      }
      g.restore();
    } });
  });

  // ---------- sprites ----------
  function drawSkeleton(g, e, hurt) {
    const fx = e.facing.x, fy = e.facing.y, ang = Math.atan2(fy, fx);
    const bone = hurt ? '#ffd6d6' : '#e8e2d0', dark = '#2a2620';
    g.save(); g.rotate(ang + (e.attackT > 0 ? -0.6 + (1 - e.attackT / 0.22) * 1.4 : 0.75));   // a rusted blade, still swinging
    g.fillStyle = '#8a7a5a'; g.fillRect(4, -1.4, 17, 2.8); g.fillStyle = '#5a4a3a'; g.fillRect(1, -2.6, 4, 5.2); g.restore();
    const sw = e.moving ? Math.sin(e.walkT) * 2.2 : 0;
    femur(g, -5, 6, -5 - sw * 0.4, 13 + sw, 2.6, bone);                                        // legs
    femur(g, 5, 6, 5 + sw * 0.4, 13 - sw, 2.6, bone);
    g.fillStyle = bone; g.fillRect(-4.5, 2, 9, 4);                                             // pelvis
    g.strokeStyle = bone; g.lineWidth = 1.1;                                                   // spine + ribs
    g.beginPath(); g.moveTo(0, -4); g.lineTo(0, 3); g.stroke();
    g.strokeStyle = hurt ? '#ffd6d6' : '#dbd4c0'; g.lineWidth = 2;
    for (let k = 0; k < 4; k++) { const y = -4 + k * 2.4; g.beginPath(); g.moveTo(-6 + k * 0.4, y); g.quadraticCurveTo(0, y + 2.2, 6 - k * 0.4, y); g.stroke(); }
    femur(g, -7, -4, -11 + fx * 3, 3, 2.2, bone);                                              // arms
    femur(g, 7, -4, 11 + fx * 3, 3, 2.2, bone);
    skull(g, 0, -10, 7, bone, dark);
    g.fillStyle = '#7ee787'; g.beginPath(); g.arc(-3 + fx * 2, -10 + fy * 2, 1.3, 0, 7); g.arc(3 + fx * 2, -10 + fy * 2, 1.3, 0, 7); g.fill();
  }
  // Two tiles across. Everything about it is heavy: a stooped back, arms to the ground, and its own headstone
  // lashed to a beam. When it winds up, the slab goes over its head and a ring opens on the ground.
  function drawZombieBrute(g, e, hurt) {
    const fx = e.facing.x, fy = e.facing.y, ang = Math.atan2(fy, fx);
    const skin = hurt ? '#ffc7b0' : '#5f7a4a', deep = hurt ? '#e8a898' : '#48603a';
    const wind = e.wind > 0 ? 1 - e.wind / SLAM_WIND : 0, swingT = e.attackT > 0 ? 1 - e.attackT / 0.25 : 1;
    const sway = e.moving ? Math.sin(e.walkT * 0.6) * 3 : 0;
    if (e.wind > 0) {                                                                          // the ring it is about to flatten
      g.strokeStyle = `rgba(255,138,26,${0.25 + wind * 0.5})`; g.lineWidth = 3;
      g.beginPath(); g.ellipse(fx * 40, fy * 40, SLAM_R * 0.9, SLAM_R * 0.55, 0, 0, 7); g.stroke();
    }
    g.save(); g.rotate(ang);
    // the slab on its beam: overhead while it winds up, out in front the rest of the time
    const lift = e.wind > 0 ? -30 - wind * 8 : (e.attackT > 0 ? -18 + swingT * 20 : 6);
    g.save(); g.translate(20, lift * 0.35); g.rotate(e.wind > 0 ? -1.15 : (e.attackT > 0 ? -0.5 + swingT : 0.25));
    g.fillStyle = '#6b4f2a'; g.fillRect(-6, -3.5, 40, 7);                                       // the beam
    g.fillStyle = '#8d9098'; g.fillRect(30, -20, 22, 40);                                       // the headstone it dragged out with it
    g.fillStyle = '#6e7178'; g.fillRect(46, -20, 6, 40);
    g.strokeStyle = '#63666c'; g.lineWidth = 1.4; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(34, -12 + k * 10); g.lineTo(46, -12 + k * 10); g.stroke(); }
    g.restore();
    g.restore();
    g.save(); g.translate(0, sway * 0.3);
    g.fillStyle = deep; g.beginPath(); g.ellipse(0, 20, 26, 11, 0, 0, 7); g.fill();             // legs, planted
    g.fillStyle = skin; g.beginPath(); g.ellipse(-13, 22, 10, 9, 0, 0, 7); g.ellipse(13, 22, 10, 9, 0, 0, 7); g.fill();
    g.fillStyle = deep; g.beginPath(); g.ellipse(0, 0, 30, 26, 0, 0, 7); g.fill();              // the body: a barrel of a chest
    g.fillStyle = skin; g.beginPath(); g.ellipse(-2, -3, 26, 21, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(20,26,16,0.45)';                                                        // the torn hem and the hole in its side
    g.beginPath(); g.moveTo(-24, 12); g.lineTo(-14, 4); g.lineTo(-6, 15); g.lineTo(4, 4); g.lineTo(12, 16); g.lineTo(24, 6); g.lineTo(22, 22); g.lineTo(-22, 22); g.closePath(); g.fill();
    g.fillStyle = '#3a2a24'; g.beginPath(); g.ellipse(12, -4, 6, 8, 0.3, 0, 7); g.fill();
    g.fillStyle = '#e8e2d0'; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(11, -8 + k * 5, 5.5, 1.6, 0.2, 0, 7); g.fill(); }   // ribs through it
    g.fillStyle = skin; g.beginPath(); g.arc(-26, -6, 11, 0, 7); g.arc(26, -6, 11, 0, 7); g.fill();  // shoulders
    g.save(); g.rotate(ang); g.fillStyle = skin;                                                // the free arm, hanging to the ground
    g.save(); g.rotate(0.5 - sway * 0.03); g.fillRect(6, 10, 34, 9); g.beginPath(); g.arc(40, 14.5, 6, 0, 7); g.fill(); g.restore();
    g.restore();
    g.fillStyle = skin; g.beginPath(); g.arc(fx * 4, -26 + fy * 3, 15, 0, 7); g.fill();          // the head, sunk into the shoulders
    g.fillStyle = deep; g.beginPath(); g.arc(fx * 4, -29 + fy * 3, 15, Math.PI, 0); g.fill();
    g.fillStyle = '#141a10'; g.beginPath(); g.arc(fx * 4 - 6, -25 + fy * 4, 3.4, 0, 7); g.arc(fx * 4 + 6, -25 + fy * 4, 3.4, 0, 7); g.fill();
    g.fillStyle = '#e8e26b'; g.beginPath(); g.arc(fx * 4 - 6, -25 + fy * 4, 1.4, 0, 7); g.arc(fx * 4 + 6, -25 + fy * 4, 1.4, 0, 7); g.fill();
    g.fillStyle = '#e8e2d0'; g.fillRect(fx * 4 - 7, -18 + fy * 3, 14, 3.4);                      // teeth
    g.fillStyle = '#141a10'; for (let k = 0; k < 4; k++) g.fillRect(fx * 4 - 6 + k * 3.6, -18 + fy * 3, 1.2, 3.4);
    g.restore();
  }
  HOOKS.drawMonster.skeleton = (g, e, hurt) => drawSkeleton(g, e, hurt);
  HOOKS.drawMonster.zombie_brute = (g, e, hurt) => drawZombieBrute(g, e, hurt);

  // ---------- item icons ----------
  // drawItemIcon is a core function; wrapping it by reassignment is how a feature adds a shape (docs/EXTENDING.md).
  const ICONS = {
    bone: (g, d) => { femur(g, -7, 6, 7, -6, 3.2, d.color); },
    bonefence: (g, d) => { for (const ox of [-6, 0, 6]) femur(g, ox, 8, ox, -7, 2.2, d.color); g.strokeStyle = '#c9c2ac'; g.lineWidth = 1.6; for (const oy of [-3, 3]) { g.beginPath(); g.moveTo(-8, oy); g.lineTo(8, oy); g.stroke(); } },
    bonetorch: (g, d) => { femur(g, 0, 9, 0, -3, 3, d.color); g.fillStyle = '#7ee787'; g.beginPath(); g.moveTo(-4, -4); g.quadraticCurveTo(0, -12, 0, -9); g.quadraticCurveTo(2, -13, 4, -4); g.closePath(); g.fill(); },
    bonechime: (g, d) => { g.strokeStyle = d.color; g.lineWidth = 2; g.beginPath(); g.moveTo(-8, -6); g.quadraticCurveTo(0, -11, 8, -6); g.stroke(); for (let k = -1; k <= 1; k++) femur(g, k * 5, -4, k * 5, 6, 1.8, '#efe9d8'); },
    skullpost: (g, d) => { g.fillStyle = '#cfc8b4'; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(0, 8 - k * 4, 3.4, 2, 0, 0, 7); g.fill(); } skull(g, 0, -4, 6, d.color, '#2a2620'); },
    bonethrone: (g, d) => { g.strokeStyle = d.color; g.lineWidth = 1.8; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * 3, -1); g.lineTo(k * 3.4, -3 - (7 - Math.abs(k) * 2)); g.stroke(); } g.fillStyle = d.color; g.fillRect(-8, -1, 16, 4); g.fillRect(-8, 3, 2.6, 6); g.fillRect(5.4, 3, 2.6, 6); skull(g, 0, 6, 3.2, '#e8e2d0', '#2a2620'); },
    bonestaff: (g, d) => { g.save(); g.rotate(-0.7); femur(g, -9, 0, 6, 0, 2.6, d.color); skull(g, 9, 0, 4.2, '#efe9d8', '#2a2620'); g.restore(); },
    lantern: (g, d) => { g.fillStyle = '#5a5d64'; g.fillRect(-6, -7, 12, 2); g.fillRect(-6, 7, 12, 2); g.strokeStyle = '#5a5d64'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-5, -5); g.lineTo(-5, 7); g.moveTo(5, -5); g.lineTo(5, 7); g.stroke(); g.fillStyle = d.color; g.beginPath(); g.arc(0, 1, 4.4, 0, 7); g.fill(); g.strokeStyle = '#5a5d64'; g.beginPath(); g.arc(0, -8, 3, Math.PI, 0); g.stroke(); },
    tome: (g, d) => { g.fillStyle = d.color; g.fillRect(-8, -8, 16, 16); g.stroke(); g.fillStyle = '#2a1e18'; g.fillRect(-8, -8, 3, 16); g.fillStyle = '#d9d2c4'; g.fillRect(-4, -6, 11, 12); skull(g, 1.5, -0.5, 3.4, '#8d9098', '#2a2620'); },
  };
  const _drawItemIcon = drawItemIcon;
  drawItemIcon = function (g, id, x, y, size = 18) {
    const def = ITEMS[id], art = def && ICONS[def.shape];
    if (!art) return _drawItemIcon(g, id, x, y, size);
    const s = size / 18;
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = def.color; g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2;
    art(g, def);
    g.restore();
  };

  // ---------- what the dead are worth ----------
  // A zombie was coins and a scrap of cloth. Now it is worth the walk: bones, iron off the dead, grave dust,
  // and one in a hundred and fifty carries the mace. The grave zombie is the better bet, as it should be.
  const zombieDrops = {
    always: [['coins', 8, 20]],
    table: [['nothing', 0, 0, 3], ['rotten_cloth', 1, 2, 6], ['bone', 1, 2, 5], ['grave_iron', 1, 1, 4], ['grave_dust', 1, 1, 3], ['coal', 1, 2, 2], ['bread', 1, 1, 2]],
    rare: { chance: 150, table: [['skull_mace', 1, 1, 1]] },
  };
  for (const key of ['zombie', 'zombie_calm']) if (MONSTER_DEFS[key]) MONSTER_DEFS[key].drops = { ...zombieDrops, table: zombieDrops.table.slice() };
  for (const key of ['grave_zombie', 'grave_zombie_calm']) if (MONSTER_DEFS[key]) {
    MONSTER_DEFS[key].drops = {
      always: [['coins', 20, 40], ['grave_dust', 1, 1], ['bone', 1, 3]],
      table: [['nothing', 0, 0, 2], ['grave_iron', 1, 3, 6], ['rotten_cloth', 1, 2, 4], ['steel_bar', 1, 1, 2]].filter(r => r[0] === 'nothing' || ITEMS[r[0]]),
      rare: { chance: 40, table: [['skull_mace', 1, 1, 2], ['vampire_fang', 1, 1, 3]].filter(r => ITEMS[r[0]]) },
    };
  }
  // one raised out of a grave you dug yourself carries a little more
  HOOKS.kill.push(m => {
    if (!m || !m.fromGrave) return;
    giveOrDrop('grave_iron', rint(1, 2), m.x, m.y);
    floatText(m.x, m.y - 34, 'Off the grave', '#8b949e', 12);
  });

  // ---------- the grave-writ tells you the rules ----------
  const _useItem = useItem;
  useItem = function (slot) {
    const s = player.inv[slot];
    if (s && s.id === 'necro_tome') {
      say('Written on skin, in a hand that shook. "The small dead take a cross of sticks, and stand up as bones. The middling take turned earth, and stand up green. The great take cut stone, and what stands up out of stone you do not fight in the open." Someone will know what to do with this.', 'Grave-writ');
      return;
    }
    return _useItem(slot);
  };

  // ---------- the book ----------
  if (window.WIKI) {
    WIKI.add('monsters', { id: 'skeleton', where: ['Out of a wooden cross, between midnight and dawn (level 1–8 kills)'] });
    WIKI.add('monsters', { id: 'zombie_brute', where: ['Out of a headstone, between midnight and dawn (level 20+ kills)'] });
    // the book builds the Bones page itself from the drop tables and the recipes, which is more than a hand-written one
  }

  // ---------- test / debug handles ----------
  window.GRAVES = {
    markerAt, MAX_MARKERS, RISE_RADIUS, RISE_MAX, BRUTE_MAX, marks, layMarker, removeMarker, layForKill, tryRise, isGoblinKin, buriable,
    GRADES, gradeFor, zombieDrops, nextHour, crumbleAt, postNear, tally,
    MIDNIGHT: () => MIDNIGHT(), LAST_CALL: () => LAST_CALL(), DAY: () => DAY(),
  };
  // How a crafting mini-game consumes bones: read countItem('bone'), take them with removeItem('bone', n), pay
  // out with addItem/giveOrDrop and gainXp('crafting', xp). To put a new bone recipe in front of the player,
  // push it onto RECIPES with needs [['bone', n]] — any station — and it appears in the bone throne's panel and
  // in the wiki with no change to this file. UNDEAD.BONE_CRAFT is the whole contract.
  window.UNDEAD = {
    BONE: 'bone', BONE_BUILD, NECRO, RECIPES: BONE_RECIPES, tiles: { fence: T_FENCE, torch: T_TORCH, chime: T_CHIME, post: T_POST, throne: T_THRONE },
    BONE_CRAFT: { item: 'bone', station: 'workbench', throne: T_THRONE, panel: 'bones', list: boneRecipes, held: () => countItem('bone'), spend: n => removeItem('bone', n) },
    POST_WARD, CHIME_R, KNEEL_FOR, THRONE_CD, SLAM_EVERY, SLAM_R, kneel, lights: () => UND.lights, rattling: () => UND.rattle > 0, lastRattle: () => UND.lastRattle,
    risenAlive, brutesAlive, ground,
  };

  // ---------- self-test ----------
  const P = 'graves: ';
  HOOKS.selfTest.push((check, F, h) => {
    const g0 = Array.isArray(quest.graves) ? quest.graves.slice() : [];
    const day0 = player.dayTime, hp0 = player.hp, tally0 = { ...tally() };
    const fake = (type, tx, ty) => ({ type, dead: true, x: tc(tx), y: tc(ty), r: MONSTER_DEFS[type] ? MONSTER_DEFS[type].r : 12 });
    if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave();
    const craft0 = player.skills.crafting.xp;
    quest.graves = []; h.peace(true);

    // ---- the three grades, cut to the size of what fell ----
    { const o = h.openSpot(58, 30); F.tp(o.x, o.y);
      const bx = Math.floor(player.x / TILE) + 6, by = Math.floor(player.y / TILE);
      const at = (dx, dy) => ({ x: bx + dx, y: by + dy });
      const was = [];
      const lines = () => [dialog.cur, ...dialog.queue].filter(Boolean).map(d => d.text);
      const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
      quest.graveTold = {}; drain();
      const lay = (type, dx, dy) => { const p = at(dx, dy); was.push([p.x, p.y, tileAt(p.x, p.y)]); changeTile(p.x, p.y, T.GRASS); GRAVES.layForKill(fake(type, p.x, p.y)); return GRAVES.markerAt(p.x, p.y); };
      const gob = lay('goblin', 0, 0), sap = lay('sapper', 2, 0), br = lay('brute', 4, 0), gd = lay('guard_m', 0, 2), cg = lay('castle_guard', 2, 2), el = lay('elf_sentinel', 4, 2);
      // and the things that leave nothing: animals, machines, and the dead themselves (or the night never ends)
      const none = ['sheep', 'wolf', 'walker', 'zombie', 'skeleton', 'zombie_brute'].map((t, i) => { const p = at(i, 4); was.push([p.x, p.y, tileAt(p.x, p.y)]); changeTile(p.x, p.y, T.GRASS); GRAVES.layForKill(fake(t, p.x, p.y)); return !GRAVES.markerAt(p.x, p.y); });
      const groundKept = tileAt(bx, by) === T.GRASS, walkable = !solidFor(tileAt(bx, by), 'player') && !collides(tc(bx), tc(by), 13, 'player');
      const registered = HOOKS.kill.includes(GRAVES.layForKill);
      // the game teaches itself: one line the first time you cut stone for something, one the first time bones drop
      const warned = lines().some(t => /cut stone/.test(t));
      drain(); for (const hk of HOOKS.kill) hk(fake('skeleton', bx, by + 6));
      const taught = lines().some(t => /turns bones into a fence/.test(t));
      drain(); quest.graveTold = {};
      check(P + 'the grade of the grave is cut to the level of what fell: 1–8 a wooden cross, 9–19 a grave, 20+ a headstone; animals, machines and the dead leave nothing',
        !!gob && gob.g === 'cross' && !!sap && sap.g === 'cross' && !!br && br.g === 'grave' && !!gd && gd.g === 'grave' && !!cg && cg.g === 'stone' && !!el && el.g === 'stone'
        && none.every(Boolean) && GRAVES.gradeFor(8) === 'cross' && GRAVES.gradeFor(9) === 'grave' && GRAVES.gradeFor(19) === 'grave' && GRAVES.gradeFor(20) === 'stone'
        && groundKept && walkable && registered && warned && taught,
        { goblin: gob && gob.g, sapper: sap && sap.g, brute: br && br.g, guard: gd && gd.g, castleGuard: cg && cg.g, elf: el && el.g, none, groundKept, walkable, registered, firstHeadstoneWarns: warned, firstBonesTeach: taught });
      for (const [x, y, t] of was) changeTile(x, y, t);
      quest.graves = []; }

    // ---- each grade puts up its own creature, at its own hour ----
    { const o = h.openSpot(40, 20); const raised = {};
      for (const [grade, type] of [['cross', 'skeleton'], ['grave', 'zombie'], ['stone', 'zombie_brute']]) {
        quest.graves = []; for (const m of monsters.filter(m => m.grave)) monsters.splice(monsters.indexOf(m), 1);
        F.tp(o.x, o.y); const tx = o.x + 5, ty = o.y; const was = tileAt(tx, ty); changeTile(tx, ty, T.GRASS);
        player.dayTime = GRAVES.MIDNIGHT() + 5; GRAVES.layMarker(tx, ty, grade);
        const mk = GRAVES.markerAt(tx, ty); if (mk) mk.wake = player.dayTime - 1;      // its hour is now
        h.peace(false); player.hp = 100000; F.sim(3, []); h.peace(true);
        const up = monsters.find(m => m.grave === grade && !m.dead);
        raised[grade] = up ? up.type : null;
        if (up) { up.stunT = 999; up.hp = 0; up.dead = true; monsters.splice(monsters.indexOf(up), 1); }
        changeTile(tx, ty, was);
      }
      quest.graves = []; player.dayTime = day0; player.hp = Math.min(hp0, player.maxHp);
      check(P + 'a wooden cross puts up a skeleton, a grave puts up a zombie, a headstone puts up a zombie brute',
        raised.cross === 'skeleton' && raised.grave === 'zombie' && raised.stone === 'zombie_brute'
        && GRAVES.GRADES.cross.rises === 'skeleton' && GRAVES.GRADES.grave.rises === 'zombie' && GRAVES.GRADES.stone.rises === 'zombie_brute',
        raised); }

    // ---- the brute: two tiles across, six hundred health, the smallest hit of anything dead, and the slam ----
    { const d = MONSTER_DEFS.zombie_brute, z = MONSTER_DEFS.zombie, gz = MONSTER_DEFS.grave_zombie;
      const twoTiles = d.r >= TILE * 0.85 && d.r <= TILE, big = d.hp === 600 && d.hp > gz.hp * 6, weak = d.maxHit === 6 && d.maxHit < z.maxHit && d.maxHit < gz.maxHit, slow = d.speed < z.speed;
      const o = h.openSpot(44, 26); F.tp(o.x, o.y);
      player.dayTime = GRAVES.MIDNIGHT();                                   // it is a creature of the night: in daylight 35-night crumbles it
      const b = makeRisen('zombie_brute', player.x + 60, player.y, 'stone'); b.state = 'chase'; b.facing = { x: -1, y: 0 }; b.slamT = 0.01;
      monsters.push(b); h.peace(false); player.hp = 100000; const ph0 = player.hp;
      let wound = false; for (let i = 0; i < 130 && !b.slamHit; i++) { b.x = player.x + 60; b.y = player.y; b.stunT = 0; b.state = 'chase'; if (b.wind > 0) wound = true; F.step([]); }
      const took = ph0 - player.hp, reset = b.slamT > SLAM_EVERY - 1;
      { const i = monsters.indexOf(b); if (i >= 0) monsters.splice(i, 1); }
      h.peace(true); player.hp = Math.min(hp0, player.maxHp); player.dayTime = day0;
      check(P + 'the zombie brute is two tiles across with 600 health and the smallest hit of any of the dead, and every five seconds it lifts its headstone and slams the ground (low damage, big shove)',
        twoTiles && big && weak && slow && b.slamHit === true && wound && b.slamDmg >= 3 && b.slamDmg <= 7 && b.slamPush > 20 && took >= b.slamDmg && reset,
        { r: d.r, hp: d.hp, maxHit: d.maxHit, speed: d.speed, slammed: !!b.slamHit, woundUp: wound, slamDamage: b.slamDmg, shovedPx: Math.round(b.slamPush || 0), tookInAll: took, slamT: +(b.slamT || 0).toFixed(1) }); }

    // ---- the night empties the ground, and dawn finds nothing standing ----
    { quest.graves = []; quest.graveNight = { rose: 0, lost: 0 };
      for (const m of monsters.filter(m => m.grave || m.night)) monsters.splice(monsters.indexOf(m), 1);
      const o = h.openSpot(40, 20); F.tp(o.x, o.y); player.hp = 100000;
      player.dayTime = 0;                                                              // a fresh day: the hours below are this day's
      const near = [], far = [], was = [];
      for (let i = 0; i < 4; i++) { const x = o.x + 4 + i, y = o.y + 2; was.push([x, y, tileAt(x, y)]); changeTile(x, y, T.GRASS); if (GRAVES.layMarker(x, y, i === 3 ? 'stone' : 'cross')) near.push([x, y]); }
      const o2 = h.openSpot(74, 44);                                                  // far enough that the knight is never near them
      for (let i = 0; i < 6; i++) { const x = o2.x + i - 2, y = o2.y; was.push([x, y, tileAt(x, y)]); changeTile(x, y, T.GRASS); if (GRAVES.layMarker(x, y, 'grave')) far.push([x, y]); }
      const farAway = Math.abs(o2.x - o.x) > GRAVES.RISE_RADIUS || Math.abs(o2.y - o.y) > GRAVES.RISE_RADIUS;
      const laid = GRAVES.marks().length;
      // every hour falls between midnight and last call, and they are spread across the window rather than together
      const hours = GRAVES.marks().map(m => m.wake % GRAVES.DAY());
      const inWindow = hours.every(w => w >= GRAVES.MIDNIGHT() && w <= GRAVES.LAST_CALL());
      const spread = Math.max(...hours) - Math.min(...hours);
      player.dayTime = GRAVES.MIDNIGHT() - 20; h.peace(false); F.sim(6, []);           // dark, but not midnight yet
      const beforeMidnight = GRAVES.marks().length === laid && !monsters.some(m => m.grave);
      let rose = 0;
      for (let t = GRAVES.MIDNIGHT(); t <= GRAVES.DAY() - 2; t += 2) {                 // walk the clock through the window, up to a breath before dawn
        player.dayTime = t; F.sim(3, []);
        for (const m of monsters) if (m.grave && !m.dead) { m.stunT = 999; m.hp = m.maxHp; }
        rose = Math.max(rose, monsters.filter(m => m.grave).length);
      }
      // a breath before dawn every one of them is accounted for: it came up, or the ground closed over it
      const accounted = tally().rose + tally().lost, beforeDawn = GRAVES.marks().length;
      player.dayTime = GRAVES.DAY() + 1; F.sim(4, []);                                 // over the line into daylight
      const left = GRAVES.marks().length, anyCross = quest.graves.length, stillUp = monsters.filter(m => m.grave && !m.dead).length;
      h.peace(true); player.hp = Math.min(hp0, player.maxHp);
      for (const [x, y, t] of was) changeTile(x, y, t);
      for (const m of monsters.filter(m => m.grave || m.night)) monsters.splice(monsters.indexOf(m), 1);
      check(P + 'every grave laid in a day is given its own hour between midnight (540 s) and dawn (600 s), nothing comes up before midnight, and dawn finds no cross standing anywhere — near the knight or forty tiles away',
        laid === 10 && near.length === 4 && far.length === 6 && farAway && inWindow && spread > 15 && beforeMidnight && rose >= 1 && beforeDawn === 0 && left === 0 && anyCross === 0 && stillUp === 0 && accounted === laid,
        { laid, near: near.length, far: far.length, farAway, inWindow, spread: +spread.toFixed(1), beforeMidnight, roseAtOnce: rose, standingABreathBeforeDawn: beforeDawn, standingAfterDawn: left, stillUp, accountedFor: accounted, midnight: GRAVES.MIDNIGHT(), lastCall: GRAVES.LAST_CALL() });
      quest.graves = []; quest.graveNight = { ...tally0 }; player.dayTime = day0; }

    // ---- a skull post keeps the ground shut ----
    { quest.graves = []; const o = h.openSpot(56, 34); F.tp(o.x, o.y);
      const px = o.x + 4, py = o.y, gx = o.x + 6, gy = o.y;
      const w1 = tileAt(px, py), w2 = tileAt(gx, gy); changeTile(px, py, T.GRASS); changeTile(gx, gy, T.GRASS);
      GRAVES.layMarker(gx, gy, 'cross'); const mk = GRAVES.markerAt(gx, gy); mk.wake = 0;
      changeTile(px, py, UNDEAD.tiles.post);
      const warded = GRAVES.postNear(gx, gy);
      player.dayTime = GRAVES.MIDNIGHT() + 5; h.peace(false); F.sim(4, []); h.peace(true);
      const shut = !GRAVES.markerAt(gx, gy) && !monsters.some(m => m.grave && !m.dead);
      changeTile(px, py, w1); changeTile(gx, gy, w2); quest.graves = []; player.dayTime = day0;
      check(P + 'nothing rises within five tiles of a skull post: the grave settles instead',
        warded && shut && UNDEAD.POST_WARD === 5, { warded, shut, ward: UNDEAD.POST_WARD }); }

    // ---- bones: they drop, they build, they place, and they come back up ----
    { const bag = player.inv.slice(); player.inv = player.inv.map(() => null);
      let boned = 0; const d0 = drops.length;
      for (let i = 0; i < 30; i++) { const b = drops.length; rollDrops(MONSTER_DEFS.skeleton, -9999, -9999); if (drops.slice(b).some(x => x.id === 'bone')) boned++; }
      drops = drops.filter(x => x.x > -5000);
      addItem('bone', 20); addItem('grave_dust', 2); player.skills.crafting.xp = Math.max(player.skills.crafting.xp, XP_TABLE[12]);
      const rec = UNDEAD.RECIPES.find(r => r.out === 'bone_fence');
      const made = craft(rec) !== false && countItem('bone_fence') === 1 && countItem('bone') === 16;
      const o = h.openSpot(36, 22); F.tp(o.x, o.y); player.facing = { x: 1, y: 0 };
      const ft = frontTile(player, 40); const was = tileAt(ft.tx, ft.ty); changeTile(ft.tx, ft.ty, T.SAND);   // sand, so the ground must come back as sand
      drops = drops.filter(x => !circleHitsTile(x.x, x.y, 8, ft.tx, ft.ty));
      placeAction('bone_fence');
      const placed = tileAt(ft.tx, ft.ty) === UNDEAD.tiles.fence, solid = collides(tc(ft.tx), tc(ft.ty), 13, 'person'), remembered = UNDEAD.ground()[ft.tx + ',' + ft.ty] === 'SAND';
      F.face(ft.tx, ft.ty); F.press('KeyE'); F.sim(2, []);
      const back = countItem('bone_fence') === 1 && tileAt(ft.tx, ft.ty) === T.SAND;
      // and again from the pack, the way a thumb does it on the iPad: tap the piece, it goes down in front of you
      player.facing = { x: 1, y: 0 }; useItem(player.inv.findIndex(x => x && x.id === 'bone_fence')); F.sim(1, []);
      const tapped = tileAt(ft.tx, ft.ty) === UNDEAD.tiles.fence && countItem('bone_fence') === 0;
      F.face(ft.tx, ft.ty); F.press('KeyE'); F.sim(2, []);
      changeTile(ft.tx, ft.ty, was);
      const listed = UNDEAD.BONE_CRAFT.list().length >= 5 && UNDEAD.BONE_CRAFT.held() === 16;
      player.inv = bag;
      check(P + 'a skeleton always drops bones; four bones make a fence at a workbench; it places as a solid piece, from Q or from the pack, and comes back up with the ground it stood on',
        boned === 30 && made && placed && solid && remembered && back && tapped && listed,
        { droppedBones: boned + '/30', crafted: made, placed, solid, remembered, pickedUp: back, placedFromPack: tapped, boneRecipes: UNDEAD.BONE_CRAFT.list().length }); }

    // ---- the other bone pieces do something real ----
    { const bag = player.inv.slice(); player.inv = player.inv.map(() => null);
      const o = h.openSpot(50, 28); F.tp(o.x, o.y); player.facing = { x: 1, y: 0 };
      const tx = o.x + 1, ty = o.y, was = tileAt(tx, ty);                   // the tile the knight is actually facing
      player.dayTime = (window.NIGHT ? NIGHT.LIGHT + NIGHT.DUSK : 480) + 20; h.peace(false);
      // the torch is a light: it pushes the night back where a plain prop would not
      changeTile(tx, ty, UNDEAD.tiles.torch); F.sim(1, []); render();
      const lit = UNDEAD.lights().some(L => Math.abs(L.x - tc(tx)) < 4 && L.r >= 100);
      // the chime hears them coming
      changeTile(tx, ty, UNDEAD.tiles.chime);
      const z = makeRisen('skeleton', tc(tx) + 3 * TILE, tc(ty), 'cross'); z.stunT = 999; monsters.push(z);
      const r0 = UNDEAD.lastRattle(); F.sim(24, []); const rattled = UNDEAD.lastRattle() > r0;
      // the throne: sit, and what is coming for you kneels
      changeTile(tx, ty, UNDEAD.tiles.throne); player.throneCd = -1e9;
      z.state = 'chase'; z.angry = true; z.kneelT = 0; z.stunT = 999;
      F.face(tx, ty); F.press('KeyE'); F.sim(1, []);
      const opened = panel === 'bones'; render();
      const sat = F.clickButton('Sit — the dead kneel');
      const knelt = z.kneelT > 0 && z.state !== 'chase' && !z.angry;
      // twenty bones must be able to come home again
      F.press('KeyE'); F.sim(1, []); render(); const lifted = F.clickButton('Take the throne back up') && tileAt(tx, ty) !== UNDEAD.tiles.throne && countItem('bone_throne') === 1;
      closePanel(); { const i = monsters.indexOf(z); if (i >= 0) monsters.splice(i, 1); }
      changeTile(tx, ty, was); player.dayTime = day0; player.inv = bag; player.throneCd = -1e9; h.peace(true);
      check(P + 'the bone torch lights the dark, the chime rattles when the risen come near, sitting on the bone throne makes them kneel, and the throne can be taken back up',
        lit && rattled && opened && !!sat && knelt && lifted && UNDEAD.KNEEL_FOR === 20,
        { lit, rattled, thronePanel: opened, sat: !!sat, knelt, lifted }); }

    // ---- the necromancy drops, counted with the dice pinned ----
    { const rand0 = Math.random, drops0 = drops, banner0 = levelBanner;
      const got = {}; let rare = 0; const N = 6000;
      drops = []; Math.random = mulberry32(20260909);
      try {
        for (let i = 0; i < N; i++) { const b = drops.length; rollDrops(MONSTER_DEFS.zombie_brute, -9999, -9999); for (const d of drops.slice(b)) if (UNDEAD.NECRO.includes(d.id)) { got[d.id] = (got[d.id] || 0) + 1; rare++; } drops.length = 0; }
      } finally { Math.random = rand0; drops = drops0; levelBanner = banner0; }
      const t = MONSTER_DEFS.zombie_brute.drops.rare;
      const weights = t.table.reduce((s, r) => s + r[3], 0);
      const gear = ITEMS.bone_staff.weapon.str === 18 && ITEMS.necro_robe.armour.def === 16 && ITEMS.necro_hood.armour.def === 10 && ITEMS.soul_lantern.armour.def === 6 && ITEMS.necro_tome.value === 2500;
      // the grave-writ is a book you can actually read, and the lantern is worn in the off hand and lights the dark
      const bag2 = player.inv.slice(); player.inv = player.inv.map(() => null);
      dialog.queue.length = 0; dialog.cur = null; addItem('necro_tome', 1);
      useItem(player.inv.findIndex(x => x && x.id === 'necro_tome'));
      const read = [dialog.cur, ...dialog.queue].filter(Boolean).some(d => /cut stone/.test(d.text));
      dialog.queue.length = 0; dialog.cur = null;
      const eq0 = player.equip.shield; player.equip.shield = 'soul_lantern';
      const day1 = player.dayTime; player.dayTime = (window.NIGHT ? NIGHT.LIGHT + NIGHT.DUSK : 480) + 20; F.sim(1, []); render();
      const lantern = UNDEAD.lights().some(L => Math.abs(L.x - player.x) < 2 && L.r >= 120);
      player.equip.shield = eq0; player.dayTime = day1; player.inv = bag2;
      check(P + 'one brute in twelve carries necromancy gear (hood 5/15, robe 4/15, lantern 3/15, staff 2/15, grave-writ 1/15 of that roll) — 6000 kills with the dice pinned',
        t.chance === 12 && weights === 15 && rare >= 425 && rare <= 575
        && got.necro_hood >= 120 && got.necro_hood <= 215 && got.necro_robe >= 95 && got.necro_robe <= 175
        && got.soul_lantern >= 65 && got.soul_lantern <= 140 && got.bone_staff >= 40 && got.bone_staff <= 100
        && got.necro_tome >= 15 && got.necro_tome <= 55 && gear && read && lantern,
        { kills: N, expectedRare: N / 12, rare, ...got, gear, graveWritReads: read, lanternLights: lantern }); }

    // ---- the old rules still hold: forty markers, and the zombie's mace ----
    { quest.graves = [];
      const o = h.openSpot(56, 34); let laid = 0, peak = 0;
      for (let i = 0; i < 90; i++) {                                   // ninety kills, forty markers: the number is the point
        const x = o.x + (i % 14) * 2, y = o.y + Math.floor(i / 14) * 2;
        if (!inMap(x, y) || SOLID.has(tileAt(x, y)) || buildingAt(x, y)) continue;
        if (GRAVES.layMarker(x, y, 'cross')) laid++;
        peak = Math.max(peak, GRAVES.marks().length);
      }
      const capped = peak <= GRAVES.MAX_MARKERS && GRAVES.marks().length <= GRAVES.MAX_MARKERS;
      for (const m of GRAVES.marks().slice()) GRAVES.removeMarker(m);
      const z = MONSTER_DEFS.zombie.drops, gz = MONSTER_DEFS.grave_zombie.drops;
      const mace = !!ITEMS.skull_mace && z.rare.chance === 150 && z.rare.table.some(r => r[0] === 'skull_mace') && gz.rare.chance < z.rare.chance;
      const bones = z.table.some(r => r[0] === 'bone') && gz.always.some(r => r[0] === 'bone');
      check(P + 'the ground keeps at most forty markers, and a zombie still drops bones, grave iron and the skull mace at 1 in 150',
        GRAVES.MAX_MARKERS === 40 && laid > 40 && capped && GRAVES.marks().length === 0 && mace && bones && ITEMS.skull_mace.weapon.str === 26,
        { laid, peak, capped, mace, bones }); }

    quest.graves = g0; quest.graveNight = tally0; player.dayTime = day0; player.hp = Math.min(hp0, player.maxHp);
    player.skills.crafting.xp = craft0; h.peace(false);
  });
}
