// ============================================================================
// THE WIRE — how the game talks to the world server at gorkscape.ca
// Owner: "make it an online MMORPG so Cohen and his friends can log in and play together."
// This file is the whole network layer the online files build on: whether we are online at all, the session
// token, JSON calls to /api, and one WebSocket to the world that reconnects by itself. It knows nothing about
// knights, monsters or chat — those are 71–75. docs/ONLINE.md is the contract every side keeps to.
// Feature file: registers through HOOKS only. window.NET is the register.
// ============================================================================
{
  const HOSTS = ['gorkscape.ca', 'www.gorkscape.ca'];
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
    role: 'player',           // 'player' | 'admin': only ever the world's word (welcome, role); 'player' again when the socket closes
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
      // the role is the world's word, set before anyone hears the message; a missing one (an older server, the FakeWorld) is 'player'
      if (msg.t === 'welcome' || msg.t === 'role') NET.role = msg.role === 'admin' ? 'admin' : 'player';
      if (msg.t === 'error' && msg.code === 'auth') { NET.setToken(null); NET.closedByUs = true; }
      // the same knight opened somewhere else: that socket wins, this one must not fight it by reconnecting
      if (msg.t === 'error' && msg.code === 'elsewhere') NET.closedByUs = true;
      // an admin sent this knight out (kicked) or banned it: the wire must not fight that by reconnecting; a ban also ends the session
      if (msg.t === 'error' && (msg.code === 'kicked' || msg.code === 'banned')) { NET.closedByUs = true; if (msg.code === 'banned') NET.setToken(null); }
      NET.emit(msg.t, msg);
    };
    // close codes the world uses on purpose: 4000 elsewhere, 4003 banned, 4005 kicked. None of them is a dropped line, so none reconnects.
    sock.onclose = ev => {
      if (NET.sock !== sock) return;
      if (ev && (ev.code === 4000 || ev.code === 4003 || ev.code === 4005)) NET.closedByUs = true;
      NET.sock = null; NET.role = 'player'; const was = NET.status; NET.status = 'off';
      if (was === 'on') NET.emit('offline', { t: 'offline' });
      if (!NET.closedByUs) scheduleReconnect();
    };
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
  NET.disconnect = () => { NET.closedByUs = true; if (NET.timer) { if (typeof clearTimeout === 'function') clearTimeout(NET.timer); NET.timer = null; } const s = NET.sock; NET.sock = null; NET.status = 'off'; NET.me = null; NET.role = 'player'; if (s) { try { s.close(); } catch (e) { } } };
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
    // roles and the ways the world ends a session (docs/ONLINE.md, "Admins and drop parties")
    {
      const socks = []; let hello = { t: 'welcome', me: 'MudGoll', role: 'admin' };
      const fake2 = { call: async () => ({}), open: () => { const s = { readyState: 1, send(str) { if (JSON.parse(str).t === 'hello') s.onmessage({ data: JSON.stringify(hello) }); }, close() { s.readyState = 3; } }; socks.push(s); return s; } };
      const feed = m => socks[socks.length - 1].onmessage({ data: JSON.stringify(m) });
      const drop = code => socks[socks.length - 1].onclose(code === undefined ? undefined : { code });
      NET.enabled = true; NET.useFake(fake2);
      const before = NET.role;
      NET.token = 'role-test'; NET.connect(); const admin = NET.role === 'admin';
      feed({ t: 'role', role: 'player' }); const demoted = NET.role === 'player';
      feed({ t: 'role', role: 'admin' }); const promoted = NET.role === 'admin';
      feed({ t: 'role', role: 'boss' }); const junk = NET.role === 'player';
      feed({ t: 'role', role: 'admin' }); drop(1006); const plainDrop = NET.role === 'player' && NET.status === 'off' && NET.timer !== null;
      NET.disconnect(); hello = { t: 'welcome', me: 'Cohen' }; NET.token = 'role-test'; NET.connect(); const missing = NET.status === 'on' && NET.role === 'player';
      check(P + "the role is the world's word: welcome and role set it, anything but 'admin' (or nothing, as an older server sends) is 'player', and a closed socket is 'player' again", before === 'player' && admin && demoted && promoted && junk && plainDrop && missing, { before, admin, demoted, promoted, junk, plainDrop, missing });
      const ends = {};
      for (const code of [4005, 4003, 4000, 4008]) { NET.disconnect(); NET.token = 'role-test'; NET.connect(); drop(code); ends[code] = NET.timer === null ? 'stays' : 'reconnects'; }
      NET.disconnect(); NET.token = 'role-test'; NET.connect(); feed({ t: 'error', code: 'kicked' }); drop(); const kicked = NET.timer === null && NET.token === 'role-test';
      NET.disconnect(); NET.token = 'role-test'; NET.connect(); feed({ t: 'error', code: 'banned' }); drop(); const banned = NET.timer === null && NET.token === null;
      NET.disconnect();
      check(P + 'closed 4005 (kicked), 4003 (banned) or 4000 (elsewhere) the wire books no reconnect, 4008 (too fast) still does; an error kicked keeps the session, banned drops it', ends[4005] === 'stays' && ends[4003] === 'stays' && ends[4000] === 'stays' && ends[4008] === 'reconnects' && kicked && banned, { ends, kicked, banned });
    }
    NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null; NET.role = 'player'; NET.listeners.chat = (NET.listeners.chat || []).filter(f => f !== fn);
  });
}
