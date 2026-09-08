// ============================================================================
// THE HOLLOWFORD GUILD (feature file; registers through HOOKS only, edits no core file)
// Cohen: "the house that the people are in — they should be trapped; in a quest you free them and you
// create a guild where they do stuff." The trapping and freeing live in 20-hollowford (Under the Chapel);
// this file is the guild. Once the crypt is open (quest.hollowford.freed) AND the first house stands
// (quest.rebuild.done.house, 31-rebuild), Old Tam founds The Hollowford Guild in the burned house on the
// east street: a hall with GUILD over the door, a job board and a storage chest inside.
//   Jobs (repeatable, 10 minutes of game time between repeats of the same job):
//     Escort   — Pip follows you to the notice board in Thistledown's square (120 coins)
//     Timber   — deliver 20 planks (80 coins + 100 Crafting xp)
//     Scrap    — deliver 15 goblin scrap (150 coins)
//     Wolves   — kill 5 wolves after taking the job (200 coins + 100 Melee xp)
//   Rank: every 3 jobs — Recruit, Member, Warden, Captain, Guildmaster. Warden opens the guild chest
//   (20 stacks), Captain sells the guild cape (500 coins, def 8), Guildmaster puts Tam, Nell and Pip to work
//   in the hall (they walk between the board, the chest and the door).
// State: quest.guild = { founded, rank, jobsDone, cooldowns: {id: time}, active: {id, kills} | null, chest: [20], nudged }.
// The hall ruin is carved at world gen; founding rebuilds it through changeTile so it persists in the save.
// ============================================================================
{
  // ---------- places ----------
  const HALL = { id: 'guild_hall', x: 150, y: 66, w: 7, h: 6, name: 'The Hollowford Guild', roof: '#7a2e2e', sign: 'GUILD', door: 3 };
  const T_GBOARD = addTile('GUILD_BOARD', { solid: true, tex: 'floor', mini: '#8a6a3a' });
  const T_GCHEST = addTile('GUILD_CHEST', { solid: true, tex: 'floor', mini: '#c9a02a' });
  INTERESTING_TILES.add(T_GBOARD); INTERESTING_TILES.add(T_GCHEST); // the core E highlight and reach
  HALL.f = [[T.SHELF, 1, 1], [T_GBOARD, 3, 1], [T_GCHEST, 5, 1], [T.TABLE, 1, 3], [T.RUG, 3, 3]];
  const BOARD_POS = { x: HALL.x + 3, y: HALL.y + 1 }, CHEST_POS = { x: HALL.x + 5, y: HALL.y + 1 }, DOOR_POS = { x: HALL.x + HALL.door, y: HALL.y + HALL.h - 1 };
  const STEP_PATH = [[153, 72], [152, 72], [151, 72], [150, 72], [150, 73], [150, 74], [150, 75], [150, 76]]; // the doorstep down to the east street (y 77)
  const WAYPOINTS = [[152, 68], [155, 68], [153, 70]]; // where the staff walk: in front of the board, the chest, and inside the door
  const TOWN_BOARD = { x: 105, y: 27 };                // Thistledown's notice board (29-quests)
  const HF_RECT = { x0: 122, y0: 66, x1: 156, y1: 92 };
  const inHall = (tx, ty) => tx >= HALL.x && tx < HALL.x + HALL.w && ty >= HALL.y && ty < HALL.y + HALL.h;
  const hallInside = (tx, ty) => tx > HALL.x && tx < HALL.x + HALL.w - 1 && ty > HALL.y && ty < HALL.y + HALL.h - 1;

  // ---------- rules ----------
  const COOLDOWN = 600, CHEST_SLOTS = 20, JOBS_PER_RANK = 3;
  const RANKS = ['Recruit', 'Member', 'Warden', 'Captain', 'Guildmaster'];
  const CHEST_RANK = 2, CAPE_RANK = 3, STAFF_RANK = 4, CAPE_PRICE = 500;
  const CAPE_SLOT = EQUIP_SLOTS.includes('cape') ? 'cape' : 'body';
  ITEMS.guild_cape = { id: 'guild_cape', name: 'Guild cape', value: CAPE_PRICE, color: '#7a2e2e', shape: 'cape', stack: 1, armour: { slot: CAPE_SLOT, def: 8 } };
  const JOBS = [
    { id: 'escort', tag: 'Escort', title: 'Escort Pip', kind: 'escort', reward: { coins: 120 }, who: 'Pip',
      blurb: 'Walk Pip to the notice board in Thistledown. He wants to read every paper on it.', need: 'Walk him to the notice board in Thistledown square',
      taken: "I'm ready. I've got my boots on. Both of them. Which way is Thistledown?", thanks: 'Look at all the PAPERS. Somebody wants ten potatoes. Somebody wants WOLVES. Thank you for walking me. Tam said to pay you.' },
    { id: 'timber', tag: 'Timber', title: 'Timber run', kind: 'deliver', item: 'plank', n: 20, reward: { coins: 80, xp: ['crafting', 100] }, who: 'Nell',
      blurb: 'Twenty planks for the hall. Floors, shelves, a bench that does not wobble.', thanks: 'Twenty planks, straight ones. The floor goes in tonight. Coin from the guild purse.' },
    { id: 'scrap', tag: 'Scrap', title: 'Scrap run', kind: 'deliver', item: 'goblin_scrap', n: 15, reward: { coins: 150 }, who: 'Nell',
      blurb: 'Fifteen goblin scrap. Hinges, latches, a lock for the chest. Goblins carry the best iron.', thanks: 'Fifteen. Every piece of this was pointed at us once. Now it holds our door shut. Here.' },
    { id: 'wolf', tag: 'Wolves', title: 'Wolf patrol', kind: 'kill', type: 'wolf', n: 5, reward: { coins: 200, xp: ['melee', 100] }, who: 'Old Tam',
      blurb: 'Five wolves off the roads while the job is yours. Ones you got before you took it do not count.', thanks: 'Five wolves. The road to Thistledown is a road again. The guild pays, and the guild remembers.' },
  ];
  const byId = {}; for (const j of JOBS) byId[j.id] = j;
  const RANK_LINES = [null,
    'A Member. Say it in the square and see who buys you a drink. Two more ranks and the chest is yours.',
    'Warden of the Hollowford Guild. The chest in the hall is open to you now. Twenty stacks, and nobody touches them but you.',
    'Captain. There is a cape on the board with the guild colour on it. Five hundred coins, and worth every one.',
    'Guildmaster. Guildmaster! Nell, Pip, the knight runs the guild now. Right. Then we had better get to work.'];

  // ---------- state ----------
  const fresh = () => ({ founded: false, rank: 0, jobsDone: 0, cooldowns: {}, active: null, chest: new Array(CHEST_SLOTS).fill(null), nudged: false });
  const G = () => {
    if (!quest.guild) quest.guild = fresh();
    const g = quest.guild;
    if (!g.cooldowns || typeof g.cooldowns !== 'object') g.cooldowns = {};
    if (typeof g.rank !== 'number') g.rank = 0; if (typeof g.jobsDone !== 'number') g.jobsDone = 0; g.rank = clamp(g.rank | 0, 0, RANKS.length - 1);
    if (g.active && !byId[g.active.id]) g.active = null;
    if (!Array.isArray(g.chest) || g.chest.length !== CHEST_SLOTS) { const c = new Array(CHEST_SLOTS).fill(null); (Array.isArray(g.chest) ? g.chest : []).forEach((s, i) => { if (i < CHEST_SLOTS && s && ITEMS[s.id]) c[i] = s; }); g.chest = c; }
    else for (let i = 0; i < CHEST_SLOTS; i++) if (g.chest[i] && !ITEMS[g.chest[i].id]) g.chest[i] = null; // an item from a removed feature file
    return g;
  };
  let escort = null; // Pip on the road: { px, py, facing, walkT, moving, stuckT } (transient; rebuilt from quest.guild.active on load)
  let staff = [];    // Tam, Nell and Pip in the hall at rank 4 (transient)
  HOOKS.newGame.push(() => { quest.guild = fresh(); escort = null; staff = []; });

  const freed = () => !!(quest.hollowford && quest.hollowford.freed);
  const houseDone = () => !!(quest.rebuild && quest.rebuild.done && quest.rebuild.done.house);
  const canFound = () => freed() && houseDone();
  const rankName = () => RANKS[G().rank];
  const jobsToRank = r => Math.max(0, r * JOBS_PER_RANK - G().jobsDone);
  const readyAt = j => (typeof G().cooldowns[j.id] === 'number' ? G().cooldowns[j.id] : -1e9) + COOLDOWN;
  const cooling = j => time < readyAt(j);
  const coolText = j => { const s = Math.max(1, Math.ceil(readyAt(j) - time)); return s >= 60 ? `Ready in ${Math.ceil(s / 60)}m` : `Ready in ${s}s`; };
  const isActive = j => !!G().active && G().active.id === j.id;
  const skillName = key => SKILL_DEFS.find(s => s.key === key).name;
  const rewardText = j => { const r = j.reward, parts = []; if (r.coins) parts.push(`${r.coins} coins`); if (r.xp) parts.push(`${r.xp[1]} ${skillName(r.xp[0])} xp`); return parts.join(' + '); };
  const progressText = j => {
    if (j.kind === 'deliver') return `Bring ${j.n} ${ITEMS[j.item].name} (${Math.min(j.n, countItem(j.item))}/${j.n})`;
    if (j.kind === 'kill') return isActive(j) ? `Wolves ${Math.min(j.n, G().active.kills || 0)}/${j.n}` : `Defeat ${j.n} wolves after taking the job`;
    return isActive(j) ? 'Pip is with you: walk to the notice board in Thistledown' : j.need;
  };

  // ---------- the hall ----------
  const build = b => {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      const edge = x === b.x || y === b.y || x === b.x + b.w - 1 || y === b.y + b.h - 1;
      changeTile(x, y, edge ? T.HWALL : T.FLOOR);
    }
    changeTile(b.x + b.door, b.y + b.h - 1, T.DOOR);
    for (const [t, rx, ry] of b.f || []) changeTile(b.x + rx, b.y + ry, t);
    if (SOLID.has(tileAt(b.x + b.door, b.y + b.h))) changeTile(b.x + b.door, b.y + b.h, T.DIRT);
    burst(tc(b.x + b.w / 2), tc(b.y + b.h / 2), '#d8a95e', 30, 140);
  };
  const found = () => {
    const g = G(); g.founded = true; build(HALL);
    levelBanner = { text: 'THE HOLLOWFORD GUILD', sub: 'Founded by Old Tam', t: 4.5 }; sfx('quest'); burst(tc(DOOR_POS.x), tc(DOOR_POS.y), '#7a2e2e', 40, 180);
    say("A roof over the three of us, and folk coming back down the road. That's a town. Now a town needs a guild.", 'Old Tam');
    say("The burned house on the east street, past Pip's old cellar. Nell has put a board in it and I have put GUILD over the door. Jobs on the board, knight. Do them and rise: Recruit, Member, Warden, Captain. And one day, Guildmaster.", 'Old Tam');
    save();
  };

  // ---------- jobs ----------
  const rankUp = nr => {
    const g = G(); g.rank = nr;
    levelBanner = { text: `GUILD RANK: ${RANKS[nr].toUpperCase()}`, sub: 'The Hollowford Guild', t: 4.5 }; sfx('levelup'); burst(player.x, player.y, '#7a2e2e', 40, 180); burst(player.x, player.y, '#f5c542', 20, 120);
    if (RANK_LINES[nr]) say(RANK_LINES[nr], 'Old Tam');
    if (nr >= STAFF_RANK) staff = [];
  };
  const completeJob = j => {
    const g = G(); const r = j.reward;
    if (j.kind === 'deliver') removeItem(j.item, j.n);
    if (isActive(j)) g.active = null;
    if (j.id === 'escort') escort = null;
    g.cooldowns[j.id] = time; g.jobsDone += 1;
    if (r.coins) { giveOrDrop('coins', r.coins, player.x, player.y, true); floatText(player.x, player.y - 30, `+${r.coins} coins`, '#ffd166'); }
    if (r.xp) { gainXp(r.xp[0], r.xp[1]); floatText(player.x, player.y - 46, `+${r.xp[1]} ${skillName(r.xp[0])} xp`, '#58a6ff', 13); }
    say(j.thanks, j.who);
    levelBanner = { text: 'GUILD JOB DONE', sub: `${j.title} · ${g.jobsDone} job${g.jobsDone === 1 ? '' : 's'} · ${rankName()}`, t: 2.6 }; burst(player.x, player.y, '#ffe066', 16, 110); sfx('quest');
    const nr = Math.min(RANKS.length - 1, Math.floor(g.jobsDone / JOBS_PER_RANK));
    if (nr > g.rank) rankUp(nr);
    save();
  };
  const deliver = j => {
    if (cooling(j)) { notify(`${j.title}: ${coolText(j).toLowerCase()}.`); return false; }
    if (countItem(j.item) < j.n) { notify(`${j.title} needs ${j.n} ${ITEMS[j.item].name}. You have ${countItem(j.item)}.`); return false; }
    completeJob(j); return true;
  };
  const besidePlayer = () => safeSpot(player.x - player.facing.x * 40, player.y - player.facing.y * 40, 13, 'person') || { x: player.x, y: player.y };
  const spawnEscort = () => { const p = besidePlayer(); escort = { px: p.x, py: p.y, facing: { x: 0, y: 1 }, walkT: 0, moving: false, stuckT: 0 }; };
  const takeJob = j => {
    const g = G();
    if (cooling(j)) { notify(`${j.title}: ${coolText(j).toLowerCase()}.`); return false; }
    if (g.active) { notify(`One job at a time. ${byId[g.active.id].title} first, or cancel it on the board.`); return false; }
    g.active = { id: j.id, kills: 0 };
    if (j.kind === 'escort') { spawnEscort(); say(j.taken, 'Pip'); }
    else notify(`Taken: ${j.title}. ${progressText(j)}.`);
    floatText(player.x, player.y - 30, j.title, '#ffe9a8', 13); save(); return true;
  };
  const cancelJob = () => { const g = G(); if (!g.active) return; const j = byId[g.active.id]; g.active = null; if (j.id === 'escort') { escort = null; say("Oh. All right. I'll wait in the hall. Next time?", 'Pip'); } else notify(`${j.title} put back on the board.`); save(); };
  HOOKS.kill.push(m => {
    const g = G(); const j = byId.wolf;
    if (!g.founded || !isActive(j) || m.type !== j.type) return;
    g.active.kills = (g.active.kills || 0) + 1;
    if (g.active.kills >= j.n) completeJob(j); else { notify(`Wolf patrol: ${g.active.kills}/${j.n}.`); save(); }
  });

  // ---------- chest ----------
  const chestAdd = (id, qty) => {
    const g = G(); const def = ITEMS[id]; let left = qty;
    for (const s of g.chest) if (s && s.id === id && s.qty < def.stack && left > 0) { const take = Math.min(def.stack - s.qty, left); s.qty += take; left -= take; }
    for (let i = 0; i < g.chest.length && left > 0; i++) if (!g.chest[i]) { const take = Math.min(def.stack, left); g.chest[i] = { id, qty: take }; left -= take; }
    return left;
  };
  const chestCount = () => G().chest.filter(Boolean).length;

  // ---------- cape ----------
  const buyCape = () => {
    const g = G();
    if (g.rank < CAPE_RANK) { notify(`The guild cape is for Captains. ${jobsToRank(CAPE_RANK)} more jobs.`); return false; }
    if (coins() < CAPE_PRICE) { notify(`The guild cape is ${CAPE_PRICE} coins. You have ${coins()}.`); return false; }
    if (!canFit('guild_cape', 1)) { notify('Your pack is full.'); return false; }
    payCoins(CAPE_PRICE); addItem('guild_cape', 1);
    levelBanner = { text: 'GUILD CAPE', sub: 'Hollowford red, defence +8', t: 3.5 }; sfx('levelup'); burst(player.x, player.y, '#7a2e2e', 30, 160);
    say('Hollowford red. Wear it where the goblins can see it.', 'Old Tam'); save(); return true;
  };

  // ---------- people: Pip on the road, the staff in the hall ----------
  const LOOKS = {
    tam: { name: 'Old Tam', tunic: '#5a5048', hair: '#d9d0c0', beard: true, lines: ['Guildmaster. I keep the books, you keep the roads. Fair.', 'A board, a chest, a door that shuts. I have wanted this since the fire.', 'Nell says the sign is crooked. The sign is fine.'] },
    nell: { name: 'Nell', tunic: '#6a4a4a', hair: '#3a2a1a', woman: true, lines: ['I sort the chest. Do not put fish in it. Somebody put fish in it.', 'The board wants jobs. I write them. You do them. That is a guild.', 'The sign is crooked. Tam says it is fine. It is crooked.'] },
    pip: { name: 'Pip', tunic: '#4a5a6a', hair: '#c9843a', lines: ['I am guild staff. I sweep. I am VERY good at sweeping.', 'Can we go to the notice board again? I did not finish reading it.', 'Guildmaster! Guildmaster! That is you. I am telling everyone.'] },
  };
  const mkStaff = (id, wp) => Object.assign({ id, px: tc(WAYPOINTS[wp][0]), py: tc(WAYPOINTS[wp][1]), wp, waitT: 1 + Math.random() * 2, facing: { x: 0, y: 1 }, walkT: 0, moving: false }, LOOKS[id]);
  const staffUpdate = dt => {
    const g = G();
    if (!g.founded || g.rank < STAFF_RANK) { if (staff.length) staff = []; return; }
    if (!staff.length) staff = [mkStaff('tam', 0), mkStaff('nell', 1), mkStaff('pip', 2)];
    for (const s of staff) {
      if (s.waitT > 0) { s.waitT -= dt; s.moving = false; continue; }
      const [wx, wy] = WAYPOINTS[(s.wp + 1) % WAYPOINTS.length]; const tx = tc(wx), ty = tc(wy); const dx = tx - s.px, dy = ty - s.py, d = Math.hypot(dx, dy);
      if (d < 3) { s.wp = (s.wp + 1) % WAYPOINTS.length; s.px = tx; s.py = ty; s.waitT = 2 + Math.random() * 3; s.moving = false; s.facing = { x: 0, y: s.wp === 2 ? 1 : -1 }; continue; }
      const step = Math.min(d, 42 * dt); s.px += dx / d * step; s.py += dy / d * step; // the hall floor between the waypoints is clear by construction
      s.facing = { x: dx / d, y: dy / d }; s.moving = true; s.walkT += dt * 8;
    }
  };
  const escortUpdate = dt => {
    const g = G(); const j = byId.escort;
    if (!g.founded || !isActive(j)) { if (escort) escort = null; return; }
    if (!escort) spawnEscort();
    const dp = dist(escort.px, escort.py, player.x, player.y);
    if (dp > 12 * TILE || (escort.stuckT > 2.5 && dp > 3 * TILE)) { const p = besidePlayer(); escort.px = p.x; escort.py = p.y; escort.stuckT = 0; burst(escort.px, escort.py, '#ffe9a8', 10, 60); }
    if (dp > 60) {
      const tx = player.x - player.facing.x * 44, ty = player.y - player.facing.y * 44; const dx = tx - escort.px, dy = ty - escort.py, d = Math.hypot(dx, dy) || 1;
      const e = { x: escort.px, y: escort.py, r: 13 }; const step = Math.min(d, 170 * dt); moveEntity(e, dx / d * step, dy / d * step, 'person');
      const moved = Math.abs(e.x - escort.px) > 0.01 || Math.abs(e.y - escort.py) > 0.01;
      if (moved) { escort.px = e.x; escort.py = e.y; escort.facing = { x: dx / d, y: dy / d }; escort.moving = true; escort.walkT += dt * 8; escort.stuckT = 0; } else { escort.moving = false; escort.stuckT += dt; }
    } else { escort.moving = false; escort.stuckT = 0; }
    if (dist(player.x, player.y, tc(TOWN_BOARD.x), tc(TOWN_BOARD.y)) < 3 * TILE && dist(escort.px, escort.py, player.x, player.y) < 4 * TILE) completeJob(j);
  };
  const staffInFront = () => {
    let best = null;
    for (const p of staff) { const dx = p.px - player.x, dy = p.py - player.y, d = Math.hypot(dx, dy); if (d > 64 || d < 1) continue; const dot = (dx / d) * player.facing.x + (dy / d) * player.facing.y; if (dot < 0.4) continue; if (!best || d < best.d) best = { p, d }; }
    return best && best.p;
  };
  if (typeof TAP_PEOPLE !== 'undefined') TAP_PEOPLE.push(() => staff.map(p => ({ x: p.px, y: p.py, r: 13, id: p.id, name: p.name, talk: () => useAction() }))); // 17-tap: a tap on the staff walks up; facing them, E's own path (HOOKS.use → staffInFront) talks

  // ---------- update ----------
  HOOKS.update.push(dt => {
    const g = G();
    if (!g.founded && !player.dead && canFound()) found();
    if (!g.founded) return;
    if (!g.nudged && !player.dead && player.region === 'Hollowford' && dist(player.x, player.y, tc(DOOR_POS.x), tc(DOOR_POS.y)) < 8 * TILE) { g.nudged = true; notify('The guild hall stands on the east street, GUILD over the door. The board inside has jobs on it.'); save(); }
    escortUpdate(dt); staffUpdate(dt);
  });

  // ---------- use ----------
  HOOKS.use.push((t, tx, ty) => {
    const g = G();
    if (t === T_GBOARD) { openPanel('guild'); return true; }
    if (t === T_GCHEST) {
      if (g.rank < CHEST_RANK) { say(`Guild property. The chest opens for Wardens and up. You are a ${rankName()}: ${jobsToRank(CHEST_RANK)} more job${jobsToRank(CHEST_RANK) === 1 ? '' : 's'}.`, 'Guild chest'); return true; }
      openPanel('guild_chest'); return true;
    }
    const p = staffInFront(); if (p) { p.facing = { x: Math.sign(player.x - p.px) || 0, y: Math.sign(player.y - p.py) || 1 }; p.waitT = Math.max(p.waitT, 2); say(pick(p.lines), p.name); return true; }
    return false;
  });

  // ---------- world: the burned house that becomes the hall, and its path to the street ----------
  HOOKS.world.push((rnd, api) => {
    const set = api.setTile;
    for (let y = HALL.y; y < HALL.y + HALL.h; y++) for (let x = HALL.x; x < HALL.x + HALL.w; x++) {
      const edge = x === HALL.x || x === HALL.x + HALL.w - 1 || y === HALL.y || y === HALL.y + HALL.h - 1, corner = (x === HALL.x || x === HALL.x + HALL.w - 1) && (y === HALL.y || y === HALL.y + HALL.h - 1), r = rnd();
      if (edge) set(x, y, corner || r < 0.6 ? T.HWALL : r < 0.78 ? T.RUBBLE : T.ASHES);
      else set(x, y, r < 0.12 ? T.RUBBLE : r < 0.5 ? T.ASHES : (T.SCORCH ?? T.DIRT));
    }
    set(DOOR_POS.x, DOOR_POS.y, T.ASHES); set(DOOR_POS.x, DOOR_POS.y - 1, T.ASHES); // the doorway and the step inside
    for (const [x, y] of STEP_PATH) set(x, y, T.DIRT);
  });

  // ---------- panels ----------
  const ROW_H = 66;
  const fit = (g, text, maxW) => { let s = text; while (s.length > 8 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1); return s === text ? text : s + '…'; };
  HOOKS.panel.guild = (g, narrow) => {
    const gd = G(); const next = gd.rank < RANKS.length - 1 ? `${jobsToRank(gd.rank + 1)} job${jobsToRank(gd.rank + 1) === 1 ? '' : 's'} to ${RANKS[gd.rank + 1]}` : 'the top of the guild';
    const { px, py, w, h } = panelBox(g, narrow ? VW - 20 : 600, 96 + JOBS.length * ROW_H + 62, 'The Hollowford Guild', `${rankName()} · ${gd.jobsDone} job${gd.jobsDone === 1 ? '' : 's'} done · ${next}`);
    const bw = narrow ? 100 : 130, textW = w - 36 - bw - 24;
    JOBS.forEach((j, i) => {
      const y = py + 66 + i * ROW_H; const act = isActive(j), cool = cooling(j), can = j.kind === 'deliver' ? countItem(j.item) >= j.n && !cool : !cool && !gd.active;
      roundRect(g, px + 18, y, w - 36, ROW_H - 6, 8); g.fillStyle = act ? 'rgba(88,166,255,0.12)' : cool ? 'rgba(255,255,255,0.03)' : can ? 'rgba(126,231,135,0.08)' : 'rgba(255,255,255,0.05)'; g.fill();
      if (can && !act) { g.strokeStyle = 'rgba(126,231,135,0.45)'; g.lineWidth = 1; g.stroke(); }
      g.textAlign = 'left'; g.fillStyle = cool ? '#6e7681' : '#e6edf3'; g.font = 'bold 13px sans-serif'; g.fillText(fit(g, `${j.title}  · ${j.who}`, textW), px + 30, y + 18);
      g.fillStyle = cool ? '#4b535d' : '#c9d1d9'; g.font = 'italic 12px sans-serif'; g.fillText(fit(g, `“${j.blurb}”`, textW), px + 30, y + 35);
      g.font = '11px sans-serif'; g.fillStyle = cool ? '#4b535d' : act ? '#58a6ff' : '#8b949e'; g.fillText(fit(g, `${cool ? coolText(j) : progressText(j)} · Reward: ${rewardText(j)}`, textW), px + 30, y + 51);
      const bx = px + w - 18 - bw, by = y + 15;
      if (cool) button(g, bx, by, bw, 30, coolText(j), () => { }, '#2a2f3a', false);
      else if (j.kind === 'deliver') button(g, bx, by, bw, 30, `Deliver: ${j.tag}`, () => deliver(j), '#238636', can);
      else if (act) button(g, bx, by, bw, 30, `Cancel: ${j.tag}`, cancelJob, '#6e2a2a');
      else button(g, bx, by, bw, 30, `Take: ${j.tag}`, () => takeJob(j), '#238636', can);
    });
    const fy = py + h - 44;
    const capeOn = gd.rank >= CAPE_RANK;
    button(g, px + 18, fy, narrow ? 120 : 150, 30, narrow ? `Cape ${CAPE_PRICE}` : `Buy cape (${CAPE_PRICE})`, buyCape, capeOn && coins() >= CAPE_PRICE ? '#7a2e2e' : '#2a2f3a', capeOn);
    button(g, px + w - 18 - 100, fy, 100, 30, 'Close', closePanel, '#21262d');
    g.fillStyle = '#6e7681'; g.font = '11px sans-serif'; g.textAlign = 'center';
    g.fillText(fit(g, capeOn ? `Captain's cape: Hollowford red, defence +${ITEMS.guild_cape.armour.def}. Every 3 jobs is a rank.` : gd.rank >= CHEST_RANK ? 'The guild chest by the wall is yours. Captains may buy the cape.' : `Every 3 jobs is a rank. Warden opens the chest, Captain earns the cape.`, w - 36 - (narrow ? 120 : 150) - 100 - 20), px + w / 2 + 20, fy + 20);
  };
  let chestPage = 0;
  HOOKS.panel.guild_chest = (g, narrow) => {
    const gd = G(); const cols = narrow ? 5 : 10, size = narrow ? 44 : 46, gap = 6, rows = Math.ceil(CHEST_SLOTS / cols), invRows = Math.ceil(INV_SLOTS / cols);
    const { px, py, w } = panelBox(g, cols * (size + gap) + 30, 78 + rows * (size + gap) + 34 + invRows * (size + gap) + 24, 'Guild chest', `${chestCount()} / ${CHEST_SLOTS} stacks · tap to move items · ${rankName()}`);
    for (let i = 0; i < CHEST_SLOTS; i++) {
      const cx = px + 18 + (i % cols) * (size + gap), cy = py + 66 + Math.floor(i / cols) * (size + gap), s = gd.chest[i];
      drawSlot(g, cx, cy, size, s, false);
      buttons.push({ x: cx, y: cy, w: size, h: size, label: 'gchest' + i, action: () => { const c = gd.chest[i]; if (!c) return; const left = addItem(c.id, c.qty); c.qty = left; if (!left) gd.chest[i] = null; else notify('Your pack is full.'); sfx('pickup'); save(); } });
    }
    const iy = py + 66 + rows * (size + gap) + 8;
    g.fillStyle = '#8b949e'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText('Your pack (tap an item to store it)', px + 18, iy + 12);
    drawInvGrid(g, px + 18, iy + 22, cols, size, gap, i => { const s = player.inv[i]; if (!s) return; const left = chestAdd(s.id, s.qty); if (left === s.qty) { notify('The chest is full.'); return; } s.qty = left; if (!left) player.inv[i] = null; sfx('pickup'); save(); });
  };

  // ---------- quest tab ----------
  QUEST_DEFS.guild = { name: 'The Hollowford Guild' };
  HOOKS.activeQuests.push(() => G().founded && G().active ? ['guild'] : []);
  HOOKS.questText.guild = () => { const g = G(); if (!g.founded) return 'Free the survivors and build the first house, and Tam will found a guild.'; const j = g.active && byId[g.active.id]; return j ? `${j.title}: ${progressText(j)} · ${rankName()}` : `${rankName()} · jobs on the board in the guild hall, Hollowford's east street.`; };

  // ---------- drawing ----------
  const drawGuildBoard = (g, tx, ty, mark) => {
    const cx = tc(tx), cy = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 18, 20, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#5a3e1e'; g.fillRect(cx - 18, cy - 26, 5, 46); g.fillRect(cx + 13, cy - 26, 5, 46);
    g.fillStyle = '#8a6a3a'; g.fillRect(cx - 23, cy - 34, 46, 31); g.strokeStyle = '#4a2e13'; g.lineWidth = 1.5; g.strokeRect(cx - 23, cy - 34, 46, 31);
    g.fillStyle = '#7a2e2e'; g.fillRect(cx - 23, cy - 40, 46, 7); g.fillStyle = '#f5c542'; g.font = `700 6px ${DISPLAY}`; g.textAlign = 'center'; g.fillText('GUILD', cx, cy - 34.5); // the red header board
    const papers = [[-19, -30, 11, 13, -0.08], [-5, -31, 10, 12, 0.06], [8, -29, 11, 14, -0.04], [-13, -16, 12, 10, 0.05], [3, -15, 13, 9, -0.06]];
    for (const [ox, oy, pw, ph, rot] of papers) {
      g.save(); g.translate(cx + ox + pw / 2, cy + oy + ph / 2); g.rotate(rot);
      g.fillStyle = '#efe6cf'; g.fillRect(-pw / 2, -ph / 2, pw, ph);
      g.strokeStyle = 'rgba(80,60,30,0.5)'; g.lineWidth = 0.8; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-pw / 2 + 2, -ph / 2 + 3.5 + k * 3); g.lineTo(pw / 2 - 2, -ph / 2 + 3.5 + k * 3); g.stroke(); }
      g.fillStyle = '#7a2e2e'; g.beginPath(); g.arc(0, -ph / 2 + 1.5, 1.5, 0, 7); g.fill();
      g.restore();
    }
    if (mark) { const bob = Math.sin(time * 4) * 2; g.font = `800 16px ${DISPLAY}`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText('!', cx, cy - 50 + bob); g.fillStyle = '#f5c542'; g.fillText('!', cx, cy - 50 + bob); }
  };
  const drawGuildChest = (g, tx, ty) => {
    const cx = tc(tx), cy = tc(ty), open = G().rank >= CHEST_RANK;
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx, cy + 14, 20, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#6b4a2a'; g.fillRect(cx - 18, cy - 8, 36, 22); g.fillStyle = '#8a5a2b'; g.fillRect(cx - 18, cy - 16, 36, 10);
    g.fillStyle = '#3a3a42'; g.fillRect(cx - 18, cy - 4, 36, 3); g.fillRect(cx - 18, cy + 8, 36, 3); g.fillRect(cx - 13, cy - 16, 3, 30); g.fillRect(cx + 10, cy - 16, 3, 30);
    g.fillStyle = '#7a2e2e'; g.beginPath(); g.arc(cx, cy + 2, 4.5, 0, 7); g.fill(); g.fillStyle = '#f5c542'; g.font = `700 6px ${DISPLAY}`; g.textAlign = 'center'; g.fillText('G', cx, cy + 4);
    g.fillStyle = open ? '#c9a02a' : '#8f96a3'; g.fillRect(cx - 3, cy - 8, 6, 6); if (!open) { g.strokeStyle = '#c9ccd3'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy - 9, 3, Math.PI, 0); g.stroke(); } // the lock, gold once it opens for you
  };
  const drawPerson = (g, p) => {
    const e = { x: p.px, y: p.py, r: 13, facing: p.facing, hurtT: 0, attackT: 0, moving: p.moving, walkT: p.walkT };
    const near = dist(player.x, player.y, e.x, e.y) < 110;
    if (near && !p.moving) e.facing = { x: Math.sign(player.x - e.x) || 0, y: Math.sign(player.y - e.y) || 1 };
    g.save(); g.translate(e.x, e.y + (p.moving ? Math.sin(p.walkT) * 2 : 0));
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, 11, 12, 6, 0, 0, 7); g.fill();
    drawHuman(g, e, { tunic: p.tunic, hair: p.hair, woman: p.woman, beard: p.beard, shoulder: '#7a2e2e' });
    g.restore();
    if (near) { g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(p.name, e.x, e.y - 26); g.fillStyle = '#ffe9a8'; g.fillText(p.name, e.x, e.y - 26); }
  };
  const drawPennant = g => { // the guild colour over the door, with the rank's stripes
    const cx = tc(DOOR_POS.x), top = HALL.y * TILE + 14, wave = Math.sin(time * 2.2) * 2, stripes = G().rank;
    g.fillStyle = '#4a3218'; g.fillRect(cx - 1, top - 20, 2, 26);
    g.fillStyle = '#7a2e2e'; g.beginPath(); g.moveTo(cx, top - 20); g.lineTo(cx + 22 + wave, top - 14); g.lineTo(cx, top - 6); g.closePath(); g.fill();
    g.fillStyle = '#f5c542'; for (let k = 0; k < stripes; k++) g.fillRect(cx + 3 + k * 4, top - 14, 2, 3);
  };
  HOOKS.draw.push((g, items, cam) => {
    const gd = G();
    const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 3);
    if (escort && escort.px > cam.x - 60 && escort.px < cam.x + VW + 60 && escort.py > cam.y - 60 && escort.py < cam.y + VH + 60) items.push({ y: escort.py + 13, draw: () => drawPerson(g, Object.assign({}, LOOKS.pip, escort)) });
    if (x1 < HF_RECT.x0 || x0 > HF_RECT.x1 || y1 < HF_RECT.y0 || y0 > HF_RECT.y1) return;
    const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
    const mark = gd.founded && JOBS.some(j => !cooling(j) && (j.kind === 'deliver' ? countItem(j.item) >= j.n : false));
    for (let ty = Math.max(y0, HALL.y); ty < Math.min(y1 + 1, HALL.y + HALL.h); ty++) for (let tx = Math.max(x0, HALL.x); tx < Math.min(x1 + 1, HALL.x + HALL.w); tx++) {
      const t = tileAt(tx, ty);
      if (t === T_GBOARD) items.push({ y: ty * TILE + TILE - 6, draw: () => drawGuildBoard(g, tx, ty, mark) });
      else if (t === T_GCHEST) items.push({ y: ty * TILE + TILE - 6, draw: () => drawGuildChest(g, tx, ty) });
    }
    for (const s of staff) items.push({ y: s.py + 13, draw: () => drawPerson(g, s) });
    if (gd.founded && !inHall(ptx, pty) && (HALL.x + HALL.w) * TILE > cam.x && HALL.x * TILE < cam.x + VW && (HALL.y + HALL.h) * TILE > cam.y && HALL.y * TILE < cam.y + VH) items.push({ y: (HALL.y + HALL.h) * TILE - 1, draw: () => { drawBuilding(g, HALL); drawPennant(g); } });
    if (!player.dead && !player.mech && staff.length) items.push({ y: 1e9 + 4, draw: () => {
      if (npcInFront()) return;
      const p = staffInFront(); if (p) { g.strokeStyle = 'rgba(255,233,168,0.7)'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.arc(p.px, p.py, 20, 0, 7); g.stroke(); g.setLineDash([]); }
    } });
  });

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
    const open = () => { openPanel('guild'); render(); };
    const pressAt = (sx, sy, tx, ty) => { closePanel(); F.tp(sx, sy); F.face(tx, ty); drain(); F.press('KeyE'); F.sim(2, []); };
    const clearItem = id => removeItem(id, countItem(id));
    const ensureRoom = n => { for (let i = player.inv.length - 1; i >= 0 && player.inv.filter(s => !s).length < n; i--) { const s = player.inv[i]; if (s && s.id !== 'coins' && !ITEMS[s.id].weapon && !ITEMS[s.id].armour && !ITEMS[s.id].tool) player.inv[i] = null; } };
    const timberRun = () => { clearItem('plank'); h.give('plank', 20); G().cooldowns.timber = -1e9; open(); const c = F.clickButton('Deliver: Timber'); F.sim(2, []); return c; };
    // snapshot what the test touches
    const snap = new Map(); for (let y = HALL.y - 1; y <= HALL.y + HALL.h + 6; y++) for (let x = HALL.x - 1; x <= HALL.x + HALL.w; x++) snap.set(idx(x, y), tileAt(x, y));
    const g0 = quest.guild, rb0 = JSON.stringify(quest.rebuild || null), hf0 = quest.hollowford && quest.hollowford.freed, cape0 = player.equip[CAPE_SLOT], hp0 = player.hp;
    h.peace(true); closePanel(); player.action = null; drain(); ensureRoom(4); quest.guild = fresh(); escort = null; staff = []; levelBanner = null;
    if (!quest.hollowford) quest.hollowford = { rewarded: false, beastKilled: false, wreck: null }; quest.hollowford.freed = true; quest.hollowford.beastKilled = true;
    if (!quest.rebuild) quest.rebuild = { progress: {}, done: {}, title: null, wellAt: -1e9, nudged: false }; if (!quest.rebuild.done) quest.rebuild.done = {};
    // before founding: a burned ruin on the east street; freed + first house founds the guild and rebuilds it as the hall
    { quest.rebuild.done.house = false; F.tp(140, 78); F.sim(3, []); const ruin = tileAt(HALL.x, HALL.y) === T.HWALL && tileAt(BOARD_POS.x, BOARD_POS.y) !== T_GBOARD && !G().founded;
      quest.rebuild.done.house = true; levelBanner = null; F.sim(3, []);
      const built = tileAt(HALL.x, HALL.y) === T.HWALL && tileAt(HALL.x + HALL.w - 1, HALL.y + HALL.h - 1) === T.HWALL && tileAt(152, 68) === T.FLOOR && tileAt(DOOR_POS.x, DOOR_POS.y) === T.DOOR && tileAt(BOARD_POS.x, BOARD_POS.y) === T_GBOARD && tileAt(CHEST_POS.x, CHEST_POS.y) === T_GCHEST && STEP_PATH.every(([x, y]) => tileAt(x, y) === T.DIRT) && !!F.bfs(DOOR_POS.x, DOOR_POS.y + 1, 140, 78);
      check('guild: a burned ruin on the east street (150–156, 66–71) until the crypt is open and the first house stands; then Tam founds The Hollowford Guild: HWALL hall, FLOOR, DOOR (153,71), GUILD_BOARD (153,67), GUILD_CHEST (155,67), a dirt path to the street, banner', ruin && G().founded && built && !!levelBanner && levelBanner.text === 'THE HOLLOWFORD GUILD' && CAPE_SLOT === (EQUIP_SLOTS.includes('cape') ? 'cape' : 'body'), { ruin, founded: G().founded, built, banner: levelBanner && levelBanner.text, capeSlot: CAPE_SLOT }); drain(); }
    // the board opens the guild panel; the chest refuses below Warden
    { pressAt(BOARD_POS.x, BOARD_POS.y + 1, BOARD_POS.x, BOARD_POS.y); const labels = buttons.map(b => b.label.replace(/^disabled:/, '')); const opened = panel === 'guild' && ['Take: Escort', 'Deliver: Timber', 'Deliver: Scrap', 'Take: Wolves'].every(l => labels.includes(l));
      pressAt(CHEST_POS.x, CHEST_POS.y + 1, CHEST_POS.x, CHEST_POS.y); const refused = panel !== 'guild_chest' && !!dialog.cur && /Wardens/.test(dialog.cur.text);
      check('guild: E on the board opens the guild panel with the four jobs; E on the chest refuses below Warden', opened && refused && questText('guild').includes('Recruit'), { opened, labels: labels.filter(l => /Take|Deliver/.test(l)), refused, text: dialog.cur && dialog.cur.text }); drain(); closePanel(); }
    // Timber run: greyed with 19 planks, pays with 20, then cools for 10 minutes of game time
    { clearItem('plank'); h.give('plank', 19); open(); const early = F.clickButton('Deliver: Timber'); const greyed = !!buttons.find(b => b.label === 'disabled:Deliver: Timber');
      h.give('plank', 1); const c0 = coins(), x0 = player.skills.crafting.xp; drain(); open(); const clicked = F.clickButton('Deliver: Timber'); F.sim(2, []);
      const paid = coins() === c0 + 80 || drops.some(d => d.id === 'coins' && d.qty === 80); const cool = cooling(byId.timber); render(); const coolBtn = buttons.find(b => /^disabled:Ready in/.test(b.label)); const coolTxt = coolBtn && coolBtn.label;
      G().cooldowns.timber = time - COOLDOWN - 1; render(); const back = !cooling(byId.timber) && !!buttons.find(b => b.label === 'disabled:Deliver: Timber' || b.label === 'Deliver: Timber');
      check('guild: Timber run — Deliver is greyed with 19 planks; 20 planks pay 80 coins + 100 Crafting xp (planks gone, 1 job done); the job cools for 10 minutes of game time ("Ready in 10m") and comes back after', !early && greyed && clicked && countItem('plank') === 0 && paid && player.skills.crafting.xp === x0 + 100 && G().jobsDone === 1 && cool && /Ready in 10m/.test(coolTxt || '') && back && dialog.cur && dialog.cur.who === 'Nell', { early, greyed, clicked, planks: countItem('plank'), coins: coins() - c0, xp: player.skills.crafting.xp - x0, jobs: G().jobsDone, cool, coolTxt, back, who: dialog.cur && dialog.cur.who }); drain(); closePanel(); }
    // Scrap run
    { clearItem('goblin_scrap'); h.give('goblin_scrap', 15); const c0 = coins(); open(); const clicked = F.clickButton('Deliver: Scrap'); F.sim(2, []);
      check('guild: Scrap run — 15 goblin scrap pay 150 coins (2 jobs done)', clicked && countItem('goblin_scrap') === 0 && (coins() === c0 + 150 || drops.some(d => d.id === 'coins' && d.qty === 150)) && G().jobsDone === 2, { clicked, scrap: countItem('goblin_scrap'), coins: coins() - c0, jobs: G().jobsDone }); drain(); closePanel(); }
    // Wolf patrol: kills before taking the job do not count; five after it pay; the third job makes a Member
    { const w = monsters.find(m => m.type === 'wolf'); const wolfAt = () => { w.dead = false; w.hp = 1; w.stunT = 0; w.state = 'idle'; w.x = player.x + 40; w.y = player.y; };
      F.tp(60, 70); wolfAt(); hitMonster(w, 5, 0); F.sim(2, []); const before = !G().active && G().jobsDone === 2;
      open(); const took = F.clickButton('Take: Wolves'); closePanel(); F.sim(1, []); const active = !!G().active && G().active.id === 'wolf' && activeQuests().includes('guild') && /Wolves 0\/5/.test(questText('guild'));
      const c0 = coins(), x0 = player.skills.melee.xp; const counts = []; drain(); levelBanner = null;
      for (let k = 0; k < 5; k++) { wolfAt(); hitMonster(w, 5, 0); F.sim(2, []); counts.push(G().active ? G().active.kills : 'done'); }
      const paid = coins() === c0 + 200 || drops.some(d => d.id === 'coins' && d.qty === 200);
      check('guild: Wolf patrol — a wolf killed before taking the job does not count; five after it pay 200 coins + 100 Melee xp; the third job ranks you up to Member with a banner', before && took && active && counts.join(',') === '1,2,3,4,done' && !G().active && paid && player.skills.melee.xp >= x0 + 100 && G().jobsDone === 3 && G().rank === 1 && !!levelBanner && levelBanner.text === 'GUILD RANK: MEMBER' && rankName() === 'Member', { before, took, active, counts, coins: coins() - c0, xp: player.skills.melee.xp - x0, jobs: G().jobsDone, rank: G().rank, banner: levelBanner && levelBanner.text }); drain(); }
    // rank 2: the chest stores and returns a stack, and survives save/load
    { open(); const capeEarly = !F.clickButton('Buy cape'); closePanel(); const runs = [timberRun(), timberRun(), timberRun()]; closePanel();
      const warden = G().rank === 2 && G().jobsDone === 6 && !!levelBanner && levelBanner.text === 'GUILD RANK: WARDEN';
      clearItem('goblin_scrap'); h.give('goblin_scrap', 7); const slot = player.inv.findIndex(s => s && s.id === 'goblin_scrap');
      pressAt(CHEST_POS.x, CHEST_POS.y + 1, CHEST_POS.x, CHEST_POS.y); const opened = panel === 'guild_chest'; const dep = F.clickButton('slot' + slot); const stored = G().chest[0] && G().chest[0].id === 'goblin_scrap' && G().chest[0].qty === 7 && countItem('goblin_scrap') === 0;
      save(); const chestSnap = JSON.stringify(G().chest); quest.guild = null; escort = null; staff = []; const ok = load(); F.sim(2, []); const kept = JSON.stringify(G().chest) === chestSnap && G().rank === 2 && G().founded;
      openPanel('guild_chest'); render(); const wd = F.clickButton('gchest0'); const back = countItem('goblin_scrap') === 7 && !G().chest[0];
      check('guild: three more Timber runs make a Warden; the chest opens, stores a stack of 7 scrap (slot 0), keeps it through save/load, and gives it back; the cape is not for sale yet', capeEarly && runs.every(Boolean) && warden && opened && dep && stored && ok && kept && wd && back, { capeEarly, runs, warden, rank: G().rank, opened, dep, stored, ok, kept, wd, back, banner: levelBanner && levelBanner.text }); closePanel(); drain(); }
    // rank 3: the guild cape
    { const runs = [timberRun(), timberRun(), timberRun()]; closePanel(); const captain = G().rank === 3 && G().jobsDone === 9;
      clearItem('guild_cape'); ensureRoom(2); const c0 = coins(); h.give('coins', Math.max(0, CAPE_PRICE - c0)); const c1 = coins(); open(); const bought = F.clickButton('Buy cape'); const inPack = countItem('guild_cape') === 1 && coins() === c1 - CAPE_PRICE;
      const def = ITEMS.guild_cape; const d0 = gearBonus('def'); const slot = player.inv.findIndex(s => s && s.id === 'guild_cape'); closePanel(); equipItem(slot); const worn = player.equip[CAPE_SLOT] === 'guild_cape' && countItem('guild_cape') === 0 && gearBonus('def') >= d0 + 8 - (cape0 && ITEMS[cape0] && ITEMS[cape0].armour ? ITEMS[cape0].armour.def : 0);
      check('guild: three more runs make a Captain; Buy cape takes 500 coins for a Guild cape (def 8, cape slot when 38-agility adds it, else body); equipping it works', runs.every(Boolean) && captain && bought && inPack && def.armour.def === 8 && def.value === 500 && def.armour.slot === CAPE_SLOT && worn && !!levelBanner, { runs, captain, rank: G().rank, bought, inPack, worn, slot: def.armour.slot, def: gearBonus('def') - d0 }); drain(); }
    // rank 4: the staff work in the hall; the square copies step aside; E on one talks
    { const runs = [timberRun(), timberRun(), timberRun()]; closePanel(); const master = G().rank === 4 && G().jobsDone === 12 && !!levelBanner && levelBanner.text === 'GUILD RANK: GUILDMASTER';
      F.tp(153, 69); F.sim(3, []); const start = staff.map(s => [s.px, s.py]); F.sim(420, []);
      const moved = staff.length === 3 && staff.every((s, i) => dist(s.px, s.py, start[i][0], start[i][1]) > 20 || s.wp !== [0, 1, 2][i]) && staff.every(s => hallInside(Math.floor(s.px / TILE), Math.floor(s.py / TILE)));
      const names = staff.map(s => s.name).sort().join(',');
      const s = staff[0]; s.px = tc(154); s.py = tc(69); s.waitT = 9; s.moving = false; drain(); F.tp(154, 70); F.face(154, 69); F.press('KeyE'); F.sim(2, []); const spoke = !!dialog.cur && dialog.cur.who === s.name && s.lines.includes(dialog.cur.text);
      drain(); F.tp(137, 82); F.face(137, 81); F.press('KeyE'); F.sim(2, []); const squareGone = !(dialog.cur && ['Old Tam', 'Nell', 'Pip'].includes(dialog.cur.who));
      check('guild: three more runs make a Guildmaster; Tam, Nell and Pip work in the hall, walking a loop between the board, the chest and the door (all three moved, all inside), E on one gets a line, and the square copies step aside', runs.every(Boolean) && master && moved && names === 'Nell,Old Tam,Pip' && spoke && squareGone, { runs, master, rank: G().rank, moved, names, spoke, squareGone, who: dialog.cur && dialog.cur.who, banner: levelBanner && levelBanner.text }); drain(); }
    // Escort: Pip follows, snaps when far, and the job completes at Thistledown's notice board
    { G().cooldowns.escort = -1e9; G().active = null; escort = null; F.tp(153, 69); open(); const took = F.clickButton('Take: Escort'); closePanel(); F.sim(2, []);
      const near0 = !!escort && dist(escort.px, escort.py, player.x, player.y) < 3 * TILE && !!dialog.cur && dialog.cur.who === 'Pip';
      F.tp(140, 78); F.sim(60, ['KeyA']); const follows = !!escort && dist(escort.px, escort.py, player.x, player.y) < 5 * TILE && activeQuests().includes('guild') && /Pip is with you/.test(questText('guild'));
      const c0 = coins(); drain(); F.tp(TOWN_BOARD.x, TOWN_BOARD.y + 2); F.sim(6, []);
      const done = !G().active && !escort && (coins() === c0 + 120 || drops.some(d => d.id === 'coins' && d.qty === 120)) && G().jobsDone === 13 && !!dialog.cur && dialog.cur.who === 'Pip';
      check('guild: Escort Pip — taking the job puts Pip at your side; he follows (snapping when far); at the notice board in Thistledown the job completes for 120 coins', took && near0 && follows && done, { took, near0, follows, done, active: G().active, coins: coins() - c0, jobs: G().jobsDone }); drain(); }
    // put things back
    for (const [i, t] of snap) if (map[i] !== t) changeTile(i % MAP_W, Math.floor(i / MAP_W), t);
    if (player.equip[CAPE_SLOT] === 'guild_cape') player.equip[CAPE_SLOT] = cape0 || null; clearItem('guild_cape'); recomputeMaxHp();
    quest.guild = g0 || fresh(); quest.rebuild = rb0 === 'null' ? undefined : JSON.parse(rb0); if (quest.rebuild === undefined) delete quest.rebuild; quest.hollowford.freed = hf0; escort = null; staff = []; chestPage = 0;
    closePanel(); drain(); levelBanner = null; player.hp = Math.min(Math.max(hp0, 1), player.maxHp); h.peace(false); F.sim(2, []);
  });
}
