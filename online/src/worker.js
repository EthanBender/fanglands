// ============================================================================
// THE WORKER — the front door at fanglands.com (and the old gorkscape.ca)
// /api/* and /ws go to the one World object on every address; /admin is the parent's page; everything else is the
// game itself, served as static files from online/public (deploy.sh copies the built index.html there).
// fanglands.com is the home. A page on gorkscape.ca is the hand-over page that moves that browser's login and settings
// across, and www.fanglands.com sends to fanglands.com (handoff.js, docs/ONLINE.md "Two addresses"). The worker runs
// first for every request (wrangler.toml run_worker_first = true), so it sees the address before any file is served.
// The old GitHub Pages address is allowed to call the API too (CORS), so a knight there can reach the world.
// ============================================================================

import { fail } from './http.js';
import { frontDoor } from './handoff.js';
import { teacherMap } from './teacher-map.js';
export { World } from './world.js';

const ALLOWED_ORIGINS = ['https://ethanbender.github.io'];

function withCors(req, res) {
  const origin = req.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return res;
  const headers = new Headers(res.headers);
  headers.set('access-control-allow-origin', origin);
  headers.set('access-control-allow-methods', 'GET, POST, PUT, OPTIONS');
  headers.set('access-control-allow-headers', 'authorization, content-type');
  headers.set('access-control-max-age', '86400');
  headers.append('vary', 'origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

// The teacher view (docs/ONLINE.md, "The teacher view"): its own address, and a door header only this Worker sets
const DOOR = 'x-fanglands-door';
const LOCAL = h => h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost');
function teacherHeaders(res, host) {
  const h = new Headers(res.headers);
  h.set('content-security-policy', "default-src 'self'; connect-src 'self' wss://" + host + "; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'");
  h.set('x-frame-options', 'DENY'); h.set('referrer-policy', 'no-referrer'); h.set('cache-control', 'no-store'); h.set('x-robots-tag', 'noindex');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
async function teacherHost(req, url, env) {
  const path = url.pathname;
  if ((path === '/' || path === '/index.html') && (req.method === 'GET' || req.method === 'HEAD')) {
    // the assets service maps the bare /teacher to public/teacher.html (it would bounce /teacher.html back to /teacher)
    return teacherHeaders(await env.ASSETS.fetch(new Request(new URL('/teacher', url), { method: req.method, headers: req.headers })), url.hostname);
  }
  if (path === '/teacher-map.json' && req.method === 'GET') return teacherMap();
  if (path.startsWith('/api/teacher/')) {
    if (!env.WORLD) return fail(503, 'the world is not bound', 'server');
    const h = new Headers(req.headers); h.set(DOOR, 'teacher');
    const world = env.WORLD.get(env.WORLD.idFromName('world'));
    // the socket's 101 goes back untouched, like /ws
    return world.fetch(new Request(req, { headers: h }));
  }
  return fail(404, 'nothing here', 'nope');
}

export default {
  async fetch(req, env) {
    // a door header is only ever this Worker's own: whatever a browser sent is taken off, on every address
    if (req.headers.has(DOOR)) { const h = new Headers(req.headers); h.delete(DOOR); req = new Request(req, { headers: h }); }
    const url = new URL(req.url);
    const path = url.pathname;
    const th = env.TEACHER_HOST;
    if (th && url.hostname === th) return teacherHost(req, url, env);
    if (path === '/teacher' || path === '/teacher.html') {
      if (!th) return fail(404, 'nothing here', 'nope');
      const to = LOCAL(th) ? url.protocol + '//' + th + (url.port ? ':' + url.port : '') + '/' : 'https://' + th + '/';
      return new Response(null, { status: 302, headers: { location: to, 'cache-control': 'no-store' } });
    }
    if (path === '/api' || path.startsWith('/api/') || path === '/ws') {
      if (req.method === 'OPTIONS') return withCors(req, new Response(null, { status: 204 }));
      if (!env.WORLD) return fail(503, 'the world is not bound', 'server');
      const world = env.WORLD.get(env.WORLD.idFromName('world'));
      const res = await world.fetch(req);
      // a 101 with a WebSocket on it must go back untouched
      return path === '/ws' ? res : withCors(req, res);
    }
    const moved = frontDoor(req, url, env);
    if (moved) return moved;
    // /admin is public/admin.html: the assets service maps the bare path to the file by itself (and would
    // bounce a request for /admin.html back to /admin, so the request goes through untouched)
    return env.ASSETS.fetch(req);
  },
};
