# Fanglands Online — the world server

One Cloudflare Worker named `fanglands` serves the game at https://gorkscape.ca and runs the world: accounts,
cloud saves, the chat log and the live room where knights see each other. Nothing runs on any of our
computers. `docs/ONLINE.md` (repo root) is the contract between this folder and the game's online files.

```
online/
  wrangler.toml       the Worker's name, the static assets folder, the World object, the two domains
  src/worker.js       the front door: /api/* and /ws go to the World, /admin and everything else are static files
  src/world.js        the Durable Object: SQLite tables, sessions, saves, the chat log, the hibernating sockets
  src/room.js         who is on which map, who keeps its monsters, where every message goes (no Cloudflare APIs)
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
  `settings` (the invite code), and the live room.
- A knight signs up with the invite code, gets a token (32 random bytes as hex, good for 90 days) and opens
  `wss://gorkscape.ca/ws?token=...`. The World checks the token before the upgrade; a bad one is a 401.
- The room (`room.js`) relays presence between knights on the same map, names one knight per map the
  **keeper** (whoever has been on that map longest; it only changes when the keeper leaves), routes hits to
  the keeper, kills and hurts to the knight they name, gifts to the receiver with a ten-second timer, and
  sends chat to everyone after the word filter. Everything it does is driven by plain `{send, close}` sockets,
  so `tools/mmo-sim.js` and the unit tests run it in memory.
- Sockets use the Hibernation API: an idle world sleeps for free, pings are answered by the runtime, and each
  socket carries its knight's state (`serializeAttachment`) so the room is rebuilt when a message wakes it.
  Timers (gift timeouts, the two-second roster cadence) are Durable Object alarms, which survive the nap.

## Deploy

From the repo root, on Ethan's MacBook (the only machine where `wrangler` is logged in):

```
./online/deploy.sh
```

It builds the game, runs the headless suite and the two-player simulation, copies `index.html` (and
`bridge.html`) into `online/public/`, then runs `wrangler deploy`. It stops at the first failing check.

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

The smoke test signs up two fresh knights, saves four versions, opens two sockets, checks presence, chat
filtering and logging, hit routing, the admin routes, the login lockout and CORS.

## The admin page

`https://gorkscape.ca/admin`. It asks for the admin key once per browser tab (kept in `sessionStorage`) and
shows who is on line, every account (with **Reset secret word**, **Ban** / **Unban** and **Saves**, which lists
the three kept versions with a **Go back to this one** button), the invite code with a box to change it, and
the chat log, newest at the bottom, refreshed every ten seconds. Everything goes through `/api/admin/*` with
`Authorization: Bearer <ADMIN_KEY>`.

Banning drops the knight's sessions and closes their socket; their save stays. Resetting a secret word also
logs the knight out everywhere, so whoever had the old word is out.

## Free-plan limits, and why they are fine

- 100,000 requests a day. WebSocket messages count 20 to 1 and outgoing messages are free. Presence at 8 a
  second per knight plus one keeper snapshot at 8 a second per map is roughly 1,000 requests per knight-hour,
  so twenty kids for four hours a day is a fraction of the budget. Every sender is capped (the table in
  `docs/ONLINE.md`): a socket over its cap gets one `{t:"error", code:"bad"}` and is dropped if it keeps going.
- Pings never count: the runtime answers `{"t":"ping"}` with `{"t":"pong"}` without waking the world.
- PBKDF2 is capped at 100,000 rounds on the free plan, which is exactly what `auth.js` uses.
- The room is capped at 50 knights at once (`error: full`); the chat log keeps the newest 20,000 lines.
- Durable Object alarms (used for gift timeouts and the roster cadence) count as requests, at most one every
  two seconds while something is pending.

## Changing the word list

Open `online/src/filter.js`. `BLOCKED` is one word per line; add or remove lines and deploy. A word there is
caught as a whole word in chat and names (case does not matter), with look-alike digits and symbols put back
(sh1t, $hit), plurals (dicks), stretched spellings (fuuuck) and spaced-out letters (f u c k). Two-word lines are
phrases. `BLOCKED_INSIDE` is the short list also refused *inside* a name or a chat word (xXfuckerXx); keep it
short, since a word there also refuses innocent names that contain it. `RESERVED_NAMES` are names nobody may
take. Run `node --test online/test/` after editing: the tests include game words that must stay allowed.
