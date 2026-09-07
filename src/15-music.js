// ============================================================================
// MUSIC — synthesised region loops (no audio files; Web Audio only; registers through HOOKS only).
// A tiny sequencer: every region has an 8–16 bar loop of 2–3 voices (bass / lead / pad / percussion)
// written as note arrays (MIDI number + beats). A lookahead timer (every 200 ms) schedules notes up to
// 0.6 s ahead on audioCtx.currentTime so nothing stutters. Loops crossfade over ~1.5 s when the region
// (or a nearby boss) changes. Toggle with N, or the MUSIC touch button; 'fanglands.music' in localStorage.
// Respects audioMuted from 12-audio.js as a master kill. Debug/test handle: window.MUSIC.
// ============================================================================
const MUSIC = (() => {
  const LOOKAHEAD = 0.6, TICK_MS = 200, FADE = 1.5, LEVEL = 0.065, BOSS_TILES = 12, BOSS_LEVEL = 25;
  const _ = null; // rest
  // ---------- loops: { bpm, bpb (beats per bar), voices: [{ k: kind, w: wave, g: gain, lp: lowpass Hz, n: [[midi|null, beats], ...] }] }
  // kinds: bass (soft attack, short release) · lead (filtered, gentle attack/release) · pluck (lute/marimba: instant attack, decays)
  //        pad (two detuned sines, slow swell) · perc (noise bursts: 1 = low thud, 2 = high tick, 3 = mid snap)
  const LOOPS = {
    cave: { bpm: 60, bpb: 4, voices: [
      { k: 'pad', w: 'sine', g: 0.5, n: [[38, 16], [41, 8], [38, 8]] },
      { k: 'bass', w: 'sine', g: 0.45, lp: 300, n: [[38, 8], [_, 8], [36, 8], [_, 8]] },
      { k: 'lead', w: 'triangle', g: 0.35, lp: 1800, echo: true, n: [[74, 1], [_, 5], [69, 1], [_, 3], [72, 1], [_, 7], [77, 1], [_, 5], [74, 1], [_, 7]] },
    ] },
    road: { bpm: 112, bpb: 4, voices: [ // D dorian, walking bass
      { k: 'bass', w: 'triangle', g: 0.55, lp: 700, n: [50, 52, 53, 55, 57, 55, 53, 52, 50, 52, 53, 55, 57, 59, 60, 57, 55, 53, 52, 50, 48, 50, 52, 53, 55, 57, 55, 53, 52, 50, 48, 45].map(m => [m, 1]) },
      { k: 'lead', w: 'square', g: 0.28, lp: 1100, n: [[62, 1], [64, 1], [65, 2], [67, 1], [69, 1], [67, 2], [65, 1], [64, 1], [62, 2], [64, 2], [_, 2], [69, 1], [71, 1], [72, 2], [71, 1], [69, 1], [67, 2], [69, 1], [65, 1], [64, 1], [62, 1], [62, 3], [_, 1]] },
      { k: 'perc', g: 0.5, n: [[1, 1], [2, 1], [1, 1], [2, 1]] },
    ] },
    village: { bpm: 96, bpb: 3, voices: [ // G major, lute plucks, 3/4
      { k: 'pluck', w: 'triangle', g: 0.5, lp: 900, n: [[43, 3], [48, 3], [50, 3], [43, 3], [40, 3], [45, 3], [50, 3], [43, 3]] },
      { k: 'pluck', w: 'triangle', g: 0.42, lp: 2200, n: [[67, 1], [71, 1], [74, 1], [72, 1], [71, 1], [69, 1], [71, 2], [69, 1], [67, 3], [64, 1], [67, 1], [71, 1], [69, 1], [72, 1], [76, 1], [74, 2], [71, 1], [67, 3]] },
      { k: 'pluck', w: 'triangle', g: 0.26, lp: 1600, n: [[_, 1], [59, 1], [62, 1], [_, 1], [60, 1], [64, 1], [_, 1], [62, 1], [66, 1], [_, 1], [59, 1], [62, 1], [_, 1], [59, 1], [64, 1], [_, 1], [60, 1], [64, 1], [_, 1], [62, 1], [66, 1], [_, 1], [59, 1], [62, 1]] },
    ] },
    quarry: { bpm: 100, bpb: 4, voices: [ // mining rhythm
      { k: 'perc', g: 0.6, n: [[1, 1], [3, 0.5], [3, 0.5], [1, 1], [2, 0.5], [3, 0.5]] },
      { k: 'bass', w: 'triangle', g: 0.5, lp: 400, n: [[36, 2], [36, 1], [39, 1], [36, 2], [34, 1], [36, 1], [36, 2], [36, 1], [41, 1], [39, 2], [34, 1], [36, 1]] },
      { k: 'pluck', w: 'square', g: 0.22, lp: 2600, n: [[60, 0.5], [_, 3.5], [63, 0.5], [_, 3.5], [60, 0.5], [_, 1.5], [62, 0.5], [_, 5.5]] },
    ] },
    pond: { bpm: 70, bpb: 4, voices: [ // F pentatonic, gentle
      { k: 'lead', w: 'triangle', g: 0.32, lp: 1400, n: [[69, 2], [72, 2], [74, 3], [_, 1], [72, 2], [69, 2], [67, 3], [_, 1], [65, 2], [67, 2], [69, 3], [_, 1], [67, 2], [65, 2], [62, 3], [_, 1]] },
      { k: 'bass', w: 'sine', g: 0.5, lp: 300, n: [[41, 8], [48, 8], [50, 8], [41, 8]] },
      { k: 'pad', w: 'sine', g: 0.3, n: [[53, 16], [55, 16]] },
    ] },
    camp: { bpm: 120, bpb: 4, voices: [ // E minor, tritone accents, drums
      { k: 'bass', w: 'triangle', g: 0.55, lp: 600, n: [[40, 1], [40, 0.5], [40, 0.5], [46, 1], [40, 1], [40, 1], [40, 0.5], [40, 0.5], [46, 1], [40, 1], [40, 1], [40, 0.5], [40, 0.5], [43, 1], [41, 1], [40, 1], [40, 0.5], [40, 0.5], [46, 1], [40, 1], [40, 1], [40, 0.5], [40, 0.5], [46, 1], [40, 1], [40, 1], [40, 0.5], [40, 0.5], [46, 1], [40, 1], [40, 1], [40, 0.5], [40, 0.5], [43, 1], [41, 1], [40, 1], [46, 1], [45, 1], [43, 1]] },
      { k: 'lead', w: 'square', g: 0.24, lp: 1000, n: [[64, 0.5], [_, 3.5], [70, 0.5], [_, 1.5], [64, 0.5], [_, 1.5], [_, 4], [67, 0.5], [66, 0.5], [64, 1], [_, 2], [64, 0.5], [_, 3.5], [70, 0.5], [_, 1.5], [71, 0.5], [_, 1.5], [_, 4], [70, 1], [67, 1], [64, 2]] },
      { k: 'perc', g: 0.55, n: [[1, 0.5], [2, 0.5], [3, 0.5], [2, 0.5], [1, 0.5], [1, 0.5], [3, 0.5], [2, 0.5]] },
    ] },
    deepholm: { bpm: 76, bpb: 4, voices: [ // deep drone, dwarven march
      { k: 'pad', w: 'sine', g: 0.5, n: [[38, 16], [36, 16]] },
      { k: 'bass', w: 'triangle', g: 0.5, lp: 350, n: [[38, 1], [38, 1], [41, 1], [38, 1], [36, 1], [36, 1], [38, 2], [38, 1], [38, 1], [41, 1], [43, 1], [41, 1], [36, 1], [38, 2], [38, 1], [38, 1], [41, 1], [38, 1], [36, 1], [36, 1], [38, 2], [34, 1], [34, 1], [36, 1], [38, 1], [41, 1], [36, 1], [38, 2]] },
      { k: 'perc', g: 0.5, n: [[1, 1], [_, 1], [1, 0.5], [1, 0.5], [_, 1]] },
    ] },
    jungle: { bpm: 132, bpb: 4, voices: [ // C pentatonic arpeggios, marimba
      { k: 'pluck', w: 'triangle', g: 0.4, lp: 3200, n: [72, 76, 79, 84, 81, 79, 76, 74, 69, 72, 76, 81, 79, 76, 72, 69, 67, 72, 76, 79, 81, 79, 76, 72, 74, 76, 79, 83, 86, 83, 79, 76, 72, 76, 79, 84, 81, 79, 76, 74, 69, 72, 76, 81, 79, 76, 72, 69, 65, 69, 72, 77, 81, 77, 72, 69, 67, 71, 74, 79, 83, 79, 74, 71].map(m => [m, 0.5]) },
      { k: 'bass', w: 'sine', g: 0.4, lp: 300, n: [[48, 4], [45, 4], [41, 4], [43, 4], [48, 4], [45, 4], [41, 4], [43, 4]] },
      { k: 'pad', w: 'sine', g: 0.22, n: [[64, 8], [62, 8], [60, 8], [62, 8]] },
    ] },
    sea: { bpm: 180, bpb: 6, voices: [ // 6/8 shanty (beat = quaver), bouncy bass
      { k: 'bass', w: 'triangle', g: 0.55, lp: 600, n: [[43, 3], [50, 3], [48, 3], [55, 3], [43, 3], [50, 3], [50, 3], [57, 3], [43, 3], [50, 3], [48, 3], [55, 3], [50, 3], [45, 3], [43, 3], [50, 3]] },
      { k: 'lead', w: 'square', g: 0.26, lp: 1300, n: [[67, 2], [69, 1], [71, 2], [67, 1], [72, 2], [71, 1], [69, 3], [67, 2], [71, 1], [74, 2], [72, 1], [71, 3], [69, 3], [67, 2], [69, 1], [71, 2], [72, 1], [74, 2], [72, 1], [71, 3], [69, 2], [71, 1], [69, 2], [66, 1], [67, 6]] },
      { k: 'perc', g: 0.45, n: [[1, 1], [_, 2], [3, 1], [_, 2]] },
    ] },
    ashfields: { bpm: 56, bpb: 4, voices: [ // low, ominous, sparse
      { k: 'pad', w: 'sine', g: 0.5, n: [[35, 16], [34, 16]] },
      { k: 'bass', w: 'sine', g: 0.45, lp: 250, n: [[35, 4], [_, 4], [35, 2], [_, 6], [41, 4], [_, 4], [35, 2], [_, 6]] },
      { k: 'lead', w: 'triangle', g: 0.3, lp: 900, n: [[_, 6], [47, 2], [_, 6], [46, 2], [_, 14], [47, 2]] },
    ] },
    lair: { bpm: 150, bpb: 4, voices: [ // heavy, fast E minor, drums
      { k: 'bass', w: 'triangle', g: 0.6, lp: 700, n: [40, 40, 47, 40, 46, 40, 45, 43, 40, 40, 47, 40, 46, 40, 45, 43, 40, 40, 43, 40, 41, 40, 38, 36, 40, 40, 47, 40, 46, 40, 45, 43, 40, 40, 47, 40, 46, 40, 45, 43, 40, 40, 47, 40, 46, 40, 45, 43, 40, 40, 43, 40, 41, 40, 38, 36, 36, 38, 40, 41, 43, 45, 46, 47].map(m => [m, 0.5]) },
      { k: 'lead', w: 'square', g: 0.26, lp: 1200, n: [[64, 1], [67, 1], [70, 1], [67, 1], [71, 2], [70, 1], [67, 1], [64, 1], [67, 1], [70, 1], [71, 1], [76, 2], [75, 1], [71, 1], [64, 1], [67, 1], [70, 1], [67, 1], [71, 2], [70, 1], [67, 1], [72, 1], [71, 1], [70, 1], [67, 1], [64, 3], [_, 1]] },
      { k: 'perc', g: 0.6, n: [[1, 0.5], [2, 0.5], [3, 0.5], [2, 0.5], [1, 0.5], [1, 0.5], [3, 0.5], [2, 0.5]] },
    ] },
    battle: { bpm: 160, bpb: 4, voices: [ // A minor, fast
      { k: 'bass', w: 'triangle', g: 0.6, lp: 700, n: [45, 45, 45, 52, 45, 45, 51, 50, 45, 45, 48, 45, 53, 52, 51, 50, 45, 45, 45, 52, 45, 45, 51, 50, 41, 41, 41, 48, 43, 43, 43, 50, 45, 45, 45, 52, 45, 45, 51, 50, 45, 45, 48, 45, 53, 52, 51, 50, 41, 41, 41, 48, 43, 43, 43, 50, 45, 45, 45, 45, 52, 51, 50, 49].map(m => [m, 0.5]) },
      { k: 'lead', w: 'square', g: 0.26, lp: 1300, n: [[69, 1], [72, 1], [76, 0.5], [75, 0.5], [76, 1], [72, 1], [69, 2], [_, 1], [67, 1], [71, 1], [74, 0.5], [73, 0.5], [74, 1], [71, 1], [67, 2], [_, 1], [69, 1], [72, 1], [76, 0.5], [75, 0.5], [76, 1], [77, 1], [76, 2], [_, 1], [72, 1], [71, 1], [69, 0.5], [68, 0.5], [69, 1], [64, 1], [69, 2], [_, 1]] },
      { k: 'perc', g: 0.6, n: [[1, 0.5], [2, 0.5], [3, 0.5], [2, 0.5], [1, 0.5], [2, 0.5], [3, 0.5], [3, 0.5]] },
    ] },
  };
  const REGION_LOOP = {
    'The Cave': 'cave', 'Goblin Fields': 'road', 'The Wilds': 'road', 'Wolfwood': 'road',
    'Thistledown': 'village', 'Castle Thistledown': 'village', 'Grey Quarry': 'quarry', "Miller's Pond": 'pond',
    'Goblin Camp': 'camp', 'Hollowford': 'camp', 'Deepholm': 'deepholm', 'The Jungle': 'jungle', 'Sylvaris': 'jungle',
    'The Grey Sea': 'sea', 'Gull Isle': 'sea', 'Ironclad Isle': 'sea', 'The Ashfields': 'ashfields', "The Fang's Lair": 'lair',
  };
  const loopFor = region => REGION_LOOP[region] || 'road';

  // ---------- preference ----------
  let enabled = true;
  try { enabled = localStorage.getItem('fanglands.music') !== '0'; } catch (e) { }
  function setEnabled(on) { enabled = !!on; try { localStorage.setItem('fanglands.music', enabled ? '1' : '0'); } catch (e) { } }

  // ---------- engine state ----------
  let ctx = null, master = null, noiseBuf = null, layers = [], cur = null, want = null, wasOn = false, scheduled = 0, timer = null, override = null;
  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

  function ensureCtx() {
    const c = override || audioCtx;
    if (!c) return false;
    if (c !== ctx) { // first context (or the test's stub): fresh graph
      ctx = c; noiseBuf = null; layers = []; cur = null; wasOn = false;
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    }
    return true;
  }
  function noiseBuffer() {
    if (noiseBuf) return noiseBuf;
    const sr = ctx.sampleRate || 44100, n = Math.floor(sr * 0.25);
    noiseBuf = ctx.createBuffer(1, n, sr); const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  // one note of one voice: builds a few nodes, schedules them, and stop()s every source after the note
  function play(voice, note, t, dur, out) {
    const kind = voice.k, g = voice.g;
    if (kind === 'perc') {
      const p = note, len = p === 1 ? 0.12 : p === 2 ? 0.05 : 0.09, lp = p === 1 ? 260 : p === 2 ? 5000 : 1500;
      const s = ctx.createBufferSource(); s.buffer = noiseBuffer();
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
      const e = ctx.createGain(); e.gain.setValueAtTime(g * (p === 2 ? 0.6 : 1), t); e.gain.exponentialRampToValueAtTime(0.0001, t + len);
      s.connect(f); f.connect(e); e.connect(out); s.start(t); s.stop(t + len + 0.02);
      if (p === 1) { // low thud: add a short sine drop under the noise
        const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine';
        o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
        og.gain.setValueAtTime(g * 0.9, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.14);
      }
      return;
    }
    const hz = midiHz(note), e = ctx.createGain();
    let head = e;
    if (voice.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = voice.lp; f.connect(e); head = f; }
    const oscs = [];
    const mk = (detune) => { const o = ctx.createOscillator(); o.type = voice.w || 'sine'; o.frequency.setValueAtTime(hz * (1 + detune), t); o.connect(head); oscs.push(o); };
    if (kind === 'pad') { mk(-0.004); mk(0.004); } else mk(0);
    const end = t + dur;
    if (kind === 'pluck') {
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + 0.004);
      e.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(dur, 0.7));
    } else if (kind === 'pad') {
      const a = Math.min(1.5, dur * 0.4), r = Math.min(1.5, dur * 0.4);
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + a);
      e.gain.setValueAtTime(g, Math.max(t + a, end - r)); e.gain.linearRampToValueAtTime(0.0001, end);
    } else { // bass, lead
      const a = kind === 'bass' ? 0.012 : 0.03, r = Math.min(kind === 'bass' ? 0.08 : 0.12, dur * 0.4);
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + a);
      e.gain.setValueAtTime(g, Math.max(t + a, end - r)); e.gain.linearRampToValueAtTime(0.0001, end);
    }
    e.connect(out);
    for (const o of oscs) { o.start(t); o.stop(end + 0.03); }
    if (voice.echo && !voice._echoing) { // cave: a quieter copy 0.35 s later
      voice._echoing = true; play(Object.assign({}, voice, { g: g * 0.4 }), note, t + 0.35, dur, out); voice._echoing = false;
    }
  }
  function startLayer(name, now) {
    const loop = LOOPS[name]; if (!loop) return;
    const gain = ctx.createGain(); gain.gain.setValueAtTime(0.0001, now); gain.gain.linearRampToValueAtTime(1, now + FADE); gain.connect(master);
    const layer = { name, loop, gain, dying: false, dieAt: 0, voices: loop.voices.map(v => ({ spec: v, idx: 0, next: now + 0.05 })) };
    if (cur) { cur.dying = true; cur.dieAt = now + FADE + 0.1; cur.gain.gain.cancelScheduledValues(now); cur.gain.gain.setValueAtTime(1, now); cur.gain.gain.linearRampToValueAtTime(0.0001, now + FADE); }
    layers.push(layer); cur = layer;
  }
  function tick() {
    if (!ensureCtx()) return;
    const on = enabled && !audioMuted, now = ctx.currentTime;
    if (on !== wasOn) {
      master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(on ? 0.0001 : LEVEL, now);
      master.gain.linearRampToValueAtTime(on ? LEVEL : 0.0001, now + (on ? 0.4 : 0.08));
      if (on) for (const l of layers) for (const v of l.voices) v.next = now + 0.05; // resync after silence
      wasOn = on;
    }
    if (!on) return;
    if (want && (!cur || cur.name !== want)) startLayer(want, now);
    for (let i = layers.length - 1; i >= 0; i--) { const l = layers[i]; if (l.dying && now >= l.dieAt) { try { l.gain.disconnect(); } catch (e) { } layers.splice(i, 1); } }
    for (const l of layers) {
      const spb = 60 / l.loop.bpm;
      for (const v of l.voices) {
        const notes = v.spec.n; if (!notes.length) continue;
        if (v.next < now - 0.2) v.next = now + 0.02; // fell behind (tab throttled): skip forward, don't spray old notes
        let guard = 64;
        while (v.next < now + LOOKAHEAD && guard-- > 0) {
          const [m, beats] = notes[v.idx], dur = beats * spb;
          if (m !== null && m !== undefined) { play(v.spec, m, v.next, dur, l.gain); scheduled++; }
          v.next += dur; v.idx = (v.idx + 1) % notes.length;
        }
      }
    }
  }
  // choose which loop should be playing right now (region, or battle when a boss is close)
  function choose() {
    let boss = false;
    for (const m of monsters) {
      if (m.dead) continue; const d = MONSTER_DEFS[m.type]; if (!d || (d.level || 0) < BOSS_LEVEL || d.harmless) continue;
      if (!d.aggro && !m.angry) continue; // peaceful high-level folk (elf sentinels) only count once they are fighting you
      if (dist(m.x, m.y, player.x, player.y) <= BOSS_TILES * TILE) { boss = true; break; }
    }
    return boss ? 'battle' : loopFor(player.region);
  }
  function toggle() { setEnabled(!enabled); notify(enabled ? 'Music: on (N)' : 'Music: off (N)'); }

  // ---------- hooks ----------
  HOOKS.update.push(() => {
    if (pressed.has('KeyN')) toggle();
    want = choose();
    if (timer === null) timer = setInterval(() => { try { tick(); } catch (e) { } }, TICK_MS) ?? true;
  });
  HOOKS.hud.push((g) => {
    if (!isTouch) return;
    button(g, VW - 74, VH - 46, 64, 26, enabled ? 'MUSIC' : 'MUSIC off', toggle, enabled ? '#21262d' : '#3a2a2a');
  });

  // ---------- self-test (fake AudioContext that counts calls) ----------
  HOOKS.selfTest.push((check, F, h) => {
    const bad = Object.entries(LOOPS).filter(([n, l]) => l.voices.some(v => { const s = v.n.reduce((a, x) => a + x[1], 0); return Math.abs(s / l.bpb - Math.round(s / l.bpb)) > 1e-9; })).map(([n]) => n);
    check('music: every loop voice is a whole number of bars', bad.length === 0, { loops: Object.keys(LOOPS).length, bad });
    const counts = { osc: 0, gain: 0, filter: 0, buffer: 0, source: 0, started: 0, stopped: 0 };
    const param = () => { const p = { value: 0, target: null, setValueAtTime(v) { p.value = v; return p; }, linearRampToValueAtTime(v) { p.target = v; return p; }, exponentialRampToValueAtTime(v) { p.target = v; return p; }, cancelScheduledValues() { return p; }, setTargetAtTime(v) { p.target = v; return p; } }; return p; };
    const node = () => ({ connect() { }, disconnect() { } });
    const fake = {
      currentTime: 0, sampleRate: 8000, destination: node(),
      createOscillator() { counts.osc++; return Object.assign(node(), { type: 'sine', frequency: param(), detune: param(), start() { counts.started++; }, stop() { counts.stopped++; } }); },
      createGain() { counts.gain++; return Object.assign(node(), { gain: param() }); },
      createBiquadFilter() { counts.filter++; return Object.assign(node(), { type: 'lowpass', frequency: param() }); },
      createBuffer(ch, n) { counts.buffer++; return { getChannelData: () => new Float32Array(n) }; },
      createBufferSource() { counts.source++; return Object.assign(node(), { buffer: null, start() { counts.started++; }, stop() { counts.stopped++; } }); },
    };
    const prevMuted = audioMuted, prevEnabled = enabled;
    try {
      override = fake; audioMuted = false; setEnabled(true);
      const ticks = (n) => { for (let i = 0; i < n; i++) { fake.currentTime += TICK_MS / 1000; tick(); } };
      h.peace(true);
      F.tp(90, 30); F.sim(2, []);
      check('music: entering Thistledown selects the village loop', player.region === 'Thistledown' && want === 'village', { region: player.region, want });
      ticks(1); const first = cur && cur.name, n0 = scheduled;
      ticks(10);
      check('music: the scheduler schedules notes ahead of time', first === 'village' && scheduled > n0 && counts.osc > 0 && counts.started > 0 && counts.stopped === counts.started, { first, scheduled: scheduled - n0, osc: counts.osc, started: counts.started, stopped: counts.stopped });
      const before = cur;
      F.tp(52, 8); F.sim(2, []); ticks(1);
      check('music: changing region (Grey Quarry) crossfades — old layer fades to 0, new layer fades in to 1', want === 'quarry' && cur !== before && cur.name === 'quarry' && before.dying && before.gain.gain.target < 0.01 && cur.gain.gain.target === 1 && layers.includes(before), { want, old: before.name, oldTarget: before.gain.gain.target, newTarget: cur.gain.gain.target });
      ticks(12);
      check('music: the faded layer is dropped after the crossfade', !layers.includes(before) && layers.length === 1, { layers: layers.map(l => l.name) });
      const same = cur; F.tp(48, 6); F.sim(2, []); ticks(2);
      check('music: staying in the same region never restarts the loop', cur === same && layers.length === 1, { name: cur && cur.name });
      audioMuted = true; const o1 = counts.osc, s1 = counts.source; ticks(8);
      check('music: muted → no new nodes are created', counts.osc === o1 && counts.source === s1 && master.gain.target < 0.01, { osc: counts.osc - o1, masterTarget: master.gain.target });
      audioMuted = false; ticks(6);
      check('music: unmuting resumes scheduling', counts.osc > o1 && master.gain.target === LEVEL, { osc: counts.osc - o1, masterTarget: master.gain.target });
      // boss proximity: move a level-25+ monster next to the player
      const boss = monsters.filter(m => { const d = MONSTER_DEFS[m.type]; return d && (d.level || 0) >= BOSS_LEVEL && d.aggro && !d.harmless; }).sort((a, b) => MONSTER_DEFS[a.type].level - MONSTER_DEFS[b.type].level)[0];
      if (boss) {
        const keep = { x: boss.x, y: boss.y, dead: boss.dead, state: boss.state };
        boss.x = player.x + 3 * TILE; boss.y = player.y; boss.dead = false; F.sim(2, []); ticks(1); const w1 = want, c1 = cur && cur.name;
        boss.x = player.x + 40 * TILE; F.sim(2, []); ticks(1); const w2 = want;
        Object.assign(boss, keep); F.sim(1, []);
        check('music: a boss (level 25+) within 12 tiles switches to the battle loop, and back when it leaves', w1 === 'battle' && c1 === 'battle' && w2 === 'quarry', { boss: boss.type, near: w1, far: w2 });
      } else check('music: a boss (level 25+) within 12 tiles switches to the battle loop', false, { reason: 'no level 25+ aggressive monster in the world' });
      setEnabled(false); let stored = null; try { stored = localStorage.getItem('fanglands.music'); } catch (e) { }
      ticks(2); const o2 = counts.osc; ticks(4);
      check("music: preference persists ('fanglands.music') and off means silence", stored === '0' && !enabled && counts.osc === o2, { stored, osc: counts.osc - o2 });
      setEnabled(true); let stored2 = null; try { stored2 = localStorage.getItem('fanglands.music'); } catch (e) { }
      check('music: preference persists when switched back on', stored2 === '1' && enabled, { stored: stored2 });
      h.peace(false);
    } finally {
      override = null; ctx = null; master = null; layers = []; cur = null; wasOn = false; audioMuted = prevMuted; setEnabled(prevEnabled);
    }
  });

  return { tick, choose, toggle, setEnabled, enabled: () => enabled, loops: LOOPS, loopFor, state: () => ({ want, cur: cur && cur.name, layers: layers.map(l => ({ name: l.name, dying: l.dying })), scheduled }) };
})();
