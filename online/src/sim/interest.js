// ============================================================================
// INTEREST — which of a world-run map's monsters each knight is sent (docs/ONLINE.md, "The shared world", Stage 2)
// A knight is sent the monsters within ENTER of his accepted position. One he was sent stays in his list until it is past
// LEAVE (a monster on the edge never blinks in and out), and one whose target (row column 14, `tgt`) is him is always sent.
// Rows are the 'mon' rows of WORLDKEEPER.rows(): [nid, type, x, y, ...]. Pure JavaScript.
//
//   const view = new Interest()           one per knight on a world-run map
//   view.filter(name, x, y, rows)          the rows for him now (and it remembers which he has)
//   view.reset()                           forget (he changed maps)
// ============================================================================

export const TILE = 48;
export const ENTER = 24 * TILE;   // px: a monster comes into a knight's view inside this
export const LEAVE = 27 * TILE;   // px: and goes out of it only past this
export const MAX_ROWS = 400;      // the contract's cap on one mon list

export class Interest {
  constructor() { this.seen = new Set(); }
  reset() { this.seen.clear(); }
  filter(name, x, y, rows) {
    const out = [], next = new Set();
    const known = Number.isFinite(x) && Number.isFinite(y);
    for (const r of rows) {
      if (!Array.isArray(r)) continue;
      const nid = r[0];
      let keep = r.length > 14 && r[14] === name;
      if (!keep && known) {
        const d = Math.hypot(r[2] - x, r[3] - y);
        keep = d <= ENTER || (d <= LEAVE && this.seen.has(nid));
      }
      if (!keep) continue;
      out.push(r); next.add(nid);
      if (out.length >= MAX_ROWS) break;
    }
    this.seen = next;
    return out;
  }
}
