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
