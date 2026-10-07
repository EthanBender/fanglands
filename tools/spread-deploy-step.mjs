#!/usr/bin/env node
// ============================================================================
// THE GREAT SPREAD'S DEPLOY STEP (spec §11; docs/ONLINE.md "The Great Spread on the server"): the drop parties on the old map.
//   node tools/spread-deploy-step.mjs --base <world address> [--secrets <file>] [--yes]
//
// RUN ONLY INSIDE THE OWNER-APPROVED DEPLOY, right after the spread build is live. Never on its own, never "to see".
//
// A drop party's crackers lie on tiles of the overworld it was thrown on. After the spread those tiles are somewhere else,
// so every live party on 'over' ends (ended = 1, its unlit crackers gone). A cracker already lit keeps its prize: prizes
// are the store's rows, claimable as ever (they come with each welcome). Parties inside caves and other instances are kept.
//
//   1. GET /api/admin/spread-parties: the world names its Atlas hash and width. The step goes on only when that is this
//      tree's online/src/atlas.json (the new world is live); otherwise it stops (exit 2) and changes nothing.
//   2. It prints the live overworld parties (id, who threw it, where, unlit / lit crackers).
//   3. Without --yes it stops there (a dry run). With --yes it POSTs: every listed party ends, one mod_log row says so; then
//      it reads the list again, which must be empty (exit 1 otherwise).
//
// The admin key comes from --secrets (a file with ADMIN_KEY=..., e.g. ~/.fanglands/online-secrets.env for the live world)
// or FANGLANDS_ADMIN_KEY. It is sent only to --base, and never printed. --base has no default on purpose.
// Proved against a LOCAL `wrangler dev` (docs/spread/README.md, Stage 4d); never run against a live Worker outside a deploy.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const base = (opt('--base') || '').replace(/\/+$/, '');
const yes = args.includes('--yes');
if (!/^https?:\/\/[^/]+$/.test(base)) { console.error('usage: node tools/spread-deploy-step.mjs --base <https://world> [--secrets <file>] [--yes]   (run only inside the owner-approved deploy)'); process.exit(64); }

function adminKey() {
  const file = opt('--secrets');
  if (file) {
    const m = fs.readFileSync(file.replace(/^~(?=\/)/, process.env.HOME || '~'), 'utf8').match(/^ADMIN_KEY=(.*)$/m);
    if (m && m[1].trim()) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  if (process.env.FANGLANDS_ADMIN_KEY) return process.env.FANGLANDS_ADMIN_KEY;
  console.error('no admin key: give --secrets <file with ADMIN_KEY=...> or set FANGLANDS_ADMIN_KEY'); process.exit(64);
}
const KEY = adminKey();
async function call(method) {
  const r = await fetch(base + '/api/admin/spread-parties', { method, headers: { authorization: 'Bearer ' + KEY, 'content-type': 'application/json' } });
  let data = null; try { data = await r.json(); } catch (e) { }
  if (!r.ok) { console.error(`${method} /api/admin/spread-parties: HTTP ${r.status} ${data && data.code ? '(' + data.code + ')' : ''}`); process.exit(1); }
  return data;
}
const when = ms => new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const show = list => { for (const p of list) console.log(`  party #${p.id} by ${p.by} in ${p.region || 'the overworld'} (thrown ${when(p.at)}, ends ${when(p.expires)}): ${p.unlit} unlit, ${p.lit} lit`); };

const want = JSON.parse(fs.readFileSync(path.join(ROOT, 'online', 'src', 'atlas.json'), 'utf8'));
const now = await call('GET');
console.log(`world ${base}: Atlas ${now.atlas}, ${now.mapW} wide (this tree: ${want.hash}, ${want.MAP_W} wide)`);
if (now.atlas !== want.hash || now.mapW !== want.MAP_W) { console.error('stop: the world is not running this tree\'s Atlas yet (deploy first). Nothing was changed.'); process.exit(2); }
console.log(now.parties.length ? `${now.parties.length} live drop part${now.parties.length === 1 ? 'y' : 'ies'} on the overworld:` : 'no live drop party on the overworld.');
show(now.parties);
if (!yes) { console.log('dry run: nothing changed (add --yes inside the deploy to end them).'); process.exit(0); }
const done = await call('POST');
console.log(`ended ${done.parties.length}: ${done.parties.map(p => '#' + p.id).join(', ') || 'none'}; prizes already won stay claimable.`);
const after = await call('GET');
if (after.parties.length) { console.error('still live on the overworld:'); show(after.parties); process.exit(1); }
console.log('the overworld has no live drop party now.');
