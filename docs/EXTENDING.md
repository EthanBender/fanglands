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
- Tap-to-move (`src/17-tap.js`): a tapped tile in `INTERESTING_TILES` gets walked to and used; a tapped monster gets fought. Add your
  own solid tiles to `INTERESTING_TILES` so a tap on them works on the iPad.
- Wiki (`src/44-wiki.js`): the in-game book builds itself from the live tables the first time it opens (K, the WIKI button, or the Wiki button
  under a pack item), so anything you add to `MONSTER_DEFS`, `ITEMS`, `RECIPES`, `SMELT`, `SHOPS`, `REGIONS`, `QUEST_DEFS`, spawn lists and
  instances is in it for free, with drop odds computed the way `rollDrops` rolls them. To add or override a page: `WIKI.add(section, { id, name, ... })`
  where section is `monsters | items | recipes | skills | places | quests`; give a `lines: ['text', { t, c, link: { s, id } }]` array to write the
  page yourself. `WIKI.get(section, id)` reads a page, `WIKI.open(section, id)` opens the book on it. Drop tables kept inside a closure need
  exposing on `window` (see `DOZERUP.BLUEPRINT_DROPS`, `DRAGON_KILLERS.chance`, `SKYCITY.FORGE`) or a `WIKI.add` call.
- Touch: every keyboard action needs a button — register one with `buttons.push({ x, y, w, h, label, action })` from a `HOOKS.hud` draw, and
  write key hints with `keyName('KeyE')` so touch players read "E" or "USE" as appropriate.

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
