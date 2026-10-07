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
wrap its spots before it merges after the spread (feat/teacher-view's `tools/teacher-browser.mjs` held 14 bare spots
on 6 Oct; feat/teacher-live reads every one through the game's own Atlas (`spotsFromGame`) and is in `converted.json`).

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

**Walk-clock on this map, for 4b** (the shortest walk over open ground at a knight's foot speed, in seconds: a lower
bound, not the bot's walk; 4b's walk-clock below gives both; the spec's windows):

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

| Trip | Tiles | Seconds (shortest) | Seconds (walked) | Window | |
| --- | --- | --- | --- | --- | --- |
| Cave mouth to Fountain Square | 167 | 46 | 52.3 | 40-55 | inside |
| Fountain Square to Hollowford square | 124 | 34 | 38.7 | 45-62 | short both ways, held |
| Fountain Square to Harl's dock | 109 | 30 | 34.1 | 26-40 | inside |
| Fountain Square to the Warden's post | 144 | 39 | 43.9 | 45-65 | short both ways, held |
| Fountain Square to Wren's door | 174 | 48 | 52.7 | 50-70 | short as the shortest; INSIDE when walked; held |
| Hollowford square to the Sylvaris gap | 106 | 29 | 32.4 | 18-32 | inside as the shortest; 0.4 s OVER when walked |
| Cave mouth to the Fang's Lair gate | 318 | 87 | 107.1 | 100-135 | short as the shortest; INSIDE when walked; held |

"Shortest" is the walk-clock: the shortest 8-connected walk over open ground, a lower bound. "Walked" is the game's own
bot (`FANGLANDS.walkTo`, every story gate open, 60 frames a second, a knight's foot speed), measured by the review of
c34fddf and again on the fixed build (the same to 0.1 s): it walks round what the shortest walk cuts by a hair. On the
mare each trip takes exactly half (Hollowford 19.4 s, the lair 36.0 s).

**For the owner, both numbers:** on a real walk Wren (52.7 s) and the lair (107.1 s) are already inside their windows,
Hollowford to the Sylvaris gap (32.4 s) is just over its 32, and Hollowford (38.7) and the Warden (43.9) stay short. As
the shortest walk four trips are short, and **no track point or anchor move fixes them**: section 1's windows were drawn from the roads'
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

**The boot budget (`tools/boot-budget.mjs`).** (Superseded by the review's fixes below: 92's step 7b grows its floods
instead of flooding again, and the budget is a gate in `build.sh` on the slowest run.) At 4b: node `generateWorld` 1.43 s
(budget 2.0; 4a was 1.85 s before 92's incremental re-flood); Chromium at 4x CPU 3.84 s as a median of warm runs (budget
4.0; the review measured 7 of 13 runs over, every first run); workerd from `tools/sim-bench.mjs`
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

## Stage 4c: THE SAVE MIGRATION (feat/spread)

Built on 4b (ff826c0), 7 Oct 2026. Not deployed. The owner's decision (2 Oct): every knight goes back to spawn; quest
progress is kept; what the story changed is made again from quest state; everything else placed or changed on the old map
is cleared, and what he placed comes back.

**The versions.** `WORLD_V` 2, `WORLD_REV` 0 (`src/00-core.js`); `save()` writes `worldRev` beside `worldV` and `mapW`.
`load()` runs `HOOKS.saveIn` for a save below `WORLD_V` (or, later, below `WORLD_REV`); a newer world's save is refused as
since Stage 0. `ATLAS.REVS` (empty) holds the later stages' footprints.

**`src/97-spread.js`** (`window.SPREAD`):
- `SPREAD.prepare(d)` (HOOKS.saveIn): the old `mapDiffs`, `crops`, `regrow` and `fires` come out of the save, decoded with
  the old width (`mapW`, or 160 with none) into old x, y and the tile's NAME, so the core never lays an old index on the new
  map; `player.cityV = 1` (95's own capital pass has nothing left to move); the old region, walk path and tied mare are
  cleared. It holds `SAVE_LOCK` (with `SAVE_KEPT`'s words) until the knight stands in the new world: no save, here or to
  the cloud, can write a half-moved knight. (A save made inside a dungeon or on the island already holds the step outside:
  16-instances' save; there is no other inside-record to clear.)
- Its load wrapper is the outermost (97 sorts after 96); `SPREAD.finish()` then:
  - the knight: off his machine (the walker, bulldozer or Barrelbeast is parked, its hp kept as `exitMech` keeps it; the
    mare is tied), bed and home cleared, at the Fountain Square (`VILLAGE_SPAWN`) if he has been to Thistledown or is at
    stage 5 or more, else at the cave's `SPAWN`, facing south, region and banners cleared;
  - `quest.markers.seen` keys through `oldToNew` (open land through the world), kept where that marker stands;
    `player.chests` through `oldToNew` (dropped on open land); `quest.fang.looted` through the lair's frame; graves and the
    night's grave tally cleared; the boats at the mooring; `quest.hollowford.wreck` moved;
  - every `HOOKS.remake`, recording the cells each one changed;
  - the old diffs sorted by NAME: (d) a story tile already made again at its frame-mapped cell; (b) `SPREAD.MACHINES`
    (`MECH`, `DOZER`, `BEAST`, `WRECK`, `DOZER_WRECK`, `BEAST_WRECK`) parked round the Bulldozer bay (the port
    `thistledown.dozer_bay`, in the smithy yard behind Brakka's) with 95's `parkSpot` rings (`CAPITAL.parkSpot`, 1..8 then
    1..16; past that any open ground within 40, and none at all throws: the save is kept, never a machine lost), each cell
    tried nearest first and taken only if the parking keeps the town's walks (the review's fix, below: nothing it touches
    is anything the world built, and a flood from the square still reaches every cell it did and a free side of every
    parked machine); `HORSE`: Cinder tied at Fennick's rail the same way; (c) crops: a growing one gives its
    seed back, a ripe one 3 of its harvest (the middle of a harvest's 2 to 4: no dice); a tile the new world already has
    at that cell is left; (a) a tile some item places (`HOOKS.placedFrom`, then `ITEMS[id].place`, 95's
    `placedItemFor`) comes back: to the bank, else the pack, else `quest.spread.owed`; (e) everything else is dropped
    (regrown trees and rocks, stumps, rubble, soil, fires, mined seams, cleared ground; and the regrowth and fire lists);
  - the Voice, once: "While you slept, the land grew and settled. You wake in Thistledown." (or "in the cave"), "Back in
    your bank: 3 planks, a lodestone and a bed.", "In your pack: ...", "Aldous the banker is keeping a bed for you. He hands
    them over when your bank has room.", "Cinder is tied at Fennick's rail.", "Your walker, 2 bulldozers and 12 walker
    wrecks wait round the Bulldozer bay, behind Brakka's smithy.";
  - `quest.spread = { v, at (his play seconds: no clock, so the output depends on the save alone), from, refunds, parked,
    mare, remade, dropped, owed, lines, told }` (spec section 10's `d.spread`, kept on the quest so the save carries it);
  - lets go of `SAVE_LOCK` and saves: worldV 2 from then on, so a second load changes nothing.
- The NEW WORLD page (`HOOKS.panel.newworld`) opens by itself once the Voice is done (a NEW WORLD plaque stands in the
  column until then): the same lines, an "Open the map" plate (a full row tall) that opens the map on the gold ring of his
  next quest step, and Close. Its panel-audit scene passes at all 8 sizes, touch and mouse, normal and large text.
- Aldous pays out what he keeps on each bank visit (the bank panel opening, the island's chest too), as many as fit, and
  says "I am keeping some of your things for you. Make room in your bank and I will hand them over." while any are left.
- worldRev sweeps: a save of this world with an older `worldRev` has only the diffs inside `ATLAS.REVS`' boxes taken out
  and sorted the same way (`SPREAD.sweep(boxes, ground)` does it to the live game for the self-test); the knight stays.
- `SPREAD.HANDLED`: every place in a save that holds a map position, and what the migration does with it.

**HOOKS.remake** (each says nothing, pays nothing, saves nothing, and runs twice to the same map):
| File | Reads | Makes again |
|---|---|---|
| 35-night | `quest.night.crypt` | the crypt door at `graveyard.crypt` |
| 37-dragonkillers | `quest.dk.gate` | the warden's gate tiles as dirt |
| 28-thefang | `quest.fang.gateOpen` | the lair gate as cave floor |
| 20-hollowford | `hf.freed`; `hf.wreck` | the chapel bars as floor; the beast's wreck at its moved cell (or the first free spot by the War Shed), while it still lay there on the old map (`SPREAD.remaking.wreckLies`); a rebuilt beast is a machine and is parked |
| 31-rebuild | `quest.rebuild.done` | each project's tiles (`TILES_OF`, split from what the project says and pays) |
| 41-guild | `quest.guild.founded` | the hall (its rank changes no tile) |
| 33-goblincity | `quest.tinker.stage >= 3` | the lever, on the overworld only in a build without instances |
| 69-axestump | `player.tookAxe` | the empty stump |
| 95-thistledown | `quest.capital` | nothing: made from quest state at world generation; the coverage proof finds no story tile left in Thistledown's box |

**The changeTile classification gate.** `docs/spread/changetile.json` counts every `changeTile` call in src/ (211 in 40
files) with what it writes and how the migration treats it, and names the file whose remake makes a story tile;
`tools/changetile-gate.mjs` (in `build.sh`) fails on a changed count, an unlisted file, or a story file without a
`HOOKS.remake`. Proved by mutation: one more call in 45-progression fails it, and so does 35-night without its remake.

**The proofs** (`node tools/spread-migrate-check.mjs`, spec section 10 proofs 1-4). Each save goes into the slot and
through `title.startSlot`, as on a page; each must keep its stage and every other flag and count of the old quest and
knight (bar the positions section 10 moves), lose no item (pack, bank, gear, Death's chest and Aldous's keeping, at least
the old number of each) and no coin, keep every machine (each kind counted, the ridden one included, each parked within 40
of the Bulldozer bay) and the mare (tied, within 8 of her rail), keep the town's walks (from the square a knight reaches
every person, door, marker and station a fresh game reaches, and a free side of every parked machine and the mare), wake on a walkable tile by the right spawn, be stamped worldV 2
/ worldRev 0 / mapW 400 and unlocked, change nothing on a second load, and pass the sweep.
1. The synthetic matrix: `tools/spread-old-saves.mjs` makes 24 old saves on the Stage 3 build (d523504, 260 x 180, WORLD_V
   1) with the old game's own rules (`tests/fixtures/spread-matrix.json`): tutorial, mid-story, end-game, bank full, bank
   and pack full (owed), riding the walker, riding the bulldozer, riding the mare, the mare out in the Wolfwood, a bed and a
   lodestone home, crops and fires, the crypt open, the warden's gate, the bars freed, the lair gate, Hollowford rebuilt
   through Nell's board (every project), the guild at its top rank, the beast rebuilt, the beast ridden, the wrecks with Sera
   following, inside the Spider Den, on the island, a pinned save from the 160-wide map (no mapW, no worldV), a fallen
   knight. Planks and doors go on the island only since 3 Oct (64-island), so the generator lays an old plank or door with
   the old game's own changeTile, as Q did before. All 24 pass.
2. Coverage: `tests/fixtures/spread-old-end.json` migrated: FLOOR 7/7 (the bars), DIRT 3/3 (the warden's gate), CAVE 3/3
   (the lair gate), STUMP 1/1 (the axe), BEAST_WRECK 1/1 at their frame-mapped cells; 5 old diffs in Thistledown's box, no
   story tile among them. The rebuilt and founded saves remake 195 (31-rebuild) and 42 (41-guild) tiles; one old cobble of
   the square is not re-paved: Stage 4a's road signpost stands on that cell (old 140,78, new 226,131).
3. The sweep: every position-shaped value (a number pair, `{x, y}`, `{tx, ty}`, `'x,y'`) of every migrated save is on
   `SPREAD.HANDLED`: player, facing, companion, horse.at, chests, house.grow (the island), dwarf.chests and
   instances.chests (instances), hollowford.wreck, markers.seen.
4. The real saves: the pre-spread-s23 admin export (`~/.fanglands/work/spread/saves-export.json`, used locally only; the tool
   reads `saves` and `save_pins` and prints knight names, stages and counts only): all 94 saves (93 versions of 31 knights and the one pin) pass, with 0
   stage changes and 0 lost machines, items or coins. 63 wake on the Fountain Square, 31 in the cave (knights below stage 5
   who never reached Thistledown); 174 machines and wrecks parked (on c34fddf all within 2 tiles of the bay, walling Brakka's yard off for 4 knights;
after the review's fix within 3 tiles for 12 saves, 12 for 6, 13 for 3 and 15 for 3, every walk kept), 12 mares tied
   (within 1 of the rail), 13 saves get things back in the bank, nothing owed. The per-knight table:
   `node tools/spread-migrate-check.mjs --export ~/.fanglands/work/spread/saves-export.json` (281 s).

**Gates on the 4c build** (logs in `~/.fanglands/work/spread/s4c/gates/`): `./build.sh` (literals gate 146 files, 0 bare;
changetile gate 211 calls in 40 files); `node tools/headless.js` ALL 1369 PASS; `--play` ALL 1370 PASS (stage 16, nothing
forced, the Fang dead); `node --test online/test/` 295 pass; atlas-drift (atlas.json unchanged, bd8d810602a3fcac);
build-sim `--strip --reads` 0 not on the list (97-spread's read of `title.active` listed); mmo-sim ALL 43, `--room` ALL
43, `--sim` ALL 47; dom-keys ALL 16; mmo-sim-admin ALL 8; mmo-sim-party ALL 18; mmo-sim-world ALL 16; sim-suite ALL 28;
spread-migrate-check 25 of 25 and the real saves 94 of 94. Fingerprint: only the exports table changed (the new
`window.SPREAD` and the NEW WORLD panel scene), the map's tables identical; the baseline is regenerated from this build
(0219e531c2f1d5f6).

## Stage 4d: THE SERVER (feat/spread)

Built on 4c (85491d1) with master merged in twice (5bdc8b3, fix/idle-requests; then 8ff3459, the teacher view), 7 Oct 2026. Not deployed, not pushed. The
contract is docs/ONLINE.md, "The Great Spread on the server".

**What changed.**
- `online/src/world.js`: `PUT /api/save` answers `409 {error: 'stale_world', code: 'stale_world'}` when the knight's newest
  save is from world 2 or later and the incoming one is from a lower world (none is world 1), and stores nothing. The
  parent page's rollback and an admin's pin and restore bypass it on purpose. `GET`/`POST /api/admin/spread-parties` lists
  and ends the overworld's live drop parties for the deploy step.
- `online/src/room.js` (`mapKey`, `STALE`): a page whose hello names another Atlas (or none) is keyed `<map>@stale` on every
  map, so it never shares presence, keepers, monsters, crackers or trades with the new world; `online/src/move.js`
  `wireMap` names the map to the game as it knows it. Re-keyed after a nap by the world's Atlas.
- `src/72-cloudsave.js`: a push refused as `stale_world` locks the page (`SAVE_LOCK`) and says "This page is older than the
  world. Reload." (self-test in the file).
- `tools/spread-deploy-step.mjs`: the drop-party step (dry run unless `--yes`; stops unless the world runs this tree's Atlas).
  Run only inside the owner-approved deploy.
- `tools/spread-two-pages.cjs`: the two-browser proof against a LOCAL `wrangler dev`.
- `online/test/atlas.test.mjs`, `move.test.mjs`: the size, anchors and ports read from atlas.json; no 260, 180, 250 or 170.
- atlas.json: already regenerated at 4a (400 x 280, `v` 2, `anchors`, `ports`; hash bd8d810602a3fcac, 47.1 KB); 4d and the
  master merge do not change it (atlas-drift matches).

**The teacher view (master 8ff3459, merged in after the first 4d commits).** Its kids' rows and Watch read positions
through the Atlas: a kid on an older world's page has no dot and "Somewhere in the world" (`online/src/watch.js`), and
the keeper message names the map his game knows (`online/src/sim/worlds.js` `wireOf`). Its tests and tools read the
spread's places: `online/test/teacher-kit.mjs` (a kid's hello names this world's Atlas), `watch.test.mjs` (Hollowford's
square port), `teacher-labels.test.mjs` (the cave mouth and quarry cart, Thistledown's square and the War Shed's door);
`tools/teacher-browser.mjs` (the crowd's hello names the Atlas). Two fixes in `src/79-teacherscreen.js` layoutLabels: a
name's own centre is checked on whole pixels (a candidate on the edge of a narrow place rounded onto the next one's tile:
Wolfwood at 1024x768, zoom 1.5), and a big place's name may be 1.5 times its width (1.1 for the rest). At a 1280 x 650
window at 125% the whole map cannot hold Thistledown's name clear of a class standing in it (the count circle covers the
town's middle at 1.15 px a tile); the name gives way and comes back one zoom step in: the test and the browser check say
so. FOR THE OWNER: if the teacher should always see Thistledown named at the whole map, the knights' dots or the map's
whole view would have to change (a later decision; the teacher view's own branch).

**The workerd boot.** `node tools/sim-bench.mjs` (a local `wrangler dev --local`, never a live Worker), then
`node tools/boot-budget.mjs --workerd <bench.json>`: on the final 4d build the overworld copy boots in 2,385, 2,607 and
2,408 ms inside workerd (budget 3,500), the isolate holds 28.3 MB with the overworld (budget 45), node's generateWorld
1,447 ms (budget 2,000); the first 4d build measured 2,865, 2,895 and 3,017 ms and 24.5 MB. All inside, so no
`online/src/world-<hash>.bin` snapshot (spec §7 writes one only when over). The margin is about 0.9 s. After the review's fixes
(below): 1,370, 1,479 and 1,317 ms, 35.9 MB (the heap read moves by several MB from run to run), node 1,062 ms at its
slowest; the margin is about 2 s.

**The proofs** (logs in `~/.fanglands/work/spread/s4d/`).
- The two-browser proof (`two-pages-final.txt`, screenshots in `shots/`): on a local `wrangler dev` (port 8812, `--var`
  keys, its own persist folder), the OLD page is master's build (`git show master:index.html`, 8ff3459, world 1, Atlas
  ea36148040c3f60c) and the NEW page this tree's (Atlas bd8d810602a3fcac). All 15 checks pass: Ann (old) and Ben (new) never
  hear each other while Dot (old) hears Ann and Eve (new) hears Ben; each side keeps its own monsters; the parent page sees
  `old` and `same`; the old page shows the NEW WORLD plaque; Ann's old page saves (200, world 1); the new page moves her
  knight and pushes it (world 2, kills kept); the old page's next push gets 409 `stale_world` and the world keeps world 2;
  the old page reloads into the new build with her knight moved once, not twice; then Ben hears her.
- The deploy step (`deploy-step-proof.txt`): on the same local world, a party on the overworld (one cracker lit) and one in
  the Spider Den. The dry run lists the overworld one (4 unlit, 1 lit); `--yes` ends it, writes one `mod_log` row, and a
  second run finds nothing; the Spider Den party is kept; the lit cracker's prize comes with Sam's next welcome. Against a
  world on another Atlas it stops with exit 2 and changes nothing.
- Tests: `online/test/room.test.mjs` (the stale keying, a nap, a world with no Atlas), `accounts.test.mjs` (the 409 guard with
  the rollback and the pin; the spread-parties endpoint and its key), `party.test.mjs` (the step in the Room), and
  72-cloudsave's self-test (a 409 locks the page and says so).
- The real saves again on the merged build: `node tools/spread-migrate-check.mjs --export
  ~/.fanglands/work/spread/saves-export.json` (local only): 94 of 94 pass, 0 stage changes, 0 lost machines, items or coins.

**Gates on the final 4d build** (both master merges in; `gates/`): `./build.sh` (literals gate 153 files, 0 bare;
changetile 211 in 40 files); `node tools/headless.js` ALL 1402 PASS; `--play` ALL 1403 PASS (chapters 1-14, the Fang dead,
nothing forced; the run before it had two one-off fails, cinderwight's scald roll and the admin chip at phone sizes, both
green on the re-run and untouched by 4d); `node --test online/test/` 429 pass; mmo-sim ALL 43, `--room` ALL 43, `--sim` ALL
47; dom-keys ALL 16; mmo-sim-admin ALL 8; mmo-sim-party ALL 18; sim-suite ALL 28; mmo-sim-world ALL 16; mmo-sim-teacher 9 of
9; teacher-browser 103 of 103 (a local world); build-sim `--strip --reads` 0 not on the list; atlas-drift matches
(bd8d810602a3fcac, unchanged); fingerprint identical to the regenerated baseline (59392fdc15bea8f2; the merges moved only
the exports table); spread-migrate-check 25 of 25; the real saves 94 of 94; the two-browser proof 15 of 15.

### The owner's test on the test world (when the hold is lifted and he says go)

Before: the deploy script takes a backup (`~/.fanglands/backups/<time>-pre-spread-s4-test/`: the export and a bookmark).
Then `~/.fanglands/tools/deploy-test.sh ~/fanglands-wt/spread` (it runs every gate first; it refuses while
`~/.fanglands/test-world.hold` exists).

1. Before the deploy, on the iPad and on the laptop, open https://test.fanglands.com/?online and log in with a test knight
   that has played a bit (has a house item placed, a horse, or a machine if possible). Leave the iPad page open.
2. Deploy (Claude does this after the owner says go).
3. On the iPad (the old page, not reloaded): a plaque "NEW WORLD - A newer world is ready" shows. The knight still walks;
   other knights on new pages do not appear.
4. On the laptop, reload. The Voice says the land grew while he slept, and where he wakes (Thistledown's square, or the
   cave for a very new knight). The NEW WORLD page lists what came back to the bank, where the mare is tied, where the
   machines are parked. Check the bank.
5. Back on the iPad (still the old page): walk a few steps and wait 20 seconds. Nothing he does there is kept. After three
   tries it says "Could not reach the world"; that is expected on a page from before the spread.
6. Tap the NEW WORLD plaque on the iPad (or reload). The knight is the same as on the laptop: same place, same bank. The
   iPad never undoes the move.
7. Two knights at once: one on a new page, one on an old page in another browser. They do not see each other, and each
   has his own monsters. After the old one reloads, they see each other.
8. Look at the map (M) on the iPad and the laptop: labels readable, the new places staked ("Builders' stakes").
9. Tell Claude what looked wrong. Nothing on the live world changes from this test.

### The live release checklist (only with the owner's go, nobody online)

1. Backup: `GET /api/admin/export` and `GET /api/admin/bookmark` to `~/.fanglands/backups/<time>-pre-spread-live/`
   (export.json, bookmark.json). Check the export opens and counts the accounts and saves.
2. Nobody online: `GET /api/status` says `online: 0` (or the owner has told the kids to stop). A quiet hour (not school
   time, not work hours).
3. The export check: `node tools/spread-migrate-check.mjs --export <that export.json>` on this build. Every save must pass,
   with 0 stage changes and 0 lost machines, items or coins. Any fail stops the release.
4. Merge master into feat/spread (keep `pattern = "fanglands.com"` and the `HANDOVER` line in online/wrangler.toml; keep
   any other line master has there), `./build.sh`, every gate green (the list in the 4c and 4d gates above), the
   fingerprint baseline regenerated, atlas-drift matching.
5. Merge feat/spread into master (`git merge --no-ff feat/spread`), tag it `spread-r1`, and tag the master before it
   `pre-spread` (the rollback point). Deploy with `./online/deploy.sh` (it refuses a tree without fanglands.com and runs
   every gate). Both addresses must answer.
6. The parties step, at once: `node tools/spread-deploy-step.mjs --base https://fanglands.com --secrets
   ~/.fanglands/online-secrets.env` (dry run: check the Atlas is the new one), then the same with `--yes`.
7. Watch: `GET /api/admin/sim` (every knight `same` once they reload), the parent page's saves for the first knights in
   (each newest save `worldV` 2), the mod log (the party row).
8. Rollback if anything is wrong. Roll forward if you can (fix, gates, deploy): every knight keeps his progress. If the
   old map must come back:
   - Per knight, BEFORE the code goes back (the new server holds them; the old one cannot read them), with nobody online:
     on the parent page, Saves, "Last save from world 1 (the old map, before the Great Spread)", Go back to this one, for
     each knight who has played on the new world. That save is kept apart (`save_worlds`) the moment his first world-2
     save comes in, so it is there after any amount of play (the three kept versions are not: they turn over in about
     30 s of play). Progress made on the new world is lost for that knight; he is moved again on the next roll-forward.
   - Then check out the `pre-spread` tag and deploy it (client and server). Its Stage-0 guard refuses a world-2 save and
     never writes over one, so a knight NOT rolled back above cannot play on the old world until the roll-forward.
   - Or, for the whole world at once, `POST /api/admin/restore` with the bookmark from step 1: everyone's progress since
     the deploy is lost.

## Stage 4: the review of c34fddf, fixed (feat/spread, 7 Oct 2026)

The four-lens review of c34fddf (`~/.fanglands/work/spread/review4-*`) found 2 majors and 9 minors. Each fix has a check that
fails on c34fddf's code; probes and pictures in `~/.fanglands/work/spread/fix4/`.

- **Machines walled off the smithy yard (major).** The migration parked up to 18 machines in Brakka's yard: Brakka, the
  forge, the anvil and the Smithy door were cut off for 4 real knights (all 12 of their saves). Now each machine and the
  mare is parked only where it touches nothing the world built, and only if the town's walks hold (a flood from the
  Fountain Square reaches every cell it reached before the parking, and every parked machine keeps a free side);
  `SPREAD.finish` records `walks: { cut, boxed }` and throws (keeping the old save) should either ever be above 0.
  `tools/spread-migrate-check.mjs` checks it on its own flood: every person, door, map marker and station a fresh game
  reaches, and a free side of each parked machine. 97-spread's self-test parks 18 machines and walks to Brakka, the forge,
  the anvil, the bay and the Smithy door (with the old parking all five are cut off and 16 machines boxed in). The two
  knights the review walked: both walk to Brakka now (the game's own bot, 577 frames), machines within 15 and 12 tiles of the
  bay (`shots/yard-knight1.png`, `yard-knight5.png`).
- **Where the machines are.** The Voice and the NEW WORLD page say "... wait round the Bulldozer bay, behind Brakka's
  smithy." (the game's own panel calls it the Bulldozer bay; nothing was called the Dozer Bay).
- **The walk-clock is a lower bound.** 4a's table is the shortest open-ground walk, not the bot's; 4b's table gives both
  numbers and the owner's decision has both (Wren and the lair are inside their windows when walked; Hollowford to the
  Sylvaris gap is 0.4 s over).
- **The gold ring's place.** When the ring's own words name no place, the named place it stands in is lit (stages 5, 6, 7
  and 11 to 15 lit nothing; `shots/map-1024x768-s12-lit.png`).
- **Chapter 4's signpost.** The Cave Road's first post (71,24) says "→ Thistledown, south-east, past the old signpost."
  (an arm names a landmark its road passes: the old signpost, the Old Bridge, the Crossroads Inn, the goblin bridge).
- **"The Bandit Hills are coming."** A plural name takes "are"; a check reads every plaque.
- **Signpost boards.** A board grows at its tail to fit its word (THISTLEDOWN ran 14 px past its 52 px board; in Chromium
  31 of the 41 arms overflowed, none now; `shots/now-sign-71-24.png`). Only the fingerprint's render tables changed (2
  calls more an arm: the measure), and the exports (SPREAD.reachFrom, BAY_WORDS, MAP_LABELS.placeOf, signBoard,
  SIGN_ROOM): the baseline is this build's, 86da19ec5b8106f9.
- **The per-knight rollback (release step 8).** The World keeps a knight's last world-1 save apart (`save_worlds`) the
  moment his first world-2 save comes in; the parent page lists it and goes back to it (docs/ONLINE.md). Step 8 now says
  to do that on the new server, before the code goes back.
- **The export check and a knight saved at sea.** `quest.boats.sailing`'s fields no longer fail a correctly migrated save;
  the matrix has a knight saved mid-voyage (made by the old game's ferry button): 25 saves.
- **The boot budget (major).** 92-worldshape's step 7b flooded the map again after every dig; it grows its sets now (the
  world byte-identical). generateWorld: node 1,456 to 1,515 -> 1,033 to 1,082 ms; Chromium at 4x CPU 3,764 to 4,211 (over)
  -> 1,575 to 1,977 ms; the cold page boot to the title at 4x CPU 5,915 -> 3,827 ms (said, not gated). `build.sh` runs
  `tools/boot-budget.mjs --chromium` on every build, gated on the slowest run (on c34fddf's page it exits 1).
- **Deepholm's and the Aerie's copies.** They still build the whole overworld (sim-suite check 5: neither builds the same
  without it), so each world-run copy build pauses the Room: about 1.1 s in workerd now (2.2 s on c34fddf, 0.65 on master).
  Measured with `tools/sim-bench.mjs` and `tools/sim-load.mjs --minutes 30` (every pass bar met); docs/ONLINE.md's table.

**Gates on this build** (logs in `~/.fanglands/work/spread/fix4/gates/`): `./build.sh` (literals gate 153 files, 0 bare;
changetile 211 calls; compass all hold; boot-budget node 1,043 ms and Chromium 1,872 ms at their slowest); `node
tools/headless.js` ALL 1405 PASS; `--play` ALL 1406 PASS (stage 16, nothing forced, the Fang dead); `node --test
online/test/` 430 pass; mmo-sim ALL 43, `--room` ALL 43, `--sim` ALL 47; dom-keys ALL 16; mmo-sim-admin ALL 8;
mmo-sim-party ALL 18; sim-suite ALL 28; mmo-sim-world ALL 16 (copy boots Deepholm 1,285, the Aerie 1,277 ms in node);
mmo-sim-teacher 9/9; teacher-browser all 103 (a local `wrangler dev` only); build-sim `--strip --reads` 0 not on the list;
atlas-drift matches (atlas.json unchanged, bd8d810602a3fcac: the world is the same); fingerprint `--diff` identical to the
new baseline; spread-migrate-check 26 of 26 (the matrix and the end-of-story save) and the real saves 94 of 94 (0 stage
changes, 0 lost machines, items or coins, every walk kept); `tools/jiggle.mjs --spread-only --spread-gate` green (transport
1276 moved, 0 red; plate 8883/8883; suite ALL 1405 PASS).

## Stage 5a: THE STARTING CREATURES (feat/spread5, 7 Oct 2026)

`src/87-critters.js` (the rules; on the server's copy) and `src/87-critterart.js` (their look, the icons, the book's words,
the legs a falling body shows; pictures only, in build-sim's STRIP_FILES). Spec §4 "Starting creatures".

| Creature | Lv, hp | Fights | Where (new map) | Drops | Kill xp |
| --- | --- | --- | --- | --- | --- |
| crow | 2, 8 | when hit | the story signpost's meadow: 107,40 107,45 112,37 | crow feather (new), a stolen coin | 32 |
| giant rat | 3, 12 | when hit | the cave meadow: 33,18 35,21 40,17 | coins, bread, potato and wheat seed | 48 |
| snake | 4, 14 | when hit | Miller's Pond's shore: 75,52 78,57 76,62 | snakeskin (new) | 56 |
| adder | 6, 18 | when hit | the pond's quiet west shore: 66,55 | snakeskin, always | 72 |
| wild dog | 6, 18 | at sight 4 | packs of 3: west fields 122,35 124,36 122,37; east fields 219,59 221,60 219,61 | raw beef, wool | 72 |

- Points are written in place frames (the signpost's, the pond's) or as world points (open land). Every spawn is on open
  ground with nothing a new game clears in its 3 x 3 (no tree, rock, flower or mushroom), where 92's outline and its
  region's box agree; Atlas zones goblin_fields (rats, crows, dogs) and miller_pond (snakes, adder).
- Wild dogs: `roam: 2` (07-update: a monster with `def.roam` idles within that many tiles and turns for home the moment it
  is past them; no new dice). Each dog stands 9.7 to 12.3 tiles off the nearest main road's centre line (the self-test
  wants 8.5+ and more than roam + sight + the road's half-width, 7.5), so a knight on the road is never seen; the west
  pack is the Cave Road's beat at about 110 (its nearest dog 9.7 from R1, within 10).
- XP (42-playthrough's melee rows): crow 11,520/h and giant rat 17,280/h at level 1 (the goblin's 22,553/h), snake
  17,280/h from 3, adder 6,480/h and a pack of wild dogs 34,560/h from 5, under the wolf's 48,084/h at 6.
- The look: drawn in the approved sample's hand through `MONSTER_ART.H` and registered with `MONSTER_LOOK.addType` (new in
  78-monsterlook; its self-test now counts the sample's 47 plus the added); crow, snake and adder from above (16 picture
  facings), rat and dog from the side. Boxes measured as 78's were (`~/.fanglands/work/spread/s5a/measure.cjs`, which
  reproduces 78's own wolf, spider and boar boxes). `DEATHS.LEGS` is exported (79-deaths): a falling crow shows two
  legs, a snake none. Icons: crow feather, snakeskin.

**HOOKS.built (new, 00-core; run by 93-spread right after its stakes).** The first build put the spawns in a
`HOOKS.world` pass at 87's place: 92-worldshape and 93-ashedge, which run later, keep each spawn's ring clear while they
draw their own dice tile by tile, so 16 spawns moved flowers and trees on 2,042 tiles across the map (and FIXED_SOLID on
164). Spawned in `HOOKS.built` (after every carving pass and the stakes, before 95's snapshot and 96's Atlas), not one
tile changes. **Stages 5b..5f must build their places there too** (and take their own stakes up there).

**The footprint: WORLD_REV 1.** `ATLAS.REVS[1]` is the 3 x 3 round each of the 16 spawns (87-critters declares it): a
knight's own plank or wall standing there in a world-2 save of rev 0 comes back to him (SPREAD.sweep), so no creature
wakes inside it. `node tools/spread-footprint.mjs <previous index.html>` (new): against master 2e2c023 the world is 0
tiles changed (map and variants), regions, buildings and people unchanged, 16 spawns added, all inside the footprint.
The Atlas hash is unchanged (bd8d810602a3fcac); atlas.json's spawn list gains the 16.

**The migration with the sweep.** `tools/spread-migrate-check.mjs --rev-base <previous index.html>` (new): every save is
first moved into world 2 by the previous build (rev 0, what the live knights hold), then loaded and swept by this one;
on the end-of-story save a plank on the middle of every footprint box (and one far from them) checks the sweep: 16
planks back to the knight, the far one kept. Fixture + matrix 27/27; the real saves (the 7 Oct pre-spread-live export,
locally) 94/94 both straight (world 1 to rev 1) and through rev 0, 0 stage changes, 0 lost machines, items or coins.

**Proved on this build:** `./build.sh` (literals 0 bare, boot budget); headless ALL 1415; `--play` ALL 1416, the Fang dead
(one earlier run failed 76-admin's phone-size ADMIN chip layout check once; the rerun and every other run passed it);
online 430; mmo-sim 43, `--room` 43, `--sim` 47; dom-keys 16; mmo-sim-admin 8; mmo-sim-party 18; mmo-sim-teacher 9;
mmo-sim-world 16; sim-suite 28; build-sim `--strip --reads`; atlas-drift; the footprint; the migration as above. The fingerprint
baseline is this build's (7e1ddf8b81203ce0: the 16 spawns, their drawings and the new exports), for 5b's diff.

## Stage 5b: THE RIVERSIDE (feat/spread5, 7 Oct 2026)

`src/85-riverside.js` (the three places) and `src/83-deco.js` (DECO, Stage 5's one tile). Spec §4 "New places".

| Place | What is there (place frame: `ATLAS.planFrame(id)`, offsets from the box's top-left) | People | Creatures |
| --- | --- | --- | --- |
| The Old Bridge 128..146 x 86..102 | the crossing in stone, three wide (DECO 'stone_bridge' with parapets, over Stage 4's planks); reeds on both banks; a rail; the watchtower ruin, its chest and the south signpost are Stage 4's | Wilf the stonemason (his story a line at a time) | snakes 128,91 and 146,91, an adder 143,90 (lv 4, 6; 6+ off R3 and R5) |
| Millbrook 78..96 x 78..94 | farmhouse with an oven, a red barn, the watermill (its wheel turns in a pit off a dead-end leat from the river, drawn in HOOKS.draw), Odo's wheat (21 DECO 'wheat' cells on SOIL), a sheep paddock, 8 tiles of soil any knight may plant, a hedge; a rail | Tamsin the miller (two sheaves of wheat make a sack of flour, all at once; her shop: flour 10, wheat seed 2, bread 8), Odo the farmer | crows 79,92 82,91 83,93 (lv 2), giant rats 89,90 96,90 (lv 3), sheep in the paddock |
| Saltmere 250..268 x 64..80 | five stilt huts (BUILDINGS over the water, posts drawn beneath), a boardwalk and a jetty two wide (DOCK) with four lobster grounds off its end, four drying racks, fishing rings on the water, a marsh band of pools, sand bars and reeds on its land side (x 242..249); a rail | Nan Gully (her stall sells rods, lobster pots, shrimp and trout; buys every fish at full price) | giant rats on the jetty 256,74 257,76 (lv 3) |

- **Built, not reserved.** `ATLAS.markBuilt(id, { sub })` at 85's load: the REGIONS line names the place (93-spread),
  signposts drop "(builders at work)", `placeAction` says "This is Millbrook's ground. Build somewhere else.", the beat
  report counts the box a stop. The anchor stays `kind: 'reserved'`, so every pass before `HOOKS.built` sees the same ground.
- **On the finished land.** Everything is laid in a `HOOKS.built` pass: the stakes come up (each tile back to its
  `under`), the plans, the leat, the buildings and people (taken out of BUILDINGS and NPCS by a `HOOKS.world.unshift`
  pass at the start of every world: the earlier passes keep rings clear round people and buildings with dice), the
  spawns (each marked `s.by`), the marsh and a light ring of worn ground (its own `mulberry32` stream).
- **DECO** is made by the first cell put, after PROP, so no older tile id moves (the self-test checks PROP < DECO <= 255).
  Kinds: stone_bridge (`bridge: true`), reeds, wheat, hedge, rack. The scarp seal, the river channel, roads-clear and
  92's bridge count read `DECO.isBridge`.
- **People's looks**: 83-townsart's 'riverside' family (wilf, tamsin_miller, odo, nan_gully; 83-townsfolk counts 84).
  "Tamsin the miller" shares a first name with Tamsin the baker (the spec's name); her id is `tamsin_miller`.
- **Other files**: 61-markers (made again after `HOOKS.built` by 93-spread's runner; one dock marker per built place:
  Saltmere's, so 5 docks); 51-mounts (Fennick's unsold mare stands only at his own rail, not at every HITCH); 11-main
  (the animals count adds Millbrook's sheep); 87-critters (its own spawns and its test crow and dog are its own); 44-wiki
  (the two shops' places). The Ferry Piles wreck under the arches (§4) is not built (not in 5b's list).

**The footprint: WORLD_REV 2.** `ATLAS.REVS[2]` is each box plus its 6-tile ring, the leat and the marsh band.
`node tools/spread-footprint.mjs <spread5-87-critters index.html>`: 498 tiles changed (map and variants), 0 outside;
3 regions changed (their sub line), 8 buildings, 4 people and 12 spawns added, all inside.

**The migration with the sweep.** `--rev-base` (the 5a build, rev 1): fixture + matrix 27/27 (6 footprint planks back
to the knight, the far one kept). The real saves (the 7 Oct pre-spread-live export, locally) 94/94 straight (world 1 to
rev 2) and 94/94 through rev 1; 0 stage changes, 0 lost machines, items or coins.

**Proved on this build:** `./build.sh` (literals 0 bare, changetile, compass, boot budget); headless ALL 1426; `--play`
ALL 1427, the Fang dead; online 430; mmo-sim 43, `--room` 43, `--sim` 47; dom-keys 16; mmo-sim-admin 8; mmo-sim-party 18;
mmo-sim-teacher 9; mmo-sim-world 16; sim-suite 28; build-sim `--strip --reads`; atlas-drift (hash 0d05465b015316dd);
the footprint; the migration as above. The beat gaps are unchanged and under the limits (R1 19, R2 23, R3 29). Shots:
`~/.fanglands/work/spread/s5b/shots/` (laptop 1280x800 and iPad 1024x768); full map `s5b/fullmap-5b.png`. The
fingerprint baseline is this build's (a061a1ba1ff94e2e), for 5c's diff.

## Stage 5c: THE CROSSROADS INN (feat/spread5, 7 Oct 2026)

`src/84-crossroads.js`. Spec §4 "New places". Points in `ATLAS.planFrame('crossroads_inn')` (offsets from 152,116).

| Where | What is there | People |
| --- | --- | --- |
| the junction, 152..168 x 116..125 | the clearing round the Long Road, the Ash Road and the Drovers' Track (trees, rocks, flowers and mushrooms to grass; ore and berry bushes kept); the four-way signpost (Stage 4's, at the yard port: THISTLEDOWN, HOLLOWFORD, FANG'S LAIR, OUTPOST) | Jory the pedlar (wanders) |
| the inn 'xinn', 152..163 x 126..133 | 12 x 8, two rooms: the door from the road into the common room (Mother Hobb's counter, her oven, three tables, a shelf), a doorway (rug) into the back room (three beds, a rug, a shelf, a table) | Mother Hobb, at her counter |
| the yard, 164..168 x 126..133 | the notice board at its corner by the road, the hitching rail and a trough beside it, a well, two hay bales (DECO 'hay'), a fence on its far sides | Marigold the drover (wanders) |

- **The room.** Mother Hobb: with five coins, while the room is not his yet or he is hurt, she takes five, heals him to
  full and gives him the room (`player.xinnRested`); then her kitchen opens (meat pie 25, bread 8, baked potato 6, cooked
  beef 12). A bed in the inn then holds his spirit like the Barrel & Boar's: 06-systems' bed reads a BUILDINGS row's
  `inn: { flag, keeper }` (unpaid: "Pay Mother Hobb for the room first."; Dorran's paid room does not open hers).
- **The notice board** says "Nothing is pinned to it yet." until a notice is pushed to `CROSSROADS.NOTICES` (a string or
  a function): 86-bandits pins the Bandit Toll's there. Its paper shows on the board.
- **Past the stakes.** The roads cross the staked box's middle and leave three free rows under them, so the inn and the
  yard run to row 134. `ATLAS.markBuilt(id, { box })` (01-atlas `builtAt`, read by 93-spread's `placeAction`: "This is
  the Crossroads Inn's ground. Build somewhere else.", tested in the yard past the stakes); the REGIONS line grows to
  152..168 x 116..134 in the `HOOKS.built` pass (the banner, the Atlas zone, atlas.json and the map) and goes back to the
  staked box before every world, with the inn and the people, in a `generateWorld` wrapper ahead of the core's own
  generation. (First try: taken out only by a `HOOKS.world.unshift` pass, the inn was laid by the core's building loop at
  the next world's start and 4,888 tiles re-rolled across the map; the footprint caught it.) The anchor's box is unchanged.
- **Solid things.** The well, the trough and the board stand on 95-thistledown's TD_PROP tile (solid; outside the town's
  plan it has no town kind) with 84's own side table (`CROSSROADS.THINGS`), drawn over the ground beneath and read in 84's
  hooks. DECO and Stage 4's PROP are both walkable. No new tile id.
- **The signpost** shows four arms (`markBuilt(id, { arms: 4 })`; 93-spread's `SIGN_ARMS` packs them 14 px apart).
- **People's looks**: 83-townsart's 'crossroads' family (mother_hobb, jory, marigold; 83-townsfolk counts 87). Every line
  is short, with no compass word; Jory and Marigold tell theirs a line at a time (role 'wayfarer').
- **No spawns** inside the grown box (tested). Stage 4's wolf at 175,131 roams 7 tiles east of the yard (outside the ring).
- **Other files**: 00-core (WORLD_REV 3), 01-atlas (`builtAt`, markBuilt's `box`), 06-systems (an inn's bed), 93-spread
  (four arms; `placeAction` reads `builtAt`), 83-townsart, 83-townsfolk, 44-wiki (the kitchen's place).

**The footprint: WORLD_REV 3.** `ATLAS.REVS[3]` is the grown box plus its 6-tile ring (146..174 x 110..140).
`node tools/spread-footprint.mjs <spread5-85-riverside index.html>`: 202 tiles changed (map and variants), 0 outside;
the region line changed (its sub and its grown box), 1 building and 3 people added, no spawns changed.

**The migration with the sweep.** `--rev-base` (the 5b build, rev 2): fixture + matrix 27/27 (the footprint plank back
to the knight, the far one kept). The real saves (the 7 Oct pre-spread-live export, locally) 94/94 straight (world 1 to
rev 3) and 94/94 through rev 2; 0 stage changes, 0 lost machines, items or coins.

**Proved on this build:** `./build.sh` (literals 0 bare, changetile, compass, boot budget: node 1,080 ms, Chromium 4x
1,998 ms); headless ALL 1434; `--play` ALL 1435, the Fang dead (one earlier `--play` run under the full gate load failed
76-admin's layout check once, "no chip" at the phone sizes, and passed on the rerun with nothing changed: a plaque column
crowded at that moment, not this stage's); online 430; mmo-sim 43, `--room` 43, `--sim` 47; dom-keys 16; mmo-sim-admin 8;
mmo-sim-party 18; mmo-sim-teacher 9; mmo-sim-world 16; sim-suite 28; build-sim `--strip --reads`; atlas-drift (hash
c31849ec6edcba72); the footprint; the migration as above. The beat gaps hold (R1 19, R2 23, R3 29; R6's stop gap 47 -> 44
with the inn a stop). The wiki has the place's page (its three people and Mother Hobb's Kitchen). Shots:
`~/.fanglands/work/spread/s5c/shots/` (junction, inn inside, back room, yard; laptop 1280x800 and iPad 1024x768); full
map `s5c/fullmap-5c.png`. The fingerprint baseline is this build's (f1e530104ef79574), for 5d's diff.

## Stage 5d: BEACON HILLS AND THE HUNTERS' LODGE (feat/spread5, 7 Oct 2026)

`src/86-wildplaces.js`. Spec §4 "New places". Points in `ATLAS.planFrame('beacon_hills')` (offsets from 112,4) and
`ATLAS.planFrame('hunters_lodge')` (offsets from 100,104); the towers at the Beacon Path's ports.

| Place | What is there | People | Creatures |
| --- | --- | --- | --- |
| Beacon Hills 112..142 x 4..24 | a horseshoe ridge whose rim is all rock face (CLIFF); the only way up is a switchback of three legs at its foot (its top at 119,14); three stone beacon towers on the crest, each three wide and two deep with its door over its port (the Low Beacon 116,12, the High Beacon 128,8, the Far Beacon 139,15), a dirt path tower to tower; a woodpile; a rail at the foot (114,21) | Ansel the beacon keeper (his story a line at a time) | crows 122,9 and 137,10 on the crest (lv 2); snakes 128,14 and 132,16 (lv 4) and an adder 126,16 (lv 6) in the bay between the ridge's arms |
| The Hunters' Lodge 100..112 x 104..114 | the lodge 'hlodge' (7 x 5: hearth, shelves, Hilde's counter, table, bed, bearskin rug; its door to the path), two skin racks and a woodpile (DECO), a range of three straw targets (108,104 110,104 112,104) with a worn line to stand on, a rail (101,110); the Lodge's signpost (Stage 4's) stays | Hilde the trapper (inside), Corvin the hunter (by the range) | none in the box |
| the bear den 100..109 x 119..128 | a rock hollow in the wood past the Wolfwood Road, open on its far side, bones on its floor | | a bear 104,123 (new 'bear', lv 14) |

- **Climbing a tower.** E at a tower's door (from its port): every map marker within 60 tiles is marked seen
  (`quest.markers.seen`; 11, 13 and 16 markers lie within reach of the three), the first climb of each tower trains
  Agility (25 xp), a little banner then flies on that tower, and the Voice says how many new places went on the map.
  `quest.wild.climbed` holds which (ids, no positions). With all three climbed Ansel gives 40 coins, once.
- **Lit at night.** Each tower's fire basket roars at night and smoulders by day; the light is `HOOKS.nightLights`
  (35-night's overworld dark: the fire and a door lantern per tower). 89-lighting's `LIGHTS.add` paints only inside an
  instance's scene (its `activeScene()` is null on the overworld), so it is not used here.
- **The switchback.** The rim has no gap but the switchback: with its top shut, no tower is reached from the cave mouth
  (tested). The network's track `r1b_beacon` (01-atlas) still runs straight between the ports: TRACKS lay the dirt at world
  start and every earlier pass reads them, so the path on the ground is the place's own. Only main roads are linted for
  solids; the crest path is walked by the self-test.
- **The services.** Hilde's Furs: buys wolf and bear pelts, snakeskin, boar tusks and wool at full price (sells raw and
  cooked beef); `shop.buysWords` (10-hud, new) says "Hilde only buys pelts and skins." where every shop said Fennick's
  words (Nan Gully's now says fish). Corvin: the first word gives a goblin trap and how to set it (`quest.wild.trapGift`),
  then Corvin's Traps (goblin trap 50, shortbow 50, stone arrows 1). The range: an arrow that strikes a target is caught
  a step ahead of the core's solid-tile stop; it rolls as the dummy does (Ranged xp = the hit) and the arrow lands at the
  target's foot.
- **The bear**: 'bear' lv 14, 55 hp, att 15, max hit 9, def 11, attacks at sight 4, roam 2 (07-update's `def.roam`),
  respawn 90 s, always a bear pelt (new item, 60), beef or coins; kill xp 360 (42-playthrough's row via HOOKS.xpSource).
  9.2 tiles off the Wolfwood Road's centre line (more than roam + sight + 1.5). The look (87-critterart, measured as 5a's:
  box [-34, -26, 34, 24 / -45, -26, 45, 24], sheet `~/.fanglands/work/spread/s5d/bearsheet.png`), the bear pelt's icon,
  the book's page.
- **The solid things** (towers and targets) stand on 95-thistledown's TD_PROP tile with 86's side table (as 84's well);
  a tower's six cells share one record and it is drawn once, sorted at its foot. Racks, woodpiles and bones are DECO.
- **Aprons.** The first build failed 92-worldshape's walled-off check (48 tiles, 11 rocks and an iron ore shut in: a
  boulder or face hard by a tree line, and the lodge closing the bank under the scarp). Every rock face, boulder and the
  lodge's walls now clear the trees and rocks on the open ground beside them.
- **The goblin** 02-world stood at 129,12 (now the ridge's bay) moves to the meadow below the ridge, 129,27 (inside the
  footprint ring); Beacon Hills holds only its crows and snakes.
- **People's looks**: 83-townsart's 'wildplaces' family (ansel, hilde_trapper, corvin_hunter; two new held props, a wolf
  pelt and a jaw trap). The game already has a Hilde (Deepholm) and a Guildmaster Corvin (the Cloud Kingdom): the ids
  carry the trade, as `tamsin_miller` did. 83-townsfolk counts 90.
- **Other files**: 00-core (WORLD_REV 4), 01-atlas (the REVS comment), 10-hud (`buysWords`), 85-riverside (Nan Gully's
  words), 93-spread (a name ending in s: "This is Beacon Hills' ground."), 44-wiki (the two shops' place), literals-allow
  (the bear's sight, the tower's cull reach).

**The footprint: WORLD_REV 4.** `ATLAS.REVS[4]` is each box plus its 6-tile ring (106..148 x -2..30, 94..118 x 98..120)
and the den (100..109 x 119..128). `node tools/spread-footprint.mjs <spread5-84-crossroads index.html>`: 495 tiles changed
(map and variants), 0 outside; 2 region lines changed (their sub), 1 building and 3 people added, 6 spawns added and the
goblin moved, all inside.

**The migration with the sweep.** `--rev-base` (the 5c build, rev 3): fixture + matrix 27/27 (3 footprint planks back to
the knight, the far one kept). The real saves (the 7 Oct pre-spread-live export, locally) 94/94 straight (world 1 to
rev 4) and 94/94 through rev 3; 0 stage changes, 0 lost machines, items or coins.

**Proved on this build:** `./build.sh` (literals 0 bare, changetile, compass, boot budget: node 1,103 ms, Chromium 4x
1,981 ms); headless ALL 1444; `--play` ALL 1445, the Fang dead; online 430; mmo-sim 43, `--room` 43, `--sim` 47; dom-keys
16; mmo-sim-admin 8; mmo-sim-party 18; mmo-sim-teacher 9; mmo-sim-world 16; sim-suite 28; build-sim `--strip --reads`;
atlas-drift (hash db56616d3a595996); the footprint; the migration as above. The beat gaps hold (R1 19, R2 23, R3 29, R5
14, R6 44). The wiki has both places' pages (Beacon Hills: Ansel, its crows, snakes and adder; the Lodge: Hilde's Furs and
Corvin's Traps) and the bear's. Shots: `~/.fanglands/work/spread/s5d/shots/` (the switchback, the crest by day and by
night, the Far Beacon, the lodge, inside it, the range, the den; laptop 1280x800 and iPad 1024x768); full map
`s5d/fullmap-5d.png`. The fingerprint baseline is this build's (c3b66a6060ec1272), for 5e's diff.

## Stage 5e: THE GOBLIN OUTPOSTS (feat/spread5, 7 Oct 2026)

`src/86-outposts.js`. Spec §4 "New places". Points in `ATLAS.planFrame('outpost_north')` (offsets from 212,66) and
`ATLAS.planFrame('outpost_south')` (offsets from 232,98).

| Place | What is there | Person | Creatures |
| --- | --- | --- | --- |
| North Goblin Outpost 212..222 x 66..74 | a ring of 65-palisade's sharpened stakes (212..222 x 67..74, 33 stakes) with one gap in its road side (222,71); inside, trampled earth, a lookout of lashed poles (213,68; solid), a fire (217,70; cook on it, lit at night) and a scrap heap (220,73; DECO); the iron ore at 215,73 stays inside; a worn trail from the gap to the Goblin Road (y 71) with a signpost where it leaves the road (233,70: OUTPOST); a rail (222,66) | Bramble the scout, by her hide (DECO) outside the ring (213,66) | goblins 215,69 219,69 217,72 (lv 2), a sapper 219,72 (lv 7) |
| South Goblin Outpost 232..242 x 98..106 | a ring of stakes (233..242 x 99..106, 28 stakes) whose corner by the river is the scarp's own rock face (241,99 242,99 242,100, untouched); its gap on the far side from the road (239,106); inside, a lookout over the road (234,100), a fire (238,102), a scrap heap (241,105); the iron ore at 237,105 stays inside; the Drovers' Track ends at the west wall, where a worn path goes round below the ring to the gap (stepping round the iron rock at 237,107); a signpost where the track leaves the Goblin Road (230,103: OUTPOST, INN); a rail (232,99) | Brin the drover, at the end of his track (232,100) | goblins 236,101 240,101 235,104 (lv 2), a brute 239,104 (lv 9) |

- **Fights he chooses.** Each gap is 12.97 (north) and 12.1 (south) tiles off the Goblin Road's centre line; no outpost
  goblin can see a knight on the road (each stands farther off it than its sight plus 2.5; the nearest, 235,104, is 7.8
  off with sight 4.5). The walls stop them; a goblin that sees the knight through the stakes runs into them.
- **Multi combat.** `ATLAS.markBuilt(id, { combat: 'multi' })` (01-atlas build applies a built place's `combat`): both
  outposts are multi in the Atlas (atlas.json too), as the camp is.
- **The camp's respawn rule.** The spawn rows carry `outpost` (the place's id). 06-systems: `isCampMonster` (the 30-minute
  respawn that waits until the knight is 40+ tiles off, everywhere it is read: 07-update, 75-coop, 79-worldkeeper) now
  reads `s.camp || s.outpost`; the Goblin Camp's own CLEARED banner and its refill flag read `isGoblinCampMonster` (camp
  rows only), so the outposts never count toward it (11-main's camp test reads that one too). atlas.json's spawn flag
  is still `camp` only.
- **Cleared.** When an outpost's last goblin dies (HOOKS.monsterDeath, so a kill online counts too): "GOBLIN OUTPOST
  CLEARED / They will not be back for a while", once per clear (`quest.outposts[id]`: cleared, won, searched, thanked; no
  positions). Then the heap gives 15 coins and two goblin scrap once a clear, the lookout is empty ("The lookout is empty.
  The goblins are gone, for now."; while any goblin stands, one peeks over its rail), and the watcher thanks the knight
  once ever (Bramble 30 coins, Brin 40). When one comes back the outpost is filling again (checked once a second).
- **The stakes** are 65-palisade's PALISADE tile (solid, prick on a shove, the bulldozer smashes them and they are driven
  in again after 180 s). `PALISADE.addRing(x0, y0, x1, y1)` (new; emptied each world by 65's own pass) draws each ring with
  its points leaning out from its own middle; 65's "no stake outside the camp" check counts the added rings as theirs.
  Every stake clears the trees and rocks on the open ground beside it (an apron, as 86-wildplaces').
- **The signposts** are SIGN tiles with this file's words (`ATLAS.signText` and `SIGN_ARMS` ask 86-outposts first for its
  two): "→ The goblin outpost, west, along the trail. ..." and "→ The goblin outpost, east, at the end of the Drovers'
  Track. → The Crossroads Inn, west." The inn's four-way signpost now says "The goblin outpost" without "(builders at work)".
- **The ground**: "This is a goblin outpost's ground. Build somewhere else." (93-spread lowers a leading "A " as it did "The ").
- **The core clears ore round spawns.** 02-world, after the world passes, clears trees, rocks AND ore in the 3 x 3 round
  every spawn: the first build stood a goblin by each outpost's iron rock and lost both; the spawns moved a tile.
- **People's looks**: 83-townsart's 'outposts' family (bramble_scout with a new held spyglass, brin_drover with a drover's
  goad); 83-townsfolk counts 92. Brin's sister is Marigold the drover at the inn.
- **Other files**: 00-core (WORLD_REV 5), 01-atlas (built `combat`, the REVS comment), 06-systems and 07-update (the camp
  rule), 11-main (the camp test), 65-palisade (`addRing`), 83-townsart, 83-townsfolk, 93-spread ("a goblin outpost's"),
  converted.json, literals-allow (the lookout's cull reach).

**The footprint: WORLD_REV 5.** `ATLAS.REVS[5]` is each box plus its 6-tile ring (206..228 x 60..80, 226..248 x 92..112)
and the north trail's run to the road with its signpost (229..236 x 69..72). `node tools/spread-footprint.mjs
<spread5-86-wildplaces index.html>`: 223 tiles changed (map and variants), 0 outside (and 0 outside the declared boxes
themselves, without the tool's ring); 2 region lines changed (their sub), 2 people and 8 spawns added, all inside.

**The migration with the sweep.** `--rev-base` (the 5d build, rev 4): fixture + matrix 27/27 (3 footprint planks back to
the knight, the far one kept). The real saves (the 7 Oct pre-spread-live export, locally) 94/94 straight (world 1 to
rev 5) and 94/94 through rev 4; 0 stage changes, 0 lost machines, items or coins.

**Proved on this build:** `./build.sh` (literals 0 bare, changetile, compass, boot budget); headless ALL 1451; `--play`
ALL 1452, the Fang dead (one run under the full gate load failed aerie2's Spire Run check once, "fell: false" in the
Aerie's instance; the rerun alone passed with nothing changed); online 430; mmo-sim 43, `--room` 43, `--sim` 47; dom-keys 16; mmo-sim-admin 8; mmo-sim-party 18;
mmo-sim-teacher 9; mmo-sim-world 16; sim-suite 28; build-sim `--strip --reads`; atlas-drift (hash 91af030298886343); the
footprint; the migration as above. The beat gaps hold (R1 19, R2 23, R3 29, R5 14, R6 44) and the Goblin Road's stop gap
falls from 25 to 13 with the outposts as stops. The wiki has both places' pages (their goblins and their watcher). Shots:
`~/.fanglands/work/spread/s5e/shots/` (each outpost, the north trail and its signpost, the north one by night, Brin's
path round to the south gap, the south signpost; laptop 1280x800 and iPad 1024x768); full map `s5e/fullmap-5e.png`. The
fingerprint baseline is this build's (474d5a5390b6c70d), for 5f's diff.

## Stage 5f: THE BANDIT HILLS (feat/spread5, 7 Oct 2026)

`src/86-bandits.js` (the place, the bandits' rules, the self-tests) and `src/86-banditart.js` (their look and book pages;
stripped from the server's copy like 87-critterart). Spec §4 "New places". Points in `ATLAS.planFrame('bandit_hills')`
(offsets from 250,148).

| Part | What is there | Person | Creatures |
| --- | --- | --- | --- |
| the approach, 250..274 x 148..157 | the Bandit Track (R8) down from Hollowford through rock-and-scrub hills: the jungle in the box cut to open ground with thorn scrub (DECO 'bandit_scrub'), dry patches and boulder clusters (ROCK); the track's own cells are worn path; a signpost by the track (258,149: BANDITS, HOLLOWFORD); a rail (255,152) | Wat the carter (256,152) | none |
| the ring and the toll gate | a rock face (CLIFF, 41 tiles): north wall y 158 (x 251..272) with the toll gate at the track's end (262,158 = bandit_hills.toll: DECO 'bandit_gate', its pole raised), west wall x 251, south wall y 169 (x 251..261); the river closes the east side (never painted); the toll booth (263,157, solid) | | |
| the hollow, 252..(the river) x 159..168 | trampled paths from the gate, two tents (254,160 and 267,160), a fire (257,163: cook on it), the stolen sacks (253,163: DECO), Wat's cart (261,166); the hideout's mouth in the south wall (257,169, solid), two builders' stakes and a plaque on its step (256..258,168: 93-spread PROP, place 'bandit_hideout', "Builders' stakes. The Bandit Hideout is coming."; port `bandit_hills.hideout` 257,168) | | bandits 256,161 263,162 260,165 253,166 (lv 12); bandit archers 265,161 259,167 (lv 15, throwers); the bandit chief 255,165 (lv 20) |

- **The bandits** (MONSTER_DEFS, `human: true`, aggro): bandit lv 12 (50 hp, sight 5), bandit archer lv 15 (48 hp, sight
  6, `thrower`: keeps 2.5 to 5 tiles off and throws the sapper's sticky bomb), bandit chief lv 20 (120 hp, sight 5). The
  spec's ranges (12-14, 15-17) take their low end, as 87-critters and 86-wildplaces did. As people they walk through doors,
  traps do not catch them and 79-deaths fells them as 'person' (a falling one drops his weapon). Drops: coins always;
  bread, daggers, arrows, a shortbow; the chief 40-80 coins, meat pies, steel. On 42-playthrough's curve (`HOOKS.xpSource`).
- **The look** (86-banditart): each drawn with the core's `drawHuman` (plain looks: tunic, hood, weapon; a cloth mask over
  the face, the archer's quiver, the chief's wide black hat with a red feather) through `MONSTER_LOOK.addType`; boxes
  measured with `s5f/measure.cjs` (drawHuman holds the weapon out at rest, so rest and swing are the same box). Not a `who`
  look: 83-townsfolk's own test keeps monsters out of the townsfolk.
- **A fight he chooses.** The Bandit Track is a spur that ends at the gate; no main road comes within 40 tiles (the gate is 43.8 off the nearest, the nearest bandit 41). No bandit
  can see Wat, his rail or the signpost (each is farther off than its sight plus 2.5). Multi combat (`markBuilt`'s
  `combat`). The spawn rows carry `outpost: 'bandit_hills'`, so the camp's rule holds (down 30 minutes, back only while the
  knight is 40+ tiles off) without counting toward the Goblin Camp's banner.
- **Cleared.** The last bandit down: "BANDIT HILLS CLEARED / The track is safe, for now", once per clear
  (`quest.bandits`: won (the chief beaten, ever), cleared, searched, thanked; no positions). Then the sacks give 25 coins
  and a meat pie once a clear, the booth is empty, and Wat thanks the knight once ever (60 coins) after the chief has
  fallen. When one comes back the hills fill again (checked once a second).
- **The inn's notice board** (84-crossroads `NOTICES`): a WANTED notice for the bandits; after the chief falls, the news.
  84's own test now reads the pinned notice. The Bandit Toll itself (paying at the gate) and the hideout instance are later
  (spec §15).
- **Wat the carter**: 83-townsart's 'bandits' family (a flat cap, a patched coat, a carter's whip whose sway comes round in
  the 2 s standing loop); 83-townsfolk counts 93. His lines tell the story (the toll, the cart, the bombs, the chief) with
  no compass word.
- **Hollowford's square signpost** now says "The Bandit Hills, east." without "(builders at work)". "This is the Bandit
  Hills' ground. Build somewhere else."
- **The dressing ring**: outside the box the jungle thins to fern, grass and scrub over 6 tiles (own dice; never on a
  road, the water, the Hollowford burn or within 3 of another place's box): 128 tiles.
- **Other files**: 00-core (WORLD_REV 6), 01-atlas (the port, the REVS comment), 06-systems (comment), 83-townsart,
  83-townsfolk (93), 84-crossroads (its board test), 93-spread (the PLAQUE line for 'bandit_hideout'), 97-spreadchecks
  (the beat gaps held, below), tools/build-sim.mjs (86-banditart stripped), converted.json, literals-allow (the sights,
  the things' cull reach).

**The footprint: WORLD_REV 6.** `ATLAS.REVS[6]` is the box plus its 6-tile ring (244..280 x 142..176).
`node tools/spread-footprint.mjs <spread5-86-outposts index.html>` (the 5e build 864e726 to the 5f build 7fd01ee): 463 tiles changed (map and variants), 0 outside the
declared box; 1 region line changed (its sub), 1 person and 7 spawns added, all inside.

**The beat gaps, after 5f (spec §13: "after 5f, the beat-gap limits hold on R1, R2 and R3").** 97-spreadchecks' report
is now a check for the Cave, Sea and Long Roads (`BEAT_HELD`, `BEAT_LIMIT`: a stop at most every 73 tiles and a glance at
most every 36, each beat within 10 tiles of the centre line); the other main roads are reported until Stage 6. On this
build: R1 stop 19 / glance 19, R2 23 / 23, R3 29 / 29 (R4 13 / 12, R5 14 / 8, R6 44 / 41).

**The migration with the sweep.** `--rev-base` (the 5e build, rev 5): fixture + matrix 27/27. The real saves (the 7 Oct
pre-spread-live export, locally) 94/94 straight (world 1 to rev 6) and 94/94 through rev 5; 0 stage changes, 0 lost
machines, items or coins.

**Proved on this build:** `./build.sh` (literals 0 bare, changetile, compass, boot budget); headless ALL 1460; `--play`
ALL 1461, the Fang dead; online 430; mmo-sim 43, `--room` 43, `--sim` 47; dom-keys 16; mmo-sim-admin 8; mmo-sim-party 18;
mmo-sim-teacher 9; mmo-sim-world 16; sim-suite 28; build-sim `--strip --reads` (0 unlisted; the first try read
MONSTER_LOOK and WIKI from the kept file, so the look moved to 86-banditart, stripped); atlas-drift; the footprint; the
migration as above. One `--sim` run under the first full gate load failed its "Ann spawns 3 goblins" check once; alone,
and in the full rerun, it passed with nothing changed. The wiki has the place's page (its seven bandits and Wat) and a page
for each bandit kind. Shots: `~/.fanglands/work/spread/s5f/shots/` (the approach, the gate, the hollow, the hideout's
mouth, a fight, the hollow by night; laptop 1280x800 and iPad 1024x768); full map `s5f/fullmap-5f.png`. The fingerprint
baseline is this build's (ab4d229fca979712), for Stage 6's diff.

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

