// ============================================================================
// HAND-OVER, THE GAME'S SIDE — two addresses (docs/ONLINE.md, "Two addresses")
// Owner (2026-10-03): "port everything over to the new proper domain but have gorkscape redirect to fang lands so
// anyone with the old domain doesnt notice the diffrance for now".
// gorkscape.ca sends each browser to fanglands.com before the game loads, on small pages the world serves
// (online/src/handoff.js): with a login, the login and the settings go across (online/src/handoff-merge.js); every
// knight lives on the server and loads at login. This file is what the game does about it:
//   - the boot note: what the game writes by itself while loading (default settings and so on) is noted in
//     fanglands.handoff.boot, so a hand-over can tell "never changed here" from "the kid's own" (handoff-merge.js)
//   - the arriving card: page.html shows "Bringing your knight over..." while the game page loads after a hand-over
//     (sessionStorage fanglands.handoff.arriving, set by the landing page); it goes as soon as the game runs
//   - on the old address, opened from an iPad home-screen icon (an installed web app, cookie fl_stay), the game is
//     served right there, full screen, as before, with a calm one-time note about the new home
//   - on the old address in an ordinary tab that holds a knight the server does not have (the hand-over page sent it to
//     /handoff-here, cookie fl_here, for this one load), the game is served right there with a calm one-time note: log
//     in and bring that knight into an account first (src/72-deviceknights.js does that). The cookie is cleared at
//     once, so the next visit asks again, and is sent across once nothing is left only on this device.
//   - an ordinary tab that somehow holds fl_stay (a shared cookie jar on some computers) is sent on by page.html's own
//     script before the game is even read (window.FL_LEAVING); this file stops the game's boot then
// Feature file: runs once at load; window.HANDOFF is the register; HOOKS.selfTest checks the rules.
// ============================================================================
{
  const BOOT_KEY = 'fanglands.handoff.boot';       // the values the game wrote by itself at boot, unchanged since
  const NOTED_KEY = 'fanglands.handoff.noted';     // the one-time note on the old address's home-screen icon was shown
  const TAB_NOTED_KEY = 'fanglands.handoff.tabnoted';   // the one-time note in an ordinary tab on the old address
  const ARRIVING_KEY = 'fanglands.handoff.arriving';
  const OLD_HOSTS = ['gorkscape.ca', 'www.gorkscape.ca', 'test.gorkscape.ca'];
  // the one-time note on the old address's home-screen icon. A new icon keeps its own storage (WebKit): it starts
  // logged out and without the knights saved here, so the note never says this icon can go, and says "saved in the
  // cloud" only when that is true of everything here
  const NEW_ICON = 'A new icon starts logged out: log in with your knight\'s name and secret word.';
  const NOTE_CLOUD = 'Fanglands has a new home: fanglands.com. Your knight is saved in the cloud. ' + NEW_ICON;
  const NOTE_DEVICE = 'Fanglands has a new home: fanglands.com. Keep this icon: knights saved on this device live here. ' + NEW_ICON;
  // the one-time note in an ordinary tab kept on the old address for a knight saved only on this device
  const NOTE_TAB = 'Fanglands has a new home: fanglands.com. Log in and bring your knight into your account first.';
  const TOKEN = 'fanglands.session', NAME = 'fanglands.lastname';
  // what a hand-over carries besides the login: the settings and the hint counters (handoff-merge.js, CARRY and HINT_RE;
  // a test holds them together)
  const SETTINGS_KEYS = ['fanglands.settings', 'fanglands.muted', 'fanglands.music', 'fanglands.kidmode'];
  const HINT_RE = /^fl_(learn|coach)_[A-Za-z0-9_]{1,40}$/;
  const parse = (raw, dflt) => { try { const v = JSON.parse(raw || 'null'); return v && typeof v === 'object' && !Array.isArray(v) ? v : dflt; } catch (e) { return dflt; } };
  const isOther = k => SETTINGS_KEYS.includes(k) || HINT_RE.test(k);
  // how many knights here are NOT on the server: word for word online/src/handoff-merge.js KNIGHTS_SOURCE, which the
  // hand-over page runs (a test holds them together); its comment there says the rule
  const deviceKnights = function deviceKnights(get, keys, acct) {
  var SLOT_RE = /^fanglands\.slot\.(\d+)$/, S = function (n) { return 'fanglands.slot.' + n; };
  var fp = function (s) { s = String(s); var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36) + '.' + s.length; };
  var play = function (raw) { try { var d = JSON.parse(raw); return d && typeof d === 'object' && d.player && typeof d.player === 'object' ? (+d.player.playSeconds || 0) : -1; } catch (e) { return -1; } };
  var mine = function (own) { return typeof own === 'string' && own !== '' && (acct === '*' || own === acct); };
  var kept = []; try { kept = JSON.parse(get('fanglands.dk.kept') || '[]'); } catch (e) { } if (!Array.isArray(kept)) kept = [];
  var slots = [], cloud = [], i, j, m, raw, own;
  for (i = 0; i < keys.length; i++) { m = SLOT_RE.exec(keys[i]); if (m) slots.push(m[1]); }
  for (i = 0; i < slots.length; i++) {
    raw = get(S(slots[i])); own = get(S(slots[i]) + '.online');
    if (raw && play(raw) >= 0 && mine(own) && get(S(slots[i]) + '.synced') === own + '|' + fp(raw)) cloud.push({ raw: raw, own: own, play: play(raw), at: +get(S(slots[i]) + '.at') || 0 });
  }
  var covered = function (raw, own, at) {
    var p = play(raw);
    for (j = 0; j < cloud.length; j++) if (cloud[j].raw === raw) return true;
    if (!mine(own)) return false;
    if (kept.indexOf(own + '|' + fp(raw)) >= 0) return true;
    for (j = 0; j < cloud.length; j++) if (cloud[j].own === own && !(p > cloud[j].play || (p >= cloud[j].play && at > cloud[j].at))) return true;
    return false;
  };
  var n = 0;
  for (i = 0; i < slots.length; i++) {
    raw = get(S(slots[i])); if (!raw || play(raw) < 0) continue;
    if (!covered(raw, get(S(slots[i]) + '.online'), +get(S(slots[i]) + '.at') || 0)) n++;
  }
  raw = get('fanglands.save.v2');
  if (raw && play(raw) >= 0 && get(S(1)) == null && get('fanglands.slot.current') == null && !covered(raw, null, 0)) n++;
  return n;
};

  // What the game writes by itself at boot (43-settings saves its defaults, and so on), so a hand-over can tell "never
  // changed here" from "the kid's own". bootBefore runs as this file loads, before any other file; bootAfter right after
  // the whole game has loaded. A key the boot wrote, or one that was here and still had what the last boot wrote, is
  // noted with its value now; a key that was here with anything else is the kid's own and is left out for good.
  function bootBefore(ls) {
    const snap = parse(ls.get(BOOT_KEY), null), before = {};
    for (const k of ls.keys()) if (isOther(k)) before[k] = ls.get(k);
    return { snap, before };
  }
  function bootAfter(ls, st) {
    const next = {};
    for (const k of ls.keys()) {
      if (!isOther(k)) continue;
      const v = ls.get(k);
      if (typeof v !== 'string' || v.length > 4096) continue;
      if (!(k in st.before) || (st.snap && st.snap[k] === st.before[k])) next[k] = v;
    }
    ls.set(BOOT_KEY, JSON.stringify(next));
    return next;
  }

  // Which note to show on this address: 'note' (a home-screen icon on the old address, fl_stay), 'tab' (an ordinary tab
  // the hand-over page kept on the old address, fl_here), each once, or null.
  const hasCookie = (cookie, name) => String(cookie || '').split(';').some(c => c.trim() === name + '=1');
  function plan({ host, standalone, cookie, noted, tabNoted }) {
    if (!OLD_HOSTS.includes(host)) return null;
    if (standalone && hasCookie(cookie, 'fl_stay')) return noted ? null : 'note';
    if (!standalone && hasCookie(cookie, 'fl_here')) return tabNoted ? null : 'tab';
    return null;
  }
  // the icon note's words: the cloud one only when logged in, a cloud copy of that account is here, and no knight here
  // is only on this device (the account is the last name typed, as 71-login notes slot owners)
  function noteFor(ls) {
    const tok = ls.get(TOKEN), acct = String(ls.get(NAME) || '').toLowerCase();
    if (!tok || !acct) return NOTE_DEVICE;
    const keys = ls.keys(), fp = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36) + '.' + s.length; };
    const cloud = keys.some(k => { const m = /^fanglands\.slot\.(\d+)$/.exec(k); if (!m) return false; const raw = ls.get(k); return !!raw && ls.get(k + '.online') === acct && ls.get(k + '.synced') === acct + '|' + fp(raw); });
    return cloud && deviceKnights(ls.get, keys, acct) === 0 ? NOTE_CLOUD : NOTE_DEVICE;
  }
  const isStandalone = () => {
    try { return (typeof navigator !== 'undefined' && navigator.standalone === true) || !!(typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches); } catch (e) { return false; }
  };

  const LS = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { } },
    del: k => { try { localStorage.removeItem(k); } catch (e) { } },
    keys: () => { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k != null) out.push(k); } } catch (e) { } return out; },
  };
  const HANDOFF = { bootBefore, bootAfter, plan, noteFor, isOther, deviceKnights, NOTE_CLOUD, NOTE_DEVICE, NOTE_TAB, BOOT_KEY, NOTED_KEY, TAB_NOTED_KEY, ARRIVING_KEY, noteShown: false };
  window.HANDOFF = HANDOFF;

  const inBrowser = typeof location !== 'undefined' && location && typeof location.hostname === 'string' && typeof document !== 'undefined';
  // page.html is already sending this tab on (an ordinary tab with the icon's cookie): nothing of the game runs
  if (inBrowser && window.FL_LEAVING === true) throw new Error('Fanglands is moving this tab to its new home. One moment.');
  const host = inBrowser ? location.hostname.toLowerCase() : '';
  // a hand-over fragment never stays on the game's address (the landing page takes it off; this is for anything older)
  if (inBrowser && typeof location.hash === 'string' && location.hash.startsWith('#handoff')) {
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { }
  }
  const cookieNow = (() => { try { return inBrowser ? document.cookie : ''; } catch (e) { return ''; } })();
  const todo = inBrowser ? plan({ host, standalone: isStandalone(), cookie: cookieNow, noted: LS.get(NOTED_KEY) != null, tabNoted: LS.get(TAB_NOTED_KEY) != null }) : null;
  // fl_here was for this one load: gone at once, so a reload or the next visit asks the hand-over page again
  if (inBrowser && hasCookie(cookieNow, 'fl_here')) { try { document.cookie = 'fl_here=; Max-Age=0; Path=/; Secure; SameSite=Lax'; } catch (e) { } }

  // the arriving card goes as soon as the game runs (its first frame is a moment later)
  const dropCard = () => { try { const e = document.getElementById('fl-arrive'); if (e) e.remove(); } catch (e) { } };
  if (inBrowser) { try { sessionStorage.removeItem(ARRIVING_KEY); } catch (e) { } }

  // an ordinary boot: what the game writes by itself while loading is noted
  { const st = bootBefore(LS); if (typeof setTimeout === 'function') setTimeout(() => { bootAfter(LS, st); if (inBrowser) dropCard(); }, 0); }

  // a one-time note: a small dark card over the title, gone with OK
  function showNote(kind) {
    if (HANDOFF.noteShown || typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function') return false;
    HANDOFF.noteShown = true;
    LS.set(kind === 'tab' ? TAB_NOTED_KEY : NOTED_KEY, String(Date.now()));
    const wrap = document.createElement('div');
    wrap.id = 'fl-newhome';
    wrap.setAttribute('role', 'dialog');
    wrap.style.cssText = 'position:fixed;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,8,12,0.55);z-index:60';
    const box = document.createElement('div');
    box.style.cssText = 'max-width:340px;background:#141a22;border:1px solid #2a3340;border-radius:12px;padding:18px 22px;text-align:center;color:#c9d1d9;font:16px "Trebuchet MS","Segoe UI",system-ui,sans-serif;line-height:1.4;box-shadow:0 8px 30px rgba(0,0,0,0.5)';
    const p = document.createElement('p'); p.style.margin = '0 0 14px'; p.textContent = kind === 'tab' ? NOTE_TAB : noteFor(LS);
    const ok = document.createElement('button'); ok.type = 'button'; ok.textContent = 'OK';
    ok.style.cssText = 'min-width:96px;min-height:44px;padding:10px 22px;border:1px solid #d9b25f;border-radius:8px;background:transparent;color:#d9b25f;font:700 16px "Trebuchet MS","Segoe UI",system-ui,sans-serif;cursor:pointer';
    ok.addEventListener('click', ev => { ev.stopPropagation(); wrap.remove(); });
    box.append(p, ok); wrap.appendChild(box); document.body.appendChild(wrap);
    return true;
  }
  HANDOFF.showNote = showNote;
  if (todo && typeof window.addEventListener === 'function') {
    const later = () => setTimeout(() => showNote(todo), 600);
    if (document.readyState === 'complete') later(); else window.addEventListener('load', later);
  }

  const P = 'handoff: ';
  HOOKS.selfTest.push((check) => {
    const mem = init => { const s = Object.assign({}, init); return { s, get: k => (k in s ? s[k] : null), set: (k, v) => { s[k] = String(v); }, del: k => { delete s[k]; }, keys: () => Object.keys(s) }; };
    // 1. visited the new address first: the boot wrote default settings, the kid changed one, a second boot
    const nf = mem();
    const st = bootBefore(nf);
    nf.set('fanglands.settings', '{"kid":false,"text":"normal"}'); nf.set('fanglands.kidmode', '0'); nf.set('fanglands.muted', '0');   // what the boot writes
    bootAfter(nf, st);
    nf.set('fanglands.muted', '1');   // the kid turned sound off here
    const st2 = bootBefore(nf); nf.set('fanglands.settings', '{"kid":false,"text":"normal"}'); bootAfter(nf, st2);
    const boot = parse(nf.s[BOOT_KEY], {});
    check(P + 'what the game writes by itself at boot is noted as a default; a setting the kid changed is not', boot['fanglands.settings'] === '{"kid":false,"text":"normal"}' && boot['fanglands.kidmode'] === '0' && !('fanglands.muted' in boot), boot);
    // 2. only what a hand-over carries is ever a boot default: never the login, a slot or the parent page's
    const nb = mem();
    const st3 = bootBefore(nb); nb.set('fanglands.session', 't'); nb.set('fanglands.slot.1', '{}'); nb.set('fanglands.adminKey', 'k'); nb.set('fl_learn_bag', '1'); nb.set('fanglands.slot.current', '1'); bootAfter(nb, st3);
    const boot2 = parse(nb.s[BOOT_KEY], {});
    check(P + 'the login, a slot and anything of the parent page\'s are never noted as boot defaults; a hint counter is', Object.keys(boot2).join(',') === 'fl_learn_bag', boot2);
    // 3. which note, where
    const S = 'a=1; fl_stay=1', H = 'fl_here=1';
    check(P + 'the new address, or the old one with neither cookie: no note', plan({ host: 'fanglands.com', standalone: true, cookie: S }) === null && plan({ host: 'fanglands.com', standalone: false, cookie: H }) === null && plan({ host: 'gorkscape.ca', standalone: true, cookie: '' }) === null && plan({ host: 'gorkscape.ca', standalone: false, cookie: 'fl_here=0; fl_stay=0' }) === null && plan({ host: 'localhost', standalone: false, cookie: H }) === null);
    check(P + 'a home-screen icon on the old address shows its note once', plan({ host: 'gorkscape.ca', standalone: true, cookie: S }) === 'note' && plan({ host: 'www.gorkscape.ca', standalone: true, cookie: S }) === 'note' && plan({ host: 'gorkscape.ca', standalone: true, cookie: S, noted: true }) === null);
    check(P + 'an ordinary tab kept on the old address for a knight only on this device shows the tab note once', plan({ host: 'gorkscape.ca', standalone: false, cookie: H }) === 'tab' && plan({ host: 'test.gorkscape.ca', standalone: false, cookie: 'x=2; ' + H }) === 'tab' && plan({ host: 'gorkscape.ca', standalone: false, cookie: H, tabNoted: true }) === null && plan({ host: 'gorkscape.ca', standalone: false, cookie: S }) === null);
    check(P + 'the tab note says where the game lives now and what to do first', NOTE_TAB === 'Fanglands has a new home: fanglands.com. Log in and bring your knight into your account first.');
    // 4. the icon note's words follow the facts: "saved in the cloud" only when nothing here is held only on this device
    const fp = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36) + '.' + s.length; };
    const K = '{"player":{"playSeconds":300}}', OLD = '{"player":{"playSeconds":100}}', T2 = '{"player":{"playSeconds":900}}';
    const cloud = mem({ 'fanglands.session': 't', 'fanglands.lastname': 'Cohen', 'fanglands.slot.1': K, 'fanglands.slot.1.at': '50', 'fanglands.slot.1.online': 'cohen', 'fanglands.slot.1.synced': 'cohen|' + fp(K), 'fanglands.slot.4': OLD, 'fanglands.slot.4.at': '10', 'fanglands.slot.4.online': 'cohen', 'fanglands.slot.3': 'not a save' });
    check(P + 'logged in, a cloud copy of the account here, its older copy behind it: the note says the knight is saved in the cloud', noteFor(cloud) === NOTE_CLOUD, noteFor(cloud));
    const devs = [
      mem({ 'fanglands.slot.1': K, 'fanglands.slot.2': T2 }),                                               // logged out, knights
      mem({}),                                                                                               // logged out, nothing
      mem({ 'fanglands.session': 't', 'fanglands.lastname': 'Cohen', 'fanglands.slot.1': K, 'fanglands.slot.1.online': '1' }),   // master's old mark: not known to be in the cloud
      mem(Object.assign({}, cloud.s, { 'fanglands.slot.4': T2 })),                                          // its other copy is ahead of the cloud's
      mem(Object.assign({}, cloud.s, { 'fanglands.slot.6': T2, 'fanglands.slot.6.online': 'ann' })),        // another account's copy
      mem(Object.assign({}, cloud.s, { 'fanglands.slot.2': T2 })),                                          // a knight with no owner beside the cloud copy
    ];
    check(P + 'logged out, or with a knight here the server may not have: the note says to keep this icon, never that the knight is in the cloud', devs.every(m => noteFor(m) === NOTE_DEVICE), devs.map(m => noteFor(m)));
    check(P + 'neither icon note says this icon can go or to add a new one without saying what it needs', ![NOTE_CLOUD, NOTE_DEVICE, NOTE_TAB].some(t => /delete|remove|Add it to your Home Screen/i.test(t)));
    check(P + 'nothing on this address asked for a move: the game boots as always', window.FL_LEAVING !== true);
  });
}
