// Two addresses (docs/ONLINE.md, "Two addresses"): the front door on every address, and the hand-over offer and claim
// in the World on node's SQLite. Every rule the hand-over keeps has a test here: one use, a short life, only the hash
// stored, nothing kept after a claim, only the game's own addresses, a per-IP limit, a hard size cap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/worker.js';
import { frontDoor, MOVES, HANDOFF_MS, HANDOFF_MAX, HANDOFF_KEYS_MAX, OFFERS_PER_MIN, CLAIMS_PER_MIN, STORED_MAX } from '../src/handoff.js';

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

test('front door: a page on each old address is the hand-over page, aimed at the matching new address, keeping path and query', async () => {
  const { env, seen } = fakeEnv();
  for (const [from, to] of Object.entries(MOVES)) {
    const res = await worker.fetch(nav('https://' + from + '/admin?x=1'), env);
    assert.equal(res.status, 200, from);
    const html = await res.text();
    assert.match(html, new RegExp('var HOME = "https://' + to.replace(/\./g, '\\.') + '";'));
    assert.match(html, /location\.pathname \+ location\.search/);
    assert.match(html, /#handoff=/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
    const csp = res.headers.get('content-security-policy');
    const nonce = /'nonce-([0-9a-f]{32})'/.exec(csp)[1];
    assert.ok(html.includes('<script nonce="' + nonce + '">'), 'the one script carries the nonce');
    assert.match(csp, /default-src 'none'/); assert.match(csp, /connect-src 'self'/); assert.match(csp, /frame-ancestors 'none'/);
  }
  assert.equal(seen.assets.length, 0, 'no game file is served on an old address');
  // an older browser with no Sec-Fetch headers: a page is what accepts HTML, or the game's own paths
  let res = await worker.fetch(new Request('https://gorkscape.ca/', { headers: { accept: 'text/html' } }), env);
  assert.equal(res.status, 200); assert.match(await res.text(), /handoff/);
  res = await worker.fetch(new Request('https://gorkscape.ca/'), env);
  assert.equal(res.status, 200);
  // two hand-over pages never share a nonce
  const n1 = (await worker.fetch(nav('https://gorkscape.ca/'), env)).headers.get('content-security-policy');
  const n2 = (await worker.fetch(nav('https://gorkscape.ca/'), env)).headers.get('content-security-policy');
  assert.notEqual(n1, n2);
  // HEAD gets the headers with no body
  res = await worker.fetch(new Request('https://gorkscape.ca/', { method: 'HEAD', headers: { 'sec-fetch-dest': 'document' } }), env);
  assert.equal(res.status, 200); assert.equal(await res.text(), '');
});

test('front door: a file on an old address is sent on with a 302; www.fanglands.com sends to the bare address with a 301', async () => {
  const { env, seen } = fakeEnv();
  let res = await worker.fetch(new Request('https://gorkscape.ca/favicon.ico', { headers: { 'sec-fetch-dest': 'image' } }), env);
  assert.equal(res.status, 302); assert.equal(res.headers.get('location'), 'https://fanglands.com/favicon.ico');
  res = await worker.fetch(new Request('https://test.gorkscape.ca/bridge.html?a=b', { headers: { 'sec-fetch-dest': 'iframe' } }), env);
  assert.equal(res.status, 302); assert.equal(res.headers.get('location'), 'https://test.fanglands.com/bridge.html?a=b');
  res = await worker.fetch(new Request('https://gorkscape.ca/', { method: 'POST', body: 'x' }), env);
  assert.equal(res.status, 302);
  res = await worker.fetch(nav('https://www.fanglands.com/admin?tab=chat'), env);
  assert.equal(res.status, 301); assert.equal(res.headers.get('location'), 'https://fanglands.com/admin?tab=chat');
  assert.equal(seen.assets.length, 0);
  // the home serves the game's files
  for (const u of ['https://fanglands.com/', 'https://fanglands.com/admin', 'https://test.fanglands.com/?online', 'http://localhost:8790/']) {
    res = await worker.fetch(nav(u), env);
    assert.equal(await res.text(), 'asset ' + new URL(u).pathname);
  }
  assert.equal(seen.assets.length, 4);
  assert.equal(frontDoor(nav('https://fanglands.com/'), new URL('https://fanglands.com/')), null);
});

test('front door: HANDOVER off keeps the old addresses serving the game as before (the first ship), www still goes to the bare address', async () => {
  const { env, seen } = fakeEnv(); env.HANDOVER = 'off';
  for (const host of Object.keys(MOVES)) {
    const res = await worker.fetch(nav('https://' + host + '/?online'), env);
    assert.equal(await res.text(), 'asset /', host);
  }
  assert.equal(seen.assets.length, 3);
  const res = await worker.fetch(nav('https://www.fanglands.com/'), env);
  assert.equal(res.status, 301);
  env.HANDOVER = 'on';
  assert.equal((await worker.fetch(nav('https://gorkscape.ca/'), env)).headers.get('cache-control'), 'no-store');
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
async function post(w, url, body, { origin, ip = '203.0.113.7', raw } = {}) {
  const u = new URL(url);
  const headers = { 'content-type': 'application/json', 'cf-connecting-ip': ip };
  if (origin !== null) headers.origin = origin || ('https://' + u.hostname);
  const res = await w.fetch(new Request(url, { method: 'POST', headers, body: raw !== undefined ? raw : JSON.stringify(body) }));
  let data = null; try { data = await res.json(); } catch (e) { }
  return { status: res.status, data };
}
const offer = (w, keys, opts, host = 'gorkscape.ca') => post(w, 'https://' + host + '/api/handoff/offer', { keys }, opts);
const claim = (w, code, opts, host = 'fanglands.com') => post(w, 'https://' + host + '/api/handoff/claim', { code }, opts);
const rowsOf = w => w.db.prepare('SELECT * FROM handoffs').all();
const KEYS = {
  'fanglands.session': 'a'.repeat(64), 'fanglands.lastname': 'Cohen', 'fanglands.slot.1': '{"player":{"kills":3}}', 'fanglands.slot.1.at': '1759400000000',
  'fanglands.slot.1.online': '1', 'fanglands.settings': '{"sound":true}', 'fl_learn_bag': '2', 'fl_coach_swing': '1', 'fanglands.save.v2': '{"old":true}',
};

test('hand-over: an offer from the old address gets a 256-bit code; the claim on the new address gets exactly the keys, once', async () => {
  const w = newWorld();
  const o = await offer(w, KEYS);
  assert.equal(o.status, 200, JSON.stringify(o.data));
  assert.match(o.data.code, /^[0-9a-f]{64}$/);
  assert.equal(o.data.expires, T + HANDOFF_MS);
  assert.ok(HANDOFF_MS <= 5 * 60 * 1000);
  // only the code's SHA-256 is stored: the table holds no row keyed by the code itself
  const rows = rowsOf(w);
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].id, o.data.code); assert.match(rows[0].id, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(rows).includes(o.data.code));
  const c = await claim(w, o.data.code);
  assert.equal(c.status, 200);
  assert.deepEqual(c.data.keys, KEYS);
  assert.equal(rowsOf(w).length, 0, 'nothing is kept after a claim');
  const again = await claim(w, o.data.code);
  assert.deepEqual([again.status, again.data.code], [404, 'gone']);
  // two offers never share a code
  const a = await offer(w, KEYS), b = await offer(w, KEYS);
  assert.notEqual(a.data.code, b.data.code);
});

test('hand-over: a code that ran out is gone and its row deleted; a made-up or broken code gets the same answer', async () => {
  const w = newWorld();
  const o = await offer(w, KEYS);
  T += HANDOFF_MS;
  const c = await claim(w, o.data.code);
  assert.deepEqual([c.status, c.data.code], [404, 'gone']);
  assert.equal(rowsOf(w).length, 0);
  for (const code of ['f'.repeat(64), 'xyz', '', 'F'.repeat(64), 'a'.repeat(65)]) {
    const r = await claim(w, code);
    assert.deepEqual([r.status, r.data.code], [404, 'gone'], code);
  }
  // one that has not run out yet still works right up to the end
  const o2 = await offer(w, KEYS); T += HANDOFF_MS - 1;
  assert.equal((await claim(w, o2.data.code)).status, 200);
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

test('hand-over: only the game\'s own addresses: offers from an old one, claims on a new one, each with its own Origin', async () => {
  const w = newWorld();
  // offers
  for (const host of ['gorkscape.ca', 'www.gorkscape.ca', 'test.gorkscape.ca']) assert.equal((await offer(w, KEYS, {}, host)).status, 200, host);
  for (const [host, origin] of [['fanglands.com', undefined], ['www.fanglands.com', undefined], ['gorkscape.ca', 'https://evil.example'], ['gorkscape.ca', null],
    ['gorkscape.ca', 'https://www.gorkscape.ca'], ['gorkscape.ca', 'http://gorkscape.ca'], ['gorkscape.ca', 'https://fanglands.com'], ['localhost', undefined], ['gorkscape.ca.evil.example', undefined]]) {
    const r = await offer(w, KEYS, { origin }, host);
    assert.deepEqual([r.status, r.data.code], [403, 'origin'], host + ' ' + origin);
  }
  // claims
  const codes = [];
  for (let i = 0; i < 12; i++) codes.push((await offer(w, KEYS)).data.code);
  for (const [host, origin] of [['gorkscape.ca', undefined], ['test.gorkscape.ca', undefined], ['fanglands.com', 'https://gorkscape.ca'], ['fanglands.com', null], ['fanglands.com', 'https://evil.example'], ['fanglands.com', 'https://test.fanglands.com']]) {
    const r = await claim(w, codes.pop(), { origin }, host);
    assert.deepEqual([r.status, r.data.code], [403, 'origin'], host + ' ' + origin);
  }
  // a refused claim did not use the code up: the right address can still claim it
  const kept = codes.pop();
  assert.equal((await claim(w, kept, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await claim(w, kept)).status, 200);
  for (const host of ['fanglands.com', 'www.fanglands.com', 'test.fanglands.com']) assert.equal((await claim(w, codes.pop(), {}, host)).status, 200, host);
  // only POST
  const g = await w.fetch(new Request('https://gorkscape.ca/api/handoff/offer', { headers: { origin: 'https://gorkscape.ca' } }));
  assert.equal(g.status, 405);
  const n = await w.fetch(new Request('https://gorkscape.ca/api/handoff/other', { method: 'POST', headers: { origin: 'https://gorkscape.ca' } }));
  assert.equal(n.status, 404);
});

test('hand-over: only the game\'s keys, only strings, a hard cap on size and on the number of keys', async () => {
  const w = newWorld();
  let n = 0; const me = () => ({ ip: '10.0.0.' + (++n) });   // each try from its own address, so the per-IP limit stays out of it
  for (const keys of [{ evil: 'x' }, { 'fanglands.handoff.seen': '{}' }, { 'fanglands.slot.1': 5 }, { 'fanglands.slot.1': null }, { 'fanglands.bad key': 'x' }, {}, [], 'x', null]) {
    const r = await offer(w, keys, me());
    assert.equal(r.status, 400, JSON.stringify(keys));
  }
  assert.equal((await post(w, 'https://gorkscape.ca/api/handoff/offer', null, Object.assign(me(), { raw: 'not json' }))).status, 400);
  const many = {}; for (let i = 0; i <= HANDOFF_KEYS_MAX; i++) many['fl_learn_' + i] = '1';
  assert.deepEqual([(await offer(w, many, me())).status], [413]);
  const big = { 'fanglands.slot.1': 'x'.repeat(HANDOFF_MAX) };
  const r = await offer(w, big, me());
  assert.deepEqual([r.status, r.data.code], [413, 'full']);
  // multi-byte letters count as the bytes they are
  const wide = { 'fanglands.slot.1': 'ü'.repeat(Math.ceil(HANDOFF_MAX / 2)) };
  assert.equal((await offer(w, wide, me())).status, 413);
  // just under the cap is fine
  const near = { 'fanglands.slot.1': 'x'.repeat(HANDOFF_MAX - 100) };
  assert.equal((await offer(w, near, me())).status, 200);
  // a claim body is tiny
  assert.equal((await post(w, 'https://fanglands.com/api/handoff/claim', null, Object.assign(me(), { raw: JSON.stringify({ code: 'a'.repeat(64), pad: 'x'.repeat(2000) }) }))).status, 413);
  assert.equal(rowsOf(w).length, 1);
});

test('hand-over: a per-IP limit on offers and on claims, a minute at a time', async () => {
  const w = newWorld();
  for (let i = 0; i < OFFERS_PER_MIN; i++) assert.equal((await offer(w, KEYS, { ip: '198.51.100.1' })).status, 200);
  const r = await offer(w, KEYS, { ip: '198.51.100.1' });
  assert.deepEqual([r.status, r.data.code], [429, 'wait']);
  assert.equal((await offer(w, KEYS, { ip: '198.51.100.2' })).status, 200, 'another address is not held up');
  T += 60000;
  assert.equal((await offer(w, KEYS, { ip: '198.51.100.1' })).status, 200, 'a minute later it may again');
  for (let i = 0; i < CLAIMS_PER_MIN; i++) assert.equal((await claim(w, 'f'.repeat(64), { ip: '198.51.100.9' })).status, 404);
  const c = await claim(w, 'f'.repeat(64), { ip: '198.51.100.9' });
  assert.deepEqual([c.status, c.data.code], [429, 'wait']);
  // offers and claims are counted apart
  assert.equal((await offer(w, KEYS, { ip: '198.51.100.9' })).status, 200);
});

test('hand-over: a cap on everything waiting at once; the backup export never carries a hand-over', async () => {
  const w = newWorld();
  await offer(w, KEYS);
  const ins = w.db.prepare('INSERT INTO handoffs (id, keys, bytes, expires) VALUES (?, ?, ?, ?)');
  for (let i = 1; i < STORED_MAX; i++) ins.run('id' + i, '{}', 2, T + HANDOFF_MS);
  const r = await offer(w, KEYS, { ip: '192.0.2.50' });
  assert.deepEqual([r.status, r.data.code], [503, 'busy']);
  const ex = await w.fetch(new Request('https://fanglands.com/api/admin/export', { headers: { authorization: 'Bearer ' + ENV.ADMIN_KEY } }));
  const dump = await ex.json();
  assert.equal(ex.status, 200);
  assert.ok(!('handoffs' in dump));
  assert.ok(!JSON.stringify(dump).includes(KEYS['fanglands.session']));
});

test('hand-over: the world writes nothing to its logs while handing over, so a code or a token never reaches one', async () => {
  const w = newWorld();
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
