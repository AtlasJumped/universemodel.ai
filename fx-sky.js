// Universe Model PREVIEW ONLY: effects demo, third pass: the night sky. Not part of the live site.
// The persona is the HMR fairy: one dense bright ball with a fine trail, in every section, dancing 2 to 4 seconds and leaving, always
// entering from the side it last left by (kept in sessionStorage across pages). Nothing here touches a heading or any text:
// every effect is drawn as sparkles on one fixed overlay canvas under the sticky header; the card effects use transform only
// (a few pixels, put back, the inline style restored node for node). Dark blue sections get a real night sky (star table below).
// Every effect has cleanup that runs when it ends, is interrupted, the tab is hidden or the page unloads, plus a hard timeout.
//
// ===================================================================================================================
// STAR TABLE: real stars, J2000, right ascension in hours (RAh), declination in degrees (Dec), apparent magnitude (mag).
// Values are the standard catalog numbers rounded to about a degree or better. Lines are the classic stick figures.
// ===================================================================================================================
const FX_STAR_TABLE = {
  Orion: { s: [['Betelgeuse', 5.919, 7.41, 0.50], ['Rigel', 5.242, -8.20, 0.13], ['Bellatrix', 5.419, 6.35, 1.64], ['Saiph', 5.796, -9.67, 2.06], ['Alnitak', 5.679, -1.94, 1.77], ['Alnilam', 5.603, -1.20, 1.69], ['Mintaka', 5.533, -0.30, 2.23], ['Meissa', 5.585, 9.93, 3.39]],
    l: ['Betelgeuse,Meissa,Bellatrix', 'Betelgeuse,Alnitak,Alnilam,Mintaka,Bellatrix', 'Alnitak,Saiph', 'Mintaka,Rigel'] },
  'Ursa Major (Big Dipper)': { s: [['Dubhe', 11.062, 61.75, 1.79], ['Merak', 11.031, 56.38, 2.37], ['Phecda', 11.897, 53.69, 2.44], ['Megrez', 12.257, 57.03, 3.31], ['Alioth', 12.900, 55.96, 1.76], ['Mizar', 13.399, 54.93, 2.23], ['Alkaid', 13.792, 49.31, 1.85]],
    l: ['Dubhe,Merak,Phecda,Megrez,Dubhe', 'Megrez,Alioth,Mizar,Alkaid'] },
  Cassiopeia: { s: [['Caph', 0.153, 59.15, 2.27], ['Schedar', 0.675, 56.54, 2.24], ['Gamma Cas', 0.945, 60.72, 2.47], ['Ruchbah', 1.430, 60.24, 2.68], ['Segin', 1.907, 63.67, 3.37]],
    l: ['Caph,Schedar,Gamma Cas,Ruchbah,Segin'] },
  Cygnus: { s: [['Deneb', 20.690, 45.28, 1.25], ['Sadr', 20.370, 40.26, 2.23], ['Albireo', 19.512, 27.96, 3.18], ['Gienah', 20.770, 33.97, 2.46], ['Delta Cyg', 19.750, 45.13, 2.87]],
    l: ['Deneb,Sadr,Albireo', 'Delta Cyg,Sadr,Gienah'] },
  Lyra: { s: [['Vega', 18.616, 38.78, 0.03], ['Zeta Lyr', 18.746, 37.60, 4.10], ['Delta2 Lyr', 18.908, 36.90, 4.30], ['Sulafat', 18.982, 32.69, 3.25], ['Sheliak', 18.835, 33.36, 3.50]],
    l: ['Vega,Zeta Lyr,Delta2 Lyr,Sulafat,Sheliak,Zeta Lyr'] },
  Leo: { s: [['Regulus', 10.140, 11.97, 1.35], ['Eta Leo', 10.122, 16.76, 3.50], ['Algieba', 10.333, 19.84, 2.08], ['Adhafera', 10.278, 23.42, 3.44], ['Rasalas', 9.879, 26.01, 3.88], ['Algenubi', 9.764, 23.77, 2.98], ['Zosma', 11.235, 20.52, 2.56], ['Chertan', 11.237, 15.43, 3.34], ['Denebola', 11.818, 14.57, 2.14]],
    l: ['Regulus,Eta Leo,Algieba,Adhafera,Rasalas,Algenubi', 'Algieba,Zosma,Denebola,Chertan,Regulus', 'Zosma,Chertan'] },
  Scorpius: { s: [['Antares', 16.490, -26.43, 1.06], ['Graffias', 16.090, -19.81, 2.62], ['Dschubba', 16.005, -22.62, 2.29], ['Pi Sco', 15.981, -26.11, 2.89], ['Sigma Sco', 16.353, -25.59, 2.89], ['Tau Sco', 16.598, -28.22, 2.82], ['Epsilon Sco', 16.836, -34.29, 2.29], ['Mu1 Sco', 16.864, -38.05, 3.00], ['Zeta2 Sco', 16.909, -42.36, 3.60], ['Eta Sco', 17.203, -43.24, 3.33], ['Sargas', 17.622, -43.00, 1.87], ['Iota1 Sco', 17.793, -40.13, 3.00], ['Kappa Sco', 17.708, -39.03, 2.41], ['Shaula', 17.560, -37.10, 1.63], ['Lesath', 17.513, -37.30, 2.69]],
    l: ['Graffias,Dschubba,Pi Sco', 'Dschubba,Sigma Sco,Antares,Tau Sco,Epsilon Sco,Mu1 Sco,Zeta2 Sco,Eta Sco,Sargas,Iota1 Sco,Kappa Sco,Shaula,Lesath'] },
  Crux: { s: [['Acrux', 12.443, -63.10, 0.77], ['Mimosa', 12.795, -59.69, 1.25], ['Gacrux', 12.519, -57.11, 1.64], ['Imai', 12.252, -58.75, 2.80]],
    l: ['Acrux,Gacrux', 'Mimosa,Imai'] },
  'Centaurus pointers': { s: [['Alpha Cen', 14.660, -60.83, -0.01], ['Hadar', 14.064, -60.37, 0.61]], l: ['Alpha Cen,Hadar'] },
  Pleiades: { s: [['Alcyone', 3.790, 24.11, 2.87], ['Atlas', 3.819, 24.05, 3.62], ['Electra', 3.748, 24.11, 3.70], ['Maia', 3.763, 24.37, 3.87], ['Merope', 3.772, 23.95, 4.18], ['Taygeta', 3.753, 24.47, 4.30], ['Pleione', 3.822, 24.14, 5.05]], l: [] },
  Taurus: { s: [['Aldebaran', 4.599, 16.51, 0.86], ['Elnath', 5.438, 28.61, 1.65], ['Zeta Tau', 5.627, 21.14, 3.00], ['Theta2 Tau', 4.478, 15.87, 3.40], ['Gamma Tau', 4.330, 15.63, 3.65], ['Delta1 Tau', 4.382, 17.54, 3.76], ['Ain', 4.477, 19.18, 3.53]],
    l: ['Zeta Tau,Aldebaran,Theta2 Tau,Gamma Tau,Delta1 Tau,Ain,Aldebaran', 'Aldebaran,Elnath'] },
  Singles: { s: [['Sirius', 6.752, -16.72, -1.46], ['Procyon', 7.655, 5.22, 0.34], ['Capella', 5.278, 46.00, 0.08], ['Castor', 7.577, 31.89, 1.58], ['Pollux', 7.755, 28.03, 1.14], ['Arcturus', 14.261, 19.18, -0.05], ['Spica', 13.420, -11.16, 0.97], ['Altair', 19.846, 8.87, 0.77], ['Polaris', 2.530, 89.26, 1.98]], l: [] }
};
// One patch of sky per dark blue section: a stereographic projection about (RA, Dec) of the center, east to the left as on a sky chart.
const FX_PATCHES = [
  { id: 'winter', ra: 5.2, dec: 12, span: 80 },   // Orion, Taurus, the Pleiades, Capella, Sirius, Procyon, Castor and Pollux
  { id: 'spring', ra: 12.2, dec: 35, span: 85 },  // Leo, the Big Dipper, Arcturus, Spica
  { id: 'summer', ra: 18.6, dec: 10, span: 95 },  // Lyra, Cygnus, Altair, Scorpius
  { id: 'north', ra: 0, dec: 90, span: 120 },     // around the pole: Cassiopeia, the Big Dipper, Cygnus, Lyra, Polaris, Capella
  { id: 'south', ra: 14.5, dec: -45, span: 95 }   // Crux, the Centaurus pointers, Scorpius, Spica
];

(() => {
  'use strict';
  if (window.fxDemo) return;
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COARSE = matchMedia('(pointer: coarse)').matches;
  const COLS = [[29, 95, 209], [91, 155, 230], [109, 74, 255], [242, 169, 59], [14, 58, 117], [214, 120, 210]];
  const BRIGHT = [[242, 169, 59], [255, 190, 70], [91, 155, 230], [109, 74, 255], [214, 120, 210], [29, 95, 209]];   // saturated: they must read on the white pages too
  const GOLD = [242, 169, 59], WHITE = [255, 250, 232];
  const rnd = (a, b) => a + Math.random() * (b - a), clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, k) => a + (b - a) * k;
  const easeIO = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2, easeO = x => 1 - Math.pow(1 - x, 3), easeI = x => x * x;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const pickCol = () => COLS[Math.floor(Math.random() * COLS.length)];
  const pickBright = () => BRIGHT[Math.floor(Math.random() * BRIGHT.length)];
  const page = (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '') || 'index';
  const parseRGB = s => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return [14, 58, 117]; const p = m[1].split(',').map(parseFloat); return [p[0], p[1], p[2]]; };
  const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  const hdrBottom = () => { const h = document.querySelector('.site-head'); return h ? Math.max(0, h.getBoundingClientRect().bottom) : 0; };

  // ---------------------------------------------------------------- the demo pill, panel and label
  const store = { get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} } };
  let enabled = store.get('fxdemo-off') !== '1';
  const css = document.createElement('style');
  css.textContent = `.fxd-pill{position:fixed;left:12px;bottom:12px;z-index:80;font:600 12px/1 var(--font,system-ui,sans-serif);color:#0E3A75;background:rgba(255,255,255,.94);border:1px solid #cfdcf0;border-radius:999px;padding:8px 12px;cursor:pointer;box-shadow:0 2px 10px rgba(14,58,117,.14);display:flex;align-items:center;gap:7px}
.fxd-pill:hover{background:#fff;border-color:#5B9BE6}.fxd-pill i{width:8px;height:8px;border-radius:50%;background:radial-gradient(circle,#fff6d8 0,#F2A93B 45%,#6D4AFF 100%);display:inline-block}
.fxd-pill.off{cursor:default;color:#5b6b85}.fxd-pill.off i{background:#b6c2d6}
.fxd-panel{position:fixed;left:12px;bottom:52px;z-index:80;width:min(300px,calc(100vw - 24px));max-height:min(70vh,560px);overflow:auto;background:rgba(255,255,255,.97);border:1px solid #cfdcf0;border-radius:14px;box-shadow:0 8px 30px rgba(14,58,117,.22);padding:10px 12px 12px;font:13px/1.3 var(--font,system-ui,sans-serif);color:#0E3A75;display:none}
.fxd-panel.open{display:block}.fxd-panel h4{margin:2px 0 4px;font:700 13px/1.2 var(--font,system-ui,sans-serif);color:#0E3A75;letter-spacing:0}
.fxd-pass{margin:0 0 9px;font-size:12px;line-height:1.35;color:#4A5C75}
.fxd-sw{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:12.5px;cursor:pointer}.fxd-sw input{width:16px;height:16px;accent-color:#1D5FD1}
.fxd-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 0;border-top:1px solid #eef2f9}.fxd-row span{flex:1;min-width:0}
.fxd-row button,.fxd-all{font:600 12px/1 var(--font,system-ui,sans-serif);color:#1D5FD1;background:#fff;border:1px solid #cfdcf0;border-radius:8px;padding:5px 10px;cursor:pointer}
.fxd-row button:hover,.fxd-all:hover{background:#eef4ff;border-color:#5B9BE6}.fxd-all{width:100%;margin-top:9px;padding:8px 10px}
.fxd-label{position:fixed;left:12px;bottom:52px;z-index:80;font:600 12px/1.2 var(--font,system-ui,sans-serif);color:#fff;background:rgba(14,58,117,.9);border-radius:8px;padding:6px 10px;pointer-events:none;opacity:0;transition:opacity .25s}
.fxd-label.on{opacity:1}`;
  // The review panel (pill, panel, name label) shows only in the preview copy of the site. On the live site the effects run without it.
  if (!/\/preview\//.test(location.pathname)) css.textContent += '.fxd-pill,.fxd-panel,.fxd-label{display:none!important}';
  document.head.appendChild(css);
  const pill = document.createElement('button'); pill.type = 'button'; pill.className = 'fxd-pill'; pill.setAttribute('aria-expanded', 'false');
  pill.innerHTML = '<i aria-hidden="true"></i><b style="font-weight:600">Effects demo</b>';
  const label = document.createElement('div'); label.className = 'fxd-label'; label.setAttribute('role', 'status'); label.setAttribute('aria-live', 'polite');
  const panel = document.createElement('div'); panel.className = 'fxd-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Effects demo');
  let labelTimer = 0;
  function say(txt, ms) { label.textContent = txt; label.classList.add('on'); clearTimeout(labelTimer); labelTimer = setTimeout(() => label.classList.remove('on'), ms || 2000); }

  // ---------------------------------------------------------------- engine
  let forceDraw = false, cv = null, c = null, W = innerWidth, H = innerHeight, D = 1, raf = 0, lastDraw = 0;
  const running = [], pending = [], errors = [], skies = [];
  const ptr = { x: null, y: null, t: 0 };
  addEventListener('pointermove', e => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = performance.now(); }, { passive: true });
  function fit() { D = Math.min(1.5, devicePixelRatio || 1); W = innerWidth; H = innerHeight; if (!cv) return; cv.width = Math.round(W * D); cv.height = Math.round(H * D); c.setTransform(D, 0, 0, D, 0, 0); skies.forEach(s => { s.layout = null; }); }
  function ensureCanvas() {
    if (cv) return;
    cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); cv.dataset.fxDemo = '1';
    cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:15';
    document.body.appendChild(cv); c = cv.getContext('2d'); fit(); addEventListener('resize', () => { fit(); keptCons = null; });
  }
  function dropCanvas() { if (!cv) return; removeEventListener('resize', fit); cv.remove(); cv = null; c = null; }
  function idleCheck() { if (!running.length && !pending.length && !skies.length && !keptCons) { if (raf) cancelAnimationFrame(raf); raf = 0; dropCanvas(); } }
  let keptCons = null;   // the page-load constellation stays drawn (owner, 2026-11-22)
  function kick() { ensureCanvas(); if (!raf) { lastDraw = 0; raf = requestAnimationFrame(tick); } }
  const cvOK = () => !document.querySelector('canvas[data-page-fire]');

  function finish(fx) {
    if (fx.ended) return; fx.ended = true; clearTimeout(fx.hard);
    for (let i = fx.ends.length - 1; i >= 0; i--) { try { fx.ends[i](); } catch (e) { errors.push(String(e)); } }
    const k = running.indexOf(fx); if (k >= 0) running.splice(k, 1);
    idleCheck();
  }
  function hurry(fx) { if (fx.hurrying) return; fx.hurrying = true; try { if (fx.inst && fx.inst.hurry) fx.inst.hurry(); } catch (e) {} }
  const laneBusy = lane => running.some(f => f.lane === lane && !f.ended);
  function startFx(def, tg, opt) {
    if (document.hidden || !cvOK()) return false;
    ensureCanvas();
    const fx = { def, tg, sec: tg.sec, lane: def.lane, t: 0, rate: 1, hurrying: false, ended: false, ends: [], sy0: scrollY, inst: null, opt: opt || {} };
    const X = { sec: tg.sec, tg, head: tg.head, fx, opt: fx.opt, guard: f => { fx.ends.push(f); }, items: n => itemsOf(tg.sec, n || 8) };
    let inst = null;
    try { inst = def.make(X); } catch (e) { errors.push(def.id + ': ' + (e && e.stack || e)); inst = null; }
    if (!inst) { for (let i = fx.ends.length - 1; i >= 0; i--) { try { fx.ends[i](); } catch (e) {} } idleCheck(); return false; }
    fx.inst = inst; running.push(fx);
    fx.hard = setTimeout(() => finish(fx), (def.dur + 4) * 1000);
    kick(); if (!fx.opt.quiet) say(inst.label || def.label);
    return true;
  }
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (!forceDraw && now - lastDraw < (running.length ? (COARSE ? 32 : 0) : (COARSE ? 66 : 40))) return; forceDraw = false;
    const dt = Math.min(0.05, Math.max(0.001, (now - (lastDraw || now - 16)) / 1000)); lastDraw = now;
    if (!c) { idleCheck(); return; }
    if (!cvOK()) { stopAll(); return; }
    c.clearRect(0, 0, W, H);
    drawSkies(dt, now); drawKept(now);
    for (const fx of running.slice()) {
      if (fx.ended) continue;
      if (fx.lane === 'fairy') { if (!fx.hurrying && fx.t > 2.6 && (fx.wantHurry || (() => { const r = fx.sec.getBoundingClientRect(); return r.bottom < H * 0.04 || r.top > H * 0.99; })())) hurry(fx); }   // the fairy stays at least 2.6 s
      else if (!fx.hurrying && !fx.def.free) { const r = fx.sec.getBoundingClientRect(); if (Math.abs(scrollY - fx.sy0) > H * 0.6 || r.bottom < H * 0.08 || r.top > H * 0.95) hurry(fx); }
      if (fx.hurrying) fx.rate += (6 - fx.rate) * Math.min(1, dt * 8);
      fx.t += dt * fx.rate;
      let fin = false;
      c.save();
      try { fin = fx.inst.frame(c, fx.t, dt * fx.rate, fx); } catch (e) { errors.push(fx.def.id + ': ' + (e && e.stack || e)); fin = true; }
      c.restore();
      if (fin || fx.t > fx.def.dur + 2.5) finish(fx);
    }
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i]; if (laneBusy(p.def.lane)) continue; pending.splice(i--, 1);
      const r = p.tg.sec.getBoundingClientRect(); if (r.bottom > H * 0.05 && r.top < H * 0.98) startFx(p.def, p.tg, p.opt);
    }
    idleCheck();
  }
  function launch(ids, tg, opt) {
    for (const id of ids) {
      const d = DEF[id]; if (!d || !staticOK(d, tg)) continue;
      if (laneBusy(d.lane)) { const old = running.find(f => f.lane === d.lane); if (old) { if (old.t > 2.6) hurry(old); else old.wantHurry = true; } for (let k = pending.length - 1; k >= 0; k--) if (pending[k].def.lane === d.lane) pending.splice(k, 1); pending.push({ def: d, tg, opt }); kick(); return id; }
      if (startFx(d, tg, opt)) return id;
    }
    return false;
  }
  function stopAll() { running.slice().forEach(finish); pending.length = 0; skies.length = 0; keptCons = null; idleCheck(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopAll(); clearTimeout(cometT); } else if (!REDUCE && cometT !== -1) { scheduleComet(false); } });
  addEventListener('pagehide', () => { stopAll(); clearTimeout(cometT); });

  // ---------------------------------------------------------------- drawing helpers (the look of fx-stars.js)
  const SP = {};
  function sprite(col) {
    const k = col[0] + ',' + col[1] + ',' + col[2]; if (SP[k]) return SP[k];
    const s = document.createElement('canvas'); s.width = s.height = 64; const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${k},0.85)`); gr.addColorStop(0.35, `rgba(${k},0.35)`); gr.addColorStop(1, `rgba(${k},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (SP[k] = s);
  }
  function glow(c, x, y, rad, a, col) { if (a <= 0.01 || rad < 0.5) return; c.globalAlpha = Math.min(1, a); c.drawImage(sprite(col), x - rad, y - rad, rad * 2, rad * 2); c.globalAlpha = 1; }
  function cross(c, x, y, len, a, col, lw) { if (a <= 0.02) return; c.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${Math.min(1, a)})`; c.lineWidth = lw || 1.1; c.beginPath(); c.moveTo(x - len, y); c.lineTo(x + len, y); c.moveTo(x, y - len); c.lineTo(x, y + len); c.stroke(); }
  function spark(c, x, y, R, a, col, star) {
    if (a <= 0.02) return; glow(c, x, y, R * 4, a, col);
    if (R >= 1) { c.fillStyle = `rgba(255,255,255,${Math.min(1, a) * 0.85})`; c.beginPath(); c.arc(x, y, Math.max(0.5, R * 0.42), 0, 6.283); c.fill(); }
    if (star) cross(c, x, y, R * 3.2, a, col);
  }
  let BALL = null;   // the fairy: a dense disc, white-hot center, amber body, violet-blue halo (38 px across with its glow)
  function ballSprite() {
    if (BALL) return BALL; const s = document.createElement('canvas'); s.width = s.height = 96; const g = s.getContext('2d'), gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    [[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,252,236,1)'], [0.29, 'rgba(255,228,140,1)'], [0.40, 'rgba(255,186,58,1)'], [0.50, 'rgba(240,150,30,.92)'], [0.60, 'rgba(214,120,150,.5)'], [0.76, 'rgba(109,74,255,.26)'], [0.9, 'rgba(91,155,230,.1)'], [1, 'rgba(91,155,230,0)']].forEach(q => gr.addColorStop(q[0], q[1]));
    g.fillStyle = gr; g.fillRect(0, 0, 96, 96); return (BALL = s);
  }
  function rrect(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }

  class Swarm {
    constructor(max) { this.p = []; this.max = COARSE ? Math.round(max * 0.6) : max; }
    add(o) { if (this.p.length >= this.max) return null; const p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, r: rnd(0.9, 2.2), life: 1, age: 0, col: pickCol(), star: Math.random() < 0.35, tw: Math.random() * 6.28, drag: 0.97, g: 0 }, o); this.p.push(p); return p; }
    step(dt) { const k = dt * 60; for (let i = this.p.length - 1; i >= 0; i--) { const p = this.p[i]; p.age += dt; if (p.age >= p.life) { this.p.splice(i, 1); continue; } const d = Math.pow(p.drag, k); p.vx *= d; p.vy = p.vy * d + p.g * dt; p.x += p.vx * k; p.y += p.vy * k; } }
    draw(c, mul) { const hb = hdrBottom(); for (const p of this.p) { if (p.y < hb - 4) continue; const u = p.age / p.life, a = Math.min(1, u * 10, (1 - u) * 1.7) * (0.72 + 0.28 * Math.sin(p.tw + p.age * 14)) * (mul == null ? 1 : mul); spark(c, p.x, p.y, p.r * (0.55 + 0.45 * (1 - u)), a, p.col, p.star); } }
  }

  // ---------------------------------------------------------------- DOM reading helpers (nothing here changes layout)
  function holdStyle(X, el) { const was = el.getAttribute('style'); X.guard(() => { const put = () => { if (was === null) { el.style.cssText = ''; el.removeAttribute('style'); } else el.setAttribute('style', was); }; put(); requestAnimationFrame(put); setTimeout(put, 400); setTimeout(put, 900); setTimeout(put, 1600); }); }
  const unsafeIn = el => !!el.querySelector('canvas,input,textarea,select,form,video,iframe');
  const bgOpaque = el => { const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(el).backgroundColor); if (!m) return false; const p = m[1].split(','); return p.length < 4 || parseFloat(p[3]) > 0.8; };
  function tbox(el) { const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return b.width ? b : el.getBoundingClientRect(); }
  const headOk = h => { if (!h) return false; const r = h.getBoundingClientRect(); return r.width > 20 && r.height > 10 && r.bottom > hdrBottom() + 4 && r.top < H * 0.9; };
  function cardsOf(sec) {
    let list = [...sec.querySelectorAll('.card')].filter(e => !(e.parentElement && e.parentElement.closest('.card')));
    if (list.length < 2) list = [...sec.querySelectorAll('.grid > *, .tile')];
    return list;
  }
  function itemsOf(sec, max, any) {
    let list = cardsOf(sec);
    if (list.length < 2 && any !== false) list = [...sec.querySelectorAll('p, li')].filter(e => !e.closest('.card,.pull,.note,nav,.site-head') && (e.textContent || '').trim().length > 40);
    const hb = hdrBottom();
    return list.filter(e => { const r = e.getBoundingClientRect(); return r.width > 90 && r.height > 28 && r.bottom > hb + 10 && r.top < H - 10 && r.height < H * 1.2; }).slice(0, max);
  }
  const safeCards = (sec, max) => itemsOf(sec, 12, false).filter(e => !unsafeIn(e) && !e.closest('canvas,form')).sort((a, b) => { const A = a.getBoundingClientRect(), B = b.getBoundingClientRect(); return Math.abs(A.top - B.top) > 12 ? A.top - B.top : A.left - B.left; }).slice(0, max || 9);
  // paragraphs and list items that begin with a bold phrase
  function boldsOf(sec) {
    const out = [];
    for (const b of sec.querySelectorAll('p > b:first-child, li > b:first-child, p > strong:first-child')) {
      const p = b.parentElement; if (p.closest('.site-head,button,a,h1,h2,h3,h4,summary,nav')) continue;
      let n = p.firstChild; while (n && n !== b && n.nodeType === 3 && !/\S/.test(n.nodeValue)) n = n.nextSibling; if (n !== b) continue;
      if ((b.textContent || '').trim().length < 2) continue; out.push(b);
    }
    return out;
  }
  const boldRect = b => { const rs = b.getClientRects(); return rs.length ? rs[0] : b.getBoundingClientRect(); };
  // rectangles of the text and of other things that must stay clear (viewport coordinates)
  const TXT = 'h1,h2,h3,h4,p,li,dt,dd,.eyebrow,.pull,.note,label,button,.btn,.chipbtn,pre,summary,figcaption,blockquote';
  const BOX = 'img,canvas,svg,table,figure,input,textarea,select,.card,iframe,video,.fig';
  function textRects(root, pad) {
    const out = []; pad = pad == null ? 8 : pad; let n = 0;
    for (const e of root.querySelectorAll(TXT + ',' + BOX)) {
      if (n++ > 500) break; const isBox = e.matches(BOX); if (e.matches('svg') && e.closest('svg') !== e) continue;
      const r = isBox ? e.getBoundingClientRect() : tbox(e); if (r.width < 4 || r.height < 4) continue;
      out.push({ l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad });
    }
    return out;
  }
  // every visible text node and every box (cards, pictures, canvases, form controls), for the quiet background sky
  function allRects(root, pad) {
    const out = [], tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => /\S/.test(n.nodeValue) && !(n.parentElement && n.parentElement.closest('script,style,noscript')) ? 1 : 2 }); let n, k = 0, rg = document.createRange();
    while ((n = tw.nextNode()) && k++ < 1400) { rg.selectNodeContents(n); const r = rg.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; out.push({ l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad }); }
    k = 0; for (const e of root.querySelectorAll(BOX + ',a.btn,.btn,.chipbtn,button,.pull,.note,.tgc,.stat')) { if (k++ > 400) break; const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue; out.push({ l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad }); }
    return out;
  }
  const hit = (x, y, rects, m) => { m = m || 0; for (const q of rects) if (x > q.l - m && x < q.r + m && y > q.t - m && y < q.b + m) return true; return false; };
  const hitEll = (cx, cy, rx, ry, rects) => { for (const q of rects) { const nx = clamp(cx, q.l, q.r), ny = clamp(cy, q.t, q.b), dx = (nx - cx) / rx, dy = (ny - cy) / ry; if (dx * dx + dy * dy < 1) return true; } return false; };
  // points around a rounded rectangle, evenly spaced
  function perimeter(x, y, w, h, r, step) {
    r = Math.min(r, w / 2, h / 2); const pts = [], seg = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / step)); for (let i = 0; i < n; i++) pts.push({ x: lerp(x0, x1, i / n), y: lerp(y0, y1, i / n) }); };
    const arc = (cx, cy, a0) => { const n = Math.max(2, Math.round(r * 1.57 / step)); for (let i = 0; i < n; i++) { const a = a0 + (i / n) * 1.5708; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); } };
    seg(x + r, y, x + w - r, y); arc(x + w - r, y + r, -1.5708); seg(x + w, y + r, x + w, y + h - r); arc(x + w - r, y + h - r, 0);
    seg(x + w - r, y + h, x + r, y + h); arc(x + r, y + h - r, 1.5708); seg(x, y + h - r, x, y + r); arc(x + r, y + r, 3.1416); return pts;
  }

  // ---------------------------------------------------------------- the effects registry
  const DEF = {}, ORDER = [];
  // lane: 'fairy' (the persona, one at a time) or 'x' (one sparkle effect at a time); the night sky is separate and persistent
  const def = (id, label, lane, need, dur, make, more) => { DEF[id] = Object.assign({ id, label, lane, need, dur, make }, more || {}); ORDER.push(id); };
  function staticOK(d, tg) {
    if (d.need === 'cards') return tg.safe && tg.nitems >= 2;
    if (d.need === 'bold') return tg.nbold >= 1;
    if (d.need === 'head') return !!tg.head;
    return true;
  }

  // ===== The fairy: sides, log, dances
  const SIDES = ['left', 'right', 'top'];
  let fairyLogArr = []; try { fairyLogArr = JSON.parse(store.get('fxdemo-log') || '[]') || []; } catch (e) { fairyLogArr = []; }
  const saveLog = () => store.set('fxdemo-log', JSON.stringify(fairyLogArr.slice(-80)));
  const getSide = () => { const s = store.get('fxdemo-side'); return SIDES.includes(s) ? s : (hash(page) % 2 ? 'right' : 'left'); };
  let danceBag = [], lastDance = '';
  function nextDance(avail) {
    danceBag = danceBag.filter(d => avail.includes(d)); if (!danceBag.length) danceBag = avail.slice().sort(() => Math.random() - 0.5);
    let k = danceBag.findIndex(d => d !== lastDance); if (k < 0) k = 0; const d = danceBag.splice(k, 1)[0]; lastDance = d; return d;
  }

  function tongue(c, x, y, w, h, lean, a) {
    c.fillStyle = `rgba(255,86,22,${0.85 * a})`; c.beginPath(); c.moveTo(x - w / 2, y); c.quadraticCurveTo(x - w * 0.6, y - h * 0.55, x + lean, y - h); c.quadraticCurveTo(x + w * 0.6, y - h * 0.5, x + w / 2, y); c.closePath(); c.fill();
    c.fillStyle = `rgba(255,170,44,${0.92 * a})`; c.beginPath(); c.moveTo(x - w * 0.32, y); c.quadraticCurveTo(x - w * 0.36, y - h * 0.4, x + lean * 0.7, y - h * 0.72); c.quadraticCurveTo(x + w * 0.36, y - h * 0.35, x + w * 0.32, y); c.closePath(); c.fill();
    c.fillStyle = `rgba(255,238,160,${0.95 * a})`; c.beginPath(); c.moveTo(x - w * 0.15, y); c.quadraticCurveTo(x - w * 0.16, y - h * 0.2, x + lean * 0.4, y - h * 0.38); c.quadraticCurveTo(x + w * 0.16, y - h * 0.18, x + w * 0.15, y); c.closePath(); c.fill();
  }

  function makeFairy(X, forced) {
    const o = X.opt || {}, tg = X.tg, sw = new Swarm(60), tr = [], trMax = COARSE ? 70 : 130;
    const f = { x: -99, y: -99, a: 0, s: 1, wob: 1, occ: null };
    let dt = 0, T = 0, hurried = false, finished = false, px = null, py = null, em = 0, rx = 0, ry = 0, gen = null, flames = null, flameT = -1;
    const head = headOk(X.head) ? X.head : null, cards = X.items(8), opaque = cards.filter(bgOpaque);
    const hb = () => hdrBottom();
    const zone = () => { const h = hb(); return { x0: W * 0.14, x1: W * 0.86, y0: h + 56, y1: Math.max(h + 130, Math.min(H - 60, h + (H - h) * 0.6)) }; };
    const rp = () => { const z = zone(); return { x: rnd(z.x0, z.x1), y: rnd(z.y0, z.y1) }; };
    // which dance
    const avail = ['loop', 'eight', 'wobble', 'zip']; if (head) avail.push('peekHead'); if (opaque.length) avail.push('peekCard');
    let dance = forced || o.dance || nextDance(avail); if (dance === 'peekHead' && !head) dance = 'loop'; if (dance === 'peekCard' && !opaque.length) dance = 'loop';
    // flames for the danger dance (the label of the section, or the top edge of its first card)
    let fSeg = null;
    if (dance === 'extinguish') {
      const hbv = hb(), eb = tg.eyebrow, er = eb && tbox(eb);
      if (er && er.width > 30 && er.top > hbv + 8 && er.bottom < H - 10) fSeg = () => { const r = tbox(eb); return { x0: r.left - 2, x1: r.right + 2, y: r.top + 2, big: 0.8 }; };
      else { const cd = opaque.find(e => e.getBoundingClientRect().top > hbv + 20) || cards.find(e => e.getBoundingClientRect().top > hbv + 20); if (cd) fSeg = () => { const r = cd.getBoundingClientRect(); const w = Math.min(r.width - 16, 380); return { x0: r.left + 8, x1: r.left + 8 + w, y: r.top + 1, big: 1.15 }; }; }
      if (!fSeg) { dance = 'loop'; } else {
        const s0 = fSeg(), n = clamp(Math.round((s0.x1 - s0.x0) / 7), 8, 46); flames = [];
        for (let i = 0; i < n; i++) flames.push({ u: (i + rnd(0.1, 0.9)) / n, ph: rnd(0, 6.28), hh: rnd(0.65, 1.25), kill: -1 });
        flameT = 0; X.guard(() => { flames = null; });
      }
    }
    if (dance === 'flip') {
      const cd = o.card || safeCards(tg.sec, 6)[0]; if (!cd) dance = 'loop'; else o.card = cd;
      if (o.card) { holdStyle(X, o.card); }
    }
    const side = getSide(); let exit = pick(SIDES.filter(s => s !== 'top' || Math.random() < 0.6)); if (exit === side && Math.random() < 0.35) exit = pick(SIDES);
    store.set('fxdemo-side', exit);   // decided and remembered at the start, so an interrupted fairy still leaves the next one a consistent side
    const L = { page, sec: tg.i, head: tg.head ? tg.head.textContent.trim().slice(0, 36) : null, enter: side, exit, dance, at: Date.now() }; fairyLogArr.push(L); saveLog();
    X.label = (dance === 'extinguish' ? 'Danger: the fairy puts out the flames' : dance === 'flip' ? 'Card flip-sparkle' : 'The HMR fairy: ' + ({ loop: 'loop', eight: 'figure of eight', wobble: 'hover and wobble', zip: 'quick zip', peekHead: 'peeking from behind the heading', peekCard: 'peeking from behind a card' }[dance]));

    function* wait(s) { let e = 0; while (e < s) { e += dt; yield; } }
    function* tween(k, to, dur) { const a = f[k]; let e = 0; while (e < dur) { e += dt; f[k] = lerp(a, to, easeIO(clamp(e / dur, 0, 1))); yield; } f[k] = to; }
    function* pause(s) { f.wob = 3; yield* wait(s); f.wob = 1; }
    function* move(tgf, dur, op) {
      op = op || {}; const P0 = { x: f.x, y: f.y }, T0 = tgf(), dx = T0.x - P0.x, dy = T0.y - P0.y, Ln = Math.hypot(dx, dy) || 1, bend = (op.bend != null ? op.bend : rnd(-0.2, 0.2)) * Ln, nx = -dy / Ln, ny = dx / Ln; let e = 0;
      while (e < dur) { e += dt; const u = clamp(e / dur, 0, 1), k = op.out ? 1 - Math.pow(1 - u, 3) : op.lin ? u : op.in ? u * u * u : easeIO(u), Tn = tgf(), cx = (P0.x + Tn.x) / 2 + nx * bend, cy = (P0.y + Tn.y) / 2 + ny * bend, q = 1 - k;
        f.x = q * q * P0.x + 2 * q * k * cx + k * k * Tn.x; f.y = q * q * P0.y + 2 * q * k * cy + k * k * Tn.y; yield; }
      const Te = tgf(); f.x = Te.x; f.y = Te.y;
    }
    function* along(fn, dur, ease) { let e = 0; while (e < dur) { e += dt; const u = clamp(e / dur, 0, 1), p = fn(ease === false ? u : easeIO(u)); f.x = p.x; f.y = p.y; yield; } }
    const entry = () => { const h = hb(), y = rnd(h + 80, Math.max(h + 140, H * 0.5)); return side === 'left' ? { x: -34, y } : side === 'right' ? { x: W + 34, y } : { x: rnd(W * 0.2, W * 0.8), y: h - 30 }; };
    const exitPt = () => { const y = clamp(f.y, hb() + 40, H - 40); return exit === 'left' ? { x: -44, y: y - 20 } : exit === 'right' ? { x: W + 44, y: y - 20 } : { x: clamp(f.x, 30, W - 30), y: hb() - 44 }; };
    const occRect = () => { if (!f.occ) return null; if (f.occ.type === 'rect') return f.occ.el.getBoundingClientRect(); const b = tbox(f.occ.el); return { left: b.left - 2, right: b.right + 2, top: b.top - 1, bottom: b.bottom + 1, width: b.width + 4, height: b.height + 2 }; };

    const D = {
      * loop() {
        const b = clamp(W * 0.055, 34, 78), a = b * 0.68, n = W > 700 ? (Math.random() < 0.4 ? 2 : 1) : 1, U = 6.283 * n, dir = Math.random() < 0.5 ? 1 : -1, z = zone(), yc = rnd(z.y0 + b, Math.max(z.y0 + b + 10, z.y1 - b * 0.4));
        const span = a * U, x0 = clamp(rnd(W * 0.2, W * 0.8) - dir * span / 2, 50, W - 50 - span * 0 );
        const pt = u => ({ x: clamp(x0 + dir * (a * u - b * Math.sin(u)), 30, W - 30), y: yc - b * Math.cos(u) });
        yield* move(() => pt(0), 0.55); yield* along(u => pt(u * U), 1.9 + n * 0.5);
      },
      * eight() {
        const z = zone(), A = clamp(W * 0.1, 46, 150), B = A * 0.42, cx = clamp(rnd(W * 0.28, W * 0.72), A + 30, W - A - 30), cy = clamp(rnd(z.y0 + B + 10, z.y1 - B), z.y0 + B, Math.max(z.y0 + B + 20, z.y1));
        const pt = u => ({ x: cx + A * Math.sin(u * 6.283), y: cy + B * Math.sin(u * 12.566) });
        yield* move(() => pt(0), 0.55); yield* along(u => pt(u), 2.7, false);
      },
      * wobble() {
        const p = rp(); yield* move(() => p, 0.6); let e = 0; const dur = 2.0, ph = rnd(0, 6.28);
        while (e < dur) { e += dt; const k = Math.min(1, e / 0.2) * Math.min(1, (dur - e) / 0.25 + 0.0); f.x = p.x + Math.sin(e * 4.2 + ph) * 9 * k + Math.sin(e * 9) * 2; f.y = p.y + Math.sin(e * 2.6) * 6 * k + Math.cos(e * 7.5) * 2; f.wob = 2.4; if (Math.random() < dt * 14) sw.add({ x: f.x + rnd(-8, 8), y: f.y + rnd(-8, 8), vy: -0.25, vx: rnd(-0.2, 0.2), life: rnd(0.4, 0.8), r: rnd(0.7, 1.4), col: pickBright() }); yield; }
        f.wob = 1;
      },
      * zip() {
        const n = 3 + (Math.random() < 0.4 ? 1 : 0); for (let i = 0; i < n; i++) { const p = rp(); yield* move(() => p, rnd(0.26, 0.4), { out: true, bend: rnd(-0.12, 0.12) }); yield* pause(rnd(0.3, 0.5)); }
      },
      * peekHead() {
        f.occ = { type: 'text', el: head }; const R = () => occRect(), mid = r => r.top + Math.min(r.height * 0.45, 24);
        yield* move(() => { const r = R(); return { x: r.right + 46, y: mid(r) - 10 }; }, 0.55); yield* pause(0.12);
        yield* move(() => { const r = R(); return { x: r.right - 22, y: mid(r) }; }, 0.35); yield* wait(0.4);
        yield* move(() => { const r = R(); return { x: r.right + 2, y: r.top - 14 }; }, 0.3); yield* pause(0.45);
        yield* move(() => { const r = R(); return { x: r.right - 30, y: mid(r) }; }, 0.25); yield* wait(0.1);
        yield* move(() => { const r = R(); return { x: r.left + Math.min(40, r.width * 0.2), y: mid(r) }; }, clamp(R().width / 700, 0.4, 0.8), { lin: true, bend: 0 }); yield* wait(0.15);
        yield* move(() => { const r = R(); return { x: r.left - 6, y: r.top - 16 }; }, 0.3); yield* pause(0.4); f.occ = null;
      },
      * peekCard() {
        const el = pick(opaque), R = () => el.getBoundingClientRect(); f.occ = { type: 'rect', el };
        yield* move(() => { const r = R(); return { x: r.right + 44, y: r.top + r.height * 0.3 }; }, 0.55); yield* pause(0.1);
        yield* move(() => { const r = R(); return { x: r.right - 26, y: r.top + r.height * 0.3 }; }, 0.35); yield* wait(0.45);
        yield* move(() => { const r = R(); return { x: r.right + 2, y: r.top + r.height * 0.3 - 2 }; }, 0.28); yield* pause(0.45);
        yield* move(() => { const r = R(); return { x: r.right - 24, y: r.top + r.height * 0.3 }; }, 0.22);
        yield* move(() => { const r = R(); return { x: r.left + r.width * 0.55, y: r.top + 22 }; }, 0.6, { lin: true, bend: 0 }); yield* wait(0.15);
        yield* move(() => { const r = R(); return { x: r.left + r.width * 0.55 + 4, y: r.top + 2 }; }, 0.26); yield* pause(0.4); f.occ = null;
      },
      // the fairy puts out the flames, sweeping along the burning line
      * extinguish() {
        const s0 = () => fSeg(), nearRight = side === 'right', a0 = () => { const s = s0(); return nearRight ? { x: s.x1 + 46, y: s.y - 30 } : { x: s.x0 - 46, y: s.y - 30 }; };
        yield* move(a0, 0.55); const dur = clamp((s0().x1 - s0().x0) / 220, 0.8, 1.6);
        yield* along(u => { const s = s0(), x = nearRight ? lerp(s.x1, s.x0, u) : lerp(s.x0, s.x1, u); return { x, y: s.y - 7 + Math.sin(u * 20) * 5 }; }, dur, false);
        for (let i = 0; i < 14; i++) { const s = s0(); sw.add({ x: nearRight ? s.x0 : s.x1, y: s.y - 6, vx: rnd(-1.4, 1.4), vy: rnd(-1.6, -0.2), life: rnd(0.5, 1), r: rnd(0.9, 2), col: pickBright(), star: Math.random() < 0.5, drag: 0.94 }); }
        if (flames) flames.forEach(q => { if (q.kill < 0) q.kill = flameT; });
        yield* wait(0.3);
      },
      // a card tilts once as the fairy passes it
      * flip() {
        const el = o.card, R = () => el.getBoundingClientRect(), lr = Math.random() < 0.5, tilted = { v: false };
        const sx = () => { const r = R(); return lr ? r.left - 54 : r.right + 54; }, ex = () => { const r = R(); return lr ? r.right + 54 : r.left - 54; }, yy = () => { const r = R(); return clamp(r.top + Math.min(r.height * 0.4, 70), hb() + 40, H - 50); };
        yield* move(() => ({ x: sx(), y: yy() - 24 }), 0.6);
        let e = 0; const dur = 1.0; while (e < dur) { e += dt; const u = clamp(e / dur, 0, 1), r = R(); f.x = lerp(sx(), ex(), easeIO(u)); f.y = yy() + Math.sin(u * 9) * 6 - 10 * Math.sin(u * 3.14);
          if (!tilted.v && u > 0.4) { tilted.v = true; tilt(el, lr ? 12 : -12); } yield; }
      }
    };
    let tiltT = [];
    function tilt(el, deg) {
      el.style.transition = 'transform .24s ease-out'; el.style.transform = `perspective(900px) rotateY(${deg}deg)`;
      tiltT.push(setTimeout(() => { el.style.transition = 'transform .3s ease-in-out'; el.style.transform = 'perspective(900px) rotateY(0deg)'; }, 300));
      for (let i = 0; i < 10; i++) { const r = el.getBoundingClientRect(); sw.add({ x: r.left + rnd(0, r.width), y: r.top + rnd(0, Math.min(r.height, 60)), vy: rnd(-0.5, 0.1), vx: rnd(-0.4, 0.4), life: rnd(0.5, 0.9), r: rnd(0.9, 1.8), col: pickBright(), drag: 0.95 }); }
    }
    X.guard(() => { tiltT.forEach(clearTimeout); });

    function* leaveFast() { f.occ = null; f.wob = 1; yield* move(exitPt, 0.32, { in: true, bend: 0.05 }); f.a = 0; yield* wait(0.05); finished = true; }
    function* script() {
      const e0 = entry(); f.x = e0.x; f.y = e0.y; f.a = 1; f.s = 1;
      if (dance === 'extinguish') { f.a = 0; flameT = 0; yield* wait(1.9); f.x = entry().x; f.y = entry().y; f.a = 1; }
      yield* D[dance]();
      f.occ = null; yield* move(exitPt, 0.55, { in: true, bend: rnd(-0.1, 0.1) }); f.a = 0; finished = true;
    }
    gen = script();

    // the fairy IS a sparkle: the site's soft radial dot with the fine four-point cross (fx-stars.js), grown to about 1 cm with its glow,
    // twinkling, its color drifting through the site's sparkle colors
    const FCOL = [[29, 95, 209], [91, 155, 230], [109, 74, 255], [214, 120, 210], [242, 169, 59]];
    const fcol = t => { const k = ((t * 0.28) % 5 + 5) % 5, i = Math.floor(k), u = k - i, A = FCOL[i], B = FCOL[(i + 1) % 5]; return [lerp(A[0], B[0], u), lerp(A[1], B[1], u), lerp(A[2], B[2], u)]; };
    function drawFairy(c, x, y, s, a, t) {
      if (a <= 0.01) return; const col = fcol(t + (tg.i || 0) * 1.7), tw = 0.82 + 0.18 * Math.sin(t * 9), rgb = col.map(Math.round);
      glow(c, x, y, 20 * s, a * 0.55 * tw, rgb); glow(c, x, y, 14 * s, a * tw, rgb); glow(c, x, y, 8.5 * s, a * tw, rgb);
      const gl = (0.7 + 0.3 * Math.sin(t * 7.3)) * a, ln = (17 + 3 * Math.sin(t * 5.1)) * s;
      cross(c, x, y, ln, gl, rgb, 1.5);
      c.save(); c.translate(x, y); c.rotate(0.785 + Math.sin(t * 2) * 0.3); cross(c, 0, 0, 10 * s, gl * 0.75, [109, 74, 255], 1.1); c.restore();
      for (let k = 0; k < 3; k++) { const an = t * (2.6 + k * 1.2) * (k % 2 ? 1 : -1) + k * 2.1, rr = (13 + k * 2.4) * s; spark(c, x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.9, 0.8 * s, a * (0.65 + 0.35 * Math.sin(t * 9 + k)), FCOL[(k * 2 + Math.floor(t)) % 5], k !== 1); }
    }
    function flameFrame(c, ft, d, fx, fy) {
      if (!flames || ft < 0) return; const s = fSeg(); if (!s) return; const w = s.x1 - s.x0, sx = s.big, hbv = hdrBottom(); let alive = 0;
      for (const fl of flames) {
        const x = s.x0 + fl.u * w; if (s.y < hbv + 2) continue;
        if (fl.kill < 0 && fx != null && f.a > 0 && Math.abs(x - fx) < 14) { fl.kill = ft; for (let i = 0; i < 2; i++) sw.add({ x, y: s.y - 6, vx: rnd(-0.5, 0.5), vy: rnd(-1.3, -0.4), life: rnd(0.5, 0.9), r: rnd(0.8, 1.6), col: pickBright(), star: Math.random() < 0.5, drag: 0.95 }); }
        const ig = clamp((ft - 0.15 - fl.u * 0.8) / 0.3, 0, 1), out = fl.kill >= 0 ? 1 - clamp((ft - fl.kill) / 0.22, 0, 1) : 1, k = ig * out; if (k <= 0.02) continue; alive++;
        const fk = 0.72 + 0.28 * Math.sin(ft * 14 + fl.ph) * Math.sin(ft * 8.3 + fl.ph * 2), h = (7 + 9 * fl.hh) * sx * k * fk, ww = 5.5 * sx * (0.8 + 0.4 * k);
        tongue(c, x + Math.sin(ft * 6 + fl.ph) * 0.8, s.y, ww, h, Math.sin(ft * 5 + fl.ph) * ww * 0.45, Math.min(1, k * 1.2));
        if (fl.kill < 0 && Math.random() < d * 2.2) sw.add({ x, y: s.y - h, vx: rnd(-0.2, 0.2), vy: rnd(-1, -0.5), life: rnd(0.4, 0.8), r: rnd(0.6, 1.1), col: [255, 160, 50], star: false, drag: 0.97 });
      }
    }

    return {
      label: X.label, pos() { return { x: rx, y: ry }; }, dance,
      hurry() { if (!hurried) { hurried = true; gen = leaveFast(); if (flames) flames.forEach(q => { if (q.kill < 0) q.kill = flameT; }); } },
      frame(c, t, d) {
        dt = d; T = t; flameT = flameT >= 0 ? flameT + d : -1;
        if (!finished) { const r = gen.next(); if (r.done) finished = true; }
        // keep clear of the pointer: the drawn position is pushed away from it, smoothly
        let tx = 0, ty = 0; if (ptr.x != null && performance.now() - ptr.t < 6000 && f.a > 0) { const dx = f.x - ptr.x, dy = f.y - ptr.y, dd = Math.hypot(dx, dy) || 1, R = 84; if (dd < R) { tx = dx / dd * (R - dd); ty = dy / dd * (R - dd); } }
        const k = Math.min(1, d * 9); rx += (tx - rx) * k; ry += (ty - ry) * k; const prx = rx, pry = ry;
        const wob = f.wob, ox = (Math.sin(t * 6.3) * 1.2 + Math.sin(t * 2.1) * 1.6) * wob, oy = (Math.cos(t * 5.1) * 1.2 + Math.sin(t * 3.3) * 1.4) * wob;
        const X0 = f.x + ox + prx, Y0 = f.y + oy + pry;
        const vis = f.a;
        // the trail: small quick sparkles laid along the path, tapering as they age
        if (px != null && vis > 0) { const dd = Math.hypot(X0 - px, Y0 - py), n = Math.min(14, Math.floor(dd / 3) + (dd < 1 ? (Math.random() < d * 18 ? 1 : 0) : 0));
          for (let i = 0; i < n && tr.length < trMax; i++) { const u = (i + 1) / n; tr.push({ x: lerp(px, X0, u) + rnd(-2, 2), y: lerp(py, Y0, u) + rnd(-2, 2), vx: rnd(-0.15, 0.15), vy: rnd(-0.12, 0.12) + 0.03, age: 0, life: rnd(0.2, 0.55), r: rnd(0.7, 1.6), col: pick(FCOL), pl: Math.random() < 0.4 }); } }
        px = X0; py = Y0; sw.step(d);
        for (let i = tr.length - 1; i >= 0; i--) { const p = tr[i]; p.age += d; if (p.age >= p.life) { tr.splice(i, 1); continue; } p.x += p.vx * d * 60; p.y += p.vy * d * 60; }
        c.save();
        if (f.occ) { const r = occRect(); c.beginPath(); c.rect(-10, -10, W + 20, H + 20); const rr = f.occ.type === 'rect' ? parseFloat(getComputedStyle(f.occ.el).borderTopLeftRadius) || 0 : 2; if (c.roundRect) c.roundRect(r.left, r.top, r.width, r.height, rr); else c.rect(r.left, r.top, r.width, r.height); c.clip('evenodd'); }
        const hbv = hdrBottom();
        for (const p of tr) { if (p.y < hbv) continue; const u = p.age / p.life, a = Math.pow(1 - u, 1.2) * Math.min(1, p.age * 30) * (0.75 + 0.25 * Math.sin(p.age * 30 + p.x)); spark(c, p.x, p.y, p.r * (1 - 0.45 * u), a, p.col, p.pl); }
        sw.draw(c, 1);
        if (X0 > -60 && Y0 > hbv - 40) drawFairy(c, X0, Y0, 1, vis, t);
        c.restore();
        flameFrame(c, flameT, d, f.a > 0 ? X0 : null);
        return finished && !tr.length && !sw.p.length && !(flames && flames.some(q => q.kill < 0 || flameT - q.kill < 0.3));
      }
    };
  }
  def('fairy', 'The HMR fairy', 'fairy', null, 9, X => makeFairy(X));
  def('flip', 'Card tilt', 'fairy', 'cards', 8, X => makeFairy(X, 'flip'));

  function wrapLetters(X, h) {
    if (!h) return null;
    const b0 = h.getBoundingClientRect(), sh0 = document.documentElement.scrollHeight, label0 = h.getAttribute('aria-label');
    const swaps = []; let done = false;
    const restore = () => { if (done) return; done = true; for (const s of swaps) { if (s.wrap.parentNode) s.wrap.parentNode.replaceChild(s.node, s.wrap); } if (label0 === null) h.removeAttribute('aria-label'); else h.setAttribute('aria-label', label0); };
    X.guard(restore);
    const nodes = [], tw = document.createTreeWalker(h, NodeFilter.SHOW_TEXT); while (tw.nextNode()) nodes.push(tw.currentNode);
    h.setAttribute('aria-label', (h.textContent || '').replace(/\s+/g, ' ').trim());
    const letters = [];
    for (const n of nodes) {
      if (!/\S/.test(n.nodeValue)) continue;
      const wrap = document.createElement('span'); wrap.setAttribute('aria-hidden', 'true');
      for (const tok of n.nodeValue.split(/(\s+)/)) {
        if (!tok) continue;
        if (/^\s+$/.test(tok)) { wrap.appendChild(document.createTextNode(tok)); continue; }
        const wd = document.createElement('span'); wd.style.whiteSpace = 'nowrap';
        for (const ch of tok) { const s = document.createElement('span'); s.style.display = 'inline-block'; s.textContent = ch; wd.appendChild(s); letters.push({ el: s, ch }); }
        wrap.appendChild(wd);
      }
      n.parentNode.replaceChild(wrap, n); swaps.push({ node: n, wrap });
    }
    const b1 = h.getBoundingClientRect();
    if (!letters.length || Math.abs(b1.height - b0.height) > 0.5 || Math.abs(b1.width - b0.width) > 0.5 || Math.abs(document.documentElement.scrollHeight - sh0) > 1) { restore(); return null; }
    const sx = scrollX, sy = scrollY;
    letters.forEach((l, i) => { const r = l.el.getBoundingClientRect(); l.i = i; l.x = r.left + sx; l.y = r.top + sy; l.w = r.width; l.h = r.height; l.cx = l.x + l.w / 2; l.cy = l.y + l.h / 2; });
    const cs = getComputedStyle(h), col = parseRGB(cs.color);
    return { L: letters, col, n: letters.length, box: { x: b1.left + sx, y: b1.top + sy, w: b1.width, h: b1.height } };
  }

  // ===== Thought forming: the page title (h1) assembles out of scattered sparkles, on page load only
  const pageH1 = () => { const t = targets[0]; return t && t.sec.querySelector('h1') || document.querySelector('main h1'); };

  // ===== Constellation on page load: a real constellation from the star table, scaled across the page head, drawn LINE BY LINE
  // (stars appear one after another, each line grows from star to star), held, then it fades while the ordinary background sky comes in.
  const CONS_ORDER = ['Orion', 'Ursa Major (Big Dipper)', 'Cassiopeia', 'Cygnus', 'Lyra', 'Leo', 'Scorpius', 'Taurus', 'Crux'];
  const lum = p => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
  function darkAt(x, y) {
    let e = document.elementFromPoint(clamp(x, 1, W - 1), clamp(y, 1, H - 1));
    while (e && e !== document.documentElement) { if (e.classList && e.classList.contains('navyband')) return true; const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(e).backgroundColor); if (m) { const p = m[1].split(',').map(parseFloat); if (p.length < 4 || p[3] > 0.6) return lum(p) < 120; } e = e.parentElement; }
    return false;
  }
  function consShape(name) {
    const st = SKYSTARS.filter(q => q.c === name); if (st.length < 3) return null; const r0 = st[0].ra;
    let mr = 0, md = 0; st.forEach(q => { mr += ((q.ra - r0 + 540) % 360) - 180; md += q.dec; }); mr = r0 + mr / st.length; md /= st.length;
    const P = { ra: mr / 15, dec: md, span: 120 }, pos = new Map(); st.forEach(q => { const p = projectStar(q, P, 1); if (p) pos.set(q, p); });
    return { pos, segs: SKYLINES.filter(([a, b]) => a.c === name && pos.has(a) && pos.has(b)) };
  }
  let headSkyOK = false;
  // home page, wide screens: a second, small constellation in the open area at the top right, above the tensegrity (owner, 2026-11-22)
  function addMini(mainName) {
    try {
      if (!keptCons || W < 1200 || !/(^|\/)(index\.html)?$/.test(location.pathname.replace(/^.*\/preview\//, '/'))) return;
      const hb = hdrBottom(), hh = document.querySelector('.hero-home'), ht = hh ? Math.max(hb + 24, hh.getBoundingClientRect().top + 24) : hb + 24, bx = { l: W * 0.62, r: W - 80, t: ht, b: ht + 146 };   // below the note above the hero, if there is one
      const name = CONS_ORDER.find(n => n !== mainName && /Cassiopeia|Ursa|Cygnus/.test(n)) || CONS_ORDER.find(n => n !== mainName), sh = consShape(name); if (!sh) return;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; sh.pos.forEach(p => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
      const k = Math.min((bx.r - bx.l) / Math.max(1, x1 - x0), (bx.b - bx.t) / Math.max(1, y1 - y0)), ox = (bx.l + bx.r) / 2 - (x0 + x1) / 2 * k, oy = (bx.t + bx.b) / 2 - (y0 + y1) / 2 * k, P = new Map(); sh.pos.forEach((p, q) => P.set(q, { x: ox + p.x * k, y: oy + p.y * k }));
      keptCons.mini = { segs: sh.segs.map(([a, b]) => ({ A: P.get(a), B: P.get(b) })), stars: [...P.entries()].map(([q, pt]) => ({ P: pt, big: q.mag < 2.2 })), born: performance.now() };
    } catch (e) { errors.push('mini: ' + (e && e.stack || e)); }
  }
  function drawKept(now) {
    const K = keptCons; if (!K || !c) return; const off = 0, hb = hdrBottom(), t = now / 1000, f = 0.7 - 0.38 * clamp(Math.abs(scrollY - K.sy0) / 320, 0, 1);   // pinned to the screen, fainter once the page has scrolled under it
    c.save(); c.beginPath(); c.rect(0, hb, W, H - hb); c.clip(); c.lineWidth = 1.2; c.lineCap = 'round'; c.strokeStyle = `rgba(${K.lineC[0]},${K.lineC[1]},${K.lineC[2]},${(K.dark ? 0.7 : 0.62) * f})`;
    if (K.mini) { const m = K.mini, g = clamp((now - m.born) / 1400, 0, 1), n = m.segs.length; c.save(); c.globalAlpha = 1;
      m.segs.forEach((sg, i) => { const u = clamp(g * n - i, 0, 1); if (u <= 0) return; c.beginPath(); c.moveTo(sg.A.x, sg.A.y); c.lineTo(lerp(sg.A.x, sg.B.x, u), lerp(sg.A.y, sg.B.y, u)); c.stroke(); });
      for (const q of m.stars) spark(c, q.P.x, q.P.y, q.big ? 3 : 2.2, f * g * (0.8 + 0.2 * Math.sin(t * 2.2 + q.P.x)), q.big ? GOLD : [29, 95, 209], true); c.restore(); }
    for (const sg of K.segs) { if (Math.max(sg.A.y, sg.B.y) + off < hb - 4 || Math.min(sg.A.y, sg.B.y) + off > H + 4) continue; c.beginPath(); c.moveTo(sg.A.x, sg.A.y + off); c.lineTo(sg.B.x, sg.B.y + off); c.stroke(); }
    for (const q of K.stars) { const y = q.P.y + off; if (y < hb - 6 || y > H + 6) continue; spark(c, q.P.x, y, q.big ? 3 : 2.2, f * (0.8 + 0.2 * Math.sin(t * 2.2 + q.P.x)), K.dark ? (q.big ? [255, 244, 214] : [225, 236, 255]) : (q.big ? GOLD : [29, 95, 209]), true); }
    c.restore();
  }
  def('constellation', 'Constellation on page load', 'x', null, 6, X => {
    const sec = targets[0] ? targets[0].sec : X.sec, r = sec.getBoundingClientRect(), hb = hdrBottom(), top = Math.max(r.top, hb) + 12, bot = Math.min(r.bottom, H - 20) - 8, left = 20, right = W - 20; if (bot - top < 70) return null;
    const rects = textRects(sec, 3); let nb = 0;   // plus every box with its own border or fill (callouts, panels), so no line crosses one
    for (const e of sec.querySelectorAll('div,aside,article,li,a,button')) { if (nb > 120) break; const cs = getComputedStyle(e), bg = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor), al = bg ? (bg[1].split(',').length < 4 ? 1 : parseFloat(bg[1].split(',')[3])) : 0; if (!(parseFloat(cs.borderTopWidth) > 0 || al > 0.3)) continue; const q = e.getBoundingClientRect(); if (q.width < 60 || q.height < 30 || q.width > (right - left) * 0.9 && q.height > (bot - top) * 0.9) continue; nb++; rects.push({ l: q.left - 3, t: q.top - 3, r: q.right + 3, b: q.bottom + 3 }); }
    const dark = darkAt(W / 2, (top + bot) / 2), clearP = (x, y) => !hit(x, y, rects, 5), h0 = X.opt.name ? Math.max(0, CONS_ORDER.indexOf(X.opt.name)) : hash(page) % CONS_ORDER.length;
    const segOK = (A, B) => { let ok = clearP(A.x, A.y) && clearP(B.x, B.y); const nn = Math.max(8, Math.ceil(Math.hypot(B.x - A.x, B.y - A.y) / 14)); for (let k = 1; ok && k < nn; k++) if (!clearP(lerp(A.x, B.x, k / nn), lerp(A.y, B.y, k / nn))) ok = false; return ok; };
    function fitOne(name) {
      const sh = consShape(name); if (!sh) return null; let best = null, maxSpan = 0; const rotInfo = [];
      for (let rot = 0; rot < 16; rot++) { const ca = Math.cos(rot * 0.3927), sa = Math.sin(rot * 0.3927); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; sh.pos.forEach(p => { const x = p.x * ca - p.y * sa, y = p.x * sa + p.y * ca; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
        const sp = (x1 - x0) * Math.min((right - left) / (x1 - x0 || 1), (bot - top) / (y1 - y0 || 1)) / (right - left); rotInfo[rot] = sp; maxSpan = Math.max(maxSpan, sp); }
      for (let rot = 0; rot < 16; rot++) { if (rotInfo[rot] < Math.min(0.85, maxSpan * 0.97)) continue; const ca = Math.cos(rot * 0.3927), sa = Math.sin(rot * 0.3927), pr = new Map(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        sh.pos.forEach((p, k) => { const q = { x: p.x * ca - p.y * sa, y: p.x * sa + p.y * ca }; pr.set(k, q); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); });
        const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0), s2 = Math.min((right - left) / bw, (bot - top) / bh), sx = (right - left) - bw * s2, sy = (bot - top) - bh * s2;
        for (let gx = 0; gx <= 6; gx++) for (let gy = 0; gy <= 10; gy++) { const ox = left + sx * gx / 6 - x0 * s2, oy = top + sy * gy / 10 - y0 * s2, P = new Map(); pr.forEach((q, k) => P.set(k, { x: ox + q.x * s2, y: oy + q.y * s2 }));
          let n = 0; for (const [a, b] of sh.segs) if (segOK(P.get(a), P.get(b))) n++; const sc = n + 2.5 * (bw * s2) / (right - left) + Math.random() * 0.2; if (!best || sc > best.sc) best = { sc, n, P, sh, name }; } }
      return best;
    }
    let pick = null; for (let k = 0; k < CONS_ORDER.length; k++) { const f = fitOne(CONS_ORDER[(h0 + k) % CONS_ORDER.length]); if (f && (!pick || f.n > pick.n)) pick = f; if (pick && pick.n >= 4 && (k === 0 || X.opt.name)) break; if (pick && pick.n >= 5) break; }
    if (!pick) return null; const name = pick.name, best = pick, sh = pick.sh;
    const segs = []; for (const [a, b] of sh.segs) { const A = best.P.get(a), B = best.P.get(b); if (segOK(A, B)) segs.push({ a, b, A, B }); }
    if (segs.length < 2) return null;
    const d = segs.length > 10 ? 0.15 : 0.2, t0 = 0.15, shown = new Map(); let ts = t0; segs.forEach(sg => { sg.t = ts; ts += d; if (!shown.has(sg.a)) shown.set(sg.a, sg.t); if (!shown.has(sg.b)) shown.set(sg.b, sg.t + d); });
    const holdEnd = ts + 1.3, fadeLen = 0.8, sy0 = scrollY, sw = new Swarm(50), lineC = dark ? [175, 205, 250] : [60, 105, 200]; let popped = new Set(), settled = false;
    X.guard(() => { headSkyOK = true; });
    return { label: 'Constellation: ' + name.replace(/ \(.*/, ''), frame(c, t, dt) {
      const off = -(scrollY - sy0), fade = 1 - 0.3 * clamp((t - holdEnd) / fadeLen, 0, 1);
      if (t > holdEnd - 0.4 && !settled) { settled = true; headSkyOK = true; forceDraw = true; }
      c.lineWidth = 1.2; c.lineCap = 'round';
      for (const sg of segs) { const u = clamp((t - sg.t) / d, 0, 1); if (u <= 0) continue; const e = easeO(u), x = lerp(sg.A.x, sg.B.x, e), y = lerp(sg.A.y, sg.B.y, e) + off;
        c.strokeStyle = `rgba(${lineC[0]},${lineC[1]},${lineC[2]},${(dark ? 0.7 : 0.62) * fade})`; c.beginPath(); c.moveTo(sg.A.x, sg.A.y + off); c.lineTo(x, y); c.stroke();
        if (u < 1) { glow(c, x, y, 9, 0.7 * fade, GOLD); if (Math.random() < dt * 40) sw.add({ x, y, vx: rnd(-0.4, 0.4), vy: rnd(-0.4, 0.4), life: 0.35, r: 0.9, col: GOLD, drag: 0.92 }); } }
      shown.forEach((ta, k) => { const u = (t - ta) / 0.25; if (u <= 0) return; const P = best.P.get(k), a = Math.min(1, u) * fade, tw = 0.8 + 0.2 * Math.sin(t * 5 + P.x), big = k.mag < 2.2;
        if (u < 1) glow(c, P.x, P.y + off, 18 * (1 - u) + 6, 0.5 * (1 - u), GOLD); if (!popped.has(k)) { popped.add(k); for (let i = 0; i < 4; i++) { const an = rnd(0, 6.28); sw.add({ x: P.x, y: P.y + off, vx: Math.cos(an) * 0.9, vy: Math.sin(an) * 0.9, life: 0.5, r: 1, col: GOLD, drag: 0.9 }); } }
        spark(c, P.x, P.y + off, big ? 3 : 2.2, a * tw, dark ? (big ? [255, 244, 214] : [225, 236, 255]) : (big ? GOLD : [29, 95, 209]), true); });
      sw.step(dt); sw.draw(c, fade); if (t > holdEnd + fadeLen) { keptCons = { segs, stars: [...shown.keys()].map(k => ({ P: best.P.get(k), big: k.mag < 2.2 })), sy0, lineC, dark }; addMini(name); return true; } return false;
    } };
  });

  // ===== A comet: a small bright sparkle head and a long fine tail of tiny sparkles on a shallow diagonal. Touches nothing on the page.
  def('comet', 'Comet', 'x', null, 2.4, X => {
    const dir = Math.random() < 0.5 ? 1 : -1, sgn = Math.random() < 0.5 ? 1 : -1, hb = hdrBottom(), L = Math.min(560, W * 0.42), tn = Math.tan(rnd(0.12, 0.3)), half = W / 2 * tn;
    const lo = hb + 30 + half, hi = Math.max(lo + 10, H * 0.66), ym = rnd(lo, hi), dur = rnd(1.2, 2.0), span = W + L + 80, N = COARSE ? 24 : 42;
    const ux = dir / Math.hypot(1, tn), uy = dir * sgn * tn / Math.hypot(1, tn), jit = []; for (let k = 0; k < N; k++) jit.push({ a: rnd(-1.8, 1.8), s: rnd(-0.02, 0.02), ph: rnd(0, 6.28), col: BRIGHT[k % 6] });
    let dk = 0, dkT = 0, fr = 0; const under = Math.random() < 0.5;   // half the comets pass behind the cards, as part of the sky
    return { label: 'A comet', frame(c, t, dt) {
      const u = t / dur; if (u >= 1) return true; const tr = u * span, hx = dir > 0 ? -40 + tr : W + 40 - tr, hy = ym + sgn * (hx - W / 2) * tn;
      if (fr++ % 6 === 0 && hx > 0 && hx < W) dkT = darkAt(hx, hy) ? 1 : 0; dk += (dkT - dk) * Math.min(1, dt * 5);
      const m = lerp(0.55, 1, dk), hc = dk > 0.5 ? WHITE : GOLD, tx = hx - ux * L, ty = hy - uy * L;
      c.save(); c.beginPath(); c.rect(0, hdrBottom(), W, H); c.clip();
      if (under) { c.beginPath(); c.rect(0, 0, W, H); for (const e of document.querySelectorAll('.card, .tile')) { if (e.parentElement && e.parentElement.closest('.card')) continue; const r = e.getBoundingClientRect(); if (r.bottom < 0 || r.top > H || r.width < 40) continue; c.rect(r.left, r.top, r.width, r.height); } c.clip('evenodd'); }
      const g = c.createLinearGradient(hx, hy, tx, ty); g.addColorStop(0, `rgba(${hc[0]},${hc[1]},${hc[2]},${0.5 * m})`); g.addColorStop(1, `rgba(${hc[0]},${hc[1]},${hc[2]},0)`);
      c.strokeStyle = g; c.lineWidth = 0.9; c.lineCap = 'round'; c.beginPath(); c.moveTo(hx, hy); c.lineTo(tx, ty); c.stroke();
      for (let k = 0; k < N; k++) { const q = jit[k], s = (k + 1) / N, d = s * L, x = hx - ux * d + -uy * q.a * (0.4 + s), y = hy - uy * d + ux * q.a * (0.4 + s), al = Math.pow(1 - s, 1.5) * m * (0.7 + 0.3 * Math.sin(t * 14 + q.ph)), col = dk > 0.5 ? (k % 3 === 0 ? WHITE : [160, 200, 255]) : q.col;
        spark(c, x, y, 0.6 + (1 - s) * 1.1, al, col, k % 6 === 0); }
      glow(c, hx, hy, 13, 0.7 * m, hc); spark(c, hx, hy, 2.8, m, hc, true); c.restore(); return false;
    } };
  }, { free: true });

  // ===== Sparkle rain over the section's cards
  def('rain', 'Sparkle rain', 'x', null, 5.4, X => {
    let items = X.items(COARSE ? 4 : 6).filter(e => e.getBoundingClientRect().top > hdrBottom() + 14);
    if (!items.length) return null;
    const drops = [], per = COARSE ? 8 : 14;
    items.forEach(e => { const r = e.getBoundingClientRect(), n = Math.min(per, Math.max(5, Math.round(r.width / 28))); for (let i = 0; i < n; i++) drops.push({ el: e, u: (i + rnd(0.1, 0.9)) / n, t0: rnd(0.1, 2.2), fall: rnd(0.7, 1.1), out: rnd(3.5, 4.8), col: pickBright(), star: Math.random() < 0.4, r: rnd(1.3, 2.4), dx: rnd(-14, 14), h: rnd(120, 300), bumped: false }); });
    const sw = new Swarm(60);
    return { frame(c, t, dt) {
      const hb = hdrBottom();
      for (const d of drops) { const r = d.el.getBoundingClientRect(), x = r.left + d.u * r.width, yEnd = r.top - 2; if (yEnd < hb) continue; const u = (t - d.t0) / d.fall;
        if (u < 0) continue; let y, a = 1, rr = d.r;
        if (u < 1) { y = lerp(yEnd - d.h, yEnd, u * u); a = Math.min(1, u * 4) * 0.9; spark(c, x + d.dx * (1 - u), y, rr, a, d.col, d.star); if (Math.random() < dt * 8) sw.add({ x: x + d.dx * (1 - u), y, vy: 0.2, life: 0.4, r: 0.8, col: d.col, star: false }); }
        else { if (!d.bumped) { d.bumped = true; for (let k = 0; k < 2; k++) sw.add({ x, y: yEnd, vx: rnd(-1, 1), vy: rnd(-1.6, -0.5), g: 3, life: 0.5, r: 1, col: d.col, drag: 0.96 }); }
          const bob = u < 1.4 ? Math.abs(Math.sin((u - 1) * 7)) * 5 * (1.4 - u) : 0; y = yEnd - 1 - bob; const tw = t > d.out ? clamp(1 - (t - d.out) / 0.7, 0, 1) : 1, flare = t > d.out ? 1 + 1.8 * Math.sin(Math.PI * clamp((t - d.out) / 0.7, 0, 1)) : 1; spark(c, x, y, rr * flare, tw * (0.8 + 0.2 * Math.sin(t * 8 + d.u * 20)), d.col, d.star || t > d.out); } }
      sw.step(dt); sw.draw(c); return t > 5.3;
    } };
  });

  // ===== Sparkle burst, soft, from the heading's left edge or from a card
  def('burst', 'Sparkle burst', 'x', null, 3.6, X => {
    let ox, oy, dirx = 1; const h = headOk(X.head) ? X.head : null;
    const org = () => { if (h) { const b = tbox(h); return { x: b.left - 8, y: b.top + Math.min(b.height / 2, 30) }; } const e = X.items(4)[0]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 }; };
    const o0 = org(); if (!o0) return null; const sx0 = scrollX, sy0 = scrollY; const sw = new Swarm(100); let fired = 0;
    const wave = n => { for (let i = 0; i < n; i++) { const a = h ? rnd(-2.95, -0.15) : rnd(-3.14, 3.14), s = rnd(0.5, 3.3) * (h ? 1 : 0.8); sw.add({ x: o0.x - (scrollX - sx0), y: o0.y - (scrollY - sy0), vx: Math.cos(a) * s * 1.15, vy: Math.sin(a) * s * 0.8 - 0.2, life: rnd(1.0, 2.1), r: rnd(0.9, 2.4), col: pickBright(), star: Math.random() < 0.45, drag: 0.945, g: 0.5 }); } };
    return { frame(c, t, dt) {
      const ox = o0.x - (scrollX - sx0), oy = o0.y - (scrollY - sy0);
      if (fired < 1 && t > 0.05) { fired = 1; wave(COARSE ? 40 : 66); } if (fired < 2 && t > 0.28) { fired = 2; wave(COARSE ? 20 : 34); }
      const g = clamp(1 - t / 0.55, 0, 1); glow(c, ox, oy, 34 * (1 + (1 - g) * 1.5), g * 0.6, GOLD); glow(c, ox, oy, 16, g, WHITE); if (g > 0.4) cross(c, ox, oy, 20 * g, g, GOLD, 1.3);
      sw.step(dt); sw.draw(c); return t > 3.4;
    } };
  });

  // ===== Galaxy in an empty area
  def('galaxy', 'Galaxy', 'x', null, 5.6, X => {
    const hb = hdrBottom(), rects = textRects(X.sec, 14).map(q => ({ l: q.l, t: q.t, r: q.r, b: q.b }));
    let best = null;
    for (const R of [clamp(Math.min(W * 0.2, (H - hb) * 0.34), 80, 170), 0]) {
      if (!R) break; for (const sc of [1, 0.75, 0.55]) { const rx = R * sc, ry = rx * 0.5, tries = [];
        for (let gx = rx + 12; gx < W - rx - 12; gx += 28) for (let gy = hb + ry + 40; gy < H - ry - 30; gy += 24) { const r0 = X.sec.getBoundingClientRect(); if (gy < r0.top + 10 || gy > r0.bottom - 10) continue; if (!hitEll(gx, gy, rx, ry, rects)) tries.push({ x: gx, y: gy, rx, ry }); }
        if (tries.length) { tries.sort((a, b) => a.y - b.y); best = tries[Math.floor(Math.min(tries.length - 1, tries.length * rnd(0, 0.5)))]; break; } }
      if (best) break;
    }
    if (!best || best.rx < 60) return null;
    const cs = scrollY, cx = best.x, cy0 = best.y, R0 = best.rx, arms = 3, per = COARSE ? 40 : 76, pts = [];
    for (let a = 0; a < arms; a++) for (let i = 0; i < per; i++) pts.push({ a, s: Math.pow((i + rnd(0, 1)) / per, 1.3), j: rnd(-0.22, 0.22), r: rnd(1.0, 2.3), tw: rnd(0, 6.28), star: Math.random() < 0.3 });
    return { frame(c, t, dt) {
      const grow = easeO(clamp(t / 1.5, 0, 1)), A = clamp(t / 0.5, 0, 1) * (1 - clamp((t - 4.5) / 1, 0, 1)), rot = t * 0.8, out = 1 + 0.15 * clamp((t - 4.5) / 1, 0, 1), cy = cy0 - (scrollY - cs);
      glow(c, cx, cy, 52 * grow * out, 0.5 * A, [109, 74, 255]); glow(c, cx, cy, 32 * grow * out, 0.7 * A, [255, 196, 80]); glow(c, cx, cy, 17 * grow, 0.95 * A, WHITE); glow(c, cx, cy, 8 * grow, A, [255, 255, 255]);
      for (const p of pts) { const rr = R0 * grow * out * p.s + 6, an = p.a * 6.283 / arms + 4.2 * Math.pow(p.s, 0.7) + p.j * (1.2 - p.s) + rot * (1.2 - p.s * 0.7), x = cx + Math.cos(an) * rr, y = cy + Math.sin(an) * rr * 0.5; const col = p.s < 0.2 ? GOLD : p.s < 0.5 ? [91, 155, 230] : p.s < 0.8 ? [109, 74, 255] : [214, 120, 210];
        if (y < hdrBottom()) continue; spark(c, x, y, p.r * (1.25 - p.s * 0.45), A * (0.65 + 0.35 * Math.sin(t * 5 + p.tw)), col, p.star); }
      return t > 5.5;
    } };
  });

  // ===== Sparkle tornado: a funnel of sparkles crossing the section (started while the section is still low in the window)
  def('tornado', 'Sparkle tornado', 'x', null, 5.8, X => {
    const hb = hdrBottom(), Hf = clamp(H * 0.34, 130, 240), Rt = clamp(W * 0.08, 46, 96), base = Math.min(H - 30, Math.max(hb + Hf + 50, X.sec.getBoundingClientRect().top + Hf * 0.9));
    if (base - Hf < hb + 24) return null;
    const layers = COARSE ? 12 : 17, per = COARSE ? 7 : 10, pts = [];
    for (let l = 0; l < layers; l++) for (let i = 0; i < per; i++) pts.push({ h: (l + rnd(-0.15, 0.15)) / (layers - 1), a0: i * 6.283 / per + l * 0.7, r: rnd(0.8, 1.7), col: pickBright(), star: Math.random() < 0.18, ph: rnd(0, 6.28) });
    const ltr = Math.random() < 0.5, x0 = ltr ? W * 0.12 : W * 0.88, x1 = ltr ? W * 0.88 : W * 0.12, wgt = t => t < 0.5 ? easeIO(t / 0.5) : t < 4.7 ? 1 : 1 - easeIO(clamp((t - 4.7) / 0.9, 0, 1));
    return { frame(c, t, dt) {
      const k = wgt(t), cx = lerp(x0, x1, easeIO(clamp(t / 5.4, 0, 1))) + Math.sin(t * 2.2) * 8; if (k <= 0.01) return t > 5.2;
      const items = pts.map(p => { const h = p.h, rr = 4 + Math.pow(h, 1.2) * Rt, th = p.a0 + t * (9 - 5.5 * h), lean = Math.sin(t * 1.3 + h * 2.4) * 12 * h; return { p, x: cx + Math.cos(th) * rr + lean, y: base - h * Hf + Math.sin(th) * rr * 0.27, d: Math.sin(th) }; }).sort((a, b) => a.d - b.d);
      for (const q of items) { const dep = 0.5 + 0.5 * (q.d * 0.5 + 0.5); spark(c, q.x, q.y, q.p.r * (0.7 + 0.4 * dep), k * dep * (0.5 + 0.45 * (1 - q.p.h * 0.4)) * (0.8 + 0.2 * Math.sin(t * 6 + q.p.ph)), q.p.col, q.p.star && q.d > 0.5); }
      glow(c, cx, base + 2, 26 * k, 0.4 * k, GOLD); for (let i = 0; i < 6; i++) { const a = t * 6 + i * 1.05; spark(c, cx + Math.cos(a) * 16, base + 3 + Math.sin(a) * 4, 1.1, k * 0.7, GOLD, false); }
      return t > 5.4;
    } };
  });

  // ===== Border shimmer: a line of sparkles runs once around the viewport's edge or around one card
  def('border', 'Border shimmer', 'x', null, 3.4, X => {
    const cd = Math.random() < 0.4 ? safeCards(X.sec, 6).find(e => e.getBoundingClientRect().height < H * 0.8) : null; const sw = new Swarm(120);
    let pts, rad = 14; const hb = hdrBottom(), step = cd ? 7 : 12;
    const build = () => { if (cd) { const r = cd.getBoundingClientRect(); rad = parseFloat(getComputedStyle(cd).borderTopLeftRadius) || 12; return perimeter(r.left - 3, r.top - 3, r.width + 6, r.height + 6, rad + 3, step).map(p => ({ x: p.x, y: p.y })); } return perimeter(7, hb + 7, W - 14, H - hb - 14, 18, step); };
    pts = build(); if (pts.length < 20) return null; const N = pts.length, dur = cd ? 2.0 : 2.6; let last = -1, sy0 = scrollY;
    return { frame(c, t, dt) {
      const live = cd ? build() : pts, u = clamp(t / dur, 0, 1), head = easeIO(u) * N, fade = 1 - clamp((t - dur - 0.3) / 0.8, 0, 1);
      for (let i = Math.floor(last) + 1; i <= Math.floor(head) && i < N; i++) { const p = live[i % live.length]; sw.add({ x: p.x + rnd(-1, 1), y: p.y + rnd(-1, 1), vx: rnd(-0.12, 0.12), vy: rnd(-0.12, 0.12), life: rnd(0.9, 1.5), r: rnd(0.9, 2), col: pickBright(), star: i % 3 === 0, drag: 0.96 }); } last = head;
      sw.step(dt); sw.draw(c, fade);
      if (u < 1) { const p = live[Math.min(N - 1, Math.floor(head))]; if (p) { glow(c, p.x, p.y, 16, 0.9, GOLD); glow(c, p.x, p.y, 8, 1, WHITE); cross(c, p.x, p.y, 11, 0.9, GOLD, 1.2); } }
      return t > dur + 1.2;
    } };
  });

  // ===== Steam: sparkles rise from a bold phrase or from a card's top edge and fade
  function steam(X, bold) {
    let src;
    if (bold) { const bs = boldsOf(X.sec).filter(b => { const r = boldRect(b); return r.top > hdrBottom() + 70 && r.bottom < H - 30 && r.width > 30; }); if (!bs.length) return null; const b = pick(bs.slice(0, 6)); src = () => { const r = boldRect(b); return { x0: r.left, x1: r.right, y: r.top - 1 }; }; }
    else { const cs = safeCards(X.sec, 6).filter(e => e.getBoundingClientRect().top > hdrBottom() + 70); const cd = cs.length ? pick(cs) : null; const e0 = cd || X.items(5).find(e => e.getBoundingClientRect().top > hdrBottom() + 70); if (!e0) return null; src = () => { const r = e0.getBoundingClientRect(); return { x0: r.left + 10, x1: r.right - 10, y: r.top }; }; }
    const sw = new Swarm(90);
    return { frame(c, t, dt) {
      const s = src(), w = Math.max(10, s.x1 - s.x0), e = t < 2.4 ? 1 : Math.max(0, 1 - (t - 2.4) / 0.6);
      if (e > 0 && Math.random() < dt * (bold ? 55 : 70) * e) { const x = s.x0 + Math.random() * w; const p = sw.add({ x, y: s.y, vx: rnd(-0.08, 0.08), vy: -rnd(0.35, 0.9), life: rnd(1.1, 2.0), r: rnd(0.8, 1.9), col: pickBright(), star: Math.random() < 0.3, drag: 0.99 }); if (p) p.sx = rnd(0, 6.28); }
      for (const p of sw.p) p.vx += Math.sin(p.age * 3.2 + p.sx) * 0.012;
      sw.step(dt); sw.draw(c, 1); return t > 3.4 && !sw.p.length;
    } };
  }
  def('steam', 'Steam', 'x', null, 4.2, X => { const b = X.tg.nbold > 0 && Math.random() < 0.5; return steam(X, b) || steam(X, !b); });

  // ===== Card sparkle-in: a sparkle lands on each card's top-left corner in turn, and the card lifts 4 px and settles
  const sparkled = new WeakSet();
  function freshCards(sec) { const hb = hdrBottom(); return cardsOf(sec).filter(e => { if (sparkled.has(e) || unsafeIn(e) || e.closest('canvas,form')) return false; const r = e.getBoundingClientRect(); return r.width > 90 && r.height > 28 && r.top < H - 30 && r.bottom > hb + 20; }).sort((a, b) => { const A = a.getBoundingClientRect(), B = b.getBoundingClientRect(); return Math.abs(A.top - B.top) > 12 ? A.top - B.top : A.left - B.left; }); }
  def('cardin', 'Card sparkle-in', 'x', 'cards', 6, X => {
    let cards = freshCards(X.sec).slice(0, 24); if (!cards.length) cards = safeCards(X.sec, 16); if (!cards.length) return null; cards.forEach(e => sparkled.add(e));
    const sw = new Swarm(260), step = cards.length > 8 ? 0.11 : 0.18, t0 = 0.1, st = [], SW = 0.5;
    const anims = []; X.guard(() => anims.forEach(a => { try { a.cancel(); } catch (e) {} }));
    cards.forEach((el, i) => { st.push({ el, t: t0 + i * step, lifted: false, n: 0 }); });
    const edge = (r, k) => { const P = 2 * (r.width + r.height); let d = k * P; if (d < r.width) return [r.left + d, r.top]; d -= r.width; if (d < r.height) return [r.right, r.top + d]; d -= r.height; if (d < r.width) return [r.right - d, r.bottom]; d -= r.width; return [r.left, r.bottom - d]; };
    return { frame(c, t, dt) {
      for (const q of st) { const u = (t - q.t) / SW; if (u < 0 || u > 1.05) continue; const r = q.el.getBoundingClientRect();
        if (!q.lifted) { q.lifted = true; if (q.el.animate) anims.push(q.el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-3px)', offset: 0.3 }, { transform: 'translateY(-3px)', offset: 0.6 }, { transform: 'translateY(0)' }], { duration: 800, easing: 'ease-in-out' })); }
        const want = Math.floor(Math.min(1, u) * 26); while (q.n < want) { q.n++; const pt = edge(r, Math.random()); sw.add({ x: pt[0] + rnd(-3, 3), y: pt[1] + rnd(-3, 3), vx: rnd(-0.12, 0.12), vy: rnd(-0.3, -0.05), life: rnd(0.6, 1.2), r: rnd(1, 2.3), col: Math.random() < 0.6 ? GOLD : pickBright(), star: true, drag: 0.98 }); if (q.n % 5 === 0) sw.add({ x: rnd(r.left + 10, r.right - 10), y: rnd(r.top + 8, r.bottom - 8), vx: 0, vy: rnd(-0.2, 0), life: rnd(0.5, 0.9), r: rnd(0.8, 1.5), col: pickBright(), star: true, drag: 0.98 }); }
        if (u < 1) { const gx = lerp(r.left, r.right, u); spark(c, gx, r.top, 2.4, 0.95 * Math.sin(u * 3.14), GOLD, true); } }
      sw.step(dt); sw.draw(c); return t > t0 + st.length * step + SW + 1.3;
    } };
  });

  // ===== Card twinkle: sparkles trace one card's border, then it settles
  def('twinkle', 'Card twinkle', 'x', 'cards', 3.6, X => {
    const cs = safeCards(X.sec, 8).filter(e => e.getBoundingClientRect().height < H * 0.8 && e.getBoundingClientRect().top > hdrBottom() + 6); if (!cs.length) return null; const el = pick(cs), sw = new Swarm(90); holdStyle(X, el); let settleT = 0; X.guard(() => clearTimeout(settleT));
    let last = -1, settled = false; const dur = 1.9;
    return { frame(c, t, dt) {
      const r = el.getBoundingClientRect(), pts = perimeter(r.left - 2, r.top - 2, r.width + 4, r.height + 4, (parseFloat(getComputedStyle(el).borderTopLeftRadius) || 12) + 2, 8), N = pts.length, u = clamp(t / dur, 0, 1), head = easeIO(u) * N, fade = 1 - clamp((t - dur - 0.2) / 0.8, 0, 1);
      for (let i = Math.floor(last) + 1; i <= Math.floor(head) && i < N; i++) { const p = pts[i]; sw.add({ x: p.x, y: p.y, vx: rnd(-0.1, 0.1), vy: rnd(-0.1, 0.1), life: rnd(0.7, 1.3), r: rnd(0.9, 1.8), col: pickBright(), star: i % 3 === 0, drag: 0.96 }); } last = head;
      if (u < 1) { const p = pts[Math.min(N - 1, Math.floor(head))]; glow(c, p.x, p.y, 13, 0.9, GOLD); glow(c, p.x, p.y, 6, 1, WHITE); }
      if (!settled && t > dur) { settled = true; el.style.transition = 'transform .25s ease-out'; el.style.transform = 'translateY(-2px)'; settleT = setTimeout(() => { el.style.transition = 'transform .35s ease-in-out'; el.style.transform = 'translateY(0)'; }, 260); }
      sw.step(dt); sw.draw(c, fade); return t > dur + 1.2;
    } };
  });

  // ===== Bold lead-ins: a tiny sparkle twinkles at the start of each bold phrase in turn, down the section
  def('boldtw', 'Bold lead-in twinkles', 'x', 'bold', 6, X => {
    const bs = boldsOf(X.sec).slice(0, 16); if (!bs.length) return null; const step = clamp(4.2 / bs.length, 0.22, 0.5), st = bs.map((b, i) => ({ b, t: 0.2 + i * step, col: i % 3 === 1 ? [91, 155, 230] : i % 3 === 2 ? [109, 74, 255] : GOLD }));
    return { frame(c, t) {
      const hb = hdrBottom(); let alive = false;
      for (const q of st) { const u = (t - q.t) / 0.9; if (u < 0) { alive = true; continue; } if (u > 1) continue; alive = true; const r = boldRect(q.b); if (r.bottom < hb + 6 || r.top > H - 6) continue; const k = Math.sin(Math.PI * u), x = r.left - 2, y = r.top - 1;
        glow(c, x, y, 10 * k + 3, 0.75 * k, q.col); cross(c, x, y, 7 * k + 1, k, q.col, 1.1); c.fillStyle = `rgba(255,255,255,${k})`; c.beginPath(); c.arc(x, y, 1.2, 0, 6.283); c.fill(); }
      return !alive || t > 0.2 + st.length * step + 1.1;
    } };
  });

  // ===== The night sky on dark blue sections: real constellations at real star positions (see the table at the top of the file)
  const SKYSTARS = []; // flattened once: {c, name, ra (deg), dec (deg), mag}, and the line pairs per constellation
  const SKYLINES = [];
  (function flatten() {
    for (const cn in FX_STAR_TABLE) { const e = FX_STAR_TABLE[cn], idx = {}; e.s.forEach(s => { const st = { c: cn, name: s[0], ra: s[1] * 15, dec: s[2], mag: s[3] }; idx[s[0]] = st; SKYSTARS.push(st); });
      for (const chain of e.l) { const nm = chain.split(','); for (let i = 0; i + 1 < nm.length; i++) if (idx[nm[i]] && idx[nm[i + 1]]) SKYLINES.push([idx[nm[i]], idx[nm[i + 1]]]); } }
  })();
  function projectStar(st, P, sc) {
    const d2r = Math.PI / 180, a = st.ra * d2r, d = st.dec * d2r, a0 = P.ra * 15 * d2r, d0 = P.dec * d2r, da = a - a0;
    const cosc = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(da); if (cosc < -0.1) return null; const k = 2 / (1 + cosc);
    const x = k * Math.cos(d) * Math.sin(da), y = k * (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(da));
    if (Math.acos(clamp(cosc, -1, 1)) / d2r > P.span * 0.85) return null;
    return { x: -x * 57.2958 * sc, y: -y * 57.2958 * sc };
  }
  const LCOL = [[29, 95, 209], [91, 155, 230], [109, 74, 255], [242, 169, 59], [214, 120, 210]];
  function buildSky(tg) {
    const r = tg.sky.getBoundingClientRect(), w = r.width, h = r.height; if (w < 100 || h < 60) return null;
    const dark = !!tg.dark, rects = (dark ? textRects(tg.sky, 9) : allRects(tg.sky, 12)).map(q => ({ l: q.l - r.left, t: q.t - r.top, r: q.r - r.left, b: q.b - r.top }));
    // occupancy grid of the text rectangles (8 px cells): a cheap "is this point on text" test
    const gw = Math.ceil(w / 8) + 1, gh = Math.ceil(h / 8) + 1, occ = new Uint8Array(gw * gh);
    for (const q of rects) { const x0 = Math.max(0, Math.floor(q.l / 8)), x1 = Math.min(gw - 1, Math.floor(q.r / 8)), y0 = Math.max(0, Math.floor(q.t / 8)), y1 = Math.min(gh - 1, Math.floor(q.b / 8)); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) occ[y * gw + x] = 1; }
    const cov = (x, y) => { const gx = Math.floor(x / 8), gy = Math.floor(y / 8); return gx < 0 || gy < 0 || gx >= gw || gy >= gh ? 0 : occ[gy * gw + gx]; };
    const pref = (hash(page) + tg.navyIdx * 2) % FX_PATCHES.length;
    let best = null;
    // the patch of sky is chosen per section: the one (and the turn and scale of the chart) whose constellations fit best in the open areas
    for (let pi = 0; pi < FX_PATCHES.length; pi++) { const P = FX_PATCHES[pi], sc0 = clamp(Math.max(w / P.span, h / (P.span * 0.75)), 4, 13);
      for (const mult of [0.55, 0.75, 1]) { const sc = sc0 * mult;
        const base = SKYSTARS.map(st => ({ s: st, p: projectStar(st, P, sc) })).filter(q => q.p); if (!base.length) continue;
        for (let rot = 0; rot < 8; rot++) { const ca = Math.cos(rot * 0.7854), sa = Math.sin(rot * 0.7854);
          const proj = base.map(q => ({ s: q.s, p: { x: q.p.x * ca - q.p.y * sa, y: q.p.x * sa + q.p.y * ca } }));
          let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9; proj.forEach(q => { bx0 = Math.min(bx0, q.p.x); bx1 = Math.max(bx1, q.p.x); by0 = Math.min(by0, q.p.y); by1 = Math.max(by1, q.p.y); });
          for (let gx = 0; gx <= 12; gx++) for (let gy = 0; gy <= 9; gy++) { const ox = lerp(w * 0.1 - bx1, w * 0.9 - bx0, gx / 12), oy = lerp(h * 0.1 - by1, h * 0.9 - by0, gy / 9), byC = {}; let score = 0;
            for (const q of proj) { const x = ox + q.p.x, y = oy + q.p.y, o = byC[q.s.c] || (byC[q.s.c] = { ok: 0, wsum: 0 }), wt = clamp(3.8 - q.s.mag, 0.6, 5) * (y < H * 1.1 ? 1.3 : 1); o.wsum += wt; if (x > 10 && x < w - 10 && y > 10 && y < h - 10) o.ok += cov(x, y) ? wt * 0.2 : wt; }
            for (const cn in byC) { const o = byC[cn], fr = o.ok / o.wsum; score += o.wsum * fr * fr * fr * (cn === 'Singles' ? 0.3 : 1) * (FX_STAR_TABLE[cn].l.length ? 1 : 0.6); }
            score *= Math.pow(mult, 0.3) * (pi === pref ? (dark ? 1.12 : 1.35) : 1); score += Math.random() * 0.3; if (!best || score > best.score) best = { score, ox, oy, sc, proj, P }; } } } }
    if (!best) return null;
    // keep a constellation only if most of its stars sit in the open; a star that falls on text is dimmed to almost nothing
    const stars = [], by = new Map(), tally = {};
    for (const q of best.proj) { const x = best.ox + q.p.x, y = best.oy + q.p.y, inb = x > 4 && x < w - 4 && y > 4 && y < h - 4, t = tally[q.s.c] || (tally[q.s.c] = { n: 0, free: 0 }); t.n++; if (inb && !cov(x, y)) t.free++; q.x = x; q.y = y; q.inb = inb; }
    for (const q of best.proj) { if (!q.inb) continue; const t = tally[q.s.c], single = q.s.c === 'Singles', dim = dark && !!cov(q.x, q.y); if (!dark && cov(q.x, q.y)) continue; if (dim && single) continue; if (!single && t.free / t.n < (dark ? 0.5 : 0.34)) continue;
      const st = { x: q.x, y: q.y, mag: q.s.mag, name: q.s.name, dim, lc: LCOL[stars.length % 5], ph: rnd(0, 6.28), sp: rnd(0.6, 1.6), s: q.s }; stars.push(st); by.set(q.s, st); }
    const lines = []; for (const [a, b] of SKYLINES) { const A = by.get(a), B = by.get(b); if (A && B) lines.push([A, B, A.dim || B.dim]); }
    const dust = [], nd = Math.round(clamp(w * h / (dark ? 12000 : 22000), 12, dark ? 80 : 50) * (COARSE ? 0.6 : 1));
    for (let i = 0, g = 0; i < nd && g < 900; g++) { const x = rnd(8, w - 8), y = rnd(8, h - 8); if (cov(x, y)) continue; i++; dust.push({ x, y, r: rnd(0.5, 1.3), ph: rnd(0, 6.28), sp: rnd(0.4, 1.4), col: Math.random() < 0.16 ? GOLD : Math.random() < 0.3 ? [150, 190, 255] : [235, 242, 255], lc: LCOL[i % 5], pl: Math.random() < 0.15 }); }
    return { dark, w, h, stars, lines, dust, patch: best.P.id, sc: best.sc, rects, cr: parseFloat(getComputedStyle(tg.sky).borderTopLeftRadius) || 0 };
  }
  function drawSkies(dt, now) {
    const hb = hdrBottom(), t = now / 1000;
    for (let i = skies.length - 1; i >= 0; i--) {
      const s = skies[i], tg = s.tg, r = tg.sky.getBoundingClientRect(), vis = r.bottom > hb + 6 && r.top < H - 6 && !(s.until && performance.now() > s.until) && enabled !== false;
      if (!vis) s.dir = -1; s.a = clamp(s.a + (s.dir > 0 ? dt / 1.0 : -dt / 0.8), 0, 1); if (s.dir < 0 && s.a <= 0) { skies.splice(i, 1); continue; }
      if (!s.layout || Math.abs(s.layout.w - r.width) > 2 || Math.abs(s.layout.h - r.height) > 40) { s.layout = buildSky(tg); if (!s.layout) { s.dir = -1; s.a = 0; continue; } }
      const L = s.layout, a = easeIO(s.a), top = Math.max(r.top, hb), bot = Math.min(r.bottom, H);
      c.save(); c.beginPath(); const cr = L.cr; if (cr && c.roundRect) c.roundRect(r.left, r.top, r.width, r.height, cr); else c.rect(r.left, r.top, r.width, r.height); c.clip();
      c.beginPath(); c.rect(r.left, top, r.width, Math.max(0, bot - top)); c.clip();
      if (L.dark) {
        for (const d of L.dust) { const y = r.top + d.y; if (y < top - 4 || y > bot + 4) continue; const tw = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * d.sp + d.ph), 1.5); spark(c, r.left + d.x, y, d.r, a * tw * 0.7, d.col, d.pl && tw > 0.8); }
        c.lineWidth = 0.9; c.strokeStyle = `rgba(175,205,250,${0.24 * a})`; c.beginPath(); for (const [A, B, dm] of L.lines) { if (dm) continue; c.moveTo(r.left + A.x, r.top + A.y); c.lineTo(r.left + B.x, r.top + B.y); } c.stroke();
        c.strokeStyle = `rgba(175,205,250,${0.06 * a})`; c.beginPath(); for (const [A, B, dm] of L.lines) { if (!dm) continue; c.moveTo(r.left + A.x, r.top + A.y); c.lineTo(r.left + B.x, r.top + B.y); } c.stroke();
        for (const st of L.stars) { const y = r.top + st.y; if (y < top - 8 || y > bot + 8) continue; const mag = st.mag, R = clamp(2.0 - mag * 0.26, 0.9, 3.1), tw = 0.8 + 0.2 * Math.sin(t * st.sp * 1.6 + st.ph), col = mag < 1.2 ? [255, 244, 214] : mag < 2.6 ? [225, 236, 255] : [200, 220, 255];
          spark(c, r.left + st.x, y, R, a * tw * (st.dim ? 0.13 : 1), col, !st.dim && mag < 2.0); }
      } else {   // a quiet background on the light sections: the site's sparkle colors at low opacity, lines very faint, slow twinkle, empty areas only
        for (const d of L.dust) { const y = r.top + d.y; if (y < top - 4 || y > bot + 4) continue; const tw = 0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(t * d.sp * 0.7 + d.ph), 1.5); spark(c, r.left + d.x, y, d.r * 0.9, a * tw * 0.3, d.lc, false); }
        c.lineWidth = 0.8; c.strokeStyle = `rgba(80,120,200,${0.13 * a})`; c.beginPath(); for (const [A, B] of L.lines) { c.moveTo(r.left + A.x, r.top + A.y); c.lineTo(r.left + B.x, r.top + B.y); } c.stroke();
        for (const st of L.stars) { const y = r.top + st.y; if (y < top - 8 || y > bot + 8) continue; const mag = st.mag, R = clamp(1.7 - mag * 0.22, 0.8, 2.6), tw = 0.75 + 0.25 * Math.sin(t * st.sp + st.ph);
          spark(c, r.left + st.x, y, R, a * tw * 0.42, st.lc, mag < 2.0); }
      }
      c.restore();
    }
  }
  def('nightsky', 'Background sky', 'sky', null, 8, X => null);   // played through play(): see skyNow()
  function skyNow(tg) {
    if (REDUCE || !cvOK()) return false; if (!tg.forced && skies.some(s => s.tg.sky === tg.sky && s.dir > 0)) return true;
    ensureCanvas(); if (tg.forced) { skies.forEach(s => { if (s.tg.sky === tg.sec) s.a = 0; s.dir = s.tg.sky === tg.sec ? -1 : s.dir; }); }
    skies.push({ tg: tg.forced ? { sec: tg.sec, sky: tg.sec, navyIdx: tg.navyIdx, dark: !!tg.dark } : tg, a: 0, dir: 1, layout: null, until: tg.forced ? performance.now() + 7000 : 0 }); kick(); if (tg.forced) say('Background sky'); return true;
  }

  // ---------------------------------------------------------------- sections: classification, the plan, triggers
  const NEG = /\b(harm|wrong|fail|injur|disease|death|dead|die[sd]?|burn|conflict|crisis|crises|danger|punish|trauma|pain|suffer|broken|violen|abuse|damage|illness|sick|lost|fear|cruel|toxic|war|error|mistake|problem)/i;
  const POS = /\b(future|possib|golden|health|perfect|answer|solution|discover|together|hope|heal|thrive|flourish|whole|unif|beautiful|breakthrough|join|explor|strength|joy)/i;
  function mood(head, eyebrow) {
    let n = 0, p = 0; const score = (txt, w) => { for (const word of String(txt || '').split(/[\s,:;.?!()\-]+/)) { if (!word) continue; if (NEG.test(word)) n += w; if (POS.test(word)) p += w; } };
    score(head, 2); score(eyebrow, 1); return n > p ? 'negative' : p > n ? 'positive' : 'neutral';
  }
  const targets = [], skyTargets = [];
  function collect() {
    const secs = [...document.querySelectorAll('.page-head, .hero, section')].filter(s => !s.closest('.site-head,.site-foot') && !(s.parentElement && s.parentElement.closest('section,.page-head,.hero')));
    secs.forEach((sec, i) => {
      const hd = [...sec.querySelectorAll('h1,h2')].find(h => !h.closest('.card,.site-head')) || null, eb = sec.querySelector('.eyebrow');
      const tg = { sec, head: hd, eyebrow: eb, safe: !sec.querySelector('canvas,input,textarea,select,form'), nitems: cardsOf(sec).filter(e => !unsafeIn(e)).length, nbold: boldsOf(sec).length, i, isHead: sec.classList.contains('page-head') || sec.classList.contains('hero') || i === 0,
        navy: sec.classList.contains('navyband'), nextup: sec.classList.contains('nextup'), mood: mood(hd && hd.textContent, eb && eb.textContent), firedF: false, firedX: false, x: null, xAlt: [], dance: null };
      targets.push(tg);
    });
    // navy rectangles (the dark blue sections, and the navy next-page cards) for the night sky
    // the background sky: every section except the 'In short / Next' block (kept regular blue); dark blue sections get the bright night sky
    targets.forEach((tg, i) => { if (tg.nextup) return; tg.sky = tg.sec; tg.navyIdx = i; tg.dark = tg.navy; skyTargets.push(tg); });
  }

  let t0 = performance.now(), iv = 0;
  let lastScroll = 0, cometT = 0;
  // automatic on scroll: the background sky, and the card sparkle-in once per group of cards (never while the load constellation or a comet runs)
  function check() {
    if (!targets.length || REDUCE || !enabled || document.hidden || !cvOK()) return; const hb = hdrBottom(), now = performance.now();
    for (const tg of skyTargets) { if (tg === targets[0] && (!headSkyOK || keptCons)) continue; const r = tg.sky.getBoundingClientRect(); if (r.bottom > hb + 8 && r.top < H - 8 && !skies.some(s => s.tg.sky === tg.sky)) skyNow(tg); }
    if (now - lastScroll < 250 || laneBusy('x') || pending.length) return;
    // card sparkle on scroll is off: the owner wants cards static for now (2026-11-22); the effect stays in the review panel
  }
  // a comet every 20 to 45 s (the first within 6 to 12 s), only while the page is visible, still, and nothing else of ours is running
  function scheduleComet(first) { clearTimeout(cometT); cometT = setTimeout(tryComet, first ? rnd(6000, 12000) : rnd(20000, 45000)); }
  function tryComet() {
    if (REDUCE) return; if (!enabled || document.hidden || !cvOK() || performance.now() - lastScroll < 1500 || laneBusy('x') || pending.length) { cometT = setTimeout(tryComet, 1500); return; }
    if (startFx(DEF.comet, currentTarget() || targets[0], { quiet: true })) scheduleComet(false); else cometT = setTimeout(tryComet, 3000);
  }
  const start = () => { if (!iv) iv = setInterval(check, 400); };

  // ---------------------------------------------------------------- the control
  function currentTarget() {
    let best = null, bd = 1e9; for (const tg of targets) { const r = tg.sec.getBoundingClientRect(); if (r.bottom < H * 0.2 || r.top > H * 0.8) continue; const d = Math.abs(r.top - H * 0.25); if (d < bd && r.top <= H * 0.5) { bd = d; best = tg; } }
    return best || targets.find(tg => { const r = tg.sec.getBoundingClientRect(); return r.bottom > H * 0.2 && r.top < H * 0.8; }) || targets[0];
  }
  function resolveTarget(sec) {
    if (sec == null) return currentTarget(); if (typeof sec === 'number') return targets[sec]; if (sec.nodeType) return targets.find(t => t.sec === sec || t.sec.contains(sec)) || currentTarget(); return currentTarget();
  }
  function play(name, sec, dance) {
    if (REDUCE) return false; const d = DEF[name] || Object.values(DEF).find(x => x.label === name); if (!d) return false; const tg = resolveTarget(sec); if (!tg) return false;
    if (!cvOK()) { say('The page fire is running. Try again in a moment.', 2200); return false; }
    if (d.id === 'nightsky') return skyNow({ sec: tg.sec, navyIdx: tg.i || 0, forced: true, dark: tg.navy });
    if ((d.need === 'cards' && !(tg.safe && tg.nitems >= 2)) || (d.need === 'bold' && !tg.nbold)) { say(d.need === 'cards' && !tg.safe ? 'This section holds a form or a toy, so card effects are skipped here.' : 'This section has nothing for that effect.', 2200); return false; }
    const old = running.find(f => f.lane === d.lane); if (old) finish(old);
    const ok = startFx(d, tg, dance ? { dance } : {}); if (!ok) say('Nothing to show here. Try another section.', 2000); return ok;
  }
  function replayAll() { stopAll(); targets.forEach(t => { t.firedC = false; }); headSkyOK = false; try { scrollTo({ top: 0, behavior: 'auto' }); } catch (e) { scrollTo(0, 0); } t0 = performance.now(); say('Replaying. Scroll down to see each one.', 2500); start(); if (!startFx(DEF.constellation, targets[0], { quiet: true })) headSkyOK = true; }

  function buildUI() {
    document.body.appendChild(pill); document.body.appendChild(label);
    if (REDUCE) { pill.classList.add('off'); pill.innerHTML = '<i aria-hidden="true"></i><b style="font-weight:600">Effects are off (reduced motion setting)</b>'; pill.setAttribute('aria-disabled', 'true'); return; }
    panel.innerHTML = '<h4>Effects demo</h4><p class="fxd-pass">Third pass: the night sky.</p><label class="fxd-sw"><input type="checkbox" class="fxd-on"> <span>Effects on as I scroll</span></label><h4>Automatic</h4>';
    const row = id => { const r = document.createElement('div'); r.className = 'fxd-row'; r.innerHTML = '<span></span><button type="button">play</button>'; r.firstChild.textContent = DEF[id].label; r.lastChild.setAttribute('aria-label', 'Play ' + DEF[id].label); r.lastChild.addEventListener('click', () => play(id)); panel.appendChild(r); };
    ['nightsky', 'constellation', 'cardin', 'comet'].forEach(row);
    const h2 = document.createElement('h4'); h2.textContent = 'Not in use (try them here)'; h2.style.marginTop = '10px'; panel.appendChild(h2);
    ['fairy', 'rain', 'burst', 'galaxy', 'tornado', 'border', 'steam', 'twinkle', 'flip', 'boldtw'].forEach(row);
    const all = document.createElement('button'); all.type = 'button'; all.className = 'fxd-all'; all.textContent = 'Replay all on this page'; all.addEventListener('click', replayAll); panel.appendChild(all);
    document.body.appendChild(panel);
    const sw = panel.querySelector('.fxd-on'); sw.checked = enabled; sw.addEventListener('change', () => { enabled = sw.checked; store.set('fxdemo-off', enabled ? '0' : '1'); if (!enabled) stopAll(); say(enabled ? 'Effects on' : 'Effects off'); });
    pill.addEventListener('click', () => { const o = !panel.classList.contains('open'); panel.classList.toggle('open', o); pill.setAttribute('aria-expanded', String(o)); label.classList.remove('on'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('open')) { panel.classList.remove('open'); pill.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('click', e => { if (panel.classList.contains('open') && !panel.contains(e.target) && !pill.contains(e.target)) { panel.classList.remove('open'); pill.setAttribute('aria-expanded', 'false'); } });
  }

  window.fxDemo = {
    list: () => ORDER.map(id => DEF[id].label), ids: () => ORDER.slice(), play, running: () => running.map(f => f.def.id), errors: () => errors.slice(),
    plan: () => targets.map(t => ({ i: t.i, head: t.head ? t.head.textContent.trim().slice(0, 40) : null, mood: t.mood, navy: t.navy, safe: t.safe, cards: t.nitems, bolds: t.nbold })),
    fairyLog: () => { try { return JSON.parse(store.get('fxdemo-log') || '[]'); } catch (e) { return fairyLogArr.slice(); } },
    skies: () => skies.map(s => ({ patch: s.layout && s.layout.patch, a: +s.a.toFixed(2), stars: s.layout ? s.layout.stars.length : 0, named: s.layout ? [...new Set(s.layout.stars.filter(q => q.s.c !== 'Singles').map(q => q.s.c))] : [], dust: s.layout ? s.layout.dust.length : 0 })),
    stars: () => FX_STAR_TABLE, stop: stopAll, pos: () => { const f = running.find(r => r.inst && r.inst.pos); return f ? f.inst.pos() : null; }
  };
  function init() {
    buildUI(); if (REDUCE) return; collect();
    let ticking = false; addEventListener('scroll', () => { forceDraw = true; if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; check(); }); }, { passive: true });
    addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });
    start(); setTimeout(() => { headSkyOK = true; check(); }, 7000);
    // page load, right away: the constellation drawn line by line across the page head, then the ordinary background sky; the first comet 6 to 12 s in
    const open = () => { if (!enabled || !cvOK()) { headSkyOK = true; return; } if (scrollY > 250 || !startFx(DEF.constellation, targets[0], { quiet: true })) headSkyOK = true; };
    if (document.hidden) { const once = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', once); open(); } }; document.addEventListener('visibilitychange', once); } else open();
    scheduleComet(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
