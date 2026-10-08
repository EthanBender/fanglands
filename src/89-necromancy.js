// ============================================================================
// NECROMANCY — the magic skill (design: ~/.fanglands/work/necromancy/spec.md, sections 1 to 4 and 7)
// src/89-necromancy.js
//
// A necromancer is a KEEPER OF THE RESTLESS: he asks old bones and lost ghosts for help, they help, and then they go
// back to rest. Nobody is bossed about and nothing is gory: blue-green runes, friendly skeletons in blue scarves,
// ghosts and candles. Levels 1 to 99, key 'necromancy'. It is taught at the Old Barrow (89-oldbarrow: the place, the
// Barrow Deep, the Lantern Watch, the two bosses, the five quests and the ghosts); the pictures are 89-necroart.
//
// THIS FILE: the skill (SKILL_DEFS, the cape, the XP sources for the progression audit), SPIRIT (the magic bar), the
// supplies, the 12 SPELLS, the spellbook panel (U), the CAST face (Z) and the BOLT face (Space with a focus in hand),
// the SPELLS book tile, the HELPERS (summons), the Barrow-bound set, `look.necro` (presence), drawing a friend's spells
// and helpers from his presence, the Hitpoints share, and window.NECRO.
//
// THE RULES EVERY SPELL KEEPS (spec 3 and 7):
//   * nothing works inside a machine, on the mare or riding along ("Climb down first.");
//   * nothing hurts a knight, a townsperson, a companion or livestock; every hit is hitMonster(m, dmg, 0, false, 'necro')
//     (knockback 0), capped at 500 (75-coop's MAX_DMG), so online a spell on a puppet is the same 'hit' a sword sends;
//   * no spell writes the world: no changeTile, nothing in another knight's save. Raise uses only this knight's own
//     quest.graves (54-graves), which friends never see;
//   * helpers are a client entity on the caster's game (like 21-companion's hero), never a monsters row: monsters never
//     target them, they cannot be hurt, they time out, and their hits are their caster's hits.
//
// SAVE: player.necro = { spirit, known: { spellId: true }, ready, ghosts: { id: true }, watch: { best }, gl } (no
// positions: the spread migration has nothing to handle). The two day-clock rests (Grave Walk, Call the Last Knight) are
// quest.necro = { walkUntil, knightUntil }, because 96-rests' RESTS table reads quest[key][field]. Helpers are runtime
// only and never saved: a load starts with none.
// Feature file: registers through HOOKS; wraps playerAttack, playerLook, useItem and hurtPlayer by reassignment.
// ============================================================================
const NECRO = (() => {
  // ======================================================================================================================
  // THE CHOICES (spec section 9: the designer's picks, built as the owner's standing rule says). Each is ONE line here.
  // ======================================================================================================================
  const CHOICES = {
    TEACHERS: { keeper: 'Granny Wick', skull: 'Rattle' },   // 1. who teaches, at the Old Barrow (89-oldbarrow reads both names)
    BAR: 'spirit',                                          // 2. a Spirit bar that refills by itself, plus supplies (no runes)
    COUNTS_TO_COMBAT: false,                                // 3. Necromancy is not in combatLevel() (a core const: true is not built)
    SCYTHE: { monster: 'the_hollow', chance: 250 },          // 4. the Void Scythe: the Hollow, 1 in 250 per paid kill (MEGA_RARE.SOURCES)
    WATCH_KIT_CHANCE: 40,                                   // 5. a won Deep Watch rolls 1 in this for a kit piece (the brute's weights)
    CH9_HINT: "Someone was calling me, before the road took me. A voice. If you ever hear it, tell her I tried.",   // 6. the soft chapter-9 hint
    LAST_KNIGHT: 'Sir Corwin',                              // 7. the last knight's name: Cohen's to change, here and only here
    HELPERS_TIME_OUT: true,                                 // 8. helpers cannot be hurt (monsters never target them) and they time out
    SPELLS_HURT_KNIGHTS: false,                             // 9. no spell or helper ever hurts a knight (Spell PvP waits for the PvP design)
    SHOW_FROM_START: true,                                  // 10. the skill shows at Lv 1 from the start (no `needs` on SKILL_DEFS)
    HP_SHARE: 1 / 3,                                        // 11. a third of spell and helper XP also goes to Hitpoints
    WATCH_XP: { dusk: 20, midnight: 110, deep: 380 },       // 12. the cape at about 95 hours: the Lantern Watch's pay per wave (× wave number)
    UNDERTAKER: 'separate',                                 // 13. the queued Undertaker idea is not built here
    SHARD_PRICE: 25,                                        // 14. Granny Wick sells soul shards at this many coins
    ALL_GHOSTS: { xp: 2000, reward: "Rattle's story" },     // 15. meeting all 12 ghosts: Rattle's own story and this much XP
  };

  // ---------- small helpers ----------
  // (the knight 04-state made at load, before this file added the skill, has no row yet: level 1 until a new game or a load)
  const L = () => player && player.skills && player.skills.necromancy ? skillLv('necromancy') : 1;
  const px = n => n * TILE;                       // tiles to pixels (a size, never a place)
  const MAX_DMG = 500;
  const HAND = 18, GLOW = 12;      // pixels above the feet: where a bolt leaves the hand, where the Ghostlight sits
  const SRC = 'necro';
  const N = () => {
    const p = player.necro && typeof player.necro === 'object' ? player.necro : (player.necro = {});
    if (typeof p.spirit !== 'number' || !Number.isFinite(p.spirit)) p.spirit = 20;
    if (!p.known || typeof p.known !== 'object') p.known = {};
    if (typeof p.ready !== 'string') p.ready = 'bolt';
    if (!p.ghosts || typeof p.ghosts !== 'object') p.ghosts = {};
    if (!p.watch || typeof p.watch !== 'object') p.watch = { best: 0 };
    return p;
  };
  const Q = () => { const q = quest.necro && typeof quest.necro === 'object' ? quest.necro : (quest.necro = {}); if (!(q.walkUntil >= 0)) q.walkUntil = 0; if (!(q.knightUntil >= 0)) q.knightUntil = 0; return q; };
  const online = () => typeof NET !== 'undefined' && NET.online && NET.online();
  const ridingAlong = () => !!(window.RIDE && RIDE.state && RIDE.state.ride);
  const mapNow = () => (window.INSTANCES && INSTANCES.active && INSTANCES.active()) || 'over';

  // ======================================================================================================================
  // 1. THE SKILL
  // ======================================================================================================================
  SKILL_DEFS.push({ key: 'necromancy', name: 'Necromancy' });   // no `needs`: 10-hud's skillLocked would read it as "a hoe"
  if (typeof player !== 'undefined' && player && player.skills && !player.skills.necromancy) player.skills.necromancy = { xp: 0 };   // the knight 04-state already made
  // the cape: made here the way 38-agility's ensureCapes makes the others (this file loads after it); 38's tables hold its
  // colour and ability; it is bought at the Master of Skills for 999 coins, like every cape
  ITEMS.cape_necromancy = Object.assign(ITEMS.cape_necromancy || { id: 'cape_necromancy', name: 'Necromancy cape', value: 999, color: '#4fd1b5', shape: 'cape', stack: 1, armour: { slot: 'cape', def: 5 }, capeSkill: 'necromancy' }, { necro: { power: 3 } });

  // ======================================================================================================================
  // 2. SUPPLIES AND EQUIPMENT (spec 2 and 4). Bones (54-graves), grave dust (35-night) and dragon bones (27-dragons) exist.
  // ======================================================================================================================
  Object.assign(ITEMS, {
    soul_shard: { name: 'Soul shard', value: 25, color: '#5fe3c4', shape: 'gem', stack: 50 },
    brute_bone: { name: 'Brute bone', value: 30, color: '#ddd5bd', shape: 'tusk', stack: 50 },
    barrow_wand: { name: 'Barrow wand', value: 120, color: '#d8ccb0', shape: 'dagger', stack: 1, weapon: { str: 4, att: 8, cd: 0.6 }, necro: { power: 2, focus: true } },
    gravewood_stave: { name: 'Gravewood stave', value: 1600, color: '#3d3226', shape: 'warhammer', stack: 1, weapon: { str: 12, att: 14, cd: 0.6 }, necro: { power: 6, focus: true } },
  });
  for (const k of ['soul_shard', 'brute_bone', 'barrow_wand', 'gravewood_stave']) ITEMS[k].id = k;
  // the Zombie brute always gives a brute bone now (spec 2): one more random number per brute kill
  if (MONSTER_DEFS.zombie_brute && MONSTER_DEFS.zombie_brute.drops) { const d = MONSTER_DEFS.zombie_brute.drops; d.always = (d.always || []).filter(r => r[0] !== 'brute_bone').concat([['brute_bone', 1, 1]]); }
  // the Void Scythe finally comes from somewhere (choice 4): the one row of 54-megarare's one table
  if (window.MEGA_RARE && MEGA_RARE.SOURCES) MEGA_RARE.SOURCES.void_scythe = [{ monster: CHOICES.SCYTHE.monster, chance: CHOICES.SCYTHE.chance }];
  const SUPPLIES = ['bone', 'grave_dust', 'soul_shard', 'brute_bone', 'dragon_bone'];
  const KIT = ['necro_hood', 'necro_robe', 'necro_wraps', 'soul_lantern'];                 // the Barrow-bound set's four pieces
  const SET_WEAPONS = ['bone_stave', 'void_scythe'];
  // the undead (spec 2): one set, read by Banish, the shard drops and the book
  const UNDEAD = new Set(['zombie', 'zombie_calm', 'grave_zombie', 'grave_zombie_calm', 'grave_skeleton', 'grave_risen', 'zombie_brute', 'vampire', 'count_ashvane', 'cinderwight']);
  const isUndead = type => UNDEAD.has(type);
  const addUndead = (...types) => { for (const t of types) UNDEAD.add(t); };

  // ---------- power: the sum of every worn `necro.power`, read from the items, never from a list of ids ----------
  const worn = () => EQUIP_SLOTS.map(s => player.equip[s]).filter(Boolean);
  const fullSet = () => KIT.every(id => worn().includes(id)) && SET_WEAPONS.includes(player.equip.weapon);
  function power() {
    let p = 0;
    for (const id of worn()) { const it = ITEMS[id]; if (it && it.necro && it.necro.power > 0) p += it.necro.power; }
    if (fullSet()) p += 5;
    return p;
  }
  const wearing = id => worn().includes(id);
  const focusInHand = () => { const w = ITEMS[player.equip.weapon]; return !!(w && w.necro && w.necro.focus); };
  // the Void Scythe keeps its swing but counts as a focus for CAST
  const castFocus = () => focusInHand() || player.equip.weapon === 'void_scythe';

  // ======================================================================================================================
  // 3. SPIRIT (spec 1.2)
  // ======================================================================================================================
  const spiritMax = (lv = L(), p = power()) => 20 + lv + p;
  const SPIRIT = { calm: 6, circleX: 2, calmX: 2, rate: 1, shard: 15 };
  let lastBlow = -1e9;            // the last blow landed on the knight or by him (time): spirit refills twice as fast 6 s after
  const circles = [];             // fns: () => true when the knight stands in a lit candle circle (89-oldbarrow registers them)
  const inCircle = () => circles.some(f => { try { return !!f(); } catch (e) { return false; } });
  const refillRate = () => SPIRIT.rate * (time - lastBlow >= SPIRIT.calm ? SPIRIT.calmX : 1) * (inCircle() ? SPIRIT.circleX : 1);
  function addSpirit(n) { const p = N(); p.spirit = clamp(p.spirit + n, 0, spiritMax()); return p.spirit; }
  const spirit = () => N().spirit;

  // ======================================================================================================================
  // 4. THE SPELLS (spec 3). One row each: the level, the quest it waits for, the cost, the cooldown and what it does.
  //    cost: spirit; supplies are handled per spell (a grave of your own replaces them for the raises). cd: seconds on
  //    `time`, or a `rest` on player.dayTime (96-rests lists it). focus: needs a focus in hand.
  // ======================================================================================================================
  const SPELLS = [
    { id: 'bolt', name: 'Soul Bolt', lv: 1, q: 'q1', spirit: 2, cd: 1.2, focus: true, em: 'bolt', what: 'A blue-green bolt that finds the monster you face.' },
    { id: 'light', name: 'Ghostlight', lv: 3, q: 'q1b', spirit: 0, cd: 0.5, em: 'star', what: 'A cold light that shows ghosts and spirit marks. Talk to the ghosts you see. Costs 1 spirit every 4 s (free with the Soul lantern).' },
    { id: 'raise', name: 'Raise Bones', lv: 5, q: 'q2', spirit: 6, cd: 4, em: 'skull', what: 'A Bone Squire climbs up to help you. Face one of your own graves, or use 5 bones.' },
    { id: 'ward', name: 'Bone Ward', lv: 12, spirit: 5, cd: 30, em: 'block', what: 'Bone shards circle you and soak up the next blows. 3 bones.' },
    { id: 'walk', name: 'Grave Walk', lv: 18, q: 'q3', spirit: 0, rest: 120, em: 'home', what: 'Stand still 2 s and wake at the Old Barrow. 1 grave dust.' },
    { id: 'siphon', name: 'Soul Siphon', lv: 25, spirit: 5, cd: 6, focus: true, em: 'heart', what: 'A bolt that heals you for half the damage it lands.' },
    { id: 'step', name: 'Ghost Step', lv: 35, spirit: 4, cd: 8, em: 'chevronR', what: 'Blink 3 tiles the way you face (4 with the Soul lantern). Never through a wall.' },
    { id: 'spikes', name: 'Bone Spikes', lv: 42, spirit: 8, cd: 12, em: 'swords', what: 'Bone spikes hit every monster within 2 tiles. 3 bones.' },
    { id: 'risen', name: 'Raise Risen', lv: 50, q: 'q4', spirit: 10, cd: 4, em: 'skull', what: 'A Risen guard helps you. Your own grave or headstone, or 2 grave dust and 5 bones.' },
    { id: 'banish', name: 'Banish', lv: 60, spirit: 12, cd: 20, focus: true, em: 'bolt', what: 'A bright bolt: two and a half times the damage to the undead. 1 soul shard.' },
    { id: 'brute', name: 'Raise Brute', lv: 80, spirit: 15, cd: 4, em: 'skull', what: 'A Bone brute slams everything near it. Your own headstone, or 1 brute bone and 3 grave dust.' },
    { id: 'knight', name: 'Call the Last Knight', lv: 95, q: 'q5', spirit: 25, rest: 600, em: 'castle', what: 'The last knight of Hollowford fights beside you for 30 s. 3 soul shards.' },
  ];
  const SPELL = {}; for (const s of SPELLS) SPELL[s.id] = s;
  // the set's discount: every spell costs 1 less spirit (never below 1)
  const costOf = s => !s.spirit ? 0 : fullSet() ? Math.max(1, s.spirit - 1) : s.spirit;
  // which quest a spell waits for: 89-oldbarrow answers (gates: { q1, q1b, q2, q3, q4, q5 } => bool)
  const gates = { q1: () => false, q1b: () => false, q2: () => false, q3: () => false, q4: () => false, q5: () => false };
  const taught = s => !!N().known[s.id] || !s.q || !!(gates[s.q] && gates[s.q]());
  const canKnow = s => L() >= s.lv && taught(s);
  // why not, in plain words (null when it can be cast at all)
  function lockedWhy(s) {
    if (!taught(s)) return s.q === 'q1' || s.q === 'q1b' ? 'Granny Wick teaches it at the Old Barrow.' : 'A quest at the Old Barrow teaches it.';
    if (L() < s.lv) return `Needs Necromancy ${s.lv}.`;
    return null;
  }

  // ---------- the bolt's maths (spec 3: L is the necromancy level, P the power) ----------
  const boltMax = (lv = L(), p = power()) => 1 + Math.floor((lv + 8) * (p + 40) / 260);
  const attRoll = (lv = L(), p = power()) => (lv + 8) * (64 + 2 * p);
  const defRoll = m => ((MONSTER_DEFS[m.type] && MONSTER_DEFS[m.type].def) || 0) * 64 + 8 * 64;
  // every spell and helper roll goes through ROLL (the self-tests pin it to a sure hit for the most: ROLL.sure = true)
  const ROLL = { sure: false };
  const roll = (att, def, max) => ROLL.sure ? max : rollHit(att, def, max);
  const rollSpell = (m, max) => Math.min(MAX_DMG, roll(attRoll(), defRoll(m), max));

  // ---------- who a spell may touch: never a knight (they are not monsters), a townsperson, a companion or livestock ----------
  const NEVER = new Set(['sheep', 'cow', 'chicken', 'pig', 'goat', 'horse', 'ally_knight', 'watch_candle', 'watch_bell']);
  function fair(m) {
    if (!m || m.dead || m.phantom) return false;
    const d = MONSTER_DEFS[m.type]; if (!d) return false;
    if (d.harmless || m.ally || NEVER.has(m.type) || d.never) return false;
    if (d.human && !d.aggro && !m.angry) return false;          // the town guards and the like: people, not foes
    return true;
  }
  // the bolt's target: the monster faced (a 70 degree cone, 7 tiles), else the nearest angry one in range
  function boltTarget(from = player, range = px(7)) {
    let best = null, bd = Infinity;
    const fx = from.facing ? from.facing.x : 1, fy = from.facing ? from.facing.y : 0, cone = Math.cos(35 * Math.PI / 180);
    for (const m of monsters) {
      if (!fair(m)) continue;
      const d = dist(from.x, from.y, m.x, m.y); if (d > range + m.r) continue;
      const dot = ((m.x - from.x) * fx + (m.y - from.y) * fy) / (d || 1);
      if (dot >= cone && d < bd) { best = m; bd = d; }
    }
    if (best) return best;
    for (const m of monsters) {
      if (!fair(m) || !(m.angry || m.state === 'chase')) continue;
      const d = dist(from.x, from.y, m.x, m.y); if (d > range + m.r) continue;
      if (d < bd) { best = m; bd = d; }
    }
    return best;
  }

  // ---------- the hit itself, and the XP it pays (a HOOKS.hit handler reads HIT.kind) ----------
  const HIT = { kind: null };
  const XP = { spell: 2, helper: 1, dummy: 8, dummyDay: 300 };
  function necroHit(m, dmg, kind) {
    dmg = Math.max(0, Math.min(MAX_DMG, Math.round(dmg)));
    HIT.kind = kind;
    try { hitMonster(m, dmg, 0, false, SRC); } finally { HIT.kind = null; }
    lastBlow = time;
    return dmg;
  }
  HOOKS.hit.push((m, dmg, source) => {
    if (source === 'player' || source === SRC) { lastBlow = time; if (m && !m.dead) LAST.target = m; }
    if (source !== SRC || !(dmg > 0) || !HIT.kind) return;
    const per = HIT.kind === 'helper' ? XP.helper : XP.spell, xp = dmg * per;
    gainXp('necromancy', xp);
    if (player.skills.hitpoints && xp * CHOICES.HP_SHARE >= 1) gainXp('hitpoints', Math.floor(xp * CHOICES.HP_SHARE));
    // a soul shard from the undead finished by a spell (1 in 5, after Granny's first lesson)
    if (m && m.hp <= 0 && isUndead(m.type) && HIT.kind !== 'helper' && gates.q1() && Math.random() < 0.2) giveOrDrop('soul_shard', 1, m.x, m.y);
  });
  HOOKS.hurt.push(() => { lastBlow = time; });
  const LAST = { target: null };

  // ---------- bolts in flight (this game's own; the core's projectiles know only arrows and bombs) ----------
  const BOLTS = [];               // { kind, x, y, m (target), tx, ty, t, max, heal, banish, life }
  const FLASHES = [];             // short-lived pictures: spikes, puffs, mist { kind, x, y, t, life, ... }
  const BOLT_SPEED = 420;
  function fireBolt(kind, m) {
    const b = { kind, x: player.x + player.facing.x * 14, y: player.y - 18 + player.facing.y * 10, m, tx: m.x, ty: m.y, t: 0, life: 1.4, map: mapNow() };
    BOLTS.push(b);
    sfx('swing');
    return b;
  }
  function stepBolts(dt) {
    for (let i = BOLTS.length - 1; i >= 0; i--) {
      const b = BOLTS[i]; b.t += dt;
      if (b.map !== mapNow()) { BOLTS.splice(i, 1); continue; }
      if (b.m && monsters.includes(b.m) && !b.m.dead) { b.tx = b.m.x; b.ty = b.m.y; }
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy), step = BOLT_SPEED * dt;
      if (d <= step + ((b.m && b.m.r) || 8) * 0.5 || b.t >= b.life) {
        BOLTS.splice(i, 1);
        if (b.m && monsters.includes(b.m) && !b.m.dead && b.t < b.life) landBolt(b);
        continue;
      }
      b.x += dx / d * step; b.y += dy / d * step;
    }
  }
  function landBolt(b) {
    const m = b.m;
    let max = boltMax();
    if (b.kind === 'banish') max = Math.floor(max * (isUndead(m.type) ? 2.5 : 1));
    const dmg = rollSpell(m, max), done = necroHit(m, dmg, 'spell');
    if (b.kind === 'siphon' && done > 0) { const heal = Math.floor(done / 2); if (heal > 0) { player.hp = Math.min(player.maxHp, player.hp + heal); floatText(player.x, player.y - 40, '+' + heal, '#7ee787', 12); } }
    burst(m.x, m.y, b.kind === 'banish' ? '#e8f6ff' : b.kind === 'siphon' ? '#7ee787' : '#4fd1b5', 8, 70);
  }

  // ======================================================================================================================
  // 5. HELPERS (spec 3 and 7.3): the caster's own client entities
  // ======================================================================================================================
  const HELPER = {
    sq: { name: 'Bone Squire', lv: lv => 5 + Math.floor(lv / 3), max: (lv, p) => 2 + Math.floor(lv / 12) + Math.floor(p / 8), every: 1.0, life: p => 40 + p, weight: 1, r: 12, reach: 1.1 },
    rg: { name: 'Risen guard', lv: lv => 12 + Math.floor(lv / 3), max: (lv, p) => 5 + Math.floor(lv / 10) + Math.floor(p / 6), every: 1.3, life: p => 50 + p, weight: 1, r: 13, reach: 1.1 },
    bb: { name: 'Bone brute', lv: lv => 30 + Math.floor(lv / 3), max: (lv, p) => 8 + Math.floor(lv / 8) + Math.floor(p / 5), every: 2.0, life: p => 60 + p, weight: 2, r: 30, reach: 1.5, slam: true },
    lk: { name: CHOICES.LAST_KNIGHT, lv: lv => 60 + Math.floor(lv / 3), max: (lv, p) => 20 + Math.floor(p / 2), every: 0.9, life: () => 30, weight: 0, r: 13, reach: 1.1, fixed: true },
  };
  const capOf = lv => lv >= 80 ? 3 : lv >= 50 ? 2 : lv >= 5 ? 1 : 0;
  const HELPERS = [];             // { id, kind, x, y, r, facing, walkT, moving, attackT, cd, life, max, map, quest }
  let helperN = 0;
  const lifeMul = () => (wearing('cape_necromancy') ? 2 : 1) * (fullSet() ? 1.5 : 1);
  const helpersHere = () => HELPERS.filter(h => h.map === mapNow());
  const helperLoad = () => HELPERS.filter(h => !h.quest).reduce((n, h) => n + HELPER[h.kind].weight, 0);
  function makeHelper(kind, at, o = {}) {
    const H = HELPER[kind], p = power();
    const life = o.life != null ? o.life : H.fixed ? H.life(p) : H.life(p) * lifeMul();
    const spot = (at && safeSpot(at.x, at.y, H.r, 'beast')) || { x: player.x + 30, y: player.y };
    const h = { id: ++helperN, kind, x: spot.x, y: spot.y, r: H.r, facing: { x: player.facing.x || 1, y: player.facing.y || 0 }, walkT: 0, moving: false, attackT: 0, cd: 0.6, life, max: life, map: mapNow(), quest: o.quest || null, look: o.look || null, maxHit: o.maxHit || 0, rise: 0 };
    HELPERS.push(h);
    burst(h.x, h.y + 8, '#4fd1b5', 16, 70);
    return h;
  }
  const remove = h => { const i = HELPERS.indexOf(h); if (i >= 0) HELPERS.splice(i, 1); burst(h.x, h.y, '#9fe8d6', 12, 60); };
  // the helpers' target: the monster the caster hit last (alive, within 5 tiles of him), else the nearest angry one
  function helperTarget() {
    const near = m => m && monsters.includes(m) && fair(m) && dist(m.x, m.y, player.x, player.y) <= px(5) + m.r;
    if (near(LAST.target)) return LAST.target;
    let best = null, bd = Infinity;
    for (const m of monsters) { if (!near(m) || !(m.angry || m.state === 'chase')) continue; const d = dist(m.x, m.y, player.x, player.y); if (d < bd) { bd = d; best = m; } }
    return best;
  }
  function stepHelpers(dt) {
    const here = mapNow();
    for (let i = HELPERS.length - 1; i >= 0; i--) {
      const h = HELPERS[i];
      if (!h.quest && CHOICES.HELPERS_TIME_OUT) h.life -= dt;
      if (h.life <= 0) { remove(h); continue; }
      // a story's helper (Ambrose, the last knight) walks through doors with the knight; the others wait at the door until
      // he comes back in their time
      if (h.map !== here) { if (!h.quest) continue; const s = safeSpot(player.x + 30, player.y, h.r, 'beast'); if (!s) continue; h.map = here; h.x = s.x; h.y = s.y; }
      h.attackT = Math.max(0, h.attackT - dt); h.cd = Math.max(0, h.cd - dt); h.rise = Math.min(1, h.rise + dt * 2);
      const H = HELPER[h.kind], t = player.dead ? null : helperTarget();
      // far behind (a ride, a door, a Grave Walk): it catches up at once
      if (dist(h.x, h.y, player.x, player.y) > px(9)) { const s = safeSpot(player.x - player.facing.x * 34, player.y - player.facing.y * 34, h.r, 'beast'); if (s) { h.x = s.x; h.y = s.y; } }
      let gx, gy, stop;
      if (t) { gx = t.x; gy = t.y; stop = H.reach * TILE * 0.6 + t.r + h.r * 0.5; }
      else { gx = player.x - player.facing.x * 40 + (h.id % 3 - 1) * 26; gy = player.y - player.facing.y * 40 + 10; stop = 18; }
      const dx = gx - h.x, dy = gy - h.y, d = Math.hypot(dx, dy);
      h.moving = d > stop;
      if (h.moving) { const sp = (t ? 160 : 150) * dt * Math.min(1, (d - stop) / 20 + 0.3); moveEntity(h, dx / d * sp, dy / d * sp, 'beast'); h.walkT += dt * 9; }
      if (d > 1) h.facing = { x: dx / d, y: dy / d };
      if (!t || h.cd > 0 || d > stop + 6) continue;
      h.cd = H.every; h.attackT = 0.22;
      const max = h.maxHit || Math.max(1, Math.floor(H.max(L(), power())));
      if (H.slam) {
        for (const m of monsters.slice()) if (fair(m) && dist(m.x, m.y, h.x, h.y) <= px(1.5) + m.r) necroHit(m, roll((H.lv(L()) + 8) * 64, defRoll(m), max), 'helper');
        FLASHES.push({ kind: 'slam', x: h.x, y: h.y + 10, t: 0, life: 0.5, map: here });
      } else necroHit(t, roll((H.lv(L()) + 8) * 64, defRoll(t), max), 'helper');
    }
  }

  // ======================================================================================================================
  // 6. CASTING
  // ======================================================================================================================
  const CD = {};                 // spell id -> the `time` its cooldown ends
  const WARD = { left: 0, amount: 0, until: -1e9 };
  const CH = { walk: null };     // the Grave Walk's channel: { t, x, y, hp }
  const STATS = { cast: 0, raised: 0, dummy: { day: -1, xp: 0 } };
  let lookC = 0, lookS = null, lookT = null;
  const restLeft = s => s.id === 'walk' ? Q().walkUntil - (player.dayTime || 0) : s.id === 'knight' ? Q().knightUntil - (player.dayTime || 0) : 0;
  const coolLeft = s => s.rest ? Math.max(0, restLeft(s)) : Math.max(0, (CD[s.id] || 0) - time);
  const mmss = s => { const c = Math.max(0, Math.ceil(s)); return c >= 60 ? Math.floor(c / 60) + ':' + String(c % 60).padStart(2, '0') : c + ' s'; };
  // a grave marker of this knight's own in front of him or under his feet (54-graves' quest.graves): { m, grade }
  function ownGrave(want) {
    if (!window.GRAVES || window.__instance) return null;
    const own = { x: Math.floor(player.x / TILE), y: Math.floor(player.y / TILE) }, f = frontTile(player);
    for (const [x, y] of [[f.tx, f.ty], [own.x, own.y], [own.x + Math.round(player.facing.x), own.y + Math.round(player.facing.y)]]) {
      const mk = GRAVES.markerAt(x, y); if (!mk) continue;
      const g = mk.g || 'cross'; if (want && !want.includes(g)) continue;
      return { m: mk, grade: g };
    }
    return null;
  }
  const GRAVE_XP = { cross: 25, grave: 60, headstone: 150 };
  function refuse(text) { notify(text); return false; }
  function cast(id) {
    const s = SPELL[id]; if (!s) return false;
    if (player.dead) return false;
    if (player.mech || ridingAlong()) return refuse('Climb down first.');
    const why = lockedWhy(s); if (why) return refuse(why);
    if (s.focus && !castFocus()) return refuse('You need a focus in hand: a wand, a stave or the Void Scythe.');
    const left = coolLeft(s); if (left > 0) return refuse(`${s.name} is ready in ${mmss(left)}.`);
    const need = costOf(s);
    if (spirit() < need) return refuse(`Not enough spirit (${Math.floor(spirit())} of ${need}). It refills by itself.`);
    const ok = DO[id](s);
    if (!ok) return false;
    N().spirit -= need; N().known[id] = true;
    if (s.rest) { if (s.id === 'walk') Q().walkUntil = (player.dayTime || 0) + s.rest; else Q().knightUntil = (player.dayTime || 0) + s.rest; }
    else CD[id] = time + s.cd;
    STATS.cast++; lookC++; lookS = id;
    return true;
  }
  const DO = {
    bolt: () => { const m = boltTarget(); if (!m) return refuse('Nothing to aim at. Face a monster.'); fireBolt('bolt', m); lookT = m; player.attackT = 0.22; return true; },
    siphon: () => { const m = boltTarget(); if (!m) return refuse('Nothing to aim at. Face a monster.'); fireBolt('siphon', m); lookT = m; player.attackT = 0.22; return true; },
    banish: () => { const m = boltTarget(); if (!m) return refuse('Nothing to aim at. Face a monster.'); if (countItem('soul_shard') < 1) return refuse('Banish needs a soul shard.'); removeItem('soul_shard', 1); fireBolt('banish', m); lookT = m; player.attackT = 0.22; return true; },
    light: () => { const p = N(); p.gl = !p.gl; notify(p.gl ? 'Ghostlight. The dead can see you now, and you them.' : 'Ghostlight off.'); burst(player.x, player.y - 20, '#9fe8d6', 10, 40); return true; },
    ward: () => { if (countItem('bone') < 3) return refuse('Bone Ward needs 3 bones.'); removeItem('bone', 3); WARD.amount = WARD.left = 8 + Math.floor(L() / 4) + power(); WARD.until = time + 20; floatText(player.x, player.y - 40, 'Bone Ward', '#e9e4d2', 13); return true; },
    raise: () => raise('sq', ['cross', 'grave', 'headstone'], [['bone', 5]]),
    risen: () => raise('rg', ['grave', 'headstone'], [['grave_dust', 2], ['bone', 5]]),
    brute: () => raise('bb', ['headstone'], [['brute_bone', 1], ['grave_dust', 3]]),
    knight: () => {
      if (countItem('soul_shard') < 3) return refuse('Call the Last Knight needs 3 soul shards.');
      removeItem('soul_shard', 3); makeHelper('lk', { x: player.x + player.facing.x * 40, y: player.y + player.facing.y * 40 });
      say(`${CHOICES.LAST_KNIGHT} of Hollowford, at your side.`, CHOICES.LAST_KNIGHT); return true;
    },
    spikes: () => {
      if (countItem('bone') < 3) return refuse('Bone Spikes needs 3 bones.');
      removeItem('bone', 3);
      const max = Math.max(1, Math.floor(boltMax() * 0.8));
      for (const m of monsters.slice()) if (fair(m) && dist(m.x, m.y, player.x, player.y) <= px(2) + m.r) necroHit(m, rollSpell(m, max), 'spell');
      FLASHES.push({ kind: 'spikes', x: player.x, y: player.y, t: 0, life: 0.7, map: mapNow() });
      return true;
    },
    step: () => {
      const n = wearing('soul_lantern') ? 4 : 3, fx = player.facing.x, fy = player.facing.y, fl = Math.hypot(fx, fy) || 1;
      const ux = fx / fl, uy = fy / fl, map = mapNow();
      let best = null;
      // every point on the line must be open ground for the knight: no wall, no water or lava, nothing fixed-solid
      for (let k = 1; k <= n * 4; k++) {
        const x = player.x + ux * k * TILE / 4, y = player.y + uy * k * TILE / 4, tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
        if (!inMap(tx, ty) || collides(x, y, player.r, 'player')) break;
        const t = tileAt(tx, ty); if (t === T.WATER || t === T.LAVA) break;
        if (window.ATLAS && ATLAS.solidAt && ATLAS.solidAt(map, tx, ty)) break;
        if (k % 4 === 0) best = { x, y };
      }
      if (!best) return refuse('No room to step there.');
      FLASHES.push({ kind: 'puff', x: player.x, y: player.y, t: 0, life: 0.5, map });
      player.x = best.x; player.y = best.y;
      FLASHES.push({ kind: 'puff', x: player.x, y: player.y, t: 0, life: 0.5, map });
      return true;
    },
    walk: () => {
      if (window.__instance) return refuse('Grave Walk only works under the open sky.');
      if (time - lastBlow < 10) return refuse('Too much fighting. Grave Walk needs 10 quiet seconds.');
      if (countItem('grave_dust') < 1) return refuse('Grave Walk needs 1 grave dust.');
      CH.walk = { t: 0, x: player.x, y: player.y, hp: player.hp };
      notify('Stand still. The mist is rising.');
      return true;   // the dust and the rest are paid now; moving breaks the channel (and the spell is spent)
    },
  };
  // where Grave Walk lands: the Old Barrow's lych-gate (89-oldbarrow sets it); null until the place is built
  const landing = { at: () => null };
  function raise(kind, grades, supplies) {
    if (L() < 5) return refuse('Raising needs Necromancy 5.');
    const H = HELPER[kind], cap = capOf(L());
    if (helperLoad() + H.weight > cap) return refuse(cap <= 1 ? 'You can only keep one helper at your level.' : `You have room for ${cap} helpers${kind === 'bb' ? ' (a brute counts as two)' : ''}.`);
    const g = ownGrave(grades);
    if (g) {
      GRAVES.removeMarker(g.m);
      const xp = GRAVE_XP[g.grade] || 25; gainXp('necromancy', xp); floatText(tc(g.m.x), tc(g.m.y) - 30, `+${xp} Necromancy`, '#4fd1b5', 12);
      makeHelper(kind, { x: tc(g.m.x), y: tc(g.m.y) });
    } else {
      for (const [id, n] of supplies) if (countItem(id) < n) return refuse(`${SPELL[kind === 'sq' ? 'raise' : kind === 'rg' ? 'risen' : 'brute'].name} needs ${supplies.map(([i, q]) => q + ' ' + ITEMS[i].name.toLowerCase() + (q > 1 && !/s$/.test(ITEMS[i].name) ? 's' : '')).join(' and ')}, or one of your own graves.`);
      for (const [id, n] of supplies) removeItem(id, n);
      makeHelper(kind, { x: player.x + player.facing.x * 40, y: player.y + player.facing.y * 40 });
    }
    STATS.raised++;
    return true;
  }
  // the channel: moving, being hit, a machine or a door breaks it; 2 s still and the knight wakes at the lych-gate
  function stepWalk(dt) {
    const c = CH.walk; if (!c) return;
    if (player.dead || player.mech || window.__instance || dist(player.x, player.y, c.x, c.y) > 3 || player.hp < c.hp) { CH.walk = null; notify('The mist falls apart.'); return; }
    c.t += dt;
    if (Math.floor(c.t * 8) !== Math.floor((c.t - dt) * 8)) FLASHES.push({ kind: 'mist', x: player.x, y: player.y, t: 0, life: 0.9, map: mapNow() });
    if (c.t < 2) return;
    CH.walk = null;
    const at = landing.at();
    if (!at) { notify('The mist has nowhere to take you yet.'); return; }
    removeItem('grave_dust', 1);
    FLASHES.push({ kind: 'mist', x: player.x, y: player.y, t: 0, life: 1.2, map: 'over' });
    const s = safeSpot(tc(at[0]), tc(at[1]), player.r, 'player') || { x: tc(at[0]), y: tc(at[1]) };
    player.x = s.x; player.y = s.y; player.action = null;
    burst(player.x, player.y, '#9fe8d6', 20, 80);
    notify('You wake at the Old Barrow, under the lych-gate.');
  }

  // ---------- the ward: it soaks up blows before anything else does (the outermost hurtPlayer) ----------
  { const _hurtPlayer = hurtPlayer;
    hurtPlayer = function (dmg, fromX, fromY, sure) {
      if (WARD.left > 0 && time < WARD.until && dmg > 0 && !player.mech) {
        const soak = Math.min(WARD.left, dmg); WARD.left -= soak; dmg -= soak;
        floatText(player.x, player.y - 46, 'warded ' + soak, '#e9e4d2', 12);
        if (WARD.left <= 0) floatText(player.x, player.y - 58, 'the ward breaks', '#c3bda6', 12);
        if (dmg <= 0) { lastBlow = time; return; }
      }
      return _hurtPlayer.call(this, dmg, fromX, fromY, sure);
    }; }

  // ---------- the bolt face: Space with a focus in hand fires Soul Bolt (the Void Scythe keeps its swing) ----------
  { const _playerAttack = playerAttack;
    playerAttack = function () {
      const blocking = !!(window.OUTLIERS && OUTLIERS.BLOCK && OUTLIERS.BLOCK.t > 0);
      if (focusInHand() && !player.mech && !ridingAlong() && !player.dead && !blocking) {
        if (player.attackCd > 0) return;
        // the training dummies at the Old Barrow (89-oldbarrow) answer a bolt with no monster in reach
        const s = SPELL.bolt;
        if (!boltTarget() && dummyBolt()) return;
        if (cast('bolt')) player.attackCd = s.cd;
        else player.attackCd = 0.3;
        return;
      }
      return _playerAttack.apply(this, arguments);
    }; }
  // a dummy in front of the knight (OLD_BARROW registers the finder): 8 XP a hit, up to 300 a day of his clock
  const dummies = { find: () => null };
  function dummyBolt() {
    const d = dummies.find(); if (!d) return false;
    if (!canKnow(SPELL.bolt)) { notify(lockedWhy(SPELL.bolt)); return true; }
    const need = costOf(SPELL.bolt); if (spirit() < need) { notify(`Not enough spirit (${Math.floor(spirit())} of ${need}). It refills by itself.`); player.attackCd = 0.3; return true; }
    N().spirit -= need; player.attackCd = SPELL.bolt.cd; player.attackT = 0.22; lookC++; lookS = 'bolt';
    const b = { kind: 'bolt', x: player.x + player.facing.x * 14, y: player.y - 18, m: null, tx: d.x, ty: d.y, t: 0, life: 0.6, map: mapNow() };
    BOLTS.push(b); sfx('swing');
    const day = Math.floor((player.dayTime || 0) / ((window.NIGHT && NIGHT.DAY) || 600));
    if (STATS.dummy.day !== day) { STATS.dummy.day = day; STATS.dummy.xp = 0; }
    const dmg = rint(1, boltMax());
    floatText(d.x, d.y - 30, '-' + dmg, '#4fd1b5', 12);
    if (STATS.dummy.xp < XP.dummyDay) { const xp = Math.min(XP.dummy, XP.dummyDay - STATS.dummy.xp); STATS.dummy.xp += xp; gainXp('necromancy', xp); }
    else if (!STATS.dummy.told) { STATS.dummy.told = true; notify('The dummies have taught you all they can today.'); }
    return true;
  }

  // ---------- items from the pack: crush a soul shard (+15 spirit) ----------
  const ITEM_USE = { soul_shard: () => { if (spirit() >= spiritMax()) { notify('Your spirit is full.'); return; } removeItem('soul_shard', 1); addSpirit(SPIRIT.shard); floatText(player.x, player.y - 40, '+' + SPIRIT.shard + ' spirit', '#4fd1b5', 13); burst(player.x, player.y - 10, '#5fe3c4', 12, 60); } };
  { const _useItem = useItem;
    useItem = function (slot) { const s = player.inv[slot]; if (s && ITEM_USE[s.id]) { ITEM_USE[s.id](); return; } return _useItem.apply(this, arguments); }; }
  PACK_ROWS.push({ id: 'necro_use', show: () => { const s = selectedSlot >= 0 ? player.inv[selectedSlot] : null; return !!(s && ITEM_USE[s.id]); },
    draw: (g, x, y, w, h) => { const s = player.inv[selectedSlot]; if (!s) return; const label = s.id === 'soul_shard' ? 'Crush the shard (+15 spirit)' : (ITEM_USE[s.id].label || 'Use it');
      PANEL_KIT.verb(g, x, y, Math.min(w, PANEL_KIT.verbW(g, label, 'skull', h)), h, label, () => { const i = player.inv.findIndex(q => q && q.id === s.id); if (i >= 0) useItem(i); }, { emblem: 'skull', tone: 'primary' }); } });

  // ======================================================================================================================
  // 7. THE TICK
  // ======================================================================================================================
  const GL = { drainAcc: 0 };
  HOOKS.update.push(dt => {
    if (player.dead) { CH.walk = null; }
    const p = N(), max = spiritMax();
    if (p.spirit < max) p.spirit = Math.min(max, p.spirit + refillRate() * dt); else if (p.spirit > max) p.spirit = max;
    // Ghostlight's drain: 1 spirit every 4 s, free with the Soul lantern; at none it goes out
    if (p.gl) {
      if (player.mech) { p.gl = false; }
      else if (!wearing('soul_lantern')) { GL.drainAcc += dt; while (GL.drainAcc >= 4) { GL.drainAcc -= 4; p.spirit -= 1; } if (p.spirit <= 0) { p.spirit = 0; p.gl = false; notify('Your Ghostlight fades. Your spirit is spent.'); } }
    }
    if (WARD.left > 0 && time >= WARD.until) WARD.left = 0;
    stepBolts(dt); stepHelpers(dt); stepWalk(dt);
    for (let i = FLASHES.length - 1; i >= 0; i--) { FLASHES[i].t += dt; if (FLASHES[i].t >= FLASHES[i].life) FLASHES.splice(i, 1); }
    if (pressed.has('KeyU') && !player.dead) { if (panel === 'spells') closePanel(); else openPanel('spells'); }
    if (pressed.has('KeyZ') && !player.dead && !panel) castReady();
  });
  HOOKS.keyHelp.push({ action: 'Spellbook', codes: ['KeyU'] }, { action: 'Cast the ready spell', codes: ['KeyZ'] });
  function castReady() { const s = SPELL[N().ready] || SPELL.bolt; return cast(s.id); }
  HOOKS.newGame.push(() => { player.necro = { spirit: 20, known: {}, ready: 'bolt', ghosts: {}, watch: { best: 0 } }; quest.necro = { walkUntil: 0, knightUntil: 0 }; HELPERS.length = 0; BOLTS.length = 0; FLASHES.length = 0; WARD.left = 0; CH.walk = null; for (const k in CD) delete CD[k]; });

  // ======================================================================================================================
  // 8. ONLINE: look.necro (spec 7.2). Built by a playerLook wrapper; 73-players' lookKey adds NECRO.lookKey(), so a cast or
  //    a raise sends presence at once, and while a helper is out presence goes 4 times a second (their places move).
  // ======================================================================================================================
  function lookNecro() {
    const o = {}, p = player.necro || {};
    let any = false;
    if (lookC) { o.c = lookC; o.s = lookS || 'bolt'; any = true;
      const t = lookT; if (t && typeof t.nid === 'string') o.tx = t.nid; else if (t) { o.tx = Math.round(t.x - player.x); o.ty = Math.round(t.y - player.y); } }
    if (p.gl) { o.gl = 1; any = true; }
    if (WARD.left > 0 && time < WARD.until) { o.w = Math.max(1, Math.min(9, Math.round(9 * WARD.left / (WARD.amount || 1)))); any = true; }
    const hs = helpersHere().slice(0, 3);
    if (hs.length) { o.h = hs.map(h => [h.kind, Math.round(clamp(h.x - player.x, -px(8), px(8))), Math.round(clamp(h.y - player.y, -px(8), px(8))), h.facing.x < 0 ? -1 : 1, Math.max(0, Math.min(9, Math.round(9 * h.life / (h.max || 1))))]); any = true; }
    if (CH.walk) { o.s = 'walk'; any = true; }
    return any ? o : null;
  }
  { const _playerLook = playerLook;
    playerLook = function () { const l = _playerLook.apply(this, arguments); const n = lookNecro(); if (n) l.necro = n; return l; }; }
  // what makes presence go out at once: a cast, the helper count, the light, the ward; and a quarter-second tick while a
  // helper is out (so friends see it move even while the knight stands still)
  const lookKey = () => { const hs = helpersHere().length, p = player.necro || {}; return lookC + ':' + hs + ':' + (p.gl ? 1 : 0) + ':' + (WARD.left > 0 ? 1 : 0) + ':' + (CH.walk ? 1 : 0) + (hs ? ':' + Math.floor(time * 4) : ''); };
  // a friend's look.necro, read defensively: wrong types are dropped, numbers clamped, at most 3 helpers, offsets 8 tiles
  const KINDS = new Set(['sq', 'rg', 'bb', 'lk']), SIDS = new Set(['bolt', 'siphon', 'banish', 'spikes', 'walk', 'step', 'ward', 'raise', 'risen', 'brute', 'knight', 'light']);
  function readLook(n) {
    if (!n || typeof n !== 'object' || Array.isArray(n)) return null;
    const num = v => typeof v === 'number' && Number.isFinite(v) ? v : null, lim = px(8);
    const o = { c: num(n.c) !== null ? Math.floor(num(n.c)) : 0, s: typeof n.s === 'string' && SIDS.has(n.s) ? n.s : null, gl: n.gl === 1 || n.gl === true, w: num(n.w) !== null ? clamp(Math.round(num(n.w)), 0, 9) : 0, h: [], tnid: null, tx: null, ty: null };
    if (typeof n.tx === 'string' && n.tx.length < 24) o.tnid = n.tx;
    else if (num(n.tx) !== null && num(n.ty) !== null) { o.tx = clamp(num(n.tx), -lim, lim); o.ty = clamp(num(n.ty), -lim, lim); }
    if (Array.isArray(n.h)) for (const r of n.h.slice(0, 3)) {
      if (!Array.isArray(r) || !KINDS.has(r[0])) continue;
      const dx = num(r[1]), dy = num(r[2]); if (dx === null || dy === null) continue;
      o.h.push({ kind: r[0], dx: clamp(dx, -lim, lim), dy: clamp(dy, -lim, lim), fx: r[3] === -1 ? -1 : 1, frac: num(r[4]) !== null ? clamp(num(r[4]), 0, 9) / 9 : 1 });
    }
    return o;
  }
  // every remote knight on this map with a necro look, read for drawing (from 73-players' REMOTE: PLAYERS.step keeps it
  // current, even on the teacher's page where update() never runs)
  function remotes() {
    const out = [], R = window.PLAYERS && PLAYERS.remote; if (!R) return out;
    const my = window.PLAYERS.mapId ? PLAYERS.mapId() : mapNow();
    for (const n in R) { const e = R[n]; if (!e || e.map !== my || !e.look || !e.look.necro) continue; const lk = readLook(e.look.necro); if (lk) out.push({ n, e, lk }); }
    return out;
  }
  // does a ghost at (x, y) show? This knight's own Ghostlight within 7 tiles, or a friend's Ghostlight while this knight
  // stands within 5 tiles of that friend (spec 3.2: friends share the sight, each on his own game)
  function seesGhost(x, y) {
    const p = player.necro || {};
    if (p.gl && dist(x, y, player.x, player.y) <= px(7)) return true;
    for (const r of remotes()) if (r.lk.gl && dist(r.e.shown.x, r.e.shown.y, player.x, player.y) <= px(5) && dist(x, y, r.e.shown.x, r.e.shown.y) <= px(7)) return true;
    return false;
  }
  // the Ghostlights near a point (this knight's and every friend's on this map), for the Hollow's fade (89-oldbarrow)
  function lightsNear(x, y, r) {
    const out = []; const p = player.necro || {};
    if (p.gl && !player.dead && dist(x, y, player.x, player.y) <= r) out.push(typeof NET !== 'undefined' && NET.me ? NET.me : 'me');
    for (const q of remotes()) if (q.lk.gl && dist(x, y, q.e.shown.x, q.e.shown.y) <= r) out.push(q.n);
    if (window.COOP && COOP.knightsHere) { try { for (const k of COOP.knightsHere()) if (k && k.look && k.look.necro && readLook(k.look.necro) && readLook(k.look.necro).gl && dist(x, y, k.x, k.y) <= r && !out.includes(k.n)) out.push(k.n); } catch (e) { } }
    return out;
  }

  // ======================================================================================================================
  // 9. THE HUD: the spirit plaque, the CAST and BOLT faces, the SPELLS tile, the spellbook panel (U)
  // ======================================================================================================================
  const plaqueOn = () => !player.dead && (focusInHand() || spirit() < spiritMax() - 0.5 || helpersHere().length > 0);
  HOOKS.hud.push(g => {
    if (!plaqueOn() || title.active) return;
    const s = Math.floor(spirit()), m = spiritMax();
    HK.addPlaque(g, { id: 'spirit', emblem: 'skull', name: 'SPIRIT', right: `${s} / ${m}`, frac: m ? s / m : 0, bar: '#4fd1b5' });
  });
  hudSeatFace('swing', { id: 'bolt', prio: 5, when: () => focusInHand() && !player.mech && !player.dead && !ridingAlong(), emblem: 'bolt', ribbon: 'BOLT', key: 'Space', name: 'Soul Bolt',
    lit: () => !!boltTarget(), cool: () => { const l = coolLeft(SPELL.bolt); return l > 0 ? { frac: l / SPELL.bolt.cd, text: '' } : null; }, action: () => touch.taps.push('attack') });
  hudSeatFace('ctx', { id: 'cast', prio: 8, when: () => !player.mech && !player.dead && !ridingAlong() && SPELLS.some(canKnow), emblem: () => (SPELL[N().ready] || SPELL.bolt).em, ribbon: 'CAST', key: 'Z',
    name: () => 'Cast ' + (SPELL[N().ready] || SPELL.bolt).name, on: () => N().ready === 'light' && !!N().gl,
    cool: () => { const s = SPELL[N().ready] || SPELL.bolt, l = coolLeft(s); return l > 0 ? { frac: Math.min(1, l / (s.rest || s.cd || 1)), text: l >= 1 ? String(Math.ceil(l)) : '' } : null; },
    action: () => castReady() });
  hudControl({ id: 'spells', emblem: 'skull', key: 'U', label: () => 'SPELLS', on: () => panel === 'spells', action: () => { if (panel === 'spells') closePanel(); else openPanel('spells'); } });

  HOOKS.panel.spells = g => {
    const K = PANEL_KIT, Rm = K.room(), T = HK.T, { R, G } = Rm, p = N();
    const W = Math.min(Rm.aw, 560), cw = W - 36, rh = R + 20, pagerH = R + 14, footH = R + 12;
    const top = 62 + 22, avail = Rm.ah - top - footH - pagerH - 12;
    const per = Math.max(2, Math.min(SPELLS.length, Math.floor(avail / (rh + G))));
    const pages = Math.ceil(SPELLS.length / per), H = top + per * (rh + G) + footH + pagerH + 6;
    const lv = L();
    const { px: x0, py: y0, h } = panelBox(g, W, H, 'Spells', `Necromancy ${lv} · Spirit ${Math.floor(spirit())} / ${spiritMax()} · Power ${power()}`);
    const x = x0 + 18, pg = clamp(K.page('spells'), 0, pages - 1);
    K.para(g, touchMode() ? 'Tap a spell to make it ready. CAST casts it.' : `Click a spell to make it ready. ${keyName('KeyZ')} casts it.`, x, y0 + 72, cw, { size: 12.5, lines: 1, color: T.inkDim, fitId: 'spells:hint' });
    let y = y0 + top;
    for (const s of SPELLS.slice(pg * per, pg * per + per)) {
      const why = lockedWhy(s), sel = p.ready === s.id, on = !why;
      const st = K.plate(g, x, y, cw, rh, 'spell:' + s.id, () => { if (on) { p.ready = s.id; save(); } else notify(why); }, { tone: sel ? 'primary' : null });
      const nameW = cw - 24 - 70;
      K.name(g, s.name, x + 12, y + 19 + st.dy, nameW, { size: 13.5, color: on ? (sel ? T.goldHi : T.ink) : T.inkMute, fitId: 'spells:name' });
      K.name(g, 'Lv ' + s.lv, x + cw - 12, y + 19 + st.dy, 64, { size: 12, align: 'right', color: lv >= s.lv ? T.good : T.inkMute, fitId: 'spells:lv' });
      const cost = [costOf(s) ? costOf(s) + ' spirit' : null, s.rest ? 'rest ' + mmss(s.rest) : s.cd >= 1 ? s.cd + ' s' : null].filter(Boolean).join(' · ');
      K.para(g, why ? why : (cost ? cost + ' · ' : '') + s.what, x + 12, y + 19 + 17 + st.dy, cw - 24, { size: 11.5, min: 10, lines: 1, color: on ? T.inkDim : T.inkMute, fitId: 'spells:text' });
      y += rh + G;
    }
    const fy = y0 + h - 14 - pagerH - R;
    const ready = SPELL[p.ready] || SPELL.bolt, cl = coolLeft(ready), okNow = !lockedWhy(ready) && cl <= 0;
    const label = cl > 0 ? `${ready.name}: ${mmss(cl)}` : `Cast ${ready.name}`;
    K.verb(g, x, fy, Math.min(cw, Math.max(K.verbW(g, label, ready.em, R), 160)), R, label, () => { closePanel(); castReady(); }, { emblem: ready.em, tone: okNow ? 'primary' : null, enabled: okNow });
    pager(g, x, y0 + h - 14 - R, cw, pg, pages, q => K.page('spells', clamp(q, 0, pages - 1)));
  };

  // ======================================================================================================================
  // 10. DRAWING (from state this file keeps, and from presence: 79-view never runs update())
  // ======================================================================================================================
  const viewing = () => !!(window.VIEW && VIEW.state && VIEW.state.on);
  const RGLIDE = new Map();      // name -> { at, hs: [{x, y}] } a friend's helpers gliding to their last reported spots
  const RCAST = new Map();       // name -> the last cast counter drawn (a new one starts a bolt picture)
  const RFX = [];                // remote pictures in flight { kind, x, y, tx, ty, t, life, nid }
  HOOKS.draw.push((g, items) => {
    const A = window.NECRO_ART; if (!A) return;
    const here = mapNow(), vis = (x, y, r) => x + r > cam.x && x - r < cam.x + VW && y + r > cam.y && y - r < cam.y + VH;
    if (!viewing()) {
      for (const h of HELPERS) if (h.map === here && vis(h.x, h.y, 80)) items.push({ y: h.y + h.r * 0.5, draw: () => A.helper(g, h.kind, h, { frac: h.max ? h.life / h.max : 1, rise: h.rise }) });
      for (const b of BOLTS) if (b.map === here) items.push({ y: 1e8, draw: () => A.bolt(g, b.kind, b.x, b.y, b.tx, b.ty) });
      for (const f of FLASHES) if (f.map === here) items.push({ y: f.kind === 'mist' ? f.y + 1 : f.y - 1, draw: () => A.flash(g, f.kind, f.x, f.y, f.t / f.life) });
      if (WARD.left > 0 && time < WARD.until && !player.dead) for (let k = 0; k < 6; k++) { const a = time * 2.4 + k * Math.PI / 3, sx = player.x + Math.cos(a) * 24, sy = player.y - 12 + Math.sin(a) * 12; items.push({ y: sy + (Math.sin(a) > 0 ? 14 : -14), draw: () => A.shard(g, sx, sy, a) }); }
      if (CH.walk) items.push({ y: player.y + 2, draw: () => A.flash(g, 'mist', player.x, player.y, CH.walk.t / 2) });
    }
    // friends: their helpers, their ward, their bolts (a new cast counter), their Ghostlight's glow
    const now = time, seen = new Set();
    for (const r of remotes()) {
      const { n, e, lk } = r; seen.add(n);
      const ex = e.shown.x, ey = e.shown.y;
      let gl = RGLIDE.get(n); if (!gl) { gl = { at: now, hs: [] }; RGLIDE.set(n, gl); }
      const k = Math.min(1, Math.max(0, now - gl.at) / 0.18); gl.at = now;
      gl.hs.length = lk.h.length;
      lk.h.forEach((q, i) => {
        const want = { x: ex + q.dx, y: ey + q.dy }, c = gl.hs[i] || (gl.hs[i] = { x: want.x, y: want.y, mv: 0 });
        const ox = c.x, oy = c.y; c.x += (want.x - c.x) * k; c.y += (want.y - c.y) * k; c.mv = Math.hypot(c.x - ox, c.y - oy) > 0.3 ? 1 : 0;
        const ent = { x: c.x, y: c.y, facing: { x: q.fx, y: 0.2 }, moving: !!c.mv, walkT: now * 9, attackT: 0, r: HELPER[q.kind].r };
        if (vis(c.x, c.y, 80)) items.push({ y: c.y + 6, draw: () => A.helper(g, q.kind, ent, { frac: q.frac, rise: 1 }) });
      });
      if (lk.w > 0) for (let kk = 0; kk < 6; kk++) { const a = now * 2.4 + kk * Math.PI / 3, sx = ex + Math.cos(a) * 24, sy = ey - GLOW + Math.sin(a) * GLOW; items.push({ y: sy + (Math.sin(a) > 0 ? 14 : -14), draw: () => A.shard(g, sx, sy, a) }); }
      const was = RCAST.get(n); RCAST.set(n, lk.c);
      if (was != null && lk.c > was && lk.s && /bolt|siphon|banish/.test(lk.s)) {
        let tx = null, ty = null;
        if (lk.tnid) { const m = monsters.find(q => q.nid === lk.tnid); if (m) { tx = m.x; ty = m.y; } }
        else if (lk.tx !== null) { tx = ex + lk.tx; ty = ey + lk.ty; }
        if (tx !== null) RFX.push({ kind: lk.s, x: ex, y: ey - HAND, tx, ty, t: 0, t0: now, nid: lk.tnid });
      } else if (was != null && lk.c > was && lk.s === 'spikes') RFX.push({ kind: 'spikes', x: ex, y: ey, t: 0, t0: now, flash: true });
      else if (was != null && lk.c > was && lk.s === 'step') RFX.push({ kind: 'puff', x: ex, y: ey, t: 0, t0: now, flash: true });
      if (lk.s === 'walk') items.push({ y: ey + 2, draw: () => A.flash(g, 'mist', ex, ey, (now % 2) / 2) });
    }
    for (const n of [...RGLIDE.keys()]) if (!seen.has(n)) { RGLIDE.delete(n); RCAST.delete(n); }
    for (let i = RFX.length - 1; i >= 0; i--) {
      const f = RFX[i], age = now - f.t0;
      if (f.flash) { if (age > 0.6) { RFX.splice(i, 1); continue; } items.push({ y: f.y, draw: () => A.flash(g, f.kind, f.x, f.y, age / 0.6) }); continue; }
      const d = Math.hypot(f.tx - f.x, f.ty - f.y), tt = d / BOLT_SPEED;
      if (age > tt || age > 1.4) { RFX.splice(i, 1); continue; }
      const u = tt > 0 ? age / tt : 1, bx = f.x + (f.tx - f.x) * u, by = f.y + (f.ty - f.y) * u;
      items.push({ y: 1e8, draw: () => A.bolt(g, f.kind, bx, by, f.tx, f.ty) });
    }
  });
  // the Ghostlight's glow: this knight's and every friend's (a light of their own in the dark: 89-lighting's sources)
  if (window.LIGHTS && LIGHTS.addSource) LIGHTS.addSource(out => {
    const p = player.necro || {};
    if (p.gl && !player.dead && !viewing()) out.push({ kind: 'point', x: player.x, y: player.y - 12, r: wearing('soul_lantern') ? 220 : 150, lift: 0.85, tint: 0.35, color: '#7ef0d0', rgb: [126, 240, 208] });
    for (const r of remotes()) if (r.lk.gl) out.push({ kind: 'point', x: r.e.shown.x, y: r.e.shown.y - GLOW, r: 150, lift: 0.8, tint: 0.3, color: '#7ef0d0', rgb: [126, 240, 208] });
  });

  // and on the open land at night (35-night cuts holes in its dark for every night light: whole-number radii)
  if (HOOKS.nightLights) HOOKS.nightLights.push(out => {
    if (window.__instance) return;
    const p = player.necro || {};
    if (p.gl && !player.dead && !viewing()) out.push({ x: Math.round(player.x), y: Math.round(player.y - 12), r: wearing('soul_lantern') ? 220 : 150 });
    for (const r of remotes()) if (r.lk.gl) out.push({ x: Math.round(r.e.shown.x), y: Math.round(r.e.shown.y - GLOW), r: 150 });
  });

  // ======================================================================================================================
  // 11. THE PROGRESSION AUDIT (42-playthrough reads HOOKS.xpSource; spec 1.4)
  // ======================================================================================================================
  const WATCH_SECS = 210;
  HOOKS.xpSource.push(add => {
    add('necromancy', 'soul bolts (2 xp per damage, avg hit 2)', 1, 4, 1.9, 'spirit-limited at level 1');
    add('necromancy', 'raise your own wood cross', 5, 25, 20, 'one per goblin kill');
    add('necromancy', 'offer bones at the Bone Altar', 1, 15, 13.2, 'a bone is 12 s to get, 1.2 s to offer');
    add('necromancy', 'offer brute bones', 30, 70, 46.2, '');
    add('necromancy', 'offer dragon bones', 45, 160, 41.2, '');
    const W = CHOICES.WATCH_XP, full = b => b * (1 + 2 + 3 + 4 + 5 + 6);
    add('necromancy', `Dusk Watch (6 waves, about ${WATCH_SECS} s)`, 10, full(W.dusk), WATCH_SECS, '89-oldbarrow: the Lantern Watch');
    add('necromancy', 'Midnight Watch', 40, full(W.midnight), WATCH_SECS, '');
    add('necromancy', 'Deep Watch', 70, full(W.deep), WATCH_SECS, '');
    for (const [name, xp] of [['Bramble\'s Last Walk (once)', 450], ['The Bell-Ringer (once)', 1200], ['Lanterns for the Lost (once)', 3000], ['The Barrow King (once)', 10000], ['The Name on the Stone (once)', 25000]]) add('necromancy', name, 1, xp, 0, 'quest');
    add('necromancy', 'twelve ghosts met (once each)', 3, 12 * 250, 0, 'Speak with the Dead');
    add('necromancy', 'the Gravewood stave (once)', 30, 400, 0, 'the Bone Altar');
  });

  // ======================================================================================================================
  // 12. SELF-TESTS (spec 8.3: N1 to N10, N15 to N17, N19; the place's are 89-oldbarrow's)
  // ======================================================================================================================
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'necro: ';
    const keep = { equip: Object.assign({}, player.equip), inv: player.inv.map(s => s && Object.assign({}, s)), xp: {}, x: player.x, y: player.y, facing: Object.assign({}, player.facing), hp: player.hp,
      necro: JSON.stringify(player.necro || {}), q: JSON.stringify(quest.necro || {}), barrow: JSON.stringify(quest.barrow || {}), graves: JSON.stringify(quest.graves || []), day: player.dayTime, rnd: Math.random, mons: monsters, mech: player.mech, cd: player.attackCd };
    for (const s of SKILL_DEFS) keep.xp[s.key] = player.skills[s.key] ? player.skills[s.key].xp : 0;
    const setLv = lv => { player.skills.necromancy.xp = xpForLevel(lv); };
    const empty = () => { player.inv = new Array(INV_SLOTS).fill(null); };
    const wear = (...ids) => { for (const s of EQUIP_SLOTS) player.equip[s] = null; for (const id of ids) { const it = ITEMS[id]; const slot = it.weapon ? 'weapon' : it.armour.slot === 'head' ? 'helm' : it.armour.slot; player.equip[slot] = id; } };
    const freshState = () => { player.necro = { spirit: 50, known: {}, ready: 'bolt', ghosts: {}, watch: { best: 0 } }; quest.necro = { walkUntil: 0, knightUntil: 0 }; HELPERS.length = 0; BOLTS.length = 0; FLASHES.length = 0; WARD.left = 0; CH.walk = null; for (const k in CD) delete CD[k]; quest.barrow = { q1: 9, q2: 9, q3: 9, q4: 9, q5: 9, lanterns: [] }; };
    const solo = list => { monsters = list; };
    const mon = (type, x, y) => { const d = MONSTER_DEFS[type]; return { type, x, y, home: { x, y }, r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: true, state: 'idle', wanderT: 9, wander: { x: 0, y: 0 }, attackCd: 9, hurtT: 0, dead: false, deadT: 0, respawnT: 1e9, facing: { x: -1, y: 0 }, walkT: 0, moving: false, stunT: 9 }; };
    const open = () => { const s = h.openSpot ? h.openSpot(Math.floor(player.x / TILE), Math.floor(player.y / TILE)) : null; if (s) F.tp(s.x !== undefined ? s.x : s[0], s.y !== undefined ? s.y : s[1]); };
    const tick = n => { for (let i = 0; i < n; i++) F.step([]); };
    // the dice pinned for a sure hit for the most: the accuracy roll (under the chance) then the damage roll (the top)
    const sure = () => { ROLL.sure = true; };
    try {
      h.peace(true);
      if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave();
      // ---- N1 the skill ----
      { const def = SKILL_DEFS.find(s => s.key === 'necromancy'), cape = ITEMS.cape_necromancy;
        const rows = window.PLAYTHROUGH ? PLAYTHROUGH.progression().rows.filter(r => r.skill === 'necromancy') : [];
        const capeRow = rows.find(r => r.kind === 'cape'), dead = rows.filter(r => r.dead);
        // an old save with no necromancy in it loads with the skill at level 1 (04-state fills every SKILL_DEFS key)
        let oldSave = null; { const raw0 = localStorage.getItem(SAVE_KEY); save(); const d = JSON.parse(localStorage.getItem(SAVE_KEY)); delete d.player.skills.necromancy; delete d.player.necro; localStorage.setItem(SAVE_KEY, JSON.stringify(d)); load(); oldSave = !!player.skills.necromancy && player.skills.necromancy.xp === 0 && Number.isFinite(N().spirit); if (raw0) localStorage.setItem(SAVE_KEY, raw0); else save(); load(); }
        check(P + 'N1 the skill: Necromancy is a SKILL_DEFS row with no `needs` (it shows at Lv 1 from the start), an old save loads with it, the cape (#4fd1b5, "Helpers last twice as long", 999 coins, power 3) is bought at 99; the progression audit puts the cape at 80 to 130 hours and no row is dead',
          !!def && !def.needs && oldSave && !!cape && cape.capeSkill === 'necromancy' && cape.value === 999 && cape.color === '#4fd1b5' && cape.necro.power === 3 && !!capeRow && capeRow.hours >= 80 && capeRow.hours <= 130 && !dead.length && CHOICES.SHOW_FROM_START,
          { needs: def && def.needs, oldSave, capeHours: capeRow && capeRow.hours, best: capeRow && capeRow.best, dead: dead.map(r => r.what) }); }
      for (const s of SKILL_DEFS) player.skills[s.key].xp = keep.xp[s.key];
      freshState();
      // ---- N2 spirit ----
      { const CHK = { lv1: 1, p1: 2, lv99: 99, p99: 43 }, f = [spiritMax(CHK.lv1, CHK.p1), spiritMax(CHK.lv99, CHK.p99)];
        setLv(1); wear('barrow_wand'); const p = N();
        lastBlow = time; const fight = refillRate(); lastBlow = -1e9; const calm = refillRate();
        const [cx, cy] = window.OLD_BARROW ? OLD_BARROW.P('circle') : [0, 0]; const px0 = player.x, py0 = player.y; F.tp(cx, cy); const circ = refillRate(); player.x = px0; player.y = py0;
        p.spirit = 0; openPanel('altar'); const altar = p.spirit === spiritMax(); closePanel();
        empty(); addItem('soul_shard', 1); p.spirit = 0; useItem(player.inv.findIndex(s => s && s.id === 'soul_shard')); const crushed = p.spirit === SPIRIT.shard && countItem('soul_shard') === 0;
        check(P + 'N2 spirit: the bar is 20 + level + power (23 at level 1 with the wand, 162 at 99 with power 43); it refills 1 a second in a fight, 2 out of one, 4 in the candle circle; the Bone Altar fills it; a crushed soul shard gives 15',
          f[0] === 23 && f[1] === 162 && spiritMax() === 23 && fight === 1 && calm === 2 && circ === 4 && altar && crushed, { f, now: spiritMax(), fight, calm, circ, altar, crushed }); }
      freshState(); empty();
      // ---- N3 Soul Bolt ----
      { setLv(1); wear(); notice = null; const noFocus = !cast('bolt') && !!notice && /focus/.test(notice.text);
        wear('barrow_wand'); open(); player.facing = { x: 1, y: 0 };
        const gob = mon('goblin', player.x + 80, player.y); solo([gob]);
        N().spirit = 10; const s0 = N().spirit; const ok1 = cast('bolt'); const paid = s0 - N().spirit; const ok2 = cast('bolt');
        const table = [[1, 2, 2], [30, 6, 7], [50, 10, 12], [70, 38, 24], [99, 43, 35]].map(([l, p, want]) => [l, p, boltMax(l, p), want]);
        // the hit: Math.random pinned so it lands for the most; 2 xp a damage, and 2/3 a damage to Hitpoints
        sure();
        BOLTS.length = 0; for (const k in CD) delete CD[k]; const nx = player.skills.necromancy.xp, hx = player.skills.hitpoints.xp, hp0 = gob.hp;
        cast('bolt'); for (let i = 0; i < 60 && BOLTS.length; i++) tick(1);
        const dmg = hp0 - gob.hp, xpN = player.skills.necromancy.xp - nx, xpH = player.skills.hitpoints.xp - hx;
        ROLL.sure = false;
        // never a townsperson (they are not monsters), a companion, livestock, the Watch's candles
        const never = ['sheep', 'cow', 'ally_knight', 'watch_candle', 'watch_bell'].filter(t => MONSTER_DEFS[t]).map(t => { const m = mon(t, player.x + 60, player.y); if (t === 'ally_knight') m.ally = true; solo([m]); return [t, !fair(m) && !boltTarget()]; });
        check(P + 'N3 Soul Bolt: refused with no focus; 2 spirit and a 1.2 s cooldown; the max hit at the five checkpoints (2, 7, 12, 24, 35: the spec\'s 22 at level 70 with power 38 is its arithmetic slip, the formula gives 24); a landed bolt pays 2 xp a damage and two thirds of that to Hitpoints; never a sheep, a cow, a companion or a candle',
          noFocus && ok1 && paid === 2 && !ok2 && table.every(r => r[2] === r[3]) && dmg === boltMax() && xpN === 2 * dmg && xpH === Math.floor(2 * dmg * CHOICES.HP_SHARE) && never.every(r => r[1]),
          { noFocus, ok1, paid, ok2, table, dmg, xpN, xpH, never }); }
      freshState(); solo([]);
      // ---- N4 Ghostlight ----
      { setLv(3); wear('barrow_wand'); const p = N(); p.spirit = 20;
        const gx = player.x + px(3), gy = player.y;
        const before = seesGhost(gx, gy); cast('light'); const on = p.gl && seesGhost(gx, gy);
        const s0 = p.spirit; tick(60 * 8); const drained = Math.round(s0 + 8 * 0 - p.spirit);
        // (refill runs too: measure the drain alone by a calm-free, full-refill-free check)
        p.spirit = 5; GL.drainAcc = 0; const r0 = p.spirit, t0 = time; for (let i = 0; i < 300; i++) { lastBlow = time; F.step([]); } const secs = time - t0, net = p.spirit - r0;   // 5 s in a fight: +5 refill, -1 drain
        wear('barrow_wand'); player.equip.shield = 'soul_lantern'; p.spirit = 5; GL.drainAcc = 0; const r1 = p.spirit; for (let i = 0; i < 300; i++) { lastBlow = time; F.step([]); } const netLantern = p.spirit - r1;   // free with the lantern
        player.equip.shield = null; cast('light'); const off = !p.gl && !seesGhost(gx, gy);
        // a friend's Ghostlight within 5 tiles shows the ghosts here too (his presence, look.necro.gl)
        const R = window.PLAYERS && PLAYERS.remote; let shared = null, far = null;
        if (R) { R.__glTest = { n: '__glTest', map: (PLAYERS.mapId ? PLAYERS.mapId() : 'over'), x: player.x + px(2), y: player.y, shown: { x: player.x + px(2), y: player.y }, facing: { x: 1, y: 0 }, look: { necro: { gl: 1 } }, lastAt: nowMs(), hp: 10, mhp: 10 };
          shared = seesGhost(gx, gy); R.__glTest.shown = { x: player.x + px(9), y: player.y }; far = seesGhost(player.x + px(9) + px(3), player.y); delete R.__glTest; }
        check(P + 'N4 Ghostlight: ghosts show only while it is on; it drains 1 spirit every 4 s (free with the Soul lantern); a friend\'s Ghostlight (his presence, gl: 1) within 5 tiles shows them on this game too, and not from further off',
          !before && on && Math.abs(net - (secs - 1)) < 0.2 && Math.abs(netLantern - secs) < 0.2 && off && shared === true && far === false, { before, on, secs: +secs.toFixed(3), net: +net.toFixed(2), netLantern: +netLantern.toFixed(2), off, shared, far, drained }); }
      freshState(); solo([]);
      // ---- N5 Raise ----
      { setLv(5); wear('barrow_wand'); open(); player.facing = { x: 1, y: 0 }; empty();
        quest.graves = []; const tx = Math.floor(player.x / TILE) + 1, ty = Math.floor(player.y / TILE);
        const laid = window.GRAVES ? GRAVES.layMarker(tx, ty, 'cross') : false;
        const x0 = player.skills.necromancy.xp; const ok = cast('raise');
        const sq = HELPERS.find(q => q.kind === 'sq'), markerGone = window.GRAVES ? !GRAVES.markerAt(tx, ty) : false, paid = player.skills.necromancy.xp - x0;
        const notAMonster = !monsters.some(m => m === sq);
        // the cap at 5 / 50 / 80, a brute counts two
        const caps = [capOf(4), capOf(5), capOf(50), capOf(80)];
        for (const k in CD) delete CD[k]; addItem('bone', 5); const second = cast('raise');
        setLv(80); for (const k in CD) delete CD[k]; addItem('brute_bone', 1); addItem('grave_dust', 3); N().spirit = 99; const brute = cast('brute'); const load3 = helperLoad();
        for (const k in CD) delete CD[k]; addItem('bone', 5); N().spirit = 99; const over = cast('raise');
        // a helper hits with source 'necro' and pays 1 xp a damage; it times out
        HELPERS.length = 0; setLv(5); const hh = makeHelper('sq', { x: player.x + 40, y: player.y });
        const gob = mon('goblin', hh.x + 30, hh.y); gob.hp = 999; gob.maxHp = 999; solo([gob]); LAST.target = gob;
        const srcs = []; const spy = (m, d, src) => { if (m === gob) srcs.push(src); }; HOOKS.hit.push(spy);
        sure(); const xh = player.skills.necromancy.xp, g0 = gob.hp; hh.cd = 0; tick(70); ROLL.sure = false;
        HOOKS.hit.splice(HOOKS.hit.indexOf(spy), 1);
        const helperDmg = g0 - gob.hp, helperXp = player.skills.necromancy.xp - xh;
        hh.life = 0.05; tick(10); const gone = !HELPERS.includes(hh);
        check(P + 'N5 Raise: on his own wood cross a Bone Squire stands, the marker is gone (that grave never rises), 25 xp is paid; from 5 bones too; 1 helper from 5, 2 from 50, 3 from 80, a brute counts two; a helper is no monster (nothing can hit it), hits with source \'necro\' for 1 xp a damage, and times out',
          laid && ok && !!sq && markerGone && paid === 25 && notAMonster && caps.join() === '0,1,2,3' && second === false && brute && load3 === 3 && over === false && helperDmg > 0 && srcs.every(s => s === 'necro') && srcs.length > 0 && helperXp === helperDmg && gone,
          { laid, ok, sq: !!sq, markerGone, paid, caps, second, brute, load3, over, helperDmg, helperXp, srcs: srcs.slice(0, 3), gone }); }
      freshState(); solo([]); empty();
      // ---- N6 the ward ----
      { setLv(12); wear('barrow_wand'); addItem('bone', 3); N().spirit = 20; player.hp = player.maxHp;
        const ok = cast('ward'), amt = WARD.amount, hp0 = player.hp; hurtPlayer(amt + 3, player.x + 20, player.y); const took = hp0 - player.hp;
        check(P + 'N6 Bone Ward: 3 bones and 5 spirit; it soaks up exactly 8 + level/4 + power, and the rest gets through', ok && amt === 8 + Math.floor(12 / 4) + power() && took === 3 && WARD.left === 0, { ok, amt, took }); }
      freshState(); empty(); player.hp = player.maxHp;
      // ---- N7 Grave Walk ----
      { setLv(18); wear('barrow_wand'); addItem('grave_dust', 3); N().spirit = 30; open();
        const r = {};
        INSTANCES.enter('spider_den'); notice = null; r.instance = !cast('walk') && /open sky/.test(notice ? notice.text : ''); INSTANCES.leave(); open();
        lastBlow = time; notice = null; r.fight = !cast('walk') && /quiet/.test(notice ? notice.text : ''); lastBlow = -1e9;
        player.mech = { kind: 'horse', hp: 10, maxHp: 10 }; notice = null; r.riding = !cast('walk') && /Climb down/.test(notice ? notice.text : ''); player.mech = keep.mech;
        Q().walkUntil = 0; r.start = cast('walk'); tick(30); player.x += 30; tick(2); r.broken = !CH.walk && countItem('grave_dust') === 3;
        Q().walkUntil = 0; const j0 = window.PLAYERS ? PLAYERS.presence().j : 0; r.start2 = cast('walk'); tick(140);
        const at = ATLAS.port('necromancy.door'), j1 = window.PLAYERS ? PLAYERS.presence().j : 0;
        r.landed = Math.floor(player.x / TILE) === Math.round(at[0]) && Math.abs(Math.floor(player.y / TILE) - Math.round(at[1])) <= 1 && countItem('grave_dust') === 2; r.jump = j1 === j0 + 1;
        r.rest = coolLeft(SPELL.walk) > 100 && RESTS_AWAY.RESTS.some(([k, f]) => k === 'necro' && f === 'walkUntil');
        check(P + 'N7 Grave Walk: refused in an instance, within 10 s of a blow and while riding; a step during the 2 s channel breaks it; still for 2 s he wakes at the Old Barrow\'s lych-gate, one grave dust spent, a jump on presence (j + 1), and a 120 s rest on the day clock (96-rests lists it)',
          r.instance && r.fight && r.riding && r.start && r.broken && r.start2 && r.landed && r.jump && r.rest, r); }
      freshState(); empty();
      // ---- N8 Ghost Step ----
      { setLv(35); wear('barrow_wand'); N().spirit = 30; const r = {};
        // facing a solid wall a tile away: nothing to step onto, he stays put
        const C = window.OLD_BARROW && OLD_BARROW.COTTAGE; let wallOk = true;
        if (C) { F.tp(C.x - 1, C.y + 1); player.facing = { x: 1, y: 0 }; const x0 = player.x; notice = null; const ok = cast('step'); wallOk = !ok && player.x === x0; }
        // open ground: 3 tiles (4 with the lantern), never into water
        { const sp = h.openSpot(Math.floor(player.x / TILE), Math.floor(player.y / TILE), (x, y) => [1, 2, 3, 4, 5].every(d => !SOLID.has(tileAt(x, y + d)) && tileAt(x, y + d) !== T.WATER)); F.tp(sp.x, sp.y); } player.facing = { x: 0, y: 1 }; for (const k in CD) delete CD[k]; N().spirit = 30;
        const sx = player.x, sy = player.y; const ok3 = cast('step'); const moved = Math.round((player.y - sy) / TILE);
        const onFixed = window.ATLAS && ATLAS.solidAt ? ATLAS.solidAt('over', Math.floor(player.x / TILE), Math.floor(player.y / TILE)) : false;
        r.wall = wallOk; r.ok3 = ok3; r.moved = moved; r.fixed = onFixed; r.x = player.x === sx;
        F.tp(Math.floor(sx / TILE), Math.floor(sy / TILE)); player.equip.shield = 'soul_lantern'; for (const k in CD) delete CD[k]; N().spirit = 30; cast('step'); const lantern = Math.round((player.y - sy) / TILE); player.equip.shield = null;
        check(P + 'N8 Ghost Step: facing a wall he does not move (never through it); on open ground he blinks up to 3 tiles the way he faces (4 with the Soul lantern), never onto anything fixed-solid',
          r.wall && ok3 && moved === 3 && r.x && !onFixed && lantern === 4, Object.assign(r, { lantern })); }
      freshState(); solo([]); empty();
      // ---- N9 Spikes, Siphon, Banish ----
      { setLv(60); wear('bone_stave'); open(); player.facing = { x: 1, y: 0 }; N().spirit = 99;
        const z = mon('zombie', player.x + 70, player.y), gb = mon('goblin', player.x + 70, player.y); z.hp = z.maxHp = 999; gb.hp = gb.maxHp = 999;
        const banishOn = m => { solo([m]); for (const k in CD) delete CD[k]; addItem('soul_shard', 1); BOLTS.length = 0; const h0 = m.hp; sure(); cast('banish'); for (let i = 0; i < 60 && BOLTS.length; i++) tick(1); return h0 - m.hp; };
        const bz = banishOn(z), bg = banishOn(gb), max = boltMax();
        // siphon heals half
        const g2 = mon('goblin', player.x + 70, player.y); g2.hp = g2.maxHp = 999; solo([g2]); for (const k in CD) delete CD[k]; player.skills.hitpoints.xp = xpForLevel(99); player.sinceHurt = 0; player.hp = 5; BOLTS.length = 0; sure(); cast('siphon'); for (let i = 0; i < 60 && BOLTS.length; i++) tick(1); const healed = player.hp - 5, sd = 999 - g2.hp;
        // spikes: every monster within 2 tiles, none further
        const a = mon('goblin', player.x + 50, player.y), b = mon('goblin', player.x - 60, player.y + 20), c = mon('goblin', player.x + px(5), player.y); for (const m of [a, b, c]) { m.hp = m.maxHp = 999; }
        solo([a, b, c]); for (const k in CD) delete CD[k]; addItem('bone', 3); sure(); cast('spikes'); const spk = [999 - a.hp, 999 - b.hp, 999 - c.hp];
        Math.random = keep.rnd;
        ROLL.sure = false; const capOk = necroHit(mon('goblin', player.x, player.y), 9999, 'spell') === MAX_DMG;
        check(P + 'N9 Banish does two and a half times the damage to the undead and plain damage to anything else; Soul Siphon heals half the damage it lands; Bone Spikes hit every monster within 2 tiles and none further; no hit is ever more than 500',
          bz === Math.floor(max * 2.5) && bg === max && healed === Math.floor(sd / 2) && sd > 0 && spk[0] > 0 && spk[1] > 0 && spk[2] === 0 && capOk, { bz, bg, max, healed, sd, spk, capOk }); }
      freshState(); solo([]); empty();
      // ---- N15 equipment ----
      { wear('necro_hood', 'necro_robe', 'necro_wraps', 'soul_lantern', 'void_scythe'); const full = power(), set = fullSet();
        wear('necro_hood', 'necro_robe', 'necro_wraps', 'soul_lantern', 'iron_sword'); const noSet = power();
        wear('void_scythe'); const scytheFocus = castFocus() && !focusInHand(); setLv(1); open(); const gob = mon('goblin', player.x + 40, player.y); solo([gob]); player.facing = { x: 1, y: 0 }; player.attackCd = 0; F.press('Space'); const swung = player.attackT > 0 && !BOLTS.length;
        wear('necro_hood', 'necro_robe', 'necro_wraps', 'soul_lantern', 'bone_stave'); const discount = costOf(SPELL.siphon) === SPELL.siphon.spirit - 1 && costOf(SPELL.bolt) === 1;
        check(P + 'N15 power is summed from each item\'s own necro block (the kit 23, the Void Scythe 15, +5 for the whole Barrow-bound set: 43); the set takes 1 off every spell (never below 1); the Void Scythe is a focus for CAST and keeps its melee swing',
          full === 43 && set && noSet === 23 && scytheFocus && swung && discount, { full, set, noSet, scytheFocus, swung, discount }); }
      freshState(); solo([]); wear();
      // ---- N10 online: look.necro, lookKey, a friend's bad look, and nothing sent but p and hit ----
      { setLv(80); wear('bone_stave'); N().spirit = 999; open(); const r = {};
        WARD.amount = WARD.left = 20; WARD.until = time + 20;
        for (const k of ['sq', 'rg', 'bb']) makeHelper(k, { x: player.x + 30, y: player.y + 20 });
        lookC = 3; lookS = 'bolt'; lookT = { nid: 's12', x: 0, y: 0 };
        const l = PLAYERS.lookOf(); r.has = !!l.necro && l.necro.h.length === 3; r.len = JSON.stringify(l.necro).length;
        const k0 = lookKey(); lookC++; r.keyMoves = lookKey() !== k0;
        // a bad look from a friend: wrong types, 9 helpers, a 900 px offset; it reads safely and draws
        const bad = readLook({ c: 'x', s: 7, gl: 'yes', w: 99, h: Array.from({ length: 9 }, () => ['sq', 900, -900, 3, 99]).concat([['zz', 1, 1, 1, 1], 'no']) });
        r.bad = !!bad && bad.h.length === 3 && bad.h.every(q => Math.abs(q.dx) <= px(8) && Math.abs(q.dy) <= px(8)) && bad.w === 9 && bad.c === 0;
        const R = PLAYERS.remote; R.__badLook = { n: '__badLook', map: PLAYERS.mapId(), x: player.x + 40, y: player.y, shown: { x: player.x + 40, y: player.y }, facing: { x: 1, y: 0 }, look: { necro: { c: 'x', h: Array.from({ length: 9 }, () => ['sq', 900, -900, 3, 99]), w: 99, gl: 1 } }, lastAt: nowMs(), hp: 10, mhp: 10 };
        let drew = true; try { const items = []; for (const hk of HOOKS.draw) hk(ctx, items, cam); for (const it of items) it.draw(); } catch (e) { drew = String(e && e.message); }
        delete R.__badLook; r.drew = drew;
        HELPERS.length = 0; WARD.left = 0;
        check(P + 'N10 presence carries look.necro (3 helpers, a ward, the last cast: ' + r.len + ' characters, under 200); a cast moves lookKey (presence goes at once); a friend\'s bad look (wrong types, 9 helpers, a 900 px offset) reads as 3 helpers within 8 tiles and draws without a throw',
          r.has && r.len < 200 && r.keyMoves && r.bad && r.drew === true, r);
        // the wire: online as a knight who does not keep the map; a spell on a puppet goes out as the sword's 'hit' (knock 0),
        // and 60 s of casting and raising sends nothing but presence ('p') and hits
        if (typeof NET !== 'undefined' && NET.useFake) {
          const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake };
          const sent = []; let sock = null;
          const push = msg => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(msg) }); };
          const fake = { call: async () => ({}), open: () => { sock = { readyState: 1, send(str) { const m = JSON.parse(str); sent.push(m); if (m.t === 'hello') push({ t: 'welcome', me: 'Cohen', at: 0, keeper: 'Ann' }); }, close() { sock.readyState = 3; } }; return sock; } };
          let res = {};
          try {
            NET.enabled = true; NET.token = 'necro-test'; NET.useFake(fake); NET.connect();
            push({ t: 'p', n: 'Ann', map: 'over', x: player.x + 200, y: player.y, fx: 1, fy: 0, mv: false, wt: 0, hp: 20, mhp: 20, lv: 9, look: null, mech: null, dead: false, def: 100, act: null });
            const row = ['s9999', 'goblin', Math.round(player.x + 80), Math.round(player.y), 900, 900, 'idle', -1, 0, 0, 0, 0, 0, 0];
            for (let i = 0; i < 3; i++) { push({ t: 'mon', n: 'Ann', list: [row] }); F.step([]); }
            const pup = monsters.find(m => m.nid === 's9999');
            res.puppet = !!pup && !!pup.remote;
            player.facing = { x: 1, y: 0 }; N().spirit = 999; for (const k in CD) delete CD[k]; BOLTS.length = 0; sure();
            cast('bolt'); for (let i = 0; i < 60 && BOLTS.length; i++) { push({ t: 'mon', n: 'Ann', list: [row] }); F.step([]); } ROLL.sure = false;
            const hits = sent.filter(m => m.t === 'hit'); res.hit = hits.length >= 1 && hits[0].nid === 's9999' && hits[0].knock === 0 && hits[0].dmg > 0 && hits[0].dmg <= MAX_DMG;
            // 60 s of casting and raising (helpers, the ward, the Ghostlight, bolts and spikes)
            sent.length = 0; addItem('bone', 50); addItem('grave_dust', 10); addItem('soul_shard', 10);
            for (let s = 0; s < 60 * 60; s++) {
              if (s % 30 === 0) { push({ t: 'mon', n: 'Ann', list: [row] }); push({ t: 'p', n: 'Ann', map: 'over', x: player.x + 200, y: player.y, fx: 1, fy: 0, mv: false, wt: 0, hp: 20, mhp: 20, lv: 9, look: null, mech: null, dead: false, def: 100, act: null }); }
              if (s % 90 === 0) { N().spirit = 999; for (const id of ['bolt', 'ward', 'raise', 'spikes', 'light', 'siphon']) { for (const k in CD) delete CD[k]; cast(id); } }
              F.step([]);
            }
            const kinds = [...new Set(sent.map(m => m.t))].sort(); res.kinds = kinds; res.onlyPHit = kinds.every(t => t === 'p' || t === 'hit');
            const ps = sent.filter(m => m.t === 'p'); res.presences = ps.length; res.necroOn = ps.some(m => m.look && m.look.necro && m.look.necro.h);
          } catch (e) { res.threw = String(e && e.stack || e).slice(0, 300); }
          finally { HELPERS.length = 0; NET.disconnect(); NET.useFake(was.fake); NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null; if (window.COOP) COOP.reset(); }
          check(P + 'N10 the wire: a non-keeper\'s Soul Bolt on a puppet goes out as the sword\'s own `hit` (knock 0, its nid, at most 500); 60 s of casting and raising (helpers, the ward, the Ghostlight, bolts, spikes) sends nothing but presence and hits, and presence carries the helpers',
            !res.threw && res.puppet && res.hit && res.onlyPHit && res.necroOn && res.presences >= 60 * 3, res);
        }
      }
      freshState(); solo([]); wear();
      // ---- N16 HUD: the spellbook passes the per-panel audit recipe at every size, touch and mouse, Large text; the plaque fits ----
      if (typeof HK !== 'undefined' && HK.audit && HK.audit.SIZES) {
        const own = k => Object.getOwnPropertyDescriptor(window, k), kw = { w: own('innerWidth'), h: own('innerHeight'), t: window.__forceTouch };
        const problems = []; const text0 = window.SETTINGS ? SETTINGS.get('text') : null;
        setLv(99); for (const s of SPELLS) N().known[s.id] = true; wear('bone_stave');
        try {
          for (const [w, hh] of HK.audit.SIZES) for (const t of [true, false]) {
            window.innerWidth = w; window.innerHeight = hh; resize(); window.__forceTouch = t;
            for (const name of ['spells', 'altar']) for (const pg of [0, 1, 2]) {
              closePanel(); openPanel(name); PANEL_KIT.page(name, pg);
              HK.FIT.on = true; HK.FIT.log.length = 0; if (window.SETTINGS) SETTINGS.set('text', 'large');
              drawHud(HK.audit.fitCtx()); HK.FIT.on = false;
              const all = buttons.filter(b => !b.offscreen && b.w > 0), i = all.findIndex(b => b.label === '×'), mine = i >= 0 ? all.slice(i) : [];
              const where = `${name} p${pg} ${w}x${hh} ${t ? 'touch' : 'mouse'}`;
              if (i < 0) problems.push(where + ': no close seal');
              for (const b of mine) {
                if (b.x < 0 || b.y < 0 || b.x + b.w > w || b.y + b.h > hh) problems.push(where + ': off screen ' + b.label);
                if (t && (b.w < 44 || b.h < 44) && !b.inert) problems.push(where + ': small ' + b.label + ' ' + Math.round(b.w) + 'x' + Math.round(b.h));
              }
              for (let a = 0; a < mine.length; a++) for (let c = a + 1; c < mine.length; c++) { const A = mine[a], B = mine[c], gap = t ? 8 : 0;
                if (A.x < B.x + B.w + gap && B.x < A.x + A.w + gap && A.y < B.y + B.h + gap && B.y < A.y + A.h + gap && !(A.label === B.label)) { if (!(A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h) && gap === 0) continue; problems.push(where + ': ' + A.label + ' near ' + B.label); } }
              for (const p of HK.audit.fitIssues(where)) problems.push(p);
            }
          }
        } finally {
          closePanel();
          if (kw.w) Object.defineProperty(window, 'innerWidth', kw.w); if (kw.h) Object.defineProperty(window, 'innerHeight', kw.h);
          resize(); window.__forceTouch = kw.t; if (window.SETTINGS && text0) SETTINGS.set('text', text0);
        }
        check(P + 'N16 the spellbook and the Bone Altar keep the panel contract at every size, touch and mouse, Large text: on screen, 44 px on touch and 8 px apart, every string fits', problems.length === 0, { problems: problems.slice(0, 8), n: problems.length });
      }
      // ---- N17 the teacher view: a friend's necromancy is drawn from presence alone, with no update run ----
      { const R = PLAYERS.remote; R.__view = { n: '__view', map: PLAYERS.mapId(), x: player.x + 40, y: player.y, shown: { x: player.x + 40, y: player.y }, facing: { x: 1, y: 0 }, look: { necro: { c: 2, s: 'bolt', tx: 's1', gl: 1, w: 5, h: [['sq', 20, 10, 1, 9], ['bb', -30, 10, -1, 4]] } }, lastAt: nowMs(), hp: 10, mhp: 10 };
        let calls = 0; const A0 = window.NECRO_ART, spy = A0 ? Object.assign({}, A0, { helper: (...a) => { calls++; return A0.helper(...a); } }) : null;
        if (spy) window.NECRO_ART = spy;
        let threw = null; try { for (let k = 0; k < 3; k++) { time += 0.05; const items = []; for (const hk of HOOKS.draw) hk(ctx, items, cam); for (const it of items) it.draw(); } } catch (e) { threw = String(e && e.message); }
        if (A0) window.NECRO_ART = A0;
        const lights = []; try { for (const f of HOOKS.nightLights) f(lights, 0, 0, MAP_W - 1, MAP_H - 1); } catch (e) { threw = threw || String(e); }
        delete R.__view;
        check(P + 'N17 the teacher view: a knight\'s helpers, ward and Ghostlight are drawn from his presence alone (no update hook runs between the frames), his Ghostlight is a night light', !threw && calls >= 4 && lights.some(L => L.r === 150), { threw, calls, lights: lights.filter(L => L.r === 150).length }); }
      // ---- N19 icons ----
      if (window.ICONS && ICONS.audit) { const a = ICONS.audit(), mine = ['soul_shard', 'brute_bone', 'barrow_wand', 'gravewood_stave', 'cape_necromancy', 'tobias_stone', 'bramble_collar', 'little_bell', 'neds_turnip', 'kings_seal'];
        check(P + 'N19 every new item has an icon of its own: ICONS.audit() is still 0 shared and 0 missing', a.duplicates.length === 0 && a.missing.length === 0 && mine.every(id => ICONS.has(id)), { dup: a.duplicates.slice(0, 4), missing: a.missing.slice(0, 6), mine: mine.filter(id => !ICONS.has(id)) }); }
    } finally {
      ROLL.sure = false; Math.random = keep.rnd; monsters = keep.mons;
      player.equip = keep.equip; player.inv = keep.inv; for (const s of SKILL_DEFS) if (player.skills[s.key]) player.skills[s.key].xp = keep.xp[s.key];
      player.necro = JSON.parse(keep.necro); quest.necro = JSON.parse(keep.q); quest.barrow = JSON.parse(keep.barrow); quest.graves = JSON.parse(keep.graves);
      player.x = keep.x; player.y = keep.y; player.facing = keep.facing; player.hp = keep.hp; player.dayTime = keep.day; player.mech = keep.mech; player.attackCd = keep.cd;
      HELPERS.length = 0; BOLTS.length = 0; FLASHES.length = 0; WARD.left = 0; CH.walk = null; lookC = 0; lookS = null; lookT = null; for (const k in CD) delete CD[k];
      if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave();
      closePanel(); h.peace(false); notice = null;
    }
  });

  // ======================================================================================================================
  // 13. THE HANDLE
  // ======================================================================================================================
  const API = {
    CHOICES, SPELLS, SPELL, HELPER, HELPERS, BOLTS, FLASHES, WARD, CD, STATS, SUPPLIES, KIT, UNDEAD, XP, SPIRIT, MAX_DMG, GRAVE_XP,
    level: () => L(), power, spiritMax, spirit, addSpirit, refillRate, inCircle, circles, boltMax, attRoll, cast, castReady, canKnow, lockedWhy, costOf, coolLeft,
    isUndead, addUndead, fair, boltTarget, focusInHand, castFocus, fullSet, wearing, capOf, helperLoad, lifeMul, makeHelper, helpersHere, raise, ownGrave,
    ITEM_USE, itemUse: (id, fn, label) => { fn.label = label; ITEM_USE[id] = fn; },
    ROLL, seesGhost, lightsNear, remotes, readLook, lookNecro, lookKey, gates, landing, dummies, N, Q, HIT, mapNow,
    learn: id => { if (SPELL[id]) { N().known[id] = true; return true; } return false; },
    blow: () => { lastBlow = time; }, quiet: () => { lastBlow = -1e9; }, sinceBlow: () => time - lastBlow,
    endWalk: () => { CH.walk = null; }, walking: () => CH.walk, clearHelpers: () => { HELPERS.length = 0; },
    resetLook: () => { lookC = 0; lookS = null; lookT = null; },
  };
  return API;
})();
window.NECRO = NECRO;
