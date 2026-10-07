#!/bin/sh
# Builds index.html from src/page.html + src/*.js (in name order). No dependencies beyond node for the syntax check.
cd "$(dirname "$0")"
{
  sed -n '1,/<!-- SCRIPTS -->/p' src/page.html | sed '$d'
  echo '<script>'
  for f in src/[0-9]*.js; do echo "// ---- $f ----"; cat "$f"; echo; done
  echo '</script>'
  sed -n '/<!-- SCRIPTS -->/,$p' src/page.html | sed '1d'
} > index.html
sed -n '/^<script>$/,/^<\/script>$/p' index.html | sed '1d;$d' > .build-check.js
# Safari learned regex lookbehind in 16.4: on an older iPad one lookbehind anywhere stops the whole game script, so it is refused here
if grep -nE '\(\?<[=!]' .build-check.js; then echo "build.sh: a regex lookbehind is in the game (iPadOS 16.3 and older cannot run it). Use a lookahead." >&2; rm -f .build-check.js; exit 1; fi
node --check .build-check.js && echo "built index.html ($(wc -l < index.html) lines)"
rm -f .build-check.js
# The Great Spread's literals gate (docs/spread/README.md), repo-wide since Stage 3: no file of src/ or tools/ may hold a bare
# map coordinate ("wrap it: ATLAS.frame('<place>') or ATLAS.world"), bar a file an open peer branch holds (docs/spread/held.json).
node tools/literals.mjs --gate || { echo "build.sh: a file of src/ or tools/ has a bare map coordinate (tools/literals.mjs --gate)" >&2; exit 1; }
# The Great Spread's changeTile classification gate (Stage 4c, docs/spread/changetile.json): every changeTile call is counted
# and classified for the save migration; a story tile needs a HOOKS.remake, so a new quest's world change cannot be left behind.
node tools/changetile-gate.mjs || { echo "build.sh: a changeTile call is not classified for the save migration (tools/changetile-gate.mjs)" >&2; exit 1; }
# The Atlas (docs/ONLINE.md, "The shared world", Stage 1): online/src/atlas.json, made from this index.html, committed with it.
# online/test/atlas-drift.mjs fails a deploy whose atlas.json does not match the game it ships with.
node tools/atlas.mjs --quiet || { echo "build.sh: the Atlas could not be made from index.html (tools/atlas.mjs)" >&2; exit 1; }
# The Great Spread's compass test (Stage 4b, docs/spread/compass.json): every line the game says with a direction or a
# distance word is a row, and every row on the map points the way the Atlas says. No acorn (online/ not installed): skipped.
node tools/compass.mjs --quiet || { echo "build.sh: a line says a direction the map does not hold, or has no row in docs/spread/compass.json (tools/compass.mjs)" >&2; exit 1; }
# The server's copy of the game (docs/ONLINE.md, "The shared world"): online/src/sim/game.mjs, git-ignored, rebuilt on
# every build so the deploy gates always test this index.html. acorn and eslint-scope are online/'s devDependencies.
if [ ! -d online/node_modules/acorn ] || [ ! -d online/node_modules/eslint-scope ]; then
  (cd online && npm ci --no-audit --no-fund --silent) || echo "build-sim: could not install acorn and eslint-scope (cd online && npm ci); online/src/sim/game.mjs not rebuilt"
fi
[ -d online/node_modules/acorn ] && [ -d online/node_modules/eslint-scope ] && node tools/build-sim.mjs --strip --quiet
true
