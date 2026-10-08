#!/usr/bin/env node
// tools/mmo-sim-ride.js — riding together (docs/ONLINE.md, "Riding together"; src/84-ridetogether.js, online/src/ride.js) with
// four whole games and an old page in one Node process, wired to online/src/room.js (the real Room, which checks every ride).
//
//   node tools/mmo-sim-ride.js
//
// Mudtech drives; Ben, Ann and Cy are his friends; Old is a page from before seats (the game at 49df821, read with git).
// What it proves, in order: standing by Mudtech's bulldozer Ben's USE seat reads HOP ON; E puts Ben in seat 1 and Ann in
// seat 2 and everyone (the driver too) sees them there; Cy is told "Mudtech's bulldozer is full."; the bulldozer drives
// and both ride along on every screen, at the machine's speed, with no movement check counted; a rider cannot steer or
// swing, and can chat; Ben hops off onto a free tile and Cy takes his seat; the machine goes through a gate with its
// riders and a door still stops it; Mudtech climbs out and every rider is set down safely (never in water: Ann's side is
// made water on her screen); the walker has one seat; a wreck sets the rider down; the Barrelbeast's two seats; the
// driver going into a place, and his line dropping, set riders down; a rider whose line drops just goes from the seat;
// the old page shows a rider standing where his presence says, with no error; nobody's pack, coins, quests or machine
// changed, and each rider's own save holds where his own knight is; offline, E by a machine does what it always did.
// Then the review's findings (7 Oct), each of which failed on the first build: beside a friend's machine E keeps a kid's own
// E (his own parked bulldozer, a workbench); a forest that is still in the riders' worlds (the driver plowed it in his):
// hopping off mid-lane and the driver climbing out both set them where they can walk away; a driver whose game moves him
// 5000 px by hand, and one sliding 20 px a frame through a wall, carry nobody (each rider set down at once on his side, the
// world ends the seats); a rider whose line goes silent (socket open) reads "You are not connected, so you hop down."
// Every game runs on the sim's clock. RIDE_PAGE=<a built index.html> puts another build under test.
// Exit 0 only when every line passes.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const scriptOf = html => html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
// RIDE_PAGE: another built page to put under test (a check that each line fails on an older build)
const script = scriptOf(fs.readFileSync(process.env.RIDE_PAGE || path.join(ROOT, 'index.html'), 'utf8'));
// the page from before seats: the game master shipped at 49df821 (git history; skipped, and said so, without git)
const OLD_REV = process.env.RIDE_OLD_REV || '49df821';
let oldScript = null;
try { oldScript = scriptOf(cp.execSync('git show ' + OLD_REV + ':index.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString('utf8')); } catch (e) { oldScript = null; }
const FRAME_MS = 1000 / 60;

// ---------------------------------------------------------------------------
// The wire and a game context: copied from tools/golem-sim.js (which copied them from tools/mmo-sim.js)
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
  // every game's clock is the sim's (60 frames a second), so what a game times by the clock matches what the world saw
  const vc = { now };
  const M = makeContext(wire, script, vc), B = makeContext(wire, script, vc), A = makeContext(wire, script, vc), C = makeContext(wire, script, vc);
  const O = oldScript ? makeContext(wire, oldScript, vc) : null;
  const games = [M, B, A, C].concat(O ? [O] : []);
  const results = [];
  const line = (name, ok, info) => { results.push(!!ok); console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined ? '   ' + JSON.stringify(info) : '')); };
  const R = (g, code) => vm.runInContext(code, g);
  for (const g of games) { g.FANGLANDS.newGame(); R(g, 'title.active = false; window.__peace = true; dialog.cur = null; dialog.queue.length = 0; player.visitedVillage = true;'); }
  let frames = 0;
  const tick = (n, held, each) => {
    for (let i = 0; i < n; i++) {
      for (const g of games) { g.FANGLANDS.step(held && held.get(g) || []); R(g, 'dialog.cur = null; dialog.queue.length = 0;'); }
      vnow += FRAME_MS; frames++;
      room.tick(); wire.flush();
      if (each && each() === true) return i + 1;
    }
    return n;
  };
  const press = (g, code) => { g.FANGLANDS.press(code); wire.flush(); };
  const login = async (g, name) => { const r = await g.NET.post('/api/login', { name, pass: 'secret' }); g.NET.setToken(r.token); g.NET.connect(); wire.flush(); return r; };
  await login(M, 'Mudtech'); await login(B, 'Ben'); await login(A, 'Ann'); await login(C, 'Cy'); if (O) await login(O, 'Old');
  tick(4);

  // the ground: a strip of open grass 18 tiles long and 5 tall (the same in every game: the world is built the same)
  const ground = R(M, `(() => { const W = ATLAS.world, cx = W.tx(60), cy = W.ty(26);
    const plain = t => t === T.GRASS || t === T.DIRT || t === T.SAND;
    for (let r = 0; r < 140; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = cx + dx, y = cy + dy; let ok = inMap(x - 1, y - 3) && inMap(x + 19, y + 3);
      for (let yy = y - 3; yy <= y + 3 && ok; yy++) for (let xx = x - 1; xx <= x + 19 && ok; xx++) if (!plain(tileAt(xx, yy)) || insideBuilding(xx, yy) || ATLAS.onMainRoad(xx, yy)) ok = false;
      if (ok && !inVillageBounds(tc(x), tc(y))) return [x, y];
    } return null; })()`);
  if (!ground) { console.error('no open ground found'); process.exit(1); }
  const [gx, gy] = ground;
  const put = (g, tx, ty, fx = 1, fy = 0) => R(g, `FANGLANDS.tp(${tx}, ${ty}); player.facing = { x: ${fx}, y: ${fy} }; player.hp = player.maxHp;`);
  // a driver carrying riders is never teleported (that is a jump, and his riders get down): he is eased onto a tile's middle
  // a few px a frame, as driving would
  const glide = (g, tx, ty) => { for (let i = 0; i < 200; i++) { const d = R(g, `(() => { const X = tc(${tx}), Y = tc(${ty}), dx = X - player.x, dy = Y - player.y, d = Math.hypot(dx, dy); if (d > 0) { const k = Math.min(1, 3 / d); player.x += dx * k; player.y += dy * k; } return d; })()`); tick(1); if (d < 0.01) break; } };
  const pos = g => R(g, '({ x: player.x, y: player.y })');
  const riding = g => R(g, 'RIDE.state.ride ? { d: RIDE.state.ride.d, s: RIDE.state.ride.s } : null');
  const noticeOf = g => R(g, 'notice ? notice.text : null');
  const useFace = g => R(g, `(() => { const l = hudSeatFace.list.filter(f => f.seat === 'use' && f.when()).sort((a, b) => b.prio - a.prio)[0]; return l ? { id: l.id, ribbon: typeof l.ribbon === 'function' ? l.ribbon() : l.ribbon, disabled: typeof l.disabled === 'function' ? l.disabled() : !!l.disabled, name: typeof l.name === 'function' ? l.name() : l.name } : null; })()`);
  const remoteRide = (g, n) => R(g, `(() => { const e = PLAYERS.remote[${JSON.stringify(n)}]; return e && e.ride ? { d: e.ride.d, s: e.ride.s } : null; })()`);
  const shownOf = (g, n) => R(g, `(() => { const e = PLAYERS.remote[${JSON.stringify(n)}]; return e ? { x: e.shown.x, y: e.shown.y } : null; })()`);
  // where seat s of the machine that `driver` drives sits on game g's screen
  const seatOn = (g, driver, s) => R(g, `(() => { const M = RIDE.machineOf(${JSON.stringify(driver)}); if (!M) return null; const p = RIDE.seatWorld(M, ${s}); return { x: p.x, y: p.y }; })()`);
  // a safe landing: not in a wall, water or a doorway, on this game's own map
  const safeOn = (g, p) => R(g, `(() => { const x = ${p.x}, y = ${p.y}, tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); return inMap(tx, ty) && !collides(x, y, 13, 'beast') && !collides(x, y, 13, 'player') && tileAt(tx, ty) !== T.WATER; })()`);
  const d2 = (a, b) => (a && b ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity);
  // what a knight owns: his pack, his coins, his bank and his quests (a ride must change none of it)
  // (quest.markers.seen is the map's markers he has walked near, 61-markers: travel, his own game's, a ride's as much as a walk's)
  const owns = g => R(g, 'JSON.stringify({ inv: player.inv, bank: player.bank, equip: player.equip, quest: Object.assign({}, quest, { markers: undefined }), coins: coins(), xp: Object.fromEntries(Object.entries(player.skills).map(([k, v]) => [k, v.xp])) })');
  for (const g of [B, A, C]) R(g, `addItem('bread', 3); addItem('coins', 57); quest.bread = 'active';`);
  let owned0 = null;
  const moveCounts = () => { const v = book.view().today; return { speed: v.speed, wall: v.wall }; };

  // ---- 1. Mudtech climbs into his bulldozer (the repaired one, by E); Ben, standing by it, reads HOP ON ----
  R(M, `changeTile(${gx + 3}, ${gy}, T.DOZER); player.dozerUp = {};`);
  put(M, gx + 2, gy); press(M, 'KeyE'); tick(2);
  put(B, gx + 3, gy + 1, 0, -1); put(A, gx + 3, gy - 1, 0, 1); put(C, gx + 4, gy + 1, 0, -1); if (O) put(O, gx + 5, gy + 2);
  tick(90);   // every screen has slid each knight to where he now stands (73-players slides a friend who moved far)
  owned0 = { B: owns(B), A: owns(A), C: owns(C) };   // (after the opening's first word, which moves the story to stage 1 on its own clock)
  const hop = R(B, 'RIDE.hopTarget() && { n: RIDE.hopTarget().n, kind: RIDE.hopTarget().kind, seat: RIDE.hopTarget().seat }');
  const faceB = useFace(B);
  line('1. Mudtech drives his bulldozer (E on the repaired one); Ben beside it reads HOP ON on his USE seat (Hop on Mudtech\'s bulldozer, seat 1 free)',
    R(M, 'player.mech && player.mech.kind') === 'dozer' && hop && hop.n === 'Mudtech' && hop.kind === 'dozer' && hop.seat === 1 && faceB && faceB.id === 'hopon' && faceB.ribbon === 'HOP ON' && faceB.name === 'Hop on Mudtech\'s bulldozer' && !faceB.disabled,
    { mech: R(M, 'player.mech'), hop, faceB });

  // ---- 2. Ben and Ann hop on: seat 1 and seat 2, on every screen ----
  press(B, 'KeyE'); tick(12);
  const benSaid = noticeOf(B);
  press(A, 'KeyE'); tick(12);
  const onM = { Ben: remoteRide(M, 'Ben'), Ann: remoteRide(M, 'Ann') }, onC = { Ben: remoteRide(C, 'Ben'), Ann: remoteRide(C, 'Ann') };
  const mudSaid = noticeOf(M), plaqueM = R(M, `RIDE.ridersOf(NET.me).map(r => r.n + ':' + r.s).join(',')`);
  line('2. Ben and Ann hop on (E): Ben in seat 1, Ann in seat 2, and the driver and Cy see both there; the driver reads who rides with him',
    JSON.stringify(riding(B)) === '{"d":"Mudtech","s":1}' && JSON.stringify(riding(A)) === '{"d":"Mudtech","s":2}' && JSON.stringify(onM) === JSON.stringify({ Ben: { d: 'Mudtech', s: 1 }, Ann: { d: 'Mudtech', s: 2 } }) && JSON.stringify(onC) === JSON.stringify(onM)
      && plaqueM === 'Ben:1,Ann:2' && /^Riding with Mudtech\./.test(benSaid || '') && /hopped on/.test(mudSaid || '') && useFace(B).id === 'hopoff',
    { B: riding(B), A: riding(A), onM, onC, plaqueM, benSaid, mudSaid, faceB: useFace(B) });

  // ---- 3. Cy: the bulldozer is full ----
  const faceC = useFace(C);
  press(C, 'KeyE'); tick(2);
  line('3. Cy is told "Mudtech\'s bulldozer is full." (his HOP ON seat is greyed and names it) and stays standing',
    riding(C) === null && noticeOf(C) === 'Mudtech\'s bulldozer is full.' && faceC && faceC.id === 'hopon' && faceC.disabled && faceC.name === 'Mudtech\'s bulldozer is full.',
    { C: riding(C), said: noticeOf(C), faceC });

  // ---- 4. the bulldozer drives; both ride along on every screen, at its speed, and nothing is counted ----
  const mv0 = moveCounts(), m0 = pos(M), b0 = pos(B), a0 = pos(A);
  tick(90, new Map([[M, ['KeyD']]]));
  tick(20);
  const m1 = pos(M), b1 = pos(B), a1 = pos(A);
  // each rider is drawn exactly in his seat on every screen: on his own (his knight), on the driver's and on Cy's (glued)
  const exact = d2(b1, seatOn(B, 'Mudtech', 1)) < 0.01 && d2(a1, seatOn(A, 'Mudtech', 2)) < 0.01 && d2(shownOf(M, 'Ben'), seatOn(M, 'Mudtech', 1)) < 0.01
    && d2(shownOf(M, 'Ann'), seatOn(M, 'Mudtech', 2)) < 0.01 && d2(shownOf(C, 'Ben'), seatOn(C, 'Mudtech', 1)) < 0.01 && d2(shownOf(C, 'Ann'), seatOn(C, 'Mudtech', 2)) < 0.01;
  // and where a rider says he is (what an old page draws) is close to his seat on the real machine (a presence's lag behind it)
  const lagB = d2(b1, seatOn(M, 'Mudtech', 1)), lagA = d2(a1, seatOn(M, 'Mudtech', 2));
  const drawn = R(M, `(() => { const n0 = RIDE.STATS.drawn; const items = [{ y: player.y + player.r, draw: () => { } }]; for (const n in PLAYERS.remote) items.push({ y: PLAYERS.remote[n].shown.y + 13, who: n, draw: () => { } }); for (const hk of HOOKS.draw) { try { hk(ctx, items, cam); } catch (e) { } } const ben = items.find(i => i.who === 'Ben'), ann = items.find(i => i.who === 'Ann'); ben.draw(); ann.draw(); return { n: RIDE.STATS.drawn - n0, after: ben.y > player.y + player.r && ann.y > player.y + player.r }; })()`);
  const mv1 = moveCounts();
  line('4. Mudtech drives on: Ben and Ann go with the bulldozer, each drawn in his seat on his own screen, on the driver\'s and on Cy\'s (just after the machine in the draw list), and the world counts no speed or wall',
    m1.x - m0.x > 150 && Math.abs((b1.x - b0.x) - (m1.x - m0.x)) < 6 && Math.abs((a1.x - a0.x) - (m1.x - m0.x)) < 6 && exact && lagB < 60 && lagA < 60
      && drawn.n === 2 && drawn.after && mv1.speed === mv0.speed && mv1.wall === mv0.wall,
    { drove: Math.round(m1.x - m0.x), ben: Math.round(b1.x - b0.x), ann: Math.round(a1.x - a0.x), exact, lag: [Math.round(lagB), Math.round(lagA)], drawn, moves: [mv0, mv1] });

  // ---- 5. a rider cannot steer or swing; he can chat ----
  tick(60);
  const s0 = pos(B);
  tick(30, new Map([[B, ['KeyA', 'KeyW']]]));
  const steer = noticeOf(B), s1 = pos(B), seat1 = seatOn(B, 'Mudtech', 1);
  const stayed = d2(s1, seat1) < 0.01 && d2(s0, s1) < 1;
  R(B, 'notice = null; RIDE.state.nagAt = -1e9; player.attackCd = 0;'); press(B, 'Space'); tick(2);
  const swung = R(B, 'player.attackT'), swingSaid = noticeOf(B);
  let heard = null; M.NET.on('chat', m => { if (m.n === 'Ben') heard = m.text; });
  R(B, `CHAT.send('wheee')`); tick(3);
  line('5. Ben cannot steer (he stays in his seat and reads "Mudtech is driving. Press E to hop off.") or swing ("No swinging while you ride along."), and his chat reaches Mudtech',
    stayed && steer === 'Mudtech is driving. Press E to hop off.' && swung === 0 && /^No swinging while you ride along/.test(swingSaid || '') && heard === 'wheee',
    { moved: d2(s0, s1), steer, swung, swingSaid, heard });

  // ---- 6. Ben hops off onto a free tile; Cy takes his seat ----
  press(B, 'KeyE'); tick(12);
  const bOff = pos(B), mNow = pos(M);
  const offSaid = noticeOf(B), mSaid = noticeOf(M);
  put(C, Math.floor(mNow.x / 48), Math.floor(mNow.y / 48) + 1, 0, -1); tick(6);
  press(C, 'KeyE'); tick(12);
  line('6. Ben hops off (E) onto a free tile beside the bulldozer ("You hop off."); the driver reads "Ben hopped off."; the seat is free and Cy takes it',
    riding(B) === null && remoteRide(M, 'Ben') === null && safeOn(B, bOff) && d2(bOff, mNow) > 22 && d2(bOff, mNow) < 120 && offSaid === 'You hop off.' && /Ben hopped off/.test(mSaid || '') && JSON.stringify(riding(C)) === '{"d":"Mudtech","s":1}' && JSON.stringify(remoteRide(A, 'Cy')) === '{"d":"Mudtech","s":1}',
    { bOff, dist: Math.round(d2(bOff, mNow)), offSaid, mSaid, C: riding(C) });

  // ---- 7. a gate: the machine and its riders go through; a door stops it ----
  const at = pos(M), mtx = Math.floor(at.x / 48), mty = Math.floor(at.y / 48);
  for (const g of games) R(g, `changeTile(${mtx + 3}, ${mty - 1}, T.FENCE); changeTile(${mtx + 3}, ${mty}, T.GATE); changeTile(${mtx + 3}, ${mty + 1}, T.FENCE);`);
  glide(M, mtx, mty); tick(10);
  tick(90, new Map([[M, ['KeyD']]])); tick(20);
  const past = pos(M), gateX = (mtx + 3) * 48 + 48;
  const through = past.x > gateX && !!riding(A) && !!riding(C) && pos(A).x > gateX - 30 && pos(C).x > gateX - 30;
  for (const g of games) R(g, `changeTile(${Math.floor(past.x / 48) + 2}, ${Math.floor(past.y / 48)}, T.DOOR); changeTile(${Math.floor(past.x / 48) + 2}, ${Math.floor(past.y / 48) - 1}, T.WALL); changeTile(${Math.floor(past.x / 48) + 2}, ${Math.floor(past.y / 48) + 1}, T.WALL);`);
  const doorX = (Math.floor(past.x / 48) + 2) * 48;
  tick(90, new Map([[M, ['KeyD']]])); tick(20);
  const stopped = pos(M).x < doorX && !!riding(A) && !!riding(C);
  line('7. Mudtech drives through a gate with Ann and Cy aboard (riders pass gates as today), and a door still stops the bulldozer, riders and all',
    through && stopped, { gate: gateX, past: Math.round(past.x), door: doorX, stoppedAt: Math.round(pos(M).x), A: riding(A), C: riding(C) });
  tick(20);

  // ---- 8. Mudtech climbs out: every rider is set down safely; Ann's side of the machine is water on her own screen ----
  { const m = pos(M), tx = Math.floor(m.x / 48), ty = Math.floor(m.y / 48);
    R(A, `for (let y = ${ty - 2}; y <= ${ty + 2}; y++) for (let x = ${tx - 3}; x <= ${tx - 1}; x++) changeTile(x, y, T.WATER);`); }
  tick(4);
  R(M, 'player.facing = { x: 1, y: 0 };'); press(M, 'KeyX'); const xSaid = noticeOf(M); tick(12);
  const aDown = pos(A), cDown = pos(C), mOut = R(M, '({ mech: player.mech, x: player.x, y: player.y })');
  const aSaid = noticeOf(A), cSaid = noticeOf(C);
  const aTile = R(A, `tileAt(${Math.floor(aDown.x / 48)}, ${Math.floor(aDown.y / 48)}) === T.WATER`);
  line('8. Mudtech climbs out (X): Ann and Cy are set down at once on free tiles beside it ("Mudtech got out of the bulldozer. You hop down."), and Ann, whose seat side is water on her screen, lands on dry ground',
    mOut.mech === null && riding(A) === null && riding(C) === null && safeOn(A, aDown) && safeOn(C, cDown) && !aTile && aSaid === 'Mudtech got out of the bulldozer. You hop down.' && cSaid === aSaid,
    { mech: mOut.mech, xSaid, aDown, cDown, aSaid, cSaid, aTile });

  // ---- 9. the walker: one seat; a wreck sets its rider down ----
  { const m = pos(M), tx = Math.floor(m.x / 48), ty = Math.floor(m.y / 48);
    for (const g of games) R(g, `for (let y = ${ty - 3}; y <= ${ty + 3}; y++) for (let x = ${tx - 4}; x <= ${tx + 6}; x++) changeTile(x, y, T.GRASS);`);
    R(M, `changeTile(${tx + 1}, ${ty}, T.MECH);`); put(M, tx, ty); press(M, 'KeyE'); tick(2);
    put(B, tx + 1, ty + 1, 0, -1); put(A, tx + 1, ty - 1, 0, 1); tick(20); }
  press(B, 'KeyE'); tick(12);
  const faceA = useFace(A); press(A, 'KeyE'); tick(4);
  const walkerSeat = riding(B), annFull = noticeOf(A);
  R(M, `player.mech.hp = 1; hurtPlayer(5, player.x + 30, player.y, true);`); tick(12);
  const bWreck = pos(B);
  line('9. the walker has one seat: Ben rides it, Ann reads "Mudtech\'s walker is full."; when it is wrecked under Mudtech, Ben is set down safely ("Mudtech\'s walker broke. You hop down.")',
    R(M, 'player.mech') === null && JSON.stringify(walkerSeat) === '{"d":"Mudtech","s":1}' && faceA && faceA.disabled && annFull === 'Mudtech\'s walker is full.' && riding(A) === null && riding(B) === null && safeOn(B, bWreck) && noticeOf(B) === 'Mudtech\'s walker broke. You hop down.',
    { walkerSeat, faceA, annFull, B: riding(B), bWreck, said: noticeOf(B) });

  // ---- 10. the Barrelbeast: two seats; the driver goes into a place and his riders get down ----
  const beastOn = () => { R(M, 'player.mech = { kind: \'beast\', hp: 300, maxHp: 300 }; player.r = 26; player.speed = 100; player.facing = { x: 1, y: 0 };'); const m = pos(M), tx = Math.floor(m.x / 48), ty = Math.floor(m.y / 48); put(B, tx, ty + 1, 0, -1); put(A, tx + 1, ty - 1, 0, 1); tick(20); press(B, 'KeyE'); press(A, 'KeyE'); tick(12); };
  { const m = pos(M); const o = R(M, `(() => { const s = safeSpot(${m.x}, ${m.y}, 26, 'rider'); return s; })()`); R(M, `player.x = ${o.x}; player.y = ${o.y};`); }
  beastOn();
  const beastSeats = [riding(B), riding(A)], beastDrawn = { B: remoteRide(C, 'Ben'), A: remoteRide(C, 'Ann') };
  const inst = R(M, 'INSTANCES.list()[0]');
  R(M, `(() => { const m = player.mech; player.mech = null; INSTANCES.enter(${JSON.stringify(inst)}); player.mech = m; })()`); tick(12);
  const inSaid = noticeOf(B), bIn = pos(B), aIn = pos(A);
  line('10. the Barrelbeast seats two (Ben 1, Ann 2, seen by Cy); when its driver\'s map changes to a place, both are set down beside where it stood ("Mudtech went inside. You hop down.")',
    JSON.stringify(beastSeats) === '[{"d":"Mudtech","s":1},{"d":"Mudtech","s":2}]' && JSON.stringify(beastDrawn) === '{"B":{"d":"Mudtech","s":1},"A":{"d":"Mudtech","s":2}}' && R(M, 'PLAYERS.mapId()') !== 'over'
      && riding(B) === null && riding(A) === null && inSaid === 'Mudtech went inside. You hop down.' && safeOn(B, bIn) && safeOn(A, aIn),
    { beastSeats, beastDrawn, inst, inSaid, bIn, aIn });
  R(M, `(() => { const m = player.mech; player.mech = null; INSTANCES.leave(); player.mech = m; })()`); tick(12);

  // ---- 11. the driver's line drops: his riders get down ----
  { const m = pos(M); put(B, Math.floor(m.x / 48), Math.floor(m.y / 48) + 1, 0, -1); put(A, Math.floor(m.x / 48) + 1, Math.floor(m.y / 48) - 1, 0, 1); tick(20); press(B, 'KeyE'); press(A, 'KeyE'); tick(12); }
  const before11 = [riding(B), riding(A)];
  M.NET.disconnect(); wire.flush(); tick(12);
  const lSaid = noticeOf(B);
  line('11. Mudtech\'s line drops (or he logs out) while Ben and Ann ride: both are set down safely ("Mudtech left. You hop down.")',
    !!before11[0] && !!before11[1] && riding(B) === null && riding(A) === null && lSaid === 'Mudtech left. You hop down.' && safeOn(B, pos(B)) && safeOn(A, pos(A)),
    { before11, lSaid, B: pos(B), A: pos(A) });
  M.NET.connect(); wire.flush(); tick(20);

  // ---- 12. a rider's line drops: he just goes from the seat; the driver drives on ----
  { const m = pos(M); put(B, Math.floor(m.x / 48), Math.floor(m.y / 48) + 1, 0, -1); put(A, Math.floor(m.x / 48) + 1, Math.floor(m.y / 48) - 1, 0, 1); tick(20); press(B, 'KeyE'); press(A, 'KeyE'); tick(12); }
  const two = R(M, 'RIDE.ridersOf(NET.me).length');
  B.NET.disconnect(); wire.flush(); tick(12);
  const leftM = R(M, 'RIDE.ridersOf(NET.me).map(r => r.n).join(",")'), leftC = R(C, '!PLAYERS.remote.Ben'), stillA = riding(A);
  line('12. Ben\'s line drops while he rides: he goes from the seat on every screen (the driver\'s plaque says Ann alone), the driver keeps driving and Ann rides on',
    two === 2 && leftM === 'Ann' && leftC && JSON.stringify(stillA) === '{"d":"Mudtech","s":2}' && R(M, 'player.mech && player.mech.kind') === 'beast',
    { two, leftM, leftC, stillA });
  B.NET.connect(); wire.flush(); tick(20);

  // ---- 13. the old page: a rider is a knight standing where his presence says, and nothing breaks ----
  if (O) {
    const ann = R(O, `(() => { const e = PLAYERS.remote.Ann; return e ? { x: e.x, y: e.y, ride: !!e.ride } : null; })()`), real = pos(A);
    let threw = null; try { R(O, 'render();'); } catch (e) { threw = String(e && e.message); }
    line('13. a page from before seats (the game at ' + OLD_REV + ') sees Ann as a knight standing where her presence says (on the Barrelbeast), with no error',
      !!ann && d2(ann, real) < 2 && threw === null && O.__errors.length === 0, { ann, real, threw, errors: O.__errors.slice(0, 3) });
  } else line('13. the old page (git show ' + OLD_REV + ':index.html) could not be read here: skipped', true);
  R(A, 'RIDE.setDown("self", true);'); tick(12);
  R(M, 'player.mech = null; player.r = 13; player.speed = 175;'); tick(12);

  // ---- 14. nobody's pack, coins or quests changed; each rider's save holds where his own knight is ----
  for (const g of [B, A, C]) R(g, 'save();');
  const saved = g => R(g, '(() => { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); return { x: d.player.x, y: d.player.y }; })()');
  const sameOwn = owns(B) === owned0.B && owns(A) === owned0.A && owns(C) === owned0.C;
  const machines = g => R(g, '(() => { let n = 0; for (let i = 0; i < map.length; i++) if (map[i] === T.DOZER || map[i] === T.MECH || map[i] === T.WRECK) n++; return n + (player.mech ? 1 : 0); })()');
  const kept = { M: machines(M), B: machines(B), A: machines(A), C: machines(C) };
  if (!sameOwn) for (const [k, g] of [['B', B], ['A', A], ['C', C]]) { const a = JSON.parse(owned0[k]), b = JSON.parse(owns(g)); for (const f in a) { if (JSON.stringify(a[f]) === JSON.stringify(b[f])) continue; if (a[f] && typeof a[f] === 'object') { for (const q in Object.assign({}, a[f], b[f])) if (JSON.stringify(a[f][q]) !== JSON.stringify(b[f][q])) console.log('      changed', k, f + '.' + q, JSON.stringify(a[f][q]), '->', JSON.stringify(b[f][q])); } else console.log('      changed', k, f, a[f], '->', b[f]); } }
  line('14. a ride changes nothing a kid owns: Ben\'s, Ann\'s and Cy\'s packs, coins, bank, gear, skills and quests are as they were, Mudtech\'s machines are his, and each one\'s save holds where his own knight stands',
    sameOwn && kept.M >= 1 && kept.B === 0 && kept.A === 0 && kept.C === 0 && d2(saved(B), pos(B)) < 1 && d2(saved(A), pos(A)) < 1 && d2(saved(C), pos(C)) < 1, { sameOwn, kept, B: [saved(B), pos(B)], A: [saved(A), pos(A)] });

  // ---- 15. offline: E by a machine is the game it always was ----
  { const off = makeContext(wire, script, { offline: true });
    off.FANGLANDS.newGame(); R(off, 'title.active = false; window.__peace = true; dialog.cur = null; dialog.queue.length = 0;');
    R(off, `changeTile(${gx + 3}, ${gy}, T.DOZER); FANGLANDS.tp(${gx + 2}, ${gy}); player.facing = { x: 1, y: 0 };`);
    off.NET.emit('p', { t: 'p', n: 'Mudtech', role: 'player', map: 'over', x: (gx + 2) * 48 + 24, y: (gy + 1) * 48 + 24, fx: 1, fy: 0, mech: { kind: 'dozer', hp: 110, maxHp: 110 }, dead: false, lv: 5 });
    const tgt = R(off, 'RIDE.hopTarget()');
    off.FANGLANDS.press('KeyE');
    line('15. offline nothing is offered and E by a parked bulldozer climbs in, as it always did', tgt === null && R(off, 'player.mech && player.mech.kind') === 'dozer' && R(off, 'RIDE.state.ride') === null, { tgt, mech: R(off, 'player.mech') }); }

  const errs = [M, B, A, C].map(g => g.__errors.filter(e => !/NET \*/.test(e)).length);
  // ======== the review's findings (7 Oct): each line below failed on the first build of this feature ========
  // fresh ground in every game: open grass 34 tiles long and 9 tall; Mudtech back in a bulldozer at its west end
  const ends = { B: [], A: [], C: [] }, rideEnds = g => ends[g === B ? 'B' : g === A ? 'A' : 'C'];
  for (const [k, g] of [['B', B], ['A', A], ['C', C]]) g.NET.on('ride_end', m => ends[k].push(m.why));
  const lay = () => { for (const g of [M, B, A, C]) R(g, `for (let y = ${gy - 4}; y <= ${gy + 4}; y++) for (let x = ${gx - 1}; x <= ${gx + 33}; x++) setTile(x, y, T.GRASS);`); };
  const drive = () => { R(M, 'if (player.mech) { player.mech = null; player.r = 13; player.speed = 175; }'); put(M, gx + 2, gy); R(M, `setTile(${gx + 3}, ${gy}, T.DOZER); player.dozerUp = {};`); press(M, 'KeyE'); tick(2); };
  const board = (g, dy) => { const m = pos(M), tx = Math.floor(m.x / 48), ty = Math.floor(m.y / 48); R(g, 'if (RIDE.state.ride) RIDE.setDown("self", true); player.mech = null; player.r = 13; player.speed = 175;'); put(g, tx, ty + dy, 0, -dy); tick(30); press(g, 'KeyE'); tick(12); return riding(g); };
  // can he walk away: the tiles a knight on foot reaches from where he stands (straight steps, his own world), up to 400
  const reachOf = g => R(g, `(() => { const tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE); if (solidFor(tileAt(tx, ty), 'player')) return 0; const seen = new Set([idx(tx, ty)]), q = [[tx, ty]]; while (q.length && seen.size < 400) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const i = idx(nx, ny); if (seen.has(i) || solidFor(map[i], 'player')) continue; seen.add(i); q.push([nx, ny]); } } return seen.size; })()`);
  const inSolid = g => R(g, 'collides(player.x, player.y, 13, "player")');
  const walkAway = g => { const p0 = pos(g); tick(60, new Map([[g, ['KeyA']]])); return d2(p0, pos(g)); };

  // ---- 16. E by a friend's machine keeps the knight's own E: his own parked bulldozer, a workbench ----
  lay(); drive();
  { const m = pos(M), tx = Math.floor(m.x / 48), ty = Math.floor(m.y / 48);
    R(C, 'if (RIDE.state.ride) RIDE.setDown("self", true); player.mech = null; player.r = 13; player.speed = 175;');
    // Cy one tile below the bulldozer facing east, at his own parked bulldozer (in his world only)
    R(C, `setTile(${tx + 1}, ${ty + 1}, T.DOZER);`); put(C, tx, ty + 1, 1, 0); tick(90);
    // (the friend's machine is in hop reach: the old build offered HOP ON here and E put him on it)
    const inReach = R(C, '!!RIDE.hopTarget()'), offered = R(C, '(hudSeatFace.list.filter(f => f.seat === "use" && f.when()).sort((a, b) => b.prio - a.prio)[0] || {}).id');
    press(C, 'KeyE'); tick(4);
    const own = R(C, 'player.mech && player.mech.kind'), cRide = riding(C);
    R(C, 'player.mech = null; player.r = 13; player.speed = 175;'); R(C, `setTile(${tx + 1}, ${ty + 1}, T.WORKBENCH);`); put(C, tx, ty + 1, 1, 0); tick(30);
    const inReach2 = R(C, '!!RIDE.hopTarget()');
    press(C, 'KeyE'); tick(2);
    const bench = R(C, 'panel'), cRide2 = riding(C); R(C, `closePanel(); setTile(${tx + 1}, ${ty + 1}, T.GRASS);`);
    line('16. Cy beside Mudtech\'s bulldozer, facing his own parked bulldozer: his USE seat is his own and E climbs into his own (no hop); facing a workbench E opens it',
      inReach && inReach2 && offered !== 'hopon' && own === 'dozer' && cRide === null && bench === 'station' && cRide2 === null, { inReach, inReach2, offered, own, cRide, bench, cRide2 }); }

  // ---- 17. the forest the driver plowed is still in the riders' worlds: they get down where they can walk away ----
  { lay(); drive(); const m0 = pos(M), tx0 = Math.floor(m0.x / 48), ty0 = Math.floor(m0.y / 48);
    for (const g of [B, A]) R(g, `for (let y = ${ty0 - 4}; y <= ${ty0 + 4}; y++) for (let x = ${tx0 + 4}; x <= ${tx0 + 30}; x++) setTile(x, y, T.TREE);`);
    board(B, 1); board(A, -1);
    const on = [riding(B), riding(A)];
    tick(300, new Map([[M, ['KeyD']]]), () => pos(M).x > (tx0 + 10) * 48 + 24);
    // a gap of one tile among the riders' trees on each side of the machine (as the review found)
    { const m = pos(M), tx = Math.floor(m.x / 48), ty = Math.floor(m.y / 48); for (const g of [B, A]) R(g, `setTile(${tx}, ${ty + 1}, T.GRASS); setTile(${tx}, ${ty - 1}, T.GRASS);`); }
    // Ann hops off mid-lane (E); then Mudtech climbs out (X) with Ben aboard
    press(A, 'KeyE'); tick(6);
    const a = { ride: riding(A), reach: reachOf(A), solid: inSolid(A), said: noticeOf(A) };
    tick(30, new Map([[M, ['KeyD']]]));
    R(M, 'player.facing = { x: 1, y: 0 };'); press(M, 'KeyX'); tick(12);
    const b = { ride: riding(B), reach: reachOf(B), solid: inSolid(B), said: noticeOf(B) };
    const wa = walkAway(A), wb = walkAway(B);
    line('17. Mudtech plows 7 tiles into a forest that is still in Ben\'s and Ann\'s worlds: Ann hops off mid-lane and Ben gets down when Mudtech climbs out; each stands on open ground he can walk away from (never a one-tile gap among his trees)',
      !!on[0] && !!on[1] && a.ride === null && b.ride === null && !a.solid && !b.solid && a.reach >= 100 && b.reach >= 100 && wa > 40 && wb > 40 && b.said === 'Mudtech got out of the bulldozer. You hop down.',
      { on, a, b, walked: [Math.round(wa), Math.round(wb)] }); }

  // ---- 18. a driver who cheats (player.x by hand, as a devtools console would) carries nobody ----
  { lay(); drive(); board(B, 1); board(A, -1); tick(10);
    const on = [riding(B), riding(A)], b0 = pos(B), a0 = pos(A); ends.B.length = 0; ends.A.length = 0;
    R(M, 'player.x += 5000;'); tick(8);
    const b = { ride: riding(B), moved: Math.round(d2(b0, pos(B))), said: noticeOf(B), world: ends.B.slice() }, a = { ride: riding(A), moved: Math.round(d2(a0, pos(A))), world: ends.A.slice() };
    line('18. Mudtech\'s game moves him 5000 px by hand with Ben and Ann aboard: both are set down at once where they were ("Mudtech\'s bulldozer went too fast for you. You hop down."), and the world ends their seats (jump)',
      !!on[0] && !!on[1] && b.ride === null && a.ride === null && b.moved < 3 * 48 && a.moved < 3 * 48 && b.said === 'Mudtech\'s bulldozer went too fast for you. You hop down.' && R(B, `!collides(player.x, player.y, 13, 'player')`) && b.world.includes('jump') && a.world.includes('jump'), { on, b, a });
    R(M, 'player.x -= 5000;'); tick(10); }

  // ---- 19. the same cheat in small steps (20 px a frame, 1200 px/s) through a wall: the rider is never carried through ----
  { lay(); drive(); const m0 = pos(M), wx = Math.floor(m0.x / 48) + 5;
    for (const g of [M, B, A, C]) R(g, `for (let y = ${gy - 4}; y <= ${gy + 4}; y++) setTile(${wx}, y, T.WALL);`);
    board(B, 1); tick(10); ends.B.length = 0;
    const on = riding(B); let inside = 0, pastWall = 0;
    for (let i = 0; i < 90; i++) { R(M, 'player.x += 20;'); tick(1); if (inSolid(B)) inside++; if (pos(B).x > wx * 48) pastWall++; }
    const b = { ride: riding(B), x: Math.round(pos(B).x), wall: wx * 48, said: noticeOf(B), world: ends.B.slice(), inside, pastWall };
    line('19. Mudtech\'s game slides him 20 px a frame (1200 px/s) through a wall with Ben aboard: Ben is set down on his side of the wall, never inside it, and the world ends his seat (jump)',
      !!on && b.ride === null && inside === 0 && pastWall === 0 && b.x < wx * 48 && !inSolid(B) && b.world.includes('jump'), b);
    R(M, `player.x = ${m0.x}; player.y = ${m0.y};`); for (const g of [M, B, A, C]) R(g, `for (let y = ${gy - 4}; y <= ${gy + 4}; y++) setTile(${wx}, y, T.GRASS);`); tick(10); }

  // ---- 20. a rider's own line goes quiet (his wifi drops, the socket stays open): he reads that he is not connected ----
  { lay(); drive(); board(B, 1); tick(10);
    const on = riding(B), sock = B.NET.sock; let said = [];
    wire.mute.add(sock);
    let n = 0; tick(6 * 60, new Map([[M, ['KeyD']]]), () => { n++; const t = noticeOf(B); if (t && !said.includes(t)) said.push(t); return riding(B) === null; });
    const at = n / 60, status = B.NET.status;
    wire.mute.delete(sock); tick(30);
    line('20. Ben\'s line goes quiet while he rides (no word either way, his socket still open): within 3.5 s he reads "You are not connected, so you hop down." (never "Mudtech left.")',
      !!on && riding(B) === null && at <= 3.5 && said.includes('You are not connected, so you hop down.') && !said.some(t => /left/.test(t)), { on, at, said, status }); }

  line('21. no game logged an error in the whole run', errs.every(n => n === 0), { errs, first: [M, B, A, C].map(g => g.__errors[0]).filter(Boolean).slice(0, 2) });

  const bad = results.filter(r => !r).length;
  console.log((bad ? `${bad} FAILED of ${results.length}` : `ALL ${results.length} PASS`) + ` (online/src/room.js, ${frames} frames, ${Date.now() - t0} ms)`);
  process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
