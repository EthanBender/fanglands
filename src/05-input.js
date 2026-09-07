// ============================================================================
// INPUT (keyboard + touch + mouse)
// ============================================================================
const keys = new Set();
const pressed = new Set();
window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(e.key)) e.preventDefault();
  if (!keys.has(e.code)) pressed.add(e.code);
  keys.add(e.code);
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const touch = { stickId: null, ox: 0, oy: 0, dx: 0, dy: 0, active: false, taps: [], press: null }; // press: {x, y, id, t0, held, moved} — a still finger becomes a tap-to-move (17-tap)
const buttons = []; // on-screen hit rects: {x,y,w,h,label,action}
let minimapRect = null;
// Order: on-screen buttons (disabled ones are inert rects) → pause menu swallows the rest → minimap → the dialogue box itself
// (dialogRect, set by drawHud; never the joystick zone) → an open panel (inside: absorbed, outside: closes) → joystick (touch, left half) →
// the press is remembered; pointerUp hands it to tapRelease (17-tap): a still finger walks / uses / fights, a moved one was a stick drag.
function pointerDown(x, y, id) {
  for (let i = buttons.length - 1; i >= 0; i--) { const b = buttons[i]; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { sfx('ui'); b.action(); return; } } // last registered = drawn on top = wins (panels over HUD)
  if (paused) return;
  if (minimapRect && x >= minimapRect.x && x <= minimapRect.x + minimapRect.w && y >= minimapRect.y && y <= minimapRect.y + minimapRect.h) { panel === 'map' ? closePanel() : openPanel('map'); return; }
  if (dialog.cur && dialogHit(x, y)) { advanceDialog(); return; }
  if (panel) { if (!inRect(x, y, panelRect)) closePanel(); return; }
  touch.press = { x, y, id, t0: nowMs(), held: 0, moved: 0 };
  if (touchMode() && x < VW * 0.5 && touch.stickId === null) { touch.stickId = id; touch.ox = x; touch.oy = y; touch.dx = 0; touch.dy = 0; touch.active = true; }
}
function pointerMove(x, y, id) {
  if (touch.press && touch.press.id === id) touch.press.moved = Math.max(touch.press.moved, Math.hypot(x - touch.press.x, y - touch.press.y));
  if (touch.stickId === id) { const dx = x - touch.ox, dy = y - touch.oy, d = Math.hypot(dx, dy), m = Math.min(d, 60) / 60; touch.dx = d ? dx / d * m : 0; touch.dy = d ? dy / d * m : 0; }
}
function pointerUp(id) {
  if (touch.stickId === id) { touch.stickId = null; touch.active = false; touch.dx = touch.dy = 0; }
  if (touch.press && touch.press.id === id) { const p = touch.press; touch.press = null; if (typeof tapRelease === 'function') tapRelease(p); }
}
canvas.addEventListener('touchstart', e => { e.preventDefault(); for (const t of e.changedTouches) pointerDown(t.clientX, t.clientY, t.identifier); }, { passive: false });
canvas.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) pointerMove(t.clientX, t.clientY, t.identifier); }, { passive: false });
canvas.addEventListener('touchend', e => { e.preventDefault(); for (const t of e.changedTouches) pointerUp(t.identifier); }, { passive: false });
canvas.addEventListener('touchcancel', e => { for (const t of e.changedTouches) pointerUp(t.identifier); });
canvas.addEventListener('mousedown', e => pointerDown(e.clientX, e.clientY, 'mouse'));
canvas.addEventListener('mousemove', e => pointerMove(e.clientX, e.clientY, 'mouse'));
window.addEventListener('mouseup', () => pointerUp('mouse'));

function inputVector() {
  let x = 0, y = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (x || y) { const d = Math.hypot(x, y); return { x: x / d, y: y / d, m: 1 }; }
  if (touch.active && (touch.dx || touch.dy)) { const d = Math.hypot(touch.dx, touch.dy); return { x: touch.dx / d, y: touch.dy / d, m: Math.min(1, d * 1.2) }; }
  return { x: 0, y: 0, m: 0 };
}
function tapped(name) { const i = touch.taps.indexOf(name); if (i >= 0) { touch.taps.splice(i, 1); return true; } return false; }
function advanceDialog() { dialog.cur = null; dialog.shown = 0; dialog.t = 0; }
