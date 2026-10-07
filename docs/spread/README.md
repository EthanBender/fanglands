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

