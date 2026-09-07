// ============================================================================
// BOOT — runs last, after every feature file has registered its hooks
// ============================================================================
generateWorld();
spawnMonsters();
const loaded = load();
if (loaded) { notify('Welcome back, knight.'); introT = 5; }
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try { update(dt); render(); } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.addEventListener('beforeunload', save);
setInterval(save, 15000);
