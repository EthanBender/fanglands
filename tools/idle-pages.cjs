// tools/idle-pages.cjs — what an idle, logged-in game page costs in billed Durable Object requests (4 Oct 2026 investigation).
// Real headless pages (playwright-core + chrome-headless-shell, as tools/dom-keys.js finds them) against a LOCAL world only:
//   cd online && CI=1 wrangler dev --port 8811 --ip 127.0.0.1 --compatibility-date 2026-05-22   (.dev.vars: ADMIN_KEY=test-admin,
//   INVITE_CODE=TEST-1234; online/public/index.html = the built game), then
//   node tools/idle-pages.cjs <scenario> <seconds> [--restart <s>]
// Scenarios: solo-|duo-, over|inst, then each knight's state: playing (standing still), paused, hidden (document.hidden and rAF
// parked; timers NOT throttled, so an upper bound for a desktop background tab), ipad-over-playing (hide, drop the socket,
// come back, repeated). --restart appends a comment to online/src/worker.js so wrangler reloads the object (a deploy's restart),
// and takes it out again at the end. It prints, per hour: alarms (the World's game requests minus the pages' own), the pages'
// HTTP, socket messages in, and the billed total; and appends the line to <tmpdir>/idle-pages.jsonl.
// NEVER point BASE at the live world: it signs knights up.
// Idle-cost harness: real headless pages against a local wrangler dev World (port 8811).
// node idle.cjs <scenario> <secs> [--restart N]  (restart: touch online/src/worker.js after N s, wrangler reloads the object)
const { chromium } = require([process.env.PLAYWRIGHT_CORE, process.env.HOME + '/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core'].filter(Boolean).find(p => require('fs').existsSync(p)));
const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8811';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) { console.error('idle-pages: a local world only (BASE=' + BASE + ')'); process.exit(1); }
const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const WT = require('path').join(__dirname, '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
const meter = async () => { const r = await fetch(BASE + '/api/admin/sim', { headers: { authorization: 'Bearer test-admin' } }); const j = await r.json(); return j.meter.today; };
const USED = new Set();
const signup = async name => {
  const r = await fetch(BASE + '/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, pass: 'sword', invite: 'TEST-1234' }) }); const j = await r.json(); if (j.token) return { token: j.token, name };
  if (j.code !== 'signups') throw new Error(JSON.stringify(j));
  // ten new knights an hour from one address: log in to an idle knight made earlier that is not on line
  const list = await (await fetch(BASE + '/api/admin/accounts', { headers: { authorization: 'Bearer test-admin' } })).json();
  const a = list.find(x => /^Idle /.test(x.name) && !x.online && !USED.has(x.name)); if (!a) throw new Error('no idle knight to reuse');
  USED.add(a.name);
  const l = await (await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: a.name, pass: 'sword' }) })).json();
  if (!l.token) throw new Error(JSON.stringify(l)); return { token: l.token, name: a.name };
};

// emulated hidden tab: rAF callbacks parked while hidden, document.hidden true, visibilitychange fired (timers NOT throttled)
const INIT = ([t, n]) => {
  if (!localStorage.getItem('fanglands.session')) { localStorage.setItem('fanglands.session', t); localStorage.setItem('fanglands.lastname', n); }
  let hidden = false; const parked = [];
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => { if (hidden) { parked.push(cb); return 0; } return raf(cb); };
  Object.defineProperty(document, 'hidden', { get: () => hidden, configurable: true });
  Object.defineProperty(document, 'visibilityState', { get: () => hidden ? 'hidden' : 'visible', configurable: true });
  window.__setHidden = h => { hidden = h; document.dispatchEvent(new Event('visibilitychange')); if (!h) { const l = parked.splice(0); for (const cb of l) raf(cb); } };
};

async function knight(browser, tag, log) {
  const { token, name } = await signup('Idle ' + tag + ' ' + Math.random().toString(16).slice(2, 6));
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  await ctx.addInitScript(INIT, [token, name]);
  const page = await ctx.newPage();
  const K = { name, page, ctx, http: [], wsOut: [], wsIn: 0, opens: 0, cdp: null };
  page.on('request', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') || u.pathname === '/ws') K.http.push({ at: Date.now(), m: r.method(), p: u.pathname }); });
  page.on('websocket', ws => { K.opens++; ws.on('framesent', f => { let t = '?'; try { t = JSON.parse(f.payload).t; } catch (e) { } K.wsOut.push({ at: Date.now(), t }); }); ws.on('framereceived', () => K.wsIn++); });
  page.on('pageerror', e => log(tag + ' pageerror ' + String(e).slice(0, 160)));
  await page.goto(BASE + '/?online');
  await page.waitForFunction(() => window.LOGIN && LOGIN.mode === 'me', null, { timeout: 60000 });
  await page.evaluate(() => LOGIN.playAs());
  for (let i = 0; i < 40; i++) { await wait(500); const st = await page.evaluate(() => { if (window.BOYGIRL && BOYGIRL.asking) BOYGIRL.answer('boy'); return LOGIN.playing && NET.status === 'on'; }); if (st) break; }
  await page.waitForFunction(() => window.NET && NET.status === 'on' && LOGIN.playing, null, { timeout: 30000 });
  return K;
}
const set = (K, js) => K.page.evaluate(js);
async function state(K, s) {
  if (s === 'playing') return set(K, 'paused = false');
  if (s === 'paused') return set(K, 'paused = true');
  if (s === 'hidden') return set(K, 'window.__setHidden(true)');
  if (s === 'frozen') { K.cdp = await K.ctx.newCDPSession(K.page); return K.cdp.send('Page.setWebLifecycleState', { state: 'frozen' }); }
}
const SC = {
  // [map, [states]]
  'solo-over-playing': ['over', ['playing']], 'solo-over-paused': ['over', ['paused']], 'solo-over-hidden': ['over', ['hidden']], 'solo-over-frozen': ['over', ['frozen']],
  'solo-inst-playing': ['inst', ['playing']], 'solo-inst-paused': ['inst', ['paused']], 'solo-inst-hidden': ['inst', ['hidden']],
  'duo-over-paused-paused': ['over', ['paused', 'paused']], 'duo-over-paused-hidden': ['over', ['paused', 'hidden']], 'duo-over-playing-playing': ['over', ['playing', 'playing']],
  'duo-over-playing-paused': ['over', ['playing', 'paused']], 'duo-over-paused-playing': ['over', ['paused', 'playing']], 'duo-over-hidden-hidden': ['over', ['hidden', 'hidden']],
  'ipad-over-playing': ['over', ['playing']], 'duo-inst-paused-paused': ['inst', ['paused', 'paused']], 'duo-inst-paused-hidden': ['inst', ['paused', 'hidden']],
};
(async () => {
  const [scn, secsArg] = process.argv.slice(2); const secs = +secsArg || 120;
  const ri = process.argv.indexOf('--restart'); const restartAt = ri > 0 ? +process.argv[ri + 1] : null;
  const [map, states] = SC[scn]; const lines = []; const log = s => { lines.push(s); console.log(s); };
  const browser = await chromium.launch({ executablePath: EXE });
  const ks = [];
  for (let i = 0; i < states.length; i++) ks.push(await knight(browser, String.fromCharCode(65 + i), log));
  if (map === 'inst') {
    const id = await set(ks[0], 'INSTANCES.list()[0]');
    for (const K of ks) await set(K, `INSTANCES.enter(${JSON.stringify(id)})`);
    log('instance ' + id);
  } else {
    // stand them side by side on the overworld, near the first knight
    const p = await set(ks[0], '({x: player.x, y: player.y})');
    for (const K of ks.slice(1)) await set(K, `player.x = ${p.x + 60}; player.y = ${p.y}`);
  }
  await wait(4000);
  for (let i = 0; i < ks.length; i++) await state(ks[i], states[i]);
  await wait(15000);   // settle: the other's presence goes stale, the keeper's grace runs out
  const t0 = Date.now(), m0 = await meter(); const c0 = ks.map(K => ({ h: K.http.length, w: K.wsOut.length, o: K.opens }));
  let restarted = false;
  if (scn.startsWith('ipad')) {
    // an iPad put down and picked up again, CYCLES times: the page hides (its save goes up), the OS drops the socket while the
    // page is frozen, then the page comes back (visible): the wire reconnects
    const K = ks[0]; K.cdp = await K.ctx.newCDPSession(K.page); let n = 0;
    while (Date.now() - t0 < secs * 1000 - 25000) {
      await set(K, 'window.__setHidden(true)'); await wait(500);
      await K.cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
      await fetch(BASE + '/api/status').catch(() => {});   // nothing: the drop is the OS's; we close from the page side below
      await K.cdp.send('Page.setWebLifecycleState', { state: 'active' });
      await set(K, 'try { const s = NET.sock; NET.sock = null; NET.status = "off"; s.onclose = null; s.close(); } catch (e) {}');
      await K.cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
      await wait(8000);
      await K.cdp.send('Page.setWebLifecycleState', { state: 'active' });
      await set(K, 'window.__setHidden(false)'); await wait(11500); n++;
    }
    log('ipad cycles ' + n);
  }
  while (Date.now() - t0 < secs * 1000) {
    await wait(1000);
    if (restartAt != null && !restarted && Date.now() - t0 >= restartAt * 1000) { restarted = true; const f = WT + '/online/src/worker.js'; fs.appendFileSync(f, '// idle-restart ' + Date.now() + '\n'); log('restart at ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s'); }
  }
  let m1 = null; for (let i = 0; i < 20 && !m1; i++) { try { m1 = await meter(); } catch (e) { await wait(1000); } }
  const dt = (Date.now() - t0) / 1000;
  const gameHttp = (m1.http - m1.admin) - (m0.http - m0.admin), wsIn = m1.wsIn - m0.wsIn;
  let pageHttp = 0, pageWs = 0; const per = [];
  ks.forEach((K, i) => {
    const h = K.http.slice(c0[i].h), w = K.wsOut.slice(c0[i].w); pageHttp += h.length; pageWs += w.length;
    const byT = {}; for (const x of w) byT[x.t] = (byT[x.t] || 0) + 1;
    const byP = {}; for (const x of h) byP[x.m + ' ' + x.p] = (byP[x.m + ' ' + x.p] || 0) + 1;
    per.push({ k: K.name, state: states[i], http: byP, ws: byT, opens: K.opens - c0[i].o });
  });
  const kept = await Promise.all(ks.map(K => set(K, '({keeper: window.COOP && COOP.state ? COOP.state.keeper : null, map: PLAYERS.mapId(), net: NET.status})').catch(e => 'frozen')));
  const alarms = gameHttp - pageHttp;
  const out = { scn, secs: +dt.toFixed(1), restart: restartAt, server: { gameHttp, wsIn, alarms_est: alarms }, pages: { http: pageHttp, ws: pageWs }, perHour: { alarms: Math.round(alarms * 3600 / dt), http_page: Math.round(pageHttp * 3600 / dt), wsIn: Math.round(wsIn * 3600 / dt), billed: Math.round((gameHttp + wsIn / 20) * 3600 / dt) }, per, kept };
  log(JSON.stringify(out));
  fs.appendFileSync(require('os').tmpdir() + '/idle-pages.jsonl', JSON.stringify(out) + '\n');
  await browser.close();
  if (restartAt != null) { const f = WT + '/online/src/worker.js'; fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/\/\/ idle-restart \d+\n/g, '')); }
})().catch(e => { console.error(e); process.exit(1); });
