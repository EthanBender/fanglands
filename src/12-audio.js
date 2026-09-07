// ============================================================================
// AUDIO — tiny synthesised sound effects (no files). Starts on the first tap/key.
// ============================================================================
let audioCtx = null, audioMuted = false;
try { audioMuted = localStorage.getItem('fanglands.muted') === '1'; } catch (e) { }
function audioStart() {
  if (audioCtx) return;
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
}
window.addEventListener('keydown', audioStart); window.addEventListener('pointerdown', audioStart); window.addEventListener('touchstart', audioStart);
function toggleMute() { audioMuted = !audioMuted; try { localStorage.setItem('fanglands.muted', audioMuted ? '1' : '0'); } catch (e) { } }
// one voice: type, start freq, end freq, duration, gain, optional noise
function tone(type, f0, f1, dur, gain = 0.08, when = 0) {
  if (!audioCtx || audioMuted) return;
  const t = audioCtx.currentTime + when;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, gain = 0.06, when = 0, lp = 1200) {
  if (!audioCtx || audioMuted) return;
  const t = audioCtx.currentTime + when, n = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = audioCtx.createBufferSource(); s.buffer = buf; const f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
  const g = audioCtx.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(audioCtx.destination); s.start(t);
}
const SFX = {
  swing: () => noise(0.09, 0.05, 0, 2500),
  hit: () => { noise(0.06, 0.08, 0, 900); tone('square', 180, 90, 0.08, 0.05); },
  miss: () => tone('sine', 520, 380, 0.07, 0.03),
  hurt: () => { tone('sawtooth', 160, 70, 0.18, 0.07); noise(0.1, 0.05, 0, 600); },
  pickup: () => { tone('triangle', 660, 990, 0.08, 0.05); tone('triangle', 990, 1320, 0.1, 0.04, 0.07); },
  coins: () => { tone('sine', 1320, 1760, 0.06, 0.04); tone('sine', 1760, 2200, 0.08, 0.03, 0.05); },
  eat: () => { tone('triangle', 300, 200, 0.12, 0.05); tone('triangle', 260, 180, 0.12, 0.04, 0.12); },
  craft: () => { tone('square', 880, 660, 0.05, 0.04); tone('square', 660, 880, 0.08, 0.04, 0.08); },
  anvil: () => { tone('square', 1400, 900, 0.05, 0.05); noise(0.05, 0.04, 0, 3000); },
  levelup: () => { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.18, 0.06, i * 0.09)); },
  quest: () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.22, 0.06, i * 0.1)); },
  ui: () => tone('sine', 880, 880, 0.04, 0.03),
  open: () => tone('sine', 660, 880, 0.06, 0.03),
  death: () => { tone('sawtooth', 220, 40, 0.9, 0.08); tone('sawtooth', 165, 30, 1.1, 0.06, 0.1); },
  boom: () => { noise(0.35, 0.12, 0, 400); tone('sine', 120, 30, 0.4, 0.1); },
  chop: () => { noise(0.05, 0.07, 0, 1400); tone('square', 240, 160, 0.05, 0.04); },
  fish: () => { tone('sine', 400, 900, 0.12, 0.04); noise(0.12, 0.03, 0.05, 800); },
  fire: () => noise(0.4, 0.05, 0, 700),
  boss: () => { [110, 98, 82].forEach((f, i) => tone('sawtooth', f, f * 0.9, 0.5, 0.08, i * 0.35)); },
  bow: () => { tone('sine', 900, 300, 0.12, 0.05); noise(0.05, 0.04, 0, 3000); },
};
const sfx = name => { const f = SFX[name]; if (f) try { f(); } catch (e) { } };
