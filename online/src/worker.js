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

// The teacher view (docs/ONLINE.md, "The teacher view"), round 2: ONE sign-in. A teacher signs in on the game's own card
// (POST /api/login, the World tells a teacher's answer apart), so there is no teacher address and no door. The old ones only
// forward: /teacher and /teacher.html to the game, and a host teacher.* / test-teacher.* to that world's game address.
const LOCAL = h => h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost');
const go = to => new Response(null, { status: 302, headers: { location: to, 'cache-control': 'no-store' } });
// teacher.fanglands.com -> fanglands.com; test-teacher.fanglands.com -> test.fanglands.com (the test world's game address)
export function teacherHostTarget(host) {
  host = String(host || '').toLowerCase();
  if (host.startsWith('test-teacher.')) return 'test.' + host.slice('test-teacher.'.length);
  if (host.startsWith('teacher.')) return host.slice('teacher.'.length);
  return null;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    // an old teacher address (round 1) forwards to its world's game, whatever the path
    const to = teacherHostTarget(url.hostname);
    if (to && !LOCAL(url.hostname)) return go('https://' + to + '/');
    if (path === '/teacher' || path === '/teacher.html') return go(LOCAL(url.hostname) ? url.protocol + '//' + url.host + '/' : '/');
    // the teacher map is the Worker's own answer on every address: never a Durable Object request
    if (path === '/teacher-map.json' && (req.method === 'GET' || req.method === 'HEAD')) return teacherMap();
    if (path === '/api' || path.startsWith('/api/') || path === '/ws') {
      if (req.method === 'OPTIONS') return withCors(req, new Response(null, { status: 204 }));
      if (!env.WORLD) return fail(503, 'the world is not bound', 'server');
      const world = env.WORLD.get(env.WORLD.idFromName('world'));
      const res = await world.fetch(req);
      // a 101 with a WebSocket on it must go back untouched (a knight's /ws and a teacher's /api/teacher/ws)
      return path === '/ws' || path === '/api/teacher/ws' ? res : withCors(req, res);
    }
    const moved = frontDoor(req, url, env);
    if (moved) return moved;
    // /admin is public/admin.html: the assets service maps the bare path to the file by itself (and would
    // bounce a request for /admin.html back to /admin, so the request goes through untouched)
    return env.ASSETS.fetch(req);
  },
};
