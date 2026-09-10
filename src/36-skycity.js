// ============================================================================
// SONG OF ABOVE — Aerie, the hidden city of the winged folk above the clouds (Cohen's design A).
// An INSTANCE reached from a wind shrine on the Grey Quarry heights (E on it with the wind flute — and,
// since 66-storm, only once the storm between the shrine and the city has been broken: the flute alone
// now lifts the knight into THE STORM, and the way up is the updraft the Thunderbird's death opens).
// Queen Seraphel wants 5 dragon scales + 3 cloud essence, sings the Song, and Master Halcyon then
// forges the Godly Plated set from dragon scale + mithril + obsidian (no anvil). The four Godly
// recipes leave Brakka's anvil list at load. Feature file: HOOKS only, edits no core file.
// ============================================================================
{
  // ---------- tiles (ids captured locally) ----------
  const CLOUD = addTile('CLOUD', { tex: 'sand', mini: '#eef3fa' });                          // the cloud floor: walkable
  const SKY = addTile('SKY', { solid: true, tex: 'water', mini: '#8fd0ff' });                // open air around the cloud
  const WISP = addTile('CLOUD_WISP', { solid: true, tex: 'sand', mini: '#dff0ff' });         // pickup: cloud essence, regrows
  const LEAP = addTile('CLOUD_LEAP', { solid: true, tex: 'sand', mini: '#9ac2ff' });         // the way down
  const WIND_SHRINE = addTile('WIND_SHRINE', { solid: true, tex: 'cave', mini: '#bfe3ff' }); // the way up (Grey Quarry)

  // ---------- geometry ----------
  const AER = { id: 'aerie', name: 'Aerie', sub: 'The city above the clouds', w: 50, h: 34 };
  const SHRINE_T = { x: 62, y: 6 }, STEP_T = { x: 62, y: 7 }; // east of the Agility cliff course (x 46–62), which carves the quarry's north edge
  const ENTRY = [25, 30], LEAP_T = [25, 31];
  const HALL = { x0: 17, y0: 3, x1: 33, y1: 12 };            // the great hall (marble floor, castle-wall fragments)
  const FORGE_P = { x0: 35, y0: 15, x1: 41, y1: 21 };         // Halcyon's platform
  const SENTINELS = [[12, 10], [38, 10], [12, 24], [38, 24]];
  const WISPS = [[8, 17], [25, 27], [42, 20]];
  const WISP_REGROW = 45;
  const SKY_NPCS = [
    { id: 'seraphel', name: 'Queen Seraphel', x: 25, y: 6, tunic: '#e9eef5', hair: '#f5e6a8', crown: true, woman: true, role: 'sky_queen', wing: 1.35 },
    { id: 'halcyon', name: 'Master Halcyon', x: 38, y: 18, tunic: '#5a6a8a', hair: '#d9d0c0', beard: true, apron: true, role: 'sky_smith', wing: 1.1 },
  ];
  for (const n of SKY_NPCS) { n.px = tc(n.x); n.py = tc(n.y); n.facing = { x: 0, y: 1 }; }
  const active = () => window.INSTANCES && INSTANCES.active() === AER.id;

  // ---------- items ----------
  Object.assign(ITEMS, {
    wind_flute: { name: 'Wind flute', value: 300, color: '#e9eef5', shape: 'rod', stack: 1 },
    cloud_essence: { name: 'Cloud essence', value: 120, color: '#dff0ff', shape: 'powder' },
  });
  ITEMS.wind_flute.id = 'wind_flute'; ITEMS.cloud_essence.id = 'cloud_essence'; ITEMS.cloud_essence.stack = 50;
  // Godly Plated is forged in Aerie now, not at Brakka's anvil: the four recipes (registered by the Ashfields file, which loads
  // earlier) leave the anvil list. They keep their objects, re-stationed to 'skyforge' (no station panel lists that), so
  // `RECIPES.find(r => r.out === 'godly_body')` used by older self-tests still resolves.
  for (const r of RECIPES) if (/^godly_/.test(r.out) && r.station === 'anvil') r.station = 'skyforge';
  // Halcyon's own table: dragon scale + mithril + obsidian, Smithing 30, no anvil, no hammer
  const FORGE = [
    { out: 'godly_helm', scales: 8, mithril: 2, label: '8 Dragon scales + 2 Mithril bars + Obsidian → Godly winged helm' },
    { out: 'godly_body', scales: 12, mithril: 4, label: '12 Dragon scales + 4 Mithril bars + Obsidian → Godly platebody' },
    { out: 'godly_legs', scales: 10, mithril: 3, label: '10 Dragon scales + 3 Mithril bars + Obsidian → Godly platelegs' },
    { out: 'godly_shield', scales: 8, mithril: 2, label: '8 Dragon scales + 2 Mithril bars + Obsidian → Godly shield' },
  ];
  const FORGE_LV = 30, FORGE_XP = 500;
  const forgeNeeds = f => [['dragon_scale', f.scales], ['mithril_bar', f.mithril], ['obsidian', 1]];
  const canForge = f => skillLv('smithing') >= FORGE_LV && forgeNeeds(f).every(([id, q]) => countItem(id) >= q);
  function forge(f) {
    if (!ITEMS[f.out]) { notify('Halcyon frowns: the pattern for that is lost.'); return false; }
    if (skillLv('smithing') < FORGE_LV) { notify(`Needs Smithing ${FORGE_LV}.`); return false; }
    for (const [id, q] of forgeNeeds(f)) if (countItem(id) < q) { notify(`Need ${q} ${ITEMS[id].name}.`); return false; }
    const inv0 = player.inv.map(s => s ? { ...s } : null);
    for (const [id, q] of forgeNeeds(f)) removeItem(id, q);
    if (!canFit(f.out, 1)) { for (let i = 0; i < inv0.length; i++) player.inv[i] = inv0[i]; notify('Your pack is full.'); return false; }
    addItem(f.out, 1); gainXp('smithing', FORGE_XP); sfx('anvil');
    burst(player.x, player.y, '#f5e6a8', 24, 120); floatText(player.x, player.y - 30, `+1 ${ITEMS[f.out].name}`, '#f5e6a8');
    save(); return true;
  }

  // ---------- sky sentinels: neutral winged guards ----------
  MONSTER_DEFS.sky_sentinel = { name: 'Sky sentinel', level: 35, r: 12, hp: 160, att: 36, maxHit: 15, def: 32, speed: 165, aggro: false, sight: 6 * TILE, respawn: 120, human: true,
    drops: { always: [['coins', 20, 40]], table: [['nothing', 0, 0, 1], ['cloud_essence', 1, 1, 1]] } };

  // feathered wings, like the godly helm's but larger: three feathers a side, a slow flap
  function skWings(g, scale, flap, tone) {
    g.save(); g.scale(scale, scale); g.translate(0, -2);
    for (const s of [-1, 1]) {
      g.save(); g.scale(s, 1); g.rotate(-flap);
      g.fillStyle = tone || '#fff6dc'; g.strokeStyle = '#c9b676'; g.lineWidth = 0.8;
      for (let f = 0; f < 4; f++) { const a = -0.25 - f * 0.3, L = 26 - f * 4; const ex = 9 + Math.cos(a) * L, ey = Math.sin(a) * L;
        g.beginPath(); g.moveTo(9, 0); g.quadraticCurveTo(9 + Math.cos(a) * L * 0.55, Math.sin(a) * L * 0.55 - 5, ex, ey); g.quadraticCurveTo(9 + Math.cos(a) * L * 0.55 + 2, Math.sin(a) * L * 0.55 + 3, 9, 4); g.closePath(); g.fill(); g.stroke(); }
      g.fillStyle = '#e8d9a0'; g.beginPath(); g.arc(9, 1, 2.5, 0, 7); g.fill();
      g.restore();
    }
    g.restore();
  }
  HOOKS.drawMonster.sky_sentinel = (g, e, hurt) => {
    const flap = Math.sin(time * 2.2 + (e.walkT || 0) * 0.3) * 0.12 + (e.moving ? Math.sin(e.walkT * 0.5) * 0.3 : 0);
    skWings(g, 1.05, flap, hurt ? '#ffd0d0' : '#f4f0e0');
    drawHuman(g, e, { tunic: '#c9d6ea', hair: '#e8d9a0', helm: '#dfe6f0', spear: true, shoulder: '#9ab0d0', skin: '#f0d8c0' });
  };

  // ---------- quest state ----------
  QUEST_DEFS.sky = { name: 'Song of Above' };
  const freshSky = () => ({ stage: 0, wisps: 0, forged: 0 });
  const SQ = () => { let q = quest.sky; if (!q || typeof q !== 'object') q = quest.sky = freshSky(); return q; };
  const skyDone = () => SQ().stage === 'done';
  const SKYW = []; // regrowing wisps while inside: {tx, ty, t}
  HOOKS.newGame.push(() => { quest.sky = freshSky(); SKYW.length = 0; });
  HOOKS.questText.sky = () => {
    const q = SQ();
    if (q.stage === 'done') return 'Done.';
    if (q.stage === 2) return `Bring Queen Seraphel 5 dragon scales (${Math.min(5, countItem('dragon_scale'))}/5) and 3 cloud essence (${Math.min(3, countItem('cloud_essence'))}/3). Ash drakes at Dunstan's farm shed scale, three drakes for one at the very worst. Sentinels drop essence; wisps hold it.`;
    if (!countItem('wind_flute')) return 'Old Wren gave you a wind flute. Find it, or ask him again.';
    const stormLeft = !(quest.storm && quest.storm.beaten);
    return 'Play the wind flute at the wind shrine on the Grey Quarry heights (north-west of Thistledown).' + (stormLeft ? ' The wind carries you into the storm under Aerie: put down the Thunderbird turning in it and the way up opens.' : ' The storm is broken; the wind goes straight up.');
  };
  HOOKS.activeQuests.push(() => { const s = SQ().stage; return s === 1 || s === 2 ? ['sky'] : []; });
  HOOKS.mapTarget.push(() => { const s = SQ().stage; return s === 1 || s === 2 ? { x: SHRINE_T.x, y: SHRINE_T.y, label: 'The wind shrine', id: 'sky' } : null; });

  // ---------- Old Wren: the song the wind people sing (runs before the core hermit dialogue) ----------
  HOOKS.talkBefore.hermit = n => {
    const q = SQ();
    if (quest.wren !== 'done') return false;
    if (q.stage === 0) {
      q.stage = 1;
      say("The bow treating you well? Good. Then hear an old man's other secret. Some nights, when the wind comes off the quarry, it sings. Not wolves. People. Winged people, above the clouds.", n.name);
      say("They call it the Song of Above. My grandmother carved this flute from a feather-bone. Play it at the wind shrine on the highest rock of the Grey Quarry, and the wind will carry you up.", n.name);
      giveOrDrop('wind_flute', 1, player.x, player.y);
      levelBanner = { text: 'NEW QUEST', sub: 'Song of Above', t: 3 }; sfx('quest'); save();
      return true;
    }
    if (q.stage === 1) { say(countItem('wind_flute') ? "The wind shrine. Highest rock in the Grey Quarry, north of the road. Stand before it and play." : "Lost the flute already? Look in your pack, knight. It came from my grandmother.", n.name); return true; }
    if (q.stage === 2) { say("Dragon scales and cloud essence, for a queen. Sounds like a knight's errand to me.", n.name); return true; }
    return false; // the song is sung: the core's own line
  };

  // ---------- Aerie: the instance ----------
  const inCloud = (x, y) => { const dx = (x - 25) / 23.5, dy = (y - 17) / 15.5; return dx * dx + dy * dy <= 1 + Math.sin(x * 1.9 + y * 1.3) * 0.08; };
  function buildAerie(set, rnd, at) {
    for (let y = 0; y < AER.h; y++) for (let x = 0; x < AER.w; x++) set(x, y, inCloud(x, y) ? CLOUD : SKY);
    // the great hall: marble floor, a ring of castle-wall fragments, open to the south
    for (let y = HALL.y0; y <= HALL.y1; y++) for (let x = HALL.x0; x <= HALL.x1; x++) set(x, y, T.FLOOR);
    for (let x = HALL.x0; x <= HALL.x1; x++) { if (x !== HALL.x0 + 4 && x !== HALL.x1 - 4) set(x, HALL.y0, T.CWALL); if (x < 24 || x > 26) set(x, HALL.y1, T.CWALL); }
    for (let y = HALL.y0; y <= HALL.y1; y++) { if (y % 3 !== 1) { set(HALL.x0, y, T.CWALL); set(HALL.x1, y, T.CWALL); } }
    for (const [x, y] of [[21, 7], [29, 7], [21, 10], [29, 10]]) set(x, y, T.CWALL);            // pillars
    for (const [x, y] of [[24, 4], [26, 4], [25, 4]]) set(x, y, T.CWALL);                        // the dais wall behind the queen
    // Halcyon's platform and the walk to it
    for (let y = FORGE_P.y0; y <= FORGE_P.y1; y++) for (let x = FORGE_P.x0; x <= FORGE_P.x1; x++) set(x, y, T.FLOOR);
    for (const [x, y] of [[FORGE_P.x0, FORGE_P.y0], [FORGE_P.x1, FORGE_P.y0], [FORGE_P.x0, FORGE_P.y1], [FORGE_P.x1, FORGE_P.y1], [39, 16], [40, 16]]) set(x, y, T.CWALL);
    // marble walks from the entry to the hall and the forge
    for (let y = HALL.y1 + 1; y <= ENTRY[1]; y++) set(25, y, T.FLOOR);
    for (let x = 26; x < FORGE_P.x0; x++) set(x, 18, T.FLOOR);
    // small marble islands with wall fragments, for the eye
    for (const [cx, cy] of [[8, 8], [42, 6], [6, 26], [44, 28]]) { for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) if (at(x, y) === CLOUD) set(x, y, T.FLOOR); if (at(cx, cy - 1) === T.FLOOR) set(cx, cy - 1, T.CWALL); }
    for (const [x, y] of WISPS) set(x, y, WISP);
    set(LEAP_T[0], LEAP_T[1], LEAP); set(ENTRY[0], ENTRY[1], CLOUD);
    for (const n of SKY_NPCS) set(n.x, n.y, T.FLOOR);
  }
  const aerie = INSTANCES.define(AER.id, {
    name: AER.name, sub: AER.sub, w: AER.w, h: AER.h, dark: false, build: buildAerie,
    spawns: SENTINELS.map(([x, y]) => ['sky_sentinel', x, y]), entry: ENTRY,
    voice: 'Above the clouds. The winged folk have watched the Fanglands for a thousand years. Listen: they sing.',
  });
  aerie.tiles[ENTRY[1] * AER.w + ENTRY[0]] = CLOUD; // define() paints the entry tile CAVE; a cloud has no cave floor

  // ---------- the wind shrine in the Grey Quarry ----------
  HOOKS.world.push((rnd, api) => {
    const soft = [T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM, T.STUMP, T.RUBBLE];
    for (let y = SHRINE_T.y - 1; y <= SHRINE_T.y + 2; y++) for (let x = SHRINE_T.x - 2; x <= SHRINE_T.x + 2; x++) if (soft.includes(api.tileAt(x, y))) api.setTile(x, y, T.GRASS);
    api.setTile(SHRINE_T.x, SHRINE_T.y, WIND_SHRINE); api.setTile(STEP_T.x, STEP_T.y, T.DIRT);
  });
  function liftToAerie(from) {
    burst(player.x, player.y, '#dff0ff', 40, 220); burst(player.x, player.y, '#ffffff', 20, 140); sfx('levelup');
    if (!INSTANCES.enter(AER.id, [STEP_T.x, STEP_T.y])) { notify('The wind stirs, but will not lift you now.'); return false; }
    say(from === 'storm'
      ? 'The updraft takes you off the broken storm like a leaf off a river, up through the last of the black, and into the light.'
      : 'The flute sings and the wind answers. It takes you like a leaf, up through the grey, into the light.', 'The Voice');
    save(); return true;
  }
  function leapDown() {
    INSTANCES.leave(); burst(player.x, player.y, '#dff0ff', 30, 160); sfx('open');
    notify("You leap from the cloud's edge. The wind sets you down by the shrine.");
  }

  // ---------- talking to the winged folk (own list: E in front of them) ----------
  function inFront() {
    let best = null;
    for (const e of SKY_NPCS) {
      const d = dist(player.x, player.y, e.px, e.py); if (d > 96) continue;
      const dot = ((e.px - player.x) * player.facing.x + (e.py - player.y) * player.facing.y) / (d || 1);
      if (dot < 0.2 && d > 30) continue;
      if (!best || d < best.d) best = { e, d };
    }
    return best ? best.e : null;
  }
  function talk(e) {
    { const dx = e.px - player.x, dy = e.py - player.y, d = Math.hypot(dx, dy) || 1; player.facing = { x: dx / d, y: dy / d }; }
    const q = SQ();
    if (e.role === 'sky_queen') {
      if (q.stage !== 'done' && q.stage < 2) {
        q.stage = 2;
        say("A knight, carried up on Wren's old flute — and through the storm, which is more than any of my sentinels has managed this year. The wind does not lift just anyone. Welcome to Aerie, the city above the clouds.", e.name);
        say("You have heard of the Song of Above. It is not a tune, it is a forging-song: sung over dragon scale, it makes metal that dragons cannot bite. But the Song needs a voice and a price.", e.name);
        say("Bring me five dragon scales and three cloud essence. Our sentinels carry essence; the wisps on the cloud's edge hold it too. Then I will sing, and Master Halcyon will forge for you.", e.name);
        save();
      } else if (q.stage === 2) {
        if (countItem('dragon_scale') >= 5 && countItem('cloud_essence') >= 3) {
          removeItem('dragon_scale', 5); removeItem('cloud_essence', 3); q.stage = 'done';
          giveOrDrop('coins', 400, player.x, player.y); gainXp('smithing', 300);
          say("Scale, and cloud. Stand still, knight, and listen.", e.name);
          say("~ Above the grey, above the fire, the wind remembers what was ours; the scale that burned now burns no more, the sky is plate, the plate is sky ~", 'The Song of Above');
          say("It is sung. Halcyon's forge is open to you: dragon scale, the dwarves' blue metal and a shard of obsidian for each piece. Wear it, and go down to the thing that sleeps under the lava.", e.name);
          levelBanner = { text: 'QUEST COMPLETE', sub: 'Song of Above', t: 3.5 }; sfx('quest'); burst(player.x, player.y, '#f5e6a8', 40, 200); save();
        } else say(`Five dragon scales and three cloud essence. You carry ${countItem('dragon_scale')} scales and ${countItem('cloud_essence')} essence. Scale comes off the ash drakes on the grey below: no drake-hide holds out past the third. The sentinels here drop essence, and the wisps at the cloud's edge grow it back.`, e.name);
      } else say("The Song is sung and Halcyon's hammer is yours. The Fang will not like what you wear, knight. Good.", e.name);
    } else if (e.role === 'sky_smith') {
      if (q.stage !== 'done') { say("Scale and mithril I can shape. But without the Queen's Song it is only armour, and the Fang eats armour. Bring her what she asks first.", e.name); return; }
      say("The Song is in the metal now. Eight to twelve dragon scales a piece, mithril bars, and a shard of obsidian to hold the fire. No anvil: the cloud is my anvil.", e.name);
      openPanel('halcyon');
    }
  }
  HOOKS.use.push((t, tx, ty) => {
    if (t === WIND_SHRINE) {
      if (active()) return true;
      if (!countItem('wind_flute')) { say('The wind is silent. The shrine waits for a song it knows.', 'Wind shrine'); return true; }
      // 66-storm: while the storm under Aerie still stands, the wind takes you into it instead of over it
      if (window.STORM && typeof STORM.shrine === 'function' && STORM.shrine()) return true;
      liftToAerie(); return true;
    }
    if (!active()) return false;
    const n = inFront(); if (n) { talk(n); return true; }
    if (t === LEAP) { leapDown(); return true; }
    if (t === WISP) {
      if (!canFit('cloud_essence', 1)) { notify('Your pack is full.'); return true; }
      setTile(tx, ty, CLOUD); miniDirtyTiles.add(idx(tx, ty)); SKYW.push({ tx, ty, t: WISP_REGROW }); SQ().wisps++;
      giveOrDrop('cloud_essence', 1, player.x, player.y); burst(tc(tx), tc(ty), '#dff0ff', 14, 80); sfx('pickup'); return true;
    }
    if (t === SKY) { notify('Open air. A long way down.'); return true; }
    if (t === CLOUD) { notify('Cloud. It holds, somehow.'); return true; }
    return false;
  });
  HOOKS.update.push(dt => {
    if (!active()) { if (SKYW.length) SKYW.length = 0; return; }
    for (const w of SKYW) { w.t -= dt; if (w.t <= 0 && tileAt(w.tx, w.ty) === CLOUD && !circleHitsTile(player.x, player.y, player.r + 2, w.tx, w.ty)) { setTile(w.tx, w.ty, WISP); miniDirtyTiles.add(idx(w.tx, w.ty)); burst(tc(w.tx), tc(w.ty), '#dff0ff', 8, 50); w.done = true; } }
    for (let i = SKYW.length - 1; i >= 0; i--) if (SKYW[i].done) SKYW.splice(i, 1);
  });

  // ---------- Halcyon's forge panel ----------
  HOOKS.panel.halcyon = (g, narrow) => {
    const { px, py, w, h } = panelBox(g, 460, 300, "Halcyon's Sky Forge", `Smithing level ${skillLv('smithing')} · needs ${FORGE_LV} · no anvil, no hammer`);
    g.fillStyle = '#c9d1d9'; g.font = '12px sans-serif'; g.textAlign = 'left';
    g.fillText(`You carry ${countItem('dragon_scale')} dragon scales, ${countItem('mithril_bar')} mithril bars, ${countItem('obsidian')} obsidian.`, px + 18, py + 74);
    FORGE.forEach((f, i) => { const y = py + 88 + i * 40; const ok = canForge(f); button(g, px + 18, y, w - 36, 34, f.label + `  (lv ${FORGE_LV})`, () => forge(f), ok ? '#238636' : '#2a2f3a', ok); });
    if (skillLv('smithing') < FORGE_LV) { g.fillStyle = '#ff6b6b'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText(`Smithing ${FORGE_LV} is needed for Godly plate.`, px + 18, py + h - 14); }
  };

  // ---------- drawing ----------
  const hash = (x, y) => ((Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0) / 4294967296;
  function drawSky(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = '#8fd0ff'; g.fillRect(x, y, TILE, TILE);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, y + TILE * 0.6, TILE, TILE * 0.4);
    const r = hash(tx, ty);
    if (r < 0.12) { const drift = (time * 6 + tx * 5) % (TILE * 3) - TILE; g.fillStyle = 'rgba(255,255,255,0.55)'; for (const [ox, oy, rr] of [[0, 0, 7], [9, -2, 9], [18, 1, 6], [8, 4, 6]]) { g.beginPath(); g.arc(x + 10 + ox + drift, y + 20 + oy + r * 20, rr, 0, 7); g.fill(); } }
  }
  function drawCloud(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, r = hash(tx, ty);
    g.fillStyle = '#eef3fa'; g.fillRect(x, y, TILE, TILE);
    g.fillStyle = 'rgba(255,255,255,0.85)'; for (const [ox, oy, rr] of [[12 + r * 8, 14, 12], [30, 22 + r * 6, 14], [20, 34, 11], [38, 10, 8]]) { g.beginPath(); g.arc(x + ox, y + oy, rr, 0, 7); g.fill(); }
    // blue shadow where the cloud ends
    const below = tileAt(tx, ty + 1), right = tileAt(tx + 1, ty), left = tileAt(tx - 1, ty);
    if (below === SKY || below === T.WALL) { const gr = g.createLinearGradient(0, y + TILE - 14, 0, y + TILE); gr.addColorStop(0, 'rgba(120,160,220,0)'); gr.addColorStop(1, 'rgba(110,150,215,0.55)'); g.fillStyle = gr; g.fillRect(x, y + TILE - 14, TILE, 14); }
    if (right === SKY || right === T.WALL) { g.fillStyle = 'rgba(120,160,220,0.3)'; g.fillRect(x + TILE - 6, y, 6, TILE); }
    if (left === SKY || left === T.WALL) { g.fillStyle = 'rgba(120,160,220,0.18)'; g.fillRect(x, y, 4, TILE); }
    g.fillStyle = `rgba(190,215,245,${0.18 + r * 0.12})`; g.beginPath(); g.ellipse(x + 26, y + 30, 14, 5, 0, 0, 7); g.fill();
  }
  function drawWisp(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), t = time * 1.6 + tx;
    const gr = g.createRadialGradient(cx, cy, 2, cx, cy, 30); gr.addColorStop(0, 'rgba(230,245,255,0.6)'); gr.addColorStop(1, 'rgba(230,245,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 30, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; g.lineCap = 'round';
    for (let k = 0; k < 3; k++) { const a = t + k * 2.1; g.beginPath(); g.arc(cx + Math.cos(a) * 5, cy - 6 + Math.sin(a) * 4, 9 + k * 2, a, a + 2.4); g.stroke(); }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx + Math.cos(t * 2) * 4, cy - 8 + Math.sin(t * 3) * 3, 3, 0, 7); g.fill();
  }
  function drawLeap(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, cx = tc(tx);
    g.fillStyle = '#d9dfe8'; g.fillRect(x + 4, y + 4, TILE - 8, 12); g.fillStyle = '#b9c2cf'; g.fillRect(x + 4, y + 14, TILE - 8, 3);
    g.strokeStyle = `rgba(255,255,255,${0.5 + Math.sin(time * 4) * 0.3})`; g.lineWidth = 2; for (let k = 0; k < 3; k++) { const ph = (time * 0.8 + k * 0.33) % 1; g.beginPath(); g.moveTo(cx - 14 + k * 12, y + 20 + ph * 22); g.quadraticCurveTo(cx - 8 + k * 12, y + 26 + ph * 22, cx - 2 + k * 12, y + 22 + ph * 22); g.stroke(); }
    if (dist(player.x, player.y, cx, tc(ty)) < 160) { g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.strokeText(`Leap · ${keyName('E')}`, cx, y - 4); g.fillStyle = '#ffe9a8'; g.fillText(`Leap · ${keyName('E')}`, cx, y - 4); }
  }
  function drawShrine(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 14, 18, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#6e7178'; g.fillRect(cx - 14, cy, 28, 14); g.fillStyle = '#8d9098'; g.fillRect(cx - 16, cy - 4, 32, 5);
    g.fillStyle = '#7d8088'; g.beginPath(); g.moveTo(cx - 8, cy - 4); g.lineTo(cx - 6, cy - 40); g.lineTo(cx + 6, cy - 40); g.lineTo(cx + 8, cy - 4); g.closePath(); g.fill();
    g.fillStyle = '#a9adb5'; g.fillRect(cx - 6, cy - 40, 3, 36);
    const gl = 0.5 + Math.sin(time * 2.5) * 0.3, hasFlute = countItem('wind_flute') > 0;
    g.strokeStyle = `rgba(191,227,255,${hasFlute ? gl : 0.35})`; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.arc(cx, cy - 24, 6, 0.4, 5.2); g.stroke(); g.beginPath(); g.arc(cx + 2, cy - 22, 3, 1, 5.8); g.stroke(); // the wind rune
    g.strokeStyle = `rgba(255,255,255,${0.35 + gl * 0.3})`; g.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) { const ph = (time * 0.7 + k * 0.33) % 1, a = ph * Math.PI * 2 + k; g.beginPath(); g.arc(cx, cy - 22, 14 + ph * 16, a, a + 1.6); g.stroke(); }
  }
  function drawSkyNpc(g, n) {
    const e = { x: n.px, y: n.py, r: 13, facing: n.facing, hurtT: 0, attackT: 0, moving: false, walkT: 0 };
    const near = dist(player.x, player.y, e.x, e.y) < 110;
    if (near) e.facing = { x: Math.sign(player.x - e.x) || 0, y: Math.sign(player.y - e.y) || 1 };
    const hover = Math.sin(time * 1.8 + n.x) * 1.5;
    g.save(); g.translate(e.x, e.y + hover);
    g.fillStyle = 'rgba(80,110,170,0.25)'; g.beginPath(); g.ellipse(0, 12 - hover, 12, 5, 0, 0, 7); g.fill();
    skWings(g, n.wing, Math.sin(time * 1.6 + n.x) * 0.15, n.role === 'sky_queen' ? '#fffaf0' : '#f0e8d8');
    drawHuman(g, e, { tunic: n.tunic, hair: n.hair, crown: n.crown, woman: n.woman, beard: n.beard, apron: n.apron, shoulder: n.role === 'sky_queen' ? '#c9a36a' : '#7a8aa0', skin: '#f0d8c0', tool: n.role === 'sky_smith' ? 'hammer' : undefined, toolColor: '#c9ccd3' });
    g.restore();
    if (near) { g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(n.name, e.x, e.y - 28); g.fillStyle = '#ffe9a8'; g.fillText(n.name, e.x, e.y - 28); }
  }
  HOOKS.draw.push((g, items, cam) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 2);
    const inside = active();
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      if (inside && (t === SKY || tx >= AER.w || ty >= AER.h)) items.push({ y: -1e8 + ty * TILE - 1, draw: () => drawSky(g, tx, ty) });
      else if (t === CLOUD) items.push({ y: -1e8 + ty * TILE, draw: () => drawCloud(g, tx, ty) });
      else if (t === WISP) { items.push({ y: -1e8 + ty * TILE, draw: () => drawCloud(g, tx, ty) }); items.push({ y: ty * TILE + TILE - 6, draw: () => drawWisp(g, tx, ty) }); }
      else if (t === LEAP) { items.push({ y: -1e8 + ty * TILE, draw: () => drawCloud(g, tx, ty) }); items.push({ y: ty * TILE + 6, draw: () => drawLeap(g, tx, ty) }); }
      else if (t === WIND_SHRINE) items.push({ y: ty * TILE + TILE - 6, draw: () => drawShrine(g, tx, ty) });
    }
    if (inside) for (const n of SKY_NPCS) if (n.px > cam.x - 60 && n.px < cam.x + VW + 60 && n.py > cam.y - 60 && n.py < cam.y + VH + 60) items.push({ y: n.py + 13, draw: () => drawSkyNpc(g, n) });
    // use-highlight for our tiles and our people
    if (!player.dead && !player.mech && !npcInFront()) items.push({ y: 1e9 + 3, draw: () => {
      const { tx, ty } = frontTile(player); const t = tileAt(tx, ty);
      const n = inside ? inFront() : null;
      if (n) { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.arc(n.px, n.py, 22, 0, 7); g.stroke(); g.setLineDash([]); }
      else if (t === WIND_SHRINE || (inside && (t === LEAP || t === WISP))) { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]); roundRect(g, tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6, 6); g.stroke(); g.setLineDash([]); }
    } });
  });

  // ---------- debug handle ----------
  window.SKYCITY = { CLOUD, SKY, WISP, LEAP, WIND_SHRINE, SHRINE_T, STEP_T, ENTRY, LEAP_T, WISPS, SKY_NPCS, FORGE, SQ, skyDone, forge, talk, inFront, liftToAerie };

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const q = SQ(); const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
    const makeRoom = n => { h.clearJunk(); for (let i = player.inv.length - 1; i >= 0 && player.inv.filter(s => !s).length < n; i--) { const s = player.inv[i]; if (s && s.id !== 'coins' && !ITEMS[s.id].weapon && !ITEMS[s.id].armour && !ITEMS[s.id].tool && !/^(dragon|wind|cloud|obsidian|mithril)/.test(s.id)) player.inv[i] = null; } };
    const give = (id, n) => { while (countItem(id) < n) { if (h.give(id, 1) > 0) { makeRoom(2); if (h.give(id, 1) > 0) break; } } };
    h.peace(true); closePanel(); if (INSTANCES.active()) INSTANCES.leave();
    const st0 = quest.stage, wren0 = quest.wren, sky0 = JSON.stringify(q);
    // the shrine stands on the quarry heights
    check('sky: wind shrine on the Grey Quarry heights at (62,6) with a step below; Godly recipes are off the anvil', tileAt(SHRINE_T.x, SHRINE_T.y) === WIND_SHRINE && tileAt(STEP_T.x, STEP_T.y) === T.DIRT && regionAt(SHRINE_T.x, SHRINE_T.y).name === 'Grey Quarry' && !RECIPES.some(r => r.station === 'anvil' && /^godly_/.test(r.out)) && RECIPES.filter(r => /^godly_/.test(r.out)).length === 4, { tile: tileAt(SHRINE_T.x, SHRINE_T.y), step: tileAt(STEP_T.x, STEP_T.y), anvilGodly: RECIPES.filter(r => r.station === 'anvil' && /^godly_/.test(r.out)).length });
    // without the flute the wind is silent
    while (countItem('wind_flute')) removeItem('wind_flute', 1); q.stage = 0; q.wisps = 0;
    drain(); F.tp(STEP_T.x, STEP_T.y); F.face(SHRINE_T.x, SHRINE_T.y); F.press('KeyE'); F.sim(2, []);
    check('sky: E on the shrine without the flute — the wind is silent', !INSTANCES.active() && !!dialog.cur && /wind is silent/.test(dialog.cur.text), { text: dialog.cur && dialog.cur.text, inst: INSTANCES.active() });
    // Old Wren gives the flute once the silk quest is done
    { quest.wren = 'done'; makeRoom(3); drain(); F.tp(30, 81); const r = F.talk('wren'); F.sim(2, []);
      check('sky: Old Wren (silk done) tells of the Song of Above and gives the wind flute; quest active, map target on the shrine', typeof r === 'number' && q.stage === 1 && countItem('wind_flute') === 1 && activeQuests().includes('sky') && /flute/.test(questText('sky')) && mapTargets().some(t => t.id === 'sky'), { r, stage: q.stage, flute: countItem('wind_flute'), who: dialog.cur && dialog.cur.who }); }
    // the storm under Aerie (66-storm) is the way up now: the flute alone lifts you into it, not over it
    { drain(); if (window.STORM) quest.storm = { beaten: false, taught: true, bolts: 0, dodged: 0, hits: 0, kills: 0 };
      while (countItem('wind_flute') < 1) h.give('wind_flute', 1);
      F.tp(STEP_T.x, STEP_T.y); F.face(SHRINE_T.x, SHRINE_T.y); F.press('KeyE'); F.sim(3, []);
      const inst = INSTANCES.active();
      check('sky: the flute alone no longer opens Aerie — the wind carries you into the storm below it', !window.STORM || (inst === STORM.ST.id && inst !== AER.id && /storm/i.test(questText('sky'))), { inst, storm: !!window.STORM, text: questText('sky') });
      if (INSTANCES.active()) INSTANCES.leave();
      if (window.STORM) quest.storm.beaten = true; }
    // up to Aerie, with the storm behind you
    { drain(); F.tp(STEP_T.x, STEP_T.y); F.face(SHRINE_T.x, SHRINE_T.y); F.press('KeyE'); F.sim(3, []);
      const sents = monsters.filter(m => m.type === 'sky_sentinel');
      let cloud = 0, sky = 0, floor = 0, wisps = 0; for (let y = 0; y < AER.h; y++) for (let x = 0; x < AER.w; x++) { const t = tileAt(x, y); if (t === CLOUD) cloud++; else if (t === SKY) sky++; else if (t === T.FLOOR) floor++; else if (t === WISP) wisps++; }
      const path = F.bfs(ENTRY[0], ENTRY[1], 25, 7), pathForge = F.bfs(ENTRY[0], ENTRY[1], 38, 19);
      check('sky: with the storm broken the flute lifts you to Aerie — a 50×34 cloud instance (region + banner), 4 neutral level-35 sentinels, marble hall, 3 wisps, the leap tile', INSTANCES.active() === AER.id && player.region === AER.name && !!areaBanner && areaBanner.name === AER.name && sents.length === 4 && sents.every(m => !m.angry && !m.dead) && MONSTER_DEFS.sky_sentinel.level === 35 && MONSTER_DEFS.sky_sentinel.human && !MONSTER_DEFS.sky_sentinel.aggro && cloud > 800 && sky > 300 && floor > 150 && wisps === 3 && tileAt(LEAP_T[0], LEAP_T[1]) === LEAP && !!path && !!pathForge && !aerie.dark, { inst: INSTANCES.active(), region: player.region, sentinels: sents.length, cloud, sky, floor, wisps, path: path && path.length, forge: pathForge && pathForge.length }); }
    // Seraphel's task, then the song
    { drain(); F.tp(25, 7); F.face(25, 6); F.press('KeyE'); F.sim(2, []); const asked = q.stage === 2 && dialog.cur && dialog.cur.who === 'Queen Seraphel' && /scales/.test(questText('sky'));
      while (countItem('dragon_scale') > 0) removeItem('dragon_scale', countItem('dragon_scale')); while (countItem('cloud_essence') > 0) removeItem('cloud_essence', countItem('cloud_essence'));
      drain(); F.face(25, 6); F.press('KeyE'); F.sim(2, []); const notYet = q.stage === 2 && dialog.cur && /carry 0 scales/.test(dialog.cur.text);
      makeRoom(4); give('dragon_scale', 5); give('cloud_essence', 3); const c0 = coins();
      drain(); F.face(25, 6); F.press('KeyE'); F.sim(2, []);
      check('sky: Seraphel asks for 5 dragon scales + 3 cloud essence, then sings the Song (quest done, 400 coins)', asked && notYet && q.stage === 'done' && skyDone() && countItem('dragon_scale') === 0 && countItem('cloud_essence') === 0 && (coins() === c0 + 400 || drops.some(d => d.id === 'coins' && d.qty === 400)) && !activeQuests().includes('sky') && questText('sky') === 'Done.' && !!levelBanner && levelBanner.sub === 'Song of Above', { asked, notYet, stage: q.stage, coins: coins() - c0, banner: levelBanner && levelBanner.sub }); }
    // Halcyon forges a godly helm: Smithing 30, 8 scales + 2 mithril + obsidian, no anvil, no hammer
    { makeRoom(4); give('dragon_scale', 8); give('mithril_bar', 2); give('obsidian', 1);
      const hammerSlots = []; for (let i = 0; i < player.inv.length; i++) { const s = player.inv[i]; if (s && ITEMS[s.id].tool === 'hammer') { hammerSlots.push([i, s]); player.inv[i] = null; } }
      const sx0 = player.skills.smithing.xp; if (skillLv('smithing') < FORGE_LV) player.skills.smithing.xp = XP_TABLE[FORGE_LV];
      const helm0 = countItem('godly_helm'), sc0 = countItem('dragon_scale'), mb0 = countItem('mithril_bar'), ob0 = countItem('obsidian'), xp0 = player.skills.smithing.xp;
      drain(); F.tp(38, 19); F.face(38, 18); F.press('KeyE'); F.sim(1, []); const opened = panel === 'halcyon'; render();
      const clicked = F.clickButton('8 Dragon scales + 2 Mithril bars + Obsidian → Godly winged helm'); F.sim(2, []);
      check('sky: Halcyon\'s panel forges a Godly winged helm from 8 scales + 2 mithril + obsidian (Smithing 30, 500 xp), without hammer or anvil', opened && clicked && countItem('godly_helm') === helm0 + 1 && countItem('dragon_scale') === sc0 - 8 && countItem('mithril_bar') === mb0 - 2 && countItem('obsidian') === ob0 - 1 && player.skills.smithing.xp === xp0 + FORGE_XP && !hasTool('hammer') && FORGE.map(f => f.scales).join(',') === '8,12,10,8' && FORGE.map(f => f.mithril).join(',') === '2,4,3,2', { opened, clicked, helm: countItem('godly_helm') - helm0, xp: player.skills.smithing.xp - xp0 });
      closePanel(); removeItem('godly_helm', 1); for (const [i, s] of hammerSlots) if (!player.inv[i]) player.inv[i] = s; else addItem(s.id, s.qty); player.skills.smithing.xp = Math.max(sx0, player.skills.smithing.xp); }
    // a wisp gives essence and grows back
    { const [wx, wy] = WISPS[1]; makeRoom(2); const e0 = countItem('cloud_essence'); F.tp(wx, wy - 1); F.face(wx, wy); F.press('KeyE'); F.sim(2, []);
      const took = countItem('cloud_essence') === e0 + 1 && tileAt(wx, wy) === CLOUD && SKYW.length === 1;
      F.tp(25, 20); F.sim(Math.ceil(WISP_REGROW * 60) + 5, []); const back = tileAt(wx, wy) === WISP && SKYW.length === 0;
      check('sky: E on a cloud wisp gives cloud essence; it grows back after 45 s', took && back, { took, back, essence: countItem('cloud_essence') - e0, tile: tileAt(wx, wy) }); while (countItem('cloud_essence') > e0) removeItem('cloud_essence', 1); }
    // the leap goes home to the shrine
    { F.tp(ENTRY[0], ENTRY[1]); F.face(LEAP_T[0], LEAP_T[1]); F.press('KeyE'); F.sim(2, []);
      const at = [Math.floor(player.x / TILE), Math.floor(player.y / TILE)];
      check('sky: E on the leap tile returns you to the shrine step', INSTANCES.active() === null && at[0] === STEP_T.x && at[1] === STEP_T.y && tileAt(SHRINE_T.x, SHRINE_T.y) === WIND_SHRINE, { at, inst: INSTANCES.active() }); }
    // quest log text for the Godly gear stays truthful: it lists Aerie, not the anvil
    check('sky: the Song of Above quest is registered with texts for every stage', QUEST_DEFS.sky.name === 'Song of Above' && typeof HOOKS.questText.sky === 'function' && ITEMS.wind_flute.stack === 1 && ITEMS.cloud_essence.stack === 50 && ITEMS.godly_helm.armour.def === 30, {});
    if (INSTANCES.active()) INSTANCES.leave(); quest.wren = wren0; quest.stage = st0; closePanel(); drain(); h.peace(false); save();
    void sky0;
  });
}
