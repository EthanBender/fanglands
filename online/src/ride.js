// ============================================================================
// RIDING TOGETHER — the world's side (docs/ONLINE.md, "Riding together")
// Owner (7 Oct 2026): "if a player has repaired a goblin bulldozer or other mech, other players [who] see them walking by
// [can] hop on and ride as well so they can ride together".
// A friend's game says he rides along with one field on his presence, ride: { d: '<driver's name>', s: <seat, from 1> }.
// The Room asks this file, on every presence, whether that pair is real: the driver is on the same map, he is driving a
// machine with that seat (the walker has 1, the bulldozer 2, the Barrelbeast 2; never the mare), the seat is nobody
// else's, and the two are within reach of each other. A real ride is relayed as the world's own { d, s } (the driver's name
// as the world spells it); anything else is taken off the relayed presence (everyone sees him stand where he is) and the
// rider's game is told why with ride_no { d, code }, at most once a second. When the driver stops driving (gets out,
// parks, the machine is wrecked, he falls, he goes into a place, he leaves or his line drops) every rider is told with
// ride_end { d, why }, and his game sets him down. Nothing here touches a save, an item or a machine: the machine stays
// the driver's, and where the rider is stays his own game's word.
//
//   const rides = new Rides(room)       room: the Room (its byName, within and send)
//   rides.presence(k, m, movedMap)      on every presence, after his map, place and fall are read: answers the relayed
//                                       ride ({ d, s }) or null, and the speed the movement check may judge him by
//   rides.moving(k)                     his map is about to change (before the Room's moveMap): the same, why 'inside'
//   rides.gone(k)                       the knight left the world: his seat is free, and if he drove, his riders get down
// Pure JavaScript; no Cloudflare APIs.
// ============================================================================

import { TILE } from './party.js';

export const RIDE_SEATS = Object.freeze({ walker: 1, dozer: 2, beast: 2 });
export const HOP_REACH = 3 * TILE;     // px: a knight hops on within three tiles of the driver (his game asks for less)
export const RIDE_REACH = 10 * TILE;   // px: a rider stays on while his place and the driver's are within ten tiles (a second's lag at Full Steam is 430 px)
export const RIDE_NO_EVERY = 1000;     // ms: a refusal is said to one knight at most this often
// why a ride was refused (ride_no.code): gone (no such driver on this map), self (he cannot ride himself, or he is driving),
// off (the driver is not driving a machine with seats), seat (no such seat), taken (that seat is someone else's, another
// is free), full (every seat is someone else's), far (not within reach)
export const RIDE_CODES = Object.freeze(['gone', 'self', 'off', 'seat', 'taken', 'full', 'far']);
// why riders got down (ride_end.why): off (the driver is not driving any more), fell, inside (he went into another place),
// left (he left the world)
export const RIDE_ENDS = Object.freeze(['off', 'fell', 'inside', 'left']);

const low = s => String(s).toLowerCase();
// the machine a presence says its knight drives: 'walker' | 'dozer' | 'beast', 'other' (the mare, a kind this world does not
// know), or null (on foot). The contract: a mech with no kind is the walker.
export function machineOf(mech) {
  if (!mech || typeof mech !== 'object') return null;
  const k = mech.kind;
  if (k === undefined || k === null || k === 'walker') return 'walker';
  return typeof k === 'string' && Object.prototype.hasOwnProperty.call(RIDE_SEATS, k) ? k : 'other';
}
const seatsOf = kind => (kind && Object.prototype.hasOwnProperty.call(RIDE_SEATS, kind) ? RIDE_SEATS[kind] : 0);

export class Rides {
  constructor(room) { this.room = room; }

  presence(k, m, movedMap) {
    // his own machine, his speed (his game's word, as the movement check reads it)
    k.mech = machineOf(m.mech);
    if (typeof m.spd === 'number' && Number.isFinite(m.spd)) k.spd = m.spd;
    // as a driver: his riders get down when he is no longer driving a machine with their seats, here
    if (k.seats && k.seats.size) {
      const why = k.dead ? 'fell' : (movedMap || k.seatsMap !== k.map) ? 'inside' : null;
      if (why) this.endSeats(k, why);
      else { const cap = seatsOf(k.mech); for (const [s] of Array.from(k.seats)) if (s > cap) this.endSeat(k, s, 'off'); }
    }
    // as a rider
    const r = m.ride;
    if (!r || typeof r !== 'object') { this.release(k); return { ride: null, spd: null }; }
    const d = typeof r.d === 'string' ? r.d.slice(0, 40) : '', s = r.s;
    const D = d ? this.room.byName.get(low(d)) : null;
    const code = this.refuse(k, D, s);
    if (code) { this.release(k); this.say(k, D ? D.name : d, code); return { ride: null, spd: null }; }
    if (k.ride && (k.ride.d !== D.lc || k.ride.s !== s)) this.release(k);
    if (!D.seats) D.seats = new Map();
    if (!D.seats.size) D.seatsMap = D.map;
    D.seats.set(s, k.lc);
    k.ride = { d: D.lc, s };
    return { ride: { d: D.name, s }, spd: Math.max(typeof k.spd === 'number' ? k.spd : 0, typeof D.spd === 'number' ? D.spd : 0) };
  }

  // the code ride_no carries, or null when the ride is real. A driver the world has not heard since it woke (mech
  // undefined) and a place not heard yet are not held against the rider (a nap must not tip everyone off).
  refuse(k, D, s) {
    if (!D || !D.hello || D.map !== k.map) return 'gone';
    if (D === k || k.mech) return 'self';
    if (D.dead || D.ride || (D.mech !== undefined && !seatsOf(D.mech))) return 'off';
    const cap = D.mech === undefined ? Math.max(...Object.values(RIDE_SEATS)) : seatsOf(D.mech);
    if (!Number.isInteger(s) || s < 1 || s > cap) return 'seat';
    const holder = this.holder(D, s);
    if (holder && holder !== k) { for (let i = 1; i <= cap; i++) if (!this.holder(D, i) || this.holder(D, i) === k) return 'taken'; return 'full'; }
    const fresh = !k.ride || k.ride.d !== D.lc;
    if (!this.room.within(k, D, fresh ? HOP_REACH : RIDE_REACH, true)) return 'far';
    return null;
  }
  // who sits in seat s of D's machine (a knight still on line who still says so), or null
  holder(D, s) {
    const lc = D.seats ? D.seats.get(s) : null; if (!lc) return null;
    const o = this.room.byName.get(lc);
    if (o && o.ride && o.ride.d === D.lc && o.ride.s === s) return o;
    D.seats.delete(s); return null;
  }
  say(k, d, code) {
    const now = this.room.now();
    if (k.rideNoAt && now - k.rideNoAt < RIDE_NO_EVERY) return;
    k.rideNoAt = now;
    this.room.send(k.sock, { t: 'ride_no', d: String(d).slice(0, 40), code });
  }
  // he is not riding (or not that seat) any more: the seat is free, nothing is said
  release(k) {
    const r = k.ride; if (!r) return;
    k.ride = null;
    const D = this.room.byName.get(r.d);
    if (D && D.seats && D.seats.get(r.s) === k.lc) D.seats.delete(r.s);
  }
  endSeat(D, s, why) {
    const lc = D.seats.get(s); D.seats.delete(s);
    const o = lc ? this.room.byName.get(lc) : null;
    if (o && o.ride && o.ride.d === D.lc) { o.ride = null; this.room.send(o.sock, { t: 'ride_end', d: D.name, why }); }
  }
  endSeats(D, why) { if (D.seats) for (const [s] of Array.from(D.seats)) this.endSeat(D, s, why); }
  // his map is about to change: his seat is free, and if he drove, his riders hear he went inside before the map's 'left'
  moving(k) { this.release(k); this.endSeats(k, 'inside'); }
  // the knight left the world (every way out goes through the Room's remove)
  gone(k) { this.release(k); this.endSeats(k, 'left'); }
  // what the driver's machine and seats are, for the tests and the parent page: [{ s, n }]
  ridersOf(D) { const out = []; if (D && D.seats) for (const [s] of Array.from(D.seats).sort((a, b) => a[0] - b[0])) { const o = this.holder(D, s); if (o) out.push({ s, n: o.name }); } return out; }
}
