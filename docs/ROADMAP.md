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

## v4 — next
- [ ] Elves: jungle biome, tree-hut city with rope bridges, Range training
- [ ] Boats to islands from a dock
- [ ] Dragon country, the dragon dung farmer, dragons, Godly Plated armour (winged helm), magic hover armour, The Fang
- [ ] More mechs to repair, more side and tiny quests, more block types for bases


## v4 — The Hidden Cities
- [ ] Dwarven city underground (mithril, big anvil)
- [ ] Jungle biome + secret elf tree city
- [ ] Boats to islands

## v5 — Dragons
- [ ] Dragon country, dragon dung farmer
- [ ] Godly plated armour (winged helmet), magic hover armour
- [ ] The Fang

## Parked (from the design chat)
- 3D camera, looking up/down, clouds
