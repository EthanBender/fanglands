// ============================================================================
// UX — the glue that keeps a ten-year-old oriented: auto-tracked story, map targets, a dialogue box that waits,
// a "Said" log, touch key names, two-tap confirmations, panel paging, kid mode, a banner queue.
// Everything here is read by 05-input / 10-hud; feature files may read HUD_LAYOUT, keyName, MAP_TARGETS, window.__kidmode.
// ============================================================================

// ---------- touch mode (honours a test override) ----------
function touchMode() { return window.__forceTouch === true || (window.__forceTouch !== false && isTouch); }

// ---------- kid mode: exposed only; the balance code reads window.__kidmode ----------
window.__kidmode = false;
try { window.__kidmode = localStorage.getItem('fanglands.kidmode') === '1'; } catch (e) { }
function toggleKidMode() { window.__kidmode = !window.__kidmode; try { localStorage.setItem('fanglands.kidmode', window.__kidmode ? '1' : '0'); } catch (e) { } }

// ---------- key names: what the button is called on this device ----------
const TOUCH_KEY_NAMES = { E: 'USE', SPACE: 'SWING', Q: 'Bag › Place', I: 'BAG', C: 'CRAFT', J: 'QUESTS', M: 'the minimap', H: 'HOME', X: 'EXIT', TAB: 'SKILLS', ENTER: 'tap' };
const DESKTOP_KEY_NAMES = { SPACE: 'Space', TAB: 'Tab', ENTER: 'Enter' };
function keyName(k) { const u = String(k).toUpperCase(); return touchMode() ? (TOUCH_KEY_NAMES[u] || k) : (DESKTOP_KEY_NAMES[u] || u); }
// Post-processor for strings owned by other files: on touch, "press E" → "tap USE", "(J)" → "(QUESTS)", "Space" → "SWING", "X climbs" → "EXIT climbs".
const KEY_WORD = { E: 'USE', Q: 'Bag › Place', I: 'BAG', C: 'CRAFT', J: 'QUESTS', M: 'the minimap', H: 'HOME', X: 'EXIT', TAB: 'SKILLS', SPACE: 'SWING' };
function touchify(text) {
  if (!touchMode() || typeof text !== 'string') return text;
  return text
    .replace(/\b(press|Press) (E|Q|I|C|J|M|H|X|Space)\b/g, (m, p, k) => (p === 'Press' ? 'Tap ' : 'tap ') + KEY_WORD[k.toUpperCase()])
    .replace(/\((E|Q|I|C|J|M|H|X|Tab|Space)\)/g, (m, k) => '(' + KEY_WORD[k.toUpperCase()] + ')')
    .replace(/\bX (climbs|to climb)\b/g, (m, r) => 'EXIT ' + r)
    .replace(/\bSpace\b/g, 'SWING');
}

// ---------- dialogue log ("Said" tab) + the say/notify wrappers ----------
const dialogLog = []; // last 30 {text, who}
{
  const _say = say;
  say = (text, who) => { const t = touchify(text); dialogLog.push({ text: t, who: who || 'The Voice', at: time }); while (dialogLog.length > 30) dialogLog.shift(); return _say(t, who); };
  const _notify = notify;
  notify = text => _notify(touchify(text));
  const _openPanel = openPanel;
  openPanel = (name, arg) => { recipeTab = null; recipePage = 0; bankPage = 0; questsTab = 'quests'; uxConfirm = null; return _openPanel(name, arg); };
}
// dialogue box height for a line: the HUD computes wrapped lines with the same width it draws with
function dialogLines(g, text, maxW) { const words = text.split(' '); let line = '', n = 1; for (const w of words) { const test = line ? line + ' ' + w : w; if (g.measureText(test).width > maxW && line) { line = w; n++; } else line = test; } return n; }
let dialogRect = null; // {x, y, w, h} of the drawn dialogue box (set by drawHud every frame it is shown)
function inRect(x, y, r) { return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
function joystickZone(x, y) { return touchMode() && x < 230 && y > VH - 180; } // the idle stick circle; never overlaps the box, but a tap there moves, it does not skip talk
function dialogHit(x, y) { return !!dialog.cur && inRect(x, y, dialogRect) && !joystickZone(x, y); }

// ---------- panel rect (tap outside closes, tap inside is absorbed) ----------
let panelRect = null;

// ---------- two-tap confirmations ----------
let uxConfirm = null; // {label, until}
const nowMs = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
function confirmActive(label) { return !!uxConfirm && uxConfirm.label === label && nowMs() < uxConfirm.until; }
// first call arms (returns false), second call within 3 s runs the action (returns true)
function confirmTap(label, action) {
  if (confirmActive(label)) { uxConfirm = null; action(); return true; }
  uxConfirm = { label, until: nowMs() + 3000 }; sfx('open'); return false;
}
const needsConfirm = def => !!(def && (def.weapon || def.armour || def.tool || def.value >= 100));

// ---------- paging state ----------
let recipeTab = null, recipePage = 0, bankPage = 0, questsTab = 'quests';
const RECIPE_TIERS = [['Bronze/Iron', /^(bronze|iron)_/], ['Steel', /^steel_/], ['Mithril', /^mithril_/], ['Godly', /^godly_/]];
function recipeTier(r) { const id = r.out || ''; for (const [name, re] of RECIPE_TIERS) if (re.test(id)) return name; return 'Other'; }

// ---------- map targets ----------
// Tile coordinates. MAP_TARGETS[stage] is the main-story default; HOOKS.mapTarget fns return {x, y, label, id} or null.
const MAP_TARGETS = {
  0: { x: 65, y: 27, label: 'The signpost' }, 1: { x: 65, y: 27, label: 'The signpost' }, 2: { x: 65, y: 27, label: 'The signpost' }, 3: { x: 65, y: 27, label: 'The signpost' }, 4: { x: 65, y: 27, label: 'The signpost' },
  5: { x: 112, y: 49, label: 'Duke Ferrin' }, 6: { x: 112, y: 49, label: 'Duke Ferrin' },
  7: { x: 152, y: 30, label: 'The goblin walker' },
  8: { x: 140, y: 76, label: 'Hollowford' }, 9: { x: 140, y: 76, label: 'Hollowford' }, 10: { x: 140, y: 76, label: 'Hollowford' },
  11: { x: 66, y: 100, label: 'Dunstan, the Ashfields' }, 12: { x: 66, y: 100, label: 'Dunstan, the Ashfields' }, 13: { x: 66, y: 100, label: 'Dunstan, the Ashfields' },
  14: { x: 18, y: 108, label: "The Fang's lair" },
  15: { x: 112, y: 49, label: 'Duke Ferrin' }, 16: { x: 112, y: 49, label: 'Castle Thistledown' },
};
HOOKS.mapTarget = [];
function mainTarget() {
  const s = quest.stage;
  if (s === 7 && quest.walkerKilled) return { ...MAP_TARGETS[5], id: 'main' };
  const t = MAP_TARGETS[s] || MAP_TARGETS[16]; return t ? { ...t, id: 'main' } : null;
}
HOOKS.mapTarget.push(mainTarget);
HOOKS.mapTarget.push(() => quest.bread === 'active' ? { x: 110, y: 33, label: 'Tobin', id: 'bread' } : null);
HOOKS.mapTarget.push(() => quest.wren === 'active' ? { x: 30, y: 78, label: 'Old Wren', id: 'wren' } : null);
HOOKS.mapTarget.push(() => { const a = activeQuests(); return a.includes('board') ? { x: 105, y: 27, label: 'Notice board', id: 'board' } : null; });
HOOKS.mapTarget.push(() => activeQuests().includes('law') ? { x: 110, y: 41, label: 'Captain of the Watch', id: 'law' } : null);
HOOKS.mapTarget.push(() => activeQuests().includes('dragons') ? { x: 66, y: 100, label: 'Dunstan', id: 'dragons' } : null);
function mapTargets() { const out = []; for (const f of HOOKS.mapTarget) { let t = null; try { t = f(); } catch (e) { t = null; } if (t && typeof t.x === 'number' && typeof t.y === 'number') out.push(t); } return out; }
function trackedTarget() { if (!quest.tracked) return null; return mapTargets().find(t => t.id === quest.tracked) || null; }

// ---------- banner queue ----------
let bannerQueue = []; // displaced level banners, drawn 40 px under the live one
let _lastBanner = null;

// ---------- HUD layout shared with feature files (filled by drawHud every frame) ----------
const HUD_LAYOUT = { narrow: false, short: false, hotbarY: 0, hotbarH: 44, questY: 0, questH: 0, noticeY: 84, topStackBottom: 76, bossBarY: 84 };

// ---------- auto-track + timers ----------
let _lastStage = -1;
HOOKS.update.push(dt => {
  if (quest.stage !== _lastStage) { _lastStage = quest.stage; if (!quest.untrackedByPlayer) quest.tracked = 'main'; }
  if (quest.tracked && quest.tracked !== 'main' && !activeQuests().includes(quest.tracked) && !quest.untrackedByPlayer) quest.tracked = 'main';
  if (levelBanner !== _lastBanner) {
    if (_lastBanner && levelBanner && _lastBanner.t > 0.3) bannerQueue = [_lastBanner];
    _lastBanner = levelBanner;
  }
  for (const b of bannerQueue) b.t -= dt;
  bannerQueue = bannerQueue.filter(b => b.t > 0);
});
HOOKS.newGame.push(() => { quest.tracked = 'main'; quest.untrackedByPlayer = false; _lastStage = quest.stage; bannerQueue = []; _lastBanner = null; dialogLog.length = 0; uxConfirm = null; });

// ---------- self-test ----------
HOOKS.selfTest.push((check, F, h) => {
  const prevTouch = window.__forceTouch;
  // auto-track
  { const t0 = quest.tracked, u0 = quest.untrackedByPlayer; quest.tracked = null; quest.untrackedByPlayer = false; const s = quest.stage; quest.stage = s + 1; F.step([]); const auto = quest.tracked === 'main'; quest.stage = s; F.step([]);
    quest.untrackedByPlayer = true; quest.tracked = null; quest.stage = s + 1; F.step([]); const kept = quest.tracked === null; quest.stage = s; F.step([]); quest.untrackedByPlayer = u0; quest.tracked = t0;
    check('ux: main quest auto-tracks on a stage change, unless the player untracked it', auto && kept, { auto, kept }); }
  // key names + touchify
  { window.__forceTouch = true; const a = keyName('E'), b = keyName('Space'), c = touchify('Press E to climb in.'), d = touchify('Open your quests (J) if you lose the thread.'), e = touchify('You are in the walker. Space stomps (knockback). X climbs out.'), f = touchify('Lodestone placed. Press H to return (5 minute cooldown).'), g2 = touchify('Nothing to place. Craft planks (C) first.');
    window.__forceTouch = false; const dk = keyName('E'), ds = keyName('Space'), dn = touchify('Press E to climb in.');
    window.__forceTouch = prevTouch;
    check('ux: keyName + touchify rename keys on touch only', a === 'USE' && b === 'SWING' && c === 'Tap USE to climb in.' && d === 'Open your quests (QUESTS) if you lose the thread.' && e === 'You are in the walker. SWING stomps (knockback). EXIT climbs out.' && f === 'Lodestone placed. Tap HOME to return (5 minute cooldown).' && g2 === 'Nothing to place. Craft planks (CRAFT) first.' && dk === 'E' && ds === 'Space' && dn === 'Press E to climb in.', { a, b, c, d, e, f, g2, dk, ds, dn }); }
  // dialogue: box rect is the tap zone, no auto-advance before 4 + len/9 s, log keeps lines
  { const saved = { cur: dialog.cur, q: dialog.queue.slice() }; dialog.queue.length = 0; dialog.cur = null; paused = false; closePanel();
    const n0 = dialogLog.length; say('Testing the box. Tap it to continue, knight.', 'The Voice'); F.step([]); render();
    const cur = dialog.cur && dialog.cur.text; const r = dialogRect && { ...dialogRect }; const logged = dialogLog.length === n0 + 1 && dialogLog[dialogLog.length - 1].text === cur;
    pointerDown(r ? r.x - 5 : -1, r ? r.y - 5 : -1, 'mouse'); const stillThere = !!dialog.cur;
    pointerDown(r.x + r.w / 2, r.y + r.h / 2, 'mouse'); const gone = !dialog.cur;
    say('A'.repeat(90), 'The Voice'); F.step([]); F.sim(60 * 9, []); const notYet = !!dialog.cur; F.sim(60 * 6, []); const autoLater = !dialog.cur;
    check('ux: dialogue box is the tap zone (outside: stays, inside: advances), auto-advances only after 4 + len/9 s, Said log records it', !!cur && !!r && logged && stillThere && gone && notYet && autoLater, { cur, r, logged, stillThere, gone, notYet, autoLater });
    dialog.cur = null; dialog.queue.length = 0; dialog.queue.push(...saved.q); if (saved.cur) dialog.queue.unshift(saved.cur); }
  // two-tap confirmations
  { let n = 0; const first = confirmTap('t1', () => n++); const second = confirmTap('t1', () => n++); uxConfirm = null;
    const s0 = quest.stage, lv = player.skills.melee.xp; paused = true; render(); const b1 = F.clickButton('New game'); render(); const armed = buttons.some(b => b.label.startsWith('Really erase')) && quest.stage === s0 && player.skills.melee.xp === lv; paused = false; uxConfirm = null; render();
    check('ux: New game needs two taps (first arms "Really erase? Tap again", nothing erased)', first === false && second === true && n === 1 && b1 && armed, { first, second, n, b1, armed }); }
  { const inv0 = player.inv.map(s => s ? { ...s } : null); const d0 = drops.length; player.inv[0] = { id: 'iron_dagger', qty: 1 }; openPanel('inventory'); render(); F.clickButton('slot0'); render(); const c1 = F.clickButton('Drop'); render(); const still = player.inv[0] && player.inv[0].id === 'iron_dagger' && buttons.some(b => b.label.startsWith('Tap again')); const c2 = F.clickButton('Tap again'); render(); const dropped = !player.inv[0] && drops.length === d0 + 1; closePanel(); drops.length = d0; player.inv = inv0;
    check('ux: dropping a weapon needs a second tap', c1 && still && c2 && dropped, { c1, still, c2, dropped }); }
  // recipe tabs + paging on the anvil (26 recipes)
  { openPanel('station', 'anvil'); render(); const per = Math.max(2, Math.min(8, Math.floor((panelRect.h - 92 - 54) / 40))); const vis = () => buttons.filter(b => b.x >= 0 && b.label.includes('→')).map(b => b.label); const p0 = vis(); const tabs = buttons.filter(b => ['Bronze/Iron', 'Steel', 'Mithril', 'Godly', 'Other'].includes(b.label.replace(/^disabled:/, ''))).length; const n = F.clickButton('Next'); render(); const p1 = vis(); const m = F.clickButton('Mithril'); render(); const p2 = vis(); const anvil = RECIPES.filter(r => r.station === 'anvil'); const total = anvil.length, bi = anvil.filter(r => recipeTier(r) === 'Bronze/Iron').length; closePanel();
    check('ux: anvil recipes come in tier tabs, 8 per page, Prev/Next pages', total === 26 && p0.length === per && tabs >= 3 && n && p1.length === Math.min(per, bi - per) && p0[0] !== p1[0] && m && p2.length === Math.min(per, 8) && p2.every(l => /Mithril/.test(l)), { total, bi, per, p0: p0.length, p1: p1.length, tabs, p2: p2.length }); }
  // bank paging
  { const bank0 = player.bank.map(s => ({ ...s })); player.bank = []; for (let i = 0; i < 40; i++) player.bank.push({ id: i % 2 ? 'stone' : 'wood', qty: 1 + i }); openPanel('bank'); render(); const per = VW < 640 ? 15 : 30; const c0 = buttons.filter(b => b.label.startsWith('bank')).length; const n = F.clickButton('Next'); render(); const c1 = buttons.filter(b => b.label.startsWith('bank')).length; const pg = bankPage; const p = F.clickButton('Prev'); render(); const c2 = buttons.filter(b => b.label.startsWith('bank')).length; closePanel(); player.bank = bank0;
    check('ux: bank pages 30 slots at a time (15 narrow) with Prev/Next', c0 === per && n && pg === 1 && c1 === Math.min(per, 40 - per) && p && c2 === per, { c0, c1, c2, per, pg }); }
  // map targets
  { const missing = []; for (let s = 0; s <= 16; s++) if (!MAP_TARGETS[s] || typeof MAP_TARGETS[s].x !== 'number') missing.push(s); const ts = mapTargets(); const main = ts.find(t => t.id === 'main');
    check('ux: map targets exist for main stages 0–16 and the map lists a main target', missing.length === 0 && !!main && main.label.length > 0, { missing, main }); }
  // panel: a tap inside the panel body does not close it, outside does; disabled buttons are inert hit rects
  { const dc = dialog.cur; dialog.cur = null; openPanel('help'); render(); const r = panelRect && { ...panelRect }; pointerDown(r.x + 10, r.y + r.h - 10, 'mouse'); const kept = panel === 'help';
    const free = [[r.x - 5, r.y + r.h / 2], [r.x + r.w + 5, r.y + r.h / 2], [VW / 2, r.y - 5], [VW / 2, r.y + r.h + 5], [r.x - 5, r.y - 5]].find(([x, y]) => x >= 0 && y >= 0 && x < VW && y < VH && !buttons.some(b => inRect(x, y, b)) && !inRect(x, y, minimapRect)) || [r.x - 5, r.y - 5];
    pointerDown(free[0], free[1], 'mouse'); const closed = panel === null; closePanel(); dialog.cur = dc;
    buttons.length = 0; button(ctx, 10, 10, 50, 20, 'Nope', () => { }, '#000', false); const inert = buttons.length === 1 && buttons[0].label === 'disabled:Nope' && !F.clickButton('Nope'); buttons.length = 0;
    check('ux: taps inside a panel are absorbed, outside close it; disabled buttons are registered as no-ops', kept && closed && inert, { kept, closed, inert, r }); }
  // banner queue
  { levelBanner = { text: 'FIRST', sub: 'a', t: 3 }; F.step([]); levelBanner = { text: 'SECOND', sub: 'b', t: 3 }; F.step([]); const queued = bannerQueue.length === 1 && bannerQueue[0].text === 'FIRST' && levelBanner.text === 'SECOND'; levelBanner = null; bannerQueue = []; F.step([]);
    check('ux: a new level banner pushes the showing one into a second slot instead of replacing it', queued, { queued }); }
  // kid mode toggle is exposed
  { const k0 = window.__kidmode; toggleKidMode(); const on = window.__kidmode === !k0; toggleKidMode(); const back = window.__kidmode === k0; check('ux: kid mode toggle flips window.__kidmode', on && back, { on, back }); }
  window.__forceTouch = prevTouch;
});
