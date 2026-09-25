#!/usr/bin/env node
// tools/golem-sim.js — the King's Deep with two knights: Gorm, his little golems and the giant rocks, online.
//
//   node tools/golem-sim.js            the FakeWorld below routes messages by docs/ONLINE.md's rules
//   node tools/golem-sim.js --room     online/src/room.js (the real routing class) does it instead
//
// Two whole game contexts in one Node process, wired to an in-memory world exactly as tools/mmo-sim.js wires
// them (FakeWorld, Wire and makeContext are copied from it, not imported: mmo-sim.js stays as it is). Both
// knights stand in Gorm's hall. A arrives first and keeps the map. What it proves, in order: B's warm stone
// lowers A's Gorm by exactly B's damage; B's sword sends nothing and changes nothing; a little golem lives on
// A and is only a puppet on B; B mining a restless giant rock for 1.3 s makes A wake one golem that both see;
// Gorm's fall pays A and B once each; and when A leaves, B keeps the map with exactly one Gorm.
// Exit 0 only when every line passes.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const FRAME_MS = 1000 / 60;

// ---------------------------------------------------------------------------
// FakeWorld, Wire and makeContext: copied from tools/mmo-sim.js
// ---------------------------------------------------------------------------
class FakeWorld {
  constructor({ now, log } = {}) { this.now = now || (() => Date.now()); this.log = log || (() => { }); this.k = new Map(); this.seq = 0; this.keeper = {}; }
  send(k, msg) { try { k.sock.send(JSON.stringify(msg)); } catch (e) { } }
  onMap(map) { const out = []; for (const k of this.k.values()) if (k.map === map) out.push(k); return out; }
  elect(map, tell) {
    const here = this.onMap(map).sort((a, b) => a.joined - b.joined);
    const n = here.length ? here[0].name : null;
    if (this.keeper[map] !== n) { this.keeper[map] = n; for (const k of here) this.send(k, { t: 'keeper', map, n }); }
    else if (tell) this.send(tell, { t: 'keeper', map, n });
    return n;
  }
  who() { const list = []; for (const k of this.k.values()) list.push({ n: k.name, map: k.map || 'over', region: '', lv: k.lv || 1 }); for (const k of this.k.values()) this.send(k, { t: 'who', list }); }
  join(sock, name) { this.k.set(sock, { sock, name, map: null, joined: ++this.seq, hello: false, lv: 1 }); }
  move(k, map) {
    const old = k.map; k.map = map;
    if (old) { for (const o of this.onMap(old)) this.send(o, { t: 'left', n: k.name, map: old }); this.elect(old); }
    this.elect(map, k);
  }
  message(sock, str) {
    const k = this.k.get(sock); if (!k) return;
    let m = null; try { m = JSON.parse(str); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    const t = m.t;
    if (t === 'hello') { if (k.hello) return; k.hello = true; k.map = 'over'; this.elect('over'); this.send(k, { t: 'welcome', me: k.name, at: this.now(), keeper: this.keeper.over }); this.who(); return; }
    if (!k.hello) return;
    if (t === 'ping') { this.send(k, { t: 'pong' }); return; }
    if (t === 'p') { const map = typeof m.map === 'string' ? m.map : 'over'; if (map !== k.map) this.move(k, map); if (typeof m.lv === 'number') k.lv = m.lv; const out = Object.assign({}, m, { n: k.name }); for (const o of this.onMap(map)) if (o !== k) this.send(o, out); return; }
    if (t === 'chat') { const text = String(m.text == null ? '' : m.text).slice(0, 120); const out = { t: 'chat', n: k.name, text, at: this.now() }; this.log(k.name, text, out.at); for (const o of this.k.values()) this.send(o, out); return; }
    if (t === 'mon') { if (this.keeper[k.map] !== k.name) return; for (const o of this.onMap(k.map)) if (o !== k) this.send(o, { t: 'mon', n: k.name, list: m.list }); return; }
    if (t === 'hit') { const kn = this.keeper[k.map]; for (const o of this.onMap(k.map)) if (o !== k && o.name === kn) this.send(o, { t: 'hit', n: k.name, nid: m.nid, dmg: m.dmg, knock: m.knock, bomb: m.bomb }); return; }
    if (t === 'kill' || t === 'hurt') { for (const o of this.k.values()) if (o.name === m.to) { const out = Object.assign({}, m); delete out.to; this.send(o, out); } return; }
  }
  leave(sock) {
    const k = this.k.get(sock); if (!k) return;
    this.k.delete(sock);
    if (k.map) { for (const o of this.onMap(k.map)) this.send(o, { t: 'left', n: k.name, map: k.map }); this.elect(k.map); }
    this.who();
  }
  tick() { }
}

// ---------------------------------------------------------------------------
// The wire: fake WebSocket + fake fetch for a context, an inbox and an outbox the sim pumps between frames,
// so every message crosses "the network" at a frame boundary and never inside somebody's update().
// ---------------------------------------------------------------------------
class Wire {
  constructor(room) { this.room = room; this.accounts = new Map(); this.opening = []; this.inbound = []; this.outbound = []; this.closing = []; this.srvOf = new Map(); }
  login(name) { const token = 'tok-' + name.toLowerCase().replace(/[^a-z0-9]/g, ''); this.accounts.set(token, name); return token; }
  socketClass() {
    const wire = this;
    return class FakeWebSocket {
      constructor(url) { this.url = String(url); this.readyState = 0; this.onopen = null; this.onmessage = null; this.onclose = null; this.onerror = null; wire.opening.push(this); }
      send(str) { if (this.readyState !== 1) throw new Error('socket not open'); wire.inbound.push({ client: this, str: String(str) }); }
      close() { if (this.readyState === 3) return; this.readyState = 3; wire.closing.push(this); }
    };
  }
  fetch() {
    const wire = this;
    const ok = data => ({ ok: true, status: 200, json: async () => data });
    const bad = (status, error, code) => ({ ok: false, status, json: async () => ({ error, code }) });
    return async (url, opts = {}) => {
      const p = String(url).replace(/^https?:\/\/[^/]+/, '');
      let body = null; try { body = opts.body ? JSON.parse(opts.body) : null; } catch (e) { }
      const auth = ((opts.headers && opts.headers.authorization) || '').replace(/^Bearer /, '');
      if (p === '/api/login' || p === '/api/signup') { if (!body || typeof body.name !== 'string' || typeof body.pass !== 'string' || body.pass.length < 4) return bad(400, 'bad', 'bad'); return ok({ token: wire.login(body.name), name: body.name }); }
      if (p === '/api/me') { const n = wire.accounts.get(auth); return n ? ok({ name: n, created: 0, saveAt: null, online: true }) : bad(401, 'auth', 'auth'); }
      if (p === '/api/status') return ok({ ok: true, online: wire.srvOf.size, names: [] });
      if (p === '/api/save') return opts.method === 'PUT' ? ok({ at: Date.now() }) : ok({ save: null, at: null });
      if (p === '/api/logout') return ok({ ok: true });
      return bad(404, 'not found', 'bad');
    };
  }
  flush() {
    let guard = 0;
    while ((this.opening.length || this.inbound.length || this.outbound.length || this.closing.length) && guard++ < 10000) {
      for (const c of this.opening.splice(0)) {
        const token = decodeURIComponent((c.url.split('token=')[1] || '').split('&')[0]);
        const name = this.accounts.get(token);
        if (!name) { c.readyState = 3; if (c.onclose) c.onclose(); continue; }
        const srv = { send: str => this.outbound.push({ client: c, str: String(str) }), close: () => { c.close(); } };
        this.srvOf.set(c, srv); c.readyState = 1; this.room.join(srv, name);
        if (c.onopen) c.onopen();
      }
      for (const { client, str } of this.inbound.splice(0)) { const srv = this.srvOf.get(client); if (srv) this.room.message(srv, str); }
      for (const { client, str } of this.outbound.splice(0)) { if (client.readyState === 1 && client.onmessage) client.onmessage({ data: str }); }
      for (const c of this.closing.splice(0)) { const srv = this.srvOf.get(c); if (srv) { this.srvOf.delete(c); this.room.leave(srv); } if (c.onclose) c.onclose(); }
    }
  }
}

// ---------------------------------------------------------------------------
// A fresh game context: the sandbox from tools/headless.js, plus the online switches and the fake wire.
// ---------------------------------------------------------------------------
function makeContext(wire) {
  const noop = () => { };
  const ctx2d = new Proxy({}, {
    get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: noop }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : typeof k === 'string' ? noop : undefined,
    set: () => true,
  });
  const mkCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, addEventListener: noop });
  const store = {};
  const g = {
    innerWidth: 1000, innerHeight: 700, devicePixelRatio: 1, addEventListener: noop, requestAnimationFrame: noop, setInterval: noop, setTimeout, clearTimeout,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    performance: { now: () => Date.now() }, console: Object.assign(Object.create(console), { table: () => { } }), navigator: { maxTouchPoints: 0 },
    document: { getElementById: () => mkCanvas(), createElement: () => mkCanvas(), fonts: null },
  };
  g.window = g; g.__online = true; g.__onlineBase = 'http://fake'; g.WebSocket = wire.socketClass(); g.fetch = wire.fetch();
  vm.createContext(g);
  vm.runInContext(script, g, { filename: 'index.html' });
  return g;
}

async function loadRoom(now) {
  const file = process.env.MMO_ROOM ? path.resolve(process.env.MMO_ROOM) : path.join(ROOT, 'online', 'src', 'room.js');   // MMO_ROOM=path points at another checkout's room.js
  if (!fs.existsSync(file)) { console.error('--room: ' + file + ' does not exist on this branch'); process.exit(1); }
  let mod;
  try { mod = require(file); } catch (e) { mod = await import(require('url').pathToFileURL(file).href); }
  const Room = mod.Room || (mod.default && mod.default.Room) || mod.default;
  if (typeof Room !== 'function') { console.error('--room: no Room class exported by ' + file); process.exit(1); }
  return new Room({ now, log: () => { }, wake: () => { } });
}


async function main() {
  const t0 = Date.now();
  const useRoom = process.argv.includes('--room');
  let vnow = Date.now(); const now = () => vnow;
  const room = useRoom ? await loadRoom(now) : new FakeWorld({ now });
  const wire = new Wire(room);
  const A = makeContext(wire), B = makeContext(wire);
  const both = [A, B];
  const results = [];
  const line = (name, ok, info) => { results.push(!!ok); console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined ? '   ' + JSON.stringify(info) : '')); };
  const R = (g, code) => vm.runInContext(code, g);
  for (const g of both) { g.FANGLANDS.newGame(); R(g, 'title.active = false;'); }
  let frames = 0;
  const tick = (n, each) => {
    for (let i = 0; i < n; i++) {
      for (const g of both) g.FANGLANDS.step([]);
      vnow += FRAME_MS; frames++;
      if (typeof room.tick === 'function') room.tick();
      wire.flush();
      if (each) each();
    }
  };
  // both clocks read the sim's clock, so the vein glow, the rocks and the restless windows agree
  for (const g of both) g.ROYALMINE.setNow(() => vnow);
  const login = async (g, name) => { const r = await g.NET.post('/api/login', { name, pass: 'secret' }); g.NET.setToken(r.token); g.NET.connect(); wire.flush(); return r; };
  await login(A, 'Ann');
  await login(B, 'Ben');
  tick(4);
  // both knights have opened the Heart Door on their own game and carry a pickaxe; A goes down first.
  // No peace mode: the core heals a monster 1 hp when peace sends it home, which would blur the exact hit in line 2.
  // Gorm only reaches a knight inside 73 px, and both knights stand further off than that.
  for (const g of both) {
    R(g, `quest.royal = { stage: 6, caught: 3, door: true, falls: 0, best: 0, payouts: 0, seenHow: true, seenRestless: true, seenWake: true, seenGiant: true };
      player.inv = new Array(INV_SLOTS).fill(null); addItem('bronze_pickaxe', 1); addItem('iron_sword', 1); player.equip.weapon = 'iron_sword';
      for (const s of ['mining', 'smithing', 'melee', 'defence']) player.skills[s].xp = XP_TABLE[40]; recomputeMaxHp(); player.hp = player.maxHp;
      ROYALMINE.TEST.noRocks = true; ROYALMINE.TEST.noLings = true; window.__peace = false;`);
  }
  R(A, `INSTANCES.enter('royalmine'); FANGLANDS.tp(24, 37);`); tick(12);
  R(B, `INSTANCES.enter('royalmine'); FANGLANDS.tp(30, 36);`); tick(24);
  const gA = () => A.ROYALMINE.gorm(), gB = () => B.ROYALMINE.gorm();
  line('1. A (the keeper) and B are both in the King\'s Deep: A keeps the map and B shows A\'s Gorm as a puppet',
    A.INSTANCES.active() === 'royalmine' && B.INSTANCES.active() === 'royalmine' && A.COOP.isKeeper() && B.COOP.keeper() === 'Ann' && !!gB() && gB().remote && gB().nid === 'i0' && !!gA() && !gA().remote,
    { a: A.INSTANCES.active(), b: B.INSTANCES.active(), keeper: [A.COOP.keeper(), B.COOP.keeper()], puppet: gB() && [gB().nid, !!gB().remote] });

  // ---- 2. B's warm stone lowers A's Gorm by exactly B's damage ----
  tick(10);
  const hp0 = gA().hp, max0 = gA().maxHp;
  R(B, `ROYALMINE.arms.warm = 1; ROYALMINE.arms.raw = 0; ROYALMINE.fight.throwCd = 0; ROYALMINE.throwStone();`);
  tick(40);
  const dmgB = B.ROYALMINE.fight.lastThrowDmg;
  line('2. B\'s throw lowers A\'s Gorm by exactly the damage B rolled', typeof dmgB === 'number' && dmgB >= 70 && dmgB <= 90 && gA().hp === hp0 - dmgB && gA().maxHp === max0,
    { before: hp0, after: gA().hp, dmgB, max: gA().maxHp });

  // ---- 3. B's sword sends nothing and changes nothing ----
  let hitsFromB = 0; A.NET.on('hit', m => { if (m.n === 'Ben') hitsFromB++; });
  const hp1 = gA().hp;
  R(B, `(() => { const m = ROYALMINE.gorm(); player.x = m.x; player.y = m.y - 70; player.facing = { x: 0, y: 1 }; player.attackCd = 0; ROYALMINE.arms.warm = 0; })()`);
  B.FANGLANDS.press('Space'); wire.flush(); tick(20);
  line('3. B\'s sword on Gorm sends no hit and leaves him as he was', hitsFromB === 0 && gA().hp === hp1, { hitsFromB, before: hp1, after: gA().hp });
  R(B, `FANGLANDS.tp(30, 36);`); tick(4);

  // ---- 4. a little golem lives on A and is only a puppet on B ----
  R(A, `ROYALMINE.spawnGolemling(1);`); tick(12);
  const lingA = A.FANGLANDS.monsters.find(m => m.type === 'golemling' && !m.dead);
  const lingB = B.FANGLANDS.monsters.find(m => m.type === 'golemling' && !m.dead);
  const bAllPuppets = B.FANGLANDS.monsters.every(m => m.remote);
  const pos0 = lingB && { x: lingB.x, y: lingB.y };
  tick(30);
  const lingB2 = lingB && B.COOP.find(lingB.nid);
  // a snapshot goes out eight times a second and a little golem walks 50 px/s, so the puppet trails by up to ~7 px
  const followsA = !!lingB2 && Math.abs(lingB2.x - lingA.x) <= 12 && Math.abs(lingB2.y - lingA.y) <= 12 && (Math.abs(lingB2.x - pos0.x) > 1 || Math.abs(lingB2.y - pos0.y) > 1);
  line('4. a little golem exists on A and shows on B only as a puppet that follows A\'s (B does not walk it)', !!lingA && !lingA.remote && !!lingB && lingB.remote && bAllPuppets && followsA,
    { onA: !!lingA, onB: !!lingB, puppet: lingB && !!lingB.remote, bAllPuppets, followsA, a: lingA && [Math.round(lingA.x), Math.round(lingA.y)], b: lingB2 && [Math.round(lingB2.x), Math.round(lingB2.y)] });
  R(A, `monsters = monsters.filter(m => m.type !== 'golemling');`); tick(30);

  // ---- 5. B mines a restless giant rock: A wakes one golem, and both see it ----
  // a clock where giant mithril rock 0 is restless; B stands under it with a bronze pick (a 1.8 s swing, so B's own crack
  // cannot land before A has seen 1.2 s of mining in B's presence)
  let T0 = 0; for (let k = 90000; k < 200000; k++) if (A.ROYALMINE.h32(1, k) < 0.25) { T0 = k * 10000 + 5; break; }
  const shift = T0 - vnow; for (const g of both) g.ROYALMINE.setNow(() => vnow + shift);
  R(B, `FANGLANDS.tp(7, 15); FANGLANDS.face(7, 14); player.attackCd = 0;`);
  B.FANGLANDS.press('KeyE'); wire.flush();
  const miningB = !!B.FANGLANDS.player.action && B.FANGLANDS.player.action.type === 'mine';
  let woke = 0; for (let i = 0; i < 90 && !woke; i++) { tick(1); woke = A.FANGLANDS.monsters.filter(m => m.type === 'rock_golem' && !m.dead).length; }
  tick(24);
  const golemsA = A.FANGLANDS.monsters.filter(m => m.type === 'rock_golem' && !m.dead), golemsB = B.FANGLANDS.monsters.filter(m => m.type === 'rock_golem' && !m.dead);
  line('5. B mining a restless giant rock for 1.3 s makes A wake exactly one rock golem, and B sees it', miningB && golemsA.length === 1 && golemsB.length === 1 && golemsB[0].remote && golemsB[0].nid === golemsA[0].nid,
    { miningB, onA: golemsA.length, onB: golemsB.length, nid: golemsA[0] && golemsA[0].nid });
  R(A, `monsters = monsters.filter(m => m.type !== 'rock_golem');`); R(B, `player.action = null; FANGLANDS.tp(30, 36);`); tick(40);

  // ---- 6. Gorm's fall pays A and B once each ----
  const pay0 = [A.FANGLANDS.quest.royal.payouts, B.FANGLANDS.quest.royal.payouts];
  R(A, `(() => { const m = ROYALMINE.gorm(); m.hp = 60; FANGLANDS.tp(24, 37); ROYALMINE.arms.warm = 1; ROYALMINE.fight.throwCd = 0; ROYALMINE.throwStone(); })()`);
  tick(60);
  const downA = !!gA() && gA().dead, downB = !gB() || gB().dead || gB().hp <= 0;
  tick(120);
  const pay1 = [A.FANGLANDS.quest.royal.payouts, B.FANGLANDS.quest.royal.payouts], falls = [A.FANGLANDS.quest.royal.falls, B.FANGLANDS.quest.royal.falls];
  line('6. Gorm falls and A and B are each paid once (A for the killing stone, B for its stone this life)', downA && downB && pay1[0] === pay0[0] + 1 && pay1[1] === pay0[1] + 1 && falls[0] === 1 && falls[1] === 1,
    { downA, downB, payouts: pay1, falls });

  // ---- 7. A leaves: B keeps the map, with exactly one Gorm ----
  R(A, `INSTANCES.leave();`); tick(30);
  const BM = B.FANGLANDS.monsters, gorms = BM.filter(m => m.type === 'gorm');
  line('7. A leaves the mine: B becomes its keeper with exactly one Gorm and no puppets left', B.COOP.isKeeper() && B.COOP.puppets() === null && gorms.length === 1 && BM.every(m => !m.remote),
    { keeper: B.COOP.keeper(), gorms: gorms.length, puppets: BM.filter(m => m.remote).length });

  const bad = results.filter(r => !r).length;
  console.log((bad ? `${bad} FAILED of ${results.length}` : `ALL ${results.length} PASS`) + ` (${useRoom ? 'online/src/room.js' : 'FakeWorld'}, ${Date.now() - t0} ms)`);
  process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
