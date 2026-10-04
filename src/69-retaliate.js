// ============================================================================
// FIGHT BACK WHEN HIT — auto-retaliate, on by default (owner, 2026-09-25: "can we have auto retaliate toggles for
// combat have it on by default? Maybe you toggle it in your inventory menu").
// Like RuneScape: when a monster hits the knight and the switch is on, he turns to it and fights back — swings on
// cooldown when it is in reach (shoots with a bow, uses the machine's attack while driving one), and walks the short
// way to it when it is a few tiles off (never more than LEASH past his reach, never more than ANCHOR from where he was
// hit). He stops when it is dead, when it runs out of range, when he is told to do something else (any movement input,
// a tap-to-walk or a tap on something, opening a panel, using or talking) or when he falls. A hit interrupts skilling
// (the core already drops the timed action on a hit; the tap-to-chop loop is dropped here).
// The switch: player.retaliate (in the save, so it travels with the knight, cloud saves included), mirrored in
// Settings (43-settings addRow: persisted under fanglands.settings like every other setting, so a new game on this
// device starts the way the last one was left). A save that is loaded wins over the device. Kid mode keeps it on.
// Controls: the "Fight back when hit: ON / OFF" button in the pack (the iPad control), the Settings row, and O.
// Who counts as the attacker: only a monster that really attacked him, traced (see "who hit him" below): the monster
// whose own position the hit names, the thrower of the bomb that went off, or online the keeper's monster the 'hurt'
// message names. A hurt with no monster behind it (a fall, lava, a trap, a storm bolt) starts no fight, and nothing
// standing nearby is ever blamed. hurtPlayer is wrapped rather than HOOKS.hurt used, because HOOKS.hurt does not run
// for a miss or for a hit taken inside a machine, and a miss is still an attack. People who only turn on the knight for
// something he did (the watch, the dwarf and castle guards, the sentinels: human and not aggressive) are never fought
// back automatically: hitting one raises the wanted level (23-law), and that is a choice the child makes, not the switch.
// He does not try when he cannot: from the saddle, with the shield up, or with a bow and no arrows (said once). A swing
// the game refuses for any other reason is tried once and then left for QUIET seconds, so no reason is said every hit.
// A line of talk that simply comes up mid-fight (the Voice, a quest line) does not stop him: nobody told him to do
// anything, and a tap on the box only moves the talk on. Talking to someone (USE, a tap on a person) does stop him.
// Online (75-coop): a non-keeper is hurt by a 'hurt' message carrying the keeper's monster position; the puppet there is
// the attacker, and the swing goes through hitMonster, which routes a hit on a puppet to the keeper.
// Feature file: HOOKS plus wrapped core functions (hurtPlayer, playerAttack, useAction, talkTo) and a row in the pack (10-hud PACK_ROWS). Test handle:
// window.RETALIATE.
// ============================================================================
const RETALIATE = (() => {
  // how far past his reach he walks to a monster that hit him
  const LEASH = 4 * TILE;
  // never further than this from where he was hit
  const ANCHOR = 5 * TILE;
  // online only: a puppet stands within its own radius + this of the rounded spot a keeper's 'hurt' names
  const FIND = TILE;
  // seconds without a swing (walking into something the whole time) and he stops
  const GIVE_UP = 6;
  // a way round longer than this many steps is not "the short way": he stays put
  const MAX_PATH = 8;
  const KEY = 'KeyO';
  // seconds a refused swing keeps him from trying again
  const QUIET = 6;
  // seconds after a swing of his own in which a hit does not take the fight over (he is already fighting)
  const HOLD = 2;
  const R = { target: null, anchor: null, idle: 0, path: null, repathT: 0, stuckT: 0, why: null, starts: 0, swings: 0, struck: 0, hold: 0, own: false, quiet: 0, saidBow: false };
  let seenPlayer = null;

  // ---------- the switch ----------
  const deviceOn = () => !(window.SETTINGS && SETTINGS.get('retaliate') === false);
  function isOn() { return !!window.__kidmode || (typeof player.retaliate === 'boolean' ? player.retaliate : deviceOn()); }
  function set(v, quiet) {
    v = !!v;
    if (!v && window.__kidmode) { if (!quiet) notify('Kid mode keeps fighting back on. Turn kid mode off in Settings to change it.'); v = true; }
    player.retaliate = v;
    if (window.SETTINGS && SETTINGS.get('retaliate') !== v) SETTINGS.set('retaliate', v);
    if (!v) stop('off');
    if (!quiet) { notify(v ? 'Fight back when hit: ON. A monster that hits you gets hit back.' : 'Fight back when hit: OFF. You only fight when you choose to.'); sfx('ui'); save(); }
    return v;
  }
  const toggle = () => set(!isOn());
  // Settings row: the same switch, drawn by 43-settings from its own store
  if (window.SETTINGS && SETTINGS.addRow) {
    SETTINGS.addRow({ key: 'retaliate', name: 'Fight back when hit', hint: () => window.__kidmode ? 'Kid mode keeps this on.' : 'A monster that hits you gets hit back. Also in your pack.' }, true, [true, false], 'kid',
      v => { if (!v && window.__kidmode) { SETTINGS.set('retaliate', true); notify('Kid mode keeps fighting back on.'); return; } if (player.retaliate !== v) { player.retaliate = v; if (!v) stop('off'); } });
  }
  // a new game takes the device's choice; a loaded save (or a cloud save) brings its own and the device follows it
  function syncPlayer() {
    if (player === seenPlayer) return;
    seenPlayer = player; stop('new knight');
    if (typeof player.retaliate === 'boolean') { if (window.SETTINGS && SETTINGS.get('retaliate') !== player.retaliate) SETTINGS.set('retaliate', player.retaliate); }
    else player.retaliate = deviceOn();
  }

  // ---------- who hit him ----------
  // Only a monster that really attacked him is ever fought back. Guessing "the nearest monster to the spot" (the first
  // build) blamed bystanders: a guard's hit next to a calm boar killed the boar, and a slip off an agility log, a palisade
  // prick or a falling rock next to a grazing goblin turned him on the goblin. So the attacker is traced, three ways:
  //   1. a swing, a ram, a slam or a heat pulse passes the monster's own position (hurtPlayer(dmg, m.x, m.y)): exact match;
  //   2. a thrown sticky bomb explodes where it landed, far from the thrower: every monster projectile is tagged with the
  //      monster that threw it on its first tick (tagThrown) and the explosion is matched to its bomb;
  //   3. online, a keeper's monster hits us through a 'hurt' message with rounded coordinates: the nearest puppet there.
  // Anything else (lava, a storm bolt, a fall, a trap, a dragon's fireball) has no attacker to fight back.
  const peacekeeper = def => !!def.human && !def.aggro;
  const eligible = m => { const def = m && MONSTER_DEFS[m.type]; return !!def && !def.harmless && !peacekeeper(def); };
  function live(m) { return !!m && !m.dead && !m.gone && monsters.includes(m) && !!MONSTER_DEFS[m.type] && !MONSTER_DEFS[m.type].harmless; }
  function attackerAt(x, y, sure) {
    for (const m of monsters) if (!m.dead && !m.gone && m.x === x && m.y === y) return eligible(m) ? m : null;
    for (const p of projectiles) if (p.owner === 'monster' && p.x === x && p.y === y) return p.from && live(p.from) && eligible(p.from) ? p.from : null;
    // 75-coop's 'hurt' passes no 'sure'; every hazard in the list above passes true
    if (sure === true) return null;
    let best = null, bd = Infinity;
    for (const m of monsters) {
      if (!m.remote || m.dead || m.gone || !eligible(m)) continue;
      const d = dist(x, y, m.x, m.y); if (d <= (m.r || 12) + FIND && d < bd) { bd = d; best = m; }
    }
    return best;
  }
  // a monster projectile remembers who threw it: the nearest monster to where it left (the sapper throws from its middle,
  // the Hollowford captain and the Gnasher from a hand a little off it)
  function tagThrown() {
    for (const p of projectiles) {
      if (p.owner !== 'monster' || p.from !== undefined) continue;
      // only a bomb just thrown can be traced back to a hand; one found late (already landed) has no thrower we can know
      if (!(p.t <= 0.1)) { p.from = null; continue; }
      const ox = p.x - (p.vx || 0) * Math.min(p.t, p.life || 0), oy = p.y - (p.vy || 0) * Math.min(p.t, p.life || 0);
      let best = null, bd = Infinity;
      for (const m of monsters) { if (m.dead || m.gone) continue; const d = dist(ox, oy, m.x, m.y); if (d <= (m.r || 12) + 30 && d < bd) { bd = d; best = m; } }
      p.from = best;
    }
  }
  // 51-mounts: no swinging from the saddle
  const horse = () => !!(player.mech && player.mech.kind === 'horse');
  const moving = () => inputVector().m > 0;
  // walking somewhere on purpose, fighting something he tapped, a panel or the menu up: he is busy, a hit does not turn him
  const tapBusy = () => typeof tapActive === 'function' && tapActive() && !(tap.gather && !tap.kind && !tap.path);
  // the shield up (47-outliers): he is blocking on purpose, and the game refuses a swing then
  const blocking = () => !player.mech && !!window.OUTLIERS && OUTLIERS.BLOCK.t > 0 && !!OUTLIERS.shieldOn();
  // a bow with nothing to shoot: said once (until he has arrows again or puts the bow away), then he just takes it
  function emptyBow() {
    const w = weaponDef(), empty = !!w && !!w.weapon.ranged && !player.mech && arrowSlot() < 0;
    if (!empty) R.saidBow = false;
    else if (!R.saidBow) { R.saidBow = true; notify('No arrows, so you cannot fight back with the bow. Make arrows at a workbench, or hold a sword.'); }
    return empty;
  }
  function struck(fx, fy, sure) {
    if (player.dead || !Number.isFinite(fx) || !Number.isFinite(fy)) return;
    const m = attackerAt(fx, fy, sure); if (!m) return;
    // a monster attacked (hit or miss): counted whether or not he answers
    R.struck++;
    if (!isOn() || horse()) return;
    // already fighting back: he keeps the one he is on
    if (live(R.target)) return;
    // swinging on his own just now: already in a fight he chose (RuneScape does the same)
    if (R.hold > 0) return;
    // the last try was refused by the game (see tick): no second try for a while, so the reason is not said on every hit
    if (R.quiet > 0) return;
    if (paused || panel || moving() || tapBusy() || blocking() || emptyBow()) return;
    // a tap-to-chop loop: the hit ends it
    if (typeof tapActive === 'function' && tapActive()) tapCancel('retarget');
    player.action = null;
    R.target = m; R.anchor = { x: player.x, y: player.y }; R.idle = 0; R.path = null; R.repathT = 0; R.stuckT = 0; R.why = null; R.starts++;
  }
  function stop(why) { if (R.target) R.why = why; R.target = null; R.path = null; }

  // ---------- the wrapped core ----------
  { const _hurtPlayer = hurtPlayer;
    hurtPlayer = function (dmg, fromX, fromY, sure) { const r = _hurtPlayer(dmg, fromX, fromY, sure); struck(fromX, fromY, sure); return r; }; }
  // using something or talking is being told to do something else
  { const _useAction = useAction; useAction = function () { stop('use'); return _useAction(); }; }
  { const _talkTo = talkTo; talkTo = function (npc) { stop('talk'); return _talkTo(npc); }; }
  // a swing of his own (SWING, Space, a double-tap, a tapped monster) is the child fighting: it takes over from the auto-fight
  { const _playerAttack = playerAttack; playerAttack = function () { if (!R.own) { R.hold = HOLD; stop('swing'); } return _playerAttack(); }; }

  // ---------- fighting back ----------
  const reachOf = m => typeof tapReach === 'function' ? tapReach(m) : 36 + m.r;
  function face(x, y) { const dx = x - player.x, dy = y - player.y, d = Math.hypot(dx, dy) || 1; player.facing = { x: dx / d, y: dy / d }; }
  function walkToward(m, dt) {
    R.repathT -= dt;
    const own = { tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) }, gt = { tx: Math.floor(m.x / TILE), ty: Math.floor(m.y / TILE) };
    if (!R.path || R.repathT <= 0) {
      R.repathT = 0.25;
      const p = (own.tx === gt.tx && own.ty === gt.ty) ? [] : typeof tapBfs === 'function' ? tapBfs(own.tx, own.ty, gt.tx, gt.ty, tapWho()) : null;
      if (!p || p.length > MAX_PATH) { stop('no way'); return; }
      R.path = p;
    }
    // the next waypoint, or the monster itself on the last tile
    let gx = m.x, gy = m.y;
    while (R.path.length > 1) { const [wx, wy] = R.path[0]; if (dist(player.x, player.y, tc(wx), tc(wy)) < 8) { R.path.shift(); continue; } gx = tc(wx); gy = tc(wy); break; }
    const dx = gx - player.x, dy = gy - player.y, d = Math.hypot(dx, dy) || 1;
    const x0 = player.x, y0 = player.y;
    player.facing = { x: dx / d, y: dy / d };
    moveEntity(player, dx / d * player.speed * dt, dy / d * player.speed * dt, playerWho());
    player.moving = true; player.walkT += dt * 9;
    if (dist(x0, y0, player.x, player.y) < 0.3) { R.stuckT += dt; if (R.stuckT > 0.6) stop('blocked'); } else R.stuckT = 0;
  }
  function tick(dt) {
    const m = R.target; if (!m) return;
    if (player.dead) return stop('dead');
    if (!isOn()) return stop('off');
    if (!live(m)) return stop('gone');
    if (moving()) return stop('moved');
    if (paused || panel) return stop('panel');
    if (typeof tapActive === 'function' && tapActive()) return stop('tap');
    if (player.action) return stop('busy');
    if (horse()) return stop('horse');
    if (blocking()) return stop('shield');
    const reach = reachOf(m), d = dist(player.x, player.y, m.x, m.y);
    if (d > reach + LEASH || dist(player.x, player.y, R.anchor.x, R.anchor.y) > ANCHOR) return stop('ran');
    R.idle += dt;
    if (d <= reach) {
      R.path = null; R.stuckT = 0; face(m.x, m.y); player.moving = false;
      if (player.attackCd <= 0) {
        R.own = true; try { playerAttack(); } finally { R.own = false; }
        // refused (no arrows, the shield is up, ...): the game has already said why once; he stops rather than ask every frame
        if (player.attackCd <= 0) { R.quiet = QUIET; return stop('cannot'); }
        R.swings++; R.idle = 0;
      }
    } else walkToward(m, dt);
    if (R.target && R.idle > GIVE_UP) stop('stuck');
  }
  HOOKS.update.push(dt => {
    syncPlayer();
    R.hold = Math.max(0, R.hold - dt); R.quiet = Math.max(0, R.quiet - dt);
    tagThrown();
    // kid mode keeps it on
    if (window.__kidmode && player.retaliate === false) set(true, true);
    // not while a panel is up: the wiki's search box takes letters from the same keys, and typing "goblin" must not flip it
    if (pressed.has(KEY) && !paused && !panel) toggle();
    tick(dt);
  });
  HOOKS.keyHelp.push({ action: 'Fight back on / off', codes: [KEY] });
  HOOKS.newGame.push(() => { stop('new game'); });

  // a thin red ring under the monster he is fighting back, so a child can see what the knight is doing and why
  HOOKS.draw.push((g, items) => {
    const m = R.target; if (!m || !live(m)) return;
    items.push({ y: -1e9 + 2, draw: () => {
      g.save(); g.globalAlpha = 0.55 + Math.sin(time * 6) * 0.15; g.strokeStyle = '#ff6b6b'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(m.x, m.y + m.r * 0.6, m.r + 7, (m.r + 7) * 0.5, 0, 0, 7); g.stroke(); g.restore();
    } });
  });

  // ---------- the pack control (the iPad's way to flip it) ----------
  // A switch on its own row at the foot of the pack (10-hud PACK_ROWS): an iron plate with the sword emblem, its edge
  // green while it is on, one kit row tall (44 px on touch). The pack measures the row in, so it never lands on anything.
  const label = () => `Fight back when hit: ${isOn() ? 'ON' : 'OFF'}`;
  // where the row is narrow (beside the keyring on an upright phone) it says the short form, "Fight back: ON"
  const short = () => `Fight back: ${isOn() ? 'ON' : 'OFF'}`;
  PACK_ROWS.push({ id: 'retaliate',
    minW: (g, h) => PANEL_KIT.verbW(g, short(), 'swing', h),
    draw: (g, x, y, w, h) => {
      const long = PANEL_KIT.verbW(g, label(), 'swing', h) <= w, text = long ? label() : short();
      const bw = Math.min(w, Math.max(long ? 220 : 0, PANEL_KIT.verbW(g, text, 'swing', h)));
      PANEL_KIT.verb(g, x, y, bw, h, 'retaliate', () => { if (window.__kidmode) { notify('Kid mode keeps fighting back on. Turn kid mode off in Settings to change it.'); return; } toggle(); },
        { text, emblem: 'swing', on: isOn(), name: 'Fight back when hit: a monster that hits you gets hit back', keys: ['O'] });
    } });

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'fight back: ';
    const real = monsters, kid0 = window.__kidmode, on0 = player.retaliate, peace0 = window.__peace, touch0 = window.__forceTouch;
    const keep = { x: player.x, y: player.y, hp: player.hp, dead: player.dead, dayTime: player.dayTime, kills: player.kills, skills: JSON.stringify(player.skills), facing: { ...player.facing }, drops: drops.length, mech: player.mech, r: player.r, speed: player.speed, inv: JSON.stringify(player.inv), equip: { ...player.equip }, companion: player.companion, law: player.law ? JSON.stringify(player.law) : null };
    // the ground these checks fight on goes back as it was: a bulldozer that walks to a goblin plows what it drives over,
    // and a later check that looks for clean grass there (the drop party's crackers) must still find it
    // and so do the graves the kills here lay (54-graves: a cross in front of the knight answers USE before anything else)
    const o0 = h.openSpot(ATLAS.world.tx(40), ATLAS.world.ty(24)), ground = [], regrow0 = new Set(regrow), fires0 = new Set(fires);
    const graves0 = Array.isArray(quest.graves) ? quest.graves.slice() : null, laid0 = quest.graveNight ? quest.graveNight.laid : null;
    for (let y = o0.y - 16; y <= o0.y + 16; y++) for (let x = o0.x - 16; x <= o0.x + 16; x++) if (inMap(x, y)) { const i = idx(x, y); ground.push([x, y, map[i], mapDiffs.has(i), mapDiffs.get(i)]); }
    const r0 = Math.random, notify0 = notify, proj0 = new Set(projectiles), block0 = window.OUTLIERS ? OUTLIERS.BLOCK.t : 0;
    // a world of one goblin: nothing else can wander in, hit him or be hit (the real array is put back in finally)
    const goblin = (x, y, type = 'goblin') => { const d = MONSTER_DEFS[type]; return { type, x, y, home: { x, y }, r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: true, state: 'chase', wanderT: 99, wander: { x: 0, y: 0 }, attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 0, facing: { x: -1, y: 0 }, walkT: 0, moving: false, stunT: 0 }; };
    // tough: a goblin that must still be standing when the check looks (a knight fresh off the playthrough kills one in a swing)
    // a step that never lets him fall: a fall would put his pack in Death's chest and leave him dead for the checks after these
    const safe = () => { if (player.hp < player.maxHp / 2) player.hp = player.maxHp; F.step([]); };
    const stage = (dx, seed, tough) => {
      // nothing in the air: a bomb or an arrow from the check before (or from a check before these) would land in this one
      projectiles = [];
      Math.random = mulberry32(seed); closePanel(); dialog.cur = null; dialog.queue.length = 0; if (typeof tapCancel === 'function') tapCancel('manual');
      const o = h.openSpot(ATLAS.world.tx(40), ATLAS.world.ty(24)); F.tp(o.x, o.y); player.hp = player.maxHp; player.facing = { x: -1, y: 0 }; player.attackCd = 0; player.attackT = 0; player.action = null; stop('test'); R.hold = 0;
      const g = goblin(player.x + dx, player.y); if (tough) { g.hp = g.maxHp = 999; } monsters = [g]; return g;
    };
    try {
      // the same knight wherever the suite is: Melee and Defence 10, an iron sword, nothing else worn, not riding, and alone
      // (a hired hero swings at whatever attacks the knight: after the --play playthrough Garrick killed the "off" goblin)
      window.__kidmode = false; window.__peace = false; player.mech = null; player.companion = null;
      for (const k in player.equip) player.equip[k] = null; player.equip.weapon = 'iron_sword';
      player.skills = JSON.parse(JSON.stringify(newPlayer().skills)); player.skills.melee.xp = XP_TABLE[10]; player.skills.defence.xp = XP_TABLE[10]; recomputeMaxHp();
      // on: a goblin that hits the knight gets hit back until it dies, and nobody pressed anything
      { set(true, true); const g = stage(34, 0x5E7A); const sw0 = R.swings, st0 = R.struck;
        let hitBack = false, s = 0; for (; s < 900 && !g.dead; s++) { F.step([]); if (g.hp < g.maxHp) hitBack = true; } F.step([]);
        const swings = R.swings - sw0, attacks = R.struck - st0;
        check(P + 'on: a goblin that hits the knight is hit back and dies, with no key, stick or tap', isOn() && attacks >= 1 && hitBack && g.dead && swings >= 1 && !player.dead && R.target === null && R.why === 'gone', { on: isOn(), attacks, hitBack, dead: g.dead, steps: s, swings, why: R.why, knightHp: player.hp }); }
      // off: the same goblin, and the knight does nothing about it
      { set(false, true); const g = stage(34, 0x5E7A); const hp0 = g.hp, st0 = R.struck; let swung = false;
        for (let s = 0; s < 240; s++) { F.step([]); if (player.attackT > 0) swung = true; }
        const attacks = R.struck - st0;
        check(P + 'off: the goblin attacks the knight and nothing fights back', !isOn() && attacks >= 2 && !swung && g.hp === hp0 && R.target === null, { attacks, swung, goblinHp: [hp0, g.hp] });
        set(true, true); }
      // movement input takes over at once, and while he is walking a hit does not turn him
      { const g = stage(34, 0x5E7B, true); let started = false; for (let s = 0; s < 240 && !started; s++) { F.step([]); started = R.target === g; }
        F.step(['KeyW']); const cancelled = R.target === null && R.why === 'moved';
        let turned = false; for (let s = 0; s < 120; s++) { g.x = player.x + 30; g.y = player.y; F.step(['KeyW']); if (R.target) turned = true; }
        check(P + 'any movement input stops it at once, and a hit while he walks does not turn him', started && cancelled && !turned, { started, cancelled, turned, why: R.why }); }
      // a panel and using something are "do something else" too
      { const g = stage(34, 0x5E7C, true); let started = false; for (let s = 0; s < 240 && !started; s++) { F.step([]); started = R.target === g; }
        openPanel('inventory'); F.step([]); const byPanel = R.target === null && R.why === 'panel'; closePanel();
        started = false; for (let s = 0; s < 240 && !started; s++) { F.step([]); started = R.target === g; }
        useAction(); const byUse = R.target === null && R.why === 'use';
        check(P + 'opening a panel or using / talking stops it', byPanel && byUse, { byPanel, byUse }); }
      // like RuneScape, an attack interrupts skilling: a chop in progress (and the tap-to-chop loop) ends and he turns to fight
      { const g = stage(34, 0x5E82, true); const t = F.nearestTile([T.TREE]);
        player.action = { type: 'chop', t: 0, need: 99, tx: t.x, ty: t.y }; tap.gather = { tx: t.x, ty: t.y, t: T.TREE }; tap.reissues = 0;
        let s = 0; for (; s < 240 && R.target !== g; s++) F.step([]);
        check(P + 'a hit interrupts chopping (and a tap-to-chop loop) and he turns to fight', R.target === g && player.action === null && tap.gather === null, { steps: s, fighting: R.target === g, action: player.action && player.action.type, gather: !!tap.gather }); }
      // a short way: a goblin that hits and steps back three tiles is followed and hit
      { const g = stage(34, 0x5E7D, true); let started = false; for (let s = 0; s < 240 && !started; s++) { F.step([]); started = R.target === g; }
        const x0 = player.x; g.x = player.x + 3 * TILE; g.stunT = 99; const hp0 = g.hp, sw0 = R.swings; let reached = false;
        for (let s = 0; s < 240 && R.target; s++) { F.step([]); if (g.hp < hp0 || (R.swings > sw0 && dist(player.x, player.y, g.x, g.y) <= reachOf(g))) reached = true; }
        check(P + 'a goblin a few tiles off is walked to (the short way) and fought', started && reached && player.x > x0 + TILE, { started, reached, walked: +((player.x - x0) / TILE).toFixed(2), why: R.why }); }
      // runs out of range: never chased across the map
      { const g = stage(34, 0x5E7E, true); let started = false; for (let s = 0; s < 240 && !started; s++) { F.step([]); started = R.target === g; }
        const a = { x: player.x, y: player.y }; g.x = player.x + 12 * TILE; g.stunT = 99; F.sim(120, []);
        const stayed = dist(player.x, player.y, a.x, a.y) < 1 * TILE;
        // and one that keeps running a step ahead of him: he gives up at the leash, not at the far side of the world
        const g2 = stage(34, 0x5E7F, true); started = false; for (let s = 0; s < 240 && !started; s++) { F.step([]); started = R.target === g2; }
        const a2 = { x: player.x, y: player.y }; let far = 0;
        for (let s = 0; s < 900; s++) { g2.x = Math.max(g2.x, player.x + reachOf(g2) + 20); g2.stunT = 99; F.step([]); far = Math.max(far, dist(player.x, player.y, a2.x, a2.y)); }
        check(P + 'a monster that runs out of range is not chased across the map', started && stayed && R.target === null && far <= ANCHOR + TILE, { stayed, far: +(far / TILE).toFixed(2), leashTiles: ANCHOR / TILE, why: R.why }); }
      // peacekeepers and harmless things are never fought back on their own
      { const g = stage(34, 0x5E80); g.type = 'guard_m'; hurtPlayer(1, g.x, g.y); const guard = R.target === null; stop('test'); monsters = [];
        check(P + 'a town guard is never fought back automatically (it would make the knight wanted)', guard, { target: R.target && R.target.type }); }
      // a line of talk that comes up mid-fight is not an order: he keeps fighting while it shows and after a tap moves it on
      { const g = stage(34, 0x5E8A, true); let started = false; for (let s = 0; s < 240 && !started; s++) { safe(); started = R.target === g; }
        say('A line in the middle of a fight.', 'The Voice'); const sw0 = R.swings; for (let s = 0; s < 120; s++) safe(); const during = R.swings - sw0;
        advanceDialog(); const sw1 = R.swings; for (let s = 0; s < 120; s++) safe(); const after = R.swings - sw1;
        check(P + 'a line of talk that comes up mid-fight does not stop him (talking to someone does)', started && during >= 1 && after >= 1 && R.target === g, { started, during, after, why: R.why }); dialog.cur = null; dialog.queue.length = 0; }
      // a sapper stays two to five tiles off and throws sticky bombs: the bomb goes off where it landed, far from the sapper,
      // so the sapper is found through its bomb, and he walks to it and fights it
      { const g = stage(3.5 * TILE, 0x5E83); const sp = goblin(g.x, g.y, 'sapper'); monsters = [sp]; const st0 = R.struck, s0 = R.starts;
        let aimed = false, s = 0; for (; s < 1200 && !sp.dead && !player.dead; s++) { safe(); if (R.target === sp) aimed = true; }
        check(P + 'a sapper that bombs from range is traced through its bomb and fought until it dies', R.struck - st0 >= 1 && aimed && sp.dead && !player.dead, { attacks: R.struck - st0, starts: R.starts - s0, aimed, dead: sp.dead, steps: s, knightHp: Math.round(player.hp), why: R.why }); }
      // only the monster that attacked: a guard's hit beside a calm boar leaves the boar alone, and a hurt with no monster
      // behind it (a slip off an agility log, a palisade prick, a falling rock) beside a grazing goblin starts no fight
      // (what is watched is who he picks: at night in a long run a grave can open beside him and a skeleton that really
      // attacks is fair game, and his swing at it may clip whatever stands by, so hit points are not the measure)
      { stage(34, 0x5E84); const gd = goblin(player.x + 34, player.y, 'guard_m'); const boar = goblin(player.x + 40, player.y + 30, 'boar'); boar.angry = false; boar.state = 'idle'; boar.stunT = 99;
        monsters = [gd, boar]; const picked = new Set(); const watch = () => { if (R.target) picked.add(R.target); };
        hurtPlayer(1, gd.x, gd.y); watch(); for (let s = 0; s < 60; s++) { safe(); watch(); } const byGuard = !picked.has(gd) && !picked.has(boar);
        const calm = goblin(player.x + 60, player.y); calm.angry = false; calm.state = 'idle'; calm.stunT = 99; monsters = [calm];
        // the guard's blow above knocks the knight back a few pixels, and now and then that left the goblin exactly on a tile
        // centre, the very spot the slip below names, which IS how a monster's own attack is traced: so it stands 9 px off it
        calm.x = tc(Math.floor(calm.x / TILE)) + 9; calm.home = { x: calm.x, y: calm.y };
        const tx = Math.floor(calm.x / TILE), ty = Math.floor(calm.y / TILE);
        hurtPlayer(1, tc(tx), tc(ty), true); watch(); hurtPlayer(2, player.x, player.y + 20, true); watch(); for (let s = 0; s < 60; s++) { safe(); watch(); } const byHazard = !picked.has(calm);
        check(P + 'only the monster that attacked: not a boar beside a guard, not a goblin beside a slip or a prick', byGuard && byHazard, { byGuard, byHazard, picked: [...picked].map(m => m.type) }); }
      // a bow with no arrows: said once, not on every hit, and no swing is tried; with arrows he shoots back
      { const g = stage(34, 0x5E85, true); player.equip.weapon = 'shortbow'; player.inv = player.inv.map(x => x && ITEMS[x.id].arrow ? null : x); R.saidBow = false;
        const notes = []; notify = t => { notes.push(t); return notify0(t); }; const s0 = R.starts; for (let s = 0; s < 600; s++) safe(); notify = notify0;
        const said = notes.filter(t => /arrow/i.test(t)).length, dry = R.starts - s0;
        const g2 = stage(34, 0x5E86); player.equip.weapon = 'shortbow'; addItem('stone_arrow', 40); const a0 = countItem('stone_arrow');
        let s = 0; for (; s < 1500 && !g2.dead && !player.dead; s++) safe(); const shot = a0 - countItem('stone_arrow');
        check(P + 'a bow with no arrows says so once and tries nothing; with arrows he shoots back', said === 1 && dry === 0 && g.hp === g.maxHp && g2.dead && shot >= 1, { said, dry, shot, dead: g2.dead, steps: s }); player.equip.weapon = 'iron_sword'; }
      // the shield up: he is blocking on purpose, so no swing is tried (the game would refuse it and say so every hit)
      if (window.OUTLIERS) { const g = stage(34, 0x5E87, true); player.equip.shield = Object.keys(ITEMS).find(k => ITEMS[k].shape === 'shield');
        const notes = []; notify = t => { notes.push(t); return notify0(t); }; let fought = false;
        for (let s = 0; s < 300; s++) { OUTLIERS.BLOCK.t = 1; safe(); if (R.target) fought = true; } notify = notify0; OUTLIERS.BLOCK.t = block0; player.equip.shield = null;
        const refused = notes.filter(t => /cannot swing/i.test(t)).length;
        check(P + 'with the shield up he blocks and does not swing back', !fought && refused === 0 && g.hp === g.maxHp && R.struck > 0, { fought, refused, goblinHp: g.hp }); }
      // a refused swing (anything the game says no to) is tried once, then not again for a while
      { const g = stage(34, 0x5E88, true); const w0 = player.equip.weapon; let tries = 0;
        const quietWas = R.quiet; safe(); for (let s = 0; s < 240 && R.target !== g; s++) safe();
        const _pa = playerAttack; playerAttack = function () { if (R.own) { tries++; return; } return _pa(); };
        for (let s = 0; s < 240; s++) safe(); playerAttack = _pa; player.equip.weapon = w0;
        check(P + 'a swing the game refuses is tried once, then left for ' + QUIET + ' s', tries === 1 && R.quiet > 0, { tries, quiet: +R.quiet.toFixed(2), quietWas }); R.quiet = 0; }
      // riding: the walker, the bulldozer and the Barrelbeast fight back with the machine's stomp; the horse never does
      { const res = {};
        for (const kind of ['walker', 'dozer', 'beast', 'horse']) {
          const g = stage(50, 0x5E89); player.mech = kind === 'walker' ? { hp: 130, maxHp: 130 } : { hp: 130, maxHp: 130, kind }; player.r = 20; player.speed = 120;
          let s = 0; for (; s < 900 && !g.dead && player.mech; s++) safe(); res[kind] = { dead: g.dead, hp: g.hp, steps: s };
          player.mech = null; player.r = keep.r; player.speed = keep.speed;
        }
        check(P + 'from the walker, the bulldozer and the Barrelbeast he fights back; from the saddle he does not', res.walker.dead && res.dozer.dead && res.beast.dead && !res.horse.dead && res.horse.hp === MONSTER_DEFS.goblin.hp, res); }
      // kid mode keeps it on
      { set(true, true); window.__kidmode = true; set(false, true); F.step([]); const kept = isOn() && player.retaliate === true; window.__kidmode = false;
        check(P + 'kid mode keeps it on', kept, { on: isOn(), saved: player.retaliate }); }
      // the pack control: a real tap on it in the pack flips it, on a phone and an iPad, and it is a finger's size
      { const own = k => Object.getOwnPropertyDescriptor(window, k); const size0 = { w: own('innerWidth'), h: own('innerHeight') }; const res = [];
        window.__forceTouch = true; monsters = [];
        for (const [w, hh] of [[390, 844], [1024, 768]]) {
          try { window.innerWidth = w; window.innerHeight = hh; } catch (e) { }
          set(true, true); closePanel(); openPanel('inventory'); render();
          const b = buttons.find(x => x.label === 'retaliate'); const pr = panelRect && { ...panelRect };
          const inside = !!b && !!pr && b.x >= pr.x && b.y >= pr.y && b.x + b.w <= pr.x + pr.w && b.y + b.h <= pr.y + pr.h;
          const clear = !!b && !buttons.some(o => o !== b && !o.offscreen && o.x < b.x + b.w && b.x < o.x + o.w && o.y < b.y + b.h && b.y < o.y + o.h && buttons.indexOf(o) > buttons.findIndex(q => q.label === '×'));
          if (b) pointerDown(b.x + b.w / 2, b.y + b.h / 2, 21); pointerUp(21); render();
          const off = player.retaliate === false && panel === 'inventory' && label() === 'Fight back when hit: OFF';
          const b2 = buttons.find(x => x.label === 'retaliate'); if (b2) pointerDown(b2.x + b2.w / 2, b2.y + b2.h / 2, 22); pointerUp(22);
          const on = player.retaliate === true && SETTINGS.get('retaliate') === true;
          res.push({ size: `${w}x${hh}`, found: !!b, inside, clear, big: !!b && b.w >= 44 && b.h >= 44, off, on });
          closePanel();
        }
        if (size0.w) { Object.defineProperty(window, 'innerWidth', size0.w); Object.defineProperty(window, 'innerHeight', size0.h); } else { try { delete window.innerWidth; delete window.innerHeight; } catch (e) { } }
        window.__forceTouch = touch0; render();
        check(P + 'the pack has a "Fight back when hit" switch a tap flips (phone and iPad), inside the pack, touching no other control, finger-sized', res.length === 2 && res.every(r => r.found && r.inside && r.clear && r.big && r.off && r.on), res); }
      // Settings mirrors it, O flips it, and the choice survives a save and a load (and goes to the device's settings)
      { set(true, true); openPanel('settings'); render(); const row = F.clickButton('set:retaliate'); const bySettings = player.retaliate === false && !isOn(); closePanel();
        F.press(KEY); const byKey = player.retaliate === true; F.press(KEY);
        let typing = true; if (window.WIKI) { WIKI.open('monsters', null); const was = player.retaliate; F.press(KEY); typing = player.retaliate === was && panel !== null; closePanel(); }
        save(); player.retaliate = true; SETTINGS.set('retaliate', true); const ok = load(); F.step([]);
        const kept = ok && player.retaliate === false && !isOn() && SETTINGS.get('retaliate') === false;
        const listed = SETTINGS.keyMap().some(r => r.codes.includes(KEY));
        set(true, true); save();
        check(P + 'Settings mirrors the switch, O flips it (not while typing in the wiki), and OFF survives a save and a load', row && bySettings && byKey && typing && kept && listed, { row, bySettings, byKey, typing, kept, listed }); }
      // online: a puppet (someone else keeps the map) that hits us is hit back, and the hit goes to the keeper
      if (typeof NET !== 'undefined' && window.COOP) {
        const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake };
        const sent = []; let sock = null;
        const push = msg => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(msg) }); };
        const fake = { call: async () => ({}), open: () => { sock = { readyState: 1, send(str) { const m = JSON.parse(str); sent.push(m); if (m.t === 'hello') push({ t: 'welcome', me: 'Cohen', at: 0, keeper: 'Cohen' }); }, close() { sock.readyState = 3; } }; return sock; } };
        monsters = real;
        try {
          Math.random = mulberry32(0x5E81); set(true, true); h.peace(true); R.hold = 0;
          const o = h.openSpot(ATLAS.world.tx(40), ATLAS.world.ty(24)); F.tp(o.x, o.y); player.hp = player.maxHp; player.attackCd = 0;
          NET.enabled = true; NET.token = 'retaliate-test'; NET.useFake(fake); NET.connect();
          push({ t: 'keeper', map: 'over', n: 'Ann' });
          const row = x => ['Ann:7', 'goblin', x, player.y, 12, 12, 'chase', -1, 0, 0, 0, 0, 0, 0];
          push({ t: 'mon', n: 'Ann', list: [row(player.x + 30)] });
          const p = COOP.find('Ann:7'); sent.length = 0;
          push({ t: 'hurt', dmg: 1, x: p ? Math.round(p.x) : 0, y: p ? Math.round(p.y) : 0 });
          const aimed = R.target === p;
          for (let s = 0; s < 40; s++) { if (s % 6 === 0) push({ t: 'mon', n: 'Ann', list: [row(player.x + 30)] }); F.step([]); }
          const hits = sent.filter(m => m.t === 'hit' && m.nid === 'Ann:7');
          check(P + 'online: a shared monster (a puppet) that hits us is hit back, and the hit goes to the keeper', !!p && p.remote && aimed && hits.length >= 1, { puppet: !!p, aimed, hits: hits.length, why: R.why });
        } finally {
          stop('test'); NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null; COOP.reset();
        }
      }
    } finally {
      const touched = new Set();
      for (const [x, y, t, had, v] of ground) { const i = idx(x, y); touched.add(i); if (map[i] !== t) { setTile(x, y, t); miniDirtyTiles.add(i); } if (had) mapDiffs.set(i, v); else mapDiffs.delete(i); }
      if (graves0) { quest.graves.length = 0; quest.graves.push(...graves0); } else delete quest.graves;
      if (laid0 !== null && quest.graveNight) quest.graveNight.laid = laid0;
      regrow = regrow.filter(r => regrow0.has(r) || !touched.has(r.i)); fires = fires.filter(f => fires0.has(f) || !touched.has(f.i));
      // and the clock: these fights take game minutes, and dusk arriving earlier would put the Voice's "the light is going"
      // line (and the night's graves) into whatever check runs next
      if (keep.dayTime !== undefined) player.dayTime = keep.dayTime;
      projectiles = [...proj0]; Math.random = r0; notify = notify0; if (!keep.dead) { player.dead = false; player.deadT = 0; } if (window.OUTLIERS) OUTLIERS.BLOCK.t = block0; R.quiet = 0; monsters = real; stop('test'); closePanel(); dialog.cur = null; dialog.queue.length = 0;
      window.__kidmode = kid0; window.__peace = peace0; window.__forceTouch = touch0;
      player.x = keep.x; player.y = keep.y; player.hp = Math.max(1, keep.hp); player.kills = keep.kills; player.skills = JSON.parse(keep.skills); player.facing = keep.facing;
      player.mech = keep.mech; player.r = keep.r; player.speed = keep.speed; player.inv = JSON.parse(keep.inv); player.companion = keep.companion; Object.assign(player.equip, keep.equip); recomputeMaxHp(); player.hp = Math.min(player.hp, player.maxHp); if (keep.law) player.law = JSON.parse(keep.law); else delete player.law;
      drops = drops.slice(0, keep.drops); set(on0 !== false, true); render();
    }
  });

  return { isOn, set, toggle, state: R, LEASH, ANCHOR, KEY, label, packRect: () => { const b = buttons.find(q => q.label === 'retaliate'); return b ? { x: b.x, y: b.y, w: b.w, h: b.h } : null; }, attackerAt };
})();
window.RETALIATE = RETALIATE;
