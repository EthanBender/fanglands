# Fanglands — Roadmap

Each version is playable on its own. We never leave the game broken between versions.

## v0 — The Cave (DONE 2026-09-07)
- [x] Top-down 2D world drawn from textured shapes (grass, dirt, stone, water, trees, rocks)
- [x] Wake in the cave, the Voice speaks, wooden sword in a beam of light
- [x] Walk (WASD / arrows / touch stick), swing sword (Space / tap)
- [x] Goblin soldiers (aggressive, chase on sight) and boars (neutral until hit)
- [x] HP, damage numbers, Melee + Defence levelling, locked skills shown (Range, Fishing, Cooking)
- [x] Gold and scrap drops, inventory bar
- [x] Break trees and rocks, craft planks from wood, place planks as blocks
- [x] Quest tracker: "First Blood" then a signpost toward the first town
- [x] Auto-save in the browser (progress survives reload)

## v1 — Thistledown (DONE 2026-09-07)
- [x] Map extended east; Thistledown village with fence, square, seven buildings
- [x] 16-slot pack, stackable items, hotbar 1–5, drop, full-pack handling
- [x] Bank (Aldous), General Store (Marta), Bakery (Rosalind), sell at 60%
- [x] RuneScape XP curve; Woodcutting, Mining, Fishing, Cooking as real skills
- [x] Oaks / iron rocks gated by level; trees and rocks regrow
- [x] Fishing at ponds with a rod; cooking at campfires; food heals
- [x] Death's Coffin at any grave: free for cheap stacks, 25% for valuables
- [x] Training dummies + highest-hit record (less XP than fighting)
- [x] Duke Ferrin main quest gated on Melee 5 + Woodcutting 3
- [x] Tobin's loaf side quest; neutral guards (men and women); sheep, cows, cave spiders
- [x] Self-test covers all of the above (28 checks)

## v2 — Goblin Tech (DONE 2026-09-07)
- [x] RuneScape-style RNG combat, equipment slots, weapon perks, iron + steel tiers
- [x] Forge + anvil with hammer animation (Smithing), workbench, tinker's table, alchemy table
- [x] Firemaking, Farming, tool-gated Woodcutting/Mining with stumps and rubble that regrow
- [x] Drop tables with rarity, coins as an item, pack rearranging
- [x] Goblin sappers (sticky bombs), brutes, the Goblin Walker: kill, wreck, repair, pilot
- [x] Bows and arrows (Range), bombs, goblin traps
- [x] Bigger map (160×96): Grey Quarry, Wolfwood, Goblin Camp, Easter eggs
- [x] Thistledown rebuilt: streets, enterable furnished buildings, market stalls, villagers, castle + keep
- [x] Death's House (stone, coffin door, ghost with scythe, gold piles, chest)
- [x] Minimap + world map, area banners, quest tracking on demand
- [x] Lodestone home teleport, beds as respawn, push-through doors and gates
- [x] Aggro stops at higher combat level; XP pace cut hard
- [x] Self-test: 52 checks, source split into src/ modules with build.sh

## v3 — Five features in parallel (DONE 2026-09-07, five agents, one feature file each)
- [x] Chapter 4: Hollowford ruins south of the camp, survivors in the chapel crypt, the Barrelbeast boss (two phases, wreck on death), main quest stages 8–11 (`src/20-hollowford.js`)
- [x] Hero companion: free Sera the ranger from the camp cage, or hire Garrick at the inn; follow/stay/dismiss, they fight, fall back and return (`src/21-companion.js`)
- [x] Goblin bulldozer: charges and flattens planks, fences, trees and crops; wreck, repair (4 bars + 6 scrap), drive it as a lumber machine (`src/22-bulldozer.js`)
- [x] The Watch: wanted stars for attacking guards in town, hostile guards, shops refuse, gate reinforcements, Captain Roderick settles fines and buys goblin scrap, arrest on death (`src/23-law.js`)
- [x] Deepholm: dwarven undercity under Grey Quarry via the mine shaft, dark with lamps, mithril rocks (Mining 20), mithril bars and gear (Smithing 20–30), King Thrain's quest, Brunhild's shop (`src/24-dwarves.js`)
- [x] Self-test: 103 checks

## v4 — The whole original scope (DONE 2026-09-07, second wave of five agents)
- [x] Map 200×140, saves remapped; headless test runner (`node tools/headless.js`)
- [x] Sound effects (synthesised, no files) with a mute toggle; Help panel (? / HELP)
- [x] Notice board with 14 tiny quests, taken and handed in at the board (`src/29-quests.js`)
- [x] The Jungle and Sylvaris: hidden elf city of stilt huts and rope bridges, jungle logs (WC 15), archery targets for Range, Lira's bows, the Queen's quest, Thessaly's loom and hover armour that floats over water (`src/25-elves.js`)
- [x] The Grey Sea: dock, Old Harl's ferry, Gull Isle (lobster, Salt Pete, message in a bottle), Ironclad Isle (goblin shipwreck, strongbox) (`src/26-boats.js`)
- [x] The Ashfields: lava, obsidian (Mining 35), Dunstan the dragon dung farmer and the fireproof salve, green and red dragons with fire breath, Godly Plated armour with the winged helm (`src/27-dragons.js`)
- [x] The Fang's lair: sealed gate, heat, the giant elemental dragon cycling fire / ice / storm / stone, the hoard, the ending and credits (`src/28-thefang.js`)
- [x] Self-test: 170 checks

## Audit 2026-09-07
See `docs/AUDIT-2026-09-07.html` (78 findings from three reviews + `tools/balance.js`). Next wave in priority order:
1. Core fix pass: inn-bed respawn in wall, lodestone into solid, mech exit into obstacle, Harl stranded, reload-during-death wipes chest, smithing double-tap, Fang/Barrelbeast respawn farms, potato arbitrage, coin loss on sell, double coffin fee, regrow overwrite, hover walk-over player-only, shared left-HUD cursor, saves by tile name, talk-before hook.
2. Core UX pass: auto-track main quest + map targets, dialogue pacing/log/pause, key-name helper for touch, confirmations, panel paging/tabs, phone layout collisions, ground drops saved.
3. Rebalance: walker on-ramp, ash drake lv 30, Godly at Smithing 32–40, hover at Crafting 12, Fang 800 hp/def 50, kill XP bonus, companions scale.
4. Features: Hollowford rebuilt, title screen + save slots, region music.

## v5 — Core fix + UX + balance (DONE 2026-09-07, audit follow-up)
- [x] Core fix pass from the audit (respawn/lodestone/mech-exit into obstacles, Harl stranded, death-chest reload, smithing double-tap, boss respawn farms, coin loss, coffin fee, regrow overwrite, saves by tile name, `talkBefore` hook)
- [x] UX: auto-tracked story + map targets, dialogue box that waits, "Said" log, touch key names, two-tap confirmations, panel paging/tabs, kid mode, banner queue (`src/13-ux.js`)
- [x] Title screen + three save slots (`src/14-title.js`); region music sequencer, key N (`src/15-music.js`)
- [x] Rebalance: ash drake lv 30 drops dung every time, kill bonus XP, Godly at Smithing 32–40, Fang 900 hp (`src/30-ashdrake.js`)
- [x] Rebuilding Hollowford: seven projects paid in planks/stone/bars (`src/31-rebuild.js`)

## v6 — Dad's feedback (DONE 2026-09-07)
- [x] Instances: caves, dungeons and boss arenas as separate maps (`src/16-instances.js`); every hotkey has an on-screen button on iOS
- [x] Tap-to-move, RuneScape style: tap a tree to walk over and chop it, tap a goblin to fight it (`src/17-tap.js`)
- [x] Friendly fire (sapper bombs and the dozer hurt goblins), sappers drop bombs, slower goblin-camp respawns, more armour/weapon tiers, the crossed-out sign renders struck through, no spawns on Death's door, doormats on north-facing doors
- [x] Map 260×180 with the far east and the south band opened for features

## v7 — Cohen's feedback (DONE 2026-09-07, third and fourth waves of agents)
- [x] The Barrelbeast, driven: cracks and strengthens, lightning rod, low-HP lightning phase, Tinkerton resupply (`src/32-beast.js`)
- [x] The Far Shore: Grubmarket, Castle Gnash, the goblin king's gold, neutral mechs, "A Tinker Gone Wrong" and the Gnasher arena (`src/33-goblincity.js`)
- [x] Food: berry bushes, wheat, flour, pies at the oven (`src/34-food.js`)
- [x] Day/night with zombies after dark, the Afterlands where night never ends, vampires (`src/35-night.js`)
- [x] Song of Above: Aerie, the winged folk, Queen Seraphel, Godly Plated forged from dragon scale (`src/36-skycity.js`)
- [x] Dragon Killers: rare dragon items, the Ashfields gated behind stage 11, the group that summons The Fang (`src/37-dragonkillers.js`)
- [x] Agility courses and shortcuts, Hitpoints to 100, level-100 skill capes with abilities (`src/38-agility.js`)
- [x] Bulldozer upgrades: blueprints, the bay behind Brakka's, drill / iron drill / ram plate / big boiler (`src/40-dozerup.js`)
- [x] Trapped survivors under the chapel, freed with a hammer; the Hollowford Guild with jobs, ranks, a chest and a cape (`src/41-guild.js`)
- [x] World blending: organic coast, a river, dithered biome edges, forest clumping (`src/39-worldblend.js`)
- [x] Self-test: 375+ checks, `node tools/headless.js index.html 3`

## Backlog (not started)
- [ ] Night zombies kept out of Grubmarket and Castle Gnash
- [ ] One-tap talk for feature NPC lists (goblins, dwarves, elves) in tap-to-move
- [ ] Fast travel / mounts; a second hero; more base block types
- [ ] Balance pass on the late game with a real playthrough

## Parked (from the design chat)
- 3D camera, looking up/down, clouds
