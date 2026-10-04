// ============================================================================
// SMALL FIXES, CHECKED — six bugs found while looking at the island, each fixed where it lives and proved here
//   1. the obsidian blade had no str and no cd: playerMaxHit() was NaN and it hit for 0 (45-progression)
//   2. the obsidian helm said slot 'head', which is not in EQUIP_SLOTS: it gave no defence (45-progression; a helm
//      already worn in 'head' moves to 'helm')
//   3. the wind shrine's map marker pointed at (58,3); the shrine stands at (62,6) (37-dragonkillers)
//   4. the dead Godly anvil rows showed the anvil's old costs; the four rows are now Halcyon's own table (27, 36)
//   5. the anvil's tabs knew only bronze, iron, steel, mithril and godly: blackiron, sunstone, stormstone and obsidian
//      all fell into Other (13-ux, 10-hud)
//   6. the playthrough audit timed blackiron, sunstone and stormstone at the 10 s default (42-playthrough)
// Feature file: checks only (each fix sits in the file that owns the data).
// ============================================================================
{
  const P = 'fixes: ';
  HOOKS.selfTest.push((check, F, h) => {
    // --- 1. every weapon has numbers for str, att and cd; the obsidian blade hits harder than the stormstone sword ---
    { const broken = Object.keys(ITEMS).filter(id => { const w = ITEMS[id].weapon; return w && !(Number.isFinite(w.str) && Number.isFinite(w.att) && Number.isFinite(w.cd) && w.cd > 0); });
      const wep0 = player.equip.weapon;
      const hitWith = id => { player.equip.weapon = id; return playerMaxHit(); };
      const ob = hitWith('obsidian_blade'), st = hitWith('stormstone_sword');
      player.equip.weapon = wep0;
      check(P + 'every weapon has str, att and cd; with the obsidian blade playerMaxHit() is a real number, above the stormstone sword\'s',
        broken.length === 0 && Number.isFinite(ob) && ob > 0 && ob >= st && ITEMS.obsidian_blade.weapon.str > ITEMS.stormstone_sword.weapon.str,
        { broken, obsidian: ob, stormstone: st, blade: ITEMS.obsidian_blade.weapon }); }

    // --- 2. every armour slot is a real slot; the obsidian helm gives its 26; one worn in 'head' moves to 'helm' ---
    { const lost = Object.keys(ITEMS).filter(id => ITEMS[id].armour && !EQUIP_SLOTS.includes(ITEMS[id].armour.slot));
      const eq0 = { ...player.equip }, bag0 = player.inv.map(s => (s ? { ...s } : null));
      for (const k of Object.keys(player.equip)) player.equip[k] = null;
      delete player.equip.head;
      player.inv = player.inv.map(() => null); h.give('obsidian_helm', 1);
      equipItem(player.inv.findIndex(s => s && s.id === 'obsidian_helm'));
      const worn = player.equip.helm === 'obsidian_helm' && gearBonus('def') === 26;
      // an old save: the helm sits in equip.head, where nothing reads it, and his helm slot is empty
      player.equip.helm = null; player.equip.head = 'obsidian_helm'; F.sim(1, []);
      const moved = player.equip.helm === 'obsidian_helm' && !('head' in player.equip) && gearBonus('def') === 26;
      // and with a helm already on, it comes back to the pack instead
      player.equip.helm = 'iron_helm'; player.equip.head = 'obsidian_helm'; F.sim(1, []);
      const packed = player.equip.helm === 'iron_helm' && !('head' in player.equip) && countItem('obsidian_helm') === 1;
      for (const k of Object.keys(player.equip)) delete player.equip[k];
      Object.assign(player.equip, eq0); player.inv = bag0;
      check(P + 'every armour piece names a slot the knight has; the obsidian helm goes on his head for 26 defence, and one an old save left in "head" moves to the helm slot (or back to the pack)',
        lost.length === 0 && worn && moved && packed, { lost, worn, moved, packed }); }

    // --- 3. the wind shrine's map marker is on the wind shrine ---
    { const had = Object.prototype.hasOwnProperty.call(quest, 'sky'), sky0 = quest.sky;
      const S = window.SKYCITY && SKYCITY.SHRINE_T;
      const at = {};
      for (const stage of [1, 2]) { quest.sky = Object.assign({}, sky0 || {}, { stage }); const t = MAP_TARGETS[14]; at[stage] = t && [t.x, t.y, t.label]; }
      if (had) quest.sky = sky0; else delete quest.sky;
      const on = !!S && [1, 2].every(st => at[st] && at[st][0] === S.x && at[st][1] === S.y) && tileAt(S.x, S.y) === SKYCITY.WIND_SHRINE;
      check(P + 'the Song of Above\'s map marker (stages 1 and 2) stands on the wind shrine itself, at (62,6) on the Grey Quarry heights',
        on && S.x === 62 && S.y === 6, { at, shrine: S && [S.x, S.y], tile: S && tileName(tileAt(S.x, S.y)) }); }

    // --- 4. the four Godly rows are Halcyon's table: his costs, his level, his xp, and none on the anvil ---
    { const rows = RECIPES.filter(r => /^godly_/.test(r.out)), F2 = window.SKYCITY ? SKYCITY.FORGE : [];
      const wrong = [];
      for (const f of F2) {
        const r = rows.find(q => q.out === f.out);
        const want = JSON.stringify([['dragon_scale', f.scales], ['mithril_bar', f.mithril], ['obsidian', 1]]);
        if (!r) wrong.push(`${f.out} missing`);
        else if (r.station !== 'skyforge' || JSON.stringify(r.needs) !== want || r.lv !== 30 || r.xp !== 500 || r.label !== f.label) wrong.push(`${f.out} ${r.station} ${JSON.stringify(r.needs)} lv ${r.lv} xp ${r.xp}`);
      }
      check(P + 'the four Godly rows in RECIPES say what Halcyon asks (8 / 12 / 10 / 8 scales, 2 / 4 / 3 / 2 mithril, an obsidian, Smithing 30, 500 xp), and none is on the anvil',
        F2.length === 4 && rows.length === 4 && wrong.length === 0 && !rows.some(r => r.station === 'anvil'), { wrong, rows: rows.map(r => `${r.out} ${r.station} lv ${r.lv}`) }); }

    // --- 5. the anvil has a tab for each metal, and each tab holds that metal's recipes ---
    { const bag0 = player.inv.map(s => (s ? { ...s } : null)), tab0 = recipeTab;
      if (!hasTool('hammer')) h.give('hammer', 1);
      closePanel(); openPanel('station', 'anvil'); render();
      const tiers = CRAFT_VIEW.tiers.slice(), seen = {};
      const want = ['Blackiron', 'Sunstone', 'Stormstone', 'Obsidian'];
      const tierOfLabel = l => { const r = RECIPES.find(q => q.station === 'anvil' && (l === q.label || l.startsWith(q.label + '  '))); return r ? recipeTier(r) : null; };
      for (const tn of want) {
        const clicked = F.clickButton(tn); render();
        const rows = buttons.filter(b => b.x >= 0 && !b.offscreen && b.label.includes('→')).map(b => b.label.replace(/^disabled:/, ''));
        seen[tn] = { clicked, on: recipeTab === tn, rows: rows.length, per: CRAFT_VIEW.perPage, all: rows.every(l => tierOfLabel(l) === tn), count: RECIPES.filter(r => r.station === 'anvil' && recipeTier(r) === tn).length };
      }
      const other = RECIPES.filter(r => r.station === 'anvil' && recipeTier(r) === 'Other').map(r => r.out);
      closePanel(); recipeTab = tab0; player.inv = bag0;
      const ok = want.every(tn => tiers.includes(tn) && seen[tn].clicked && seen[tn].on && seen[tn].rows === Math.min(seen[tn].per, seen[tn].count) && seen[tn].rows > 0 && seen[tn].all)
        && !other.some(id => /^(blackiron|sunstone|stormstone|obsidian)_/.test(id));
      check(P + 'the anvil has Blackiron, Sunstone, Stormstone and Obsidian tabs; each shows only its own metal, and none of them is left in Other',
        ok, { tiers, seen, other }); }

    // --- 6. the playthrough audit times the three new metals at the code's own rates, never the 10 s default ---
    { const MS = window.PLAYTHROUGH && PLAYTHROUGH.MATERIAL_SECS, O = window.ORES;
      const wrong = [];
      if (MS && O) for (const t of O.TIERS) {
        const ore = O.swingSecs, bar = ore + t.coal * MS.coal + 1.5;
        if (MS[t.ore] !== ore) wrong.push(`${t.ore} ${MS[t.ore]} wanted ${ore}`);
        if (MS[t.bar] !== bar) wrong.push(`${t.bar} ${MS[t.bar]} wanted ${bar}`);
      }
      check(P + 'the playthrough audit times blackiron, sunstone and stormstone bars at 9.5, 13.5 and 17.5 s (a 4 s lump, 1 / 2 / 3 coal at 4 s, a 1.5 s smelt), and each lump at 4 s',
        !!MS && !!O && O.TIERS.length === 3 && wrong.length === 0 && MS.blackiron_bar === 9.5 && MS.sunstone_bar === 13.5 && MS.stormstone_bar === 17.5, { wrong }); }

    // --- 7. a place's name banner (THISTLEDOWN) never draws over an open page: on a phone it sat on the quest page (59-hudkit) ---
    { const w0 = window.innerWidth, h0 = window.innerHeight, t0 = window.__forceTouch, ab0 = areaBanner;
      const names = () => { const log = []; HK.drawBanners(HK.audit.fitCtx(log), HK.layout()); return log.some(e => /THISTLEDOWN/.test(String(e.s))); };
      let over = null, shown = null;
      try {
        window.innerWidth = 390; window.innerHeight = 844; window.__forceTouch = true; resize(); closePanel();
        areaBanner = { name: 'Thistledown', sub: 'The city that still stands', t: 2.5 }; openPanel('quests'); render(); over = names();
        closePanel(); render(); shown = names();
      } finally { closePanel(); areaBanner = ab0; window.innerWidth = w0; window.innerHeight = h0; window.__forceTouch = t0; resize(); render(); }
      check(P + "a place's name banner is not drawn while a page is open (a phone's quest page), and shows again once it is closed", over === false && shown === true, { over, shown }); }
  });
}
