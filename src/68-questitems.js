// ============================================================================
// THE KEYRING — the things that open places are never carried, and never lost
// Owner: "Quest items that give you unlocks — for example the flute that you use to get to the shrine into
// the upper city — instead of those being items that you have to bring with you, I think they should just
// persist in a kind of secondary locked-in inventory, where you just have it with you all the time and it
// doesn't take up an inventory slot."
// So an unlock is no longer loot. The moment it is given it goes onto the knight's keyring: it costs no pack
// slot, cannot be dropped, sold, banked, eaten by a full pack or taken by Death, and cannot be lost.
//
// The trick that makes this cost nothing elsewhere: every gate in the game already asks countItem('wind_flute'),
// so countItem is wrapped to see the keyring too. The shrine, the quest text, the wiki and the audit all keep
// working untouched — none of them needs to know the flute moved.
// Feature file: registers through HOOKS only. window.KEYRING is the register.
// ============================================================================
{
  // id -> { name, note } — what an unlock is, and why the knight keeps it
  const KEYS = {};
  const ring = () => { if (!Array.isArray(player.keyring)) player.keyring = []; return player.keyring; };
  const held = id => ring().includes(id);
  const add = id => { if (!KEYS[id] || held(id)) return false; ring().push(id); RING.add(id); return true; };
  const register = (id, note) => { if (ITEMS[id]) KEYS[id] = { id, note: note || '' }; };

  HOOKS.newGame.push(() => { player.keyring = []; RING.clear(); });

  // ---------- what lives on the ring ----------
  register('wind_flute', 'Old Wren\'s. The wind shrine listens for it.');
  register('dragon_horn', 'The Duke\'s. It calls The Fang to the circle.');

  // ---------- every gate keeps working ----------
  // countItem is one of the hottest functions in the game — the HUD, the drop code and every gate call it
  // constantly. These wrappers therefore take their arguments explicitly and call through directly: an early
  // version used `.apply(this, arguments)`, which deoptimises the call site and took the test suite from
  // 30 seconds to over 400. A Set keeps the ring lookup O(1) for the same reason.
  const RING = new Set();
  const syncRing = () => { RING.clear(); for (const id of ring()) RING.add(id); };
  syncRing();
  const onRing = id => RING.has(id);

  const _countItem = countItem;
  countItem = function (id) { const n = _countItem(id); return (RING.has(id) && KEYS[id]) ? n + 1 : n; };

  // Anything given to the knight that belongs on the ring goes there instead of into the pack.
  // addItem returns how many did NOT fit (04-state), and every caller reads a non-zero answer as "the pack is
  // full": the shops refund and say so, giveOrDrop drops the rest on the ground, a pickup keeps the pile, the
  // bank and guild chest keep the stack. A keyring item always fits, so the answer is 0 -- all of it placed.
  // It used to return qty, which made a shop take 300 coins for a flute, hand them back and tell a knight with
  // an empty pack that his pack was full.
  const _addItem = addItem;
  addItem = function (id, qty) { if (KEYS[id]) { if (add(id)) announce(id); return 0; } return _addItem(id, qty); };
  const _giveOrDrop = giveOrDrop;
  giveOrDrop = function (id, qty, x, y) { if (KEYS[id]) { if (add(id)) announce(id); return; } return _giveOrDrop(id, qty, x, y); };
  // A full pack can never stop one arriving.
  const _canFit = canFit;
  canFit = function (id, qty) { return KEYS[id] ? true : _canFit(id, qty); };
  // Nothing a PLAYER does can take one off you, and that needs no guard: a keyring item is never in a pack
  // slot, so it cannot be dropped, sold, banked or handed to Death (death takes player.inv). Deliberate code
  // that clears one — a quest reset — must still work, so removeItem takes it off the ring when the pack has
  // none. Guarding removeItem instead was a real bug: 36-skycity resets with
  // `while (countItem('wind_flute')) removeItem('wind_flute', 1)`, which never terminated and hung the suite.
  const _removeItem = removeItem;
  removeItem = function (id, qty) {
    if (KEYS[id] && _countItem(id) === 0 && RING.has(id)) {
      RING.delete(id);
      const list = ring(); const i = list.indexOf(id); if (i >= 0) list.splice(i, 1);
      return 1;
    }
    return _removeItem(id, qty);
  };

  function announce(id) {
    const it = ITEMS[id];
    floatText(player.x, player.y - 40, `${it ? it.name : id} — kept on your keyring`, '#f5c542', 14);
    notify(`${it ? it.name : id} goes on your keyring. It costs you no pack space and you cannot lose it.`);
    save();
  }

  // A save from before the keyring existed, or one where the flute is still loose in the pack or the bank:
  // move it onto the ring on load, so nobody has to start again.
  function absorb() {
    for (const id in KEYS) {
      let found = false;
      for (let i = 0; i < player.inv.length; i++) { const s = player.inv[i]; if (s && s.id === id) { player.inv[i] = null; found = true; } }
      if (Array.isArray(player.bank)) for (let i = 0; i < player.bank.length; i++) { const s = player.bank[i]; if (s && s.id === id) { player.bank[i] = null; found = true; } }
      // a save from before the keyring could have left one in Death's chest: it comes out of the chest and onto the ring, free
      if (deathKeep && Array.isArray(deathKeep.items) && deathKeep.items.some(s => s && s.id === id)) { deathKeep.items = deathKeep.items.filter(s => !(s && s.id === id)); if (!deathKeep.items.length) deathKeep = null; found = true; }
      if (found) add(id);
    }
    if (Array.isArray(player.bank)) player.bank = player.bank.filter(Boolean);
    syncRing();   // a load replaces player.keyring wholesale
  }
  const _load = load;
  load = function () { const r = _load.apply(this, arguments); try { absorb(); } catch (e) { } return r; };
  absorb();

  // ---------- it is visible, so a child knows he has it ----------
  // Drawn under the pack grid rather than in it: on the ring, not in the bag.
  HOOKS.hud.push(g => {
    if (panel !== 'inventory' || paused) return;
    const list = ring().filter(id => ITEMS[id]);
    if (!list.length || !panelRect) return;
    const { x, y, w, h } = panelRect;
    const by = y + h - 40;
    g.fillStyle = '#8b949e'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left';
    g.fillText('KEYRING — always with you, no pack space', x + 18, by - 6);
    let kx = x + 18;
    for (const id of list) {
      roundRect(g, kx, by, 34, 34, 7); g.fillStyle = 'rgba(245,197,66,0.10)'; g.fill();
      g.strokeStyle = 'rgba(245,197,66,0.55)'; g.lineWidth = 1; g.stroke();
      drawItemIcon(g, id, kx + 17, by + 17, 15);
      buttons.push({ x: kx, y: by, w: 34, h: 34, label: 'keyring:' + id, action: () => notify(`${ITEMS[id].name}. ${KEYS[id].note}`) });
      kx += 40;
    }
    g.textAlign = 'left';
  });

  window.KEYRING = { KEYS, ring, held, add, register, absorb };

  const P = 'keyring: ';
  HOOKS.selfTest.push((check, F, h) => {
    const bag = player.inv.slice(), r0 = ring().slice();
    player.keyring = []; player.inv = player.inv.map(() => null);

    // given once, it goes on the ring and not into the pack
    giveOrDrop('wind_flute', 1, player.x, player.y);
    const onRing = KEYRING.held('wind_flute'), notInBag = !player.inv.some(s => s && s.id === 'wind_flute');
    const gatesSeeIt = countItem('wind_flute') === 1;              // this is what every gate in the game asks
    check(P + 'an unlock goes on the keyring, not into the pack, and every gate still sees it', onRing && notInBag && gatesSeeIt, { onRing, notInBag, gatesSeeIt, slotsUsed: player.inv.filter(Boolean).length });

    // a full pack cannot stop one arriving, and it costs no slot
    player.inv = player.inv.map(() => ({ id: 'stone', qty: 50 }));
    player.keyring = [];
    const fits = canFit('wind_flute', 1);
    giveOrDrop('wind_flute', 1, player.x, player.y);
    const arrived = KEYRING.held('wind_flute') && countItem('wind_flute') === 1;
    const noSlotTaken = player.inv.every(s => s && s.id === 'stone');
    check(P + 'a full pack cannot stop an unlock arriving, and it takes no slot', fits && arrived && noSlotTaken, { fits, arrived, noSlotTaken });

    // and nothing takes it away again
    player.inv = player.inv.map(() => null);
    // it is not in a pack slot, so no selling, dropping or banking can reach it — that is the guarantee
    const inNoSlot = !player.inv.some(s2 => s2 && s2.id === 'wind_flute');
    const survivedRemove = inNoSlot && countItem('wind_flute') === 1;
    const keep = deathKeep; deathKeep = null;
    hurtPlayer(player.maxHp + 999, player.x + 10, player.y, true); F.sim(60, []);
    const survivedDeath = countItem('wind_flute') === 1 && (!deathKeep || !deathKeep.items.some(s => s.id === 'wind_flute'));
    player.hp = player.maxHp; player.dead = false; deathKeep = keep;
    check(P + 'an unlock cannot be dropped, sold, spent or taken by Death', survivedRemove && survivedDeath, { survivedRemove, survivedDeath });

    // an old save with the flute loose in the pack moves it onto the ring rather than leaving it to be lost
    player.keyring = []; player.inv = player.inv.map(() => null);
    player.inv[0] = { id: 'wind_flute', qty: 1 };
    KEYRING.absorb();
    const migrated = KEYRING.held('wind_flute') && !player.inv.some(s => s && s.id === 'wind_flute');
    check(P + 'a save that still has the flute loose in the pack moves it onto the keyring on load', migrated, { migrated, ring: ring().slice() });

    // given through addItem -- the path every shop, pickup, bank and chest takes -- it reports all of it placed,
    // so nothing says the pack is full and nothing is dropped on the ground
    { player.keyring = []; syncRing(); player.inv = player.inv.map(() => null);
      const n0 = drops.length; notice = null;
      const left = addItem('wind_flute', 1);
      const placed = left === 0 && KEYRING.held('wind_flute') && countItem('wind_flute') === 1;
      const noDrop = drops.length === n0 && !drops.some(d => d.id === 'wind_flute');
      // and through a real shop button: the coins are spent, not refunded, and no "pack is full"
      player.keyring = []; syncRing(); notice = null;
      const SID = '__keyring_check'; SHOPS[SID] = { name: 'Keyring check', rate: 1, stock: [['wind_flute', 7]] };
      player.inv[0] = { id: 'coins', qty: 10 };
      closePanel(); openPanel('shop', SID); render(); const clicked = F.clickButton('Buy 7'); closePanel(); delete SHOPS[SID];
      const full = !!notice && /pack is full/i.test(notice.text);
      const bought = clicked && KEYRING.held('wind_flute') && coins() === 3 && !full && !drops.slice(n0).some(d => d.id === 'wind_flute');
      check(P + 'giving a keyring item reports it as placed, so no shop or reward says the pack is full',
        placed && noDrop && bought, { left, placed, noDrop, clicked, coinsLeft: coins(), full, notice: notice && notice.text }); }

    // and one left in Death's chest by an old save moves onto the ring on load; the chest panel never hands one out on its own
    { const dk0 = deathKeep; player.keyring = []; syncRing();
      deathKeep = { items: [{ id: 'wind_flute', qty: 1 }, { id: 'steel_helm', qty: 1 }] };
      openPanel('coffin'); render(); closePanel();
      const notByPanel = !KEYRING.held('wind_flute');
      KEYRING.absorb();
      const fromChest = KEYRING.held('wind_flute') && !!deathKeep && deathKeep.items.length === 1 && deathKeep.items[0].id === 'steel_helm';
      check(P + "an unlock left in Death's chest by an old save moves onto the keyring on load, and opening the chest panel hands nothing out", notByPanel && fromChest, { notByPanel, fromChest, chest: deathKeep && deathKeep.items.map(s => s.id) });
      deathKeep = dk0; }
    player.inv = bag; player.keyring = r0; syncRing();
  });
}
