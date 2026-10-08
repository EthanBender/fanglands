#!/usr/bin/env node
// tools/ride-browser.mjs — riding together (docs/ONLINE.md, "Riding together") in REAL game pages against a LOCAL world.
// It starts nothing itself: in online/, with online/.dev.vars holding ADMIN_KEY and INVITE_CODE, run
//   cp ../index.html public/index.html
//   CI=1 wrangler dev -c wrangler.local.toml --port 8787 --ip 127.0.0.1 --compatibility-date 2026-05-22
// (wrangler.local.toml: wrangler.toml without its [[routes]]; never committed) then, from the repo root:
//   node tools/ride-browser.mjs           every check (PASS/FAIL lines; exit 1 on a FAIL), screenshots in OUT
// OUT defaults to ~/.fanglands/work/ride/shots. BASE defaults to http://127.0.0.1:8787 and must be a local address.
// Three real pages, each logged in on the game's own card: Mudtech drives (a computer, 1280 x 800), Ben rides (a computer,
// 1280 x 800, the E key) and Ann rides (an iPad, 1180 x 820, touch: she taps the HOP ON seat). For the bulldozer, the walker
// and the Barrelbeast in turn: the friends hop on, the machine drives, everyone's screens agree, screenshots from the
// driver's and a rider's screen at 1280 x 800 and at the iPad size, then the driver climbs out and every rider is set down on
// free ground. The world's movement check counts nothing for the riders, and no page throws.
// Needs playwright-core and a Chromium (found as tools/dom-keys.js finds them): without them it says so and exits 0.
// NEVER point it at a real world: it signs knights in with a password.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const PW = [process.env.PLAYWRIGHT_CORE, path.join(os.homedir(), '.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core'), path.join(os.homedir(), 'Documents/Eden/node_modules/playwright-core')].filter(Boolean).find(p => fs.existsSync(p));
const EXE = [process.env.CHROMIUM, path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell')].filter(Boolean).find(p => fs.existsSync(p));
if (!PW) { console.log('ride-browser: SKIPPED (no playwright-core found)'); process.exit(0); }
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) { console.error('ride-browser: a local world only (' + BASE + ')'); process.exit(1); }
const vars = (() => { try { return fs.readFileSync(path.join(ROOT, 'online/.dev.vars'), 'utf8'); } catch (e) { return ''; } })();
const KEY = process.env.ADMIN_KEY || (/ADMIN_KEY=(.*)/.exec(vars) || [])[1] || 'test-admin', INVITE = process.env.INVITE || (/INVITE_CODE=(.*)/.exec(vars) || [])[1] || 'TEST-1234';
const OUT = process.env.OUT || path.join(os.homedir(), '.fanglands/work/ride/shots');
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require(PW);
const wait = ms => new Promise(r => setTimeout(r, ms));
const results = [], shots = [];
const line = (name, ok, info) => { results.push(!!ok); console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined ? '   ' + JSON.stringify(info).slice(0, 1400) : '')); };
const note = text => console.log('      ' + text);
const shot = async (page, name) => { const p = path.join(OUT, name + '.png'); await page.screenshot({ path: p }); shots.push(p); note('screenshot ' + p); };

async function api(method, p, body, headers = {}) {
  const r = await fetch(BASE + p, { method, headers: Object.assign({ 'content-type': 'application/json' }, headers), body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch (e) { }
  return { status: r.status, data };
}
const admin = (method, p, body) => api(method, p, body, { authorization: 'Bearer ' + KEY });
let ipN = 0;
const ipNext = () => { ipN++; return '10.81.' + Math.floor(ipN / 200) + '.' + (ipN % 200 + 1); };
async function knight(name) {
  let r = await api('POST', '/api/signup', { name, pass: 'sword', invite: INVITE }, { 'cf-connecting-ip': ipNext() });
  if (r.status === 409) r = await api('POST', '/api/login', { name, pass: 'sword' }, { 'cf-connecting-ip': ipNext() });
  if (r.status !== 200) throw new Error('knight ' + name + ': ' + r.status + ' ' + JSON.stringify(r.data));
}
// a real kid: the game itself, logged in on its card (an iPad: a touch screen the size of an iPad Air held sideways)
const DESK = { width: 1280, height: 800 }, IPAD = { width: 1180, height: 820 };
async function realKid(browser, name, ipad, look = {}) {
  await knight(name);
  const ctx = await browser.newContext({ viewport: ipad ? IPAD : DESK, hasTouch: !!ipad, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.errors = []; p.on('pageerror', e => p.errors.push(String(e)));
  await p.goto(BASE + '/?online');
  if (ipad) await p.evaluate(() => { window.__forceTouch = true; });
  await p.waitForSelector('#fl-name', { state: 'visible', timeout: 20000 });
  await p.fill('#fl-name', name); await p.fill('#fl-pass', 'sword');
  await p.click('#fl-login button[type=submit]');
  for (let i = 0; i < 80; i++) {
    const ok = await p.evaluate(girl => { if (window.BOYGIRL && BOYGIRL.asking) BOYGIRL.answer(girl ? 'girl' : 'boy'); if (window.LOGIN && LOGIN.mode === 'offer') LOGIN.bring(false); return !title.active && NET.status === 'on'; }, !!look.girl);
    if (ok) break; await wait(250);
  }
  const st = await p.evaluate(() => ({ status: NET.status, me: NET.me }));
  if (st.me !== name) throw new Error('real kid ' + name + ' did not come in: ' + JSON.stringify(st));
  // each knight in his own gear, so the pictures show who sits where (the local world's knights only)
  await p.evaluate(([gear, girl]) => { Object.assign(player.equip, gear || {}); if (girl) player.gender = 'girl'; recomputeMaxHp(); player.hp = player.maxHp; }, [look.gear || null, !!look.girl]);
  p.kid = name; p.ipad = !!ipad;
  return p;
}
// quiet, for the pictures: no talk page, no banners, no notices from the opening, no monsters after anyone
const calm = page => page.evaluate(() => { window.__peace = true; dialog.cur = null; dialog.queue.length = 0; levelBanner = null; areaBanner = null; closePanel(); for (const m of monsters) if (m.state === 'chase') m.state = 'return'; });
const ride = page => page.evaluate(() => (RIDE.state.ride ? { d: RIDE.state.ride.d, s: RIDE.state.ride.s } : null));
const said = page => page.evaluate(() => (notice ? notice.text : null));
const until = async (page, fn, arg, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await wait(100); } return false; };

(async () => {
  const st0 = await api('GET', '/api/status');
  if (st0.status !== 200) { console.error('ride-browser: no local world answers at ' + BASE); process.exit(1); }
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  try {
    const mud = await realKid(browser, 'Mudtech', false, { gear: { helm: 'iron_helm', body: 'iron_body' } });
    const ben = await realKid(browser, 'Ben', false, { gear: { helm: 'bronze_helm', body: 'bronze_body', shield: 'bronze_shield' } });
    const ann = await realKid(browser, 'Ann', true, { girl: true, gear: { body: 'steel_body' } });
    const pages = [mud, ben, ann];
    // the ground: open grass by the Goblin Fields road, read through the Atlas inside the game (tools never hold map numbers)
    const ground = await mud.evaluate(() => {
      const W = ATLAS.world, cx = W.tx(60), cy = W.ty(26), plain = t => t === T.GRASS || t === T.DIRT || t === T.SAND;
      for (let r = 0; r < 140; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy; let ok = inMap(x - 3, y - 3) && inMap(x + 12, y + 3);
        for (let yy = y - 3; yy <= y + 3 && ok; yy++) for (let xx = x - 3; xx <= x + 12 && ok; xx++) if (!plain(tileAt(xx, yy)) || insideBuilding(xx, yy) || ATLAS.onMainRoad(xx, yy)) ok = false;
        if (ok && !inVillageBounds(tc(x), tc(y))) return [x, y];
      }
      return null;
    });
    if (!ground) throw new Error('no open ground');
    const [gx, gy] = ground;
    const put = (page, tx, ty, fx, fy) => page.evaluate(([tx, ty, fx, fy]) => { FANGLANDS.tp(tx, ty); player.facing = { x: fx, y: fy }; player.hp = player.maxHp; }, [tx, ty, fx, fy]);
    for (const p of pages) await calm(p);
    const mv0 = (await admin('GET', '/api/admin/sim')).data;

    const MACHINES = [
      { kind: 'dozer', what: 'bulldozer', seats: 2, board: tx => `changeTile(${tx}, ${gy}, T.DOZER); player.dozerUp = {};` },
      { kind: 'walker', what: 'walker', seats: 1, board: tx => `changeTile(${tx}, ${gy}, T.MECH);` },
      { kind: 'beast', what: 'Barrelbeast', seats: 2, board: null },
    ];
    for (const M of MACHINES) {
      const x0 = gx;
      // the driver climbs in (E on the machine), or into the Barrelbeast he has already won
      await put(mud, x0, gy, 1, 0); await calm(mud);
      if (M.board) { await mud.evaluate(code => { (0, eval)(code); }, M.board(x0 + 1)); await mud.keyboard.press('e'); }
      else await mud.evaluate(() => { player.mech = { kind: 'beast', hp: 300, maxHp: 300 }; player.r = 26; player.speed = 100; player.facing = { x: 1, y: 0 }; });
      const inIt = await until(mud, k => !!player.mech && (player.mech.kind || 'walker') === k, M.kind);
      // the friends walk up beside it (tp: the pages start in the cave), and every screen sees every knight there
      const at = await mud.evaluate(() => [Math.floor(player.x / TILE), Math.floor(player.y / TILE)]);
      await put(ben, at[0], at[1] + 1, 0, -1); await put(ann, at[0], at[1] - 1, 0, 1);
      for (const p of pages) await calm(p);
      const seen = await until(ben, () => !!RIDE.hopTarget(), null, 10000) && await until(ann, () => !!RIDE.hopTarget(), null, 10000);
      const faceBen = await ben.evaluate(() => { const f = HK.face('use'); return f ? f.id : null; });
      // Ben: the E key. Ann: a finger on the USE seat, which reads HOP ON
      await ben.keyboard.press('e');
      const benOn = await until(ben, () => !!RIDE.state.ride);
      await ann.evaluate(() => render());
      const seat = await ann.evaluate(() => { const f = HK.face('use'), s = HK.seat('use'); return { id: f && f.id, ribbon: f && (typeof f.ribbon === 'function' ? f.ribbon() : f.ribbon), x: s && s.x, y: s && s.y, r: s && s.r }; });
      await ann.touchscreen.tap(seat.x, seat.y);
      await wait(700);
      const annRide = await ride(ann), annSaid = await said(ann);
      const benRide = await ride(ben);
      line(`${M.kind}: Mudtech climbs in; Ben (E) and Ann (a tap on the iPad's ${seat.ribbon || '?'} seat) hop on: ` + (M.seats === 2 ? 'Ben in seat 1, Ann in seat 2' : `Ben in its one seat, Ann reads "Mudtech's ${M.what} is full."`),
        inIt && seen && faceBen === 'hopon' && benOn && seat.id === 'hopon' && seat.r >= 22 && JSON.stringify(benRide) === '{"d":"Mudtech","s":1}'
          && (M.seats === 2 ? JSON.stringify(annRide) === '{"d":"Mudtech","s":2}' : annRide === null && annSaid === `Mudtech's ${M.what} is full.`),
        { inIt, seen, faceBen, seat, benRide, annRide, annSaid });
      // the driver's screen lists them; everyone's screen has them in their seats
      await wait(600);
      const onMud = await mud.evaluate(() => RIDE.ridersOf(NET.me).map(r => r.n + ':' + r.s).join(','));
      const onAnn = await ann.evaluate(() => { const e = PLAYERS.remote.Ben; return e && e.ride ? e.ride.d + ':' + e.ride.s : null; });
      line(`${M.kind}: the driver's screen counts ${M.seats === 2 ? 'both riders' : 'Ben'} and Ann's screen shows Ben riding`, onMud === (M.seats === 2 ? 'Ben:1,Ann:2' : 'Ben:1') && onAnn === 'Mudtech:1', { onMud, onAnn });
      // he drives: everyone's knight goes along
      // nothing wandering in the road ahead (a boar in the way stops a machine; this is about the riders)
      // (distances in tiles, counted by `px`: sizes, never places)
      for (const p of pages) await p.evaluate(() => { const px = n => n * TILE; for (const m of monsters) if (!m.dead && Math.abs(m.y - player.y) < px(4) && m.x > player.x - px(2) && m.x < player.x + px(12)) { const s = safeSpot(m.x, m.y - px(10), m.r, 'beast'); if (s) { m.x = s.x; m.y = s.y; m.state = 'idle'; m.wander = { x: 0, y: 0 }; m.wanderT = 9; } } });
      const before = await mud.evaluate(() => { const px = n => n * TILE; return { panel, paused, ahead: [1, 2, 3, 4].map(i => tileName(tileAt(Math.floor(player.x / TILE) + i, Math.floor(player.y / TILE)))), mech: player.mech && player.mech.kind, near: monsters.filter(m => !m.dead && Math.hypot(m.x - player.x, m.y - player.y) < px(4)).map(m => m.type) }; });
      const p0 = await Promise.all(pages.map(p => p.evaluate(() => ({ x: player.x, y: player.y }))));
      await mud.keyboard.down('d'); await wait(1500); await mud.keyboard.up('d'); await wait(800);
      const p1 = await Promise.all(pages.map(p => p.evaluate(() => ({ x: player.x, y: player.y }))));
      const moved = p1.map((q, i) => Math.round(q.x - p0[i].x));
      const benSeat = await ben.evaluate(() => { const M = RIDE.machineOf('Mudtech'); const s = M && RIDE.seatWorld(M, RIDE.state.ride ? RIDE.state.ride.s : 1); return s && Math.hypot(player.x - s.x, player.y - s.y); });
      const ridersMoved = M.seats === 2 ? Math.abs(moved[1] - moved[0]) < 12 && Math.abs(moved[2] - moved[0]) < 12 : Math.abs(moved[1] - moved[0]) < 12;
      line(`${M.kind}: Mudtech drives on (the D key, 1.5 s) and his riders go with him, each in his seat on his own screen`, moved[0] > 100 && ridersMoved && benSeat !== null && benSeat < 0.5, { moved, benSeat, before });
      // the pictures: every screen as it is, then the driver's and Ben's at the iPad size (touch)
      for (const p of pages) await calm(p);
      await wait(300);
      await shot(mud, `${M.kind}-driver-1280x800`); await shot(ben, `${M.kind}-rider-ben-1280x800`); if (M.seats === 2) await shot(ann, `${M.kind}-rider-ann-ipad-1180x820`);
      for (const p of [mud, ben]) { await p.setViewportSize(IPAD); await p.evaluate(() => { window.__forceTouch = true; }); await calm(p); }
      await wait(500);
      await shot(mud, `${M.kind}-driver-ipad-1180x820`); await shot(ben, `${M.kind}-rider-ben-ipad-1180x820`);
      for (const p of [mud, ben]) { await p.setViewportSize(DESK); await p.evaluate(() => { window.__forceTouch = false; }); }
      await wait(300);
      // the driver climbs out (X): every rider is set down on free ground beside the machine, and told why
      await mud.keyboard.press('x');
      const down = await until(ben, () => !RIDE.state.ride, null, 6000) && await until(ann, () => !RIDE.state.ride, null, 6000);
      const safe = await Promise.all([ben, ann].map(p => p.evaluate(() => !collides(player.x, player.y, 13, 'beast') && !collides(player.x, player.y, 13, 'player') && tileAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE)) !== T.WATER)));
      const words = await said(ben);
      line(`${M.kind}: Mudtech climbs out (X) and his riders are set down on free ground beside the ${M.what} ("Mudtech got out of the ${M.what}. You hop down.")`, down && safe.every(Boolean) && words === `Mudtech got out of the ${M.what}. You hop down.`, { down, safe, words });
      // clear the parked machine and its knight for the next one
      await mud.evaluate(() => { player.mech = null; player.r = 13; player.speed = 175; for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const tx = Math.floor(player.x / TILE) + x, ty = Math.floor(player.y / TILE) + y; const t = tileAt(tx, ty); if (t === T.DOZER || t === T.MECH || t === T.WRECK || (window.BEAST && (t === BEAST.tiles.BEAST))) changeTile(tx, ty, T.GRASS); } });
    }
    const mv1 = (await admin('GET', '/api/admin/sim')).data;
    const counts = v => v && v.move && v.move.today ? { speed: v.move.today.speed, wall: v.move.today.wall, checked: v.move.today.checked } : null;
    const a = counts(mv0), b = counts(mv1);
    line('the world\'s movement check judged the riders and counted no speed and no wall', !!a && !!b && b.checked > a.checked && b.speed === a.speed && b.wall === a.wall, { before: a, after: b });
    const errors = pages.map(p => p.errors.length);
    line('no page threw', errors.every(n => n === 0), { errors, first: pages.map(p => p.errors[0]).filter(Boolean).slice(0, 2) });
  } finally { await browser.close(); }
  const bad = results.filter(r => !r).length;
  console.log((bad ? `${bad} FAILED of ${results.length}` : `ALL ${results.length} PASS`) + ' (' + BASE + ')');
  console.log('screenshots:\n' + shots.join('\n'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
