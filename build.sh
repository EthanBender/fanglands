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
node --check .build-check.js && echo "built index.html ($(wc -l < index.html) lines)"
rm -f .build-check.js
