// ============================================================================
// THE WORKER — the front door at gorkscape.ca
// /api/* and /ws go to the one World object; /admin is the parent's page; everything else is the game
// itself, served as static files from online/public (deploy.sh copies the built index.html there).
// The old GitHub Pages address is allowed to call the API too (CORS), so a knight there can reach the world.
// ============================================================================

import { fail } from './http.js';
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
    if (path === '/admin' || path === '/admin/') return env.ASSETS.fetch(new Request(new URL('/admin.html', url), req));
    return env.ASSETS.fetch(req);
  },
};
