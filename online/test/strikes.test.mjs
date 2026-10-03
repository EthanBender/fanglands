// Word strikes and renames (docs/ONLINE.md, "Word strikes" and "Renaming a knight"): the count, the warnings, the 24 hours
// out, the fade after 30 clean days, the lockout on every path in, an admin clearing it, every existing name checked, and a
// new name rewritten everywhere a name is kept. The Room with a MemoryStore for the chat rules; SqlStore and MemoryStore
// against one script; the whole World on node's SQLite for the routes, with fake sockets and a clock the test moves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Room, WORD_WARN_1, WORD_WARN_2, WORDS_CODE, RENAMED_CODE, wordsText, renamedText } from '../src/room.js';
import { MemoryStore, SqlStore, SCHEMA, migrate, WORD_STRIKE_FADE, WORD_LOCK_MS } from '../src/store.js';
import { makeHash } from '../src/auth.js';
import { GAME_TALK, GAME_NAMES } from './game-talk.mjs';

const DAY = 24 * 3600 * 1000;

// ---------------------------------------------------------------------------
// the Room, a MemoryStore and a fake clock
// ---------------------------------------------------------------------------
function world(store, t0 = 1000) {
  const w = { t: t0, logged: [] };
  w.store = store || new MemoryStore();
  w.room = new Room({ now: () => w.t, wake: () => { }, store: w.store, log: (n, text, at) => w.logged.push({ n, text, at }) });
  w.sock = () => {
    const s = { got: [], closed: null, state: null, send(str) { s.got.push(JSON.parse(str)); }, close(code, reason) { if (!s.closed) s.closed = { code, reason }; }, attach(st) { s.state = JSON.parse(JSON.stringify(st)); } };
    s.last = t => s.got.filter(m => m.t === t).pop();
    s.all = t => s.got.filter(m => m.t === t);
    return s;
  };
  w.knight = name => { const s = w.sock(); w.room.join(s, name); w.room.message(s, JSON.stringify({ t: 'hello', v: 1 })); return s; };
  w.say = (s, text) => { w.t += 2000; w.room.message(s, JSON.stringify({ t: 'chat', text })); };
  return w;
}

test('a clean line is no strike; a starred-out line is, with the warning, then the last warning, then 24 hours out', () => {
  const w = world(); w.store.addAccount('Sam'); w.store.addAccount('Ada');
  const sam = w.knight('Sam'), ada = w.knight('Ada');
  w.say(sam, 'hello knights');
  assert.equal(w.store.wordStrikes('Sam', w.t).strikes, 0);
  assert.equal(sam.all('strike').length, 0);
  // the first: the masked line still goes out to everyone, then the warning to Sam alone
  w.say(sam, 'you are gay');
  assert.deepEqual(ada.last('chat').text, '*** *** ***');
  assert.deepEqual(sam.last('strike'), { t: 'strike', n: 1, text: WORD_WARN_1 });
  assert.equal(ada.all('strike').length, 0);
  assert.equal(WORD_WARN_1, "That word isn't allowed here. This is your warning.");
  // the second
  w.say(sam, 'what the f u c k');
  assert.deepEqual(sam.last('strike'), { t: 'strike', n: 2, text: WORD_WARN_2 });
  assert.equal(WORD_WARN_2, "Last warning. Do it again and you'll be kept out for 24 hours.");
  assert.equal(sam.closed, null);
  // the third: the line goes out masked, then the error with the time it ends, then close 4006
  w.say(sam, 'you idiot');
  const at = w.t;
  assert.equal(ada.last('chat').text, '*** *****');
  assert.deepEqual(sam.last('error'), { t: 'error', code: 'words', text: wordsText(at + WORD_LOCK_MS, at), until: at + WORD_LOCK_MS, n: 3 });
  assert.equal(wordsText(at + WORD_LOCK_MS, at), "You're kept out for 24 hours more for bad words.");
  assert.equal(sam.closed.code, WORDS_CODE); assert.equal(WORDS_CODE, 4006);
  assert.equal(w.room.isOnline('Sam'), false);
  assert.deepEqual(w.store.wordStrikes('Sam', w.t), { strikes: 3, at, lockedUntil: at + DAY });
  // one mod_log row per strike, by the word filter, with the line as it was typed (review round 3: the parent page has to be
  // able to tell whether a strike was fair); the chat log has only the masked lines
  assert.deepEqual(w.store.modLog(10).reverse().map(r => [r.by, r.act, r.target, r.detail]),
    [['word filter', 'strike', 'Sam', '1: you are gay'], ['word filter', 'strike', 'Sam', '2: what the f u c k'], ['word filter', 'strike', 'Sam', '3, kept out 24 hours: you idiot']]);
  assert.ok(w.logged.every(l => !/gay|fuck|idiot|f u c k/i.test(l.text)));
  // Ada never had a strike
  assert.equal(w.store.wordStrikes('Ada', w.t).strikes, 0);
});

test('kept out: join and restore are refused with the time until it ends; after 24 hours back in; the next strike is out again', () => {
  const w = world(); w.store.addAccount('Sam');
  let sam = w.knight('Sam');
  for (const t of ['shit', 'shit', 'shit']) w.say(sam, t);
  const until = w.store.wordStrikes('Sam', w.t).lockedUntil;
  assert.equal(sam.closed.code, 4006);
  // a new socket a minute later: refused, with the error first
  w.t += 60000;
  const again = w.sock(); w.room.join(again, 'Sam');
  assert.deepEqual(again.got, [{ t: 'error', code: 'words', text: wordsText(until, w.t), until }]);
  assert.equal(again.closed.code, 4006);
  assert.equal(w.room.isOnline('Sam'), false);
  // a socket the world restores after a nap: refused the same way
  const napped = w.sock(); w.room.restore(napped, { name: 'Sam', since: w.t - 5000, hello: true, map: 'over' });
  assert.equal(napped.closed.code, 4006); assert.equal(napped.last('error').code, 'words');
  assert.equal(w.room.online().length, 0);
  // one millisecond before the end: still out; at the end: in
  w.t = until - 1; const early = w.sock(); w.room.join(early, 'Sam'); assert.equal(early.closed.code, 4006);
  w.t = until; sam = w.knight('Sam');
  assert.equal(sam.closed, null); assert.equal(sam.last('welcome').me, 'Sam');
  // the count is still 3: the very next bad line is out for 24 hours again (third and every later strike)
  w.say(sam, 'you stupid');
  assert.equal(sam.closed.code, 4006);
  assert.equal(sam.last('error').n, 4);
  assert.equal(w.store.wordStrikes('Sam', w.t).lockedUntil, w.t + WORD_LOCK_MS);
});

test('strikes fade after 30 clean days: 29 days on they still count, 30 days on the count starts again', () => {
  const w = world(); w.store.addAccount('Sam');
  const sam = w.knight('Sam');
  w.say(sam, 'shit');
  w.t += 29 * DAY;
  w.say(sam, 'shit');
  assert.equal(sam.last('strike').n, 2);
  // 30 clean days after the second: faded, so the next one is a first warning again
  w.t += 30 * DAY;
  assert.equal(w.store.wordStrikes('Sam', w.t).strikes, 0);
  w.say(sam, 'shit');
  assert.deepEqual(sam.last('strike'), { t: 'strike', n: 1, text: WORD_WARN_1 });
  assert.equal(sam.closed, null);
  assert.equal(WORD_STRIKE_FADE, 30 * DAY);
});

test('no strike for a muted line (it goes nowhere), for a knight with no account, or for a line with nothing starred; admins count too', () => {
  const w = world(); w.store.addAccount('Sam'); w.store.addAccount('MudGoll', 'admin');
  const sam = w.knight('Sam'), mud = w.knight('MudGoll'), ghost = w.knight('Ghost');
  w.store.setMute('sam', w.t + 3600000);
  w.say(sam, 'shit');
  assert.equal(w.store.wordStrikes('Sam', w.t).strikes, 0);
  assert.equal(sam.last('muted').t, 'muted');
  w.say(ghost, 'shit');
  assert.equal(ghost.all('strike').length, 0);
  for (const t of ['kill the goblin', 'I made a hoe', 'my uncle is gay', 'hit the dummy']) w.say(mud, t);
  assert.equal(w.store.wordStrikes('MudGoll', w.t).strikes, 0);
  // "shut up!" on its own is also a surprised "no way!": starred out, no strike. Said to a noob it is one.
  w.say(mud, 'shut up');
  assert.equal(w.store.wordStrikes('MudGoll', w.t).strikes, 0);
  w.say(mud, 'shut up noob');
  assert.deepEqual(mud.last('strike'), { t: 'strike', n: 1, text: WORD_WARN_1 });
});

// Review round 1 (by eye and play): a kid chatting about the game was out of the world 15 seconds after his first line.
test('game talk in a real Room is no strike, and the other knight sees it as it was said; a line aimed at a knight on line is', () => {
  const w = world(); w.store.addAccount('Cohen'); w.store.addAccount('Leo');
  const cohen = w.knight('Cohen'), leo = w.knight('Leo');
  const lines = ['this boss is stupid hard', 'lets go die to the dragon again', 'stupid lag', 'ur dumb sword is cool', 'your fat dragon pet', 'im gonna go die in the lava', 'shut up no way you got the sword?', "I'm such a loser lol"];
  for (const t of lines) w.say(cohen, t);
  assert.deepEqual(leo.all('chat').map(m => m.text), lines);
  assert.equal(cohen.all('strike').length, 0); assert.equal(cohen.closed, null);
  assert.equal(w.store.wordStrikes('Cohen', w.t).strikes, 0);
  // the name of a knight on line after "shut up" means it was said to that knight
  w.say(cohen, 'shut up leo');
  assert.equal(leo.last('chat').text, '**** ** leo');
  assert.deepEqual(cohen.last('strike'), { t: 'strike', n: 1, text: WORD_WARN_1 });
});

// Review round 3: a kid was kept out for 24 hours for typing his coin count (455 read as "ass"), for an ordinary word with a
// bad one inside it (swanky), for a "you" that ended the sentence before, for shouting at a monster, and for a surprised
// "shut up!". Said in a real Room: the other knight sees numbers exactly as typed, and none of it is a strike.
test('a kid saying coin counts, hidden words, mild words, monster taunts and surprised shouts all evening gets no strike', () => {
  const w = world(); w.store.addAccount('Cohen'); w.store.addAccount('Leo');
  const cohen = w.knight('Cohen'), leo = w.knight('Leo');
  const numbers = ['455', 'i have 455 coins', '422 gold', '8008', 'boss has 8008 hp', '7175', '5318008', '455k', 'x8008', '80085'];
  for (const t of numbers) w.say(cohen, t);
  assert.deepEqual(leo.all('chat').map(m => m.text), numbers);
  const talk = [
    'booboo', 'swanky hat', 'my pussycat', 'fire retardant potion', 'Montenegro', 'Scunthorpe',
    'thank you. stupid lag', 'got you. dumb boss is down', 'you stupid goblin', 'take that you ugly troll', 'you dumb dragon get back here',
    'shut up!', 'SHUT UP!!', 'shut up dude no way', 'my mom said shut up', 'he said you idiot to me', 'i hate you boss', 'i hate you',
    'damn', 'wtf was that', 'lmfao', 'oh crap the boss', 'that sword is badass', 'a bastard sword', 'a chink in his armour', 'a blue tit', 'suicide mission',
    'are you stupid?', 'can you kill yourself with a bomb', 'idiot me fell in the lava', 'lets go die to the dragon again', 'just go die to the boss lol',
  ];
  for (const t of talk) w.say(cohen, t);
  assert.equal(cohen.all('strike').length, 0); assert.equal(cohen.closed, null);
  assert.equal(w.store.wordStrikes('Cohen', w.t).strikes, 0);
  assert.equal(w.store.modLog(100).filter(r => r.act === 'strike').length, 0);
  // and an insult said at Leo still counts, with what was typed on the row for the parent page
  w.say(cohen, 'shut up leo');
  assert.deepEqual(cohen.last('strike'), { t: 'strike', n: 1, text: WORD_WARN_1 });
  assert.deepEqual(w.store.modLog(1).map(r => [r.act, r.target, r.detail]), [['strike', 'Cohen', '1: shut up leo']]);
});

// Review round 4 (by eye and play, iPad + laptop): with a knight named Goblin on line, Cohen's "you stupid goblin", "die you
// dumb goblin" and "you ugly goblin" were strikes 1, 2 and 3, and he was kept out for 24 hours. "go die, it puts you back at
// town" (dying puts a knight back at the respawn point) was a strike too, and so were "got you. stupid lol" and "idiot".
test('round 4: knights named Goblin, Dragon, Boss, King and Wolf on line; game talk, help to "go die" and monster taunts are no strike', () => {
  const w = world();
  const names = ['Cohen', 'Leo', 'Goblin', 'Dragon', 'Boss', 'King', 'Wolf', 'Gnasher', 'Bro', 'Now'];
  for (const n of names) w.store.addAccount(n);
  const k = Object.fromEntries(names.map(n => [n, w.knight(n)]));
  const said = [
    'you stupid goblin', 'die you dumb goblin', 'you ugly goblin', 'you stupid dragon', 'shut up dragon', 'i hate you goblin', 'go die goblin', 'you fat king', 'shut up boss',
    'go die, it puts you back at town', 'just go die, you respawn at the castle', 'stuck? just go die. you respawn', 'go die. its faster than walking', 'go die then',
    'you stupid, ugly goblin', "you're so dumb, dragon", 'you idiot, gnasher', 'you ugly, fat troll', 'haha you dumb, slow spider',
    'thank you. idiot i forgot my sword', 'got you. stupid lol', 'see you. loser lol', 'thank you. dumb!',
    'idiot', 'idiot!', 'lol idiot', 'lol loser', 'loser', 'MORON!', 'gay?', 'lets assess the damage', 'read the annals',
  ];
  for (const t of said) w.say(k.Cohen, t);
  assert.equal(k.Cohen.all('strike').length, 0); assert.equal(k.Cohen.closed, null);
  assert.equal(w.store.wordStrikes('Cohen', w.t).strikes, 0);
  // every line of the shared game-talk list, said by Cohen and by the knight named Goblin, with all of them on line
  for (const t of GAME_TALK) { w.say(k.Cohen, t); w.say(k.Goblin, t); }
  for (const n of names) { assert.equal(k[n].all('strike').length, 0, n); assert.equal(w.store.wordStrikes(n, w.t).strikes, 0, n); }
  assert.equal(w.store.modLog(1000).filter(r => r.act === 'strike').length, 0);
  assert.equal(w.room.isOnline('Cohen'), true);
  // the other knights still see every line (starred where it has to be)
  assert.equal(k.Leo.all('chat').filter(m => m.n === 'Cohen').length, said.length + GAME_TALK.length);
  // a knight's own name is never "the person": Cohen saying his own name is no strike; Leo saying it at him is
  w.say(k.Cohen, 'shut up cohen'); assert.equal(k.Cohen.all('strike').length, 0);
  w.say(k.Leo, 'shut up cohen'); assert.deepEqual(k.Leo.last('strike'), { t: 'strike', n: 1, text: WORD_WARN_1 });
  // and an insult with a comma said to a knight whose name is nobody else's still counts
  w.say(k.Cohen, 'you idiot, leo'); assert.deepEqual(k.Cohen.last('strike'), { t: 'strike', n: 1, text: WORD_WARN_1 });
  assert.ok(GAME_NAMES.includes('Goblin'));
});

test('a Room given an old-style filter (a string back) still filters and counts nothing', () => {
  const store = new MemoryStore(); store.addAccount('Sam');
  const room = new Room({ now: () => 5000, wake: () => { }, store, filter: s => s.toUpperCase() });
  const s = { got: [], send(str) { s.got.push(JSON.parse(str)); }, close() { } };
  room.join(s, 'Sam'); room.message(s, JSON.stringify({ t: 'hello', v: 1 })); room.message(s, JSON.stringify({ t: 'chat', text: 'shit' }));
  assert.equal(s.got.filter(m => m.t === 'chat').pop().text, 'SHIT');
  assert.equal(store.wordStrikes('Sam', 5000).strikes, 0);
});

// ---------------------------------------------------------------------------
// SqlStore and MemoryStore answer the strike and rename calls the same way
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
const wake = sql => { for (const stmt of SCHEMA.split(';')) if (stmt.trim()) sql.exec(stmt); return migrate(sql); };

test('SqlStore and MemoryStore: the same counts, fade, lock, clear and rename for the same calls', () => {
  const db = new DatabaseSync(':memory:'), sql = sqlOf(db); wake(sql);
  for (const n of ['Sam', 'Ada', 'Bad Name']) sql.exec('INSERT INTO accounts (name_lc, name, salt, hash, created, last_seen) VALUES (?, ?, ?, ?, ?, ?)', n.toLowerCase(), n, 's', 'h', 1, 1);
  const mem = new MemoryStore(); for (const n of ['Sam', 'Ada', 'Bad Name']) mem.addAccount(n);
  const script = st => {
    const out = [];
    const say = (what, v) => out.push([what, JSON.parse(JSON.stringify(v === undefined ? null : v))]);
    say('fresh', st.wordStrikes('sam', 1000));
    say('nobody', st.wordStrikes('nobody', 1000));
    say('add 1', st.addWordStrike('Sam', 1000));
    say('add 2', st.addWordStrike('SAM', 2000));
    say('add nobody', st.addWordStrike('nobody', 2000));
    say('after 2', st.wordStrikes('sam', 2000));
    say('29 days on', st.wordStrikes('sam', 2000 + 29 * DAY));
    say('30 days on', st.wordStrikes('sam', 2000 + 30 * DAY));
    say('add after fade', st.addWordStrike('sam', 2000 + 30 * DAY));
    st.addWordStrike('sam', 3000 + 30 * DAY); say('add 3', st.addWordStrike('sam', 4000 + 30 * DAY));
    st.setWordLock('sam', 4000 + 31 * DAY);
    say('locked', st.wordStrikes('sam', 5000 + 30 * DAY));
    st.addWordStrike('ada', 10);
    st.clearWordStrikes('sam');
    say('cleared', st.wordStrikes('sam', 5000 + 30 * DAY));
    say('ada untouched', st.wordStrikes('ada', 20));
    // a rename: the account and the display copies the MemoryStore keeps
    st.log({ at: 1, by: 'MudGoll', act: 'mute', target: 'Bad Name', detail: '5m' });
    st.log({ at: 2, by: 'bad name', act: 'kick', target: 'Ada', detail: '' });
    st.addTrade({ at: 3, a: 'Bad Name', b: 'Ada', aGave: [{ id: 'bread', qty: 1 }], bGave: [] });
    const lid = st.loginStart('bad name', 4); st.loginEnd(lid, 9);
    st.addWordStrike('bad name', 50);
    say('rename', st.rename('BAD  name', 'Good Name'));
    say('rename nobody', st.rename('nobody', 'Whoever'));
    say('old gone', st.account('bad name'));
    say('new there', st.account('good name'));
    say('strikes moved', st.wordStrikes('good name', 60));
    say('modlog', st.modLog(10));
    say('trades', st.unackedTrades('good name', 0));
    say('ada sees', st.unackedTrades('ada', 0));
    say('logins', st.logins('good name', 5).map(l => [l.started, l.ended]));
    say('online ms', st.onlineMs('good name'));
    st.log({ at: 5, by: 'parent page', act: 'rename', target: 'Good Name', detail: 'Bad Name' });
    say('renamed from', st.renamedFrom('bad name'));
    say('renamed from nothing', st.renamedFrom('sam'));
    // only the case changes: the same knight, the new spelling
    say('recase', st.rename('ada', 'ADA'));
    say('ada recased', st.account('ada'));
    return out;
  };
  const a = script(new SqlStore(sql)), b = script(mem);
  for (let i = 0; i < Math.max(a.length, b.length); i++) assert.deepEqual(a[i], b[i], (a[i] || b[i])[0]);
  const got = Object.fromEntries(b);
  assert.deepEqual(got.fresh, { strikes: 0, at: 0, lockedUntil: 0 });
  assert.equal(got.nobody, null); assert.equal(got['add nobody'], null);
  assert.deepEqual([got['add 1'], got['add 2']], [1, 2]);
  assert.deepEqual(got['29 days on'], { strikes: 2, at: 2000, lockedUntil: 0 });
  assert.deepEqual(got['30 days on'], { strikes: 0, at: 2000, lockedUntil: 0 });
  assert.equal(got['add after fade'], 1); assert.equal(got['add 3'], 3);
  assert.deepEqual(got.locked, { strikes: 3, at: 4000 + 30 * DAY, lockedUntil: 4000 + 31 * DAY });
  assert.deepEqual(got.cleared, { strikes: 0, at: 0, lockedUntil: 0 });
  assert.deepEqual(got['ada untouched'], { strikes: 1, at: 10, lockedUntil: 0 });
  assert.deepEqual(got.rename, { from: 'Bad Name', to: 'Good Name' });
  assert.equal(got['rename nobody'], null); assert.equal(got['old gone'], null);
  assert.equal(got['new there'].name, 'Good Name');
  assert.equal(got['strikes moved'].strikes, 1);
  assert.deepEqual(got.modlog.map(r => [r.by, r.target]), [['Good Name', 'Ada'], ['MudGoll', 'Good Name']]);
  assert.deepEqual(got.trades, [{ tid: 1, with: 'Ada', gave: [{ id: 'bread', qty: 1 }], got: [] }]);
  assert.equal(got['ada sees'][0].with, 'Good Name');
  assert.deepEqual(got.logins, [[4, 9]]); assert.equal(got['online ms'], 5);
  assert.equal(got['renamed from'], 'Good Name'); assert.equal(got['renamed from nothing'], null);
  assert.deepEqual(got['ada recased'].name, 'ADA');
});

// ---------------------------------------------------------------------------
// The World on node's SQLite
// ---------------------------------------------------------------------------
globalThis.WebSocketRequestResponsePair = class { constructor(a, b) { this.a = a; this.b = b; } };
const fakeWs = () => {
  const s = { got: [], closed: null, att: null, send(str) { s.got.push(JSON.parse(str)); }, close(code, reason) { if (!s.closed) s.closed = { code, reason }; }, serializeAttachment(st) { s.att = JSON.parse(JSON.stringify(st)); }, deserializeAttachment() { return s.att; } };
  s.last = t => s.got.filter(m => m.t === t).pop();
  return s;
};
globalThis.WebSocketPair = class { constructor() { this[0] = fakeWs(); this[1] = fakeWs(); } };
const { World } = await import('../src/world.js');

let T = 1759500000000;
class TestWorld extends World {
  now() { return T; }
  upgraded(client) { return { status: 101, client }; }
}
function makeCtx(db) {
  const sockets = [];
  return {
    storage: { sql: sqlOf(db || new DatabaseSync(':memory:')), setAlarm: async () => { } },
    setWebSocketAutoResponse() { }, acceptWebSocket(ws) { sockets.push(ws); }, getWebSockets: () => sockets.filter(s => !s.closed), sockets,
  };
}
const ENV = { ADMIN_KEY: 'test-admin', INVITE_CODE: 'TEST-1234' };
async function call(w, method, path, body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const res = await w.fetch(new Request('http://world' + path, { method, headers, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }));
  let data = null; try { data = await res.json(); } catch (e) { }
  return { status: res.status, data };
}
const parent = (w, method, path, body) => call(w, method, path, body, ENV.ADMIN_KEY);
async function signup(w, name, pass = 'sword') { const r = await call(w, 'POST', '/api/signup', { name, pass, invite: 'TEST-1234' }); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data.token; }
async function socket(w, token, ip) { return w.fetch(new Request('http://world/ws?token=' + token, { headers: ip ? { upgrade: 'websocket', 'cf-connecting-ip': ip } : { upgrade: 'websocket' } })); }
async function online(w, token, ip) {
  const r = await socket(w, token, ip);
  assert.equal(r.status, 101);
  const server = w.ctx.sockets[w.ctx.sockets.length - 1];
  w.webSocketMessage(server, JSON.stringify({ t: 'hello', v: 1 }));
  w.webSocketMessage(server, JSON.stringify({ t: 'p', map: 'over', region: 'Thistledown', x: 480, y: 480, lv: 12 }));
  return server;
}
const chat = (w, s, text) => { T += 2000; w.webSocketMessage(s, JSON.stringify({ t: 'chat', text })); };
async function knights() {
  T = 1759500000000;
  const ctx = makeCtx();
  const w = new TestWorld(ctx, ENV);
  const tok = {};
  for (const n of ['MudGoll', 'Ada', 'Sam', 'Pip']) { tok[n] = await signup(w, n); T += 1000; }
  for (const n of ['MudGoll', 'Ada']) assert.equal((await parent(w, 'POST', '/api/admin/role', { name: n, role: 'admin' })).status, 200);
  return { ctx, w, tok };
}
async function keepOut(w, tok, name, ip) {
  const s = await online(w, tok[name], ip);
  for (const t of ['shit', 'shit', 'shit']) chat(w, s, t);
  assert.equal(s.closed.code, 4006);
  return T + WORD_LOCK_MS;
}

test('the World: the third strike keeps the knight out of login, every /api call and the socket until the time is up', async () => {
  const { w, tok } = await knights();
  const until = await keepOut(w, tok, 'Sam');
  const want = { code: 'words', until };
  const words = r => ({ code: r.data && r.data.code, until: r.data && r.data.until });
  // the session is kept, but nothing goes through but a save
  for (const [m, p, b] of [['GET', '/api/me'], ['GET', '/api/save'], ['GET', '/api/save/pin'], ['POST', '/api/save/restore']]) {
    const r = await call(w, m, p, b, tok.Sam);
    assert.equal(r.status, 403, m + ' ' + p); assert.deepEqual(words(r), want, m + ' ' + p);
  }
  // PUT /api/save goes through, right after the kick and all day (saving is not playing): the push the game sends as it is
  // sent out lands, so the next login loads the knight as it was at the third strike, not an older save
  const last = JSON.stringify({ player: { kills: 77 } });
  let put = await call(w, 'PUT', '/api/save', last, tok.Sam);
  assert.equal(put.status, 200, JSON.stringify(put.data));
  T += 3 * 3600 * 1000;
  put = await call(w, 'PUT', '/api/save', last, tok.Sam);
  assert.equal(put.status, 200);
  assert.equal((await call(w, 'GET', '/api/me', undefined, tok.Sam)).status, 403);
  assert.equal(w.sql.exec("SELECT json FROM saves WHERE name_lc = 'sam' ORDER BY ver DESC LIMIT 1").toArray()[0].json, last);
  const ws = await socket(w, tok.Sam);
  assert.equal(ws.status, 403); assert.deepEqual((await ws.json()).code, 'words');
  // login: the wrong secret word is still just wrong (and counts as a try); the right one says kept out, and makes no session
  let r = await call(w, 'POST', '/api/login', { name: 'Sam', pass: 'nope' });
  assert.deepEqual([r.status, r.data.code], [401, 'pass']);
  const sessions = () => w.sql.exec("SELECT COUNT(*) AS n FROM sessions WHERE name_lc = 'sam'").toArray()[0].n;
  const before = sessions();
  r = await call(w, 'POST', '/api/login', { name: 'sam', pass: 'sword' });
  assert.equal(r.status, 403); assert.deepEqual(words(r), want);
  assert.equal(r.data.error, wordsText(until, T));
  assert.equal(sessions(), before);
  // the wrong-secret-word tries and lock columns are not the word lock
  assert.deepEqual(w.sql.exec("SELECT tries, locked_until, word_strikes, words_locked_until FROM accounts WHERE name_lc = 'sam'").toArray()[0], { tries: 0, locked_until: 0, word_strikes: 3, words_locked_until: until });
  // nobody else is touched
  assert.equal((await call(w, 'GET', '/api/me', undefined, tok.Pip)).status, 200);
  // time up: the same session works again (with the save pushed at the kick), the socket opens, a login works
  T = until;
  assert.equal((await call(w, 'GET', '/api/me', undefined, tok.Sam)).data.name, 'Sam');
  assert.equal((await call(w, 'GET', '/api/save', undefined, tok.Sam)).data.save, last);
  assert.equal((await socket(w, tok.Sam)).status, 101);
  assert.equal((await call(w, 'POST', '/api/login', { name: 'Sam', pass: 'sword' })).status, 200);
});

test('the World: a restart while a knight is kept out still keeps it out (the socket a nap brings back is refused)', async () => {
  const { ctx, w, tok } = await knights();
  const s = await online(w, tok.Pip);
  // Sam is kept out on the store directly, as if a strike had happened just before a nap, with its old socket still open
  const sam = await online(w, tok.Sam);
  w.store.setWordLock('sam', T + DAY);
  const w2 = new TestWorld(ctx, ENV);
  assert.equal(w2.room.isOnline('Sam'), false);
  assert.equal(sam.closed.code, 4006);
  assert.equal(sam.last('error').code, 'words');
  assert.equal(w2.room.isOnline('Pip'), true);
  assert.equal(s.closed, null);
});

test('clearing strikes: an admin from the game (not their own), the parent page for anyone; logged; the knight is let in at once', async () => {
  const { w, tok } = await knights();
  await keepOut(w, tok, 'Sam');
  const clear = (name, token) => call(w, 'POST', '/api/accounts/strikes', { name }, token);
  let r = await clear('Sam', tok.Pip); assert.deepEqual([r.status, r.data.code], [403, 'admin']);
  r = await clear('Sam'); assert.deepEqual([r.status, r.data.code], [401, 'auth']);
  r = await clear('Nobody', tok.MudGoll); assert.deepEqual([r.status, r.data.code], [404, 'unknown']);
  r = await clear('mudgoll', tok.MudGoll); assert.deepEqual([r.status, r.data.code], [403, 'self']);
  assert.equal((await call(w, 'GET', '/api/me', undefined, tok.Sam)).status, 403);
  // the list shows it before the clear
  let list = (await call(w, 'GET', '/api/accounts', undefined, tok.MudGoll)).data;
  let sam = list.find(a => a.name === 'Sam');
  assert.equal(sam.strikes, 3); assert.equal(sam.wordsLockedUntil, T + WORD_LOCK_MS); assert.equal(sam.strikeAt, T);
  assert.equal(list.find(a => a.name === 'Pip').strikes, 0); assert.equal(list.find(a => a.name === 'Pip').wordsLockedUntil, 0);
  r = await clear('sam', tok.MudGoll);
  assert.deepEqual([r.status, r.data], [200, { ok: true, name: 'Sam' }]);
  assert.equal((await call(w, 'GET', '/api/me', undefined, tok.Sam)).status, 200);
  sam = (await call(w, 'GET', '/api/accounts', undefined, tok.MudGoll)).data.find(a => a.name === 'Sam');
  assert.deepEqual([sam.strikes, sam.strikeAt, sam.wordsLockedUntil], [0, 0, 0]);
  // a cleared knight starts again at a warning
  const s = await online(w, tok.Sam); chat(w, s, 'shit');
  assert.deepEqual(s.last('strike'), { t: 'strike', n: 1, text: WORD_WARN_1 });
  // the parent page clears anyone, an admin too
  const ada = await online(w, tok.Ada); chat(w, ada, 'you stupid');
  assert.equal((await parent(w, 'POST', '/api/admin/strikes', { name: 'Ada' })).status, 200);
  assert.equal(w.store.wordStrikes('ada', T).strikes, 0);
  assert.equal((await parent(w, 'POST', '/api/admin/strikes', { name: 'Nobody' })).status, 404);
  // the log: who cleared whom, and what there was
  const log = (await parent(w, 'GET', '/api/admin/modlog')).data.filter(m => m.act === 'strikes_clear').map(m => [m.by, m.n, m.detail]);
  assert.deepEqual(log, [['parent page', 'Ada', '1'], ['MudGoll', 'Sam', '3, was kept out']]);
  // three a minute
  for (let i = 0; i < 2; i++) { r = await clear(i ? 'Pip' : 'Sam', tok.MudGoll); assert.equal(r.status, 200); }
  r = await clear('Pip', tok.MudGoll); assert.deepEqual([r.status, r.data.code], [429, 'wait']);
});

test('every existing name is checked: a name made before the list grew is flagged on the Accounts list', async () => {
  const { w, tok } = await knights();
  const { salt, hash } = await makeHash('sword');
  // made by an older server whose list did not have these words
  for (const [lc, name] of [['stupid sam', 'Stupid Sam'], ['gaylord', 'Gaylord'], ['xxfuckerxx', 'xXfuckerXx']]) w.sql.exec('INSERT INTO accounts (name_lc, name, salt, hash, created, last_seen) VALUES (?, ?, ?, ?, ?, ?)', lc, name, salt, hash, T, T);
  const list = (await call(w, 'GET', '/api/accounts', undefined, tok.MudGoll)).data;
  assert.deepEqual(list.map(a => [a.name, a.badName]), [['Ada', false], ['Gaylord', true], ['MudGoll', false], ['Pip', false], ['Sam', false], ['Stupid Sam', true], ['xXfuckerXx', true]]);
  assert.deepEqual((await parent(w, 'GET', '/api/admin/accounts')).data.filter(a => a.badName).map(a => a.name), ['Gaylord', 'Stupid Sam', 'xXfuckerXx']);
});

test('a rename rewrites the name everywhere it is kept, sends an online knight out to come back as it, and old logins still work', async () => {
  const { w, tok } = await knights();
  const { salt, hash } = await makeHash('sword');
  w.sql.exec('INSERT INTO accounts (name_lc, name, salt, hash, created, last_seen) VALUES (?, ?, ?, ?, ?, ?)', 'stupid sam', 'Stupid Sam', salt, hash, T, T);
  const old = (await call(w, 'POST', '/api/login', { name: 'Stupid Sam', pass: 'sword' })).data.token;
  const second = (await call(w, 'POST', '/api/login', { name: 'stupid sam', pass: 'sword' })).data.token;
  // a save, two versions; a login row; a chat line; a strike; mod_log rows naming him and by him; a trade; a lit cracker; a party he threw (as an admin once)
  await call(w, 'PUT', '/api/save', JSON.stringify({ player: { playSeconds: 60 }, v: 1 }), old);
  await call(w, 'PUT', '/api/save', JSON.stringify({ player: { playSeconds: 90 }, v: 2 }), old);
  const s = await online(w, old);
  chat(w, s, 'hello everyone');
  chat(w, s, 'shit');
  const mud = await online(w, tok.MudGoll);
  T += 2000; w.webSocketMessage(mud, JSON.stringify({ t: 'mute', n: 'Stupid Sam', span: '5m' }));
  w.store.log({ at: T, by: 'Stupid Sam', act: 'kick', target: 'Pip', detail: '' });
  w.store.addTrade({ at: T, a: 'Stupid Sam', b: 'Pip', aGave: [{ id: 'bread', qty: 2 }], bGave: [{ id: 'coins', qty: 9 }] });
  w.store.addTrade({ at: T, a: 'Ada', b: 'Stupid Sam', aGave: [], bGave: [{ id: 'coins', qty: 1 }] });
  const pid = w.store.addParty({ at: T, by: 'Stupid Sam', map: 'over', region: '', hat: 10, table: [{ id: 'coins', min: 1, max: 1, w: 1 }], spots: [[1, 1], [2, 2]], expires: T + 900000 });
  w.store.light(pid, 0, 'stupid sam', T, { id: 'coins', qty: 1 });
  w.sql.exec("INSERT INTO save_pins (name_lc, json, at) VALUES ('stupid sam', '{}', 1)");
  // the refusals first: nothing changes
  const ren = (name, to, token = tok.MudGoll) => call(w, 'POST', '/api/accounts/rename', { name, to }, token);
  for (const [name, to, token, status, code] of [
    ['Stupid Sam', 'Brave Sam', tok.Pip, 403, 'admin'], ['Nobody', 'Brave Sam', tok.MudGoll, 404, 'unknown'], ['MudGoll', 'Mud', tok.MudGoll, 403, 'self'],
    ['Ada', 'Ada Two', tok.MudGoll, 403, 'isadmin'], ['Stupid Sam', 'Big Idiot', tok.MudGoll, 400, 'name'], ['Stupid Sam', 'x', tok.MudGoll, 400, 'name'],
    ['Stupid Sam', 'admin', tok.MudGoll, 400, 'name'], ['Stupid Sam', 'pip', tok.MudGoll, 409, 'taken'], ['Stupid Sam', 7, tok.MudGoll, 400, 'name']]) {
    const r = await ren(name, to, token);
    assert.deepEqual([r.status, r.data.code], [status, code], name + ' -> ' + to);
  }
  assert.equal(w.store.account('stupid sam').name, 'Stupid Sam');
  // the rename
  T += 1000;
  const r = await ren('stupid  SAM', '  Brave   Sam ');
  assert.deepEqual([r.status, r.data], [200, { ok: true, from: 'Stupid Sam', name: 'Brave Sam' }]);
  // the online knight: told the new name, sent out with 4007 (the wire comes straight back)
  assert.deepEqual(s.last('error'), { t: 'error', code: 'renamed', text: renamedText('Brave Sam'), name: 'Brave Sam' });
  assert.equal(renamedText('Brave Sam'), "An admin changed your knight's name to Brave Sam.");
  assert.equal(s.closed.code, RENAMED_CODE); assert.equal(RENAMED_CODE, 4007);
  // every table: nothing left under the old name
  const left = [];
  for (const [table, cols] of [['accounts', ['name', 'name_lc']], ['sessions', ['name_lc']], ['saves', ['name_lc']], ['save_pins', ['name_lc']], ['logins', ['name_lc']], ['crackers', ['lit_by']], ['trades', ['a', 'a_lc', 'b', 'b_lc']], ['chat', ['name']], ['mod_log', ['by', 'target']], ['parties', ['by']]]) {
    for (const c of cols) { const n = w.sql.exec(`SELECT COUNT(*) AS n FROM ${table} WHERE lower(${c}) = 'stupid sam'`).toArray()[0].n; if (n) left.push(table + '.' + c + ': ' + n); }
  }
  assert.deepEqual(left, []);
  const q = (sqlText, ...a) => w.sql.exec(sqlText, ...a).toArray();
  assert.deepEqual(q("SELECT name, name_lc, word_strikes FROM accounts WHERE name_lc = 'brave sam'"), [{ name: 'Brave Sam', name_lc: 'brave sam', word_strikes: 1 }]);
  assert.equal(q("SELECT COUNT(*) AS n FROM sessions WHERE name_lc = 'brave sam'")[0].n, 2);
  assert.deepEqual(q("SELECT ver FROM saves WHERE name_lc = 'brave sam' ORDER BY ver").map(x => x.ver), [1, 2]);
  assert.equal(q("SELECT COUNT(*) AS n FROM save_pins WHERE name_lc = 'brave sam'")[0].n, 1);
  assert.ok(q("SELECT COUNT(*) AS n FROM logins WHERE name_lc = 'brave sam'")[0].n >= 1);
  assert.equal(q("SELECT lit_by FROM crackers WHERE party = ? AND k = 0", pid)[0].lit_by, 'brave sam');
  assert.deepEqual(q('SELECT a, a_lc, b, b_lc FROM trades ORDER BY id'), [{ a: 'Brave Sam', a_lc: 'brave sam', b: 'Pip', b_lc: 'pip' }, { a: 'Ada', a_lc: 'ada', b: 'Brave Sam', b_lc: 'brave sam' }]);
  assert.deepEqual(q("SELECT name, text FROM chat ORDER BY id"), [{ name: 'Brave Sam', text: 'hello everyone' }, { name: 'Brave Sam', text: '****' }]);
  assert.equal(q('SELECT by FROM parties WHERE id = ?', pid)[0].by, 'Brave Sam');
  const log = (await parent(w, 'GET', '/api/admin/modlog')).data.map(m => [m.by, m.act, m.n, m.detail]);
  assert.deepEqual(log.slice(0, 4), [['MudGoll', 'rename', 'Brave Sam', 'Stupid Sam'], ['Brave Sam', 'kick', 'Pip', ''], ['MudGoll', 'mute', 'Brave Sam', '5m'], ['word filter', 'strike', 'Brave Sam', '1: shit']]);
  // both sessions now belong to the new name: the game comes straight back as Brave Sam
  assert.equal((await call(w, 'GET', '/api/me', undefined, old)).data.name, 'Brave Sam');
  assert.equal((await call(w, 'GET', '/api/me', undefined, second)).data.name, 'Brave Sam');
  assert.equal(JSON.parse((await call(w, 'GET', '/api/save', undefined, old)).data.save).v, 2);
  const back = await online(w, old);
  assert.equal(back.last('welcome').me, 'Brave Sam');
  assert.equal(w.room.isOnline('Brave Sam'), true); assert.equal(w.room.isOnline('Stupid Sam'), false);
  // the old name still logs in (with the right word) as the new one; the wrong word is still wrong
  let l = await call(w, 'POST', '/api/login', { name: 'Stupid Sam', pass: 'sword' });
  assert.deepEqual([l.status, l.data.name], [200, 'Brave Sam']);
  l = await call(w, 'POST', '/api/login', { name: 'stupid sam', pass: 'nope' });
  assert.deepEqual([l.status, l.data.code], [401, 'pass']);
  // the list no longer flags him
  const list = (await call(w, 'GET', '/api/accounts', undefined, tok.MudGoll)).data;
  assert.deepEqual(list.filter(a => a.badName), []);
  assert.equal(list.find(a => a.name === 'Brave Sam').playSeconds, 90);
  // a case-only change is allowed (the same knight); asking for the very name it has changes nothing and logs nothing
  assert.equal((await ren('brave sam', 'Brave SAM')).status, 200);
  const n0 = (await parent(w, 'GET', '/api/admin/modlog')).data.length;
  assert.deepEqual((await ren('brave sam', 'Brave SAM')).data, { ok: true, from: 'Brave SAM', name: 'Brave SAM' });
  assert.equal((await parent(w, 'GET', '/api/admin/modlog')).data.length, n0);
  // the parent page renames anyone, an admin too; three a minute from the game
  assert.deepEqual((await parent(w, 'POST', '/api/admin/rename', { name: 'Ada', to: 'Ada Queen' })).data, { ok: true, from: 'Ada', name: 'Ada Queen' });
  assert.equal((await call(w, 'GET', '/api/me', undefined, tok.Ada)).data.name, 'Ada Queen');
  assert.deepEqual([(await parent(w, 'POST', '/api/admin/rename', { name: 'Ada Queen', to: 'Big Idiot' })).data.code], ['name']);
  // MudGoll has made two renames this minute (the same-name ask logged nothing): one more is allowed, then wait
  assert.equal((await ren('Pip', 'Pip Two')).status, 200);
  assert.deepEqual([(await ren('Pip Two', 'Pip Three')).data.code], ['wait']);
  T += 60001;
  assert.equal((await ren('Pip Two', 'Pip Three')).status, 200);
});

// Review round 1: a kept-out kid could tap Not me, tick New knight, type the invite code everyone knows and play again.
async function from(w, ip, method, path, body, token) {
  const headers = { 'content-type': 'application/json', 'cf-connecting-ip': ip };
  if (token) headers.authorization = 'Bearer ' + token;
  const res = await w.fetch(new Request('http://world' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
  let data = null; try { data = await res.json(); } catch (e) { }
  return { status: res.status, data };
}
test('signup: no new knight from the place a kept-out knight last came from, until the time is up or an admin clears it', async () => {
  const { w, tok } = await knights();
  const HOME = '203.0.113.7', FRIEND = '198.51.100.20', SCHOOL = '192.0.2.44';
  // Sam plays from home; Leo-to-be and everyone else call from where they are. No address is written down for any of it.
  const t = (await from(w, HOME, 'POST', '/api/login', { name: 'Sam', pass: 'sword' })).data.token;
  assert.equal((await from(w, FRIEND, 'GET', '/api/me', undefined, tok.Pip)).status, 200);
  const placesKept = () => w.sql.exec("SELECT name_lc, last_ip FROM accounts WHERE last_ip != '' ORDER BY name_lc").toArray().map(r => [r.name_lc, r.last_ip]);
  assert.deepEqual(placesKept(), []);
  const r101 = await w.fetch(new Request('http://world/ws?token=' + t, { headers: { upgrade: 'websocket', 'cf-connecting-ip': HOME } }));
  assert.equal(r101.status, 101);
  const s = w.ctx.sockets[w.ctx.sockets.length - 1];
  w.webSocketMessage(s, JSON.stringify({ t: 'hello', v: 1 }));
  for (const line of ['shit', 'shit', 'shit']) chat(w, s, line);
  assert.equal(s.closed.code, 4006);
  const until = T + WORD_LOCK_MS;
  const sign = (ip, name) => from(w, ip, 'POST', '/api/signup', { name, pass: 'sword', invite: 'TEST-1234' });
  // the new knight from home: refused with the same sentence and the same time, and nothing is made
  let r = await sign(HOME, 'Sam Two');
  assert.deepEqual([r.status, r.data.code, r.data.until, r.data.error], [403, 'words', until, wordsText(until, T)]);
  assert.equal(w.sql.exec("SELECT COUNT(*) AS n FROM accounts WHERE name_lc = 'sam two'").toArray()[0].n, 0);
  // a friend somewhere else signs up as usual (and so does a local world with no address at all)
  assert.equal((await sign(FRIEND, 'Leo')).status, 200);
  assert.equal((await call(w, 'POST', '/api/signup', { name: 'Mia', pass: 'sword', invite: 'TEST-1234' })).status, 200);
  // Sam's session tried from school while kept out: refused, and the place stays home (the one Sam was sent out from)
  assert.equal((await from(w, SCHOOL, 'GET', '/api/me', undefined, tok.Sam)).status, 403);
  assert.equal((await from(w, SCHOOL, 'POST', '/api/login', { name: 'Sam', pass: 'sword' })).status, 403);
  assert.equal((await sign(HOME, 'Sam Three')).status, 403);
  // review round 3: the only address kept anywhere is the one Sam was sent out from, and only while Sam is kept out
  assert.deepEqual(placesKept(), [['sam', HOME]]);
  // the place is never on a list
  const list = (await call(w, 'GET', '/api/accounts', undefined, tok.MudGoll)).data;
  assert.ok(!JSON.stringify(list).includes(HOME) && !JSON.stringify(list).includes(FRIEND));
  // a minute before the end: still no; at the end: yes
  T = until - 60000; assert.equal((await sign(HOME, 'Sam Two')).status, 403);
  T = until; assert.equal((await sign(HOME, 'Sam Two')).status, 200);
  // the knight made at home is not noted either, and a wake after the end forgets Sam's place
  assert.deepEqual(placesKept(), [['sam', HOME]]);
  const again = new TestWorld(w.ctx, ENV);
  assert.deepEqual(again.sql.exec("SELECT COUNT(*) AS n FROM accounts WHERE last_ip != ''").toArray()[0].n, 0);
});
test('signup: an admin clearing the strikes lets the place sign up again at once', async () => {
  const { w, tok } = await knights();
  const HOME = '203.0.113.9';
  await keepOut(w, tok, 'Pip', HOME);
  assert.equal((await from(w, HOME, 'POST', '/api/signup', { name: 'Pip Two', pass: 'sword', invite: 'TEST-1234' })).status, 403);
  assert.equal((await call(w, 'POST', '/api/accounts/strikes', { name: 'Pip' }, tok.MudGoll)).status, 200);
  // clearing forgets the place too
  assert.equal(w.sql.exec("SELECT last_ip FROM accounts WHERE name_lc = 'pip'").toArray()[0].last_ip, '');
  assert.equal((await from(w, HOME, 'POST', '/api/signup', { name: 'Pip Two', pass: 'sword', invite: 'TEST-1234' })).status, 200);
});

// Review round 3 (minors): a renamed knight's old name. Signup checked only accounts, so a new knight could take the old
// name and a login with it then hit the new knight (wrong secret word, and 5 of them locked that knight out).
test('an old name stays taken: no new knight and no rename to it, but a knight may go back to its own', async () => {
  const { w, tok } = await knights();
  assert.equal((await parent(w, 'POST', '/api/admin/rename', { name: 'Sam', to: 'Brave Sam' })).status, 200);
  const r = await call(w, 'POST', '/api/signup', { name: 'sam', pass: 'other', invite: 'TEST-1234' });
  assert.deepEqual([r.status, r.data.code], [409, 'taken']);
  // the old name still logs Sam in, as Brave Sam
  const back = await call(w, 'POST', '/api/login', { name: 'Sam', pass: 'sword' });
  assert.deepEqual([back.status, back.data.name], [200, 'Brave Sam']);
  // another knight cannot be renamed to it either; Brave Sam can go back to it
  const pip = await parent(w, 'POST', '/api/admin/rename', { name: 'Pip', to: 'Sam' });
  assert.deepEqual([pip.status, pip.data.code], [409, 'taken']);
  assert.equal((await parent(w, 'POST', '/api/admin/rename', { name: 'Brave Sam', to: 'Sam' })).status, 200);
  assert.equal((await call(w, 'POST', '/api/login', { name: 'Sam', pass: 'sword' })).data.name, 'Sam');
});

test('the rename row is never trimmed from mod_log, so the old name logs in however many strikes come after', () => {
  for (const make of [() => new MemoryStore(), () => { const db = new DatabaseSync(':memory:'), sql = sqlOf(db); for (const st of SCHEMA.split(';')) if (st.trim()) sql.exec(st); migrate(sql); return new SqlStore(sql); }]) {
    const st = make();
    st.log({ at: 1, by: 'parent page', act: 'rename', target: 'Brave Sam', detail: 'Sam' });
    for (let i = 0; i < 5600; i++) st.log({ at: 2 + i, by: 'word filter', act: 'strike', target: 'Pip', detail: '1: shit' });
    assert.equal(st.renamedFrom('sam'), 'Brave Sam');
    // the strikes themselves are trimmed to the newest 5000 (the rename row kept on top)
    assert.ok(st.modLog(10000).length <= 5000 + 200 + 1, String(st.modLog(10000).length));
    assert.equal(st.modLog(10000).filter(r => r.act === 'rename').length, 1);
  }
});

test('a rename is all or nothing: a write that fails part-way changes no table', () => {
  const db = new DatabaseSync(':memory:'), sql = sqlOf(db); for (const st of SCHEMA.split(';')) if (st.trim()) sql.exec(st); migrate(sql);
  const txn = fn => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  let failOn = null;
  const flaky = { exec(q, ...a) { if (failOn && q.includes(failOn)) throw new Error('disk said no'); return sql.exec(q, ...a); } };
  const st = new SqlStore(flaky, txn);
  sql.exec("INSERT INTO accounts (name_lc, name, salt, hash, created, last_seen) VALUES ('sam', 'Sam', 's', 'h', 1, 1)");
  sql.exec("INSERT INTO sessions (token, name_lc, expires) VALUES ('t1', 'sam', 99)");
  sql.exec("INSERT INTO chat (at, name, text) VALUES (1, 'Sam', 'hi')");
  failOn = 'UPDATE trades SET b';
  assert.throws(() => st.rename('sam', 'Brave Sam'), /disk said no/);
  const names = () => [sql.exec('SELECT name FROM accounts').toArray()[0].name, sql.exec('SELECT name_lc FROM sessions').toArray()[0].name_lc, sql.exec('SELECT name FROM chat').toArray()[0].name];
  assert.deepEqual(names(), ['Sam', 'sam', 'Sam']);
  failOn = null;
  assert.deepEqual(st.rename('sam', 'Brave Sam'), { from: 'Sam', to: 'Brave Sam' });
  assert.deepEqual(names(), ['Brave Sam', 'brave sam', 'Brave Sam']);
});
