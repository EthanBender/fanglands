#!/usr/bin/env node
// tools/teacher-browser.mjs — the teacher view, round 2, in a REAL browser against a LOCAL world (docs/ONLINE.md, "The
// teacher view"). It starts nothing itself: in online/, with online/.dev.vars holding ADMIN_KEY and INVITE_CODE, run
//   cp ../index.html public/index.html
//   CI=1 wrangler dev -c wrangler.local.toml --port 8787 --ip 127.0.0.1 --compatibility-date 2026-05-22
// then, from the repo root:
//   node tools/teacher-browser.mjs           every check (PASS/FAIL lines; exit 1 on a FAIL), screenshots in OUT
// OUT defaults to ~/.fanglands/work/teacher/r2. BASE defaults to http://127.0.0.1:8787 and must be a local address.
// What it proves, in order: the owner makes a teacher on /admin; the teacher signs in on the game's own card and gets the
// teacher screen (never the game); the screen fills the window at 14 sizes x 5 browser zooms (and on a touch iPad), every
// control in its pane, nothing clipped, every target 44 px, the map's canvas the size of its pane, no two map names over each
// other; a divider dragged comes back after a reload; an iPad turned; Watch on a kid out in the world and inside the Spider
// Den, live while he walks and fights, and back to the map; mute, pause, send-off and undo; a page that held a kid's game
// starts again first; the teacher's token reaches no knight route and no admin call; Sign out, idle and midnight end the
// session; what Watch costs. Real kids are real game pages; a crowd of 20 more are bare sockets with made-up addresses.
// Needs playwright-core and a Chromium (found as tools/dom-keys.js finds them; WebKit too when it is installed): without them
// it says so and exits 0. NEVER point it at a real world.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const PW = [process.env.PLAYWRIGHT_CORE, path.join(os.homedir(), '.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core'), path.join(os.homedir(), 'Documents/Eden/node_modules/playwright-core')].filter(Boolean).find(p => fs.existsSync(p));
const EXE = [process.env.CHROMIUM, path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell')].filter(Boolean).find(p => fs.existsSync(p));
if (!PW) { console.log('teacher-browser: SKIPPED (no playwright-core found)'); process.exit(0); }
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) { console.error('teacher-browser: a local world only (' + BASE + ')'); process.exit(1); }
const vars = (() => { try { return fs.readFileSync(path.join(ROOT, 'online/.dev.vars'), 'utf8'); } catch (e) { return ''; } })();
const KEY = process.env.ADMIN_KEY || (/ADMIN_KEY=(.*)/.exec(vars) || [])[1] || 'test-admin', INVITE = process.env.INVITE || (/INVITE_CODE=(.*)/.exec(vars) || [])[1] || 'TEST-1234';
const OUT = process.env.OUT || path.join(os.homedir(), '.fanglands/work/teacher/r2');
fs.mkdirSync(OUT, { recursive: true });
const { chromium, webkit } = require(PW);
const wait = ms => new Promise(r => setTimeout(r, ms));
const results = [], shots = [];
const line = (name, ok, info) => { results.push(!!ok); console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined && !ok ? '   ' + JSON.stringify(info).slice(0, 1400) : '')); };
const note = text => console.log('      ' + text);
const shot = async (page, name) => { const p = path.join(OUT, name + '.png'); await page.screenshot({ path: p }); shots.push(p); note('screenshot ' + p); };

// ---------- the world, from outside ----------
async function api(method, p, body, headers = {}) {
  const r = await fetch(BASE + p, { method, headers: Object.assign({ 'content-type': 'application/json' }, headers), body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch (e) { }
  return { status: r.status, data };
}
const admin = (method, p, body) => api(method, p, body, { authorization: 'Bearer ' + KEY });
let ipN = 0;
const ipNext = () => { ipN++; return '10.79.' + Math.floor(ipN / 200) + '.' + (ipN % 200 + 1); };
async function knight(name) {
  const ip = ipNext();
  let r = await api('POST', '/api/signup', { name, pass: 'sword', invite: INVITE }, { 'cf-connecting-ip': ip });
  if (r.status === 409) r = await api('POST', '/api/login', { name, pass: 'sword' }, { 'cf-connecting-ip': ip });
  // sent off by an earlier run: the owner lets the knight back in (the teacher action's own Undo, from /admin's list)
  if (r.status === 423) {
    const acts = (await admin('GET', '/api/admin/teacher-acts?today=1')).data || [];
    for (const a of acts) if (a.act === 'sendoff' && a.inForce && String(a.target).toLowerCase() === name.toLowerCase()) await admin('POST', '/api/admin/teachers/undo', { act: a.id });
    r = await api('POST', '/api/login', { name, pass: 'sword' }, { 'cf-connecting-ip': ipNext() });
  }
  if (r.status !== 200) throw new Error('knight ' + name + ': ' + r.status + ' ' + JSON.stringify(r.data));
  await admin('POST', '/api/admin/mute', { name, span: 'off' });
  return { name, token: r.data.token };
}
const WORLD_ATLAS = JSON.parse(fs.readFileSync(path.join(ROOT, 'online/src/atlas.json'), 'utf8')).hash;
// a crowd kid: a bare socket that says hello and where it stands, now and then
function bare(k, p) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/ws?token=' + k.token);
    const K = { ws, name: k.name, got: [], p: Object.assign({ map: 'over', x: 6000, y: 3700 }, p), closed: null };
    ws.onmessage = ev => { try { K.got.push(JSON.parse(ev.data)); } catch (e) { } };
    ws.onclose = ev => { K.closed = ev.code; };
    ws.onerror = () => reject(new Error('socket ' + k.name));
    // a game of this world names its Atlas (an older world's page is keyed apart: the Great Spread, online/src/room.js mapKey)
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', v: 1, atlas: WORLD_ATLAS })); K.say(); resolve(K); };
    K.say = extra => { if (ws.readyState === 1) ws.send(JSON.stringify(Object.assign({ t: 'p', region: 'Somewhere', lv: 10, mv: false, sw: 0, act: null, mech: null, dead: false }, K.p, extra || {}))); };
    K.chat = text => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'chat', text })); };
  });
}
// Where the kids stand, read through the Atlas inside the game this world serves (docs/spread/README.md: a tool reads the
// Atlas inside the game it drives), so every spot follows its place when the map is spread. Tiles: [x, y].
async function spotsFromGame(browser) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(BASE + '/?online');
  await p.waitForFunction(() => window.ATLAS && typeof ATLAS.frame === 'function', null, { timeout: 20000 });
  // inn: Hollowford's square (seven kids on one tile); crowd: by the place names, two out in the stretched land; sam and ava:
  // side by side in Thistledown
  const at = await p.evaluate(`(() => {
    const F = id => ATLAS.frame(id), W = ATLAS.world;
    return {
      inn: F('hollowford').p(125, 77),
      crowd: [F('thistledown').p(101, 28), F('signpost').p(68, 29), F('quarry').p(54, 7), F('cave').p(10, 7), W.p(180, 78), F('far_shore').p(225, 64),
        F('thistledown').p(112, 48), F('far_shore').p(247, 85), F('far_shore').p(232, 33), F('sylvaris').p(146, 124), W.p(174, 155)],
      sam: F('thistledown').p(100, 30), ava: F('thistledown').p(102, 31),
    };
  })()`);
  await ctx.close();
  return at;
}
// a real kid: the game itself, logged in on its card
async function realKid(browser, name, opts = {}) {
  await knight(name);   // the knight exists (and is unmuted)
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1000, height: 700 } });
  const p = await ctx.newPage();
  p.errors = []; p.on('pageerror', e => p.errors.push(String(e)));
  await p.goto(BASE + '/?online');
  await p.waitForSelector('#fl-name', { state: 'visible', timeout: 20000 });
  await p.fill('#fl-name', name); await p.fill('#fl-pass', 'sword');
  await p.click('#fl-login button[type=submit]');
  for (let i = 0; i < 80; i++) {
    const ok = await p.evaluate(() => { if (window.BOYGIRL && BOYGIRL.asking) BOYGIRL.answer('boy'); if (window.LOGIN && LOGIN.mode === 'offer') LOGIN.bring(false); return !title.active && NET.status === 'on'; });
    if (ok) break; await wait(250);
  }
  const st = await p.evaluate(() => ({ status: NET.status, me: NET.me }));
  if (st.me !== name) throw new Error('real kid ' + name + ' did not come in: ' + JSON.stringify(st));
  if (opts.at) await p.evaluate(([x, y]) => { player.x = x; player.y = y; }, opts.at);
  return p;
}
async function teacherRow(name, pass) {
  const all = (await admin('GET', '/api/admin/teachers')).data || {};
  const t = (all.teachers || []).find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!t) return (await admin('POST', '/api/admin/teachers', { name, pass })).data.id;
  await admin('POST', t.off ? '/api/admin/teachers/on' : '/api/admin/teachers/pass', { id: t.id, pass });
  return t.id;
}
// the teacher on the game's own card: her name in Knight's name, her password in Secret word, Play. Answers the session token
// as the world sent it (read off the network: the page itself keeps it where no script can reach it)
async function signInCard(page, name, pass, wantScreen = true) {
  if (!/\/\?online$/.test(page.url())) await page.goto(BASE + '/?online');
  await page.waitForSelector('#fl-name', { state: 'visible', timeout: 20000 });
  await page.fill('#fl-name', name); await page.fill('#fl-pass', pass);
  const answer = page.waitForResponse(r => r.url().endsWith('/api/login') && r.request().method() === 'POST', { timeout: 20000 });
  await page.click('#fl-login button[type=submit]');
  let token = null; try { const j = await (await answer).json(); token = j && j.teacher ? j.token : null; } catch (e) { }
  if (wantScreen) await page.waitForFunction(() => window.TEACHERSCREEN && TEACHERSCREEN.screen && TEACHERSCREEN.screen.peek().status === 'live', null, { timeout: 20000 });
  return token;
}
const peek = page => page.evaluate(() => TEACHERSCREEN.screen.peek());

// ---------- the page, measured (in the browser) ----------
const MEASURE = () => {
  const out = { problems: [] }, P = out.problems;
  const vis = e => { if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none') return false; for (let x = e; x; x = x.parentElement) if (x.hidden) return false; return true; };
  const R = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const tv = document.getElementById('tv'); out.tv = R(tv); out.w = innerWidth; out.h = innerHeight;
  if (Math.abs(out.tv.l) > 1 || Math.abs(out.tv.t) > 1 || Math.abs(out.tv.w - innerWidth) > 1 || Math.abs(out.tv.h - innerHeight) > 1) P.push('the screen is not the window: ' + JSON.stringify(out.tv));
  if (document.documentElement.scrollWidth > innerWidth + 0.5 || document.body.scrollWidth > innerWidth + 0.5) P.push('horizontal page scroll');
  const panes = Array.from(document.querySelectorAll('#tv .pane, #tv-bar, #tv-switch, #tv-sheet, #tv-toast, #tv-banners')).filter(vis);
  const paneOf = e => { for (let x = e; x; x = x.parentElement) if (panes.includes(x)) return x; return null; };
  const scrollOf = e => { for (let x = e.parentElement; x && x !== tv; x = x.parentElement) { const cs = getComputedStyle(x); if (/(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflowX)) return x; } return null; };
  const targets = Array.from(tv.querySelectorAll('button, [role=button], [role=separator]')).filter(vis);
  for (const e of targets) {
    const r = R(e), name = (e.getAttribute('aria-label') || e.textContent || e.id || e.className).trim().slice(0, 40);
    if (e.getAttribute('role') === 'separator') { const g = R(e.querySelector('.grab')); if (Math.min(g.w, g.h) < 43.5 && Math.max(g.w, g.h) < 43.5) P.push('small grab: ' + name); if ((e.classList.contains('v') ? g.w : g.h) < 43.5) P.push('divider grab under 44: ' + name + ' ' + Math.round(g.w) + 'x' + Math.round(g.h)); continue; }
    if (r.w < 43.5 || r.h < 43.5) P.push('small: ' + name + ' ' + Math.round(r.w) + 'x' + Math.round(r.h));
    if (e.tagName === 'BUTTON' && e.scrollWidth > e.clientWidth + 1) P.push('clipped: ' + name);
    const pane = paneOf(e); if (!pane) { P.push('outside every pane: ' + name); continue; }
    const pr = R(pane), sc = scrollOf(e);
    if (r.l < pr.l - 1 || r.r > pr.r + 1) P.push('out of its pane sideways: ' + name);
    if (sc) { const s = R(sc); if (sc.scrollWidth > sc.clientWidth + 1) P.push('a list scrolls sideways: ' + (sc.id || sc.className)); if (r.l < s.l - 1 || r.r > s.r + 1) P.push('out of its list sideways: ' + name); }
    else if (r.t < pr.t - 1 || r.b > pr.b + 1) P.push('cut off in its pane: ' + name + ' ' + JSON.stringify([Math.round(r.t), Math.round(r.b), Math.round(pr.t), Math.round(pr.b)]));
  }
  // buttons 8 px apart (rows are full-width list entries)
  const bs = targets.filter(e => e.tagName === 'BUTTON' && !scrollOf(e)).map(e => ({ e, r: e.getBoundingClientRect() }));
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const a = bs[i].r, b = bs[j].r; if (bs[i].e.contains(bs[j].e) || bs[j].e.contains(bs[i].e)) continue;
    const gap = Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);
    if (gap < 7.5) P.push('close: "' + bs[i].e.textContent.trim().slice(0, 20) + '" / "' + bs[j].e.textContent.trim().slice(0, 20) + '" ' + Math.round(gap) + ' px');
  }
  // the words: none under 13 px, none cut off at a line's end in the bar or a header
  const walker = document.createTreeWalker(tv, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) { if (!n.textContent.trim() || !vis(n.parentElement)) continue; const fs = parseFloat(getComputedStyle(n.parentElement).fontSize); if (fs < 12.9) P.push('tiny text ' + fs + 'px: ' + n.textContent.trim().slice(0, 30)); }
  for (const e of Array.from(tv.querySelectorAll('#tv-bar span, #tv-bar .title, .pane > header h2, #tv-povhead .what')).filter(vis)) if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible') P.push('words cut: ' + e.textContent.slice(0, 30));
  // the map: its canvas is its pane; no two names over each other
  const S = window.TEACHERSCREEN && TEACHERSCREEN.screen ? TEACHERSCREEN.screen.peek() : null;
  // the bar: one row of 48 px from 700 px wide up (two under 700)
  const bar = document.getElementById('tv-bar'); out.bar = Math.round(R(bar).h);
  if (innerWidth >= 700 && out.bar > 49.5) P.push('the bar takes two rows: ' + out.bar + ' px at ' + innerWidth);
  const mb = document.getElementById('tv-mapbox'), cv = document.getElementById('tv-map');
  if (vis(mb)) {
    const a = R(mb), c = R(cv), dpr = Math.min(devicePixelRatio || 1, 2);
    if (Math.abs(a.w - c.w) > 1 || Math.abs(a.h - c.h) > 1) P.push('the map canvas is not its pane');
    if (Math.abs(cv.width - Math.round(a.w * dpr)) > 1 || Math.abs(cv.height - Math.round(a.h * dpr)) > 1) P.push('the map canvas pixels are not the pane x dpr: ' + cv.width + 'x' + cv.height + ' for ' + Math.round(a.w) + 'x' + Math.round(a.h) + ' at ' + dpr);
    out.mapPane = [Math.round(a.w), Math.round(a.h)];
    const D = S && S.drawn ? S.drawn : { labels: [], tags: [], dots: [], clusters: [], obstacles: [] };
    const L = D.labels.concat(D.tags.map(t => Object.assign({ name: 'tag ' + t.n }, t)));
    out.labels = D.labels.map(l => l.name); out.tags = D.tags.length;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const p = L[i], q = L[j]; if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) P.push('names over each other: ' + p.name + ' / ' + q.name); }
    for (const l of L) if (l.x < 0 || l.y < 0 || l.x + l.w > a.w || l.y + l.h > a.h) P.push('a name out of the map: ' + l.name);
    // nothing of the map under its own controls (+, −, Whole map, Key), measured from the page itself
    const ctl = ['tv-zoom', 'tv-keybox'].map(id => document.getElementById(id)).filter(vis).map(e => { const r = R(e); return { x: r.l - a.l, y: r.t - a.t, w: r.w, h: r.h }; });
    for (const o of ctl) {
      for (const c of D.dots.concat(D.clusters)) { const nx = Math.max(o.x, Math.min(c.x, o.x + o.w)), ny = Math.max(o.y, Math.min(c.y, o.y + o.h)); if (Math.hypot(c.x - nx, c.y - ny) < c.r) P.push('a knight under a control: ' + (c.n || c.n)); }
      for (const l of L) if (l.x < o.x + o.w && o.x < l.x + l.w && l.y < o.y + o.h && o.y < l.y + l.h) P.push('a name under a control: ' + l.name);
    }
  }
  out.narrow = !!(S && S.narrow); out.sizes = S && S.sizes;
  return out;
};

const SIZES = [[1280, 800], [1280, 720], [1280, 1024], [1366, 768], [1440, 900], [1536, 864], [1920, 1080], [2560, 1440], [1024, 768], [1180, 820], [768, 1024], [820, 1180], [834, 1194], [390, 844]];
const ZOOMS = [0.8, 1, 1.25, 1.5, 1.75];

async function main() {
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
  const crowd = [];
  let alive = null;
  try {
    // ---- 1. the owner, on /admin, adds a teacher (Make one up) ----
    const owner = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    owner.on('dialog', d => d.accept());
    await owner.goto(BASE + '/admin');
    await owner.fill('#key', KEY); await owner.click('#usekey');
    await owner.waitForSelector('#tname', { timeout: 20000 });
    const tName = 'Mrs Smith ' + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(97 + Math.floor(Math.random() * 26)) + String.fromCharCode(97 + Math.floor(Math.random() * 26));
    await owner.fill('#tname', tName); await owner.click('#tmake');
    const pass = await owner.inputValue('#tpass');
    await owner.click('#tadd');
    await owner.waitForFunction(n => document.getElementById('tsaid').textContent.startsWith('Added ' + n), tName, { timeout: 20000 });
    const said = await owner.textContent('#tsaid');
    line('the owner adds a teacher on /admin; the page says: "' + said + '"', said.includes('Tell ' + tName + ": go to fanglands.com, type " + tName + " in Knight's name and this password in Secret word, and press Play.") && said.includes(pass) && !/teacher\.fanglands|\/teacher/.test(said), { said });
    await owner.evaluate(() => document.getElementById('tsaid').scrollIntoView({ block: 'center' }));
    await shot(owner, '01-admin-teacher-added');

    // ---- 2. kids: a crowd of bare sockets (nine on one tile, some by the place names, two inside places) and two real games ----
    const where = await spotsFromGame(browser), spots = where.crowd, TS = 48;
    for (let i = 0; i < 20; i++) {
      const k = await knight('Kid ' + String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + i % 26));
      // (inside: the Tinker Lab and an island, never the Spider Den: a bare socket there would keep it and stream nothing)
      const p = i < 7 ? { x: Math.round(where.inn[0] * TS) + 20, y: Math.round(where.inn[1] * TS) + 20 } : i === 18 ? { map: 'tinker_lab', x: 300, y: 200 } : i === 19 ? { map: 'house', x: 300, y: 300 } : { x: Math.round(spots[i - 7][0] * TS), y: Math.round(spots[i - 7][1] * TS) };
      crowd.push(await bare(k, p));
    }
    alive = setInterval(() => { for (const k of crowd) k.say(); }, 1000);
    crowd[1].chat('anyone want to fight goblins'); await wait(1600); crowd[2].chat('meet me at the dock'); await wait(1600);
    // (Sam on a 1366 x 768 laptop: wider than the teacher's middle pane, so Fit must show his whole screen, letterboxed)
    const sam = await realKid(browser, 'Sam', { at: [Math.round(where.sam[0] * TS), Math.round(where.sam[1] * TS)], viewport: { width: 1366, height: 768 } });
    const ava = await realKid(browser, 'Ava', { at: [Math.round(where.ava[0] * TS), Math.round(where.ava[1] * TS)] });
    await wait(1500);

    // ---- 3. the teacher signs in on the game's own card: the teacher screen, never the game ----
    const tctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const tp = await tctx.newPage();
    tp.errors = []; tp.on('pageerror', e => tp.errors.push(String(e)));
    await tp.goto(BASE + '/?online');
    await tp.waitForSelector('#fl-name', { state: 'visible' });
    await shot(tp, '02-the-standard-card');
    let tToken = await signInCard(tp, tName, pass);
    await tp.waitForFunction(n => TEACHERSCREEN.screen.peek().knights.length >= n, 22, { timeout: 20000 }); await wait(800);
    const mode = await tp.evaluate(() => ({ title: title.active, lock: SAVE_LOCK, net: NET.enabled, token: NET.token, sock: !!NET.sock, canvas: getComputedStyle(canvas).display, card: !document.getElementById('fl-login') || document.getElementById('fl-login').hidden, ls: Object.keys(localStorage).filter(k => /session|lastname|slot/.test(k)), ss: Object.keys(sessionStorage), url: location.href }));
    line('the teacher signs in on the standard card (Knight\'s name, Secret word, Play) and gets the teacher screen: no knight, no socket of a knight\'s, nothing saved, the address unchanged', mode.title && mode.lock && !mode.net && mode.token === null && !mode.sock && mode.canvas === 'none' && mode.card && mode.ls.length === 0 && mode.ss.length === 0 && mode.url === BASE + '/?online', mode);
    await shot(tp, '03-teacher-screen-1280x800');

    // ---- 4. the screen at 14 sizes x 5 browser zooms (a zoom is a smaller CSS window at a higher pixel ratio) ----
    let bad = 0, runs = 0;
    for (const z of ZOOMS) {
      const ctx = z === 1 ? tctx : await browser.newContext({ viewport: { width: Math.round(1280 / z), height: Math.round(800 / z) }, deviceScaleFactor: z });
      const page = z === 1 ? tp : await ctx.newPage();
      if (z !== 1) { await signInCard(page, tName, pass); await page.waitForFunction(() => TEACHERSCREEN.screen.peek().knights.length >= 20, null, { timeout: 20000 }); }
      for (const [w, h] of SIZES) {
        await page.setViewportSize({ width: Math.round(w / z), height: Math.round(h / z) }); await wait(250);
        const m = await page.evaluate(MEASURE); runs++;
        const ok = m.problems.length === 0 && (w / z < 900 ? m.narrow : true);
        if (!ok) bad++;
        line(w + 'x' + h + ' at ' + Math.round(z * 100) + '% (' + Math.round(w / z) + 'x' + Math.round(h / z) + ' CSS px): fills the window, every control in its pane, nothing clipped, 44 px targets, the canvas is its pane, no two names over each other (' + (m.labels || []).length + ' names)', ok, { problems: m.problems.slice(0, 10), total: m.problems.length, narrow: m.narrow });
        if (z === 1 && [1280, 1024, 768, 390, 1920].includes(w) && [800, 768, 1024, 844, 1080].includes(h)) await shot(page, '04-size-' + w + 'x' + h);
        // the window the class reviewer used (1280 x 650 at 125%: 1024 x 520 CSS px): the big places still named with the class on
        if (z === 1.25 && w === 1280 && h === 800) {
          await page.setViewportSize({ width: 1024, height: 520 }); await wait(400);
          const m2 = await page.evaluate(MEASURE);
          // (the Great Spread: at this window's whole map the 400 x 280 world draws Thistledown a third smaller, and the kids standing
          // in it (Sam, Ava and one of the crowd) make one count circle in its middle, so its name gives way to them, as any name
          // does; it is named one zoom step in: online/test/teacher-labels.test.mjs, 'a class on the map')
          line('1280x650 at 125% (1024x520 CSS px), 20 kids on: no knight, tag or name under the map\'s controls, the bar one row (' + m2.bar + ' px), and the big places named (' + (m2.labels || []).join(', ') + ')', m2.problems.length === 0 && ['The Jungle', 'Goblin Fields', 'Wolfwood'].every(n => (m2.labels || []).includes(n)), { problems: m2.problems.slice(0, 8), labels: m2.labels });
          await shot(page, '04b-1280x650-at-125');
        }
      }
      if (z !== 1) await ctx.close();
      else await page.setViewportSize({ width: 1280, height: 800 });
    }
    line('the layout held at all ' + runs + ' sizes and zooms', bad === 0 && runs === SIZES.length * ZOOMS.length, { bad, runs });
    // a touch iPad: coarse pointer (20 px dividers), upright and sideways
    {
      const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
      const ip = await ctx.newPage(); await signInCard(ip, tName, pass); await wait(600);
      const up = await ip.evaluate(MEASURE);
      line('iPad upright (820x1180, touch): narrow, the map on top, every target 44 px', up.problems.length === 0 && up.narrow, up.problems.slice(0, 8));
      await shot(ip, '05-ipad-upright');
      await ip.setViewportSize({ width: 1180, height: 820 }); await wait(400);
      const side = await ip.evaluate(MEASURE);
      line('the iPad turned sideways (1180x820): three panes, the coarse dividers, nothing clipped', side.problems.length === 0 && !side.narrow && side.sizes && side.sizes.d === 20, { p: side.problems.slice(0, 8), sizes: side.sizes });
      await shot(ip, '06-ipad-sideways');
      await ctx.close();
    }

    // ---- 5. a divider dragged, remembered after a reload ----
    {
      const d = await tp.$('#tv-panes .div.v'); const b = await d.boundingBox();
      await tp.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await tp.mouse.down(); await tp.mouse.move(b.x + b.width / 2 + 90, b.y + b.height / 2, { steps: 6 }); await tp.mouse.up();
      await wait(500);
      const w1 = await tp.evaluate(() => Math.round(document.getElementById('tv-chat').getBoundingClientRect().width));
      const saved = await tp.evaluate(() => localStorage.getItem('fanglands.teacher.layout'));
      await tp.reload(); await tp.waitForSelector('#fl-name', { state: 'visible' });
      const card = await tp.evaluate(() => ({ err: document.querySelector('#fl-login .fl-err').textContent, tv: !!document.getElementById('tv') }));
      await signInCard(tp, tName, pass); await wait(500);
      const w2 = await tp.evaluate(() => Math.round(document.getElementById('tv-chat').getBoundingClientRect().width));
      line('a divider dragged 90 px (chat ' + w1 + ' px) is saved as fractions and comes back after a reload (' + w2 + ' px); a reloaded tab shows the card, never the screen', Math.abs(w1 - 307 - 90) <= 2 && Math.abs(w2 - w1) <= 1 && /"wide":\{"l":0\.3/.test(saved) && !card.tv, { w1, w2, saved, card });
      await tp.dblclick('#tv-panes .div.v'); await wait(300);
    }

    // ---- 6. Watch: Sam out in the world, walking; then in the Spider Den, fighting; then back to the map ----
    await tp.waitForFunction(() => TEACHERSCREEN.screen.peek().knights.includes('Sam'), null, { timeout: 15000 });
    const samRow = tp.locator('#tv-who .row', { hasText: 'Sam' }).first();
    await samRow.locator('button:has-text("Watch")').click();
    await tp.waitForFunction(() => window.VIEW && VIEW.state.on && VIEW.state.lastP, null, { timeout: 10000 });
    // Watch on his row opens his Knight card too (wide): his Mute and Send off are on screen while watching
    {
      const card = await tp.evaluate(() => { const c = document.getElementById('tv-card'), r = c.getBoundingClientRect(); return { shown: !c.hidden && r.height > 0, text: c.textContent, sel: TEACHERSCREEN.screen.peek().selected }; });
      line('Watch on Sam\'s row opens his Knight card at the top of Who is on, with Mute 10 min and Send off for today', card.shown && card.sel === 'Sam' && /Mute 10 min/.test(card.text) && /Send off for today/.test(card.text), card);
    }
    await sam.bringToFront(); await sam.keyboard.down('ArrowRight'); await wait(1500); await sam.keyboard.up('ArrowRight'); await wait(1500);
    await tp.bringToFront(); await wait(300);
    const centre = await tp.evaluate(() => { const V = VIEW.state, e = PLAYERS.remote[V.n], k = V.scale; return { dx: Math.round((e.shown.x - cam.x) * k + V.offX - V.paneW / 2), dy: Math.round((e.shown.y - cam.y) * k + V.offY - V.paneH / 2), what: document.querySelector('#tv-povhead .what').textContent, live: !document.querySelector('#tv-povhead .live').hidden, frames: V.stats }; });
    // Fit is his whole screen: the teacher's world rectangle is the one his camera shows (he stands still)
    {
      const kid = await sam.evaluate(() => ({ x: cam.x, y: cam.y, w: VW, h: VH }));
      const t = await tp.evaluate(() => ({ x: cam.x, y: cam.y, w: VW, h: VH, zoom: VIEW.state.zoom }));
      line('Watch at Fit shows exactly Sam\'s screen: his camera ' + JSON.stringify(kid) + ', the teacher\'s ' + JSON.stringify(t) + ' (within 1 px)', t.zoom === 1 && Math.abs(kid.x - t.x) <= 1 && Math.abs(kid.y - t.y) <= 1 && Math.abs(kid.w - t.w) <= 1 && Math.abs(kid.h - t.h) <= 1, { kid, t });
    }
    // the names on his screen: at least 13 CSS px tall however small his screen is drawn here (measured off the canvas calls)
    const nameSize = async page => page.evaluate(async () => {
      // (the game's own context carries its own fillText, so the spy goes on it, not on the prototype)
      const C = ctx, own = Object.prototype.hasOwnProperty.call(C, 'fillText'), f0 = C.fillText, seen = [];
      C.fillText = function (txt, x, y) { if (txt === 'Sam' || txt === 'Ava') { const m = /(\d+(?:\.\d+)?)px/.exec(this.font), a = this.getTransform().a; seen.push(+m[1] * a / (canvas.width / canvas.getBoundingClientRect().width)); } return f0.apply(this, arguments); };
      await new Promise(r => setTimeout(r, 400)); if (own) C.fillText = f0; else delete C.fillText;
      return seen.length ? Math.min(...seen) : 0;
    });
    {
      const px = await nameSize(tp);
      line('the knights\' names in Watch at 1280x800 are ' + px.toFixed(1) + ' CSS px tall (13 at the least)', px >= 13, px);
    }
    const samAt = await sam.evaluate(() => ({ x: Math.round(player.x), y: Math.round(player.y) }));
    const shown = await tp.evaluate(() => ({ x: Math.round(PLAYERS.remote[VIEW.state.n].x), y: Math.round(PLAYERS.remote[VIEW.state.n].y) }));
    line('Watch Sam: his screen is drawn in the middle pane, live: he is within 8 px of its centre (' + centre.dx + ', ' + centre.dy + '), where his own game has him, and the header says "' + centre.what + '"', Math.abs(centre.dx) <= 8 && Math.abs(centre.dy) <= 8 && Math.abs(samAt.x - shown.x) <= 48 && centre.live && /^Watching Sam/.test(centre.what), { centre, samAt, shown });
    await shot(tp, '07-watch-sam-overworld');
    // into the Spider Den, beside a spider, swinging
    await sam.evaluate(() => { INSTANCES.enter('spider_den'); });
    await wait(800);
    await sam.evaluate(() => { const m = monsters.find(o => !o.dead); if (m) { player.x = m.x - 40; player.y = m.y; player.facing = { x: 1, y: 0 }; } });
    for (let i = 0; i < 8; i++) { await sam.keyboard.press('Space'); await wait(250); }
    await wait(1200);
    const den = await tp.evaluate(() => ({ map: VIEW.state.map, inst: INSTANCES.active(), puppets: (COOP.puppets() || []).length, what: document.querySelector('#tv-povhead .what').textContent, house: VIEW.state.house }));
    line('Sam goes into the Spider Den and fights: the view follows him in ("' + den.what + '"), the den is drawn as his game built it, his spiders show (' + den.puppets + ')', den.map === 'spider_den' && den.inst === 'spider_den' && den.puppets > 0 && /The Spider Den/.test(den.what), den);
    await shot(tp, '08-watch-sam-spider-den');
    // a tap on his screen does nothing in his game: it picks him
    const before = await sam.evaluate(() => ({ x: player.x, y: player.y }));
    const gb = await (await tp.$('#tv-glass')).boundingBox();
    const at = await tp.evaluate(() => { const V = VIEW.state, e = PLAYERS.remote[V.n], k = V.scale; return { x: (e.shown.x - cam.x) * k + V.offX, y: (e.shown.y - 6 - cam.y) * k + V.offY }; });
    await tp.mouse.click(gb.x + at.x, gb.y + at.y); await wait(400);
    const after = await sam.evaluate(() => ({ x: player.x, y: player.y }));
    const picked = (await peek(tp)).selected;
    line('a tap on his screen picks him (his Knight card) and changes nothing in his game', picked === 'Sam' && Math.abs(after.x - before.x) < 1 && Math.abs(after.y - before.y) < 1, { picked, before, after });
    // an iPad upright, watching: his screen gets at least 45% of the window, his names stay readable
    for (const [w, h] of [[768, 1024], [820, 1180]]) {
      await tp.setViewportSize({ width: w, height: h }); await wait(700);
      const box = await tp.evaluate(() => { const r = document.getElementById('tv-watchbox').getBoundingClientRect(); return { h: Math.round(r.height), share: r.height / innerHeight, bar: Math.round(document.getElementById('tv-bar').getBoundingClientRect().height), head: Math.round(document.getElementById('tv-povhead').getBoundingClientRect().height) }; });
      const px = await nameSize(tp);
      line('watching on an iPad upright ' + w + 'x' + h + ': his screen is ' + Math.round(box.share * 100) + '% of the window (45% at the least; bar ' + box.bar + ' px, header ' + box.head + ' px), names ' + px.toFixed(1) + ' CSS px', box.share >= 0.45 && px >= 13 && box.bar <= 49.5, { box, px });
      await shot(tp, '08b-watch-ipad-' + w + 'x' + h);
    }
    for (const [w, h] of [[1180, 820], [1024, 690]]) {
      await tp.setViewportSize({ width: w, height: h }); await wait(600);
      const px = await nameSize(tp);
      line('watching on an iPad sideways ' + w + 'x' + h + ': names ' + px.toFixed(1) + ' CSS px (13 at the least)', px >= 13, px);
    }
    await tp.setViewportSize({ width: 1280, height: 800 }); await wait(500);
    await tp.keyboard.press('Escape'); await wait(500);
    const back = await tp.evaluate(() => ({ on: VIEW.state.on, map: !document.getElementById('tv-mappane').hidden, canvas: getComputedStyle(canvas).display }));
    line('Esc (Back to the map) brings the map back and stops the view', !back.on && back.map && back.canvas === 'none', back);
    await shot(tp, '09-back-to-the-map');
    await sam.evaluate(() => { INSTANCES.leave(); });

    // ---- 7. mute, undo; pause, chat back on; send off, let back in ----
    // (Sam's card is open from the tap on his screen; a tap on his row would close it again)
    if ((await peek(tp)).selected !== 'Sam') await samRow.click();
    await wait(300);
    await tp.click('#tv-card button:has-text("Mute 10 min")'); await wait(1200);
    const muted = await sam.evaluate(() => CHAT.muted());
    const toast = await tp.textContent('#tv-toast');
    line('Mute 10 min from Sam\'s Knight card: his game is muted (' + muted + ' s) and the toast says "' + toast.replace('Undo', '').trim() + '" with Undo', muted > 590 && /Sam is muted for 10 minutes/.test(toast) && /Undo/.test(toast), { muted, toast });
    await shot(tp, '10-sam-muted');
    await tp.click('#tv-toast button:has-text("Undo")'); await wait(1200);
    line('Undo gives Sam his chat back', (await sam.evaluate(() => CHAT.muted())) === 0);
    await tp.click('#tv-chatfoot button:has-text("5 minutes")'); await wait(1200);
    const paused = await ava.evaluate(() => TEACHER.pausedLeft());
    line('Pause chat for everyone, 5 minutes: Ava\'s game counts it down (' + paused + ' s) and the banner says who paused it', paused > 290 && (await tp.textContent('#tv-banners')).includes('paused it'), { paused });
    await shot(tp, '11-chat-paused');
    await tp.click('#tv-banners button:has-text("Turn chat back on")'); await wait(1200);
    line('Turn chat back on: Ava\'s game says chat is on', (await ava.evaluate(() => TEACHER.pausedLeft())) === 0);
    await tp.locator('#tv-who .row', { hasText: 'Ava' }).first().click(); await wait(300);
    await tp.click('#tv-card button:has-text("Send off for today")');
    const ask = await tp.textContent('#tv-card');
    await shot(tp, '12-send-off-asks');
    await tp.click('#tv-card button:has-text("Yes, send Ava off")'); await wait(2500);
    const avaCard = await ava.evaluate(() => ({ playing: LOGIN.playing, err: LOGIN.error, showing: LOGIN.showing }));
    line('Send off takes two taps ("Send Ava off Fanglands until midnight? Ava\'s knight is safe and saved."); Ava\'s game goes back to the card with the sentence', /Send Ava off Fanglands until midnight\? Ava's knight is safe and saved\./.test(ask) && !avaCard.playing && avaCard.err === 'A teacher sent you off Fanglands for the rest of today. Your knight is safe. You can play again tomorrow.', { ask, avaCard });
    await shot(tp, '13-ava-sent-off');
    const so = await api('POST', '/api/login', { name: 'Ava', pass: 'sword' }, { 'cf-connecting-ip': ipNext() });
    line('Ava cannot log in again today (423 sentoff)', so.status === 423 && so.data.code === 'sentoff', so);
    await tp.click('#tv-who button:has-text("Let Ava back in")'); await wait(1200);
    line('Let Ava back in: she can log in again', (await api('POST', '/api/login', { name: 'Ava', pass: 'sword' }, { 'cf-connecting-ip': ipNext() })).status === 200);

    // ---- 8. the teacher's token reaches nothing but the teacher view ----
    {
      // NEGATIVE: the page keeps the token where no script reaches it: not on TEACHERSCREEN, LOGIN, VIEW (deep), what the screen
      // shows (peek), storage, the address or the history
      const kept = await tp.evaluate(tok => {
        const reach = (root, needle) => { const seen = new Set(), stack = [[root, 0]]; while (stack.length) { const [o, d] = stack.pop(); if (typeof o === 'string') { if (o.includes(needle)) return true; continue; } if (!o || (typeof o !== 'object' && typeof o !== 'function') || seen.has(o) || d > 8) continue; seen.add(o); if (o instanceof Node || o === window) continue; let ks = []; try { ks = Object.keys(o); } catch (e) { } for (const k of ks) { let v; try { v = o[k]; } catch (e) { continue; } stack.push([v, d + 1]); } } return false; };
        const out = ['TEACHERSCREEN', 'LOGIN', 'VIEW', 'NET'].filter(g => window[g] && reach(window[g], tok));
        if (JSON.stringify(TEACHERSCREEN.screen.peek()).includes(tok)) out.push('peek');
        if (JSON.stringify(Object.assign({}, localStorage)).includes(tok) || JSON.stringify(Object.assign({}, sessionStorage)).includes(tok)) out.push('storage');
        if (location.href.includes(tok) || JSON.stringify(history.state || null).includes(tok)) out.push('address');
        return out;
      }, tToken);
      line('NEGATIVE: the teacher\'s token (from the world\'s answer) is reachable from none of TEACHERSCREEN, LOGIN, VIEW and NET, nor what the screen shows, storage or the address', !!tToken && kept.length === 0, { kept, token: !!tToken });
      const r = await tp.evaluate(async tok => {
        const h = { authorization: 'Bearer ' + tok, 'content-type': 'application/json' };
        const knight = [['GET', '/api/me'], ['GET', '/api/save'], ['PUT', '/api/save'], ['GET', '/api/save/pin'], ['POST', '/api/save/pin'], ['POST', '/api/save/restore'], ['GET', '/api/accounts'], ['POST', '/api/accounts/reset'], ['POST', '/api/accounts/strikes'], ['POST', '/api/accounts/rename']];
        const adminCalls = ['online', 'accounts', 'chat', 'modlog', 'teachers', 'teacher-acts', 'invite', 'export', 'sim', 'trades', 'role', 'mute', 'ban', 'pin', 'restore'];
        const out = {};
        for (const [m, p] of knight) out[m + ' ' + p] = (await fetch(p, { method: m, headers: h, body: m === 'GET' ? undefined : '{"player":{}}' })).status;
        for (const c of adminCalls) for (const m of ['GET', 'POST']) out[m + ' /api/admin/' + c] = (await fetch('/api/admin/' + c, { method: m, headers: h, body: m === 'GET' ? undefined : '{}' })).status;
        out.ws = await new Promise(res => { const w = new WebSocket(location.origin.replace(/^http/, 'ws') + '/ws?token=' + tok); w.onopen = () => res('open'); w.onclose = e => res('closed ' + e.code); w.onerror = () => { }; });
        return out;
      }, tToken);
      const all401 = Object.entries(r).filter(([k]) => k !== 'ws').every(([, v]) => v === 401);
      line('the teacher\'s token is 401 on every knight route and every admin call, and /ws never opens with it (' + (Object.keys(r).length - 1) + ' calls)', all401 && r.ws !== 'open', r);
    }

    // ---- 9. a page that held a kid's game: the teacher's answer starts it again first, then the screen ----
    {
      const kp = await realKid(browser, 'Leo');
      await kp.evaluate(() => LOGIN.logout()); await wait(2500);
      await kp.evaluate(() => LOGIN.notMe()); await wait(300);
      await kp.fill('#fl-name', tName); await kp.fill('#fl-pass', pass); await kp.click('#fl-login button[type=submit]');
      await kp.waitForFunction(() => document.querySelector('#fl-login .fl-err') && /Sign in once more/.test(document.querySelector('#fl-login .fl-err').textContent), null, { timeout: 15000 });
      const fresh = await kp.evaluate(() => ({ err: document.querySelector('#fl-login .fl-err').textContent, tv: !!document.getElementById('tv') }));
      await shot(kp, '14-fresh-page-sign-in-again');
      await signInCard(kp, tName, pass);
      const ok = await kp.evaluate(() => ({ tv: !!document.getElementById('tv'), pristine: TEACHERSCREEN.pristine }));
      line('on a page where a kid played, the teacher\'s answer reloads it first: "' + fresh.err + '"; signed in again, the screen opens on a fresh page', fresh.err === 'Sign in once more to open the teacher view.' && !fresh.tv && ok.tv && ok.pristine, { fresh, ok });
      await kp.context().close();
    }

    // ---- 10. Sign out, idle, midnight: back to the card, with why ----
    {
      await tp.click('#tv-signout'); await tp.waitForSelector('#fl-name', { state: 'visible' }); await wait(500);
      const out = await tp.evaluate(() => ({ err: document.querySelector('#fl-login .fl-err').textContent, tv: !!document.getElementById('tv'), ss: Object.keys(sessionStorage) }));
      line('Sign out: the card says "' + out.err + '"; no screen; nothing kept in sessionStorage', out.err === 'You signed out.' && !out.tv && out.ss.length === 0, out);
      await shot(tp, '15-signed-out');
      await signInCard(tp, tName, pass);
      await tp.evaluate(() => { TEACHERSCREEN.screen.idleFor(62 * 60000); }); await wait(1500);
      await tp.waitForSelector('#fl-name', { state: 'visible', timeout: 10000 }); await wait(500);
      const idle = await tp.evaluate(() => document.querySelector('#fl-login .fl-err').textContent);
      line('idle (nothing pressed for an hour, then two minutes): "' + idle + '"', idle === 'You were signed out because nothing was pressed for an hour.', idle);
      await shot(tp, '16-idle-signed-out');
      await signInCard(tp, tName, pass);
      await tp.evaluate(() => { TEACHERSCREEN.screen.expireNow(); }); await wait(1500);
      await tp.waitForSelector('#fl-name', { state: 'visible', timeout: 10000 }); await wait(500);
      const mid = await tp.evaluate(() => document.querySelector('#fl-login .fl-err').textContent);
      line('the session\'s end (10 hours, or midnight in Toronto): "' + mid + '"', mid === 'Your sign-in ran out for today. Sign in again to keep watching.', mid);
    }

    // ---- 11. what Watch costs: a minute with Sam alone in the Spider Den, not watched, then watched ----
    {
      await signInCard(tp, tName, pass);
      for (const k of crowd) try { k.ws.close(); } catch (e) { }
      clearInterval(alive); alive = null;
      await ava.context().close();
      await sam.evaluate(() => { INSTANCES.enter('spider_den'); }); await wait(1500);
      const meter = async () => (await admin('GET', '/api/admin/sim')).data.meter.today;
      const m0 = await meter(); await wait(60000); const m1 = await meter();
      await tp.locator('#tv-who .row', { hasText: 'Sam' }).first().locator('button:has-text("Watch")').click();
      await wait(1500); const m2 = await meter(); await wait(60000); const m3 = await meter();
      const fr = await tp.evaluate(() => VIEW.state.stats);
      const per = (a, b) => ({ wsIn: b.wsIn - a.wsIn, http: b.http - a.http, rows: (b.rows || 0) - (a.rows || 0) });
      const not = per(m0, m1), yes = per(m2, m3);
      const extra = { wsIn: yes.wsIn - not.wsIn, rows: yes.rows - not.rows };
      const hour = { msgs: extra.wsIn * 60, requests: Math.round(extra.wsIn * 60 / 20 * 10) / 10, rows: Math.max(0, extra.rows) * 60 };
      note('a minute not watched: ' + JSON.stringify(not) + '; a minute watched: ' + JSON.stringify(yes) + '; the teacher got ' + JSON.stringify(fr));
      note('Watch, alone in a place he keeps: about ' + hour.msgs + ' incoming messages an hour = ' + hour.requests + ' requests an hour (of 100,000 a day), ' + hour.rows + ' rows written');
      fs.writeFileSync(path.join(OUT, 'cost.json'), JSON.stringify({ notWatched: not, watched: yes, perHour: hour, frames: fr }, null, 2));
      line('Watch costs at most 2 messages a second from his game (here ' + yes.wsIn + ' a minute watched, ' + not.wsIn + ' not), so at most 360 requests an hour, and no row written by it', extra.wsIn <= 121 && extra.rows <= 1 && fr.mon > 0, { not, yes, fr });
      await shot(tp, '17-watch-alone-in-the-den');
    }
    line('no page errors (teacher, Sam, Ava)', tp.errors.length === 0 && sam.errors.length === 0, { t: tp.errors, s: sam.errors });
  } finally {
    if (alive) clearInterval(alive);
    for (const k of crowd) try { k.ws.close(); } catch (e) { }
    await browser.close();
  }
  // WebKit, when it is installed: the sign-in and the screen at two sizes
  if (webkit) {
    let wk = null;
    try { wk = await webkit.launch(); } catch (e) { note('WebKit is not installed here (npx playwright install webkit): its run is skipped'); }
    if (wk) {
      try {
        const name = 'Mr Lee Wk', pass2 = 'quiet-harbour-oak-17'; await teacherRow(name, pass2);
        for (const [w, h] of [[1280, 800], [820, 1180]]) {
          const p = await (await wk.newContext({ viewport: { width: w, height: h } })).newPage();
          await signInCard(p, name, pass2); await wait(600);
          const m = await p.evaluate(MEASURE);
          line('WebKit ' + w + 'x' + h + ': the screen fills the window, nothing clipped, 44 px targets', m.problems.length === 0, m.problems.slice(0, 8));
          await shot(p, '18-webkit-' + w + 'x' + h);
        }
      } finally { await wk.close(); }
    }
  }
}

try { await main(); } catch (e) { line('the run itself', false, String(e && e.stack || e)); }
const bad = results.filter(r => !r).length;
console.log(bad ? `teacher-browser: ${bad} FAIL of ${results.length}` : `teacher-browser: all ${results.length} PASS`);
console.log('screenshots: ' + OUT);
process.exit(bad ? 1 : 0);
