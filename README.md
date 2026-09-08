# Fanglands

A 2D top-down knight adventure. Textured shapes, not pixels. Goblins with machines.
A dragon only legends have heard about.

- **Play:** open `index.html` in any browser. No install.
- **Edit:** the source lives in `src/*.js` (one module per system). Run `./build.sh` to
  rebuild `index.html` (it just concatenates the modules and syntax-checks them).
- **Design:** `docs/GAME_DESIGN.md` (the spec) and `docs/ROADMAP.md` (what's next).
- **Chapter 1:** wake in the cave, take the wooden sword, follow the Voice, beat
  three goblins, find the signpost.
- **Chapter 2:** Thistledown. Shops, bank, fishing, cooking, training dummies,
  Tobin's loaf, the Duke's task, and Death's House when you fall.
- **Chapter 3:** Goblin tech. Smith iron at Brakka's, craft bows, bombs and traps at Pim's,
  farm, make fires, then bring down the Goblin Walker in the camp east of town and pilot it.
- **Chapter 4:** Hollowford and the Barrelbeast. Plus: a hero companion, the goblin bulldozer,
  the town watch, and Deepholm under the quarry.
- **Chapter 5:** the jungle and the elf city, the Grey Sea and its islands, dragon country,
  Godly Plated armour, and The Fang.
- **Self-check:** open the browser console and run `FANGLANDS.selfTest()` (170 checks), or
  `node tools/headless.js` from a terminal.
- **Adding features:** see `docs/EXTENDING.md`. One file per feature under `src/2x-*.js`, registered through hooks.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | WASD / arrows | left-side stick |
| Swing | Space | SWING |
| Use / chop / mine / read | E | USE |
| Place plank / door / bed / lodestone / trap | Q | Bag → Place |
| Eat / use pack slots 1–5 | 1–5 | tap the hotbar |
| Pack | I | BAG |
| Craft | C | CRAFT |
| Skills | Tab | SKILLS |
| Quests | J | QUESTS |
| World map | M or click the minimap | tap the minimap |
| Home (lodestone) | H | Bag → Home |
| Climb out of the walker | X | EXIT |
| Help | ? | HELP |
| Menu (settings, new game) | Esc | MENU |
| Settings (sound, music, kid mode, tap-to-walk, stick side, text size, talk speed, damage numbers, shake, monster levels, minimap) | , or Esc → Settings | MENU → Settings |

Progress saves in the browser automatically.
