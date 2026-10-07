// ============================================================================
// CLOUD SAVE — the knight's save goes to the world at gorkscape.ca
// Online there are no slots: the account is the knight (docs/ONLINE.md). Every save() still writes slot 1 in
// this browser exactly as before (14-title); this file wraps save() after that and, while a knight is playing
// online (LOGIN.playing), sends the very slot string 14-title wrote with PUT /api/save. Pushes are held for 12 s
// so a burst of saves is one call, and flushed at once when the page hides or goes away (NET.call sets keepalive
// on PUT). A failed push is kept for the next save; three failures in a row say so once, then stay quiet.
// Coming back online (the world's welcome) pushes once if the cloud may be behind.
// A save that changes nothing the cloud does not already have is not pushed: 99-boot saves every 15 s whatever the knight is
// doing, and a paused page (only the world clock `time` moves) or a page in the background (nothing moves) used to push every
// one of them, 210 to 240 calls an hour each (measured 4 Oct 2026). Now the same string is never pushed again, and a save that
// differs only in `time` goes up at most every 10 minutes. Leaving the page (hide, pagehide) still pushes anything that differs.
// Feature file: registers through HOOKS and wraps save by reassignment. window.CLOUD is the register.
// ============================================================================
{
  const STALE_PAGE = 'This page is older than the world. Reload.';
  const DEBOUNCE = 12000, TICK = 1.5;   // a 12 s hold: the free plan counts every call, and the page-hide flush covers leaving
  const TIME_ONLY_EVERY = 600000;        // ms: a save that differs from the cloud's only in the world clock goes up this seldom
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
  let pushedAt = -1e15;   // Date.now() of the last good push (TIME_ONLY_EVERY); kept off CLOUD so its data is master's
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
      CLOUD.inflight = false; CLOUD.fails = 0; CLOUD.nagged = false; CLOUD.known = raw; CLOUD.pushes++; CLOUD.savedAt = performance.now(); pushedAt = Date.now();
      if (CLOUD.pending) schedule();
      result = true;
    };
    const bad = e => {
      CLOUD.inflight = false;
      // the world holds this knight from a newer world than this page's (the Great Spread, spec §11: 409 stale_world): this
      // page must not write again, here or to the cloud. SAVE_LOCK holds both (72-savelock), and the plaque says why; its
      // tap reloads, and the new page brings the world's knight in
      if (e && e.status === 409 && e.code === 'stale_world') {
        CLOUD.pending = null; clearTimer(); SAVE_LOCK = true; saveLockSay = STALE_PAGE; notify(STALE_PAGE);
        result = false; return;
      }
      CLOUD.fails++;
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
  CLOUD.reset = () => { clearTimer(); CLOUD.pending = null; CLOUD.inflight = false; CLOUD.fails = 0; CLOUD.nagged = false; CLOUD.known = null; pushedAt = -1e15; };

  // the slot string without its top-level world clock (`time`), so two saves that differ only there compare equal; the
  // cloud's side is kept for the string it was made from (CLOUD.known is also set by 71-login)
  const sansTime = raw => { try { const d = JSON.parse(raw); if (d && typeof d === 'object' && !Array.isArray(d)) { delete d.time; return JSON.stringify(d); } } catch (e) { } return raw; };
  let knownSans = { raw: null, sans: null };
  const cloudSans = () => { if (knownSans.raw !== CLOUD.known) knownSans = { raw: CLOUD.known, sans: CLOUD.known == null ? null : sansTime(CLOUD.known) }; return knownSans.sans; };
  // does this slot string need to go up? Anything already on its way goes on being replaced by the newest string; otherwise
  // the very string the cloud holds never does, and one that differs only in `time` waits TIME_ONLY_EVERY since the last push
  CLOUD.needs = raw => {
    if (CLOUD.pending != null || CLOUD.inflight || CLOUD.known == null) return true;
    if (raw === CLOUD.known) return false;
    if (sansTime(raw) !== cloudSans()) return true;
    return Date.now() - pushedAt >= TIME_ONLY_EVERY;
  };

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
    if (!CLOUD.needs(raw)) return;   // nothing the cloud does not already have (see the top of this file)
    CLOUD.pending = raw; schedule();
  };

  // ---------- flush when the page hides or goes away; push once when the world says welcome ----------
  if (canListen) {
    window.addEventListener('pagehide', () => CLOUD.leaving());
    document.addEventListener('visibilitychange', () => { if (document.hidden) CLOUD.leaving(); });
  }
  // leaving the page (hidden, or gone): whatever differs from what the cloud holds goes up now, the world clock included
  CLOUD.leaving = () => { if (!active()) return; save(); const raw = slotString(); if (raw && raw !== CLOUD.known && CLOUD.pending == null) CLOUD.pending = raw; return CLOUD.flush(); };
  NET.on('welcome', () => { CLOUD.push(false); });

  // ---------- the tick on the HUD ----------
  // 'Saved to the cloud' is a green tick on a drawn cloud, on the crest's banner, for a moment (src/59-hudkit.js reads CLOUD.savedAt)

  // ---------- self-test ----------
  const P = 'cloud: ';
  HOOKS.selfTest.push((check, F, h) => {
    const L = window.LOGIN;
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, status: NET.status, playing: L && L.playing, notice, titleActive: title.active, slot: title.slot };
    const puts = []; let down = false, stale = false;
    const fake = {
      call(method, path, body) { if (method === 'PUT' && path === '/api/save') { if (stale) throw Object.assign(new Error('stale_world'), { status: 409, code: 'stale_world' }); if (down) throw Object.assign(new Error('down'), { status: 0 }); puts.push(body); return { at: 1 }; } return { ok: true }; },
      open: () => { const s = { readyState: 1, send(str) { if (JSON.parse(str).t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'Cohen', at: 1, keeper: 'Cohen' }) }); }, close() { s.readyState = 3; if (s.onclose) s.onclose(); } }; return s; },
    };
    try {
      if (title.active) title.startSlot(title.slot);
      NET.enabled = true; NET.useFake(fake); NET.setToken('tok-test'); if (L) L.playing = true; CLOUD.reset();
      save(); const raw1 = lsGet(title.slotKey(title.slot));
      check(P + 'a save while online books a push and sends nothing yet (4 s hold)', active() && CLOUD.pending === raw1 && CLOUD.timer !== null && puts.length === 0, { pending: !!CLOUD.pending, puts: puts.length });
      CLOUD.flush();
      check(P + 'the flush sends the slot string the title wrote, word for word, and shows the tick', puts.length === 1 && puts[0] === raw1 && CLOUD.pending === null && CLOUD.timer === null && CLOUD.fails === 0 && CLOUD.known === raw1 && performance.now() - CLOUD.savedAt < 1000, { puts: puts.length, same: puts[0] === raw1 });
      // (each save below changes the knight: a save that changes nothing is not pushed at all, see the next checks)
      down = true; notice = null;
      player.kills++; save(); CLOUD.flush(); player.kills++; save(); CLOUD.flush(); const quiet = !notice && CLOUD.fails === 2 && CLOUD.pending === lsGet(title.slotKey(title.slot));
      player.kills++; save(); CLOUD.flush();
      check(P + 'three failed pushes say so once, in plain words, and the save waits on this device', quiet && CLOUD.fails === 3 && CLOUD.nagged && !!notice && notice.text === 'Could not reach the world — your progress is saved on this device for now.' && puts.length === 1, { quiet, fails: CLOUD.fails, notice: notice && notice.text });
      notice = null; player.kills++; save(); CLOUD.flush();
      check(P + 'a fourth failure stays quiet', CLOUD.fails === 4 && notice === null && CLOUD.nagged, { fails: CLOUD.fails });
      down = false; player.kills++; save(); CLOUD.flush();
      check(P + 'the next good push clears the count and the nag', CLOUD.fails === 0 && !CLOUD.nagged && puts.length === 2 && puts[1] === lsGet(title.slotKey(title.slot)), { fails: CLOUD.fails, puts: puts.length });
      // an idle page: 99-boot saves every 15 s. Nothing changed (a page in the background): never pushed. Only the world clock
      // moved (a paused page): pushed at most every 10 minutes. A real change: pushed as before. Leaving: anything that differs.
      { const n0 = puts.length;
        save(); const same = CLOUD.pending === null && CLOUD.timer === null;
        time += 15; save(); time += 15; save(); const clockOnly = CLOUD.pending === null && CLOUD.timer === null;
        pushedAt -= 600000; time += 15; save(); const tenMin = CLOUD.pending !== null; CLOUD.flush();
        const clockUp = puts.length === n0 + 1 && JSON.parse(puts[puts.length - 1]).time === time;
        time += 15; save(); const quietAgain = CLOUD.pending === null;
        player.kills++; save(); const real = CLOUD.pending === lsGet(title.slotKey(title.slot)) && CLOUD.timer !== null; CLOUD.flush();
        time += 15; CLOUD.leaving(); const left = puts.length === n0 + 3 && CLOUD.known === lsGet(title.slotKey(title.slot));
        CLOUD.leaving(); const leftOnce = puts.length === n0 + 3;
        check(P + 'an idle page pushes nothing new: the same save never, a clock-only one every 10 minutes, a real change at once, and leaving pushes what differs once', same && clockOnly && tenMin && clockUp && quietAgain && real && left && leftOnce, { same, clockOnly, tenMin, clockUp, quietAgain, real, left, leftOnce, puts: puts.length - n0 }); }
      // the world's welcome pushes once, only if the cloud may be behind
      NET.connect(); const same = puts.length === 5 && NET.status === 'on';
      NET.disconnect(); player.kills++; _save(); const raw2 = lsGet(title.slotKey(title.slot)); NET.connect();
      check(P + 'coming back online pushes the knight once when the cloud is behind, and not when it is not', same && puts.length === 6 && puts[5] === raw2 && CLOUD.known === raw2, { same, puts: puts.length });
      NET.disconnect();
      if (L) L.playing = false; CLOUD.reset(); save();
      check(P + 'with no knight playing online, a save never touches the cloud', !active() && CLOUD.pending === null && CLOUD.timer === null && puts.length === 6, { pending: CLOUD.pending });
      NET.setToken(null); if (L) L.playing = true; save(); const noToken = CLOUD.pending === null && CLOUD.timer === null;
      check(P + 'without a session there is nothing to push to', noToken, { noToken });
      // the world holds a knight from a newer world (409 stale_world): the page stops writing and says so, once
      NET.setToken('tok-test'); CLOUD.reset(); stale = true; notice = null; player.kills++; save(); CLOUD.flush();
      const before = lsGet(title.slotKey(title.slot)), locked = SAVE_LOCK === true && saveLockSay === STALE_PAGE && CLOUD.pending === null && CLOUD.timer === null && CLOUD.fails === 0;
      const said = !!notice && notice.text === 'This page is older than the world. Reload.';
      player.kills++; save(); const pushedAgain = CLOUD.flush() || CLOUD.push(true) || CLOUD.pending !== null;
      check(P + 'a push the world refuses as stale_world (409) locks the page: nothing more is written here or to the cloud, and it says "This page is older than the world. Reload."',
        locked && said && !pushedAgain && lsGet(title.slotKey(title.slot)) === before && puts.length === 3, { locked, said, pushedAgain, lock: SAVE_LOCK, say: saveLockSay, notice: notice && notice.text, puts: puts.length });
    } finally {
      SAVE_LOCK = false; saveLockSay = NEWER_WORLD;
      CLOUD.reset(); NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.setToken(was.token); NET.status = 'off'; NET.me = null;
      if (L) L.playing = was.playing;
      notice = was.notice;
      if (was.status === 'on' && NET.token) NET.connect();
    }
  });
}
