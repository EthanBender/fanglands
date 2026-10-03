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
  - Done 2026-10-03 on fix/leftovers-looks: the knight's own walker, bulldozer and Barrelbeast, a friend's online, the parked ones and their wrecks draw in the new art through MONSTER_LOOK.drawMachine (82-knightgear calls it), the knight in his gear in the main seat. What is left of the machines, and why:
    - The goblins' hands on the levers (small green dots) and the red lever knob are still drawn when the knight drives, and on an empty parked machine. They are part of the machine drawing (78-monsterart, made by make-art.py), which only the monster look's own work changes: it should leave them out, or draw them as the knight's gauntlets, when e.pilot is set.
    - The bulldozer's upgrades (drill, iron drill, ram plate, big boiler) are not drawn on the new bulldozer: the new art has no drawing of them yet. They still work. Drawing them is new art for the monster look's sample.
    - The title screen's walker (a goblin at the controls) is still the old drawing: drawMachine draws the knight's seat or an empty one, not a goblin.
  - Some hit circles grew with the bigger pictures but were capped at 24 (walker, bulldozer, the yard twins, dustjaw). In one-tile gaps a capped circle can sit over the wall edge.
  - The Fang fight costs about 1 ms more per frame than before (mean 9.2/9.7 ms went to 10.2/11.5 ms). Eight bosses on one screen went from 8.5 to 10.1 ms. Common crowds are slightly faster than before.
  - The boss banners in the HUD still use the old emblems, not the new pictures.
  - The golem's mend ring is not in the online monster row, so on a friend's screen the mending glow does not show. It could ride as phase "mend" once monsters run on the server.
- Two test flakes seen 2026-10-03 (one failure each in 4 plain headless runs on e3229b3 plus the hit-circle fix; neither is something a player sees):
  - "the bot's hunt waits for a respawn at a safe base ... (the stage 13 dung)" (42-playthrough): the bot killed the drake but came back with dragon_dung 0/1 ({"dung":0,"at":[55,102],"log":["hunt ash_drake #1: walk true, brawl 69, dragon_dung 0/1, kills +1"]}).
  - "storm: (fake NET non-keeper): arriving rested asks the keeper once" (66-storm): on the first visit nothing asked for the bird (rested: []), while the later visits behaved. The suspect is the fake socket not being online yet on that first visit, so the call wakes the bird at home instead of asking.
- Knight gear refit leftovers (reviewers' minor findings, 2026-10-03; the refit is live in 9c625b6). Swept 2026-10-03
  (fix/leftovers-looks): friends online on their mare, bulldozer or Barrelbeast, their swings, raised shields and still
  tools; the stone and the pot's rope in his hand; the shield raised facing away shows; nothing over the ferry's hull;
  the statue's bow and laurel; the party hat in the pack is the cone; and the checks the reviews asked for. The mounts
  are the new art too (the owner asked, 2026-10-03): his walker, bulldozer and Barrelbeast, a friend's, the parked ones
  and the wrecks (see the monster look block above for what is left there); a friend's name and chat bubble sit over
  the bigger drawing, and the special's red beacon sits over the rider's helm instead of on his face. Already
  fixed before the sweep (removed): seated on the mare, check 3's own numbers, the hero statue in gear, the bow's margin,
  the old screenshots, the merge note, the stray worktree edits. Left, and why:
  - Facing away, open helms show brown hair at the back of the head, where the approved sample shows a skin patch. Left as it is: the back of a head is hair, and the townsfolk show it the same way. The owner says if he wants the sample's skin patch back.
  - Some small drawing changes go beyond the approved sample: each greave has a metal mark (bronze rivets, an iron band, a steel ridge, a mithril curl, a sunstone dot), the bronze dagger has a wider blade, the steel blade and hilt have rivets. They are what makes every item of a slot draw differently (the self-test requires it, decision 5). The owner can say no to any of them.
  - A friend's long weapon swung while he faces away reaches into his name for the 0.22 s of the swing. The name is drawn over the weapon, so it stays readable; lifting every name clear of a swing would set all names about 12 px higher.
  - Facing down, a girl's braid hangs on her weapon side and the floating hand covers part of one ribbon loop. That is where the approved sample hangs it; on the shield side the shield would cover more. The braid shows in every helm (screenshot girl-down.png in ~/.fanglands/work/leftoverslooks/after).
  - In the royal mine's chamber, the raw or hot stone he carries between the forge and the golem is still drawn in front of him (91's drawCarry), not in a hand: his hand holds his weapon there (a SWING throws the stone). It needs an off-hand held thing; not part of this sweep.
- Thistledown capital leftovers (reviewers' minor findings, 2026-10-03; the city is live):
  - On the first walk in, Osric's 'Welcome to Thistledown!' tag appears in the same moment as the THISTLEDOWN region banner and sits right under it. The two boxes touch, and the child gets two 'Thistledown' messages stacked in the middle of the screen.
  - At night Fountain Square is almost as bright as day. The 22 lamp pools of r 110, the fountain's r 90 and the pale paving wash out the night overlay. The lamps themselves show no visible glow around their heads. The town loses its night feel, even though Ambrose says 'get indoors or get your sword out'.
  - Doors on the top wall are drawn at the roof's back edge, so from the street the inn, h6 and h7 look as if they have a door on top of the roof. A child walking the Smithy Lane or Rose Lane side has to guess that the door is round the back.
  - C15 does not prove the street lamps light the screen. It calls HOOKS.nightLights directly, so a build where drawNight never reads the hook still passes.
  - C20 claims ward banners never show within 3.2 s of the Thistledown banner, but the check passes with that rule removed. The walk from 86,32 to Fountain Square already takes about 5 s, so the rule never comes into play.
  - An old-save change on ground where a new house now stands is kept, because FLOOR counts as OPEN ground. A mare a knight parked on master at 101,28 or 123,37 stays parked inside the new h5 or h1, and a bed or plank there stays in someone's house. Picking up a plank or springing a trap writes GRASS (06-systems.js:391,...
  - At night the city makes town frames noticeably slower. Most of the cost is the extra radial-gradient light punches. This was measured on a Mac; it is not measured on an iPad yet.
  - On a keyboard, E does not advance the dialog. A child pressing E repeatedly at the fountain throws 1 coin per press and stacks the lines behind the prompt, which stays on screen.
  - The spec's C10 rule, every group has a walkable 4-neighbour, is relaxed. The 16-cell hedge row at 87..102,55, between the agility fence and the south wall, can never be reached or used.
  - Two refund edge cases are wrong. tree_sapling and oak_sapling both place HOUSE_SAPLING, so a reverted oak sapling comes back as a tree sapling. When the pack and bank are both full, bankAdd fails and the item is lost with nothing said.
  - 'Here, take the key.' But no key is given and nothing appears in the bag. A child will look for it. The quest text then says 'Ambrose gave you the key.'
  - A knight at stage 6 or later never hears Ambrose's spec'd first-ever line ('I ring the bell at dawn and at dusk...'), because the story opens on the very first talk and sets ambroseMet. Also, 'belfry' (step 5) is a hard word for a ten-year-old.
  - The comment says 'the seventeen buildings', but TOWN_IDS holds 16 ids, and C9's '17 town buildings' wording inherits the mismatch.
  - The west bunting string runs diagonally across the High Street right at the gate mouth. Every knight walking in through the West Gate has the pennants drawn across his face. This is the first city view on a new game.
  - The town guard standing beside the West Gate has his name tag and health bar cut off by the gate tower's cone. It reads 'wn guard · lv 12'.
  - Two empty dirt patches are left in the Smithy Yard. Rows 44..45 are Smithy Lane, but there is still a bare patch on each side of the old anvil.
  - The Voice says the castle is 'just past' the fountain, but on a laptop the castle is not seen from the spawn. Only the tips of the purple gate-tower cones show, behind the hotbar. The keep is 13 rows south, which is off the screen.
  - Death's House keeps the core flat dark roof. Beside the new timbered and roofed facades, it is the one building that looks unfinished.
  - A friend standing on the grass behind the Bell Tower, outside the north wall, is hidden from other knights. Only the local knight gets the see-through tower.
  - No check covers migrate's own 'knight out of solid' step. Removing it passes all 25 capital checks, because 04-state's load already moves him for most cases. The case that needs it: the knight saved standing on a DOOR diff (walkable) on a cell that is now hedge or fountain. The one-time pass reverts the door to soli...
  - An old save's solid things on old village grass that is now the High Street are kept on the High Street: a knight's plank or fence, a walker wreck. For that knight the 'clear road from gate to gate' can stay part-blocked.
  - Knights can almost no longer build in Thistledown: beds, lodestones, planks, workbenches. Nearly every outdoor cell is now cobble (refused by the core: 'The guards would not like that on the street') or lawn (not placeable). The spec chose this, but it is a gameplay change the owner should decide knowingly.
  - At DPR 2 the chunk cache holds 20 canvases of 768x768 (about 47 MB of backing store). Nothing releases them when the knight leaves the town or enters an instance. On Cohen's iPad this adds to the Cloud Kingdom's own cache under Safari's total canvas-memory cap.
  - A seller standing behind or beside a thing takes its use, so some of the new lines cannot be read by tap from those sides. The apple, candle and flower stall lines, two bench lines, a hedge and a lamp line answer as Hettie, Mabel, Moll, Greta, Wynn and Captain Roderick instead.
  - 31 greenery cells have no walkable neighbour. Tapping them gives the core's 'You can't get there.' instead of walking to the nearest cell of the same bed.
  - The iPad quest log tells Cohen to 'press E'. The rest of the game words keys through keyName or touchify, so the touch player reads USE.
  - An old save of a knight who paid Dorran and slept at the inn loses its wake-up bed, and he is not told. The inn moved one tile east (x 122 → 123), so his saved bed cell 128,48 is now floor. migrate() clears bedSpawn, and he wakes at the fountain after his next fall.
  - The chunk cache is capped at 40, but the plan window has 48 chunks (8 x 6). A view that shows more than 40 of them thrashes: every chunk in view is evicted and repainted on every frame. This happens on a 4K screen at 100%, or with the browser zoomed far out. At 2560x1440 the city also costs about 6.6 ms a frame more...
  - On a phone, the first frame after a town building comes into view hitches for up to about 50 ms while its picture is made. That is roughly twice base's worst frame. A knight walking the High Street on a phone will see a stutter at each new building.
  - C17 does not catch the loss of migrate's own 'move the knight out of anything solid' rule. The core load() already moves him before migrate runs, so the test passes either way. migrate's rule is the only guard for a knight whose cell turns solid only after a diff is reverted, for example an old open diff on a cell t...
  - The refund line does not pluralise. A real old save from base got 'Back in your pack: 17 plank, 1 bed, 1 lodestone.', which is wrong English for a ten-year-old to read.
  - GROUND_COVER tells the core to skip the texture whenever the cell is pristine. It does not check that the chunk was actually painted. If an iPad under canvas-memory pressure returns null from getContext('2d'), the chunk stays blank, the core draws nothing either, and those cells show the #0b0f14 background.
  - The story says the bell rings once at midnight, but nothing in the game rings it at midnight. ringBell only fires at dawn and dusk. A child who waits up at night in Thistledown never hears the 'ghost'. Also, a knight who meets Ambrose after the Duke never hears his introduction line, because the story starts on the ...
  - Ambrose, who gives the new side quest, gets no Quest marker on the minimap or the world map. Every other quest giver in town has one (Duke, Tobin, Captain, notice board). Ambrose's role is td_bell, which is not in QUEST_ROLES.
  - Tapping water that is drawn on screen but has no standing spot next to it says "You can't get there." That covers the middle of Swan Pond (where the swans swim) and the south and east moat. A child tapping the swans or the pond gets a refusal instead of being walked to the shore to fish.
  - There are a few words a ten-year-old may not know, all new text: "curtain wall", "gatehouses", "portcullis" (wiki) and "belfry" (the Voice in the story). The wiki's "who stands where" also leaves out Captain Roderick (110,40) and the Master of Skills (108,44), who both live in town.
- Boss rematch leftovers (2026-10-02): the Echo's name tag still reads "The Fang · lv 80"; War Shed rubble draws as grass squares in the plank floor; on a phone the War Shed valve sits under the top HUD plaques; rests count only while the game runs ("Ready in 10:00" waits for play time, not real time); a knight who already broke his own beast and helps a friend's first square fight gets REMATCH WON and the shed line while standing in the square; online, a stage-14 friend whose keeper already slew the Fang fights without the Dragon Killers; the War Shed door is open from a new game and its first-visit voice talks about Hollowford early; two of the new online guards (Gnasher keeper guard, one more) have no check that catches their removal.
- Flaky checks under machine load (2026-10-02, while the city build ran its own tests): "fight back: only the monster that attacked" (also on master under --play), storm "(fake NET non-keeper): arriving rested asks the keeper once" (1 in 7). The game is fine; the checks are timing-sensitive.
- Mount gates leftovers (2026-10-02, small): on the mare, GET DOWN in a gateway sometimes says "No room to get down here" with the street right there; the town gates are drawn as a shut fence-gate even while a rider stands in them (draw the leaves open when someone is near); check 0 in 94-mountgates uses fixed radii (20/22/26) instead of each mount's real one; the monster-at-gate check quietly skips a monster type that no longer exists.
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
- On a phone, the place-name banner (THISTLEDOWN) draws over an open page for its second or two. Seen 2026-09-30 on the quest page.

Built but NOT through its adversarial review yet (it passed the suite and was deployed; review it properly next):
| What | Where it is | What is left |
|---|---|---|
| Admin mode and drop parties | feat/admin (db92c37), in master | The abuse review (a clever kid trying to get admin powers or free party hats), the kid-on-an-iPad review, the data-safety review. The admin panel still uses the old HUD look. |
| Golem mini-game | feat/royalmine2 (ce2f90a), in master | Review round 1 findings were fixed; round 2 (Cohen's eyes, code + online, rules + balance) never ran. |
| Ashfields edge, auto-retaliate | fix/0925-ashfields, fix/0925-retaliate, in master | Stopped mid-build and shipped as saved: both passed the suite together, neither was reviewed. Check the Ashfields edge all the way round and try to break auto-retaliate (two monsters, throwers, rivers, machines, online). |
| Redcut edge, axe in the stump, instance maps + banners | fix/0925-canyon, fix/0925-axe, fix/map-labels-banners, in master | Finished by their builders, not reviewed. |

Cloud Kingdom polish (unfinished work saved on feat/cloudkingdom as 6a9b2ef, taken OUT of the release because it
crashed a check; screenshots of the problems in ~/.fanglands/work/cohen/rescued/ckr3rev/):
- The two Great Gate towers are drawn over the inside of Halcyon's Sky Forge and the house aer_h4 (the one real bug).
- The market square is mostly empty; stalls should read as shops with goods.
- The Sky Forge has no hearth or anvil; the Cloud Oven bakery has no oven.
- The market fountain's statue does not read as a winged person.
- The east and west walls read as a walkway from above.
- The 'day' sun is a white glare disc that bleaches buildings under the minimap.
- A stray row of flagstone by the Wishing Well joins nothing.
- On a laptop the keep's cone and pennant are cut off from the plaza.

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
- The bank panel's Prev/Next overlap at 320x568.
- Old saves: player changes (stumps, planks) can land inside the new cliffs.

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
