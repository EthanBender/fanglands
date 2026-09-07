# Fanglands — Game Design Document

> Working title. "The Fang" is the legendary final boss, so the world is the Fanglands.
> Rename any time — nothing in the code depends on the name.
>
> Source: design conversation, 2026-09-07. This document cleans up that
> conversation into a spec. Anything marked **[open]** is a question the
> designer still needs to answer. Anything marked **[later]** was explicitly
> deferred so we can start 2D and small.

---

## 1. The one-line pitch

You wake up in a cave as a level-1 knight with nothing. A voice guides you to a
wooden sword and your first monster. From there you explore a huge block-built
world, fight goblins and their machines, level your skills, craft every piece of
your own armour on an anvil, build a base, trade in towns, and follow a
Zelda-style main quest toward the giant elemental dragon that only legends have
heard about: **The Fang**.

**Inspirations named by the designer:**

| Game | What we take from it |
|---|---|
| Knighthood | Knight-hero fantasy, monster fighting, gear progression |
| Zelda | Main storyline quest, side quests, tiny quests, a world map that leads you place to place |
| RuneScape | Skill levels (Melee, Range, Defence, Fishing, Cooking, and crafting/smithing), shops, in-game economy |
| Minecraft | Break blocks, craft, place blocks, build a base any way you want |

**What makes it different** (the designer's answer to "how is this not RuneScape + Minecraft?"):

1. **Magic hover armour.** A magic armour set lets you float instead of walking.
2. **A hero companion.** You can bring one hero with you to help in fights.
3. **Goblin tech.** The enemy faction is goblins with machines: mechs, sticky
   bombs, a bulldozer, goblin soldiers, and a mechanical barrel boss.
4. **Not pixel art.** The world is built from blocks and shapes, but they are
   textured and smooth. Grass looks like grass. No squares-of-squares look.
5. **Two hidden cities.** A dwarven city underground and a secret elf city of
   high tree huts, leaves, and rope bridges deep in a vast jungle.

---

## 2. Camera and presentation

- **2D, top-down.** Decided. This is where Gorkscape hit a wall (3D is hard to
  self-check), so we start 2D on purpose.
- **Simple animation.** Walk bob, sword swing, hammer strike, hit flash. Nothing
  skeletal.
- **Textured shapes, not pixels.** Tiles and characters are drawn from smooth
  shapes with texture detail (grass blades, stone cracks, water ripples).
- **[later]** Looking up and down, clouds, any 3D camera.

---

## 3. The world

- **Huge.** One big connected overworld, plus caves/underground, plus islands.
- **Made of blocks you can break.** Trees give wood, rocks give stone, and so on.
  Blocks are shapes, not cubes.
- **Biomes / places named so far:**
  - The starting cave (spawn point)
  - Grassland outside the cave, first goblins
  - Towns (multiple), one of which was destroyed by the Barrelbeast
  - A vast jungle hiding the secret elf city
  - The dwarven city underground
  - Islands reachable by boat: people at docks offer to take you to them
  - Dragon country (the dragon dung farmer lives near here)
- **Map.** A world map that marks places you've discovered and where the current
  quest points. Zelda-style.

**[open]** How big is "huge" in screens? Is the world hand-placed, generated,
or hand-placed regions stitched together?

---

## 4. The player: a knight

- Spawns in the cave with **every stat at level 1**. Some stats are locked
  until you unlock them in the story.
- No character class. You are a knight, and your build comes from which skills
  you train and which armour you craft.

### 4.1 Skills (RuneScape-style, level up by doing)

| Skill | Trains by | Unlock |
|---|---|---|
| Melee | Hitting monsters with melee weapons | Start |
| Defence | Taking hits while wearing armour | Start |
| Range | Bows, thrown weapons | **[open]** locked at start; unlocked by a quest? |
| Fishing | Fishing at water | **[open]** locked at start |
| Cooking | Cooking food at a fire | **[open]** locked at start |
| Smithing | Hammer + anvil to make armour and weapons | **[open]** starts unlocked or after first anvil? |
| Building | Placing blocks at your base | **[open]** is this a skill or just free? |

**[open]** Magic? The hover armour is "magic armour," so is there a Magic skill,
or is hover a property of the armour only?

### 4.2 Health, death, respawn

- HP scales with Defence level.
- **[open]** What happens on death? Suggested: respawn at the last bed/campfire
  you touched, drop gold but keep gear and levels. Kid-friendly, still a sting.

---

## 5. Combat

- Real-time, top-down. Swing in the direction you face.
- **Aggressive monsters** chase you on sight. **Neutral monsters** ignore you
  until you hit them.
- Melee to start. Range and magic later.
- One **hero companion** can follow you and fight beside you. **[open]** Who is
  the first hero? Do you recruit them in a town, save them from goblins, or hire
  them?

### 5.1 Enemies named so far

| Enemy | Notes |
|---|---|
| Goblin soldier | Basic melee enemy, first monster after the cave |
| Goblin sapper | Throws sticky bombs |
| Goblin bulldozer | Machine, flattens blocks/buildings, slow, heavy |
| Goblin mech | Machine, bigger, mid-game |
| **Barrelbeast** (boss) | Mechanical goblin barrel that destroyed one of the towns |
| Dragons | Late game, dragon country |
| **The Fang** (final boss) | Giant elemental dragon that only legends have heard about |

**[open]** Non-goblin wild monsters (wolves, slimes, spiders, skeletons in caves)?
The designer said "monsters" broadly, so the roster is open.

---

## 6. Gear and crafting

**You craft every piece of armour yourself.** Nothing is bought ready-made.

### 6.1 Armour tiers (named by the designer)

Ordered weakest to strongest. Exact order of the middle tiers is **[open]**.

1. Ruined (scavenged, what you find early)
2. Iron
3. Steel
4. Mithril
5. **Godly Plated** — the helmet has wings
6. **Magic (hover) armour** — you float instead of walking. **[open]** Is this a
   tier, or a separate set you can wear at any tier?

Slots: helmet, body, legs, boots, shield, weapon. **[open]** cape/gloves/ring?

### 6.2 Weapons

Starts with the **wooden sword** in the cave. Then the same material ladder as
armour (iron sword, steel sword, ...). Bows for Range. **[open]** Any goblin-tech
weapons you can salvage (a sticky-bomb launcher)?

### 6.3 How crafting works

- **Simple things craft from your inventory.** Wood → wooden planks, etc.
- **Armour and weapons are made at an anvil.** You bring out a hammer and strike
  the anvil. There is a hammer-strike animation. **[open]** Is it a timing
  mini-game (hit the glowing spot), or just hold to craft?
- **Base building.** Mine blocks, craft them, place them. Build your base any
  way you want. **[open]** Can goblins attack your base?

---

## 7. Economy

- **Gold** from battles, trades, and selling items.
- **Shops** in every town, all sorts: weapons, armour materials, food, boat
  tickets, maps.
- **Trading** with NPCs. **[open]** Fixed prices, or prices that move?
- "Gold farm" is a valid play style: grind monsters for gold.

---

## 8. Quests and story

Three sizes of quest, Zelda-style:

| Size | Example |
|---|---|
| **Main quest** | The road to The Fang |
| **Side quest** | Stop the Barrelbeast that destroyed a town |
| **Tiny quest** | Bring the dragon dung farmer 5 sacks; fetch a fisherman's lost rod |

### 8.1 Opening (the first 5 minutes)

1. You wake up in a cave. Everything is level 1.
2. A voice speaks: **"You're finally awake."** It tells you to follow it.
3. In a beam of light lies a **wooden sword**. You pick it up.
4. You follow the voice out of the cave to your **first monster** (a goblin).
5. You win, level Melee, get a little gold. The voice points you to the nearest
   town, and the main quest starts.

**[open]** Whose voice is it? A spirit, the previous knight, the Fang itself
(twist), or your hero companion? This is the biggest story decision.

### 8.2 Story beats named so far

- A town was destroyed by the Barrelbeast. Rebuilding it or avenging it is an
  early quest.
- The dwarven city underground has something the knight needs (**[open]** the
  anvil for godly plate? mithril?).
- The secret elf city in the jungle. Elves live in high huts in the trees, with
  leaves and bridges, not crystals.
- Dock people offer boat trips to islands.
- The dragon dung farmer: an NPC in dragon country. **[open]** What does dragon
  dung do? Suggested: it's the only fertilizer that grows the herb that resists
  dragon fire, so you need to befriend him before The Fang.
- The Fang: giant elemental dragon. **[open]** Which element, or all of them in
  phases?

---

## 9. NPCs named so far

| NPC | Where | Role |
|---|---|---|
| The Voice | Cave | Tutorial guide, story hook |
| Shopkeepers | Towns | Economy |
| Boat people | Docks | Travel to islands |
| Dragon dung farmer | Dragon country | Tiny quests, dragon prep |
| Dwarves | Underground city | Smithing, mithril |
| Elves | Jungle tree city | **[open]** Range training? |
| Heroes | **[open]** | Companions |

---

## 9b. Systems added from the second design chat (2026-09-07, evening)

- **Pack with limited slots.** 16 slots, stackable materials (50 per stack),
  tools and weapons take a slot each. Keys 1–5 use the first five slots, so
  food can be eaten mid-fight. Full pack means loot stays on the ground.
- **Bank.** Aldous in Thistledown keeps 48 stacks. Deposit by tapping a pack
  slot, withdraw by tapping a vault slot. The equipped weapon stays with you.
- **Shops.** Marta's General Store (fishing rod, bread, cooked shrimp,
  campfire kit) and Rosalind's Bakery (bread, meat pie). Shops buy anything at
  60% of value.
- **Skills, RuneScape curve.** Level N needs the classic table (83 xp for
  level 2, 1,154 for level 10). Woodcutting and Mining are real skills; oaks
  need Woodcutting 5, iron rocks need Mining 5. Fishing needs a rod. Cooking
  needs a campfire. Trees and rocks grow back after a minute.
- **Gating by skill, not just combat.** The Duke's task needs Woodcutting 3.
  The oaks and iron rocks are locked by level. More gates come with Smithing.
- **Death's Coffin.** On death the pack goes to Death; the wooden sword stays
  so you are never stuck. Any grave in the ground (one by the cave, three in
  the Thistledown graveyard) opens the coffin. Stacks worth under 20 gold come
  back free; valuables cost 25% of their worth. Dying again replaces what
  Death held. Gold is never lost on death now.
- **Training yard.** Sergeant Hale's three dummies show your damage and record
  your highest hit. Dummy XP is a quarter of real fighting.
- **Village life.** Houses cannot be broken; placed planks can. Tobin's loaf
  quest (side quest), Duke Ferrin (main quest), neutral men and women guards
  who fight back hard, sheep and cows in pens, harmless cave spiders.
- **Respawn** moves to Thistledown once you have visited it.

**[open]** Should killing guards have a consequence (guards hostile for a
while, a fine)? **[open]** Bank fee or free? **[open]** Should the coffin fee
also scale with how far away you died (the designer mentioned distance)?

## 9c. Systems added from the third design chat (2026-09-07, night)

- **Combat is probabilistic, RuneScape-style.** Every swing rolls accuracy
  (your Melee level and weapon accuracy against the monster's defence) and then
  damage from 1 up to a max hit set by Melee level and weapon strength. Misses
  show as a blue "miss". Monsters roll the same way against your Defence and
  armour. Max hit at level 1 with the wooden sword is 4.
- **Gear matters.** Equipment slots: weapon, helm, body, legs, shield. Equipping
  moves the item out of the pack into the worn column. Weapons have perks:
  daggers are swift, the warhammer knocks back, the battleaxe cleaves a wide arc,
  the shortbow shoots arrows. Tiers so far: wooden, bronze (found), iron, steel.
- **Levelling pace slowed.** Melee XP is 4 per point of damage, no kill bonus.
  Gathering is timed with a success chance per swing, one log or ore at a time.
- **Aggression.** Goblins see 4.5 tiles, and stop attacking you once your combat
  level passes twice their level plus one. Higher-level monsters (brutes lv 9,
  wolves lv 6, the walker lv 18) hurt more and show a red level tag.
- **Tools gate gathering.** A bronze axe sits in a stump outside the cave; a
  bronze pickaxe lies in the cart at Grey Quarry. Iron tools are smithed.
- **Stumps and rubble.** A chopped tree leaves a stump that regrows; a mined
  rock leaves rubble that settles back into rock.
- **Firemaking.** Light logs on open ground for a fire that burns 90 seconds,
  then cook on it. **Farming.** Hoe grass to soil, plant potato seed, three
  growth stages, harvest 2 to 4 potatoes.
- **Station-gated crafting.** Pack: planks only. Workbench: bow, arrows, door,
  bed, workbench, lodestone. Tinker's table: traps, iron arrows. Alchemy table:
  bombs. Forge: smelt ore into bars. Anvil (needs a hammer): iron and steel gear
  with a hammer-strike animation.
- **Drop tables.** Every monster has always-drops, a weighted table, and a rare
  table with its own 1-in-N chance. Rare drops get a gold banner.
- **Goblin tech, medieval.** Sappers throw sticky bombs, brutes hit hard, the
  Goblin Walker is a barrel on iron legs with a boiler. Kill it and it leaves a
  wreck; repair it with 3 iron bars and 4 scrap, then climb in and pilot it.
- **Range, bombs, traps.** Old Wren in Wolfwood strings you a bow for 5 spider
  silk. Bombs explode on contact. Traps spring on any beast that steps on them.
- **Enterable buildings.** Push through doors; the roof lifts away inside.
  Shops, bank, smithy, tinker's workshop, inn, houses, all furnished. NPCs stand
  behind their counters. No talking through walls.
- **Castle Thistledown** with corner spire towers, a portcullis, and the keep
  where the Duke sits.
- **Death's House.** A stone building with a coffin-shaped door. Inside, Death
  himself, a big ghost with a scythe, among his gold piles, beside the chest
  that holds what you dropped. Cheap stacks free, valuables a quarter, and he
  takes the fee from the coins you dropped first.
- **Town life.** Six villagers wander the streets with chatter. Two market
  stalls (Greta's seeds, Fennick who buys pelts and tusks at full price).
- **Minimap** top right; tap it or press M for the world map with region labels
  and the quest marker. **Area banners** name every region you enter.
- **Quests** are tracked on demand from the quest tab; nothing sits on screen
  unless you track it.
- **Coins are an item** in the pack. **Pack rearranges** by tap, tap.
- **Base building.** Lodestone sets home (H teleports, 5-minute cooldown). A bed
  within a few tiles of a lodestone sets your respawn. Doors and gates push
  through for people but hold animals and goblins.
- **Wilderness Easter eggs.** The last knight's grave, a stone circle that
  heals, a ruined watchtower with a chest, Old Wren's hut, mushrooms and flowers.

**[open]** Barrelbeast and Hollowford are Chapter 4. **[open]** Should there be
a consequence for killing guards? **[open]** Dwarves for mithril, elves for
Range training, boats to islands are still to place.

## 10. Build order

See `ROADMAP.md`. Short version: v0 is the opening (cave, voice, sword, first
goblin, levels, break/craft/place blocks). Everything else stacks on that.

---

## 11. Decisions log

| Date | Decision |
|---|---|
| 2026-09-07 | Start 2D top-down with simple animation. 3D deferred. |
| 2026-09-07 | Not a medieval-mech game. Goblins have the machines, the player is a knight. |
| 2026-09-07 | Elves are tree-hut elves, not crystal elves. |
| 2026-09-07 | Player crafts all armour; shops sell materials and other goods. |
| 2026-09-07 | Limited-slot pack + bank; food heals on use. XP curve = RuneScape table. |
| 2026-09-07 | Death keeps the pack; cheap stacks free, valuables 25%. Sword never lost. |
| 2026-09-07 | Woodcutting/Mining/Fishing/Cooking are skills and gate content. |
| 2026-09-07 | Combat rolls RuneScape-style; gear + stats set accuracy and max hit. XP pace cut. |
| 2026-09-07 | Death lives in a stone house with a coffin door, a scythe, gold piles and a chest. |
| 2026-09-07 | Buildings are enterable and furnished; the Duke sits in a castle keep. |
| 2026-09-07 | Goblin tech is medieval: barrels, boilers, iron legs. The walker can be repaired and piloted. |
