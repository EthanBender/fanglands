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

---

## BUILDING

| What | Detail |
|---|---|
| **Necromancy skill** | The magic skill, its supplies, its equipment, its quest line. |
| **World reshape** | Organic region outlines; gated flow (no walking from spawn to the Ashfields); roads joining everything with 3–6 points of interest each; 12+ outposts with unique activities; a real height layer so you walk under and over the rope bridges. |
| **Seven systems** | RuneScape bank (1/10/100/All, deposit bag, deposit worn, character panel you equip from); map markers; ore tiers between steel and mithril; house-portal private island; Paper Mario tile flutter on heavy hits; goblin spiked palisade; sky storm boss + Tinkerton met at the city gate. |
| **Banks and pack space** | Banking network, some free, some earned in high-level areas; permanent earned pack expansion that is **not** an equipment slot (must not collide with capes). |
| **Boss dungeons and boss ladder** | Move free-roaming bosses into their own dungeons; low bosses teach one mechanic, higher ones layer them; every boss a gimmick. |
| **Per-region tile sets** | Thistledown clean and bright; goblin city muddy and natural; Sylvaris like the cities in Wings of Fire; Ashfields desolate and smoky; Deepholm worked stone. |
| **Sylvaris grown into the jungle** | Bigger, districts with reasons to visit, integrated rather than bolted on, a repeatable reason to return. |
| **Bulldozer bay as a facility** | Tunnel you drive the dozer into, knight walks out, machine parked inside a real workshop with the upgrade stations around it. |
| **HUD redesign** | One grid, one container, one colour language, hierarchy, controls that look pressable. |
| **Online MMORPG at gorkscape.ca** | Owner 2026-09-24: *"make it an online MMORPG so Cohen and his friends can log in and play together."* Contract in `docs/ONLINE.md`. Pieces: world server (accounts, cloud saves, chat log, admin page), login on the title screen + cloud save + bridge from the old address, seeing friends + chat + gifts, shared monsters per map (keeper model). |

---

## QUEUED (waiting on something named)

| What | Waiting on |
|---|---|
| **Undertaker and the magic spade** | The tiered-undead rewrite. A quest to learn it from an undertaker, then a spade that digs up crosses and gravestones so zombies do not rise where you do not want them. No reward beyond a coin — the point is control. |

---

## OPEN

| What | Detail |
|---|---|
| **Alchemy as its own skill** | Move it off the tinker bench. 100 levels of potion craft with progressive unlocks: heals, temporary stat boosts, throwable explosive potions at higher levels, and skilling potions thrown at a situation (e.g. at an ore for a one-off multiplied yield). Needs the whole ladder designed, not a handful of recipes. |
| **Farming expansion** | Preset farming patches across the map (player building is moving to the house instance). More seed variety: pickpocket seeds from farmers, seeds on drop tables. Seeds grow potion ingredients as well as food. |
| **The King's royal mine** | A story quest for the dwarf king — not a fetch. Win his favour and he moves his throne aside to reveal a secret passage into an ornate royal mining facility: normal ores, plus **giant ores** that on mining may yield ore *or* wake a golem. Medium ore → medium golem, large ore → large golem; golems drop extra smithing resources. |
| **The ginormous golem** | A skilling boss through the back of the royal chamber: a huge golem you fight while stopping mini-golems from healing it. |
| **The Fang's Lair into an instance** | 1,023 more overworld tiles. Deliberately deferred — it is the last act of the main quest, its gate is modelled in the connectivity audit, and the bot must walk in and kill The Fang to reach the credits. Six-step plan written up by the Deepholm agent. |
| **Underground and sky as full map layers** | Deepholm proved the pattern. The owner wants one underground map where every cave sits below its overworld position, and a sky map above in proportion. |
| **The core's cave scrim still reaches two instances** | `09-render` darkens the map's top-left corner (`isCaveTile(ptx,pty) || cam.x < (CAVE_EXIT_X+2)*TILE && cam.y < 17*TILE`), which is where every instance map is written. `89-lighting` swallows it wherever a lighting scene owns the screen (Deepholm, the Spider Den, the coal road). Tinkerton's Lab and the Afterlands are left exactly as they were, on purpose — the Lab is 24×18, so nearly all of it is currently darkened by a cave 70 rows away, with a phantom light at world (21, 7.5). Decide whether the Lab is meant to be dark, then either give it a scene or fix the core condition. |
| **Night zombies out of Grubmarket and Castle Gnash** | Was in an earlier backlog; check whether the undead rewrite covers it. |
| **Melee has nothing new between 60 and The Fang at 80** | From the 2026-09-08 audit. |
| **Defence, Farming and Crafting still 3–5× the other skills' hours** | From the same audit. |
| **Fast travel / mounts beyond the horse** | Original dad feedback. |
| **A second hero companion** | Original design chat. |
