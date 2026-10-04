// ============================================================================
// SAVE LOCK — a page older than its knight's world writes nothing, here or to the cloud (the spread spec, §10 and Stage 0)
// 04-state's load() refuses a save whose worldV is above WORLD_V (only possible after a rollback) and sets SAVE_LOCK; its
// plaque says "This knight lives in a newer world. Reload." This file makes the lock hold for everything that writes:
//   - save() is wrapped OUTERMOST (this file sorts after every other save wrapper: 14-title's slot copy, 63-house's, and
//     72-cloudsave's push), so a locked page neither copies the slot nor stamps it nor books a push;
//   - the same wrapper looks at the slot first: a slot another tab has written from a newer world (worldV above this
//     page's) is never written over, even by a page that loaded an older knight before that tab wrote it;
//   - CLOUD.flush and CLOUD.push return false while locked, so no PUT /api/save goes out from a timer, a page hide or the
//     world's welcome either.
// The lock belongs to the knight on the page: load() clears it for each knight it reads (and sets it again when it
// refuses one), and starting a slot clears it too (an empty slot's fresh knight was never refused).
// It lives in its own file so 72-cloudsave (which other branches are changing) is untouched until Stage 3.
// ============================================================================
{
  // the world the slot on disk was saved in (0 when it names none or cannot be read). The last "worldV": in the string is
  // the save's own (written last; a name in the save cannot fake it, JSON escapes its quotes), so no parse is needed
  const slotKey = () => title.slotKey(title.slot);
  const storedWorldV = () => {
    let raw = null; try { raw = localStorage.getItem(slotKey()); } catch (e) { return 0; }
    if (!raw) return 0;
    const re = /"worldV":(\d+)/g; let m, v = 0; while ((m = re.exec(raw))) v = +m[1];
    return v;
  };
  const _save = save;
  save = function () {
    if (SAVE_LOCK) return;
    if (storedWorldV() > WORLD_V) { SAVE_LOCK = true; saveLockSay = NEWER_WORLD; notify(NEWER_WORLD); return; }   // another tab, a newer world
    return _save.apply(this, arguments);
  };
  // a slot's knight is its own: whatever this page refused before, starting a slot starts unlocked (load() locks again if it must)
  {
    const _start = title.startSlot;
    title.startSlot = function () { SAVE_LOCK = false; return _start.apply(this, arguments); };
  }

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
      // (no hand reset of SAVE_LOCK here: load() itself clears it for the knight it reads)
      const one = JSON.parse(was.slotRaw); delete one.worldV; localStorage.setItem(title.slotKey(title.slot), JSON.stringify(one));
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

  // ---------- self-test: the lock is the refused knight's alone; a failed preparation keeps the slot; another tab's newer save ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'save lock: ', L = window.LOGIN, CUR = 'fanglands.slot.current';
    if (title.active) title.startSlot(title.slot);
    save();
    const slot0 = title.slot, K = n => title.slotKey(n), get = k => localStorage.getItem(k);
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, status: NET.status, playing: L && L.playing, notice, raws: [1, 2, 3].map(n => get(K(n))), cur: get(CUR) };
    const base = JSON.parse(get(K(slot0)));
    const puts = [];
    const fake = {
      call(method, path, body) { if (method === 'PUT' && path === '/api/save') puts.push(body); return method === 'PUT' ? { at: 1 } : { ok: true }; },
      open: () => { const s = { readyState: 1, send(str) { if (JSON.parse(str).t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'Cohen', at: 1, keeper: 'Cohen' }) }); }, close() { s.readyState = 3; if (s.onclose) s.onclose(); } }; return s; },
    };
    const knight = (kills, worldV, stage) => { const d = JSON.parse(JSON.stringify(base)); d.player.kills = kills; d.quest.stage = stage; if (worldV === undefined) delete d.worldV; else d.worldV = worldV; return JSON.stringify(d); };
    const hook = d => { throw new Error('a migration bug'); };
    try {
      NET.enabled = true; NET.useFake(fake); NET.setToken('tok-test'); if (L) L.playing = true; if (window.CLOUD) CLOUD.reset();
      // 1) slot 1 holds a newer world's knight (refused, locked); slot 2 a world-1 knight: starting slot 2 loads it, plays, saves, pushes
      localStorage.setItem(K(1), knight(500, 3, 15)); localStorage.setItem(K(2), knight(200, 1, 4));
      title.startSlot(1); const locked = SAVE_LOCK === true && player.kills !== 500;
      title.startSlot(2); const loaded = !SAVE_LOCK && player.kills === 200;
      player.kills = 333; puts.length = 0; save(); if (window.CLOUD) CLOUD.flush();
      const wrote = JSON.parse(get(K(2)) || '{}'), pushed = puts.length === 1 && JSON.parse(puts[0]).player.kills === 333;
      check(P + 'the lock is the refused knight\'s alone: after slot 1 (worldV 3) is refused, slot 2\'s world-1 knight loads unlocked, its save writes slot 2 and the cloud gets it (one PUT)',
        locked && loaded && wrote.player && wrote.player.kills === 333 && wrote.worldV === WORLD_V && (!window.CLOUD || pushed), { locked, loaded, kills: wrote.player && wrote.player.kills, puts: puts.length });
      // 2) LOGIN.reload (Put my knight back) of a world-1 knight after a refusal: loaded unlocked and saved
      if (L && L.reload) {
        title.startSlot(1); const lock2 = SAVE_LOCK;
        const ok = L.reload(knight(500, undefined, 9), 1234); player.kills = 777; puts.length = 0; save(); if (window.CLOUD) CLOUD.flush();
        const w = JSON.parse(get(K(1)) || '{}');
        check(P + 'Put my knight back after a refusal: the world-1 knight it brings loads unlocked, and its save is written and pushed',
          lock2 && ok && !SAVE_LOCK && w.player && w.player.kills === 777 && (!window.CLOUD || puts.length === 1), { lock2, ok, lock: SAVE_LOCK, kills: w.player && w.player.kills, puts: puts.length });
      }
      // 3) a preparation (HOOKS.saveIn) that throws: nothing loaded, the slot byte for byte as it was, no PUT, locked, the plain sentence
      const old = knight(4321, undefined, 12); localStorage.setItem(K(3), old);
      HOOKS.saveIn.push(hook); puts.length = 0; notice = null;
      title.startSlot(3); player.kills = 5; save(); if (window.CLOUD) { CLOUD.flush(); CLOUD.push(true); }
      HOOKS.saveIn.splice(HOOKS.saveIn.indexOf(hook), 1);
      check(P + 'a save preparation that throws refuses the knight: the slot is left byte for byte, nothing is pushed, the page is locked and says so plainly',
        get(K(3)) === old && puts.length === 0 && SAVE_LOCK === true && quest.stage === 0 && !!notice && /could not be brought into this world/.test(notice.text), { same: get(K(3)) === old, puts: puts.length, lock: SAVE_LOCK, stage: quest.stage, notice: notice && notice.text });
      // 4) another tab writes a newer world's save into the slot this page is playing: this page's next save does not write over it
      localStorage.setItem(K(2), knight(41, 1, 4)); title.startSlot(2); const fine = !SAVE_LOCK && player.kills === 41;
      const tab = knight(999, 3, 15); localStorage.setItem(K(2), tab); puts.length = 0;
      save(); if (window.CLOUD) CLOUD.flush();
      check(P + "another tab's newer-world save in this slot is never written over: this page's save leaves it, locks, and pushes nothing",
        fine && get(K(2)) === tab && SAVE_LOCK === true && puts.length === 0, { fine, same: get(K(2)) === tab, lock: SAVE_LOCK, puts: puts.length });
    } finally {
      const k = HOOKS.saveIn.indexOf(hook); if (k >= 0) HOOKS.saveIn.splice(k, 1);
      SAVE_LOCK = false;
      if (window.CLOUD) CLOUD.reset(); NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.setToken(was.token); NET.status = 'off'; NET.me = null;
      if (L) L.playing = was.playing;
      [1, 2, 3].forEach((n, i) => { if (was.raws[i] === null) localStorage.removeItem(K(n)); else localStorage.setItem(K(n), was.raws[i]); });
      title.slot = slot0; if (was.cur === null) localStorage.removeItem(CUR); else localStorage.setItem(CUR, was.cur);
      load(); notice = was.notice;
      if (was.status === 'on' && NET.token) NET.connect();
    }
  });
}
