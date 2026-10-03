// ============================================================================
// DEVICE KNIGHTS — a knight saved on this device that no account owns is named, kept, and offered to a new account
// Owner (2026-10-03): "everything should be server side so that they can play on multiple devices", and yes to taking
// Play alone away, so every new knight needs Ethan's invite code. Online there is no Play alone any more (71-login).
// Browsers that played alone before still hold knights no account owns: a slot (fanglands.slot.1 to LOGIN.PARK_MAX: 1 to 3
// from the title, past 3 only where 71-login's park() moved one) with a save in it, except slot 1 while it carries the
// cloud mark (that is an account's working copy). A knight one account brought in stays on the device and is still named
// and offered to everyone else (brother and sister on one iPad): only that account no longer sees it (fanglands.brought,
// fingerprint -> the names that brought it, written once the world has the knight).
// - NAMED where the kid is: under the login form and on the "Playing as" card, one plain line: "This device has a knight
//   saved on it: Slot 2 (level 7). It is safe here. Make a new knight with Ethan's invite code to bring it with you."
// - KEPT: 71-login never deletes or overwrites one (park() moves it out of slot 1 to an empty slot up to PARK_MAX; only
//   if storage itself has no room does the start stop and say so).
// - OFFERED when an account's cloud is empty (a NEW account; 71-login asks the old address, and so this file, only then):
//   Yes brings the knight in exactly the way the old address's knight comes in (LOGIN.bring: slot 1, the mark, a push at
//   once); with several, the kid taps the one (cards 44 px and up); Start fresh asks first, and a double tap or a burst of
//   taps can never pass the question. A knight another account brought in already says so on its card ("Ann brought this
//   knight into an account already. You can bring it too."). Nothing here deletes or rewrites a slot.
// Self-tests: while FANGLANDS.selfTest runs this file sees no device knights unless its own test turns DK.testView on, so
// another file's sign-up (79-boygirl's Mia) is never offered a knight some other test left in a slot.
// Offline (no NET: file://, the offline copy, the tests' own boot) none of this shows and the slots work as before.
// Feature file: wraps LOGIN.bridge.ask and FANGLANDS.selfTest by reassignment, paints its part of 71-login's card through
// LOGIN.afterRefresh. window.DEVKNIGHTS is the register; docs/ONLINE.md ("Every knight lives on the server") says it.
// ============================================================================
{
  const L = window.LOGIN;
  const BROUGHT_KEY = 'fanglands.brought';
  const CONFIRM_SECS = 0.8;   // "Yes, start fresh" takes a tap only after this long with no tap on the offer
  const CHAPTERS = ['The Cave', 'Thistledown', 'Goblin Tech', 'Hollowford', 'The Fang'];
  const SLOT = n => title.slotKey(n), AT = n => title.slotKey(n) + '.at';
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { } };
  const hasDom = () => typeof document !== 'undefined' && !!document.body && !!document.head && typeof document.createElement === 'function';
  // a short fingerprint of a slot string: only to know "this exact knight is in an account already"
  const fp = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36) + '.' + s.length; };
  // fanglands.brought: { fingerprint: [the names of the accounts that brought that knight in] }
  const brought = () => { try { const o = JSON.parse(lsGet(BROUGHT_KEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } };
  const namesOf = (o, f) => Array.isArray(o[f]) ? o[f].filter(x => typeof x === 'string') : [];
  const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
  const remember = (raw, name) => {
    if (!name) return;
    const o = brought(), f = fp(raw), a = namesOf(o, f); if (a.some(x => same(x, name))) return;
    delete o[f]; o[f] = a.concat(name); const ks = Object.keys(o); while (ks.length > 50) delete o[ks.shift()];
    lsSet(BROUGHT_KEY, JSON.stringify(o));
  };
  // the account on this card now (logged in: "Playing as", or the offer after its login); null on the form
  const meNow = () => (NET.token && L.name) ? L.name : null;
  const fmtTime = s => { s = Math.floor(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h}h ${m}m` : m ? `${m}m` : 'under a minute'; };

  const DK = {
    list: [],          // the offer on the card right now (device knights, then the old address's knight if it has one)
    armed: false, armedAt: 0,   // Start fresh was tapped once: the question is up
    pending: null,     // a device knight brought in, waiting for its first good push before it is remembered
    inSelfTest: false, testView: false,
    clock: () => performance.now() / 1000,
    stats: { offered: 0, brought: 0, fresh: 0 }, askOld: null, CONFIRM_SECS, BROUGHT_KEY, fp,
    PARK_MAX: L.PARK_MAX,   // the highest slot 71-login's park() uses (00-handoff's self-test reads it)
  };
  window.DEVKNIGHTS = DK;
  const seeing = () => NET.enabled && (!DK.inSelfTest || DK.testView);

  // ---------- the knights on this device that no account owns, by slot ----------
  // all of them, except one the account on the card brought in itself; `by` names the others that brought it in
  DK.find = () => {
    if (!seeing()) return [];
    const o = brought(), me = meNow(), seen = new Set(), out = [];
    for (let n = 1; n <= L.PARK_MAX; n++) {
      const raw = lsGet(SLOT(n)); if (!raw) continue;
      if (n === 1 && lsGet(L.MARK_KEY) != null) continue;
      let reads = false; try { const d = JSON.parse(raw); reads = !!d && typeof d === 'object' && !!d.player; } catch (e) { }
      if (!reads) continue;
      const f = fp(raw); if (seen.has(f)) continue; seen.add(f);
      const by = namesOf(o, f); if (me && by.some(x => same(x, me))) continue;
      out.push(Object.assign({ slot: n, save: raw, at: +lsGet(AT(n)) || 0, device: true, by }, L.summarizeRaw(raw)));
    }
    return out;
  };

  // ---------- the words ----------
  const nameOf = k => k.device ? `Slot ${k.slot} (level ${k.level})` : `The old address (level ${k.level})`;
  const andList = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  // the line on the form and the "Playing as" card ('' with none)
  DK.line = (list = DK.find()) => {
    if (!list.length) return '';
    const one = list.length === 1;
    return `This device has ${one ? 'a knight' : list.length + ' knights'} saved on it: ${andList(list.map(nameOf))}. ` +
      (one ? "It is safe here. Make a new knight with Ethan's invite code to bring it with you." : "They are safe here. Make a new knight with Ethan's invite code to bring one with you.");
  };
  // one more line on the card of a knight another account brought in already (it can still come in here too)
  DK.already = k => k && k.by && k.by.length ? `${andList(k.by)} brought this knight into ${k.by.length === 1 ? 'an account' : 'accounts'} already. You can bring it too.` : '';
  DK.detail = k => { const ch = CHAPTERS[k.chapter - 1] || ''; return `Chapter ${k.chapter}: ${ch}` + (k.region && k.region !== 'Unknown' && k.region !== ch ? ` · in ${k.region}` : '') + ` · played ${fmtTime(k.playSeconds)}`; };
  DK.words = (list = DK.list) => {
    if (list.length === 1) return list[0].device ? `This device has a knight saved on it: ${nameOf(list[0])}. Bring it into your account?` : `Bring your knight from the old address? Level ${list[0].level}.`;
    const dev = list.filter(k => k.device).length;
    return `This device has ${dev === 1 ? 'a knight' : dev + ' knights'} saved on it${list.length > dev ? ', and the old address has one too' : ''}. Tap the one to bring into your account.`;
  };
  DK.hint = () => DK.list.length === 1 ? 'Start fresh makes a new knight instead. This one stays saved where it is.' : 'Start fresh makes a new knight instead. These stay saved where they are.';
  DK.question = () => DK.list.length === 1 ? 'Start a new knight? This one will not come into this account.' : 'Start a new knight? These will not come into this account.';

  // ---------- the offer: only when the account's cloud is empty ----------
  // 71-login's afterLogin asks the old address only after GET /api/save said there is no cloud save. With no device
  // knight, the old address's answer goes on exactly as before (its own offer, or a fresh start).
  const _ask = L.bridge.ask;
  DK.askOld = cb => _ask.call(L.bridge, cb);
  L.bridge.ask = cb => DK.askOld(c => {
    const list = DK.find();
    if (!list.length) { cb(c); return; }
    if (c) list.push(Object.assign({}, c, { device: false }));
    DK.list = list; DK.armed = false; L.offer = null; L.error = ''; L.mode = 'device'; DK.stats.offered++;
    L.refresh();
  });
  // a knight brought in is remembered for that account (it no longer sees it; everyone else still does) once the world
  // has it: its first good push
  const settle = () => { if (DK.pending && window.CLOUD && CLOUD.pushes > DK.pending.pushes && L.playing) { remember(DK.pending.save, DK.pending.name); DK.pending = null; } };
  HOOKS.update.push(settle);
  // Yes, or a tap on a knight's card: in it goes, the way the old address's knight does (LOGIN.bring). A knight in slot 1
  // is moved to an empty slot first (71-login's park), so what the device held stays on the device.
  DK.pick = i => {
    const k = DK.list[i]; if (L.mode !== 'device' || !k) return false;
    DK.list = []; DK.armed = false; L.mode = 'busy'; L.refresh();
    L.offer = { save: k.save, at: k.at || Date.now() };
    DK.pending = k.device ? { save: k.save, pushes: window.CLOUD ? CLOUD.pushes : 0, name: L.name } : null;
    const ok = L.bring(true);
    if (!ok) DK.pending = null; else { DK.stats.brought++; settle(); }
    return !!ok;
  };
  DK.yes = () => DK.list.length === 1 ? DK.pick(0) : false;
  // Start fresh asks first. Its button greys out and nothing on the card moves, so a second tap where it was does nothing;
  // "Yes, start fresh" comes under everything and takes a tap only after CONFIRM_SECS with no tap on the offer (each press
  // starts the wait again), so a double tap or a burst of taps never starts fresh. A knight's card or Yes still brings it.
  const ready = () => DK.armed && DK.clock() - DK.armedAt >= CONFIRM_SECS;
  DK.ready = ready;
  DK.press = () => { if (DK.armed && !ready()) DK.armedAt = DK.clock(); };
  DK.fresh = () => {
    if (L.mode !== 'device' || DK.armed) return false;
    DK.armed = true; DK.armedAt = DK.clock(); paint();
    return false;
  };
  DK.confirmFresh = () => {
    if (L.mode !== 'device' || !ready()) { DK.press(); return false; }
    DK.list = []; DK.armed = false; DK.stats.fresh++; L.mode = 'busy'; L.refresh();
    L.offer = null; return !!L.bring(false);
  };
  DK.cancelFresh = () => { if (!DK.armed) return false; DK.armed = false; paint(); return true; };

  // ---------- self-tests: no device knights unless the test sets what it sees ----------
  { const FG = window.FANGLANDS;
    if (FG && typeof FG.selfTest === 'function') {
      const _selfTest = FG.selfTest;
      FG.selfTest = function () { const was = DK.inSelfTest; DK.inSelfTest = true; try { return _selfTest.apply(this, arguments); } finally { DK.inSelfTest = was; DK.testView = false; } };
    } }

  // ---------- its part of 71-login's card (the card's CSS: dark vellum, iron plates, 44 px and up) ----------
  const CSS = `
#fl-login .fl-dk-line{font:600 14px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:19px;color:#f4ead3;margin-top:12px;padding:10px 12px;background:rgba(0,0,0,.28);border:1px solid rgba(217,178,92,.35);border-radius:4px}
#fl-login .fl-dk .fl-line{line-height:21px}
#fl-login .fl-dk-sub{font:600 13px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#cdbf9e;margin:2px 0 0}
#fl-login .fl-dk-list{display:flex;flex-direction:column;gap:8px;margin-top:12px}
#fl-login .fl-dk-list button{flex:none;display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-height:56px;text-align:left;padding:9px 14px}
#fl-login .fl-dk-name{font:800 15px "Cinzel","Trajan Pro",Georgia,serif;color:#f7dc8f}
#fl-login .fl-dk-list .fl-dk-sub{margin:0}
#fl-login .fl-dk-hint{font:600 13px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#cdbf9e;margin-top:10px}
#fl-login button.fl-wait,#fl-login button.fl-wait:hover,#fl-login button.fl-wait:active{color:#8c8170;background:linear-gradient(180deg,#24272c,#15171a);box-shadow:none;cursor:default;transform:none}
#fl-login .fl-dk-ask{font:700 14px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#f7dc8f;margin-top:10px}`;
  DK.CSS = CSS;
  let ui = null;
  function build() {
    if (ui) return ui;
    if (!hasDom()) return null;
    const card = document.querySelector('#fl-login .fl-card'); if (!card) return null;
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const btn = (cls, text, fn) => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', fn); return b; };
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    const u = { line: el('div', 'fl-dk-line'), root: el('div', 'fl-dk'), text: el('div', 'fl-line'), sub: el('div', 'fl-dk-sub'), list: el('div', 'fl-dk-list'), row: el('div', 'fl-row'), hint: el('div', 'fl-dk-hint'), ask: el('div', 'fl-dk-ask'), crow: el('div', 'fl-row') };
    u.yes = btn(null, 'Yes, bring it', () => DK.yes());
    u.fresh = btn('fl-dim', 'Start fresh', () => DK.fresh());
    u.confirm = btn('fl-dim', 'Yes, start fresh', () => DK.confirmFresh());
    u.back = btn(null, 'Go back', () => DK.cancelFresh());
    u.row.append(u.yes, u.fresh); u.crow.append(u.confirm, u.back);
    u.root.append(u.text, u.sub, u.list, u.row, u.hint, u.ask, u.crow);
    // any press on the offer while the question waits starts the wait again (a burst never reaches "Yes, start fresh")
    u.root.addEventListener('pointerdown', () => DK.press(), true);
    const status = card.querySelector('.fl-status');
    card.insertBefore(u.line, status); card.insertBefore(u.root, status);
    ui = u; return u;
  }
  DK.ui = () => ui;
  function paint() {
    const m = L.mode, lineText = L.showing && (m === 'form' || m === 'me') ? DK.line() : '';
    const offer = L.showing && m === 'device' && DK.list.length > 0;
    const u = (lineText || offer) ? build() : ui; if (!u) return;
    u.line.textContent = lineText; u.line.hidden = !lineText;
    u.root.hidden = !offer; if (!offer) return;
    const one = DK.list.length === 1;
    u.text.textContent = DK.words();
    u.sub.textContent = one ? (DK.detail(DK.list[0]) + '. ' + DK.already(DK.list[0])).trim() : ''; u.sub.hidden = !one;
    u.list.hidden = one; u.list.textContent = '';
    if (!one) DK.list.forEach((k, i) => {
      const b = document.createElement('button'); b.type = 'button';
      const nm = document.createElement('span'); nm.className = 'fl-dk-name'; nm.textContent = k.device ? `Slot ${k.slot} · Level ${k.level}` : `The old address · Level ${k.level}`;
      const sb = document.createElement('span'); sb.className = 'fl-dk-sub'; sb.textContent = DK.detail(k);
      b.append(nm, sb);
      if (DK.already(k)) { const al = document.createElement('span'); al.className = 'fl-dk-sub'; al.textContent = DK.already(k); b.append(al); }
      b.setAttribute('aria-label', `Bring ${nameOf(k)} into your account`);
      b.addEventListener('click', () => DK.pick(i));
      u.list.appendChild(b);
    });
    u.yes.hidden = !one;
    u.fresh.disabled = DK.armed;
    u.hint.textContent = DK.hint(); u.hint.hidden = DK.armed;
    u.ask.textContent = DK.question(); u.ask.hidden = !DK.armed; u.crow.hidden = !DK.armed;
    // "Yes, start fresh" looks greyed out until it takes a tap (not disabled: a tap on it while it waits starts the wait again)
    const live = ready(); u.confirm.classList.toggle('fl-wait', !live); u.confirm.setAttribute('aria-disabled', live ? 'false' : 'true');
    if (DK.armed && !live && hasDom() && !timer) timer = setTimeout(() => { timer = null; paint(); }, Math.max(50, (CONFIRM_SECS - (DK.clock() - DK.armedAt)) * 1000 + 40));
  }
  let timer = null;
  DK.paint = paint;
  L.afterRefresh = paint;

  // ---------- self-test ----------
  const P = 'deviceknights: ';
  HOOKS.selfTest.push((check, F, h) => {
    if (!title.active) save();
    const ALL = []; for (let n = 1; n <= L.PARK_MAX; n++) ALL.push(n);
    const KEYS = [L.MARK_KEY, BROUGHT_KEY, 'fanglands.lastname', 'fanglands.slot.current', SAVE_KEY];
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, status: NET.status, slot: title.slot, titleActive: title.active, showing: L.showing, playing: L.playing, name: L.name,
      slots: ALL.map(n => [lsGet(SLOT(n)), lsGet(AT(n))]), keys: KEYS.map(k => lsGet(k)), paused, notice, askOld: DK.askOld, clock: DK.clock, view: DK.testView };
    const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { } };
    const clearAll = () => { for (const n of ALL) { lsDel(SLOT(n)); lsDel(AT(n)); } lsDel(L.MARK_KEY); lsDel(BROUGHT_KEY); };
    const base = JSON.parse(lsGet(SLOT(title.slot)) || lsGet(SAVE_KEY) || '{"player":{},"quest":{}}'); base.player = base.player || {};
    const knight = (kills, stage, secs) => { const d = JSON.parse(JSON.stringify(base)); d.player.kills = kills; d.player.playSeconds = secs; d.quest = Object.assign({}, d.quest, { stage }); return JSON.stringify(d); };
    const put = (n, raw, at) => { lsSet(SLOT(n), raw); lsSet(AT(n), at); };
    const slotsNow = () => ALL.map(n => lsGet(SLOT(n)) + '@' + lsGet(AT(n))).join('|');
    const kills = raw => { try { return JSON.parse(raw).player.kills; } catch (e) { return null; } };
    const cloudKnight = knight(42, 9, 7200);
    // a small world that answers on the spot: Cohen (sword) has a cloud save; the invite code is 'dragon'
    const world = {
      accounts: { cohen: 'sword' }, names: { cohen: 'Cohen' }, saves: { cohen: cloudKnight }, puts: [],
      call(method, path, body, token) {
        const fail = (code, status) => { const e = new Error(code); e.code = code; e.status = status; throw e; };
        const key = token && token.startsWith('tok-') ? token.slice(4) : null;
        if (path === '/api/status') return { ok: true, online: 1, names: ['Cohen'] };
        if (path === '/api/login') { const k = String(body.name).toLowerCase(); if (!(k in world.accounts)) fail('unknown', 404); if (world.accounts[k] !== body.pass) fail('pass', 401); return { token: 'tok-' + k, name: world.names[k] }; }
        if (path === '/api/signup') { const k = String(body.name).toLowerCase(); if (body.invite !== 'dragon') fail('invite', 403); if (k in world.accounts) fail('taken', 409); world.accounts[k] = body.pass; world.names[k] = body.name; return { token: 'tok-' + k, name: body.name }; }
        if (!key) fail('auth', 401);
        if (path === '/api/me') return { name: world.names[key] };
        if (path === '/api/save' && method === 'GET') return { save: world.saves[key] || null, at: 5 };
        if (path === '/api/save' && method === 'PUT') { world.puts.push([key, body]); world.saves[key] = body; return { at: 6 }; }
        if (path === '/api/logout') return { ok: true };
        fail('bad', 400);
      },
      open: () => { const s = { readyState: 1, send(str) { const m = JSON.parse(str); if (m.t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: L.name, at: 1, keeper: L.name }) }); }, close() { s.readyState = 3; if (s.onclose) s.onclose(); } }; return s; },
    };
    let now = 100; DK.clock = () => now;
    const out = () => { if (L.playing) L.logout(); L.notMe(); };
    const A = knight(21, 6, 3840), B = knight(1, 0, 90), C = knight(2, 3, 600);
    try {
      NET.enabled = true; NET.useFake(world); NET.setToken(null); L.playing = false; if (window.CLOUD) window.CLOUD.reset();
      DK.testView = true; clearAll(); DK.askOld = was.askOld;

      // 1. NAMED: a knight no account owns is named on the form and on the "Playing as" card, in one plain line
      put(1, cloudKnight, 1); lsSet(L.MARK_KEY, '1'); put(2, A, 500);
      title.open(); render();
      const lv = L.summarizeRaw(A).level;
      const want1 = `This device has a knight saved on it: Slot 2 (level ${lv}). It is safe here. Make a new knight with Ethan's invite code to bring it with you.`;
      const onForm = L.mode === 'form' && DK.line() === want1;
      NET.setToken('tok-cohen'); L.show(); const onMe = L.mode === 'me' && DK.line() === want1; NET.setToken(null); L.show();
      put(3, C, 600); const two = DK.line();
      const want2 = `This device has 2 knights saved on it: Slot 2 (level ${lv}) and Slot 3 (level ${L.summarizeRaw(C).level}). They are safe here. Make a new knight with Ethan's invite code to bring one with you.`;
      lsDel(SLOT(3)); lsDel(AT(3));
      check(P + 'a knight saved on this device that no account owns is named on the login form and the "Playing as" card in one plain line (slot 1 with the cloud mark is an account\'s, never named)', onForm && onMe && two === want2 && !buttons.some(b => /^Slot \d|^Continue/.test(b.label)), { onForm, onMe, line: DK.line(), two });

      // 2. OFFERED to a new account (empty cloud): plain words, Yes / Start fresh, nothing sent yet
      L.submit('Ann', 'castle', 'dragon', true);
      const words = DK.words();
      check(P + 'a new account with an empty cloud is offered the knight: its slot and level, Yes / Start fresh, nothing sent and nothing written yet', L.mode === 'device' && DK.list.length === 1 && DK.list[0].slot === 2 && words === `This device has a knight saved on it: Slot 2 (level ${lv}). Bring it into your account?` && DK.detail(DK.list[0]).startsWith('Chapter 2: Thistledown') && /played 1h 4m$/.test(DK.detail(DK.list[0])) && !L.playing && world.puts.length === 0 && title.active && lsGet(SLOT(2)) === A, { mode: L.mode, words, detail: DK.list[0] && DK.detail(DK.list[0]) });
      const yes = DK.yes();
      check(P + 'Yes brings it in the way the old address does: slot 1 holds it with the cloud mark, it is the game, that exact string went up at once, and it is still in slot 2', yes && L.playing && !title.active && player.kills === 21 && quest.stage === 6 && world.puts.length === 1 && world.puts[0][0] === 'ann' && world.puts[0][1] === A && lsGet(SLOT(1)) === A && lsGet(L.MARK_KEY) === '1' && lsGet(SLOT(2)) === A && lsGet(AT(2)) === '500' && NET.status === 'on', { yes, kills: player.kills, puts: world.puts.length });
      // brother and sister on one iPad: a knight one account brought in stays on the device, and every other new account is
      // still offered it (with a line saying who brought it in already); only the account that brought it no longer sees it
      out(); const offered = DK.stats.offered;
      const formAfter = DK.line() === want1;
      L.submit('Bea', 'castle', 'dragon', true);
      const bea = { mode: L.mode, n: DK.list.length, slot: DK.list[0] && DK.list[0].slot, already: DK.already(DK.list[0]), offered: DK.stats.offered - offered };
      const beaYes = DK.yes();
      out(); NET.setToken('tok-ann'); L.name = 'Ann'; L.mode = 'me'; const annLine = DK.line(); NET.setToken(null); L.name = null; L.mode = 'form';
      check(P + 'a knight Ann brought in stays on the device and is still named on the form; Bea (a new account) is offered it with "Ann brought this knight into an account already. You can bring it too." and brings it in too; Ann\'s own "Playing as" no longer names it', formAfter && bea.mode === 'device' && bea.n === 1 && bea.slot === 2 && bea.already === 'Ann brought this knight into an account already. You can bring it too.' && bea.offered === 1 && beaYes && kills(world.saves.bea) === 21 && lsGet(SLOT(2)) === A && annLine === '' && JSON.parse(lsGet(BROUGHT_KEY))[fp(A)].join() === 'Ann,Bea', { formAfter, bea, beaYes, annLine, brought: lsGet(BROUGHT_KEY) });

      // 3. several: the kid picks one card; a knight in slot 1 is moved to an empty slot before it is brought
      out(); clearAll(); put(1, B, 900); put(2, C, 700);
      L.submit('Cal', 'castle', 'dragon', true);
      const order = DK.list.map(k => k.slot).join(), words3 = DK.words(), noYes = DK.yes() === false;
      const picked = DK.pick(0);
      check(P + 'several knights give a card each to pick (Yes alone picks nothing); picking the one in slot 1 brings it, and it is first moved to slot 3, so every knight is still on this device', order === '1,2' && words3 === 'This device has 2 knights saved on it. Tap the one to bring into your account.' && noYes && picked && L.playing && player.kills === 1 && world.saves.cal === B && lsGet(SLOT(1)) === B && lsGet(L.MARK_KEY) === '1' && lsGet(SLOT(3)) === B && lsGet(AT(3)) === '900' && lsGet(SLOT(2)) === C, { order, words3, picked, slot3: kills(lsGet(SLOT(3))) });

      // 4. Start fresh: a double tap or a burst of taps never passes the question
      out(); lsDel(BROUGHT_KEY); const before4 = slotsNow();
      L.submit('Dee', 'castle', 'dragon', true);
      const listed = DK.list.length;
      now = 200; const t1 = DK.fresh(), t2 = DK.fresh();
      const burst = []; for (let i = 0; i < 12; i++) { now += 0.1; burst.push(DK.fresh() || DK.confirmFresh()); }
      const held = L.mode === 'device' && DK.armed && !L.playing && !world.saves.dee;
      const back = DK.cancelFresh() && !DK.armed && L.mode === 'device';
      now = 300; DK.fresh(); now = 300.79; const early = DK.confirmFresh(); now = 301.2; const pressedAgain = DK.confirmFresh(); now = 302.1; const late = DK.confirmFresh();
      check(P + 'Start fresh asks first: a double tap, a 1.2 s burst of taps and a tap before 0.8 s never start fresh (each press starts the wait again); Go back returns; a tap after a 0.8 s pause makes a new knight and pushes it; every device knight stays', listed === 2 && t1 === false && t2 === false && burst.every(v => v === false) && held && back && early === false && pressedAgain === false && late === true && L.playing && player.kills === 0 && kills(world.saves.dee) === 0 && slotsNow().split('|').slice(1).join() === before4.split('|').slice(1).join() && lsGet(SLOT(3)) === B && lsGet(SLOT(2)) === C, { listed, t1, t2, burst, held, back, early, pressedAgain, late });

      // 5. KEPT, and never stuck: with slots 1, 2 and 3 all holding knights no account owns, every start path moves the one in
      //    slot 1 to slot 4 first and starts; every knight is still on this device. Only a device with no empty slot up to
      //    PARK_MAX, or storage that refuses the write, stops the start (and says so; nothing written, nothing sent).
      const full3 = () => { out(); clearAll(); put(1, B, 901); put(2, C, 902); put(3, A, 903); };
      const kept3 = () => lsGet(SLOT(4)) === B && lsGet(AT(4)) === '901' && lsGet(SLOT(2)) === C && lsGet(AT(2)) === '902' && lsGet(SLOT(3)) === A && lsGet(AT(3)) === '903';
      full3(); L.submit('Cohen', 'sword', '', false);
      const login5 = { playing: L.playing, kills: player.kills, slot1: lsGet(SLOT(1)) === cloudKnight, kept: kept3() };
      full3(); L.submit('Eve', 'castle', 'dragon', true); const offer5 = DK.list.map(k => k.slot).join();
      now = 400; DK.fresh(); now = 401; const fresh5 = DK.confirmFresh();
      const fresh5s = { ok: fresh5, playing: L.playing, kills: player.kills, mark: lsGet(L.MARK_KEY) === '1', kept: kept3() };
      full3(); L.submit('Fay', 'castle', 'dragon', true); const pick5 = DK.pick(1);
      const pick5s = { ok: pick5, playing: L.playing, kills: player.kills, cloud: world.saves.fay === C, slot1: lsGet(SLOT(1)) === C, kept: kept3() };
      full3(); L.submit('Gus', 'castle', 'dragon', true); const pick1 = DK.pick(0);
      const pick1s = { ok: pick1, playing: L.playing, kills: player.kills, cloud: world.saves.gus === B, kept: kept3() };
      full3(); const reload5 = L.reload(cloudKnight, 5) === true && lsGet(SLOT(1)) === cloudKnight && kept3();
      check(P + 'with slots 1, 2 and 3 all holding knights no account owns, a login with a cloud save, Start fresh, a pick (slot 2, and slot 1 itself) and Put my knight back each start, the knight in slot 1 first moved to slot 4, every knight still on this device', login5.playing && login5.kills === 42 && login5.slot1 && login5.kept && offer5 === '1,2,3' && fresh5s.ok && fresh5s.playing && fresh5s.kills === 0 && fresh5s.mark && fresh5s.kept && pick5s.ok && pick5s.playing && pick5s.kills === 2 && pick5s.cloud && pick5s.slot1 && pick5s.kept && pick1s.ok && pick1s.playing && pick1s.kills === 1 && pick1s.cloud && pick1s.kept && reload5 && DEVKNIGHTS.PARK_MAX === L.PARK_MAX && L.PARK_MAX >= 6, { login5, offer5, fresh5s, pick5s, pick1s, reload5 });
      // no empty slot up to PARK_MAX at all, then storage that refuses the move: the start stops in plain words, nothing changes
      out(); clearAll(); title.open(); for (const n of ALL) put(n, knight(100 + n, 1, n), 1000 + n); const fullAll = slotsNow(), puts5 = world.puts.length;
      L.submit('Cohen', 'sword', '', false);
      const none5 = { mode: L.mode, error: L.error, playing: L.playing, same: slotsNow() === fullAll, puts: world.puts.length - puts5, title: title.active };
      L.notMe(); clearAll(); put(1, B, 901); put(2, C, 902); const two5 = slotsNow();
      const S = typeof Storage !== 'undefined' && localStorage instanceof Storage ? Storage.prototype : localStorage, realSet = S.setItem;
      S.setItem = function (k, v) { if (/^fanglands\.slot\.[2-9]\d*$/.test(k)) { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; } return realSet.call(this, k, v); };
      let refused;
      try { L.submit('Cohen', 'sword', '', false); refused = { mode: L.mode, error: L.error, playing: L.playing, same: slotsNow() === two5, puts: world.puts.length - puts5 }; }
      finally { S.setItem = realSet; }
      check(P + 'only with no empty slot up to PARK_MAX, or storage refusing the move, does a start stop: the card says so in plain words, nothing is written and nothing is sent', none5.mode === 'me' && none5.error === L.NO_ROOM && !none5.playing && none5.same && none5.puts === 0 && none5.title && refused.mode === 'me' && refused.error === L.NO_ROOM && !refused.playing && refused.same && refused.puts === 0 && /did not start/.test(L.NO_ROOM) && /still here/.test(L.NO_ROOM), { none5, refused });
      L.notMe(); lsDel(SLOT(3)); lsDel(AT(3)); const before5 = lsGet(SLOT(1));
      L.submit('Cohen', 'sword', '', false);
      check(P + 'with room, a login with a cloud save moves the knight in slot 1 to an empty slot first, then loads the cloud knight', L.playing && player.kills === 42 && lsGet(SLOT(1)) === cloudKnight && lsGet(SLOT(3)) === before5 && lsGet(AT(3)) === '901' && lsGet(SLOT(2)) === C, { kills: player.kills, slot3: kills(lsGet(SLOT(3))) });

      // 6. while the self-test runs, another file's sign-up sees no device knights unless its test asks to
      out(); clearAll(); lsSet(L.MARK_KEY, '1'); put(1, cloudKnight, 1); put(2, A, 2); put(3, C, 3);
      DK.testView = false; const inTest = DK.inSelfTest, line6 = DK.line(), offered6 = DK.stats.offered;
      L.submit('Mia', 'castle', 'dragon', true);
      const mia = { inTest, line: line6, offered: DK.stats.offered - offered6, playing: L.playing, cloud: kills(world.saves.mia), kept: lsGet(SLOT(2)) === A && lsGet(SLOT(3)) === C };
      DK.testView = true;
      check(P + 'during a self-test run another file\'s sign-up (Mia, an empty cloud, knights in slots 2 and 3) is not offered them and starts fresh; the knights stay', mia.inTest === true && mia.line === '' && mia.offered === 0 && mia.playing && mia.cloud === 0 && mia.kept, mia);

      // 7. offline (no NET) the title keeps its three slots and nothing is named or offered
      out(); L.hide(); NET.enabled = false; clearAll(); put(2, C, 700);
      title.open(); render();
      const slotsUp = !L.showing && title.active && ['Slot 1', 'Slot 2', 'Slot 3', 'Continue'].every(l => buttons.some(b => b.label === l)) && DK.find().length === 0;
      title.continue();
      check(P + 'offline the title keeps its three slots: Continue plays the knight in slot 2, nothing named or offered', slotsUp && !title.active && title.slot === 2 && player.kills === 2, { slotsUp, slot: title.slot, kills: player.kills });

      // 8. on the card in a browser: the line shows on the form and on "Playing as"; the cards and buttons are 44 px and up;
      //    after Start fresh nothing moves and a burst of real taps where it was never reaches "Yes, start fresh"
      { const css = /min-height:56px/.test(CSS);
        let live = 'no DOM';
        if (hasDom()) {
          NET.enabled = true; clearAll(); lsSet(L.MARK_KEY, '1'); put(1, cloudKnight, 1); put(2, A, 2); title.open();
          const vis = e => e.offsetParent !== null;
          const lineOn = () => { const e = document.querySelector('#fl-login .fl-dk-line'); return !!e && vis(e) && e.textContent === DK.line(); };
          const formLine = L.mode === 'form' && lineOn();
          NET.setToken('tok-cohen'); L.name = 'Cohen'; L.mode = 'me'; L.refresh(); const meLine = lineOn();
          const offerUp = n => { if (n > 1) put(3, C, 3); else { lsDel(SLOT(3)); lsDel(AT(3)); } DK.askOld = cb => cb(null); L.mode = 'busy'; L.refresh(); L.bridge.ask(() => { }); };
          const hs = () => [...document.querySelectorAll('#fl-login .fl-card button')].filter(vis).map(e => Math.round(e.getBoundingClientRect().height));
          offerUp(2); const many = hs(); offerUp(1); const one = hs();
          const u = DK.ui(), r0 = u.fresh.getBoundingClientRect(), x = r0.left + r0.width / 2, y = r0.top + r0.height / 2;
          now = 700; u.fresh.click(); const moved = u.fresh.getBoundingClientRect().top !== r0.top, greyed = u.fresh.disabled;
          const hit = []; for (let i = 0; i < 8; i++) { now += 0.15; const e = document.elementFromPoint(x, y); hit.push(e === u.confirm || u.confirm.contains(e) ? 'CONFIRM' : (e && e.tagName) || null); if (e) { e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); e.click(); } }
          const under = u.confirm.getBoundingClientRect().top >= r0.bottom;
          // a burst of real taps on "Yes, start fresh" itself: each one starts the wait again, so none passes
          const cr = u.confirm.getBoundingClientRect(), cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
          for (let i = 0; i < 8; i++) { now += 0.3; const e = document.elementFromPoint(cx, cy); if (e) { e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); e.click(); } }
          DK.paint(); const dead = L.mode === 'device' && !L.playing && u.confirm.classList.contains('fl-wait');
          now += 0.9; DK.paint(); const liveAfter = DK.ready() && !u.confirm.classList.contains('fl-wait');
          live = { formLine, meLine, many, one, moved, greyed, hit, dead, under, liveAfter };
          live.ok = formLine && meLine && many.length === 3 && one.length === 2 && many.concat(one).every(v => v >= 44) && !moved && greyed && !hit.includes('CONFIRM') && dead && under && liveAfter;
          live = live.ok ? true : live;
          DK.cancelFresh(); DK.askOld = was.askOld; DK.list = []; L.mode = 'form'; NET.setToken(null); L.name = null; L.refresh();
        }
        check(P + 'on the card: the line shows under the form and on "Playing as"; the knight cards, Yes and Start fresh are at least 44 px; after Start fresh nothing moves and a burst of real taps where it was, or on "Yes, start fresh" itself (under it), never starts fresh; after a pause it is live', css && (live === true || live === 'no DOM'), { css, live }); }
    } finally {
      L.hide(); L.bridge.done(); NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.setToken(was.token); NET.status = 'off'; NET.me = null;
      DK.askOld = was.askOld; DK.clock = was.clock; DK.testView = was.view; DK.list = []; DK.armed = false; DK.pending = null;
      L.playing = was.playing; L.name = was.name; L.error = ''; L.offer = null; L.busy = false; L.mode = 'form'; paint();
      for (const n of ALL) { const [s, a] = was.slots[n - 1]; if (s == null) { lsDel(SLOT(n)); lsDel(AT(n)); } else { lsSet(SLOT(n), s); lsSet(AT(n), a || Date.now()); } }
      KEYS.forEach((k, i) => { if (was.keys[i] == null) lsDel(k); else lsSet(k, was.keys[i]); });
      if (window.CLOUD) window.CLOUD.reset();
      if (was.titleActive) { title.open(); if (was.showing) L.show(); } else title.startSlot(was.slot);
      paused = was.paused; notice = was.notice;
      if (was.status === 'on' && NET.token) NET.connect();
    }
  });
}
