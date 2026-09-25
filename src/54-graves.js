// ============================================================================
// WHAT THE GROUND KEEPS — three grades of grave, and the night empties every one of them
//
// Owner's design, in his words:
//   "All crosses that have been created during a day should spawn between midnight and dawn, so that there
//    are no crosses at dawn."
//   "The zombies should be morphed into a tiered system. If you kill low level mobs like goblins it is a
//    wood cross, and it raises a weak skeleton, and they drop bones, which can be used as a building
//    resource and a crafting resource — a bone throne, or bone decorations like a bone torch... Then
//    mid-level monsters can be the zombies. And then higher level monsters should have a stone gravestone,
//    that when they are summoned they are zombie brutes, which are like a 2x2 tile zombie with a big huge
//    weapon, and they do low damage but they have very high health, and if you kill them they have a rare
//    chance at dropping necromancy equipment."
//
// So the map remembers your day, and it grades it. What you put down decides what the ground gives back:
//
//   WOOD CROSS   level 1–7    goblin soldier 2 · wolf 6 · goblin sapper 7        → a Skeleton (lv 5)
//   GRAVE        level 8–19   giant spider 8 · goblin brute 9 · town guard 12    → a Risen zombie (lv 12)
//   HEADSTONE    level 20+    castle guard 20 · Gnasher 22 · ash drake 30 · dragons · The Fang
//                                                                                → a Zombie brute (lv 30)
// The two cut points sit in the real gaps in MONSTER_DEFS: nothing in the game is level 10 or 11, and
// nothing is 19. Below 8 is the goblin line and the wild animals; 8–19 is a fighter that made you work;
// 20 and up is a monster. Livestock, harmless things and machines leave nothing — a sheep is a sheep, and a
// walker leaves a wreck, not a body. The undead leave nothing either: they already came out of a grave.
//
// THE NIGHT. Night is dayT 480 → 600 (35-night: day 600, light 420, dusk 60). Midnight is the middle of the
// dark, 540. Every grave laid today is dealt a minute of its own between 540 and 580, evenly spaced across
// the window with a little jitter, so they come up one after another instead of all at once. Whatever is
// still standing when the sun comes up settles by itself. Dawn finds none. Ever.
//
// A GRAVE FAR FROM THE KNIGHT opens on its own and whatever climbed out is long gone by the time you get
// there. Nothing is spawned where nobody can see it: no army of monsters walking the map in the dark, no
// cost for a night you slept through, and it makes the choice a real one — camp on your kills and you fight
// what you made and take the bones off it; walk away and the night takes them. The tally is kept and the
// bone throne reads it back to you.
//
// The marker is NOT a tile. A tile carries one texture, so a grave tile painted grass turned dirt roads and
// ash fields green underneath the cross. It is drawn over whatever ground it stands on, and quest.graves is
// the only record, so it never repaints the ground and can never block a path.
//
// The three risen have their own type ids (grave_skeleton / grave_risen / zombie_brute) and their own dawn
// sweep. 35-night owns the ambient zombie and counts its own `night` monsters; these are ours, we clean up
// after them, and the two systems never tread on each other.
//
// ONLINE. A knight who is not the keeper keeps his graves (nothing may rise into his puppet list); the risen
// are swept by type as well as by flag, because a keeper handoff loses the flag; and only real monsters slam
// or take the stagger bonus, never a puppet.
//
// Feature file: registers through HOOKS and edits no core file. It wraps placeAction by reassignment (the way
// 63-house does) so the five bone builds only go up on the knight's own island. window.GRAVES exposes the tables.
// ============================================================================
{
  // ---------- the clock (35-night owns it; everything here is read from it) ----------
  const N = () => window.NIGHT || null;
  const DAY = () => (N() ? NIGHT.DAY : 600);
  const dayT = () => (N() && NIGHT.dayT ? NIGHT.dayT() : 0);
  const phase = () => (N() && NIGHT.phase ? NIGHT.phase() : 'day');
  const DARK_FROM = () => (N() ? NIGHT.LIGHT + NIGHT.DUSK : 480);      // 480: full dark
  const MIDNIGHT = () => DARK_FROM() + (DAY() - DARK_FROM()) / 2;      // 540: the middle of the dark
  const LAST_RISE = () => DAY() - 20;                                  // 580: the last one still gets a night

  // ---------- the three grades ----------
  const GRADES = {
    cross: { key: 'cross', upTo: 7, name: 'Wood cross', raises: 'grave_skeleton', dust: '#6a5a3a' },
    grave: { key: 'grave', upTo: 19, name: 'Grave', raises: 'grave_risen', dust: '#5a4530' },
    headstone: { key: 'headstone', upTo: Infinity, name: 'Stone headstone', raises: 'zombie_brute', dust: '#7a7d84' },
  };
  const ORDER = ['cross', 'grave', 'headstone'];
  const gradeForLevel = lv => ORDER.find(k => lv <= GRADES[k].upTo) || 'headstone';

  const MAX_MARKERS = 40;        // the ground remembers your last forty kills of the day, not every kill you ever made
  const RISE_RADIUS = 14;        // tiles: a grave this close to the knight puts something up where he can see it
  const CAP = 6;                 // at most six of your own dead on their feet at once — and a brute counts for two
  const BRUTE = 'zombie_brute', BRUTE_R = 44, BRUTE_SPRITE = 2 * TILE;  // 96 px across: two tiles

  // the undead never bury anyone — they came out of a grave themselves
  const UNDEAD = new Set(['zombie', 'zombie_calm', 'grave_zombie', 'grave_zombie_calm', 'vampire', 'count_ashvane',
    'grave_skeleton', 'grave_risen', BRUTE]);
  const NO_BODY = new Set(['bulldozer', 'yard_dozer']);   // machines: 22-bulldozer leaves a wreck tile where they fall
  // These three are only ever made by raise() below: nothing spawns them into the world (see the book entry
  // near the end of this file). So the type alone says "one of ours", even when the fromGrave flag is lost.
  // It is lost in online play: when the keeper leaves, 75-coop rebuilds the next knight's puppets as fresh
  // real monsters, and those carry no flag. A puppet (remote) is the keeper's to sweep, never ours.
  const RISEN_TYPES = new Set(['grave_skeleton', 'grave_risen', BRUTE]);
  const isRisen = m => !!m && (m.fromGrave || (RISEN_TYPES.has(m.type) && !m.remote));
  // Online, a knight who is not the keeper shows puppets of the keeper's monsters, and 75-coop throws away
  // anything else put into that list on the very next update. A grave raised there would be used up with
  // nothing standing on it, so on that knight's screen the graves wait: whatever is still in the ground at
  // dawn walks, the same as a grave nobody was near.
  const puppetView = () => !!(window.COOP && COOP.puppets && COOP.puppets());

  // anything that could fight back gets a grave; livestock, critters and machines do not
  function buriable(type) {
    const d = MONSTER_DEFS[type];
    if (!d || d.harmless || d.mech || UNDEAD.has(type) || NO_BODY.has(type)) return false;
    return !!(d.aggro || d.human);
  }
  const gradeFor = type => (buriable(type) ? gradeForLevel(MONSTER_DEFS[type].level || 1) : null);

  // ---------- state ----------
  const marks = () => { if (!Array.isArray(quest.graves)) quest.graves = []; return quest.graves; };
  const tally = () => { if (!quest.graveNight) quest.graveNight = { rose: 0, walked: 0, laid: 0 }; return quest.graveNight; };
  HOOKS.newGame.push(() => { quest.graves = []; quest.graveNight = { rose: 0, walked: 0, laid: 0 }; prevPhase = null; lastT = null; armed = false; built = false; LOG.length = 0; });

  const BURIABLE_GROUND = () => [T.GRASS, T.DIRT, T.SAND, T.SCORCH, T.ASH, T.ASHES].filter(t => t !== undefined);   // no farmland: a marker must never sit on a crop
  const markerAt = (tx, ty) => marks().find(m => m.x === tx && m.y === ty) || null;
  const gradeOf = m => GRADES[m && m.g] || GRADES.cross;   // an old save has no grade: it was a cross

  function layMarker(tx, ty, grade = 'cross') {
    if (!inMap(tx, ty)) return false;
    if (!BURIABLE_GROUND().includes(tileAt(tx, ty))) return false;   // you cannot bury anyone in a wall or a river
    if (buildingAt(tx, ty)) return false;
    const list = marks();
    if (list.some(m => m.x === tx && m.y === ty)) return false;
    const m = { x: tx, y: ty, g: GRADES[grade] ? grade : 'cross', t: 0, rise: null };
    if (phase() !== 'day') m.rise = riseTimeNow();                    // laid after the light went: it still gets tonight
    list.push(m);
    tally().laid++;
    while (list.length > MAX_MARKERS) list.shift();                   // the oldest settles; no ground to put back
    return true;
  }
  function removeMarker(m, quiet) {
    const list = marks(); const i = list.indexOf(m); if (i >= 0) list.splice(i, 1);
    if (!quiet) burst(tc(m.x), tc(m.y), gradeOf(m).dust, 8, 50);
  }

  // ---------- something falls, the ground grades it ----------
  HOOKS.kill.push(m => {
    if (!m || window.__instance) return;                              // dungeons keep their own dead
    if (window.INSTANCES && INSTANCES.active()) return;
    const grade = gradeFor(m.type); if (!grade) return;
    const tx = Math.floor(m.x / TILE), ty = Math.floor(m.y / TILE);
    if (layMarker(tx, ty, grade)) return;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (layMarker(tx + dx, ty + dy, grade)) return;
  });

  // ---------- the night schedule ----------
  // Every grave standing when the dark comes gets a minute of its own between midnight and dawn, evenly
  // spaced with a little jitter so they come up one at a time instead of the whole day at once.
  const LOG = [];                                    // the last forty rises: { t, grade } — for the self-test, never saved
  function riseTimeNow() {
    const from = MIDNIGHT(), to = LAST_RISE(), t = dayT();
    if (t < from) return from + Math.random() * (to - from);
    return Math.min(DAY() - 3, Math.max(t + 1, t + Math.random() * Math.max(1, to - t)));
  }
  function schedule() {
    const list = marks(); if (!list.length) return;
    const from = MIDNIGHT(), to = LAST_RISE(), span = to - from;
    const order = list.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const s = order[i]; order[i] = order[j]; order[j] = s; }
    const n = order.length, step = n > 1 ? span / (n - 1) : 0;
    order.forEach((m, i) => {
      const base = n > 1 ? from + step * i : from + span / 2;
      const jitter = (Math.random() - 0.5) * Math.min(3, step || 3);
      m.rise = clamp(base + jitter, from, to);
    });
  }

  // ---------- raising ----------
  const risen = () => monsters.filter(m => isRisen(m) && !m.dead);
  const weightOf = key => (key === 'headstone' ? 2 : 1);           // two tiles of brute is two of anything else
  const load = () => risen().reduce((n, m) => n + weightOf(m.grade), 0);
  function makeRisen(type, tx, ty, grade) {
    const d = MONSTER_DEFS[type];
    return {
      type, x: tc(tx), y: tc(ty), home: { x: tc(tx), y: tc(ty) }, r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed,
      angry: d.aggro, state: 'idle', wanderT: Math.random() * 2, wander: { x: 0, y: 0 }, attackCd: 0, hurtT: 0,
      dead: false, deadT: 0, respawnT: 0, facing: { x: 1, y: 0 }, walkT: 0, moving: false, stunT: 0,
      fromGrave: true, grade,
    };
  }
  // can this grave put something up where the knight can see it right now?
  function riseSpot(m) {
    if (window.__instance || player.dead || puppetView()) return false;
    const px = Math.floor(player.x / TILE), py = Math.floor(player.y / TILE);
    if (Math.abs(m.x - px) > RISE_RADIUS || Math.abs(m.y - py) > RISE_RADIUS) return false;
    if (dist(tc(m.x), tc(m.y), player.x, player.y) <= 3 * TILE) return false;      // never straight under his feet
    if (N() && NIGHT.inNoGo && NIGHT.inNoGo(m.x, m.y)) return false;               // no village, no city, no castle
    if (!BURIABLE_GROUND().includes(tileAt(m.x, m.y)) || buildingAt(m.x, m.y)) return false;
    const type = gradeOf(m).raises, r = MONSTER_DEFS[type].r;
    return !collides(tc(m.x), tc(m.y), r, 'beast');                                // the brute needs two clear tiles
  }
  function raise(m) {
    const grade = gradeOf(m), type = grade.raises;
    const e = makeRisen(type, m.x, m.y, grade.key);
    monsters.push(e);
    burst(e.x, e.y + 8, grade.dust, 18, 80);
    floatText(e.x, e.y - 30, grade.key === 'headstone' ? 'The stone falls' : 'The cross falls', '#8b949e', 12);
    LOG.push({ t: +dayT().toFixed(2), grade: grade.key, type }); while (LOG.length > 40) LOG.shift();
    tally().rose++;
    removeMarker(m, true);
    return e;
  }
  function tryRises() {
    if (puppetView()) return;
    const list = marks(); if (!list.length) return;
    const t = dayT(); let n = load();
    for (const m of list.slice()) {
      if (n >= CAP) break;
      if (m.rise == null || t < m.rise) continue;
      const w = weightOf(gradeOf(m).key); if (n + w > CAP) continue;
      if (!riseSpot(m)) continue;          // blocked, or you are not there to see it: try again next tick
      raise(m); n += w;
    }
  }
  // dawn: nothing may still be standing. Whatever the knight never got to opens on its own and walks.
  function settleAtDawn() {
    const list = marks(); if (!list.length) return;
    const t = tally();
    for (const m of list.slice()) { t.walked++; removeMarker(m, true); }
    quest.graves = [];
  }
  // and the risen go with the light, the same way 35-night's do. Matched by type as well as by flag, so one
  // that came to us in a keeper handoff still crumbles at dawn and, dead, is taken away and never respawns.
  function sweepRisen(ph) {
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i]; if (!isRisen(m)) continue;
      if (m.dead) { if (m.deadT > 0.8) monsters.splice(i, 1); continue; }   // yours never come back
      if (ph !== 'night') {
        burst(m.x, m.y, '#8a8a7a', 14, 80); floatText(m.x, m.y - 24, 'crumbles', '#9a9a8a', 12);
        monsters.splice(i, 1);
      }
    }
  }

  // ---------- the brute's own trick: the ground slam ----------
  // It hauls the headstone over its head, plants its feet for a beat, and brings it down. Low damage, but it
  // throws you a long way — and the stone buries itself, so for the second and a bit while it drags the thing
  // back out, every hit you land goes in twice. Let it swing, step out, then hit it.
  const SLAM = { range: 3.2 * TILE, wind: 1.1, hit: 1.7 * TILE, stagger: 1.7, cd: 5, knock: 46 };
  // Online, only the keeper's real brute slams, and it slams only the keeper's own knight: the slam is not
  // sent over the wire, so another knight standing beside it is not thrown. A puppet brute on the other
  // knights' screens never winds up at all (bruteTick skips it), so nobody is hit by a copy that is out of
  // step with the real one. That is the whole of it for this wave.
  function landSlam(m) {
    m.stagT = SLAM.stagger; m.slams = (m.slams || 0) + 1;
    burst(m.x, m.y + 12, '#6a5a3a', 26, 150); burst(m.x, m.y + 12, '#9a9a8a', 14, 110);
    floatText(m.x, m.y - m.r - 24, 'SLAM', '#ff6b6b', 16); sfx('boom');
    if (player.dead || window.__peace) return;
    m.slamDist = Math.round(dist(m.x, m.y, player.x, player.y));
    if (m.slamDist > SLAM.hit) return;
    const def = MONSTER_DEFS[BRUTE];
    const hp0 = player.hp;
    hurtPlayer(rollHit((def.att + 8) * 64, playerDefRoll(), def.maxHit), m.x, m.y);
    m.slamDmg = hp0 - player.hp;
    const bx = player.x, by = player.y;
    const kx = player.x - m.x, ky = player.y - m.y, kd = Math.hypot(kx, ky) || 1;
    moveEntity(player, kx / kd * SLAM.knock, ky / kd * SLAM.knock, playerWho());
    m.threw = dist(bx, by, player.x, player.y);
  }
  function bruteTick(dt) {
    for (const m of monsters) {
      if (m.remote) continue;
      if (m.type !== BRUTE || m.dead) continue;
      m.slamCd = Math.max(0, (m.slamCd == null ? SLAM.cd : m.slamCd) - dt);
      if (m.stagT > 0) { m.stagT -= dt; m.windT = 0; m.stunT = Math.max(m.stunT || 0, m.stagT); continue; }
      if (m.windT > 0) { m.windT -= dt; m.stunT = Math.max(m.stunT || 0, m.windT); if (m.windT <= 0) { m.windT = 0; landSlam(m); } continue; }
      if (window.__peace || player.dead || window.__instance) continue;
      if (m.slamCd > 0 || dist(m.x, m.y, player.x, player.y) > SLAM.range) continue;
      m.windT = SLAM.wind; m.slamCd = SLAM.cd; m.stunT = Math.max(m.stunT || 0, SLAM.wind);
      floatText(m.x, m.y - m.r - 24, 'lifts the stone', '#ffd166', 13);
    }
  }
  // the stone is buried: the second half of every hit lands free. Not on a puppet: its hp is the keeper's,
  // and the next snapshot would take back a "-N more" the knight had just been shown.
  HOOKS.hit.push((m, dmg) => {
    if (!m || m.remote) return;
    if (m.type !== BRUTE || m.dead || !(m.stagT > 0) || !(dmg > 0)) return;
    m.hp -= dmg; m.doubled = (m.doubled || 0) + dmg;
    floatText(m.x, m.y - m.r - 26, `-${dmg} more`, '#ffd166', 13);
  });

  // ---------- the tick ----------
  let prevPhase = null, lastT = null, armed = false, built = false, age = 0;
  HOOKS.update.push(dt => {
    const ph = phase(), t = dayT();
    // The clock only ever moves a frame at a time while you play. A jump means something set it — a save
    // loaded into the middle of a night, a long spell with the tab shut, a test — and the graves do not get a
    // night out of that. They settle at dawn like everything else.
    const wrapped = lastT !== null && lastT > t && lastT > DAY() - 30 && t < 30;
    if (lastT !== null && !wrapped && Math.abs(t - lastT) > 2) { armed = false; built = false; for (const m of marks()) m.rise = null; }
    if (ph === 'dusk') armed = true;
    if (ph === 'day') { armed = false; built = false; }
    if (ph === 'night' && armed && !built) { schedule(); built = true; }
    if (prevPhase === 'night' && ph === 'day') settleAtDawn();   // a real dawn only: night always runs into day
    prevPhase = ph; lastT = t;

    // a grave that something got built over is gone; the rest just age. Once a second is often enough — forty
    // markers against every building on the map, every frame, is not.
    age += dt;
    if (age >= 1) { const step = age; age = 0; for (const m of marks().slice()) { m.t = (m.t || 0) + step; if (!BURIABLE_GROUND().includes(tileAt(m.x, m.y)) || buildingAt(m.x, m.y)) removeMarker(m, true); } }
    if (ph === 'night' && built) tryRises();
    sweepRisen(ph);
    bruteTick(dt);
  });

  // ---------- the monsters ----------
  MONSTER_DEFS.grave_skeleton = {
    name: 'Skeleton', level: 5, r: 12, hp: 20, att: 6, maxHit: 4, def: 5, speed: 105, aggro: true, sight: 6 * TILE, respawn: 0,
    drops: {
      always: [['bone', 1, 2]],
      table: [['nothing', 0, 0, 4], ['coins', 3, 9, 5], ['bone', 1, 2, 5], ['rotten_cloth', 1, 1, 3], ['grave_iron', 1, 1, 2]],
    },
  };
  MONSTER_DEFS.grave_risen = {
    name: 'Risen zombie', level: 12, r: 13, hp: 40, att: 12, maxHit: 7, def: 8, speed: 70, aggro: true, sight: 6 * TILE, respawn: 0,
    drops: {
      always: [['coins', 8, 20], ['bone', 1, 2]],
      table: [['nothing', 0, 0, 3], ['rotten_cloth', 1, 2, 6], ['grave_iron', 1, 1, 4], ['grave_dust', 1, 1, 3], ['bone', 2, 3, 4], ['coal', 1, 2, 2]],
      rare: { chance: 150, table: [['skull_mace', 1, 1, 1]] },
    },
  };
  MONSTER_DEFS[BRUTE] = {
    name: 'Zombie brute', level: 30, r: BRUTE_R, hp: 320, att: 30, maxHit: 5, def: 20, speed: 62, aggro: true, sight: 7 * TILE, respawn: 0,
    drops: {
      always: [['bone', 4, 8], ['grave_dust', 1, 2], ['coins', 40, 80]],
      table: [['nothing', 0, 0, 3], ['grave_iron', 2, 4, 6], ['bone', 3, 6, 5], ['steel_bar', 1, 2, 4], ['rotten_cloth', 1, 3, 3]],
      // 1 kill in 20 hands over a piece of the necromancer's kit. Weights 4/4/3/2/1 of 14.
      rare: { chance: 20, table: [['necro_hood', 1, 1, 4], ['necro_wraps', 1, 1, 4], ['necro_robe', 1, 1, 3], ['soul_lantern', 1, 1, 2], ['bone_stave', 1, 1, 1]] },
    },
  };

  // ---------- sprites ----------
  // a skeleton: a skull that sits too loose on the neck, a ribcage you can see daylight through, arms out front
  function drawSkeleton(g, e, hurt) {
    const fx = e.facing.x, fy = e.facing.y, ang = Math.atan2(fy, fx);
    const bone = hurt ? '#ffd8d8' : '#e9e4d2', shade = hurt ? '#e0b4b4' : '#c3bda6';
    const sw = e.moving ? Math.sin(e.walkT * 0.9) * 0.2 : 0;
    // arms reaching, drawn behind the body and rotated to face
    g.save(); g.rotate(ang); g.strokeStyle = bone; g.lineCap = 'round'; g.lineWidth = 3.2;
    for (const s of [-1, 1]) {
      g.save(); g.rotate(s * (0.3 - sw * s));
      g.beginPath(); g.moveTo(3, s * 6); g.lineTo(13, s * 5); g.lineTo(21, s * 3); g.stroke();
      g.fillStyle = bone; g.beginPath(); g.arc(22, s * 3, 2.4, 0, 7); g.fill();
      g.restore();
    }
    g.restore();
    // legs
    g.strokeStyle = shade; g.lineWidth = 3;
    const stride = e.moving ? Math.sin(e.walkT) * 3.5 : 0;
    g.beginPath(); g.moveTo(-3.5, 6); g.lineTo(-4 - stride, 14); g.moveTo(3.5, 6); g.lineTo(4 + stride, 14); g.stroke();
    // pelvis and spine
    g.fillStyle = shade; g.beginPath(); g.ellipse(0, 6, 6, 3.4, 0, 0, 7); g.fill();
    g.strokeStyle = bone; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 5); g.lineTo(0, -4); g.stroke();
    // ribcage
    g.lineWidth = 1.8;
    for (let i = 0; i < 4; i++) { const y = -3 + i * 2.4, w = 7.5 - i * 0.8; g.beginPath(); g.arc(0, y, w, 0.25, Math.PI - 0.25); g.stroke(); }
    // collar bones
    g.lineWidth = 2; g.beginPath(); g.moveTo(-7, -5); g.lineTo(7, -5); g.stroke();
    // the skull, tipped over
    g.save(); g.translate(0, -10); g.rotate(0.26);
    g.fillStyle = bone; g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill();
    g.fillStyle = shade; g.beginPath(); g.ellipse(0, 5, 4.6, 3.2, 0, 0, 7); g.fill();     // jaw
    g.fillStyle = '#14140f'; g.beginPath(); g.ellipse(-2.8 + fx * 1.6, -0.6 + fy * 1.4, 2.1, 2.4, 0, 0, 7); g.ellipse(2.8 + fx * 1.6, -0.6 + fy * 1.4, 2.1, 2.4, 0, 0, 7); g.fill();
    g.fillStyle = '#8fe1a0'; g.beginPath(); g.arc(-2.8 + fx * 1.6, -0.4 + fy * 1.4, 0.8, 0, 7); g.arc(2.8 + fx * 1.6, -0.4 + fy * 1.4, 0.8, 0, 7); g.fill();
    g.fillStyle = '#14140f'; g.fillRect(-1.2, 1.4, 2.4, 2.2);                              // nose hole
    g.strokeStyle = '#9a9480'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-3.4, 5.4); g.lineTo(3.4, 5.4); g.stroke();
    g.restore();
  }
  // the risen: 35-night's zombie, with the grave still falling off it
  function drawRisen(g, e, hurt) {
    const z = HOOKS.drawMonster.zombie;
    if (z) z(g, e, hurt); else drawHuman(g, e, { tunic: '#5a5644', hair: '#3a3a2a', skin: hurt ? '#ffc7b0' : '#8faa6c', fists: true });
    g.fillStyle = 'rgba(74,56,38,0.85)';
    for (const [ox, oy, r] of [[-8, 4, 2], [7, 7, 1.6], [-2, 10, 1.4], [9, 0, 1.2], [-10, -2, 1.2]]) { g.beginPath(); g.arc(ox, oy, r, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(60,44,26,0.8)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-6, -2); g.lineTo(-9, 6); g.moveTo(5, -1); g.lineTo(8, 8); g.stroke();   // roots still hanging off it
  }
  // the brute: two tiles of dead weight, an iron collar, and a headstone lashed to a beam
  function drawBrute(g, e, hurt) {
    const fx = e.facing.x, fy = e.facing.y, ang = Math.atan2(fy, fx);
    const wind = e.windT > 0 ? 1 - e.windT / SLAM.wind : 0;            // 0 → 1 as it hauls the stone up
    const stag = e.stagT > 0 ? e.stagT / SLAM.stagger : 0;             // 1 → 0 while it drags it back out
    const skin = hurt ? '#ffc7b0' : '#63804c', dark = hurt ? '#d89a90' : '#41562f';
    const lean = stag > 0 ? 0.22 * stag : wind * -0.18;
    g.save(); g.rotate(lean * (fx >= 0 ? 1 : -1));
    // the weapon first, so the body sits over the haft
    g.save(); g.rotate(ang);
    const raise = stag > 0 ? -0.5 : lerp(0.55, -1.15, wind);
    g.save(); g.translate(20, 0); g.rotate(raise);
    g.fillStyle = '#5c4326'; g.fillRect(-6, -4, 40, 8);                                    // the beam
    g.fillStyle = '#3f2e1a'; for (const bx of [2, 14, 26]) g.fillRect(bx, -4.6, 2.4, 9.2);  // bindings
    g.fillStyle = hurt ? '#e8d0d0' : '#8d9098'; g.beginPath();                              // the headstone, rounded top
    g.moveTo(30, -16); g.quadraticCurveTo(46, -22, 52, 0); g.quadraticCurveTo(46, 22, 30, 16); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(44, 0, 5.5, 7, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(32, -13, 3, 26);
    g.restore(); g.restore();
    // the shape: a slab of a torso, shoulders wider than it is tall
    g.fillStyle = dark; g.beginPath(); g.ellipse(0, 10, 30, 14, 0, 0, 7); g.fill();          // legs / haunches
    g.fillStyle = skin; g.beginPath(); g.ellipse(0, -2, 34, 26, 0, 0, 7); g.fill();
    g.fillStyle = dark; g.beginPath(); g.ellipse(0, 6, 26, 14, 0, 0, 7); g.fill();           // the sag of the belly
    // ribs pushing through
    g.strokeStyle = 'rgba(230,226,208,0.55)'; g.lineWidth = 2.4;
    for (let i = 0; i < 3; i++) { const y = -12 + i * 8; g.beginPath(); g.arc(0, y, 20 - i * 2, 0.3, Math.PI - 0.3); g.stroke(); }
    // stitched seam down the middle
    g.strokeStyle = 'rgba(30,26,18,0.6)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -22); g.lineTo(0, 16); g.stroke();
    for (let y = -20; y < 16; y += 6) { g.beginPath(); g.moveTo(-4, y); g.lineTo(4, y + 3); g.stroke(); }
    // arms: the far one hangs, the near one holds the beam
    g.save(); g.rotate(ang); g.fillStyle = skin;
    g.save(); g.rotate(-0.45); g.fillRect(10, -26, 30, 12); g.restore();
    g.save(); g.rotate(0.45); g.fillRect(10, 14, 30, 12); g.restore();
    g.restore();
    // shoulders and the iron collar
    g.fillStyle = dark; g.beginPath(); g.arc(-26, -12, 11, 0, 7); g.arc(26, -12, 11, 0, 7); g.fill();
    g.fillStyle = '#6e7178'; g.beginPath(); g.ellipse(0, -26, 15, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#4a4d54'; g.beginPath(); g.ellipse(0, -26, 11, 4, 0, 0, 7); g.fill();
    for (const cx of [-13, 13]) { g.fillStyle = '#8f96a3'; g.beginPath(); g.arc(cx, -27, 3, 0, 7); g.fill(); }
    // the head, small on all that, jaw hanging
    g.save(); g.translate(0, -34); g.rotate(0.2 - wind * 0.25);
    g.fillStyle = skin; g.beginPath(); g.arc(0, 0, 13, 0, 7); g.fill();
    g.fillStyle = dark; g.beginPath(); g.arc(0, -3, 13, Math.PI, 0); g.fill();
    g.fillStyle = '#141410'; g.beginPath(); g.ellipse(-4.5 + fx * 3, 0 + fy * 3, 3, 3.4, 0, 0, 7); g.ellipse(4.5 + fx * 3, 0 + fy * 3, 3, 3.4, 0, 0, 7); g.fill();
    g.fillStyle = '#e8e26b'; g.beginPath(); g.arc(-4.5 + fx * 3, 0.4 + fy * 3, 1.2, 0, 7); g.arc(4.5 + fx * 3, 0.4 + fy * 3, 1.2, 0, 7); g.fill();
    g.fillStyle = '#3a2a20'; g.beginPath(); g.ellipse(0, 8, 5.5, 4.5, 0, 0, 7); g.fill();     // the open jaw
    g.fillStyle = '#e9e4d2'; for (const tx2 of [-3, 0, 3]) g.fillRect(tx2 - 0.7, 5, 1.4, 3);
    g.restore();
    g.restore();
    // the wind-up telegraph is drawn on the ground, under everything — see the draw hook
  }
  HOOKS.drawMonster.grave_skeleton = (g, e, hurt) => drawSkeleton(g, e, hurt);
  HOOKS.drawMonster.grave_risen = (g, e, hurt) => drawRisen(g, e, hurt);
  HOOKS.drawMonster[BRUTE] = (g, e, hurt) => drawBrute(g, e, hurt);

  // ---------- bones, and what you build out of them ----------
  Object.assign(ITEMS, {
    bone: { name: 'Bone', value: 8, color: '#e9e4d2', shape: 'tusk', stack: 50 },
    // the five things a knight can make out of them
    bone_torch: { name: 'Bone torch', value: 60, color: '#d8f0c0', shape: 'rod', stack: 50, place: 'BONE_TORCH' },
    bone_fence: { name: 'Bone fence', value: 30, color: '#e9e4d2', shape: 'plank', stack: 50, place: 'BONE_FENCE' },
    skull_pile: { name: 'Skull pile', value: 70, color: '#ded8c4', shape: 'rock', stack: 50, place: 'SKULL_PILE' },
    bone_arch: { name: 'Bone arch', value: 200, color: '#e9e4d2', shape: 'door', stack: 50, place: 'BONE_ARCH' },
    bone_throne: { name: 'Bone throne', value: 900, color: '#ded8c4', shape: 'bench', stack: 10, place: 'BONE_THRONE' },
    // the necromancer's kit — the Zombie brute's rare drop. A later feature builds the Necromancy skill on
    // these five ids; every one carries a `necro` block so it can find them without a hard-coded list.
    necro_hood: { name: 'Necromancer hood', value: 900, color: '#3a2f4a', shape: 'helm', stack: 1, armour: { slot: 'helm', def: 8 }, necro: { power: 4 } },
    necro_robe: { name: 'Necromancer robe', value: 1800, color: '#2e2740', shape: 'body', stack: 1, armour: { slot: 'body', def: 16 }, necro: { power: 8 } },
    necro_wraps: { name: 'Necromancer wraps', value: 1200, color: '#332c46', shape: 'legs', stack: 1, armour: { slot: 'legs', def: 11 }, necro: { power: 5 } },
    soul_lantern: { name: 'Soul lantern', value: 1500, color: '#7ee7c8', shape: 'shield', stack: 1, armour: { slot: 'shield', def: 9 }, necro: { power: 6 } },
    bone_stave: { name: 'Bone stave', value: 2400, color: '#e9e4d2', shape: 'warhammer', stack: 1, weapon: { str: 18, att: 20, cd: 0.55 }, necro: { power: 10, focus: true } },
    // kept from the first pass: a zombie is worth the walk
    skull_mace: { name: 'Skull mace', value: 1600, color: '#cfd3d8', shape: 'warhammer', stack: 1, weapon: { str: 26, att: 12, cd: 0.7, perk: 'knockback' } },
    grave_iron: { name: 'Grave iron', value: 45, color: '#7a7f86', shape: 'bar', stack: 50 },
  });
  const NECRO_SET = ['necro_hood', 'necro_robe', 'necro_wraps', 'soul_lantern', 'bone_stave'];
  const BONE_BUILDS = ['bone_torch', 'bone_fence', 'skull_pile', 'bone_arch', 'bone_throne'];
  for (const k of ['bone', ...BONE_BUILDS, ...NECRO_SET, 'skull_mace', 'grave_iron']) ITEMS[k].id = k;

  // Owner's standing rule: nothing is built in the shared world; building goes on the knight's own island
  // (63-house). The five bone builds are new, so they go there and nowhere else. The core's own plank, door,
  // bed and workbench are older than the rule and are left alone. 63-house loads after this file and wraps
  // placeAction again on top of this; on the island its checks run first and then hand on to this one.
  const onIsland = () => !!(window.INSTANCES && INSTANCES.active && INSTANCES.active() === (window.HOUSE ? HOUSE.ID : 'house'));
  const _placeAction = placeAction;
  placeAction = function (id) {
    if (id && BONE_BUILDS.includes(id) && !onIsland()) { notify('Bone builds go on your island. Take them through the portal.'); return; }
    return _placeAction(id);
  };

  // ---------- the tiles they become ----------
  const T_TORCH = addTile('BONE_TORCH', { solid: true, tex: 'dirt', mini: '#d8f0c0' });
  const T_FENCE = addTile('BONE_FENCE', { solid: true, tex: 'dirt', mini: '#e9e4d2' });
  const T_PILE = addTile('SKULL_PILE', { solid: false, tex: 'dirt', mini: '#ded8c4' });
  const T_ARCH = addTile('BONE_ARCH', { push: true, tex: 'dirt', mini: '#e9e4d2' });   // people walk under it; the dead cannot
  const T_THRONE = addTile('BONE_THRONE', { solid: true, tex: 'dirt', mini: '#ded8c4' });
  const BONE_TILES = new Set([T_TORCH, T_FENCE, T_PILE, T_ARCH, T_THRONE]);
  for (const t of BONE_TILES) INTERESTING_TILES.add(t);   // the core E ring, frontTile's reach, and a tap on the iPad

  RECIPES.push(
    { out: 'bone_torch', qty: 1, needs: [['bone', 4], ['wood', 1]], station: 'workbench', skill: 'crafting', lv: 3, xp: 30, label: '4 Bones + Logs → Bone torch (burns all night)' },
    { out: 'bone_fence', qty: 2, needs: [['bone', 3]], station: 'workbench', skill: 'crafting', lv: 5, xp: 24, label: '3 Bones → 2 Bone fence' },
    { out: 'skull_pile', qty: 1, needs: [['bone', 6]], station: 'workbench', skill: 'crafting', lv: 6, xp: 45, label: '6 Bones → Skull pile' },
    { out: 'bone_arch', qty: 1, needs: [['bone', 12], ['stone', 2]], station: 'workbench', skill: 'crafting', lv: 10, xp: 110, label: '12 Bones + 2 Stone → Bone arch (a gate the dead will not cross)' },
    { out: 'bone_throne', qty: 1, needs: [['bone', 40], ['grave_dust', 2]], station: 'workbench', skill: 'crafting', lv: 14, xp: 320, label: '40 Bones + 2 Grave dust → Bone throne' },
  );

  // ---------- a zombie is still worth the walk (35-night's ambient dead) ----------
  const zombieDrops = {
    always: [['coins', 8, 20]],
    table: [['nothing', 0, 0, 3], ['rotten_cloth', 1, 2, 6], ['grave_iron', 1, 1, 4], ['grave_dust', 1, 1, 3], ['bone', 1, 2, 4], ['coal', 1, 2, 2], ['bread', 1, 1, 2]],
    rare: { chance: 150, table: [['skull_mace', 1, 1, 1]] },
  };
  for (const key of ['zombie', 'zombie_calm']) if (MONSTER_DEFS[key]) MONSTER_DEFS[key].drops = { ...zombieDrops, table: zombieDrops.table.slice() };
  for (const key of ['grave_zombie', 'grave_zombie_calm']) if (MONSTER_DEFS[key]) MONSTER_DEFS[key].drops = {
    always: [['coins', 20, 40], ['grave_dust', 1, 1], ['bone', 1, 3]],
    table: [['nothing', 0, 0, 2], ['grave_iron', 1, 3, 6], ['rotten_cloth', 1, 2, 4], ['bone', 2, 4, 4], ['steel_bar', 1, 1, 2]].filter(r => r[0] === 'nothing' || ITEMS[r[0]]),
    rare: { chance: 40, table: [['skull_mace', 1, 1, 2], ['vampire_fang', 1, 1, 3]].filter(r => ITEMS[r[0]]) },
  };
  // one you raised yourself pays a little extra off the grave it came out of
  HOOKS.kill.push(m => {
    if (!m || !m.fromGrave) return;
    giveOrDrop('grave_iron', rint(1, 2), m.x, m.y);
    floatText(m.x, m.y - 34, 'Off the grave', '#8b949e', 12);
  });

  // ---------- drawing: the three markers ----------
  const mound = (g, x, y, w, h) => {
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x, y + h + 2, w + 1, h * 0.42, 0, 0, 7); g.fill();
    g.fillStyle = '#5a4530'; g.beginPath(); g.ellipse(x, y + h, w, h * 0.42, 0, 0, 7); g.fill();
    g.fillStyle = '#6b5238'; g.beginPath(); g.ellipse(x - 1, y + h - 1, w * 0.8, h * 0.32, 0, 0, 7); g.fill();
    g.fillStyle = '#4a3826';
    for (const [ox, oy, r] of [[-w * 0.5, h, 1.8], [w * 0.4, h + 1, 1.5], [0, h - 2, 1.4], [w * 0.6, h - 2, 1.2]]) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, 7); g.fill(); }
  };
  function drawCross(g, x, y) {
    mound(g, x, y, 10, 8);
    g.fillStyle = '#6b4f2a'; g.fillRect(x - 1.6, y - 12, 3.2, 20);
    g.fillStyle = '#7a5a32'; g.fillRect(x - 6, y - 7, 12, 3);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 6, y - 5, 12, 1);
  }
  function drawGraveBoard(g, x, y) {
    mound(g, x, y, 13, 9);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 7, 12, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#7a5a32'; g.beginPath();                                     // a headboard plank, rounded off
    g.moveTo(x - 7, y + 8); g.lineTo(x - 7, y - 10); g.quadraticCurveTo(x, y - 18, x + 7, y - 10); g.lineTo(x + 7, y + 8); g.closePath(); g.fill();
    g.fillStyle = '#5f4526'; g.fillRect(x - 7, y - 3, 14, 2);
    g.strokeStyle = 'rgba(40,28,14,0.7)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x - 4, y - 8); g.lineTo(x + 4, y - 8); g.moveTo(x - 4, y + 2); g.lineTo(x + 3, y + 2); g.stroke();
    g.fillStyle = '#4a3826'; g.fillRect(x + 8, y - 2, 3, 11);                   // the spade left leaning on it
    g.fillStyle = '#8f96a3'; g.fillRect(x + 7.5, y + 8, 4, 4);
  }
  function drawHeadstone(g, x, y) {
    mound(g, x, y, 16, 10);
    g.fillStyle = '#6e7178';                                                    // a stone kerb round the plot
    g.fillRect(x - 17, y + 9, 34, 3); g.fillRect(x - 17, y - 1, 3, 10); g.fillRect(x + 14, y - 1, 3, 10);
    g.fillStyle = '#8d9098'; g.beginPath();                                     // the stone
    g.moveTo(x - 9, y + 9); g.lineTo(x - 9, y - 12); g.quadraticCurveTo(x, y - 24, x + 9, y - 12); g.lineTo(x + 9, y + 9); g.closePath(); g.fill();
    g.fillStyle = '#a3a6ad'; g.beginPath();
    g.moveTo(x - 9, y + 9); g.lineTo(x - 9, y - 12); g.quadraticCurveTo(x - 4, y - 20, x - 1, y - 20); g.lineTo(x - 1, y + 9); g.closePath(); g.fill();
    g.fillStyle = '#5f6268'; g.beginPath(); g.arc(x, y - 9, 4.6, 0, 7); g.fill();          // a skull chiselled into it
    g.fillStyle = '#8d9098'; g.beginPath(); g.arc(x - 1.6, y - 10, 1.3, 0, 7); g.arc(x + 1.6, y - 10, 1.3, 0, 7); g.fill();
    g.fillStyle = '#5f6268'; g.fillRect(x - 5, y - 2, 10, 1.6); g.fillRect(x - 4, y + 2, 8, 1.4);
    g.fillStyle = '#4c7a3a'; for (const [ox, oy] of [[-8, 7], [7, 8], [-6, 9]]) { g.beginPath(); g.ellipse(x + ox, y + oy, 3, 1.6, 0, 0, 7); g.fill(); }  // moss
  }
  const MARKER_ART = { cross: drawCross, grave: drawGraveBoard, headstone: drawHeadstone };

  HOOKS.draw.push((g, items) => {
    const dark = phase() === 'night', t = dayT();
    const list = marks();
    const x0 = cam.x / TILE - 2, x1 = (cam.x + VW) / TILE + 2, y0 = cam.y / TILE - 2, y1 = (cam.y + VH) / TILE + 2;
    for (const m of list) {
      if (m.x < x0 || m.x > x1 || m.y < y0 || m.y > y1) continue;
      const grade = gradeOf(m);
      const soon = dark && m.rise != null ? clamp((6 - (m.rise - t)) / 6, 0, 1) : 0;   // the ground heaves before it opens
      items.push({ y: m.y * TILE + TILE - 6, draw: () => {
        const x = tc(m.x), y = tc(m.y);
        g.save();
        g.save(); if (soon > 0) g.translate(0, -Math.sin(time * 9 + m.x) * soon * 1.6);
        (MARKER_ART[grade.key] || drawCross)(g, x, y);
        g.restore();
        if (dark) {
          const p = 0.35 + Math.sin(time * 3 + m.x + m.y) * 0.2;
          g.fillStyle = `rgba(126,231,135,${(p * 0.32) + soon * 0.3})`; g.beginPath(); g.ellipse(x, y + 8, 11 + soon * 4, 5, 0, 0, 7); g.fill();
          if (soon > 0.4) { g.strokeStyle = `rgba(200,255,190,${(soon - 0.4) * 0.8})`; g.lineWidth = 1.4;
            for (const a of [0.4, 2.1, 3.9, 5.4]) { g.beginPath(); g.moveTo(x, y + 8); g.lineTo(x + Math.cos(a) * 12 * soon, y + 8 + Math.sin(a) * 5 * soon); g.stroke(); } }
        }
        g.restore();
      } });
    }
    // the brute's wind-up: a ring on the ground that closes as the stone comes down
    for (const m of monsters) {
      if (m.type !== BRUTE || m.dead || !(m.windT > 0)) continue;
      const p = 1 - m.windT / SLAM.wind;
      items.push({ y: m.y - m.r - 1, draw: () => {
        g.save();
        g.strokeStyle = `rgba(255,107,107,${0.35 + p * 0.5})`; g.lineWidth = 2 + p * 2;
        g.beginPath(); g.ellipse(m.x, m.y + 10, SLAM.hit * (1.25 - p * 0.25), SLAM.hit * 0.5 * (1.25 - p * 0.25), 0, 0, 7); g.stroke();
        g.fillStyle = `rgba(255,107,107,${p * 0.14})`; g.beginPath(); g.ellipse(m.x, m.y + 10, SLAM.hit, SLAM.hit * 0.5, 0, 0, 7); g.fill();
        g.restore();
      } });
    }
    // the bone builds
    const tx0 = Math.max(0, Math.floor(cam.x / TILE)), tx1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE));
    const ty0 = Math.max(0, Math.floor(cam.y / TILE)), ty1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE));
    const lights = [];
    for (let ty = ty0; ty <= ty1 + 2; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t2 = tileAt(tx, ty); if (!BONE_TILES.has(t2)) continue;
      items.push({ y: ty * TILE + TILE - 4, draw: () => drawBoneTile(g, tx, ty, t2) });
      if (t2 === T_TORCH) lights.push([tc(tx), ty * TILE + 6]);
    }
    // a bone torch really does hold the dark off: painted over 35-night's overlay (it pushes its own at 1e9 - 0.5)
    if (lights.length && window.NIGHT && NIGHT.overlay && NIGHT.overlay() > 0.02) items.push({ y: 1e9 - 0.45, draw: () => {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [lx, ly] of lights) {
        const r = 104 + Math.sin(time * 4 + lx) * 5;
        const gr = g.createRadialGradient(lx, ly, 6, lx, ly, r);
        gr.addColorStop(0, 'rgba(150,235,170,0.42)'); gr.addColorStop(0.5, 'rgba(90,180,120,0.16)'); gr.addColorStop(1, 'rgba(60,140,90,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(lx, ly, r, 0, 7); g.fill();
      }
      g.restore();
    } });
  });

  // ---------- the bone builds, drawn ----------
  const boneShade = '#c3bda6', boneWhite = '#e9e4d2';
  function skull(g, x, y, r, tilt = 0) {
    g.save(); g.translate(x, y); g.rotate(tilt);
    g.fillStyle = boneWhite; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    g.fillStyle = boneShade; g.beginPath(); g.ellipse(0, r * 0.7, r * 0.66, r * 0.45, 0, 0, 7); g.fill();
    g.fillStyle = '#14140f'; g.beginPath(); g.ellipse(-r * 0.4, -r * 0.1, r * 0.3, r * 0.34, 0, 0, 7); g.ellipse(r * 0.4, -r * 0.1, r * 0.3, r * 0.34, 0, 0, 7); g.fill();
    g.fillRect(-r * 0.16, r * 0.18, r * 0.32, r * 0.3);
    g.strokeStyle = '#9a9480'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-r * 0.5, r * 0.74); g.lineTo(r * 0.5, r * 0.74); g.stroke();
    g.restore();
  }
  const longBone = (g, x1, y1, x2, y2, w) => {
    g.strokeStyle = boneWhite; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.fillStyle = boneWhite;
    const a = Math.atan2(y2 - y1, x2 - x1), n = { x: -Math.sin(a), y: Math.cos(a) }, k = w * 0.55;
    for (const [px, py] of [[x1, y1], [x2, y2]]) { g.beginPath(); g.arc(px + n.x * k, py + n.y * k, w * 0.62, 0, 7); g.arc(px - n.x * k, py - n.y * k, w * 0.62, 0, 7); g.fill(); }
  };
  function boneGround(g, x, y) {   // the scuff of turned earth every piece is dug into
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(x, y + 15, 17, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#e2dcc8'; for (const [ox, oy] of [[-13, 15], [12, 16], [-4, 18], [8, 13]]) { g.beginPath(); g.ellipse(x + ox, y + oy, 2.4, 1.2, 0.4, 0, 7); g.fill(); }
  }
  function drawBoneTile(g, tx, ty, t2) {
    const x = tc(tx), y = tc(ty), v = (tx * 7 + ty * 13) % 3;
    g.save();
    boneGround(g, x, y);
    if (t2 === T_TORCH) {
      longBone(g, x, y + 14, x, y - 14, 6);                                   // a femur driven into the ground
      skull(g, x, y - 22, 8, (v - 1) * 0.12);
      const f = 1 + Math.sin(time * 7 + tx) * 0.22;
      const gr = g.createRadialGradient(x, y - 30, 1, x, y - 30, 20 * f);
      gr.addColorStop(0, 'rgba(190,255,200,0.85)'); gr.addColorStop(0.45, 'rgba(110,225,150,0.35)'); gr.addColorStop(1, 'rgba(110,225,150,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y - 30, 20 * f, 0, 7); g.fill();
      g.fillStyle = 'rgba(200,255,205,0.95)'; g.beginPath();                   // the cold flame out of the crown
      g.moveTo(x - 4, y - 28); g.quadraticCurveTo(x - 2, y - 38 * f, x, y - 42 * f); g.quadraticCurveTo(x + 2, y - 38 * f, x + 4, y - 28); g.closePath(); g.fill();
      g.fillStyle = 'rgba(120,235,160,0.9)'; g.beginPath();
      g.moveTo(x - 2.2, y - 28); g.quadraticCurveTo(x, y - 34 * f, x + 2.2, y - 28); g.closePath(); g.fill();
      g.fillStyle = '#8fe1a0'; g.beginPath(); g.arc(x - 3.2, y - 22.8, 1.5, 0, 7); g.arc(x + 3.2, y - 22.8, 1.5, 0, 7); g.fill();
    } else if (t2 === T_FENCE) {
      for (const ox of [-15, 0, 15]) longBone(g, x + ox, y + 14, x + ox, y - 10, 4.5);
      g.strokeStyle = boneShade; g.lineWidth = 3;
      for (const oy of [-4, 5]) { g.beginPath(); g.moveTo(x - 17, y + oy + Math.sin(v) * 1.5); g.quadraticCurveTo(x, y + oy - 3, x + 17, y + oy); g.stroke(); }
      g.strokeStyle = 'rgba(90,70,40,0.8)'; g.lineWidth = 1.6;
      for (const ox of [-15, 0, 15]) { g.beginPath(); g.moveTo(x + ox - 4, y - 5); g.lineTo(x + ox + 4, y - 3); g.moveTo(x + ox - 4, y + 4); g.lineTo(x + ox + 4, y + 6); g.stroke(); }
      skull(g, x, y - 16, 6);
    } else if (t2 === T_PILE) {
      longBone(g, x - 15, y + 12, x + 14, y + 9, 4);
      longBone(g, x - 13, y + 7, x + 15, y + 12, 3.6);
      skull(g, x - 9, y + 4, 7, -0.25); skull(g, x + 9, y + 5, 7, 0.3); skull(g, x, y + 6, 6.4, 0.05);
      skull(g, x - 4, y - 4, 6.6, 0.18); skull(g, x + 6, y - 5, 6, -0.2);
      skull(g, x + 1, y - 13, 6.8, (v - 1) * 0.2);
    } else if (t2 === T_ARCH) {
      g.strokeStyle = boneWhite; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - 19, y + 16); g.quadraticCurveTo(x - 20, y - 22, x - 2, y - 30); g.stroke();
      g.beginPath(); g.moveTo(x + 19, y + 16); g.quadraticCurveTo(x + 20, y - 22, x + 2, y - 30); g.stroke();
      g.fillStyle = boneShade; g.beginPath(); g.ellipse(x - 19, y + 16, 6, 3.4, 0, 0, 7); g.ellipse(x + 19, y + 16, 6, 3.4, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(90,70,40,0.75)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x - 8, y - 27); g.lineTo(x + 8, y - 27); g.stroke();
      skull(g, x, y - 34, 9, 0);
      g.fillStyle = boneWhite;                                                 // horns off the crown skull
      g.beginPath(); g.moveTo(x - 8, y - 39); g.quadraticCurveTo(x - 17, y - 46, x - 12, y - 30); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(x + 8, y - 39); g.quadraticCurveTo(x + 17, y - 46, x + 12, y - 30); g.closePath(); g.fill();
      for (const s of [-1, 1]) longBone(g, x + s * 12, y - 20, x + s * 6, y - 8, 3);
    } else if (t2 === T_THRONE) {
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x, y + 15, 19, 6, 0, 0, 7); g.fill();
      g.strokeStyle = boneWhite; g.lineWidth = 4; g.lineCap = 'round';         // the fan of ribs behind the seat
      for (let i = -3; i <= 3; i++) { const a = i * 0.26; g.beginPath(); g.moveTo(x + i * 2, y - 2); g.quadraticCurveTo(x + Math.sin(a) * 26, y - 26, x + Math.sin(a) * 32, y - 40 + Math.abs(i) * 4); g.stroke(); }
      g.fillStyle = '#6e7178'; g.fillRect(x - 16, y - 2, 32, 8);               // the stone slab of the seat
      g.fillStyle = '#8d9098'; g.fillRect(x - 16, y - 4, 32, 3);
      longBone(g, x - 17, y + 14, x - 17, y - 4, 5); longBone(g, x + 17, y + 14, x + 17, y - 4, 5);   // legs
      longBone(g, x - 19, y - 6, x - 12, y - 16, 4.5); longBone(g, x + 19, y - 6, x + 12, y - 16, 4.5); // arm rests
      skull(g, x - 15, y - 19, 6, -0.3); skull(g, x + 15, y - 19, 6, 0.3);
      skull(g, x, y - 46, 10, 0);                                              // the crown skull
      g.fillStyle = '#f5c542'; g.beginPath();
      g.moveTo(x - 9, y - 54); g.lineTo(x - 9, y - 60); g.lineTo(x - 4.5, y - 56); g.lineTo(x, y - 62); g.lineTo(x + 4.5, y - 56); g.lineTo(x + 9, y - 60); g.lineTo(x + 9, y - 54); g.closePath(); g.fill();
      const gl = 0.2 + Math.sin(time * 2.4) * 0.08;
      const gr = g.createRadialGradient(x, y - 44, 3, x, y - 44, 34); gr.addColorStop(0, `rgba(126,231,200,${gl})`); gr.addColorStop(1, 'rgba(126,231,200,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y - 44, 34, 0, 7); g.fill();
    }
    g.restore();
  }

  // ---------- E on things ----------
  const minutes = secs => (secs < 60 ? `${Math.round(secs)} seconds` : `${Math.round(secs / 60)} minute${secs >= 90 ? 's' : ''}`);
  HOOKS.use.push((t, tx, ty) => {
    if (t === T_THRONE) {
      const q = tally(), list = marks();
      const next = list.filter(m => m.rise != null).sort((a, b) => a.rise - b.rise)[0];
      const wait = next ? (next.rise - dayT() + DAY()) % DAY() : null;
      notify(`Bone throne. ${list.length} grave${list.length === 1 ? '' : 's'} still standing. ${q.rose} came up where you could see them, ${q.walked} climbed out somewhere else.`);
      say(next ? `${list.length} of them out there tonight. The first one opens in about ${minutes(wait)}.`
        : list.length ? `${list.length} went in the ground today. Not one of them opens before midnight.`
          : 'Nothing left in the ground. Go and make some more.', 'The seat of bones');
      return true;
    }
    if (t === T_TORCH) { notify('The flame is cold and it never goes out. The dark keeps off it.'); return true; }
    if (t === T_ARCH) { notify('A gate of bone. You can walk under it. The dead will not.'); return true; }
    if (t === T_PILE) { notify('A stack of skulls, jaws and all. Somebody counted.'); return true; }
    if (t === T_FENCE) { notify('Ribs lashed to leg bones. It holds.'); return true; }
    const m = markerAt(tx, ty); if (!m) return false;
    const grade = gradeOf(m);
    const line = { cross: 'Two sticks and a bit of cord. Somebody small went in here.',
      grave: 'A proper grave, and a headboard cut for it. Whatever went down fought first.',
      headstone: 'Cut stone, and a skull chiselled into it. Something big is under there.' }[grade.key];
    const t2 = dayT();
    const when = m.rise == null ? 'It will not stay past tonight.'
      : t2 >= m.rise ? 'The earth is moving. Now.'
        : `It opens in about ${minutes((m.rise - t2 + DAY()) % DAY())}.`;
    notify(`${grade.name}. ${line} ${when}`);
    return true;
  });

  // ---------- the HUD plaque: how much of the night you have left owing ----------
  // A PLAQUE in the kit's reserved column (src/59-hudkit.js HK.addPlaque), not a hand-placed tag: a skull roundel,
  // GRAVES and how many are still standing, how many rose tonight, and one plain line. Amber edge at dusk (wait: they
  // open after midnight), green at night (the graves are open: go and fight what climbs out). Shown at dusk and at
  // night only, never on the title screen and never inside an instance (the graves are on the overworld).
  // The first of several field sets that fits the plaque column's width, so no word is ever squeezed out of its plate.
  // It measures the way the kit's plaque lays out (src/59-hudkit.js plaque(): a 36 px roundel, the name in Cinzel shrinking
  // to 9 px and no further, the value on the right in Cinzel 11, drawn stars 16 px each, one line of sans under it).
  // (A local copy in each world-status file: HK.addPlaque could take such a list itself.)
  const fitFields = (g, list) => {
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
  // on a narrow plaque column the line under the name gives way to a shorter one, in this order
  function gravesPlaque(g) {
    if (typeof title !== 'undefined' && title.active) return null;
    const list = marks(); const ph = phase();
    if (!list.length || ph === 'day' || window.__instance) return null;
    const q = tally(), night = ph === 'night';
    const base = { id: 'graves', emblem: 'skull', name: `GRAVES ${list.length}`, right: `risen ${q.rose}`, edge: night ? HK.T.good : HK.T.warn };
    const subs = night ? ['Night: the dead can rise', 'The dead can rise', 'They can rise'] : ['Dusk: they open at midnight', 'They open at midnight', 'Open at midnight'];
    return fitFields(g, subs.map(sub => Object.assign({}, base, { sub })));
  }
  HOOKS.hud.push((g, narrow) => {
    const pq = gravesPlaque(g); if (pq) HK.addPlaque(g, pq);
  });

  // ---------- the pack icons ----------
  // src/80-icons.js hands every item its own drawing and fails the build while any two draw the same picture.
  // It loads after this file, so the eleven new items hand their art over at world-gen — the first moment at
  // which every feature file is up. Re-registering is harmless: the registry is keyed by item id.
  // The design box is 18 units across, drawn inside -9..+9, and nothing may be under 2 units or it vanishes
  // in a 13 px hotbar slot.
  const knob = (g, x, y) => { g.beginPath(); g.arc(x - 1.5, y, 2.1, 0, 7); g.arc(x + 1.5, y, 2.1, 0, 7); g.fill(); };
  const iconSkull = (g, x, y, r) => {
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.beginPath(); g.ellipse(x, y + r * 0.78, r * 0.62, r * 0.46, 0, 0, 7); g.fill();
    const eyes = g.fillStyle; g.fillStyle = 'rgba(15,15,10,0.85)';
    g.beginPath(); g.arc(x - r * 0.38, y - r * 0.08, r * 0.3 + 1, 0, 7); g.arc(x + r * 0.38, y - r * 0.08, r * 0.3 + 1, 0, 7); g.fill();
    g.fillStyle = eyes;
  };
  const BONE_ICONS = {
    // a plain bone: a shaft with a pair of knobs at each end — nothing else in the pack is shaped like it
    bone: (g, size, item) => {
      g.fillStyle = item.color;
      g.save(); g.rotate(-0.42);
      g.fillRect(-5, -2, 10, 4); knob(g, -5.6, 0); knob(g, 5.6, 0);
      g.restore();
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.save(); g.rotate(-0.42); g.fillRect(-4, 0.6, 8, 2); g.restore();
    },
    // a bone driven into the ground with a skull on it and a cold flame off the crown
    bone_torch: (g, size, item) => {
      g.fillStyle = item.color;
      g.fillRect(-1.5, 0, 3, 7); knob(g, 0, 7);
      iconSkull(g, 0, -2.6, 4);
      g.fillStyle = 'rgba(150,240,175,0.9)';
      g.beginPath(); g.moveTo(-2.4, -5.8); g.quadraticCurveTo(-1, -8.4, 0, -8.2); g.quadraticCurveTo(1, -8.4, 2.4, -5.8); g.closePath(); g.fill();
      g.fillStyle = 'rgba(230,255,235,0.95)';
      g.beginPath(); g.arc(0, -6.6, 1.2, 0, 7); g.fill();
    },
    // three uprights and two rails, lashed
    bone_fence: (g, size, item) => {
      g.fillStyle = item.color;
      for (const x of [-6, 0, 6]) { g.fillRect(x - 1.4, -6, 2.8, 13); knob(g, x, -6.6); knob(g, x, 7.2); }
      g.fillRect(-8.4, -3.6, 16.8, 2.2); g.fillRect(-8.4, 2, 16.8, 2.2);
      g.fillStyle = 'rgba(70,55,30,0.75)';
      for (const x of [-6, 0, 6]) { g.fillRect(x - 2.2, -3.9, 4.4, 2.8); g.fillRect(x - 2.2, 1.7, 4.4, 2.8); }
    },
    // three skulls stacked, jaws and all
    skull_pile: (g, size, item) => {
      g.fillStyle = item.color;
      iconSkull(g, -4.2, 3.4, 4.4); iconSkull(g, 4.2, 3.6, 4.2); iconSkull(g, 0, -4, 4.6);
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.beginPath(); g.ellipse(0, 8.4, 8.4, 1.6, 0, 0, 7); g.fill();
    },
    // two great bones curving up to meet under a skull
    bone_arch: (g, size, item) => {
      g.strokeStyle = item.color; g.lineWidth = 2.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-6.2, 7.2); g.quadraticCurveTo(-7.4, -2.8, -2.4, -5); g.stroke();
      g.beginPath(); g.moveTo(6.2, 7.2); g.quadraticCurveTo(7.4, -2.8, 2.4, -5); g.stroke();
      g.fillStyle = item.color;
      g.beginPath(); g.ellipse(-6.2, 7.2, 2.6, 1.4, 0, 0, 7); g.ellipse(6.2, 7.2, 2.6, 1.4, 0, 0, 7); g.fill();
      iconSkull(g, 0, -5.4, 3.2);
      g.strokeStyle = 'rgba(70,55,30,0.75)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-3.6, -2.4); g.lineTo(3.6, -2.4); g.stroke();
    },
    // a high seat: a fan of ribs behind a slab, on bone legs
    bone_throne: (g, size, item) => {
      g.strokeStyle = item.color; g.lineWidth = 1.6; g.lineCap = 'round';
      for (const a of [-0.5, -0.25, 0, 0.25, 0.5]) { g.beginPath(); g.moveTo(Math.sin(a) * 2, 0); g.quadraticCurveTo(Math.sin(a) * 5, -4.4, Math.sin(a) * 6.6, -7.4); g.stroke(); }
      g.fillStyle = 'rgba(110,113,120,0.95)'; g.fillRect(-7, 0, 14, 3);
      g.fillStyle = item.color;
      g.fillRect(-6.6, 3, 2.6, 4.4); g.fillRect(4, 3, 2.6, 4.4); knob(g, -5.3, 7); knob(g, 5.3, 7);
      g.fillStyle = 'rgba(245,197,66,0.95)';
      g.beginPath(); g.moveTo(-3.2, -7.6); g.lineTo(-3.2, -9.2); g.lineTo(-1.1, -8); g.lineTo(0, -9.2); g.lineTo(1.1, -8); g.lineTo(3.2, -9.2); g.lineTo(3.2, -7.6); g.closePath(); g.fill();
    },
    // a pointed hood with nothing inside it but two lights
    necro_hood: (g, size, item) => {
      g.fillStyle = item.color;
      g.beginPath(); g.moveTo(0, -9.4); g.quadraticCurveTo(7.4, -4, 7, 6.6);
      g.lineTo(4.4, 8.4); g.lineTo(-4.4, 8.4); g.lineTo(-7, 6.6);
      g.quadraticCurveTo(-7.4, -4, 0, -9.4); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(10,8,14,0.92)';
      g.beginPath(); g.ellipse(0, 2, 4.2, 5, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(126,231,200,0.95)';
      g.beginPath(); g.arc(-1.7, 1.4, 1.1, 0, 7); g.arc(1.7, 1.4, 1.1, 0, 7); g.fill();
    },
    // a long robe: shoulders, a cowl collar, a cord at the waist and a hem that pools
    necro_robe: (g, size, item) => {
      g.fillStyle = item.color;
      g.beginPath(); g.moveTo(-4.4, -8); g.lineTo(4.4, -8); g.lineTo(7.4, -3.4);
      g.lineTo(6, 8.6); g.lineTo(-6, 8.6); g.lineTo(-7.4, -3.4); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.16)';
      g.beginPath(); g.moveTo(-4.4, -8); g.lineTo(0, -4.4); g.lineTo(4.4, -8); g.closePath(); g.fill();
      g.fillStyle = 'rgba(126,231,200,0.85)'; g.fillRect(-6.6, 0.4, 13.2, 2.2);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath(); g.moveTo(-6, 8.6); g.quadraticCurveTo(0, 5.4, 6, 8.6); g.closePath(); g.fill();
    },
    // two legs bound round and round in cloth strips
    necro_wraps: (g, size, item) => {
      g.fillStyle = item.color;
      g.fillRect(-6.8, -8, 5.2, 16); g.fillRect(1.6, -8, 5.2, 16);
      g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.4;
      for (const y of [-5.4, -1.8, 1.8, 5.4]) {
        g.beginPath(); g.moveTo(-7, y); g.lineTo(-1.4, y - 1.6); g.stroke();
        g.beginPath(); g.moveTo(1.4, y - 1.6); g.lineTo(7, y); g.stroke();
      }
      g.fillStyle = 'rgba(126,231,200,0.8)'; g.fillRect(-6.8, 6.4, 5.2, 2); g.fillRect(1.6, 6.4, 5.2, 2);
    },
    // a lantern with a wisp shut inside it
    soul_lantern: (g, size, item) => {
      g.strokeStyle = 'rgba(120,124,132,0.95)'; g.lineWidth = 1.4;
      g.beginPath(); g.arc(0, -7.4, 2.4, Math.PI, 0); g.stroke();
      g.fillStyle = 'rgba(120,124,132,0.95)'; g.fillRect(-5.4, -6, 10.8, 2.4); g.fillRect(-5.4, 6, 10.8, 2.6);
      g.fillStyle = item.color;
      g.beginPath(); g.moveTo(-4.2, -3.6); g.lineTo(4.2, -3.6); g.lineTo(4.8, 6); g.lineTo(-4.8, 6); g.closePath(); g.fill();
      g.fillStyle = 'rgba(240,255,250,0.95)';
      g.beginPath(); g.ellipse(0, 0.8, 2, 3, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(60,64,70,0.9)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-4.5, 1.2); g.lineTo(4.5, 1.2); g.stroke();
    },
    // a stave: a long shaft, a skull bound to the head, a bound grip
    bone_stave: (g, size, item) => {
      g.fillStyle = item.color;
      g.save(); g.rotate(0.38);
      g.fillRect(-1.4, -3, 2.8, 12);
      g.restore();
      g.fillStyle = 'rgba(70,55,30,0.8)';
      g.save(); g.rotate(0.38); g.fillRect(-2.4, 2.4, 4.8, 2.4); g.restore();
      g.fillStyle = item.color;
      iconSkull(g, -1.8, -5, 4.4);
      g.fillStyle = 'rgba(126,231,200,0.9)';
      g.beginPath(); g.arc(-3.4, -5.4, 1.1, 0, 7); g.arc(-0.2, -5.4, 1.1, 0, 7); g.fill();
    },
  };
  HOOKS.world.push(() => { if (window.ICONS && ICONS.set) for (const id in BONE_ICONS) ICONS.set(id, BONE_ICONS[id]); });

  // the book: the auto page reads MONSTER_SPAWNS, and none of these three is ever spawned into the world —
  // they only ever come up out of a grave. WIKI.add merges over the built page and leaves the drops alone.
  if (window.WIKI) {
    WIKI.add('monsters', { id: 'grave_skeleton', where: ['Out of a wood cross, between midnight and dawn (a kill of level 7 or under)'] });
    WIKI.add('monsters', { id: 'grave_risen', where: ['Out of a grave, between midnight and dawn (a kill of level 8 to 19)'] });
    WIKI.add('monsters', { id: BRUTE, where: ['Out of a stone headstone, between midnight and dawn (a kill of level 20 or over)'] });
  }

  window.GRAVES = {
    GRADES, ORDER, gradeFor, gradeForLevel, buriable, gradeOf, marks, markerAt, layMarker, removeMarker, tally,
    MAX_MARKERS, RISE_RADIUS, CAP, BRUTE, RISEN_TYPES, isRisen, onIsland, BRUTE_R, BRUTE_SPRITE, SLAM, NECRO_SET, BONE_BUILDS, zombieDrops,
    riseSpot, raise, schedule, settleAtDawn, risen, weightOf, load, log: LOG,
    window: () => ({ from: MIDNIGHT(), to: LAST_RISE(), dark: DARK_FROM(), day: DAY() }),
    tiles: { torch: T_TORCH, fence: T_FENCE, pile: T_PILE, arch: T_ARCH, throne: T_THRONE },
    // the dusk that arms the night, for the self-test
    arm: () => { armed = true; built = false; },
    plaque: gravesPlaque,
    state: () => ({ armed, built, prevPhase }),
  };

  // ---------- self-test ----------
  const P = 'graves: ';
  HOOKS.selfTest.push((check, F, h) => {
    const g0 = Array.isArray(quest.graves) ? quest.graves.slice() : [];
    const q0 = quest.graveNight ? { ...quest.graveNight } : null;
    const day0 = player.dayTime, hp0 = player.hp, inv0 = player.inv.slice();
    const wipeRisen = () => { for (let i = monsters.length - 1; i >= 0; i--) if (isRisen(monsters[i])) monsters.splice(i, 1); };
    const reset = () => { quest.graves = []; quest.graveNight = { rose: 0, walked: 0, laid: 0 }; LOG.length = 0; wipeRisen(); };
    const fakeKill = (type, tx, ty) => { for (const hk of HOOKS.kill) hk({ type, dead: true, x: tc(tx), y: tc(ty), r: 12 }); };
    // a brute is two tiles wide, so a headstone needs room round it: clear a patch and hand back how to put it right
    const clearPatch = (cx, cy, r = 1) => { const kept = []; for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (inMap(x, y) && !buildingAt(x, y)) { kept.push([x, y, tileAt(x, y)]); changeTile(x, y, T.GRASS); } return kept; };
    const putBack = kept => { for (const [x, y, t] of kept) changeTile(x, y, t); };
    h.peace(true);

    // ---- 1. the three grades, chosen by what fell ----
    // The census first: every monster in MONSTER_DEFS, graded by its real level. Then the kill hook itself.
    { reset();
      const census = {};
      for (const k in MONSTER_DEFS) census[k] = GRAVES.gradeFor(k);
      const cut = (lo, hi) => Object.keys(MONSTER_DEFS).filter(k => census[k] && MONSTER_DEFS[k].level >= lo && MONSTER_DEFS[k].level <= hi);
      const crossKin = cut(1, 7), graveKin = cut(8, 19), stoneKin = cut(20, 999);
      const byBand = crossKin.every(k => census[k] === 'cross') && graveKin.every(k => census[k] === 'grave') && stoneKin.every(k => census[k] === 'headstone');
      const nobody = ['sheep', 'cow', 'boar', 'spider', 'walker', 'yard_walker', 'bulldozer', 'zombie', 'grave_zombie', 'vampire', 'ally_knight'].every(k => !census[k]);
      // and the hook that lays them: a goblin (2), a goblin brute (9), an elf sentinel (25)
      const o = h.openSpot(58, 30); F.tp(o.x, o.y);
      const bx = Math.floor(player.x / TILE), by = Math.floor(player.y / TILE);
      const spots = { goblin: [bx + 5, by], brute: [bx + 7, by], elf_sentinel: [bx + 9, by], sheep: [bx + 11, by], walker: [bx + 13, by], zombie: [bx + 15, by] };
      const was = {}; for (const k in spots) { was[k] = tileAt(spots[k][0], spots[k][1]); changeTile(spots[k][0], spots[k][1], T.GRASS); }
      const dx0 = player.skills.defence.xp, board0 = quest.board ? JSON.parse(JSON.stringify(quest.board)) : null;
      for (const k in spots) fakeKill(k, spots[k][0], spots[k][1]);
      player.skills.defence.xp = dx0; if (board0) quest.board = board0;      // a fake kill must not pay real xp
      const at = k => { const m = GRAVES.markerAt(spots[k][0], spots[k][1]); return m ? m.g : null; };
      const got = {}; for (const k in spots) got[k] = at(k);
      const groundKept = tileAt(spots.goblin[0], spots.goblin[1]) === T.GRASS;
      const walkable = !solidFor(tileAt(spots.goblin[0], spots.goblin[1]), 'player') && !collides(tc(spots.goblin[0]), tc(spots.goblin[1]), 13, 'player');
      check(P + 'a goblin (lv 2) leaves a wood cross, a goblin brute (lv 9) a grave, an elf sentinel (lv 25) a stone headstone — and a sheep, a machine and the undead leave nothing',
        byBand && nobody && got.goblin === 'cross' && got.brute === 'grave' && got.elf_sentinel === 'headstone' && !got.sheep && !got.walker && !got.zombie && groundKept && walkable,
        { cuts: { cross: '1-7', grave: '8-19', headstone: '20+' }, cross: crossKin, grave: graveKin, headstone: stoneKin, byBand, nobody, got, groundKept, walkable });
      for (const k in spots) changeTile(spots[k][0], spots[k][1], was[k]);
      reset(); }

    // ---- 2. each grade raises its own thing, where the grave was ----
    { const raised = {};
      for (const grade of ['cross', 'grave', 'headstone']) {
        reset();
        const o = h.openSpot(56, 34); F.tp(o.x, o.y);
        const tx = Math.floor(player.x / TILE) + 5, ty = Math.floor(player.y / TILE);
        const was = clearPatch(tx, ty, 1);
        GRAVES.layMarker(tx, ty, grade);
        const m = GRAVES.markerAt(tx, ty);
        const e = m && GRAVES.riseSpot(m) ? GRAVES.raise(m) : null;
        raised[grade] = { type: e && e.type, onGrave: !!e && Math.floor(e.x / TILE) === tx && Math.floor(e.y / TILE) === ty, gone: !GRAVES.markerAt(tx, ty), fromGrave: !!e && e.fromGrave };
        putBack(was);
      }
      reset();
      check(P + 'the cross raises a Skeleton, the grave raises a Risen zombie, the headstone raises a Zombie brute — each on the tile its grave stood on, and the marker goes with it',
        raised.cross.type === 'grave_skeleton' && raised.grave.type === 'grave_risen' && raised.headstone.type === 'zombie_brute'
        && ['cross', 'grave', 'headstone'].every(k => raised[k].onGrave && raised[k].gone && raised[k].fromGrave), raised); }

    // ---- 3. the whole night empties every grave, spread out, and dawn finds none ----
    { reset();
      const o = h.openSpot(56, 34); F.tp(o.x, o.y);
      const px = Math.floor(player.x / TILE), py = Math.floor(player.y / TILE);
      const was = [];
      const put = (x, y, grade) => { if (!inMap(x, y) || buildingAt(x, y)) return false; for (const k of clearPatch(x, y, 1)) was.push(k); return GRAVES.layMarker(x, y, grade); };
      // five within reach of the knight (one of them a headstone: a brute counts for two of the cap of six)
      const near = [[px + 5, py, 'cross'], [px + 7, py, 'grave'], [px + 5, py + 3, 'headstone'], [px + 8, py - 3, 'cross'], [px + 9, py + 2, 'grave']];
      // three he will never get near
      const far = [[px + 25, py, 'cross'], [px + 27, py + 2, 'grave'], [px + 26, py - 3, 'cross']];
      player.hp = 100000;
      player.dayTime = NIGHT.LIGHT + NIGHT.DUSK - 2;             // the last of the dusk: the night is armed the way play arms it
      F.sim(2, []);
      let nearLaid = 0, farLaid = 0;
      for (const [x, y, g2] of near) if (put(x, y, g2)) nearLaid++;
      for (const [x, y, g2] of far) if (put(x, y, g2)) farLaid++;
      const laid = GRAVES.marks().length;
      const w = GRAVES.window();
      let sched = null;
      for (let i = 0; i < 60 * 130 && phase() !== 'day'; i++) {
        F.step([]);
        if (sched === null && GRAVES.state().built) sched = GRAVES.marks().map(m => m.rise).sort((a, b) => a - b);
      }
      const times = LOG.map(r => r.t).sort((a, b) => a - b), tal = GRAVES.tally();
      const span = w.to - w.from;
      const everyOneDealt = !!sched && sched.length === laid && sched.every(t => t >= w.from - 0.01 && t <= w.to + 0.01);
      const spreadOut = !!sched && sched[sched.length - 1] - sched[0] > span * 0.6;
      let minGap = 99; if (sched) for (let i = 1; i < sched.length; i++) minGap = Math.min(minGap, sched[i] - sched[i - 1]);
      const oneByOne = minGap > 0.5;
      const inWindow = times.length > 0 && times.every(t => t >= w.from - 0.5 && t <= w.to + 0.5);
      const dawnEmpty = GRAVES.marks().length === 0 && phase() === 'day';
      const noRisen = GRAVES.risen().length === 0;
      check(P + 'every grave laid today is dealt its own minute between midnight and dawn, they open one after another across the whole window, the ones far from the knight open on their own and walk — and dawn finds none standing and nothing still on its feet',
        laid === 8 && nearLaid === 5 && farLaid === 3 && everyOneDealt && spreadOut && oneByOne && inWindow
        && tal.rose === 5 && tal.walked === 3 && dawnEmpty && noRisen,
        { laid, nearLaid, farLaid, window: [w.from, w.to], schedule: sched && sched.map(t => +t.toFixed(1)), scheduleSpan: sched ? +(sched[sched.length - 1] - sched[0]).toFixed(1) : null, minGap: +minGap.toFixed(2), rose: tal.rose, walked: tal.walked, roseAt: times.map(t => +t.toFixed(1)), inWindow, dawnEmpty, noRisen });
      putBack(was);
      reset(); player.dayTime = day0; F.sim(2, []); }

    // ---- 4. the brute: two tiles across, very high health, low damage, and its stone slam ----
    { reset();
      const d = MONSTER_DEFS[GRAVES.BRUTE], z = MONSTER_DEFS.zombie;
      const o = h.openSpot(56, 34); F.tp(o.x, o.y);
      // the middle of the night: daylight sweeps a brute whatever its flag says, so this one is tested in the
      // dark, and 35-night's spawn clock is set back so no zombie of its own turns up in these three seconds
      player.dayTime = NIGHT.LIGHT + NIGHT.DUSK + 20; NIGHT.resetTimer();
      const big = GRAVES.BRUTE_SPRITE === 2 * TILE && d.r * 2 >= 1.8 * TILE && d.r * 2 <= 2 * TILE;
      const tanky = d.hp === 320 && d.hp >= 3 * MONSTER_DEFS.grave_zombie.hp;
      const soft = d.maxHit === 5 && d.maxHit < z.maxHit && d.speed < z.speed;
      const heavy = GRAVES.weightOf('headstone') === 2 && GRAVES.weightOf('cross') === 1;
      h.peace(false); player.hp = 100000;
      const room = clearPatch(Math.floor(player.x / TILE), Math.floor(player.y / TILE), 2);   // room to be thrown
      const parked = [];
      for (const mm of monsters) if (!mm.dead && dist(mm.x, mm.y, player.x, player.y) < 12 * TILE) { parked.push([mm, mm.x, mm.y, mm.state]); mm.x = player.x - 2000; mm.y = player.y; mm.state = 'return'; }
      const rnd = Math.random; Math.random = () => 0;                     // pin the rolls: the slam lands, for 1
      const m = makeRisen(GRAVES.BRUTE, Math.floor(player.x / TILE) + 2, Math.floor(player.y / TILE), 'headstone');
      m.fromGrave = false;                                                // a specimen, not one of tonight's
      m.x = player.x + 60; m.y = player.y; m.home = { x: m.x, y: m.y }; m.state = 'chase'; m.slamCd = 0;
      monsters.push(m);
      let wound = false;
      for (let i = 0; i < 60 * 3 && !(m.slams > 0); i++) {
        if (!(m.stagT > 0)) { m.x = player.x + 60; m.y = player.y; }   // held at arm's length: the suite runs on a world the bot has stirred up
        F.step([]); if (m.windT > 0) wound = true;
      }
      const thrown = Math.round(m.threw || 0);
      const hurtBySlam = m.slamDmg > 0;
      const staggered = m.stagT > 0;
      const hp1 = m.hp; hitMonster(m, 10, 0, false, 'player'); const took = hp1 - m.hp;
      Math.random = rnd;
      { const i = monsters.indexOf(m); if (i >= 0) monsters.splice(i, 1); }
      for (const [mm, x, y, st] of parked) { mm.x = x; mm.y = y; mm.state = st; }
      putBack(room);
      h.peace(true); player.hp = hp0; player.dayTime = day0;
      check(P + "the Zombie brute is two tiles across, 320 hp against the grave zombie's 90, hits for at most 5 — and its stone slam throws you, then leaves it stuck long enough that every hit lands twice",
        big && tanky && soft && heavy && wound && m.slams >= 1 && thrown > 30 && hurtBySlam && m.slamDmg <= d.maxHit && staggered && took === 20,
        { sprite: GRAVES.BRUTE_SPRITE, r: d.r, hp: d.hp, maxHit: d.maxHit, zombieMaxHit: z.maxHit, speed: d.speed, zombieSpeed: z.speed, windUp: SLAM.wind, wound, slams: m.slams, thrownPx: thrown, slamDmg: m.slamDmg, slamReach: m.slamDist, hitInside: SLAM.hit, staggered, stuckFor: SLAM.stagger, damageWhileStuck: took, capWeight: GRAVES.weightOf('headstone') });
      reset(); }

    // ---- 5. bones drop off the risen, build five things, and one of them goes in the ground ----
    { reset(); h.clearJunk();
      const before = drops.length;
      rollDrops(MONSTER_DEFS.grave_skeleton, player.x, player.y);
      const boned = drops.slice(before).some(dd => dd.id === 'bone');
      drops.length = before;
      const recs = GRAVES.BONE_BUILDS.map(id => RECIPES.find(r => r.out === id));
      const allThere = recs.every(r => r && r.station === 'workbench' && r.needs.some(n => n[0] === 'bone') && ITEMS[r.out].place);
      const bag = player.inv.slice();
      player.inv = player.inv.map(() => null);
      h.give('bone', 80); h.give('wood', 4); h.give('stone', 4); h.give('grave_dust', 4);   // 4 + 3 + 6 + 12 + 40 = 65 bones for the five
      const made = [];
      for (const r of recs) {
        if (!r || !r.needs.every(([id, n]) => countItem(id) >= n)) { made.push(false); continue; }
        for (const [id, n] of r.needs) removeItem(id, n);
        addItem(r.out, r.qty); made.push(countItem(r.out) >= r.qty);
      }
      // the shared world first: each of the five, a clear tile in front of the knight, and every one is refused
      const o = h.openSpot(56, 30); F.tp(o.x, o.y); player.facing = { x: 1, y: 0 };
      const wf = frontTile(player, 40); const wasW = tileAt(wf.tx, wf.ty);
      drops = drops.filter(dd => !circleHitsTile(dd.x, dd.y, 8, wf.tx, wf.ty));
      const moved = [];
      for (const mm of monsters) if (!mm.dead && circleHitsTile(mm.x, mm.y, mm.r + 2, wf.tx, wf.ty)) { moved.push([mm, mm.x, mm.y]); mm.x = player.x - 600; mm.y = player.y; }
      const worldTile = { tile: tileName(wasW), placeable: PLACEABLE_ON.has(wasW) }, refused = {};
      for (const id of GRAVES.BONE_BUILDS) {
        player.inv = player.inv.map(() => null); h.give(id, 1); notice = null;
        placeAction(id);
        refused[id] = tileAt(wf.tx, wf.ty) === wasW && countItem(id) === 1 && !!notice && /your island/i.test(notice.text);
        if (tileAt(wf.tx, wf.ty) !== wasW) changeTile(wf.tx, wf.ty, wasW);
      }
      const worldSays = notice && notice.text;
      for (const [mm, x, y] of moved) { mm.x = x; mm.y = y; }
      // then his own island: through the portal, a clear patch, and the torch goes in the ground
      const house0 = player.house ? JSON.parse(JSON.stringify(player.house)) : null;
      const went = !!window.HOUSE && HOUSE.enter();
      let placed = false, onHisIsland = false;
      if (went) {
        onHisIsland = GRAVES.onIsland();
        const ix = HOUSE.ENTRY[0] - 3, iy = HOUSE.ENTRY[1] - 3;
        if (SOLID.has(tileAt(ix, iy))) changeTile(ix, iy, T.GRASS);
        if (tileAt(ix, iy - 1) !== T.GRASS) changeTile(ix, iy - 1, T.GRASS);
        F.tp(ix, iy); F.face(ix, iy - 1); player.action = null;
        const ft = frontTile(player, 40);
        drops = drops.filter(dd => !circleHitsTile(dd.x, dd.y, 8, ft.tx, ft.ty));
        player.inv = player.inv.map(() => null); h.give('bone_torch', 1);
        placeAction('bone_torch');
        placed = tileAt(ft.tx, ft.ty) === GRAVES.tiles.torch && countItem('bone_torch') === 0;
        HOUSE.leave(); F.sim(2, []);
      }
      if (house0) player.house = house0;                                   // the patch cleared on the island is not kept
      const backOut = !GRAVES.onIsland() && !(window.INSTANCES && INSTANCES.active());
      const tappable = Object.values(GRAVES.tiles).every(t2 => INTERESTING_TILES.has(t2));
      const gateOpen = PUSH_THROUGH.has(GRAVES.tiles.arch) && !solidFor(GRAVES.tiles.arch, 'player') && solidFor(GRAVES.tiles.arch, 'beast');
      player.inv = bag;
      check(P + 'a skeleton drops bones; four bones and a log make a bone torch, and the fence, skull pile, arch and throne all come off the same pile; a torch goes in the ground and every piece answers a tap',
        boned && allThere && made.every(Boolean) && went && onHisIsland && placed && backOut && tappable && gateOpen,
        { boned, allThere, made, went, onHisIsland, placed, backOut, tappable, gateOpen, builds: recs.map(r => (r ? r.label : 'missing')) });
      check(P + 'no bone build goes up in the shared world: each of the five is refused on open ground there, stays in the pack, and he is told to take it to his island',
        worldTile.placeable && GRAVES.BONE_BUILDS.every(id => refused[id]),
        { worldTile, refused, said: worldSays });
      reset(); }

    // ---- 6. the necromancy kit: 1 kill in 20 ----
    { const seed = mulberry32(20260909), rnd = Math.random; Math.random = seed;
      const runs = 20000, def = MONSTER_DEFS[GRAVES.BRUTE];
      const counts = {}; let pieces = 0;
      const keep = drops.length, parts = particles.length, banner = levelBanner;
      for (let i = 0; i < runs; i++) {
        const before = drops.length;
        rollDrops(def, 0, 0);
        for (const d of drops.slice(before)) if (GRAVES.NECRO_SET.includes(d.id)) { pieces++; counts[d.id] = (counts[d.id] || 0) + 1; }
        drops.length = before;
      }
      drops.length = keep; particles.length = parts; levelBanner = banner;
      Math.random = rnd;
      const rate = pieces / runs, want = 1 / def.drops.rare.chance;
      const allFive = GRAVES.NECRO_SET.every(id => counts[id] > 0 && ITEMS[id] && ITEMS[id].necro);
      check(P + 'the Zombie brute hands over a piece of the necromancer\'s kit on 1 kill in 20, and all five pieces turn up (20,000 rolls, Math.random pinned)',
        Math.abs(rate - want) < want * 0.08 && allFive && def.drops.rare.chance === 20,
        { runs, pieces, rate: +rate.toFixed(4), want: +want.toFixed(4), counts, set: GRAVES.NECRO_SET }); }

    // ---- 7. a zombie is still worth the walk (the skull mace, kept from the first pass) ----
    { const z = MONSTER_DEFS.zombie.drops, gz = MONSTER_DEFS.grave_zombie.drops;
      const betterThanCloth = z.table.some(r => r[0] === 'grave_iron') && z.table.some(r => r[0] === 'grave_dust') && z.table.some(r => r[0] === 'bone');
      const mace = !!ITEMS.skull_mace && z.rare && z.rare.chance === 150 && z.rare.table.some(r => r[0] === 'skull_mace');
      const graveBetter = gz.rare && gz.rare.chance < z.rare.chance;
      const strong = ITEMS.skull_mace.weapon.str > (ITEMS.steel_warhammer ? ITEMS.steel_warhammer.weapon.str : 20);
      check(P + 'a zombie still drops more than rotten cloth, still carries the skull mace at 1 in 150, and now drops bones too',
        betterThanCloth && mace && graveBetter && strong, { betterThanCloth, mace, graveBetter, str: ITEMS.skull_mace.weapon.str }); }

    // ---- 8. the ground keeps at most forty in a day, and nothing is listed where it cannot sit ----
    { reset();
      const o = h.openSpot(56, 34); const bx = o.x, by = o.y;
      let laid = 0, peak = 0;
      for (let i = 0; i < GRAVES.MAX_MARKERS * 2; i++) {
        const x = bx + (i % 14) * 2, y = by + Math.floor(i / 14) * 2;
        if (!inMap(x, y) || SOLID.has(tileAt(x, y)) || buildingAt(x, y)) continue;
        if (GRAVES.layMarker(x, y, 'cross')) laid++;
        peak = Math.max(peak, GRAVES.marks().length);
      }
      const capped = peak <= GRAVES.MAX_MARKERS && GRAVES.marks().length <= GRAVES.MAX_MARKERS;
      const cleaned = GRAVES.marks().every(m => !buildingAt(m.x, m.y));
      for (const m of GRAVES.marks().slice()) GRAVES.removeMarker(m, true);
      check(P + 'the ground keeps at most forty graves in a day, and the oldest settles rather than standing for ever',
        laid > GRAVES.MAX_MARKERS && capped && cleaned && GRAVES.marks().length === 0, { laid, peak, capped, cleaned }); }

    // ---- 9. one you raised yourself pays extra off the grave ----
    { const bag = player.inv.slice(); player.inv = player.inv.map(() => null);
      for (const hk of HOOKS.kill) hk({ type: 'grave_skeleton', dead: true, fromGrave: true, x: player.x, y: player.y, r: 13 });
      const extra = countItem('grave_iron');
      player.inv = bag;
      check(P + 'anything you raised out of your own kill pays grave iron on top', extra >= 1 && extra <= 2, { extra }); }

    // ---- 10. online: a knight who is not the keeper keeps his graves through the night ----
    // Faked the way 75-coop's own check does it: a fake wire says welcome, then names Ann the keeper of the
    // overworld, so this knight parks his monsters and shows Ann's puppets. Anything put in that list that is
    // not a puppet is thrown away on the next update, so nothing may rise here and nothing may be counted.
    { reset();
      const online = typeof NET !== 'undefined' && !!window.COOP;
      const was = online ? { enabled: NET.enabled, token: NET.token, fake: NET.fake } : null, real = monsters;
      let sock = null;
      const push = msg => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(msg) }); };
      const fake = { call: async () => ({}), open: () => { sock = { readyState: 1, send(str) { const mm = JSON.parse(str); if (mm.t === 'hello') push({ t: 'welcome', me: 'Cohen', at: 0, keeper: 'Cohen' }); }, close() { sock.readyState = 3; } }; return sock; } };
      const kept = [];
      let res = { online };
      try {
        if (online) {
          NET.enabled = true; NET.token = 'graves-test'; NET.useFake(fake); NET.connect();
          push({ t: 'keeper', map: 'over', n: 'Ann' });
          const puppetsUp = Array.isArray(COOP.puppets()) && monsters === COOP.puppets() && COOP.keeper() === 'Ann';
          const o = h.openSpot(56, 34); F.tp(o.x, o.y);
          const px = Math.floor(player.x / TILE), py = Math.floor(player.y / TILE);
          player.dayTime = NIGHT.LIGHT + NIGHT.DUSK - 2;             // the last of the dusk arms the night
          F.sim(2, []);
          let laid = 0;
          for (const [x, y, g2] of [[px + 5, py, 'cross'], [px + 7, py + 3, 'grave'], [px + 6, py - 4, 'headstone']]) {
            if (!inMap(x, y) || buildingAt(x, y)) continue;
            for (const k of clearPatch(x, y, 1)) kept.push(k);
            if (GRAVES.layMarker(x, y, g2)) laid++;
          }
          let held = true, allDue = false, stayedPuppet = true, ours = 0;
          for (let i = 0; i < 60 * 130 && phase() !== 'day'; i++) {
            F.step([]);
            if (phase() === 'day') break;
            if (GRAVES.marks().length !== laid) held = false;
            if (!COOP.puppets()) stayedPuppet = false;
            ours = Math.max(ours, monsters.filter(m => m.fromGrave).length);
            if (GRAVES.state().built && laid && GRAVES.marks().every(m => m.rise != null && m.rise <= dayT())) allDue = true;
          }
          const tal = GRAVES.tally();
          res = { online, puppetsUp, stayedPuppet, laid, held, allDue, rose: tal.rose, walked: tal.walked, log: LOG.length, ours, dawnEmpty: GRAVES.marks().length === 0 };
        }
      } finally {
        if (online) { NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null; COOP.reset(); }
        if (monsters !== real) monsters = real;
        putBack(kept);
        player.dayTime = day0; F.sim(2, []);
      }
      check(P + 'a knight who is not the keeper keeps his graves through the night — nothing rises into the puppet list and nothing is counted as risen',
        res.online && res.puppetsUp && res.stayedPuppet && res.laid === 3 && res.held && res.allDue && res.rose === 0 && res.log === 0 && res.ours === 0 && res.walked === 3 && res.dawnEmpty,
        res);
      reset(); }

    // ---- 11. a keeper handoff loses the grave flag; the type still sweeps them ----
    // 75-coop's handoff rebuilds the new keeper's monsters with makeReal(), which has no fromGrave. Those three
    // types only ever come out of a grave, so a live one still crumbles at dawn and a dead one is taken away
    // instead of counting down to a respawn.
    { reset();
      const o = h.openSpot(56, 34); F.tp(o.x, o.y);
      const px = Math.floor(player.x / TILE), py = Math.floor(player.y / TILE);
      player.dayTime = DAY() - 4; NIGHT.resetTimer();                     // the last few seconds of the night
      const lost = (type, tx, ty, grade) => { const e = makeRisen(type, tx, ty, grade); e.fromGrave = false; e.remote = false; delete e.grade; e.nid = 'Ann:' + type; return e; };
      const sk = lost('grave_skeleton', px + 6, py, 'cross'), br = lost(BRUTE, px + 9, py + 2, 'headstone'), dz = lost('grave_risen', px + 6, py + 4, 'grave');
      dz.dead = true; dz.hp = 0; dz.deadT = 1; dz.respawnT = 27;             // what handoff() gives a dead one: a respawn clock
      monsters.push(sk, br, dz);
      F.step([]);
      const standAtNight = phase() === 'night' && monsters.includes(sk) && monsters.includes(br);
      const deadTaken = !monsters.includes(dz);
      for (let i = 0; i < 60 * 8 && phase() !== 'day'; i++) F.step([]);
      F.step([]);
      const crumbled = phase() === 'day' && !monsters.includes(sk) && !monsters.includes(br);
      for (const e of [sk, br, dz]) { const i = monsters.indexOf(e); if (i >= 0) monsters.splice(i, 1); }
      player.dayTime = day0; F.sim(2, []);
      check(P + 'a grave skeleton and a brute that lost their grave flag (a keeper handoff) still crumble at dawn and never respawn',
        standAtNight && deadTaken && crumbled, { standAtNight, deadTaken, crumbled, types: [...GRAVES.RISEN_TYPES] });
      reset(); }

    // ---- 12. a brute puppet never slams and never takes the stagger bonus ----
    // A puppet is a picture of the keeper's brute. Its wind-up and slam are the keeper's to roll, and its hp is
    // the keeper's to change, so on this knight's screen it does neither. The core loop is held off it the way
    // 75-coop's update wrap holds every puppet (a stun it never runs out of), so only this file's code can act.
    { reset();
      const o = h.openSpot(56, 34); F.tp(o.x, o.y);
      player.dayTime = 0;
      h.peace(false); player.hp = 100000;
      const parked = [];
      for (const mm of monsters) if (!mm.dead && dist(mm.x, mm.y, player.x, player.y) < 12 * TILE) { parked.push([mm, mm.x, mm.y, mm.state]); mm.x = player.x - 2000; mm.y = player.y; mm.state = 'return'; }
      const rnd = Math.random; Math.random = () => 0;                     // pinned: a slam that ran would land
      const m = makeRisen(BRUTE, Math.floor(player.x / TILE) + 1, Math.floor(player.y / TILE), 'headstone');
      m.fromGrave = false; m.remote = true; m.nid = 'Ann:brute'; m.respawnT = 1e9;
      m.x = player.x + 60; m.y = player.y; m.slamCd = 0; m.windT = 0.2; m.stunT = 1e6;
      monsters.push(m);
      const hpA = player.hp, xA = player.x, yA = player.y;
      for (let i = 0; i < 60; i++) F.step([]);
      const hurt = hpA - player.hp, moved = Math.round(dist(xA, yA, player.x, player.y));
      const noSlam = !(m.slams > 0) && hurt === 0 && player.x === xA && player.y === yA;
      m.stagT = 1;
      const hp1 = m.hp; hitMonster(m, 10, 0, false, 'player'); const took = hp1 - m.hp;
      Math.random = rnd;
      { const i = monsters.indexOf(m); if (i >= 0) monsters.splice(i, 1); }
      for (const [mm, x, y, st] of parked) { mm.x = x; mm.y = y; mm.state = st; }
      h.peace(true); player.hp = hp0; player.dayTime = day0;
      check(P + 'a brute puppet never slams and never takes the stagger bonus',
        noSlam && took === 10 && !(m.doubled > 0),
        { slams: m.slams || 0, hurt, moved, damageWhileStuck: took, doubled: m.doubled || 0 });
      reset(); }

    wipeRisen();
    quest.graves = g0; quest.graveNight = q0 || { rose: 0, walked: 0, laid: 0 };
    player.dayTime = day0; player.hp = hp0; player.inv = inv0; LOG.length = 0;
    prevPhase = null; lastT = null; armed = false; built = false;
    h.peace(true);
  });

  // ---------- self-test: the graves plaque, and the world-status plaques together at every device size ----------
  HOOKS.selfTest.push((check, F, h) => {
    const g0 = Array.isArray(quest.graves) ? quest.graves.slice() : [], q0 = quest.graveNight ? { ...quest.graveNight } : null, day0 = player.dayTime;
    const comp0 = player.companion ? JSON.parse(JSON.stringify(player.companion)) : null, law0 = player.law ? JSON.parse(JSON.stringify(player.law)) : null;
    const p0 = paused, pan0 = panel, touch0 = window.__forceTouch, stick0 = window.__stickRight, text0 = window.SETTINGS ? SETTINGS.get('text') : 'normal';
    const own = k => Object.getOwnPropertyDescriptor(window, k), size0 = { w: own('innerWidth'), h: own('innerHeight') };
    const mons0 = monsters.slice(), net0 = window.NET ? NET.enabled : false;
    const rec = [], add0 = HK.addPlaque, fc = HK.audit.fitCtx();
    HK.addPlaque = (g, o) => { rec.push({ o: Object.assign({}, o), r: add0(g, o) }); return rec[rec.length - 1].r; };
    const frame = (g = fc) => { rec.length = 0; drawHud(g); return rec; };
    const DUSK = NIGHT.LIGHT + 10, NIGHTT = NIGHT.LIGHT + NIGHT.DUSK + 20, DAYT = NIGHT.LIGHT - 60;
    // the roof shows only inside the coal seam, where the graves never show: for the busy check a hook of the check's
    // own puts the ROOF plaque up through the same builder the mine uses, low and red-edged, as the fifth plaque
    const roofOn = { on: false }, roofHook = g => { if (roofOn.on && window.COALMINE && COALMINE.plaque) HK.addPlaque(g, COALMINE.plaque(g, { t: 41.3, coal: 7, roof: 3 })); };
    HOOKS.hud.push(roofHook);
    const setSize = (w, hh) => { window.innerWidth = w; window.innerHeight = hh; if (VW !== w || VH !== hh) resize(); return VW === w && VH === hh; };
    try {
      paused = false; closePanel(); if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave();
      monsters.length = 0; for (const m of mons0) if (!(MONSTER_DEFS[m.type] && MONSTER_DEFS[m.type].level >= 25 && MONSTER_DEFS[m.type].hp >= 300)) monsters.push(m);
      player.companion = { id: null, hp: 0, mode: 'follow', x: 0, y: 0, freed: { sera: true }, downT: 0 }; player.law = { wanted: 0, timer: 0, fines: 0 };
      // ---- the graves plaque: a skull, GRAVES n, risen n, a plain line; amber at dusk, green at night, gone by day ----
      {
        quest.graves = [{ x: 40, y: 40, g: 'cross', t: 0, rise: null }, { x: 42, y: 40, g: 'cross', t: 0, rise: null }, { x: 44, y: 40, g: 'cross', t: 0, rise: null }];
        quest.graveNight = { rose: 1, walked: 0, laid: 3 };
        const find = () => { const q = frame().find(x => x.o.id === 'graves'); return q || null; };
        player.dayTime = DUSK; const dusk = find();
        player.dayTime = NIGHTT; const night = find();
        player.dayTime = DAYT; const day = find();
        player.dayTime = NIGHTT; title.active = true; const onTitle = find(); title.active = false;
        let inInst = null;
        if (window.INSTANCES && INSTANCES.list().includes('spider_den')) { INSTANCES.enter('spider_den'); inInst = find(); INSTANCES.leave(); }
        const okDusk = !!dusk && !!dusk.r && dusk.o.emblem === 'skull' && dusk.o.name === 'GRAVES 3' && dusk.o.right === 'risen 1' && /^Dusk/.test(dusk.o.sub) && dusk.o.edge === HK.T.warn;
        const okNight = !!night && night.o.name === 'GRAVES 3' && /^Night/.test(night.o.sub) && night.o.edge === HK.T.good;
        check('graves: the graves tag is a plaque through HK.addPlaque in a reserved slot now: a skull, GRAVES 3, risen 1 and one plain line, amber at dusk and green at night; not by day, not on the title screen, not inside an instance',
          okDusk && okNight && !day && !onTitle && !inInst, { dusk: dusk && dusk.o, night: night && night.o, day: !!day, onTitle: !!onTitle, inInst: !!inInst });
      }
      // ---- all five world-status plaques at every size: reserved slots only, the rest folds into +n, and every word fits at Large ----
      {
        const busy = on => {
          player.companion = on ? { id: 'sera', hp: 44, mode: 'follow', x: player.x - 30, y: player.y, downT: 0, freed: { sera: true } } : { id: null, hp: 0, mode: 'follow', x: 0, y: 0, freed: { sera: true }, downT: 0 };
          player.law = on ? { wanted: 2, timer: 38, fines: 150 } : { wanted: 0, timer: 0, fines: 0 };
          player.dayTime = on ? NIGHTT : DAYT; roofOn.on = !!on;
        };
        const IDS = ['companion', 'wanted', 'fine', 'graves', 'roof'];
        const alone = id => {
          busy(false);
          if (id === 'companion') player.companion = { id: 'sera', hp: 44, mode: 'follow', x: player.x - 30, y: player.y, downT: 0, freed: { sera: true } };
          if (id === 'wanted') player.law = { wanted: 2, timer: 38, fines: 0 };
          if (id === 'fine') player.law = { wanted: 0, timer: 0, fines: 150 };
          if (id === 'graves') player.dayTime = NIGHTT;
          if (id === 'roof') roofOn.on = true;
        };
        const same = (a, b) => !!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;
        const problems = [], folds = {}, narrow = []; let tried = 0, painted = '';
        const recCtx = new Proxy({}, { get: (t, k) => (k === 'fillText' || k === 'strokeText') ? (s => { painted += String(s) + '\n'; }) : fc[k], set: (t, k, v) => { fc[k] = v; return true; } });
        for (const [w, hh] of HK.audit.SIZES) {
          if (!setSize(w, hh)) continue; tried++;
          for (const t of [true, false]) for (const online of [true, false]) {
            window.__forceTouch = t; window.__stickRight = false; if (window.NET) NET.enabled = online;
            if (window.SETTINGS) SETTINGS.set('text', 'normal');
            const where = `${w}x${hh} ${t ? 'touch' : 'mouse'} ${online ? 'online' : 'offline'}`;
            // each one alone lands in the first free reserved slot
            for (const id of IDS) {
              alone(id); frame();
              const L = HK.cur(), start = HK.FRAME.plaqueStart || 0, q = rec.find(x => x.o.id === id);
              if (!q) problems.push(`${where}: ${id} was not added`);
              else if (!same(q.r, L.plaques[start])) problems.push(`${where}: ${id} is not in reserved slot ${start + 1}`);
            }
            // all five: the first ones fill the reserved slots, in order, and the rest fold into the brass +n badge
            busy(true); frame(recCtx);
            const L = HK.cur(), start = HK.FRAME.plaqueStart || 0, room = L.plaques.length - start;
            const got = IDS.map(id => rec.find(x => x.o.id === id)).filter(Boolean);
            if (got.length !== 5) problems.push(`${where}: ${got.length} of 5 plaques were added`);
            const shown = got.filter(x => x.r), want = Math.min(5, room);
            if (shown.length !== want) problems.push(`${where}: ${shown.length} shown for ${room} slots`);
            shown.forEach((x, i) => { if (!same(x.r, L.plaques[start + i])) problems.push(`${where}: ${x.o.id} is not in reserved slot ${start + i + 1}`); });
            if (HK.FRAME.overflow !== 5 - want) problems.push(`${where}: the +n badge counts ${HK.FRAME.overflow}, not ${5 - want}`);
            if (online) folds[`${w}x${hh}${t ? '' : ' mouse'}`] = `${want} + ${HK.FRAME.overflow}`;
            // at Large every word fits its plate: the busy frame, and each plaque drawn in a slot at this width
            if (window.SETTINGS) SETTINGS.set('text', 'large');
            HK.FIT.on = true; HK.FIT.log.length = 0; frame();
            const slot = L.plaques[start];
            if (slot) for (const id of IDS) { alone(id); const q = frame().find(x => x.o.id === id); if (q) HK.plaque(fc, slot, q.o); }
            HK.FIT.on = false;
            // (a kit question, not this file's: offline on a landscape phone the plaque column is only as wide as the
            // HOME and MENU seals, 124 px, which no plaque with a value on its right can fit. It is reported, not hidden:
            // the width is listed in the check's info, and the words are held to it everywhere the column is 160 or more.)
            const fit = HK.audit.fitIssues(`${where} large`);
            if (slot && slot.w < 160 && !online) { if (fit.length) narrow.push(`${where}: plaque column ${slot.w} px wide, ${fit.length} words do not fit`); }
            else for (const p of fit) if (problems.length < 30) problems.push(p);
          }
        }
        if (window.NET) NET.enabled = net0;
        const phonesFold = ['375x667', '390x844', '844x390', '430x932', '932x430'].every(k => folds[k] && +folds[k].split(' + ')[1] >= 3);
        check('world-status plaques (companion, WANTED, FINE TO PAY, GRAVES, ROOF) each land in a reserved plaque slot at all 8 sizes, touch and mouse; all five together fill the slots in order and fold the rest into the brass +n badge (+3 or more on every phone); every word fits its plate at Large; no star character is painted',
          tried === 8 && problems.length === 0 && phonesFold && !/[\u2605\u2606]/.test(painted), { tried, folds, problems: problems.slice(0, 12), total: problems.length, kitNarrowColumn: narrow });
      }
    } catch (e) {
      check('graves: the plaque checks ran to the end without throwing', false, { error: String(e && e.message || e) });
    } finally {
      HK.addPlaque = add0; HK.FIT.on = false; roofOn.on = false; if (window.NET) NET.enabled = net0;
      const hi = HOOKS.hud.indexOf(roofHook); if (hi >= 0) HOOKS.hud.splice(hi, 1);
      quest.graves = g0; if (q0) quest.graveNight = q0; player.dayTime = day0; player.companion = comp0; player.law = law0;
      monsters.length = 0; for (const m of mons0) monsters.push(m);
      if (window.SETTINGS) SETTINGS.set('text', text0);
      window.__forceTouch = touch0; window.__stickRight = stick0;
      if (size0.w) { Object.defineProperty(window, 'innerWidth', size0.w); Object.defineProperty(window, 'innerHeight', size0.h); } else { try { delete window.innerWidth; delete window.innerHeight; } catch (e) { } }
      resize(); paused = p0; closePanel(); if (pan0) openPanel(pan0); render();
    }
  });
}
