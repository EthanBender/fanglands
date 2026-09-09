// ============================================================================
// THISTLEDOWN IS WALLED — owner: "the fence that's around the city should be a walled-off fence"
// The town's perimeter was paddock fencing, which is what you put round sheep, not round the place the Duke
// lives while goblin machines are two fields away. It is stone now: a proper curtain wall with a walkway
// course along the top, the two gates left exactly where they were.
// It gets its OWN tile rather than reusing the castle's. Swapping in T.CWALL was tried and reverted: the core
// treats castle wall as building fabric, so a whole ring of it confused building detection and stranded the
// bot inside the town. A dedicated solid tile changes nothing but the picture and what can knock it down.
// Feature file: registers through HOOKS only, edits no core file. window.TOWNWALL exposes the tally.
// ============================================================================
{
  const T_WALL = addTile('TOWN_WALL', { solid: true, tex: 'cobble', mini: '#8f929a' });
  const tally = { laid: 0, gates: 0 };

  // Runs after 02-world has drawn the perimeter and after the world blend, so it converts what is actually
  // there rather than guessing the rectangle: every fence tile on the town's own boundary line becomes wall.
  HOOKS.world.push((rnd, api) => {
    tally.laid = 0; tally.gates = 0;
    if (typeof VILLAGE === 'undefined') return;
    const on = (x, y) => x === VILLAGE.x0 || x === VILLAGE.x1 || y === VILLAGE.y0 || y === VILLAGE.y1;
    for (let y = VILLAGE.y0; y <= VILLAGE.y1; y++) for (let x = VILLAGE.x0; x <= VILLAGE.x1; x++) {
      if (!on(x, y)) continue;
      const t = api.tileAt(x, y);
      if (t === T.GATE) { tally.gates++; continue; }          // the gates stay gates
      if (t !== T.FENCE) continue;                            // a door, a building corner or a road keeps what it is
      api.setTile(x, y, T_WALL);
      tally.laid++;
    }
  });

  // Stone, with a lighter course along the top so it reads as a wall you could walk rather than a flat block.
  HOOKS.draw.push((g, items) => {
    if (typeof VILLAGE === 'undefined') return;
    const x0 = Math.max(VILLAGE.x0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(VILLAGE.x1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(VILLAGE.y0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(VILLAGE.y1, Math.ceil((cam.y + VH) / TILE) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (tileAt(x, y) !== T_WALL) continue;
      items.push({ y: tc(y), draw: () => {
        const cx = tc(x), cy = tc(y), h = TILE / 2;
        g.fillStyle = '#6e7178'; g.fillRect(cx - h, cy - h, TILE, TILE);
        g.fillStyle = '#7d8087';                                  // coursed stone
        for (let r = 0; r < 3; r++) {
          const yy = cy - h + 2 + r * 9, off = (r % 2) * 8;
          for (let s = -1; s < 2; s++) g.fillRect(cx - h + 2 + off + s * 14, yy, 12, 7);
        }
        g.fillStyle = '#9aa0a8'; g.fillRect(cx - h, cy - h, TILE, 4);   // the walkway course along the top
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - h, cy + h - 3, TILE, 3);
      } });
    }
  });

  window.TOWNWALL = { tile: T_WALL, tally };

  const P = 'townwall: ';
  HOOKS.selfTest.push((check, F) => {
    if (typeof VILLAGE === 'undefined') { check(P + 'Thistledown is walled in stone', false, {}); return; }
    let wall = 0, fence = 0, gate = 0;
    const on = (x, y) => x === VILLAGE.x0 || x === VILLAGE.x1 || y === VILLAGE.y0 || y === VILLAGE.y1;
    for (let y = VILLAGE.y0; y <= VILLAGE.y1; y++) for (let x = VILLAGE.x0; x <= VILLAGE.x1; x++) {
      if (!on(x, y)) continue;
      const t = tileAt(x, y);
      if (t === TOWNWALL.tile) wall++; else if (t === T.FENCE) fence++; else if (t === T.GATE) gate++;
    }
    check(P + 'the town is ringed in stone, not paddock fencing, and both gates are still open', wall > 100 && fence === 0 && gate >= 4 && SOLID.has(TOWNWALL.tile), { wall, fence, gate });
    // the wall must not seal the town: the square is still reachable from outside
    { const outside = [VILLAGE.x0 - 4, 32], inside = [112, 33];
      const path = F.bfs(outside[0], outside[1], inside[0], inside[1]);
      check(P + 'the wall does not seal the town: you can still walk in from outside through a gate', !!path && path.length > 0, { steps: path ? path.length : 'nopath', from: outside, to: inside }); }
  });
}
