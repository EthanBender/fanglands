// ============================================================================
// SIM-BOTS — scripted knights for a copy run by SimHost (tools/sim-suite.mjs, tools/sim-audit.mjs, tools/sim-bench).
// Pure JavaScript with no node APIs, so the local workerd bench (tools/sim-bench/worker.mjs) runs the same bots.
// ============================================================================
import { mulberry32 } from '../online/src/sim/window.js';

// ---------------------------------------------------------------------------
// Scripted knights for a copy run by SimHost. Each is presence the copy sees as a real knight; it walks (no walls: it is
// only presence) to the nearest live monster within `leash` tiles of its post and swings at it, a 'hit' message with a
// damage rolled from the bots' own seeded dice. Bots never die; what hurts them is counted.
// ---------------------------------------------------------------------------
export class Bots {
  constructor(host, map, { seed = 3, leash = 10, swingEvery = 0.6, maxHit = 6, speed = 175 } = {}) {
    this.host = host; this.map = map; this.rnd = mulberry32(seed); this.leash = leash; this.swingEvery = swingEvery; this.maxHit = maxHit; this.speed = speed;
    this.list = []; this.hits = 0;
  }
  get copy() { return this.host.copies.get(this.map); }
  add(n, x, y) { const k = { n, x, y, post: { x, y }, fx: 1, fy: 0, dead: false, def: 9 * 64, lv: 3, hp: 99, mhp: 99, cd: 0 }; this.list.push(k); return k; }
  // n knights over the map's monster homes, spread along its spawn list
  postOnHomes(n) {
    const c = this.copy; const g = c.api.peek, T = g('TILE');
    const homes = g('monsters').map(m => m.home || { x: m.x, y: m.y });
    for (let i = 0; i < n; i++) {
      const h = homes[Math.floor((i + 0.5) * homes.length / n)] || { x: 10 * T, y: 10 * T };
      const sp = g('safeSpot')(h.x + 30, h.y, 13, 'player') || h;
      this.add('Bot' + i, sp.x, sp.y);
    }
    return this;
  }
  moveTo(k, x, y) { k.x = x; k.y = y; k.post = { x, y }; }
  // one tick (dt seconds) of walking and swinging, then the presence goes to the host
  step(dt = 0.1) {
    const c = this.copy; if (!c) return;
    const g = c.api.peek, T = g('TILE'), mons = g('monsters');
    for (const k of this.list) {
      k.cd = Math.max(0, k.cd - dt);
      let tgt = null, td = Infinity;
      for (const m of mons) {
        if (m.dead || m.remote || m.phantom) continue;
        if (Math.hypot(m.x - k.post.x, m.y - k.post.y) > this.leash * T) continue;
        const d = Math.hypot(m.x - k.x, m.y - k.y); if (d < td) { td = d; tgt = m; }
      }
      let dx = 0, dy = 0, d = 0;
      if (tgt) { dx = tgt.x - k.x; dy = tgt.y - k.y; d = Math.hypot(dx, dy) || 1; }
      else { dx = k.post.x - k.x; dy = k.post.y - k.y; d = Math.hypot(dx, dy); if (d < 8) d = 0; }
      if (d) { k.fx = +(dx / d).toFixed(2); k.fy = +(dy / d).toFixed(2); }
      if (tgt && d <= 40) {
        if (k.cd <= 0 && tgt.nid) { k.cd = this.swingEvery; this.hits++; this.host.deliver(this.map, { t: 'hit', n: k.n, nid: tgt.nid, dmg: Math.floor(this.rnd() * (this.maxHit + 1)), knock: 14, bomb: false }); }
      } else if (d) { const s = Math.min(d, this.speed * dt); k.x += dx / d * s; k.y += dy / d * s; }
    }
    this.host.setKnights(this.map, this.list.map(k => ({ n: k.n, x: Math.round(k.x), y: Math.round(k.y), fx: k.fx, fy: k.fy, dead: false, def: k.def, lv: k.lv, hp: k.hp, mhp: k.mhp })));
  }
}
