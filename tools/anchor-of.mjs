#!/usr/bin/env node
// ============================================================================
// ANCHOR-OF — which place a map literal belongs to (the spread spec, §2 and §9.1)
//   node tools/anchor-of.mjs X Y [X Y ...]     the place whose OLD box holds the tile (the smallest box wins; equal
//                                              smallest boxes are ties, listed for a human), every box that holds it,
//                                              and where it goes at the spread; "world" when no place box holds it
//   node tools/anchor-of.mjs --port ID         a port's anchor and its old and spread positions
//   node tools/anchor-of.mjs --json ...        the same as JSON
// Reads ANCHORS and PORTS straight from src/01-atlas.js (no build needed), with the rule ATLAS.anchorOf uses.
// Remember the rule of §2: a door, NPC, chest, quest tile, MAP_TARGET, named spawn or anything a test asserts by position
// is NEVER world. If this says "world" for one of those, extend an anchor box or add a small anchor.
// ============================================================================
import { atlasTables, anchorOf } from './literals.mjs';

const argv = process.argv.slice(2), json = argv.includes('--json');
const T = atlasTables();
const spreadOf = (id, x, y) => { const a = T.ANCHORS[id]; return a && a.to ? [x + a.to[0] - a.box[0], y + a.to[1] - a.box[1]] : null; };
const out = [];
if (argv.includes('--port')) {
  const id = argv[argv.indexOf('--port') + 1], q = T.PORTS[id];
  if (!q) { console.error('anchor-of: no port ' + JSON.stringify(id)); process.exit(2); }
  const [aid, x, y] = q;
  out.push(aid === 'new' ? { port: id, anchor: id.split('.')[0], frame: 'new (the 400x280 plan)', at: [x, y] } : { port: id, anchor: aid, old: [x, y], spread: spreadOf(aid, x, y), rel: T.PORT_REL[id] || undefined });
} else {
  const nums = argv.filter(a => !a.startsWith('--')).map(Number);
  if (nums.length < 2 || nums.length % 2 || nums.some(n => !Number.isFinite(n))) { console.error('usage: node tools/anchor-of.mjs X Y [X Y ...] | --port ID  [--json]'); process.exit(2); }
  for (let i = 0; i < nums.length; i += 2) {
    const [x, y] = [nums[i], nums[i + 1]], h = anchorOf(T, x, y);
    out.push({ at: [x, y], anchor: h.id, ties: h.ties, holders: h.holders, spread: h.id === 'world' ? null : spreadOf(h.id, x, y) });
  }
}
if (json) console.log(JSON.stringify(out, null, 1));
else for (const r of out) {
  if (r.port) { console.log(r.old ? `${r.port}: ${r.anchor} ${r.old.join(',')} -> ${r.spread.join(',')} at the spread${r.rel ? ' (outside its box on purpose: ' + r.rel + ')' : ''}` : `${r.port}: ${r.anchor}, ${r.at.join(',')} in ${r.frame}`); continue; }
  const also = r.holders.filter(id => id !== r.anchor);
  console.log(`${r.at.join(',')}: ${r.anchor}${r.spread ? ` (-> ${r.spread.join(',')} at the spread)` : ' (stretched land)'}${r.ties.length ? `  TIE with ${r.ties.join(', ')}: a human decides` : ''}${also.length ? `  also inside ${also.join(', ')}` : ''}`);
}
