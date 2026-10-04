// ============================================================================
// THE REMATCH RESTS COUNT THE TIME A KNIGHT IS AWAY
// The four rematch bosses rest on the knight's own day clock (player.dayTime, saved with him): the Echo of the Fang
// (28, 600 s), the War Shed's Barrelbeast (20, 300 s), the Thunderbird (66, 300 s) and the Gnasher (33, 180 s). The day
// clock only runs while the game does, so a knight who closed the game with "Ready in 10:00" came back the next day to
// the same 10:00. Now a load takes the whole seconds since that knight was last saved on this device off each rest still
// running (never below "ready"). Every save writes, beside the slot, when it was made and the day clock it held
// (fanglands.rests.N = { t, day }); the save string itself never changes. A load credits the time only when the knight it
// loads has that same day clock to the last fraction of a second (it is the knight that was saved then, not a different
// one put in the slot, a cloud knight at login, a test's fixture), and only after a minute or more away. The day clock is
// not moved: night and day stay where he left them. A new rematch rest is listed in RESTS.
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
  const AWAY_MIN = 60;
  const stampKey = () => typeof title !== 'undefined' && title.slotKey ? 'fanglands.rests.' + title.slot : null;
  const readStamp = () => { const k = stampKey(); if (!k) return null; try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v.t === 'number' && typeof v.day === 'number' ? v : null; } catch (e) { return null; } };
  { const _save = save;
    save = function () {
      const r = _save.apply(this, arguments);
      const k = stampKey();
      // (a save refused by the save lock, a newer world's knight in this slot, writes no stamp either: 72-savelock)
      if (k && !(typeof title !== 'undefined' && title.active) && !(typeof SAVE_LOCK !== 'undefined' && SAVE_LOCK)) { try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), day: player.dayTime || 0 })); } catch (e) { } }
      return r;
    }; }
  { const _load = load;
    load = function () {
      // read before the load: a save made inside it (95's old-save pass) writes the stamp again
      const st = readStamp();
      const ok = _load.apply(this, arguments);
      let away = 0;
      if (ok && st && st.day === (player.dayTime || 0)) away = Math.floor((Date.now() - st.t) / 1000);
      if (ok) credit(away >= AWAY_MIN ? Math.min(AWAY_MAX, away) : 0);
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
      // the same save, as if it were written 250 s ago (its stamp beside the slot); the save string itself never changes for it
      localStorage.setItem(stampKey(), JSON.stringify({ t: Date.now() - 250 * 1000, day: player.dayTime || 0 }));
      const ok = load(); const d2 = player.dayTime || 0;
      const fangLeft = quest.fang.restUntil - d2, shedLeft = quest.hollowford.shedRestUntil - d2;
      // two saves in a row write the same slot string (no clock inside the save)
      save(); const a = localStorage.getItem(title.slotKey(title.slot)); save(); const untouched = localStorage.getItem(title.slotKey(title.slot)) === a;
      // a different knight in the slot (another day clock): nothing credited, however old the stamp
      quest.fang.restUntil = (player.dayTime || 0) + 600; save(); localStorage.setItem(stampKey(), JSON.stringify({ t: Date.now() - 900 * 1000, day: (player.dayTime || 0) + 5 }));
      load(); const other = Math.abs(quest.fang.restUntil - (player.dayTime || 0) - 600) < 1e-6;
      // and a save loaded straight away keeps its rests to the second
      quest.fang.restUntil = d2 + 600; save(); load(); const same = Math.abs(quest.fang.restUntil - (player.dayTime || 0) - 600) < 1e-6;
      check(P + 'a load takes the real time since the save off every rematch rest still running: 600 s with 250 s away is 350 s left, 100 s is ready (0), a quick reload keeps 600 s, a stamp for another knight credits nothing; the save string never changes for it; the day clock is not moved',
        ok && Math.abs(fangLeft - 350) < 1.5 && shedLeft === 0 && same && other && untouched && Math.abs(d2 - day) < 1e-6, { fangLeft, shedLeft, same, other, untouched, day: [day, d2], last: LAST });
    } finally {
      if (quest.fang) quest.fang.restUntil = keep.fang || 0; if (quest.hollowford) quest.hollowford.shedRestUntil = keep.shed || 0; player.dayTime = keep.day; save();
    }
  });
}
