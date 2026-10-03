// ============================================================================
// THE HAND-OVER MERGE — what a browser arriving on fanglands.com writes from what its old address offered
// docs/ONLINE.md, "Two addresses". The landing page on the new address (handoff.js landingPage) claims the code and runs
// this function in the browser, before the game (or /admin, or any page) loads, so the game boots once with everything
// in place. The page carries this function's source as text (MERGE_SOURCE, below), so it must stay self-contained: no
// names from outside it, nothing but the arguments. It is kept as text, not as a function, because the bundler that
// ships the Worker rewrites functions (wrangler's keep_names adds __name(...) calls the page does not have; the round-3
// test world showed a claim that landed and wrote nothing): a string reaches the page exactly as written here.
// The Worker never runs it (Workers allow no eval); online/test/handoff-merge.test.mjs makes it a function and runs
// every rule, and handoff.test.mjs runs the landing page as the bundler ships it.
//
// keys: {name: string} as the old address offered them; ls: {get, set, del, keys}; now: ms; from: the old address the
// offer was made on ('gorkscape.ca', 'www.gorkscape.ca', ...), which the world says, not the page.
// Returns {wrote, kept, moved, left, replaced}.
//
// The rules, in plain words:
//   - Nothing here is ever written over, with one exception: a knight this merge itself put here from the same slot of
//     the same old address, untouched here since, is brought up to date in its place (an old tab kept playing it on the
//     old address). That is the same knight, so it never becomes a second copy. A copy that was played here stays as
//     it is: the knight played on fanglands.com is the one kept.
//   - Slot 1 with the cloud mark is the account's working copy: the knight is on the server, so it is never brought
//     (logging in brings it back). The old page does not even send it; this skips it if it comes.
//   - Any other slot (a knight held only on that device) lands in its own slot when that is free here, else in the
//     first free slot from 2 up to 99 (src/72-deviceknights.js offers every one of those into an empty account; the
//     title's three cards show slots 1 to 3). A save already in any slot here is not brought twice.
//   - The login (token with the last name typed) only when this address is not logged in at all.
//   - Settings, hints and the rest only when they are not here, or still exactly what the game wrote by itself at boot
//     (fanglands.handoff.boot, kept by src/00-handoff.js), so a first look at fanglands.com does not shut out the kid's
//     own kid mode and text size. The list of knights already brought into an account (fanglands.brought) is joined.
//   - Each group that landed (or was looked at and left alone on purpose) is remembered per old address and slot, so
//     the same offer again changes nothing: a slot deleted here, a logout here, stays that way.
//   - A stamp (.at) from the future is brought back to now.
// ============================================================================

export const MERGE_SOURCE = String.raw`function handoffMerge(keys, ls, now, from) {
  const SEEN_KEY = 'fanglands.handoff.seen', BOOT_KEY = 'fanglands.handoff.boot';
  const TOKEN = 'fanglands.session', NAME = 'fanglands.lastname', MARK = 'fanglands.slot.1.online', BROUGHT = 'fanglands.brought';
  const KEY_RE = /^(fanglands\.|fl_)[A-Za-z0-9_.:-]{1,160}$/;
  const SLOT_RE = /^fanglands\.slot\.(\d+)$/, AT_RE = /^fanglands\.slot\.\d+\.at$/;
  const MAX_SLOT = 99;
  const SLOT = n => 'fanglands.slot.' + n;
  const fp = s => { s = String(s); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36) + '.' + s.length; };
  const parse = (raw, dflt) => { try { const v = JSON.parse(raw || 'null'); return v && typeof v === 'object' ? v : dflt; } catch (e) { return dflt; } };
  const isOther = k => KEY_RE.test(k) && !/admin/i.test(k) && !SLOT_RE.test(k) && !AT_RE.test(k) && k !== MARK && k !== TOKEN && k !== NAME && !k.startsWith('fanglands.handoff');
  now = +now || Date.now();
  keys = keys && typeof keys === 'object' && !Array.isArray(keys) ? keys : {};
  const src = typeof from === 'string' && from ? from : '?';
  const seen = parse(ls.get(SEEN_KEY), {}), boot = parse(ls.get(BOOT_KEY), {});
  const wrote = [], kept = [], left = [], moved = {}, replaced = [];
  const str = k => typeof keys[k] === 'string';
  const stamp = raw => (raw == null || !(+raw > 0)) ? String(now) : (+raw > now ? String(now) : String(raw));
  const hasSlot = n => ls.get(SLOT(n)) != null;
  const holding = val => { for (let n = 1; n <= MAX_SLOT; n++) if (ls.get(SLOT(n)) === val) return n; return 0; };

  // the slots, in slot order
  const slots = [];
  for (const k of Object.keys(keys)) { const m = SLOT_RE.exec(k); if (m && str(k) && +m[1] >= 1 && +m[1] <= MAX_SLOT) slots.push(+m[1]); }
  // the ones that can land in their own slot first, then the ones that must move, each in slot order
  const ownFree = n => !hasSlot(n) && !(n === 1 && ls.get(MARK) != null);
  slots.sort((a, b) => (ownFree(b) - ownFree(a)) || a - b);
  for (const n of slots) {
    const name = 'slot.' + n, id = src + '|' + name, val = keys[SLOT(n)], at = keys[SLOT(n) + '.at'];
    if (n === 1 && str(MARK)) { kept.push(name); continue; }   // the cloud has it
    const f = fp(val + '\u0000' + (typeof at === 'string' ? at : ''));
    const prev = seen[id] && typeof seen[id] === 'object' ? seen[id] : null;
    if (prev && prev.f === f) { kept.push(name); continue; }
    const there = holding(val);
    if (there) { seen[id] = { f, to: there, w: fp(val) }; kept.push(name); continue; }
    if (prev && prev.to && prev.w) {
      // where the copy this merge put here is now (logging in may have moved it on from slot 1)
      let spot = 0;
      if (fp(ls.get(SLOT(prev.to)) || '') === prev.w) spot = prev.to;
      else for (let i = 1; i <= MAX_SLOT && !spot; i++) { const c = ls.get(SLOT(i)); if (c != null && fp(c) === prev.w) spot = i; }
      if (spot && !(spot === 1 && ls.get(MARK) != null)) {
        // that copy, untouched since: the same knight played on at the old address, brought up to date in its place
        ls.set(SLOT(spot), val); ls.set(SLOT(spot) + '.at', stamp(at));
        seen[id] = { f, to: spot, w: fp(val) }; replaced.push(name); wrote.push(name);
        continue;
      }
      if (ls.get(SLOT(prev.to)) != null) { seen[id] = { f, to: prev.to, w: prev.w }; kept.push(name); continue; }   // played here: this one stays
    }
    let to = 0;
    if (ownFree(n)) to = n;
    else for (let i = 2; i <= MAX_SLOT && !to; i++) if (!hasSlot(i)) to = i;
    if (!to) { left.push(name); continue; }
    ls.set(SLOT(to), val); ls.set(SLOT(to) + '.at', stamp(at));
    if (to === 1) ls.del(MARK);
    if (to !== n) moved[name] = 'slot.' + to;
    seen[id] = { f, to, w: fp(val) }; wrote.push(name);
  }

  // the login
  if (str(TOKEN)) {
    const g = { [TOKEN]: keys[TOKEN] }; if (str(NAME)) g[NAME] = keys[NAME];
    const id = src + '|login', f = fp(JSON.stringify(g));
    if (seen[id] === f) kept.push('login');
    else {
      seen[id] = f;
      if (ls.get(TOKEN) == null) { for (const k in g) { ls.set(k, g[k]); delete boot[k]; } wrote.push('login'); }
      else kept.push('login');
    }
  }

  // the knights already brought into an account: both lists, joined
  if (str(BROUGHT)) {
    let a = parse(ls.get(BROUGHT), []), b = parse(keys[BROUGHT], []);
    a = Array.isArray(a) ? a.filter(x => typeof x === 'string') : []; b = Array.isArray(b) ? b.filter(x => typeof x === 'string') : [];
    const all = a.concat(b.filter(x => !a.includes(x)));
    if (all.length !== a.length) { ls.set(BROUGHT, JSON.stringify(all.slice(-200))); wrote.push(BROUGHT); } else kept.push(BROUGHT);
  }

  // settings, hints, the rest
  for (const k of Object.keys(keys).sort()) {
    if (!str(k) || !isOther(k) || k === BROUGHT) continue;
    const id = src + '|' + k, f = fp(keys[k]);
    if (seen[id] === f) { kept.push(k); continue; }
    seen[id] = f;
    const mine = ls.get(k);
    if (mine == null || (typeof boot[k] === 'string' && boot[k] === mine)) { ls.set(k, keys[k]); delete boot[k]; wrote.push(k); }
    else kept.push(k);
  }
  ls.set(SEEN_KEY, JSON.stringify(seen));
  ls.set(BOOT_KEY, JSON.stringify(boot));
  return { wrote, kept, moved, left, replaced };
}`;
