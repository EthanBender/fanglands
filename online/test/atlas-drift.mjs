// The Atlas drift gate (docs/ONLINE.md, "The shared world", Stage 1). Run by both deploy scripts, and by node --test online/test/.
// Makes the Atlas again from the built index.html, on a computer and on an iPad-sized touch screen, and fails unless both
// match online/src/atlas.json byte for byte: a stale Atlas (the game changed and atlas.json was not rebuilt and committed),
// or an Atlas that depends on the screen it was built on, never ships. Exits 1 on drift, so a deploy script stops.
import fs from 'node:fs';
import { makeAtlas, ATLAS_FILE } from '../../tools/atlas.mjs';

const want = fs.readFileSync(ATLAS_FILE, 'utf8');
const desk = makeAtlas(undefined, { w: 1280, h: 800 });
const ipad = makeAtlas(undefined, { w: 1024, h: 1366, touch: true });
const hashOf = t => { try { return JSON.parse(t).hash; } catch (e) { return null; } };
if (desk !== want || ipad !== want) {
  const firstDiff = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return i; };
  const at = desk !== want ? firstDiff(desk, want) : firstDiff(ipad, want);
  console.error('atlas-drift: online/src/atlas.json does not match the game (' + (desk !== want ? 'computer' : 'iPad') + ' build differs at byte ' + at + '; file hash ' + hashOf(want) + ', game ' + hashOf(desk) + ' / ' + hashOf(ipad) + '). Run ./build.sh and commit online/src/atlas.json.');
  process.exit(1);
}
console.log('atlas-drift: online/src/atlas.json matches the game on a computer and on an iPad (' + (want.length / 1024).toFixed(1) + ' KB, hash ' + hashOf(want) + ')');
