// ============================================================================
// COOP — shared monsters: two knights on the same map fight the same goblin
// Owner: "make it an online MMORPG so Cohen and his friends can log in and play together."
// docs/ONLINE.md ("The keeper model, in the client") is the contract this file keeps to. The server names one
// knight per map the keeper. The keeper's client runs the monsters as it always has and streams a snapshot
// eight times a second; everyone else on that map parks its own monster array, shows puppets built from the
// stream, and routes its hits to the keeper. The keeper's monsters chase whichever knight is nearest, the
// killing blow's owner gets the drops, and when the keeper leaves the next knight turns its puppets back
// into real monsters. Nothing in here moves the local knight, touches the pack, or grants XP except through
// the kill and hurt paths the contract names; every incoming field is checked before it is used.
// Feature file: registers through HOOKS only, edits no core file. window.COOP is the register.
// ============================================================================
{
  const SNAP_EVERY = 0.125;   // seconds between keeper snapshots (8/s is the cap in the contract)
  const LERP_T = 0.12;        // seconds a puppet takes to glide onto a new snapshot position
  const GONE_AFTER = 1;       // a puppet missing from the stream this long is hidden
  const DROP_AFTER = 2;       // ...and dropped from the array this long after that
  const STALL_AFTER = 6;      // when the WHOLE stream has stopped, everything stays standing this long (longer than a handoff takes)
  const NEAR = 24 * TILE;     // snapshot radius around every knight on the map
  const FREEZE = 1e6;         // the stunT value that makes the core loop skip a monster for one frame
  const MAX_DMG = 500;
  const REMOTE_STALE = 15;    // seconds without presence before a remote knight is forgotten
  const KNIGHT_R = 13;

  const S = { map: 'over', keeper: null, puppets: null, parked: {}, remotes: {}, counter: 0, snapAcc: 0, here: [], idxArr: null, idxLen: -1, byNid: new Map(), calls: {}, pending: null, sentAt: -1e9, restAt: {}, lootless: false,
    // the teacher view's Watch (round 2, docs/ONLINE.md "The teacher view"). On a kid's game: viewed (the world said
    // {t: 'view', on: true}: a teacher is watching this knight), and the alone stream's clock. On the teacher's own page:
    // view (79-view draws a kid's screen here: puppets only, from the frames the world forwards), the keeper of each map, and
    // the gap between snapshots (the puppets glide over it).
    viewed: false, alone: { acc: 0, last: null, at: -1e9, sent: 0 }, view: false, viewKeepers: {}, viewGap: 0.12, viewMonAt: -1e9, viewReal: null };
  // the alone stream (a kid watched by a teacher, keeping his map with nobody near): at most every ALONE_EVERY s, an unchanged
  // list skipped except one every ALONE_KEEP s; never while paused or on the title
  const ALONE_EVERY = 0.5, ALONE_KEEP = 5, VIEW_GAP_MIN = 0.12, VIEW_GAP_MAX = 0.6;
  const aloneReset = () => { S.alone.acc = 0; S.alone.last = null; S.alone.at = -1e9; };
  // ?debug=tick (docs/ONLINE.md, Stage 2): the world's tick and how often its stream lands (kept out of S, which is COOP.state)
  const DBG = { k: null, rows: 0, times: [] };
  // While the world keeps this map ('@world:<map>', Stage 2): the last row it sent of each monster by nid (kept after the
  // monster leaves this knight's 24 tiles, and after a fallen one's row stops coming), and how many monsters stand in the
  // whole place (mon's 'standing'). When the socket drops (an iPad lock) or the world hands the map to this game, the
  // monsters become real as the world last showed them (keepWorld), never as they stood when this knight walked in.
  // kept: the world kept this map, and another knight has been named its keeper since while its monsters were on this screen
  // as the world's puppets (a wake names a knight keeper out loud, and that may be a friend whose iPad is still locked). The
  // rows are kept until this game keeps the map (keepWorld, not handoff) or leaves it: the friend's game may never answer.
  const WORLD = { rows: new Map(), standing: null, kept: false };
  const isWorld = n => typeof n === 'string' && n.indexOf('@world:') === 0;
  const clearWorld = () => { WORLD.rows = new Map(); WORLD.standing = null; WORLD.kept = false; };
  const worldLast = () => isWorld(S.keeper) || WORLD.kept;
  // Named bosses (docs/ONLINE.md, "Named bosses: boss_call and helper credit"). A boss file registers how its boss is woken in
  // HOOKS.bossCall[id] = { map, near: [tx, ty, tiles] | null, alive: () => bool, wake: askerName|null => void, name, type,
  //   rest: seconds | undefined, resting: m => bool, told: askerName => string, refused: secondsLeft => void };
  // COOP.call(id, first) wakes it here when this knight runs the map, and otherwise asks the map's keeper. Every knight who
  // landed CREDIT_HITS hits on one of these in the last CREDIT_FOR seconds gets the kill, not only the one who landed the last.
  // The rest lives where the boss lives: the keeper remembers when each one fell (S.restAt) and answers a call inside `rest`
  // with boss_wait, unless the caller says it is his own first fight. And the pay is each knight's own: `resting(m)` says this
  // knight is still resting from his last paid kill, and then his kill pays nothing (no purse, no drops, no dragon item, no
  // kill bonus): m.noPay, which the boss files, 30-ashdrake, 45-progression and 37-dragonkillers read.
  HOOKS.bossCall = HOOKS.bossCall || {};
  const CREDIT = new Set(['the_fang', 'barrelbeast', 'thunderbird', 'gnasher', 'brood_mother', 'count_ashvane']);
  const CREDIT_HITS = 3, CREDIT_FOR = 60;
  // CALL_GAP: the keeper wakes one boss at most this often, whoever asks. CALL_WAIT: a call nobody answered in this long
  // says so. SEND_GAP: this game sends a boss_call at most this often (the world's cap is 0.5 a second, a burst of 2).
  const CALL_GAP = 3, CALL_WAIT = 3, SEND_GAP = 2.5;

  const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
  const mmss = s => { const c = Math.max(0, Math.ceil(s)); return Math.floor(c / 60) + ':' + String(c % 60).padStart(2, '0'); };
  // the named-boss entry for a monster type on this map (the square's Barrelbeast and the shed's share a type: the entry
  // whose map is this one wins, else any with the type, for its pay rule)
  const entryOf = type => { let any = null; for (const id of Object.keys(HOOKS.bossCall)) { const h = HOOKS.bossCall[id]; if (!h || h.type !== type) continue; if (h.map === S.map) return [id, h]; if (!any) any = [id, h]; } return any; };
  const r2 = v => Math.round(v * 100) / 100;
  const mapId = () => {
    const I = window.INSTANCES; if (!I) return 'over';
    const a = typeof I.active === 'function' ? I.active() : (I.active && I.active.id);
    return typeof a === 'string' && a ? a : 'over';
  };
  const online = () => typeof NET !== 'undefined' && NET.online();
  const isKeeper = () => online() && S.keeper !== null && S.keeper === NET.me;
  const puppetMode = () => (S.view && S.puppets !== null) || (online() && S.puppets !== null && S.keeper !== null && S.keeper !== NET.me);

  // ---------- nids: a stable name for every monster, the same on every client ----------
  function index() {
    if (S.idxArr === monsters && S.idxLen === monsters.length) return S.byNid;
    S.byNid = new Map(); for (const m of monsters) if (m.nid) S.byNid.set(m.nid, m);
    S.idxArr = monsters; S.idxLen = monsters.length; return S.byNid;
  }
  const find = nid => { const m = index().get(nid); return m && monsters.includes(m) ? m : null; };
  function tagInstance(id) {
    const I = window.INSTANCES; const inst = I && typeof I.get === 'function' ? I.get(id) : null;
    if (!inst || !Array.isArray(inst.spawns)) return;
    for (let i = 0; i < monsters.length && i < inst.spawns.length; i++) { const m = monsters[i]; if (!m.nid && m.type === inst.spawns[i][0]) m.nid = 'i' + i; }
    S.idxLen = -1;
  }
  function homeFor(nid, x, y) {
    let r;
    if ((r = /^s(\d+)$/.exec(nid))) { const s = MONSTER_SPAWNS[+r[1]]; if (s) return { x: tc(s.tx), y: tc(s.ty) }; }
    else if ((r = /^i(\d+)$/.exec(nid))) { const I = window.INSTANCES; const inst = I && I.get ? I.get(S.map) : null; const s = inst && inst.spawns ? inst.spawns[+r[1]] : null; if (s) return { x: tc(s[1]), y: tc(s[2]) }; }
    return { x, y };
  }
  const _spawnMonsters = spawnMonsters;
  spawnMonsters = function () {
    _spawnMonsters();
    for (let i = 0; i < monsters.length; i++) monsters[i].nid = 's' + i;
    S.idxLen = -1;
    if (S.puppets) { S.parked[S.map] = monsters; monsters = S.puppets; }   // a new game while someone else keeps the map: the fresh array waits its turn
  };
  spawnMonsters.__inner = _spawnMonsters;
  // enter/leave called by code (a test, a feature) change the map outside update(); the door, ladder and L key change it inside, where after() sees it
  if (window.INSTANCES && typeof INSTANCES.enter === 'function') {
    const _enter = INSTANCES.enter, _leave = INSTANCES.leave;
    INSTANCES.enter = function (id, step) { const ok = _enter(id, step); if (ok) { const now = mapId(); if (now !== S.map) mapChanged(now); } return ok; };
    INSTANCES.leave = function () { const ok = _leave(); if (ok) { const now = mapId(); if (now !== S.map) mapChanged(now); } return ok; };
  }

  // ---------- who else is on this map ----------
  function remoteList() {
    if (window.PLAYERS && typeof PLAYERS.remote === 'function') { try { const l = PLAYERS.remote(); if (Array.isArray(l)) return l; } catch (e) { } }
    return Object.values(S.remotes);
  }
  function knightsHere() {
    const out = [], me = typeof NET !== 'undefined' ? NET.me : null;
    for (const r of remoteList()) {
      if (!r) continue;
      const n = typeof r.n === 'string' ? r.n : (typeof r.name === 'string' ? r.name : null);
      if (!n || n === me || r.map !== S.map) continue;
      const x = num(r.x), y = num(r.y); if (x === null || y === null) continue;
      if (r.seen !== undefined && time - r.seen > REMOTE_STALE) continue;
      const def = num(r.def), lv = num(r.lv);
      out.push({ n, x, y, dead: !!r.dead, def: def === null || def < 0 ? 9 * 64 : def, lv: lv === null || lv < 1 ? 1 : lv });
    }
    return out;
  }

  // ---------- the keeper's snapshot ----------
  function snapshot(knights) {
    const list = [];
    const ks = knights || S.here;
    for (const m of monsters) {
      if (m.remote || m.phantom) continue;
      if (m.dead && !(m.deadT < 2)) continue;
      let near = !player.dead && dist(m.x, m.y, player.x, player.y) <= NEAR;
      if (!near) for (const k of ks) { if (!k.dead && dist(m.x, m.y, k.x, k.y) <= NEAR) { near = true; break; } }
      if (!near) continue;
      if (!m.nid) { m.nid = NET.me + ':' + (++S.counter); S.idxLen = -1; }
      const f = m.facing || { x: 1, y: 0 };
      list.push([m.nid, m.type, Math.round(m.x), Math.round(m.y), r2(m.hp || 0), r2(m.maxHp || 0), typeof m.state === 'string' ? m.state : 'idle', r2(f.x || 0), r2(f.y || 0), m.moving ? 1 : 0, r2(m.hurtT || 0), m.dead ? 1 : 0, r2(m.attackT || 0), r2(m.stunT || 0)]);
      if (list.length >= 400) break;
    }
    return list;
  }

  // The full snapshot (the 'snap' capability, docs/ONLINE.md "The shared world", Stage 2): when the world starts taking over
  // a map this game keeps, it asks once for every monster as it stands here, standing or fallen, near anyone or not, so the
  // world's copy carries on from this screen (a monster this knight chased, hurt or felled stays so). Same rows as snapshot().
  function snapshotAll() {
    const list = [];
    for (const m of monsters) {
      if (m.remote || m.phantom || !MONSTER_DEFS[m.type]) continue;
      if (!m.nid) { m.nid = NET.me + ':' + (++S.counter); S.idxLen = -1; }
      const f = m.facing || { x: 1, y: 0 };
      list.push([m.nid, m.type, Math.round(m.x), Math.round(m.y), r2(m.hp || 0), r2(m.maxHp || 0), typeof m.state === 'string' ? m.state : 'idle', r2(f.x || 0), r2(f.y || 0), m.moving ? 1 : 0, r2(m.hurtT || 0), m.dead ? 1 : 0, r2(m.attackT || 0), r2(m.stunT || 0)]);
      if (list.length >= 400) break;
    }
    return list;
  }

  // ---------- puppets: what a non-keeper shows ----------
  function makePuppet(nid, type, x, y) {
    const d = MONSTER_DEFS[type]; if (!d) return null;
    return { nid, type, remote: true, x, y, home: homeFor(nid, x, y), r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: !!d.aggro, state: 'idle', wanderT: 0, wander: { x: 0, y: 0 },
      attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 1e9, facing: { x: 1, y: 0 }, walkT: 0, moving: false, stunT: 0, seen: time, gone: false, from: { x, y }, to: { x, y }, lerp: 1, localDeadUntil: -1, deathSeen: false };
  }
  function makeReal(type, x, y, nid, home) {
    const d = MONSTER_DEFS[type];
    return { type, nid, x, y, home: home ? { x: home.x, y: home.y } : { x, y }, r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: !!d.aggro, state: 'idle', wanderT: Math.random() * 2,
      wander: { x: 0, y: 0 }, attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 0, facing: { x: 1, y: 0 }, walkT: 0, moving: false, stunT: 0 };
  }
  // the shape a kill message is granted on: a monster nobody else has, so the kill hooks, the drops and the quest counters
  // all fire for this knight without touching anything in the world
  function phantomOf(src) {
    const d = MONSTER_DEFS[src.type], nid = typeof src.nid === 'string' ? src.nid : null;
    const home = src.home ? { x: src.home.x, y: src.home.y } : nid ? homeFor(nid, src.x, src.y) : { x: src.x, y: src.y };
    return { type: src.type, nid, x: src.x, y: src.y, home, r: d.r, hp: 0, maxHp: d.hp, speed: d.speed, phantom: true, dead: false, deadT: 0, respawnT: 0, state: 'chase', angry: true, facing: { x: 1, y: 0 }, moving: false, walkT: 0, attackT: 0, attackCd: 0, hurtT: 0, stunT: 0, wander: { x: 0, y: 0 }, wanderT: 0 };
  }
  // a knight arriving at an instance whose boss is down while the rest still stand: the boss alone stands up again at its own
  // spawn tile (the keeper's instance is the one everyone fights in). Nobody's 'dungeon cleared' count changes.
  function reviveBoss(inst) {
    if (!inst || !inst.boss || inst.refill === false) return false;
    const i = inst.spawns.findIndex(s => s && s[0] === inst.boss); if (i < 0) return false;
    const m = monsters.find(o => o.nid === 'i' + i && !o.remote && !o.phantom); if (!m || !m.dead) return false;
    const [, tx, ty] = inst.spawns[i];
    m.dead = false; m.deadT = 0; m.hp = m.maxHp; m.x = tc(tx); m.y = tc(ty); m.respawnT = Infinity; m.hitters = {}; m.credited = false;
    m.state = 'idle'; m.stunT = 0; m.hurtT = 0; m.lastHitBy = null;
    S.snapAcc = SNAP_EVERY;
    return true;
  }
  // Alone, every walk into an instance builds it fresh. Shared, the keeper's instance is the one everyone sees, so once it was
  // cleared a friend walking in found it empty for as long as the keeper stayed. A knight arriving at a cleared instance now
  // has the keeper fill it again (the same spawns, fresh). Nobody's 'dungeon cleared' progress changes.
  function refillIfCleared() {
    if (!isKeeper() || S.map === 'over' || !window.INSTANCES || typeof INSTANCES.get !== 'function') return false;
    const inst = INSTANCES.get(S.map); if (!inst || !Array.isArray(inst.spawns) || !inst.spawns.length) return false;
    // an instance that says refill: false (the storm) is never filled by an arrival: its boss comes back only by a call
    if (inst.refill === false) return false;
    if (monsters.some(m => !m.dead && !m.remote && !m.phantom)) { reviveBoss(inst); return false; }
    const fresh = inst.spawns.map(([type, tx, ty], i) => MONSTER_DEFS[type] ? makeReal(type, tc(tx), tc(ty), 'i' + i) : null).filter(Boolean);
    for (const m of fresh) monsters.push(m);
    for (const m of monsters.filter(m => m.dead && m.nid && fresh.some(f => f.nid === m.nid))) { const k = monsters.indexOf(m); if (k >= 0) monsters.splice(k, 1); }
    S.idxLen = -1; S.snapAcc = SNAP_EVERY;
    return true;
  }
  function applyMon(msg) {
    if (!puppetMode() || !msg || !Array.isArray(msg.list)) return;
    if (msg.n !== undefined && msg.n !== S.keeper) return;
    const idx = index(); let added = false;
    const n = Math.min(msg.list.length, 400);
    // ?debug=tick (docs/ONLINE.md, Stage 2): the world's tick and how often its stream lands
    DBG.k = num(msg.k); DBG.rows = n; DBG.times.push(time); while (DBG.times.length && DBG.times[0] < time - 1) DBG.times.shift();
    const world = isWorld(S.keeper);
    if (world) { const st = num(msg.standing); WORLD.standing = st !== null && st >= 0 ? Math.round(st) : null; }
    // a teacher's view: the puppets glide over the time between two snapshots (an alone stream comes about twice a second)
    if (S.view) { S.viewGap = clamp(time - S.viewMonAt, VIEW_GAP_MIN, VIEW_GAP_MAX); S.viewMonAt = time; }
    for (let i = 0; i < n; i++) {
      const e = msg.list[i];
      if (!Array.isArray(e) || e.length < 14) continue;
      // the row is [nid, type, x, y, hp, maxHp, state, fx, fy, moving, hurt, dead, attackT, stunT] (docs/ONLINE.md). Moving and
      // hurt were once read the wrong way round: every walking monster flashed pink and a standing one never walked.
      const nid = e[0], type = e[1], x = num(e[2]), y = num(e[3]), hp = num(e[4]), maxHp = num(e[5]), state = e[6], fx = num(e[7]), fy = num(e[8]), moving = num(e[9]), hurt = num(e[10]), attackT = num(e[12]), stunT = num(e[13]);
      if (typeof nid !== 'string' || typeof type !== 'string' || !MONSTER_DEFS[type]) continue;
      if (x === null || y === null || hp === null || maxHp === null || fx === null || fy === null || moving === null || hurt === null || attackT === null || stunT === null) continue;
      if (world) WORLD.rows.set(nid, { type, x, y, hp, maxHp, dead: !!e[11], fx, fy });
      let p = idx.get(nid);
      if (p && (!p.remote || p.type !== type)) { const k = monsters.indexOf(p); if (k >= 0) monsters.splice(k, 1); p = null; }
      let born = false;
      if (!p) { p = makePuppet(nid, type, x, y); if (!p) continue; monsters.push(p); idx.set(nid, p); added = true; born = true; }
      else if (p.x !== x || p.y !== y) { p.from.x = p.x; p.from.y = p.y; p.to.x = x; p.to.y = y; p.lerp = 0; }
      const dead = !!e[11];
      if (!dead && p.dead && time < p.localDeadUntil) { p.seen = time; continue; }   // our own blow just felled it; give the keeper a moment to agree
      if (dead !== p.dead) p.deadT = 0;
      p.dead = dead; p.hp = hp; if (maxHp > 0) p.maxHp = maxHp; p.state = typeof state === 'string' ? state : 'idle';
      p.facing.x = fx; p.facing.y = fy; p.moving = !!moving; p.hurtT = hurt; p.attackT = attackT; p.stunT = stunT; p.respawnT = 1e9;
      p.seen = time; p.gone = false; p.seed = false;
      // the world's optional columns [tgt, lock, phase, vx, vy, look] (docs/ONLINE.md, Stage 2): the one extra state a monster's
      // look reads rides on the puppet (78-monsterlook reads phase, ally and emberT); a row without them clears them
      if (e.length > 14) {
        const ph = e[16], lk = e[19] && typeof e[19] === 'object' ? e[19] : null;
        p.tgt = typeof e[14] === 'string' ? e[14] : null;
        p.phase = typeof ph === 'string' && ph.length <= 24 ? ph : undefined;
        p.ally = lk && typeof lk.ally === 'string' && lk.ally.length <= 24 ? lk.ally : undefined;
        p.emberT = lk && num(lk.emberT) !== null ? lk.emberT : undefined;
      } else if (p.tgt || p.phase !== undefined || p.ally !== undefined || p.emberT !== undefined) { p.tgt = null; p.phase = undefined; p.ally = undefined; p.emberT = undefined; }
      // the keeper's row turning dead is its word that this monster died: every screen shows the death on receipt, once
      // (deathSeen). One first seen already dead died before this knight could see it, so it plays nothing.
      if (!dead) p.deathSeen = false;
      // (a teacher's view plays the core's own tip and fade, counted by viewStep: no corpse, which needs update() to run)
      else if (!p.deathSeen) { p.deathSeen = true; if (S.view) p.deadT = born ? 9 : 0; else if (!born) monsterDied(p, 'row', S.keeper); else p.deadT = 9; }   // 9: past the core's fade too
    }
    // the old keeper's own monsters held up over a keeper change (setKeeper): the new keeper's first list is the word now, so
    // one it does not list is out of this knight's view there and goes
    if (monsters.some(m => m.seed)) { monsters = monsters.filter(m => !m.seed); S.puppets = monsters; S.idxLen = -1; added = false; }
    if (added) { S.idxArr = monsters; S.idxLen = monsters.length; }
    S.lastMonAt = time;
  }
  function policePuppets() {
    let arr = monsters, dirty = false;
    for (const m of arr) { if (!m.remote) { dirty = true; break; } if (m.gone && time - m.seen > DROP_AFTER) { dirty = true; break; } }
    if (dirty) { arr = arr.filter(m => m.remote && !(m.gone && time - m.seen > DROP_AFTER)); monsters = arr; }
    // while the keeper's stream flows, a puppet it stopped listing (it died, or went out of range) goes after GONE_AFTER; when
    // the whole stream stalls (the keeper's phone locked, a handoff on its way) the monsters stay standing up to STALL_AFTER
    // instead of all vanishing at once
    const flowing = time - (S.lastMonAt || -1e9) < 0.75;
    for (const p of arr) if (!p.gone && time - p.seen > (flowing ? GONE_AFTER : STALL_AFTER)) { p.gone = true; p.dead = true; p.deadT = 9; }
    S.puppets = arr;
  }

  // ---------- keeper changes, handoff, map changes ----------
  function setKeeper(n) {
    const me = NET.me;
    if (n && n !== me) {
      const fromWorld = !!S.puppets && worldLast();
      if (!S.puppets) {
        S.parked[S.map] = monsters;
        // a game that kept this map hands it to the world's copy taking it over (docs/ONLINE.md Stage 2): the monsters on its
        // own screen (within NEAR) stay standing as puppets, where they were, until the world's first mon (applyMon), so the
        // screen never blinks empty for a round trip. Only the old keeper does this (a game arriving on a map knows nothing
        // yet), and only for the world: a knight-to-knight change is exactly as it always was, so with every switch off
        // nothing here differs from before Stage 2.
        const seed = [];
        if (S.keeper && S.keeper === me && typeof n === 'string' && n.indexOf('@world:') === 0) for (const m of monsters) {
          if (!m.nid || m.dead || m.remote || m.phantom || dist(m.x, m.y, player.x, player.y) > NEAR) continue;
          const p = makePuppet(m.nid, m.type, m.x, m.y); if (!p) continue;
          p.seed = true;
          p.hp = m.hp; p.maxHp = m.maxHp; p.state = typeof m.state === 'string' ? m.state : 'idle'; p.facing.x = m.facing ? m.facing.x : 1; p.facing.y = m.facing ? m.facing.y : 0;
          if (m.home) p.home = { x: m.home.x, y: m.home.y };
          seed.push(p);
        }
        S.puppets = seed; monsters = S.puppets; S.idxLen = -1;
      }
      // the world's map named to another knight while its puppets are up: what the world last showed is kept (WORLD.kept)
      if (fromWorld && !isWorld(n)) { WORLD.kept = true; WORLD.standing = null; }
      else if (n !== S.keeper) clearWorld();
      S.keeper = n;
    } else {
      // the world handing its map to this game (or a knight it named since): what the world last showed, not only the puppets
      // still on screen
      if (S.puppets) { if (worldLast()) keepWorld(); else handoff(); }
      clearWorld();
      S.keeper = n;
    }
  }
  function handoff() {
    const real = S.parked[S.map] || [];
    const byNid = new Map(); for (const m of real) if (m.nid) byNid.set(m.nid, m);
    for (const p of S.puppets) {
      if (p.gone) continue;
      let m = byNid.get(p.nid);
      if (!m) { if (p.dead) continue; m = makeReal(p.type, p.x, p.y, p.nid, p.home); real.push(m); byNid.set(p.nid, m); }
      m.x = p.x; m.y = p.y; m.hp = p.hp; m.maxHp = p.maxHp; m.dead = p.dead; m.deadT = p.deadT; m.state = p.state; m.facing = { x: p.facing.x, y: p.facing.y };
      m.stunT = 0; m.lastHitBy = null; m.moving = false;
      // a boss the old keeper had woken (an Echo of the Fang, a War Shed beast) stays awake here
      if (!m.dead) m.awake = true;
      if (m.dead) { const d = MONSTER_DEFS[m.type]; m.respawnT = (d.respawn || 25) + Math.random() * 10; if (isCampMonster(m)) m.respawnT = Math.max(m.respawnT, CAMP_RESPAWN); }
      else m.respawnT = 0;
    }
    monsters = real; S.puppets = null; delete S.parked[S.map]; S.idxLen = -1; S.snapAcc = SNAP_EVERY;
  }
  // The world kept this map and now this game must (its socket dropped, or the world handed it back): handoff() makes the
  // puppets on screen real, then every monster the world showed that is no longer on screen (out of view, or fallen and no
  // longer listed) is put as the world last showed it: a fallen one stays fallen, a hurt one stays hurt, where it was.
  function keepWorld() {
    const rows = WORLD.rows, shown = new Set();
    for (const p of S.puppets) if (!p.gone && p.nid) shown.add(p.nid);
    handoff();
    const byNid = new Map(); for (const m of monsters) if (m.nid) byNid.set(m.nid, m);
    for (const [nid, r] of rows) {
      if (shown.has(nid) || !MONSTER_DEFS[r.type]) continue;
      let m = byNid.get(nid);
      if (!m) { if (r.dead) continue; m = makeReal(r.type, r.x, r.y, nid, homeFor(nid, r.x, r.y)); monsters.push(m); byNid.set(nid, m); }
      if (m.type !== r.type) continue;
      m.x = r.x; m.y = r.y; if (r.maxHp > 0) m.maxHp = r.maxHp; m.facing = { x: r.fx, y: r.fy }; m.stunT = 0; m.lastHitBy = null; m.moving = false;
      if (r.dead) {
        if (!m.dead) { const d = MONSTER_DEFS[m.type]; m.dead = true; m.deadT = 9; m.hp = 0; m.respawnT = (d.respawn || 25) + Math.random() * 10; if (isCampMonster(m)) m.respawnT = Math.max(m.respawnT, CAMP_RESPAWN); }
      } else { m.dead = false; m.hp = r.hp; m.respawnT = 0; m.state = 'idle'; }
    }
    S.idxLen = -1;
    clearWorld();
  }
  function mapChanged(id) {
    clearWorld();
    aloneReset();
    // a teacher's view: the new map's own monsters go; only the stream's puppets show there (never parked, never kept)
    if (S.view) { S.map = id; S.keeper = Object.prototype.hasOwnProperty.call(S.viewKeepers, id) ? S.viewKeepers[id] : null; S.puppets = []; monsters = S.puppets; S.parked = {}; S.idxLen = -1; S.viewMonAt = -1e9; return; }
    const old = S.map;
    S.map = id; S.keeper = null; S.puppets = null; S.snapAcc = 0; S.here = [];
    if (old !== 'over') delete S.parked[old];                 // an instance's monsters are rebuilt on every entry; nothing to keep
    if (S.parked[id]) { monsters = S.parked[id]; delete S.parked[id]; }   // the instance code handed back the puppet array we left with; the real one waited here
    else if (monsters.some(m => m.remote)) monsters = monsters.filter(m => !m.remote);
    S.idxLen = -1;
    tagInstance(id);
  }
  // the socket dropped (offline) or a new welcome: this game runs its map until told otherwise. A map the world kept goes on
  // as the world last showed it (keepWorld); a knight's map gives back this game's own array, as it always did.
  function reset() { if (S.view) { S.remotes = {}; return; } if (S.puppets && worldLast()) keepWorld(); else if (S.puppets && S.parked[S.map]) monsters = S.parked[S.map]; clearWorld(); S.keeper = null; S.puppets = null; S.parked = {}; S.remotes = {}; S.here = []; S.snapAcc = 0; S.idxLen = -1; S.calls = {}; S.pending = null; S.sentAt = -1e9; S.restAt = {}; S.lootless = false; S.viewed = false; aloneReset(); }

  // ---------- named bosses: waking one, here or on the keeper ----------
  const bossAlive = h => { try { return !!h.alive(); } catch (e) { return false; } };
  // 'woke' (this game runs the map: offline, or the keeper), 'sent' (the keeper was asked), 'none' (no such boss)
  // first: this is the caller's own story fight (his first Fang, his first Barrelbeast, his first storm), which the keeper's
  // rest does not hold back
  function call(id, first) {
    const h = HOOKS.bossCall[id]; if (!h) return 'none';
    if (!online() || isKeeper()) { S.calls[id] = time; h.wake(null); return 'woke'; }
    // one ask on its way is enough: a second tap inside SEND_GAP is the same ask, not a new message
    // (the game clock goes back on a load or a new game: a time from before that has passed)
    if (time < S.sentAt || time - S.sentAt >= SEND_GAP) { S.sentAt = time; NET.send(first ? { t: 'boss_call', id, first: true } : { t: 'boss_call', id }); }
    if (!S.pending || S.pending.id !== id) S.pending = { id, t: time };
    return 'sent';
  }
  // the keeper's side: a friend on this map asks for a boss to be woken
  function onBossCall(msg) {
    if (!isKeeper() || !msg || typeof msg.id !== 'string' || typeof msg.n !== 'string' || msg.n === NET.me) return false;
    if (!Object.prototype.hasOwnProperty.call(HOOKS.bossCall, msg.id)) return false;
    const h = HOOKS.bossCall[msg.id]; if (!h || h.map !== S.map) return false;
    const r = S.remotes[msg.n]; if (!r || r.map !== S.map || num(r.x) === null || num(r.y) === null) return false;
    if (h.near && dist(r.x, r.y, tc(h.near[0]), tc(h.near[1])) > h.near[2] * TILE) return false;
    if (bossAlive(h)) return false;
    const last = S.calls[msg.id];
    if (last !== undefined && time >= last && time - last < CALL_GAP) return false;
    // the boss is resting on this map (it fell here lately): the asker is told how long, unless it is his first fight
    const fell = S.restAt[msg.id], rest = num(h.rest) || 0;
    if (rest > 0 && msg.first !== true && fell !== undefined && time >= fell && time - fell < rest) {
      NET.send({ t: 'boss_wait', to: msg.n, id: msg.id, left: Math.ceil(rest - (time - fell)) });
      return false;
    }
    S.calls[msg.id] = time;
    // (first: the asker's own story fight, which a boss file may stage differently, as 37 brings the Dragon Killers)
    h.wake(msg.n, msg.first === true);
    let line = null; try { line = typeof h.told === 'function' ? h.told(msg.n) : null; } catch (e) { line = null; }
    notify(typeof line === 'string' && line ? line : `${msg.n} called ${h.name || msg.id}.`);
    return true;
  }
  // the asker's side: the keeper says the boss is resting on that map
  function onBossWait(msg) {
    if (!online() || isKeeper() || !msg || typeof msg.id !== 'string' || !Object.prototype.hasOwnProperty.call(HOOKS.bossCall, msg.id)) return false;
    const left = num(msg.left); if (left === null || left < 0 || left > 3600) return false;
    const h = HOOKS.bossCall[msg.id]; if (!h) return false;
    if (S.pending && S.pending.id === msg.id) S.pending = null;
    if (typeof h.refused === 'function') { try { h.refused(left); } catch (e) { } }
    else notify(`Not yet. Ready in ${mmss(left)}.`);
    return true;
  }

  // ---------- the keeper's copy of the chase, for a monster whose nearest knight is somewhere else ----------
  function stepRemote(m, t, dt) {
    const def = MONSTER_DEFS[m.type];
    const dp = dist(m.x, m.y, t.x, t.y), dHome = dist(m.x, m.y, m.home.x, m.home.y);
    const roadSafe = def.roam && window.ATLAS && ATLAS.onMainRoad(Math.floor(t.x / TILE), Math.floor(t.y / TILE));   // as the core loop: a patch-keeper leaves a knight on a main road be
    if (dp > def.sight * 1.6 || dHome > 14 * TILE || t.dead || roadSafe) { m.state = 'return'; m.moving = false; return; }
    m.state = 'chase';
    const dx = t.x - m.x, dy = t.y - m.y, d = dp || 1, stop = m.r + KNIGHT_R + 4;
    let vx = 0, vy = 0;
    m.facing = { x: dx / d, y: dy / d };
    // a thrower (the sapper) keeps its distance and throws its sticky bomb, as the core loop does at its own knight. Only the
    // world's copy steps throwers here (before() leaves them to the core in a browser); the bomb's blast is the copy's to hurt with
    if (def.thrower && dp < 5 * TILE && dp > 1.5 * TILE) {
      if (dp < 2.5 * TILE) { vx = -dx / d; vy = -dy / d; }
      if (m.attackCd <= 0) { m.attackCd = 2.4; m.attackT = 0.2; const sp = 260; projectiles.push({ kind: 'sticky', x: m.x, y: m.y, vx: dx / d * sp, vy: dy / d * sp, t: 0, life: dp / sp, fuse: 1.3, owner: 'monster' }); }
    } else if (dp > stop) { vx = dx / d; vy = dy / d; }
    if (!(def.thrower && dp < 5 * TILE && dp > 1.5 * TILE) && dp <= stop + 10 && m.attackCd <= 0) {
      m.attackCd = def.mech ? 1.6 : 1.1; m.attackT = 0.2;
      const dmg = rollHit((def.att + 8) * 64, t.def, def.maxHit);
      NET.send({ t: 'hurt', to: t.n, dmg, x: Math.round(m.x), y: Math.round(m.y) });
      floatText(t.x, t.y - 24, dmg > 0 ? `-${dmg}` : 'miss', dmg > 0 ? '#ff6b6b' : '#8fb4ff', 13);
    }
    m.moving = !!(vx || vy);
    if (m.moving) {
      const bx = m.x, by = m.y;
      moveEntity(m, vx * m.speed * dt, vy * m.speed * dt, def.human ? 'person' : 'beast');
      if (Math.abs(m.x - bx) < 0.01 && Math.abs(m.y - by) < 0.01) moveEntity(m, -vy * m.speed * dt, vx * m.speed * dt, 'beast');
      m.walkT += dt * 8;
    }
    m.attackT = Math.max(0, (m.attackT || 0) - dt);
  }

  // ---------- the per-frame wrap around update() ----------
  function before(dt) {
    const id = mapId(); if (id !== S.map) mapChanged(id);
    if (puppetMode()) {
      const P = S.puppets, saved = new Array(P.length);
      for (let i = 0; i < P.length; i++) { saved[i] = P[i].stunT; P[i].stunT = FREEZE; }
      return { kind: 'puppet', P, saved };
    }
    if (!isKeeper()) { S.here = []; return null; }
    const here = knightsHere(); S.here = here;
    if (!here.length) return null;
    const frozen = [];
    for (const m of monsters) {
      if (m.dead || m.remote || m.phantom || (m.stunT || 0) > 0) continue;
      // throwers aim only at the keeper's own knight in a browser; the world's copy (79-worldkeeper) steps them at every knight
      const def = MONSTER_DEFS[m.type]; if (!def || (def.thrower && !window.WORLDKEEPER) || def.harmless) continue;
      let best = null, bd = player.dead ? Infinity : dist(m.x, m.y, player.x, player.y);
      for (const k of here) { if (k.dead) continue; const d = dist(m.x, m.y, k.x, k.y); if (d < bd) { bd = d; best = k; } }
      if (!best) continue;
      if (window.__peace && m.state === 'chase') { m.state = 'return'; continue; }   // the self-test's "monsters ignore you" holds for remote knights too
      if (m.state !== 'chase') {
        const aggressive = def.aggro && best.lv <= def.level * 2 + 1 && !window.__peace;
        if (m.state !== 'return' && ((m.angry && !def.aggro) || aggressive) && bd < def.sight) m.state = 'chase';
      }
      if (m.state !== 'chase') continue;
      frozen.push({ m, stunT: m.stunT, target: best });
      m.stunT = FREEZE;
    }
    return { kind: 'keeper', frozen };
  }
  function after(dt, pre) {
    // an ask the keeper never answered (an older world, a keeper changing hands): say so once, plainly
    // (an ask the keeper did answer is over the moment its boss stands up on this screen)
    if (S.pending) { const h = HOOKS.bossCall[S.pending.id]; if (h && bossAlive(h)) S.pending = null; }
    if (S.pending && (time < S.pending.t || time - S.pending.t >= CALL_WAIT)) {
      const h = HOOKS.bossCall[S.pending.id]; S.pending = null;
      if (online() && !isKeeper() && h && !bossAlive(h)) notify('Nobody answered. Try again in a moment.');
    }
    // a named boss standing up again is a new fight: nobody's hits from the last one count towards it
    if (isKeeper()) for (const m of monsters) if (m.credited && !m.dead) { m.credited = false; m.hitters = {}; }
    if (pre && pre.kind === 'puppet') {
      const P = pre.P, saved = pre.saved;
      for (let i = 0; i < P.length; i++) { const p = P[i], a = p.stunT; p.stunT = a > FREEZE / 2 ? saved[i] : a; }
    } else if (pre && pre.kind === 'keeper') {
      for (const f of pre.frozen) { const m = f.m, a = m.stunT; m.stunT = a > FREEZE / 2 ? f.stunT : a; }
    }
    const id = mapId(); if (id !== S.map) { mapChanged(id); return; }
    if (puppetMode()) {
      policePuppets();
      if (!paused) for (const p of S.puppets) {
        if (p.lerp < 1) { p.lerp = Math.min(1, p.lerp + dt / LERP_T); p.x = p.from.x + (p.to.x - p.from.x) * p.lerp; p.y = p.from.y + (p.to.y - p.from.y) * p.lerp; }
        else { p.x = p.to.x; p.y = p.to.y; }
      }
      return;
    }
    // A keeper with nobody near sends nothing here: its presence (73-players, at least once a second while its game runs) is
    // what tells the world it is alive (room.js KEEPER_STALE reads presence as well as monsters since 4 Oct 2026). It used to
    // send an empty snapshot once a second as well, which doubled a lone open page's messages (measured: 7,186 an hour, half of
    // them these). That heartbeat was never sent paused or on the title screen, so a paused keeper is unchanged: it streams
    // its (frozen) monsters to the knights near it, as ever, and keeps the map.
    // A teacher is watching this knight (the world said view on) and he keeps his map with nobody near: his game sends its
    // monsters about twice a second so the teacher sees them too (an unchanged list only once every 5 s); never while paused
    // or on the title. With anyone near, the stream below is the one it always was.
    if (S.viewed && isKeeper() && !S.here.length) { aloneStream(dt); return; }
    if (!pre || pre.kind !== 'keeper') return;
    if (!paused) for (const f of pre.frozen) { const m = f.m; if (!m.dead && m.stunT <= 0 && monsters.includes(m)) stepRemote(m, f.target, dt); }
    S.snapAcc += dt;
    if (S.snapAcc >= SNAP_EVERY && isKeeper() && S.here.length) { S.snapAcc = 0; NET.send({ t: 'mon', list: snapshot(S.here) }); }
  }
  function aloneStream(dt) {
    if (paused || (title && title.active)) { S.alone.acc = 0; return; }
    S.alone.acc += dt;
    if (S.alone.acc < ALONE_EVERY) return;
    S.alone.acc = 0;
    const list = snapshot([]), str = JSON.stringify(list);
    if (str === S.alone.last && time >= S.alone.at && time - S.alone.at < ALONE_KEEP) return;
    if (NET.send({ t: 'mon', list })) { S.alone.last = str; S.alone.at = time; S.alone.sent++; }
  }
  // the teacher's page (79-view): what update() does for puppets, alone (it never runs there): the map the drawn knight is
  // on, the puppets gliding onto each snapshot over the gap between them, and the core's tip and fade of a fallen one
  function viewStep(dt) {
    if (!S.view) return;
    const id = mapId(); if (id !== S.map) mapChanged(id);
    policePuppets();
    const lt = S.viewGap || LERP_T;
    for (const p of S.puppets) {
      if (p.lerp < 1) { p.lerp = Math.min(1, p.lerp + dt / lt); p.x = p.from.x + (p.to.x - p.from.x) * p.lerp; p.y = p.from.y + (p.to.y - p.from.y) * p.lerp; }
      else { p.x = p.to.x; p.y = p.to.y; }
      if (p.dead && p.deadT < 9) p.deadT += dt;
      if (p.moving) p.walkT = (p.walkT || 0) + dt * 8;
    }
  }
  // 79-view starts and stops drawing a kid's screen here: the monsters are puppets only, from his frames
  function viewMode(on) {
    if (on && !S.view) { S.viewReal = monsters; S.view = true; S.viewKeepers = {}; S.map = mapId(); S.keeper = null; S.puppets = []; monsters = S.puppets; S.parked = {}; S.idxLen = -1; S.viewMonAt = -1e9; S.viewGap = LERP_T; S.remotes = {}; clearWorld(); }
    else if (!on && S.view) { S.view = false; S.puppets = null; S.keeper = null; S.viewKeepers = {}; S.parked = {}; if (S.viewReal) monsters = S.viewReal; S.viewReal = null; S.idxLen = -1; S.remotes = {}; clearWorld(); }
  }
  function viewKeeper(map, n) {
    if (typeof map !== 'string') return;
    S.viewKeepers[map] = typeof n === 'string' ? n : null;
    if (S.view && map === S.map) S.keeper = S.viewKeepers[map];
  }
  const _update = update;
  update = function (dt) { const pre = before(dt); _update(dt); after(dt, pre); };
  update.__inner = _update;

  // ---------- hits and kills ----------
  const _hitMonster = hitMonster;
  hitMonster = function (m, dmg, knock, fromBomb, source) {
    if (m.remote) {
      if (source !== 'monster' && source !== 'remote' && online()) NET.send({ t: 'hit', nid: m.nid, dmg: Math.max(0, Math.min(MAX_DMG, Math.round(num(dmg) || 0))), knock: Math.round(num(knock) === null ? 14 : knock), bomb: !!fromBomb });
      return _hitMonster(m, dmg, knock, fromBomb, source);
    }
    // a named boss keeps count of who is hitting it, so every knight who fought it gets the kill (CREDIT_HITS in CREDIT_FOR s)
    if (!m.phantom && CREDIT.has(m.type) && (num(dmg) || 0) > 0 && online() && (source === undefined || source === 'player' || source === 'remote')) countHit(m, source === 'remote' ? m.lastHitBy : NET.me);
    if (source === undefined || source === 'player') m.lastHitBy = null;
    return _hitMonster(m, dmg, knock, fromBomb, source);
  };
  function countHit(m, name) {
    if (typeof name !== 'string' || !name) return;
    const hs = m.hitters || (m.hitters = {}), e = hs[name];
    if (!e || time - e.t > CREDIT_FOR) hs[name] = { n: 1, t: time }; else { e.n++; e.t = time; }
  }
  // everyone but the killer with enough hits on this boss, lately: the ones on this map get a kill message, and the keeper
  // itself (when it is one of them) its own kill on a phantom
  function sharers(m, killer) {
    const out = { remote: [], me: false }, hs = m.hitters || {};
    for (const n of Object.keys(hs)) {
      const e = hs[n]; if (n === killer || !e || e.n < CREDIT_HITS || time - e.t > CREDIT_FOR) continue;
      if (n === NET.me) out.me = true;
      else { const r = S.remotes[n]; if (r && r.map === S.map) out.remote.push(n); }
    }
    return out;
  }
  hitMonster.__inner = _hitMonster;
  const _killMonster = killMonster;
  // one kill on this knight's game, through every kill hook, with the pay gate: a knight still resting from his last paid
  // kill of a named boss is paid nothing for this one (the drops, the purse, the dragon item and the kill bonus all look at
  // m.noPay; core rollDrops is held back below while S.lootless)
  function payKill(m) {
    let gate = false;
    const e = CREDIT.has(m.type) ? entryOf(m.type) : null;
    if (e && typeof e[1].resting === 'function') { try { gate = !!e[1].resting(m); } catch (err) { gate = false; } }
    m.noPay = gate;
    S.lootless = gate;
    try { _killMonster(m); } finally { S.lootless = false; }
  }
  const _rollDrops = rollDrops;
  rollDrops = function (def, x, y) { if (S.lootless) return; return _rollDrops(def, x, y); };
  rollDrops.__inner = _rollDrops;
  killMonster = function (m) {
    // the keeper decides drops, XP, credit and the death itself: no HOOKS.monsterDeath here (it fires on the keeper's word)
    if (m.remote) { m.dead = true; m.deadT = 0; m.respawnT = 1e9; m.localDeadUntil = time + 0.5; return; }
    let share = null;
    // the keeper remembers when a called boss fell on this map: its rest starts here, whoever landed the blow
    if (!m.phantom && isKeeper()) for (const id of Object.keys(HOOKS.bossCall)) { const h = HOOKS.bossCall[id]; if (h && h.type === m.type && h.map === S.map) S.restAt[id] = time; }
    if (!m.phantom && !m.credited && CREDIT.has(m.type) && isKeeper()) { m.credited = true; share = sharers(m, m.lastHitBy || NET.me); }
    if (m.lastHitBy && isKeeper()) {
      const d = MONSTER_DEFS[m.type], to = m.lastHitBy; m.lastHitBy = null;
      m.dead = true; m.deadT = 0; m.respawnT = (d.respawn || 25) + Math.random() * 10;
      burst(m.x, m.y, bloodColor(m.type), 16, 120);
      if (isCampMonster(m)) { m.respawnT = Math.max(m.respawnT, CAMP_RESPAWN); checkCampCleared(); }
      if (d.mech) { const tx = Math.floor(m.x / TILE), ty = Math.floor(m.y / TILE); if (PLACEABLE_ON.has(tileAt(tx, ty))) changeTile(tx, ty, T.WRECK); }
      // an instance boss a friend brought down stays down for this visit, as it would for the keeper's own blow
      const I = window.INSTANCES, inst = I && I.active && I.active() ? I.get(I.active()) : null;
      if (inst && inst.boss === m.type) m.respawnT = Infinity;
      NET.send({ t: 'kill', nid: m.nid, type: m.type, x: Math.round(m.x), y: Math.round(m.y), to });
      monsterDied(m, 'friend', to);
    } else payKill(m);
    if (share) {
      for (const n of share.remote) NET.send({ t: 'kill', nid: m.nid, type: m.type, x: Math.round(m.x), y: Math.round(m.y), to: n });
      if (share.me) payKill(phantomOf(m));
    }
  };
  killMonster.__inner = _killMonster;

  // ---------- the wire ----------
  if (typeof NET !== 'undefined') {
    NET.on('welcome', msg => { reset(); S.map = mapId(); setKeeper(typeof msg.keeper === 'string' ? msg.keeper : null); });
    NET.on('keeper', msg => { if (S.view) return viewKeeper(msg.map, msg.n); if (!online() || typeof msg.map !== 'string' || msg.map !== S.map) return; setKeeper(typeof msg.n === 'string' ? msg.n : null); });
    // a teacher is watching this knight (or no longer): the alone stream (after) and the time of day on presence (73-players)
    NET.on('view', msg => { S.viewed = !!(msg && msg.on === true); aloneReset(); });
    if (Array.isArray(NET.caps) && !NET.caps.includes('view')) NET.caps.push('view');
    NET.on('offline', () => reset());
    NET.on('mon', applyMon);
    // the world taking over the map this game keeps asks once for every monster here (snapshotAll); a game that does not keep
    // this map (any more) has nothing to say
    if (Array.isArray(NET.caps) && !NET.caps.includes('snap')) NET.caps.push('snap');
    NET.on('snap', msg => { if (!online() || typeof msg.map !== 'string' || msg.map !== S.map || !isKeeper()) return; NET.send({ t: 'mon', list: snapshotAll(), full: true }); });
    NET.on('p', msg => {
      if (typeof msg.n !== 'string' || msg.n === NET.me || typeof msg.map !== 'string') return;
      const x = num(msg.x), y = num(msg.y); if (x === null || y === null) return;
      const r = S.remotes[msg.n] || (S.remotes[msg.n] = { n: msg.n });
      const arrived = r.map !== msg.map;
      r.x = x; r.y = y; r.map = msg.map;
      if (arrived && msg.map === S.map) refillIfCleared(); r.def = num(msg.def); r.dead = !!msg.dead; r.hp = num(msg.hp); r.lv = num(msg.lv); r.seen = time;
    });
    NET.on('left', msg => { if (typeof msg.n === 'string') delete S.remotes[msg.n]; });
    NET.on('who', msg => { if (!Array.isArray(msg.list)) return; const names = new Set(); for (const e of msg.list) if (e && typeof e.n === 'string') names.add(e.n); for (const n in S.remotes) if (!names.has(n)) delete S.remotes[n]; });
    NET.on('hit', msg => {
      if (!isKeeper() || typeof msg.nid !== 'string' || typeof msg.n !== 'string') return;
      const dmg = num(msg.dmg); if (dmg === null || dmg < 0 || dmg > MAX_DMG) return;
      const m = find(msg.nid); if (!m || m.dead || m.remote) return;
      const knock = num(msg.knock); const k = knock === null ? 14 : clamp(knock, 0, 60);
      m.lastHitBy = msg.n;
      const from = S.here.find(r => r.n === msg.n);
      if (from && k > 0) { const kx = m.x - from.x, ky = m.y - from.y, kd = Math.hypot(kx, ky) || 1; moveEntity(m, kx / kd * k, ky / kd * k, 'beast'); hitMonster(m, dmg, 0, !!msg.bomb, 'remote'); }
      else hitMonster(m, dmg, k, !!msg.bomb, 'remote');
    });
    NET.on('kill', msg => {
      if (!online() || typeof msg.type !== 'string' || !MONSTER_DEFS[msg.type]) return;
      const x = num(msg.x), y = num(msg.y); if (x === null || y === null) return;
      const nid = typeof msg.nid === 'string' ? msg.nid : null;
      const p = nid ? find(nid) : null;
      if (p && p.remote) {
        p.dead = true; p.deadT = 0; p.respawnT = 1e9; p.localDeadUntil = time + 0.5;
        if (!p.deathSeen) { p.deathSeen = true; monsterDied(p, 'kill', typeof msg.to === 'string' ? msg.to : NET.me, typeof msg.k === 'string' || typeof msg.k === 'number' ? msg.k : null); }
      }
      payKill(phantomOf({ type: msg.type, nid, x, y }));
    });
    NET.on('boss_call', onBossCall);
    NET.on('boss_wait', onBossWait);
    NET.on('hurt', msg => {
      if (!online()) return;
      const dmg = num(msg.dmg); if (dmg === null || dmg < 0 || dmg > MAX_DMG) return;
      const x = num(msg.x), y = num(msg.y);
      hurtPlayer(dmg, x === null ? player.x : x, y === null ? player.y : y);
    });
  }

  window.COOP = { refill: refillIfCleared, call, CREDIT, phantomOf, bossCall: onBossCall, bossWait: onBossWait, mmss,
    isKeeper, keeper: () => S.keeper, map: () => S.map, remotes: () => Object.values(S.remotes), knightsHere, puppets: () => S.puppets,
    get parked() { return S.parked[S.map] || null; },
    // how many monsters stand in this whole place while the world runs it (its mon's 'standing'; null otherwise): a puppet
    // list holds only the ones within 24 tiles, so the place's plaque (16-instances) reads this instead
    // ?debug=tick's numbers for the proofs (a function: the counters are not part of COOP.state): the last k, mon a second
    tickStats: () => { while (DBG.times.length && DBG.times[0] < time - 1) DBG.times.shift(); return { k: DBG.k, rate: DBG.times.length, rows: DBG.rows }; },
    placeStanding: () => online() && isWorld(S.keeper) && WORLD.standing !== null ? WORLD.standing : null,
    snapshot: () => snapshot(knightsHere()), snapshotAll, find, apply: applyMon, reset, state: S, debugTick: () => DEBUG_TICK, debugBox: (L, w, h) => debugBox(L, w, h),
    // the teacher view's Watch: viewed() on a kid's game; viewMode / viewKeeper / viewStep on the teacher's page (79-view)
    viewed: () => S.viewed, viewMode, viewKeeper, viewStep, ALONE_EVERY, ALONE_KEEP,
  };

  // ?debug=tick (the two-browser proofs, docs/ONLINE.md "The shared world", Stage 2): who keeps this map, how often its stream
  // lands, the world's tick, the rows in the last mon and the puppets. Nobody sees it without the address saying so.
  const DEBUG_TICK = typeof location !== 'undefined' && !!location && /[?&]debug=tick\b/.test(String(location.search || ''));
  // Where the box goes: never over the hearts and hit points (the crest), the minimap, the quest scroll, the belt, the stick,
  // a seat, any other piece of the HUD or the knight. The bottom-left corner when it is free (a computer), else the first free
  // spot down the left edge (an iPad, a phone held upright), else down the middle (a phone on its side). L is a HUD layout
  // (59-hudkit HK.layoutFor or the live one), vw x vh the screen.
  // (a narrow phone gets the small box: 10 px type instead of 12)
  const DBG_GAP = 6, dbgSize = vw => vw < 420 ? { w: 222, h: 42, font: 10, line: 12 } : { w: 264, h: 54, font: 12, line: 15 };
  function debugBox(L, vw, vh) {
    const Z = dbgSize(vw), DBG_W = Z.w, DBG_H = Z.h;
    const S0 = L.S || { t: 0, r: 0, b: 0, l: 0 };
    const box = a => !a ? null : (a.k === 'c' || (a.w == null && a.r != null)) ? { x: a.x - (a.R || a.r), y: a.y - (a.R || a.r), w: 2 * (a.R || a.r), h: 2 * (a.R || a.r) } : a;
    const avoid = [];
    // (the notice lane is not kept clear: a notice is a line that comes and goes; every piece that stays is)
    for (const it of L.items || []) if (it.id !== 'notice') avoid.push(box(it.stick && it.keep ? { k: 'c', x: it.x, y: it.y, r: it.keep } : it));
    for (const a of [L.crest, L.scroll, L.belt, L.mm, L.stick && { k: 'c', x: L.stick.x, y: L.stick.y, r: L.stick.keep || L.stick.r }]) if (a) avoid.push(box(a));
    const free = r => r.x >= S0.l && r.y >= S0.t && r.x + r.w <= vw - S0.r && r.y + r.h <= vh - S0.b &&
      avoid.every(a => !a || r.x + r.w + DBG_GAP <= a.x || a.x + a.w + DBG_GAP <= r.x || r.y + r.h + DBG_GAP <= a.y || a.y + a.h + DBG_GAP <= r.y);
    if (L.knight) avoid.push(L.knight);   // and never over the knight himself
    const at = (x, y) => ({ x: Math.round(x), y: Math.round(y), w: DBG_W, h: DBG_H });
    // the bottom-left corner, then down the left edge from the top, then down the middle from the top (4 px steps)
    const tries = [at(S0.l + DBG_GAP, vh - S0.b - DBG_H - DBG_GAP)];
    for (const x of [S0.l + DBG_GAP, vw / 2 - DBG_W / 2]) for (let y = S0.t + DBG_GAP; y + DBG_H <= vh - S0.b; y += 4) tries.push(at(x, y));
    const f = tries.find(free);
    return f ? Object.assign(f, { free: true }) : Object.assign(at(S0.l + DBG_GAP, vh - S0.b - DBG_H - DBG_GAP), { free: false });
  }
  if (DEBUG_TICK) HOOKS.hud.push(g => {
    while (DBG.times.length && DBG.times[0] < time - 1) DBG.times.shift();   // a stream that stopped reads 0 a second
    const k = S.keeper, world = typeof k === 'string' && k.indexOf('@world:') === 0;
    const lines = ['keeper ' + (k || '-') + (world ? ' (the world)' : (k && typeof NET !== 'undefined' && k === NET.me ? ' (you)' : '')),
      'mon ' + DBG.times.length + '/s   k ' + (DBG.k === null ? '-' : DBG.k) + '   rows ' + DBG.rows, 'puppets ' + (S.puppets ? S.puppets.length : 0) + '   map ' + S.map];
    const Z = dbgSize(VW);
    let r = { x: 6, y: 6, w: Z.w, h: Z.h }; try { if (typeof HK !== 'undefined' && HK.cur) r = debugBox(HK.cur(), VW, VH); } catch (e) { }
    g.save(); g.font = Z.font + 'px monospace'; g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(r.x, r.y, r.w, r.h); g.fillStyle = '#e6edf3';
    for (let i = 0; i < lines.length; i++) g.fillText(lines[i], r.x + 6, r.y + Z.font + 4 + i * Z.line);
    g.restore();
  });
  // the box never covers the hearts and hit points, or any other piece of the HUD, at any of the HUD audit's screens
  HOOKS.selfTest.push(check => {
    if (typeof HK === 'undefined' || !HK.layoutFor) return;
    const sizes = [[375, 667], [390, 844], [844, 390], [430, 932], [932, 430], [768, 1024], [1024, 768], [1024, 1366], [1366, 1024], [1280, 800]], bad = [];
    for (const [w, h] of sizes) for (const touch of [true, false]) {
      const L = HK.layoutFor(w, h, { touch, online: true, minimap: true }), r = debugBox(L, w, h), c = L.crest;
      const onCrest = !(r.x + r.w <= c.x || c.x + c.w <= r.x || r.y + r.h <= c.y || c.y + c.h <= r.y), off = r.x < 0 || r.y < 0 || r.x + r.w > w || r.y + r.h > h;
      if (onCrest || off || !r.free) bad.push(w + 'x' + h + (touch ? ' touch' : '') + ': ' + JSON.stringify(r));
    }
    check('coop: the ?debug=tick box never covers the hearts and hit points (the crest) or any other piece of the HUD, and stays on screen, on iPads, phones and computers', bad.length === 0, bad.slice(0, 6));
  });

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    if (typeof NET === 'undefined') return;
    const P = 'coop: ';
    if (typeof INSTANCES !== 'undefined' && INSTANCES.active && INSTANCES.active()) INSTANCES.leave();
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, peace: window.__peace, px: player.x, py: player.y, hp: player.hp, kills: player.kills, drops: drops.length, qstage: quest.stage, qkills: quest.kills, graves: quest.graves };
    const real = monsters;
    const keep = real.map(m => ({ m, x: m.x, y: m.y, hp: m.hp, dead: m.dead, deadT: m.deadT, respawnT: m.respawnT, state: m.state, angry: m.angry, stunT: m.stunT, attackCd: m.attackCd, lastHitBy: m.lastHitBy }));
    const sent = []; let sock = null;
    const push = msg => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(msg) }); };
    const fake = { call: async () => ({}), open: () => { sock = { readyState: 1, send(str) { const m = JSON.parse(str); if (m.t === 'mon') m.at = { x: player.x, y: player.y }; sent.push(m); if (m.t === 'hello') push({ t: 'welcome', me: 'Cohen', at: 0, keeper: 'Cohen' }); }, close() { sock.readyState = 3; } }; return sock; } };
    const sentOf = t => sent.filter(m => m.t === t);
    const txOf = px => Math.floor(px / TILE);
    NET.enabled = true; NET.token = 'coop-test'; NET.useFake(fake); NET.connect();
    const gob = real.find(m => m.type === 'goblin' && !m.dead && m.nid && !isCampMonster(m)) || real.find(m => m.type === 'goblin' && m.nid);
    const s0 = real[0];
    try {
      // (a) the keeper's snapshot
      h.peace(true);
      gob.dead = false; gob.hp = gob.maxHp; gob.x = gob.home.x; gob.y = gob.home.y; gob.state = 'idle'; gob.stunT = 0;
      const ann = { x: gob.home.x - 2 * TILE, y: gob.home.y };
      F.tp(txOf(gob.home.x) + 2, txOf(gob.home.y));
      push({ t: 'p', n: 'Ann', map: 'over', x: ann.x, y: ann.y, def: 576, dead: false, hp: 25, lv: 1 });
      sent.length = 0; F.sim(12);
      const mons = sentOf('mon'); const list = mons.length ? mons[mons.length - 1].list : [];
      const near = (x, y) => dist(x, y, player.x, player.y) <= NEAR || dist(x, y, ann.x, ann.y) <= NEAR;
      // a listed x,y is Math.round of the true position (the contract sends whole pixels), so it can sit up to √½ px further out
      // than the monster stood when the keeper picked it by the true position; measure from where the keeper stood at that moment
      const at = mons.length ? mons[mons.length - 1].at : player;
      const sentNear = (x, y) => dist(x, y, at.x, at.y) <= NEAR + Math.SQRT1_2 || dist(x, y, ann.x, ann.y) <= NEAR + Math.SQRT1_2;
      const shapeOk = list.length > 0 && list.every(e => Array.isArray(e) && e.length === 14 && typeof e[0] === 'string' && !!MONSTER_DEFS[e[1]] && [2, 3, 4, 5, 7, 8, 9, 12, 13].every(i => Number.isFinite(e[i])) && typeof e[6] === 'string');
      const farExists = real.some(m => !m.dead && !near(m.x, m.y)), farListed = list.some(e => !sentNear(e[2], e[3]));
      check(P + 'the keeper streams snapshots in the contract shape, only for monsters near a knight', NET.online() && COOP.isKeeper() && COOP.map() === 'over' && mons.length >= 1 && shapeOk && farExists && !farListed && list.some(e => e[0] === gob.nid), { online: NET.online(), keeper: COOP.keeper(), map: COOP.map(), snapshots: mons.length, listed: list.length, shapeOk, farExists, farListed });

      // (a2) a keeper with nobody near sends no snapshot at all, not even an empty one: its presence, about once a second, is
      // what tells the world it is alive (an empty snapshot each second doubled a lone open page's messages); paused, it sends
      // neither, as before
      { push({ t: 'left', n: 'Ann', map: 'over' }); sent.length = 0; F.sim(150);
        const mons = sentOf('mon').length, pres = sentOf('p').length;
        const p0 = paused; paused = true; sent.length = 0; F.sim(90); const whilePaused = sentOf('mon').length + sentOf('p').length; paused = p0;
        check(P + 'a keeper with nobody near sends no empty snapshot, only its presence (about once a second), and nothing while paused', mons === 0 && pres >= 2 && whilePaused === 0, { mons, pres, whilePaused });
        push({ t: 'p', n: 'Ann', map: 'over', x: ann.x, y: ann.y, def: 576, dead: false, hp: 25, lv: 1 }); }
      // (a2b) paused with a knight near, the keeper streams its (frozen) monsters as ever, so it keeps the map and every boss's
      // count and death stay on one game (docs/ONLINE.md, "Named bosses")
      { const p0 = paused; paused = true; sent.length = 0; F.sim(30); const whilePaused = sentOf('mon').filter(m => Array.isArray(m.list) && m.list.length > 0).length; paused = p0;
        check(P + 'a paused keeper with a knight near still streams its monsters', whilePaused >= 2, { whilePaused }); }
      // (a3) the world taking the map over asks for the full snapshot ('snap'): the keeper answers once with every monster it
      // runs (far ones and fallen ones too), marked full; a snap for another map, or to a game that does not keep it, gets nothing
      { const fell = real.find(m => !m.dead && m !== gob && !m.remote && m.nid), was = fell ? { dead: fell.dead, deadT: fell.deadT } : null;
        if (fell) { fell.dead = true; fell.deadT = 30; }
        sent.length = 0; push({ t: 'snap', map: 'over' });
        const fulls = sentOf('mon').filter(m => m.full === true), l = fulls.length ? fulls[0].list : [];
        if (fell) { fell.dead = was.dead; fell.deadT = was.deadT; }
        const want = real.filter(m => !m.remote && !m.phantom && MONSTER_DEFS[m.type]).slice(0, 400), ids = new Set(l.map(e => e[0]));
        const all = want.length === l.length && want.every(m => ids.has(m.nid)), far = want.some(m => !near(m.x, m.y) && ids.has(m.nid));
        const fellRow = fell ? l.find(e => e[0] === fell.nid) : null;
        sent.length = 0; push({ t: 'snap', map: 'deepholm' }); const other = sentOf('mon').length;
        check(P + 'the world\'s snap: the keeper answers with one full snapshot of every monster it runs (far and fallen ones too); a snap for another map gets nothing; hello says snap', fulls.length === 1 && all && far && !!fellRow && fellRow[11] === 1 && other === 0 && NET.hello().caps.includes('snap'), { fulls: fulls.length, rows: l.length, want: want.length, far, fell: fellRow && fellRow[11], other, caps: NET.hello().caps }); }
      // (b) a non-keeper shows puppets that hold still while the stream is silent
      const nearReal = real.filter(m => m.nid && !m.dead && !m.remote && dist(m.x, m.y, player.x, player.y) <= NEAR).map(m => m.nid).sort();
      // (b-) handing the map to another knight is exactly as before Stage 2: no monster is held up on this screen; and the map
      // coming back to this game hands back the very array it ran
      push({ t: 'keeper', map: 'over', n: 'Ann' });
      const toKnight = (COOP.puppets() || []).length;
      push({ t: 'keeper', map: 'over', n: 'Cohen' });
      check(P + 'a keeper handing its map to another knight holds nothing up on its screen (as before the shared world), and gets its own monsters back', toKnight === 0 && COOP.isKeeper() && monsters === real, { toKnight, keeper: COOP.keeper(), same: monsters === real });
      // (b0) handing the map to the world's copy: until the first mon from whoever keeps it next, this screen keeps showing the
      // monsters it ran, where they stood
      push({ t: 'keeper', map: 'over', n: '@world:over' });
      const parked = COOP.parked;
      const seeded = (COOP.puppets() || []).filter(p => p.seed), gs = seeded.find(p => p.nid === gob.nid);
      push({ t: 'keeper', map: 'over', n: 'Ann' });
      const ax = gob.home.x, ay = gob.home.y;
      const row = (nid, type, x, y, hp, mhp, state) => [nid, type, x, y, hp, mhp, state, 1, 0, 0, 0, 0, 0, 0];
      // the next keeper's first mon decides: it names only the goblin, so the goblin stays (now its puppet) and the rest go
      push({ t: 'mon', n: 'Ann', list: [row(gob.nid, gob.type, gob.x, gob.y, gob.hp, gob.maxHp, 'idle')] });
      { const left = monsters.filter(m => m.seed).length, kept = COOP.find(gob.nid), listed = !!kept && !kept.seed && kept.remote;
        check(P + 'a keeper handing its map to the world keeps showing the monsters on its screen (same nids, places and hp) until the next keeper\'s first mon, which then decides', seeded.length === nearReal.length && seeded.length > 0 && seeded.map(p => p.nid).sort().join() === nearReal.join() && !!gs && gs.x === gob.x && gs.y === gob.y && gs.hp === gob.hp && gs.remote && left === 0 && listed && monsters.length === 1, { seeded: seeded.length, near: nearReal.length, gob: gs && [gs.x - gob.x, gs.y - gob.y, gs.hp], left, listed, puppets: monsters.length });
        const k = kept ? monsters.indexOf(kept) : -1; if (k >= 0) monsters.splice(k, 1); S.idxLen = -1; }
      // (b) as it always read: puppets newly made from the keeper's first mon (nothing of the hand-over above is left on screen)
      const fresh = !COOP.find('Ann:1') && !COOP.find(s0.nid) && monsters.length === 0;
      push({ t: 'mon', n: 'Ann', list: [row('Ann:1', 'goblin', ax, ay, 12, 12, 'idle'), row(s0.nid, s0.type, ax + 40, ay + 40, 5, s0.maxHp, 'chase')] });
      const p1 = COOP.find('Ann:1'), p2 = COOP.find(s0.nid);
      const made = !!p1 && !!p2 && p1.seen === time && p2.seen === time && !p1.seed && !p2.seed && p2.hp === 5 && p2.state === 'chase';
      // (b2) moving (row 9) and hurt (row 10) land in the right fields: a walking monster walks and is not pink, a hurt one flashes
      { push({ t: 'mon', n: 'Ann', list: [['Ann:w', 'goblin', ax + 80, ay, 12, 12, 'chase', 1, 0, 1, 0, 0, 0, 0], ['Ann:h', 'goblin', ax + 120, ay, 9, 12, 'idle', 1, 0, 0, 0.18, 0, 0, 0]] });
        const pw = COOP.find('Ann:w'), ph = COOP.find('Ann:h');
        check(P + 'a walking monster from the keeper walks and is not pink; a hurt one flashes (moving and hurt read from the right places)', !!pw && pw.moving === true && pw.hurtT === 0 && !!ph && ph.moving === false && ph.hurtT > 0, { walk: pw && [pw.moving, pw.hurtT], hurt: ph && [ph.moving, ph.hurtT] });
        for (const q of [pw, ph]) { const k = q ? monsters.indexOf(q) : -1; if (k >= 0) monsters.splice(k, 1); }
        S.idxLen = -1; }
      let drew = true; try { render(); } catch (e) { drew = false; }
      monsters.push(makeReal('goblin', ax, ay + 200, null, null));   // a boss file spawning locally on a non-keeper: dropped after the next update
      F.sim(60);
      check(P + 'a non-keeper parks its monsters, shows puppets that render and hold still while the stream is silent, and keeps nothing else', fresh && made && parked === real && monsters !== real && !!p1 && !!p2 && p1.remote && p2.remote && drew && p1.x === ax && p1.y === ay && p2.x === ax + 40 && p2.y === ay + 40 && p2.hp === 5 && p1.stunT === 0 && p2.stunT === 0 && monsters.length === 2 && monsters.every(m => m.remote), { fresh, made, parked: parked === real, puppets: monsters.length, allRemote: monsters.every(m => m.remote), drew, p1: p1 && [p1.x - ax, p1.y - ay, p1.stunT], p2: p2 && [p2.x - ax - 40, p2.hp] });

      { sent.length = 0; push({ t: 'snap', map: 'over' });
        check(P + 'a game that does not keep its map answers no snap', sentOf('mon').length === 0, { sent: sentOf('mon').length }); }
      // an instance excursion while someone else keeps the overworld: inside, the fresh spawns are ours and tagged;
      // back out, the real overworld array returns (the instance code hands back the puppet array it was given)
      const ids = typeof INSTANCES !== 'undefined' && INSTANCES.list ? INSTANCES.list() : [];
      if (ids.length) {
        const id = ids[0]; const entered = INSTANCES.enter(id);
        const inside = { map: COOP.map(), keeper: COOP.keeper(), puppets: COOP.puppets(), tagged: monsters.length > 0 && monsters.every((m, i) => m.nid === 'i' + i && !m.remote), n: monsters.length };
        const left = entered && INSTANCES.leave();
        check(P + 'an instance entered by a non-keeper runs its own tagged spawns; leaving gives the real overworld back, not the puppets', entered && inside.map === id && inside.keeper === null && inside.puppets === null && inside.tagged && left && COOP.map() === 'over' && monsters === real && COOP.keeper() === null && real.every(m => !m.remote), { entered, inside: [inside.map, inside.keeper, inside.n, inside.tagged], left, map: COOP.map(), realBack: monsters === real });
        push({ t: 'keeper', map: 'over', n: 'Ann' });
      }

      // (c) a hit on a puppet
      push({ t: 'mon', n: 'Ann', list: [row('Ann:1', 'goblin', ax, ay, 12, 12, 'idle'), row(s0.nid, s0.type, ax + 40, ay + 40, 5, s0.maxHp, 'chase')] });
      const p1b = COOP.find('Ann:1');
      F.tp(txOf(ax) - 1, txOf(ay)); F.face(txOf(ax), txOf(ay));
      sent.length = 0; const k0 = player.kills, d0 = drops.length, xp0 = player.skills.melee.xp;
      p1b.hp = 1; hitMonster(p1b, 3, 14);
      const hits = sentOf('hit');
      check(P + 'a hit on a puppet goes to the keeper, gives hit XP, and a puppet at 0 hp only lies down (no drops, no kill credit)', COOP.parked === real && hits.length === 1 && hits[0].nid === 'Ann:1' && hits[0].dmg === 3 && hits[0].knock === 14 && hits[0].bomb === false && p1b.dead && drops.length === d0 && player.kills === k0 && player.skills.melee.xp > xp0, { hits, dead: p1b.dead, drops: drops.length - d0, kills: player.kills - k0, xp: player.skills.melee.xp - xp0 });

      // (d) a kill message grants everything once
      quest.stage = 3; quest.kills = 0; quest.graves = [];
      const k1 = player.kills, d1 = drops.length;
      push({ t: 'kill', nid: 'Ann:1', type: 'goblin', x: ax, y: ay });
      push({ t: 'kill', nid: 'Ann:1', type: 'nothing_of_the_sort', x: ax, y: ay });
      check(P + 'a kill message grants the kill, the drops and the quest credit exactly once, and a bad one grants nothing', player.kills === k1 + 1 && drops.length > d1 && quest.kills === 1 && quest.stage === 3, { kills: player.kills - k1, drops: drops.length - d1, questKills: quest.kills });
      quest.stage = was.qstage; quest.kills = was.qkills; quest.graves = was.graves; player.kills = k1; drops = drops.slice(0, d1);

      // (g) handoff
      push({ t: 'mon', n: 'Ann', list: [row(s0.nid, s0.type, ax + 40, ay + 40, 5, s0.maxHp, 'chase'), row('Ann:2', 'goblin', ax + 80, ay, 9, 12, 'idle')] });
      const n0 = real.length;
      push({ t: 'keeper', map: 'over', n: 'Cohen' });
      const nids = monsters.map(m => m.nid); const uniq = new Set(nids).size === nids.length;
      const a2 = monsters.find(m => m.nid === 'Ann:2');
      check(P + 'handoff: the new keeper turns puppets into real monsters with no duplicates (known ones updated in place, unknown ones made, dead unknown ones left out)', monsters === real && COOP.isKeeper() && monsters.length === n0 + 1 && uniq && s0.hp === 5 && s0.x === ax + 40 && s0.y === ay + 40 && !!a2 && !a2.remote && a2.hp === 9 && monsters.every(m => !m.remote) && COOP.puppets() === null, { real: monsters === real, keeper: COOP.keeper(), count: monsters.length - n0, uniq, s0: [s0.hp, s0.x - ax - 40], a2: a2 && [a2.hp, !!a2.remote] });
      if (a2) real.splice(real.indexOf(a2), 1);

      // (e) the keeper takes a remote hit and hands the kill to the hitter
      gob.dead = false; gob.hp = gob.maxHp; gob.x = gob.home.x; gob.y = gob.home.y; gob.state = 'idle'; gob.stunT = 0; gob.lastHitBy = null;
      push({ t: 'p', n: 'Ann', map: 'over', x: gob.x + 30, y: gob.y, def: 576, dead: false, hp: 25, lv: 1 });
      F.sim(1);
      sent.length = 0; const k2 = player.kills, d2 = drops.length;
      push({ t: 'hit', n: 'Ann', nid: gob.nid, dmg: 4, knock: 0, bomb: false });
      const hp1 = gob.hp, by1 = gob.lastHitBy;
      push({ t: 'hit', n: 'Ann', nid: gob.nid, dmg: 9999, knock: 0, bomb: false });
      push({ t: 'hit', n: 'Ann', nid: 42, dmg: 4, knock: 0, bomb: false });
      const hp2 = gob.hp;
      push({ t: 'hit', n: 'Ann', nid: gob.nid, dmg: 8, knock: 0, bomb: false });
      const kills = sentOf('kill');
      check(P + 'the keeper applies a remote hit to the right monster, rejects a bad one, and a remote last hit sends the kill to the hitter with nothing granted here', hp1 === gob.maxHp - 4 && by1 === 'Ann' && hp2 === hp1 && gob.dead && kills.length === 1 && kills[0].to === 'Ann' && kills[0].nid === gob.nid && kills[0].type === 'goblin' && player.kills === k2 && drops.length === d2 && gob.respawnT > 0 && !gob.lastHitBy, { hp1, by1, hp2, dead: gob.dead, kills, localKills: player.kills - k2, drops: drops.length - d2 });

      // (f) a remote knight beside an aggressive monster gets hurt while the keeper stands far away
      gob.dead = false; gob.hp = gob.maxHp; gob.x = gob.home.x; gob.y = gob.home.y; gob.state = 'idle'; gob.attackCd = 0; gob.stunT = 0; gob.angry = !!MONSTER_DEFS.goblin.aggro; gob.lastHitBy = null;
      h.peace(false);
      let spot = h.openSpot(txOf(gob.x) + 16, txOf(gob.y)); if (dist(tc(spot.x), tc(spot.y), gob.x, gob.y) < 10 * TILE) spot = h.openSpot(txOf(gob.x) - 16, txOf(gob.y));
      F.tp(spot.x, spot.y); player.hp = player.maxHp;
      const ann2 = { x: gob.x + 30, y: gob.y };
      push({ t: 'p', n: 'Ann', map: 'over', x: ann2.x, y: ann2.y, def: 576, dead: false, hp: 25, lv: 1 });
      sent.length = 0; F.sim(180);
      const hurts = sentOf('hurt');
      check(P + 'a remote knight beside an aggressive monster gets hurt messages from the keeper while the keeper stands far away, and the monster chases them', dist(player.x, player.y, gob.home.x, gob.home.y) > 8 * TILE && hurts.length >= 1 && hurts.every(m => m.to === 'Ann' && Number.isFinite(m.dmg) && m.dmg >= 0 && m.dmg <= MONSTER_DEFS.goblin.maxHit) && gob.state === 'chase' && dist(gob.x, gob.y, ann2.x, ann2.y) < 60 && sentOf('mon').length >= 10, { keeperAway: Math.round(dist(player.x, player.y, gob.home.x, gob.home.y) / TILE), hurts: hurts.length, state: gob.state, gap: Math.round(dist(gob.x, gob.y, ann2.x, ann2.y)), snapshots: sentOf('mon').length });
      // (h) a knight walking into a cleared instance finds it filled again (alone, every entry is fresh; shared, it stayed empty)
      if (typeof INSTANCES !== 'undefined' && INSTANCES.get && INSTANCES.get('spider_den')) {
        push({ t: 'keeper', map: 'over', n: NET.me });
        const inDen = INSTANCES.enter('spider_den');
        push({ t: 'keeper', map: 'spider_den', n: NET.me });
        for (const m of monsters) m.dead = true;
        const refilled = !!COOP.refill && (push({ t: 'p', n: 'Bo', map: 'spider_den', x: player.x + TILE, y: player.y, def: 500, dead: false, hp: 20, lv: 2 }), true);
        const alive = monsters.filter(m => !m.dead).length, want = INSTANCES.get('spider_den').spawns.length;
        const again = COOP.refill ? COOP.refill() : null;
        check(P + 'a knight arriving at a cleared instance finds it filled again, once (not while monsters still stand)', inDen && refilled && alive === want && again === false, { inDen, alive, want, again });
        INSTANCES.leave(); push({ t: 'left', n: 'Bo', map: 'spider_den' });
      }
    } finally {
      NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null;
      reset();
      monsters = real; real.length = 0;
      for (const k of keep) { const m = k.m; m.x = k.x; m.y = k.y; m.hp = k.hp; m.dead = k.dead; m.deadT = k.deadT; m.respawnT = k.respawnT; m.state = k.state; m.angry = k.angry; m.stunT = k.stunT; m.attackCd = k.attackCd; m.lastHitBy = k.lastHitBy; real.push(m); }
      S.idxLen = -1;
      h.peace(was.peace); player.x = was.px; player.y = was.py; player.hp = Math.max(1, was.hp); player.kills = was.kills; drops = drops.slice(0, was.drops);
      quest.stage = was.qstage; quest.kills = was.qkills; quest.graves = was.graves;
      dialog.queue.length = 0;
    }
  });

  // ---------- self-test: the world's place named to a friend whose game never answers, then to this game ----------
  // A wake names a knight keeper out loud, and that can be a friend whose iPad is still locked. This game, still showing the
  // world's puppets (or none: they went when the stream stopped), must keep what the world last showed until it keeps the map
  // itself: then a monster the world showed felled stays down and a hurt one stays hurt, never the array made at walking in.
  HOOKS.selfTest.push((check, F, h) => {
    if (typeof NET === 'undefined') return;
    if (typeof INSTANCES !== 'undefined' && INSTANCES.active && INSTANCES.active()) INSTANCES.leave();
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, peace: window.__peace };
    const real = monsters;
    const two = real.filter(m => m.nid && !m.dead && !m.remote && !isCampMonster(m) && MONSTER_DEFS[m.type] && m.maxHp > 4).slice(0, 2);
    if (two.length < 2) return;
    const keep = two.map(m => ({ m, x: m.x, y: m.y, hp: m.hp, dead: m.dead, deadT: m.deadT, respawnT: m.respawnT, state: m.state }));
    let sock = null;
    const push = msg => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(msg) }); };
    const fake = { call: async () => ({}), open: () => { sock = { readyState: 1, send(str) { const m = JSON.parse(str); if (m.t === 'hello') push({ t: 'welcome', me: 'Cohen', at: 0, keeper: 'Cohen' }); }, close() { sock.readyState = 3; } }; return sock; } };
    NET.enabled = true; NET.token = 'coop-kept'; NET.useFake(fake); NET.connect();
    try {
      h.peace(true);
      const [a, b] = two, hurt = Math.max(1, Math.floor(a.maxHp / 2));
      const row = (m, hp, dead) => [m.nid, m.type, Math.round(m.x), Math.round(m.y), hp, m.maxHp, 'idle', 1, 0, 0, 0, dead ? 1 : 0, 0, 0];
      push({ t: 'keeper', map: 'over', n: '@world:over' });
      push({ t: 'mon', n: '@world:over', list: [row(a, hurt, false), row(b, 0, true)] });
      F.sim(9 * 60);   // the stream stops (every game on the place locked): the puppets go
      push({ t: 'keeper', map: 'over', n: 'Ann' });   // the wake names Ann, whose game is still locked
      const kept = COOP.keeper() === 'Ann';
      push({ t: 'keeper', map: 'over', n: 'Cohen' });  // and then this game
      const A = COOP.find(a.nid), B = COOP.find(b.nid);
      check('coop: the world\'s place named to a friend whose game never answers, then to this game: the felled one stays down and the hurt one keeps its hp (what the world last showed, never the array made at walking in)',
        kept && COOP.isKeeper() && monsters === real && !!A && !A.dead && A.hp === hurt && !!B && B.dead,
        { kept, keeper: COOP.keeper(), same: monsters === real, a: A && [A.hp, A.dead], b: B && [B.hp, B.dead], hurt });
    } finally {
      NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null;
      reset();
      monsters = real;
      for (const k of keep) { const m = k.m; m.x = k.x; m.y = k.y; m.hp = k.hp; m.dead = k.dead; m.deadT = k.deadT; m.respawnT = k.respawnT; m.state = k.state; }
      S.idxLen = -1;
      h.peace(was.peace);
    }
  });

  // ---------- self-test: named bosses (C1-C7) ----------
  HOOKS.selfTest.push((check, F, h) => {
    if (typeof NET === 'undefined') return;
    const P = 'coop ';
    if (typeof INSTANCES !== 'undefined' && INSTANCES.active && INSTANCES.active()) INSTANCES.leave();
    // these fights pay XP like any other: put the skills back afterwards, so the checks after these see the knight the suite had
    const skills0 = JSON.stringify(player.skills), kills0 = player.kills;
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, peace: window.__peace, px: player.x, py: player.y, hp: player.hp, kills: player.kills, drops: drops.length, q: JSON.stringify(quest.instances || null) };
    const real = monsters;
    const sent = []; let sock = null;
    const push = msg => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(msg) }); };
    const fake = { call: async () => ({}), open: () => { sock = { readyState: 1, send(str) { const m = JSON.parse(str); sent.push(m); if (m.t === 'hello') push({ t: 'welcome', me: 'Cohen', at: 0, keeper: 'Cohen' }); }, close() { sock.readyState = 3; } }; return sock; } };
    const sentOf = t => sent.filter(m => m.t === t);
    const tempTypes = new Set(); const hookRuns = [];
    const listen = m => { if (m.phantom) hookRuns.push(m.type + ':phantom'); else hookRuns.push(m.type); };
    HOOKS.kill.push(listen);
    const remote = (n, map, x, y) => push({ t: 'p', n, map, x, y, def: 576, dead: false, hp: 50, lv: 40 });
    const hit = (n, m, dmg) => push({ t: 'hit', n, nid: m.nid, dmg, knock: 0, bomb: false });
    NET.enabled = true; NET.token = 'coop-boss-test'; NET.useFake(fake); NET.connect();
    try {
      h.peace(true);
      const spot = h.openSpot(...ATLAS.frame('thistledown').p(70, 60)); F.tp(spot.x, spot.y);
      const make = (type, nid) => { const m = makeReal(type, player.x + 3 * TILE, player.y, nid, null); m.stunT = 0; monsters.push(m); tempTypes.add(nid); S.idxLen = -1; return m; };
      // (C1) a remote with 3 hits on a named boss gets a kill when the keeper lands the last one; one with 2 hits gets none
      { remote('Ann', 'over', player.x + 2 * TILE, player.y); remote('Bo', 'over', player.x + 2 * TILE, player.y + TILE);
        const m = make('brood_mother', 'Cohen:t1'); m.hp = 200;
        for (let i = 0; i < 3; i++) hit('Ann', m, 1);
        for (let i = 0; i < 2; i++) hit('Bo', m, 1);
        sent.length = 0; hookRuns.length = 0;
        hitMonster(m, 500, 0);
        const kills = sentOf('kill');
        check(P + 'credit: a remote with 3 hits in 60 s on a named boss gets a kill message when the keeper lands the last hit; one with 2 hits gets none',
          m.dead && kills.length === 1 && kills[0].to === 'Ann' && kills[0].nid === 'Cohen:t1' && kills[0].type === 'brood_mother' && hookRuns.filter(t => t === 'brood_mother').length === 1 && !hookRuns.includes('brood_mother:phantom'),
          { dead: m.dead, kills: kills.map(k => k.to), hookRuns }); }
      // (C2) a remote lands the last hit: the killer once, each other 3-hit remote once, the keeper (3 hits) its own hook once
      { const m = make('count_ashvane', 'Cohen:t2'); m.hp = 300;
        for (let i = 0; i < 3; i++) { hit('Ann', m, 1); hit('Bo', m, 1); hitMonster(m, 1, 0); }
        sent.length = 0; hookRuns.length = 0;
        hit('Ann', m, 500);
        hit('Bo', m, 1);
        const kills = sentOf('kill'), to = kills.map(k => k.to).sort();
        check(P + 'credit: when a remote lands the last hit, the killer gets one kill, each other 3-hit remote one kill, and the keeper with 3 hits runs its own kill hook once; nobody twice',
          m.dead && to.join(',') === 'Ann,Bo' && hookRuns.filter(t => t === 'count_ashvane:phantom').length === 1 && !hookRuns.includes('count_ashvane') && m.respawnT > 0,
          { dead: m.dead, to, hookRuns }); }
      // (C3) every other monster keeps last-hit-only credit
      { const m = make('cinderwight', 'Cohen:t3'); m.hp = 400;
        for (let i = 0; i < 4; i++) { hit('Ann', m, 1); hit('Bo', m, 1); hitMonster(m, 1, 0); }
        sent.length = 0; hookRuns.length = 0;
        hit('Bo', m, 500);
        const kills = sentOf('kill');
        check(P + 'credit: a cinderwight still credits the last hit only', m.dead && kills.length === 1 && kills[0].to === 'Bo' && hookRuns.length === 0 && !m.hitters, { kills: kills.map(k => k.to), hookRuns, hitters: !!m.hitters }); }
      for (let i = monsters.length - 1; i >= 0; i--) if (tempTypes.has(monsters[i].nid)) monsters.splice(i, 1);
      S.idxLen = -1;
      // (C4) on the keeper, an instance boss felled by a friend stays down for the visit
      if (typeof INSTANCES !== 'undefined' && INSTANCES.get && INSTANCES.get('spider_den')) {
        INSTANCES.enter('spider_den'); push({ t: 'keeper', map: 'spider_den', n: 'Cohen' });
        const bm = monsters.find(m => m.type === 'brood_mother');
        remote('Bo', 'spider_den', bm.x + TILE, bm.y);
        sent.length = 0; hit('Bo', bm, 500);
        const kills = sentOf('kill');
        check(P + 'an instance boss felled by a friend gets respawnT Infinity on the keeper', bm.dead && bm.respawnT === Infinity && kills.length === 1 && kills[0].to === 'Bo', { dead: bm.dead, respawnT: bm.respawnT, kills: kills.length });
        // (C5) a knight arriving while the boss is down and others still stand: the boss alone comes back at its spawn tile, i-nid
        const q = quest.instances.cleared.spider_den || 0, inst = INSTANCES.get('spider_den');
        const i = inst.spawns.findIndex(s => s[0] === 'brood_mother'), others = monsters.filter(m => m !== bm && !m.dead).length;
        remote('Cy', 'spider_den', player.x + TILE, player.y);
        const back = !bm.dead && bm.hp === bm.maxHp && bm.nid === 'i' + i && Math.floor(bm.x / TILE) === inst.spawns[i][1] && Math.floor(bm.y / TILE) === inst.spawns[i][2] && bm.respawnT === Infinity;
        check(P + 'a knight arriving at an instance whose boss is dead while others live revives the boss alone at its spawn tile with its i-nid; cleared counts unchanged',
          back && others > 0 && monsters.filter(m => !m.dead).length === others + 1 && (quest.instances.cleared.spider_den || 0) === q && monsters.filter(m => m.type === 'brood_mother').length === 1,
          { back, others, alive: monsters.filter(m => !m.dead).length, cleared: [q, quest.instances.cleared.spider_den || 0], nid: bm.nid });
        INSTANCES.leave(); push({ t: 'left', n: 'Bo', map: 'spider_den' }); push({ t: 'left', n: 'Cy', map: 'spider_den' });
        push({ t: 'keeper', map: 'over', n: 'Cohen' });
      }
      // (C6) the keeper honours a boss_call only by the rules
      { F.tp(spot.x, spot.y); push({ t: 'keeper', map: 'over', n: 'Cohen' });
        const woke = []; let up = false;
        HOOKS.bossCall.test_boss = { map: 'over', near: [spot.x, spot.y, 4], name: 'the test boss', alive: () => up, wake: n => { woke.push(n); } };
        HOOKS.bossCall.test_lab = { map: 'tinker_lab', near: null, alive: () => false, wake: n => { woke.push('lab:' + n); } };
        const ask = (n, id) => { woke.length = 0; push({ t: 'boss_call', n, id }); return woke.slice(); };
        push({ t: 'left', n: 'Ann', map: 'over' }); delete S.remotes.Ann; S.calls = {};
        const absent = ask('Ann', 'test_boss');
        remote('Ann', 'over', tc(spot.x + 9), tc(spot.y));
        const far = ask('Ann', 'test_boss');
        remote('Ann', 'over', tc(spot.x + 3), tc(spot.y));
        const near = ask('Ann', 'test_boss');
        const cooling = ask('Ann', 'test_boss');
        S.calls.test_boss = time - CALL_GAP - 0.1; up = true;
        const alive = ask('Ann', 'test_boss');
        up = false;
        const again = ask('Ann', 'test_boss');
        S.calls = {};
        const wrongMap = ask('Ann', 'test_lab'), unknown = ask('Ann', 'no_such_boss'), proto = ask('Ann', 'toString');
        remote('Ann', 'tinker_lab', tc(spot.x + 3), tc(spot.y));
        const elsewhere = ask('Ann', 'test_boss');
        const fang = HOOKS.bossCall.the_fang;
        const circle = ATLAS.port('fang_lair.circle');   // the Fang's call reaches 4 tiles round the summoning circle (28-thefang)
        const fangRule = !!fang && fang.map === 'over' && JSON.stringify(fang.near) === JSON.stringify([circle[0], circle[1], 4]);
        delete HOOKS.bossCall.test_boss; delete HOOKS.bossCall.test_lab;
        check(P + 'boss_call: the keeper honours a registered id only on its own map, from a knight on that map, in range (the Fang within 4 tiles of the circle), with no live boss and after the 3 s cooldown',
          absent.length === 0 && far.length === 0 && near.join() === 'Ann' && cooling.length === 0 && alive.length === 0 && again.join() === 'Ann' && wrongMap.length === 0 && unknown.length === 0 && proto.length === 0 && elsewhere.length === 0 && fangRule,
          { absent, far, near, cooling, alive, again, wrongMap, unknown, proto, elsewhere, fangRule }); }
      // (C8) the pay gate: a kill message for a named boss this knight still rests from pays nothing (no drops, no kill bonus,
      // no dragon item); the same message once he has rested pays the def drops
      { const keepBC = HOOKS.bossCall.test_pay; let rests = true;
        HOOKS.bossCall.test_pay = { map: 'spider_den', near: null, type: 'brood_mother', name: 'the test mother', alive: () => false, wake: () => { }, resting: () => rests };
        const n0 = drops.length, mx0 = player.skills.melee.xp, dx0 = player.skills.defence.xp, seen = [];
        const look = m => { if (m.type === 'brood_mother') seen.push(!!m.noPay); }; HOOKS.kill.push(look);
        try {
          push({ t: 'kill', nid: 'Ann:p1', type: 'brood_mother', x: player.x, y: player.y, to: 'Cohen' });
          const resting = { drops: drops.length - n0, melee: player.skills.melee.xp - mx0, defence: player.skills.defence.xp - dx0 };
          rests = false; push({ t: 'kill', nid: 'Ann:p2', type: 'brood_mother', x: player.x, y: player.y, to: 'Cohen' });
          const rested = { drops: drops.length - n0 - resting.drops, defence: player.skills.defence.xp - dx0 - resting.defence };
          check(P + 'pay gate: a kill message for a named boss this knight still rests from pays nothing (no drops, no kill bonus); rested, the same message pays its drops and bonus',
            resting.drops === 0 && resting.melee === 0 && resting.defence === 0 && seen.join() === 'true,false' && rested.drops > 0 && rested.defence > 0 && !S.lootless, { resting, rested, seen });
        } finally { HOOKS.kill.splice(HOOKS.kill.indexOf(look), 1); if (keepBC) HOOKS.bossCall.test_pay = keepBC; else delete HOOKS.bossCall.test_pay; drops = drops.slice(0, n0); }
      }
      // (C9) boss_wait: only a sane answer for a registered boss is read, and it ends the ask (no 'Nobody answered' after it)
      { const told = []; HOOKS.bossCall.test_wait = { map: 'over', near: null, name: 'the test boss', alive: () => false, wake: () => { }, refused: left => told.push(left) };
        S.keeper = 'Ann'; S.pending = { id: 'test_wait', t: time };
        for (const msg of [{ id: 'test_wait', left: -1 }, { id: 'test_wait', left: 99999 }, { id: 'test_wait', left: 'x' }, { id: 'no_such', left: 5 }, { id: 'toString', left: 5 }]) push(Object.assign({ t: 'boss_wait' }, msg));
        const ignored = told.length === 0 && !!S.pending;
        push({ t: 'boss_wait', id: 'test_wait', left: 125 });
        check(P + 'boss_wait: a bad left, an unknown id or a prototype name is ignored; a sane one for a registered boss reaches its refused(left) and ends the ask',
          ignored && told.join() === '125' && S.pending === null && mmss(125) === '2:05' && mmss(600) === '10:00', { ignored, told, pending: S.pending });
        delete HOOKS.bossCall.test_wait; S.keeper = 'Cohen'; }
      // (C7) handoff: a live adopted monster is awake on the new keeper
      { const s0 = real.find(m => /^s\d+$/.test(m.nid || '') && m.type === 'goblin' && !m.dead) || real.find(m => /^s\d+$/.test(m.nid || ''));
        const s1 = real.find(m => m !== s0 && /^s\d+$/.test(m.nid || ''));
        const k0 = { s0: { awake: s0.awake, dead: s0.dead, hp: s0.hp, x: s0.x, y: s0.y, respawnT: s0.respawnT }, s1: { awake: s1.awake, dead: s1.dead, hp: s1.hp, x: s1.x, y: s1.y, respawnT: s1.respawnT } };
        delete s0.awake; delete s1.awake;
        push({ t: 'keeper', map: 'over', n: 'Ann' });
        const row = (m, dead) => [m.nid, m.type, Math.round(m.x), Math.round(m.y), m.maxHp, m.maxHp, 'idle', 1, 0, 0, 0, dead ? 1 : 0, 0, 0];
        push({ t: 'mon', n: 'Ann', list: [row(s0, false), row(s1, true)] });
        push({ t: 'keeper', map: 'over', n: 'Cohen' });
        const ok = monsters === real && s0.awake === true && !s0.dead && s1.dead && s1.awake !== true;
        check(P + 'handoff: a live adopted monster gets awake true', ok, { real: monsters === real, s0: [s0.awake, s0.dead], s1: [s1.awake, s1.dead] });
        for (const [m, k] of [[s0, k0.s0], [s1, k0.s1]]) { if (k.awake === undefined) delete m.awake; else m.awake = k.awake; m.dead = k.dead; m.hp = k.hp; m.x = k.x; m.y = k.y; m.respawnT = k.respawnT; } }
    } finally {
      player.skills = JSON.parse(skills0); player.kills = kills0; recomputeMaxHp(); player.hp = Math.min(player.hp, player.maxHp);
      HOOKS.kill.splice(HOOKS.kill.indexOf(listen), 1);
      if (typeof INSTANCES !== 'undefined' && INSTANCES.active && INSTANCES.active()) INSTANCES.leave();
      NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null;
      reset();
      monsters = real;
      for (let i = monsters.length - 1; i >= 0; i--) if (tempTypes.has(monsters[i].nid)) monsters.splice(i, 1);
      S.idxLen = -1;
      h.peace(was.peace); player.x = was.px; player.y = was.py; player.hp = Math.max(1, was.hp); player.kills = was.kills; drops = drops.slice(0, was.drops);
      if (was.q !== 'null') quest.instances = JSON.parse(was.q);
      dialog.queue.length = 0; dialog.cur = null;
    }
  });

  // ---------- self-test: a kid's game while a teacher watches it (the teacher view, round 2) ----------
  HOOKS.selfTest.push((check, F, h) => {
    if (typeof NET === 'undefined') return;
    const P = 'coop (watched): ';
    if (window.INSTANCES && INSTANCES.active && INSTANCES.active()) INSTANCES.leave();
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, px: player.x, py: player.y, paused, title: title.active };
    // the frames run here walk a hired companion up beside the knight; she goes back where she was (as 79-teacher's self-test)
    const comp = player.companion && typeof player.companion === 'object' ? player.companion : null;
    const comp0 = comp ? { x: comp.x, y: comp.y, hp: comp.hp, downT: comp.downT } : null;
    const sent = []; let sock = null;
    const push = m => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(m) }); };
    const fake = { call: async () => ({}), open: () => { sock = { readyState: 1, send(str) { const m = JSON.parse(str); sent.push(m); if (m.t === 'hello') push({ t: 'welcome', me: 'Cohen', at: 0, keeper: 'Cohen' }); }, close() { sock.readyState = 3; } }; return sock; } };
    const mons = () => sent.filter(m => m.t === 'mon').length;
    const real = monsters, gob = real.find(m => m.type === 'goblin' && !m.dead && m.nid) || real.find(m => !m.dead && m.nid);
    const keep = gob ? { x: gob.x, y: gob.y, stunT: gob.stunT, state: gob.state } : null;
    try {
      h.peace(true); title.active = false; paused = false;
      NET.enabled = true; NET.token = 'view-test'; NET.useFake(fake); NET.connect();
      const hello = sent.find(m => m.t === 'hello');
      const caps = !!hello && Array.isArray(hello.caps) && hello.caps.includes('view');
      // the knight beside a goblin that keeps moving (its row changes every frame), nobody else on the map. The goblin starts on
      // a whole pixel: the row rounds x, and a goblin whose x ends in .25 to .5 would round both of its jiggle's steps to the
      // same pixel (an unchanged row: fewer snapshots), which a world laid out otherwise (the Great Spread) can hand it
      gob.x = Math.round(gob.x);
      player.x = gob.x - 3 * TILE; player.y = gob.y;
      const run = (secs, move) => { for (let i = 0; i < secs * 60; i++) { if (move) { gob.x += (i % 2 ? 1 : -1) * 0.75; gob.stunT = 1; } F.step([]); } };
      sent.length = 0; run(10, true);
      const notViewed = mons();
      const pNo = sent.filter(m => m.t === 'p'), noTod = pNo.length > 0 && pNo.every(m => !('tod' in m) && !('vw' in m) && !('vh' in m));
      push({ t: 'view', on: true });
      sent.length = 0; run(10, true);
      const moving = mons();
      const pYes = sent.filter(m => m.t === 'p'), tod = pYes.length > 0 && pYes.every(m => typeof m.tod === 'number' && m.tod >= 0 && m.tod < 600 && Math.round(m.tod * 10) === m.tod * 10 && m.vw === Math.round(VW) && m.vh === Math.round(VH));
      // nothing near him changes (no monsters at all here for 12 s): the same empty list, once every 5 s
      monsters = []; sent.length = 0; run(12, false); monsters = real;
      const still = mons();
      paused = true; sent.length = 0; run(4, true); const whilePaused = mons(); paused = false;
      // with a friend near: the stream it always was, 8 a second
      push({ t: 'p', n: 'Ava', map: 'over', x: Math.round(player.x + 40), y: Math.round(player.y), def: 100, lv: 5, hp: 10, mhp: 10 });
      sent.length = 0; for (let i = 0; i < 60; i++) { if (i % 30 === 0) push({ t: 'p', n: 'Ava', map: 'over', x: Math.round(player.x + 40), y: Math.round(player.y), def: 100, lv: 5, hp: 10, mhp: 10 }); gob.x += (i % 2 ? 1 : -1) * 0.75; F.step([]); }
      const withFriend = mons();
      push({ t: 'left', n: 'Ava', map: 'over' });
      push({ t: 'view', on: false });
      sent.length = 0; run(4, true); const after = mons();
      check(P + 'the hello names the \'view\' capability; not watched, alone: no snapshot and no tod (as before); watched and alone: at most 2 a second (' + moving + ' in 10 s), an unchanged list only once every 5 s (' + still + ' in 12 s), none while paused, the time of day and the size of the screen (vw, vh: what the Watch draws) on its presence; with a friend near, 8 a second (' + withFriend + ' in 1 s); view off: nothing again',
        caps && notViewed === 0 && noTod && moving >= 18 && moving <= 21 && still >= 2 && still <= 4 && whilePaused === 0 && tod && withFriend >= 7 && withFriend <= 9 && after === 0, { caps, notViewed, noTod, moving, still, whilePaused, tod, withFriend, after });
      // on the title: nothing
      push({ t: 'view', on: true }); title.active = true; sent.length = 0; run(2, true); const onTitle = mons(); title.active = false;
      push({ t: 'welcome', me: 'Cohen', at: 0, keeper: 'Cohen' }); const offAtWelcome = COOP.viewed() === false;
      check(P + 'none on the title; a welcome turns the watched state off until the world says it again', onTitle === 0 && offAtWelcome, { onTitle, offAtWelcome });
    } finally {
      NET.disconnect(); NET.useFake(was.fake); NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null;
      reset(); monsters = real; S.viewed = false; aloneReset();
      if (keep) Object.assign(gob, keep);
      player.x = was.px; player.y = was.py; paused = was.paused; title.active = was.title; h.peace(false);
      if (comp0 && player.companion === comp) Object.assign(comp, comp0);
    }
    check(P + 'the companion is where she was before these checks', !comp0 || (player.companion === comp && comp.x === comp0.x && comp.y === comp0.y), { comp0, now: comp && { x: comp.x, y: comp.y } });
  });
}
