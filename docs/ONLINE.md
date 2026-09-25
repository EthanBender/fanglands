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
| `GET /api/me` | — | `{name, created, saveAt, online, role}` | `role` is `'player'` or `'admin'` (see *Admins and drop parties*) |
| `GET /api/save` | — | `{save, at}` (`save` null when none) | the save is the slot JSON string, verbatim |
| `PUT /api/save` | the save JSON string | `{at}` | ≤ 512 KB; server keeps the last 3 versions |
| `GET /api/save/pin` | — | `{at, bytes}` or `{at: null, bytes: 0}` | admins only (403 `admin`): the pinned backup (*Admins and drop parties*) |
| `POST /api/save/pin` | the save JSON string | `{at, pinned}` | admins only; an existing pin is kept unless `?replace=1` |
| `POST /api/save/restore` | — | `{save, at, ver}` | admins only; the pin becomes the current save and is removed; 404 `nopin` |
| `GET /api/status` | — | `{ok, online, names}` | no auth; the title screen uses it to say who is on |
| `GET /api/admin/accounts` | — | `[{name, created, lastSeen, banned, saveAt, role, mutedUntil}]` | `Authorization: Bearer <ADMIN_KEY>` |
| `POST /api/admin/reset` | `{name, pass}` | `{ok}` | new secret word |
| `POST /api/admin/ban` | `{name, banned}` | `{ok}` | banned knights cannot log in; their save stays; written to `mod_log` |
| `POST /api/admin/role` | `{name, role}` | `{ok, role}` | `'player'` or `'admin'`; an online knight is told at once |
| `POST /api/admin/mute` | `{name, span}` | `{ok, mutedUntil}` | `'5m'`, `'1h'`, `'1d'`, `'always'` or `'off'` |
| `GET /api/admin/modlog?limit=200` | — | `[{at, by, act, n, detail}]` | newest first: every role change, mute, kick, ban, party and party hat |
| `POST /api/admin/invite` | `{invite}` | `{ok}` | change the invite code |
| `GET /api/admin/chat?limit=500` | — | `[{at, n, text}]` | the whole log, newest last |
| `GET /api/admin/invite` | — | `{invite}` | the current code |
| `GET /api/admin/saves?name=` | — | `[{ver, at, bytes}]` | the kept versions; a pinned backup is listed first as `ver: 'pin'` |
| `POST /api/admin/rollback` | `{name, ver}` | `{ok}` | make that version the current save (`ver: 'pin'` copies the pin forward and keeps it) |
| `GET /api/admin/online` | — | `[{n, map, region, lv, since, role}]` | |
| `GET /api/admin/export` | — | `{at, accounts, saves, chat, settings, mod_log, save_pins, parties, crackers}` | every row of every table but `sessions` (`online/src/backup.js`): the backup taken before a deploy |
| `GET /api/admin/bookmark` | — | `{bookmark, at}` | a Cloudflare point-in-time restore bookmark, also kept in `settings` |
| `POST /api/admin/restore` | `{bookmark}` | `{ok, restoring}` | rewinds the whole world to that bookmark; every knight reconnects to it |

Auth is `Authorization: Bearer <token>`. A token is 32 random bytes as hex, good for 90 days, stored in
`localStorage` under `fanglands.session`. `NET.call` adds the header; nobody else touches it.

### Error codes the title screen reads (`src/71-login.js`)

The login card turns a 4xx `{error, code}` into one plain sentence. Use these codes (the HTTP status is the
fallback when a code is missing): `pass` (wrong secret word; also 401 on login), `unknown` (no such knight; also
404 on login), `wait` (too many tries; also 429), `banned` (also 403 on login), `invite` (bad invite code; also
401/403 on signup), `taken` (name already used; also 409 on signup), `name` (a name the filter refused), `full`,
`auth` (token dead), `kicked` (an admin sent the knight out; the session stays good). Anything else, or no answer at
all, reads "The world is asleep right now."

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
| `mute` `unmute` `kick` `ban` `unban` `modlist` `spawn` `spawn_clear` `party` `party_end` `light` `claim` | | | see *Admins and drop parties* |

### Server → client

| `t` | Fields | Meaning |
|---|---|---|
| `welcome` | `me, at, keeper, role` | you are in; `keeper` is the keeper of your current map (may be you); `role` is `'player'` or `'admin'` |
| `who` | `list: [{n, map, region, lv, role}]` | everyone online; sent on join/leave and at most every 2 s |
| `p` | `n` + the presence fields + `role` | a knight on your map moved; `role` is the server's word, never the sender's |
| `left` | `n, map` | that knight left your map (or the game) |
| `chat` | `n, text, at, role` | already filtered |
| `keeper` | `map, n` | the keeper of your map changed (you may have become it) |
| `mon` | `n, list` | the keeper's snapshot (you are not the keeper) |
| `hit` | `n, nid, dmg, knock, bomb` | (to the keeper) apply this hit for knight `n` |
| `kill` | `nid, type, x, y` | you got the kill: grant XP, drops and quest credit locally |
| `hurt` | `dmg, x, y` | a monster hit you: `hurtPlayer(dmg, x, y)` |
| `gift` | `gid, from, id, qty` | take it if it fits, answer `gift_ok`/`gift_no` |
| `gift_ok` / `gift_back` | `gid, id, qty` | the receiver took it / it comes back to you |
| `error` | `code, text` | `auth` (token dead: the client forgets it and shows the login), `elsewhere` (the same knight opened on another device: this socket is closed with code 4000 and must not reconnect), `wait`, `full`, `banned` (close 4003, no reconnect), `kicked` (close 4005, no reconnect), `admin` (that was an admin message), `bad` |
| `role` `mod` `modlist` `muted` `unmuted` `spawn` `spawn_clear` `crackers` `boom` `party_end` `light_no` `prize` `party_no` `announce` | | see *Admins and drop parties* |
| `pong` | — | |

### The monster snapshot (`mon.list`)

An array of arrays, one per monster within 24 tiles of any knight on the map, in this order:

`[nid, type, x, y, hp, maxHp, state, fx, fy, moving, hurt, dead, attackT, stunT]`

`nid` is the monster's stable id: `s<i>` for the overworld spawn list (`MONSTER_SPAWNS[i]`), `i<i>` for an
instance's own spawn list, `<keeperName>:<n>` for anything a feature file spawned on the keeper (zombies,
hatched spiders, the Cinderwight's heart), and `!<sid>.<k>` for a monster an admin spawned (it never respawns; see
*Spawning monsters*). The keeper tags monsters it finds without a `nid` on the fly.
Non-keepers create a puppet for every nid they do not know, from `MONSTER_DEFS[type]`. Positions are whole pixels: `x, y` are `Math.round` of the true position.
The 24-tile test uses the true position, so a listed `x, y` can sit up to √½ px (about 0.71 px) past 24 tiles.

### `look`

`{tunic, hair, shoulder, helm, body, shield, weapon: {shape, color}, tool, toolColor, rod, fists}` — exactly
what `drawHuman(g, e, look)` reads, with the weapon reduced to its shape and colour. A knight on a machine
adds `mech: {kind, hp, maxHp}` and is drawn with `drawMech`. Mounts add `mount: id`. A worn party hat adds `hat: '<colour>'`
(`null` otherwise; see *Party hats*).

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

## Admins and drop parties

Owner (2026-09-25), about his own knight on gorkscape.ca: *"can you make mudgoll a Admin I should be able to Mute or
Ban players and I should have all aspects of the Game unlocked and be able to spawn mobs for fun or do drop pratys
where Crackers drop randomly on the ground around me and they can be lit and boom for random rewards that I select
and make it so i can drop party hats that will be SUPER RARE"*

This section is the contract between `online/` and the game files `src/76-admin.js`, `src/77-dropparty.js`,
`src/81-partyhats.js` plus four small edits (70, 71, 73, 74). Change it here first.

### In one screen

- A knight is a **player** or an **admin**. Only the parent page sets it (`POST /api/admin/role`). MudGoll becomes
  an admin when Ethan presses *Make admin* beside him on /admin after this ships. No name is written into any code.
- The role rides on `welcome`, on every `who` entry, and on every relayed `p` and `chat`, so every screen draws a gold
  **ADMIN** tag on an admin's name. The role is always the server's word: a `role` a client sends is overwritten.
- **The server checks the role, in the database, on every admin message.** A client that hides buttons is a
  convenience, never the lock. A non-admin's admin message changes nothing and is answered `error` `admin`.
- Moderation from inside the game: mute (5 minutes, 1 hour, 1 day, until unmuted), unmute, kick, ban, unban. Kept in
  SQLite (survives hibernation, reconnects and other devices), written to `mod_log`, shown on the parent page.
  Nobody can mute, kick or ban an admin from inside the game; the parent page can.
- Admin powers act on the admin's **own** knight, in the admin's own client (the save is the client's; see *The model,
  honestly*): *Unlock everything* (only after a pinned server-side backup that the three-version history can never
  push out), *Put my knight back*, *Can't be hurt*, *Teleport*, *Give me an item*. None of them sends anything to
  another knight or touches another account.
- Spawning: the admin asks, the server checks and relays to the map's **keeper**, the keeper makes the monsters and
  streams them like any other. They never respawn; their drops are normal.
- Drop parties: the admin's client chooses the ground, the **server** makes and stores every cracker, decides the one
  knight who lit each cracker first, rolls the prize from the admin's table (party hat first), and tells the whole map.
  Only the lighter's client gets the item. Party hats come in six colours and are the super-rare prize.

### Who decides what

| Thing | Decided by | Why |
|---|---|---|
| who is an admin | the parent page, stored in `accounts.role` | a ten-year-old's client can be edited; the world's database cannot |
| whether an admin message is allowed | the server, reading `accounts.role` for every such message | never the client, never the socket's memory |
| mutes and bans | the server (`accounts.muted_until`, `accounts.banned`) | they must hold across naps, reconnects and devices |
| which tiles the crackers land on | the admin's client picks, the server checks | the server has no map; it checks range and shape |
| who lit a cracker first, and the prize | the server (SQLite) | exactly one winner per cracker, ever |
| the unlocks, can't be hurt, teleport, give item | the admin's own client | saves are client-authoritative; the server keeps the pinned backup |
| where spawned monsters stand and what they do | the map's keeper | the keeper model: only the keeper runs real monsters |

### The database: migrations that keep everything

The World's constructor runs, in this order, on every wake:

1. the existing `CREATE TABLE IF NOT EXISTS` statements, unchanged;
2. the new tables below, also `CREATE TABLE IF NOT EXISTS`;
3. `migrate(sql)`: for each new `accounts` column, read `PRAGMA table_info(accounts)` and run
   `ALTER TABLE accounts ADD COLUMN ...` only when that column is missing. Running it twice changes nothing.

```
accounts  + role        TEXT    NOT NULL DEFAULT 'player'   -- 'player' | 'admin'
          + muted_until INTEGER NOT NULL DEFAULT 0          -- 0 = not muted; ms; ALWAYS = until someone unmutes
mod_log   (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, by TEXT NOT NULL, act TEXT NOT NULL,
           target TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '')
save_pins (name_lc TEXT PRIMARY KEY, json TEXT NOT NULL, at INTEGER NOT NULL)
parties   (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, by TEXT NOT NULL, map TEXT NOT NULL,
           region TEXT NOT NULL DEFAULT '', hat INTEGER NOT NULL, table_json TEXT NOT NULL, count INTEGER NOT NULL,
           expires INTEGER NOT NULL, ended INTEGER NOT NULL DEFAULT 0)
crackers  (party INTEGER NOT NULL, k INTEGER NOT NULL, tx INTEGER NOT NULL, ty INTEGER NOT NULL, lit_by TEXT,
           lit_at INTEGER, reward TEXT, claimed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (party, k))
CREATE INDEX IF NOT EXISTS crackers_by_lighter ON crackers (lit_by, claimed)
```

`ALWAYS = 8640000000000000` (the last date JavaScript knows). Rules: no existing table, column, row or index is
dropped, renamed or rewritten; no column changes type; there is no new Durable Object class, so `wrangler.toml`'s
migrations stay at `v1`. `mod_log` keeps its newest 5,000 rows. Parties (and their crackers) older than 7 days are
deleted when a new party starts. If the runtime refuses `PRAGMA table_info`, `sql.exec('SELECT * FROM accounts
LIMIT 0').columnNames` is the same list; the code says which one it uses.

**Proof before merge (server builder).** Run master's `online/` (the live server, `git archive master online`) under
`wrangler dev --persist-to <dir>`, make accounts, several saves each, sessions, chat lines, a ban and a changed invite
code; stop it; run the new `online/` on the same `--persist-to <dir>`; check every account still logs in, every old
token still works, every save comes back byte for byte with the same versions, the chat log, the ban and the invite
code are unchanged, and every account reads `role: 'player'`, not muted; start the new server a second time on the
same state and check again. The transcript is kept at `~/.fanglands/work/admin/migration-proof.txt`.

### The store: how `room.js` reaches the database

`room.js` stays free of Cloudflare APIs. The Room takes a `store`; the World passes `new SqlStore(ctx.storage.sql)`;
the unit tests and `tools/mmo-sim*.js` use `new MemoryStore()`, which is also the default when none is given. Both
live in `online/src/store.js` with the schema and `migrate`. Every method is synchronous.

| Method | Answer | Notes |
|---|---|---|
| `account(name)` | `{name, lc, role, mutedUntil, banned}` or `null` | the name is matched the way login matches it (case, spaces) |
| `setRole(lc, role)` | — | |
| `setMute(lc, until)` | — | `0` unmutes; `ALWAYS` = until unmuted |
| `setBanned(lc, banned)` | — | banning also deletes every session of that knight |
| `log({at, by, act, target, detail})` | — | one `mod_log` row |
| `modLog(limit)` | `[{at, by, act, target, detail}]` | newest first |
| `mutedList(now)` / `bannedList()` | `[{name, until}]` / `[{name}]` | still muted at `now` / banned |
| `addParty({at, by, map, region, hat, table, spots, expires})` | `pid` | inserts the party and one `crackers` row per spot, `k` = index |
| `liveParties(now)` | `[{id, at, by, map, region, hat, table, expires, crackers: [{k, tx, ty, litBy}]}]` | not ended, `expires > now` |
| `light(pid, k, lc, at, reward)` | `true` / `false` | `true` only for the one call that found it unlit (`UPDATE ... WHERE lit_by IS NULL`, one row written) |
| `endParty(pid)` | — | unlit crackers stay unlit for good |
| `unclaimed(lc, since)` | `[{id, reward}]` | lit by that knight since `since`, prize not yet claimed; `id` is the cracker id |
| `claim(pid, k, lc)` | `true` / `false` | only the lighter can claim; claiming twice is harmless |
| `addAccount(name, role)` | — | MemoryStore only: tests and simulations make their knights with it |

`new Room({ now, log, wake, filter, max, store, random })`: `random()` answers a number in [0, 1); the World passes
one built on `crypto.getRandomValues`, tests pass a seeded or scripted one. `room.store` is the store in use.

### Roles

- `POST /api/admin/role {name, role}` (ADMIN_KEY) → `{ok, role}`; `role` is `'player'` or `'admin'` (else 400 `bad`).
  It writes `mod_log` (`by: 'parent page'`, `act: 'role'`) and calls `room.setRole(name)`: if that knight is online
  the Room re-reads the store, sends them `{t:'role', role}` and sends the roster at once, so every tag updates.
- `welcome` gains `role`; each `who` entry gains `role`; a relayed `p` and every `chat` carry the sender's `role`
  (always present, `'player'` or `'admin'`, overwriting anything the client sent). `GET /api/me` gains `role`.
- The Room reads the role from the store at `join` and at `restore` (never from the socket attachment) and for every
  admin message. `NET.role` (70-net) is `'player'` until a `welcome` or `role` says otherwise, and `'player'` again when
  the socket closes.
- The ADMIN tag, drawn from the server's `role` only: a small gold pill reading ADMIN beside the name, the name in gold
  (`#f5c542`) — over the head (73), in the Friends list (73), and on chat names in the strip, the log and the bubble
  outline (74). A knight's own head has no name tag, so an admin sees tags only on other admins.

### Moderation from inside the game

Client → server, admin only (before it does anything, every time, the Room checks `store.account(sender).role === 'admin'`):

| `t` | Fields | Cap | What the server does |
|---|---|---|---|
| `mute` | `n, span` | 1/s, burst 3 | `span` is `'5m'`, `'1h'`, `'1d'` or `'always'`: `muted_until = now + 300000 / 3600000 / 86400000`, or `ALWAYS`. A new mute replaces an old one. The target, if online, gets `muted` |
| `unmute` | `n` | 1/s, burst 3 | `muted_until = 0`; the target, if online, gets `unmuted` |
| `kick` | `n` | 1/s, burst 3 | the target must be online: `error` `kicked`, then close 4005. They may log straight back in |
| `ban` | `n` | 1/s, burst 3 | `banned = 1`, every session deleted; if online `error` `banned`, then close 4003 |
| `unban` | `n` | 1/s, burst 3 | `banned = 0` |
| `modlist` | — | 1/s, burst 2 | answers `modlist` |

`n` is a knight's name, matched like login. Every allowed action writes one `mod_log` row (`by` = the admin's name,
`act` = the `t`, `target` = the knight's name, `detail` = the span for a mute) and answers the admin with `mod`; a
successful one also sends that admin a fresh `modlist`.

Server → client:

| `t` | Fields | To | Meaning |
|---|---|---|---|
| `mod` | `ok, act, n, left?, code?` | the admin | the result. `left` (mute) as in `muted`. `code` when `ok` is false: `unknown` (no such knight), `admin` (the target is an admin), `self`, `offline` (kick needs them online), `bad` (a bad span or name) |
| `modlist` | `muted: [{n, left}], banned: [{n}]` | the admin | sorted by name; `left` as in `muted` |
| `muted` | `left` | the target | whole seconds of mute left (rounded up), or `-1` for until an admin unmutes. Sent when muted, right after `welcome` while muted, and in answer to every refused chat line |
| `unmuted` | — | the target | an admin or the parent page lifted it. Nothing is sent when a timed mute runs out; the client counts down |
| `error` | `code: 'kicked'` | the target | then close 4005. The wire does not reconnect; the title card says so; the session stays good |
| `error` | `code: 'banned'` | the target | then close 4003 (as before). The wire drops the token and does not reconnect |
| `error` | `code: 'admin'` | a non-admin | that message was an admin message; nothing happened |

- A muted knight's `chat` is not relayed and not logged; the server answers `muted`. The chat cap applies first.
- The Room refuses a banned knight at `join` too (`error` `banned`, close 4003), behind the World's session check.
- Parent page (ADMIN_KEY): `POST /api/admin/mute {name, span}` with `span` `'5m' | '1h' | '1d' | 'always' | 'off'` →
  `{ok, mutedUntil}` (works on admins too; tells an online knight through `room.muteChanged(name)`);
  `POST /api/admin/ban` now also writes `mod_log`; `GET /api/admin/modlog?limit=200` → `[{at, by, act, n, detail}]`
  newest first (limit 1 to 2,000); `GET /api/admin/accounts` rows gain `role` and `mutedUntil`;
  `GET /api/admin/online` rows gain `role`. Parent-page actions are logged with `by: 'parent page'`.
- `mod_log.act` is one of `role`, `mute`, `unmute`, `kick`, `ban`, `unban`, `party`, `hat`. The parent page shows the
  log newest first, one line each ("3:41 pm — MudGoll muted Sam for 5 minutes").

### Admin powers (the admin's own knight)

The pinned backup (session auth; the server checks `accounts.role` and answers 403 `admin` to anyone else; the
knight is always the session's own, there is no name field):

| Call | Body | Answer | Notes |
|---|---|---|---|
| `GET /api/save/pin` | — | `{at, bytes}` or `{at: null, bytes: 0}` | is there a backup to go back to |
| `POST /api/save/pin` | the slot JSON string | `{at, pinned}` | same size and JSON rules as `PUT /api/save`. With no pin it is stored (`pinned: true`). With one already there it is **kept** (`pinned: false`, the old `at`): the pin is the knight from before the first unlock. `?replace=1` replaces it |
| `POST /api/save/restore` | — | `{save, at, ver}` | copies the pin forward as a new current save version (like rollback), then deletes the pin; 404 `nopin` when there is none |

The pin is not one of the three kept versions and nothing but `restore` or the parent page removes it.
`GET /api/admin/saves?name=` lists it first as `{ver: 'pin', at, bytes}`; `POST /api/admin/rollback {name, ver: 'pin'}`
copies it forward and keeps it.

The powers, all in `src/76-admin.js`, all only while `NET.online()` and `NET.role === 'admin'` (a demotion or a lost
connection turns them off and closes the panel):

- **Unlock everything.** Confirm tap → `save()` → the slot string → `POST /api/save/pin` → only when that answers,
  unlock → `save()`. A failed pin changes nothing ("Could not make a backup, so nothing was changed."). Unlocked means,
  enumerated from the code: every `SKILL_DEFS` skill at `xpForLevel(99)` (then `recomputeMaxHp()`, full hp); the main
  quest at its last stage (`HOOKS.mainQuest`, 16 on master) with every story gate open (the warden's gate, the crypt
  bars, the lair gate); every `QUEST_DEFS` quest in its done state (each file's own `quest.*` / `player.*` fields);
  every `KEYRING.KEYS` id on the ring; every 40-dozerup blueprint owned and upgrade fitted; a horse (51-mounts); the
  house and every portal destination (63-house); and every other unlock the builder finds. Unlocking sends nothing on
  the socket but the ordinary presence.
- **Put my knight back.** Shown while `GET /api/save/pin` has one. Confirm tap → `CLOUD.reset()` (a pending push of
  the unlocked knight must not land after the restore) → `POST /api/save/restore` → `LOGIN.reload(save, at)` (71).
- **Can't be hurt.** A toggle for this session only (never saved): `hurtPlayer` and `die` do nothing while it is on,
  and hp is topped up every frame as a backstop.
- **Teleport.** Opens the world map; one tap on the map jumps the knight to the nearest free spot on that tile, then
  the map closes. Overworld only.
- **Give me an item.** A searchable list of every item in `ITEMS` (party hats included), any quantity from 1 to
  1,000,000 (quick 1 / 10 / 100 / 1,000). Into the pack, then the bank; what fits nowhere is not made, and the admin is
  told the exact number given.

### Spawning monsters

| Direction | `t` | Fields | Cap | Meaning |
|---|---|---|---|---|
| admin → server | `spawn` | `type, count, x, y` | 1/s, burst 3 | `type` matches `^[a-z0-9_]{1,40}$`, `count` an integer 1–20, `x, y` the admin's position in pixels (finite, 0–100,000) |
| server → keeper | `spawn` | `by, type, count, x, y, sid` | — | relayed to the keeper of the admin's current map (it may be the admin). `sid` is new for every spawn: `[0-9a-z]+`, never reused (the time in base 36 plus a counter) |
| admin → server | `spawn_clear` | — | 1/s, burst 2 | "Clear the spawns on this map" |
| server → keeper | `spawn_clear` | `by` | — | relayed to the keeper of the admin's current map |

- The keeper's client (any client: anyone can be keeper) ignores a `spawn` when it is not the keeper of its current map
  or `MONSTER_DEFS[type]` is missing. It makes each monster exactly the way `spawnMonsters()` does (04-state), at a free
  spot (`collides(x, y, def.r, 'beast')` false) within 3 tiles of `(x, y)` (else on `(x, y)`), `home` = that spot, and
  gives it the nid **`'!' + sid + '.' + k`** (k = 0, 1, 2 ...). At most 60 living admin spawns per map on the keeper.
- **A monster whose nid starts with `!` is an admin spawn, on every client.** It never respawns: the keeper removes it
  from `monsters` 2 s after it dies. The `!` rides the snapshot, so a handoff keeps the rule. Drops, XP, kill credit and
  quest counters are normal. A spawned machine leaves its wreck like any other.
- `spawn_clear` on the keeper removes every `!` monster from its current map; the puppets go when the next snapshot
  no longer lists them. Every `MONSTER_DEFS` type can be spawned, bosses included.

### Drop parties

Client → server:

| `t` | Fields | Cap | Meaning |
|---|---|---|---|
| `party` | `x, y, spots, table, hat` | 1 per 5 s, burst 2 | admin only. `spots` `[[tx, ty], ...]`, `table` `[{id, min, max, w}, ...]`, `hat` the N of "1 in N" |
| `party_end` | — | 1/s, burst 2 | admin only: ends every live party on the admin's map |
| `light` | `id, x, y` | 4/s, burst 8 | anyone: light that cracker. `x, y` the knight's position in pixels |
| `claim` | `id` | 10/s, burst 50 | the lighter: the prize is in my save now |

Server → client:

| `t` | Fields | To | Meaning |
|---|---|---|---|
| `crackers` | `pid, map, by, list: [[id, tx, ty], ...], left` | everyone on that map | the unlit crackers of one live party; `left` = ms until they vanish. Sent when the party starts, to a knight arriving on that map, and after `welcome`. It replaces whatever the client held for that `pid` |
| `boom` | `id, n, fuse, reward` | everyone on that map | `n` lit it first. Play the fuse for `fuse` ms (1,000–2,500), the bang, confetti, the prize popping out. Only `n`'s client adds the item |
| `party_end` | `pid, map` | everyone on that map | the party is over (15 minutes up, every cracker lit, or an admin ended it): take down what is left |
| `light_no` | `id, code` | the knight | `gone` (no such cracker, or the party is over), `taken` (lit first by someone else: their `boom` is already out), `far` (stand within 3 tiles), `map` (it is on another map). Two lights on a party's last cracker: the first ends the party, so the second hears `gone` after the first one's `boom`; a client that already holds that `boom` treats it as `taken` and says nothing |
| `prize` | `id, reward` | the lighter, after `welcome` | a cracker you lit in the last 7 days whose prize the server never heard you `claim` |
| `party_no` | `code` | the admin | `bad` (spots or table failed a check), `busy` (more than 150 unlit crackers would be on the map), `where` (no position known) |
| `announce` | `kind: 'party', n, region, map, count` | everyone online | "MudGoll started a drop party in Thistledown!" |
| `announce` | `kind: 'hat', n, colour` | everyone online | "Sam found a purple party hat!" (gold) |

`reward` is `{id, qty}`, or `{id: 'party_hat_<colour>', qty: 1, hat: '<colour>'}`. A cracker id is `'p' + pid + '.' + k`.

**The server's checks on `party`:** the sender is an admin; `hat` is 10, 100, 1000 or 10000; `spots` has 5 to 50
entries, each two integers 0–1023, no two alike, each within 11 tiles (straight line, in tiles) of the admin's tile —
from the server's last `p` of the admin (x, y ÷ 48), or from the message's `x, y` when there has been none; `table`
has 1 to 20 rows, each `id` matching `^[a-z0-9_]{1,40}$`, `min` and `max` integers with 1 ≤ min ≤ max ≤ 100,000, `w` an
integer 1–1,000; the map's unlit crackers plus these stay at or under 150. Then `store.addParty` (expires = now + 15
minutes), `crackers` to the map, `announce` `party` to everyone online, a `mod_log` row (`act: 'party'`, `target` =
the map, `detail` like `30 crackers in Thistledown, party hats 1 in 1,000`). The server cannot check item ids; the
party panel only offers items in `ITEMS`.

**Lighting (the server):** the id parses; the party is live and has that cracker (else `gone`); the knight is on the
party's map (else `map`); it is unlit (else `taken`); the knight's position — the server's last `p`, or the message's
`x, y` when there has been none — is within 168 px (3.5 tiles) of the cracker's centre `(tx·48 + 24, ty·48 + 24)`
(else `far`). Then `reward = rollCracker(table, hat, random)`, `store.light(...)` (if it answers false: `taken`),
`fuse = 1000 + floor(random() × 1501)`, `boom` to everyone on the map. A hat also sends `announce` `hat` to everyone
online and writes `mod_log` (`act: 'hat'`, `by` = the party's admin, `target` = the finder, `detail` = the colour). The
last cracker lit ends the party (`party_end`). The Room's `TILE` is 48, the game's.

**The roll** — `rollCracker(table, hatOneIn, random)` in `online/src/party.js`, pure, exported for the tests:

```
if (random() * hatOneIn < 1)  ->  colour = HAT_COLOURS[floor(random() * 6)]; { id: 'party_hat_' + colour, qty: 1, hat: colour }
else  r = random() * (sum of w); walk the rows: r -= w; the first row where r < 0 wins (the last row if rounding runs out)
      qty = min + floor(random() * (max - min + 1))  ->  { id, qty }
HAT_COLOURS = ['red', 'yellow', 'blue', 'green', 'purple', 'white']
```

**Claims (so a prize is never lost and never doubled).** The lighter's client adds the prize when the fuse ends:
pack, then bank, then at its feet. It puts the cracker id in `player.party.claimed` (the newest 300 are kept, saved
with the knight), calls `save()`, and then — while the cloud save is active — sends `claim` only after a cloud push
that includes it succeeds; with no cloud (tests, the simulation) it sends `claim` straight after `save()`. The server
marks it claimed. After every `welcome` the server sends a `prize` for each unclaimed one; the client adds it unless the
id is already in `claimed`, then claims either way. A prize whose `id` is not in `ITEMS` is not added and not claimed
("That prize needs the newest game. Reload the page to get it.").

**Hibernation.** Parties and crackers are rows. The Room loads the live parties from the store when it is built (every
wake) and arms the alarm for the next expiry. A knight who arrives or reconnects gets `crackers`; a `light` that wakes
the world finds the same crackers the nap left.

**Expiry.** 15 minutes after the start: `store.endParty`, `party_end` to the map. Clients also drop a party's
crackers locally when `left` runs out.

### Party hats

- Items `party_hat_red`, `party_hat_yellow`, `party_hat_blue`, `party_hat_green`, `party_hat_purple`,
  `party_hat_white`: name "Purple party hat" and so on, `value: 10000` (the most valuable thing in the Fanglands),
  `stack: 1`, `shape: 'helm'`, `armour: { slot: 'helm', def: 0 }`, `partyHat: '<colour>'`, `color` its colour.
- Worn in the head slot and drawn as a paper crown in its colour on the knight: `playerLook()` gives `look.hat =
  '<colour>'` and no `look.helm`; `drawHuman` draws the crown for any `look.hat`, so remote knights wear it too once
  73's `lookOf()` passes `hat` along in presence (`look.hat`, the colour word, or `null`).
- Death never takes a party hat: one in the pack stays in the pack when the knight falls (77 wraps `die` with
  explicit arguments and puts the hats back in a `finally`, so it composes with 76's *Can't be hurt* wrapper).
- They hand over with the ordinary gift system (and ask for a confirm tap, being worth 100 or more).
- Six icons in `src/81-partyhats.js` (it loads after `80-icons`, so `ICONS.set` exists), each a **different drawing**:
  the icon audit counts a recolour as the same picture, and the ratchet fails if more items share a drawing.
- The wiki gets a page for each: found only in drop party crackers, 1 in 1,000 crackers at the usual odds.

### Caps and validation, all new messages

| `t` | rate / s | burst | Fields checked by the server |
|---|---|---|---|
| `mute` | 1 | 3 | admin; `n` a string ≤ 40; `span` one of the four |
| `unmute`, `kick`, `ban`, `unban` | 1 | 3 | admin; `n` a string ≤ 40 |
| `modlist` | 1 | 2 | admin |
| `spawn` | 1 | 3 | admin; `type`, `count`, `x`, `y` as above |
| `spawn_clear` | 1 | 2 | admin |
| `party` | 0.2 | 2 | admin; see *The server's checks on `party`* |
| `party_end` | 1 | 2 | admin |
| `light` | 4 | 8 | `id` matches `^p\d+\.\d+$`; `x`, `y` finite when sent |
| `claim` | 10 | 50 | `id` matches `^p\d+\.\d+$`; only the lighter's claim counts |

The cap runs before the role check, so a knight hammering admin messages is dropped like any other.

### Close codes and error codes

- Close codes: 4000 elsewhere, 4001 lost, 4003 banned, 4004 full, **4005 kicked**, 4008 too fast. The wire never
  reconnects after 4000, 4003 or 4005, nor after an `error` `elsewhere`, `banned` or `kicked`.
- Socket `error` codes gain `kicked` and `admin`. HTTP error codes gain `admin` (403: only an admin may) and `nopin`
  (404: no pinned backup). `LOGIN.sentence` reads `kicked` as "An admin sent you out of the world. You can come back in."

### Plain words (the sentences the three builders share)

- Muted, told: "An admin muted you for 5 minutes. You can still play; your chat is off until then." / for always:
  "An admin muted you. Your chat is off until an admin turns it back on."
- Muted, trying to chat: "You can't chat for 4 more minutes." (seconds under a minute, minutes under an hour, hours
  under a day, rounded up) / "You can't chat until an admin turns it back on."
- Unmuted: "An admin turned your chat back on."
- To the admin: "Sam is muted for 5 minutes." "Sam can chat again." "Sam was sent out of the world." "Sam is banned."
  "Sam is unbanned." "You can't do that to an admin." "No knight by that name." "Sam is not online."
- Parties: "MudGoll started a drop party in Thistledown!" "Sam found a purple party hat!" "Walk up to the cracker
  first." "Your pack was full, so it went to your bank." "From a cracker you lit: 250 coins."

### Testing (who proves what)

- **Server** (`node --test online/test/`): the role check on every admin message; mute, kick, ban, unban, admins
  untouchable, `mod_log` rows; a mute and a ban still in force after a new Room is built on the same store (a nap);
  the pin endpoints; a party's checks; two lights on one cracker in the same tick give one `boom` and one `taken`;
  a party still there after a nap; expiry at 15 minutes on a fake clock; `prize` after `welcome` and claims that
  cannot double; the role overwrite on `p` and `chat`; `rollCracker`'s odds proven statistically (party hat 1 in 1,000
  over 1,000,000 rolls within five standard deviations, the six colours even, row weights and quantity ranges held);
  `migrate` run twice on an old-schema database with no row lost (node's built-in SQLite). Plus the local smoke test
  and the old-server → new-server proof above. `node tools/mmo-sim.js --room` still passes.
- **Admin** (`tools/mmo-sim-admin.js`, two games against the real Room): the admin mutes, kicks and bans a player (and
  cannot touch an admin); the admin spawns goblins that the other knight sees and fights; a non-admin sends every admin
  message and each is refused with nothing changed. Plus self-tests in 76 and in each edited online file. A client
  treats a missing `role` (an older server) as `'player'`.
- **Party** (`tools/mmo-sim-party.js`, two games against the real Room): a party both knights see; both knights light
  the **same** cracker in the same frame and exactly one gets the prize; a scripted roll gives a hat and both hear the
  announcement; a prize that survives a disconnect mid-fuse; crackers that survive a rebuilt Room; expiry. Plus
  self-tests in 77 and 81.
- The three simulations are required as modules (`require('./mmo-sim.js')` exports `Wire`, `makeContext`,
  `loadRoom(now, opts)`, `FakeWorld` and `FakeStore`, `mulberry32` and `contractRoll`); `MMO_ROOM=<path to room.js>`
  points them at another checkout. `deploy.sh` runs all three before every deploy. The `Wire` delivers a close the
  world makes with its code (4005, 4003, 4000), after whatever the world sent just before it.
- **Two-player** (`tools/mmo-sim.js`, both against its FakeWorld and with `--room` against the real Room; the FakeWorld
  is this contract written out again, not a copy of `room.js`): roles on welcome, the roster and presence, and the
  parent page turning a role on and off; the admin mutes the other knight from the panel (the mute holds over a
  reconnect), kicks him (4005) and bans him (4003, every join refused until unbanned), and the parent page's Ban and
  Unban do the same by name; the admin spawns goblins the other knight sees, fights and gets the kill for; a party of
  50 crackers where both knights light the **same** cracker in the same tick, 50 times, each prize recomputed from the
  world's own dice by the roll above; a party hat handed over with the ordinary gift; a non-admin sending every admin
  message is refused with nothing changed.

### Who owns what

| Builder | Files |
|---|---|
| contract (this section) | `docs/ONLINE.md`; the module exports at the bottom of `tools/mmo-sim.js` |
| server | everything under `online/` (`src/room.js`, `src/world.js`, new `src/store.js` and `src/party.js`, `public/admin.html`, `test/*`, `README.md`, `deploy.sh`) |
| admin | new `src/76-admin.js` and `tools/mmo-sim-admin.js`; edits to `src/70-net.js`, `src/71-login.js`, `src/73-players.js` (ADMIN tag, `role`, `hat` in `lookOf`), `src/74-chat.js` (mute, admin names, `CHAT.system`) |
| party | new `src/77-dropparty.js`, `src/81-partyhats.js`, `tools/mmo-sim-party.js` |

`index.html` is generated: each branch rebuilds and commits it, and the integration rebuilds it again.

## Safety rules (binding)

- Invite-only signups. Names and chat pass `online/src/filter.js`. Chat is logged with the name and time.
- No free text anywhere else: no profiles, no descriptions. Quick-chat phrases are the default on touch.
- Rate limits on every message type (table above). A socket over its cap is dropped with `error: bad`.
- The admin page is a single HTML file behind `ADMIN_KEY`; it never leaves Ethan's hands.
- Saves are kept in three versions so a broken save can be rolled back from the admin page.
- Admins: only the parent page makes one. The server reads the role from the database on every admin message; the
  game hiding buttons is not the lock. Every moderation action, party and party hat is written to `mod_log` and shown
  on the parent page. Nobody can mute, kick or ban an admin from inside the game.
- An admin's powers change only that admin's own knight; *Unlock everything* runs only after a pinned backup, which
  the parent page can restore too.

## Where things are

- Play: https://gorkscape.ca (the invite code is with Ethan; nothing on this page is public).
- Parents: https://gorkscape.ca/admin — accounts, reset a forgotten secret word, ban, the invite code, the chat log, save rollback,
  who is an admin (Make admin / Make player), mutes, the moderation log, pinned backups. Needs the admin key.
- The old address https://ethanbender.github.io/fanglands/ is the offline copy; its title screen has no login.

## Testing

- `HOOKS.selfTest` checks in every online file, using `NET.useFake(...)` for the wire.
- `tools/mmo-sim.js`: two headless game contexts + the real `Room` class from `online/src/room.js` (`--room`) or the
  FakeWorld (the contract written out again), wired with in-memory sockets. Proves login, presence relay, keeper
  election, hit routing, the kill going to the right knight, chat, and handoff when the keeper leaves; then the admins
  and drop parties (*Admins and drop parties*, *Testing*). Run both ways in `deploy.sh` before every deploy.
- `node --test online/test/` for the server's own logic (password hashing, filter, room routing, rate caps, roles,
  moderation, the store and its migration, drop parties and the party-hat odds).
- `tools/mmo-sim-admin.js` and `tools/mmo-sim-party.js`: the admin and party scenarios, two games against the real
  Room (see *Admins and drop parties*, *Testing*). `deploy.sh` runs them with the others.
