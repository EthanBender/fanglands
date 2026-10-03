// Two addresses (docs/ONLINE.md, "Two addresses"): the two rules the hand-over pages carry as text
// (online/src/handoff-merge.js): what the landing page on fanglands.com writes from a claim (handoffMerge), and how many
// knights a browser holds that are not on the server (deviceKnights, which decides whether gorkscape.ca sends a tab
// across or keeps it). Every rule is proved here directly, and once more through the pages in handoff.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { MERGE_SOURCE, KNIGHTS_SOURCE, CARRY, HINT_RE } from '../src/handoff-merge.js';
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
// deviceKnights: which knights are only on this device (feat/no-play-alone's notes)
// ---------------------------------------------------------------------------
const fp = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36) + '.' + s.length; };
const K = (ps, level = 3) => JSON.stringify({ player: { playSeconds: ps, level } });
const C = K(500);
// as feat/no-play-alone leaves a browser: slot 1 is Cohen's, the world confirmed holding that exact string
const cloud = (extra) => Object.assign({ 'fanglands.session': 't', 'fanglands.lastname': 'Cohen', 'fanglands.slot.1': C, 'fanglands.slot.1.at': '500', 'fanglands.slot.1.online': 'cohen', 'fanglands.slot.1.synced': 'cohen|' + fp(C), 'fanglands.slot.current': '1', 'fanglands.settings': '{}' }, extra || {});
const count = (st, acct) => { const m = mem(st); return knights(m.get, m.keys(), acct); };

test('knights: nothing saved, or only things that are not knights: none', () => {
  assert.equal(count({}, null), 0);
  assert.equal(count({ 'fanglands.settings': '{}', 'fanglands.slot.2': 'not a save', 'fanglands.slot.3': '{"x":1}', 'fanglands.slot.4': '' }, null), 0);
});

test('knights: with no login every save counts, even a cloud copy (nothing here is known to be the logged-in account\'s)', () => {
  assert.equal(count(cloud(), null), 1);
  assert.equal(count({ 'fanglands.slot.1': C, 'fanglands.slot.2': K(1) }, null), 2);
});

test('knights: the account\'s cloud copy (owner note and a synced note that matches its exact string) is on the server, and so is the same string anywhere else', () => {
  assert.equal(count(cloud(), 'cohen'), 0);
  assert.equal(count(cloud({ 'fanglands.slot.7': C }), 'cohen'), 0);
  assert.equal(count(cloud({ 'fanglands.slot.1': K(510) }), 'cohen'), 1, 'played on since the world confirmed it');
  assert.equal(count(cloud({ 'fanglands.slot.1.synced': 'cohen|zzz.1' }), 'cohen'), 1);
  assert.equal(count(cloud({ 'fanglands.slot.1.synced': undefined }), 'cohen'), 1);
});

test('knights: the logged-in account\'s own: a cloud copy of ANOTHER account counts, unless the first look ("*": any account)', () => {
  assert.equal(count(cloud(), 'sam'), 1);
  assert.equal(count(cloud(), '*'), 0);
});

test('knights: a knight with no owner (from the days of Play alone) always counts, whoever is logged in', () => {
  for (const acct of [null, 'cohen', '*']) assert.equal(count(cloud({ 'fanglands.slot.2': K(10) }), acct), acct === null ? 2 : 1, String(acct));
});

test('knights: the account\'s own other copy is on the server when it is not ahead of the cloud copy here (72-deviceknights\' ahead: more play time, or a later stamp at no less), or when the account chose the world\'s copy over it (fanglands.dk.kept)', () => {
  assert.equal(count(cloud({ 'fanglands.slot.5': K(100), 'fanglands.slot.5.at': '900', 'fanglands.slot.5.online': 'cohen' }), 'cohen'), 0, 'less play time');
  assert.equal(count(cloud({ 'fanglands.slot.5': K(500, 4), 'fanglands.slot.5.at': '400', 'fanglands.slot.5.online': 'cohen' }), 'cohen'), 0, 'same play time, older');
  assert.equal(count(cloud({ 'fanglands.slot.5': K(500, 4), 'fanglands.slot.5.at': '600', 'fanglands.slot.5.online': 'cohen' }), 'cohen'), 1, 'same play time, newer');
  assert.equal(count(cloud({ 'fanglands.slot.5': K(900), 'fanglands.slot.5.online': 'cohen' }), 'cohen'), 1, 'more play time');
  const ahead = { 'fanglands.slot.5': K(900), 'fanglands.slot.5.online': 'cohen' };
  assert.equal(count(cloud(Object.assign({ 'fanglands.dk.kept': JSON.stringify(['cohen|' + fp(K(900))]) }, ahead)), 'cohen'), 0, 'kept the world\'s copy');
  assert.equal(count(cloud(Object.assign({ 'fanglands.dk.kept': JSON.stringify(['sam|' + fp(K(900))]) }, ahead)), 'cohen'), 1, 'another account\'s answer is not his');
  assert.equal(count(Object.assign({}, ahead, { 'fanglands.slot.5': K(1) }), 'cohen'), 1, 'with no cloud copy here, nothing to be behind');
});

test('knights: another account\'s copy counts for this login (it may hold progress only here); on the first look it does not when it is behind that account\'s cloud copy', () => {
  const st = cloud({ 'fanglands.slot.6': K(100), 'fanglands.slot.6.online': 'ann' });
  assert.equal(count(st, 'cohen'), 1);
  assert.equal(count(st, '*'), 1, 'ann has no cloud copy here');
  assert.equal(count(cloud({ 'fanglands.slot.6': K(100), 'fanglands.slot.6.online': 'cohen' }), '*'), 0);
});

test('knights: master\'s old mark ("1") is no account: before feat/no-play-alone nothing is known to be in the cloud, so every save counts', () => {
  const st = { 'fanglands.session': 't', 'fanglands.slot.1': C, 'fanglands.slot.1.online': '1', 'fanglands.slot.1.synced': '1|' + fp(C) };
  assert.equal(count(st, 'cohen'), 1);
  assert.equal(count({ 'fanglands.session': 't', 'fanglands.slot.1': C, 'fanglands.slot.1.online': '1' }, '*'), 1);
});

test('knights: the old single save counts only when the game would still make it slot 1 (no slot 1, no current slot); otherwise it is a mirror', () => {
  assert.equal(count({ 'fanglands.save.v2': K(5) }, null), 1);
  assert.equal(count({ 'fanglands.save.v2': K(5), 'fanglands.slot.current': '2', 'fanglands.slot.2': K(5) }, null), 1);
  assert.equal(count(cloud({ 'fanglands.save.v2': K(1) }), 'cohen'), 0);
  assert.equal(count({ 'fanglands.save.v2': 'broken' }, null), 0);
});

test('knights: the game\'s copy in src/00-handoff.js is this function word for word, and the game runs it to the same answers', () => {
  const game = readFileSync(new URL('../../src/00-handoff.js', import.meta.url), 'utf8');
  assert.ok(game.includes('const deviceKnights = ' + KNIGHTS_SOURCE + ';'));
  const ctx = vm.createContext({ window: {}, HOOKS: { selfTest: [] } });
  vm.runInContext(game, ctx);
  const H = ctx.window.HANDOFF;
  const all = [cloud(), cloud({ 'fanglands.slot.2': K(10) }), cloud({ 'fanglands.slot.5': K(900), 'fanglands.slot.5.online': 'cohen' }), { 'fanglands.save.v2': K(5) }, {}];
  for (const st of all) for (const acct of [null, 'cohen', 'sam', '*']) { const m = mem(st); assert.equal(H.deviceKnights(m.get, m.keys(), acct), count(st, acct)); }
  // the icon note's words come from the same rule
  assert.equal(H.noteFor(mem(cloud())), H.NOTE_CLOUD);
  assert.equal(H.noteFor(mem(cloud({ 'fanglands.slot.2': K(10) }))), H.NOTE_DEVICE);
  assert.equal(H.noteFor(mem(cloud({ 'fanglands.session': undefined }))), H.NOTE_DEVICE);
  // and its self-tests pass
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
  const m = mem(cloud({ 'fanglands.slot.2': K(1) }));
  assert.equal(k(m.get, m.keys(), 'cohen'), 1);
  const g = vm.runInContext('(' + MERGE_SOURCE + ')', ctx);
  const a = mem(); g(OLD, a, 'gorkscape.ca');
  assert.equal(a.s['fanglands.session'], 'tok-old');
});

// the game's boot on the old address, in a VM with a small page: which note shows, and fl_here is cleared at once
function bootGame({ host = 'gorkscape.ca', cookie = '', standalone = false, store = {} } = {}) {
  const game = readFileSync(new URL('../../src/00-handoff.js', import.meta.url), 'utf8');
  const s = Object.assign({}, store), jar = { now: cookie, set: [] }, shown = [], timers = [];
  const el = () => { const e = { style: {}, children: [], textContent: '', setAttribute() { }, addEventListener() { }, append(...c) { e.children.push(...c); }, appendChild(c) { e.children.push(c); }, remove() { } }; return e; };
  const body = el();
  const document = { readyState: 'complete', body, createElement: el, getElementById: () => null };
  Object.defineProperty(document, 'cookie', { get: () => jar.now, set: v => jar.set.push(v) });
  const ls = { getItem: k => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: k => { delete s[k]; }, key: i => Object.keys(s)[i], get length() { return Object.keys(s).length; } };
  const ctx = vm.createContext({ HOOKS: { selfTest: [] }, location: { hostname: host, hash: '', pathname: '/', search: '' }, document, localStorage: ls, sessionStorage: { removeItem() { } },
    navigator: { standalone: standalone || undefined }, matchMedia: () => ({ matches: false }), setTimeout: (fn, ms) => timers.push(fn), history: { replaceState() { } } });
  ctx.window = ctx; ctx.window.addEventListener = () => { };
  vm.runInContext(game, ctx);
  while (timers.length) timers.shift()();
  const texts = []; const walk = e => { if (e.textContent) texts.push(e.textContent); (e.children || []).forEach(walk); }; walk(body);
  return { set: jar.set, texts, store: s };
}
test('the game on the old address: a tab kept for a knight only on its device clears fl_here at once and shows the tab note once; an icon shows its own note; the new address shows none', () => {
  let r = bootGame({ cookie: 'a=1; fl_here=1', store: { 'fanglands.slot.2': K(10) } });
  assert.deepEqual(r.set, ['fl_here=; Max-Age=0; Path=/; Secure; SameSite=Lax']);
  assert.ok(r.texts.includes('Fanglands has a new home: fanglands.com. Log in and bring your knight into your account first.'), r.texts.join('|'));
  assert.ok(r.store['fanglands.handoff.tabnoted']);
  r = bootGame({ cookie: 'fl_here=1', store: r.store });
  assert.ok(!r.texts.some(t => /new home/.test(t)), 'once');
  r = bootGame({ cookie: 'fl_stay=1', standalone: true, store: cloud() });
  assert.deepEqual(r.set, []);
  assert.ok(r.texts.some(t => t.startsWith('Fanglands has a new home: fanglands.com. Your knight is saved in the cloud.')), r.texts.join('|'));
  r = bootGame({ host: 'fanglands.com', cookie: 'fl_here=1; fl_stay=1' });
  assert.ok(!r.texts.some(t => /new home/.test(t)));
});
