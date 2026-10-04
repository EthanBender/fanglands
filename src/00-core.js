'use strict';
// ============================================================================
// Fanglands — Chapters 1–3. A 2D top-down knight adventure. Textured shapes, not pixels.
// Source lives in src/*.js and is concatenated into index.html by ./build.sh (no dependencies).
// Self-check: open the console and run FANGLANDS.selfTest()
// ============================================================================

// ---------- helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- constants ----------
const TILE = 48;
const MAP_W = 260, MAP_H = 180;
const WORLD_SEED = 20260907;
const CAVE_EXIT_X = 20;
const SAVE_KEY = 'fanglands.save.v2';
const INV_SLOTS = 20, BANK_SLOTS = 60;
const HOME_COOLDOWN = 300; // seconds between lodestone teleports

// tile ids
const T = {};
['GRASS', 'DIRT', 'CAVE', 'WALL', 'WATER', 'TREE', 'OAK', 'STUMP', 'ROCK', 'IRON', 'COAL', 'RUBBLE', 'PLANK', 'SAND', 'SIGN', 'COBBLE',
  'HWALL', 'FLOOR', 'DOOR', 'FENCE', 'GATE', 'FIRE', 'ASHES', 'DUMMY', 'GRAVE', 'SOIL', 'CROP', 'COUNTER', 'TABLE', 'BED', 'SHELF', 'ANVIL', 'FORGE',
  'WORKBENCH', 'ALCHEMY', 'WORKSHOP', 'STALL', 'CWALL', 'PORTCULLIS', 'THRONE', 'CHEST', 'LODESTONE', 'TRAP', 'WRECK', 'MECH', 'CART', 'AXESTUMP', 'RUG',
  'STONECIRCLE', 'GOLDPILE', 'COFFINDOOR', 'OVEN', 'FLOWERS', 'MUSHROOM'].forEach((n, i) => T[n] = i);
const SOLID = new Set([T.WALL, T.WATER, T.TREE, T.OAK, T.STUMP, T.ROCK, T.IRON, T.COAL, T.RUBBLE, T.PLANK, T.SIGN, T.HWALL, T.FENCE, T.FIRE, T.DUMMY, T.GRAVE,
  T.COUNTER, T.TABLE, T.BED, T.SHELF, T.ANVIL, T.FORGE, T.WORKBENCH, T.ALCHEMY, T.WORKSHOP, T.STALL, T.CWALL, T.THRONE, T.CHEST, T.LODESTONE, T.WRECK, T.MECH,
  T.CART, T.AXESTUMP, T.STONECIRCLE, T.GOLDPILE, T.OVEN]);
const PUSH_THROUGH = new Set([T.DOOR, T.GATE, T.PORTCULLIS, T.COFFINDOOR]); // people push through these; animals and goblins cannot
const PLACEABLE_ON = new Set([T.GRASS, T.DIRT, T.SAND, T.CAVE, T.COBBLE, T.FLOOR, T.SOIL, T.ASHES]);
const WALK_OVER = new Set(); // tiles the player can currently cross (e.g. water while hover armour is worn); features add/remove
// who: 'player' (the knight on foot: pushes through doors, honours WALK_OVER), 'person' (companions, guards, villagers: doors yes, WALK_OVER no), 'beast' (monsters and machines),
// 'rider' (the knight on anything he rides: the mare, the walker, the bulldozer, the Barrelbeast). A rider is a beast in every way but one:
// a GATE or a PORTCULLIS is a way through a wall, made for riders, so he rides through it. A DOOR or a COFFINDOOR leads into a building and still stops him.
const RIDE_THROUGH = new Set([T.GATE, T.PORTCULLIS]);
const solidFor = (t, who) => (who === 'player' && WALK_OVER.has(t)) ? false : SOLID.has(t) || (PUSH_THROUGH.has(t) && who !== 'person' && who !== 'player' && !(who === 'rider' && RIDE_THROUGH.has(t)));
// Shared left-HUD cursor. drawHud sets it to the bottom of the status plate every frame and HUD hooks claim
// their row through HK.slot() (src/59-hudkit.js), which advances it. leftCol is the column that cursor is in:
// the stack wraps into a second column rather than running into the joystick or off the bottom of the screen.
const HUD = { leftY: 82, leftCol: 0 };

// ---------- extension hooks (feature files in src/2x-*.js register here; core never needs editing) ----------
const HOOKS = {
  pauseMenu: [],
  xpSource: [], // fn(add) — declare a feature's XP sources to the progression audit: add(skill, name, req, xp, secs, note)
  keyHelp: [], // { action, codes: ['KeyK'] } — a feature's desktop keys, listed by the Settings panel's Controls line // (g, x, y, w, h) → draw one 36 px button row in the pause menu (slots between Settings and New game)
  world: [],        // fn(rnd, api) — runs at the end of generateWorld; api = { setTile, tileAt, spawnList, road }
  update: [],       // fn(dt) — runs every tick after the core update
  draw: [],         // fn(g, items, cam) — push {y, draw} entries into the y-sorted world list
  hud: [],          // fn(g, narrow) — extra HUD after the core HUD, before panels
  panel: {},        // panel[name] = fn(g, narrow) — custom panels (openPanel(name))
  use: [],          // fn(t, tx, ty, building) → true if handled — runs before "Nothing to use here"
  talk: {},         // talk[role] = fn(npc) — NPC roles the core does not know
  talkBefore: {},   // talkBefore[role] = fn(npc) → true if handled — runs at the top of talkTo, lets features extend core roles (e.g. the Duke)
  hit: [],          // fn(monster, dmg, source) — a monster was hit; source is 'player' or 'companion'
  kill: [],         // fn(monster) — monster died
  monsterDeath: [], // fn(monster, info) — a monster's death was decided, info = { k, by, how, x, y }: offline (and on the keeper)
                    // killMonster fires it; online 75-coop fires it on the keeper's word, never because hp reached 0 here.
                    // The death animation (79-deaths) starts only from this. Fire it with monsterDied(m, how, by, k).
  hurt: [],         // fn(dmg, fromX, fromY) — player got hurt
  drawMonster: {},  // drawMonster[type] = fn(g, e, hurt) — sprite for a new monster type (already translated to e.x,e.y)
  questText: {},    // questText[id] = fn() → string for extra quest ids
  activeQuests: [], // fn() → [ids]
  mainQuest: {},    // mainQuest[stage] = { text, onEnter: fn() } for main-quest stages beyond the core
  selfTest: [],     // fn(check, F, helpers) — extra self-test checks
  newGame: [],      // fn() — reset feature state
  leaveInstance: [], // fn(id) — the knight is about to leave instance id (any way out: LEAVE, L, the exit, a ride, a respawn, a load);
                    // runs while it is still the active map, so a feature can settle what it owes him there (91-royalmine's golem fall)
  pathBlock: [],    // fn(tx, ty, who) → true: tap-to-move and the bot's walkTo must not route through this cell right now (e.g. a balance log above the knight's Agility)
  // the Great Spread (the spread spec, §10): a save from an older world is prepared before the core load lays it on the
  // new map; dead while WORLD_V is 1 (nothing registers until Stage 4c's 97-spread)
  saveIn: [],       // fn(d) — d is a parsed save whose worldV is below WORLD_V; runs right after JSON.parse, before anything is loaded
  remake: [],       // fn() — idempotent: re-applies the tiles a feature changed because of the story, from quest state (changeTile)
  placedFrom: {},   // placedFrom[tileName] = itemId — a placeable tile the save migration refunds as that item
};
// The world's version (§10). A save names the world it was made in (worldV; none = 1). A save from a NEWER world (after a
// rollback) is never loaded and never written over: load() refuses it and sets SAVE_LOCK, and save() and the cloud push do
// nothing until the page is reloaded.
const WORLD_V = 1;
let SAVE_LOCK = false;
// a cell the knight could step onto but could not get across (an agility obstacle above his level): pathfinders go round it
function pathBlocked(tx, ty, who) { for (const f of HOOKS.pathBlock) if (f(tx, ty, who)) return true; return false; }

// ---------- canvas ----------
const DISPLAY = '"Cinzel", "Trajan Pro", Georgia, serif';
if (document.fonts && document.fonts.load) { document.fonts.load('800 34px "Cinzel"').catch(() => { }); }
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  VW = window.innerWidth; VH = window.innerHeight;
  canvas.width = Math.floor(VW * DPR); canvas.height = Math.floor(VH * DPR);
  canvas.style.width = VW + 'px'; canvas.style.height = VH + 'px';
}
window.addEventListener('resize', resize);
resize();
