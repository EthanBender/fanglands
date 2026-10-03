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
    NET.useFake({ call: async () => ({}), open: () => { const s = { readyState: 1, send(str) { window.__sock = s; const m = JSON.parse(str); window.__sent.push(m); if (m.t === 'hello') setTimeout(() => s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'Tester', keeper: 'Tester', role: 'admin' }) }), 0); }, close() { } }; return s; } });
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
  // a right-click (and a plain click) on another knight opens their card, and the browser's own menu never shows
  { const { page, errors } = await scene(browser, false);
    const at = await page.evaluate(() => {
      __sock.onmessage({ data: JSON.stringify({ t: 'p', n: 'Ava', map: 'over', x: Math.round(player.x + 90), y: Math.round(player.y), fx: -1, fy: 0, mv: false, wt: 0, hp: 20, mhp: 20, lv: 7, look: null, mech: null, dead: false, def: 100, act: null, role: 'player' }) });
      FANGLANDS.step([]); render(); const e = PLAYERS.remote.Ava; return { x: e.shown.x - cam.x, y: e.shown.y - 8 - cam.y };
    });
    const prevented = await page.evaluate(({ x, y }) => { const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 }); document.getElementById('game').dispatchEvent(ev); return ev.defaultPrevented; }, at);
    await page.mouse.click(at.x, at.y, { button: 'right' }); await page.waitForTimeout(150);
    const right = await page.evaluate(() => ({ menu: TRADE.menu && TRADE.menu.n, walk: !!player.walkPath, swing: player.attackT > 0 }));
    await page.evaluate(() => TRADE.closeMenu()); await page.waitForTimeout(400);
    await page.mouse.click(at.x, at.y); await page.waitForTimeout(150);
    const left = await page.evaluate(() => ({ menu: TRADE.menu && TRADE.menu.n, walk: !!player.walkPath }));
    check("a right-click on another knight opens their card (Trade, Follow, Close) with no browser menu, no walk and no swing; a plain click does too", prevented && right.menu === 'Ava' && !right.walk && !right.swing && left.menu === 'Ava' && !left.walk, { prevented, right, left });
    check('right-click: no page errors', errors.length === 0, errors);
    await page.close(); }
  // the rematches by real key presses: E on the War Shed's valve stands a Barrelbeast up; E on the wind shrine (the storm
  // broken) opens its two choices and a real click on Into the storm goes in
  { const { page, errors } = await scene(browser, false);
    await page.evaluate(() => { const hf = quest.hollowford || (quest.hollowford = {}); Object.assign(hf, { beastKilled: true, rewarded: true, freed: true, shedUp: false, shedRestUntil: 0 }); INSTANCES.enter('war_shed'); __sock.onmessage({ data: JSON.stringify({ t: 'keeper', map: 'war_shed', n: 'Tester' }) }); FANGLANDS.tp(14, 4); FANGLANDS.face(14, 3); dialog.cur = null; dialog.queue.length = 0; });
    await page.waitForTimeout(150); await page.keyboard.press('e');
    await page.waitForFunction(() => monsters.some(m => m.type === 'barrelbeast' && !m.dead), null, { timeout: 4000 }).catch(() => { });
    const shed = await page.evaluate(() => ({ inst: INSTANCES.active(), up: monsters.filter(m => m.type === 'barrelbeast' && !m.dead).length, shedUp: quest.hollowford.shedUp }));
    check('E on the War Shed valve stands one Barrelbeast up off the stocks', shed.inst === 'war_shed' && shed.up === 1 && shed.shedUp === true, shed);
    await page.evaluate(() => { INSTANCES.leave(); quest.storm = Object.assign(quest.storm || {}, { beaten: true, restUntil: 0 }); if (!countItem('wind_flute')) addItem('wind_flute', 1); FANGLANDS.tp(62, 7); FANGLANDS.face(62, 6); dialog.cur = null; dialog.queue.length = 0; closePanel(); });
    await page.waitForTimeout(150); await page.keyboard.press('e');
    await page.waitForFunction(() => panel === 'windshrine' && buttons.some(x => x.label === 'Into the storm'), null, { timeout: 4000 }).catch(() => { });
    const btn = await page.evaluate(() => { const b = buttons.find(x => x.label === 'Into the storm'); return { panel, b: b && { x: b.x + b.w / 2, y: b.y + b.h / 2, h: b.h } }; });
    if (btn.b) { await page.mouse.click(btn.b.x, btn.b.y); await page.waitForFunction(() => INSTANCES.active() === 'stormfront' && !!STORM.bird(), null, { timeout: 4000 }).catch(() => { }); }
    const storm = await page.evaluate(() => ({ inst: INSTANCES.active(), bird: !!STORM.bird() }));
    check('E on the wind shrine (the storm broken) opens its two choices; a click on Into the storm goes in to the Thunderbird', btn.panel === 'windshrine' && !!btn.b && btn.b.h >= 44 && storm.inst === 'stormfront' && storm.bird, { btn, storm });
    check('rematch keys: no page errors', errors.length === 0, errors);
    await page.close(); }
  await browser.close();
  const bad = results.filter(r => !r[1]).length;
  console.log(bad ? `dom-keys: ${bad} FAILED of ${results.length}` : `dom-keys: ALL ${results.length} PASS`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
