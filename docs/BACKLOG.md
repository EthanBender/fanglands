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
| Dozer outruns walking | it drove at 130 against a walk of 175. 205 now, 250 with the boiler |

---

## BUILDING

| What | Detail |
|---|---|
| **Item art** | All 170 items get their own icon (158 currently share one) + coloured halo on rares and uniques. Framework + six art agents. |
| **Tiered undead** | Wood cross → skeleton, grave → zombie, headstone → 2×2 zombie brute. All graves raise between midnight and dawn so none stand at dawn. Bones as a building and crafting resource. |
| **Necromancy skill** | The magic skill, its supplies, its equipment, its quest line. |
| **World reshape** | Organic region outlines; gated flow (no walking from spawn to the Ashfields); roads joining everything with 3–6 points of interest each; 12+ outposts with unique activities; a real height layer so you walk under and over the rope bridges. |
| **Seven systems** | RuneScape bank (1/10/100/All, deposit bag, deposit worn, character panel you equip from); map markers; ore tiers between steel and mithril; house-portal private island; Paper Mario tile flutter on heavy hits; goblin spiked palisade; sky storm boss + Tinkerton met at the city gate. |
| **Banks and pack space** | Banking network, some free, some earned in high-level areas; permanent earned pack expansion that is **not** an equipment slot (must not collide with capes). |
| **Boss dungeons and boss ladder** | Move free-roaming bosses into their own dungeons; low bosses teach one mechanic, higher ones layer them; every boss a gimmick. |
| **Per-region tile sets** | Thistledown clean and bright; goblin city muddy and natural; Sylvaris like the cities in Wings of Fire; Ashfields desolate and smoky; Deepholm worked stone. |
| **Sylvaris grown into the jungle** | Bigger, districts with reasons to visit, integrated rather than bolted on, a repeatable reason to return. |
| **Bulldozer bay as a facility** | Tunnel you drive the dozer into, knight walks out, machine parked inside a real workshop with the upgrade stations around it. |
| **HUD redesign** | One grid, one container, one colour language, hierarchy, controls that look pressable. |

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
| **Night zombies out of Grubmarket and Castle Gnash** | Was in an earlier backlog; check whether the undead rewrite covers it. |
| **Melee has nothing new between 60 and The Fang at 80** | From the 2026-09-08 audit. |
| **Defence, Farming and Crafting still 3–5× the other skills' hours** | From the same audit. |
| **Fast travel / mounts beyond the horse** | Original dad feedback. |
| **A second hero companion** | Original design chat. |
| **Cloudflare custom domain** | Needs the hostname; owner adds the CNAME. |
