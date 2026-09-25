# Fanglands Online — the world server

One Cloudflare Worker named `fanglands` serves the game at https://gorkscape.ca and runs the world: accounts,
cloud saves, the chat log and the live room where knights see each other. Nothing runs on any of our
computers. `docs/ONLINE.md` (repo root) is the contract between this folder and the game's online files.

```
online/
  wrangler.toml       the Worker's name, the static assets folder, the World object, the two domains
  src/worker.js       the front door: /api/* and /ws go to the World, /admin and everything else are static files
  src/world.js        the Durable Object: sessions, saves, the chat log, pinned backups, the admin routes, the sockets
  src/room.js         who is on which map, who keeps its monsters, where every message goes (no Cloudflare APIs)
  src/store.js        the tables (SCHEMA), the one migration (migrate), and the two stores the room can use
  src/party.js        drop parties: the numbers, the checks, and the prize roll (party hat first)
  src/filter.js       the word list and the name/chat filter
  src/auth.js         secret-word hashing (PBKDF2-SHA256, 100,000 rounds)
  src/http.js         JSON helpers shared by the Worker and the World
  public/admin.html   the parent's page (served at /admin)
  public/index.html   the built game, copied in by deploy.sh (git-ignored)
  test/               node --test online/test/  (unit tests + a local smoke test)
  deploy.sh           build, run every check, copy the game in, deploy
```

## How it runs

- Every request for `/api/...` or `/ws` is handed to the single `World` object (`idFromName('world')`).
  It holds the SQLite tables `accounts`, `sessions`, `saves` (the last three versions per knight), `chat` and
  `settings` (the invite code), the admin tables `mod_log`, `save_pins`, `parties` and `crackers`, and the live room.
- A knight signs up with the invite code, gets a token (32 random bytes as hex, good for 90 days) and opens
  `wss://gorkscape.ca/ws?token=...`. The World checks the token before the upgrade; a bad one is a 401.
- The room (`room.js`) relays presence between knights on the same map, names one knight per map the
  **keeper** (whoever has been on that map longest; it only changes when the keeper leaves), routes hits to
  the keeper, kills and hurts to the knight they name, gifts to the receiver with a ten-second timer, and
  sends chat to everyone after the word filter. Everything it does is driven by plain `{send, close}` sockets,
  so `tools/mmo-sim.js` and the unit tests run it in memory.
- Sockets use the Hibernation API: an idle world sleeps for free, pings are answered by the runtime, and each
  socket carries its knight's state (`serializeAttachment`) so the room is rebuilt when a message wakes it.
  Timers (gift timeouts, the two-second roster cadence, a drop party's fifteen minutes) are Durable Object alarms,
  which survive the nap. Roles, mutes, bans, drop parties, crackers and unclaimed prizes live in SQLite, never only in
  memory: every wake builds a new room, which loads the live parties and reads each knight's role again.

## Admins

Only this page makes a knight an admin (**Make admin** beside their name). An admin's game shows an ADMIN chip:
mute (5 minutes, 1 hour, 1 day, until unmuted), unmute, kick, ban and unban other knights; spawn monsters (the
keeper of that map makes them; they never respawn); throw drop parties (crackers on the ground around the admin;
the first knight to light one gets a prize from the admin's list, and a party hat, 1 in 10 to 1 in 10,000, is
rolled first); and powers over their own knight only (Unlock everything, after a pinned backup; Put my knight back;
Can't be hurt; Teleport; Give me an item). The server checks `accounts.role` in the database on every admin message;
the game hiding buttons is never the lock. Nobody can mute, kick or ban an admin from inside the game; this page can.
Every role change, mute, kick, ban, party and party hat is written to `mod_log` and shown under **What admins did**.
The whole contract is `docs/ONLINE.md`, "Admins and drop parties".

## The tables, and how they change

`store.js` holds the schema. Every time the world wakes it runs, in this order:

1. the five tables from before admins (`accounts`, `sessions` + its index, `saves`, `chat`, `settings`), unchanged;
2. the new ones, only if they are missing: `mod_log` (newest 5,000 kept), `save_pins` (one pinned backup per admin),
   `parties` and `crackers` (when a party starts, every party more than 7 days past its fifteen minutes is deleted
   with its crackers: its unclaimed prizes are no longer offered by then);
3. `migrate()`: it reads the columns of `accounts` (`PRAGMA table_info`) and adds `role` (`'player'`) and
   `muted_until` (`0`) only when they are not there. Running it again changes nothing.

The rule for every change after this one: a migration adds and never takes away. It drops, renames or rewrites no
table, column, row or index, changes no column's type, and adds no new Durable Object class, so `wrangler.toml`'s
migrations stay at `v1`. (The everyday trimming is separate and unchanged: the newest 20,000 chat lines, three saves
per knight, and now the newest 5,000 mod_log rows.) Before the first deploy of a change like this, prove it on a copy: run the live code
(`git archive master online`) under `wrangler dev --persist-to <dir>`, fill it with knights, saves, chat, a ban and a
new invite code, then run the new code on the same `<dir>` twice and check that everything is still there. The
proof for the admin change is `~/.fanglands/work/admin/migration-proof.txt` (the server branch) and
`~/.fanglands/work/admin/integ/migration/migration-proof.txt` (the merged `feat/admin`, old code = master with its
backup routes). The second also runs the OLD code again on the migrated database: it still logs everyone in, saves,
chats, signs up and exports (the two new account columns ride along), so going back to the previous code alone is safe.

## Deploy

From the repo root, on Ethan's MacBook (the only machine where `wrangler` is logged in):

```
./online/deploy.sh
```

It builds the game, runs the headless suite, the server's own tests (`node --test online/test/`, Node 22.5 or
later), the two-player simulation against the FakeWorld and against the real Room, and the admin and drop party
simulations, copies `index.html` (and `bridge.html`) into `online/public/`, then runs `wrangler deploy`. It stops at the
first failing check.

A deploy that changes the schema (the admins change does: two new `accounts` columns and four new tables) needs a
backup first, taken with the admin key: `GET /api/admin/export` (every table, the admins' ones too) and
`GET /api/admin/bookmark` (a point-in-time restore bookmark), both saved under `~/.fanglands/backups/`. Deploy when
`GET /api/status` says nobody is online. To go back: `POST /api/admin/restore {bookmark}` rewinds the world, and the
previous code can simply be deployed again (it runs on the new schema; see the proof above).

## Secrets

Set once with `wrangler secret put <NAME>` inside `online/`; they are never in git.

- `ADMIN_KEY` — what the admin page asks for. Long and random.
- `INVITE_CODE` — seeds the invite code the first time the world wakes. After that the code lives in the
  World's `settings` table and the admin page changes it; the secret is no longer read.

For local runs put both in `online/.dev.vars` (git-ignored):

```
ADMIN_KEY=test-admin
INVITE_CODE=TEST-1234
```

## Running it locally

```
cd online
CI=1 wrangler dev --port 8790
```

The game is at http://localhost:8790 (copy `index.html` into `public/` first, or run `./build.sh` then
`cp index.html online/public/`), the admin page at http://localhost:8790/admin. Local state lives under
`online/.wrangler/` (git-ignored) and survives restarts. If the bundled runtime is older than the
`compatibility_date` in `wrangler.toml`, add `--compatibility-date <the newest it supports>` to the command
for local runs only; the error message names the date.

## Tests

```
node --test online/test/            # filter, secret-word hashing, room routing and caps (no server needed)
node --test online/test/smoke-local.mjs   # against wrangler dev on port 8790; skipped when nothing answers there
```

`node --test online/test/` runs `room.test.mjs` (routing and caps), `admin.test.mjs` (roles on every message, the
role check, mute, kick, ban, unban, the mod log, naps, spawning), `party.test.mjs` (the party-hat odds over a
million seeded rolls, the party checks, first light wins, naps, expiry, prizes and claims), `store.test.mjs` (the
migration on the live schema with node's built-in SQLite, twice, every old row byte for byte; SqlStore and
MemoryStore giving the same answers), plus the filter and the secret words.

The smoke test signs up fresh knights, saves four versions, opens sockets, checks presence, chat filtering and
logging, hit routing, the admin routes, the login lockout and CORS; then makes an admin, pins and restores a
backup, mutes, kicks and bans over real sockets, spawns, and throws a party where two sockets light the same
cracker. Point it at another port with `SMOKE_BASE=http://127.0.0.1:<port>`.

## The admin page

`https://gorkscape.ca/admin`. It asks for the admin key once per browser tab (kept in `sessionStorage`) and
shows who is on line (admins marked ADMIN in gold), every account (with **Make admin** / **Make player**, how long
they are muted with **Mute** and **Unmute**, **Reset secret word**, **Ban** / **Unban** and **Saves**, which lists
an admin's backup from before Unlock everything first and then the three kept versions, each with a **Go back to
this one** button), the invite code with a box to change it, the chat log, newest at the bottom, and **What admins
did**, newest at the top, both refreshed every ten seconds. Everything goes through `/api/admin/*` with
`Authorization: Bearer <ADMIN_KEY>`:

```
GET  /api/admin/accounts              name, created, lastSeen, banned, saveAt, role, mutedUntil
GET  /api/admin/online                n, map, region, lv, since, role
POST /api/admin/role    {name, role}  'player' or 'admin'; an online knight is told at once
POST /api/admin/mute    {name, span}  '5m', '1h', '1d', 'always' or 'off' (works on admins too)
POST /api/admin/ban     {name, banned}
GET  /api/admin/modlog?limit=200      at, by, act, n, detail, newest first (1 to 2,000)
GET  /api/admin/saves?name=           the pin first (ver 'pin'), then the kept versions
POST /api/admin/rollback {name, ver}  ver a number, or 'pin' (copied forward; the pin stays)
POST /api/admin/reset, GET/POST /api/admin/invite, GET /api/admin/chat   as before
GET  /api/admin/export                every table but sessions: accounts, saves, chat, settings, mod_log,
                                      save_pins, parties, crackers (online/src/backup.js)
GET  /api/admin/bookmark              a point-in-time restore bookmark, also kept in settings
POST /api/admin/restore {bookmark}    rewinds the whole world to that bookmark; everyone reconnects
```

An admin's own game uses `GET /api/save/pin`, `POST /api/save/pin` (`?replace=1`) and `POST /api/save/restore`
with its own session; anyone else gets 403 `admin`.

Banning drops the knight's sessions and closes their socket; their save stays. Resetting a secret word also
logs the knight out everywhere, so whoever had the old word is out. A mute stops a knight's chat (nothing they
type is sent or logged) and nothing else; they keep playing.

## Free-plan limits, and why they are fine

- 100,000 requests a day. WebSocket messages count 20 to 1 and outgoing messages are free. Presence at 8 a
  second per knight plus one keeper snapshot at 8 a second per map is roughly 1,000 requests per knight-hour,
  so twenty kids for four hours a day is a fraction of the budget. Every sender is capped (the table in
  `docs/ONLINE.md`): a socket over its cap gets one `{t:"error", code:"bad"}` and is dropped if it keeps going.
- Pings never count: the runtime answers `{"t":"ping"}` with `{"t":"pong"}` without waking the world.
- PBKDF2 is capped at 100,000 rounds on the free plan, which is exactly what `auth.js` uses.
- The room is capped at 50 knights at once (`error: full`); the chat log keeps the newest 20,000 lines.
- Durable Object alarms (used for gift timeouts, the roster cadence and the end of a drop party) count as
  requests, at most one every two seconds while something is pending.
- Admin messages are capped like everything else (mute, kick, ban: 1 a second; a party: 1 every 5 seconds;
  lighting crackers: 4 a second) and a drop party has at most 50 crackers, with at most 150 unlit on one map.

## Changing the word list

Open `online/src/filter.js`. `BLOCKED` is one word per line; add or remove lines and deploy. A word there is
caught as a whole word in chat and names (case does not matter), with look-alike digits and symbols put back
(sh1t, $hit), plurals (dicks), stretched spellings (fuuuck) and spaced-out letters (f u c k). Two-word lines are
phrases. `BLOCKED_INSIDE` is the short list also refused *inside* a name or a chat word (xXfuckerXx); keep it
short, since a word there also refuses innocent names that contain it. `RESERVED_NAMES` are names nobody may
take. Run `node --test online/test/` after editing: the tests include game words that must stay allowed.
