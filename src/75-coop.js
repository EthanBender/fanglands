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
  const NEAR = 24 * TILE;     // snapshot radius around every knight on the map
  const FREEZE = 1e6;         // the stunT value that makes the core loop skip a monster for one frame
  const MAX_DMG = 500;
  const REMOTE_STALE = 15;    // seconds without presence before a remote knight is forgotten
  const KNIGHT_R = 13;

  const S = { map: 'over', keeper: null, puppets: null, parked: {}, remotes: {}, counter: 0, snapAcc: 0, here: [], idxArr: null, idxLen: -1, byNid: new Map() };

  const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
  const r2 = v => Math.round(v * 100) / 100;
  const mapId = () => {
    const I = window.INSTANCES; if (!I) return 'over';
    const a = typeof I.active === 'function' ? I.active() : (I.active && I.active.id);
    return typeof a === 'string' && a ? a : 'over';
  };
  const online = () => typeof NET !== 'undefined' && NET.online();
  const isKeeper = () => online() && S.keeper !== null && S.keeper === NET.me;
  const puppetMode = () => online() && S.puppets !== null && S.keeper !== null && S.keeper !== NET.me;

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

  // ---------- puppets: what a non-keeper shows ----------
  function makePuppet(nid, type, x, y) {
    const d = MONSTER_DEFS[type]; if (!d) return null;
    return { nid, type, remote: true, x, y, home: homeFor(nid, x, y), r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: !!d.aggro, state: 'idle', wanderT: 0, wander: { x: 0, y: 0 },
      attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 1e9, facing: { x: 1, y: 0 }, walkT: 0, moving: false, stunT: 0, seen: time, gone: false, from: { x, y }, to: { x, y }, lerp: 1, localDeadUntil: -1 };
  }
  function makeReal(type, x, y, nid, home) {
    const d = MONSTER_DEFS[type];
    return { type, nid, x, y, home: home ? { x: home.x, y: home.y } : { x, y }, r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: !!d.aggro, state: 'idle', wanderT: Math.random() * 2,
      wander: { x: 0, y: 0 }, attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 0, facing: { x: 1, y: 0 }, walkT: 0, moving: false, stunT: 0 };
  }
  function applyMon(msg) {
    if (!puppetMode() || !msg || !Array.isArray(msg.list)) return;
    if (msg.n !== undefined && msg.n !== S.keeper) return;
    const idx = index(); let added = false;
    const n = Math.min(msg.list.length, 400);
    for (let i = 0; i < n; i++) {
      const e = msg.list[i];
      if (!Array.isArray(e) || e.length < 14) continue;
      const nid = e[0], type = e[1], x = num(e[2]), y = num(e[3]), hp = num(e[4]), maxHp = num(e[5]), state = e[6], fx = num(e[7]), fy = num(e[8]), hurt = num(e[9]), attackT = num(e[12]), stunT = num(e[13]);
      if (typeof nid !== 'string' || typeof type !== 'string' || !MONSTER_DEFS[type]) continue;
      if (x === null || y === null || hp === null || maxHp === null || fx === null || fy === null || hurt === null || attackT === null || stunT === null) continue;
      let p = idx.get(nid);
      if (p && (!p.remote || p.type !== type)) { const k = monsters.indexOf(p); if (k >= 0) monsters.splice(k, 1); p = null; }
      if (!p) { p = makePuppet(nid, type, x, y); if (!p) continue; monsters.push(p); idx.set(nid, p); added = true; }
      else if (p.x !== x || p.y !== y) { p.from.x = p.x; p.from.y = p.y; p.to.x = x; p.to.y = y; p.lerp = 0; }
      const dead = !!e[11];
      if (!dead && p.dead && time < p.localDeadUntil) { p.seen = time; continue; }   // our own blow just felled it; give the keeper a moment to agree
      if (dead !== p.dead) p.deadT = 0;
      p.dead = dead; p.hp = hp; if (maxHp > 0) p.maxHp = maxHp; p.state = typeof state === 'string' ? state : 'idle';
      p.facing.x = fx; p.facing.y = fy; p.moving = !!e[10]; p.hurtT = hurt; p.attackT = attackT; p.stunT = stunT; p.respawnT = 1e9;
      p.seen = time; p.gone = false;
    }
    if (added) { S.idxArr = monsters; S.idxLen = monsters.length; }
  }
  function policePuppets() {
    let arr = monsters, dirty = false;
    for (const m of arr) { if (!m.remote) { dirty = true; break; } if (m.gone && time - m.seen > DROP_AFTER) { dirty = true; break; } }
    if (dirty) { arr = arr.filter(m => m.remote && !(m.gone && time - m.seen > DROP_AFTER)); monsters = arr; }
    for (const p of arr) if (!p.gone && time - p.seen > GONE_AFTER) { p.gone = true; p.dead = true; p.deadT = 9; }
    S.puppets = arr;
  }

  // ---------- keeper changes, handoff, map changes ----------
  function setKeeper(n) {
    const me = NET.me;
    if (n && n !== me) {
      if (!S.puppets) { S.parked[S.map] = monsters; S.puppets = []; monsters = S.puppets; }
      S.keeper = n;
    } else {
      if (S.puppets) handoff();
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
      if (m.dead) { const d = MONSTER_DEFS[m.type]; m.respawnT = (d.respawn || 25) + Math.random() * 10; if (isCampMonster(m)) m.respawnT = Math.max(m.respawnT, CAMP_RESPAWN); }
      else m.respawnT = 0;
    }
    monsters = real; S.puppets = null; delete S.parked[S.map]; S.idxLen = -1; S.snapAcc = SNAP_EVERY;
  }
  function mapChanged(id) {
    const old = S.map;
    S.map = id; S.keeper = null; S.puppets = null; S.snapAcc = 0; S.here = [];
    if (old !== 'over') delete S.parked[old];                 // an instance's monsters are rebuilt on every entry; nothing to keep
    if (S.parked[id]) { monsters = S.parked[id]; delete S.parked[id]; }   // the instance code handed back the puppet array we left with; the real one waited here
    else if (monsters.some(m => m.remote)) monsters = monsters.filter(m => !m.remote);
    S.idxLen = -1;
    tagInstance(id);
  }
  function reset() { if (S.puppets && S.parked[S.map]) monsters = S.parked[S.map]; S.keeper = null; S.puppets = null; S.parked = {}; S.remotes = {}; S.here = []; S.snapAcc = 0; S.idxLen = -1; }

  // ---------- the keeper's copy of the chase, for a monster whose nearest knight is somewhere else ----------
  function stepRemote(m, t, dt) {
    const def = MONSTER_DEFS[m.type];
    const dp = dist(m.x, m.y, t.x, t.y), dHome = dist(m.x, m.y, m.home.x, m.home.y);
    if (dp > def.sight * 1.6 || dHome > 14 * TILE || t.dead) { m.state = 'return'; m.moving = false; return; }
    m.state = 'chase';
    const dx = t.x - m.x, dy = t.y - m.y, d = dp || 1, stop = m.r + KNIGHT_R + 4;
    let vx = 0, vy = 0;
    if (dp > stop) { vx = dx / d; vy = dy / d; }
    m.facing = { x: dx / d, y: dy / d };
    if (dp <= stop + 10 && m.attackCd <= 0) {
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
      const def = MONSTER_DEFS[m.type]; if (!def || def.thrower || def.harmless) continue;
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
    if (!pre || pre.kind !== 'keeper') return;
    if (!paused) for (const f of pre.frozen) { const m = f.m; if (!m.dead && m.stunT <= 0 && monsters.includes(m)) stepRemote(m, f.target, dt); }
    S.snapAcc += dt;
    if (S.snapAcc >= SNAP_EVERY && isKeeper() && S.here.length) { S.snapAcc = 0; NET.send({ t: 'mon', list: snapshot(S.here) }); }
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
    if (source === undefined || source === 'player') m.lastHitBy = null;
    return _hitMonster(m, dmg, knock, fromBomb, source);
  };
  hitMonster.__inner = _hitMonster;
  const _killMonster = killMonster;
  killMonster = function (m) {
    if (m.remote) { m.dead = true; m.deadT = 0; m.respawnT = 1e9; m.localDeadUntil = time + 0.5; return; }   // the keeper decides drops, XP and credit
    if (m.lastHitBy && isKeeper()) {
      const d = MONSTER_DEFS[m.type], to = m.lastHitBy; m.lastHitBy = null;
      m.dead = true; m.deadT = 0; m.respawnT = (d.respawn || 25) + Math.random() * 10;
      burst(m.x, m.y, bloodColor(m.type), 16, 120);
      if (isCampMonster(m)) { m.respawnT = Math.max(m.respawnT, CAMP_RESPAWN); checkCampCleared(); }
      if (d.mech) { const tx = Math.floor(m.x / TILE), ty = Math.floor(m.y / TILE); if (PLACEABLE_ON.has(tileAt(tx, ty))) changeTile(tx, ty, T.WRECK); }
      NET.send({ t: 'kill', nid: m.nid, type: m.type, x: Math.round(m.x), y: Math.round(m.y), to });
      return;
    }
    return _killMonster(m);
  };
  killMonster.__inner = _killMonster;

  // ---------- the wire ----------
  if (typeof NET !== 'undefined') {
    NET.on('welcome', msg => { reset(); S.map = mapId(); setKeeper(typeof msg.keeper === 'string' ? msg.keeper : null); });
    NET.on('keeper', msg => { if (!online() || typeof msg.map !== 'string' || msg.map !== S.map) return; setKeeper(typeof msg.n === 'string' ? msg.n : null); });
    NET.on('offline', () => reset());
    NET.on('mon', applyMon);
    NET.on('p', msg => {
      if (typeof msg.n !== 'string' || msg.n === NET.me || typeof msg.map !== 'string') return;
      const x = num(msg.x), y = num(msg.y); if (x === null || y === null) return;
      const r = S.remotes[msg.n] || (S.remotes[msg.n] = { n: msg.n });
      r.x = x; r.y = y; r.map = msg.map; r.def = num(msg.def); r.dead = !!msg.dead; r.hp = num(msg.hp); r.lv = num(msg.lv); r.seen = time;
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
      const d = MONSTER_DEFS[msg.type], nid = typeof msg.nid === 'string' ? msg.nid : null;
      const p = nid ? find(nid) : null;
      if (p && p.remote) { p.dead = true; p.deadT = 0; p.respawnT = 1e9; p.localDeadUntil = time + 0.5; }
      const home = nid ? homeFor(nid, x, y) : { x, y };
      const phantom = { type: msg.type, nid, x, y, home, r: d.r, hp: 0, maxHp: d.hp, speed: d.speed, phantom: true, dead: false, deadT: 0, respawnT: 0, state: 'chase', angry: true, facing: { x: 1, y: 0 }, moving: false, walkT: 0, attackT: 0, attackCd: 0, hurtT: 0, stunT: 0, wander: { x: 0, y: 0 }, wanderT: 0 };
      _killMonster(phantom);
    });
    NET.on('hurt', msg => {
      if (!online()) return;
      const dmg = num(msg.dmg); if (dmg === null || dmg < 0 || dmg > MAX_DMG) return;
      const x = num(msg.x), y = num(msg.y);
      hurtPlayer(dmg, x === null ? player.x : x, y === null ? player.y : y);
    });
  }

  window.COOP = {
    isKeeper, keeper: () => S.keeper, map: () => S.map, remotes: () => Object.values(S.remotes), knightsHere, puppets: () => S.puppets,
    get parked() { return S.parked[S.map] || null; }, snapshot: () => snapshot(knightsHere()), find, apply: applyMon, reset, state: S,
  };

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
    const fake = { call: async () => ({}), open: () => { sock = { readyState: 1, send(str) { const m = JSON.parse(str); sent.push(m); if (m.t === 'hello') push({ t: 'welcome', me: 'Cohen', at: 0, keeper: 'Cohen' }); }, close() { sock.readyState = 3; } }; return sock; } };
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
      const shapeOk = list.length > 0 && list.every(e => Array.isArray(e) && e.length === 14 && typeof e[0] === 'string' && !!MONSTER_DEFS[e[1]] && [2, 3, 4, 5, 7, 8, 9, 12, 13].every(i => Number.isFinite(e[i])) && typeof e[6] === 'string');
      const farExists = real.some(m => !m.dead && !near(m.x, m.y)), farListed = list.some(e => !near(e[2], e[3]));
      check(P + 'the keeper streams snapshots in the contract shape, only for monsters near a knight', NET.online() && COOP.isKeeper() && COOP.map() === 'over' && mons.length >= 1 && shapeOk && farExists && !farListed && list.some(e => e[0] === gob.nid), { online: NET.online(), keeper: COOP.keeper(), map: COOP.map(), snapshots: mons.length, listed: list.length, shapeOk, farExists, farListed });

      // (b) a non-keeper shows puppets that hold still while the stream is silent
      push({ t: 'keeper', map: 'over', n: 'Ann' });
      const parked = COOP.parked;
      const ax = gob.home.x, ay = gob.home.y;
      const row = (nid, type, x, y, hp, mhp, state) => [nid, type, x, y, hp, mhp, state, 1, 0, 0, 0, 0, 0, 0];
      push({ t: 'mon', n: 'Ann', list: [row('Ann:1', 'goblin', ax, ay, 12, 12, 'idle'), row(s0.nid, s0.type, ax + 40, ay + 40, 5, s0.maxHp, 'chase')] });
      const p1 = COOP.find('Ann:1'), p2 = COOP.find(s0.nid);
      let drew = true; try { render(); } catch (e) { drew = false; }
      monsters.push(makeReal('goblin', ax, ay + 200, null, null));   // a boss file spawning locally on a non-keeper: dropped after the next update
      F.sim(60);
      check(P + 'a non-keeper parks its monsters, shows puppets that render and hold still while the stream is silent, and keeps nothing else', parked === real && monsters !== real && !!p1 && !!p2 && p1.remote && p2.remote && drew && p1.x === ax && p1.y === ay && p2.x === ax + 40 && p2.y === ay + 40 && p2.hp === 5 && p1.stunT === 0 && p2.stunT === 0 && monsters.length === 2 && monsters.every(m => m.remote), { parked: parked === real, puppets: monsters.length, allRemote: monsters.every(m => m.remote), drew, p1: p1 && [p1.x - ax, p1.y - ay, p1.stunT], p2: p2 && [p2.x - ax - 40, p2.hp] });

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
}
