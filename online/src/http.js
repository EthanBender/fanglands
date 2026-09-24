// ============================================================================
// JSON IN, JSON OUT — the small helpers the Worker and the World share
// Every error the game sees is {error, code} with a 4xx, exactly what NET.call in src/70-net.js turns into
// an Error with .code on it. Handlers throw oops(...) and the World's fetch turns it into the response.
// ============================================================================

export const json = (data, status = 200, extra) =>
  new Response(JSON.stringify(data), { status, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, extra || {}) });

export class HttpError extends Error {
  constructor(status, text, code, extra) { super(text); this.status = status; this.code = code || 'bad'; this.extra = extra || null; }
}
export const oops = (status, text, code, extra) => new HttpError(status, text, code, extra);
export const fail = (status, text, code, extra) => json(Object.assign({ error: text, code: code || 'bad' }, extra || {}), status);
export const failFrom = e => (e instanceof HttpError) ? fail(e.status, e.message, e.code, e.extra) : fail(500, 'the world stumbled: ' + (e && e.message || e), 'server');

// The body as an object. An empty body is {} so "POST /api/logout" with nothing in it still works.
export async function readJson(req, maxBytes = 64 * 1024) {
  const text = await req.text();
  if (text.length > maxBytes) throw oops(413, 'that is too much to send at once', 'full');
  if (!text.trim()) return {};
  let v;
  try { v = JSON.parse(text); } catch (e) { throw oops(400, 'that was not JSON', 'bad'); }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw oops(400, 'expected a JSON object', 'bad');
  return v;
}

export const bearer = req => {
  const h = req.headers.get('authorization') || '';
  return /^bearer\s+/i.test(h) ? h.replace(/^bearer\s+/i, '').trim() : '';
};
