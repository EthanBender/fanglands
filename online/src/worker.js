// Probe build: serves the game as static assets and proves the world object binds. Replaced by the real server.
export class World {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(req) { return new Response(JSON.stringify({ ok: true, world: 'fanglands', at: Date.now() }), { headers: { 'content-type': 'application/json' } }); }
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/api/ping') { const id = env.WORLD.idFromName('world'); return env.WORLD.get(id).fetch(req); }
    if (url.pathname.startsWith('/api/')) return new Response('not yet', { status: 404 });
    return env.ASSETS.fetch(req);
  },
};
