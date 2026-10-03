#!/bin/sh
# Ships the game to fanglands.com (and gorkscape.ca's hand-over). From anywhere: ./online/deploy.sh
# Build, run the whole headless suite, the server's own tests, the two-player simulations (and the admin and drop
# party ones when they are there), copy the built game into the assets folder, deploy. Never deploys a build that
# fails a check.
set -e
cd "$(dirname "$0")/.."
# The game's home must stay attached: a live deploy from a tree whose wrangler.toml lacks fanglands.com detaches it, and
# Cloudflare deletes its DNS records (kids on fanglands.com get "server not found", cached for up to 30 minutes).
grep -q '^pattern = "fanglands.com"$' online/wrangler.toml || { echo "refusing: online/wrangler.toml does not serve fanglands.com (merge master first)"; exit 1; }
grep -q '^HANDOVER = "\(on\|off\)"$' online/wrangler.toml || { echo "refusing: online/wrangler.toml has no HANDOVER switch (merge master first)"; exit 1; }
./build.sh
node tools/headless.js
node --test online/test/
[ -f tools/mmo-sim.js ] && node tools/mmo-sim.js && node tools/mmo-sim.js --room
# real key presses in a real browser (the suite has no DOM): typed chat sends, typing does not move the knight
[ -f tools/dom-keys.js ] && node tools/dom-keys.js index.html
[ -f tools/mmo-sim-admin.js ] && node tools/mmo-sim-admin.js
[ -f tools/mmo-sim-party.js ] && node tools/mmo-sim-party.js
# the shared world (docs/ONLINE.md, "The shared world"): each gate runs once its stage has built it; a red one never deploys
[ -f tools/sim-suite.mjs ] && node tools/sim-suite.mjs
grep -q -- "'--sim'" tools/mmo-sim.js && node tools/mmo-sim.js --sim
[ -f tools/mmo-sim-world.js ] && node tools/mmo-sim-world.js
[ -f online/test/atlas-drift.mjs ] && node online/test/atlas-drift.mjs
cp index.html online/public/index.html
[ -f bridge.html ] && cp bridge.html online/public/bridge.html
# extra arguments go to wrangler. The hand-over switch is HANDOVER in online/wrangler.toml (docs/ONLINE.md, "Two
# addresses"): change it by a commit on master, never by a --var alone (the next plain deploy from anywhere undoes that).
cd online && CI=1 wrangler deploy "$@"
# afterwards both addresses must answer (a new certificate can take a few minutes); a silent miss here is loud instead
for host in fanglands.com gorkscape.ca; do
  n=0
  until curl -sf --max-time 10 "https://$host/api/status" > /dev/null; do
    n=$((n + 1))
    if [ $n -ge 30 ]; then echo "!!! https://$host/api/status does not answer after the deploy. Look now: kids may not reach the game there."; exit 1; fi
    sleep 10
  done
  echo "https://$host/api/status answers"
done
echo "HANDOVER is $(sed -n 's/^HANDOVER = "\(.*\)"$/\1/p' wrangler.toml) in wrangler.toml (a --var given above overrides it for this deploy only)"
