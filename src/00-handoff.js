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
//   - on the old address, opened from an iPad home-screen icon (an installed web app, cookie fl_stay or this load's
//     ?fl_hop=stay), the game is served right there, full screen, as before, with a calm one-time note about the new
//     home: "saved in the cloud" only when the world holds every knight here (it asks the world for its copy once)
//   - on the old address in an ordinary tab that holds a knight the server does not have (the hand-over page sent it to
//     /handoff-here: cookie fl_here or ?fl_hop=here, for this one load), the game is served right there with a calm
//     one-time note: log in and bring that knight into an account first (the login settles it: src/72-deviceknights.js).
//     The cookie is cleared at once, so the next visit asks again, and is sent across once nothing is left only on this
//     device. (page.html takes the ?fl_hop marker off the address before the game runs and leaves it in window.FL_HOP.)
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
  const NOTE_TAB = 'Fanglands has a new home: fanglands.com. This device has a knight saved on it that is not in an account yet, so you play here for now. It is safe. Ask Ethan to add it to your account.';
  const TOKEN = 'fanglands.session', NAME = 'fanglands.lastname';
  // what a hand-over carries besides the login: the settings and the hint counters (handoff-merge.js, CARRY and HINT_RE;
  // a test holds them together)
  const SETTINGS_KEYS = ['fanglands.settings', 'fanglands.muted', 'fanglands.music', 'fanglands.kidmode'];
  const HINT_RE = /^fl_(learn|coach)_[A-Za-z0-9_]{1,40}$/;
  const parse = (raw, dflt) => { try { const v = JSON.parse(raw || 'null'); return v && typeof v === 'object' && !Array.isArray(v) ? v : dflt; } catch (e) { return dflt; } };
  const isOther = k => SETTINGS_KEYS.includes(k) || HINT_RE.test(k);
  // how many knights here are NOT on the server, against what the world holds of the logged-in account's knight: word for
  // word online/src/handoff-merge.js KNIGHTS_SOURCE, which the hand-over page runs (a test holds them together); its
  // comment there says the rule
  const deviceKnights = function deviceKnights(get, keys, world) {
  var SLOT_RE = /^fanglands\.slot\.(\d+)$/, i, j, k, raw, d;
  var fp = function (s) { s = String(s); var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36) + '.' + s.length; };
  var parse = function (raw) { try { var d = JSON.parse(raw); return d && typeof d === 'object' && d.player && typeof d.player === 'object' && !Array.isArray(d.player) ? d : null; } catch (e) { return null; } };
  var playOf = function (d) { return +d.player.playSeconds || 0; };
  var lineOf = function (l) { var out = []; if (Array.isArray(l)) for (var i = 0; i < l.length; i++) if (Array.isArray(l[i]) && typeof l[i][0] === 'string' && isFinite(+l[i][1])) out.push([l[i][0], +l[i][1]]); return out; };
  if (typeof world === 'string') { d = parse(world); world = d ? { fp: fp(world), play: playOf(d), line: d.player.line } : null; }
  var w = world && typeof world === 'object' && typeof world.fp === 'string' && world.fp ? { fp: world.fp, play: +world.play || 0, line: lineOf(world.line) } : null;
  var inside = function (d) {
    var lx = lineOf(d.player.line), ly = w.line, px = playOf(d);
    if (!lx.length || !ly.length) return false;
    for (i = lx.length - 1; i >= 0; i--) {
      for (j = ly.length - 1; j >= 0 && ly[j][0] !== lx[i][0]; j--) { }
      if (j < 0) continue;
      var xAt = i === lx.length - 1 ? px : (px <= lx[i + 1][1] ? lx[i + 1][1] : Infinity);
      var yLeft = j === ly.length - 1 ? w.play : ly[j + 1][1];
      return xAt <= yLeft;
    }
    return false;
  };
  var counts = function (raw) { var d = raw ? parse(raw) : null; return !!d && !(w && (fp(raw) === w.fp || inside(d))); };
  var n = 0;
  for (k = 0; k < keys.length; k++) if (SLOT_RE.test(keys[k]) && counts(get(keys[k]))) n++;
  raw = get('fanglands.save.v2');
  if (get('fanglands.slot.1') == null && get('fanglands.slot.current') == null && counts(raw)) n++;
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

  // Which note to show on this address: 'note' (a home-screen icon on the old address: fl_stay, or this load's
  // ?fl_hop=stay), 'tab' (an ordinary tab the hand-over page kept on the old address: fl_here or ?fl_hop=here), each
  // once, or null. The marker is there for a browser that keeps no cookie (the hops add it to every load they send).
  const hasCookie = (cookie, name) => String(cookie || '').split(';').some(c => c.trim() === name + '=1');
  function plan({ host, standalone, cookie, hop, noted, tabNoted }) {
    if (!OLD_HOSTS.includes(host)) return null;
    if (standalone && (hasCookie(cookie, 'fl_stay') || hop === 'stay')) return noted ? null : 'note';
    if (!standalone && (hasCookie(cookie, 'fl_here') || hop === 'here')) return tabNoted ? null : 'tab';
    return null;
  }
  // the icon note's words: the cloud one only when logged in, the world holds a knight of that account (world: its save
  // string, as GET /api/save gives it), and no knight here is outside it (the same rule as the hand-over page)
  function noteFor(ls, world) {
    if (!ls.get(TOKEN) || typeof world !== 'string' || !world) return NOTE_DEVICE;
    let d = null; try { d = JSON.parse(world); } catch (e) { }
    if (!d || typeof d !== 'object' || !d.player || typeof d.player !== 'object') return NOTE_DEVICE;
    return deviceKnights(ls.get, ls.keys(), world) === 0 ? NOTE_CLOUD : NOTE_DEVICE;
  }
  // asks the world for its copy of the logged-in knight once (a read) and gives the icon note's words; no login, no
  // answer within 5 s, or anything else: the words that say to keep this icon
  function iconWords(ls, done) {
    const tok = ls.get(TOKEN);
    let over = false; const end = text => { if (!over) { over = true; done(text); } };
    if (!tok || typeof fetch !== 'function') { end(NOTE_DEVICE); return; }
    setTimeout(() => end(NOTE_DEVICE), 5000);
    try {
      fetch('/api/save', { headers: { authorization: 'Bearer ' + tok }, cache: 'no-store', credentials: 'same-origin' })
        .then(r => (r.ok ? r.json() : null)).then(d => end(noteFor(ls, d && d.save)), () => end(NOTE_DEVICE));
    } catch (e) { end(NOTE_DEVICE); }
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
  const HANDOFF = { bootBefore, bootAfter, plan, noteFor, iconWords, isOther, deviceKnights, NOTE_CLOUD, NOTE_DEVICE, NOTE_TAB, BOOT_KEY, NOTED_KEY, TAB_NOTED_KEY, ARRIVING_KEY, noteShown: false };
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
  const hopNow = inBrowser && typeof window.FL_HOP === 'string' ? window.FL_HOP : null;
  const todo = inBrowser ? plan({ host, standalone: isStandalone(), cookie: cookieNow, hop: hopNow, noted: LS.get(NOTED_KEY) != null, tabNoted: LS.get(TAB_NOTED_KEY) != null }) : null;
  // fl_here was for this one load: gone at once, so a reload or the next visit asks the hand-over page again
  if (inBrowser && hasCookie(cookieNow, 'fl_here')) { try { document.cookie = 'fl_here=; Max-Age=0; Path=/; Secure; SameSite=Lax'; } catch (e) { } }

  // the arriving card goes as soon as the game runs (its first frame is a moment later)
  const dropCard = () => { try { const e = document.getElementById('fl-arrive'); if (e) e.remove(); } catch (e) { } };
  if (inBrowser) { try { sessionStorage.removeItem(ARRIVING_KEY); } catch (e) { } }

  // an ordinary boot: what the game writes by itself while loading is noted
  { const st = bootBefore(LS); if (typeof setTimeout === 'function') setTimeout(() => { bootAfter(LS, st); if (inBrowser) dropCard(); }, 0); }

  // a one-time note: a small dark card over the title, gone with OK (text: the icon note's words, from iconWords)
  function showNote(kind, text) {
    if (HANDOFF.noteShown || typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function') return false;
    HANDOFF.noteShown = true;
    LS.set(kind === 'tab' ? TAB_NOTED_KEY : NOTED_KEY, String(Date.now()));
    const wrap = document.createElement('div');
    wrap.id = 'fl-newhome';
    wrap.setAttribute('role', 'dialog');
    wrap.style.cssText = 'position:fixed;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,8,12,0.55);z-index:60';
    const box = document.createElement('div');
    box.style.cssText = 'max-width:340px;background:#141a22;border:1px solid #2a3340;border-radius:12px;padding:18px 22px;text-align:center;color:#c9d1d9;font:16px "Trebuchet MS","Segoe UI",system-ui,sans-serif;line-height:1.4;box-shadow:0 8px 30px rgba(0,0,0,0.5)';
    const p = document.createElement('p'); p.style.margin = '0 0 14px'; p.textContent = kind === 'tab' ? NOTE_TAB : (text || NOTE_DEVICE);
    const ok = document.createElement('button'); ok.type = 'button'; ok.textContent = 'OK';
    ok.style.cssText = 'min-width:96px;min-height:44px;padding:10px 22px;border:1px solid #d9b25f;border-radius:8px;background:transparent;color:#d9b25f;font:700 16px "Trebuchet MS","Segoe UI",system-ui,sans-serif;cursor:pointer';
    ok.addEventListener('click', ev => { ev.stopPropagation(); wrap.remove(); });
    box.append(p, ok); wrap.appendChild(box); document.body.appendChild(wrap);
    return true;
  }
  HANDOFF.showNote = showNote;
  if (todo && typeof window.addEventListener === 'function') {
    const later = () => setTimeout(() => { if (todo === 'tab') showNote(todo); else iconWords(LS, text => showNote(todo, text)); }, 600);
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
    check(P + 'a browser that keeps no cookie: the hop\'s one-load marker (?fl_hop) shows the same notes', plan({ host: 'gorkscape.ca', standalone: true, cookie: '', hop: 'stay' }) === 'note' && plan({ host: 'gorkscape.ca', standalone: false, cookie: '', hop: 'here' }) === 'tab' && plan({ host: 'gorkscape.ca', standalone: false, cookie: '', hop: 'stay' }) === null && plan({ host: 'fanglands.com', standalone: false, cookie: '', hop: 'here' }) === null && plan({ host: 'gorkscape.ca', standalone: false, cookie: '', hop: 'evil' }) === null);
    check(P + 'the tab note says where the game lives now, that the knight is safe, and who can move it', NOTE_TAB === 'Fanglands has a new home: fanglands.com. This device has a knight saved on it that is not in an account yet, so you play here for now. It is safe. Ask Ethan to add it to your account.');
    // 4. the icon note's words follow the facts: "saved in the cloud" only when the world holds every knight here
    const K = '{"player":{"playSeconds":300,"line":[["s1",0],["s2",200]]}}', BEHIND = '{"player":{"playSeconds":150,"line":[["s1",0]]}}', AHEAD = '{"player":{"playSeconds":320,"line":[["s1",0],["s2",200]],"kills":1}}', T2 = '{"player":{"playSeconds":900}}';
    const cloud = mem({ 'fanglands.session': 't', 'fanglands.lastname': 'Cohen', 'fanglands.slot.1': K, 'fanglands.slot.1.at': '50', 'fanglands.slot.1.online': 'cohen', 'fanglands.slot.4': BEHIND, 'fanglands.slot.3': 'not a save', 'fanglands.kept.cohen': T2 });
    check(P + 'logged in, the world\'s very copy here and an older copy inside it (a backup is not a knight): the note says the knight is saved in the cloud', noteFor(cloud, K) === NOTE_CLOUD, noteFor(cloud, K));
    const devs = [
      [mem({ 'fanglands.slot.1': K }), K],                                                     // logged out: nothing is known
      [mem({}), null],                                                                          // logged out, nothing
      [cloud, null],                                                                            // the world did not answer
      [cloud, '{"player":{"playSeconds":1}}'],                                                  // the world holds another knight
      [mem(Object.assign({}, cloud.s, { 'fanglands.slot.1': AHEAD })), K],                     // progress that never reached the world
      [mem(Object.assign({}, cloud.s, { 'fanglands.slot.2': T2 })), K],                        // a knight no account owns (or another account's)
    ];
    check(P + 'logged out, no answer, or a knight here the world does not hold: the note says to keep this icon, never that the knight is in the cloud', devs.every(([m, w]) => noteFor(m, w) === NOTE_DEVICE), devs.map(([m, w]) => noteFor(m, w)));
    { let said = null; iconWords(mem({ 'fanglands.slot.1': K }), t => { said = t; }); check(P + 'logged out, the icon note asks the world nothing and says to keep this icon', said === NOTE_DEVICE, said); }
    // 5. the rule against what the game's REAL login leaves in storage (71-login, 72-cloudsave and, where the tree has it,
    //    72-deviceknights' cache model and the knight's line), with a small world that answers on the spot. The rule reads
    //    no note of any other file, so a renamed note cannot change it; a change in how a login leaves the knight fails here.
    const L = window.LOGIN, C = window.CLOUD, DK = window.DEVKNIGHTS;
    const hasLS = typeof localStorage !== 'undefined';
    const listed = hasLS && (LS.set('fanglands.handoff.probe', '1'), LS.keys().includes('fanglands.handoff.probe'));
    LS.del('fanglands.handoff.probe');
    if (hasLS) check(P + 'this storage lists its keys (as a browser\'s does; the rule and the check below read every key)', listed);
    if (listed && L && C && typeof NET !== 'undefined' && typeof title !== 'undefined' && typeof L.submit === 'function') {
      if (!title.active) save();
      const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, status: NET.status, slot: title.slot, titleActive: title.active, showing: L.showing, playing: L.playing, alone: L.alone, name: L.name, paused, notice, view: DK ? DK.testView : undefined };
      const keep = {}; for (const k of LS.keys()) keep[k] = LS.get(k);
      const base = JSON.parse(LS.get(title.slotKey(title.slot)) || '{"player":{},"quest":{}}'); base.player = base.player || {}; base.player.kills = 42;
      const world = {
        saves: { cohen: JSON.stringify(base) }, up: true,
        call(method, path, body, token) {
          const fail = (code, status) => { const e = new Error(code); e.code = code; e.status = status; throw e; };
          if (path === '/api/status') return { ok: true, online: 1, names: ['Cohen'] };
          if (path === '/api/login') { if (String(body.name).toLowerCase() !== 'cohen' || body.pass !== 'sword') fail('pass', 401); return { token: 'tok-cohen', name: 'Cohen' }; }
          if (token !== 'tok-cohen') fail('auth', 401);
          if (path === '/api/me') return { name: 'Cohen', created: 1, saveAt: 1, online: false };
          if (path === '/api/save' && method === 'GET') return { save: world.saves.cohen, at: 5 };
          if (path === '/api/save' && method === 'PUT') { if (!world.up) fail('down', 0); world.saves.cohen = body; return { at: 6 }; }
          if (path === '/api/logout') return { ok: true };
          fail('bad', 400);
        },
        open: () => { const so = { readyState: 1, send(str) { if (JSON.parse(str).t === 'hello') so.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'Cohen', at: 1, keeper: 'Cohen' }) }); }, close() { so.readyState = 3; if (so.onclose) so.onclose(); } }; return so; },
      };
      const here = w => deviceKnights(LS.get, LS.keys(), w);
      // a minute of play: play seconds only grow, and the knight's line tells copies apart by them (72-deviceknights)
      const play = () => { player.kills++; player.playSeconds = (+player.playSeconds || 0) + 60; save(); };
      try {
        // a browser that never played: only what the login writes is in it
        for (const k of LS.keys()) if (/^fanglands\.(slot\.|save\.v2|session$|lastname$|kept|dk\.|marks)/.test(k)) LS.del(k);
        NET.enabled = true; NET.useFake(world); NET.setToken(null); L.alone = false; L.playing = false; C.reset(); if (DK) DK.testView = true;
        title.open();
        L.submit('Cohen', 'sword', '', false);
        const r1 = { playing: L.playing, slot1: LS.get(title.slotKey(1)) === world.saves.cohen, withWorld: here(world.saves.cohen), unknown: here(null) };
        play(); C.flush();
        const r2 = { pushed: JSON.parse(world.saves.cohen).player.kills === 43, withWorld: here(world.saves.cohen) };
        world.up = false; play(); C.flush();
        const r3 = { stranded: here(world.saves.cohen) };
        world.up = true; C.flush();
        const r4 = { landed: JSON.parse(world.saves.cohen).player.kills === 44, withWorld: here(world.saves.cohen) };
        LS.set('fanglands.slot.' + (DK ? DK.PARK_MAX : 9), JSON.stringify({ player: { kills: 1, playSeconds: 5 }, quest: {} }));
        const r5 = { unowned: here(world.saves.cohen) };
        check(P + 'after the game\'s real login, and after its pushes land, the knight here is the world\'s: the browser is sent across (with nothing known, it would stay)', r1.playing && r1.slot1 && r1.withWorld === 0 && r1.unknown >= 1 && r2.pushed && r2.withWorld === 0 && r4.landed && r4.withWorld === 0, { r1, r2, r4 });
        check(P + 'progress whose upload never landed, or a knight no account owns, keeps the tab on the old address (nothing stranded there)', r3.stranded === 1 && r5.unowned === 1, { r3, r5 });
        check(P + 'the icon note after the real login says the knight is saved in the cloud only while the world holds it', noteFor(LS, world.saves.cohen) === NOTE_DEVICE && (LS.del('fanglands.slot.' + (DK ? DK.PARK_MAX : 9)), noteFor(LS, world.saves.cohen) === NOTE_CLOUD));
      } finally {
        if (L.hide) L.hide();
        NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.setToken(was.token); NET.status = 'off'; NET.me = null;
        L.playing = was.playing; L.alone = was.alone; L.name = was.name; L.error = ''; L.offer = null; L.busy = false; L.mode = 'form';
        C.reset(); if (DK) DK.testView = was.view;
        for (const k of LS.keys()) if (!(k in keep)) LS.del(k);
        for (const k in keep) LS.set(k, keep[k]);
        if (was.titleActive) { title.open(); if (was.showing) L.show(); } else title.startSlot(was.slot);
        paused = was.paused; notice = was.notice;
        if (was.status === 'on' && NET.token) NET.connect();
      }
    }
    check(P + 'neither icon note says this icon can go or to add a new one without saying what it needs', ![NOTE_CLOUD, NOTE_DEVICE, NOTE_TAB].some(t => /delete|remove|Add it to your Home Screen/i.test(t)));
    check(P + 'nothing on this address asked for a move: the game boots as always', window.FL_LEAVING !== true);
  });
}
