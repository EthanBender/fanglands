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
// Who counts as the attacker: the nearest live monster standing at the spot the hit came from (hurtPlayer's fromX,
// fromY). hurtPlayer is wrapped rather than HOOKS.hurt used, because HOOKS.hurt does not run for a miss or for a hit
// taken inside a machine, and a miss is still an attack. People who only turn on the knight for something he did (the
// watch, the dwarf and castle guards, the sentinels: human and not aggressive) are never fought back automatically:
// that would make a small crime a big one without the child choosing it.
// Online (75-coop): a non-keeper is hurt by a 'hurt' message carrying the keeper's monster position; the puppet there is
// the attacker, and the swing goes through hitMonster, which routes a hit on a puppet to the keeper.
// Feature file: HOOKS plus wrapped core functions (hurtPlayer, useAction, talkTo, panelBox, drawPanels). Test handle:
// window.RETALIATE.
// ============================================================================
const RETALIATE = (() => {
  const LEASH = 4 * TILE;    // how far past his reach he walks to a monster that hit him
  const ANCHOR = 5 * TILE;   // never further than this from where he was hit
  const FIND = TILE;         // the attacker stands within its own radius + this of the spot the hit came from
  const GIVE_UP = 6;         // seconds without a swing (walking into something the whole time) and he stops
  const MAX_PATH = 8;        // a way round longer than this many steps is not "the short way": he stays put
  const KEY = 'KeyO';
  const HOLD = 2;            // seconds after a swing of his own in which a hit does not take the fight over (he is already fighting)
  const R = { target: null, anchor: null, idle: 0, path: null, repathT: 0, stuckT: 0, why: null, starts: 0, swings: 0, struck: 0, hold: 0, own: false };
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
  const peacekeeper = def => !!def.human && !def.aggro;
  function live(m) { return !!m && !m.dead && !m.gone && monsters.includes(m) && !!MONSTER_DEFS[m.type] && !MONSTER_DEFS[m.type].harmless; }
  function attackerAt(x, y) {
    let best = null, bd = Infinity;
    for (const m of monsters) {
      if (m.dead || m.gone) continue; const def = MONSTER_DEFS[m.type]; if (!def || def.harmless || peacekeeper(def)) continue;
      const d = dist(x, y, m.x, m.y); if (d <= (m.r || 12) + FIND && d < bd) { bd = d; best = m; }
    }
    return best;
  }
  const horse = () => !!(player.mech && player.mech.kind === 'horse');   // 51-mounts: no swinging from the saddle
  const moving = () => inputVector().m > 0;
  // walking somewhere on purpose, fighting something he tapped, a panel or the menu up: he is busy, a hit does not turn him
  const tapBusy = () => typeof tapActive === 'function' && tapActive() && !(tap.gather && !tap.kind && !tap.path);
  function struck(fx, fy) {
    if (player.dead || !Number.isFinite(fx) || !Number.isFinite(fy)) return;
    const m = attackerAt(fx, fy); if (!m) return;
    R.struck++;                                              // a monster attacked (hit or miss): counted whether or not he answers
    if (!isOn() || horse()) return;
    if (live(R.target)) return;                              // already fighting back: he keeps the one he is on
    if (R.hold > 0) return;                                  // swinging on his own just now: already in a fight he chose (RuneScape does the same)
    if (paused || panel || moving() || tapBusy()) return;
    if (typeof tapActive === 'function' && tapActive()) tapCancel('retarget');   // a tap-to-chop loop: the hit ends it
    player.action = null;
    R.target = m; R.anchor = { x: player.x, y: player.y }; R.idle = 0; R.path = null; R.repathT = 0; R.stuckT = 0; R.why = null; R.starts++;
  }
  function stop(why) { if (R.target) R.why = why; R.target = null; R.path = null; }

  // ---------- the wrapped core ----------
  { const _hurtPlayer = hurtPlayer;
    hurtPlayer = function (dmg, fromX, fromY, sure) { const r = _hurtPlayer(dmg, fromX, fromY, sure); struck(fromX, fromY); return r; }; }
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
    const reach = reachOf(m), d = dist(player.x, player.y, m.x, m.y);
    if (d > reach + LEASH || dist(player.x, player.y, R.anchor.x, R.anchor.y) > ANCHOR) return stop('ran');
    R.idle += dt;
    if (d <= reach) {
      R.path = null; R.stuckT = 0; face(m.x, m.y); player.moving = false;
      if (player.attackCd <= 0) {
        R.own = true; try { playerAttack(); } finally { R.own = false; }
        // refused (no arrows, the shield is up, ...): the game has already said why once; he stops rather than ask every frame
        if (player.attackCd <= 0) return stop('cannot');
        R.swings++; R.idle = 0;
      }
    } else walkToward(m, dt);
    if (R.target && R.idle > GIVE_UP) stop('stuck');
  }
  HOOKS.update.push(dt => {
    syncPlayer();
    R.hold = Math.max(0, R.hold - dt);
    if (window.__kidmode && player.retaliate === false) set(true, true);   // kid mode keeps it on
    if (pressed.has(KEY) && !paused) toggle();
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
  // Wide packs (10 columns) have room at the right end of the Eat / Drop row. A narrow (phone) pack has none, so it
  // grows by one row and the switch sits along its foot, right of the worn column.
  const PACK = 'Your pack';
  const narrowPack = () => VW < 640;
  const footH = () => HK.row() + 16;
  { const _panelBox = panelBox;
    panelBox = function (g, w, h, title, subtitle) { if (title === PACK && narrowPack()) h += footH(); return _panelBox(g, w, h, title, subtitle); }; }
  const label = () => `Fight back when hit: ${isOn() ? 'ON' : 'OFF'}`;
  function packRect() {
    if (!panelRect) return null;
    const rowH = HK.row(), eqw = 70, { x: px, y: py, w, h } = panelRect;
    if (narrowPack()) return { x: px + 18 + eqw, y: py + h - rowH - 14, w: w - 36 - eqw, h: rowH };
    const cols = 10, size = 46, gap = 6, gy = py + 66 + Math.ceil(INV_SLOTS / cols) * (size + gap), bw = 220;
    return { x: px + w - 18 - bw, y: gy + 58, w: bw, h: rowH };
  }
  function drawPackControl(g) {
    const r = packRect(); if (!r) return;
    HK.control(g, r.x, r.y, r.w, r.h, label(), () => { if (window.__kidmode) { notify('Kid mode keeps fighting back on. Turn kid mode off in Settings to change it.'); return; } toggle(); }, { tone: isOn() ? HK.C.GOOD : null, on: isOn(), hit: 'retaliate' });
  }
  { const _drawPanels = drawPanels;
    drawPanels = function (g, narrow, short, qh, hb) { const r = _drawPanels(g, narrow, short, qh, hb); if (panel === 'inventory' && !paused) drawPackControl(g); return r; }; }

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'fight back: ';
    const real = monsters, kid0 = window.__kidmode, on0 = player.retaliate, peace0 = window.__peace, touch0 = window.__forceTouch;
    const keep = { x: player.x, y: player.y, hp: player.hp, kills: player.kills, skills: JSON.stringify(player.skills), facing: { ...player.facing }, drops: drops.length, mech: player.mech, equip: { ...player.equip }, companion: player.companion, law: player.law ? JSON.stringify(player.law) : null };
    const r0 = Math.random;
    // a world of one goblin: nothing else can wander in, hit him or be hit (the real array is put back in finally)
    const goblin = (x, y) => { const d = MONSTER_DEFS.goblin; return { type: 'goblin', x, y, home: { x, y }, r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: true, state: 'chase', wanderT: 99, wander: { x: 0, y: 0 }, attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 0, facing: { x: -1, y: 0 }, walkT: 0, moving: false, stunT: 0 }; };
    // tough: a goblin that must still be standing when the check looks (a knight fresh off the playthrough kills one in a swing)
    const stage = (dx, seed, tough) => {
      Math.random = mulberry32(seed); closePanel(); dialog.cur = null; dialog.queue.length = 0; if (typeof tapCancel === 'function') tapCancel('manual');
      const o = h.openSpot(40, 24); F.tp(o.x, o.y); player.hp = player.maxHp; player.facing = { x: -1, y: 0 }; player.attackCd = 0; player.attackT = 0; player.action = null; stop('test'); R.hold = 0;
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
        save(); player.retaliate = true; SETTINGS.set('retaliate', true); const ok = load(); F.step([]);
        const kept = ok && player.retaliate === false && !isOn() && SETTINGS.get('retaliate') === false;
        const listed = SETTINGS.keyMap().some(r => r.codes.includes(KEY));
        set(true, true); save();
        check(P + 'Settings mirrors the switch, O flips it, and OFF survives a save and a load', row && bySettings && byKey && kept && listed, { row, bySettings, byKey, kept, listed }); }
      // online: a puppet (someone else keeps the map) that hits us is hit back, and the hit goes to the keeper
      if (typeof NET !== 'undefined' && window.COOP) {
        const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake };
        const sent = []; let sock = null;
        const push = msg => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(msg) }); };
        const fake = { call: async () => ({}), open: () => { sock = { readyState: 1, send(str) { const m = JSON.parse(str); sent.push(m); if (m.t === 'hello') push({ t: 'welcome', me: 'Cohen', at: 0, keeper: 'Cohen' }); }, close() { sock.readyState = 3; } }; return sock; } };
        monsters = real;
        try {
          Math.random = mulberry32(0x5E81); set(true, true); h.peace(true); R.hold = 0;
          const o = h.openSpot(40, 24); F.tp(o.x, o.y); player.hp = player.maxHp; player.attackCd = 0;
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
      Math.random = r0; monsters = real; stop('test'); closePanel(); dialog.cur = null; dialog.queue.length = 0;
      window.__kidmode = kid0; window.__peace = peace0; window.__forceTouch = touch0;
      player.x = keep.x; player.y = keep.y; player.hp = Math.max(1, keep.hp); player.kills = keep.kills; player.skills = JSON.parse(keep.skills); player.facing = keep.facing;
      player.mech = keep.mech; player.companion = keep.companion; Object.assign(player.equip, keep.equip); recomputeMaxHp(); player.hp = Math.min(player.hp, player.maxHp); if (keep.law) player.law = JSON.parse(keep.law); else delete player.law;
      drops = drops.slice(0, keep.drops); set(on0 !== false, true); render();
    }
  });

  return { isOn, set, toggle, state: R, LEASH, ANCHOR, KEY, label, packRect, attackerAt };
})();
window.RETALIATE = RETALIATE;
