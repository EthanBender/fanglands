// ============================================================================
// THE ATLAS, BUILT — the last world pass, the drift self-tests, and the reload plaque (docs/ONLINE.md, "The shared world", Stage 1)
// src/01-atlas.js defines window.ATLAS and its hand table; this file builds it as the very last HOOKS.world pass, after
// every feature has carved the world and before a save's changes are laid on it, so every game (and the world server's
// atlas.json, written by tools/atlas.mjs from this same build) holds the same table and the same hash.
//
// A page older than the world: when the world's welcome names another Atlas hash than this page's own, a gold plaque in the
// kit's column says "A newer world is ready. Tap to reload." and the whole plaque reloads the page. Until then the knight
// plays exactly as before; the world just does not check his movement.
// ============================================================================
{
  // it only reads the world (95-thistledown's snapshot stays the last pass that writes a tile)
  const pass = () => { ATLAS.build(); };
  HOOKS.world.push(pass);
  ATLAS.pass = pass;

  // ---------- an older page than the world ----------
  const S = { stale: false, told: false, theirs: null };
  const SENTENCE = () => 'A newer world is ready. ' + (typeof touchMode === 'function' && touchMode() ? 'Tap' : 'Click') + ' to reload.';
  const reload = () => { if (typeof window.__atlasReload === 'function') return window.__atlasReload(); try { location.reload(); } catch (e) { } };
  const onWelcome = msg => {
    const theirs = msg && typeof msg.atlas === 'string' ? msg.atlas : null;
    S.theirs = theirs;
    S.stale = !!theirs && ATLAS.built() && theirs !== ATLAS.hash();
    if (S.stale && !S.told) { S.told = true; notify(SENTENCE()); }
  };
  if (window.NET && NET.on) NET.on('welcome', onWelcome);
  HOOKS.hud.push(g => {
    if (!S.stale || paused || panel) return;
    const r = HK.addPlaque(g, { id: 'atlas_new', emblem: 'map', name: 'NEW WORLD', nameColor: HK.T.goldHi, edge: HK.T.gold, sub: SENTENCE() });
    if (!r) return;
    buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label: 'NEW WORLD', action: reload, up: true, name: 'Reload the game', sub: 'A newer world is ready' });
  });

  // ---------- self-tests: the Atlas never drifts from the world it describes ----------
  const P = 'atlas: ';
  HOOKS.selfTest.push((check, F, h) => {
    const A = window.ATLAS, f = A.facts();
    check(P + 'the Atlas is built by the very last world pass, from the world as it was generated', A.built() && HOOKS.world[HOOKS.world.length - 1] === pass && f.worldPasses === HOOKS.world.length && /^[0-9a-f]{16}$/.test(A.hash() || ''), { built: A.built(), last: HOOKS.world[HOOKS.world.length - 1] === pass, passes: HOOKS.world.length, hash: A.hash() });

    // names: every region and instance has its place, every rule matches one, every id is plain
    const I = INSTANCES, ids = I.list(), instNames = new Set(ids.map(id => I.get(id).name));
    const regs = REGIONS.filter(r => !instNames.has(r.name));
    const noRegion = regs.filter(r => { const p = A.get(r.atlas || A.slug(r.name)); return !p || p.name !== r.name || p.sub !== (r.sub || '') || p.kind !== 'region'; }).map(r => r.name);
    const noInst = ids.filter(id => { const p = A.get(id); return !p || p.kind !== 'instance' || p.name !== I.get(id).name || p.map !== id; });
    const badIds = A.places.filter(p => !/^[a-z0-9_]{1,40}$/.test(p.id)).map(p => p.id);
    check(P + 'every REGIONS name and every instance id has a place with its own name, every rule matches a place, every id is plain', !noRegion.length && !noInst.length && !badIds.length && !A.problems().length && A.places.length === regs.length + ids.length + A.RULES.filter(r => r.kind === 'area' || r.kind === 'reserved').length, { noRegion, noInst, badIds, problems: A.problems(), places: A.places.length });

    // tiles: exactly one place each; outside the areas and a region's added rects it is the region regionAt names
    const count = new Array(A.places.length).fill(0); let none = 0, differs = 0; const firstDiff = [];
    const firstMatch = (tx, ty) => regs.find(r => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1);
    const added = A.places.filter(p => p.kind === 'region' && p.rects.length > 1);
    for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
      const p = A.at(tx, ty); if (!p) { none++; continue; }
      count[p.i]++;
      const want = firstMatch(tx, ty), base = p.kind === 'area' ? A.get(p.of) : p;
      if (!want || base.name !== want.name) { if (added.some(q => q === p && q.rects.slice(1).some(r => tx >= r[0] && tx <= r[2] && ty >= r[1] && ty <= r[3]))) continue; differs++; if (firstDiff.length < 3) firstDiff.push([tx, ty, p.id, want && want.name]); }
    }
    const empty = A.places.filter(p => p.kind !== 'reserved' && p.kind !== 'instance' && !count[p.i]).map(p => p.id);
    const areas = A.places.filter(p => p.kind === 'area');
    const overlap = []; for (let a = 0; a < areas.length; a++) for (let b = a + 1; b < areas.length; b++) for (const r of areas[a].rects) for (const q of areas[b].rects) if (r[0] <= q[2] && q[0] <= r[2] && r[1] <= q[3] && q[1] <= r[3]) overlap.push([areas[a].id, areas[b].id]);
    const reservedClear = A.places.filter(p => p.kind === 'reserved').every(p => !count[p.i] && !p.rects.length);
    check(P + 'every overworld tile has exactly one place, which is the region regionAt names (or an area of it, or a rect its rule adds); every place covers ground; no two areas overlap', none === 0 && differs === 0 && !empty.length && !overlap.length && reservedClear, { none, differs, firstDiff, empty, overlap, reservedClear });

    // combat: the boss instances, the camp, the circle, the fields
    const bossInst = ids.filter(id => I.get(id).boss || Object.values(HOOKS.bossCall || {}).some(c => c && c.map === id));
    const spec = ['spider_den', 'war_shed', 'tinker_lab', 'stormfront', 'afterlands', 'royalmine'];
    const notMulti = bossInst.concat(spec).filter(id => !A.get(id) || A.get(id).combat !== 'multi');
    check(P + 'every boss instance is multi (a boss in its define, a boss call on its map, or one the spec names), and Deepholm, Aerie, the Coal Road and the island are single', !notMulti.length && ['deepholm', 'aerie', 'coalmine', 'house'].every(id => A.get(id) && A.get(id).combat === 'single'), { bossInst, notMulti });
    const camp = MONSTER_SPAWNS.filter(s => s.camp), outCamp = camp.filter(s => !A.inside('goblin_camp', { x: tc(s.tx), y: tc(s.ty) })).map(s => [s.type, s.tx, s.ty]);
    check(P + 'the Goblin Camp covers every camp spawn', camp.length >= 10 && !outCamp.length, { camp: camp.length, outCamp });
    const spawnOk = f.spawnOk, bad = Object.keys(spawnOk).filter(id => !spawnOk[id]);
    check(P + 'every place spawn is a walkable tile (every instance entry and Thistledown\'s square)', Object.keys(spawnOk).length >= ids.length && !bad.length, { n: Object.keys(spawnOk).length, bad });
    const kinds = (types, area) => MONSTER_SPAWNS.filter(s => types.includes(s.type) && (area !== 'iron_isle_wreck' || A.inside('ironclad_isle', { x: tc(s.tx), y: tc(s.ty) })));
    const dragons = kinds(['green_dragon', 'red_dragon']), crew = kinds(['brute', 'sapper'], 'iron_isle_wreck'), beast = MONSTER_SPAWNS.filter(s => s.type === 'barrelbeast');
    const inArea = (list, id) => list.length > 0 && list.every(s => A.zoneAt('over', s.tx, s.ty) === id);
    const fang = (HOOKS.bossCall || {}).the_fang, circle = fang && fang.near;
    const TDF = ATLAS.frame('thistledown'), SQ = ATLAS.port('thistledown.square');
    const look = {
      circle: circle ? A.combatAt('over', circle[0], circle[1]) : null, circlePlace: circle ? A.zoneAt('over', circle[0], circle[1]) : null,
      // (the spread spec, §9.1: the fields probe is the old 70,40 in Thistledown's frame, the square its port, the camp's
      // centre the camp frame's 150,30, and the far corner the map's own)
      fields: A.combatAt('over', ...TDF.p(70, 40)), fieldsPlace: A.zoneAt('over', ...TDF.p(70, 40)), square: A.zoneAt('over', ...SQ), squareCombat: A.combatAt('over', ...SQ),
      campCentre: A.combatAt('over', ...ATLAS.frame('camp').p(150, 30)), wilds: A.zoneAt('over', MAP_W - 1, MAP_H - 1), off: A.place('over', -1, 5), offFar: A.place('over', MAP_W, 0),
      den: A.combatAt('spider_den', 5, 5), denOut: A.place('spider_den', I.get('spider_den').w, 0), deep: A.combatAt('deepholm', 3, 3), house: A.zoneAt('house:ben', 3, 3),
    };
    check(P + 'zone lookups: the Fang\'s circle is multi in fang_lair, the fields by Thistledown and Thistledown\'s square are single, the camp is multi; the dragons, the wreck crew and the square\'s beast stand in their areas; off the map is no place',
      look.circle === 'multi' && look.circlePlace === 'fang_lair' && look.fields === 'single' && look.fieldsPlace === 'goblin_fields' && look.square === 'thistledown' && look.squareCombat === 'single' && look.campCentre === 'multi' && look.wilds === 'wilds' && look.off === null && look.offFar === null
      && look.den === 'multi' && look.denOut === null && look.deep === 'single' && look.house === 'house' && inArea(dragons, 'ashfields_dragons') && inArea(crew, 'iron_isle_wreck') && inArea(beast, 'hollowford_square'),
      Object.assign(look, { dragons: dragons.length, crew: crew.length, beast: beast.length }));

    // FIXED_SOLID: only what no honest knight can stand in
    const fixedIds = A.FIXED_TILES.map(n => T[n]);
    const placed = Object.values(ITEMS).filter(it => it && it.place && A.FIXED_TILES.includes(it.place)).map(it => it.id);
    const walkOver = A.FIXED_TILES.filter(n => WALK_OVER.has(T[n]));
    // every tile any feature ever lets a knight cross (WALK_OVER.add(...)) is read from the game's own source when the runner has it
    let srcAdds = null;
    if (typeof window.__gameSource === 'string') { srcAdds = []; const re = /WALK_OVER\.add\(([^)]*)\)/g; let mm; while ((mm = re.exec(window.__gameSource))) srcAdds.push(mm[1].trim()); }
    const srcBad = srcAdds ? srcAdds.filter(a => A.FIXED_TILES.some(n => a === 'T.' + n || a === n)) : [];
    let nFixed = 0, onNpc = 0; for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) if (A.solidAt('over', tx, ty)) nFixed++;
    for (const n of NPCS) if (A.solidAt('over', n.x, n.y)) onNpc++;
    const edges = A.solidAt('over', -1, 0) && A.solidAt('over', MAP_W, 0) && A.solidAt('over', 0, MAP_H) && A.solidAt('spider_den', -1, 0) && !A.solidAt('house', 3, 3);
    const water = (() => { for (let i = 0; i < MAP_W * MAP_H; i++) if (map[i] === T.WATER) return A.solidAt('over', i % MAP_W, (i / MAP_W) | 0); return null; })();
    check(P + 'FIXED_SOLID: every fixed tile kind is solid, none is placed by an item or crossed through WALK_OVER (now, or by any feature\'s source), no NPC stands in one, water is never fixed, the map\'s edge always is',
      fixedIds.every(t => t !== undefined && SOLID.has(t)) && !placed.length && !walkOver.length && !srcBad.length && !onNpc && edges && water === false && nFixed > 1000 && Object.keys(A.export().fixed).length >= ids.length,
      { placed, walkOver, srcAdds: srcAdds && srcAdds.length, srcBad, onNpc, edges, water, nFixed, inst: Object.keys(A.export().fixed) });

    // SPEED_CAP against the movers' own tables (a new mover, or a faster one, must be added there or honest riders read as too fast)
    {
      const C = A.SPEED_CAP, own = { horse: window.MOUNTS && MOUNTS.SPEED, steam: window.RIDING && RIDING.SPEED, dozer: typeof DOZER_BOILER_SPEED !== 'undefined' ? DOZER_BOILER_SPEED : null };
      check(P + 'SPEED_CAP matches the movers\' own tables (the mare, the bulldozer with its boiler, FULL STEAM) and its max is the fastest', C.foot === 175 && C.horse === own.horse && C.steam === own.steam && C.dozer === own.dozer && A.SPEED_MAX === Math.max(...Object.values(C)), { cap: C, own, max: A.SPEED_MAX });
    }
    // the old page: a welcome with another Atlas shows the plaque, its tap reloads; the same Atlas (or none) shows nothing
    {
      const reloads = [], was = window.__atlasReload; window.__atlasReload = () => reloads.push(1);
      const p0 = paused, pn = panel; paused = false; if (panel) closePanel();
      const plaqueTap = () => { render(); return buttons.find(b => b.label === 'NEW WORLD'); };
      const told0 = S.told; S.told = true;   // the notice is said once a session: the test does not use up the real one
      onWelcome({ t: 'welcome', me: NET.me, atlas: A.hash() }); const same = S.stale, sameBtn = plaqueTap();
      onWelcome({ t: 'welcome', me: NET.me }); const noneSaid = S.stale;
      onWelcome({ t: 'welcome', me: NET.me, atlas: '0000000000000000' }); const other = S.stale, btn = plaqueTap();
      if (btn) btn.action();
      S.stale = false; S.theirs = null; S.told = told0; window.__atlasReload = was; paused = p0; render();
      if (pn) openPanel(pn);
      check(P + 'a welcome naming another Atlas shows the NEW WORLD plaque ("A newer world is ready.") and its tap reloads; the same Atlas, or a world with none, shows nothing',
        same === false && !sameBtn && noneSaid === false && other === true && !!btn && btn.w >= 44 && btn.h >= 32 && reloads.length === 1 && /^A newer world is ready\. (Tap|Click) to reload\.$/.test(SENTENCE()),
        { same, sameBtn: !!sameBtn, noneSaid, other, btn: btn && { w: btn.w, h: btn.h }, reloads: reloads.length });
    }
  });
}
