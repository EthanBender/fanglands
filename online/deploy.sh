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
# the owner's knights (the Teachers section of the game's Admin panel): a deploy without the line would take it away from him
grep -q '^OWNER_KNIGHTS = "[^"]\{2,\}"$' online/wrangler.toml || { echo "refusing: online/wrangler.toml has no OWNER_KNIGHTS line (merge master first)"; exit 1; }
./build.sh
node tools/headless.js
node --test online/test/
# one command per line inside the if: under set -e a failure in the MIDDLE of an && list does not stop the script
if [ -f tools/mmo-sim.js ]; then
  node tools/mmo-sim.js
  node tools/mmo-sim.js --room
fi
# real key presses in a real browser (the suite has no DOM): typed chat sends, typing does not move the knight
[ -f tools/dom-keys.js ] && node tools/dom-keys.js index.html
[ -f tools/mmo-sim-admin.js ] && node tools/mmo-sim-admin.js
[ -f tools/mmo-sim-party.js ] && node tools/mmo-sim-party.js
# riding together (docs/ONLINE.md, "Riding together"): four games and a page from before seats against the real Room
[ -f tools/mmo-sim-ride.js ] && node tools/mmo-sim-ride.js
# the teacher view (docs/ONLINE.md, "The teacher view"): two games and a teacher's screen against the real World (Watch
# included), and the screen in a real browser when a local world answers on 127.0.0.1:8787 (the tool's header says how to start
# one; it never runs against a real world)
[ -f tools/mmo-sim-teacher.js ] && node tools/mmo-sim-teacher.js
# only when asked (TEACHER_BROWSER=1) and a local world of THIS tree answers: any other local world on 8787 (another
# worktree's wrangler dev, with its own admin key) would fail the run for reasons that are not this build's
if [ -f tools/teacher-browser.mjs ]; then
  if [ "${TEACHER_BROWSER:-}" = "1" ] && curl -sf --max-time 3 http://127.0.0.1:8787/api/status > /dev/null; then node tools/teacher-browser.mjs
  else echo "teacher-browser: not run (set TEACHER_BROWSER=1 with this tree's local world on 127.0.0.1:8787; see tools/teacher-browser.mjs)"; fi
fi
# the Teachers section of the owner's in-game Admin panel, in a real browser, under the same switch and the same local world
if [ -f tools/teachers-in-game-browser.mjs ] && [ "${TEACHER_BROWSER:-}" = "1" ] && curl -sf --max-time 3 http://127.0.0.1:8787/api/status > /dev/null; then node tools/teachers-in-game-browser.mjs; fi
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
