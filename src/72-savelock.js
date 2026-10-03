// ============================================================================
// SAVE LOCK — a page older than its knight's world writes nothing, here or to the cloud (the spread spec, §10 and Stage 0)
// 04-state's load() refuses a save whose worldV is above WORLD_V (only possible after a rollback) and sets SAVE_LOCK; its
// plaque says "This knight lives in a newer world. Reload." This file makes the lock hold for everything that writes:
//   - save() is wrapped OUTERMOST (this file sorts after every other save wrapper: 14-title's slot copy, 63-house's, and
//     72-cloudsave's push), so a locked page neither copies the slot nor stamps it nor books a push;
//   - CLOUD.flush and CLOUD.push return false while locked, so no PUT /api/save goes out from a timer, a page hide or the
//     world's welcome either.
// It lives in its own file so 72-cloudsave (which other branches are changing) is untouched until Stage 3.
// ============================================================================
{
  const _save = save;
  save = function () { if (SAVE_LOCK) return; return _save.apply(this, arguments); };

  const C = window.CLOUD;
  if (C) {
    const _flush = C.flush, _push = C.push;
    C.flush = function () { if (SAVE_LOCK) return false; return _flush.apply(this, arguments); };
    C.push = function () { if (SAVE_LOCK) return false; return _push.apply(this, arguments); };
  }

  // ---------- self-test: a save from world 3 is refused, and nothing is written (local or cloud) ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'save lock: ', L = window.LOGIN;
    if (title.active) title.startSlot(title.slot);
    save();   // the slot holds this knight now; it is put back at the end
    const keys = () => { const out = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); out[k] = localStorage.getItem(k); } return out; };
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, status: NET.status, playing: L && L.playing, notice, slotRaw: localStorage.getItem(title.slotKey(title.slot)) };
    const puts = [];
    const fake = {
      call(method, path, body) { if (method === 'PUT' && path === '/api/save') puts.push(body); return method === 'PUT' ? { at: 1 } : { ok: true }; },
      open: () => { const s = { readyState: 1, send(str) { if (JSON.parse(str).t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'Cohen', at: 1, keeper: 'Cohen' }) }); }, close() { s.readyState = 3; if (s.onclose) s.onclose(); } }; return s; },
    };
    try {
      // a knight saved by a newer world: today's save with worldV 3 and a mark no world-1 game would write
      const newer = JSON.parse(was.slotRaw); newer.worldV = 3; newer.player.x = tc(3); newer.player.y = tc(3); newer.quest.stage = 15; newer.spreadMark = 'from world 3';
      const newerRaw = JSON.stringify(newer);
      localStorage.setItem(title.slotKey(title.slot), newerRaw);
      NET.enabled = true; NET.useFake(fake); NET.setToken('tok-test'); if (L) L.playing = true; if (window.CLOUD) CLOUD.reset();
      const before = keys(); notice = null;
      // the title's own door (a fresh world, then load(); a refused load falls through to save()), then everything else that writes
      title.startSlot(title.slot);
      const refused = SAVE_LOCK === true && quest.stage === 0 && Math.floor(player.x / TILE) !== 3 && !!notice && notice.text === 'This knight lives in a newer world. Reload.';
      player.kills++; save(); if (window.CLOUD) { CLOUD.flush(); CLOUD.push(true); }
      NET.connect(); NET.disconnect();   // the world's welcome asks for a push when the cloud may be behind
      // the one key that may differ is 14-title's mirror (SAVE_KEY): the title copies the slot into it before the core reads
      // it, so it can only become the refused save's own string, unchanged
      const after = keys(), changed = Object.keys(Object.assign({}, before, after)).filter(k => before[k] !== after[k] && !(k === SAVE_KEY && after[k] === newerRaw));
      check(P + 'a save from a newer world (worldV 3) is refused: nothing loaded, SAVE_LOCK set, the plain sentence shown', refused && localStorage.getItem(title.slotKey(title.slot)) === newerRaw, { refused, lock: SAVE_LOCK, stage: quest.stage, notice: notice && notice.text });
      check(P + 'while locked nothing is written: the slot and its stamp keep the newer knight, no other key changes (the title\'s mirror only ever holds that same save) and no PUT /api/save goes out (save, flush, push, the welcome)', changed.length === 0 && puts.length === 0 && (!window.CLOUD || CLOUD.pending === null), { changed, puts: puts.length, pending: window.CLOUD && CLOUD.pending });
      render(); const plaque = buttons.find(b => b.label === 'NEWER WORLD');
      check(P + 'the NEWER WORLD plaque is up and its tap reloads the page', !!plaque && plaque.w >= 44 && plaque.h >= 32, { plaque: !!plaque });
      // a world-1 save (no worldV, or worldV 1) still loads exactly as before
      SAVE_LOCK = false; const one = JSON.parse(was.slotRaw); delete one.worldV; localStorage.setItem(title.slotKey(title.slot), JSON.stringify(one));
      const loads = load() === true && !SAVE_LOCK; save(); const wrote = JSON.parse(localStorage.getItem(title.slotKey(title.slot)) || '{}');
      check(P + 'a world-1 save loads as before, and a save names its world (worldV ' + WORLD_V + ')', loads && wrote.worldV === WORLD_V, { loads, worldV: wrote.worldV });
    } finally {
      SAVE_LOCK = false;
      if (window.CLOUD) CLOUD.reset(); NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.setToken(was.token); NET.status = 'off'; NET.me = null;
      if (L) L.playing = was.playing;
      localStorage.setItem(title.slotKey(title.slot), was.slotRaw); load(); notice = was.notice;
      if (was.status === 'on' && NET.token) NET.connect();
    }
  });
}
