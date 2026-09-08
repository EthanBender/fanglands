// ============================================================================
// THE ASH-ROTTEN HIDE — the dragon scale grind, fixed (audit 2026-09-08, "Sixty ash drakes for five
// dragon scales"). The bot's own playthrough killed 60 ash drakes to collect the five scales Queen
// Seraphel asks for in the Song of Above: the scale sits on a 3-in-13 table roll, and bad luck on a
// table roll has no floor. A ten-year-old gives up long before sixty.
//
// The design — one rule, said out loud: an ash drake is ash-caked and its plates are cracked, so a
// knight who keeps cutting always levers one loose in the end. A running tally counts the drakes that
// gave nothing; the third one gives a scale up whatever the dice said, and the tally resets.
//   • The drake's own drop table is untouched — dragon scale 3, coal 4, nothing 6 out of 13 — so scales
//     are not made common. A green dragon still drops 1 to 3 every single kill and is still the way to
//     farm the 34 scales the Godly Plated set wants.
//   • The rare dragon items in 37-dragonkillers (spear, helm, shield, platebody) keep their exact odds.
//     This file adds dragon_scale and nothing else, and never reads or writes DRAGON_KILLERS.chance.
// What it buys, measured in the self-test below: five scales cost 15 drakes at the very worst and 11.79
// on average over 400 seeded hunts, where the old table alone averaged 21.67 with no ceiling at all.
// The tally is shown over every kill — "Cracked plate (1 of 3)" — so the rule is readable rather than
// hidden maths, Dunstan says it out loud when he hands over the salve (27-dragons.js), the Song of
// Above quest text repeats it (36-skycity.js), and the wiki's ash drake page states it.
// Feature file: HOOKS only, one core function wrapped by reassignment, no core file edited.
// ============================================================================
{
  const SC_PITY = 3;                                  // drakes that gave nothing before one is guaranteed
  const SC_WANT = 5;                                  // the scales Queen Seraphel asks for
  const scFresh = () => ({ dry: 0, prised: 0, kills: 0 });
  const SC = () => { let q = quest.scales; if (!q || typeof q !== 'object') q = quest.scales = scFresh(); return q; };
  HOOKS.newGame.push(() => { quest.scales = scFresh(); });

  // ---------- the tally ----------
  // rollDrops is the one place a monster's loot is decided, so the guarantee sits exactly where the
  // table roll it backs up sits: the scale lands with the rest of the kill's loot, on the ground, in the
  // same frame. Only ash drakes are counted — green and red dragons already drop 1 to 4 scales every
  // kill, so a tally on them would mean nothing.
  const _scRollDrops = rollDrops;
  rollDrops = function (def, x, y) {
    const n0 = drops.length;
    _scRollDrops(def, x, y);
    if (def !== MONSTER_DEFS.ash_drake) return;
    const q = SC(); q.kills++;
    for (let i = n0; i < drops.length; i++) if (drops[i].id === 'dragon_scale') { q.dry = 0; return; }   // the table paid: start again
    if (++q.dry < SC_PITY) { floatText(x, y - 30, `Cracked plate (${q.dry} of ${SC_PITY})`, '#b8bdb5', 12); return; }
    q.dry = 0; q.prised++;
    drops.push({ x: x + rint(-14, 14), y: y + rint(-14, 14), id: 'dragon_scale', qty: 1, t: 0, rare: false });
    floatText(x, y - 30, 'Scale prised loose', '#3f8a4a', 14); burst(x, y, '#3f8a4a', 14, 90);
  };

  // ---------- the book says the rule too ----------
  // WIKI.add merges over the page the wiki builds itself, so the drop table, the places and the respawn
  // line all stay as generated; only the blurb line changes (the generated one is kept as its first sentence).
  if (window.WIKI) WIKI.add('monsters', {
    id: 'ash_drake', name: 'Ash drake',
    blurb: `It attacks you on sight. Its hide is ash-cracked: every drake that gives no scale loosens the next, and the third in a row always gives one up. The ${SC_WANT} scales for the Song of Above cost ${SC_PITY * SC_WANT} drakes at the very worst.`,
  });

  window.SCALES = { PITY: SC_PITY, WANT: SC_WANT, state: SC };

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const keep = quest.scales ? { ...SC() } : null;
    const FAR = -999;                                                   // loot rolled off the map, filtered away after
    const clear = () => { drops = drops.filter(d => d.x > -500); };
    const scalesDown = () => drops.reduce((s, d) => s + (d.x < -500 && d.id === 'dragon_scale' ? d.qty : 0), 0);
    // how many drake kills to five scales, with the dice pinned
    const runToFive = rand => {
      const real = Math.random; let kills = 0;
      quest.scales = scFresh(); clear();
      try { Math.random = rand; while (scalesDown() < SC_WANT && kills < 500) { rollDrops(MONSTER_DEFS.ash_drake, FAR, FAR); kills++; } }
      finally { Math.random = real; clear(); }
      return kills;
    };
    // mulberry32: a fixed seed, so the average below is the same number on every run
    const seeded = a => () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const worst = runToFive(() => 0.99);                                // 0.99 of 13 = 12.87: the table never reaches the scale row
    const best = runToFive(() => 0.1);                                  // 0.1 of 13 = 1.3: the table gives a scale every kill
    const TRIALS = 400, rng = seeded(20260908); let total = 0;
    for (let i = 0; i < TRIALS; i++) total += runToFive(rng);
    const mean = total / TRIALS;
    check(`scales: five dragon scales cost ${SC_PITY * SC_WANT} ash drakes at the very worst and ${mean.toFixed(2)} on average over ${TRIALS} seeded hunts (the audit's run needed 60)`,
      worst === SC_PITY * SC_WANT && best === SC_WANT && mean >= 10 && mean <= 15,
      { worst, best, mean: +mean.toFixed(3), trials: TRIALS, band: '10 to 15', tableRow: 'dragon scale 3 of 13' });

    // the tally is visible, it resets on a guaranteed scale and on a lucky one, and only drakes count
    { const real = Math.random, f0 = floaters.length; const said = []; let scale3 = 0;
      quest.scales = scFresh(); clear();
      try {
        Math.random = () => 0.99;
        for (let k = 0; k < SC_PITY; k++) { rollDrops(MONSTER_DEFS.ash_drake, FAR, FAR); said.push(floaters.slice(f0).map(f => f.text).join(' ')); floaters.length = f0; }
        scale3 = scalesDown();
        const afterGuaranteed = SC().dry, prised = SC().prised;
        rollDrops(MONSTER_DEFS.ash_drake, FAR, FAR); const dry1 = SC().dry;                       // dry again
        Math.random = () => 0.1; rollDrops(MONSTER_DEFS.ash_drake, FAR, FAR); const afterLucky = SC().dry;   // the table pays: tally resets
        Math.random = () => 0.99; const kills0 = SC().kills, sc0 = scalesDown(); rollDrops(MONSTER_DEFS.green_dragon, FAR, FAR);
        const greenScales = scalesDown() - sc0;                                                    // 1 to 3 every kill, from its own always row
        check('scales: the tally shows on every kill ("Cracked plate (1 of 3)", "(2 of 3)", then "Scale prised loose"), resets on a lucky table scale too, and counts drakes only',
          said[0] === 'Cracked plate (1 of 3)' && said[1] === 'Cracked plate (2 of 3)' && said[2] === 'Scale prised loose' && scale3 === 1 && afterGuaranteed === 0 && prised === 1
            && dry1 === 1 && afterLucky === 0 && sc0 === 2 && SC().kills === kills0 && greenScales === 3,
          { said, scaleOnThird: scale3, dry1, afterLucky, drakeScales: sc0, greenScales, drakeKillsFromDragon: SC().kills - kills0, prised });
      } finally { Math.random = real; floaters.length = f0; clear(); } }

    // 37-dragonkillers is untouched: its odds, its item list, and the drake's own drop table
    { const real = Math.random; const dropped = new Set();
      quest.scales = scFresh(); clear();
      try { Math.random = () => 0.99; for (let k = 0; k < 300; k++) rollDrops(MONSTER_DEFS.ash_drake, FAR, FAR); for (const d of drops) if (d.x < -500) dropped.add(d.id); }
      finally { Math.random = real; clear(); }
      const DKc = window.DRAGON_KILLERS && DRAGON_KILLERS.chance;
      const table = MONSTER_DEFS.ash_drake.drops.table.map(r => r.join(':')).join(' '), always = MONSTER_DEFS.ash_drake.drops.always.map(r => r.join(':')).join(' ');
      const onlyScale = [...dropped].sort().join(',') === 'coins,dragon_dung,dragon_scale';
      check('scales: the rare dragon items keep their exact odds (green 1/150, red 1/60, ash drake 1/300, Fang 1/3, bosses level/1500 capped at 1/20); the drake table is unchanged (scale 3, coal 4, nothing 6 of 13) and 300 tally kills add dragon scales and nothing else',
        typeof DKc === 'function' && DKc('green_dragon') === 1 / 150 && DKc('red_dragon') === 1 / 60 && DKc('ash_drake') === 1 / 300 && DKc('the_fang') === 1 / 3
          && DKc('barrelbeast') === Math.min(1 / 20, MONSTER_DEFS.barrelbeast.level / 1500) && DKc('walker') === MONSTER_DEFS.walker.level / 1500 && DKc('goblin') === 0 && DKc('ash_drake') < 1 / 20
          && DRAGON_KILLERS.DRAGON_ITEMS.join(',') === 'dragon_spear,dragon_helm,dragon_shield,dragon_body'
          && table === 'dragon_scale:1:1:3 coal:1:2:4 nothing:0:0:6' && always === 'dragon_dung:1:1 coins:30:60' && !MONSTER_DEFS.ash_drake.drops.rare && onlyScale,
        { ashDrake: DKc && DKc('ash_drake'), green: DKc && DKc('green_dragon'), table, always, addedByTally: [...dropped].sort() }); }

    // the book carries the rule, and the drakes are still where they were
    check('scales: the wiki ash drake page states the three-drake rule, and the four drakes still stand round Dunstan\'s farm',
      !!(window.WIKI && WIKI.get('monsters', 'ash_drake') && /third in a row always gives one up/.test(WIKI.get('monsters', 'ash_drake').blurb || '') && WIKI.get('monsters', 'ash_drake').name === 'Ash drake')
        && WIKI.get('monsters', 'ash_drake').drops.some(r => r.id === 'dragon_scale' && Math.abs(r.pct - 3 / 13 * 100) < 0.01)
        && monsters.filter(m => m.type === 'ash_drake').length === 4,
      { blurb: window.WIKI && WIKI.get('monsters', 'ash_drake') && WIKI.get('monsters', 'ash_drake').blurb, drakes: monsters.filter(m => m.type === 'ash_drake').length });

    quest.scales = keep || scFresh();
  });
}
