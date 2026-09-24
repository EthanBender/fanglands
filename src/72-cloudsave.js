// ============================================================================
// CLOUD SAVE — the knight's save goes to the world at gorkscape.ca
// Online there are no slots: the account is the knight (docs/ONLINE.md). Every save() still writes slot 1 in
// this browser exactly as before (14-title); this file wraps save() after that and, while a knight is playing
// online (LOGIN.playing), sends the very slot string 14-title wrote with PUT /api/save. Pushes are held for 12 s
// so a burst of saves is one call, and flushed at once when the page hides or goes away (NET.call sets keepalive
// on PUT). A failed push is kept for the next save; three failures in a row say so once, then stay quiet.
// Coming back online (the world's welcome) pushes once if the cloud may be behind.
// Feature file: registers through HOOKS and wraps save by reassignment. window.CLOUD is the register.
// ============================================================================
{
  const DEBOUNCE = 12000, TICK = 1.5;   // a 12 s hold: the free plan counts every call, and the page-hide flush covers leaving
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { } };
  const canListen = typeof document !== 'undefined' && typeof document.addEventListener === 'function' && typeof window.addEventListener === 'function';

  const CLOUD = {
    pending: null,   // the slot string waiting to go up
    timer: null,     // the 4 s hold
    inflight: false, // a PUT is out
    fails: 0,        // failures in a row
    nagged: false,   // the one "could not reach the world" line has been shown for this outage
    known: null,     // the last string the cloud is known to hold (pushed, or pulled at login)
    savedAt: -1e9,   // performance.now() of the last good push, for the tick on the HUD
    pushes: 0,
  };
  window.CLOUD = CLOUD;
  const active = () => NET.enabled && !!NET.token && !!(window.LOGIN && window.LOGIN.playing);
  CLOUD.active = active;
  const slotString = () => (typeof title === 'undefined' || title.active) ? null : lsGet(title.slotKey(title.slot));

  // ---------- calls, the same way 71-login does it: a fake may answer on the spot ----------
  const api = (method, path, body) => {
    try { return NET.fake ? NET.fake.call(method, path, body, NET.token) : NET.call(method, path, body); }
    catch (e) { return { __threw: e || new Error('failed') }; }
  };
  const when = (v, ok, bad) => {
    if (v && typeof v.then === 'function') { v.then(ok, bad).catch(e => console.error('cloud', e)); return; }
    if (v && v.__threw) bad(v.__threw); else ok(v);
  };

  const clearTimer = () => { if (CLOUD.timer) { clearTimeout(CLOUD.timer); CLOUD.timer = null; } };
  const schedule = () => { if (CLOUD.timer) return; CLOUD.timer = setTimeout(() => { CLOUD.timer = null; CLOUD.flush(); }, DEBOUNCE); };
  // sends what is pending now; answers with whatever the call gives (a value with a fake, a promise on the wire)
  CLOUD.flush = () => {
    clearTimer();
    if (!CLOUD.pending || CLOUD.inflight || !active()) return false;
    const raw = CLOUD.pending; CLOUD.pending = null; CLOUD.inflight = true;
    let result = null;
    const ok = () => {
      CLOUD.inflight = false; CLOUD.fails = 0; CLOUD.nagged = false; CLOUD.known = raw; CLOUD.pushes++; CLOUD.savedAt = performance.now();
      if (CLOUD.pending) schedule();
      result = true;
    };
    const bad = () => {
      CLOUD.inflight = false; CLOUD.fails++;
      if (!CLOUD.pending) CLOUD.pending = raw;
      if (CLOUD.fails >= 3 && !CLOUD.nagged) { CLOUD.nagged = true; notify('Could not reach the world — your progress is saved on this device for now.'); }
      result = false;
    };
    const r = api('PUT', '/api/save', raw);
    if (r && typeof r.then === 'function') return r.then(ok, bad).then(() => result);
    when(r, ok, bad);
    return result;
  };
  // push the slot as it stands now; without force, only when the cloud may not have it
  CLOUD.push = force => {
    if (!active()) return false;
    const raw = slotString(); if (!raw || (!force && raw === CLOUD.known)) return false;
    CLOUD.pending = raw; return CLOUD.flush();
  };
  CLOUD.reset = () => { clearTimer(); CLOUD.pending = null; CLOUD.inflight = false; CLOUD.fails = 0; CLOUD.nagged = false; CLOUD.known = null; };

  // ---------- save, wrapped after 14-title's wrapper (and 63-house's), so the slot string it wrote is what goes up ----------
  const _save = save;
  save = function () {
    _save();
    if (typeof title === 'undefined' || title.active) return;
    if (!active()) {
      // a local save landing in slot 1 makes it a local slot again (71-login parks it before a cloud knight takes over)
      if (title.slot === 1 && window.LOGIN && lsGet(window.LOGIN.MARK_KEY) != null) lsDel(window.LOGIN.MARK_KEY);
      return;
    }
    const raw = slotString(); if (raw == null) return;
    CLOUD.pending = raw; schedule();
  };

  // ---------- flush when the page hides or goes away; push once when the world says welcome ----------
  if (canListen) {
    const now = () => { if (!active()) return; save(); CLOUD.flush(); };
    window.addEventListener('pagehide', now);
    document.addEventListener('visibilitychange', () => { if (document.hidden) now(); });
  }
  NET.on('welcome', () => { CLOUD.push(false); });

  // ---------- the tick on the HUD, beside 14-title's 'Saved' flash ----------
  HOOKS.hud.push(g => {
    const el = (performance.now() - CLOUD.savedAt) / 1000;
    if (el < 0 || el >= TICK) return;
    const a = el < 0.2 ? el / 0.2 : 1 - (el - 0.2) / (TICK - 0.2);
    g.globalAlpha = clamp(a, 0, 1);
    g.textAlign = 'right'; g.font = 'bold 11px sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.fillStyle = '#8b949e';
    const x = VW - 16, y = VH - 52;
    g.strokeText('Saved to the cloud', x, y); g.fillText('Saved to the cloud', x, y);
    const w = g.measureText('Saved to the cloud').width;
    g.strokeStyle = '#3fb950'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - w - 16, y - 5); g.lineTo(x - w - 12, y - 1); g.lineTo(x - w - 5, y - 10); g.stroke();
    g.globalAlpha = 1;
  });

  // ---------- self-test ----------
  const P = 'cloud: ';
  HOOKS.selfTest.push((check, F, h) => {
    const L = window.LOGIN;
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, status: NET.status, playing: L && L.playing, alone: L && L.alone, notice, titleActive: title.active, slot: title.slot };
    const puts = []; let down = false;
    const fake = {
      call(method, path, body) { if (method === 'PUT' && path === '/api/save') { if (down) throw Object.assign(new Error('down'), { status: 0 }); puts.push(body); return { at: 1 }; } return { ok: true }; },
      open: () => { const s = { readyState: 1, send(str) { if (JSON.parse(str).t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'Cohen', at: 1, keeper: 'Cohen' }) }); }, close() { s.readyState = 3; if (s.onclose) s.onclose(); } }; return s; },
    };
    try {
      if (title.active) title.startSlot(title.slot);
      NET.enabled = true; NET.useFake(fake); NET.setToken('tok-test'); if (L) { L.playing = true; L.alone = false; } CLOUD.reset();
      save(); const raw1 = lsGet(title.slotKey(title.slot));
      check(P + 'a save while online books a push and sends nothing yet (4 s hold)', active() && CLOUD.pending === raw1 && CLOUD.timer !== null && puts.length === 0, { pending: !!CLOUD.pending, puts: puts.length });
      CLOUD.flush();
      check(P + 'the flush sends the slot string the title wrote, word for word, and shows the tick', puts.length === 1 && puts[0] === raw1 && CLOUD.pending === null && CLOUD.timer === null && CLOUD.fails === 0 && CLOUD.known === raw1 && performance.now() - CLOUD.savedAt < 1000, { puts: puts.length, same: puts[0] === raw1 });
      down = true; notice = null;
      save(); CLOUD.flush(); save(); CLOUD.flush(); const quiet = !notice && CLOUD.fails === 2 && CLOUD.pending === lsGet(title.slotKey(title.slot));
      save(); CLOUD.flush();
      check(P + 'three failed pushes say so once, in plain words, and the save waits on this device', quiet && CLOUD.fails === 3 && CLOUD.nagged && !!notice && notice.text === 'Could not reach the world — your progress is saved on this device for now.' && puts.length === 1, { quiet, fails: CLOUD.fails, notice: notice && notice.text });
      notice = null; save(); CLOUD.flush();
      check(P + 'a fourth failure stays quiet', CLOUD.fails === 4 && notice === null && CLOUD.nagged, { fails: CLOUD.fails });
      down = false; player.kills++; save(); CLOUD.flush();
      check(P + 'the next good push clears the count and the nag', CLOUD.fails === 0 && !CLOUD.nagged && puts.length === 2 && puts[1] === lsGet(title.slotKey(title.slot)), { fails: CLOUD.fails, puts: puts.length });
      // the world's welcome pushes once, only if the cloud may be behind
      NET.connect(); const same = puts.length === 2 && NET.status === 'on';
      NET.disconnect(); player.kills++; _save(); const raw2 = lsGet(title.slotKey(title.slot)); NET.connect();
      check(P + 'coming back online pushes the knight once when the cloud is behind, and not when it is not', same && puts.length === 3 && puts[2] === raw2 && CLOUD.known === raw2, { same, puts: puts.length });
      NET.disconnect();
      if (L) L.playing = false; CLOUD.reset(); save();
      check(P + 'playing alone never touches the cloud', !active() && CLOUD.pending === null && CLOUD.timer === null && puts.length === 3, { pending: CLOUD.pending });
      NET.setToken(null); if (L) L.playing = true; save(); const noToken = CLOUD.pending === null && CLOUD.timer === null;
      check(P + 'without a session there is nothing to push to', noToken, { noToken });
    } finally {
      CLOUD.reset(); NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.setToken(was.token); NET.status = 'off'; NET.me = null;
      if (L) { L.playing = was.playing; L.alone = was.alone; }
      notice = was.notice;
      if (was.status === 'on' && NET.token) NET.connect();
    }
  });
}
