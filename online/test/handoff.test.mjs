// Two addresses (docs/ONLINE.md, "Two addresses"): the front door on every address, the hand-over offer and claim in
// the World, and the page scripts run for real in a VM. Every rule the hand-over keeps has a test here (the rules the
// pages carry as text, what the landing writes and which knights are only on a device, are in handoff-merge.test.mjs):
// a login before anything (401 with the body unread), only the login and the settings, under 8 KB, per account at most
// 2 waiting and 30 an hour (refused before anything is read or kept), no row ever written, one use (also with two
// claims at once), a short life, a claim only with the pull the offer was bound to, only the game's own addresses, a
// home-screen icon that stays, a tab holding a knight only on its device that stays, any old path landing on the same
// path, www.gorkscape.ca as its own storage, and a card on every hop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/worker.js';
import vm from 'node:vm';
import {
  frontDoor, MOVES, HANDOFF_MS, HANDOFF_MAX, CLAIM_FAILS_PER_MIN, ACCT_WAITING_MAX, ACCT_PER_HOUR, WAITING_MAX, CARRY,
  PULL_KEY, ARRIVING_KEY, TRIES_KEY, STAY_COOKIE, HERE_COOKIE, HERE_SECS, addressOf, handoffCall,
} from '../src/handoff.js';

// ---------------------------------------------------------------------------
// The front door (worker.js + handoff.js frontDoor)
// ---------------------------------------------------------------------------
const MISSING = Symbol('no HANDOVER at all');
function fakeEnv(handover = 'on') {
  const seen = { assets: [], world: [] };
  const env = {
    ASSETS: { fetch: req => { seen.assets.push(req.url); return new Response('asset ' + new URL(req.url).pathname); } },
    WORLD: { idFromName: n => n, get: () => ({ fetch: req => { seen.world.push(req.url); const r = new Response(JSON.stringify({ world: new URL(req.url).pathname }), { headers: { 'content-type': 'application/json' } }); r.marker = 'world'; return r; } }) },
  };
  if (handover !== MISSING) env.HANDOVER = handover;
  return { env, seen };
}
const nav = (url, extra) => new Request(url, { headers: Object.assign({ 'sec-fetch-dest': 'document', accept: 'text/html,application/xhtml+xml' }, extra || {}) });
// the hand-over page itself navigating (location.replace) to a path on its own address
const own = (url, extra) => nav(url, Object.assign({ 'sec-fetch-site': 'same-origin' }, extra || {}));

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
  assert.equal(seen.assets.length, 0, 'no game page is served to an ordinary tab on an old address');
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

test('front door: a file on an old address is served there as before (a frame or a script is a file even when it accepts HTML); www.fanglands.com 301s to the bare address', async () => {
  const { env, seen } = fakeEnv();
  let res = await worker.fetch(new Request('https://gorkscape.ca/favicon.ico', { headers: { 'sec-fetch-dest': 'image' } }), env);
  assert.equal(await res.text(), 'asset /favicon.ico');
  for (const dest of ['iframe', 'frame', 'script', 'empty']) {
    res = await worker.fetch(new Request('https://test.gorkscape.ca/bridge.html?a=b', { headers: { 'sec-fetch-dest': dest, accept: 'text/html,*/*' } }), env);
    assert.equal(await res.text(), 'asset /bridge.html', dest);
  }
  res = await worker.fetch(nav('https://www.fanglands.com/admin?tab=chat'), env);
  assert.equal(res.status, 301); assert.equal(res.headers.get('location'), 'https://fanglands.com/admin?tab=chat');
  for (const u of ['https://fanglands.com/', 'https://fanglands.com/admin', 'https://test.fanglands.com/?online', 'http://localhost:8790/']) {
    res = await worker.fetch(nav(u), env);
    assert.equal(await res.text(), 'asset ' + new URL(u).pathname);
  }
  assert.equal(seen.assets.length, 9);
  assert.equal(frontDoor(nav('https://fanglands.com/'), new URL('https://fanglands.com/'), env), null);
});

test('front door: the switch fails closed: only HANDOVER exactly "on" hands over; off, missing or misspelled keeps the old addresses serving the game as before', async () => {
  for (const sw of ['off', MISSING, null, 'On', 'yes', '', 'on ']) {
    const { env, seen } = fakeEnv(sw);
    for (const host of Object.keys(MOVES)) {
      const res = await worker.fetch(nav('https://' + host + '/?online'), env);
      assert.equal(await res.text(), 'asset /', host + ' ' + String(sw));
    }
    assert.equal(seen.assets.length, 3);
    assert.equal((await worker.fetch(nav('https://www.fanglands.com/'), env)).status, 301);
    // the cookie paths still answer, so a home-screen icon or a kept tab never loops
    const leave = await worker.fetch(nav('https://gorkscape.ca/handoff-leave?to=%2F%3Fonline'), env);
    assert.deepEqual([leave.status, leave.headers.get('location')], [302, '/?online']);
  }
  const { env } = fakeEnv('on');
  assert.match(await (await worker.fetch(nav('https://gorkscape.ca/'), env)).text(), /handoff\/offer/);
});

test('the switch is committed state: HANDOVER lives in wrangler.toml [vars] above the routes (so every deploy, and the test world, carries it); deploy.sh refuses a tree without fanglands.com and checks both addresses answer afterwards', async () => {
  const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const routes = toml.indexOf('[[routes]]'), vars = toml.indexOf('\n[vars]\n'), sw = /\nHANDOVER = "(on|off)"\n/.exec(toml);
  assert.ok(vars > 0 && sw && sw.index > vars && sw.index < routes, 'HANDOVER = "on" or "off" in [vars], above the first [[routes]]');
  assert.ok(!/\n\[/.test(toml.slice(vars + 7, sw.index)), 'no other table between [vars] and the switch');
  for (const host of ['gorkscape.ca', 'www.gorkscape.ca', 'fanglands.com', 'www.fanglands.com']) assert.match(toml, new RegExp('\npattern = "' + host.replace(/\./g, '\\.') + '"\ncustom_domain = true'), host);
  const sh = readFileSync(new URL('../deploy.sh', import.meta.url), 'utf8');
  assert.ok(sh.indexOf(`grep -q '^pattern = "fanglands.com"$' online/wrangler.toml ||`) < sh.indexOf('./build.sh'), 'the guard runs before anything else');
  assert.match(sh, /curl -sf --max-time 10 "https:\/\/\$host\/api\/status"/);
  assert.match(sh, /for host in fanglands\.com gorkscape\.ca; do/);
  const { env } = fakeEnv(sw[1]);
  const page = await worker.fetch(nav('https://gorkscape.ca/'), env);
  assert.equal(/handoff\/offer/.test(await page.text()), sw[1] === 'on');
});

test('front door: a home-screen icon stays: /handoff-stay, asked by the old address\'s own page, sets the cookie for a year, and with it the old address serves the game on every path, as today', async () => {
  const { env, seen } = fakeEnv();
  const res = await worker.fetch(own('https://gorkscape.ca/handoff-stay?to=' + encodeURIComponent('/admin?x=1')), env);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/admin?x=1');
  const c = res.headers.get('set-cookie');
  assert.match(c, new RegExp('^' + STAY_COOKIE + '=1; Max-Age=\\d+; Path=/; Secure; SameSite=Lax$'));
  assert.ok(+/Max-Age=(\d+)/.exec(c)[1] >= 365 * 86400);
  assert.ok(!/HttpOnly/i.test(c), 'the game reads it, so it can clear it in an ordinary tab');
  for (const u of ['https://gorkscape.ca/', 'https://www.gorkscape.ca/?online', 'https://gorkscape.ca/admin', 'https://test.gorkscape.ca/favicon.ico']) {
    const r = await worker.fetch(nav(u, { cookie: 'a=b; ' + STAY_COOKIE + '=1' }), env);
    assert.equal(await r.text(), 'asset ' + new URL(u).pathname, u);
  }
  assert.equal(seen.assets.length, 4);
  for (const cookie of [STAY_COOKIE + '=0', 'x' + STAY_COOKIE + '=1', '']) {
    const r = await worker.fetch(nav('https://gorkscape.ca/', { cookie }), env);
    assert.match(await r.text(), /handoff\/offer/, cookie);
  }
  const leave = await worker.fetch(nav('https://gorkscape.ca/handoff-leave?to=%2F'), env);
  assert.match(leave.headers.get('set-cookie'), new RegExp('^' + STAY_COOKIE + '=; Max-Age=0; Path=/'));
  for (const to of ['//evil.example/x', 'https://evil.example', '/\\evil.example', 'admin', '/a b']) {
    const r = await worker.fetch(own('https://gorkscape.ca/handoff-stay?to=' + encodeURIComponent(to)), env);
    assert.equal(r.headers.get('location'), '/', to);
  }
  assert.equal(await (await worker.fetch(nav('https://fanglands.com/handoff-stay'), env)).text(), 'asset /handoff-stay');
});

test('front door: a link from anywhere else can never set either cookie (it just goes to the path); an older browser that does not say where it came from is believed', async () => {
  const { env } = fakeEnv();
  for (const path of ['/handoff-stay', '/handoff-here']) {
    for (const site of ['cross-site', 'same-site', 'none']) {
      const r = await worker.fetch(nav('https://gorkscape.ca' + path + '?to=%2Fadmin', { 'sec-fetch-site': site }), env);
      assert.deepEqual([r.status, r.headers.get('location'), r.headers.get('set-cookie')], [302, '/admin', null], path + ' ' + site);
    }
    const old = await worker.fetch(nav('https://gorkscape.ca' + path + '?to=%2F'), env);
    assert.match(old.headers.get('set-cookie') || '', /=1; Max-Age=/, path);
  }
});

test('front door: a tab the hand-over page keeps on the old address (a knight only on its device) gets the game for one load: /handoff-here sets a one-minute cookie the game clears', async () => {
  const { env } = fakeEnv();
  const res = await worker.fetch(own('https://www.gorkscape.ca/handoff-here?to=' + encodeURIComponent('/?online')), env);
  assert.deepEqual([res.status, res.headers.get('location')], [302, '/?online']);
  const c = res.headers.get('set-cookie');
  assert.equal(c, HERE_COOKIE + '=1; Max-Age=' + HERE_SECS + '; Path=/; Secure; SameSite=Lax');
  assert.ok(HERE_SECS <= 60);
  const r = await worker.fetch(nav('https://www.gorkscape.ca/?online', { cookie: HERE_COOKIE + '=1' }), env);
  assert.equal(await r.text(), 'asset /');
  assert.match(await (await worker.fetch(nav('https://www.gorkscape.ca/', { cookie: HERE_COOKIE + '=' }), env)).text(), /handoff\/offer/);
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
// The World's side on node's SQLite. Every statement is counted: a hand-over may read the login and nothing else.
// ---------------------------------------------------------------------------
function sqlOf(db, log) {
  return {
    exec(q, ...args) {
      const stmt = db.prepare(q);
      const columnNames = stmt.columns().map(c => c.name);
      let rows = [], rowsWritten = 0;
      if (columnNames.length) rows = stmt.all(...args).map(r => Object.assign({}, r));
      else rowsWritten = stmt.run(...args).changes;
      log.push({ q, rowsWritten, write: !columnNames.length });
      return { toArray: () => rows.slice(), one: () => rows[0], rowsWritten, columnNames, [Symbol.iterator]: () => rows[Symbol.iterator]() };
    },
  };
}
globalThis.WebSocketRequestResponsePair = globalThis.WebSocketRequestResponsePair || class { constructor(a, b) { this.a = a; this.b = b; } };
const { World, SIGNUPS_PER_HOUR } = await import('../src/world.js');
let T = 1759500000000;
class TestWorld extends World { now() { return T; } }
const ENV = { ADMIN_KEY: 'test-admin', INVITE_CODE: 'TEST-1234' };
function newWorld() {
  const db = new DatabaseSync(':memory:'), log = [];
  const ctx = { storage: { sql: sqlOf(db, log), setAlarm: async () => { } }, setWebSocketAutoResponse() { }, acceptWebSocket() { }, getWebSockets: () => [] };
  const w = new TestWorld(ctx, ENV); w.db = db; w.log = log;
  return w;
}
// a knight the world knows, with a live login; returns the token
function account(w, name, { expires = T + 86400000, banned = 0 } = {}) {
  const lc = name.toLowerCase(), token = Buffer.from(lc.padEnd(32, '.')).toString('hex').slice(0, 64);
  w.db.prepare('INSERT OR IGNORE INTO accounts (name_lc, name, salt, hash, created, last_seen, banned) VALUES (?, ?, ?, ?, ?, ?, ?)').run(lc, name, 's', 'h', T, T, banned);
  w.db.prepare('INSERT INTO sessions (token, name_lc, expires) VALUES (?, ?, ?)').run(token, lc, expires);
  return token;
}
// as a browser sends it: the size of the body in content-length, and the login as a Bearer token
async function post(w, url, body, { origin, ip = '203.0.113.7', raw, auth } = {}) {
  const u = new URL(url);
  const headers = { 'content-type': 'application/json', 'cf-connecting-ip': ip };
  if (origin !== null) headers.origin = origin || ('https://' + u.hostname);
  if (auth) headers.authorization = 'Bearer ' + auth;
  const text = raw !== undefined ? raw : JSON.stringify(body);
  if (typeof text === 'string') headers['content-length'] = String(Buffer.byteLength(text));
  const res = await w.fetch(new Request(url, { method: 'POST', headers, body: text }));
  let data = null; try { data = await res.json(); } catch (e) { }
  return { status: res.status, data };
}
const PULL = '0123456789abcdef0123456789abcdef';   // the pull this browser's addresses keep
// the hand-over page sends the login it carries as the Bearer token (opts.auth: another token, or null for none)
const offer = (w, keys, opts, host = 'gorkscape.ca') => post(w, 'https://' + host + '/api/handoff/offer', { keys, pull: (opts && opts.pull) || PULL },
  Object.assign({}, opts, { auth: opts && opts.auth !== undefined ? opts.auth : (keys && typeof keys === 'object' && typeof keys['fanglands.session'] === 'string' ? keys['fanglands.session'] : undefined) }));
const claim = (w, code, opts, host = 'fanglands.com') => post(w, 'https://' + host + '/api/handoff/claim', { code, pull: (opts && opts.pull) || PULL }, opts);
const waiting = w => (w.handoff ? w.handoff.offers.size : 0);
const keysOf = tok => ({
  'fanglands.session': tok, 'fanglands.lastname': 'Cohen', 'fanglands.settings': '{"kid":true,"text":"large","stick":"right"}',
  'fanglands.muted': '1', 'fanglands.music': '0', 'fanglands.kidmode': '1', 'fl_learn_bag': '2', 'fl_coach_swing': '1',
});
// a request whose body must never be read
function unread(url, { ip = '203.0.113.50', auth, length } = {}) {
  const u = new URL(url);
  const headers = new Headers({ 'content-type': 'application/json', 'cf-connecting-ip': ip, origin: 'https://' + u.hostname });
  if (auth) headers.set('authorization', 'Bearer ' + auth);
  if (length != null) headers.set('content-length', String(length));
  const req = { method: 'POST', url, headers, reads: 0 };
  req.text = async () => { req.reads++; throw new Error('the body was read'); };
  req.json = req.text; req.arrayBuffer = req.text;
  return req;
}
async function call(w, req) {
  const url = new URL(req.url);
  try { const r = await handoffCall(w, req, url, url.pathname, 'POST'); return r.status; } catch (e) { return e.status || ('threw: ' + e.message); }
}

test('hand-over: an offer of the login and settings gets a 256-bit code and the account it is for; the claim on the new address gets exactly those keys, once, and which old address offered them', async () => {
  const w = newWorld();
  const tok = account(w, 'Cohen');
  const o = await offer(w, keysOf(tok));
  assert.equal(o.status, 200);
  assert.match(o.data.code, /^[0-9a-f]{64}$/);
  assert.equal(o.data.name, 'cohen');
  assert.equal(o.data.expires, T + HANDOFF_MS);
  assert.ok(HANDOFF_MS <= 3 * 60 * 1000, 'a short life');
  const c = await claim(w, o.data.code);
  assert.equal(c.status, 200);
  assert.deepEqual(c.data, { keys: keysOf(tok), from: 'gorkscape.ca' });
  assert.equal((await claim(w, o.data.code)).status, 404, 'one use');
  const o2 = await offer(w, keysOf(tok), {}, 'www.gorkscape.ca');
  assert.equal((await claim(w, o2.data.code)).data.from, 'www.gorkscape.ca');
});

test('hand-over: no login, no hand-over: no Bearer token, one the world does not know, run out or banned is 401 from the headers alone, its body never read', async () => {
  const w = newWorld();
  const tok = account(w, 'Cohen'), old = account(w, 'Gone', { expires: T - 1 }), banned = account(w, 'Bad', { banned: 1 });
  for (const auth of [undefined, 'b'.repeat(64), old, banned, 'not hex at all', 'Bearer']) {
    const req = unread('https://gorkscape.ca/api/handoff/offer', { auth, length: 100 });
    assert.deepEqual([await call(w, req), req.reads], [401, 0], String(auth));
  }
  const r = await offer(w, { 'fanglands.settings': '{}' }, { auth: null });
  assert.deepEqual([r.status, r.data.code], [401, 'login']);
  assert.equal(waiting(w), 0);
  assert.equal((await offer(w, keysOf(tok))).status, 200);
});

test('hand-over: only the login, the last name, the settings and the hint counters: a save slot, an owner note, the parent page\'s key or anything else is refused, and every value is a string', async () => {
  const w = newWorld();
  const tok = account(w, 'Cohen');
  for (const k of CARRY) assert.ok(/^fanglands\.(session|lastname|settings|muted|music|kidmode)$/.test(k), k);
  assert.equal((await offer(w, keysOf(tok))).status, 200);
  for (const extra of ['fanglands.slot.1', 'fanglands.slot.2', 'fanglands.slot.2.at', 'fanglands.slot.1.online', 'fanglands.slot.1.synced', 'fanglands.save.v2', 'fanglands.slot.current',
    'fanglands.brought', 'fanglands.dk.kept', 'fanglands.adminKey', 'fanglands.handoff.pull', 'fl_learn_', 'fl_other_x', 'evil', '__proto__']) {
    const raw = '{"keys":' + JSON.stringify(keysOf(tok)).slice(0, -1) + ',' + JSON.stringify(extra) + ':"{\\"player\\":{}}"},"pull":"' + PULL + '"}';
    const r = await post(w, 'https://gorkscape.ca/api/handoff/offer', null, { raw, auth: tok });
    assert.deepEqual([r.status, r.data.code], [400, 'bad'], extra);
  }
  assert.equal((await offer(w, Object.assign(keysOf(tok), { 'fanglands.settings': { kid: true } }))).status, 400);
  assert.equal((await offer(w, Object.assign(keysOf(tok), { 'fanglands.session': account(w, 'Sam') }), { auth: tok })).status, 400, 'the login in the keys is the one sent');
  assert.equal((await offer(w, { 'fanglands.lastname': 'Cohen' }, { auth: tok })).status, 400, 'and it is in the keys');
  for (const pull of [undefined, '', 'xyz', 'A'.repeat(32), 'a'.repeat(64)]) {
    const r = await post(w, 'https://gorkscape.ca/api/handoff/offer', { keys: keysOf(tok), pull }, { auth: tok });
    assert.equal(r.status, 400, String(pull));
  }
});

test('hand-over: a hard cap of 8 KB: a bigger offer is refused by the size it says (unread) and by the size it is', async () => {
  const w = newWorld();
  const tok = account(w, 'Cohen');
  assert.equal(HANDOFF_MAX, 8192);
  const req = unread('https://gorkscape.ca/api/handoff/offer', { auth: tok, length: HANDOFF_MAX + 201 });
  assert.deepEqual([await call(w, req), req.reads], [413, 0]);
  const fat = Object.assign(keysOf(tok), { 'fanglands.settings': 'x'.repeat(HANDOFF_MAX) });
  assert.equal((await offer(w, fat)).status, 413);
  const lying = JSON.stringify({ keys: fat, pull: PULL });
  const r = await w.fetch(new Request('https://gorkscape.ca/api/handoff/offer', { method: 'POST', headers: { origin: 'https://gorkscape.ca', authorization: 'Bearer ' + tok, 'content-length': '50' }, body: lying }));
  assert.equal(r.status, 413);
  assert.equal(waiting(w), 0);
});

test('hand-over: per account at most ACCT_WAITING_MAX wait (the newest replaces the oldest), apart from every other account', async () => {
  const w = newWorld();
  const tok = account(w, 'Cohen'), sam = account(w, 'Sam');
  assert.equal(ACCT_WAITING_MAX, 2);
  const codes = [];
  for (let i = 0; i < 4; i++) codes.push((await offer(w, keysOf(tok))).data.code);
  const s = await offer(w, keysOf(sam));
  assert.equal(waiting(w), 3);
  assert.equal((await claim(w, codes[0])).status, 404); assert.equal((await claim(w, codes[1])).status, 404);
  assert.equal((await claim(w, codes[2])).status, 200); assert.equal((await claim(w, codes[3])).status, 200);
  assert.equal((await claim(w, s.data.code)).status, 200, 'another account\'s offer is never touched');
});

test('hand-over: per account ACCT_PER_HOUR offers an hour; one past it is refused before its body is read and before anything is kept, another account is not held up, and an hour on it may again', async () => {
  const w = newWorld();
  const tok = account(w, 'Cohen'), sam = account(w, 'Sam');
  assert.equal(ACCT_PER_HOUR, 30);
  for (let i = 0; i < ACCT_PER_HOUR; i++) assert.equal((await offer(w, keysOf(tok), { ip: '10.0.0.' + i })).status, 200, 'offer ' + i);
  const before = waiting(w), wrote = w.log.filter(e => e.write).length;
  const req = unread('https://gorkscape.ca/api/handoff/offer', { auth: tok, length: 300 });
  assert.deepEqual([await call(w, req), req.reads], [429, 0]);
  const r = await offer(w, keysOf(tok));
  assert.deepEqual([r.status, r.data.code], [429, 'wait']);
  assert.ok(r.data.wait > 0 && r.data.wait <= 3600);
  assert.equal(waiting(w), before, 'nothing kept');
  assert.equal(w.log.filter(e => e.write).length, wrote, 'nothing written');
  assert.equal((await offer(w, keysOf(sam))).status, 200);
  T += 3600000;
  assert.equal((await offer(w, keysOf(tok))).status, 200);
});

test('hand-over: the free plan: a hand-over writes NO row, ever (offers, claims, refusals, a full hour at the cap); the only statement it runs is one read of the login', async () => {
  const w = newWorld();
  const tok = account(w, 'Cohen');
  w.log.length = 0;
  for (let i = 0; i < ACCT_PER_HOUR + 5; i++) { const o = await offer(w, keysOf(tok)); if (o.status === 200 && i % 2) await claim(w, o.data.code); }
  await claim(w, 'c'.repeat(64)); await claim(w, 'nope'); await offer(w, keysOf('b'.repeat(64)));
  await post(w, 'https://gorkscape.ca/api/handoff/claim', { code: 'x' });
  T += HANDOFF_MS + 1; await claim(w, 'd'.repeat(64));
  // the request meter (meter.js) counts every call to the World, a hand-over's too, in its own rows every 10 s: not the hand-over's
  const mine = w.log.filter(e => !/req_meter/.test(e.q));
  assert.deepEqual(mine.filter(e => e.write || e.rowsWritten), [], 'no write');
  assert.ok(mine.length > 0 && mine.every(e => /^SELECT s\.name_lc AS lc FROM sessions s JOIN accounts a/.test(e.q)), mine.map(e => e.q).join('\n'));
  assert.ok(!w.db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'handoff%'").all().length, 'no table for it');
});

test('hand-over: the World\'s room is capped (WAITING_MAX offers at once in memory): past it, 503 before the body is read', async () => {
  const w = newWorld();
  const tok = account(w, 'Cohen');
  await offer(w, keysOf(tok));
  for (let i = 0; i < WAITING_MAX; i++) w.handoff.offers.set('fill' + i, { bind: 'x', text: '{}', acct: 'x' + i, src: 'gorkscape.ca', expires: T + HANDOFF_MS });
  const req = unread('https://gorkscape.ca/api/handoff/offer', { auth: tok, length: 300 });
  assert.deepEqual([await call(w, req), req.reads], [503, 0]);
  T += HANDOFF_MS;
  assert.equal((await offer(w, keysOf(tok))).status, 200, 'the room comes back as offers run out');
  assert.equal(waiting(w), 1);
});

test('hand-over: a code that ran out is refused by the claim itself; a made-up or broken code gets the same answer; claims that find nothing are limited per address, but a real code always lands', async () => {
  const w = newWorld();
  const tok = account(w, 'Cohen');
  const o = await offer(w, keysOf(tok));
  T += HANDOFF_MS;
  assert.deepEqual([(await claim(w, o.data.code)).status], [404]);
  for (const code of ['c'.repeat(64), 'x', '', 'C'.repeat(64)]) assert.equal((await claim(w, code, { ip: '198.51.100.9' })).data.code, 'gone');
  for (let i = 0; i < CLAIM_FAILS_PER_MIN; i++) await claim(w, 'e'.repeat(64), { ip: '198.51.100.10' });
  const r = await claim(w, 'e'.repeat(64), { ip: '198.51.100.10' });
  assert.deepEqual([r.status, r.data.code], [429, 'wait']);
  const real = await offer(w, keysOf(tok));
  assert.equal((await claim(w, real.data.code, { ip: '198.51.100.10' })).status, 200);
});

test('hand-over: one use even with two claims at once: exactly one gets the keys', async () => {
  const w = newWorld();
  const o = await offer(w, keysOf(account(w, 'Cohen')));
  const both = await Promise.all([claim(w, o.data.code), claim(w, o.data.code)]);
  assert.deepEqual(both.map(r => r.status).sort(), [200, 404]);
});

test('hand-over: a claim must bring the pull the offer was bound to; any other pull is refused and does NOT use the code up', async () => {
  const w = newWorld();
  const o = await offer(w, keysOf(account(w, 'Cohen')));
  for (const pull of ['f'.repeat(32), 'ffff', '', 'F'.repeat(32), PULL + '0']) {
    const r = await post(w, 'https://fanglands.com/api/handoff/claim', { code: o.data.code, pull }, { ip: '203.0.113.5' });
    assert.deepEqual([r.status, r.data.code], [404, 'gone'], 'pull ' + pull.length);
  }
  assert.equal(waiting(w), 1);
  assert.equal((await claim(w, o.data.code)).status, 200);
});

test('hand-over: only the game\'s own addresses: offers from an old one, claims on a new one, each with its own Origin', async () => {
  const w = newWorld();
  const tok = account(w, 'Cohen');
  for (const [host, origin] of [['fanglands.com', null], ['gorkscape.ca', 'https://evil.example'], ['gorkscape.ca', null], ['gorkscape.ca', 'https://fanglands.com'], ['evil.example', undefined]]) {
    const r = await offer(w, keysOf(tok), { origin }, host);
    assert.deepEqual([r.status, r.data.code], [403, 'origin'], host + ' ' + origin);
  }
  const o = await offer(w, keysOf(tok));
  for (const [host, origin] of [['gorkscape.ca', undefined], ['fanglands.com', 'https://gorkscape.ca'], ['fanglands.com', null]]) {
    assert.equal((await claim(w, o.data.code, { origin }, host)).status, 403, host);
  }
  assert.equal((await claim(w, o.data.code, {}, 'test.fanglands.com')).status, 200);
  const r = await w.fetch(new Request('https://gorkscape.ca/api/handoff/offer', { headers: { origin: 'https://gorkscape.ca' } }));
  assert.equal(r.status, 405);
  assert.equal((await post(w, 'https://gorkscape.ca/api/handoff/other', {})).status, 404);
});

test('hand-over: the backup export never carries a hand-over; the world writes nothing to its logs while handing over', async () => {
  const w = newWorld();
  const tok = account(w, 'Cohen');
  await offer(w, keysOf(tok));
  const ex = await w.fetch(new Request('https://fanglands.com/api/admin/export', { headers: { authorization: 'Bearer ' + ENV.ADMIN_KEY } }));
  assert.equal(ex.status, 200);
  const dump = await ex.json();
  assert.ok(!JSON.stringify(dump).includes('"fanglands.settings"'));
  const said = [];
  const was = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  for (const k of Object.keys(was)) console[k] = (...a) => said.push(a.map(String).join(' '));
  try {
    const o = await offer(w, keysOf(tok));
    await claim(w, o.data.code); await claim(w, o.data.code); await claim(w, 'x');
    await offer(w, { evil: 'x' }, { auth: tok });
  } finally { Object.assign(console, was); }
  assert.deepEqual(said, []);
});

test('hand-over: an IPv6 address counts by its /48; an IPv4 address (and one written as IPv6) by itself', () => {
  assert.equal(addressOf('2001:db8:1:2:3:4:5:6'), '2001:db8:1::/48');
  assert.equal(addressOf('2001:db8:1::9'), '2001:db8:1::/48');
  assert.equal(addressOf('2001:DB8:0001:ffff::'), '2001:db8:1::/48');
  assert.equal(addressOf('::ffff:198.51.100.4'), '198.51.100.4');
  assert.equal(addressOf('198.51.100.4'), '198.51.100.4');
  assert.equal(addressOf(''), '?');
});

// ---------------------------------------------------------------------------
// Signup: SIGNUPS_PER_HOUR new accounts an hour per address, both checks proved
// ---------------------------------------------------------------------------
test('signup: one address may make only SIGNUPS_PER_HOUR new accounts an hour (an IPv6 address by its /48); the refusal says the hour (429 signups); a wrong invite code is not counted; another place is not held up', async () => {
  const w = newWorld();
  const signup = (name, ip) => post(w, 'https://gorkscape.ca/api/signup', { name, pass: 'word1', invite: 'TEST-1234' }, { ip });
  const got = [];
  for (let i = 0; i < 30; i++) got.push((await signup('Many' + i, i % 2 ? '2001:db8:5:' + i.toString(16) + '::1' : '2001:db8:5::' + i.toString(16))).status);
  assert.equal(got.filter(s => s === 200).length, SIGNUPS_PER_HOUR);
  assert.equal(got.filter(s => s === 429).length, 30 - SIGNUPS_PER_HOUR);
  const r = await signup('Many70', '2001:db8:5::99');
  assert.deepEqual([r.status, r.data.code], [429, 'signups']);
  assert.ok(r.data.wait > 0 && r.data.wait <= 3600);
  assert.equal((await signup('Cohen', '198.51.100.5')).status, 200);
  const w2 = newWorld();
  for (let i = 0; i < 20; i++) assert.equal((await post(w2, 'https://fanglands.com/api/signup', { name: 'Kid' + i, pass: 'word1', invite: 'nope' }, { ip: '198.51.100.8' })).status, 403);
  assert.equal((await post(w2, 'https://fanglands.com/api/signup', { name: 'Kid', pass: 'word1', invite: 'test-1234' }, { ip: '198.51.100.8' })).status, 200);
  T += 3600000;
  assert.equal((await signup('Later', '2001:db8:5::7')).status, 200, 'an hour on, the place may again');
});

test('signup: past the hour\'s limit a signup is refused before its body is read (no secret word hashed)', async () => {
  const w = newWorld();
  for (let i = 0; i < SIGNUPS_PER_HOUR; i++) assert.equal((await post(w, 'https://fanglands.com/api/signup', { name: 'Pre' + i, pass: 'word1', invite: 'TEST-1234' }, { ip: '198.51.100.30' })).status, 200);
  const req = unread('https://fanglands.com/api/signup', { ip: '198.51.100.30', length: 80 });
  let status; try { await w.signup(req); } catch (e) { status = e.status; }
  assert.deepEqual([status, req.reads], [429, 0]);
});

test('signup: signups from one place at the same moment cannot all slip past the count (it is checked again where it is counted, with nothing waiting between)', async () => {
  const w = newWorld();
  const all = await Promise.all(Array.from({ length: 25 }, (_, i) => post(w, 'https://fanglands.com/api/signup', { name: 'Same' + i, pass: 'word1', invite: 'TEST-1234' }, { ip: '198.51.100.31' })));
  assert.equal(all.filter(r => r.status === 200).length, SIGNUPS_PER_HOUR);
  assert.ok(all.filter(r => r.status === 429).every(r => r.data.code === 'signups'));
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
    // busy(): a real answer is still on its way (a World doing real work); the fake clock waits for it, so a loaded
    // computer never makes a page time out
    async run(until, busy = () => false) {
      for (;;) {
        for (let i = 0; i < 6 || (busy() && i < 100000); i++) await flush();
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
// answer(url, body, n, headers) -> {status, json} | 'hang' | a Promise of either | a thrown network error ('down').
async function runPage(res, { at, store = {}, session = {}, broken = false, standalone = false, answer = () => ({ status: 503, json: { code: 'busy' } }), until = 30000 }) {
  const html = await res.text();
  const script = /<script nonce="[0-9a-f]{32}">\n([\s\S]*?)\n<\/script>/.exec(html)[1];
  const u = new URL(at), navs = [], calls = [], els = {}, hist = [];
  const el = id => els[id] || (els[id] = { id, hidden: true, attrs: {}, textContent: '', setAttribute(k, v) { this.attrs[k] = v; } });
  const c = clock(), ls = storage(store, broken), ss = storage(session);
  let pending = 0;
  const fetch = (url, opt) => {
    const body = JSON.parse(opt.body); calls.push({ url, body, at: c.now(), headers: Object.assign({}, opt.headers) });
    let a;
    try { a = answer(url, body, calls.length, opt.headers || {}); } catch (e) { return Promise.reject(e); }
    if (a === 'down') return Promise.reject(new TypeError('Load failed'));
    if (a === 'hang') return new Promise((_, no) => { if (opt.signal) opt.signal.addEventListener('abort', () => no(new Error('aborted'))); });
    pending++;
    return Promise.resolve(a).finally(() => pending--).then(a => ({ ok: a.status === 200, status: a.status, json: async () => a.json }));
  };
  const ctx = vm.createContext({
    location: { hash: u.hash, pathname: u.pathname, search: u.search, origin: u.origin, hostname: u.hostname, replace: x => navs.push({ to: x, at: c.now() }) },
    history: { replaceState: (s, t, url) => hist.push(url) },
    navigator: { standalone: standalone === 'ios' ? true : undefined },
    matchMedia: q => ({ matches: (standalone === 'pwa' && q === '(display-mode: standalone)') || (standalone === 'fullscreen' && q === '(display-mode: fullscreen)') }),
    localStorage: ls, sessionStorage: ss, fetch, setTimeout: c.setTimeout, clearTimeout: c.clearTimeout, AbortController, crypto: globalThis.crypto,
    document: { getElementById: el }, unescape, encodeURIComponent, decodeURIComponent, Uint8Array, JSON, Math, Date,
  });
  ctx.window = ctx;
  vm.runInContext(script, ctx);
  await c.run(until, () => pending > 0);
  return { nav: navs.map(n => n.to), navs, calls, els, store: ls.s, session: ss.s, hist, html, shown: id => !!els[id] && els[id].hidden === false };
}
const pageAt = (url, env, extra) => worker.fetch(nav(url, extra), env || fakeEnv().env);
const CODE = 'c'.repeat(64), EVIL = 'e'.repeat(64), TOK = 'a'.repeat(64);
const OK = { status: 200, json: { code: CODE, expires: 1, name: 'cohen' } };
const FRESH = () => JSON.stringify({ n: PULL, at: Date.now() - 1000 });
const fp = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36) + '.' + s.length; };
const KNIGHT = '{"player":{"playSeconds":500,"level":7}}', OTHER = '{"player":{"playSeconds":40,"level":2}}';
// a browser on the old address the way feat/no-play-alone leaves it: logged in as Cohen, slot 1 his cloud copy (owner
// and synced notes), the settings and hints. Nothing in it is only on this device.
const SYNCED = {
  'fanglands.session': TOK, 'fanglands.lastname': 'Cohen',
  'fanglands.slot.1': KNIGHT, 'fanglands.slot.1.at': '500', 'fanglands.slot.1.online': 'cohen', 'fanglands.slot.1.synced': 'cohen|' + fp(KNIGHT), 'fanglands.slot.current': '1',
  'fanglands.settings': '{"kid":true,"text":"large"}', 'fanglands.kidmode': '1', 'fl_learn_bag': '3',
};

test('hand-over page: opened from a home-screen icon (an installed web app) it never goes anywhere else: it stays, with no offer and no card; desktop browser fullscreen is not an installed app', async () => {
  for (const standalone of ['ios', 'pwa']) {
    const r = await runPage(await pageAt('https://gorkscape.ca/admin?x=1'), { at: 'https://gorkscape.ca/admin?x=1', store: SYNCED, standalone, answer: () => OK });
    assert.deepEqual(r.nav, ['/handoff-stay?to=' + encodeURIComponent('/admin?x=1')], standalone);
    assert.equal(r.calls.length, 0);
    assert.ok(!r.shown('card'));
  }
  let r = await runPage(await pageAt('https://www.gorkscape.ca/'), { at: 'https://www.gorkscape.ca/#handoff-pull=' + PULL, store: SYNCED, standalone: 'ios' });
  assert.deepEqual(r.nav, ['/handoff-stay?to=%2F']);
  r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/#castle', standalone: 'ios' });
  assert.deepEqual(r.nav, ['/handoff-stay?to=%2F#castle']);
  r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/', standalone: 'fullscreen' });
  assert.deepEqual(r.nav, ['https://fanglands.com/'], 'F11 on a laptop is an ordinary tab');
});

test('hand-over page: no login and no save: a plain redirect to the same path, no card, nothing offered (settings alone stay behind); a #handoff fragment is never passed on and leaves the history', async () => {
  let r = await runPage(await pageAt('https://gorkscape.ca/admin?x=1'), { at: 'https://gorkscape.ca/admin?x=1#handoff-pull=' + PULL, store: { 'fanglands.settings': '{"kid":true}', 'fanglands.slot.3': 'not a save' } });
  assert.deepEqual(r.nav, ['https://fanglands.com/admin?x=1']); assert.equal(r.calls.length, 0);
  assert.deepEqual(r.hist, ['/admin?x=1']);
  assert.ok(!r.shown('card'));
  r = await runPage(await pageAt('https://www.gorkscape.ca/a/b?c=1'), { at: 'https://www.gorkscape.ca/a/b?c=1#castle' });
  assert.deepEqual(r.nav, ['https://fanglands.com/a/b?c=1#castle']);
  r = await runPage(await pageAt('https://gorkscape.ca//evil.example'), { at: 'https://gorkscape.ca//evil.example' });
  assert.deepEqual(r.nav, ['https://fanglands.com/']);
});

test('hand-over page: a knight here that is not on the server stays: /handoff-here (the game right here, with its note), no offer, no card; logged out with any save, or logged in with a knight no account owns, or one ahead of the cloud', async () => {
  const cases = {
    'logged out, a save': { 'fanglands.slot.2': OTHER },
    'logged out, the old single save the game would still make slot 1': { 'fanglands.save.v2': OTHER },
    'logged out, even a cloud copy (no login: nothing is known to be on the server)': Object.assign({}, SYNCED, { 'fanglands.session': undefined }),
    'logged in, a knight with no owner beside the cloud copy': Object.assign({}, SYNCED, { 'fanglands.slot.2': OTHER }),
    'logged in, his own copy ahead of the cloud\'s (offline progress)': Object.assign({}, SYNCED, { 'fanglands.slot.5': '{"player":{"playSeconds":900}}', 'fanglands.slot.5.online': 'cohen' }),
    'logged in, slot 1 changed since the world confirmed it': Object.assign({}, SYNCED, { 'fanglands.slot.1': '{"player":{"playSeconds":510}}' }),
    'logged in, master\'s old mark only (before no-play-alone: nothing is known to be in the cloud)': { 'fanglands.session': TOK, 'fanglands.slot.1': KNIGHT, 'fanglands.slot.1.online': '1' },
  };
  for (const [what, st] of Object.entries(cases)) {
    for (const k of Object.keys(st)) if (st[k] === undefined) delete st[k];
    const r = await runPage(await pageAt('https://gorkscape.ca/?online'), { at: 'https://gorkscape.ca/?online#castle', store: Object.assign({ [PULL_KEY]: FRESH() }, st), answer: () => OK });
    assert.deepEqual(r.nav, ['/handoff-here?to=' + encodeURIComponent('/?online') + '#castle'], what);
    assert.equal(r.calls.length, 0, what);
    assert.ok(!r.shown('card'), what);
    assert.equal(r.store['fanglands.slot.2'], st['fanglands.slot.2'], 'nothing here is touched');
  }
});

test('hand-over page: a login with nothing only here: the first time it fetches a pull from the new address (www.gorkscape.ca has its own storage)', async () => {
  const r = await runPage(await pageAt('https://www.gorkscape.ca/admin'), { at: 'https://www.gorkscape.ca/admin', store: SYNCED });
  assert.deepEqual(r.nav, ['https://fanglands.com/handoff#back=%2Fadmin&from=www.gorkscape.ca']);
  assert.equal(r.calls.length, 0);
  assert.ok(r.shown('card'));
});

test('hand-over page: with a pull it offers ONLY the login, the last name and the settings (never a slot, an owner note or the parent page\'s key), the login as a Bearer token too, and goes to the landing page with the code', async () => {
  const store = Object.assign({ 'fanglands.adminKey': 'k', 'fanglands.dk.kept': '[]', 'fanglands.slot.4': OTHER, 'fanglands.slot.4.online': 'cohen', 'fl_coach_swing': '1', 'fl_other': '1' }, SYNCED);
  const r = await runPage(await pageAt('https://gorkscape.ca/?online'), { at: 'https://gorkscape.ca/?online#handoff-pull=' + PULL, store, answer: () => OK });
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0].url, '/api/handoff/offer');
  assert.equal(r.calls[0].headers.authorization, 'Bearer ' + TOK);
  assert.deepEqual(r.calls[0].body, { pull: PULL, keys: { 'fanglands.session': TOK, 'fanglands.lastname': 'Cohen', 'fanglands.settings': SYNCED['fanglands.settings'], 'fanglands.kidmode': '1', 'fl_learn_bag': '3', 'fl_coach_swing': '1' } });
  assert.deepEqual(r.nav, ['https://fanglands.com/handoff#land=' + CODE + '&to=%2F%3Fonline&from=gorkscape.ca']);
  assert.deepEqual(r.hist, ['/?online'], 'the pull leaves the address');
  assert.equal(JSON.parse(r.store[PULL_KEY]).n, PULL, 'the pull that came is kept here from now on');
  assert.equal(r.store['fanglands.slot.4'], OTHER);
});

test('hand-over page: under 8 KB whatever the storage holds: the login always goes, then the settings, then the hints while they fit', async () => {
  const store = Object.assign({ [PULL_KEY]: FRESH() }, SYNCED);
  for (let i = 0; i < 400; i++) store['fl_learn_tip' + i] = '12';
  const r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/', store, answer: () => OK });
  const body = JSON.stringify(r.calls[0].body);
  assert.ok(Buffer.byteLength(body) <= HANDOFF_MAX, String(Buffer.byteLength(body)));
  assert.equal(r.calls[0].body.keys['fanglands.session'], TOK);
  assert.equal(r.calls[0].body.keys['fanglands.settings'], SYNCED['fanglands.settings']);
  assert.ok(Object.keys(r.calls[0].body.keys).filter(k => k.startsWith('fl_learn_tip')).length > 50);
});

test('hand-over page: the world says whose the login is: a cloud copy of ANOTHER account here is not on the server for this login, so the tab stays after all (no landing)', async () => {
  const r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/', store: Object.assign({ [PULL_KEY]: FRESH() }, SYNCED), answer: () => ({ status: 200, json: { code: CODE, expires: 1, name: 'sam' } }) });
  assert.equal(r.calls.length, 1);
  assert.deepEqual(r.nav, ['/handoff-here?to=%2F']);
});

test('hand-over page: a login the world does not take (401: run out, banned): with no save it is a plain redirect; with a save the tab stays', async () => {
  const no = () => ({ status: 401, json: { code: 'login' } });
  let r = await runPage(await pageAt('https://gorkscape.ca/x'), { at: 'https://gorkscape.ca/x', store: { [PULL_KEY]: FRESH(), 'fanglands.session': TOK, 'fanglands.settings': '{}' }, answer: no });
  assert.deepEqual(r.nav, ['https://fanglands.com/x']);
  r = await runPage(await pageAt('https://gorkscape.ca/x'), { at: 'https://gorkscape.ca/x', store: Object.assign({ [PULL_KEY]: FRESH() }, SYNCED), answer: no });
  assert.deepEqual(r.nav, ['/handoff-here?to=%2Fx']);
});

test('hand-over page: "Still working on it..." after a few seconds; too busy (429, 503) or no answer twice: with a save here the tab stays, with none the card\'s Try again and a link that says the game needs a login', async () => {
  for (const answer of [() => ({ status: 429, json: { code: 'wait', wait: 99 } }), () => ({ status: 503, json: { code: 'busy' } }), () => 'down', () => 'hang', () => ({ status: 500, json: {} })]) {
    let r = await runPage(await pageAt('https://gorkscape.ca/admin'), { at: 'https://gorkscape.ca/admin', store: { [PULL_KEY]: FRESH(), 'fanglands.session': TOK }, answer });
    assert.ok(r.calls.length <= 2);
    assert.deepEqual(r.nav, [], 'never on without the login');
    assert.ok(r.shown('stuck') && r.shown('card'));
    assert.equal(r.els.again.attrs.href, '/admin');
    assert.equal(r.els.anyway.attrs.href, 'https://fanglands.com/admin');
    assert.match(r.html, /<a id="anyway" href="">Or go to the game and log in with your knight's name and secret word\.<\/a>/);
    r = await runPage(await pageAt('https://gorkscape.ca/admin'), { at: 'https://gorkscape.ca/admin', store: Object.assign({ [PULL_KEY]: FRESH() }, SYNCED), answer });
    assert.deepEqual(r.nav, ['/handoff-here?to=%2Fadmin']);
  }
  const r = await runPage(await pageAt('https://gorkscape.ca/'), { at: 'https://gorkscape.ca/', store: Object.assign({ [PULL_KEY]: FRESH() }, SYNCED), answer: () => 'hang', until: 5000 });
  assert.ok(r.shown('more'));
});

test('landing page (#back): keeps a pull here and goes back to the old address it came from with it; a plain path only; storage off goes straight to the game', async () => {
  const at = 'https://fanglands.com/handoff#back=%2Fadmin%3Fx%3D1&from=www.gorkscape.ca';
  let r = await runPage(await pageAt(at), { at });
  const n = JSON.parse(r.store[PULL_KEY]).n;
  assert.match(n, /^[0-9a-f]{32}$/);
  assert.deepEqual(r.nav, ['https://www.gorkscape.ca/admin?x=1#handoff-pull=' + n]);
  assert.deepEqual(r.hist, ['/handoff']);
  r = await runPage(await pageAt(at), { at, store: { [PULL_KEY]: FRESH() } });
  assert.deepEqual(r.nav, ['https://www.gorkscape.ca/admin?x=1#handoff-pull=' + PULL]);
  r = await runPage(await pageAt(at), { at: 'https://fanglands.com/handoff#back=%2F%2Fevil.example&from=evil.example' });
  assert.match(r.nav[0], /^https:\/\/gorkscape\.ca\/#handoff-pull=/);
  r = await runPage(await pageAt(at), { at, broken: true });
  assert.deepEqual(r.nav, ['/admin?x=1']);
});

test('landing page (#land): the code leaves the address and history first; it claims with the pull kept here, writes the login and settings, and goes on to the same path, /admin too', async () => {
  const keys = { 'fanglands.session': TOK, 'fanglands.lastname': 'Cohen', 'fanglands.settings': '{"kid":true}', 'fl_learn_bag': '3' };
  for (const to of ['/', '/?online', '/admin?x=1']) {
    const at = 'https://fanglands.com/handoff#land=' + CODE + '&to=' + encodeURIComponent(to) + '&from=gorkscape.ca';
    const r = await runPage(await pageAt(at), { at, store: { [PULL_KEY]: FRESH() }, session: { [TRIES_KEY]: String(Date.now()) }, answer: () => ({ status: 200, json: { keys, from: 'gorkscape.ca' } }) });
    assert.deepEqual(r.hist, ['/handoff']);
    assert.deepEqual(r.calls.map(c => c.body), [{ code: CODE, pull: PULL }]);
    for (const k of Object.keys(keys)) assert.equal(r.store[k], keys[k], k);
    assert.deepEqual(r.nav, [to]);
    assert.equal(r.session[ARRIVING_KEY], to.startsWith('/admin') ? undefined : '1');
    assert.equal(r.session[TRIES_KEY], undefined, 'a landing that worked forgets the miss');
  }
});

test('landing page (#land): a claim that misses goes back to the old address once with this address\'s pull (#handoff-pull, so a pull planted by a link heals), and a second miss in this tab shows Try again', async () => {
  const at = 'https://fanglands.com/handoff#land=' + CODE + '&to=%2Fadmin&from=gorkscape.ca';
  for (const answer of [() => ({ status: 404, json: { code: 'gone' } }), () => 'down', () => 'hang']) {
    let r = await runPage(await pageAt(at), { at, store: { [PULL_KEY]: FRESH() }, answer });
    assert.deepEqual(r.nav, ['https://gorkscape.ca/admin#handoff-pull=' + PULL]);
    assert.ok(+r.session[TRIES_KEY] > 0);
    r = await runPage(await pageAt(at), { at, store: { [PULL_KEY]: FRESH() }, session: r.session, answer });
    assert.deepEqual(r.nav, []);
    assert.ok(r.shown('stuck'));
    assert.equal(r.els.again.attrs.href, 'https://gorkscape.ca/admin');
    assert.equal(r.els.anyway.attrs.href, '/admin');
  }
  const old = await runPage(await pageAt(at), { at, store: { [PULL_KEY]: FRESH() }, session: { [TRIES_KEY]: String(Date.now() - 5 * 60000) }, answer: () => ({ status: 404, json: {} }) });
  assert.equal(old.nav.length, 1, 'a miss from minutes ago does not count');
  assert.match(await (await pageAt(at)).text(), /^(?![\s\S]*handoff-pull2)/, 'no second kind of pull to plant');
});

// The whole chain in one browser with two addresses' storage, against a real World.
async function chain(w, { host = 'gorkscape.ca', path = '/', oldStore, newStore = {}, ip = '203.0.113.9', hash = '', session = {} }) {
  const env = fakeEnv().env;
  const call = (h) => async (url, body, n, headers) => {
    const auth = /^Bearer (.+)$/.exec((headers && headers.authorization) || '');
    const r = await post(w, 'https://' + h + url, body, { ip, auth: auth ? auth[1] : undefined });
    return { status: r.status, json: r.data };
  };
  let url = 'https://' + host + path + hash, hops = [], r;
  const stores = { old: oldStore, new: newStore }, sessions = { old: {}, new: session };
  for (let i = 0; i < 10; i++) {
    const u = new URL(url); hops.push(url);
    const old = u.hostname !== 'fanglands.com';
    if (!old && u.pathname !== '/handoff') break;   // the game, /admin, any page on the new address: the end
    if (old && u.pathname === '/handoff-here') break;   // the game served on the old address
    r = await runPage(await pageAt(url, env), { at: url, store: old ? stores.old : stores.new, session: old ? sessions.old : sessions.new, answer: call(u.hostname) });
    if (old) { stores.old = r.store; sessions.old = r.session; } else { stores.new = r.store; sessions.new = r.session; }
    if (!r.nav.length) break;
    url = new URL(r.nav[0], url).href;
  }
  return { hops, store: stores.new, old: stores.old, last: r };
}
const X = s => s.replace(/[0-9a-f]{32,}/g, 'X');

test('the whole hop against a real world: logged in (first visit, later visits), a knight only on the device stays, logged out goes straight across, www, an /admin path, a planted pull heals', async () => {
  const w = newWorld();
  const tok = account(w, 'Cohen');
  const kid = Object.assign({}, SYNCED, { 'fanglands.session': tok });
  let c = await chain(w, { oldStore: kid, path: '/?online' });
  assert.deepEqual(c.hops.map(X), ['https://gorkscape.ca/?online', 'https://fanglands.com/handoff#back=%2F%3Fonline&from=gorkscape.ca', 'https://gorkscape.ca/?online#handoff-pull=X', 'https://fanglands.com/handoff#land=X&to=%2F%3Fonline&from=gorkscape.ca', 'https://fanglands.com/?online']);
  assert.equal(c.store['fanglands.session'], tok);
  assert.equal(c.store['fanglands.settings'], kid['fanglands.settings']);
  assert.ok(!Object.keys(c.store).some(k => /slot|brought|dk\./.test(k)), 'no knight travels: it loads from the world at login');
  assert.equal(waiting(w), 0);
  const later = await chain(w, { oldStore: c.old, newStore: c.store, path: '/admin' });
  assert.equal(later.hops.length, 3, 'a later visit: the old page, the landing, the page');
  assert.equal(later.hops[2], 'https://fanglands.com/admin');
  // a knight only on this device: the tab stays on the old address, nothing offered
  c = await chain(w, { oldStore: Object.assign({}, kid, { 'fanglands.slot.2': OTHER }), path: '/' });
  assert.deepEqual(c.hops, ['https://gorkscape.ca/', 'https://gorkscape.ca/handoff-here?to=%2F']);
  // logged out with nothing saved, from www: straight across
  c = await chain(w, { host: 'www.gorkscape.ca', path: '/admin?x=1', oldStore: { 'fanglands.settings': '{"kid":true}' } });
  assert.deepEqual(c.hops, ['https://www.gorkscape.ca/admin?x=1', 'https://fanglands.com/admin?x=1']);
  // a link that planted another pull on the old address: one extra trip, and the kid lands logged in all the same
  c = await chain(w, { oldStore: Object.assign({ [PULL_KEY]: FRESH() }, kid), newStore: { [PULL_KEY]: JSON.stringify({ n: 'f'.repeat(32), at: Date.now() }) }, hash: '#handoff-pull=' + 'e'.repeat(32) });
  assert.equal(c.hops[c.hops.length - 1], 'https://fanglands.com/');
  assert.equal(c.store['fanglands.session'], tok);
  assert.ok(c.hops.some(h => h.includes('#handoff-pull=' + 'f'.repeat(32))), c.hops.join('\n'));
});

// The landing page as the Worker ships it: wrangler bundles with esbuild and keep_names, which rewrites functions.
test('pages, as wrangler bundles them (esbuild, keep_names): the claim still writes, and the old page still judges the knights', async t => {
  const { existsSync, mkdtempSync, writeFileSync } = await import('node:fs');
  const { createRequire } = await import('node:module');
  const os = await import('node:os'), pathM = await import('node:path');
  const where = ['/opt/homebrew/lib/node_modules/wrangler/node_modules/esbuild', '/usr/local/lib/node_modules/wrangler/node_modules/esbuild'].find(p => existsSync(p));
  if (!where) { t.skip('no wrangler esbuild on this computer'); return; }
  const esbuild = createRequire(import.meta.url)(where);
  const out = await esbuild.build({ entryPoints: [new URL('../src/handoff.js', import.meta.url).pathname], bundle: true, format: 'esm', keepNames: true, write: false, platform: 'neutral' });
  const dir = mkdtempSync(pathM.join(os.tmpdir(), 'fl-bundle-')), file = pathM.join(dir, 'handoff.bundle.mjs');
  writeFileSync(file, out.outputFiles[0].text);
  assert.match(out.outputFiles[0].text, /__name\(/, 'the bundle really rewrites functions');
  const bundled = await import(file);
  const offered = { 'fanglands.session': TOK, 'fanglands.settings': '{"kid":true}' };
  let r = await runPage(bundled.landingPage('fanglands.com'), {
    at: 'https://fanglands.com/handoff#land=' + CODE + '&to=%2F&from=gorkscape.ca', store: { [PULL_KEY]: FRESH() },
    answer: () => ({ status: 200, json: { keys: offered, from: 'gorkscape.ca' } }),
  });
  assert.deepEqual(r.nav, ['/']);
  for (const k of Object.keys(offered)) assert.equal(r.store[k], offered[k], k);
  r = await runPage(bundled.handoverPage('gorkscape.ca', 'fanglands.com'), { at: 'https://gorkscape.ca/', store: Object.assign({}, SYNCED, { 'fanglands.slot.2': OTHER }) });
  assert.deepEqual(r.nav, ['/handoff-here?to=%2F']);
  r = await runPage(bundled.handoverPage('gorkscape.ca', 'fanglands.com'), { at: 'https://gorkscape.ca/', store: Object.assign({ [PULL_KEY]: FRESH() }, SYNCED), answer: () => OK });
  assert.match(r.nav[0], /#land=/);
});

// ---------------------------------------------------------------------------
// The game page's own first script (src/page.html), before the game is read
// ---------------------------------------------------------------------------
function runInline({ host = 'gorkscape.ca', cookie = '', standalone = false, arriving = false, until = 5000 } = {}) {
  const html = readFileSync(new URL('../../src/page.html', import.meta.url), 'utf8');
  const script = /<script data-arrive>([\s\S]*?)<\/script>/.exec(html)[1];
  const els = { 'fl-arrive': { hidden: true }, 'fl-arrive-more': { hidden: true } }, navs = [], c = clock();
  const ctx = vm.createContext({
    location: { hostname: host, pathname: '/admin', search: '?x=1', replace: u => navs.push(u) },
    document: { cookie, getElementById: id => els[id] || null },
    navigator: { standalone: standalone ? true : undefined }, matchMedia: () => ({ matches: false }),
    sessionStorage: { getItem: k => (arriving && k === ARRIVING_KEY ? '1' : null) }, setTimeout: c.setTimeout,
  });
  ctx.window = ctx;
  vm.runInContext(script, ctx);
  return c.run(until).then(() => ({ navs, els, leaving: ctx.FL_LEAVING === true }));
}
test('the game page, before the game is read: an ordinary tab on the old address with the icon\'s cookie is sent to /handoff-leave at once, with the card; an icon, a kept tab (fl_here) or the new address are not; the arriving card says "Still working on it..." after 4 s', async () => {
  let r = await runInline({ cookie: 'a=1; fl_stay=1' });
  assert.deepEqual(r.navs, ['/handoff-leave?to=%2Fadmin%3Fx%3D1']);
  assert.ok(r.leaving && !r.els['fl-arrive'].hidden);
  for (const o of [{ cookie: 'fl_stay=1', standalone: true }, { cookie: 'fl_here=1' }, { host: 'fanglands.com', cookie: 'fl_stay=1' }, { cookie: 'xfl_stay=1' }]) {
    r = await runInline(o);
    assert.deepEqual(r.navs, [], JSON.stringify(o)); assert.ok(!r.leaving);
  }
  r = await runInline({ host: 'fanglands.com', arriving: true, until: 3000 });
  assert.ok(!r.els['fl-arrive'].hidden && r.els['fl-arrive-more'].hidden);
  r = await runInline({ host: 'fanglands.com', arriving: true, until: 4500 });
  assert.ok(!r.els['fl-arrive-more'].hidden);
});
