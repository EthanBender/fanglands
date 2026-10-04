# The Great Spread: artefacts

The staged build spec lives outside the repo (`~/.fanglands/work/spread/spec.md`). This folder holds what its tools
make and read. Nothing here is loaded by the game.

| File | Made by | What it is |
|---|---|---|
| `baseline-fingerprint.json` | `node tools/fingerprint.mjs index.html --out docs/spread/baseline-fingerprint.json --from "master <sha>"` | The fingerprint of master at the start of the stage: one hash per table in plain sight, and the tables themselves gzipped (for `--diff`'s entry lists). Regenerated after every peer merge, before any conversion goes on top of it. |
| `inventory.json` | `node tools/literals.mjs --inventory` | Every bare coordinate-shaped literal in src/, with file, line, column, the literal and its guessed anchor. |
| `converted.json` | by hand, one file per Stage 1-3 commit | The files the build's literals gate checks. Empty until Stage 1. |
| `literals-allow.json` | by hand | Literals the gate lets through (instance-local and UI numbers), each with a reason. |
| `strict-allow.json` | by hand (Stage 1 on) | Frame points the strict report may log (relative geometry, such as the rim notch), each with a reason. |

## The tools (Stage 0)

| Tool | What it does |
|---|---|
| `node tools/fingerprint.mjs [index.html] --diff docs/spread/baseline-fingerprint.json` | Boots the build headless, runs newGame(), hashes every table a player could see move, names each changed table and its first 20 differing entries, and prints the strict report (frame points past box + guard + 12, as `src/file:line`); exit 1 on a changed table or a strict entry not in `strict-allow.json`. |
| `node tools/literals.mjs [files]` | Counts bare coordinate-shaped literals per file (pairs, `{x, y}`, x0 rects, setTile/tileAt/changeTile/tp/openSpot/bfs/... calls, `tc(N)`, `N * TILE`, comparisons of 10+ against a coordinate name), skipping anything inside a frame call and anything `literals-allow.json` lists. `--inventory` writes `inventory.json`; `--gate` is the build's gate over `converted.json`. |
| `node tools/anchor-of.mjs X Y [X Y ...]` / `--port ID` | The place a literal belongs to: the smallest old box holding it (ties listed for a human), every box that holds it, and where it lands at the spread; "world" on open land. Reads `src/01-atlas.js` directly, same rule as `ATLAS.anchorOf`. |
| `node tools/frame-codemod.mjs src/NN-file.js [--write] [--as anchor]` | Rewrites the mechanical patterns (pairs, points, rects, two-number calls; comparisons only with `--as`) as frame reads and prints the diff; refuses ties, one-axis literals (`tc(N)`, `N * TILE`), comparisons without `--as` and rects whose corners disagree. Read the diff: an instance's own coordinates come out as `cave` points and must be allow-listed, never wrapped. |

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

Notes on the proof:
- 29-quests places no NPC of its own (its people are 02-world's, by id); the notice board's tile is the position it
  owns, so that is the literal moved.
- A first try at 92 moved the Goblin Fields' east headland `near(x, y, 150, 52, 10, 8)` by one tile and the fingerprint
  did not change: that lobe lies wholly inside the region's own noise band, so the outline it ORs in was already there.
  Moving a literal that changes nothing on screen is, rightly, not a visible change.
