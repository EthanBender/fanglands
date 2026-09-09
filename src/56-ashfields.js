// ============================================================================
// THE ASHFIELDS ARE ASH — owner, looking at the map: "there should not be grass in the ash fields"
// The field was carved as ash patches laid over ordinary grass, so 1,412 of its tiles were still green —
// more green than grey — with bright grass sitting right against the lava. This runs last at world-gen and
// burns what is left: ash mostly, scorched ground and bare dirt in patches, so it reads as a field that
// burned rather than a flat grey sheet. The seam along the north edge keeps its dithering, because that is
// what makes the Ashfields fade into Wolfwood instead of starting at a ruled line (39-worldblend).
// Feature file: registers through HOOKS only, edits no core file. window.ASHFIELDS exposes the tally.
// ============================================================================
{
  const SEAM_ROWS = 4;        // rows at the north edge that keep their blend with the wood above
  const SEAM_KEEP = 0.55;     // how much of the seam's grass survives, so the dither still reads
  const GREEN = () => [T.GRASS, T.FLOWERS, T.MUSHROOM].filter(t => t !== undefined);
  const tally = { burned: 0, keptSeam: 0, before: 0 };

  // a burnt field is not one colour: ash over most of it, scorch where it caught, bare dirt where it did not
  function burntTile(rnd) {
    const r = rnd();
    if (r < 0.60) return 'ASH' in T ? T.ASH : T.DIRT;
    if (r < 0.85 && 'SCORCH' in T) return T.SCORCH;
    return T.DIRT;
  }

  HOOKS.world.push((rnd, api) => {
    const r = REGIONS.find(x => /Ashfield/i.test(x.name));
    if (!r) return;
    tally.burned = 0; tally.keptSeam = 0; tally.before = 0;
    const green = new Set(GREEN());
    for (let y = r.y0; y <= r.y1; y++) {
      const inSeam = y < r.y0 + SEAM_ROWS;
      for (let x = r.x0; x <= r.x1; x++) {
        const t = api.tileAt(x, y);
        if (!green.has(t)) continue;
        tally.before++;
        if (buildingAt(x, y)) continue;                     // Dunstan's hut and anything else standing keeps its ground
        if (inSeam && rnd() < SEAM_KEEP) { tally.keptSeam++; continue; }
        api.setTile(x, y, burntTile(rnd));
        tally.burned++;
      }
    }
  });

  window.ASHFIELDS = { tally, SEAM_ROWS, SEAM_KEEP };

  const P = 'ashfields: ';
  HOOKS.selfTest.push(check => {
    const r = REGIONS.find(x => /Ashfield/i.test(x.name));
    if (!r) { check(P + 'the Ashfields are ash, not grass', false, { region: null }); return; }
    const count = {};
    let deepGreen = 0, seamGreen = 0;
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
      const n = tileName(tileAt(x, y));
      count[n] = (count[n] || 0) + 1;
      if (n === 'GRASS' || n === 'FLOWERS' || n === 'MUSHROOM') {
        if (y < r.y0 + ASHFIELDS.SEAM_ROWS) seamGreen++; else deepGreen++;
      }
    }
    // nothing green below the seam, and the seam itself still dithers into the wood above
    check(P + 'no grass anywhere in the Ashfields below the seam, and the seam still fades into the wood', deepGreen === 0 && seamGreen > 0, { deepGreen, seamGreen, burned: ASHFIELDS.tally.burned, wasGreen: ASHFIELDS.tally.before });
    // and it is a burnt field, not one flat grey sheet
    const ash = count.ASH || 0, scorch = count.SCORCH || 0, dirt = count.DIRT || 0;
    check(P + 'the burnt ground is a mix of ash, scorch and bare dirt rather than one flat colour', ash > 0 && scorch > 0 && dirt > 0 && ash > scorch && ash > dirt, { ash, scorch, dirt, lava: count.LAVA || 0 });
  });
}
