// ============================================================================
// THE WORLD KEEPER — the stand-in knight of a server game copy (docs/ONLINE.md, "The shared world")
// Owner-approved plan: the world server runs the monsters in its own copy of this game, so every knight on a map sees
// the same world. In a browser this file does nothing at all: there is no window.__worldKeeper there.
// In a copy (online/src/sim/host.js sets window.__worldKeeper = { map, worldGen, send, reseed } before the game loads):
//   - save() does nothing (a copy has no knight to save);
//   - worldGen: false makes generateWorld() a blank map with no spawns (an instance copy that builds the same without
//     the overworld; tools/sim-suite.mjs proves which ones);
//   - WORLDKEEPER.start() starts a new game the way the title does, enters the instance for an instance map, and points
//     NET at a virtual socket: NET.online() is true and NET.me is '@world:<map>', which the socket's welcome names the
//     keeper, so 75-coop's keeper half runs here. What the copy sends goes to send(msg); deliver(msg) hands the copy a
//     message as if the world sent it (a knight's p, left, hit, boss_call);
//   - the stand-in knight is parked dead on the solid tile (0, 0) and its deadT is zeroed before every step(dt), so it
//     never respawns (respawnPoint() and an instance's leaveInstance() never run) and every monster takes a real knight
//     as its target through 75-coop (a dead player is never the nearest);
//   - SERVER_OFF switches off the HOOKS entries (by file and hook name) that would act on the dead stand-in. A file
//     leaves the list when it is ported. Each copy's HOOKS functions carry the file that registered them (fn.__file,
//     tagged by tools/build-sim.mjs), which is how the list finds them.
//   Stage 2 (the copy keeps a map for real):
//   - WORLDKEEPER.rows() is what the world sends of its monsters each tick: 75-coop's row, then [tgt, lock, phase, vx, vy,
//     look] (docs/ONLINE.md), the look fields read from window.__LOOK_FIELDS, which tools/build-sim.mjs writes from
//     78-monsterlook's LOOK_FIELDS when it builds the copy (the look file itself is stripped);
//   - the kill goes to the top damager: dmgBy per monster (each knight's hits, counted up to the hp the monster had), a tie
//     to the first hitter; the ledger starts again at full health;
//   - a monster's bomb (a thrower's sticky, which 75-coop's stepRemote throws at knights in a copy) hurts every knight in
//     its blast; the copy's own rollDrops makes nothing (the credited knight's game rolls his);
//   - rests() / setRests() hand the boss rests (75-coop's restAt) to the world's realm_state and back;
//   - the copy's own snapshots and presence never leave it.
// Feature file: registers through HOOKS only, edits no core file. window.WORLDKEEPER is the register (copies only).
// ============================================================================
{
  const WK = window.__worldKeeper;
  // file -> the HOOKS lists of that file that stay off in a copy. The first list is the Stage 0 audit (tools/sim-audit.mjs,
  // 30 minutes through the 21 overworld regions and 5 in each instance, every boss called): these hooks created, removed or
  // hurt monsters on their own, outside the 75-coop path. Each leaves the list when its file is ported (the spec's stage):
  // 20-hollowford the War Shed's Barrelbeast cleared away after it falls (8); 28-thefang the Fang's own rest (6d);
  // 33-goblincity the Gnasher cleared away after it falls (8); 66-storm the Thunderbird's own hurts (8);
  // 91-royalmine the golem's split, golemlings and the giants (8). No hook changed the parked stand-in.
  const SERVER_OFF = {
    '20-hollowford': ['update'],
    '28-thefang': ['update'],
    '33-goblincity': ['update'],
    '66-storm': ['hit', 'update'],
    '91-royalmine': ['update'],
  };
  const PARK = { tx: 0, ty: 0 };   // solid on the overworld (the cave's corner) and in every instance (its wall corner)

  if (WK && typeof WK === 'object') {
    const mapName = typeof WK.map === 'string' && WK.map ? WK.map : 'over';
    const me = '@world:' + mapName;
    const noSave = function () { };
    noSave.__worldKeeperNoop = true;
    save = noSave;
    if (WK.worldGen === false) {
      // a blank map with no spawns: the instance writes its own tiles and monsters when it is entered
      generateWorld = function () { MONSTER_SPAWNS.length = 0; map.fill(T.WALL); variant.fill(0); };
    }
    let sock = null, started = false;
    const off = [];
    const send = m => { if (typeof WK.send === 'function') WK.send(m); };
    const fake = {
      call: async () => { throw new Error('no world calls from a server game copy'); },
      open: () => {
        sock = {
          readyState: 1,
          send(str) {
            let m = null; try { m = JSON.parse(str); } catch (e) { return; }
            if (!m || typeof m.t !== 'string') return;
            // the virtual socket's own welcome: this copy is the keeper of its map
            if (m.t === 'hello') { deliver({ t: 'welcome', me, at: Date.now(), keeper: me, role: 'player', map: mapName }); return; }
            // the copy's own snapshots (the world sends rows() each tick instead) and its stand-in's presence stay here
            if (m.t === 'mon' || m.t === 'p') return;
            send(m);
          },
          close() { sock.readyState = 3; },
        };
        return sock;
      },
    };
    function deliver(msg) {
      if (!sock || !sock.onmessage) return false;
      // taking a map over from a knight's game (docs/ONLINE.md, Stage 2): his stream lists every monster within 24 tiles of a
      // knight that is alive or fell under 2 s ago. One of this copy's own monsters standing that near a knight but missing
      // from his stream is down in his game: it lies down here too (and stands up on its own respawn timer) instead of
      // coming back to life in the hand-over
      const m0 = typeof msg === 'string' ? (() => { try { return JSON.parse(msg); } catch (e) { return null; } })() : msg;
      if (m0 && m0.t === 'keeper' && m0.n === me && window.COOP && COOP.puppets() && COOP.parked) settleUnseen();
      sock.onmessage({ data: typeof msg === 'string' ? msg : JSON.stringify(msg) });
      return true;
    }
    function settleUnseen() {
      const seen = new Set(COOP.puppets().filter(p => !p.gone).map(p => p.nid)), ks = COOP.knightsHere();
      for (const m of COOP.parked) {
        if (m.dead || !m.nid || seen.has(m.nid)) continue;
        if (!ks.some(k => dist(m.x, m.y, k.x, k.y) <= 24 * TILE)) continue;
        const d = MONSTER_DEFS[m.type] || {};
        m.dead = true; m.deadT = 9; m.hp = 0; m.respawnT = (d.respawn || 25) + Math.random() * 10;
        if (isCampMonster(m)) m.respawnT = Math.max(m.respawnT, CAMP_RESPAWN);
        const I = window.INSTANCES, inst = I && I.active && I.active() ? I.get(I.active()) : null;
        if (inst && inst.boss === m.type) m.respawnT = Infinity;
      }
    }
    function park() {
      player.dead = true; player.deadT = 0; player.hp = 0;
      player.x = tc(PARK.tx); player.y = tc(PARK.ty);
      player.action = null; player.moving = false; player.mech = null;
    }
    function applyServerOff() {
      for (const hook of Object.keys(HOOKS)) {
        const list = HOOKS[hook]; if (!Array.isArray(list)) continue;
        for (let i = list.length - 1; i >= 0; i--) {
          const f = list[i], file = f && f.__file, rule = file && SERVER_OFF[file];
          if (rule && (rule === '*' || rule.includes(hook))) { list.splice(i, 1); off.push({ file, hook }); }
        }
      }
    }
    function start() {
      if (started) return WORLDKEEPER;
      newGame();
      try { title.active = false; } catch (e) { }
      // the host's fresh dice from here on, so a copy's run never depends on how many it rolled while it was built
      if (typeof WK.reseed === 'function') WK.reseed();
      if (mapName !== 'over') {
        if (!window.INSTANCES || !INSTANCES.enter(mapName)) throw new Error('the copy could not enter ' + mapName);
      }
      NET.enabled = true; NET.token = 'world'; NET.useFake(fake); NET.token = 'world';
      if (!NET.connect() || !NET.online() || NET.me !== me) throw new Error('the virtual socket did not open');
      if (WK.serverOff !== false) applyServerOff();   // only tools/sim-audit.mjs says false: it audits everything
      park();
      started = true;
      return WORLDKEEPER;
    }
    // one substep of the game: the stand-in stays parked dead, then the game's own update (every wrapper included)
    function step(dt) { park(); update(dt); }
    // ---------- Stage 2: what the world sends of this copy's monsters ----------
    const LF = window.__LOOK_FIELDS && typeof window.__LOOK_FIELDS === 'object' ? window.__LOOK_FIELDS : {};
    const r2 = v => Math.round(v * 100) / 100;
    // the one extra state each type's look reads (78-monsterlook's LOOK_FIELDS), from the fields the game sets on the monster
    const PHASE_OF = {
      thunderbird: m => (m.phase === 'hunt' || m.phase === 'high' || m.phase === 'perch') ? m.phase : null,
      the_fang: m => typeof m.element === 'string' ? m.element : null,
      zombie_brute: m => (m.windT || 0) > 0 ? 'wind' : (m.stagT || 0) > 0 ? 'stagger' : null,
      cinderwight: m => (m.coldT || 0) > 0 ? 'cold' : (m.heart && !m.heart.dead) ? 'feed' : null,
      barrelbeast: m => (m.rodGlow || 0) > 0 ? 'volley' : null,
      gnasher: m => (m.armT || 0) > 0 ? 'arm' : null,
      bulldozer: m => (m.chargeT || 0) > 0 ? 'charge' : null,
      yard_dozer: m => (m.chargeT || 0) > 0 ? 'charge' : null,
      // his mend ring (91-royalmine's mendFlash, 0.9 s): not in LOOK_FIELDS, sent as phase 'mend' (the monster-look addendum)
      ginormous_golem: m => { const R = window.ROYALMINE && ROYALMINE.run; return R && typeof R.mendFlash === 'number' && time - R.mendFlash >= 0 && time - R.mendFlash < 0.9 ? 'mend' : null; },
    };
    const LOOK_OF = {
      ally_knight: m => (m.ally === 'hale' || m.ally === 'garrick') ? { ally: m.ally } : null,
      cinder_heart: m => (typeof m.emberT === 'number' && isFinite(m.emberT)) ? { emberT: r2(m.emberT) } : null,
    };
    const lastAt = new WeakMap();
    function targetOf(m, ks) {
      if (m.dead || m.state !== 'chase') return null;
      let best = null, bd = Infinity;
      for (const k of ks) { if (k.dead) continue; const d = dist(m.x, m.y, k.x, k.y); if (d < bd) { bd = d; best = k; } }
      return best ? best.n : null;
    }
    function rows(radius) {
      const R = typeof radius === 'number' ? radius : 27 * TILE;
      const ks = COOP.knightsHere(), out = [];
      if (!ks.length) return out;
      for (const m of monsters) {
        if (m.remote || m.phantom) continue;
        if (m.dead && !(m.deadT < 2)) continue;
        let near = false;
        for (const k of ks) if (dist(m.x, m.y, k.x, k.y) <= R) { near = true; break; }
        if (!near) continue;
        if (!m.nid) { m.nid = me + ':' + (++COOP.state.counter); COOP.state.idxLen = -1; }
        const f = m.facing || { x: 1, y: 0 };
        const row = [m.nid, m.type, Math.round(m.x), Math.round(m.y), r2(m.hp || 0), r2(m.maxHp || 0), typeof m.state === 'string' ? m.state : 'idle', r2(f.x || 0), r2(f.y || 0), m.moving ? 1 : 0, r2(m.hurtT || 0), m.dead ? 1 : 0, r2(m.attackT || 0), r2(m.stunT || 0)];
        let vx = null, vy = null;
        const was = lastAt.get(m);
        if (was && time > was.t) { const ax = (m.x - was.x) / (time - was.t), ay = (m.y - was.y) / (time - was.t), sp = Math.hypot(ax, ay); if (sp >= 1 && sp < 2000) { vx = Math.round(ax); vy = Math.round(ay); } }
        lastAt.set(m, { x: m.x, y: m.y, t: time });
        const extra = [targetOf(m, ks), null, PHASE_OF[m.type] ? PHASE_OF[m.type](m) : null, vx, vy, LOOK_OF[m.type] ? LOOK_OF[m.type](m) : null];
        let n = extra.length; while (n > 0 && extra[n - 1] == null) n--;
        for (let i = 0; i < n; i++) row.push(extra[i]);
        out.push(row);
        if (out.length >= 400) break;
      }
      return out;
    }
    // every look field the copy carries, by type (tools/sim-suite.mjs check 6 holds it against window.__LOOK_FIELDS)
    const carries = () => { const out = {}; for (const t of Object.keys(PHASE_OF)) out[t] = 'phase'; for (const t of Object.keys(LOOK_OF)) out[t] = Object.keys(LOOK_OF[t]({ ally: 'hale', emberT: 1 }) || {})[0]; return out; };

    // the kill goes to the top damager (a tie: whoever hit it first); named bosses keep their helper credit in 75-coop
    let hitSeq = 0;
    const _hitMonster = hitMonster;
    hitMonster = function (m, dmg, knock, fromBomb, source) {
      if (m && !m.remote && !m.phantom && !m.dead && source === 'remote' && typeof m.lastHitBy === 'string' && m.lastHitBy) {
        if (!m.dmgBy || (m.hp || 0) >= (m.maxHp || 0)) m.dmgBy = {};   // a fresh fight
        const e = m.dmgBy[m.lastHitBy] || (m.dmgBy[m.lastHitBy] = { d: 0, first: ++hitSeq });
        e.d += Math.max(0, Math.min(Number(dmg) || 0, m.hp || 0));
      }
      return _hitMonster(m, dmg, knock, fromBomb, source);
    };
    hitMonster.__inner = _hitMonster;
    const _killMonster = killMonster;
    killMonster = function (m) {
      if (m && !m.remote && !m.phantom && m.dmgBy) {
        let top = null;
        for (const n of Object.keys(m.dmgBy)) { const e = m.dmgBy[n]; if (!top || e.d > top.e.d || (e.d === top.e.d && e.first < top.e.first)) top = { n, e }; }
        if (top) m.lastHitBy = top.n;
        m.dmgBy = null;
      }
      return _killMonster(m);
    };
    killMonster.__inner = _killMonster;
    // a monster's bomb hurts every knight in its blast (the parked stand-in is far away and dead)
    const _explode = explode;
    explode = function (x, y, radius, dmgMin, dmgMax, owner) {
      if (owner !== 'player') for (const k of COOP.knightsHere()) if (!k.dead && dist(k.x, k.y, x, y) < radius + 13) NET.send({ t: 'hurt', to: k.n, dmg: rint(dmgMin, dmgMax), x: Math.round(x), y: Math.round(y) });
      return _explode(x, y, radius, dmgMin, dmgMax, owner);
    };
    rollDrops = function () { };
    // the boss rests, seconds left by boss id, out to the world's realm_state and back into a copy built again
    function rests() {
      const out = {}, R = COOP.state.restAt;
      for (const id of Object.keys(R)) { const h = HOOKS.bossCall[id], rest = h ? Number(h.rest) || 0 : 0, left = rest - (time - R[id]); if (rest > 0 && time >= R[id] && left > 0) out[id] = left; }
      return out;
    }
    function setRests(left) {
      const R = COOP.state.restAt;
      for (const id of Object.keys(left || {})) { const h = HOOKS.bossCall[id], rest = h ? Number(h.rest) || 0 : 0, l = Number(left[id]); if (rest > 0 && l > 0) R[id] = time - (rest - Math.min(rest, l)); }
    }
    window.WORLDKEEPER = { map: mapName, me, start, step, deliver, park, off, SERVER_OFF, PARK, rows, carries, rests, setRests, LOOK_FIELDS: LF, get started() { return started; } };
  }

  HOOKS.selfTest.push(check => {
    check('worldkeeper: in a browser the stand-in does nothing (no window.WORLDKEEPER, save() is the game\'s own, the wire is not the virtual socket)',
      !window.__worldKeeper && !window.WORLDKEEPER && typeof save === 'function' && !save.__worldKeeperNoop && !(typeof NET !== 'undefined' && typeof NET.me === 'string' && NET.me.startsWith('@world:')),
      { wk: !!window.WORLDKEEPER, me: typeof NET !== 'undefined' ? NET.me : null });
  });
}
