// ============================================================================
// THE COPY'S WINDOW — the screen-less browser one server game copy lives in (docs/ONLINE.md, "The shared world")
// Ported from the spike (spike/host.mjs). The same stubs as tools/headless.js (a stub DOM, a canvas that swallows
// everything, a memory localStorage), plus what a server needs:
//   - its own seeded Math: Math.random is per copy, so a copy can be replayed and two copies never share dice;
//   - a clock the host drives: window.__now (ms since 1970). Date.now(), new Date() and performance.now() all read it,
//     because inside workerd the real clock only moves on I/O and a tick must see the time it stands for;
//   - a sim-time scheduler for the game's setTimeout calls: they are recorded with the time they are due, and
//     window.__runTimers() (the host calls it at the start of every tick) runs the ones that are due. setInterval and
//     requestAnimationFrame do nothing: the tick drives the game, and a Durable Object that keeps timers cannot nap.
// makeWindow({ clock: 'wall' }) gives the copy the real clock and real timers instead (tools/sim-suite.mjs runs the
// self-tests that way, exactly as tools/headless.js does).
// No Cloudflare and no node APIs in here: it runs in both.
// ============================================================================

export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// FNV-1a over bytes (the map), to prove two copies built the same world
export function hashBytes(u8) { let h = 0x811c9dc5; for (let i = 0; i < u8.length; i++) { h ^= u8[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); }

export function makeWindow({ seed = 1, now = 0, clock = 'host', errorsKept = 200 } = {}) {
  const noop = () => { };
  const ctx2d = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') ? () => ({ addColorStop: noop }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : typeof k === 'string' ? noop : undefined, set: () => true });
  const mkCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, addEventListener: noop, removeEventListener: noop, appendChild: noop, setAttribute: noop, classList: { add: noop, remove: noop } });
  const store = {};
  const wall = clock === 'wall';
  const M = Object.create(Math); M.random = mulberry32(seed);
  const errors = [];
  const w = {
    innerWidth: 1000, innerHeight: 700, devicePixelRatio: 1, addEventListener: noop, removeEventListener: noop,
    requestAnimationFrame: noop, setInterval: noop, clearInterval: noop,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    console: { log: noop, info: noop, warn: noop, debug: noop, table: noop, error: (...a) => { if (errors.length < errorsKept) errors.push(a.map(x => x && x.stack ? x.stack.split('\n').slice(0, 3).join(' | ') : String(x)).join(' ').slice(0, 400)); } },
    navigator: { maxTouchPoints: 0, userAgent: 'fanglands-server' },
    document: { getElementById: () => mkCanvas(), createElement: () => mkCanvas(), fonts: null, body: mkCanvas(), addEventListener: noop, removeEventListener: noop, hidden: false },
    location: { hostname: 'server.invalid', host: 'server.invalid', search: '', protocol: 'about:', origin: 'null' },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    fetch: () => Promise.reject(new Error('no fetch in a server game copy')),
    Math: M,
    __errors: errors,
  };
  // the clock
  if (wall) Object.defineProperty(w, '__now', { get: () => Date.now(), set: noop, enumerable: true });
  else w.__now = now;
  const t0 = wall ? Date.now() : now;
  w.performance = { now: () => w.__now - t0 };
  const RealDate = Date;
  w.Date = class extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(w.__now); }
    static now() { return w.__now; }
  };
  // timers
  if (wall) {
    w.setTimeout = (f, ms, ...a) => setTimeout(f, ms, ...a);
    w.clearTimeout = id => clearTimeout(id);
    w.__runTimers = () => 0;
    w.__timers = () => 0;
  } else {
    const timers = new Map(); let seq = 0;
    w.setTimeout = (f, ms, ...args) => { const id = ++seq; timers.set(id, { at: w.__now + Math.max(0, Number(ms) || 0), f, args, seq: id }); return id; };
    w.clearTimeout = id => { timers.delete(id); };
    // every due timer, earliest first (a timer a timer sets runs in the same pass if it is already due)
    w.__runTimers = () => {
      let ran = 0;
      for (let guard = 0; guard < 10000; guard++) {
        let next = null;
        for (const t of timers.values()) if (t.at <= w.__now && (!next || t.at < next.at || (t.at === next.at && t.seq < next.seq))) next = t;
        if (!next) break;
        timers.delete(next.seq); ran++;
        try { if (typeof next.f === 'function') next.f(...next.args); } catch (e) { w.console.error('timer', e); }
      }
      return ran;
    };
    w.__timers = () => timers.size;
  }
  w.window = w;
  return w;
}
