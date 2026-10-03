// ============================================================================
// HAND-OVER, ARRIVING — a browser coming from the old address (gorkscape.ca) brings its knight along
// Owner (2026-10-03): "port everything over to the new proper domain but have gorkscape redirect to fang lands so
// anyone with the old domain doesnt notice the diffrance for now".
// A browser keeps its login and saves per address. The hand-over page on gorkscape.ca (online/src/handoff.js) offers
// that browser's Fanglands keys to the world, bound to a pull this address kept (fanglands.handoff.pull, written by the
// start page /handoff), and comes here with a one-time code after # (#handoff=<64 hex>). This file runs before any
// other part of the game reads a save or the login: it claims the code once WITH the pull, writes what this address is
// missing (it never writes over anything here), takes the code off the address, and starts the page again so the game
// boots with everything in place. A code with no pull kept here, a code that ran out or was used already changes nothing.
// If the answer never comes, it goes back to the old address once so it offers again. docs/ONLINE.md, "Two addresses".
// Feature file: runs once at load; window.HANDOFF is the register; HOOKS.selfTest checks the merge rules.
// ============================================================================
{
  const SEEN_KEY = 'fanglands.handoff.seen';       // what landed before, so an unchanged offer is not applied twice
  const PULL_KEY = 'fanglands.handoff.pull';       // the pull the start page kept: {n: 32 hex, at}
  const BOOT_KEY = 'fanglands.handoff.boot';       // the values the game wrote by itself at boot, unchanged since
  const PULL_MS = 5 * 60 * 1000;
  const KEY_RE = /^(fanglands\.|fl_)[A-Za-z0-9_.:-]{1,160}$/;
  const SLOT_RE = /^fanglands\.slot\.(\d+)$/, AT_RE = /^fanglands\.slot\.\d+\.at$/;
  const TOKEN = 'fanglands.session', NAME = 'fanglands.lastname', MARK = 'fanglands.slot.1.online';
  const CODE_RE = /^#handoff(2?)=([0-9a-f]{64})$/;
  const OLD = { 'fanglands.com': 'https://gorkscape.ca', 'www.fanglands.com': 'https://gorkscape.ca', 'test.fanglands.com': 'https://test.gorkscape.ca' };
  const SLOT = n => 'fanglands.slot.' + n;

  // a short fingerprint of a group's values: only to know "this exact thing landed before"
  const fingerprint = vals => {
    const s = JSON.stringify(vals); let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36) + '.' + s.length;
  };
  // the keys that are neither a save slot, its stamp or mark, the login, nor the hand-over's own notes: settings, hints,
  // the current slot, the old single save
  const isOther = k => KEY_RE.test(k) && !SLOT_RE.test(k) && !AT_RE.test(k) && k !== MARK && k !== TOKEN && k !== NAME && !k.startsWith('fanglands.handoff');
  const parse = (raw, dflt) => { try { const v = JSON.parse(raw || 'null'); return v && typeof v === 'object' && !Array.isArray(v) ? v : dflt; } catch (e) { return dflt; } };

  // The offered keys in groups that move together: one per save slot (the slot, its .at stamp, and for slot 1 the mark
  // that says it holds the cloud knight), the login (the session token with the last name typed), and every other key
  // on its own. A stamp or a mark with no slot beside it moves nothing.
  function groupsOf(keys) {
    const out = [], used = {};
    for (const k of Object.keys(keys).sort()) {
      const m = SLOT_RE.exec(k); if (!m || typeof keys[k] !== 'string') continue;
      const g = { name: 'slot.' + m[1], slot: m[1], keys: { [k]: keys[k] } };
      const at = k + '.at'; if (typeof keys[at] === 'string') g.keys[at] = keys[at];
      if (m[1] === '1' && typeof keys[MARK] === 'string') g.keys[MARK] = keys[MARK];
      for (const x in g.keys) used[x] = 1;
      out.push(g);
    }
    if (typeof keys[TOKEN] === 'string') {
      const g = { name: 'login', login: true, keys: { [TOKEN]: keys[TOKEN] } };
      if (typeof keys[NAME] === 'string') g.keys[NAME] = keys[NAME];
      used[TOKEN] = used[NAME] = 1; out.push(g);
    }
    for (const k of Object.keys(keys)) {
      if (used[k] || typeof keys[k] !== 'string' || !isOther(k)) continue;
      out.push({ name: k, one: k, keys: { [k]: keys[k] } });
    }
    return out;
  }

  // Writes what this address is missing and NEVER writes over anything already here. ls is {get, set, del}.
  //   a slot: lands in its own slot when that slot is empty here. When it is taken by another save, the offered one goes
  //     into an empty slot 2 or 3 (moved), the way a Play-alone knight is parked when the cloud knight takes slot 1;
  //     slot 1 is the cloud knight's, so a moved knight never goes there. With no empty slot it waits on the old
  //     address (left) and is offered again next time. Slot 1 holding the cloud knight (with its mark) is only a copy
  //     of the cloud save: when slot 1 here is taken, it is skipped, since logging in brings it back.
  //     A save already in any slot here is not brought twice. A stamp from the future is brought back to now.
  //   the login (the token with the last name): only when this address is not logged in at all
  //   anything else (settings, hints, the current slot, the old single save): when it is not here, or when what is here
  //     is still exactly what the game wrote by itself at boot (BOOT_KEY), so a first look at fanglands.com does not
  //     shut out the kid's own kid mode, text size and sound. A setting changed here is never written over.
  // A group that landed (or was seen and left alone on purpose) is remembered by fingerprint, so the same offer coming
  // again changes nothing: a slot deleted here, a logout here, stays that way. Returns {wrote, kept, moved, left}.
  function merge(keys, ls, now) {
    now = now || Date.now();
    const seen = parse(ls.get(SEEN_KEY), {}), boot = parse(ls.get(BOOT_KEY), {});
    const wrote = [], kept = [], left = [], moved = {};
    const has = n => ls.get(SLOT(n)) != null;
    // slots that can land in their own slot first, then the ones that must move, then the login and the rest
    const all = groupsOf(keys || {});
    const own = g => !has(g.slot) && !(g.slot === '1' && g.keys[MARK] == null && ls.get(MARK) != null);
    const order = all.filter(g => g.slot && own(g)).concat(all.filter(g => g.slot && !own(g)), all.filter(g => !g.slot));
    for (const g of order) {
      const f = fingerprint(g.keys);
      if (seen[g.name] === f) { kept.push(g.name); continue; }
      if (g.slot) {
        const val = g.keys[SLOT(g.slot)], marked = g.slot === '1' && g.keys[MARK] != null;
        if ([1, 2, 3, +g.slot].some(n => ls.get(SLOT(n)) === val)) { seen[g.name] = f; kept.push(g.name); continue; }
        let to = null;
        if (own(g)) to = g.slot;
        else if (marked) { seen[g.name] = f; kept.push(g.name); continue; }   // the cloud has it
        else to = ['2', '3'].find(n => !has(n)) || null;
        if (!to) { left.push(g.name); continue; }
        ls.set(SLOT(to), val);
        const atRaw = g.keys[SLOT(g.slot) + '.at'];
        if (atRaw != null) ls.set(SLOT(to) + '.at', +atRaw > now ? String(now) : (to === g.slot ? atRaw : String(+atRaw || now)));
        else if (to !== g.slot) ls.set(SLOT(to) + '.at', String(now));
        if (to === '1') { if (marked) ls.set(MARK, g.keys[MARK]); else ls.del(MARK); }
        if (to !== g.slot) moved[g.name] = 'slot.' + to;
        seen[g.name] = f; wrote.push(g.name);
        continue;
      }
      seen[g.name] = f;
      let take;
      if (g.login) take = ls.get(TOKEN) == null;
      else { const mine = ls.get(g.one); take = mine == null || (typeof boot[g.one] === 'string' && boot[g.one] === mine); }
      if (!take) { kept.push(g.name); continue; }
      for (const k in g.keys) { ls.set(k, g.keys[k]); delete boot[k]; }
      wrote.push(g.name);
    }
    ls.set(SEEN_KEY, JSON.stringify(seen));
    ls.set(BOOT_KEY, JSON.stringify(boot));
    return { wrote, kept, moved, left };
  }

  // What the game writes by itself at boot (43-settings saves its defaults, and so on), so merge can tell "never changed
  // here" from "the kid's own". bootBefore runs as this file loads, before any other file; bootAfter right after the
  // whole game has loaded. A key the boot wrote, or one that was here and still had what the last boot wrote, is noted
  // with its value now; a key that was here with anything else is the kid's own and is left out for good.
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
  // the pull the start page kept, while it is fresh
  function pullOf(ls, now) {
    const p = parse(ls.get(PULL_KEY), null);
    return p && typeof p.n === 'string' && /^[0-9a-f]{32}$/.test(p.n) && now - p.at >= 0 && now - p.at < PULL_MS ? p : null;
  }

  const LS = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { } },
    del: k => { try { localStorage.removeItem(k); } catch (e) { } },
    keys: () => { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k != null) out.push(k); } } catch (e) { } return out; },
  };
  const HANDOFF = { merge, groupsOf, fingerprint, bootBefore, bootAfter, pullOf, arriving: false, result: null, SEEN_KEY, PULL_KEY, BOOT_KEY };
  window.HANDOFF = HANDOFF;

  // ---------- arriving with a code: claim it with the pull, write, take the code off the address, start again ----------
  const hash = (typeof location !== 'undefined' && location && typeof location.hash === 'string') ? location.hash : '';
  const strip = () => { try { history.replaceState(history.state, '', location.pathname + location.search); return true; } catch (e) { return false; } };
  if (hash.startsWith('#handoff')) {
    const m = CODE_RE.exec(hash), pull = pullOf(LS, Date.now());
    // a broken code, or a code this browser never asked for (no pull kept here): nothing to claim, the game just starts
    if (!m || !pull || typeof fetch !== 'function') strip();
    else {
      HANDOFF.arriving = true;
      let done = false;
      const restart = () => {
        if (done) return; done = true;
        if (strip()) { try { location.reload(); return; } catch (e) { } }
        location.replace(location.pathname + location.search);   // no fragment, so this is a real load, never a loop
      };
      // the answer never came (a blip, a slow world): once, back to the old address with the same pull so it offers
      // again (#handoff-pull2 comes back as #handoff2, which never goes back a second time)
      const again = () => {
        if (done) return;
        const old = OLD[location.hostname];
        if (m[1] === '' && old) { done = true; location.replace(old + location.pathname + location.search + '#handoff-pull2=' + pull.n); return; }
        restart();
      };
      setTimeout(again, 12000);
      let ctl = null; try { ctl = new AbortController(); } catch (e) { }
      if (ctl) setTimeout(() => ctl.abort(), 9000);
      fetch('/api/handoff/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: m[2], pull: pull.n }), cache: 'no-store', credentials: 'same-origin', signal: ctl ? ctl.signal : undefined })
        .then(r => {
          if (!r.ok) { if (r.status === 404 || r.status === 400 || r.status === 403) restart(); else again(); return; }   // gone: nothing to bring
          return r.json().then(d => {
            if (d && d.keys && typeof d.keys === 'object' && !Array.isArray(d.keys)) HANDOFF.result = merge(d.keys, LS);
            restart();
          });
        })
        .catch(again);
      // nothing else of the game runs on this load: it starts again in a moment with the knight in place
      throw new Error('Fanglands is bringing this browser\'s knight over from the old address. The game starts in a moment.');
    }
  }
  // an ordinary boot: a pull that ran out is cleared; what the game writes by itself while loading is noted
  if (LS.get(PULL_KEY) != null && !pullOf(LS, Date.now())) LS.del(PULL_KEY);
  { const st = bootBefore(LS); if (typeof setTimeout === 'function') setTimeout(() => bootAfter(LS, st), 0); }

  const P = 'handoff: ';
  HOOKS.selfTest.push((check) => {
    const mem = init => { const s = Object.assign({}, init); return { s, get: k => (k in s ? s[k] : null), set: (k, v) => { s[k] = String(v); }, del: k => { delete s[k]; }, keys: () => Object.keys(s) }; };
    const NOW = 1000000;
    const old = {
      'fanglands.session': 'tok-old', 'fanglands.lastname': 'Cohen',
      'fanglands.slot.1': '{"a":1}', 'fanglands.slot.1.at': '500', 'fanglands.slot.1.online': '1',
      'fanglands.slot.2': '{"b":2}', 'fanglands.slot.2.at': '400',
      'fanglands.settings': '{"sound":true}', 'fl_learn_bag': '3', 'fanglands.slot.current': '1',
    };
    // 1. an empty new address takes everything, exactly
    const a = mem();
    const r1 = merge(old, a, NOW);
    const same = Object.keys(old).every(k => a.s[k] === old[k]);
    check(P + 'an address with nothing yet takes the login, every slot with its stamp and mark, the settings and hints, exactly', same && r1.kept.length === 0 && r1.wrote.includes('login') && r1.wrote.includes('slot.1') && r1.wrote.includes('slot.2'), { wrote: r1.wrote, kept: r1.kept });
    // 2. nothing here is ever written over: a login, a slot (older or newer), settings the kid set
    const b = mem({ 'fanglands.session': 'tok-new', 'fanglands.lastname': 'Sam', 'fanglands.slot.1': '{"mine":1}', 'fanglands.slot.1.at': '900', 'fanglands.settings': '{"sound":false}', 'fanglands.slot.2': '{"older":1}', 'fanglands.slot.2.at': '100' });
    const r2 = merge(old, b, NOW);
    check(P + 'a login here, every slot here (even an older one) and settings here are kept; the offered slot 2 goes into the empty slot 3; the cloud copy of slot 1 is skipped', b.s['fanglands.session'] === 'tok-new' && b.s['fanglands.lastname'] === 'Sam' && b.s['fanglands.slot.1'] === '{"mine":1}' && b.s['fanglands.slot.1.at'] === '900' && !('fanglands.slot.1.online' in b.s) && b.s['fanglands.settings'] === '{"sound":false}' && b.s['fanglands.slot.2'] === '{"older":1}' && b.s['fanglands.slot.2.at'] === '100' && b.s['fanglands.slot.3'] === '{"b":2}' && b.s['fanglands.slot.3.at'] === '400' && b.s['fl_learn_bag'] === '3' && r2.moved['slot.2'] === 'slot.3', { s: b.s, r2 });
    // 3. a crafted offer with a stamp from the future never replaces a knight here, byte for byte
    const kid = { 'fanglands.session': 'tok-kid', 'fanglands.slot.2': '{"player":{"playSeconds":144000}}', 'fanglands.slot.2.at': '900000' };
    const c3 = mem(kid);
    const r3 = merge({ 'fanglands.session': 'tok-evil', 'fanglands.slot.2': '{"player":{"playSeconds":0}}', 'fanglands.slot.2.at': '9999999999999', 'fanglands.slot.3': '{"x":1}', 'fanglands.slot.3.at': '9999999999999' }, c3, NOW);
    check(P + 'a far-future offer leaves the knight in slot 2 and the login exactly as they were; what it brings lands only in empty slots, stamped now at most', Object.keys(kid).every(k => c3.s[k] === kid[k]) && c3.s['fanglands.slot.3'] === '{"x":1}' && c3.s['fanglands.slot.3.at'] === String(NOW) && !('fanglands.slot.1' in c3.s) && r3.left.includes('slot.2'), { s: c3.s, r3 });
    // 4. with no empty slot the offered knight waits (not remembered), and lands the next time once a slot is free
    const full = mem({ 'fanglands.slot.1': '{"p":1}', 'fanglands.slot.2': '{"p":2}', 'fanglands.slot.3': '{"p":3}' });
    const off4 = { 'fanglands.slot.2': '{"far":1}', 'fanglands.slot.2.at': '50' };
    const r4 = merge(off4, full, NOW);
    const was4 = JSON.stringify([full.s['fanglands.slot.1'], full.s['fanglands.slot.2'], full.s['fanglands.slot.3']]);
    delete full.s['fanglands.slot.3'];
    const r4b = merge(off4, full, NOW);
    check(P + 'with every slot taken the offered knight is left on the old address, nothing here changes; when a slot is free it lands there next time', r4.left.includes('slot.2') && was4 === '["{\\"p\\":1}","{\\"p\\":2}","{\\"p\\":3}"]' && full.s['fanglands.slot.3'] === '{"far":1}' && full.s['fanglands.slot.3.at'] === '50' && r4b.moved['slot.2'] === 'slot.3', { r4, r4b, s: full.s });
    // 5. the same offer again changes nothing, even after a slot was deleted here on purpose; a changed slot comes through
    delete a.s['fanglands.slot.2']; delete a.s['fanglands.slot.2.at']; delete a.s['fanglands.session'];
    const r5 = merge(old, a, NOW);
    const moved5 = Object.assign({}, old, { 'fanglands.slot.2': '{"b":3}', 'fanglands.slot.2.at': '700' });
    merge(moved5, a, NOW);
    check(P + 'an offer that landed before is left alone (a deleted slot or a logout here stays that way); a slot changed on the old address since comes over', r5.wrote.length === 0 && !('fanglands.session' in a.s) && a.s['fanglands.slot.2'] === '{"b":3}' && a.s['fanglands.slot.2.at'] === '700', { r5, slot2: a.s['fanglands.slot.2'] });
    // 6. visited the new address first: the boot wrote default settings and the kid played slot 1 for a moment
    const nf = mem();
    const st = bootBefore(nf);
    nf.set('fanglands.settings', '{"kid":false,"text":"normal"}'); nf.set('fanglands.kidmode', '0'); nf.set('fanglands.muted', '0');   // what the boot writes
    bootAfter(nf, st);
    nf.set('fanglands.muted', '1');   // the kid turned sound off here
    nf.set('fanglands.slot.1', '{"player":{"playSeconds":30}}'); nf.set('fanglands.slot.1.at', '999000');
    const st2 = bootBefore(nf); nf.set('fanglands.settings', '{"kid":false,"text":"normal"}'); bootAfter(nf, st2);   // a second boot
    const r6 = merge({ 'fanglands.settings': '{"kid":true,"text":"large"}', 'fanglands.kidmode': '1', 'fanglands.muted': '0', 'fanglands.slot.1': '{"player":{"playSeconds":9000}}', 'fanglands.slot.1.at': '500' }, nf, NOW);
    check(P + 'after a first look at the new address, the kid\'s own kid mode and text size still come over (the boot\'s defaults are not the kid\'s), a setting changed here stays, and the long-played knight lands beside the new one', nf.s['fanglands.settings'] === '{"kid":true,"text":"large"}' && nf.s['fanglands.kidmode'] === '1' && nf.s['fanglands.muted'] === '1' && nf.s['fanglands.slot.1'] === '{"player":{"playSeconds":30}}' && nf.s['fanglands.slot.2'] === '{"player":{"playSeconds":9000}}' && nf.s['fanglands.slot.2.at'] === '500' && r6.moved['slot.1'] === 'slot.2', { s: nf.s, r6 });
    // 7. a setting the hand-over wrote is the kid's from then on: the next boot does not note it as a default
    const st3 = bootBefore(nf); bootAfter(nf, st3);
    const boot7 = parse(nf.s[BOOT_KEY], {});
    check(P + 'what a hand-over wrote is never treated as a boot default afterwards', !('fanglands.settings' in boot7) && !('fanglands.kidmode' in boot7) && !('fanglands.muted' in boot7), boot7);
    // 8. slot 1 and its cloud mark move together; a local knight never lands in slot 1 when a cloud knight owns it here
    const c = mem({ 'fanglands.slot.1': '{"x":0}', 'fanglands.slot.1.at': '1', 'fanglands.slot.1.online': '1' });
    merge({ 'fanglands.slot.1': '{"x":1}', 'fanglands.slot.1.at': '9' }, c, NOW);
    const e = mem({ 'fanglands.slot.1.online': '1' });
    merge({ 'fanglands.slot.1': '{"local":1}', 'fanglands.slot.1.at': '9' }, e, NOW);
    const d = mem({ 'fanglands.slot.1': '{"mine":1}' });
    merge({ 'fanglands.slot.1.online': '1', 'fanglands.slot.3.at': '5', 'fanglands.handoff.seen': '{}', 'evil': 'x' }, d, NOW);
    check(P + 'a local knight offered for a taken slot 1 goes to slot 2 and slot 1 keeps its cloud mark; a mark or a stamp with no slot, and keys that are not the game\'s, move nothing', c.s['fanglands.slot.1'] === '{"x":0}' && c.s['fanglands.slot.1.online'] === '1' && c.s['fanglands.slot.2'] === '{"x":1}' && e.s['fanglands.slot.2'] === '{"local":1}' && !('fanglands.slot.1' in e.s) && e.s['fanglands.slot.1.online'] === '1' && !('fanglands.slot.1.online' in d.s) && !('fanglands.slot.3.at' in d.s) && !('evil' in d.s) && d.s['fanglands.slot.1'] === '{"mine":1}', { c: c.s, e: e.s, d: d.s });
    // 9. a pull is only good while fresh, and only in its own shape
    const p = mem({ [PULL_KEY]: JSON.stringify({ n: 'a'.repeat(32), at: NOW - 1000 }) });
    const q = mem({ [PULL_KEY]: JSON.stringify({ n: 'a'.repeat(32), at: NOW - PULL_MS }) });
    const r = mem({ [PULL_KEY]: JSON.stringify({ n: 'xyz', at: NOW }) });
    check(P + 'a pull kept here counts for 5 minutes and only as 32 hex; a code with no pull kept here is never claimed', !!pullOf(p, NOW) && !pullOf(q, NOW) && !pullOf(r, NOW) && !pullOf(mem(), NOW), {});
    check(P + 'no code on the address: the game boots as always', !HANDOFF.arriving);
  });
}
