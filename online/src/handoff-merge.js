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

// deviceKnights(get, keys, world): how many knights this browser holds that are NOT on the server, read from storage
// (get: k -> string or null; keys: every name in storage). src/00-handoff.js has the same function word for word (a
// test holds them together). world is what the world holds of the logged-in account's knight: null when nothing is
// known (no login, or the world did not answer), the summary the offer answers with ({fp, play, line}: knightOf below;
// fp null when the account has no knight in the world yet), or the world's save string itself (the game asks for it).
// It reads no note of any other file, only the slots and the save inside them, so no renamed note can change it:
//   - a slot (fanglands.slot.N) holding a knight (JSON with a player) is ON THE SERVER when it is the very string the
//     world holds (the same fingerprint), or when it is inside the world's copy by the knight's line (player.line, which
//     feat/no-play-alone writes: [segment, play seconds when it began] per start; the same test as 72-deviceknights'
//     lineIn: they share a segment and this copy's play on it ends where the world's copy went on, or before);
//   - anything else counts: every knight when nothing is known, a knight no account owns, another account's copy (it may
//     hold progress only here), a copy of this account with progress the world does not have (an upload that never
//     landed: it must not be stranded here), a save from before the line that is not the world's exact string.
// The old single save (fanglands.save.v2) counts only when the game would still make it slot 1 (no slot 1 and no
// current slot, src/14-title.js); otherwise it is a mirror of a slot. A backup 72-deviceknights keeps
// (fanglands.kept.<name>) is not a knight; the admin's https://gorkscape.ca/#kept, which lists them, is never sent across.
export const KNIGHTS_SOURCE = String.raw`function deviceKnights(get, keys, world) {
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
}`;

// knightOf(raw): what the offer's answer says of the account's knight in the world, for deviceKnights above: its
// fingerprint, its play seconds and its line (the last LINE_MAX segments, each [segment, play seconds]). null when the
// account has no knight there (or it is not a knight). The World runs this one (the pages run the text above); a test
// holds the two to the same answers.
export const LINE_MAX = 40;
export function knightOf(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  let d = null;
  try { d = JSON.parse(raw); } catch (e) { return null; }
  if (!d || typeof d !== 'object' || !d.player || typeof d.player !== 'object' || Array.isArray(d.player)) return null;
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  const line = (Array.isArray(d.player.line) ? d.player.line : [])
    .filter(e => Array.isArray(e) && typeof e[0] === 'string' && e[0].length <= 64 && Number.isFinite(+e[1]))
    .slice(-LINE_MAX).map(e => [e[0], +e[1]]);
  return { fp: h.toString(36) + '.' + raw.length, play: +d.player.playSeconds || 0, line };
}
