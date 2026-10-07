// ============================================================================
// TEACHERS IN THE GAME — the owner's own knight makes and looks after teacher sign-ins from the Admin panel
// Owner (7 Oct 2026): "My understanding was that under my mud goal profile I could create the teacher in game in the
// settings. Is that not the case? Do you have the controls on a subdomain don't you? Can you not put them in my admin tab
// in game?" docs/ONLINE.md, "The teacher view", "Teachers in the game", is the contract.
//
// One more tab in 76-admin's panel (ADMIN.addTab, after Accounts), there ONLY for an owner's knight: the world says who that
// is (an admin named in OWNER_KNIGHTS, online/wrangler.toml) by answering GET /api/owner/teachers, and checks it again on
// every call. A kid or another admin never sees the tab, and the world refuses them anyway (403 admin / 403 owner): this file
// hiding the tab is a convenience, never the lock. Everything /admin's Teachers section does, with /admin's own words:
//   A. the list: each teacher's name, when added, last signed in, watching now, actions today, wrong tries today, and
//      whether a sign-in waits on that name; New password, Turn off / Turn on, Lift the wait
//   B. Add teacher: a name box, a password box, Make one up, Add teacher (Enter in either box adds); the same refusals as
//      /admin ("Not added. ..." in bold red, saying what to type instead); the password is shown ONCE, with Copy
//   C. today's teacher actions still in force, each with Undo; the "Tell players when a teacher is watching" switch
// The section is real page elements (inputs, buttons, a scrolling list) laid over the panel's page while the tab is drawn,
// built with createElement and textContent only (no HTML from anywhere), the way 79-teacherscreen builds the teacher screen.
// While one of its boxes has the keyboard no key reaches the game (78-accounts' guard). A new password lives only in this
// tab's memory while it is on screen: never localStorage, a cookie, a URL or a log; leaving the tab forgets it.
// Wraps by reassignment, with explicit arguments: drawPanels (the section shows only while its tab is drawn). HOOKS
// otherwise. window.OWNERTEACHERS is the register.
// ============================================================================
{
  const PATH = '/api/owner/teachers';
  const PASS_MIN = 10, PASS_MAX = 200, NAME_MAX = 40;   // online/src/teachers.js TEACHER_PASS_MIN / MAX (the world checks them too)
  const REFRESH_EVERY = 30000;                          // ms between refreshes while the tab is open (watching now changes)
  const ASK_AGAIN = 15000;                              // ms before asking again whether this knight is an owner, after no answer
  const GOLD = '#f5c542', INK = '#e6edf3', DIM = '#b1b8c3', RED = '#ff8f8f', GREEN = '#56d364', AMBER = '#ffb86b';
  // a password made here, on this page: three plain words and two digits ("maple-river-lantern-42"), /admin's own list
  const WORDS = ('apple acorn amber anchor arrow aspen autumn badge bakery banjo barley basket beacon beaver berry birch biscuit blanket blossom bluebird boat bonnet border boulder bramble breeze brick bridge brook bucket buffalo bundle burrow butter button cabin cactus camel candle canoe canyon captain carrot castle cedar cello cherry chestnut cider circle clover cobble comet compass copper coral cotton cougar cradle crane cricket crystal cupcake daisy dawn delta desert dolphin donkey dragon drift drum eagle echo ember falcon feather fern fiddle field finch flannel forest fossil fountain fox garden garnet gecko ginger glacier globe gopher granite grove gull harbour harvest hazel heron hickory hill honey horizon icicle island ivory jacket jasper juniper kayak kettle kite koala ladder lagoon lantern lemon lichen lilac linen lizard lobster maple marble meadow mitten moose moss mountain muffin nectar nutmeg oak oasis ocean olive orbit orchard otter owl paddle panda pebble pepper pickle pigeon pine planet plum pocket pony prairie pumpkin quail quilt rabbit raccoon rainbow raven reef ribbon river robin rocket saddle salmon sapphire scarf shell shore sparrow spruce squirrel star stone summit sunrise swan teapot thistle thunder tiger timber tulip tunnel turtle valley velvet violet walnut walrus whistle willow window winter wren yarrow zebra').split(' ');
  // the address a teacher made on THIS world signs in at (/admin's own table): a teacher belongs to one world
  const SITES = { 'fanglands.com': 'fanglands.com', 'www.fanglands.com': 'fanglands.com', 'gorkscape.ca': 'fanglands.com', 'www.gorkscape.ca': 'fanglands.com', 'test.fanglands.com': 'test.fanglands.com', 'test.gorkscape.ca': 'test.fanglands.com' };
  const site = () => { const h = String((typeof location !== 'undefined' && location && location.host) || '').toLowerCase(); return SITES[h] || h || 'fanglands.com'; };
  const worldWords = s => s === 'fanglands.com' ? "These are the MAIN world's teachers (fanglands.com, also gorkscape.ca). A teacher added on the test world cannot sign in here."
    : s === 'test.fanglands.com' ? "These are the TEST world's teachers: they sign in at test.fanglands.com only, never at fanglands.com. For school, add the teacher on the main world."
    : "These are this world's teachers (" + s + '): they sign in at ' + s + ' only.';

  const S = {
    owner: undefined,     // undefined = not asked yet (or no answer); true = the world said this knight is an owner; false = not
    data: null,           // the world's answer, cleaned: { teachers: [...], acts: [...], notice }
    at: 0, loading: false, error: null, askedAt: -1e9, asks: 0,
    busy: null,           // the call that is out: 'add' | 'pass:<id>' | 'off:<id>' | 'on:<id>' | 'lift:<id>' | 'undo:<id>' | 'notice'
    said: null,           // { text, bad, copy }: what the last tap did; copy = the sign-in words the Copy button copies (a new password, once)
    copied: false,        // the Copy button said Copied
    name: '', pass: '',   // the two boxes
    ver: 0,               // bumped on every change the section shows
    want: null,           // the rect the tab was drawn in this frame
    stats: { asks: 0, posts: 0 },
  };
  const isAdmin = () => !!(window.ADMIN && ADMIN.is());
  const tabOpen = () => isAdmin() && S.owner === true && panel === 'admin' && ADMIN.state.tab === 'teachers';
  const dirty = () => { S.ver++; };

  // ---------- calls to /api, the way 76-admin and 78-accounts make them: a fake may answer on the spot ----------
  const api = (method, path, body) => {
    try { return NET.fake ? NET.fake.call(method, path, body, NET.token) : NET.call(method, path, body); }
    catch (e) { return { __threw: e || new Error('failed') }; }
  };
  const when = (v, ok, bad) => {
    if (v && typeof v.then === 'function') { v.then(ok, bad).catch(e => console.error('owner teachers', e)); return; }
    if (v && v.__threw) bad(v.__threw); else ok(v);
  };

  // ---------- plain words ----------
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const clockWords = ms => { const d = new Date(ms), h = d.getHours(); return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
  // "10:52 am" today, "Tue 6 Oct, 10:52 am" another day (with the year when it is not this one)
  const whenWords = ms => {
    const d = new Date(ms), now = new Date();
    if (d.toDateString() === now.toDateString()) return 'today, ' + clockWords(ms);
    return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}` + (d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : '') + ', ' + clockWords(ms);
  };
  // /admin's words for a teacher's action still in force
  const actWords = a => a.act === 'mute' ? a.teacher + ' muted ' + a.target + ' until ' + clockWords(a.until) : a.act === 'sendoff' ? a.teacher + ' sent ' + a.target + ' off until midnight' : a.teacher + ' paused chat for everyone until ' + clockWords(a.until);
  // a refusal from the world, in plain words (the Teachers calls already answer in the owner's words, /admin shows them as they are)
  const errWords = e => {
    const code = e && e.code;
    if (code === 'owner') return "Only the owner's knight can do that.";
    if (code === 'admin') return 'Only an admin can do that.';
    if (code === 'auth') return 'You are logged out. Log in again.';
    if (e && e.status) return String(e.message || 'That did not work. Try again.');
    return 'The world did not answer. Check the internet and try again.';
  };
  function makePassword() {
    const r = new Uint32Array(4);
    try { crypto.getRandomValues(r); } catch (e) { for (let i = 0; i < 4; i++) r[i] = Math.floor(Math.random() * 4294967296); }
    const w = i => WORDS[r[i] % WORDS.length];
    return w(0) + '-' + w(1) + '-' + w(2) + '-' + String(10 + r[3] % 90);
  }
  // what the teacher is told (the Copy button): the address, the name, the password, and what to press
  const copyWords = (name, pass) => 'Fanglands teacher sign-in. Go to ' + site() + ', type ' + name + " in Knight's name and " + pass + ' in Secret word, and press Play.';
  function say(text, bad, copy) { S.said = { text: String(text), bad: !!bad, copy: copy || null }; S.copied = false; dirty(); }

  // ---------- the world's answer, cleaned (a field of the wrong kind is dropped, never shown) ----------
  const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
  const count = v => Math.max(0, Math.floor(num(v) || 0));
  function cleanTeacher(t) {
    if (!t || !Number.isInteger(t.id) || typeof t.name !== 'string' || !t.name) return null;
    return { id: t.id, name: t.name.slice(0, NAME_MAX), created: num(t.created) || 0, lastLogin: num(t.lastLogin), off: !!t.off, watching: count(t.watching), actsToday: count(t.actsToday), wrongToday: count(t.wrongToday), waiting: count(t.waiting) };
  }
  function cleanAct(a) {
    if (!a || !Number.isInteger(a.id) || !['mute', 'sendoff', 'pause'].includes(a.act)) return null;
    return { id: a.id, at: num(a.at) || 0, teacher: String(a.teacher || '').slice(0, NAME_MAX), act: a.act, target: a.target == null ? '' : String(a.target).slice(0, NAME_MAX), until: num(a.until) || 0, inForce: !!a.inForce };
  }
  function clean(r) {
    if (!r || typeof r !== 'object' || !Array.isArray(r.teachers)) return null;
    return { teachers: r.teachers.map(cleanTeacher).filter(Boolean), acts: (Array.isArray(r.acts) ? r.acts : []).map(cleanAct).filter(Boolean), notice: r.notice === true };
  }

  // ---------- asking the world: the list, and whether this knight is an owner at all ----------
  // force: ask again even while an answer is on its way (the newest wins; one that never answers stops blocking after 20 s)
  function ask(force) {
    if (!isAdmin() || (S.loading && !force && nowMs() - S.askedAt < 20000)) return false;
    S.loading = true; S.askedAt = nowMs(); S.stats.asks++;
    const seq = ++S.asks;
    when(api('GET', PATH), r => {
      if (seq !== S.asks) return;
      S.loading = false;
      const d = clean(r);
      if (!d) { if (S.owner !== true) S.owner = false; S.error = 'bad'; dirty(); return; }
      S.owner = true; S.data = d; S.at = nowMs(); S.error = null; dirty();
    }, e => {
      if (seq !== S.asks) return;
      S.loading = false;
      const code = e && e.code;
      // the world says no (a kid, another admin, logged out) or has no such call (an older world): no tab
      if (code === 'owner' || code === 'admin' || code === 'auth' || (e && e.status === 404)) { S.owner = false; S.data = null; S.said = null; }
      S.error = code || (e && e.status ? 'http' : 'down'); dirty();
    });
    return true;
  }
  const refresh = () => ask(true);
  const find = id => ((S.data && S.data.teachers) || []).find(t => t.id === id) || null;

  // ---------- A. the teacher's buttons (every one is /admin's call with /admin's words) ----------
  // one call at a time; the answer in words; the list asked again after every one
  function post(path, body, key, ok) {
    if (S.owner !== true || S.busy) return false;
    S.busy = key; S.stats.posts++; dirty();
    when(api('POST', PATH + path, body), r => { S.busy = null; ok(r); sfx('ui'); refresh(); }, e => {
      S.busy = null; say(errWords(e), true);
      if (e && (e.code === 'owner' || e.code === 'admin' || e.code === 'auth')) refresh();
    });
    return true;
  }
  // New password and Turn off ask a second tap first (no confirm(): the game's own Tap again)
  function newPassword(id, sure) {
    const t = find(id); if (!t) return false;
    if (!sure && !confirmTap('teach:pass:' + id, () => { })) { say('Tap again to give ' + t.name + ' a new password. Their screens close now, and the old password stops working.'); return false; }
    const pass = makePassword();
    return post('/pass', { id, pass }, 'pass:' + id, () => say(t.name + "'s new password is " + pass + '. Give it to them. It is not shown again.', false, copyWords(t.name, pass)));
  }
  function turnOff(id, sure) {
    const t = find(id); if (!t) return false;
    if (!sure && !confirmTap('teach:off:' + id, () => { })) { say('Tap again to turn off ' + t.name + '. Every screen of theirs closes now and they cannot sign in until you turn them on again.'); return false; }
    return post('/off', { id }, 'off:' + id, () => say(t.name + ' is turned off.'));
  }
  function turnOn(id) {
    const t = find(id); if (!t) return false;
    const pass = makePassword();
    return post('/on', { id, pass }, 'on:' + id, () => say(t.name + ' is on again with a new password: ' + pass + '. Give it to them. It is not shown again.', false, copyWords(t.name, pass)));
  }
  function lift(id) {
    const t = find(id); if (!t) return false;
    return post('/lift', { id }, 'lift:' + id, () => say(t.name + ' can sign in again now, with the same password.'));
  }
  // C. Undo, and the notice switch
  function undo(actId) {
    const a = ((S.data && S.data.acts) || []).find(x => x.id === actId); if (!a) return false;
    const words = actWords(a);
    return post('/undo', { act: actId }, 'undo:' + actId, () => say('Undone: ' + words + '.'));
  }
  function setNotice(on) {
    if (!S.data) return false;
    return post('/notice', { on: !!on }, 'notice', () => say('Tell players when a teacher is watching: ' + (on ? 'On' : 'Off') + '.'));
  }

  // ---------- B. Add teacher ----------
  function setName(v) { S.name = String(v == null ? '' : v).slice(0, NAME_MAX); if (ui && ui.name.value !== S.name) ui.name.value = S.name; }
  function setPass(v) { S.pass = String(v == null ? '' : v).slice(0, PASS_MAX); if (ui && ui.pass.value !== S.pass) ui.pass.value = S.pass; }
  function makeOneUp() { setPass(makePassword()); dirty(); return S.pass; }
  function add() {
    if (S.owner !== true || S.busy) return false;
    const name0 = S.name.replace(/\s+/g, ' ').trim(), pass = S.pass;
    // refused here first, as on /admin: nothing is sent, and the words say what to type instead
    if (!name0) { say("Not added. Type the teacher's name first, like Mrs Smith.", true); focusBox('name'); return false; }
    if (!pass) { say('Not added. Type a password of at least ' + PASS_MIN + ' letters, or press Make one up.', true); focusBox('pass'); return false; }
    if (pass.length < PASS_MIN) { say('Not added. The password needs at least ' + PASS_MIN + ' letters (spaces count); this one has ' + pass.length + '. Type a longer one, or press Make one up.', true); focusBox('pass'); return false; }
    S.busy = 'add'; S.stats.posts++; say('Adding ' + name0 + '...');
    when(api('POST', PATH, { name: name0, pass }), r => {
      S.busy = null;
      // the world answers the name as it keeps it (a curly apostrophe made plain): that is the name the teacher types
      const name = (r && typeof r.name === 'string' && r.name) || name0;
      setName(''); setPass('');
      say('Added ' + name + '. The password is ' + pass + ' (it is not shown again). Tell ' + name + ': go to ' + site() + ', type ' + name + " in Knight's name and this password in Secret word, and press Play.", false, copyWords(name, pass));
      sfx('ui'); refresh();
    }, e => {
      S.busy = null;
      say('Not added. ' + (e && e.status ? errWords(e) : 'The world did not answer (' + ((e && e.message) || 'no answer') + '). Check the internet and press Add teacher again.'), true);
      if (e && e.code === 'pass') focusBox('pass'); else if (e && (e.code === 'name' || e.code === 'taken')) focusBox('name');
      if (e && (e.code === 'owner' || e.code === 'admin' || e.code === 'auth')) refresh();
    });
    return true;
  }
  // Copy: the sign-in words with the password, to paste into a message to the teacher
  function copy() {
    const c = S.said && S.said.copy; if (!c) return false;
    const done = () => { S.copied = true; dirty(); };
    const fallback = () => {
      try {
        const D = document, ta = D.createElement('textarea'); ta.value = c; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
        D.body.appendChild(ta); ta.select(); const ok = D.execCommand && D.execCommand('copy'); ta.remove(); if (ok) done(); else say('Could not copy. Write the password down from the line above.', true);
      } catch (e) { say('Could not copy. Write the password down from the line above.', true); }
    };
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(c).then(done, fallback); return true; }
    } catch (e) { }
    if (typeof document !== 'undefined' && document.body) fallback();
    return true;
  }

  // ---------- the section: real page elements over the panel's page ----------
  // Built on first use, only where there is a document body (tools/headless.js has none: there the tab draws its words on
  // the canvas, and the self-test drives the functions above). Every word goes in with textContent.
  let ui = null;
  const CSS = `
#fl-teachers{position:fixed;display:none;z-index:14;box-sizing:border-box;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:2px 6px 16px 2px;color:${INK};font:15px/1.4 "Trebuchet MS","Segoe UI",system-ui,sans-serif;background:rgba(33,26,19,0.96);border-radius:6px;}
#fl-teachers *{box-sizing:border-box;}
#fl-teachers p{margin:0 0 8px 0;}
#fl-teachers .dim{color:${DIM};font-size:14px;}
#fl-teachers .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px 0;}
#fl-teachers input{flex:1 1 190px;min-width:0;height:44px;margin:0;padding:0 12px;font:16px "Trebuchet MS","Segoe UI",system-ui,sans-serif;color:${INK};background:#0b0f14;border:1px solid ${GOLD};border-radius:8px;outline:none;-webkit-appearance:none;appearance:none;}
#fl-teachers input:focus{border-color:#ffe08a;box-shadow:0 0 0 2px rgba(245,197,66,0.35);}
#fl-teachers button{min-height:44px;min-width:44px;margin:0;padding:0 14px;font:bold 14px "Trebuchet MS","Segoe UI",system-ui,sans-serif;color:#fff;background:#21262d;border:1px solid rgba(255,255,255,0.18);border-radius:8px;cursor:pointer;white-space:nowrap;touch-action:manipulation;}
#fl-teachers button:disabled{opacity:0.5;cursor:default;}
#fl-teachers button.go{background:#238636;}
#fl-teachers button.blue{background:#1f4e78;}
#fl-teachers button.gold{background:#7a5a12;}
#fl-teachers button.danger{background:#8b2e2e;}
#fl-teachers button.armed{background:#c0392b;}
#fl-teachers .said{margin:0 0 12px 0;padding:10px 12px;border-radius:8px;background:rgba(255,255,255,0.06);color:#ffe2b8;}
#fl-teachers .said.bad{color:${RED};font-weight:700;background:rgba(248,81,73,0.12);border:1px solid rgba(248,81,73,0.45);}
#fl-teachers .said.pass{background:rgba(63,185,80,0.12);border:1px solid rgba(63,185,80,0.5);color:${INK};}
#fl-teachers .said .row{margin:8px 0 0 0;}
#fl-teachers h3{margin:14px 0 8px 0;font-size:14px;letter-spacing:0.06em;color:${GOLD};text-transform:uppercase;}
#fl-teachers .bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin:14px 0 8px 0;}
#fl-teachers .bar h3{margin:0;}
#fl-teachers .card{margin:0 0 10px 0;padding:10px 12px;border-radius:8px;background:rgba(255,255,255,0.06);}
#fl-teachers .card.off{background:rgba(248,81,73,0.08);}
#fl-teachers .name{font-weight:700;font-size:16px;color:${INK};margin:0 0 6px 0;overflow-wrap:anywhere;}
#fl-teachers .name .tag{font-weight:700;font-size:13px;color:${RED};margin-left:8px;}
#fl-teachers .facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:4px 14px;margin:0 0 8px 0;}
#fl-teachers .fact{font-size:14px;color:${DIM};}
#fl-teachers .fact b{display:block;font-size:14px;color:${INK};font-weight:600;}
#fl-teachers .fact b.warn{color:${AMBER};}
#fl-teachers .force{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin:0 0 8px 0;padding:8px 12px;border-radius:8px;background:rgba(255,255,255,0.06);}
#fl-teachers .force span{flex:1 1 220px;}
#fl-teachers .notice{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin:14px 0 0 0;padding:8px 12px;border-radius:8px;background:rgba(255,255,255,0.06);}
#fl-teachers .notice span{flex:1 1 220px;}
#fl-teachers .on{color:${GREEN};font-weight:700;}
`;
  function el(D, tag, cls, text) { const e = D.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = String(text); return e; }
  function btn(D, text, cls, fn, id) {
    const b = el(D, 'button', cls, text); b.type = 'button'; if (id) b.id = id;
    b.addEventListener('click', e => { e.preventDefault(); fn(); });
    return b;
  }
  function ensureUi() {
    if (ui !== null) return ui;
    if (typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function' || typeof document.body.appendChild !== 'function') { ui = false; return ui; }
    try {
      const D = document;
      const style = el(D, 'style'); style.id = 'fl-teachers-style'; style.textContent = CSS; (D.head || D.body).appendChild(style);
      const root = el(D, 'div'); root.id = 'fl-teachers'; root.setAttribute('role', 'region'); root.setAttribute('aria-label', 'Teachers');
      const intro = el(D, 'p', 'dim'); intro.id = 'flt-intro';
      const world = el(D, 'p', 'dim'); world.id = 'flt-world';
      const addRow = el(D, 'div', 'row');
      const name = el(D, 'input'); name.id = 'flt-name'; name.type = 'text'; name.placeholder = 'Name, like Mrs Smith'; name.maxLength = NAME_MAX;
      const pass = el(D, 'input'); pass.id = 'flt-pass'; pass.type = 'text'; pass.placeholder = 'Password (10 or more letters)'; pass.maxLength = PASS_MAX;
      for (const [i, cap, hint, label] of [[name, 'words', 'next', "The teacher's name"], [pass, 'none', 'done', "The teacher's password"]]) {
        i.autocomplete = 'off'; i.spellcheck = false; i.setAttribute('autocapitalize', cap); i.setAttribute('autocorrect', 'off'); i.setAttribute('enterkeyhint', hint); i.setAttribute('aria-label', label);
      }
      name.addEventListener('input', () => { S.name = String(name.value).slice(0, NAME_MAX); });
      pass.addEventListener('input', () => { S.pass = String(pass.value).slice(0, PASS_MAX); });
      const make = btn(D, 'Make one up', 'blue', () => { makeOneUp(); }, 'flt-make');
      const addB = btn(D, 'Add teacher', 'go', () => { add(); }, 'flt-add');
      const btnRow = el(D, 'div', 'row');
      addRow.append(name, pass); btnRow.append(make, addB);
      const said = el(D, 'div'); said.id = 'flt-said'; said.setAttribute('role', 'status'); said.setAttribute('aria-live', 'polite');
      const list = el(D, 'div'); list.id = 'flt-list';
      root.append(intro, world, addRow, btnRow, said, list);
      // the keyboard: while a box (or a button) here has it, no key reaches the game (05-input listens on window in the bubble
      // phase; this listens in the capture phase and stops the event there, 78-accounts' guard). Enter in a box adds;
      // Escape lets go of the keyboard.
      const guard = e => {
        const a = D.activeElement; if (!a || !root.contains(a)) return;
        if (e.type === 'keydown' && (a === name || a === pass)) {
          if (e.key === 'Enter') { e.preventDefault(); add(); }
          else if (e.key === 'Escape') { e.preventDefault(); try { a.blur(); } catch (x) { } }
        }
        e.stopPropagation(); if (typeof keys !== 'undefined' && keys && keys.clear) keys.clear();
      };
      for (const t of ['keydown', 'keyup', 'keypress']) window.addEventListener(t, guard, true);
      D.body.appendChild(root);
      ui = { D, root, intro, world, name, pass, make, add: addB, said, list, shown: false, key: '', drawn: -1 };
    } catch (e) { ui = false; }
    return ui;
  }
  function focusBox(which) { if (!ui) return; const i = which === 'pass' ? ui.pass : ui.name; try { i.focus(); } catch (e) { } }

  // what the section shows, rebuilt from S when it changes (the boxes are never rebuilt, so typing is never lost)
  function paint() {
    const D = ui.D, d = S.data;
    ui.intro.textContent = "Each teacher gets their own name and password for the teacher view. They sign in on the game's own card at " + site() + ": their name in Knight's name, their password in Secret word, then Play. A teacher can watch, mute a kid's chat, pause chat and send a kid off until midnight; nothing else. Everything a teacher does is in What admins did, and you can undo it here.";
    ui.world.textContent = worldWords(site());
    ui.add.disabled = !!S.busy; ui.make.disabled = !!S.busy;
    ui.add.textContent = S.busy === 'add' ? 'Adding...' : 'Add teacher';
    // the last tap's words: a refusal in bold red; a new password with Copy (shown once: leaving the tab forgets it)
    ui.said.replaceChildren();
    if (S.said) {
      ui.said.className = 'said' + (S.said.bad ? ' bad' : S.said.copy ? ' pass' : '');
      ui.said.append(el(D, 'div', null, S.said.text));
      if (S.said.copy) { const r = el(D, 'div', 'row'); r.append(btn(D, S.copied ? 'Copied' : 'Copy', 'go', copy, 'flt-copy'), el(D, 'span', 'dim', S.copied ? 'The sign-in words and the password are copied. Paste them into a message to the teacher.' : 'Copies the sign-in words with the password, to paste into a message to the teacher.')); ui.said.append(r); }
    } else ui.said.className = '';
    // the list
    const L = ui.list; L.replaceChildren();
    const bar = el(D, 'div', 'bar');
    const n = d ? d.teachers.length : 0;
    bar.append(el(D, 'h3', null, d ? 'Teachers (' + n + ')' : 'Teachers'), btn(D, S.loading ? 'Looking...' : 'Refresh', 'blue', () => { refresh(); }, 'flt-refresh'));
    L.append(bar);
    if (!d) { L.append(el(D, 'p', 'dim', S.loading ? 'Looking up the teachers...' : 'The teachers could not be read. Tap Refresh to try again.')); return; }
    if (!n) L.append(el(D, 'p', 'dim', 'No teachers yet. Add one above.'));
    for (const t of d.teachers) {
      const c = el(D, 'div', 'card' + (t.off ? ' off' : '')); c.dataset.teacher = String(t.id);
      const nm = el(D, 'div', 'name', t.name); if (t.off) nm.append(el(D, 'span', 'tag', 'turned off'));
      const facts = el(D, 'div', 'facts');
      const fact = (label, value, warn) => { const f = el(D, 'div', 'fact', label); const b = el(D, 'b', warn ? 'warn' : null, value); f.append(b); facts.append(f); };
      fact('Added', whenWords(t.created));
      fact('Last signed in', t.lastLogin ? whenWords(t.lastLogin) : 'not yet');
      fact('Watching now', t.watching ? t.watching + (t.watching === 1 ? ' screen' : ' screens') : 'no');
      fact('Actions today', String(t.actsToday));
      // wrong passwords typed for this name today, from anywhere: a big number means someone is guessing (New password stops it)
      fact('Wrong tries today', String(t.wrongToday), t.wrongToday >= 5);
      fact('Sign-in waiting', t.waiting ? 'yes: Lift the wait lets them in' : 'no', !!t.waiting);
      const b = el(D, 'div', 'row');
      // someone (a kid at the same school) typed this name with wrong passwords until the sign-in made that place wait
      if (t.waiting) b.append(btn(D, S.busy === 'lift:' + t.id ? 'Lifting...' : 'Lift the wait', 'gold', () => lift(t.id), 'flt-lift-' + t.id));
      const armP = confirmActive('teach:pass:' + t.id), armO = confirmActive('teach:off:' + t.id);
      b.append(btn(D, armP ? 'Tap again: new password' : 'New password', armP ? 'armed' : 'blue', () => newPassword(t.id), 'flt-pass-' + t.id));
      if (t.off) b.append(btn(D, 'Turn on', 'gold', () => turnOn(t.id), 'flt-on-' + t.id));
      else b.append(btn(D, armO ? 'Tap again: turn off' : 'Turn off', armO ? 'armed' : 'danger', () => turnOff(t.id), 'flt-off-' + t.id));
      for (const x of b.querySelectorAll('button')) x.disabled = !!S.busy;
      c.append(nm, facts, b); L.append(c);
    }
    // C. what teachers did today that is still in force, each with Undo
    L.append(el(D, 'h3', null, 'In force now'));
    const live = d.acts.filter(a => a.inForce);
    if (!live.length) L.append(el(D, 'p', 'dim', 'Nothing a teacher did is in force right now.'));
    for (const a of live) {
      const r = el(D, 'div', 'force'); r.dataset.act = String(a.id);
      const u = btn(D, S.busy === 'undo:' + a.id ? 'Undoing...' : 'Undo', 'blue', () => undo(a.id), 'flt-undo-' + a.id); u.disabled = !!S.busy;
      r.append(el(D, 'span', null, clockWords(a.at) + ' — ' + actWords(a)), u); L.append(r);
    }
    const nr = el(D, 'div', 'notice');
    const words = el(D, 'span', null, 'Tell players when a teacher is watching: '); words.append(el(D, 'span', d.notice ? 'on' : null, d.notice ? 'On' : 'Off'));
    const nb = btn(D, d.notice ? 'Turn off' : 'Turn on', d.notice ? 'danger' : 'go', () => setNotice(!d.notice), 'flt-notice'); nb.disabled = !!S.busy;
    nr.append(words, nb); L.append(nr);
    L.append(el(D, 'p', 'dim', 'When it is on, kids see "A teacher is watching." in their Friends list while a teacher screen is open. No names.'));
  }
  // laid over the rect the tab was drawn in, in page pixels (the canvas is the window: 78-accounts lays its box the same way)
  function showUi(w) {
    const u = ensureUi(); if (!u) return;
    const k = [w.x, w.y, w.w, w.h].map(Math.round).join(',');
    if (u.key !== k) { u.key = k; const s = u.root.style; s.left = Math.round(w.x) + 'px'; s.top = Math.round(w.y) + 'px'; s.width = Math.round(w.w) + 'px'; s.height = Math.round(w.h) + 'px'; }
    // a Tap again that ran out shows as the plain button again
    const sig = S.ver + '|' + ((S.data && S.data.teachers) || []).map(t => (confirmActive('teach:pass:' + t.id) ? 'p' : '') + (confirmActive('teach:off:' + t.id) ? 'o' : '')).join(',');
    if (u.drawn !== sig) { u.drawn = sig; paint(); }
    if (!u.shown) { u.shown = true; u.root.style.display = 'block'; }
  }
  function hideUi() {
    if (!ui || !ui.shown) return;
    ui.shown = false; ui.key = ''; ui.drawn = -1;
    const a = ui.D.activeElement; if (a && ui.root.contains(a)) { try { a.blur(); } catch (e) { } }
    ui.root.style.display = 'none';
    // nothing of the last words (a new password) stays in the page while the section is away; it is drawn again from S
    ui.said.replaceChildren(); ui.said.className = '';
    if (!S.name) ui.name.value = '';
    if (!S.pass) ui.pass.value = '';
  }

  // the tab: where the section goes. Without a page (tools/headless.js) the words are drawn on the canvas instead.
  function draw(g, x, y, w, h, T) {
    if (S.owner !== true) return;
    S.want = { x, y, w, h };
    if (ensureUi()) return;
    g.font = '13px sans-serif'; g.textAlign = 'left'; g.fillStyle = DIM;
    const lines = [];
    if (S.said) lines.push(S.said.text);
    for (const t of ((S.data && S.data.teachers) || [])) lines.push(t.name + (t.off ? ' (turned off)' : ''));
    lines.forEach((s, i) => { if (i * 20 + 16 < h) g.fillText(s, x, y + 16 + i * 20); });
  }

  if (window.ADMIN && ADMIN.addTab) ADMIN.addTab({
    id: 'teachers', name: 'Teachers', after: 'accounts', draw, show: () => S.owner === true && isAdmin(),
    subtitle: 'Teacher sign-ins for the teacher view: add one, a new password, turn one off.',
    short: 'Teacher sign-ins.',
    open: () => { S.said = null; dirty(); refresh(); },
  });

  // the section shows only while its tab is drawn, and never under the pause menu or a character's words
  { const _drawPanels = drawPanels;
    drawPanels = function (g, narrow, short, qh, hb) {
      S.want = null;
      const r = _drawPanels(g, narrow, short, qh, hb);
      // (a character speaking draws over the panel: the section steps aside until the words are gone)
      const speaking = typeof dialog !== 'undefined' && dialog && !!dialog.cur;
      if (S.want && tabOpen() && !paused && !speaking) showUi(S.want); else hideUi();
      return r;
    }; }

  // ---------- every frame: whether this knight is an owner (asked when the Admin panel opens), the refresh, forgetting ----------
  // leaving the tab forgets the boxes and the last words (a new password is shown once)
  function leave() { if (S.said || S.name || S.pass) { S.said = null; S.copied = false; setName(''); setPass(''); dirty(); } }
  function forget() { S.asks++; S.owner = undefined; S.data = null; S.error = null; S.loading = false; S.askedAt = -1e9; S.busy = null; leave(); hideUi(); }
  NET.on('welcome', forget);
  NET.on('offline', forget);
  NET.on('role', () => { if (NET.role !== 'admin') forget(); else { S.owner = undefined; S.askedAt = -1e9; } });
  function upkeep() {
    if (!isAdmin()) { if (S.owner !== undefined || S.data) forget(); return; }
    if (panel === 'admin' && S.owner === undefined && !S.loading && nowMs() - S.askedAt >= ASK_AGAIN) ask();
    if (!tabOpen()) { leave(); return; }
    if (!S.loading && !S.busy && nowMs() - S.askedAt >= REFRESH_EVERY) ask();
  }
  HOOKS.update.push(upkeep);

  const OWNERTEACHERS = {
    state: S, PATH, PASS_MIN, refresh, ask, add, makeOneUp, setName, setPass, newPassword, turnOff, turnOn, lift, undo, setNotice, copy,
    makePassword, copyWords, clean, site, worldWords, errWords, whenWords, actWords, isOwner: () => S.owner === true,
    ui: () => ui || null,
  };
  window.OWNERTEACHERS = OWNERTEACHERS;

  // ---------- self-test (tools/headless.js: no page, so the functions are driven and the canvas words read) ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'owner teachers: ';
    if (window.INSTANCES && INSTANCES.active && INSTANCES.active()) INSTANCES.leave();
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, peace: window.__peace, notice, paused, vw: window.innerWidth, vh: window.innerHeight };
    // a small world: MudGoll welcomed with whatever role the test says; the owner calls answered as online/src/teachers.js does
    let sock = null, role = 'admin', owner = true;
    const calls = [];
    const W = {
      teachers: [], acts: [], notice: true, next: 1, fail: null,
      call(method, path, body) {
        calls.push({ method, path, body: body ? JSON.parse(JSON.stringify(body)) : body });
        const fail = (code, status, msg) => { const e = new Error(msg || code); e.code = code; e.status = status; throw e; };
        if (!path.startsWith(PATH)) return path === '/api/save/pin' ? { at: null, bytes: 0 } : {};
        if (role !== 'admin') fail('admin', 403, 'only an admin can do that');
        if (!owner) fail('owner', 403, "only the owner's knight can do that");
        if (W.fail) { const f = W.fail; W.fail = null; fail(f[0], f[1], f[2]); }
        const t = body && W.teachers.find(x => x.id === body.id);
        if (method === 'GET' && path === PATH) return JSON.parse(JSON.stringify({ teachers: W.teachers, acts: W.acts, notice: W.notice }));
        if (method === 'POST' && path === PATH) {
          if (String(body.pass).length < PASS_MIN) fail('pass', 400, 'The password needs at least 10 letters (spaces count). Type a longer one, or press Make one up.');
          if (W.teachers.some(x => x.name.toLowerCase() === String(body.name).toLowerCase())) fail('taken', 409, 'There is already a teacher called ' + body.name + '. Pick another name, or press New password on ' + body.name + "'s row below to give them a new password.");
          const name = String(body.name).replace(/’/g, "'");
          W.teachers.push({ id: W.next, name, created: Date.now(), lastLogin: null, off: false, watching: 0, actsToday: 0, wrongToday: 0, waiting: 0, hash: 'never-sent' });
          delete W.teachers[W.teachers.length - 1].hash;
          return { ok: true, id: W.next++, name };
        }
        if (!t && path !== PATH + '/undo' && path !== PATH + '/notice') fail('nope', 404, 'no teacher with that id');
        if (path === PATH + '/pass') return { ok: true };
        if (path === PATH + '/off') { t.off = true; return { ok: true }; }
        if (path === PATH + '/on') { if (!body.pass) fail('pass', 400, 'x'); t.off = false; return { ok: true }; }
        if (path === PATH + '/lift') { t.waiting = 0; return { ok: true }; }
        if (path === PATH + '/undo') { const a = W.acts.find(x => x.id === body.act); if (!a) fail('nope', 404, 'That is not on the list.'); a.inForce = false; return { ok: true }; }
        if (path === PATH + '/notice') { W.notice = !!body.on; return { ok: true }; }
        fail('nope', 404, 'no such call');
      },
      open() { const s = { readyState: 1, send(str) { const m = JSON.parse(str); if (m.t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'MudGoll', at: 1, keeper: 'MudGoll', role }) }); }, close() { s.readyState = 3; } }; sock = s; return s; },
    };
    const feed = m => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(m) }); };
    const connect = (r, o) => { role = r; owner = o; NET.disconnect(); NET.token = 'owner-teachers-test'; NET.connect(); };
    const asked = () => calls.filter(c => c.path.startsWith(PATH));
    const posts = () => calls.filter(c => c.method === 'POST' && c.path.startsWith(PATH));
    const has = label => buttons.some(b => b.label === label);
    const rec = [], st = {};
    const g2 = new Proxy(st, { get: (t, k) => k === 'measureText' ? (s => ({ width: String(s).length * 6 })) : k === 'fillText' ? ((s) => { rec.push(String(s)); }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: () => { } }) : (k in st ? st[k] : () => { }), set: (t, k, v) => { st[k] = v; return true; } });
    const drawn = () => { rec.length = 0; HOOKS.panel.admin(g2, false); const out = rec.splice(0); render(); return out; };
    const step = () => { upkeep(); render(); };
    const page = () => !!ensureUi();   // in a real browser the words are page elements, not canvas text
    try {
      NET.enabled = true; NET.useFake(W); dialog.cur = null; dialog.queue.length = 0; closePanel(); paused = false; h.peace(true);
      try { window.innerWidth = 1000; window.innerHeight = 700; } catch (e) { } render();

      // ---- NEGATIVE: a kid never asks and never sees it; another admin asks once, is refused, and sees no tab ----
      { connect('player', false); closePanel(); calls.length = 0; openPanel('admin'); step(); step();
        const kid = asked().length === 0 && !ADMIN.tabs().includes('teachers') && ADMIN.open('teachers') === false;
        connect('admin', false); closePanel(); calls.length = 0; ADMIN.open('knights'); step(); step(); step();
        const other = asked().length === 1 && S.owner === false && !ADMIN.tabs().includes('teachers') && !has('admin:tab:teachers');
        const opened = ADMIN.open('teachers') && ADMIN.state.tab === 'knights';
        const noAdd = add() === false && newPassword(1, true) === false && posts().length === 0;
        check(P + "a kid never asks the world and never sees Teachers; another admin asks once when the Admin panel opens, is refused (403 owner) and gets no tab, cannot open it and sends nothing", kid && other && opened && noAdd, { kid, other, opened, noAdd, owner: S.owner, tabs: ADMIN.tabs(), asked: asked().length }); }

      // ---- the owner: the tab after Accounts, the list in one ask ----
      { connect('admin', true); closePanel(); calls.length = 0; ADMIN.open('knights'); step(); step();
        const tabs = ADMIN.tabs().join(','), isOwner = S.owner === true, tab = has('admin:tab:teachers');
        F.clickButton('admin:tab:teachers'); step();
        const onTab = ADMIN.state.tab === 'teachers' && tabOpen();
        check(P + 'the owner\'s knight gets Teachers after Accounts (the world said yes to GET /api/owner/teachers); tapping it opens the section', isOwner && tabs === 'knights,accounts,teachers,powers,monsters,party' && tab && onTab, { isOwner, tabs, tab, onTab }); }

      // ---- B. Add teacher: /admin's refusals first, nothing sent; then Make one up and Add; the password shown once ----
      { calls.length = 0;
        const r = [];
        setName(''); setPass('long-enough-pass'); add(); r.push(S.said.text);
        setName('Mrs Smith'); setPass(''); add(); r.push(S.said.text);
        setPass('cohen 123'); add(); r.push(S.said.text);
        const want = ["Not added. Type the teacher's name first, like Mrs Smith.", 'Not added. Type a password of at least 10 letters, or press Make one up.', 'Not added. The password needs at least 10 letters (spaces count); this one has 9. Type a longer one, or press Make one up.'];
        const refused = JSON.stringify(r) === JSON.stringify(want) && S.said.bad && posts().length === 0;
        const pass = makeOneUp(); const shape = /^[a-z]+-[a-z]+-[a-z]+-[1-9][0-9]$/.test(pass) && S.pass === pass;
        add(); step();
        const p = posts()[0] || {};
        const sent = posts().length === 1 && p.path === PATH && p.body.name === 'Mrs Smith' && p.body.pass === pass;
        const said = S.said && S.said.text === 'Added Mrs Smith. The password is ' + pass + ' (it is not shown again). Tell Mrs Smith: go to ' + site() + ", type Mrs Smith in Knight's name and this password in Secret word, and press Play.";
        const copyText = S.said && S.said.copy === 'Fanglands teacher sign-in. Go to ' + site() + ", type Mrs Smith in Knight's name and " + pass + ' in Secret word, and press Play.';
        const cleared = S.name === '' && S.pass === '' && !S.said.bad;
        const listed = !!S.data && S.data.teachers.length === 1 && S.data.teachers[0].name === 'Mrs Smith';
        const words = drawn(); const onCanvas = page() || (words.includes('Mrs Smith') && words.some(t => t.startsWith('Added Mrs Smith.')));
        check(P + "Add teacher: /admin's three refusals in its words (bold red, nothing sent); Make one up makes a three-word password; Add sends it once and says it ONCE in /admin's words, with the words Copy copies; the boxes empty; the list has her", refused && shape && sent && said && copyText && cleared && listed && onCanvas,
          { r, refused, pass, shape, sent, said: S.said && S.said.text, copyText, cleared, listed, onCanvas }); }

      // ---- the world's own refusal (taken) reads after "Not added." and keeps what was typed ----
      { setName('Mrs Smith'); setPass('another-long-pass'); add(); step();
        const taken = S.said.bad && S.said.text === "Not added. There is already a teacher called Mrs Smith. Pick another name, or press New password on Mrs Smith's row below to give them a new password." && S.name === 'Mrs Smith' && !S.said.copy;
        W.fail = ['down', 0, 'Failed to fetch']; setName('Mr Lee'); add(); step();
        const down = S.said.text === 'Not added. The world did not answer (Failed to fetch). Check the internet and press Add teacher again.';
        setName(''); setPass('');
        check(P + "the world's refusal is said after \"Not added.\" in its own words, the boxes keep what was typed; no answer at all says to check the internet", taken && down, { said: S.said }); }

      // ---- A. New password and Turn off need a second tap; Turn on and Lift the wait do not; each in /admin's words ----
      { const id = S.data.teachers[0].id; calls.length = 0;
        const first = newPassword(id) === false && posts().length === 0 && /^Tap again to give Mrs Smith a new password\./.test(S.said.text);
        newPassword(id); step(); const p1 = posts()[0] || {};
        const passed = posts().length === 1 && p1.path === PATH + '/pass' && /^[a-z]+-[a-z]+-[a-z]+-\d\d$/.test(p1.body.pass) && S.said.text === "Mrs Smith's new password is " + p1.body.pass + '. Give it to them. It is not shown again.' && S.said.copy === copyWords('Mrs Smith', p1.body.pass);
        const offFirst = turnOff(id) === false && posts().length === 1;
        turnOff(id); step(); const isOff = W.teachers[0].off && S.data.teachers[0].off && S.said.text === 'Mrs Smith is turned off.';
        turnOn(id); step(); const p3 = posts()[posts().length - 1];
        const isOn = !W.teachers[0].off && p3.path === PATH + '/on' && S.said.text === 'Mrs Smith is on again with a new password: ' + p3.body.pass + '. Give it to them. It is not shown again.';
        W.teachers[0].waiting = 2; refresh(); step();
        const words = drawn();
        lift(id); step(); const lifted = posts()[posts().length - 1].path === PATH + '/lift' && S.said.text === 'Mrs Smith can sign in again now, with the same password.' && S.data.teachers[0].waiting === 0;
        check(P + 'New password and Turn off ask for a second tap, then send once with /admin\'s words (a new password shown once, with Copy); Turn on makes a new password; Lift the wait lets her in again', first && passed && offFirst && isOff && isOn && lifted && (page() || words.includes('Mrs Smith')),
          { first, passed, offFirst, isOff, isOn, lifted, said: S.said && S.said.text }); }

      // ---- C. today's actions in force with Undo, and the notice switch ----
      { const now = Date.now();
        W.acts = [{ id: 7, at: now - 60000, teacher: 'Mrs Smith', act: 'mute', target: 'Cohen', until: now + 3600000, inForce: true }, { id: 6, at: now - 120000, teacher: 'Mrs Smith', act: 'sendoff', target: 'Sam', until: now + 3600000, inForce: false }];
        refresh(); step(); calls.length = 0;
        const live = S.data.acts.filter(a => a.inForce).length === 1;
        undo(7); step();
        const undone = posts()[0].path === PATH + '/undo' && posts()[0].body.act === 7 && S.said.text === 'Undone: Mrs Smith muted Cohen until ' + clockWords(now + 3600000) + '.' && !S.data.acts.some(a => a.inForce);
        const was = S.data.notice; setNotice(!was); step();
        const flipped = posts()[1].path === PATH + '/notice' && posts()[1].body.on === !was && S.data.notice === !was;
        setNotice(was); step();
        check(P + 'Undo lifts a teacher\'s action still in force (said as /admin says it); the notice switch flips both ways', live && undone && flipped && S.data.notice === was, { live, undone, flipped, said: S.said && S.said.text }); }

      // ---- shown once: leaving the tab forgets the password and the boxes; the world turning him down takes the tab away ----
      { const id = S.data.teachers[0].id; newPassword(id, true); step();
        const shown = !!(S.said && S.said.copy);
        setName('Half typed'); setPass('half-typed-pass');
        F.clickButton('admin:tab:knights'); step();
        const gone = S.said === null && S.name === '' && S.pass === '';
        F.clickButton('admin:tab:teachers'); step(); const back = S.said === null;
        owner = false; refresh(); step();
        const lost = S.owner === false && !ADMIN.tabs().includes('teachers') && ADMIN.state.tab !== 'teachers' && S.data === null;
        owner = true; feed({ t: 'role', role: 'player' }); step(); const demoted = S.owner === undefined && !ADMIN.tabs().includes('teachers');
        check(P + 'a new password is shown once: leaving the tab forgets it and anything half typed; a world that turns the knight down (or a demotion) takes the tab away at once', shown && gone && back && lost && demoted, { shown, gone, back, lost, demoted }); }

      // ---- the plain words ----
      { const errs = [errWords({ code: 'owner', status: 403 }), errWords({ code: 'admin', status: 403 }), errWords({ code: 'auth', status: 401 }), errWords({})];
        const ok = errs.join('|') === "Only the owner's knight can do that.|Only an admin can do that.|You are logged out. Log in again.|The world did not answer. Check the internet and try again." && worldWords('fanglands.com').startsWith("These are the MAIN world's teachers") && worldWords('test.fanglands.com').startsWith("These are the TEST world's teachers")
          && clean({ teachers: [{ id: 1, name: 'A', hash: 'x', salt: 'y' }] }).teachers[0].hash === undefined && clean({}) === null;
        check(P + "refusals in plain words; the section names its world; a field the world should never send (a hash) is never kept", ok, { errs }); }
    } catch (e) {
      check(P + 'the owner teachers self-test ran to the end without an exception', false, { error: String((e && e.stack) || e).slice(0, 800) });
    } finally {
      forget();
      NET.disconnect(); NET.emit('offline', { t: 'offline' }); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null; NET.role = 'player';
      try { window.innerWidth = was.vw; window.innerHeight = was.vh; } catch (e) { }
      ADMIN.state.tab = 'knights'; ADMIN.state.view = null;
      closePanel(); h.peace(was.peace); paused = was.paused; notice = was.notice;
      render();
    }
  });
}
