#!/usr/bin/env node
// ============================================================================
// SPREAD-OLD-END — the old world's end-of-story save (the Great Spread spec, §10 proof 2; Stage 3)
// Boots the built index.html headless (tools/fingerprint.mjs's sandbox), starts a new game and runs 42-playthrough's
// bot (PLAYTHROUGH.play(): real movement, the main quest 0 -> 16) to the end, then saves and writes the knight's save,
// exactly as the game wrote it to localStorage, to tests/fixtures/spread-old-end.json. Stage 4c migrates this save on
// the new build and asserts that every quest-made tile is at its frame-mapped cell.
//   node tools/spread-old-end.mjs [index.html] [--out FILE] [--tries N]
// A run that ends short of stage 16, or that the bot had to force a stage, is tried again (the bot's fights roll dice);
// exit 1 if none of the tries reaches the end cleanly.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { boot } from './fingerprint.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const html = argv.find((a, i) => !a.startsWith('--') && (i === 0 || !argv[i - 1].startsWith('--'))) || path.join(ROOT, 'index.html');
const out = opt('--out', path.join(ROOT, 'tests', 'fixtures', 'spread-old-end.json')), tries = +opt('--tries', 3);

for (let t = 1; t <= tries; t++) {
  const t0 = Date.now(), g = boot(html);
  const r = JSON.parse(vm.runInContext(`(() => {
    newGame(); title.active = false;
    const r = PLAYTHROUGH.play();
    save();
    return JSON.stringify({ stage: r.stage, forced: r.forced, tps: r.tps.length, steps: r.steps, gameMinutes: r.gameMinutes, deaths: r.deaths, save: localStorage.getItem(SAVE_KEY), worldV: typeof WORLD_V === 'number' ? WORLD_V : null, mapW: MAP_W, mapH: MAP_H });
  })()`, g));
  const secs = Math.round((Date.now() - t0) / 1000);
  if (r.stage >= 16 && !r.forced.length && r.save) {
    const d = JSON.parse(r.save);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, r.save + '\n');
    console.log(`spread-old-end: try ${t}: stage ${r.stage}, nothing forced, ${r.steps} steps (${r.gameMinutes} game minutes, ${r.deaths} deaths, ${secs} s); world ${r.mapW}x${r.mapH}, WORLD_V ${r.worldV}; save ${r.save.length} bytes, ${(d.mapDiffs || []).length} map diffs, written to ${path.relative(ROOT, out)}`);
    process.exit(0);
  }
  console.log(`spread-old-end: try ${t}: stage ${r.stage}, forced ${JSON.stringify(r.forced).slice(0, 300)} (${secs} s): trying again`);
}
console.log(`spread-old-end: no try reached stage 16 cleanly`);
process.exit(1);
