// ============================================================================
// TWO ADDRESSES — fanglands.com is the game's home; gorkscape.ca hands each browser over to it
// Owner (2026-10-03): "can you port everything over to the new proper domain but have gorkscape redirect to fang lands
// so anyone with the old domain doesnt notice the diffrance for now?"
//
// A browser keeps its saves and its login per address, so a plain redirect would land a kid on fanglands.com logged
// out. So a page on gorkscape.ca (or www.gorkscape.ca: its own storage, its own hand-over) is a tiny hand-over page,
// not the game. docs/ONLINE.md, "Two addresses", has the whole story; in short:
//   - an iPad home-screen icon (a page opened as an installed web app) is never sent away: the first launch sets a
//     cookie on the old address (/handoff-stay) and from then on the old address serves the game to it exactly as
//     today, full screen, no hops. The game shows a calm one-time note about the new home (src/00-handoff.js).
//   - a browser with nothing to hand over goes straight to the same path on fanglands.com.
//   - a browser with Fanglands keys offers them to the world, bound to a pull (a secret both of this browser's
//     addresses keep), and goes to fanglands.com/handoff#land=<code>. That landing page claims the code WITH the pull,
//     merges what is missing (handoff-merge.js, carried as text), takes the code off the address and history, and goes on to the same
//     path: the game, /admin, any page. The game page is loaded and parsed once.
//   - the first time, the pull is fetched from fanglands.com (/handoff#back=...), then both addresses keep it, so later
//     visits skip those two hops.
// Every page the kid sees on the way shows a small dark card, "Bringing your knight over...", never a blank screen.
// The code and the pull only ever ride after # (never sent to any server, in no log). A code made by anyone else is
// useless in this browser: it was bound to their pull. The keys wait in the World sealed with a key made from the code,
// which is never stored, so a row at rest (or in a backup bookmark) is unreadable.
// The world keeps two budgets, decided before the body of an offer is read: an offer carrying a login the world knows
// (a real kid: the token rides as "authorization: Bearer") has its own per-account budget that no anonymous offer can
// touch, and is never refused because the world is full; anonymous offers (knights held only on a device) are capped
// hard globally and per address (an IPv6 address counts by its /48), and one past its cap costs the world almost
// nothing (its body is never read). /api/* and /ws answer on every address exactly as before.
// ============================================================================

import { json, oops, bearer } from './http.js';
import { randomHex, sameString } from './auth.js';
import { MERGE_SOURCE } from './handoff-merge.js';

// where each old address hands over to (the test world mirrors the live one), and the old addresses each new one takes
export const MOVES = { 'gorkscape.ca': 'fanglands.com', 'www.gorkscape.ca': 'fanglands.com', 'test.gorkscape.ca': 'test.fanglands.com' };
export const HOMES = ['fanglands.com', 'www.fanglands.com', 'test.fanglands.com'];
export const OLDS = { 'fanglands.com': ['gorkscape.ca', 'www.gorkscape.ca'], 'test.fanglands.com': ['test.gorkscape.ca'] };
export const START_PATH = '/handoff';             // the start and landing page on a new address
export const STAY_PATH = '/handoff-stay';         // on an old address: a home-screen icon stays here (sets the cookie)
export const LEAVE_PATH = '/handoff-leave';       // on an old address: the cookie went somewhere it should not (clears it)
export const STAY_COOKIE = 'fl_stay';
export const STAY_DAYS = 400;
export const PULL_KEY = 'fanglands.handoff.pull'; // where each address keeps the pull: {n: 32 hex, at}
export const PULL_MS = 30 * 24 * 3600 * 1000;     // a pull is kept for 30 days on both addresses, then a new one is made
export const ARRIVING_KEY = 'fanglands.handoff.arriving';   // sessionStorage: the game page shows the card while it loads
export const HANDOFF_MS = 3 * 60 * 1000;          // a code is good for 3 minutes, then it is gone
export const HANDOFF_MAX = 1500000;               // bytes in one offer: three slots of up to 512 KB (SAVE_MAX) are about this
export const HANDOFF_KEYS_MAX = 400;              // keys in one offer
// anonymous offers (no login the world knows): per address (an IPv6 address by its /48) and all together
export const OFFERS_PER_MIN = 10, ADDRESS_BYTES_MAX = 3 * 1024 * 1024;
export const ANON_ROWS_MAX = 200, ANON_BYTES_MAX = 32 * 1024 * 1024;
// offers with a login the world knows (sent as "authorization: Bearer <token>" and in the keys): per account (the
// newest replaces the oldest past ACCT_ROWS_MAX or ACCT_BYTES_MAX), and all together. The whole is NEVER a reason to
// refuse one: anyone with the invite code can make accounts (world.js signup allows SIGNUPS_PER_HOUR per address), so
// about 90 accounts could fill LOGGED_BYTES_MAX. When it is full, the oldest offer of the account holding the most
// gives way (a real claim comes within about a second; one that lost its offer goes back and offers again).
export const ACCT_PER_MIN = 20, ACCT_ROWS_MAX = 2, ACCT_BYTES_MAX = 3 * 1024 * 1024;
export const LOGGED_ROWS_MAX = 2000, LOGGED_BYTES_MAX = 256 * 1024 * 1024;
export const CLAIM_FAILS_PER_MIN = 20, REFUSED_PER_MIN = 20;
// the hand-over page, when the world says "too busy": a login is tried again alone (LOGIN_RETRIES times, at most 10 s
// apart); an anonymous offer with knights is tried again every 20 to 30 s for ANON_TRY_MS (an offer waits three
// minutes at most, so by then the world has room again unless the flood goes on)
export const LOGIN_RETRIES = 2, ANON_TRY_MS = 3 * 60 * 1000;
export const LATER_KEY = 'fanglands.handoff.later';   // on a new address: {at, from} knights wait on that old address   // per address: claims that found nothing, calls from elsewhere
// the keys a browser may hand over: the game's own (fanglands.* and the fl_ hints), never the hand-over's own notes and
// never anything to do with the parent page (its key lives in sessionStorage today; this keeps it that way if it moves)
export const KEY_RE = /^(fanglands\.|fl_)[A-Za-z0-9_.:-]{1,160}$/;
export const keyAllowed = k => typeof k === 'string' && KEY_RE.test(k) && !k.startsWith('fanglands.handoff') && !/admin/i.test(k);
const CODE_RE = /^[0-9a-f]{64}$/;
const PULL_RE = /^[0-9a-f]{32}$/;
const AT_RE = /^fanglands\.slot\.\d+\.at$/;
const enc = new TextEncoder(), dec = new TextDecoder();
// a plain path on this address: starts with one /, no // or /\ (which a browser reads as another site), no spaces
export const PLAIN_PATH = /^\/(?![\/\\])[^\s\\#]*$/;
const plainPath = p => (typeof p === 'string' && PLAIN_PATH.test(p) ? p : '/');

// ---------- the front door: what an address serves when it is not /api or /ws ----------
// www.fanglands.com sends to the bare address for good (301, path and query kept). /handoff on a new address is the
// start and landing page. On an old address: /handoff-stay and /handoff-leave set and clear the home-screen cookie;
// with the cookie the game is served exactly as today; otherwise a page (the game, /admin, any HTML) is the hand-over
// page and anything else (an icon, a file) is sent on with a 302. Returns null when the static files should answer.
// env.HANDOVER = 'off' (wrangler deploy --var HANDOVER:off) keeps the old addresses serving the game as before: the
// first ship attaches fanglands.com with it off, so nobody is sent there before its address and certificate answer.
export function frontDoor(req, url, env) {
  const host = url.hostname.toLowerCase();
  const get = req.method === 'GET' || req.method === 'HEAD', head = req.method === 'HEAD';
  if (host === 'www.fanglands.com') return redirect('https://fanglands.com' + url.pathname + url.search, 301);
  if (OLDS[host] && url.pathname === START_PATH) return get ? landingPage(host, head) : redirect('https://' + host + '/', 302);
  const to = MOVES[host];
  if (!to) return null;
  if (url.pathname === STAY_PATH) return redirect(plainPath(url.searchParams.get('to')), 302, `${STAY_COOKIE}=1; Max-Age=${STAY_DAYS * 86400}; Path=/; Secure; SameSite=Lax`);
  if (url.pathname === LEAVE_PATH) return redirect(plainPath(url.searchParams.get('to')), 302, `${STAY_COOKIE}=; Max-Age=0; Path=/; Secure; SameSite=Lax`);
  if (env && env.HANDOVER === 'off') return null;
  if (stays(req)) return null;
  if (get && isPage(req, url)) return handoverPage(host, to, head);
  return redirect('https://' + to + url.pathname + url.search, 302);
}
function redirect(location, status, cookie) {
  const headers = { location, 'cache-control': status === 301 ? 'public, max-age=86400' : 'no-store', 'referrer-policy': 'no-referrer' };
  if (cookie) headers['set-cookie'] = cookie;
  return new Response(null, { status, headers });
}
// the home-screen cookie: set only by a page that was opened as an installed web app (handoverPage)
export function stays(req) {
  return (req.headers.get('cookie') || '').split(';').some(c => c.trim() === STAY_COOKIE + '=1');
}
// a page load, not a file the page asked for: what the browser says (Sec-Fetch-Dest), or for an older browser what it
// accepts, or the game's own paths
export function isPage(req, url) {
  const dest = req.headers.get('sec-fetch-dest');
  if (dest) return dest === 'document';
  if ((req.headers.get('accept') || '').includes('text/html')) return true;
  return /^\/(index\.html|admin|admin\/|admin\.html)?$/.test(url.pathname);
}

// ---------- the pages: one small dark card, the same on every hop ----------
const STYLE = `html,body{margin:0;height:100%;background:#0b0f14;color:#c9d1d9;font:16px "Trebuchet MS","Segoe UI",system-ui,sans-serif}
main{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:16px}
.box{max-width:340px;background:#141a22;border:1px solid #2a3340;border-radius:12px;padding:18px 22px;text-align:center;box-shadow:0 8px 30px #0008}
p{margin:0 0 12px;line-height:1.4}p:last-child{margin-bottom:0}.dim{color:#8b949e;font-size:14px}
a{color:#d9b25f}a.go{display:inline-block;min-width:96px;padding:12px 22px;border:1px solid #d9b25f;border-radius:8px;text-decoration:none;font-weight:700;margin:4px 0 12px}
[hidden]{display:none!important}`;
const CARD = `<main id="card" hidden><div class="box">
<div id="work"><p id="msg">Bringing your knight over...</p><p id="more" class="dim" hidden>Still working on it...</p></div>
<div id="waits" hidden><p id="waitText"></p><a class="go" id="ok" href="">OK</a></div>
<div id="stuck" hidden><p>Your knight is safe. It could not come across just now.</p><a class="go" id="again" href="">Try again</a><p class="dim"><a id="anyway" href="">Go to the game</a></p></div>
</div></main>`;
// the card's helpers, the same in every page script
const CARD_JS = `var $ = function (id) { return document.getElementById(id); };
  var show = function (id) { var e = $(id); if (e) e.hidden = false; };
  var hide = function (id) { var e = $(id); if (e) e.hidden = true; };
  var gone = false;
  var go = function (u) { if (gone) return; gone = true; location.replace(u); };
  var card = function () { show('card'); setTimeout(function () { if (!gone) show('more'); }, 4000); };
  var stuck = function (again, anyway) { hide('work'); hide('waits'); var a = $('again'); if (a) a.setAttribute('href', again); var b = $('anyway'); if (b) b.setAttribute('href', anyway); show('stuck'); show('card'); };`;
function page(script, head) {
  const nonce = randomHex(16);
  const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0b0f14">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Fanglands">
<title>Fanglands</title>
<style>${STYLE}</style>
${CARD}
<script nonce="${nonce}">
${script}
</script>
`;
  return new Response(head ? null : html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'content-security-policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    },
  });
}

// The hand-over page on an old address. Opened as an installed web app (an iPad home-screen icon): it stays, through
// /handoff-stay, so the old address serves the game from now on. Otherwise it reads this browser's Fanglands keys,
// leaving out what the server already has (slot 1 with the cloud mark, knights already brought into an account). With
// none it goes straight to the same path on the new address. With some, it shows the card and offers them bound to the
// pull: the one that came after # (and is now kept here too), or the one kept here from before; with neither, it first
// fetches one from the new address. A #handoff... fragment that arrived is never passed on: it may be someone else's.
// When the world says "too busy" (429 or 503): an offer with a login is tried again with the login alone, and a kid is
// never sent on without it (after two more refusals the card's Try again); an offer with no login but knights on this
// device is tried again for about three minutes, then the card says plainly what waits, and OK has the new address
// come back for them later. A world that cannot be reached is tried twice, then Try again. Nothing here is deleted.
export function handoverPage(self, to, head) {
  const script = `(function () {
  var HOME = ${JSON.stringify('https://' + to)}, SELF = ${JSON.stringify(self)};
  var PULL_KEY = ${JSON.stringify(PULL_KEY)}, PULL_LIFE = ${PULL_MS}, CAP = 1400000;
  var KEY_RE = ${KEY_RE.toString()}, SLOT_RE = /^fanglands\\.slot\\.(\\d+)$/, MARK = 'fanglands.slot.1.online', TOKEN = 'fanglands.session', NAME = 'fanglands.lastname';
  ${CARD_JS}
  var path = location.pathname || '/';
  if (!${PLAIN_PATH.toString()}.test(path)) path = '/';
  var here = path + (location.search || '');
  var h = location.hash || '';
  var handoffFrag = h.indexOf('#handoff') === 0;
  var standalone = false;
  try { standalone = navigator.standalone === true || !!(window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches)); } catch (e) { }
  if (standalone) { location.replace(${JSON.stringify(STAY_PATH)} + '?to=' + encodeURIComponent(here) + (handoffFrag ? '' : h)); return; }
  var pullIn = /^#handoff-pull(2?)=([0-9a-f]{32})$/.exec(h);
  var frag = handoffFrag ? '' : h;
  if (handoffFrag) { try { history.replaceState(null, '', here); } catch (e) { } }
  var fp = function (s) { var x = 0x811c9dc5; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x.toString(36) + '.' + s.length; };
  var all = {}, i, k, v;
  try {
    for (i = 0; i < localStorage.length; i++) {
      k = localStorage.key(i);
      if (!k || !KEY_RE.test(k) || k.indexOf('fanglands.handoff') === 0 || /admin/i.test(k)) continue;
      v = localStorage.getItem(k);
      if (typeof v === 'string') all[k] = v;
    }
  } catch (e) { }
  // already on the server: the account's working copy (slot 1 with its mark), and knights brought into an account
  if (all[MARK] != null) { delete all['fanglands.slot.1']; delete all['fanglands.slot.1.at']; delete all[MARK]; }
  var brought = []; try { brought = JSON.parse(all['fanglands.brought'] || '[]'); } catch (e) { } if (!Array.isArray(brought)) brought = [];
  var knights = 0;
  for (k in all) { var sm = SLOT_RE.exec(k); if (!sm) continue; if (brought.indexOf(fp(all[k])) >= 0) { delete all[k]; delete all[k + '.at']; } }
  for (k in all) if (SLOT_RE.test(k)) knights++;
  var any = false; for (k in all) { any = true; break; }
  if (!any || typeof fetch !== 'function' || typeof JSON === 'undefined') { go(HOME + here + frag); return; }
  // the pull: the one that just came (kept here from now on), or the one kept here, or fetch one from the new address
  var pull = null;
  try {
    if (pullIn) { pull = pullIn[2]; localStorage.setItem(PULL_KEY, JSON.stringify({ n: pull, at: Date.now() })); }
    else {
      var had = JSON.parse(localStorage.getItem(PULL_KEY) || 'null');
      if (had && /^[0-9a-f]{32}$/.test(had.n) && Date.now() - had.at >= 0 && Date.now() - had.at < PULL_LIFE) pull = had.n;
    }
  } catch (e) { if (pullIn) pull = pullIn[2]; }
  card();
  if (!pull) { go(HOME + ${JSON.stringify(START_PATH)} + '#back=' + encodeURIComponent(here) + '&from=' + SELF); return; }
  // packed under the cap: the login and the small keys first, then the slots newest first, the oldest kind of save last
  var size = function (k, v) { return unescape(encodeURIComponent(JSON.stringify(k) + JSON.stringify(v))).length + 2; };
  var groups = [], small = {}, slots = [], key;
  for (key in all) {
    var m = SLOT_RE.exec(key);
    if (m) { var g = {}; g[key] = all[key]; var at = key + '.at'; if (all[at] != null) g[at] = all[at]; slots.push({ at: +all[at] || 0, g: g }); }
  }
  var inSlots = {}; for (i = 0; i < slots.length; i++) for (key in slots[i].g) inSlots[key] = 1;
  for (key in all) if (!inSlots[key] && key !== 'fanglands.save.v2' && !/^fanglands\\.slot\\.\\d+\\.at$/.test(key)) small[key] = all[key];
  groups.push(small);
  slots.sort(function (a, b) { return b.at - a.at; });
  for (i = 0; i < slots.length; i++) groups.push(slots[i].g);
  if (all['fanglands.save.v2'] != null) groups.push({ 'fanglands.save.v2': all['fanglands.save.v2'] });
  var keys = {}, used = 64, sent = 0;
  for (i = 0; i < groups.length; i++) {
    var gs = 0; for (key in groups[i]) gs += size(key, groups[i][key]);
    if (used + gs > CAP) continue;
    used += gs; for (key in groups[i]) { keys[key] = groups[i][key]; sent++; }
  }
  if (!sent) { go(HOME + here + frag); return; }
  // a login goes as "authorization: Bearer" too: the world picks the login's own budget before it reads anything
  var token = typeof keys[TOKEN] === 'string' ? keys[TOKEN] : '';
  var loginOnly = {}; if (token) { loginOnly[TOKEN] = token; if (typeof keys[NAME] === 'string') loginOnly[NAME] = keys[NAME]; }
  var landAt = function (code, later) { return HOME + ${JSON.stringify(START_PATH)} + '#land=' + code + '&to=' + encodeURIComponent(here) + '&from=' + SELF + (pullIn && pullIn[1] ? '&n=2' : '') + (later ? '&later=1' : ''); };
  var words = function (n) { return n === 1 ? 'Your knight saved on this device will come across next time. It is safe here.' : 'Your ' + n + ' knights saved on this device will come across next time. They are safe here.'; };
  var tell = function (n, href) { var w = $('waitText'); if (w) w.textContent = words(n); var ok = $('ok'); if (ok) ok.setAttribute('href', href); hide('work'); show('waits'); show('card'); };
  // the code is good; with only the login carried (the world was too busy for more), the kid is told what waits, and
  // the new address comes back for it later (#later: src/00-handoff.js)
  var land = function (code, alone) {
    if (alone && knights) { var u = landAt(code, true); tell(knights, u); setTimeout(function () { go(u); }, 10000); return; }
    go(landAt(code, false));
  };
  // OK after an anonymous offer could not come: the new address notes that knights wait here, and comes back for them
  var later = function () { return HOME + ${JSON.stringify(START_PATH)} + '#later=1&to=' + encodeURIComponent(here) + '&from=' + SELF; };
  var tries = 0, refusals = 0, waited = 0;
  var gap = function (d, lo, hi) { d = +(d && d.wait) || 0; return Math.min(hi, Math.max(lo, d)) * 1000; };
  // the world said "too busy" (429 or 503: its own budget, or Cloudflare itself under load)
  var refused = function (d, body) {
    refusals++;
    if (token) {
      // a login is never dropped: try again with the login alone (small, in the account's own budget), at most twice,
      // waiting what the world asked (at most 10 s); then the card's Try again. Never on to the game without it.
      if (refusals <= ${LOGIN_RETRIES}) { setTimeout(function () { attempt(loginOnly); }, gap(d, 1, 10)); return; }
      stuck(here, HOME + here + frag); return;
    }
    // no login: with no knight waiting (settings, hints) there is nothing to hold the kid up for
    if (!knights) { go(HOME + here + frag); return; }
    // knights held only on this device: keep trying for about three minutes (waiting offers run out in three), the card
    // saying "Still working on it...", then say plainly what waits, with OK
    show('more');
    if (waited < ${ANON_TRY_MS}) { var g = gap(d, 20, 30); waited += g; setTimeout(function () { attempt(body); }, g); return; }
    tell(knights, later());
  };
  function attempt(body) {
    tries++;
    var over = false, ctl = null;
    try { ctl = new AbortController(); } catch (e) { }
    var miss = function () { if (over || gone) return; over = true; clearTimeout(timer); if (tries < 2) setTimeout(function () { attempt(body); }, 1500); else stuck(here, HOME + here + frag); };
    var timer = setTimeout(function () { if (ctl) ctl.abort(); miss(); }, 8000);
    var hd = { 'content-type': 'application/json' }; if (token) hd.authorization = 'Bearer ' + token;
    fetch('/api/handoff/offer', { method: 'POST', headers: hd, body: JSON.stringify({ keys: body, pull: pull }), cache: 'no-store', credentials: 'same-origin', signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        if (over || gone) return;
        if (r.status === 429 || r.status === 503) {
          over = true; clearTimeout(timer); tries = 0;
          var on = function (d) { if (!gone) refused(d, body); };
          return r.json().then(on, function () { on(null); });
        }
        if (!r.ok) { miss(); return; }
        return r.json().then(function (d) {
          if (over || gone) return;
          if (d && typeof d.code === 'string' && /^[0-9a-f]{64}$/.test(d.code)) { over = true; clearTimeout(timer); land(d.code, body === loginOnly); }
          else miss();
        });
      })
      .catch(miss);
  }
  attempt(keys);
})();`;
  return page(script, head);
}

// The start and landing page on a new address (/handoff). Two jobs, by what came after #:
//   #back=<path>&from=<old>: the first visit. It keeps a pull here (reusing the one kept, while it is under 30 days old)
//     and goes back to the old address it came from with it after #.
//   #later=1&to=<path>&from=<old>: knights wait on the old address (it was too busy to take them): it notes that here
//     (fanglands.handoff.later) and goes on to the path; src/00-handoff.js comes back for them on a later boot.
//   #land=<code>&to=<path>&from=<old>[&n=2][&later=1]: it takes the fragment off the address and history first, claims
//     the code WITH the pull kept here, merges what is missing (handoff-merge.js) and goes on to the path: the game,
//     /admin, any page. With later=1 only the login came, and the note above is made; without it, a note for that old
//     address goes (everything came). A claim that finds nothing (the pull here is not the one the old address used,
//     or the code ran out) or gets no answer goes back to the old address once with this address's pull, so it offers again (it keeps everything
//     there); a second miss shows the card's Try again. A path that is not a plain path here becomes /; an old address
//     that is not one of this address's own becomes the first of them.
export function landingPage(host, head) {
  const olds = OLDS[host] || [];
  const script = `(function () {
  var OLDS = ${JSON.stringify(olds)}, PULL_KEY = ${JSON.stringify(PULL_KEY)}, PULL_LIFE = ${PULL_MS}, ARRIVING = ${JSON.stringify(ARRIVING_KEY)}, LATER = ${JSON.stringify(LATER_KEY)};
  var merge = ${MERGE_SOURCE};
  ${CARD_JS}
  var h = location.hash || '';
  try { history.replaceState(null, '', location.pathname); } catch (e) { }
  var q = {};
  h.replace(/^#/, '').split('&').forEach(function (p) { var i = p.indexOf('='); if (i > 0) { try { q[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); } catch (e) { q[p.slice(0, i)] = ''; } } });
  var plain = function (p) { return typeof p === 'string' && ${PLAIN_PATH.toString()}.test(p) ? p : '/'; };
  var to = plain(q.back != null ? q.back : q.to);
  var from = OLDS.indexOf(q.from) >= 0 ? q.from : OLDS[0];
  var OLD = 'https://' + from;
  var LS = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { } },
  };
  // the pull kept here: the one from before while it is under 30 days old, or a new one; null when storage is off
  var keepPull = function () {
    try {
      var had = JSON.parse(localStorage.getItem(PULL_KEY) || 'null');
      if (had && /^[0-9a-f]{32}$/.test(had.n) && Date.now() - had.at >= 0 && Date.now() - had.at < PULL_LIFE) return had.n;
      var a = new Uint8Array(16); crypto.getRandomValues(a);
      var n = ''; for (var i = 0; i < a.length; i++) n += (a[i] < 16 ? '0' : '') + a[i].toString(16);
      localStorage.setItem(PULL_KEY, JSON.stringify({ n: n, at: Date.now() }));
      return JSON.parse(localStorage.getItem(PULL_KEY)).n === n ? n : null;
    } catch (e) { return null; }
  };
  if (!from) { go(to); return; }
  // knights wait on the old address (it was too busy to take them): noted here, so the game comes back for them on a
  // later boot (src/00-handoff.js), once
  var waitsThere = function () { LS.set(LATER, JSON.stringify({ at: Date.now(), from: from })); };
  if (q.later === '1' && q.land == null) { waitsThere(); go(to); return; }
  if (q.back != null) { var p0 = keepPull(); if (p0) { card(); go(OLD + to + '#handoff-pull=' + p0); } else go(to); return; }
  if (!/^[0-9a-f]{64}$/.test(q.land || '')) { go(to); return; }
  card();
  var second = q.n === '2';
  var again = function () {
    if (gone) return;
    var p = keepPull();
    if (second || !p) { stuck(OLD + to, to); return; }
    go(OLD + to + '#handoff-pull2=' + p);
  };
  var pull = keepPull();
  if (!pull) { go(to); return; }
  var over = false, ctl = null;
  try { ctl = new AbortController(); } catch (e) { }
  var timer = setTimeout(function () { if (over) return; over = true; if (ctl) ctl.abort(); again(); }, 9000);
  fetch('/api/handoff/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: q.land, pull: pull }), cache: 'no-store', credentials: 'same-origin', signal: ctl ? ctl.signal : undefined })
    .then(function (r) {
      if (over) return;
      if (!r.ok) { over = true; clearTimeout(timer); again(); return; }
      return r.json().then(function (d) {
        if (over) return;
        over = true; clearTimeout(timer);
        if (!d || !d.keys || typeof d.keys !== 'object') { again(); return; }
        try { merge(d.keys, LS, Date.now(), d.from); } catch (e) { }
        if (q.later === '1') waitsThere();
        else { try { var lt = JSON.parse(LS.get(LATER) || 'null'); if (lt && lt.from === from) LS.del(LATER); } catch (e) { } }
        if (!/^\\/admin/.test(to)) { try { sessionStorage.setItem(ARRIVING, '1'); } catch (e) { } }
        go(to);
      });
    })
    .catch(function () { if (over) return; over = true; clearTimeout(timer); again(); });
})();`;
  return page(script, head);
}

// ---------- the World's side: POST /api/handoff/offer and POST /api/handoff/claim ----------
// Called by World.route for every /api call: answers the two hand-over calls, and clears out codes that ran out (after
// every hand-over call, and at most once a minute on any other). Returns null for every other call.
export async function handoffCall(world, req, url, path, method) {
  const now = world.now();
  const h = world.handoff || (world.handoff = { made: false, swept: 0, rate: new Map(), salt: randomHex(16) });
  if (!h.made) {
    world.sql.exec('CREATE TABLE IF NOT EXISTS handoffs (id TEXT PRIMARY KEY, keys TEXT NOT NULL, bytes INTEGER NOT NULL, expires INTEGER NOT NULL)');
    // added to a table made before them: the pull a claim must bring (SHA-256), which address offered (salted SHA-256,
    // anonymous offers only), the account a login offer is for, and the old address it was made on
    for (const col of ['bind', 'who', 'acct', 'src']) { try { world.sql.exec(`ALTER TABLE handoffs ADD COLUMN ${col} TEXT`); } catch (e) { } }
    h.made = true;
  }
  const sweep = () => { world.sql.exec('DELETE FROM handoffs WHERE expires <= ?', now); h.swept = now; };
  if (!path.startsWith('/api/handoff/')) { if (now - h.swept > 60000) sweep(); return null; }
  try {
    const isOffer = path === '/api/handoff/offer', isClaim = path === '/api/handoff/claim';
    if (!isOffer && !isClaim) throw oops(404, 'no such call', 'nope');
    if (method !== 'POST') throw oops(405, 'post it', 'bad');
    const who = addressOf(req.headers.get('cf-connecting-ip'));
    // only the game's own addresses: an offer is made on an old address, a claim on the new one (refusals count too)
    const host = url.hostname.toLowerCase();
    const okHost = isOffer ? Object.prototype.hasOwnProperty.call(MOVES, host) : HOMES.includes(host);
    if (!okHost || (req.headers.get('origin') || '') !== 'https://' + host) {
      limit(h.rate, 'x:' + who, REFUSED_PER_MIN, now);
      throw oops(403, 'not from here', 'origin');
    }
    return isOffer ? await offer(world, h, req, now, who, host) : await claim(world, h, req, now, who);
  } finally { sweep(); }
}

// The address a limit counts by: an IPv4 address as it is, an IPv6 address by its /48 (one home or one cloud machine
// often gets a whole /48 to /56, so counting each smaller block apart would let one place make thousands of
// "addresses").
export function addressOf(ip) {
  ip = String(ip || '').trim().toLowerCase();
  if (!ip) return '?';
  const v4 = /^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (v4) return v4[1];
  if (!ip.includes(':') || !/^[0-9a-f:.]+$/.test(ip)) return ip;
  const [a, b] = ip.split('::');
  const head = a ? a.split(':') : [], tail = b !== undefined && b ? b.split(':') : [];
  const fill = b !== undefined ? Math.max(0, 8 - head.length - tail.length) : 0;
  const all = head.concat(Array(fill).fill('0'), tail);
  return all.slice(0, 3).map(x => (parseInt(x, 16) || 0).toString(16)).join(':') + '::/48';
}

// A fixed one-minute window per key, kept in memory (a restart forgets it, which only ever lets more through).
function limit(rate, key, max, now) {
  if (rate.size > 5000) for (const [k, v] of rate) if (now - v.start >= 60000) rate.delete(k);
  let r = rate.get(key);
  if (!r || now - r.start >= 60000) { r = { start: now, n: 0 }; rate.set(key, r); }
  if (++r.n > max) throw oops(429, 'too many at once: wait a minute', 'wait', { wait: Math.ceil((r.start + 60000 - now) / 1000) });
}

async function readCapped(req, max) {
  const said = parseInt(req.headers.get('content-length') || '', 10);
  if (said > max) throw oops(413, 'that is too much to hand over', 'full');
  const text = await req.text();
  if (enc.encode(text).length > max) throw oops(413, 'that is too much to hand over', 'full');
  let v = null;
  try { v = JSON.parse(text); } catch (e) { }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw oops(400, 'expected a JSON object', 'bad');
  return v;
}

const hexOf = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
async function sha(text) { return hexOf(await crypto.subtle.digest('SHA-256', enc.encode(text))); }
// the keys wait sealed (AES-GCM) with a key made from the code, which is never stored: a row alone is unreadable
async function sealKey(code) {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode('fanglands handoff seal:' + code));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(code, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sealKey(code), enc.encode(text)));
  const out = new Uint8Array(12 + ct.length); out.set(iv, 0); out.set(ct, 12);
  return out;
}
async function unseal(code, blob) {
  if (typeof blob === 'string' || blob == null) return null;   // a row from before the keys were sealed: gone
  const b = blob instanceof Uint8Array ? blob : new Uint8Array(blob);
  if (b.length < 13) return null;
  try { return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, await sealKey(code), b.slice(12))); } catch (e) { return null; }
}

// the cap on anonymous offers waiting at once. The test world may set it LOWER (never higher) with
// `--var HANDOFF_ANON_ROWS_MAX:5`, so a flood at the cap can be proved there from one computer.
export function anonRowsMax(world) {
  const v = Math.floor(+(world && world.env && world.env.HANDOFF_ANON_ROWS_MAX));
  return v >= 1 ? Math.min(v, ANON_ROWS_MAX) : ANON_ROWS_MAX;
}

// the account a token belongs to, when the world knows it and it is live: read only (no last_seen, no deletes)
export function loginOf(world, token, now) {
  if (typeof token !== 'string' || !token || token.length > 200) return null;
  const r = world.sql.exec('SELECT s.name_lc AS lc FROM sessions s JOIN accounts a ON a.name_lc = s.name_lc WHERE s.token = ? AND s.expires >= ? AND a.banned = 0', token, now).toArray()[0];
  return r ? r.lc : null;
}

// {keys: {name: value}, pull} -> {code, expires, kind}. Every name must be one of the game's own keys and every value a
// string; pull is the 128-bit value this browser's addresses keep. The code is 256 random bits; only its SHA-256 is
// stored (with the pull's), and the keys are sealed with a key made from it. A save slot's .at stamp from the future is
// brought back to now.
// The budget is decided FIRST, from the headers alone, so a refused offer never costs the world the reading, hashing and
// sealing of up to 1.5 MB (the World runs every kid's game too):
//   - "authorization: Bearer <token>" with a live login: that account's own budget (ACCT_PER_MIN a minute; at most
//     ACCT_ROWS_MAX / ACCT_BYTES_MAX waiting, the newest replacing the oldest). The keys must carry the same token.
//     The world being full never refuses it: the oldest offer of the account holding the most gives way (makeRoom).
//   - anything else is anonymous: OFFERS_PER_MIN and ADDRESS_BYTES_MAX per address, ANON_ROWS_MAX and ANON_BYTES_MAX
//     all together, checked against the size the request says (or the most an offer may be, when it says none) before
//     the body is read, and again with the real size just before the write.
// Everything that waits is done before the last checks, so the checks and the write happen with nothing in between.
async function offer(world, h, req, now, who, host) {
  const token = bearer(req);
  const acct = loginOf(world, token, now);
  const said = parseInt(req.headers.get('content-length') || '', 10);
  const guess = said >= 0 && said <= HANDOFF_MAX ? said : HANDOFF_MAX;
  let whoId = null;
  if (acct) limit(h.rate, 'a:' + acct, ACCT_PER_MIN, now);
  else {
    limit(h.rate, 'o:' + who, OFFERS_PER_MIN, now);
    whoId = await sha(h.salt + who);
    anonRoom(world, whoId, guess, now);
  }
  const b = await readCapped(req, HANDOFF_MAX + 200);
  const keys = b.keys;
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) throw oops(400, 'send the keys', 'bad');
  if (typeof b.pull !== 'string' || !PULL_RE.test(b.pull)) throw oops(400, 'send the pull', 'bad');
  // the login the budget was chosen by is the one handed over (no token in either, or the same one in both)
  if ((typeof keys['fanglands.session'] === 'string' ? keys['fanglands.session'] : '') !== token) throw oops(400, 'the login in the keys is not the one sent', 'bad');
  const names = Object.keys(keys);
  if (!names.length) throw oops(400, 'nothing to hand over', 'bad');
  if (names.length > HANDOFF_KEYS_MAX) throw oops(413, 'that is too much to hand over', 'full');
  for (const k of names) {
    if (!keyAllowed(k)) throw oops(400, 'that is not a Fanglands key', 'bad');
    if (typeof keys[k] !== 'string') throw oops(400, 'every value is a string', 'bad');
    if (AT_RE.test(k) && +keys[k] > now) keys[k] = String(now);
  }
  const text = JSON.stringify(keys);
  const bytes = enc.encode(text).length;
  if (bytes > HANDOFF_MAX) throw oops(413, 'that is too much to hand over', 'full');
  const code = randomHex(32);
  const [id, bind, sealed] = [await sha(code), await sha('pull:' + b.pull), await seal(code, text)];
  // from here to the INSERT nothing waits
  if (acct) {
    const mine = world.sql.exec('SELECT id, bytes FROM handoffs WHERE acct = ? AND expires > ? ORDER BY expires ASC', acct, now).toArray();
    let n = mine.length, sum = mine.reduce((a, r) => a + r.bytes, 0);
    for (const r of mine) {
      if (n < ACCT_ROWS_MAX && sum + bytes <= ACCT_BYTES_MAX) break;
      world.sql.exec('DELETE FROM handoffs WHERE id = ?', r.id); n--; sum -= r.bytes;
    }
    makeRoom(world, acct, bytes, now);
  } else anonRoom(world, whoId, bytes, now);
  const expires = now + HANDOFF_MS;
  world.sql.exec('INSERT INTO handoffs (id, keys, bytes, expires, bind, who, acct, src) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', id, sealed, bytes, expires, bind, whoId, acct, host);
  return json({ code, expires, kind: acct ? 'login' : 'device' });
}

// an anonymous offer of about `bytes`: refused when its address or the world's anonymous budget is full
function anonRoom(world, whoId, bytes, now) {
  const mine = world.sql.exec('SELECT COALESCE(SUM(bytes), 0) AS b FROM handoffs WHERE acct IS NULL AND who = ? AND expires > ?', whoId, now).toArray()[0] || { b: 0 };
  if (mine.b + bytes > ADDRESS_BYTES_MAX) throw oops(429, 'too many at once: wait a minute', 'wait', { wait: Math.ceil(HANDOFF_MS / 1000) });
  const held = world.sql.exec('SELECT COUNT(*) AS n, COALESCE(SUM(bytes), 0) AS b FROM handoffs WHERE acct IS NULL AND expires > ?', now).toArray()[0] || { n: 0, b: 0 };
  if (held.n >= anonRowsMax(world) || held.b + bytes > ANON_BYTES_MAX) throw oops(503, 'too many hand-overs at once: try again soon', 'busy');
}

// Room for a login offer of `bytes` in the logged-in budget, never a refusal: while the whole is full, the oldest offer
// of the account holding the most bytes (then the most offers, then the oldest), other than this one, gives way.
// This account alone always fits (ACCT_ROWS_MAX x HANDOFF_MAX is far under the whole).
export function makeRoom(world, acct, bytes, now) {
  const held = world.sql.exec('SELECT COUNT(*) AS n, COALESCE(SUM(bytes), 0) AS b FROM handoffs WHERE acct IS NOT NULL AND expires > ?', now).toArray()[0] || { n: 0, b: 0 };
  let n = held.n, sum = held.b, gave = 0;
  while (n + 1 > LOGGED_ROWS_MAX || sum + bytes > LOGGED_BYTES_MAX) {
    const big = world.sql.exec('SELECT acct FROM handoffs WHERE acct IS NOT NULL AND acct != ? AND expires > ? GROUP BY acct ORDER BY SUM(bytes) DESC, COUNT(*) DESC, MIN(expires) ASC LIMIT 1', acct, now).toArray()[0];
    if (!big) break;
    const old = world.sql.exec('SELECT id, bytes FROM handoffs WHERE acct = ? AND expires > ? ORDER BY expires ASC LIMIT 1', big.acct, now).toArray()[0];
    if (!old) break;
    world.sql.exec('DELETE FROM handoffs WHERE id = ?', old.id);
    n--; sum -= old.bytes; gave++;
  }
  return gave;
}

// {code, pull} -> {keys, from}. One claim per code: the row is deleted before the answer goes back, whatever happens
// next, and nothing waits between reading the row and deleting it, so two claims of one code can never both get it.
// The pull must be the one the offer was bound to; a claim with any other pull is refused and does NOT use the code up.
// A code that ran out, was claimed already, never was, or comes with the wrong pull: all get the same answer, and count
// against the address (CLAIM_FAILS_PER_MIN). A real code with its pull always lands.
async function claim(world, h, req, now, who) {
  const b = await readCapped(req, 1024);
  const code = typeof b.code === 'string' ? b.code : '';
  const pull = typeof b.pull === 'string' ? b.pull : '';
  const gone = () => { limit(h.rate, 'c:' + who, CLAIM_FAILS_PER_MIN, now); return oops(404, 'that hand-over is gone', 'gone'); };
  if (!CODE_RE.test(code) || !PULL_RE.test(pull)) throw gone();
  const id = await sha(code), bind = await sha('pull:' + pull);
  const row = world.sql.exec('SELECT keys, expires, bind, src FROM handoffs WHERE id = ?', id).toArray()[0];
  if (!row) throw gone();
  if (row.expires <= now) { world.sql.exec('DELETE FROM handoffs WHERE id = ?', id); throw gone(); }
  if (!row.bind || !sameString(row.bind, bind)) throw gone();
  world.sql.exec('DELETE FROM handoffs WHERE id = ?', id);
  const text = await unseal(code, row.keys);
  if (text == null) throw gone();
  let keys = null; try { keys = JSON.parse(text); } catch (e) { }
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) throw gone();
  return json({ keys, from: typeof row.src === 'string' ? row.src : null });
}
