// Two addresses (docs/ONLINE.md, "Two addresses"): the front door on every address, the hand-over offer and claim in
// the World on node's SQLite, and the two page scripts run for real in a VM. Every rule the hand-over keeps has a test
// here (the merge's own rules are in handoff-merge.test.mjs): one use (also with two claims at once), a short life,
// only hashes stored and the keys sealed, a claim only with the pull the offer was bound to, only the game's own
// addresses, two budgets (a login the world knows can never be held up by anonymous offers; anonymous ones are capped
// per address, an IPv6 address by its /48, and all together), a home-screen icon that stays, any old path landing on
// the same path, www.gorkscape.ca offering its own storage, and a card on every hop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/worker.js';
import vm from 'node:vm';
import {
  frontDoor, MOVES, HANDOFF_MS, HANDOFF_MAX, HANDOFF_KEYS_MAX, OFFERS_PER_MIN, CLAIM_FAILS_PER_MIN, REFUSED_PER_MIN, ADDRESS_BYTES_MAX,
  ANON_ROWS_MAX, ACCT_ROWS_MAX, ACCT_PER_MIN, PULL_KEY, PULL_MS, ARRIVING_KEY, STAY_COOKIE, addressOf,
} from '../src/handoff.js';

// ---------------------------------------------------------------------------
// The front door (worker.js + handoff.js frontDoor)
// ---------------------------------------------------------------------------
function fakeEnv() {
  const seen = { assets: [], world: [] };
  const env = {
    ASSETS: { fetch: req => { seen.assets.push(req.url); return new Response('asset ' + new URL(req.url).pathname); } },
    WORLD: { idFromName: n => n, get: () => ({ fetch: req => { seen.world.push(req.url); const r = new Response(JSON.stringify({ world: new URL(req.url).pathname }), { headers: { 'content-type': 'application/json' } }); r.marker = 'world'; return r; } }) },
  };
  return { env, seen };
}
const nav = (url, extra) => new Request(url, { headers: Object.assign({ 'sec-fetch-dest': 'document', accept: 'text/html,application/xhtml+xml' }, extra || {}) });

test('front door: a page on each old address is the hand-over page, aimed at the matching new address, offering as itself', async () => {
  const { env, seen } = fakeEnv();
  for (const [from, to] of Object.entries(MOVES)) {
    const res = await worker.fetch(nav('https://' + from + '/admin?x=1'), env);
    assert.equal(res.status, 200, from);
    const html = await res.text();
    assert.ok(html.includes('var HOME = "https://' + to + '", SELF = "' + from + '";'), from);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
    const csp = res.headers.get('content-security-policy');
    const nonce = /'nonce-([0-9a-f]{32})'/.exec(csp)[1];
    assert.ok(html.includes('<script nonce="' + nonce + '">'), 'the one script carries the nonce');
    assert.match(csp, /default-src 'none'/); assert.match(csp, /connect-src 'self'/); assert.match(csp, /frame-ancestors 'none'/);
    assert.match(html, /<p id="msg">Bringing your knight over\.\.\.<\/p>/);
  }
  assert.equal(seen.assets.length, 0, 'no game file is served on an old address');
  // an older browser with no Sec-Fetch headers: a page is what accepts HTML, or the game's own paths
  let res = await worker.fetch(new Request('https://gorkscape.ca/', { headers: { accept: 'text/html' } }), env);
  assert.equal(res.status, 200); assert.match(await res.text(), /handoff\/offer/);
  res = await worker.fetch(new Request('https://gorkscape.ca/'), env);
  assert.equal(res.status, 200);
  const n1 = (await worker.fetch(nav('https://gorkscape.ca/'), env)).headers.get('content-security-policy');
  const n2 = (await worker.fetch(nav('https://gorkscape.ca/'), env)).headers.get('content-security-policy');
  assert.notEqual(n1, n2, 'two hand-over pages never share a nonce');
  res = await worker.fetch(new Request('https://gorkscape.ca/', { method: 'HEAD', headers: { 'sec-fetch-dest': 'document' } }), env);
  assert.equal(res.status, 200); assert.equal(await res.text(), '');
});

test('front door: a file on an old address is sent on with a 302 (a frame or a script is a file even when it accepts HTML); www.fanglands.com 301s to the bare address', async () => {
  const { env, seen } = fakeEnv();
  let res = await worker.fetch(new Request('https://gorkscape.ca/favicon.ico', { headers: { 'sec-fetch-dest': 'image' } }), env);
  assert.equal(res.status, 302); assert.equal(res.headers.get('location'), 'https://fanglands.com/favicon.ico');
  for (const dest of ['iframe', 'frame', 'script', 'empty']) {
    res = await worker.fetch(new Request('https://test.gorkscape.ca/bridge.html?a=b', { headers: { 'sec-fetch-dest': dest, accept: 'text/html,*/*' } }), env);
    assert.equal(res.status, 302, dest); assert.equal(res.headers.get('location'), 'https://test.fanglands.com/bridge.html?a=b');
  }
  res = await worker.fetch(new Request('https://gorkscape.ca/', { method: 'POST', body: 'x' }), env);
  assert.equal(res.status, 302);
  res = await worker.fetch(nav('https://www.fanglands.com/admin?tab=chat'), env);
  assert.equal(res.status, 301); assert.equal(res.headers.get('location'), 'https://fanglands.com/admin?tab=chat');
  assert.equal(seen.assets.length, 0);
  for (const u of ['https://fanglands.com/', 'https://fanglands.com/admin', 'https://test.fanglands.com/?online', 'http://localhost:8790/']) {
    res = await worker.fetch(nav(u), env);
    assert.equal(await res.text(), 'asset ' + new URL(u).pathname);
  }
  assert.equal(seen.assets.length, 4);
  assert.equal(frontDoor(nav('https://fanglands.com/'), new URL('https://fanglands.com/')), null);
});

test('front door: HANDOVER off keeps the old addresses serving the game as before (the first ship); www still goes to the bare address', async () => {
  const { env, seen } = fakeEnv(); env.HANDOVER = 'off';
  for (const host of Object.keys(MOVES)) {
    const res = await worker.fetch(nav('https://' + host + '/?online'), env);
    assert.equal(await res.text(), 'asset /', host);
  }
  assert.equal(seen.assets.length, 3);
  assert.equal((await worker.fetch(nav('https://www.fanglands.com/'), env)).status, 301);
  // the home-screen paths still answer, so a game that clears the cookie never loops
  const leave = await worker.fetch(nav('https://gorkscape.ca/handoff-leave?to=%2F%3Fonline'), env);
  assert.deepEqual([leave.status, leave.headers.get('location')], [302, '/?online']);
  env.HANDOVER = 'on';
  assert.equal((await worker.fetch(nav('https://gorkscape.ca/'), env)).headers.get('cache-control'), 'no-store');
});

test('front door: a home-screen icon stays: /handoff-stay sets the cookie for a year, and with it the old address serves the game on every path, as today', async () => {
  const { env, seen } = fakeEnv();
  const res = await worker.fetch(nav('https://gorkscape.ca/handoff-stay?to=' + encodeURIComponent('/admin?x=1')), env);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/admin?x=1');
  const c = res.headers.get('set-cookie');
  assert.match(c, new RegExp('^' + STAY_COOKIE + '=1; Max-Age=\\d+; Path=/; Secure; SameSite=Lax$'));
  assert.ok(+/Max-Age=(\d+)/.exec(c)[1] >= 365 * 86400);
  assert.ok(!/HttpOnly/i.test(c), 'the game reads it, so it can clear it in an ordinary tab');
  // with the cookie: the game and every file, straight from the old address
  for (const u of ['https://gorkscape.ca/', 'https://www.gorkscape.ca/?online', 'https://gorkscape.ca/admin', 'https://test.gorkscape.ca/favicon.ico']) {
    const r = await worker.fetch(nav(u, { cookie: 'a=b; ' + STAY_COOKIE + '=1' }), env);
    assert.equal(await r.text(), 'asset ' + new URL(u).pathname, u);
  }
  assert.equal(seen.assets.length, 4);
  // any other value of the cookie, or none: the hand-over page
  for (const cookie of [STAY_COOKIE + '=0', 'x' + STAY_COOKIE + '=1', '']) {
    const r = await worker.fetch(nav('https://gorkscape.ca/', { cookie }), env);
    assert.match(await r.text(), /handoff\/offer/, cookie);
  }
  // /handoff-leave clears it; both only ever send to a plain path on the same address
  const leave = await worker.fetch(nav('https://gorkscape.ca/handoff-leave?to=%2F'), env);
  assert.match(leave.headers.get('set-cookie'), new RegExp('^' + STAY_COOKIE + '=; Max-Age=0; Path=/'));
  for (const to of ['//evil.example/x', 'https://evil.example', '/\\evil.example', 'admin', '/a b']) {
    const r = await worker.fetch(nav('https://gorkscape.ca/handoff-stay?to=' + encodeURIComponent(to)), env);
    assert.equal(r.headers.get('location'), '/', to);
  }
  // the new address has no such paths: they are the game's files there
  assert.equal(await (await worker.fetch(nav('https://fanglands.com/handoff-stay'), env)).text(), 'asset /handoff-stay');
});

test('front door: /api and /ws reach the world on every address, old ones too, exactly as before', async () => {
  const { env, seen } = fakeEnv();
  for (const host of ['gorkscape.ca', 'www.gorkscape.ca', 'test.gorkscape.ca', 'fanglands.com', 'www.fanglands.com', 'test.fanglands.com']) {
    const r = await worker.fetch(nav('https://' + host + '/api/status'), env);
    assert.deepEqual(await r.json(), { world: '/api/status' }, host);
    const ws = await worker.fetch(new Request('https://' + host + '/ws?token=abc', { headers: { upgrade: 'websocket' } }), env);
    assert.equal(ws.marker, 'world', 'the socket answer goes back untouched on ' + host);
    const post = await worker.fetch(new Request('https://' + host + '/api/handoff/claim', { method: 'POST', body: '{}' }), env);
    assert.deepEqual(await post.json(), { world: '/api/handoff/claim' });
  }
  assert.equal(seen.world.length, 18);
  assert.equal(seen.assets.length, 0);
});

// ---------------------------------------------------------------------------
// The World's side on node's SQLite
// ---------------------------------------------------------------------------
function sqlOf(db) {
  return {
    exec(q, ...args) {
      const stmt = db.prepare(q);
      const columnNames = stmt.columns().map(c => c.name);
      let rows = [], rowsWritten = 0;
      if (columnNames.length) rows = stmt.all(...args).map(r => Object.assign({}, r));
      else rowsWritten = stmt.run(...args).changes;
      return { toArray: () => rows.slice(), one: () => rows[0], rowsWritten, columnNames, [Symbol.iterator]: () => rows[Symbol.iterator]() };
    },
  };
}
globalThis.WebSocketRequestResponsePair = globalThis.WebSocketRequestResponsePair || class { constructor(a, b) { this.a = a; this.b = b; } };
const { World } = await import('../src/world.js');
let T = 1759500000000;
class TestWorld extends World { now() { return T; } }
const ENV = { ADMIN_KEY: 'test-admin', INVITE_CODE: 'TEST-1234' };
function newWorld() {
  const db = new DatabaseSync(':memory:');
  const ctx = { storage: { sql: sqlOf(db), setAlarm: async () => { } }, setWebSocketAutoResponse() { }, acceptWebSocket() { }, getWebSockets: () => [] };
  const w = new TestWorld(ctx, ENV); w.db = db;
  return w;
}
// a knight the world knows, with a live login; returns the token
function account(w, name, { expires = T + 86400000, banned = 0 } = {}) {
  const lc = name.toLowerCase(), token = Buffer.from(lc.padEnd(32, '.')).toString('hex').slice(0, 64);
  w.db.prepare('INSERT OR IGNORE INTO accounts (name_lc, name, salt, hash, created, last_seen, banned) VALUES (?, ?, ?, ?, ?, ?, ?)').run(lc, name, 's', 'h', T, T, banned);
  w.db.prepare('INSERT INTO sessions (token, name_lc, expires) VALUES (?, ?, ?)').run(token, lc, expires);
  return token;
}
async function post(w, url, body, { origin, ip = '203.0.113.7', raw } = {}) {
  const u = new URL(url);
  const headers = { 'content-type': 'application/json', 'cf-connecting-ip': ip };
  if (origin !== null) headers.origin = origin || ('https://' + u.hostname);
  const res = await w.fetch(new Request(url, { method: 'POST', headers, body: raw !== undefined ? raw : JSON.stringify(body) }));
  let data = null; try { data = await res.json(); } catch (e) { }
  return { status: res.status, data };
}
const PULL = '0123456789abcdef0123456789abcdef';   // the pull this browser's addresses keep
const offer = (w, keys, opts, host = 'gorkscape.ca') => post(w, 'https://' + host + '/api/handoff/offer', { keys, pull: (opts && opts.pull) || PULL }, opts);
const claim = (w, code, opts, host = 'fanglands.com') => post(w, 'https://' + host + '/api/handoff/claim', { code, pull: (opts && opts.pull) || PULL }, opts);
const rowsOf = w => w.db.prepare('SELECT * FROM handoffs').all();
const KEYS = {
  'fanglands.session': 'a'.repeat(64), 'fanglands.lastname': 'Cohen', 'fanglands.slot.2': '{"player":{"kills":3}}', 'fanglands.slot.2.at': '1759400000000',
  'fanglands.settings': '{"sound":true}', 'fl_learn_bag': '2', 'fl_coach_swing': '1', 'fanglands.save.v2': '{"old":true}',
};

test('hand-over: an offer from the old address gets a 256-bit code; the claim on the new address gets exactly the keys, once, and which old address offered them', async () => {
  const w = newWorld();
  const o = await offer(w, KEYS, {}, 'www.gorkscape.ca');
  assert.equal(o.status, 200, JSON.stringify(o.data));
  assert.match(o.data.code, /^[0-9a-f]{64}$/);
  assert.equal(o.data.expires, T + HANDOFF_MS);
  assert.equal(o.data.kind, 'device', 'a token the world does not know is no login');
  const rows = rowsOf(w);
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].id, o.data.code); assert.match(rows[0].id, /^[0-9a-f]{64}$/);
  const c = await claim(w, o.data.code);
  assert.equal(c.status, 200);
  assert.deepEqual(c.data.keys, KEYS);
  assert.equal(c.data.from, 'www.gorkscape.ca');
  assert.equal(rowsOf(w).length, 0, 'nothing is kept after a claim');
  const again = await claim(w, o.data.code);
  assert.deepEqual([again.status, again.data.code], [404, 'gone']);
  const a = await offer(w, KEYS), b = await offer(w, KEYS);
  assert.notEqual(a.data.code, b.data.code);
});

test('hand-over: what waits is unreadable at rest: the keys are sealed with the code (never stored), only hashes of the code and pull are kept, and the address is a salted hash', async () => {
  const w = newWorld();
  const tok = account(w, 'Cohen');
  const keys = Object.assign({}, KEYS, { 'fanglands.session': tok });
  const o = await offer(w, keys, { ip: '198.51.100.23' });
  const anon = await offer(w, KEYS, { ip: '198.51.100.23' });
  const all = rowsOf(w);
  const dump = JSON.stringify(all, (k, v) => (v instanceof Uint8Array ? Buffer.from(v).toString('latin1') : v));
  for (const secret of [tok, 'Cohen', '"kills":3', '{"sound":true}', o.data.code, anon.data.code, PULL, '198.51.100.23']) assert.ok(!dump.includes(secret), 'not at rest: ' + secret.slice(0, 12));
  assert.ok(all.every(r => r.keys instanceof Uint8Array), 'sealed bytes, not text');
  const crypto = await import('node:crypto');
  const plainWho = crypto.createHash('sha256').update('who:198.51.100.23').digest('hex'), bareWho = crypto.createHash('sha256').update('198.51.100.23').digest('hex');
  assert.ok(all.every(r => r.who !== plainWho && r.who !== bareWho), 'the address hash is salted (the salt lives only in memory)');
  assert.equal(all.find(r => r.acct).who, null, 'a login offer does not keep the address at all');
  assert.deepEqual((await claim(w, o.data.code)).data.keys, keys);
  // a row from before the keys were sealed (plain text) is gone, never served
  w.db.prepare('UPDATE handoffs SET keys = ? WHERE id = ?').run(JSON.stringify(KEYS), rowsOf(w)[0].id);
  assert.equal((await claim(w, anon.data.code)).status, 404);
});

test('hand-over: a code that ran out is refused by the claim itself (before any sweep) and its row deleted; a made-up or broken code gets the same answer', async () => {
  const w = newWorld();
  const o = await offer(w, KEYS);
  T += HANDOFF_MS;
  assert.equal(rowsOf(w).length, 1, 'no sweep has run since the offer');
  const c = await claim(w, o.data.code);
  assert.deepEqual([c.status, c.data.code], [404, 'gone']);
  assert.equal(rowsOf(w).length, 0);
  for (const code of ['f'.repeat(64), 'xyz', '', 'F'.repeat(64), 'a'.repeat(65)]) {
    const r = await claim(w, code, { ip: '192.0.2.' + code.length });
    assert.deepEqual([r.status, r.data.code], [404, 'gone'], code);
  }
  const o2 = await offer(w, KEYS); T += HANDOFF_MS - 1;
  assert.equal((await claim(w, o2.data.code)).status, 200, 'one that has not run out still works right up to the end');
});

test('hand-over: codes that ran out are swept from storage by the next call to the world, even with no claim', async () => {
  const w = newWorld();
  await offer(w, KEYS); await offer(w, KEYS);
  assert.equal(rowsOf(w).length, 2);
  T += HANDOFF_MS + 61000;
  const r = await w.fetch(new Request('https://fanglands.com/api/status'));
  assert.equal(r.status, 200);
  assert.equal(rowsOf(w).length, 0);
});

test('hand-over: one use even with two claims at once: exactly one gets the keys', async () => {
  const w = newWorld();
  for (let i = 0; i < 5; i++) {
    const o = await offer(w, KEYS, { ip: '10.1.0.' + i });
    const both = await Promise.all([claim(w, o.data.code), claim(w, o.data.code), claim(w, o.data.code)]);
    assert.deepEqual(both.map(r => r.status).sort(), [200, 404, 404]);
  }
});

test('hand-over: only the game\'s own addresses: offers from an old one, claims on a new one, each with its own Origin; refusals are counted', async () => {
  const w = newWorld();
  for (const host of ['gorkscape.ca', 'www.gorkscape.ca', 'test.gorkscape.ca']) assert.equal((await offer(w, KEYS, {}, host)).status, 200, host);
  let i = 0;
  for (const [host, origin] of [['fanglands.com', undefined], ['www.fanglands.com', undefined], ['gorkscape.ca', 'https://evil.example'], ['gorkscape.ca', null],
    ['gorkscape.ca', 'https://www.gorkscape.ca'], ['gorkscape.ca', 'http://gorkscape.ca'], ['gorkscape.ca', 'https://fanglands.com'], ['localhost', undefined], ['gorkscape.ca.evil.example', undefined]]) {
    const r = await offer(w, KEYS, { origin, ip: '10.2.0.' + (++i) }, host);
    assert.deepEqual([r.status, r.data.code], [403, 'origin'], host + ' ' + origin);
  }
  const codes = [];
  for (let k = 0; k < 10; k++) codes.push((await offer(w, KEYS, { ip: '10.3.0.' + k })).data.code);
  for (const [host, origin] of [['gorkscape.ca', undefined], ['test.gorkscape.ca', undefined], ['fanglands.com', 'https://gorkscape.ca'], ['fanglands.com', null], ['fanglands.com', 'https://evil.example'], ['fanglands.com', 'https://test.fanglands.com']]) {
    const r = await claim(w, codes.pop(), { origin, ip: '10.4.0.' + (++i) }, host);
    assert.deepEqual([r.status, r.data.code], [403, 'origin'], host + ' ' + origin);
  }
  const kept = codes.pop();
  assert.equal((await claim(w, kept, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await claim(w, kept)).status, 200, 'a refused claim did not use the code up');
  for (const host of ['fanglands.com', 'www.fanglands.com', 'test.fanglands.com']) assert.equal((await claim(w, codes.pop(), {}, host)).status, 200, host);
  // refusals count: one address sending from elsewhere is told to wait after REFUSED_PER_MIN
  for (let k = 0; k < REFUSED_PER_MIN; k++) assert.equal((await offer(w, KEYS, { origin: 'https://evil.example', ip: '10.9.9.9' })).status, 403);
  assert.equal((await offer(w, KEYS, { origin: 'https://evil.example', ip: '10.9.9.9' })).status, 429);
  const g = await w.fetch(new Request('https://gorkscape.ca/api/handoff/offer', { headers: { origin: 'https://gorkscape.ca' } }));
  assert.equal(g.status, 405);
  const n = await w.fetch(new Request('https://gorkscape.ca/api/handoff/other', { method: 'POST', headers: { origin: 'https://gorkscape.ca' } }));
  assert.equal(n.status, 404);
});

test('hand-over: only the game\'s keys (never the parent page\'s), only strings, a hard cap on size and on the number of keys', async () => {
  const w = newWorld();
  let n = 0; const me = () => ({ ip: '10.0.0.' + (++n) });
  for (const keys of [{ evil: 'x' }, { 'fanglands.handoff.seen': '{}' }, { 'fanglands.adminKey': 'k' }, { 'fl_ADMIN': '1' }, { 'fanglands.slot.1': 5 }, { 'fanglands.slot.1': null }, { 'fanglands.bad key': 'x' }, {}, [], 'x', null]) {
    const r = await offer(w, keys, me());
    assert.equal(r.status, 400, JSON.stringify(keys));
  }
  assert.equal((await post(w, 'https://gorkscape.ca/api/handoff/offer', null, Object.assign(me(), { raw: 'not json' }))).status, 400);
  const many = {}; for (let i = 0; i <= HANDOFF_KEYS_MAX; i++) many['fl_learn_' + i] = '1';
  assert.equal((await offer(w, many, me())).status, 413);
  const r = await offer(w, { 'fanglands.slot.1': 'x'.repeat(HANDOFF_MAX) }, me());
  assert.deepEqual([r.status, r.data.code], [413, 'full']);
  assert.equal((await offer(w, { 'fanglands.slot.1': 'ü'.repeat(Math.ceil(HANDOFF_MAX / 2)) }, me())).status, 413, 'multi-byte letters count as the bytes they are');
  assert.equal((await offer(w, { 'fanglands.slot.1': 'x'.repeat(HANDOFF_MAX - 100) }, me())).status, 200);
  assert.equal((await post(w, 'https://fanglands.com/api/handoff/claim', null, Object.assign(me(), { raw: JSON.stringify({ code: 'a'.repeat(64), pad: 'x'.repeat(2000) }) }))).status, 413);
  assert.equal(rowsOf(w).length, 1);
});

test('hand-over: anonymous offers have a per-address limit a minute at a time; claims that find nothing are limited too, but a real code always lands', async () => {
  const w = newWorld();
  for (let i = 0; i < OFFERS_PER_MIN; i++) assert.equal((await offer(w, KEYS, { ip: '198.51.100.1' })).status, 200);
  const r = await offer(w, KEYS, { ip: '198.51.100.1' });
  assert.deepEqual([r.status, r.data.code], [429, 'wait']);
  assert.equal((await offer(w, KEYS, { ip: '198.51.100.2' })).status, 200, 'another address is not held up');
  T += 60000;
  const real = await offer(w, KEYS, { ip: '198.51.100.1' });
  assert.equal(real.status, 200, 'a minute later it may again');
  for (let i = 0; i < CLAIM_FAILS_PER_MIN; i++) assert.equal((await claim(w, 'f'.repeat(64), { ip: '198.51.100.1' })).status, 404);
  const c = await claim(w, 'f'.repeat(64), { ip: '198.51.100.1' });
  assert.deepEqual([c.status, c.data.code], [429, 'wait']);
  assert.equal((await claim(w, real.data.code, { ip: '198.51.100.1' })).status, 200, 'the same address with a real code and its pull lands');
});

test('hand-over: an IPv6 address counts by its /48; an IPv4 address (and one written as IPv6) by itself', () => {
  assert.equal(addressOf('2001:db8::1'), '2001:db8:0::/48');
  assert.equal(addressOf('2001:db8:0:ffff::2'), addressOf('2001:db8::1'), 'every /64 inside one /48 is the same place');
  assert.equal(addressOf('2001:0db8:0000:1234:ffff:1:2:3'), addressOf('2001:db8::1'));
  assert.notEqual(addressOf('2001:db8:1::1'), addressOf('2001:db8::1'));
  assert.equal(addressOf('203.0.113.7'), '203.0.113.7');
  assert.equal(addressOf('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(addressOf(''), '?'); assert.equal(addressOf(null), '?');
});

test('hand-over: anonymous offers: one /48 is one address for the limit and for its byte budget', async () => {
  const w = newWorld();
  for (let i = 0; i < OFFERS_PER_MIN; i++) assert.equal((await offer(w, { 'fl_learn_bag': '1' }, { ip: '2001:db8:0:' + (i + 1).toString(16) + '::1' })).status, 200);
  assert.equal((await offer(w, { 'fl_learn_bag': '1' }, { ip: '2001:db8:0:ff::1' })).status, 429, 'a whole /48 of /64s is one address');
  assert.equal((await offer(w, { 'fl_learn_bag': '1' }, { ip: '2001:db8:1::1' })).status, 200, 'the next /48 is another place');
  const big = { 'fanglands.slot.1': 'x'.repeat(HANDOFF_MAX - 200) };
  const w2 = newWorld();
  const flood = async ip => { const out = []; for (let i = 0; i < 4; i++) out.push((await offer(w2, big, { ip })).status); return out; };
  assert.deepEqual(await flood('198.51.100.1'), [200, 200, 429, 429]);
  assert.deepEqual(await flood('2001:db8::1'), [200, 200, 429, 429]);
  assert.deepEqual(await flood('2001:db8:0:77::2'), [429, 429, 429, 429], 'the same /48 shares the budget');
  assert.ok(w2.db.prepare('SELECT SUM(bytes) AS b FROM handoffs').get().b <= 2 * ADDRESS_BYTES_MAX + 2000);
  T += HANDOFF_MS + 1;
  assert.equal((await offer(w2, big, { ip: '198.51.100.1' })).status, 200, 'once the offers run out, the same address may offer again');
});

test('hand-over: an anonymous flood at the global cap never refuses or holds up an offer with a real login, even from the flooding address', async () => {
  const w = newWorld();
  // the flood: every anonymous row the world will hold, from many /48s, plus each flooding address at its own limit
  let i = 0;
  while (true) {
    const r = await offer(w, { 'fl_learn_bag': String(i) }, { ip: '2001:db8:' + (++i).toString(16) + '::1' });
    if (r.status === 503) break;
    assert.equal(r.status, 200);
    assert.ok(i <= ANON_ROWS_MAX + 1);
  }
  assert.equal(rowsOf(w).length, ANON_ROWS_MAX);
  for (let k = 0; k < OFFERS_PER_MIN + 3; k++) await offer(w, KEYS, { ip: '198.51.100.66' });
  assert.equal((await offer(w, KEYS, { ip: '203.0.113.200' })).status, 503, 'an anonymous offer from anywhere else is refused');
  // a kid with a real login, on another address and on the flooding one: straight through, every time
  const kids = ['Cohen', 'Sam', 'Ada'].map(n => ({ n, tok: account(w, n) }));
  for (const { n, tok } of kids) {
    for (const ip of ['203.0.113.5', '198.51.100.66', '2001:db8:1::9']) {
      const t0 = performance.now();
      const o = await offer(w, Object.assign({}, KEYS, { 'fanglands.session': tok, 'fanglands.lastname': n }), { ip });
      assert.equal(o.status, 200, n + ' ' + ip + ' ' + JSON.stringify(o.data));
      assert.equal(o.data.kind, 'login');
      assert.ok(performance.now() - t0 < 1000, 'answered at once');
      const c = await claim(w, o.data.code, { ip });
      assert.equal(c.status, 200);
      assert.equal(c.data.keys['fanglands.session'], tok);
    }
  }
  // a login that ran out, a banned knight, or a token nobody has: that offer is anonymous, and the cap holds it
  const old = account(w, 'Old', { expires: T - 1 }), bad = account(w, 'Bad', { banned: 1 });
  for (const tok of [old, bad, 'b'.repeat(64)]) {
    const r = await offer(w, Object.assign({}, KEYS, { 'fanglands.session': tok }), { ip: '203.0.113.77' });
    assert.equal(r.status, 503, tok.slice(0, 6));
  }
  // checking a login writes nothing about it (no last_seen, no deleted sessions)
  assert.equal(w.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 5);
});

test('hand-over: the test world may set the anonymous cap lower, never higher', async () => {
  const { anonRowsMax } = await import('../src/handoff.js');
  assert.equal(anonRowsMax({ env: {} }), ANON_ROWS_MAX);
  assert.equal(anonRowsMax({ env: { HANDOFF_ANON_ROWS_MAX: '3' } }), 3);
  for (const v of ['99999', '0', '-1', 'x', '']) assert.equal(anonRowsMax({ env: { HANDOFF_ANON_ROWS_MAX: v } }), ANON_ROWS_MAX, v);
  const w = newWorld(); w.env = Object.assign({}, ENV, { HANDOFF_ANON_ROWS_MAX: '2' });
  assert.equal((await offer(w, KEYS, { ip: '10.7.0.1' })).status, 200);
  assert.equal((await offer(w, KEYS, { ip: '10.7.0.2' })).status, 200);
  assert.equal((await offer(w, KEYS, { ip: '10.7.0.3' })).status, 503);
  assert.equal((await offer(w, Object.assign({}, KEYS, { 'fanglands.session': account(w, 'Cohen') }), { ip: '10.7.0.3' })).status, 200);
});

test('hand-over: a login\'s own budget: at most ACCT_ROWS_MAX waiting (the newest replaces the oldest), ACCT_PER_MIN a minute, apart from every other account', async () => {
  const w = newWorld();
  const tok = account(w, 'Cohen'), other = account(w, 'Sam');
  const mine = Object.assign({}, KEYS, { 'fanglands.session': tok });
  const codes = [];
  for (let i = 0; i < ACCT_ROWS_MAX + 2; i++) { const o = await offer(w, mine, { ip: '10.5.0.' + i }); assert.equal(o.status, 200); codes.push(o.data.code); T += 10; }
  assert.equal(w.db.prepare('SELECT COUNT(*) AS n FROM handoffs WHERE acct = ?').get('cohen').n, ACCT_ROWS_MAX);
  assert.equal((await claim(w, codes[0])).status, 404, 'the oldest went');
  assert.equal((await claim(w, codes[codes.length - 1])).status, 200, 'the newest is there');
  for (let i = ACCT_ROWS_MAX + 2; i < ACCT_PER_MIN; i++) assert.equal((await offer(w, mine)).status, 200);
  const r = await offer(w, mine);
  assert.deepEqual([r.status, r.data.code], [429, 'wait']);
  assert.equal((await offer(w, Object.assign({}, KEYS, { 'fanglands.session': other }))).status, 200, 'another account is not held up');
  assert.equal((await offer(w, KEYS)).status, 200, 'nor is an anonymous offer');
});

test('hand-over: the backup export never carries a hand-over; the world writes nothing to its logs while handing over', async () => {
  const w = newWorld();
  await offer(w, KEYS);
  const ex = await w.fetch(new Request('https://fanglands.com/api/admin/export', { headers: { authorization: 'Bearer ' + ENV.ADMIN_KEY } }));
  const dump = await ex.json();
  assert.equal(ex.status, 200);
  assert.ok(!('handoffs' in dump));
  assert.ok(!JSON.stringify(dump).includes(KEYS['fanglands.session']));
  const said = [];
  const was = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  for (const k of Object.keys(was)) console[k] = (...a) => said.push(a.map(String).join(' '));
  try {
    const o = await offer(w, KEYS);
    await claim(w, o.data.code); await claim(w, o.data.code); await claim(w, 'x');
    await offer(w, { evil: 'x' });
  } finally { Object.assign(console, was); }
  assert.deepEqual(said, []);
});

test('hand-over: a claim must bring the pull the offer was bound to; any other pull is refused and does NOT use the code up', async () => {
  const w = newWorld();
  const o = await offer(w, KEYS, { ip: '198.51.100.66' });
  for (const pull of ['f'.repeat(32), 'ffff', '', 'F'.repeat(32), PULL + '0']) {
    const r = await post(w, 'https://fanglands.com/api/handoff/claim', { code: o.data.code, pull }, { ip: '203.0.113.5' });
    assert.deepEqual([r.status, r.data.code], [404, 'gone'], 'pull ' + pull.length);
  }
  assert.equal(rowsOf(w).length, 1, 'a refused claim leaves the offer where it was');
  assert.equal((await claim(w, o.data.code)).status, 200);
  assert.equal((await claim(w, o.data.code)).status, 404);
  for (const pull of [undefined, '', 'xyz', 'A'.repeat(32), 'a'.repeat(64)]) {
    const r = await post(w, 'https://gorkscape.ca/api/handoff/offer', { keys: KEYS, pull }, { ip: '192.0.2.' + (pull ? pull.length : 0) });
    assert.equal(r.status, 400, String(pull));
  }
});

test('hand-over: a save slot stamp from the future is brought back to now; other stamps and values pass untouched', async () => {
  const w = newWorld();
  const keys = Object.assign({}, KEYS, { 'fanglands.slot.2.at': '9999999999999', 'fanglands.slot.3': '{"p":3}', 'fanglands.slot.3.at': String(T - 5) });
  const o = await offer(w, keys);
  const c = await claim(w, o.data.code);
  assert.equal(c.data.keys['fanglands.slot.2.at'], String(T));
  assert.equal(c.data.keys['fanglands.slot.3.at'], String(T - 5));
  assert.equal(c.data.keys['fanglands.slot.2'], KEYS['fanglands.slot.2']);
});

// ---------------------------------------------------------------------------
// The page scripts, run for real in a VM
// ---------------------------------------------------------------------------
const flush = () => new Promise(r => setImmediate(r));
function clock() {
  let t = 0, id = 0; const q = [];
  return {
    now: () => t,
    setTimeout: (fn, ms) => { q.push({ at: t + (ms || 0), fn, id: ++id, live: true }); return id; },
    clearTimeout: x => { const e = q.find(e => e.id === x); if (e) e.live = false; },
    async run(until) {
      for (;;) {
        for (let i = 0; i < 6; i++) await flush();
        const next = q.filter(e => e.live && e.at <= until).sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!next) break;
        next.live = false; t = next.at; next.fn();
      }
      t = until; await flush();
    },
  };
}
function storage(init, broken) {
  const s = Object.assign({}, init);
  const no = () => { throw new Error('storage is off'); };
  return { s, getItem: k => broken ? no() : (k in s ? s[k] : null), setItem: (k, v) => broken ? no() : (s[k] = String(v)), removeItem: k => { delete s[k]; }, key: i => Object.keys(s)[i], get length() { if (broken) no(); return Object.keys(s).length; } };
}
// Runs the one script of a page the front door served, in a VM with this browser's address, storage and network.
// answer(url, body, n) -> {status, json} | 'hang' | a Promise of either | a thrown network error ('down').
async function runPage(res, { at, store = {}, session = {}, broken = false, standalone = false, answer = () => ({ status: 503, json: { code: 'busy' } }), until = 30000 }) {
  const html = await res.text();
  const script = /<script nonce="[0-9a-f]{32}">\n([\s\S]*?)\n<\/script>/.exec(html)[1];
  const u = new URL(at), navs = [], calls = [], els = {}, hist = [];
  const el = id => els[id] || (els[id] = { id, hidden: true, attrs: {}, textContent: '', setAttribute(k, v) { this.attrs[k] = v; } });
  const c = clock(), ls = storage(store, broken), ss = storage(session);
  const fetch = (url, opt) => {
    const body = JSON.parse(opt.body); calls.push({ url, body, at: c.now() });
    let a;
    try { a = answer(url, body, calls.length); } catch (e) { return Promise.reject(e); }
    if (a === 'down') return Promise.reject(new TypeError('Load failed'));
    if (a === 'hang') return new Promise((_, no) => { if (opt.signal) opt.signal.addEventListener('abort', () => no(new Error('aborted'))); });
    return Promise.resolve(a).then(a => ({ ok: a.status === 200, status: a.status, json: async () => a.json }));
  };
  const ctx = vm.createContext({
    location: { hash: u.hash, pathname: u.pathname, search: u.search, origin: u.origin, hostname: u.hostname, replace: x => navs.push({ to: x, at: c.now() }) },
    history: { replaceState: (s, t, url) => hist.push(url) },
    navigator: { standalone: standalone === 'ios' ? true : undefined },
    matchMedia: q => ({ matches: standalone === 'pwa' && q === '(display-mode: standalone)' }),
    localStorage: ls, sessionStorage: ss, fetch, setTimeout: c.setTimeout, clearTimeout: c.clearTimeout, AbortController, crypto: globalThis.crypto,
    document: { getElementById: el }, unescape, encodeURIComponent, decodeURIComponent, Uint8Array, JSON, Math, Date,
  });
  ctx.window = ctx;
  vm.runInContext(script, ctx);
  await c.run(until);
  return { nav: navs.map(n => n.to), navs, calls, els, store: ls.s, session: ss.s, hist, html, shown: id => !!els[id] && els[id].hidden === false };
}
const pageAt = (url, env, extra) => worker.fetch(nav(url, extra), env || fakeEnv().env);
const CODE = 'c'.repeat(64), EVIL = 'e'.repeat(64);
const OK = { status: 200, json: { code: CODE, expires: 1, kind: 'login' } };
const FRESH = () => JSON.stringify({ n: PULL, at: Date.now() - 1000 });
// a browser on the old address: a login, slot 1 the cloud's working copy, a device knight in slot 2, settings, hints
const OLDSTORE = {
  'fanglands.session': 'a'.repeat(64), 'fanglands.lastname': 'Cohen',
  'fanglands.slot.1': '{"cloud":1}', 'fanglands.slot.1.at': '5', 'fanglands.slot.1.online': '1',
  'fanglands.slot.2': '{"player":{"level":7}}', 'fanglands.slot.2.at': '400',
  'fanglands.settings': '{"sound":true}', 'fl_learn_bag': '3',
};

test('hand-over page: opened from a home-screen icon (an installed web app) it never goes anywhere else: it stays, with no offer and no card', async () => {
  for (const standalone of ['ios', 'pwa']) {
    const r = await runPage(await pageAt('https://gorkscape.ca/admin?x=1'), { at: 'https://gorkscape.ca/admin?x=1', store: OLDSTORE, standalone, answer: () => OK });
    assert.deepEqual(r.nav, ['/handoff-stay?to=' + encodeURIComponent('/admin?x=1')], standalone);
    assert.equal(r.calls.length, 0);
    assert.ok(!r.shown('card'));
  }
  // a hand-over fragment is not carried into the game; any other fragment is
  let r = await runPage(await pageAt('https://www.gorkscape.ca/'), { at: 'https://www.gorkscape.ca/#handoff=' + EVIL, store: OLDSTORE, standalone: 'ios' });
  assert.deepEqual(r.nav, ['/handoff-stay?to=%2F']);
  r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/#castle', standalone: 'ios' });
  assert.deepEqual(r.nav, ['/handoff-stay?to=%2F#castle']);
});

test('hand-over page: nothing to hand over: straight across to the same path, no card; a #handoff fragment that arrived is never passed on and leaves the history', async () => {
  let r = await runPage(await pageAt('https://gorkscape.ca/admin?x=1'), { at: 'https://gorkscape.ca/admin?x=1#handoff=' + EVIL });
  assert.deepEqual(r.nav, ['https://fanglands.com/admin?x=1']); assert.equal(r.calls.length, 0);
  assert.deepEqual(r.hist, ['/admin?x=1']);
  assert.ok(!r.shown('card'));
  for (const h of ['#handoff2=' + EVIL, '#handoff-pull=' + PULL, '#handoffzzz']) {
    r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/' + h });
    assert.deepEqual(r.nav, ['https://fanglands.com/'], h);
  }
  r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/#castle' });
  assert.deepEqual(r.nav, ['https://fanglands.com/#castle']);
  // only what the server has already: slot 1 with its mark, and a knight already brought into an account
  const fp = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36) + '.' + s.length; };
  r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/', store: { 'fanglands.slot.1': '{"c":1}', 'fanglands.slot.1.online': '1', 'fanglands.slot.3': '{"b":1}', 'fanglands.slot.3.at': '7', 'fanglands.brought': JSON.stringify([fp('{"b":1}')]), 'fanglands.adminKey': 'k', 'fanglands.handoff.pull': FRESH(), 'other.app': '1' }, answer: () => OK });
  assert.equal(r.calls.length, 1, 'the brought list itself still goes');
  assert.deepEqual(r.calls[0].body.keys, { 'fanglands.brought': JSON.stringify([fp('{"b":1}')]) });
});

test('hand-over page: the first time, it shows the card and fetches a pull from the new address, saying which old address it is (www.gorkscape.ca has its own storage)', async () => {
  for (const host of ['gorkscape.ca', 'www.gorkscape.ca']) {
    const r = await runPage(await pageAt('https://' + host + '/admin?x=1'), { at: 'https://' + host + '/admin?x=1#handoff=' + EVIL, store: OLDSTORE, answer: () => OK });
    assert.deepEqual(r.nav, ['https://fanglands.com/handoff#back=' + encodeURIComponent('/admin?x=1') + '&from=' + host]);
    assert.equal(r.calls.length, 0);
    assert.ok(r.shown('card'));
    assert.ok(!JSON.stringify(r.nav).includes(EVIL));
  }
  const t = await runPage(await pageAt('https://test.gorkscape.ca/'), { at: 'https://test.gorkscape.ca/', store: OLDSTORE });
  assert.deepEqual(t.nav, ['https://test.fanglands.com/handoff#back=%2F&from=test.gorkscape.ca']);
});

test('hand-over page: with the pull that came (kept here from now on) it offers this browser\'s keys bound to it and goes to the landing page with the code', async () => {
  const store = Object.assign({ 'fanglands.handoff.seen': '{}', 'other.app': 'x', 'fanglands.adminKey': 'k' }, OLDSTORE);
  const r = await runPage(await pageAt('https://www.gorkscape.ca/admin?tab=chat'), { at: 'https://www.gorkscape.ca/admin?tab=chat#handoff-pull=' + PULL, store, answer: () => OK });
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0].url, '/api/handoff/offer');
  assert.equal(r.calls[0].body.pull, PULL);
  const want = Object.assign({}, OLDSTORE); delete want['fanglands.slot.1']; delete want['fanglands.slot.1.at']; delete want['fanglands.slot.1.online'];
  assert.deepEqual(r.calls[0].body.keys, want, 'every Fanglands key except what the server has, never the hand-over\'s notes, the parent page\'s or another app\'s');
  assert.deepEqual(r.nav, ['https://fanglands.com/handoff#land=' + CODE + '&to=' + encodeURIComponent('/admin?tab=chat') + '&from=www.gorkscape.ca']);
  assert.equal(JSON.parse(r.store[PULL_KEY]).n, PULL, 'the pull is kept on this address too');
  assert.deepEqual(r.hist, ['/admin?tab=chat'], 'the pull leaves the address bar and the history');
  // the second try (#handoff-pull2, after a lost answer) says so, so the landing page never comes back a third time
  const r2 = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/#handoff-pull2=' + PULL, store: OLDSTORE, answer: () => OK });
  assert.deepEqual(r2.nav, ['https://fanglands.com/handoff#land=' + CODE + '&to=%2F&from=gorkscape.ca&n=2']);
  // a pull that is not 32 hex and none kept: it fetches a fresh one
  const r3 = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/#handoff-pull=xyz', store: OLDSTORE, answer: () => OK });
  assert.deepEqual([r3.nav, r3.calls.length], [['https://fanglands.com/handoff#back=%2F&from=gorkscape.ca'], 0]);
});

test('hand-over page: later visits use the pull kept here and go straight to the offer (two hops fewer); one older than 30 days is not used', async () => {
  const store = Object.assign({ [PULL_KEY]: FRESH() }, OLDSTORE);
  let r = await runPage(await pageAt('https://gorkscape.ca/?online'), { at: 'https://gorkscape.ca/?online', store, answer: () => OK });
  assert.deepEqual(r.nav, ['https://fanglands.com/handoff#land=' + CODE + '&to=' + encodeURIComponent('/?online') + '&from=gorkscape.ca']);
  assert.equal(r.calls[0].body.pull, PULL);
  r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/', store: Object.assign({}, OLDSTORE, { [PULL_KEY]: JSON.stringify({ n: PULL, at: Date.now() - PULL_MS }) }), answer: () => OK });
  assert.equal(r.calls.length, 0); assert.match(r.nav[0], /\/handoff#back=/);
});

test('hand-over page: the card says "Still working on it..." after a few seconds; a world that cannot be reached is tried twice, then Try again (this page only)', async () => {
  let r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/', store: Object.assign({ [PULL_KEY]: FRESH() }, OLDSTORE), answer: () => 'hang', until: 3000 });
  assert.ok(r.shown('card') && !r.shown('more'));
  r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/', store: Object.assign({ [PULL_KEY]: FRESH() }, OLDSTORE), answer: () => 'hang', until: 5000 });
  assert.ok(r.shown('more'));
  assert.match(r.html, /<p id="more" class="dim" hidden>Still working on it\.\.\.<\/p>/);
  // down, then fine: lands
  let n = 0;
  r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/', store: Object.assign({ [PULL_KEY]: FRESH() }, OLDSTORE), answer: () => (++n === 1 ? 'down' : OK) });
  assert.deepEqual([r.calls.length, r.nav], [2, ['https://fanglands.com/handoff#land=' + CODE + '&to=%2F&from=gorkscape.ca']]);
  // every try hangs: no jump, the card says so, and Try again is a plain path on this address, even for a path like //evil
  for (const [path, here] of [['/admin?x=1', '/admin?x=1'], ['//evil.example/x', '/']]) {
    r = await runPage(await pageAt('https://gorkscape.ca' + path), { at: 'https://gorkscape.ca' + path, store: Object.assign({ [PULL_KEY]: FRESH() }, OLDSTORE), answer: () => 'hang', until: 120000 });
    assert.equal(r.calls.length, 2);
    assert.deepEqual(r.nav, []);
    assert.ok(r.shown('stuck') && !r.shown('work') ? true : r.els.work && r.els.work.hidden === true);
    assert.equal(r.els.again.attrs.href, here, path);
    assert.equal(r.els.anyway.attrs.href, 'https://fanglands.com' + here);
  }
  assert.match(r.html, /<p>Your knight is safe\. It could not come across just now\.<\/p>/);
});

test('hand-over page: when the world refuses an anonymous offer (too many at once) the kid is told plainly what waits, and goes on with OK; with no knight waiting it just goes on', async () => {
  for (const status of [429, 503]) {
    const r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/', store: Object.assign({ [PULL_KEY]: FRESH(), 'fanglands.slot.3': '{"x":3}' }, OLDSTORE), answer: () => ({ status, json: { code: 'busy' } }) });
    assert.equal(r.calls.length, 1, 'no hammering while the world is full');
    assert.deepEqual(r.nav, []);
    assert.ok(r.shown('waits'));
    assert.equal(r.els.waitText.textContent, 'Your 2 knights saved on this device will come across next time. They are safe here.');
    assert.equal(r.els.ok.attrs.href, 'https://fanglands.com/');
  }
  let r = await runPage(await pageAt('https://gorkscape.ca/x'), { at: 'https://gorkscape.ca/x', store: Object.assign({ [PULL_KEY]: FRESH() }, OLDSTORE), answer: () => ({ status: 503, json: {} }) });
  assert.equal(r.els.waitText.textContent, 'Your knight saved on this device will come across next time. It is safe here.');
  assert.equal(r.els.ok.attrs.href, 'https://fanglands.com/x');
  r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/', store: { [PULL_KEY]: FRESH(), 'fanglands.settings': '{}' }, answer: () => ({ status: 503, json: {} }) });
  assert.deepEqual(r.nav, ['https://fanglands.com/']);
});

test('landing page (#back): keeps a pull here and goes back to the old address it came from with it; a plain path only; storage off goes straight to the game', async () => {
  const { env, seen } = fakeEnv();
  const res = await worker.fetch(nav('https://fanglands.com/handoff#ignored'), env);
  assert.equal(res.status, 200); assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
  assert.equal(seen.assets.length, 0);
  const html = await res.text();
  const again = () => new Response(html, { headers: { 'content-type': 'text/html' } });
  let r = await runPage(again(), { at: 'https://fanglands.com/handoff#back=' + encodeURIComponent('/admin?x=1') + '&from=www.gorkscape.ca' });
  const kept = JSON.parse(r.store[PULL_KEY]);
  assert.match(kept.n, /^[0-9a-f]{32}$/);
  assert.deepEqual(r.nav, ['https://www.gorkscape.ca/admin?x=1#handoff-pull=' + kept.n]);
  assert.deepEqual(r.hist, ['/handoff']);
  assert.ok(r.shown('card'));
  r = await runPage(again(), { at: 'https://fanglands.com/handoff#back=%2F&from=gorkscape.ca', store: { [PULL_KEY]: FRESH() } });
  assert.deepEqual(r.nav, ['https://gorkscape.ca/#handoff-pull=' + PULL], 'a pull under 30 days old is used again');
  r = await runPage(again(), { at: 'https://fanglands.com/handoff#back=%2F&from=gorkscape.ca', store: { [PULL_KEY]: JSON.stringify({ n: PULL, at: Date.now() - PULL_MS }) } });
  assert.notEqual(JSON.parse(r.store[PULL_KEY]).n, PULL);
  for (const from of ['evil.example', 'test.gorkscape.ca', '', 'gorkscape.ca.evil.example']) {
    r = await runPage(again(), { at: 'https://fanglands.com/handoff#back=%2F&from=' + from });
    assert.match(r.nav[0], /^https:\/\/gorkscape\.ca\/#handoff-pull=[0-9a-f]{32}$/, from);
  }
  for (const back of ['//evil.example/x', 'https://evil.example', '/\\evil.example', '/a b', 'admin', '%E0%A4%A', '/x#handoff=' + EVIL]) {
    r = await runPage(again(), { at: 'https://fanglands.com/handoff#back=' + (back.startsWith('%') ? back : encodeURIComponent(back)) + '&from=gorkscape.ca' });
    assert.match(r.nav[0], /^https:\/\/gorkscape\.ca\/#handoff-pull=[0-9a-f]{32}$/, back);
  }
  r = await runPage(again(), { at: 'https://fanglands.com/handoff#back=' + encodeURIComponent('/?online'), broken: true });
  assert.deepEqual(r.nav, ['/?online']);
  const t = await worker.fetch(nav('https://test.fanglands.com/handoff'), env);
  r = await runPage(t, { at: 'https://test.fanglands.com/handoff#back=%2F&from=gorkscape.ca' });
  assert.match(r.nav[0], /^https:\/\/test\.gorkscape\.ca\/#handoff-pull=/, 'the test world only ever goes back to its own old address');
  assert.equal((await worker.fetch(nav('https://www.fanglands.com/handoff'), env)).status, 301);
  assert.equal((await worker.fetch(new Request('https://fanglands.com/handoff', { method: 'POST', body: 'x' }), env)).status, 302);
});

test('landing page (#land): the code leaves the address and history first; it claims with the pull kept here, writes what is missing, and goes on to the same path, deep paths too', async () => {
  const html = await (await pageAt('https://fanglands.com/handoff')).text();
  const again = () => new Response(html, { headers: { 'content-type': 'text/html' } });
  const offered = Object.assign({}, OLDSTORE); delete offered['fanglands.slot.1']; delete offered['fanglands.slot.1.at']; delete offered['fanglands.slot.1.online'];
  for (const to of ['/', '/?online', '/admin?x=1', '/deep/path?a=b']) {
    const r = await runPage(again(), {
      at: 'https://fanglands.com/handoff#land=' + CODE + '&to=' + encodeURIComponent(to) + '&from=www.gorkscape.ca',
      store: { [PULL_KEY]: FRESH(), 'fanglands.settings': '{"mine":1}' },
      answer: (url, body) => { assert.equal(url, '/api/handoff/claim'); assert.deepEqual(body, { code: CODE, pull: PULL }); return { status: 200, json: { keys: offered, from: 'www.gorkscape.ca' } }; },
    });
    assert.deepEqual(r.hist, ['/handoff'], 'the code is off the address before anything else');
    assert.deepEqual(r.nav, [to]);
    assert.equal(r.store['fanglands.session'], OLDSTORE['fanglands.session']);
    assert.equal(r.store['fanglands.slot.2'], OLDSTORE['fanglands.slot.2']);
    assert.equal(r.store['fanglands.settings'], '{"mine":1}', 'nothing here is written over');
    assert.ok(JSON.parse(r.store['fanglands.handoff.seen'])['www.gorkscape.ca|slot.2'], 'remembered per old address');
    assert.equal(r.session[ARRIVING_KEY], to.startsWith('/admin') ? undefined : '1', 'the game page shows the card while it loads');
    assert.ok(r.shown('card'));
    assert.ok(!r.nav.join().includes(CODE));
  }
});

test('landing page (#land): a claim that finds nothing, or no answer, goes back to the old address once with this address\'s pull so it offers again; a second miss shows Try again', async () => {
  const html = await (await pageAt('https://fanglands.com/handoff')).text();
  const again = () => new Response(html, { headers: { 'content-type': 'text/html' } });
  for (const answer of [() => ({ status: 404, json: { code: 'gone' } }), () => 'hang', () => 'down', () => ({ status: 500, json: {} })]) {
    let r = await runPage(again(), { at: 'https://fanglands.com/handoff#land=' + CODE + '&to=%2Fadmin&from=www.gorkscape.ca', store: { [PULL_KEY]: FRESH() }, answer, until: 20000 });
    assert.deepEqual(r.nav, ['https://www.gorkscape.ca/admin#handoff-pull2=' + PULL]);
    r = await runPage(again(), { at: 'https://fanglands.com/handoff#land=' + CODE + '&to=%2Fadmin&from=www.gorkscape.ca&n=2', store: { [PULL_KEY]: FRESH() }, answer, until: 20000 });
    assert.deepEqual(r.nav, []);
    assert.ok(r.shown('stuck'));
    assert.equal(r.els.again.attrs.href, 'https://www.gorkscape.ca/admin');
    assert.equal(r.els.anyway.attrs.href, '/admin');
  }
  // no pull kept here (cleared since): it makes one and goes back with it
  const r = await runPage(again(), { at: 'https://fanglands.com/handoff#land=' + CODE + '&to=%2F&from=gorkscape.ca', answer: () => OK });
  assert.equal(r.calls.length, 1);
  assert.match(r.nav[0], /^https:\/\/gorkscape\.ca\/#handoff-pull2=[0-9a-f]{32}$/);
  // a broken code: nothing to claim, straight to the path
  const b = await runPage(again(), { at: 'https://fanglands.com/handoff#land=xyz&to=%2Fadmin&from=gorkscape.ca', store: { [PULL_KEY]: FRESH() } });
  assert.deepEqual([b.nav, b.calls.length], [['/admin'], 0]);
});

// The whole chain in one browser with two addresses' storage, against a real World: old page, the first-time pull,
// the offer, the landing, the merge. Logged in, logged out with device knights, www, and a second visit.
async function chain(w, { host = 'gorkscape.ca', path = '/', oldStore, newStore = {}, ip = '203.0.113.9' }) {
  const env = fakeEnv().env;
  const call = (h) => async (url, body) => {
    const r = await post(w, 'https://' + h + url, body, { ip });
    return { status: r.status, json: r.data };
  };
  let url = 'https://' + host + path, hops = [], r;
  const stores = { old: oldStore, new: newStore };
  for (let i = 0; i < 8; i++) {
    const u = new URL(url); hops.push(url);
    const old = u.hostname !== 'fanglands.com';
    if (!old && u.pathname !== '/handoff') break;   // the game, /admin, any page: the end of the hop
    r = await runPage(await pageAt(url, env), { at: url, store: old ? stores.old : stores.new, answer: call(u.hostname) });
    if (old) stores.old = r.store; else stores.new = r.store;
    if (!r.nav.length) break;
    url = new URL(r.nav[0], url).href;
  }
  return { hops, store: stores.new, old: stores.old, last: r };
}

test('the whole hop against a real world: logged in (first visit and later), logged out with device knights, www, and an /admin path', async () => {
  const w = newWorld();
  const tok = account(w, 'Cohen');
  const kid = Object.assign({}, OLDSTORE, { 'fanglands.session': tok });
  let c = await chain(w, { oldStore: kid, path: '/?online' });
  assert.deepEqual(c.hops.map(h => h.replace(/[0-9a-f]{32,}/g, 'X')), ['https://gorkscape.ca/?online', 'https://fanglands.com/handoff#back=%2F%3Fonline&from=gorkscape.ca', 'https://gorkscape.ca/?online#handoff-pull=X', 'https://fanglands.com/handoff#land=X&to=%2F%3Fonline&from=gorkscape.ca', 'https://fanglands.com/?online']);
  assert.equal(c.store['fanglands.session'], tok);
  assert.equal(c.store['fanglands.slot.2'], kid['fanglands.slot.2']);
  assert.ok(!('fanglands.slot.1' in c.store), 'the cloud copy is not carried: logging in brings it');
  assert.equal(rowsOf(w).length, 0);
  // a later visit: two hops fewer
  c = await chain(w, { oldStore: c.old, newStore: c.store });
  assert.equal(c.hops.length, 3);
  assert.equal(c.store['fanglands.slot.3'], undefined, 'no second copy');
  // logged out, with device knights, from www
  const dev = { 'fanglands.slot.2': '{"player":{"level":3}}', 'fanglands.slot.3': '{"player":{"level":9}}', 'fanglands.settings': '{"kid":true}' };
  c = await chain(w, { host: 'www.gorkscape.ca', path: '/admin?x=1', oldStore: dev, newStore: { 'fanglands.slot.2': '{"here":1}' } });
  assert.equal(c.hops[c.hops.length - 1], 'https://fanglands.com/admin?x=1');
  assert.equal(c.store['fanglands.slot.2'], '{"here":1}');
  assert.equal(c.store['fanglands.slot.3'], dev['fanglands.slot.3']);
  assert.equal(c.store['fanglands.slot.4'], dev['fanglands.slot.2']);
  assert.ok(JSON.parse(c.store['fanglands.handoff.seen'])['www.gorkscape.ca|slot.2']);
});
