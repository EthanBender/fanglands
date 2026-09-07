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
const MAP_W = 200, MAP_H = 140;
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
// solid for people, solid for beasts
const solidFor = (t, who) => (who === 'person' && WALK_OVER.has(t)) ? false : SOLID.has(t) || (PUSH_THROUGH.has(t) && who !== 'person');

// ---------- extension hooks (feature files in src/2x-*.js register here; core never needs editing) ----------
const HOOKS = {
  world: [],        // fn(rnd, api) — runs at the end of generateWorld; api = { setTile, tileAt, spawnList, road }
  update: [],       // fn(dt) — runs every tick after the core update
  draw: [],         // fn(g, items, cam) — push {y, draw} entries into the y-sorted world list
  hud: [],          // fn(g, narrow) — extra HUD after the core HUD, before panels
  panel: {},        // panel[name] = fn(g, narrow) — custom panels (openPanel(name))
  use: [],          // fn(t, tx, ty, building) → true if handled — runs before "Nothing to use here"
  talk: {},         // talk[role] = fn(npc) — NPC roles the core does not know
  hit: [],          // fn(monster, dmg) — player hit a monster
  kill: [],         // fn(monster) — monster died
  hurt: [],         // fn(dmg, fromX, fromY) — player got hurt
  drawMonster: {},  // drawMonster[type] = fn(g, e, hurt) — sprite for a new monster type (already translated to e.x,e.y)
  questText: {},    // questText[id] = fn() → string for extra quest ids
  activeQuests: [], // fn() → [ids]
  mainQuest: {},    // mainQuest[stage] = { text, onEnter: fn() } for main-quest stages beyond the core
  selfTest: [],     // fn(check, F, helpers) — extra self-test checks
  newGame: [],      // fn() — reset feature state
};

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
