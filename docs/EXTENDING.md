# Extending Fanglands — feature files

Every gameplay system lives in `src/NN-name.js`. The build (`./build.sh`) concatenates
`src/[0-9]*.js` in name order into one `<script>` in `index.html`, so everything shares one
global scope. Feature files are numbered `20`–`89` and load after the core (`00`–`11`) and
before boot (`99-boot.js`), which is when the world is generated and the loop starts.

**Rule for parallel work: a feature adds ONE new file and does not edit core files.**
Everything a feature needs is reachable through globals and the `HOOKS` registry in
`src/00-core.js`.

## What you can touch from a feature file (at load time)

- `ITEMS` — `Object.assign(ITEMS, { my_item: { name, value, color, shape, ... } })`. Then set
  `ITEMS.my_item.id = 'my_item'` and `.stack` (50 for materials, 1 for gear) yourself.
  Shapes available to `drawItemIcon`: coins log rock bar plank door bed lodestone bench trap scrap
  powder silk wool pelt tusk seed potato meat fish bread pie rod sword dagger axe battleaxe
  warhammer pickaxe hoe hammer bow arrow bomb helm body legs shield. Unknown shapes draw a disc.
- `MONSTER_DEFS.my_monster = { name, level, r, hp, att, maxHit, def, speed, aggro, sight, respawn, drops, human?, harmless?, thrower?, mech? }`
  and a sprite via `HOOKS.drawMonster.my_monster = (g, e, hurt) => {...}` (g is already translated to the monster's position; draw around 0,0; `e.facing`, `e.walkT`, `e.moving`, `e.attackT`).
  Its death is drawn by `src/79-deaths.js` from the same sprite: one of six kinds, `beast` (falls onto its side, kicks, fades),
  `person` (falls back, the weapon clatters away), `undead` (crumbles into dust and bones), `machine` (sparks, smokes, breaks apart),
  `dragon` (crashes down, a last breath of smoke) or `golem` (cracks and splits into rubble). Name it in the def with
  `death: 'undead'` (otherwise `mech` gives a machine, `human` a person, anything else a beast) and add `boss: true` for the
  three second boss scene (level 25+ with 300+ hp, an instance boss and a `HOOKS.bossCall` type already get it). A person's sprite
  must skip the weapon in its hand when `e.unarmed` is set (`drawHuman` does it for you), because the death draws it flying off.
  Drops are still rolled at the kill; the death only delays drawing them. Anything else a feature draws for a monster must
  stop when `m.dead` is set, or it will show on top of the corpse; something a kill lays on the ground should come up as the
  body fades (`DEATHS.remains(m)`, 0 to 1, as 54-graves' markers and the golem's rubble heap do).
  A death starts only from `HOOKS.monsterDeath(m, info)`, `info = { k, by, how, x, y }`: `killMonster` fires it (offline and
  on the keeper), and online 75-coop fires it on the keeper's word, once. Setting `m.dead` or reaching 0 hp plays nothing; a
  feature that kills a monster some other way calls `monsterDied(m, 'blow', by)` after setting it dead.
- `RECIPES.push({ out, qty, needs: [[id, n]], station: 'workbench'|'anvil'|'workshop'|'alchemy'|null, skill, lv, xp, label })`,
  `SMELT.push(...)`, `SHOPS.my_shop = { name, stock: [[id, price]] }`.
- Tiles: `const MY = addTile('MY', { solid, push, placeableOn, tex: 'cobble'|'dirt'|..., mini: '#hex' })`.
  Draw it with `HOOKS.draw` (push `{ y, draw }` items for the visible range) — read `cam`, `VW`, `VH`, `TILE`, `tc()`.
- World: `BUILDINGS.push({...})` (same shape as the existing ones; `stone`, `door`/`doorTop`, `f` furniture),
  `NPCS.push(initNpc({ id, name, x, y, tunic, hair, role, ... }))`, `REGIONS.unshift({ name, sub, x0, y0, x1, y1 })`,
  and `HOOKS.world.push((rnd, api) => { ... })` to carve terrain: `api.setTile/tileAt/spawnList(type, [[x,y],...])/road(points, tile, width, chance)/pen(...)`.
  The map is `MAP_W`×`MAP_H` = 400×280 tiles (the Great Spread, Stage 4a). **Built land is named by anchors, never by
  numbers**: every place is an Atlas anchor (`ATLAS.ANCHORS`: its box with `ATLAS.box(id)`, its named points with
  `ATLAS.port(id)`), the land between places is the stretched world (`ATLAS.world`), and the grounds are REGIONS (the
  Goblin Fields, Wolfwood, the Ashfields, the Jungle, the Grey Sea; `ATLAS.GROUNDS`: the Sound, the east sea, the Grub
  Fields). Ground kept free for what comes later is a **reserved** anchor (`ATLAS.reserved()`, `ATLAS.reservedAt(x, y)`):
  the Skypier, Wreck Rock, Castle Brightwater, the Glasshouse (alchemy), the Old Barrow (necromancy), the Ash Wastes,
  Sylvaris' growth ring, the blood portals' rings, and the new places Stage 5 builds (the Old Bridge, Millbrook, Saltmere,
  the Crossroads Inn, Beacon Hills, the Hunters' Lodge, the goblin outposts, the Bandit Hills). Builders' stakes stand
  round each; `placeAction` refuses them and every main road (`ATLAS.onMainRoad`). A new place fills its reserved box (or
  is given a new anchor in `src/01-atlas.js`), declares its rail with `RAILS.add` (51-mounts), and moves nothing else.
  East of the Sound (x 303–311) everything is ferry-only (Harl's ferry from the dock).
  `WALK_OVER` (a Set in 00-core) lets the player cross tiles it contains (e.g. `WALK_OVER.add(T.WATER)` while hover armour is worn).
- Quests: `QUEST_DEFS.my = { name }`, `HOOKS.questText.my = () => '...'`, `HOOKS.activeQuests.push(() => cond ? ['my'] : [])`.
  Main story after stage 8: `HOOKS.mainQuest[9] = { text: () => '...', onEnter: () => { say(...); } }`; call `advanceQuest(9)`.
- Behaviour: `HOOKS.update.push(dt => ...)`, `HOOKS.use.push((t, tx, ty, building) => handled)`,
  `HOOKS.talk.my_role = npc => ...`, `HOOKS.hit/kill/hurt`, `HOOKS.hud.push((g, narrow) => ...)`,
  `HOOKS.panel.my_panel = (g, narrow) => { const { px, py, w, h } = panelBox(g, 460, 300, 'Title', 'sub'); button(g, ...); }`.
- State: keep feature state inside `quest.myFeature = {...}` or `player.myFeature = {...}` — both are saved and
  loaded automatically (they are plain JSON). Reset it in `HOOKS.newGame`.
- More hooks: `HOOKS.talkBefore.my_role = npc => handled` runs before the core dialogue; `HOOKS.mapTarget.push(() => ({ x, y, label }))`
  puts a marker on the world map (add `map: '<instance id>'` for a target inside an instance: inside an instance only that instance's targets are listed, and
  anything drawn on the maps reads `mapView()`, `miniWindow(size)` and `mapLayout` instead of assuming the whole world); `HOOKS.hurt.push((e, dmg, source) => ...)` sees every hit the player takes.
  `HOOKS.leaveInstance.push(id => ...)` runs as the knight is about to leave instance `id` (every way out: LEAVE, L, the exit, a ride, a respawn, a load),
  while it is still the active map: settle there anything you owe him that a timer was still holding back (91-royalmine pays the golem's fall this way).
- Named bosses come back (owner: *"bosses shoould all be redefeatable"*). A boss a control or a visit wakes registers it once:
  `HOOKS.bossCall = HOOKS.bossCall || {}; HOOKS.bossCall.my_boss = { map: 'over' | '<instance id>', near: [tx, ty, tiles] | null, name, type, alive: () => bool, wake: (askerName, first) => {...} }`
  (`first`: the asker said it is his own story fight; 28-thefang marks such a Fang `friendStory` and 37 brings the Dragon Killers for it),
  and the on-screen control calls `window.COOP && COOP.call ? COOP.call('my_boss') : HOOKS.bossCall.my_boss.wake(null)`. Offline or on the
  map's keeper that wakes it at once (`'woke'`); on anyone else it asks the keeper (`'sent'`), who checks the map, the range and
  that none is up (docs/ONLINE.md, *Named bosses*). `wake(null)` is this knight's own call; `wake('Ben')` must never set the
  keeper's own quest flags. Decide first-kill or repeat in the kill hook from this knight's own flags, so a friend's kill
  (a phantom, through the helper credit) pays each knight his own reward. Anything the boss spawns or moves runs only where
  `!window.NET || !NET.online() || (window.COOP && COOP.isKeeper())`. A rematch's rest is timed on `player.dayTime` (saved,
  always counts up, in instances too), never on `time`; list its field in `src/96-rests.js` (`RESTS`), which takes the real
  time a knight was away (its own stamp beside the slot, `fanglands.rests.N`) off every rest still running when he loads. Give the entry `rest` (seconds; the keeper then answers calls with
  `boss_wait` for that long after the boss falls on its map), `resting: m => bool` (this knight's own rest: a repeat kill then
  pays nothing, `m.noPay`; read it in the kill hook and say "You helped..."), `refused: left => {...}` (the keeper's boss_wait:
  end this knight's call and say how long in m:ss) and, when the boss's name would spoil a story, `told: n => 'line'` for the
  keeper's toast; pass `COOP.call(id, true)` for the caller's own first fight. A call the knight saw stand up and then stay down
  3 s is spent: clear its flag and start his rest even when he was not paid. Only the knight whose story has reached the boss
  takes its first kill (the Fang at stage 14, the Barrelbeast at 9): a friend's kill before that is a repeat. `src/28-thefang.js`, `src/20-hollowford.js` (the War Shed),
  `src/66-storm.js` (the wind shrine) and `src/33-goblincity.js` (the Arena lever) are the four patterns.
  An instance whose boss simply comes back on every entry says why with `INSTANCES.define(id, { ..., again: 'A plain sentence.' })`:
  The Voice reads it on every visit after the first clear (16-instances, 35-night).
  `refill: false` keeps 75-coop from refilling (or reviving the boss of) a shared instance when a knight walks in: its boss then
  comes back only by a call (the storm).
- Pathfinding: `HOOKS.pathBlock.push((tx, ty, who) => blocked)` keeps tap-to-move and the self-test bot's `walkTo` off a cell the
  knight could step onto but cannot get across right now (an agility log above his level). Test cheaply: it runs for every cell a search visits.
- Instances (`src/16-instances.js`): `INSTANCES.define('my_cave', { name, sub, w, h, build(setTile, rnd), spawns: [[type, x, y]], exit: [x, y], door: [x, y], step: [x, y], boss, onClear, voice, again, refill })`;
  a `door` places a DUNGEON_DOOR tile at world-gen and E on it enters, or call `INSTANCES.enter('my_cave')` yourself and `INSTANCES.leave()`. The instance map replaces `map` while active; the save always records the overworld.
  **Instance-local BUILDINGS** (a roof that lifts when you walk in, inside an instance): mount them into `BUILDINGS` on enter and
  unmount them on every way out, because 16-instances hides the overworld buildings in the instance's rectangle and puts them back
  on leave but knows nothing about yours. The ways out are `INSTANCES.leave`, the L key and the LEAVE button (both call the inner
  leave directly), dying (`respawnPoint`), `load` and a new game (`generateWorld`): wrap `INSTANCES.enter`/`leave`, `load`,
  `respawnPoint` and `generateWorld`, and re-sync from an update hook at the start and the end of the tick. Wrap `drawBuilding` with
  explicit `(g, b)` to draw your own; the core already skips the building the knight stands in, so the roof lifts for free.
  `src/91-cloudkingdom.js` does all of it (`mountSync`) and its self-test K5 proves nothing leaks.
  **Anything drawn at fixed overworld coordinates** (not read off a tile: posts, grave markers, a walking figure) must skip
  instances with `if (window.__instance) return;` — every instance is written into the map's top-left corner, so those coordinates
  are somewhere inside the instance. 45-progression's crossing posts and 54-graves' markers do; 91's K21b checks both.
- Lighting (`src/89-lighting.js`): dark places read one registry. `LIGHTS.add({ tile: 'MY_BRAZIER', r, lift, color, tint, flicker, speed, ox, oy })`
  registers a tile kind as a light — `tile` is the tile NAME, `r` is its reach in pixels, `color` is what it burns and `tint` how much of that
  colour washes the ground. `LIGHTS.addSource(fn)` adds a light that is not a tile (the knight, a boss, a fireball): `fn(out, scene)` pushes
  `{ kind: 'point', x, y, r, lift, tint, color, rgb }`. `LIGHTS.scene(instanceId, { ambient: { color, alpha }, player, rooms: [{ name, x0, y0, x1, y1, lift, color, tint }] })`
  gives a place its darkness and its room lights (soft ellipses that light a whole hall). An instance declared `dark: true` with no scene gets a
  plain cave. `LIGHTS.sample(worldX, worldY)` and `LIGHTS.survey(x0, y0, x1, y1)` report the overlay alpha and its colour in numbers — the same
  maths the painter draws, so self-tests can quote what the screen shows.
- Tap-to-move (`src/17-tap.js`): a tapped tile in `INTERESTING_TILES` gets walked to and used; a tapped monster gets fought. Add your
  own solid tiles to `INTERESTING_TILES` so a tap on them works on the iPad.
- Wiki (`src/44-wiki.js`): the in-game book builds itself from the live tables the first time it opens (K, the WIKI button, or the Wiki button
  under a pack item), so anything you add to `MONSTER_DEFS`, `ITEMS`, `RECIPES`, `SMELT`, `SHOPS`, `REGIONS`, `QUEST_DEFS`, spawn lists and
  instances is in it for free, with drop odds computed the way `rollDrops` rolls them. To add or override a page: `WIKI.add(section, { id, name, ... })`
  where section is `monsters | items | recipes | skills | places | quests`; give a `lines: ['text', { t, c, link: { s, id } }]` array to write the
  page yourself. `WIKI.get(section, id)` reads a page, `WIKI.open(section, id)` opens the book on it. Drop tables kept inside a closure need
  exposing on `window` (see `DOZERUP.BLUEPRINT_DROPS`, `DRAGON_KILLERS.chance`, `SKYCITY.FORGE`) or a `WIKI.add` call.
  own solid tiles to `INTERESTING_TILES` so a tap on them works on the iPad. A feature with its own people list (not `NPCS`) registers it once:
  `TAP_PEOPLE.push(() => MY_PEOPLE.map(p => ({ x: p.px, y: p.py, r: 13, id: p.id, name: p.name, talk: () => myTalk(p) })))` — return the live
  list in pixels (empty when out of reach) and the same talk call your E handler makes; a tap then walks adjacent and talks.
- Touch: every keyboard action needs an on-screen control. Do not place buttons by hand: use the HUD kit (next section) — a seat
  face, a book tile, or a plaque — and write key hints with `keyName('KeyE')` so touch players read "E" or "USE" as appropriate.
- Camera: `HOOKS.camera` is not in the core's table; the first feature that needs it makes it (`HOOKS.camera = HOOKS.camera || []`)
  and pushes `() => ({ x, y })` (pixels, or null). `render` adds every nudge to the centred view before it clamps to the map.
  Keep a nudge a smooth function of where the knight stands (91-cloudkingdom's keep plaza fades over five tiles), so walking never
  makes the view jump.
- `HOOKS.draw` is called as `(g, items, cam)`, and each item you push has its `draw()` called with **no arguments** — so write
  `HOOKS.draw.push((g, items) => { items.push({ y, draw: () => { ...use g... } }) })`. A handler that takes one parameter gets
  the canvas context where it expects the list, and nothing renders, silently.

## Thistledown is a plan (src/94-thistleplan.js, src/95-thistledown.js)

`THISTLE_PLAN.ROWS` is the town: 45 strings of 58 characters over x 84..141, y 13..57, one character a tile, with
the legend in `GLYPHS` (the tile each glyph is painted as, or null to leave the cell alone) and `KIND_OF`. **A town
change is a row change**: move a lamp, a hedge or a bench by editing its row; lamps, benches, trees and every count are
scanned from the rows at load. The painter is the very first world pass (`HOOKS.world.unshift`), runs no random
numbers and writes nothing outside x 85..140, y 14..56, so the rest of the world never moves and every client online
builds the same city; the last world pass snapshots the result as `CAPITAL.base`. The ground layer (setts, flagstones,
lawn, coping) is cached in 8x8 chunks and paints a cell only while its live tile still equals `CAPITAL.base`, so a fire,
a plank or a tilled cell shows the core's own art at once. Every fixed-coordinate draw skips instances
(`if (window.__instance) return;`): Aerie's map overlaps x 85..99 of the town. The ground chunks sort at y -1e9 - 10,
under every other file's ground marks (17-tap's ring and dots, 69-retaliate's ring): a new ground overlay must sort at
or above -1e9. Old saves: on the FIRST load of a save made before the rebuild (`player.cityV` not 1), `CAPITAL.migrate()`
reverts its diffs inside stone, water or a hedge (what was placed is given back) and MOVES a machine, a beast, a wreck or
the mare to the nearest open ground (never deletes one); a cell in `OPEN` ground keeps its diff. After that a knight's
changes in the city are his and no load touches them (a home beside its lodestone included).
The sixteen town buildings (`b.town`) and Death's House (`death2`, its own painter `drawDeathHouse`) draw through the
`drawBuilding` wrap; a door on a north wall (h6, h7, the inn) is a porch drawn as its own item over the step (`drawPorch`). What
never moves on a building is a cached picture (one per building, per day or night, the 10 drawn least lately dropped);
only smoke, lanterns, signs, the awning and banners are drawn each frame, so a new moving part must be drawn in the
`BPASS` 2 pass. The core skips its own ground texture under the cells the city's chunks cover (`window.GROUND_COVER`,
read by 09-render). Night lights (`HOOKS.nightLights`, 35-night) are stamped from one cached picture per radius: push
as many as you like, but give each a whole-number radius.

## HUD (src/59-hudkit.js, the Storybook Heraldry kit) — the API every feature file uses

The HUD is one knight's kit, drawn from one file and laid out by one engine. **Never place a HUD control or readout by
hand.** Every place is reserved in advance, so nothing moves when something appears; a feature asks the kit for a
place and a look. The rules the look follows (so a new piece fits without reading the code):

- Five materials, one job each: IRON studs are things you DO (the four seats, the book's tiles); WAX seals are things you
  OPEN (MENU, FRIENDS, the quest seal, the close seal); LEATHER holds what you CARRY (the belt, the pouches, BAG); dark
  VELLUM carries words (the scroll, the talk page, tooltips, tags); SABLE cloth carries numbers and news (the crest's
  banner, the notice).
- Colour means state. Gold (`HK.T.gold`, `goldHi`) means "look here / ready / selected". Red (`HK.T.gules`, `HK.T.bad`) means
  health or danger ONLY. Green (`good`) = on / healthy, amber (`warn`) = wait / low. `HK.T.friend` blue is for friends only.
- Two type families: Cinzel for names, numbers, ribbons and titles (`HK.FC(weight, px)`, a fixed size), the system sans for
  sentences (`HK.FS(weight, px)`, which grows with Settings › Text size). Draw text with `HK.text(g, s, x, y, { font, align,
  color, halo, shadow })`; wrap sentences with `HK.wrap(g, s, maxW, maxLines, font)` (whole words only; `more` says it ran out).
- Anything on the world gets a plate or a 3 px halo (`halo: 3`). No emoji, no glyph fonts: marks are drawn (`HK.EM`, below).
- Every tap target is at least 44 px; nothing tappable in the notch / Dynamic Island / home-indicator bands or on the stick.
  The self-test (the HUD audit) fails the build if a feature breaks any of this, at every device size.

### Plaques (the column under the quest scroll) — for things that come and go
Call it every frame the thing is live, from a `HOOKS.hud` handler; the kit claims the next free plaque slot and draws it.
```js
HOOKS.hud.push(g => {
  if (!graves.out) return;
  HK.addPlaque(g, { id: 'graves', emblem: 'skull', name: 'GRAVES 3', right: 'risen 1', sub: 'Dusk: the dead are stirring', edge: HK.T.warn });
});
```
Fields: `id` (stable, for the fade-in), `emblem` (a name in `HK.EM`) or `portrait: { hair, skin, tunic, down }`, `name` (Cinzel
caps; shrinks to fit), `right` (a short value on the right, e.g. `'42 / 60'`, `'38s'`), then EITHER `sub` (one line of sans) OR
`frac` (0..1, a bar; `bar: 'good' | 'warn' | 'bad' | colour`, default the health ramp), `stars: { n, of }` (drawn stars after the
name), `edge` (a meaning colour for the plate's edge: `HK.T.bad` for danger, `HK.T.warn` for wait), `nameColor`, `rightColor`.
Returns the rect, or `null` when the column is full (it then folds into the brass "+n" badge on the last slot). Desk and iPad
have 4 slots, phones 2 (1 on an iPhone SE); in a phone boss fight the rolled quest strip takes slot 1.
`HK.plaque(g, rect, fields)` draws one at a rect you already hold. The old `HK.slot(h)` / `HK.claim(h, { w })` still hand out
plaque slots (same cursor, `HUD.leftY`) for code not yet moved; new code uses `HK.addPlaque`.

### Seat faces (the four touch seats: `swing | use | block | ctx`; on a computer, the four medallions on the belt)
There are never more than four seats and they never move; what changes is the FACE a seat wears. Register a face once, at
load time (the call is hoisted, so files before 59 can use it too):
```js
hudSeatFace('ctx', {
  id: 'leave', prio: 30, when: () => inDungeon(),           // the first face whose when() is true wins, highest prio first
  emblem: 'leave', ribbon: 'LEAVE', key: 'L', name: 'Leave', // emblem from HK.EM; ribbon = its word and its button label
  action: leave,                                             // fired on the press (seats are down-fire controls)
});
```
Any field may be a value or a function: `emblem, ribbon, label, key, name, lit` (gold halo: "press me now"), `on` (green halo),
`disabled` (flat grey; the press still fires, so it can say why), `asleep` (45%, nothing to do), `cool: { frac, text }` (a
cooldown sweep with seconds), `charge` (0..1, a gold ring filling outside the rim), `badge`, `hold: true` (a HOLD target: the
press does not fire; read `HK.held('block')` in your update), `learn: 'id'` (its ribbon hides after 20 uses while learning).
The table in use (prio in brackets): **swing** SWING (0), STOMP / RAM in a machine (10), SWING disabled on the mare (10);
**use** the faced verb TALK / CHOP / MINE / FISH / COOK / OPEN / ENTER / USE (0), CRUSH asleep in a machine (10), BOMB in the
Barrelbeast (30, 32-beast), CRUSH lit with a plank in front (50), NEXT while someone talks (100); **block** BLOCK (0,
47-outliers), the machine special (10, 55-riding), LEAVE on your island (30, 64-island); **ctx** RIDE (10, 51-mounts), LEAVE (30, 16-instances), BUILD on your island (35, 63-house),
EXIT in a machine (50), GET DOWN on the mare (50, 51-mounts). `HK.seat(name)` gives a seat's circle `{ x, y, r }`;
`HK.face(name)` the face it shows this frame.

### Book tiles (the Knight's Book: MENU / Esc) — for everything rarely used
```js
hudControl({ id: 'music', emblem: 'music', key: 'N', label: () => 'MUSIC', on: () => enabled, action: toggle });
```
The twelve kit tiles are fixed (BAG, SKILLS, QUESTS, CRAFTING, MAP, WIKI, FRIENDS, CHAT, HOME, HELP, MUSIC, MARKERS); a
registration with one of those ids supplies its live `action`, `on`, `asleep`, `badge`. Any other id becomes an extra tile after
the twelve (the grid grows a row). `show` is ignored for the twelve. Opening a tile closes the book first. Rows on the book's
game page come from `HOOKS.pauseMenu` entries, `(g, x, y, w, h) => button(g, x, y, w, h, 'Title screen', fn)`, drawn as iron
plate buttons (a label starting with Resume / Settings / Title screen / Log out / New game gets its emblem and key).

### Seals, bosses, the crest
- `hudSeal('friends', () => ({ show, wax: 'blue' | 'grey' | 'umber', badge, on, action, name }))` — the FRIENDS seal (73-players).
  HOME and MENU are the kit's own.
- `hudBoss(() => alive ? { key: m, mark: 'goblin' | 'skull' | 'fang' | 'bird', name, lv, hp, max, phase, sub, heart: { hp, max }, edge } : null)`
  — a boss banner (up to two; top centre on a computer and a landscape iPad, the scroll's slot on phones and the portrait iPad,
  where the quest rolls into plaque slot 1). The core already lists any monster of level 25+ and 300+ hp within 12 tiles;
  `phase` replaces "LV n" with a word (FIRE / ICE / STONE). It is evaluated every frame, so return `null` the moment
  the boss is gone.
  - **One monster, one banner (the dedupe rule).** Give `key: m` (the monster object). If the core's generic list already holds
    that monster, your entry REPLACES the generic one in place (same slot, your name, sub and heart row); it is never shown twice.
    The kit does this at the start of `HK.layout()` (even when `hudBosses()`'s cap of two had cut your entry). An entry with no
    `key`, or a key no one else lists, adds a banner. The Fang (28), the cinderwight (46) and the storm bird (66) use this.
  - `sub` — a short sentence that says what to do now ("Wait it out", "Break the heart", "On the mast: hit it now"). On the full
    banner it sits on its own row under the bar (sans, goldHi): the NAME shrinks first, then LV / the phase gives way on the name
    row, and the sub shrinks to 9.5 px and then drops — it is never cut inside a word. On a compact banner (two bosses on a phone)
    the sub takes LV's / the phase's place on the name row if it fits there, and otherwise drops.
  - `heart: { hp, max }` — an amber bar on the sub's row ("HEART 23 / 40"); on the narrowest plates it becomes the amber number,
    and on a compact banner it is a number on the main bar ("312 / 520 · heart 23").
  - **Status-only banner:** leave `hp` or `max` null and the banner draws no bar and no numbers, only the name line (with `phase`
    if you give one) and the sub sentence (up to two whole-word lines). It keeps the 58 px cap and the same slots.
  - `edge` — the plate's edge colour, as a meaning (gold = "hit it now"; a cool blue for "keep moving"). Default: the red edge.
  - Test through the kit, not pixels: `HK.FRAME.bosses = hudBosses(); const L = HK.layout();` then read `HK.FRAME.bosses` /
    `HK.cur().boss`, and `HK.drawBosses(HK.audit.fitCtx(log), L)` records every string it paints into `log` ({ s, x, y, font,
    fill }; a string with a drop shadow is recorded twice, the shadow's fill is `rgba(0,0,0,…)`).
- `hudMechName(() => riding() ? 'Nell' : null)` — the machine's name on the crest (its hp is the crest's big number).

### The notice (`notify(text)`)
One line of sans on the sable swallowtail ribbon, in the notice lane (it fades in over 150 ms and stays about 2.8 s). On
touch, 13-ux's `touchify` has already renamed the keys ("press E" -> "tap USE"). **On the computer a key the sentence names is
drawn as a keycap inside the line**: 13-ux's `deskKeys(text)` matches only "Press X" / "press X", "(X)" and "X to ...", where X
is a letter, Space, Tab, Enter, Esc, F1 (or 1-5 after "press") AND a key the game's own key table lists (`SETTINGS.keyMap()`,
read from the real handlers, plus `HOOKS.keyHelp`). So write notices the plain way, `notify('Press E to climb in.')`, and
declare any new key in `HOOKS.keyHelp`. The ribbon grows inside its lane to hold the keycaps; if they cannot fit on one line at
11 px it falls back to the plain sentence (wrapped at words, never cut).

### Tooltips, the long-press name, the coach
- A HUD control's tooltip (computer, after 350 ms of hover) and its long-press name (touch, 400 ms: it names instead of firing)
  come from its `buttons[]` entry: `{ name: 'World map', keys: ['M'], sub: 'Click to open the big map' }`.
- The coach: `HK.teach(id, key, verb, at, { emblem })` — call it every frame the action is available; it shows a vellum tag with
  the keycap (on touch: the seat's emblem) the first 3 times it appears (counted in `localStorage` `fl_coach_<id>`, once a session
  if storage refuses). `at` is `{ x, y, lift }` in world pixels (the tag sits above the thing) or `{ sx, sy }` in screen pixels.
- A small vellum tag anywhere: `HK.tag(g, x, y, label, { key, emblem, side: 'right' })`.

### Controls and input (05-input.js)
`buttons[]` entries: `{ x, y, w, h, label, action }` plus, optionally, `r` (+ `cx`, `cy`: hit as a circle), `up: true` (fires on
pointer-up inside; sliding off cancels; held 400 ms it names itself), `hold: true` (a hold target), `inert: true` (swallows the
press, does nothing: a disabled button), `name` / `keys` / `sub` (its tooltip). `button(g, x, y, w, h, label, action, colour,
enabled)` draws an iron plate button and pushes an `up` entry; its colour is read as a meaning (green = primary, red = danger).
The press shows in the very next frame: `HK.stateOf(label)` → `{ pressed, hover, ripple }`; `HK.press` / `HK.hover` are the live
press and hover. A HUD control under an open panel takes no taps (10-hud drops it).

### Drawing with the kit
Primitives are plain `(g, ...)` canvas functions: `HK.stud(g, cx, cy, r, emblem, state)`, `HK.seal(g, cx, cy, r, emblem, wax,
state)`, `HK.pouch(g, rect, item, key, state)`, `HK.satchel(g, rect, state)`, `HK.plateButton(g, rect, emblem, label, tone,
state)`, `HK.bookTile(g, cx, cy, D, emblem, word, key, state)`, `HK.plaque(g, rect, fields)`, `HK.bossBanner(g, rect, boss)`,
`HK.noticeRibbon(g, rect, text, alpha, slide, { keys })`, `HK.banner(g, rect, { kind: 'area' | 'level', title, sub, alpha })`, `HK.meterBar(g, x,
y, w, h, frac, colour, { ticks, trail })`, `HK.ribbon(g, cx, cy, label, o)`, `HK.badge(g, cx, cy, text, size)`, `HK.keycap(g, x,
y, key, size)`, `HK.tooltip(g, anchor, title, keys, sub, avoid)`, `HK.vellumPlate(g, x, y, w, h)`, `HK.bookCover` / `HK.bookPage`,
`HK.brackets(g, x, y, w, h)` (the gold world-prompt corners). A `state` is `{ pressed, hover, lit, on, disabled, asleep, cool:
{ frac, text }, charge, badge, ribbon }`. Emblems: `HK.emblem(g, name, cx, cy, size, colour, { hole })` with `name` from
`HK.EM`: swing sword stomp ram hand talk chat block goblin bag pin play castle erase craft quests home bomb exit leave map
skills wiki book help music friends menu fang expand cog gear star skull horseshoe getdown door tick cloud axe pick hook
pot next crush bolt key bird prop drill build arch coin heart swords chevron chevronR chevronL close. Static layers go
through `HK.cache(g, key, x, y, w, h, draw, pad)` (drawn once per size, DPR and state), so a feature's art stays cheap.

### Panels (anything opened with `openPanel`, drawn from `HOOKS.panel[name]`)
Every panel wears the same frame and follows one contract, so a new one looks like it belongs:
- **Frame:** `const { px, py, w, h } = panelBox(g, w, h, title, sub)` — the book frame, centred and clamped to the screen; it sets
  `panelRect` (a tap outside closes, a tap inside is absorbed) and draws the umber close seal, labelled `'×'`, radius `HK.row() / 2`.
  Lay everything out inside `{ px, py, w, h }`; never draw a frame of your own.
- **Words:** `HK.text(g, s, x, y, { font, color, ... })` with `HK.FS(600, px)` for sentences (they grow with Text size) and
  `HK.FC(800, px)` for names, titles and numbers (fixed). Wrap sentences with `HK.wrap(g, s, maxW, maxLines, font)` — whole words
  only; when `more` comes back, end the line there and put the rest one tap away. **Never cut a word with an ellipsis.**
- **Colours:** from `HK.T` only (`ink`, `inkDim`, `inkMute`, `gold` / `goldHi` for selected / look-here, `good`, `warn`, `bad`,
  `friend`). Red means health or danger only.
- **Rows:** a list row is an `HK.vellumPlate(g, x, y, w, h)` of `HK.row()` height (44 on touch, 32 with a mouse), with its text inset 12 px.
- **Items:** `drawSlot()` draws an item as a leather pouch; on touch a pouch is 44 px or more.
- **Verbs:** `button(g, x, y, w, HK.row(), label, action, colour)` — an iron plate button fired on pointer-up; green or a dark
  gold (`#9e6a03`) = primary (the chosen one), red = danger, anything else neutral. Keep 8 px between buttons on touch.
- **The pack's foot:** a feature that needs a control in the pack pushes a row onto `PACK_ROWS` (10-hud):
  `{ id, show?: () => bool, minW?: (g, h) => px, draw: (g, x, y, w, h) }`. The pack measures the row in, so it never lands on
  the grid or the verbs; on an upright phone one row rides beside the keyring when `minW` fits. 69-retaliate's Fight back is one.
- **Two panel kits:** `PANEL_KIT` (10-hud: the core panels and the Wiki) and `PLACE_KIT` (29-quests: the bank, the notice board,
  the oven, the capes, the dozer bay, Fennick's rail, the wreck and Nix, the island build). Both draw the same kit pieces; size a
  panel from `PANEL_KIT.room()` (`aw` / `ah`: inside the notch and home-bar insets), never from `VW - 20` / `VH - 20`.
- **Tabs:** plate buttons in a row, the selected one in the primary tone.
- **Pages:** reserve one `HK.row()` at the bottom for `pager()` (the chevron plates and "2 / 5") even when there is one page, so
  nothing jumps when a second page appears.
- **The per-panel audit recipe** (write it into your file's `HOOKS.selfTest`):
  ```js
  const own = k => Object.getOwnPropertyDescriptor(window, k), keep = { w: own('innerWidth'), h: own('innerHeight'), t: window.__forceTouch };
  const problems = [];
  for (const [w, h] of HK.audit.SIZES) for (const t of [true, false]) {
    window.innerWidth = w; window.innerHeight = h; resize(); window.__forceTouch = t;
    closePanel(); openPanel('mypanel');
    HK.FIT.on = true; HK.FIT.log.length = 0; if (window.SETTINGS) SETTINGS.set('text', 'large');
    drawHud(HK.audit.fitCtx()); HK.FIT.on = false;
    const all = buttons.filter(b => !b.offscreen && b.w > 0), i = all.findIndex(b => b.label === '×');
    const mine = all.slice(i);                // the panel's own controls: the close seal and everything after it
    // each: on screen, 44 px or more on touch, no two overlapping (8 px apart on touch)
    for (const p of HK.audit.fitIssues(`${w}x${h} ${t ? 'touch' : 'mouse'}`)) problems.push(p);   // every string fits at Large
  }
  // then put back innerWidth / innerHeight (Object.defineProperty with keep.w / keep.h), resize(), __forceTouch, the text size
  ```
  59-hudkit's check 11 does exactly this for the pack, Friends, the Chat log and Give.

### Geometry
`HK.cur()` is this frame's layout: `crest`, `mm` (the ring: `{ x, y, r, R }`), `seals`, `scroll`, `plaques`, `boss`, `notice`,
`banners`, `dialog` (the talk page), `belt`, `pouches`, `bag`, `seats`, `stick` (`{ x, y, r, keep }`), `S` (the safe insets), `fam`
(`desk | tab | phoneP | phoneL`). `HK.lane('chat', n)` is the chat strip's lane for n lines; `HK.lane('notice')` the notice
lane. `HUD_LAYOUT` keeps `questX / Y / W / H` (the scroll, or the rolled strip), `hotbarY / H` (the belt) and `bossBarY`. The
minimap is drawn by 09-render's `drawMinimap` inside the ring's round glass; `minimapRect` is the glass's square, for dots.

### The audit
`HOOKS.selfTest` in 59-hudkit runs the layout engine over the spec's matrix and then draws the real HUD at every device size
(iPhone SE / 12 / Pro Max both ways, both iPads, a laptop), touch and mouse, stick either side, minimap on and off, offline and
online with chat, 0 / 1 / 2 bosses, on foot and in each machine, at every text size, plus the busy fight, the talk page, a
dungeon, the Fang (fire and stone), a feeding cinderwight, the storm bird perched and hunting, your island, and the book — and fails on any overlap, anything under 44 px, anything in a safe-area band or on the stick, anything
off screen, anything that moves between scenes, or any string that does not fit its plate at Large. It also checks that one monster gets one boss banner and that a notice's key is a keycap on the
computer and plain words on touch. `HK.audit` exposes the
pieces (e.g. `HK.audit.frameIssues(where)` after a `drawHud`) so a feature's own check can use them.

## Useful core functions

`say(text, who)`, `notify(text)`, `floatText(x, y, text, color)`, `burst(x, y, color, n, speed)`,
`addItem(id, qty)` (returns what did not fit), `removeItem`, `countItem`, `coins()`, `payCoins(n)`, `giveOrDrop(id, qty, x, y)`,
`gainXp(skill, xp)`, `skillLv(skill)`, `combatLevel()`, `hitMonster(m, dmg, knock)`, `hurtPlayer(dmg, fromX, fromY, sure)`,
`rollHit(attRoll, defRoll, maxHit)`, `playerAttackRoll()`, `playerMaxHit()`, `moveEntity(e, dx, dy, 'person'|'beast'|'rider')`,
`collides(x, y, r, who)` (who: `'player'` the knight on foot, `'person'` villagers, `'beast'` monsters, `'rider'` the knight on any mount or machine —
a beast that rides through a GATE or a PORTCULLIS but not a DOOR; `playerWho()` gives the knight's own), `changeTile(tx, ty, t)` (persists), `tileAt`, `insideBuilding(tx, ty)`, `regionAt(tx, ty)`,
`levelBanner = { text, sub, t }` (banners queue: one replaced within 1.5 s comes up after the new one; `bannerAhead(text)` asks whether it is on screen or waiting), `openPanel(name, arg)`, `closePanel()`, `drawHuman(g, e, look)`, `drawMech(g, e, hurt, pilot)`, `drawItemIcon`.
Monsters: `monsters` array (each has `x y r hp maxHp state angry dead home facing`), `MONSTER_SPAWNS`, `spawnMonsters()`.
Player: `player.x/y/hp/maxHp/facing/equip/inv/skills/mech/home`.

**A feature that draws must not assume update() ran: 79-view calls render() with only PLAYERS, CHAT and COOP stepped.** The
teacher view's Watch (docs/ONLINE.md, "The teacher view") draws a kid's screen on the teacher's own page with the game's own
renderer, and that page never runs `update()`, never saves and never loads a knight: `title.active` stays true, `player` stands
where the kid is (never dead, never on a machine, never drawn), `time` and `player.dayTime` move on, and only
`PLAYERS.step(dt)`, `CHAT.step(dt)` and `COOP.viewStep(dt)` run each frame. A draw hook or a `HOOKS.draw` item must read what
it draws from state it keeps current itself (or from what those three keep), never from something only an update hook
advances, and must never write to storage while it draws (the teacher's page writes nothing).

### The knight (`src/82-knightgear.js`)

The knight is drawn in his own style, wearing each item's own shape (the owner's approved "knight gear" look). A KNIGHT
look is any look with a `gear` object `{ helm, body, legs, shield, cape, weapon }` (item ids or null); `playerLook()` adds
it, 73-players sends it, `title.KNIGHT` has one. `drawHuman(g, e, look)` sends a knight look to `KNIGHTGEAR.draw(g, e,
look, opts)`; a townsperson's look (`who`) is 83-townsfolk's, and every other look (the monster guards' own parts) goes to the old drawing, untouched.
- A knight look with `stone: true` (95-thistledown's statue of the knight himself) is drawn in stone: every colour he
  sets goes through a stone palette, his clock stopped. While `e.hurtT > 0` the whole knight flashes red the same way
  (every colour, drawn live), so the flash shows through a closed helm and plate.
- To draw the knight somewhere new: `drawHuman(g, e, playerLook())`, translated to his feet's centre (draw your own
  shadow). `e.seated` (or `opts.seated`, or being inside `drawMech` / `drawDozer` / the barrel beast) leaves his legs off.
  Sitting IN something (the ferry's bow), `e.seatLine` (a y in his own frame) cuts off everything of him below it: a stave,
  a robe's hem stay inside the boat.
  A panel that shows him big fits him with `KNIGHTGEAR.fit(look, w, h, foot, maxScale)`: he is taller than the old
  knight (an upright spear, a party hat).
- His pose (weapon angle, hand) lives in a WeakMap keyed by the entity, never on it (the player is saved whole).
- Pictures (`opts.cache`) are for 73's world-scale remote knights only, and only onto the world canvas `ctx`.
- A slot with no known id is read back from the look's colour fields (`helm`, `body`, `shield`, `weapon`, `hat`).
- Do not draw things onto the player from a draw hook (a loose tool, a second cape, wings, a raised shield): the knight
  draws what he wears and holds himself, in its place in front of or behind him. A new action that holds a tool maps
  its type in 82's `TOOL_ACTS` (the knight then holds that tool in his hand); the block's shield comes from
  `look.block`. 82's self-test fails if anything else paints at the player's place in the draw list. A thing held still
  (no swing) is a `STILL_TOOLS` tool: `stone` (the royal mine's warming stone, `look.toolHeat` its heat) and `rope` (the
  lobster pot's). Something drawn from his hand (the pot's rope) starts at `KNIGHTGEAR.handAt(e)`: where his weapon hand
  was last drawn, from his feet's centre, in world pixels.
- A NEW WEARABLE ITEM draws as its family's plain piece (a plain helm, plate, heater shield, sword) until it gets a
  branch: `helmFam` / `bodyFam` / `shieldFam` / `weaponFam`, or its metal in `tierOf` and the tier switches. The
  self-test draws every wearable in the game and names any two of a slot that draw the same shape.

### The mounts (`src/51-mounts.js`, `src/84-mountlook.js`)

Cinder draws herself in 51-mounts (`MOUNTS.drawHorse(g, e, hurt, riderLook)`, her middle at the origin, hooves 21.5 px
below: side-on, front, behind, the knight seated in her saddle; her own shadow). The knight's walker, bulldozer and
Barrelbeast are the monster refit's machines (`MONSTER_LOOK.drawMachine` with the knight as its pilot), drawn by
84-mountlook at the size of the knight's own machine bodies: `MOUNT_LOOK.machine(g, e, kind, { pilot, parked, wreck, hurt,
hp, maxHp, up })`. It also draws parked machines and wrecks, a friend's mount online (`MOUNT_LOOK.rider`), and a gate
standing open while a rider is in it. `MOUNT_LOOK.roof(kind, facing)` is where something stands on a machine (55-riding's
beacon), `MOUNT_LOOK.top(kind)` how far above its middle a name or a coach tag goes. 84 is pictures only (stripped from the
server copy): a kept file reads it only from drawing code.

### The townsfolk (`src/83-townsart.js`, `src/83-townsfolk.js`)

Every follower and non-fighting townsperson is drawn in the owner-approved townsfolk look. `83-townsart.js` is the
approved sample's drawing code (`~/.fanglands/work/npc-sample`), generated by `~/.fanglands/work/townsfolk/gen/make-art.py`:
never edit it by hand. `83-townsfolk.js` is the glue.
- A person is known by `look.who`, the sample's id, put on the look by the call site. Never by colour. A look with
  `who` (and no `gear`) goes to `TOWNSFOLK.draw`; every other look goes on down to the old drawing, the knight and the
  monsters untouched. Goblin City's Pip is `'pipsqueak'`; both Deaths are `'death2'`.
- A call site builds its look with `who`, and when `TOWNSFOLK.takes(look)` is true it translates to the feet's centre
  and leaves out its own shadow, bob, extra scale and overlays (wings, hats, beards, ears): the drawing has them all.
  `TOWNSFOLK.put(g, x, y, e, look)` does the translate and returns whether the new look took it.
  `TOWNSFOLK.labelUp(who, old)` is how far above the feet the name goes. The gold talk brackets (24's
  `PEOPLE_UI.brackets`) reach over the new head by itself: 83 sets `p.up` from the person's name.
- What it reads from `e`: facing, moving, walkT, attackT, hurtT, and `seated` (no legs, no shadow), `air` (no ground
  shadow), `unarmed` (an empty main hand), `flapK` (wings beat faster). The person whose line is up (`dialog.cur.who`)
  and within 4 tiles of the knight talks.
- An id the sample does not draw gets the sample's `npcFromToday` from the look's flags (tunic, hair, woman, beard,
  apron, helm, crown, wing): a villager in the new style. A NEW PERSON goes into the sample (a family file in
  `groups/`), then the generator is run again.
- On the world canvas `ctx` at the screen's own scale a person is a picture (per person, facing, frame and pixel
  ratio). Talking, seated, stone, scaled or turned, a person is drawn live. Standing, a person's pictures loop on
  their own clock (`LOOP`, 2 to 6 s, measured so the loop's end meets its start; 83's check 12 measures it again): a
  NEW PERSON whose slow motions jump at the loop's end gets a `LOOP` entry, or goes into `LIVE` (drawn live) when no
  loop meets it. Only one person talks at a time: the nearest whose name matches the line's.
- Stone (`look.stone`, the statues) draws every colour in stone with the clock stopped. `HK.portrait` with `o.who`
  draws the person's head and shoulders.

## Coordinates: frames, ports and the world

The overworld grew from 260x180 to 400x280 (the Great Spread, Stage 4a; spec in `~/.fanglands/work/spread/spec.md`,
artefacts and tools in `docs/spread/`). Every old place moved rigidly to its new spot and the land between them
stretched, so a bare map number like `112` is wrong: the old square at 112,33 stands at 169,52 now. Every overworld
position is written as a read of the Atlas (`src/01-atlas.js`), never as a bare literal. The numbers you write in a
frame are still the OLD map's (the frame adds the place's offset); a new place's ports, the road network
(`ATLAS.TRACKS`, its points `['n', x, y]`) and the new grounds (`ATLAS.GROUNDS`) are written in the new map's own
numbers. Since 4a: `ATLAS.box(id)` of a reserved place is its plan box, `ATLAS.reservedAt(x, y)` and
`ATLAS.onMainRoad(x, y)` say where nothing may be built, and `ATLAS.signText(x, y)` is what a road's signpost says.

- **A place's own point** goes through its frame: `const TD = ATLAS.frame('thistledown'); TD.p(112, 33)` gives `[x, y]`,
  `TD.x(112)` / `TD.y(33)` one axis, `TD.pt({ x, y, ... })`, `TD.pts(list)`, `TD.rect({ x0, y0, x1, y1 })`,
  `TD.box([x0, y0, x1, y1])` keep their other fields. The numbers you write are TODAY's coordinates (the old map); the
  frame adds the place's offset. Pixels: `TD.x(112) * TILE`. Loops and comparisons are wrapped by hand:
  `for (let y = F.y(20); y <= F.y(40); y++)`, `x >= F.x(142)`.
- **A named point** (a door, a gate, a road end, an NPC's spot) is a port: `ATLAS.port('thistledown.square')`. If the
  point you need has no port, add one to `PORTS` in `src/01-atlas.js` rather than copying its numbers.
- **A place's whole box** is `ATLAS.box('deepholm_rock')`. Copies of another file's table (VILLAGE, REGIONS, a rect
  declared elsewhere) are read from that table, never retyped.
- **Open land** (the fields, the sea, a scan window, a seam row) is the stretched world: `const W = ATLAS.world;`
  `W.tx(150)` / `W.ty(40)` give whole tiles, `W.x` / `W.y` reals, `W.ix` / `W.iy` the inverse. World noise and curves
  are evaluated in OLD coordinates through the inverse (`noise(W.ix(x), W.iy(y))`), so their shapes stretch and stay
  bit-identical until the spread. A seam that must meet a place's gate goes through its pin:
  `W.pin('rim', W.y(95), x)` (see `ATLAS.PINS`: rim, gw_steps, giants, jungle_west, river, strait, sea). Near the pin's
  port the seam moves with the port's place by its OWN old value (a seam three rows below the steps stays three rows
  below them), so always pass the seam's value: never take an offset as `W.pin(id, 0, x)` (the pin at row 0 is not the
  pin at the seam). A band of rows about a seam is `W.pin(id, W.y(lo), x)` .. `W.pin(id, W.y(hi), x)`, and a row of it
  maps back to its old row with `W.iy(W.unpin(id, y, x))`. A place feature that must sit ON a seam (the scarp's steps)
  is cut at its port, not found by searching the seam.
- **A road or path is a track**: read it with `ATLAS.track('road_cave')` (a list of `[x, y]`, each point a port, a
  place's own point or a world point), never as a literal polyline. A new road goes into `TRACKS` in `src/01-atlas.js`,
  written the same way (`['port', 'thistledown.west_gate']`, `['thistledown', 84, 32]`, `['w', 60, 70]`). A guard or
  verge round a road is built from the track itself (every tile within N of it), not from two corners in two frames.
- **The Ashfields / Jungle wall** (the old x 100 line) is `ATLAS.world.line('jungle_west', y)`: the region split, the
  Ashfields' east edge, the rim's last column and the burnt band all read it, so they move with the wall's pin.
- **Which place owns a literal**: the one whose old box holds it. `node tools/anchor-of.mjs 140 80` answers (smallest box
  wins; an undecided overlap is refused). Something relative to a place belongs to that place even outside its box
  (the warden's notch, the giants' gap, a guard rect round a building, a road end at a gate). Anything a test asserts
  by position, a door, an NPC or a named spawn is never "world": give it a port or a frame.
- **Never wrapped**: sizes, radii, counts, durations, screen pixels, and an instance's own map (any map other than
  `'over'`). Those go in `docs/spread/literals-allow.json` with a one-line reason when the counter mistakes them for
  positions.
- **The gate**: `build.sh` runs `node tools/literals.mjs --gate` over every file of `src/` and `tools/` (repo-wide since
  Stage 3). A bare coordinate fails the build with "wrap it: ATLAS.frame('<place>') or ATLAS.world". It counts
  pairs, points, rects, tile calls, `tc(N)`, `N * TILE`, comparisons, a centre after a coordinate pair
  (`near(x, y, 66, 57, ...)`, `dist(x, y, 140, 76)`) and a distance to a place (`Math.hypot(x - 140, y - 76)`). Run
  `node tools/literals.mjs src/NN-file.js` to see what it counts. An allow entry names the `literal` it lets through and
  pins it to its declaration (`"decl": "LAW_ARM_RANGE"`), to text on its own line (`"context": "remote('Ann', 'over',
  player.x + 2 * TILE"`, for a literal in an unnamed hook or test) or to its `line`, so it never covers a new position
  elsewhere in the file. The gate refuses an entry with no literal (a whole line), bar a `decl` alone that names exactly
  one declaration in the file. In a file a peer branch also edits, pin by `decl` or `context`: a `line` pin moves under
  the peer's edit and the merge fails the gate. The gate reads `src/[0-9]*.js` and the top level of `tools/` only;
  `online/src/`, `online/test/`, `tools/sim-bench/` and `tests/` are outside it until Stage 4d (docs/spread/README.md).
- **A new feature file is written in frames from the start** and is added to `docs/spread/converted.json` in the same
  commit. The gate is repo-wide (Stage 3): it reads every file of `src/` and `tools/`, listed or not, so a bare number in
  a new file or a new tool fails the build. Only a file an open peer branch is editing may wait, in
  `docs/spread/held.json`. A tool reads the Atlas inside the game it drives (`A.ATLAS.world.tx(40)`). A frame point far outside its own place (past the
  box + guard + 12) is logged by the strict report (`ATLAS.strict()`), which `tools/headless.js` and
  `tools/fingerprint.mjs` fail on unless `docs/spread/strict-allow.json` lists it.
- **Proving nothing moved** (until the spread every frame, the world and every pin are the identity):
  `./build.sh && node tools/fingerprint.mjs index.html --diff docs/spread/baseline-fingerprint.json` must say
  identical, and `git diff --exit-code online/src/atlas.json` must be clean.

## Adding land at an edge (ADDENDUM C of the spread spec)

The map stays 400 x 280; it grows later at its **east and south edges**, never by another stretch. So the outer 8-tile
ring of the east edge (x >= MAP_W - 8) and the south edge (y >= MAP_H - 8) holds no place, port, building, person, wall
or cliff: only the east sea (x 392..399, `ATLAS.GROUNDS.east_sea`) and open grounds (the Jungle, the Grub Fields, the Ash
Wastes' reserved Wilds). `src/97-spreadchecks.js` holds that (`spread map: ADDENDUM C`). The cave stays pinned at 0,0.

To add land at an edge:
1. Raise `MAP_W` (east) or `MAP_H` (south) in `src/00-core.js` and the plan's `PLAN_W` / `PLAN_H` in `src/01-atlas.js`.
   No existing tile index moves except through a save's own width remap (04-state); every place keeps its `at`.
   `ATLAS.WORLD`'s last breakpoints stay where they are (the old land does not stretch again): add a breakpoint at the
   old edge so the new strip maps one to one.
2. Give the new land its REGIONS entries (a ground, or a box per place, ahead of the broad grounds) and its Atlas places:
   an anchor per place (`ANCHORS`, with `newBox` while it is reserved), its ports (`PORTS`, `['new', x, y]`), and its
   roads as `TRACKS` (main roads in `MAIN_ROADS`). Move the east sea out to the new edge (`GROUNDS.east_sea`), so the
   ring at the new edge is again only sea or open ground.
3. Bump `WORLD_REV` with a footprint (`ATLAS.REVS`) of the new strip only: the save migration sweeps that strip and
   nothing else, and the FOOTPRINT proof shows no tile outside it moved. (`WORLD_REV` lives in `src/00-core.js` and
   `ATLAS.REVS` in `src/01-atlas.js` since spread Stage 4c; see "Saves and the world's version" below.)
4. Re-run the gates; `tools/spread-report.mjs` reprints the walk-clock and the other tables, and `atlas.json` is
   regenerated by `./build.sh` (atlas-drift then gates the deploy).

## Saves and the world's version (the save migration, spread Stage 4c)

A save names the world it was made in: `worldV` (`WORLD_V`, 2 since the Great Spread: the 400 x 280 map) and
`worldRev` (`WORLD_REV`, the minor). `src/97-spread.js` brings an older save in (`HOOKS.saveIn` runs its
`SPREAD.prepare` right after the parse; its own load wrapper, the outermost, runs `SPREAD.finish`): the knight wakes at
spawn, what the story changed is made again from quest state, what he placed comes back to his bank (or pack, or Aldous
keeps it), his machines are parked round the Dozer Bay and the mare is tied at her rail; everything else of the old map
is cleared. A save from a newer world is refused (`SAVE_LOCK`, the NEWER WORLD plaque). What a feature owes the migration:
- **A tile the story changes** (a door opened, a town rebuilt, a gate thrown open: anything a quest does with
  `changeTile`) needs a `HOOKS.remake`: an idempotent function that lays those tiles again from quest state,
  `HOOKS.remake.push(Object.assign(() => { if (Q().opened) changeTile(...DOOR, T.DOOR); }, { remakeOf: 'NN-file' }))`.
  It must say nothing, pay nothing and save nothing (keep the words in the quest's own handler, as 31-rebuild's
  `TILES_OF` does). The migration also uses it to tell a story tile from a placed one.
- **A tile placed from an item** is refunded as that item when its `ITEMS[id].place` names the tile; a feature that
  places a tile some other way adds `HOOKS.placedFrom.TILE_NAME = 'item_id'`.
- **A machine or a mare** is one of `SPREAD.MACHINES` (`MECH`, `DOZER`, `BEAST` and the three wrecks) or `HORSE`; a new
  vehicle tile is added there, so it is parked and never lost.
- **A position kept in the save** (on `player` or `quest`) must be on `SPREAD.HANDLED` with what the migration does
  with it: `node tools/spread-migrate-check.mjs` (the sweep) fails on a position-shaped value at a path it does not name.
- **Every `changeTile` call is counted** in `docs/spread/changetile.json` (`tools/changetile-gate.mjs`, run by
  `build.sh`): a new call stops the build until it is classified there, and a story tile names the file whose remake
  makes it. A later stage that changes ground knights may have built on bumps `WORLD_REV` and declares its footprint in
  `ATLAS.REVS[n] = { boxes }`: an older worldRev's save is swept in those boxes only (`SPREAD.sweep`), the same way.

## The new map's checks (Stage 4b)

`src/97-spreadchecks.js` holds the map to the spread spec: named places 25+ tiles apart, the walk-clock (section 1's
trips, the shortest 8-connected walk with root-2 diagonals, story gates open; a trip the open land makes shorter than
its window is held in `WALK_HELD` for the owner, with its measured time and reason), every port reached from the cave
mouth, each story gate holding when shut, the scarp seal (the two road bridges and the Agility 18 steps, nothing else),
seam transects (8+ tiles of blend), main roads clear of solids and props, aggressive spawns 6+ tiles off a main road,
the edge ring, and the beat-gap report. `node tools/spread-report.mjs` prints every table. `tools/compass.mjs` (run by
`build.sh`) holds every line with a direction or distance word to a row in `docs/spread/compass.json`, checked against
the Atlas: a new line saying "north of the inn" needs a row `{ file, match, from, to, dir }`, or `local` with a reason
for a line about a place's own inside. `node tools/boot-budget.mjs --chromium` measures world generation (node <= 2.0 s,
Chromium at 4x CPU <= 4.0 s; `--workerd bench.json` reads `tools/sim-bench.mjs`'s local workerd boot and heap).

The world map panel names places through `src/61-maplabels.js` (`MAP_LABELS`): one label per Atlas place, laid out by
priority and nudged off rings; a new place needs no label code, only its Atlas place (and its tier in `TIERS` if it is
a town or a landmark). People are markers, not labels.

## Self-test

Register checks: `HOOKS.selfTest.push((check, F, h) => { ... check('name', boolean, infoObject); ... })`.
`F` is `window.FANGLANDS` with the bot: `F.tp(tx,ty)`, `F.walkTo(tx,ty)`, `F.goAdjacent(tx,ty)`, `F.face(tx,ty)`,
`F.press('KeyE')`, `F.sim(steps, ['KeyD'])`, `F.step()`, `F.fight(max, ['type'])`, `F.talk('npcId')`, `F.clickButton('label')`,
`F.untilAction(max, () => cond)`, `F.nearestTile([T.X])`. `h.give(id, qty)`, `h.peace(true)` (monsters ignore you), `h.openSpot(x, y)`.
Checks run inside the browser: the integrator runs `FANGLANDS.selfTest()` after merging. Keep checks deterministic:
teleport with `F.tp`, set monster positions/hp directly, use `h.peace(true)` around timed actions.

## Verify locally (headless)

`node tools/headless.js` builds nothing; it loads `index.html` with a stubbed DOM/canvas and runs `FANGLANDS.selfTest()`,
printing every check. Run `./build.sh && node tools/headless.js` after every change. Drawing code is not exercised (the
canvas is a stub), so read your draw code carefully.

## Verify locally

`./build.sh` must print `built index.html` (it syntax-checks with node). You cannot open a browser from a
subagent; write the self-test checks and reason carefully about them. The integrator runs them.
