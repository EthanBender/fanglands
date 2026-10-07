# Fanglands Online — the contract

Owner (2026-09-24): *"we have a domain gorkscape; repurpose it for Fanglands and serve it on that domain, and make it
an online MMORPG so Cohen and his friends can log in and play together."*

This document is the contract between the server and every online feature file. Change it before you change
either side. `src/70-net.js` is the wire; the server lives in `online/`.

## What it is

- **https://fanglands.com** serves the game (the same `index.html` the GitHub Pages address serves) from one
  Cloudflare Worker named `fanglands`. Nothing runs on any of our computers. `www.fanglands.com` sends to it.
  The first address, **gorkscape.ca**, sends each browser to fanglands.com, carrying its login and settings (see
  *Two addresses*); its `/api` and `/ws` keep answering, so nothing already running there breaks.
- One **Durable Object** (`World`, SQLite-backed, the singleton `idFromName('world')`) holds the accounts, the
  cloud saves, the chat log and the live room. It costs nothing on the Workers free plan at this scale.
- **Invite-only.** A new knight needs the invite code Ethan hands out. No email, no real names, nothing public.
  Names and chat are word-filtered; chat is kept so a parent can read it at `/admin`.
- **One knight per account.** Online there are no save slots: the account is the knight, saved in the cloud, so
  the same knight plays from the iPad, the laptop, or a friend's house. There is no *Play alone* online: every knight
  lives on the server, and knights a device saved before are kept and offered (*Every knight lives on the server*).
- **The GitHub Pages address keeps working** exactly as before, offline and single-player. The title screen on
  fanglands.com can pull a knight across from it (see *The bridge*).

## The model, honestly

The game is a client-side simulation (2 MB of it, 626 tests). It is not being rewritten as a server-side
world. Online Fanglands is a **listen server per map**:

1. Everyone on the same map sees each other, chats, and can hand items over.
2. On each map (the overworld, or one instance), the server names the knight who has been on that map longest the **keeper** (ties: game join time, then name), so a keeper only changes when it leaves — or when it goes quiet: a keeper whose game has sent neither monsters nor presence for 3 s (`KEEPER_STALE`) while someone who is playing shares its map (a locked phone, a sleeping tab; a paused game or one on the title screen with nobody near it: with a knight near, a paused keeper streams its frozen monsters, as it always did, and keeps the map) hands the map to that knight the moment his next presence arrives, and goes to the back of the line until that knight leaves. No alarm watches for it while nobody plays (each alarm is a billed request: on 3b6d6b4 two idle knights on one map cost 1,198 alarms an hour, measured under wrangler dev on 4 Oct 2026); a map where nobody is playing has nobody to hand it to, so nothing happens there. So that the hand-over still comes 3.05 s after the keeper's last word, as it did, when the one playing stands still (one presence a second), a presence that finds the keeper quiet for more than 2 s (`KEEPER_STALE - KEEPER_WATCH`) books one alarm for that moment, on that map only; a keeper who leaves or closes the tab hands over at once, with no alarm (`online/test/room.test.mjs`: "a hand-over is as fast as before"). A wake (a nap, a deploy, an eviction) rebuilds the Room from the sockets and names each map's keeper without a word: the knight longest on the map, whatever order the sockets come back in, and that need not be the knight the pages were told before the nap. His grace holds against a knight who arrives on the map after the wake (as it always did), but not against one who was there through the nap and plays: a nap means every socket has been quiet for at least 10 s (a playing game sends a presence a second), so a restored keeper who has said nothing since the wake is plainly not playing, and the first presence or snapshot from another knight restored there hands the map to that knight at once, and everyone there hears it; when the first word is the restored keeper's own, everyone there hears, once, that he keeps it (`Room.retell`); a page that already holds that name changes nothing. Nor is a map ever handed from one silent knight to another (that would only turn a silent page's monsters into puppets nobody streams). So the knight who plays first after a nap keeps the map from his first word, whichever socket the wake took first (`room.test.mjs`: "after a nap the knight who plays first keeps the map from his first word ..." and "after a nap the world and both pages agree on the keeper from the first word on the map ..."). A keeper's game sends no empty `mon` heartbeat any more: its presence (at least once a second while it plays) says it is alive. The
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
  wrangler.toml      name = "fanglands"; assets ./public (run_worker_first = true); DO binding WORLD -> class World
                     (new_sqlite_classes); routes fanglands.com + www.fanglands.com + gorkscape.ca + www.gorkscape.ca
                     (custom_domain = true: the DNS and the certificates are made for us)
  src/worker.js      the Worker: /api/*, /ws -> the World object on every address; the front door (handoff.js) for
                     the old address and www; everything else -> static assets
  src/handoff.js     two addresses: the front door, the hand-over and landing pages, the offer and claim (*Two addresses*)
  src/handoff-merge.js  the two rules the pages carry as text: what a browser arriving on fanglands.com writes, and
                     which knights a browser holds that are not on the server
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
| `POST /api/signup` | `{name, pass, invite}` | `{token, name}` | name 2–16 chars, letters/digits/spaces, filtered; pass ≥ 4 chars ("your secret word"); invite must match; 403 `words` with `until` from a place a knight is kept out from (see *Word strikes*) |
| `POST /api/login` | `{name, pass}` | `{token, name}` | case-insensitive name; 5 wrong tries → 60 s wait (`code: "wait"`); a name an admin changed still logs in (as the new one: `name` is the new name); the right secret word while kept out for bad words is 403 `words` with `until` and no session (see *Word strikes*) |
| `POST /api/logout` | — | `{ok}` | drops the session |
| `GET /api/me` | — | `{name, created, saveAt, online, role}` | `role` is `'player'` or `'admin'` (see *Admins and drop parties*) |
| `GET /api/save` | — | `{save, at}` (`save` null when none) | the save is the slot JSON string, verbatim |
| `PUT /api/save` | the save JSON string | `{at}` | ≤ 512 KB; server keeps the last 3 versions; goes through while kept out for bad words |
| `GET /api/save/pin` | — | `{at, bytes}` or `{at: null, bytes: 0}` | admins only (403 `admin`): the pinned backup (*Admins and drop parties*) |
| `POST /api/save/pin` | the save JSON string | `{at, pinned}` | admins only; an existing pin is kept unless `?replace=1` |
| `POST /api/save/restore` | — | `{save, at, ver}` | admins only; the pin becomes the current save and is removed; 404 `nopin` |
| `GET /api/status` | — | `{ok, online, names}` | no auth; the title screen uses it to say who is on |
| `GET /api/accounts` | — | `[account]` (see *Accounts*) | admins only (403 `admin`, 401 `auth`): every knight, online or not, for the in-game Accounts tab |
| `POST /api/accounts/reset` | `{name, pass}` | `{ok, name}` | admins only: a new secret word for another player; 404 `unknown`, 403 `self`, 403 `isadmin`, 400 `pass`, 429 `wait` (see *Accounts*) |
| `POST /api/accounts/strikes` | `{name}` | `{ok, name}` | admins only: clear a knight's word strikes and any lockout; 404 `unknown`, 403 `self`, 429 `wait` (see *Word strikes*) |
| `POST /api/accounts/rename` | `{name, to}` | `{ok, from, name}` | admins only: a new name for a player; 404 `unknown`, 403 `self`, 403 `isadmin`, 400 `name`, 409 `taken`, 429 `wait` (see *Renaming a knight*) |
| `GET /api/admin/accounts` | — | `[account]` (see *Accounts*) | `Authorization: Bearer <ADMIN_KEY>`; the same rows as `GET /api/accounts` |
| `POST /api/admin/reset` | `{name, pass}` | `{ok}` | new secret word; works on anyone, admins and the parent's own knight too; the knight is sent out, written to `mod_log` (`by: 'parent page'`) |
| `POST /api/admin/ban` | `{name, banned}` | `{ok}` | banned knights cannot log in; their save stays; written to `mod_log` |
| `POST /api/admin/strikes` | `{name}` | `{ok, name}` | clear anyone's word strikes and lockout, an admin's too; written to `mod_log` |
| `POST /api/admin/rename` | `{name, to}` | `{ok, from, name}` | a new name for anyone, an admin too; 400 `name`, 409 `taken`; written to `mod_log` |
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
401/403 on signup), `taken` (name already used; also 409 on signup), `signups` (429 on signup: ten new knights from
one place this hour already, *Two addresses*), `name` (a name the filter refused), `full`,
`auth` (token dead), `kicked` (an admin sent the knight out; the session stays good), `words` (kept out for bad words,
403 with `until`: "You're kept out until 7:42 pm tomorrow for bad words.", in the device's own clock; the session stays
good for when the time is up). Any call with a session but `PUT /api/save` answers `words` while the knight is kept out. Anything else, or
no answer at all, reads "The world is asleep right now."

## The socket

`wss://fanglands.com/ws?token=<session>` (the page's own address: `wss://gorkscape.ca/ws` still works for a page open there). JSON text frames, one message each, always with a string `t`.
The server hibernates idle sockets and answers `{"t":"ping"}` with `{"t":"pong"}` without waking.

Maps are named `over` (the overworld) or the instance id (`INSTANCES.active.id`). Presence is only relayed
between knights on the same map; chat and the roster go to everyone.

### Client → server

| `t` | Fields | Cap | Meaning |
|---|---|---|---|
| `hello` | `v: 1, map?, caps?, atlas?` | once | first frame after open; the server answers `welcome`. Without `map` the knight is on `over` until its first `p`. `caps` and `atlas`: see *The shared world*, Stage 1 |
| `p` | `map, region, x, y, fx, fy, mv, wt, hp, mhp, lv, look, mech, dead, def, act, sw, j, spd, s` | 8/s | presence. `region` is the region or instance name the roster shows; `look` is the serialisable part of `playerLook()`, with the six worn item ids in `look.gear` (see below); `def` is `playerDefRoll()` so the keeper can roll monster hits against you; `act` is the action type or null; `sw` counts the swings the knight has started (one more each time `player.attackT` goes up): a friend's game plays the 0.22 s swing when it goes up, and a change of it sends presence at once |
| `chat` | `text` | 1 per 1.5 s, ≤ 120 chars | filtered and logged server-side, then sent to everyone |
| `mon` | `list, full?` | 8/s, keeper only | monster snapshot for the map (format below); `full: true` only in the one answer to the world's `snap` (Stage 2): every monster the game runs, not only those near a knight |
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
| `welcome` | `me, at, keeper, role, atlas?, sim?` | you are in; `keeper` is the keeper of your current map (may be you); `role` is `'player'` or `'admin'`; `atlas` is the world's Atlas hash (*The shared world*, Stage 1); `sim` says which maps the world runs itself (Stage 2) |
| `who` | `list: [{n, map, region, lv, role}]` | everyone online; sent on join/leave and at most every 2 s |
| `p` | `n` + the presence fields + `role` | a knight on your map moved; `role` is the server's word, never the sender's |
| `left` | `n, map` | that knight left your map (or the game) |
| `chat` | `n, text, at, role` | already filtered |
| `keeper` | `map, n, server?` | the keeper of your map changed (you may have become it); `server: true` when the keeper is the world itself (`n` is `'@world:<map>'`, Stage 2) |
| `mon` | `n, list, k?, at?` | the keeper's snapshot (you are not the keeper); from the world itself also its tick `k` and the world's clock `at` in ms (Stage 2) |
| `snap` | `map` | (to the keeper, and only to a game whose `caps` has `snap`) the world is taking your map over: answer once with `mon` `full: true` listing every monster you run (Stage 2) |
| `sim` | `maps, hz, caps` | the places' modes changed while you are connected (the parent page, the watchdog): the same `sim` as `welcome`'s, anew (Stage 2) |
| `hit` | `n, nid, dmg, knock, bomb` | (to the keeper) apply this hit for knight `n` |
| `kill` | `nid, type, x, y` | you got the kill: grant XP, drops and quest credit locally |
| `hurt` | `dmg, x, y` | a monster hit you: `hurtPlayer(dmg, x, y)` |
| `gift` | `gid, from, id, qty` | take it if it fits, answer `gift_ok`/`gift_no` |
| `gift_ok` / `gift_back` | `gid, id, qty` | the receiver took it / it comes back to you |
| `boss_call` | `n, id, first?` | (to the keeper) knight `n` on your map asks you to wake the named boss `id`; `first` is passed on only when it was exactly `true`; your game decides (see *Named bosses*) |
| `boss_wait` | `id, left` | the keeper says the boss you asked for rests there `left` more seconds: the boss file says so in m:ss and your ask is over |
| `error` | `code, text` | `auth` (token dead: the client forgets it and shows the login), `elsewhere` (the same knight opened on another device: this socket is closed with code 4000 and must not reconnect), `wait`, `full`, `banned` (close 4003, no reconnect), `kicked` (close 4005, no reconnect), `words` (kept out for bad words, with `until` and `n`: close 4006, no reconnect, the session kept), `renamed` (an admin gave the knight a new name, with `name`: close 4007, the wire comes straight back as it), `admin` (that was an admin message), `bad` |
| `strike` | `n, text` | a chat line of yours had a swear word or a slur in it: `n` 1 is the warning, 2 the last warning (the third is `error` `words`); see *Word strikes* |
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

`{tunic, hair, shoulder, helm, body, shield, weapon: {shape, color}, tool, toolColor, toolSwing, toolHeat, rod, fists, hat, girl, block, gear}` — the
knight's look, with the weapon reduced to its shape and colour. `gear` is `{helm, body, legs, shield, cape, weapon}`: the
ids of the six worn items, each a string or `null` (the obsidian helm, worn in `equip.head`, is sent as `gear.helm`).
A look with `gear` is drawn by `src/82-knightgear.js` (each item in its own shape, legs and capes included), so a friend
sees exactly your gear; other people's looks (townsfolk, guards) are still drawn by the old `drawHuman`. On arrival
(`src/73-players.js`) only ids that are real items for their slot are kept; a slot with no known id (an old client sends
no `gear` at all; a newer client may send an item this page does not know) is read back from the colour fields, which
map back to exactly one item each (`hat: 'red'` is `party_hat_red`), and a colour that is no item draws that family's
plain piece in that colour. Old clients ignore `gear`. `toolSwing` is whether the tool in his hand swings (a pick, an axe) or
is held still (82-knightgear's `stone`, the royal mine's warming stone, and `rope`, the lobster pot's); `toolHeat` (0 to 1)
is how hot that stone is; a look from an older game has no `toolSwing`, and its tool swings. `block` is `true` while his
shield is raised (47-outliers), and a change of it sends presence at once. A knight on a machine
adds `mech: {kind, hp, maxHp}` (`kind` is `walker`, `dozer`, `beast` or `horse`; a bulldozer with fitted upgrades adds
`up`, a comma list of `drill`, `irondrill`, `ram`, `boiler`, and a change to it counts as a look change) and is drawn on
it by `src/84-mountlook.js` (`MOUNT_LOOK.rider`): on Cinder in her saddle, or in the seat of his machine in the monster
refit's machine art, his name over it. A `kind` this page does not know is drawn as the walker. The server relays `mech`
unchanged. Mounts add `mount: id`. A worn party hat adds `hat: '<colour>'`
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

`bridge.html` at the repo root is served by GitHub Pages. The online game loads it in a hidden iframe and posts
`{fanglands: 'give-save'}`; the bridge answers, only to the game's own addresses (`fanglands.com`, `www.` and `test.`
of it, and the same three of `gorkscape.ca`),
with `{fanglands: 'save', slots: {1: {save, at} | null, 2: ..., 3: ...}}` holding the three slot strings and
their `.at` stamps (a browser from before the slots existed hands its legacy `fanglands.save.v2` over as slot 1
with `at: 0`). The login flow waits up to 3 s, believes answers only from `https://ethanbender.github.io`, and
offers the most recent slot when the account has no cloud save yet. Nothing is deleted on the old side. Online
the knight lives in slot 1; a knight saved only on the device (from *Play alone*, before) is moved to an empty slot
first (`fanglands.slot.1.online` marks slot 1 as the cloud knight's; see *Every knight lives on the server*).

The copy GitHub Pages serves is the one on GitHub's `master`: the list of addresses it answers changes there only
when `master` is pushed to GitHub. Until then it answers only gorkscape.ca, so a knight on fanglands.com asking it
gets no answer and the login flow starts fresh after 3 s, exactly as when the old address has nothing. Browsers now
keep a hidden iframe's storage apart from the same address opened on its own (Safari on the iPad always has, Chrome
and Firefox do too), so the bridge mostly finds nothing in any case. A knight saved only in a browser on gorkscape.ca
comes into an account on gorkscape.ca itself (*Two addresses*: that browser is not sent across until it has).

## Two addresses

Owner (2026-10-03): *"can you port everything over to the new proper domain but have gorkscape redirect to fang lands
so anyone with the old domain doesnt notice the diffrance for now?"*

**fanglands.com** is the game's home. The same Worker, the same World, the same accounts answer on every address
below; only what a *page* gets differs. With the switch on (*Shipping it, and the switch*):

| Address | A page (the game, `/admin`, any HTML) | A file | `/api/*` and `/ws` |
|---|---|---|---|
| `fanglands.com` | the game | the file | the world |
| `www.fanglands.com` | 301 to `fanglands.com`, same path and query | 301 the same way | the world |
| `gorkscape.ca`, `www.gorkscape.ca` (each its own storage) | the hand-over page (below), then the same path on `fanglands.com`, or the game right there | the file, as before | the world, exactly as before |
| the same, with `fl_stay=1` (a home-screen icon) or `fl_here=1` (a tab kept for a knight only on its device), or this one load's `?fl_hop=stay` / `?fl_hop=here` from those hops | the game, right there, as today | the file | the world |
| `fanglands.com/handoff`, `test.fanglands.com/handoff` | the start and landing page (below) | | |
| `gorkscape.ca/handoff-stay`, `/handoff-here`, `/handoff-leave` | set `fl_stay`, set `fl_here` (each then 302 to the path with `fl_hop=stay` / `fl_hop=here` added to its query), clear `fl_stay` (302 to the path) | | |
| `test.fanglands.com`, `test.gorkscape.ca` | the same, on the test world | | |

`run_worker_first = true` in `wrangler.toml` sends every request to the Worker first, so it can see the address before
a file is served. A page is what the browser says is a page (`Sec-Fetch-Dest: document`; a frame, a script or any
other destination is a file even if it accepts HTML), or for an older browser one that accepts `text/html`, or `/`,
`/index.html`, `/admin`.

### What travels, and why not a plain redirect

Every knight lives on the server (feat/no-play-alone: no Play alone; a knight loads from the world at login, on any
address). But a browser keeps its storage per address (and `www.gorkscape.ca` is a different address from
`gorkscape.ca`), so a plain redirect would land a kid on fanglands.com logged out, with kid mode and text size back at
the start. So **only the login and the settings travel**, and nothing else ever can (`CARRY` and `HINT_RE` in
`online/src/handoff-merge.js`; the World refuses any other key with 400):
- the login `fanglands.session` and the last name typed `fanglands.lastname` (`src/71-login.js`);
- the settings `fanglands.settings` (`src/43-settings.js`: sound, music, kid mode, taps, stick side, text size, speech
  speed, damage numbers, shake, levels, minimap, words, Fight back, the quest helper) and the three older keys it still
  writes, `fanglands.muted`, `fanglands.music`, `fanglands.kidmode`;
- the hint counters `fl_learn_<id>` and `fl_coach_<id>` (`src/59-hudkit.js`), so a kid is not taught the bag again.

Never a save slot, an owner note, the old single save or the parent page's key: the knight is on the server and loads
at login on fanglands.com. An offer is at most **8 KB** (the login first, then the settings, then the hints while they
fit). A hidden iframe cannot fetch storage either (Safari keeps an iframe's storage apart by the page it sits in), so the
old address's own page reads it and hands it over through the world.

### Who is sent across

The hand-over page (`online/src/handoff.js`, `handoverPage`) decides in this order, in the browser, before any game is
loaded:

1. **An installed home-screen app** (`navigator.standalone`, or `matchMedia('(display-mode: standalone)')`; a desktop
   browser's fullscreen is not one): never sent. It goes to `/handoff-stay?to=<path>` (below) and stays.
2. **`https://gorkscape.ca/#kept`** (the admin's list of the backups a device keeps, `src/72-deviceknights.js`): not
   sent, so that list stays reachable on the device that holds the backups. The page goes to `/handoff-here` (below).
3. **No login**: nothing is known to be on the server, so **any knight saved here** keeps the tab (a *device-only
   knight*): the page goes to `/handoff-here?to=<path>`, which sets `fl_here=1` for one minute (only when the page on
   this same address asked: `Sec-Fetch-Site: same-origin`) and sends back to the path with `fl_hop=here`, where the
   Worker serves the game exactly as today. The game clears `fl_here` as it boots (`src/00-handoff.js`), so a reload or
   the next visit asks the hand-over page again, and shows a calm one-time note (OK; `fanglands.handoff.tabnoted`):
   *"Fanglands has a new home: fanglands.com. This device has a knight saved on it that is not in an account yet, so you play here for now. It is safe. Ask Ethan to add it to your account."* Such a browser keeps playing on the old address (same world) until the admin moves that knight; nothing is lost. The kid logs in
   there; the game settles the knight (feat/no-play-alone's `src/72-deviceknights.js`: its own copy goes up if the world
   is behind, a knight no account owns is offered to a new account). **Once nothing is left only on this device, the
   next visit is sent across.** With no login and no knight saved here: a plain redirect to the same path and query on
   fanglands.com (no card, nothing offered).
4. **A login**: the hand-over below. The world's answer says what it holds of that account's knight, and the page checks
   every knight here against it (the rule below); a knight here that the world does not hold sends the tab to
   `/handoff-here` after all, with no landing (the offer just runs out in the World's memory).

**Which knights are on the server** is one function, `deviceKnights` (`KNIGHTS_SOURCE` in `handoff-merge.js`; the
game's `src/00-handoff.js` has it word for word, and a test holds them together). It reads **no note of any other
file**, only the slots (`fanglands.slot.N`) and the save in each, against what the world holds of the logged-in
account's knight: the offer's answer `knight` (`knightOf` in `handoff-merge.js`: the fingerprint of the save string, its
play seconds and its line, from one read of the account's latest save), or the save string itself (the game asks
`GET /api/save` for the icon note). A slot holding a knight (JSON with a `player`) is on the server when:
- it is **the very string the world holds** (the same fingerprint: the world keeps a save as the exact string the game
  sent, and a login writes the world's string into slot 1), whatever notes it has;
- or it is **inside the world's copy by the knight's line** (`player.line`, which feat/no-play-alone writes: one
  `[segment, play seconds when it began]` per start): the two share a segment and this copy's play on it ends where the
  world's copy went on, or before. This is 72-deviceknights' own `lineIn`, so an older copy the world has gone past is
  not held back.

Everything else counts as device-only: every knight when nothing is known (no login, the world did not answer, or the
account has no knight in the world yet), a knight no account owns, another account's parked copy (it may hold progress
only here; that browser moves once that account has logged in there too and nothing else is left), **progress the world
does not have** (an upload that never landed: the tab stays, the kid logs in, the game pushes it, and the next visit
moves; nothing is stranded on gorkscape.ca), and a save from before the line that is not the world's exact string. The
old single save `fanglands.save.v2` counts only when the game would still make it slot 1 (no slot 1 and no current
slot); otherwise it is a mirror of a slot. A backup 72-deviceknights keeps (`fanglands.kept.<name>`) is not a knight
(step 2 keeps `#kept` reachable). Because the rule reads only the saves, a renamed note in another file cannot change
it; `00-handoff.js`'s self-test runs the game's real login (71-login, 72-cloudsave and, on a tree that has it,
72-deviceknights) against a small world and checks the answer, so a change in how a login leaves the knight fails the
headless gate. In round 5 this rule read feat/no-play-alone's `fanglands.slot.N.synced` and `fanglands.dk.kept`, which
that branch then removed (its d367fdd, "The cache model"): every browser that had played would have stayed on
gorkscape.ca for good.

### A browser that keeps no cookie never goes round

`/handoff-stay` and `/handoff-here` send this one load to the game with a marker on its query, `fl_hop=stay` or
`fl_hop=here`, as well as setting their cookie. The Worker serves the game for a page whose query has it, only when the
request came from this address's own page (`Sec-Fetch-Site: same-origin`, or a browser that does not say); a link from
anywhere else with it gets the hand-over page. The game page's first script (`src/page.html`) takes the marker off the
address at once (`history.replaceState`, the rest of the query and the fragment kept) and leaves it for the game in
`window.FL_HOP`, which shows the same note as the cookie would; `/admin` takes it off too, and the hand-over page never
passes one on. Without it, an installed app whose browser refuses the cookie (blocked cookies, a managed profile) went
hand-over page, `/handoff-stay`, hand-over page... for ever through a script's `location.replace` (no browser counts
that as too many redirects): two Worker requests a turn, enough for one iPad left open to spend the free plan's 100,000
requests a day and stop every address until 00:00 UTC. Now such a browser takes three requests per load (the page, the
hop, the game) and the cookie, when kept, makes later loads one.

### Home-screen icons stay where they are

An iPad home-screen icon added on gorkscape.ca is an installed web app whose scope is gorkscape.ca. Sending it to
fanglands.com would open an in-app browser bar (address and Done) over a smaller game, on every launch. So it is never
sent: the page goes to `/handoff-stay?to=<path>`, which sets `fl_stay=1` (400 days, `Secure`, `SameSite=Lax`, readable
by the game; only when the page on this same address asked, so a link from anywhere else can never park a browser) and
sends back to the path (with `fl_hop=stay` for this load). From then on the Worker serves the game to that icon on gorkscape.ca as today, with no hops at
all: same Worker, same World, same accounts. iOS keeps a home-screen app's cookies and storage apart from Safari's, so
a Safari tab never gets the cookie. The title says *"Play online at gorkscape.ca"* there (it names the address it is
on). The game shows the icon a calm one-time note (`fanglands.handoff.noted`) with OK. Its words follow the facts,
because a new icon keeps its own storage: it starts logged out and without the knights saved on this device, so the
note never says the old icon can go.
- Logged in, the world holds a knight for that account (the game asks `GET /api/save` once, a read, when it shows the
  note; 5 s at most), and no knight here is outside it (the rule above): *"Fanglands has a new home: fanglands.com.
  Your knight is saved in the cloud. A new icon starts logged out: log in with your knight's name and secret word."*
- Anything else (logged out, no answer, a knight here the world does not hold): *"Fanglands has a new home:
  fanglands.com. Keep this icon: knights saved on this device live here. A new icon starts logged out: log in with your
  knight's name and secret word."*

That a new icon starts logged out is reasoned from WebKit's documented behaviour, not yet seen on a real iPad. If
`fl_stay` ever reaches an ordinary tab (a computer whose app windows share the browser's cookies), the game page's own
first script (`src/page.html`, before the game itself is read) sees it is not an installed app, shows the card and goes
to `/handoff-leave` (which clears the cookie); the hand-over then runs as for any tab.

### The hand-over, step by step

A code made by one browser must never work in another, so both addresses of one browser keep the same random **pull**,
and a claim only works with the pull the offer was bound to.

1. With a login, the hand-over page shows the card **"Bringing your knight over..."** (and **"Still working on it..."**
   after 4 s).
2. The first time only (no pull kept here): it goes to the start page
   `https://fanglands.com/handoff#back=<path and query>&from=<this address>`, which keeps a 128-bit pull in
   fanglands.com's storage (`fanglands.handoff.pull`, `{n, at}`, used again for 30 days) and goes back to
   `https://<from><path>#handoff-pull=<pull>`. The hand-over page keeps that pull too (same key, its own storage) and
   takes it off the address. `from` is checked against fanglands.com's own old addresses; a path that is not a plain
   path becomes `/`. If fanglands.com cannot keep anything (storage off), it goes straight into the game there.
3. It posts `{keys, pull}` to `/api/handoff/offer` with the login as `authorization: Bearer <token>`. The World answers
   `{code, expires, name, knight}` (`name`: the account, lower case; `knight`: what the world holds of its knight,
   `{fp, play, line}`, or null). The page checks every knight here against `knight` (above): one the world does not hold
   keeps the tab (`/handoff-here`); otherwise it goes to the **landing page**
   `https://fanglands.com/handoff#land=<code>&to=<path and query>&from=<this address>`.
4. The landing page first takes the fragment off the address and the history (`history.replaceState`), then posts
   `{code, pull}` (its own kept pull) to `/api/handoff/claim`, gets `{keys, from}` (`from` is the old address the
   world saw the offer on), writes what is missing (`handoffMerge`, which the page carries as text), marks the tab
   `fanglands.handoff.arriving` (sessionStorage, not for `/admin`) and goes on to the path: the game, `/admin`, or any
   page. The game page, loaded and parsed once, shows the same card while it loads (`src/page.html`, with "Still
   working on it..." after 4 s) and drops it as soon as the game runs. Logging in there loads the knight from the world.

What `handoffMerge` writes, never writing over anything the kid has here:
- **The login** (the token with the last name): only when this address is not logged in at all, and the same login
  from the same old address only once (`fanglands.handoff.seen`): a kid who logs out on fanglands.com stays logged out.
- **Settings and hints**: when not here, or still exactly what the game wrote by itself at boot (`00-handoff.js` notes
  that in `fanglands.handoff.boot`), so a first look at fanglands.com does not shut out the kid's own kid mode and text
  size. A setting the kid set on fanglands.com stays.
- Nothing else: a claim carrying any other key writes nothing of it.

**Later visits** (a Safari bookmark to gorkscape.ca, say) skip step 2: the hand-over page, the landing page, then the
game. Each is a small page; the game page is the only big one and is read once.

When something goes wrong on the way:
- **The world does not take the login** (401: it ran out after 90 days, or the knight is banned): the same as no login.
  With no save here, a plain redirect (the kid logs in on fanglands.com); with a save, the tab stays.
- **The world is too busy or cannot be reached** (429 or 503; no answer in 8 s or a network error, tried twice): with a
  save here the tab stays on gorkscape.ca and plays as today; with none, the card says *"Your knight is safe. It could
  not come across just now."* with **Try again** (this page) and a small *"Or go to the game and log in with your
  knight's name and secret word."* (the same path on fanglands.com). A kid with a login is never sent across without
  it unless that link says so.
- **The claim finds nothing or gets no answer** (the pull here is not the one the old address used, the World
  restarted between offer and claim, the code ran out, a Wi-Fi blip): the landing page goes back once to
  `https://<from><path>#handoff-pull=<this address's pull>`. The old page keeps that pull and offers again. The tab
  remembers the miss (`fanglands.handoff.tries`, sessionStorage on fanglands.com, two minutes), so a second miss shows
  the card's Try again instead of going round again.

Nothing is ever deleted on gorkscape.ca. A `#handoff...` fragment that arrives *at* gorkscape.ca is never passed on
(other fragments ride along). The parent page's admin key is per tab (`sessionStorage`) and is never handed over:
type it again on fanglands.com/admin.

### The rules the world keeps (`online/test/handoff.test.mjs` and `handoff-merge.test.mjs` prove each one)

- `POST /api/handoff/offer {keys, pull}` with `authorization: Bearer <token>` → `{code, expires, name, knight}`. Only on a
  gorkscape address (`gorkscape.ca`, `www.`, `test.`), with an `Origin` that is exactly that address (403 `origin`).
  In this order, and nothing is read, kept or counted before the step that needs it:
  1. **A login, from the header alone**: a live login the world knows (read only: no `last_seen`, no deletes; a banned
     or run-out one does not count), or **401 `login`** with the body never read. There is no anonymous hand-over.
  2. **That account's hour**: at most **30 offers an hour**, counted here, before the body is read; past it 429 `wait`
     (with `wait` in seconds), the body never read and nothing kept.
  3. **The World's room**: at most 4,000 offers waiting in all (32 MB of memory); past it 503 `busy`, unread.
  4. **The body**: at most 8 KB (413 `full`, also from `content-length` before reading), `pull` 32 hex, only keys in
     `CARRY` or matching `HINT_RE`, only string values, and the login in the keys the same token as the header
     (400 `bad`).
  5. Kept **in the World's memory** under the SHA-256 of a 256-bit code, bound to the SHA-256 of the pull, for **two
     minutes**. At most **2 wait per account**: a third replaces that account's oldest. No other account can touch
     them. Then one read of the account's latest save (the same primary-key read `GET /api/save` makes) gives
     `knight` (`knightOf`: a fingerprint, play seconds and at most 40 line segments, under 1.2 KB; never the save).
- `POST /api/handoff/claim {code, pull}` → `{keys, from}`. Only on a fanglands address, with an `Origin` that is
  exactly that address (403 `origin`). The pull must be the one the offer was bound to: any other pull gets 404 `gone`
  and does NOT use the code up. **One use**: nothing is awaited between finding the offer and taking it out of memory,
  so two claims of one code at once can never both get it. Run out, used, made up, broken or the wrong pull: the same
  404 `gone`; those are limited to 20 a minute per address (429 `wait`; an IPv6 address counts by its /48). A real code
  with its pull always lands.
- **Nothing about a hand-over is ever written to the database**: the offers, the hour's counts and the misses live in
  the World's memory (`world.handoff`). A restart of the World (a deploy, or Cloudflare putting an idle World to sleep)
  forgets them: a code waiting then is simply gone (the landing page goes back once and the old address offers again),
  and a count starts again, which costs nothing because an offer writes nothing. So nothing about a hand-over is ever in
  a backup either. The only statements a hand-over runs are reads: the login, and for an offer that was kept, the
  account's latest save.
- Nothing about a hand-over is ever logged. The code and the pull only ride after `#`, so they are in no request line,
  no log and no Referer. The landing page takes them off the address bar and the back/forward history before it
  claims; a browser's own list of visited addresses may still hold the old URL (one-use, two-minute code, useless
  without the pull).
- **Signup** allows 10 new accounts an hour per address (`world.js`, `SIGNUPS_PER_HOUR`; an IPv6 address by its /48;
  only accounts actually made count; 429 `signups`, which the title reads as *"Too many new knights from here this
  hour. Try again later."*). It is checked before the body is read (no secret word is hashed past it) and again where
  it is counted, with nothing waiting in between, so signups at the same moment cannot all slip past.

### The free plan, with arithmetic

The World is on the Workers free plan: **100,000 rows written a day** (a miss stops every save until 00:00 UTC), about
5,000,000 rows read a day, and 100,000 requests a day.
- **Rows written by hand-overs: none, ever.** The worst case, every account at its hourly cap all day long, is
  accounts × 30 × 24 = 720 offers per account a day, and 720 × 0 rows = **0 rows written**, against 100,000. That stays
  0 however many accounts there are (each account has its own cap; signups are limited per place). A test makes 35
  offers, claims, refusals and an expired claim, and finds no write but the request meter's own (`meter.js`, below);
  another fills an account's hour and proves the 31st is
  refused before its body is read and before anything is kept or written.
- **Rows written by a knight playing** (6 Oct 2026, local `wrangler dev`, every statement's `rowsWritten` logged, 300 s
  each): the rows limit, not the requests limit, is the one a playing game reaches first. Before this change (review round
  2 of the idle work, 7e908b0) a knight playing alone wrote about **1,680 rows an hour** against 419 billed requests: his
  saves about 650 (a changed save every 15 to 20 s is about 3.8 rows: the new version and its index entry, and the oldest
  of the 3 kept deleted), `accounts.last_seen` on every call about 230, the meter about 370 and the movement check's day
  counts about 360. Now `last_seen` is written at most once per 5 minutes per knight (`SEEN_EVERY`; /admin's "last on"
  reads the socket and the logins first), the meter's socket-message write waits 30 s instead of 10 s and the movement
  check's a minute: a synthetic knight playing alone wrote **1,056 rows an hour** (saves 648, the meter 288, the logins 60,
  the movement check 60) against 419 billed requests, and a real game page playing alone 1,138 against 407
  (`tools/idle-pages.cjs solo-over-playing`, 2 /admin reads inside). The meter's own count of rows written matched the
  logged sum exactly (178 of 178 over a fresh World's first 300 s). So **100,000 rows a day is about 95 knight-hours of
  play** (100,000 / 1,056; it was about 60), while 100,000 requests are about 245 (100,000 / 407): rows run out about 2.5
  times sooner, and the cost gate reads whichever share is larger (`/admin` shows both). Saves are now most of a playing
  knight's rows (about 61%), and they grow with every knight; twenty kids playing at once write about 21,000 rows an hour,
  the whole day's rows in under 5 hours.
- **Rows written by the request meter** (`meter.js`, "The meter" under the shared world): at most one write per 5 s for
  requests and alarms, 720 an hour, plus one per 2,000 counts, one per 30 s while socket messages keep coming and one per
  socket close, each an upsert of up to 4 rows (`req_meter`, and `req_meter_admin`, `req_meter_alarm` and, once a minute,
  `req_meter_rows` when admin calls, alarms or rows written are waiting), and the day's two marks. `/admin` left open and
  in view all day (34,560 calls, its 4-call refresh every 10 s): one write a refresh, 2 rows, plus the rows-written line
  once a minute: about 785 rows an hour, **18,840 rows a day, 18.8%** of 100,000 (master 3b6d6b4 wrote 17,280; the first
  version of the alarm column wrote 2 rows per call, about 69,000). The busiest day measured, 3 Oct 2026 (3,301 calls, 83,499 messages): at most 3,301 writes for the
  calls, 42 at 2,000 messages waiting and 2,880 for messages arriving all day (one per 30 s), so under 6,223 writes and
  about 7,700 rows at the very most (a write is 1 row unless admin calls or alarms wait in it, plus the rows-written line
  once a minute: 1,440; at the old 10 s and 200 it was 12,359 writes and 37,077 rows). The ceiling, a request or an alarm at least every 5 s all day
  with admin calls and alarms in every write: 17,280 × 3 = 51,840 rows, plus 1,440 for the rows-written line, 1 a socket
  close and 1 per 2,000 counts.
  `online/test/meter.test.mjs` "rows written ..." counts them as SQLite does, an hour of each case. On the real runtime
  (local `wrangler dev`, each meter write's `rowsWritten` logged, `/admin` open and in view for 120 s, 48 calls): master 20
  rows, this change 26 (6 Oct 2026); the per-call version wrote 116 in the review's run of the same script.
- **Rows read**: per offer, the login (two primary-key lookups, `sessions` by token and `accounts` by name, about 2
  rows) and, for an offer that was kept, the account's latest save (one row by its primary key, `ORDER BY ver DESC
  LIMIT 1`): about 3 rows. A refused offer reads only the login. The same worst case with today's ~30 accounts:
  30 × 720 × 3 = **64,800 rows read a day, about 1.3%** of 5,000,000. An unknown token is one lookup that finds nothing.
- **Requests** are the limit the hand-over cannot protect: each request counts before any code of ours runs, and
  anyone can spend them on any address (`/api/status` as well as a hand-over). A real kid's visit through an old
  bookmark is about five (the hand-over page, the offer, the landing page, the claim, the game page); ten such visits a
  day for thirty kids is 1,500, 1.5% of the day. A kept tab or icon whose browser drops cookies is three a load (the
  page, the hop, the game), never a loop (above).

### What it does not stop

Anyone with a login can make offers of their own, with their own login and settings. It does them no good: their code
only works with their own pull, which lives in their own browser, so a link to `fanglands.com/handoff#land=<their
code>` does nothing in anyone else's browser (the claim is refused, the landing page goes back once to gorkscape.ca,
which offers the kid's own login). A link to `gorkscape.ca/#handoff-pull=<their pull>` makes the kid's own browser keep
that pull and offer the kid's own login bound to it; the code goes only into the kid's own landing page, where the
claim with fanglands.com's pull fails and the old page offers again with the right pull: one extra trip, and the kid
lands logged in. Even a claim that did get through could only ever add: the merge never writes over a login or a
setting the kid has, and carries nothing else. A link to `/handoff-stay` or `/handoff-here` from anywhere else sets no
cookie. Someone with the kid's browser in their hands (or its storage) can of course do anything, as before. Saved
secret words (iCloud Keychain, Chrome) belong to gorkscape.ca and are not offered on fanglands.com; the hand-over
carries the login so a kid rarely has to type it, and a kid who does (after *Not me*, a new icon, or the stuck card's
link) types the knight's name and secret word as on any new device.

### Shipping it, and the switch

`HANDOVER` is committed state: `[vars] HANDOVER = "off"` in `online/wrangler.toml`, above the routes, so every deploy
from every tree carries it (and the test world keeps it; `--var HANDOVER:on` overrides it there for a proof). Only
exactly `"on"` hands over; `"off"`, a missing line or a misspelling keeps the old addresses serving the game as before
(it fails closed). Off, fanglands.com is attached and its certificate made while nothing changes for anyone. Once
`https://fanglands.com/api/status` answers (and has for the 30 minutes a cached "no such name" can last), **a commit on
master** that sets `HANDOVER = "on"`, then a deploy, turns the hand-over on. Turn it on once feat/no-play-alone is on
master: the rule above does not depend on it (a browser whose knight is the world's moves either way), but it is what
lets a kid bring a knight saved only on a device into an account, so that browser can move too. The way back is the same: a commit on master setting it to `"off"`, then a
deploy (nothing was deleted on gorkscape.ca). Never switch with `--var` alone on the live world: the next plain deploy
from any session would undo it. `/handoff-stay`, `/handoff-here` and `/handoff-leave` answer either way, so a
home-screen icon or a kept tab never loops.

`online/deploy.sh` refuses a tree whose `wrangler.toml` does not serve fanglands.com or has no `HANDOVER` line (a live
deploy from an older tree would detach fanglands.com, and Cloudflare deletes its DNS records), and after every deploy
checks that `https://fanglands.com/api/status` and `https://gorkscape.ca/api/status` answer (5 minutes, then a loud
failure). The live notes of the branch have the numbered steps, the rollback and its limits.

### The test world

`~/.fanglands/tools/deploy-test.sh` gives the test Worker `test.<each bare live domain>`: `test.gorkscape.ca`, and
`test.fanglands.com` once the tree's `wrangler.toml` lists fanglands.com. Both `src/70-net.js` host lists carry the
three fanglands.com names and the three gorkscape.ca ones, so a page still open on gorkscape.ca keeps playing online.
There is no `www.` on the test world (a certificate for `*.test.gorkscape.ca` does not exist), so the www rules are
proved by the tests and the VM run of the whole hop, not on the test world.

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

- Close codes: 4000 elsewhere, 4001 lost, 4003 banned, 4004 full, **4005 kicked**, **4006 kept out for bad words**,
  **4007 renamed**, 4008 too fast. The wire never reconnects after 4000, 4003, 4005 or 4006, nor after an `error`
  `elsewhere`, `banned`, `kicked` or `words`. After 4007 it reconnects at once, with the same session (now the new name's).
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
disconnects (or logs in elsewhere), changes map, walks more than eight tiles away, or falls. A nap of the world does not end
it: an open trade (both offers, who accepted and confirmed, its stage and version) rides both knights' socket attachments,
written at every change, and the Room the wake builds puts it back as it stood once both sockets are restored (both must
carry the very same trade; one side alone, or one in another trade, leaves it over). Two knights at "Are you sure?" who both
put the game down for a while confirm when they come back and it is done (5 Oct 2026: the world naps when nobody plays, and
the trade was lost). A trade that does not fit beside the rest of an attachment (a socket's is at most 2,048 bytes: twelve
long item names on each side beside gifts on their way) is left out of it, and a nap ends it as before; its next message is
answered `trade_end gone`.

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
  ends with nothing moved (closed, disconnected, a new map, walking away, falling, another device, a nap whose attachments
  carry no trade, one side back alone), a nap that keeps it (restored in either order, then done once), `trade_done`
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
## Every knight lives on the server

Owner (2026-10-03): *"everything should be server side so that they can play on multiple devices"*, and yes to taking
*Play alone* away, so every new player needs his invite. This is the small change; how saves sync between devices is a
separate, later project and is exactly as before (below).

- **Online, every knight lives on the server.** The login card (`src/71-login.js`) has no *Play alone*, not even while
  the world is asleep ("The world is asleep right now." and it waits). Online the title never shows the local slot
  cards, Continue or a *Play online* plate, and Enter starts nothing, even with the card put away (79-boygirl's
  question). A new knight needs Ethan's invite code (*New knight*, "Ask Ethan for the invite code").
- **Unchanged:** what loads at login for an account with a cloud save (the cloud knight, into slot 1 with the mark),
  slot 1 as the account's working copy, `72-cloudsave`'s pushes and their timing, the old address's bridge. No new save
  fields, no conflict rules, no backups.
- **No knight is ever deleted, and no kid is ever stuck.** A *device knight* is a slot (`fanglands.slot.1` to
  `LOGIN.PARK_MAX`, 9; 1 to 3 are the title's, the rest only ever hold a knight `park()` moved) holding a save that no
  account owns: any slot with a save in it, except slot 1 while it carries the mark (an account's working copy). No start
  path deletes or overwrites one: before a login, a sign-up, a pick (the slot 1 knight too), *Start fresh* or *Put my
  knight back* (`LOGIN.reload`) writes slot 1, `park()` moves a device knight there to the first empty slot from 2 to 9
  (if one already holds the same string it is safe as it is) and reads it back. So a kid who played alone in all three
  slots still logs in, signs up, starts fresh or brings one in; the slot 1 knight is then in slot 4. Only when no slot
  up to 9 is empty, or storage refuses the write, is nothing written, the game does not start, and the card says:
  "This device has no room left to keep its saved knights safe, so the game did not start. They are all still here. Ask
  Ethan for help." (`LOGIN.NO_ROOM`). `DEVKNIGHTS.PARK_MAX` is the same number (`src/00-handoff.js`'s self-test reads it;
  the hand-over's rule counts every `fanglands.slot.N`, so a parked knight keeps its browser on the old address until
  it is in an account).
- **Named where the kid is** (`src/72-deviceknights.js`): under the login form and on the "Playing as" card, one line:
  "This device has a knight saved on it: Slot 2 (level 7). It is safe here. Make a new knight with Ethan's invite code
  to bring it with you." (with several: "This device has 2 knights saved on it: Slot 2 (level 7) and Slot 3 (level 2).
  They are safe here. Make a new knight with Ethan's invite code to bring one with you.").
- **Offered to a new account.** When a sign-up (or any login) finds the account's cloud empty, 71-login asks the old
  address and so this file: device knights are offered. One: "This device has a knight saved on it: Slot 2 (level 7).
  Bring it into your account?" with its chapter and time played, *Yes, bring it* / *Start fresh*. Several: a card each
  (slot, level, chapter, time played; 56 px tall) and *Start fresh*. A knight on the old address joins them as one more
  card; with no device knight the old address keeps its own offer as before. A picked knight comes in exactly the way
  the old address's does (`LOGIN.bring`: slot 1, the mark, `PUT /api/save` at once). It stays in its own slot too, and
  is still named and offered to everyone else (brother and sister on one iPad: the first to tap Yes never takes it from
  the other). Once its first push went through, `fanglands.brought` keeps its fingerprint with the account's name
  (`{fingerprint: [names]}`): that account's "Playing as" no longer names it, and another account's offer adds one line
  to its card: "Ann brought this knight into an account already. You can bring it too."
- **Start fresh asks first.** The first tap greys *Start fresh* out (nothing on the card moves, so a second tap there
  does nothing) and shows "Start a new knight? These will not come into this account." with *Yes, start fresh* (under
  everything) and *Go back*. *Yes, start fresh* takes a tap only after 0.8 s with no press on the offer: every press
  before that starts the wait again, so a double tap or a burst of taps never starts fresh. Every device knight stays.
- **Self-tests.** While `FANGLANDS.selfTest` runs, device knights are not seen (no line, no offer) unless the test sets
  `DEVKNIGHTS.testView`, so another file's sign-up (79-boygirl's Mia, an empty cloud) is never offered a knight some
  other test left in a slot. The rule that nothing is overwritten is never switched off.
- **Offline is unchanged.** Without the wire (`file://`, the old address, the tests' own boot) the title keeps its three
  slots exactly as before, and nothing is named or offered.
- Tests: `deviceknights:` in `src/72-deviceknights.js` (named on the form and "Playing as"; offered to a new account and
  pushed on Yes; a knight Ann brought in still offered to Bea, with who brought it, and not named on Ann's own card; a
  pick from several with slot 1 moved first; Start fresh against double taps and bursts; three full slots and every
  start path still starts, slot 1's knight in slot 4; no room only with every slot to 9 full or storage refusing; the
  self-test gate; offline slots; on the card in a browser), `login:` *online there is no Play alone*, `handoff:` (its
  real-login check parks a knight in slot `DEVKNIGHTS.PARK_MAX`), and `tools/dom-keys.js` runs the `deviceknights:`
  checks in a real page at 768x1024 and 390x844.

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

## Word strikes

Cohen (2026-10-03): bad words and bad names should get warnings and then a kick-out. The owner's decisions: the first
strike is a warning, the second a last warning, the third and every one after it sends the knight out of the world and
keeps it out for 24 hours; strikes fade after 30 clean days; the owner and MudGoll (admins) can see and clear strikes.
Round 5 (2026-10-03, the owner's rule that a kid is never punished on a guess): **only swear words and slurs count**.
Insults ("stupid", "dumb", "shut up", "go die", "loser", "gay" used as an insult) are starred out and never a strike.
All of it is server-side (`online/src/filter.js`,
`room.js`, `world.js`, `store.js`), so no game can skip it; the game only says it (`src/79-strikes.js`, 70, 71).

### What counts

`checkChat(text)` answers `{text, masked, strike}`: the line with bad words starred out, whether any word had to be, and
whether one of them is a word that strikes. Only `strike: true` is a strike; starring out alone counts nothing. The line
alone decides: who said it, who it was about and who is on line never change anything (the Room passes the text only).

**A strike is one thing only: a word on `STRIKE_WORDS`** (`online/src/filter.js`), a fixed list of swear words and slurs
a kid would not type for anything else (fuck, shit, ass, bitch, cunt, twat, wanker, slut, whore, the n-word, faggot,
retard, paki and their plain forms: fucking, shitty, asshole, dickhead, bullshit, motherfucker, ...). It
matches as a **whole word**, case aside, and in the common disguises of those exact words:

- a letter held longer: three or more of any letter (fuuuck, shiiit, asss), or the last letter doubled when the word has
  no double letter (fuckk, shitt, bitchh). Never a letter in the middle held twice ("Shiite" is not "shite"), never a word
  with its own double letter held twice ("assess" is not "asses");
- the letters split up: one letter a token (f u c k, n i g g a, "f . u . c . k"), or marks between them inside a word
  (f.u.c.k, s-h-i-t, a_s_s, f*u*c*k), only when every piece is one letter or one look-alike symbol, so "go.ok" or
  "go ok" is never a slur. A lone digit is never one of those letters: it ends the run, so "a 5 5" (dice, a score),
  "it was a 2 2 tie" and "a-5-5" are never "ass" or "azz" (a spaced "s h 1 t" is starred out but no strike);
- look-alike symbols inside a word that has letters ($hit, b!tch, f@ggot), and look-alike DIGITS only in a word that comes
  out 5 letters or longer with at least 3 real letters (b1tch, n1gger, wh0re, d1ckhead). A short word with a digit (sh1t,
  a55, 4ss) is starred out but never a strike, because phone models and shorthand look just like it (a22, a55, a2z); or made of
  symbols alone (@$$). **Never a number**: a token of digits alone, with or without a unit or sign (455, 8008, 7175,
  455k, #455, $455, 4:55, "4 5 5", "the 455's"), is never read as letters, never a strike and never even starred out.
  A number joined to a word by a mark is split off first and never read either: "gold:455", "hp:455", "x:455 y:422",
  "room#455", "455-pts", "455:me", "lvl-455" and "455-ish" are no strike and are not starred out;
- edge punctuation and joins: "fuck!", "(shit)", "shit's", "ok,fuck", "fuck-you". A contraction is two words ("who're" is
  never "whore");
- `STRIKE_INSIDE`: "fuck" also strikes inside any word (xXfuckXx, fuckfuckfuck), because it is in no ordinary word.
  Nothing else does: shit is in shitake, cunt in Scunthorpe, ass in class, nigg in niggle.

**Never part of a longer ordinary word**: class, assassin, assess, Scunthorpe, Dickens, cockpit, niggle, Niger,
retardant, therapist, pakistan, shiitake are no strike. Left off the list on purpose, because they mean something else or
are mild (starred out, never a strike): damn, crap, hell, piss, bastard, cock, prick, tit, boob, pussy, fag, dyke, spic,
coon, chink, gook, dick (Dick Grayson is Robin and Nightwing; Moby Dick; dickhead still strikes), kike (Kike Hernandez
the baseball player, a nickname for Enrique; **the owner may want it back as a strike**), tranny, homo, negro, jackass, badass, wtf, stfu, gtfo, lmfao, cum, kys, and the sex, drug and hate words.

**Nothing else ever strikes.** There is no sentence analysis, no "you" / "ya" / "u" targeting, no names: the round-4
machinery (`SAID_ABOUT_YOU`, `YOU_ARE`, `YOU_OR_YOUR`, `AT_SOMEONE`, `SAID_TO_SOMEONE`, `LINE_ALONE`, `NOT_A_NAME`,
`REAL_PEOPLE`, sentence joining, the knights-on-line names and `online/src/gamewords.js` with `tools/game-words.mjs`) is
deleted, not patched.

**Starring out** stays generous, because it is harmless: every word of `BLOCKED` (swearing, sex, slurs, hate, drugs), a
bad word hidden inside another (`BLOCKED_INSIDE`: swanky, pussycat, Scunthorpe), look-alike spellings and spaced letters,
and `INSULTS` wherever they are: stupid, dumb, idiot, moron, loser, nitwit, gaylord, ... (a letter held longer only with
three or more of it, so "looser" is left alone) and the phrases "shut up", "go die", "go and die", "kill yourself", "hate
you". "Gay" used as an insult (`GAY_INSULTS`: "that's gay", "so gay", "ur gay", "gay boy", ..., and a line that is only
"gay", laughs aside) is starred out; "gay" anywhere else ("my uncle is gay", "gay rights") is left alone. A strike is
always starred out too.

Names: anything starred out in chat, insults included, is refused in a name, spaced out too ("Stupid Sam", "Big Loser",
"Stu Pid", "Dumb Dog"); "Fat Cat", "Dumbo", "Big Dummy", "Lol" and "Omg" pass. `RESERVED_NAMES` include "Word Filter" and
"Parent Page" (who mod_log says made a strike or a change), spaces not counting.

The tests hold the rule (`online/test/filter.test.mjs`): every number from 0 to 99,999 (and with units, and joined to
a word: gold:N, N:me, room#N, N-pts, N's, lvl-N, N-ish, "a N N"); more than 550
lines of ordinary kid chat in `online/test/game-talk.mjs` (game talk, "ya so dumb", "shut up lol", "SHUT UP LEO!! no
way", "go die lol", insults said straight at a friend, chat slang, coin counts, words with a swear inside); every string in
the game's source (every NPC, place, item, quest and line of talk, whole and word by word); and the system dictionary
(235,000 words, where a strike only ever comes from an entry with a whole word on the list): zero strikes. Every word on
`STRIKE_WORDS` in every disguise above (more than 3,000 spellings): a strike, and starred out. Who is on line changes
nothing. `strikes.test.mjs` says the game talk in a real Room with knights named Goblin, Lol, Omg and Rn on line, and two
friends' evening of insults, with zero strikes, and then a swear word in a disguise that is one.

Every list is plain lower-case words, one place to edit; **the owner decides the final lists**. `cleanChat` still answers
the masked line alone.

### The count

```
accounts  + word_strikes       INTEGER NOT NULL DEFAULT 0   -- bad lines counted (read through strikesNow: it fades)
          + word_strike_at     INTEGER NOT NULL DEFAULT 0   -- when the last one was counted (ms; 0 = never)
          + words_locked_until INTEGER NOT NULL DEFAULT 0   -- kept out until then (ms; 0 = not kept out)
          + last_ip            TEXT NOT NULL DEFAULT ''     -- where a kept-out knight was sent out from, only while kept out
```

Added by `migrate()` like the other columns: only when missing, nothing dropped or rewritten. They are their own columns:
the wrong-secret-word `tries` / `locked_until` are never touched by a strike.

- `onChat`: a muted knight's line goes nowhere and is no strike. Otherwise the masked line is logged and sent to everyone
  as before, and then, if the filter called it a strike and the knight has an account, `store.addWordStrike` adds one to the count as it
  stands now. A knight with no account (tests, simulations) counts nothing. Admins count like anyone.
- **Fading**: when the last strike is 30 days old or more (`WORD_STRIKE_FADE`), the count reads 0 and the next one is a
  first warning again. 29 days on, it still counts.
- Strike 1: `{t:'strike', n:1, text:"That word isn't allowed here. This is your warning."}` to that knight alone.
- Strike 2: `{t:'strike', n:2, text:"Last warning. Do it again and you'll be kept out for 24 hours."}`.
- Strike 3 and every one after it (the count stays at 3 or more until it fades or is cleared): `words_locked_until` =
  now + 24 hours (`WORD_LOCK_MS`), then `{t:'error', code:'words', text, until, n}` and close **4006**.
- Each strike is one `mod_log` row: `by: 'word filter'`, `act: 'strike'`, `target` the knight, `detail` the count and
  then the line as it was typed (`'1: what the shit'`, `'3, kept out 24 hours: sh!t'`), so the parent page can tell
  whether it was fair ("Sam got word strike 1 for typing "what the shit""). Only the parent page reads `mod_log`; the chat
  log keeps the starred line.

### Kept out

While `words_locked_until` is in the future: `POST /api/login` with the right secret word answers 403 `words` with
`until` and makes no session (a wrong word is still 401 `pass`); `World.session` (every `/api` call with a token and
`/ws`) answers 403 `words` with `until` and keeps the session; `Room.join` and `Room.restore` (a socket a nap brings
back) send `{t:'error', code:'words', text, until}` and close 4006. When the time is up the same session works again.
The wire does not reconnect after `words`/4006; `LOGIN.sentence` says "You're kept out until 7:42 pm tomorrow for bad
words." (today, tomorrow or the day, from `until` in the device's own clock), on the card under "Playing as <name>".

- **Saving is not playing**: `PUT /api/save` alone goes through while kept out. The game saves and sends its waiting push
  the moment `error` `words` arrives (as it does for `kicked`), so the next login 24 hours later loads the knight as it was
  at the third strike, never an older cloud save.
- **No new knight to skip it**: the socket's `CF-Connecting-IP` rides with the knight in the Room (and its hibernation
  attachment), never written down; the third strike writes it to `accounts.last_ip` with `words_locked_until`
  (`store.setWordLock(lc, until, ip)`). Nothing else writes an address: not a login, not an `/api` call, not a signup.
  Clearing the strikes empties it, and every wake of the World empties it for every lockout that is over
  (`store.forgetPlaces`), so an address is kept only while that knight is kept out. `POST /api/signup` from a place a
  knight is kept out from right now answers 403 `words` with that knight's `until` and makes nothing; when the time is up,
  or an admin clears the strikes, signing up works again. A socket with no address (a local world) skips it. The address
  is never on any list (only the parent's full export carries it, and only while the lockout lasts).
- **On the device** the game keeps `fanglands.keptOutUntil`. On "Playing as <name>" the card says "You're kept out until
  ...", Play is greyed (it would only say it again), and the game asks `/api/me` again quietly every 60 s, so a lockout an
  admin cleared gives Play back without a reload. After Not me, or when the world refuses a New knight from this place, the
  card speaks about the device, not a knight, because a brother or sister on the same iPad reads it: "New knight is off
  here until 12:28 am tomorrow. Your own knight can still log in." New knight is greyed. It is forgotten when the time is
  up or the world lets a knight in (`/api/me` or a login).
- **A different knight on the same device** never reads the last one's chat: Not me, Log out, and a welcome for a
  different name than the last empty the chat log and the bubbles and take down that knight's warning notice and LAST
  WARNING banner (`CHAT.forget`, `CHAT.onForget`; 74, 71, 79). An admin's rename is the same knight: its chat stays.
- **The warnings**: the first is a red chat line a sentence and a notice; the last warning is also the big centre banner
  ("LAST WARNING", "Do it again: kept out 24 hours"), the size a level-up is said in. An open chat box is shut when the
  knight is sent out (kicked, kept out, banned or logged out by the world).

### Clearing strikes

`POST /api/accounts/strikes {name}` from an admin's game (401 `auth`, 403 `admin`, 404 `unknown`, 403 `self`: an admin
cannot clear their own, 429 `wait` after 3 in a minute) or `POST /api/admin/strikes {name}` from the parent page (anyone).
Both set the three columns to 0, so a knight kept out is let in at once and starts again at a warning. One `mod_log` row:
`act: 'strikes_clear'`, `by` the admin or `'parent page'`, `detail` what there was (`'3, was kept out'`).

### Renaming a knight

Every account row carries `badName`: true when `nameRude(name)` finds a word the filter refuses today (a name made before
the list grew). Only the words count, not the length or the characters.

`POST /api/accounts/rename {name, to}` from an admin's game (401 `auth`, 403 `admin`, 404 `unknown`, 403 `self`, 403
`isadmin`, 429 `wait` after 3 in a minute) or `POST /api/admin/rename {name, to}` from the parent page (anyone). The new
name passes `cleanName` like a new knight's (400 `name`) and nobody else has it (409 `taken`; a change of capitals only is
the same knight), nor had it before a rename (409 `taken`: another knight's old name logs in as that knight; a knight may
go back to its own old name). `POST /api/signup` refuses an old name the same way. Asking for the very name it has changes nothing. Then `store.rename` rewrites it everywhere it is kept:
`accounts.name` / `name_lc`, `sessions`, `saves`, `save_pins`, `logins`, `crackers.lit_by`, both sides of `trades`
(`a`/`a_lc`, `b`/`b_lc`), and the display copies in `chat.name`, `mod_log.by` / `target` and `parties.by`. One `mod_log`
row: `act: 'rename'`, `target` the new name, `detail` the old one. An online knight gets `{t:'error', code:'renamed',
name, text: "An admin changed your knight's name to Brave Sam."}` and close **4007**; the wire comes straight back with
the same session, which now belongs to the new name, and the game remembers it as `fanglands.lastname` for the login
card (also from `/api/me` and the login answer). The old name still logs in with the same secret word, as the new one
(found through the `rename` row in `mod_log`, which trimming never removes). `store.rename` runs its dozen `UPDATE`s as
one transaction (`ctx.storage.transactionSync`): a failure part-way changes nothing.

### The Accounts tab and the parent page

The game's Accounts tab (`src/78-accounts.js`, extended by `src/79-strikes.js` through `ACCOUNTS.extend`): each row tags
"2 strikes", "Kept out" and "Bad name"; a knight's page says "Kept out for bad words until Sun 4 Oct, 7:42 pm", "Word
strikes: 2. The last was ... They go on ... if there are no more." and "This name has a bad word in it. Tap Rename to give
a new one."; **Clear strikes** (two taps, when there is anything to clear; not on your own page) and **Rename** (not for
an admin or yourself: a text box, Next, "Change Stupid Sam's name to Brave Sam?", Yes). The parent page's accounts table
gains a *Bad words* column with the count, the lockout, a Bad name flag, Clear strikes and Rename, and *What admins did*
says each strike, clear and rename.

The rows (`GET /api/accounts`, `GET /api/admin/accounts`) gain: `strikes` (the count now, faded), `strikeAt` (when the
last was counted, 0 for never), `wordsLockedUntil` (ms, 0 when not kept out), `badName`.

## The shared world (phase 1: the server runs the monsters)

Owner-approved plan (`~/.fanglands/work/phase1/spec.md`): the world server runs every monster in its own copy of the game,
so every knight on a map sees the same monsters at the same moment, RuneScape-style. It ships in stages, and every stage
ships switched off (or only watching). Until a map is switched to `world`, the keeper model above is exactly how that map
works, and the keeper code in `src/75-coop.js` stays as the fallback through all of phase 1.

### Stage 0: the meter (live) and the harness (built, not wired)

Players see nothing. The only server change that reaches the live world is the **meter**: it counts what the free plan
counts, so the cost gates before later stages read real numbers instead of guesses.

**The meter.** One row per UTC day in four new tables (each created only if missing, nothing else in the schema changes):

```
req_meter       (day TEXT PRIMARY KEY, ws_in INTEGER NOT NULL DEFAULT 0, http INTEGER NOT NULL DEFAULT 0, est_requests INTEGER NOT NULL DEFAULT 0)
req_meter_admin (day TEXT PRIMARY KEY, http INTEGER NOT NULL DEFAULT 0)
req_meter_alarm (day TEXT PRIMARY KEY, http INTEGER NOT NULL DEFAULT 0, since INTEGER NOT NULL DEFAULT 0)
req_meter_rows  (day TEXT PRIMARY KEY, rows INTEGER NOT NULL DEFAULT 0, since INTEGER NOT NULL DEFAULT 0)
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
- `req_meter_alarm.http` counts, of the game's calls, the World's own alarms (since 4 Oct 2026; the third table, the same
  way). The night of 3-4 Oct read 17,266 game calls and nothing could say how many were alarms; measured afterwards under
  wrangler dev, two idle knights on one map cost 1,198 alarms an hour on 3b6d6b4.
- `req_meter_rows.rows` counts the rows the World writes to its database, every statement's `rowsWritten` (the World wraps
  its `sql.exec` with `countRows`; a `RETURNING` statement is read first, so its count is there), the meter's own included.
  Rows written are the free plan's other daily limit, 100,000, and the one a playing game reaches first ("The free plan, with
  arithmetic"). They wait in memory like the other counts and ride a meter write at most once a minute (`ROWS_EVERY`).
- Each wake marks the days it counts: today's `req_meter_alarm` and `req_meter_rows` rows are made if missing (at most two
  rows a day), and so is a new day's at its first write. `since` is the start of that day when nothing of it had been counted
  before (this code counted all of it), else the moment of the mark: older code counted the day's start (the deploy day, or a
  rollback, or a peer's deploy from a tree without these tables, and back), so the day is partial from `since` and its
  alarms before then are inside the pages' calls. A day with no mark was counted only by older code: its alarms and rows are
  `null` ("not counted"), never a false 0 (`meter.test.mjs`: "a day counted only by older code reads not counted ...").
- Counts are kept in memory and written with one upsert per table and day touched: `req_meter`, plus `req_meter_admin`
  when admin calls are waiting, `req_meter_alarm` when alarms are and `req_meter_rows` once a minute, so a write is up to 4
  rows. The first count after a
  wake is written at once. A World that naps between sparse requests is a new object for each one: before 4 Oct 2026 a
  count left waiting there was lost with the nap, and a paused page's saves (one every 15 s) and any status poll never
  reached the table at all (measured under wrangler dev: 7 saves in 2 minutes, 0 counted), so the meter read lower than the
  bill whenever the World napped. After that first count, a request (each `/api` call, each `/ws` upgrade) or an alarm is
  written at once unless the meter wrote in the last 5 s (`WRITE_SOON`), socket messages when 2,000 are waiting or when the
  last write was 30 s or more ago (`WRITE_EVERY`, checked on every count; it was 10 s, 360 writes an hour for every hour
  anyone played), and everything on every socket close. So the meter writes at most 720 times an hour (one per 5 s), plus
  once per 2,000 counts and once per socket close: at most 4 rows each. A nap can lose the requests and alarms of its last
  5 s, the socket messages of its last 30 s and the rows written of its last minute; the next count writes them if the
  World is still awake. The movement check's day counts (`move_day`) are written the same way at most once a minute
  (2,000 waiting at most; it was every 10 s). (A write per request, as this change first had it, cost the admin page's 4-call refresh 8 rows every
  10 s and an alarm 2 rows; arithmetic under "The free plan, with arithmetic".)
- Rows older than 400 days are deleted on the first write of each day after a wake.
- The admin export (`GET /api/admin/export`) includes `req_meter`, `req_meter_admin`, `req_meter_alarm` and `req_meter_rows`.

`GET /api/admin/sim` (Bearer ADMIN_KEY) answers, for now, only the meter:

```
{ meter: { today: {day, wsIn, http, admin, gameHttp, alarms, pageHttp, alarmsSince, est, gameEst, rows, rowsSince},
           days: [same, ... newest first, 14 days], freeLimit: 100000, freeRows: 100000, waiting: n } }
```

`gameHttp` = `http - admin` (alarms included, as before); of it, `alarms` are the World's own and `pageHttp` = `gameHttp -
alarms` the calls the game's pages made (saves, logins, status, the socket's opening). `rows` is the rows written that day.
`alarms`, `pageHttp` and `rows` are `null` on a day with no mark; `alarmsSince` and `rowsSince` are `null` on a day counted
whole, else the moment the day began to be counted (its mark). **The cost gate reads the larger of the game's two shares:**
`gameEst` of `freeLimit`, and `rows` of `freeRows`.

`today` includes the counts not yet written (`waiting` says how many). Later stages add `modes`, `tick`, `boot`, `heap`,
`copies`, `fallbacks`, `move`, `combat` beside `meter`, and `POST /api/admin/sim` for the switches; nothing reads them yet.

The parent page (`/admin`) has a **Shared world** section with one line for today and the last 7 days under it:
"Today (UTC), read at 7:42:10 PM: the game's pages made 210 calls and sent 12,345 socket messages, and the world woke itself
6 times on its own timers (alarms). Together that is about 834 of the 100,000 requests a day the free plan allows (0.83%).
This page and the backups made 40 calls on top, so about 874 in all (0.87%)." On the day alarms began to be counted apart
it adds when ("only since 14:05 UTC today; any before that are inside the pages' calls"), and that day's row in the table
says so on every later day too ("1,005 (alarms before 15:00 UTC inside)", "10 (since 15:00 UTC)"), each day from its own
mark, so a deploy day's (or a rollback's) alarms from before this code are never shown as the pages' calls beside an
exact-looking alarm count; a day this code did not count reads as it did, with "(The world's alarms are not counted apart on
this day: they are inside the calls.)". The line ends with the rows written: "The world wrote 4,100 rows to its database,
4.1% of the 100,000 rows a day the free plan allows (a day over it stops every save until midnight UTC). The nearer limit
today is rows written: that share is what the cost gate reads." The note above it says in plain words what alarms are, that
two knights left on one map used to cost about 1,200 of them an hour, and that a knight playing writes about 1,100 rows an
hour but makes only about 410 requests. The table's columns: day, messages, the pages' calls, alarms ("not counted apart"
before the column), the game's requests, its share of the free plan, this page's calls, everything's share, rows written
("not counted" before the column) and their share of the free plan's rows.

**What an idle page costs** (4 Oct 2026). The game saves every 15 s whatever the knight is doing (`src/99-boot.js`), and
72-cloudsave used to push every one of those saves: 210 to 240 calls an hour from each page in the game, paused or in the
background (measured with real pages under wrangler dev). It now pushes a save only when it differs from what the cloud
holds: the same string never again (a page in the background: nothing moves), a save that differs only in the world clock
`time` (a paused page) at most every 10 minutes, and anything else as before (the 12 s hold). Leaving the page (hidden,
`pagehide`) still pushes whatever differs, the clock included. A keeper's game no longer sends an empty `mon` once a second
when nobody is near it (its presence says it is alive), which halves a lone open page's socket messages (`75-coop`). A
paused keeper (or one on the title screen) with a knight near is as it always was: it streams its frozen monsters to him 8
times a second and keeps the map, so a named boss's fight, its count and its death stay on one game. (Round 1 of this work
made a paused keeper go quiet and hand its map to a friend who played; that lost boss credit at the hand-over, and the repairs
for it, a count on the row and a 'hand' message, then paid twice and stood dead bosses up again, so it was taken out on
7 Oct 2026. The shared world's later stages move monsters onto the server, which ends keeper hand-overs for good.)

Measured 7 Oct 2026 with real headless pages against two local `wrangler dev` worlds side by side, master d523504 and this
change (`tools/idle-pages.cjs`, 120 s a situation; each World's alarms and socket messages counted by a `console.log` in
`alarm()` and `webSocketMessage()`, since master's meter has no alarm column; billed = the pages' calls counted at the page,
each `/api` call and each socket opening (`/ws`, billed as a request too; only the iPad row opens sockets inside the window) +
alarms + socket messages / 20, per hour; "hidden" is an emulated background tab whose timers are not throttled):

| Situation (per hour) | before: alarms, page calls, messages, billed | after: alarms, page calls, messages, billed |
|---|---|---|
| two knights on one map, both paused | 1,197, 449, 0, **1,646** | 0, 0, 0, **0** (the World napped) |
| the same in an instance | 1,198, 449, 0, **1,647** | 0, 0, 0, **0** (napped) |
| one paused, one in the background | 1,198, 479, 0, **1,677** | 0, 30, 0, **30** (1 save in the window; napped) |
| both playing, standing still | 1,228, 449, 35,251, **3,440** | 0, 449, 35,221, **2,210** |
| keeper paused, the other playing | 1,198, 449, 30,938, **3,194** | 0, 210, 30,998, **1,760** (the paused keeper streams and keeps the map, on both) |
| one knight paused | 0, 210, 0, **210** | 0, 0, 0, **0** |
| one knight in the background | 0, 239, 0, **239** | 0, 30, 0, **30** |
| one knight playing, standing still | 0, 210, 7,158, **568** | 0, 210, 3,594, **389** |
| an iPad put down and picked up, 5 times in 120 s | 150, 450, 4,856, **842** | 150, 450, 2,548, **727** |

Two paused knights cost nothing: the keeper streams to a friend only while the friend is near and heard (a paused page sends
no presence; on the fake clock the paused keeper's last snapshot to a paused friend goes 14 s after both paused, on master as
here), no alarm watches a quiet keeper, and the World naps 10 s after that. The keeper-paused row is the one the taken-out round-1 rule had brought to 389: a paused keeper
beside a friend who plays still streams 8 snapshots a second, as on master, and that is now the largest idle cost left.

The iPad row was first written as 449 alarms an hour before (963 billed) and 150 after (577): the "before" alarms were the
World's game calls minus the pages' own, and that subtraction counted the 5 socket openings and the harness's own 5
`/api/status` calls as alarms, while "billed" left every socket opening out on both sides. Re-measured 6 Oct 2026 side by
side with the corrected harness, and each World's alarms counted by a `console.log` in `alarm()` (the master copy has no
alarm column): 5 alarms in 120.5 s on each, one a cycle, so this change saves no alarms there; the page calls are 10 saves
and 5 socket openings on each. The whole difference is the keeper's empty `mon` heartbeat, gone (77 of master's 162
messages in the window).

The fake clock agrees (`node tools/idle-alarms.mjs`, and `--src <master>/online/src --beat` for before): two or three idle
knights on one map 1,180 to 1,200 alarms an hour before, 0 after (only the roster's one after the first presence); a silent
keeper (a locked phone, a hidden tab) beside a knight who plays, one alarm for the hand-over. Not changed: a page left unpaused saves (and so pushes) every
15 s, because its play time moves (210 an hour), and a keeper with a knight near and heard, paused or not, still streams 8
snapshots a second.

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
  `cap`) on a boot throw, 3 tick throws within 10 s, 3 ticks in a row over 25 ms, the heap over budget (only with a heap
  probe; workerd has none, see Stage 2), or more copies than the cap. Inside workerd the clock only moves on I/O, so there a
  tick's cost is read from two zero-delay timers after it (Stage 2, "How `slow` is measured in workerd").
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

### Stage 1: the Atlas, the capabilities, the movement check (watching only), and each knight's own island

Players see nothing new, with one exception: a page older than the world it talks to says so (below). Nothing a knight
does is refused, moved or corrected. The new parts:

**The Atlas: one table of every place.** `src/01-atlas.js` defines `window.ATLAS` and the hand table `ATLAS_RULES`;
`src/96-atlas.js` registers the very last `HOOKS.world` pass, which builds the per-tile place grid and the FIXED_SOLID mask
from the world just generated (before any save's changes are laid on it), and holds the drift self-tests.
`tools/atlas.mjs` (run by `build.sh`) boots the built game headless and writes `online/src/atlas.json`; the Room has no
game, so it reads that file through `online/src/atlas.js`. The game's own copies read `window.ATLAS`.

- **A place** is `{ i, id, name, sub, kind, map, combat, pri, rects, spawn, call, pvp, safe, loose, of }`:
  - `id` matches `^[a-z0-9_]{1,40}$`. A region's id is made from its name: lower case, a leading "The " and every "'s"
    dropped, anything else that is not a letter or digit becomes `_` ("The Fang's Lair" is `fang_lair`, "Goblin Camp"
    `goblin_camp`). An instance's id is its `INSTANCES.define` id.
  - `name` and `sub` are never written in the Atlas: they come from the REGIONS entry or the `INSTANCES.define` the feature
    already declares. An area (below) takes its parent's.
  - `kind`: `region` (every REGIONS entry, Stage 1: 21), `instance` (every `INSTANCES.define`, 10), `area` (a hand-drawn
    part of a region, with `of` naming the region: `hollowford_square`, `ashfields_dragons`, `iron_isle_wreck`) or
    `reserved` (named now, on no tile yet: `deep_wilderlands`).
  - `map`: `'over'` or the instance id. `combat`: `'single'` or `'multi'` (nothing reads it before Stage 7). `safe` and
    `pvp`: booleans, all false in phase 1 (Thistledown's `safe` is the option the spec keeps off). `loose`: this place's
    building walls change in play (Hollowford is rebuilt), so they are never FIXED_SOLID there.
  - `pri`: when places overlap the higher one owns the tile. Regions keep REGIONS' own order (the first match wins, as
    `regionAt` does): `pri = 1000 - its index`. Areas are 2000. A rule may set its own.
  - `rects`: `[[x0, y0, x1, y1], ...]` in tiles, inclusive: a region's own rect, then any rects its rule adds. The Goblin
    Camp's rule adds the camp spawns' rect, `[142, 18, 159, 42]`, because `generateWorld` marks camp spawns from x 142
    while the region starts at x 145.
  - `spawn`: `[tx, ty]` where a knight sent to this place lands (an instance's `entry`; Thistledown's square), or null.
  - `call`: the `HOOKS.bossCall` id woken here, read from the boss files themselves (`the_fang` in `fang_lair`, `war_shed`,
    `gnasher` in `tinker_lab`, `stormfront`), or null.
- **ATLAS_RULES** holds only `{ id, kind, of, combat, pri, rects, spawn, call, pvp, safe, loose }` and only where a place
  differs from the default (a region or instance with no rule is `single`, with its own rect or map). Moving a border is
  one line. Multi in phase 1: `goblin_camp`, `fang_lair`, `hollowford_square`, `ashfields_dragons`, `iron_isle_wreck`,
  every boss instance (`spider_den`, `war_shed`, `tinker_lab`, `stormfront`, `afterlands`, `royalmine`) and
  `deep_wilderlands`. Single: everything else, `deepholm`, `aerie`, `coalmine` and `house` included.
- **`window.ATLAS`**: `places` (the list), `get(id)` (one place), `place(map, tx, ty)` (the place on that tile of that map),
  `at(tx, ty)` (the same on the overworld), `zoneAt(map, tx, ty)` (its id), `combatAt(map, tx, ty)` (`'single'`, `'multi'`,
  or `'safe'` where a place's `safe` is on), `inside(id, k)` (a knight or monster `{x, y, map?}` in pixels is on that place),
  `spawn(id)`, `solidAt(map, tx, ty)` (FIXED_SOLID), `hash()`, `export()` (what `tools/atlas.mjs` writes). An instance
  map is one place all over (its own `w` x `h`); a tile outside it, or outside the overworld, is no place (null).
- **FIXED_SOLID** is what no honest knight can ever stand in: the tiles named in `FIXED_TILES` (`WALL` (rock, cave and
  every instance's walls), `CWALL` (castle), `HWALL` (building walls), `TOWN_WALL`, `KING_WALL`, `KING_TOWER`, `CLIFF`,
  `REDCLIFF`, `AF_CRAG`) as the world generates them, minus any tile an NPC is placed on and any `HWALL` in a `loose`
  place, plus everything off the map's edge. Left out on purpose: water and lava (hover armour, boats and the ferry
  cross them), every tile a knight can chop, mine, burn, build, open or climb (trees, rocks, ores, planks, fences, gates,
  doors, the agility shortcuts and the steps cut in a scarp), and anything `WALK_OVER` ever holds. A self-test holds
  each of those: no item places a FIXED tile, no FIXED tile is ever in `WALK_OVER`, every FIXED tile is solid. The same
  rules make each instance's mask from its built tiles; `house` has none (each knight's island is his own and never
  checked).
- **`online/src/atlas.json`** (generated, committed, never edited by hand):
  `{ v: 1, hash, MAP_W, MAP_H, TILE, places, grid, fixed, spawns, doors, calls, speed, realm }`. `grid` is the overworld's
  place index per tile, row by row, as runs `[index, count, index, count, ...]`; `fixed` is `{ over: runs, <instance>:
  { w, h, runs } }`, runs of 0 and 1 starting with a run of 0s; `spawns` is `MONSTER_SPAWNS` (the index is the `s<i>` nid)
  as `[type, tx, ty, camp]`; `doors` each instance's `{ door, step, entry, exit }`; `calls` each boss call's `{ map, near,
  type, place, file }`; `speed` is SPEED_CAP, the fastest each mover goes (px/s: `foot` 175, `hover` 200, `horse` 350,
  `dozer` 250, `walker` 115, `beast` 100, `steam` 430: a machine's FULL STEAM run) and `max`; `realm` the files that hold a boss rest (Stage 2's `realm_state`).
- **`hash()`** is a 64-bit hash, as 16 hex digits, of what the world judges by: `v`, MAP_W, MAP_H, TILE, every place's
  `id, kind, map, combat, pri, rects, pvp, safe` and the `grid` and `fixed` runs. Names and subs are not in it, so a
  reworded sign never makes anyone reload. The game works it out once per world build; `atlas.json` carries the same
  number because `tools/atlas.mjs` asks the game.
- **Drift.** `online/test/atlas-drift.mjs` (a deploy gate in both deploy scripts, and part of `node --test online/test/`)
  builds the Atlas again from `index.html` and fails unless it matches `online/src/atlas.json` byte for byte, so a stale
  Atlas never ships. The self-tests in `96-atlas.js`: every REGIONS name and every instance id has a place; every place
  but a reserved one covers at least one tile or is an instance; every overworld tile has exactly one place, and outside
  the areas and the camp's extra rect it is `regionAt`'s; every boss instance (a `boss`, or a boss call on its map) is
  multi; the camp rect covers every camp spawn; every `spawn` tile is walkable; every id matches the pattern; the dragons,
  the wreck crew and the square's beast stand in their areas; the Atlas pass is the last world pass.

**Capabilities and the Atlas on `hello`.** `hello` gains `caps` and `atlas`:

```
{ t: 'hello', v: 1, caps: [], atlas: '<ATLAS.hash()>' }
```

- `caps` lists what this game can do of the shared world's new messages: `tick`, `die`, `roll`, `loot`, `zone`, `fix`,
  `day` (the spec's table), and `snap` (Stage 2: it answers the world's `snap`). A Stage 1 game can do none of them, so it
  sends `[]`; a game of Stage 2 sends `['snap']`. The Room keeps, in order, only the names it knows (at most those 8) and
  drops the rest; anything that is not an array is `[]`.
- `atlas` is kept when it is 1 to 32 characters of `0-9a-z`, else null (an older page sends none).
- Both ride the knight's attachment, so a nap keeps them. Nothing new goes to a knight whose `caps` lack the capability.
- `welcome` gains `atlas`: the world's own hash (from `atlas.json`), when the world has one.
- **A page older than the world.** When `welcome.atlas` is there and differs from the game's own `ATLAS.hash()`, the game
  shows a plaque in the kit's column: gold edge, "NEW WORLD", and under it "A newer world is ready. Tap to reload." ("Click
  to reload." on a computer); the whole plaque is the tap (44 px tall on touch) and reloads the page. It is said once as
  a notice too. Until then that knight plays as before and the world does not check his movement (counted as `old`).

**Presence gains `j`, `spd` and `s`.**

| field | meaning |
|---|---|
| `j` | a jump counter: `src/73-players.js` adds 1 whenever the knight's own position moves more than 3 x speed x dt in one frame (speed at least 175). A teleport, a respawn, a portal or a door into an instance, a ferry's landing, an admin's jump, a knockback shove: each is a jump |
| `spd` | the knight's own speed now, px/s (`player.speed`: 175 on foot, the mount's or machine's otherwise; 430 while a machine's FULL STEAM run lasts) |
| `s` | this socket's presence count, 1, 2, 3, ... (what Stage 9's `fix` will answer to) |

Old worlds relay them like any other field; the Room relays them too.

**The movement check (`online/src/move.js`), watching only.** The world keeps, per knight, where he last said he was and
judges each new presence against it. In Stage 1 it only counts. It never sends anything, never moves a knight and never
changes what is relayed.

- **Modes** (settings key `sim`, `move`): `'observe'` (the default: count) or `'off'` (nothing is judged). `soft` and
  `correct` are Stage 9's. The switch is on the parent page; `off` takes effect on the next presence.
- **Not judged** (counted as `skipped`): the mode is off (nothing is counted at all then); the knight's page has another
  Atlas or none (also counted as `old`); his map is `house` or a map the Atlas does not know; he is dead, or was at his
  last presence (a respawn lands anywhere); his first presence on a map (nothing to compare with). A world with no Atlas
  judges nothing and counts nothing.
- **Time.** Each presence is stamped when it arrives, but never closer than 125 ms after the one before (the game sends
  at most one every 1/8 s of its own time, which never runs faster than real time). So a stalled line that hands over
  a second of presences at once is spread back out instead of reading as one blink of great speed; and a hitch in the
  game (its frame is cut at 50 ms) only ever slows the knight.
- **A jump** (`j` went up) waives that one step: it is never too fast. The new spot must still not be in FIXED_SOLID.
  More than 6 jumps in 10 s is logged as `jumps` (not a violation).
- **Too fast** (`speed`): over the last second (by those stamps) the path he reports, step by step and jumps left out, is
  longer than `1.25 x max(spd, 175) x seconds + 48 px`, with `spd` taken as the highest he reported in that second and no
  more than SPEED_CAP's `max`. One violation is counted, that second starts again, and no other is counted for a
  second after it (at most one a second).
- **Through a wall** (`wall`): the new spot is in a FIXED_SOLID tile or off the map, or the straight line from the last spot
  crosses the middle of one (a FIXED_SOLID tile shrunk by 12 px on each side: a knight's 13 px body keeps his centre that
  far from any wall, and a step cut across a wall's corner cannot reach the middle unless it is over 70 px long; the fastest
  honest step, a machine's FULL STEAM run, is 54 px).
- **Kept** in two new tables (created only if missing; nothing else in the schema changes):

```
move_day (day TEXT PRIMARY KEY, checked INTEGER NOT NULL DEFAULT 0, speed INTEGER NOT NULL DEFAULT 0, wall INTEGER NOT NULL DEFAULT 0,
          jumps INTEGER NOT NULL DEFAULT 0, waived INTEGER NOT NULL DEFAULT 0, skipped INTEGER NOT NULL DEFAULT 0, old INTEGER NOT NULL DEFAULT 0)
move_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, n TEXT NOT NULL, map TEXT NOT NULL, kind TEXT NOT NULL,
          x INTEGER, y INTEGER, px INTEGER, py INTEGER, ms INTEGER, spd INTEGER, detail TEXT NOT NULL DEFAULT '')
```

  `move_day` counts wait in memory and go out like the meter's (one upsert per day touched, when 2,000 are waiting, a
  minute after the last write, and on every socket close and alarm; until 6 Oct 2026 200 and 10 s, 360 rows written an hour
  while anyone played); `old` is how many of the skipped came from a page with another
  Atlas or none. Each violation is
  one `move_log` row at once (where he was, `px, py`, and where he said he went, `x, y`, the stamped gap `ms`, his `spd`),
  at most 200 a day; past that only the count grows. Rows older than 60 days go on the first write of a day. The admin
  export includes both tables.

**Each knight's own island: the house key.** The island (`house`, `src/63-house.js`) is an instance every knight has his
own copy of, but every knight on his island used to share one map in the Room: they saw each other's knights standing on
their own islands. The Room now keys it `house:<his name, lower case>`, so a knight on his island is alone there: no
presence in or out, no keeper but himself, no trade, no party but his own. Every message out still names the map `house`
(`keeper`, `left`, a relayed `p`, the roster, `crackers`), so a game never sees the key. A `map` a game sends that starts
with `house` (`house`, or `house:anything`) is always the sender's own island. The `house` map is never simulated (Stage 2).
So a game reads a roster row (or any message) naming another knight on `house` as HIS island, never its own: the Friends
panel never marks him 'on your map' (no blue edge, Follow stays dark) and says 'On their own island', and so does the
admin Knights tab (`src/73-players.js`, `src/76-admin.js`, each with a self-test).

**The parent page and the switch.** `GET /api/admin/sim` adds, beside `meter`:

```
sim:   { move: 'observe' | 'off' }
atlas: { hash, places, fixed }                       (fixed: how many overworld tiles are FIXED_SOLID)
move:  { mode, today: {day, checked, speed, wall, jumps, waived, skipped, old}, days: [same, newest first, 14 days],
         recent: [{at, n, map, kind, x, y, px, py, ms, spd, detail}, ... newest first, 30],
         knights: [{n, map, atlas: 'same' | 'old' | 'none', caps}] }
```

`POST /api/admin/sim {move: 'observe' | 'off'}` (Bearer ADMIN_KEY) sets the switch, kept in `settings` as the JSON of
`{move}` under the key `sim` (later stages add their keys beside it; unknown keys already there are kept), and answers the
same as the GET. Anything else is 400 `bad`. The parent page's **Shared world** section gains a line for the check and the
Atlas, the last violations (when there are any) and a button that turns the check off or back on: "Movement check:
watching (it counts, it never moves anyone). Today: 1,234 steps checked, 0 too fast, 0 through a wall. World map
1a2b3c4d5e6f7a8b: 2 knights on, both on this map." These come in the same `GET /api/admin/sim` the meter already makes,
so the page makes no new calls.


**What it costs, measured** (3 Oct 2026, MacBook Pro, node 26, other builders' runs on the machine):

| | |
|---|---|
| The Atlas | 35 places (21 regions, 10 instances, 3 areas, 1 reserved); 2,950 overworld tiles FIXED_SOLID; hash `ea36148040c3f60c` |
| `online/src/atlas.json` | 29.1 KB (5.4 KB gzipped): 1,603 grid runs, 2,287 FIXED_SOLID runs, 9 instance masks |
| Building it in the game | `ATLAS.build()` 4.0 ms median over 20 builds (3.8 to 8.1 ms), once per world build |
| Reading it in the World | `JSON.parse` and `readAtlas` 0.58 ms, once per wake |
| The movement check | `judge()` 0.72 microseconds per presence on foot, 0.89 on the mare (200,000 presences each) |
| The drift gate | `node online/test/atlas-drift.mjs` about 3 s (two builds of the game). Proved: one rect in ATLAS_RULES moved and the game rebuilt without committing the new `atlas.json`, the gate exits 1 ("does not match the game ... Run ./build.sh and commit online/src/atlas.json") and a `set -e` deploy script stops there |
| The Worker | 184.95 KiB uploaded, 47.06 KiB gzipped (`atlas.json` is 29.1 KB of it), startup 5 ms (the test deploy's own figures) |

**The audit** (`node tools/move-audit.mjs [--play]`, logs in `~/.fanglands/work/phase1/sw-1/`): the whole headless suite,
then the suite with the bot's playthrough of the main quest, with the knight's presence sampled as 73-players sends it and
judged by `move.js` against the world's own Atlas. First run: 17,659 steps judged, 2 too fast, 1 into a wall. The two too
fast were a machine's FULL STEAM run (55-riding, 430 px/s, faster than any mover SPEED_CAP had): SPEED_CAP gained `steam`,
presence reports it while the run lasts, and a self-test now holds SPEED_CAP to the movers' own tables. The wall was a
self-test (91-cloudkingdom K22) putting the knight on a tower in Aerie to check its ground cache: a teleport, not play.
After the fix: 17,551 judged, 0 too fast, 0 wall (27 jump bursts logged, 537 jumps waived); with the playthrough 31,707
judged, 0 too fast, 0 wall. The world never had a FIXED_SOLID tile change under it at boot: the only tiles the world adds
after the Atlas pass are the War Shed's late door walls (more wall, never less).

**The proof** (`~/.fanglands/work/phase1/sw-1/proof/`, 3 Oct 2026). Two real browsers, a laptop (1280 x 800) and an iPad
(1024 x 1366, touch), on a local `wrangler dev` world running this branch (`stage1-proof.js local`, two fresh test
knights): 10.0 minutes of play on the keys (walking and fighting goblins in the fields), the mare at 350 px/s, Harl's ferry
to Gull Isle and back, the island portal, the palisade climb at Agility 25, a death and the respawn. Both games sent caps
`[]` and the world's own Atlas in hello, and welcome named the same; no reload plaque. The movement check took all 2,933
presences the two games sent: 2,856 judged, 77 not judged (first steps, deaths, the islands), 56 jumps waived, 0 too fast,
0 into or through a wall. Both knights stood on their own islands at once: neither saw the other, each kept his own, and
the roster said `house` for both. A page told of another Atlas shows the NEW WORLD plaque, 44 px tall on the iPad
(`new-world-plaque-ipad-local.png`). On the test world (https://test.gorkscape.ca, deployed with
`~/.fanglands/tools/deploy-test.sh` after the backup, every gate green; `test-world-check.js`): `GET /api/admin/sim`
answers the Atlas `ea36148040c3f60c` and `observe`, the served game builds the same hash on a laptop and an iPad and says
it in hello, and the parent page shows the check (`test-world-admin-*.png`). The same two-browser run with Probe Knight
and Probe Two on the test world is `node stage1-proof.js probe`; it logs the probes in with their secret word.
After review round 1 (the Friends panel told two knights on their own islands they shared a map): the proof also opens
Friends on each island (F on the laptop, a tap on the seal on the iPad) and checks the other knight reads 'On their own
island', with no blue edge and Follow dark, and that a real tap on Follow does nothing
(`friends-on-islands-{laptop,ipad}-local.png`). The re-run, 9.9 minutes: ALL PASS, 3,375 presences, 3,298 judged, 77 not
judged, 44 jumps waived, 0 too fast, 0 into or through a wall, no page errors.

### Stage 2: the world keeps the plain instances (deepholm and aerie), switched off

The world itself can now be the keeper of a map: it runs the monsters in its own copy of the game (the harness of Stage 0)
and every knight on that map shows the copy's monsters, exactly as a non-keeper shows a keeper's today. Only two maps
can be switched over in this stage, the plain instances with monsters and no boss of their own: **deepholm** and
**aerie**. The third plain instance, the coal mine (**coalmine**), has no monsters at all, so the world has nothing to run
there: the parent page lists it greyed with that reason and no button, and `POST` refuses it (`WORLD_EMPTY` in
`sim/worlds.js`; `tools/mmo-sim-world.js` check 0b fails if a copy of it ever has a monster, or a copy of either of the two
has none). Every map ships on `keeper`. A game needs nothing new to play on a world-run map: the world speaks the same
`keeper`, `mon`, `hit`, `kill`, `hurt` and `boss_wait` it always did (the v1 wire); the few new fields are ignored by
older games. A game of this build also answers the world's `snap` (below); an older one is never asked.

**The switches** (settings key `sim`, beside `move`; unknown keys already there are kept):

```
{ move, master: 'on' | 'off', maps: { deepholm, aerie: 'keeper' | 'world' }, held: { <map>: {reason, at} } }
```

- A map is run by the world (`room.modeOf(map)` is `'world'`) only when `master` is `'on'` (the default), its `maps` entry is
  `'world'` (the default is `'keeper'`), it is not `held`, and the World has its game copy. Anything else is `'keeper'`:
  today's path, unchanged.
- `held`: a map the watchdog handed back (below) stays on the keeper path until the parent page flips it again. The
  hold is kept in settings, so a nap or a deploy never retries a map that just failed.
- `POST /api/admin/sim` (Bearer ADMIN_KEY) takes any of `{move, master, maps}`: `master` `'on'` or `'off'`, `maps` an object
  of map to `'keeper'` or `'world'`. `'world'` is refused for the coal mine (400 `empty`: no monsters live there) and for
  any other map but the two (400 `later`: its monsters move in a later stage); a map not in the spec's list is 400 `bad`. A flip clears that map's hold. `master: 'off'` sends every map
  back to the keeper path at once and leaves `maps` as it was. It answers the same as `GET`.
- Every change of a map's mode, by the parent page or by the watchdog, is one row in a new table (created only if missing):

```
sim_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, map TEXT NOT NULL, from_mode TEXT NOT NULL,
         to_mode TEXT NOT NULL, reason TEXT NOT NULL, tick_p99 REAL)
```

  `reason` is `'parent page'`, `'master'`, or the watchdog's `'boot'`, `'throws'`, `'slow'`, `'cap'`, `'stale'` (the copy
  stopped ticking for `KEEPER_STALE`, 3 s, while knights were playing there; a parked copy, below, is still on purpose and
  never stale) or `'nocopy'` (the World could not load the game copy). The newest 1,000 rows are kept. SimHost also knows
  `'heap'`, but only a host given a heap probe can trip it (node's sims): workerd has none (no `process`, no
  `performance.memory`: `performance` has only `timeOrigin` and `now`, checked 3 Oct 2026 on wrangler 4.92 local), so the
  World passes none, its `GET /api/admin/sim` says `heapProbe: false`, and on the World it is the copy cap (the overworld plus
  3 instances, 59.4 MB of the 128 MB isolate when measured) that holds memory, never a heap reading.
- **How `slow` is measured in workerd.** A Worker's clock only moves between events, so a tick cannot time itself. Right after
  each batch of ticks SimHost sets a zero-delay timer, and when it lands, a second one: the first gap is the ticks' own work
  plus however late the machine (or the object, busy with other messages) landed a timer; the second gap, with no work
  before it, is that lateness alone. A tick's cost is the first gap less the second, so a busy machine never reads as a slow
  copy; and a reading taken while the machine alone was over 25 ms late is set aside (it neither counts toward three slow
  ticks nor ends a run of them). In node (the sims) each copy is timed directly.

**The virtual knight.** `room.joinVirtual(sock, '@world:<map>', map)` puts the world's own knight on a map: its `sock` is
the way into that map's copy (what is sent to it is queued for the copy's next tick). It is never in `who`, never relayed
as presence, has no login row, and can never be gifted, traded with, asked, partied or moderated: it is not one of the
Room's knights at all, only the map's keeper. While a map is world-run the virtual knight is always its keeper and is never
taken for a silent one; a real knight is never elected there. `keeper` names it with `server: true`:

```
{ t: 'keeper', map: 'deepholm', n: '@world:deepholm', server: true }
```

What reaches the copy, as the keeper always got it: `hit`, `boss_call`, `spawn`, `spawn_clear`, and every knight on the map
as his accepted presence (`{n, x, y, fx, fy, dead, def, lv, hp, mhp, spd}` from his last `p`, and `left` when he goes) once a
tick. What the copy sends goes out as if a keeper sent it: `kill`, `hurt` and `boss_wait` to one knight on that map, and its
monsters as `mon` (below). Anything else a copy sends (its stand-in's own presence, its own snapshots) goes nowhere. A knight
whose place the world does not know yet (a Room just rebuilt from its sockets keeps no position) is sent no `mon` until his
first presence: a list filtered by no position would be empty, and an empty list from the keeper tells his game that every
monster it holds up has gone.

**`mon` from the world**, once a tick (10 a second) to each knight on the map:

```
{ t: 'mon', n: '@world:deepholm', list: [row, ...], k: 1234, at: 1759500000000, standing: 3 }
```

- `k` is the copy's tick count and `at` the world's clock in ms. Older games read neither.
- `standing` is how many monsters stand in the whole place (not fallen), however far from this knight. A knight's list holds
  only the ones near him, so the place's plaque ("AERIE  3 left", 16-instances) reads `standing` while the world runs the
  place (`COOP.placeStanding()`), and counts its own monsters as always on a knight's game. An older game ignores it.
- **Interest, per knight**: his list holds the monsters within 24 tiles of his accepted position; one he was sent stays in it
  until it is past 27 tiles (so a monster on the edge does not blink in and out), and one whose target is him is always
  in it. A knight with nothing near still gets an empty list each tick: the world's stream never stops while he is there.
- A row keeps the 14 contract columns and may go on with `[tgt, lock, phase, vx, vy, look]`: `tgt` the knight it is
  chasing (or null), `lock` null until Stage 7, `phase` the one extra state its look reads (below), `vx, vy` its speed in
  px/s, `look` an object of the other look fields (`{ally}` for a Dragon Killer, `{emberT}` for a cinder heart). A row ends
  at its last column that is not null, so a plain monster's row is the 14 columns it always was.
- **The look fields** (the monster-look addendum): the copy carries every field of `MONSTER_LOOK.LOOK_FIELDS` (read from
  `src/78-monsterlook.js` when the copy is built, so a new look field is never dropped): `phase` is the thunderbird's
  `hunt / high / perch`, the Fang's element, the zombie brute's `wind / stagger`, the cinderwight's `feed / cold`, the
  barrelbeast's `volley`, the gnasher's `arm`, a dozer's `charge`, and the Ginormous Golem's `mend` (for 0.9 s after he
  mends); `look.ally` (`hale` or `garrick`) and `look.emberT` ride in `look`. A game (75-coop) copies `phase`, `ally` and
  `emberT` onto the puppet, where the monster look reads them. An older game ignores them and draws the resting pose.

**Inside the copy** (src/79-worldkeeper.js and 75-coop; nothing changes in a browser):

- **The kill goes to the top damager**: the copy keeps, per monster, the damage each knight's hits did (`dmgBy`, counted
  only up to the hp the monster had), and on its death the knight with the most gets `kill` (a tie: the one who hit it
  first). The ledger starts again when the monster stands up again or is back at full health. Named bosses keep their helper
  credit (*Named bosses*).
- **Throwers** (the goblin sapper) aim at the knights too: the copy's sapper keeps its distance and throws its sticky bomb at
  the nearest knight, and a bomb that goes off hurts every knight in its blast (`hurt`, rolled as `explode` rolls it) as
  well as the monsters near it. In a browser a thrower still aims only at its own keeper's knight.
- `save()` does nothing; the copy's own `rollDrops` makes nothing (the credited knight's game rolls his drops, as today).
- The copy's own `mon` and presence are dropped; the world sends its own `mon` each tick from `WORLDKEEPER.rows()`.
- **A fallen monster stands up again only while no knight is near its home**, as in a knight's own game (07-update: 4 tiles
  from its home, 40 for a Goblin Camp monster). In a browser that rule reads the player; in a copy the player is the stand-in
  parked at tile (0, 0), so `WORLDKEEPER.holdRespawns` keeps it against the real knights there (`COOP.knightsHere()`): a
  monster whose time is up waits until every knight is that far off. Before 4 Oct a kid standing on a felled sentinel's home
  saw it stand up beside him after its 25 to 35 s (`tools/mmo-sim-world.js` check 14 fails on that copy).

**Taking a map over (keeper to world), and the cold copy.** Nobody ever waits for a copy to build:

1. The first knight into a world-run map keeps it in his own game, as today. Right after (the Room's alarm, 0 ms) the world
   builds the copy and names the virtual knight to the copy only. **The build stops the whole World**: chat, every other
   knight anywhere, the other world-run places. Measured on this MacBook Pro (Apple M4, wrangler 4.92 local,
   `node tools/sim-freeze.mjs`, 4 Oct 2026, 6 cold Deepholm builds each): the World relayed nothing for 732 to 862 ms (median
   780 ms) on a quiet machine, and 815 to 1,305 ms (median 1,076 ms) with two headless suites and the sim-suite running beside
   it; each freeze matched the World's own build time within 40 ms. The review of 3 Oct saw 1.7 to 2.6 s with other
   builders' suites running on the same machine. Cloudflare's machines are not this one; nothing here measures them. It
   happens on every build: the first knight into an emptied place after its copy went (60 s, below), a parent-page flip, a
   wake. Nothing cheap cuts it: a `worldGen: false` copy builds in about 50 ms, but for these two maps it does not come out the
   same as the full build (`tools/sim-suite.mjs` check 5), and the spec's pre-warmed spare copy only moves the same freeze to
   another moment.
2. The copy starts as a non-keeper: it is told the real keeper's name and reads his `mon` stream (the Room hands the copy
   every `mon` the keeper sends meanwhile), so it holds his monsters as puppets.
3. The keeper's game is asked for its full snapshot when it has the `snap` capability (below). The virtual knight becomes
   the keeper at that answer; for an older page, at the first `mon` with monsters in it; and for either, after 1.5 s
   (`JOIN_WAIT`) with neither. An empty `mon` from an older page is a lone keeper's heartbeat (it lists nothing because
   nobody else is near him, not because his monsters are gone) and is never read as his monsters. Then the copy's own
   `handoff()` turns the puppets into its real monsters, with the same nids, hp and positions, and every knight on the map
   hears `keeper` naming `'@world:<map>'`. The old keeper's game turns into a non-keeper, as for any keeper change.
   Its screen never blinks empty meanwhile (75-coop `setKeeper`, a game of this build): a game that kept the map and hears
   another keeper named keeps the monsters on its own screen (within 24 tiles of its knight, alive, with nids) standing as
   puppets where they were, with their hp, until the new keeper's first `mon`; that list is the word, and a held-up puppet
   it does not name goes. A game arriving on a map holds nothing up (it knows nothing yet). This is true of every keeper
   change, a knight's or the world's. An older game blinks empty for one round trip (about 100 ms) at the change, as it
   always did when its keeper changed.

**The full snapshot (`snap`, a game of this build).** When the copy starts reading a keeper whose `hello` named the `snap`
capability, the world sends him `{ t: 'snap', map }` once. His game (75-coop) answers at once with one
`{ t: 'mon', full: true, list }` listing every monster it runs on that map, standing or fallen, near anyone or not (at most
400 rows, the usual columns; a fallen one has row column 11 at 1). That answer, not his ordinary stream, hands the copy the
map: so when a knight alone walks into a world-run place, or the parent page switches on the place he is fighting in, a
monster he chased, hurt or felled while the copy was being built carries on in the copy exactly as it stands on his screen,
and never jumps home at full health. An older page is never asked: its lone keeper's take-over is as before (after 1.5 s the
copy keeps its own monsters, standing where it has them, at their own hp: on his screen a monster he had hurt goes back to
full health and one he had moved jumps to where the copy has it; nothing vanishes). A `full` list from a game that was not
asked is an ordinary snapshot. `tools/mmo-sim-world.js` check 11 proves the first and fails with the capability taken away
(`MMO_SIM_NO_SNAP=1`: the guard goes back to 90 hp on her screen).

The parent page flipping a busy map to `world` takes it over the same way. A copy whose map empties runs on for 60 s
(SimHost's `DROP_EMPTY_MS`); a knight back inside that time finds the same monsters, and the virtual knight is keeper at
once. The loop stops 60 s after the last knight on any world-run map leaves; with no copy left at all (after a hand-back) or
only parked ones (below) it stops at once. Either way no timer stays armed, so the World naps as it does today.

**A knight whose game stops** (a locked iPad, a paused game, a tab left in the background with its socket open). Every
playing game sends its presence at least once a second; the client sends no pings of its own, and the runtime answers the
socket's `ping` without waking the object.
- After `SILENT` (3 s) with no presence from him, the copy is told he has fallen (his `p` goes to it with `dead: true`), so no
  monster fights him while he cannot play. His next presence brings him back. (The blows of those first 3 s still land when
  his page wakes, as they would had he stood still those 3 s.)
- When **every** knight on a world-run map has gone silent, its copy is **parked** (`SimHost.park`): its monsters stand
  exactly where the knights last saw them, it is not ticked, and it counts as no knight for the loop. With nothing else
  running the loop stops at once, so no timer stays armed and the Durable Object hibernates exactly as it does today (on
  the keeper path a lone keeper's own game stops its monsters the same way). The virtual knight stays the map's keeper; the
  stale net (`KEEPER_STALE`) never counts a parked copy's silence. Parking is not a hand-back: no `sim_log` row.
- The first presence from any of them, or a knight arriving, ticks the same copy again from where it stood: the same nids,
  hp and places, no `keeper` message, nothing rebuilt, so on no screen does a monster vanish or show twice.
- If the object did hibernate meanwhile, the copy went with it: the wake is any wake (the Room rebuilt from its sockets
  names his game keeper out loud, the copy is built again and takes the map over, with his full snapshot when his page has
  `snap`). **No copy is built for a place while nobody there is playing**: a Room rebuilt from its sockets knows no knight's
  place, and something other than his own game can wake the object (a login, the parent page, another knight's socket)
  while his game is still stopped. The copy waits for a knight on the map whose place the Room knows and whose game is not
  silent: his first presence asks for it (`Worlds.playing`, `wanted`), so his page is awake to answer `snap` and the place
  carries on as his screen last showed it. A copy that was told no knight at all (every knight on the map known only from
  his socket) is resting, not stale: `staleCheck` skips it, and counts from the moment it is told a knight again. If the
  host drops such a copy (60 s with no knight told), the map goes back to a knight's game quietly (no hold, no `sim_log`
  row) and his playing asks for a new copy. Before 4 Oct a wake by anything else built the copy at once, and his return
  handed the place back as `'stale'` and held it until the parent page let the world run it again
  (`sim-host.test.mjs`: "a place left resting is not handed back as stale after a nap ..."). A parked copy whose map has emptied goes 60 s after, as any emptied copy does (looked at whenever the host is next
  called, as no timer runs for it).
- **A resting place costs no alarm** (`Worlds.resting`: a place switched to the world, with no copy and nobody there
  playing). The Room keeps that place's keeper as it is (`Worlds.holds`: the first knight the wake restored there) and
  watches nothing on it: with two knights resting there the keeper-stale rule of a knight's map would hand it
  between them every 3 s for ever, so the object never napped again (about 1,180 alarms an hour), or, restored in the
  other order, asked for an alarm at the same past moment again and again until workerd dropped one and no alarm was ever
  set again on that wake (no copy built when a knight then played, gifts never returned). The Room itself is also guarded,
  on every map: a stale keeper that is still the best one (everyone else there silent too) starts a new grace, and a tick's
  own re-arm is never at or before the moment it handled (`REARM_MIN`, 1 s). Since 4 Oct 2026 no map is watched by an alarm while nobody plays there (the keeper rule, above:
  only a playing knight's presence that finds the keeper nearly stale books one): two knights
  paused on a knight's map keep the keeper they have and ask for no alarm (`online/test/room.test.mjs`: "two silent knights restored after a
  nap ...", `sim-host.test.mjs`: "two knights resting in a world-run place ...").
- **The copy takes the place over from a knight who is playing.** The wake names whoever its restore elected, and that can
  be a friend whose iPad is still locked. When the copy is built (or the copy's code loads, `announce`) and the keeper's
  game is silent or the Room does not know his place while another knight there is playing, that knight (one with `snap`
  first, then the longest on the map) is made keeper out loud first, and it is his page that is asked for its full snapshot
  (`Worlds.source`). Before 4 Oct the copy asked the locked friend, heard nothing, and after `JOIN_WAIT` kept its own
  fresh monsters: the kid came back to the sentinel he had felled standing at full health.
- **A game keeps what the world last showed through a friend's keeper message** (75-coop `WORLD.kept`, a game of this
  build). A game showing the world's puppets that hears another knight named keeper (the wake's word above) keeps the
  world's last rows until it keeps the map itself (then `keepWorld`, as at a dropped socket) or leaves the map. Before
  4 Oct it dropped them, and when the map then came to it, a felled monster whose puppet had gone came back from the array
  made when the knight walked in, standing. `tools/mmo-sim-world.js` check 13 (two knights locked, the world napped, woken
  by the parent page or by the kid's own unlock, the Room rebuilt in either order) fails with either half of this taken
  back.
- Proved in `sim-host.test.mjs` (one knight silent with his socket open: 0 timers armed and 0 ticks for 10 minutes, then he
  moves and the same copy ticks again with every monster once) and `tools/mmo-sim-world.js` check 10 (every game stopped:
  both real copies park, nothing armed, nothing ticked or moved in 10 minutes, then every screen keeps the same monsters).

**A dropped socket** (iOS drops a sleeping tab's socket; a lock of a minute is enough). The game goes offline and runs its
map itself until the world answers again. On a place the world ran, it carries on from **what the world last showed**
(75-coop `keepWorld`, a game of this build): while the world keeps the map the game remembers the last row the world sent of
each monster (by nid, kept after a monster leaves its 24 tiles and after a fallen one's row stops coming), and at the drop
its puppets turn real, then each remembered monster no longer on screen is put as the world last showed it: a hurt one at its
hp and place, a fallen one down. It never goes back to the array the game made when the knight walked in. When the socket
comes back the world takes the place over from that (the copy, if it is still there, carries on; if it went, the new one
asks the page of a knight who is playing there for its full snapshot, which is now that state; see the take-over above). The same holds when the world hands a map to his game.
Before 4 Oct a lone kid locked 90 s came back to the hurt sentinel at full health at home and the felled one standing, and
the new copy adopted them so (`tools/mmo-sim-world.js` check 12 proves the fix and fails on the old game).

**A deploy keeps only what the first knight back had seen.** A deploy (or an eviction) drops the copy, and the copy held
the place's truth. The new copy takes the place over from one knight's full snapshot, and a knight's game holds only what
the world showed him: the monsters within his 24 tiles. With two knights far apart in a world-run place (the Aerie's
sentinels are up to 55 tiles apart), what the other one did out of the first one's view is undone: a sentinel he felled
stands again, one he hurt is back at full health (review round 3, `real-deploy.js`: Ben's felled i2 and hurt i3 back at
160). On the keeper path the old keeper's game holds everything, so there it depends only on who reconnects first. Nothing
in this stage merges two snapshots. So: **no deploy while two knights are in a world-run place** (the parent page's
"Monsters run by the world" rows count the knights in each place); with every place switched off nothing changes. The
spec's rule for the later stages ("Deploy only when nobody is online") covers this from Stage 2 on.

**Handing a map back (world to keeper)**, by the parent page or the watchdog: the copy is dropped, the virtual knight leaves,
the Room elects a real knight on the map, and his game's own `handoff()` turns its puppets into real monsters with the same
nids, hp and positions. Nothing vanishes or doubles: the puppets are the copy's monsters as they last stood. The watchdog's
reasons (Stage 0's `boot`, `throws`, `slow`, `cap`, and `stale`; `heap` only where there is a heap probe) each hold the map
and write a `sim_log` row. The
parent page's flip is `'parent page'`; turning `master` off is `'master'` for every world-run map.

**Bosses' rests outlive the copy.** A new table (created only if missing):

```
realm_state (key TEXT PRIMARY KEY, json TEXT NOT NULL, at INTEGER NOT NULL)
```

Every 5 s each copy's boss rests (75-coop's `restAt`) are written as `rest:<map>` = `{ <boss id>: <ms when the rest is over> }`,
only when they changed. A copy built again (after a fallback, a drop or a nap) reads its map's row back into `restAt`, so a
boss resting there keeps resting. The three Stage 2 maps have no named boss; the row is for the stages that do.

**`welcome`** (from a world that has its game copy) gains `sim: { maps: { deepholm, aerie: 'keeper' | 'world' }, hz: 10, caps: ['snap'] }`: the mode
of each map the world can run, its tick rate, and the capabilities it serves (`snap`; Stage 3 adds `tick` and `die`).

**The parent page.** `GET /api/admin/sim` adds:

```
sim:   { move, master, maps: {deepholm, aerie}, held: {map: {reason, at}} }
world: { modes: {deepholm, aerie, coalmine: 'keeper' | 'joining' | 'world'}, knights: {deepholm, aerie, coalmine: n},
         empty: ['coalmine'], running, ticks, tick: {n, p50, p99, max}, boot: {map: ms}, heap, heapProbe,
         copies: [{map, bootMs, knights, monsters, ticks, errors, parked}], cap, skipped, loaded: true | false | null,
         log: [{at, map, from, to, reason, tickP99}, ... newest first, 30] }
```

`knights` is the Room's own count of knights on each place, whoever runs it (the copy's list exists only while the world
runs it). The **Shared world** section gains "Monsters run by the world": one line for the master switch with its button,
one row per map (its mode, how many knights are there, its copy's monsters and boot time) with a button that flips it ("Let
the world run it" / "Give it back to a knight's game"), the coal mine's row greyed ("a knight's game (no monsters live
there)", "Nothing to share there.", no button), the tick line, and the newest changes from `sim_log`. The tick line is read
from the places themselves: "Starting a place now." only while a place is being taken over; "Running now: 2 places, 10 ticks
a second, half under 1.0 ms, 99 in 100 under 9.3 ms." while a copy ticks; "Not running now (nobody is playing in a place it
runs)." otherwise; and a parked place adds "Deepholm (the dwarves) is resting: nobody there is playing, so it waits, still,
until someone moves." (its row says "the world (resting: nobody there is playing)"). Every button asks first. It reads
nothing new: the same one `GET /api/admin/sim`.

**A slow world says so.** A game that said hello and has had no `welcome` for 1.5 s says "Waking the world..." once (a
notice), **only when its last `welcome` said the world runs a place itself** (`welcome.sim.maps` has a `'world'`, kept in
`localStorage` `fanglands.worldRuns`; a welcome with no `sim` leaves it as it was). A change of the switches while a page is
connected (the parent page, the watchdog's hold, a World that could not load its copy) reaches every connected page at once
as `{ t: 'sim', maps, hz, caps }` (the same `sim` as `welcome`'s; `Worlds.tellSim`), which sets the same word: before
4 Oct a page connected while a place was on stayed sure of it until its next welcome, and said "Waking the world..." on its
next slow one even with every place switched off. With every place on a knight's game, a slow line or a reconnect says
nothing, as before Stage 2. In Stage 2 a slow `welcome` is the World busy building a copy
(the build stops the whole World, above) or the World itself waking; Stage 6's overworld copy is built on the first `hello`
after a nap, and this is what the knight reads meanwhile.

**What changes in a game with every switch off.** The spec says Stage 2 needs no client change; it has three, all inert
until a place is switched on: `hello` names `caps: ['snap']` (master sends `[]`), the game listens for `snap` (answered only
by a keeper the world is taking a map from, which never happens with every place on a knight's game), and the
"Waking the world..." notice (said only after a welcome that named a world-run place). The `sim` message is read in the
wire itself (70-net, no listener) and is only ever sent when a switch changes. The Great Spread fingerprint
(`node tools/fingerprint.mjs index.html --diff docs/spread/baseline-fingerprint.json`) therefore differs from master's in
one table, `exports`, and there only in `NET.caps` (`[]` to `['snap']`) and `NET.listeners.snap` (none to 1); every world,
map, place and spawn table is the same, and `COOP.state` is as master's (the debug box's counters, the world's remembered
rows and the wake wait are kept out of the exported state). The merge into master regenerates the baseline
(`--out docs/spread/baseline-fingerprint.json --from "master <merge sha>"`, as docs/spread/README.md asks after a peer
merge), and spread/s2 hears of it before it next merges master.

**`?debug=tick`.** A page opened with `?debug=tick` shows a small box: the keeper of its map (and whether it is the world),
the `mon` messages a second, the last `k`, the rows in the last `mon` and its puppets. It is for the two-browser proofs; nobody
else sees it. It never covers the hearts and hit points or any other piece of the HUD that stays (the minimap, the quest
scroll, the belt, the stick, the seats, the seals) or the knight: it takes the bottom-left corner when that is free (a
computer), else the first free spot down the left edge (an iPad, a phone held upright: under the quest scroll), else down the
middle (a phone on its side: above the belt). A phone under 420 px wide gets it in 10 px type. A self-test holds this at
ten screen sizes, touch and mouse (`coop: the ?debug=tick box never covers the hearts ...`).

**The self-tests through the stripped copy** (decided 2026-10-03: before any copy runs monsters for players).
`tools/sim-suite.mjs` check 1b runs the whole `HOOKS.selfTest` suite through the stripped build with the self-tests kept and
the pieces the checks press given back (`tools/build-sim.mjs --test-ui`): the drawing that lays a panel's buttons out
(08-draw, 09-render, 10-hud, 59-hudkit), the title (14-title) and the playthrough bot (42-playthrough), with every drawing
registration kept so a panel has its buttons. Every other stripped file (the sounds, the music, the book, the icons, the
monster art and look, the lighting) stays the server's stand-in. The run must pass with the same count as the full build,
less exactly the stripped files' own checks, the checks of a listed chapter that cannot run without the drawing, and the
listed UI-only checks (on 3 Oct: 1,262 less 61, 3 and 14 is 1,184 of 1,199, nothing stray); the kept six are covered by check 0 (every rule that reads one of their names is
listed with its reason) and the parity checks (3a, 3b, 4b). Check 6 holds the look fields: every `LOOK_FIELDS` type, set up
in a copy in the state its field shows, reaches a puppet in a real game with that field.

**Tests and sims.** `online/test/sim-host.test.mjs` (a stub game, the real Room): the virtual knight is always keeper and
never stale; a flip sends `keeper` both ways; a throw, three slow ticks, a boot failure and the cap each fall back with a
`sim_log` row; catch-up stops at 3; the loop stops 60 s after the last knight; a copy is dropped 60 s after its map empties;
`realm_state` survives a rebuilt SimHost; a busy machine (every timer 20 or 40 ms late) never trips `slow` while a slow copy
on a mildly busy one still does; a silent knight with his socket open parks the copy (0 timers, 0 ticks for 10 minutes)
and his next presence ticks the same copy on; a hand-back stops the loop at once; a `snap` page's full answer hands the
map over at once while an older page is never asked; a place left resting is not built again on a wake nobody plays
through, and is never handed back as stale when its knight returns, whoever woke the object; a copy told no knight is
resting, not stale; two knights resting in a world-run place, the Room rebuilt in either order, arm no alarm for 60 s, and
the one who plays again keeps it first and is the one asked for `snap`; a change of the switches tells every page (`sim`).
`online/test/room.test.mjs`: two silent knights restored in either order never ask for an alarm at a moment already
handled. `online/test/interest.test.mjs`: the 24 / 27 tiles, a target always sent.
`node tools/mmo-sim.js --sim` runs the whole two-game scenario against the real Room with the world's copy wired in and
every map on `keeper` (nothing changes), then deepholm on `world`. `node tools/mmo-sim-world.js`: both games see the same
rows at the same tick; the kill goes to the top damager; an injected throw falls back to a knight's game keeping every nid,
hp and position; a keeper-to-world flip mid-fight; a game with no caps plays as before; an admin `spawn` reaches the copy;
a knight alone on an older page switched over mid-fight (7); a world rebuilt with no copy loaded (8); a knight whose game
stops is not beaten (9); every game stopped, both copies park and nothing ticks for 10 minutes (10); the lone keeper's full
snapshot on a solo entry and a mid-fight switch (11); a kid alone whose iPad lock drops the socket for 90 s keeps the hurt
sentinel hurt and the felled one down, on his screen and in the new copy, and his plaque counts the whole place (12); two
knights locked in the Aerie, the world napped and woken by the parent page or the kid's own unlock, the Room rebuilt in
either order: the felled sentinel stays down and the hurt one hurt (13); a felled sentinel stays down while a knight stands
on its home, and stands up when he walks off (14); the coal mine's copy has no monster and the two others have some (0b).
`node tools/sim-freeze.mjs`: how long the World stands still for a cold build (local `wrangler dev`).
`node tools/sim-load.mjs`: 20 bot knights against a local `wrangler dev` for 30 minutes. Check 4 of `mmo-sim-world.js` also
watches the old keeper's own screen through the take-over; with the hold-up above switched off it fails (5 blank frames).

**What it costs, measured** (3 Oct 2026, after the review's fixes; MacBook Pro, node 26, wrangler 4.92 local).
`node tools/sim-load.mjs --minutes 30` and `--bots 1 --minutes 10`, in `~/.fanglands/work/phase1/sw-2/fix1/`
(`sim-load.{txt,json}`, `sim-load-1.{txt,json}`). Both sides of the requests bar now count every billed request: socket
messages at 20 to 1 and the World's own metered game calls (above all its alarms; the parent page's reads are not the
game's), against the same knights on the keeper path with its keeper stream and its stale alarm.

| | 20 knights (8 Deepholm, 8 Aerie, 4 coal mine), 30 min, 10.0 knight-hours | 1 knight alone in Deepholm, 10 min |
|---|---|---|
| Copy boot | Deepholm 843 ms, the Aerie 976 ms, the coal mine 685 ms | Deepholm 1,320 ms |
| Tick | p50 1 ms, p99 4 ms over the last 3,000; worst 30 s window p99 6 ms; max 38 ms; 12 skipped (the boots) | p50 1 ms, p99 2 ms; worst window 4 ms; max 19 ms |
| Fallbacks | none; every keeper `@world:<map>` throughout; 0 copy errors in 17,978 ticks each | none |
| `mon` to each knight | 9.98 a second; gap p50 100 ms, p99 103 ms, max 185 ms | 9.94 a second; gap p50 100, p99 102, max 121 ms |
| Heap (read last) | 20.1 MB used | 15.6 MB used |
| The World's own game calls | 27 in 30 minutes (the review's run: 684, an alarm every 3 s) | 4 in 10 minutes |
| Requests a knight-hour | 897.2 world-run, against 1,169.5 on the keeper path | 828.3 world-run, against 984.3 on the keeper path |

Pass bar: tick p99 under 10 ms, no fallback, heap under 64 MB, requests not above the keeper path, for each knight count:
all met for both. An earlier 30-minute run (`sw-2/sim-load-run2-aerie-slow.*`, before the review) handed the Aerie back once
at 24.4 minutes, reason `slow`, while the whole machine stood still about 2 s; the tool now writes its own stalls
(`driverStalls`) beside each fallback (none in either run above).

**The proof** (`~/.fanglands/work/phase1/sw-2/proof/`, 3 Oct 2026 after the review; `node stage2-proof.js`). Real headless
Chromium pages, a laptop (1280 x 800) and an iPad (1024 x 1366, touch), both opened with `?debug=tick`, on a local
`wrangler dev` world running this branch with freshly made test knights (an agent may not sign knights in on the test world),
the parent page in a third. 1: both screens said `keeper @world:deepholm (the world)`, 10 `mon` a second, the same two
guards at the same places with the same hp. 2: they fought one guard on the keys (Space); it died and the kill went to the
laptop (91 of its damage), and only to him. 3: mid-fight the parent page gave Deepholm to a knight's game and back: 226
samples over both screens, nothing vanished, nothing twice; read again, the parent page's Deepholm row showed 2 knights,
2 monsters and its build time ("1867 ms") in their own columns (`admin-world-running.png`). 4: the iPad's tab closed
mid-fight; the laptop played on (46 samples, nothing vanished) and the iPad came back to the same monsters. 5: the iPad
locked 30 s while the laptop fought on. **The lock is a real JavaScript pause** (CDP `Debugger.pause`, the socket left
open; a 100 ms timer on the page moved 0 times in the 30 s): 273 laptop samples, nothing vanished, no keeper message to
either, and the iPad woke to the same standing monsters as the laptop. The first runs "locked" with
`Page.setWebLifecycleState 'frozen'`, which does not stop this headless Chromium (its frames and timers ran on), so they
locked nothing; that claim is withdrawn. 6: a third knight alone in Deepholm, with nothing keeping him standing, struck a
guard (it chased him and hit him twice) and was locked 30 s the same way: 3 blows (19 damage) reached him, all from the
world's first 3 s, and he woke alive in Deepholm with no new fall. The same run with the 3 s rule switched off
(`fix1/proof-negative-no-silence-rule.txt`): 26 blows, 153 damage, he woke dead. 7: the same knight alone in the Aerie, a
knight's game keeping it, mid-fight the parent page let the world run it: none of the 2 sentinels near him vanished or
doubled in 95 samples over 6 s, and the world kept it. No page errors. Checks 2 to 5 run with a harness that keeps the
laptop and iPad from falling (`safe()`); check 6 does not. Screenshots: `deepholm-{laptop,ipad}.png`, `fight-*.png`,
`admin-world-{before,keeper,running,after}.png`, `unlocked-ipad.png`, `locked-laptop.png`, `alone-unlocked.png`.

**The proof, review round 2** (4 Oct 2026, the same harness on this branch merged with master 1b35299, a fresh local
`wrangler dev`; `~/.fanglands/work/phase1/sw-2/fix2/proof-run.txt`): ALL PASS, checks 1 to 7 again plus three new ones. 3b: the
parent page's coal mine row is greyed, "a knight's game (no monsters live there)", "Nothing to share there.", no button. 6:
the lone knight locked 30 s took 3 blows (19 damage, all from the first 3 s), woke alive, his own game kept Deepholm for 348 ms (alone,
the copy had parked and the object napped, so his wake was a wake) and the world took it over again. 7: the Aerie switched on
mid-fight asked his page for its full snapshot once and took it: the sentinel he had hurt (158 of 160 hp) never healed back
in 97 samples. 8 (new): alone in the world-run Aerie with his page paused 22 s and its socket open, the parent page read the
Aerie parked and nothing running 6 s and 9 s in (the copy's ticks 607 and 607, the World's 626 and 626); then, with nothing
reaching it and no timer armed, **the object hibernated** (its own tick count started again at the wake); on his wake the
world took the Aerie over again and none of the monsters within 18 tiles of him vanished or showed twice (an earlier run of
this check, which watched every monster in his list, saw two others leave it for a moment; their distance was not recorded,
so the check now watches the 18 tiles around him, more than an iPad shows); 8b: meanwhile the parent page said "The Aerie (above the clouds) is
resting: nobody there is playing ...", its row "the world (resting: nobody there is playing)", Knights there 1
(`admin-world-resting.png`). 9 (new): he walked alone into the world-run Deepholm and, before the world had its copy, hurt
the first guard to 60 of 90 hp and moved it; the world asked his page for its full snapshot, his page sent it (the guard at
60 hp) and in 7 s on his screen (119 samples) the guard never jumped home, never healed back and never vanished
(`alone-entry-snap.png`). The first runs of this round failed check 6 and then 8 because they still expected the same copy
after the pause; the object had in fact hibernated, which the checks now read and say.

**The proof, review round 2b** (4 Oct 2026, a fresh local `wrangler dev` of this branch; `~/.fanglands/work/phase1/sw-2/fix2b/`):
`stage2-proof.js` checks 1 to 9 ALL PASS again (`proof-run.txt`; the harness reads the debug numbers through
`COOP.tickStats()` now that they are out of `COOP.state`). The reviewer's iPad lock with the socket dropped (`real-lock.js`,
an iPad-sized page alone in the world-run Aerie, one sentinel hurt to 130 of 160 hp and one felled, then a real JavaScript
pause with the socket closed): locked 90 s, the parent page showed no copy and 0 knights there (the copy went); at the unlock
his screen kept the hurt one at 130 and the felled one down, his game kept the Aerie for under a second, and the world took it
back from his snapshot with the sentinel still at 130 (`real-world-90.txt`). Locked 20 s, the copy was still there and the
world carried on with it, the sentinel at 131 (`real-world-20.txt`). With the place off, his own game kept both, as before
(`real-keeper-90.txt`). His plaque said "3 left" (the 3 standing sentinels), not the 1 near him, throughout. The reviewer's
real-game wake scenario (`t7-out.txt`): woken by another while his game was stopped, the world built nothing; on his return
the world took Deepholm over, nothing held, `sim_log` empty.

**Old code on the new store** (`~/.fanglands/work/phase1/sw-2/migrate-proof.{sh,txt}`, local `wrangler dev --persist-to` on
one directory): this branch made `sim_log` and `realm_state` and wrote two `sim_log` rows and the new `sim` keys; master's
`online/` then ran on it (status, `GET /api/admin/sim`, a `move` switch and the export all answered), and this branch again
read back every key (master's `move: 'off'` kept beside `master`, `maps` and `held`) and both rows.

**On the test world** (https://test.gorkscape.ca, 3 Oct 2026 after the review, deployed with
`~/.fanglands/tools/deploy-test.sh` after the backup `~/.fanglands/backups/20261003-211724-pre-shared-2-test`, every gate
green): the World loaded its game copy (`GET /api/admin/sim`: `world.loaded` true, cap 4), every place on `keeper`, master
`on`, nothing held, `sim_log` empty, nobody online. The Worker is 2,907.64 KiB (753.64 KiB gzipped; the game copy is most of
it). Nobody switched a place on there: an agent may not sign the probe knights in on a world that is not on this machine,
so the two-browser run on the test world is the owner's.

**On the test world, review round 2** (4 Oct 2026, deployed with `~/.fanglands/tools/deploy-test.sh` after the backup
`~/.fanglands/backups/20261004-011103-pre-shared-2-fix2-test` (3 accounts, 9 saves, a bookmark); the script ran every gate
first, the admin and party sims included, all green; `fix2/deploy-test.log`). Other builders had deployed over it since the
round before (its export had no `sim_log` table). `GET /api/admin/sim` afterwards: `world.loaded` true, cap 4, `heapProbe`
false, every place on `keeper` (`deepholm`, `aerie`; `coalmine` listed in `empty`), master `on`, nothing held, nothing
running, `sim_log` empty, nobody online. The Worker is 3,047.79 KiB (789.31 KiB gzipped), startup 5 ms.

**On the test world, review round 3** (4 Oct 2026, code `f84bdb9`, deployed with `~/.fanglands/tools/deploy-test.sh` after the
backup `~/.fanglands/backups/20261004-050040-pre-shared-2-r3-test` (3 accounts, 9 saves, a bookmark), nobody online; the script
ran every gate first, all green; `fix3/deploy-test.log`; version `bd03988e`). `GET /api/admin/sim` afterwards: `world.loaded`
true, cap 4, every place on `keeper`, master `on`, nothing held, nothing running, `sim_log` empty, nobody online. The Worker is
3,056.60 KiB (791.59 KiB gzipped), startup 5 ms. On a local `wrangler dev` of the same tree the two-browser proof passed again
(`fix3/proof/proof-run.txt`, all 9 steps), and the review's real-page wake (two knights' pages paused 60 s with the sockets
open, the object napped and rebuilt, the kid unlocked) left the felled sentinel down and the hurt one hurt with the kid in
first or second (`fix3/proof-wake/real-wake-world-{ann,ben}.txt`; on `a7a6a78` the first stood again at 160).

## Safety rules (binding)

- Invite-only signups. Names and chat pass `online/src/filter.js`. Chat is logged with the name and time.
- A chat line with a swear word or a slur in it is a word strike: a warning, a last warning, then 24 hours out (see
  *Word strikes*); an insult or anything else only starred out is never one. Strikes
  fade after 30 clean days; only an admin or the parent page clears them, and every strike, clear and rename is in
  `mod_log`.
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

- Play: https://fanglands.com (the invite code is with Ethan; nothing on this page is public). https://gorkscape.ca
  hands over to it (*Two addresses*).
- Parents: https://fanglands.com/admin — accounts, reset a forgotten secret word, ban, the invite code, the chat log, save rollback,
  who is an admin (Make admin / Make player), mutes, the moderation log, pinned backups, every trade. Needs the admin key.
- Parents: https://fanglands.com/admin — accounts (last login, time online, knight play time, the last 10 logins), reset a forgotten secret word, ban, the invite code, the chat log, save rollback,
  who is an admin (Make admin / Make player), mutes, the moderation log, pinned backups. Needs the admin key.
- The old address https://ethanbender.github.io/fanglands/ is the offline copy; its title screen has no login.

## Testing

- `HOOKS.selfTest` checks in every online file, using `NET.useFake(...)` for the wire.
- `tools/mmo-sim.js`: two headless game contexts + the real `Room` class from `online/src/room.js` (`--room`) or the
  FakeWorld (the contract written out again), wired with in-memory sockets. Proves login, presence relay, keeper
  election, hit routing, the kill going to the right knight, chat, and handoff when the keeper leaves; then the admins
  and drop parties (*Admins and drop parties*, *Testing*). Run both ways in `deploy.sh` before every deploy.
- `node --test online/test/` for the server's own logic (password hashing, filter, room routing, rate caps, roles,
  moderation, the store and its migration, drop parties and the party-hat odds, trading, word strikes and renames in
  `strikes.test.mjs`, the two addresses and the hand-over).
- `tools/mmo-sim-admin.js` and `tools/mmo-sim-party.js`: the admin and party scenarios, two games against the real
  Room (see *Admins and drop parties*, *Testing*). `deploy.sh` runs them with the others.
