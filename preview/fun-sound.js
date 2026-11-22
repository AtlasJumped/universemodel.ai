/* For fun: every sound is synthesized with the Web Audio API. No audio files, nothing downloaded.
   Sound is off until the visitor turns it on, and only then is an AudioContext created. */
(() => {
'use strict';
let ctx = null, master = null, comp = null, on = false, noiseBuf = null, amb = null, timer = 0;
const active = new Set(), last = {}, level = { fire: 0, rumble: 0, drones: 0, wind: 0, ufo: 0, flood: 0 };
const rnd = (a, b) => a + Math.random() * (b - a);
function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 20; comp.attack.value = 0.002; comp.release.value = 0.18;
  master = ctx.createGain(); master.gain.value = 0.5; master.connect(comp); comp.connect(ctx.destination);
  const len = Math.floor(ctx.sampleRate * 2); noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return true;
}
const track = n => { active.add(n); n.onended = () => active.delete(n); };
function env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function nz(t, dur, type, f0, f1, q, peak, a) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 1;
  const g = ctx.createGain(); env(g, t, a || 0.004, dur, peak); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.06); track(s);
}
function tn(t, type, f0, f1, dur, peak, a) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); env(g, t, a || 0.004, dur, peak); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.06); track(o);
}
// a soft vowel-like voice for the little crowd reactions
function voice(t, f0, f1, dur, peak, fm) {
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); env(g, t, 0.05, dur, peak);
  for (const [f, q, k] of fm) { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; const bg = ctx.createGain(); bg.gain.value = k; o.connect(b); b.connect(bg); bg.connect(g); }
  g.connect(master); o.start(t); o.stop(t + dur + 0.1); track(o);
}
const AH = [[800, 8, 1], [1200, 10, 0.6]], OH = [[500, 8, 1], [900, 10, 0.5]], EE = [[350, 8, 1], [2200, 12, 0.35]];
const SND = {
  hit(v) { const t = ctx.currentTime; nz(t, 0.09, 'bandpass', 900, 300, 1.2, 0.35 * v); tn(t, 'square', 190, 70, 0.08, 0.16 * v); },
  crack(v) { const t = ctx.currentTime; nz(t, 0.05, 'highpass', 1800, 900, 0.7, 0.4 * v); tn(t, 'triangle', 420, 110, 0.07, 0.2 * v); nz(t + 0.01, 0.14, 'lowpass', 500, 160, 0.8, 0.3 * v); },
  snap(v) { const t = ctx.currentTime; nz(t, 0.03, 'highpass', 3500, 2500, 0.7, 0.3 * v); tn(t, 'sine', 1900, 600, 0.06, 0.12 * v); },
  glass(v) { const t = ctx.currentTime; nz(t, 0.05, 'highpass', 2500, 1800, 0.7, 0.35 * v); for (let k = 0; k < 8; k++) nz(t + rnd(0, 0.22), rnd(0.05, 0.16), 'bandpass', rnd(3000, 8500), 0, 9, 0.2 * v); },
  boom(v) { const t = ctx.currentTime; nz(t, 1.1, 'lowpass', 1400, 60, 0.7, 0.9 * v); tn(t, 'sine', 95, 28, 0.9, 0.7 * v); nz(t, 0.35, 'bandpass', 220, 90, 0.8, 0.5 * v); },
  thud(v) { const t = ctx.currentTime; tn(t, 'sine', 120, 40, 0.18, 0.5 * v); nz(t, 0.12, 'lowpass', 320, 100, 0.8, 0.3 * v); },
  cannon(v) { const t = ctx.currentTime; tn(t, 'sawtooth', 70, 34, 0.5, 0.45 * v); nz(t, 0.5, 'lowpass', 2600, 90, 0.7, 0.85 * v); tn(t, 'sine', 80, 26, 0.7, 0.6 * v); },
  rocket(v) { const t = ctx.currentTime; nz(t, 1.3, 'bandpass', 500, 2600, 0.9, 0.45 * v, 0.2); tn(t, 'sawtooth', 110, 330, 1.2, 0.07 * v, 0.2); },
  shot(v) { const t = ctx.currentTime; nz(t, 0.04, 'highpass', 2500, 1800, 0.7, 0.28 * v); tn(t, 'square', 900, 200, 0.05, 0.09 * v); },
  ignite(v) { const t = ctx.currentTime; nz(t, 0.09, 'highpass', 3000, 1500, 0.7, 0.14 * v); nz(t, 0.18, 'lowpass', 700, 250, 0.7, 0.12 * v); },
  fuse(v) { const t = ctx.currentTime; nz(t, 0.35, 'highpass', 5000, 3500, 0.7, 0.16 * v, 0.02); },
  pop(v) { const t = ctx.currentTime; nz(t, 0.22, 'bandpass', 1600, 500, 0.9, 0.4 * v); for (let k = 0; k < 4; k++) nz(t + rnd(0.05, 0.3), 0.025, 'highpass', 4000, 0, 0.7, 0.2 * v); },
  splash(v) { const t = ctx.currentTime; nz(t, 0.3, 'lowpass', 2600, 500, 0.8, 0.4 * v); for (let k = 0; k < 3; k++) tn(t + rnd(0.02, 0.2), 'sine', rnd(500, 900), rnd(900, 1500), 0.07, 0.05 * v); },
  gasp(v) { const t = ctx.currentTime, f = rnd(190, 260); voice(t, f, f * 1.25, 0.28, 0.09 * v, AH); },
  crowd(v) { const t = ctx.currentTime; for (let k = 0; k < 4; k++) { const f = rnd(150, 280); voice(t + rnd(0, 0.4), f, f * rnd(0.85, 1.2), rnd(0.35, 0.7), 0.06 * v, k % 2 ? OH : EE); } },
  roar(v) { const t = ctx.currentTime; nz(t, 1.6, 'lowpass', 600, 180, 0.8, 0.5 * v, 0.12); tn(t, 'sawtooth', 95, 55, 1.5, 0.22 * v, 0.1); tn(t + 0.2, 'sawtooth', 70, 45, 1.2, 0.18 * v, 0.1); },
  breath(v) { const t = ctx.currentTime; nz(t, 0.8, 'bandpass', 900, 380, 0.7, 0.28 * v, 0.1); },
  drone(v) { const t = ctx.currentTime; tn(t, 'sawtooth', 300, 170, 0.6, 0.12 * v, 0.05); },
  ufo(v) { const t = ctx.currentTime; tn(t, 'sine', 320, 150, 0.9, 0.16 * v, 0.1); tn(t, 'triangle', 480, 220, 0.9, 0.08 * v, 0.1); },
  flood(v) { const t = ctx.currentTime; nz(t, 2.6, 'lowpass', 700, 200, 0.7, 0.6 * v, 0.3); }
};
const MIN = { hit: 60, crack: 45, snap: 35, glass: 90, boom: 120, thud: 90, shot: 60, ignite: 140, fuse: 350, splash: 140, gasp: 500, crowd: 1800, pop: 90, cannon: 200, rocket: 300, roar: 2500, breath: 900, drone: 1500, ufo: 1500, flood: 2500 };
function play(name, v) {
  if (!on || !ctx || ctx.state !== 'running' || !SND[name] || active.size > 30) return;
  const now = performance.now(); if (now - (last[name] || 0) < (MIN[name] || 50)) return; last[name] = now;
  try { SND[name](Math.max(0.1, Math.min(1.2, v === undefined ? 1 : v))); } catch (e) { /* ignore */ }
}
// continuous beds: fire crackle, quake rumble, drone buzz, wind, UFO hum, flood roar
function initAmb() {
  if (amb) return; const mk = (type, f, q) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q || 1; const g = ctx.createGain(); g.gain.value = 0; s.connect(b); b.connect(g); g.connect(master); s.start(0, Math.random()); return { s, g }; };
  const osc = (type, f, extra) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0; o.connect(g); g.connect(master); o.start(); return { o, g }; };
  const rumbleN = mk('lowpass', 90, 0.7), rumbleO = osc('sine', 42), fireN = mk('bandpass', 1100, 0.6), windN = mk('bandpass', 480, 0.5), floodN = mk('lowpass', 380, 0.7), buzz = osc('sawtooth', 150), buzz2 = osc('sawtooth', 233), hum = osc('sine', 190);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 26; const lg = ctx.createGain(); lg.gain.value = 0.02; lfo.connect(lg); lg.connect(buzz.g.gain); lfo.start();
  const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 5; const lg2 = ctx.createGain(); lg2.gain.value = 14; lfo2.connect(lg2); lg2.connect(hum.o.frequency); lfo2.start();
  amb = { rumbleN, rumbleO, fireN, windN, floodN, buzz, buzz2, hum, srcs: [rumbleN.s, rumbleO.o, fireN.s, windN.s, floodN.s, buzz.o, buzz2.o, hum.o, lfo, lfo2] };
  timer = setInterval(crackle, 90);
}
function crackle() {
  if (!on || !ctx || ctx.state !== 'running' || level.fire < 0.03) return;
  const n = Math.random() < level.fire ? 1 + (Math.random() < level.fire * 0.7 ? 1 : 0) : 0;
  for (let k = 0; k < n; k++) nz(ctx.currentTime + rnd(0, 0.08), rnd(0.012, 0.04), 'highpass', rnd(1800, 4200), 0, 0.7, rnd(0.05, 0.14) * (0.5 + level.fire));
}
function ambient(o) {
  if (!on || !ctx) return; initAmb(); const t = ctx.currentTime, set = (g, v) => g.gain.setTargetAtTime(v, t, 0.2);
  level.fire = Math.min(1, o.fire || 0);
  set(amb.rumbleN.g, 0.5 * (o.quake || 0)); set(amb.rumbleO.g, 0.28 * (o.quake || 0));
  set(amb.fireN.g, 0.05 * level.fire);
  set(amb.windN.g, 0.2 * Math.min(1, (o.tornado || 0) + (o.wind || 0)));
  set(amb.floodN.g, 0.4 * (o.flood || 0));
  const dr = Math.min(1, (o.drones || 0) / 5); set(amb.buzz.g, 0.05 * dr); set(amb.buzz2.g, 0.03 * dr);
  set(amb.hum.g, 0.08 * (o.ufo || 0));
}
function stopAll() {
  level.fire = 0;
  for (const n of Array.from(active)) { try { n.stop(); } catch (e) { /* ignore */ } active.delete(n); }
  if (amb && ctx) { const t = ctx.currentTime; for (const k of ['rumbleN', 'rumbleO', 'fireN', 'windN', 'floodN', 'buzz', 'buzz2', 'hum']) { amb[k].g.gain.cancelScheduledValues(t); amb[k].g.gain.setValueAtTime(0, t); } }
}
function toggle() {
  if (!on) {
    if (!ensure()) return false;
    on = true; ctx.resume && ctx.resume();
    setTimeout(() => { if (on) play('thud', 0.35); }, 80);
  } else { on = false; stopAll(); if (ctx && ctx.suspend) ctx.suspend(); }
  return on;
}
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) { stopAll(); ctx.suspend && ctx.suspend(); } else if (on) ctx.resume && ctx.resume();
});
window.addEventListener('pagehide', () => { stopAll(); });
window.funSound = { get on() { return on; }, toggle, play, ambient, stopAll, hasContext: () => !!ctx, state: () => (ctx ? ctx.state : 'none') };
})();
