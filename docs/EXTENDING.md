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
  The map is `MAP_W`×`MAP_H` = 160×96 tiles. Free land: south-east (x 118–156, y 64–92 is Wolfwood forest, carve it),
  north-east above the camp (x 122–158, y 1–16), far west of Wolfwood (x 2–26, y 64–94).
- Quests: `QUEST_DEFS.my = { name }`, `HOOKS.questText.my = () => '...'`, `HOOKS.activeQuests.push(() => cond ? ['my'] : [])`.
  Main story after stage 8: `HOOKS.mainQuest[9] = { text: () => '...', onEnter: () => { say(...); } }`; call `advanceQuest(9)`.
- Behaviour: `HOOKS.update.push(dt => ...)`, `HOOKS.use.push((t, tx, ty, building) => handled)`,
  `HOOKS.talk.my_role = npc => ...`, `HOOKS.hit/kill/hurt`, `HOOKS.hud.push((g, narrow) => ...)`,
  `HOOKS.panel.my_panel = (g, narrow) => { const { px, py, w, h } = panelBox(g, 460, 300, 'Title', 'sub'); button(g, ...); }`.
- State: keep feature state inside `quest.myFeature = {...}` or `player.myFeature = {...}` — both are saved and
  loaded automatically (they are plain JSON). Reset it in `HOOKS.newGame`.

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

## Verify locally

`./build.sh` must print `built index.html` (it syntax-checks with node). You cannot open a browser from a
subagent; write the self-test checks and reason carefully about them. The integrator runs them.
