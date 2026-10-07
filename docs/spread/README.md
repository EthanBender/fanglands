# The Great Spread: artefacts

The staged build spec lives outside the repo (`~/.fanglands/work/spread/spec.md`). This folder holds what its tools
make and read. Nothing here is loaded by the game.

| File | Made by | What it is |
|---|---|---|
| `baseline-fingerprint.json` | `node tools/fingerprint.mjs index.html --out docs/spread/baseline-fingerprint.json --from "master <sha>"` | The fingerprint of master at the start of the stage: one hash per table in plain sight, and the tables themselves gzipped (for `--diff`'s entry lists). Regenerated after every peer merge, before any conversion goes on top of it. |
| `inventory.json` | `node tools/literals.mjs --inventory` | Every bare coordinate-shaped literal in src/ and tools/, with file, line, column, the literal and its guessed anchor; `held` names the peer branch of a held file, `outsideHeld` counts the rest (0 from Stage 3 on). |
| `converted.json` | by hand, one file per Stage 1-3 commit | The files converted (or proved to hold no position), one per commit. Since Stage 3 the gate is repo-wide, so this is the record of what was done, not the list the gate reads; but the record must be whole: the gate fails a file that reads overworld positions from the Atlas (`ATLAS.frame`, `.port`, `.world`, `.box`, `.track`) and is not listed (the Atlas's own `literals.mjs` and `frame-codemod.mjs` excepted). |
| `held.json` | by hand (Stage 3 on) | Files an open peer branch is editing (`{ file, branch, reason }`): the repo-wide gate lets their bare literals wait until that branch merges, says so on every build, and names one that has none left. |
| `literals-allow.json` | by hand | Literals the gate lets through (instance-local and UI numbers), each with a reason. An entry with a `literal` is pinned by `decl` (the const, function or property it sits in), `context` (text that must stand on the literal's own line, spaces ignored: for a literal in an unnamed hook or test) or `line`; an unpinned one matches nothing and fails the gate. Every exemption names what it lets through: the gate refuses an entry with no literal (the whole file, a whole line or a whole context), bar a `decl` alone that names exactly ONE declaration in its file (01-atlas's own tables); a decl-only pin whose name is declared twice (a property of the same name elsewhere) is refused. Prefer `decl` or `context` to `line` in a file a peer branch edits: a line pin moves under a peer's edit above it, and the merge fails the gate. |
| `strict-allow.json` | by hand (Stage 1 on) | Frame points the strict report may log (relative geometry, such as the rim notch), each with a reason. |

## The tools (Stage 0)

| Tool | What it does |
|---|---|
| `node tools/fingerprint.mjs [index.html] --diff docs/spread/baseline-fingerprint.json` | Boots the build headless, runs newGame(), hashes every table a player could see move, names each changed table and its first 20 differing entries, and prints the strict report (frame points past box + guard + 12, as `src/file:line`); exit 1 on a changed table or a strict entry not in `strict-allow.json`. |
| `node tools/literals.mjs [files]` | Counts bare coordinate-shaped literals per file (pairs, `{x, y}`, x0 rects, setTile/tileAt/changeTile/tp/openSpot/bfs/... calls, ANY other call whose first two arguments are map numbers (`gcall`: pen, rect, regionAt, useAt, near, carve, mark, ...; canvas, Math, colour, sound, dice and string helpers excepted), `tc(N)`, `N * TILE`, comparisons of 10+ against a coordinate name or a pixel turned to tiles (`m.x / TILE > 143`), a centre after a coordinate pair (`rel`: `near(x, y, 66, 57, ...)`, `dist(x, y, 140, 76)`), a distance to a place (`minus`: `x - 140`, Math.hypot's arguments included; not an old coordinate `ox`/`oy`, a box edge less a size, a pixel or a drawing call), and named coordinates (`decl`: `const X = 112` whose name is later a tile argument)), skipping anything inside a frame call and anything `literals-allow.json` lists. `--inventory` writes `inventory.json`; `--gate` is the build's gate over `converted.json`. |
| `node tools/anchor-of.mjs X Y [X Y ...]` / `--port ID` | The place a literal belongs to: the smallest old box holding it (ties listed for a human), every box that holds it, and where it lands at the spread; "world" on open land. Reads `src/01-atlas.js` directly, same rule as `ATLAS.anchorOf`. |
| `node tools/frame-codemod.mjs src/NN-file.js [--write] [--as anchor]` | Rewrites the mechanical patterns (pairs, points, rects, two-number calls of the known list; comparisons only with `--as`) as frame reads and prints the diff; refuses (and lists) ties, undecided overlaps, lines naming two places, one-axis literals (`tc(N)`, `N * TILE`), comparisons without `--as`, rects whose corners disagree, calls it does not know (`gcall`) and named coordinates (`decl`). Read the diff: an instance's own coordinates come out as `cave` points and must be allow-listed, never wrapped. |

**The strict report** (spec §8). `ATLAS.strict()` keeps one entry per call site + anchor + point, with a hit count (a line
that runs every tick is one entry; the 200-entry cap counts distinct entries). `node tools/headless.js` (self-tests, and
`--play` runs) prints it after the suite and fails on any entry `strict-allow.json` does not list, so a far point written
in an update hook, a quest handler, draw code or a test is caught, not only one written while the game loads.
`fingerprint.mjs --diff` reads the same report for load-time points. The in-game self-test checks only that logging
works; whether an entry is allowed is the runners' question.

`build.sh` runs `literals.mjs --gate` after the syntax check. Since Stage 3 the gate is REPO-WIDE: every file of
src/[0-9]*.js and the top level of tools/ (`tools/*.js`, `tools/*.mjs`; 136 files on 6 Oct 2026) must hold 0 bare
coordinates outside `literals-allow.json`, whether `converted.json` names it or not; only a file in `held.json` may wait
for its peer branch.

**What the gate does NOT read** (and so may still hold overworld tile numbers): `online/src/` (the World's server code),
`online/test/` (its tests; `admin.test.mjs` stands a party at map tiles, for example), `tools/sim-bench/` and `tests/`.
The server and its tests are Stage 4d's (spec §11: the contract written into docs/ONLINE.md, atlas.test and move.test
there); the builder of 4d converts them, or brings them under the gate, before the spread ships. A new tool belongs at
the top of `tools/`, where the gate reads it. A peer branch that adds a tool standing a knight on the overworld must
wrap its spots before it merges after the spread (feat/teacher-view's `tools/teacher-browser.mjs` holds 14 bare spots
at line 117 on 6 Oct: wrap them in frames, or list the file in `held.json` until it is converted).

**The tools** (ADDENDUM A.2) are read like the game: a tool file is named `tools/<file>` in `converted.json` and the
allow list. In a tool the counter also reads game code handed to a game as text (`R(A, \`FANGLANDS.tp(24, 37)\`)`,
`ev(g, '...')`, `page.evaluate(\`...\`)`, reported at its place in the tool), a tile call on a game handle
(`openSpot(A, 60, 30)`) and a named spot (`['dock landing', 164, 14]`). A tool reads the Atlas inside the game it drives:
`A.ATLAS.world.tx(40)`, `A.ATLAS.frame('signpost').p(64, 30)`, or `ATLAS.port(...)` inside `page.evaluate`.

Stage 0 proof of the codemod: in a scratch copy, `frame-codemod --write` over 69-axestump, 57-townwall, 34-food, 24-dwarves
and 02-world (221 literals converted, 75 refused for the hand pass) built and gave a fingerprint identical to the baseline
with 0 strict entries. A deliberate `ATLAS.frame('wren').p(200, 150)` added at the end of 57-townwall was reported as
`src/57-townwall.js:72: wren point 200,150` and failed `--diff`.

## Stage 4a: THE MOVE (feat/spread)

The overworld is 400 x 280. One commit on feat/spread (from master d523504) moves every place to its section-2
top-left, stretches the land between, lays the roads and the river anew and stakes the new places. Nothing here is
deployed: the test world is held by the owner (`~/.fanglands/test-world.hold`).

**What moved and how** (`src/01-atlas.js`):
- `MAP_W, MAP_H = 400, 280` (`src/00-core.js`); every anchor's `at` is its `to`; `ATLAS.WORLD` is section 3's stretch,
  `xs = [[0,0],[1,1],[162,262],[200,318],[259,399]]`, `ys = [[0,0],[1,1],[179,279]]`. The `[1,1]` breakpoints are the
  builder's: the first column and row inside the tree border stay put, so every pass that runs "from the first column"
  (`W.tx(1)`: the rim, the scarp, the dither) still starts at 1. Without them `W.tx(1)` is 2 and column 1 is a walk round
  the scarp's west end (found: the Wolfwood was reached from the cave with every bridge shut).
- `ATLAS_V` 2; `export()` carries `anchors` (each place's box on this map, a reserved place's plan box) and `ports`.
- `TRACKS` is section 5's network (six main roads `r1_cave`, `r2_sea`, `r3_long`, `r4_goblin`, `r5_wolfwood`,
  `r6_ash`; spurs `r1a_quarry`, `r1b_beacon`, `r1c_mill`, `spur_camp_gap`, `r2a_skypier`, `spur_glasshouse`, `r3b_jungle`,
  `spur_canopy`, `r4a_saltmere`, `r4b_coast`, `spur_barrow`, `r6a_shrine`, `path_farm`, `r7_drovers`, `r8_bandit`; the
  miners' `shaft_lane`), its points ports, place points or new-map points `['n', x, y]`; and the river, from inside
  Miller's Pond out by its east shore (`pond.outflow`), south-east past Millbrook's bend, east along the scarp under the
  two road bridges (`old_bridge.span` 136,93 and `goblin_road.bridge` 228,92) to the Grey Sea below Saltmere. 02-world
  lays every road as continuous dirt at chance 1 (a main road two wide, a spur one); 39 bridges them over the river, 92
  leaves the scarp open where they cross it, 26-boats clears the Sea Road's verge, 20 widens the Goblin Road, 25 trods
  the Jungle Path, 27 and 93 keep the Ash Road clear.
- `GROUNDS` (new): the Sound, the east sea, the Grub Fields. `SIGNPOSTS` (new): every road node with three or more arms,
  and the Lodge and Millbrook. `ATLAS.signText(x, y)`, `reserved()`, `reservedAt(x, y)`, `onMainRoad(x, y)`, `pointOf(q)`.
- A REGIONS entry may name its Atlas id (`atlas: 'brightwater'`), where its name would slug to another.

**The new ground** (`src/93-spread.js`, after 92 and 93-ashedge, before 96-atlas builds the Atlas): every new and
reserved place is a REGIONS box ahead of every ground (the Old Bridge, Millbrook, Saltmere, the Crossroads Inn, Beacon
Hills, the Hunters' Lodge, the North and South Goblin Outposts, the Bandit Hills, the Skypier, Wreck Rock, Castle
Brightwater, the Glasshouse, the Old Barrow), and the Sound, the Grub Fields and the Ash Wastes are grounds. One tile is
spent, `PROP` (id 245), not solid; its kind lives in a side table (`SPREAD_GROUND.PROPS`): builders' stakes every fourth
tile round each reserved box, a plaque in each ("Builders' stakes. The Glasshouse is coming."), four buoys and a plaque
round Wreck Rock, stakes at the corners of the blood portals' rings of 3 (Hollowford's and the Far Shore's; Thistledown's
north lawn is 95-thistledown's own ground, rebuilt from quest state, and waits for Stage 7). The Sound and the east sea
are laid first of all the world passes and again at the end. Castle Brightwater is a cliff ring with no gap. A signpost
(the old SIGN tile) stands beside every node, off the road, where it cuts no way; E on it reads `ATLAS.signText`
("→ Millbrook (builders at work), south-west."). `placeAction` refuses a reserved box and a main road with a tile either
side: "Builders have staked this ground."

**Where the routes and boxes differ from the spec's sketch, and why** (spec §1: "any trip is tuned by moving one anchor
or one TRACK point"):
- R1 runs east along row 7-8 first: §5's straight line from the cave mouth crossed Death's House 1 (cave 25..30 x 10..14).
- R1c (Mill Lane) runs west round Miller's Pond: the river leaves by the east shore, where §5 put the lane, and Mill Lane
  has no bridge.
- R2 passes the camp's west field and goes north round the palisade (§5's line from the gap to the shore lane crossed
  the palisade); a spur leads into the west gap (node 228,48). R2a (the Skypier spur) is laid now, so the Skypier's
  stakes are joined.
- R3 leaves the west lane at 141,70 for 131,82, passing the Glasshouse plot (6 tiles), then the Old Bridge; the bridge's
  south end is 138,99, not 140,98: the watchtower's ruin stands on 141..145 x 97..101.
- R4 leaves the camp by its south palisade gap (camp 150,39), east of the War Shed, and passes the outposts' stakes
  beside their boxes (10 tiles off the north one, 4 off the south one), not through §4's `*.road` ports inside them;
  R4a forks at 232,80; R4b runs inland (250,52) to the Sea Road at 246,30.
- R5 passes the step below Wren's door (the hut's wall is not the road's) and runs between the graveyard and the
  Deepholm rock.
- The Sound is x 303..311 (nine wide, as §1), not 312..320: 90-canyon's red country reaches 14 tiles west of the
  Redcut's rim, to x 313, and the Sound drowned it (the Redcut's ragged west edge ran straight for 7 rows).
- Castle Brightwater's box ends at x 391, not 392: ADDENDUM C keeps x 392..399 for the east sea.

**Checks that read the old map's scale, re-read for the new one** (each with its reason, in the check's own comment):
- 27-dragons, the Ashfields' ash as a share of the box's open ground (27%..65%, the old 900..2200 tiles of 3377): the box
  is three times the ground it was.
- 93-ashedge, the rim's longest level stretch in old tiles (W.ix), bounded at 6.5: the stretch's rounding makes the old
  map's longest (6) ten new columns, 6.17 old tiles. 92-worldshape, the ash "six rows above the rim" read in old rows
  through the rim's pin. 11-main, the jungle's density measured to the Sound's west shore.
- 92-worldshape, the four grounds' outline bands measured in old tiles (they stretch with the land) and the Jungle's east
  band 30 old tiles deep (was 20): the Jungle is 2.4 times the ground, its enclaves are not, and at 20 its outline stood
  within 11% of its box (the check asks 12%).
- Spots a check stood a knight on that the new land moved: the nearest reachable oak (11-main), the canopy walk from a
  point on the Jungle Path (48-agility2), a tile beside Marta for the knight's frame (82-knightgear), the drill field's
  west end for the dozer's lane (40-dozerup), the open tile behind the Bell Tower (95 C25), mmo-sim-party's 9 x 9 meadow
  within 90 tiles.
- Land the new map made that a check rightly refused, fixed in the land: berry bushes off the Deepholm wood, the staked
  ground, the Grey Sea's shore and the rim's last rows (34-food); ore rocks and bushes a copse walled in freed (93-spread);
  hills blackiron off staked ground (62-ores); the Redcut's dry band takes bare dirt and kills every tree in its dry grass
  (90-canyon); a tree in a spawn's ring beside the ash is charred too, solid for solid (93-ashedge); the scarp's steps cut
  through a tree on the port (92-worldshape); 91-cloudkingdom's chunk cap no longer multiplies two negative spans (a
  camera still on the bigger overworld).
- 93-ashedge's tree check exempts Dunstan's farm, which its burn pass guards (as it already exempted the warden's ground).

**The fingerprint after the spread.** `docs/spread/baseline-fingerprint.json` is this map's now (fingerprint
1f0660e902cbd111, made from the 4a build): Stages 4b on diff against it, and each later stage's FOOTPRINT proof starts
from it. The Stage 0-3 proof ("nothing visible changed") no longer applies: 4a is the visible change.

**The jiggle after the spread.** With this tree at 400 x 280 and every place at its `to`, `tools/jiggle.mjs` refuses the
per-anchor and x1.1 passes (they rehearse the old map: run them on the Stage 3 tree) and `--spread-only` reads the other
way round: its base and controls are the tree before the move (`JIGGLE_BASE_REF`, default d523504, cached as before),
built at 400 x 280 with nothing moved, and its moved build is this tree as it stands. What the move adds on purpose is
counted apart, not red: the new places' REGIONS corners (new in the moved build), a builders' stake (PROP) or a road's
signpost (SIGN) on a place's open ground, and inside the Redcut its own re-rolled dressing (90-canyon shuffles its salt
seams with its own stream over candidates that read the land round its box, so other seams are picked on the new land
and its fallen blocks, pocket fill and ledges follow them: the spec's known re-roll, a mined seam being dropped by the
save migration, section 10 class e). The giants' gap pin reaches any open tile four rows south of Hollowford's exit
within 6 of its column (the Jungle Path bends away from the column since the spread).

**Proved on the 4a build** (6 Oct 2026): `./build.sh` (literals gate 137 files, 0 bare); `node tools/headless.js` ALL
1350 PASS; `--play` ALL 1351 PASS (the bot to stage 16 with nothing forced, the Fang dead); `node --test online/test/`
295 pass; atlas-drift; build-sim `--strip --reads`; mmo-sim, `--room`, `--sim`; dom-keys; mmo-sim-admin; mmo-sim-party;
mmo-sim-world; sim-suite ALL 28 PASS; fingerprint `--diff` identical to the baseline; `tools/jiggle.mjs --spread-only --spread-gate` all green (transport and plate
hold, every pin holds). 95's C10b and C11 send a following hero away while they press E (a hero who follows can stand in
front of the knight after a teleport and take the E; the playthrough leaves one following).

**Walk-clock on this map, for 4b** (the bot's walk at a knight's foot speed, seconds; the spec's windows):

| Trip | Now | Window |
| --- | --- | --- |
| cave mouth to the square | 46 | in |
| square to Hollowford | 35 | 45..62 (short) |
| square to the dock | 30 | in |
| square to the Warden's gate | 39 | 45..65 (short) |
| square to Old Wren | 48 | 50..70 (short) |
| Hollowford to Sylvaris | 29 | in |
| cave mouth to the Fang's lair | 84 | 100..135 (short) |

Four trips are short: Stage 4b tunes them by moving a TRACK point or an anchor (spec section 1), not here.

**ADDENDUM A's plots** (for the Fangland session):
- **Alchemy, the Glasshouse:** box 110..125 x 71..82 (16 x 12), port `alchemy.door` 125,78, a spur from the Long Road
  at 134,78. Goblin Fields, on the dry ground east of the river's bend below Miller's Pond (the river is 5 to 8 tiles
  west of it), 6 tiles from the Long Road. Centre 117.5,76.5: 26.9 from the Old Bridge, 32.3 from Millbrook, 35 from the
  Lodge, 46.5 from the pond. (The drill field, an unnamed machine lane like the signpost, is 12.5 away; §2's own plan
  puts the drill field and the signpost 24.2 apart, so the unnamed lanes are not in the spacing set.)
- **Necromancy, the Old Barrow:** box 66..81 x 106..119 (16 x 14), port `necromancy.door` 73,119, a spur from the
  Wolfwood Road at 73,121 (the road runs 2 tiles south of the box). In the west of the Wolfwood, below the scarp. Centre
  73.5,112.5: 25.4 from Old Wren, 26.5 from the stone circle, 30.2 from Millbrook, 32.6 from the Lodge. Nearer the
  graveyard and the crypt cannot pass the spacing test: the graveyard, the Deepholm rock and Wren's hut sit within 25 of
  every Wolfwood tile west of x 60 that the scarp and the rim leave room for; the Barrow is 53 tiles (about 15 s) east
  of the crypt along the Wolfwood Road.

## Stage 4b: FIX-UPS, LABELS, TESTS (feat/spread)

Built on 4a (cdff429), 7 Oct 2026. Not deployed (the test world is held by the owner, `~/.fanglands/test-world.hold`).

**The world map's names (ADDENDUM B, `src/61-maplabels.js`).** One label per overworld Atlas place (the open Goblin
Fields and the Wilds unnamed, as before), from one function, `MAP_LABELS.layout(items, opts)`, which the teacher view's
map can call with its own scale, rings and bounds. Priority: towns, then regions, then landmarks, then small places
(`MAP_LABELS.TIERS`); a name by the map's edge slides in, then each is nudged (up to a set distance: towns and regions
three times a small place's, a region only onto its own ground) off the names already placed, every marker and quest
ring and the key strip, and a name that still cannot fit is dropped at that zoom. A quest ring on a place lights that
place's name in gold; a ring on a person or a thing prints no words (people are markers, not labels). Self-test at
1280x800, 1024x768, 768x1024 and 390x844, markers on and off (a recording canvas hears every word: no place twice, no
person). Screenshots of the panel at each size: `~/.fanglands/work/spread/s4b/mapshots/`.

**The land.**
- 92-worldshape: BAND 8 (was 5). Soft seams (the Wolfwood / Jungle giants, Hollowford's burn on the wood and the jungle,
  the Jungle's west edge on the Wilds and the Ash Wastes): within the band a tile wears its neighbour's ground by a chance
  falling from 0.7 at the border (a noise of its own, read in old coordinates), half the time with that ground's mark
  (an oak, a giant, scorch). Step 7's re-flood after each dig is incremental: the same map (hash proved), 1.2 s to 0.8 s.
- 39-worldblend: the Wolfwood and jungle edge dither six old rows each side (about nine new); the camp ring and the
  quarry's spill eight tiles; Hollowford's burn eight out and four in.
- 37-dragonkillers: the Ashfields' east wall is laid unbroken (each row takes every tile from the last row's column to
  its own, the top carried up to the rim's end). On its pin it stepped diagonally and the corner by the rim's east end
  was sealed only by the luck of the scatter: a widened dither re-rolled it and the Ashfields were reached round the
  Warden's gate.
- 02-world: a one-wide spur that steps diagonally takes the corner tile; 25-elves treads every road through the jungle.
  The Bandit Track's toll (262,158) was walled in by giants.
- 01-atlas: `saltmere.huts` is 251,72 (section 5's 256,72 is the Grey Sea at the spread; the Coast Path laid a line of
  dirt into the sea).
- 93-spread: every aggressive spawn 6+ tiles off a main road. Twelve moved (goblins by the Cave Road, wolves by the
  Wolfwood and Long Roads), each to the nearest open ground of its own region with open ground all round (a new game
  clears the 3x3 about a spawn, and a wolf moved beside the scarp cut the seal open that way). The roads' own fights
  stay: the camp, the outposts, the bandit hills, the lair, Hollowford's occupiers (the Long and Goblin Roads meet in
  its square; a deviation from section 4's list) and the Ashfields' dragons on the Ash Road.
- 02-world: `regionAt` asks the outlines directly once they are on (section 12).
- 90-canyon: the Redcut's wiki page printed the old map's numbers ("THE MOUTH, x 215 y 103"); it reads them through the
  Redcut's frame now. 28-thefang: the lair is "in the far west of dragon country" (it said south; `compass.json`).

**RAILS (51-mounts).** `window.RAILS`: Fennick's rail first, the Glasshouse's and the Old Barrow's reserved (no post
yet), `RAILS.add` for each new place's rail (Stage 5). A rail is visited when the knight stands within 6 tiles of its
post (`player.horse.rails`); thrown off, or fallen, the mare runs to the nearest visited rail and the Voice names it.

**The checks (`src/97-spreadchecks.js`, `window.SPREAD_CHECKS`; `node tools/spread-report.mjs` prints the tables).**
Spacing (36 named places 25+ apart; section 1's exceptions; the drill field, an unnamed lane, and the open grounds are
not named places); the walk-clock; every port reached from the cave mouth (the ferry and the boats as links; held:
Brightwater's landing (blimp), Wreck Rock (boat later), the strait's water, the pond's stepping stones); reach floods
with the Warden's gate, the lair gate, the palisade's gaps shut and on foot east of the strait; the scarp seal (all three
crossings shut: no Wolfwood; each alone: all of it); seam transects; main roads clear (both lanes, gates, doors and the
river beside a bridge aside); aggressive spawns off the main roads; ADDENDUM C's 8-tile edge ring; the beat-gap report;
`regionAt` direct. They read the world as generated (a `generateWorld` wrap keeps the snapshot; the Atlas's pass stays
the last world pass).

**The walk-clock** (an 8-connected walk, root-2 diagonals, no corner cut, story gates open, the Agility steps shut, at
175 px/s):

| Trip | Tiles | Seconds | Window | |
| --- | --- | --- | --- | --- |
| Cave mouth to Fountain Square | 167 | 46 | 40-55 | inside |
| Fountain Square to Hollowford square | 124 | 34 | 45-62 | short, held |
| Fountain Square to Harl's dock | 109 | 30 | 26-40 | inside |
| Fountain Square to the Warden's post | 144 | 39 | 45-65 | short, held |
| Fountain Square to Wren's door | 174 | 48 | 50-70 | short, held |
| Hollowford square to the Sylvaris gap | 106 | 29 | 18-32 | inside |
| Cave mouth to the Fang's Lair gate | 318 | 87 | 100-135 | short, held |

Four trips are short, and **no track point or anchor move fixes them**: section 1's windows were drawn from the roads'
lengths, and the walk-clock is the shortest walk over open ground, which cuts every bend of a road. Hollowford is 112
straight tiles from the square by the goblin-road bridge (45 s is 164); the open Wolfwood lets the walk to the Warden's
post and on to the lair go straight down from the Old Bridge instead of round by the inn; Wren is as far by the open
wood as by the road. Each is held in `WALK_HELD` with its measured time (the check fails on a drift of more than 3 s, or
when the trip comes inside its window) **for the owner's decision**: widen the windows to the open-ground walk, or make
the Wolfwood a wood a knight cannot cut through (the roads its corridors), or move Hollowford south (into Sylvaris'
ring).

**Seam transects** (20 lines across each land seam; a line's mixed run is how deep each ground reaches onto the other's
side, a fade counted whole): wolfwood_jungle median 9, ashfields_jungle (the ash fade) 14, jungle_wilds 9,
hollowford_burn 8, quarry_edge 19; a seam passes on a median of 8+ with at most 5 of 20 lines nearly ruled (under 3:
a road or a ford crossing). This reading of section 6's one sentence ("needs a mixed run of 8 or more") is the
builder's. Exempt: the scarp and the rim (cliffs), the coasts, the river and the Sound (water), the palisade (a story
gate), and the Ash Wastes' edge with the Ashfields (ash both sides, reserved).

**The beat-gap report** (report-only in Stage 4; stops and glances within 10 tiles of the road): longest stop gap and
glance gap on r1_cave 19 / 19, r2_sea 23 / 23, r3_long 29 / 29, r4_goblin 25 / 12, r5_wolfwood 21 / 9, r6_ash 47 / 41
(a builders' plot counts as a glance, not a stop).

**The compass test (`tools/compass.mjs`, run by `build.sh`; `docs/spread/compass.json`).** 70 lines the game says with
a direction or distance word; 73 rows, 40 on the map (each within 67.5 degrees of its word from `from` to `to` on the
Atlas), 33 local (an instance, or the inside of a place that moved whole, or a figure of speech). The weakest on the
map: "a village east of Thistledown" (Hollowford is 50 degrees round to the south-east, as it was on the old map).

**The boot budget (`tools/boot-budget.mjs`).** node `generateWorld` 1.43 s (budget 2.0; 4a was 1.85 s before 92's
incremental re-flood); Chromium at 4x CPU 3.84 s (budget 4.0: little room); workerd from `tools/sim-bench.mjs`
(local `wrangler dev --local`, never a live Worker): the overworld copy boots in 2.57, 2.75 and 3.11 s inside workerd (budget 3.5: little room) and the isolate holds 17.8 MB with the overworld (budget 45).

**Re-baselined counts** (each with its reason in the check): 11-main's Ashfields open ground, lava and obsidian, and
27-dragons' lava and obsidian, as shares of dragon country (3x the tiles); 92's rim (x1.62) and jungle-wall (x1.56)
counts; 93-ashedge's charred trees (x2.5); 39's coast sand rim (x1.6); 61-markers' map image sizes measured at
400 x 280. Checks the new land's luck had broken, made to hold: 11-main's jungle density measured from eight tiles in
(its edge blends now); 58-underground's open count three in four (the wood's thickness is the density match's);
32-beast rams along the side with open ground; 29-quests fishes in peace; 16-instances hears the place names and no
person (people are markers).

**Proved on the 4b build** (7 Oct 2026): `./build.sh` (literals gate 142 files, 0 bare; compass all hold); `node
tools/headless.js` ALL 1364 PASS; `--play` ALL 1365 PASS (stage 16, nothing forced, the Fang dead); `node --test
online/test/` 295 pass; atlas-drift (atlas.json regenerated, hash bd8d810602a3fcac); build-sim `--strip --reads` 0 not
on the list (61-maplabels is stripped from the server copy and given back with the drawing in sim-suite's 1b); mmo-sim,
`--room`, `--sim`; dom-keys; mmo-sim-admin; mmo-sim-party; mmo-sim-world; sim-suite ALL 28 PASS; boot-budget all within
budget. Not re-run: `tools/jiggle.mjs --spread-only` (it rehearses the 4a move against d523504; 4b changes the land on
purpose, so its transport and plate counts would name every blended tile).

**Fingerprint.** `docs/spread/baseline-fingerprint.json` is regenerated from this build (4b changes the map on purpose): fingerprint 35efbd8a5f6807fc, `--diff` identical; later stages diff against it.

## Proving "nothing visible changed" (spec §9.4)

```
./build.sh
node tools/fingerprint.mjs index.html --diff docs/spread/baseline-fingerprint.json   # exit 0: identical
git diff --exit-code online/src/atlas.json                                           # byte-identical
```

## The old world's end-of-story save (Stage 3, spec §10 proof 2)

`node tools/spread-old-end.mjs [index.html] [--out FILE] [--tries N]` boots the build headless (fingerprint.mjs's sandbox),
starts a new game, runs 42-playthrough's bot (`PLAYTHROUGH.play()`, real movement, the main quest 0 to 16) to the end,
saves, and writes the save exactly as the game wrote it to `tests/fixtures/spread-old-end.json`; a run that ends short of
stage 16 or had to force a stage is tried again. The committed save (6 Oct 2026, this branch at 6ea7332, world 260x180,
WORLD_V 1): stage 16 with nothing forced, 109947 steps (30.5 game minutes, 1 death), 36 map diffs (STUMP, TREE 5, ROCK 8,
IRON 2, WRECK, PALISADE 4, DOZER_WRECK, BEAST_WRECK, FLOOR 7, DIRT 3, CAVE 3). Stage 4c migrates it on the new build and
asserts that every quest-made tile kind is at its frame-mapped cell.

## The jiggle (Stage 3, spec §9.5): the spread rehearsed

`node tools/jiggle.mjs [--jobs=4] [--only=pond,camp] [--plan] [--anchors-only | --world-only | --spread-only] [--no-spread] [--spread-gate]` makes scratch builds in
`~/.fanglands/work/spread/jiggle/` (never committed) and writes `report.json` there. The tool's header says exactly what it
checks; in short:

- **The base** is the game at MAP 266x186 with the Atlas at identity, and beside it **eight controls** that move nothing and
  only skip 1..8 of the world's shared dice. The bigger map re-rolls the core scatter, so the base and every control already
  fail some checks on the luck of the scatter (12 of 1344 on the base, 6 to 16 on a control; e.g. three Grub Yard spawns
  walled in, the Far Shore's stormstone rocks without a side to stand on, a tree against the ash). A check is red in a moved
  build only when it fails there and passes on the base and on every control, and still fails in 2 of 3 re-rolls of that
  move. Those luck-bound checks are blind in the jiggle; Stage 4b meets the same re-roll at 400x280 and has to make them
  hold (NEXT WEEK list).
- **Each anchor in turn** moves by (+-3, +-2) with signs that keep its box in the map and clear of every other box; a
  neighbour it cannot clear moves with it (the overlapping old boxes: Thistledown, Hollowford, the quarry and the signpost
  move as one; so do the camp, the dock and Gull Isle; and the stone circle with the warden). Per move: the whole headless
  suite, mmo-sim and dom-keys; TRANSPORT (every positional fact of the moved place = old + offset, every other one stays
  put); PLATE (every non-scatter tile inside the box, less its 3-tile dither rim, = the base tile shifted; counted apart:
  the jungle's and the Ashfields' own ground, which section 2 calls world, tiles the controls re-roll, and tiles within 2 of
  a world seam that crosses the box, of which the run reports how many match anyway).
- **Every anchor together with WORLD x1.1** (MAP 286x198): the suite, mmo-sim and dom-keys, every place's facts moved by
  its shift, and the seam pins: the rim gate open, the giants' gap open, the graveyard's steps cut in the scarp
  (SCARP_STEPS at the port `graveyard.steps`, open ground above and below; until the second review a plain CLIFF at the
  port passed, while the steps stood elsewhere).
- **The real spread** (since the second review): every anchor at its section-2 `to`, MAP 400x280, WORLD per section 3.
  The passes above move an overlapping pair as one (Thistledown and Hollowford, the camp, the dock and Gull Isle, the
  warden and the stone circle, the Far Shore and the Redcut) and give the x1.1 world one shift per group, so a literal
  framed in the wrong member of a pair never shows there; here every place moves by its own shift. Against its own base
  at 400x280 (nothing moved) and two controls: the suites, every place's facts by its own shift, each place's plate and
  the seam pins. It rehearses Stage 4a, which still has work of its own there, so it is printed and kept in
  `report.json` but counted in the exit code only with `--spread-gate`.

Run of 6 Oct 2026 on spread/s2 (master 3b6d6b4 merged), 7198 s with 4 jobs: **all green**. The run before it found one
literal the count could not see (75-coop's test held the summoning circle as the string `'[18,117,4]'`), red when The
Fang's lair moved and in the x1.1 world; fixed in 6ea7332 and proved at identity before this run.

| anchor | moved with | offset | transport (moved/kept/relative/red) | plate (equal/checked) | suite (fails not on base or a control) | mmo-sim | dom-keys |
|---|---|---|---|---|---|---|---|
| quarry | - | -3,+2 | 70/1275/0/0 | 34/34 | 0 | green | green |
| signpost | - | -3,+2 | 74/1271/0/0 | 1/1 | 0 | green | green |
| pond | - | -3,+2 | 11/1334/0/0 | 72/72 (42 of 43 river tiles match too) | 0 | green | green |
| drill_field | - | +3,+2 | 1/1344/0/0 | 0/0 (open grass) | 0 | green | green |
| thistledown, hollowford | each other, quarry, signpost | -3,+2 | 698/646/1/0 | 2208/2208 (134 of 151 scarp and river tiles match too) | 0 | green | green |
| camp, dock, gull_isle | each other | +3,-2 | 36/1309/0/0 | 303/303 (40 of 42 shore tiles match too) | 0 | green | green |
| ironclad_isle | - | -3,+2 | 8/1337/0/0 | 174/174 (141 of 141 seam tiles match too) | 0 | green | green |
| far_shore | redcut | +3,+2 | 268/1077/0/0 | 4496/4496 (218 of 218) | 0 | green | green |
| redcut | - | +3,+2 | 212/1133/0/0 | 3206/3206 (16 of 16) | 0 | green | green |
| graveyard | - | +3,-2 | 5/1340/0/0 | 2/2 (3 of 3) | 0 | green | green |
| deepholm_rock | wren | +3,+2 | 194/1151/0/0 | 25/25 | 0 | green | green |
| wren | - | +3,+2 | 193/1152/0/0 | 25/25 | 0 | green | green |
| stone_circle, warden | each other | -3,+2 | 38/1302/5/0 | 10/10 (66 of 83 rim and wall tiles match too) | 0 | green | green |
| watchtower | - | +3,+2 | 1/1344/0/0 | 15/15 | 0 | green | green |
| ash_shrine | - | +3,+2 | 1/1344/0/0 | 3/3 | 0 | green | green |
| fang_lair | - | +3,+2 | 8/1337/0/0 | 892/892 | 0 | green | green |
| canopy | - | -3,-2 | 1/1344/0/0 | 7/7 (4 of 4) | 0 | green | green |
| sylvaris | - | +3,+2 | 6/1336/3/0 | 206/206 (37 of 37) | 0 | green | green |
| every anchor + WORLD x1.1 | every place | x1.1 | 1276/23/0/0 | pins hold: rim gate open (3 steps), giants' gap open (7), steps meet the scarp | 0 (2 area-proportional, re-baselined in 4b) | green | green |

The seam tiles that do not match lie where a world seam crosses a box and stays with the stretched land while the place
moves (Hollowford's top rows under the scarp and the river, the warden's row 95 on the rim's taper, two shore tiles by the
dock): section 2's world, not a place's literal.

**Run of 6 Oct 2026, evening (after the second review; this branch at f5c17c9, then 01fb84d).** The review found the
x1.1 pins proof false (the steps stood at 39,68, not at the port, and a plain CLIFF at the port passed) and the pairs
never moved apart. With the seam pins carried by the port's frame (4b86aea), the steps cut at the port (b369770,
b6b6f23), the stricter steps check and the real-spread pass (f5c17c9):

- the full run at f5c17c9, 9073 s with 4 jobs: every per-anchor move green but the graveyard's (+3,-2: the port on the
  lower row of a two-row face, the steps with cliff above them); fixed in b6b6f23 (the cut goes through) and re-run
  green at 01fb84d (`--only=graveyard`, 1202 s: transport 5/1340/0/0, plate 2/2, 0 new fails). The x1.1 world was red on
  `aerie2`'s updraft notice: the steps at their port 13,71 sat beside the Aerie's Crown stone and the overworld's steps
  hint fired inside the instance; fixed in 01fb84d (the hint waits outside instances) and re-run green (`--world-only`,
  522 s: pins hold, the steps at the port, transport 1276 moved / 0 red, 0 new fails, two luck-bound and two
  area-proportional as before). The other moves do not touch the steps (the graveyard stays put and its port's
  neighbours are open), so their f5c17c9 results stand.
- **the real spread** (`--spread-only` at 01fb84d, 1758 s): pins hold (rim gate open in 3 steps, giants' gap in 7, the
  steps at the port 21,102 in the scarp), transport 1276 moved / 23 kept / 0 red, mmo-sim and dom-keys green. Still red,
  for Stage 4a/4b: plate 8854/8895, the 41 being the Redcut's salt seams and fallen blocks (90-canyon shuffles its seam
  candidates with its own stream after drawing from it for the canyon's edge, so a different land round the box picks
  other seams: 4c's migration must not assume a mined seam keeps its cell); and 5 suite checks new against the 400x280
  base: the river (`blend`, laid anew in 4a), stormstone 11 of 12 standing, the fallen knight's frame with no townsfolk
  drawn (`knight gear`), the Jungle's outline too square (`worldshape`), and the rim's level stretch of 7 tiles
  (`ashedge`, a 4-tile run at x1.62).

Before this review's fixes the real spread failed 36 checks (the review's scratch build); after them 16: the 5 above,
the Atlas's 4 identity tests (by design), 2 area-proportional, 1 that does not hold over the re-rolls, and 4 that fail on
the 400x280 base or its controls too.

## The fingerprint is sensitive (Stage 0 proof, 3 Oct 2026, baseline master e24001a)

One literal changed at a time in a scratch copy of src/ (never committed), built, and diffed against the baseline:

| File | Literal changed | `--diff` names |
|---|---|---|
| 02-world (a building) | house `h2` x 88 -> 89 | `map`, `buildings`, `capital`, `atlas` (first entries: tile 88,26 16 -> 0 ...) |
| 13-ux (a map target) | `MAP_TARGETS[7]` x 152 -> 153 | `map_targets` ([7] 152,30 -> 153,30), `map_hooks` (stage 7, main) |
| 29-quests (a quest position) | the cave notice board `BOARD_TILES[1]` 24,6 -> 24,5 | `map` (tile 24,5 0 -> 106; tile 24,6 106 -> 6) |
| 92-worldshape (an outline point) | the Goblin Fields' bay `!near(x, y, 66, 57, 13, 7)` -> 67 | `map`, `worldshape`, `atlas` (tiles 32,59 ...) |

Second round (the Stage 0 review, 3 Oct 2026; baseline master 4a374f0). The review found tables the fingerprint could
not see. The tool now also hashes the primed map hooks, every night light, every `window.*` handle, and two render
sweeps (every canvas call over the whole overworld at night, on the new game and on a later world). Each of the
review's mutation builds, which the first tool called identical, now differs:

| Mutation (review build) | `--diff` names |
|---|---|
| 95-thistledown lamp light `tc(x)` -> `tc(x + 1)` | `night_lights`, `render`, `render_late` |
| 28-thefang summoning-circle light `tc(CIRCLE_T.x)` -> `+ 1` | `render`, `render_late` |
| 50-economy Fennick target 116,27 -> 117,27 | `map_hooks` (orders.taken primed) |
| 95-thistledown sundial target 133,18 -> 134,18 | `map_hooks` (capital.bell 3 primed) |
| 31-rebuild rebuilt Tam 137,81 -> 138,81 | `render_late` (the view centred on tile 135,80) |
| 20-hollowford WRECK_SPOTS 144,47 -> 145,47 | `render_late`, `late_diffs` |
| 63-house return STEP 117,18 -> 117,19 | `exports` (HOUSE.STEP) |
| the four together (combo4) | `map_hooks`, `night_lights`, `render`, `render_late` |

The unmutated review build and this branch are identical to the baseline; two runs of one build give the same hashes
(clocks and dice are fixed for the new game and the sweeps). Only HOOKS.mapTarget 73-players (a friend you follow) and
77-dropparty (a live party's crackers) answer nothing in every primed state; both are positions sent by the server, not
the map's. `--diff` prints them as notes, with the handles that differ between two boots (CAPITAL, KINGDOM: by name only).

Notes on the first proof:
- 29-quests places no NPC of its own (its people are 02-world's, by id); the notice board's tile is the position it
  owns, so that is the literal moved.
- A first try at 92 moved the Goblin Fields' east headland `near(x, y, 150, 52, 10, 8)` by one tile and the fingerprint
  did not change: that lobe lies wholly inside the region's own noise band, so the outline it ORs in was already there.
  Moving a literal that changes nothing on screen is, rightly, not a visible change.

## Overlapping old boxes: decided and open (for the owner or the spec author)

Seven pairs of old boxes overlap. "Smallest box wins" alone can split one thing between two places that move apart at the
spread (Gull Isle's mooring: the boat at 170,13 in dock's frame, +103,+9, and Harl at 172,13 in gull_isle's, +110,+5, end
up 9 tiles apart). So a tile inside two or more boxes has a place only when it is DECIDED: by an `OWNERS` rect in
`src/01-atlas.js` (with its reason) or by a port at that exact tile. `anchor-of` prints OVERLAP (exit 1) for any other
such tile and `frame-codemod` refuses it, and also refuses any line whose literals name two places. The in-game
`ATLAS.anchorOf` flags it (`overlap: true`).

Every overlap tile is decided (6 Oct 2026; the Stage 3 decisions by the built structure each tile is part of, each
OWNERS rect with its one-line reason in `src/01-atlas.js`). A probe over every tile inside two or more boxes finds none
undecided.

| Overlap | Old tiles | Decided |
|---|---|---|
| quarry / thistledown | 70..72 x 12..16 | the cow pen 72..80 x 14..21 is thistledown (OWNERS; spec section 2 lists the pens under thistledown); the open grass north and west of it (70..72 x 12..13, 70..71 x 14..16) is thistledown too: nothing of the quarry's is built south of row 12 |
| dock / gull_isle | 168..171 x 8..20 | Gull Isle's mooring 170..171 x 12..14 is gull_isle (OWNERS; the spec author's decision, Stage 2): 26-boats `LOC.gull` (boat 170,13, lantern 171,12, planks 171..172 x 12..14, Harl 172,13, landing 173,13) moves as one with the isle; the port `dock.boat2` became `gull_isle.boat`. The water of the channel: x 168..169 is the dock's (off its end, where its own boat lies), x 170..171 gull_isle's (the mooring's columns) |
| dock / camp | 156..161 x 17..20 | 156..159 is the camp's (the palisade's north wall, PALISADE 156..158,20, drawn in its frame, and its corner); 160..161 the dock's (the shore east of the palisade's end, inside the dock's keep-clear) |
| thistledown / hollowford | 120..141 x 59..61 | all thistledown: the south pond and its shore 128..140 (OWNERS; the spec author's decision, Stage 2: 02-world draws it in Thistledown's frame), the river and the scarp's foot west of it (120..127) and the grass east of it (141), on the town's side of the river; Hollowford's ruins start at row 69 |
| graveyard / deepholm_rock | 6..19 x 72..73 | row 72 is the graveyard's (its gate row, the port `graveyard.gate` 13,72, inside its keep-clear); row 73 deepholm_rock's (the first row of the reclaimed Deepholm wood) |
| wren / deepholm_rock | 25..26 x 73..83 | deepholm_rock's: the east edge of the reclaimed wood (58-underground's rectangle to x 26), west of Old Wren's hut and yard |
| warden / stone_circle | 54..66 x 90..92 | rows 90..91 are the stone circle's (its south stones 58,90 and 62,90 and the clear ground round it); row 92 the warden's (the open row above its tree line and notch, inside its keep-clear) |

