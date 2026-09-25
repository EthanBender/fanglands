# Fanglands Online — the contract

Owner (2026-09-24): *"we have a domain gorkscape; repurpose it for Fanglands and serve it on that domain, and make it
an online MMORPG so Cohen and his friends can log in and play together."*

This document is the contract between the server and every online feature file. Change it before you change
either side. `src/70-net.js` is the wire; the server lives in `online/`.

## What it is

- **https://gorkscape.ca** serves the game (the same `index.html` the GitHub Pages address serves) from one
  Cloudflare Worker named `fanglands`. Nothing runs on any of our computers. `www.gorkscape.ca` is the same.
- One **Durable Object** (`World`, SQLite-backed, the singleton `idFromName('world')`) holds the accounts, the
  cloud saves, the chat log and the live room. It costs nothing on the Workers free plan at this scale.
- **Invite-only.** A new knight needs the invite code Ethan hands out. No email, no real names, nothing public.
  Names and chat are word-filtered; chat is kept so a parent can read it at `/admin`.
- **One knight per account.** Online there are no save slots: the account is the knight, saved in the cloud, so
  the same knight plays from the iPad, the laptop, or a friend's house.
- **The GitHub Pages address keeps working** exactly as before, offline and single-player. The title screen on
  gorkscape.ca can pull a knight across from it (see *The bridge*).

## The model, honestly

The game is a client-side simulation (2 MB of it, 626 tests). It is not being rewritten as a server-side
world. Online Fanglands is a **listen server per map**:

1. Everyone on the same map sees each other, chats, and can hand items over.
2. On each map (the overworld, or one instance), the server names the knight who has been on that map longest the **keeper** (ties: game join time, then name), so a keeper only changes when it leaves — or when it goes quiet: a keeper that streams no monsters for 4 s while someone shares its map (paused, on the title screen, a sleeping tab) hands the map to the next knight and goes to the back of the line until that knight leaves. The
   keeper's client runs the monsters exactly as it always has and streams their state; everyone else on that
   map stops simulating monsters and shows the keeper's. Hits from the others are routed to the keeper; the
   keeper's monsters target the nearest knight, whoever it is.
3. Saves are client-authoritative. A ten-year-old's friends are not going to hex-edit JSON. If one does, the
   admin page can reset the account.

That gives kids the thing they mean by "play together": walk up to your friend, fight the same goblin, see the
same drop go to whoever landed the last hit, talk. The server never simulates; it authenticates, stores, and
routes.

## Hosting and deploy

```
online/
  wrangler.toml      name = "fanglands"; assets ./public; DO binding WORLD -> class World (new_sqlite_classes)
                     routes gorkscape.ca + www.gorkscape.ca (custom_domain = true: the DNS is made for us)
  src/worker.js      the Worker: /api/*, /ws -> the World object; everything else -> static assets
  src/world.js       the Durable Object: accounts, saves, sessions, chat log, the live room (hibernating WebSockets)
  src/room.js        the routing logic as a plain class with no Cloudflare APIs, so tools/mmo-sim.js can run it
  src/filter.js      the word filter (names and chat)
  public/            built index.html (copied by deploy.sh, git-ignored) + admin.html
  deploy.sh          build -> headless suite -> copy index.html -> wrangler deploy
```

- `wrangler` is logged in on Ethan's MacBook (ethan@acewood.ca; scopes: workers, kv, routes). Deploy is
  `./online/deploy.sh` from the repo root. Never deploy a build the suite does not pass.
- Secrets (set once with `wrangler secret put`, never in git): `ADMIN_KEY` (the admin page), `INVITE_CODE`
  (seeds the invite code the first time the world wakes; after that it lives in the World's settings table and
  the admin page can change it).
- Free-plan arithmetic: 100,000 requests/day. WebSocket messages count 20:1. Presence at ≤ 8/s per knight
  plus a keeper snapshot at ≤ 8/s per map is roughly 1,000 requests per knight-hour. Twenty kids for four
  hours a day is fine. Outgoing messages are free. Keep every sender under the caps in the table below.

## The HTTP API (JSON in, JSON out; errors are `{error, code}` with a 4xx)

| Call | Body | Answer | Notes |
|---|---|---|---|
| `POST /api/signup` | `{name, pass, invite}` | `{token, name}` | name 2–16 chars, letters/digits/spaces, filtered; pass ≥ 4 chars ("your secret word"); invite must match |
| `POST /api/login` | `{name, pass}` | `{token, name}` | case-insensitive name; 5 wrong tries → 60 s wait (`code: "wait"`) |
| `POST /api/logout` | — | `{ok}` | drops the session |
| `GET /api/me` | — | `{name, created, saveAt, online}` | |
| `GET /api/save` | — | `{save, at}` (`save` null when none) | the save is the slot JSON string, verbatim |
| `PUT /api/save` | the save JSON string | `{at}` | ≤ 512 KB; server keeps the last 3 versions |
| `GET /api/status` | — | `{ok, online, names}` | no auth; the title screen uses it to say who is on |
| `GET /api/admin/accounts` | — | `[{name, created, lastSeen, banned, saveAt}]` | `Authorization: Bearer <ADMIN_KEY>` |
| `POST /api/admin/reset` | `{name, pass}` | `{ok}` | new secret word |
| `POST /api/admin/ban` | `{name, banned}` | `{ok}` | banned knights cannot log in; their save stays |
| `POST /api/admin/invite` | `{invite}` | `{ok}` | change the invite code |
| `GET /api/admin/chat?limit=500` | — | `[{at, n, text}]` | the whole log, newest last |
| `GET /api/admin/invite` | — | `{invite}` | the current code |
| `GET /api/admin/saves?name=` | — | `[{ver, at, bytes}]` | the kept versions |
| `POST /api/admin/rollback` | `{name, ver}` | `{ok}` | make that version the current save |
| `GET /api/admin/online` | — | `[{n, map, region, lv, since}]` | |

Auth is `Authorization: Bearer <token>`. A token is 32 random bytes as hex, good for 90 days, stored in
`localStorage` under `fanglands.session`. `NET.call` adds the header; nobody else touches it.

### Error codes the title screen reads (`src/71-login.js`)

The login card turns a 4xx `{error, code}` into one plain sentence. Use these codes (the HTTP status is the
fallback when a code is missing): `pass` (wrong secret word; also 401 on login), `unknown` (no such knight; also
404 on login), `wait` (too many tries; also 429), `banned` (also 403 on login), `invite` (bad invite code; also
401/403 on signup), `taken` (name already used; also 409 on signup), `name` (a name the filter refused), `full`,
`auth` (token dead). Anything else, or no answer at all, reads "The world is asleep right now."

## The socket

`wss://gorkscape.ca/ws?token=<session>`. JSON text frames, one message each, always with a string `t`.
The server hibernates idle sockets and answers `{"t":"ping"}` with `{"t":"pong"}` without waking.

Maps are named `over` (the overworld) or the instance id (`INSTANCES.active.id`). Presence is only relayed
between knights on the same map; chat and the roster go to everyone.

### Client → server

| `t` | Fields | Cap | Meaning |
|---|---|---|---|
| `hello` | `v: 1, map?` | once | first frame after open; the server answers `welcome`. Without `map` the knight is on `over` until its first `p` |
| `p` | `map, region, x, y, fx, fy, mv, wt, hp, mhp, lv, look, mech, dead, def, act` | 8/s | presence. `region` is the region or instance name the roster shows; `look` is the serialisable part of `playerLook()` (see below); `def` is `playerDefRoll()` so the keeper can roll monster hits against you; `act` is the action type or null |
| `chat` | `text` | 1 per 1.5 s, ≤ 120 chars | filtered and logged server-side, then sent to everyone |
| `mon` | `list` | 8/s, keeper only | monster snapshot for the map (format below) |
| `hit` | `nid, dmg, knock, bomb` | 20/s | a non-keeper hit a monster; routed to the keeper |
| `kill` | `nid, type, x, y, to` | — | keeper: this knight landed the killing blow; routed to `to` |
| `hurt` | `to, dmg, x, y` | — | keeper: a monster hit this knight for `dmg` (already rolled against their `def`) |
| `gift` | `to, id, qty` | 1/s | hand an item over; the sender has already taken it out of the pack |
| `gift_ok` / `gift_no` | `gid` | — | the receiver took it / could not (full pack); `gift_no` makes the server send `gift_back` |
| `ping` | — | — | keepalive every 25 s |

### Server → client

| `t` | Fields | Meaning |
|---|---|---|
| `welcome` | `me, at, keeper` | you are in; `keeper` is the keeper of your current map (may be you) |
| `who` | `list: [{n, map, region, lv}]` | everyone online; sent on join/leave and at most every 2 s |
| `p` | `n` + the presence fields | a knight on your map moved |
| `left` | `n, map` | that knight left your map (or the game) |
| `chat` | `n, text, at` | already filtered |
| `keeper` | `map, n` | the keeper of your map changed (you may have become it) |
| `mon` | `n, list` | the keeper's snapshot (you are not the keeper) |
| `hit` | `n, nid, dmg, knock, bomb` | (to the keeper) apply this hit for knight `n` |
| `kill` | `nid, type, x, y` | you got the kill: grant XP, drops and quest credit locally |
| `hurt` | `dmg, x, y` | a monster hit you: `hurtPlayer(dmg, x, y)` |
| `gift` | `gid, from, id, qty` | take it if it fits, answer `gift_ok`/`gift_no` |
| `gift_ok` / `gift_back` | `gid, id, qty` | the receiver took it / it comes back to you |
| `error` | `code, text` | `auth` (token dead: the client forgets it and shows the login), `elsewhere` (the same knight opened on another device: this socket is closed with code 4000 and must not reconnect), `wait`, `full`, `banned`, `bad` |
| `pong` | — | |

### The monster snapshot (`mon.list`)

An array of arrays, one per monster within 24 tiles of any knight on the map, in this order:

`[nid, type, x, y, hp, maxHp, state, fx, fy, moving, hurt, dead, attackT, stunT]`

`nid` is the monster's stable id: `s<i>` for the overworld spawn list (`MONSTER_SPAWNS[i]`), `i<i>` for an
instance's own spawn list, and `<keeperName>:<n>` for anything a feature file spawned on the keeper (zombies,
hatched spiders, the Cinderwight's heart). The keeper tags monsters it finds without a `nid` on the fly.
Non-keepers create a puppet for every nid they do not know, from `MONSTER_DEFS[type]`. Positions are pixels.

### `look`

`{tunic, hair, shoulder, helm, body, shield, weapon: {shape, color}, tool, toolColor, rod, fists}` — exactly
what `drawHuman(g, e, look)` reads, with the weapon reduced to its shape and colour. A knight on a machine
adds `mech: {kind, hp, maxHp}` and is drawn with `drawMech`. Mounts add `mount: id`.

## The keeper model, in the client

`src/75-coop.js` owns it. The tricks, so nobody re-invents them:

- **Freezing without a flag.** The monster loop in `update()` skips a monster whose `stunT` is still > 0
  after the per-frame decrement, and the renderer draws stars for `stunT > 0`. So: wrap `update`; before the
  original runs, set every frozen monster's `stunT` to a large number; after it returns, put the real value
  back and re-apply the snapshot. Nothing is stepped, nothing shows stars. That is how a non-keeper keeps its
  puppets still, and how the keeper takes over the monsters that are chasing a *remote* knight.
- **Remote targeting on the keeper.** For each live monster, the target is the nearest knight on the map
  (the keeper itself or a remote one). If it is remote, the monster is frozen for the core loop and stepped by
  the coop file's copy of the chase logic (approach, face, attack on cooldown with `rollHit((att+8)*64,
  target.def, maxHit)` and a `hurt` message). Throwers only ever target the keeper.
- **Hits.** Wrap `hitMonster`: on a non-keeper, a hit on a puppet still runs the original (float text, XP for
  the hit, HOOKS.hit) and also sends `hit`; the puppet's hp is corrected by the next snapshot. On the keeper,
  an incoming `hit` sets `m.lastHitBy = n` and calls the original with source `'remote'`. Wrap `killMonster`:
  on the keeper, if `m.lastHitBy` is a remote knight, mark the monster dead with its respawn timer, send
  `kill` to that knight, and skip drops/quest/HOOKS.kill; on a non-keeper, a puppet reaching 0 hp is only
  marked dead (the keeper decides). The knight who receives `kill` runs the original `killMonster` on a
  phantom `{type, x, y, home, r, phantom: true}` so XP-on-kill hooks, drops and quest counters all fire for
  the right person. Kill credit is the last hit.
- **Handoff.** When the keeper leaves, the server names the next knight. The new keeper turns its puppets
  into real monsters (known nids: copy fields onto its own frozen array; unknown nids: `makeMonster(type,
  tx, ty)` then copy fields), unfreezes, and starts streaming.
- **Bosses** with scripted behaviour in their own files still run those scripts on every client. The keeper's
  snapshot overwrites position and hp every tick, so they mostly follow along; anything a boss file spawns on a
  non-keeper is deleted after each update (a non-keeper's `monsters` array may only hold puppets). Known gap;
  test the Spider Den and the goblin camp, note anything else.

  **The keeper-gated boss** (the Ginormous Golem, `src/91-royalmine.js`) is the pattern for a new one. Everything
  that decides something runs only where `!NET.online() || COOP.isKeeper()`: waking him, his states (sleep, rise,
  fight, windup, slam), spawning the little golems, walking them in and the heal they give, and the giant rocks'
  wake roll, settling and regrowth. His states ride the streamed `state` field; the keeper's timers live on
  `m.rm` and are rebuilt from state, hp and maxHp after a handoff. On a puppet the file sends
  `{t: 'hit', nid, dmg, knock: 0, bomb}` itself and shows only a hurt flash, never a local hp change, so there
  is no dead-then-alive flicker. The keeper takes a remote hit on the golem only when `bomb` is true and the damage is 40 to 100 (a hot
  heartstone), and on a giant rock only as a crack of 0 to 2; swords and arrows are stopped on the sender and on
  the keeper. What belongs to one knight stays on that knight's own client: the falling rocks are aimed at your
  own knight, the slam hurts only your own knight, and each knight who helped rolls their own loot once per fall.
  What must match without being a monster comes from the wall clock: which veins glow is a hash of
  `Math.floor(clock / 20000)`, the clock corrected by the server time in `welcome`. `node tools/golem-sim.js`
  (and `--room`) proves it with two whole games.

## The bridge (bringing a knight from the old address)

`bridge.html` at the repo root is served by GitHub Pages. gorkscape.ca loads it in a hidden iframe and posts
`{fanglands: 'give-save'}`; the bridge answers, only to `https://gorkscape.ca` and `https://www.gorkscape.ca`,
with `{fanglands: 'save', slots: {1: {save, at} | null, 2: ..., 3: ...}}` holding the three slot strings and
their `.at` stamps (a browser from before the slots existed hands its legacy `fanglands.save.v2` over as slot 1
with `at: 0`). The login flow waits up to 3 s, believes answers only from `https://ethanbender.github.io`, and
offers the most recent slot when the account has no cloud save yet. Nothing is deleted on the old side. On
gorkscape.ca the online knight lives in slot 1; a save that *Play alone* left there is moved to an empty slot
first (`fanglands.slot.1.online` marks slot 1 as the cloud knight's).

## Safety rules (binding)

- Invite-only signups. Names and chat pass `online/src/filter.js`. Chat is logged with the name and time.
- No free text anywhere else: no profiles, no descriptions. Quick-chat phrases are the default on touch.
- Rate limits on every message type (table above). A socket over its cap is dropped with `error: bad`.
- The admin page is a single HTML file behind `ADMIN_KEY`; it never leaves Ethan's hands.
- Saves are kept in three versions so a broken save can be rolled back from the admin page.

## Where things are

- Play: https://gorkscape.ca (the invite code is with Ethan; nothing on this page is public).
- Parents: https://gorkscape.ca/admin — accounts, reset a forgotten secret word, ban, the invite code, the chat log, save rollback. Needs the admin key.
- The old address https://ethanbender.github.io/fanglands/ is the offline copy; its title screen has no login.

## Testing

- `HOOKS.selfTest` checks in every online file, using `NET.useFake(...)` for the wire.
- `tools/mmo-sim.js`: two headless game contexts + the real `Room` class from `online/src/room.js` wired with
  in-memory sockets. Proves login, presence relay, keeper election, hit routing, the kill going to the right
  knight, chat filtering, and handoff when the keeper leaves. Run it in `deploy.sh` before every deploy.
- `node --test online/test/` for the server's own logic (password hashing, filter, room routing, rate caps).
