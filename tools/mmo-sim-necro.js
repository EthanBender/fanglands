#!/usr/bin/env node
// tools/mmo-sim-necro.js — Necromancy online (docs/ONLINE.md: `look.necro`, the Old Barrow's named bosses and the Lantern
// Watch; src/89-necromancy.js, src/89-oldbarrow.js), two whole games in one Node process wired to online/src/room.js (the real
// Room). Ann and Ben stand in the Barrow Deep; Ann came first and keeps the map.
//
//   node tools/mmo-sim-necro.js
//
// What it proves, in order: Ben sees Ann's helper, her ward and her Ghostlight in her presence (look.necro) and draws them;
// Ben pulls the Dusk Watch's rope and Ann's game (the keeper) starts it, the bell's state streaming to Ben; Ben's Soul Bolt
// on a wisp (a puppet on his screen) lowers Ann's real wisp by exactly his hit; Ann leaves mid-watch and Ben keeps the map with
// one bell and five candles and the watch carries on from the streamed wave to `won`; each knight is paid only the waves he
// was in the hall for, on his own game; Ann comes back and calls the Barrow King from the throne (Ben, now the keeper, wakes
// him); the court shields him on the keeper and both knights get the kill (the helper credit); the Hollow fades on the keeper
// and Ann's Ghostlight (her presence) pulls it out; and in the whole run neither game sent a message type Necromancy did not
// already use (p, hit, boss_call, mon, kill, hurt, the login's own), nor logged an error. Exit 0 only when every line passes.
// Every game runs on the sim's clock. NECRO_PAGE=<a built index.html> puts another build under test.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const scriptOf = html => html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
// NECRO_PAGE: another built page to put under test
const script = scriptOf(fs.readFileSync(process.env.NECRO_PAGE || path.join(ROOT, 'index.html'), 'utf8'));
const FRAME_MS = 1000 / 60;

// ---------------------------------------------------------------------------
// The wire and a game context: copied from tools/mmo-sim-ride.js (which copied them from tools/golem-sim.js and tools/mmo-sim.js)
// ---------------------------------------------------------------------------
class Wire {
  constructor(room) { this.room = room; this.accounts = new Map(); this.opening = []; this.inbound = []; this.outbound = []; this.closing = []; this.srvOf = new Map(); this.mute = new Set(); }
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
      // a muted client's line is silent both ways (its wifi dropped without the socket closing)
      for (const { client, str } of this.inbound.splice(0)) { const srv = this.srvOf.get(client); if (srv && !this.mute.has(client)) this.room.message(srv, str); }
      for (const { client, str } of this.outbound.splice(0)) { if (client.readyState === 1 && client.onmessage && !this.mute.has(client)) client.onmessage({ data: str }); }
      for (const c of this.closing.splice(0)) { const srv = this.srvOf.get(c); if (srv) { this.srvOf.delete(c); this.room.leave(srv); } if (c.onclose) c.onclose(); }
    }
  }
}
function makeContext(wire, src, opts = {}) {
  const noop = () => { };
  const ctx2d = new Proxy({}, {
    get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: noop }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : typeof k === 'string' ? noop : undefined,
    set: () => true,
  });
  const mkCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, addEventListener: noop });
  const store = {};
  const errors = [];
  const g = {
    innerWidth: 1000, innerHeight: 700, devicePixelRatio: 1, addEventListener: noop, requestAnimationFrame: noop, setInterval: noop, setTimeout, clearTimeout,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    performance: { now: opts.now || (() => Date.now()) }, console: Object.assign(Object.create(console), { table: () => { }, error: (...a) => { errors.push(a.map(String).join(' ')); } }), navigator: { maxTouchPoints: 0 },
    document: { getElementById: () => mkCanvas(), createElement: () => mkCanvas(), fonts: null },
  };
  g.window = g; g.__online = opts.offline ? false : true; g.__onlineBase = 'http://fake'; g.WebSocket = wire.socketClass(); g.fetch = wire.fetch();
  g.__errors = errors;
  vm.createContext(g);
  vm.runInContext(src, g, { filename: 'index.html' });
  return g;
}


async function main() {
  const t0 = Date.now();
  let vnow = Date.now(); const now = () => vnow;
  const { Room } = await import(require('url').pathToFileURL(path.join(ROOT, 'online', 'src', 'room.js')).href);
  const { MoveBook } = await import(require('url').pathToFileURL(path.join(ROOT, 'online', 'src', 'move.js')).href);
  const { readAtlas } = await import(require('url').pathToFileURL(path.join(ROOT, 'online', 'src', 'atlas.js')).href);
  const atlas = readAtlas(JSON.parse(fs.readFileSync(path.join(ROOT, 'online', 'src', 'atlas.json'), 'utf8')));
  const book = new MoveBook(null, now);
  const room = new Room({ now, log: () => { }, wake: () => { }, atlas, moveBook: book });
  const wire = new Wire(room);
  const vc = { now };
  const A = makeContext(wire, script, vc), B = makeContext(wire, script, vc);
  const games = [A, B];
  const results = [];
  const line = (name, ok, info) => { results.push(!!ok); console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined ? '   ' + JSON.stringify(info) : '')); };
  const R = (g, code) => vm.runInContext(code, g);
  // every message each game sends, by type (the socket's own send, before the world)
  const sentTypes = new Map([[A, new Set()], [B, new Set()]]);
  for (const g of games) R(g, `(() => { const _s = NET.send; NET.send = function (m) { (window.__sent = window.__sent || []).push(m && m.t); return _s.apply(this, arguments); }; })()`);
  for (const g of games) { g.FANGLANDS.newGame(); R(g, `title.active = false; window.__peace = true; dialog.cur = null; dialog.queue.length = 0; player.visitedVillage = true;
    player.skills.necromancy.xp = xpForLevel(80); player.skills.melee.xp = xpForLevel(70); player.skills.defence.xp = xpForLevel(70); recomputeMaxHp(); player.hp = player.maxHp;
    quest.barrow = { q1: 9, q2: 9, q3: 9, q4: 1, q5: 2, lanterns: [] }; player.necro = { spirit: 200, known: {}, ready: 'bolt', ghosts: {}, watch: { best: 0 } };
    addItem('bramble_collar', 1); addItem('kings_seal', 1); addItem('bone', 50); addItem('grave_dust', 20); addItem('soul_shard', 20); player.equip.weapon = 'bone_stave';`); }
  let frames = 0;
  const tick = (n, each) => {
    for (let i = 0; i < n; i++) {
      for (const g of games) { if (g.__gone) continue; g.FANGLANDS.step([]); R(g, 'dialog.cur = null; dialog.queue.length = 0; NECRO.N().spirit = 200;'); }
      vnow += FRAME_MS; frames++;
      room.tick(); wire.flush();
      if (each && each() === true) return i + 1;
    }
    return n;
  };
  const press = (g, code) => { g.FANGLANDS.press(code); wire.flush(); };
  const login = async (g, name) => { const r = await g.NET.post('/api/login', { name, pass: 'secret' }); g.NET.setToken(r.token); g.NET.connect(); wire.flush(); return r; };
  await login(A, 'Ann'); tick(4);
  // the Deep's own map, read from the game (OLD_BARROW.DEEP): the bell, the hall, the throne, the circle
  const D = R(A, 'OLD_BARROW.DEEP');
  const put = (g, tx, ty, fx = 0, fy = 1) => R(g, `FANGLANDS.tp(${tx}, ${ty}); player.facing = { x: ${fx}, y: ${fy} }; player.hp = player.maxHp;`);
  R(A, `INSTANCES.enter('barrow_deep')`); tick(10);
  await login(B, 'Ben'); tick(4);
  R(B, `INSTANCES.enter('barrow_deep')`); tick(20);
  put(A, D.bell[0] - 3, D.bell[1] + 3); put(B, D.bell[0] + 3, D.bell[1] + 3); tick(30);
  const keeperOf = g => R(g, 'COOP.keeper()');
  line('0. Ann and Ben are both in the Barrow Deep; Ann came first and keeps it, and Ben sees her monsters (the candles and the bell) as puppets',
    keeperOf(A) === 'Ann' && keeperOf(B) === 'Ann' && R(B, `monsters.filter(m => m.remote && (m.type === 'watch_candle' || m.type === 'watch_bell')).length`) === 6,
    { A: keeperOf(A), B: keeperOf(B), puppets: R(B, `monsters.map(m => m.type + (m.remote ? '*' : '')).join(',')`) });

  // ---- 1. Ann's helper, ward and Ghostlight ride in her presence; Ben draws them ----
  R(A, `for (const k in NECRO.CD) delete NECRO.CD[k]; NECRO.cast('raise'); NECRO.cast('ward'); NECRO.cast('light');`); tick(30);
  const seen = R(B, `(() => { const e = PLAYERS.remote.Ann; const n = e && e.look && e.look.necro; return n ? { h: (n.h || []).length, w: n.w || 0, gl: n.gl || 0 } : null; })()`);
  const drew = R(B, `(() => { let calls = 0; const A0 = window.NECRO_ART, spy = Object.assign({}, A0, { helper: (...a) => { calls++; return A0.helper(...a); } }); window.NECRO_ART = spy; const items = []; for (const hk of HOOKS.draw) hk(ctx, items, cam); for (const it of items) it.draw(); window.NECRO_ART = A0; return calls; })()`);
  line('1. Ann raises a Bone Squire, a Bone Ward and her Ghostlight: Ben reads all three in her presence (look.necro) and draws her helper',
    !!seen && seen.h === 1 && seen.w > 0 && seen.gl === 1 && drew >= 1, { seen, drew });

  // ---- 2. Ben pulls the Dusk rope: the keeper (Ann) starts the watch; its state streams to Ben ----
  put(B, D.ropes.watch_dusk[0], D.ropes.watch_dusk[1] + 1, 0, -1); tick(4); press(B, 'KeyE');
  tick(240, () => R(A, 'OLD_BARROW.bellMon().state') === 'w1' && R(B, `(monsters.find(m => m.type === 'watch_bell') || {}).state`) === 'w1');
  const stA = R(A, 'OLD_BARROW.bellMon().state'), stB = R(B, `(monsters.find(m => m.type === 'watch_bell') || {}).state`);
  line('2. Ben pulls the Dusk Watch\'s rope (a boss_call): Ann\'s game, the keeper, rings the bell and spawns the wave; Ben sees the bell at w1 and the wisps as puppets',
    stA === 'w1' && stB === 'w1' && R(A, `OLD_BARROW.foes().length`) >= 3 && R(B, `monsters.filter(m => m.remote && m.type === 'barrow_wisp').length`) >= 1, { stA, stB, foes: R(A, 'OLD_BARROW.foes().length') });

  // ---- 3. Ben's Soul Bolt on a wisp (a puppet here) lowers Ann's real wisp by exactly his hit ----
  put(B, D.bell[0], D.bell[1] + 3); tick(2);
  const target = R(B, `(() => { const AIM = -60;   // a bolt's length off the wisp, facing it
    const m = monsters.find(q => q.remote && q.type === 'barrow_wisp' && !q.dead); if (!m) return null; player.x = m.x + AIM; player.y = m.y; player.facing = { x: 1, y: 0 }; return m.nid; })()`);
  R(A, `(() => { const m = monsters.find(q => q.nid === ${JSON.stringify(target)}); if (m) { m.hp = m.maxHp = 500; } })()`); tick(12);
  R(B, `(() => { let k = 0; window.__rnd = Math.random; Math.random = () => (k++ % 2 === 0 ? 0 : 0.999); for (const c in NECRO.CD) delete NECRO.CD[c]; NECRO.cast('bolt'); })()`);
  const sentHit = () => R(B, `(window.__sent || []).filter(t => t === 'hit').length`);
  const h0 = sentHit(); tick(60); R(B, `Math.random = window.__rnd`);
  const hpA = R(A, `(monsters.find(q => q.nid === ${JSON.stringify(target)}) || {}).hp`), max = R(B, 'NECRO.boltMax()');
  line('3. Ben\'s Soul Bolt on a wisp (a puppet on his screen) goes out as a hit and lowers Ann\'s real wisp by exactly his hit',
    !!target && sentHit() > h0 && hpA === 500 - max, { target, hpA, max, hits: sentHit() - h0 });

  // ---- 4. the waves move on; Ann leaves mid-watch; Ben keeps the map and the watch carries on to won ----
  // (the keeper's game lays the wave's monsters down; each knight lands a hit in the hall first, so each is paid)
  R(A, `(() => { const f = OLD_BARROW.foes()[0]; if (f) hitMonster(f, 1, 0); })()`);
  R(B, `(() => { const f = monsters.find(q => q.remote && !q.dead && OLD_BARROW.isWatchFoe(q)); if (f) hitMonster(f, 1, 0, false, 'necro'); })()`); tick(10);
  const xA0 = R(A, 'player.skills.necromancy.xp'), xB0 = R(B, 'player.skills.necromancy.xp');
  const keeperClears = g => R(g, `(() => { for (const m of OLD_BARROW.foes()) { m.dead = true; m.deadT = 0; } for (const c of OLD_BARROW.candles()) c.hp = c.maxHp; })()`);
  tick(60 * 30, () => { keeperClears(A); return R(A, 'OLD_BARROW.bellMon().state') === 'w3'; });
  const before = { A: R(A, 'OLD_BARROW.bellMon().state'), B: R(B, `(monsters.find(m => m.type === 'watch_bell') || {}).state`) };
  R(A, `INSTANCES.leave()`); tick(30);
  const kB = keeperOf(B);
  tick(60 * 60, () => { if (keeperOf(B) === 'Ben') keeperClears(B); return R(B, `(monsters.find(m => m.type === 'watch_bell') || {}).state`) === 'won'; });
  const bells = R(B, `monsters.filter(m => m.type === 'watch_bell' && !m.dead).length`), cands = R(B, `monsters.filter(m => m.type === 'watch_candle').length`);
  const xA = R(A, 'player.skills.necromancy.xp') - xA0, xB = R(B, 'player.skills.necromancy.xp') - xB0;
  line('4. Ann leaves at wave 3: Ben keeps the Deep with one bell and five candles, the watch carries on from the streamed wave to won; Ann was paid waves 1 and 2 (20 + 40), Ben every wave (420), each on his own game',
    before.A === 'w3' && kB === 'Ben' && R(B, `(monsters.find(m => m.type === 'watch_bell') || {}).state`) === 'won' && bells === 1 && cands === 5 && xA === 60 && xB === 420,
    { before, kB, bells, cands, xA, xB });

  // ---- 5. Ann comes back; she calls the Barrow King at his throne; Ben (the keeper) wakes him; the court shields him ----
  tick(60 * 10);
  R(A, `INSTANCES.enter('barrow_deep')`); tick(30);
  put(A, D.throne[0], D.throne[1] + 1, 0, -1); put(B, D.throne[0] + 2, D.throne[1] + 3); tick(30);
  press(A, 'KeyE'); tick(120, () => !!R(B, `OLD_BARROW.live('barrow_king')`)); tick(20);
  const kingB = R(B, `!!OLD_BARROW.live('barrow_king')`), kingA = R(A, `!!monsters.find(m => m.type === 'barrow_king' && m.remote && !m.dead)`), court = R(B, `OLD_BARROW.courtiers().length`);
  const shield = R(B, `(() => { const k = OLD_BARROW.live('barrow_king'); const h = k.hp; hitMonster(k, 20, 0); return k.hp === h; })()`);
  line('5. Ann calls the Barrow King from his throne (a boss_call): Ben, the keeper now, wakes him and his court, both see him, and the court shields him on the keeper',
    keeperOf(A) === 'Ben' && kingB && kingA && court === 3 && shield, { keeper: keeperOf(A), kingB, kingA, court, shield });

  // ---- 6. both fight; the court falls; the King falls; both are paid their own first kill ----
  R(B, `for (const c of OLD_BARROW.courtiers()) { c.hp = 0; killMonster(c); }`); tick(10);
  for (let k = 0; k < 4; k++) { R(A, `(() => { const k = monsters.find(m => m.type === 'barrow_king' && !m.dead); if (k) { player.x = k.x; player.y = k.y + 40; hitMonster(k, 5, 0, false, 'necro'); } })()`); R(B, `(() => { const k = OLD_BARROW.live('barrow_king'); if (k) hitMonster(k, 5, 0, false, 'necro'); })()`); tick(10); }
  R(B, `(() => { const k = OLD_BARROW.live('barrow_king'); if (k) { k.hp = 1; hitMonster(k, 5, 0, false, 'necro'); } })()`); tick(60);
  const q4 = { A: R(A, 'OLD_BARROW.B().q4'), B: R(B, 'OLD_BARROW.B().q4') }, seals = { A: R(A, `countItem('kings_seal')`), B: R(B, `countItem('kings_seal')`) };
  line('6. both knights fight; Ben\'s last blow fells the King, and each is paid his own first kill (the story ends on both games: the helper credit)',
    q4.A === 9 && q4.B === 9 && seals.A >= 1 && seals.B >= 1, { q4, seals });

  // ---- 7. the Hollow fades on the keeper, and Ann's Ghostlight (her presence) pulls it out ----
  put(A, D.circle[0] - 1, D.circle[1] - 3); put(B, D.circle[0] + 6, D.circle[1]); tick(30);
  R(A, `NECRO.N().gl = false`); R(B, `NECRO.N().gl = false`); tick(10);
  R(B, `(() => { const h = OLD_BARROW.spawnBoss(OLD_BARROW.BOSS.hollow); h.state = 'fade'; h.nw.t = 0; })()`); tick(20, () => R(A, `!!monsters.find(m => m.type === 'the_hollow')`));
  const faded = R(B, `OLD_BARROW.live('the_hollow').state`) === 'fade';
  R(A, `(() => { const LAMP = -70, h = monsters.find(m => m.type === 'the_hollow'); for (const k in NECRO.CD) delete NECRO.CD[k]; NECRO.cast('light'); if (h) { player.x = h.x + LAMP; player.y = h.y; } })()`); tick(30);
  const out = R(B, `(() => { const h = OLD_BARROW.live('the_hollow'); return h ? h.state : null; })()`);
  line('7. the Hollow fades on the keeper (Ben) and Ann\'s Ghostlight within 4 tiles, read from her presence, pulls it out',
    faded && out !== 'fade' && out !== null, { faded, out });

  // ---- 8. the wire: no new message type; no errors ----
  const types = games.map(g => [...new Set(R(g, 'window.__sent || []'))].sort());
  const allowed = new Set(['hello', 'p', 'hit', 'boss_call', 'mon', 'kill', 'hurt', 'ping', 'snap', 'chat', 'save', 'ride', 'wk']);
  const extra = types.map(ts => ts.filter(t => !allowed.has(t)));
  line('8. neither game sent a message type of its own: presence, hits, the boss call, the keeper\'s stream and its kills (' + types.map(t => t.join('/')).join(' | ') + ')', extra.every(e => !e.length), { types, extra });
  line('9. no game logged an error in the whole run', games.every(g => !g.__errors.length), { first: games.map(g => g.__errors[0]).filter(Boolean).slice(0, 2) });

  const bad = results.filter(r => !r).length;
  console.log((bad ? `${bad} FAILED of ${results.length}` : `ALL ${results.length} PASS`) + ` (online/src/room.js, ${frames} frames, ${Date.now() - t0} ms)`);
  process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
