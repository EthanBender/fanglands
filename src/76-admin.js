// ============================================================================
// ADMIN — the owner's own knight gets powers on gorkscape.ca
// Owner (2026-09-25), about MudGoll: "can you make mudgoll a Admin I should be able to Mute or Ban players and I should
// have all aspects of the Game unlocked and be able to spawn mobs for fun or do drop pratys ..."
// docs/ONLINE.md, "Admins and drop parties", is the contract this file keeps to. The world decides who is an admin
// (the parent page sets it; NET.role carries the world's word) and checks the role on every admin message itself: this
// file hiding its buttons from a player is a convenience, never the lock.
//
// What is here:
//   A. a gold ADMIN chip on the HUD, beside 73's ONLINE chip, for admins only; it opens the Admin panel (HOOKS.panel.admin)
//      with four tabs: Knights, Powers, Monsters, Party
//   B. Knights: mute (5 minutes / 1 hour / 1 day / until unmuted), unmute, kick and ban the knights online; the muted and
//      banned lists with Unmute and Unban; the world's answers in plain words
//   C. Powers, all on the admin's OWN knight and nothing sent to anyone else: Unlock everything (only after the world has
//      pinned a backup), Put my knight back, Can't be hurt, Teleport, Give me an item
//   D. Monsters: spawn any MONSTER_DEFS type near yourself; the map's keeper makes them (any client can be the keeper, so
//      the keeper's half lives here too: NET.on('spawn') / ('spawn_clear') and the no-respawn rule for '!' monsters)
//   E. Party: the button into 77-dropparty's panel
// Wraps by reassignment, all with explicit arguments: hurtPlayer and die (Can't be hurt), pointerDown (where the last
// tap was, for Teleport), drawPanels (the Teleport button over the world map, and the one search box), closePanel (the
// search box goes when the panel does). Feature file: HOOKS only otherwise. window.ADMIN is the register.
// ============================================================================
{
  const GOLD = '#f5c542', INK = '#1a1300';
  const SPAWN_LIVE_MAX = 60;          // living admin spawns per map, on the keeper
  const SPAWN_SPREAD = 3 * TILE;      // how far from the admin a spawned monster may stand
  const SPAWN_GONE_AFTER = 2;         // seconds a dead admin spawn lies there before the keeper removes it
  const COUNT_MAX = 20, QTY_MAX = 1000000;
  const MODLIST_EVERY = 10000;        // ms between modlist asks while the Knights tab is open
  const SPANS = [['5m', '5 minutes'], ['1h', '1 hour'], ['1d', '1 day'], ['always', 'Until I unmute']];
  // the contract's caps (rate per second, burst): the client stays under them, so the world never drops the admin for speed
  const CAPS = { mute: [1, 3], unmute: [1, 3], kick: [1, 3], ban: [1, 3], unban: [1, 3], modlist: [1, 2], spawn: [1, 3], spawn_clear: [1, 2] };
  const TABS = [['knights', 'Knights'], ['powers', 'Powers'], ['monsters', 'Monsters'], ['party', 'Party']];
  const SUBTITLE = {
    knights: 'Mute, send out or ban a knight. Nobody can do that to an admin.',
    powers: 'These change only your own knight.',
    monsters: 'Monsters you make here never come back once they are killed.',
    party: 'Crackers on the ground for everyone near you.',
  };
  // the same, for a phone's narrow panel
  const SUBTITLE_SHORT = { knights: 'Mute, send out or ban a knight.', powers: 'These change only your own knight.', monsters: 'Killed ones never come back.', party: 'Crackers for everyone near you.' };

  const S = {
    tab: 'knights',
    view: null,            // null | { kind: 'mute', n } (Knights) | { kind: 'give' } (Powers: the item picker)
    god: false,            // Can't be hurt: this session only, never saved
    teleport: false,       // the world map is open to pick a place
    pinAt: undefined,      // the pinned backup's time: undefined = not asked yet, null = none, a number = there is one
    pinAskedAt: -1e9,
    busy: null,            // 'pin' | 'restore' while a call to the world is out
    modlist: null,         // { muted: [{ n, left }], banned: [{ n }], at }
    modlistAskedAt: -1e9,
    spans: {},             // lower-case name -> the span last asked, for the answer's words
    search: '', inputMode: 'search', qtyText: '1', qty: 1, item: null,
    monType: null, count: 1,
    page: { knights: 0, give: 0, monsters: 0 },
    pointer: null, mapImg: null,
    followUp: 0,           // frames until the unlock's second pass (the markers the new buildings brought)
    stats: { spawned: 0, cleared: 0, removed: 0, refused: 0, lastSid: null },
  };
  const isAdmin = () => NET.online() && NET.role === 'admin';
  const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
  const inInstance = () => !!(window.INSTANCES && INSTANCES.active && INSTANCES.active());

  // ---------- calls to /api, the way 71-login and 72-cloudsave make them: a fake may answer on the spot ----------
  const api = (method, path, body) => {
    try { return NET.fake ? NET.fake.call(method, path, body, NET.token) : NET.call(method, path, body); }
    catch (e) { return { __threw: e || new Error('failed') }; }
  };
  const when = (v, ok, bad) => {
    if (v && typeof v.then === 'function') { v.then(ok, bad).catch(e => console.error('admin', e)); return; }
    if (v && v.__threw) bad(v.__threw); else ok(v);
  };

  // ---------- plain words ----------
  const commas = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // seconds under a minute, minutes under an hour, hours under a day, then days; always rounded up
  const amount = secs => {
    const s = Math.max(1, Math.ceil(secs));
    const [n, unit] = s < 60 ? [s, 'second'] : s < 3600 ? [Math.ceil(s / 60), 'minute'] : s < 86400 ? [Math.ceil(s / 3600), 'hour'] : [Math.ceil(s / 86400), 'day'];
    return n + ' ' + unit + (n === 1 ? '' : 's');
  };
  const IRREGULAR = { wolf: 'wolves', sheep: 'sheep', dwarf: 'dwarves', elf: 'elves', knife: 'knives', leaf: 'leaves', mouse: 'mice', thief: 'thieves', fish: 'fish', deer: 'deer', goose: 'geese' };
  const MASS = /^(wool|bread|silk|coal|flour|wheat|scrap|powder|dung|essence|shrimp|trout|ore|food|meat|beef|salve|sand|stone|ash|hide|leather|armour|mail|coins|berries|mithril|iron|steel|bronze|obsidian|clay|lobster)$/i;
  // "iron bars", "wolves", "fangs of the Fang": good enough for what the game is called; the first letter goes small
  function plural(name, n) {
    let s = String(name || '');
    if (n !== 1) {
      s = s.replace(/^The /, '');
      const cut = s.search(/ of |: /), head = cut > 0 ? s.slice(0, cut) : s, tail = cut > 0 ? s.slice(cut) : '';
      const words = head.split(' '), last = words[words.length - 1], lower = last.toLowerCase();
      let p;
      if (IRREGULAR[lower]) p = last[0] === last[0].toUpperCase() ? IRREGULAR[lower][0].toUpperCase() + IRREGULAR[lower].slice(1) : IRREGULAR[lower];
      else if (MASS.test(last) || /s$/i.test(last)) p = last;
      else if (/[^aeiou]y$/i.test(last)) p = last.slice(0, -1) + 'ies';
      else if (/(x|z|ch|sh)$/i.test(last)) p = last + 'es';
      else p = last + 's';
      words[words.length - 1] = p; s = words.join(' ') + tail;
    }
    return s.charAt(0).toLowerCase() + s.slice(1);
  }
  const clock = at => {
    const d = new Date(at), h = d.getHours(), m = d.getMinutes(), now = new Date();
    const t = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
    if (d.toDateString() === now.toDateString()) return t;
    return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getDate()}, ${t}`;
  };
  const fit = (g, text, maxW) => { let s = String(text); if (g.measureText(s).width <= maxW) return s; while (s.length > 2 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1); return s + '…'; };

  // ---------- sending: admins only, and never faster than the world allows ----------
  // counted in game seconds: they never run faster than real ones (a frame is at most 0.05 s), so the world's caps
  // are always met, and a simulation's frames count the same way the world's clock does. A load that sets the clock
  // back starts the count again.
  const bucket = {};
  function allowed(t) {
    const c = CAPS[t]; if (!c) return true;
    const now = time, b = bucket[t] || (bucket[t] = { tokens: c[1], at: now });
    const dt = now - b.at;
    b.tokens = dt < 0 ? c[1] : Math.min(c[1], b.tokens + dt * c[0]); b.at = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1; return true;
  }
  function sendAdmin(msg) {
    if (!isAdmin()) { notify('Only an admin can do that.'); return false; }
    if (!allowed(msg.t)) { S.stats.refused++; notify('One thing at a time. Try again in a moment.'); return false; }
    if (!NET.send(msg)) { notify('That did not go through. Try again.'); return false; }
    return true;
  }

  // ---------- B. moderation ----------
  const validName = n => typeof n === 'string' && n.trim().length > 0 && n.length <= 40;
  function mute(n, span) {
    if (!validName(n) || !SPANS.some(s => s[0] === span)) return false;
    if (!sendAdmin({ t: 'mute', n, span })) return false;
    S.spans[n.toLowerCase()] = span; return true;
  }
  const unmute = n => validName(n) && sendAdmin({ t: 'unmute', n });
  const kick = n => validName(n) && sendAdmin({ t: 'kick', n });
  const ban = n => validName(n) && sendAdmin({ t: 'ban', n });
  const unban = n => validName(n) && sendAdmin({ t: 'unban', n });
  function askModlist() { if (!isAdmin() || nowMs() - S.modlistAskedAt < 1500) return false; S.modlistAskedAt = nowMs(); return sendAdmin({ t: 'modlist' }); }
  const SPAN_SECS = { '5m': 300, '1h': 3600, '1d': 86400 };
  // the world's answer to a moderation message, in the contract's words
  function modSentence(m) {
    const n = (m && typeof m.n === 'string' && m.n) || 'That knight';
    if (!m || !m.ok) {
      const code = m && m.code;
      return code === 'admin' ? "You can't do that to an admin." : code === 'unknown' ? 'No knight by that name.' : code === 'offline' ? `${n} is not online.` : code === 'self' ? 'That is you.' : 'That did not work. Try again.';
    }
    if (m.act === 'mute') {
      const span = S.spans[n.toLowerCase()];
      const left = typeof m.left === 'number' ? m.left : span === 'always' ? -1 : SPAN_SECS[span] || -1;
      return left === -1 ? `${n} is muted until you unmute.` : `${n} is muted for ${amount(left)}.`;
    }
    if (m.act === 'unmute') return `${n} can chat again.`;
    if (m.act === 'kick') return `${n} was sent out of the world.`;
    if (m.act === 'ban') return `${n} is banned.`;
    if (m.act === 'unban') return `${n} is unbanned.`;
    return 'Done.';
  }
  NET.on('mod', m => { if (!m || typeof m.act !== 'string') return; notify(modSentence(m)); sfx(m.ok ? 'ui' : 'miss'); });
  NET.on('modlist', m => {
    if (!m) return;
    const muted = (Array.isArray(m.muted) ? m.muted : []).filter(o => o && validName(o.n) && typeof o.left === 'number').map(o => ({ n: o.n, left: o.left }));
    const banned = (Array.isArray(m.banned) ? m.banned : []).filter(o => o && validName(o.n)).map(o => ({ n: o.n }));
    S.modlist = { muted, banned, at: nowMs() };
  });
  // seconds of mute left now, from the last modlist: -1 = until unmuted, 0 = not muted
  function muteLeft(n) {
    const L = S.modlist; if (!L) return 0;
    const o = L.muted.find(x => x.n.toLowerCase() === String(n).toLowerCase()); if (!o) return 0;
    if (o.left === -1) return -1;
    const left = o.left - (nowMs() - L.at) / 1000; return left > 0 ? left : 0;
  }
  const leftWords = left => left === -1 ? 'until you unmute' : amount(left) + ' left';

  // ---------- powers go off with the role: a demotion, a lost connection, a new session ----------
  function off(why) {
    const was = S.god || S.teleport || panel === 'admin';
    S.god = false; S.teleport = false; S.view = null; S.busy = null;
    if (panel === 'admin') closePanel();
    hideInput();
    if (why === 'demoted' && was) notify('You are not an admin any more.');
  }
  NET.on('role', () => { if (NET.role !== 'admin') off('demoted'); });
  NET.on('welcome', () => { S.pinAt = undefined; S.pinAskedAt = -1e9; S.modlist = null; S.modlistAskedAt = -1e9; S.spans = {}; if (NET.role !== 'admin') off('welcome'); });
  NET.on('offline', () => off('offline'));

  // ---------- D. spawning: the admin asks, the world relays to the map's keeper, the keeper makes them ----------
  const isSpawn = m => !!m && typeof m.nid === 'string' && m.nid.charAt(0) === '!';
  function spawn(type, count) {
    const def = typeof type === 'string' && Object.prototype.hasOwnProperty.call(MONSTER_DEFS, type) ? MONSTER_DEFS[type] : null;
    count = Math.floor(+count || 0);
    if (!def || count < 1 || count > COUNT_MAX) return false;
    if (!sendAdmin({ t: 'spawn', type, count, x: Math.round(player.x), y: Math.round(player.y) })) return false;
    notify(count === 1 && /^The /.test(def.name) ? `Spawning ${def.name}.` : `Spawning ${count} ${plural(def.name, count)}.`);
    return true;
  }
  function clearSpawns() { if (!sendAdmin({ t: 'spawn_clear' })) return false; notify('Clearing the monsters you made on this map.'); return true; }
  // the monster exactly as spawnMonsters() (04-state) makes one, standing on its own home, with the admin-spawn nid
  function makeSpawn(type, x, y, nid) {
    const d = MONSTER_DEFS[type];
    return { type, x, y, home: { x, y }, r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: d.aggro, state: 'idle', wanderT: Math.random() * 2,
      wander: { x: 0, y: 0 }, attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 0, facing: { x: 1, y: 0 }, walkT: 0, moving: false, stunT: 0, nid };
  }
  // a free spot for a monster of radius r within the spread of (x, y); the point itself when there is none
  function spawnSpot(x, y, r) {
    const cx = clamp(x, r, MAP_W * TILE - r), cy = clamp(y, r, MAP_H * TILE - r);
    for (let k = 0; k < 48; k++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * SPAWN_SPREAD;
      const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d;
      if (px < r || py < r || px > MAP_W * TILE - r || py > MAP_H * TILE - r) continue;
      if (!collides(px, py, r, 'beast')) return { x: px, y: py };
    }
    return { x: cx, y: cy };
  }
  const reindex = () => { if (window.COOP && COOP.state) COOP.state.idxLen = -1; };
  NET.on('spawn', m => {
    if (!m || !window.COOP || !COOP.isKeeper()) return;
    const type = m.type, def = typeof type === 'string' && Object.prototype.hasOwnProperty.call(MONSTER_DEFS, type) ? MONSTER_DEFS[type] : null;
    if (!def) return;
    const sid = typeof m.sid === 'string' && /^[0-9a-z]+$/.test(m.sid) ? m.sid : null;
    const x = num(m.x), y = num(m.y), count = Math.floor(num(m.count) || 0);
    if (!sid || x === null || y === null || count < 1) return;
    const living = monsters.filter(o => isSpawn(o) && !o.dead).length;
    const make = Math.min(count, COUNT_MAX, SPAWN_LIVE_MAX - living);
    let made = 0;
    for (let k = 0; k < make; k++) {
      const nid = '!' + sid + '.' + k;
      if (monsters.some(o => o.nid === nid)) continue;
      const p = spawnSpot(x, y, def.r || 13);
      monsters.push(makeSpawn(type, p.x, p.y, nid)); made++;
    }
    if (made) reindex();
    S.stats.spawned += made; S.stats.lastSid = sid;
  });
  NET.on('spawn_clear', () => {
    if (!window.COOP || !COOP.isKeeper()) return;
    let n = 0;
    for (let i = monsters.length - 1; i >= 0; i--) if (isSpawn(monsters[i])) { monsters.splice(i, 1); n++; }
    if (n) reindex();
    S.stats.cleared += n;
  });
  // the no-respawn rule, wherever this client runs real monsters: a dead admin spawn never comes back, and goes after 2 s
  function spawnUpkeep() {
    if (window.COOP && typeof COOP.puppets === 'function' && COOP.puppets()) return;
    let changed = false;
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      if (!isSpawn(m) || m.remote || !m.dead) continue;
      m.respawnT = 1e9;
      if ((m.deadT || 0) >= SPAWN_GONE_AFTER) { monsters.splice(i, 1); changed = true; S.stats.removed++; }
    }
    if (changed) reindex();
  }

  // ---------- C. Can't be hurt ----------
  // plain early returns while it is on (77-dropparty wraps die after this file and keeps its own finally); hp is topped
  // up every frame as a backstop against the few places that take hp straight off (lava, the lair's heat)
  const godOn = () => S.god && isAdmin();
  { const _hurtPlayer = hurtPlayer; hurtPlayer = function (dmg, fromX, fromY, sure) { if (godOn()) return; return _hurtPlayer(dmg, fromX, fromY, sure); }; }
  { const _die = die; die = function () { if (godOn()) return; return _die(); }; }
  function setGod(on) {
    if (on && !isAdmin()) return false;
    S.god = !!on;
    if (S.god) { player.hp = player.maxHp; notify("You can't be hurt now. It turns off when you log out."); }
    else notify('You can be hurt again.');
    return true;
  }

  // ---------- C. Teleport ----------
  function teleportTo(tx, ty) {
    if (!isAdmin()) return false;
    if (inInstance()) { notify('Teleport works on the overworld.'); return false; }
    tx = Math.floor(tx); ty = Math.floor(ty);
    if (!inMap(tx, ty)) { notify('That is off the edge of the world.'); return false; }
    const spot = safeSpot(tc(tx), tc(ty), player.r, typeof playerWho === 'function' ? playerWho() : 'player');
    if (!spot) { notify('There is no room to stand there. Pick another place.'); return false; }
    burst(player.x, player.y, GOLD, 24, 140);
    player.x = spot.x; player.y = spot.y; player.action = null; player.moving = false;
    if (typeof tapCancel === 'function') tapCancel('manual');
    S.teleport = false; if (panel === 'map') closePanel();
    burst(player.x, player.y, GOLD, 30, 160); sfx('open');
    const reg = regionAt(tx, ty); notify(`You are in ${(reg && reg.name) || 'the Fanglands'}.`);
    save(); return true;
  }
  function startTeleport() {
    if (!isAdmin()) return false;
    if (inInstance()) { notify('Teleport works on the overworld.'); return false; }
    S.teleport = true; openPanel('map'); return true;
  }
  // the last tap, turned into a tile with the same maths 10-hud draws the map picture with
  function teleportAtPointer() {
    const p = S.pointer, img = S.mapImg; if (!p || !img) return false;
    const sc = img.w / MAP_W;
    return teleportTo(Math.floor((p.x - img.x) / sc), Math.floor((p.y - img.y) / sc));
  }

  // ---------- C. Give me an item: into the pack, then the bank; what fits nowhere is not made ----------
  function give(id, qty) {
    if (!isAdmin() || !id || !Object.prototype.hasOwnProperty.call(ITEMS, id)) return false;
    qty = clamp(Math.floor(+qty || 0), 1, QTY_MAX);
    const def = ITEMS[id];
    // the keyring (68-questitems): an unlock is kept, never carried, and there is only ever one
    if (window.KEYRING && KEYRING.KEYS && KEYRING.KEYS[id]) {
      if (KEYRING.held(id)) { notify(`${def.name} is already on your keyring.`); return false; }
      KEYRING.add(id); notify(`${def.name} is on your keyring now.`); save(); return true;
    }
    const toPack = Math.min(qty, Math.max(0, roomFor(id)));
    let left = toPack > 0 ? addItem(id, toPack) : 0;
    const packed = toPack - left, rest = qty - packed;
    const banked = rest > 0 && bankAdd(id, rest) ? rest : 0;
    const gave = packed + banked;
    if (!gave) { notify('Your pack and your bank are full. Nothing was given.'); return false; }
    const what = `${commas(gave)} ${plural(def.name, gave)}`;
    notify(gave < qty ? `Gave ${what} (the rest did not fit).` : banked ? `Gave ${what} (${commas(banked)} went to your bank).` : `Gave ${what}.`);
    floatText(player.x, player.y - 34, `+${commas(gave)} ${def.name}`, def.color || GOLD); sfx('pickup');
    save(); return { gave, packed, banked, refused: qty - gave };
  }

  // ---------- C. Unlock everything ----------
  // What "everything" means, enumerated from the code (the report carries this table): each entry says what unlocked
  // means, sets it the way the game itself would have left it, and can say whether it holds. Tile changes go through
  // changeTile so they live in the save. The one-time bosses the world shares (the Barrelbeast, The Fang) are left
  // standing on purpose: through the keeper model a boss slain in MudGoll's save would stay down for every friend on
  // his map, and the fights are the fun part. Their gates are open; the Fang comes when he sounds the horn.
  const lastStage = () => Math.max(16, ...Object.keys(HOOKS.mainQuest).map(Number).filter(Number.isFinite));
  const qo = (key, fresh) => { const v = quest[key]; if (v && typeof v === 'object') return v; quest[key] = fresh(); return quest[key]; };
  const tileId = name => (name in T ? T[name] : undefined);
  const eachTile = (t, fn) => { if (t === undefined) return 0; let n = 0; for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (map[idx(x, y)] === t) { fn(x, y); n++; } return n; };
  const anyTile = t => { if (t === undefined) return false; for (let i = 0; i < map.length; i++) if (map[i] === t) return true; return false; };
  // 35-night: the crypt door east of the last knight's grave (12,70, laid by 02-world)
  const NIGHT_CRYPT = { x: 13, y: 70 };
  const PART_IDS = ['boiler', 'gear_wheel', 'bomb_chute', 'lightning_coil'];
  const REBUILD_STOCK = [['plank', 200], ['stone', 100], ['iron_bar', 50], ['mithril_bar', 10]];
  const rebuilt = () => !!(QUEST_DEFS.rebuild && quest.stage >= 10 && !activeQuests().includes('rebuild'));
  // 31-rebuild's seven projects are built by its own code, through its own board: a pack of exactly the materials is
  // lent for the moment (never the knight's own), each Build button is pressed in turn, and the knight's pack comes
  // back untouched. So the sawmill, the cobbles, the well, the houses, the chapel, the bell and the smithy are the
  // game's own tiles, and the guild (41-guild) founds itself on the next frame the way it always does.
  function driveRebuild() {
    if (typeof HOOKS.panel.rebuild !== 'function' || !QUEST_DEFS.rebuild) return 'absent';
    if (rebuilt()) return 'done';
    const inv0 = player.inv, b0 = buttons.slice(), rect0 = panelRect, panel0 = panel, arg0 = panelArg, vh0 = VH;
    let scratch = ctx;
    try { if (typeof document !== 'undefined' && document.createElement) { const c = document.createElement('canvas'); const c2 = c && c.getContext && c.getContext('2d'); if (c2) scratch = c2; } } catch (e) { }
    try {
      player.inv = new Array(INV_SLOTS).fill(null);
      for (const [id, n] of REBUILD_STOCK) if (ITEMS[id]) addItem(id, n);
      panel = 'rebuild'; panelArg = null; VH = Math.max(VH, 1400);
      for (let guard = 0; guard < 24 && !rebuilt(); guard++) {
        buttons.length = 0; HOOKS.panel.rebuild(scratch, false);
        const b = buttons.find(x => /^Build: /.test(x.label));
        if (!b) break;
        b.action();
      }
    } finally {
      VH = vh0; player.inv = inv0; buttons.length = 0; for (const b of b0) buttons.push(b); panelRect = rect0; panel = panel0; panelArg = arg0;
    }
    dialog.queue.length = 0; dialog.cur = null;
    return rebuilt() ? 'built' : 'stuck';
  }
  function seeAllMarkers() { if (!window.MARKERS) return; MARKERS.refresh(); const s = MARKERS.state(); for (const m of MARKERS.all()) s.seen[m.key] = 1; MARKERS.refresh(); }
  const UNLOCKS = [
    { key: 'skills', system: 'Skills (SKILL_DEFS, all 13)', what: 'every skill at level 99, full health',
      apply() { for (const s of SKILL_DEFS) { const sk = player.skills[s.key] || (player.skills[s.key] = { xp: 0 }); if (!(sk.xp >= xpForLevel(99))) sk.xp = xpForLevel(99); } player.hpSeeded = true; recomputeMaxHp(); player.hp = player.maxHp; },
      ok: () => SKILL_DEFS.every(s => player.skills[s.key] && levelForXp(player.skills[s.key].xp) >= 99) },
    { key: 'story', system: 'Main quest (core stages 0-8, HOOKS.mainQuest 8-16)', what: 'the story at its last stage; the sword, the first goblins, Thistledown and the walker behind you',
      apply() { quest.stage = Math.max(quest.stage || 0, lastStage()); quest.walkerKilled = true; quest.kills = Math.max(quest.kills || 0, 3); swordTaken = true; player.visitedVillage = true; },
      ok: () => quest.stage >= lastStage() && !!quest.walkerKilled && swordTaken && !!player.visitedVillage },
    { key: 'warden', system: "Warden Brann's gate (37-dragonkillers)", what: 'the road into the Ashfields open',
      present: () => !!window.DRAGON_KILLERS,
      apply() { DRAGON_KILLERS.openGate(true); DRAGON_KILLERS.DK().gate = true; },
      ok: () => DRAGON_KILLERS.GATE_T.every(([x, y]) => tileAt(x, y) !== DRAGON_KILLERS.WARDEN_GATE) && !!DRAGON_KILLERS.DK().gate },
    { key: 'hollowford', system: 'Hollowford and Under the Chapel (20-hollowford)', what: 'the crypt bars broken, the survivors free, Old Tam thanked (the Barrelbeast is left to fight)',
      present: () => tileId('CRYPT_BARS') !== undefined,
      apply() { const hf = qo('hollowford', () => ({ rewarded: false, beastKilled: false, wreck: null, freed: false, barHits: 0 })); eachTile(tileId('CRYPT_BARS'), (x, y) => changeTile(x, y, T.FLOOR)); hf.freed = true; hf.barHits = 3; hf.rewarded = true; },
      ok: () => !!quest.hollowford && quest.hollowford.freed && quest.hollowford.rewarded && !anyTile(tileId('CRYPT_BARS')) },
    { key: 'lair', system: "The Fang's lair gate (28-thefang)", what: 'the lair open (The Fang sleeps until the horn sounds on the circle)',
      present: () => tileId('LAIR_GATE') !== undefined,
      apply() { eachTile(tileId('LAIR_GATE'), (x, y) => changeTile(x, y, T.CAVE)); qo('fang', () => ({ gateOpen: false, warned: false, slain: false, seen: false, looted: [], chest: false, summoned: false })).gateOpen = true; },
      ok: () => !anyTile(tileId('LAIR_GATE')) && !!quest.fang && !!quest.fang.gateOpen },
    { key: 'dk', system: 'The Dragon Killers (37-dragonkillers)', what: 'the company formed, the horn given',
      present: () => !!window.DRAGON_KILLERS,
      apply() { const q = DRAGON_KILLERS.DK(); q.formed = true; q.gate = true; },
      ok: () => !!DRAGON_KILLERS.DK().formed },
    { key: 'keyring', system: 'The keyring (68-questitems)', what: 'every KEYRING.KEYS unlock held: the wind flute and the dragon horn',
      present: () => !!(window.KEYRING && KEYRING.KEYS),
      apply() { for (const id in KEYRING.KEYS) KEYRING.add(id); },
      ok: () => Object.keys(KEYRING.KEYS).every(id => KEYRING.held(id)) },
    { key: 'bread', system: 'A Loaf for Tobin (core)', what: 'done', apply() { quest.bread = 'done'; }, ok: () => quest.bread === 'done' },
    { key: 'wren', system: "Wren's Silk (core)", what: 'done', apply() { quest.wren = 'done'; }, ok: () => quest.wren === 'done' },
    { key: 'dwarf', system: 'The King Under the Quarry (24-dwarves)', what: "the great forge relit, Brunhild trading, Deepholm on the map",
      present: () => !!QUEST_DEFS.dwarf,
      apply() { const q = qo('dwarf', () => ({ stage: 0, chests: [], visited: false })); q.stage = Math.max(q.stage || 0, 2); q.visited = true; if (!Array.isArray(q.chests)) q.chests = []; },
      ok: () => !!quest.dwarf && quest.dwarf.stage >= 2 && !!quest.dwarf.visited },
    { key: 'elves', system: "Leaves and Bridges, Lira's Twenty (25-elves)", what: "both done: Thessaly's loom open, Lira's arrows earned",
      present: () => !!QUEST_DEFS.elf_queen,
      apply() { const q = qo('elves', () => ({ stage: 0, hinted: false, targets: 0, liraDone: false, liraAsked: false })); q.stage = Math.max(q.stage || 0, 2); q.hinted = true; q.liraAsked = true; q.liraDone = true; q.targets = Math.max(q.targets || 0, 20); },
      ok: () => !!quest.elves && quest.elves.stage >= 2 && !!quest.elves.liraDone },
    { key: 'dragons', system: 'Dragon Dung (27-dragons)', what: "done: Dunstan's fireproof salve on you, his stall open",
      present: () => !!QUEST_DEFS.dragons,
      apply() { const q = qo('dragons', () => ({ stage: 0, dung: 0, salve: false, potatoes: 0, firstKill: false, shrine: false })); q.stage = Math.max(q.stage | 0, 2); q.salve = true; },
      ok: () => !!quest.dragons && quest.dragons.stage >= 2 && !!quest.dragons.salve },
    { key: 'sky', system: 'Song of Above (36-skycity) and the storm (66-storm)', what: "the Song sung, Halcyon's forge open, the storm broken so the shrine lifts straight to Aerie",
      present: () => !!QUEST_DEFS.sky,
      apply() { qo('sky', () => ({ stage: 0, wisps: 0, forged: 0 })).stage = 'done'; const st = qo('storm', () => ({ beaten: false, taught: false, bolts: 0, dodged: 0, hits: 0, kills: 0, birdHp: null })); st.beaten = true; st.taught = true; st.birdHp = null; },
      ok: () => !!quest.sky && quest.sky.stage === 'done' && !!quest.storm && !!quest.storm.beaten },
    { key: 'tinker', system: 'A Tinker Gone Wrong (33-goblincity, the city gate in 66-storm)', what: "done: Grubmarket's gate open, four friends made, the Gnasher's lever there for rematches",
      present: () => !!QUEST_DEFS.tinker,
      apply() { const q = qo('tinker', () => ({ stage: 0, parts: {}, visited: false, rematch: false, kills: 0, friends: 0, bundle: false })); q.stage = Math.max(q.stage || 0, 3); q.visited = true; q.parts = q.parts || {}; for (const id of PART_IDS) q.parts[id] = true; q.friends = PART_IDS.length; q.bundle = true; },
      ok: () => !!quest.tinker && quest.tinker.stage >= 3 && (!window.CITYGATE || CITYGATE.open()) },
    { key: 'gnash', system: 'Gold for Gnash (33-goblincity)', what: "done: the tribute paid, the castle guards friendly (his chest still yours to open once)",
      present: () => !!QUEST_DEFS.gnash,
      apply() { const q = qo('gnash', () => ({ stage: 0, tribute: false, treasury: false })); q.stage = Math.max(q.stage || 0, 1); q.tribute = true; },
      ok: () => !!quest.gnash && !!quest.gnash.tribute },
    { key: 'night', system: 'The crypt by the last knight (35-night)', what: 'the crypt door into the Afterlands open',
      present: () => !!(window.NIGHT && NIGHT.tiles && NIGHT.tiles.crypt !== undefined),
      apply() { const q = qo('night', () => ({ crypt: false, told: false })); q.crypt = true; q.told = true; if (tileAt(NIGHT_CRYPT.x, NIGHT_CRYPT.y) !== NIGHT.tiles.crypt) changeTile(NIGHT_CRYPT.x, NIGHT_CRYPT.y, NIGHT.tiles.crypt); },
      ok: () => !!quest.night && !!quest.night.crypt && tileAt(NIGHT_CRYPT.x, NIGHT_CRYPT.y) === NIGHT.tiles.crypt },
    { key: 'companion', system: 'Sera the ranger (21-companion)', what: 'freed from the goblin cage: she waits at the Barrel & Boar to join you',
      present: () => !!(window.FANGLANDS && FANGLANDS.companion),
      apply() { const c = FANGLANDS.companion.comp(); c.freed.sera = true; FANGLANDS.companion.syncHeroNpcs(); },
      ok: () => !!player.companion && !!player.companion.freed && !!player.companion.freed.sera },
    { key: 'law', system: 'The Watch (23-law)', what: 'at peace with Thistledown: nothing owed (it still works if you attack a guard)',
      present: () => !!QUEST_DEFS.law,
      apply() { player.law = { wanted: 0, timer: 0, fines: 0 }; },
      ok: () => !lawOwes() },
    { key: 'dozer', system: 'Bulldozer upgrades (40-dozerup)', what: 'all four blueprints owned and all four upgrades fitted',
      present: () => !!window.DOZERUP,
      apply() { player.dozerUp = player.dozerUp || {}; for (const u of DOZERUP.UPGRADES) player.dozerUp[u.id] = true; },
      ok: () => DOZERUP.UPGRADES.every(u => !!player.dozerUp[u.id]) && DOZERUP.missingBlueprints().length === 0 },
    { key: 'horse', system: 'Cinder the grey mare (51-mounts)', what: 'yours, rested, at the rail by Fennick (no coins taken)',
      present: () => !!window.MOUNTS,
      apply() { const h = MOUNTS.state; const had = !!h.owned; h.owned = true; h.hp = MOUNTS.HP; if (!had && !MOUNTS.riding()) MOUNTS.whistle(); },
      ok: () => !!MOUNTS.state.owned },
    { key: 'rebuild', system: 'Rebuilding Hollowford (31-rebuild)', what: 'all seven projects built by the board itself: sawmill, square, well, first house, chapel and bell, smithy, your house',
      present: () => typeof HOOKS.panel.rebuild === 'function',
      apply() { driveRebuild(); },
      ok: () => rebuilt() },
    { key: 'guild', system: 'The Hollowford Guild (41-guild)', what: 'Guildmaster: the chest, the cape and the staff (the hall founds itself the next frame, as it always does)',
      present: () => !!QUEST_DEFS.guild,
      apply() { const g = qo('guild', () => ({ founded: false, rank: 0, jobsDone: 0, cooldowns: {}, active: null, chest: new Array(20).fill(null), nudged: false })); g.rank = 4; g.jobsDone = Math.max(g.jobsDone || 0, 12); },
      ok: () => !!quest.guild && quest.guild.rank >= 4 },
    { key: 'house', system: 'A place of your own (63-house)', what: 'your island found, every arch destination unlocked',
      present: () => !!window.HOUSE,
      apply() { const h = HOUSE.state(); h.seen = true; for (const d of HOUSE.DESTS) h.been[d.key] = true; },
      ok: () => { const h = HOUSE.state(); return !!h.seen && HOUSE.DESTS.every(d => !!h.been[d.key]); } },
    { key: 'markers', system: 'Map markers (61-markers)', what: 'every place on the map known',
      present: () => !!window.MARKERS,
      apply() { seeAllMarkers(); S.followUp = 3; },
      ok: () => MARKERS.known().length === MARKERS.all().length },
  ];
  // a building the unlock put up (a house, the guild hall) never closes round the knight: he steps to the nearest free spot
  function unstick() {
    const who = typeof playerWho === 'function' ? playerWho() : 'player';
    if (!collides(player.x, player.y, player.r, who)) return false;
    const s = safeSpot(player.x, player.y, player.r, who); if (!s) return false;
    player.x = s.x; player.y = s.y; return true;
  }
  const present = u => { try { return !u.present || !!u.present(); } catch (e) { return false; } };
  const holds = u => { try { return !present(u) || !!u.ok(); } catch (e) { return false; } };
  // sets every entry; refuses inside an instance (a tile edit there would land on the instance, not the world)
  function unlockAll() {
    if (!isAdmin()) return false;
    if (inInstance()) { notify('Unlock everything works on the overworld. Leave this place first.'); return false; }
    const done = [], missing = [], failed = [];
    for (const u of UNLOCKS) {
      if (!present(u)) { missing.push(u.key); continue; }
      try { u.apply(); done.push(u.key); } catch (e) { failed.push(u.key + ': ' + (e && e.message)); console.error('admin unlock ' + u.key, e); }
    }
    player.hp = player.maxHp; unstick();
    return { done, missing, failed, holding: UNLOCKS.filter(holds).map(u => u.key) };
  }

  // ---------- C. the pinned backup, then Unlock everything; Put my knight back ----------
  const slotString = () => { try { return localStorage.getItem(title.slotKey(title.slot)); } catch (e) { return null; } };
  function pin() {
    if (!isAdmin()) return false;
    S.pinAskedAt = nowMs();
    when(api('GET', '/api/save/pin'), r => { S.pinAt = r && typeof r.at === 'number' ? r.at : null; }, () => { S.pinAt = null; });
    return true;
  }
  function unlockWithBackup() {
    if (!isAdmin() || S.busy) return false;
    if (inInstance()) { notify('Unlock everything works on the overworld. Leave this place first.'); return false; }
    save(); const raw = slotString();
    if (!raw) { notify('Could not make a backup, so nothing was changed.'); return false; }
    S.busy = 'pin';
    when(api('POST', '/api/save/pin', raw), r => {
      S.busy = null;
      if (!r || typeof r !== 'object' || (typeof r.pinned !== 'boolean' && typeof r.at !== 'number')) { notify('Could not make a backup, so nothing was changed.'); return; }
      if (typeof r.at === 'number') S.pinAt = r.at;
      const res = unlockAll();
      if (!res) return;
      save();
      levelBanner = { text: 'EVERYTHING UNLOCKED', sub: 'Put my knight back undoes it', t: 4 }; burst(player.x, player.y, GOLD, 40, 200); sfx('levelup');
      notify('Everything is unlocked. Put my knight back undoes it.');
    }, () => { S.busy = null; notify('Could not make a backup, so nothing was changed.'); });
    return true;
  }
  function putBack() {
    if (!isAdmin() || S.busy) return false;
    // a push already on its way could land after the restore; wait for it
    if (window.CLOUD && CLOUD.inflight) { notify('Your knight is still saving to the cloud. Try again in a moment.'); return false; }
    if (window.CLOUD) CLOUD.reset();
    S.busy = 'restore';
    when(api('POST', '/api/save/restore'), r => {
      S.busy = null;
      if (!r || typeof r.save !== 'string' || !r.save || !window.LOGIN || !LOGIN.reload(r.save, r.at)) { notify('That did not work. Try again.'); return; }
      S.pinAt = null; S.god = S.god && isAdmin(); S.view = null;
      notify('Your knight is back to how it was.');
    }, e => {
      S.busy = null;
      if (e && (e.code === 'nopin' || e.status === 404)) { S.pinAt = null; notify('There is no backup to go back to.'); }
      else notify('That did not work. Try again.');
    });
    return true;
  }

  // ---------- the one search box: a real <input> over the canvas (16 px so Safari does not zoom) ----------
  // Built on first use, only where there is a document body (tools/headless.js has none). It sits over whichever box
  // wants typing (the search, or the Give amount); it is hidden and blurred whenever the panel is not up.
  let dom = null, want = null;
  function ensureInput() {
    if (dom !== null) return dom;
    if (typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function' || typeof document.body.appendChild !== 'function') { dom = false; return dom; }
    try {
      const input = document.createElement('input');
      input.type = 'text'; input.id = 'admin-search'; input.autocomplete = 'off'; input.spellcheck = false; input.maxLength = 30;
      input.setAttribute('autocapitalize', 'none'); input.setAttribute('autocorrect', 'off'); input.setAttribute('enterkeyhint', 'done'); input.setAttribute('aria-label', 'Search');
      input.style.cssText = 'position:fixed;display:none;z-index:15;box-sizing:border-box;margin:0;padding:0 10px;font:16px "Trebuchet MS","Segoe UI",system-ui,sans-serif;color:#e6edf3;background:#0b0f14;border:1px solid #f5c542;border-radius:8px;outline:none;-webkit-appearance:none;appearance:none;';
      input.addEventListener('input', () => typed(input.value));
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); try { input.blur(); } catch (err) { } } });
      document.body.appendChild(input);
      dom = { input, shown: false, key: '', sig: '' };
    } catch (e) { dom = false; }
    return dom;
  }
  function typed(v) {
    if (S.inputMode === 'qty') { const digits = String(v).replace(/\D/g, '').slice(0, 7); S.qtyText = digits; S.qty = clamp(parseInt(digits || '0', 10) || 1, 1, QTY_MAX); if (dom && dom.input.value !== digits) dom.input.value = digits; }
    else { S.search = String(v).slice(0, 30); S.page.give = 0; S.page.monsters = 0; }
  }
  function hideInput() { if (!dom || !dom.shown) return; dom.shown = false; dom.key = ''; dom.sig = ''; try { dom.input.blur(); } catch (e) { } dom.input.style.display = 'none'; }
  function showInput(w) {
    const d = ensureInput(); if (!d) return;
    // while it has the keyboard, the box never hides under the iPad's on-screen keyboard: it rides just above it
    let top = w.y;
    const vv = window.visualViewport;
    if (vv && typeof vv.height === 'number' && document.activeElement === d.input) { const bottom = (vv.offsetTop || 0) + vv.height - 8; if (top + w.h > bottom) top = Math.max(8, bottom - w.h); }
    const k = [w.x, top, w.w, w.h].join(','), sig = w.mode + '|' + (w.placeholder || '');
    if (d.key !== k) { d.key = k; const s = d.input.style; s.left = Math.round(w.x) + 'px'; s.top = Math.round(top) + 'px'; s.width = Math.round(w.w) + 'px'; s.height = Math.round(w.h) + 'px'; }
    // a different box (the item search, the monster search, the amount): its own keyboard, words and text
    if (d.sig !== sig) { d.sig = sig; d.input.inputMode = w.mode === 'qty' ? 'numeric' : 'text'; d.input.placeholder = w.placeholder || ''; d.input.value = w.mode === 'qty' ? S.qtyText : S.search; }
    if (!d.shown) { d.shown = true; d.input.style.display = 'block'; }
  }
  function focusInput(mode) {
    if (S.inputMode !== mode) { S.inputMode = mode; if (mode === 'qty') S.qtyText = String(S.qty); }
    const d = ensureInput(); if (!d) return;
    d.sig = ''; d.input.value = mode === 'qty' ? S.qtyText : S.search;
    try { d.input.focus(); } catch (e) { }
  }
  // each list starts with an empty search: the item picker and the monster list do not share what was typed
  function freshSearch() { S.inputMode = 'search'; S.search = ''; S.page.give = 0; S.page.monsters = 0; if (dom) { dom.sig = ''; } }
  function setSearch(text) { S.inputMode = 'search'; S.search = String(text || '').slice(0, 30); S.page.give = 0; S.page.monsters = 0; if (dom) dom.input.value = S.search; }
  function setQty(n) { S.qty = clamp(Math.floor(+n || 1), 1, QTY_MAX); S.qtyText = String(S.qty); if (dom && S.inputMode === 'qty') dom.input.value = S.qtyText; }

  // ---------- drawing helpers ----------
  // a core button with a key for the harness (the drawn word stays, like 73's gift buttons); returns the rect
  function btn(g, x, y, w, h, text, action, color, enabled, key) {
    g.font = 'bold 13px sans-serif'; button(g, x, y, w, h, fit(g, text, w - 10), action, color || '#238636', enabled !== false);
    const b = buttons[buttons.length - 1]; if (key) b.label = (b.disabled ? 'disabled:' : '') + key; return b;
  }
  // lay a row of buttons left to right: fixed widths first, then 'fill' ones share what is left
  function row(g, x, y, w, h, specs) {
    const gap = 6, fixed = specs.reduce((a, s) => a + (s.w === 'fill' ? 0 : s.w), 0), fills = specs.filter(s => s.w === 'fill').length;
    const fillW = fills ? Math.max(44, (w - fixed - gap * (specs.length - 1)) / fills) : 0;
    let cx = x;
    for (const s of specs) { const bw = s.w === 'fill' ? fillW : s.w; if (s.draw) s.draw(cx, bw, y); else btn(g, cx, y, bw, h, s.text, s.action, s.color, s.enabled, s.key); cx += bw + gap; }
  }
  function textBox(g, x, y, w, h, mode, placeholder) {
    const active = S.inputMode === mode, text = mode === 'qty' ? commas(S.qty) : S.search;
    roundRect(g, x, y, w, h, 8); g.fillStyle = '#0b0f14'; g.fill(); g.strokeStyle = active ? GOLD : '#30363d'; g.lineWidth = 1; g.stroke();
    g.font = '15px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillStyle = text ? '#e6edf3' : '#6e7681'; g.fillText(fit(g, text || placeholder, w - 20), x + 10, y + h / 2); g.textBaseline = 'alphabetic';
    buttons.push({ x, y, w, h, label: 'admin:' + mode + 'box', action: () => focusInput(mode) });
    if (active) want = { x, y, w, h, mode, placeholder };
  }
  function note(g, text, x, y, maxW, color) { g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillStyle = color || '#8b949e'; g.fillText(fit(g, text, maxW), x, y); }
  // pages of rows by height: everything on one page when it fits, else pages that leave room for the pager
  function paginate(items, heightOf, availH, pagerH) {
    const total = items.reduce((a, it) => a + heightOf(it), 0);
    if (total <= availH) return [items];
    const pages = []; let cur = [], used = 0; const room = Math.max(1, availH - pagerH);
    for (const it of items) { const h = heightOf(it); if (cur.length && used + h > room) { pages.push(cur); cur = []; used = 0; } cur.push(it); used += h; }
    if (cur.length) pages.push(cur);
    return pages;
  }
  function pagerRow(g, x, y, w, T, which, pages) {
    const p = clamp(S.page[which], 0, pages - 1);
    btn(g, x, y, 90, T, 'Prev', () => { S.page[which] = Math.max(0, p - 1); }, '#21262d', p > 0, 'admin:' + which + ':prev');
    g.fillStyle = '#8b949e'; g.font = '12px sans-serif'; g.textAlign = 'center'; g.fillText(`${p + 1} / ${pages}`, x + w / 2, y + T / 2 + 4);
    btn(g, x + w - 90, y, 90, T, 'Next', () => { S.page[which] = Math.min(pages - 1, p + 1); }, '#21262d', p < pages - 1, 'admin:' + which + ':next');
  }
  const adminPill = (g, x, y, size) => window.PLAYERS && PLAYERS.adminPill ? PLAYERS.adminPill(g, x, y, size) : 0;
  const whereOf = o => (!o.map || o.map === 'over') ? (o.region || 'The Fanglands') : (((window.INSTANCES && INSTANCES.get && INSTANCES.get(o.map)) || {}).name || o.region || String(o.map));

  // ---------- A. the chip ----------
  // beside 73's ONLINE chip on the same row, gold, 44 px square-ish on touch; hidden under any panel (like the online chip is under other files')
  HOOKS.hud.push(g => {
    if (!isAdmin() || paused || panel) return;
    const on = buttons.find(b => /^(ONLINE|OFFLINE)/.test(b.label)), touchy = touchMode();
    const h = touchy ? 44 : (on ? on.h : 26), w = touchy ? 76 : 70;
    const x = on ? on.x + on.w + 8 : 14, y = on ? on.y : Math.max(HUD.leftY, 84);
    roundRect(g, x, y, w, h, 8); g.fillStyle = GOLD; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = INK; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ADMIN', x + w / 2, y + h / 2 + 0.5); g.textBaseline = 'alphabetic';
    buttons.push({ x, y, w, h, label: 'ADMIN', action: () => { if (panel === 'admin') closePanel(); else open(); } });
    HUD.leftY = Math.max(HUD.leftY, y + h + 6);
  });

  // ---------- the panel ----------
  function onTab(tab) {
    if (tab === 'knights') askModlist();
    if (tab === 'powers' && (S.pinAt === undefined || nowMs() - S.pinAskedAt > 30000)) pin();
  }
  function open(tab) {
    if (!isAdmin()) return false;
    if (tab && TABS.some(t => t[0] === tab)) S.tab = tab;
    S.view = null; freshSearch();
    openPanel('admin'); onTab(S.tab);
    return true;
  }
  HOOKS.panel.admin = (g, narrow) => {
    if (!isAdmin()) { closePanel(); return; }
    const touchy = touchMode(), T = touchy ? 44 : 32;
    const { px, py, w, h } = panelBox(g, narrow ? VW - 20 : Math.min(660, VW - 20), Math.min(VH - 20, 660), 'Admin', '');
    if (touchy) { buttons.pop(); button(g, px + w - 56, py + 10, 44, 44, '×', closePanel, '#21262d'); }
    g.fillStyle = '#8b949e'; g.font = '12px sans-serif'; g.textAlign = 'left'; const subW = w - 36 - 60; g.fillText(fit(g, g.measureText(SUBTITLE[S.tab]).width <= subW ? SUBTITLE[S.tab] : SUBTITLE_SHORT[S.tab], subW), px + 18, py + 50);
    const tabW = (w - 36 - 3 * 6) / 4;
    TABS.forEach(([id, name], i) => btn(g, px + 18 + i * (tabW + 6), py + 60, tabW, T, name, () => { if (S.tab !== id) { S.tab = id; S.view = null; freshSearch(); onTab(id); } }, S.tab === id ? '#7a5a12' : '#21262d', true, 'admin:tab:' + id));
    const x = px + 18, y = py + 60 + T + 10, cw = w - 36, ch = py + h - 12 - y;
    if (S.tab === 'knights') { if (S.view && S.view.kind === 'mute') drawMuteChooser(g, x, y, cw, ch, T); else drawKnights(g, x, y, cw, ch, T); }
    else if (S.tab === 'powers') { if (S.view && S.view.kind === 'give') drawGive(g, x, y, cw, ch, T); else drawPowers(g, x, y, cw, ch, T); }
    else if (S.tab === 'monsters') drawMonsters(g, x, y, cw, ch, T);
    else drawParty(g, x, y, cw, ch, T);
  };

  // ---------- B. the Knights tab ----------
  function knightRows() {
    const out = [], meN = NET.me;
    const online = (window.PLAYERS ? PLAYERS.online : []).filter(o => o && typeof o.n === 'string' && o.n !== meN);
    for (const o of online) out.push({ kind: 'k', o });
    const L = S.modlist;
    if (L && L.muted.length) { out.push({ kind: 'h', text: `Muted (${L.muted.length})` }); for (const m of L.muted) out.push({ kind: 'm', n: m.n }); }
    if (L && L.banned.length) { out.push({ kind: 'h', text: `Banned (${L.banned.length})` }); for (const b of L.banned) out.push({ kind: 'b', n: b.n }); }
    return out;
  }
  function drawKnights(g, x, y, w, h, T) {
    const items = knightRows(), wide = w >= 520;
    const RH = wide ? T + 14 : T + 52, HH = 26;
    if (!items.some(it => it.kind === 'k')) note(g, NET.me ? 'Nobody else is online right now.' : 'You are not connected.', x, y + 16, w);
    const top = items.some(it => it.kind === 'k') ? y : y + 26;
    // an admin's row has no buttons, so on a phone it needs no second line of them
    const heightOf = it => it.kind === 'h' ? HH : (!wide && it.kind === 'k' && it.o.role === 'admin') ? 52 : RH;
    const pages = paginate(items, heightOf, y + h - top, T + 10);
    S.page.knights = clamp(S.page.knights, 0, pages.length - 1);
    let yy = top;
    for (const it of pages[S.page.knights]) {
      if (it.kind === 'h') { g.fillStyle = GOLD; g.font = 'bold 12px sans-serif'; g.textAlign = 'left'; g.fillText(it.text.toUpperCase(), x, yy + 18); yy += HH; continue; }
      const ih = heightOf(it); knightRow(g, it, x, yy, w, ih - 6, T, wide); yy += ih;
    }
    if (pages.length > 1) pagerRow(g, x, y + h - T, w, T, 'knights', pages.length);
  }
  function knightRow(g, it, x, y, w, rh, T, wide) {
    const n = it.kind === 'k' ? it.o.n : it.n, admin = it.kind === 'k' && it.o.role === 'admin', left = muteLeft(n);
    roundRect(g, x, y, w, rh, 8); g.fillStyle = admin ? 'rgba(245,197,66,0.08)' : 'rgba(255,255,255,0.05)'; g.fill();
    // the buttons this row gets (none for an admin), right-aligned in one row when wide, under the name when narrow
    const specs = [];
    const kickKey = 'admin:kick:' + n, banKey = 'admin:ban:' + n, armK = confirmActive(kickKey), armB = confirmActive(banKey);
    if (it.kind === 'k' && !admin) {
      if (left) specs.push({ text: 'Unmute', w: wide ? 92 : 'fill', action: () => unmute(n), color: '#1f4e78', key: 'admin:unmute:' + n });
      else specs.push({ text: 'Mute', w: wide ? 80 : 'fill', action: () => { S.view = { kind: 'mute', n }; }, color: '#1f4e78', key: 'admin:mute:' + n });
      specs.push({ text: armK ? 'Tap again' : 'Kick', w: wide ? 96 : 'fill', action: () => confirmTap(kickKey, () => kick(n)), color: armK ? '#c0392b' : '#6b4f2a', key: kickKey });
      specs.push({ text: armB ? 'Tap again' : 'Ban', w: wide ? 96 : 'fill', action: () => confirmTap(banKey, () => ban(n)), color: armB ? '#c0392b' : '#8b2e2e', key: banKey });
    } else if (it.kind === 'm') specs.push({ text: 'Unmute', w: wide ? 92 : 'fill', action: () => unmute(n), color: '#1f4e78', key: 'admin:unmute:' + n });
    else if (it.kind === 'b') specs.push({ text: 'Unban', w: wide ? 92 : 'fill', action: () => unban(n), color: '#238636', key: 'admin:unban:' + n });
    const bw = wide ? specs.reduce((a, s) => a + s.w, 0) + 6 * Math.max(0, specs.length - 1) : 0;
    const textW = wide ? w - 24 - bw - (admin ? 70 : 0) : w - 24;
    // line 1: the name (gold with the pill for an admin), the level; line 2 (or after the level when narrow): where, or the mute
    g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.fillStyle = admin ? GOLD : '#e6edf3';
    const name = fit(g, n, Math.max(40, textW - (admin ? 60 : 0) - 40)); const ty = wide ? y + rh / 2 - 3 : y + 18;
    g.fillText(name, x + 12, ty);
    let cx = x + 12 + g.measureText(name).width + 6;
    if (admin) cx += adminPill(g, cx, ty - 4, 9) + 6;
    if (it.kind === 'k') { g.font = '11px sans-serif'; g.fillStyle = '#9aa3b2'; g.fillText('lv ' + (it.o.lv || 1), cx, ty); }
    const sub = it.kind === 'b' ? 'Banned' : left ? 'Muted, ' + leftWords(left) : whereOf(it.o);
    note(g, sub, x + 12, wide ? ty + 16 : y + 34, textW, left ? '#ff9b8f' : it.kind === 'b' ? '#f85149' : '#8b949e');
    if (admin) { g.font = 'bold 12px sans-serif'; g.fillStyle = GOLD; g.textAlign = 'right'; g.fillText('Admin', x + w - 12, ty); return; }
    if (!specs.length) return;
    if (wide) row(g, x + w - 8 - bw, y + (rh - T) / 2, bw, T, specs);
    else row(g, x + 8, y + 40, w - 16, T, specs);
  }
  function drawMuteChooser(g, x, y, w, h, T) {
    const n = S.view.n;
    g.fillStyle = '#e6edf3'; g.font = 'bold 15px sans-serif'; g.textAlign = 'left'; g.fillText(fit(g, `Mute ${n} for how long?`, w), x, y + 18);
    note(g, 'They can still play. Only their chat is off.', x, y + 38, w);
    const cols = w >= 420 ? 2 : 1, bw = (w - (cols - 1) * 8) / cols;
    SPANS.forEach(([span, words], i) => {
      const bx = x + (i % cols) * (bw + 8), by = y + 52 + Math.floor(i / cols) * (T + 8);
      btn(g, bx, by, bw, T, words, () => { if (mute(n, span)) S.view = null; }, '#1f4e78', true, 'admin:span:' + span);
    });
    const rows = Math.ceil(SPANS.length / cols);
    btn(g, x, y + 52 + rows * (T + 8) + 6, Math.min(160, w), T, 'Back', () => { S.view = null; }, '#21262d', true, 'admin:span:back');
  }

  // ---------- C. the Powers tab ----------
  function drawPowers(g, x, y, w, h, T) {
    const armU = confirmActive('admin:unlock'), armR = confirmActive('admin:putback'), hasPin = typeof S.pinAt === 'number';
    const entries = [
      { key: 'admin:unlock', text: S.busy === 'pin' ? 'Saving a backup…' : armU ? 'Tap again to unlock' : 'Unlock everything', color: armU ? '#c0392b' : '#7a5a12', enabled: !S.busy && !inInstance(),
        action: () => { if (confirmTap('admin:unlock', unlockWithBackup)) return; notify('This saves a backup of your knight first. Tap again to unlock everything.'); },
        line: inInstance() ? 'Unlock everything works on the overworld.' : armU ? 'This saves a backup of your knight first. Tap again to unlock everything.' : 'Every skill 99, every quest done, every gate open.' },
      { key: 'admin:putback', text: S.busy === 'restore' ? 'Bringing it back…' : armR ? 'Tap again to put it back' : 'Put my knight back', color: armR ? '#c0392b' : '#1f4e78', enabled: hasPin && !S.busy,
        action: () => { if (confirmTap('admin:putback', putBack)) return; notify('Your knight goes back to the backup. Tap again to do it.'); },
        line: hasPin ? `Back to the backup from ${clock(S.pinAt)}.` : S.pinAt === null ? 'No backup yet. Unlock everything makes one.' : 'Looking for a backup…' },
      { key: 'admin:god', text: "Can't be hurt: " + (S.god ? 'On' : 'Off'), color: S.god ? '#238636' : '#21262d', enabled: true,
        action: () => setGod(!S.god), line: 'Just for now. It turns off when you log out.' },
      { key: 'admin:teleport', text: 'Teleport', color: '#21262d', enabled: !inInstance(), action: startTeleport, line: inInstance() ? 'Teleport works on the overworld.' : 'Tap a place on the world map to go there.' },
      { key: 'admin:give', text: 'Give me an item', color: '#21262d', enabled: true, action: () => { S.view = { kind: 'give' }; freshSearch(); }, line: 'Anything in the game, as many as you like.' },
    ];
    const withLines = T + 26, bare = T + 8;
    let cols = 1, rowH = withLines;
    if (entries.length * withLines > h) { cols = w >= 480 ? 2 : 1; if (Math.ceil(entries.length / cols) * withLines > h) rowH = bare; }
    const colW = (w - (cols - 1) * 10) / cols;
    entries.forEach((e, i) => {
      const cx = x + (i % cols) * (colW + 10), cy = y + Math.floor(i / cols) * rowH;
      btn(g, cx, cy, colW, T, e.text, e.action, e.color, e.enabled, e.key);
      if (rowH === withLines) note(g, e.line, cx + 2, cy + T + 16, colW - 4);
    });
  }
  // the item picker: search, a page of items, how many, Give
  const itemList = () => { const q = S.search.trim().toLowerCase(); return Object.keys(ITEMS).filter(id => ITEMS[id] && ITEMS[id].name && (!q || ITEMS[id].name.toLowerCase().includes(q) || id.includes(q))).sort((a, b) => ITEMS[a].name.localeCompare(ITEMS[b].name)); };
  function drawGive(g, x, y, w, h, T) {
    const wide = w >= 520, list = itemList();
    // row 1: Back, the search box, Prev / Next
    const barH = wide ? 18 + T + 4 : 18 + 2 * T + 12;
    const listY = y + T + 8, listH = y + h - barH - 8 - listY;
    const cols = Math.max(1, Math.floor((w + 6) / (wide ? 186 : 160))), cellW = (w - (cols - 1) * 6) / cols, rows = Math.max(1, Math.floor((listH + 4) / (T + 4))), per = cols * rows;
    const pages = Math.max(1, Math.ceil(list.length / per)); S.page.give = clamp(S.page.give, 0, pages - 1);
    row(g, x, y, w, T, [
      { text: 'Back', w: 70, action: () => { S.view = null; freshSearch(); }, color: '#21262d', key: 'admin:back' },
      { w: 'fill', draw: (bx, bw, ry) => textBox(g, bx, ry, bw, T, 'search', 'Search for an item') },
      { text: 'Prev', w: 64, action: () => { S.page.give = Math.max(0, S.page.give - 1); }, color: '#21262d', enabled: S.page.give > 0, key: 'admin:give:prev' },
      { text: 'Next', w: 64, action: () => { S.page.give = Math.min(pages - 1, S.page.give + 1); }, color: '#21262d', enabled: S.page.give < pages - 1, key: 'admin:give:next' },
    ]);
    const shown = list.slice(S.page.give * per, S.page.give * per + per);
    if (!shown.length) note(g, S.search ? `Nothing called "${S.search}".` : 'No items.', x, listY + 18, w);
    shown.forEach((id, i) => {
      const cx = x + (i % cols) * (cellW + 6), cy = listY + Math.floor(i / cols) * (T + 4), sel = S.item === id, def = ITEMS[id];
      roundRect(g, cx, cy, cellW, T, 8); g.fillStyle = sel ? 'rgba(245,197,66,0.16)' : 'rgba(255,255,255,0.05)'; g.fill();
      if (sel) { g.strokeStyle = GOLD; g.lineWidth = 1.5; g.stroke(); }
      const icon = Math.min(T - 12, 24); drawItemIcon(g, id, cx + 8 + icon / 2, cy + T / 2, icon);
      g.font = 'bold 12px sans-serif'; g.textAlign = 'left'; g.fillStyle = sel ? GOLD : '#e6edf3'; g.fillText(fit(g, def.name, cellW - icon - 22), cx + icon + 14, cy + T / 2 + 4);
      buttons.push({ x: cx, y: cy, w: cellW, h: T, label: 'admin:item:' + id, action: () => { S.item = id; } });
    });
    if (pages > 1) { g.fillStyle = '#6e7681'; g.font = '11px sans-serif'; g.textAlign = 'right'; g.fillText(`page ${S.page.give + 1} of ${pages} · ${list.length} items`, x + w, listY + listH + 2); }
    // the bar: what is picked, how many, Give
    const by = y + h - barH;
    note(g, S.item ? `${ITEMS[S.item].name} × ${commas(S.qty)}` : 'Tap an item, pick how many, then Give.', x, by + 13, w, S.item ? '#e6edf3' : '#8b949e');
    const quick = [1, 10, 100, 1000].map(n => ({ text: commas(n), w: wide ? 62 : 'fill', action: () => setQty(n), color: S.qty === n ? '#7a5a12' : '#21262d', key: 'admin:qty:' + n }));
    const box = { w: wide ? 120 : 'fill', draw: (bx, bw, ry) => textBox(g, bx, ry, bw, T, 'qty', 'How many') };
    const giveBtn = { text: 'Give', w: wide ? 'fill' : 110, action: () => { if (S.item) give(S.item, S.qty); else notify('Tap an item first.'); }, color: '#238636', enabled: !!S.item, key: 'admin:giveitem' };
    if (wide) row(g, x, by + 18, w, T, quick.concat([box, giveBtn]));
    else { row(g, x, by + 18, w, T, quick); box.w = 'fill'; row(g, x, by + 18 + T + 8, w, T, [box, giveBtn]); }
  }

  // ---------- D. the Monsters tab ----------
  // a monster's name as the list shows it: two kinds that share a name are told apart in plain words
  function monName(type) {
    const d = MONSTER_DEFS[type], name = String((d && d.name) || type);
    const twins = Object.keys(MONSTER_DEFS).filter(t => t !== type && MONSTER_DEFS[t] && MONSTER_DEFS[t].name === d.name);
    if (!twins.length) return name;
    if (d.woman) return name + ' (woman)';
    if (!d.aggro && twins.some(t => MONSTER_DEFS[t].aggro)) return name + ' (calm)';
    if (twins.some(t => MONSTER_DEFS[t].woman || (!MONSTER_DEFS[t].aggro && d.aggro))) return name;
    return name + ' (' + type.replace(/_/g, ' ') + ')';
  }
  const monList = () => { const q = S.search.trim().toLowerCase(); return Object.keys(MONSTER_DEFS).filter(t => { const d = MONSTER_DEFS[t]; return d && (!q || monName(t).toLowerCase().includes(q) || t.includes(q)); }).sort((a, b) => (MONSTER_DEFS[a].level || 0) - (MONSTER_DEFS[b].level || 0) || String(MONSTER_DEFS[a].name).localeCompare(String(MONSTER_DEFS[b].name))); };
  // a portrait the way 44-wiki draws one: the game's own sprite, face-on and still, fitted in a box
  function portrait(g, type, x, y, size) {
    roundRect(g, x, y, size, size, 6); g.fillStyle = 'rgba(126,200,255,0.06)'; g.fill();
    const def = MONSTER_DEFS[type]; if (!def) return;
    g.save(); g.beginPath(); g.rect(x, y, size, size); g.clip();
    try {
      const r = def.r || 13, scale = Math.min(1.4, (size * 0.8) / (2.2 * Math.max(9, r)));
      g.translate(x + size / 2, y + size / 2 + r * scale * 0.2); g.scale(scale, scale);
      drawCharacter(g, { x: 0, y: 0, r, facing: { x: 0, y: 1 }, hurtT: 0, attackT: 0, moving: false, walkT: 0, hp: def.hp, maxHp: def.hp, type, stunT: 0 }, type);
    } catch (e) { /* a sprite that wants state a portrait does not have: the box stays empty */ }
    g.restore();
  }
  function drawMonsters(g, x, y, w, h, T) {
    const wide = w >= 560, list = monList();
    if (S.monType && !MONSTER_DEFS[S.monType]) S.monType = null;
    const barH = wide ? 18 + T + 4 : 18 + 3 * T + 20;
    const listY = y + T + 8, listH = y + h - barH - 8 - listY;
    const cellH = T + 4, cols = Math.max(1, Math.floor((w + 6) / (wide ? 186 : 160))), cellW = (w - (cols - 1) * 6) / cols, rows = Math.max(1, Math.floor((listH + 4) / (cellH + 4))), per = cols * rows;
    const pages = Math.max(1, Math.ceil(list.length / per)); S.page.monsters = clamp(S.page.monsters, 0, pages - 1);
    row(g, x, y, w, T, [
      { w: 'fill', draw: (bx, bw, ry) => textBox(g, bx, ry, bw, T, 'search', 'Search for a monster') },
      { text: 'Prev', w: 64, action: () => { S.page.monsters = Math.max(0, S.page.monsters - 1); }, color: '#21262d', enabled: S.page.monsters > 0, key: 'admin:monsters:prev' },
      { text: 'Next', w: 64, action: () => { S.page.monsters = Math.min(pages - 1, S.page.monsters + 1); }, color: '#21262d', enabled: S.page.monsters < pages - 1, key: 'admin:monsters:next' },
    ]);
    const shown = list.slice(S.page.monsters * per, S.page.monsters * per + per);
    if (!shown.length) note(g, `Nothing called "${S.search}".`, x, listY + 18, w);
    shown.forEach((type, i) => {
      const cx = x + (i % cols) * (cellW + 6), cy = listY + Math.floor(i / cols) * (cellH + 4), sel = S.monType === type, def = MONSTER_DEFS[type];
      roundRect(g, cx, cy, cellW, cellH, 8); g.fillStyle = sel ? 'rgba(245,197,66,0.16)' : 'rgba(255,255,255,0.05)'; g.fill();
      if (sel) { g.strokeStyle = GOLD; g.lineWidth = 1.5; g.stroke(); }
      const ps = cellH - 6; portrait(g, type, cx + 3, cy + 3, ps);
      g.font = 'bold 12px sans-serif'; g.textAlign = 'left'; g.fillStyle = sel ? GOLD : '#e6edf3'; g.fillText(fit(g, monName(type), cellW - ps - 14), cx + ps + 9, cy + cellH / 2 - 1);
      g.font = '11px sans-serif'; g.fillStyle = '#8b949e'; g.fillText('Level ' + (def.level || 1), cx + ps + 9, cy + cellH / 2 + 13);
      buttons.push({ x: cx, y: cy, w: cellW, h: cellH, label: 'admin:mon:' + type, action: () => { S.monType = type; } });
    });
    if (pages > 1) { g.fillStyle = '#6e7681'; g.font = '11px sans-serif'; g.textAlign = 'right'; g.fillText(`page ${S.page.monsters + 1} of ${pages}`, x + w, listY + listH + 2); }
    const by = y + h - barH, def = S.monType && MONSTER_DEFS[S.monType];
    note(g, def ? `${monName(S.monType)} × ${S.count}, around you` : 'Tap a monster, pick how many, then Spawn.', x, by + 13, w, def ? '#e6edf3' : '#8b949e');
    const step = [
      { text: '−', w: 44, action: () => { S.count = Math.max(1, S.count - 1); }, color: '#21262d', enabled: S.count > 1, key: 'admin:count:-' },
      { w: 54, draw: (bx, bw, ry) => { roundRect(g, bx, ry, bw, T, 8); g.fillStyle = '#0b0f14'; g.fill(); g.fillStyle = '#e6edf3'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.fillText(String(S.count), bx + bw / 2, ry + T / 2 + 5); } },
      { text: '+', w: 44, action: () => { S.count = Math.min(COUNT_MAX, S.count + 1); }, color: '#21262d', enabled: S.count < COUNT_MAX, key: 'admin:count:+' },
    ];
    const quick = [1, 5, 10, 20].map(n => ({ text: String(n), w: wide ? 44 : 'fill', action: () => { S.count = n; }, color: S.count === n ? '#7a5a12' : '#21262d', key: 'admin:count:' + n }));
    const go = { text: 'Spawn', w: wide ? 84 : 'fill', action: () => { if (S.monType) spawn(S.monType, S.count); else notify('Tap a monster first.'); }, color: '#238636', enabled: !!S.monType, key: 'admin:spawn' };
    const clear = { text: 'Clear spawns', w: wide ? 'fill' : 'fill', action: clearSpawns, color: '#8b2e2e', key: 'admin:clear' };
    if (wide) row(g, x, by + 18, w, T, step.concat(quick, [go, clear]));
    else { row(g, x, by + 18, w, T, step.concat([go])); row(g, x, by + 18 + T + 8, w, T, quick); row(g, x, by + 18 + 2 * (T + 8), w, T, [clear]); }
  }

  // ---------- E. the Party tab: 77-dropparty's panel ----------
  function drawParty(g, x, y, w, h, T) {
    const there = typeof HOOKS.panel.party === 'function';
    btn(g, x, y, Math.min(w, 320), T, there ? 'Drop party' : 'Drop party is not in this build.', () => { if (typeof HOOKS.panel.party === 'function') openPanel('party'); }, '#7a5a12', there, 'admin:party');
    note(g, there ? 'Pick the prizes, then crackers fall on the ground around you. Anyone can light one.' : 'The drop party file is not part of this game yet.', x, y + T + 20, w);
  }

  // ---------- wraps: the last tap, the Teleport button over the world map, the search box, closing ----------
  { const _pointerDown = pointerDown; pointerDown = function (x, y, id) { S.pointer = { x, y }; return _pointerDown(x, y, id); }; }
  function drawTeleport(g) {
    let img = buttons.find(b => b.label === 'mapimage');
    if (!img) { const r = panelRect; if (!r) return; const iw = r.w - 36; img = { x: r.x + 18, y: r.y + 62, w: iw, h: Math.min(r.h - 80, iw * MAP_H / MAP_W) }; }
    S.mapImg = { x: img.x, y: img.y, w: img.w, h: img.h };
    const text = 'Tap where you want to go.';
    g.font = 'bold 13px sans-serif'; const tw = g.measureText(text).width + 24;
    roundRect(g, img.x + 8, img.y + 8, tw, 28, 8); g.fillStyle = 'rgba(8,11,17,0.9)'; g.fill(); g.strokeStyle = GOLD; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = GOLD; g.textAlign = 'left'; g.fillText(text, img.x + 20, img.y + 27);
    buttons.push({ x: img.x, y: img.y, w: img.w, h: img.h, label: 'admin:teleport:map', action: teleportAtPointer });
  }
  { const _drawPanels = drawPanels;
    drawPanels = function (g, narrow, short, qh, hb) {
      want = null; S.panelFrom = buttons.length;
      const r = _drawPanels(g, narrow, short, qh, hb);
      if (panel === 'map' && S.teleport) drawTeleport(g);
      if (panel === 'admin' && want && !paused) showInput(want); else hideInput();
      return r;
    }; }
  { const _closePanel = closePanel; closePanel = function () { const r = _closePanel(); S.teleport = false; hideInput(); return r; }; }

  // ---------- every frame ----------
  HOOKS.update.push(dt => {
    if (!isAdmin()) { if (S.god || S.teleport || S.view || panel === 'admin' || (dom && dom.shown)) off('lost'); }
    else {
      if (S.god) { if (player.hp < player.maxHp) player.hp = player.maxHp; const mech = player.mech; if (mech && mech.maxHp > 0 && mech.hp < mech.maxHp) mech.hp = mech.maxHp; }
      if (panel === 'admin' && S.tab === 'knights' && nowMs() - S.modlistAskedAt >= MODLIST_EVERY) askModlist();
    }
    if (S.teleport && panel !== 'map') S.teleport = false;
    spawnUpkeep();
    if (S.followUp > 0 && --S.followUp === 0) { seeAllMarkers(); unstick(); save(); }
  });

  const ADMIN = {
    is: isAdmin, open, unlockAll, unlockWithBackup, putBack, pin, get pinAt() { return S.pinAt; },
    get god() { return S.god; }, setGod, teleportTo, startTeleport, give, spawn, clearSpawns,
    mute, unmute, kick, ban, unban, askModlist, get modlist() { return S.modlist; },
    isSpawn, SPAWN_LIVE_MAX, UNLOCKS, modSentence, plural, amount, monName, setSearch, setQty, state: S,
  };
  window.ADMIN = ADMIN;

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'admin: ';
    if (inInstance()) INSTANCES.leave();
    const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, String(v)); } catch (e) { } };
    if (!title.active) save();
    const MARK = window.LOGIN ? LOGIN.MARK_KEY : 'fanglands.slot.1.online';
    const KEYS = []; for (let n = 1; n <= 3; n++) KEYS.push(title.slotKey(n), title.slotKey(n) + '.at');
    KEYS.push('fanglands.slot.current', MARK, SAVE_KEY);
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, touch: window.__forceTouch, peace: window.__peace, slot: title.slot, titleActive: title.active, ls: KEYS.map(k => [k, lsGet(k)]),
      notice, paused, playing: window.LOGIN ? LOGIN.playing : false, cur: dialog.cur, queue: dialog.queue.slice(), banner: levelBanner, vw: window.innerWidth, vh: window.innerHeight };
    // a small world that answers on the spot: a pin store, a restore, and a socket that welcomes MudGoll with whatever role the test says
    let sock = null, role = 'admin';
    const sent = [], calls = [], order = [];
    const world = {
      pinFails: false, pinned: null, pinBodies: [],
      call(method, path, body) {
        calls.push(method + ' ' + path);
        const fail = (code, status) => { const e = new Error(code); e.code = code; e.status = status; throw e; };
        if (path === '/api/save/pin' && method === 'GET') return world.pinned ? { at: 1111, bytes: world.pinned.length } : { at: null, bytes: 0 };
        if (path === '/api/save/pin') { world.pinBodies.push(body); if (world.pinFails) fail('down', 0); if (!world.pinned) world.pinned = body; return { at: 1111, pinned: true }; }
        if (path === '/api/save/restore') { order.push('restore'); if (!world.pinned) fail('nopin', 404); const s = world.pinned; world.pinned = null; return { save: s, at: 2222, ver: 4 }; }
        return {};
      },
      open() { const s = { readyState: 1, send(str) { const m = JSON.parse(str); sent.push(m); if (m.t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'MudGoll', at: 1, keeper: 'MudGoll', role }) }); }, close() { s.readyState = 3; } }; sock = s; return s; },
    };
    const feed = m => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(m) }); };
    const connect = r => { role = r; NET.disconnect(); NET.token = 'admin-test'; NET.connect(); };
    const refill = () => { for (const k in bucket) delete bucket[k]; };
    const of = t => sent.filter(m => m.t === t);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const slot = () => lsGet(title.slotKey(title.slot));
    // a canvas that remembers what was written
    const rec = [], st = {};
    const g2 = new Proxy(st, { get: (t, k) => k === 'measureText' ? (s => ({ width: String(s).length * 6 })) : k === 'fillText' ? ((s) => { rec.push(String(s)); }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: () => { } }) : (k in st ? st[k] : () => { }), set: (t, k, v) => { st[k] = v; return true; } });
    const _reset = window.CLOUD ? CLOUD.reset : null;
    try {
      NET.enabled = true; NET.useFake(world); dialog.cur = null; dialog.queue.length = 0; closePanel(); paused = false; h.peace(true); refill();
      { const o = h.openSpot(58, 32); F.tp(o.x, o.y); }

      // ---- the chip and the panel are an admin's only; a demotion or a lost line takes them away ----
      { connect('player'); closePanel(); render();
        const noChip = !buttons.some(b => b.label === 'ADMIN'), noOpen = open() === false; openPanel('admin'); render(); const shut = panel !== 'admin';
        connect('admin'); closePanel(); render(); const chip = buttons.find(b => b.label === 'ADMIN'); if (chip) chip.action(); render();
        const opened = panel === 'admin' && isAdmin(); openPanel('inventory'); render(); const hidden = !buttons.some(b => b.label === 'ADMIN'); closePanel();
        open('powers'); setGod(true); const on = S.god;
        feed({ t: 'role', role: 'player' }); const demoted = panel !== 'admin' && !S.god && !isAdmin() && !!notice && notice.text === 'You are not an admin any more.';
        feed({ t: 'role', role: 'admin' }); const promoted = isAdmin() && !S.god;
        open('powers'); setGod(true); sock.onclose({ code: 1006 }); const lost = panel !== 'admin' && !S.god && !isAdmin();
        connect('admin');
        check(P + 'the gold ADMIN chip and the Admin panel are there only for role admin (never for a player, hidden under other panels); a demotion or a lost connection closes the panel and turns Can\'t be hurt off', noChip && noOpen && shut && !!chip && opened && hidden && on && demoted && promoted && lost && isAdmin(), { noChip, noOpen, shut, chip: !!chip, opened, hidden, on, demoted, promoted, lost }); }

      // ---- Knights: each button sends the contract's message; the lists; the answers in plain words ----
      { feed({ t: 'who', list: [{ n: 'MudGoll', map: 'over', region: 'Thistledown', lv: 99, role: 'admin' }, { n: 'Sam', map: 'over', region: 'Wolfwood', lv: 12, role: 'player' }, { n: 'Ada', map: 'over', region: 'Hollowford', lv: 30, role: 'admin' }] });
        refill(); sent.length = 0; closePanel(); render(); F.clickButton('ADMIN'); F.clickButton('admin:tab:knights'); render();
        const asked = of('modlist').length === 1;
        const samRow = ['admin:mute:Sam', 'admin:kick:Sam', 'admin:ban:Sam'].every(k => buttons.some(b => b.label === k)), adaBare = !buttons.some(b => /^admin:(mute|unmute|kick|ban):Ada/.test(b.label)) && !buttons.some(b => /:MudGoll$/.test(b.label));
        const spans = SPANS.map(([span]) => { refill(); F.clickButton('admin:mute:Sam'); const chooser = !!S.view && S.view.kind === 'mute'; F.clickButton('admin:span:' + span); return chooser && !S.view && same(of('mute').pop(), { t: 'mute', n: 'Sam', span }); });
        refill(); const k0 = of('kick').length; F.clickButton('admin:kick:Sam'); const armed = of('kick').length === k0 && confirmActive('admin:kick:Sam'); F.clickButton('admin:kick:Sam'); const kicked = of('kick').length === k0 + 1 && same(of('kick').pop(), { t: 'kick', n: 'Sam' });
        refill(); F.clickButton('admin:ban:Sam'); const armedBan = of('ban').length === 0; F.clickButton('admin:ban:Sam'); const banned = same(of('ban').pop(), { t: 'ban', n: 'Sam' });
        feed({ t: 'modlist', muted: [{ n: 'Sam', left: 240 }, { n: 'Zed', left: -1 }], banned: [{ n: 'Bob' }] }); render();
        rec.length = 0; HOOKS.panel.admin(g2, false); const drawn = rec.splice(0); render();
        const lists = buttons.some(b => b.label === 'admin:unmute:Sam') && !buttons.some(b => b.label === 'admin:mute:Sam') && buttons.some(b => b.label === 'admin:unmute:Zed') && buttons.some(b => b.label === 'admin:unban:Bob') && drawn.some(t => /^Muted, 4 minutes left/.test(t)) && drawn.some(t => /until you unmute/.test(t)) && drawn.includes('Banned');
        refill(); F.clickButton('admin:unmute:Sam'); F.clickButton('admin:unban:Bob');
        const undo = same(of('unmute').pop(), { t: 'unmute', n: 'Sam' }) && same(of('unban').pop(), { t: 'unban', n: 'Bob' });
        S.modlistAskedAt = nowMs() - MODLIST_EVERY - 1; const m0 = of('modlist').length; F.step([]); const again = of('modlist').length === m0 + 1;
        closePanel(); S.modlistAskedAt = nowMs() - MODLIST_EVERY - 1; F.step([]); const quiet = of('modlist').length === m0 + 1;
        check(P + 'Knights: Mute (5 minutes, 1 hour, 1 day, until unmuted), Kick and Ban (each a second tap), Unmute and Unban send the contract messages; admins get no buttons; the lists show time left; modlist asked on opening and every 10 s while open', asked && samRow && adaBare && spans.every(Boolean) && armed && kicked && armedBan && banned && lists && undo && again && quiet, { asked, samRow, adaBare, spans, armed, kicked, armedBan, banned, lists, undo, again, quiet, drawn: drawn.filter(t => /Muted|Banned|left/.test(t)) });
        const say = m => { notice = null; feed(Object.assign({ t: 'mod' }, m)); return notice ? notice.text : null; };
        const words = [say({ ok: true, act: 'mute', n: 'Sam', left: 300 }), say({ ok: true, act: 'mute', n: 'Sam', left: 3600 }), say({ ok: true, act: 'mute', n: 'Sam', left: 86400 }), say({ ok: true, act: 'mute', n: 'Sam', left: -1 }),
          say({ ok: true, act: 'unmute', n: 'Sam' }), say({ ok: true, act: 'kick', n: 'Sam' }), say({ ok: true, act: 'ban', n: 'Sam' }), say({ ok: true, act: 'unban', n: 'Sam' }),
          say({ ok: false, act: 'mute', n: 'Ada', code: 'admin' }), say({ ok: false, act: 'kick', n: 'Nobody', code: 'unknown' }), say({ ok: false, act: 'kick', n: 'Sam', code: 'offline' }), say({ ok: false, act: 'ban', n: 'MudGoll', code: 'self' }), say({ ok: false, act: 'mute', n: 'Sam', code: 'bad' })];
        const want = ['Sam is muted for 5 minutes.', 'Sam is muted for 1 hour.', 'Sam is muted for 1 day.', 'Sam is muted until you unmute.', 'Sam can chat again.', 'Sam was sent out of the world.', 'Sam is banned.', 'Sam is unbanned.', "You can't do that to an admin.", 'No knight by that name.', 'Sam is not online.', 'That is you.', 'That did not work. Try again.'];
        check(P + "the world's mod answers become the contract's sentences", same(words, want), { words }); }

      // ---- Can't be hurt: hurtPlayer, die and a keeper's hurt message do nothing; hp topped up; off again, it hurts ----
      { refill(); closePanel(); player.dead = false; player.mech = null; player.r = 13; player.hp = player.maxHp; player.skills.defence.xp = xpForLevel(skillLv('defence'));
        open('powers'); render(); F.clickButton('admin:god'); const on = S.god;
        const hp0 = player.hp; let blocked = false;
        if (on) { hurtPlayer(10, player.x + 10, player.y); die(); feed({ t: 'hurt', dmg: 7, x: player.x + 10, y: player.y }); blocked = player.hp === hp0 && !player.dead; }
        player.hp -= 20; F.step([]); const topped = player.hp === player.maxHp;
        F.clickButton('admin:god'); const offNow = !S.god;
        player.hp = player.maxHp - 10; const hp1 = player.hp; hurtPlayer(5, player.x + 10, player.y); const hurts = player.hp < hp1;
        const hp2 = player.hp; feed({ t: 'hurt', dmg: 4, x: player.x + 10, y: player.y }); const hurts2 = player.hp < hp2;
        player.hp = player.maxHp; closePanel();
        check(P + "Can't be hurt: while On, hurtPlayer, die and a keeper's hurt message do nothing and hp is topped up every frame; Off, hits land again", on && blocked && topped && offNow && hurts && hurts2, { on, blocked, topped, offNow, hurts, hurts2 }); }

      // ---- Give me an item: into the pack, then the bank, exact numbers; what fits nowhere is not made ----
      { refill(); const inv0 = player.inv.map(s => s ? { ...s } : null), bank0 = player.bank.map(s => ({ ...s }));
        player.inv = new Array(INV_SLOTS).fill(null).map(() => ({ id: 'stone', qty: ITEMS.stone.stack })); player.inv[7] = null; player.bank = [];
        notice = null; const r1 = give('iron_bar', 250); const t1 = notice && notice.text;
        const split = r1 && r1.gave === 250 && r1.packed === 50 && r1.banked === 200 && countItem('iron_bar') === 50 && player.bank.some(b => b.id === 'iron_bar' && b.qty === 200) && t1 === 'Gave 250 iron bars (200 went to your bank).';
        player.inv[7] = null; player.bank = []; for (let i = 0; i < BANK_SLOTS; i++) player.bank.push({ id: 'wood', qty: 1 });
        notice = null; const r2 = give('iron_bar', 250); const t2 = notice && notice.text;
        const refused = r2 && r2.gave === 50 && r2.refused === 200 && countItem('iron_bar') === 50 && !player.bank.some(b => b.id === 'iron_bar') && t2 === 'Gave 50 iron bars (the rest did not fit).';
        player.inv = new Array(INV_SLOTS).fill(null); player.bank = [];
        open('powers'); render(); F.clickButton('admin:give'); setSearch('iron bar'); render();
        const listed = buttons.some(b => b.label === 'admin:item:iron_bar') && !buttons.some(b => b.label === 'admin:item:wood');
        F.clickButton('admin:item:iron_bar'); F.clickButton('admin:qty:100'); notice = null; F.clickButton('admin:giveitem');
        const viaPanel = countItem('iron_bar') === 100 && !!notice && notice.text === 'Gave 100 iron bars.';
        const words = [plural('Iron bar', 2), plural('Wolf', 3), plural('Coins', 5), plural('Fang of the Fang', 2), plural('Goblin soldier', 1), plural('Cave spider', 4), plural('Raw shrimp', 9)].join('|');
        setSearch(''); S.view = null; closePanel(); player.inv = inv0; player.bank = bank0;
        check(P + 'Give me an item: 250 iron bars with one pack slot free go 50 to the pack and 200 to the bank; with the bank full the rest is refused with the exact number; the panel searches, picks, sets 100 and gives', split && refused && listed && viaPanel && words === 'iron bars|wolves|coins|fangs of the Fang|goblin soldier|cave spiders|raw shrimp', { split, t1, refused, t2, listed, viaPanel, words }); }

      // ---- Teleport: the map's own button over the picture takes the tap; the knight lands on that tile; overworld only ----
      { refill(); closePanel(); const target = h.openSpot(60, 30);
        player.dead = false; open('powers'); render(); F.clickButton('admin:teleport'); render();
        const mapOpen = panel === 'map' && S.teleport && buttons.some(b => b.label === 'admin:teleport:map') && !!S.mapImg;
        const sc = S.mapImg ? S.mapImg.w / MAP_W : 1, px = S.mapImg ? S.mapImg.x + (target.x + 0.5) * sc : 0, py = S.mapImg ? S.mapImg.y + (target.y + 0.5) * sc : 0;
        pointerDown(px, py, 'mouse');
        const landed = Math.floor(player.x / TILE) === target.x && Math.floor(player.y / TILE) === target.y && !collides(player.x, player.y, player.r, 'player') && panel === null && !S.teleport;
        const inst = INSTANCES.list().includes('spider_den') ? 'spider_den' : INSTANCES.list()[0]; INSTANCES.enter(inst);
        notice = null; const refusedIn = teleportTo(target.x, target.y) === false && startTeleport() === false && !!notice && notice.text === 'Teleport works on the overworld.';
        INSTANCES.leave(); F.tp(target.x, target.y); feed({ t: 'keeper', map: 'over', n: 'MudGoll' });
        check(P + 'Teleport: the world map opens with a button over the picture; a tap there lands the knight on that tile, on free ground, and closes the map; refused inside an instance', mapOpen && landed && refusedIn, { mapOpen, target: [target.x, target.y], at: [Math.floor(player.x / TILE), Math.floor(player.y / TILE)], landed, refusedIn }); }

      // ---- the keeper's side of spawning ----
      { refill(); closePanel(); const o = h.openSpot(58, 34); F.tp(o.x, o.y);
        const x = Math.round(player.x), y = Math.round(player.y);
        const spawns = () => monsters.filter(isSpawn), living = () => monsters.filter(m => isSpawn(m) && !m.dead).length, withSid = sid => monsters.filter(m => m.nid && m.nid.startsWith('!' + sid + '.'));
        const keeperNow = COOP.isKeeper();
        feed({ t: 'spawn', by: 'MudGoll', type: 'goblin', count: 3, x, y, sid: 'tst1' });
        const three = withSid('tst1');
        const made = three.length === 3 && ['!tst1.0', '!tst1.1', '!tst1.2'].every(n => three.some(m => m.nid === n)) && three.every(m => m.type === 'goblin' && dist(m.x, m.y, x, y) <= SPAWN_SPREAD + 1 && !collides(m.x, m.y, m.r, 'beast') && m.home.x === m.x && m.home.y === m.y && m.hp === MONSTER_DEFS.goblin.hp && m.state === 'idle' && !m.dead);
        feed({ t: 'spawn', type: 'no_such_thing', count: 2, x, y, sid: 'tst2' }); feed({ t: 'spawn', type: 'goblin', count: 2, x, y, sid: 'BAD!' }); feed({ t: 'spawn', type: 'goblin', count: 0, x, y, sid: 'tst3' });
        const ignored = spawns().length === 3;
        feed({ t: 'keeper', map: 'over', n: 'Ann' }); feed({ t: 'spawn', type: 'wolf', count: 2, x, y, sid: 'tst4' }); feed({ t: 'spawn_clear', by: 'MudGoll' });
        const notKeeper = !COOP.isKeeper() && withSid('tst4').length === 0 && !(COOP.parked || []).some(m => m.nid && m.nid.startsWith('!tst4.')) && (COOP.parked || []).filter(isSpawn).length === 3;
        feed({ t: 'keeper', map: 'over', n: 'MudGoll' });
        const back = COOP.isKeeper() && spawns().length === 3;
        feed({ t: 'spawn', type: 'sheep', count: 20, x, y, sid: 'tst5' }); feed({ t: 'spawn', type: 'sheep', count: 20, x, y, sid: 'tst6' }); feed({ t: 'spawn', type: 'sheep', count: 20, x, y, sid: 'tst7' });
        const capped = living() === SPAWN_LIVE_MAX && withSid('tst7').length === 17;
        feed({ t: 'spawn', type: 'sheep', count: 5, x, y, sid: 'tst8' }); const full = living() === SPAWN_LIVE_MAX && withSid('tst8').length === 0;
        const victim = monsters.find(m => m.nid === '!tst1.0'); const k0 = player.kills; victim.hp = 1; killMonster(victim);
        const credit = player.kills === k0 + 1 && victim.dead;
        F.step([]); const held = victim.dead && victim.respawnT >= 1e8 && monsters.includes(victim);
        F.sim(130, []); const gone = !monsters.includes(victim) && !monsters.some(m => m.nid === '!tst1.0');
        F.sim(240, []); const never = !monsters.some(m => m.nid === '!tst1.0');
        const others = monsters.filter(m => !isSpawn(m)).length; feed({ t: 'spawn_clear', by: 'MudGoll' });
        const cleared = spawns().length === 0 && monsters.filter(m => !isSpawn(m)).length === others;
        check(P + "the keeper makes an admin spawn exactly as asked: count monsters with nids '!<sid>.<k>' on free ground within 3 tiles; unknown types, bad sids and non-keepers make nothing; at most 60 living; a dead one keeps its kill credit, never respawns and is gone 2 s later; spawn_clear takes only '!' monsters", keeperNow && made && ignored && notKeeper && back && capped && full && credit && held && gone && never && cleared, { keeperNow, made, ignored, notKeeper, back, capped, full, credit, held, gone, never, cleared });
        // every MONSTER_DEFS type, bosses included, spawned at once and run for 10 simulated seconds
        const types = Object.keys(MONSTER_DEFS); types.forEach((t, i) => feed({ t: 'spawn', by: 'MudGoll', type: t, count: 1, x, y, sid: 'all' + i }));
        const allMade = types.every((t, i) => monsters.some(m => m.nid === '!all' + i + '.0' && m.type === t));
        let err = null; S.god = true;
        try { for (let i = 0; i < 60 && !err; i++) { player.hp = player.maxHp; player.dead = false; F.sim(10, []); } } catch (e) { err = String(e && e.message); }
        S.god = false;
        feed({ t: 'spawn_clear', by: 'MudGoll' }); const allGone = spawns().length === 0;
        check(P + `every MONSTER_DEFS type (${types.length}, bosses included) can be spawned on a keeper and runs 10 simulated seconds without an exception`, types.length >= 36 && allMade && err === null && allGone, { types: types.length, allMade, err, allGone }); }

      // ---- Unlock everything: a failed pin changes nothing at all ----
      { refill(); closePanel(); dialog.cur = null; dialog.queue.length = 0; render(); save(); const before = slot(), stage0 = quest.stage;
        world.pinFails = true; open('powers'); render(); F.clickButton('admin:unlock'); const armed = confirmActive('admin:unlock'); notice = null; F.clickButton('admin:unlock');
        const after = slot();
        check(P + 'Unlock everything with a pin that fails: the slot string is exactly what it was, and it says so in plain words', armed && world.pinBodies.length === 1 && before === after && quest.stage === stage0 && !S.busy && !!notice && notice.text === 'Could not make a backup, so nothing was changed.', { armed, pins: world.pinBodies.length, same: before === after, stage: quest.stage, notice: notice && notice.text });
        world.pinFails = false; world.pinBodies.length = 0; closePanel(); }

      // ---- Unlock everything with a pin that answers: every entry of the table holds, and only presence went out ----
      let pinnedRaw = null;
      { refill(); closePanel(); dialog.cur = null; dialog.queue.length = 0;
        // stand where 31-rebuild puts the first house's west wall: whatever the unlock builds, the knight is never left inside it
        F.tp(126, 70); render(); save(); const before = slot();
        open('powers'); render(); sent.length = 0;
        F.clickButton('admin:unlock'); F.clickButton('admin:unlock');
        pinnedRaw = world.pinned;
        const told = !!notice && notice.text === 'Everything is unlocked. Put my knight back undoes it.';
        F.step([]); F.step([]); F.step([]); F.step([]);
        const held = UNLOCKS.map(u => [u.key, present(u) ? holds(u) : 'absent']);
        const failing = held.filter(([, v]) => v === false).map(([k]) => k);
        const founded = !QUEST_DEFS.guild || (!!quest.guild && !!quest.guild.founded);
        const onlyPresence = sent.every(m => m.t === 'p'), free = !collides(player.x, player.y, player.r, 'player');
        check(P + `Unlock everything with a pin that answers: the pinned backup is the knight from before, and every entry of the table holds afterwards (${UNLOCKS.length}), the guild founded, the knight on free ground, and nothing but presence went out on the socket`, pinnedRaw === before && told && failing.length === 0 && founded && free && onlyPresence, { pinnedBefore: pinnedRaw === before, told, failing, founded, free, onlyPresence, out: sent.map(m => m.t), pinAt: S.pinAt });
        dialog.cur = null; dialog.queue.length = 0; }

      // ---- Put my knight back: the cloud's pending push is dropped first, then the world's pin comes back as the knight ----
      { refill(); closePanel(); const d = JSON.parse(pinnedRaw || '{}'), dp = d.player || {}, dq = d.quest || {};
        order.length = 0; if (window.CLOUD) CLOUD.reset = function () { order.push('reset'); return _reset(); };
        open('powers'); render(); const enabled = buttons.some(b => b.label === 'admin:putback');
        F.clickButton('admin:putback'); F.clickButton('admin:putback');
        if (window.CLOUD) CLOUD.reset = _reset;
        const first = order.indexOf('reset') === 0 && order.indexOf('restore') > 0;
        const skills = SKILL_DEFS.every(s => ((dp.skills || {})[s.key] || { xp: 0 }).xp === player.skills[s.key].xp);
        const ring = !window.KEYRING || same((dp.keyring || []).slice().sort(), (player.keyring || []).slice().sort());
        const dozer = same(dp.dozerUp || null, player.dozerUp || null) || (!dp.dozerUp && !Object.values(player.dozerUp || {}).some(Boolean));
        const pack = same(dp.inv, player.inv);
        const back = !!notice && notice.text === 'Your knight is back to how it was.' && quest.stage === dq.stage && title.slot === 1 && slot() === pinnedRaw && S.pinAt === null;
        notice = null; const none = putBack() && !!notice && notice.text === 'There is no backup to go back to.';
        check(P + 'Put my knight back: shown while there is a pin; the cloud reset runs before the restore call; the knight is the pinned one again (skills, story stage, keyring, dozer upgrades, pack); with no pin it says so', enabled && first && skills && ring && dozer && pack && back && none, { enabled, order, first, skills, ring, dozer, pack, back, stage: [quest.stage, dq.stage], none }); }

      // ---- layout: the chip clear of every button at five screen sizes; the panel's own buttons clear of each other; 44 px on touch ----
      { refill(); closePanel(); dialog.cur = null; dialog.queue.length = 0; notice = null; connect('admin'); refill();
        feed({ t: 'who', list: [{ n: 'MudGoll', map: 'over', region: 'Thistledown', lv: 99, role: 'admin' }, { n: 'Sam', map: 'over', region: 'Wolfwood', lv: 12, role: 'player' }, { n: 'Ada', map: 'over', region: 'Hollowford', lv: 30, role: 'admin' }] });
        feed({ t: 'modlist', muted: [{ n: 'Sam', left: 240 }], banned: [{ n: 'Bob' }] });
        const sizes = [[390, 844, 'phone'], [844, 390, 'landscape phone'], [768, 1024, 'iPad'], [1024, 768, 'iPad landscape'], [1280, 800, 'laptop']];
        const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        const setSize = (w, hh) => { try { window.innerWidth = w; window.innerHeight = hh; } catch (e) { } render(); return VW === w && VH === hh; };
        const hits = [], small = [], done = [];
        for (const touchOn of [false, true]) {
          window.__forceTouch = touchOn;
          for (const [w, hh, name] of sizes) {
            closePanel(); if (!setSize(w, hh)) continue; const tag = name + (touchOn ? ' touch' : '');
            const bs = buttons.filter(b => !b.offscreen && b.w > 0 && b.h > 0), chip = bs.find(b => b.label === 'ADMIN');
            if (!chip) { hits.push(tag + ': no chip'); continue; }
            for (const b of bs) if (b !== chip && overlap(chip, b)) hits.push(tag + ': ADMIN × ' + b.label);
            if (touchOn && (chip.w < 44 || chip.h < 44)) small.push(tag + ': chip ' + chip.w + 'x' + chip.h);
            for (const view of ['knights', 'mute', 'powers', 'give', 'monsters', 'party']) {
              S.tab = view === 'mute' ? 'knights' : view === 'give' ? 'powers' : view; S.view = view === 'mute' ? { kind: 'mute', n: 'Sam' } : view === 'give' ? { kind: 'give' } : null;
              panel = 'admin'; render();
              const r = panelRect, mine = buttons.slice(S.panelFrom || 0).filter(b => b.w > 0 && b.h > 0);
              for (const b of mine) if (!r || b.x < r.x - 1 || b.y < r.y - 1 || b.x + b.w > r.x + r.w + 1 || b.y + b.h > r.y + r.h + 1) hits.push(`${tag} ${view}: ${b.label} leaves the panel`);
              for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) if (overlap(mine[i], mine[j])) hits.push(`${tag} ${view}: ${mine[i].label} × ${mine[j].label}`);
              if (touchOn) for (const b of mine) if (b.h < 44 || b.w < 44) small.push(`${tag} ${view}: ${b.label} ${Math.round(b.w)}x${Math.round(b.h)}`);
              done.push(tag + ' ' + view);
            }
            panel = null; S.view = null; S.tab = 'knights';
          }
        }
        setSize(was.vw, was.vh); window.__forceTouch = was.touch;
        check(P + 'layout: the ADMIN chip sits clear of every other button, and every tab and view of the panel keeps its buttons inside it and clear of each other, at phone, landscape phone, iPad (both ways) and laptop sizes, touch on and off; on touch every one is at least 44 px', hits.length === 0 && small.length === 0 && done.length === 60, { hits: hits.slice(0, 12), small: small.slice(0, 12), done: done.length }); }
    } catch (e) {
      check(P + 'the admin self-test ran to the end without an exception', false, { error: String((e && e.stack) || e).slice(0, 800) });
    } finally {
      if (window.CLOUD && _reset) CLOUD.reset = _reset;
      S.god = false; S.teleport = false; S.view = null; S.busy = null; S.pinAt = undefined; S.modlist = null; S.search = ''; S.inputMode = 'search'; S.item = null; S.monType = null; S.count = 1; S.qty = 1; S.qtyText = '1'; S.tab = 'knights'; S.page = { knights: 0, give: 0, monsters: 0 }; S.spans = {}; S.followUp = 0; refill();
      NET.disconnect(); NET.emit('offline', { t: 'offline' }); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null; NET.role = 'player';
      if (window.COOP) COOP.reset();
      window.__forceTouch = was.touch; try { window.innerWidth = was.vw; window.innerHeight = was.vh; } catch (e) { }
      for (const [k, v] of was.ls) lsSet(k, v);
      if (window.CLOUD) CLOUD.reset();
      if (window.LOGIN) LOGIN.playing = was.playing;
      if (was.titleActive) title.open(); else title.startSlot(was.slot);
      closePanel(); h.peace(was.peace); paused = was.paused; notice = was.notice; dialog.cur = was.cur; dialog.queue.length = 0; dialog.queue.push(...was.queue); levelBanner = was.banner;
      render();
    }
  });
}
