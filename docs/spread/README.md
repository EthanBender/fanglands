# The Great Spread: artefacts

The staged build spec lives outside the repo (`~/.fanglands/work/spread/spec.md`). This folder holds what its tools
make and read. Nothing here is loaded by the game.

| File | Made by | What it is |
|---|---|---|
| `baseline-fingerprint.json` | `node tools/fingerprint.mjs index.html --out docs/spread/baseline-fingerprint.json --from "master <sha>"` | The fingerprint of master at the start of the stage: one hash per table in plain sight, and the tables themselves gzipped (for `--diff`'s entry lists). Regenerated after every peer merge, before any conversion goes on top of it. |
| `inventory.json` | `node tools/literals.mjs --inventory` | Every bare coordinate-shaped literal in src/, with file, line, column, the literal and its guessed anchor. |
| `converted.json` | by hand, one file per Stage 1-3 commit | The files the build's literals gate checks. Empty until Stage 1. |
| `literals-allow.json` | by hand | Literals the gate lets through (instance-local and UI numbers), each with a reason. An entry with a `literal` is pinned by `decl` (the const, function or property it sits in) or `line`; an unpinned one matches nothing and fails the gate. |
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

`build.sh` runs `literals.mjs --gate` after the syntax check; with `converted.json` empty it does nothing (and needs no acorn).

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

| Overlap | Old tiles | Decided | Open question |
|---|---|---|---|
| quarry / thistledown | 70..72 x 12..16 | the cow pen 72..80 x 14..21 is thistledown (OWNERS; spec section 2 lists the pens under thistledown) | the rest of the strip (70..72 x 12..13, 70..71 x 14..16) |
| dock / gull_isle | 168..171 x 8..20 | Gull Isle's mooring 170..171 x 12..14 is gull_isle (OWNERS; the spec author's decision, Stage 2): 26-boats `LOC.gull` (boat 170,13, lantern 171,12, planks 171..172 x 12..14, Harl 172,13, landing 173,13) moves as one with the isle; the port `dock.boat2` became `gull_isle.boat` | the rest of the strip |
| dock / camp | 156..161 x 17..20 | none | which place owns this corner |
| thistledown / hollowford | 120..141 x 59..61 | the south pond and its shore 128..140 x 59..61 is thistledown (OWNERS; the spec author's decision, Stage 2: 02-world draws it in Thistledown's frame) | the rest of the strip (120..127 x 59..61, 141 x 59..61) |
| graveyard / deepholm_rock | 6..19 x 72..73 | the gate 13,72 is graveyard (the port `graveyard.gate`) | the rest of the strip |
| wren / deepholm_rock | 25..26 x 73..83 | none | which place owns this strip |
| warden / stone_circle | 54..66 x 90..92 | the gate 60,96 and post 60,95 lie outside it; nothing decided | which place owns this strip |

