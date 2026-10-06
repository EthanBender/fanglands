// The teacher's watch screen (online/public/teacher.html, docs/ONLINE.md "The teacher view") in a stand-in DOM with a fake
// clock, a fetch that records every call and a socket the test drives: no call on any timer but the 25 s ping, the
// reconnect rules, idle sign-out, the token never in a URL, text never HTML, the two-tap send-off, and the exact sentences.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/teacher.html', import.meta.url), 'utf8');
const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
const TOKEN = 'ab'.repeat(32);

// ---------- a small DOM ----------
let innerHTMLWrites = 0;
class El {
  constructor(tag, doc) { this.tagName = String(tag).toUpperCase(); this.doc = doc; this.children = []; this.parentNode = null; this._text = ''; this.className = ''; this.attrs = {}; this.style = {}; this.hidden = false; this.disabled = false; this.value = ''; this.id = ''; this.listeners = {}; this.scrollTop = 0; this.scrollHeight = 0; this.clientHeight = 0; this.type = ''; }
  get firstChild() { return this.children[0] || null; }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._text; }
  set textContent(v) { for (const c of this.children) c.parentNode = null; this.children = []; this._text = String(v); }
  set innerHTML(v) { innerHTMLWrites++; this.children = []; this._text = ''; }
  get classList() { const self = this; const set = () => new Set(self.className.split(/\s+/).filter(Boolean)); return { add: (...c) => { const s = set(); c.forEach(x => s.add(x)); self.className = [...s].join(' '); }, remove: (...c) => { const s = set(); c.forEach(x => s.delete(x)); self.className = [...s].join(' '); }, contains: c => set().has(c), toggle: (c, on) => { const s = set(); if (on ?? !s.has(c)) s.add(c); else s.delete(c); self.className = [...s].join(' '); } }; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  append(...cs) { for (const c of cs) this.appendChild(typeof c === 'string' ? Object.assign(new El('#text', this.doc), { _text: c }) : c); }
  insertBefore(c, ref) { if (!ref) return this.appendChild(c); if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; const i = this.children.indexOf(ref); this.children.splice(i < 0 ? this.children.length : i, 0, c); return c; }
  get nextSibling() { const p = this.parentNode; if (!p) return null; return p.children[p.children.indexOf(this) + 1] || null; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  fire(t, ev = {}) { for (const f of this.listeners[t] || []) f(Object.assign({ type: t, target: this, preventDefault() { }, stopPropagation() { } }, ev)); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }; }
  getContext() { return null; }
  focus() { }
  get visible() { for (let e = this; e; e = e.parentNode) if (e.hidden) return false; return true; }
}
function all(root) { const out = []; const walk = e => { out.push(e); e.children.forEach(walk); }; walk(root); return out; }

function page(opts = {}) {
  innerHTMLWrites = 0;
  const clock = { t: Date.UTC(2026, 9, 6, 14, 0, 0) };
  const timers = new Map(); let seq = 0;
  const setTimeout_ = (f, ms) => { const id = ++seq; timers.set(id, { at: clock.t + (ms || 0), f }); return id; };
  const setInterval_ = (f, ms) => { const id = ++seq; timers.set(id, { at: clock.t + ms, f, every: ms }); return id; };
  const clear_ = id => timers.delete(id);
  const doc = { hidden: false, listeners: {}, addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }, createElement: tag => new El(tag, doc) };
  doc.body = new El('body', doc);
  const store = opts.token ? { 'fl.teacher': opts.token } : {};
  const calls = [], socks = [], beacons = [], winListeners = {};
  let ticketN = 0;
  const reply = (status, body) => ({ ok: status < 300, status, json: async () => body });
  const fetch = async (url, o = {}) => {
    calls.push({ at: clock.t, url, o });
    if (opts.down) throw new Error('offline');
    if (url === '/api/teacher/login') { const b = JSON.parse(o.body); return b.pass === 'right-password-1' ? reply(200, { token: TOKEN, name: 'Mrs Smith', expires: clock.t + 36000000 }) : reply(401, { code: 'nomatch' }); }
    if (url === '/api/teacher/ticket') return reply(200, { ticket: 'tk' + (++ticketN) });
    if (url === '/api/teacher/logout') return reply(200, { ok: true });
    return reply(404, {});
  };
  class WS {
    constructor(url) { this.url = url; this.readyState = 0; this.sent = []; socks.push(this); this.at = clock.t; }
    send(s) { this.sent.push(s); }
    close() { this.readyState = 3; }
    open() { this.readyState = 1; if (this.onopen) this.onopen(); }
    recv(m) { this.onmessage({ data: JSON.stringify(m) }); }
    drop(code) { this.readyState = 3; if (this.onclose) this.onclose({ code }); }
  }
  class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(clock.t); } static now() { return clock.t; } }
  const win = {
    document: doc, fetch, WebSocket: WS, Date: FakeDate, JSON, Math, Object, Array, Set, Map, String, Number, Promise, Error, Uint8Array, encodeURIComponent, parseInt, isNaN, console,
    sessionStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    location: { protocol: 'https:', host: 'teacher.fanglands.com', href: 'https://teacher.fanglands.com/' },
    navigator: { sendBeacon: (url, body) => { beacons.push({ url, body }); return true; } },
    setTimeout: setTimeout_, setInterval: setInterval_, clearTimeout: clear_, clearInterval: clear_,
    innerWidth: opts.width || 1280, innerHeight: 800, devicePixelRatio: 2,
    addEventListener: (t, f) => { (winListeners[t] = winListeners[t] || []).push(f); },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(script, win, { filename: 'teacher.html' });
  const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r)); };
  // the fake clock moves; each timer fires at its time, in order
  const advance = async ms => {
    const end = clock.t + ms;
    for (;;) {
      let next = null; for (const [id, t] of timers) if (t.at <= end && (!next || t.at < next[1].at)) next = [id, t];
      if (!next) break;
      clock.t = next[1].at;
      if (next[1].every) next[1].at += next[1].every; else timers.delete(next[0]);
      next[1].f(); await settle();
    }
    clock.t = end; await settle();
  };
  const P = {
    win, doc, clock, calls, socks, beacons, store, advance, settle, S: win.__teacher,
    els: () => all(doc.body),
    text: () => all(doc.body).filter(e => e.visible).map(e => e._text).join('\n'),
    find: (txt, tag) => all(doc.body).find(e => e.visible && (!tag || e.tagName === tag) && e.textContent === txt) || null,
    findAll: re => all(doc.body).filter(e => e.visible && re.test(e.textContent)),
    click: e => { assert.ok(e, 'no such element'); for (const f of doc.listeners.click || []) f({ type: 'click' }); e.fire('click'); },
    tap: () => { for (const f of doc.listeners.pointerdown || []) f({ type: 'pointerdown' }); },
    ws: () => socks[socks.length - 1],
    pings: () => socks.reduce((n, s) => n + s.sent.filter(x => x === '{"t":"ping"}').length, 0),
    sent: t => socks.flatMap(s => s.sent).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(m => m && m.t === t),
    fireWin: t => { for (const f of winListeners[t] || []) f({ persisted: false }); },
    visible: h => { doc.hidden = h; for (const f of doc.listeners.visibilitychange || []) f({}); },
  };
  P.signIn = async () => {
    const form = all(doc.body).find(e => e.tagName === 'FORM');
    all(doc.body).find(e => e.id === 'tname').value = 'Mrs Smith';
    all(doc.body).find(e => e.id === 'tpass').value = 'right-password-1';
    form.fire('submit'); await settle();
  };
  P.live = async (k = KNIGHTS) => {
    await P.signIn(); P.ws().open();
    P.ws().recv({ t: 'w_hello', me: 'Mrs Smith', expires: clock.t + 36000000, now: clock.t, tz: 'America/Toronto', notice: true });
    P.ws().recv({ t: 'w_all', at: clock.t, knights: k, inside: [], gone: [], chatPause: null, acts: [], sentOff: [], chat: [] });
    await settle();
  };
  return P;
}
const row = (n, o = {}) => Object.assign({ n, role: 'player', map: 'over', place: 'Thistledown', x: 6000, y: 3700, doing: 'Fighting', since: Date.UTC(2026, 9, 6, 13, 18), away: false, muted: null, sentOff: 0 }, o);
const KNIGHTS = ['Ada', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kit', 'Leo'].map(n => row(n));

test('36. no call on any timer but the 25 s ping: ten idle minutes are exactly 24 pings; nothing at all while the page is hidden', async () => {
  const P = page();
  await P.live();
  const c0 = P.calls.length, s0 = P.socks.length;
  await P.advance(10 * 60000);
  assert.equal(P.calls.length, c0); assert.equal(P.socks.length, s0);
  assert.equal(P.pings(), 24);
  // hidden, and the line drops: no ticket, no socket until the page is seen again, then exactly one try
  P.visible(true); P.ws().drop(1006);
  await P.advance(30 * 60000);
  assert.equal(P.calls.length, c0); assert.equal(P.socks.length, s0);
  P.visible(false); await P.settle();
  assert.equal(P.calls.length, c0 + 1); assert.equal(P.socks.length, s0 + 1);
});

test('37. reconnect: 1, 2, 4 ... s, at most 300 s; after 30 tries it stops with Try again; never after w_bye or a close 4010-4014 or 4008', async () => {
  const P = page();
  await P.live();
  const opens = [];
  P.ws().drop(1006);
  for (let i = 0; i < 40; i++) { const n = P.socks.length; P.tap(); await P.advance(301000); if (P.socks.length > n) { opens.push(P.ws().at); P.ws().drop(1006); } }
  assert.equal(opens.length, 29);   // the first drop's 29 retries: 30 failures in all
  assert.ok(P.text().includes('Not connected')); assert.ok(P.find('Try again', 'BUTTON'));
  // the exact waits, measured on a fresh page
  const Q = page(); await Q.live(); Q.ws().drop(1006);
  const waits = []; let last = Q.clock.t;
  for (let i = 0; i < 12; i++) { const n = Q.socks.length; for (let s = 0; s < 400 && Q.socks.length === n; s++) await Q.advance(1000); waits.push(Math.round((Q.ws().at - last) / 1000)); Q.ws().drop(1006); last = Q.clock.t; }
  assert.deepEqual(waits, [1, 2, 4, 8, 16, 32, 64, 128, 256, 300, 300, 300]);
  for (const code of [4010, 4011, 4012, 4013, 4014, 4008]) {
    const R = page(); await R.live(); const n = R.socks.length;
    R.ws().drop(code); await R.advance(600000);
    assert.equal(R.socks.length, n, 'reconnected after ' + code);
    assert.equal(R.store['fl.teacher'], undefined);
  }
  const B = page(); await B.live(); const n = B.socks.length;
  B.ws().recv({ t: 'w_bye', code: 4013, text: 'x' }); B.ws().drop(1006); await B.advance(600000);
  assert.equal(B.socks.length, n);
  assert.ok(B.text().includes('Your password was changed. Sign in with the new one.'));
});

test('38. idle: the warning at 60 minutes, signed out at 62 (logout, storage cleared); a tap resets it; leaving the page sends the logout beacon', async () => {
  const P = page();
  await P.live();
  await P.advance(60 * 60000 + 1000);
  assert.ok(P.text().includes('Still watching? Tap anywhere to stay signed in. Signing out in 1:59.'));
  await P.advance(2 * 60000);
  const out = P.calls.filter(c => c.url === '/api/teacher/logout');
  assert.equal(out.length, 1); assert.deepEqual(JSON.parse(out[0].o.body), { token: TOKEN });
  assert.equal(P.store['fl.teacher'], undefined);
  assert.ok(P.text().includes('You signed out.'));
  // a tap at 61 minutes: nothing happens at 62
  const Q = page(); await Q.live();
  await Q.advance(61 * 60000); Q.tap(); await Q.advance(2 * 60000);
  assert.equal(Q.calls.filter(c => c.url === '/api/teacher/logout').length, 0);
  assert.ok(!Q.text().includes('Still watching?'));
  Q.fireWin('pagehide');
  assert.equal(Q.beacons.length, 1); assert.equal(Q.beacons[0].url, '/api/teacher/logout'); assert.deepEqual(JSON.parse(Q.beacons[0].body), { token: TOKEN });
  assert.equal(Q.store['fl.teacher'], undefined);
});

test('39. the token lives in sessionStorage and goes only in the Authorization header and the logout body; the socket URL carries only the ticket', async () => {
  const P = page();
  await P.live();
  assert.equal(P.store['fl.teacher'], TOKEN);
  for (const c of P.calls) {
    assert.ok(!c.url.includes(TOKEN), c.url);
    const where = JSON.stringify(c.o.headers || {}) + (c.o.body || '');
    if (where.includes(TOKEN)) assert.ok((c.url === '/api/teacher/ticket' && c.o.headers.authorization === 'Bearer ' + TOKEN) || c.url === '/api/teacher/logout', c.url);
  }
  assert.match(P.ws().url, /^wss:\/\/teacher\.fanglands\.com\/api\/teacher\/ws\?ticket=tk\d+$/);
  assert.ok(P.socks.every(s => !s.url.includes(TOKEN)));
  assert.ok(!JSON.stringify(P.win.location).includes(TOKEN));
});

test('40. "<img src=x onerror=alert(1)>" in a chat line or a name is text', async () => {
  const P = page();
  const bad = '<img src=x onerror=alert(1)>';
  await P.live([row(bad)]);
  P.ws().recv({ t: 'w_chat', at: P.clock.t, n: bad, text: bad, role: 'player', masked: false });
  P.ws().recv({ t: 'w_event', at: P.clock.t, kind: 'teacher', n: bad, text: bad });
  await P.settle();
  assert.equal(innerHTMLWrites, 0);
  assert.ok(P.findAll(/^<img src=x onerror=alert\(1\)>$/).length >= 3);
  assert.ok(!P.els().some(e => e.tagName === 'IMG'));
});

test('41-42. Send off needs two taps and the question goes back after 5 s; the exact words', async () => {
  const P = page();
  await P.live();
  assert.ok(P.find('Who is on (12)')); assert.ok(P.find('Chat is on')); assert.ok(P.find('12 on'));
  P.click(P.findAll(/^LeoThistledown · Fighting · on for 42 min$/)[0]); await P.settle();
  P.click(P.find('Send off for today', 'BUTTON')); await P.settle();
  assert.equal(P.sent('w_off').length, 0);
  assert.ok(P.find("Send Leo off Fanglands until midnight? Leo's knight is safe and saved."));
  await P.advance(5100);
  assert.ok(!P.find("Send Leo off Fanglands until midnight? Leo's knight is safe and saved."));
  P.click(P.find('Send off for today', 'BUTTON')); await P.settle();
  P.click(P.find('Yes, send Leo off', 'BUTTON')); await P.settle();
  assert.deepEqual(P.sent('w_off').map(m => m.n), ['Leo']);
  // the controls' words
  P.click(P.find('Mute 10 min', 'BUTTON')); assert.deepEqual(P.sent('w_mute').map(m => [m.n, m.span]), [['Leo', '10m']]);
  P.ws().recv({ t: 'w_acts', acts: [], sentOff: [], chatPause: { until: P.clock.t + 492000, by: 'Mrs Smith', act: 3 } }); await P.settle();
  assert.ok(P.find('Chat paused · 8:12 left'));
  assert.ok(P.findAll(/^Chat is paused for everyone until \d+:\d\d (am|pm) \(Mrs Smith paused it\)\.$/).length === 1);
  // every close sentence on the card
  const want = { 4010: 'You signed out.', 4011: 'Your sign-in ran out for today. Sign in again to keep watching.', 4012: 'Ethan turned this sign-in off.', 4013: 'Your password was changed. Sign in with the new one.', 4014: 'Too many teacher screens are open. Close one and try again.', 4008: 'That was too many taps at once. Sign in again.' };
  for (const [code, text] of Object.entries(want)) { const R = page(); await R.live(); R.ws().drop(+code); await R.settle(); assert.ok(R.find(text), code); }
  // the sign-in card's own words
  const C = page(); await C.settle();
  for (const t of ['Fanglands — Teacher view', 'For teachers watching Fanglands at school. Kids play at fanglands.com.', 'Your name', 'Password', 'Sign in', "Ethan gives each teacher their own name and password. On a shared computer, press Sign out when you're done."]) assert.ok(C.find(t), t);
  all(C.doc.body).find(e => e.id === 'tname').value = 'Mrs Smith'; all(C.doc.body).find(e => e.id === 'tpass').value = 'wrong-one-here';
  all(C.doc.body).find(e => e.tagName === 'FORM').fire('submit'); await C.settle();
  assert.ok(C.find("That name and password don't match."));
});

const byId = (P, id) => P.els().find(e => e.id === id);
const inside = (e, anc) => { for (let x = e; x; x = x.parentNode) if (x === anc) return true; return false; };

test('under 900 px the answer to a tap shows above the knight\'s sheet (never inside the hidden Who is on), refusals and the Undo toast alike', async () => {
  const P = page({ width: 768 });
  await P.live();
  // Who is on is behind the Chat tab under 900 px: select Ivy from a chat line
  P.ws().recv({ t: 'w_chat', at: P.clock.t, n: 'Ivy', text: 'hi', role: 'player', masked: false }); await P.settle();
  P.click(P.findAll(/^\d+:\d\dIvy: hi$/).pop()); await P.settle();
  assert.equal(P.S.selected, 'Ivy');
  const sheet = byId(P, 'sheet'), toast = byId(P, 'toast'), who = byId(P, 'who');
  assert.equal(sheet.className, 'up');
  P.click(P.find('Mute 10 min', 'BUTTON')); const req = P.sent('w_mute').pop().req;
  P.ws().recv({ t: 'w_no', req, code: 'slow', text: "That's a lot at once. Wait a few minutes, or ask Ethan." }); await P.settle();
  assert.ok(!inside(toast, who), 'the toast is inside Who is on, which is hidden under 900 px');
  assert.equal(toast.nextSibling, sheet); assert.equal(toast.hidden, false);
  assert.equal(toast.textContent, "That's a lot at once. Wait a few minutes, or ask Ethan.");
  // a mute that goes through: the Undo toast, in the same place
  P.click(P.find('Mute 1 hour', 'BUTTON')); const r2 = P.sent('w_mute').pop().req;
  P.ws().recv({ t: 'w_acts', acts: [{ id: 7, at: P.clock.t, teacher: 'Mrs Smith', act: 'mute', target: 'Ivy', until: P.clock.t + 3600000, inForce: true, undoneAt: 0 }], sentOff: [], chatPause: null });
  P.ws().recv({ t: 'w_ok', req: r2, text: 'Ivy is muted for 1 hour.' }); await P.settle();
  assert.equal(toast.hidden, false); assert.ok(!inside(toast, who));
  assert.equal(toast.textContent, 'Ivy is muted for 1 hour.Undo');
  // on a wide screen it goes back to the bottom of Who is on
  P.win.innerWidth = 1280; P.fireWin('resize'); await P.settle();
  assert.ok(inside(toast, who));
});

test('a knight sent off and gone: his bar and sheet say so and offer Let him back in, never a second send-off', async () => {
  for (const width of [1024, 768]) {
    const P = page({ width });
    await P.live();
    const until = P.clock.t + 3600000 * 9;
    P.ws().recv({ t: 'w_k', at: P.clock.t, knights: KNIGHTS.filter(k => k.n !== 'Leo'), inside: [], gone: [{ n: 'Leo', at: P.clock.t }] });
    P.ws().recv({ t: 'w_acts', acts: [{ id: 9, at: P.clock.t, teacher: 'Mrs Smith', act: 'sendoff', target: 'Leo', until, inForce: true, undoneAt: 0 }], sentOff: [{ n: 'Leo', until, by: 'Mrs Smith', act: 9 }], chatPause: null });
    P.ws().recv({ t: 'w_chat', at: P.clock.t, n: 'Leo', text: 'bye', role: 'player', masked: false }); await P.settle();
    P.click(P.findAll(/^\d+:\d\dLeo: bye$/).pop()); await P.settle();
    assert.equal(P.S.selected, 'Leo');
    assert.ok(P.find('Leo is sent off for today.'), width);
    assert.ok(!P.findAll(/^Send off for today$/).some(e => e.tagName === 'BUTTON' && (width < 900 ? inside(e, byId(P, 'sheet')) : true)), 'a second send-off is offered at ' + width);
    const back = P.findAll(/^Let Leo back in$/).find(e => e.tagName === 'BUTTON' && (width < 900 ? inside(e, byId(P, 'sheet')) : !inside(e, byId(P, 'sheet'))));
    assert.ok(back, 'no Let Leo back in at ' + width);
    P.click(back); assert.deepEqual(P.sent('w_undo').map(m => m.act), [9]);
  }
});

test('the word filter\'s lines can be tapped: "The word filter warned Nora." selects Nora; the selected knight\'s lines are marked in the chat', async () => {
  const P = page();
  await P.live(KNIGHTS.concat([row('Nora')]));
  P.ws().recv({ t: 'w_chat', at: P.clock.t, n: 'Nora', text: 'what the ****', role: 'player', masked: true });
  P.ws().recv({ t: 'w_event', at: P.clock.t, kind: 'strike', n: 'Nora', text: 'The word filter warned Nora.' });
  P.ws().recv({ t: 'w_chat', at: P.clock.t, n: 'Ada', text: 'hi', role: 'player', masked: false }); await P.settle();
  const ev = P.findAll(/^\d+:\d\dThe word filter warned Nora\.$/).pop();
  assert.equal(ev.getAttribute('role'), 'button');
  P.click(ev); await P.settle();
  assert.equal(P.S.selected, 'Nora');
  const lines = P.els().filter(e => / ln /.test(' ' + e.className + ' ') || e.className.startsWith('ln '));
  const sel = lines.filter(e => e.classList.contains('sel')).map(e => e.textContent);
  assert.equal(sel.length, 2, JSON.stringify(sel));
  assert.ok(sel.every(t => t.includes('Nora')));
  assert.ok(P.find('Nora') && P.find('10 minutes', 'BUTTON'));
});

test('the pause menu (the bar\'s Pause chat under 1100 px) says admins can still talk', async () => {
  for (const width of [1024, 768, 390]) {
    const P = page({ width });
    await P.live();
    P.click(P.find('Pause chat', 'BUTTON')); await P.settle();
    const menu = byId(P, 'pausemenu');
    assert.equal(menu.hidden, false);
    assert.ok(menu.textContent.includes('Admins can still talk while chat is paused.'), width);
    for (const t of ['5 minutes', '15 minutes', '1 hour', 'Cancel']) assert.ok(P.find(t, 'BUTTON'), t);
  }
});
