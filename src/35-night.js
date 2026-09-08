// ============================================================================
// NIGHT — a day/night cycle, zombies after dark, and the Afterlands (a land where night never ends)
// Feature file. Registers everything through HOOKS; edits no core file. Everything lives in one block.
//
// The clock: player.dayTime (saved with the player) counts game seconds. One day is 10 minutes:
// 7 minutes of light, 1 minute of dusk (the overlay ramps 0 → 0.55), 2 minutes of night, then dawn.
// The night is drawn as the last world item (under the HUD): a dark-blue layer with holes cut around the
// knight, every fire / oven / forge / lamp / torch, and every doorstep. Places with their own darkness
// (the starting cave, Deepholm, The Fang's Lair, any dark instance) are left alone.
// Zombies rise at night in the open (never in a village, a castle, a building or an instance), at most
// four at a time, and crumble to dust at dawn. Near graves they rise stronger.
// The Afterlands is an instance (16-instances) behind a crypt door that the last knight's grave in
// Wolfwood reveals. There the zombies are calm, the vampires are not, and Count Ashvane waits in a
// ruined chapel. Test/debug handle: window.NIGHT.
// ============================================================================
{
  const DAY = 600, LIGHT = 420, DUSK = 60, DAWN_FADE = 15, NIGHT_ALPHA = 0.55;
  const SPAWN_EVERY = 20, MAX_ZOMBIES = 4, PLAYER_LIGHT = 170;
  const GRAVE_T = { x: 12, y: 70 };                       // the last knight of Hollowford (02-world)
  const CRYPT_T = { x: 13, y: 70 }, STEP_T = { x: 14, y: 70 }; // the crypt door east of the grave, and where you stand after leaving
  const WOLFWOOD_GRAVES = [[10, 70], [11, 68], [13, 68], [15, 68]]; // a few more stones make it a graveyard
  const AFTER = { id: 'afterlands', w: 60, h: 40, name: 'The Afterlands', sub: 'Night never ends here' };
  const AF_ENTRY = [30, 3], AF_EXIT = [30, 2], AF_FIRE = [30, 8], AF_COUNT = [46, 18];
  const AF_SPAWNS = [
    ['zombie_calm', 9, 23], ['zombie_calm', 13, 27], ['zombie_calm', 17, 25], ['zombie_calm', 19, 31], ['zombie_calm', 11, 31], ['zombie_calm', 15, 29],
    ['grave_zombie_calm', 7, 29], ['grave_zombie_calm', 21, 23],
    ['vampire', 44, 20], ['vampire', 48, 20], ['vampire', 46, 10],
    ['count_ashvane', AF_COUNT[0], AF_COUNT[1]],
  ];
  const NO_SPAWN_REGIONS = new Set(['Thistledown', 'Castle Thistledown', 'Deepholm', 'The Cave', "The Fang's Lair", 'Sylvaris', 'Hollowford']);
  // where the dead may neither rise nor wander: the regions above plus the goblin city (33-goblincity: Grubmarket holds the market, the scrap
  // yard and Tinkerton's compound; Castle Gnash the castle). The rects are read from REGIONS by name at runtime, never copied here.
  const NO_GO_NAMES = new Set([...NO_SPAWN_REGIONS, 'Grubmarket', 'Castle Gnash']);
  const noGoRects = () => REGIONS.filter(r => NO_GO_NAMES.has(r.name));
  const inNoGo = (tx, ty) => inVillageBounds(tc(tx), tc(ty)) || isCaveTile(tx, ty) || noGoRects().some(r => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1);
  const OWN_DARK_REGIONS = ['Deepholm', "The Fang's Lair"]; // regions that draw their own darkness (24-dwarves, 28-thefang)

  // ---------- tiles (ids captured locally) ----------
  const T_CRYPT = addTile('CRYPT_DOOR', { solid: true, tex: 'dirt', mini: '#2a2a33' });
  const T_DEAD = addTile('DEAD_TREE', { solid: true, tex: 'dirt', mini: '#3a3028' });
  const LAMP_T = T.LAMP, TORCH_T = T.TORCH, DDOOR_T = T.DUNGEON_DOOR; // undefined when those feature files are absent

  // ---------- items ----------
  Object.assign(ITEMS, {
    rotten_cloth: { name: 'Rotten cloth', value: 4, color: '#6a6a5a', shape: 'silk' },
    grave_dust: { name: 'Grave dust', value: 30, color: '#9a9aa8', shape: 'powder' },
    vampire_fang: { name: 'Vampire fang', value: 400, color: '#f2eee8', shape: 'dagger' },
    shadow_cloak: { name: 'Shadow cloak', value: 900, color: '#1a1420', shape: 'body', armour: { slot: 'body', def: 14 } },
  });
  for (const k of ['rotten_cloth', 'grave_dust', 'vampire_fang', 'shadow_cloak']) { ITEMS[k].id = k; ITEMS[k].stack = ITEMS[k].armour ? 1 : 50; }

  // ---------- monsters ----------
  MONSTER_DEFS.zombie = { name: 'Zombie', level: 12, r: 13, hp: 40, att: 12, maxHit: 7, def: 8, speed: 70, aggro: true, sight: 6 * TILE, respawn: 0,
    drops: { always: [['coins', 5, 12]], table: [['nothing', 0, 0, 4], ['rotten_cloth', 1, 1, 6]] } };
  MONSTER_DEFS.grave_zombie = { name: 'Grave zombie', level: 24, r: 13, hp: 90, att: 24, maxHit: 12, def: 16, speed: 80, aggro: true, sight: 6 * TILE, respawn: 0,
    drops: { always: [['coins', 20, 40], ['grave_dust', 1, 1]], rare: { chance: 20, table: [['vampire_fang', 1, 1, 1]] } } };
  // the Afterlands' dead are calm: same creatures, aggro off, and they do come back
  MONSTER_DEFS.zombie_calm = { ...MONSTER_DEFS.zombie, aggro: false, respawn: 90 };
  MONSTER_DEFS.grave_zombie_calm = { ...MONSTER_DEFS.grave_zombie, aggro: false, respawn: 120 };
  MONSTER_DEFS.vampire = { name: 'Vampire', level: 30, r: 13, hp: 110, att: 30, maxHit: 14, def: 22, speed: 190, aggro: true, sight: 7 * TILE, respawn: 120, human: true,
    drops: { always: [['coins', 30, 60], ['grave_dust', 1, 2]], rare: { chance: 10, table: [['vampire_fang', 1, 1, 1]] } } };
  MONSTER_DEFS.count_ashvane = { name: 'Count Ashvane', level: 40, r: 14, hp: 300, att: 38, maxHit: 18, def: 30, speed: 120, aggro: true, sight: 8 * TILE, respawn: 600, human: true,
    drops: { always: [['vampire_fang', 1, 1], ['coins', 150, 250], ['grave_dust', 3, 5]] } };
  const VAMPIRES = new Set(['vampire', 'count_ashvane']);

  // ---------- sprites ----------
  // a shambling green-grey person: arms out front, a torn tunic, the head sitting crooked on the neck
  function drawZombie(g, e, hurt, grave) {
    const s = grave ? 1.15 : 1; g.save(); g.scale(s, s);
    const fx = e.facing.x, fy = e.facing.y, ang = Math.atan2(fy, fx);
    const skin = hurt ? '#ffc7b0' : grave ? '#6f8a55' : '#8faa6c';
    const sw = e.moving ? Math.sin(e.walkT * 0.9) * 0.18 : 0;
    g.save(); g.rotate(ang); g.fillStyle = skin;
    g.save(); g.rotate(-0.28 + sw); g.fillRect(4, -9, 18, 5); g.restore();
    g.save(); g.rotate(0.28 - sw); g.fillRect(4, 4, 18, 5); g.restore();
    g.restore();
    drawHuman(g, e, { tunic: grave ? '#3a3a30' : '#5a5644', hair: grave ? '#2a2a24' : '#3a3a2a', skin, shoulder: grave ? '#4a4a40' : '#6a6656', helm: grave ? '#5a5d64' : null, fists: true });
    // rips in the hem
    g.fillStyle = 'rgba(20,20,16,0.55)'; g.beginPath(); g.moveTo(-9, 8); g.lineTo(-5, 3); g.lineTo(-2, 10); g.lineTo(2, 4); g.lineTo(5, 11); g.lineTo(9, 6); g.lineTo(8, 13); g.lineTo(-8, 13); g.closePath(); g.fill();
    // the head, drawn again tilted over the straight one
    g.save(); g.translate(0, -3); g.rotate(grave ? -0.4 : 0.32); g.translate(0, -5);
    g.fillStyle = skin; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill();
    if (grave) { g.fillStyle = hurt ? '#ffd0d0' : '#5a5d64'; g.beginPath(); g.arc(0, -1, 9, Math.PI, 0); g.fill(); g.fillRect(-9, -1, 18, 3); }
    else { g.fillStyle = '#3a3a2a'; g.beginPath(); g.arc(0, -3, 8, Math.PI, 0); g.fill(); }
    g.fillStyle = '#1a1a14'; g.beginPath(); g.arc(-3 + fx * 2, 1 + fy * 2, 2, 0, 7); g.arc(3 + fx * 2, 1 + fy * 2, 2, 0, 7); g.fill();
    g.fillStyle = '#e8e26b'; g.beginPath(); g.arc(-3 + fx * 2, 1 + fy * 2, 0.8, 0, 7); g.arc(3 + fx * 2, 1 + fy * 2, 0.8, 0, 7); g.fill();
    g.strokeStyle = '#2a2a20'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-3, 5); g.lineTo(3, 5); g.stroke();
    g.restore();
    g.restore();
  }
  // a pale person in a black cloak with a stand-up red collar; the count wears a circlet and carries a black blade
  function drawVampire(g, e, hurt, count) {
    const s = count ? 1.18 : 1; g.save(); g.scale(s, s);
    const fx = e.facing.x, fy = e.facing.y;
    g.fillStyle = hurt ? '#7a4a5a' : '#141018'; g.beginPath(); g.ellipse(-fx * 3, 5 - fy * 2, 16, 13, 0, 0, 7); g.fill();
    if (count) { g.fillStyle = '#5a1020'; g.beginPath(); g.ellipse(-fx * 4, 6 - fy * 2, 11, 8, 0, 0, 7); g.fill(); }
    const look = { tunic: '#1e1824', hair: '#0c0a10', skin: hurt ? '#ffc7b0' : '#ece4ec', shoulder: '#2a1e2e' };
    if (count) look.weapon = { shape: 'sword', color: '#3a3a42' }; else look.fists = true;
    drawHuman(g, e, look);
    g.fillStyle = '#b0202c'; g.beginPath(); g.moveTo(-10, -2); g.lineTo(-9, -15); g.lineTo(-3, -4); g.closePath(); g.fill(); g.beginPath(); g.moveTo(10, -2); g.lineTo(9, -15); g.lineTo(3, -4); g.closePath(); g.fill();
    if (count) { const gr = g.createRadialGradient(0, -8, 1, 0, -8, 16); gr.addColorStop(0, 'rgba(255,60,60,0.35)'); gr.addColorStop(1, 'rgba(255,60,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, -8, 16, 0, 7); g.fill(); }
    g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(-3 + fx * 2, -7 + fy * 2, 1.6, 0, 7); g.arc(3 + fx * 2, -7 + fy * 2, 1.6, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-2.5, -3); g.lineTo(-1.5, 0); g.lineTo(-0.5, -3); g.closePath(); g.fill(); g.beginPath(); g.moveTo(0.5, -3); g.lineTo(1.5, 0); g.lineTo(2.5, -3); g.closePath(); g.fill();
    if (count) { g.strokeStyle = '#c9ccd3'; g.lineWidth = 2; g.beginPath(); g.arc(0, -12, 8, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.fillStyle = '#e63946'; g.beginPath(); g.arc(0, -19.5, 1.8, 0, 7); g.fill(); }
    g.restore();
  }
  HOOKS.drawMonster.zombie = (g, e, hurt) => drawZombie(g, e, hurt, false);
  HOOKS.drawMonster.zombie_calm = HOOKS.drawMonster.zombie;
  HOOKS.drawMonster.grave_zombie = (g, e, hurt) => drawZombie(g, e, hurt, true);
  HOOKS.drawMonster.grave_zombie_calm = HOOKS.drawMonster.grave_zombie;
  HOOKS.drawMonster.vampire = (g, e, hurt) => drawVampire(g, e, hurt, false);
  HOOKS.drawMonster.count_ashvane = (g, e, hurt) => drawVampire(g, e, hurt, true);

  // ---------- the clock ----------
  const N = () => quest.night || (quest.night = { crypt: false, told: false });
  HOOKS.newGame.push(() => { quest.night = { crypt: false, told: false }; player.dayTime = 0; spawnT = 0; });
  const dayT = () => { const t = (player.dayTime || 0) % DAY; return t < 0 ? t + DAY : t; };
  const phase = () => { const t = dayT(); return t < LIGHT ? 'day' : t < LIGHT + DUSK ? 'dusk' : 'night'; };
  const alpha = () => { const t = dayT(); if (t < LIGHT) return 0; if (t < LIGHT + DUSK) return NIGHT_ALPHA * (t - LIGHT) / DUSK; if (t > DAY - DAWN_FADE) return NIGHT_ALPHA * (DAY - t) / DAWN_FADE; return NIGHT_ALPHA; };
  let spawnT = 0;

  // ---------- night zombies ----------
  const makeMonster = (type, tx, ty) => {
    const d = MONSTER_DEFS[type];
    return { type, x: tc(tx), y: tc(ty), home: { x: tc(tx), y: tc(ty) }, r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: d.aggro, state: 'idle', wanderT: Math.random() * 2,
      wander: { x: 0, y: 0 }, attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 0, facing: { x: 1, y: 0 }, walkT: 0, moving: false, stunT: 0, night: true };
  };
  const ptile = () => ({ tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) });
  // outdoors on the overworld, after dark, nowhere civilised. __peace (the self-test's "monsters ignore you") also holds the dead down.
  function canSpawn() {
    if (window.__instance || player.dead || window.__peace || phase() !== 'night') return false;
    const { tx, ty } = ptile();
    if (NO_SPAWN_REGIONS.has(player.region) || inVillageBounds(player.x, player.y) || isCaveTile(tx, ty) || buildingAt(tx, ty)) return false;
    return true;
  }
  const graveNear = (tx, ty, r = 8) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (tileAt(tx + dx, ty + dy) === T.GRAVE) return true; return false; };
  function spawnTile() {
    const { tx: px, ty: py } = ptile();
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * Math.PI * 2, d = 8 + Math.random() * 4;
      const tx = Math.round(px + Math.cos(a) * d), ty = Math.round(py + Math.sin(a) * d);
      if (!inMap(tx, ty)) continue;
      const t = tileAt(tx, ty);
      if (SOLID.has(t) || PUSH_THROUGH.has(t) || buildingAt(tx, ty) || inNoGo(tx, ty)) continue;
      if (NO_SPAWN_REGIONS.has(regionAt(tx, ty).name)) continue;
      if (collides(tc(tx), tc(ty), 13, 'beast')) continue;
      if (monsters.some(m => !m.dead && dist(m.x, m.y, tc(tx), tc(ty)) < 30)) continue;
      return { tx, ty };
    }
    return null;
  }
  const nightAlive = () => monsters.filter(m => m.night && !m.dead).length;
  function trySpawn() {
    const room = MAX_ZOMBIES - nightAlive(); if (room <= 0) return 0;
    const n = Math.min(room, Math.random() < 0.5 ? 1 : 2); let made = 0;
    const { tx: px, ty: py } = ptile();
    for (let i = 0; i < n; i++) {
      const s = spawnTile(); if (!s) break;
      const grave = graveNear(s.tx, s.ty) || graveNear(px, py);
      const m = makeMonster(grave ? 'grave_zombie' : 'zombie', s.tx, s.ty); m.rose = { x: player.x, y: player.y };
      monsters.push(m); made++;
      burst(m.x, m.y + 8, grave ? '#5a5d64' : '#4a4636', 14, 70); floatText(m.x, m.y - 24, 'rises', grave ? '#c9ccd3' : '#8faa6c', 12);
    }
    return made;
  }
  function crumble(m) {
    burst(m.x, m.y, '#8a8a7a', 14, 80); burst(m.x, m.y, '#4a4636', 6, 40);
    if (!m.dead) floatText(m.x, m.y - 24, 'crumbles', '#9a9a8a', 12);
  }
  // Count Ashvane steps through the dark: every 6 s, while he is after you, he is suddenly three tiles behind you
  function countTick(dt) {
    if (player.dead || window.__peace) return;
    for (const m of monsters) {
      if (m.type !== 'count_ashvane' || m.dead) continue;
      const def = MONSTER_DEFS[m.type], dp = dist(m.x, m.y, player.x, player.y);
      if (m.state !== 'chase' && dp > def.sight) { m.tpT = 6; continue; }
      m.tpT = (m.tpT ?? 6) - dt; if (m.tpT > 0) continue; m.tpT = 6;
      const want = { x: player.x - player.facing.x * 3 * TILE, y: player.y - player.facing.y * 3 * TILE };
      const sp = safeSpot(want.x, want.y, m.r, 'beast'); if (!sp) continue;
      burst(m.x, m.y, '#3a1a2a', 16, 90); m.x = sp.x; m.y = sp.y; m.home = { x: sp.x, y: sp.y }; m.state = 'chase';
      const dx = player.x - m.x, dy = player.y - m.y, d = Math.hypot(dx, dy) || 1; m.facing = { x: dx / d, y: dy / d };
      burst(m.x, m.y, '#b0202c', 16, 90); floatText(m.x, m.y - m.r - 22, 'behind you', '#ff6b6b', 12); sfx('open');
    }
  }
  HOOKS.update.push(dt => {
    player.dayTime = (player.dayTime || 0) + dt;
    countTick(dt);
    if (window.__instance) return;
    const ph = phase();
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i]; if (!m.night) continue;
      if (m.dead && m.deadT > 0.8) { monsters.splice(i, 1); continue; }   // the dead of the night never respawn
      if (ph !== 'night') { crumble(m); monsters.splice(i, 1); continue; } // dawn
      // a zombie that steps over the line into a village, a city or a castle turns back: it is put back on its last tile outside and sent home
      if (m.dead) continue;
      if (inNoGo(Math.floor(m.x / TILE), Math.floor(m.y / TILE))) {
        if (m.lastOut) { m.x = m.lastOut.x; m.y = m.lastOut.y; }
        m.state = 'return'; m.wander = { x: 0, y: 0 }; m.wanderT = 1.5; m.facing = { x: -m.facing.x, y: -m.facing.y }; m.turned = (m.turned || 0) + 1;
      } else m.lastOut = { x: m.x, y: m.y };
    }
    if (ph !== 'night') spawnT = 0;
    if (ph === 'dusk' && !N().told && !player.dead && !NO_SPAWN_REGIONS.has(player.region)) { N().told = true; say('The light is going. When it is dark the dead walk. Not many. Stay near a fire, or show them your sword. They fall to dust at dawn.', 'The Voice'); }
    if (canSpawn()) { spawnT += dt; if (spawnT >= SPAWN_EVERY) { spawnT = 0; trySpawn(); } }
  });
  // vampires drink: every hit on the knight heals the biter half of what it took
  HOOKS.hurt.push((dmg, fx, fy) => {
    const v = monsters.find(m => !m.dead && VAMPIRES.has(m.type) && Math.abs(m.x - fx) < 0.01 && Math.abs(m.y - fy) < 0.01);
    if (!v) return;
    const heal = Math.min(Math.ceil(dmg * 0.5), v.maxHp - v.hp); if (heal <= 0) return;
    v.hp += heal; floatText(v.x, v.y - v.r - 18, `+${heal}`, '#ff6b6b', 12); burst(v.x, v.y - 6, '#c0202c', 6, 50);
  });

  // ---------- the grave and the crypt door ----------
  const isOwnGrave = (tx, ty) => WOLFWOOD_GRAVES.some(([x, y]) => x === tx && y === ty);
  HOOKS.world.push((rnd, api) => {
    const soft = [T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM, T.STUMP];
    for (let y = 67; y <= 71; y++) for (let x = 9; x <= 16; x++) if (soft.includes(api.tileAt(x, y))) api.setTile(x, y, T.GRASS);
    for (const [x, y] of WOLFWOOD_GRAVES) api.setTile(x, y, T.GRAVE);
    api.setTile(GRAVE_T.x, GRAVE_T.y, T.GRAVE);
    api.setTile(CRYPT_T.x, CRYPT_T.y, T.DIRT); api.setTile(STEP_T.x, STEP_T.y, T.DIRT); // the disturbed earth, and the step
  });
  // the core answers E on any grave itself (before HOOKS.use), so the last knight's grave is taken over here
  const _useAction = useAction;
  useAction = function () {
    if (!player.dead && !player.mech && !window.__instance) {
      const { tx, ty } = frontTile(player);
      if (tileAt(tx, ty) === T.GRAVE && !npcInFront()) {
        if (tx === GRAVE_T.x && ty === GRAVE_T.y) {
          const q = N();
          say('Here lies the last knight of Hollowford. The earth beside it has been disturbed.', 'Gravestone');
          if (!q.crypt) {
            q.crypt = true; changeTile(CRYPT_T.x, CRYPT_T.y, T_CRYPT); burst(tc(CRYPT_T.x), tc(CRYPT_T.y), '#3a3530', 20, 90); sfx('chop');
            say('A door in the ground, where no door should be. Cold air comes up the steps. Something down there does not sleep.', 'The Voice'); save();
          }
          return;
        }
        if (isOwnGrave(tx, ty)) { say('A Wolfwood grave. The name has worn off the stone.', 'Gravestone'); return; }
      }
    }
    return _useAction();
  };
  HOOKS.use.push((t, tx, ty) => {
    if (t !== T_CRYPT) return false;
    if (window.__instance === AFTER.id) { INSTANCES.leave(); notify('You climb the steps back into Wolfwood.'); return true; }
    if (window.__instance) return true;
    if (!window.INSTANCES) { notify('The crypt is sealed.'); return true; }
    if (!INSTANCES.enter(AFTER.id, [STEP_T.x, STEP_T.y])) notify('You cannot go down right now.');
    return true;
  });

  // ---------- the Afterlands ----------
  function buildAfterlands(set, rnd, at) {
    const W = AFTER.w, H = AFTER.h;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) set(x, y, rnd() < 0.3 ? T.GRASS : T.DIRT);
    // marsh pools
    for (const [cx, cy, r] of [[6, 10, 2.5], [50, 32, 3], [24, 10, 2.2], [40, 6, 2.4], [30, 34, 2], [56, 20, 2], [36, 30, 2.4]]) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (dist(x, y, cx, cy) <= r + Math.sin(x * 1.3 + y * 0.7) * 0.8) set(x, y, T.WATER);
    // dead trees
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (at(x, y) !== T.WATER && rnd() < 0.09) set(x, y, T_DEAD);
    // the crypt at the north: a stone box, the door in its back wall, open to the south
    for (let y = 1; y <= 5; y++) for (let x = 27; x <= 33; x++) set(x, y, (x === 27 || x === 33 || y === 1) ? T.CWALL : T.CAVE);
    set(AF_EXIT[0], AF_EXIT[1], T_CRYPT);
    if (TORCH_T !== undefined) { set(28, 2, TORCH_T); set(32, 2, TORCH_T); }
    // paths: crypt → fire → the graveyard (west) and the chapel (east)
    const path = pts => { for (let s = 0; s < pts.length - 1; s++) { const [ax, ay] = pts[s], [bx, by] = pts[s + 1]; const n = Math.max(1, Math.abs(bx - ax), Math.abs(by - ay)); for (let k = 0; k <= n; k++) { const x = Math.round(ax + (bx - ax) * k / n), y = Math.round(ay + (by - ay) * k / n); for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (x + dx > 0 && y + dy > 0 && x + dx < W - 1 && y + dy < H - 1) set(x + dx, y + dy, T.DIRT); } } };
    path([[30, 6], [30, 14], [18, 22], [12, 26]]); path([[30, 14], [44, 18], [46, 25]]);
    for (let y = AF_FIRE[1] - 1; y <= AF_FIRE[1] + 1; y++) for (let x = AF_FIRE[0] - 1; x <= AF_FIRE[0] + 1; x++) set(x, y, T.DIRT);
    set(AF_FIRE[0], AF_FIRE[1], T.FIRE);
    // the graveyard: rows of stones on bare earth
    for (let y = 21; y <= 33; y++) for (let x = 5; x <= 21; x++) set(x, y, T.DIRT);
    for (let gy = 22; gy <= 32; gy += 2) for (let gx = 6; gx <= 20; gx += 2) if (rnd() < 0.7) set(gx, gy, T.GRAVE);
    for (const [x, y] of [[5, 21], [21, 21], [5, 33], [21, 33]]) set(x, y, T_DEAD);
    // the ruined chapel: a stone ring with the roof long gone, a cobbled floor, torches still burning in the walls
    for (let y = 12; y <= 26; y++) for (let x = 38; x <= 54; x++) set(x, y, T.DIRT);
    for (let y = 14; y <= 24; y++) for (let x = 40; x <= 52; x++) set(x, y, (x === 40 || x === 52 || y === 14 || y === 24) ? T.CWALL : T.COBBLE);
    set(46, 24, T.COBBLE); set(45, 24, T.COBBLE);           // the doorway, south
    set(52, 19, T.RUBBLE); set(40, 21, T.RUBBLE); set(45, 14, T.RUBBLE); // fallen stones
    set(44, 22, T.RUBBLE); set(49, 16, T.RUBBLE);
    set(46, 16, T.TABLE);                                    // the altar
    if (TORCH_T !== undefined) { set(43, 14, TORCH_T); set(49, 14, TORCH_T); set(40, 17, TORCH_T); set(52, 22, TORCH_T); }
    for (const [x, y] of [[36, 12], [56, 12], [36, 26], [56, 26]]) set(x, y, T_DEAD);
    for (const [, x, y] of AF_SPAWNS) if (SOLID.has(at(x, y))) set(x, y, T.DIRT); // the dead stand between the stones; the rows between graves are open ground
  }
  if (window.INSTANCES) INSTANCES.define(AFTER.id, {
    name: AFTER.name, sub: AFTER.sub, w: AFTER.w, h: AFTER.h, dark: false, boss: 'count_ashvane',
    build: buildAfterlands, spawns: AF_SPAWNS, exit: null, entry: AF_ENTRY,
    voice: 'The Afterlands. Night never ends here. The dead are calm. The living things are not.',
    onClear: first => {
      say('Count Ashvane comes apart like old paper. The vampires scatter. The dead do not even look up.', 'The Voice');
      if (first) { giveOrDrop('shadow_cloak', 1, player.x, player.y); say('His cloak. It drinks the light. Wear it and the night will find you harder to see.', 'The Voice'); }
    },
  });

  // ---------- drawing: props, the night, the highlight ----------
  function drawCrypt(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, cx = tc(tx), cy = tc(ty);
    g.fillStyle = '#3a3530'; g.fillRect(x, y, TILE, TILE);
    g.fillStyle = '#2a2622'; for (const [ox, oy, r] of [[8, 8, 3], [40, 10, 2.5], [12, 40, 2.5], [38, 38, 3]]) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, 7); g.fill(); }
    g.fillStyle = '#6e7178'; g.fillRect(x + 6, y + 4, TILE - 12, TILE - 8);
    g.fillStyle = '#4a4d54'; g.fillRect(x + 10, y + 8, TILE - 20, TILE - 16);
    g.fillStyle = '#07080c'; g.fillRect(x + 13, y + 11, TILE - 26, TILE - 22);
    g.fillStyle = 'rgba(120,130,150,0.25)'; for (let k = 0; k < 3; k++) g.fillRect(x + 13, y + 11 + k * 7, TILE - 26, 2);
    g.fillStyle = '#8f96a3'; g.fillRect(x + 6, y + 4, TILE - 12, 3);
    g.fillStyle = '#d9d2c4'; g.beginPath(); g.arc(cx, y + TILE - 9, 3.5, 0, 7); g.fill();
    g.fillStyle = '#2a2622'; g.beginPath(); g.arc(cx - 1.3, y + TILE - 9.5, 0.9, 0, 7); g.arc(cx + 1.3, y + TILE - 9.5, 0.9, 0, 7); g.fill();
    const gl = 0.25 + Math.sin(time * 2 + tx) * 0.08; const gr = g.createRadialGradient(cx, cy, 4, cx, cy, 40); gr.addColorStop(0, `rgba(120,160,255,${gl})`); gr.addColorStop(1, 'rgba(120,160,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 40, 0, 7); g.fill();
  }
  function drawDeadTree(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), v = variant[idx(tx, ty)], lean = (v - 1) * 2;
    g.save(); g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 14, 12, 5, 0, 0, 7); g.fill();
    g.strokeStyle = '#3a3028'; g.lineCap = 'round'; g.lineWidth = 6; g.beginPath(); g.moveTo(cx, cy + 16); g.lineTo(cx + lean, cy - 10); g.stroke();
    const bx = cx + lean;
    for (const [a, l, oy] of [[-0.9, 16, 0], [0.7, 14, 4], [-0.3, 12, -2], [1.2, 10, 6]]) {
      const by = cy - 10 + oy, ex = bx + Math.sin(a) * l, ey = by - Math.cos(a) * l;
      g.lineWidth = 3; g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
      g.lineWidth = 1.8; g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + Math.sin(a + 0.8) * 6, ey - Math.cos(a + 0.8) * 6); g.stroke();
    }
    if ((tx * 7 + ty * 13) % 5 === 0) { g.fillStyle = '#111'; g.beginPath(); g.ellipse(bx - 12, cy - 26, 3.5, 2.2, 0, 0, 7); g.fill(); g.beginPath(); g.arc(bx - 15, cy - 28, 1.6, 0, 7); g.fill(); } // a crow
    g.restore();
  }
  const nightC = document.createElement('canvas');
  const regionRect = name => REGIONS.find(r => r.name === name);
  // how dark the overlay is right now: 0 wherever something else owns the darkness (a dark instance, Deepholm, the lair, the starting cave)
  function overlayAlpha() {
    const inst = window.__instance, inAfter = inst === AFTER.id;
    if (inst && !inAfter) return 0;
    const a = inAfter ? NIGHT_ALPHA : alpha(); if (a <= 0.002) return 0;
    const { tx, ty } = ptile();
    if (!inAfter && (OWN_DARK_REGIONS.includes(player.region) || isCaveTile(tx, ty))) return 0;
    return a;
  }
  function drawNight(g) {
    const a = overlayAlpha(); if (a <= 0) return;
    const inAfter = window.__instance === AFTER.id;
    const { tx: ptx, ty: pty } = ptile();
    if (nightC.width !== canvas.width || nightC.height !== canvas.height) { nightC.width = canvas.width; nightC.height = canvas.height; }
    const dg = nightC.getContext('2d');
    dg.setTransform(DPR, 0, 0, DPR, 0, 0); dg.globalCompositeOperation = 'source-over'; dg.clearRect(0, 0, VW, VH);
    dg.fillStyle = `rgba(10,16,48,${a})`; dg.fillRect(0, 0, VW, VH);
    dg.globalCompositeOperation = 'destination-out';
    if (!inAfter) {
      // places that light themselves: the starting cave (the core darkens it), Deepholm, The Fang's Lair, and the building the knight stands in
      dg.fillRect(-cam.x, -cam.y, (CAVE_EXIT_X + 1) * TILE, 16 * TILE);
      for (const name of OWN_DARK_REGIONS) { const r = regionRect(name); if (r) dg.fillRect(r.x0 * TILE - cam.x, r.y0 * TILE - cam.y, (r.x1 - r.x0 + 1) * TILE, (r.y1 - r.y0 + 1) * TILE); }
      const b = insideBuilding(ptx, pty); if (b) dg.fillRect(b.x * TILE - cam.x, b.y * TILE - cam.y, b.w * TILE, b.h * TILE);
    }
    const lights = [{ x: player.x, y: player.y, r: PLAYER_LIGHT }];
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 3), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE) + 3);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 3), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 3);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = map[idx(tx, ty)];
      if (t === T.FIRE) lights.push({ x: tc(tx), y: tc(ty), r: 120 });
      else if (t === T.OVEN || t === T.FORGE) lights.push({ x: tc(tx), y: tc(ty), r: 90 });
      else if (t === LAMP_T) lights.push({ x: tc(tx) + 10, y: tc(ty) - 12, r: 120 });
      else if (t === TORCH_T) lights.push({ x: tc(tx), y: tc(ty) - 14, r: 110 });
      else if (t === DDOOR_T) lights.push({ x: tc(tx), y: ty * TILE + 27, r: 80 });
      else if (t === T_CRYPT) lights.push({ x: tc(tx), y: tc(ty), r: 70 });
      else if (t === T.LODESTONE) lights.push({ x: tc(tx), y: tc(ty), r: 60 });
      else if (t === T.DOOR || t === T.COFFINDOOR) { const b = buildingAt(tx, ty); const up = !!b && ty === b.y && b.doorTop !== undefined && tx === b.x + b.doorTop; lights.push({ x: tc(tx), y: up ? ty * TILE : (ty + 1) * TILE, r: 70 }); }
    }
    for (const L of lights) {
      const sx = L.x - cam.x, sy = L.y - cam.y; if (sx < -L.r || sy < -L.r || sx > VW + L.r || sy > VH + L.r) continue;
      const gr = dg.createRadialGradient(sx, sy, 10, sx, sy, L.r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dg.fillStyle = gr; dg.beginPath(); dg.arc(sx, sy, L.r, 0, 7); dg.fill();
    }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(nightC, 0, 0); g.restore();
  }
  HOOKS.draw.push((g, items) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE));
    for (let ty = y0; ty <= y1 + 2; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      if (t === T_CRYPT) items.push({ y: ty * TILE - 1, draw: () => drawCrypt(g, tx, ty) });
      else if (t === T_DEAD) items.push({ y: ty * TILE + TILE - 4, draw: () => drawDeadTree(g, tx, ty) });
    }
    items.push({ y: 1e9 - 0.5, draw: () => drawNight(g) }); // under the other darkness layers (1e9), over everything else
    if (!player.dead && !player.mech) items.push({ y: 1e9 + 1, draw: () => {
      const { tx, ty } = frontTile(player);
      if (tileAt(tx, ty) === T_CRYPT) { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]); roundRect(g, tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6, 6); g.stroke(); g.setLineDash([]); }
    } });
  });
  // the sun/moon dial under the minimap (inside its corner on a phone, where the MENU stack takes the space below)
  HOOKS.hud.push((g, narrow) => {
    if (typeof title !== 'undefined' && title.active) return;
    const inst = window.__instance; if (inst && inst !== AFTER.id) return;
    const mmSize = narrow ? 96 : 150, mmx = VW - mmSize - 14, mmy = 14;
    const tight = isTouch && narrow;
    const w = tight ? 44 : 60, h = tight ? 14 : 18, x = tight ? mmx + 4 : mmx + mmSize / 2 - w / 2, y = tight ? mmy + mmSize - h - 4 : mmy + mmSize + 18;
    const t = dayT(), night = inst === AFTER.id || t >= LIGHT, p = inst === AFTER.id ? 0.5 : night ? (t - LIGHT) / (DAY - LIGHT) : t / LIGHT;
    roundRect(g, x, y, w, h, 6); g.fillStyle = night ? 'rgba(10,14,40,0.82)' : 'rgba(10,14,22,0.7)'; g.fill();
    const r = h - 4, cx = x + w / 2, by = y + h - 2;
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, by, r, Math.PI, 0); g.stroke();
    const ang = Math.PI - p * Math.PI, dx = cx + Math.cos(ang) * r, dy = by - Math.sin(ang) * r;
    if (!night) {
      g.fillStyle = '#ffd166'; g.beginPath(); g.arc(dx, dy, 3.2, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,209,102,0.6)'; for (let k = 0; k < 6; k++) { const q = k / 6 * Math.PI * 2; g.beginPath(); g.moveTo(dx + Math.cos(q) * 4.2, dy + Math.sin(q) * 4.2); g.lineTo(dx + Math.cos(q) * 5.8, dy + Math.sin(q) * 5.8); g.stroke(); }
    } else {
      g.fillStyle = '#e8ecff'; g.beginPath(); g.arc(dx, dy, 3.4, 0, 7); g.fill();
      g.fillStyle = 'rgba(10,14,40,0.95)'; g.beginPath(); g.arc(dx + 1.7, dy - 0.8, 2.7, 0, 7); g.fill();
    }
  });

  // ---------- test / debug handle ----------
  window.NIGHT = { DAY, LIGHT, DUSK, phase, alpha, overlay: overlayAlpha, dayT, alive: nightAlive, resetTimer: () => { spawnT = 0; }, timer: () => spawnT, canSpawn, inNoGo, noGoRects, tiles: { crypt: T_CRYPT, deadTree: T_DEAD } };

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const elapsed = Math.round(time);
    const inst = () => window.INSTANCES ? INSTANCES.active() : null;
    const leave = () => { if (inst()) INSTANCES.leave(); };
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
    const lines = () => [dialog.cur, ...dialog.queue].filter(Boolean).map(d => d.text);
    const nightMs = () => monsters.filter(m => m.night);
    leave(); h.peace(true); const hp0 = player.hp, day0 = player.dayTime;
    // the clock
    { player.dayTime = LIGHT - 1; F.sim(1, []); const d = phase(); const a0 = alpha();
      player.dayTime = LIGHT + 0.5; F.sim(1, []); const du = phase(); player.dayTime = LIGHT + 30; const aMid = alpha();
      player.dayTime = LIGHT + DUSK - 0.5; F.sim(60, []); const ni = phase(), aN = alpha();
      player.dayTime = DAY - 0.5; F.sim(60, []); const dawn = phase(), aD = alpha();
      check('night: 10-minute clock — 7 min day, 1 min dusk (overlay ramps 0 → 0.55), 2 min night, then dawn; player.dayTime is the clock', d === 'day' && a0 === 0 && du === 'dusk' && Math.abs(aMid - 0.275) < 0.01 && ni === 'night' && aN === NIGHT_ALPHA && dawn === 'day' && aD === 0 && typeof player.dayTime === 'number', { elapsedBeforeThisTest: elapsed, d, a0, du, aMid: +aMid.toFixed(3), ni, aN, dawn, aD }); }
    // zombies rise outdoors at night, at most four, and crumble at dawn
    { const o = h.openSpot(40, 20); F.tp(o.x, o.y); drain(); player.dayTime = LIGHT + DUSK + 1; NIGHT.resetTimer(); h.peace(false); player.hp = 100000;
      const before = nightMs().length;
      F.sim(SPAWN_EVERY * 60 + 6, []); const first = nightMs().filter(m => !m.dead); const n1 = first.length;
      const farEnough = first.every(m => { const d = dist(m.home.x, m.home.y, m.rose.x, m.rose.y) / TILE; return d >= 7.5 && d <= 12.6; });
      const plain = first.every(m => m.type === 'zombie' && m.night && !m.dead && m.hp === 40 && m.speed === 70);
      for (const m of first) m.stunT = 999;
      F.sim(SPAWN_EVERY * 60 * 3 + 12, []); const all = nightMs().filter(m => !m.dead); for (const m of all) m.stunT = 999;
      const capped = all.length === MAX_ZOMBIES && all.every(m => !collides(m.x, m.y, m.r, 'beast'));
      player.dayTime = DAY - 0.2; F.sim(30, []); const gone = nightMs().length === 0 && !monsters.some(m => m.type === 'zombie' || m.type === 'grave_zombie');
      check('night: zombies rise 8–12 tiles off every 20 s outdoors after dark (1–2 at a time, max 4), then crumble at dawn', before === 0 && n1 >= 1 && n1 <= 2 && farEnough && plain && capped && gone, { before, n1, farEnough, plain, alive: all.length, capped, gone, region: player.region });
      // a killed zombie never respawns
      player.dayTime = LIGHT + DUSK + 1; NIGHT.resetTimer(); F.sim(SPAWN_EVERY * 60 + 6, []); const z = nightMs().find(m => !m.dead); let never = false, kills = 0;
      if (z) { for (const m of nightMs()) if (m !== z) { m.stunT = 999; m.x = player.x - 300; m.y = player.y; } const k0 = player.kills, d0 = drops.length; z.hp = 1; z.x = player.x + 40; z.y = player.y; z.stunT = 0; player.facing = { x: 1, y: 0 }; for (let i = 0; i < 80 && !z.dead; i++) { z.x = player.x + 40; z.y = player.y; z.stunT = 0; player.attackCd = 0; F.press('Space'); F.sim(2, []); } kills = player.kills - k0; const dropped = drops.length > d0; F.tp(o.x + 8, o.y); F.sim(60 * 30, []); never = z.dead && !monsters.includes(z) && dropped; }
      check('night: a slain zombie drops coins and stays down (removed after its death animation, no respawn)', !!z && never && kills >= 1, { found: !!z, never, kills });
      for (const m of nightMs()) m.stunT = 999; player.dayTime = 0; F.sim(3, []); drops = drops.filter(d => dist(d.x, d.y, tc(o.x), tc(o.y)) > 20 * TILE); h.peace(true); }
    // near graves the dead rise stronger
    { F.tp(STEP_T.x, STEP_T.y); player.dayTime = LIGHT + DUSK + 1; NIGHT.resetTimer(); h.peace(false); F.sim(SPAWN_EVERY * 60 + 6, []);
      const gz = nightMs().filter(m => !m.dead); for (const m of gz) m.stunT = 999;
      check('night: beside the Wolfwood graves the risen are grave zombies (lv 24, 90 hp)', gz.length >= 1 && gz.every(m => m.type === 'grave_zombie' && m.maxHp === 90) && MONSTER_DEFS.grave_zombie.level === 24 && tileAt(GRAVE_T.x, GRAVE_T.y) === T.GRAVE && WOLFWOOD_GRAVES.every(([x, y]) => tileAt(x, y) === T.GRAVE), { n: gz.length, types: gz.map(m => m.type) });
      player.dayTime = 0; F.sim(3, []); h.peace(true); }
    // never inside Thistledown
    { F.tp(112, 33); player.dayTime = LIGHT + DUSK + 1; NIGHT.resetTimer(); h.peace(false); F.sim(SPAWN_EVERY * 60 + 30, []); const n = nightMs().length; const can = NIGHT.canSpawn();
      check('night: nothing rises inside Thistledown (village bounds + region), the timer never fires there', n === 0 && !can && player.region === 'Thistledown', { n, can, region: player.region });
      player.dayTime = 0; F.sim(3, []); h.peace(true); }
    // never inside the goblin city: with the knight in Grubmarket the dead rise on the shore outside the city rects, never in them, and one
    // that is sent across the line turns back (the rects come from REGIONS by name, as the spawner reads them)
    { const city = REGIONS.filter(r => r.name === 'Grubmarket' || r.name === 'Castle Gnash');
      if (city.length === 2) {
        const inCity = (tx, ty) => city.some(r => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1);
        const tileOf = m => [Math.floor(m.x / TILE), Math.floor(m.y / TILE)];
        leave(); closePanel(); F.tp(215, 30); F.sim(2, []); drain(); player.dayTime = LIGHT + DUSK + 1; NIGHT.resetTimer(); h.peace(false); player.hp = 100000;
        const seen = new Set(); let inside = 0, ticks = 0; const can = NIGHT.canSpawn();
        for (let i = 0; i < SPAWN_EVERY * 60 * 5 + 30; i++) {
          F.step([]); ticks++;
          for (const m of nightMs()) { if (m.dead) continue; seen.add(m); if (inCity(...tileOf(m))) inside++; }
        }
        const rose = seen.size; const homes = [...seen].map(m => [Math.floor(m.home.x / TILE), Math.floor(m.home.y / TILE)]);
        const homesOutside = homes.every(([x, y]) => !inCity(x, y)) && homes.every(([x, y]) => !NIGHT.inNoGo(x, y));
        check('night: with the knight in Grubmarket the dead still rise (on the shore, outside the city rects) and none is ever inside Grubmarket or Castle Gnash', can && player.region === 'Grubmarket' && rose >= 1 && inside === 0 && homesOutside, { can, region: player.region, rose, inside, homes, ticks });
        // the line: a zombie set on the road just west of the market, hungry for a knight standing inside it, is turned back every time it crosses
        const z = [...seen].find(m => !m.dead) || null; let held = false, turned = 0, crossedTo = null;
        if (z) { for (const m of nightMs()) if (m !== z) m.stunT = 999; const gm = city.find(r => r.name === 'Grubmarket');
          F.tp(gm.x0 + 2, 30); z.x = tc(gm.x0 - 1); z.y = tc(30); z.home = { x: z.x, y: z.y }; z.lastOut = null; z.state = 'idle'; z.stunT = 0; z.turned = 0; z.angry = true; z.hp = z.maxHp;
          let never = true; for (let i = 0; i < 240; i++) { F.step([]); if (inCity(...tileOf(z))) { never = false; crossedTo = tileOf(z); } }
          turned = z.turned; held = never && !z.dead && tileOf(z)[0] < gm.x0; }
        check('night: a zombie chasing a knight into Grubmarket is turned back at the city line (never inside after a tick, sent home)', !!z && held && turned >= 1, { found: !!z, held, turned, crossedTo, at: z && tileOf(z), state: z && z.state });
        for (const m of nightMs()) m.stunT = 999; player.dayTime = 0; F.sim(3, []); h.peace(true); drops = drops.filter(d => dist(d.x, d.y, tc(215), tc(30)) > 30 * TILE); }
      else check('night: the goblin city regions (33-goblincity) are present for the no-go check', false, { names: REGIONS.map(r => r.name) }); }
    // one darkness at a time: Deepholm, the starting cave and dark instances keep their own lights
    { player.dayTime = LIGHT + DUSK + 1; F.tp(14, 80); F.sim(2, []); const dh = NIGHT.overlay(), dhRegion = player.region; F.tp(4, 7); F.sim(2, []); const cave = NIGHT.overlay();
      const o = h.openSpot(40, 20); F.tp(o.x, o.y); F.sim(2, []); const open = NIGHT.overlay();
      check('night: the overlay is 0.55 in the open after dark and 0 in Deepholm and the starting cave (they draw their own darkness)', open === NIGHT_ALPHA && dh === 0 && dhRegion === 'Deepholm' && cave === 0, { open, dh, dhRegion, cave });
      player.dayTime = 0; F.sim(3, []); }
    // the grave reveals the crypt door once
    { N().crypt = false; changeTile(CRYPT_T.x, CRYPT_T.y, T.DIRT); drain(); F.tp(GRAVE_T.x, GRAVE_T.y + 1); F.face(GRAVE_T.x, GRAVE_T.y); F.press('KeyE'); F.sim(2, []);
      const revealed = tileAt(CRYPT_T.x, CRYPT_T.y) === T_CRYPT && N().crypt === true && mapDiffs.get(idx(CRYPT_T.x, CRYPT_T.y)) === T_CRYPT;
      const said = lines().some(t => /The earth beside it has been disturbed/.test(t)) && lines().some(t => /door in the ground/.test(t));
      drain(); F.press('KeyE'); F.sim(2, []); const again = lines().some(t => /disturbed/.test(t)) && !lines().some(t => /door in the ground/.test(t)) && tileAt(CRYPT_T.x, CRYPT_T.y) === T_CRYPT;
      check("night: E on the last knight's grave says the earth is disturbed and reveals the crypt door east of it, once (persisted in mapDiffs)", revealed && said && again, { revealed, said, again, tile: tileAt(CRYPT_T.x, CRYPT_T.y), lines: lines() }); }
    if (!window.INSTANCES) { check('night: INSTANCES present for the Afterlands', false, {}); player.dayTime = day0; player.hp = hp0; h.peace(false); return; }
    // down into the Afterlands
    const sum = () => { let s = 0; for (let i = 0; i < map.length; i++) s = (Math.imul(s, 31) + map[i]) | 0; return s; };
    const enter = () => { leave(); closePanel(); F.tp(STEP_T.x, STEP_T.y); F.face(CRYPT_T.x, CRYPT_T.y); F.press('KeyE'); F.sim(2, []); return inst() === AFTER.id; };
    const rg0 = regrow, fr0 = fires; regrow = []; fires = [];
    const sum0 = sum(), n0 = monsters.length;
    { drain(); quest.instances && (quest.instances.visited[AFTER.id] = false); const ok = enter(); F.sim(2, []);
      const calm = monsters.filter(m => m.type === 'zombie_calm'), gcalm = monsters.filter(m => m.type === 'grave_zombie_calm'), vamps = monsters.filter(m => m.type === 'vampire'), count = monsters.filter(m => m.type === 'count_ashvane');
      const neutral = [...calm, ...gcalm].every(m => !m.angry && !MONSTER_DEFS[m.type].aggro && m.state !== 'chase') && MONSTER_DEFS.zombie_calm.name === 'Zombie';
      const hostile = vamps.every(m => m.angry && MONSTER_DEFS.vampire.aggro) && MONSTER_DEFS.vampire.speed === 190 && MONSTER_DEFS.vampire.hp === 110;
      const voice = lines().some(t => /Night never ends here/.test(t));
      const toCount = F.bfs(AF_ENTRY[0], AF_ENTRY[1], AF_COUNT[0], AF_COUNT[1]), toGraves = F.bfs(AF_ENTRY[0], AF_ENTRY[1], 13, 27);
      let graves = 0, dead = 0, cw = 0; for (let y = 0; y < AFTER.h; y++) for (let x = 0; x < AFTER.w; x++) { const t = tileAt(x, y); if (t === T.GRAVE) graves++; else if (t === T_DEAD) dead++; else if (t === T.CWALL) cw++; }
      check('night: the crypt door opens the Afterlands (region set, the Voice speaks, night drawn): 6 calm zombies + 2 calm grave zombies, 3 vampires, the count; graves, dead trees, a stone chapel; paths reach the count and the graveyard', ok && player.region === AFTER.name && !!areaBanner && areaBanner.name === AFTER.name && calm.length === 6 && gcalm.length === 2 && vamps.length === 3 && count.length === 1 && neutral && hostile && voice && tileAt(AF_EXIT[0], AF_EXIT[1]) === T_CRYPT && tileAt(AF_FIRE[0], AF_FIRE[1]) === T.FIRE && graves >= 20 && dead >= 30 && cw >= 40 && !!toCount && !!toGraves && NIGHT.overlay() === NIGHT_ALPHA && NIGHT.canSpawn() === false, { ok, region: player.region, calm: calm.length, gcalm: gcalm.length, vamps: vamps.length, count: count.length, neutral, hostile, voice, graves, dead, cw, toCount: toCount && toCount.length, toGraves: toGraves && toGraves.length }); }
    // a vampire drinks: half of every hit comes back as health
    { const v = monsters.find(m => m.type === 'vampire'); v.hp = 50; v.x = player.x + 30; v.y = player.y; player.hp = 100000; const ph0 = player.hp;
      hurtPlayer(10, v.x, v.y, true); const healed = v.hp === 55 && player.hp === ph0 - 10;
      hurtPlayer(200, v.x, v.y, true); const capped = v.hp === v.maxHp;
      check('night: a vampire heals half of the damage it deals (capped at full health)', healed && capped, { healed, hp: v.hp, capped, max: v.maxHp }); }
    // the count steps through the dark to stand behind you
    { const c = monsters.find(m => m.type === 'count_ashvane'); F.tp(30, 12); player.facing = { x: 1, y: 0 }; c.x = player.x + 5 * TILE; c.y = player.y; c.home = { x: c.x, y: c.y }; c.state = 'chase'; c.stunT = 0; c.tpT = 0.02; h.peace(false); F.sim(3, []);
      const behind = c.x < player.x && Math.abs(c.x - (player.x - 3 * TILE)) <= 1.5 * TILE && Math.abs(c.y - player.y) <= 1.5 * TILE && c.tpT > 5 && c.state === 'chase';
      h.peace(true); c.stunT = 0;
      check('night: Count Ashvane (lv 40, 300 hp, boss) teleports three tiles behind the knight every 6 s', behind && MONSTER_DEFS.count_ashvane.level === 40 && MONSTER_DEFS.count_ashvane.hp === 300 && MONSTER_DEFS.count_ashvane.maxHit === 18, { behind, at: [+(c.x / TILE).toFixed(1), +(c.y / TILE).toFixed(1)], me: [+(player.x / TILE).toFixed(1), +(player.y / TILE).toFixed(1)], tpT: c.tpT }); }
    // the count falls: DUNGEON CLEARED, a fang every time, the shadow cloak once
    { const q = quest.instances; q.cleared[AFTER.id] = 0;
      let free = player.inv.filter(s => !s).length; for (let i = player.inv.length - 1; i >= 0 && free < 4; i--) { const s = player.inv[i]; if (s && s.id !== 'coins' && !ITEMS[s.id].weapon && !ITEMS[s.id].armour) { player.inv[i] = null; free++; } }
      const have = id => countItem(id) + drops.filter(d => d.id === id).reduce((s, d) => s + d.qty, 0);
      const kill = () => { const c = monsters.find(m => m.type === 'count_ashvane'); player.facing = { x: 1, y: 0 }; for (let i = 0; i < 80 && !c.dead; i++) { c.hp = 1; c.x = player.x + 44; c.y = player.y; c.stunT = 0; c.tpT = 99; player.attackCd = 0; F.press('Space'); F.sim(3, []); } return c.dead; };
      const f0 = have('vampire_fang'), c0 = have('shadow_cloak');
      const k1 = kill(); F.sim(3, []); const banner = !!levelBanner && levelBanner.text === 'DUNGEON CLEARED'; const c1 = have('shadow_cloak') - c0, f1 = have('vampire_fang') - f0;
      check('night: killing the count shows DUNGEON CLEARED, drops a vampire fang and (first time) the shadow cloak (body, def 14, value 900)', k1 && banner && c1 === 1 && f1 >= 1 && q.cleared[AFTER.id] === 1 && ITEMS.shadow_cloak.armour.slot === 'body' && ITEMS.shadow_cloak.armour.def === 14 && ITEMS.shadow_cloak.value === 900 && ITEMS.vampire_fang.value === 400 && ITEMS.vampire_fang.shape === 'dagger', { k1, banner: levelBanner && levelBanner.text, cloak: c1, fang: f1, cleared: q.cleared[AFTER.id] });
      drops = drops.filter(d => !['shadow_cloak', 'vampire_fang', 'coins', 'grave_dust'].includes(d.id)); const c2b = have('shadow_cloak'), f2b = have('vampire_fang');
      const back = enter(); const fresh = monsters.some(m => m.type === 'count_ashvane' && !m.dead); const k2 = kill(); F.sim(3, []);
      check('night: a second visit brings the count back; a second kill gives another fang but no second cloak', back && fresh && k2 && have('shadow_cloak') === c2b && have('vampire_fang') === f2b + 1 && q.cleared[AFTER.id] === 2, { back, fresh, k2, cloak: have('shadow_cloak') - c2b, fang: have('vampire_fang') - f2b });
      drops = drops.filter(d => !['shadow_cloak', 'vampire_fang', 'coins', 'grave_dust'].includes(d.id)); }
    // E on the crypt door inside climbs back out; the overworld comes back exactly
    { if (!inst()) enter(); F.tp(AF_EXIT[0], AF_EXIT[1] + 1); F.face(AF_EXIT[0], AF_EXIT[1]); F.press('KeyE'); F.sim(2, []);
      const out = inst() === null && window.__instance === null;
      check('night: E on the crypt door inside leaves the Afterlands; you stand on the step in Wolfwood and the overworld is restored (checksum, monsters, crypt door still there)', out && Math.floor(player.x / TILE) === STEP_T.x && Math.floor(player.y / TILE) === STEP_T.y && player.region === 'Wolfwood' && sum() === sum0 && monsters.length === n0 && tileAt(CRYPT_T.x, CRYPT_T.y) === T_CRYPT && !REGIONS.some(r => r.name === AFTER.name), { out, at: [Math.floor(player.x / TILE), Math.floor(player.y / TILE)], region: player.region, same: sum() === sum0, monsters: monsters.length, n0 }); }
    leave(); regrow = rg0; fires = fr0; player.dayTime = 0; player.hp = Math.min(hp0, player.maxHp); h.peace(false); save();
  });
}
