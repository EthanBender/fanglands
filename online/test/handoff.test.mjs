// Two addresses (docs/ONLINE.md, "Two addresses"): the front door on every address, and the hand-over offer and claim
// in the World on node's SQLite. Every rule the hand-over keeps has a test here: one use, a short life, only the hash
// stored, nothing kept after a claim, a claim only with the pull the offer was bound to, only the game's own addresses,
// a per-address limit and byte budget (an IPv6 address by its /64), a hard size cap, stamps from the future brought
// back to now; and the two page scripts run in a VM: the hand-over page never passes on a code it was given.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/worker.js';
import vm from 'node:vm';
import { frontDoor, MOVES, HANDOFF_MS, HANDOFF_MAX, HANDOFF_KEYS_MAX, OFFERS_PER_MIN, CLAIMS_PER_MIN, STORED_MAX, ADDRESS_BYTES_MAX, PULL_KEY, PULL_MS, addressOf } from '../src/handoff.js';

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
    assert.match(html, /var here = location\.pathname \+ location\.search;/);
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
const PULL = '0123456789abcdef0123456789abcdef';   // the pull the new address kept (step 2 of the hop)
const offer = (w, keys, opts, host = 'gorkscape.ca') => post(w, 'https://' + host + '/api/handoff/offer', { keys, pull: (opts && opts.pull) || PULL }, opts);
const claim = (w, code, opts, host = 'fanglands.com') => post(w, 'https://' + host + '/api/handoff/claim', { code, pull: (opts && opts.pull) || PULL }, opts);
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

// ---------------------------------------------------------------------------
// The review fixes (round 1): a code only works in the browser that asked for it, stamps from the future, the
// per-address budget on the /64, and the two page scripts run for real in a VM
// ---------------------------------------------------------------------------
test('hand-over: a claim must bring the pull the offer was bound to; any other pull is refused and does NOT use the code up', async () => {
  const w = newWorld();
  const o = await offer(w, KEYS, { ip: '198.51.100.66', origin: 'https://gorkscape.ca' });   // anyone can make an offer, even with a made-up Origin
  assert.equal(o.status, 200);
  // the code handed to a kid whose browser kept a different pull (or none): refused, with the same answer as "gone"
  for (const pull of ['f'.repeat(32), 'ffff', '', 'F'.repeat(32), PULL + '0']) {
    const r = await post(w, 'https://fanglands.com/api/handoff/claim', { code: o.data.code, pull }, { ip: '203.0.113.5' });
    assert.deepEqual([r.status, r.data.code], [404, 'gone'], 'pull ' + pull.length);
  }
  const none = await post(w, 'https://fanglands.com/api/handoff/claim', { code: o.data.code }, { ip: '203.0.113.5' });
  assert.deepEqual([none.status, none.data.code], [404, 'gone']);
  assert.equal(rowsOf(w).length, 1, 'a refused claim leaves the offer where it was');
  // the browser that kept the pull still gets it, once
  assert.equal((await claim(w, o.data.code)).status, 200);
  assert.equal((await claim(w, o.data.code)).status, 404);
  // only the pull's SHA-256 is kept, never the pull itself
  await offer(w, KEYS);
  assert.ok(!JSON.stringify(rowsOf(w)).includes(PULL));
  // an offer with no pull, or a pull that is not 32 hex, is refused
  for (const pull of [undefined, '', 'xyz', 'A'.repeat(32), 'a'.repeat(64)]) {
    const r = await post(w, 'https://gorkscape.ca/api/handoff/offer', { keys: KEYS, pull }, { ip: '192.0.2.' + (pull ? pull.length : 0) });
    assert.equal(r.status, 400, String(pull));
  }
});

test('hand-over: a save slot stamp from the future is brought back to now; other stamps and values pass untouched', async () => {
  const w = newWorld();
  const keys = Object.assign({}, KEYS, { 'fanglands.slot.2': '{"p":2}', 'fanglands.slot.2.at': '9999999999999', 'fanglands.slot.3': '{"p":3}', 'fanglands.slot.3.at': String(T - 5) });
  const o = await offer(w, keys);
  const c = await claim(w, o.data.code);
  assert.equal(c.data.keys['fanglands.slot.2.at'], String(T));
  assert.equal(c.data.keys['fanglands.slot.3.at'], String(T - 5));
  assert.equal(c.data.keys['fanglands.slot.1.at'], KEYS['fanglands.slot.1.at']);
  assert.equal(c.data.keys['fanglands.slot.2'], '{"p":2}');
});

test('hand-over: an IPv6 address counts by its /64; an IPv4 address (and one written as IPv6) by itself', () => {
  assert.equal(addressOf('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(addressOf('2001:db8::2'), addressOf('2001:db8::1'));
  assert.equal(addressOf('2001:0db8:0000:0000:ffff:1:2:3'), addressOf('2001:db8::1'));
  assert.equal(addressOf('2001:db8:0:0:1::5'), '2001:db8:0:0::/64');
  assert.notEqual(addressOf('2001:db8:0:1::1'), addressOf('2001:db8::1'));
  assert.equal(addressOf('203.0.113.7'), '203.0.113.7');
  assert.equal(addressOf('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(addressOf(''), '?'); assert.equal(addressOf(null), '?');
});

test('hand-over: the per-address limit counts a whole IPv6 /64 as one, and each address has a byte budget waiting', async () => {
  const w = newWorld();
  // ten offers a minute across one home's /64, however many addresses it uses
  for (let i = 0; i < OFFERS_PER_MIN; i++) assert.equal((await offer(w, { 'fl_learn_bag': '1' }, { ip: '2001:db8::' + (i + 1).toString(16) })).status, 200);
  assert.equal((await offer(w, { 'fl_learn_bag': '1' }, { ip: '2001:db8::ff' })).status, 429);
  assert.equal((await offer(w, { 'fl_learn_bag': '1' }, { ip: '2001:db8:0:1::1' })).status, 200, 'the next /64 is another home');
  // the byte budget: big offers from one address stop at ADDRESS_BYTES_MAX waiting, with a 429 (not a 503 for everyone)
  const big = { 'fanglands.slot.1': 'x'.repeat(HANDOFF_MAX - 200) };
  const w2 = newWorld();
  const flood = async ip => { const out = []; for (let i = 0; i < 4; i++) out.push((await offer(w2, big, { ip })).status); return out; };
  assert.deepEqual(await flood('198.51.100.1'), [200, 200, 429, 429]);
  assert.deepEqual(await flood('2001:db8::1'), [200, 200, 429, 429]);
  assert.deepEqual(await flood('2001:db8::2'), [429, 429, 429, 429], 'the same /64 shares the budget');
  // two addresses at their limit cannot keep a third out
  assert.equal((await offer(w2, KEYS, { ip: '203.0.113.99' })).status, 200);
  const held = w2.db.prepare('SELECT SUM(bytes) AS b FROM handoffs').get().b;
  assert.ok(held <= 2 * ADDRESS_BYTES_MAX + 2000, 'held ' + held);
  // once the offers run out, the same address may offer again
  T += HANDOFF_MS + 1;
  assert.equal((await offer(w2, big, { ip: '198.51.100.1' })).status, 200);
  // which address offered is kept only as a SHA-256
  assert.ok(!JSON.stringify(rowsOf(w2)).includes('198.51.100.1'));
});

// ---------- the page scripts, run for real ----------
const flush = () => new Promise(r => setImmediate(r));
function clock() {
  let t = 0, id = 0; const q = [];
  return {
    setTimeout: (fn, ms) => { q.push({ at: t + (ms || 0), fn, id: ++id, live: true }); return id; },
    clearTimeout: x => { const e = q.find(e => e.id === x); if (e) e.live = false; },
    async run(until) {
      for (;;) {
        await flush(); await flush();
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
// answer(body, n) -> {status, json} | 'hang' (never answers until the page gives up on it).
async function runPage(res, { at, store = {}, broken = false, answer = () => ({ status: 503, json: { code: 'busy' } }), until = 30000 }) {
  const html = await res.text();
  const script = /<script nonce="[0-9a-f]{32}">\n([\s\S]*?)\n<\/script>/.exec(html)[1];
  const u = new URL(at), nav = [], calls = [], els = {};
  const el = id => els[id] || (els[id] = { id, style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } });
  const c = clock(), ls = storage(store, broken);
  const fetch = (url, opt) => {
    const body = JSON.parse(opt.body); calls.push({ url, body });
    const a = answer(body, calls.length);
    if (a === 'hang') return new Promise((_, no) => { if (opt.signal) opt.signal.addEventListener('abort', () => no(new Error('aborted'))); });
    return Promise.resolve({ ok: a.status === 200, status: a.status, json: async () => a.json });
  };
  const ctx = vm.createContext({
    location: { hash: u.hash, pathname: u.pathname, search: u.search, origin: u.origin, replace: x => nav.push(x) },
    localStorage: ls, fetch, setTimeout: c.setTimeout, clearTimeout: c.clearTimeout, AbortController, crypto: globalThis.crypto,
    document: { getElementById: el },
  });
  vm.runInContext(script, ctx);
  await c.run(until);
  return { nav, calls, els, store: ls.s, html };
}
const pageAt = (url, env) => worker.fetch(nav(url), env || fakeEnv().env);
const CODE = 'c'.repeat(64), EVIL = 'e'.repeat(64);
const OK = { status: 200, json: { code: CODE, expires: 1 } };

test('hand-over page: a #handoff fragment that arrived is never passed on, with nothing to hand over or after a failed offer', async () => {
  // nothing to hand over: straight across, path and query kept, the incoming code dropped
  let r = await runPage(await pageAt('https://gorkscape.ca/admin?x=1'), { at: 'https://gorkscape.ca/admin?x=1#handoff=' + EVIL });
  assert.deepEqual(r.nav, ['https://fanglands.com/admin?x=1']); assert.equal(r.calls.length, 0);
  for (const h of ['#handoff2=' + EVIL, '#handoff-pull=' + PULL, '#handoffzzz']) {
    r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/' + h });
    assert.deepEqual(r.nav, ['https://fanglands.com/'], h);
  }
  // any other fragment rides along
  r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/#castle' });
  assert.deepEqual(r.nav, ['https://fanglands.com/#castle']);
  // a kid's browser handed someone's link: it first asks the new address for a pull, and the code is not on the way
  r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/?online#handoff=' + EVIL, store: KEYS });
  assert.deepEqual(r.nav, ['https://fanglands.com/handoff#back=' + encodeURIComponent('/?online')]);
  assert.equal(r.calls.length, 0);
  // a kid's browser whose offers all fail never goes on with anyone's code, and never goes on by itself at all
  r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/#handoff-pull=' + PULL, store: KEYS, until: 60000 });
  assert.deepEqual(r.nav, []);
  assert.ok(!JSON.stringify(r).includes(EVIL));
});

test('hand-over page: with a pull it offers this browser\'s keys bound to it and goes on with the code after #', async () => {
  const store = Object.assign({ 'fanglands.handoff.seen': '{}', 'other.app': 'x' }, KEYS);
  let r = await runPage(await pageAt('https://test.gorkscape.ca/admin?tab=chat'), { at: 'https://test.gorkscape.ca/admin?tab=chat#handoff-pull=' + PULL, store, answer: () => OK });
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0].url, '/api/handoff/offer');
  assert.equal(r.calls[0].body.pull, PULL);
  assert.deepEqual(r.calls[0].body.keys, KEYS, 'every Fanglands key, never the hand-over\'s own notes or another app\'s');
  assert.deepEqual(r.nav, ['https://test.fanglands.com/admin?tab=chat#handoff=' + CODE]);
  // the second try (#handoff-pull2, after a lost answer) comes back as #handoff2, which never goes back again
  r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/#handoff-pull2=' + PULL, store: KEYS, answer: () => OK });
  assert.deepEqual(r.nav, ['https://fanglands.com/#handoff2=' + CODE]);
  // a pull that is not 32 hex: no offer, straight across with no code
  r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/#handoff-pull=xyz', store: KEYS, answer: () => OK });
  assert.deepEqual([r.nav, r.calls.length], [['https://fanglands.com/'], 0]);
});

test('hand-over page: a busy or slow world is tried three times; then the kid sees why, with Try again, and is never dropped without a word', async () => {
  // 503 then 429 then fine: lands with the code
  let n = 0;
  let r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/#handoff-pull=' + PULL, store: KEYS, answer: () => (++n < 3 ? { status: n === 1 ? 503 : 429, json: {} } : OK) });
  assert.deepEqual([r.calls.length, r.nav], [3, ['https://fanglands.com/#handoff=' + CODE]]);
  // an offer that hangs is given up after 7 s and tried again
  n = 0;
  r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/#handoff-pull=' + PULL, store: KEYS, answer: () => (++n === 1 ? 'hang' : OK) });
  assert.deepEqual([r.calls.length, r.nav], [2, ['https://fanglands.com/#handoff=' + CODE]]);
  // every try fails: no jump, the "One moment" line gives way to the stuck card with Try again (this page, no code)
  r = await runPage(await pageAt('https://gorkscape.ca/admin?x=1'), { at: 'https://gorkscape.ca/admin?x=1#handoff-pull=' + PULL, store: KEYS, answer: () => 'hang', until: 120000 });
  assert.equal(r.calls.length, 3);
  assert.deepEqual(r.nav, []);
  assert.equal(r.els.stuck.style.display, 'block');
  assert.equal(r.els.wait.style.display, 'none');
  assert.equal(r.els.again.attrs.href, '/admin?x=1');
  assert.equal(r.els.anyway.attrs.href, 'https://fanglands.com/admin?x=1');
  assert.match(r.html, /<p>Your knight could not come across to fanglands\.com just now\.<\/p>/);
  assert.match(r.html, /<a class="go" id="again" href="">Try again<\/a>/);
  assert.ok(!/Tap to go there/.test(r.html), 'no bare link that skips the hand-over while it is working');
});

test('start page: /handoff on a new address keeps a fresh pull here and goes back to the old address with it, to a plain path only', async () => {
  const { env, seen } = fakeEnv();
  const res = await worker.fetch(nav('https://fanglands.com/handoff#ignored'), env);
  assert.equal(res.status, 200); assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
  assert.equal(seen.assets.length, 0);
  const html = await res.text();
  const again = () => new Response(html, { headers: { 'content-type': 'text/html' } });
  let r = await runPage(again(), { at: 'https://fanglands.com/handoff#back=' + encodeURIComponent('/admin?x=1') });
  const kept = JSON.parse(r.store[PULL_KEY]);
  assert.match(kept.n, /^[0-9a-f]{32}$/);
  assert.deepEqual(r.nav, ['https://gorkscape.ca/admin?x=1#handoff-pull=' + kept.n]);
  // a pull still fresh is used again (two tabs at once both land); one about to run out is replaced
  r = await runPage(again(), { at: 'https://fanglands.com/handoff#back=%2F', store: { [PULL_KEY]: JSON.stringify({ n: PULL, at: Date.now() - 1000 }) } });
  assert.deepEqual(r.nav, ['https://gorkscape.ca/#handoff-pull=' + PULL]);
  r = await runPage(again(), { at: 'https://fanglands.com/handoff#back=%2F', store: { [PULL_KEY]: JSON.stringify({ n: PULL, at: Date.now() - PULL_MS }) } });
  assert.notEqual(JSON.parse(r.store[PULL_KEY]).n, PULL);
  // anything but a plain path on the old address becomes /
  for (const back of ['//evil.example/x', 'https://evil.example', '/\\evil.example', '/a b', 'admin', '%E0%A4%A', '/x#handoff=' + EVIL]) {
    r = await runPage(again(), { at: 'https://fanglands.com/handoff#back=' + (back.startsWith('%') ? back : encodeURIComponent(back)) });
    assert.match(r.nav[0], /^https:\/\/gorkscape\.ca\/#handoff-pull=[0-9a-f]{32}$/, back);
  }
  // storage off: nothing to bind to, straight into the game here
  r = await runPage(again(), { at: 'https://fanglands.com/handoff#back=' + encodeURIComponent('/?online'), broken: true });
  assert.deepEqual(r.nav, ['/?online']);
  // the test world goes back to its own old address; www sends to the bare address first; the old address has no start page
  const t = await worker.fetch(nav('https://test.fanglands.com/handoff'), env);
  r = await runPage(t, { at: 'https://test.fanglands.com/handoff#back=%2F' });
  assert.match(r.nav[0], /^https:\/\/test\.gorkscape\.ca\/#handoff-pull=/);
  assert.equal((await worker.fetch(nav('https://www.fanglands.com/handoff'), env)).status, 301);
  assert.match(await (await worker.fetch(nav('https://gorkscape.ca/handoff'), env)).text(), /handoff\/offer/);
  assert.equal((await worker.fetch(new Request('https://fanglands.com/handoff', { method: 'POST', body: 'x' }), env)).status, 302);
});
