// The store: the migration on a database made by the live server's schema (node's built-in SQLite standing in for
// the Durable Object's), and SqlStore answering exactly like MemoryStore for the same script of calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA, migrate, SqlStore, MemoryStore, ALWAYS } from '../src/store.js';
import { Room } from '../src/room.js';
import { PARTY_LIFE, PRIZE_KEEP, TILE } from '../src/party.js';

// master's world.js schema (e9a366f, live on gorkscape.ca before admins), copied here so this test does not lean on
// store.js's own copy of it
const OLD_SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  name_lc TEXT PRIMARY KEY, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL,
  created INTEGER NOT NULL, last_seen INTEGER NOT NULL, banned INTEGER NOT NULL DEFAULT 0,
  tries INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, name_lc TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_by_name ON sessions (name_lc);
CREATE TABLE IF NOT EXISTS saves (name_lc TEXT NOT NULL, ver INTEGER NOT NULL, json TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (name_lc, ver));
CREATE TABLE IF NOT EXISTS chat (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, name TEXT NOT NULL, text TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

// node's SQLite with the Durable Object SQL API's shape: exec(query, ...args) -> {toArray(), one(), rowsWritten, columnNames}
function sqlOf(db, { refusePragma = false } = {}) {
  return {
    exec(q, ...args) {
      if (refusePragma && /^\s*PRAGMA/i.test(q)) throw new Error('not authorized');
      const stmt = db.prepare(q);
      const columnNames = stmt.columns().map(c => c.name);
      let rows = [], rowsWritten = 0;
      if (columnNames.length) rows = stmt.all(...args).map(r => Object.assign({}, r));
      else rowsWritten = stmt.run(...args).changes;
      return {
        toArray: () => rows.slice(),
        one: () => { if (rows.length !== 1) throw new Error('expected exactly one row, got ' + rows.length); return rows[0]; },
        rowsWritten, columnNames, [Symbol.iterator]: () => rows[Symbol.iterator](),
      };
    },
  };
}
const run = (sql, schema) => { for (const stmt of schema.split(';')) if (stmt.trim()) sql.exec(stmt); };
// what the World's constructor does on every wake
const wake = sql => { run(sql, SCHEMA); return migrate(sql); };

const OLD_TABLES = { accounts: 'name_lc', sessions: 'token', saves: 'name_lc, ver', chat: 'id', settings: 'key' };
const OLD_COLUMNS = {
  accounts: ['name_lc', 'name', 'salt', 'hash', 'created', 'last_seen', 'banned', 'tries', 'locked_until'],
  sessions: ['token', 'name_lc', 'expires'], saves: ['name_lc', 'ver', 'json', 'at'], chat: ['id', 'at', 'name', 'text'], settings: ['key', 'value'],
};
// every old row, only its old columns, in a fixed order; plus each value's type, so "byte for byte" means it
const dump = sql => {
  const out = {};
  for (const [t, order] of Object.entries(OLD_TABLES)) {
    out[t] = sql.exec(`SELECT ${OLD_COLUMNS[t].join(', ')}, ${OLD_COLUMNS[t].map(c => `typeof(${c}) AS "${c}_type"`).join(', ')} FROM ${t} ORDER BY ${order}`).toArray();
  }
  return out;
};

// The live world's data as the old server would have written it: knights, sessions, three saves each, chat, the invite.
function oldWorld() {
  const db = new DatabaseSync(':memory:');
  const sql = sqlOf(db);
  run(sql, OLD_SCHEMA);
  const knights = [['cohen', 'Cohen', 0], ['mudgoll', 'MudGoll', 0], ['sam the brave', 'Sam the Brave', 1]];
  for (const [lc, name, banned] of knights) {
    sql.exec('INSERT INTO accounts (name_lc, name, salt, hash, created, last_seen, banned, tries, locked_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      lc, name, 'ab'.repeat(16), 'cd'.repeat(32), 1758800000000, 1758900000000 + lc.length, banned, lc.length % 3, lc === 'cohen' ? 1758900060000 : 0);
    sql.exec('INSERT INTO sessions (token, name_lc, expires) VALUES (?, ?, ?)', 'f'.repeat(60) + lc.slice(0, 4).padEnd(4, '0'), lc, 1766600000000);
    for (let v = 2; v <= 4; v++) sql.exec('INSERT INTO saves (name_lc, ver, json, at) VALUES (?, ?, ?, ?)', lc, v, JSON.stringify({ v, knight: name, pack: ['bread', 'coins'], note: 'ünïcødé ✓' }), 1758800000000 + v);
  }
  for (let i = 0; i < 25; i++) sql.exec('INSERT INTO chat (at, name, text) VALUES (?, ?, ?)', 1758800000000 + i, i % 2 ? 'Cohen' : 'MudGoll', 'line ' + i + ' what the ****');
  sql.exec("INSERT INTO settings (key, value) VALUES ('invite', 'GORK-2026')");
  return { db, sql };
}

test('migrate on the live schema: every old row stays byte for byte, the new columns read player and 0, twice changes nothing', () => {
  const { sql } = oldWorld();
  const before = dump(sql);
  const first = wake(sql);
  assert.deepEqual(first, { via: 'pragma', added: ['role', 'muted_until'] });
  assert.deepEqual(dump(sql), before);
  const second = wake(sql);
  assert.deepEqual(second, { via: 'pragma', added: [] });
  assert.deepEqual(dump(sql), before);
  // the accounts table is the old one with two columns on the end, nothing else moved or retyped
  const info = sql.exec('PRAGMA table_info(accounts)').toArray();
  assert.deepEqual(info.map(c => c.name), [...OLD_COLUMNS.accounts, 'role', 'muted_until']);
  assert.deepEqual(info.map(c => c.type), ['TEXT', 'TEXT', 'TEXT', 'TEXT', 'INTEGER', 'INTEGER', 'INTEGER', 'INTEGER', 'INTEGER', 'TEXT', 'INTEGER']);
  for (const t of ['sessions', 'saves', 'chat', 'settings']) assert.deepEqual(sql.exec(`PRAGMA table_info(${t})`).toArray().map(c => c.name), OLD_COLUMNS[t]);
  assert.deepEqual(sql.exec('SELECT name_lc, role, muted_until FROM accounts ORDER BY name_lc').toArray(),
    [{ name_lc: 'cohen', role: 'player', muted_until: 0 }, { name_lc: 'mudgoll', role: 'player', muted_until: 0 }, { name_lc: 'sam the brave', role: 'player', muted_until: 0 }]);
  // the new tables and indexes are there, empty; the old index is still there
  const names = sql.exec("SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").toArray().map(r => r.type + ' ' + r.name);
  assert.deepEqual(names, ['index crackers_by_lighter', 'index sessions_by_name', 'table accounts', 'table chat', 'table crackers', 'table mod_log', 'table parties', 'table save_pins', 'table saves', 'table sessions', 'table settings']);
  for (const t of ['mod_log', 'save_pins', 'parties', 'crackers']) assert.equal(sql.exec(`SELECT COUNT(*) AS n FROM ${t}`).one().n, 0);
  // what the store reads from a migrated world
  const store = new SqlStore(sql);
  assert.deepEqual(store.account('Sam the  Brave'), { name: 'Sam the Brave', lc: 'sam the brave', role: 'player', mutedUntil: 0, banned: true });
  assert.deepEqual(store.account('COHEN'), { name: 'Cohen', lc: 'cohen', role: 'player', mutedUntil: 0, banned: false });
  assert.deepEqual(store.bannedList(), [{ name: 'Sam the Brave' }]);
});

test('migrate: when a runtime refuses PRAGMA it reads the columns from SELECT * ... LIMIT 0 instead', () => {
  const db = new DatabaseSync(':memory:');
  const plain = sqlOf(db), strict = sqlOf(db, { refusePragma: true });
  run(plain, OLD_SCHEMA);
  plain.exec("INSERT INTO accounts (name_lc, name, salt, hash, created, last_seen) VALUES ('cohen', 'Cohen', 's', 'h', 1, 2)");
  run(strict, SCHEMA);
  assert.deepEqual(migrate(strict), { via: 'columnNames', added: ['role', 'muted_until'] });
  assert.deepEqual(migrate(strict), { via: 'columnNames', added: [] });
  assert.deepEqual(migrate(plain), { via: 'pragma', added: [] });   // and the two ways agree
  assert.deepEqual(plain.exec('SELECT name, role, muted_until FROM accounts').toArray(), [{ name: 'Cohen', role: 'player', muted_until: 0 }]);
});

test('a brand new world gets the same tables and columns as a migrated one', () => {
  const fresh = sqlOf(new DatabaseSync(':memory:'));
  assert.deepEqual(wake(fresh), { via: 'pragma', added: ['role', 'muted_until'] });
  const { sql: old } = oldWorld(); wake(old);
  const shape = sql => sql.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").toArray()
    .map(r => r.name + ': ' + sql.exec(`PRAGMA table_info(${r.name})`).toArray().map(c => c.name + ' ' + c.type + (c.notnull ? ' NOT NULL' : '') + (c.dflt_value != null ? ' DEFAULT ' + c.dflt_value : '')).join(', '));
  assert.deepEqual(shape(fresh), shape(old));
});

// ---------------------------------------------------------------------------
// SqlStore and MemoryStore, one script, the same answers
// ---------------------------------------------------------------------------
const KNIGHTS = [['MudGoll', 'admin'], ['Sam', 'player'], ['Ada', 'player'], ['Bo', 'player'], ['Zed Two', 'player']];
function sqlStore() {
  const db = new DatabaseSync(':memory:');
  const sql = sqlOf(db);
  wake(sql);
  for (const [name, role] of KNIGHTS) {
    sql.exec('INSERT INTO accounts (name_lc, name, salt, hash, created, last_seen) VALUES (?, ?, ?, ?, ?, ?)', name.toLowerCase(), name, 's', 'h', 1, 1);
    sql.exec('INSERT INTO sessions (token, name_lc, expires) VALUES (?, ?, ?)', 'tok-' + name.toLowerCase(), name.toLowerCase(), 9e12);
  }
  const store = new SqlStore(sql);
  for (const [name, role] of KNIGHTS) if (role !== 'player') store.setRole(name.toLowerCase(), role);
  return { store, sql };
}
function memoryStore() {
  const store = new MemoryStore();
  for (const [name, role] of KNIGHTS) store.addAccount(name, role);
  return { store };
}

// The same calls, in the same order; every answer is written down and checked.
function script(store) {
  const out = [];
  const say = (what, v) => { out.push([what, JSON.parse(JSON.stringify(v === undefined ? null : v))]); return v; };
  say('account mudgoll', store.account('mudgoll'));
  say('account spaced', store.account('  zed   TWO '));
  say('account nobody', store.account('Nobody'));
  say('account empty', store.account(''));
  say('account null', store.account(null));
  store.setRole('sam', 'admin'); say('sam admin', store.account('Sam').role);
  store.setRole('sam', 'nonsense'); say('sam nonsense is player', store.account('Sam').role);
  store.setMute('sam', 5000); store.setMute('ada', ALWAYS); store.setMute('bo', 3000);
  say('muted at 3000', store.mutedList(3000));
  say('muted at 4999', store.mutedList(4999));
  say('muted at 5000', store.mutedList(5000));
  store.setMute('sam', 0);
  say('sam unmuted', store.account('sam').mutedUntil);
  store.setMute('bo', ALWAYS * 2);
  say('mute capped at ALWAYS', store.account('bo').mutedUntil);
  store.setBanned('bo', true); store.setBanned('zed two', true);
  say('banned', store.bannedList());
  say('bo banned', store.account('bo').banned);
  store.setBanned('zed two', false);
  say('banned after unban', store.bannedList());
  store.log({ at: 10, by: 'MudGoll', act: 'mute', target: 'Sam', detail: '5m' });
  store.log({ at: 11, by: 'parent page', act: 'role', target: 'Ada', detail: 'admin' });
  store.log({ at: 12, by: 'MudGoll', act: 'kick', target: 'Sam' });
  say('modlog 2', store.modLog(2));
  say('modlog all', store.modLog(10));
  // parties
  const table = [{ id: 'coins', min: 5, max: 9, w: 3 }, { id: 'bread', min: 1, max: 1, w: 1 }];
  const pid = say('pid', store.addParty({ at: 1000, by: 'MudGoll', map: 'over', region: 'Thistledown', hat: 1000, table, spots: [[10, 12], [11, 12], [12, 12], [10, 13], [11, 13]], expires: 1000 + PARTY_LIFE }));
  say('live', store.liveParties(2000));
  say('light first', store.light(pid, 0, 'sam', 2000, { id: 'coins', qty: 7 }));
  say('light again', store.light(pid, 0, 'ada', 2000, { id: 'bread', qty: 1 }));
  say('light no such k', store.light(pid, 9, 'ada', 2000, { id: 'bread', qty: 1 }));
  say('light no such party', store.light(pid + 5, 0, 'ada', 2000, { id: 'bread', qty: 1 }));
  say('light hat', store.light(pid, 1, 'sam', 2500, { id: 'party_hat_purple', qty: 1, hat: 'purple' }));
  say('light ada', store.light(pid, 2, 'ada', 1500, { id: 'bread', qty: 1 }));
  say('live after lights', store.liveParties(3000));
  say('unclaimed sam', store.unclaimed('sam', 0));
  say('unclaimed sam since 2100', store.unclaimed('sam', 2100));
  say('claim by ada', store.claim(pid, 0, 'ada'));
  say('claim by sam', store.claim(pid, 0, 'sam'));
  say('claim twice', store.claim(pid, 0, 'sam'));
  say('claim unlit', store.claim(pid, 4, 'sam'));
  say('unclaimed sam after claim', store.unclaimed('sam', 0));
  say('unclaimed ada', store.unclaimed('ada', 0));
  store.endParty(pid);
  say('live after end', store.liveParties(3000));
  say('light after end (the Room checks the party first)', store.light(pid, 3, 'ada', 3000, { id: 'coins', qty: 5 }));
  const pid2 = say('pid2', store.addParty({ at: 5000, by: 'MudGoll', map: 'cave1', region: '', hat: 10, table, spots: [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2]], expires: 5000 + PARTY_LIFE }));
  say('live at 6000', store.liveParties(6000));
  say('live at expiry', store.liveParties(5000 + PARTY_LIFE));
  // a new party more than 7 days after the first one ended clears it away, prizes and all
  say('pid3', store.addParty({ at: 1000 + PARTY_LIFE + PRIZE_KEEP + 1, by: 'MudGoll', map: 'over', region: 'Thistledown', hat: 100, table, spots: [[5, 5], [6, 5], [7, 5], [5, 6], [6, 6]], expires: 1000 + PARTY_LIFE + PRIZE_KEEP + 1 + PARTY_LIFE }));
  say('unclaimed sam after the clean-up', store.unclaimed('sam', 0));
  say('claim of a cleaned party', store.claim(pid, 1, 'sam'));
  say('pid2 still there', store.light(pid2, 0, 'bo', 7000, { id: 'bread', qty: 1 }));
  // mod_log keeps its newest 5,000 (trimmed on the first write after a wake and every 200 writes after that)
  for (let i = 0; i < 5300; i++) store.log({ at: 100 + i, by: 'MudGoll', act: 'mute', target: 'Sam', detail: String(i) });
  const all = store.modLog(100000);
  say('modlog kept', [all.length, all[0].detail, all[all.length - 1].detail]);
  return out;
}

test('SqlStore and MemoryStore give the same answer to every call of one script, and the answers are right', () => {
  const s = script(sqlStore().store), m = script(memoryStore().store);
  assert.equal(s.length, m.length);
  for (let i = 0; i < s.length; i++) assert.deepEqual(s[i], m[i], s[i][0]);
  const got = Object.fromEntries(m);
  assert.deepEqual(got['account mudgoll'], { name: 'MudGoll', lc: 'mudgoll', role: 'admin', mutedUntil: 0, banned: false });
  assert.deepEqual(got['account spaced'], { name: 'Zed Two', lc: 'zed two', role: 'player', mutedUntil: 0, banned: false });
  assert.equal(got['account nobody'], null); assert.equal(got['account empty'], null); assert.equal(got['account null'], null);
  assert.equal(got['sam admin'], 'admin'); assert.equal(got['sam nonsense is player'], 'player');
  assert.deepEqual(got['muted at 3000'], [{ name: 'Ada', until: ALWAYS }, { name: 'Sam', until: 5000 }]);
  assert.deepEqual(got['muted at 4999'], [{ name: 'Ada', until: ALWAYS }, { name: 'Sam', until: 5000 }]);
  assert.deepEqual(got['muted at 5000'], [{ name: 'Ada', until: ALWAYS }]);
  assert.equal(got['sam unmuted'], 0); assert.equal(got['mute capped at ALWAYS'], ALWAYS);
  assert.deepEqual(got['banned'], [{ name: 'Bo' }, { name: 'Zed Two' }]); assert.equal(got['bo banned'], true);
  assert.deepEqual(got['banned after unban'], [{ name: 'Bo' }]);
  assert.deepEqual(got['modlog 2'], [{ at: 12, by: 'MudGoll', act: 'kick', target: 'Sam', detail: '' }, { at: 11, by: 'parent page', act: 'role', target: 'Ada', detail: 'admin' }]);
  assert.equal(got['modlog all'].length, 3);
  assert.equal(got['pid'], 1);
  assert.deepEqual(got['live'], [{ id: 1, at: 1000, by: 'MudGoll', map: 'over', region: 'Thistledown', hat: 1000, table: [{ id: 'coins', min: 5, max: 9, w: 3 }, { id: 'bread', min: 1, max: 1, w: 1 }], expires: 1000 + PARTY_LIFE,
    crackers: [{ k: 0, tx: 10, ty: 12, litBy: null }, { k: 1, tx: 11, ty: 12, litBy: null }, { k: 2, tx: 12, ty: 12, litBy: null }, { k: 3, tx: 10, ty: 13, litBy: null }, { k: 4, tx: 11, ty: 13, litBy: null }] }]);
  assert.equal(got['light first'], true); assert.equal(got['light again'], false); assert.equal(got['light no such k'], false); assert.equal(got['light no such party'], false);
  assert.deepEqual(got['live after lights'][0].crackers.map(c => c.litBy), ['sam', 'sam', 'ada', null, null]);
  assert.deepEqual(got['unclaimed sam'], [{ id: 'p1.0', reward: { id: 'coins', qty: 7 } }, { id: 'p1.1', reward: { id: 'party_hat_purple', qty: 1, hat: 'purple' } }]);
  assert.deepEqual(got['unclaimed sam since 2100'], [{ id: 'p1.1', reward: { id: 'party_hat_purple', qty: 1, hat: 'purple' } }]);
  assert.equal(got['claim by ada'], false); assert.equal(got['claim by sam'], true); assert.equal(got['claim twice'], true); assert.equal(got['claim unlit'], false);
  assert.deepEqual(got['unclaimed sam after claim'], [{ id: 'p1.1', reward: { id: 'party_hat_purple', qty: 1, hat: 'purple' } }]);
  assert.deepEqual(got['unclaimed ada'], [{ id: 'p1.2', reward: { id: 'bread', qty: 1 } }]);
  assert.deepEqual(got['live after end'], []);
  assert.equal(got['pid2'], 2);
  assert.deepEqual(got['live at 6000'].map(p => p.id), [2]); assert.deepEqual(got['live at expiry'], []);
  assert.equal(got['pid3'], 3);
  assert.deepEqual(got['unclaimed sam after the clean-up'], []);
  assert.equal(got['claim of a cleaned party'], false);
  assert.equal(got['pid2 still there'], true);
  // 5,303 written: trims on writes 1, 201, ..., 5,001 and 5,201 (each back to the newest 5,000), then 102 more
  assert.deepEqual(got['modlog kept'], [5102, '5299', '198']);
});

test('SqlStore: banning drops every session of that knight and no one else\'s', () => {
  const { store, sql } = sqlStore();
  store.setBanned('bo', true);
  assert.deepEqual(sql.exec('SELECT name_lc FROM sessions ORDER BY name_lc').toArray().map(r => r.name_lc), ['ada', 'mudgoll', 'sam', 'zed two']);
  store.setBanned('bo', false);
  assert.equal(sql.exec("SELECT COUNT(*) AS n FROM sessions WHERE name_lc = 'bo'").one().n, 0);   // unbanning does not bring a login back
});

test('a Room over the SqlStore: a mute, a ban, a party, a light and a prize all hold through a nap', () => {
  const { store } = sqlStore();
  const clock = { t: 5000 };
  const sock = () => { const s = { got: [], closed: null, state: null, send(x) { s.got.push(JSON.parse(x)); }, close(code) { s.closed = code; }, attach(st) { s.state = st; } }; s.last = t => s.got.filter(m => m.t === t).pop(); return s; };
  const room = new Room({ now: () => clock.t, wake: () => { }, store, random: () => 0.5 });
  const say = (r, s, m) => r.message(s, JSON.stringify(m));
  const knight = (r, name, x, y) => { const s = sock(); r.join(s, name); say(r, s, { t: 'hello', v: 1 }); say(r, s, { t: 'p', map: 'over', x, y, region: 'Thistledown' }); return s; };
  const mud = knight(room, 'MudGoll', 10 * TILE + 24, 10 * TILE + 24);
  const sam = knight(room, 'Sam', 10 * TILE + 24, 12 * TILE + 24);
  assert.equal(mud.last('welcome').role, 'admin');
  say(room, mud, { t: 'mute', n: 'Sam', span: '1h' });
  assert.deepEqual(sam.last('muted'), { t: 'muted', left: 3600 });
  clock.t += 1000;
  say(room, mud, { t: 'ban', n: 'Bo' });
  say(room, mud, { t: 'party', spots: [[10, 12], [11, 12], [12, 12], [10, 13], [11, 13]], table: [{ id: 'coins', min: 5, max: 9, w: 1 }], hat: 1000 });
  assert.equal(sam.last('crackers').list.length, 5);
  say(room, sam, { t: 'light', id: 'p1.0' });
  assert.deepEqual(sam.last('boom'), { t: 'boom', id: 'p1.0', n: 'Sam', fuse: 1750, reward: { id: 'coins', qty: 7 } });
  // the world naps: a new Room on the same database
  clock.t += 60000;
  const room2 = new Room({ now: () => clock.t, wake: () => { }, store: new SqlStore(store.sql), random: () => 0.5 });
  assert.deepEqual(Array.from(room2.parties.keys()), [1]);
  const bo = sock(); room2.join(bo, 'Bo');
  assert.equal(bo.closed, 4003);
  const sam2 = knight(room2, 'Sam', 11 * TILE + 24, 12 * TILE + 24);
  assert.deepEqual(sam2.got.filter(m => ['welcome', 'muted', 'crackers', 'prize'].includes(m.t)).map(m => m.t), ['welcome', 'muted', 'crackers', 'prize']);
  assert.equal(sam2.last('muted').left, 3600 - 61);
  assert.deepEqual(sam2.last('prize'), { t: 'prize', id: 'p1.0', reward: { id: 'coins', qty: 7 } });
  assert.equal(sam2.last('crackers').list.length, 4);
  say(room2, sam2, { t: 'claim', id: 'p1.0' });
  say(room2, sam2, { t: 'light', id: 'p1.1' });
  assert.equal(sam2.last('boom').id, 'p1.1');
  say(room2, sam2, { t: 'light', id: 'p1.0' });
  assert.deepEqual(sam2.last('light_no'), { t: 'light_no', id: 'p1.0', code: 'taken' });
  assert.deepEqual(store.unclaimed('sam', 0).map(w => w.id), ['p1.1']);
  assert.deepEqual(store.modLog(5).map(r => r.act), ['party', 'ban', 'mute']);
});
