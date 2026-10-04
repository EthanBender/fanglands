// ============================================================================
// THE REMATCH RESTS COUNT THE TIME A KNIGHT IS AWAY
// The four rematch bosses rest on the knight's own day clock (player.dayTime, saved with him): the Echo of the Fang
// (28, 600 s), the War Shed's Barrelbeast (20, 300 s), the Thunderbird (66, 300 s) and the Gnasher (33, 180 s). The day
// clock only runs while the game does, so a knight who closed the game with "Ready in 10:00" came back the next day to
// the same 10:00. Now a load takes the whole seconds since the slot was last saved off each rest still running (never below
// "ready"). The time of the last save is 14-title's own stamp beside the slot (fanglands.slot.N.at), read before the load
// runs, so the save itself does not change. The day clock is not moved: night and day stay where he left them. A save
// that comes from the world at login carries no stamp of this device's, so it is not credited. A new rematch rest is
// listed in RESTS.
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
  const atKey = () => typeof title !== 'undefined' && title.slotKey ? title.slotKey(title.slot) + '.at' : null;
  const savedAt = () => { const k = atKey(); if (!k) return 0; try { return +localStorage.getItem(k) || 0; } catch (e) { return 0; } };
  { const _load = load;
    load = function () {
      // read before the load: a save made inside it (95's old-save pass) stamps the slot again
      const at = savedAt();
      const ok = _load.apply(this, arguments);
      if (ok) credit(Math.min(AWAY_MAX, Math.max(0, at > 0 ? Math.floor((Date.now() - at) / 1000) : 0)));
      return ok;
    }; }
  window.RESTS_AWAY = { RESTS, LAST };

  HOOKS.selfTest.push((check, F) => {
    const P = 'rests: ';
    const keep = { fang: quest.fang && quest.fang.restUntil, shed: quest.hollowford && quest.hollowford.shedRestUntil, day: player.dayTime };
    if (typeof title === 'undefined' || !title.slotKey) { check(P + 'the rests read 14-title\'s slot stamp', false, {}); return; }
    try {
      const day = player.dayTime || 0;
      if (!quest.fang) quest.fang = {}; if (!quest.hollowford) quest.hollowford = {};
      quest.fang.restUntil = day + 600; quest.hollowford.shedRestUntil = day + 100;
      save();
      // the same save, as if it were written 250 s ago (the slot's own stamp), and the save string itself untouched by it
      const raw = localStorage.getItem(title.slotKey(title.slot)); localStorage.setItem(atKey(), String(Date.now() - 250 * 1000));
      const ok = load(); const d2 = player.dayTime || 0;
      save(); const untouched = !/wallAt/.test(raw) && !/wallAt/.test(localStorage.getItem(title.slotKey(title.slot)));
      const fangLeft = quest.fang.restUntil - d2, shedLeft = quest.hollowford.shedRestUntil - d2;
      // and a save loaded straight away keeps its rests to the second
      quest.fang.restUntil = d2 + 600; save(); load(); const same = Math.abs(quest.fang.restUntil - (player.dayTime || 0) - 600) < 1e-6;
      check(P + 'a load takes the real time since the save off every rematch rest still running: 600 s with 250 s away is 350 s left, 100 s is ready (0), a quick reload keeps 600 s; the day clock is not moved',
        ok && Math.abs(fangLeft - 350) < 1.5 && shedLeft === 0 && same && untouched && Math.abs(d2 - day) < 1e-6, { fangLeft, shedLeft, same, untouched, day: [day, d2], last: LAST });
    } finally {
      if (quest.fang) quest.fang.restUntil = keep.fang || 0; if (quest.hollowford) quest.hollowford.shedRestUntil = keep.shed || 0; player.dayTime = keep.day; save();
    }
  });
}
