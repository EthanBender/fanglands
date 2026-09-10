// ============================================================================
// THE STORM AND THE GATE — two reshapes the owner asked for, in one feature file.
//
//  A. THE STORM (36-skycity's way up)
//     "In the sky kingdom I think there should be a storm bit of it, where there is a storm boss,
//      and you do it in the quest of getting up to the Skylands."
//     The wind flute alone no longer opens Aerie. Played at the wind shrine it lifts the knight into
//     THE STORM: a black deck of thunderhead with the Thunderbird turning in it. Its trick is the
//     lesson: the lightning falls where you STOOD a moment ago (1.1 s), so a knight who stands still
//     is hit and a knight who keeps his feet moving is never touched. Every 12 s it climbs into the
//     cloud where no sword reaches and drives the bolts twice as fast — then it has to drop onto one
//     of the three iron masts to gather itself, and while it is perched it is stunned and takes
//     DOUBLE damage. Run, then punish. Break it and the updraft at the north carries you up to
//     Aerie; the shrine goes straight up ever after. (Nothing here copies The Fang, which cycles
//     four elements and strikes where you ARE.)
//     One kindness, on purpose, for a ten-year-old: the storm remembers. Whatever you took off the
//     Thunderbird stays off it — die, or step off the edge, and it is exactly as torn when you come
//     back up (quest.storm.birdHp). A hard boss you can chip down beats a hard boss that resets.
//
//  B. THE CITY GATE (33-goblincity's opening)
//     "Change the Tinkerton quest where you unlock that boss. The tinker tends at a corner of the
//      gate, and you talk to him, you get into the city, you make friends with the goblins, help
//      them get parts."
//     Grubmarket now has a stone wall and one gate on the road up from Harl's landing, and the gate
//     is shut to knights: two goblins hold the leaves and turn you back. Tinkerton tends the gate
//     lamp at the south corner of it, OUTSIDE, and talking to him is the only way in — he calls you
//     his helper, the winch squeals, and the four errands in the market are how you make friends
//     with the goblins. The Gnasher is still what all of it builds to.
//
// Split of work: everything new lives here. src/36-skycity.js only hands the shrine over to
// STORM.shrine() and exports liftToAerie; src/33-goblincity.js only moves Tinkerton to the gate
// corner, rewrites what he says and counts the friends made; src/42-playthrough.js's story bot was
// taught to cross the storm, because the Duke will not form the Dragon Killers until the Song of
// Above is sung and the Song is now behind the Thunderbird. The gate tile is walkable ground —
// what stops you is the goblins holding it, which is why every BFS in the audits still crosses it.
// Feature file: registers through HOOKS only, edits no core file.
// ============================================================================
{
  // ======================================================================
  // A. THE STORM
  // ======================================================================

  // ---------- tiles ----------
  const DECK = addTile('STORM_DECK', { tex: 'sand', mini: '#49536b' });                      // thunderhead you can walk on
  const VOID = addTile('STORM_VOID', { solid: true, tex: 'water', mini: '#20263a' });        // torn air, and a very long way down
  const MAST = addTile('STORM_MAST', { solid: true, tex: 'wall', mini: '#8a8f98' });         // an old sky-fisher's mast: the bird's perch
  const UPDRAFT = addTile('STORM_UPDRAFT', { solid: true, tex: 'sand', mini: '#dff0ff' });   // the way up to Aerie
  const DOWNDRAFT = addTile('STORM_DOWN', { solid: true, tex: 'sand', mini: '#9ac2ff' });    // the way back down to the shrine
  for (const t of [MAST, UPDRAFT, DOWNDRAFT]) INTERESTING_TILES.add(t);                      // a tap on the iPad walks to them and uses them

  // ---------- geometry ----------
  const ST = { id: 'stormfront', name: 'The Storm', sub: 'Black cloud, and something turning in it', w: 40, h: 26 };
  const ENTRY = [20, 22], DOWN_T = [20, 24], UP_T = [20, 2];
  const MASTS = [[10, 9], [30, 9], [20, 17]];
  const BIRD_HOME = [20, 11];
  const HOLES = [[13, 6], [27, 6], [8, 14], [32, 14], [15, 19], [25, 19], [16, 8], [23, 8]]; // 2×2 tears to run around
  const inStorm = () => !!(window.INSTANCES && INSTANCES.active() === ST.id);
  const bird = () => monsters.find(m => m.type === 'thunderbird' && !m.dead) || null;

  // ---------- the fight's numbers ----------
  const HUNT_FOR = 12, HIGH_FOR = 6, PERCH_FOR = 5;   // seconds in each phase
  const BOLT_HUNT = 1.7, BOLT_HIGH = 0.9;             // seconds between bolts
  const MEM = 1.1;                                    // the bolt falls where you stood this long ago
  const WARN = 0.8;                                   // the ring on the cloud before it lands
  const BOLT_R = 34, BOLT_DMG = [8, 14];

  // ---------- items ----------
  ITEMS.storm_feather = { name: 'Storm feather', value: 400, color: '#cfe6ff', shape: 'silk', stack: 1 };
  ITEMS.storm_feather.id = 'storm_feather';

  // ---------- the Thunderbird ----------
  MONSTER_DEFS.thunderbird = {
    name: 'The Thunderbird', level: 40, r: 26, hp: 340, att: 40, maxHit: 14, def: 34, speed: 155, aggro: true, sight: 11 * TILE, respawn: 1e9,
    drops: { always: [['coins', 400, 400], ['storm_feather', 1, 1]].concat(ITEMS.cloud_essence ? [['cloud_essence', 3, 3]] : []) },
  };
  // a black storm-bird twice a knight's height: long beating wings with lightning in the feathers,
  // a fanned tail, a hooked beak and two white eyes. High in the cloud it is drawn lifted and pale;
  // perched on a mast the wings fold and it sparks.
  HOOKS.drawMonster.thunderbird = (g, e, hurt) => {
    const t = time, ph = e.phase || 'hunt', high = ph === 'high', perch = ph === 'perch';
    const lift = high ? 34 : perch ? 10 : 0;
    const beat = perch ? 0.05 : Math.sin(t * (high ? 5 : 3.4)) * (high ? 0.55 : 0.4);
    const dark = hurt ? '#ffb0b0' : high ? '#4a5470' : '#23283a', mid = hurt ? '#ffd0d0' : high ? '#5d6890' : '#31384f';
    const spark = perch ? 0.85 : 0.45;
    // the shadow it throws on the cloud
    g.fillStyle = `rgba(10,14,26,${high ? 0.18 : 0.3})`; g.beginPath(); g.ellipse(0, 14, 26 + lift * 0.3, 9, 0, 0, 7); g.fill();
    g.save(); g.translate(0, -lift);
    g.rotate(Math.atan2(e.facing.y, e.facing.x));
    // wings: three long feather fingers a side, beating
    for (const s of [-1, 1]) {
      const sp = s * (1 + beat);
      g.fillStyle = dark;
      g.beginPath(); g.moveTo(2, s * 6); g.quadraticCurveTo(-14, sp * 34, -40, sp * 46); g.quadraticCurveTo(-16, sp * 22, -4, s * 8); g.closePath(); g.fill();
      g.fillStyle = mid;
      g.beginPath(); g.moveTo(4, s * 4); g.quadraticCurveTo(-4, sp * 30, -22, sp * 44); g.quadraticCurveTo(-6, sp * 20, 0, s * 6); g.closePath(); g.fill();
      // lightning in the feathers
      g.strokeStyle = `rgba(255,247,192,${spark + Math.sin(t * 14 + s) * 0.25})`; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(0, s * 6); g.lineTo(-10, sp * 18); g.lineTo(-6, sp * 24); g.lineTo(-20, sp * 38); g.stroke();
    }
    // tail
    g.fillStyle = dark; g.beginPath(); g.moveTo(-12, -9); g.lineTo(-42, -16); g.lineTo(-46, 0); g.lineTo(-42, 16); g.lineTo(-12, 9); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,247,192,0.35)'; g.lineWidth = 1; for (const o of [-8, 0, 8]) { g.beginPath(); g.moveTo(-14, o * 0.8); g.lineTo(-42, o); g.stroke(); }
    // body and breast
    g.fillStyle = dark; g.beginPath(); g.ellipse(-2, 0, 22, 15, 0, 0, 7); g.fill();
    g.fillStyle = mid; g.beginPath(); g.ellipse(4, 2, 14, 10, 0, 0, 7); g.fill();
    // head, beak, eyes
    g.fillStyle = dark; g.beginPath(); g.arc(20, -2, 10, 0, 7); g.fill();
    g.fillStyle = '#e8c37a'; g.beginPath(); g.moveTo(27, -5); g.lineTo(42, 1); g.lineTo(27, 4); g.closePath(); g.fill();
    g.fillStyle = '#c9a05a'; g.beginPath(); g.moveTo(33, -1); g.lineTo(42, 1); g.lineTo(33, 2); g.closePath(); g.fill();
    const eg = 0.75 + Math.sin(t * 9) * 0.25;
    for (const s of [-1, 1]) { g.fillStyle = `rgba(255,255,235,${eg})`; g.beginPath(); g.arc(24, s * 4.5, 2.6, 0, 7); g.fill(); g.fillStyle = '#1b1b20'; g.beginPath(); g.arc(24.8, s * 4.5, 1.1, 0, 7); g.fill(); }
    g.restore();
    // the charge it carries: sparks jumping off it, thickest while it is perched and gathering
    for (let k = 0; k < (perch ? 5 : 3); k++) {
      const a = t * 3 + k * 2.3, r = 26 + Math.sin(t * 6 + k) * 8;
      g.strokeStyle = `rgba(255,247,192,${spark * (0.4 + Math.sin(t * 11 + k) * 0.3)})`; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.7 - lift); g.lineTo(Math.cos(a) * (r + 9), Math.sin(a) * (r + 9) * 0.7 - lift - 4); g.stroke();
    }
  };

  // ---------- state ----------
  const freshStorm = () => ({ beaten: false, taught: false, bolts: 0, dodged: 0, hits: 0, kills: 0, birdHp: null });
  const StQ = () => { let q = quest.storm; if (!q || typeof q !== 'object') q = quest.storm = freshStorm(); return q; };
  const trail = [];     // where the knight has been: {x, y, t}
  const strikes = [];   // pending lightning: {x, y, t, hit}
  let flash = 0;

  // ---------- the instance ----------
  const inDeck = (x, y) => { const dx = (x - 20) / 17, dy = (y - 12) / 10.5; return dx * dx + dy * dy <= 1 + Math.sin(x * 1.7 + y * 1.1) * 0.06; };
  function buildStorm(set) {
    for (let y = 0; y < ST.h; y++) for (let x = 0; x < ST.w; x++) set(x, y, inDeck(x, y) ? DECK : VOID);
    for (const [x, y] of HOLES) for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) set(x + dx, y + dy, VOID);
    // the spine and the crossbar are carved last: the way up, the way down and the three masts always join
    for (let y = 2; y <= 24; y++) set(20, y, DECK);
    for (let x = 6; x <= 34; x++) set(x, 12, DECK);
    for (let y = 9; y <= 12; y++) { set(10, y, DECK); set(30, y, DECK); }
    for (let y = 12; y <= 17; y++) set(20, y, DECK);
    for (let y = 21; y <= 24; y++) for (let x = 19; x <= 21; x++) set(x, y, DECK);
    for (const [x, y] of MASTS) set(x, y, MAST);
    set(BIRD_HOME[0], BIRD_HOME[1], DECK);
    set(UP_T[0], UP_T[1], UPDRAFT); set(DOWN_T[0], DOWN_T[1], DOWNDRAFT);
  }
  const stormInst = INSTANCES.define(ST.id, {
    name: ST.name, sub: ST.sub, w: ST.w, h: ST.h, dark: false, build: buildStorm, boss: 'thunderbird',
    spawns: [['thunderbird', BIRD_HOME[0], BIRD_HOME[1]]], entry: ENTRY,
    voice: 'The wind carries you into the black. This is not weather, knight — something lives in it, and it has been keeping the winged folk indoors. Watch the cloud under your boots.',
  });
  stormInst.tiles[ENTRY[1] * ST.w + ENTRY[0]] = DECK; // define() paints the entry tile CAVE; a cloud has no cave floor

  // ---------- the way in: the wind shrine hands over to us (36-skycity calls this) ----------
  function shrine() {
    if (StQ().beaten) return false;                    // the storm is broken: 36-skycity lifts you straight up
    if (INSTANCES.active()) return false;
    const step = (window.SKYCITY && SKYCITY.STEP_T) ? [SKYCITY.STEP_T.x, SKYCITY.STEP_T.y] : null;
    if (!INSTANCES.enter(ST.id, step)) { notify('The wind stirs, but will not lift you now.'); return true; }
    burst(player.x, player.y, '#9ecbff', 40, 220); burst(player.x, player.y, '#ffffff', 16, 130); sfx('levelup');
    say('The flute sings and the wind answers — and carries you up into the black. The winged folk will not fly through this. Aerie is on the far side of it.', 'The Voice');
    save(); return true;
  }
  function toAerie() {
    INSTANCES.leave();
    if (window.SKYCITY && typeof SKYCITY.liftToAerie === 'function' && SKYCITY.liftToAerie('storm')) return true;
    notify('The updraft dies away. Play the flute at the shrine again.'); return false;
  }

  // ---------- lightning ----------
  function memoryPoint() {
    if (!trail.length) return { x: player.x, y: player.y };
    let best = trail[0];
    for (const s of trail) if (Math.abs(s.t - MEM) < Math.abs(best.t - MEM)) best = s;
    return best;
  }
  function callBolt(m) {
    const p = memoryPoint();
    strikes.push({ x: p.x, y: p.y, t: 0, hit: false });
    StQ().bolts++;
    if (m) { m.attackT = 0.2; m.bolts = (m.bolts || 0) + 1; }
    burst(p.x, p.y, '#9ecbff', 6, 40);
  }
  function nearestMast(m) {
    let best = MASTS[0], bd = Infinity;
    for (const [x, y] of MASTS) { const d = dist(m.x, m.y, tc(x), tc(y)); if (d < bd) { bd = d; best = [x, y]; } }
    return best;
  }
  function setPhase(m, p) {
    m.phase = p; m.phaseT = 0;
    if (p === 'high') {
      m.boltCd = 0.35; m.stunT = 0.2; m.perchAt = null;
      burst(m.x, m.y, '#9ecbff', 24, 150); sfx('open');
      floatText(m.x, m.y - m.r - 34, 'INTO THE CLOUD', '#9ecbff', 15);
    } else if (p === 'perch') {
      const [mx, my] = nearestMast(m);
      m.perchAt = { x: tc(mx), y: tc(my) - 12 }; m.x = m.perchAt.x; m.y = m.perchAt.y;
      m.boltCd = 99; m.stunT = 0.2;
      burst(m.x, m.y, '#ffe066', 22, 130); sfx('mine');
      floatText(m.x, m.y - m.r - 34, 'PERCHED — HIT IT NOW', '#ffe066', 16);
    } else {
      m.boltCd = 0.9; m.stunT = 0; m.perchAt = null; m.angry = true; m.state = 'chase';
      burst(m.x, m.y, '#3a3a5a', 18, 120);
      floatText(m.x, m.y - m.r - 34, 'IT IS DOWN AGAIN', '#c9d1d9', 14);
    }
  }

  HOOKS.update.push(dt => {
    if (!inStorm()) { if (trail.length || strikes.length) { trail.length = 0; strikes.length = 0; flash = 0; } return; }
    flash = Math.max(0, flash - dt * 3.4);
    // the knight's own trail: where he was, a moment at a time
    if (!player.dead) trail.push({ x: player.x, y: player.y, t: 0 });
    for (const s of trail) s.t += dt;
    while (trail.length && trail[0].t > MEM + 0.7) trail.shift();
    // the bolts already called
    const q = StQ();
    for (const s of strikes) {
      s.t += dt;
      if (!s.hit && s.t >= WARN) {
        s.hit = true; flash = 1; sfx('boom');
        burst(s.x, s.y, '#fff7c0', 26, 210); burst(s.x, s.y, '#9ecbff', 16, 130);
        if (!player.dead && dist(player.x, player.y, s.x, s.y) < BOLT_R) { q.hits++; hurtPlayer(rint(BOLT_DMG[0], BOLT_DMG[1]), s.x, s.y + 1, true); }
        else { q.dodged++; floatText(s.x, s.y - 18, 'behind you', '#9ecbff', 13); }
        if (!q.taught) { q.taught = true; say('Watch the ring on the cloud, knight: the bolt falls where you WERE, not where you are. Keep your feet moving and it lands behind you.', 'The Voice'); }
      }
      if (s.t >= WARN + 0.45) s.done = true;
    }
    for (let i = strikes.length - 1; i >= 0; i--) if (strikes[i].done) strikes.splice(i, 1);
    // the bird
    const m = bird(); if (!m) return;
    if (!m.phase) {
      m.phase = 'hunt'; m.phaseT = 0; m.boltCd = 1.2;
      // the storm remembers: what you took off it last time is still off it
      if (typeof q.birdHp === 'number' && q.birdHp > 0 && q.birdHp < m.maxHp) {
        m.hp = q.birdHp; m.hurtT = 0.3;
        floatText(m.x, m.y - m.r - 34, 'STILL WOUNDED', '#ffe066', 15);
        say('The Thunderbird is torn where you left it. It has not healed, and it has not forgotten you.', 'The Voice');
      }
    }
    q.birdHp = Math.max(0, Math.round(m.hp));
    m.phaseT += dt; m.boltCd -= dt;
    const live = !window.__peace && !player.dead;
    if (m.phase === 'hunt') {
      if (live && m.boltCd <= 0) { m.boltCd = BOLT_HUNT; callBolt(m); }
      if (m.phaseT >= HUNT_FOR) setPhase(m, 'high');
    } else if (m.phase === 'high') {
      m.stunT = Math.max(m.stunT || 0, 0.2);   // a stunned monster is left alone by the core: up there no sword reaches it
      const dx = player.x - m.x, dy = player.y - m.y, d = Math.hypot(dx, dy) || 1;
      if (d > 40) { m.x += dx / d * 70 * dt; m.y += dy / d * 70 * dt; }
      m.facing = { x: dx / d, y: dy / d }; m.moving = true; m.walkT += dt * 6;
      if (live && m.boltCd <= 0) { m.boltCd = BOLT_HIGH; callBolt(m); }
      if (m.phaseT >= HIGH_FOR) setPhase(m, 'perch');
    } else {
      m.stunT = Math.max(m.stunT || 0, 0.2);
      if (m.perchAt) { m.x = m.perchAt.x; m.y = m.perchAt.y; }
      m.moving = false;
      if (m.phaseT >= PERCH_FOR) setPhase(m, 'hunt');
    }
  });

  // in the cloud it cannot be touched; on the mast every hit lands twice
  HOOKS.hit.push((m, dmg) => {
    if (m.type !== 'thunderbird' || !(dmg > 0)) return;
    if (m.phase === 'high') { m.hp += dmg; m.hurtT = 0; floatText(m.x, m.y - m.r - 12, 'too high', '#9ecbff', 14); return; }
    if (m.phase === 'perch') { m.hp -= dmg; floatText(m.x, m.y - m.r - 22, 'DOUBLE', '#ffe066', 15); burst(m.x, m.y, '#ffe066', 8, 90); }
  });

  HOOKS.kill.push(m => {
    if (m.type !== 'thunderbird') return;
    const q = StQ(), first = !q.beaten;
    q.beaten = true; q.kills = (q.kills || 0) + 1; q.birdHp = null;
    strikes.length = 0; flash = 1;
    for (const [c, n, s] of [['#fff7c0', 44, 250], ['#9ecbff', 30, 180], ['#3a3a5a', 24, 140]]) burst(m.x, m.y, c, n, s);
    levelBanner = { text: 'THE STORM BREAKS', sub: first ? 'The way up to Aerie is open' : 'The Thunderbird falls again', t: 4.5 }; sfx('quest');
    say('The Thunderbird folds and falls out of its own storm. The black thins, the thunder walks away east, and at the north end of the cloud a column of clean air opens straight up.', 'The Voice');
    if (first) say('That is the storm the winged folk would not fly through. Take the updraft, knight. Aerie is above you.', 'The Voice');
    save();
  });

  // ---------- E on our tiles ----------
  HOOKS.use.push((t, tx, ty) => {
    if (!inStorm()) return false;
    if (t === UPDRAFT) {
      if (!StQ().beaten) { say('The updraft is choked with black cloud. Whatever is turning in this storm has to come down first.', 'The Storm'); return true; }
      toAerie(); return true;
    }
    if (t === DOWNDRAFT) { INSTANCES.leave(); notify('You step off the edge, and the wind sets you down by the shrine.'); return true; }
    if (t === MAST) { notify('An iron mast, bent. The sky-fishers left them standing here. Something heavy roosts on this one.'); return true; }
    if (t === VOID) { notify('Torn air. A very long way down.'); return true; }
    if (t === DECK) { notify('Thunderhead. It holds your weight, and it hums.'); return true; }
    return false;
  });

  // ---------- drawing the storm ----------
  const hash = (x, y) => ((Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0) / 4294967296;
  function drawDeck(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, r = hash(tx, ty);
    g.fillStyle = '#49536b'; g.fillRect(x, y, TILE, TILE);
    g.fillStyle = 'rgba(120,134,170,0.55)';
    for (const [ox, oy, rr] of [[12 + r * 8, 14, 12], [30, 22 + r * 6, 14], [20, 34, 11], [38, 10, 8]]) { g.beginPath(); g.arc(x + ox, y + oy, rr, 0, 7); g.fill(); }
    g.fillStyle = `rgba(20,24,38,${0.2 + r * 0.15})`; g.beginPath(); g.ellipse(x + 26, y + 30, 15, 6, 0, 0, 7); g.fill();
    const below = tileAt(tx, ty + 1), right = tileAt(tx + 1, ty), left = tileAt(tx - 1, ty);
    if (below === VOID) { const gr = g.createLinearGradient(0, y + TILE - 14, 0, y + TILE); gr.addColorStop(0, 'rgba(16,20,32,0)'); gr.addColorStop(1, 'rgba(16,20,32,0.75)'); g.fillStyle = gr; g.fillRect(x, y + TILE - 14, TILE, 14); }
    if (right === VOID) { g.fillStyle = 'rgba(16,20,32,0.45)'; g.fillRect(x + TILE - 6, y, 6, TILE); }
    if (left === VOID) { g.fillStyle = 'rgba(16,20,32,0.3)'; g.fillRect(x, y, 4, TILE); }
  }
  function drawVoid(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, r = hash(tx, ty);
    g.fillStyle = '#20263a'; g.fillRect(x, y, TILE, TILE);
    g.fillStyle = 'rgba(10,12,20,0.55)'; g.fillRect(x, y + TILE * 0.5, TILE, TILE * 0.5);
    if (r < 0.16) { const fl = Math.sin(time * 2.1 + tx * 3.1 + ty) ; if (fl > 0.93) { g.strokeStyle = 'rgba(200,220,255,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 10, y + 6); g.lineTo(x + 20, y + 22); g.lineTo(x + 14, y + 26); g.lineTo(x + 26, y + 44); g.stroke(); } }
  }
  function drawMast(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), sway = Math.sin(time * 1.3 + tx) * 1.5;
    g.fillStyle = 'rgba(10,14,26,0.35)'; g.beginPath(); g.ellipse(cx, cy + 16, 14, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#6e7178'; g.fillRect(cx - 4, cy - 6, 8, 24);
    g.fillStyle = '#8a8f98'; g.beginPath(); g.moveTo(cx - 3 + sway, cy - 44); g.lineTo(cx + 3 + sway, cy - 44); g.lineTo(cx + 5, cy + 2); g.lineTo(cx - 5, cy + 2); g.closePath(); g.fill();
    g.fillStyle = '#b6bcc6'; g.fillRect(cx - 3 + sway, cy - 44, 2, 44);
    g.strokeStyle = '#5a5f68'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 14, cy - 40 + sway); g.lineTo(cx + 14, cy - 34 + sway); g.stroke();   // the old crossarm
    const gl = 0.3 + Math.sin(time * 7 + tx) * 0.25;
    g.strokeStyle = `rgba(255,247,192,${gl})`; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(cx + sway, cy - 44); g.lineTo(cx + 6 + sway, cy - 52); g.lineTo(cx + 1 + sway, cy - 50); g.lineTo(cx + 7 + sway, cy - 60); g.stroke();
  }
  function drawUpdraft(g, tx, ty, open) {
    const cx = tc(tx), y = ty * TILE;
    g.strokeStyle = open ? 'rgba(223,240,255,0.85)' : 'rgba(90,100,130,0.6)'; g.lineWidth = 3; g.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const ph = (time * (open ? 1.4 : 0.5) + k * 0.25) % 1;
      g.beginPath(); g.moveTo(cx - 16 + k * 11, y + TILE - ph * TILE * 1.6); g.quadraticCurveTo(cx - 10 + k * 11, y + TILE - ph * TILE * 1.6 - 10, cx - 14 + k * 11, y + TILE - ph * TILE * 1.6 - 20); g.stroke();
    }
    if (open) { const gr = g.createRadialGradient(cx, y + 20, 4, cx, y + 20, 46); gr.addColorStop(0, 'rgba(223,240,255,0.35)'); gr.addColorStop(1, 'rgba(223,240,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, y + 20, 46, 0, 7); g.fill(); }
    if (dist(player.x, player.y, cx, tc(ty)) < 170) {
      const label = open ? `Up to Aerie · ${keyName('E')}` : 'Choked with cloud';
      g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.65)';
      g.strokeText(label, cx, y - 6); g.fillStyle = open ? '#ffe9a8' : '#8b949e'; g.fillText(label, cx, y - 6);
    }
  }
  function drawDown(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, cx = tc(tx);
    g.fillStyle = '#2a3348'; g.beginPath(); g.ellipse(cx, y + 24, 20, 11, 0, 0, 7); g.fill();
    g.fillStyle = '#161c2c'; g.beginPath(); g.ellipse(cx, y + 26, 14, 7, 0, 0, 7); g.fill();
    g.strokeStyle = `rgba(158,203,255,${0.45 + Math.sin(time * 4) * 0.25})`; g.lineWidth = 2;
    for (let k = 0; k < 3; k++) { const ph = (time * 0.9 + k * 0.33) % 1; g.beginPath(); g.moveTo(cx - 14 + k * 12, y + 8 + ph * 20); g.quadraticCurveTo(cx - 8 + k * 12, y + 14 + ph * 20, cx - 2 + k * 12, y + 10 + ph * 20); g.stroke(); }
    if (dist(player.x, player.y, cx, tc(ty)) < 170) { g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.65)'; g.strokeText(`Down to the shrine · ${keyName('E')}`, cx, y - 6); g.fillStyle = '#ffe9a8'; g.fillText(`Down to the shrine · ${keyName('E')}`, cx, y - 6); }
  }
  function drawWarning(g, s) {
    const p = Math.min(1, s.t / WARN), r = 40 - p * 12;
    g.strokeStyle = `rgba(255,247,192,${0.35 + p * 0.55})`; g.lineWidth = 2 + p * 2; g.setLineDash([6, 5]);
    g.beginPath(); g.arc(s.x, s.y, r, time * 2, time * 2 + 6.1); g.stroke(); g.setLineDash([]);
    g.strokeStyle = `rgba(255,247,192,${0.25 + p * 0.4})`; g.lineWidth = 2;
    g.beginPath(); g.moveTo(s.x - 10, s.y); g.lineTo(s.x + 10, s.y); g.moveTo(s.x, s.y - 8); g.lineTo(s.x, s.y + 8); g.stroke();
  }
  function drawBolt(g, s) {
    const a = 1 - (s.t - WARN) / 0.45;
    if (a <= 0) return;
    g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
    let x = s.x + Math.sin(s.x) * 26, y = s.y - VH;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 1; k <= 7; k++) { const f = k / 7; g.lineTo(s.x + (x - s.x) * (1 - f) + Math.sin(k * 7.3 + s.x) * 12 * (1 - f), s.y - VH * (1 - f)); }
    g.lineTo(s.x, s.y); g.stroke();
    g.strokeStyle = `rgba(255,247,192,${a * 0.7})`; g.lineWidth = 11; g.stroke();
    g.fillStyle = `rgba(255,255,255,${a * 0.5})`; g.beginPath(); g.ellipse(s.x, s.y, 30 * a + 10, 12 * a + 4, 0, 0, 7); g.fill();
  }
  function drawRain(g) {
    g.strokeStyle = 'rgba(180,200,235,0.28)'; g.lineWidth = 1;
    for (let k = 0; k < 70; k++) {
      const seed = hash(k, 3) * 1000, sx = cam.x + ((seed * 7 + time * 90) % (VW + 80)) - 40;
      const sy = cam.y + ((seed * 13 + time * 620) % (VH + 60)) - 30;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - 5, sy + 16); g.stroke();
    }
  }
  HOOKS.draw.push((g, items, cam2) => {
    if (!inStorm()) return;
    const c = cam2 || cam;
    const x0 = Math.max(0, Math.floor(c.x / TILE) - 1), x1 = Math.min(MAP_W - 1, Math.ceil((c.x + VW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(c.y / TILE) - 1), y1 = Math.min(MAP_H - 1, Math.ceil((c.y + VH) / TILE) + 2);
    const open = StQ().beaten;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      if (t === DECK) items.push({ y: -1e8 + ty * TILE, draw: () => drawDeck(g, tx, ty) });
      else if (t === VOID || tx >= ST.w || ty >= ST.h) items.push({ y: -1e8 + ty * TILE - 1, draw: () => drawVoid(g, tx, ty) });
      else if (t === MAST) { items.push({ y: -1e8 + ty * TILE, draw: () => drawDeck(g, tx, ty) }); items.push({ y: ty * TILE + TILE - 8, draw: () => drawMast(g, tx, ty) }); }
      else if (t === UPDRAFT) { items.push({ y: -1e8 + ty * TILE, draw: () => drawDeck(g, tx, ty) }); items.push({ y: ty * TILE + 6, draw: () => drawUpdraft(g, tx, ty, open) }); }
      else if (t === DOWNDRAFT) { items.push({ y: -1e8 + ty * TILE, draw: () => drawDeck(g, tx, ty) }); items.push({ y: ty * TILE + 6, draw: () => drawDown(g, tx, ty) }); }
    }
    for (const s of strikes) {
      if (!s.hit) items.push({ y: -9e7, draw: () => drawWarning(g, s) });
      else items.push({ y: 9e8, draw: () => drawBolt(g, s) });
    }
    items.push({ y: 9e8 + 1, draw: () => drawRain(g) });
    if (flash > 0.01) items.push({ y: 9e8 + 2, draw: () => { g.fillStyle = `rgba(255,255,255,${flash * 0.28})`; g.fillRect(c.x - 20, c.y - 20, VW + 40, VH + 40); } });
    if (!player.dead && !player.mech) items.push({ y: 1e9 + 4, draw: () => {
      const { tx, ty } = frontTile(player); const t = tileAt(tx, ty);
      if (t === UPDRAFT || t === DOWNDRAFT || t === MAST) { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]); roundRect(g, tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6, 6); g.stroke(); g.setLineDash([]); }
    } });
  });

  // ---------- what the bird is doing, in words, for the player who is running ----------
  HOOKS.hud.push((g, narrow) => {
    if (!inStorm()) return;
    const m = bird(); if (!m) return;
    const perch = m.phase === 'perch', high = m.phase === 'high';
    const label = perch ? 'PERCHED ON THE MAST — HIT IT NOW' : high ? 'IN THE CLOUD — KEEP MOVING' : 'HUNTING — KEEP MOVING';
    const col = perch ? '#ffe066' : '#9ecbff';
    const w = narrow ? Math.min(VW - 28, 250) : 268, h = 26, x = Math.round(VW / 2 - w / 2), y = narrow ? 96 : 60;
    roundRect(g, x, y, w, h, 8); g.fillStyle = 'rgba(10,14,22,0.82)'; g.fill(); g.strokeStyle = col; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = col; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText(label, x + w / 2, y + 17);
  });

  window.STORM = {
    ST, DECK, VOID, MAST, UPDRAFT, DOWNDRAFT, ENTRY, UP_T, DOWN_T, MASTS, BIRD_HOME, HUNT_FOR, HIGH_FOR, PERCH_FOR, MEM, WARN, BOLT_R, BOLT_DMG,
    inStorm, bird, shrine, toAerie, callBolt, setPhase, memoryPoint, state: StQ,
    get trail() { return trail; }, get strikes() { return strikes; },
  };

  // ======================================================================
  // B. THE CITY GATE — Grubmarket's wall, and the tinker at the corner of it
  // ======================================================================

  // The gateway tile is walkable ground: what shuts the city is the two goblins holding the leaves,
  // handled below, so the world stays honestly connected for every route audit while the knight is
  // still turned back at the gate until Tinkerton speaks for him.
  const CITY_GATE = addTile('CITY_GATE', { tex: 'dirt', mini: '#8a6a3a' });
  INTERESTING_TILES.add(CITY_GATE);   // shut, a tap on the leaves asks about them; open, it drops out of the set below and a tap walks straight through
  const WALL = { x0: 212, y0: 13, x1: 258, y1: 79 };   // the wall round Grubmarket, Castle Gnash, the scrap yard and the lab
  const GATE_T = [[212, 30], [212, 31]];               // the leaves, on the road up from Harl's landing
  const TINK_CORNER = { x: 211, y: 32 };               // 33-goblincity's TINK_GATE: the tinker's corner, OUTSIDE the wall
  const BENCH_T = { x: 210, y: 33 };                   // his workbench in the corner (a real station, before you are ever let in)
  const tinkQ = () => (quest.tinker && typeof quest.tinker === 'object') ? quest.tinker : null;
  const gateOpen = () => { const q = tinkQ(); return !!q && (q.stage || 0) >= 1; };
  let bumpT = 0, told = false, wasOpen = null;
  HOOKS.newGame.push(() => { quest.storm = freshStorm(); trail.length = 0; strikes.length = 0; flash = 0; bumpT = 0; told = false; wasOpen = null; });

  HOOKS.world.push((rnd, api) => {
    if (!REGIONS.some(r => r.name === 'Grubmarket')) return;   // the wall belongs to 33-goblincity's city
    const set = (x, y, t) => { if (buildingAt(x, y)) return; api.setTile(x, y, t); };
    for (let x = WALL.x0; x <= WALL.x1; x++) { set(x, WALL.y0, T.CWALL); set(x, WALL.y1, T.CWALL); }
    for (let y = WALL.y0; y <= WALL.y1; y++) { set(WALL.x0, y, T.CWALL); set(WALL.x1, y, T.CWALL); }
    for (const [x, y] of [[211, 28], [211, 33], [212, 28], [212, 33]]) set(x, y, T.CWALL);   // the gatehouse: a stub tower either side
    for (const [x, y] of GATE_T) api.setTile(x, y, CITY_GATE);
    for (const [x, y] of [[211, 29], [211, 30], [211, 31], [211, 32], [213, 29], [213, 30], [213, 31]]) if (!SOLID.has(api.tileAt(x, y))) api.setTile(x, y, T.DIRT);
    api.setTile(BENCH_T.x, BENCH_T.y, T.WORKBENCH);
    for (const [x, y] of [[209, 35], [210, 26]]) if (api.tileAt(x, y) === T.GRASS) api.setTile(x, y, T.RUBBLE);
  });

  // the leaves: shut until the tinker speaks for you, and never in your way again after
  HOOKS.update.push(dt => {
    if (bumpT > 0) bumpT -= dt;
    const open = gateOpen();
    if (open === INTERESTING_TILES.has(CITY_GATE)) { if (open) INTERESTING_TILES.delete(CITY_GATE); else INTERESTING_TILES.add(CITY_GATE); }
    if (wasOpen === null) wasOpen = open;
    else if (open && !wasOpen) {
      wasOpen = true;
      if (!window.__instance && dist(player.x, player.y, tc(GATE_T[0][0]), tc(GATE_T[0][1])) < 16 * TILE) {
        for (const [x, y] of GATE_T) burst(tc(x), tc(y), '#8a6a3a', 16, 110);
        sfx('open'); say('The winch squeals, the chain runs out, and the two leaves come apart far enough for a knight and a tinker to walk through together.', 'The Voice');
      }
    }
    wasOpen = open;
    if (open || player.dead || window.__instance) return;
    const lx = tc(GATE_T[0][0]);
    const y0 = GATE_T[0][1] * TILE - 26, y1 = (GATE_T[1][1] + 1) * TILE + 26;
    if (player.y < y0 || player.y > y1) return;
    if (player.x < lx - TILE * 1.3 || player.x > lx + TILE * 0.9) return;   // not in the gateway at all
    if (player.x <= lx - 12) return;                                        // still on the outside of the leaves
    player.x = lx - 12;
    if (typeof tapCancel === 'function') tapCancel('blocked');
    if (bumpT <= 0) {
      bumpT = 3.2;
      if (!told) { told = true; say("Two goblins put their spears across the gap. 'Gate's shut. Nobody in that hasn't got a goblin to speak for him. Try the tinker, corner there, with the lamp.'", 'The gate goblins'); }
      else notify('The gate is shut. Tinkerton keeps the lamp at the corner — ask him.');
    }
  });

  HOOKS.use.push((t, tx, ty) => {
    if (t !== CITY_GATE) return false;
    if (gateOpen()) { notify('Grubmarket\'s gate, open. Crooked huts, scrap roofs and a castle at the far end.'); return true; }
    say('Two heavy leaves of timber and scrap iron, chained, with a lamp on a hook. Grubmarket is behind it and it does not open for knights.', 'Grubmarket gate');
    if (!told) { told = true; say('The goblin who keeps the lamp is sitting in the corner by the south tower, up to his elbows in a machine. Talk to him.', 'The Voice'); }
    return true;
  });

  if (HOOKS.mapTarget) HOOKS.mapTarget.push(() => {
    const q = tinkQ(), b = quest.boats;
    return q && (q.stage || 0) === 0 && b && b.where === 'farshore' ? { x: TINK_CORNER.x, y: TINK_CORNER.y, label: 'Tinkerton, at the gate', id: 'tinker' } : null;
  });

  function drawLeaf(g, tx, ty, open, top) {
    const x = tx * TILE, y = ty * TILE, cx = tc(tx);
    if (open) {
      // swung back flat against the wall, out of the road
      g.fillStyle = '#4a3a26'; g.fillRect(x + 2, top ? y : y + TILE - 9, TILE - 4, 9);
      g.fillStyle = '#6b4f2a'; g.fillRect(x + 4, top ? y + 1 : y + TILE - 8, TILE - 8, 3);
      g.fillStyle = '#3a3a42'; for (const ox of [10, 24, 38]) { g.beginPath(); g.arc(x + ox, (top ? y + 4 : y + TILE - 4), 1.8, 0, 7); g.fill(); }
    } else {
      g.fillStyle = '#3a2c1c'; g.fillRect(x + 1, y, TILE - 2, TILE);
      g.fillStyle = '#5a4128'; for (let k = 0; k < 4; k++) g.fillRect(x + 3 + k * 11, y + 2, 9, TILE - 4);
      g.fillStyle = '#6e7178'; g.fillRect(x + 1, y + (top ? 12 : TILE - 20), TILE - 2, 7);
      g.fillStyle = '#8a8f98'; for (const ox of [8, 22, 36]) { g.beginPath(); g.arc(x + ox, y + (top ? 15 : TILE - 17), 2.2, 0, 7); g.fill(); }
      if (top) {
        // the chain across both leaves, and Tinkerton's lamp on its hook
        g.strokeStyle = '#5a5f68'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 2, y + TILE - 6); g.lineTo(x + TILE - 2, y + TILE - 2); g.stroke();
        const gl = 0.7 + Math.sin(time * 5) * 0.2, lx = x + 8, ly = y + 8;
        const gr = g.createRadialGradient(lx, ly, 2, lx, ly, 30); gr.addColorStop(0, `rgba(255,190,90,${0.4 * gl})`); gr.addColorStop(1, 'rgba(255,190,90,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(lx, ly, 30, 0, 7); g.fill();
        g.fillStyle = '#2a2a30'; g.fillRect(lx - 4, ly - 7, 8, 2); g.fillRect(lx - 4, ly + 5, 8, 2);
        g.fillStyle = `rgba(255,200,110,${gl})`; g.fillRect(lx - 3, ly - 5, 6, 10);
        // two spear tips crossed behind the leaves: the goblins holding it
        g.strokeStyle = '#8a8f98'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 12, y + 34); g.lineTo(cx + 12, y + 46); g.moveTo(cx + 12, y + 34); g.lineTo(cx - 12, y + 46); g.stroke();
      }
      if (dist(player.x, player.y, cx, tc(ty)) < 150 && top) {
        g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.65)';
        g.strokeText('Gate shut', cx, y - 6); g.fillStyle = '#ff9d9d'; g.fillText('Gate shut', cx, y - 6);
      }
    }
  }
  HOOKS.draw.push((g, items, cam2) => {
    if (window.__instance) return;
    const c = cam2 || cam;
    if (c.x + VW < (WALL.x0 - 3) * TILE || c.x > (WALL.x0 + 3) * TILE) return;   // the gate is the only thing we draw on the overworld
    const open = gateOpen();
    for (const [x, y] of GATE_T) {
      if (tileAt(x, y) !== CITY_GATE) continue;
      if (y * TILE < c.y - TILE || y * TILE > c.y + VH + TILE) continue;
      const top = y === GATE_T[0][1];
      items.push({ y: y * TILE + TILE - (open ? 10 : 2), draw: () => drawLeaf(g, x, y, open, top) });
    }
  });

  window.CITYGATE = {
    tile: CITY_GATE, WALL, GATE_T, TINK_CORNER, BENCH_T, open: gateOpen,
    reset: () => { told = false; bumpT = 0; wasOpen = null; },
  };

  // ======================================================================
  // self-test
  // ======================================================================
  const P = 'storm: ', G = 'gate: ';
  HOOKS.selfTest.push((check, F, h) => {
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
    const tileOf = () => [Math.floor(player.x / TILE), Math.floor(player.y / TILE)];
    const q0 = JSON.stringify(quest.storm || null), t0 = JSON.stringify(quest.tinker || null);
    const hp0 = player.hp, maxHp0 = player.maxHp;
    closePanel(); drain(); h.peace(true);
    if (INSTANCES.active()) INSTANCES.leave();

    // ---------- the storm gates Aerie ----------
    quest.storm = freshStorm();
    { const flute0 = countItem('wind_flute'); if (!flute0) h.give('wind_flute', 1);
      const S = window.SKYCITY;
      F.tp(S.STEP_T.x, S.STEP_T.y); F.face(S.SHRINE_T.x, S.SHRINE_T.y); drain(); F.press('KeyE'); F.sim(3, []);
      const inst = INSTANCES.active();
      check(P + 'the wind flute alone no longer opens Aerie: the shrine lifts you into the storm instead', inst === ST.id && inst !== 'aerie' && player.region === ST.name && !!areaBanner && areaBanner.name === ST.name,
        { inst, region: player.region, banner: areaBanner && areaBanner.name });
      if (!flute0) removeItem('wind_flute', 1); }

    // ---------- the deck, the masts, the drafts, the bird ----------
    { if (INSTANCES.active() !== ST.id) { const S = window.SKYCITY; F.tp(S.STEP_T.x, S.STEP_T.y); h.give('wind_flute', 1); F.face(S.SHRINE_T.x, S.SHRINE_T.y); F.press('KeyE'); F.sim(3, []); }
      let deck = 0, voids = 0, masts = 0;
      for (let y = 0; y < ST.h; y++) for (let x = 0; x < ST.w; x++) { const t = tileAt(x, y); if (t === DECK) deck++; else if (t === VOID) voids++; else if (t === MAST) masts++; }
      const up = F.bfs(ENTRY[0], ENTRY[1], UP_T[0], UP_T[1]), down = F.bfs(ENTRY[0], ENTRY[1], DOWN_T[0], DOWN_T[1]);
      const toMasts = MASTS.map(([x, y]) => F.bfs(ENTRY[0], ENTRY[1], x, y));
      const m = bird();
      check(P + 'the storm is a 40×26 deck of thunderhead over torn air: three iron masts, the way down, the updraft to Aerie, and the Thunderbird (lv 40, 340 hp) in the middle of it',
        deck > 400 && voids > 100 && masts === 3 && !!up && !!down && toMasts.every(p => !!p) && !!m && m.maxHp === 340 && MONSTER_DEFS.thunderbird.level === 40 && MONSTER_DEFS.thunderbird.aggro && typeof HOOKS.drawMonster.thunderbird === 'function' && !stormInst.dark,
        { deck, voids, masts, up: up && up.length, down: down && down.length, bird: !!m, hp: m && m.maxHp }); }

    // ---------- the updraft will not open while the bird is alive ----------
    { drain(); F.tp(UP_T[0], UP_T[1] + 1); F.face(UP_T[0], UP_T[1]); F.press('KeyE'); F.sim(2, []);
      check(P + 'the updraft to Aerie is choked while the Thunderbird lives', INSTANCES.active() === ST.id && !!dialog.cur && /choked/.test(dialog.cur.text), { inst: INSTANCES.active(), said: dialog.cur && dialog.cur.text }); }

    // ---------- the mechanic: the bolt falls where you STOOD, not where you are ----------
    { const m = bird(); if (m) { m.phaseT = -1e5; m.phase = 'hunt'; m.boltCd = 1e5; m.x = tc(6); m.y = tc(6); }
      player.hp = player.maxHp = 500; StQ().taught = true;
      // A. standing still: the memory point is under your boots, and it lands on you
      F.tp(20, 20); trail.length = 0; strikes.length = 0; F.sim(Math.ceil((MEM + 0.2) * 60), []);
      const stillAt = { x: player.x, y: player.y };
      callBolt(null); const sA = strikes[strikes.length - 1];
      const markedUnderfoot = !!sA && dist(sA.x, sA.y, stillAt.x, stillAt.y) < 2;
      const hpA = player.hp; F.sim(Math.ceil((WARN + 0.1) * 60), []);
      const hitStanding = player.hp < hpA;
      // B. walking: the bolt is called on the same rule, and lands well behind the moving knight
      strikes.length = 0; trail.length = 0; F.tp(12, 12); F.sim(Math.ceil((MEM + 0.2) * 60), ['KeyD']);
      const wasAt = memoryPoint(); callBolt(null); const sB = strikes[strikes.length - 1];
      const behind = !!sB && sB.x < player.x - 60 && dist(sB.x, sB.y, wasAt.x, wasAt.y) < 2;
      const hpB = player.hp; F.sim(Math.ceil((WARN + 0.1) * 60), ['KeyD']);
      const cleanDodge = player.hp === hpB;
      check(P + 'the lightning falls where you STOOD a moment ago (1.1 s): standing still is a hit, walking puts the bolt 60+ px behind you',
        markedUnderfoot && hitStanding && behind && cleanDodge && StQ().hits >= 1 && StQ().dodged >= 1,
        { markedUnderfoot, hitStanding, behind, cleanDodge, gap: sB ? Math.round(player.x - sB.x) : null, hits: StQ().hits, dodged: StQ().dodged }); }

    // ---------- in the cloud it cannot be touched; on the mast it takes double ----------
    { const m = bird();
      if (!m) check(P + 'the Thunderbird cannot be hit while it is in the cloud, and takes double damage while it is perched on a mast a knight can reach', false, { bird: false });
      else {
        m.phaseT = -1e5; m.hp = m.maxHp;
        setPhase(m, 'high'); m.phaseT = -1e5;
        const hpHigh = m.hp; hitMonster(m, 20, 0, false, 'player'); const refused = m.hp === hpHigh;
        setPhase(m, 'perch'); m.phaseT = -1e5;
        const onMast = MASTS.some(([x, y]) => dist(m.x, m.y, tc(x), tc(y)) < TILE);
        const hpPerch = m.hp; hitMonster(m, 20, 0, false, 'player'); const doubled = m.hp === hpPerch - 40;
        // and a real swing from the deck beside the mast reaches it
        const [mx, my] = MASTS.find(([x, y]) => dist(m.x, m.y, tc(x), tc(y)) < TILE) || MASTS[2];
        F.tp(mx, my + 1); F.face(mx, my); m.x = tc(mx); m.y = tc(my) - 12; m.perchAt = { x: m.x, y: m.y };
        const hpSwing = m.hp; let swings = 0;
        while (m.hp === hpSwing && swings < 60) { player.attackCd = 0; F.press('Space'); F.sim(2, []); swings++; }
        const reached = m.hp < hpSwing;
        m.hp = m.maxHp; setPhase(m, 'hunt'); m.phaseT = -1e5;
        check(P + 'the Thunderbird cannot be hit while it is in the cloud, and takes double damage while it is perched on a mast a knight can reach',
          refused && onMast && doubled && reached, { refused, onMast, doubled, reached, swings }); } }

    // ---------- the storm remembers a wounded bird ----------
    { const m = bird();
      if (!m) check(P + 'the Thunderbird does not heal while you are away: leave it wounded and it is still wounded when the wind takes you back', false, { bird: false });
      else {
        m.hp = 111; F.sim(2, []);
        const saved = StQ().birdHp === 111;
        F.tp(DOWN_T[0], DOWN_T[1] - 1); F.face(DOWN_T[0], DOWN_T[1]); drain(); F.press('KeyE'); F.sim(2, []);
        const outside = INSTANCES.active() === null;
        const S = window.SKYCITY; while (countItem('wind_flute') < 1) h.give('wind_flute', 1);
        F.tp(S.STEP_T.x, S.STEP_T.y); F.face(S.SHRINE_T.x, S.SHRINE_T.y); F.press('KeyE'); F.sim(3, []);
        const back = bird();
        check(P + 'the Thunderbird does not heal while you are away: leave it wounded and it is still wounded when the wind takes you back',
          saved && outside && INSTANCES.active() === ST.id && !!back && back.hp === 111 && back.maxHp === 340, { saved, outside, inst: INSTANCES.active(), hp: back && back.hp }); } }

    // ---------- killing it breaks the storm and opens the way up ----------
    { const m = bird();
      if (!m) check(P + 'killing the Thunderbird breaks the storm: 400 coins, a storm feather, 3 cloud essence, and the banner', false, { bird: false });
      else {
        drops = drops.filter(() => false);
        setPhase(m, 'perch'); m.phaseT = -1e5; m.hp = 12;
        let swings = 0; while (!m.dead && swings < 80) { hitMonster(m, 20, 0, false, 'player'); swings++; }
        F.sim(3, []);
        const coinDrop = drops.find(d => d.id === 'coins'), feather = drops.find(d => d.id === 'storm_feather'), essence = drops.find(d => d.id === 'cloud_essence');
        check(P + 'killing the Thunderbird breaks the storm: 400 coins, a storm feather, 3 cloud essence, and the banner',
          m.dead && StQ().beaten && !!coinDrop && coinDrop.qty === 400 && !!feather && !!essence && essence.qty === 3 && ITEMS.storm_feather.value === 400 && !!levelBanner && levelBanner.text === 'THE STORM BREAKS',
          { dead: m.dead, beaten: StQ().beaten, coins: coinDrop && coinDrop.qty, feather: !!feather, essence: essence && essence.qty, banner: levelBanner && levelBanner.text });
        drops = drops.filter(() => false); } }

    // ---------- and the updraft carries you up into Aerie ----------
    { drain(); F.tp(UP_T[0], UP_T[1] + 1); F.face(UP_T[0], UP_T[1]); F.press('KeyE'); F.sim(3, []);
      check(P + 'with the storm broken the updraft carries you up into Aerie', INSTANCES.active() === 'aerie' && player.region === 'Aerie', { inst: INSTANCES.active(), region: player.region });
      if (INSTANCES.active()) INSTANCES.leave(); }

    // ---------- and the shrine goes straight up ever after ----------
    { const flute0 = countItem('wind_flute'); if (!flute0) h.give('wind_flute', 1);
      const S = window.SKYCITY; drain(); F.tp(S.STEP_T.x, S.STEP_T.y); F.face(S.SHRINE_T.x, S.SHRINE_T.y); F.press('KeyE'); F.sim(3, []);
      check(P + 'with the storm broken the wind shrine lifts you straight to Aerie, and never into the storm again', INSTANCES.active() === 'aerie', { inst: INSTANCES.active() });
      if (INSTANCES.active()) INSTANCES.leave(); if (!flute0) while (countItem('wind_flute')) removeItem('wind_flute', 1); }

    player.maxHp = maxHp0; player.hp = Math.min(hp0, maxHp0); player.hurtT = 0;

    // ---------- B. the city gate ----------
    const LAND = { x: 206, y: 30 };
    { let wall = 0; for (let x = WALL.x0; x <= WALL.x1; x++) { if (tileAt(x, WALL.y0) === T.CWALL) wall++; if (tileAt(x, WALL.y1) === T.CWALL) wall++; }
      for (let y = WALL.y0; y <= WALL.y1; y++) { if (tileAt(WALL.x0, y) === T.CWALL) wall++; if (tileAt(WALL.x1, y) === T.CWALL) wall++; }
      const gates = GATE_T.filter(([x, y]) => tileAt(x, y) === CITY_GATE).length;
      const through = F.bfs(LAND.x, LAND.y, 220, 30);
      const was = GATE_T.map(([x, y]) => tileAt(x, y));
      for (const [x, y] of GATE_T) setTile(x, y, T.CWALL);
      const sealed = F.bfs(LAND.x, LAND.y, 220, 30), sealedKeep = F.bfs(LAND.x, LAND.y, 224, 61), sealedLab = F.bfs(LAND.x, LAND.y, 247, 42);
      GATE_T.forEach(([x, y], i) => setTile(x, y, was[i]));
      check(G + 'Grubmarket is walled, and the two-leaf gate on the road up from the landing is the only way into the city',
        wall > 200 && gates === 2 && !!through && !sealed && !sealedKeep && !sealedLab && tileAt(BENCH_T.x, BENCH_T.y) === T.WORKBENCH,
        { wall, gates, through: through && through.length, sealed: !!sealed, sealedKeep: !!sealedKeep, sealedLab: !!sealedLab }); }

    // the gate is shut to a knight nobody has spoken for
    { quest.tinker = { stage: 0, parts: {}, visited: true, rematch: false, kills: 0, friends: 0, bundle: false };
      CITYGATE.reset(); drain();
      F.tp(GATE_T[0][0] - 1, GATE_T[0][1]); const x0 = player.x;
      F.sim(150, ['KeyD']);
      const stopped = player.x < tc(GATE_T[0][0]) && tileOf()[0] <= GATE_T[0][0];
      const spoken = (!!dialog.cur && /Gate's shut/.test(dialog.cur.text)) || dialog.queue.some(d => /Gate's shut/.test(d.text));
      check(G + 'the gate is shut: a knight walking up from the landing is turned back at the leaves, and told who keeps the lamp',
        stopped && spoken && player.x > x0 - 4, { at: tileOf(), x: Math.round(player.x), gateX: tc(GATE_T[0][0]), spoken, said: dialog.cur && dialog.cur.text }); }

    // Tinkerton tends the corner of the gate, outside it, and talking to him is the way in
    { drain(); F.tp(TINK_CORNER.x - 1, TINK_CORNER.y); F.face(TINK_CORNER.x, TINK_CORNER.y); F.press('KeyE'); F.sim(3, []);
      const started = !!quest.tinker && quest.tinker.stage === 1;
      const who = dialog.cur && dialog.cur.who;
      const outside = TINK_CORNER.x < WALL.x0 && !SOLID.has(tileAt(TINK_CORNER.x, TINK_CORNER.y));
      const corner = tileAt(212, 33) === T.CWALL && tileAt(211, 33) === T.CWALL;   // the south tower he sits against
      F.sim(3, []);
      const nowOpen = CITYGATE.open();
      F.tp(GATE_T[0][0] - 1, GATE_T[0][1]); F.sim(150, ['KeyD']);
      const walkedIn = tileOf()[0] > GATE_T[0][0] + 1;
      check(G + 'Tinkerton tends the lamp at the corner of the gate, outside it: talking to him starts the quest and opens the city',
        started && who === 'Tinkerton' && outside && corner && nowOpen && walkedIn && activeQuests().includes('tinker') && /Grubb/.test(questText('tinker')),
        { started, who, outside, corner, nowOpen, walkedIn, at: tileOf(), text: questText('tinker') }); }

    // the errands are how you make friends: four goblins, four parts, and the market pays it back
    { const q = quest.tinker; q.parts = {}; q.friends = 0; q.bundle = false;
      drops = drops.filter(() => false);
      // [what they want, how many, the part, where you stand, where the goblin is]
      const need = [['cooked_beef', 5, 'boiler', 216, 24, 216, 23], ['goblin_scrap', 10, 'gear_wheel', 230, 24, 230, 23], ['spider_silk', 3, 'bomb_chute', 216, 36, 216, 37], ['bread', 1, 'lightning_coil', 222, 34, 222, 33]];
      const held = id => countItem(id) + drops.filter(d => d.id === id).reduce((n, d) => n + d.qty, 0);
      const counted = [];
      let made = 0, beefBefore = 0, scrapBefore = 0;
      const makeRoom = k => { h.clearJunk(); for (let i = player.inv.length - 1; i >= 0 && player.inv.filter(x => !x).length < k; i--) { const it = player.inv[i]; if (it && it.id !== 'coins' && it.id !== 'wind_flute' && !ITEMS[it.id].weapon && !ITEMS[it.id].armour && !ITEMS[it.id].tool) player.inv[i] = null; } };
      need.forEach(([item, n, part, sx, sy, gx, gy], i) => {
        makeRoom(6); while (countItem(item) < n) if (h.give(item, 1) > 0) break;
        if (i === need.length - 1) { beefBefore = held('cooked_beef'); scrapBefore = held('goblin_scrap'); }
        F.tp(sx, sy); F.face(gx, gy); drain(); F.press('KeyE'); F.sim(2, []);
        if (q.parts[part]) made++;
        counted.push(q.friends);
      });
      const beefGain = held('cooked_beef') - beefBefore, scrapGain = held('goblin_scrap') - scrapBefore;
      check(G + 'the four errands in the market are how you make friends: each goblin trades a part, the count climbs 1-2-3-4, and the four of them club together for a parting bundle',
        made === 4 && counted.join(',') === '1,2,3,4' && q.bundle === true && beefGain === 2 && scrapGain === 10,
        { made, counted, bundle: q.bundle, beefGain, scrapGain });
      for (const id of ['boiler', 'gear_wheel', 'bomb_chute', 'lightning_coil']) while (countItem(id)) removeItem(id, 1);
      drops = drops.filter(() => false); }

    // restore what the run found
    if (INSTANCES.active()) INSTANCES.leave();
    quest.storm = q0 === 'null' ? freshStorm() : JSON.parse(q0);
    if (t0 !== 'null') quest.tinker = JSON.parse(t0);
    CITYGATE.reset(); closePanel(); drain(); h.peace(false);
  });
}
