// ============================================================================
// HAND-OVER, THE GAME'S SIDE — two addresses (docs/ONLINE.md, "Two addresses")
// Owner (2026-10-03): "port everything over to the new proper domain but have gorkscape redirect to fang lands so
// anyone with the old domain doesnt notice the diffrance for now".
// The hand-over itself happens before the game loads, on small pages the world serves (online/src/handoff.js): the old
// address offers this browser's keys, fanglands.com/handoff claims them and writes what is missing
// (online/src/handoff-merge.js), then the game loads once. This file is what the game does about it:
//   - the boot note: what the game writes by itself while loading (default settings and so on) is noted in
//     fanglands.handoff.boot, so a hand-over can tell "never changed here" from "the kid's own" (handoff-merge.js)
//   - the arriving card: page.html shows "Bringing your knight over..." while the game page loads after a hand-over
//     (sessionStorage fanglands.handoff.arriving, set by the landing page); it goes as soon as the game runs
//   - on the old address, opened from an iPad home-screen icon (an installed web app), the game is served right there,
//     full screen, as before; it shows a calm one-time note about the new home
//   - on the old address in an ordinary browser tab that somehow holds the home-screen cookie (a shared cookie jar on
//     some computers), it clears the cookie and lets the hand-over run, so a tab never gets stuck on the old address
//   - on the new address, when knights were left waiting on the old one (it was too busy to take them; the landing page
//     noted it in fanglands.handoff.later): at a boot five minutes or more later, while the title is all there is, the
//     tab goes once through the old address, which hands them over and comes back
// Feature file: runs once at load; window.HANDOFF is the register; HOOKS.selfTest checks the rules.
// ============================================================================
{
  const BOOT_KEY = 'fanglands.handoff.boot';       // the values the game wrote by itself at boot, unchanged since
  const NOTED_KEY = 'fanglands.handoff.noted';     // the one-time note on the old address was shown
  const ARRIVING_KEY = 'fanglands.handoff.arriving';
  const OLD_HOSTS = ['gorkscape.ca', 'www.gorkscape.ca', 'test.gorkscape.ca'];
  const LATER_KEY = 'fanglands.handoff.later';     // {at, from}: knights wait on that old address (handoff.js landing page)
  const LATER_MS = 5 * 60 * 1000, LATER_LIFE = 30 * 24 * 3600 * 1000;
  const OLDS_OF = { 'fanglands.com': ['gorkscape.ca', 'www.gorkscape.ca'], 'test.fanglands.com': ['test.gorkscape.ca'] };
  // the one-time note on the old address's home-screen icon. A new icon keeps its own storage (WebKit): it starts
  // logged out and without the knights saved here, so the note never says this icon can go, and says "saved in the
  // cloud" only when that is true of everything here
  const NEW_ICON = 'A new icon starts logged out: log in with your knight\'s name and secret word.';
  const NOTE_CLOUD = 'Fanglands has a new home: fanglands.com. Your knight is saved in the cloud. ' + NEW_ICON;
  const NOTE_DEVICE = 'Fanglands has a new home: fanglands.com. Keep this icon: knights saved on this device live here. ' + NEW_ICON;
  const KEY_RE = /^(fanglands\.|fl_)[A-Za-z0-9_.:-]{1,160}$/;
  const SLOT_RE = /^fanglands\.slot\.(\d+)$/, AT_RE = /^fanglands\.slot\.\d+\.at$/;
  const TOKEN = 'fanglands.session', NAME = 'fanglands.lastname', MARK = 'fanglands.slot.1.online';
  const parse = (raw, dflt) => { try { const v = JSON.parse(raw || 'null'); return v && typeof v === 'object' && !Array.isArray(v) ? v : dflt; } catch (e) { return dflt; } };
  // the keys that are neither a save slot, its stamp or mark, the login, the parent page's, nor the hand-over's own
  // notes: settings, hints, the current slot, the old single save. handoff-merge.js has the same rule (a test holds them
  // together).
  const isOther = k => KEY_RE.test(k) && !/admin/i.test(k) && !SLOT_RE.test(k) && !AT_RE.test(k) && k !== MARK && k !== TOKEN && k !== NAME && !k.startsWith('fanglands.handoff');

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

  // What to do on this address: 'leave' (an ordinary tab on the old address with the home-screen cookie: clear it and
  // let the hand-over run), 'note' (a home-screen icon on the old address, the note not shown yet), or null.
  function plan({ host, standalone, cookie, noted }) {
    if (!OLD_HOSTS.includes(host)) return null;
    const stay = String(cookie || '').split(';').some(c => c.trim() === 'fl_stay=1');
    if (!stay) return null;
    if (!standalone) return 'leave';
    return noted ? null : 'note';
  }
  // the note's words: the cloud one only when logged in with the account's working copy (slot 1 with its mark) and no
  // other knight here that the server does not have (the same test as 72-deviceknights' find: a save that reads, not
  // already brought into an account)
  const fp = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36) + '.' + s.length; };
  function noteFor(ls) {
    const tok = ls.get(TOKEN);
    if (!tok || ls.get(MARK) == null || ls.get('fanglands.slot.1') == null) return NOTE_DEVICE;
    let brought = []; try { brought = JSON.parse(ls.get('fanglands.brought') || '[]'); } catch (e) { }
    if (!Array.isArray(brought)) brought = [];
    for (const k of ls.keys()) {
      const m = SLOT_RE.exec(k); if (!m || m[1] === '1') continue;
      const raw = ls.get(k); if (!raw) continue;
      let reads = false; try { const d = JSON.parse(raw); reads = !!d && typeof d === 'object' && !!d.player; } catch (e) { }
      if (reads && !brought.includes(fp(raw))) return NOTE_DEVICE;
    }
    return NOTE_CLOUD;
  }
  // On a new address: go back once through the old one for knights that wait there? -> the old address, 'drop' (a note
  // that is not ours or ran out), or null (nothing to do, not yet, or an installed web app, which never leaves).
  function later({ host, standalone, note, now }) {
    const olds = OLDS_OF[host]; if (!olds || note == null) return null;
    const v = parse(note, null);
    if (!v || !olds.includes(v.from) || !(+v.at > 0) || Math.abs(now - v.at) > LATER_LIFE) return 'drop';
    if (standalone || now - v.at < LATER_MS) return null;
    return v.from;
  }
  const isStandalone = () => {
    try { return (typeof navigator !== 'undefined' && navigator.standalone === true) || !!(typeof matchMedia === 'function' && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches)); } catch (e) { return false; }
  };

  const LS = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { } },
    del: k => { try { localStorage.removeItem(k); } catch (e) { } },
    keys: () => { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k != null) out.push(k); } } catch (e) { } return out; },
  };
  const HANDOFF = { bootBefore, bootAfter, plan, later, noteFor, isOther, NOTE_CLOUD, NOTE_DEVICE, BOOT_KEY, NOTED_KEY, ARRIVING_KEY, LATER_KEY, noteShown: false, leaving: false };
  window.HANDOFF = HANDOFF;

  const inBrowser = typeof location !== 'undefined' && location && typeof location.hostname === 'string' && typeof document !== 'undefined';
  const host = inBrowser ? location.hostname.toLowerCase() : '';
  // a hand-over fragment never stays on the game's address (the landing page takes it off; this is for anything older)
  if (inBrowser && typeof location.hash === 'string' && location.hash.startsWith('#handoff')) {
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { }
  }
  const todo = inBrowser ? plan({ host, standalone: isStandalone(), cookie: (() => { try { return document.cookie; } catch (e) { return ''; } })(), noted: LS.get(NOTED_KEY) != null }) : null;
  if (todo === 'leave') {
    HANDOFF.leaving = true;
    location.replace('/handoff-leave?to=' + encodeURIComponent(location.pathname + location.search));
    // nothing else of the game runs on this load: the old address hands this tab over in a moment
    throw new Error('Fanglands is moving this tab to its new home. One moment.');
  }
  // knights left waiting on the old address: this boot (the title is all there is yet) goes back for them, once
  const back = inBrowser ? later({ host, standalone: isStandalone(), note: LS.get(LATER_KEY), now: Date.now() }) : null;
  if (back) {
    LS.del(LATER_KEY);
    if (back !== 'drop') {
      HANDOFF.leaving = true;
      location.replace('https://' + back + location.pathname + location.search);
      throw new Error('Fanglands is fetching the knights that waited at its old home. One moment.');
    }
  }

  // the arriving card goes as soon as the game runs (its first frame is a moment later)
  const dropCard = () => { try { const e = document.getElementById('fl-arrive'); if (e) e.remove(); } catch (e) { } };
  if (inBrowser) { try { sessionStorage.removeItem(ARRIVING_KEY); } catch (e) { } }

  // an ordinary boot: what the game writes by itself while loading is noted
  { const st = bootBefore(LS); if (typeof setTimeout === 'function') setTimeout(() => { bootAfter(LS, st); if (inBrowser) dropCard(); }, 0); }

  // the one-time note on the old address's home-screen icon: a small dark card over the title, gone with OK
  function showNote() {
    if (HANDOFF.noteShown || typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function') return false;
    HANDOFF.noteShown = true;
    LS.set(NOTED_KEY, String(Date.now()));
    const wrap = document.createElement('div');
    wrap.id = 'fl-newhome';
    wrap.setAttribute('role', 'dialog');
    wrap.style.cssText = 'position:fixed;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,8,12,0.55);z-index:60';
    const box = document.createElement('div');
    box.style.cssText = 'max-width:340px;background:#141a22;border:1px solid #2a3340;border-radius:12px;padding:18px 22px;text-align:center;color:#c9d1d9;font:16px "Trebuchet MS","Segoe UI",system-ui,sans-serif;line-height:1.4;box-shadow:0 8px 30px rgba(0,0,0,0.5)';
    const p = document.createElement('p'); p.style.margin = '0 0 14px'; p.textContent = noteFor(LS);
    const ok = document.createElement('button'); ok.type = 'button'; ok.textContent = 'OK';
    ok.style.cssText = 'min-width:96px;min-height:44px;padding:10px 22px;border:1px solid #d9b25f;border-radius:8px;background:transparent;color:#d9b25f;font:700 16px "Trebuchet MS","Segoe UI",system-ui,sans-serif;cursor:pointer';
    ok.addEventListener('click', ev => { ev.stopPropagation(); wrap.remove(); });
    box.append(p, ok); wrap.appendChild(box); document.body.appendChild(wrap);
    return true;
  }
  HANDOFF.showNote = showNote;
  if (todo === 'note' && typeof window.addEventListener === 'function') {
    if (document.readyState === 'complete') setTimeout(showNote, 600); else window.addEventListener('load', () => setTimeout(showNote, 600));
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
    // 2. the login, the slots and the parent page's keys are never boot defaults
    const nb = mem();
    const st3 = bootBefore(nb); nb.set('fanglands.session', 't'); nb.set('fanglands.slot.1', '{}'); nb.set('fanglands.adminKey', 'k'); nb.set('fl_learn_bag', '1'); bootAfter(nb, st3);
    const boot2 = parse(nb.s[BOOT_KEY], {});
    check(P + 'the login, a slot and anything of the parent page\'s are never noted as boot defaults', !('fanglands.session' in boot2) && !('fanglands.slot.1' in boot2) && !('fanglands.adminKey' in boot2) && boot2['fl_learn_bag'] === '1', boot2);
    // 3. what to do on which address
    const C = 'a=1; fl_stay=1';
    check(P + 'the new address, or the old one with no home-screen cookie: the game just boots', plan({ host: 'fanglands.com', standalone: true, cookie: C }) === null && plan({ host: 'gorkscape.ca', standalone: true, cookie: '' }) === null && plan({ host: 'gorkscape.ca', standalone: false, cookie: 'fl_stay=0' }) === null && plan({ host: 'localhost', standalone: false, cookie: C }) === null);
    check(P + 'a home-screen icon on the old address shows the note once', plan({ host: 'gorkscape.ca', standalone: true, cookie: C }) === 'note' && plan({ host: 'www.gorkscape.ca', standalone: true, cookie: C }) === 'note' && plan({ host: 'gorkscape.ca', standalone: true, cookie: C, noted: true }) === null);
    check(P + 'an ordinary tab on the old address that holds the home-screen cookie clears it and is handed over', plan({ host: 'gorkscape.ca', standalone: false, cookie: C }) === 'leave' && plan({ host: 'test.gorkscape.ca', standalone: false, cookie: 'fl_stay=1', noted: true }) === 'leave');
    // 4. the note's words follow the facts: "saved in the cloud" only when nothing here is held only on this device
    const S = '{"player":{"level":3}}', T2 = '{"player":{"level":9}}';
    const cloud = mem({ 'fanglands.session': 't', 'fanglands.slot.1': S, 'fanglands.slot.1.online': '1', 'fanglands.slot.2': T2, 'fanglands.brought': JSON.stringify([fp(T2)]), 'fanglands.slot.3': 'not a save' });
    check(P + 'logged in, slot 1 the cloud copy, every other knight brought already: the note says the knight is saved in the cloud', noteFor(cloud) === 'Fanglands has a new home: fanglands.com. Your knight is saved in the cloud. A new icon starts logged out: log in with your knight\'s name and secret word.', noteFor(cloud));
    const devs = [
      mem({ 'fanglands.slot.1': S, 'fanglands.slot.2': T2 }),                                                  // logged out, device knights
      mem({}),                                                                                                  // logged out, nothing
      mem({ 'fanglands.session': 't', 'fanglands.slot.1': S, 'fanglands.slot.1.online': '1', 'fanglands.slot.2': T2 }),   // a device knight beside the cloud copy
      mem({ 'fanglands.session': 't', 'fanglands.slot.1': S }),                                                 // slot 1 not the cloud's copy
      mem({ 'fanglands.session': 't', 'fanglands.slot.1': S, 'fanglands.slot.1.online': '1', 'fanglands.slot.40': T2 }),  // a parked knight
    ];
    check(P + 'logged out, or with a knight held only on this device: the note says to keep this icon, never that the knight is in the cloud', devs.every(m => noteFor(m) === 'Fanglands has a new home: fanglands.com. Keep this icon: knights saved on this device live here. A new icon starts logged out: log in with your knight\'s name and secret word.'), devs.map(m => noteFor(m)));
    check(P + 'neither note says this icon can go or to add a new one without saying what it needs', ![NOTE_CLOUD, NOTE_DEVICE].some(t => /delete|remove|Add it to your Home Screen/i.test(t)));
    // 5. knights left on the old address: one trip back, five minutes on or more, never from an installed web app
    const N = JSON.stringify({ at: 1000, from: 'gorkscape.ca' }), M5 = 5 * 60 * 1000;
    check(P + 'knights wait on the old address: a boot five minutes on goes back through it, once the note is read', later({ host: 'fanglands.com', note: N, now: 1000 + M5 }) === 'gorkscape.ca' && later({ host: 'fanglands.com', note: JSON.stringify({ at: 1, from: 'www.gorkscape.ca' }), now: M5 + 9 }) === 'www.gorkscape.ca' && later({ host: 'test.fanglands.com', note: JSON.stringify({ at: 1, from: 'test.gorkscape.ca' }), now: M5 + 9 }) === 'test.gorkscape.ca');
    check(P + 'not before five minutes, not from a home-screen icon, not with no note', later({ host: 'fanglands.com', note: N, now: 1000 + M5 - 1 }) === null && later({ host: 'fanglands.com', note: N, now: 1000 + M5, standalone: true }) === null && later({ host: 'fanglands.com', note: null, now: 9e12 }) === null);
    check(P + 'a note naming another address, on the wrong address, or broken is dropped, never followed', later({ host: 'fanglands.com', note: JSON.stringify({ at: 1, from: 'evil.example' }), now: M5 + 9 }) === 'drop' && later({ host: 'fanglands.com', note: JSON.stringify({ at: 1, from: 'test.gorkscape.ca' }), now: M5 + 9 }) === 'drop' && later({ host: 'fanglands.com', note: '{', now: M5 }) === 'drop' && later({ host: 'gorkscape.ca', note: N, now: 9e12 }) === null);
    check(P + 'nothing on this address asked for a move: the game boots as always', !HANDOFF.leaving);
  });
}
