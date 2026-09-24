#!/usr/bin/env node
// tools/mmo-sim.js — two whole game contexts in one Node process, wired to an in-memory world.
//
//   node tools/mmo-sim.js            the FakeWorld below routes messages by docs/ONLINE.md's rules
//   node tools/mmo-sim.js --room     online/src/room.js (the real routing class) does it instead (MMO_ROOM=path overrides the file)
//
// What it proves, in order: two knights log in with fake tokens; the first one in is the keeper of the
// overworld; the second sees the first's presence; standing by the same goblin, the second knight's hit
// reaches the keeper's monster, the keeper's hp shows on the puppet after the next snapshot, and the last
// hit gives the kill to the second knight and not the keeper; a goblin chases the second knight while the
// keeper stands far away; a chat line crosses; and when the keeper disconnects the other becomes keeper
// with no duplicate monsters. Exit 0 only when every line passes.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const FRAME_MS = 1000 / 60;

// ---------------------------------------------------------------------------
// FakeWorld: the contract's routing rules and nothing else. Server-side sockets are { send(str) }.
// welcome on hello; presence relayed to the same map; who on join/leave; keeper = earliest-joined on
// the map; mon relayed to the map's non-keepers; hit to the map's keeper; kill/hurt to `to`; chat to all.
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
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  for (const g of both) g.FANGLANDS.newGame();

  // presence, as the players file will send it once it is merged (a context that has one sends its own)
  const presence = g => {
    if (g.PLAYERS || !g.NET.online()) return;
    const p = g.FANGLANDS.player;
    g.NET.send({ t: 'p', map: g.COOP.map(), x: Math.round(p.x), y: Math.round(p.y), fx: p.facing.x, fy: p.facing.y, mv: p.moving ? 1 : 0, wt: 0, hp: p.hp, mhp: p.maxHp, lv: g.FANGLANDS.combatLevel(), look: null, mech: null, dead: p.dead, def: g.playerDefRoll(), act: null });
  };
  let frames = 0;
  const tick = (n, each) => {
    for (let i = 0; i < n; i++) {
      for (const g of both) g.FANGLANDS.step([]);
      if (frames % 8 === 0) for (const g of both) presence(g);
      vnow += FRAME_MS; frames++;
      if (typeof room.tick === 'function') room.tick();
      wire.flush();
      if (each) each();
    }
  };
  const heal = () => { for (const g of both) { const p = g.FANGLANDS.player; if (p.hp < 10) p.hp = p.maxHp; } };

  // ---- 1. log in ----
  const login = async (g, name) => { const r = await g.NET.post('/api/login', { name, pass: 'secret' }); g.NET.setToken(r.token); g.NET.connect(); wire.flush(); return r; };
  await login(A, 'Ann');
  await login(B, 'Ben');
  line('A and B log in with fake tokens and reach the world', A.NET.online() && B.NET.online() && A.NET.me === 'Ann' && B.NET.me === 'Ben', { a: A.NET.status, b: B.NET.status, me: [A.NET.me, B.NET.me] });
  tick(2);
  line('A is keeper of the overworld on both sides; B shows puppets', A.COOP.isKeeper() && A.COOP.map() === 'over' && B.COOP.keeper() === 'Ann' && !B.COOP.isKeeper() && Array.isArray(B.COOP.puppets()), { aKeeper: A.COOP.keeper(), bKeeper: B.COOP.keeper(), bPuppets: !!B.COOP.puppets() });

  // ---- 2. presence ----
  tick(10);
  const seen = B.COOP.remotes().find(r => r.n === 'Ann');
  line('B sees A\'s presence on the same map', !!seen && seen.map === 'over' && Math.abs(seen.x - Math.round(A.FANGLANDS.player.x)) <= 1, seen && { x: seen.x, ax: Math.round(A.FANGLANDS.player.x), map: seen.map });

  // ---- 3. the same goblin ----
  const AM = A.FANGLANDS.monsters, T = A.FANGLANDS.TILE;
  // a goblin standing alone: nothing else within three tiles of its home, so B's swing can only ever hit this one
  const alone = m => !AM.some(o => o !== m && !o.dead && dist(o, m.home) < 3 * T);
  const g1 = AM.find(m => m.type === 'goblin' && !m.dead && m.nid && !A.isCampMonster(m) && alone(m)) || AM.find(m => m.type === 'goblin' && !m.dead && m.nid && !A.isCampMonster(m));
  const gx = Math.floor(g1.home.x / T), gy = Math.floor(g1.home.y / T);
  g1.x = g1.home.x; g1.y = g1.home.y; g1.state = 'idle'; g1.hp = g1.maxHp; g1.dead = false; g1.lastHitBy = null;
  g1.wanderT = 99; g1.wander = { x: 0, y: 0 };   // stand still: the position check below compares the puppet with the keeper's monster
  A.__peace = true; B.__peace = true;   // held still for the position check
  A.FANGLANDS.tp(gx + 3, gy); B.FANGLANDS.tp(gx - 1, gy); A.FANGLANDS.face(gx, gy); B.FANGLANDS.face(gx, gy);
  tick(12);
  const pb = B.COOP.find(g1.nid);
  line('B has a puppet for A\'s goblin after the first snapshot, at the keeper\'s position', !!pb && pb.remote && pb.type === 'goblin' && Math.abs(pb.x - g1.x) <= 2 && Math.abs(pb.y - g1.y) <= 2, { nid: g1.nid, puppet: pb && [Math.round(pb.x), Math.round(pb.y)], keeper: [Math.round(g1.x), Math.round(g1.y)] });
  // peace off for the fight: a goblin left alone walks home and heals a point on arrival (07-update), so a fists-only
  // knight could lose the race; chasing B it never goes home. A stands three tiles east so B is its nearest knight.
  A.__peace = false; B.__peace = false;

  // B swings until a hit lands on A's goblin (a swing can miss; fists reach one tile)
  const standByPuppet = () => { const p = B.COOP.find(g1.nid); if (!p) return; const bp = B.FANGLANDS.player; bp.x = p.x - 40; bp.y = p.y; bp.facing = { x: 1, y: 0 }; };   // one fist-reach west of wherever the puppet stands
  g1.hp = 5;
  const kA0 = A.FANGLANDS.player.kills, kB0 = B.FANGLANDS.player.kills;
  let hitsSeen = 0; const hitNids = {}; A.NET.on('hit', m => { hitsSeen++; hitNids[m.nid] = (hitNids[m.nid] || 0) + 1; });
  let landed = null, swings = 0;
  while (!landed && swings < 60) { standByPuppet(); B.FANGLANDS.press('Space'); swings++; wire.flush(); if (g1.hp < 5) landed = { swings, hp: g1.hp, hitMessages: hitsSeen }; tick(40, heal); }
  const pbNow = B.COOP.find(g1.nid);
  line('B\'s hit reaches A\'s monster (the hit is routed to the keeper)', !!landed && hitsSeen >= 1 && g1.lastHitBy === 'Ben', landed || { swings, hitMessages: hitsSeen, hitNids, g1: [g1.nid, g1.dead, g1.hp, g1.state], puppet: pbNow && [pbNow.dead, pbNow.gone, Math.round(pbNow.x), Math.round(pbNow.y)], aOnline: A.NET.online(), aKeeper: A.COOP.isKeeper(), bKeeper: B.COOP.keeper(), bHere: A.COOP.knightsHere().length });
  tick(10);
  const pb2 = B.COOP.find(g1.nid);
  line('A\'s monster hp shows on B\'s puppet after the next snapshot', !!pb2 && pb2.hp === g1.hp && g1.hp < g1.maxHp, { keeper: g1.hp, puppet: pb2 && pb2.hp });

  // B lands the last hit
  let killMsgs = 0; B.NET.on('kill', () => killMsgs++);
  swings = 0;
  while (!g1.dead && swings < 80) { standByPuppet(); B.FANGLANDS.press('Space'); swings++; wire.flush(); tick(40, heal); }
  line('B lands the last hit: B\'s kills go up by exactly one and A\'s do not', g1.dead && killMsgs === 1 && B.FANGLANDS.player.kills === kB0 + 1 && A.FANGLANDS.player.kills === kA0, { dead: g1.dead, killMessages: killMsgs, bKills: B.FANGLANDS.player.kills - kB0, aKills: A.FANGLANDS.player.kills - kA0, swings });
  const pb3 = B.COOP.find(g1.nid);
  line('the puppet lies down on B\'s side too', !pb3 || pb3.dead, { puppetDead: pb3 ? pb3.dead : 'gone' });

  // ---- 4. the goblin chases B when A is far ----
  const g2 = AM.find(m => m.type === 'goblin' && !m.dead && m !== g1 && m.nid && !A.isCampMonster(m) && alone(m)) || AM.find(m => m.type === 'goblin' && !m.dead && m !== g1 && m.nid && !A.isCampMonster(m));
  g2.x = g2.home.x; g2.y = g2.home.y; g2.state = 'idle'; g2.hp = g2.maxHp; g2.attackCd = 0; g2.stunT = 0; g2.lastHitBy = null;
  const g2x = Math.floor(g2.home.x / T), g2y = Math.floor(g2.home.y / T);
  A.__peace = false; B.__peace = false;
  A.FANGLANDS.tp(Math.min(g2x + 16, A.FANGLANDS.MAP_W - 2), g2y); B.FANGLANDS.tp(g2x - 1, g2y); B.FANGLANDS.face(g2x, g2y);
  let hurts = 0; B.NET.on('hurt', () => hurts++);
  const bp = B.FANGLANDS.player;
  const dStart = dist(g2, bp);
  tick(150, heal);
  line('A\'s goblin chases B while A stands far away, and B takes its hits', dist(A.FANGLANDS.player, g2.home) > 10 * T && g2.state === 'chase' && dist(g2, bp) < Math.min(dStart, 60) && hurts >= 1, { keeperTiles: Math.round(dist(A.FANGLANDS.player, g2.home) / T), state: g2.state, gap: Math.round(dist(g2, bp)), hurtMessages: hurts });

  // ---- 5. chat ----
  const chatLog = []; B.NET.on('chat', m => chatLog.push(m.n + ': ' + m.text));
  A.NET.send({ t: 'chat', text: 'hello Ben' }); wire.flush();
  line('a chat line from A appears in B\'s log', chatLog.includes('Ann: hello Ben'), chatLog);

  // ---- 6. handoff ----
  const spawnCount = A.FANGLANDS.monsters.filter(m => /^s\d+$/.test(m.nid)).length;
  A.NET.disconnect(); wire.flush(); tick(3);
  const BM = B.FANGLANDS.monsters, nids = BM.map(m => m.nid).filter(Boolean);
  line('A disconnects: B becomes keeper with no duplicate monsters', B.COOP.isKeeper() && B.COOP.puppets() === null && BM.every(m => !m.remote) && new Set(nids).size === nids.length && BM.filter(m => /^s\d+$/.test(m.nid)).length === spawnCount, { keeper: B.COOP.keeper(), monsters: BM.length, spawnNids: BM.filter(m => /^s\d+$/.test(m.nid)).length, expected: spawnCount, uniq: new Set(nids).size === nids.length });
  const g2b = B.COOP.find(g2.nid); const g2bPos = g2b && { x: g2b.x, y: g2b.y };
  tick(20, heal);
  line('B keeps running its monsters alone afterwards (the goblin it stands by is real and chases it)', !!g2b && !g2b.remote && !g2b.dead && (g2b.state === 'chase' || dist(g2b, g2bPos) > 1), { state: g2b && g2b.state, moved: g2b && Math.round(dist(g2b, g2bPos)) });

  const bad = results.filter(r => !r).length;
  console.log((bad ? `${bad} FAILED of ${results.length}` : `ALL ${results.length} PASS`) + ` (${useRoom ? 'online/src/room.js' : 'FakeWorld'}, ${Date.now() - t0} ms)`);
  process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
