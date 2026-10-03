// ============================================================================
// TWO ADDRESSES — fanglands.com is the game's home; gorkscape.ca hands each browser over to it
// Owner (2026-10-03): "can you port everything over to the new proper domain but have gorkscape redirect to fang lands
// so anyone with the old domain doesnt notice the diffrance for now?"
//
// A browser keeps its saves and its login per address, so a plain redirect would land a kid on fanglands.com logged
// out with no local saves. So a page on gorkscape.ca is a tiny hand-over page instead of the game: it reads that
// browser's own Fanglands keys, posts them here as an offer and gets back a one-time code, then goes to the same
// path on fanglands.com with the code in the FRAGMENT (#handoff=..., never sent to any server or written in any log).
// src/00-handoff.js on fanglands.com claims the code once before the game starts, writes the keys it does not
// already have newer copies of, takes the fragment off the address and starts the game. docs/ONLINE.md, "Two addresses".
//
// The front door (frontDoor, used by worker.js) decides what each address serves. The offer and the claim
// (handoffCall, used by world.js) live in the World: one table, short-lived rows, nothing kept after a claim.
// /api/* and /ws answer on every address exactly as before, so an open game on gorkscape.ca never notices.
// ============================================================================

import { json, oops } from './http.js';
import { randomHex } from './auth.js';

// where each old address hands over to (the test world mirrors the live one)
export const MOVES = { 'gorkscape.ca': 'fanglands.com', 'www.gorkscape.ca': 'fanglands.com', 'test.gorkscape.ca': 'test.fanglands.com' };
export const HOMES = ['fanglands.com', 'www.fanglands.com', 'test.fanglands.com'];
export const HANDOFF_MS = 3 * 60 * 1000;          // a code is good for 3 minutes, then it is gone
export const HANDOFF_MAX = 1500000;               // bytes in one offer; three slots are well under this
export const HANDOFF_KEYS_MAX = 400;              // keys in one offer
export const OFFERS_PER_MIN = 10, CLAIMS_PER_MIN = 20;   // per IP address
export const STORED_MAX = 300, STORED_BYTES_MAX = 48 * 1024 * 1024;   // all offers waiting at once
// the keys a browser may hand over: the game's own (fanglands.* and the fl_ hints), never the hand-over's own notes
export const KEY_RE = /^(fanglands\.|fl_)[A-Za-z0-9_.:-]{1,160}$/;
const CODE_RE = /^[0-9a-f]{64}$/;
const enc = new TextEncoder();

// ---------- the front door: what an address serves when it is not /api or /ws ----------
// www.fanglands.com sends to the bare address for good (301, path and query kept). On a gorkscape address a page
// (the game, /admin, any HTML) is the hand-over page; anything else (an icon, a file) is sent on with a 302.
// Returns null when the address is the game's home and the static files should answer.
// env.HANDOVER = 'off' (wrangler deploy --var HANDOVER:off) keeps the old addresses serving the game as before: the
// first ship attaches fanglands.com with it off, so nobody is sent there before its address and certificate answer.
export function frontDoor(req, url, env) {
  const host = url.hostname.toLowerCase();
  if (host === 'www.fanglands.com') return redirect('https://fanglands.com' + url.pathname + url.search, 301);
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

// The hand-over page. No game here: it reads this browser's Fanglands keys, offers them, and goes on to the same
// path and query on the new address with the code after # (a browser never sends that part to any server). With
// nothing to hand over, or if the world does not answer in time, it simply goes on with no code. It never deletes
// anything here, so a hand-over that went wrong can simply be tried again by opening the old address.
export function handoverPage(to, head) {
  const nonce = randomHex(16);
  const home = 'https://' + to;
  const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0b0f14">
<title>Fanglands</title>
<style>html,body{margin:0;height:100%;background:#0b0f14;color:#8b949e;font:15px "Trebuchet MS","Segoe UI",system-ui,sans-serif}
p{position:fixed;left:0;right:0;bottom:24px;text-align:center;margin:0}a{color:#d9b25f}#slow{visibility:hidden}</style>
<p id="slow">Fanglands lives at <a href="${home}/">${to}</a> now. Tap to go there.</p>
<script nonce="${nonce}">
(function () {
  var HOME = ${JSON.stringify(home)};
  var CAP = 1400000;
  var KEY_RE = ${KEY_RE.toString()};
  var SLOT_RE = /^fanglands\\.slot\\.(\\d+)$/;
  var gone = false;
  function go(code) {
    if (gone) return; gone = true;
    location.replace(HOME + location.pathname + location.search + (code ? '#handoff=' + code : (location.hash || '')));
  }
  setTimeout(function () { var s = document.getElementById('slow'); if (s) s.style.visibility = 'visible'; }, 4000);
  setTimeout(function () { go(null); }, 8000);
  var all = {}, n = 0;
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k || !KEY_RE.test(k) || k.indexOf('fanglands.handoff') === 0) continue;
      var v = localStorage.getItem(k);
      if (typeof v === 'string') { all[k] = v; n++; }
    }
  } catch (e) { }
  if (!n || typeof fetch !== 'function' || typeof JSON === 'undefined') { go(null); return; }
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
  var keys = {}, used = 16, any = false;
  for (i = 0; i < groups.length; i++) {
    var gs = 0; for (key in groups[i]) gs += size(key, groups[i][key]);
    if (used + gs > CAP) continue;
    used += gs; for (key in groups[i]) { keys[key] = groups[i][key]; any = true; }
  }
  if (!any) { go(null); return; }
  fetch('/api/handoff/offer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ keys: keys }), cache: 'no-store', credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { go(d && typeof d.code === 'string' && /^[0-9a-f]{64}$/.test(d.code) ? d.code : null); }, function () { go(null); });
})();
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

// ---------- the World's side: POST /api/handoff/offer and POST /api/handoff/claim ----------
// Called by World.route for every /api call: it clears out codes that have run out (at most once a minute), and
// answers the two hand-over calls. Returns null for every other call.
export async function handoffCall(world, req, url, path, method) {
  const now = world.now();
  const h = world.handoff || (world.handoff = { made: false, swept: 0, rate: new Map() });
  if (!h.made) { world.sql.exec('CREATE TABLE IF NOT EXISTS handoffs (id TEXT PRIMARY KEY, keys TEXT NOT NULL, bytes INTEGER NOT NULL, expires INTEGER NOT NULL)'); h.made = true; }
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
  limit(h.rate, (isOffer ? 'o:' : 'c:') + (req.headers.get('cf-connecting-ip') || '?'), isOffer ? OFFERS_PER_MIN : CLAIMS_PER_MIN, now);
  return isOffer ? offer(world, req, now) : claim(world, req, now);
}

// A fixed one-minute window per IP address, kept in memory (a restart forgets it, which only ever lets more through).
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

// {keys: {name: value}} -> {code, expires}. Every name must be one of the game's own keys and every value a string.
// The code is 256 random bits; only its SHA-256 is stored, so the table alone cannot be used to claim anything.
async function offer(world, req, now) {
  const b = await readCapped(req, HANDOFF_MAX);
  const keys = b.keys;
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) throw oops(400, 'send the keys', 'bad');
  const names = Object.keys(keys);
  if (!names.length) throw oops(400, 'nothing to hand over', 'bad');
  if (names.length > HANDOFF_KEYS_MAX) throw oops(413, 'that is too much to hand over', 'full');
  for (const k of names) {
    if (!KEY_RE.test(k) || k.startsWith('fanglands.handoff')) throw oops(400, 'that is not a Fanglands key', 'bad');
    if (typeof keys[k] !== 'string') throw oops(400, 'every value is a string', 'bad');
  }
  const text = JSON.stringify(keys);
  const bytes = enc.encode(text).length;
  const held = world.sql.exec('SELECT COUNT(*) AS n, COALESCE(SUM(bytes), 0) AS b FROM handoffs').toArray()[0] || { n: 0, b: 0 };
  if (held.n >= STORED_MAX || held.b + bytes > STORED_BYTES_MAX) throw oops(503, 'too many hand-overs at once: try again soon', 'busy');
  const code = randomHex(32);
  const expires = now + HANDOFF_MS;
  world.sql.exec('INSERT INTO handoffs (id, keys, bytes, expires) VALUES (?, ?, ?, ?)', await sha(code), text, bytes, expires);
  return json({ code, expires });
}

// {code} -> {keys}. One claim per code: the row is deleted before the answer goes back, whatever happens next. A code
// that ran out, was claimed already, or never was all get the same answer.
async function claim(world, req, now) {
  const b = await readCapped(req, 1024);
  const code = typeof b.code === 'string' ? b.code : '';
  if (!CODE_RE.test(code)) throw oops(404, 'that hand-over is gone', 'gone');
  const id = await sha(code);
  const row = world.sql.exec('SELECT keys, expires FROM handoffs WHERE id = ?', id).toArray()[0];
  world.sql.exec('DELETE FROM handoffs WHERE id = ?', id);
  if (!row || row.expires <= now) throw oops(404, 'that hand-over is gone', 'gone');
  return json({ keys: JSON.parse(row.keys) });
}
