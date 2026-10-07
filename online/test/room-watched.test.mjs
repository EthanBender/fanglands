// The Room's whole suite again, with a teacher watching every knight (docs/ONLINE.md, "The teacher view", Watch): every
// socket tapped and every keeper's own snapshot handed on (room.test.mjs, WATCHED). The same assertions pass, so a watcher
// changes nothing any knight gets; and the sink proves the taps were really there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
globalThis.__ROOM_WATCHED = true;
const mod = await import('./room.test.mjs?watched');
test('the watcher really watched: the taps and hooks.mon saw the frames', () => { assert.ok(mod.SINK.length > 100, String(mod.SINK.length)); assert.ok(mod.SINK.some(s => /"t":"mon"/.test(s))); });
