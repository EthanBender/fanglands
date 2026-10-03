#!/bin/sh
# Builds index.html from src/page.html + src/*.js (in name order). No dependencies beyond node for the syntax check.
cd "$(dirname "$0")"
# the game's own words for the word filter (online/src/gamewords.js): a knight named Goblin is never "the person" in "you stupid goblin"
node tools/game-words.mjs || exit 1
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
