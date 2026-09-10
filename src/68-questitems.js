// ============================================================================
// LOST PROPERTY — a quest item can always be got back
// Owner, stuck: "Trying to do the quest to get to the sky city, lost the flute or never got it. Tried talking
// to Wren again to get it back — he seems to say something that would indicate I got it back, but it's not
// appearing in my inventory. Quest items should have a persistent state where if the player loses them, they
// can always reclaim them from somewhere."
// He was right, and it was a soft lock: 36-skycity's Wren says "look in your pack, knight" and gives nothing,
// so a dropped or sold flute ended the Song of Above for good. This file is the general rule rather than one
// patch: a quest item declares who it came from and when it is needed, and talking to that person while you
// need it and do not have it hands it back. Anything in the bank is named rather than duplicated.
// Feature file: registers through HOOKS only. window.QUESTITEMS holds the register.
// ============================================================================
{
  const REG = [];
  const inBank = id => (Array.isArray(player.bank) ? player.bank.some(s => s && s.id === id && s.qty > 0) : false);
  const carried = id => countItem(id) > 0;

  // register({ id, from, needed, line, spare }) — `from` is an NPC id, `needed` says the quest still wants it
  const register = def => { if (def && def.id && def.from) REG.push(def); };
  const forNpc = npcId => REG.filter(r => r.from === npcId);
  const missing = r => { try { return r.needed() && !carried(r.id); } catch (e) { return false; } };

  // Runs before the core's dialogue for every role, so it works whoever the giver happens to be.
  const ROLES = new Set();
  function install() {
    for (const r of REG) {
      const npc = NPCS.find(n => n.id === r.from);
      const role = npc ? npc.role : r.role;
      if (!role || ROLES.has(role)) continue;
      ROLES.add(role);
      const prev = HOOKS.talkBefore[role];
      HOOKS.talkBefore[role] = n => {
        for (const rr of forNpc(n.id)) {
          if (!missing(rr)) continue;
          if (inBank(rr.id)) { say(`${ITEMS[rr.id] ? ITEMS[rr.id].name : rr.id} is in your bank, knight. Fetch it from there.`, n.name); return true; }
          if (!canFit(rr.id, 1)) { say(`Your pack is full. Make room and I will hand it over.`, n.name); return true; }
          giveOrDrop(rr.id, 1, player.x, player.y);
          floatText(player.x, player.y - 34, ITEMS[rr.id] ? ITEMS[rr.id].name : rr.id, '#7ee787', 14);
          say(rr.line || `Here. Do not lose it again.`, n.name);
          save();
          return true;
        }
        return prev ? prev(n) : false;
      };
    }
  }

  // ---------- what is registered ----------
  // The wind flute: Old Wren gives it at stage 1 of the Song of Above, and the shrine will not open without it.
  register({
    id: 'wind_flute', from: 'wren', role: 'hermit',
    needed: () => {
      const q = quest.sky;
      return !!q && q.stage >= 1 && !q.sang;                 // wanted from the moment he gives it until the Song is sung
    },
    line: 'Lost it? Grandmother made three. Here is another, and there are no more after this one — so mind it.',
  });

  HOOKS.world.push(() => install());   // NPCS are built by then; runs once per world generation
  install();                            // and once now, for a game already in progress

  window.QUESTITEMS = { register, REG, missing, inBank, forNpc };

  const P = 'questitems: ';
  HOOKS.selfTest.push((check, F, h) => {
    const wren = NPCS.find(n => n.id === 'wren');
    if (!wren) { check(P + 'a lost quest item can be got back from whoever gave it', false, { wren: null }); return; }
    const q0 = quest.sky ? JSON.parse(JSON.stringify(quest.sky)) : null;
    const bag = player.inv.slice();
    // stand in the Song of Above with no flute: the shrine is shut and the quest cannot move
    quest.sky = { ...(quest.sky || {}), stage: 1, sang: false };
    player.inv = player.inv.map(() => null);
    const before = countItem('wind_flute');
    const spoke = HOOKS.talkBefore[wren.role] ? HOOKS.talkBefore[wren.role](wren) : false;
    const back = countItem('wind_flute');
    check(P + 'a flute lost after Old Wren gave it is handed back when you ask him, not just talked about', before === 0 && spoke === true && back === 1, { before, spoke, back });

    // and he does not hand out a second one while you are carrying it
    const second = HOOKS.talkBefore[wren.role] ? HOOKS.talkBefore[wren.role](wren) : false;
    check(P + 'he does not hand out a second one while you already carry it', countItem('wind_flute') === 1, { held: countItem('wind_flute'), spokeAgain: second });

    // if it is sitting in the bank he says so rather than minting another
    player.inv = player.inv.map(() => null);
    const bank0 = Array.isArray(player.bank) ? player.bank.slice() : [];
    if (!Array.isArray(player.bank)) player.bank = [];
    player.bank.push({ id: 'wind_flute', qty: 1 });
    notice = null; dialog.queue.length = 0; dialog.cur = null;
    if (HOOKS.talkBefore[wren.role]) HOOKS.talkBefore[wren.role](wren);
    const said = (dialog.cur && dialog.cur.text) || (dialog.queue[0] && dialog.queue[0].text) || '';
    const namedBank = /bank/i.test(said) && countItem('wind_flute') === 0;
    player.bank = bank0;
    dialog.queue.length = 0; dialog.cur = null;

    player.inv = bag; if (q0) quest.sky = q0; else delete quest.sky;
    check(P + 'a quest item sitting in the bank is named, not duplicated', namedBank, { said: said.slice(0, 80), carried: countItem('wind_flute') });
  });
}
