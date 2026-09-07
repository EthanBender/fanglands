// ============================================================================
// REBUILDING HOLLOWFORD (feature file; registers through HOOKS only, edits no core file)
// After the Barrelbeast falls (quest.stage >= 10) a notice board in Hollowford's square carries
// Nell's rebuild plan: seven projects, paid in planks, stone and bars, each with a visible result.
// A sawmill for planks, a paved square, a working well, the first house, the chapel roof and bell,
// the smithy, and the knight's own house — and Old Tam's promise kept: a title and a chair in it.
// State lives in quest.rebuild = { progress: {id: {item: n}}, done: {id: true}, title, wellAt, nudged }.
// Every tile change goes through changeTile so it persists in the save.
// Note: the core survivor NPCs (Tam, Nell, Pip) stay in the crypt — 20-hollowford owns them. Once the
// crypt bars are broken (quest.hollowford.freed, 20-hollowford) OR the first house is built this file draws
// its own copies of the three in the square (villagers come with the house); the crypt copies still answer E
// with their own lines. At guild rank 4 (41-guild) the three work in the guild hall instead, so the square
// copies step aside. Acceptable and noted.
// ============================================================================
{
  // ---------- places ----------
  const SQ = { x0: 135, y0: 75, x1: 145, y1: 83 };      // the square (20-hollowford fills it with dirt)
  const BOARD_POS = { x: 139, y: 78 };
  const SAWMILL_POS = { x: 143, y: 78 };
  const WELL_POS = { x: 140, y: 80 };                   // 20-hollowford's cracked well
  const BELL_POS = { x: 133, y: 84 };                   // the chapel's north-east corner
  const CHAPEL = { x0: 124, y0: 84, x1: 133, y1: 91 };
  const RUBBLE_SPOTS = [[137, 77], [143, 76], [136, 81], [143, 82], [138, 83], [144, 79]]; // what the beast's stamping left in the square
  const HF_RECT = { x0: 122, y0: 66, x1: 156, y1: 92 };
  const sqIn = (tx, ty) => tx >= SQ.x0 && tx <= SQ.x1 && ty >= SQ.y0 && ty <= SQ.y1;

  // ---------- tiles ----------
  const T_RBOARD = addTile('REBUILD_BOARD', { solid: true, tex: 'dirt', mini: '#8a6a3a' });
  const T_SAWMILL = addTile('SAWMILL', { solid: true, tex: 'cobble', mini: '#a5763f' });
  const T_GOODWELL = addTile('GOODWELL', { solid: true, tex: 'cobble', mini: '#7ec8ff' });
  const T_BELL = addTile('BELLTOWER', { solid: true, tex: 'cobble', mini: '#6e7178' });

  // ---------- rebuilt buildings (own list; drawn with drawBuilding only once built) ----------
  const RB_BUILDINGS = [
    { id: 'rb_house', x: 126, y: 68, w: 6, h: 6, name: 'First House', roof: '#6a4a3a', door: 2, f: [[T.BED, 1, 1], [T.TABLE, 4, 2], [T.SHELF, 4, 1]] },
    { id: 'rb_smithy', x: 133, y: 69, w: 5, h: 4, name: 'Hollowford Smithy', roof: '#4a4a52', sign: 'SMITHY', door: 2, f: [[T.FORGE, 1, 1], [T.ANVIL, 2, 1]] },
    { id: 'rb_knight', x: 151, y: 73, w: 5, h: 4, name: "The Knight's House", roof: '#5a2e7a', sign: 'KNIGHT', door: 2, f: [[T.BED, 1, 1], [T.LODESTONE, 3, 1]] },
  ];
  const buildingById = id => RB_BUILDINGS.find(b => b.id === id);
  const inRect = (b, tx, ty) => tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h;

  // ---------- the plan ----------
  const PROJECTS = [
    { id: 'sawmill', tag: 'Sawmill', title: 'The sawmill', cost: { plank: 10, stone: 5 }, chain: false,
      blurb: 'A saw on a bench. Logs go in, planks come out. Then the rest gets easier.', result: 'A sawmill in the square: E with logs turns one log into three planks.' },
    { id: 'square', tag: 'Square', title: 'Clear the square', cost: { stone: 20 }, chain: true,
      blurb: 'Rubble, beams, ash. Pave it. A town starts with somewhere to stand.', result: 'The square is paved with cobbles.' },
    { id: 'well', tag: 'Well', title: 'The well', cost: { stone: 10, plank: 4 }, chain: true,
      blurb: 'It stood on our well. New stones, a new roof, a new bucket.', result: 'A working well: E for a drink and a small heal, once a minute.' },
    { id: 'house', tag: 'House', title: 'The first house', cost: { plank: 30, stone: 10 }, chain: true,
      blurb: 'Walls, a floor, a roof. One house and the crypt can empty.', result: 'The ruin by the west street becomes a whole house. The survivors come up into the square.' },
    { id: 'chapel', tag: 'Chapel', title: 'The chapel roof', cost: { plank: 20, iron_bar: 5 }, chain: true,
      blurb: 'The beast walked through the east wall. Close it, and hang a bell where the old one was.', result: 'The chapel is whole again, with a bell tower on the corner.' },
    { id: 'smithy', tag: 'Smithy', title: 'The smithy', cost: { plank: 20, iron_bar: 8 }, chain: true,
      blurb: 'The anvil survived the fire. It needs a forge beside it and a roof over both.', result: 'A working forge and anvil in the rebuilt smithy.' },
    { id: 'knight', tag: 'Knight', title: "The knight's house", cost: { plank: 40, stone: 10, mithril_bar: 2 }, chain: true,
      blurb: "Tam's promise. A house with a chair in it for the knight who brought the beast down.", result: 'A house of your own with a bed and a lodestone, a title, and 500 coins from a grateful town.' },
  ];
  const byId = {}; for (const p of PROJECTS) byId[p.id] = p;
  const CHAIN = PROJECTS.filter(p => p.chain).map(p => p.id);

  // ---------- state ----------
  const fresh = () => ({ progress: {}, done: {}, title: null, wellAt: -1e9, nudged: false });
  const RB = () => {
    if (!quest.rebuild) quest.rebuild = fresh();
    const r = quest.rebuild;
    if (!r.progress) r.progress = {}; if (!r.done) r.done = {}; if (typeof r.wellAt !== 'number') r.wellAt = -1e9; if (r.title === undefined) r.title = null;
    return r;
  };
  let survivors = [];  // own copies of Tam, Nell and Pip once the first house stands
  let villagers = [];  // two returning villagers who wander the square
  const resetPeople = () => { survivors = []; villagers = []; };
  HOOKS.newGame.push(() => { quest.rebuild = fresh(); resetPeople(); });

  const unlocked = () => quest.stage >= 10;
  const isDone = p => !!RB().done[p.id];
  const have = (p, item) => (RB().progress[p.id] || {})[item] || 0;
  const needTotal = p => Object.values(p.cost).reduce((a, b) => a + b, 0);
  const haveTotal = p => Object.keys(p.cost).reduce((a, k) => a + Math.min(p.cost[k], have(p, k)), 0);
  const available = p => { if (isDone(p) || !unlocked()) return false; if (!p.chain) return true; const i = CHAIN.indexOf(p.id); return i === 0 || !!RB().done[CHAIN[i - 1]]; };
  const itemName = id => ITEMS[id] ? ITEMS[id].name : id;
  const costText = p => Object.keys(p.cost).map(k => `${itemName(k)} ${Math.min(p.cost[k], have(p, k))}/${p.cost[k]}`).join(' · ');
  const nextProject = () => PROJECTS.find(p => p.chain && !isDone(p)) || null;
  const allDone = () => PROJECTS.every(isDone);

  // ---------- building / contributing ----------
  const contribute = p => {
    if (!available(p)) { notify(isDone(p) ? 'Already built.' : unlocked() ? 'Finish the project before it first.' : 'Not while the beast walks.'); return false; }
    const r = RB(); const prog = r.progress[p.id] || (r.progress[p.id] = {}); let took = 0;
    for (const k of Object.keys(p.cost)) {
      const need = p.cost[k] - (prog[k] || 0); if (need <= 0) continue;
      const n = Math.min(need, countItem(k)); if (n <= 0) continue;
      removeItem(k, n); prog[k] = (prog[k] || 0) + n; took += n;
    }
    if (!took) { notify(`Nothing to give. Needs ${costText(p)}.`); return false; }
    floatText(player.x, player.y - 30, `+${took} to ${p.title}`, '#ffe9a8', 13); sfx('open');
    if (Object.keys(p.cost).every(k => (prog[k] || 0) >= p.cost[k])) complete(p);
    else notify(`${p.title}: ${costText(p)}.`);
    save(); return true;
  };
  const build = b => {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      const edge = x === b.x || y === b.y || x === b.x + b.w - 1 || y === b.y + b.h - 1;
      changeTile(x, y, edge ? T.HWALL : T.FLOOR);
    }
    changeTile(b.x + b.door, b.y + b.h - 1, T.DOOR);
    for (const [t, rx, ry] of b.f || []) changeTile(b.x + rx, b.y + ry, t);
    if (SOLID.has(tileAt(b.x + b.door, b.y + b.h))) changeTile(b.x + b.door, b.y + b.h, T.DIRT); // a clear step outside the door
    burst(tc(b.x + b.w / 2), tc(b.y + b.h / 2), '#d8a95e', 30, 140);
  };
  const isRuinGround = t => t === T.RUBBLE || t === T.ASHES || t === T.DIRT || t === T.BEAM || t === T.SCORCH;
  const effects = {
    sawmill() { changeTile(SAWMILL_POS.x, SAWMILL_POS.y, T_SAWMILL); say('The saw bites. One log in, three planks out. No more splitting them by hand, knight.', 'Nell'); },
    square() {
      for (let y = SQ.y0; y <= SQ.y1; y++) for (let x = SQ.x0; x <= SQ.x1; x++) if (isRuinGround(tileAt(x, y))) changeTile(x, y, T.COBBLE);
      burst(tc(BOARD_POS.x), tc(BOARD_POS.y), '#8f929a', 30, 150);
      say('Cobbles. Real cobbles, all the way to the well. Somewhere to stand at last.', 'Nell');
    },
    well() { changeTile(WELL_POS.x, WELL_POS.y, T_GOODWELL); burst(tc(WELL_POS.x), tc(WELL_POS.y), '#7ec8ff', 30, 140); say('Water. Cold and clean. Drink when you need it, knight, the well is yours as much as ours.', 'Nell'); },
    house() {
      build(buildingById('rb_house')); placePeople();
      say("A roof. A real roof. Tam! Pip! Come up, we're sleeping under a roof tonight.", 'Nell');
      say('And folk are coming back down the road. They heard the hammering.', 'Nell');
    },
    chapel() {
      for (let y = CHAPEL.y0 + 1; y < CHAPEL.y1; y++) for (let x = CHAPEL.x0 + 1; x < CHAPEL.x1; x++) { const t = tileAt(x, y); if (t === T.RUBBLE || t === T.ASHES || t === T.BEAM || t === T.SCORCH) changeTile(x, y, T.FLOOR); }
      for (const y of [86, 87, 88]) changeTile(CHAPEL.x1, y, T.CWALL);
      changeTile(BELL_POS.x, BELL_POS.y, T_BELL);
      burst(tc(BELL_POS.x), tc(BELL_POS.y) - 40, '#f5c542', 30, 140); sfx('quest');
      say('Hear that? The bell. The goblins took the old one for their machine. This one rings for us.', 'Nell');
    },
    smithy() { build(buildingById('rb_smithy')); say('Forge and anvil under a roof. Bring iron and a hammer and Hollowford makes its own steel again.', 'Nell'); },
    knight() {
      const b = buildingById('rb_knight'); build(b); const r = RB();
      r.title = r.title || 'Sir of Hollowford';
      giveOrDrop('coins', 500, player.x, player.y, true); floatText(player.x, player.y - 46, '+500 coins', '#ffd166');
      levelBanner = { text: 'HOLLOWFORD REBUILT', sub: 'Tam keeps his promise', t: 4.5 }; burst(player.x, player.y, '#ffe066', 40, 180); sfx('levelup');
      say("There it is. A house with a chair in it, like I said. Sit in it whenever you like. It's yours.", 'Old Tam');
      say('Five hundred coins from every purse in Hollowford, and a name to go with them: Sir, or Dame, whichever you like, of Hollowford. Say it in the pause menu and see.', 'Old Tam');
      placePeople();
    },
  };
  const complete = p => {
    const r = RB(); r.done[p.id] = true;
    levelBanner = { text: 'PROJECT BUILT', sub: p.title, t: 3 };
    effects[p.id]();
    if (allDone()) say('Nothing left on the board. Hollowford is a town again. Walk it, knight. You made it.', 'Nell');
    save();
  };

  // ---------- people in the square (own lists) ----------
  const SURVIVOR_LOOKS = {
    tam: { name: 'Old Tam', x: 137, y: 81, tunic: '#5a5048', hair: '#d9d0c0', beard: true, lines: ['Out of the crypt at last. Sun on my face.', 'A chair with your name on it, knight. I said it and I meant it.', "Nell drew the plan. Don't tell her, but the roof is upside down."], after: ['Sir, Dame, whichever you like. Hollowford has a knight again, that is the truth of it.', 'Sit in your chair. You earned the chair.'] },
    nell: { name: 'Nell', x: 140, y: 77, tunic: '#6a4a4a', hair: '#3a2a1a', woman: true, lines: ["Planks. Bring me planks and I'll bring you a town.", "The board has the plan. I drew it. Don't laugh at the roof.", 'Stone from the quarry, planks from the mill. The rest is sweat.'], after: ['Look at it. Look at it! I could cry, so I will.', 'The bell rang this morning. I stood in the square and listened.'] },
    pip: { name: 'Pip', x: 142, y: 81, tunic: '#4a5a6a', hair: '#c9843a', lines: ["I'm helping! I carried a plank. A whole one.", 'Can the smithy make me a sword? A small one?', 'When I am big I am going to be a knight. Like you. But taller.'], after: ['Your house has a LODESTONE in it. Can I touch it? I touched it.', 'The new house has a cellar too. I checked.'] },
  };
  const VILLAGER_DEFS = [
    { name: 'Hob', tunic: '#7a5a3a', hair: '#3a2a1a', lines: ["Heard a knight was paying for planks. Wait. You are the knight? You are paying planks?", 'My cousin had the house by the smithy. Had. Will again, Nell says.', 'Cobbles! Real cobbles. Mind, I said I would not cry.'] },
    { name: 'Wenna', tunic: '#5a6a7a', hair: '#e0c080', woman: true, lines: ['Nell says the roof goes on before the rain. Nell says a lot of things.', 'I came back the day I heard the well was working.', 'A bell tower next, they say. I miss the bell. I never thought I would miss a bell.'] },
  ];
  const mkPerson = (d, x, y) => ({ name: d.name, tunic: d.tunic, hair: d.hair, beard: !!d.beard, woman: !!d.woman, lines: d.lines, after: d.after, px: tc(x), py: tc(y), home: { x: tc(x), y: tc(y) }, facing: { x: 0, y: 1 }, walkT: 0, moving: false, wanderT: Math.random() * 3, dir: null });
  const freed = () => !!(quest.hollowford && quest.hollowford.freed);           // the crypt bars are broken (20-hollowford)
  const atGuild = () => !!(quest.guild && quest.guild.founded && quest.guild.rank >= 4); // the three work in the guild hall (41-guild)
  const placePeople = () => {
    const r = RB();
    if (!r.done.house && !freed()) { resetPeople(); return; }
    if (atGuild()) survivors = []; else if (!survivors.length) survivors = Object.values(SURVIVOR_LOOKS).map(d => mkPerson(d, d.x, d.y));
    if (!r.done.house) villagers = []; else if (!villagers.length) villagers = [mkPerson(VILLAGER_DEFS[0], 137, 79), mkPerson(VILLAGER_DEFS[1], 142, 79)];
  };
  const people = () => survivors.concat(villagers);
  const personInFront = () => {
    let best = null;
    for (const p of people()) {
      const dx = p.px - player.x, dy = p.py - player.y, d = Math.hypot(dx, dy); if (d > 64 || d < 1) continue;
      const dot = (dx / d) * player.facing.x + (dy / d) * player.facing.y; if (dot < 0.4) continue;
      if (!best || d < best.d) best = { p, d };
    }
    return best && best.p;
  };
  const talkTo = p => {
    const done = RB().done.knight; const pool = done && p.after ? p.after.concat(p.lines) : p.lines;
    p.facing = { x: Math.sign(player.x - p.px) || 0, y: Math.sign(player.y - p.py) || 1 };
    say(pick(pool), p.name);
  };
  const walkable = (tx, ty) => { const t = tileAt(tx, ty); return (t === T.COBBLE || t === T.DIRT || t === T.SCORCH || t === T.ASHES) && sqIn(tx, ty); };

  HOOKS.update.push(dt => {
    const r = RB();
    if ((r.done.house || freed()) && ((!survivors.length && !atGuild()) || (survivors.length && atGuild()) || (r.done.house && !villagers.length))) placePeople();
    if (!r.nudged && unlocked() && !player.dead && player.region === 'Hollowford' && dist(player.x, player.y, tc(BOARD_POS.x), tc(BOARD_POS.y)) < 7 * TILE) { r.nudged = true; notify("A board stands in the square: Nell's plan for rebuilding Hollowford. Press E on it."); save(); }
    for (const v of villagers) {
      v.wanderT -= dt; const dHome = dist(v.px, v.py, v.home.x, v.home.y);
      if (v.wanderT <= 0) { v.wanderT = 2 + Math.random() * 4; if (dHome > 4 * TILE || Math.random() < 0.3) v.dir = { x: (v.home.x - v.px) / (dHome || 1), y: (v.home.y - v.py) / (dHome || 1) }; else if (Math.random() < 0.7) { const a = Math.random() * Math.PI * 2; v.dir = { x: Math.cos(a), y: Math.sin(a) }; } else v.dir = null; }
      if (v.dir && dist(v.px, v.py, player.x, player.y) > 40) {
        const e = { x: v.px, y: v.py, r: 12 }; const before = { x: e.x, y: e.y };
        moveEntity(e, v.dir.x * 45 * dt, v.dir.y * 45 * dt, 'person');
        if (walkable(Math.floor(e.x / TILE), Math.floor(e.y / TILE))) { v.px = e.x; v.py = e.y; v.facing = v.dir; v.moving = true; v.walkT += dt * 8; }
        else { v.wanderT = 0; v.moving = false; }
        if (Math.abs(e.x - before.x) < 0.01 && Math.abs(e.y - before.y) < 0.01) v.wanderT = 0;
      } else v.moving = false;
    }
  });

  // ---------- use: the board, the sawmill, the well, the bell, the people ----------
  HOOKS.use.push((t, tx, ty) => {
    if (t === T_RBOARD) {
      if (!unlocked()) { say("Not while the beast walks. Nobody builds with that stamping through the square. Bring it down first.", 'Rebuild board'); return true; }
      openPanel('rebuild'); return true;
    }
    if (t === T_SAWMILL) {
      if (countItem('wood') < 1) { notify('The sawmill wants logs. One log becomes three planks.'); return true; }
      removeItem('wood', 1); giveOrDrop('plank', 3, player.x, player.y); gainXp('crafting', 10);
      burst(tc(tx), tc(ty), '#d8a95e', 10, 80); floatText(player.x, player.y - 30, '+3 planks', '#d8a95e', 13); sfx('open'); save(); return true;
    }
    if (t === T_GOODWELL) {
      const r = RB();
      if (time - r.wellAt < 60) { notify(`Cold, clean water. Come back in ${Math.ceil(60 - (time - r.wellAt))}s for another drink.`); return true; }
      if (player.hp >= player.maxHp) { notify('Cold, clean water. You are not hurt, but it tastes of home.'); return true; }
      r.wellAt = time; const heal = Math.max(8, Math.floor(player.maxHp * 0.25)); player.hp = Math.min(player.maxHp, player.hp + heal);
      floatText(player.x, player.y - 30, `+${heal}`, '#7ec8ff'); burst(tc(tx), tc(ty), '#7ec8ff', 10, 70); sfx('open'); save(); return true;
    }
    if (t === T_BELL) { say('The bell rings once across the square. Somewhere a door opens.', 'Bell tower'); sfx('quest'); return true; }
    const p = personInFront(); if (p) { talkTo(p); return true; }
    return false;
  });

  // ---------- world: the board and the beast's rubble in the square ----------
  HOOKS.world.push((rnd, api) => {
    api.setTile(BOARD_POS.x, BOARD_POS.y, T_RBOARD);
    for (const [x, y] of RUBBLE_SPOTS) if (api.tileAt(x, y) === T.DIRT) api.setTile(x, y, T.RUBBLE);
  });

  // ---------- panel ----------
  const ROW_H = 62;
  const perPage = () => Math.max(2, Math.min(PROJECTS.length, Math.floor((VH - 20 - 150) / ROW_H)));
  let page = 0;
  HOOKS.panel.rebuild = (g, narrow) => {
    const r = RB(); const per = perPage(), pages = Math.max(1, Math.ceil(PROJECTS.length / per)); page = clamp(page | 0, 0, pages - 1);
    const done = PROJECTS.filter(isDone).length;
    const { px, py, w, h } = panelBox(g, narrow ? VW - 20 : 600, 96 + per * ROW_H + 52, 'Rebuild Hollowford', `Nell's plan · ${done} of ${PROJECTS.length} built${pages > 1 ? ` · page ${page + 1} of ${pages}` : ''}${r.title ? ` · ${r.title}` : ''}`);
    const fit = (text, maxW) => { let s = text; while (s.length > 8 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1); return s === text ? text : s + '…'; };
    const bw = narrow ? 96 : 126, textW = w - 36 - bw - 24;
    PROJECTS.slice(page * per, page * per + per).forEach((p, i) => {
      const y = py + 66 + i * ROW_H; const dn = isDone(p), av = available(p), frac = dn ? 1 : haveTotal(p) / needTotal(p);
      const canGive = av && Object.keys(p.cost).some(k => have(p, k) < p.cost[k] && countItem(k) > 0);
      roundRect(g, px + 18, y, w - 36, ROW_H - 6, 8); g.fillStyle = dn ? 'rgba(126,231,135,0.07)' : av ? 'rgba(88,166,255,0.10)' : 'rgba(255,255,255,0.04)'; g.fill();
      if (canGive) { g.strokeStyle = 'rgba(126,231,135,0.45)'; g.lineWidth = 1; g.stroke(); }
      const num = PROJECTS.indexOf(p);
      g.textAlign = 'left'; g.fillStyle = dn ? '#7ee787' : av ? '#e6edf3' : '#6e7681'; g.font = 'bold 13px sans-serif'; g.fillText(fit(`${num}. ${p.title}`, textW), px + 30, y + 17);
      g.fillStyle = dn ? '#6e7681' : av ? '#c9d1d9' : '#4b535d'; g.font = 'italic 11px sans-serif'; g.fillText(fit(dn ? p.result : `“${p.blurb}”`, textW), px + 30, y + 32);
      g.font = '11px sans-serif'; g.fillStyle = dn ? '#4b535d' : av ? '#8b949e' : '#4b535d'; g.fillText(fit(dn ? 'Built' : av ? `Needs: ${costText(p)}` : !unlocked() ? 'Not while the beast walks' : 'Locked: finish the one before it', textW), px + 30, y + 46);
      // progress bar
      g.fillStyle = '#2a2f3a'; roundRect(g, px + 30, y + 50, textW, 4, 2); g.fill();
      if (frac > 0) { g.fillStyle = dn ? '#7ee787' : '#58a6ff'; roundRect(g, px + 30, y + 50, textW * clamp(frac, 0, 1), 4, 2); g.fill(); }
      const bx = px + w - 18 - bw, by = y + 13;
      if (dn) {
        if (p.id === 'knight') { const dame = r.title === 'Dame of Hollowford'; button(g, bx, by, bw, 30, dame ? 'Called: Dame' : 'Called: Sir', () => { r.title = dame ? 'Sir of Hollowford' : 'Dame of Hollowford'; save(); }, '#21262d'); }
        else button(g, bx, by, bw, 30, 'Built', () => { }, '#2a2f3a', false);
      }
      else button(g, bx, by, bw, 30, `Build: ${p.tag}`, () => contribute(p), canGive ? '#238636' : '#2a2f3a', av);
    });
    const fy = py + h - 44;
    if (pages > 1) { button(g, px + 18, fy, 80, 30, 'Prev', () => { page = Math.max(0, page - 1); }, '#21262d', page > 0); button(g, px + 106, fy, 80, 30, 'Next', () => { page = Math.min(pages - 1, page + 1); }, '#21262d', page < pages - 1); }
    button(g, px + w - 18 - 100, fy, 100, 30, 'Close', closePanel, '#21262d');
    g.fillStyle = '#6e7681'; g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillText('Build gives what you carry. Half now, half later is fine.', px + w / 2 - (pages > 1 ? 0 : 40), fy + 20);
  };

  // ---------- quest tab ----------
  QUEST_DEFS.rebuild = { name: 'Rebuilding Hollowford' };
  HOOKS.activeQuests.push(() => unlocked() && !allDone() ? ['rebuild'] : []);
  HOOKS.questText.rebuild = () => { const p = nextProject() || PROJECTS.find(q => !isDone(q)); return p ? `${p.title}: ${costText(p)} · the board in Hollowford's square` : 'Hollowford is rebuilt.'; };

  // ---------- drawing ----------
  const drawBoard = (g, tx, ty, mark) => {
    const cx = tc(tx), cy = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 18, 22, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#5a3e1e'; g.fillRect(cx - 20, cy - 26, 5, 46); g.fillRect(cx + 15, cy - 26, 5, 46);
    g.fillStyle = '#7a5a2e'; g.fillRect(cx - 25, cy - 36, 50, 33); g.strokeStyle = '#3a2410'; g.lineWidth = 1.5; g.strokeRect(cx - 25, cy - 36, 50, 33);
    g.fillStyle = '#6b4a2a'; g.beginPath(); g.moveTo(cx - 29, cy - 36); g.lineTo(cx, cy - 46); g.lineTo(cx + 29, cy - 36); g.closePath(); g.fill();
    // the plan: one big sheet with a little town sketched on it
    g.save(); g.translate(cx, cy - 20); g.rotate(-0.03);
    g.fillStyle = '#efe6cf'; g.fillRect(-20, -12, 40, 26); g.strokeStyle = 'rgba(80,60,30,0.5)'; g.lineWidth = 0.8; g.strokeRect(-20, -12, 40, 26);
    g.strokeStyle = '#3a5a8a'; g.lineWidth = 1;
    for (const [ox, hw, hh] of [[-13, 5, 4], [-2, 6, 5], [11, 5, 4]]) { g.beginPath(); g.moveTo(ox - hw, 8); g.lineTo(ox - hw, 8 - hh); g.lineTo(ox, 2 - hh); g.lineTo(ox + hw, 8 - hh); g.lineTo(ox + hw, 8); g.closePath(); g.stroke(); }
    g.beginPath(); g.moveTo(-18, -8); g.lineTo(18, -8); g.stroke(); g.fillStyle = '#c0392b'; g.beginPath(); g.arc(0, -11, 1.6, 0, 7); g.fill();
    g.restore();
    if (mark) { const bob = Math.sin(time * 4) * 2; g.font = `800 16px ${DISPLAY}`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText('!', cx, cy - 50 + bob); g.fillStyle = '#f5c542'; g.fillText('!', cx, cy - 50 + bob); }
  };
  const drawSawmill = (g, tx, ty) => {
    const cx = tc(tx), cy = tc(ty), near = dist(player.x, player.y, cx, cy) < 90;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 16, 22, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#5a3a1e'; g.fillRect(cx - 18, cy - 2, 5, 18); g.fillRect(cx + 13, cy - 2, 5, 18); // legs
    g.fillStyle = '#8a5a2b'; g.fillRect(cx - 22, cy - 8, 44, 8); g.fillStyle = '#a5763f'; g.fillRect(cx - 22, cy - 10, 44, 4); // bench
    g.fillStyle = '#c9a36a'; g.fillRect(cx - 20, cy - 16, 22, 7); g.fillStyle = '#e8d3a8'; g.beginPath(); g.ellipse(cx + 2, cy - 12.5, 2.5, 3.5, 0, 0, 7); g.fill(); // a log on the bench
    g.save(); g.translate(cx + 10, cy - 16); g.rotate(near ? time * 12 : 0.3);
    g.fillStyle = '#8f96a3'; g.beginPath(); g.arc(0, 0, 11, 0, 7); g.fill(); g.fillStyle = '#5a5d64'; g.beginPath(); g.arc(0, 0, 3, 0, 7); g.fill();
    g.fillStyle = '#c9ccd3'; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); g.lineTo(Math.cos(a + 0.2) * 13, Math.sin(a + 0.2) * 13); g.lineTo(Math.cos(a + 0.45) * 9, Math.sin(a + 0.45) * 9); g.closePath(); g.fill(); }
    g.restore();
    for (let k = 0; k < 3; k++) { g.fillStyle = k % 2 ? '#d8a95e' : '#c9963f'; g.fillRect(cx + 4, cy + 4 + k * 4, 18, 3); } // plank stack
    if (near) for (let k = 0; k < 3; k++) { const ph = (time * 2 + k * 0.33) % 1; g.fillStyle = `rgba(232,211,168,${0.6 * (1 - ph)})`; g.beginPath(); g.arc(cx + 10 + Math.sin(time * 9 + k) * 8, cy - 16 + ph * 14, 1.5, 0, 7); g.fill(); } // sawdust
  };
  const drawGoodWell = (g, tx, ty) => {
    const cx = tc(tx), cy = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx + 2, cy + 14, 22, 9, 0, 0, 7); g.fill();
    g.fillStyle = '#8d9098'; g.beginPath(); g.ellipse(cx, cy + 4, 21, 14, 0, 0, 7); g.fill();
    g.fillStyle = '#6e7178'; g.beginPath(); g.ellipse(cx, cy + 8, 21, 12, 0, 0, Math.PI); g.fill();
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.fillStyle = ['#a3a6ae', '#b0b3ba', '#979aa2'][k % 3]; g.beginPath(); g.ellipse(cx + Math.cos(a) * 17, cy + 3 + Math.sin(a) * 10.5, 5, 3.5, a, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.stroke(); }
    g.fillStyle = '#1e3a55'; g.beginPath(); g.ellipse(cx, cy + 2, 12, 7, 0, 0, 7); g.fill();
    g.fillStyle = `rgba(120,190,240,${0.45 + Math.sin(time * 2) * 0.2})`; g.beginPath(); g.ellipse(cx - 2, cy + 2, 8, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#5a3a1e'; g.fillRect(cx - 18, cy - 32, 5, 36); g.fillRect(cx + 13, cy - 32, 5, 36); // posts
    g.fillStyle = '#7a3b2e'; g.beginPath(); g.moveTo(cx - 26, cy - 30); g.lineTo(cx, cy - 46); g.lineTo(cx + 26, cy - 30); g.closePath(); g.fill(); // little roof
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(cx, cy - 46); g.lineTo(cx + 26, cy - 30); g.lineTo(cx, cy - 30); g.closePath(); g.fill();
    g.fillStyle = '#4a3218'; g.fillRect(cx - 16, cy - 24, 32, 4); // crossbar
    g.strokeStyle = '#c9b676'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, cy - 22); g.lineTo(cx, cy - 8 + Math.sin(time * 1.5) * 2); g.stroke();
    g.fillStyle = '#6b4a2a'; g.fillRect(cx - 4, cy - 8 + Math.sin(time * 1.5) * 2, 8, 6); g.strokeStyle = '#8f96a3'; g.lineWidth = 1; g.strokeRect(cx - 4, cy - 8 + Math.sin(time * 1.5) * 2, 8, 6); // bucket
  };
  const drawBell = (g, tx, ty) => {
    const cx = tc(tx), base = ty * TILE + TILE;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx - 18, base - 4, 44, 8);
    g.fillStyle = '#6e7178'; g.fillRect(cx - 18, base - 92, 36, 92); // tower body
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx + 8, base - 92, 10, 92);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; for (let ry = base - 84; ry < base; ry += 10) { g.beginPath(); g.moveTo(cx - 18, ry); g.lineTo(cx + 18, ry); g.stroke(); }
    g.fillStyle = '#2a2a33'; g.fillRect(cx - 9, base - 78, 18, 22); // the belfry opening
    const swing = Math.sin(time * 3) * 0.25;
    g.save(); g.translate(cx, base - 76); g.rotate(swing); g.fillStyle = '#c9a02a'; g.beginPath(); g.moveTo(-5, 0); g.quadraticCurveTo(-7, 12, -8, 15); g.lineTo(8, 15); g.quadraticCurveTo(7, 12, 5, 0); g.closePath(); g.fill(); g.fillStyle = '#8a6a1a'; g.beginPath(); g.arc(0, 17, 2, 0, 7); g.fill(); g.restore();
    g.fillStyle = '#4a4a52'; g.beginPath(); g.moveTo(cx - 22, base - 92); g.lineTo(cx, base - 116); g.lineTo(cx + 22, base - 92); g.closePath(); g.fill(); // spire
    g.fillStyle = '#f5c542'; g.fillRect(cx - 1, base - 124, 2, 9); g.fillRect(cx - 4, base - 121, 8, 2); // a small cross
  };
  const drawPerson = (g, p) => {
    const e = { x: p.px, y: p.py, r: 13, facing: p.facing, hurtT: 0, attackT: 0, moving: p.moving, walkT: p.walkT };
    const near = dist(player.x, player.y, e.x, e.y) < 110;
    if (near && !p.moving) e.facing = { x: Math.sign(player.x - e.x) || 0, y: Math.sign(player.y - e.y) || 1 };
    g.save(); g.translate(e.x, e.y + (p.moving ? Math.sin(p.walkT) * 2 : 0));
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, 11, 12, 6, 0, 0, 7); g.fill();
    drawHuman(g, e, { tunic: p.tunic, hair: p.hair, woman: p.woman, beard: p.beard, shoulder: '#7a6a5a' });
    g.restore();
    if (near) { g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(p.name, e.x, e.y - 26); g.fillStyle = '#ffe9a8'; g.fillText(p.name, e.x, e.y - 26); }
  };
  const drawTownBanner = (g) => { // a cloth banner over the board once everything stands
    const cx = tc(BOARD_POS.x), cy = tc(BOARD_POS.y) - 58, wave = Math.sin(time * 2) * 2;
    g.fillStyle = '#5a3e1e'; g.fillRect(cx - 44, cy - 14, 88, 3);
    g.fillStyle = '#7a2e2e'; g.beginPath(); g.moveTo(cx - 40, cy - 11); g.lineTo(cx + 40, cy - 11); g.lineTo(cx + 40, cy + 8 + wave); g.lineTo(cx, cy + 14 + wave); g.lineTo(cx - 40, cy + 8 - wave); g.closePath(); g.fill();
    g.fillStyle = '#f5c542'; g.font = `700 9px ${DISPLAY}`; g.textAlign = 'center'; g.fillText('HOLLOWFORD', cx, cy + 1); g.font = `700 7px ${DISPLAY}`; g.fillText('REBUILT', cx, cy + 9);
  };
  HOOKS.draw.push((g, items, cam) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 3);
    if (x1 < HF_RECT.x0 || x0 > HF_RECT.x1 || y1 < HF_RECT.y0 || y0 > HF_RECT.y1) return;
    const r = RB();
    const mark = unlocked() && PROJECTS.some(p => available(p) && Object.keys(p.cost).some(k => have(p, k) < p.cost[k] && countItem(k) > 0));
    for (let ty = Math.max(y0, HF_RECT.y0); ty <= Math.min(y1, HF_RECT.y1); ty++) for (let tx = Math.max(x0, HF_RECT.x0); tx <= Math.min(x1, HF_RECT.x1); tx++) {
      const t = tileAt(tx, ty);
      if (t === T_RBOARD) { items.push({ y: ty * TILE + TILE - 6, draw: () => drawBoard(g, tx, ty, mark) }); if (allDone()) items.push({ y: ty * TILE + TILE - 5, draw: () => drawTownBanner(g) }); }
      else if (t === T_SAWMILL) items.push({ y: ty * TILE + TILE - 6, draw: () => drawSawmill(g, tx, ty) });
      else if (t === T_GOODWELL) items.push({ y: ty * TILE + TILE - 6, draw: () => drawGoodWell(g, tx, ty) });
      else if (t === T_BELL) items.push({ y: ty * TILE + TILE, draw: () => drawBell(g, tx, ty) });
    }
    const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
    for (const b of RB_BUILDINGS) {
      const built = (b.id === 'rb_house' && r.done.house) || (b.id === 'rb_smithy' && r.done.smithy) || (b.id === 'rb_knight' && r.done.knight);
      if (!built || inRect(b, ptx, pty)) continue; // roof off while the knight is inside, like the core
      if ((b.x + b.w) * TILE > cam.x && b.x * TILE < cam.x + VW && (b.y + b.h) * TILE > cam.y && b.y * TILE < cam.y + VH) items.push({ y: (b.y + b.h) * TILE - 1, draw: () => drawBuilding(g, b) });
    }
    for (const p of people()) if (p.px > cam.x - 60 && p.px < cam.x + VW + 60 && p.py > cam.y - 60 && p.py < cam.y + VH + 60) items.push({ y: p.py + 13, draw: () => drawPerson(g, p) });
    if (!player.dead && !player.mech) items.push({ y: 1e9 + 3, draw: () => {
      if (npcInFront()) return;
      const p = personInFront();
      if (p) { g.strokeStyle = 'rgba(255,233,168,0.7)'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.arc(p.px, p.py, 20, 0, 7); g.stroke(); g.setLineDash([]); return; }
      const { tx, ty } = frontTile(player); const t = tileAt(tx, ty);
      if (t === T_RBOARD || t === T_SAWMILL || t === T_GOODWELL || t === T_BELL) { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]); roundRect(g, tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6, 6); g.stroke(); g.setLineDash([]); }
    } });
  });

  // ---------- the title in the pause menu ----------
  // The core pause menu is drawn after HOOKS.hud, so the title is added by wrapping drawHud (a global
  // function binding; render() looks it up by name each frame). Redraws the stats line with the title in front.
  if (typeof drawHud === 'function') {
    const coreDrawHud = drawHud;
    drawHud = function (g) {
      coreDrawHud(g);
      const title = quest.rebuild && quest.rebuild.title; if (!paused || !title) return;
      const pw = 300, ph = 250, px = VW / 2 - pw / 2, py = VH / 2 - ph / 2;
      g.fillStyle = 'rgba(10,14,22,1)'; g.fillRect(px + 2, py + 196, pw - 4, 18);
      g.font = '11px sans-serif'; g.textBaseline = 'alphabetic';
      let stats = `Kills ${player.kills} · Deaths ${player.deaths} · Best hit ${player.highestHit}`;
      const gap = ' · '; if (g.measureText(title + gap + stats).width > pw - 16) stats = `Kills ${player.kills} · Deaths ${player.deaths}`;
      const tw = g.measureText(title).width, gw = g.measureText(gap).width, sw = g.measureText(stats).width, x0 = VW / 2 - (tw + gw + sw) / 2;
      g.textAlign = 'left'; g.fillStyle = '#f5c542'; g.fillText(title, x0, py + 208); g.fillStyle = '#6e7681'; g.fillText(gap + stats, x0 + tw, py + 208);
      g.textAlign = 'center';
    };
  }

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
    const clearPack = () => { player.inv = player.inv.map(s => s && (s.id === 'coins' || ITEMS[s.id].weapon || ITEMS[s.id].armour || ITEMS[s.id].tool) ? s : null); };
    const pressAt = (sx, sy, tx, ty) => { closePanel(); F.tp(sx, sy); F.face(tx, ty); F.press('KeyE'); F.sim(2, []); };
    const open = () => { openPanel('rebuild'); render(); };
    // snapshot the town so the test leaves Hollowford as it found it
    const snap = new Map(); for (let y = HF_RECT.y0; y <= HF_RECT.y1; y++) for (let x = HF_RECT.x0; x <= HF_RECT.x1; x++) snap.set(idx(x, y), tileAt(x, y));
    const rb0 = quest.rebuild, st0 = quest.stage, hp0 = player.hp;
    h.peace(true); closePanel(); player.action = null; drain(); quest.rebuild = fresh(); resetPeople(); clearPack(); page = 0;
    // the board stands in the square and refuses before the beast is down
    { quest.stage = 9; pressAt(BOARD_POS.x, BOARD_POS.y + 1, BOARD_POS.x, BOARD_POS.y);
      const refused = !!dialog.cur && /Not while the beast walks/.test(dialog.cur.text);
      check('rebuild: board in Hollowford square (139,78); refuses before stage 10 ("Not while the beast walks")', tileAt(BOARD_POS.x, BOARD_POS.y) === T_RBOARD && SOLID.has(T_RBOARD) && RUBBLE_SPOTS.every(([x, y]) => tileAt(x, y) === T.RUBBLE) && panel !== 'rebuild' && refused, { tile: tileAt(BOARD_POS.x, BOARD_POS.y), refused, text: dialog.cur && dialog.cur.text }); drain(); }
    { quest.stage = 10; pressAt(BOARD_POS.x, BOARD_POS.y + 1, BOARD_POS.x, BOARD_POS.y);
      check('rebuild: with the beast down (stage 10) E on the board opens the rebuild panel with 7 projects', panel === 'rebuild' && !!buttons.find(b => b.label === 'Build: Square') && PROJECTS.length === 7 && activeQuests().includes('rebuild'), { panel, buttons: buttons.map(b => b.label).filter(l => /Build/.test(l)) }); }
    // project 1: half now, half later
    { h.give('stone', 10); open(); const c1 = F.clickButton('Build: Square'); const half = have(byId.square, 'stone'), txt = costText(byId.square), left = countItem('stone'), stillOpen = !RB().done.square && available(byId.square);
      h.give('stone', 10); render(); const c2 = F.clickButton('Build: Square'); F.sim(2, []);
      const paved = RUBBLE_SPOTS.every(([x, y]) => tileAt(x, y) === T.COBBLE) && tileAt(137, 79) === T.COBBLE && tileAt(WELL_POS.x, WELL_POS.y) === T.WELL;
      check('rebuild: Clear the square takes 10 stone (10/20, still open), then 10 more finishes it: rubble and dirt in the square are cobble', c1 && half === 10 && txt === 'Stone 10/20' && left === 0 && stillOpen && c2 && RB().done.square && paved, { c1, half, txt, stillOpen, c2, done: !!RB().done.square, paved, banner: levelBanner && levelBanner.text }); }
    // project 2: the well heals once a minute
    { h.give('stone', 10); h.give('plank', 4); open(); const c = F.clickButton('Build: Well'); const wellTile = tileAt(WELL_POS.x, WELL_POS.y);
      player.hp = 1; player.sinceHurt = 0; RB().wellAt = -1e9; pressAt(WELL_POS.x, WELL_POS.y + 1, WELL_POS.x, WELL_POS.y); const healed = player.hp; const h1 = healed > 1 && healed <= player.maxHp;
      player.sinceHurt = 0; F.press('KeyE'); F.sim(2, []); const again = player.hp;
      check('rebuild: The well (10 stone + 4 planks) becomes a working well; E heals a hurt knight, not twice within a minute', c && RB().done.well && wellTile === T_GOODWELL && h1 && Math.abs(again - healed) < 0.5 && player.hp >= 1, { c, wellTile, healed, again, maxHp: player.maxHp }); player.hp = Math.min(hp0, player.maxHp); }
    // project 3: the first house, survivors and villagers come up
    { h.give('plank', 30); h.give('stone', 10); open(); const c = F.clickButton('Build: House'); F.sim(3, []); const b = buildingById('rb_house');
      const walls = tileAt(b.x, b.y) === T.HWALL && tileAt(b.x + b.w - 1, b.y + b.h - 1) === T.HWALL && tileAt(127, 70) === T.FLOOR && tileAt(128, 70) === T.FLOOR;
      const door = tileAt(b.x + b.door, b.y + b.h - 1) === T.DOOR, bed = tileAt(127, 69) === T.BED;
      const named = survivors.map(p => p.name).sort().join(','), inSq = people().every(p => sqIn(Math.floor(p.px / TILE), Math.floor(p.py / TILE)));
      check('rebuild: The first house (30 planks + 10 stone) turns the ruin into HWALL walls, FLOOR, a door and a bed; Tam, Nell and Pip stand in the square with two villagers', c && RB().done.house && walls && door && bed && named === 'Nell,Old Tam,Pip' && villagers.length === 2 && inSq, { c, walls, door, bed, named, villagers: villagers.length, inSq }); }
    { const v = villagers[0]; const x0 = v.px, y0 = v.py; F.tp(150, 60); F.sim(600, []); const moved = villagers.some(w => dist(w.px, w.py, w.home.x, w.home.y) > 12) || dist(v.px, v.py, x0, y0) > 12; const stayed = villagers.every(w => sqIn(Math.floor(w.px / TILE), Math.floor(w.py / TILE)));
      const p = survivors.find(s => s.name === 'Nell'); closePanel(); for (const w of villagers) { w.px = p.px + 9 * TILE; w.py = p.py + 9 * TILE; } F.tp(Math.floor(p.px / TILE), Math.floor(p.py / TILE) + 1); F.face(Math.floor(p.px / TILE), Math.floor(p.py / TILE)); drain(); F.press('KeyE'); F.sim(2, []); const spoke = !!dialog.cur && dialog.cur.who === 'Nell';
      check('rebuild: villagers wander inside the square; E on the square Nell gets a rebuilding line', moved && stayed && spoke, { moved, stayed, spoke, who: dialog.cur && dialog.cur.who }); drain(); }
    // project 0: the sawmill turns logs into planks
    { h.give('plank', 10); h.give('stone', 5); open(); const c = F.clickButton('Build: Sawmill'); const mill = tileAt(SAWMILL_POS.x, SAWMILL_POS.y) === T_SAWMILL;
      removeItem('plank', countItem('plank')); h.give('wood', 1); const cx0 = player.skills.crafting.xp; pressAt(SAWMILL_POS.x, SAWMILL_POS.y + 1, SAWMILL_POS.x, SAWMILL_POS.y);
      check('rebuild: The sawmill (10 planks + 5 stone) stands in the square; E with a log gives 3 planks and 10 Crafting xp', c && RB().done.sawmill && mill && countItem('wood') === 0 && countItem('plank') === 3 && player.skills.crafting.xp === cx0 + 10, { c, mill, planks: countItem('plank'), xp: player.skills.crafting.xp - cx0 }); }
    // project 4: the chapel roof and bell
    { h.give('plank', 20); h.give('iron_bar', 5); open(); const c = F.clickButton('Build: Chapel');
      check('rebuild: The chapel roof (20 planks + 5 iron bars) closes the east wall, floors the nave and raises a bell tower on the corner', c && RB().done.chapel && [86, 87, 88].every(y => tileAt(133, y) === T.CWALL) && tileAt(131, 86) === T.FLOOR && tileAt(132, 88) === T.FLOOR && tileAt(BELL_POS.x, BELL_POS.y) === T_BELL && tileAt(126, 90) === T.TABLE, { c, wall: [86, 87, 88].map(y => tileAt(133, y)), bell: tileAt(BELL_POS.x, BELL_POS.y) }); }
    // project 5: the smithy
    { h.give('plank', 20); h.give('iron_bar', 8); open(); const c = F.clickButton('Build: Smithy');
      check('rebuild: The smithy (20 planks + 8 iron bars) puts a forge beside the surviving anvil under a roof', c && RB().done.smithy && tileAt(134, 70) === T.FORGE && tileAt(135, 70) === T.ANVIL && tileAt(133, 69) === T.HWALL && tileAt(135, 72) === T.DOOR, { c, forge: tileAt(134, 70), anvil: tileAt(135, 70) }); }
    // project 6: the knight's house, the title and the coins
    { h.give('plank', 40); h.give('stone', 10); h.give('mithril_bar', 2); drops.length = 0; const c0 = coins(); open(); const early = F.clickButton('Build: Knight'); F.sim(2, []);
      const paid = coins() === c0 + 500 || drops.some(d => d.id === 'coins' && d.qty === 500);
      check("rebuild: The knight's house (40 planks + 10 stone + 2 mithril bars): bed + lodestone inside, 'HOLLOWFORD REBUILT' banner, 500 coins, a title of Hollowford", early && RB().done.knight && tileAt(152, 74) === T.BED && tileAt(154, 74) === T.LODESTONE && tileAt(151, 73) === T.HWALL && /of Hollowford$/.test(RB().title) && paid && !!levelBanner && levelBanner.text === 'HOLLOWFORD REBUILT' && allDone() && !activeQuests().includes('rebuild'), { early, title: RB().title, coins: coins() - c0, banner: levelBanner && levelBanner.text });
      render(); const flip = F.clickButton('Called: Sir'); check('rebuild: the title can be flipped between Sir and Dame of Hollowford', flip && RB().title === 'Dame of Hollowford', { flip, title: RB().title }); closePanel(); }
    // state survives save/load
    { save(); const doneSnap = JSON.stringify(RB().done); const title = RB().title; const diffs = mapDiffs.size;
      quest = { stage: 0, kills: 0, bread: 'none', wren: 'none', walkerKilled: false, tracked: null }; resetPeople(); const ok = load(); F.sim(2, []);
      check('rebuild: save()/load() keeps the done flags, the title, and the rebuilt tiles (well, house, bell)', ok && JSON.stringify(RB().done) === doneSnap && RB().title === title && mapDiffs.size === diffs && tileAt(WELL_POS.x, WELL_POS.y) === T_GOODWELL && tileAt(BELL_POS.x, BELL_POS.y) === T_BELL && tileAt(127, 69) === T.BED && survivors.length === 3, { ok, done: RB().done, title: RB().title, survivors: survivors.length }); }
    // put the town back the way it was
    for (const [i, t] of snap) if (map[i] !== t) changeTile(i % MAP_W, Math.floor(i / MAP_W), t);
    quest.rebuild = rb0 || fresh(); resetPeople(); quest.stage = Math.max(quest.stage, st0); clearPack(); closePanel(); drain(); player.hp = Math.min(Math.max(hp0, 1), player.maxHp); levelBanner = null; h.peace(false); F.sim(2, []);
  });
}
