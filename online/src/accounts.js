// ============================================================================
// ACCOUNTS — every knight the world knows, on line or not, the way an admin's game and the parent page list them
// Owner (2026-09-25): "can you add to the admin consol to see all the active accounts even if they are looged out with
// the ability to reset their passwords and see how much time they have logged playing and when they have logged in"
// docs/ONLINE.md, "Accounts", is the contract. Pure JavaScript over the World's SQL (sql.exec(q, ...args).toArray()),
// its store and its room, so the Node tests run it on node's own SQLite.
//
// Two different clocks, both shown, never mixed:
//   onlineMs     time connected to the world: every login row's length added up (accounts.online_ms), plus the one
//                still open. Counted only from countedSince (the first wake of the code that keeps logins).
//   playSeconds  the knight's own play clock (player.playSeconds in the newest cloud save): the game adds to it
//                every frame it runs unpaused, online or not, since the knight was made.
// ============================================================================

export const LOGINS_SHOWN = 10;          // the last logins each row carries
export const RESETS_PER_MINUTE = 3;      // secret words one admin may change in any minute, from the game
export const RESET_TEXT = 'An admin changed your secret word. Ask them for the new one, then log in again.';

// A number of seconds a person could have played, or null: anything else a save might hold (text, a negative, a huge
// number, an object) is not shown as a time.
const cleanSeconds = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e10) ? Math.floor(v) : null;

// player.playSeconds from the knight's newest save. SQLite reads it without JavaScript parsing the whole save (a save
// can be half a megabyte); a runtime without SQLite's JSON functions falls back to JSON.parse in a try.
export function playSecondsOf(sql, lc) {
  try {
    const r = sql.exec("SELECT CASE WHEN json_valid(json) THEN json_extract(json, '$.player.playSeconds') END AS ps FROM saves WHERE name_lc = ? ORDER BY ver DESC LIMIT 1", lc).toArray()[0];
    return r ? cleanSeconds(r.ps) : null;
  } catch (e) {
    const r = sql.exec('SELECT json FROM saves WHERE name_lc = ? ORDER BY ver DESC LIMIT 1', lc).toArray()[0];
    if (!r) return null;
    try { const d = JSON.parse(r.json); return cleanSeconds(d && d.player && d.player.playSeconds); } catch (e2) { return null; }
  }
}

// Every account, sorted by name (the parent page's order; the game puts the ones on line first itself):
//   {name, role, created, lastSeen, saveAt, banned, mutedUntil,
//    online, map, region, lv,                  where the knight is now (null when not on line)
//    lastLogin, lastOn,                        the newest login's start; the last moment the world heard from them
//    onlineMs, countedSince, playSeconds,      the two clocks above
//    logins: [{at, ms, open}]}                 the last LOGINS_SHOWN logins, newest first; open = still on
export function accountList({ sql, store, room, now, since }) {
  const rows = sql.exec('SELECT a.name_lc, a.name, a.created, a.last_seen, a.banned, a.role, a.muted_until, a.online_ms, (SELECT MAX(at) FROM saves s WHERE s.name_lc = a.name_lc) AS save_at FROM accounts a ORDER BY a.name_lc').toArray();
  const on = new Map(room.online().map(k => [String(k.n).toLowerCase(), k]));
  return rows.map(a => {
    const k = on.get(a.name_lc) || null;
    const live = k ? room.loginOf(a.name_lc) : null;
    const hist = typeof store.logins === 'function' ? store.logins(a.name_lc, LOGINS_SHOWN) : [];
    const logins = hist.map(r => {
      const open = r.ended == null;
      const end = !open ? r.ended : (live && live.id === r.id ? now : r.seen);
      return { at: r.started, ms: Math.max(0, end - r.started), open: open && !!live && live.id === r.id };
    });
    const liveRow = live ? hist.find(r => r.id === live.id) : null;
    const lastEnded = hist.reduce((m, r) => Math.max(m, r.ended || 0), 0);
    return {
      name: a.name, role: a.role === 'admin' ? 'admin' : 'player', created: a.created, lastSeen: a.last_seen, saveAt: a.save_at,
      banned: !!a.banned, mutedUntil: Number(a.muted_until) || 0,
      online: !!k, map: k ? k.map : null, region: k ? (k.region || '') : null, lv: k ? (k.lv || 0) : null,
      lastLogin: hist.length ? hist[0].started : null,
      lastOn: k ? now : Math.max(Number(a.last_seen) || 0, lastEnded) || null,
      onlineMs: (Number(a.online_ms) || 0) + (liveRow ? Math.max(0, now - liveRow.started) : 0),
      countedSince: Math.max(Number(since) || 0, Number(a.created) || 0),
      playSeconds: playSecondsOf(sql, a.name_lc),
      logins,
    };
  });
}
