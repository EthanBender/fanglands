// ============================================================================
// BOOT — runs last, after every feature file has registered its hooks
// ============================================================================
generateWorld();
spawnMonsters();
title.open();                       // boot lands on the title screen; a slot is loaded from there (src/14-title.js)
title.bootActive = title.active;    // recorded before any input, checked by the self-test
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try {
    if (!title.active && paused && pressed.has('KeyT')) title.toTitle();
    if (title.active) title.tick(dt); // title up: no update(), keys and taps are swallowed
    else update(dt);
    render();                         // world backdrop + HUD; drawHud draws the title while it is up
  } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.addEventListener('beforeunload', save);
setInterval(save, 15000);
