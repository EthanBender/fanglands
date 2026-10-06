#!/usr/bin/env node
// ============================================================================
// JIGGLE — the spread rehearsed before the real move (the Great Spread spec, §9.5; Stage 3)
// Scratch builds only, in ~/.fanglands/work/spread/jiggle/ (JIGGLE_WORK overrides); nothing here is ever committed or
// shipped, and the repo's own index.html, online/ and docs/ are only read.
//
//   1. A copy of the game with MAP 266x186 (MAP_W/MAP_H in 00-core), the Atlas at identity: the BASE. Beside it, eight
//      CONTROLS that move nothing and only re-roll the world's shared dice (1..8 draws skipped at generateWorld's start):
//      whatever changes between them and the base (a fact, a tile, a failing check) changes on the luck of the scatter,
//      not because a place moved, and is not counted against a move (it is reported as re-rolled). A move re-rolls the
//      shared dice too (each pass draws once per grass tile it walks), so without the controls every move would blame
//      the luck of the scatter on the place it moved.
//   2. Each anchor in turn moved by (+-3, +-2): `at` = its old top-left + the offset, with signs that keep its box inside
//      the map and clear of every other place box (two old boxes that overlap, OWNERS deciding those tiles, must come
//      apart too, or move as one). When no signs clear a neighbour, the neighbour joins the group and the group moves as
//      one; the smallest group wins, then the one that lands on fewer roads it does not own (ATLAS.TRACKS: canopy +3
//      sat on the jungle path, a collision no spread makes). The cave never moves (§2, §12: pinned at the origin), so a
//      sign that would push into it is refused. The pins follow by themselves (W.pin reads the ports).
//      For each moved group, against the base and the controls:
//      - the WHOLE headless suite (tools/headless.js), the two-game sim (tools/mmo-sim.js, run twice when red: it rolls
//        the world's dice) and the browser keys (tools/dom-keys.js) are green: no check fails that passes on the base and
//        on every control (names compared without their numbers), bar the Atlas's own identity tests (01-atlas: every
//        frame the identity, port('thistledown.square') is [112,33] ...), which fail in any moved build by design;
//      - TRANSPORT: every positional fact (SPAWN, SIGN_TILE, VILLAGE, CASTLE, DUMMIES, STALLS, REGIONS, BUILDINGS, NPCS,
//        MONSTER_SPAWNS by the cell their table gave them, instance doors and steps, MAP_TARGETS, every HOOKS.mapTarget
//        answer, the night lights, the boss calls and every Atlas port) of a moved place equals old + offset, and every
//        other one stays put. A region is a place's when both its corners are; a fact that moved with a place it lies
//        outside of (relative geometry: a road end at a gate, a guard ring, a PORT_REL port) is listed as relative when it
//        is within that box + guard + 12 (the strict report's reach) and is red past it;
//      - PLATE: every non-scatter tile inside the moved box equals the base tile shifted by the offset. Scatter is
//        GRASS, DIRT, TREE, OAK, ROCK, IRON, COAL, FLOWERS, MUSHROOM and BERRY_BUSH, plus the box's 3-tile dither rim.
//        Counted apart: what §2 calls WORLD inside a box (the jungle's and the Ashfields' own dressing, lava, dragon bones,
//        the river's crossing posts), tiles within 2 of a world seam that crosses the box (the river, the scarp, the
//        giants' wall, the rim, the Grey Sea's shore) and tiles the controls re-roll there.
//   3. Every anchor moved together and WORLD scaled by 1.1 (MAP 286x198; each place at its old top-left x 1.1, a group
//      of overlapping boxes at its largest member's shift): the suite, mmo-sim and dom-keys green, every place's own
//      facts transported by its shift, and the seam pins hold: the rim gate is open (the warden's post reaches the
//      Ashfields through the gate), the giants' gap is open (Hollowford's south exit reaches the jungle side) and the
//      steps meet the scarp (SCARP_STEPS stands at the port graveyard.steps, open ground above and below; a plain cliff
//      there is a scarp with no steps).
//   4. THE REAL SPREAD (--spread-only alone; --no-spread leaves it out; counted in the exit code only with --spread-gate,
//      since Stage 4a still has its own work there): every anchor at its section-2 `to`, MAP 400x280,
//      WORLD per section 3, so every place moves by its own shift (the pairs steps 2 and 3 move as one, thistledown and
//      hollowford, camp, dock and gull_isle, warden and stone_circle, far_shore and redcut, come apart). Against a base
//      at 400x280 with nothing moved and two controls: the suites, every place's facts by its own shift, each place's
//      plate, and the same seam pins.
// A red result names a literal the conversion missed or framed wrongly: fix it in the source, prove the fix at identity
// (the fingerprint), and run the jiggle again.
//
//   node tools/jiggle.mjs [--only=pond,camp] [--jobs=3] [--no-suites] [--no-dom] [--anchors-only | --world-only | --spread-only] [--no-spread] [--spread-gate] [--plan]
//   node tools/jiggle.mjs --selfcheck                         the scratch builder makes the repo's index.html byte for byte
//   node tools/jiggle.mjs --facts <index.html> <out.json>     (internal: one build's positional facts, as JSON)
// Writes WORK/report.json and prints the per-anchor table. Exit 1 on any red.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { atlasTables, anchorOf } from './literals.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);
const WORK = process.env.JIGGLE_WORK || path.join(os.homedir(), '.fanglands', 'work', 'spread', 'jiggle');
const argv = process.argv.slice(2);
const flag = k => argv.includes(k), opt = (k, d) => { const a = argv.find(x => x.startsWith(k + '=')); return a ? a.slice(k.length + 1) : d; };
const TILE = 48, BASE_W = 266, BASE_H = 186, SCALE = 1.1, CONTROL_SUITES = 8;
const SCATTER = ['GRASS', 'DIRT', 'TREE', 'OAK', 'ROCK', 'IRON', 'COAL', 'FLOWERS', 'MUSHROOM', 'BERRY_BUSH'];
// what §2 calls WORLD inside a place's box: the grounds' own dressing (the jungle's trees and ferns, JR's scatter that
// "re-rolls"; the Ashfields' ash, scorch, cinders and dry grass; the Grub Fields' scrub, §1's ':' ground, round the Redcut),
// lava pools, dragon bones and the river's crossing posts. Counted apart from the plate, like the scatter.
const WORLD_KINDS = ['JUNGLE', 'FERN', 'ASH', 'ASHES', 'SCORCH', 'CINDERS', 'SINGED', 'DRYGRASS', 'DEADSNAG', 'DRYSCRUB', 'DRYBUSH', 'LAVA', 'DRAGONBONES', 'RIVER_POST'], WORLD_KIND_RE = /^AF_/;
const RIM = 3;

// ---------- one build's positional facts (run in a child: each boot is a whole game) ----------
if (flag('--facts')) {
  const i = argv.indexOf('--facts'), html = argv[i + 1], out = argv[i + 2];
  const { fingerprint, boot } = await import('./fingerprint.mjs');
  const fp = fingerprint(html), t = fp.tables;
  const g = boot(html);
  const extra = JSON.parse(vm.runInContext(`(() => { newGame(); const P = {}; for (const id in ATLAS.PORTS) { if (ATLAS.PORTS[id][0] === 'new') continue; P[id] = ATLAS.port(id); }
    const S = window.WORLDSHAPE && WORLDSHAPE.seams, seam = f => S && S[f] ? Array.from({ length: MAP_W }, (_, x) => S[f](x)) : null;
    const gs = REGIONS.find(r => r.name === 'The Grey Sea'), seaX = gs ? Array.from({ length: MAP_H }, (_, y) => Math.round(ATLAS.world.pin('sea', gs.x0, y))) : null;
    return JSON.stringify({ T: Object.assign({}, T), ports: P, problems: ATLAS.frameProblems(), W: MAP_W, H: MAP_H, river: ATLAS.track('river'),
      seams: { sGW: seam('sGW'), sWJ: seam('sWJ'), footWA: seam('footWA'), seaX } }); })()`, g));
  const keep = ['map', 'core', 'regions', 'buildings', 'npcs', 'spawns', 'instances', 'map_targets', 'map_hooks', 'night_lights', 'boss_calls'];
  const facts = Object.assign({ strict: fp.strict }, extra); for (const k of keep) facts[k] = t[k];
  fs.writeFileSync(out, JSON.stringify(facts));
  process.exit(0);
}

// ---------- the anchors and the moves ----------
const AT = atlasTables();
const PLACES = Object.keys(AT.ANCHORS).filter(id => AT.ANCHORS[id].kind === 'place');
const boxOf = id => AT.ANCHORS[id].box;
const meet = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const NESTED = (AT.NESTED || []).map(p => p.slice().sort().join('|'));
const overlapping = (i, j) => meet(boxOf(i), boxOf(j)) && !NESTED.includes([i, j].sort().join('|'));
function component(id, ids = PLACES) {
  const seen = new Set([id]), q = [id];
  while (q.length) { const c = q.shift(); for (const o of ids) if (!seen.has(o) && overlapping(c, o)) { seen.add(o); q.push(o); } }
  return [...seen];
}
const shifted = (b, dx, dy) => [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy];
const inside = (b, W, H) => b[0] >= 0 && b[1] >= 0 && b[2] <= W - 1 && b[3] <= H - 1;
const SIGNS = [[3, 2], [3, -2], [-3, 2], [-3, -2]];
// the roads between places (ATLAS.TRACKS, read from the built game at identity: old coordinates): a moved box should not
// land on a road that is not its own (a track with no point in the group), or the jiggle reports the collision of two
// places' rigid shapes with the open land's road, which no spread would make (canopy +3 sat on the jungle path)
let TRACK_TILES = null;
async function trackTiles() {
  if (TRACK_TILES) return TRACK_TILES;
  const { boot } = await import('./fingerprint.mjs'), g = boot(path.join(ROOT, 'index.html'));
  const T = JSON.parse(vm.runInContext('JSON.stringify(Object.keys(ATLAS.TRACKS).map(id => [id, ATLAS.track(id), ATLAS.TRACKS[id].map(q => q[0] === "port" ? ATLAS.PORTS[q[1]][0] : q[0])]))', g));
  TRACK_TILES = T.filter(([id]) => id !== 'nodes').map(([id, pts, owners]) => { const tiles = new Set();   // (TRACKS.nodes is a list of places, not a road)
    for (let i = 0; i + 1 < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
      for (let k = 0; k <= n; k++) { const x = Math.round(ax + (bx - ax) * k / n), y = Math.round(ay + (by - ay) * k / n); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles.add((x + dx) + ',' + (y + dy)); } }
    return { id, tiles, owners: new Set(owners) }; });
  return TRACK_TILES;
}
function plan(lead, tracks) {
  // for each signs, grow the group by its blockers until it is clear (or cannot be); the smallest group wins, since a
  // place moved alone shows its own literals and a group hides a literal framed in one member's place but owned by
  // another; between groups of one size, the one that lands on fewer roads not its own
  let best = null;
  const inBox = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
  for (const [dx, dy] of SIGNS) {
    const group = [lead];
    for (let round = 0; round < 12; round++) {
      const moved = group.map(id => shifted(boxOf(id), dx, dy));
      if (!moved.every(b => inside(b, BASE_W, BASE_H)) || group.includes('cave')) { group.length = 0; break; }   // the cave is pinned at the origin
      const blockers = PLACES.filter(o => !group.includes(o) && moved.some(b => meet(b, boxOf(o))) && !group.some(id => NESTED.includes([id, o].sort().join('|'))));
      if (!blockers.length) break;
      group.push(...blockers);
    }
    if (!group.length) continue;
    let roads = 0;
    for (const t of tracks || []) { if (group.some(id => t.owners.has(id))) continue;
      for (const k of t.tiles) { const [x, y] = k.split(',').map(Number); if (group.some(id => inBox(shifted(boxOf(id), dx, dy), x, y) && !inBox(boxOf(id), x, y))) { roads++; break; } } }
    const c = { group: group.slice().sort(), dx, dy, roads };
    if (!best || c.group.length < best.group.length || (c.group.length === best.group.length && c.roads < best.roads)) best = c;
  }
  return best || { group: [lead], error: 'no signs keep it inside the map and clear of the cave' };
}

// ---------- scratch builds ----------
// the game's source, read once when the run starts: every scratch build of a run is made from the same text, so the
// source may be edited (a fix in progress) while a run goes on
let SRC_SNAP = null;
const snap = () => { if (!SRC_SNAP) { SRC_SNAP = {}; for (const f of fs.readdirSync(path.join(ROOT, 'src'))) SRC_SNAP[f] = fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'); } return SRC_SNAP; };
function build(name, { W, H, at, world, reroll }) {
  const dir = path.join(WORK, name), src = path.join(dir, 'src');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(src, { recursive: true });
  const SN = snap(), files = Object.keys(SN).filter(f => /^[0-9].*\.js$/.test(f)).sort();
  let script = '';
  for (const f of files) {
    let s = SN[f];
    if (f === '00-core.js' && !(W === 260 && H === 180)) {
      const want = 'const MAP_W = 260, MAP_H = 180;'; if (!s.includes(want)) throw new Error('jiggle: 00-core no longer says ' + want);
      s = s.replace(want, `const MAP_W = ${W}, MAP_H = ${H};   // JIGGLE scratch build`);
    }
    if (f === '02-world.js' && reroll) {   // a control: nothing moved, the world's shared dice moved on by `reroll` draws
      const want = 'const rnd = mulberry32(WORLD_SEED);'; if (!s.includes(want)) throw new Error('jiggle: 02-world no longer says ' + want);
      s = s.replace(want, `const rnd = (r => { for (let k = 0; k < ${reroll}; k++) r(); return r; })(mulberry32(WORLD_SEED));   // JIGGLE control: the dice re-rolled`);
    }
    if (f === '01-atlas.js' && (Object.keys(at || {}).length || world)) {
      const anchorLoop = "    else Object.assign(a, { box: null, kind: 'reserved', guard: GUARD });\n  }\n";
      if (!s.includes(anchorLoop)) throw new Error('jiggle: 01-atlas no longer sets the anchors as expected');
      s = s.replace(anchorLoop, anchorLoop + `  // JIGGLE scratch build: anchors moved\n  { const J = ${JSON.stringify(at || {})}; for (const id in J) ANCHORS[id].at = J[id]; }\n`);
      if (world) {
        const wl = "  const WORLD = { xs: [[0, 0], [MAP_W - 1, MAP_W - 1]], ys: [[0, 0], [MAP_H - 1, MAP_H - 1]] };";
        if (!s.includes(wl)) throw new Error('jiggle: 01-atlas no longer declares WORLD as expected');
        s = s.replace(wl, `  const WORLD = ${JSON.stringify(world)};   // JIGGLE scratch build: the stretched world`);
      }
    }
    fs.writeFileSync(path.join(src, f), s);
    script += `// ---- src/${f} ----\n${s}\n`;
  }
  const page = SN['page.html'].split('\n'), cut = page.findIndex(l => l.includes('<!-- SCRIPTS -->'));
  const html = page.slice(0, cut).join('\n') + '\n<script>\n' + script + '</script>\n' + page.slice(cut + 1).join('\n');
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.mkdirSync(path.join(dir, 'tools'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'tools', 'mmo-sim.js'), path.join(dir, 'tools', 'mmo-sim.js'));   // it reads ../index.html
  return dir;
}
function run(cmd, args, log) {
  return new Promise(res => {
    const p = spawn(cmd, args, { cwd: ROOT, env: process.env });
    let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
    p.on('close', code => { if (log) fs.writeFileSync(log, out); res({ code, out }); });
  });
}
const failsOf = out => out.split('\n').filter(l => /^\s{2}\S.*: FAIL/.test(l)).map(l => l.trim().replace(/: FAIL.*$/, ''));
async function suites(dir, only = { mmo: true, dom: true }) {
  if (flag('--no-suites')) return null;
  const r = {};
  const h = await run('node', [path.join(ROOT, 'tools', 'headless.js'), path.join(dir, 'index.html')], path.join(dir, 'headless.log'));
  const sum = /run 1: (.*?) \(/.exec(h.out); r.headless = { summary: sum ? sum[1] : 'did not finish', fails: failsOf(h.out), strict: (/strict report: .*/.exec(h.out) || [''])[0], code: h.code };
  if (!only.mmo) { r.mmo = { summary: 'not run', fails: [], code: 0 }; return r; }
  // mmo-sim rolls the world's own dice (a drop party's prizes, a sapper's bombs): a red run is run once more
  let m = await run('node', [path.join(dir, 'tools', 'mmo-sim.js')], path.join(dir, 'mmo-sim.log')), retried = false;
  if (m.code !== 0) { retried = true; m = await run('node', [path.join(dir, 'tools', 'mmo-sim.js')], path.join(dir, 'mmo-sim-2.log')); }
  r.mmo = { summary: (m.out.match(/^(ALL .*|\d+ FAILED.*)$/m) || ['did not finish'])[0], fails: m.out.split('\n').filter(l => /^FAIL/.test(l)).map(l => l.slice(0, 200)), code: m.code, retried };
  if (!flag('--no-dom') && only.dom) {
    const d = await run('node', [path.join(ROOT, 'tools', 'dom-keys.js'), path.join(dir, 'index.html')], path.join(dir, 'dom-keys.log'));
    r.dom = { summary: (d.out.match(/^dom-keys: .*$/m) || ['did not finish'])[0], fails: d.out.split('\n').filter(l => /^FAIL/.test(l)).map(l => l.slice(0, 200)), code: d.code };
  }
  return r;
}
async function facts(dir) {
  const out = path.join(dir, 'facts.json');
  const r = await run('node', [SELF, '--facts', path.join(dir, 'index.html'), out], path.join(dir, 'facts.log'));
  if (r.code !== 0) throw new Error('jiggle: facts failed for ' + dir + ':\n' + r.out.slice(-2000));
  return JSON.parse(fs.readFileSync(out, 'utf8'));
}

// ---------- the positional facts as [key, x, y, unit] ----------
function points(f) {
  const out = [], P = (k, x, y, u = 't') => { if (typeof x === 'number' && typeof y === 'number') out.push([k, x, y, u]); };
  const c = f.core;
  P('SPAWN', c.SPAWN[0], c.SPAWN[1], 'px'); P('SWORD_POS', c.SWORD_POS[0], c.SWORD_POS[1], 'px'); P('VILLAGE_SPAWN', c.VILLAGE_SPAWN[0], c.VILLAGE_SPAWN[1], 'px');
  P('SIGN_TILE', c.SIGN_TILE[0], c.SIGN_TILE[1]); P('VILLAGE.0', c.VILLAGE[0], c.VILLAGE[1]); P('VILLAGE.1', c.VILLAGE[2], c.VILLAGE[3]); P('CASTLE', c.CASTLE[0], c.CASTLE[1]);
  c.DUMMIES.forEach((d, i) => P('DUMMIES.' + i, d[0], d[1])); c.STALLS.forEach(s => P('STALLS.' + s[2], s[0], s[1]));
  // a region is a place's when both its corners are that place's; a rect over open land (Wolfwood, the Goblin Fields:
  // corners in two places or in none) is the stretched world's and is not a place's fact
  const rn = {}; for (const r of f.regions) { const k = r[0] + '#' + (rn[r[0]] = (rn[r[0]] || 0) + 1); P('REGION ' + k + '.0', r[2], r[3], 'r'); P('REGION ' + k + '.1', r[4], r[5], 'r'); }
  for (const b of f.buildings) P('BUILDING ' + b[0], b[1], b[2]);
  for (const n of f.npcs) P('NPC ' + n[0], n[1], n[2]);
  // a spawn by the cell its table gave it (movedFrom), not the dry or open cell the generator nudged it to
  const sn = {}; for (const s of f.spawns) { const o = s[4] || [s[1], s[2]]; P('SPAWN ' + s[0] + '#' + (sn[s[0]] = (sn[s[0]] || 0) + 1), o[0], o[1]); }
  for (const [id, door, step] of f.instances) { if (door) P('INSTANCE ' + id + '.door', door[0], door[1]); if (step) P('INSTANCE ' + id + '.step', step[0], step[1]); }
  for (const t of f.map_targets) if (t[1] !== null) P('MAP_TARGETS[' + t[0] + ']', t[1], t[2]);
  for (const h of f.map_hooks) { const t = h[h.length - 1]; if (Array.isArray(t) && (t[4] === null || t[4] === 'over')) P('mapTarget ' + h.slice(0, -1).join('/'), t[0], t[1]); }
  for (const [k, list] of f.night_lights) if (Array.isArray(list)) list.forEach((L, i) => P('nightLight ' + k + '.' + i, L[0], L[1], 'px'));
  for (const [k, map, near] of f.boss_calls) if (near && (map === 'over' || !map)) P('bossCall ' + k, near[0], near[1]);
  for (const id in f.ports) P('port ' + id, f.ports[id][0], f.ports[id][1]);
  return out;
}
// the place a base point belongs to (the old map's rule, OWNERS and ports deciding overlaps), in tiles
const tileOf = (x, y, u) => u === 'px' ? [Math.floor(x / TILE), Math.floor(y / TILE)] : [Math.floor(x), Math.floor(y)];
function transport(base, vari, moves, noise = new Set(), world = false) {
  const B = new Map(points(base).map(p => [p[0], p])), V = new Map(points(vari).map(p => [p[0], p]));
  const res = { checked: 0, moved: 0, kept: 0, relative: [], red: [], reroll: 0, world: 0 };
  // a region's corners: a place's only when both lie in it
  const regionOwner = k => { const a = B.get(k.replace(/\.[01]$/, '.0')), b = B.get(k.replace(/\.[01]$/, '.1')); if (!a || !b) return null; const ia = anchorOf(AT, a[1], a[2]).id, ib = anchorOf(AT, b[1], b[2]).id; return ia === ib ? ia : 'world'; };
  const reach = (id, tx, ty) => { const b = boxOf(id), m = 3 + 12; return tx >= b[0] - m && tx <= b[2] + m && ty >= b[1] - m && ty <= b[3] + m; };
  for (const [k, p] of B) {
    const q = V.get(k); if (!q) { if (noise.has(k)) { res.reroll++; continue; } res.red.push(`${k}: gone (was ${p[1]},${p[2]})`); continue; }
    if (noise.has(k)) { res.reroll++; continue; }   // it moves when only the dice are re-rolled: a random spot, not a literal
    res.checked++;
    const [tx, ty] = tileOf(p[1], p[2], p[3]), s = p[3] === 'px' ? TILE : 1;
    const a = p[3] === 'r' ? { id: regionOwner(k), overlap: false } : anchorOf(AT, tx, ty), own = a.id !== 'world' && moves[a.id] ? moves[a.id] : [0, 0];
    if (p[3] === 'r' && a.id === 'world' && world) { res.world++; continue; }
    // a world region's edge that is a pinned seam (the Ashfields' top on the rim, its east edge on the jungle wall) moves
    // with the place its pin goes through, one axis at a time: relative, by declaration of the pin
    if (p[3] === 'r' && a.id === 'world') { const qx = (q[1] - p[1]), qy = (q[2] - p[2]);
      const pin = Object.keys(moves).find(id => (qx === 0 || qx === moves[id][0]) && (qy === 0 || qy === moves[id][1]) && (qx || qy));
      if (pin) { res.relative.push(`${k}: ${p[1]},${p[2]} (a world region's pinned edge) moved with ${pin} by ${qx},${qy}`); continue; } }
    const ddx = (q[1] - p[1]) / s, ddy = (q[2] - p[2]) / s;
    if (ddx === own[0] && ddy === own[1]) { if (own[0] || own[1]) res.moved++; else res.kept++; continue; }
    const rel = k.startsWith('port ') && AT.PORT_REL[k.slice(5)] ? AT.PORTS[k.slice(5)][0] : null;   // a port outside its box on purpose (01-atlas PORT_REL)
    const by = Object.keys(moves).filter(id => moves[id][0] === ddx && moves[id][1] === ddy && (ddx || ddy)).find(id => id === rel || reach(id, tx, ty));
    if (by) { res.relative.push(`${k}: ${p[1]},${p[2]} (${a.id}${a.overlap ? ', undecided overlap' : ''}) moved with ${by}`); continue; }
    res.red.push(`${k}: ${p[1]},${p[2]} belongs to ${a.id}${a.overlap ? ' (undecided overlap)' : ''}, expected ${own[0] ? '+' + own[0] : own[0]},${own[1] ? '+' + own[1] : own[1]}, moved ${ddx},${ddy} -> ${q[1]},${q[2]}`);
  }
  for (const k of V.keys()) if (!B.has(k) && !noise.has(k)) res.red.push(`${k}: new in the moved build (${V.get(k)[1]},${V.get(k)[2]})`);
  return res;
}
// every non-scatter tile inside a moved box equals the base tile, shifted. Left out, and counted: a tile the re-rolled
// dice change on their own (the controls), and a tile within 2 of a world seam that crosses the box (the river, the
// Goblin Fields / Wolfwood scarp, the Wolfwood / Jungle wall, the Ashfields' rim, the Grey Sea's shore), in the base or in the moved build:
// the stretched land's, which does not move with a place (§2), apart from what its pins carry
const nearSeam = (f, x, y) => {
  const S = f.seams || {};
  for (const k of ['sGW', 'sWJ', 'footWA']) { const a = S[k]; if (a && a[x] !== undefined && Math.abs(y - a[x]) <= 2.5) return k; }
  if (S.seaX && S.seaX[y] !== undefined && Math.abs(x - S.seaX[y]) <= 2.5) return 'sea';   // the Grey Sea's straight shore, on the sea pin
  const R = f.river || [];
  for (let i = 0; i < R.length - 1; i++) {
    const [ax, ay] = R[i], [bx, by] = R[i + 1], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
    if (Math.hypot(x - ax - t * dx, y - ay - t * dy) <= 3.5) return 'river';
  }
  return null;
};
function plate(base, vari, ids, dx, dy, noiseTiles = new Set(), noiseKinds = {}) {
  const T = base.T, name = {}; for (const n in T) name[T[n]] = n;
  const scatter = new Set(SCATTER.filter(n => n in T).map(n => T[n])), worldKinds = new Set(Object.keys(T).filter(n => WORLD_KINDS.includes(n) || WORLD_KIND_RE.test(n)).map(n => T[n]));
  const W = base.W, out = { checked: 0, bad: 0, first: [], byPair: {}, reroll: 0, seams: {}, seamSame: 0, world: 0 };   // seamSame: the seam tiles left out that match anyway
  for (const id of ids) {
    const b = boxOf(id);
    for (let y = b[1] + RIM; y <= b[3] - RIM; y++) for (let x = b[0] + RIM; x <= b[2] - RIM; x++) {
      const bt = base.map[y * W + x]; if (scatter.has(bt)) continue;
      if (worldKinds.has(bt)) { out.world++; continue; }
      if (noiseTiles.has(y * W + x)) { out.reroll++; continue; }
      const sm = nearSeam(base, x, y) || nearSeam(vari, x + dx, y + dy); if (sm) { out.seams[sm] = (out.seams[sm] || 0) + 1; if (vari.map[(y + dy) * W + (x + dx)] === bt) out.seamSame++; continue; }
      out.checked++;
      const vt = vari.map[(y + dy) * W + (x + dx)];
      if (vt === bt) continue;
      if (noiseKinds[id] && noiseKinds[id].has(bt) && noiseKinds[id].has(vt)) { out.checked--; out.reroll++; continue; }
      out.bad++; const pair = `${id}: ${name[bt]} -> ${name[vt]}`; out.byPair[pair] = (out.byPair[pair] || 0) + 1;
      if (out.first.length < 12) out.first.push(`${id} ${x},${y}: ${name[bt]} -> ${name[vt]}`);
    }
  }
  return out;
}

// ---------- the seam pins, read on the x1.1 world's map ----------
function pins(f) {
  const T = f.T, W = f.W, H = f.H, map = f.map, SOLID_OK = new Set(['WARDEN_GATE', 'LAIR_GATE', 'GATE', 'CRYPT_BARS'].filter(n => n in T).map(n => T[n]));
  const SOLIDS = new Set(f.solid || []);
  // walkable: not a known solid (the facts carry SOLID's ids); a story gate counts as open
  const walk = t => !SOLIDS.has(t) || SOLID_OK.has(t);
  const bfs = (from, to, max) => {
    const seen = new Int32Array(W * H).fill(-1), q = [from[1] * W + from[0]]; seen[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % W, y = (c / W) | 0; if (x === to[0] && y === to[1]) return seen[c]; if (seen[c] >= max) continue;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ax, ny = y + ay; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx; if (seen[n] >= 0 || !walk(map[n])) continue; seen[n] = seen[c] + 1; q.push(n); } }
    return -1;
  };
  const P = id => f.ports[id];
  const post = P('warden.post'), gate = P('warden.gate'), south = P('hollowford.south'), steps = P('graveyard.steps');
  const r = {};
  // the rim gate: from the warden's post, through the gate, to the Ashfields two rows south of it
  r.rim_gate = { from: post, to: [gate[0], gate[1] + 2], steps: bfs(post, [gate[0], gate[1] + 2], 12) };
  // the giants' gap: from three rows north of Hollowford's south exit, through it, to four rows south (the jungle side)
  r.giants_gap = { from: [south[0], south[1] - 3], to: [south[0], south[1] + 4], steps: bfs([south[0], south[1] - 3], [south[0], south[1] + 4], 24) };
  // the steps meet the scarp: the Agility steps (SCARP_STEPS, 92-worldshape) stand AT the port graveyard.steps, with
  // walkable ground above (the Goblin Fields) and below (the Wolfwood); a plain CLIFF there is a scarp with no steps
  const st = map[steps[1] * W + steps[0]];
  const up = [steps[0], steps[1] - 1], down = [steps[0], steps[1] + 1];
  const open = p => p[0] >= 0 && p[1] >= 0 && p[0] < W && p[1] < H && walk(map[p[1] * W + p[0]]);
  const everywhere = []; if ('SCARP_STEPS' in T) map.forEach((t, i) => { if (t === T.SCARP_STEPS) everywhere.push([i % W, (i / W) | 0]); });
  r.steps_scarp = { at: steps, tile: Object.keys(T).find(n => T[n] === st), climb: 'SCARP_STEPS' in T && st === T.SCARP_STEPS, above: open(up), below: open(down), stepsOnMap: everywhere };
  r.ok = r.rim_gate.steps >= 0 && r.giants_gap.steps >= 0 && r.steps_scarp.climb && r.steps_scarp.above && r.steps_scarp.below;
  return r;
}

// ---------- the run ----------
// files a peer branch holds (docs/spread/held.json) are not converted yet: a move of a place they name fails them, and
// that is theirs to fix after the merge, so their failures are listed as held, not red (75-coop's checks are 'coop ...';
// every mmo-sim line is tools/mmo-sim.js's)
const HELD = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'spread', 'held.json'), 'utf8')).map(h => h.file); } catch (e) { return []; } })();
const HELD_CHECKS = HELD.includes('75-coop.js') ? [/^coop[ :]/] : [];
const MMO_HELD = HELD.includes('tools/mmo-sim.js');
// in the x1.1 world only: checks whose numbers grow with the map's area, which spec §12 re-baselines in Stage 4b (each
// with its one-line reason), are listed as area-proportional, not red
const AREA = [[/^dragons: The Ashfields region fills the south-west/, 'ash between 900 and 2200 tiles: the Ashfields are 1.21x the tiles at x1.1'],
  [/^kingdom: K22 the ground is cached/, "the chunk cache's bound (40) against a cap the map's size sets (48 at 286x198)"]];
// the one check that asserts the identity itself fails in every moved build, by design
// (the Atlas's own identity tests in 01-atlas: every frame and pin the identity, port('thistledown.square') is [112,33],
// a frame's shapes at identity, the river's first point at x 44)
const MOVED_EXPECTED = [/^atlas frames: Stage 0: every frame, the world and every seam pin are the identity/, /^atlas frames: a frame answers in every shape/,
  /^atlas frames: port, box, guards, anchorOf/, /^atlas frames: TRACKS hold today's values/];
const norm = n => n.replace(/\d+(\.\d+)?/g, '#');   // a check's name may carry a coordinate ("walkable from 206,30"): compared without its numbers
// a check is red in a moved build when it fails there and passes on the base AND on every control (the controls move
// nothing and re-roll the world's shared dice: what fails there fails on the luck of the scatter, not on a literal)
const green = (s, bases) => {
  if (!s) return { ok: true, note: 'suites not run' };
  const all = bases.filter(Boolean), cut = l => l.slice(0, 80);
  const known = new Set(all.flatMap(b => b.headless.fails.map(norm))), knownMmo = new Set(all.flatMap(b => b.mmo.fails.map(cut))), knownDom = new Set(all.flatMap(b => b.dom ? b.dom.fails.map(cut) : []));
  const fresh = s.headless.fails.filter(n => !known.has(norm(n)) && !MOVED_EXPECTED.some(r => r.test(n)));
  const mmoFresh = s.mmo.fails.filter(l => !knownMmo.has(cut(l))), domNew = s.dom ? s.dom.fails.filter(l => !knownDom.has(cut(l))) : [];
  const newFails = fresh.filter(n => !HELD_CHECKS.some(r => r.test(n))), mmoNew = MMO_HELD ? [] : mmoFresh;
  const held = [...fresh.filter(n => HELD_CHECKS.some(r => r.test(n))), ...(MMO_HELD ? mmoFresh.map(l => 'mmo-sim: ' + l) : [])];
  const rerolled = s.headless.fails.filter(n => known.has(norm(n)));
  const strictBad = !/, 0 not in/.test(s.headless.strict);
  return { ok: !newFails.length && !mmoNew.length && !domNew.length && !strictBad && /^(ALL|\d+ FAILED)/.test(s.headless.summary), newFails, mmoNew, domNew, strictBad, rerolled, held };
};
async function pool(items, jobs, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: jobs }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; }

const t0 = Date.now(), jobs = +opt('--jobs', 3);
fs.mkdirSync(WORK, { recursive: true });
// --selfcheck: the scratch builder, at 260x180 with nothing moved, makes the repo's own index.html byte for byte
if (flag('--selfcheck')) {
  const d = build('selfcheck', { W: 260, H: 180, at: {} }), same = fs.readFileSync(path.join(d, 'index.html'), 'utf8') === fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  console.log(`jiggle --selfcheck: the scratch builder ${same ? 'makes' : 'does NOT make'} the repo's index.html byte for byte (run ./build.sh first)`); process.exit(same ? 0 : 1);
}
const report = { made: new Date().toISOString(), map: [BASE_W, BASE_H], scatter: SCATTER, rim: RIM, base: null, variants: [], world: null, spread: null };
const RUN_SPREAD = flag('--spread-only') || (!flag('--anchors-only') && !flag('--world-only') && !flag('--no-spread') && !opt('--only', null));
// each anchor in turn (one build per distinct moved group)
const only = opt('--only', null), leads = PLACES.filter(id => id !== 'cave' && (!only || only.split(',').includes(id)));
const variants = [];
const TRACKS_OLD = await trackTiles();
for (const id of leads) {
  const p = plan(id, TRACKS_OLD); p.leads = [id];
  const same = variants.find(v => v.group.join() === p.group.join() && v.dx === p.dx && v.dy === p.dy);
  if (same) same.leads.push(id); else variants.push(p);
}
if (flag('--plan')) { for (const v of variants) console.log(`${v.leads.join(', ')}: ${v.error ? 'RED: ' + v.error : `${v.group.join('+')} by ${v.dx},${v.dy}${v.roads ? ' (on ' + v.roads + ' road' + (v.roads > 1 ? 's' : '') + ' not its own)' : ''}`}`); process.exit(0); }
console.log(`jiggle: scratch builds in ${WORK}`);
// the base is made again only when the game's source changed (its facts and suite results are kept beside it)
const srcHash = crypto.createHash('sha256').update(Object.keys(snap()).sort().map(f => f + snap()[f]).join('\0') + (flag('--no-suites') ? 'ns' : '') + (flag('--no-dom') ? 'nd' : '')).digest('hex').slice(0, 16);
const baseCache = path.join(WORK, 'base', 'base-cache.json');
let baseDir = path.join(WORK, 'base'), baseFacts, baseSuites, controls;
const cached = fs.existsSync(baseCache) ? JSON.parse(fs.readFileSync(baseCache, 'utf8')) : null;
if (flag('--spread-only')) controls = [];   // the real spread alone: its own 400x280 base, below
else if (cached && cached.srcHash === srcHash && Array.isArray(cached.controls)) ({ baseFacts, baseSuites, controls } = cached);
else {
  // the base, and eight controls that move nothing and re-roll the world's shared dice (1..8 draws skipped): the first
  // four run the suites too, the rest give facts and tiles only
  const made = await pool([0, 1, 2, 3, 4, 5, 6, 7, 8], jobs, async k => {
    const dir = build(k ? 'control-' + k : 'base', { W: BASE_W, H: BASE_H, at: {}, reroll: k });
    const f = await facts(dir); return { f, s: k <= CONTROL_SUITES ? await suites(dir) : null };
  });
  baseFacts = made[0].f; baseSuites = made[0].s;
  controls = made.slice(1).map(m => ({ facts: m.f, suites: m.s }));
  // the walkable test needs SOLID: read it once from a base boot
  { const { boot } = await import('./fingerprint.mjs'); const g = boot(path.join(WORK, 'base', 'index.html')); baseFacts.solid = JSON.parse(vm.runInContext('JSON.stringify([...SOLID])', g)); }
  fs.writeFileSync(baseCache, JSON.stringify({ srcHash, baseFacts, baseSuites, controls }));
}
// what the re-rolled dice move on their own: facts, tiles and checks
function noiseOf(baseFacts, controls) {
  const N = { facts: new Set(), tiles: new Set(), kinds: {} };
  const B = new Map(points(baseFacts).map(p => [p[0], p.slice(1, 3).join()]));
  for (const c of controls) {
    const C = new Map(points(c.facts).map(p => [p[0], p.slice(1, 3).join()]));
    for (const k of new Set([...B.keys(), ...C.keys()])) if (B.get(k) !== C.get(k)) N.facts.add(k);
    c.facts.map.forEach((t, i) => { if (t !== baseFacts.map[i]) N.tiles.add(i); });
  }
  // and, per place, the tile kinds the re-rolled dice change inside its box (its own random dressing from the shared dice:
  // the lair's bones, Hollowford's rubble, the ash's mottling): a move re-rolls them too, so they are not the plate's
  for (const id of PLACES) { const b = boxOf(id), k = N.kinds[id] = new Set();
    for (let y = b[1]; y <= b[3]; y++) for (let x = b[0]; x <= b[2]; x++) { const i = y * baseFacts.W + x; if (!N.tiles.has(i)) continue; k.add(baseFacts.map[i]); for (const c of controls) k.add(c.facts.map[i]); } }
  return N;
}
const NOISE = baseFacts ? noiseOf(baseFacts, controls) : null;
const BASES = [baseSuites, ...controls.map(c => c.suites).filter(Boolean)];
if (baseFacts) {
report.base = { problems: baseFacts.problems, strict: baseFacts.strict.length, suites: baseSuites, controls: controls.map(c => c.suites), noise: { facts: NOISE.facts.size, tiles: NOISE.tiles.size } };
console.log(`base ${BASE_W}x${BASE_H}: ${baseSuites ? `headless ${baseSuites.headless.summary}${baseSuites.headless.fails.length ? ' (fails: ' + baseSuites.headless.fails.join(' | ').slice(0, 400) + ')' : ''}; mmo-sim ${baseSuites.mmo.summary}${baseSuites.dom ? '; dom-keys ' + baseSuites.dom.summary : ''}` : 'suites not run'}; atlas problems ${baseFacts.problems.length}`);
for (const [k, c] of controls.entries()) if (c.suites) console.log(`control ${k + 1} (the dice re-rolled by ${k + 1}): ${c.suites ? `headless ${c.suites.headless.summary}, mmo-sim ${c.suites.mmo.summary}${c.suites.dom ? ', dom-keys ' + c.suites.dom.summary.replace('dom-keys: ', '') : ''}` : 'suites not run'}`);
console.log(`noise: ${NOISE.facts.size} facts and ${NOISE.tiles.size} tiles move when only the dice are re-rolled (not counted against a move)`);
}

if (!flag('--world-only') && !flag('--spread-only')) {
  report.variants = await pool(variants, jobs, async v => {
    const name = 'move-' + v.group.join('+');
    if (v.error) { console.log(`${v.leads.join(', ')}: RED: ${v.error}`); return Object.assign({ name, ok: false }, v); }
    const at = {}; for (const id of v.group) { const b = boxOf(id); at[id] = [b[0] + v.dx, b[1] + v.dy]; }
    const dir = build(name, { W: BASE_W, H: BASE_H, at });
    const f = await facts(dir);
    const moves = {}; for (const id of v.group) moves[id] = [v.dx, v.dy];
    const tr = transport(baseFacts, f, moves, NOISE.facts), pl = plate(baseFacts, f, v.group, v.dx, v.dy, NOISE.tiles, NOISE.kinds);
    const s = await suites(dir), gr = green(s, BASES);
    // A check that fails here and nowhere on the base or a control may still fail on the luck of the move's own dice
    // (moving a place moves the shared dice on by another amount). The same move is built three times more with the
    // dice re-rolled (1, 2, 3 draws skipped); a failure that does not come back in at least two of them is luck, listed
    // as such, and only one that holds over the dice is red.
    if (s && !gr.ok && (gr.newFails.length || gr.mmoNew.length || gr.domNew.length)) {
      const re = [];
      for (const k of [1, 2, 3]) { const d = build(name + '-r' + k, { W: BASE_W, H: BASE_H, at, reroll: k }); re.push(await suites(d, { mmo: gr.mmoNew.length > 0, dom: gr.domNew.length > 0 })); }
      const held = (list, pick) => list.filter(n => re.filter(r => pick(r).some(x => norm(x).slice(0, 80) === norm(n).slice(0, 80))).length >= 2);
      const luck = [...gr.newFails, ...gr.mmoNew, ...gr.domNew];
      gr.newFails = held(gr.newFails, r => r.headless.fails); gr.mmoNew = held(gr.mmoNew, r => r.mmo.fails); gr.domNew = held(gr.domNew, r => r.dom ? r.dom.fails : []);
      gr.luck = luck.filter(n => ![...gr.newFails, ...gr.mmoNew, ...gr.domNew].includes(n));
      gr.ok = !gr.newFails.length && !gr.mmoNew.length && !gr.domNew.length && !gr.strictBad && /^(ALL|\d+ FAILED)/.test(s.headless.summary);
      gr.rechecked = re.map(r => r.headless.summary);
    }
    const ok = gr.ok && !tr.red.length && !pl.bad && !f.problems.length;
    const row = { name, leads: v.leads, group: v.group, dx: v.dx, dy: v.dy, ok, problems: f.problems, transport: tr, plate: pl, suites: s, green: gr };
    console.log(`${v.group.join('+')} ${v.dx > 0 ? '+' : ''}${v.dx},${v.dy > 0 ? '+' : ''}${v.dy}: ${ok ? 'green' : 'RED'} — transport ${tr.moved} moved, ${tr.kept} kept, ${tr.relative.length} relative, ${tr.red.length} red (${tr.reroll} re-rolled); plate ${pl.checked - pl.bad}/${pl.checked} (${pl.reroll} re-rolled, ${pl.world} world ground, ${Object.entries(pl.seams).map(([k, v]) => v + ' ' + k).join(', ') || 'no seam'}${Object.keys(pl.seams).length ? ', of which ' + pl.seamSame + ' match anyway' : ''}); ${s ? `suite ${s.headless.summary} (${gr.newFails.length} not on the base or a control), mmo-sim ${s.mmo.summary}${s.mmo.retried ? ' (second run)' : ''}${s.dom ? ', dom-keys ' + s.dom.summary.replace('dom-keys: ', '') : ''}` : 'suites not run'}${f.problems.length ? '; atlas: ' + f.problems.join('; ') : ''}`);
    for (const l of tr.red.slice(0, 15)) console.log('    transport: ' + l);
    for (const l of pl.first.slice(0, 8)) console.log('    plate: ' + l);
    if (s) for (const l of [...gr.newFails, ...gr.mmoNew, ...gr.domNew].slice(0, 10)) console.log('    suite: ' + l.slice(0, 220));
    if (s && gr.luck) for (const l of gr.luck.slice(0, 10)) console.log('    luck (failed in fewer than 2 of 3 re-rolls of this move): ' + l.slice(0, 200));
    if (s && gr.held && gr.held.length) for (const l of gr.held.slice(0, 10)) console.log('    held (a file docs/spread/held.json keeps for its peer branch): ' + l.slice(0, 200));
    return row;
  });
}

// every anchor together, WORLD x1.1
if (!flag('--anchors-only') && !only && !flag('--spread-only')) {
  const W2 = Math.round((BASE_W - 6) * SCALE), H2 = Math.round((BASE_H - 6) * SCALE);   // 286 x 198: the old 260 x 180, scaled
  const world = { xs: [[0, 0], [259, 259 * SCALE]], ys: [[0, 0], [179, 179 * SCALE]] };
  const at = {}, moves = {}, done = new Set();
  for (const id of PLACES) {
    if (done.has(id)) continue;
    const grp = id === 'cave' ? ['cave'] : component(id, PLACES.filter(p => p !== 'cave'));
    const lead = grp.slice().sort((a, b) => { const A = boxOf(a), B = boxOf(b); return (B[2] - B[0]) * (B[3] - B[1]) - (A[2] - A[0]) * (A[3] - A[1]); })[0];
    const lb = boxOf(lead), sx = id === 'cave' ? 0 : Math.round(lb[0] * SCALE) - lb[0], sy = id === 'cave' ? 0 : Math.round(lb[1] * SCALE) - lb[1];
    for (const m of grp) { const b = boxOf(m); at[m] = [b[0] + sx, b[1] + sy]; moves[m] = [sx, sy]; done.add(m); }
  }
  const clash = []; for (let i = 0; i < PLACES.length; i++) for (let j = i + 1; j < PLACES.length; j++) { const a = PLACES[i], b = PLACES[j]; if (moves[a].join() !== moves[b].join() && !NESTED.includes([a, b].sort().join('|')) && meet(shifted(boxOf(a), ...moves[a]), shifted(boxOf(b), ...moves[b]))) clash.push(a + '/' + b); }
  const dir = build('world-x1.1', { W: W2, H: H2, at, world });
  const f = await facts(dir);
  const s = await suites(dir), gr = green(s, BASES), pn = pins(Object.assign(f, { solid: baseFacts.solid }));
  if (s) { gr.area = gr.newFails.filter(n => AREA.some(([r]) => r.test(n))).map(n => n + ' (' + AREA.find(([r]) => r.test(n))[1] + ')'); gr.newFails = gr.newFails.filter(n => !AREA.some(([r]) => r.test(n)));
    gr.ok = !gr.newFails.length && !gr.mmoNew.length && !gr.domNew.length && !gr.strictBad && /^(ALL|\d+ FAILED)/.test(s.headless.summary); }
  // the same recheck as a single move's: a failure that does not hold over three re-rolls of this world is luck
  if (s && !gr.ok && (gr.newFails.length || gr.mmoNew.length || gr.domNew.length)) {
    const re = [];
    for (const k of [1, 2, 3]) { const d = build('world-x1.1-r' + k, { W: W2, H: H2, at, world, reroll: k }); re.push(await suites(d, { mmo: gr.mmoNew.length > 0, dom: gr.domNew.length > 0 })); }
    const heldOver = (list, pick) => list.filter(n => re.filter(r => pick(r).some(x => norm(x).slice(0, 80) === norm(n).slice(0, 80))).length >= 2);
    const all = [...gr.newFails, ...gr.mmoNew, ...gr.domNew];
    gr.newFails = heldOver(gr.newFails, r => r.headless.fails); gr.mmoNew = heldOver(gr.mmoNew, r => r.mmo.fails); gr.domNew = heldOver(gr.domNew, r => r.dom ? r.dom.fails : []);
    gr.luck = all.filter(n => ![...gr.newFails, ...gr.mmoNew, ...gr.domNew].includes(n));
    gr.ok = !gr.newFails.length && !gr.mmoNew.length && !gr.domNew.length && !gr.strictBad && /^(ALL|\d+ FAILED)/.test(s.headless.summary);
  }
  // transport, for every place's own facts (the stretched land's are the world's and are not compared)
  const tr = transport(baseFacts, f, moves, NOISE.facts, true); tr.red = tr.red.filter(l => !/belongs to world/.test(l)); tr.relative = tr.relative.filter(l => !/\(world/.test(l));
  const ok = gr.ok && pn.ok && !clash.length && !f.problems.length && !tr.red.length;
  report.world = { map: [W2, H2], world, moves, clash, problems: f.problems, pins: pn, transport: tr, suites: s, green: gr, ok };
  console.log(`all anchors + WORLD x${SCALE} (${W2}x${H2}): ${ok ? 'green' : 'RED'} — pins: rim gate ${pn.rim_gate.steps >= 0 ? 'open (' + pn.rim_gate.steps + ' steps)' : 'SHUT'}, giants' gap ${pn.giants_gap.steps >= 0 ? 'open (' + pn.giants_gap.steps + ' steps)' : 'SHUT'}, steps ${pn.steps_scarp.climb && pn.steps_scarp.above && pn.steps_scarp.below ? 'meet the scarp' : 'DO NOT meet the scarp ' + JSON.stringify(pn.steps_scarp)}; transport ${tr.moved} moved, ${tr.red.length} red; ${s ? `suite ${s.headless.summary} (${gr.newFails.length} not on the base or a control), mmo-sim ${s.mmo.summary}${s.mmo.retried ? ' (second run)' : ''}${s.dom ? ', dom-keys ' + s.dom.summary.replace('dom-keys: ', '') : ''}` : 'suites not run'}${clash.length ? '; boxes meet: ' + clash.join(', ') : ''}${f.problems.length ? '; atlas: ' + f.problems.join('; ') : ''}`);
  for (const l of tr.red.slice(0, 15)) console.log('    transport: ' + l);
  if (s) for (const l of [...gr.newFails, ...gr.mmoNew, ...gr.domNew].slice(0, 40)) console.log('    suite: ' + l.slice(0, 220));
  if (s && gr.luck) for (const l of gr.luck.slice(0, 20)) console.log('    luck (failed in fewer than 2 of 3 re-rolls of this world): ' + l.slice(0, 200));
  if (s && gr.area && gr.area.length) for (const l of gr.area) console.log('    area-proportional (spec §12: re-baselined in 4b): ' + l.slice(0, 260));
  if (s && gr.held && gr.held.length) for (const l of gr.held.slice(0, 10)) console.log('    held (a file docs/spread/held.json keeps for its peer branch): ' + l.slice(0, 200));
}

// THE REAL SPREAD: every anchor at its section-2 `to`, MAP 400x280, WORLD per section 3. The per-anchor pass moves
// an overlapping pair as one (thistledown/hollowford, camp/dock/gull_isle, stone_circle/warden, far_shore/redcut) and the
// x1.1 world gives a group one shift, so a literal framed in the wrong member of a pair never shows there; here every
// place has its own shift. Against a base at 400x280 with nothing moved and two controls that only re-roll the dice
// (cached like the small base): the suites (a check is red when it fails here, passes on that base and both controls,
// and holds over 2 of 3 re-rolls of the spread), every place's facts transported by its own shift, each place's plate,
// and the seam pins. (--spread-only runs this pass alone; --no-spread leaves it out.)
if (RUN_SPREAD) {
  const SW = 400, SH = 280, world = { xs: [[0, 0], [162, 262], [200, 318], [259, 399]], ys: [[0, 0], [179, 279]] };
  const at = {}, moves = {};
  for (const id of PLACES) { const a = AT.ANCHORS[id], b = a.box; at[id] = a.to.slice(); moves[id] = [a.to[0] - b[0], a.to[1] - b[1]]; }
  const sCache = path.join(WORK, 'spread-base', 'base-cache.json');
  let sb = fs.existsSync(sCache) ? JSON.parse(fs.readFileSync(sCache, 'utf8')) : null;
  if (!sb || sb.srcHash !== srcHash) {
    const made = await pool([0, 1, 2], jobs, async k => { const dir = build(k ? 'spread-control-' + k : 'spread-base', { W: SW, H: SH, at: {}, reroll: k }); return { f: await facts(dir), s: await suites(dir) }; });
    sb = { srcHash, facts: made[0].f, suites: made[0].s, controls: made.slice(1).map(m => ({ facts: m.f, suites: m.s })) };
    { const { boot } = await import('./fingerprint.mjs'); const g = boot(path.join(WORK, 'spread-base', 'index.html')); sb.facts.solid = JSON.parse(vm.runInContext('JSON.stringify([...SOLID])', g)); }
    fs.writeFileSync(sCache, JSON.stringify(sb));
  }
  const SNOISE = noiseOf(sb.facts, sb.controls), SBASES = [sb.suites, ...sb.controls.map(c => c.suites).filter(Boolean)];
  console.log(`spread base ${SW}x${SH} (nothing moved): ${sb.suites ? `headless ${sb.suites.headless.summary}, mmo-sim ${sb.suites.mmo.summary}` : 'suites not run'}; its controls: ${sb.controls.map(c => c.suites ? c.suites.headless.summary : '-').join(', ')}`);
  const dir = build('spread', { W: SW, H: SH, at, world });
  const f = await facts(dir);
  const s = await suites(dir), gr = green(s, SBASES), pn = pins(Object.assign(f, { solid: sb.facts.solid }));
  if (s) { gr.area = gr.newFails.filter(n => AREA.some(([r]) => r.test(n))).map(n => n + ' (' + AREA.find(([r]) => r.test(n))[1] + ')'); gr.newFails = gr.newFails.filter(n => !AREA.some(([r]) => r.test(n)));
    gr.ok = !gr.newFails.length && !gr.mmoNew.length && !gr.domNew.length && !gr.strictBad && /^(ALL|\d+ FAILED)/.test(s.headless.summary); }
  if (s && !gr.ok && (gr.newFails.length || gr.mmoNew.length || gr.domNew.length)) {
    const re = [];
    for (const k of [1, 2, 3]) { const d = build('spread-r' + k, { W: SW, H: SH, at, world, reroll: k }); re.push(await suites(d, { mmo: gr.mmoNew.length > 0, dom: gr.domNew.length > 0 })); }
    const heldOver = (list, pick) => list.filter(n => re.filter(r => pick(r).some(x => norm(x).slice(0, 80) === norm(n).slice(0, 80))).length >= 2);
    const all = [...gr.newFails, ...gr.mmoNew, ...gr.domNew];
    gr.newFails = heldOver(gr.newFails, r => r.headless.fails); gr.mmoNew = heldOver(gr.mmoNew, r => r.mmo.fails); gr.domNew = heldOver(gr.domNew, r => r.dom ? r.dom.fails : []);
    gr.luck = all.filter(n => ![...gr.newFails, ...gr.mmoNew, ...gr.domNew].includes(n));
    gr.ok = !gr.newFails.length && !gr.mmoNew.length && !gr.domNew.length && !gr.strictBad && /^(ALL|\d+ FAILED)/.test(s.headless.summary);
  }
  const tr = transport(sb.facts, f, moves, SNOISE.facts, true); tr.red = tr.red.filter(l => !/belongs to world/.test(l)); tr.relative = tr.relative.filter(l => !/\(world/.test(l));
  // each place's plate by its own shift (the base is the same size, so a tile index carries over)
  const pl = { checked: 0, bad: 0, first: [], seams: {}, seamSame: 0, reroll: 0, world: 0 };
  for (const id of PLACES) { const q = plate(sb.facts, f, [id], ...moves[id], SNOISE.tiles, SNOISE.kinds);
    pl.checked += q.checked; pl.bad += q.bad; pl.first.push(...q.first); pl.seamSame += q.seamSame; pl.reroll += q.reroll; pl.world += q.world; for (const k in q.seams) pl.seams[k] = (pl.seams[k] || 0) + q.seams[k]; }
  const ok = gr.ok && pn.ok && !f.problems.length && !tr.red.length && !pl.bad;
  report.spread = { map: [SW, SH], world, moves, problems: f.problems, pins: pn, transport: tr, plate: pl, suites: s, green: gr, ok, base: { suites: sb.suites, controls: sb.controls.map(c => c.suites) } };
  console.log(`THE SPREAD (every anchor at its \`to\`, ${SW}x${SH}): ${ok ? 'green' : 'RED'} — pins: rim gate ${pn.rim_gate.steps >= 0 ? 'open (' + pn.rim_gate.steps + ' steps)' : 'SHUT'}, giants' gap ${pn.giants_gap.steps >= 0 ? 'open (' + pn.giants_gap.steps + ' steps)' : 'SHUT'}, steps ${pn.steps_scarp.climb && pn.steps_scarp.above && pn.steps_scarp.below ? 'at the port in the scarp' : 'NOT at the port in the scarp ' + JSON.stringify(pn.steps_scarp)}; transport ${tr.moved} moved, ${tr.relative.length} relative, ${tr.red.length} red; plate ${pl.checked - pl.bad}/${pl.checked} (${pl.reroll} re-rolled, ${Object.entries(pl.seams).map(([k, v]) => v + ' ' + k).join(', ') || 'no seam'}); ${s ? `suite ${s.headless.summary} (${gr.newFails.length} not on the 400x280 base or a control), mmo-sim ${s.mmo.summary}${s.dom ? ', dom-keys ' + s.dom.summary.replace('dom-keys: ', '') : ''}` : 'suites not run'}${f.problems.length ? '; atlas: ' + f.problems.join('; ') : ''}`);
  for (const l of tr.red.slice(0, 20)) console.log('    transport: ' + l);
  for (const l of pl.first.slice(0, 20)) console.log('    plate: ' + l);
  if (s) for (const l of [...gr.newFails, ...gr.mmoNew, ...gr.domNew].slice(0, 40)) console.log('    suite: ' + l.slice(0, 220));
  if (s && gr.luck) for (const l of gr.luck.slice(0, 20)) console.log('    luck (failed in fewer than 2 of 3 re-rolls of the spread): ' + l.slice(0, 200));
  if (s && gr.area && gr.area.length) for (const l of gr.area) console.log('    area-proportional (spec §12: re-baselined in 4b): ' + l.slice(0, 260));
}

// the per-anchor table: each anchor's own run (the group it moved in; a group shared with a neighbour is one build)
{ const rows = [['anchor', 'moved with', 'offset', 'transport (moved/kept/relative/red)', 'plate (equal/checked)', 'suite (not on base or a control)', 'mmo-sim', 'dom-keys', '']];
  for (const v of report.variants) for (const id of v.leads || []) {
    const s = v.suites, gr = v.green || {};
    rows.push([id, (v.group || []).filter(g => g !== id).join('+') || '-', v.error ? '-' : `${v.dx > 0 ? '+' : ''}${v.dx},${v.dy > 0 ? '+' : ''}${v.dy}`,
      v.transport ? `${v.transport.moved}/${v.transport.kept}/${v.transport.relative.length}/${v.transport.red.length}` : '-',
      v.plate ? `${v.plate.checked - v.plate.bad}/${v.plate.checked}` : '-',
      s ? `${(gr.newFails || []).length} (${s.headless.summary})` : '-', s ? (gr.mmoNew && gr.mmoNew.length ? gr.mmoNew.length + ' new' : 'green') : '-', s && s.dom ? (gr.domNew && gr.domNew.length ? gr.domNew.length + ' new' : 'green') : '-', v.ok ? 'green' : 'RED']);
  }
  if (report.spread) { const w = report.spread, gr = w.green || {}; rows.push(['THE SPREAD 400x280', 'every place', 'its own', `${w.transport.moved}/${w.transport.kept}/${w.transport.relative.length}/${w.transport.red.length}`, `${w.plate.checked - w.plate.bad}/${w.plate.checked}, pins ${w.pins.ok ? 'hold' : 'BROKEN'}`, w.suites ? `${(gr.newFails || []).length} (${w.suites.headless.summary})` : '-', w.suites ? (gr.mmoNew && gr.mmoNew.length ? gr.mmoNew.length + ' new' : 'green') : '-', w.suites && w.suites.dom ? (gr.domNew && gr.domNew.length ? gr.domNew.length + ' new' : 'green') : '-', w.ok ? 'green' : 'RED']); }
  if (report.world) { const w = report.world, gr = w.green || {}; rows.push(['ALL + WORLD x' + SCALE, 'every place', 'x' + SCALE, `${w.transport.moved}/${w.transport.kept}/${w.transport.relative.length}/${w.transport.red.length}`, `pins ${w.pins.ok ? 'hold' : 'BROKEN'}`, w.suites ? `${(gr.newFails || []).length} (${w.suites.headless.summary})` : '-', w.suites ? (gr.mmoNew && gr.mmoNew.length ? gr.mmoNew.length + ' new' : 'green') : '-', w.suites && w.suites.dom ? (gr.domNew && gr.domNew.length ? gr.domNew.length + ' new' : 'green') : '-', w.ok ? 'green' : 'RED']); }
  const wd = rows[0].map((_, i) => Math.max(...rows.map(r => String(r[i]).length)));
  console.log('\n' + rows.map(r => r.map((c, i) => String(c).padEnd(wd[i])).join('  ')).join('\n'));
  report.table = rows; }
fs.writeFileSync(path.join(WORK, 'report.json'), JSON.stringify(report, null, 1));
// the real spread rehearses Stage 4a, which still has work of its own to do there (the river laid anew, the checks whose
// numbers grow with the stretch, the dressing a place draws from its own dice after reading the land round it): it is
// printed and kept in report.json, and counted in the exit code only with --spread-gate
const reds = report.variants.filter(v => !v.ok).length + (report.world && !report.world.ok ? 1 : 0) + (flag('--spread-gate') && report.spread && !report.spread.ok ? 1 : 0);
if (report.spread && !flag('--spread-gate')) console.log(`the real spread: ${report.spread.ok ? 'green' : 'RED'} (a rehearsal of Stage 4a, not counted below; --spread-gate counts it)`);
console.log(`jiggle: ${report.variants.length} moved group${report.variants.length === 1 ? '' : 's'}${report.world ? ' + the x' + SCALE + ' world' : ''}${report.spread ? ' + the real spread' : ''}, ${reds ? reds + ' RED' : 'all green'} (${Math.round((Date.now() - t0) / 1000)} s); ${path.join(WORK, 'report.json')}`);
process.exit(reds ? 1 : 0);
