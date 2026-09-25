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
- `RECIPES.push({ out, qty, needs: [[id, n]], station: 'workbench'|'anvil'|'workshop'|'alchemy'|null, skill, lv, xp, label })`,
  `SMELT.push(...)`, `SHOPS.my_shop = { name, stock: [[id, price]] }`.
- Tiles: `const MY = addTile('MY', { solid, push, placeableOn, tex: 'cobble'|'dirt'|..., mini: '#hex' })`.
  Draw it with `HOOKS.draw` (push `{ y, draw }` items for the visible range) — read `cam`, `VW`, `VH`, `TILE`, `tc()`.
- World: `BUILDINGS.push({...})` (same shape as the existing ones; `stone`, `door`/`doorTop`, `f` furniture),
  `NPCS.push(initNpc({ id, name, x, y, tunic, hair, role, ... }))`, `REGIONS.unshift({ name, sub, x0, y0, x1, y1 })`,
  and `HOOKS.world.push((rnd, api) => { ... })` to carve terrain: `api.setTile/tileAt/spawnList(type, [[x,y],...])/road(points, tile, width, chance)/pen(...)`.
  The map is `MAP_W`×`MAP_H` = 260×180 tiles. Built land: x 0–199, y 0–139 (the Grey Sea fills x 162–199, y 0–95).
  Free for features to carve: the far east beyond the sea (x 200–259, y 0–179: reach it by Harl's ferry) and the south band (y 140–179).
  `WALK_OVER` (a Set in 00-core) lets the player cross tiles it contains (e.g. `WALK_OVER.add(T.WATER)` while hover armour is worn).
- Quests: `QUEST_DEFS.my = { name }`, `HOOKS.questText.my = () => '...'`, `HOOKS.activeQuests.push(() => cond ? ['my'] : [])`.
  Main story after stage 8: `HOOKS.mainQuest[9] = { text: () => '...', onEnter: () => { say(...); } }`; call `advanceQuest(9)`.
- Behaviour: `HOOKS.update.push(dt => ...)`, `HOOKS.use.push((t, tx, ty, building) => handled)`,
  `HOOKS.talk.my_role = npc => ...`, `HOOKS.hit/kill/hurt`, `HOOKS.hud.push((g, narrow) => ...)`,
  `HOOKS.panel.my_panel = (g, narrow) => { const { px, py, w, h } = panelBox(g, 460, 300, 'Title', 'sub'); button(g, ...); }`.
- State: keep feature state inside `quest.myFeature = {...}` or `player.myFeature = {...}` — both are saved and
  loaded automatically (they are plain JSON). Reset it in `HOOKS.newGame`.
- More hooks: `HOOKS.talkBefore.my_role = npc => handled` runs before the core dialogue; `HOOKS.mapTarget.push(() => ({ x, y, label }))`
  puts a marker on the world map; `HOOKS.hurt.push((e, dmg, source) => ...)` sees every hit the player takes.
- Instances (`src/16-instances.js`): `INSTANCES.define('my_cave', { name, sub, w, h, build(setTile, rnd), spawns: [[type, x, y]], exit: [x, y], door: [x, y], step: [x, y], boss, onClear })`;
  a `door` places a DUNGEON_DOOR tile at world-gen and E on it enters, or call `INSTANCES.enter('my_cave')` yourself and `INSTANCES.leave()`. The instance map replaces `map` while active; the save always records the overworld.
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
- `HOOKS.draw` is called as `(g, items, cam)`, and each item you push has its `draw()` called with **no arguments** — so write
  `HOOKS.draw.push((g, items) => { items.push({ y, draw: () => { ...use g... } }) })`. A handler that takes one parameter gets
  the canvas context where it expects the list, and nothing renders, silently.

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
47-outliers), the machine special (10, 55-riding); **ctx** RIDE (10, 51-mounts), BUILD (20, 63-house), LEAVE (30, 16-instances),
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
- `hudBoss(() => alive ? { id, mark: 'goblin' | 'skull' | 'fang' | 'bird', name, lv, hp, max, phase, heart: { hp, max }, edge } : null)`
  — a boss banner (up to two; top centre on a computer and a landscape iPad, the scroll's slot elsewhere). The core already shows
  any monster of level 25+ and 300+ hp within 12 tiles; `phase` replaces "LV n" with a word (FIRE / ICE / STONE).
- `hudMechName(() => riding() ? 'Nell' : null)` — the machine's name on the crest (its hp is the crest's big number).

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
`HK.noticeRibbon(g, rect, text, alpha)`, `HK.banner(g, rect, { kind: 'area' | 'level', title, sub, alpha })`, `HK.meterBar(g, x,
y, w, h, frac, colour, { ticks, trail })`, `HK.ribbon(g, cx, cy, label, o)`, `HK.badge(g, cx, cy, text, size)`, `HK.keycap(g, x,
y, key, size)`, `HK.tooltip(g, anchor, title, keys, sub, avoid)`, `HK.vellumPlate(g, x, y, w, h)`, `HK.bookCover` / `HK.bookPage`,
`HK.brackets(g, x, y, w, h)` (the gold world-prompt corners). A `state` is `{ pressed, hover, lit, on, disabled, asleep, cool:
{ frac, text }, charge, badge, ribbon }`. Emblems: `HK.emblem(g, name, cx, cy, size, colour, { hole })` with `name` from
`HK.EM`: swing sword stomp ram hand talk chat block goblin bag pin play castle erase craft quests home bomb exit leave map
skills wiki book help music friends menu fang expand cog gear star skull horseshoe getdown door tick cloud axe pick hook
pot next crush bolt key bird prop drill build arch coin heart swords chevron chevronR chevronL close. Static layers go
through `HK.cache(g, key, x, y, w, h, draw, pad)` (drawn once per size, DPR and state), so a feature's art stays cheap.

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
dungeon and the book — and fails on any overlap, anything under 44 px, anything in a safe-area band or on the stick, anything
off screen, anything that moves between scenes, or any string that does not fit its plate at Large. `HK.audit` exposes the
pieces (e.g. `HK.audit.frameIssues(where)` after a `drawHud`) so a feature's own check can use them.

## Useful core functions

`say(text, who)`, `notify(text)`, `floatText(x, y, text, color)`, `burst(x, y, color, n, speed)`,
`addItem(id, qty)` (returns what did not fit), `removeItem`, `countItem`, `coins()`, `payCoins(n)`, `giveOrDrop(id, qty, x, y)`,
`gainXp(skill, xp)`, `skillLv(skill)`, `combatLevel()`, `hitMonster(m, dmg, knock)`, `hurtPlayer(dmg, fromX, fromY, sure)`,
`rollHit(attRoll, defRoll, maxHit)`, `playerAttackRoll()`, `playerMaxHit()`, `moveEntity(e, dx, dy, 'person'|'beast')`,
`collides(x, y, r, who)`, `changeTile(tx, ty, t)` (persists), `tileAt`, `insideBuilding(tx, ty)`, `regionAt(tx, ty)`,
`levelBanner = { text, sub, t }`, `openPanel(name, arg)`, `closePanel()`, `drawHuman(g, e, look)`, `drawMech(g, e, hurt, pilot)`, `drawItemIcon`.
Monsters: `monsters` array (each has `x y r hp maxHp state angry dead home facing`), `MONSTER_SPAWNS`, `spawnMonsters()`.
Player: `player.x/y/hp/maxHp/facing/equip/inv/skills/mech/home`.

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
