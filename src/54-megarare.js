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
//     there comes with its banner and a line in LOG. An admin can then trade it (78-trade) or drop it for a friend.
//   * MEGA_RARE.announce(id, how, x, y) is the moment itself (the drop, the gift): the MEGA RARE banner with the
//     item's name, gold and purple sparks where it happened, its own chime, and FLASH (54-megarareart's screen flash
//     reads it, timed on `time`).
//
// THE VOID SCYTHE: a two-handed scythe at the top of the melee table. Strength 48 is the most of any weapon (the
// Dragon spear 45, the Fang 40), accuracy 34 (the spear 44); it swings every 0.7 s like the warhammers, against the
// spear's 0.5, so one on one the spear still hits harder over time, and the scythe's cleave (the battleaxes' wide
// sweep) is what makes it the best in a crowd. Its necro power, 15, is the kit's best (the Bone stave 10).
// window.MEGA_RARE = { RARITY, SOURCES, LOG, FLASH, isMega, dropsOf, announce, given }
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
  // from later": none yet.
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
  const LOG = [];                               // { id, how: 'drop' | 'admin' | ..., n, at } for this session; never saved
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
      drops.push({ x: x + rint(-14, 14), y: y + rint(-14, 14), id: s.id, qty: 1, t: 0, rare: true, mega: true });
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
    check(P + 'the Void Scythe: a two-handed melee weapon with the most strength in the game (48), accuracy 34, a swing every 0.7 s with cleave; one on one the Dragon spear still out-hits it over time; necro power 15 (the kit\'s best), mega rare, 20,000 coins, and nothing drops it yet',
      !!w && w.str === 48 && w.att === 34 && w.cd === 0.7 && w.perk === 'cleave' && !w.ranged && w.str > top && v.necro.power === 15 && v.necro.power > Math.max(...necro)
      && v.rarity === 'mega' && isMega('void_scythe') && !isMega('dragon_spear') && v.value === 20000 && v.stack === 1 && v.id === 'void_scythe'
      && perHit(spear.str, spear.cd) > perHit(w.str, w.cd) && SOURCES.void_scythe.length === 0 && !inTables.length && Object.keys(MONSTER_DEFS).every(k => !dropsOf(k).length),
      { top, str: w && w.str, inTables, spearPerSec: +perHit(spear.str, spear.cd).toFixed(1), scythePerSec: +perHit(w.str, w.cd).toFixed(1) });

    // the one table: a row rolls after the monster's own drops; empty, not one more random number is drawn
    { const rnd = Math.random, d0 = drops.length, b0 = levelBanner, f0 = FLASH.n, l0 = LOG.length;
      let calls = 0;
      try {
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
      } finally { Math.random = rnd; SOURCES.void_scythe.length = 0; drops.length = d0; levelBanner = null; if (b0) levelBanner = b0; LOG.length = l0; }
    }
    // the banner's words: only a mega rare announces, and the rarity's own name and time
    { const b0 = levelBanner; levelBanner = null;
      const no = announce('dragon_spear', 'test', 0, 0) === false && !levelBanner;
      const yes = announce('void_scythe', 'test', player.x, player.y) && levelBanner && levelBanner.t === RARITY.mega.t;
      levelBanner = null; if (b0) levelBanner = b0;
      check(P + 'only an item marked mega rare raises the MEGA RARE banner', no && !!yes, { no, yes: !!yes }); }
  });

  return { RARITY, SOURCES, LOG, FLASH, isMega, dropsOf, announce, given };
})();
window.MEGA_RARE = MEGA_RARE;
