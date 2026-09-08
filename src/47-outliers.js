// ============================================================================
// THE LAST THREE OUTLIERS — Defence, Farming and Crafting, brought back into the pack
// docs/AUDIT-2026-09-08.html, "Found, not fixed": after the first progression pass three skills were still
// far outside the 41–181 hour band that everything else sits in.
//   Defence   603 h — the only real source was taking damage. A knight who fought well levelled slowest.
//   Farming   476 h — dragonfruit at Farming 55 was the top crop, and nothing grew above it.
//   Crafting  422 h — the greater poultice at Crafting 45 was the top recipe, and nothing was made above it.
// Nothing here multiplies an existing number or raises an existing reward. Three new things to do:
//   1. SHIELD BLOCKING (Defence). R raises the shield for 0.8 s. A blow that comes in while it is up crashes
//      off it — the defence roll is worth 2.5x and anything that still lands hits for half — and the block
//      teaches 4 Defence xp plus half the monster's level. One reward per raise, so a swarm of goblins is
//      worth no more than one hard hitter, and you cannot swing while you block. It rewards timing, not tanking.
//   2. CLOUDBERRIES (Farming 75). A fourth crop above dragonfruit. Dunstan sells the seed at the dung farm.
//      The berry heals 30, the most any food in the game heals.
//   3. RICH COMPOST (Crafting 60). A repeatable that eats dragon dung — the one thing every ash drake and
//      every dragon always drops — and turns it into something with a real use: spread it on a growing crop
//      and the crop jumps a growth stage.
// Feature file: registers through HOOKS only, edits no core file. window.OUTLIERS exposes the tables.
// ============================================================================
{
  // ---------- items ----------
  Object.assign(ITEMS, {
    cloudberry_seed: { name: 'Cloudberry seed', value: 400, color: '#8fb6d8', shape: 'seed', seed: 'cloudberry', seedLv: 75 },
    cloudberry: { name: 'Cloudberry', value: 620, color: '#bcd9f0', shape: 'berries', farmXp: 1000, heal: 30 },
    rich_compost: { name: 'Rich compost', value: 240, color: '#7a6440', shape: 'powder' },
  });
  for (const id of ['cloudberry_seed', 'cloudberry', 'rich_compost']) { ITEMS[id].id = id; ITEMS[id].stack = 50; }

  // Dunstan farms dung in the Ashfields, so the seed that wants the richest ground is sold at his stall.
  // (Greta's stall is the fallback if 30-ashdrake ever stops opening one.)
  if (SHOPS.dung) SHOPS.dung.stock.push(['cloudberry_seed', 400]);
  else if (SHOPS.seeds) SHOPS.seeds.stock.push(['cloudberry_seed', 400]);

  // ---------- 3. rich compost: the crafting sink, and what it is for ----------
  const COMPOST_OK = !!(ITEMS.dragon_dung && ITEMS.obsidian && ITEMS.herbs);
  const COMPOST = { out: 'rich_compost', qty: 2, needs: [['dragon_dung', 3], ['herbs', 2], ['obsidian', 1]], station: 'workbench', skill: 'crafting', lv: 60, xp: 1400, label: '3 Dragon dung + 2 Herbs + Obsidian → 2 Rich compost' };
  if (COMPOST_OK) RECIPES.push(COMPOST);

  // E on a crop that is still growing, with compost in the pack, spreads a handful: the crop jumps one stage
  // (a stage is 40 s of growing). E on a grown crop still harvests it, exactly as before.
  const _harvest = harvest;
  harvest = function (tx, ty) {
    const c = crops.find(c => c.i === idx(tx, ty));
    if (c && c.stage < 3 && countItem('rich_compost') > 0) {
      removeItem('rich_compost', 1); c.stage += 1; c.t = 0;
      floatText(tc(tx), tc(ty) - 30, 'Compost spread', '#b7e08a', 13);
      burst(tc(tx), tc(ty), '#7a6440', 12, 60); sfx('ui'); save();
      notify(c.stage >= 3 ? 'The crop shoots up. It is ready to harvest.' : 'The crop shoots up a stage.');
      return;
    }
    return _harvest(tx, ty);
  };
  // a lump of compost in the pack tells you what it is for instead of quoting its price
  const _useItem = useItem;
  useItem = function (slot) {
    const s = player.inv[slot];
    if (s && s.id === 'rich_compost') { notify('Face a crop that is still growing and press E to spread it.'); return; }
    return _useItem(slot);
  };

  // ---------- 1. the shield block ----------
  const BLOCK_UP = 0.8;        // seconds the shield stays up
  const BLOCK_CYCLE = 1.25;    // seconds before it can be raised again (0.8 up + 0.45 to get it back in place)
  const BLOCK_ROLL = 2.5;      // what a raised shield is worth on the defence roll
  const BLOCK_SECS = 1.4;      // the honest rhythm of one raise, one blow, one drop — what the audit is told
  const blockXp = lv => 4 + Math.floor((lv | 0) / 2);
  const BLOCK = { t: 0, cd: 0, paid: false, blocks: 0 };
  const shieldOn = () => { const s = player.equip.shield; return s && ITEMS[s] ? ITEMS[s] : null; };
  function raiseShield() {
    if (player.dead || paused || panel) return;
    if (player.mech) { notify('The walker has no shield. Climb out first.'); return; }
    const sh = shieldOn();
    if (!sh) { notify('You need a shield on your arm to block. Marta sells a bronze shield.'); return; }
    if (BLOCK.cd > 0) return;
    BLOCK.t = BLOCK_UP; BLOCK.cd = BLOCK_CYCLE; BLOCK.paid = false; player.action = null; sfx('ui');
  }
  HOOKS.update.push(dt => {
    BLOCK.t = Math.max(0, BLOCK.t - dt); BLOCK.cd = Math.max(0, BLOCK.cd - dt);
    if (pressed.has('KeyR')) raiseShield();
  });
  HOOKS.keyHelp.push({ action: 'Raise shield', codes: ['KeyR'] }); // 43-settings lists it on the Controls line
  HOOKS.newGame.push(() => { BLOCK.t = 0; BLOCK.cd = 0; BLOCK.paid = false; BLOCK.blocks = 0; player.blockTaught = false; });

  // whose blow is being rolled right now: the core sets m.attackT (33-goblincity sets m.armT) in the same
  // statement as the roll, so the swinging monster wins; otherwise the nearest thing standing over you
  function swinger() {
    let best = null, bestScore = 1e9;
    for (const m of monsters) {
      if (m.dead) continue;
      const d = dist(m.x, m.y, player.x, player.y) - m.r;
      if (d > player.r + 30) continue;
      const score = ((m.attackT > 0.15 || (m.armT || 0) > 0.15) ? 0 : 1000) + d;
      if (score < bestScore) { bestScore = score; best = m; }
    }
    return best;
  }
  // playerDefRoll() is called at exactly one moment: a monster is swinging at the knight and the game is
  // rolling whether it lands (06-systems rollHit, driven from 07-update and 33-goblincity). That is where a
  // block is scored. One reward per raise — a wall of goblins pays no more than the one blow you stopped.
  const _playerDefRoll = playerDefRoll;
  playerDefRoll = function () {
    const base = _playerDefRoll();
    if (!(BLOCK.t > 0) || player.mech || !shieldOn()) return base;
    if (!BLOCK.paid) {
      BLOCK.paid = true; BLOCK.blocks += 1;
      const m = swinger(), def = m && MONSTER_DEFS[m.type];
      const xp = blockXp(def ? def.level : 0);
      gainXp('defence', xp); sfx('hit');
      floatText(player.x, player.y - 40, `Block! +${xp} Defence xp`, '#8fb4ff', 14);
      burst(player.x + player.facing.x * 18, player.y + player.facing.y * 18, '#cfe3ff', 10, 70);
    }
    return Math.round(base * BLOCK_ROLL);
  };
  // whatever gets past the shield hits for half
  const _hurtPlayer = hurtPlayer;
  hurtPlayer = function (dmg, fromX, fromY, sure) {
    if (BLOCK.t > 0 && dmg > 0 && !player.mech && shieldOn()) dmg = Math.max(1, Math.ceil(dmg / 2));
    return _hurtPlayer(dmg, fromX, fromY, sure);
  };
  // the trade: while the shield is up you are not swinging
  const _playerAttack = playerAttack;
  playerAttack = function () {
    if (BLOCK.t > 0 && !player.mech && shieldOn()) { notify('Shield up. You cannot swing while you block.'); return; }
    return _playerAttack.apply(this, arguments);
  };
  // the shield itself, held out in front of the knight while it is up
  // 09-render calls each draw hook as h(g, items, cam), and later runs every item's draw() with NO
  // arguments. So the handler takes (g, items) and the item closes over g.
  function drawShield(g, items) {
    if (!(BLOCK.t > 0) || player.dead || player.mech) return;
    const sh = shieldOn(); if (!sh) return;
    items.push({ y: player.y + 1, draw: () => {
      g.save(); g.translate(player.x + player.facing.x * 15, player.y + player.facing.y * 15 - 6);
      g.rotate(Math.atan2(player.facing.y, player.facing.x));
      g.fillStyle = sh.color; g.beginPath();
      g.moveTo(1, -11); g.lineTo(6, -8); g.lineTo(6, 8); g.lineTo(1, 11); g.lineTo(-3, 8); g.lineTo(-3, -8); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2; g.stroke();
      g.restore();
    } });
  }
  HOOKS.draw.push(drawShield);
  // every key needs a button: BLOCK sits with the other action buttons on touch, under the Wiki button on a desktop
  function blockRect() {
    if (!isTouch) return { x: 274, y: 46, w: 92, h: 26, label: 'Block (R)' };
    const mx = x => (window.__stickRight === true ? VW - x : x);
    return { x: mx(VW - 250) - 34, y: VH - 134, w: 68, h: 68, label: 'BLOCK' };
  }
  HOOKS.hud.push(g => {
    if (player.dead || player.mech) return;
    const r = blockRect(), up = BLOCK.t > 0, ready = BLOCK.cd <= 0 && !!shieldOn();
    button(g, r.x, r.y, r.w, r.h, up ? 'BLOCKING' : r.label, raiseShield, up ? '#1f6feb' : ready ? '#30363d' : '#21262d');
  });

  // ---------- teaching it: the book, and the first blow the knight takes with a shield on his arm ----------
  { const pay = t => { const d = MONSTER_DEFS[t]; return d ? `a ${d.name.toLowerCase()} (level ${d.level}) pays ${blockXp(d.level)}` : null; };
    const examples = ['goblin', 'ash_drake', 'red_dragon'].map(pay).filter(Boolean).join(', ');
    if (window.WIKI) WIKI.add('skills', { id: 'blocking', name: 'Blocking with a shield', lines: [
      'Wear a shield and you can block. The trick is timing: raise it as the blow comes in, not after.',
      '',
      `RAISING IT. Press R, or tap BLOCK. The shield stays up for ${BLOCK_UP} seconds, and it takes ${(BLOCK_CYCLE - BLOCK_UP).toFixed(2)} seconds more to get it back in place before you can raise it again.`,
      `WHILE IT IS UP. Blows are ${BLOCK_ROLL} times harder to land on you, and anything that still lands hits for half.`,
      `WHAT IT TEACHES. A raise that stops a blow pays 4 Defence xp plus half the monster's level: ${examples}.`,
      'One reward a raise, so a wall of goblins is worth no more than the one blow you stopped.',
      'THE COST. You cannot swing while the shield is up. Block or hit, not both.',
    ] }); }
  // one blow, once a game: the knight learns the block from the first thing that hits him while he is wearing a shield
  HOOKS.hurt.push(() => {
    if (player.blockTaught || player.dead || player.mech || !shieldOn()) return;
    player.blockTaught = true;
    notify(touchMode() ? 'That shield can stop a blow. Tap BLOCK as the next one comes in.' : 'That shield can stop a blow. Press R to raise it as the next one comes in.');
    save();
  });

  // ---------- tell the audit what was added (42-playthrough reads HOOKS.xpSource) ----------
  if (HOOKS.xpSource) HOOKS.xpSource.push(add => {
    const note = 'raise the shield as the blow comes in; one reward a raise, and no swinging while it is up';
    add('defence', 'block a goblin brute with a shield (4 + half its level)', 1, blockXp(MONSTER_DEFS.brute ? MONSTER_DEFS.brute.level : 9), BLOCK_SECS, note);
    if (MONSTER_DEFS.ash_drake) add('defence', 'block an ash drake with a shield', 20, blockXp(MONSTER_DEFS.ash_drake.level), BLOCK_SECS, 'the Ashfields');
    if (MONSTER_DEFS.green_dragon) add('defence', 'block a green dragon with a shield', 30, blockXp(MONSTER_DEFS.green_dragon.level), BLOCK_SECS, 'the dragon glade');
    if (MONSTER_DEFS.red_dragon) add('defence', 'block a red dragon with a shield', 40, blockXp(MONSTER_DEFS.red_dragon.level), BLOCK_SECS, 'the hardest blow you can stand in front of and live');
    add('farming', 'a cloudberry crop', 75, 5 + 8 + ITEMS.cloudberry.farmXp * 3, 120, 'per plot; Dunstan sells the seed at 400');
    if (COMPOST_OK) add('crafting', COMPOST.label, COMPOST.lv, COMPOST.xp, 3 * 10 + 2 * 10 + 1 * 2.2, 'workbench; dung from every drake and dragon, obsidian from the Ashfields');
  });

  window.OUTLIERS = { BLOCK, BLOCK_UP, BLOCK_CYCLE, BLOCK_ROLL, BLOCK_SECS, blockXp, shieldOn, raiseShield, swinger, COMPOST, blockRect };

  // ---------- self-test ----------
  const P = 'outliers: ';
  HOOKS.selfTest.push((check, F, h) => {
    const s0 = { ...player.skills.farming }, d0 = { ...player.skills.defence }, c0 = { ...player.skills.crafting };
    const eq0 = { ...player.equip }, kid0 = !!window.__kidmode;
    window.__kidmode = false; h.peace(true);
    // ---- the shield is actually drawn ----
    // The headless canvas is a Proxy that answers every name with a no-op, so a draw hook can push its item
    // into the CONTEXT by mistake and nothing complains. This check does not trust that: it hands the hook a
    // real array as the second argument and a context that writes down every call it is given, then runs the
    // item's draw() with no arguments, exactly the way 09-render does. It fails if the shield never lands in
    // the list, and it fails if the item's draw needs an argument it will never be handed.
    { const t0 = BLOCK.t, eq1 = player.equip.shield, dead0 = player.dead, mech0 = player.mech;
      BLOCK.t = 0.5; player.dead = false; player.mech = false; player.equip.shield = 'steel_shield';
      const painted = [];
      const probe = new Proxy({}, {
        get: (t, k) => typeof k !== 'string' ? undefined
          : k === 'measureText' ? () => ({ width: 10 })
            : (...a) => { painted.push(k); },
        set: () => true,
      });
      const list = [];
      let hookErr = null;
      try { drawShield(probe, list, cam); } catch (e) { hookErr = String((e && e.message) || e); }
      const pushed = !hookErr && list.length === 1 && typeof list[0].draw === 'function';
      const stray = painted.slice(); // anything the hook itself called on the context — should be nothing
      painted.length = 0;
      let drawErr = null;
      if (pushed) { try { list[0].draw(); } catch (e) { drawErr = String((e && e.message) || e); } }
      const drew = pushed && !drawErr && painted.includes('fill') && painted.includes('stroke') && painted.includes('restore');
      // and with the shield down the hook draws nothing at all
      BLOCK.t = 0; const down = [];
      drawShield(probe, down, cam);
      BLOCK.t = t0; player.equip.shield = eq1; player.dead = dead0; player.mech = mech0;
      recomputeMaxHp(); player.hp = player.maxHp;
      check(P + 'the raised shield is put in the draw list and paints with no arguments; with the shield down nothing is drawn',
        drew && down.length === 0 && stray.length === 0,
        { hookErr, pushed, listed: list.length, stray, drawErr, painted: painted.length, whenDown: down.length }); }

    // ---- the same mistake, guarded for every feature file ----
    // 09-render calls each hook as h(g, items, cam) and then each item's draw() with no arguments. A hook
    // written with one parameter gets the canvas instead of the list and takes the whole frame down with it —
    // the world, the HUD, everything. One parameter is always the bug, so no hook is allowed to have one.
    { const thin = [], needy = [], probe = new Proxy({}, {
      get: (t, k) => typeof k !== 'string' ? undefined : k === 'measureText' ? () => ({ width: 10 })
        : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: () => { } }) : () => { },
      set: () => true,
    });
      HOOKS.draw.forEach((h, i) => {
        const who = i + ':' + (h.name || 'anonymous');
        if (h.length < 2) thin.push(who + ' takes ' + h.length);
        const list = [];
        try { h(probe, list, cam); } catch (e) { /* a hook that will not run on a probe canvas is not this check's business */ }
        for (const it of list) if (it && typeof it.draw === 'function' && it.draw.length > 0) needy.push(who + ' pushed a draw wanting ' + it.draw.length);
      });
      check(P + 'every draw hook takes at least (g, items), and every item it lists draws with no arguments',
        thin.length === 0 && needy.length === 0, { hooks: HOOKS.draw.length, thin, needy }); }


    // ---- the shield block ----
    { const o = h.openSpot(70, 34); F.tp(o.x, o.y); F.sim(2, []);
      BLOCK.t = 0; BLOCK.cd = 0; BLOCK.paid = false;
      player.equip.shield = null; notice = null;
      F.press('KeyR');
      const refused = BLOCK.t === 0 && !!notice && /shield/i.test(notice.text);
      player.equip.shield = 'steel_shield';
      BLOCK.cd = 0; F.press('KeyR');
      const up = BLOCK.t > 0;
      // a monster put right next to the knight, then the blow the core rolls when it swings
      const m = monsters.filter(x => !x.dead).sort((a, b) => (MONSTER_DEFS[b.type].level | 0) - (MONSTER_DEFS[a.type].level | 0))[0];
      const home = m ? { x: m.x, y: m.y, at: m.attackT } : null;
      let roll = 0, want = 0, gained = 0, again = 0, plain = 0, plainXp = 0, lvl = 0;
      if (m) {
        m.x = player.x + player.r + m.r + 2; m.y = player.y; m.attackT = 0.2;
        lvl = MONSTER_DEFS[m.type].level | 0;
        player.skills.defence.xp = XP_TABLE[30];
        const base = (skillLv('defence') + 8) * (64 + gearBonus('def'));
        const x0 = player.skills.defence.xp;
        roll = playerDefRoll(); want = Math.round(base * BLOCK_ROLL);
        gained = player.skills.defence.xp - x0;
        const x1 = player.skills.defence.xp; playerDefRoll(); again = player.skills.defence.xp - x1;
        BLOCK.t = 0; const x2 = player.skills.defence.xp; plain = playerDefRoll(); plainXp = player.skills.defence.xp - x2;
        m.x = home.x; m.y = home.y; m.attackT = home.at;
      }
      check(P + 'a shield block teaches Defence: 4 xp plus half the monster level, once per raise, and the raised shield is worth 2.5x the defence roll',
        refused && up && !!m && gained === blockXp(lvl) && again === 0 && roll === want && plain === Math.round(want / BLOCK_ROLL) && plainXp === 0,
        { refused, up, type: m && m.type, level: lvl, want: blockXp(lvl), gained, again, roll, wantRoll: want, plain, plainXp }); }

    // ---- what the shield is worth: half damage, and no swinging ----
    { BLOCK.t = 0.5; BLOCK.cd = BLOCK_CYCLE; BLOCK.paid = true;
      player.equip.shield = 'steel_shield'; recomputeMaxHp(); player.hp = player.maxHp;
      const hp0 = player.hp; hurtPlayer(10, player.x + 40, player.y, true);
      const halved = hp0 - player.hp === 5;
      player.attackCd = 0; notice = null; playerAttack();
      const noSwing = player.attackCd === 0 && !!notice && /Shield up/.test(notice.text);
      BLOCK.t = 0; player.attackCd = 0; player.hp = player.maxHp;
      const hp1 = player.hp; hurtPlayer(10, player.x + 40, player.y, true); const full = hp1 - player.hp === 10;
      player.hp = player.maxHp;
      check(P + 'with the shield up a blow that lands hits for half and the knight cannot swing; with it down a blow hits full', halved && noSwing && full, { halved, noSwing, full, hp0, hp: player.hp }); }
    // ---- the game teaches the block itself ----
    { const page = window.WIKI ? WIKI.get('skills', 'blocking') : null;
      const taught0 = player.blockTaught;
      player.blockTaught = false; player.equip.shield = 'steel_shield'; recomputeMaxHp(); player.hp = player.maxHp;
      BLOCK.t = 0; notice = null; hurtPlayer(2, player.x + 40, player.y, true);
      const taught = player.blockTaught === true && !!notice && /BLOCK|raise it/.test(notice.text);
      notice = null; hurtPlayer(2, player.x + 40, player.y, true);
      const once = !notice;
      player.blockTaught = taught0; player.hp = player.maxHp;
      check(P + 'the first blow taken while wearing a shield teaches the block, once a game, and the book carries a Blocking page',
        taught && once && !!page && page.lines.length >= 5, { taught, once, page: !!page, lines: page && page.lines.length }); }
    player.equip = eq0; recomputeMaxHp(); player.hp = player.maxHp;

    // ---- the fourth crop ----
    { const o = h.openSpot(74, 30); F.tp(o.x, o.y); const gt = { x: o.x + 1, y: o.y };
      const bag = player.inv.slice(); player.inv = player.inv.map(() => null); // an empty pack: under --play the bot arrives with 20 full slots and the seed never lands
      changeTile(gt.x, gt.y, T.SOIL); crops = crops.filter(c => c.i !== idx(gt.x, gt.y));
      h.give('cloudberry_seed', 2); player.skills.farming.xp = 0; notice = null;
      F.face(gt.x, gt.y); F.press('KeyE'); F.sim(3, []);
      const refused = tileAt(gt.x, gt.y) === T.SOIL && !!notice && /Farming 75/.test(notice.text);
      player.skills.farming.xp = XP_TABLE[75];
      F.face(gt.x, gt.y); F.press('KeyE'); F.sim(3, []);
      const c = crops.find(x => x.i === idx(gt.x, gt.y));
      let gained = 0, ok = false;
      if (c) { c.stage = 3; const x0 = player.skills.farming.xp; F.face(gt.x, gt.y); F.press('KeyE'); F.sim(3, []);
        gained = player.skills.farming.xp - x0; ok = gained >= 2000 && gained <= 4000 && gained % 1000 === 0; } // 2-4 berries at 1000 each
      check(P + 'cloudberries need Farming 75 to plant and pay 1000 Farming xp a berry (a dragonfruit pays 300)', refused && !!c && c.crop === 'cloudberry' && ok,
        { refused, crop: c && c.crop, gained, seedLv: ITEMS.cloudberry_seed.seedLv, farmXp: ITEMS.cloudberry.farmXp, heal: ITEMS.cloudberry.heal });
      player.inv = bag; }

    // ---- the crafting sink, and what compost does ----
    { const rec = RECIPES.find(r => r.out === 'rich_compost');
      const bag = player.inv.slice(); player.inv = player.inv.map(() => null); // an empty pack: craft() refuses when the product has nowhere to land
      player.skills.crafting.xp = XP_TABLE[60];
      h.give('dragon_dung', 3); h.give('herbs', 2); h.give('obsidian', 1);
      const x0 = player.skills.crafting.xp, made = rec ? craft(rec) : false;
      const got = countItem('rich_compost'), xpGot = player.skills.crafting.xp - x0;
      const dungLeft = countItem('dragon_dung');
      // spread one on a crop that is still growing
      const o = h.openSpot(78, 30); F.tp(o.x, o.y); const gt = { x: o.x + 1, y: o.y };
      crops = crops.filter(c => c.i !== idx(gt.x, gt.y)); changeTile(gt.x, gt.y, T.CROP);
      crops.push({ i: idx(gt.x, gt.y), stage: 1, t: 12, crop: 'potato' });
      F.face(gt.x, gt.y); F.press('KeyE'); F.sim(2, []);
      const cc = crops.find(x => x.i === idx(gt.x, gt.y));
      const grew = !!cc && cc.stage === 2 && cc.t < 1 && countItem('rich_compost') === got - 1; // the stage timer restarts (a few update ticks have run since)
      // and a grown crop is still harvested, not composted
      if (cc) cc.stage = 3; const before = countItem('rich_compost');
      F.face(gt.x, gt.y); F.press('KeyE'); F.sim(2, []);
      const harvested = !crops.some(x => x.i === idx(gt.x, gt.y)) && countItem('rich_compost') === before;
      crops = crops.filter(c => c.i !== idx(gt.x, gt.y)); changeTile(gt.x, gt.y, T.GRASS);
      player.inv = bag;
      check(P + 'rich compost: Crafting 60 at a workbench from 3 dragon dung, 2 herbs and obsidian, 2 made for 1400 xp; spread on a growing crop it jumps a stage, a grown crop is still harvested',
        made === true && got === 2 && xpGot === 1400 && dungLeft === 0 && grew && harvested,
        { made, got, xpGot, dungLeft, grew, harvested, lv: rec && rec.lv, station: rec && rec.station }); }
    h.peace(false);

    // ---- and the measurement the whole file exists for ----
    { const p = PLAYTHROUGH.progression();
      const hrs = k => { const r = p.rows.find(r => r.skill === k && r.kind === 'cape'); return r ? r.hours : null; };
      const d = hrs('defence'), f = hrs('farming'), c = hrs('crafting');
      const all = {}; for (const s of SKILL_DEFS) { const v = hrs(s.key); if (v !== null) all[s.key] = v; }
      check(P + 'defence, farming and crafting all master in under 250 hours, and none of the three is under 40',
        d !== null && f !== null && c !== null && d < 250 && f < 250 && c < 250 && d > 40 && f > 40 && c > 40, { defence: d, farming: f, crafting: c, all }); }

    player.skills.farming = s0; player.skills.defence = d0; player.skills.crafting = c0;
    player.equip = eq0; window.__kidmode = kid0; recomputeMaxHp(); player.hp = player.maxHp;
    BLOCK.t = 0; BLOCK.cd = 0; BLOCK.paid = false;
  });
}
