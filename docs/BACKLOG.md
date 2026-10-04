# Fanglands — the standing backlog

Every request the owner has made, and where it stands. Nothing is closed until it is merged, tested and
live on https://ethanbender.github.io/fanglands/. Update this file when anything moves.

Status key: **LIVE** merged and on the public URL · **BUILDING** an agent has it now · **QUEUED** waiting on
something specific (named) · **OPEN** not started.

---

## Standing design rules (apply to everything below)

1. **Quests are stories, not fetch errands.** The owner, verbatim: *"please do not make all quests just
   fetching quests, that's so boring. They should be kind of stories, they should be unique, they should have
   unique quest items."* Every new quest needs a reason, a turn, and something that is only in it.
2. **Nothing is built in the shared world.** Player building goes in the private house instance, because this
   becomes multiplayer one day.
3. **The son plays on an iPad.** Every key needs an on-screen control; every solid thing worth using must be
   reachable by tap.
4. **Plain words a ten-year-old reads.** Dark UI, no emojis, exact numbers.
5. **Never merge on an agent's own say-so.** Every branch gets an adversarial reviewer who re-runs the suite
   and re-measures the claimed numbers.

---

## LIVE

| What | Notes |
|---|---|
| Instances for dungeons and bosses | `16-instances.js` |
| Tap-to-move, all hotkeys reachable on iOS | `17-tap.js` |
| Settings panel | sound, music, kid mode, tap-to-walk, stick side, text size, talk speed, damage numbers, screen shake, monster levels, minimap, reset |
| In-game Wiki (K) | monsters with exact drop %, items with every source, recipes, skills, places, quests, portraits |
| Playthrough / connectivity / progression audit | `42-playthrough.js`, `--play` plays the whole story |
| Progression fixes | farming 7,491 h → 476, defence 1,328 → 603, smithing 876 → 97, fishing 161 → 41, cooking 145 → 14 |
| Agility river crossings | 12 / 22 / 35 |
| Dragon-scale grind | 60 ash drakes → ~11 |
| Wrecks never pin you | walk-over, E repairs the one underfoot |
| Death's fee ramps with combat level | and kid mode is genuinely free |
| Coins from skilling | Fennick full price + rotating standing order |
| Blueprint salvage | strip wrecks for parts, Nix sells any plan for a fixed price |
| The coal road | cart out of Deepholm, timed seam mini-game, organic gallery, real torchlight, pillars that read as pillars |
| Graves and zombies | cross where a goblin fell, zombie rises from it after dark, skull mace at 1/150 |
| Sera rides the machine | hangs off the flank, Fury Road style |
| Machine specials on held Space | Full Steam, Quake Stomp, Barrel Roll; corner button touch-only |
| Camp palisade vault | Agility 15, town side |
| No grass in the Ashfields | burnt ground: ash, scorch, bare dirt |
| Thistledown stone wall | own tile, both gates kept |
| Goblin camp pushed off the town wall | 6 tiles of field, was 1 |
| **Deepholm is its own map** | the shaft is the door; 575 overworld tiles reclaimed |
| Quest helper opens | full instruction, marker in words, other quests tappable |
| Machine charge feedback | roof beacon sweeps, spins up, flashes when armed, burns out and smokes on cooldown; exhaust flames grow with the hold; touch control is a real hold |
| **Quest items are reclaimable** | a soft lock: Wren said he was handing the flute back and gave nothing. General register now — a quest item declares its giver, and asking hands it back; a banked one is named, not duplicated |
| **Deepholm is lit like a city** | MERGED into integ/wave14, awaiting deploy — one light registry any feature adds to — tile, radius, colour, flicker — replacing the two tile kinds `drawDark()` knew. Twelve lamps, two hot forges, the ladder shaft and twelve mithril seams all light, in their own colours; halls get room light so the throne hall reads as a room; the mithril galleries stay dark. Three stacked scrims became one: the core's starting-cave darkness had been falling across every instance map (0.874 combined in Deepholm's north half) with two phantom lights in it. |
| Dozer outruns walking | it drove at 130 against a walk of 175. 205 now, 250 with the boiler |
| **gorkscape.ca serves Fanglands** | one Cloudflare Worker (`online/`), nothing on our machines; both `gorkscape.ca` and `www` |
| **Item art** | MERGED into integ/wave14, awaiting deploy — 194 of 194 items draw their own icon (`ICONS.audit()`: 0 shared, 0 missing), coloured halo on rares and uniques; the gate in `80-icons.js` is a flat zero again. `81-icons-art.js` |
| **Tiered undead** | MERGED into integ/wave14, awaiting deploy — wood cross → skeleton, grave → risen zombie, headstone → 2×2 zombie brute (320 hp, stone slam); every grave gets its own minute between midnight and dawn and none stand at dawn; bones drop and build the torch, fence, skull pile, arch and throne; brute drops the necromancer's kit at 1 in 20. `54-graves.js` |
| **The Redcut (the bottom-right dead space)** | MERGED into integ/wave14, awaiting deploy — `90-canyon.js`. Owner: *"maybe we can add a whole new section to the map in the bottom right where it is dead space, and have a plateau canyon?"* A table of red rock, x 206–256 y 104–176, with a canyon ring cut inside it and a dead-end spur south. Four heights drawn dark to light — canyon floor, ledge, cliff face, table top — with a lit rim on every cliff and a cast shadow under it. In at the mouth (215,103), round the floor, out of the slot (246,101) onto the Castle Gnash road. Three climbs: the Rise, the Stair onto the mesa, the switchback into the box head; the Fall is a slab that came down and filled the spur. Rimhawks 34, dustjaws 42. Redsalt (Mining 22, mined nowhere else) → salt beef. **The Cut Rope**: Marlow's partner went down on a rope somebody cut; the rope proves he cut it himself. Gates: Harl's ferry (combat 10, 40 coins) to get there at all, and Agility 30 through the crack to the Deep Cache and Hux's pick (tier 3). `src/90-canyon.js`, branch `feat/canyon`. |
| **Bank auto-sort tabs** | MERGED into integ/wave14, awaiting deploy — Sort on/off toggle saved on the player; the vault splits into Quest / Gear / Tools / Food / Crafting / Loot tabs worked out from what each item declares and the live recipe tables (no id list); money first, then dearest first. `60-bank.js` |
| **Aerie, part two** | MERGED into integ/wave14, awaiting deploy — `88-aerie.js`. Lighting is a per-instance mode now (the core's starting-cave scrim was landing on every instance as a dark rectangle — Deepholm and Aerie's great hall both). Aerie grows 50x34 to 78x50 over three levels: the Span, the Crown, the Underside below the drop. The Spire Run (Agility 40), the Rookery, the Windward Market, the Catch, the Songstone. Stormglass, skyhawk feathers, Skysinger, Skyhawk arrows, the Gale cloak. Godly Plated stays exclusive to the sky forge and the anvil now says so. |
| **Region outlines and the land in steps** | MERGED into integ/wave14, awaiting deploy — thirteen regions get real outlines (one shared curve per border), the Wolfwood scarp and the Ashfields' rim cut the land into steps with the two bridges and one Agility-18 stair as the ways down, the Jungle's north edge is a wall of giants. `92-worldshape.js`. Integrated with the Redcut: its tiles are pinned to their region and the Jungle takes a bay on its east instead of growing over red rock. |
| **HUD redesign, second pass (owner)** | Owner, 2026-09-24, verbatim: *"i would say over all the HUD needs work because is crowded and not organized or cohesive looks like a bunch of AI coded buttons"* and *"it should feel good from iPhone to iPad to computer"*. The wave-14 HUD kit fixed the grid but not the look: words in rounded boxes, labelled grey discs, floating key pills, a hint line. Three designs rendered as mockups over the real game at iPhone SE / 390 / 430 (both orientations, notch and home bar kept clear), iPad both ways and a laptop; two judges; one build spec; then built across every HUD file with a layout audit over the whole device matrix. The wave-14 release to gorkscape.ca waits for it. |
| **The Cloud Kingdom (Cohen)** | Cohen, 2026-09-24, verbatim: *"I want the cloud kingdome to be a actual kingdome with walls and a keep and spires and gates and fountains and buildings and roads and bridges and parks and decorations."* Aerie (36-skycity + 88-aerie) is today mostly open white cloud with a plank path. Rebuild it as a walled kingdom with every item on his list visible, keeping everything Aerie already has (sky forge, Songstone, Spire Run, market, rookery, Underside, the storm). Branch `feat/cloudkingdom`. |
| **The golem mini-game (Cohen)** | BUILT on `feat/royalmine2`, not merged — Cohen, 2026-09-24, verbatim: *"please finish the golom mini game."* "The Knocking Under the Throne" (`91-royalmine.js`, plus a 2-line hook in `24-dwarves.js`). The story: King Thrain hears knocking under his throne; Hilde tells why the mine was sealed; you warm her heartstone at a forge, knock the all-clear back, and the throne slides aside onto a stair that stays open. The Royal Mine below (48x42, lit and gilded): the Royal Seams, giant mithril (2x2, Mining 20) and stormstone (3x3, Mining 30) rocks that crack in three stages and give ore or wake a mithril or stormstone golem, and the Heart Chamber. There the Ginormous Golem (swords bounce off) is beaten by mining the glowing red veins, heating the stone at a forge and throwing it (T, SWING, a tap on him, or THROW on the iPad), smashing the little golems that walk in to heal him, and stepping out of falling-rock shadows. Pebble, the little golem who has knocked under the throne and held the golem's door shut for fifty years, opens it for you, and after the first fall he moves up beside Hilde. Rewards: Mining, Smithing and Melee XP, the Heartstone pickaxe (1 in 16 per fall, certain by the 25th) and the Stoneheart helm (1 in 48). Online it is keeper-gated (docs/ONLINE.md, Bosses); `tools/golem-sim.js` proves it with two games. Supersedes the two OPEN rows below. |
| **The golem mini-game (Cohen)** | Cohen, 2026-09-24, verbatim: *"please finish the golom mini game."* It was never built: `feat/royalmine` holds only the planning note. Building it whole: King Thrain's royal-mine story (not a fetch), the throne that slides aside, the royal mine with giant ores that may wake medium or large golems, and the ginormous golem as a skilling-boss mini-game (mine heartstone, charge it, hurl it; smash the little golems before they heal it). Branch `feat/royalmine2`. Supersedes the two OPEN rows below. |
| **HUD redesign** | MERGED into integ/wave14, awaiting deploy — one grid, one container, one colour language, hierarchy, controls that look pressable. `59-hudkit.js` plus 22 feature files moved onto it. Merge note: the old STEAM button feat/hud migrated onto the kit had already been replaced on master by the corner HOLD target, so that one control stays as master drew it. |
| **Paper Mario tile flutter on heavy hits** | MERGED into integ/wave14, awaiting deploy — the ground lifts in a ring under a bomb, a dozer ram, a Gnasher's arm or fall, a barrel beast's fall; 18 px at the centre fading to 0 at the rim, every tile back to exactly 0. `64-impact.js`. Merge fix: a wave made right after a door was wiped on its first tick (the branch's own failing check); each wave now carries its map. |
| **Online: accounts and cloud saves** | invite-only knights, secret word, one knight per account saved in the cloud (3 versions), "Playing as …" on return, Log out in the pause menu, the bridge that brings a knight over from the old address. `71-login`, `72-cloudsave`, `bridge.html` |
| **Online: friends on the map** | name tags, level, hp bar, ONLINE chip and Friends panel (where everyone is, Follow on map, Give), blue dots on the minimap and the map. `73-players` |
| **Online: chat** | Enter/Y or the CHAT button, quick phrases for the iPad, bubbles over heads, a fading strip and a log; every line word-filtered and kept for parents. `74-chat` |
| **Online: shared monsters** | the knight longest on a map keeps its monsters and streams them; everyone on that map fights the same ones; kill credit to the last hit; monsters chase the nearest knight; keeper hands over on leaving or after 4 s of silence. `75-coop`, `tools/mmo-sim.js` (two whole games in one process, 12 checks, run before every deploy) |
| **Online: the world server** | Cloudflare Durable Object: accounts (PBKDF2), sessions, saves, chat log, word filter, rate caps, the room; admin page at `/admin`. 40 unit checks + 8 against a local run. `online/` |

---

## SHIPPED 2026-09-25 (live on gorkscape.ca and the test world, master a04403b)

The owner asked to ship what was built rather than wait for polish, and keep the rest for next week. Live now: the
wave-14 build, Death's chest adding up, admin for MudGoll (moderation, powers, mob spawning, drop parties, party hats),
Cohen's Cloud Kingdom, the golem mini-game (King Thrain's royal mine, giant ores, Gorm the Ginormous), the obvious axe
in the stump, the Redcut blended into the land, the Ashfields edge, auto-retaliate (on by default, toggle in the pack),
instance maps that show only the instance, and banners that queue. 903 checks, the full-story bot, both two-player sims
(28 scenarios each) and 86 server tests passed before each deploy.

## NEXT WEEK — improvements held back so the work could ship
- No Play alone leftovers (2026-10-03; feat/no-play-alone-min):
  - On a small phone (375x667) the first tap on Start fresh shows the question, but "Yes, start fresh" and "Go back" sit below the fold of the card's scroll box with nothing showing it scrolls. iPad and 390x844 are fine.
  - "Yes, start fresh" looks greyed and ignores taps until 0.8 s pass with no press; a kid tapping it faster never gets through, and no words say to wait. Taps that land off the offer box (its heading, the canvas) do not restart the wait.
  - The device-knight line never says who has a knight already; on a family iPad it stays on the sign-up form for good because device knights are never removed.
  - The canvas footer says "Your knight is saved in the cloud at fanglands.com." while the card says "This device has a knight saved on it ... It is safe here." For a Play-alone kid with no account the two lines disagree.
  - Other files' self-tests still write LOGIN.alone (harmless, dead).
  - Not covered by a test: two of the no-room guards. The "no Play alone button" check on the HTML card never runs with a DOM.
  - Known and accepted: with the world asleep nobody can play; a Play-alone kid's own knight played further offline is parked as a device knight at login (as before) and offered only when the account's cloud is empty; with HANDOVER on, a sibling's kept device knights keep that browser on gorkscape.ca; the GitHub Pages copy is still single-player.
- Townsfolk look leftovers (2026-10-03; all 74 approved people, feat/townsfolk). Swept 2026-10-03 (fix/leftovers-looks):
  one talker per line, a dark outline when hurt, Harl's lantern set down at the oars, the talk brackets over the new
  heads, standing loops of each person's own length, the Last Knight's statue in the new look. Left, and why:
  - Captain Roderick, Dunstan, Warden Brann, the Master of Skills, Marlow, Hux and the two unnamed fliers (the winged porter and guard) are not in the sample: they wear the sample's own new-style default villager, not a drawing of their own. A drawing of their own is new art: it goes into the approved sample first (the owner's call), then the generator adds them.
  - In a crowd made on purpose (26 townsfolk walking about in the square at once) a frame costs about 0.2 to 0.6 ms more than master while their pictures are first made; the normal square measures the same as master. That is the price of making each picture once, and no player sees it. Standing loops are now 2 to 6 s long (up to 36 pictures a facing for a standing person, 12 before), inside the same cache (2400 pictures, 48 MB).
- Monster look leftovers (2026-10-03; all 47 monster types in the approved look, live in 0d0788a):
  - Some hit circles grew with the bigger pictures but were capped at 24 (walker, bulldozer, the yard twins, dustjaw). In one-tile gaps a capped circle can sit over the wall edge.
  - The Fang fight costs about 1 ms more per frame than before (mean 9.2/9.7 ms went to 10.2/11.5 ms). Eight bosses on one screen went from 8.5 to 10.1 ms. Common crowds are slightly faster than before.
  - The boss banners in the HUD still use the old emblems, not the new pictures.
  - The golem's mend ring is not in the online monster row, so on a friend's screen the mending glow does not show. It could ride as phase "mend" once monsters run on the server.
- Two test flakes seen 2026-10-03 (one failure each in 4 plain headless runs on e3229b3 plus the hit-circle fix; neither is something a player sees):
  - "the bot's hunt waits for a respawn at a safe base ... (the stage 13 dung)" (42-playthrough): the bot killed the drake but came back with dragon_dung 0/1 ({"dung":0,"at":[55,102],"log":["hunt ash_drake #1: walk true, brawl 69, dragon_dung 0/1, kills +1"]}).
  - "storm: (fake NET non-keeper): arriving rested asks the keeper once" (66-storm): on the first visit nothing asked for the bird (rested: []), while the later visits behaved. The suspect is the fake socket not being online yet on that first visit, so the call wakes the bird at home instead of asking.
- Two more seen 2026-10-03/04 (feat/shared-2 review rounds; neither file is touched by that branch):
  - "night: zombies rise 8-12 tiles off every 20 s outdoors after dark (1-2 at a time, max 4) ..." (35-night) failed with
    {"alive":3,"capped":false} in 2 of 9 runs of feat/shared-2 at 13c07a4 in round 1. Round 2 ran it 12 times on the branch
    (merged with master 1b35299) and 12 on master 1b35299, side by side: 0 failures in either
    (`~/.fanglands/work/phase1/sw-2/fix2/night/`). Why those two runs held 3 zombies and not 4 was not traced (the runs did
    not keep the spawn log); the counts do not point at the branch.
  - "boy or girl: a double tap never picks ..." (79-boygirl) failed once in those 24 (branch run 4, load average 8,
    `768x1024 new 0.7,0.5 +450ms ... gender girl saved true`): the check backdates the card by 450 ms of the REAL clock
    (`nowMs`, performance.now) and the card arms at 500 ms, so 50 ms of real time between that line and the second tap (a
    loaded machine) arms it and the tap picks. A test timing flake; the game's own guard is fine. Fix: backdate by less
    (or stub nowMs) in the check.
- Knight gear refit leftovers (reviewers' minor findings, 2026-10-03; the refit is live in 9c625b6). Swept 2026-10-03
  (fix/leftovers-looks): friends online on their mare, bulldozer or Barrelbeast, their swings, raised shields and still
  tools; the stone and the pot's rope in his hand; the shield raised facing away shows; nothing over the ferry's hull;
  the statue's bow and laurel; the party hat in the pack is the cone; and the checks the reviews asked for. Already
  fixed before the sweep (removed): seated on the mare, check 3's own numbers, the hero statue in gear, the bow's margin,
  the old screenshots, the merge note, the stray worktree edits. Left, and why:
  - Facing away, open helms show brown hair at the back of the head, where the approved sample shows a skin patch. Left as it is: the back of a head is hair, and the townsfolk show it the same way. The owner says if he wants the sample's skin patch back.
  - Some small drawing changes go beyond the approved sample: each greave has a metal mark (bronze rivets, an iron band, a steel ridge, a mithril curl, a sunstone dot), the bronze dagger has a wider blade, the steel blade and hilt have rivets. They are what makes every item of a slot draw differently (the self-test requires it, decision 5). The owner can say no to any of them.
  - A friend's long weapon swung while he faces away reaches into his name for the 0.22 s of the swing. The name is drawn over the weapon, so it stays readable; lifting every name clear of a swing would set all names about 12 px higher.
  - Facing down, a girl's braid hangs on her weapon side and the floating hand covers part of one ribbon loop. That is where the approved sample hangs it; on the shield side the shield would cover more. The braid shows in every helm (screenshot girl-down.png in ~/.fanglands/work/leftoverslooks/after).
  - In the royal mine's chamber, the raw or hot stone he carries between the forge and the golem is still drawn in front of him (91's drawCarry), not in a hand: his hand holds his weapon there (a SWING throws the stone). It needs an off-hand held thing; not part of this sweep.
- Thistledown capital leftovers (reviewers' minor findings, 2026-10-03): DONE 2026-10-03 on fix/leftovers-places, each with
  a check (C1, C8, C10b, C10c, C11, C12, C13b, C15, C17, C17b, C19b, C19c, C20, C23, C25): Osric waits until the THISTLEDOWN
  banner has fully gone; smaller night pools (72 px) and glowing lamp heads; the north-wall doors are porches over the step;
  old saves (new houses' floors, the High Street, a full pack and bank, the inn's bed, the pass's own move out of solid,
  '17 planks, 1 bed and 1 lodestone'); E at the fountain shows one line at a time; no key that never comes; Ambrose's hello;
  the bunting off the West Gate; the gate guard's name; the Smithy Yard paved; the castle 'south of the fountain'; Death's
  House roofed; friends seen through tall things; the city's pictures given back away from it, never a black chunk, no
  thrash past 40 chunks; a tap answers as the tapped thing; a tap on unreachable water or greenery walks to the nearest
  reachable cell; the quest log's keys per device; the midnight bell; Ambrose's marker; plain words in the book. Left, and why:
  - At night the city costs more per frame (measured on a Mac). The pools are smaller now, but nobody has measured an iPad.
    Left until an iPad can be measured.
  - On a phone, the first frame a town building comes into view still makes its picture (up to about 50 ms). The pictures
    are also given back after 10 s away from the city now (for the iPad's canvas memory), so the hitch comes back once on
    return. Spreading the making over several frames is a bigger change; measure on a phone first.
  - The hedge row at 87..102,55, between the agility track's fence and the south wall, cannot be reached (scenery); a tap on
    it says "You can't get there." Reaching it would mean moving the track's fence.
  - tree_sapling and oak_sapling both place HOUSE_SAPLING, so a refund could not tell them apart. It cannot happen in the
    city: a sapling plants only on the knight's island. (The other refund case, a full pack and bank, is fixed.)
  - Knights can almost no longer build in Thistledown (cobble refuses, lawn is not placeable). The spec chose it; it is a
    gameplay change for the owner to decide.
- Boss rematch leftovers (2026-10-02): DONE 2026-10-03 on fix/leftovers-places: the Echo's name tag and long-press name
  (m.tag; fang F2b); the War Shed's scrap heaps on its plank floor and the valve on row 7 under a boiler, clear of a phone's
  HUD (B1b); BEAST DOWN 'You helped a friend' for a friend's beast in the square (B16, B9); rests take the real time a knight
  was away off on load (src/96-rests.js); a friend's own first Fang brings the Dragon Killers on a keeper who slew it long
  ago (dk, fang); nothing in the shed talks about Hollowford before stage 9 (B17); the keeper's rests for the Gnasher and
  the War Shed and the Gnasher's boss_wait answer now have checks (G7, G8, B18). Left, and why:
  - The War Shed's door stays open from a new game, on purpose: online a friend at any stage can follow a friend in to help
    (check B11 fights there at stage 5). Before stage 9 the shed now says only a plain line and the valve is cold.
  - The review named 'two online guards (Gnasher keeper guard, one more)' without writing down which lines; the three rest
    and refusal guards above were the ones a removal left green, and each new check fails with its guard taken out.
- Flaky checks under machine load (2026-10-02, while the city build ran its own tests): "fight back: only the monster that attacked" (also on master under --play), storm "(fake NET non-keeper): arriving rested asks the keeper once" (1 in 7). The game is fine; the checks are timing-sensitive.
- Mount gates leftovers (2026-10-02): DONE 2026-10-03 on feat/mounts-look. GET DOWN in a gateway now finds open ground round about and never closes the gate (94-mountgates check 13, every row and facing of both town gates); the town gates are 95-thistledown's gatehouses (no fence-gate is drawn there), and every other gate is drawn standing open while a rider is in it (84-mountlook MA6); check 0 boards and measures each mount; check 4 fails by name on a missing monster type.
- Mounts look leftovers (2026-10-03): a wreck is the machine tipped over and darkened, not broken apart; parked machines still idle (chimney smoke, the Barrelbeast's rod sparking) as the monster drawings do; the companion still hangs at the mare's side without a seat of her own; the knight's machines are drawn at their own bodies' size (20/24 of the goblins' walker, 22/24 of the bulldozer, 26/36 of the boss Barrelbeast).
- Playthrough-only flakes ON MASTER (seen 2026-10-02): "fight back: only the monster that attacked ..." failed 2 of 3 --play runs on master (a calm, stunned goblin gets picked; pinning the clock to morning did not fix it); "admin: layout ..." fails under --play on master too. The plain suite (what deploy runs) passes.
- PICK UP TUESDAY 2026-10-06 (paused by the owner 2026-09-30 evening). His three asks, in this order:
  1. "mounts should be able to pass through the gats at the main city": SHIPPED 2026-10-02.
  2. "bosses shoould all be redefeatable": SHIPPED 2026-10-02 (see the leftovers below).
  3. "do the same process on the main city" (the Cloud Kingdom process for Thistledown): SHIPPED 2026-10-03 (branch feat/capital). Notes: the owner's Claude reviews, merges and deploys. `src/94-thistleplan.js` (the plan) and `src/95-thistledown.js` (paint, art, people, the story The Bell at Midnight, old saves, self-test C1-C25). Round 1 of review fixed (2026-10-03): the castle's north corner towers no longer cover the Tinker's Workshop, the Bell Tower turns see-through for a knight behind it, bigger gatehouses with arches and THISTLEDOWN on the lintel, a Smithy Yard, the Bell Green, the inn's garden and a kitchen garden where plain grass was, the lamp pair at 121,29-30 split up, the tap ring shows on the paving again, the plinth carries an online knight's own name, the old-save pass runs once and never deletes a machine, a wreck or the mare, Osric waits for the THISTLEDOWN banner, and the child Nell is now Tess. Notes for whoever picks it up:
     - Tile ids: the city takes 240..243 (TD_LAWN, TD_HEDGE, TD_PROP, TD_FOUNTAIN). 12 ids are left (244..255) before the map's Uint8Array is full.
     - A later "River Gate" (a gate in the south wall, a quay and a bridge over the river) was designed and left out. If it is built, it must not become a free Wolfwood crossing beside 45-progression's Agility river posts.
     - 94-mountgates check 5 ("the house just inside the west gate") now finds the smithy (93,41), whose comment still describes the old house. 95 keeps BUILDINGS in the order the world was built in after every instance visit, because 16-instances puts the buildings it hid back at the end of the list, and the first match changed after a trip to Aerie.
     - Old saves: on the first load of a save from before the rebuild, a saved change inside stone, water or a hedge of the new city is undone (what was placed is given back), and a machine, beast, wreck or the mare there is moved to open ground, never deleted; a fire on a street or a crop in the allotment stays. After that first load nothing in the city is ever undone by a load.
- Flaky checks seen once each on 2026-09-30 (passed 3 runs straight after): goblincity "killing the Gnasher completes the quest" (and the three checks after it that depend on it), and boats "Ironclad Isle costs 25 coins; first landing gets a Voice line".
- Ashfields at map scale: the rim rock and the ash are close in colour on the minimap and world map, so the new ridge reads faintly there (it is plain at ground level). The Fang's Lair still reads as a black box on the map (its walls are untouchable).

Built but NOT through its adversarial review yet (it passed the suite and was deployed; review it properly next):
| What | Where it is | What is left |
|---|---|---|
| Admin mode and drop parties | feat/admin (db92c37), in master | The abuse review (a clever kid trying to get admin powers or free party hats), the kid-on-an-iPad review, the data-safety review. The admin panel still uses the old HUD look. |
| Golem mini-game | feat/royalmine2 (ce2f90a), in master | Review round 1 findings were fixed; round 2 (Cohen's eyes, code + online, rules + balance) never ran. |
| Ashfields edge, auto-retaliate | fix/0925-ashfields, fix/0925-retaliate, in master | Stopped mid-build and shipped as saved: both passed the suite together, neither was reviewed. Check the Ashfields edge all the way round and try to break auto-retaliate (two monsters, throwers, rivers, machines, online). |
| Redcut edge, axe in the stump, instance maps + banners | fix/0925-canyon, fix/0925-axe, fix/map-labels-banners, in master | Finished by their builders, not reviewed. |

Cloud Kingdom polish: DONE on `feat/cloudkingdom-polish` (2026-10-03, not merged; the owner decides). Every item of the
list: the Great Gate's towers no longer draw over the Sky Forge or the house aer_h4 (a room reads whole, K23); the market
has four two-cell stalls with goods and a seller each, two shoppers, crates and barrels (K24); the Sky Forge has a hearth,
bellows, the cloud-anvil and a tool rack, the Cloud Oven its great oven and bread racks (K24); the market statue is a
winged person (K26); the west and east walls stand as walls (K26); the day sun is off the screen, no glare (88's daylight
check); the flagstones by the Wishing Well are a garden path from the Ring Road to the lane (K25); the keep's cone and
pennant are on a 1280x800 screen from the door to the fountain's star (a small camera nudge, HOOKS.camera, K27).
Screenshots in ~/fanglands-wt/kingdompolish-shots/final/.

The new HUD (Storybook Heraldry) — the biggest item. Owner: "the HUD needs work because is crowded and not organized or
cohesive looks like a bunch of AI coded buttons" and "it should feel good from iPhone to iPad to computer". Chosen by two
judges; mockups, the full spec and the element inventory are in ~/.fanglands/work/hud/ (SPEC.md, INVENTORY.json,
heraldry/mock.html). The foundation is on feat/hud2 (ce923b5); the six migration clusters were stopped part-way and saved
on feat/hud2-* branches. Next: finish the migration, integrate, review on the whole device matrix.

Smaller things found along the way:
- On an iPhone held upright with the move stick on the right, a knight late in the game can lose the ONLINE button and
  the chat strip (no room is left for them). The new HUD fixes this properly.
- Roads (feat/roads2) were dropped: laid for the old flat land. Rebuild them on the stepped land (roads joining
  everything, 3-6 points of interest each, 12+ outposts). Its playerMaxHit wrapper also dropped the ranged argument.
- HOOKS.pathBlock does not cover 92-worldshape's own agility obstacles.
- Night spawns (35-night) on a non-keeper and after a keeper handoff behave like the old graves did online.
- The blackiron dagger and sword look almost the same at small size; ores share one rock outline.

## BUILDING

| What | Detail |
|---|---|
| **The Cloud Kingdom (Cohen)** | **BUILDING** on `feat/cloudkingdom` (not merged; the owner decides). Cohen, 2026-09-24, verbatim: *"I want the cloud kingdome to be a actual kingdome with walls and a keep and spires and gates and fountains and buildings and roads and bridges and parks and decorations."* Aerie is rebuilt as a 100x80 walled city painted from a checked plan (`src/36-aerieplan.js`, `src/91-cloudkingdom.js`): a white stone wall with 19 towers and 5 gates (the Great Gate's portcullis lifts for any knight), Queen Seraphel's keep on a raised plaza in a moat of sky (walk in and the roof lifts), 5 spires, 2 fountains, 12 buildings, 1,582 paving stones, 8 bridges, the Queen's Garden with a hedge maze and the Mirror Pond, 26 lamps, banners, awnings and bunting; people who live there and walk the streets, and one story, *Lark's First Flight* (after the Song of Above). Everything Aerie had is kept and moved onto the plan (sky forge, Songstone, Spire Run, market, rookery, Underside, the storm). |
| **Necromancy skill** | The magic skill, its supplies, its equipment, its quest line. |
| **World reshape** | Still to build: 12+ outposts with unique activities; a real height layer so you walk under and over the rope bridges. (Outlines and the stepped land: see LIVE.) **Roads (`feat/roads2`, `93-roads.js`) were NOT merged in wave 14**: laid for the flat land, they collide with the stepped one — the Ferry Piles (102,58) are cut off by the Wolfwood scarp (walkable the moment CLIFF/STEPS are treated open), the Woodward's Shrine (69,68) is boxed in by Wolfwood's dressing, the verge ratio drops to 73% against the 80% its check wants, and it builds 0 bridges. Also: its two world-hook people (kett, old_sneak) land after 92-worldshape's repair pass and trip the "every region still holds everything its box held" check, and nine of its items have no icon (three share a fallback drawing). Rebase onto integ/wave14 and re-lay the roads on the stepped land. |
| **Seven systems** | RuneScape bank (1/10/100/All, deposit bag, deposit worn, character panel you equip from); map markers; ore tiers between steel and mithril; house-portal private island; goblin spiked palisade; sky storm boss + Tinkerton met at the city gate. (Tile flutter: see LIVE.) |
| **Banks and pack space** | Banking network, some free, some earned in high-level areas; permanent earned pack expansion that is **not** an equipment slot (must not collide with capes). |
| **Boss dungeons and boss ladder** | Move free-roaming bosses into their own dungeons; low bosses teach one mechanic, higher ones layer them; every boss a gimmick. |
| **Per-region tile sets** | Thistledown clean and bright; goblin city muddy and natural; Sylvaris like the cities in Wings of Fire; Ashfields desolate and smoky; Deepholm worked stone. |
| **Sylvaris grown into the jungle** | Bigger, districts with reasons to visit, integrated rather than bolted on, a repeatable reason to return. |
| **Bulldozer bay as a facility** | Tunnel you drive the dozer into, knight walks out, machine parked inside a real workshop with the upgrade stations around it. |

---

## QUEUED (waiting on something named)

| What | Waiting on |
|---|---|
| **Online: co-op bosses in instances** | Untested with two knights in a boss instance: boss scripts still run on every client (see `docs/ONLINE.md`, the keeper model). Needs a two-knight run through the Spider Den and one boss lair. |
| **Online: trap tiles under puppets** | A non-keeper standing a puppet on a trap consumes it locally. Move the trap check behind the freeze gate. |
| **Online: horse riders as seen by friends** | `drawHorse` is not exposed by `51-mounts`; a remote rider shows on foot. Expose it on `window.MOUNTS`. |
| **Online: a real keyboard's Enter in the chat box** | Works by the standard keydown path, but the browser automation cannot send real key events, so it was verified headless and by calling `CHAT.send`, not by a physical Enter. Check once on the laptop. |
| **Undertaker and the magic spade** | The tiered-undead rewrite. A quest to learn it from an undertaker, then a spade that digs up crosses and gravestones so zombies do not rise where you do not want them. No reward beyond a coin — the point is control. |

---

## OPEN

| What | Detail |
|---|---|
| **Alchemy as its own skill** | Move it off the tinker bench. 100 levels of potion craft with progressive unlocks: heals, temporary stat boosts, throwable explosive potions at higher levels, and skilling potions thrown at a situation (e.g. at an ore for a one-off multiplied yield). Needs the whole ladder designed, not a handful of recipes. |
| **Farming expansion** | Preset farming patches across the map (player building is moving to the house instance). More seed variety: pickpocket seeds from farmers, seeds on drop tables. Seeds grow potion ingredients as well as food. |
| **The King's royal mine** (BUILT on `feat/royalmine2` as the golem mini-game, not merged) | A story quest for the dwarf king — not a fetch. Win his favour and he moves his throne aside to reveal a secret passage into an ornate royal mining facility: normal ores, plus **giant ores** that on mining may yield ore *or* wake a golem. Medium ore → medium golem, large ore → large golem; golems drop extra smithing resources. |
| **The ginormous golem** (BUILT on `feat/royalmine2` as the golem mini-game, not merged) | A skilling boss through the back of the royal chamber: a huge golem you fight while stopping mini-golems from healing it. |
| **The Fang's Lair into an instance** | 1,023 more overworld tiles. Deliberately deferred — it is the last act of the main quest, its gate is modelled in the connectivity audit, and the bot must walk in and kill The Fang to reach the credits. Six-step plan written up by the Deepholm agent. |
| **Underground and sky as full map layers** | Deepholm proved the pattern. The owner wants one underground map where every cave sits below its overworld position, and a sky map above in proportion. |
| **The core's cave scrim still reaches two instances** | `09-render` darkens the map's top-left corner (`isCaveTile(ptx,pty) || cam.x < (CAVE_EXIT_X+2)*TILE && cam.y < 17*TILE`), which is where every instance map is written. `89-lighting` swallows it wherever a lighting scene owns the screen (Deepholm, the Spider Den, the coal road). Tinkerton's Lab and the Afterlands are left exactly as they were, on purpose — the Lab is 24×18, so nearly all of it is currently darkened by a cave 70 rows away, with a phantom light at world (21, 7.5). Decide whether the Lab is meant to be dark, then either give it a scene or fix the core condition. |
| **Night zombies out of Grubmarket and Castle Gnash** | Was in an earlier backlog; check whether the undead rewrite covers it. |
| **Melee has nothing new between 60 and The Fang at 80** | From the 2026-09-08 audit. |
| **Defence, Farming and Crafting still 3–5× the other skills' hours** | From the same audit. |
| **Fast travel / mounts beyond the horse** | Original dad feedback. |
| **A second hero companion** | Original design chat. |
