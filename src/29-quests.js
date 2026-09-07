// ============================================================================
// NOTICE BOARD — tiny quests. "The huge quest, the side quests, and the tiny quests."
// A wooden board in Thistledown's square (and one on the road outside the cave) lists small jobs
// from the folk of the village. Everything is taken and handed in at the board, so no core NPC
// needs touching. Registered entirely through HOOKS; edits no core file.
// State lives in quest.board = { taken, done, page, fish, fires, wolves, goblins, toasted }.
// ============================================================================
{
  const BOARD = addTile('BOARD', { solid: true, tex: 'cobble', mini: '#8a6a3a' });
  const BOARD_TILES = [[105, 27], [24, 6]]; // the square in Thistledown; the road outside the cave
  const GOBLIN_TYPES = ['goblin', 'sapper', 'brute'];

  // ---------- the jobs ----------
  // kind: item (bring n of an item) | kill (defeat n monsters) | hit (best hit ≥ n) | fish (catch n fish) | fire (light n fires)
  // tag: unique short label used on buttons ('Take: Greta'); short: the words used in progress lines ('Greta: potatoes 4/10')
  const BOARD_QUESTS = [
    { id: 'greta', tag: 'Greta', giver: 'Greta', title: 'Spuds for Greta', kind: 'item', item: 'potato', n: 10, short: 'potatoes', reward: { coins: 60, xp: ['farming', 80] },
      note: "My stall's bare and the soup won't make itself. Ten potatoes, love.", thanks: "Ten fat potatoes! You're a good one. Here, and there's soup on if you want it." },
    { id: 'brakka', tag: 'Brakka', giver: 'Brakka the smith', title: 'Ore for the forge', kind: 'item', item: 'iron_ore', n: 6, short: 'iron ore', reward: { coins: 90, xp: ['smithing', 60] },
      note: 'Six lumps of iron ore. The forge eats more than I do.', thanks: 'Good ore. Heavy. The forge will sing tonight. Take your coin.' },
    { id: 'dorran', tag: 'Dorran', giver: 'Dorran the innkeeper', title: 'Pelts for the inn', kind: 'item', item: 'wolf_pelt', n: 3, short: 'wolf pelts', reward: { coins: 120 },
      note: 'Three wolf pelts for the beds upstairs. The guests keep moaning about the cold.', thanks: 'Warm as a summer night, these. No more moaning guests. Coin, as promised.' },
    { id: 'pim', tag: 'Pim', giver: 'Pim the tinker', title: 'Powder run', kind: 'item', item: 'blast_powder', n: 3, short: 'blast powder', reward: { coins: 100, xp: ['crafting', 200] },
      note: "Three blast powder. Don't shake it. Don't drop it. Don't ask.", thanks: "Oh lovely, still in one piece. Both of us. Here's your coin, and mind your eyebrows." },
    { id: 'rosalind', tag: 'Rosalind', giver: 'Rosalind', title: 'Pie filling', kind: 'item', item: 'raw_beef', n: 5, short: 'raw beef', reward: { coins: 70, xp: ['cooking', 60] },
      note: "Five raw beef and there's a pie in it for the whole street.", thanks: 'Five beef, fresh. The whole street eats pie tonight. Thank you, knight.' },
    { id: 'marta', tag: 'Marta', giver: 'Marta', title: 'Logs for the store', kind: 'item', item: 'wood', n: 20, short: 'logs', reward: { coins: 50, xp: ['woodcutting', 60] },
      note: "Twenty logs. Winter's coming and the shelves won't warm themselves.", thanks: "Twenty logs, stacked and dry. That's the winter sorted. Here you go." },
    { id: 'aldous', tag: 'Aldous', giver: 'Aldous the banker', title: 'Stone for the vault', kind: 'item', item: 'stone', n: 10, short: 'stone', reward: { coins: 30 },
      note: 'Ten stone. The vault wall has a crack and I do not like cracks.', thanks: 'Ten stone, counted twice. The crack will be gone by morning. Your fee.' },
    { id: 'fennick', tag: 'Fennick', giver: 'Fennick the trader', title: 'Tusks, tusks, tusks', kind: 'item', item: 'boar_tusk', n: 5, short: 'boar tusks', reward: { coins: 150 },
      note: "Five boar tusks. There's a buyer down south who pays silly money.", thanks: 'Five tusks! My buyer will weep with joy. Silly money, as promised.' },
    { id: 'duke', tag: 'Duke', giver: 'Duke Ferrin', title: 'Scrap for the armoury', kind: 'item', item: 'goblin_scrap', n: 20, short: 'goblin scrap', reward: { coins: 300, item: ['steel_bar', 1] },
      note: 'Twenty goblin scrap for the armoury. The Duchy pays well, and in steel.', thanks: 'Twenty scrap. Every piece of it was pointed at Thistledown once. Coin, and a bar of good steel.' },
    { id: 'hale', tag: 'Hale', giver: 'Sergeant Hale', title: 'Hit like a knight', kind: 'hit', n: 8, short: 'best hit', reward: { xp: ['melee', 200] },
      note: 'Show me a hit of eight. The dummies in my yard will take it.', thanks: 'Eight! That is a knight’s arm. Keep swinging like that and the goblins will run.' },
    { id: 'cass', tag: 'Cass', giver: 'Cass', title: 'Fish for the street', kind: 'fish', n: 10, short: 'fish', reward: { coins: 80, xp: ['fishing', 60] },
      note: "Ten fish from the pond. Shrimp or trout, I'm not fussy.", thanks: 'Ten fish! Everyone on the street eats tonight. You are a good sort, knight.' },
    { id: 'wren', tag: 'Wren', giver: 'Old Wren', title: 'Fires in the dark', kind: 'fire', n: 5, short: 'fires', reward: { coins: 60, xp: ['firemaking', 80] },
      note: "Light five fires out in the world. The wood gets dark, and wolves don't like light.", thanks: 'Five fires. I saw them from my hut. The wood was quieter for it. Well done.' },
    { id: 'bram', tag: 'Bram', giver: 'Bram', title: 'Wolf cull', kind: 'kill', types: ['wolf'], n: 5, short: 'wolves', reward: { coins: 150, xp: ['defence', 60] },
      note: "Five wolves, knight. They've been at the sheep again.", thanks: 'Five wolves down. The sheep can sleep, and so can I. Here.' },
    { id: 'captain', tag: 'Captain', giver: 'Captain Roderick', title: 'Goblin bounty', kind: 'kill', types: GOBLIN_TYPES, n: 10, short: 'goblins', reward: { coins: 250 },
      note: 'Ten goblins, any size. The watch pays by the head.', thanks: 'Ten heads. The watch pays, and the watch remembers. Good work, knight.' },
    { id: 'thessaly', tag: 'Thessaly', giver: 'Thessaly the weaver', title: 'Wool for the loom', kind: 'item', item: 'wool', n: 10, short: 'wool', reward: { coins: 40, xp: ['crafting', 300] },
      note: 'Ten wool, clean. The loom is hungry and the sheep are a long way from the jungle.', thanks: 'Ten wool. Soft as cloud. Watch how the loom takes it, and you will learn something of the craft.' },
    { id: 'pies', tag: 'Pies', giver: 'Rosalind', title: 'Berry pies for the bakery', kind: 'item', item: 'berry_pie', n: 3, short: 'berry pies', reward: { coins: 120, xp: ['cooking', 100] },
      note: 'Three berry pies. Bushes by the road, flour from wheat, and my ovens are yours. I want to taste yours before I sell them.', thanks: 'Three berry pies, and the crust holds. You could bake for a living, knight. Coin, and a trick or two of the oven.' },
  ];
  const byId = {}; for (const q of BOARD_QUESTS) byId[q.id] = q;

  // ---------- state ----------
  const freshBoard = () => ({ taken: {}, done: {}, page: 0, fish: 0, fires: 0, wolves: 0, goblins: 0, toasted: {} });
  const bq = () => { if (!quest.board) quest.board = freshBoard(); const b = quest.board; for (const k of ['taken', 'done', 'toasted']) if (!b[k]) b[k] = {}; for (const k of ['fish', 'fires', 'wolves', 'goblins']) if (typeof b[k] !== 'number') b[k] = 0; if (typeof b.page !== 'number') b.page = 0; return b; };
  const isTaken = q => !!bq().taken[q.id] && !bq().done[q.id];
  const openQuests = () => BOARD_QUESTS.filter(isTaken);
  const progress = q => {
    const b = bq();
    if (q.kind === 'item') return Math.min(q.n, countItem(q.item));
    if (q.kind === 'hit') return Math.min(q.n, player.highestHit);
    if (q.kind === 'fish') return Math.min(q.n, b.fish);
    if (q.kind === 'fire') return Math.min(q.n, b.fires);
    if (q.kind === 'kill') return Math.min(q.n, q.types.includes('wolf') ? b.wolves : b.goblins);
    return 0;
  };
  const ready = q => isTaken(q) && progress(q) >= q.n;
  const anyReady = () => BOARD_QUESTS.some(ready);
  const skillName = key => SKILL_DEFS.find(s => s.key === key).name;
  const needText = q => {
    const p = progress(q);
    if (q.kind === 'item') return `Bring ${q.n} ${ITEMS[q.item].name} (${p}/${q.n})`;
    if (q.kind === 'hit') return `Land a hit of ${q.n} or more (best ${player.highestHit})`;
    if (q.kind === 'fish') return `Catch ${q.n} fish (${p}/${q.n})`;
    if (q.kind === 'fire') return `Light ${q.n} fires (${p}/${q.n})`;
    return `Defeat ${q.n} ${q.short} (${p}/${q.n})`;
  };
  const rewardText = q => { const r = q.reward, parts = []; if (r.coins) parts.push(`${r.coins} coins`); if (r.xp) parts.push(`${r.xp[1]} ${skillName(r.xp[0])} xp`); if (r.item) parts.push(`${r.item[1] > 1 ? r.item[1] + ' ' : ''}${ITEMS[r.item[0]].name}`); return parts.join(', '); };
  const shortLine = q => `${q.tag}: ${q.short} ${progress(q)}/${q.n}`;

  // ---------- take / hand in ----------
  const takeQuest = q => {
    const b = bq(); if (b.taken[q.id]) return;
    b.taken[q.id] = true;
    notify(`Taken: ${q.title}. Open quests (J) to track it.`);
    floatText(player.x, player.y - 30, q.title, '#ffe9a8', 13);
    save();
  };
  const handIn = q => {
    if (!ready(q)) { notify(`Not yet. ${needText(q)}.`); return false; }
    const b = bq(); const r = q.reward;
    if (q.kind === 'item') removeItem(q.item, q.n);
    b.done[q.id] = true;
    if (r.coins) { giveOrDrop('coins', r.coins, player.x, player.y, true); floatText(player.x, player.y - 30, `+${r.coins} coins`, '#ffd166'); }
    if (r.xp) { gainXp(r.xp[0], r.xp[1]); floatText(player.x, player.y - 46, `+${r.xp[1]} ${skillName(r.xp[0])} xp`, '#58a6ff', 13); }
    if (r.item) giveOrDrop(r.item[0], r.item[1], player.x, player.y);
    say(q.thanks, q.giver);
    levelBanner = { text: 'JOB DONE', sub: q.title, t: 2.6 };
    burst(player.x, player.y, '#ffe066', 16, 110);
    save(); return true;
  };

  // ---------- counters ----------
  HOOKS.kill.push(m => {
    const b = bq(); let hit = false;
    for (const q of BOARD_QUESTS) { if (q.kind !== 'kill' || !isTaken(q) || !q.types.includes(m.type)) continue; if (q.types.includes('wolf')) b.wolves += 1; else b.goblins += 1; hit = true; }
    if (hit) save();
  });
  let lastFish = null; let lastFireSet = null;
  HOOKS.update.push(dt => {
    const b = bq();
    // fishing: raw fish rising while the rod is in the water
    const fishNow = countItem('raw_shrimp') + countItem('raw_trout');
    if (lastFish !== null && player.action && player.action.type === 'fish' && fishNow > lastFish && BOARD_QUESTS.some(q => q.kind === 'fish' && isTaken(q))) b.fish += fishNow - lastFish;
    lastFish = fishNow;
    // firemaking: a fire tile that was not burning last tick
    if (lastFireSet !== null && BOARD_QUESTS.some(q => q.kind === 'fire' && isTaken(q))) { let n = 0; for (const f of fires) if (!lastFireSet.has(f.i)) n++; if (n) b.fires += n; }
    lastFireSet = new Set(fires.map(f => f.i));
    // one toast per job when it becomes ready to hand in
    for (const q of BOARD_QUESTS) if (ready(q) && !b.toasted[q.id]) { b.toasted[q.id] = true; notify(`Notice board: ${q.giver.split(' ')[0]}'s ${q.short} ready to hand in.`); }
  });

  // ---------- world + use ----------
  HOOKS.world.push((rnd, api) => { for (const [x, y] of BOARD_TILES) api.setTile(x, y, BOARD); });
  HOOKS.use.push((t, tx, ty) => { if (t !== BOARD) return false; openPanel('board'); return true; });

  // ---------- panel ----------
  const ROW_H = 66;
  HOOKS.panel.board = (g, narrow) => {
    const b = bq();
    const per = Math.max(2, Math.min(6, Math.floor((VH - 20 - 150) / ROW_H)));
    const pages = Math.max(1, Math.ceil(BOARD_QUESTS.length / per));
    b.page = clamp(b.page | 0, 0, pages - 1);
    const taken = openQuests().length, done = BOARD_QUESTS.filter(q => b.done[q.id]).length, readyN = BOARD_QUESTS.filter(ready).length;
    const { px, py, w, h } = panelBox(g, narrow ? VW - 20 : 580, 96 + per * ROW_H + 52, 'Notice board', `Tiny jobs from the folk of Thistledown · page ${b.page + 1} of ${pages} · ${taken} taken · ${done} done${readyN ? ` · ${readyN} ready` : ''}`);
    const fit = (text, maxW) => { let s = text; while (s.length > 8 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1); return s === text ? text : s + '…'; };
    const bw = narrow ? 96 : 122, textW = w - 36 - bw - 24;
    BOARD_QUESTS.slice(b.page * per, b.page * per + per).forEach((q, i) => {
      const y = py + 66 + i * ROW_H; const isDone = !!b.done[q.id], tk = isTaken(q), rd = ready(q);
      roundRect(g, px + 18, y, w - 36, ROW_H - 6, 8); g.fillStyle = isDone ? 'rgba(255,255,255,0.03)' : rd ? 'rgba(126,231,135,0.10)' : tk ? 'rgba(88,166,255,0.10)' : 'rgba(255,255,255,0.05)'; g.fill();
      if (rd) { g.strokeStyle = 'rgba(126,231,135,0.45)'; g.lineWidth = 1; g.stroke(); }
      g.textAlign = 'left'; g.fillStyle = isDone ? '#6e7681' : '#e6edf3'; g.font = 'bold 13px sans-serif'; g.fillText(fit(`${q.title}  · ${q.giver}`, textW), px + 30, y + 18);
      g.fillStyle = isDone ? '#4b535d' : '#c9d1d9'; g.font = 'italic 12px sans-serif'; g.fillText(fit(`“${q.note}”`, textW), px + 30, y + 35);
      g.font = '11px sans-serif'; g.fillStyle = isDone ? '#4b535d' : rd ? '#7ee787' : '#8b949e'; g.fillText(fit(`${isDone ? 'Done' : needText(q)} · Reward: ${rewardText(q)}`, textW), px + 30, y + 51);
      const bx = px + w - 18 - bw, by = y + 15;
      if (isDone) button(g, bx, by, bw, 30, 'Done', () => { }, '#2a2f3a', false);
      else if (!tk) button(g, bx, by, bw, 30, `Take: ${q.tag}`, () => takeQuest(q), '#238636');
      else button(g, bx, by, bw, 30, `Hand in: ${q.tag}`, () => handIn(q), rd ? '#238636' : '#2a2f3a', rd);
    });
    const fy = py + h - 44;
    button(g, px + 18, fy, 80, 30, 'Prev', () => { b.page = Math.max(0, b.page - 1); save(); }, '#21262d', b.page > 0);
    button(g, px + 106, fy, 80, 30, 'Next', () => { b.page = Math.min(pages - 1, b.page + 1); save(); }, '#21262d', b.page < pages - 1);
    button(g, px + w - 18 - 100, fy, 100, 30, 'Close', closePanel, '#21262d');
    g.fillStyle = '#6e7681'; g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillText('Take a job, do it, bring it back here.', px + w / 2, fy + 20);
  };

  // ---------- drawing ----------
  const drawBoard = (g, tx, ty, mark) => {
    const cx = tc(tx), cy = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 18, 20, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#5a3e1e'; g.fillRect(cx - 18, cy - 26, 5, 46); g.fillRect(cx + 13, cy - 26, 5, 46);
    g.fillStyle = '#8a6a3a'; g.fillRect(cx - 23, cy - 34, 46, 31); g.strokeStyle = '#4a2e13'; g.lineWidth = 1.5; g.strokeRect(cx - 23, cy - 34, 46, 31);
    g.strokeStyle = 'rgba(60,40,20,0.35)'; g.lineWidth = 1; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(cx - 23, cy - 34 + k * 8); g.lineTo(cx + 23, cy - 34 + k * 8); g.stroke(); }
    g.fillStyle = '#6b4a2a'; g.beginPath(); g.moveTo(cx - 27, cy - 34); g.lineTo(cx, cy - 43); g.lineTo(cx + 27, cy - 34); g.closePath(); g.fill();
    const papers = [[-19, -30, 11, 13, -0.08], [-5, -31, 10, 12, 0.06], [8, -29, 11, 14, -0.04], [-13, -16, 12, 10, 0.05], [3, -15, 13, 9, -0.06]];
    for (const [ox, oy, pw, ph, rot] of papers) {
      g.save(); g.translate(cx + ox + pw / 2, cy + oy + ph / 2); g.rotate(rot);
      g.fillStyle = '#efe6cf'; g.fillRect(-pw / 2, -ph / 2, pw, ph);
      g.strokeStyle = 'rgba(80,60,30,0.5)'; g.lineWidth = 0.8; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-pw / 2 + 2, -ph / 2 + 3.5 + k * 3); g.lineTo(pw / 2 - 2, -ph / 2 + 3.5 + k * 3); g.stroke(); }
      g.fillStyle = '#c0392b'; g.beginPath(); g.arc(0, -ph / 2 + 1.5, 1.5, 0, 7); g.fill();
      g.restore();
    }
    if (mark) { const bob = Math.sin(time * 4) * 2; g.font = `800 16px ${DISPLAY}`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText('!', cx, cy - 48 + bob); g.fillStyle = '#f5c542'; g.fillText('!', cx, cy - 48 + bob); }
  };
  HOOKS.draw.push((g, items, cam) => {
    const mark = anyReady();
    for (const [tx, ty] of BOARD_TILES) {
      if (tileAt(tx, ty) !== BOARD) continue;
      if (tx * TILE < cam.x - 80 || tx * TILE > cam.x + VW + 80 || ty * TILE < cam.y - 80 || ty * TILE > cam.y + VH + 80) continue;
      items.push({ y: ty * TILE + TILE - 6, draw: () => drawBoard(g, tx, ty, mark) });
    }
    if (!player.dead && !player.mech) items.push({ y: 1e9 + 2, draw: () => {
      if (npcInFront()) return;
      const { tx, ty } = frontTile(player);
      if (tileAt(tx, ty) === BOARD) { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]); roundRect(g, tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6, 6); g.stroke(); g.setLineDash([]); }
    } });
  });

  // ---------- quest tab ----------
  QUEST_DEFS.board = { name: 'Notice board' };
  HOOKS.activeQuests.push(() => openQuests().length ? ['board'] : []);
  HOOKS.questText.board = () => { const open = openQuests(); if (!open.length) return 'Take a job from the notice board in the square.'; const first = open.find(ready) || open[0]; return shortLine(first) + (ready(first) ? ' · hand in at the board' : '') + (open.length > 1 ? ` (+${open.length - 1} more)` : ''); };
  HOOKS.newGame.push(() => { quest.board = freshBoard(); lastFish = null; lastFireSet = null; });

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const ensureRoom = n => { for (let i = player.inv.length - 1; i >= 0 && player.inv.filter(s => !s).length < n; i--) { const s = player.inv[i]; if (s && s.id !== 'coins' && !ITEMS[s.id].weapon && !ITEMS[s.id].armour && !ITEMS[s.id].tool) player.inv[i] = null; } };
    const open = () => { openPanel('board'); render(); };
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
    const pageOf = q => Math.floor(BOARD_QUESTS.indexOf(q) / Math.max(2, Math.min(6, Math.floor((VH - 20 - 150) / ROW_H))));
    h.peace(true); closePanel(); player.action = null; drops.length = 0; drain();
    quest.board = freshBoard(); lastFish = null; lastFireSet = null;
    ensureRoom(4); removeItem('potato', countItem('potato')); F.sim(2, []);
    // the board stands in the square and answers E
    { F.tp(112, 33); const w = F.walkTo(105, 28, 6000); F.face(105, 27); F.press('KeyE'); F.sim(2, []);
      check('board: notice board tile in the square (105,27) and by the cave road (24,6); E opens the panel', tileAt(105, 27) === BOARD && tileAt(24, 6) === BOARD && SOLID.has(BOARD) && typeof w === 'number' && panel === 'board', { w, panel, tile: tileAt(105, 27) }); }
    // take Greta's job
    { const greta = byId.greta; bq().page = pageOf(greta); render(); const took = F.clickButton('Take: Greta');
      check("board: 'Take: Greta' marks the job taken, the Notice board quest goes active with a progress line", took && isTaken(greta) && activeQuests().includes('board') && QUEST_DEFS.board.name === 'Notice board' && questText('board') === 'Greta: potatoes 0/10', { took, taken: !!bq().taken.greta, text: questText('board') }); }
    // hand-in refuses without potatoes; the toast fires once they are in the pack
    { render(); const refused = !F.clickButton('Hand in: Greta') && !bq().done.greta;
      h.give('potato', 4); F.sim(2, []); const partial = questText('board');
      notice = null; bq().toasted.greta = false; h.give('potato', 6); F.sim(2, []); const toast = notice && /Greta's potatoes ready to hand in/.test(notice.text);
      check('board: hand-in is refused without the potatoes; progress shows 4/10; a toast says when it is ready', refused && partial === 'Greta: potatoes 4/10' && !!toast, { refused, partial, notice: notice && notice.text }); }
    // hand in: potatoes out, coins + Farming xp in, job done
    { const c0 = coins(), fx0 = player.skills.farming.xp, p0 = countItem('potato'); drain(); open(); const clicked = F.clickButton('Hand in: Greta'); F.sim(2, []);
      check('board: handing in takes 10 potatoes and pays 60 coins + 80 Farming xp; the job is done and the quest tab clears', clicked && bq().done.greta && countItem('potato') === p0 - 10 && coins() === c0 + 60 && player.skills.farming.xp === fx0 + 80 && !activeQuests().includes('board') && dialog.cur && dialog.cur.who === 'Greta', { clicked, potatoes: countItem('potato'), coins: coins() - c0, xp: player.skills.farming.xp - fx0, who: dialog.cur && dialog.cur.who });
      render(); const again = F.clickButton('Hand in: Greta') || F.clickButton('Take: Greta'); check('board: a finished job cannot be taken or handed in twice', !again && bq().done.greta, { again }); }
    // kill counter: Goblin bounty
    { const q = byId.captain; bq().page = pageOf(q); open(); const took = F.clickButton('Take: Captain'); closePanel();
      const gob = monsters.find(m => m.type === 'goblin'); gob.dead = false; gob.hp = 1; gob.stunT = 0; gob.x = player.x + 40; gob.y = player.y; hitMonster(gob, 5, 0); F.sim(2, []);
      check('board: Goblin bounty counts goblin kills (1/10 after one goblin)', took && gob.dead && bq().goblins === 1 && progress(q) === 1 && /Captain: goblins 1\/10/.test(questText('board')), { took, dead: gob.dead, goblins: bq().goblins, text: questText('board') }); }
    // fire counter: light a fire on grass
    { const q = byId.wren; bq().page = pageOf(q); open(); const took = F.clickButton('Take: Wren'); closePanel();
      const o = h.openSpot(60, 24); F.tp(o.x, o.y); player.facing = { x: 1, y: 0 }; const tx = o.x + 1, ty = o.y; if (tileAt(tx, ty) !== T.GRASS) changeTile(tx, ty, T.GRASS); h.give('wood', 1);
      F.sim(1, []); const f0 = bq().fires; player.action = { type: 'light', t: 99, need: 1.5, tx, ty, log: 'wood', under: T.GRASS }; F.sim(2, []);
      check('board: Fires in the dark counts a fire the knight lights (1/5)', took && tileAt(tx, ty) === T.FIRE && bq().fires === f0 + 1 && progress(q) === 1, { took, tile: tileAt(tx, ty), fires: bq().fires }); }
    // best-hit job
    { const q = byId.hale; const hh = player.highestHit; player.highestHit = 0; bq().page = pageOf(q); open(); const took = F.clickButton('Take: Hale'); render(); const early = !F.clickButton('Hand in: Hale');
      player.highestHit = Math.max(8, hh); F.sim(2, []); const mx0 = player.skills.melee.xp; open(); const clicked = F.clickButton('Hand in: Hale'); F.sim(2, []);
      check("board: Hale's job needs a best hit of 8, then pays 200 Melee xp", took && early && clicked && bq().done.hale && player.skills.melee.xp === mx0 + 200, { took, early, clicked, xp: player.skills.melee.xp - mx0 }); closePanel(); }
    // fish counter: raw fish rising while fishing
    { const q = byId.cass; bq().page = pageOf(q); open(); const took = F.clickButton('Take: Cass'); closePanel(); ensureRoom(2);
      const w = F.nearestTile([T.WATER]) || { x: 43, y: 36 }; player.action = { type: 'fish', t: 0, need: 1.8, tx: w.x, ty: w.y }; const f0 = bq().fish;
      const steps = F.untilAction(2400, () => bq().fish > f0); player.action = null;
      check('board: Fish for the street counts fish caught with the rod', took && typeof steps === 'number' && bq().fish === f0 + 1 && progress(q) >= 1, { took, steps, fish: bq().fish }); }
    // paging
    { const per = Math.max(2, Math.min(6, Math.floor((VH - 20 - 150) / ROW_H))); const l2 = `Take: ${BOARD_QUESTS[per].tag}`, l1 = 'Take: Brakka';
      bq().page = 0; open(); const p0 = bq().page; const prevOff = !F.clickButton('Prev'); const next = F.clickButton('Next'); const p1 = bq().page; const onPage2 = !!buttons.find(b => b.label === l2); const prev = F.clickButton('Prev'); const p2 = bq().page; const onPage1 = !!buttons.find(b => b.label === l1);
      check('board: six jobs a page, Next and Prev turn the pages (Prev is off on the first page)', prevOff && next && p0 === 0 && p1 === 1 && onPage2 && prev && p2 === 0 && onPage1 && BOARD_QUESTS.length >= 12, { p0, p1, p2, onPage2, onPage1, jobs: BOARD_QUESTS.length }); }
    // Rosalind's berry pies: three pies → 120 coins + 100 Cooking xp
    { const q = byId.pies; const ok = !!q && q.kind === 'item' && q.item === 'berry_pie' && q.n === 3 && q.reward.coins === 120 && q.reward.xp[0] === 'cooking' && q.reward.xp[1] === 100 && q.giver === 'Rosalind' && !!ITEMS.berry_pie;
      bq().page = pageOf(q); open(); const took = F.clickButton('Take: Pies'); closePanel(); ensureRoom(2); h.give('berry_pie', 3); F.sim(2, []);
      const c0 = coins(), x0 = player.skills.cooking.xp; drain(); open(); const clicked = F.clickButton('Hand in: Pies'); F.sim(2, []);
      check("board: Rosalind's berry pie job — 3 berry pies pay 120 coins + 100 Cooking xp", ok && took && clicked && bq().done.pies && countItem('berry_pie') === 0 && coins() === c0 + 120 && player.skills.cooking.xp === x0 + 100, { ok, took, clicked, coins: coins() - c0, xp: player.skills.cooking.xp - x0 }); closePanel(); }
    // several taken: the tracked line prefers a ready job and counts the rest
    { const open3 = openQuests(); const t = questText('board'); check('board: quest tab line shows one job with progress and how many more are taken', open3.length >= 3 && /^[A-Za-z]+: [a-z ]+ \d+\/\d+/.test(t) && new RegExp(`\\(\\+${open3.length - 1} more\\)`).test(t), { open: open3.map(q => q.id), text: t }); }
    closePanel(); player.action = null; drain(); h.peace(false); F.sim(2, []);
  });
}
