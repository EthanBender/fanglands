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
  const own = { classList: (() => { const s = new Set(); return { add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), contains: c => s.has(c), toggle: (c, on) => (on ?? !s.has(c)) ? s.add(c) : s.delete(c) }; })(), style: {}, value: '', textContent: '', children: [], dataset: {} };
  const f = function () { return p; };
  const p = new Proxy(f, {
    get: (t, k) => k in own ? own[k] : k === Symbol.toPrimitive ? (() => '') : k === Symbol.iterator ? function* () { } : k === 'then' ? undefined : k === 'length' ? 0 : p,
    set: (t, k, v) => { own[k] = v; return true; },
    apply: () => p,
  });
  return p;
}

function page({ hidden = false, search = '', hist = [], sim = null, yes = false } = {}) {
  const els = new Map(), calls = [], intervals = new Map(), listeners = {};
  let seq = 0;
  const document = {
    hidden,
    getElementById: id => { if (!els.has(id)) els.set(id, fakeEl()); return els.get(id); },
    createElement: () => fakeEl(),
    createTextNode: () => fakeEl(),
    addEventListener: (type, f) => { (listeners[type] = listeners[type] || []).push(f); },
  };
  const meter = { today: { day: '2026-10-04', wsIn: 40, http: 12, admin: 10, gameHttp: 2, est: 14, gameEst: 4 }, days: [], freeLimit: 100000, waiting: 0 };
  const posts = [];
  const fetch = async (path, opt) => {
    calls.push(path.split('?')[0]);
    if (opt && opt.method === 'POST') posts.push({ path, body: JSON.parse(opt.body) });
    const body = /\/sim$/.test(path) ? Object.assign({ meter }, sim ? (typeof sim === 'function' ? sim(posts) : sim) : {}) : /\/invite$/.test(path) ? { invite: 'TEST-1234' } : [];
    return { ok: true, status: 200, json: async () => body };
  };
  const ctx = {
    document, fetch, console,
    sessionStorage: { getItem: () => 'test-admin', setItem() { }, removeItem() { } },
    setInterval: (f, ms) => { const id = ++seq; intervals.set(id, { f, ms }); return id; },
    clearInterval: id => { intervals.delete(id); },
    setTimeout: (f) => { Promise.resolve().then(f); return 0; }, clearTimeout() { },
    confirm: () => yes, alert() { }, location: { reload() { }, pathname: '/admin', search, hash: '' }, history: { state: null, replaceState: (st, t, u) => hist.push(u) }, navigator: {},
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
  return { settle, advance, show, take, intervals, els, posts };
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
