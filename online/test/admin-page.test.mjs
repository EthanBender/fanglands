// The admin page's own traffic (docs/ONLINE.md, "The shared world", Stage 0): the page that shows the meter must not be
// the biggest thing the meter counts. Its script runs here against a stand-in DOM, a stand-in fetch that records every
// call, and timers this test moves by hand: the meter is read on opening and on Refresh only, the 10 s refresh never
// reads it, and a hidden page (another tab, a locked iPad) makes no calls at all until it is shown again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/admin.html', import.meta.url), 'utf8');
const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));

// an element that is anything it is asked to be: unknown properties are more such elements, calls return one, and what
// is written to it reads back (textContent, value, onclick ...)
function fakeEl() {
  // children: what appendChild put in (innerHTML = '' empties it), so a test can count a table row's cells
  const own = { classList: (() => { const s = new Set(); return { add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), contains: c => s.has(c), toggle: (c, on) => (on ?? !s.has(c)) ? s.add(c) : s.delete(c) }; })(), style: {}, value: '', textContent: '', children: [], dataset: {} };
  own.appendChild = c => { own.children.push(c); return c; };
  // listeners a script adds (keydown on a box) and click(), which runs onclick as a browser's would
  own.listeners = {};
  own.addEventListener = (type, f) => { (own.listeners[type] = own.listeners[type] || []).push(f); };
  own.click = () => own.onclick && own.onclick();
  const f = function () { return p; };
  const p = new Proxy(f, {
    get: (t, k) => k in own ? own[k] : k === Symbol.toPrimitive ? (() => '') : k === Symbol.iterator ? function* () { } : k === 'then' ? undefined : k === 'length' ? 0 : p,
    set: (t, k, v) => { if (k === 'innerHTML') own.children = []; own[k] = v; return true; },
    apply: () => p,
  });
  return p;
}

function page({ hidden = false, search = '', hist = [], sim = null, yes = false, host = '', answer = null } = {}) {
  const els = new Map(), calls = [], intervals = new Map(), listeners = {}, made = [];
  let seq = 0;
  const document = {
    hidden,
    getElementById: id => { if (!els.has(id)) els.set(id, fakeEl()); return els.get(id); },
    createElement: () => { const e = fakeEl(); made.push(e); return e; },
    createTextNode: () => fakeEl(),
    addEventListener: (type, f) => { (listeners[type] = listeners[type] || []).push(f); },
  };
  const meter = { today: { day: '2026-10-04', wsIn: 40, http: 12, admin: 10, gameHttp: 2, est: 14, gameEst: 4 }, days: [], freeLimit: 100000, waiting: 0 };
  const posts = [];
  const fetch = async (path, opt) => {
    calls.push(path.split('?')[0]);
    if (opt && opt.method === 'POST') posts.push({ path, body: JSON.parse(opt.body) });
    // a POST the test answers itself ({status, body}): the world's refusals as the page gets them
    const own = answer && opt && opt.method === 'POST' ? answer(path, JSON.parse(opt.body)) : null;
    if (own) return { ok: own.status < 400, status: own.status, json: async () => own.body };
    const body = /\/sim$/.test(path) ? Object.assign({ meter }, sim ? (typeof sim === 'function' ? sim(posts) : sim) : {}) : /\/invite$/.test(path) ? { invite: 'TEST-1234' } : [];
    return { ok: true, status: 200, json: async () => body };
  };
  const ctx = {
    document, fetch, console,
    sessionStorage: { getItem: () => 'test-admin', setItem() { }, removeItem() { } },
    setInterval: (f, ms) => { const id = ++seq; intervals.set(id, { f, ms }); return id; },
    clearInterval: id => { intervals.delete(id); },
    setTimeout: (f) => { Promise.resolve().then(f); return 0; }, clearTimeout() { },
    confirm: () => yes, alert() { }, location: { reload() { }, pathname: '/admin', search, hash: '', host }, history: { state: null, replaceState: (st, t, u) => hist.push(u) }, navigator: {},
    Date, Math, JSON, Promise, Number, String, Object, Array, Set, Map, Error, encodeURIComponent, URLSearchParams,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(script, ctx, { filename: 'admin.html' });
  const settle = async () => { for (let i = 0; i < 50; i++) await new Promise(r => setImmediate(r)); };
  // ms of the page's own time: each live 10 s timer fires once per 10 s, and each refresh finishes before the next
  const advance = async ms => { for (let t = 0; t < ms; t += 10000) { for (const { f } of [...intervals.values()]) f(); await settle(); } };
  const show = async on => { document.hidden = !on; for (const f of listeners.visibilitychange || []) f(); await settle(); };
  const take = () => { const c = calls.splice(0); const by = {}; for (const p of c) by[p] = (by[p] || 0) + 1; return { n: c.length, by }; };
  return { settle, advance, show, take, intervals, els, posts, made };
}

test('the admin page: the meter is read on opening and on Refresh, never by the 10 s refresh', async () => {
  const P = page();
  await P.settle();
  const open = P.take();
  assert.equal(open.by['/api/admin/sim'], 1, 'the meter is read once on opening');
  // one visible minute: 6 refreshes of who is online, the chat, the moderation log and the trades; no meter
  await P.advance(60000);
  const minute = P.take();
  assert.deepEqual(minute.by, { '/api/admin/online': 6, '/api/admin/chat': 6, '/api/admin/modlog': 6, '/api/admin/trades': 6 });
  assert.equal(minute.n, 24, '24 calls a visible minute (it was 30 with the meter in the timer)');
  // Refresh reads the meter
  P.els.get('refresh').onclick();
  await P.settle();
  assert.equal(P.take().by['/api/admin/sim'], 1, 'Refresh reads the meter');
  // the meter line names the game's share and the page's own calls apart
  const line = String(P.els.get('meter').textContent);
  assert.match(line, /the game sent 40 socket messages and made 2 calls, about 4 of the 100,000/);
  assert.match(line, /This page and the backups made 10 calls on top, so about 14 in all/);
});

// The night of 3-4 Oct 2026 read 17,266 game calls with no way to tell the World's alarms from the pages' saves: the line and
// the table now name the pages' calls, the alarms and this page's calls apart, and a day from before the alarm column says so.
// Rows written (the other daily limit, and the nearer one while anyone plays) are on the line and in the table too.
test('the admin page: the pages\' calls, the world\'s alarms, this page\'s calls and the rows written apart, in plain words', async () => {
  const from = Date.parse('2026-10-05T14:05:00Z');
  const today = { day: '2026-10-05', wsIn: 7186, http: 600, admin: 30, gameHttp: 570, alarms: 360, pageHttp: 210, alarmsSince: from, est: 960, gameEst: 930, rows: 4100, rowsSince: from };
  const meter = { today, days: [today, { day: '2026-10-04', wsIn: 29118, http: 17270, admin: 4, gameHttp: 17266, alarms: null, pageHttp: null, alarmsSince: null, est: 18726, gameEst: 18722, rows: null, rowsSince: null }],
    freeLimit: 100000, freeRows: 100000, waiting: 0 };
  const P = page({ sim: { meter } });
  await P.settle();
  const line = String(P.els.get('meter').textContent);
  assert.match(line, /the game's pages made 210 calls and sent 7,186 socket messages, and the world woke itself 360 times on its own timers \(alarms\)\. Together that is about 930 of the 100,000 requests/);
  assert.match(line, /This page and the backups made 30 calls on top, so about 960 in all/);
  assert.match(line, /Alarms are counted on their own only since 14:05 UTC today; any before that are inside the pages' calls\./);
  assert.match(line, /The world wrote 4,100 rows to its database since 14:05 UTC, 4\.1% of the 100,000 rows a day the free plan allows \(a day over it stops every save until midnight UTC\)\. The nearer limit today is rows written: that share is what the cost gate reads\./);
  const rows = P.els.get('meterdays').children.map(tr => tr.children.map(td => String(td.textContent)));
  assert.deepEqual(rows, [['2026-10-05', '7,186', '210 (alarms before 14:05 UTC inside)', '360 (since 14:05 UTC)', '930', '0.93%', '30', '0.96%', '4,100 (since 14:05 UTC)', '4.1%'],
    ['2026-10-04', '29,118', '17,266 (alarms inside)', 'not counted apart', '18,722', '18.7%', '4', '18.7%', 'not counted', '']]);
  // a day counted whole: no "only since", and requests the nearer limit when they are
  const whole = Object.assign({}, today, { alarmsSince: null, rows: 500, rowsSince: null });
  const P2 = page({ sim: { meter: Object.assign({}, meter, { today: whole, days: [whole] }) } });
  await P2.settle();
  assert.doesNotMatch(String(P2.els.get('meter').textContent), /only since|since 14:05/);
  assert.match(String(P2.els.get('meter').textContent), /The world wrote 500 rows to its database, 0\.5% of .* The nearer limit today is requests/);
  // a rollback and back (review round 2, 6 Oct 2026): 9 Oct partial from 12:00, 8 Oct counted only by older code (not a false
  // 0), 7 Oct partial from 15:00, each from its own mark
  const later = { today: { day: '2026-10-10', wsIn: 10, http: 6, admin: 0, gameHttp: 6, alarms: 1, pageHttp: 5, alarmsSince: null, est: 7, gameEst: 7, rows: 30, rowsSince: null },
    days: [{ day: '2026-10-10', wsIn: 10, http: 6, admin: 0, gameHttp: 6, alarms: 1, pageHttp: 5, alarmsSince: null, est: 7, gameEst: 7, rows: 30, rowsSince: null },
      { day: '2026-10-09', wsIn: 0, http: 406, admin: 0, gameHttp: 406, alarms: 4, pageHttp: 402, alarmsSince: Date.parse('2026-10-09T12:00:00Z'), est: 406, gameEst: 406, rows: 50, rowsSince: Date.parse('2026-10-09T12:00:00Z') },
      { day: '2026-10-08', wsIn: 0, http: 1050, admin: 0, gameHttp: 1050, alarms: null, pageHttp: null, alarmsSince: null, est: 1050, gameEst: 1050, rows: null, rowsSince: null },
      { day: '2026-10-07', wsIn: 0, http: 15, admin: 0, gameHttp: 15, alarms: 10, pageHttp: 5, alarmsSince: Date.parse('2026-10-07T15:00:00Z'), est: 15, gameEst: 15, rows: 12, rowsSince: Date.parse('2026-10-07T15:00:00Z') }],
    freeLimit: 100000, freeRows: 100000, waiting: 0 };
  const P4 = page({ sim: { meter: later } });
  await P4.settle();
  assert.doesNotMatch(String(P4.els.get('meter').textContent), /only since/);
  assert.deepEqual(P4.els.get('meterdays').children.map(tr => tr.children.slice(2, 4).concat(tr.children.slice(8, 9)).map(td => String(td.textContent))),
    [['5', '1', '30'], ['402 (alarms before 12:00 UTC inside)', '4 (since 12:00 UTC)', '50 (since 12:00 UTC)'], ['1,050 (alarms inside)', 'not counted apart', 'not counted'],
      ['5 (alarms before 15:00 UTC inside)', '10 (since 15:00 UTC)', '12 (since 15:00 UTC)']]);
  // a world from before the alarm column: the old sentence, and it says the alarms are inside (and that rows are not counted)
  const P3 = page({ sim: { meter: { today: meter.days[1], days: [meter.days[1]], freeLimit: 100000, waiting: 0 } } });
  await P3.settle();
  assert.match(String(P3.els.get('meter').textContent), /made 17,266 calls, about 18,722 .* alarms are not counted apart on this day.* \(Rows written are not counted on this day\.\)/);
});

test('the admin page: hidden, it makes no calls at all; shown again, it refreshes once and the timer resumes', async () => {
  const P = page();
  await P.settle(); P.take();
  await P.show(false);
  assert.equal(P.intervals.size, 0, 'no timer while hidden');
  await P.advance(3600000);
  assert.equal(P.take().n, 0, 'an hour hidden: no calls');
  await P.show(true);
  const back = P.take();
  assert.deepEqual(back.by, { '/api/admin/online': 1, '/api/admin/chat': 1, '/api/admin/modlog': 1, '/api/admin/trades': 1 }, 'shown: one refresh straight away, no meter');
  assert.equal(P.intervals.size, 1, 'and one 10 s timer again');
  await P.advance(20000);
  assert.equal(P.take().n, 8);
});

test('the admin page opened in a hidden tab starts no timer until it is shown', async () => {
  const P = page({ hidden: true });
  await P.settle();
  assert.equal(P.take().by['/api/admin/sim'], 1, 'it still loads once');
  assert.equal(P.intervals.size, 0);
  await P.advance(600000);
  assert.equal(P.take().n, 0);
});

test('two addresses: the one-load marker of a hop that kept this tab on the old address (?fl_hop) leaves the address at once, the rest kept', async () => {
  const hist = [];
  const p = page({ search: '?x=1&fl_hop=here', hist }); await p.settle();
  assert.deepEqual(hist, ['/admin?x=1']);
  const none = []; const q = page({ search: '?x=1', hist: none }); await q.settle();
  assert.deepEqual(none, []);
});

// the shared world, Stage 1: the movement check and the Atlas come in the same read, and the switch is one POST
test('the admin page: the movement check and the Atlas ride the meter\'s read (no new calls); its button posts the switch', async () => {
  const today = { day: '2026-10-04', checked: 1234, speed: 0, wall: 1, jumps: 0, waived: 3, skipped: 12, old: 2 };
  const sim = posts => {
    const mode = posts.length ? posts[posts.length - 1].body.move : 'observe';
    return { sim: { move: mode }, atlas: { hash: '1a2b3c4d5e6f7a8b', places: 35, fixed: 2950 },
      move: { mode, today, days: [today], recent: [{ at: Date.now(), n: 'Ben', map: 'over', kind: 'wall', x: 10, y: 20, px: 10, py: 120, ms: 125, spd: 175, detail: 'through' }], knights: [{ n: 'Ann', map: 'over', atlas: 'same', caps: [] }, { n: 'Ben', map: 'over', atlas: 'old', caps: [] }] } };
  };
  const P = page({ sim, yes: true });
  await P.settle();
  const open = P.take();
  assert.equal(open.by['/api/admin/sim'], 1, 'one read on opening, as before');
  assert.match(String(P.els.get('movecheck').textContent), /watching .* 1,234 steps checked, 0 too fast, 1 into or through a wall, 0 bursts of jumps\. 12 steps were not checked .*2 from a page older than the world/);
  assert.match(String(P.els.get('atlasline').textContent), /World map 1a2b3c4d5e6f7a8b \(35 places\): 2 knights on, 1 on an older page \(Ben\), asked to reload\./);
  assert.equal(String(P.els.get('movetoggle').textContent), 'Turn the movement check off');
  await P.els.get('movetoggle').onclick(); await P.settle();
  assert.deepEqual(P.posts.map(p => p.body), [{ move: 'off' }]);
  assert.match(String(P.els.get('movecheck').textContent), /^Movement check: off\./);
  assert.equal(String(P.els.get('movetoggle').textContent), 'Turn the movement check back on');
  assert.equal(P.take().by['/api/admin/sim'], 1, 'the switch is the one POST');
  await P.advance(60000);
  assert.equal(P.take().by['/api/admin/sim'], undefined, 'the 10 s refresh still never reads it');
});

// the shared world, Stage 2: the maps the world runs itself ride the same read; each button asks, then posts one switch
test('the admin page: the places the world runs, from the same read; a place\'s button and the master switch each post one switch', async () => {
  const world = (maps, master = 'on', held = {}) => ({ sim: { move: 'observe', master, maps, held }, world: { modes: { deepholm: maps.deepholm === 'world' && !held.deepholm ? 'world' : 'keeper', aerie: 'keeper', coalmine: 'keeper' }, knights: { deepholm: 2, aerie: 0, coalmine: 1 }, empty: ['coalmine'], loaded: true, running: maps.deepholm === 'world', ticks: 900, tick: { n: 900, p50: 0.31, p99: 0.9, max: 2 }, boot: { deepholm: 1210 }, heap: null, copies: maps.deepholm === 'world' ? [{ map: 'deepholm', bootMs: 1210, knights: 2, monsters: 2, ticks: 900, errors: 0, parked: false }] : [], cap: 4, skipped: 0, log: [{ at: Date.now(), map: 'deepholm', from: 'world', to: 'keeper', reason: 'throws', tickP99: 1 }] } });
  const sim = posts => {
    const last = posts.length ? posts[posts.length - 1].body : {};
    if (last.master) return world({ deepholm: 'world', aerie: 'keeper' }, last.master);
    if (last.maps) return world({ deepholm: last.maps.deepholm || 'keeper', aerie: 'keeper' });
    return world({ deepholm: 'keeper', aerie: 'keeper' }, 'on', { deepholm: { reason: 'throws', at: Date.now() } });
  };
  const P = page({ sim, yes: true });
  await P.settle();
  assert.equal(P.take().by['/api/admin/sim'], 1, 'still the one read on opening');
  assert.match(String(P.els.get('worldline').textContent), /^Switched on: .*Not running now/);
  const held = P.made.find(e => /handed back .* because it hit an error 3 times/.test(String(e.textContent)));
  assert.ok(held, 'a held place says why');
  const runIt = P.made.filter(e => String(e.textContent) === 'Let the world run it');
  assert.equal(runIt.length, 2, 'one button per place the world can run (the coal mine has none)');
  // the knights there are the world's own count on the keeper path too (2 in Deepholm while a knight's game runs it)
  { const texts = P.els.get('worldmaps').children.map(tr => tr.children.map(td => String(td.textContent)));
    assert.deepEqual(texts[0].slice(0, 3).map((t, i) => i === 1 ? t.split(':')[0] : t), ['Deepholm (the dwarves)', 'a knight\'s game', '2'], 'Knights there on the keeper path: ' + JSON.stringify(texts[0])); }
  await runIt[0].onclick(); await P.settle();
  assert.deepEqual(P.posts.map(p => p.body), [{ maps: { deepholm: 'world' } }]);
  assert.match(String(P.els.get('worldline').textContent), /Running now: 1 place, 10 ticks a second, half under 0\.31 ms, 99 in 100 under 0\.90 ms\./);
  // every row has its six cells under the six headers; the running place shows its knights, its monsters and how long it took to build
  { const rows = P.els.get('worldmaps').children, texts = rows.map(tr => tr.children.map(td => String(td.textContent)));
    assert.equal(rows.length, 3, 'one row per place');
    for (const tr of rows) assert.equal(tr.children.length, 6, 'six cells in every row: ' + JSON.stringify(texts));
    assert.deepEqual(texts[0].slice(0, 5), ['Deepholm (the dwarves)', 'the world', '2', '2', '1210 ms'], 'Deepholm: its knights, its monsters and its build time under their headers');
    assert.equal(String(rows[0].children[5].children[0].textContent), 'Give it back to a knight\'s game', 'the button sits in the last column');
    assert.deepEqual(texts[1].slice(2, 5), ['0', '', ''], 'a place nobody is in: 0 knights, no monsters, never built');
    // the coal mine: listed, greyed, with the reason, its knights, and no button
    assert.equal(rows[2].className, 'dim');
    assert.deepEqual(texts[2], ['The coal mine', 'a knight\'s game (no monsters live there)', '1', '0', '', 'Nothing to share there.']);
    assert.ok(!rows[2].children[5].children.length, 'no button for the coal mine'); }
  await P.els.get('mastertoggle').onclick(); await P.settle();
  assert.deepEqual(P.posts.map(p => p.body)[1], { master: 'off' });
  assert.match(String(P.els.get('worldline').textContent), /^Switched off: /);
  assert.equal(P.take().by['/api/admin/sim'], 2, 'two POSTs, nothing else');
  await P.advance(60000);
  assert.equal(P.take().by['/api/admin/sim'], undefined, 'the 10 s refresh never reads it');
  // a page that says no posts nothing
  const Q = page({ sim, yes: false }); await Q.settle();
  for (const b of Q.made.filter(e => String(e.textContent) === 'Let the world run it')) await b.onclick();
  await Q.els.get('mastertoggle').onclick(); await Q.settle();
  assert.equal(Q.posts.length, 0);
  // a place being taken over (its copy not built yet) says so
  const R = page({ sim: () => { const v = world({ deepholm: 'world', aerie: 'keeper' }); v.world.copies = []; v.world.modes.deepholm = 'joining'; return v; } }); await R.settle();
  assert.match(String(R.els.get('worldline').textContent), /Starting a place now\./);
  assert.ok(!/Running now: 0 places/.test(String(R.els.get('worldline').textContent)));
  // just after a hand-back (an older world's loop still idling, no copy, every place on a knight's game): never 'starting'
  const B = page({ sim: () => { const v = world({ deepholm: 'keeper', aerie: 'keeper' }); v.world.running = true; v.world.copies = []; return v; } }); await B.settle();
  assert.ok(!/Starting/.test(String(B.els.get('worldline').textContent)), String(B.els.get('worldline').textContent));
  assert.match(String(B.els.get('worldline').textContent), /Not running now/);
  // a place whose knights have all stopped playing rests (its copy parked): said on the line and in its row
  const Z = page({ sim: () => { const v = world({ deepholm: 'world', aerie: 'keeper' }); v.world.running = false; v.world.copies[0].parked = true; return v; } }); await Z.settle();
  assert.match(String(Z.els.get('worldline').textContent), /Not running now .*Deepholm \(the dwarves\) is resting: nobody there is playing/);
  assert.equal(String(Z.els.get('worldmaps').children[0].children[1].textContent), 'the world (resting: nobody there is playing)');
});

// The Teachers section (docs/ONLINE.md, "The teacher view"): one call on opening and one on Refresh (the list, today's
// actions and the notice switch together), none from the 10 s refresh.
test('the admin page: the Teachers section is one call on opening and on Refresh, and none on the 10 s refresh', async () => {
  const P = page();
  await P.settle();
  const teacherCalls = t => Object.entries(t.by).filter(([p]) => /\/api\/admin\/teach/.test(p));
  const open = P.take();
  assert.deepEqual(teacherCalls(open), [['/api/admin/teachers', 1]]);
  await P.advance(30000);
  assert.deepEqual(teacherCalls(P.take()), []);
  P.els.get('refresh').onclick();
  await P.settle();
  assert.deepEqual(teacherCalls(P.take()), [['/api/admin/teachers', 1]]);
});

// The owner (2026-10-07): "i cant seem to create the log in and use it". Adding a teacher: Enter in either box adds; a short
// password is refused on the page with what to do and nothing is sent; the world's refusal is shown as "Not added." plus its
// plain words; the address the teacher is told is THIS world's game (the test world's admin page never sends a teacher to
// fanglands.com, where no such teacher exists).
test('the admin page: adding a teacher, as the owner does it (Enter, a short password, a refusal, which world)', async () => {
  const added = [];
  const P = page({ host: 'test.fanglands.com', answer: (path, body) => path === '/api/admin/teachers' ? (body.name === 'Cohen' ? { status: 409, body: { error: 'A knight in the game is already called Cohen, so a teacher cannot be. Add a first name or a first letter, like Mrs J Smith.', code: 'taken' } } : (added.push(body), { status: 200, body: { ok: true, id: added.length, name: body.name } })) : null });
  await P.settle();
  const said = () => String(P.els.get('tsaid').textContent), red = () => P.els.get('tsaid').style.color === '#ff9a9a';
  const teacherPosts = () => P.posts.filter(p => p.path === '/api/admin/teachers');
  const enter = async id => { for (const f of P.els.get(id).listeners.keydown || []) f({ key: 'Enter', preventDefault() { } }); await P.settle(); };
  // which world this page is: the test world's teachers sign in at test.fanglands.com, never at fanglands.com
  assert.match(String(P.els.get('tworld').textContent), /TEST world's \(test\.fanglands\.com\).*never at fanglands\.com/);
  assert.equal(String(P.els.get('tsite').textContent), 'test.fanglands.com');
  // a short password: refused on the page, nothing sent
  P.els.get('tname').value = 'Mr Bender'; P.els.get('tpass').value = 'cohen123';
  await enter('tpass');
  assert.equal(teacherPosts().length, 0);
  assert.equal(said(), 'Not added. The password needs at least 10 letters (spaces count); this one has 8. Type a longer one, or press Make one up.'); assert.ok(red());
  // Enter in the password box adds (before this, Enter did nothing and nothing said so)
  P.els.get('tpass').value = 'school rocks';
  await enter('tpass');
  assert.deepEqual(teacherPosts().map(p => p.body), [{ name: 'Mr Bender', pass: 'school rocks' }]);
  assert.equal(said(), "Added Mr Bender. The password is school rocks (it is not shown again). Tell Mr Bender: go to test.fanglands.com, type Mr Bender in Knight's name and this password in Secret word, and press Play."); assert.ok(!red());
  // Enter in the name box adds too; the world's refusal is shown as it said it, after "Not added."
  P.els.get('tname').value = 'Cohen'; P.els.get('tpass').value = 'maple-river-lantern-42';
  await enter('tname');
  assert.equal(teacherPosts().length, 2);
  assert.equal(said(), 'Not added. A knight in the game is already called Cohen, so a teacher cannot be. Add a first name or a first letter, like Mrs J Smith.'); assert.ok(red());
  // the main world's page tells the teacher fanglands.com (gorkscape.ca is the same world)
  for (const host of ['fanglands.com', 'gorkscape.ca']) {
    const M = page({ host, answer: (path, body) => path === '/api/admin/teachers' ? { status: 200, body: { ok: true, id: 1, name: body.name } } : null });
    await M.settle();
    M.els.get('tname').value = 'Mrs Smith'; M.els.get('tpass').value = 'maple-river-lantern-42';
    M.els.get('tadd').click(); await M.settle();
    assert.match(String(M.els.get('tsaid').textContent), /Tell Mrs Smith: go to fanglands\.com, type Mrs Smith/);
    assert.match(String(M.els.get('tworld').textContent), /MAIN world's \(fanglands\.com\)/);
  }
});
