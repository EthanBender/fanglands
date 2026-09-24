#!/bin/sh
# Ships the game to gorkscape.ca. From anywhere: ./online/deploy.sh
# Build, run the whole headless suite, run the two-player simulation, copy the built game into the assets folder, deploy.
# Never deploys a build that fails a check.
set -e
cd "$(dirname "$0")/.."
./build.sh
node tools/headless.js
[ -f tools/mmo-sim.js ] && node tools/mmo-sim.js && node tools/mmo-sim.js --room
cp index.html online/public/index.html
[ -f bridge.html ] && cp bridge.html online/public/bridge.html
cd online && CI=1 wrangler deploy
