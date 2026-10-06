#!/usr/bin/env node
// tools/teacher-browser.mjs — the teacher view's watch screen in a REAL browser against a LOCAL world (docs/ONLINE.md,
// "The teacher view"). It starts nothing itself: run, in online/,
//   sed -e '/^\[\[routes\]\]$/,$d' wrangler.toml > wrangler.local.toml      (no routes: the page's own address reaches the worker)
//   CI=1 wrangler dev -c wrangler.local.toml --port 8851 --ip 127.0.0.1 --compatibility-date 2026-05-22 --var TEACHER_HOST:localhost
// with online/.dev.vars holding ADMIN_KEY=test-admin and INVITE_CODE=TEST-1234, then
//   node tools/teacher-browser.mjs            the checks at eight sizes (PASS/FAIL lines; exit 1 on a FAIL)
//   node tools/teacher-browser.mjs --proof    the owner's whole story, with screenshots (OUT=<dir>, default ~/.fanglands/work/teacher/proof)
// The game is on 127.0.0.1, the teacher page on localhost (TEACHER_HOST). 25 knights are made (or logged in again) with
// made-up addresses, so the local world's ten-new-knights-an-hour rule does not stop it. NEVER point it at a real world.
// Needs playwright-core and a Chromium, found as tools/dom-keys.js finds them; without them it says so and exits 0.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PW = [process.env.PLAYWRIGHT_CORE, path.join(os.homedir(), '.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core'), path.join(os.homedir(), 'Documents/Eden/node_modules/playwright-core')].filter(Boolean).find(p => fs.existsSync(p));
const EXE = [process.env.CHROMIUM, path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell')].filter(Boolean).find(p => fs.existsSync(p));
if (!PW) { console.log('teacher-browser: SKIPPED (no playwright-core found)'); process.exit(0); }
const PORT = process.env.PORT || '8851';
const BASE = process.env.BASE || 'http://127.0.0.1:' + PORT, TBASE = process.env.TBASE || 'http://localhost:' + PORT;
for (const b of [BASE, TBASE]) if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(b)) { console.error('teacher-browser: a local world only (' + b + ')'); process.exit(1); }
const KEY = process.env.ADMIN_KEY || 'test-admin', INVITE = process.env.INVITE || 'TEST-1234';
const PROOF = process.argv.includes('--proof');
const OUT = process.env.OUT || path.join(os.homedir(), '.fanglands/work/teacher/proof');
const { chromium } = require(PW);
const wait = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const line = (name, ok, info) => { results.push(!!ok); console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined && !ok ? '   ' + JSON.stringify(info).slice(0, 900) : '')); };

// ---------- the world, from outside ----------
async function api(method, p, body, headers = {}) {
  const r = await fetch(BASE + p, { method, headers: Object.assign({ 'content-type': 'application/json' }, headers), body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch (e) { }
  return { status: r.status, data };
}
const admin = (method, p, body) => api(method, p, body, { authorization: 'Bearer ' + KEY });
let ipN = 0;
async function knight(name) {
  const ip = '10.77.' + Math.floor(++ipN / 200) + '.' + (ipN % 200 + 1);
  let r = await api('POST', '/api/signup', { name, pass: 'sword', invite: INVITE }, { 'cf-connecting-ip': ip });
  if (r.status === 409) r = await api('POST', '/api/login', { name, pass: 'sword' }, { 'cf-connecting-ip': ip });
  if (r.status !== 200) throw new Error('knight ' + name + ': ' + JSON.stringify(r.data));
  // a knight sent off or muted by an earlier run starts clean
  await admin('POST', '/api/admin/mute', { name, span: 'off' });
  return { name, token: r.data.token };
}
// a kid's game, reduced to its socket: hello, presence, chat
function kid(k, p) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/ws?token=' + k.token);
    const K = { ws, name: k.name, got: [], p: Object.assign({ map: 'over', x: 6000, y: 3700 }, p), closed: null };
    ws.onmessage = ev => { try { K.got.push(JSON.parse(ev.data)); } catch (e) { } };
    ws.onclose = ev => { K.closed = ev.code; };
    ws.onerror = () => reject(new Error('socket ' + k.name));
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', v: 1 })); K.say(); resolve(K); };
    K.say = (extra) => { if (ws.readyState === 1) ws.send(JSON.stringify(Object.assign({ t: 'p', region: 'Somewhere', lv: 10, mv: false, sw: 0, act: null, mech: null, dead: false }, K.p, extra || {}))); };
    K.chat = text => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'chat', text })); };
  });
}
async function teacher(name, pass) {
  const list = (await admin('GET', '/api/admin/teachers')).data || [];
  const t = list.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!t) { const r = await admin('POST', '/api/admin/teachers', { name, pass }); if (r.status !== 200) throw new Error(JSON.stringify(r.data)); return r.data.id; }
  await admin('POST', t.off ? '/api/admin/teachers/on' : '/api/admin/teachers/pass', { id: t.id, pass });
  return t.id;
}

// ---------- the page, measured ----------
const MEASURE = () => {
  const out = { problems: [] };
  const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  out.hscroll = document.documentElement.scrollWidth > innerWidth + 0.5 || document.body.scrollWidth > innerWidth + 0.5;
  out.vscroll = document.documentElement.scrollHeight > innerHeight + 0.5;
  // every target: buttons, inputs, rows; 44 x 44 at least
  const targets = Array.from(document.querySelectorAll('button, input, [role=button]')).filter(vis);
  // a target cut by its scrolling panel is measured where it shows (only whole ones count)
  for (const e of targets) { const r = e.getBoundingClientRect(); if (r.width < 43.5 || r.height < 43.5) out.problems.push('small: ' + (e.textContent || e.id || e.className).trim().slice(0, 40) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }
  // buttons 8 px apart (rows and lines are stacked lists, a full row each)
  const bs = targets.filter(e => e.tagName === 'BUTTON').map(e => ({ e, r: e.getBoundingClientRect() }));
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const a = bs[i].r, b = bs[j].r;
    if (bs[i].e.contains(bs[j].e) || bs[j].e.contains(bs[i].e)) continue;
    const dx = Math.max(b.left - a.right, a.left - b.right), dy = Math.max(b.top - a.bottom, a.top - b.bottom), gap = Math.max(dx, dy);
    if (gap < 7.5) out.problems.push('close: "' + bs[i].e.textContent.trim().slice(0, 24) + '" / "' + bs[j].e.textContent.trim().slice(0, 24) + '" ' + Math.round(gap) + ' px');
  }
  // no text under 13 px
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim() || !n.parentElement || !vis(n.parentElement)) continue;
    const fs = parseFloat(getComputedStyle(n.parentElement).fontSize); if (fs < 12.9) out.problems.push('tiny text ' + fs + 'px: ' + n.textContent.trim().slice(0, 30));
  }
  const rect = id => { const e = document.getElementById(id); if (!e || !vis(e)) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
  out.bar = rect('bar'); out.mid = rect('mid'); out.chat = rect('chat'); out.who = rect('who'); out.mapbox = rect('mapbox');
  out.w = innerWidth; out.h = innerHeight;
  return out;
};

const SIZES = [[1366, 768], [1280, 800], [1180, 820], [1024, 768], [834, 1194], [810, 1080], [768, 1024], [390, 844]];

async function signIn(page, name, pass) {
  await page.goto(BASE + '/teacher');   // fanglands.com/teacher sends to the teacher address
  await page.waitForSelector('#tname', { timeout: 15000 });
  await page.fill('#tname', name); await page.fill('#tpass', pass);
  await page.click('button.go');
  await page.waitForFunction(() => window.__teacher && window.__teacher.status === 'live' && window.__teacher.lines !== undefined, null, { timeout: 15000 });
}

async function checks() {
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
  const tName = 'Mrs Smith', tPass = 'maple-river-lantern-42';
  await teacher(tName, tPass);
  // 25 knights: nine on one tile, the rest about the world, two inside places
  const names = []; for (let i = 0; i < 25; i++) names.push('Kid ' + String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + i % 26));
  const ks = []; for (const n of names) ks.push(await knight(n));
  const spots = [[150, 92], [120, 60], [60, 120], [200, 50], [30, 30], [100, 150], [220, 160], [170, 110], [80, 80], [40, 160], [240, 20], [140, 40], [110, 100], [190, 140]];
  const kids = [];
  for (let i = 0; i < ks.length; i++) {
    const p = i < 9 ? { x: 125 * 48 + 20, y: 77 * 48 + 20 } : i === 23 ? { map: 'spider_den', x: 300, y: 200 } : i === 24 ? { map: 'house', x: 300, y: 300 } : { x: spots[i - 9][0] * 48, y: spots[i - 9][1] * 48 };
    kids.push(await kid(ks[i], p));
  }
  const alive = setInterval(() => { for (const k of kids) k.say(); }, 1000);
  kids[1].chat('anyone want to fight goblins'); await wait(1600); kids[2].chat('you are so dumb lol'); await wait(1600); kids[3].chat('lets go to the spider den');
  try {
    for (const [w, h] of SIZES) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: w < 1100, isMobile: false });
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', e => errors.push(String(e)));
      await signIn(page, tName, tPass);
      await page.waitForFunction(n => window.__teacher.knights.length >= n, 25, { timeout: 15000 });
      await wait(700);
      const m = await page.evaluate(MEASURE);
      const tag = w + 'x' + h;
      line(tag + ': no horizontal scroll, no page scroll', !m.hscroll && !m.vscroll, m);
      line(tag + ': every target 44 x 44 or more, buttons 8 px apart, no text under 13 px', m.problems.length === 0, m.problems.slice(0, 12));
      if (w >= 900) line(tag + ': the map is the middle column' + (w <= 1024 ? ', at least 460 px wide' : ''), m.mid && m.chat && m.who && m.chat.r <= m.mid.l + 1 && m.mid.r <= m.who.l + 1 && (w > 1024 || m.mid.w >= 460) && m.mid.b <= h + 1, { mid: m.mid, chat: m.chat, who: m.who });
      else line(tag + ': the map is full width, directly under the bar, on screen without scrolling', m.mid && Math.abs(m.mid.w - w) <= 1 && Math.abs(m.mid.t - m.bar.b) <= 1 && m.mid.b <= h, { mid: m.mid, bar: m.bar });
      // nine knights on one tile: one "9"
      const dots = await page.evaluate(() => window.__teacher.dotsNow());
      line(tag + ': nine knights on one tile make one circle of 9', dots.some(d => d.names.length === 9), dots.map(d => d.names.length));
      // a tap on a single dot opens that knight's bar (the bottom sheet under 900 px)
      const one = dots.find(d => d.names.length === 1);
      const cv = await page.$('#map'), box = await cv.boundingBox();
      if (one) await page.mouse.click(box.x + one.x, box.y + one.y);
      await wait(300);
      const sel = await page.evaluate(() => ({ sel: window.__teacher.selected, sheet: !!document.querySelector('#sheet.up'), bar: !!document.querySelector('#who .actions') && getComputedStyle(document.querySelector('#who .actions')).display !== 'none' }));
      line(tag + ': a tap on a dot selects that knight and opens ' + (w < 900 ? 'the bottom sheet' : 'his bar'), one && sel.sel === one.names[0] && (w < 900 ? sel.sheet : sel.bar), { one, sel });
      if (w < 900) { const m2 = await page.evaluate(MEASURE); line(tag + ': with the sheet up, still every target 44 x 44 and 8 px apart', m2.problems.length === 0, m2.problems.slice(0, 8)); }
      line(tag + ': no page errors', errors.length === 0, errors);
      if ([1280, 1024, 768].includes(w)) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, 'watch-' + tag + '.png') }); }
      await ctx.close();
    }
  } finally {
    clearInterval(alive);
    for (const k of kids) try { k.ws.close(); } catch (e) { }
    await browser.close();
  }
}

// ---------- the owner's whole story, with screenshots ----------
async function proof() {
  fs.mkdirSync(OUT, { recursive: true });
  const shot = async (page, name) => { const p = path.join(OUT, name + '.png'); await page.screenshot({ path: p }); console.log('      screenshot ' + p); };
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
  try {
    // 1. the owner, on /admin, adds a teacher with Make one up
    const owner = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    owner.on('dialog', d => d.accept());
    await owner.goto(BASE + '/admin');
    await owner.fill('#key', KEY); await owner.click('#usekey');
    await owner.waitForSelector('#teachers tbody tr', { timeout: 15000 });
    const tName = 'Mr Lee ' + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(97 + Math.floor(Math.random() * 26));
    await owner.fill('#tname', tName); await owner.click('#tmake');
    const pass = await owner.inputValue('#tpass');
    await owner.click('#tadd');
    await owner.waitForFunction(n => document.getElementById('tsaid').textContent.startsWith('Added ' + n), tName, { timeout: 15000 });
    const said = await owner.textContent('#tsaid');
    line('the owner adds a teacher on /admin with Make one up, and the page shows the password once: "' + said + '"', /^[a-z]+-[a-z]+-[a-z]+-\d\d$/.test(pass) && said.includes(pass) && said.includes('fanglands.com/teacher'), { said, pass });
    await owner.evaluate(() => document.getElementById('tsaid').scrollIntoView());
    await shot(owner, '1-admin-teacher-added');
    // 2. two kids play: Sam and Ava, moving and chatting
    const sam = await kid(await knight('Sam'), { x: 125 * 48, y: 77 * 48 }), ava = await kid(await knight('Ava'), { x: 127 * 48, y: 77 * 48 });
    let step = 0;
    const alive = setInterval(() => { step++; sam.p.x = 125 * 48 + (step % 20) * 6; sam.say({ mv: true }); ava.say(); }, 1000);
    // 3. the teacher signs in at fanglands.com/teacher and gets the watch screen, never the game
    const tctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const tp = await tctx.newPage();
    await signIn(tp, tName, pass);
    const isWatch = await tp.evaluate(() => ({ url: location.href, game: !!window.FANGLANDS, watch: !!document.getElementById('mapbox') }));
    line('the teacher signs in at /teacher (sent to the teacher address) and gets the watch screen, never the game', isWatch.watch && !isWatch.game && isWatch.url.startsWith(TBASE), isWatch);
    sam.chat('anyone want to fight goblins'); await wait(1700); ava.chat('ya lets go'); await wait(1700); sam.chat('you are so dumb lol'); await wait(2500);
    const seen = await tp.evaluate(() => ({ lines: window.__teacher.lines.filter(l => l.kind === 'line').map(l => l.n + ': ' + l.text), knights: window.__teacher.knights.map(k => k.n + ' ' + k.place + ' ' + k.doing) }));
    line('the teacher sees both kids on the map and their chat, starred as they saw it', seen.knights.length >= 2 && seen.lines.some(l => l === 'Sam: anyone want to fight goblins') && seen.lines.some(l => /Sam: you are so \*+ lol/.test(l)), seen);
    await shot(tp, '2-watch-1280x800');
    // 4. mute Sam for 10 minutes from his row
    await tp.click('#who .row:has-text("Sam")');
    await tp.click('#who .actions button:has-text("Mute 10 min")');
    await wait(800);
    const muted = sam.got.filter(m => m.t === 'muted').pop();
    line('the teacher mutes Sam for 10 minutes: his game hears "by teacher"', muted && muted.by === 'teacher' && muted.left === 600, muted);
    sam.chat('can anyone hear me'); await wait(600);
    line('Sam\'s next line is refused, and Ava never sees it', !ava.got.some(m => m.t === 'chat' && m.text === 'can anyone hear me'));
    await shot(tp, '3-sam-muted');
    // undo it from the toast
    await tp.click('#toast button:has-text("Undo")'); await wait(800);
    line('Undo gives Sam his chat back ("A teacher turned your chat back on.")', sam.got.filter(m => m.t === 'unmuted').pop() && sam.got.filter(m => m.t === 'unmuted').pop().by === 'teacher');
    // 5. pause chat for everyone, then turn it back on
    await tp.click('.controls button:has-text("5 minutes")'); await wait(800);
    line('Pause chat for everyone: both games hear it, and the banner says who', sam.got.some(m => m.t === 'chat_pause' && m.left === 300) && ava.got.some(m => m.t === 'chat_pause' && m.left === 300) && (await tp.textContent('#banners')).includes('paused it'));
    await shot(tp, '4-chat-paused');
    await tp.click('#banners button:has-text("Turn chat back on")'); await wait(800);
    line('Turn chat back on: both games hear left 0', sam.got.some(m => m.t === 'chat_pause' && m.left === 0));
    // 6. send Ava off for the day: two taps
    await tp.click('#who .row:has-text("Ava")');
    await tp.click('#who .actions button:has-text("Send off for today")');
    const ask = await tp.textContent('#who .actions');
    await tp.click('#who .actions button:has-text("Yes, send Ava off")'); await wait(1000);
    const err = ava.got.filter(m => m.t === 'error').pop();
    line('Send off for today takes two taps ("' + ask.replace(/Yes.*$/, '').trim() + '"); Ava\'s game hears kicked why sentoff and closes 4005', /Send Ava off Fanglands until midnight\? Ava's knight is safe and saved\./.test(ask) && err && err.code === 'kicked' && err.why === 'sentoff' && ava.closed === 4005, { ask, err, closed: ava.closed });
    const back = await api('POST', '/api/login', { name: 'Ava', pass: 'sword' });
    line('Ava cannot log in again today: 423 sentoff', back.status === 423 && back.data.code === 'sentoff', back);
    await shot(tp, '5-ava-sent-off');
    // let her back in from "Sent off for today"
    await tp.click('#who button:has-text("Let Ava back in")'); await wait(800);
    line('Let Ava back in: she can log in again', (await api('POST', '/api/login', { name: 'Ava', pass: 'sword' })).status === 200);
    // 7. what admins did, on /admin
    await owner.click('#refresh'); await wait(1500);
    const log = await owner.textContent('#modlog');
    line('/admin "What admins did" names the teacher for every action', [tName + ' (teacher) signed in to the teacher view', tName + ' (teacher) muted Sam for 10 minutes', tName + " (teacher) turned Sam's chat back on", tName + ' (teacher) paused chat for everyone for 5 minutes', tName + ' (teacher) turned chat back on', tName + ' (teacher) sent Ava off for the rest of the day', tName + ' (teacher) let Ava back in'].every(s => log.includes(s)), log.slice(0, 1200));
    // 8. other sizes of the same screen
    for (const [w, h] of [[1024, 768], [768, 1024]]) { await tp.setViewportSize({ width: w, height: h }); await wait(500); await shot(tp, '6-watch-' + w + 'x' + h); }
    await tp.setViewportSize({ width: 1280, height: 800 });
    // 9. the owner gives a new password: the open screen is cut at once
    const row = owner.locator('#teachers tbody tr', { hasText: tName });
    await row.locator('button:has-text("New password")').click(); await wait(1500);
    const cut = await tp.evaluate(() => ({ card: !document.getElementById('signin').hidden, said: document.querySelector('#signin .said').textContent }));
    line('New password on /admin cuts the open watch screen at once: "' + cut.said + '"', cut.card && cut.said === 'Your password was changed. Sign in with the new one.', cut);
    await shot(tp, '7-cut-new-password');
    const newPass = (await owner.textContent('#tsaid')).match(/[a-z]+-[a-z]+-[a-z]+-\d\d/)[0];
    await signIn(tp, tName, newPass);
    await tp.waitForFunction(() => window.__teacher.knights.length >= 1, null, { timeout: 15000 }); await wait(500);
    await row.locator('button:has-text("Turn off")').click(); await wait(2000);
    const off = await tp.evaluate(() => document.querySelector('#signin .said').textContent);
    if (off !== 'Ethan turned this sign-in off.') console.log('      page state: ' + JSON.stringify(await tp.evaluate(() => ({ st: window.__teacher.status, tok: !!window.__teacher.token, card: !document.getElementById('signin').hidden }))));
    line('Turn off cuts it too: "' + off + '", and signing in says it was turned off', off === 'Ethan turned this sign-in off.');
    await tp.fill('#tname', tName); await tp.fill('#tpass', newPass); await tp.click('button.go'); await wait(1500);
    const offErr = await tp.textContent('#signin .err');
    line('a turned-off teacher signing in reads "' + offErr + '"', offErr === 'This sign-in was turned off. Ask Ethan.');
    await shot(tp, '8-turned-off');
    await owner.evaluate(() => document.getElementById('teachers').scrollIntoView());
    await shot(owner, '9-admin-teachers');
    clearInterval(alive); sam.ws.close();
  } finally { await browser.close(); }
}

try { if (PROOF) await proof(); else await checks(); } catch (e) { line('the run itself', false, String(e && e.stack || e)); }
const bad = results.filter(r => !r).length;
console.log(bad ? `teacher-browser: ${bad} FAIL of ${results.length}` : `teacher-browser: all ${results.length} PASS`);
process.exit(bad ? 1 : 0);
