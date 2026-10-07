#!/usr/bin/env node
// tools/idle-alarms.mjs — how many Durable Object alarms the real Room asks for while knights sit idle (fake clock).
// Every alarm is a billed request (online/src/meter.js). The clock only moves to the next alarm or the next message a
// scenario's knight sends, so an hour runs in a moment. A "restart" builds a new Room and restores every socket from
// its attachment, as a deploy or an eviction does (online/src/world.js constructor).
//   node tools/idle-alarms.mjs            prints one line per scenario: alarms an hour before and after a restart
//   node tools/idle-alarms.mjs --src <dir>  the same against another tree's online/src (e.g. master, for the numbers before)
//   --beat                                  a playing keeper also sends the empty mon heartbeat each second (pages before
//                                           4 Oct 2026; this tree's pages send only their presence)
const ai = process.argv.indexOf('--src'), SRC = ai > 0 ? new URL('file://' + process.argv[ai + 1].replace(/\/?$/, '/')) : new URL('../online/src/', import.meta.url);
const BEAT = process.argv.includes('--beat');
const { Room } = await import(new URL('room.js', SRC));
const { MemoryStore } = await import(new URL('store.js', SRC));

const HOUR = 3600000;
function run(sc) {
  let now = Date.UTC(2026, 9, 4, 0, 0, 0), alarmAt = null, alarms = 0;
  const store = new MemoryStore();
  const mk = (name) => { const s = { name, state: null, got: [], send(str) { s.got.push(str); }, close() { s.closed = true; }, attach(st) { s.state = st; } }; return s; };
  const opts = () => ({ now: () => now, store, wake: ms => { alarmAt = now + ms; } });
  let room = new Room(opts());
  const socks = sc.knights.map((kn, i) => mk('Knight ' + i));
  for (const [i, s] of socks.entries()) {
    room.join(s, s.name);
    room.message(s, JSON.stringify({ t: 'hello', v: 1, caps: [], atlas: null }));
    room.message(s, JSON.stringify({ t: 'p', map: sc.map, region: 'Somewhere', x: 100 + 40 * i, y: 100, lv: 3 }));
  }
  // each knight: 'paused' sends nothing more (a page in the menu with nobody near it, a locked phone, a hidden tab: a paused
  // keeper WITH a knight near streams its frozen monsters, which this Room-only clock leaves out); 'playing' sends presence
  // and (with --beat, if keeper) an empty mon every second
  const nextSend = socks.map(() => now + 1000);
  const step = (until) => {
    let counted = 0;
    while (true) {
      const ns = Math.min(...sc.knights.map((kn, i) => kn === 'playing' ? nextSend[i] : Infinity));
      const t = Math.min(alarmAt == null ? Infinity : alarmAt, ns);
      if (t > until) { now = until; return counted; }
      now = t;
      if (alarmAt != null && alarmAt <= now) { alarmAt = null; counted++; room.tick(); }
      for (const [i, kn] of sc.knights.entries()) if (kn === 'playing' && nextSend[i] <= now) {
        nextSend[i] = now + 1000;
        room.message(socks[i], JSON.stringify({ t: 'p', map: sc.map, region: 'Somewhere', x: 100 + 40 * i, y: 100, lv: 3 }));
        if (BEAT && room.keeperOf(sc.map) && room.keeperOf(sc.map).sock === socks[i]) room.message(socks[i], JSON.stringify({ t: 'mon', list: [] }));
      }
    }
  };
  const before = step(now + HOUR);
  // a restart: a new Room, every socket restored from what it carried (the alarm itself survives, as a DO alarm does)
  room = new Room(opts());
  for (const s of socks) room.restore(s, s.state);
  room.settleLogins();
  const after = step(now + HOUR);
  const keeperMsgs = socks.map(s => s.got.filter(x => x.includes('"t":"keeper"')).length);
  return { name: sc.name, alarmsPerHour: before, afterRestartPerHour: after, keeperMessagesEach: keeperMsgs };
}
const SC = [
  { name: 'one knight, overworld, paused', map: 'over', knights: ['paused'] },
  { name: 'one knight, overworld, playing (standing still)', map: 'over', knights: ['playing'] },
  { name: 'one knight, in an instance, paused', map: 'goblin_cave', knights: ['paused'] },
  { name: 'two knights, overworld, both paused (or one paused one backgrounded)', map: 'over', knights: ['paused', 'paused'] },
  { name: 'two knights, in an instance, both paused', map: 'goblin_cave', knights: ['paused', 'paused'] },
  { name: 'two knights, overworld, keeper playing, other paused', map: 'over', knights: ['playing', 'paused'] },
  { name: 'two knights, overworld, both playing', map: 'over', knights: ['playing', 'playing'] },
  { name: 'two knights, overworld, keeper silent (locked, hidden), other playing (one hand-over)', map: 'over', knights: ['paused', 'playing'] },
  { name: 'three knights, overworld, all paused', map: 'over', knights: ['paused', 'paused', 'paused'] },
];
for (const sc of SC) console.log(JSON.stringify(run(sc)));
