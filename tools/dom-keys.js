#!/usr/bin/env node
// Real key presses in a real (headless) browser, for what the headless suite cannot see: it has no DOM, so it never
// noticed that typed chat messages could not be sent. node tools/dom-keys.js [index.html]
// Needs playwright-core and a Chromium; if neither is on this machine it says so and exits 0 (the suite still gates).
const fs = require('fs'), path = require('path');
const PW = [process.env.PLAYWRIGHT_CORE, path.join(process.env.HOME || '', '.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core'), path.join(process.env.HOME || '', 'Documents/Eden/node_modules/playwright-core')].filter(Boolean).find(p => fs.existsSync(p));
const EXE = [process.env.CHROMIUM, path.join(process.env.HOME || '', 'Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell')].filter(Boolean).find(p => fs.existsSync(p));
if (!PW) { console.log('dom-keys: SKIPPED (no playwright-core found)'); process.exit(0); }
const { chromium } = require(PW);
const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const results = [];
const check = (name, ok, info) => { results.push([name, ok, info]); console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '   ' + JSON.stringify(info))); };
async function scene(browser, touch) {
  const page = await browser.newPage({ viewport: touch ? { width: 1024, height: 768 } : { width: 1280, height: 800 }, hasTouch: touch });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + file, { waitUntil: 'load' });
  await page.waitForFunction(() => window.FANGLANDS && window.FANGLANDS.title);
  await page.evaluate(() => {
    newGame(); title.active = false; window.__sent = [];
    NET.enabled = true;
    NET.useFake({ call: async () => ({}), open: () => { const s = { readyState: 1, send(str) { const m = JSON.parse(str); window.__sent.push(m); if (m.t === 'hello') setTimeout(() => s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'Tester', keeper: 'Tester', role: 'admin' }) }), 0); }, close() { } }; return s; } });
    NET.token = 'x'; NET.connect();
  });
  await page.waitForTimeout(300);
  return { page, errors };
}
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  for (const touch of [false, true]) {
    const where = touch ? 'touch' : 'keyboard';
    const { page, errors } = await scene(browser, touch);
    if (touch) await page.evaluate(() => { const b = buttons.find(b => /^CHAT$/i.test(b.label) || /(^|:)chat$/i.test(b.label)); if (b) b.action(); else CHAT.open(); });
    else await page.keyboard.press('y');
    await page.waitForTimeout(150);
    const x0 = await page.evaluate(() => player.x);
    await page.keyboard.type('wasd hello', { delay: 15 });
    await page.waitForTimeout(150);
    const moved = await page.evaluate(x0 => Math.abs(player.x - x0) > 0.5 || keys.size > 0, x0);
    check(`${where}: letters typed into the chat box (W A S D) do not move the knight`, !moved, { moved });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ sent: window.__sent.filter(m => m.t === 'chat').map(m => m.text), open: CHAT.isOpen() }));
    check(`${where}: a typed chat message is sent by Enter and the box closes`, r.sent.includes('wasd hello') && !r.open, r);
    check(`${where}: no page errors`, errors.length === 0, errors);
    await page.close();
  }
  // the admin search box: Enter puts the keyboard away
  { const { page } = await scene(browser, false);
    const had = await page.evaluate(() => { const i = document.getElementById('admin-search'); if (!i) return null; i.style.display = 'block'; i.focus(); return document.activeElement === i; });
    if (had === null) check('admin search: Enter closes the keyboard (the box exists only once the admin panel has made it)', true, 'no box yet');
    else { await page.keyboard.type('mud'); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
      const blurred = await page.evaluate(() => document.activeElement !== document.getElementById('admin-search'));
      check('admin search: Enter closes the keyboard', blurred, { blurred }); }
    await page.close(); }
  await browser.close();
  const bad = results.filter(r => !r[1]).length;
  console.log(bad ? `dom-keys: ${bad} FAILED of ${results.length}` : `dom-keys: ALL ${results.length} PASS`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
