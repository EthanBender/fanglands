#!/usr/bin/env node
// tools/teachers-in-game-browser.mjs — the Teachers tab of the owner's in-game Admin panel (docs/ONLINE.md, "The teacher view",
// "Teachers in the game") in a REAL browser against a LOCAL world. It starts nothing itself: run the local world the way
// tools/teacher-browser.mjs's header says (in online/: .dev.vars with ADMIN_KEY and INVITE_CODE, wrangler.local.toml = the
// wrangler.toml without its routes, so OWNER_KNIGHTS = "MudGoll" comes along), then from the repo root:
//   node tools/teachers-in-game-browser.mjs        every check (PASS/FAIL lines; exit 1 on a FAIL), screenshots in OUT
// OUT defaults to ~/.fanglands/work/teacher/ingame. BASE defaults to http://127.0.0.1:8787 and must be a local address.
// What it proves, in order: MudGoll (an owner admin) signs in on the card, opens the Admin panel from its plaque and the
// Teachers tab; a short password is refused in /admin's words in bold red with nothing made; Make one up + Add teacher, and a
// typed password + Enter, each add a teacher, the password shown once with Copy (the clipboard holds the sign-in words); the
// teacher made in the game signs in on the card and gets the teacher screen; New password (two taps) closes her screen and
// only the new password works; Turn off (two taps) and Turn on; Lift the wait after five wrong tries; the notice switch both
// ways; Undo of a teacher's mute of a kid; every act in What admins did as "MudGoll (in game)"; keys typed in the boxes never
// move the knight; a second admin NOT in OWNER_KNIGHTS gets no tab and a 403 owner on every call; a kid gets 403 admin; the
// section measured and photographed at 1280x800, and on a touch iPad at 1024x768 and 768x1024 (every target 44 px, nothing
// out of the panel, no sideways scroll). Needs playwright-core and a Chromium (found as tools/dom-keys.js finds them):
// without them it says so and exits 0. NEVER point it at a real world.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const PW = [process.env.PLAYWRIGHT_CORE, path.join(os.homedir(), '.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core'), path.join(os.homedir(), 'Documents/Eden/node_modules/playwright-core')].filter(Boolean).find(p => fs.existsSync(p));
const EXE = [process.env.CHROMIUM, path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell')].filter(Boolean).find(p => fs.existsSync(p));
if (!PW) { console.log('teachers-in-game-browser: SKIPPED (no playwright-core found)'); process.exit(0); }
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) { console.error('teachers-in-game-browser: a local world only (' + BASE + ')'); process.exit(1); }
const vars = (() => { try { return fs.readFileSync(path.join(ROOT, 'online/.dev.vars'), 'utf8'); } catch (e) { return ''; } })();
const KEY = process.env.ADMIN_KEY || (/ADMIN_KEY=(.*)/.exec(vars) || [])[1] || 'test-admin', INVITE = process.env.INVITE || (/INVITE_CODE=(.*)/.exec(vars) || [])[1] || 'TEST-1234';
const OUT = process.env.OUT || path.join(os.homedir(), '.fanglands/work/teacher/ingame');
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require(PW);
const wait = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const line = (name, ok, info) => { results.push(!!ok); console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined && !ok ? '   ' + JSON.stringify(info).slice(0, 1600) : '')); };
const note = text => console.log('      ' + text);
const shot = async (page, name) => { const p = path.join(OUT, name + '.png'); await page.screenshot({ path: p }); note('screenshot ' + p); return p; };

// ---------- the world, from outside ----------
async function api(method, p, body, headers = {}) {
  const r = await fetch(BASE + p, { method, headers: Object.assign({ 'content-type': 'application/json' }, headers), body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch (e) { }
  return { status: r.status, data };
}
const admin = (method, p, body) => api(method, p, body, { authorization: 'Bearer ' + KEY });
const as = (token, method, p, body) => api(method, p, body, { authorization: 'Bearer ' + token });
let ipN = 0;
const ipNext = () => { ipN++; return '10.80.' + Math.floor(ipN / 200) + '.' + (ipN % 200 + 1); };
// a local knight (signed up, or signed in when an earlier run made it), with its role and no mute
async function knight(name, role = 'player') {
  let r = await api('POST', '/api/signup', { name, pass: 'sword', invite: INVITE }, { 'cf-connecting-ip': ipNext() });
  if (r.status === 409) r = await api('POST', '/api/login', { name, pass: 'sword' }, { 'cf-connecting-ip': ipNext() });
  if (r.status !== 200) throw new Error('knight ' + name + ': ' + r.status + ' ' + JSON.stringify(r.data));
  await admin('POST', '/api/admin/role', { name, role });
  await admin('POST', '/api/admin/mute', { name, span: 'off' });
  return { name, token: r.data.token };
}
const WORLD_ATLAS = JSON.parse(fs.readFileSync(path.join(ROOT, 'online/src/atlas.json'), 'utf8')).hash;
// a kid on line: a bare socket that says hello and where it stands
function bare(k) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/ws?token=' + k.token);
    const K = { ws, name: k.name, got: [] };
    ws.onmessage = ev => { try { K.got.push(JSON.parse(ev.data)); } catch (e) { } };
    ws.onerror = () => reject(new Error('socket ' + k.name));
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', v: 1, atlas: WORLD_ATLAS })); ws.send(JSON.stringify({ t: 'p', map: 'over', region: 'Somewhere', x: 6000, y: 3700, lv: 10, mv: false, sw: 0, act: null, mech: null, dead: false })); resolve(K); };
  });
}
// a teacher's own socket (her token from the card's call, made here): one action, its answer
async function teacherAct(name, pass, msg) {
  const lg = await api('POST', '/api/login', { name, pass, teacherOk: 1 });
  if (lg.status !== 200) throw new Error('teacher sign-in ' + lg.status + ' ' + JSON.stringify(lg.data));
  const t = await as(lg.data.token, 'POST', '/api/teacher/ticket');
  const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/api/teacher/ws?ticket=' + t.data.ticket);
  const got = [];
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('teacher socket')); });
  ws.onmessage = ev => { try { got.push(JSON.parse(ev.data)); } catch (e) { } };
  await wait(400);
  ws.send(JSON.stringify(Object.assign({ req: 77 }, msg)));
  for (let i = 0; i < 40 && !got.some(m => m.req === 77); i++) await wait(100);
  const ans = got.find(m => m.req === 77) || null;
  ws.close(); await api('POST', '/api/teacher/logout', { token: lg.data.token });
  return ans;
}
const teachers = async () => ((await admin('GET', '/api/admin/teachers')).data || {}).teachers || [];

// ---------- the game, in the browser ----------
async function signedIn(browser, name, opts = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 800 } }, opts));
  const p = await ctx.newPage();
  p.errors = []; p.on('pageerror', e => p.errors.push(String(e)));
  // a new local knight hears the tutorial's words; the owner's own knight finished it long ago, so they are let go here
  // (check 5b says what the section does while a character speaks)
  await p.addInitScript(() => { window.__noTalk = true; setInterval(() => { try { if (window.__noTalk && typeof dialog !== 'undefined' && dialog.cur) { dialog.cur = null; dialog.queue.length = 0; } } catch (e) { } }, 100); });
  await p.goto(BASE + '/?online');
  await p.waitForSelector('#fl-name', { state: 'visible', timeout: 30000 });
  await p.fill('#fl-name', name); await p.fill('#fl-pass', 'sword');
  await p.click('#fl-login button[type=submit]');
  for (let i = 0; i < 120; i++) {
    const ok = await p.evaluate(() => { if (window.BOYGIRL && BOYGIRL.asking) BOYGIRL.answer('boy'); if (window.LOGIN && LOGIN.mode === 'offer') LOGIN.bring(false); if (window.dialog && dialog.cur) { dialog.cur = null; dialog.queue.length = 0; } return !title.active && NET.status === 'on'; });
    if (ok) break; await wait(250);
  }
  const st = await p.evaluate(() => ({ status: NET.status, me: NET.me, role: NET.role }));
  if (st.me !== name) throw new Error(name + ' did not come in: ' + JSON.stringify(st));
  return p;
}
// a canvas button by its label, pressed the way a person does (the mouse, or a finger on a touch page)
async function press(page, label, touch) {
  let b = null;
  for (let i = 0; i < 40 && !b; i++) { b = await page.evaluate(l => { const x = buttons.find(b => b.label === l && !b.disabled); return x ? { x: x.x + x.w / 2, y: x.y + x.h / 2 } : null; }, label); if (!b) await wait(100); }
  if (!b) throw new Error('no button ' + label);
  if (touch) await page.touchscreen.tap(b.x, b.y); else await page.mouse.click(b.x, b.y);
  await wait(150);
}
// open the Admin panel from its plaque, then a tab
async function openTab(page, tab, touch) {
  const open = await page.evaluate(() => panel === 'admin');
  if (!open) { await page.evaluate(() => { if (panel) closePanel(); }); await wait(100); await press(page, 'ADMIN', touch); }
  if (tab) await press(page, 'admin:tab:' + tab, touch);
}
const said = page => page.evaluate(() => { const e = document.querySelector('#flt-said > div'); const box = document.getElementById('flt-said'); return e ? { text: e.textContent, bad: box.classList.contains('bad'), weight: getComputedStyle(e).fontWeight, color: getComputedStyle(e).color, copy: !!document.getElementById('flt-copy') } : null; });
const waitSaid = (page, re) => page.waitForFunction(src => { const e = document.querySelector('#flt-said > div'); return !!e && new RegExp(src).test(e.textContent); }, re.source, { timeout: 20000 });
const st = page => page.evaluate(() => JSON.parse(JSON.stringify({ owner: OWNERTEACHERS.state.owner, busy: OWNERTEACHERS.state.busy, tabs: ADMIN.tabs(), tab: ADMIN.state.tab, panel })));
async function settle(page) { for (let i = 0; i < 60; i++) { const s = await st(page); if (!s.busy && !(await page.evaluate(() => OWNERTEACHERS.state.loading))) return; await wait(100); } }

// the section, measured in the page: shown over the panel, every target 44 px, nothing sideways, no text under 13 px
const MEASURE = () => {
  const root = document.getElementById('fl-teachers'), P = [];
  const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const R = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  if (!root || !vis(root)) return { shown: false, problems: ['the section is not on screen'] };
  const rr = R(root), pr = typeof panelRect !== "undefined" ? panelRect : null;
  if (!pr) P.push("no panel on screen");
  if (pr && (rr.l < pr.x - 1 || rr.t < pr.y - 1 || rr.r > pr.x + pr.w + 1 || rr.b > pr.y + pr.h + 1)) P.push('the section leaves the panel ' + JSON.stringify([rr, pr]));
  if (root.scrollWidth > root.clientWidth + 1) P.push('the section scrolls sideways ' + root.scrollWidth + ' > ' + root.clientWidth);
  if (document.documentElement.scrollWidth > innerWidth + 0.5) P.push('the page scrolls sideways');
  const targets = Array.from(root.querySelectorAll('button, input')).filter(vis);
  for (const e of targets) {
    const r = R(e), name = (e.id || e.textContent || '').trim().slice(0, 30);
    if (r.w < 43.5 || r.h < 43.5) P.push('small: ' + name + ' ' + Math.round(r.w) + 'x' + Math.round(r.h));
    if (r.l < rr.l - 1 || r.r > rr.r + 1) P.push('out of the section sideways: ' + name);
    if (e.tagName === 'BUTTON' && e.scrollWidth > e.clientWidth + 1) P.push('clipped: ' + name);
    if (e.tagName === 'INPUT' && parseFloat(getComputedStyle(e).fontSize) < 16) P.push('an input under 16 px (Safari would zoom): ' + name);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) { if (!n.textContent.trim() || !vis(n.parentElement)) continue; const fs = parseFloat(getComputedStyle(n.parentElement).fontSize); if (fs < 12.9) P.push('tiny text ' + fs + 'px: ' + n.textContent.trim().slice(0, 30)); }
  return { shown: true, rect: rr, panel: pr, targets: targets.length, scrollH: root.scrollHeight, h: root.clientHeight, problems: P };
};

async function main() {
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
  const sockets = [];
  try {
    const sfx3 = () => String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(97 + Math.floor(Math.random() * 26)) + String.fromCharCode(97 + Math.floor(Math.random() * 26));
    const tag = sfx3();
    const mud = await knight('MudGoll', 'admin'), ada = await knight('Ada', 'admin'), kid = await knight('Cohen', 'player');
    const st0 = await api('GET', '/api/status');
    note('local world ' + BASE + ': ' + JSON.stringify(st0.data));

    // ---- 1. MudGoll: the Admin panel from its plaque, then Teachers ----
    const page = await signedIn(browser, 'MudGoll');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
    await openTab(page, null);
    for (let i = 0; i < 50 && (await st(page)).owner !== true; i++) await wait(100);
    const s1 = await st(page);
    await press(page, 'admin:tab:teachers');
    await page.waitForSelector('#fl-teachers', { state: 'visible', timeout: 10000 });
    await settle(page);
    const world = await page.textContent('#flt-world');
    line('MudGoll (an owner admin) opens the Admin panel from its plaque: the world says he is an owner, the Teachers tab comes after Accounts, and the section opens over the panel', s1.owner === true && s1.tabs.join(',') === 'knights,accounts,teachers,powers,monsters,party' && (await st(page)).tab === 'teachers' && /this world's teachers \(127\.0\.0\.1:8787\)/.test(world), { s1, world });

    // ---- 2. a short password typed by hand + Enter: refused in /admin's words, bold red, nothing made ----
    const nA = 'Mrs Smith ' + tag, nB = 'Mr Bender ' + tag;
    const before = (await teachers()).length;
    await page.fill('#flt-name', nA); await page.fill('#flt-pass', 'cohen 123'); await page.press('#flt-pass', 'Enter'); await wait(300);
    const short = await said(page);
    line('"cohen 123" + Enter is refused in /admin\'s words, in bold red, and nothing is made: "' + (short && short.text) + '"', short && short.text === 'Not added. The password needs at least 10 letters (spaces count); this one has 9. Type a longer one, or press Make one up.' && short.bad && Number(short.weight) >= 600 && (await teachers()).length === before, short);
    await shot(page, '01-short-password-1280x800');

    // ---- 3. Make one up + Add teacher: the password shown once, with Copy ----
    await page.click('#flt-make');
    const passA = await page.inputValue('#flt-pass');
    await page.click('#flt-add');
    await waitSaid(page, /^Added /);
    const addedA = await said(page);
    const wantA = 'Added ' + nA + '. The password is ' + passA + ' (it is not shown again). Tell ' + nA + ': go to 127.0.0.1:8787, type ' + nA + " in Knight's name and this password in Secret word, and press Play.";
    await page.click('#flt-copy'); await wait(300);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    const copiedWord = await page.textContent('#flt-copy');
    const boxes = [await page.inputValue('#flt-name'), await page.inputValue('#flt-pass')];
    await settle(page);
    const listed = await page.evaluate(n => Array.from(document.querySelectorAll('#flt-list .card .name')).some(e => e.textContent.startsWith(n)), nA);
    line('Make one up + Add teacher: "' + addedA.text + '"; Copy puts the sign-in words with the password on the clipboard; the boxes empty; her card is in the list', /^[a-z]+-[a-z]+-[a-z]+-[1-9]\d$/.test(passA) && addedA.text === wantA && !addedA.bad && clip === 'Fanglands teacher sign-in. Go to 127.0.0.1:8787, type ' + nA + " in Knight's name and " + passA + ' in Secret word, and press Play.' && copiedWord === 'Copied' && boxes.join('') === '' && listed, { passA, addedA, clip, copiedWord, boxes, listed });
    await shot(page, '02-added-with-copy-1280x800');

    // ---- 3b. shown once: another tab, and the password is gone from the page; back on Teachers it is not shown again ----
    await press(page, 'admin:tab:knights'); await wait(300);
    const goneAway = await page.evaluate(p => !document.documentElement.innerHTML.includes(p) && OWNERTEACHERS.state.said === null, passA);
    await press(page, 'admin:tab:teachers'); await page.waitForSelector('#fl-teachers', { state: 'visible', timeout: 10000 }); await settle(page);
    const notAgain = await page.evaluate(p => !document.documentElement.innerHTML.includes(p) && !document.getElementById('flt-copy'), passA);
    line('the password is shown once: on another tab it is nowhere in the page, and back on Teachers it is not shown again', goneAway && notAgain, { goneAway, notAgain });

    // ---- 4. a typed password + Enter in the NAME box adds too ----
    await page.fill('#flt-name', nB); await page.fill('#flt-pass', 'school rocks 7'); await page.press('#flt-name', 'Enter');
    await waitSaid(page, new RegExp('^Added ' + nB));
    const addedB = await said(page);
    line('a typed password + Enter adds ("' + addedB.text.slice(0, 60) + '...")', addedB.text.startsWith('Added ' + nB + '. The password is school rocks 7 (it is not shown again).'), addedB);

    // ---- 5. keys typed in the boxes never reach the game ----
    await page.click('#flt-name');
    const p0 = await page.evaluate(() => [player.x, player.y]);
    await page.keyboard.type('dddddwwwwwaaaa', { delay: 20 }); await page.keyboard.down('d'); await wait(500); await page.keyboard.up('d');
    const p1 = await page.evaluate(() => [player.x, player.y]);
    const typed = await page.inputValue('#flt-name');
    await page.fill('#flt-name', '');
    line('keys typed in the name box land in the box and never move the knight', p0[0] === p1[0] && p0[1] === p1[1] && typed === 'dddddwwwwwaaaad', { p0, p1, typed });

    // ---- 5b. a character speaking draws over the panel: the section steps aside, and comes back when the words are gone ----
    await page.evaluate(() => { window.__noTalk = false; dialog.queue.length = 0; dialog.cur = null; say('Words over the panel.', 'The Voice'); });
    await wait(400);
    const aside = await page.evaluate(() => ({ cur: !!dialog.cur, shown: getComputedStyle(document.getElementById('fl-teachers')).display !== 'none' }));
    await page.evaluate(() => { window.__noTalk = true; }); await wait(400);
    const backAgain = await page.evaluate(() => getComputedStyle(document.getElementById('fl-teachers')).display !== 'none');
    line('while a character speaks over the panel the section steps aside, and it is back when the words are gone', aside.cur && !aside.shown && backAgain, { aside, backAgain });

    // ---- 6. the teacher made in the game signs in on the card and gets the teacher screen ----
    const tA = (await teachers()).find(t => t.name === nA);
    const tp = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    await tp.goto(BASE + '/?online'); await tp.waitForSelector('#fl-name', { state: 'visible', timeout: 30000 });
    await tp.fill('#fl-name', nA); await tp.fill('#fl-pass', passA); await tp.click('#fl-login button[type=submit]');
    await tp.waitForFunction(() => window.TEACHERSCREEN && TEACHERSCREEN.screen && TEACHERSCREEN.screen.peek().status === 'live', null, { timeout: 30000 });
    const peek = await tp.evaluate(() => TEACHERSCREEN.screen.peek());
    line('the teacher made in the game signs in on the card (her name in Knight\'s name, the password in Secret word, Play) and gets the teacher screen', peek.status === 'live' && peek.me === nA, { peek: { status: peek.status, me: peek.me } });
    await shot(tp, '03-teacher-screen-from-in-game-teacher');

    // ---- 7. New password: two taps; her screen closes; only the new one works ----
    await settle(page);
    await page.click('#flt-pass-' + tA.id); await wait(150);
    const armed = await page.textContent('#flt-pass-' + tA.id);
    const armSaid = await said(page);
    const stillLive = (await tp.evaluate(() => TEACHERSCREEN.screen.peek().status)) === 'live';
    await page.click('#flt-pass-' + tA.id);
    await waitSaid(page, new RegExp("'s new password is "));
    const np = await said(page);
    const newPass = (/new password is (.+)\. Give it to them\. It is not shown again\.$/.exec(np.text) || [])[1];
    await tp.waitForFunction(() => !TEACHERSCREEN.screen || TEACHERSCREEN.screen.peek().status !== 'live', null, { timeout: 15000 }).catch(() => { });
    await wait(500);
    const closed = await tp.evaluate(() => TEACHERSCREEN.screen ? TEACHERSCREEN.screen.peek().status : 'gone');
    const bye = await tp.evaluate(() => document.body.innerText.includes('Your password was changed. Sign in with the new one.'));
    await shot(tp, '03b-teacher-screen-after-new-password');
    const oldNo = (await api('POST', '/api/login', { name: nA, pass: passA, teacherOk: 1 })).status, newYes = (await api('POST', '/api/login', { name: nA, pass: newPass, teacherOk: 1 })).status;
    line('New password asks for a second tap ("' + armed + '"), then says the new one once with Copy; her open screen closes ("Your password was changed. Sign in with the new one."); the old password stops and the new one works', armed === 'Tap again: new password' && /^Tap again to give /.test(armSaid.text) && stillLive && np.copy && !!newPass && closed !== 'live' && bye && oldNo === 401 && newYes === 200, { armed, armSaid, np, closed, bye, oldNo, newYes });
    await tp.context().close();

    // ---- 8. Turn off (two taps) and Turn on ----
    await settle(page);
    await page.click('#flt-off-' + tA.id); await wait(100); await page.click('#flt-off-' + tA.id);
    await waitSaid(page, / is turned off\.$/);
    await settle(page);
    const offCode = (await api('POST', '/api/login', { name: nA, pass: newPass, teacherOk: 1 })).data.code;
    const offShown = await page.evaluate(id => { const c = document.querySelector('#flt-list .card[data-teacher="' + id + '"]'); return !!c && c.classList.contains('off') && !!document.getElementById('flt-on-' + id); }, tA.id);
    await page.click('#flt-on-' + tA.id);
    await waitSaid(page, / is on again with a new password: /);
    const onSaid = await said(page);
    const onPass = (/new password: (.+)\. Give it to them\./.exec(onSaid.text) || [])[1];
    const onOk = (await api('POST', '/api/login', { name: nA, pass: onPass, teacherOk: 1 })).status;
    line('Turn off (two taps) turns her off (the card answers "off" to the right password, the row says turned off); Turn on gives a new password, said once with Copy, that works', offCode === 'off' && offShown && onSaid.copy && onOk === 200, { offCode, offShown, onSaid, onOk });

    // ---- 9. Lift the wait: five wrong tries from one tab make it wait; lifted, the right password goes in ----
    const tab = 'cd34cd34cd34cd34', ip = { 'cf-connecting-ip': '198.51.100.7' };
    for (let i = 0; i < 5; i++) await api('POST', '/api/login', { name: nA, pass: 'wrong-' + i, teacherOk: 1, tab }, ip);
    const waitsNow = (await api('POST', '/api/login', { name: nA, pass: onPass, teacherOk: 1, tab }, ip)).status;
    await settle(page); await page.click('#flt-refresh'); await settle(page);
    await page.waitForSelector('#flt-lift-' + tA.id, { timeout: 10000 });
    const facts = await page.evaluate(id => document.querySelector('#flt-list .card[data-teacher="' + id + '"] .facts').textContent, tA.id);
    await shot(page, '04-lift-the-wait-1280x800');
    await page.click('#flt-lift-' + tA.id);
    await waitSaid(page, / can sign in again now, with the same password\.$/);
    const inAgain = (await api('POST', '/api/login', { name: nA, pass: onPass, teacherOk: 1, tab }, ip)).status;
    line('five wrong tries from one tab make it wait (429); the row shows the wrong tries and Lift the wait; one tap lets her in again with the same password', waitsNow === 429 && /Wrong tries today[1-9]\d*Sign-in waitingyes/.test(facts) && inAgain === 200, { waitsNow, facts, inAgain });

    // ---- 10. the notice switch, both ways ----
    await settle(page);
    const n0 = (await admin('GET', '/api/admin/teachers')).data.notice;
    await page.click('#flt-notice'); await waitSaid(page, /^Tell players when a teacher is watching: /); await settle(page);
    const n1 = (await admin('GET', '/api/admin/teachers')).data.notice, w1 = await page.textContent('#flt-notice');
    await page.click('#flt-notice'); await wait(200); await settle(page);
    const n2 = (await admin('GET', '/api/admin/teachers')).data.notice;
    line('the "Tell players when a teacher is watching" switch flips the world\'s switch and back (' + n0 + ' -> ' + n1 + ' -> ' + n2 + ')', n1 === !n0 && n2 === n0 && w1 === (n1 ? 'Turn off' : 'Turn on'), { n0, n1, n2, w1 });

    // ---- 11. Undo of a teacher's mute of a kid ----
    const k1 = await bare(kid); sockets.push(k1); await wait(600);
    const m1 = await teacherAct(nA, onPass, { t: 'w_mute', n: 'Cohen', span: '10m' });
    await settle(page); await page.click('#flt-refresh'); await settle(page);
    const row = await page.evaluate(() => { const r = document.querySelector('#flt-list .force'); return r ? { id: Number(r.dataset.act), text: r.textContent } : null; });
    await shot(page, '05-in-force-undo-1280x800');
    const mutedBefore = ((await admin('GET', '/api/admin/accounts')).data || []).find(a => a.name === 'Cohen').mutedUntil;
    await page.click('#flt-undo-' + row.id);
    await waitSaid(page, /^Undone: /);
    const undoSaid = await said(page);
    const mutedAfter = ((await admin('GET', '/api/admin/accounts')).data || []).find(a => a.name === 'Cohen').mutedUntil;
    await settle(page);
    const goneRow = await page.evaluate(id => !document.querySelector('#flt-list .force[data-act="' + id + '"]'), row.id);
    line('a teacher mutes a kid; the row is in force now with Undo; Undo turns the kid\'s chat back on ("' + undoSaid.text + '")', m1 && m1.t === 'w_ok' && /muted Cohen until/.test(row.text) && mutedBefore > Date.now() && !(mutedAfter > Date.now()) && undoSaid.text === 'Undone: ' + nA + ' muted Cohen until ' + row.text.split(' muted Cohen until ')[1].replace(/Undo$/, '') + '.' && goneRow, { m1, row, mutedBefore, mutedAfter, undoSaid, goneRow });

    // ---- 12. What admins did: every act by "MudGoll (in game)" ----
    const log = ((await admin('GET', '/api/admin/modlog?limit=200')).data || []).filter(r => r.by === 'MudGoll (in game)').map(r => r.act + ' ' + r.n);
    const wantActs = ['teacher_add ' + nA + ' (teacher)', 'teacher_add ' + nB + ' (teacher)', 'teacher_pass ' + nA + ' (teacher)', 'teacher_off ' + nA + ' (teacher)', 'teacher_on ' + nA + ' (teacher)', 'teacher_lift ' + nA + ' (teacher)', 'teacher_notice everyone', 'unmute Cohen'];
    const missing = wantActs.filter(a => !log.includes(a));
    const noPass = !JSON.stringify((await admin('GET', '/api/admin/modlog?limit=200')).data).includes(passA);
    line('What admins did lists every one of it as by "MudGoll (in game)", and no password', missing.length === 0 && noPass, { missing, log: log.slice(0, 12) });

    // ---- 13. the section, measured and photographed: laptop 1280x800 with something in force again ----
    const m2 = await teacherAct(nA, onPass, { t: 'w_mute', n: 'Cohen', span: '10m' });
    await page.click('#flt-make'); await page.fill('#flt-name', 'Mr Lee ' + tag); await page.click('#flt-add'); await waitSaid(page, /^Added /); await settle(page);
    const lap = await page.evaluate(MEASURE);
    await shot(page, '06-section-1280x800');
    line('laptop 1280x800: the section sits inside the panel, every button and box 44 px or more, nothing sideways, no text under 13 px (' + lap.targets + ' targets)', lap.shown && lap.problems.length === 0 && m2 && m2.t === 'w_ok', lap);
    const lapErrors = page.errors.slice();
    await page.context().close();

    // ---- 14. a touch iPad, sideways and upright: tapped, measured, photographed ----
    for (const [w, h] of [[1024, 768], [768, 1024]]) {
      const ip2 = await signedIn(browser, 'MudGoll', { viewport: { width: w, height: h }, hasTouch: true });
      await openTab(ip2, null, true);
      for (let i = 0; i < 50 && (await st(ip2)).owner !== true; i++) await wait(100);
      await press(ip2, 'admin:tab:teachers', true);
      await ip2.waitForSelector('#fl-teachers', { state: 'visible', timeout: 10000 }); await settle(ip2);
      await ip2.tap('#flt-name'); await ip2.keyboard.type('Ms Park ' + tag + (w > h ? 'a' : 'b'));
      await ip2.tap('#flt-make'); await ip2.tap('#flt-add'); await waitSaid(ip2, /^Added /); await settle(ip2);
      const m = await ip2.evaluate(MEASURE);
      const sz = w + 'x' + h;
      await shot(ip2, '07-section-ipad-' + sz);
      // the bottom of the list, scrolled to by a finger's swipe (the section scrolls inside the panel)
      await ip2.evaluate(() => { const r = document.getElementById('fl-teachers'); r.scrollTop = r.scrollHeight; }); await wait(200);
      await shot(ip2, '08-section-ipad-' + sz + '-scrolled');
      line('touch iPad ' + sz + ': tapped Make one up and Add teacher; the section sits inside the panel, every target 44 px or more, nothing sideways (' + m.targets + ' targets, ' + m.scrollH + ' px of list in ' + m.h + ' px)', m.shown && m.problems.length === 0 && ip2.errors.length === 0, { m, errors: ip2.errors });
      await ip2.context().close();
    }

    // ---- 15. NEGATIVE: Ada (an admin, not in OWNER_KNIGHTS) gets no tab and 403 owner on every call ----
    const ap = await signedIn(browser, 'Ada');
    await openTab(ap, null);
    for (let i = 0; i < 50 && (await st(ap)).owner === undefined; i++) await wait(100);
    const as1 = await st(ap);
    const noSection = await ap.evaluate(() => { const r = document.getElementById('fl-teachers'); return !r || getComputedStyle(r).display === 'none'; });
    await shot(ap, '09-other-admin-no-teachers-tab');
    const CALLS = [['GET', '/api/owner/teachers'], ['POST', '/api/owner/teachers', { name: 'Mr Nope', pass: 'long-enough-pass' }], ['POST', '/api/owner/teachers/pass', { id: tA.id, pass: 'long-enough-pass' }], ['POST', '/api/owner/teachers/off', { id: tA.id }], ['POST', '/api/owner/teachers/on', { id: tA.id, pass: 'long-enough-pass' }], ['POST', '/api/owner/teachers/lift', { id: tA.id }], ['POST', '/api/owner/teachers/notice', { on: false }], ['POST', '/api/owner/teachers/undo', { act: 1 }]];
    const adaToken = await ap.evaluate(() => NET.token);
    const adaAns = [], kidAns = [];
    for (const [m, p, b] of CALLS) { const r = await as(adaToken, m, p, b); adaAns.push(r.status + ' ' + (r.data && r.data.code)); const k = await as(kid.token, m, p, b); kidAns.push(k.status + ' ' + (k.data && k.data.code)); }
    const unchanged = (await teachers()).every(t => t.name !== 'Mr Nope') && !(await teachers()).find(t => t.id === tA.id).off;
    line('Ada (an admin not in OWNER_KNIGHTS) opens the Admin panel: no Teachers tab, no section; every teacher call with her token is 403 owner, and nothing changed', as1.owner === false && !as1.tabs.includes('teachers') && noSection && adaAns.every(a => a === '403 owner') && unchanged && ap.errors.length === 0, { as1, noSection, adaAns, unchanged });
    await ap.context().close();
    // ---- 16. NEGATIVE: a kid ----
    const kp = await signedIn(browser, 'Cohen');
    const kidPage = await kp.evaluate(() => ({ plaque: buttons.some(b => b.label === 'ADMIN'), open: ADMIN.open('teachers'), tabs: ADMIN.tabs().includes('teachers') && ADMIN.is() }));
    line('a kid: no Admin plaque, the panel will not open, and every teacher call is 403 admin', !kidPage.plaque && kidPage.open === false && kidAns.every(a => a === '403 admin'), { kidPage, kidAns });
    await kp.context().close();
    line('no page errors on the owner\'s laptop page', lapErrors.length === 0, lapErrors);
  } finally {
    for (const k of sockets) try { k.ws.close(); } catch (e) { }
    await browser.close();
  }
  const bad = results.filter(r => !r).length;
  console.log((bad ? 'FAIL' : 'PASS') + '  teachers-in-game-browser: ' + (results.length - bad) + ' of ' + results.length + ' checks pass; screenshots in ' + OUT);
  process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error('teachers-in-game-browser: ' + (e && e.stack || e)); process.exit(1); });
