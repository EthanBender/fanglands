// Two addresses (docs/ONLINE.md, "Two addresses"): what a browser arriving on fanglands.com writes from what its old
// address offered (online/src/handoff-merge.js). The landing page runs this very function (its source, kept as text), so every rule
// is proved here directly, and once more through the page in handoff.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MERGE_SOURCE } from '../src/handoff-merge.js';
const merge = new Function('return (' + MERGE_SOURCE + ')')();

const NOW = 1000000;
const mem = init => { const s = Object.assign({}, init); return { s, get: k => (k in s ? s[k] : null), set: (k, v) => { s[k] = String(v); }, del: k => { delete s[k]; }, keys: () => Object.keys(s) }; };
const OLD = {
  'fanglands.session': 'tok-old', 'fanglands.lastname': 'Cohen',
  'fanglands.slot.2': '{"b":2}', 'fanglands.slot.2.at': '400',
  'fanglands.settings': '{"sound":true}', 'fl_learn_bag': '3', 'fanglands.slot.current': '2',
};

test('merge: an address with nothing yet takes the login, every device knight with its stamp, the settings and hints, exactly', () => {
  const a = mem();
  const r = merge(OLD, a, NOW, 'gorkscape.ca');
  for (const k of Object.keys(OLD)) assert.equal(a.s[k], OLD[k], k);
  assert.deepEqual(r.kept, []);
  assert.ok(r.wrote.includes('login') && r.wrote.includes('slot.2'));
});

test('merge: the cloud\'s working copy (slot 1 with its mark) is never brought: the knight is on the server', () => {
  const a = mem();
  const r = merge(Object.assign({ 'fanglands.slot.1': '{"cloud":1}', 'fanglands.slot.1.at': '9', 'fanglands.slot.1.online': '1' }, OLD), a, NOW, 'gorkscape.ca');
  assert.ok(!('fanglands.slot.1' in a.s) && !('fanglands.slot.1.online' in a.s) && !('fanglands.slot.1.at' in a.s));
  assert.ok(r.kept.includes('slot.1'));
  // an unmarked slot 1 (a knight held only on that device) is brought, into slot 1 when it is free and unmarked here
  const b = mem();
  merge({ 'fanglands.slot.1': '{"dev":1}', 'fanglands.slot.1.at': '5' }, b, NOW, 'gorkscape.ca');
  assert.equal(b.s['fanglands.slot.1'], '{"dev":1}');
  // ... and never into a slot 1 that holds the cloud mark here
  const c = mem({ 'fanglands.slot.1.online': '1' });
  merge({ 'fanglands.slot.1': '{"dev":1}', 'fanglands.slot.1.at': '5' }, c, NOW, 'gorkscape.ca');
  assert.ok(!('fanglands.slot.1' in c.s)); assert.equal(c.s['fanglands.slot.2'], '{"dev":1}'); assert.equal(c.s['fanglands.slot.1.online'], '1');
});

test('merge: nothing here is ever written over: a login, every slot (even an older one), settings the kid set', () => {
  const b = mem({ 'fanglands.session': 'tok-new', 'fanglands.lastname': 'Sam', 'fanglands.slot.1': '{"mine":1}', 'fanglands.slot.1.at': '900', 'fanglands.settings': '{"sound":false}', 'fanglands.slot.2': '{"older":1}', 'fanglands.slot.2.at': '100' });
  const r = merge(OLD, b, NOW, 'gorkscape.ca');
  assert.equal(b.s['fanglands.session'], 'tok-new'); assert.equal(b.s['fanglands.lastname'], 'Sam');
  assert.equal(b.s['fanglands.slot.1'], '{"mine":1}'); assert.equal(b.s['fanglands.slot.2'], '{"older":1}'); assert.equal(b.s['fanglands.slot.2.at'], '100');
  assert.equal(b.s['fanglands.settings'], '{"sound":false}');
  assert.equal(b.s['fanglands.slot.3'], '{"b":2}'); assert.equal(b.s['fanglands.slot.3.at'], '400');
  assert.equal(r.moved['slot.2'], 'slot.3');
  assert.equal(b.s['fl_learn_bag'], '3');
});

test('merge: a crafted offer with stamps from the future never replaces a knight here; what it brings is stamped now at most', () => {
  const kid = { 'fanglands.session': 'tok-kid', 'fanglands.slot.2': '{"player":{"playSeconds":144000}}', 'fanglands.slot.2.at': '900000' };
  const c = mem(kid);
  merge({ 'fanglands.session': 'tok-evil', 'fanglands.slot.2': '{"player":{"playSeconds":0}}', 'fanglands.slot.2.at': '9999999999999', 'fanglands.slot.3': '{"x":1}', 'fanglands.slot.3.at': '9999999999999' }, c, NOW, 'gorkscape.ca');
  for (const k of Object.keys(kid)) assert.equal(c.s[k], kid[k], k);
  assert.equal(c.s['fanglands.slot.3'], '{"x":1}'); assert.equal(c.s['fanglands.slot.3.at'], String(NOW));
  assert.equal(c.s['fanglands.slot.4'], '{"player":{"playSeconds":0}}', 'the offered slot 2 found slot 2 taken and went to the first free slot past 1');
  assert.equal(c.s['fanglands.slot.4.at'], String(NOW));
  assert.ok(!('fanglands.slot.1' in c.s), 'a moved knight never goes into slot 1, the cloud knight\'s slot');
});

test('merge: with slots 1 to 3 full a device knight is never left behind: it goes past them (slot 4 and up, which 72-deviceknights offers)', () => {
  const full = mem({ 'fanglands.slot.1': '{"p":1}', 'fanglands.slot.2': '{"p":2}', 'fanglands.slot.3': '{"p":3}', 'fanglands.slot.4': '{"p":4}' });
  const r = merge({ 'fanglands.slot.2': '{"far":1}', 'fanglands.slot.2.at': '50' }, full, NOW, 'gorkscape.ca');
  assert.deepEqual(r.left, []);
  assert.equal(full.s['fanglands.slot.5'], '{"far":1}'); assert.equal(full.s['fanglands.slot.5.at'], '50');
  for (let n = 1; n <= 4; n++) assert.equal(full.s['fanglands.slot.' + n], '{"p":' + n + '}');
  // a slot number past 99 is not a slot the game knows: it is not brought
  const d = mem();
  merge({ 'fanglands.slot.100': '{"x":1}' }, d, NOW, 'gorkscape.ca');
  assert.ok(!Object.keys(d.s).some(k => /^fanglands\.slot\.\d+$/.test(k)));
});

test('merge: an old tab that kept playing a knight brings it up to date in its place, never as a second copy', () => {
  const a = mem({ 'fanglands.slot.2': '{"here":1}' });
  merge({ 'fanglands.slot.2': '{"kn":1,"t":10}', 'fanglands.slot.2.at': '100' }, a, NOW, 'gorkscape.ca');
  assert.equal(a.s['fanglands.slot.3'], '{"kn":1,"t":10}');
  // the old tab played on: the same slot comes again, changed; the copy here was not touched since
  const r = merge({ 'fanglands.slot.2': '{"kn":1,"t":99}', 'fanglands.slot.2.at': '200' }, a, NOW, 'gorkscape.ca');
  assert.equal(a.s['fanglands.slot.3'], '{"kn":1,"t":99}'); assert.equal(a.s['fanglands.slot.3.at'], '200');
  assert.ok(!('fanglands.slot.4' in a.s), 'no second copy');
  assert.deepEqual(r.replaced, ['slot.2']);
  assert.equal(a.s['fanglands.slot.2'], '{"here":1}');
  // logging in moved the copy on (71-login parks slot 1): it is still found and brought up to date where it is now
  const b = mem();
  merge({ 'fanglands.slot.1': '{"dev":1}', 'fanglands.slot.1.at': '5' }, b, NOW, 'gorkscape.ca');
  b.s['fanglands.slot.2'] = b.s['fanglands.slot.1']; b.s['fanglands.slot.1'] = '{"cloud":1}'; b.s['fanglands.slot.1.online'] = '1';
  merge({ 'fanglands.slot.1': '{"dev":2}', 'fanglands.slot.1.at': '6' }, b, NOW, 'gorkscape.ca');
  assert.equal(b.s['fanglands.slot.2'], '{"dev":2}'); assert.equal(b.s['fanglands.slot.1'], '{"cloud":1}'); assert.ok(!('fanglands.slot.3' in b.s));
});

test('merge: a copy that was played here stays as it is (the knight played on fanglands.com is the one kept), with no second copy', () => {
  const a = mem();
  merge({ 'fanglands.slot.2': '{"kn":1,"t":10}' }, a, NOW, 'gorkscape.ca');
  a.s['fanglands.slot.2'] = '{"kn":1,"t":50,"here":true}';
  const r = merge({ 'fanglands.slot.2': '{"kn":1,"t":99}' }, a, NOW, 'gorkscape.ca');
  assert.equal(a.s['fanglands.slot.2'], '{"kn":1,"t":50,"here":true}');
  assert.ok(!Object.keys(a.s).some(k => /^fanglands\.slot\.(1|3|4)$/.test(k)));
  assert.ok(r.kept.includes('slot.2'));
});

test('merge: the same offer again changes nothing (a deleted slot or a logout here stays that way); a save already here is never brought twice', () => {
  const a = mem();
  merge(OLD, a, NOW, 'gorkscape.ca');
  delete a.s['fanglands.slot.2']; delete a.s['fanglands.slot.2.at']; delete a.s['fanglands.session'];
  const r = merge(OLD, a, NOW, 'gorkscape.ca');
  assert.deepEqual(r.wrote, []);
  assert.ok(!('fanglands.session' in a.s) && !('fanglands.slot.2' in a.s));
  const b = mem({ 'fanglands.slot.3': '{"b":2}' });
  merge(OLD, b, NOW, 'gorkscape.ca');
  assert.ok(!('fanglands.slot.2' in b.s), 'the knight is in slot 3 here already');
});

test('merge: www.gorkscape.ca and gorkscape.ca are two different browsers\' worth of storage: the same slot number from each is a different knight', () => {
  const a = mem();
  merge({ 'fanglands.slot.2': '{"bare":1}' }, a, NOW, 'gorkscape.ca');
  merge({ 'fanglands.slot.2': '{"www":1}' }, a, NOW, 'www.gorkscape.ca');
  assert.equal(a.s['fanglands.slot.2'], '{"bare":1}'); assert.equal(a.s['fanglands.slot.3'], '{"www":1}');
  merge({ 'fanglands.slot.2': '{"bare":2}' }, a, NOW, 'gorkscape.ca');
  assert.equal(a.s['fanglands.slot.2'], '{"bare":2}'); assert.equal(a.s['fanglands.slot.3'], '{"www":1}');
});

test('merge: after a first look at the new address the kid\'s own settings still come over; a setting changed here stays', () => {
  const nf = mem({ 'fanglands.settings': '{"kid":false,"text":"normal"}', 'fanglands.kidmode': '0', 'fanglands.muted': '1', 'fanglands.handoff.boot': JSON.stringify({ 'fanglands.settings': '{"kid":false,"text":"normal"}', 'fanglands.kidmode': '0' }) });
  merge({ 'fanglands.settings': '{"kid":true,"text":"large"}', 'fanglands.kidmode': '1', 'fanglands.muted': '0' }, nf, NOW, 'gorkscape.ca');
  assert.equal(nf.s['fanglands.settings'], '{"kid":true,"text":"large"}'); assert.equal(nf.s['fanglands.kidmode'], '1'); assert.equal(nf.s['fanglands.muted'], '1');
  const boot = JSON.parse(nf.s['fanglands.handoff.boot']);
  assert.ok(!('fanglands.settings' in boot) && !('fanglands.kidmode' in boot), 'what a hand-over wrote is the kid\'s from then on');
});

test('merge: the knights already brought into an account are joined from both lists; hand-over notes, the parent page\'s keys and other apps\' keys move nothing', () => {
  const a = mem({ 'fanglands.brought': '["x.1","y.2"]', 'fanglands.slot.1': '{"mine":1}' });
  merge({ 'fanglands.brought': '["y.2","z.3"]', 'fanglands.handoff.seen': '{}', 'fanglands.handoff.pull': '{"n":"0"}', 'fanglands.adminKey': 'k', 'evil': 'x', 'fanglands.slot.1.online': '1', 'fanglands.slot.3.at': '5' }, a, NOW, 'gorkscape.ca');
  assert.deepEqual(JSON.parse(a.s['fanglands.brought']), ['x.1', 'y.2', 'z.3']);
  assert.ok(!('fanglands.adminKey' in a.s) && !('evil' in a.s) && !('fanglands.handoff.pull' in a.s) && !('fanglands.slot.1.online' in a.s) && !('fanglands.slot.3.at' in a.s));
  assert.equal(a.s['fanglands.slot.1'], '{"mine":1}');
});

test('merge: the function is self-contained (the landing page carries its source), and its rule for "other keys" is the game\'s', () => {
  const fn = new Function('"use strict"; return (' + MERGE_SOURCE + ')')();
  const a = mem();
  fn(OLD, a, NOW, 'gorkscape.ca');
  assert.equal(a.s['fanglands.slot.2'], '{"b":2}');
  const game = readFileSync(new URL('../../src/00-handoff.js', import.meta.url), 'utf8');
  const rule = s => /const isOther = (k => [^\n]*);/.exec(s)[1];
  assert.equal(rule(game), rule(MERGE_SOURCE));
});
