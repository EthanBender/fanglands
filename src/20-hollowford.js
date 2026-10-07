// ============================================================================
// CHAPTER 4 — HOLLOWFORD AND THE BARRELBEAST (feature file; registers through HOOKS only)
// The town the goblins burned, south of their camp. Survivors hide in the chapel crypt.
// A boss machine — the Barrelbeast — stamps through the square. Bring it down, then tell Old Tam.
// ============================================================================
{
  // ---------- region ----------
  // every overworld position here is Hollowford's (its frame and ports) or the goblin camp's (the War Shed's door, walls and
  // wreck spots, the palisade gap): the spread spec, §9.1. The shed's own map (SHED_HOME, the valve, the boiler) is not wrapped.
  const HFF = ATLAS.frame('hollowford'), CMP = ATLAS.frame('camp');
  const HF_P = id => { const [x, y] = ATLAS.port(id); return { x, y }; };
  const HF_REGION = HFF.rect({ name: 'Hollowford', sub: 'What the goblins left', x0: 122, y0: 66, x1: 156, y1: 92 });
  REGIONS.unshift(HF_REGION);
  const hfIn = (tx, ty) => tx >= HF_REGION.x0 && tx <= HF_REGION.x1 && ty >= HF_REGION.y0 && ty <= HF_REGION.y1;
  const HF_SQUARE = HF_P('hollowford.square'); // the cracked well
  const HF_HATCH = HF_P('hollowford.hatch');   // Pip's cellar
  const HF_BEAST_HOME = HF_P('hollowford.barrelbeast');
  // feature state lives in quest.hollowford (saved with the quest); created lazily for old saves.
  // freed / barHits: Cohen's "Under the Chapel" — the survivors are barred into the crypt by goblin iron until the knight breaks it (3 hammer hits).
  // The War Shed (owner: "bosses shoould all be redefeatable"): the square's beast dies once, for good, and Hollowford stays
  // safe. The goblin crew that ran builds the next one in a shed on the road below their camp; its boiler valve stands it
  // up for a rematch every 300 s of the knight's own day clock. shedUp: one called and not yet beaten. shedKills: rematches
  // won. wreckDue: a first kill made in the shed (a friend's fight), whose wreck is rolled out beside the door on leaving.
  // toldShed: online, a friend broke the square's beast already, and this knight was sent to the shed for his own fight.
  const HF = () => { const h = quest.hollowford || (quest.hollowford = { rewarded: false, beastKilled: false, wreck: null }); if (typeof h.freed !== 'boolean') h.freed = false; if (typeof h.barHits !== 'number') h.barHits = 0;
    h.shedUp = h.shedUp ?? false; h.shedRestUntil = h.shedRestUntil ?? 0; h.shedKills = h.shedKills ?? 0; h.wreckDue = h.wreckDue ?? false; h.toldShed = h.toldShed ?? false; h.shedVoice = h.shedVoice ?? null; return h; };
  // a save from before the shed's line was fitted to the story: a knight who has been inside heard the story line already
  // (the instance's own voice, on his first visit), so he is not told it again
  { const _load = load;
    load = function () {
      const ok = _load(); const h = quest.hollowford;
      if (ok && h && h.shedVoice === undefined) { const v = quest.instances && quest.instances.visited && quest.instances.visited.war_shed; h.shedVoice = v ? (quest.stage >= 9 ? 'story' : 'early') : null; }
      return ok;
    }; }
  HOOKS.newGame.push(() => { quest.hollowford = { rewarded: false, beastKilled: false, wreck: null, freed: false, barHits: 0, shedUp: false, shedRestUntil: 0, shedKills: 0, wreckDue: false, toldShed: false, shedVoice: null }; });
  // the valve stands on row 7, under the boiler (row 6), with the stocks three rows below it: on row 3 it sat under the top
  // HUD of a phone held upright (the crest, the quest scroll, two plaques: down to 323 px), where the camera cannot scroll
  // past the shed's top wall
  const SHED = { id: 'war_shed', w: 28, h: 20 }, SHED_DOOR = ATLAS.port('camp.shed_door'), SHED_STEP = ATLAS.port('camp.shed_step'), SHED_HOME = { x: 14, y: 11 }, VALVE_T = { x: 14, y: 7 };
  const BOILER_T = [[13, 6], [14, 6], [15, 6]];
  const SHED_ENTRY = [14, 18], SHED_EXIT = [14, 19], SHED_REST = 300;
  // the shed's first-visit Voice: the story line once his story has reached the burning of Hollowford (stage 9), a plain
  // one before that (the door is open from a new game, so a friend can follow a friend in), and the story line once more on
  // his first visit after stage 9. hf.shedVoice: null, 'early' or 'story'.
  const SHED_VOICE = 'The War Shed. The goblins kept the plans. Whatever they drag back from Hollowford, they bolt into the next Barrelbeast.';
  const SHED_VOICE_EARLY = 'The War Shed. Goblins build their machines in here. The stocks are empty, and the crew is out.';
  const SHED_WALL = CMP.pts([[145, 43], [146, 43], [147, 43], [145, 44], [146, 44], [145, 45], [146, 45], [147, 45]]);
  const WRECK_SPOTS = CMP.pts([[144, 47], [143, 47], [144, 48], [143, 48]]);
  const restLeft = until => Math.max(0, (until || 0) - (player.dayTime || 0));
  const mmss = s => { const c = Math.ceil(s); return Math.floor(c / 60) + ':' + String(c % 60).padStart(2, '0'); };
  const inShed = () => !!(window.INSTANCES && INSTANCES.active() === SHED.id);
  // who makes monsters on this map: a knight alone, or the map's keeper online (docs/ONLINE.md, the keeper model)
  const runsHere = () => !window.NET || !NET.online() || !!(window.COOP && COOP.isKeeper());
  const liveBeast = () => monsters.find(m => m.type === 'barrelbeast' && !m.dead) || null;

  // ---------- tiles ----------
  const T_SCORCH = addTile('SCORCH', { placeableOn: true, tex: 'scorch', mini: '#3a3330' }); // burned ground
  const T_WELL = addTile('WELL', { solid: true, tex: 'scorch', mini: '#8d9098' });            // cracked town well
  const T_HATCH = addTile('HATCH', { tex: 'dirt', mini: '#6b4a2a' });                          // cellar hatch (walk over it)
  const T_BEAM = addTile('BEAM', { solid: true, tex: 'scorch', mini: '#2a2420' });             // fallen charred roof beam
  const T_BARS = addTile('CRYPT_BARS', { solid: true, tex: 'floor', mini: '#8f96a3' });       // goblin scrap-iron across the crypt entrance
  INTERESTING_TILES.add(T_BARS); // the core draws the E highlight on it and frontTile reaches for it
  // the War Shed's boiler valve: spinning it stands a new Barrelbeast up off the stocks (E, the USE seat, or a tap)
  const T_VALVE = addTile('SHED_VALVE', { solid: true, tex: 'floor', mini: '#c0504d' });
  INTERESTING_TILES.add(T_VALVE);
  // the crypt is the west (FLOOR) end of the chapel, x 125–128, y 85–90. The bars close it off from the doorway step (128,85) and along the nave side (x 129).
  const BAR_TILES = HFF.pts([[128, 85], [129, 85], [129, 86], [129, 87], [129, 88], [129, 89], [129, 90]]);
  const JAILERS = HFF.pts([[126, 83], [130, 83]]); // two goblin brutes posted outside the chapel door
  const BAR_HITS = 3;
  const barsStand = () => BAR_TILES.some(([x, y]) => tileAt(x, y) === T_BARS);
  const isJailer = m => m.type === 'brute' && JAILERS.some(([x, y]) => Math.abs(m.home.x - tc(x)) < 1 && Math.abs(m.home.y - tc(y)) < 1);
  { // scorched-earth ground texture, same procedural style as the core tiles
    const rnd = mulberry32(4041);
    for (let v = 0; v < 3; v++) makeTex('scorch' + v, g => {
      const grad = g.createLinearGradient(0, 0, TILE, TILE); grad.addColorStop(0, '#3d3632'); grad.addColorStop(1, '#2b2624');
      g.fillStyle = grad; g.fillRect(0, 0, TILE, TILE);
      for (let i = 0; i < 26; i++) { g.fillStyle = rnd() < 0.5 ? '#4a423c' : '#221e1b'; g.beginPath(); g.ellipse(rnd() * TILE, rnd() * TILE, 2 + rnd() * 4, 1 + rnd() * 2.5, rnd() * 3, 0, 7); g.fill(); }
      for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(190,190,195,0.32)'; g.beginPath(); g.arc(rnd() * TILE, rnd() * TILE, 0.7 + rnd(), 0, 7); g.fill(); } // ash flecks
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.2;
      for (let i = 0; i < 2; i++) { const x = rnd() * TILE, y = rnd() * TILE; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 20, y + (rnd() - 0.5) * 20); g.lineTo(x + (rnd() - 0.5) * 26, y + (rnd() - 0.5) * 26); g.stroke(); }
      if (v === 1) for (let i = 0; i < 2; i++) { g.fillStyle = 'rgba(255,120,40,0.35)'; g.beginPath(); g.arc(rnd() * TILE, rnd() * TILE, 1.4, 0, 7); g.fill(); } // a last ember
    });
  }

  // ---------- the Barrelbeast ----------
  MONSTER_DEFS.barrelbeast = {
    // r 36: the hit circle grown to fit the new, bigger look (78-monsterlook; was 30)
    name: 'The Barrelbeast', level: 28, r: 36, hp: 400, att: 26, maxHit: 16, def: 24, speed: 55, aggro: true, sight: 7 * TILE, respawn: 600,
    drops: { always: [['goblin_scrap', 8, 12], ['iron_bar', 2, 4], ['steel_bar', 1, 2], ['coins', 80, 160]], rare: { chance: 3, table: [['steel_battleaxe', 1, 1, 1], ['steel_body', 1, 1, 1]] } },
  };
  // Cohen's fight: the beast cracks and gets STRONGER as it takes hits (enrage stacks), it carries a lightning rod,
  // and under 35% hp it calls lightning down on marked ground. It still spits sticky bombs under half hp (phase 2)
  // and rams with the spiked front (the core melee). Killed, it leaves its own wreck for 32-beast.js to repair and drive.
  //   enrage: every 10% hp lost = one stack: +1 max hit (cap +6) and +5% speed (cap +50%); one more crack in the staves per stack
  //   lightning: every 4 s, three marks (the knight + two within 3 tiles) glow on the ground for 1.5 s, then bolts fall: 14–24 within 40 px
  const BEAST_BASE = { maxHit: 16, speed: 55 };
  const MARK_TIME = 1.5, BOLT_TIME = 0.2, VOLLEY_EVERY = 4, VOLLEY_RANGE = 8 * TILE;
  const beastStacks = e => clamp(Math.floor((1 - e.hp / e.maxHp) * 10), 0, 9);
  // crack polylines on the barrel face, revealed one per enrage stack (the first is the old phase-2 crack)
  const BEAST_CRACKS = [[[12, -20], [18, -8], [10, 2], [20, 14]], [[-20, -14], [-12, -4], [-18, 6]], [[-4, 18], [2, 8], [-2, -2]], [[26, -6], [30, 4], [24, 12]],
    [[-30, 4], [-24, 12], [-28, 18]], [[4, -24], [-2, -14], [2, -8]], [[-10, 20], [-6, 26]], [[22, 20], [16, 24]], [[-26, -18], [-30, -8]]];
  const polyline = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
  // sprite: a huge iron-banded barrel on four thick legs, a boiler with a chimney, a lightning rod, a spiked ram in front.
  // Crew: the goblins ride the wild beast; `pilot` (a playerLook()) puts the knight in the seat instead; `e.parked` = nobody aboard.
  // 32-beast.js calls this with a fourth argument for the driven and parked beast (the core passes three).
  HOOKS.drawMonster.barrelbeast = (g, e, hurt, pilot) => {
    const ang = Math.atan2(e.facing.y, e.facing.x), t = time, stacks = beastStacks(e), p2 = e.hp <= e.maxHp * 0.5, p3 = e.hp <= e.maxHp * 0.35 && !e.parked;
    const rodGlow = clamp(e.rodGlow || 0, 0, 1);
    // legs
    g.strokeStyle = '#2e2e36'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4, ph = e.moving ? Math.sin(e.walkT * 0.55 + k * 1.6) * 8 : 0;
      const hx = Math.cos(a) * 24, hy = Math.sin(a) * 14 + 6, kx = Math.cos(a) * 44, ky = Math.sin(a) * 30 + 12 + ph, fx = Math.cos(a) * 54, fy = Math.sin(a) * 44 + 26;
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      g.fillStyle = '#3a3a42'; g.beginPath(); g.ellipse(fx, fy + 2, 9, 5, 0, 0, 7); g.fill();
      g.fillStyle = '#8f96a3'; g.beginPath(); g.arc(kx, ky, 4, 0, 7); g.fill();
    }
    // barrel body with stave seams, a highlight and four iron bands with rivets
    g.fillStyle = hurt ? '#ffb0b0' : '#6a4022'; g.beginPath(); g.ellipse(0, 0, 38, 28, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 2; for (const oy of [-19, -8, 3, 14]) { const hw = 38 * Math.sqrt(1 - (oy / 28) ** 2); g.beginPath(); g.moveTo(-hw, oy); g.lineTo(hw, oy); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.ellipse(-6, -12, 22, 7, 0, 0, 7); g.fill();
    g.strokeStyle = '#2e2e36'; g.lineWidth = 5;
    for (const ox of [-24, -8, 8, 24]) { const hh = 28 * Math.sqrt(1 - (ox / 38) ** 2); g.beginPath(); g.moveTo(ox, -hh); g.lineTo(ox, hh); g.stroke(); g.fillStyle = '#8f96a3'; for (const ry of [-0.6, 0, 0.6]) { g.beginPath(); g.arc(ox, ry * hh, 1.8, 0, 7); g.fill(); } }
    // cracks: one more per enrage stack, deeper as they go; firelight leaks through them once the boiler is cracked (phase 2)
    for (let k = 0; k < Math.min(stacks, BEAST_CRACKS.length); k++) {
      const c = BEAST_CRACKS[k];
      if (p2) { g.strokeStyle = `rgba(255,140,40,${0.3 + Math.sin(t * 9 + k) * 0.2})`; g.lineWidth = 4 + stacks * 0.3; polyline(g, c); }
      g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineWidth = k < 3 ? 2.4 : 1.6; polyline(g, c);
    }
    // boiler, brass ring, firebox glow, chimney and steam
    g.fillStyle = '#4a4a52'; g.beginPath(); g.arc(-16, -22, 11, 0, 7); g.fill();
    g.strokeStyle = '#c9a02a'; g.lineWidth = 2; g.beginPath(); g.arc(-16, -22, 8, 0, 7); g.stroke();
    const glow = p2 ? 0.55 + Math.sin(t * 12) * 0.35 : 0.25 + Math.sin(t * 4) * 0.1;
    g.fillStyle = `rgba(255,${p2 ? 90 : 150},40,${glow})`; g.beginPath(); g.arc(-16, -22, 5, 0, 7); g.fill();
    g.fillStyle = '#3a3a42'; g.fillRect(-19, -40, 6, 12);
    if (!e.parked) for (let k = 0; k < 3; k++) { const ph = (t * 0.6 + k * 0.33) % 1; g.fillStyle = `rgba(${p2 ? 90 : 220},${p2 ? 80 : 220},${p2 ? 80 : 230},${0.45 * (1 - ph)})`; g.beginPath(); g.arc(-16 + Math.sin(t * 3 + k) * 4, -42 - ph * 26, 4 + ph * 6, 0, 7); g.fill(); }
    // bomb chute on the deck (lit when the boiler is cracked, or when the knight is at the lever)
    g.fillStyle = '#2e2e36'; g.fillRect(14, -24, 10, 14); g.fillStyle = '#1b1b20'; g.beginPath(); g.ellipse(19, -24, 5, 2.5, 0, 0, 7); g.fill();
    if (p2 || pilot) { g.fillStyle = '#ffb347'; g.beginPath(); g.arc(19, -26, 2 + Math.sin(t * 20), 0, 7); g.fill(); }
    // crew: goblins on the wild beast; the knight in the seat when driven; nobody on a parked one
    if (pilot) { g.save(); g.translate(0, -8); g.scale(0.7, 0.7); drawHuman(g, { facing: e.facing, hurtT: 0, attackT: 0 }, pilot); g.restore(); }
    else if (!e.parked) {
      const gob = (x, y, hat, lever) => {
        g.fillStyle = '#6fbf3f'; g.beginPath(); g.arc(x, y, 5.5, 0, 7); g.fill();
        g.beginPath(); g.moveTo(x - 4, y - 2); g.lineTo(x - 10, y - 5); g.lineTo(x - 4, y + 1); g.closePath(); g.moveTo(x + 4, y - 2); g.lineTo(x + 10, y - 5); g.lineTo(x + 4, y + 1); g.closePath(); g.fill();
        g.fillStyle = '#d62828'; g.beginPath(); g.arc(x - 2, y - 1, 1.2, 0, 7); g.arc(x + 2, y - 1, 1.2, 0, 7); g.fill();
        if (hat === 'goggles') { g.fillStyle = '#8a6a3a'; g.beginPath(); g.arc(x, y - 2, 6, Math.PI, 0); g.fill(); g.fillStyle = '#c9ccd3'; g.beginPath(); g.arc(x + 2, y - 2, 2, 0, 7); g.fill(); }
        else if (hat === 'helm') { g.fillStyle = '#5a5a62'; g.beginPath(); g.arc(x, y - 2, 6, Math.PI, 0); g.fill(); }
        if (lever) { g.save(); g.translate(x + 7, y); g.rotate(Math.sin(t * 6) * 0.5 - 0.6); g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -12); g.stroke(); g.fillStyle = '#d62828'; g.beginPath(); g.arc(0, -12, 2.5, 0, 7); g.fill(); g.restore(); }
      };
      gob(-4, -8, null, true); gob(9, -3, 'goggles', false); gob(-8, 7, 'helm', false);
    }
    // pennant
    g.strokeStyle = '#4a3218'; g.lineWidth = 2; g.beginPath(); g.moveTo(2, -14); g.lineTo(2, -48); g.stroke();
    g.fillStyle = '#7a2e2e'; g.beginPath(); g.moveTo(2, -48); g.lineTo(18 + Math.sin(t * 5) * 3, -43); g.lineTo(2, -37); g.closePath(); g.fill();
    // lightning rod: an iron rod bolted to the deck with a glass ball on top. It hums under 35% hp and flares before a volley.
    g.strokeStyle = '#3a3a42'; g.lineWidth = 3; g.beginPath(); g.moveTo(12, -18); g.lineTo(12, -60); g.stroke();
    g.fillStyle = '#8f96a3'; g.fillRect(9, -21, 6, 4); g.fillRect(10, -46, 4, 3);
    const ball = clamp((p3 ? 0.45 + Math.sin(t * 18) * 0.1 : 0.15) + rodGlow * 0.55, 0, 1);
    if (ball > 0.3) { g.fillStyle = `rgba(200,180,255,${(ball - 0.3) * 0.5})`; g.beginPath(); g.arc(12, -64, 9 + rodGlow * 6, 0, 7); g.fill(); }
    g.fillStyle = `rgba(${Math.round(150 + ball * 105)},${Math.round(140 + ball * 100)},255,${0.6 + ball * 0.4})`; g.beginPath(); g.arc(12, -64, 4.5, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(10.5, -65.5, 1.4, 0, 7); g.fill();
    if (rodGlow > 0.5) { g.strokeStyle = `rgba(255,255,255,${(rodGlow - 0.5) * 1.6})`; g.lineWidth = 1.5; for (let k = 0; k < 3; k++) { const a = t * 25 + k * 2.1; g.beginPath(); g.moveTo(12, -64); g.lineTo(12 + Math.cos(a) * 10, -64 + Math.sin(a) * 10); g.lineTo(12 + Math.cos(a + 0.6) * 15, -64 + Math.sin(a + 0.6) * 15); g.stroke(); } }
    // spiked ram, thrust forward on attack
    g.save(); g.rotate(ang); const ext = e.attackT > 0 ? 14 : 0;
    g.fillStyle = '#2e2e36'; g.fillRect(28, -6, 20 + ext, 12); g.fillStyle = '#3a3a42'; g.fillRect(46 + ext, -11, 8, 22);
    g.fillStyle = '#8f96a3'; for (const oy of [-8, 0, 8]) { g.beginPath(); g.moveTo(54 + ext, oy - 3); g.lineTo(63 + ext, oy); g.lineTo(54 + ext, oy + 3); g.closePath(); g.fill(); }
    g.restore();
  };
  HOOKS.hit.push(m => { if (m.type === 'barrelbeast') burst(m.x, m.y - 10, '#8f96a3', 5, 70); });
  // ground mark (drawn at ground level) and the bolt (drawn over everything) for a lightning strike s = {x, y, t, hit}
  const drawBeastMark = (g, s) => {
    const k = Math.min(1, s.t / MARK_TIME), a = 0.35 + Math.sin(s.t * 20) * 0.25 * k;
    g.strokeStyle = `rgba(230,220,255,${a})`; g.lineWidth = 3; g.setLineDash([6, 5]); g.beginPath(); g.arc(s.x, s.y, 40, 0, 7); g.stroke(); g.setLineDash([]);
    g.fillStyle = `rgba(200,180,255,${0.12 + k * 0.3})`; g.beginPath(); g.arc(s.x, s.y, 40 * k, 0, 7); g.fill();
    g.strokeStyle = `rgba(255,255,255,${0.3 + k * 0.5})`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(s.x - 6, s.y); g.lineTo(s.x + 6, s.y); g.moveTo(s.x, s.y - 6); g.lineTo(s.x, s.y + 6); g.stroke();
  };
  const drawBeastBolt = (g, s) => {
    const k = clamp(1 - (s.t - MARK_TIME) / (BOLT_TIME + 0.1), 0, 1), j = (s.x * 7 + s.y * 3) % 5 - 2; // a little jitter per strike so three bolts do not look stamped
    g.beginPath(); g.moveTo(s.x + 26 + j * 4, s.y - 400); g.lineTo(s.x - 12 + j, s.y - 210); g.lineTo(s.x + 12 - j, s.y - 120); g.lineTo(s.x - 6 + j, s.y - 40); g.lineTo(s.x, s.y);
    g.strokeStyle = `rgba(200,180,255,${k * 0.6})`; g.lineWidth = 10; g.stroke(); g.strokeStyle = `rgba(255,255,255,${k})`; g.lineWidth = 4; g.stroke();
    g.fillStyle = `rgba(255,255,255,${k * 0.6})`; g.beginPath(); g.ellipse(s.x, s.y, 40, 16, 0, 0, 7); g.fill();
  };
  // fight logic: enrage every tick, phase 2 sticky bombs under half hp, phase 3 lightning under 35%
  HOOKS.update.push(dt => {
    const hf = HF();
    if (quest.stage === 8 && player.region === 'Hollowford') advanceQuest(9);
    if (quest.stage === 9 && hf.beastKilled) advanceQuest(10);
    if (quest.stage === 10 && hf.rewarded) advanceQuest(11);
    for (const m of monsters) {
      if (hf.freed && m.dead && isJailer(m)) { m.respawnT = Infinity; continue; } // the jailers have nothing left to guard: killed once the crypt is open, they stay dead
      if (m.type !== 'barrelbeast') continue;
      // the square's beast dies once: no new beast in a safe town, no second wreck. A friend's beast streamed from the keeper
      // (remote), the shed's own, and a live one adopted from a keeper who had not killed it yet (awake) are not this rule's.
      // Adopted-awake lasts only while it stands: once the square's beast is down it is the square's again, and stays down
      // (otherwise the core's 600 s timer stood it up in the rebuilt town for ever after a keeper handoff).
      if (m.dead && !m.shed && !m.remote) m.awake = false;
      if (hf.beastKilled && !m.remote && !(window.INSTANCES && INSTANCES.active()) && !m.awake) { if (!m.dead) { m.dead = true; m.deadT = 5; } m.respawnT = Infinity; continue; }
      if (m.dead) continue;
      // enrage: the def's maxHit is what the core melee rolls, so it is rewritten every tick from this (one) beast's hp
      const stacks = beastStacks(m);
      if (stacks > (m.enrage || 0)) { floatText(m.x, m.y - m.r - 30, stacks >= 6 ? 'IT WILL NOT STOP' : 'It grows stronger!', '#ff8a1a', 14); burst(m.x, m.y, '#ff8a1a', 8 + stacks * 2, 100); }
      m.enrage = stacks;
      MONSTER_DEFS.barrelbeast.maxHit = BEAST_BASE.maxHit + Math.min(6, stacks);
      m.speed = Math.round(BEAST_BASE.speed * (1 + Math.min(0.5, stacks * 0.05)));
      const dp = dist(m.x, m.y, player.x, player.y);
      // phase 2: under half hp the cracked boiler spits sticky bombs at a knight within 6 tiles, every ~3 s
      const p2 = m.hp <= m.maxHp * 0.5;
      if (!p2) m.phase2 = false;
      else {
        if (!m.phase2) { m.phase2 = true; m.bombCd = 0.8; floatText(m.x, m.y - m.r - 30, 'The boiler screams!', '#ff8a1a', 14); burst(m.x, m.y - 20, '#ff8a1a', 20, 120); say('Its boiler is cracked. Now it will spit. Keep moving, knight.', 'The Voice'); }
        m.bombCd = (m.bombCd ?? 0.8) - dt;
        if (m.state === 'chase' && !window.__peace && !player.dead && dp <= 6 * TILE && m.bombCd <= 0) {
          m.bombCd = 3; m.attackT = 0.2; const dx = player.x - m.x, dy = player.y - m.y, d = dp || 1, sp = 240;
          projectiles.push({ kind: 'sticky', x: m.x + 10, y: m.y - 14, vx: dx / d * sp, vy: dy / d * sp, t: 0, life: dp / sp, fuse: 1.3, owner: 'monster' });
          m.bombsFired = (m.bombsFired || 0) + 1; burst(m.x + 10, m.y - 20, '#3a3a3a', 6, 60);
        }
      }
      // phase 3: under 35% hp the rod charges (it glows for the last 1.2 s), then every 4 s three marks, then bolts
      const p3 = m.hp <= m.maxHp * 0.35;
      m.strikes = m.strikes || [];
      if (!p3) { m.phase3 = false; m.rodGlow = 0; }
      else {
        if (!m.phase3) { m.phase3 = true; m.voltCd = 2; floatText(m.x, m.y - m.r - 46, 'The rod hums!', '#d8c8ff', 14); burst(m.x + 12, m.y - 64, '#d8c8ff', 14, 120); say('The rod on its back is drinking the sky. When the ground glows, knight, be somewhere else.', 'The Voice'); }
        m.voltCd = (m.voltCd ?? 2) - dt;
        m.rodGlow = clamp(1.2 - m.voltCd, 0, 1);
        if (m.voltCd <= 0 && !window.__peace && !player.dead && dp <= VOLLEY_RANGE) {
          m.voltCd = VOLLEY_EVERY; m.volleys = (m.volleys || 0) + 1;
          const marks = [{ x: player.x, y: player.y }];
          for (let k = 0; k < 2; k++) { const a = Math.random() * Math.PI * 2, r = TILE * (1.25 + Math.random() * 1.75); marks.push({ x: clamp(player.x + Math.cos(a) * r, TILE, (MAP_W - 1) * TILE), y: clamp(player.y + Math.sin(a) * r, TILE, (MAP_H - 1) * TILE) }); }
          for (const p of marks) m.strikes.push({ x: p.x, y: p.y, t: 0, hit: false });
          burst(m.x + 12, m.y - 64, '#ffffff', 20, 160); floatText(m.x, m.y - m.r - 46, 'CRACK', '#d8c8ff', 15);
        }
      }
      for (const s of m.strikes) {
        s.t += dt;
        if (!s.hit && s.t >= MARK_TIME) {
          s.hit = true; burst(s.x, s.y, '#fff7c0', 24, 200); burst(s.x, s.y, '#d8c8ff', 16, 120); sfx('boom');
          if (!player.dead && dist(player.x, player.y, s.x, s.y) < 40) { m.strikeHits = (m.strikeHits || 0) + 1; hurtPlayer(rint(14, 24), s.x, s.y + 1, true); }
          else floatText(s.x, s.y - 20, 'dodged', '#d8c8ff', 13);
        }
      }
      if (m.strikes.some(s => s.t >= MARK_TIME + BOLT_TIME)) m.strikes = m.strikes.filter(s => s.t < MARK_TIME + BOLT_TIME);
    }
  });
  // death: its own wreck (BEAST_WRECK from 32-beast.js; the walker's wreck stands in if that file is missing), a banner, the story moves on
  // This knight's first Barrelbeast is the story (the wreck he can drive, Chapter 4, Old Tam). Every one after it is a War
  // Shed rematch: the def drops and nothing else, the story untouched.
  // Only a knight whose story has reached the beast (stage 9 or later) has it as his first: a friend below that who helped
  // gets the def drops of a spare, and the beast in his own Hollowford still walks for his own fight. A repeat inside this
  // knight's own rest pays nothing (m.noPay, 75-coop: no drops, no purse).
  HOOKS.kill.push(m => {
    if (m.type !== 'barrelbeast') return;
    const hf = HF(), first = firstFor(m);
    m.strikes = []; m.rodGlow = 0; m.enrage = 0; MONSTER_DEFS.barrelbeast.maxHit = BEAST_BASE.maxHit; m.speed = BEAST_BASE.speed;
    burst(m.x, m.y, '#ff8a1a', 40, 220); burst(m.x, m.y, '#3a3a3a', 24, 140);
    if (!first && m.noPay) {
      floatText(player.x, player.y - 44, 'You helped', '#c9d1d9', 14);
      say(`You helped bring it down. Your own reward is ready in ${mmss(restLeft(hf.shedRestUntil))}.`, 'The Voice');
      if (inShed()) bannerQueue = bannerQueue.filter(b => b.text !== 'DUNGEON CLEARED');
      hf.shedUp = false; save(); return;
    }
    if (!first && !hf.beastKilled) {
      // a friend's beast, before this knight's own story got to Hollowford
      levelBanner = { text: 'BEAST DOWN', sub: "Your friend's fight", t: 3.5 };
      if (inShed()) bannerQueue = bannerQueue.filter(b => b.text !== 'DUNGEON CLEARED');
      say(inShed() ? "That was the goblins' spare. The beast in Hollowford still walks, and that one is yours." : "The Barrelbeast falls, but this was your friend's fight. Your own is still ahead of you, in Hollowford.", 'The Voice');
      hf.shedUp = false; hf.shedRestUntil = (player.dayTime || 0) + SHED_REST; save(); return;
    }
    if (first) {
      hf.beastKilled = true;
      // a first fight in the War Shed: the wreck is rolled out beside the door once the knight is outside
      if (window.INSTANCES && INSTANCES.active()) hf.wreckDue = true;
      else {
        const WRECK_T = T.BEAST_WRECK ?? T.WRECK;
        const tx = Math.floor(m.x / TILE), ty = Math.floor(m.y / TILE); let spot = null;
        for (let r = 0; r <= 2 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) if (PLACEABLE_ON.has(tileAt(tx + dx, ty + dy)) && !insideBuilding(tx + dx, ty + dy)) spot = { tx: tx + dx, ty: ty + dy };
        const standing = hf.wreck && [WRECK_T, T.WRECK].includes(tileAt(hf.wreck[0], hf.wreck[1]));
        // the wreck is placed once
        if (spot && !standing) { changeTile(spot.tx, spot.ty, WRECK_T); hf.wreck = [spot.tx, spot.ty]; }
      }
      say('The Barrelbeast tips, groans, and comes apart. Boiler, barrel, four iron legs. The goblin crew runs for the trees. They will build another. They always do.', 'The Voice');
      say('The wreck stays. Six iron bars, ten goblin scrap and two blast powder would set it walking again, with you at the lever. Hollowford is quiet now. Go to the chapel and tell them.', 'The Voice');
    } else if (!inShed()) {
      // a friend's own first fight in Hollowford's square, after this knight broke his own beast: a helping hand, not a
      // shed rematch (no REMATCH WON, no word of the shed); the def drops are his and his valve rests as for a rematch
      levelBanner = { text: 'BEAST DOWN', sub: 'You helped a friend', t: 3.5 };
      say("You helped a friend bring down the Barrelbeast in Hollowford's square. The square is quiet again.", 'The Voice');
    } else {
      hf.shedKills = (hf.shedKills || 0) + 1;
      levelBanner = { text: 'REMATCH WON', sub: hf.shedKills + 1 === 1 ? 'The Barrelbeast, beaten once' : `The Barrelbeast, beaten ${hf.shedKills + 1} times`, t: 3.5 }; sfx('quest');
      // the shed's own DUNGEON CLEARED would come up after this one: it is the same news, said once
      if (inShed()) bannerQueue = bannerQueue.filter(b => b.text !== 'DUNGEON CLEARED');
      say('It comes apart again. The goblins drag the pieces to the back of the shed. They will build it again.', 'The Voice');
    }
    hf.shedUp = false; hf.shedRestUntil = (player.dayTime || 0) + SHED_REST;
    if (first && quest.stage === 9) advanceQuest(10); else save();
  });
  HOOKS.newGame.push(() => { MONSTER_DEFS.barrelbeast.maxHit = BEAST_BASE.maxHit; });

  // ---------- the War Shed: where the goblins build their beasts (an instance behind a door on the camp road) ----------
  if (window.INSTANCES) INSTANCES.define(SHED.id, {
    name: 'The War Shed', sub: 'Where the goblins build their beasts', w: SHED.w, h: SHED.h, dark: false, boss: 'barrelbeast', spawns: [],
    entry: SHED_ENTRY, exit: SHED_EXIT, door: SHED_DOOR, step: SHED_STEP, lateDoor: true,
    // no instance voice: the shed says its own first line on the first visit, fitted to the story (see SHED_VOICE)
    voice: null,
    build: (set) => {
      for (let y = 0; y < SHED.h; y++) for (let x = 0; x < SHED.w; x++) set(x, y, (x === 0 || y === 0 || x === SHED.w - 1 || y === SHED.h - 1) ? T.HWALL : T.FLOOR);
      // the stocks: a 5×3 bed of timber the beast is bolted together on
      for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) set(SHED_HOME.x + dx, SHED_HOME.y + dy, T.RUG);
      // shelves of parts along the walls, a forge and an anvil for the plates, and scrap everywhere a goblin dropped it
      for (const [x, y, t] of [[2, 1, T.SHELF], [3, 1, T.SHELF], [5, 1, T.FORGE], [7, 1, T.ANVIL], [20, 1, T.SHELF], [21, 1, T.SHELF], [23, 1, T.SHELF], [25, 1, T.SHELF],
        [1, 5, T.SHELF], [1, 6, T.SHELF], [1, 12, T.TABLE], [26, 5, T.SHELF], [26, 6, T.SHELF], [26, 12, T.TABLE], [26, 13, T.TABLE],
        [3, 4, T.RUBBLE], [23, 4, T.RUBBLE], [4, 15, T.RUBBLE], [22, 16, T.RUBBLE], [6, 10, T.PLANK], [21, 9, T.PLANK], [8, 16, T.PLANK], [19, 14, T.RUBBLE]]) set(x, y, t);
      set(VALVE_T.x, VALVE_T.y, T_VALVE);
      // the boiler the valve feeds: three cells of the same solid, so E or a tap on the boiler spins the valve too
      for (const [x, y] of BOILER_T) set(x, y, T_VALVE);
    },
  });
  // the shed on the camp road: plank walls with the door on the east face, facing the road. Built once the rest of the
  // world is generated (a wrap of generateWorld, not a world hook): a door laid among the hooks would change what every
  // later hook saw, and so the trees, berries and ash of half the map
  { const _generateWorld = generateWorld;
    generateWorld = function () {
      const r = _generateWorld();
      for (const [x, y] of SHED_WALL) setTile(x, y, T.HWALL);
      if (window.INSTANCES && INSTANCES.placeDoor) INSTANCES.placeDoor(SHED.id);
      return r;
    }; }
  // a Barrelbeast stood up off the stocks: the keeper's (or a lone knight's) own monster; nothing respawns it but the valve
  function spawnShedBeast() {
    if (!inShed() || liveBeast()) return null;
    const d = MONSTER_DEFS.barrelbeast, sp = safeSpot(tc(SHED_HOME.x), tc(SHED_HOME.y), d.r, 'beast') || { x: tc(SHED_HOME.x), y: tc(SHED_HOME.y) };
    const m = { type: 'barrelbeast', x: sp.x, y: sp.y, home: { x: sp.x, y: sp.y }, r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: true, state: 'idle', wanderT: 1,
      wander: { x: 0, y: 0 }, attackCd: 1, hurtT: 0, dead: false, deadT: 0, respawnT: Infinity, facing: { x: 0, y: 1 }, walkT: 0, moving: false, stunT: 0, shed: true, awake: true };
    monsters.push(m); burst(m.x, m.y, '#ff8a1a', 30, 160); burst(m.x, m.y, '#8f96a3', 20, 120); sfx('boom');
    floatText(m.x, m.y - m.r - 30, 'IT STANDS UP', '#ff8a1a', 16);
    return m;
  }
  // this knight's own story beast: not yet broken, and his story has reached Hollowford (stage 9 or later)
  const storyBeast = () => !HF().beastKilled && quest.stage >= 9;
  // a kill that is this knight's first Barrelbeast: his story beast, or (at any stage, as it always was) the square's beast
  // killed on his own game, offline or as the map's keeper. Only a friend's beast (a coop phantom) or a goblin spare in the
  // shed waits for his story to reach Hollowford.
  const firstFor = m => storyBeast() || (!HF().beastKilled && !!m && !m.phantom && !m.shed);
  HOOKS.bossCall = HOOKS.bossCall || {};
  HOOKS.bossCall.war_shed = { map: SHED.id, near: null, name: 'the Barrelbeast', type: 'barrelbeast', rest: SHED_REST, alive: () => !!liveBeast(), wake: () => { spawnShedBeast(); },
    // 75-coop's pay gate: a repeat beast inside this knight's own rest pays nothing
    resting: m => !firstFor(m) && restLeft(HF().shedRestUntil) > 0,
    // the shed's keeper says its beast fell lately: this knight's rematch call is over, and he is told how long
    refused: left => { const hf = HF(); if (hf.beastKilled) { hf.shedUp = false; save(); } shedSeen = true; say(`The crew is still bolting it back together. Ready in ${mmss(left)}.`, 'Boiler valve'); } };
  const callShed = () => window.COOP && COOP.call ? COOP.call(SHED.id, storyBeast()) : (spawnShedBeast(), 'woke');
  function useValve() {
    const hf = HF();
    if (liveBeast()) { say('The beast is already up. Bring it down.', 'Boiler valve'); return; }
    if (!hf.beastKilled) {
      if (quest.stage === 9 && hf.toldShed) { say('The crew laughs, spins the valve, and a Barrelbeast stands up off the stocks.', 'The Voice'); hf.shedUp = true; save(); shedSeen = false; callShed(); return; }
      say(quest.stage >= 9 ? 'The goblin crew laughs at you. Their beast is still walking in Hollowford.' : 'The valve is cold. Nothing on the stocks is finished yet.', 'Boiler valve'); return;
    }
    const left = restLeft(hf.shedRestUntil);
    if (left > 0) { say(`The crew is still bolting it back together. Ready in ${mmss(left)}.`, 'Boiler valve'); return; }
    say('You spin the boiler valve. The crew scatters, the boiler catches, and a new Barrelbeast stands up off the stocks.', 'The Voice');
    hf.shedUp = true; save(); shedSeen = false; callShed();
  }
  HOOKS.use.push(t => { if (t === T_VALVE) { useValve(); return true; } return false; });
  // shedSeen: on this visit, the beast this knight called has stood up on his screen. A beast missing after that is a fight
  // that is over, not an ask that got lost: nothing stands it up again by itself until the valve is spun (or the next visit).
  let shedWaitT = 0, shedCallAt = -1e9, squareQuietT = 0, shedSeen = false, wasInShed = false, shedVisit, shedDownAt = null;
  // the beast this knight called is down, paid or not: a rematch call is spent and his valve rests (a kill that paid him did
  // both already); a first fight stays owed (shedUp) for the valve or the next visit
  const calledBeastDown = () => { const hf = HF(); if (hf.shedUp && hf.beastKilled) { hf.shedUp = false; if (restLeft(hf.shedRestUntil) === 0) hf.shedRestUntil = (player.dayTime || 0) + SHED_REST; save(); } };
  HOOKS.update.push(dt => {
    const hf = HF();
    // in the shed: a beast called and not yet beaten stands up again on the next visit (the keeper or a lone knight makes it;
    // anyone else asks the keeper, once every 5 s until it stands); a beast's body is carried off to the back of the shed
    if (inShed()) {
      // a new visit: the first tick inside, or a leave and a walk back in between two ticks (16-instances stamps lastLeft)
      const key = INSTANCES.get(SHED.id).lastLeft;
      if (!wasInShed || key !== shedVisit) {
        wasInShed = true; shedVisit = key; shedSeen = false; shedDownAt = null;
        if (quest.stage >= 9 && hf.shedVoice !== 'story') { hf.shedVoice = 'story'; say(SHED_VOICE, 'The Voice'); save(); }
        else if (quest.stage < 9 && !hf.shedVoice) { hf.shedVoice = 'early'; say(SHED_VOICE_EARLY, 'The Voice'); save(); }
      }
      const lb = liveBeast();
      if (lb && hf.shedUp) shedSeen = true;
      if (hf.shedUp && !lb && !shedSeen) {
        if (runsHere()) { if (spawnShedBeast()) shedSeen = true; }
        else { shedWaitT += dt; if (shedWaitT >= 2 && (time < shedCallAt || time - shedCallAt >= 5)) { shedCallAt = time; callShed(); } }
      } else shedWaitT = 0;
      // seen fall on the keeper's game (dead in the stream, not just gone from it), and stayed down a while: this knight's
      // own last blow lays the puppet down before the keeper's kill message lands, and a kill that paid him does it first
      if (!runsHere() && shedSeen) {
        if (liveBeast()) shedDownAt = null;
        else if (shedDownAt === null && monsters.some(m => m.type === 'barrelbeast' && m.remote && m.dead && !m.gone)) shedDownAt = time;
        if (shedDownAt !== null && (time < shedDownAt || time - shedDownAt >= 3)) { shedDownAt = null; if (!liveBeast()) calledBeastDown(); }
      }
      if (monsters.some(m => m.type === 'barrelbeast' && m.dead && m.deadT > 1.2 && !m.remote)) { calledBeastDown(); monsters = monsters.filter(m => !(m.type === 'barrelbeast' && m.dead && m.deadT > 1.2 && !m.remote)); }
      return;
    }
    wasInShed = false;
    // a first kill made in the shed: the crew rolls the wreck out beside the door once the knight is back outside
    if (hf.wreckDue) {
      const WRECK_T = T.BEAST_WRECK ?? T.WRECK, spot = WRECK_SPOTS.find(([x, y]) => PLACEABLE_ON.has(tileAt(x, y)));
      if (spot) { changeTile(spot[0], spot[1], WRECK_T); hf.wreck = [spot[0], spot[1]]; burst(tc(spot[0]), tc(spot[1]), '#ffb347', 20, 110); say('The crew rolls your wreck out of the shed and runs.', 'The Voice'); }
      hf.wreckDue = false; save();
    }
    // online at stage 9 with the square already quiet (the map's keeper broke the beast): the crew is building another
    // (close enough to the square that the keeper's stream would show its beast: 24 tiles is the snapshot's reach)
    const friendBrokeIt = window.NET && NET.online() && window.COOP && !COOP.isKeeper() && COOP.map() === 'over' && quest.stage === 9 && !hf.beastKilled && !hf.toldShed && player.region === 'Hollowford'
      && dist(player.x, player.y, tc(HF_BEAST_HOME.x), tc(HF_BEAST_HOME.y)) < 14 * TILE && !liveBeast();
    if (friendBrokeIt) {
      squareQuietT += dt;
      if (squareQuietT >= 4) {
        hf.toldShed = true; save();
        say('The square is quiet. A friend broke the beast here already. But the goblin crew is building another in their War Shed, on the road below their camp. Beat that one, and Hollowford will know.', 'The Voice');
      }
    } else squareQuietT = 0;
  });
  if (HOOKS.mapTarget) HOOKS.mapTarget.push(() => quest.stage === 9 && HF().toldShed && !HF().beastKilled ? { x: SHED_DOOR[0], y: SHED_DOOR[1], label: 'The War Shed', id: 'shed' } : null);
  // drawing: the valve (a red wheel on a pipe out of the boiler wall), the stocks' timber, the shed's scrap roof outside
  function drawValve(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), up = !!liveBeast(), spin = up ? time * 6 : 0;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 16, 16, 5, 0, 0, 7); g.fill();
    // a short pipe down out of the boiler's belly, and the wheel on it
    g.fillStyle = '#4a4a52'; g.fillRect(cx - 5, cy - 34, 10, 36); g.fillStyle = '#5a5a62'; g.fillRect(cx - 5, cy - 34, 3, 36);
    g.fillStyle = '#3a3a42'; g.fillRect(cx - 9, cy + 2, 18, 8);
    g.save(); g.translate(cx, cy - 12); g.rotate(spin);
    g.strokeStyle = '#7a1f1f'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 14, 0, 7); g.stroke();
    g.strokeStyle = '#c0504d'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 14, 0, 7); g.stroke();
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 14, Math.sin(a) * 14); g.stroke(); }
    g.fillStyle = '#e0d070'; g.beginPath(); g.arc(0, 0, 3.5, 0, 7); g.fill();
    g.restore();
  }
  // the boiler: a riveted iron tank across three cells, a firebox that glows (brighter while a beast stands), a gauge, and
  // a chimney pipe up through the shed's top wall that steams while the beast is up
  function drawBoiler(g) {
    const x0 = BOILER_T[0][0] * TILE + 2, x1 = (BOILER_T[2][0] + 1) * TILE - 2, row = BOILER_T[0][1] * TILE, top = row - 30, bot = row + 42, up = !!liveBeast();
    const chx = x1 - 30;
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse((x0 + x1) / 2, bot + 2, (x1 - x0) / 2, 7, 0, 0, 7); g.fill();
    // the chimney pipe, up to the wall
    g.fillStyle = '#3a3a42'; g.fillRect(chx - 6, TILE - 6, 12, top - TILE + 12); g.fillStyle = '#4a4a52'; g.fillRect(chx - 6, TILE - 6, 4, top - TILE + 12);
    g.fillStyle = '#2e2e36'; for (const yy of [TILE + 10, top - 14]) g.fillRect(chx - 8, yy, 16, 5);
    // the tank
    g.fillStyle = '#4a4a52'; roundRect(g, x0, top, x1 - x0, bot - top, 16); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.08)'; roundRect(g, x0 + 6, top + 4, x1 - x0 - 12, 12, 6); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.22)'; roundRect(g, x0 + 4, bot - 16, x1 - x0 - 8, 12, 6); g.fill();
    g.strokeStyle = '#2e2e36'; g.lineWidth = 4; for (const ox of [0.25, 0.5, 0.75]) { const x = lerp(x0, x1, ox); g.beginPath(); g.moveTo(x, top + 2); g.lineTo(x, bot - 2); g.stroke(); }
    g.fillStyle = '#8f96a3'; for (const ox of [0.25, 0.5, 0.75]) for (const yy of [top + 10, (top + bot) / 2, bot - 10]) { g.beginPath(); g.arc(lerp(x0, x1, ox), yy, 2, 0, 7); g.fill(); }
    g.strokeStyle = '#25252b'; g.lineWidth = 2; roundRect(g, x0, top, x1 - x0, bot - top, 16); g.stroke();
    // the firebox door, left of the valve
    const fx = x0 + 22, fy = (top + bot) / 2 - 2, glow = up ? 0.75 + Math.sin(time * 10) * 0.2 : 0.35 + Math.sin(time * 3) * 0.08;
    g.fillStyle = '#2a2a30'; roundRect(g, fx - 13, fy - 11, 26, 22, 4); g.fill();
    g.fillStyle = `rgba(255,${up ? 110 : 150},40,${glow.toFixed(3)})`; for (let k = 0; k < 3; k++) g.fillRect(fx - 9, fy - 7 + k * 6, 18, 3);
    // the pressure gauge, right of the valve: the needle climbs while the beast is up
    const gx = x1 - 24, gy = top + 18;
    g.fillStyle = '#c9a02a'; g.beginPath(); g.arc(gx, gy, 9, 0, 7); g.fill(); g.fillStyle = '#efe6cc'; g.beginPath(); g.arc(gx, gy, 7, 0, 7); g.fill();
    const a = up ? -0.3 + Math.sin(time * 4) * 0.15 : -2.4; g.strokeStyle = '#7a1f1f'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + Math.cos(a) * 6, gy + Math.sin(a) * 6); g.stroke();
    if (up) for (let k = 0; k < 4; k++) { const ph = (time * 0.8 + k * 0.25) % 1; g.fillStyle = `rgba(220,220,230,${(0.45 * (1 - ph)).toFixed(3)})`; g.beginPath(); g.arc(chx + Math.sin(time * 3 + k) * 4, TILE + 4 - ph * 30, 4 + ph * 7, 0, 7); g.fill(); }
  }
  function drawShedScrap(g, tx, ty) {
    const floor = tex[TEX_NAME[T.FLOOR] + (variant[idx(tx, ty)] || 0)] || tex[TEX_NAME[T.FLOOR] + 0];
    if (floor) g.drawImage(floor, tx * TILE, ty * TILE, TILE, TILE);
    drawRubbleProp(g, tx, ty);
  }
  function drawStocks(g) {
    const x0 = (SHED_HOME.x - 2) * TILE, x1 = (SHED_HOME.x + 3) * TILE, y0 = (SHED_HOME.y - 1) * TILE, y1 = (SHED_HOME.y + 2) * TILE;
    g.fillStyle = 'rgba(40,26,14,0.35)'; g.fillRect(x0 + 6, y0 + 6, x1 - x0 - 12, y1 - y0 - 12);
    g.fillStyle = '#5a3a1e';
    for (const yy of [y0 + 4, y1 - 14]) { g.fillRect(x0 + 2, yy, x1 - x0 - 4, 10); g.fillStyle = '#7a5230'; g.fillRect(x0 + 2, yy, x1 - x0 - 4, 3); g.fillStyle = '#5a3a1e'; }
    g.fillStyle = '#8f96a3'; for (let x = x0 + 14; x < x1 - 8; x += 36) for (const yy of [y0 + 9, y1 - 9]) { g.beginPath(); g.arc(x, yy, 2.2, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(143,150,163,0.8)'; g.lineWidth = 2; g.setLineDash([4, 3]);
    for (const [ax, ay, bx, by] of [[x0 + 6, y0 + 8, x0 + 30, y0 + 40], [x1 - 6, y0 + 8, x1 - 30, y0 + 40], [x0 + 6, y1 - 8, x0 + 30, y1 - 40], [x1 - 6, y1 - 8, x1 - 30, y1 - 40]]) { g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
    g.setLineDash([]);
  }
  // the shed from outside: a scrap-iron roof over the two west columns, and goblin planking either side of the door
  function drawShedRoof(g) {
    const x = CMP.x(145) * TILE - 4, y = CMP.y(43) * TILE - 22, w = 2 * TILE + 6, h = 3 * TILE + 22;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 6, y + h - 2, w, 8);
    for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#5a5a62' : '#45454d'; g.fillRect(x, y + k * (h / 8), w, h / 8 - 1.5); }
    g.fillStyle = '#7a3f24'; g.fillRect(x + 8, y + 12, 24, 18); g.fillStyle = '#6e6e78'; g.fillRect(x + 56, y + 70, 30, 16); g.fillStyle = '#8a5a2b'; g.fillRect(x + 14, y + 104, 20, 14);
    g.strokeStyle = '#25252b'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
    g.fillStyle = '#c9ccd3'; for (const [ox, oy] of [[6, 6], [w - 6, 6], [6, h - 6], [w - 6, h - 6], [w / 2, 6], [w / 2, h - 6]]) { g.beginPath(); g.arc(x + ox, y + oy, 2, 0, 7); g.fill(); }
    // a chimney stub with the boiler's smoke: they are building something in there
    g.fillStyle = '#3a3a42'; g.fillRect(x + w - 26, y - 14, 14, 20);
    for (let k = 0; k < 3; k++) { const ph = (time * 0.5 + k * 0.33) % 1; g.fillStyle = `rgba(120,120,130,${0.35 * (1 - ph)})`; g.beginPath(); g.arc(x + w - 19 + Math.sin(time + k) * 4, y - 18 - ph * 40, 5 + ph * 9, 0, 7); g.fill(); }
    const sx = x + w / 2, sy = y + h / 2 + 10;
    g.fillStyle = '#5a3a1e'; g.fillRect(sx - 40, sy - 11, 80, 22); g.strokeStyle = '#2a1e14'; g.lineWidth = 2; g.strokeRect(sx - 40, sy - 11, 80, 22);
    g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#f0d9a0'; g.fillText('WAR SHED', sx, sy + 4);
  }
  function drawShedPlanks(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = '#4a3218'; g.fillRect(x, y, TILE, TILE);
    for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#5e4024' : '#553a20'; g.fillRect(x + 2 + k * 11, y + 1, 10, TILE - 2); }
    g.fillStyle = '#3a3a42'; g.fillRect(x, y + 10, TILE, 4); g.fillRect(x, y + TILE - 14, TILE, 4);
    g.fillStyle = '#8f96a3'; for (const ox of [6, 24, 42]) for (const oy of [12, TILE - 12]) { g.beginPath(); g.arc(x + ox, y + oy, 1.6, 0, 7); g.fill(); }
  }
  HOOKS.draw.push((g, items, cam) => {
    if (inShed()) {
      // the scrap heaps (RUBBLE) lie on the shed's plank floor: the core paints a rubble cell on grass
      for (let y = 1; y < SHED.h - 1; y++) for (let x = 1; x < SHED.w - 1; x++) if (tileAt(x, y) === T.RUBBLE) items.push({ y: -1e9 + 3, scrap: true, draw: () => drawShedScrap(g, x, y) });
      items.push({ y: -1e8 + SHED_HOME.y * TILE + 2, draw: () => drawStocks(g) });
      items.push({ y: BOILER_T[0][1] * TILE + TILE - 6, draw: () => drawBoiler(g) });
      items.push({ y: VALVE_T.y * TILE + TILE - 6, draw: () => drawValve(g, VALVE_T.x, VALVE_T.y) });
      if (!player.dead && !player.mech) items.push({ y: 1e9 + 1, draw: () => { const { tx, ty } = frontTile(player); if (tileAt(tx, ty) === T_VALVE) HK.brackets(g, tx * TILE + 2, ty * TILE + 2, TILE - 4, TILE - 4); } });
      return;
    }
    if (window.__instance) return;
    const x0 = Math.floor(cam.x / TILE), x1 = Math.ceil((cam.x + VW) / TILE), y0 = Math.floor(cam.y / TILE), y1 = Math.ceil((cam.y + VH) / TILE) + 2;
    if (x1 < CMP.x(144) || x0 > CMP.x(148) || y1 < CMP.y(42) || y0 > CMP.y(46)) return;
    for (const [tx, ty] of CMP.pts([[147, 43], [147, 45]])) if (tileAt(tx, ty) === T.HWALL) items.push({ y: -1e8 + ty * TILE + 5, draw: () => drawShedPlanks(g, tx, ty) });
    items.push({ y: CMP.y(45) * TILE + TILE - 2, draw: () => drawShedRoof(g) });
  });

  // ---------- main quest, stages 8–11 ----------
  HOOKS.mainQuest[8] = { text: () => 'Take the road south from the Goblin Camp to Hollowford.', onEnter: () => {
    say('Hollowford lies south of their camp. The road was broken the night it burned. Go and see what is left, knight.', 'Duke Ferrin');
    say('If anyone still lives there, tell them Thistledown has not forgotten them.', 'Duke Ferrin');
  } };
  HOOKS.mainQuest[9] = { text: () => HF().toldShed && !HF().beastKilled ? "A friend broke the beast in Hollowford's square. Beat the one the goblins are building in their War Shed, on the road below their camp." : 'Hollowford is ash. Find the survivors in the chapel, and bring down the Barrelbeast that stamps through the ruins.', onEnter: () => {
    say('Hollowford. Or what the goblins left of it.', 'The Voice');
    say('Listen. That stamping is not the walker you fought. It is bigger. Find the living first. The chapel still has its walls.', 'The Voice');
  } };
  HOOKS.mainQuest[10] = { text: () => 'The Barrelbeast is down. Tell Old Tam in the chapel crypt that Hollowford is safe.', onEnter: () => {
    levelBanner = { text: 'CHAPTER 4 COMPLETE', sub: 'Hollowford', t: 4 }; burst(player.x, player.y, '#ffe066', 30, 160);
  } };
  HOOKS.mainQuest[11] = { text: () => 'Chapter 4 complete. More is being built.', onEnter: () => {
    levelBanner = { text: 'HOLLOWFORD BREATHES', sub: 'The survivors are safe', t: 3.5 };
    say('Chapter 4 is done. What comes after Hollowford is still being built.', 'Fanglands');
  } };

  // ---------- survivors ----------
  NPCS.push(initNpc(HFF.pt({ id: 'tam', name: 'Old Tam', x: 126, y: 88, tunic: '#5a5048', hair: '#d9d0c0', beard: true, role: 'survivor', leader: true })));
  NPCS.push(initNpc(HFF.pt({ id: 'nell', name: 'Nell', x: 128, y: 89, tunic: '#6a4a4a', hair: '#3a2a1a', woman: true, role: 'survivor',
    lines: ["Don't go near the square. It stands in the square.", 'We had a well. It stood on the well.', 'Tam knows what to do. Tam always knows.', 'The goblins barred us in. Scrap iron, bolted through the stone. We can hear it hum when the beast walks past.'],
    after: ["It's really gone? Pip, it's gone!", 'I can hear birds again.', "We'll need planks. So many planks.", 'The bars. Knight, the bars. A hammer would have them off, if you have one.'],
    freed: ['Out. We are OUT. I keep saying it.', 'I am fetching what we saved from the altar. Then the square, and sun.', 'Tam has ideas. Tam always has ideas. Something about a guild.'] })));
  NPCS.push(initNpc(HFF.pt({ id: 'pip', name: 'Pip', x: 126, y: 86, tunic: '#4a5a6a', hair: '#c9843a', role: 'survivor',
    lines: ['I saw it. It has goblins ON it. On TOP of it.', "I'm not scared. Nell is scared.", 'My house had a cellar. I hid under the hatch for two days.', 'The big goblins put bars on the stairs. I tried to squeeze through. My head fits. My shoulders don\'t.'],
    after: ['You broke it! Can I see the wreck? Can I?', "When I'm big I'm going to be a knight.", 'Nell says we can go outside now.', 'Hit the bars! Hit them with a hammer! Three good ones, Tam says.', 'The goblins are building ANOTHER one. In a shed, on the road under their camp. I heard the hammers. You could break that one too!'],
    freed: ['You SMASHED them. Clang, clang, CLANG. I counted.', 'I am allowed in the square now. Nell said. I am going as soon as I find my other shoe.', 'Tam says I can be in the guild. A real one. With a board.', 'The goblins are building ANOTHER one. In a shed, on the road under their camp. I heard the hammers. You could break that one too!'] })));
  HOOKS.talk.survivor = n => {
    const hf = HF();
    if (!n.leader) { say(pick(hf.freed && n.freed ? n.freed : hf.beastKilled ? n.after : n.lines), n.name); return; }
    if (!hf.beastKilled) { say('Keep your voice down, knight. It walks past every hour. A barrel the size of a house on iron legs, and goblins riding on top of it.', n.name); say('It stood on our well. It walked through the chapel wall. Bring it down and Hollowford can breathe again.', n.name); say('They barred us in down here with scrap from their machine. Goblin iron. Nothing breaks it while the beast is near.', n.name); }
    else if (!hf.rewarded) {
      hf.rewarded = true; giveOrDrop('coins', 200, player.x, player.y); giveOrDrop('steel_helm', 1, player.x, player.y); gainXp('defence', 120);
      say("It's down? The Barrelbeast is DOWN? Nell. Pip. Come up, it's down.", n.name);
      say("Here. Two hundred coins, all Hollowford has left, and the captain's steel helm. He'd want a knight to wear it. Thank you.", n.name);
      say('The crew that ran is building another beast in their War Shed, on the road below their camp. If you ever want another go at it.', n.name);
      burst(player.x, player.y, '#f5c542', 24, 120);
      if (quest.stage === 10) advanceQuest(11); else save();
    } else if (hf.freed) say(pick(["We're in the square most of the day now. I come down for what we saved, and for the quiet.", 'A guild, knight. When there is a roof to put it under. Folk who do things, and a board to say what.', "Pip counted your hammer blows. He tells everyone. Three, he says. Three and the bars went.", 'The crew that ran is building another beast in their War Shed, on the road below their camp. If you ever want another go at it.']), n.name);
    else { say("We're digging out the well, once we're past these bars. When Hollowford has a roof again, there'll be a chair in it for you, knight.", n.name); say('The crew that ran is building another beast in their War Shed, on the road below their camp. If you ever want another go at it.', n.name); }
  };
  // the Great Spread's save migration (97-spread), from quest state: freed survivors leave the bars down; the Barrelbeast's
  // wreck lies where it lay (quest.hollowford.wreck, already moved onto the new map by the migration), or on the first
  // free spot by the War Shed, while it still lay there on the old map (SPREAD.remaking.wreckLies; a rebuilt beast is a
  // machine, which the migration parks at the Dozer Bay). Outside a migration it only keeps a wreck that stands.
  HOOKS.remake.push(Object.assign(() => {
    const hf = HF(), WT = T.BEAST_WRECK ?? T.WRECK;
    if (hf.freed) for (const [x, y] of BAR_TILES) if (tileAt(x, y) === T_BARS) changeTile(x, y, T.FLOOR);
    const w = hf.wreck, lies = window.SPREAD && SPREAD.remaking ? !!SPREAD.remaking.wreckLies : false;
    if (!Array.isArray(w) || !lies || tileAt(w[0], w[1]) === WT) return;
    const spot = PLACEABLE_ON.has(tileAt(w[0], w[1])) && !insideBuilding(w[0], w[1]) ? w : WRECK_SPOTS.find(([x, y]) => PLACEABLE_ON.has(tileAt(x, y)));
    if (spot) { changeTile(spot[0], spot[1], WT); hf.wreck = [spot[0], spot[1]]; }
  }, { remakeOf: '20-hollowford' }));
  // the bars: locked while the beast walks; three hammer blows once it is dead
  const breakBars = () => {
    const hf = HF();
    for (const [x, y] of BAR_TILES) if (tileAt(x, y) === T_BARS) changeTile(x, y, T.FLOOR);
    hf.freed = true; hf.barHits = BAR_HITS;
    burst(tc(HFF.x(129)), tc(HFF.y(87)), '#8f96a3', 30, 160); burst(tc(HFF.x(128)), tc(HFF.y(85)), '#8f96a3', 16, 120); sfx('quest');
    levelBanner = { text: 'UNDER THE CHAPEL', sub: 'The survivors are free', t: 3.5 };
    say('The last bolt shears. The bars fold over like a dropped gate. Behind them, three faces, blinking at the light.', 'The Voice');
    say("Knight. KNIGHT. It's open. Nell, Pip, up the steps, go on, go on. Sun. Get some sun.", 'Old Tam');
    say('I am going to the square. I am going to stand in the middle of it.', 'Nell');
    save();
  };
  HOOKS.use.push((t, tx, ty) => {
    if (t === T_BARS) {
      const hf = HF();
      if (!hf.beastKilled) { say('The bars are goblin iron. They hum with the machine nearby.', 'Crypt bars'); return true; }
      if (!hasTool('hammer')) { say('Goblin iron, bolted through the stone. Cold now, and quiet. A hammer would do it.', 'Crypt bars'); return true; }
      hf.barHits = Math.min(BAR_HITS, (hf.barHits || 0) + 1); sfx('anvil'); burst(tc(tx), tc(ty), '#c9ccd3', 10, 110); player.attackT = 0.2;
      if (hf.barHits >= BAR_HITS) breakBars();
      else { floatText(tc(tx), tc(ty) - 30, 'CLANG', '#c9ccd3', 15); notify(`The bolts shear. ${BAR_HITS - hf.barHits} more blow${BAR_HITS - hf.barHits > 1 ? 's' : ''}.`); save(); }
      return true;
    }
    if (t === T_WELL) { say(HF().rewarded ? 'The survivors are clearing the well. Water again, soon.' : 'Cracked and dry. Something very heavy stood on it.', 'The Well'); return true; }
    if (t === T_HATCH) { say(HF().beastKilled ? 'The hatch stands open. Whoever hid here has gone up to the chapel.' : 'A cellar hatch, barred from below. A small voice: "Go away. No. Wait. Are you a knight? The chapel. Tam is in the chapel. Go quietly."', 'Cellar hatch'); return true; }
    if (t === T_BEAM) { notify('A charred roof beam. Still warm.'); return true; }
    return false;
  });

  // ---------- world: torn palisade, road south, the ruined town ----------
  HOOKS.world.push((rnd, api) => {
    const R = HF_REGION, set = api.setTile, at = api.tileAt;
    const SOFT = [T.GRASS, T.DIRT, T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM, T.STUMP, T.SAND];
    const carve = (pts, w, tile) => { for (let s = 0; s < pts.length - 1; s++) { const [ax, ay] = pts[s], [bx, by] = pts[s + 1], steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)); for (let k = 0; k <= steps; k++) { const x = Math.round(ax + (bx - ax) * k / steps), y = Math.round(ay + (by - ay) * k / steps); for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) if (Math.abs(dx) + Math.abs(dy) <= w && SOFT.includes(at(x + dx, y + dy))) set(x + dx, y + dy, tile); } } };
    const fill = (x0, y0, x1, y1, tile) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, tile); };
    // the goblins dragged the Barrelbeast out through the south palisade; the gap is still there
    for (let x = CMP.x(149); x <= CMP.x(151); x++) set(x, CMP.y(40), T.DIRT);
    const ROAD = ATLAS.track('r4_goblin');   // the Goblin Road: the camp's south gap, the goblin bridge, Hollowford's north entry
    carve(ROAD, 1, T.DIRT); api.road(ROAD, T.DIRT, 2, 0.25);
    // clear the town footprint, then scorch it (worst at the centre)
    for (let y = R.y0; y <= R.y1; y++) for (let x = R.x0; x <= R.x1; x++) {
      if ([T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM].includes(at(x, y))) set(x, y, T.GRASS);
      if (at(x, y) !== T.GRASS) continue;
      const d = dist(x, y, HF_SQUARE.x, HF_SQUARE.y) / 18, r = rnd();
      if (r < 0.8 - d * 0.5) set(x, y, T_SCORCH); else if (r < 0.86 - d * 0.45) set(x, y, T.ASHES);
    }
    // streets and the square
    fill(...HFF.box([139, 66, 141, 90]), T.DIRT); fill(...HFF.box([124, 77, 155, 79]), T.DIRT); fill(...HFF.box([135, 75, 145, 83]), T.DIRT); fill(...HFF.box([128, 80, 128, 83]), T.DIRT);
    fill(...HFF.box([135, 84, 143, 90]), T_SCORCH); // the yard where the beast stamps
    // burned houses: broken wall fragments, rubble, ash inside
    const ruin = (x0, y0, x1, y1, door) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const edge = x === x0 || x === x1 || y === y0 || y === y1, corner = (x === x0 || x === x1) && (y === y0 || y === y1), r = rnd();
        if (edge) set(x, y, corner || r < 0.6 ? T.HWALL : r < 0.78 ? T.RUBBLE : T.ASHES);
        else set(x, y, r < 0.12 ? T.RUBBLE : r < 0.5 ? T.ASHES : T_SCORCH);
      }
      set(door[0], door[1], T.ASHES); set(door[0], door[1] + (door[1] === y0 ? 1 : -1), T.ASHES); // doorway and the step inside
    };
    ruin(...HFF.box([126, 68, 131, 73]), HFF.p(128, 73)); ruin(...HFF.box([133, 69, 137, 72]), HFF.p(135, 72)); ruin(...HFF.box([144, 68, 149, 72]), HFF.p(146, 72));
    ruin(...HFF.box([151, 73, 155, 76]), HFF.p(153, 76)); ruin(...HFF.box([144, 84, 149, 88]), HFF.p(146, 84)); ruin(...HFF.box([151, 82, 155, 86]), HFF.p(153, 82));
    set(...HFF.p(135, 70), T.ANVIL); set(...HFF.p(135, 71), T.ASHES);                                 // the smith's anvil survived the fire
    set(HF_HATCH.x, HF_HATCH.y, T_HATCH); set(...HFF.p(146, 71), T.ASHES); set(...HFF.p(147, 71), T.ASHES); // Pip's cellar
    set(...HFF.p(127, 70), T_BEAM); set(...HFF.p(148, 86), T_BEAM); set(...HFF.p(153, 84), T_BEAM);
    // the chapel: stone walls, the east end collapsed, the crypt at the west end still whole
    for (let y = HFF.y(84); y <= HFF.y(91); y++) for (let x = HFF.x(124); x <= HFF.x(133); x++) { const edge = x === HFF.x(124) || x === HFF.x(133) || y === HFF.y(84) || y === HFF.y(91); set(x, y, edge ? T.CWALL : x <= HFF.x(128) ? T.FLOOR : T.ASHES); }
    set(...HFF.p(128, 84), T.DIRT); set(...HFF.p(129, 84), T.DIRT);                          // the doorway, doors long gone
    set(...HFF.p(133, 86), T.RUBBLE); set(...HFF.p(133, 87), T_SCORCH); set(...HFF.p(133, 88), T.RUBBLE); // where the beast walked through the wall
    set(...HFF.p(131, 86), T.RUBBLE); set(...HFF.p(130, 89), T.RUBBLE); set(...HFF.p(132, 88), T_BEAM); set(...HFF.p(131, 85), T_BEAM);
    set(...HFF.p(126, 90), T.TABLE); set(...HFF.p(125, 85), T.SHELF);                         // the altar and what they saved
    for (const [x, y] of BAR_TILES) set(x, y, T_BARS);                    // goblin iron across the crypt steps (Under the Chapel)
    for (const [x, y] of JAILERS) set(x, y, T_SCORCH);                    // the jailers' posts stay clear of stumps
    // the square: cracked well, fallen beams
    set(HF_SQUARE.x, HF_SQUARE.y, T_WELL); set(...HFF.p(136, 76), T_BEAM); set(...HFF.p(144, 82), T_BEAM);
    // burned trees on the outskirts (never beside a street or a doorway)
    for (let i = 0; i < 40; i++) {
      const x = R.x0 + Math.floor(rnd() * (R.x1 - R.x0 + 1)), y = R.y0 + Math.floor(rnd() * (R.y1 - R.y0 + 1));
      if (dist(x, y, HF_SQUARE.x, HF_SQUARE.y) < 12) continue;
      const ok = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => [T.GRASS, T_SCORCH, T.ASHES].includes(at(x + dx, y + dy)));
      if (ok) set(x, y, T.STUMP);
    }
    for (const [x, y] of HFF.pts([[128, 74], [135, 73], [146, 73], [153, 77], [146, 83], [153, 81]])) set(x, y, T_SCORCH); // doorsteps stay clear
    // goblin patrols and the beast
    api.spawnList('goblin', HFF.pts([[140, 70], [133, 78], [148, 78], [153, 89]]));
    api.spawnList('sapper', HFF.pts([[143, 66], [130, 80]]));
    api.spawnList('brute', HFF.pts([[150, 74], [128, 75]]));
    api.spawnList('brute', JAILERS); // the crypt's jailers
    api.spawnList('barrelbeast', [[HF_BEAST_HOME.x, HF_BEAST_HOME.y]]);
  });

  // ---------- Under the Chapel (tiny quest) ----------
  QUEST_DEFS.crypt = { name: 'Under the Chapel' };
  HOOKS.activeQuests.push(() => quest.stage >= 9 && !HF().freed ? ['crypt'] : []);
  HOOKS.questText.crypt = () => { const hf = HF(); return hf.freed ? 'Done.' : !hf.beastKilled ? 'The survivors are barred into the chapel crypt behind goblin iron. It will not break while the Barrelbeast walks.' : `Break the goblin bars in the chapel with a hammer (${Math.min(hf.barHits || 0, BAR_HITS)}/${BAR_HITS} blows).`; };

  // ---------- props ----------
  const drawWell = (g, tx, ty) => {
    const cx = tc(tx), cy = tc(ty), hf = HF();
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx + 2, cy + 14, 22, 9, 0, 0, 7); g.fill();
    g.fillStyle = '#7c7f87'; g.beginPath(); g.ellipse(cx, cy + 4, 21, 14, 0, 0, 7); g.fill();
    g.fillStyle = '#5f626a'; g.beginPath(); g.ellipse(cx, cy + 8, 21, 12, 0, 0, Math.PI); g.fill(); // outer face in shadow
    for (let k = 0; k < 11; k++) { const a = k / 11 * Math.PI * 2; g.fillStyle = ['#8d9098', '#979aa2', '#83868e'][k % 3]; g.beginPath(); g.ellipse(cx + Math.cos(a) * 17, cy + 3 + Math.sin(a) * 10.5, 5, 3.5, a, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.stroke(); }
    g.fillStyle = hf.rewarded ? '#2a3a4a' : '#1e1f24'; g.beginPath(); g.ellipse(cx, cy + 2, 12, 7, 0, 0, 7); g.fill();
    if (hf.rewarded) { g.fillStyle = `rgba(120,180,230,${0.35 + Math.sin(time * 2) * 0.15})`; g.beginPath(); g.ellipse(cx, cy + 3, 8, 4, 0, 0, 7); g.fill(); }
    g.fillStyle = '#3a3330'; g.beginPath(); g.moveTo(cx + 12, cy - 6); g.lineTo(cx + 22, cy + 2); g.lineTo(cx + 13, cy + 8); g.closePath(); g.fill(); // the chunk the beast broke off
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 14, cy + 10); g.lineTo(cx - 8, cy + 4); g.lineTo(cx - 10, cy - 2); g.moveTo(cx + 4, cy + 14); g.lineTo(cx + 8, cy + 9); g.stroke(); // cracks
    g.fillStyle = '#2a1e14'; g.fillRect(cx - 18, cy - 30, 5, 34); g.fillRect(cx + 13, cy - 30, 5, 22);
    g.save(); g.translate(cx - 16, cy - 30); g.rotate(0.35); g.fillStyle = '#4a3218'; g.fillRect(0, -2, 26, 4); g.restore(); // the crossbar hangs broken
    g.strokeStyle = '#c9b676'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx + 6, cy - 22); g.lineTo(cx + 8, cy + 2); g.stroke();
    g.fillStyle = 'rgba(15,12,10,0.4)'; g.beginPath(); g.ellipse(cx - 6, cy - 2, 9, 4, 0.4, 0, 7); g.fill(); // soot
  };
  const drawBeam = (g, tx, ty) => {
    const cx = tc(tx), cy = tc(ty), v = (tx * 5 + ty * 3) % 3;
    g.save(); g.translate(cx, cy + 4); g.rotate(v === 0 ? 0.5 : v === 1 ? -0.7 : 0.15);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(2, 8, 24, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#1f1a17'; g.fillRect(-22, -6, 44, 12); g.fillStyle = '#2c2522'; g.fillRect(-22, -6, 44, 4);
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1; for (let k = -18; k < 20; k += 7) { g.beginPath(); g.moveTo(k, -6); g.lineTo(k + 3, 6); g.stroke(); } // char checks
    for (const [ox, k] of [[-12, 0], [4, 1], [16, 2]]) { g.fillStyle = `rgba(255,${110 + k * 20},40,${0.35 + Math.sin(time * 4 + k * 2 + tx) * 0.3})`; g.beginPath(); g.arc(ox, 1, 1.8, 0, 7); g.fill(); } // embers
    g.restore();
  };
  const drawHatch = (g, tx, ty) => {
    const x = tx * TILE, y = ty * TILE, open = HF().beastKilled;
    g.fillStyle = '#2a1e14'; g.fillRect(x + 5, y + 7, 38, 34);
    if (open) { g.fillStyle = '#0d0b09'; g.fillRect(x + 8, y + 10, 32, 28); g.fillStyle = `rgba(255,200,120,${0.25 + Math.sin(time * 3) * 0.1})`; g.fillRect(x + 10, y + 24, 28, 12); g.fillStyle = '#5a3a1e'; g.fillRect(x + 8, y + 2, 32, 9); g.fillStyle = '#3a3a42'; g.fillRect(x + 10, y + 5, 28, 2); }
    else { for (let k = 0; k < 3; k++) { g.fillStyle = k % 2 ? '#5a3a1e' : '#6b4a2a'; g.fillRect(x + 8, y + 10 + k * 10, 32, 9); } g.fillStyle = '#3a3a42'; g.fillRect(x + 8, y + 13, 32, 3); g.fillRect(x + 8, y + 31, 32, 3); g.strokeStyle = '#8f96a3'; g.lineWidth = 2; g.beginPath(); g.arc(x + 24, y + 25, 4, 0, 7); g.stroke(); }
    g.fillStyle = 'rgba(15,12,10,0.35)'; g.beginPath(); g.ellipse(x + 14, y + 12, 10, 5, 0.3, 0, 7); g.fill(); // soot
  };
  // goblin scrap-iron bars: uneven uprights, a bent cross-brace, rivets, and a faint hum-glow while the beast lives
  const drawBars = (g, tx, ty) => {
    const x = tx * TILE, y = ty * TILE, live = !HF().beastKilled, v = (tx * 7 + ty * 5) % 3;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 4, y + TILE - 8, TILE - 8, 6);
    if (live) { g.fillStyle = `rgba(200,180,255,${0.08 + Math.sin(time * 6 + tx) * 0.05})`; g.fillRect(x + 2, y - 6, TILE - 4, TILE + 6); }
    g.strokeStyle = '#3a3a42'; g.lineWidth = 5; g.lineCap = 'round';
    for (let k = 0; k < 4; k++) { const bx = x + 8 + k * 11 + (v === k ? 2 : 0); g.beginPath(); g.moveTo(bx, y + TILE - 6); g.lineTo(bx + (k === v ? 3 : -1), y - 10); g.stroke(); }
    g.strokeStyle = '#5a5a62'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 4, y + 14 + v * 4); g.lineTo(x + TILE - 4, y + 10 + v * 6); g.stroke();
    g.beginPath(); g.moveTo(x + 4, y + TILE - 12); g.lineTo(x + TILE - 4, y + TILE - 14); g.stroke();
    g.fillStyle = '#8f96a3'; for (let k = 0; k < 4; k++) { const bx = x + 8 + k * 11 + (v === k ? 2 : 0); g.beginPath(); g.arc(bx, y + 12 + v * 5, 2, 0, 7); g.arc(bx, y + TILE - 13, 2, 0, 7); g.fill(); }
    g.fillStyle = '#9fd3ff'; g.beginPath(); g.arc(x + 30 + v * 4, y + 24, 2.2, 0, 7); g.fill(); // a scrap of the beast's own plating, riveted on
    if (live) { g.strokeStyle = `rgba(220,200,255,${0.25 + Math.sin(time * 9 + ty) * 0.2})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 8, y + 2); g.lineTo(x + TILE - 8, y + 4); g.stroke(); }
  };
  const drawSoot = (g, tx, ty, t) => {
    const x = tx * TILE, y = ty * TILE, v = (tx * 7 + ty * 3) % 3;
    const grad = g.createLinearGradient(0, y, 0, y + TILE); grad.addColorStop(0, 'rgba(20,16,14,0.55)'); grad.addColorStop(1, 'rgba(20,16,14,0.18)'); g.fillStyle = grad; g.fillRect(x, y, TILE, TILE);
    g.fillStyle = 'rgba(15,12,10,0.55)'; for (const [ox, oy, r] of [[10 + v * 8, 8, 9], [36 - v * 6, 20 + v * 4, 7], [18 + v * 4, 38, 6]]) { g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.6, v, 0, 7); g.fill(); }
    if (t === T.HWALL) { g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 6, y + 4 + v * 6); g.lineTo(x + 22, y + 20); g.lineTo(x + 16, y + 34); g.lineTo(x + 30, y + 44); g.stroke(); }
  };
  const drawSmoke = (g, tx, ty) => {
    const cx = tc(tx), cy = tc(ty);
    for (let k = 0; k < 2; k++) { const ph = (time * 0.3 + tx * 0.13 + ty * 0.07 + k * 0.5) % 1; g.fillStyle = `rgba(120,120,130,${0.22 * (1 - ph)})`; g.beginPath(); g.arc(cx + Math.sin(time + tx + k) * 6, cy - 6 - ph * 44, 5 + ph * 11, 0, 7); g.fill(); }
  };
  HOOKS.draw.push((g, items, cam) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 2);
    // lightning marks sit on the ground (before anything standing), bolts over everything; the beast can chase past the region box, so this runs before the region cull
    for (const m of monsters) if (m.type === 'barrelbeast' && m.strikes) for (const s of m.strikes) items.push(s.t < MARK_TIME ? { y: -1e8 + s.y + 3, draw: () => drawBeastMark(g, s) } : { y: 1e9 - 1, draw: () => drawBeastBolt(g, s) });
    if (x1 < HF_REGION.x0 || x0 > HF_REGION.x1 || y1 < HF_REGION.y0 || y0 > HF_REGION.y1) return;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      if (t === T_WELL) items.push({ y: ty * TILE + TILE - 6, draw: () => drawWell(g, tx, ty) });
      else if (t === T_BEAM) items.push({ y: ty * TILE + TILE - 8, draw: () => drawBeam(g, tx, ty) });
      else if (t === T_BARS) items.push({ y: ty * TILE + TILE - 4, draw: () => drawBars(g, tx, ty) });
      else if (t === T_HATCH) items.push({ y: ty * TILE - 2 * TILE, draw: () => drawHatch(g, tx, ty) }); // ground level: before anything standing near it
      else if ((t === T.HWALL || t === T.CWALL) && hfIn(tx, ty)) items.push({ y: ty * TILE - 2 * TILE, draw: () => drawSoot(g, tx, ty, t) });
      else if (t === T_SCORCH && hfIn(tx, ty) && (tx * 31 + ty * 17) % 13 === 0) items.push({ y: ty * TILE + TILE + 60, draw: () => drawSmoke(g, tx, ty) });
    }
  });

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const hf = HF(); h.peace(true); projectiles = [];
    { const r = REGIONS.find(r => r.name === 'Hollowford'); const path = F.bfs(...CMP.p(150, 41), ...ATLAS.port('hollowford.heart')), camp = F.bfs(...CMP.p(150, 31), ...CMP.p(150, 41));
      check('Hollowford: region in the south-east, road from the camp gap reaches it', !!r && regionAt(HF_SQUARE.x, HF_SQUARE.y).name === 'Hollowford' && !!path && !!camp && tileAt(...CMP.p(150, 41)) === T.DIRT, { path: path && path.length, camp: camp && camp.length }); }
    { let hw = 0, cw = 0, sc = 0; for (let y = HF_REGION.y0; y <= HF_REGION.y1; y++) for (let x = HF_REGION.x0; x <= HF_REGION.x1; x++) { const t = tileAt(x, y); if (t === T.HWALL) hw++; else if (t === T.CWALL) cw++; else if (t === T_SCORCH) sc++; }
      const s = NPCS.filter(n => n.role === 'survivor');
      check('Hollowford: burned ruins, collapsed chapel, cracked well, cellar, three survivors in the crypt', hw >= 40 && cw >= 20 && sc >= 80 && s.length === 3 && s.every(n => regionAt(n.x, n.y).name === 'Hollowford' && tileAt(n.x, n.y) === T.FLOOR) && tileAt(HF_SQUARE.x, HF_SQUARE.y) === T_WELL && tileAt(HF_HATCH.x, HF_HATCH.y) === T_HATCH, { hw, cw, sc, survivors: s.length }); }
    { const d = MONSTER_DEFS.barrelbeast, bb = monsters.find(m => m.type === 'barrelbeast');
      check('Barrelbeast spawned in Hollowford: lv 28, 400 hp, max hit 16, def 24, speed 55, aggro, sight 7, respawn 600, boss drops', !!bb && d.level === 28 && d.hp === 400 && d.maxHit === 16 && d.def === 24 && d.speed === 55 && d.aggro && d.sight === 7 * TILE && d.respawn === 600 && d.drops.always.length === 4 && d.drops.rare.chance === 3 && regionAt(Math.floor(bb.home.x / TILE), Math.floor(bb.home.y / TILE)).name === 'Hollowford' && typeof HOOKS.drawMonster.barrelbeast === 'function', { found: !!bb, hp: bb && bb.maxHp }); }
    { const before = quest.stage; if (quest.stage < 8) quest.stage = 8; hf.beastKilled = false; hf.rewarded = false; F.tp(...ATLAS.port('hollowford.north')); F.sim(3, []);
      check('entering Hollowford after Chapter 3 opens Chapter 4 (stage 9, area banner)', quest.stage === 9 && player.region === 'Hollowford' && !!areaBanner && areaBanner.name === 'Hollowford', { before, stage: quest.stage, banner: areaBanner && areaBanner.name }); }
    // Under the Chapel: the crypt is barred and two brutes stand outside; before the beast is dead the bars refuse
    { for (const [x, y] of BAR_TILES) if (tileAt(x, y) !== T_BARS) changeTile(x, y, T_BARS); hf.freed = false; hf.barHits = 0;
      const jailers = monsters.filter(isJailer); const noPath = F.bfs(...HFF.p(128, 84), ...HFF.p(126, 88)) === null; const solid = SOLID.has(T_BARS) && BAR_TILES.every(([x, y]) => tileAt(x, y) === T_BARS);
      if (!hasTool('hammer')) h.give('hammer', 1);
      dialog.queue.length = 0; dialog.cur = null; closePanel(); F.tp(...HFF.p(128, 84)); F.face(...HFF.p(128, 85)); F.press('KeyE'); F.sim(2, []); const hum = !!dialog.cur && /goblin iron.*hum/.test(dialog.cur.text);
      check('crypt: goblin bars seal the crypt (7 solid CRYPT_BARS, no path from the door to Tam), two brute jailers outside; before the beast is dead E says they hum', solid && noPath && jailers.length === 2 && hum && barsStand() && !hf.freed && activeQuests().includes('crypt') && /Barrelbeast walks/.test(questText('crypt')), { solid, noPath, jailers: jailers.length, hum, text: dialog.cur && dialog.cur.text, quest: questText('crypt') }); dialog.queue.length = 0; dialog.cur = null; }
    { const bb = monsters.find(m => m.type === 'barrelbeast'); F.tp(...HFF.p(137, 86)); bb.dead = false; bb.hp = 150; bb.phase2 = false; bb.stunT = 0; bb.x = player.x + 4 * TILE; bb.y = player.y; bb.home = { x: bb.x, y: bb.y }; bb.state = 'idle';
      const hp0 = player.hp; player.hp = 5000; h.peace(false); const n0 = bb.bombsFired || 0; F.sim(240, []); const fired = (bb.bombsFired || 0) - n0; const sticky = projectiles.some(p => p.kind === 'sticky' && p.owner === 'monster');
      h.peace(true); projectiles = []; player.hp = Math.min(hp0, player.maxHp); player.hurtT = 0;
      check('Barrelbeast phase 2: under half hp it spits sticky bombs at a knight within 6 tiles', fired >= 1 && bb.phase2 === true, { fired, sticky, state: bb.state, hp: bb.hp }); }
    { const bb = monsters.find(m => m.type === 'barrelbeast'); F.tp(...HFF.p(137, 87)); player.facing = { x: 1, y: 0 }; bb.dead = false; bb.hp = 1; bb.stunT = 0; bb.state = 'idle';
      for (let i = 0; i < 80 && !bb.dead; i++) { bb.x = player.x + 50; bb.y = player.y; bb.stunT = 0; player.attackCd = 0; F.press('Space'); F.sim(3, []); }
      const w = hf.wreck;
      check('Barrelbeast dies into its own wreck (BEAST_WRECK): CHAPTER 4 COMPLETE banner, stage 10', bb.dead && hf.beastKilled && !!w && tileAt(w[0], w[1]) === (T.BEAST_WRECK ?? T.WRECK) && quest.stage === 10 && !!levelBanner && levelBanner.text === 'CHAPTER 4 COMPLETE', { dead: bb.dead, wreck: w, stage: quest.stage, banner: levelBanner && levelBanner.text }); }
    // Under the Chapel: with the beast dead, three hammer blows on the bars free the survivors; they appear in the square at once (31-rebuild keys on freed)
    { const drain = () => { dialog.queue.length = 0; dialog.cur = null; }; if (!hasTool('hammer')) h.give('hammer', 1); hf.freed = false; hf.barHits = 0; for (const [x, y] of BAR_TILES) if (tileAt(x, y) !== T_BARS) changeTile(x, y, T_BARS);
      closePanel(); F.tp(...HFF.p(128, 84)); F.face(...HFF.p(128, 85)); const hits = []; levelBanner = null;
      for (let k = 0; k < 3; k++) { drain(); F.press('KeyE'); F.sim(2, []); hits.push([hf.barHits, barsStand()]); }
      const open = BAR_TILES.every(([x, y]) => tileAt(x, y) === T.FLOOR), path = F.bfs(...HFF.p(128, 84), ...HFF.p(126, 88)), banner = levelBanner && levelBanner.text;
      F.sim(3, []); F.tp(...HFF.p(137, 82)); F.face(...HFF.p(137, 81)); drain(); F.press('KeyE'); F.sim(2, []); const sq = dialog.cur && dialog.cur.who;
      const crypt = NPCS.find(n => n.id === 'pip'); drain(); F.tp(...HFF.p(127, 86)); F.face(...HFF.p(126, 86)); F.press('KeyE'); F.sim(2, []); const freedLine = dialog.cur && crypt.freed.includes(dialog.cur.text);
      check('crypt: after the kill, three E presses with a hammer break the bars (1/3, 2/3, then FLOOR), freed flag + UNDER THE CHAPEL banner, the quest clears, Tam stands in the square at once, the crypt Pip has new lines', hits[0][0] === 1 && hits[0][1] && hits[1][0] === 2 && hits[1][1] && hits[2][0] === 3 && open && hf.freed && !!path && banner === 'UNDER THE CHAPEL' && !activeQuests().includes('crypt') && sq === 'Old Tam' && !!freedLine, { hits, open, freed: hf.freed, path: path && path.length, banner, sq, freedLine, text: dialog.cur && dialog.cur.text }); drain(); }
    { let free = player.inv.filter(s => !s).length; for (let i = player.inv.length - 1; i >= 0 && free < 2; i--) { const s = player.inv[i]; if (s && s.id !== 'coins' && !ITEMS[s.id].weapon && !ITEMS[s.id].armour) { player.inv[i] = null; free++; } }
      const c0 = coins(); const r = F.talk('tam');
      check('survivor leader rewards the knight after the kill: 200 coins + steel helm, stage 11', typeof r === 'number' && hf.rewarded && (coins() === c0 + 200 || drops.some(d => d.id === 'coins' && d.qty === 200)) && (countItem('steel_helm') >= 1 || drops.some(d => d.id === 'steel_helm')) && quest.stage === 11, { r, coins: coins() - c0, helm: countItem('steel_helm'), stage: quest.stage }); }
    { dialog.queue.length = 0; dialog.cur = null; const r1 = F.goAdjacent(HF_HATCH.x, HF_HATCH.y, 3000); F.press('KeyE'); F.sim(2, []); const hatch = dialog.cur && /hatch/.test(dialog.cur.text);
      dialog.queue.length = 0; dialog.cur = null; const r2 = F.goAdjacent(HF_SQUARE.x, HF_SQUARE.y, 3000); F.press('KeyE'); F.sim(2, []); const well = dialog.cur && /well/.test(dialog.cur.text);
      check('the cellar hatch and the cracked well answer E', typeof r1 === 'number' && typeof r2 === 'number' && !!hatch && !!well, { r1, r2, hatch: dialog.cur && dialog.cur.text }); }
    { const st = quest.stage; const texts = [8, 9, 10, 11].map(s => { quest.stage = s; return questText('main'); }); quest.stage = st;
      check('Chapter 4 quest log reads for stages 8–11', texts.every(t => typeof t === 'string' && t.length > 10) && new Set(texts).size === 4 && /Hollowford/.test(texts[0]) && /Barrelbeast/.test(texts[1]) && /Old Tam/.test(texts[2]) && /Chapter 4 complete/.test(texts[3]), { texts }); }
    h.peace(false); projectiles = [];
  });

  // ---------- self-test: the War Shed rematch ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'beast: ';
    if (!window.INSTANCES || !INSTANCES.get(SHED.id)) { check(P + 'the War Shed is defined', false, {}); return; }
    // these fights pay XP like any other: put the skills back afterwards, so the checks after these see the knight the suite had
    const skills0 = JSON.stringify(player.skills), kills0 = player.kills;
    if (INSTANCES.active()) INSTANCES.leave();
    const hf = HF(), keep = { hf: JSON.stringify(hf), stage: quest.stage, day: player.dayTime, hp: player.hp };
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
    const said = re => [dialog.cur, ...dialog.queue].some(l => l && re.test(l.text));
    const WRECKS = [T.BEAST_WRECK, T.BEAST, T.WRECK].filter(t => t !== undefined);
    const wrecks = () => { let n = 0; for (let i = 0; i < map.length; i++) if (WRECKS.includes(map[i])) n++; return n; };
    const enterShed = () => { if (INSTANCES.active()) INSTANCES.leave(); F.tp(SHED_STEP[0], SHED_STEP[1]); F.face(SHED_DOOR[0], SHED_DOOR[1]); drain(); F.press('KeyE'); F.sim(2, []); return inShed(); };
    const valve = () => { F.tp(VALVE_T.x, VALVE_T.y + 1); F.face(VALVE_T.x, VALVE_T.y); drain(); F.press('KeyE'); F.sim(2, []); };
    const beasts = () => monsters.filter(m => m.type === 'barrelbeast' && !m.dead);
    let killedAt = 0;
    const slay = () => { const b = liveBeast(); if (!b) return null; const at = { x: b.x, y: b.y }; const rnd0 = Math.random; try { Math.random = () => 0.9; b.hp = 1; b.stunT = 0; killedAt = player.dayTime || 0; hitMonster(b, 5, 0); } finally { Math.random = rnd0; } F.sim(2, []); return at; };
    const near = (id, at) => drops.filter(d => d.id === id && dist(d.x, d.y, at.x, at.y) < 80).reduce((n, d) => n + d.qty, 0);
    h.peace(true); closePanel();
    try {
      Object.assign(hf, { beastKilled: true, rewarded: true, freed: true, shedUp: false, shedRestUntil: 0, wreckDue: false, toldShed: false }); quest.stage = Math.max(quest.stage, 11);
      // the wrecks standing on the overworld before any of this
      const wOut = wrecks();
      // B1: the door on the camp road
      { const road = F.bfs(...ATLAS.track('r4_goblin')[1].map(Math.round), SHED_STEP[0], SHED_STEP[1]), doorTile = tileAt(SHED_DOOR[0], SHED_DOOR[1]) === T.DUNGEON_DOOR, walls = SHED_WALL.every(([x, y]) => SOLID.has(tileAt(x, y)));
        const rows = window.PLAYTHROUGH ? PLAYTHROUGH.instanceConnectivity().filter(r => r.instance === 'The War Shed') : [];
        const entered = enterShed(), region = player.region;
        check(P + `the War Shed door at (${SHED_DOOR}) with step (${SHED_STEP}) is reachable from the road and enters war_shed; PLAYTHROUGH.instanceConnectivity passes`,
          !!road && doorTile && walls && entered && region === 'The War Shed' && rows.length >= 2 && rows.every(r => r.dist >= 0) && tileAt(VALVE_T.x, VALVE_T.y) === T_VALVE && SOLID.has(T_VALVE) && INTERESTING_TILES.has(T_VALVE),
          { road: road && road.length, doorTile, walls, entered, region, rows: rows.map(r => [r.name, r.dist]) }); }
      // B1b: the scrap heaps lie on the plank floor (the core paints a RUBBLE cell on grass), and on a phone held upright the
      // valve's wheel is in sight: clear of the crest, the quest scroll and both plaque slots, with the camera at the top wall
      { const items = []; for (const d of HOOKS.draw) { try { d(ctx, items, cam); } catch (e) { } }
        let rubble = 0; for (let y = 1; y < SHED.h - 1; y++) for (let x = 1; x < SHED.w - 1; x++) if (tileAt(x, y) === T.RUBBLE) rubble++;
        const scrap = items.filter(i => i.scrap).length;
        const w0 = window.innerWidth, h0 = window.innerHeight, t0 = window.__forceTouch, p0 = { x: player.x, y: player.y };
        let wheel = null, hits = [], camY = null;
        try {
          window.innerWidth = 390; window.innerHeight = 844; window.__forceTouch = true; resize(); F.tp(VALVE_T.x, VALVE_T.y + 1); render();
          const L = HK.FRAME.L; camY = cam.y;
          wheel = { x: tc(VALVE_T.x) - 16 - cam.x, y: tc(VALVE_T.y) - 28 - cam.y, w: 32, h: 32 };
          const over = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          hits = L ? [L.crest, L.scroll].concat(L.plaques || []).filter(r => r && over(wheel, r)) : ['no layout'];
        } finally { window.innerWidth = w0; window.innerHeight = h0; window.__forceTouch = t0; resize(); player.x = p0.x; player.y = p0.y; render(); }
        check(P + "the War Shed's scrap heaps lie on its plank floor (a floor patch under every RUBBLE cell), and at 390x844 the valve's wheel is clear of the crest, the scroll and both plaque slots",
          rubble >= 5 && scrap === rubble && camY === 0 && !!wheel && hits.length === 0, { rubble, scrap, camY, wheel, hits }); }
      // B2: before this knight's own beast is down the crew only laughs
      { hf.beastKilled = false; quest.stage = 11; valve();
        check(P + 'offline, the valve refuses before the first kill (still walking in Hollowford)', beasts().length === 0 && said(/still walking in Hollowford/) && !hf.shedUp, { said: dialog.cur && dialog.cur.text, beasts: beasts().length });
        hf.beastKilled = true; }
      // B3: rested, the valve stands one up on the stocks
      { hf.shedRestUntil = 0; valve(); const b = beasts(), raw = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
        check(P + 'with beastKilled, rewarded and freed and the rest over, the valve spawns exactly one Barrelbeast at the shed home; shedUp saved',
          b.length === 1 && dist(b[0].x, b[0].y, tc(SHED_HOME.x), tc(SHED_HOME.y)) < 2 * TILE && b[0].maxHp === 400 && hf.shedUp && !!(raw.quest && raw.quest.hollowford && raw.quest.hollowford.shedUp === true) && said(/new Barrelbeast stands up/),
          { n: b.length, at: b[0] && [Math.floor(b[0].x / TILE), Math.floor(b[0].y / TILE)], shedUp: hf.shedUp }); }
      // B4: the rematch's purse and nothing of the story
      { const w0 = wOut, wreck0 = JSON.stringify(hf.wreck), k0 = hf.shedKills, st0 = quest.stage; clearBanners(); drops = drops.filter(() => false);
        const at = slay(); const inside = { scrap: near('goblin_scrap', at), iron: near('iron_bar', at), steel: near('steel_bar', at), coins: near('coins', at) };
        const banner = bannerAhead('REMATCH WON') && !bannerAhead('DUNGEON CLEARED'), sub = (levelBanner && levelBanner.sub) || '';
        drops = drops.filter(() => false); INSTANCES.leave(); F.sim(2, []);
        check(P + 'a shed kill gives the def drops, no new wreck or mech tile anywhere, hf.wreck/rewarded/freed and the stage unchanged, banner REMATCH WON, shedKills +1, rest 300 s',
          inside.scrap >= 8 && inside.scrap <= 12 && inside.iron >= 2 && inside.iron <= 4 && inside.steel >= 1 && inside.steel <= 2 && inside.coins >= 80 && inside.coins <= 160
            && wrecks() === w0 && JSON.stringify(hf.wreck) === wreck0 && !hf.wreckDue && hf.rewarded && hf.freed && quest.stage === st0 && banner && sub === (k0 + 2 === 1 ? 'The Barrelbeast, beaten once' : `The Barrelbeast, beaten ${k0 + 2} times`) && hf.shedKills === k0 + 1 && !hf.shedUp && Math.abs(hf.shedRestUntil - killedAt - 300) < 1e-6,
          { inside, wrecks: [w0, wrecks()], banner, sub, kills: hf.shedKills - k0, rest: hf.shedRestUntil - killedAt, stage: [st0, quest.stage] }); }
      // B5: the rest, said in minutes and seconds; save and load keep it
      { const until = hf.shedRestUntil; save(); load(); F.sim(1, []); const kept = HF().shedRestUntil === until;
        enterShed(); valve(); const refused = beasts().length === 0 && said(/still bolting it back together\. Ready in \d+:\d\d\./);
        player.dayTime = until; valve(); const works = beasts().length === 1;
        check(P + 'the valve refuses during the rest with Ready in m:ss and works after; save/load keeps shedRestUntil', kept && refused && works, { kept, refused, works, text: dialog.cur && dialog.cur.text }); }
      // B6: the square beast stays down for good; the shed beast is never put down by beastKilled
      { F.sim(90, []); const shedUp = beasts().length === 1;
        INSTANCES.leave(); save(); load(); const sq = monsters.find(m => m.type === 'barrelbeast');
        if (sq) { delete sq.awake; sq.dead = false; sq.hp = sq.maxHp; sq.respawnT = 0; }
        F.sim(3, []);
        check(P + 'the square beast stays dead after its kill across save/load; the shed beast is never forced dead by beastKilled', shedUp && !!sq && sq.dead && sq.respawnT === Infinity && HF().beastKilled, { shedUp, sq: sq && [sq.dead, sq.respawnT] }); }
      // B7: a beast called and not yet beaten is waiting on the next visit, after a save and a load
      { const up = HF().shedUp; save(); load(); const back = enterShed(); F.sim(2, []);
        check(P + 'save/load with shedUp, then entering the shed, brings the beast back', up && back && beasts().length === 1 && HF().shedUp, { up, back, n: beasts().length });
        slay(); drops = drops.filter(() => false); INSTANCES.leave(); }
      // B8: a friend's first fight (stage 9, told about the shed): the story moves on and the wreck is rolled out beside the shed
      { const hf2 = HF(); const w0 = wrecks(), oldWreck = hf2.wreck;
        Object.assign(hf2, { beastKilled: false, toldShed: true, shedUp: false, wreck: null, rewarded: true }); quest.stage = 9; player.dayTime = hf2.shedRestUntil + 1;
        enterShed(); valve(); const allowed = beasts().length === 1 && said(/crew laughs, spins the valve/);
        const at = slay(); const story = quest.stage >= 10 && hf2.beastKilled && hf2.wreckDue && wrecks() === 0 + (inShed() ? 0 : w0);
        drops = drops.filter(() => false); INSTANCES.leave(); F.sim(3, []);
        const w = hf2.wreck, placed = !!w && WRECK_SPOTS.some(([x, y]) => x === w[0] && y === w[1]) && tileAt(w[0], w[1]) === (T.BEAST_WRECK ?? T.WRECK) && !hf2.wreckDue && wrecks() === w0 + 1;
        check(P + '(stage 9, toldShed, online stub): the valve allows a first fight; the kill gives stage 10 and beastKilled, and one wreck is placed beside the shed on leaving (wreckDue)', allowed && story && placed && !!at,
          { allowed, story, placed, wreck: w, stage: quest.stage, wrecks: [w0, wrecks()] });
        if (w) changeTile(w[0], w[1], T.GRASS); hf2.wreck = oldWreck; hf2.toldShed = false; quest.stage = Math.max(11, keep.stage); }
      // B9: a repeat kill of the square beast (a friend's, adopted alive in a keeper handoff) leaves no wreck, and the square's
      // beast then stays down for good: adopted-awake ends with its death, so the core's 600 s timer never stands it up again
      { const hf3 = HF(); hf3.beastKilled = true; hf3.shedRestUntil = 0; const sq = monsters.find(m => m.type === 'barrelbeast');
        F.tp(...HFF.p(137, 86)); const w0 = wrecks(); clearBanners();
        if (sq) { sq.dead = false; sq.awake = true; sq.hp = 1; sq.x = player.x + 60; sq.y = player.y; sq.stunT = 0; }
        F.sim(1, []); const alive = !!sq && !sq.dead; if (sq) hitMonster(sq, 5, 0); F.sim(2, []);
        // (a friend's beast in the square: BEAST DOWN for the helping hand, never REMATCH WON, which is the shed's)
        const rematch = bannerAhead('BEAST DOWN') && !bannerAhead('REMATCH WON'); F.sim(30, []);
        const down = !!sq && sq.dead && sq.awake === false && sq.respawnT === Infinity;
        const okLoad = (() => { save(); const ok = load(); const s2 = monsters.find(m => m.type === 'barrelbeast'); if (s2) { delete s2.awake; s2.dead = false; s2.hp = s2.maxHp; s2.respawnT = 0; } F.sim(3, []); return ok && !!s2 && s2.dead && s2.respawnT === Infinity; })();
        check(P + 'a repeat kill of the square beast places no wreck; its adopted awake ends with it (dead, awake false, respawnT Infinity, and still down after a reload)', alive && sq.dead && wrecks() === w0 && rematch && down && okLoad,
          { alive, dead: sq && sq.dead, awake: sq && sq.awake, respawnT: sq && sq.respawnT, wrecks: [w0, wrecks()], rematch, okLoad });
        drops = drops.filter(() => false); }
      // B11: a friend's beast before this knight's story reached Hollowford (stage 5): the spare's drops, nothing of the story
      { const hf4 = HF(), st = quest.stage; Object.assign(hf4, { beastKilled: false, toldShed: false, shedUp: false, wreckDue: false, shedRestUntil: 0 }); quest.stage = 5;
        enterShed(); const b = spawnShedBeast(); clearBanners(); drain();
        const ph = window.COOP ? COOP.phantomOf({ type: 'barrelbeast', nid: 'Ann:9', x: b.x, y: b.y }) : null; monsters.splice(monsters.indexOf(b), 1);
        const rnd0 = Math.random; try { Math.random = () => 0.9; if (ph) killMonster(ph); } finally { Math.random = rnd0; } F.sim(2, []);
        const at = { x: b.x, y: b.y }, scrap = near('goblin_scrap', at);
        const spare = { killed: hf4.beastKilled, due: hf4.wreckDue, stage: quest.stage, banner: bannerAhead('BEAST DOWN'), cleared: bannerAhead('DUNGEON CLEARED'), said: said(/goblins' spare/), scrap };
        drops = drops.filter(() => false); INSTANCES.leave(); F.sim(2, []);
        const w0 = wrecks(); quest.stage = 8; const sq = monsters.find(m => m.type === 'barrelbeast'); if (sq) { sq.dead = false; sq.hp = sq.maxHp; sq.respawnT = 0; }
        F.tp(...HFF.p(138, 80)); F.sim(3, []);
        const own = { stage: quest.stage, standing: !!sq && !sq.dead, wrecks: wrecks() - w0 };
        check(P + "a credited shed kill at stage 5 (a friend's fight) gives the spare's def drops only: beastKilled false, no wreck due, stage 5; his Hollowford still runs 8 to 9 with its own beast standing",
          !!ph && !spare.killed && !spare.due && spare.stage === 5 && spare.banner && !spare.cleared && spare.said && spare.scrap >= 8 && own.stage === 9 && own.standing && own.wrecks === 0, { spare, own });
        if (sq) { sq.dead = true; sq.respawnT = Infinity; } hf4.beastKilled = true; quest.stage = Math.max(11, st); }
      // B12: a shed kill inside this knight's own rest (a friend spun the valve) pays nothing at all
      { const hf5 = HF(); Object.assign(hf5, { beastKilled: true, shedUp: false, shedRestUntil: (player.dayTime || 0) + 200 }); enterShed();
        const b = spawnShedBeast(), k0 = hf5.shedKills, until = hf5.shedRestUntil, mx0 = player.skills.melee.xp, dx0 = player.skills.defence.xp, n0 = drops.length; drain(); clearBanners();
        const rnd0 = Math.random; try { Math.random = () => 0; b.hp = 1; b.stunT = 0; hitMonster(b, 5, 0); } finally { Math.random = rnd0; } F.sim(2, []);
        const got = drops.slice(n0).map(d => d.id);
        // (the one 5-damage blow may teach its own 4 xp a point; the kill bonus would be 280 Melee and 112 Defence)
        check(P + "a shed kill inside this knight's own rest pays nothing (no def drops, no dragon item, no kill bonus); shedKills and the rest unchanged; says Your own reward is ready in m:ss",
          b.dead && got.length === 0 && hf5.shedKills === k0 && hf5.shedRestUntil === until && player.skills.melee.xp - mx0 <= 20 && player.skills.defence.xp === dx0 && said(/Your own reward is ready in \d+:\d\d\./) && !bannerAhead('REMATCH WON'),
          { got, kills: hf5.shedKills - k0, rest: hf5.shedRestUntil - until, melee: player.skills.melee.xp - mx0 });
        drops = drops.slice(0, n0); INSTANCES.leave(); }
      // B13: this knight's own valve beast felled by a friend's blow (no kill hook here): the call is spent, the valve rests,
      // and nothing stands it up again on this visit
      { const hf6 = HF(); Object.assign(hf6, { beastKilled: true, shedUp: false, shedRestUntil: 0 }); player.dayTime = (player.dayTime || 0) + 1; enterShed(); valve();
        const b = liveBeast(), up = !!b && hf6.shedUp; const day = player.dayTime || 0; if (b) { b.dead = true; b.deadT = 0; } F.sim(120, []);
        check(P + "this knight's own valve beast felled by a friend's blow clears shedUp, starts his 300 s rest, and no beast stands up again on this visit",
          up && !hf6.shedUp && Math.abs(hf6.shedRestUntil - day - 300) < 3 && !liveBeast(), { up, shedUp: hf6.shedUp, rest: hf6.shedRestUntil - day, again: !!liveBeast() });
        INSTANCES.leave(); }
      // B15: offline, a knight whose story has not reached Hollowford (stage 5) who walks in and kills the square's beast has
      // made his first kill, as it always was (beastKilled, one wreck, the stage left alone), and nobody calls it a friend's fight
      { const hf7 = HF(), st = quest.stage, keep = { wreck: hf7.wreck, map: map.slice(), stats: JSON.stringify(player.skills) };
        Object.assign(hf7, { beastKilled: false, wreckDue: false, shedUp: false, shedRestUntil: 0, wreck: null }); quest.stage = 5;
        const sq = monsters.find(m => m.type === 'barrelbeast' && !m.shed); F.tp(...HFF.p(137, 86)); const w0 = wrecks(); clearBanners(); drain();
        if (sq) { sq.dead = false; delete sq.awake; sq.hp = 1; sq.x = player.x + 60; sq.y = player.y; sq.stunT = 0; }
        F.sim(1, []); const offline = typeof NET === 'undefined' || !NET.online(); if (sq) hitMonster(sq, 5, 0); F.sim(2, []);
        const r = { offline, dead: !!sq && sq.dead, killed: hf7.beastKilled, stage: quest.stage, wrecks: wrecks() - w0, friend: said(/friend/), banner: bannerAhead('BEAST DOWN'), tips: said(/tips, groans, and comes apart/) };
        check(P + "offline at stage 5, the square's beast killed is his first kill as it always was: beastKilled, one wreck, stage stays 5, and no word of a friend",
          r.offline && r.dead && r.killed && r.stage === 5 && r.wrecks === 1 && !r.friend && !r.banner && r.tips, r);
        for (let i = 0; i < map.length; i++) if (map[i] !== keep.map[i]) changeTile(i % MAP_W, Math.floor(i / MAP_W), keep.map[i]);
        hf7.wreck = keep.wreck; hf7.beastKilled = true; quest.stage = st; player.skills = JSON.parse(keep.stats); recomputeMaxHp();
        if (sq) { sq.dead = true; sq.respawnT = Infinity; } drops = drops.filter(() => false); drain(); clearBanners(); }
      // B16: a friend's own first beast in Hollowford's square (a phantom), helped by a knight who broke his own long ago:
      // BEAST DOWN, 'You helped a friend', the def drops; never REMATCH WON or the line about the back of the shed
      { const hf8 = HF(), st = quest.stage; Object.assign(hf8, { beastKilled: true, shedUp: false, shedRestUntil: 0 }); quest.stage = Math.max(11, st);
        if (INSTANCES.active()) INSTANCES.leave(); F.tp(...HFF.p(137, 86)); clearBanners(); drain(); const k0 = hf8.shedKills, n0 = drops.length;
        const ph = window.COOP ? COOP.phantomOf({ type: 'barrelbeast', nid: 'Ann:9', x: player.x + 60, y: player.y }) : null;
        const rnd0 = Math.random; try { Math.random = () => 0.9; if (ph) killMonster(ph); } finally { Math.random = rnd0; } F.sim(2, []);
        const r = { ph: !!ph, banner: bannerAhead('BEAST DOWN'), sub: levelBanner && levelBanner.sub, rematch: bannerAhead('REMATCH WON'), shed: said(/back of the shed/), helped: said(/You helped a friend bring down the Barrelbeast/), kills: hf8.shedKills - k0, scrap: drops.slice(n0).filter(d => d.id === 'goblin_scrap').reduce((n, d) => n + d.qty, 0) };
        check(P + "a friend's first beast in Hollowford's square, helped by a knight who broke his own: BEAST DOWN, 'You helped a friend', the def drops; no REMATCH WON, no shed line, no shed rematch counted",
          r.ph && r.banner && !r.rematch && !r.shed && r.helped && r.kills === 0 && r.scrap >= 8, r);
        drops = drops.slice(0, n0); quest.stage = st; drain(); clearBanners(); }
      // B17: the door is open from a new game, but nothing inside talks about Hollowford before the story burns it (stage 9):
      // a plain first line and a cold valve; at stage 9 the story line once, and never again after it
      { const hf9 = HF(), st = quest.stage, kb = hf9.beastKilled, v0 = hf9.shedVoice; Object.assign(hf9, { beastKilled: false, toldShed: false, shedUp: false, shedVoice: null }); quest.stage = 5;
        const heard = () => [dialog.cur, ...dialog.queue].filter(l => l && l.who === 'The Voice' && /^The War Shed\./.test(l.text)).map(l => l.text);
        drain(); enterShed(); F.sim(2, []); const early = heard(); drain(); valve(); const cold = said(/valve is cold/) && !said(/Hollowford/); INSTANCES.leave(); F.sim(2, []);
        quest.stage = 9; drain(); enterShed(); F.sim(2, []); const story = heard(); INSTANCES.leave(); F.sim(2, []);
        drain(); enterShed(); F.sim(2, []); const again = heard(); INSTANCES.leave(); F.sim(2, []);
        check(P + "before stage 9 the War Shed's first line and its valve never mention Hollowford; at stage 9 the story line plays once, and not on the next visit",
          early.length === 1 && !/Hollowford/.test(early[0]) && cold && story.length === 1 && /drag back from Hollowford/.test(story[0]) && again.length === 0 && hf9.shedVoice === 'story', { early, cold, story, again, v: hf9.shedVoice });
        Object.assign(hf9, { beastKilled: kb, shedVoice: v0 }); quest.stage = st; drain(); }
      // B10: online and not the shed's keeper: the valve asks the keeper and makes nothing itself
      if (typeof NET !== 'undefined' && window.COOP) {
        const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake }; const sent = []; let sock = null;
        const push = msg => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(msg) }); };
        NET.enabled = true; NET.token = 'shed-test';
        NET.useFake({ call: async () => ({}), open: () => { sock = { readyState: 1, send(str) { const mm = JSON.parse(str); sent.push(mm); if (mm.t === 'hello') push({ t: 'welcome', me: 'Cohen', at: 0, keeper: 'Ann' }); }, close() { sock.readyState = 3; } }; return sock; } });
        try {
          NET.connect(); HF().shedRestUntil = 0; HF().shedUp = false;
          enterShed(); push({ t: 'keeper', map: SHED.id, n: 'Ann' }); F.sim(2, []);
          sent.length = 0; valve(); F.sim(30, []);
          const calls = sent.filter(mm => mm.t === 'boss_call');
          check(P + '(fake NET non-keeper): the valve sends boss_call war_shed and spawns nothing', calls.length === 1 && calls[0].id === SHED.id && calls[0].first === undefined && !monsters.some(m => m.type === 'barrelbeast') && HF().shedUp, { calls, n: monsters.filter(m => m.type === 'barrelbeast').length });
          // B14: the shed's keeper answers that its beast fell lately (boss_wait): the rematch call is over, in m:ss
          { drain(); push({ t: 'boss_wait', id: SHED.id, left: 100 }); F.sim(2, []); const waited = !HF().shedUp && said(/still bolting it back together\. Ready in 1:40\./);
            sent.length = 0; F.sim(400, []); const recalls = sent.filter(mm => mm.t === 'boss_call').length;
            // a first fight (stage 9, sent to the shed) asks with the first flag
            const st = quest.stage; Object.assign(HF(), { beastKilled: false, toldShed: true, shedUp: false }); quest.stage = 9; sent.length = 0; F.sim(160, []); valve();
            const first = sent.filter(mm => mm.t === 'boss_call');
            Object.assign(HF(), { beastKilled: true, toldShed: false, shedUp: false }); quest.stage = st;
            check(P + "(fake NET non-keeper): boss_wait ends the rematch call with Ready in 1:40 and nothing asks again by itself; a stage-9 first fight asks with the first flag",
              waited && recalls === 0 && first.length === 1 && first[0].first === true, { waited, recalls, first }); }
          // a friend at stage 9 whose keeper broke the square's beast already: a quiet square for 4 s sends him to the shed
          INSTANCES.leave(); push({ t: 'keeper', map: 'over', n: 'Ann' }); const st9 = quest.stage, hf9 = HF();
          Object.assign(hf9, { beastKilled: false, toldShed: false, shedUp: false }); quest.stage = 9; F.tp(...HFF.p(140, 82)); drain(); F.sim(150, []);
          const early = hf9.toldShed; F.sim(120, []);
          const told = hf9.toldShed && [dialog.cur, ...dialog.queue].some(l => l && /building another in their War Shed/.test(l.text)) && mapTargets().some(t => t.label === 'The War Shed') && /War Shed/.test(questText('main'));
          check(P + '(fake NET non-keeper, stage 9): a quiet square for 4 s tells the knight about the War Shed (toldShed, the map target, the quest line), not before', !early && told, { early, told: hf9.toldShed, text: questText('main') });
          hf9.beastKilled = true; hf9.toldShed = false; quest.stage = st9;
        } finally { if (INSTANCES.active()) INSTANCES.leave(); NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null; COOP.reset(); }
      }
      // B18: online, the shed's keeper: a friend's valve call stands one beast up; once the keeper brings it down the shed rests
      // 300 s on his game, so the friend's next call gets boss_wait (to him alone) and stands nothing up, while a friend's own
      // first fight (the first flag) is not held back
      if (typeof NET !== 'undefined' && window.COOP) {
        const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake }; const sent = []; let sock = null;
        const push = msg => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(msg) }); };
        NET.enabled = true; NET.token = 'shed-keeper-test';
        NET.useFake({ call: async () => ({}), open: () => { sock = { readyState: 1, send(str) { const mm = JSON.parse(str); sent.push(mm); if (mm.t === 'hello') push({ t: 'welcome', me: 'Cohen', at: 0, keeper: 'Cohen' }); }, close() { sock.readyState = 3; } }; return sock; } });
        try {
          NET.connect(); Object.assign(HF(), { beastKilled: true, shedUp: false, shedRestUntil: 0 });
          enterShed(); push({ t: 'keeper', map: SHED.id, n: 'Cohen' }); F.sim(2, []);
          push({ t: 'p', n: 'Bo', map: SHED.id, x: tc(VALVE_T.x), y: tc(VALVE_T.y + 2), def: 500, dead: false, hp: 90, lv: 40 });
          COOP.state.calls = {}; COOP.state.restAt = {};
          push({ t: 'boss_call', n: 'Bo', id: SHED.id }); F.sim(2, []);
          const up = beasts().length === 1;
          slay(); drops = drops.filter(() => false); F.sim(3, []);
          COOP.state.calls = {}; sent.length = 0;
          push({ t: 'boss_call', n: 'Bo', id: SHED.id }); F.sim(2, []);
          const wait = sent.find(mm => mm.t === 'boss_wait'), held = beasts().length === 0;
          COOP.state.calls = {};
          push({ t: 'boss_call', n: 'Bo', id: SHED.id, first: true }); F.sim(2, []);
          const firstUp = beasts().length === 1;
          check(P + "(fake NET keeper): a friend's valve call stands one beast up; after the keeper brings it down, the friend's next call gets boss_wait (to him alone, 298 to 300 s) and stands nothing up; a friend's first fight still does",
            up && !!wait && wait.to === 'Bo' && wait.id === SHED.id && wait.left >= 298 && wait.left <= 300 && held && firstUp, { up, wait, held, firstUp });
          for (const b of beasts()) { b.dead = true; b.deadT = 5; } F.sim(2, []);
        } finally { if (INSTANCES.active()) INSTANCES.leave(); NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null; COOP.reset(); }
      }
    } finally {
      player.skills = JSON.parse(skills0); player.kills = kills0; recomputeMaxHp(); player.hp = Math.min(player.hp, player.maxHp);
      if (INSTANCES.active()) INSTANCES.leave();
      const back = JSON.parse(keep.hf), hfx = HF(); for (const k of Object.keys(hfx)) delete hfx[k]; Object.assign(HF(), back);
      quest.stage = keep.stage; player.dayTime = keep.day; player.hp = Math.min(player.maxHp, Math.max(1, keep.hp));
      drain(); closePanel(); h.peace(false); save();
    }
  });
}
