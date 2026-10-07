#!/usr/bin/env node
// ============================================================================
// THE BOOT-TIME BUDGET (the Great Spread, Stage 4b; spec §7 and §12): the bigger map must still build fast enough.
//   node tools/boot-budget.mjs [index.html] [--runs 3] [--chromium] [--workerd <bench.json>]
//   - node: generateWorld() (a new game's world), the SLOWEST of --runs, must be <= 2.0 s;
//   - --chromium: the same in headless Chromium with its CPU slowed four times (the iPad's stand-in), the slowest of
//     --runs <= 4.0 s (the first slowed run is usually the slowest); and, said but not gated, the whole cold page boot
//     to the title with the CPU slowed from the start (a real first load: parse, compile and the world, cold); needs
//     playwright-core and a Chromium (FANGLANDS_PLAYWRIGHT / FANGLANDS_CHROMIUM, or the usual places), skipped without;
// build.sh runs it on every build (--chromium when a Chromium is there): the review of c34fddf found the iPad stand-in
// at 3.8 to 4.1 s with no gate looking. The median of warm runs hid it; the slowest run does not.
//   - --workerd <bench.json>: reads tools/sim-bench.mjs's local measurement (wrangler dev --local, never a live Worker):
//     the overworld copy's boot inside workerd <= 3.5 s, and the isolate's heap with the overworld <= 45 MB.
// Prints one line per measure and exits 1 when one is over its budget.
// ============================================================================
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { boot } from './fingerprint.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const html = path.resolve(args.find((a, i) => !a.startsWith('--') && !['--runs', '--workerd'].includes(args[i - 1])) || path.join(ROOT, 'index.html'));
const runs = +opt('--runs', 3), BUDGET = { node: 2000, chromium: 4000, workerdBoot: 3500, workerdHeapMB: 45 };
const slowest = a => Math.max(...a);
let over = 0;
const line = (name, v, max, unit, extra = '') => { const ok = v <= max; if (!ok) over++; console.log(`${name}: ${v}${unit} (budget ${max}${unit})${extra} ${ok ? 'ok' : 'OVER'}`); };

// ---------- node ----------
{ const g = boot(html), times = [];
  vm.runInContext('newGame()', g);   // the first world (warms the code)
  for (let i = 0; i < runs; i++) times.push(vm.runInContext('(() => { const t = performance.now(); generateWorld(); return performance.now() - t; })()', g));
  const size = vm.runInContext('MAP_W + "x" + MAP_H', g);
  line('node generateWorld, the slowest run', Math.round(slowest(times)), BUDGET.node, ' ms', ` (map ${size}, runs ${times.map(Math.round).join(', ')})`); }

// ---------- Chromium, CPU slowed 4x ----------
if (args.includes('--chromium')) {
  const req = createRequire(import.meta.url);
  const pwPaths = [process.env.FANGLANDS_PLAYWRIGHT, path.join(os.homedir(), '.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core'), path.join(ROOT, 'node_modules/playwright-core')].filter(Boolean);
  const pw = pwPaths.find(p => fs.existsSync(p));
  const exes = [process.env.FANGLANDS_CHROMIUM, path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell')].filter(Boolean);
  const exe = exes.find(p => fs.existsSync(p));
  if (!pw) console.log('chromium: skipped (no playwright-core; set FANGLANDS_PLAYWRIGHT)');
  else if (!exe) console.log('chromium: skipped (no Chromium; set FANGLANDS_CHROMIUM)');
  else {
    const { chromium } = req(pw);
    const browser = await chromium.launch({ executablePath: exe, headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
      await page.goto('file://' + html, { waitUntil: 'load' });
      await page.waitForFunction(() => window.FANGLANDS && typeof generateWorld === 'function', null, { timeout: 60000 });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const times = [];
      for (let i = 0; i < runs; i++) times.push(await page.evaluate(() => { const t = performance.now(); generateWorld(); return performance.now() - t; }));
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      line('chromium generateWorld, CPU 4x slower, the slowest run', Math.round(slowest(times)), BUDGET.chromium, ' ms', ` (runs ${times.map(Math.round).join(', ')})`);
      // a cold first load: the CPU slowed before the page is asked for, timed to the title screen (said, not gated)
      const cold = await browser.newPage({ viewport: { width: 1024, height: 768 } });
      const cdp2 = await cold.context().newCDPSession(cold);
      await cdp2.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const t0 = Date.now();
      await cold.goto('file://' + html, { waitUntil: 'load', timeout: 120000 });
      await cold.waitForFunction(() => window.FANGLANDS && window.FANGLANDS.title, null, { timeout: 120000 });
      console.log(`chromium cold page boot to the title, CPU 4x slower: ${Date.now() - t0} ms (said, not gated: parse, compile and the first world together)`);
    } finally { await browser.close(); }
  }
}

// ---------- workerd (tools/sim-bench.mjs's local measurement) ----------
const wf = opt('--workerd', null);
if (wf) {
  const b = JSON.parse(fs.readFileSync(wf, 'utf8'));
  const boots = (b.overworldBoot || []).map(q => q.insideMs).filter(v => typeof v === 'number');
  if (boots.length) line('workerd overworld boot', Math.round(Math.max(...boots)), BUDGET.workerdBoot, ' ms', ` (inside, each of ${boots.length}: ${boots.map(Math.round).join(', ')}; wrangler ${b.wrangler})`);
  else { over++; console.log('workerd overworld boot: not in ' + wf + ' OVER'); }
  const h = (b.heap || []).find(q => q.label === 'overworld');
  if (h && typeof h.usedMB === 'number') line('workerd heap with the overworld', h.usedMB, BUDGET.workerdHeapMB, ' MB');
  else { over++; console.log('workerd heap: not in ' + wf + (h && h.error ? ' (' + h.error + ')' : '') + ' OVER'); }
}
console.log(over ? `boot-budget: ${over} OVER` : 'boot-budget: all within budget');
process.exit(over ? 1 : 0);
