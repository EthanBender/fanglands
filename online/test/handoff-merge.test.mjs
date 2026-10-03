// Two addresses (docs/ONLINE.md, "Two addresses"): the two rules the hand-over pages carry as text
// (online/src/handoff-merge.js): what the landing page on fanglands.com writes from a claim (handoffMerge), and how many
// knights a browser holds that are not on the server (deviceKnights, which decides whether gorkscape.ca sends a tab
// across or keeps it). Every rule is proved here directly, and once more through the pages in handoff.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { MERGE_SOURCE, KNIGHTS_SOURCE, CARRY, HINT_RE, knightOf } from '../src/handoff-merge.js';
const merge = new Function('"use strict"; return (' + MERGE_SOURCE + ')')();
const knights = new Function('"use strict"; return (' + KNIGHTS_SOURCE + ')')();

const mem = init => { const s = Object.assign({}, init); return { s, get: k => (k in s ? s[k] : null), set: (k, v) => { s[k] = String(v); }, del: k => { delete s[k]; }, keys: () => Object.keys(s) }; };
const OLD = {
  'fanglands.session': 'tok-old', 'fanglands.lastname': 'Cohen',
  'fanglands.settings': '{"kid":true,"text":"large"}', 'fanglands.kidmode': '1', 'fanglands.muted': '1', 'fanglands.music': '0', 'fl_learn_bag': '3', 'fl_coach_swing': '1',
};

// ---------------------------------------------------------------------------
// handoffMerge
// ---------------------------------------------------------------------------
test('merge: an address with nothing yet takes the login, the settings and the hints, exactly', () => {
  const a = mem();
  const r = merge(OLD, a, 'gorkscape.ca');
  for (const k of Object.keys(OLD)) assert.equal(a.s[k], OLD[k], k);
  assert.deepEqual(r.kept, []);
  assert.ok(r.wrote.includes('login'));
});

test('merge: only what a hand-over carries is ever written: a save slot, an owner note, the parent page\'s key, a hand-over note or anything else in a claim moves nothing', () => {
  const a = mem({ 'fanglands.slot.1': '{"mine":1}' });
  const evil = { 'fanglands.slot.1': '{"evil":1}', 'fanglands.slot.2': '{"player":{}}', 'fanglands.slot.2.at': '5', 'fanglands.slot.1.online': 'sam', 'fanglands.slot.1.synced': 'sam|x', 'fanglands.save.v2': '{}',
    'fanglands.brought': '["x"]', 'fanglands.dk.kept': '["x"]', 'fanglands.adminKey': 'k', 'fanglands.handoff.pull': '{"n":"0"}', 'fanglands.handoff.boot': '{}', 'evil': 'x', 'fl_other_x': '1' };
  merge(evil, a, 'gorkscape.ca');
  assert.deepEqual(Object.keys(a.s).sort(), ['fanglands.handoff.boot', 'fanglands.handoff.seen', 'fanglands.slot.1']);
  assert.equal(a.s['fanglands.slot.1'], '{"mine":1}');
  assert.equal(a.s['fanglands.handoff.boot'], '{}');
});

test('merge: nothing the kid has here is written over: a login (another knight\'s, too), a setting the kid set', () => {
  const b = mem({ 'fanglands.session': 'tok-new', 'fanglands.lastname': 'Sam', 'fanglands.settings': '{"sound":false}' });
  const r = merge(OLD, b, 'gorkscape.ca');
  assert.equal(b.s['fanglands.session'], 'tok-new'); assert.equal(b.s['fanglands.lastname'], 'Sam');
  assert.equal(b.s['fanglands.settings'], '{"sound":false}');
  assert.equal(b.s['fanglands.kidmode'], '1');
  assert.ok(r.kept.includes('login') && r.kept.includes('fanglands.settings'));
});

test('merge: the same login from the same old address comes only once: a kid who logs out here stays logged out; a new login from there does come', () => {
  const a = mem();
  merge(OLD, a, 'gorkscape.ca');
  delete a.s['fanglands.session'];
  let r = merge(OLD, a, 'gorkscape.ca');
  assert.ok(!('fanglands.session' in a.s)); assert.ok(r.kept.includes('login'));
  r = merge(Object.assign({}, OLD, { 'fanglands.session': 'tok-again' }), a, 'gorkscape.ca');
  assert.equal(a.s['fanglands.session'], 'tok-again');
  // the same login from www.gorkscape.ca is its own storage's
  const b = mem();
  merge(OLD, b, 'gorkscape.ca'); delete b.s['fanglands.session'];
  merge(OLD, b, 'www.gorkscape.ca');
  assert.equal(b.s['fanglands.session'], 'tok-old');
});

test('merge: after a first look at the new address the kid\'s own settings still come over; a setting changed here stays', () => {
  const nf = mem({ 'fanglands.settings': '{"kid":false,"text":"normal"}', 'fanglands.kidmode': '0', 'fanglands.muted': '1', 'fanglands.handoff.boot': JSON.stringify({ 'fanglands.settings': '{"kid":false,"text":"normal"}', 'fanglands.kidmode': '0' }) });
  merge({ 'fanglands.settings': '{"kid":true,"text":"large"}', 'fanglands.kidmode': '1', 'fanglands.muted': '0' }, nf, 'gorkscape.ca');
  assert.equal(nf.s['fanglands.settings'], '{"kid":true,"text":"large"}'); assert.equal(nf.s['fanglands.kidmode'], '1'); assert.equal(nf.s['fanglands.muted'], '1');
  const boot = JSON.parse(nf.s['fanglands.handoff.boot']);
  assert.ok(!('fanglands.settings' in boot) && !('fanglands.kidmode' in boot), 'what a hand-over wrote is the kid\'s from then on');
});

test('the lists agree: what the server lets an offer carry (CARRY, HINT_RE), what the landing writes, and what the game notes as boot defaults; every settings key 43-settings writes and the hint keys 59-hudkit writes are in it', () => {
  const game = readFileSync(new URL('../../src/00-handoff.js', import.meta.url), 'utf8');
  const listIn = (s, name) => JSON.parse(new RegExp('const ' + name + ' = (\\[[^\\]]*\\]);').exec(s)[1].replace(/'/g, '"'));
  assert.deepEqual(listIn(MERGE_SOURCE, 'CARRY'), CARRY.slice(2));
  assert.deepEqual(listIn(game, 'SETTINGS_KEYS'), CARRY.slice(2));
  assert.deepEqual(CARRY.slice(0, 2), ['fanglands.session', 'fanglands.lastname']);
  const hint = s => /const HINT_RE = (\/[^\n]*\/);/.exec(s)[1];
  assert.equal(hint(MERGE_SOURCE), HINT_RE.toString()); assert.equal(hint(game), HINT_RE.toString());
  const settings = readFileSync(new URL('../../src/43-settings.js', import.meta.url), 'utf8');
  for (const k of new Set(settings.match(/'fanglands\.[a-z]+'/g).map(s => s.slice(1, -1)))) assert.ok(CARRY.includes(k), k);
  assert.match(readFileSync(new URL('../../src/59-hudkit.js', import.meta.url), 'utf8'), /lsSet\('fl_learn_' \+ id[\s\S]*lsSet\('fl_coach_' \+ id/);
  assert.ok(HINT_RE.test('fl_learn_bag') && HINT_RE.test('fl_coach_swing') && !HINT_RE.test('fl_learn_') && !HINT_RE.test('fl_x_y'));
  const login = readFileSync(new URL('../../src/71-login.js', import.meta.url), 'utf8');
  assert.match(login, /'fanglands\.lastname'/);
});

// ---------------------------------------------------------------------------
// deviceKnights: which knights are only on this device, against what the world holds of the logged-in account's knight
// ---------------------------------------------------------------------------
// knights the game's own way: play seconds and the knight's line (feat/no-play-alone: [segment, play when it began])
const K = (ps, line, extra) => JSON.stringify(Object.assign({ player: Object.assign({ playSeconds: ps, level: 3 }, line ? { line } : {}) }, extra || {}));
const W = K(500, [['a', 0], ['b', 300]]);                 // the world's copy of Cohen's knight
const count = (st, world) => { const m = mem(st); return knights(m.get, m.keys(), world); };
const as = (world, how) => (how === 'summary' ? knightOf(world) : world);   // the offer's answer, or the save string itself
// as a browser looks after a login (feat/no-play-alone's cache model: slot 1 marked with the account, no other note)
const after = extra => Object.assign({ 'fanglands.session': 't', 'fanglands.lastname': 'Cohen', 'fanglands.slot.1': W, 'fanglands.slot.1.at': '500', 'fanglands.slot.1.online': 'cohen', 'fanglands.slot.current': '1', 'fanglands.settings': '{}' }, extra || {});

test('knights: nothing saved, or only things that are not knights (a backup 72-deviceknights keeps is not a knight): none', () => {
  assert.equal(count({}, null), 0);
  assert.equal(count({ 'fanglands.settings': '{}', 'fanglands.slot.2': 'not a save', 'fanglands.slot.3': '{"x":1}', 'fanglands.slot.4': '', 'fanglands.slot.5': '{"player":[1]}', 'fanglands.kept.cohen': W, 'fanglands.kept': '["cohen"]' }, null), 0);
});

test('knights: with nothing known of the world (no login, no answer) every knight counts, even a copy of the world\'s', () => {
  assert.equal(count(after(), null), 1);
  assert.equal(count({ 'fanglands.slot.1': W, 'fanglands.slot.2': K(1) }, null), 2);
  assert.equal(count(after(), { fp: null, play: 0, line: [] }), 1, 'the account has no knight in the world yet');
});

for (const how of ['save string', 'summary']) {
  test('knights (' + how + '): the world\'s very copy is on the server, wherever it is and whatever note it has; so is an older copy inside it by the line', () => {
    assert.equal(count(after(), as(W, how)), 0);
    assert.equal(count(after({ 'fanglands.slot.1.online': 'sam' }), as(W, how)), 0, 'the notes are not read');
    assert.equal(count(after({ 'fanglands.slot.1.online': undefined, 'fanglands.slot.7': W }), as(W, how)), 0);
    assert.equal(count(after({ 'fanglands.slot.4': K(250, [['a', 0], ['b', 200]]) }), as(W, how)), 0, 'stopped on the shared segment before the world went on');
    assert.equal(count(after({ 'fanglands.slot.4': K(120, [['a', 0]]) }), as(W, how)), 0, 'an earlier segment, no play after it');
  });
  test('knights (' + how + '): progress the world does not have counts (an upload that never landed must not be stranded on the old address)', () => {
    assert.equal(count(after({ 'fanglands.slot.1': K(520, [['a', 0], ['b', 300]]) }), as(W, how)), 1, 'played on past the world');
    assert.equal(count(after({ 'fanglands.slot.1': K(530, [['a', 0], ['b', 300], ['c', 510]]) }), as(W, how)), 1, 'a new start the world never saw');
    assert.equal(count(after({ 'fanglands.slot.1': K(310, [['a', 0], ['x', 200]]) }), as(W, how)), 1, 'a fork from the shared segment, with play of its own');
    assert.equal(count(after({ 'fanglands.slot.1': K(500) }), as(W, how)), 1, 'a save from before the line that is not the world\'s exact string');
  });
  test('knights (' + how + '): a knight no account owns, or another account\'s copy, counts whoever is logged in', () => {
    assert.equal(count(after({ 'fanglands.slot.2': K(10) }), as(W, how)), 1);
    assert.equal(count(after({ 'fanglands.slot.6': K(100, [['z', 0]]), 'fanglands.slot.6.online': 'ann' }), as(W, how)), 1);
    assert.equal(count(after(), as(K(9, [['q', 0]]), how)), 1, 'the world holds another knight for this login');
  });
}

test('knights: the old single save counts only when the game would still make it slot 1 (no slot 1, no current slot); otherwise it is a mirror', () => {
  assert.equal(count({ 'fanglands.save.v2': K(5) }, null), 1);
  assert.equal(count({ 'fanglands.save.v2': K(5), 'fanglands.slot.current': '2', 'fanglands.slot.2': K(5) }, null), 1);
  assert.equal(count(after({ 'fanglands.save.v2': K(1) }), W), 0);
  assert.equal(count({ 'fanglands.save.v2': W }, W), 0);
  assert.equal(count({ 'fanglands.save.v2': 'broken' }, null), 0);
});

test('knights: the World\'s summary (knightOf) and the save string give the same answers; it is small, and none for no knight', () => {
  const sts = [after(), after({ 'fanglands.slot.4': K(250, [['a', 0], ['b', 200]]) }), after({ 'fanglands.slot.1': K(520, [['a', 0], ['b', 300]]) }), after({ 'fanglands.slot.2': K(10) }), { 'fanglands.save.v2': W }, {}];
  const worlds = [W, K(500), K(9, [['q', 0]]), JSON.stringify({ player: { playSeconds: 99, line: Array.from({ length: 40 }, (_, i) => ['s' + i, i * 10]) } })];
  for (const st of sts) for (const w of worlds) assert.equal(count(st, knightOf(w)), count(st, w), JSON.stringify([st['fanglands.slot.1'], w]));
  const k = knightOf(W);
  assert.deepEqual(k, { fp: k.fp, play: 500, line: [['a', 0], ['b', 300]] });
  assert.match(k.fp, /^[0-9a-z]+\.\d+$/);
  for (const bad of [null, '', 'nope', '{"x":1}', '{"player":[1]}', '[]']) assert.equal(knightOf(bad), null, String(bad));
  const big = knightOf(JSON.stringify({ player: { playSeconds: 1, line: Array.from({ length: 500 }, (_, i) => ['s' + i, i]) }, junk: 'x'.repeat(200000) }));
  assert.equal(big.line.length, 40);
  assert.ok(JSON.stringify(big).length < 1200, 'a summary, never the knight');
});

// The storage a real login leaves, as feat/no-play-alone's own self-test builds it (src/71-login.js claim(): slot 1 is
// the cloud string, marked with the account, the account's line in the save; src/72-deviceknights.js: other accounts'
// copies parked with their owner, a knight no account owns parked with none, the account's fork kept as
// fanglands.kept.<name>). The game's own run of the real code is 00-handoff's self-test 5 (tools/headless.js).
test('knights: the cache model as feat/no-play-alone leaves a browser: the account\'s copy is the world\'s; a parked knight of another account or of none counts; its backups do not', () => {
  const mine = K(800, [['seg1', 0], ['seg2', 640]]);
  const st = { 'fanglands.session': 'tok', 'fanglands.lastname': 'Cohen', 'fanglands.slot.current': '1', 'fanglands.marks.v3': '1',
    'fanglands.slot.1': mine, 'fanglands.slot.1.at': '1759000000000', 'fanglands.slot.1.online': 'cohen',
    'fanglands.kept': '["cohen"]', 'fanglands.kept.cohen': K(700, [['seg1', 0], ['fork', 600]]), 'fanglands.kept.cohen.at': '1', 'fanglands.kept.cohen.when': '2', 'fanglands.dk.told': '["cohen|x.1"]' };
  assert.equal(count(st, mine), 0, 'sent across');
  assert.equal(count(Object.assign({}, st, { 'fanglands.slot.2': K(60, [['ivy', 0]]), 'fanglands.slot.2.online': 'ivy' }), mine), 1);
  assert.equal(count(Object.assign({}, st, { 'fanglands.slot.3': K(30) }), mine), 1);
  // the old mark of a browser that ran master ('1', the last account) is read no differently: only the save decides
  assert.equal(count(Object.assign({}, st, { 'fanglands.slot.1.online': '1' }), mine), 0);
});

test('knights: the game\'s copy in src/00-handoff.js is this function word for word, and the game runs it to the same answers', () => {
  const game = readFileSync(new URL('../../src/00-handoff.js', import.meta.url), 'utf8');
  assert.ok(game.includes('const deviceKnights = ' + KNIGHTS_SOURCE + ';'));
  assert.ok(!/\.synced|dk\.kept|\.online/.test(KNIGHTS_SOURCE), 'no note of another file');
  const ctx = vm.createContext({ window: {}, HOOKS: { selfTest: [] } });
  vm.runInContext(game, ctx);
  const H = ctx.window.HANDOFF;
  const all = [after(), after({ 'fanglands.slot.2': K(10) }), after({ 'fanglands.slot.1': K(520, [['a', 0], ['b', 300]]) }), { 'fanglands.save.v2': K(5) }, {}];
  for (const st of all) for (const w of [null, W, knightOf(W), K(1)]) { const m = mem(st); assert.equal(H.deviceKnights(m.get, m.keys(), w), count(st, w)); }
  // the icon note's words come from the same rule, against the world's copy
  assert.equal(H.noteFor(mem(after()), W), H.NOTE_CLOUD);
  assert.equal(H.noteFor(mem(after()), null), H.NOTE_DEVICE);
  assert.equal(H.noteFor(mem(after({ 'fanglands.slot.2': K(10) })), W), H.NOTE_DEVICE);
  assert.equal(H.noteFor(mem(after({ 'fanglands.session': undefined })), W), H.NOTE_DEVICE);
  // and its self-tests pass (the real-login one needs the whole game: tools/headless.js runs it)
  const fails = [];
  for (const t of ctx.HOOKS.selfTest) t((name, ok, info) => { if (!ok) fails.push(name + ' ' + JSON.stringify(info)); });
  assert.deepEqual(fails, []);
});

test('both functions are self-contained (the pages carry their source)', () => {
  for (const src of [MERGE_SOURCE, KNIGHTS_SOURCE]) {
    const ctx = vm.createContext({ JSON, Math, String, Array, Object });
    const fn = vm.runInContext('(' + src + ')', ctx);
    assert.equal(typeof fn, 'function');
  }
  const ctx = vm.createContext({ JSON, Math, String, Array, Object });
  const k = vm.runInContext('(' + KNIGHTS_SOURCE + ')', ctx);
  const m = mem(after({ 'fanglands.slot.2': K(1) }));
  assert.equal(k(m.get, m.keys(), W), 1);
  assert.equal(k(m.get, m.keys(), knightOf(W)), 1);
  const g = vm.runInContext('(' + MERGE_SOURCE + ')', ctx);
  const a = mem(); g(OLD, a, 'gorkscape.ca');
  assert.equal(a.s['fanglands.session'], 'tok-old');
});

// the game's boot on the old address, in a VM with a small page: which note shows, and fl_here is cleared at once.
// hop: what page.html left in window.FL_HOP; world: what GET /api/save answers (undefined: no fetch at all)
async function bootGame({ host = 'gorkscape.ca', cookie = '', standalone = false, store = {}, hop, world } = {}) {
  const game = readFileSync(new URL('../../src/00-handoff.js', import.meta.url), 'utf8');
  const s = Object.assign({}, store), jar = { now: cookie, set: [] }, shown = [], timers = [], asked = [];
  const el = () => { const e = { style: {}, children: [], textContent: '', setAttribute() { }, addEventListener() { }, append(...c) { e.children.push(...c); }, appendChild(c) { e.children.push(c); }, remove() { } }; return e; };
  const body = el();
  const document = { readyState: 'complete', body, createElement: el, getElementById: () => null };
  Object.defineProperty(document, 'cookie', { get: () => jar.now, set: v => jar.set.push(v) });
  const ls = { getItem: k => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: k => { delete s[k]; }, key: i => Object.keys(s)[i], get length() { return Object.keys(s).length; } };
  const ctx = vm.createContext({ HOOKS: { selfTest: [] }, location: { hostname: host, hash: '', pathname: '/', search: '' }, document, localStorage: ls, sessionStorage: { removeItem() { } },
    navigator: { standalone: standalone || undefined }, matchMedia: () => ({ matches: false }), setTimeout: (fn, ms) => timers.push({ fn, ms }), history: { replaceState() { } } });
  if (world !== undefined) ctx.fetch = (url, opt) => { asked.push([url, opt.headers.authorization]); return Promise.resolve({ ok: true, json: async () => ({ save: world, at: 1 }) }); };
  ctx.window = ctx; ctx.window.addEventListener = () => { };
  if (hop !== undefined) ctx.FL_HOP = hop;
  vm.runInContext(game, ctx);
  for (let round = 0; round < 4; round++) {
    // the 5 s give-up waits until the world's answer had its chance
    timers.sort((a, b) => (a.ms || 0) - (b.ms || 0));
    while (timers.length) { const t = timers.shift(); t.fn(); for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); }
  }
  const texts = []; const walk = e => { if (e.textContent) texts.push(e.textContent); (e.children || []).forEach(walk); }; walk(body);
  return { set: jar.set, texts, store: s, asked };
}
test('the game on the old address: a tab kept for a knight only on its device clears fl_here at once and shows the tab note once; an icon shows its own note; the new address shows none', async () => {
  let r = await bootGame({ cookie: 'a=1; fl_here=1', store: { 'fanglands.slot.2': K(10) } });
  assert.deepEqual(r.set, ['fl_here=; Max-Age=0; Path=/; Secure; SameSite=Lax']);
  assert.ok(r.texts.includes('Fanglands has a new home: fanglands.com. Log in and bring your knight into your account first.'), r.texts.join('|'));
  assert.ok(r.store['fanglands.handoff.tabnoted']);
  r = await bootGame({ cookie: 'fl_here=1', store: r.store });
  assert.ok(!r.texts.some(t => /new home/.test(t)), 'once');
  r = await bootGame({ cookie: 'fl_stay=1', standalone: true, store: after(), world: W });
  assert.deepEqual(r.set, []);
  assert.deepEqual(r.asked, [['/api/save', 'Bearer t']], 'the icon asks the world for its copy once, with the login');
  assert.ok(r.texts.some(t => t.startsWith('Fanglands has a new home: fanglands.com. Your knight is saved in the cloud.')), r.texts.join('|'));
  r = await bootGame({ cookie: 'fl_stay=1', standalone: true, store: after({ 'fanglands.slot.2': K(10) }), world: W });
  assert.ok(r.texts.some(t => t.startsWith('Fanglands has a new home: fanglands.com. Keep this icon')), r.texts.join('|'));
  r = await bootGame({ cookie: 'fl_stay=1', standalone: true, store: after() });
  assert.ok(r.texts.some(t => t.startsWith('Fanglands has a new home: fanglands.com. Keep this icon')), 'no answer from the world: keep this icon');
  r = await bootGame({ host: 'fanglands.com', cookie: 'fl_here=1; fl_stay=1' });
  assert.ok(!r.texts.some(t => /new home/.test(t)));
});
test('the game on the old address in a browser that keeps no cookie: the hop\'s marker (window.FL_HOP, left by page.html) shows the same notes', async () => {
  let r = await bootGame({ hop: 'here', store: { 'fanglands.slot.2': K(10) } });
  assert.ok(r.texts.includes('Fanglands has a new home: fanglands.com. Log in and bring your knight into your account first.'), r.texts.join('|'));
  assert.deepEqual(r.set, []);
  r = await bootGame({ hop: 'stay', standalone: true, store: after(), world: W });
  assert.ok(r.texts.some(t => t.startsWith('Fanglands has a new home: fanglands.com. Your knight is saved in the cloud.')), r.texts.join('|'));
  r = await bootGame({ hop: 'stay', store: after() });
  assert.ok(!r.texts.some(t => /new home/.test(t)), 'an ordinary tab with the icon\'s marker: no note');
});
