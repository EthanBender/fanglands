// Admins: roles on every message, the role check on every admin message, mute, kick, ban, unban, the mod log,
// naps, and spawning through the keeper. The Room with a MemoryStore, in-memory sockets and a fake clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room, CAPS, KICK_TEXT, ROSTER_EVERY } from '../src/room.js';
import { MemoryStore, ALWAYS } from '../src/store.js';

// A pretend world with a clock we control, a chat log we can read and a store we can look into.
function world(store, t0 = 1000) {
  const w = { t: t0, log: [], woke: [] };
  w.store = store || new MemoryStore();
  w.room = new Room({ now: () => w.t, log: (n, text, at) => w.log.push({ n, text, at }), wake: ms => w.woke.push(ms), store: w.store });
  w.sock = () => {
    const s = { got: [], closed: null, state: null, send(str) { s.got.push(JSON.parse(str)); }, close(code, reason) { s.closed = { code, reason }; }, attach(st) { s.state = st; } };
    s.of = t => s.got.filter(m => m.t === t);
    s.last = t => { const l = s.of(t); return l[l.length - 1]; };
    s.clear = () => { s.got.length = 0; };
    return s;
  };
  w.knight = (name, map) => {
    const s = w.sock(); w.room.join(s, name); w.room.message(s, JSON.stringify({ t: 'hello', v: 1 }));
    if (map) w.room.message(s, JSON.stringify({ t: 'p', map, x: 480, y: 480, lv: 3 }));
    return s;
  };
  w.say = (s, m) => w.room.message(s, JSON.stringify(m));
  w.settle = (...socks) => { w.t += ROSTER_EVERY; w.room.tick(); w.woke.length = 0; for (const s of socks) s.clear(); };
  w.later = (ms = 1100) => { w.t += ms; };   // past every admin cap's refill
  return w;
}

// MudGoll the admin, Sam and Ada the players, all on the overworld (MudGoll first in, so the keeper).
function party3() {
  const w = world();
  w.store.addAccount('MudGoll', 'admin'); w.store.addAccount('Sam'); w.store.addAccount('Ada');
  const mud = w.knight('MudGoll', 'over'); w.t += 10;
  const sam = w.knight('Sam', 'over'); w.t += 10;
  const ada = w.knight('Ada', 'over');
  w.settle(mud, sam, ada);
  return { w, mud, sam, ada };
}

const snapshot = store => JSON.stringify({ a: Array.from(store.accounts.values()), l: store.modRows, p: Array.from(store.partyRows.values()) });

test('the role rides on welcome, who, p and chat; a role the client sends is overwritten', () => {
  const w = world();
  w.store.addAccount('MudGoll', 'admin'); w.store.addAccount('Sam');
  const mud = w.knight('MudGoll', 'over'); w.t += 10;
  const sam = w.knight('Sam', 'over');
  assert.deepEqual(mud.last('welcome'), { t: 'welcome', me: 'MudGoll', at: 1000, keeper: 'MudGoll', role: 'admin' });
  assert.deepEqual(sam.last('welcome'), { t: 'welcome', me: 'Sam', at: 1010, keeper: 'MudGoll', role: 'player' });
  assert.deepEqual(sam.last('who').list.map(k => [k.n, k.role]), [['MudGoll', 'admin'], ['Sam', 'player']]);
  assert.deepEqual(w.room.online().map(k => [k.n, k.role]), [['MudGoll', 'admin'], ['Sam', 'player']]);
  w.settle(mud, sam);
  w.say(sam, { t: 'p', map: 'over', x: 5, y: 6, role: 'admin' });
  assert.deepEqual(mud.last('p'), { t: 'p', map: 'over', x: 5, y: 6, role: 'player', n: 'Sam' });
  w.say(mud, { t: 'p', map: 'over', x: 7, y: 8, role: 'player' });
  assert.equal(sam.last('p').role, 'admin');
  w.say(sam, { t: 'p', map: 'over', x: 9, y: 9 });
  assert.equal(mud.last('p').role, 'player');   // always present, even when the sender sent none
  w.say(sam, { t: 'chat', text: 'hi', role: 'admin', n: 'MudGoll' });
  assert.deepEqual(mud.last('chat'), { t: 'chat', n: 'Sam', text: 'hi', at: w.t, role: 'player' });
  w.t += 2000;
  w.say(mud, { t: 'chat', text: 'hello', role: 'player' });
  assert.deepEqual(sam.last('chat'), { t: 'chat', n: 'MudGoll', text: 'hello', at: w.t, role: 'admin' });
});

test('a knight with no account (tests, simulations) is a plain player: welcomed, not muted, not banned', () => {
  const w = world();
  const a = w.knight('Nobody Known', 'over');
  assert.equal(a.last('welcome').role, 'player');
  assert.equal(a.of('muted').length, 0);
  w.say(a, { t: 'chat', text: 'hello' });
  assert.equal(a.last('chat').text, 'hello');
});

test('a non-admin sends each of the ten admin messages: error admin every time and nothing changes', () => {
  const { w, mud, sam, ada } = party3();
  const before = snapshot(w.store), keeper = w.room.keeperOf('over');
  const tries = [
    { t: 'mute', n: 'Ada', span: '5m' }, { t: 'unmute', n: 'Ada' }, { t: 'kick', n: 'Ada' }, { t: 'ban', n: 'Ada' }, { t: 'unban', n: 'Ada' },
    { t: 'modlist' }, { t: 'spawn', type: 'goblin', count: 3, x: 480, y: 480 }, { t: 'spawn_clear' },
    { t: 'party', x: 480, y: 480, hat: 1000, spots: [[10, 10], [11, 10], [12, 10], [10, 11], [11, 11]], table: [{ id: 'coins', min: 5, max: 5, w: 1 }] },
    { t: 'party_end' },
  ];
  for (const m of tries) w.say(sam, m);
  assert.equal(sam.of('error').length, 10);
  assert.ok(sam.of('error').every(e => e.code === 'admin' && e.text === 'only an admin can do that'));
  assert.equal(sam.got.length, 10, JSON.stringify(sam.got));   // nothing else: no mod, no modlist, no party_no
  assert.equal(mud.got.length, 0, JSON.stringify(mud.got));    // the keeper got no spawn, nobody got crackers
  assert.equal(ada.got.length, 0, JSON.stringify(ada.got));
  assert.equal(ada.closed, null); assert.equal(sam.closed, null);
  assert.equal(snapshot(w.store), before);
  assert.equal(w.room.keeperOf('over'), keeper);
  assert.equal(w.room.parties.size, 0);
  assert.deepEqual(w.store.liveParties(w.t), []);
});

test('the cap runs before the role check: a knight hammering admin messages is dropped like any other', () => {
  const { w, sam } = party3();
  for (let i = 0; i < 30 && !sam.closed; i++) w.say(sam, { t: 'mute', n: 'Ada', span: '5m' });
  assert.equal(sam.of('error').filter(e => e.code === 'admin').length, CAPS.mute.burst);
  assert.equal(sam.of('error').filter(e => e.code === 'bad').length, 1);
  assert.deepEqual(sam.closed, { code: 4008, reason: 'too fast' });
  assert.equal(w.store.account('Ada').mutedUntil, 0);
});

test('a player made an admin by the parent page hears it at once, and so does the roster', () => {
  const { w, mud, sam, ada } = party3();
  w.store.setRole('sam', 'admin');
  w.room.setRole('Sam');
  assert.deepEqual(sam.last('role'), { t: 'role', role: 'admin' });
  assert.deepEqual(ada.last('who').list.find(k => k.n === 'Sam').role, 'admin');   // at once, not after two seconds
  assert.deepEqual(mud.last('who').list.find(k => k.n === 'Sam').role, 'admin');
  w.say(sam, { t: 'p', map: 'over', x: 1, y: 1 });
  assert.equal(ada.last('p').role, 'admin');
  w.say(sam, { t: 'mute', n: 'Ada', span: '5m' });
  assert.equal(sam.last('mod').ok, true);
  // and back again
  sam.clear(); ada.clear();
  w.store.setRole('sam', 'player'); w.room.setRole('Sam');
  assert.deepEqual(sam.last('role'), { t: 'role', role: 'player' });
  assert.equal(ada.last('who').list.find(k => k.n === 'Sam').role, 'player');
  w.later();
  w.say(sam, { t: 'unmute', n: 'Ada' });
  assert.equal(sam.last('error').code, 'admin');
  assert.ok(w.store.account('Ada').mutedUntil > w.t);   // still muted: the demoted knight could not lift it
  w.room.setRole('Nobody');   // an unknown or offline knight: nothing to tell, nothing breaks
});

test('the role check reads the store every time: a demotion the Room was never told about still refuses', () => {
  const { w, mud, sam } = party3();
  w.store.setRole('mudgoll', 'player');   // straight into the store, no room.setRole
  w.say(mud, { t: 'mute', n: 'Sam', span: '1h' });
  assert.equal(mud.last('error').code, 'admin');
  assert.equal(w.store.account('Sam').mutedUntil, 0);
  assert.equal(sam.of('muted').length, 0);
  assert.deepEqual(mud.last('role'), { t: 'role', role: 'player' });   // and the knight is told what the store says
  w.store.setRole('mudgoll', 'admin');
  w.later();
  w.say(mud, { t: 'mute', n: 'Sam', span: '1h' });
  assert.equal(mud.last('mod').ok, true);
  assert.equal(sam.last('muted').left, 3600);
});

test('mute: every span (left exact, rounded up), chat refused and not logged, a new mute replaces the old, unmute', () => {
  const { w, mud, sam, ada } = party3();
  w.say(mud, { t: 'mute', n: 'sam', span: '5m' });
  assert.deepEqual(mud.got.filter(m => m.t === 'mod'), [{ t: 'mod', ok: true, act: 'mute', n: 'Sam', left: 300 }]);
  assert.deepEqual(sam.last('muted'), { t: 'muted', left: 300 });
  assert.equal(w.store.account('Sam').mutedUntil, w.t + 300000);
  // Sam's chat goes nowhere and is not logged; Sam hears how long is left
  mud.clear(); ada.clear(); sam.clear();
  w.t += 61000;
  w.say(sam, { t: 'chat', text: 'can anyone hear me' });
  assert.deepEqual(sam.got, [{ t: 'muted', left: 239 }]);
  assert.equal(mud.of('chat').length + ada.of('chat').length, 0);
  assert.equal(w.log.length, 0);
  w.t += 1500;
  w.say(sam, { t: 'chat', text: 'hello?' });
  assert.deepEqual(sam.last('muted'), { t: 'muted', left: 238 });   // 237.5 s rounds up to 238
  // a new mute replaces the old: one hour, one day, until unmuted
  for (const [span, left, ms] of [['1h', 3600, 3600000], ['1d', 86400, 86400000], ['always', -1, null]]) {
    w.later();
    w.say(mud, { t: 'mute', n: 'Sam', span });
    assert.equal(mud.last('mod').left, left, span);
    assert.deepEqual(sam.last('muted'), { t: 'muted', left }, span);
    assert.equal(w.store.account('Sam').mutedUntil, ms == null ? ALWAYS : w.t + ms, span);
  }
  w.t += 400 * 24 * 3600 * 1000;   // a year later, still muted
  w.say(sam, { t: 'chat', text: 'still?' });
  assert.deepEqual(sam.last('muted'), { t: 'muted', left: -1 });
  // unmute: the knight hears it and can chat again
  mud.clear(); sam.clear();
  w.say(mud, { t: 'unmute', n: 'Sam' });
  assert.deepEqual(mud.last('mod'), { t: 'mod', ok: true, act: 'unmute', n: 'Sam' });
  assert.deepEqual(sam.got, [{ t: 'unmuted' }]);
  assert.equal(w.store.account('Sam').mutedUntil, 0);
  w.t += 1500;
  w.say(sam, { t: 'chat', text: 'thanks' });
  assert.equal(mud.last('chat').text, 'thanks');
  assert.deepEqual(w.log.map(l => l.text), ['thanks']);
});

test('a timed mute runs out by itself: nothing is sent, the next chat line goes through', () => {
  const { w, mud, sam } = party3();
  w.say(mud, { t: 'mute', n: 'Sam', span: '5m' });
  sam.clear();
  w.t += 300000 - 1;
  w.say(sam, { t: 'chat', text: 'now?' });
  assert.deepEqual(sam.got, [{ t: 'muted', left: 1 }]);
  w.t += 1500; w.room.tick();
  assert.equal(sam.of('unmuted').length, 0);
  w.say(sam, { t: 'chat', text: 'now' });
  assert.equal(mud.last('chat').text, 'now');
});

test('kick: error kicked, then close 4005; the knight may come straight back', () => {
  const { w, mud, sam, ada } = party3();
  w.say(mud, { t: 'kick', n: 'Sam' });
  assert.deepEqual(sam.last('error'), { t: 'error', code: 'kicked', text: KICK_TEXT });
  assert.equal(sam.closed.code, 4005);
  assert.deepEqual(mud.last('mod'), { t: 'mod', ok: true, act: 'kick', n: 'Sam' });
  assert.equal(mud.got[mud.got.length - 1].t, 'modlist');
  assert.ok(!w.room.isOnline('Sam'));
  assert.deepEqual(ada.last('who').list.map(k => k.n), ['MudGoll', 'Ada']);
  const again = w.knight('Sam', 'over');
  assert.equal(again.last('welcome').me, 'Sam');
  assert.ok(w.room.isOnline('Sam'));
});

test('ban: error banned and close 4003; a new join is refused with 4003 until unbanned', () => {
  const { w, mud, sam } = party3();
  w.say(mud, { t: 'ban', n: 'Sam' });
  assert.deepEqual(sam.last('error'), { t: 'error', code: 'banned', text: 'this knight is banned' });
  assert.equal(sam.closed.code, 4003);
  assert.equal(w.store.account('Sam').banned, true);
  assert.deepEqual(mud.last('modlist'), { t: 'modlist', muted: [], banned: [{ n: 'Sam' }] });
  const back = w.sock(); w.room.join(back, 'Sam');
  assert.deepEqual(back.got, [{ t: 'error', code: 'banned', text: 'this knight is banned' }]);
  assert.deepEqual(back.closed, { code: 4003, reason: 'banned' });
  w.say(back, { t: 'hello', v: 1 });
  assert.equal(back.of('welcome').length, 0);
  assert.ok(!w.room.isOnline('Sam'));
  // banning someone who is not on line works too
  w.later();
  w.store.addAccount('Bo');
  w.say(mud, { t: 'ban', n: 'Bo' });
  assert.deepEqual(mud.last('mod'), { t: 'mod', ok: true, act: 'ban', n: 'Bo' });
  assert.deepEqual(mud.last('modlist').banned, [{ n: 'Bo' }, { n: 'Sam' }]);
  // unban: Sam may join again
  w.later();
  w.say(mud, { t: 'unban', n: 'Sam' });
  assert.deepEqual(mud.last('mod'), { t: 'mod', ok: true, act: 'unban', n: 'Sam' });
  assert.equal(w.store.account('Sam').banned, false);
  const ok = w.knight('Sam', 'over');
  assert.equal(ok.last('welcome').me, 'Sam');
});

test('admins are untouchable from inside the game; self, unknown, offline and bad are refused and change nothing', () => {
  const { w, mud, sam } = party3();
  w.store.addAccount('Ada2', 'admin'); w.store.addAccount('Bo');
  const before = snapshot(w.store);
  const cases = [
    [{ t: 'mute', n: 'Ada2', span: '5m' }, { ok: false, act: 'mute', n: 'Ada2', code: 'admin' }],
    [{ t: 'ban', n: 'ada2' }, { ok: false, act: 'ban', n: 'Ada2', code: 'admin' }],
    [{ t: 'kick', n: 'MudGoll' }, { ok: false, act: 'kick', n: 'MudGoll', code: 'self' }],
    [{ t: 'mute', n: ' mudgoll ', span: '1h' }, { ok: false, act: 'mute', n: 'MudGoll', code: 'self' }],
    [{ t: 'mute', n: 'Nobody', span: '5m' }, { ok: false, act: 'mute', n: 'Nobody', code: 'unknown' }],
    [{ t: 'kick', n: 'Bo' }, { ok: false, act: 'kick', n: 'Bo', code: 'offline' }],
    [{ t: 'mute', n: 'Sam', span: '2h' }, { ok: false, act: 'mute', n: 'Sam', code: 'bad' }],
    [{ t: 'mute', n: 'Sam' }, { ok: false, act: 'mute', n: 'Sam', code: 'bad' }],
    [{ t: 'unmute' }, { ok: false, act: 'unmute', n: '', code: 'bad' }],
    [{ t: 'ban', n: 'x'.repeat(41) }, { ok: false, act: 'ban', n: 'x'.repeat(40), code: 'bad' }],
    [{ t: 'kick', n: 42 }, { ok: false, act: 'kick', n: '', code: 'bad' }],
  ];
  for (const [m, want] of cases) {
    mud.clear(); w.later();
    w.say(mud, m);
    assert.deepEqual(mud.got, [Object.assign({ t: 'mod' }, want)], JSON.stringify(m));   // no modlist after a refusal
  }
  assert.equal(snapshot(w.store), before);
  assert.equal(sam.closed, null);
  assert.equal(sam.of('muted').length, 0);
});

test('one mod_log row per action, with the right fields, and a fresh modlist after every success', () => {
  const { w, mud } = party3();
  w.store.addAccount('Zed'); w.store.addAccount('Amy'); w.store.addAccount('Bo');
  const t0 = w.t;
  const steps = [
    [{ t: 'mute', n: 'Zed', span: '5m' }, { muted: [{ n: 'Zed', left: 300 }], banned: [] }],
    [{ t: 'mute', n: 'Amy', span: 'always' }, { muted: [{ n: 'Amy', left: -1 }, { n: 'Zed', left: 299 }], banned: [] }],
    [{ t: 'unmute', n: 'Zed' }, { muted: [{ n: 'Amy', left: -1 }], banned: [] }],
    [{ t: 'kick', n: 'Sam' }, { muted: [{ n: 'Amy', left: -1 }], banned: [] }],
    [{ t: 'ban', n: 'Bo' }, { muted: [{ n: 'Amy', left: -1 }], banned: [{ n: 'Bo' }] }],
    [{ t: 'unban', n: 'Bo' }, { muted: [{ n: 'Amy', left: -1 }], banned: [] }],
  ];
  for (const [m, list] of steps) {
    mud.clear(); w.later(1000);
    w.say(mud, m);
    // (a kick also brings the ordinary left / who for the knight who went; the answer is mod, then modlist, last)
    assert.deepEqual(mud.got.map(x => x.t).filter(t => t === 'mod' || t === 'modlist'), ['mod', 'modlist'], JSON.stringify(m));
    assert.equal(mud.got[mud.got.length - 1].t, 'modlist');
    assert.deepEqual(mud.last('modlist'), Object.assign({ t: 'modlist' }, list), JSON.stringify(m));
  }
  assert.deepEqual(w.store.modLog(10), [
    { at: t0 + 6000, by: 'MudGoll', act: 'unban', target: 'Bo', detail: '' },
    { at: t0 + 5000, by: 'MudGoll', act: 'ban', target: 'Bo', detail: '' },
    { at: t0 + 4000, by: 'MudGoll', act: 'kick', target: 'Sam', detail: '' },
    { at: t0 + 3000, by: 'MudGoll', act: 'unmute', target: 'Zed', detail: '' },
    { at: t0 + 2000, by: 'MudGoll', act: 'mute', target: 'Amy', detail: 'always' },
    { at: t0 + 1000, by: 'MudGoll', act: 'mute', target: 'Zed', detail: '5m' },
  ]);
  // asking for the lists
  mud.clear(); w.later();
  w.say(mud, { t: 'modlist' });
  assert.deepEqual(mud.got, [{ t: 'modlist', muted: [{ n: 'Amy', left: -1 }], banned: [] }]);
});

test('mutes and bans hold through a nap (a new Room on the same store) and on reconnect: muted comes after welcome', () => {
  const { w, mud, sam } = party3();
  w.store.addAccount('Bo');
  w.say(mud, { t: 'mute', n: 'Sam', span: 'always' }); w.later();
  w.say(mud, { t: 'ban', n: 'Bo' });
  // the world naps: a new Room on the same store; the sockets come back from their attachments
  const w2 = world(w.store, w.t + 60000);
  const mud2 = w2.sock(), sam2 = w2.sock();
  w2.room.restore(mud2, mud.state); w2.room.restore(sam2, sam.state);
  assert.equal(mud2.got.length + sam2.got.length, 0);   // a restore tells nobody anything
  w2.say(sam2, { t: 'chat', text: 'am I free' });
  assert.deepEqual(sam2.got, [{ t: 'muted', left: -1 }]);
  assert.equal(mud2.of('chat').length, 0);
  const bo = w2.sock(); w2.room.join(bo, 'Bo');
  assert.equal(bo.closed.code, 4003);
  // the role after a nap comes from the store, not the attachment
  assert.equal(w2.room.knights.get(mud2).role, 'admin');
  assert.equal(w2.room.knights.get(sam2).role, 'player');
  // Sam reconnects: welcome, the roster, then muted
  w2.room.leave(sam2);
  const sam3 = w2.knight('Sam');
  assert.deepEqual(sam3.got.map(m => m.t).filter(t => ['welcome', 'who', 'muted'].includes(t)), ['welcome', 'who', 'muted']);
  assert.deepEqual(sam3.last('muted'), { t: 'muted', left: -1 });
  // a knight banned while the world slept is refused at restore as well
  w.store.addAccount('Cy'); const cy = w.knight('Cy', 'over');
  w.store.setBanned('cy', true);
  const w3 = world(w.store); const cy3 = w3.sock();
  w3.room.restore(cy3, cy.state);
  assert.equal(cy3.closed.code, 4003);
  assert.ok(!w3.room.isOnline('Cy'));
});

test('the parent page mutes and unmutes: room.muteChanged tells an online knight', () => {
  const { w, sam } = party3();
  w.store.setMute('sam', w.t + 3600000);
  w.room.muteChanged('Sam');
  assert.deepEqual(sam.last('muted'), { t: 'muted', left: 3600 });
  w.store.setMute('sam', 0);
  w.room.muteChanged('Sam');
  assert.deepEqual(sam.last('unmuted'), { t: 'unmuted' });
  w.room.muteChanged('Nobody');   // nothing to tell, nothing breaks
});

test('spawn goes to the keeper of the admin\'s map only: the admin itself when it keeps the map', () => {
  const w = world();
  w.store.addAccount('MudGoll', 'admin'); w.store.addAccount('Sam'); w.store.addAccount('Zed');
  const mud = w.knight('MudGoll', 'over'); w.t += 10;
  const sam = w.knight('Sam', 'over'); w.t += 10;
  const zed = w.knight('Zed', 'cave1');
  w.settle(mud, sam, zed);
  w.say(mud, { t: 'spawn', type: 'goblin', count: 3, x: 480, y: 500 });
  const s = mud.last('spawn');
  assert.equal(s.by, 'MudGoll'); assert.equal(s.type, 'goblin'); assert.equal(s.count, 3); assert.equal(s.x, 480); assert.equal(s.y, 500);
  assert.match(s.sid, /^[0-9a-z]+$/);
  assert.deepEqual(Object.keys(s).sort(), ['by', 'count', 'sid', 't', 'type', 'x', 'y']);
  assert.equal(sam.of('spawn').length + zed.of('spawn').length, 0);
  w.later();
  w.say(mud, { t: 'spawn_clear' });
  assert.deepEqual(mud.last('spawn_clear'), { t: 'spawn_clear', by: 'MudGoll' });
  assert.equal(sam.of('spawn_clear').length + zed.of('spawn_clear').length, 0);
});

test('spawn: when someone else keeps the map it goes to them; a fresh sid every time, even after a nap', () => {
  const w = world();
  w.store.addAccount('MudGoll', 'admin'); w.store.addAccount('Sam'); w.store.addAccount('Zed');
  const sam = w.knight('Sam', 'over'); w.t += 10;
  const mud = w.knight('MudGoll', 'over'); w.t += 10;
  const zed = w.knight('Zed', 'cave1');
  w.settle(mud, sam, zed);
  const sids = [];
  for (let i = 0; i < 5; i++) {
    w.later();
    w.say(mud, { t: 'spawn', type: 'wolf', count: 2, x: 100, y: 200 });
    const s = sam.last('spawn');
    assert.equal(s.by, 'MudGoll'); assert.equal(s.type, 'wolf'); assert.match(s.sid, /^[0-9a-z]+$/);
    sids.push(s.sid);
  }
  // the same millisecond still gives a new sid
  w.say(mud, { t: 'spawn', type: 'wolf', count: 1, x: 100, y: 200 });
  sids.push(sam.last('spawn').sid);
  assert.equal(mud.of('spawn').length + zed.of('spawn').length, 0);
  // after a nap the counter starts again, but the time has moved on
  const w2 = world(w.store, w.t + 30000);
  const sam2 = w2.sock(), mud2 = w2.sock();
  w2.room.restore(sam2, sam.state); w2.room.restore(mud2, mud.state);
  w2.say(mud2, { t: 'spawn', type: 'wolf', count: 1, x: 100, y: 200 });
  sids.push(sam2.last('spawn').sid);
  assert.equal(new Set(sids).size, sids.length, JSON.stringify(sids));
  w.later();
  w.say(mud, { t: 'spawn_clear' });
  assert.deepEqual(sam.last('spawn_clear'), { t: 'spawn_clear', by: 'MudGoll' });
  // an admin on another map spawns for that map's keeper
  w.later();
  w.say(zed, { t: 'mon', list: [] });   // Zed keeps the cave and is streaming it, so Zed stays its keeper when MudGoll walks in
  w.say(mud, { t: 'p', map: 'cave1', x: 48, y: 48 });
  assert.equal(w.room.keeperOf('cave1').name, 'Zed');
  w.say(mud, { t: 'spawn', type: 'spider', count: 1, x: 48, y: 48 });
  assert.equal(zed.last('spawn').type, 'spider');
});

test('spawn: a bad type, count or position is refused with error bad and goes nowhere', () => {
  const { w, mud, sam } = party3();
  const bad = [
    { type: 'Goblin', count: 1, x: 1, y: 1 }, { type: 'gob lin', count: 1, x: 1, y: 1 }, { type: 'x'.repeat(41), count: 1, x: 1, y: 1 },
    { type: 'goblin', count: 0, x: 1, y: 1 }, { type: 'goblin', count: 21, x: 1, y: 1 }, { type: 'goblin', count: 1.5, x: 1, y: 1 },
    { type: 'goblin', count: 1, x: -1, y: 1 }, { type: 'goblin', count: 1, x: 1, y: 100001 }, { type: 'goblin', count: 1, x: '5', y: 1 },
    { count: 1, x: 1, y: 1 },
  ];
  for (const m of bad) {
    mud.clear(); w.later();
    w.say(mud, Object.assign({ t: 'spawn' }, m));
    assert.deepEqual(mud.got, [{ t: 'error', code: 'bad', text: 'that spawn did not pass the checks' }], JSON.stringify(m));
  }
  assert.equal(sam.of('spawn').length, 0);
  w.later();
  w.say(mud, { t: 'spawn', type: 'goblin', count: 20, x: 100000, y: 0 });   // the edges are allowed
  assert.equal(mud.last('spawn').count, 20);
});

test('admin messages before hello are ignored without an answer', () => {
  const w = world();
  w.store.addAccount('MudGoll', 'admin'); w.store.addAccount('Sam');
  const sam = w.knight('Sam', 'over');
  const mud = w.sock(); w.room.join(mud, 'MudGoll');
  w.say(mud, { t: 'mute', n: 'Sam', span: '5m' });
  w.say(mud, { t: 'modlist' });
  assert.equal(mud.got.length, 0);
  assert.equal(w.store.account('Sam').mutedUntil, 0);
  assert.equal(sam.of('muted').length, 0);
});
