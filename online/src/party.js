// ============================================================================
// DROP PARTIES — the numbers, the checks and the prize roll (docs/ONLINE.md, "Drop parties")
// Pure: no Cloudflare APIs, no storage, no clock. room.js uses it to check a party and roll a cracker, the
// tests use it to prove the odds. The prize is always rolled here, on the server, never by a client.
// ============================================================================

export const TILE = 48;                          // the game's tile in pixels (src/00-core.js; a test pins it)
export const HAT_COLOURS = ['red', 'yellow', 'blue', 'green', 'purple', 'white'];
export const HAT_CHOICES = [10, 100, 1000, 10000];   // "party hats 1 in N": the admin picks N
export const PARTY_LIFE = 15 * 60 * 1000;        // a party's crackers vanish 15 minutes after it starts
export const PRIZE_KEEP = 7 * 24 * 3600 * 1000;  // a prize nobody claimed is offered again for 7 days
export const LIGHT_RANGE = 168;                  // px from the cracker's centre (3.5 tiles)
export const SPOT_RANGE = 11;                    // tiles from the admin's tile, in a straight line
export const MIN_SPOTS = 5, MAX_SPOTS = 50;      // crackers in one party
export const MAX_LIVE_CRACKERS = 150;            // unlit crackers on one map, all parties together
export const MAX_ROWS = 20, MAX_QTY = 100000, MAX_W = 1000;
export const FUSE_MIN = 1000, FUSE_MAX = 2500;   // ms of burning fuse before the bang
export const ID_RE = /^[a-z0-9_]{1,40}$/;        // an item id or a monster type
const MAX_TILE = 1023;

// A number in [0, 1) from the platform's secure random source (crypto is global in Workers and in Node 20+).
export function cryptoRandom() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
}

// What one cracker gives. The party hat is rolled first, so its odds are exactly 1 in hatOneIn whatever the
// table holds; otherwise one row wins by weight and its quantity is even across min..max.
export function rollCracker(table, hatOneIn, random) {
  if (random() * hatOneIn < 1) {
    const colour = HAT_COLOURS[Math.min(HAT_COLOURS.length - 1, Math.floor(random() * HAT_COLOURS.length))];
    return { id: 'party_hat_' + colour, qty: 1, hat: colour };
  }
  let total = 0;
  for (const row of table) total += row.w;
  let r = random() * total;
  let pick = table[table.length - 1];   // the last row if rounding ever runs out
  for (const row of table) { r -= row.w; if (r < 0) { pick = row; break; } }
  const qty = pick.min + Math.floor(random() * (pick.max - pick.min + 1));
  return { id: pick.id, qty };
}

export const crackerId = (pid, k) => 'p' + pid + '.' + k;

// 'p12.3' -> { pid: 12, k: 3 }; anything else -> null.
export function parseCrackerId(id) {
  if (typeof id !== 'string' || id.length > 30) return null;
  const m = /^p(\d+)\.(\d+)$/.exec(id);
  if (!m) return null;
  const pid = Number(m[1]), k = Number(m[2]);
  return Number.isSafeInteger(pid) && Number.isSafeInteger(k) ? { pid, k } : null;
}

const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

// The admin's prize table, cleaned to exactly {id, min, max, w} per row, or null when any row fails.
export function checkTable(table) {
  if (!Array.isArray(table) || table.length < 1 || table.length > MAX_ROWS) return null;
  const out = [];
  for (const row of table) {
    if (!row || typeof row !== 'object') return null;
    const { id, min, max, w } = row;
    if (typeof id !== 'string' || !ID_RE.test(id)) return null;
    if (!int(min, 1, MAX_QTY) || !int(max, min, MAX_QTY) || !int(w, 1, MAX_W)) return null;
    out.push({ id, min, max, w });
  }
  return out;
}

// The ground the admin's client picked, cleaned to [[tx, ty], ...], or null: 5 to 50 distinct tiles, each two
// integers 0-1023, each within 11 tiles (straight line) of the admin's tile (ax, ay).
export function checkSpots(spots, ax, ay) {
  if (!Array.isArray(spots) || spots.length < MIN_SPOTS || spots.length > MAX_SPOTS) return null;
  const seen = new Set(), out = [];
  for (const s of spots) {
    if (!Array.isArray(s) || s.length !== 2) return null;
    const [tx, ty] = s;
    if (!int(tx, 0, MAX_TILE) || !int(ty, 0, MAX_TILE)) return null;
    if (Math.hypot(tx - ax, ty - ay) > SPOT_RANGE) return null;
    const key = tx + ',' + ty;
    if (seen.has(key)) return null;
    seen.add(key);
    out.push([tx, ty]);
  }
  return out;
}

// 1000 -> '1,000' (the parent page and the log show exact numbers the way people write them).
export const commas = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
