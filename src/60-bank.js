// ============================================================================
// THE BANK — a bank that works the way a real one does. The owner, playing:
//   "the bank should operate much like the RuneScape bank. I should be able to select 1, 10, 100 or All
//    when withdrawing and depositing. And there should be a button to just dump my whole bag into the bank,
//    or my equipment into the bank. And you should be able to see my equipment and my character beside the
//    bank screen when the bank is open, so that you can equip stuff into the character from the bank screen."
//
// This file replaces the bank panel through HOOKS.panel.bank; no core file is edited.
//   · 1 / 10 / 100 / All — one amount, used by BOTH withdrawing and depositing, and it stays picked
//   · TAKE / WEAR — what a tap on a vault slot does. TAKE pulls the amount out; WEAR puts the piece straight
//     on, and whatever it replaces goes back into the vault (never onto the floor)
//   · Deposit bag — the whole pack in one tap. Deposit worn — every piece of gear off you and into the vault
//   · the knight himself beside the vault, drawn wearing what he is wearing, with his five slots under him.
//     A tap on a worn slot banks that piece.
// Nothing is ever silently lost: a withdraw into a full pack takes what fits and says how much stayed behind,
// a deposit into a full vault says how much stayed in the pack.
// Every control is an on-screen button, so all of it works with a finger on the iPad.
// ============================================================================
{
  const QTIES = [1, 10, 100, 'All'];
  const qty = () => { const q = player.bankQty; return QTIES.indexOf(q) >= 0 ? q : 'All'; };
  const setQty = q => { player.bankQty = q; save(); };
  const mode = () => (player.bankMode === 'wear' ? 'wear' : 'take');
  const setMode = m => { player.bankMode = m === 'wear' ? 'wear' : 'take'; save(); };
  const resetState = () => { player.bankQty = 'All'; player.bankMode = 'take'; };
  HOOKS.newGame.push(resetState);

  const wantOf = have => { const q = qty(); return q === 'All' ? have : Math.min(q, have); };
  const eqSlotFor = def => (def && def.weapon) ? 'weapon' : (def && def.armour) ? def.armour.slot : null;
  const inVault = id => { const b = player.bank.find(s => s.id === id); return b ? b.qty : 0; };
  const name = id => (ITEMS[id] ? ITEMS[id].name : id);

  // ---------- moving things ----------
  // Up to `want` of one item out of the pack and into the vault, the tapped slot emptied first.
  // Returns { moved, full } — `full` is true when the vault had no slot left for it.
  function depositItem(id, want, first) {
    let left = want, moved = 0, full = false;
    const order = [];
    if (typeof first === 'number' && first >= 0) order.push(first);
    for (let i = 0; i < player.inv.length; i++) if (i !== first) order.push(i);
    for (const i of order) {
      if (left <= 0) break;
      const s = player.inv[i];
      if (!s || s.id !== id) continue;
      const take = Math.min(s.qty, left);
      if (!bankAdd(id, take)) { full = true; break; }
      s.qty -= take; if (s.qty <= 0) player.inv[i] = null;
      left -= take; moved += take;
    }
    return { moved, full };
  }
  function depositFromPack(slot) {
    const s = player.inv[slot]; if (!s) return;
    const id = s.id, want = wantOf(countItem(id));
    const { moved, full } = depositItem(id, want, slot);
    if (full && !moved) notify('The vault is full. There is no slot for ' + name(id) + '.');
    else if (full) notify('The vault is full. ' + moved + ' ' + name(id) + ' banked, the rest stayed in your pack.');
    else notify('Banked ' + moved + ' ' + name(id) + '.');
    save();
  }
  function withdraw(i) {
    const b = player.bank[i]; if (!b) return;
    const id = b.id, want = wantOf(b.qty), room = roomFor(id);
    if (room <= 0) { notify('Your pack is full. Nothing came out of the vault.'); return; }
    const take = Math.min(want, room);
    addItem(id, take);
    b.qty -= take; if (b.qty <= 0) player.bank.splice(i, 1);
    if (take < want) notify('Your pack had room for ' + take + '. The other ' + (want - take) + ' stayed in the vault.');
    else notify('Took ' + take + ' ' + name(id) + '.');
    save();
  }
  // Put a vault item straight on. Whatever it replaces goes into the vault, never the pack and never the floor.
  function wearFromVault(i) {
    const b = player.bank[i]; if (!b) return;
    const id = b.id, def = ITEMS[id], es = eqSlotFor(def);
    if (!es) { notify(name(id) + ' is not something you can wear.'); return; }
    if (player.mech) { notify('Climb out of the machine first.'); return; }
    const prev = player.equip[es];
    const frees = b.qty === 1; // the vault slot empties, so it can hold what comes off
    if (prev && !player.bank.some(s => s.id === prev) && player.bank.length - (frees ? 1 : 0) >= BANK_SLOTS) {
      notify('The vault is full. There is nowhere to put the ' + name(prev) + ' you are wearing.'); return;
    }
    b.qty -= 1; if (b.qty <= 0) player.bank.splice(i, 1);
    player.equip[es] = id;
    if (prev) bankAdd(prev, 1);
    recomputeMaxHp();
    notify(prev ? name(id) + ' on. The ' + name(prev) + ' went back in the vault.' : name(id) + ' on.');
    save();
  }
  function bankWorn(es) {
    const id = player.equip[es]; if (!id) return;
    if (!bankAdd(id, 1)) { notify('The vault is full.'); return; }
    player.equip[es] = null; recomputeMaxHp();
    notify(name(id) + ' is in the vault.');
    save();
  }
  function depositBag() {
    let moved = 0, stuck = 0;
    for (let i = 0; i < player.inv.length; i++) {
      const s = player.inv[i]; if (!s) continue;
      if (bankAdd(s.id, s.qty)) { moved += s.qty; player.inv[i] = null; } else stuck++;
    }
    if (!moved && !stuck) notify('Your pack is already empty.');
    else if (stuck) notify('The vault is full. ' + moved + ' banked, ' + stuck + ' ' + (stuck === 1 ? 'kind' : 'kinds') + ' of thing stayed in your pack.');
    else notify('Your whole pack is in the vault. ' + moved + ' banked.');
    save();
  }
  function depositWorn() {
    let moved = 0, stuck = 0;
    for (const k of EQUIP_SLOTS) {
      const id = player.equip[k]; if (!id) continue;
      if (bankAdd(id, 1)) { player.equip[k] = null; moved++; } else stuck++;
    }
    if (!moved && !stuck) { notify('You are not wearing anything.'); return; }
    recomputeMaxHp();
    if (stuck) notify('The vault is full. ' + moved + ' banked, ' + stuck + ' still on you.');
    else notify('Everything you were wearing is in the vault. ' + moved + ' ' + (moved === 1 ? 'piece' : 'pieces') + '.');
    save();
  }

  // ---------- layout ----------
  // One place decides every size, so the panel fits a phone, a phone on its side, a tablet and a desktop.
  // A short screen shrinks the slots and shows fewer vault rows (the pager reaches the rest); a narrow screen
  // stands the knight in a band above the vault instead of a column beside it. EQUIP_SLOTS is read live —
  // 38-agility adds a sixth slot (cape), and another feature may add a seventh — so the gear list is measured,
  // never assumed: one slot per row with its name when there is room, two columns of icons when there is not.
  const PORTRAIT_W = 56;   // the knight's box in the narrow band
  function layout() {
    const narrow = VW < 640, compact = VH < 560, avail = VH - 20;
    const cols = narrow ? 5 : 10;
    const packRows = Math.ceil(INV_SLOTS / cols);
    const nEq = EQUIP_SLOTS.length;
    const charW = narrow ? 0 : 156;
    const modeRowH = narrow ? 34 : 0;           // wide: the TAKE/WEAR pair lives in the knight's column
    const portraitH = compact ? 60 : 92;
    const bandH = narrow ? 14 + portraitH : 0;
    let size = compact ? 32 : 40, gap = compact ? 4 : 5, rows = 3;
    const total = () => 66 + bandH + 40 + modeRowH + 16 + rows * (size + gap) + 38 + 16 + packRows * (size + gap) + 40 + 10;
    while (rows > 1 && total() > avail) rows--;
    while (size > 24 && total() > avail) size -= 4;
    const h = total();
    const gridW = cols * (size + gap) - gap;
    // the gear list has to live inside that height (wide) or inside one band (narrow)
    let eqCols = 1, eqSize;
    if (narrow) {
      const budget = Math.max(gridW, Math.min(VW - 56, 340));
      eqCols = nEq;
      eqSize = clamp(Math.floor((budget - PORTRAIT_W - 8) / nEq) - 4, 18, 34);
    } else {
      const room = h - 10 - 66 - (14 + portraitH + 4 + 14 + 38);
      eqSize = Math.floor(room / nEq) - 5;
      if (eqSize < 28) { eqCols = 2; eqSize = Math.floor(room / Math.ceil(nEq / 2)) - 5; }
      eqSize = clamp(eqSize, 18, 38);
    }
    const bodyW = narrow ? Math.max(gridW, PORTRAIT_W + 8 + nEq * (eqSize + 4) - 4) : charW + 14 + gridW;
    return { narrow, compact, size, gap, cols, gridW, packRows, nEq, eqCols, eqSize, portraitH, charW, bandH, bodyW, modeRowH, rows, w: bodyW + 36, h };
  }

  // a small pill button that draws one label and answers to another (so the harness can name it exactly)
  function chip(g, x, y, w, h, text, id, active, action) {
    roundRect(g, x, y, w, h, 7); g.fillStyle = active ? '#238636' : '#21262d'; g.fill();
    g.strokeStyle = active ? '#3fb950' : '#30363d'; g.lineWidth = 1; g.stroke();
    g.fillStyle = active ? '#ffffff' : '#c9d1d9'; g.font = 'bold 12px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x + w / 2, y + h / 2);
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    buttons.push({ x, y, w, h, label: id, action });
  }
  function modePair(g, x, y, w) {
    const bw = Math.floor((w - 8) / 2);
    chip(g, x, y, bw, 28, 'TAKE', 'takeMode', mode() === 'take', () => setMode('take'));
    chip(g, x + bw + 8, y, bw, 28, 'WEAR', 'wearMode', mode() === 'wear', () => setMode('wear'));
  }
  function drawKnight(g, x, y, w, h) {
    roundRect(g, x, y, w, h, 8); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1; g.stroke();
    g.save(); roundRect(g, x, y, w, h, 8); g.clip();
    g.translate(x + w / 2, y + h * 0.64);
    const s = Math.min(w / 34, h / 44);
    g.scale(s, s);
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.beginPath(); g.ellipse(0, 13, 12, 5, 0, 0, 7); g.fill();
    drawHuman(g, { facing: { x: 0, y: 1 }, hurtT: 0, attackT: 0, walkT: 0, moving: false }, playerLook());
    g.restore();
  }
  function gearLine() { return 'str +' + gearBonus('str') + '  acc +' + gearBonus('att') + '  def +' + gearBonus('def'); }
  function wornButton(g, x, y, w, h, k, showName) {
    const id = player.equip[k];
    drawSlot(g, x, y, h, id ? { id, qty: 1 } : null, false);
    if (!id && !showName) { g.fillStyle = '#4b535d'; g.font = '9px sans-serif'; g.textAlign = 'center'; g.fillText(k, x + h / 2, y + h / 2 + 3); g.textAlign = 'left'; }
    if (showName) {
      g.fillStyle = id ? '#c9d1d9' : '#4b535d'; g.font = '11px sans-serif'; g.textAlign = 'left';
      let t = id ? name(id) : k;
      const maxW = w - h - 8;
      while (t.length > 4 && g.measureText(t).width > maxW) t = t.slice(0, -2) + '…';
      g.fillText(t, x + h + 6, y + h / 2 + 4);
    }
    if (id) buttons.push({ x, y, w, h, label: 'worn' + k, action: () => bankWorn(k) });
  }

  HOOKS.panel.bank = g => {
    const L = layout();
    const amount = qty() === 'All' ? 'the whole stack' : String(qty());
    const sub = player.bank.length + ' / ' + BANK_SLOTS + ' vault slots · ' + (mode() === 'wear' ? 'WEAR: a tap puts it on' : 'a tap moves ' + amount);
    const { px, py, w } = panelBox(g, L.w, L.h, 'Bank of Thistledown', sub);
    const gx = px + 18 + (L.narrow ? 0 : L.charW + 14);
    let y = py + 66;

    // ---- the knight and his gear: a column beside the vault, or a band above it on a phone ----
    g.fillStyle = '#8b949e'; g.font = 'bold 10px sans-serif'; g.textAlign = 'left'; g.fillText('YOU', px + 18, y + 10);
    if (L.narrow) {
      g.fillStyle = '#6e7681'; g.font = '10px sans-serif'; g.textAlign = 'right'; g.fillText(gearLine(), px + 18 + L.bodyW, y + 10); g.textAlign = 'left';
      drawKnight(g, px + 18, y + 14, PORTRAIT_W, L.portraitH);
      const ey = y + 14 + Math.round((L.portraitH - L.eqSize) / 2);
      EQUIP_SLOTS.forEach((k, i) => wornButton(g, px + 18 + PORTRAIT_W + 8 + i * (L.eqSize + 4), ey, L.eqSize, L.eqSize, k, false));
      y += L.bandH;
    } else {
      let cy = y + 14;
      drawKnight(g, px + 18, cy, L.charW, L.portraitH);
      cy += L.portraitH + 4;
      g.fillStyle = '#6e7681'; g.font = '10px sans-serif'; g.textAlign = 'left'; g.fillText(gearLine(), px + 18, cy + 9);
      cy += 14;
      modePair(g, px + 18, cy, L.charW);
      cy += 38;
      EQUIP_SLOTS.forEach((k, i) => {
        const c = i % L.eqCols, r = Math.floor(i / L.eqCols);
        wornButton(g, px + 18 + c * (L.eqSize + 8), cy + r * (L.eqSize + 5), L.eqCols === 1 ? L.charW : L.eqSize, L.eqSize, k, L.eqCols === 1);
      });
    }

    // ---- 1 / 10 / 100 / All ----
    g.fillStyle = '#8b949e'; g.font = 'bold 10px sans-serif'; g.textAlign = 'left'; g.fillText('HOW MANY', gx, y + 9);
    const qw = Math.floor((L.gridW - 18) / 4);
    QTIES.forEach((q, i) => chip(g, gx + i * (qw + 6), y + 14, qw, 26, String(q), 'qty' + q, qty() === q, () => setQty(q)));
    y += 40 + L.modeRowH;
    if (L.narrow) modePair(g, gx, y - 34, L.gridW);

    // ---- the vault ----
    const per = L.cols * L.rows, pages = Math.max(1, Math.ceil(BANK_SLOTS / per));
    bankPage = clamp(bankPage, 0, pages - 1);
    g.fillStyle = '#8b949e'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText('VAULT', gx, y + 11);
    y += 16;
    for (let k = 0; k < per; k++) {
      const i = bankPage * per + k; if (i >= BANK_SLOTS) break;
      const cx = gx + (k % L.cols) * (L.size + L.gap), cy = y + Math.floor(k / L.cols) * (L.size + L.gap);
      const b = player.bank[i];
      const wearable = !!b && mode() === 'wear' && !!eqSlotFor(ITEMS[b.id]);
      drawSlot(g, cx, cy, L.size, b, wearable);
      if (b) buttons.push({ x: cx, y: cy, w: L.size, h: L.size, label: 'bank' + i, action: () => (mode() === 'wear' ? wearFromVault(i) : withdraw(i)) });
    }
    y += L.rows * (L.size + L.gap);
    pager(g, gx, y, L.gridW, bankPage, pages, p => { bankPage = clamp(p, 0, pages - 1); });
    y += 38;

    // ---- the pack ----
    g.fillStyle = '#8b949e'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText('YOUR PACK', gx, y + 11);
    y += 16;
    drawInvGrid(g, gx, y, L.cols, L.size, L.gap, depositFromPack);
    y += L.packRows * (L.size + L.gap);

    // ---- the two dump buttons ----
    const bw = Math.floor((L.gridW - 10) / 2);
    button(g, gx, y + 6, bw, 30, 'Deposit bag', depositBag, '#1f6feb');
    button(g, gx + bw + 10, y + 6, bw, 30, 'Deposit worn', depositWorn, '#1f6feb');
  };

  window.BANK = { QTIES, resetState, qty, setQty, mode, setMode, wantOf, layout, depositItem, depositFromPack, withdraw, wearFromVault, bankWorn, depositBag, depositWorn, inVault, eqSlotFor };

  // ---------- self-test ----------
  const P = 'bank: ';
  HOOKS.selfTest.push((check, F, h) => {
    const inv0 = player.inv.map(s => (s ? { ...s } : null));
    const bank0 = player.bank.map(s => ({ ...s }));
    const eq0 = { ...player.equip };
    const q0 = player.bankQty, m0 = player.bankMode, page0 = bankPage, mech0 = player.mech, hp0 = player.hp, mhp0 = player.maxHp;
    const clear = () => { player.inv = new Array(INV_SLOTS).fill(null); player.bank = []; for (const k of EQUIP_SLOTS) player.equip[k] = null; player.mech = null; bankPage = 0; setQty('All'); setMode('take'); };
    const open = () => { closePanel(); openPanel('bank'); render(); };
    const slotOf = id => player.inv.findIndex(s => s && s.id === id);
    const vaultIndexOf = id => player.bank.findIndex(s => s.id === id);
    // one real item for every equipment slot the game has (38-agility adds 'cape'; a later file may add more)
    const gearFor = k => Object.keys(ITEMS).find(id => eqSlotFor(ITEMS[id]) === k);
    const wearAll = () => { for (const k of EQUIP_SLOTS) { const id = gearFor(k); if (id) player.equip[k] = id; } };
    try {
      // 1 / 10 / 100 / All on the way out, including a stack far bigger than the amount and All on a stack of one
      { clear(); player.bank = [{ id: 'stone', qty: 250 }]; open();
        F.clickButton('qty1'); const w1 = F.clickButton('bank0') && countItem('stone') === 1 && player.bank[0].qty === 249;
        F.clickButton('qty10'); const w10 = F.clickButton('bank0') && countItem('stone') === 11 && player.bank[0].qty === 239;
        F.clickButton('qty100'); const w100 = F.clickButton('bank0') && countItem('stone') === 111 && player.bank[0].qty === 139;
        F.clickButton('qtyAll'); const wAll = F.clickButton('bank0') && countItem('stone') === 250 && player.bank.length === 0;
        clear(); player.bank = [{ id: 'bronze_helm', qty: 1 }]; render();
        F.clickButton('qtyAll'); const one = F.clickButton('bank0') && countItem('bronze_helm') === 1 && player.bank.length === 0;
        const sticky = qty() === 'All';
        check(P + 'withdraw takes exactly 1, 10, 100 or All, and All on a stack of one takes the one', w1 && w10 && w100 && wAll && one && sticky, { w1, w10, w100, wAll, one, sticky }); }
      // the same four amounts on the way in
      { clear(); h.give('stone', 60); open();
        F.clickButton('qty1'); const d1 = F.clickButton('slot' + slotOf('stone')) && BANK.inVault('stone') === 1 && countItem('stone') === 59;
        F.clickButton('qty10'); const d10 = F.clickButton('slot' + slotOf('stone')) && BANK.inVault('stone') === 11 && countItem('stone') === 49;
        F.clickButton('qty100'); const d100 = F.clickButton('slot' + slotOf('stone')) && BANK.inVault('stone') === 60 && countItem('stone') === 0;
        clear(); h.give('bronze_helm', 1); render();
        F.clickButton('qtyAll'); const dOne = F.clickButton('slot' + slotOf('bronze_helm')) && BANK.inVault('bronze_helm') === 1 && countItem('bronze_helm') === 0;
        // 100 selected but only 49 left is not an error: it banks the 49 that are there
        check(P + 'deposit banks exactly 1, 10, 100 or All, and an amount bigger than the stack banks the stack', d1 && d10 && d100 && dOne, { d1, d10, d100, dOne }); }
      // coins are an item like any other: the amount applies to them too
      { clear(); h.give('coins', 500); open();
        F.clickButton('qty100'); const inC = F.clickButton('slot' + slotOf('coins')) && BANK.inVault('coins') === 100 && coins() === 400;
        F.clickButton('qtyAll'); const outC = F.clickButton('bank' + vaultIndexOf('coins')) && coins() === 500 && BANK.inVault('coins') === 0;
        check(P + 'coins bank and unbank by the chosen amount', inC && outC, { inC, outC, coins: coins() }); }
      // a full pack: take what fits and say so, and take nothing when nothing fits
      { clear(); player.bank = [{ id: 'stone', qty: 300 }];
        player.inv = new Array(INV_SLOTS).fill(null).map(() => ({ id: 'stone', qty: 50 }));
        player.inv[INV_SLOTS - 1].qty = 45; // room for exactly 5 more
        open(); F.clickButton('qty10'); notice = null; const d0 = drops.length;
        const partial = F.clickButton('bank0') && countItem('stone') === 1000 && player.bank[0].qty === 295 && !!notice && /room for 5/.test(notice.text);
        notice = null; const none = F.clickButton('bank0') && countItem('stone') === 1000 && player.bank[0].qty === 295 && !!notice && /pack is full/.test(notice.text);
        const nothingOnFloor = drops.length === d0;
        check(P + 'a withdraw into a full pack takes what fits, says how much stayed and never drops the rest on the floor', partial && none && nothingOnFloor, { partial, none, nothingOnFloor, notice: notice && notice.text }); }
      // Deposit bag
      { clear(); h.give('stone', 20); h.give('wood', 5); h.give('coins', 30); open();
        const c = F.clickButton('Deposit bag');
        const emptied = player.inv.every(s => !s);
        const banked = BANK.inVault('stone') === 20 && BANK.inVault('wood') === 5 && BANK.inVault('coins') === 30;
        check(P + 'Deposit bag empties the whole pack into the vault in one tap', c && emptied && banked, { c, emptied, banked, bank: player.bank.length }); }
      // Deposit worn — every slot the game has, cape included
      { clear(); wearAll(); const wore = EQUIP_SLOTS.filter(k => player.equip[k]).length; open();
        const c = F.clickButton('Deposit worn');
        const stripped = EQUIP_SLOTS.every(k => player.equip[k] === null);
        const banked = EQUIP_SLOTS.every(k => !gearFor(k) || BANK.inVault(gearFor(k)) === 1);
        const packUntouched = player.inv.every(s => !s);
        check(P + 'Deposit worn strips every equipped slot into the vault', c && wore === EQUIP_SLOTS.length && stripped && banked && packUntouched, { c, wore, slots: EQUIP_SLOTS.length, stripped, banked, packUntouched }); }
      // WEAR: equip straight out of the vault, the displaced piece goes back into the vault, junk is refused
      { clear(); player.equip.weapon = 'wooden_sword'; player.equip.helm = 'bronze_helm';
        player.bank = [{ id: 'iron_dagger', qty: 1 }, { id: 'plank', qty: 5 }, { id: 'iron_helm', qty: 1 }];
        open(); F.clickButton('wearMode'); const d0 = drops.length;
        const c1 = F.clickButton('bank' + vaultIndexOf('iron_dagger'));
        const worn = player.equip.weapon === 'iron_dagger';
        const displaced = BANK.inVault('wooden_sword') === 1 && countItem('wooden_sword') === 0 && drops.length === d0;
        const notInPack = countItem('iron_dagger') === 0;
        render(); const c2 = F.clickButton('bank' + vaultIndexOf('iron_helm'));
        const swapped = player.equip.helm === 'iron_helm' && BANK.inVault('bronze_helm') === 1;
        render(); notice = null; const c3 = F.clickButton('bank' + vaultIndexOf('plank'));
        const refused = BANK.inVault('plank') === 5 && countItem('plank') === 0 && !!notice && /not something you can wear/.test(notice.text);
        check(P + 'WEAR puts a vault item straight on, the piece it replaces goes back into the vault, and a plank is refused', c1 && worn && displaced && notInPack && c2 && swapped && c3 && refused, { c1, worn, displaced, notInPack, swapped, refused }); }
      // All and TAKE are what a save with no bank settings reads as, a new game puts them back, and a tap in
      // TAKE withdraws a wearable item instead of putting it on
      { clear(); player.bankQty = undefined; player.bankMode = undefined; player.bank = [{ id: 'iron_dagger', qty: 1 }]; open();
        const dflt = mode() === 'take' && qty() === 'All';
        const took = F.clickButton('bank0') && countItem('iron_dagger') === 1 && player.equip.weapon === null && player.bank.length === 0;
        setQty(10); setMode('wear'); const registered = HOOKS.newGame.indexOf(resetState) >= 0; resetState();
        const reset = qty() === 'All' && mode() === 'take';
        check(P + 'a save with no bank settings reads as All and TAKE, a new game resets them, and a TAKE tap withdraws a wearable item', dflt && took && registered && reset, { dflt, took, registered, reset }); }
      // a tap on a worn slot banks that piece
      { clear(); player.equip.helm = 'bronze_helm'; player.equip.shield = 'bronze_shield'; open();
        const c = F.clickButton('wornhelm');
        const off = player.equip.helm === null && BANK.inVault('bronze_helm') === 1;
        const others = player.equip.shield === 'bronze_shield';
        const notInPack = countItem('bronze_helm') === 0;
        check(P + 'tapping a worn slot beside the knight banks that piece and leaves the rest on', c && off && others && notInPack, { c, off, others, notInPack }); }
      // layout: nothing overlaps and nothing runs off the screen, at four real screen sizes
      { const own = k => Object.getOwnPropertyDescriptor(window, k);
        const saved = { w: own('innerWidth'), h: own('innerHeight') };
        const problems = []; let tried = 0;
        const setSize = (w, hh) => { try { window.innerWidth = w; window.innerHeight = hh; } catch (e) { } render(); return VW === w && VH === hh; };
        const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        const inside = r => r.x >= 0 && r.y >= 0 && r.x + r.w <= VW && r.y + r.h <= VH;
        clear(); wearAll();
        for (let i = 0; i < 44; i++) player.bank.push({ id: i % 2 ? 'stone' : 'wood', qty: 1 + i });
        h.give('stone', 120); h.give('wood', 60); h.give('coins', 40);
        for (const [w, hh] of [[390, 844], [844, 390], [768, 1024], [1280, 800]]) {
          if (!setSize(w, hh)) continue;
          tried++;
          for (const md of ['take', 'wear']) {
            setMode(md); bankPage = 0; closePanel(); openPanel('bank'); render();
            const where = w + 'x' + hh + ' ' + md;
            const pr = panelRect && { ...panelRect, label: 'panel' };
            if (!pr || !inside(pr)) { problems.push(where + ': panel box ' + JSON.stringify(pr)); continue; }
            const ci = buttons.findIndex(b => b.label === '×' && hit(b, pr));
            if (ci < 0) { problems.push(where + ': no close button'); continue; }
            const own2 = buttons.slice(ci).filter(b => !b.offscreen && b.w > 0 && b.h > 0);
            for (const r of own2) if (!inside(r)) problems.push(where + ': ' + r.label + ' off-screen ' + JSON.stringify([r.x, r.y, r.w, r.h]));
            for (let i = 0; i < own2.length; i++) for (let j = i + 1; j < own2.length; j++) if (hit(own2[i], own2[j])) problems.push(where + ': ' + own2[i].label + ' × ' + own2[j].label);
            const has = lbl => own2.some(b => b.label === lbl);
            for (const need of ['qty1', 'qty10', 'qty100', 'qtyAll', 'takeMode', 'wearMode', 'Deposit bag', 'Deposit worn', 'bank0', 'slot0', 'Next'].concat(EQUIP_SLOTS.map(k => 'worn' + k)))
              if (!has(need)) problems.push(where + ': missing ' + need);
          }
        }
        closePanel();
        if (saved.w) { Object.defineProperty(window, 'innerWidth', saved.w); Object.defineProperty(window, 'innerHeight', saved.h); } else { try { delete window.innerWidth; delete window.innerHeight; } catch (e) { } }
        render();
        check(P + 'the panel keeps every control on screen and nothing overlapping at 390x844, 844x390, 768x1024 and 1280x800, in both TAKE and WEAR', tried === 4 && problems.length === 0, { tried, problems: problems.slice(0, 8) }); }
    } finally {
      closePanel();
      player.inv = inv0; player.bank = bank0; player.equip = eq0; player.mech = mech0;
      player.bankQty = q0; player.bankMode = m0; bankPage = page0;
      recomputeMaxHp(); player.maxHp = mhp0; player.hp = hp0; notice = null; render();
    }
  });
}
