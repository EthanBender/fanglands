// ============================================================================
// WORLDS — the Room's side of the maps the world runs itself (docs/ONLINE.md, "The shared world", Stage 2)
// A map switched to 'world' gets a virtual knight, '@world:<map>', as its keeper: its socket is the way into that map's game
// copy (SimHost, host.js). It is never one of the Room's knights: not in who, never relayed as presence, no login, no gifts,
// no trades. Only the map's keeper. Everything here is reached from a handful of lines in room.js, so the Room's own rules
// (who keeps an ordinary map, presence, trades, parties) stay as they were.
//
//   room.worlds = new Worlds(room, { book, save })
//   worlds.useHost(host)            the World's SimHost (null: no copy can be made, so every map stays on the keeper path)
//   worlds.setSwitches(sim, why)    the parent page's switches {master, maps, held}; a map whose mode changes is taken over
//                                   or handed back, with a sim_log row (why: 'parent page', 'master'; null when loading)
//   worlds.modeOf(map)              'world' | 'keeper'
//   worlds.joinVirtual(sock, name, map)
//   worlds.fromCopy(map, list)      SimHost's onSend: what the copy said this tick
//   worlds.fell(map, reason, row)   SimHost's onFallback: the watchdog handed the map back
//
// Taking a map over: the first knight in keeps it in his own game; the Room's alarm builds the copy right after, the copy reads
// the keeper's stream as a non-keeper (it is told his name), and at the first mon with monsters in it (or JOIN_WAIT with none)
// the virtual knight becomes keeper: the copy's handoff() makes the puppets real (same nids, hp, positions). A keeper alone on
// his map sends only an empty heartbeat, which says nothing about his monsters: the copy then keeps its own standing. Handing
// it back: the copy is dropped and the Room elects a real knight, whose game's handoff() makes its puppets real.
// The Room's alarm is armed only for a copy to build and a take-over to finish: a world-run map that has gone quiet is noticed
// on its knights' own presence (each playing game sends one at least once a second), so a knight alone costs no alarms.
// A knight whose game has sent no presence for SILENT ms (a locked iPad, a paused game) is told to the copy as fallen, so no
// monster fights him while he cannot play (in his own game as a lone keeper his monsters stop with him). When every knight
// on a world-run map has gone silent, the map's copy is parked (SimHost.park): its monsters stand exactly where the knights
// last saw them and it is not ticked, so with no other place running no timer stays armed and the Durable Object hibernates
// as it does today. The first presence from any of them (or a knight arriving) ticks it again from where it stood; if the
// object hibernated meanwhile, the copy is gone and the wake takes the map over again as after any nap (announce, below).
// A lone keeper's game whose page has the 'snap' capability is asked for one full snapshot when a copy starts reading it
// (snap below), so a take-over from a knight alone keeps the monsters he chased, hurt or felled as they are on his screen.
// Pure JavaScript.
// ============================================================================
import { Interest } from './interest.js';
import { SimBook } from './book.js';
import { NEVER, quantiles } from './host.js';

// the spec's maps, and the ones this stage lets the world run (the plain instances: no boss of their own)
export const WORLD_MAPS = ['over', 'deepholm', 'aerie', 'coalmine', 'spider_den', 'war_shed', 'tinker_lab', 'stormfront', 'afterlands', 'royalmine'];
export const WORLD_READY = ['deepholm', 'aerie'];
// places of this stage the world could run but has no reason to: no monster lives in the coal mine (tools/mmo-sim-world.js
// check 0 holds this list to the game: each listed place's copy has no monster, each ready one has some)
export const WORLD_EMPTY = ['coalmine'];
export const WORLD_SHOWN = [...WORLD_READY, ...WORLD_EMPTY];   // the parent page's rows
export const MODES = ['keeper', 'world'];
export const JOIN_WAIT = 1500;       // ms a new copy waits for the keeper's first mon before it takes the map with its own monsters
export const STALE = 3000;           // ms: a world-run map whose copy has not ticked this long goes back to a knight (KEEPER_STALE)
export const SILENT = 3000;          // ms without a knight's presence before the copy takes him for fallen (73-players sends one a second)
export const REALM_EVERY = 50;       // ticks between realm_state checks (5 s)
export const virtualName = map => '@world:' + map;
const wireOf = map => typeof map === 'string' && map.startsWith('house') ? 'house' : map;
const num = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
const PRES = ['fx', 'fy', 'def', 'lv', 'hp', 'mhp', 'att', 'mh', 'law', 'spd'];
const TO_KNIGHT = { kill: ['nid', 'type', 'x', 'y'], hurt: ['dmg', 'x', 'y'], boss_wait: ['id', 'left'] };

// the switches as kept in settings 'sim' (move is the movement check's, kept by the Room)
export function cleanSwitches(s) {
  const src = s && typeof s === 'object' ? s : {};
  const maps = {}, held = {};
  for (const m of WORLD_MAPS) maps[m] = src.maps && src.maps[m] === 'world' && WORLD_READY.includes(m) ? 'world' : 'keeper';
  if (src.held && typeof src.held === 'object') for (const m of WORLD_MAPS) { const h = src.held[m]; if (h && typeof h === 'object') held[m] = { reason: String(h.reason || '').slice(0, 40), at: num(h.at) || 0 }; }
  return { master: src.master === 'off' ? 'off' : 'on', maps, held };
}

export class Worlds {
  constructor(room, { book = null, save = () => { } } = {}) {
    this.room = room;
    this.book = book || new SimBook(null, () => room.now());
    this.save = save;              // (switches) => the World writes them into settings 'sim'
    this.host = null;
    this.loaded = null;            // null: no host was ever given; true: a host; false: the World could not load the copy
    this.sw = cleanSwitches(null);
    this.v = new Map();            // map -> the virtual knight on it
    this.bootDue = new Map();      // map -> when to build its copy
    this.views = new WeakMap();    // knight -> Interest
    this.mons = new Map();         // map -> world mons relayed (for realm_state)
    this.quiet = new Map();        // map -> the names of its knights the copy was last told are silent (joined by ',')
  }
  now() { return this.room.now(); }
  useHost(host) {
    this.host = host || null; this.loaded = !!host;
    this.announce();
    // a map waiting for a copy is built now
    if (host) for (const [map, g] of this.room.maps) if (this.modeOf(map) === 'world' && g.members.size && !this.v.has(map)) this.bootDue.set(map, this.now());
    this.room.arm();
  }
  // the World could not load the copy: every map stays with a knight's game (announced, as below)
  noCopy() { this.loaded = false; this.announce(); }
  // A wake, a deploy or an eviction rebuilds the Room from its sockets before the copy has loaded: on a map switched to the world
  // the Room then picks a real knight as keeper without a word (restore is silent: everyone was told before the nap, but what they
  // were told was '@world:<map>'). His game would go on showing puppets of a copy that is gone, and the Room would drop his hits
  // as a keeper's. So each such keeper is named to everyone on his map now: his game's handoff() makes its puppets real (the
  // copy's last nids, hp and positions) and it streams as any keeper does, which the new copy reads to take the map back over.
  announce() {
    for (const [map, g] of this.room.maps) {
      if (this.wants(this.sw, map) !== 'world' || this.v.has(map)) continue;
      const k = g.keeper;
      if (!k || k.virtual || !g.members.has(k)) continue;
      const out = this.keeperMsg(map, k);
      for (const o of g.members) if (o.hello) this.room.send(o.sock, out);
    }
  }
  modeOf(map) {
    return !!this.host && this.sw.master === 'on' && this.sw.maps[map] === 'world' && !this.sw.held[map] && WORLD_READY.includes(map) && !NEVER.has(map) ? 'world' : 'keeper';
  }
  stateOf(map) { const vk = this.v.get(map); return vk ? vk.state : this.modeOf(map); }
  isVirtual(k) { return !!(k && k.virtual); }

  // ---------- the switches ----------
  // what the switches ask for a map (whether or not the copy is loaded yet)
  wants(sw, map) { return sw.master === 'on' && sw.maps[map] === 'world' && !sw.held[map] && WORLD_READY.includes(map) ? 'world' : 'keeper'; }
  setSwitches(sim, why) {
    const was = this.sw, next = cleanSwitches(sim);
    this.sw = next;
    if (!why) return this.sw;
    for (const m of WORLD_MAPS) {
      const from = this.wants(was, m), to = this.wants(next, m);
      if (to === from) continue;
      const reason = was.master !== next.master ? 'master' : why;
      this.book.log({ at: this.now(), map: m, from, to, reason, tickP99: this.p99() });
      if (to === 'keeper') this.handBack(m, reason, false);
      else { if (this.host) this.host.allow(m); this.wanted(m); }
    }
    return this.sw;
  }
  p99() { return this.host ? quantiles(this.host.tickTimes.slice(-100)).p99 : null; }

  // ---------- the virtual knight ----------
  joinVirtual(sock, name, map) {
    const now = this.now();
    const vk = { virtual: true, sock, name, lc: name.toLowerCase(), map, hello: true, since: now, mapAt: now, keeperAt: null, monAt: now, state: 'joining', joinDue: null, ticks: 0 };
    this.v.set(map, vk);
    return vk;
  }
  sockFor(map) { return { send: str => { if (!this.host) return; let m = null; try { m = JSON.parse(str); } catch (e) { return; } this.host.deliver(map, m); }, close() { } }; }

  // a map that should be world-run and has knights on it: its copy is built at the Room's next tick (never while anyone waits)
  wanted(map) {
    const g = this.room.maps.get(map);
    if (!g || !g.members.size || this.v.has(map) || this.modeOf(map) !== 'world') return;
    if (!this.bootDue.has(map)) { this.bootDue.set(map, this.now()); this.room.arm(); }
  }
  boot(map) {
    this.bootDue.delete(map);
    const g = this.room.maps.get(map);
    if (!g || !g.members.size || this.v.has(map) || this.modeOf(map) !== 'world') return false;
    const live = this.host.copies.has(map);
    const c = this.host.boot(map);
    if (!c) { if (!this.sw.held[map] && this.modeOf(map) === 'world') this.handBack(map, this.host.refusedReason(map) || 'boot', true); return false; }
    const vk = this.joinVirtual(this.sockFor(map), virtualName(map), map);
    if (!live) this.readRealm(map, c);
    const real = g.keeper && !g.keeper.virtual && g.members.has(g.keeper) ? g.keeper : null;
    this.tell(map);
    if (live || !real) { this.finish(map); return true; }
    // the copy starts as a non-keeper fed by the knight who keeps the map now
    this.host.deliver(map, { t: 'keeper', map, n: real.name });
    vk.joinDue = this.now() + JOIN_WAIT;
    this.snap(map, real);
    this.room.arm();
    return true;
  }
  // a keeper whose game has the 'snap' capability is asked for one full snapshot of his monsters (every one, standing or
  // fallen, near anyone or not): his answer, not his ordinary stream, is what the copy takes the map over with. An older page
  // is never asked and the take-over is as before (his ordinary snapshots, or JOIN_WAIT).
  snap(map, k) {
    const vk = this.v.get(map);
    if (!vk || vk.state !== 'joining' || !k || !Array.isArray(k.caps) || !k.caps.includes('snap')) return false;
    vk.snapFrom = k.lc;
    this.room.send(k.sock, { t: 'snap', map: wireOf(map) });
    return true;
  }
  // the virtual knight becomes the keeper: the copy's handoff() makes its puppets real, and everyone on the map hears it
  finish(map) {
    const vk = this.v.get(map), g = this.room.maps.get(map);
    if (!vk || !g) return false;
    const now = this.now();
    vk.state = 'world'; vk.joinDue = null; vk.keeperAt = now; vk.monAt = now;
    this.host.deliver(map, { t: 'keeper', map, n: vk.name });
    g.keeper = vk;
    for (const k of g.members) { this.viewOf(k).reset(); this.room.send(k.sock, this.keeperMsg(map, vk)); }
    this.room.arm();
    return true;
  }
  // world -> keeper: the copy goes, a real knight on the map is elected and his game makes its puppets real
  handBack(map, reason, hold, row) {
    const vk = this.v.get(map);
    this.v.delete(map); this.bootDue.delete(map); this.mons.delete(map);
    if (this.host) { this.host.drop(map); if (!hold) this.host.allow(map); }
    if (hold) {
      this.sw.held[map] = { reason, at: this.now() };
      this.book.log({ at: this.now(), map, from: 'world', to: 'keeper', reason, tickP99: row && row.tickP99 != null ? row.tickP99 : this.p99() });
      try { this.save(this.sw); } catch (e) { }
    }
    const g = this.room.maps.get(map);
    if (g) {
      for (const k of g.members) this.viewOf(k).reset();
      if (vk && g.keeper === vk) { g.keeper = null; this.room.elect(map, null); }
    }
    return !!vk;
  }
  fell(map, reason, row) { if (this.v.has(map) || this.modeOf(map) === 'world') this.handBack(map, reason, true, row); }

  // ---------- what the Room tells us (a few lines in room.js) ----------
  // before the election on a map someone arrives at: a copy still running there (its map emptied less than 60 s ago) is keeper at once
  entering(k, map, g) {
    if (this.modeOf(map) !== 'world') return;
    this.viewOf(k).reset();
    if (this.host) this.host.sweep();   // a parked copy whose map has been empty 60 s is not taken up again (it goes)
    if (!this.v.has(map) && this.host && this.host.copies.has(map)) { this.joinVirtual(this.sockFor(map), virtualName(map), map); const vk = this.v.get(map); vk.state = 'world'; vk.keeperAt = this.now(); g.keeper = vk; }
  }
  entered(k, map) {
    if (this.modeOf(map) !== 'world') return;
    if (this.v.has(map)) this.tell(map);
    else this.wanted(map);
  }
  // a knight left the map (already out of its members)
  leaving(k, map, g) {
    const vk = this.v.get(map);
    if (!vk) return;
    if (!g.members.size) { this.v.delete(map); this.mons.delete(map); this.quiet.delete(map); if (this.host) this.host.setKnights(map, []); return; }
    this.tell(map);
  }
  // the election, for a world-run map: the virtual knight keeps it (and a join whose keeper left finishes now)
  holds(map, g) {
    const vk = this.v.get(map);
    if (!vk) return false;
    if (vk.state === 'world') { g.keeper = vk; return true; }
    if (!g.keeper || !g.members.has(g.keeper)) { this.finish(map); return true; }
    return false;
  }
  presence(k, m) {
    const p = k.pres || (k.pres = {});
    for (const f of PRES) { const v = num(m[f]); if (v !== null) p[f] = v; }
    // a copy that has stopped ticking is noticed here, on a presence the Room is handling anyway (no alarm of its own)
    this.staleCheck(k.map);
    if (this.v.has(k.map)) this.tell(k.map);
  }
  // the keeper's own snapshot, while a copy is reading it to take the map over. An empty one is a lone keeper's heartbeat: it
  // lists nothing because nobody else is near him, not because his monsters are gone, so it is not read (JOIN_WAIT finishes)
  // A keeper asked for his full snapshot (snap) hands the map over with that one only: it says every monster as it stands on
  // his screen (an empty full one: he has none), where his ordinary stream says only the ones near other knights.
  keeperMon(k, m) {
    const vk = this.v.get(k.map), g = this.room.maps.get(k.map);
    if (!vk || vk.state !== 'joining' || !g || g.keeper !== k || !Array.isArray(m.list)) return;
    const full = m.full === true && vk.snapFrom === k.lc;
    if (!full && !m.list.length) return;
    this.host.deliver(k.map, { t: 'mon', n: k.name, list: m.list });
    if (full || vk.snapFrom !== k.lc) this.finish(k.map);
  }
  // a knight the copy should not fight: fallen, or his game silent for SILENT ms (it is then told he has fallen; he comes back
  // with his next presence)
  silentOf(k, now) { return now - Math.max(k.pAt || 0, k.mapAt || 0) > SILENT; }
  knightsOf(map) {
    const g = this.room.maps.get(map), out = [], now = this.now();
    if (!g) return out;
    for (const k of g.members) {
      if (!k.hello || k.virtual || k.x == null || k.y == null) continue;
      out.push(Object.assign({ n: k.name, x: k.x, y: k.y }, k.pres || {}, { dead: !!k.dead || this.silentOf(k, now) }));
    }
    return out;
  }
  // hand the copy its knights, and remember which of them it was told are silent
  tell(map) {
    const list = this.knightsOf(map), g = this.room.maps.get(map), now = this.now(), q = [];
    if (g) for (const k of g.members) if (!k.virtual && k.hello && this.silentOf(k, now)) q.push(k.lc);
    this.quiet.set(map, q.join(','));
    // a parked copy whose map has a knight playing again (his presence, or a knight arriving) ticks again from where it stood
    if (this.host.isParked(map) && !this.allQuiet(map)) this.unpark(map);
    this.host.setKnights(map, list);
  }
  // every real knight on the map has gone silent (none at all is not 'all quiet': an emptied map goes as it always did)
  allQuiet(map) {
    const g = this.room.maps.get(map); if (!g) return false;
    const now = this.now(); let n = 0;
    for (const k of g.members) { if (k.virtual || !k.hello) continue; n++; if (!this.silentOf(k, now)) return false; }
    return n > 0;
  }
  // every tick (fromCopy): a knight who has just gone silent is told to the copy as fallen; when all of them have, the copy parks
  quietCheck(map) {
    const g = this.room.maps.get(map); if (!g) return;
    const now = this.now(), q = [];
    for (const k of g.members) if (!k.virtual && k.hello && this.silentOf(k, now)) q.push(k.lc);
    if (q.join(',') !== (this.quiet.get(map) || '')) this.tell(map);
    if (this.allQuiet(map)) this.park(map);
  }
  park(map) {
    const vk = this.v.get(map);
    if (!vk || vk.state !== 'world' || !this.host.park(map)) return false;
    vk.parkedAt = this.now();
    return true;
  }
  unpark(map) {
    const vk = this.v.get(map);
    if (!this.host.unpark(map)) return false;
    // the copy was still on purpose: its silence is not a copy gone quiet (staleCheck counts from here)
    if (vk) { vk.monAt = this.now(); vk.parkedAt = null; }
    return true;
  }
  staleCheck(map) {
    const vk = this.v.get(map);
    if (!vk || vk.state !== 'world' || this.host.isParked(map)) return false;
    const g = this.room.maps.get(map);
    if (!g || !g.members.size || this.now() - vk.monAt <= STALE) return false;
    this.handBack(map, 'stale', true);
    return true;
  }
  viewOf(k) { let v = this.views.get(k); if (!v) { v = new Interest(); this.views.set(k, v); } return v; }
  keeperMsg(map, keeper) {
    const out = { t: 'keeper', map: wireOf(map), n: keeper ? keeper.name : null };
    if (keeper && keeper.virtual) out.server = true;
    return out;
  }
  welcomeSim() { const maps = {}; for (const m of WORLD_READY) maps[m] = this.modeOf(m); return { maps, hz: 10, caps: ['snap'] }; }

  // ---------- what the copy said (SimHost onSend) ----------
  fromCopy(map, list) {
    const vk = this.v.get(map), g = this.room.maps.get(map);
    if (!vk || !g) return;
    for (const m of list) {
      if (!m || typeof m.t !== 'string') continue;
      if (m.t === 'mon' && m.world) {
        if (vk.state !== 'world') continue;
        vk.monAt = this.now(); vk.ticks++;
        this.quietCheck(map);
        const rows = Array.isArray(m.list) ? m.list : [];
        for (const k of g.members) {
          // a knight whose place the world does not know yet (a Room just rebuilt from its sockets keeps no position) is sent
          // nothing until his first presence: a list filtered by no position would be empty, and an empty list from his
          // keeper tells his game that every monster it is holding up has gone
          if (!k.hello || k.x == null || k.y == null) continue;
          this.room.send(k.sock, { t: 'mon', n: vk.name, list: this.viewOf(k).filter(k.name, k.x, k.y, rows), k: m.k, at: m.at });
        }
        if (vk.ticks % REALM_EVERY === 0) this.writeRealm(map);
        continue;
      }
      const fields = TO_KNIGHT[m.t];
      if (!fields || vk.state !== 'world') continue;   // the copy's own presence and snapshots, and anything else, go nowhere
      const to = this.room.byName.get(String(m.to || '').toLowerCase());
      if (!to || !to.hello || to.map !== map) continue;
      const out = { t: m.t };
      for (const f of fields) out[f] = m[f];
      this.room.send(to.sock, out);
    }
  }

  // ---------- realm_state: the boss rests outlive the copy ----------
  writeRealm(map) {
    const c = this.host && this.host.copies.get(map);
    if (!c || !c.wk || typeof c.wk.rests !== 'function') return;
    let r = null; try { r = c.wk.rests(); } catch (e) { return; }
    const now = this.now(), out = {};
    for (const id of Object.keys(r || {}).sort()) { const left = num(r[id]); if (left !== null && left > 0) out[id] = Math.round(now + left * 1000); }
    this.book.realmPut('rest:' + map, out);
  }
  readRealm(map, c) {
    const row = this.book.realmGet('rest:' + map);
    if (!row || !c || !c.wk || typeof c.wk.setRests !== 'function') return;
    const now = this.now(), left = {};
    for (const id of Object.keys(row)) { const at = num(row[id]); if (at !== null && at > now) left[id] = (at - now) / 1000; }
    try { c.wk.setRests(left); } catch (e) { }
  }

  // ---------- the Room's clock ----------
  // Only a copy to build and a take-over to finish arm the alarm (each alarm is a billed request). A world-run map's copy ticks
  // on SimHost's own setTimeout loop, and one gone quiet is caught by staleCheck on its knights' presence and on any tick the
  // Room runs anyway: never by an alarm of its own, so a knight alone on a world-run map costs no more requests than today.
  due() {
    let d = null;
    const min = t => { if (t != null && (d == null || t < d)) d = t; };
    for (const t of this.bootDue.values()) min(t);
    for (const vk of this.v.values()) if (vk.state === 'joining') min(vk.joinDue);
    return d;
  }
  tick() {
    const now = this.now();
    for (const [map, at] of Array.from(this.bootDue)) if (at <= now) { if (this.host) this.boot(map); else this.bootDue.delete(map); }
    for (const [map, vk] of Array.from(this.v)) {
      if (vk.state === 'joining' && vk.joinDue != null && vk.joinDue <= now) this.finish(map);
      else this.staleCheck(map);
    }
  }

  // ---------- the parent page ----------
  view() {
    const modes = {}, knights = {};
    for (const m of WORLD_SHOWN) {
      modes[m] = WORLD_READY.includes(m) ? this.stateOf(m) : 'keeper';
      // the knights on each place, whoever runs it (the Room's own count: the copy's list is only there while the world runs it)
      const g = this.room.maps.get(m); let n = 0;
      if (g) for (const k of g.members) if (!k.virtual && k.hello) n++;
      knights[m] = n;
    }
    const st = this.host ? this.host.stats() : null;
    return Object.assign({ modes, knights, empty: WORLD_EMPTY.slice(), loaded: this.loaded, log: this.book.recent(30) }, st || { running: false, ticks: 0, tick: quantiles([]), boot: {}, heap: null, heapProbe: false, copies: [], cap: null, skipped: 0 });
  }
}
