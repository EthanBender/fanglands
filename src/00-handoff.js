// ============================================================================
// HAND-OVER, ARRIVING — a browser coming from the old address (gorkscape.ca) brings its knight along
// Owner (2026-10-03): "port everything over to the new proper domain but have gorkscape redirect to fang lands so
// anyone with the old domain doesnt notice the diffrance for now".
// A browser keeps its login and saves per address. The hand-over page on gorkscape.ca (online/src/handoff.js) offers
// that browser's Fanglands keys to the world and comes here with a one-time code after # (#handoff=<64 hex>). This
// file runs before any other part of the game reads a save or the login: it claims the code once, writes each key
// only where this address does not already have it (or, for a save slot, has an older copy), takes the code off the
// address, and starts the page again so the game boots with everything in place. A code that ran out or was used
// already changes nothing. docs/ONLINE.md, "Two addresses".
// Feature file: runs once at load; window.HANDOFF is the register; HOOKS.selfTest checks the merge rules.
// ============================================================================
{
  const SEEN_KEY = 'fanglands.handoff.seen';       // what was offered before, so an unchanged offer is not applied twice
  const KEY_RE = /^(fanglands\.|fl_)[A-Za-z0-9_.:-]{1,160}$/;
  const SLOT_RE = /^fanglands\.slot\.(\d+)$/;
  const TOKEN = 'fanglands.session', NAME = 'fanglands.lastname', MARK = 'fanglands.slot.1.online';
  const CODE_RE = /^#handoff=([0-9a-f]{64})$/;

  // a short fingerprint of a group's values: only to know "this exact thing was offered before"
  const fingerprint = vals => {
    const s = JSON.stringify(vals); let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36) + '.' + s.length;
  };

  // The offered keys in groups that move together: one per save slot (the slot, its .at stamp, and for slot 1 the mark
  // that says it holds the cloud knight), the login (the session token with the last name typed), and every other key
  // on its own. A stamp or a mark with no slot beside it moves nothing.
  function groupsOf(keys) {
    const out = [], used = {};
    for (const k of Object.keys(keys)) {
      const m = SLOT_RE.exec(k); if (!m) continue;
      const g = { name: 'slot.' + m[1], slot: m[1], keys: { [k]: keys[k] } };
      const at = k + '.at'; if (typeof keys[at] === 'string') g.keys[at] = keys[at];
      if (m[1] === '1' && typeof keys[MARK] === 'string') g.keys[MARK] = keys[MARK];
      g.at = +keys[at] || 0;
      for (const x in g.keys) used[x] = 1;
      out.push(g);
    }
    if (typeof keys[TOKEN] === 'string') {
      const g = { name: 'login', login: true, keys: { [TOKEN]: keys[TOKEN] } };
      if (typeof keys[NAME] === 'string') g.keys[NAME] = keys[NAME];
      used[TOKEN] = used[NAME] = 1; out.push(g);
    }
    for (const k of Object.keys(keys)) {
      if (used[k] || typeof keys[k] !== 'string' || !KEY_RE.test(k) || k.startsWith('fanglands.handoff')) continue;
      if (k === MARK || /^fanglands\.slot\.\d+\.at$/.test(k)) continue;
      out.push({ name: k, one: k, keys: { [k]: keys[k] } });
    }
    return out;
  }

  // Writes what this address does not already have newer. ls is {get, set, del}. Returns {wrote, kept} (group names).
  //   a slot: taken when this address has no save in that slot, or its copy is older (by the .at stamp)
  //   the login: taken only when this address is not logged in at all (never over a newer login)
  //   anything else (settings, hints, the last name, the old single save): taken only when it is not here yet
  // A group offered again exactly as before is left alone, so a slot deleted here does not come back from the old address.
  function merge(keys, ls) {
    let seen = {};
    try { seen = JSON.parse(ls.get(SEEN_KEY) || '{}') || {}; } catch (e) { seen = {}; }
    if (typeof seen !== 'object' || Array.isArray(seen)) seen = {};
    const wrote = [], kept = [];
    for (const g of groupsOf(keys || {})) {
      const f = fingerprint(g.keys);
      if (seen[g.name] === f) { kept.push(g.name); continue; }
      seen[g.name] = f;
      let take;
      if (g.slot) {
        const mine = ls.get('fanglands.slot.' + g.slot);
        take = mine == null || (mine !== g.keys['fanglands.slot.' + g.slot] && g.at > (+ls.get('fanglands.slot.' + g.slot + '.at') || 0));
      } else if (g.login) take = ls.get(TOKEN) == null;
      else take = ls.get(g.one) == null;
      if (!take) { kept.push(g.name); continue; }
      for (const k in g.keys) ls.set(k, g.keys[k]);
      if (g.slot === '1' && g.keys[MARK] == null) ls.del(MARK);   // slot 1 now holds what the old address had: a local knight
      wrote.push(g.name);
    }
    ls.set(SEEN_KEY, JSON.stringify(seen));
    return { wrote, kept };
  }

  const LS = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { } },
    del: k => { try { localStorage.removeItem(k); } catch (e) { } },
  };
  const HANDOFF = { merge, groupsOf, fingerprint, arriving: false, result: null, SEEN_KEY };
  window.HANDOFF = HANDOFF;

  // ---------- arriving with a code: claim it, write, take the code off the address, start again ----------
  const hash = (typeof location !== 'undefined' && location && typeof location.hash === 'string') ? location.hash : '';
  if (hash.startsWith('#handoff=')) {
    const strip = () => { try { history.replaceState(history.state, '', location.pathname + location.search); return true; } catch (e) { return false; } };
    const m = CODE_RE.exec(hash);
    if (!m || typeof fetch !== 'function') strip();   // a broken code: nothing to claim, the game just starts
    else {
      HANDOFF.arriving = true;
      let done = false;
      const restart = () => {
        if (done) return; done = true;
        if (strip()) { try { location.reload(); return; } catch (e) { } }
        location.replace(location.pathname + location.search);   // no fragment, so this is a real load, never a loop
      };
      setTimeout(restart, 10000);   // a world that does not answer never keeps the kid waiting long
      fetch('/api/handoff/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: m[1] }), cache: 'no-store', credentials: 'same-origin' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d && d.keys && typeof d.keys === 'object' && !Array.isArray(d.keys)) HANDOFF.result = merge(d.keys, LS); })
        .catch(() => { })
        .then(restart);
      // nothing else of the game runs on this load: it starts again in a moment with the knight in place
      throw new Error('Fanglands is bringing this browser\'s knight over from the old address. The game starts in a moment.');
    }
  }

  const P = 'handoff: ';
  HOOKS.selfTest.push((check) => {
    const mem = init => { const s = Object.assign({}, init); return { s, get: k => (k in s ? s[k] : null), set: (k, v) => { s[k] = String(v); }, del: k => { delete s[k]; } }; };
    const old = {
      'fanglands.session': 'tok-old', 'fanglands.lastname': 'Cohen',
      'fanglands.slot.1': '{"a":1}', 'fanglands.slot.1.at': '500', 'fanglands.slot.1.online': '1',
      'fanglands.slot.2': '{"b":2}', 'fanglands.slot.2.at': '400',
      'fanglands.settings': '{"sound":true}', 'fl_learn_bag': '3', 'fanglands.slot.current': '1',
    };
    // 1. an empty new address takes everything, exactly
    const a = mem();
    const r1 = merge(old, a);
    const same = Object.keys(old).every(k => a.s[k] === old[k]);
    check(P + 'an address with nothing yet takes the login, every slot with its stamp and mark, the settings and hints, exactly', same && r1.kept.length === 0 && r1.wrote.includes('login') && r1.wrote.includes('slot.1') && r1.wrote.includes('slot.2'), { wrote: r1.wrote, kept: r1.kept });
    // 2. newer things here are never overwritten: a newer login, a newer slot, its own settings
    const b = mem({ 'fanglands.session': 'tok-new', 'fanglands.lastname': 'Sam', 'fanglands.slot.1': '{"mine":1}', 'fanglands.slot.1.at': '900', 'fanglands.settings': '{"sound":false}', 'fanglands.slot.2': '{"older":1}', 'fanglands.slot.2.at': '100' });
    merge(old, b);
    check(P + 'a login here, a newer slot here and settings here are kept; an older slot here is replaced by the newer one', b.s['fanglands.session'] === 'tok-new' && b.s['fanglands.lastname'] === 'Sam' && b.s['fanglands.slot.1'] === '{"mine":1}' && b.s['fanglands.slot.1.at'] === '900' && !('fanglands.slot.1.online' in b.s) && b.s['fanglands.settings'] === '{"sound":false}' && b.s['fanglands.slot.2'] === '{"b":2}' && b.s['fanglands.slot.2.at'] === '400' && b.s['fl_learn_bag'] === '3', b.s);
    // 3. the same offer again changes nothing, even after a slot was deleted here on purpose; a changed slot comes through
    delete a.s['fanglands.slot.2']; delete a.s['fanglands.slot.2.at']; delete a.s['fanglands.session'];
    const r3 = merge(old, a);
    const moved = Object.assign({}, old, { 'fanglands.slot.2': '{"b":3}', 'fanglands.slot.2.at': '700' });
    merge(moved, a);
    check(P + 'an offer seen before is left alone (a deleted slot or a logout here stays that way); a slot changed on the old address since comes over', r3.wrote.length === 0 && !('fanglands.session' in a.s) && a.s['fanglands.slot.2'] === '{"b":3}' && a.s['fanglands.slot.2.at'] === '700', { r3, slot2: a.s['fanglands.slot.2'] });
    // 4. a slot 1 from the old address with no cloud mark clears a mark here; a lone mark or a lone stamp moves nothing
    const c = mem({ 'fanglands.slot.1': '{"x":0}', 'fanglands.slot.1.at': '1', 'fanglands.slot.1.online': '1' });
    merge({ 'fanglands.slot.1': '{"x":1}', 'fanglands.slot.1.at': '9' }, c);
    const d = mem({ 'fanglands.slot.1': '{"mine":1}' });
    merge({ 'fanglands.slot.1.online': '1', 'fanglands.slot.3.at': '5', 'fanglands.handoff.seen': '{}', 'evil': 'x' }, d);
    check(P + 'slot 1 and its cloud mark move together; a mark or a stamp with no slot beside it, and keys that are not the game\'s, move nothing', c.s['fanglands.slot.1'] === '{"x":1}' && !('fanglands.slot.1.online' in c.s) && !('fanglands.slot.1.online' in d.s) && !('fanglands.slot.3.at' in d.s) && !('evil' in d.s) && d.s['fanglands.slot.1'] === '{"mine":1}', { c: c.s, d: d.s });
    check(P + 'no code on the address: the game boots as always', !HANDOFF.arriving);
  });
}
