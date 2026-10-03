// ============================================================================
// THE WORLD KEEPER — the stand-in knight of a server game copy (docs/ONLINE.md, "The shared world")
// Owner-approved plan: the world server runs the monsters in its own copy of this game, so every knight on a map sees
// the same world. In a browser this file does nothing at all: there is no window.__worldKeeper there.
// In a copy (online/src/sim/host.js sets window.__worldKeeper = { map, worldGen, send, reseed } before the game loads):
//   - save() does nothing (a copy has no knight to save);
//   - worldGen: false makes generateWorld() a blank map with no spawns (an instance copy that builds the same without
//     the overworld; tools/sim-suite.mjs proves which ones);
//   - WORLDKEEPER.start() starts a new game the way the title does, enters the instance for an instance map, and points
//     NET at a virtual socket: NET.online() is true and NET.me is '@world:<map>', which the socket's welcome names the
//     keeper, so 75-coop's keeper half runs here. What the copy sends goes to send(msg); deliver(msg) hands the copy a
//     message as if the world sent it (a knight's p, left, hit, boss_call);
//   - the stand-in knight is parked dead on the solid tile (0, 0) and its deadT is zeroed before every step(dt), so it
//     never respawns (respawnPoint() and an instance's leaveInstance() never run) and every monster takes a real knight
//     as its target through 75-coop (a dead player is never the nearest);
//   - SERVER_OFF switches off the HOOKS entries (by file and hook name) that would act on the dead stand-in. A file
//     leaves the list when it is ported. Each copy's HOOKS functions carry the file that registered them (fn.__file,
//     tagged by tools/build-sim.mjs), which is how the list finds them.
// Feature file: registers through HOOKS only, edits no core file. window.WORLDKEEPER is the register (copies only).
// ============================================================================
{
  const WK = window.__worldKeeper;
  // file -> the HOOKS lists of that file that stay off in a copy. The first list is the Stage 0 audit (tools/sim-audit.mjs,
  // 30 minutes through the 21 overworld regions and 5 in each instance, every boss called): these hooks created, removed or
  // hurt monsters on their own, outside the 75-coop path. Each leaves the list when its file is ported (the spec's stage):
  // 20-hollowford the War Shed's Barrelbeast cleared away after it falls (8); 28-thefang the Fang's own rest (6d);
  // 33-goblincity the Gnasher cleared away after it falls (8); 66-storm the Thunderbird's own hurts (8);
  // 91-royalmine the golem's split, golemlings and the giants (8). No hook changed the parked stand-in.
  const SERVER_OFF = {
    '20-hollowford': ['update'],
    '28-thefang': ['update'],
    '33-goblincity': ['update'],
    '66-storm': ['hit', 'update'],
    '91-royalmine': ['update'],
  };
  const PARK = { tx: 0, ty: 0 };   // solid on the overworld (the cave's corner) and in every instance (its wall corner)

  if (WK && typeof WK === 'object') {
    const mapName = typeof WK.map === 'string' && WK.map ? WK.map : 'over';
    const me = '@world:' + mapName;
    const noSave = function () { };
    noSave.__worldKeeperNoop = true;
    save = noSave;
    if (WK.worldGen === false) {
      // a blank map with no spawns: the instance writes its own tiles and monsters when it is entered
      generateWorld = function () { MONSTER_SPAWNS.length = 0; map.fill(T.WALL); variant.fill(0); };
    }
    let sock = null, started = false;
    const off = [];
    const send = m => { if (typeof WK.send === 'function') WK.send(m); };
    const fake = {
      call: async () => { throw new Error('no world calls from a server game copy'); },
      open: () => {
        sock = {
          readyState: 1,
          send(str) {
            let m = null; try { m = JSON.parse(str); } catch (e) { return; }
            if (!m || typeof m.t !== 'string') return;
            // the virtual socket's own welcome: this copy is the keeper of its map
            if (m.t === 'hello') { deliver({ t: 'welcome', me, at: Date.now(), keeper: me, role: 'player', map: mapName }); return; }
            send(m);
          },
          close() { sock.readyState = 3; },
        };
        return sock;
      },
    };
    function deliver(msg) {
      if (!sock || !sock.onmessage) return false;
      sock.onmessage({ data: typeof msg === 'string' ? msg : JSON.stringify(msg) });
      return true;
    }
    function park() {
      player.dead = true; player.deadT = 0; player.hp = 0;
      player.x = tc(PARK.tx); player.y = tc(PARK.ty);
      player.action = null; player.moving = false; player.mech = null;
    }
    function applyServerOff() {
      for (const hook of Object.keys(HOOKS)) {
        const list = HOOKS[hook]; if (!Array.isArray(list)) continue;
        for (let i = list.length - 1; i >= 0; i--) {
          const f = list[i], file = f && f.__file, rule = file && SERVER_OFF[file];
          if (rule && (rule === '*' || rule.includes(hook))) { list.splice(i, 1); off.push({ file, hook }); }
        }
      }
    }
    function start() {
      if (started) return WORLDKEEPER;
      newGame();
      try { title.active = false; } catch (e) { }
      // the host's fresh dice from here on, so a copy's run never depends on how many it rolled while it was built
      if (typeof WK.reseed === 'function') WK.reseed();
      if (mapName !== 'over') {
        if (!window.INSTANCES || !INSTANCES.enter(mapName)) throw new Error('the copy could not enter ' + mapName);
      }
      NET.enabled = true; NET.token = 'world'; NET.useFake(fake); NET.token = 'world';
      if (!NET.connect() || !NET.online() || NET.me !== me) throw new Error('the virtual socket did not open');
      if (WK.serverOff !== false) applyServerOff();   // only tools/sim-audit.mjs says false: it audits everything
      park();
      started = true;
      return WORLDKEEPER;
    }
    // one substep of the game: the stand-in stays parked dead, then the game's own update (every wrapper included)
    function step(dt) { park(); update(dt); }
    window.WORLDKEEPER = { map: mapName, me, start, step, deliver, park, off, SERVER_OFF, PARK, get started() { return started; } };
  }

  HOOKS.selfTest.push(check => {
    check('worldkeeper: in a browser the stand-in does nothing (no window.WORLDKEEPER, save() is the game\'s own, the wire is not the virtual socket)',
      !window.__worldKeeper && !window.WORLDKEEPER && typeof save === 'function' && !save.__worldKeeperNoop && !(typeof NET !== 'undefined' && typeof NET.me === 'string' && NET.me.startsWith('@world:')),
      { wk: !!window.WORLDKEEPER, me: typeof NET !== 'undefined' ? NET.me : null });
  });
}
