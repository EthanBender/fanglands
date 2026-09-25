// ============================================================================
// THE WIRE — how the game talks to the world server at gorkscape.ca
// Owner: "make it an online MMORPG so Cohen and his friends can log in and play together."
// This file is the whole network layer the online files build on: whether we are online at all, the session
// token, JSON calls to /api, and one WebSocket to the world that reconnects by itself. It knows nothing about
// knights, monsters or chat — those are 71–75. docs/ONLINE.md is the contract every side keeps to.
// Feature file: registers through HOOKS only. window.NET is the register.
// ============================================================================
{
  const HOSTS = ['gorkscape.ca', 'www.gorkscape.ca', 'test.gorkscape.ca'];   // test.gorkscape.ca: the owner's separate test world
  const host = (typeof location !== 'undefined' && location.hostname) || '';
  const search = (typeof location !== 'undefined' && location.search) || '';
  // online on the real address, on any address with ?online, or when a test says so before this file runs
  const enabled = HOSTS.includes(host) || /[?&]online\b/.test(search) || window.__online === true;
  const TOKEN_KEY = 'fanglands.session';
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, String(v)); } catch (e) { } };

  const NET = {
    enabled, base: window.__onlineBase || '',
    status: 'off',            // off | connecting | on
    me: null,                 // the knight's name once the world says welcome
    token: lsGet(TOKEN_KEY),
    sock: null, tries: 0, lastError: null, stats: { sent: 0, got: 0, opens: 0 },
    listeners: {}, fake: null, timer: null, closedByUs: false,
  };

  // ---------- events: NET.on('chat', msg => ...) ; '*' hears everything ----------
  NET.on = (t, fn) => { (NET.listeners[t] = NET.listeners[t] || []).push(fn); return fn; };
  NET.off = (t, fn) => { const l = NET.listeners[t]; if (!l) return; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); };
  NET.emit = (t, msg) => {
    for (const fn of (NET.listeners[t] || []).slice()) { try { fn(msg); } catch (e) { console.error('NET ' + t, e); } }
    for (const fn of (NET.listeners['*'] || []).slice()) { try { fn(msg); } catch (e) { console.error('NET *', e); } }
  };
  NET.setToken = tok => { NET.token = tok || null; lsSet(TOKEN_KEY, tok || null); };

  // ---------- HTTP: every /api call goes through here, so the token is never forgotten ----------
  NET.call = async (method, path, body) => {
    if (NET.fake) return NET.fake.call(method, path, body, NET.token);
    const headers = { 'content-type': 'application/json' };
    if (NET.token) headers.authorization = 'Bearer ' + NET.token;
    const r = await fetch(NET.base + path, { method, headers, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)), keepalive: method === 'PUT' });
    let data = null; try { data = await r.json(); } catch (e) { }
    if (!r.ok) { const err = new Error((data && data.error) || ('HTTP ' + r.status)); err.status = r.status; err.code = data && data.code; throw err; }
    return data;
  };
  NET.get = path => NET.call('GET', path);
  NET.post = (path, body) => NET.call('POST', path, body);
  NET.put = (path, body) => NET.call('PUT', path, body);

  // ---------- the socket ----------
  const wsUrl = () => {
    if (NET.base) return NET.base.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(NET.token);
    const proto = (typeof location !== 'undefined' && location.protocol === 'http:') ? 'ws://' : 'wss://';
    // location.host keeps the port (localhost:8790 in a local run); hostname would drop it and the socket would never open
    return proto + location.host + '/ws?token=' + encodeURIComponent(NET.token);
  };
  function wire(sock) {
    sock.onopen = () => { NET.stats.opens++; NET.tries = 0; NET.send({ t: 'hello', v: 1 }, true); };
    sock.onmessage = ev => {
      let msg = null; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (!msg || typeof msg.t !== 'string') return;
      NET.stats.got++;
      if (msg.t === 'welcome') { NET.status = 'on'; NET.me = msg.me; }
      if (msg.t === 'error' && msg.code === 'auth') { NET.setToken(null); NET.closedByUs = true; }
      // the same knight opened somewhere else: that socket wins, this one must not fight it by reconnecting
      if (msg.t === 'error' && msg.code === 'elsewhere') NET.closedByUs = true;
      NET.emit(msg.t, msg);
    };
    sock.onclose = ev => { if (NET.sock !== sock) return; if (ev && ev.code === 4000) NET.closedByUs = true; NET.sock = null; const was = NET.status; NET.status = 'off'; if (was === 'on') NET.emit('offline', { t: 'offline' }); if (!NET.closedByUs) scheduleReconnect(); };
    sock.onerror = e => { NET.lastError = e; };
  }
  function scheduleReconnect() {
    if (NET.timer || !NET.enabled || !NET.token) return;
    const wait = Math.min(15000, 1000 * Math.pow(2, NET.tries++));
    NET.timer = setTimeout(() => { NET.timer = null; NET.connect(); }, wait);
  }
  NET.connect = () => {
    if (!NET.enabled || !NET.token || NET.sock) return false;
    NET.closedByUs = false; NET.status = 'connecting';
    try {
      const sock = NET.fake ? NET.fake.open(NET.token) : new WebSocket(wsUrl());
      NET.sock = sock; wire(sock);
      if (NET.fake && sock.onopen && sock.readyState === 1) sock.onopen();
    } catch (e) { NET.lastError = e; NET.status = 'off'; NET.sock = null; scheduleReconnect(); return false; }
    return true;
  };
  NET.disconnect = () => { NET.closedByUs = true; if (NET.timer) { if (typeof clearTimeout === 'function') clearTimeout(NET.timer); NET.timer = null; } const s = NET.sock; NET.sock = null; NET.status = 'off'; NET.me = null; if (s) { try { s.close(); } catch (e) { } } };
  NET.send = (msg, evenWhileConnecting) => {
    if (!NET.sock || (NET.status !== 'on' && !evenWhileConnecting)) return false;
    try { NET.sock.send(JSON.stringify(msg)); NET.stats.sent++; return true; } catch (e) { NET.lastError = e; return false; }
  };
  // a fake transport for tests: { call(method, path, body, token), open(token) -> socket-like {send, close, readyState, onopen, onmessage, onclose} }
  NET.useFake = fake => { NET.disconnect(); NET.fake = fake; };
  NET.online = () => NET.enabled && NET.status === 'on';
  // the browser drops sockets when a tab sleeps; wake up and come back
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', () => { if (!document.hidden && NET.enabled && NET.token && !NET.sock) NET.connect(); });

  window.NET = NET;

  const P = 'net: ';
  HOOKS.selfTest.push((check) => {
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake };
    // an in-memory world: answers hello with welcome, echoes chat back with a name on it
    const made = [];
    const fake = {
      call: async (method, path, body) => ({ method, path, body }),
      open: () => { const s = { readyState: 1, sent: [], send(str) { s.sent.push(str); const m = JSON.parse(str); if (m.t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'Cohen' }) }); if (m.t === 'chat') s.onmessage({ data: JSON.stringify({ t: 'chat', n: 'Cohen', text: m.text }) }); }, close() { s.readyState = 3; if (s.onclose) s.onclose(); } }; made.push(s); return s; },
    };
    NET.enabled = true; NET.token = 'test-token'; NET.useFake(fake);
    const heard = [];
    const fn = NET.on('chat', m => heard.push(m.text));
    const opened = NET.connect();
    check(P + 'with a token the wire opens one socket, says hello, and the welcome makes it online with a name', opened && made.length === 1 && NET.status === 'on' && NET.me === 'Cohen', { opened, sockets: made.length, status: NET.status, me: NET.me });
    const sentOk = NET.send({ t: 'chat', text: 'hi' });
    check(P + 'a message goes out as JSON and the answer reaches whoever listens for its type', sentOk && heard.length === 1 && heard[0] === 'hi' && NET.stats.got >= 2, { sentOk, heard, got: NET.stats.got });
    NET.off('chat', fn); NET.send({ t: 'chat', text: 'again' });
    check(P + 'a listener taken off hears nothing more', heard.length === 1, { heard });
    let calledPath = null; NET.get('/api/me').then(r => { calledPath = r.path; });
    made[0].close();
    check(P + 'a dropped socket leaves the wire offline and books a reconnect instead of giving up', NET.status === 'off' && NET.sock === null && NET.timer !== null, { status: NET.status, timer: !!NET.timer });
    NET.disconnect();
    check(P + 'without a token the wire will not open a socket at all', (NET.token = null, !NET.connect()) && NET.sock === null, { sock: !!NET.sock });
    NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null; NET.listeners.chat = (NET.listeners.chat || []).filter(f => f !== fn);
  });
}
