#!/usr/bin/env node
// tools/teacher-chat-browser.mjs — the teacher's own chat line (owner, 7 Oct 2026: "the teacher should be able to message in
// chat as well ... it should just come up as admin which is the name of the account that I created"), in a REAL browser
// against a LOCAL world. It starts nothing itself: in online/, with online/.dev.vars holding ADMIN_KEY and INVITE_CODE, run
//   cp ../index.html public/index.html
//   CI=1 wrangler dev -c wrangler.local.toml --port 8787 --ip 127.0.0.1 --compatibility-date 2026-05-22
// then, from the repo root:
//   node tools/teacher-chat-browser.mjs        PASS/FAIL lines (exit 1 on a FAIL), screenshots in OUT
// OUT defaults to ~/.fanglands/work/teacher/chat. BASE defaults to http://127.0.0.1:8787 and must be a local address.
// What it proves: a teacher named Admin (made by the owner on /admin's API) signs in on the game's card, types a line in the
// box under the chat and presses Enter; two kids' real game pages show it in their chat under "Admin" in the admin's gold;
// the teacher's own chat panel shows it (TEACHER); /admin's chat log has it, marked; a chat pause stops a kid but not the
// teacher; a kid's socket cannot make a teacher's line (a chat frame dressed as one, or a w_say); the box is 44 px and in
// view on a laptop and on an iPad upright and sideways. Needs playwright-core and a Chromium (as tools/teacher-browser.mjs
// finds them): without them it says so and exits 0. NEVER point it at a real world.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const PW = [process.env.PLAYWRIGHT_CORE, path.join(os.homedir(), '.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core'), path.join(os.homedir(), 'Documents/Eden/node_modules/playwright-core')].filter(Boolean).find(p => fs.existsSync(p));
const EXE = [process.env.CHROMIUM, path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell')].filter(Boolean).find(p => fs.existsSync(p));
if (!PW) { console.log('teacher-chat-browser: SKIPPED (no playwright-core found)'); process.exit(0); }
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) { console.error('teacher-chat-browser: a local world only (' + BASE + ')'); process.exit(1); }
const vars = (() => { try { return fs.readFileSync(path.join(ROOT, 'online/.dev.vars'), 'utf8'); } catch (e) { return ''; } })();
const KEY = process.env.ADMIN_KEY || (/ADMIN_KEY=(.*)/.exec(vars) || [])[1] || 'test-admin', INVITE = process.env.INVITE || (/INVITE_CODE=(.*)/.exec(vars) || [])[1] || 'TEST-1234';
const OUT = process.env.OUT || path.join(os.homedir(), '.fanglands/work/teacher/chat');
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require(PW);
const wait = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const line = (name, ok, info) => { results.push(!!ok); console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined && !ok ? '   ' + JSON.stringify(info).slice(0, 1400) : '')); };
const note = text => console.log('      ' + text);
const shot = async (page, name) => { const p = path.join(OUT, name + '.png'); await page.screenshot({ path: p }); note('screenshot ' + p); };

async function api(method, p, body, headers = {}) {
  const r = await fetch(BASE + p, { method, headers: Object.assign({ 'content-type': 'application/json' }, headers), body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch (e) { }
  return { status: r.status, data };
}
const admin = (method, p, body) => api(method, p, body, { authorization: 'Bearer ' + KEY });
let ipN = 0;
const ipNext = () => { ipN++; return '10.80.' + Math.floor(ipN / 200) + '.' + (ipN % 200 + 1); };
async function knight(name) {
  let r = await api('POST', '/api/signup', { name, pass: 'sword', invite: INVITE }, { 'cf-connecting-ip': ipNext() });
  if (r.status === 409) r = await api('POST', '/api/login', { name, pass: 'sword' }, { 'cf-connecting-ip': ipNext() });
  if (r.status !== 200) throw new Error('knight ' + name + ': ' + r.status + ' ' + JSON.stringify(r.data));
  await admin('POST', '/api/admin/mute', { name, span: 'off' });
  return { name, token: r.data.token };
}
const WORLD_ATLAS = JSON.parse(fs.readFileSync(path.join(ROOT, 'online/src/atlas.json'), 'utf8')).hash;
// a bare kid: a socket that says hello (the forging kid)
function bare(k) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/ws?token=' + k.token);
    const K = { ws, name: k.name, got: [] };
    ws.onmessage = ev => { try { K.got.push(JSON.parse(ev.data)); } catch (e) { } };
    ws.onerror = () => reject(new Error('socket ' + k.name));
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', v: 1, atlas: WORLD_ATLAS })); resolve(K); };
    K.send = m => ws.send(JSON.stringify(m));
  });
}
async function realKid(browser, name) {
  await knight(name);
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const p = await ctx.newPage();
  p.errors = []; p.on('pageerror', e => p.errors.push(String(e)));
  await p.goto(BASE + '/?online');
  await p.waitForSelector('#fl-name', { state: 'visible', timeout: 30000 });
  await p.fill('#fl-name', name); await p.fill('#fl-pass', 'sword');
  await p.click('#fl-login button[type=submit]');
  for (let i = 0; i < 120; i++) {
    const ok = await p.evaluate(() => { if (window.BOYGIRL && BOYGIRL.asking) BOYGIRL.answer('boy'); if (window.LOGIN && LOGIN.mode === 'offer') LOGIN.bring(false); return !title.active && NET.status === 'on'; });
    if (ok) break; await wait(250);
  }
  const st = await p.evaluate(() => ({ status: NET.status, me: NET.me }));
  if (st.me !== name) throw new Error('real kid ' + name + ' did not come in: ' + JSON.stringify(st));
  return p;
}
async function teacherRow(name, pass) {
  const all = (await admin('GET', '/api/admin/teachers')).data || {};
  const t = (all.teachers || []).find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!t) { const r = await admin('POST', '/api/admin/teachers', { name, pass }); if (r.status !== 200) throw new Error('teacher: ' + JSON.stringify(r.data)); return r.data.id; }
  await admin('POST', t.off ? '/api/admin/teachers/on' : '/api/admin/teachers/pass', { id: t.id, pass });
  if (t.off) await admin('POST', '/api/admin/teachers/pass', { id: t.id, pass });
  await admin('POST', '/api/admin/teachers/lift', { id: t.id });
  return t.id;
}
async function signInCard(page, name, pass) {
  await page.goto(BASE + '/?online');
  await page.waitForSelector('#fl-name', { state: 'visible', timeout: 30000 });
  await page.fill('#fl-name', name); await page.fill('#fl-pass', pass);
  await page.click('#fl-login button[type=submit]');
  await page.waitForFunction(() => window.TEACHERSCREEN && TEACHERSCREEN.screen && TEACHERSCREEN.screen.peek().status === 'live', null, { timeout: 30000 });
}
// the kid's chat as his page holds it: the last line, its name's colour as the strip and the log draw it
const kidLast = page => page.evaluate(() => { const l = CHAT.log[CHAT.log.length - 1]; return l ? { n: l.n, text: l.text, role: l.role } : null; });
const kidHas = (page, text) => page.waitForFunction(t => CHAT.log.some(l => l.text === t), text, { timeout: 10000 }).then(() => true, () => false);
// the box, measured: 44 px tall input and Send, inside the window, and the chat pane showing it
const BOX = () => {
  const vis = e => { if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none') return false; for (let x = e; x; x = x.parentElement) if (x.hidden) return false; return true; };
  const i = document.querySelector('#tv-say input'), b = document.querySelector('#tv-say button');
  const ri = i && i.getBoundingClientRect(), rb = b && b.getBoundingClientRect();
  return { shown: vis(i) && vis(b), ih: ri && Math.round(ri.height), bh: rb && Math.round(rb.height), bw: rb && Math.round(rb.width), inWin: !!ri && ri.top >= 0 && ri.bottom <= innerHeight + 0.5 && rb.right <= innerWidth + 0.5 && ri.left >= 0, font: i && parseFloat(getComputedStyle(i).fontSize), place: i && i.placeholder };
};

(async () => {
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
  try {
    const pass = 'harbour-lantern-oak-' + String(Date.now() % 10000);
    await teacherRow('Admin', pass);
    // the pause is off before the run (an earlier run may have left one): the owner's undo of any pause in force
    for (const a of (await admin('GET', '/api/admin/teacher-acts?today=1')).data || []) if (a.act === 'pause' && a.inForce) await admin('POST', '/api/admin/teachers/undo', { act: a.id });
    const sam = await realKid(browser, 'Samwise'), ava = await realKid(browser, 'Avalon');
    const tctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const tp = await tctx.newPage(); tp.errors = []; tp.on('pageerror', e => tp.errors.push(String(e)));
    await signInCard(tp, 'Admin', pass);
    const box = await tp.evaluate(BOX);
    line('the teacher screen (1280 x 800) has the chat box under the chat: shown, in the window, input and Send 44 px, 16 px type, "Say to all, as Admin"', box.shown && box.inWin && box.ih >= 44 && box.bh >= 44 && box.bw >= 44 && box.font >= 16 && box.place === 'Say to all, as Admin', box);

    // ---- 1. Admin types a line, Enter ----
    const L1 = 'Hello knights, ten minutes left ' + (Date.now() % 1000);
    await tp.fill('#tv-say input', L1); await tp.press('#tv-say input', 'Enter');
    const samGot = await kidHas(sam, L1), avaGot = await kidHas(ava, L1);
    const sl = await kidLast(sam), al = await kidLast(ava);
    line("two kids' game pages show the line in their chat under 'Admin' with the admin role (drawn in the admin's gold)", samGot && avaGot && sl.n === 'Admin' && al.n === 'Admin' && sl.role === 'admin' && al.role === 'admin' && sl.text === L1, { samGot, avaGot, sl, al });
    // the colour as the game draws it (74-chat nameColour: an admin's name is the gold)
    // the strip as the kid's game draws it, into a recording canvas: the name "Admin:" is filled in the admins' gold
    const gold = await sam.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 1000; c.height = 700; const g = c.getContext('2d'); const seen = [];
      const ft = g.fillText.bind(g); g.fillText = (t, x, y, w) => { seen.push([String(t), String(g.fillStyle)]); return ft(t, x, y, w); };
      CHAT.drawStrip(g);
      return seen.filter(([t]) => t === 'Admin:').map(([, f]) => f);
    });
    line("the kid's game draws the name 'Admin:' on its chat strip in the admins' gold (#f5c542)", gold.length > 0 && gold.every(f => f.toLowerCase() === '#f5c542'), gold);
    await wait(400); await shot(sam, '01-kid-samwise-sees-admin'); await shot(ava, '02-kid-avalon-sees-admin');
    const empty = await tp.inputValue('#tv-say input');
    const panel = await tp.evaluate(() => { const rows = Array.from(document.querySelectorAll('#tv-chat .ln')); const r = rows[rows.length - 1]; return r ? { text: r.textContent, gold: !!r.querySelector('.n.admin'), pill: (r.querySelector('.pill') || {}).textContent || null } : null; });
    line("the teacher's own chat panel shows it as hers (Admin, gold, TEACHER) and the box is empty again", !!panel && panel.text.includes('Admin') && panel.text.includes(L1) && panel.gold && panel.pill === 'TEACHER' && empty === '', { panel, empty });
    await shot(tp, '03-teacher-screen-line-sent');

    // ---- 2. /admin's chat log ----
    const log = (await admin('GET', '/api/admin/chat?limit=50')).data || [];
    const mine = log.filter(r => r.text === L1);
    line("/admin's chat log keeps the line under 'Admin', marked as the teacher's", mine.length === 1 && mine[0].n === 'Admin' && mine[0].teacher === true, { mine });
    const owner = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await owner.goto(BASE + '/admin'); await owner.fill('#key', KEY); await owner.click('#usekey');
    await owner.waitForFunction(t => document.getElementById('chat') && document.getElementById('chat').textContent.includes(t), L1, { timeout: 20000 });
    const ownerRow = await owner.evaluate(t => { const d = Array.from(document.querySelectorAll('#chat div')).find(x => x.textContent.includes(t)); return d ? { text: d.textContent, gold: !!d.querySelector('.n.admin') } : null; }, L1);
    line("/admin's page draws it as 'Admin (teacher): ...' in the admins' gold", !!ownerRow && ownerRow.text.includes('Admin (teacher): ' + L1) && ownerRow.gold, ownerRow);
    await owner.evaluate(t => { const d = Array.from(document.querySelectorAll('#chat div')).find(x => x.textContent.includes(t)); if (d) d.scrollIntoView({ block: 'center' }); }, L1);
    await shot(owner, '04-admin-chat-log');

    // ---- 3. a pause: a kid cannot talk, the teacher can ----
    await tp.evaluate(() => { const b = Array.from(document.querySelectorAll('#tv-chatfoot button')).find(x => x.textContent === '5 minutes'); if (b) b.click(); });
    await wait(800);
    const kidTok = await knight('Forgewell'), forger = await bare(kidTok); await wait(500);
    forger.send({ t: 'chat', text: 'paused kid line' }); await wait(800);
    const refused = forger.got.some(m => m.t === 'muted' && m.by === 'pause') && !(await sam.evaluate(() => CHAT.log.some(l => l.text === 'paused kid line')));
    await wait(1700);
    const L2 = 'Chat is paused, eyes up here please';
    await tp.fill('#tv-say input', L2); await tp.click('#tv-say button');
    const through = await kidHas(sam, L2) && await kidHas(ava, L2);
    line('while a teacher pause runs, a kid\'s line is refused (muted by pause) and the teacher\'s still reaches both kids', refused && through, { refused, through, forger: forger.got.map(m => m.t).slice(-5) });
    await shot(tp, '05-teacher-talks-while-paused');
    await tp.evaluate(() => { const b = Array.from(document.querySelectorAll('#tv-chatfoot button')).find(x => x.textContent === 'Turn chat back on'); if (b) b.click(); });
    await wait(1700);

    // ---- 4. a kid cannot forge a teacher's line ----
    // (each run's words are its own, so an earlier run's lines on the same local world are not counted)
    const run = String(Date.now() % 100000), F1 = 'I am Admin now ' + run, F2 = 'a w_say from a kid ' + run;
    forger.send({ t: 'chat', text: F1, teacher: true, role: 'admin', n: 'Admin' }); await wait(1700);
    forger.send({ t: 'w_say', text: F2 }); await wait(1000);
    const seen = await ava.evaluate(([a, b]) => CHAT.log.filter(l => l.text === a || l.text === b).map(l => ({ n: l.n, role: l.role, text: l.text })), [F1, F2]);
    const forged = ((await admin('GET', '/api/admin/chat?limit=50')).data || []).filter(r => r.text === F1 || r.text === F2);
    line("NEGATIVE: a kid's chat dressed as a teacher's arrives as his own plain line (Forgewell, player); a w_say from a kid's socket says nothing", seen.length === 1 && seen[0].n === 'Forgewell' && seen[0].role === 'player' && forged.length === 1 && forged[0].n === 'Forgewell' && !forged[0].teacher, { seen, forged });

    // ---- 5. an iPad, upright and sideways ----
    for (const [w, h, nm] of [[820, 1180, 'upright'], [1180, 820, 'sideways']]) {
      const ictx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const ip = await ictx.newPage();
      await signInCard(ip, 'Admin', pass);
      await wait(600);
      const b = await ip.evaluate(BOX);
      const L3 = 'From the iPad ' + nm;
      await ip.tap('#tv-say input'); await ip.fill('#tv-say input', L3); await ip.tap('#tv-say button');
      const got = await kidHas(sam, L3);
      line('iPad ' + nm + ' (' + w + ' x ' + h + '): the box is shown in the window, input and Send 44 px, 16 px type; a tap on Send reaches the kids', b.shown && b.inWin && b.ih >= 44 && b.bh >= 44 && b.font >= 16 && got, Object.assign({ got }, b));
      await shot(ip, '06-ipad-' + nm);
      await ictx.close();
      await wait(1700);
    }
    const errs = [].concat(sam.errors, ava.errors, tp.errors);
    line('no page errors on the kids\' pages or the teacher screen', errs.length === 0, errs.slice(0, 5));
    try { forger.ws.close(); } catch (e) { }
  } finally { await browser.close(); }
  const bad = results.filter(r => !r).length;
  console.log(bad ? 'teacher-chat-browser: ' + bad + ' FAIL of ' + results.length : 'teacher-chat-browser: ALL ' + results.length + ' PASS');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
