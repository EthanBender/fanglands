// tools/spread-two-pages.cjs — the Great Spread's two-browser proof (spec §11 and the Stage 4 proof), against a LOCAL world only.
// Real headless pages (playwright-core + chrome-headless-shell, as tools/idle-pages.cjs finds them):
//   ./build.sh && cp index.html online/public/index.html
//   cd online && CI=1 wrangler dev --port 8812 --ip 127.0.0.1 --var ADMIN_KEY:test-admin --var INVITE_CODE:TEST-1234 --persist-to <scratch dir>
//   node tools/spread-two-pages.cjs [--old <old build index.html>] [--shots <dir>]
// The OLD page is the build live today (world 1; by default `git show master:index.html`), served to its browser in place of
// the new one; the NEW page is online/public/index.html (this tree). Every other request goes to the local world.
//   1. Ann (old page) and Ben (new page) play on the overworld at once, with Dot (a second old page) and Eve (a second new
//      page): Ann and Ben never hear each other's presence and each keeps his own monsters; Dot hears Ann and Eve hears Ben
//      (so the relay works, it is keyed apart); the old pages show the NEW WORLD reload plaque, the new pages do not.
//   2. Ann's old page pushes her world-1 save (200).
//   3. Ann opens the new page elsewhere: it brings her knight into the new world (worldV 2, stamped quest.spread) and pushes it.
//   4. Ann's old page, still open, pushes again: 409 stale_world, and the world still holds the world-2 save.
//   5. The old page reloads (now the new build): Ann's knight loads as she is (no second migration), on the new world's Atlas.
// Prints one line per check, PASS or FAIL, and exits 1 on any FAIL. NEVER point BASE at a live world: it signs knights up.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require([process.env.PLAYWRIGHT_CORE, process.env.HOME + '/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core'].filter(Boolean).find(p => fs.existsSync(p)));
const BASE = process.env.BASE || 'http://127.0.0.1:8812';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) { console.error('spread-two-pages: a local world only (BASE=' + BASE + ')'); process.exit(1); }
const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const WT = path.join(__dirname, '..');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const OLD_HTML = arg('--old') ? fs.readFileSync(arg('--old'), 'utf8') : execSync('git show master:index.html', { cwd: WT, maxBuffer: 64 << 20 }).toString();
const NEW_HTML = fs.readFileSync(path.join(WT, 'online', 'public', 'index.html'), 'utf8');
const SHOTS = arg('--shots');
const ATLAS = JSON.parse(fs.readFileSync(path.join(WT, 'online', 'src', 'atlas.json'), 'utf8'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const check = (name, ok, detail) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  ' + JSON.stringify(detail))); };

const api = async (method, p, body, token) => {
  const headers = { 'content-type': 'application/json' }; if (token) headers.authorization = 'Bearer ' + token;
  const r = await fetch(BASE + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch (e) { } return { status: r.status, data: j };
};
const tag = Math.random().toString(16).slice(2, 6);
const signup = async name => { const r = await api('POST', '/api/signup', { name: name + ' ' + tag, pass: 'sword', invite: 'TEST-1234' }); if (!r.data || !r.data.token) throw new Error('signup ' + name + ': ' + JSON.stringify(r.data)); return { token: r.data.token, name: name + ' ' + tag }; };
const stored = async token => { const r = await api('GET', '/api/save', undefined, token); return r.data && r.data.save ? JSON.parse(r.data.save) : null; };

async function page(browser, who, build, log) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  await ctx.addInitScript(([t, n]) => { if (!localStorage.getItem('fanglands.session')) { localStorage.setItem('fanglands.session', t); localStorage.setItem('fanglands.lastname', n); } }, [who.token, who.name]);
  const P = { who, ctx, build, frames: [], puts: [] };
  // the document is the old or the new build; /api and /ws go to the local world
  await ctx.route(u => { const x = new URL(u); return x.origin === BASE && (x.pathname === '/' || x.pathname === '/index.html'); }, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: P.build === 'old' ? OLD_HTML : NEW_HTML }));
  P.page = await ctx.newPage();
  P.page.on('websocket', ws => ws.on('framereceived', f => { try { P.frames.push(JSON.parse(f.payload)); } catch (e) { } }));
  P.page.on('response', async r => { const u = new URL(r.url()); if (u.pathname === '/api/save' && r.request().method() === 'PUT') { let j = null; try { j = await r.json(); } catch (e) { } P.puts.push({ status: r.status(), body: j }); } });
  P.page.on('pageerror', e => log(who.name + ' pageerror ' + String(e).slice(0, 200)));
  await enter(P);
  return P;
}
async function enter(P) {
  await P.page.goto(BASE + '/?online');
  await P.page.waitForFunction(() => window.LOGIN && LOGIN.mode === 'me', null, { timeout: 60000 });
  await P.page.evaluate(() => LOGIN.playAs());
  for (let i = 0; i < 60; i++) { await wait(500); const st = await P.page.evaluate(() => { if (window.BOYGIRL && BOYGIRL.asking) BOYGIRL.answer('boy'); return LOGIN.playing && NET.status === 'on'; }); if (st) break; }
  await P.page.waitForFunction(() => window.NET && NET.status === 'on' && LOGIN.playing, null, { timeout: 30000 });
}
const ev = (P, js) => P.page.evaluate(js);
const heard = (P, name) => P.frames.filter(m => m.t === 'p' && m.n === name).length;
const plaque = P => ev(P, "typeof buttons !== 'undefined' && buttons.some(b => b.label === 'NEW WORLD')");
// walk a few steps east and back, so each page sends presence that moves
const stroll = async P => { await ev(P, "(() => { paused = false; player.x += 48; })()"); await wait(700); await ev(P, "(() => { player.x -= 48; })()"); await wait(700); };

(async () => {
  const log = s => console.log('  ' + s);
  const st = await api('GET', '/api/status');
  check('a local world answers at ' + BASE, st.status === 200, st.status);
  const sim = await api('GET', '/api/admin/sim', undefined, 'test-admin');
  check('the local world runs this tree\'s Atlas (' + ATLAS.hash + ', ' + ATLAS.MAP_W + ' x ' + ATLAS.MAP_H + ')', sim.data && sim.data.atlas && sim.data.atlas.hash === ATLAS.hash, sim.data && sim.data.atlas);
  const oldAtlas = (OLD_HTML.match(/"hash":"([0-9a-f]{16})"/) || [])[1] || null;
  // the document is fulfilled by the harness, so Chromium's local-network check would block its socket to 127.0.0.1; a local proof only
  const browser = await chromium.launch({ executablePath: EXE, args: ['--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights'] });
  try {
    const ann = await signup('Ann'), ben = await signup('Ben'), dot = await signup('Dot'), eve = await signup('Eve');
    const A = await page(browser, ann, 'old', log), D = await page(browser, dot, 'old', log);
    const B = await page(browser, ben, 'new', log), E = await page(browser, eve, 'new', log);
    const oldV = await ev(A, 'WORLD_V'), newV = await ev(B, 'WORLD_V');
    check('the old page is world 1 and the new page world 2', oldV === 1 && newV === 2, { oldV, newV, oldAtlas: await ev(A, 'ATLAS.hash()'), newAtlas: await ev(B, 'ATLAS.hash()') });
    // 1. together on the overworld for a while
    for (let i = 0; i < 4; i++) await Promise.all([A, B, D, E].map(stroll));
    await wait(1500);
    check('the old page (Ann) never hears the new page (Ben)', heard(A, ben.name) === 0, { annHeardBen: heard(A, ben.name) });
    check('the new page (Ben) never hears the old page (Ann)', heard(B, ann.name) === 0, { benHeardAnn: heard(B, ann.name) });
    check('two old pages hear each other (Dot hears Ann), and two new pages too (Eve hears Ben): the relay is keyed apart, not broken', heard(D, ann.name) > 0 && heard(E, ben.name) > 0, { dotHeardAnn: heard(D, ann.name), eveHeardBen: heard(E, ben.name) });
    const keepers = { ann: await ev(A, 'COOP.keeper()'), dot: await ev(D, 'COOP.keeper()'), ben: await ev(B, 'COOP.keeper()'), eve: await ev(E, 'COOP.keeper()') };
    const oldKeeper = [ann.name, dot.name].includes(keepers.ann) && keepers.dot === keepers.ann, newKeeper = [ben.name, eve.name].includes(keepers.ben) && keepers.eve === keepers.ben;
    check('the old pages keep their own monsters and the new pages theirs (one keeper each side, never across)', oldKeeper && newKeeper, keepers);
    const view = (await api('GET', '/api/admin/sim', undefined, 'test-admin')).data.move.knights;
    const atl = Object.fromEntries(view.map(k => [k.n, k.atlas]));
    check('the parent page sees the old pages as another Atlas and the new as the same', atl[ann.name] === 'old' && atl[dot.name] === 'old' && atl[ben.name] === 'same' && atl[eve.name] === 'same', atl);
    await wait(500);
    const pl = { ann: await plaque(A), ben: await plaque(B) };
    check('the old page shows the NEW WORLD reload plaque ("A newer world is ready"); the new page does not', pl.ann === true && pl.ben === false, pl);
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await A.page.screenshot({ path: path.join(SHOTS, '1-old-page-ann.png') }); await B.page.screenshot({ path: path.join(SHOTS, '1-new-page-ben.png') }); }
    // 2. Ann's old page saves to the world: a world-1 save
    await ev(A, '(() => { player.kills = 7; save(); return CLOUD.push(true); })()');
    for (let i = 0; i < 20 && !A.puts.length; i++) await wait(250);
    const s1 = await stored(ann.token);
    check('the old page\'s push lands (200) as a world-1 save', A.puts.length >= 1 && A.puts[A.puts.length - 1].status === 200 && s1 && (s1.worldV | 0) <= 1 && s1.player.kills === 7, { puts: A.puts, worldV: s1 && s1.worldV, kills: s1 && s1.player.kills });
    // 3. Ann opens the new page elsewhere: her knight is brought in and pushed as world 2
    const A2 = await page(browser, ann, 'new', log);
    let s2 = null;
    for (let i = 0; i < 40; i++) { s2 = await stored(ann.token); if (s2 && s2.worldV === 2) break; await ev(A2, 'CLOUD.push(true)'); await wait(500); }
    const mig = await ev(A2, '({ v: WORLD_V, stage: quest.stage, kills: player.kills, spread: !!(quest.spread && quest.spread.v === 2), x: Math.floor(player.x / TILE), y: Math.floor(player.y / TILE) })');
    check('the new page brings Ann\'s knight into the new world: her save is world 2 now, stamped by the spread, nothing of hers lost', s2 && s2.worldV === 2 && mig.spread && s2.player.kills === 7, { stored: s2 && { worldV: s2.worldV, mapW: s2.mapW, kills: s2.player.kills, spread: !!(s2.quest && s2.quest.spread) }, page: mig });
    if (SHOTS) await A2.page.screenshot({ path: path.join(SHOTS, '3-new-page-ann-migrated.png') });
    // 4. the old page, still open, pushes again: refused
    const before = A.puts.length;
    await ev(A, '(() => { player.kills = 99; save(); return CLOUD.push(true); })()');
    for (let i = 0; i < 20 && A.puts.length === before; i++) await wait(250);
    const r4 = A.puts[A.puts.length - 1], s4 = await stored(ann.token);
    check('the old page\'s next push gets 409 stale_world, and the world keeps the world-2 save', A.puts.length > before && r4.status === 409 && r4.body && r4.body.error === 'stale_world' && s4.worldV === 2 && s4.player.kills === 7, { put: r4, storedWorldV: s4 && s4.worldV, storedKills: s4 && s4.player.kills });
    // 5. the old page reloads: the new build, her knight as the new world holds it, no second move
    await A2.ctx.close();
    A.build = 'new'; A.frames.length = 0;
    await enter(A);
    await wait(1500);
    const after = await ev(A, '({ v: WORLD_V, atlas: ATLAS.hash(), kills: player.kills, at: quest.spread && quest.spread.at, told: quest.spread && quest.spread.told })');
    const welcome = A.frames.filter(m => m.t === 'welcome').pop();
    const migAt = s2 && s2.quest && s2.quest.spread ? s2.quest.spread.at : undefined;
    check('reloaded, the page is the new build on the new world\'s Atlas, with Ann\'s world-2 knight (moved once, not twice)', after.v === 2 && after.atlas === ATLAS.hash && !!welcome && welcome.atlas === ATLAS.hash && after.kills === 7 && JSON.stringify(after.at) === JSON.stringify(migAt), { after, migAt, welcomeAtlas: welcome && welcome.atlas });
    const s5 = await stored(ann.token);
    check('her save in the world is still world 2 with the same spread stamp', s5.worldV === 2 && JSON.stringify(s5.quest.spread && s5.quest.spread.at) === JSON.stringify(s2.quest.spread && s2.quest.spread.at), { worldV: s5.worldV, at: s5.quest.spread && s5.quest.spread.at, was: s2.quest.spread && s2.quest.spread.at });
    if (SHOTS) await A.page.screenshot({ path: path.join(SHOTS, '5-reloaded-ann.png') });
    // the same tab, now a new page: Ben hears her (one world again)
    for (let i = 0; i < 3; i++) await Promise.all([A, B].map(stroll));
    await wait(1000);
    check('once reloaded, Ann is in the new world with Ben: he hears her now', heard(B, ann.name) > 0, { benHeardAnn: heard(B, ann.name) });
  } catch (e) { check('the run itself', false, String(e && e.stack || e).slice(0, 600)); }
  finally { await browser.close(); }
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
