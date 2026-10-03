// ============================================================================
// TWO ADDRESSES — fanglands.com is the game's home; gorkscape.ca sends each browser there
// Owner (2026-10-03): "can you port everything over to the new proper domain but have gorkscape redirect to fang lands
// so anyone with the old domain doesnt notice the diffrance for now?"
//
// Every knight lives on the server now (no Play alone): a knight loads from the world at login, on any address. So
// only the LOGIN and the SETTINGS travel: a browser keeps its storage per address, and without them a plain redirect
// would land a kid on fanglands.com logged out, with kid mode and text size back to the start. docs/ONLINE.md, "Two
// addresses", has the whole story; in short, a page on gorkscape.ca (or www.gorkscape.ca: its own storage) is a tiny
// page that looks at this browser's storage first:
//   - an installed home-screen app (an iPad icon) is never sent away: /handoff-stay sets a cookie and the old address
//     serves it the game exactly as today, full screen, no hops (src/00-handoff.js shows a calm one-time note).
//   - a knight saved here that is NOT on the server (a device-only knight: src/00-handoff.js and the page share the
//     rule, KNIGHTS_SOURCE in handoff-merge.js, which compares each slot with what the world holds of the logged-in
//     account's knight): not sent. /handoff-here serves the game right here, as today, with a calm one-time note, so the
//     kid logs in there and brings that knight into an account (src/72-deviceknights.js). Once nothing is left only
//     here, the next visit is sent across. https://gorkscape.ca/#kept (the admin's list of the backups on a device) stays
//     too.
//   - no login and no save: a plain redirect to the same path on fanglands.com.
//   - a login: the login, the last name typed and a short list of settings (CARRY, under 8 KB) are offered to the world
//     WITH the login as "authorization: Bearer" (checked before the body is read; 401 without one), bound to a pull (a
//     secret both of this browser's addresses keep). The world answers with a code and what it holds of that account's
//     knight; with nothing here only on this device, the page goes to fanglands.com/handoff#land=<code>. That page
//     claims the code WITH the pull, writes what is missing (handoff-merge.js), takes the code off the address and the
//     history, and goes on to the same path: the game, /admin, any page.
// /handoff-stay and /handoff-here set a cookie so the next load goes straight to the game, and send this load to the
// game with a one-load marker (?fl_hop=stay or here, taken off the address by the game page at once), so a browser that
// refuses the cookie never goes round and round.
// Every page the kid sees on the way shows a small dark card, "Bringing your knight over...", never a blank screen.
// An offer waits in the World's MEMORY, never in its database: a hand-over writes no row, ever (the free plan's rows
// written a day stay the game's). Per account at most 2 wait and 30 are made an hour. /api/* and /ws answer on every
// address exactly as before.
// ============================================================================

import { json, oops, bearer } from './http.js';
import { randomHex, sameString } from './auth.js';
import { MERGE_SOURCE, KNIGHTS_SOURCE, CARRY, HINT_RE, knightOf } from './handoff-merge.js';

// where each old address sends to (the test world mirrors the live one), and the old addresses each new one takes
export const MOVES = { 'gorkscape.ca': 'fanglands.com', 'www.gorkscape.ca': 'fanglands.com', 'test.gorkscape.ca': 'test.fanglands.com' };
export const HOMES = ['fanglands.com', 'www.fanglands.com', 'test.fanglands.com'];
export const OLDS = { 'fanglands.com': ['gorkscape.ca', 'www.gorkscape.ca'], 'test.fanglands.com': ['test.gorkscape.ca'] };
export const START_PATH = '/handoff';             // the start and landing page on a new address
export const STAY_PATH = '/handoff-stay';         // on an old address: a home-screen icon stays here (sets fl_stay)
export const HERE_PATH = '/handoff-here';         // on an old address: a tab with a device-only knight plays here (fl_here)
export const LEAVE_PATH = '/handoff-leave';       // on an old address: fl_stay reached an ordinary tab (clears it)
export const STAY_COOKIE = 'fl_stay', STAY_DAYS = 400;
export const HERE_COOKIE = 'fl_here', HERE_SECS = 60;   // only for the one game page load that follows (the game clears it)
export const HOP_PARAM = 'fl_hop';               // ?fl_hop=stay|here: this one load is the game, cookie or none (no loop)
export const PULL_KEY = 'fanglands.handoff.pull'; // where each address keeps the pull: {n: 32 hex, at}
export const PULL_MS = 30 * 24 * 3600 * 1000;     // a pull is kept for 30 days on both addresses, then a new one is made
export const ARRIVING_KEY = 'fanglands.handoff.arriving';   // sessionStorage: the game page shows the card while it loads
export const TRIES_KEY = 'fanglands.handoff.tries';         // sessionStorage on the new address: a claim missed once
export { CARRY, HINT_RE };
export const HANDOFF_MS = 2 * 60 * 1000;          // a code is good for 2 minutes (a claim comes within seconds)
export const HANDOFF_MAX = 8 * 1024;              // bytes in one offer: a login, a name and settings are far less
export const ACCT_WAITING_MAX = 2;                // offers waiting per account (the newest replaces the oldest)
export const ACCT_PER_HOUR = 30;                  // offers per account an hour, counted before the body is read
export const WAITING_MAX = 4000;                  // offers waiting in all (4000 x 8 KB = 32 MB of the World's memory)
export const CLAIM_FAILS_PER_MIN = 20;            // claims that found nothing, per address
const HOUR = 3600 * 1000;
const CODE_RE = /^[0-9a-f]{64}$/;
const PULL_RE = /^[0-9a-f]{32}$/;
const enc = new TextEncoder();
// a key the hand-over carries: the login, the last name, the settings, the hint counters (and nothing else, ever)
export const carried = k => typeof k === 'string' && (CARRY.includes(k) || HINT_RE.test(k));
// a plain path on this address: starts with one /, no // or /\ (which a browser reads as another site), no spaces
export const PLAIN_PATH = /^\/(?![\/\\])[^\s\\#]*$/;
const plainPath = p => (typeof p === 'string' && PLAIN_PATH.test(p) ? p : '/');

// ---------- the front door: what an address serves when it is not /api or /ws ----------
// www.fanglands.com sends to the bare address for good (301, path and query kept). /handoff on a new address is the
// start and landing page. On an old address: /handoff-stay, /handoff-here and /handoff-leave set and clear the two
// cookies; with either cookie, or the one-load marker those two hops add (?fl_hop=, asked by this address's own page),
// the game is served exactly as today; otherwise a PAGE (the game, /admin, any HTML) is the hand-over page. Files are served on the old address as before. Returns null when the static files should answer.
// The hand-over runs only when env.HANDOVER is exactly 'on' ([vars] in wrangler.toml, committed: every deploy carries
// it). Anything else (off, missing, misspelled) keeps the old addresses serving the game as before.
export function frontDoor(req, url, env) {
  const host = url.hostname.toLowerCase();
  const get = req.method === 'GET' || req.method === 'HEAD', head = req.method === 'HEAD';
  if (host === 'www.fanglands.com') return redirect('https://fanglands.com' + url.pathname + url.search, 301);
  if (OLDS[host] && url.pathname === START_PATH) return get ? landingPage(host, head) : redirect('https://' + host + '/', 302);
  const to = MOVES[host];
  if (!to) return null;
  if (url.pathname === STAY_PATH) return cookieHop(req, url, STAY_COOKIE, STAY_DAYS * 86400);
  if (url.pathname === HERE_PATH) return cookieHop(req, url, HERE_COOKIE, HERE_SECS);
  if (url.pathname === LEAVE_PATH) return redirect(plainPath(url.searchParams.get('to')), 302, `${STAY_COOKIE}=; Max-Age=0; Path=/; Secure; SameSite=Lax`);
  if (!env || env.HANDOVER !== 'on') return null;
  if (hasCookie(req, STAY_COOKIE) || hasCookie(req, HERE_COOKIE) || hopped(req, url)) return null;
  if (get && isPage(req, url)) return handoverPage(host, to, head);
  return null;
}
function redirect(location, status, cookie) {
  const headers = { location, 'cache-control': status === 301 ? 'public, max-age=86400' : 'no-store', 'referrer-policy': 'no-referrer' };
  if (cookie) headers['set-cookie'] = cookie;
  return new Response(null, { status, headers });
}
// A cookie is set only when the hand-over page on this same address asked (Sec-Fetch-Site: same-origin; an older
// browser that does not say is believed). A link from anywhere else just goes to the path: nobody can park a browser on
// the old address from outside. The hop goes to the path WITH the one-load marker, so this load is the game even when the
// browser drops the cookie (blocked cookies, a managed profile): without it, an installed app that keeps no cookie went
// hand-over page, /handoff-stay, hand-over page... for ever, two Worker requests a turn, through a script's
// location.replace that no browser counts as too many redirects (round 5 review).
function cookieHop(req, url, name, secs) {
  const to = plainPath(url.searchParams.get('to'));
  if (!sameSite(req)) return redirect(to, 302);
  const q = to.indexOf('?'), parts = q < 0 ? [] : to.slice(q + 1).split('&').filter(p => p && p.split('=')[0] !== HOP_PARAM);
  parts.push(HOP_PARAM + '=' + (name === STAY_COOKIE ? 'stay' : 'here'));
  return redirect((q < 0 ? to : to.slice(0, q)) + '?' + parts.join('&'), 302, `${name}=1; Max-Age=${secs}; Path=/; Secure; SameSite=Lax`);
}
const sameSite = req => { const site = req.headers.get('sec-fetch-site'); return !site || site === 'same-origin'; };
// the one-load marker, only from this address's own hop (a link from elsewhere with it gets the hand-over page)
export const hopped = (req, url) => ['stay', 'here'].includes(url.searchParams.get(HOP_PARAM)) && sameSite(req);
export function hasCookie(req, name) {
  return (req.headers.get('cookie') || '').split(';').some(c => c.trim() === name + '=1');
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
<div id="stuck" hidden><p>Your knight is safe. It could not come across just now.</p><a class="go" id="again" href="">Try again</a><p class="dim"><a id="anyway" href="">Or go to the game and log in with your knight's name and secret word.</a></p></div>
</div></main>`;
// the card's helpers, the same in every page script
const CARD_JS = `var $ = function (id) { return document.getElementById(id); };
  var show = function (id) { var e = $(id); if (e) e.hidden = false; };
  var hide = function (id) { var e = $(id); if (e) e.hidden = true; };
  var gone = false;
  var go = function (u) { if (gone) return; gone = true; location.replace(u); };
  var card = function () { show('card'); setTimeout(function () { if (!gone) show('more'); }, 4000); };
  var stuck = function (again, anyway) { hide('work'); var a = $('again'); if (a) a.setAttribute('href', again); var b = $('anyway'); if (b) b.setAttribute('href', anyway); show('stuck'); show('card'); };`;
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

// The hand-over page on an old address, in this order:
//   1. opened as an installed web app (an iPad home-screen icon): /handoff-stay, and the game from then on, as today.
//   2. https://gorkscape.ca/#kept (the admin's list of the backups this device keeps, 72-deviceknights): /handoff-here.
//   3. no login: any knight saved here is not known to be on the server, so with one, /handoff-here (the game right here
//      with its one-time note; no offer, no card); with none, a plain redirect to the same path on the new address
//      (nothing else of this browser's goes there).
//   4. a login: the card; the pull (fetched once from the new address); the offer of the login and the settings with the
//      login as a Bearer token. The world answers with the code, the account, and what it holds of that account's knight
//      (knightOf: its fingerprint, play time and line). A knight here that is not inside that copy (another account's,
//      no account's, or this account's with progress that never reached the world) sends the tab to /handoff-here after
//      all: it logs in there and the game settles it (an upload that never landed goes up then), and the next visit
//      moves. Otherwise to the landing page with the code.
// A world that will not take the login (401: it ran out or was banned) is the same as no login. A world that is too busy
// or cannot be reached (tried twice): with any knight saved here the game is served here; with none, the card's Try
// again (or go to the game and log in). A #handoff fragment or a ?fl_hop marker that arrived is never passed on.
// Nothing here is deleted.
export function handoverPage(self, to, head) {
  const script = `(function () {
  var HOME = ${JSON.stringify('https://' + to)}, SELF = ${JSON.stringify(self)};
  var PULL_KEY = ${JSON.stringify(PULL_KEY)}, PULL_LIFE = ${PULL_MS}, CAP = ${HANDOFF_MAX - 256};
  var CARRY = ${JSON.stringify(CARRY)}, HINT_RE = ${HINT_RE.toString()}, TOKEN = 'fanglands.session';
  var deviceKnights = ${KNIGHTS_SOURCE};
  ${CARD_JS}
  var path = location.pathname || '/';
  if (!${PLAIN_PATH.toString()}.test(path)) path = '/';
  var search = (location.search || '').replace(/^[?]/, '').split('&').filter(function (p) { return p && p.split('=')[0] !== ${JSON.stringify(HOP_PARAM)}; }).join('&');
  var here = path + (search ? '?' + search : '');
  var h = location.hash || '';
  var handoffFrag = h.indexOf('#handoff') === 0;
  var frag = handoffFrag ? '' : h;
  var standalone = false;
  try { standalone = navigator.standalone === true || !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches); } catch (e) { }
  if (standalone) { location.replace(${JSON.stringify(STAY_PATH)} + '?to=' + encodeURIComponent(here) + frag); return; }
  var pullIn = /^#handoff-pull=([0-9a-f]{32})$/.exec(h);
  if (handoffFrag) { try { history.replaceState(null, '', here); } catch (e) { } }
  var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var names = [];
  try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k != null) names.push(k); } } catch (e) { }
  var stay = function () { go(${JSON.stringify(HERE_PATH)} + '?to=' + encodeURIComponent(here) + frag); };
  var across = function () { go(HOME + here + frag); };
  var token = get(TOKEN);
  if (typeof token !== 'string' || !token) token = '';
  // 2: the admin's list of this device's backups lives here
  if (h === '#kept') { stay(); return; }
  // 3: no login: a knight here stays here (nothing is known to be on the server); nothing to bring goes straight across
  var alone = function () { if (deviceKnights(get, names, null) > 0) stay(); else across(); };
  if (!token || typeof fetch !== 'function') { alone(); return; }
  // 4: the pull: the one that just came (kept here from now on), or the one kept here, or fetch one from the new address
  var pull = null;
  try {
    if (pullIn) { pull = pullIn[1]; localStorage.setItem(PULL_KEY, JSON.stringify({ n: pull, at: Date.now() })); }
    else {
      var had = JSON.parse(localStorage.getItem(PULL_KEY) || 'null');
      if (had && /^[0-9a-f]{32}$/.test(had.n) && Date.now() - had.at >= 0 && Date.now() - had.at < PULL_LIFE) pull = had.n;
    }
  } catch (e) { if (pullIn) pull = pullIn[1]; }
  card();
  if (!pull) { go(HOME + ${JSON.stringify(START_PATH)} + '#back=' + encodeURIComponent(here) + '&from=' + SELF); return; }
  // the login, then the settings, then the hint counters, while they fit under the cap
  var keys = {}, used = 64;
  var size = function (k, v) { return unescape(encodeURIComponent(JSON.stringify(k) + JSON.stringify(v))).length + 2; };
  var add = function (k) { var v = get(k); if (typeof v !== 'string') return; var s = size(k, v); if (k !== TOKEN && used + s > CAP) return; used += s; keys[k] = v; };
  for (i = 0; i < CARRY.length; i++) add(CARRY[i]);
  for (i = 0; i < names.length; i++) if (HINT_RE.test(names[i])) add(names[i]);
  var tries = 0;
  // the world could not take it: a knight saved here plays here; with none, the card's Try again
  var cannot = function () { if (deviceKnights(get, names, null) > 0) stay(); else stuck(here, HOME + here + frag); };
  var landAt = function (code) { return HOME + ${JSON.stringify(START_PATH)} + '#land=' + code + '&to=' + encodeURIComponent(here) + '&from=' + SELF; };
  function attempt() {
    tries++;
    var over = false, ctl = null;
    try { ctl = new AbortController(); } catch (e) { }
    var miss = function () { if (over || gone) return; over = true; clearTimeout(timer); if (tries < 2) setTimeout(attempt, 1500); else cannot(); };
    var timer = setTimeout(function () { if (ctl) ctl.abort(); miss(); }, 8000);
    fetch('/api/handoff/offer', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ keys: keys, pull: pull }), cache: 'no-store', credentials: 'same-origin', signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        if (over || gone) return;
        if (r.status === 401) { over = true; clearTimeout(timer); alone(); return; }
        if (r.status === 429 || r.status === 503) { over = true; clearTimeout(timer); cannot(); return; }
        if (!r.ok) { miss(); return; }
        return r.json().then(function (d) {
          if (over || gone) return;
          if (!d || typeof d.code !== 'string' || !/^[0-9a-f]{64}$/.test(d.code) || typeof d.name !== 'string') { miss(); return; }
          over = true; clearTimeout(timer);
          if (deviceKnights(get, names, d.knight && typeof d.knight === 'object' ? d.knight : null) > 0) { stay(); return; }
          go(landAt(d.code));
        });
      })
      .catch(miss);
  }
  attempt();
})();`;
  return page(script, head);
}

// The start and landing page on a new address (/handoff). Two jobs, by what came after #:
//   #back=<path>&from=<old>: the first visit. It keeps a pull here (reusing the one kept, while it is under 30 days old)
//     and goes back to the old address it came from with it after #.
//   #land=<code>&to=<path>&from=<old>: it takes the fragment off the address and history first, claims the code WITH the
//     pull kept here, writes what is missing (handoff-merge.js) and goes on to the path: the game, /admin, any page. A
//     claim that finds nothing (the pull here is not the one the old address used, the World restarted, the code ran
//     out) or gets no answer goes back to the old address once with this address's pull, so it offers again; this tab
//     remembers that (sessionStorage, two minutes), so a second miss shows the card's Try again. A path that is not a
//     plain path here becomes /; an old address that is not one of this address's own becomes the first of them.
export function landingPage(host, head) {
  const olds = OLDS[host] || [];
  const script = `(function () {
  var OLDS = ${JSON.stringify(olds)}, PULL_KEY = ${JSON.stringify(PULL_KEY)}, PULL_LIFE = ${PULL_MS}, ARRIVING = ${JSON.stringify(ARRIVING_KEY)}, TRIES = ${JSON.stringify(TRIES_KEY)};
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
  if (q.back != null) { var p0 = keepPull(); if (p0) { card(); go(OLD + to + '#handoff-pull=' + p0); } else go(to); return; }
  if (!/^[0-9a-f]{64}$/.test(q.land || '')) { go(to); return; }
  card();
  // missed once already in this tab, in the last two minutes?
  var missed = function () { try { var t = +sessionStorage.getItem(TRIES); return t > 0 && Date.now() - t >= 0 && Date.now() - t < 120000; } catch (e) { return true; } };
  var again = function () {
    if (gone) return;
    var p = keepPull();
    if (!p || missed()) { try { sessionStorage.removeItem(TRIES); } catch (e) { } stuck(OLD + to, to); return; }
    try { sessionStorage.setItem(TRIES, String(Date.now())); } catch (e) { }
    go(OLD + to + '#handoff-pull=' + p);
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
        try { merge(d.keys, LS, d.from); } catch (e) { }
        try { sessionStorage.removeItem(TRIES); } catch (e) { }
        if (!/^\\/admin/.test(to)) { try { sessionStorage.setItem(ARRIVING, '1'); } catch (e) { } }
        go(to);
      });
    })
    .catch(function () { if (over) return; over = true; clearTimeout(timer); again(); });
})();`;
  return page(script, head);
}

// ---------- the World's side: POST /api/handoff/offer and POST /api/handoff/claim ----------
// Called by World.route for every /api call: answers the two hand-over calls and returns null for every other one.
// Everything lives in the World's memory (world.handoff): the offers waiting, each account's count for the hour, the
// claims that found nothing per address. A restart of the World forgets it all: a code waiting then is simply gone (the
// landing page goes back once and the old address offers again), and a count starts again (which costs nothing: an
// offer writes no row). Nothing about a hand-over ever touches the database but reads: the login, and on an offer the
// account's latest save (what the world holds of its knight).
export async function handoffCall(world, req, url, path, method) {
  if (!path.startsWith('/api/handoff/')) return null;
  const now = world.now();
  const h = world.handoff || (world.handoff = { offers: new Map(), hours: new Map(), fails: new Map() });
  for (const [id, o] of h.offers) if (o.expires <= now) h.offers.delete(id);
  const isOffer = path === '/api/handoff/offer', isClaim = path === '/api/handoff/claim';
  if (!isOffer && !isClaim) throw oops(404, 'no such call', 'nope');
  if (method !== 'POST') throw oops(405, 'post it', 'bad');
  // only the game's own addresses: an offer is made on an old address, a claim on the new one
  const host = url.hostname.toLowerCase();
  const okHost = isOffer ? Object.prototype.hasOwnProperty.call(MOVES, host) : HOMES.includes(host);
  if (!okHost || (req.headers.get('origin') || '') !== 'https://' + host) throw oops(403, 'not from here', 'origin');
  return isOffer ? await offer(world, h, req, now, host) : await claim(h, req, now, addressOf(req.headers.get('cf-connecting-ip')));
}

// The address a limit counts by: an IPv4 address as it is, an IPv6 address by its /48 (one home or one cloud machine
// often gets a whole /48 to /56, so counting each smaller block apart would let one place make thousands of
// "addresses"). world.js's signup limit counts by it too.
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

// the account a token belongs to, when the world knows it and it is live: read only (no last_seen, no deletes)
export function loginOf(world, token, now) {
  if (typeof token !== 'string' || !/^[0-9a-f]{16,200}$/i.test(token)) return null;
  const r = world.sql.exec('SELECT s.name_lc AS lc FROM sessions s JOIN accounts a ON a.name_lc = s.name_lc WHERE s.token = ? AND s.expires >= ? AND a.banned = 0', token, now).toArray()[0];
  return r ? r.lc : null;
}

// {keys: {name: value}, pull} with "authorization: Bearer <token>" -> {code, expires, name}. In this order, and nothing
// is read, kept or counted before the step that needs it:
//   1. the login, from the header alone: a live login the world knows, or 401 (the body is never read)
//   2. that account's count for the hour (ACCT_PER_HOUR), counted here, before the body is read: past it, 429 `wait`
//   3. the World's room (WAITING_MAX offers in all): 503 `busy`
//   4. the body: at most HANDOFF_MAX bytes (413 `full`), the pull (32 hex), only the keys in CARRY or HINT_RE, only
//      strings, and the login in it the same one as the header (400 `bad`)
//   5. kept in memory under the SHA-256 of a 256-bit code, bound to the SHA-256 of the pull, for HANDOFF_MS; past
//      ACCT_WAITING_MAX for the account, its oldest goes. `name` is the account (lower case); `knight` is what the world
//      holds of its knight (knightOf: fingerprint, play time, line; null for none), from one more read of its latest
//      save (a read: the free plan's writes are untouched), so the page can tell a knight here the world has from one
//      it does not.
async function offer(world, h, req, now, host) {
  const token = bearer(req);
  const acct = loginOf(world, token, now);
  if (!acct) throw oops(401, 'log in first', 'login');
  let n = h.hours.get(acct);
  if (!n || now - n.start >= HOUR) { n = { start: now, count: 0 }; h.hours.set(acct, n); }
  if (n.count >= ACCT_PER_HOUR) throw oops(429, 'too many hand-overs this hour: wait a while', 'wait', { wait: Math.ceil((n.start + HOUR - now) / 1000) });
  if (h.offers.size >= WAITING_MAX) throw oops(503, 'too many hand-overs at once: try again soon', 'busy');
  n.count++;
  if (h.hours.size > 5000) for (const [k, v] of h.hours) if (now - v.start >= HOUR) h.hours.delete(k);
  const b = await readCapped(req, HANDOFF_MAX + 200);
  const keys = b.keys;
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) throw oops(400, 'send the keys', 'bad');
  if (typeof b.pull !== 'string' || !PULL_RE.test(b.pull)) throw oops(400, 'send the pull', 'bad');
  if (keys['fanglands.session'] !== token) throw oops(400, 'the login in the keys is not the one sent', 'bad');
  for (const k of Object.keys(keys)) {
    if (!carried(k)) throw oops(400, 'that is not something a hand-over carries', 'bad');
    if (typeof keys[k] !== 'string') throw oops(400, 'every value is a string', 'bad');
  }
  const text = JSON.stringify(keys);
  if (enc.encode(text).length > HANDOFF_MAX) throw oops(413, 'that is too much to hand over', 'full');
  const code = randomHex(32);
  const [id, bind] = [await sha(code), await sha('pull:' + b.pull)];
  // from here to the end nothing waits: the account's oldest goes past ACCT_WAITING_MAX, and the room is checked again
  const mine = [...h.offers].filter(([, o]) => o.acct === acct).sort((x, y) => x[1].expires - y[1].expires);
  while (mine.length >= ACCT_WAITING_MAX) h.offers.delete(mine.shift()[0]);
  if (h.offers.size >= WAITING_MAX) throw oops(503, 'too many hand-overs at once: try again soon', 'busy');
  const expires = now + HANDOFF_MS;
  h.offers.set(id, { bind, text, acct, src: host, expires });
  const row = world.sql.exec('SELECT json FROM saves WHERE name_lc = ? ORDER BY ver DESC LIMIT 1', acct).toArray()[0];
  return json({ code, expires, name: acct, knight: knightOf(row ? row.json : null) });
}

// {code, pull} -> {keys, from}. One claim per code: it is taken out of memory before the answer goes back, whatever
// happens next, and nothing waits between finding it and taking it out, so two claims of one code can never both get
// it. The pull must be the one the offer was bound to; a claim with any other pull is refused and does NOT use the
// code up. Run out, claimed already, never was, or the wrong pull: all get the same answer, and count against the
// address (CLAIM_FAILS_PER_MIN, then 429). A real code with its pull always lands.
async function claim(h, req, now, who) {
  const b = await readCapped(req, 1024);
  const code = typeof b.code === 'string' ? b.code : '';
  const pull = typeof b.pull === 'string' ? b.pull : '';
  const gone = () => {
    if (h.fails.size > 5000) for (const [k, v] of h.fails) if (now - v.start >= 60000) h.fails.delete(k);
    let r = h.fails.get(who);
    if (!r || now - r.start >= 60000) { r = { start: now, n: 0 }; h.fails.set(who, r); }
    if (++r.n > CLAIM_FAILS_PER_MIN) return oops(429, 'too many at once: wait a minute', 'wait', { wait: Math.ceil((r.start + 60000 - now) / 1000) });
    return oops(404, 'that hand-over is gone', 'gone');
  };
  if (!CODE_RE.test(code) || !PULL_RE.test(pull)) throw gone();
  const id = await sha(code), bind = await sha('pull:' + pull);
  const o = h.offers.get(id);
  if (!o) throw gone();
  if (o.expires <= now) { h.offers.delete(id); throw gone(); }
  if (!sameString(o.bind, bind)) throw gone();
  h.offers.delete(id);
  return json({ keys: JSON.parse(o.text), from: o.src });
}
