// ============================================================================
// TWO ADDRESSES — fanglands.com is the game's home; gorkscape.ca hands each browser over to it
// Owner (2026-10-03): "can you port everything over to the new proper domain but have gorkscape redirect to fang lands
// so anyone with the old domain doesnt notice the diffrance for now?"
//
// A browser keeps its saves and its login per address, so a plain redirect would land a kid on fanglands.com logged
// out with no local saves. So a page on gorkscape.ca is a tiny hand-over page instead of the game. The hop, for a
// browser that has something to hand over (docs/ONLINE.md, "Two addresses"):
//   1. gorkscape.ca/<path>             the hand-over page sees Fanglands keys here and asks the new address for a pull
//   2. fanglands.com/handoff           the start page keeps a fresh random pull in fanglands.com's own storage and goes
//                                      back with it after # (#handoff-pull=<32 hex>)
//   3. gorkscape.ca/<path>#handoff-pull=<pull>   the hand-over page offers this browser's keys, bound to that pull,
//                                      and gets a one-time code
//   4. fanglands.com/<path>#handoff=<code>       src/00-handoff.js claims the code WITH the pull it kept, writes what
//                                      is missing, takes the code off the address and starts the game
// The code and the pull only ever ride after # (never sent to any server, in no log). A claim needs both, so a code
// made by anyone else is useless in this browser: it never kept their pull. A browser with nothing to hand over just
// goes across (step 1 straight to the game).
//
// The front door (frontDoor, used by worker.js) decides what each address serves. The offer and the claim
// (handoffCall, used by world.js) live in the World: one table, short-lived rows, nothing kept after a claim.
// /api/* and /ws answer on every address exactly as before, so an open game on gorkscape.ca never notices.
// ============================================================================

import { json, oops } from './http.js';
import { randomHex, sameString } from './auth.js';

// where each old address hands over to (the test world mirrors the live one), and back
export const MOVES = { 'gorkscape.ca': 'fanglands.com', 'www.gorkscape.ca': 'fanglands.com', 'test.gorkscape.ca': 'test.fanglands.com' };
export const HOMES = ['fanglands.com', 'www.fanglands.com', 'test.fanglands.com'];
export const BACK = { 'fanglands.com': 'gorkscape.ca', 'www.fanglands.com': 'gorkscape.ca', 'test.fanglands.com': 'test.gorkscape.ca' };
export const START_PATH = '/handoff';             // the start page on a new address (step 2)
export const PULL_KEY = 'fanglands.handoff.pull'; // where the start page keeps the pull in the new address's storage
export const PULL_MS = 5 * 60 * 1000;             // a pull is good for 5 minutes on the new address
export const HANDOFF_MS = 3 * 60 * 1000;          // a code is good for 3 minutes, then it is gone
export const HANDOFF_MAX = 1500000;               // bytes in one offer: three slots of up to 512 KB (SAVE_MAX) are about this
export const HANDOFF_KEYS_MAX = 400;              // keys in one offer
export const OFFERS_PER_MIN = 10, CLAIMS_PER_MIN = 20;   // per address (an IPv6 address counts by its /64)
export const ADDRESS_BYTES_MAX = 3 * 1024 * 1024; // offer bytes one address may have waiting at once
export const STORED_MAX = 300, STORED_BYTES_MAX = 48 * 1024 * 1024;   // all offers waiting at once
// the keys a browser may hand over: the game's own (fanglands.* and the fl_ hints), never the hand-over's own notes
export const KEY_RE = /^(fanglands\.|fl_)[A-Za-z0-9_.:-]{1,160}$/;
const CODE_RE = /^[0-9a-f]{64}$/;
const PULL_RE = /^[0-9a-f]{32}$/;
const AT_RE = /^fanglands\.slot\.\d+\.at$/;
const enc = new TextEncoder();

// ---------- the front door: what an address serves when it is not /api or /ws ----------
// www.fanglands.com sends to the bare address for good (301, path and query kept). /handoff on a new address is the
// start page. On a gorkscape address a page (the game, /admin, any HTML) is the hand-over page; anything else (an icon,
// a file) is sent on with a 302. Returns null when the address is the game's home and the static files should answer.
// env.HANDOVER = 'off' (wrangler deploy --var HANDOVER:off) keeps the old addresses serving the game as before: the
// first ship attaches fanglands.com with it off, so nobody is sent there before its address and certificate answer.
export function frontDoor(req, url, env) {
  const host = url.hostname.toLowerCase();
  if (host === 'www.fanglands.com') return redirect('https://fanglands.com' + url.pathname + url.search, 301);
  if (BACK[host] && url.pathname === START_PATH) return (req.method === 'GET' || req.method === 'HEAD') ? startPage(BACK[host], req.method === 'HEAD') : redirect('https://' + host + '/', 302);
  const to = MOVES[host];
  if (!to || (env && env.HANDOVER === 'off')) return null;
  const target = 'https://' + to + url.pathname + url.search;
  if ((req.method === 'GET' || req.method === 'HEAD') && isPage(req, url)) return handoverPage(to, req.method === 'HEAD');
  return redirect(target, 302);
}
function redirect(location, status) {
  return new Response(null, { status, headers: { location, 'cache-control': status === 301 ? 'public, max-age=86400' : 'no-store', 'referrer-policy': 'no-referrer' } });
}
// a page load, not a file the page asked for: what the browser says (Sec-Fetch-Dest), or for an older browser what it
// accepts, or the game's own paths
export function isPage(req, url) {
  const dest = req.headers.get('sec-fetch-dest');
  if (dest) return dest === 'document';
  if ((req.headers.get('accept') || '').includes('text/html')) return true;
  return /^\/(index\.html|admin|admin\/|admin\.html)?$/.test(url.pathname);
}

const STYLE = `html,body{margin:0;height:100%;background:#0b0f14;color:#8b949e;font:16px "Trebuchet MS","Segoe UI",system-ui,sans-serif}
main{position:fixed;left:16px;right:16px;bottom:28px;text-align:center}p{margin:0 0 14px}
a{color:#d9b25f}a.go{display:inline-block;padding:12px 22px;border:1px solid #d9b25f;border-radius:8px;text-decoration:none;font-weight:700;margin:0 6px 10px}
#wait,#stuck{display:none}`;
function page(nonce, body, script, head) {
  const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0b0f14">
<title>Fanglands</title>
<style>${STYLE}</style>
<main>${body}</main>
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

// The hand-over page (steps 1 and 3). No game here. It reads this browser's Fanglands keys; with none it goes straight
// to the same path and query on the new address. With some and no pull yet, it asks the new address for one (step 2).
// With a pull it offers the keys bound to it and goes on with the code after #. A #handoff... fragment that arrived
// here is never passed on: it may be someone else's code. If the world does not take the offer it tries twice more,
// then says so with a Try again button, so a kid is never dropped on the new address without a word. It never deletes
// anything here, so a hand-over that went wrong can simply be tried again by opening the old address.
export function handoverPage(to, head) {
  const home = 'https://' + to;
  const body = `<p id="wait">One moment...</p>
<div id="stuck"><p>Your knight could not come across to ${to} just now.</p>
<a class="go" id="again" href="">Try again</a><br><a id="anyway" href="${home}/">Go to ${to} without it</a></div>`;
  const script = `(function () {
  var HOME = ${JSON.stringify(home)};
  var CAP = 1400000;
  var KEY_RE = ${KEY_RE.toString()};
  var SLOT_RE = /^fanglands\\.slot\\.(\\d+)$/;
  var here = location.pathname + location.search;
  var h = location.hash || '';
  var pull = /^#handoff-pull(2?)=([0-9a-f]{32})$/.exec(h);
  var bad = h.indexOf('#handoff-pull') === 0 && !pull;
  if (h.indexOf('#handoff') === 0) h = '';   // never pass a hand-over fragment on: it may be someone else's
  var gone = false;
  function go(code) {
    if (gone) return; gone = true;
    location.replace(HOME + here + (code ? '#handoff' + pull[1] + '=' + code : h));
  }
  var all = {}, n = 0;
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k || !KEY_RE.test(k) || k.indexOf('fanglands.handoff') === 0) continue;
      var v = localStorage.getItem(k);
      if (typeof v === 'string') { all[k] = v; n++; }
    }
  } catch (e) { }
  if (!n || bad || typeof fetch !== 'function' || typeof JSON === 'undefined') { go(null); return; }
  if (!pull) { gone = true; location.replace(HOME + ${JSON.stringify(START_PATH)} + '#back=' + encodeURIComponent(here)); return; }
  // packed under the cap: the login and the small keys first, then the slots newest first, the oldest kind of save last
  var size = function (k, v) { return unescape(encodeURIComponent(JSON.stringify(k) + JSON.stringify(v))).length + 2; };
  var groups = [], small = {}, slots = [], key;
  for (key in all) {
    var m = SLOT_RE.exec(key);
    if (m) { var g = {}; g[key] = all[key]; var at = key + '.at'; if (all[at] != null) g[at] = all[at]; if (m[1] === '1' && all['fanglands.slot.1.online'] != null) g['fanglands.slot.1.online'] = all['fanglands.slot.1.online']; slots.push({ at: +all[at] || 0, g: g }); }
  }
  var inSlots = {}; for (i = 0; i < slots.length; i++) for (key in slots[i].g) inSlots[key] = 1;
  for (key in all) if (!inSlots[key] && key !== 'fanglands.save.v2') small[key] = all[key];
  groups.push(small);
  slots.sort(function (a, b) { return b.at - a.at; });
  for (i = 0; i < slots.length; i++) groups.push(slots[i].g);
  if (all['fanglands.save.v2'] != null) groups.push({ 'fanglands.save.v2': all['fanglands.save.v2'] });
  var keys = {}, used = 64, any = false;
  for (i = 0; i < groups.length; i++) {
    var gs = 0; for (key in groups[i]) gs += size(key, groups[i][key]);
    if (used + gs > CAP) continue;
    used += gs; for (key in groups[i]) { keys[key] = groups[i][key]; any = true; }
  }
  if (!any) { go(null); return; }
  var show = function (id) { var e = document.getElementById(id); if (e) e.style.display = 'block'; };
  var hide = function (id) { var e = document.getElementById(id); if (e) e.style.display = 'none'; };
  setTimeout(function () { if (!gone) show('wait'); }, 2500);
  var tries = 0;
  function stuck() {
    hide('wait');
    var a = document.getElementById('again'); if (a) a.setAttribute('href', here);
    var b = document.getElementById('anyway'); if (b) b.setAttribute('href', HOME + here);
    show('stuck');
  }
  function attempt() {
    tries++;
    var over = false, ctl = null;
    try { ctl = new AbortController(); } catch (e) { }
    var miss = function () { if (over || gone) return; over = true; if (tries < 3) setTimeout(attempt, tries * 1500); else stuck(); };
    var timer = setTimeout(function () { if (ctl) ctl.abort(); miss(); }, 7000);
    fetch('/api/handoff/offer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ keys: keys, pull: pull[2] }), cache: 'no-store', credentials: 'same-origin', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (over) return;
        if (d && typeof d.code === 'string' && /^[0-9a-f]{64}$/.test(d.code)) { over = true; clearTimeout(timer); go(d.code); }
        else { clearTimeout(timer); miss(); }
      }, function () { clearTimeout(timer); miss(); });
  }
  attempt();
})();`;
  return page(randomHex(16), body, script, head);
}

// The start page on a new address (step 2). It keeps a pull in this address's own storage (reusing one that is still
// fresh, so two tabs at once both land) and goes back to the old address with it after #, to the path the old page was
// on. A path that is not a plain path on that address becomes /. If this address cannot keep anything (storage off),
// there is nothing to bind an offer to: it goes straight into the game here.
export function startPage(back, head) {
  const script = `(function () {
  var BACK = ${JSON.stringify('https://' + back)};
  var KEY = ${JSON.stringify(PULL_KEY)}, LIFE = ${PULL_MS - 60000};
  var m = /^#back=(.*)$/.exec(location.hash || ''), path = '/';
  try { if (m) path = decodeURIComponent(m[1]); } catch (e) { }
  if (!/^\\/(?![\\/\\\\])[^\\s\\\\#]*$/.test(path)) path = '/';
  var pull = null;
  try {
    var had = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (had && /^[0-9a-f]{32}$/.test(had.n) && Date.now() - had.at >= 0 && Date.now() - had.at < LIFE) pull = had.n;
    else {
      var a = new Uint8Array(16); crypto.getRandomValues(a);
      pull = ''; for (var i = 0; i < a.length; i++) pull += (a[i] < 16 ? '0' : '') + a[i].toString(16);
      localStorage.setItem(KEY, JSON.stringify({ n: pull, at: Date.now() }));
      if (JSON.parse(localStorage.getItem(KEY)).n !== pull) pull = null;
    }
  } catch (e) { pull = null; }
  location.replace(pull ? BACK + path + '#handoff-pull=' + pull : path);
})();`;
  return page(randomHex(16), '<p id="wait">One moment...</p>', script, head);
}

// ---------- the World's side: POST /api/handoff/offer and POST /api/handoff/claim ----------
// Called by World.route for every /api call: it clears out codes that have run out (at most once a minute), and
// answers the two hand-over calls. Returns null for every other call.
export async function handoffCall(world, req, url, path, method) {
  const now = world.now();
  const h = world.handoff || (world.handoff = { made: false, swept: 0, rate: new Map() });
  if (!h.made) {
    world.sql.exec('CREATE TABLE IF NOT EXISTS handoffs (id TEXT PRIMARY KEY, keys TEXT NOT NULL, bytes INTEGER NOT NULL, expires INTEGER NOT NULL)');
    // the pull a claim must bring, and which address offered (both as SHA-256): added to a table made before them
    for (const col of ['bind', 'who']) { try { world.sql.exec(`ALTER TABLE handoffs ADD COLUMN ${col} TEXT`); } catch (e) { } }
    h.made = true;
  }
  const isOffer = path === '/api/handoff/offer', isClaim = path === '/api/handoff/claim';
  if (isOffer || isClaim || now - h.swept > 60000) { world.sql.exec('DELETE FROM handoffs WHERE expires <= ?', now); h.swept = now; }
  if (!path.startsWith('/api/handoff/')) return null;
  if (!isOffer && !isClaim) throw oops(404, 'no such call', 'nope');
  if (method !== 'POST') throw oops(405, 'post it', 'bad');
  // only the game's own addresses: an offer is made on an old address, a claim on the new one
  const host = url.hostname.toLowerCase();
  const origin = req.headers.get('origin') || '';
  const okHost = isOffer ? Object.prototype.hasOwnProperty.call(MOVES, host) : HOMES.includes(host);
  const okOrigin = origin === 'https://' + host;
  if (!okHost || !okOrigin) throw oops(403, 'not from here', 'origin');
  const who = addressOf(req.headers.get('cf-connecting-ip'));
  limit(h.rate, (isOffer ? 'o:' : 'c:') + who, isOffer ? OFFERS_PER_MIN : CLAIMS_PER_MIN, now);
  return isOffer ? offer(world, req, now, who) : claim(world, req, now);
}

// The address a limit counts by: an IPv4 address as it is, an IPv6 address by its /64 (one home connection gets a
// whole /64, so counting each address in it apart would let one home make thousands of "addresses").
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
  return all.slice(0, 4).map(x => (parseInt(x, 16) || 0).toString(16)).join(':') + '::/64';
}

// A fixed one-minute window per address, kept in memory (a restart forgets it, which only ever lets more through).
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

async function sha(text) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join('');
}

// {keys: {name: value}, pull} -> {code, expires}. Every name must be one of the game's own keys and every value a
// string; pull is the 128-bit value the new address kept (step 2). The code is 256 random bits; only its SHA-256 is
// stored, with the pull's SHA-256, so the table alone cannot be used to claim anything. A save slot's .at stamp from
// the future is brought back to now, so it can never look newer than anything played later.
async function offer(world, req, now, who) {
  const b = await readCapped(req, HANDOFF_MAX + 200);
  const keys = b.keys;
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) throw oops(400, 'send the keys', 'bad');
  if (typeof b.pull !== 'string' || !PULL_RE.test(b.pull)) throw oops(400, 'send the pull', 'bad');
  const names = Object.keys(keys);
  if (!names.length) throw oops(400, 'nothing to hand over', 'bad');
  if (names.length > HANDOFF_KEYS_MAX) throw oops(413, 'that is too much to hand over', 'full');
  for (const k of names) {
    if (!KEY_RE.test(k) || k.startsWith('fanglands.handoff')) throw oops(400, 'that is not a Fanglands key', 'bad');
    if (typeof keys[k] !== 'string') throw oops(400, 'every value is a string', 'bad');
    if (AT_RE.test(k) && +keys[k] > now) keys[k] = String(now);
  }
  const text = JSON.stringify(keys);
  const bytes = enc.encode(text).length;
  if (bytes > HANDOFF_MAX) throw oops(413, 'that is too much to hand over', 'full');
  const whoId = await sha('who:' + who);
  const mine = world.sql.exec('SELECT COALESCE(SUM(bytes), 0) AS b FROM handoffs WHERE who = ?', whoId).toArray()[0] || { b: 0 };
  if (mine.b + bytes > ADDRESS_BYTES_MAX) throw oops(429, 'too many at once: wait a minute', 'wait', { wait: Math.ceil(HANDOFF_MS / 1000) });
  const held = world.sql.exec('SELECT COUNT(*) AS n, COALESCE(SUM(bytes), 0) AS b FROM handoffs').toArray()[0] || { n: 0, b: 0 };
  if (held.n >= STORED_MAX || held.b + bytes > STORED_BYTES_MAX) throw oops(503, 'too many hand-overs at once: try again soon', 'busy');
  const code = randomHex(32);
  const expires = now + HANDOFF_MS;
  world.sql.exec('INSERT INTO handoffs (id, keys, bytes, expires, bind, who) VALUES (?, ?, ?, ?, ?, ?)', await sha(code), text, bytes, expires, await sha('pull:' + b.pull), whoId);
  return json({ code, expires });
}

// {code, pull} -> {keys}. One claim per code: the row is deleted before the answer goes back, whatever happens next.
// The pull must be the one the offer was bound to; a claim with any other pull is refused and does NOT use the code
// up. A code that ran out, was claimed already, never was, or comes with the wrong pull: all get the same answer.
async function claim(world, req, now) {
  const b = await readCapped(req, 1024);
  const code = typeof b.code === 'string' ? b.code : '';
  const pull = typeof b.pull === 'string' ? b.pull : '';
  if (!CODE_RE.test(code) || !PULL_RE.test(pull)) throw oops(404, 'that hand-over is gone', 'gone');
  const id = await sha(code);
  const row = world.sql.exec('SELECT keys, expires, bind FROM handoffs WHERE id = ?', id).toArray()[0];
  if (!row || row.expires <= now) { world.sql.exec('DELETE FROM handoffs WHERE id = ?', id); throw oops(404, 'that hand-over is gone', 'gone'); }
  if (!row.bind || !sameString(row.bind, await sha('pull:' + pull))) throw oops(404, 'that hand-over is gone', 'gone');
  world.sql.exec('DELETE FROM handoffs WHERE id = ?', id);
  return json({ keys: JSON.parse(row.keys) });
}
