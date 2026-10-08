// ============================================================================
// MEGA RARE — a rarity above the rare drop, and its first item: the Void Scythe
// The owner (7 Oct 2026): "can you add a Sythe to the game to go with the necromancer outfit? we will work out where it
// comes from later i just want it as a mega rare heres a insop pic" (the picture: ~/.fanglands/work/scythe/inspo.png,
// a fan's "Void Scythe": a purple-to-orange crescent, black tendrils, an orange eye in a dark head, a dark shaft wrapped
// in vines with gold runes, a purple orb at the end. Drawn here as our own scythe in the game's style, never traced).
//
// THE RULES (this file; kept in the server's copy). The pictures are 54-megarareart.js (stripped from it), the knight
// holding and swinging it is 82-knightgear's 'scythe' family, the gold-and-purple banner and tag are 59-hudkit's
// (`levelBanner.style 'mega'`, HK.rarityTag), the halo 80-icons' 'mega' tier, the book's tag and rows 44-wiki's.
//   * An item is mega rare when its ITEMS entry says `rarity: 'mega'`. Nothing else is needed for the banner, the halo,
//     the pack's words and the book's tag: a later mega rare is one ITEMS row and one SOURCES row.
//   * WHERE IT COMES FROM is not decided. SOURCES (below) is the one place a drop source is added: a row
//     { monster: '<MONSTER_DEFS type>', chance: N } rolls 1 kill in N of that monster, after its own drops. Empty, it
//     rolls nothing and draws no random number, so nothing changes for anyone. The book reads the same rows.
//   * Until then the owner hands it out: the admin's Give me an item (76-admin) lists every item, and a mega rare given
//     there comes with its banner and a line in LOG. An admin can then trade it (78-trade) or put it on a drop party's
//     prize table (77-dropparty). (The ground is each knight's own: a scythe dropped on the ground is not seen by friends.)
//   * MEGA_RARE.announce(id, how, x, y) is the moment itself (the drop, the gift): the MEGA RARE banner with the
//     item's name, gold and purple sparks where it happened, its own chime, and FLASH (54-megarareart's screen flash
//     reads it, timed on `time`).
//   * The knight who GETS one has the moment on his own screen, however it reaches him: MEGA_RARE.received(id, n, how,
//     from) is called by 78-trade when a trade puts one in his pack ('trade'), by 77-dropparty when a cracker's prize is
//     one ('party'), and by the watch below when he picks one up off the ground that he has not had the moment for yet
//     ('pickup'; not his own kill's roll, not one he put down himself, not a trade's or a prize's overflow). Each writes
//     a line in LOG.
//
// THE VOID SCYTHE: a two-handed scythe at the top of the melee table. Strength 48 is the most of any weapon (the
// Dragon spear 45, the Fang 40), accuracy 34 (the spear 44); it swings every 0.7 s like the warhammers, against the
// spear's 0.5, so one on one the spear still hits harder over time, and the scythe's cleave (the battleaxes' wide
// sweep) is what makes it the best in a crowd. Its necro power, 15, is the kit's best (the Bone stave 10).
// window.MEGA_RARE = { RARITY, SOURCES, LOG, FLASH, isMega, dropsOf, announce, given, received }
// ============================================================================
const MEGA_RARE = (() => {
  // the rarities above the rare drop: the banner's words, how long it stays up, the pack's word
  const RARITY = {
    mega: { key: 'mega', name: 'MEGA RARE', word: 'Mega rare', t: 4.5 },
  };

  Object.assign(ITEMS, {
    void_scythe: {
      name: 'Void Scythe', value: 20000, color: '#8f4dff', shape: 'battleaxe', stack: 1, rarity: 'mega',
      weapon: { str: 48, att: 34, cd: 0.7, perk: 'cleave' }, necro: { power: 15 },
    },
  });
  ITEMS.void_scythe.id = 'void_scythe';

  // ---------- WHERE EACH ONE COMES FROM: the one table ----------
  // { monster: '<MONSTER_DEFS type>', chance: N }: 1 kill in N of that monster drops it. "we will work out where it comes
  // from later": the Void Scythe's row is Necromancy's (89-necromancy sets it from its CHOICES.SCYTHE: the Hollow, 1 in 250
  // per paid kill, at the end of the necromancy quests; this file loads first, so it starts empty here).
  const SOURCES = {
    void_scythe: [],
  };

  const isMega = id => !!(id && ITEMS[id] && ITEMS[id].rarity && RARITY[ITEMS[id].rarity]);
  // the rows for one monster type: [{ id, chance }]
  function dropsOf(type) {
    const out = [];
    for (const id in SOURCES) for (const r of SOURCES[id] || []) if (r && r.monster === type && r.chance >= 1 && ITEMS[id]) out.push({ id, chance: r.chance });
    return out;
  }
  const anyRows = () => { for (const id in SOURCES) if (SOURCES[id] && SOURCES[id].length) return true; return false; };

  // ---------- the moment ----------
  const LOG = [];                               // { id, how: 'drop' | 'admin' | 'trade' | 'party' | 'pickup', n, at, from? } for this session; never saved
  const FLASH = { at: -1e9, id: null, x: 0, y: 0, n: 0 };
  function announce(id, how, x, y) {
    if (!isMega(id)) return false;
    const def = ITEMS[id], R = RARITY[def.rarity];
    levelBanner = { text: R.name, sub: def.name, t: R.t, style: def.rarity };
    FLASH.at = time; FLASH.id = id; FLASH.x = x; FLASH.y = y; FLASH.n++;
    burst(x, y, '#a24bff', 36, 200); burst(x, y, '#f5c542', 24, 150); burst(x, y, '#ff8a3d', 10, 110);
    sfx('mega');
    return true;
  }
  function given(id, n, how) {
    if (!isMega(id)) return false;
    LOG.push({ id, how: how || 'given', n: n | 0 || 1, at: time });
    return announce(id, how || 'given', player.x, player.y);
  }
  // one that lands with THIS knight from someone else (a trade, a drop party's prize, the ground): his banner, his line.
  // What the full pack and bank sent to his feet this tick is marked seen, so picking it up is not a second moment.
  function received(id, n, how, from) {
    if (!isMega(id)) return false;
    LOG.push({ id, how: how || 'received', n: n | 0 || 1, at: time, from: from || null });
    if (how !== 'pickup') for (const d of drops) if (d.id === id && d.t === 0 && !d.seen) d.seen = true;
    return announce(id, how || 'received', player.x, player.y);
  }

  // ---------- the ground: a mega rare picked up that he has not had the moment for ----------
  // The core's pickup (07-update) marks a drop `taken` and then replaces `drops` with a filtered list, so this hook (it runs
  // after the core update) reads last tick's list: a mega rare taken from it, not seen, that left him holding more than he
  // held a tick ago, is his moment. One that turns up on the ground in the tick his own pack lost one is his own, put down:
  // seen. HELD is how many of each mega rare he held at the end of the last tick.
  const HELD = {}, CHECKED = new WeakSet();
  let PREV = null;
  HOOKS.update.push(() => {
    if (PREV && PREV !== drops) for (const d of PREV) if (d.taken && !d.seen && isMega(d.id)) {
      d.seen = true;
      if (HELD[d.id] == null || countItem(d.id) > HELD[d.id]) received(d.id, d.qty, 'pickup');
    }
    for (const d of drops) if (!d.seen && !CHECKED.has(d) && isMega(d.id)) {
      CHECKED.add(d);
      if (HELD[d.id] != null && countItem(d.id) < HELD[d.id]) d.seen = true;
    }
    PREV = drops;
    for (const id in SOURCES) HELD[id] = countItem(id);
  });

  // ---------- the roll: after the monster's own drops, each SOURCES row for it, one time in `chance` ----------
  let TYPES = null;
  const typeOf = def => {
    if (!TYPES || !TYPES.has(def)) { TYPES = new Map(); for (const k in MONSTER_DEFS) TYPES.set(MONSTER_DEFS[k], k); }
    return TYPES.get(def);
  };
  const _rollDrops = rollDrops;
  rollDrops = function (def, x, y) {
    const r = _rollDrops(def, x, y);
    if (!anyRows()) return r;               // no source yet: no random number drawn, nothing changes
    const type = typeOf(def);
    if (type) for (const s of dropsOf(type)) {
      if (Math.random() >= 1 / s.chance) continue;
      drops.push({ x: x + rint(-14, 14), y: y + rint(-14, 14), id: s.id, qty: 1, t: 0, rare: true, mega: true, seen: true });
      LOG.push({ id: s.id, how: 'drop', n: 1, at: time, monster: type });
      announce(s.id, 'drop', x, y);
    }
    return r;
  };

  // ---------- self-test ----------
  const P = 'mega rare: ';
  HOOKS.selfTest.push((check, F, h) => {
    const melee = Object.keys(ITEMS).filter(id => ITEMS[id].weapon && !ITEMS[id].weapon.ranged && id !== 'void_scythe');
    const top = Math.max(...melee.map(id => ITEMS[id].weapon.str));
    const v = ITEMS.void_scythe, w = v && v.weapon;
    const necro = Object.keys(ITEMS).filter(id => ITEMS[id].necro && id !== 'void_scythe').map(id => ITEMS[id].necro.power);
    // the drop tables: no monster drops it, and the one table is empty
    const inTables = Object.keys(MONSTER_DEFS).filter(k => { const d = MONSTER_DEFS[k].drops || {}; return [...(d.always || []), ...(d.table || []), ...((d.rare && d.rare.table) || [])].some(r => r[0] === 'void_scythe'); });
    const spear = ITEMS.dragon_spear.weapon, perHit = (str, cd) => (2 + Math.floor(107 * (str + 64) / 300)) / cd;
    const hollowOnly = SOURCES.void_scythe.length === 1 && SOURCES.void_scythe[0].monster === 'the_hollow' && SOURCES.void_scythe[0].chance === 250 && !!MONSTER_DEFS.the_hollow && Object.keys(MONSTER_DEFS).every(k => k === 'the_hollow' ? dropsOf(k).length === 1 : !dropsOf(k).length);
    check(P + 'the Void Scythe: a two-handed melee weapon with the most strength in the game (48), accuracy 34, a swing every 0.7 s with cleave; one on one the Dragon spear still out-hits it over time; necro power 15 (the kit\'s best), mega rare, 20,000 coins; its one source is the Hollow, 1 in 250 (no other monster has a row, and no drop table holds it)',
      !!w && w.str === 48 && w.att === 34 && w.cd === 0.7 && w.perk === 'cleave' && !w.ranged && w.str > top && v.necro.power === 15 && v.necro.power > Math.max(...necro)
      && v.rarity === 'mega' && isMega('void_scythe') && !isMega('dragon_spear') && v.value === 20000 && v.stack === 1 && v.id === 'void_scythe'
      && perHit(spear.str, spear.cd) > perHit(w.str, w.cd) && hollowOnly && !inTables.length,
      { top, str: w && w.str, inTables, sources: SOURCES.void_scythe, spearPerSec: +perHit(spear.str, spear.cd).toFixed(1), scythePerSec: +perHit(w.str, w.cd).toFixed(1) });

    // the one table: a row rolls after the monster's own drops; empty, not one more random number is drawn
    { const rnd = Math.random, d0 = drops.length, b0 = levelBanner, f0 = FLASH.n, l0 = LOG.length, rows0 = SOURCES.void_scythe;
      let calls = 0;
      try {
        SOURCES.void_scythe = [];                                          // the empty table: put back below
        Math.random = () => { calls++; return 0.5; };
        rollDrops(MONSTER_DEFS.goblin, -9999, -9999); const plain = calls;
        calls = 0; _rollDrops(MONSTER_DEFS.goblin, -9999, -9999); const core = calls;
        drops.length = d0;
        SOURCES.void_scythe.push({ monster: 'goblin', chance: 4 });
        calls = 0; Math.random = () => { calls++; return 0.2; };          // under 1 in 4: it drops
        levelBanner = null; rollDrops(MONSTER_DEFS.goblin, -9999, -9999);
        const got = drops.slice(d0).filter(d => d.id === 'void_scythe'), lb = levelBanner;
        const rowsOk = dropsOf('goblin').length === 1 && dropsOf('goblin')[0].chance === 4;
        drops.length = d0; levelBanner = null;
        Math.random = () => 0.3;                                          // over 1 in 4: it does not
        rollDrops(MONSTER_DEFS.goblin, -9999, -9999); const none = !drops.slice(d0).some(d => d.id === 'void_scythe');
        drops.length = d0;
        check(P + 'the one table (SOURCES): empty, a kill draws exactly the random numbers it always did; a row { monster, chance: 4 } drops the scythe on a roll under 1 in 4 (marked mega, with the MEGA RARE banner, the flash and a log line) and not over it',
          plain === core && got.length === 1 && got[0].mega === true && got[0].rare === true && got[0].qty === 1 && !!lb && lb.style === 'mega' && lb.text === 'MEGA RARE' && lb.sub === 'Void Scythe'
          && FLASH.n === f0 + 1 && FLASH.id === 'void_scythe' && LOG.length === l0 + 1 && LOG[l0].how === 'drop' && LOG[l0].monster === 'goblin' && none && rowsOk,
          { plain, core, got: got.length, banner: lb && lb.text, style: lb && lb.style, rowsOk, none });
      } finally { Math.random = rnd; SOURCES.void_scythe = rows0; drops.length = d0; levelBanner = null; if (b0) levelBanner = b0; LOG.length = l0; }
    }
    // the ground: one he had no moment for is his moment when he picks it up; one he put down himself is not, nor his kill's roll
    { const inv0 = player.inv, b0 = levelBanner, l0 = LOG.length;
      const empty = () => new Array(INV_SLOTS).fill(null), at = (dx) => ({ x: player.x + dx, y: player.y, t: 0 });
      try {
        player.inv = empty(); levelBanner = null; F.step([]);
        const d1 = Object.assign({ id: 'void_scythe', qty: 1 }, at(0)); drops.push(d1); F.step([]); F.step([]);
        const lb = levelBanner, line = LOG[l0];
        const picked = countItem('void_scythe') === 1 && !drops.includes(d1) && !!lb && lb.style === 'mega' && lb.sub === 'Void Scythe' && LOG.length === l0 + 1 && !!line && line.how === 'pickup';
        // he puts it down (the pack's Drop: out of the pack, onto the ground a step away), then walks over it again
        levelBanner = null; F.step([]);
        player.inv = empty(); const d2 = Object.assign({ id: 'void_scythe', qty: 1 }, at(200)); drops.push(d2); F.step([]);
        const own = d2.seen === true; d2.x = player.x; d2.y = player.y; F.step([]); F.step([]);
        const back = countItem('void_scythe') === 1 && !drops.includes(d2) && !levelBanner && LOG.length === l0 + 1;
        // his own kill's roll is already seen
        player.inv = empty(); levelBanner = null; F.step([]);
        const d3 = Object.assign({ id: 'void_scythe', qty: 1, mega: true, rare: true, seen: true }, at(0)); drops.push(d3); F.step([]); F.step([]);
        const roll = countItem('void_scythe') === 1 && !levelBanner && LOG.length === l0 + 1;
        check(P + 'off the ground: a Void Scythe he had no moment for raises the MEGA RARE banner and a "pickup" log line as he picks it up; one he put down himself, or his own kill\'s roll, picks up quietly',
          picked && own && back && roll, { picked, own, back, roll, banner: lb && lb.text, how: line && line.how, log: LOG.length - l0 });
      } finally { player.inv = inv0; drops = drops.filter(d => d.id !== 'void_scythe'); LOG.length = l0; levelBanner = b0 || null; }
    }
    // the banner's words: only a mega rare announces, and the rarity's own name and time
    { const b0 = levelBanner; levelBanner = null;
      const no = announce('dragon_spear', 'test', 0, 0) === false && !levelBanner;
      const yes = announce('void_scythe', 'test', player.x, player.y) && levelBanner && levelBanner.t === RARITY.mega.t;
      levelBanner = null; if (b0) levelBanner = b0;
      check(P + 'only an item marked mega rare raises the MEGA RARE banner', no && !!yes, { no, yes: !!yes }); }
  });

  return { RARITY, SOURCES, LOG, FLASH, isMega, dropsOf, announce, given, received };
})();
window.MEGA_RARE = MEGA_RARE;
