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
| `GET /api/accounts` | — | `[account]` (see *Accounts*) | admins only (403 `admin`, 401 `auth`): every knight, online or not, for the in-game Accounts tab |
| `POST /api/accounts/reset` | `{name, pass}` | `{ok, name}` | admins only: a new secret word for another player; 404 `unknown`, 403 `self`, 403 `isadmin`, 400 `pass`, 429 `wait` (see *Accounts*) |
| `GET /api/admin/accounts` | — | `[account]` (see *Accounts*) | `Authorization: Bearer <ADMIN_KEY>`; the same rows as `GET /api/accounts` |
| `POST /api/admin/reset` | `{name, pass}` | `{ok}` | new secret word; works on anyone, admins and the parent's own knight too; the knight is sent out, written to `mod_log` (`by: 'parent page'`) |
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
| `GET /api/admin/trades?limit=200` | — | `[{at, a, b, aGave, bGave}]` | newest first (limit 1 to 2,000): every finished trade, who and exactly what each gave (see *Trading*) |
| `GET /api/admin/export` | — | `{at, accounts, saves, chat, settings, mod_log, save_pins, parties, crackers, logins, trades}` | every row of every table but `sessions` (`online/src/backup.js`): the backup taken before a deploy |
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
| `p` | `map, region, x, y, fx, fy, mv, wt, hp, mhp, lv, look, mech, dead, def, act` | 8/s | presence. `region` is the region or instance name the roster shows; `look` is the serialisable part of `playerLook()`, with the six worn item ids in `look.gear` (see below); `def` is `playerDefRoll()` so the keeper can roll monster hits against you; `act` is the action type or null |
| `chat` | `text` | 1 per 1.5 s, ≤ 120 chars | filtered and logged server-side, then sent to everyone |
| `mon` | `list` | 8/s, keeper only | monster snapshot for the map (format below) |
| `hit` | `nid, dmg, knock, bomb` | 20/s | a non-keeper hit a monster; routed to the keeper |
| `kill` | `nid, type, x, y, to` | — | keeper: this knight landed the killing blow; routed to `to` |
| `hurt` | `to, dmg, x, y` | — | keeper: a monster hit this knight for `dmg` (already rolled against their `def`) |
| `gift` | `to, id, qty` | 1/s | hand an item over; the sender has already taken it out of the pack |
| `gift_ok` / `gift_no` | `gid` | — | the receiver took it / could not (full pack); `gift_no` makes the server send `gift_back` |
| `boss_call` | `id, first?` | 0.5/s, burst 2 | ask the keeper of your map to wake a named boss (`id` matches `^[a-z_]{1,24}$`; `first: true` when it is your own first fight; see *Named bosses* below). Dropped when you are the keeper, nobody keeps the map, or the id is bad |
| `boss_wait` | `to, id, left` | 1/s, burst 3 | keeper: the boss `to` asked for is resting on this map, `left` seconds more (relayed like `kill`: only from the keeper, only to a knight on its map) |
| `ping` | — | — | keepalive every 25 s |
| `mute` `unmute` `kick` `ban` `unban` `modlist` `spawn` `spawn_clear` `party` `party_end` `light` `claim` | | | see *Admins and drop parties* |
| `trade_ask` `trade_answer` `trade_offer` `trade_accept` `trade_confirm` `trade_full` `trade_close` `trade_ack` | | | see *Trading* |

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
| `boss_call` | `n, id, first?` | (to the keeper) knight `n` on your map asks you to wake the named boss `id`; `first` is passed on only when it was exactly `true`; your game decides (see *Named bosses*) |
| `boss_wait` | `id, left` | the keeper says the boss you asked for rests there `left` more seconds: the boss file says so in m:ss and your ask is over |
| `error` | `code, text` | `auth` (token dead: the client forgets it and shows the login), `elsewhere` (the same knight opened on another device: this socket is closed with code 4000 and must not reconnect), `wait`, `full`, `banned` (close 4003, no reconnect), `kicked` (close 4005, no reconnect), `admin` (that was an admin message), `bad` |
| `role` `mod` `modlist` `muted` `unmuted` `spawn` `spawn_clear` `crackers` `boom` `party_end` `light_no` `prize` `party_no` `announce` | | see *Admins and drop parties* |
| `trade_ask` `trade_asked` `trade_ask_off` `trade_no` `trade_open` `trade_state` `trade_note` `trade_end` `trade_done` | | see *Trading* |
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

`{tunic, hair, shoulder, helm, body, shield, weapon: {shape, color}, tool, toolColor, rod, fists, hat, girl, gear}` — the
knight's look, with the weapon reduced to its shape and colour. `gear` is `{helm, body, legs, shield, cape, weapon}`: the
ids of the six worn items, each a string or `null` (the obsidian helm, worn in `equip.head`, is sent as `gear.helm`).
A look with `gear` is drawn by `src/82-knightgear.js` (each item in its own shape, legs and capes included), so a friend
sees exactly your gear; other people's looks (townsfolk, guards) are still drawn by the old `drawHuman`. On arrival
(`src/73-players.js`) only ids that are real items for their slot are kept; a slot with no known id (an old client sends
no `gear` at all; a newer client may send an item this page does not know) is read back from the colour fields, which
map back to exactly one item each (`hat: 'red'` is `party_hat_red`), and a colour that is no item draws that family's
plain piece in that colour. Old clients ignore `gear`. A knight on a machine
adds `mech: {kind, hp, maxHp}` and is drawn with `drawMech`. Mounts add `mount: id`. A worn party hat adds `hat: '<colour>'`
(`null` otherwise; see *Party hats*). `girl` is a boolean, always sent: `true` for a girl knight (`player.gender`, chosen on
the "Boy or girl?" card on the title before the knight comes into the world, or in Settings, `src/79-boygirl.js`), and then `hair` is her hair colour; any `drawHuman` draws a look
with `girl` with the skirt and long hair, a braid with a ribbon (out of any helm) and a bow on a bare head. A change of
`player.gender` counts as a look change, so presence goes out at once, and so does a change of any worn item (`lookKey`
counts the weapon, helm, head, body, legs, shield and cape). The server relays the look unchanged: it checks nothing in it,
only the size of the whole message (`MAX_P`, 4096 characters; a full look with every slot worn is about 600) and the rate.

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
- **Deaths on screen.** A monster's death (the animation in 79-deaths) starts only from `HOOKS.monsterDeath(m, info)`,
  `info = { k, by, how, x, y }`, once per death. On the keeper: `killMonster` fires it (`how` 'blow'), and the wrap fires it
  for a remote knight's last blow ('friend'). On a non-keeper, 75-coop fires it on the keeper's word only: the `kill`
  message ('kill') or a puppet's row turning dead ('row'), whichever comes first (`p.deathSeen`). A puppet whose first row
  is already dead died before this knight saw it and fires nothing. The knight's own last blow on a puppet fires nothing:
  the puppet holds still and hurt until the word comes (at most 0.6 s). Phase 1 Stage 3 moves the online firing to `die`.
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

### Named bosses: boss_call and helper credit

Every named boss can be beaten again (owner, 2026-10-02: *"bosses shoould all be redefeatable"*), and friends fight it
together. Two rules make that safe on a shared map; `src/75-coop.js` owns both.

- **Waking a boss.** A boss file registers how its boss comes up: `HOOKS.bossCall[id] = { map, near, alive, wake, name, type,
  rest, resting, told, refused }` (`map` is the map it lives on, `near` is `[tx, ty, tiles]` or `null`, `alive()` says whether one
  is up, `wake(askerName | null)` makes it; the last four are below). The on-screen control calls `COOP.call(id, first)`. Offline, or on the keeper, that runs `wake(null)` at once and answers
  `'woke'`. On anyone else it sends `{t: 'boss_call', id}` (at most one every 2.5 s) and answers `'sent'`; the world relays it to
  the keeper of the sender's map as `{t: 'boss_call', n, id}`. The keeper wakes it only when all of these hold: the id is
  registered and its `map` is the keeper's map, the asker is on that map, the asker stands within `near[2]` tiles of `near`
  (the Fang: 4 tiles of the summoning circle), no such boss is up already, and 3 s have passed since the last wake of that id.
  Then it runs `wake(n)` and shows the entry's `told(n)` line (the Fang: "Ben sounded the horn. The Fang rises in its lair.",
  or "Ben is fighting something far to the south." to a keeper whose story has not reached the dragon; the summoning banner
  shows only to a knight in the lair), or "Ben called The Fang." Anything else is ignored without a word.
- **The rest lives where the boss lives.** The keeper notes when a called boss falls on its map (`S.restAt[id]`, its own clock).
  For `rest` seconds after that it answers a call with `{t: 'boss_wait', to, id, left}` instead of waking it, unless the call
  says `first: true` (the asker's own story fight: his first Fang at stage 14, his first beast at stage 9, a storm he never
  broke). The asker's `refused(left)` says how long in m:ss and ends his call. A call whose boss stood up on the asker's screen
  and then stayed down 3 s is spent, paid or not: the asker's own rest starts and nothing calls it again by itself (the 3 s let
  the keeper's `kill` message for the asker's own last blow land first). Rests: the Fang 600 s, the War Shed 300 s, the storm
  300 s; the Gnasher 180 s (a rematch kill starts it; Tinkerton's first fight never waits). The Gnasher's lever follows the same
  rule: a non-keeper whose lever Gnasher stood up and then stayed down 3 s has spent his rematch, and only his owed first
  fight (stage 2) is ever asked for again by itself.
- **The pay is each knight's own.** `resting(m)` says this knight is still resting from his last paid kill of that boss. A kill
  then (his own, a helper's `kill` message, the keeper's phantom) pays nothing: `m.noPay` is set before the kill hooks run, core
  `rollDrops` is held back, and the boss files, the kill bonus (30-ashdrake, 45-progression), the dragon item
  (37-dragonkillers) and the blueprints (40-dozerup) all read it. He reads "You helped bring it down. Your own reward is ready
  in m:ss." A first kill is never gated. So a friend's calls can never pay anyone twice inside his own rest.
- **The storm is never refilled.** `INSTANCES.define('stormfront', { ..., refill: false })`: a knight arriving at a storm whose
  bird is down does not bring it back. A knight whose rest is over (or who never broke it) asks the keeper once with
  `boss_call stormfront` on the way in; a knight still resting can walk in to help a friend, and the storm he builds alone has
  no bird in it. If no live boss has
  appeared 3 s after a `'sent'`, the asker reads "Nobody answered. Try again in a moment." (an older world drops the unknown
  `t`, and this covers it). What the asker's own story knows (first fight or rematch, a rest still running) is decided on the
  asker's game before it calls; `wake` never sets the keeper's own quest flags when someone else asked.
  The ids today: `the_fang` (`over`, near the circle at (18,117)), `war_shed` (the War Shed's Barrelbeast), `stormfront`
  (the Thunderbird, asked for on the way into the storm) and `gnasher` (Tinkerton's lab).
- **Helper credit.** For `the_fang`, `barrelbeast`, `thunderbird`, `gnasher`, `brood_mother` and `count_ashvane` the keeper counts
  every landed hit per knight (`m.hitters[name] = {n, t}`, the count starting again when the last hit is more than 60 s
  old). When one dies, the killer is credited as before (the keeper's own kill, or `kill` to the knight who landed the last
  hit), and then every other knight on the map with 3 or more hits gets a `kill` message too; the keeper, when it is one of
  them, runs its own kill on a phantom. Nobody is credited twice (`m.credited`). Each knight's game then decides what the
  kill means for that knight: a first kill pays the first kill's story rewards, a repeat pays the repeat purse. Every other
  monster keeps last-hit credit.
- An instance boss a friend brought down stays down for the rest of that visit (`respawnT = Infinity`), as the keeper's own
  blow would leave it. A knight arriving at an instance whose boss is down while the rest still stand finds the boss alone
  stood up again at its own spawn tile; nobody's `cleared` count changes.
- After a handoff, a live boss the old keeper had woken is `awake` on the new keeper too, so the Fang's Echo stays up.

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
- `mod_log.act` is one of `role`, `mute`, `unmute`, `kick`, `ban`, `unban`, `party`, `hat`, `reset` (*Accounts*). The parent page shows the
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

## Trading

Owner (2026-09-25): *"and you should be able to click other players to trade or follow them"*

This section is the contract between `online/src/room.js` (and `store.js`, `world.js`, `public/admin.html`) and the game
file `src/78-trade.js` (with one edit in `src/73-players.js`: the Friends panel's Follow is the real follow).

### In one screen

- **A tap (or a click, or a right-click) on another knight on your map** opens a small card at them, drawn with the HUD
  kit: their name (the gold ADMIN pill for an admin), **Trade**, **Follow** (**Stop following** while you do) and **Close**.
  It never swings and never walks. A tap anywhere else while it is open only closes it. On a screen too crowded to hold
  the card beside the knight (an upright phone: the notice lane and the knight fill the middle) the same three buttons
  open as a small panel instead. A long press on a knight names them.
- **Follow** is the game's alone: nothing is sent, and the friend sees nothing at all. The knight walks after the friend
  with the tap-to-walk pathing (17-tap), planned again every 0.35 s or when they change tiles, stops about a tile behind
  (1.3 tiles; walks on again past 2), and ends when you move yourself (stick, keys, a tap somewhere), when they leave your
  map (a quiet note), after 3 s with no way to them, or on Stop following. A plaque says "Following Sam". The Friends
  panel's Follow does the same.
- **Trade** asks at once when the knight is within four tiles; further away it walks up first (a follow that asks when it
  gets there). The world holds both offers as the only truth and decides everything below.

### The trade, step by step

1. `trade_ask {to}` → the world checks and sends the other knight `trade_ask {from, role}`, and the asker `trade_asked {to}`.
   Their screen shows "Sam wants to trade with you." with **Accept** and **No** (a card at the asker, or a small panel on a
   crowded screen, or a plaque while another panel is open). Two knights who ask each other open the trade at once.
2. `trade_answer {from, yes}`. No: the asker hears `trade_no declined`. Yes: both get `trade_open {id, with, ver}` and the
   window opens (a panel: "Trade with Sam").
3. Each side sends its **whole** offer, `trade_offer {id, items: [{id, qty}]}`, from its pack (never the keyring). Every
   change raises `ver`, un-accepts **both** and goes back to the first screen; both get `trade_state`.
4. `trade_accept {id, ver}` accepts exactly the offers of version `ver`. Two empty offers cannot be accepted. When both have
   accepted the same version the stage is `confirm`: "Are you sure?" shows exactly what each gets.
5. `trade_confirm {id, ver}`. When both confirmed version `ver`, the world checks once more (one map, within eight tiles,
   neither fallen), writes a `trades` row, and sends both `trade_done` in the same moment. Each game takes out what it gave
   and puts in what it got (pack, then bank, then at its feet), **once**: the `tid` goes into `player.trades.done` (the newest
   300, saved with the knight) before `trade_ack {tid}` goes out; with the cloud save on, the ack waits for a cloud push that
   holds that id (the claim rule of *Drop parties*). After every `welcome` the world re-sends `trade_done` (with `id: null`)
   for each trade of the last 7 days that knight never acked; a game that already has the `tid` only acks it.
6. Before its Accept and its Confirm a game checks that its pack still holds its offer (else it sends the smaller offer,
   which un-accepts both) and that its pack will hold what comes back once its own offer is out. If not it sends
   `trade_full {id, why}` (`why`: `'full'`, or `'new'` for an item this game does not know) instead: both are un-accepted,
   both hear `trade_note`, and the window stays open ("Sam's pack is too full for this trade."). A `trade_done` naming an
   item the game does not know moves nothing and is not acked ("That trade needs the newest game. Reload the page to get
   it."); the world sends it again after the reload.

A trade ends with nothing moved (`trade_end`) when either knight closes the window or presses Decline (`trade_close`),
disconnects (or logs in elsewhere), changes map, walks more than eight tiles away, or falls. An open trade lives in the
Room's memory only: a nap of the world ends it too, and the next trade message is answered `trade_end gone`.

### Client → server

| `t` | Fields | Cap (per s, burst) | Meaning |
|---|---|---|---|
| `trade_ask` | `to` | 0.5, 3 | ask a knight to trade |
| `trade_answer` | `from, yes` | 2, 4 | answer an ask (`yes` must be `true` to open it) |
| `trade_offer` | `id, items: [{id, qty}]` | 5, 10 | my whole offer: at most 12 different ids, each `^[a-z0-9_]{1,40}$`, `qty` a whole number 1 to 1,000,000,000, no id twice |
| `trade_accept` | `id, ver` | 4, 8 | the first screen, for version `ver` |
| `trade_confirm` | `id, ver` | 4, 8 | "Are you sure?", for version `ver` |
| `trade_full` | `id, why` | 2, 4 | my pack cannot hold it (`'full'`) or my game does not know an item (`'new'`) |
| `trade_close` | `id` | 2, 4 | I closed the window: the trade is off |
| `trade_ack` | `tid` | 10, 50 | the finished trade is in my save |

### Server → client

| `t` | Fields | To | Meaning |
|---|---|---|---|
| `trade_ask` | `from, role` | the knight asked | `role` is the world's word, for the ADMIN pill |
| `trade_asked` | `to` | the asker | the ask went out |
| `trade_ask_off` | `from` | the knight asked | that ask is over unanswered (it ran out after 30 s, or the asker left, asked someone else or started another trade) |
| `trade_no` | `code, n` | the asker (and, for a yes that cannot open, both) | see the codes below; `n` is the knight it is about |
| `trade_open` | `id, with, ver` | both | the window opens |
| `trade_state` | `id, ver, stage, mine, theirs, acc: [me, them], conf: [me, them]` | both, after every change; one knight, after a refused message | `stage` is `'offer'` or `'confirm'` |
| `trade_note` | `id, code, n` | both | `full` / `new`: `n`'s pack or game (see step 6); both are un-accepted |
| `trade_end` | `id, code, n` | both (the one who left excepted) | nothing moved. `closed`, `left` (disconnected or changed map), `far`, `dead`, or `gone` (no such trade: over, or lost in a nap) |
| `trade_done` | `tid, id, with, gave, got` | both at once; again after `welcome` until acked (`id: null`) | take out `gave`, put in `got`, once per `tid`, then `trade_ack` |

`trade_no` codes: `self` (yourself), `offline` (no such knight online; also when the knight asked leaves), `map` (on another
map), `busy` (`n` is already trading: you or them), `dead` (`n` has fallen), `far` (more than five tiles apart by the
world's last presence of each, or no presence yet), `wait` (you asked them already and it has not run out), `declined`,
`timeout` (30 s and no answer), `gone` (answering an ask that is over), `bad` (no name).

The words the game says: "Walk up to Sam first." "Finish your trade first." "Sam is trading with someone else." "Sam said
no to trading." "Sam did not answer." "Sam's pack is too full for this trade." / "Your pack is too full for this trade."
"Sam walked away, so the trade is off. Nothing was swapped." "Traded with Sam: you gave 5 Bread and got 20 coins."

### The numbers

`TRADE_NEAR` 240 px (five tiles: ask and answer), `TRADE_LEAVE` 384 px (eight tiles: further ends it),
`TRADE_ASK_LIFE` 30 s, `TRADE_ITEMS` 12, `TRADE_QTY_MAX` 1,000,000,000, `TRADE_KEEP` 7 days — all exported by `room.js`.
The game asks from four tiles and follows until it is there.

### The trade log (the store and the parent page)

```
trades (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, a TEXT NOT NULL, a_lc TEXT NOT NULL, b TEXT NOT NULL,
        b_lc TEXT NOT NULL, a_gave TEXT NOT NULL, b_gave TEXT NOT NULL, a_ack INTEGER NOT NULL DEFAULT 0,
        b_ack INTEGER NOT NULL DEFAULT 0)
CREATE INDEX IF NOT EXISTS trades_by_a ON trades (a_lc, a_ack)
CREATE INDEX IF NOT EXISTS trades_by_b ON trades (b_lc, b_ack)
```

A new table only (`CREATE TABLE IF NOT EXISTS`, in `SCHEMA`); nothing existing changes, and `wrangler.toml`'s migrations
stay at `v1`. It keeps its newest 5,000 rows. The store gains `addTrade({at, a, b, aGave, bGave})` → `tid`,
`unackedTrades(lc, since)` → `[{tid, with, gave, got}]` (as that knight sees it, oldest first), `ackTrade(tid, lc)` → `true`
only for one of the two knights in it (twice is harmless), and `tradeLog(limit)` → `[{tid, at, a, b, aGave, bGave, aAck,
bAck}]` newest first; `MemoryStore` answers the same. The parent page lists them under **Trades**, newest first ("3:41 pm —
Ann gave 5 bread; Ben gave 20 coins."), from `GET /api/admin/trades`; `GET /api/admin/export` includes the table.

### Testing

- **Server** (`node --test online/test/`, `trade.test.mjs`): the ask and its answers, every refusal code, asks that run out
  or are withdrawn, two asks to each other, the whole state machine (any change un-accepts both, accepting an old version,
  empty offers, confirming early), every bad offer, messages for a trade you are not in, a full pack, every way a trade
  ends with nothing moved (closed, disconnected, a new map, walking away, falling, another device, a nap), `trade_done`
  re-sent after welcome until acked and only by the two knights, the caps. `store.test.mjs` runs the trade calls against
  both stores.
- **Game** (78's self-test, a fake wire): the card opens on a knight and not on the ground, without a swing or a walk; the
  card at all 8 sizes (or its panel); follow keeps up with a moving friend, stops beside them, and a key, a tap or their
  leaving ends it; Trade asks or walks up first; the window flow (offer, take back, accept the version shown, a change
  un-accepts, "Are you sure?", confirm), completion adds and removes exactly once, cancellation moves nothing, a full pack
  sends `trade_full`, the keyring cannot be offered, the window at every size, and the cloud-held ack.
- **Two games** (`tools/mmo-sim.js`, FakeWorld and `--room`): 14, Ann taps Ben and they trade 5 bread for 20 coins through
  the buttons, exactly once (one row, both acks, nothing more on a repeat or a reconnect); 15, Ben changes his offer after
  Ann accepted and nothing moves until both accept again; 16, closing, walking away and disconnecting each end a trade with
  nothing moved. `tools/dom-keys.js`: a real right-click on a knight opens the card with no browser menu.
## Accounts

Owner (2026-09-25): *"can you add to the admin consol to see all the active accounts even if they are looged out with
the ability to reset their passwords and see how much time they have logged playing and when they have logged in"*

An **Accounts** tab in the in-game Admin panel (`src/78-accounts.js`, added to 76's panel with `ADMIN.addTab`, after
Knights) lists every knight the world knows, online or not, and lets an admin give a player a new secret word. The
parent page shows the same rows. Server: `online/src/accounts.js` (the list), `store.js` (the logins), `room.js`
(opening and closing them), `world.js` (the routes).

### Logins: one row per socket

```
logins    (id INTEGER PRIMARY KEY AUTOINCREMENT, name_lc TEXT NOT NULL, started INTEGER NOT NULL,
           seen INTEGER NOT NULL, ended INTEGER)                      -- ended NULL while the socket is open
CREATE INDEX IF NOT EXISTS logins_by_name ON logins (name_lc, id)
accounts  + online_ms INTEGER NOT NULL DEFAULT 0                      -- every closed login's length, added up
settings  'logins_since'                                              -- when counting began (the first wake of this code)
```

Same migration rules as *The database*: `CREATE TABLE IF NOT EXISTS`, `migrate()` adds `online_ms` only when missing,
nothing dropped or rewritten, no new Durable Object class.

- The Room opens a row at `join` (`store.loginStart`) and puts its id on the socket attachment (`loginId`), so a
  hibernation nap keeps the same row open. A socket restored from before this code (no `loginId`) opens one at its
  join time.
- The row closes (`store.loginEnd`, `ended` = now) in `remove()`, which every way out goes through: the socket closing,
  the same knight logging in elsewhere (4000), a kick (4005), a ban (4003, from the game or the parent page), a new
  secret word, the world full, a socket dropped for speed. Closing adds its length to `accounts.online_ms` once (only
  the call that finds it open counts).
- Any message from a socket writes `seen` = now, at most once a minute (`SEEN_EVERY`). After every wake's restores the
  World calls `room.settleLogins()`: an open row that no restored socket carries (the world was restarted under it)
  ends at `seen`, the last time the world heard from it.
- The newest 50 rows per knight are kept (`LOGINS_KEPT`); older closed rows go when a new one opens. The total lives in
  `online_ms`, so it never shrinks.
- *Time online* counts only from `logins_since` (or the day the knight was made, if later). Both screens say so.
- *Knight play time* is a different clock: `player.playSeconds` in the knight's newest cloud save (the game adds to it
  every frame it runs unpaused, online or not). The server reads it with SQLite's `json_extract` (a runtime without
  JSON functions falls back to `JSON.parse` in a `try`); anything that is not a whole, finite, non-negative number
  under 10^10 reads as `null`.

### The rows (`GET /api/accounts` for an admin's game; `GET /api/admin/accounts` for the parent page)

Every account, sorted by name (each screen orders them itself: online first, then the most recently on):

| Field | Meaning |
|---|---|
| `name`, `role`, `created`, `lastSeen`, `saveAt`, `banned`, `mutedUntil` | as before (`role` `'player'`/`'admin'`; `mutedUntil` ms, 0, or `ALWAYS`) |
| `online` | true while a socket is open |
| `map`, `region`, `lv` | where the knight is now (null when not online) |
| `lastLogin` | when the newest login began (ms), or null |
| `lastOn` | now when online, else the later of `lastSeen` and the newest login's end |
| `onlineMs` | *Time online*: `online_ms` plus the open login so far |
| `countedSince` | the later of `logins_since` and `created` |
| `playSeconds` | *Knight play time* in seconds, or null (no save, or no clean number in it) |
| `logins` | the last 10, newest first: `[{at, ms, open}]`; `open` true for the one still going (its `ms` counts to now) |

`GET /api/accounts` needs a session whose knight's `role` in the database is `'admin'`, checked on every call:
401 `auth` without one, 403 `admin` for a player.

### A new secret word from the game: `POST /api/accounts/reset {name, pass}` → `{ok, name}`

Checked in this order, on every call: the caller's session is an admin's (401 `auth`, 403 `admin`); the knight exists
(404 `unknown`); it is not the caller (403 `self`: "change your own on the parent page"); it is not an admin (403
`isadmin`); `pass` is 4 to 200 characters (400 `pass`); the caller has made fewer than 3 resets in the last minute
(429 `wait`, with `wait: 60`; counted from `mod_log`). Then, the same as the parent page's `POST /api/admin/reset`:
a new salt and `makeHash`, the wrong-tries count cleared, **every session of that knight deleted**, and if online the
knight gets `{t:'error', code:'auth', why:'reset', text}` and close 4000 (the wire forgets the token; the login card
says "An admin changed your secret word. Ask them for the new one, then log in again."). One `mod_log` row: `act:
'reset'`, `by` the admin (or `'parent page'`), `target` the knight, `detail` empty. The word itself is never logged.

### The Accounts tab (`src/78-accounts.js`)

- Only while `NET.online()` and `NET.role === 'admin'` (76's `ADMIN.is()`); a demotion or a lost line closes it and
  forgets the list, the page and any word typed. The world's own refusal reads "Only an admin can see this."
- The list: Refresh, Up / Down, a drag scrolls, the mouse wheel scrolls; it asks again every 30 s while open.
  Each row: a green dot when online, the name (gold with the ADMIN tag for an admin), "Online now in <place>" or
  "Last on Fri 25 Sep, 7:42 pm", "Time online: 3h 12m (since Thu 24 Sep)", "Knight play time: 14h 5m", "Made <day>",
  and Banned / Muted tags.
- A still tap on a row opens that knight: the last 10 logins (day, time, how long; the open one "on now, 12m so far"),
  mute / ban state with Mute (the four lengths), Unmute, Ban (two taps), Unban and Kick — 76's own socket messages —
  and **Reset secret word**. None of these for an admin or for yourself.
- Reset secret word: a real `<input>` over the canvas, guarded like 71-login's and 74-chat's (capture-phase key
  listeners stop every key reaching the game); Next (4+ letters) → "Change Cohen's secret word to "dragon fire"?" drawn
  in the panel (no `confirm()`) → Yes sends the call → "Done. Cohen's secret word is now "dragon fire". Tell Cohen,
  then they log in with it." Each refusal code reads as one sentence. The word is forgotten when done or when the
  panel closes.

### The parent page

The accounts table gains *On now / last on*, *Last login*, *Time online* and *Knight play time*, ordered like the game's,
a line saying when time online began to be counted, and a *Logins* button per knight that opens the last 10 logins
under the row. A reset shows in *What admins did* ("MudGoll gave Sam a new secret word").

## The shared world (phase 1: the server runs the monsters)

Owner-approved plan (`~/.fanglands/work/phase1/spec.md`): the world server runs every monster in its own copy of the game,
so every knight on a map sees the same monsters at the same moment, RuneScape-style. It ships in stages, and every stage
ships switched off (or only watching). Until a map is switched to `world`, the keeper model above is exactly how that map
works, and the keeper code in `src/75-coop.js` stays as the fallback through all of phase 1.

### Stage 0: the meter (live) and the harness (built, not wired)

Players see nothing. The only server change that reaches the live world is the **meter**: it counts what the free plan
counts, so the cost gates before later stages read real numbers instead of guesses.

**The meter.** One row per UTC day in two new tables (each created only if missing, nothing else in the schema changes):

```
req_meter       (day TEXT PRIMARY KEY, ws_in INTEGER NOT NULL DEFAULT 0, http INTEGER NOT NULL DEFAULT 0, est_requests INTEGER NOT NULL DEFAULT 0)
req_meter_admin (day TEXT PRIMARY KEY, http INTEGER NOT NULL DEFAULT 0)
```

- `day` is the UTC date, `'2026-10-03'`. The free plan's day also starts at 00:00 UTC (8 pm in Ontario in summer, 7 pm in winter).
- `ws_in` counts every `webSocketMessage` the World receives. Pings answered by the runtime (`{"t":"ping"}`) never reach
  the World and are not counted.
- `http` counts every request that reaches the World's `fetch`: every `/api/...` call (the parent page's included) and every
  `/ws` upgrade. Static files (the game, `/admin`) never reach the World and are not counted.
- `est_requests` = `ceil(ws_in / 20) + http`: Durable Object requests as Cloudflare bills them (incoming WebSocket messages
  count 20 to 1). The free plan allows 100,000 a day.
- `req_meter_admin.http` counts, of those calls, the ones to `/api/admin/*` (refused ones included: Cloudflare bills them
  too): the parent page and the backups. The game's share is `http - admin` and `ceil(ws_in / 20) + http - admin`, and
  that is what the cost gate reads. A second table rather than a new column, because phase 1 only ever adds
  `CREATE TABLE IF NOT EXISTS`.
- The counts are kept in memory and written with one upsert per day touched: when 200 are waiting, when the last write was
  10 s or more ago (checked on every message and request), on every socket close and on every alarm. A nap can lose at most the
  last 10 s of counts. That is at most 360 rows written an hour while knights play (the free plan allows 100,000 rows written a day).
- Rows older than 400 days are deleted on the first write of each day after a wake.
- The admin export (`GET /api/admin/export`) includes `req_meter` and `req_meter_admin`.

`GET /api/admin/sim` (Bearer ADMIN_KEY) answers, for now, only the meter:

```
{ meter: { today: {day, wsIn, http, admin, gameHttp, est, gameEst}, days: [same, ... newest first, 14 days], freeLimit: 100000, waiting: n } }
```

`today` includes the counts not yet written (`waiting` says how many). Later stages add `modes`, `tick`, `boot`, `heap`,
`copies`, `fallbacks`, `move`, `combat` beside `meter`, and `POST /api/admin/sim` for the switches; nothing reads them yet.

The parent page (`/admin`) has a **Shared world** section with one line for today and the last 7 days under it:
"Today (UTC), read at 7:42:10 PM: the game sent 12,345 socket messages and made 678 calls, about 1,296 of the 100,000
requests a day the free plan allows (1.3%). This page and the backups made 40 calls on top, so about 1,336 in all (1.3%)."
The table's columns: day, messages, game calls, the game's requests, its share of the free plan, this page's calls, and
everything's share.

**The parent page's own traffic.** Its 10 s refresh reads who is online, the chat, the moderation log and the trades:
24 calls a minute while the page is in view. It reads the meter only when it opens and when Refresh is pressed, never
every 10 s, and while the page is hidden (another tab, a closed laptop, a locked iPad) the timer is stopped and it makes no
calls at all; shown again, it refreshes once and the timer starts again. `online/test/admin-page.test.mjs` runs the page's
script against a stand-in DOM and holds it to exactly that. Left open and in view all day it would still be 34,560 calls
(1,440 minutes × 24), which is why its calls are counted apart.

**The game copy** (built by every `./build.sh`, not imported by the Worker yet, so it is not deployed):

- `tools/build-sim.mjs` turns `index.html` into `online/src/sim/game.mjs` (git-ignored, rebuilt by `build.sh` and so by both
  deploy scripts): `export function makeGame(window) { ...the whole game...; return { peek, poke, window } }` plus
  `export const FILES` (each `src/` file's first line in the module, for reading stack traces). Every call is an independent
  world. An acorn + eslint-scope pass rewrites every name the script reads without declaring it to `window.NAME`, `Math`,
  `Date` and `performance` included, so each copy has its own seeded dice and its own clock. A small probe,
  `__simProbe()` (`Date.now()`, `new Date()`, `performance.now()`, `Math.random()` written as the game writes them), goes
  through the same rewrite, so a check can read the clock and dice exactly as the game's code does. `--strip` (what `build.sh` writes) turns the 12
  presentation files into no-op stand-ins (a stand-in remembers what is written to it, so `title.active = false` reads back
  `false`) and removes the drawing, HUD, panel, key-help and self-test registrations; `--keep-tests` keeps the self-tests.
  Every `HOOKS` function a copy holds is tagged with the file that registered it (`fn.__file`, e.g. `'35-night'`).
  acorn 8.18.0 and eslint-scope 8.4.0 are `online/` devDependencies; `build.sh` installs them with `npm ci` when they are missing.
- `online/src/sim/window.js`: `makeWindow({ seed, now })` is the screen-less browser one copy lives in (stub DOM, a canvas
  that swallows everything, memory localStorage), with a seeded `Math`, a clock the host drives (`window.__now`, in ms;
  `Date.now()`, `new Date()` and `performance.now()` read it) and a sim-time scheduler: `setTimeout`/`clearTimeout` are
  recorded and `window.__runTimers()` runs the ones that are due; `setInterval` and `requestAnimationFrame` do nothing.
- `src/79-worldkeeper.js`, the **stand-in**: in a browser it does nothing (no `window.__worldKeeper`). In a copy, the host
  sets `window.__worldKeeper = { map, worldGen, send(msg), reseed() }` before the game loads, and the file:
  - makes `save()` a no-op;
  - with `worldGen: false`, makes `generateWorld()` a blank map with no spawns (instances that prove they build the same
    without the overworld; `tools/sim-suite.mjs` checks each one);
  - gives the copy `window.WORLDKEEPER = { map, me, start(), step(dt), deliver(msg), off }`. `start()` starts a new game the
    way the title does, calls `reseed()` (the host's fresh dice from there on, so a copy's run never depends on what its
    build rolled), enters the instance for an instance map, then points `NET` at a virtual socket: `NET.online()` is
    true and `NET.me` is `'@world:<map>'`, which the socket's own welcome names keeper. Everything the copy sends goes to
    `send(msg)`; `deliver(msg)` hands the copy a message as if the world sent it (a knight's `p`, `left`, `hit`, `boss_call`).
  - parks the stand-in knight dead on the solid tile (0, 0) with `deadT` zeroed before every `step`, so it never respawns
    (`respawnPoint()` and the instance's `leaveInstance()` never run) and 75-coop's keeper half aims every monster at a real
    knight (`stepRemote`);
  - applies the `serverOff` list: the `HOOKS` entries, by file and hook name, that would act on the dead stand-in. The
    first list is the Stage 0 audit (below); a file leaves it when it is ported.
- `online/src/sim/host.js`, **SimHost** (not wired to the Room until Stage 2): one copy per map, `boot(map)`,
  `setKnights(map, list)` (accepted presence `{n, x, y, fx, fy, dead, def, lv, att, mh, law, spd}`, delivered to the copy as
  `p`, and `left` for a knight who went), `deliver(map, msg)` (queued, run at the start of the next tick), `tick()`,
  `start()`/`stop()`, `drop(map)`, `stats()`. A tick is every 100 ms by a `setTimeout` chain (never alarms): it sets
  `window.__now`, runs due timers, drains the queued messages, refreshes the knights, runs 3 substeps of `update(1/30)` and
  collects what the copy sent. At most 3 catch-up ticks; beyond that the time is skipped and counted. The loop stops 60 s
  after the last knight leaves; a copy is dropped 60 s after its map empties. The cap is the overworld plus 3 instance copies.
  The **watchdog** hands a map back to the keeper path (`onFallback(map, reason)`, reasons `boot`, `throws`, `slow`, `heap`,
  `cap`) on a boot throw, 3 tick throws within 10 s, 3 ticks in a row over 25 ms, the heap over budget, or more copies
  than the cap. Inside workerd the clock only moves on I/O, so there a tick's cost is read as the lateness of the next timer.
- `tools/sim-suite.mjs` (a deploy gate):
  - 0, **what the stripped copy reads from the stripped files.** A stripped name is a stand-in that reads as a truthy
    proxy, `0` as a number and nothing when iterated, so a game rule that reads one would quietly differ on the server.
    Every place a kept `src/` file reads the value of a stripped name (or of the `window.HK`, `WIKI`, `ICONS`, `LIGHTS`,
    `PLAYTHROUGH` stand-ins) must be on `STRIP_READS` in `tools/build-sim.mjs`, by name and file, with the reason it is
    safe. Not counted: `typeof`, a call whose result is thrown away (`sfx('hit');`), a write, and code nobody can reach
    once the drawing registrations are gone (named functions whose only callers were removed, found by scope analysis).
    Today: 289 reads of 29 names, all listed (`node tools/build-sim.mjs --strip --reads` prints each with its line). Two
    reads in update code were looked at closely: `title.active` (75-coop, 91-royalmine) reads `false`, as for a knight past
    the title; `HK.held('block')` (55-riding) is a truthy stand-in, but only reached for the copy's own knight on a machine,
    and the parked stand-in has none. The render wrappers' extra work (43-settings' sound flags, 91-cloudkingdom re-mounting
    its buildings) never runs in a copy, which never renders; 91's is also done by `INSTANCES.enter`/`leave`, `load()` and
    `respawnPoint()`.
  - 1, the whole `HOOKS.selfTest` suite through `makeGame` (**full build only**) with the same pass count as
    `tools/headless.js`. Through the stripped build the suite cannot run: its first chapter presses panel buttons that only
    the stripped drawing makes. Check 0 and the parity runs (3a, 3b, 4b) stand for the stripped build; that is the gap the
    owner's Claude accepts, or not, before Stage 2. Decided 2026-10-03: accepted for Stages 0 and 1 (no copy runs
    anything a player sees). Before Stage 2 turns a copy on for any map, every selfTest check that exercises monsters,
    combat, drops, instances or night must also run through the STRIPPED build (give the copy the stand-ins those
    checks press, or mark the UI-only checks and run the rest), with the same pass count.
  - 2, two copies share nothing (`INSTANCES`, `COOP`, `NIGHT`, `monsters`, the map, `HOOKS`, the knight); 2a, each has its
    own dice and clock **read through the game's own code** (`rint()`, `nowMs()`, the Royal Mine's vein clock and the probe:
    an hour on in one copy is an hour on there and nowhere else); 2b, both generated modules name no clock, dice, timer or
    global of the machine: every name they do not declare is on a fixed list of plain built-ins kept in the suite itself.
    Leaving `Date`, `Math` or `performance` un-rewritten turns 2a and 2b red.
  - 3, stripped equals full after 600 ticks (same map hash, same monster and knight state hash), alone and through SimHost
    with 5 knights fighting; 4, the stand-in never respawns and never leaves an instance; 5, each instance's
    `worldGen: false` build matches its full build.

**Deploy gates.** `online/deploy.sh` and `~/.fanglands/tools/deploy-test.sh` run, each only when its file is there:
`node tools/sim-suite.mjs`, `node tools/mmo-sim.js --sim` (once `tools/mmo-sim.js` knows `'--sim'`, written that way),
`node tools/mmo-sim-world.js`, `node online/test/atlas-drift.mjs`. A red check never deploys.

**The audit and the first serverOff list** (`node tools/sim-audit.mjs`; the log is
`~/.fanglands/work/phase1/sw-0/audit.json`). 30 minutes of game time on the overworld copy with 4 scripted knights touring
all 21 regions (every named boss there called), then 5 minutes in each of the 9 instances with two knights, every boss
called. Every monster created, removed or hurt was logged with whose code did it. Through the 75-coop path (knights' hits
routed to the keeper): 4,564 hurts and 241 kills on the overworld, and every instance's fights. Outside it, only these
`HOOKS` entries, which are the first `SERVER_OFF` list in `src/79-worldkeeper.js`:

| File | Hook | What it did on its own | Leaves the list in |
|---|---|---|---|
| 20-hollowford | update | cleared the War Shed's Barrelbeast away after it fell (5) | Stage 8 |
| 28-thefang | update | the Fang's own rest killed it (1) | Stage 6d |
| 33-goblincity | update | cleared the Gnasher away after it fell (5) | Stage 8 |
| 66-storm | hit, update | the Thunderbird's own hurts (10 + 4) | Stage 8 |
| 91-royalmine | update | the golem's split: 21 golemlings and golems made and removed, the giants hurt and killed | Stage 8 |

No hook changed the parked stand-in (its place, hp, death, mount or speed). Night zombies, graves and the other
knight-centred spawners made nothing: they spawn around `player`, who is dead. With the list on, the audit's only
monsters made outside the 75-coop path are the two bosses its `boss_call` wakes (the Barrelbeast, the Gnasher).

**What the copies cost, measured** (3 Oct 2026, MacBook Pro, load average about 10 from other builders' runs, stripped
build, `tools/sim-bench.mjs` under `wrangler dev --local` 4.92.0, workerd's local runtime capped at compatibility date
2026-05-22; raw figures in `~/.fanglands/work/phase1/sw-0/bench.json`):

| | workerd (local) | node 26 |
|---|---|---|
| Overworld copy boot (the game's load code, generateWorld, a new game, the stand-in's start) | 1,160 / 1,404 / 1,434 ms (three boots) | 671 ms (sim-suite); 1,084, 1,338 and 1,706 ms in a later run under the same load |
| Tick, overworld (119 monsters), 1 knight | mean 0.535 ms; p50 1 ms, p99 1 ms, max 2 ms | p50 0.289 ms, p99 1.054 ms |
| Tick, 5 knights | mean 0.433 ms; p50 0 ms, p99 1 ms, max 2 ms | p50 0.432 ms, p99 4.756 ms (max 37.9 ms once) |
| Tick, 20 knights | mean 0.458 ms (0.533 ms timed from outside); p50 0 ms, p99 1 ms, max 1 ms | p50 0.450 ms, p99 2.061 ms |
| SimHost's own 10 Hz loop, 20 knights, 10 s | 100 ticks of 100, 0 skipped, no fallback; lag-timed p50 2 ms, p99 3 ms (the zero-delay timer's own cost included) | |
| Heap: the module alone / the overworld / the overworld + 3 instances (deepholm, aerie, spider_den) | 5.6 MB / 17.0 MB / 30.7 MB used (6.0 / 34.6 / 59.4 MB total) of the 128 MB isolate | |
| Instance boot, full build / `worldGen: false` | spider_den 926 / 25 ms, war_shed 909 / 36, deepholm 1,219 / 22, tinker_lab 1,057 / 24, afterlands 905 / 20, aerie 938 / 24, coalmine 907 / 22, stormfront 900 / 36, royalmine 950 / 16 | 665 to 815 / 15 to 19 ms |

workerd's clock moves in whole milliseconds, so a single tick there reads 0, 1 or 2 ms; the means are 600 ticks timed
together (inside, and from outside less an empty round trip of 3.4 ms; the two agree). The zero-delay timer does move
the clock inside workerd (a boot timed inside matched the outside time to 1 to 3 ms), so SimHost's `lag` timing works there.
`worldGen: false` saves about 900 ms per instance copy, but only these instances build the same without the overworld
over 300 ticks with two knights fighting (`tools/sim-suite.mjs` check 5): **war_shed, tinker_lab, stormfront**. The others
(spider_den, deepholm, afterlands, aerie, royalmine) drift apart from the first ticks in their monsters' idle wandering,
and coalmine had no monster to fight in 300 ticks; they keep the full build. The cause of the drift is not traced.

**The proof on the test world** (`~/.fanglands/work/phase1/sw-0/proof/meter-proof.js`, 3 Oct 2026, nobody else on): Probe
Knight and Probe Two played side by side for about a minute in two real browsers, the keeper model exactly as today (Probe
Knight kept the overworld; neither game had a stand-in). The meter grew by exactly the 1,201 socket messages the two games
sent (972 from the keeper, whose `mon` stream is most of it, 229 from the other) and the 23 calls that reached the World (21
from the pages, among them 13 cloud saves and the 2 socket opens, plus the proof's own two reads), and the estimate read
ceil(3,251 / 20) + 77 = 240 for the day so far.

After the admin column (`meter-proof-2.js` beside it, same day, test world redeployed): the two games' 1,010 socket
messages counted exactly; the 7 `/api/admin/*` calls (5 reads, one refused, the final read) landed in the admin column
and the pages' 21 calls in the game's. One of three runs counted 2 game calls more than the pages made; the data does not
show where they came from (the test world was open to other builders, and Probe Two was on it minutes before). The page
itself, on a local `wrangler dev` (`admin-traffic.js`, iPad size): opening made 9 calls with one meter read, a minute in
view 24, a minute hidden 0, 20 s shown again 12, and the admin column grew by exactly those calls plus the final read.

## Safety rules (binding)

- Invite-only signups. Names and chat pass `online/src/filter.js`. Chat is logged with the name and time.
- No free text anywhere else: no profiles, no descriptions. Quick-chat phrases are the default on touch.
- Rate limits on every message type (table above). A socket over its cap is dropped with `error: bad`.
- The admin page is a single HTML file behind `ADMIN_KEY`; it never leaves Ethan's hands.
- Saves are kept in three versions so a broken save can be rolled back from the admin page.
- A secret word is changed only by the parent page, or by an admin's game for a player (never another admin's, never
  the admin's own), at most 3 a minute; the knight is sent out and every session ends; `mod_log` says who. The word
  is never logged.
- Admins: only the parent page makes one. The server reads the role from the database on every admin message; the
  game hiding buttons is not the lock. Every moderation action, party and party hat is written to `mod_log` and shown
  on the parent page. Nobody can mute, kick or ban an admin from inside the game.
- An admin's powers change only that admin's own knight; *Unlock everything* runs only after a pinned backup, which
  the parent page can restore too.
- Trades: only between two knights on one map who both said yes, both accepted and both confirmed the very same offers; the
  world holds the offers and moves nothing that does not add up. Every finished trade is kept and shown on the parent page.

## Where things are

- Play: https://gorkscape.ca (the invite code is with Ethan; nothing on this page is public).
- Parents: https://gorkscape.ca/admin — accounts, reset a forgotten secret word, ban, the invite code, the chat log, save rollback,
  who is an admin (Make admin / Make player), mutes, the moderation log, pinned backups, every trade. Needs the admin key.
- Parents: https://gorkscape.ca/admin — accounts (last login, time online, knight play time, the last 10 logins), reset a forgotten secret word, ban, the invite code, the chat log, save rollback,
  who is an admin (Make admin / Make player), mutes, the moderation log, pinned backups. Needs the admin key.
- The old address https://ethanbender.github.io/fanglands/ is the offline copy; its title screen has no login.

## Testing

- `HOOKS.selfTest` checks in every online file, using `NET.useFake(...)` for the wire.
- `tools/mmo-sim.js`: two headless game contexts + the real `Room` class from `online/src/room.js` (`--room`) or the
  FakeWorld (the contract written out again), wired with in-memory sockets. Proves login, presence relay, keeper
  election, hit routing, the kill going to the right knight, chat, and handoff when the keeper leaves; then the admins
  and drop parties (*Admins and drop parties*, *Testing*). Run both ways in `deploy.sh` before every deploy.
- `node --test online/test/` for the server's own logic (password hashing, filter, room routing, rate caps, roles,
  moderation, the store and its migration, drop parties and the party-hat odds, trading).
- `tools/mmo-sim-admin.js` and `tools/mmo-sim-party.js`: the admin and party scenarios, two games against the real
  Room (see *Admins and drop parties*, *Testing*). `deploy.sh` runs them with the others.
