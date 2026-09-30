#!/bin/sh
# Ships the game to gorkscape.ca. From anywhere: ./online/deploy.sh
# Build, run the whole headless suite, the server's own tests, the two-player simulations (and the admin and drop
# party ones when they are there), copy the built game into the assets folder, deploy. Never deploys a build that
# fails a check.
set -e
cd "$(dirname "$0")/.."
./build.sh
node tools/headless.js
node --test online/test/
[ -f tools/mmo-sim.js ] && node tools/mmo-sim.js && node tools/mmo-sim.js --room
# real key presses in a real browser (the suite has no DOM): typed chat sends, typing does not move the knight
[ -f tools/dom-keys.js ] && node tools/dom-keys.js index.html
[ -f tools/mmo-sim-admin.js ] && node tools/mmo-sim-admin.js
[ -f tools/mmo-sim-party.js ] && node tools/mmo-sim-party.js
cp index.html online/public/index.html
[ -f bridge.html ] && cp bridge.html online/public/bridge.html
cd online && CI=1 wrangler deploy
