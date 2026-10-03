// ============================================================================
// THE REMATCH RESTS COUNT THE TIME A KNIGHT IS AWAY
// The four rematch bosses rest on the knight's own day clock (player.dayTime, saved with him): the Echo of the Fang
// (28, 600 s), the War Shed's Barrelbeast (20, 300 s), the Thunderbird (66, 300 s) and the Gnasher (33, 180 s). The day
// clock only runs while the game does, so a knight who closed the game with "Ready in 10:00" came back the next day to
// the same 10:00. Now every save stamps the wall clock (player.wallAt), and a load takes the whole seconds since then off
// each rest still running (never below "ready"). The day clock itself is not moved: night and day stay where he left them.
// A new rematch rest is listed in RESTS.
// ============================================================================
{
  // [the quest key, the field that holds the day-clock second the rest ends]
  const RESTS = [['fang', 'restUntil'], ['hollowford', 'shedRestUntil'], ['storm', 'restUntil'], ['tinker', 'restUntil']];
  const AWAY_MAX = 7 * 24 * 3600;
  // what the last load credited (for the check below)
  const LAST = { away: 0, credited: [] };
  function credit(away) {
    LAST.away = away; LAST.credited = [];
    if (!(away >= 1)) return;
    const now = player.dayTime || 0;
    for (const [k, f] of RESTS) {
      const q = quest[k];
      if (!q || typeof q !== 'object' || !(q[f] > now)) continue;
      const was = q[f]; q[f] = Math.max(now, was - away); LAST.credited.push([k, was - q[f]]);
    }
  }
  // (a save made inside a load, as 95's old-save pass makes, keeps the stamp the save came with)
  let loading = false;
  { const _save = save; save = function () { if (!loading) player.wallAt = Date.now(); return _save.apply(this, arguments); }; }
  { const _load = load;
    load = function () {
      let ok; loading = true; try { ok = _load.apply(this, arguments); } finally { loading = false; }
      if (ok) {
        const at = player.wallAt, away = typeof at === 'number' && at > 0 ? Math.floor((Date.now() - at) / 1000) : 0;
        credit(Math.min(AWAY_MAX, Math.max(0, away)));
      }
      return ok;
    }; }
  window.RESTS_AWAY = { RESTS, LAST };

  HOOKS.selfTest.push((check, F) => {
    const P = 'rests: ';
    const keep = { fang: quest.fang && quest.fang.restUntil, shed: quest.hollowford && quest.hollowford.shedRestUntil, day: player.dayTime };
    try {
      const day = player.dayTime || 0;
      if (!quest.fang) quest.fang = {}; if (!quest.hollowford) quest.hollowford = {};
      quest.fang.restUntil = day + 600; quest.hollowford.shedRestUntil = day + 100;
      save();
      // the same save, as if it were written 250 s ago
      // (14-title's load reads the slot, and mirrors it into SAVE_KEY)
      const key = typeof title !== 'undefined' && title.slotKey ? title.slotKey(title.slot) : SAVE_KEY;
      const raw = JSON.parse(localStorage.getItem(key)); raw.player.wallAt = Date.now() - 250 * 1000; localStorage.setItem(key, JSON.stringify(raw));
      const ok = load(); const d2 = player.dayTime || 0;
      const fangLeft = quest.fang.restUntil - d2, shedLeft = quest.hollowford.shedRestUntil - d2;
      // and a save loaded straight away keeps its rests to the second
      quest.fang.restUntil = d2 + 600; save(); load(); const same = Math.abs(quest.fang.restUntil - (player.dayTime || 0) - 600) < 1e-6;
      check(P + 'a load takes the real time since the save off every rematch rest still running: 600 s with 250 s away is 350 s left, 100 s is ready (0), a quick reload keeps 600 s; the day clock is not moved',
        ok && Math.abs(fangLeft - 350) < 1.5 && shedLeft === 0 && same && Math.abs(d2 - day) < 1e-6, { fangLeft, shedLeft, same, day: [day, d2], last: LAST });
    } finally {
      if (quest.fang) quest.fang.restUntil = keep.fang || 0; if (quest.hollowford) quest.hollowford.shedRestUntil = keep.shed || 0; player.dayTime = keep.day; save();
    }
  });
}
