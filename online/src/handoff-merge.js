// ============================================================================
// THE HAND-OVER'S TWO RULES, as text the pages carry — docs/ONLINE.md, "Two addresses"
// The pages the World serves (handoff.js) carry these functions' source as text, so each must stay self-contained: no
// names from outside it, nothing but its arguments. They are kept as text, not as functions, because the bundler that
// ships the Worker rewrites functions (wrangler's keep_names adds __name(...) calls a page does not have; the round-3
// test world showed a claim that landed and wrote nothing): a string reaches the page exactly as written here.
// The Worker never runs them (Workers allow no eval); online/test/handoff-merge.test.mjs makes them functions and runs
// every rule, and handoff.test.mjs runs the pages as the bundler ships them.
//
// CARRY and HINT_RE: everything a hand-over may carry, and nothing else, ever: the login (fanglands.session), the last
// name typed (fanglands.lastname), the settings (src/43-settings.js: fanglands.settings holds sound, music, kid mode,
// taps, stick side, text size, speech speed, damage numbers, shake, levels, minimap, words, Fight back and the quest
// helper; the three older keys it still writes are fanglands.muted, fanglands.music and fanglands.kidmode) and the hint
// counters (src/59-hudkit.js: fl_learn_<id>, fl_coach_<id>), so a kid is not taught the bag again. NO save slot, no
// owner note, no parent-page key: every knight lives on the server and loads at login.
// ============================================================================

export const CARRY = ['fanglands.session', 'fanglands.lastname', 'fanglands.settings', 'fanglands.muted', 'fanglands.music', 'fanglands.kidmode'];
export const HINT_RE = /^fl_(learn|coach)_[A-Za-z0-9_]{1,40}$/;

// handoffMerge(keys, ls, from): what the landing page on the new address writes from a claim. keys: {name: string} as
// the old address offered them; ls: {get, set, del}; from: the old address the offer was made on, which the world says.
// Returns {wrote, kept}. In plain words:
//   - only what CARRY and HINT_RE allow is ever written (a claim can carry nothing else even if it tried)
//   - the login (the token with the last name) only when this address is not logged in at all, and the same login from
//     the same old address only once: a kid who logs out here stays logged out (fanglands.handoff.seen)
//   - a setting or a hint only when it is not here, or still exactly what the game wrote by itself at boot
//     (fanglands.handoff.boot, kept by src/00-handoff.js), so a first look at fanglands.com does not shut out the kid's
//     own kid mode and text size; what the kid set here is never written over
export const MERGE_SOURCE = String.raw`function handoffMerge(keys, ls, from) {
  const SEEN_KEY = 'fanglands.handoff.seen', BOOT_KEY = 'fanglands.handoff.boot';
  const TOKEN = 'fanglands.session', NAME = 'fanglands.lastname';
  const CARRY = ['fanglands.settings', 'fanglands.muted', 'fanglands.music', 'fanglands.kidmode'];
  const HINT_RE = /^fl_(learn|coach)_[A-Za-z0-9_]{1,40}$/;
  const fp = s => { s = String(s); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36) + '.' + s.length; };
  const parse = raw => { try { const v = JSON.parse(raw || 'null'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (e) { return {}; } };
  keys = keys && typeof keys === 'object' && !Array.isArray(keys) ? keys : {};
  const src = typeof from === 'string' && from ? from : '?';
  const seen = parse(ls.get(SEEN_KEY)), boot = parse(ls.get(BOOT_KEY));
  const wrote = [], kept = [];
  const str = k => typeof keys[k] === 'string';
  if (str(TOKEN)) {
    const g = { [TOKEN]: keys[TOKEN] }; if (str(NAME)) g[NAME] = keys[NAME];
    const id = src + '|login', f = fp(JSON.stringify(g));
    if (seen[id] === f || ls.get(TOKEN) != null) kept.push('login');
    else { for (const k in g) { ls.set(k, g[k]); delete boot[k]; } wrote.push('login'); }
    seen[id] = f;
  }
  for (const k of Object.keys(keys).sort()) {
    if (!str(k) || !(CARRY.includes(k) || HINT_RE.test(k))) continue;
    const mine = ls.get(k);
    if (mine == null || (typeof boot[k] === 'string' && boot[k] === mine)) { ls.set(k, keys[k]); delete boot[k]; wrote.push(k); }
    else kept.push(k);
  }
  ls.set(SEEN_KEY, JSON.stringify(seen));
  ls.set(BOOT_KEY, JSON.stringify(boot));
  return { wrote, kept };
}`;

// deviceKnights(get, keys, acct): how many knights this browser holds that are NOT on the server, read from storage
// (get: k -> string or null; keys: every name in storage). src/00-handoff.js has the same function word for word (a
// test holds them together). acct is the account a login is (lower case, as the world says it), '*' for any account
// (the hand-over page's first look, before the world has said whose the login is), or null for no login.
// A save that reads as a knight (JSON with a player) is ON THE SERVER when, by feat/no-play-alone's notes
// (src/71-login.js: fanglands.slot.N.online = the account, fanglands.slot.N.synced = "account|fingerprint" when the
// world confirmed holding that exact string; src/72-deviceknights.js: fanglands.dk.kept):
//   - it is a cloud copy: its owner note is acct and its synced note matches its exact string, or it is the same string
//     as such a copy;
//   - or its owner note is acct and that account chose the world's copy over it (fanglands.dk.kept);
//   - or its owner note is acct and it is not ahead of a cloud copy of acct held here (the same test as
//     72-deviceknights' ahead: more play time, or a later stamp at no less play time).
// Anything else counts: a knight with no owner, another account's copy, a copy with progress the world may not have, and
// every save when there is no login. A browser with none of the notes (before feat/no-play-alone) has no cloud copy,
// so every save counts. The old single save (fanglands.save.v2) counts only when the game would still make it slot 1
// (no slot 1 and no current slot, src/14-title.js); otherwise it is a mirror of a slot.
export const KNIGHTS_SOURCE = String.raw`function deviceKnights(get, keys, acct) {
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
}`;
