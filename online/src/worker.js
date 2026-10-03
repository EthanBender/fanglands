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

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
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
