// ============================================================================
// DROP PARTY — crackers rain down around an admin, anyone lights one, BANG, confetti, a prize; and party hats
// Owner (Ethan, about his own knight MudGoll on gorkscape.ca): "...be able to spawn mobs for fun or do drop pratys
// where Crackers drop randomly on the ground around me and they can be lit and boom for random rewards that I select
// and make it so i can drop party hats that will be SUPER RARE".
// docs/ONLINE.md, "Admins and drop parties" (Drop parties, Party hats, Plain words), is the contract this file keeps.
// Who decides what: the admin's client (this file) picks the ground and the prize table; the SERVER makes and stores
// every cracker, decides the one knight who lit each first and rolls the prize (party hat first); everyone on the
// map sees the fuse, the bang and the confetti; only the lighter's client adds the prize, and only from a `boom` or
// a `prize` that names this knight. A prize is never lost and never doubled: the cracker id goes into
// player.party.claimed (saved with the knight) before `claim` goes out, and while the cloud save is on, `claim`
// waits for a cloud push that holds that id.
// Party hats: six colours of paper crown, worn in the helm slot, drawn on any knight whose look carries `hat`.
// Death never takes one. Their six icons live in src/81-partyhats.js (it loads after 80-icons).
// Feature file: HOOKS only, plus three core functions wrapped by reassignment with explicit arguments (playerLook,
// drawHuman, die). window.PARTY is the register; 76-admin's "Drop party" button opens HOOKS.panel.party.
// ============================================================================
{
  // ---------- the six party hats (the contract's "Party hats") ----------
  const COLOURS = ['red', 'yellow', 'blue', 'green', 'purple', 'white'];
  // six clear colours; white is a warm paper white that reads on the dark panels and, with its outline, on grass
  const HEX = { red: '#e5484d', yellow: '#f5d90a', blue: '#3e8ef7', green: '#3fb950', purple: '#a371f7', white: '#f4f1ea' };
  const HATS = {};
  for (const c of COLOURS) HATS[c] = 'party_hat_' + c;
  const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
  {
    const add = {};
    for (const c of COLOURS) add[HATS[c]] = { name: cap1(c) + ' party hat', value: 10000, color: HEX[c], shape: 'helm', armour: { slot: 'helm', def: 0 }, partyHat: c };
    Object.assign(ITEMS, add);
    for (const id in add) { ITEMS[id].id = id; ITEMS[id].stack = 1; }
  }
  const isHat = id => !!(typeof id === 'string' && ITEMS[id] && ITEMS[id].partyHat);

  // ---------- worn: a paper crown instead of a helm, with the hair showing under it ----------
  const _playerLook = playerLook;
  playerLook = function () {
    const look = _playerLook();
    const h = player.equip.helm, def = h ? ITEMS[h] : null;
    if (def && def.partyHat) { look.hat = def.partyHat; delete look.helm; }
    return look;
  };
  // A band round the head with four paper points, a lighter paper edge and a fold down the middle. The head is the
  // circle at (0,-8) r 8 and the hair reaches y -19, so the band sits on the hair and the points stand above it.
  // Cheap on purpose: drawHuman runs for every villager every frame, and only a look with `hat` pays for this.
  function drawCrown(g, colour) {
    g.fillStyle = HEX[colour] || HEX.white;
    g.beginPath(); g.moveTo(-8.6, -13); g.lineTo(-8.6, -17.2); g.lineTo(-6.45, -23); g.lineTo(-4.3, -17.2); g.lineTo(-2.15, -23); g.lineTo(0, -17.2);
    g.lineTo(2.15, -23); g.lineTo(4.3, -17.2); g.lineTo(6.45, -23); g.lineTo(8.6, -17.2); g.lineTo(8.6, -13); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(-8.1, -15.2, 16.2, 1.6);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(0, -17.2); g.lineTo(0, -13); g.stroke();
  }
  const _drawHuman = drawHuman;
  drawHuman = function (g, e, look) {
    _drawHuman(g, e, look);
    if (look && look.hat) drawCrown(g, look.hat);
  };

  // ---------- Death never takes a party hat ----------
  // The hats step out of the pack, the fall happens exactly as before (76-admin's "Can't be hurt" wrapper sits
  // inside this one and may stop it, and then nothing was lost anyway), and the hats go back whatever happened.
  const _die = die;
  die = function () {
    const kept = [];
    for (let i = 0; i < player.inv.length; i++) { const s = player.inv[i]; if (s && isHat(s.id)) { kept.push({ i, s }); player.inv[i] = null; } }
    try { return _die(); } finally { if (kept.length) putBack(kept); }
  };
  function putBack(kept) {
    for (const { i, s } of kept) {
      if (i < player.inv.length && !player.inv[i]) { player.inv[i] = s; continue; }
      const j = player.inv.findIndex(x => !x);
      if (j >= 0) { player.inv[j] = s; continue; }
      if (bankAdd(s.id, s.qty)) continue;
      drops.push({ x: player.x, y: player.y, id: s.id, qty: s.qty, t: 0 });
    }
  }

  // ---------- the wiki: a page for each hat ----------
  if (window.WIKI && typeof WIKI.add === 'function') {
    const head = t => ({ t, c: '#f5c542', f: 'bold 12px sans-serif', head: true });
    for (const c of COLOURS) WIKI.add('items', {
      id: HATS[c], name: ITEMS[HATS[c]].name,
      sources: [{ kind: 'given', text: 'Found only in drop party crackers.' }],
      lines: [
        { t: 'A paper crown for your head. It is just for fun: it gives no defence.', c: '#e6edf3' },
        'Worth 10,000 coins: the most valuable thing in the Fanglands.',
        head('HOW TO GET IT'),
        'Found only in drop party crackers. Super rare: 1 in 1,000 crackers at the usual odds.',
        head('GOOD TO KNOW'),
        'Death never takes a party hat.',
        'There are six colours: red, yellow, blue, green, purple and white.',
        'Wear it from your pack. Hand it to a friend with Give, or keep it safe in the bank.',
      ],
    });
  }

  // ---------- numbers from the contract ----------
  const PARTY_MS = 15 * 60 * 1000;   // a party lasts 15 minutes
  const LIGHT_REACH = 1.5 * TILE;    // USE lights a cracker this close to the knight (or on the faced tile)
  const LIGHT_EVERY = 1000;          // ms: one light per cracker per second, at most
  const THROW_EVERY = 5000;          // ms: the server takes one party per 5 s
  const KEEP = 300;                  // player.party.claimed keeps the newest 300 cracker ids
  const BANNER_MS = 5000;
  const COUNT_MIN = 5, COUNT_MAX = 50, SCATTER_MIN = 3, SCATTER_MAX = 10, SERVER_REACH = 11;
  const HAT_CHOICES = [10000, 1000, 100, 10];
  const QTY_MAX = 100000, GEAR_MAX = 5, W_MAX = 1000, ROWS_MAX = 20;
  const ID_RE = /^p(\d+)\.(\d+)$/;
  const ITEM_RE = /^[a-z0-9_]{1,40}$/;

  // ---------- state ----------
  const S = {
    parties: new Map(),   // pid -> { pid, map, by, until, ended, crackers: Map id -> { id, k, tx, ty, lit: null | { n, fuse, reward, el } } }
    banged: new Set(), bangOrder: [],   // ids that already went bang here: a repeated boom never bangs twice
    pops: [],             // prize icons rising out of a bang: { x, y, id, t, dur, big }
    banner: null,         // { text, kind, at } the gold line across the top
    bannerRect: null,
    lastLight: new Map(), // cracker id -> nowMs() of the last light we sent
    lastThrow: -1e9,
    waiting: [],          // cracker ids granted here whose claim waits for a cloud push that holds them
    waitT: 0,
    notes: [], noteUntil: -1e9,
    role: 'player',       // the server's word, for as long as 70-net has no NET.role to ask
    map: null,
  };
  const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
  const netOn = () => typeof NET !== 'undefined' && NET.online();
  const meName = () => (typeof NET !== 'undefined' && NET.me) || null;
  const roleNow = () => (typeof NET !== 'undefined' && typeof NET.role === 'string' && NET.role) ? NET.role : S.role;
  const isAdmin = () => netOn() && roleNow() === 'admin';
  const mapNow = () => {
    if (window.PLAYERS && typeof PLAYERS.mapId === 'function') return PLAYERS.mapId();
    if (window.COOP && typeof COOP.map === 'function') return COOP.map();
    return 'over';
  };
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const ensure = () => { if (!player.party || typeof player.party !== 'object' || !Array.isArray(player.party.claimed)) player.party = { claimed: [] }; return player.party; };
  HOOKS.newGame.push(() => { player.party = { claimed: [] }; S.pops.length = 0; });

  // sentences one after another, so "you found a hat" is not wiped by "it went to your bank" in the same frame
  function note(text) { S.notes.push(text); if (time >= S.noteUntil) nextNote(); }
  function nextNote() { const t = S.notes.shift(); if (t) { notify(t); S.noteUntil = time + 2.4; } }

  // ---------- rewards, and the words for them ----------
  function cleanReward(r) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !ITEM_RE.test(r.id)) return null;
    const qty = Math.floor(num(r.qty) || 0);
    if (qty < 1 || qty > QTY_MAX) return null;
    const out = { id: r.id, qty };
    if (typeof r.hat === 'string' && COLOURS.includes(r.hat)) out.hat = r.hat;
    return out;
  }
  function prizeWords(r) {
    if (!r) return 'a prize';
    const def = ITEMS[r.id];
    if (!def) return 'something new';
    if (def.partyHat) return 'a ' + def.partyHat + ' party hat';
    if (r.id === 'coins') return fmt(r.qty) + (r.qty === 1 ? ' coin' : ' coins');
    return fmt(r.qty) + ' ' + def.name;
  }

  // ---------- the prize: pack, then bank, then at your feet; claimed in the save before the claim goes out ----------
  function grant(id, reward, how) {
    const pr = ensure();
    if (typeof id !== 'string' || !ID_RE.test(id)) return 'bad';
    if (pr.claimed.includes(id)) { claimSoon(id); return 'again'; }
    const r = cleanReward(reward);
    if (!r || !ITEMS[r.id]) { note('That prize needs the newest game. Reload the page to get it.'); return 'unknown'; }
    const def = ITEMS[r.id];
    const inPack = Math.min(r.qty, Math.max(0, roomFor(r.id)));
    if (inPack > 0) addItem(r.id, inPack);
    let left = r.qty - inPack, where = 'pack';
    if (left > 0 && bankAdd(r.id, left)) { left = 0; where = 'bank'; }
    if (left > 0) { drops.push({ x: player.x + rint(-10, 10), y: player.y + rint(-10, 10), id: r.id, qty: left, t: 0 }); where = 'feet'; }
    pr.claimed.push(id);
    while (pr.claimed.length > KEEP) pr.claimed.shift();
    if (how === 'prize') note('From a cracker you lit: ' + prizeWords(r) + '.');
    if (def.partyHat) {
      note('You found a ' + def.partyHat + ' party hat!' + (where === 'pack' ? ' Open your pack to wear it.' : ''));
      levelBanner = { text: def.name + '!', sub: where === 'pack' ? 'Super rare. Open your pack to wear it.' : 'Super rare.', t: 4 };
      burst(player.x, player.y, '#f5c542', 26, 150); sfx('levelup');
    } else {
      floatText(player.x, player.y - 30, '+' + (r.qty > 1 ? fmt(r.qty) + ' ' : '') + def.name, def.color);
      sfx('pickup');
    }
    if (where === 'bank') note('Your pack was full, so it went to your bank.');
    if (where === 'feet') note('Your pack and your bank were full, so it fell at your feet.');
    save();
    claimSoon(id);
    return where;
  }
  // With the cloud save on, the claim waits until the cloud is known to hold a save with that id in it
  // (CLOUD.known is the last string the cloud is known to have); a failed push keeps it waiting for the next
  // good one. With no cloud (tests, the simulation) the claim goes straight after save().
  const cloudOn = () => !!(window.CLOUD && typeof CLOUD.active === 'function' && CLOUD.active());
  const cloudHolds = id => !!(window.CLOUD && typeof CLOUD.known === 'string' && CLOUD.known.indexOf('"' + id + '"') >= 0);
  function claimSoon(id) {
    if (!cloudOn()) { if (netOn()) NET.send({ t: 'claim', id }); return; }
    if (!S.waiting.includes(id)) { S.waiting.push(id); while (S.waiting.length > KEEP) S.waiting.shift(); }
    if (!cloudHolds(id)) { try { CLOUD.push(true); } catch (e) { } }
    checkWaiting();
  }
  function checkWaiting() {
    if (!netOn()) return;
    for (let i = S.waiting.length - 1; i >= 0; i--) { const id = S.waiting[i]; if ((cloudHolds(id) || !cloudOn()) && NET.send({ t: 'claim', id })) S.waiting.splice(i, 1); }
  }

  // ---------- crackers on the ground: the wire ----------
  function findCracker(id) {
    const r = typeof id === 'string' ? ID_RE.exec(id) : null; if (!r) return null;
    const p = S.parties.get(+r[1]); return p ? p.crackers.get(id) || null : null;
  }
  function markBanged(id) { S.banged.add(id); S.bangOrder.push(id); while (S.bangOrder.length > 600) S.banged.delete(S.bangOrder.shift()); }
  // the unlit ones go (a lit one finishes its fuse); a party with nothing left is forgotten
  function endParty(p) {
    p.ended = true;
    for (const [id, c] of p.crackers) if (!c.lit) p.crackers.delete(id);
    if (!p.crackers.size) S.parties.delete(p.pid);
  }
  function dropUnlit(keepMap) {
    for (const p of [...S.parties.values()]) {
      if (keepMap !== null && p.map === keepMap) continue;
      for (const [id, c] of p.crackers) if (!c.lit) p.crackers.delete(id);
      if (!p.crackers.size) S.parties.delete(p.pid);
    }
  }
  function onCrackers(m) {
    if (!m || typeof m.map !== 'string' || !Array.isArray(m.list)) return;
    const pid = num(m.pid); if (pid === null || pid < 0 || pid !== Math.floor(pid)) return;
    const left = num(m.left);
    let p = S.parties.get(pid);
    if (!p) { p = { pid, map: m.map, by: '', until: 0, ended: false, crackers: new Map() }; S.parties.set(pid, p); }
    p.map = m.map; p.ended = false;
    if (typeof m.by === 'string') p.by = m.by;
    p.until = nowMs() + clamp(left === null ? PARTY_MS : left, 0, PARTY_MS);
    for (const [id, c] of p.crackers) if (!c.lit) p.crackers.delete(id);
    for (const e of m.list.slice(0, 400)) {
      if (!Array.isArray(e) || e.length < 3 || typeof e[0] !== 'string') continue;
      const r = ID_RE.exec(e[0]), tx = num(e[1]), ty = num(e[2]);
      if (!r || +r[1] !== pid || tx === null || ty === null) continue;
      if (p.crackers.has(e[0]) || S.banged.has(e[0])) continue;
      p.crackers.set(e[0], { id: e[0], k: +r[2], tx: Math.floor(tx), ty: Math.floor(ty), lit: null });
    }
    if (!p.crackers.size) S.parties.delete(pid);
  }
  function onBoom(m) {
    if (!m || typeof m.id !== 'string') return;
    const r = ID_RE.exec(m.id); if (!r) return;
    const id = m.id, pid = +r[1], n = typeof m.n === 'string' ? m.n : '';
    const reward = cleanReward(m.reward), fz = num(m.fuse);
    const fuse = clamp(fz === null ? 1500 : fz, 0, 5000);
    // said twice: it already went bang here. The prize is in the save (or never could be); claiming again is harmless.
    if (S.banged.has(id)) { if (n && n === meName()) grant(id, reward, 'boom'); return; }
    let p = S.parties.get(pid);
    if (!p) { p = { pid, map: mapNow(), by: '', until: nowMs() + 60000, ended: true, crackers: new Map() }; S.parties.set(pid, p); }
    let c = p.crackers.get(id);
    if (c && c.lit) return;
    if (!c) { c = { id, k: +r[2], tx: null, ty: null, lit: null }; p.crackers.set(id, c); }
    c.lit = { n, fuse, reward, el: 0 };
    if (p.map === mapNow() && c.tx !== null) sfx('fire');
  }
  const CONFETTI = ['#e5484d', '#f5d90a', '#3e8ef7', '#3fb950', '#a371f7', '#ffffff', '#ff8c42'];
  function bang(p, c) {
    p.crackers.delete(c.id);
    markBanged(c.id);
    const L = c.lit, mine = !!L.n && L.n === meName();
    const def = L.reward ? ITEMS[L.reward.id] : null, big = !!(def && def.partyHat);
    if (p.map === mapNow() && c.tx !== null) {
      const x = tc(c.tx), y = tc(c.ty);
      sfx('boom');
      for (const col of CONFETTI) burst(x, y - 6, col, big ? 9 : 5, big ? 220 : 150);
      if (big) { burst(x, y - 6, '#f5c542', 22, 260); if (!mine) sfx('levelup'); }
      S.pops.push({ x, y, id: def ? L.reward.id : null, t: 0, dur: big ? 2.6 : 1.8, big });
      const who = L.n || 'Someone';
      floatText(x, y - 36, big ? who + ': ' + def.name + '!' : who + ': ' + prizeWords(L.reward), big ? '#f5c542' : '#ffe9a8', big ? 20 : 14);
    }
    if (mine) grant(c.id, L.reward, 'boom');
    if (p.ended && !p.crackers.size) S.parties.delete(p.pid);
  }
  const PARTY_NO = {
    bad: 'That party did not pass the checks. Try again.',
    busy: 'There are too many crackers here already. Light some first.',
    where: 'The world does not know where you are yet. Walk a step and try again.',
  };
  const instName = id => { const i = window.INSTANCES && typeof INSTANCES.get === 'function' ? INSTANCES.get(id) : null; return i && i.name ? i.name : String(id); };
  const whereWords = m => (typeof m.region === 'string' && m.region.trim()) ? m.region.trim().slice(0, 40) : (m.map === 'over' || !m.map) ? 'the Fanglands' : instName(m.map);
  function onAnnounce(m) {
    if (!m || typeof m.n !== 'string') return;
    let text = null;
    if (m.kind === 'party') text = m.n + ' started a drop party in ' + whereWords(m) + '!';
    else if (m.kind === 'hat' && COLOURS.includes(m.colour)) text = m.n + ' found a ' + m.colour + ' party hat!';
    if (!text) return;
    S.banner = { text, kind: m.kind, at: nowMs() };
    if (window.CHAT && typeof CHAT.system === 'function') { try { CHAT.system(text, '#f5c542'); } catch (e) { } }
    sfx(m.kind === 'hat' ? 'quest' : 'open');
  }
  function onLightNo(m) {
    if (!m) return;
    if (m.code === 'far') { note('Walk up to the cracker first.'); return; }
    if (m.code !== 'gone') return;
    note('That cracker is gone.');
    const r = typeof m.id === 'string' ? ID_RE.exec(m.id) : null, p = r ? S.parties.get(+r[1]) : null, c = p ? p.crackers.get(m.id) : null;
    if (c && !c.lit) { p.crackers.delete(m.id); if (!p.crackers.size) S.parties.delete(p.pid); }
  }
  if (typeof NET !== 'undefined') {
    NET.on('welcome', m => { S.role = m && m.role === 'admin' ? 'admin' : 'player'; dropUnlit(null); if (S.waiting.length) checkWaiting(); });
    NET.on('role', m => { S.role = m && m.role === 'admin' ? 'admin' : 'player'; });
    NET.on('offline', () => { S.role = 'player'; dropUnlit(null); });
    NET.on('crackers', onCrackers);
    NET.on('boom', onBoom);
    NET.on('party_end', m => { const pid = m ? num(m.pid) : null; const p = pid === null ? null : S.parties.get(pid); if (p) endParty(p); });
    NET.on('light_no', onLightNo);
    NET.on('prize', m => { if (m && typeof m.id === 'string') grant(m.id, m.reward, 'prize'); });
    NET.on('party_no', m => { const t = m && PARTY_NO[m.code]; if (t) note(t); });
    NET.on('announce', onAnnounce);
  }

  // ---------- lighting one ----------
  // the cracker USE would light: the nearest live unlit one within 1.5 tiles, or the one on the faced tile
  function lightable(ftx, fty) {
    if (!netOn() || player.dead || player.mech || !S.parties.size) return null;
    const map = mapNow(); let best = null, bd = Infinity;
    for (const p of S.parties.values()) {
      if (p.map !== map) continue;
      for (const c of p.crackers.values()) {
        if (c.lit || c.tx === null) continue;
        const d = dist(player.x, player.y, tc(c.tx), tc(c.ty));
        if ((d <= LIGHT_REACH || (c.tx === ftx && c.ty === fty)) && d < bd) { bd = d; best = c; }
      }
    }
    return best;
  }
  function light(id) {
    const c = findCracker(id);
    if (!c || c.lit) return false;
    if (!netOn()) { note('You are not connected.'); return false; }
    const now = nowMs(), last = S.lastLight.get(id);
    if (last !== undefined && now - last < LIGHT_EVERY) return false;
    if (!NET.send({ t: 'light', id, x: Math.round(player.x), y: Math.round(player.y) })) return false;
    S.lastLight.set(id, now);
    sfx('ui');
    return true;
  }
  HOOKS.use.push((t, tx, ty) => { const c = lightable(tx, ty); if (!c) return false; light(c.id); return true; });
  // a tap (or a click) on a cracker walks up to it and lights it, the way a tap on a person walks up and talks
  TAP_PEOPLE.push(() => {
    if (!netOn() || !S.parties.size) return [];
    const map = mapNow(), out = [];
    for (const p of S.parties.values()) {
      if (p.map !== map) continue;
      for (const c of p.crackers.values()) if (!c.lit && c.tx !== null) out.push({ x: tc(c.tx), y: tc(c.ty), r: 13, id: c.id, name: 'Cracker', talk: () => light(c.id) });
    }
    return out;
  });
  // the nearest live party on this map, as a gold target on the world map
  HOOKS.mapTarget.push(() => {
    if (!netOn() || !S.parties.size) return null;
    const map = mapNow(); let best = null, bd = Infinity;
    for (const p of S.parties.values()) {
      if (p.map !== map) continue;
      for (const c of p.crackers.values()) { if (c.lit || c.tx === null) continue; const d = dist(player.x, player.y, tc(c.tx), tc(c.ty)); if (d < bd) { bd = d; best = c; } }
    }
    return best ? { x: best.tx, y: best.ty, label: 'Drop party', id: 'party' } : null;
  });

  // ---------- every frame ----------
  HOOKS.update.push(dt => {
    const now = nowMs(), map = mapNow();
    // a new map: its crackers come from the server; the old map's unlit ones are not ours to show any more
    if (map !== S.map) { if (S.map !== null) dropUnlit(map); S.map = map; }
    for (const p of [...S.parties.values()]) {
      if (!p.ended && now > p.until) endParty(p);
      for (const c of [...p.crackers.values()]) if (c.lit) { c.lit.el += dt * 1000; if (c.lit.el >= c.lit.fuse) bang(p, c); }
    }
    if (S.pops.length) { for (const f of S.pops) f.t += dt; S.pops = S.pops.filter(f => f.t < f.dur); }
    if (S.notes.length && time >= S.noteUntil) nextNote();
    if (S.waiting.length && (S.waitT -= dt) <= 0) { S.waitT = 0.25; checkWaiting(); }
    if (S.lastLight.size > 60) for (const [id, at] of S.lastLight) if (now - at > 5000) S.lastLight.delete(id);
    if (S.banner && now - S.banner.at > BANNER_MS) S.banner = null;
  });

  // ---------- drawing: a festive paper cracker that bobs and glints; a burning fuse; the prize popping out ----------
  const BODY = ['#e5484d', '#3e8ef7', '#3fb950', '#f5a623', '#a371f7', '#ef6fb1'];
  const TRIM = ['#f5c542', '#ffffff', '#ffe9a8'];
  function drawCracker(g, c, x, y, hint) {
    const k = c.k || 0, body = BODY[k % BODY.length], trim = TRIM[k % TRIM.length];
    const L = c.lit, p = L ? clamp(L.el / Math.max(1, L.fuse), 0, 1) : 0;
    const bob = L ? 0 : Math.sin(time * 2.4 + k * 1.3) * 1.6;
    const shake = L ? Math.sin(time * 47 + k) * (0.5 + p * 2) : 0;
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, 9, 15, 3.8, 0, 0, 7); g.fill();
    g.translate(shake, bob - 2); g.rotate(((k % 5) - 2) * 0.09);
    // the twisted paper ends
    g.fillStyle = body; g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-9, 0); g.lineTo(-17.5, -7); g.lineTo(-15, 0); g.lineTo(-17.5, 7); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(9, 0); g.lineTo(17.5, -7); g.lineTo(15, 0); g.lineTo(17.5, 7); g.closePath(); g.fill(); g.stroke();
    // where the ends are pinched and tied
    g.fillStyle = trim; g.fillRect(-10.8, -3, 2.6, 6); g.fillRect(8.2, -3, 2.6, 6);
    // the tube, with a zigzag band round its middle
    g.fillStyle = body; roundRect(g, -8.5, -5.8, 17, 11.6, 3.5); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.45)'; g.stroke();
    g.strokeStyle = trim; g.lineWidth = 1.7; g.beginPath(); g.moveTo(-6.2, -4.2); g.lineTo(-3.1, 4.2); g.lineTo(0, -4.2); g.lineTo(3.1, 4.2); g.lineTo(6.2, -4.2); g.stroke();
    // a shine along the top, and a glint that runs along it every few seconds
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-7, -4.8, 14, 1.4);
    const gl = (time * 0.9 + k * 0.61) % 2.6;
    if (gl < 0.45 && !L) {
      const gx = -7 + (gl / 0.45) * 14;
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath(); g.moveTo(gx, -8.4); g.lineTo(gx + 1.2, -5.4); g.lineTo(gx + 4, -4.6); g.lineTo(gx + 1.2, -3.8); g.lineTo(gx, -0.8); g.lineTo(gx - 1.2, -3.8); g.lineTo(gx - 4, -4.6); g.lineTo(gx - 1.2, -5.4); g.closePath(); g.fill();
    }
    // lit: the fuse burns down from the right-hand end, spitting sparks
    if (L) {
      const fx = lerp(23, 16.5, p), fy = lerp(-8, -2.5, p);
      g.strokeStyle = '#5a4a3a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(16, -2); g.lineTo(fx, fy); g.stroke();
      const fl = 2.3 + Math.sin(time * 50) * 0.8;
      g.fillStyle = 'rgba(255,170,40,0.45)'; g.beginPath(); g.arc(fx, fy, fl + 3.2, 0, 7); g.fill();
      g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(fx, fy, fl, 0, 7); g.fill();
      for (let s = 0; s < 4; s++) { const a = time * 21 + s * 1.7 + k; g.fillStyle = s % 2 ? '#ffd166' : '#ff8c42'; g.fillRect(fx + Math.cos(a) * 5.5, fy + Math.sin(a) * 5.5, 1.8, 1.8); }
    }
    g.restore();
    if (hint && !L) {
      g.strokeStyle = 'rgba(255,233,168,0.8)'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.arc(x, y, 23, 0, 7); g.stroke(); g.setLineDash([]);
      const t = keyName('E') + ' to light';
      g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(t, x, y - 20); g.fillStyle = '#ffe9a8'; g.fillText(t, x, y - 20);
    }
  }
  function drawPop(g, f) {
    const a = f.t < 0.12 ? f.t / 0.12 : f.t > f.dur - 0.5 ? Math.max(0, (f.dur - f.t) / 0.5) : 1;
    const rise = Math.min(1, f.t / 0.55), s = f.big ? 34 : 22, yy = f.y - 14 - rise * (f.big ? 36 : 26);
    g.save();
    if (f.t < 0.35) {
      g.globalAlpha = 1 - f.t / 0.35; g.strokeStyle = f.big ? '#f5c542' : '#ffffff'; g.lineWidth = 3;
      g.beginPath(); g.arc(f.x, f.y - 4, 10 + f.t / 0.35 * (f.big ? 64 : 38), 0, 7); g.stroke();
    }
    g.globalAlpha = a;
    if (f.big) {
      const r = s * 0.95 + Math.sin(f.t * 7) * 2.5;
      g.fillStyle = 'rgba(245,197,66,0.22)'; g.beginPath(); g.arc(f.x, yy, r, 0, 7); g.fill();
      g.strokeStyle = 'rgba(245,197,66,0.85)'; g.lineWidth = 2.5; g.beginPath(); g.arc(f.x, yy, r, 0, 7); g.stroke();
      for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4 + f.t * 1.5; g.beginPath(); g.moveTo(f.x + Math.cos(an) * (r + 3), yy + Math.sin(an) * (r + 3)); g.lineTo(f.x + Math.cos(an) * (r + 9), yy + Math.sin(an) * (r + 9)); g.stroke(); }
    }
    if (f.id && ITEMS[f.id]) drawItemIcon(g, f.id, f.x, yy, s);
    g.restore();
  }
  HOOKS.draw.push((g, items) => {
    if (!S.parties.size && !S.pops.length) return;
    const map = mapNow();
    let hint = null;
    if (S.parties.size) { const f = frontTile(player); hint = lightable(f.tx, f.ty); }
    for (const p of S.parties.values()) {
      if (p.map !== map) continue;
      for (const c of p.crackers.values()) {
        if (c.tx === null) continue;
        const x = tc(c.tx), y = tc(c.ty);
        if (x < cam.x - 60 || x > cam.x + VW + 60 || y < cam.y - 60 || y > cam.y + VH + 60) continue;
        items.push({ y: y + 8, cracker: c.id, draw: () => drawCracker(g, c, x, y, c === hint) });
      }
    }
    for (const f of S.pops) items.push({ y: 1e8, pop: true, draw: () => drawPop(g, f) });
  });

  // ---------- the gold banner across the top ----------
  // Placed below every button, box, map and the notice line already at the top of the screen, so it never covers
  // one; on a phone whose top-right corner is busy it sits left of the minimap, in two lines if it must.
  function bannerRect(g, text) {
    const L = HUD_LAYOUT, blocks = buttons.slice();
    if (minimapRect) blocks.push(minimapRect);
    blocks.push({ x: 14, y: 14, w: 250, h: 62 });
    if (L.questH) blocks.push({ x: L.questX, y: L.questY, w: L.questW, h: L.questH });
    { const mm = minimapRect ? minimapRect.w : 150, nw = L.short ? Math.min(520, VW - 274 - mm - 24) : Math.min(VW - 20, 520); blocks.push({ x: L.short ? 274 : VW / 2 - nw / 2, y: L.noticeY, w: nw, h: 32 }); }
    const slide = (x, w, h, maxY) => { let y = 46; for (let i = 0; i < 99 && y <= maxY; i++) { const hit = blocks.find(b => x < b.x + b.w && b.x < x + w && y < b.y + b.h && b.y < y + h); if (!hit) return y; y = Math.max(y + 2, hit.y + hit.h + 6); } return null; };
    // one line, centred
    let size = 15; g.font = `bold ${size}px sans-serif`;
    const maxW = Math.min(VW - 28, 640);
    while (size > 12 && g.measureText(text).width + 40 > maxW) { size--; g.font = `bold ${size}px sans-serif`; }
    let t = text; while (g.measureText(t).width + 40 > maxW && t.length > 8) t = t.slice(0, -2) + '…';
    const w1 = Math.min(maxW, Math.ceil(g.measureText(t).width) + 40);
    const one = { x: Math.round(VW / 2 - w1 / 2), w: w1, h: 34, lines: [t], font: g.font };
    // two lines at most, left of the minimap (a phone's top-right corner is busy)
    const right = (minimapRect ? minimapRect.x : VW - 14) - 8, room = Math.max(120, right - 14);
    g.font = 'bold 13px sans-serif';
    const words = text.split(' '), lines = []; let line = '';
    for (const wd of words) { const test = line ? line + ' ' + wd : wd; if (g.measureText(test).width > room - 24 && line) { lines.push(line); line = wd; } else line = test; }
    if (line) lines.push(line);
    const two = lines.slice(0, 2); if (lines.length > 2) two[1] = two[1] + '…';
    const w2 = Math.min(room, Math.ceil(Math.max(...two.map(l => g.measureText(l).width))) + 40);
    const left = { x: 14, w: w2, h: 16 + two.length * 17, lines: two, font: g.font };
    for (const [c, maxY] of [[one, Math.min(170, VH * 0.26)], [left, VH * 0.45], [one, VH * 0.62], [left, VH * 0.62]]) { const y = slide(c.x, c.w, c.h, maxY); if (y !== null) return Object.assign({ y }, c); }
    return Object.assign({ y: 46 }, one);
  }
  HOOKS.hud.push(g => {
    const b = S.banner; if (!b) { S.bannerRect = null; return; }
    const el = nowMs() - b.at; if (el > BANNER_MS) { S.banner = null; S.bannerRect = null; return; }
    const a = el < 250 ? el / 250 : el > BANNER_MS - 600 ? (BANNER_MS - el) / 600 : 1;
    const r = bannerRect(g, b.text); S.bannerRect = r;
    g.save(); g.globalAlpha = clamp(a, 0, 1);
    roundRect(g, r.x, r.y, r.w, r.h, 10); g.fillStyle = 'rgba(10,14,22,0.93)'; g.fill(); g.strokeStyle = '#f5c542'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#f5c542'; g.font = r.font; g.textAlign = 'center';
    r.lines.forEach((l, i) => g.fillText(l, r.x + r.w / 2, r.y + (r.lines.length === 1 ? 22 : 21 + i * 17)));
    g.restore();
  });

  // ---------- choosing the ground (the admin's client; the server only checks range and shape) ----------
  // Plain ground a knight can stand on: never a tile the E key or a feature already uses (planks, soil, crops,
  // traps, lodestones, beds, doors, stations...), never water, never solid for a person, never a goblin's grave,
  // never inside a house the knight is not in, never under a cracker that is already there.
  const GROUND_NAMES = ['GRASS', 'DIRT', 'SAND', 'COBBLE', 'FLOOR', 'CAVE', 'SCORCH', 'ASH', 'CLOUD'];
  let GROUND = null;
  const ground = () => GROUND || (GROUND = new Set(GROUND_NAMES.filter(n => n in T).map(n => T[n]).filter(t => t !== T.WATER && !SOLID.has(t) && !PUSH_THROUGH.has(t) && !INTERESTING_TILES.has(t))));
  function candidates(scatter, from) {
    const px = from ? from.x : player.x, py = from ? from.y : player.y;
    const ktx = Math.floor(px / TILE), kty = Math.floor(py / TILE), r = Math.floor(scatter), home = insideBuilding(ktx, kty);
    const taken = new Set(); for (const p of S.parties.values()) for (const c of p.crackers.values()) if (c.tx !== null) taken.add(c.tx + ',' + c.ty);
    const G = ground(), out = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (!dx && !dy) continue;
      if (dx * dx + dy * dy > r * r) continue;
      const tx = ktx + dx, ty = kty + dy;
      if (!inMap(tx, ty) || !G.has(tileAt(tx, ty))) continue;
      // the server measures its 11 tiles from the knight; stay inside them however it rounds (corner or centre)
      if (Math.hypot(tx - px / TILE, ty - py / TILE) > SERVER_REACH - 0.1 || Math.hypot(tx + 0.5 - px / TILE, ty + 0.5 - py / TILE) > SERVER_REACH - 0.1) continue;
      if (collides(tc(tx), tc(ty), 13, 'person')) continue;
      if (insideBuilding(tx, ty) !== home) continue;
      if (window.GRAVES && typeof GRAVES.markerAt === 'function' && GRAVES.markerAt(tx, ty)) continue;
      if (taken.has(tx + ',' + ty)) continue;
      out.push([tx, ty]);
    }
    return out;
  }
  // count distinct free tiles within `scatter` tiles (a straight line) of the knight, at random; under 5 free: null
  function pickSpots(count, scatter, from) {
    const n = clamp(Math.floor(+count || 0), COUNT_MIN, COUNT_MAX), s = clamp(Math.floor(+scatter || 0), SCATTER_MIN, SCATTER_MAX);
    const all = candidates(s, from);
    if (all.length < COUNT_MIN) return null;
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = all[i]; all[i] = all[j]; all[j] = t; }
    return all.slice(0, Math.min(n, all.length));
  }

  // ---------- the prize table ----------
  const PRESETS = [
    { key: 'coins', name: 'Coins', rows: [['coins', 25, 250, 40]] },
    { key: 'food', name: 'Food', rows: [['bread', 1, 5, 20], ['meat_pie', 1, 3, 15], ['trout', 2, 5, 15], ['shark', 1, 2, 5]] },
    { key: 'ores', name: 'Ores and bars', rows: [['iron_ore', 5, 20, 15], ['coal', 5, 20, 15], ['iron_bar', 2, 8, 12], ['steel_bar', 1, 5, 8], ['mithril_bar', 1, 3, 4]] },
    { key: 'weapons', name: 'Rare weapons', rows: [['steel_sword', 1, 1, 6], ['iron_battleaxe', 1, 1, 6], ['mithril_sword', 1, 1, 3], ['dragon_spear', 1, 1, 1]] },
  ];
  // only ids this game has; a preset with none left is not offered
  for (const p of PRESETS) p.rows = p.rows.filter(r => ITEMS[r[0]] && !isHat(r[0])).map(([id, min, max, w]) => ({ id, min, max, w }));
  for (let i = PRESETS.length - 1; i >= 0; i--) if (!PRESETS[i].rows.length) PRESETS.splice(i, 1);
  const qtyCap = id => (ITEMS[id] && ITEMS[id].stack === 1) ? GEAR_MAX : QTY_MAX;
  const LADDER = [1, 2, 3, 4, 5, 10, 15, 20, 25, 50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 5000, 7500, 10000, 15000, 20000, 25000, 50000, 75000, 100000];
  const W_LADDER = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200, 300, 400, 500, 750, 1000];
  const up = (v, ladder, max) => { for (const s of ladder) if (s > v) return Math.min(s, max); return max; };
  const down = (v, ladder, min) => { for (let i = ladder.length - 1; i >= 0; i--) if (ladder[i] < v) return Math.max(ladder[i], min); return min; };
  function cleanTable(table) {
    const out = [];
    for (const r of Array.isArray(table) ? table : []) {
      if (!r || typeof r.id !== 'string' || !ITEM_RE.test(r.id) || !ITEMS[r.id] || isHat(r.id)) continue;
      const cap = qtyCap(r.id);
      const min = clamp(Math.floor(+r.min || 1), 1, cap), max = clamp(Math.floor(+r.max || min), min, cap), w = clamp(Math.floor(+r.w || 1), 1, W_MAX);
      out.push({ id: r.id, min, max, w });
      if (out.length >= ROWS_MAX) break;
    }
    return out;
  }
  const hatWords = n => '1 in ' + fmt(n);
  // a percent in plain digits, four figures at most, exact enough to tell 1 in 1,000 from nothing: 39.96, 0.999, 0.1, 36
  const pctText = v => { if (v >= 100) return '100'; const s = v.toPrecision(4); return s.indexOf('.') >= 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s; };
  const rowName = r => { const def = ITEMS[r.id]; const name = def ? def.name : r.id; return r.min === r.max ? (r.min === 1 ? name : name + ' × ' + fmt(r.min)) : name + ' ' + fmt(r.min) + ' to ' + fmt(r.max); };
  // each row's chance of being the prize, after the party hat has had its roll (the server rolls the hat first)
  function odds(table, hat) {
    const t = cleanTable(table), tot = t.reduce((s, r) => s + r.w, 0) || 1, keep = 1 - 1 / hat;
    return t.map(r => ({ row: r, pct: keep * r.w / tot * 100 }));
  }
  function oddsLines(table, hat) {
    const lines = odds(table, hat).map(o => rowName(o.row) + ': ' + pctText(o.pct) + '%');
    lines.push('Party hat: ' + hatWords(hat) + ' (' + pctText(100 / hat) + '%)');
    return lines;
  }

  // ---------- throwing it ----------
  const UI = { tab: 'party', count: 20, scatter: 5, hat: 1000, table: [], sel: 0, rowPage: 0, addPage: 0, search: '' };
  const defaultTable = () => { const p = PRESETS.find(q => q.key === 'coins'); return p ? p.rows.map(r => ({ ...r })) : []; };
  UI.table = defaultTable();
  function throwParty(opts) {
    const o = Object.assign({ count: UI.count, scatter: UI.scatter, hat: UI.hat, table: UI.table }, opts || {});
    if (!isAdmin()) { note('Only an admin can throw a drop party.'); return null; }
    const table = cleanTable(o.table);
    if (!table.length) { note('Add a prize first.'); return null; }
    const hat = HAT_CHOICES.includes(o.hat) ? o.hat : 1000;
    if (nowMs() - S.lastThrow < THROW_EVERY) { note('One party at a time. Wait a moment.'); return null; }
    const spots = pickSpots(o.count, o.scatter);
    if (!spots) { note('There is not enough open ground here. Try somewhere more open.'); return null; }
    const msg = { t: 'party', x: Math.round(player.x), y: Math.round(player.y), spots, table, hat };
    if (!NET.send(msg)) { note('That did not go through. Try again.'); return null; }
    S.lastThrow = nowMs();
    note('Your party is on its way.'); sfx('open');
    return msg;
  }
  // my own live parties on this map, for the panel's status line
  function mine() {
    const map = mapNow(), meN = meName(), now = nowMs(); let left = 0, until = 0;
    if (!meN) return null;
    for (const p of S.parties.values()) {
      if (p.map !== map || p.by !== meN || p.ended) continue;
      let n = 0; for (const c of p.crackers.values()) if (!c.lit) n++;
      if (!n) continue;
      left += n; until = Math.max(until, p.until);
    }
    return left ? { left, ms: Math.max(0, until - now) } : null;
  }
  const timeWords = ms => { const s = Math.ceil(ms / 1000); if (s >= 60) { const m = Math.ceil(s / 60); return m + (m === 1 ? ' minute' : ' minutes'); } return s + (s === 1 ? ' second' : ' seconds'); };

  // ---------- the search box for "any item": one real input, so the iPad keyboard works ----------
  // Built on first use and only where there is a document body (tools/headless.js has none). Shown only while the
  // Add tab draws; a watchdog hides it within a quarter second of the panel going away, whatever took it away.
  let dom = null;
  function searchDom() {
    if (dom !== null) return dom;
    if (typeof document === 'undefined' || !document.body || typeof document.body.appendChild !== 'function' || typeof document.createElement !== 'function') { dom = false; return dom; }
    try {
      const input = document.createElement('input');
      input.type = 'text'; input.id = 'fl-party-search'; input.maxLength = 30; input.autocomplete = 'off'; input.spellcheck = false;
      input.setAttribute('autocapitalize', 'none'); input.setAttribute('autocorrect', 'off'); input.setAttribute('enterkeyhint', 'search'); input.setAttribute('aria-label', 'Find an item');
      input.placeholder = 'Any item: type to find it';
      input.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:40px;display:none;z-index:15;box-sizing:border-box;margin:0;font:16px "Trebuchet MS","Segoe UI",system-ui,sans-serif;color:#e6edf3;background:#0b0f14;border:1px solid #58a6ff;border-radius:8px;padding:6px 10px;outline:none;-webkit-appearance:none;appearance:none;';
      input.addEventListener('input', () => { UI.search = String(input.value || '').slice(0, 30); UI.addPage = 0; });
      document.body.appendChild(input);
      dom = { input, shown: false, rect: '', until: 0, timer: null };
    } catch (e) { dom = false; }
    return dom;
  }
  function hideSearch() {
    const d = dom; if (!d || !d.shown) return;
    d.shown = false; d.input.style.display = 'none';
    try { if (document.activeElement === d.input) d.input.blur(); } catch (e) { }
  }
  function watch() { const d = dom; if (!d) return; d.timer = null; if (!d.shown) return; if (nowMs() > d.until) { hideSearch(); return; } d.timer = setTimeout(watch, 200); }
  function placeSearch(x, y, w, h) {
    const d = searchDom(); if (!d) return false;
    const key = [x, y, w, h].map(Math.round).join(',');
    if (d.rect !== key) { d.rect = key; const s = d.input.style; s.left = Math.round(x) + 'px'; s.top = Math.round(y) + 'px'; s.width = Math.round(w) + 'px'; s.height = Math.round(h) + 'px'; }
    d.until = nowMs() + 250;
    if (!d.shown) {
      d.shown = true; d.input.value = UI.search; d.input.style.display = 'block';
      if (!touchMode()) { try { d.input.focus(); } catch (e) { } }
    }
    if (!d.timer) d.timer = setTimeout(watch, 200);
    return true;
  }
  HOOKS.hud.push(() => { if (dom && dom.shown && (paused || panel !== 'party' || UI.tab !== 'add' || !isAdmin())) hideSearch(); });
  let ALL = null;
  const allItems = () => ALL || (ALL = Object.keys(ITEMS).filter(id => ITEMS[id] && ITEMS[id].name && !isHat(id)).sort((a, b) => ITEMS[a].name.localeCompare(ITEMS[b].name)));
  function found() { const q = UI.search.trim().toLowerCase(); const all = allItems(); return q ? all.filter(id => ITEMS[id].name.toLowerCase().indexOf(q) >= 0 || id.indexOf(q.replace(/ /g, '_')) >= 0) : all; }
  function addRow(id) {
    if (!ITEMS[id] || isHat(id)) return false;
    const i = UI.table.findIndex(r => r.id === id);
    if (i >= 0) { UI.sel = i; note(ITEMS[id].name + ' is on the table already.'); return false; }
    if (UI.table.length >= ROWS_MAX) { note('The table holds 20 prizes. Take one out first.'); return false; }
    const gear = qtyCap(id) === GEAR_MAX;
    UI.table.push({ id, min: 1, max: gear ? 1 : 10, w: 10 });
    UI.sel = UI.table.length - 1;
    note(ITEMS[id].name + ' is on the table.');
    return true;
  }
  function addPreset(key) {
    const p = PRESETS.find(q => q.key === key); if (!p) return 0;
    let n = 0, first = -1;
    for (const r of p.rows) {
      if (UI.table.some(x => x.id === r.id) || !ITEMS[r.id]) continue;
      if (UI.table.length >= ROWS_MAX) { note('The table holds 20 prizes. Take one out first.'); break; }
      UI.table.push({ ...r }); n++; if (first < 0) first = UI.table.length - 1;
    }
    if (first >= 0) UI.sel = first;
    note(n ? p.name + ' added: ' + n + (n === 1 ? ' prize.' : ' prizes.') : 'Those are on the table already.');
    return n;
  }

  // ---------- the panel ----------
  // Three tabs. Party: how many crackers, how far they spread, the party hat chance, the odds, Throw (and, while a
  // party of yours is live here, what is left of it and End the party). Prizes: the table with each row's exact
  // chance; tap a row to change its amounts or weight, or take it out. Add prizes: four presets, and any item by
  // name. Buttons are 44 px tall on touch and never overlap; a wide screen gets two columns.
  function btn(g, x, y, w, h, text, key, action, color = '#21262d', enabled = true) {
    button(g, x, y, w, h, text, action, color, enabled);
    const b = buttons[buttons.length - 1]; b.label = (b.disabled ? 'disabled:' : '') + key; b.party = true;
    return b;
  }
  const hitRow = (x, y, w, h, key, action) => { buttons.push({ x, y, w, h, label: key, action, party: true }); };
  function label(g, text, x, y, color = '#e6edf3', font = 'bold 13px sans-serif', align = 'left') { g.font = font; g.fillStyle = color; g.textAlign = align; g.fillText(text, x, y); }
  function fitText(g, text, maxW) { let t = String(text); while (g.measureText(t).width > maxW && t.length > 4) t = t.slice(0, -2) + '…'; return t; }
  function pagerRow(g, x, y, w, BH, page, pages, set, key) {
    btn(g, x, y, 80, BH, 'Prev', key + 'prev|', () => set(page - 1), '#21262d', page > 0);
    label(g, (page + 1) + ' / ' + pages, x + w / 2, y + BH / 2 + 5, '#8b949e', '12px sans-serif', 'center');
    btn(g, x + w - 80, y, 80, BH, 'Next', key + 'next|', () => set(page + 1), '#21262d', page < pages - 1);
  }
  // [text, key, action, enabled] buttons in a row
  function stepper(g, x, y, BH, bw, items, key) {
    let xx = x;
    for (const [text, k, fn, on] of items) { btn(g, xx, y, bw, BH, text, key + k + '|', fn, '#21262d', on !== false); xx += bw + 6; }
  }

  HOOKS.panel.party = (g, narrow) => {
    const BH = touchMode() ? 44 : 34, G = 8;
    if (!isAdmin()) {
      hideSearch();
      const { px, py, h } = panelBox(g, 420, 160, 'Drop party', netOn() ? 'Crackers, a bang, and a prize for whoever lights one.' : 'You are not connected.');
      label(g, 'Only an admin can throw a drop party.', px + 18, py + 84, '#c9d1d9', '13px sans-serif');
      btn(g, px + 18, py + h - BH - 14, 120, BH, 'Close', 'party:close|', closePanel);
      return;
    }
    const wide = VW >= 640;
    const W = wide ? Math.min(VW - 20, 760) : Math.min(VW - 20, 440);
    const H = Math.min(VH - 20, UI.tab === 'party' ? (wide ? 390 : 610) : (wide ? 480 : 770));
    const { px, py, w, h } = panelBox(g, W, H, 'Drop party', narrow ? 'Crackers fall around you.' : 'Crackers fall on the ground around you. Anyone can light one for a prize.');
    const x0 = px + 18, cw = w - 36, top = py + 58, bottom = py + h - 12;
    const tabs = [['party', 'Party'], ['prizes', 'Prizes (' + UI.table.length + ')'], ['add', 'Add prizes']];
    const tw = Math.min(150, Math.floor((cw - 2 * 6) / 3));
    tabs.forEach(([k, t], i) => btn(g, x0 + i * (tw + 6), top, tw, BH, t, 'party:tab:' + k + '|', () => { UI.tab = k; if (k !== 'add') hideSearch(); }, UI.tab === k ? '#238636' : '#21262d'));
    const y0 = top + BH + 12;
    if (UI.tab !== 'add') hideSearch();
    if (UI.tab === 'party') drawPartyTab(g, x0, y0, cw, bottom, BH, G, wide);
    else if (UI.tab === 'prizes') drawPrizesTab(g, x0, y0, cw, bottom, BH, G, wide);
    else drawAddTab(g, x0, y0, cw, bottom, BH, G, wide);
  };

  function drawPartyTab(g, x0, y0, cw, bottom, BH, G, wide) {
    const colW = wide ? Math.floor((cw - 24) / 2) : cw, bw = BH === 44 ? 48 : 44;
    let y = y0;
    // how many crackers
    label(g, 'Crackers', x0, y + BH / 2 - 3, '#8b949e', 'bold 12px sans-serif');
    label(g, String(UI.count), x0, y + BH / 2 + 14, '#f5c542', 'bold 16px sans-serif');
    const cnt = v => () => { UI.count = clamp(UI.count + v, COUNT_MIN, COUNT_MAX); };
    stepper(g, x0 + colW - (4 * bw + 18), y, BH, bw, [['−5', '-5', cnt(-5), UI.count > COUNT_MIN], ['−1', '-1', cnt(-1), UI.count > COUNT_MIN], ['+1', '+1', cnt(1), UI.count < COUNT_MAX], ['+5', '+5', cnt(5), UI.count < COUNT_MAX]], 'party:count:');
    y += BH + G;
    // how far they spread
    label(g, 'How far they spread', x0, y + BH / 2 - 3, '#8b949e', 'bold 12px sans-serif');
    label(g, UI.scatter + ' tiles', x0, y + BH / 2 + 14, '#f5c542', 'bold 16px sans-serif');
    const spr = v => () => { UI.scatter = clamp(UI.scatter + v, SCATTER_MIN, SCATTER_MAX); };
    stepper(g, x0 + colW - (2 * bw + 6), y, BH, bw, [['−1', '-1', spr(-1), UI.scatter > SCATTER_MIN], ['+1', '+1', spr(1), UI.scatter < SCATTER_MAX]], 'party:spread:');
    y += BH + G;
    // the party hat chance: four choices, the chosen one gold
    label(g, 'Party hat chance', x0, y + 13, '#8b949e', 'bold 12px sans-serif');
    y += 20;
    const hw = Math.floor((colW - 3 * 6) / 4);
    HAT_CHOICES.forEach((n, i) => btn(g, x0 + i * (hw + 6), y, hw, BH, hatWords(n), 'party:hat:' + n + '|', () => { UI.hat = n; }, UI.hat === n ? '#9e6a03' : '#21262d'));
    y += BH + G;
    // Throw: under the controls on a wide screen, at the bottom on a narrow one
    const live = mine(), table = cleanTable(UI.table), canThrow = table.length > 0;
    const throwY = wide ? y + 6 : bottom - BH;
    btn(g, x0, throwY, colW, BH, 'Throw the party!', 'party:throw|', () => { if (throwParty()) closePanel(); }, '#238636', canThrow);
    if (!canThrow) label(g, 'Put a prize on the table first (Add prizes).', x0, wide ? throwY + BH + 18 : throwY - 8, '#f0883e', '12px sans-serif');
    // the odds, always shown: each row's chance and the party hat's
    const ox = wide ? x0 + colW + 24 : x0;
    let oy = wide ? y0 : y + 2;
    const statusH = live ? 22 + BH + 6 : 0;
    const oddsBottom = wide ? bottom - statusH : throwY - (canThrow ? 8 : 26) - statusH;
    label(g, 'Each cracker gives', ox, oy + 12, '#8b949e', 'bold 12px sans-serif');
    oy += 20;
    const lines = oddsLines(table, UI.hat), lh = 17, room = Math.max(2, Math.floor((oddsBottom - oy) / lh));
    const shown = lines.length <= room ? lines : lines.slice(0, room - 2).concat(['and ' + (lines.length - 1 - (room - 2)) + ' more on the Prizes tab', lines[lines.length - 1]]);
    shown.forEach((l, i) => {
      const hatLine = i === shown.length - 1, more = /^and \d+ more/.test(l);
      g.font = hatLine ? 'bold 12px sans-serif' : '12px sans-serif';
      label(g, fitText(g, l, colW), ox, oy + 12 + i * lh, hatLine ? '#f5c542' : more ? '#8b949e' : '#c9d1d9', g.font);
    });
    if (live) {
      const sy = wide ? bottom - BH - 22 : throwY - statusH - 2;
      label(g, live.left + (live.left === 1 ? ' cracker' : ' crackers') + ' left, ' + timeWords(live.ms) + ' to go', ox, sy + 15, '#7ec8ff', 'bold 13px sans-serif');
      const arm = confirmActive('party:end');
      btn(g, ox, sy + 22, Math.min(colW, 220), BH, arm ? 'Tap again to end it' : 'End the party', 'party:end|', () => confirmTap('party:end', () => { if (NET.send({ t: 'party_end' })) note('Your party is over.'); }), arm ? '#c0392b' : '#8b2e2e');
    }
  }

  function drawPrizesTab(g, x0, y0, cw, bottom, BH, G, wide) {
    const colW = wide ? Math.floor((cw - 24) / 2) : cw, n = UI.table.length, rows = odds(UI.table, UI.hat);
    if (UI.sel >= n) UI.sel = n - 1;
    if (n && UI.sel < 0) UI.sel = 0;
    const edH = n ? 22 + 3 * (BH + 6) : 0, rowH = BH + 4;
    const hatY = wide ? bottom - 2 : bottom - edH - 10;
    const listBottom = hatY - 18;
    let per = Math.max(1, Math.floor((listBottom - y0 + 4) / rowH)), pages = Math.max(1, Math.ceil(n / per));
    if (pages > 1) { per = Math.max(1, Math.floor((listBottom - y0 + 4 - BH - 6) / rowH)); pages = Math.max(1, Math.ceil(n / per)); }
    if (UI.sel >= 0 && n) UI.rowPage = Math.floor(UI.sel / per);
    UI.rowPage = clamp(UI.rowPage, 0, pages - 1);
    let y = y0;
    if (!n) label(g, 'No prizes yet. Add some on the Add prizes tab.', x0, y + 18, '#8b949e', '13px sans-serif');
    const start = UI.rowPage * per;
    for (let i = start; i < Math.min(n, start + per); i++) {
      const r = UI.table[i], o = rows.find(q => q.row.id === r.id), on = i === UI.sel;
      roundRect(g, x0, y, colW, BH, 8); g.fillStyle = on ? 'rgba(88,166,255,0.16)' : 'rgba(255,255,255,0.05)'; g.fill();
      if (on) { g.strokeStyle = '#58a6ff'; g.lineWidth = 1.5; g.stroke(); }
      drawItemIcon(g, r.id, x0 + 20, y + BH / 2, BH === 44 ? 24 : 20);
      const pct = o ? pctText(o.pct) + '%' : '';
      g.font = 'bold 13px sans-serif'; const pw = g.measureText(pct).width;
      label(g, fitText(g, rowName(r), colW - 52 - pw - 16), x0 + 40, y + BH / 2 + 5);
      label(g, pct, x0 + colW - 12, y + BH / 2 + 5, '#f5c542', 'bold 13px sans-serif', 'right');
      const idx = i; hitRow(x0, y, colW, BH, 'party:row:' + r.id + '|', () => { UI.sel = idx; });
      y += rowH;
    }
    if (pages > 1) pagerRow(g, x0, listBottom - BH, colW, BH, UI.rowPage, pages, p => { UI.rowPage = clamp(p, 0, pages - 1); UI.sel = Math.min(n - 1, UI.rowPage * per); }, 'party:rows:');
    // the party hat's own line, always
    label(g, 'Party hat: ' + hatWords(UI.hat) + ' (' + pctText(100 / UI.hat) + '%), rolled first', x0, hatY, '#f5c542', 'bold 12px sans-serif');
    // the chosen row: from, to, weight, take it out
    if (!n || UI.sel < 0) return;
    const r = UI.table[UI.sel], cap = qtyCap(r.id), ex = wide ? x0 + colW + 24 : x0, ew = colW;
    let ey = wide ? y0 : hatY + 10;
    g.font = 'bold 14px sans-serif';
    label(g, fitText(g, ITEMS[r.id] ? ITEMS[r.id].name : r.id, ew), ex, ey + 14, '#e6edf3', 'bold 14px sans-serif');
    ey += 22;
    const bw = BH === 44 ? 48 : 44, vw = 70;
    const line = (name, value, dn, upFn, canDn, canUp, key) => {
      label(g, name, ex, ey + BH / 2 + 5, '#8b949e', 'bold 12px sans-serif');
      const bx = ex + 60;
      btn(g, bx, ey, bw, BH, '−', 'party:' + key + ':down|', dn, '#21262d', canDn);
      label(g, fmt(value), bx + bw + vw / 2, ey + BH / 2 + 6, '#f5c542', 'bold 15px sans-serif', 'center');
      btn(g, bx + bw + vw, ey, bw, BH, '+', 'party:' + key + ':up|', upFn, '#21262d', canUp);
      return bx + bw + vw + bw;
    };
    line('From', r.min, () => { r.min = down(r.min, LADDER, 1); }, () => { r.min = up(r.min, LADDER, cap); if (r.max < r.min) r.max = r.min; }, r.min > 1, r.min < cap, 'min');
    ey += BH + 6;
    line('To', r.max, () => { r.max = down(r.max, LADDER, 1); if (r.min > r.max) r.min = r.max; }, () => { r.max = up(r.max, LADDER, cap); }, r.max > 1, r.max < cap, 'max');
    ey += BH + 6;
    const end = line('Weight', r.w, () => { r.w = down(r.w, W_LADDER, 1); }, () => { r.w = up(r.w, W_LADDER, W_MAX); }, r.w > 1, r.w < W_MAX, 'w');
    const rw = Math.min(110, ex + ew - end - 10);
    btn(g, ex + ew - rw, ey, rw, BH, 'Take out', 'party:remove|', () => { UI.table.splice(UI.sel, 1); UI.sel = Math.min(UI.sel, UI.table.length - 1); }, '#8b2e2e');
  }

  function drawAddTab(g, x0, y0, cw, bottom, BH, G, wide) {
    let y = y0;
    // the four presets
    const across = wide ? 4 : 2, pw = Math.floor((cw - (across - 1) * 6) / across);
    PRESETS.forEach((p, i) => btn(g, x0 + (i % across) * (pw + 6), y + Math.floor(i / across) * (BH + 6), pw, BH, p.name, 'party:preset:' + p.key + '|', () => addPreset(p.key), '#1f4e78'));
    y += Math.ceil(PRESETS.length / across) * (BH + 6) + 4;
    // any item: the search box (a real input on a page; drawn text where there is no page), then the list
    const list = found(), pagerW = wide ? 2 * 80 + 64 : 0;
    const boxW = cw - (wide ? pagerW + 12 : 0), boxY = y;
    roundRect(g, x0, y, boxW, BH, 8); g.fillStyle = '#0b0f14'; g.fill(); g.strokeStyle = '#30363d'; g.lineWidth = 1; g.stroke();
    const real = !paused && placeSearch(x0, y, boxW, BH);
    if (!real) label(g, UI.search ? UI.search : 'Any item: type to find it', x0 + 12, y + BH / 2 + 5, UI.search ? '#e6edf3' : '#6e7681', '14px sans-serif');
    y += BH + 8;
    const cols = wide ? 2 : 1, colW = Math.floor((cw - (cols - 1) * 8) / cols), rowH = BH + 4;
    const listBottom = wide ? bottom : bottom - BH - 8;
    const per = Math.max(cols, Math.floor((listBottom - y + 4) / rowH) * cols), pages = Math.max(1, Math.ceil(list.length / per));
    UI.addPage = clamp(UI.addPage, 0, pages - 1);
    const page = list.slice(UI.addPage * per, UI.addPage * per + per);
    if (!page.length) label(g, 'No item by that name.', x0, y + 18, '#8b949e', '13px sans-serif');
    page.forEach((id, i) => {
      const cx = x0 + (i % cols) * (colW + 8), cy = y + Math.floor(i / cols) * rowH, on = UI.table.some(r => r.id === id);
      roundRect(g, cx, cy, colW, BH, 8); g.fillStyle = on ? 'rgba(63,185,80,0.14)' : 'rgba(255,255,255,0.05)'; g.fill();
      drawItemIcon(g, id, cx + 20, cy + BH / 2, BH === 44 ? 24 : 20);
      g.font = 'bold 13px sans-serif';
      label(g, fitText(g, ITEMS[id].name, colW - 120), cx + 40, cy + BH / 2 + 5);
      label(g, on ? 'on the table' : 'tap to add', cx + colW - 10, cy + BH / 2 + 5, on ? '#3fb950' : '#6e7681', '11px sans-serif', 'right');
      hitRow(cx, cy, colW, BH, 'party:add:' + id + '|', () => addRow(id));
    });
    // Prev / Next: beside the box on a wide screen, under the list on a narrow one
    const set = p => { UI.addPage = clamp(p, 0, pages - 1); };
    if (wide) pagerRow(g, x0 + cw - pagerW, boxY, pagerW, BH, UI.addPage, pages, set, 'party:find:');
    else pagerRow(g, x0, bottom - BH, cw, BH, UI.addPage, pages, set, 'party:find:');
  }

  // ---------- the register ----------
  window.PARTY = {
    parties: S.parties, HATS, COLOURS, HEX, PRESETS, UI, S,
    live() { const map = mapNow(), out = []; for (const p of S.parties.values()) if (p.map === map) for (const c of p.crackers.values()) if (!c.lit && c.tx !== null) out.push({ id: c.id, pid: p.pid, k: c.k, tx: c.tx, ty: c.ty, x: tc(c.tx), y: tc(c.ty) }); return out.sort((a, b) => a.pid - b.pid || a.k - b.k || (a.id < b.id ? -1 : 1)); },
    light, grant, isHat, pickSpots, throwParty, oddsLines, odds, cleanTable, mine, lightable, isAdmin,
    search(text) { UI.search = String(text || '').slice(0, 30); UI.addPage = 0; return found(); },
    open() { UI.tab = 'party'; openPanel('party'); return true; },
  };

  // ---------- self-test ----------
  const P = 'party: ';
  HOOKS.selfTest.push((check, F, h) => {
    if (typeof NET === 'undefined') return;
    const LG = window.LOGIN, CH = window.CHAT;
    const was = {
      enabled: NET.enabled, token: NET.token, fake: NET.fake, touch: window.__forceTouch, peace: window.__peace, playing: LG ? LG.playing : undefined,
      inv: player.inv.map(s => s ? { ...s } : null), bank: player.bank.map(s => ({ ...s })), equip: { ...player.equip },
      x: player.x, y: player.y, facing: { ...player.facing }, hp: player.hp, dead: player.dead, deadT: player.deadT, deaths: player.deaths, mech: player.mech, r: player.r,
      deathKeep, party: player.party, notice, levelBanner, dc: dialog.cur, dq: dialog.queue.slice(), drops: drops.slice(), iw: window.innerWidth, ih: window.innerHeight,
      ui: JSON.parse(JSON.stringify(UI)), sys: CH ? CH.system : undefined, ownSys: !!(CH && Object.prototype.hasOwnProperty.call(CH, 'system')),
    };
    let role = 'admin', sock = null, putsDown = false;
    const puts = [];
    const fake = {
      call(method, path, body) { if (method === 'PUT' && path === '/api/save') { if (putsDown) throw Object.assign(new Error('down'), { status: 0 }); puts.push(body); return { at: 1 }; } return {}; },
      open: () => { const s = { readyState: 1, sent: [], send(str) { const m = JSON.parse(str); s.sent.push(m); if (m.t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'MudGoll', at: 1, keeper: 'MudGoll', role }) }); }, close() { s.readyState = 3; if (s.onclose) s.onclose(); } }; sock = s; return s; },
    };
    const feed = m => sock.onmessage({ data: JSON.stringify(m) });
    const sent = t => sock.sent.filter(m => m.t === t);
    const quiet = () => { S.notes.length = 0; S.noteUntil = -1e9; notice = null; };
    const said = text => (!!notice && notice.text === text) || S.notes.includes(text);
    const reset = () => { S.parties.clear(); S.banged.clear(); S.bangOrder.length = 0; S.pops.length = 0; S.banner = null; S.lastLight.clear(); S.lastThrow = -1e9; S.waiting.length = 0; quiet(); };
    const empty = () => new Array(INV_SLOTS).fill(null);
    const pickMine = () => buttons.filter(b => b.party);
    const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const setSize = (w, hh) => { try { window.innerWidth = w; window.innerHeight = hh; } catch (e) { } render(); return VW === w && VH === hh; };
    try {
      if (typeof title !== 'undefined' && title.active) title.startSlot(title.slot);
      if (LG) LG.playing = false;
      NET.disconnect(); NET.enabled = true; NET.token = 'party-test'; NET.useFake(fake); NET.connect();
      reset(); dialog.cur = null; dialog.queue.length = 0; closePanel(); h.peace(true);
      player.dead = false; player.mech = null; player.r = 13; player.hp = player.maxHp; player.inv = empty();
      const o = h.openSpot(40, 24); F.tp(o.x, o.y); F.step([]);

      // 1. the six hats
      { const ids = COLOURS.map(c => HATS[c]);
        const bad = ids.filter((id, i) => { const d = ITEMS[id]; return !(d && d.id === id && d.stack === 1 && d.value === 10000 && d.shape === 'helm' && d.armour && d.armour.slot === 'helm' && d.armour.def === 0 && d.partyHat === COLOURS[i] && d.name === cap1(COLOURS[i]) + ' party hat' && /^#[0-9a-f]{6}$/i.test(d.color)); });
        check(P + 'six party hats with the contract ids and fields: value 10,000 (above the dragon platebody), stack 1, a helm with no defence, six colours', ids.join() === 'party_hat_red,party_hat_yellow,party_hat_blue,party_hat_green,party_hat_purple,party_hat_white' && !bad.length && new Set(ids.map(id => ITEMS[id].color)).size === 6 && ITEMS.party_hat_red.value > ((ITEMS.dragon_body && ITEMS.dragon_body.value) || 0) && PARTY.isHat('party_hat_green') && !PARTY.isHat('iron_helm'), { bad, colours: ids.map(id => ITEMS[id].color) }); }

      // 2. worn: look.hat and no helm, drawn for anyone whose look has one
      { const helm0 = player.equip.helm;
        player.equip.helm = 'party_hat_purple'; const look = playerLook();
        const wire = window.PLAYERS ? PLAYERS.lookOf() : null;
        player.equip.helm = ITEMS.iron_helm ? 'iron_helm' : helm0; const plain = playerLook();
        player.equip.helm = helm0;
        let drew = true; try { drawHuman(ctx, { facing: { x: 0, y: 1 }, hurtT: 0, attackT: 0 }, look); drawHuman(ctx, { facing: { x: 1, y: 0 }, hurtT: 0, attackT: 0 }, { tunic: '#333', hair: '#222', hat: 'no-such-colour' }); } catch (e) { drew = String(e && e.message); }
        const wireOk = !wire || (wire.helm === null && (!('hat' in wire) || wire.hat === 'purple'));
        check(P + 'a worn party hat makes look.hat the colour word and takes look.helm away (hair shows); a real helm is untouched; drawHuman draws the crown', look.hat === 'purple' && !('helm' in look) && wireOk && (!ITEMS.iron_helm || (plain.helm === ITEMS.iron_helm.color && !plain.hat)) && drew === true, { hat: look.hat, helm: look.helm, wire, plain: plain.helm, drew }); }

      // 3. Death never takes a party hat
      { const dk0 = deathKeep, d0 = player.deaths, helm0 = player.equip.helm;
        deathKeep = null; player.inv = empty(); player.inv[0] = { id: 'party_hat_red', qty: 1 }; player.inv[3] = { id: 'wood', qty: 3 }; player.equip.helm = 'party_hat_blue';
        die();
        const kept = !!player.inv[0] && player.inv[0].id === 'party_hat_red' && countItem('wood') === 0 && !!deathKeep && deathKeep.items.length === 1 && deathKeep.items[0].id === 'wood' && player.equip.helm === 'party_hat_blue';
        player.dead = false; player.hp = player.maxHp;
        deathKeep = null; player.inv = empty(); player.inv[5] = { id: 'party_hat_white', qty: 1 };
        die();
        const onlyHats = !!player.inv[5] && player.inv[5].id === 'party_hat_white' && deathKeep === null;
        player.dead = false; player.hp = player.maxHp; player.deadT = 0; player.deaths = d0; deathKeep = dk0; player.equip.helm = helm0; player.inv = empty();
        dialog.cur = null; dialog.queue.length = 0;
        check(P + 'Death never takes a party hat: one in the pack stays in its slot, the rest goes to his chest as before, a worn one is untouched, a pack of only hats leaves the chest alone', kept && onlyHats, { kept, onlyHats }); }

      // 4. choosing the ground
      { F.tp(o.x, o.y); const G = ground();
        const s = pickSpots(20, 5);
        const good = Array.isArray(s) && s.length === 20 && new Set(s.map(t => t.join())).size === 20 && s.every(([tx, ty]) => (tx - o.x) ** 2 + (ty - o.y) ** 2 <= 25 && !(tx === o.x && ty === o.y) && G.has(tileAt(tx, ty)) && !collides(tc(tx), tc(ty), 13, 'person') && tileAt(tx, ty) !== T.WATER);
        const few = pickSpots(3, 4), many = pickSpots(80, 10);
        const sea = pickSpots(10, 3, { x: tc(180), y: tc(40) });
        check(P + 'pickSpots: distinct plain-ground tiles a knight can stand on, inside the spread, never under the knight; 5 to 50 of them; none (null) out at sea', good && Array.isArray(few) && few.length === 5 && Array.isArray(many) && many.length <= 50 && many.length >= 5 && sea === null && G.has(T.GRASS) && !G.has(T.WATER) && !G.has(T.PLANK) && !G.has(T.SOIL), { n: s && s.length, good, few: few && few.length, many: many && many.length, sea }); }

      // 5. the panel: only an admin gets Throw; the role message turns it on
      { role = 'player'; NET.disconnect(); NET.connect(); closePanel(); PARTY.open(); render();
        const player0 = panel === 'party' && !buttons.some(b => /party:throw/.test(b.label)) && buttons.some(b => b.label === 'party:close|');
        feed({ t: 'role', role: 'admin' }); render();
        const admin1 = buttons.some(b => b.label === 'party:throw|') && isAdmin();
        role = 'admin'; NET.disconnect(); NET.connect(); render();
        check(P + 'the party panel shows a player only "Only an admin can throw a drop party." and Close; an admin gets Throw (a role message switches it at once)', player0 && admin1, { player0, admin1, labels: buttons.filter(b => b.party).map(b => b.label).slice(0, 6) }); }

      // 6. the odds, exact, for a known table; the presets use only real ids; four hat choices, 1 in 1,000 by default
      const known = [{ id: 'coins', min: 25, max: 250, w: 40 }, { id: 'bread', min: 1, max: 5, w: 20 }, { id: 'iron_bar', min: 2, max: 8, w: 20 }, { id: 'steel_sword', min: 1, max: 1, w: 10 }, { id: 'mithril_bar', min: 1, max: 3, w: 10 }];
      { const l1000 = oddsLines(known, 1000), l10 = oddsLines(known, 10), l10k = oddsLines(known, 10000);
        const want = ['Coins 25 to 250: 39.96%', 'Bread 1 to 5: 19.98%', 'Iron bar 2 to 8: 19.98%', 'Steel sword: 9.99%', 'Mithril bar 1 to 3: 9.99%', 'Party hat: 1 in 1,000 (0.1%)'];
        const exact = l1000.join('|') === want.join('|') && l10[0] === 'Coins 25 to 250: 36%' && l10[5] === 'Party hat: 1 in 10 (10%)' && l10k[5] === 'Party hat: 1 in 10,000 (0.01%)';
        const presets = PRESETS.length === 4 && PRESETS.map(p => p.name).join() === 'Coins,Food,Ores and bars,Rare weapons' && PRESETS.every(p => p.rows.length && p.rows.every(r => ITEMS[r.id] && !isHat(r.id) && r.min >= 1 && r.max >= r.min && r.w >= 1));
        UI.tab = 'party'; UI.hat = 1000; closePanel(); PARTY.open(); render();
        const choices = HAT_CHOICES.every(n => buttons.some(b => b.label === 'party:hat:' + n + '|'));
        const def = UI.hat === 1000; F.clickButton('party:hat:100|'); const picked = UI.hat === 100; F.clickButton('party:hat:1000|');
        check(P + 'the odds are exact and always shown ("Coins 25 to 250: 39.96%" ... "Party hat: 1 in 1,000 (0.1%)"); four presets of real items; four hat choices, 1 in 1,000 unless changed', exact && presets && choices && def && picked, { l1000, l10: [l10[0], l10[5]], l10k: l10k[5], presets, choices, def, picked }); }

      // 7. throwing: exactly the contract's message, with what was chosen on the panel
      { quiet(); F.tp(o.x, o.y); F.step([]); S.lastThrow = -1e9;
        UI.tab = 'party'; UI.count = 20; UI.scatter = 5; UI.hat = 1000; UI.table = known.map(r => ({ ...r })); closePanel(); PARTY.open(); render();
        F.clickButton('party:count:-5|'); F.clickButton('party:count:-5|'); F.clickButton('party:spread:+1|'); F.clickButton('party:hat:100|');
        const n0 = sent('party').length;
        const tapped = F.clickButton('party:throw|');
        const m = sent('party')[n0];
        const shape = !!m && Object.keys(m).sort().join() === 'hat,spots,t,table,x,y' && m.x === Math.round(player.x) && m.y === Math.round(player.y) && m.hat === 100 && JSON.stringify(m.table) === JSON.stringify(known)
          && Array.isArray(m.spots) && m.spots.length === 10 && new Set(m.spots.map(t => t.join())).size === 10 && m.spots.every(([tx, ty]) => Number.isInteger(tx) && Number.isInteger(ty) && (tx - o.x) ** 2 + (ty - o.y) ** 2 <= 36);
        const words = said('Your party is on its way.') && panel === null;
        PARTY.open(); render(); F.clickButton('party:throw|'); const held = sent('party').length === n0 + 1 && said('One party at a time. Wait a moment.');
        quiet(); for (const code of ['bad', 'busy', 'where']) feed({ t: 'party_no', code });
        const no = said(PARTY_NO.bad) && said(PARTY_NO.busy) && said(PARTY_NO.where);
        closePanel();
        check(P + 'Throw sends exactly {t, x, y, spots, table, hat} with the panel\'s choices (10 crackers inside 6 tiles, 1 in 100), says "Your party is on its way.", holds a second one back; party_no bad / busy / where say their sentences', tapped && shape && words && held && no, { tapped, shape, m: m && { x: m.x, y: m.y, hat: m.hat, spots: m.spots.length, table: m.table.length }, words, held, no }); }

      // 8. crackers on the ground: drawn, lit with USE (once a second), lit with a tap, far is told
      quiet(); F.tp(o.x, o.y); F.step([]); render();
      const spots = [[o.x + 2, o.y], [o.x - 2, o.y], [o.x + 1, o.y - 1], [o.x - 1, o.y + 1], [o.x, o.y - 2]];
      feed({ t: 'crackers', pid: 7, map: 'over', by: 'MudGoll', list: spots.map(([tx, ty], k) => ['p7.' + k, tx, ty]), left: 900000 });
      { const items = []; for (const hk of HOOKS.draw) hk(ctx, items, cam);
        const cr = items.filter(it => it.cracker);
        let drew = true; try { for (const it of cr) it.draw(); } catch (e) { drew = String(e && e.message); }
        check(P + 'a crackers message puts its crackers on the ground: kept, listed by PARTY.live() and drawn among the world items', !!S.parties.get(7) && S.parties.get(7).crackers.size === 5 && PARTY.live().length === 5 && cr.length === 5 && drew === true, { kept: S.parties.get(7) && S.parties.get(7).crackers.size, drawn: cr.length, drew }); }
      { F.tp(o.x + 1, o.y); F.face(o.x + 2, o.y); S.lastLight.clear();
        const n0 = sent('light').length;
        F.press('KeyE'); const first = sent('light').slice(n0);
        F.press('KeyE'); const second = sent('light').slice(n0);
        const ok = first.length === 1 && first[0].id === 'p7.0' && first[0].x === Math.round(player.x) && first[0].y === Math.round(player.y) && second.length === 1;
        // a tap on another cracker walks up to it and lights it
        render(); const tgt = findCracker('p7.1'); const n1 = sent('light').length;
        const tapOk = tapAt(tc(tgt.tx) - cam.x, tc(tgt.ty) - cam.y);
        F.sim(150, []);
        const tapped = sent('light').slice(n1).some(m => m.id === 'p7.1');
        const person = tapPeople().some(q => q.name === 'Cracker' && q.id === 'p7.2');
        quiet(); feed({ t: 'light_no', id: 'p7.0', code: 'far' }); const far = said('Walk up to the cracker first.');
        quiet(); feed({ t: 'light_no', id: 'p7.0', code: 'taken' }); feed({ t: 'light_no', id: 'p7.0', code: 'map' }); const silent = !notice && !S.notes.length;
        quiet(); feed({ t: 'light_no', id: 'p7.4', code: 'gone' }); const gone = said('That cracker is gone.') && !findCracker('p7.4');
        tapCancel('manual');
        check(P + 'USE beside a cracker sends one light with its id and the knight\'s position (not twice in a second); a tap on one walks up and lights it; far / gone say so, taken and map stay quiet', ok && tapOk && tapped && person && far && silent && gone, { first, second: second.length, tapOk, tapped, person, far, silent, gone }); }

      // 9. the boom: the prize after the fuse, once; claimed in the save, then the claim; others get nothing
      { quiet(); player.inv = empty(); const c0 = coins(); const k0 = sent('claim').length;
        feed({ t: 'boom', id: 'p7.0', n: 'MudGoll', fuse: 1200, reward: { id: 'coins', qty: 250 } });
        F.sim(30, []);
        const c = findCracker('p7.0'), burning = !!c && !!c.lit && coins() === c0 && !ensure().claimed.includes('p7.0');
        let drewLit = true; try { const items = []; for (const hk of HOOKS.draw) hk(ctx, items, cam); for (const it of items) if (it.cracker === 'p7.0') it.draw(); } catch (e) { drewLit = String(e && e.message); }
        F.sim(60, []);
        const claims = () => sent('claim').slice(k0).filter(m => m.id === 'p7.0').length;
        const got = coins() === c0 + 250 && ensure().claimed.includes('p7.0') && claims() === 1 && !findCracker('p7.0') && S.banged.has('p7.0');
        let drewPop = true; try { const items = []; for (const hk of HOOKS.draw) hk(ctx, items, cam); for (const it of items) if (it.pop) it.draw(); } catch (e) { drewPop = String(e && e.message); }
        const popped = S.pops.length > 0 && drewPop === true;
        feed({ t: 'boom', id: 'p7.0', n: 'MudGoll', fuse: 1200, reward: { id: 'coins', qty: 250 } }); F.sim(90, []);
        feed({ t: 'prize', id: 'p7.0', reward: { id: 'coins', qty: 250 } });
        const once = coins() === c0 + 250 && claims() === 3 && ensure().claimed.filter(x => x === 'p7.0').length === 1;
        feed({ t: 'boom', id: 'p7.1', n: 'Sam', fuse: 1000, reward: { id: 'coins', qty: 99 } }); F.sim(70, []);
        const theirs = coins() === c0 + 250 && !ensure().claimed.includes('p7.1') && !sent('claim').some(m => m.id === 'p7.1') && !findCracker('p7.1');
        check(P + 'a boom naming this knight gives the prize once, after the fuse; the id is saved as claimed and the claim goes out; a repeat boom or a prize for it gives nothing more (it only claims); a boom for someone else gives nothing', burning && drewLit === true && got && popped && once && theirs, { burning, drewLit, got, popped, once, theirs, coins: coins() - c0, claims: claims() }); }
      { quiet(); feed({ t: 'prize', id: 'p8.4', reward: { id: 'not_in_this_game', qty: 1 } });
        const unknown = !ensure().claimed.includes('p8.4') && !sent('claim').some(m => m.id === 'p8.4') && said('That prize needs the newest game. Reload the page to get it.');
        quiet(); const bank0 = player.bank; player.bank = []; player.inv = empty().map(() => ({ id: 'iron_dagger', qty: 1 }));
        feed({ t: 'prize', id: 'p8.5', reward: { id: 'iron_bar', qty: 3 } });
        const vault = player.bank.find(s => s.id === 'iron_bar');
        const banked = !!vault && vault.qty === 3 && countItem('iron_bar') === 0 && said('From a cracker you lit: 3 Iron bar.') && said('Your pack was full, so it went to your bank.') && sent('claim').some(m => m.id === 'p8.5');
        player.bank = bank0; player.inv = empty(); quiet();
        feed({ t: 'crackers', pid: 9, map: 'over', by: 'MudGoll', list: [['p9.0', o.x + 1, o.y + 1]], left: 900000 });
        feed({ t: 'boom', id: 'p9.0', n: 'MudGoll', fuse: 1000, reward: { id: 'party_hat_purple', qty: 1, hat: 'purple' } }); F.sim(70, []);
        const hat = countItem('party_hat_purple') === 1 && said('You found a purple party hat! Open your pack to wear it.') && !!levelBanner && levelBanner.text === 'Purple party hat!';
        player.inv = empty(); levelBanner = null;
        check(P + 'a prize this game does not know is not added and not claimed (the reload sentence); a full pack sends it to the bank, in words; a party hat lands in the pack with its sentence and a gold banner', unknown && banked && hat, { unknown, banked, hat }); }

      // 10. with the cloud save on, the claim waits for a push that holds the cracker id
      if (LG && window.CLOUD) {
        quiet(); CLOUD.reset(); LG.playing = true; putsDown = true;
        feed({ t: 'prize', id: 'p8.6', reward: { id: 'coins', qty: 5 } });
        const waits = !sent('claim').some(m => m.id === 'p8.6') && S.waiting.includes('p8.6') && ensure().claimed.includes('p8.6');
        putsDown = false; save(); CLOUD.flush(); F.sim(20, []);
        const after = sent('claim').some(m => m.id === 'p8.6') && !S.waiting.includes('p8.6') && cloudHolds('p8.6');
        CLOUD.reset(); LG.playing = false;
        check(P + 'with the cloud save on, a claim waits while the push fails, and goes out once the cloud holds a save with that cracker in it', waits && after, { waits, after, puts: puts.length }); }

      // 11. the end of a party: party_end and the clock take the crackers down; a lit one finishes its bang
      { feed({ t: 'crackers', pid: 10, map: 'over', by: 'MudGoll', list: [['p10.0', o.x + 3, o.y], ['p10.1', o.x - 3, o.y]], left: 900000 });
        const had = !!S.parties.get(10); feed({ t: 'party_end', pid: 10, map: 'over' }); const ended = !S.parties.get(10);
        feed({ t: 'crackers', pid: 11, map: 'over', by: 'MudGoll', list: [['p11.0', o.x + 3, o.y + 1]], left: 900000 });
        S.parties.get(11).until = nowMs() - 1; F.step([]); const expired = !S.parties.get(11);
        feed({ t: 'crackers', pid: 12, map: 'over', by: 'Ann', list: [['p12.0', o.x + 3, o.y - 1], ['p12.1', o.x - 3, o.y - 1]], left: 900000 });
        feed({ t: 'boom', id: 'p12.0', n: 'Sam', fuse: 1000, reward: { id: 'coins', qty: 1 } }); feed({ t: 'party_end', pid: 12, map: 'over' });
        const midway = !!findCracker('p12.0') && !findCracker('p12.1'); F.sim(70, []); const finished = !S.parties.get(12);
        check(P + 'party_end takes a party\'s crackers down, so does its clock running out, and a cracker already lit still bangs first', had && ended && expired && midway && finished, { had, ended, expired, midway, finished }); }

      // 12. announcements: the gold banner (clear of every button) and a chat line
      { const lines = []; if (CH) CH.system = (t, col) => lines.push([t, col]);
        feed({ t: 'announce', kind: 'party', n: 'MudGoll', region: 'Thistledown', map: 'over', count: 20 });
        const party1 = !!S.banner && S.banner.text === 'MudGoll started a drop party in Thistledown!' && (!CH || (lines.length === 1 && lines[0][0] === S.banner.text));
        const den = INSTANCES.get && INSTANCES.get('spider_den');
        feed({ t: 'announce', kind: 'party', n: 'MudGoll', region: '', map: 'spider_den', count: 5 });
        const party2 = !den || S.banner.text === 'MudGoll started a drop party in ' + den.name + '!';
        feed({ t: 'announce', kind: 'hat', n: 'Sam', colour: 'purple' });
        const hat = S.banner.text === 'Sam found a purple party hat!' && (!CH || lines[lines.length - 1][0] === 'Sam found a purple party hat!');
        feed({ t: 'announce', kind: 'hat', n: 'Sam', colour: 'mauve' }); const junk = S.banner.text === 'Sam found a purple party hat!';
        const hits = [], sizes = [];
        closePanel();
        for (const [w, hh] of [[390, 844], [844, 390], [768, 1024], [1280, 800]]) {
          if (!setSize(w, hh)) continue; sizes.push(w + 'x' + hh);
          const r = S.bannerRect; if (!r) { hits.push(w + 'x' + hh + ': no banner'); continue; }
          if (r.x < 0 || r.y < 0 || r.x + r.w > VW || r.y + r.h > VH) hits.push(w + 'x' + hh + ': off screen');
          for (const b of buttons) if (overlap(r, b)) hits.push(w + 'x' + hh + ': ' + b.label);
          if (minimapRect && overlap(r, minimapRect)) hits.push(w + 'x' + hh + ': minimap');
        }
        setSize(was.iw, was.ih);
        if (CH) { if (was.ownSys) CH.system = was.sys; else delete CH.system; }
        check(P + 'an announce puts a gold banner across the top ("MudGoll started a drop party in Thistledown!", "Sam found a purple party hat!") and a chat line; the banner covers no button at any screen size', party1 && party2 && hat && junk && hits.length === 0 && sizes.length > 0, { party1, party2, hat, junk, hits, sizes, lines: lines.length }); }

      // 13. the panel's other tabs: rows with their odds, the row editor, presets and any item (no page, no DOM)
      { UI.table = known.map(r => ({ ...r })); UI.tab = 'prizes'; UI.sel = 0; closePanel(); PARTY.open(); UI.tab = 'prizes'; render();
        const rowsOk = known.every(r => buttons.some(b => b.label === 'party:row:' + r.id + '|'));
        F.clickButton('party:row:bread|'); const sel = UI.sel === 1;
        F.clickButton('party:max:up|'); F.clickButton('party:min:up|'); F.clickButton('party:w:down|');
        const edited = UI.table[1].min === 2 && UI.table[1].max === 10 && UI.table[1].w === 15;
        F.clickButton('party:row:steel_sword|'); for (let i = 0; i < 8; i++) F.clickButton('party:max:up|'); const gearCap = UI.table[3].max === GEAR_MAX;
        F.clickButton('party:remove|'); const removed = UI.table.length === 4 && !UI.table.some(r => r.id === 'steel_sword');
        UI.tab = 'add'; render();
        F.clickButton('party:preset:weapons|'); const preset = UI.table.some(r => r.id === 'steel_sword') && UI.table.some(r => r.id === 'dragon_spear');
        const found1 = PARTY.search('drag'); render();
        const narrowed = found1.length > 0 && found1.every(id => /drag/i.test(ITEMS[id].name) || id.indexOf('drag') >= 0) && !PARTY.search('party hat').length;
        PARTY.search('shark'); render(); const n1 = UI.table.length; F.clickButton('party:add:shark|'); const added = UI.table.length === n1 + 1 && UI.table[UI.table.length - 1].id === 'shark';
        const noDom = dom === false || dom === null || !!(typeof document !== 'undefined' && document.body);
        PARTY.search(''); closePanel(); render();
        check(P + 'Prizes: every row with its chance, tap one to change from / to / weight (gear stops at 5) or take it out; Add prizes: a preset adds its rows, the search finds items by name (never a party hat) and a tap adds one', rowsOk && sel && edited && gearCap && removed && preset && narrowed && added && noDom, { rowsOk, sel, edited, row: UI.table[1], gearCap, removed, preset, narrowed, added, noDom }); }

      // 14. layout: at phone, landscape phone, tablet (both ways) and desktop sizes, every tab: buttons on the screen,
      //     44 px tall on touch, none overlapping another (the × is the core's panelBox button)
      { const hits = [], sizes = [];
        feed({ t: 'crackers', pid: 20, map: 'over', by: 'MudGoll', list: [['p20.0', o.x + 4, o.y], ['p20.1', o.x - 4, o.y]], left: 700000 });
        const big = allItems().filter(id => !isHat(id)).slice(0, 20).map(id => ({ id, min: 1, max: qtyCap(id) === GEAR_MAX ? 1 : 10, w: 5 }));
        for (const [w, hh, touch] of [[390, 844, true], [844, 390, true], [768, 1024, true], [1024, 768, true], [1280, 800, false]]) {
          window.__forceTouch = touch;
          if (!setSize(w, hh)) continue;
          sizes.push(w + 'x' + hh);
          for (const table of [known, big]) for (const tab of ['party', 'prizes', 'add']) {
            UI.table = table.map(r => ({ ...r })); UI.sel = table.length - 1; closePanel(); PARTY.open(); UI.tab = tab; render();
            const mine2 = pickMine(), name = w + 'x' + hh + ' ' + tab + (table === big ? ' (20 rows)' : '');
            if (!mine2.length) hits.push(name + ': nothing drawn');
            for (const b of mine2) {
              if (b.x < 0 || b.y < 0 || b.x + b.w > VW + 0.5 || b.y + b.h > VH + 0.5) hits.push(name + ': off screen ' + b.label);
              if (touch && b.h < 44) hits.push(name + ': short ' + b.label);
            }
            for (let i = 0; i < mine2.length; i++) for (let j = i + 1; j < mine2.length; j++) if (overlap(mine2[i], mine2[j])) hits.push(name + ': ' + mine2[i].label + ' x ' + mine2[j].label);
            if (panelRect && (panelRect.x < 0 || panelRect.y < 0 || panelRect.x + panelRect.w > VW || panelRect.y + panelRect.h > VH)) hits.push(name + ': panel off screen');
            if (tab === 'party' && !buttons.some(b => b.label === 'party:end|')) hits.push(name + ': no End the party');
            if (tab === 'party' && table === big && !buttons.some(b => b.label === 'party:throw|')) hits.push(name + ': no Throw');
          }
        }
        window.__forceTouch = was.touch; setSize(was.iw, was.ih); closePanel();
        check(P + 'the party panel fits phone, landscape phone, tablet and desktop: every button on screen, 44 px tall on touch, none overlapping, End the party shown while a party of yours is live', hits.length === 0 && sizes.length > 0, { hits: hits.slice(0, 8), sizes }); }
    } finally {
      NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null;
      if (LG) LG.playing = was.playing;
      if (window.CLOUD) CLOUD.reset();
      if (CH) { if (was.ownSys) CH.system = was.sys; else delete CH.system; }
      reset(); Object.assign(UI, was.ui); UI.table = was.ui.table;
      window.__forceTouch = was.touch; setSize(was.iw, was.ih);
      player.inv = was.inv; player.bank = was.bank; player.equip = was.equip; player.x = was.x; player.y = was.y; player.facing = was.facing;
      player.hp = was.hp; player.dead = was.dead; player.deadT = was.deadT; player.deaths = was.deaths; player.mech = was.mech; player.r = was.r;
      deathKeep = was.deathKeep; player.party = was.party; notice = was.notice; levelBanner = was.levelBanner;
      dialog.cur = was.dc; dialog.queue.length = 0; dialog.queue.push(...was.dq); drops = was.drops;
      tapCancel('manual'); closePanel(); h.peace(!!was.peace); recomputeMaxHp(); render();
    }
  });
}
