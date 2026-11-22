// reactions: a small "React" pill (bottom right) opens a panel of emotions. Pressing one makes the WHOLE visible screen (below the header) react.
// Nothing here changes layout. Every effect is drawn on one fixed overlay canvas under the header. For effects that move letters, the visible
// text is measured with ranges (never wrapped or split in the DOM), hidden with the class rx-gone, and drawn on the canvas instead.
// Negative emotions leave the text destroyed (drawn on the canvas, so it stays put) and sparkles repair it 5 s later, or at once if the visitor scrolls.
// Positive emotions only play over the page. Afterwards every class that was added is removed, so the DOM is exactly as before.
(function () {
  'use strict';
  if (window.hmrReact) return;

  const rm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const eIn = u => u * u * u, eOut = u => 1 - Math.pow(1 - u, 3), eIO = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  const GOLD = [255, 208, 112], WHITE = [255, 255, 255], ICE = [200, 224, 255], AMBER = [238, 160, 30], VIOLET = [140, 120, 255], BLUE = [90, 160, 255];
  // saturated colors that stay visible on a light page
  const SG = [240, 160, 20], SO = [240, 105, 30], SP = [232, 70, 140], SV = [130, 90, 235], SB = [40, 120, 235], ST = [20, 170, 150], SGR = [60, 190, 110];
  const SCOL = [SG, SV, SB, SP, ST, SO];
  const MAD = ['fire', 'tornado', 'hole', 'quake', 'lightning', 'meteor'], HAPPY = ['sparkle', 'fireworks', 'shooting', 'constellation', 'aurora'];
  // rows are opposite pairs: [negative (left), positive (right)]
  const ROWS = [['Mad', '😡', 'Excited', '🤩'], ['Sad', '😢', 'Happy', '😊'], ['Worried', '😟', 'Hopeful', '🥹'], ['Afraid', '😨', 'Calm', '😌'], ['Confused', '😕', 'Curious', '🤔'],
    ['Skeptical', '🤨', 'Amazed', '😮'], ['Disappointed', '😞', 'Grateful', '🥰'], ['Frustrated', '😤', 'Inspired', '😇'], ['Burn it all', '🔥', 'Mind blown', '🤯']];
  const NAMES = []; ROWS.forEach(r => { NAMES.push(r[0], r[2]); });
  const NEG = { 'Mad': 1, 'Sad': 1, 'Worried': 1, 'Afraid': 1, 'Confused': 1, 'Skeptical': 1, 'Disappointed': 1, 'Frustrated': 1, 'Burn it all': 1 };   // text destroyed, repaired 5 s later
  const BLAST = { 'Mind blown': 1 };                                                                                                                  // text destroyed, repaired 1 s later
  const TINT = { Happy: '#F2A93B', Curious: '#5B9BE6', Amazed: '#8E7CFF', Grateful: '#F2A93B', Hopeful: '#FFB347', Excited: '#E8499A', Inspired: '#9B7BFF', Calm: '#6FC7C0', 'Mind blown': '#8E7CFF' };

  // ---------------------------------------------------------------- styles
  const css = document.createElement('style');
  css.textContent = `
.rx-bar{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:18;font:13px/1.2 var(--font,system-ui,sans-serif);color:#0E2A55;max-width:calc(100vw - 24px);display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.rx-row{display:flex;align-items:center;gap:6px}
.rx-panel{width:262px;max-width:calc(100vw - 24px);box-sizing:border-box;background:#fff;border:1px solid #cfdcf0;border-radius:14px;box-shadow:0 6px 24px rgba(14,58,117,.2);padding:8px;max-height:min(72vh,calc(100vh - 150px));max-height:min(72vh,calc(100dvh - 150px));overflow:auto;overscroll-behavior:contain}
.rx-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 7px;padding:0 2px;font-weight:600;font-size:12px;line-height:1.25}
.rx-min,.rx-pill,.rx-chip,.rx-mini{font:600 13px/1 var(--font,system-ui,sans-serif);color:#0E2A55;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.rx-min{min-width:32px;min-height:30px;border:1px solid #d9e3f3;background:#f7faff;border-radius:8px;padding:0 8px}
.rx-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
.rx-chip{min-height:32px;min-width:0;display:flex;align-items:center;gap:5px;padding:0 6px;font-size:12.5px;border:1px solid #d9e3f3;background:#f7faff;border-radius:10px;text-align:left;white-space:nowrap;overflow:hidden}
.rx-chip .e{font-size:16px;line-height:1;flex:none}
.rx-chip.neg{background:#fff4f3;border-color:#f1d3cf}.rx-chip.pos{background:#fff9e8;border-color:#f1e0b3}
.rx-chip.neg:hover{background:#ffe6e3;border-color:#e6aaa3}.rx-chip.pos:hover{background:#fff0c9;border-color:#e3c778}
.rx-chip.burn{background:#C62828;border-color:#9f1d1d;color:#fff}.rx-chip.burn:hover{background:#a81f1f}
.rx-min:hover{background:#e8f1ff;border-color:#b8cdee}
.rx-reset{grid-column:1/-1;justify-content:center;background:#fff;border-color:#C62828;color:#C62828}
.rx-reset:hover{background:#fdeeee}
.rx-reset[aria-disabled="true"]{opacity:.45;border-color:#d9e3f3;color:#53657E;cursor:default}
.rx-pill{display:flex;align-items:center;gap:6px;min-height:36px;padding:0 14px;border:1px solid #cfdcf0;background:#fff;border-radius:999px;box-shadow:0 4px 16px rgba(14,58,117,.2)}
.rx-pill .e{font-size:16px}
.rx-pill[aria-disabled="true"]{opacity:.5;cursor:default}
.rx-mini{display:none;min-height:30px;padding:0 12px;font-size:12px;border:1px solid #C62828;color:#C62828;background:#fff;border-radius:999px;box-shadow:0 3px 12px rgba(14,58,117,.2)}
.rx-bar[data-reset="1"] .rx-mini{display:block}
.rx-bar[data-open="0"] .rx-panel{display:none}
.rx-min:focus-visible,.rx-pill:focus-visible,.rx-chip:focus-visible,.rx-mini:focus-visible{outline:2px solid #0E3A75;outline-offset:2px;box-shadow:0 0 0 4px #fff}
.rx-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.rx-gone{color:transparent!important;-webkit-text-fill-color:transparent!important;text-decoration-color:transparent!important;text-shadow:none!important;transition:none!important}
.rx-clip{background-image:none!important}`;
  document.head.appendChild(css);

  // ---------------------------------------------------------------- overlay canvas and the one loop
  let cv = null, cx = null, DPR = 1, VW = 0, VH = 0, curFo = null;
  let RX = null;      // the reaction in progress: {name, fx, X, eff, neg, phase, blocks, orig, hidden, timer}
  let JOB = null, raf = 0, last = 0;
  function ensureCanvas() {
    if (!cv) {
      cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); cv.dataset.fxReact = '1';
      cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:15';
      document.body.appendChild(cv); cx = cv.getContext('2d'); cx.textAlign = 'center';
    }
    const w = innerWidth, h = innerHeight, d = Math.min(coarse() ? 1.5 : 2, devicePixelRatio || 1);
    if (w !== VW || h !== VH || d !== DPR) { VW = w; VH = h; DPR = d; cv.width = Math.round(w * d); cv.height = Math.round(h * d); cx.textAlign = 'center'; curFo = null; }
  }
  function start(j) { ensureCanvas(); j.t = 0; JOB = j; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
  function frame(ts) {
    raf = 0; const j = JOB; if (!j) { clear(); last = 0; return; }
    const dt0 = last ? clamp((ts - last) / 1000, 0, 0.05) : 0.016; last = ts; const sp = j.speed || 1, dt = dt0 * sp;
    ensureCanvas(); cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.clearRect(0, 0, VW, VH); cx.globalAlpha = 1;
    const r = RX ? RX.X.r : { left: 0, top: 0, width: VW, height: VH };
    cx.save(); cx.beginPath(); cx.rect(0, r.top, VW, VH - r.top); cx.clip();
    j.t += dt; let fin = false;
    try { fin = j.step(dt, r, cx); } catch (e) { fin = true; j.err = e; try { console.warn('fx-react', e); } catch (e2) { } }
    cx.restore(); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
    if (j.hide && !j.hid && RX) { j.hid = 1; hideDOM(); }   // the real text goes the moment its canvas copy is drawn
    if (fin && JOB === j) { JOB = null; try { if (j.end) j.end(j.err); } catch (e) { try { resetNow(); } catch (e2) { } } }
    if (JOB) raf = requestAnimationFrame(frame); else { clear(); last = 0; }
  }
  function clear() { if (cx) { cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); } }

  // ---------------------------------------------------------------- drawing helpers
  const SPR = {};
  function sprite(col) {
    const k = col.join(','); if (SPR[k]) return SPR[k];
    const s = document.createElement('canvas'); s.width = s.height = 64; const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${k},0.9)`); gr.addColorStop(0.35, `rgba(${k},0.38)`); gr.addColorStop(1, `rgba(${k},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (SPR[k] = s);
  }
  function glow(c, x, y, rad, a, col) { if (a <= 0.01 || rad < 0.5) return; c.globalAlpha = Math.min(1, a); c.drawImage(sprite(col), x - rad, y - rad, rad * 2, rad * 2); c.globalAlpha = 1; }
  // a solid four-point star with a thin dark edge, so it shows on a light page (never used by fire or meteors)
  function star(c, x, y, R, a, col, rot) {
    if (a <= .02 || R < .4) return; a = Math.min(1, a); glow(c, x, y, R * 3.4, a * .7, col);
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.globalAlpha = a; c.beginPath();
    for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4, rr = i % 2 ? R * .34 : R * 1.7, px = Math.sin(an) * rr, py = -Math.cos(an) * rr; i ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.closePath(); c.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`; c.fill(); c.lineWidth = .8; c.strokeStyle = `rgba(${col[0] * .45 | 0},${col[1] * .45 | 0},${col[2] * .45 | 0},.55)`; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.arc(0, 0, R * .28, 0, 6.283); c.fill(); c.restore();
  }
  function dot(c, x, y, R, a, col) {   // a round bright particle with a soft halo and a solid colored body
    if (a <= .02) return; glow(c, x, y, R * 3, a * .55, col); c.globalAlpha = Math.min(1, a); c.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`; c.beginPath(); c.arc(x, y, R, 0, 6.283); c.fill();
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(x, y, R * .4, 0, 6.283); c.fill(); c.globalAlpha = 1;
  }
  function rrect(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  const rgbOf = s => { const m = /(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)/.exec(s || ''); return m ? [+m[1], +m[2], +m[3]] : [20, 30, 50]; };
  const mixc = (a, b, u) => `rgb(${Math.round(lerp(a[0], b[0], u))},${Math.round(lerp(a[1], b[1], u))},${Math.round(lerp(a[2], b[2], u))})`;
  const rgbs = a => `rgb(${a[0]},${a[1]},${a[2]})`;
  const shuffle = a => a.sort(() => Math.random() - .5);

  // ---------------------------------------------------------------- real fire: ragged, overlapping tongue flames with a bright core, round embers, smoke. No stars.
  const FS = [[], [], []];
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  (function () {
    const stops = [[[255, 160, 30, 0], [255, 140, 25, .92], [255, 215, 90, 1], [255, 248, 200, 1]], [[255, 110, 20, 0], [245, 95, 20, .92], [255, 150, 35, .97], [255, 205, 80, 1]], [[190, 40, 20, 0], [200, 45, 20, .7], [225, 80, 20, .88], [240, 115, 28, .88]]];
    for (let s = 0; s < 3; s++) for (let k = 0; k < 6; k++) {
      const R = mulberry(s * 97 + k * 13 + 5), c = document.createElement('canvas'); c.width = 48; c.height = 96; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 4, 0, 94);
      [0, .38, .74, 1].forEach((p, i) => gr.addColorStop(p, `rgba(${stops[s][i].join(',')})`)); g.fillStyle = gr;
      const tongue = (bx, w, h, lean) => { g.beginPath(); g.moveTo(bx - w / 2, 94); g.bezierCurveTo(bx - w * .62, 94 - h * .34, bx - w * .22 + lean * .3, 94 - h * .62, bx + lean, 94 - h); g.bezierCurveTo(bx + w * .12 + lean * .55, 94 - h * .56, bx + w * .66, 94 - h * .3, bx + w / 2, 94); g.closePath(); g.fill(); };
      tongue(24 + (R() - .5) * 4, 30 + R() * 10, 86 + R() * 8, (R() - .5) * 16);
      const extra = 1 + ((R() * 2) | 0);
      for (let e = 0; e < extra; e++) { const side = R() < .5 ? -1 : 1; tongue(24 + side * (5 + R() * 8), 18 + R() * 8, 40 + R() * 30, side * (4 + R() * 12)); }
      if (s < 2) {   // the bright core
        const g2 = g.createLinearGradient(0, 40, 0, 94); g2.addColorStop(0, 'rgba(255,250,215,0)'); g2.addColorStop(.5, 'rgba(255,238,160,.85)'); g2.addColorStop(1, 'rgba(255,255,235,.95)'); g.fillStyle = g2;
        g.beginPath(); g.moveTo(17, 94); g.quadraticCurveTo(15, 70, 24 + (R() - .5) * 4, 46 + R() * 10); g.quadraticCurveTo(33, 70, 31, 94); g.closePath(); g.fill();
      }
      FS[s].push(c);
    }
  })();
  // parts: {k:'f' flame | 'e' ember | 's' smoke, x, y (region-relative), vx, vy, life, age, sz}
  function flameAt(arr, x, y, sz, o) { o = o || {}; arr.push({ k: 'f', x, y, vx: rnd(-16, 16), vy: -rnd(o.v0 || 45, o.v1 || 115), life: rnd(o.l0 || .55, o.l1 || 1.15), age: 0, sz, ph: rnd(0, 6), sh: (Math.random() * 6) | 0 }); }
  function emberAt(arr, x, y, n) { for (let i = 0; i < n; i++) arr.push({ k: 'e', x: x + rnd(-8, 8), y, vx: rnd(-40, 40), vy: -rnd(40, 130), life: rnd(.6, 1.3), age: 0, sz: rnd(1.4, 2.6) }); }
  function smokeAt(arr, x, y, n, big) { for (let i = 0; i < n; i++) arr.push({ k: 's', x: x + rnd(-8, 8), y: y - 6, vx: rnd(-12, 12), vy: -rnd(18, 40), life: rnd(.8, 1.4), age: 0, sz: rnd(7, 13) * (big || 1) }); }
  function stepParts(g, arr, dt, ox, oy) {
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i]; p.age += dt; if (p.age >= p.life) { arr.splice(i, 1); continue; }
      const u = p.age / p.life; p.x += p.vx * dt + (p.k === 'f' ? Math.sin(p.age * 11 + p.ph) * .5 : 0); p.y += p.vy * dt; if (p.k === 'e') p.vy += 20 * dt;
      const X = ox + p.x, Y = oy + p.y;
      if (p.k === 'f') {
        const st = u < .3 ? 0 : u < .66 ? 1 : 2, w = p.sz * (.8 + .4 * (p.ph % 1)) * (1 + .15 * Math.sin(p.age * 26 + p.ph)), h = w * 2 * (.85 + .5 * ((p.ph * 7) % 1)) * (1 - u * .3);
        g.globalAlpha = Math.min(1, (1 - u) * 1.8); g.save(); g.translate(X, Y); g.transform(1, 0, Math.sin(p.age * 9 + p.ph) * .28, 1, 0, 0); g.drawImage(FS[st][p.sh], -w / 2, -h, w, h); g.restore(); g.globalAlpha = 1;
      } else if (p.k === 'e') glow(g, X, Y, p.sz * 3.2, (1 - u) * (.75 + .25 * Math.sin(p.age * 30)), [255, 140, 40]);
      else glow(g, X, Y, p.sz * (1 + u * 1.8), .24 * (1 - u), [70, 62, 56]);
    }
  }

  // ---------------------------------------------------------------- measuring the visible text (nothing in the DOM changes)
  const SKIP_SEL = '.site-head,.hmr-track,.hmr-pop,[data-hmr],.rx-bar,.fxd-pill,.fxd-panel,.fxd-label,.fxd-row,button,select,textarea,option,input,script,style,noscript,svg,[hidden],[class*="preview-banner"],[class*="pv-banner"]';
  const ROOT = { skip: false, op: 1, clip: null };
  const isect = (a, b) => ({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });
  const isClear = s => /^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\)$|^transparent$/.test(s || '');
  // Everything visible below the header: letters (or words, or lines when there are too many), the elements that own them, the region.
  function gather() {
    ensureCanvas();
    const head = document.querySelector('.site-head'), vw = innerWidth, vh = innerHeight, hb = head ? clamp(head.getBoundingClientRect().bottom, 0, vh * .5) : 0;
    const REG = { left: 0, top: hb, width: vw, height: vh - hb, right: vw, bottom: vh }; REG.getBoundingClientRect = () => REG;
    const media = Array.from(document.querySelectorAll('canvas,video,iframe')).filter(e => {
      if (e === cv || e.dataset.fxReact) return false; const cs = getComputedStyle(e); if (cs.position === 'fixed' || e.getAttribute('aria-hidden') === 'true') return false;
      const r = e.getBoundingClientRect(); return r.width > 20 && r.height > 20 && r.bottom > hb && r.top < vh && r.width * r.height < vw * vh * .85;
    }).map(e => e.getBoundingClientRect());
    const IC = new Map();
    const info = el => {
      if (!el || el === document.body || el === document.documentElement) return ROOT; let i = IC.get(el); if (i) return i;
      const p = info(el.parentElement), cs = getComputedStyle(el); i = { skip: p.skip, op: p.op, clip: p.clip, rect: null };
      if (!i.skip) {
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed' || el.matches(SKIP_SEL)) i.skip = true;
        else { i.op = p.op * (parseFloat(cs.opacity) || 0); if (i.op < .05) i.skip = true; if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const r = el.getBoundingClientRect(); i.clip = p.clip ? isect(p.clip, r) : r; } }
      }
      i.rect = el.getBoundingClientRect(); IC.set(el, i); return i;
    };
    const raw = [], blocks = new Map(), fos = new Map(), rg = document.createRange();
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n => {
      if (!/\S/.test(n.nodeValue) || /^\s*Preview: changes waiting for approval/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT; const p = n.parentElement; if (!p) return NodeFilter.FILTER_REJECT;
      const i = info(p); if (i.skip) return NodeFilter.FILTER_REJECT; const rc = i.rect;
      return (rc.bottom <= hb || rc.top >= vh || rc.right <= 0 || rc.left >= vw) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    } });
    let n, wid = 0;
    while ((n = tw.nextNode())) {
      const p = n.parentElement, inf = info(p); let fo = fos.get(p);
      if (!fo) {
        const cs = getComputedStyle(p), fill = cs.webkitTextFillColor; let col = cs.color;
        if (isClear(fill)) col = isClear(cs.color) ? '#0E3A75' : cs.color; else if (fill) col = fill;
        fo = { font: cs.font || `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, color: col, rgb: rgbOf(col), up: cs.textTransform === 'uppercase', op: inf.op, by: 0, bi: fos.size, clip: cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text' };
        cx.font = fo.font; const m = cx.measureText('Hg'); fo.by = m.fontBoundingBoxAscent != null ? (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2 : parseFloat(cs.fontSize) * .33; fos.set(p, fo);
      }
      const t = n.nodeValue; wid++; const cl = inf.clip; let any = false;
      for (let i = 0; i < t.length; i++) {
        if (/\s/.test(t[i])) { wid++; continue; }
        rg.setStart(n, i); rg.setEnd(n, i + 1); const rc = rg.getClientRects(); if (!rc.length) continue; const b = rc[0]; if (b.width < .5 || b.height < 2) continue;
        const mx = b.left + b.width / 2, my = b.top + b.height / 2;
        if (my < hb + 1 || my > vh - 1 || mx < 0 || mx > vw) continue;
        if (cl && (mx < cl.left - 1 || mx > cl.right + 1 || my < cl.top - 1 || my > cl.bottom + 1)) continue;
        if (media.some(m => mx > m.left && mx < m.right && my > m.top && my < m.bottom)) continue;
        raw.push({ ch: fo.up ? t[i].toUpperCase() : t[i], fo, l: b.left, r: b.right, x: mx, y: my - hb, wid, ln: Math.round(b.top), bi: fo.bi }); any = true;
      }
      if (any) blocks.set(p, fo.clip);
    }
    if (!raw.length) return null;
    const merge = lvl => {   // 1: words, 2: whole lines
      const out = [], key = new Map();
      raw.forEach(L => {
        const k = lvl === 1 ? L.wid + ':' + L.ln : L.bi + ':' + L.ln; let q = key.get(k);
        if (!q) { q = { ch: '', fo: L.fo, l: L.l, r: L.r, y: L.y, wid: L.wid, ln: L.ln, bi: L.bi, lw: L.wid }; key.set(k, q); out.push(q); }
        if (lvl === 2 && L.wid !== q.lw) { q.ch += ' '; q.lw = L.wid; } q.ch += L.ch; q.l = Math.min(q.l, L.l); q.r = Math.max(q.r, L.r);
      });
      out.forEach(q => { q.x = (q.l + q.r) / 2; }); return out;
    };
    raw.forEach(L => { L.l -= 0; });
    const words = merge(1), cap = coarse() ? 500 : 900;
    const items = raw.length <= cap ? raw : words.length <= 700 ? words : merge(2);
    [raw, words, items].forEach(a => a.forEach(L => { L.x0 = L.x; L.y0 = L.y; L.l0 = L.l - 0; L.r0 = L.r - 0; }));
    // letter left/right are screen-relative; effects use region-relative x, so shift l and r into x space (they are already screen x)
    return { r: REG, W: vw, H: vh - hb, hb, items, words, raw, blocks, level: items === raw ? 0 : items === words ? 1 : 2, coarse: coarse() };
  }

  // ---------------------------------------------------------------- the DOM: classes added to the text owners and removed again, exactly
  const live = document.createElement('span'); live.className = 'rx-sr'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
  function say(t) { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); }
  function hideDOM() {
    if (!RX || RX.hidden) return; RX.hidden = true;
    RX.blocks.forEach((clip, el) => { if (!RX.orig.has(el)) RX.orig.set(el, el.hasAttribute('class') ? el.getAttribute('class') : null); el.classList.add('rx-gone'); if (clip) el.classList.add('rx-clip'); });
  }
  function restoreDOM() {
    if (!RX || !RX.hidden) return; RX.hidden = false;
    const still = document.createElement('style'); still.textContent = '*,*::before,*::after{transition:none!important}'; document.head.appendChild(still); setTimeout(() => still.remove(), 160);
    RX.blocks.forEach((clip, el) => {
      el.classList.remove('rx-gone', 'rx-clip'); const o = RX.orig.get(el);
      if (o === null && el.getAttribute('class') === '') el.removeAttribute('class');
    });
  }

  // ---------------------------------------------------------------- letters on the canvas
  function put(g, L, X, Y, rot, sx, sy, a, col) {   // X, Y: center, in screen pixels
    a *= L.fo.op; if (a <= .01) return;
    if (curFo !== L.fo) { g.font = L.fo.font; curFo = L.fo; }
    g.globalAlpha = Math.min(1, a); g.fillStyle = col || L.fo.color;
    if (!rot && sx === 1 && sy === 1) g.fillText(L.ch, X, Y + L.fo.by);
    else { const c = Math.cos(rot), sn = Math.sin(rot); g.setTransform(DPR * sx * c, DPR * sx * sn, -DPR * sy * sn, DPR * sy * c, DPR * X, DPR * Y); g.fillText(L.ch, 0, L.fo.by); g.setTransform(DPR, 0, 0, DPR, 0, 0); }
    g.globalAlpha = 1;
  }
  // a letter that has been knocked loose and flies free
  function flyL(L, o) { Object.assign(L, o, { fly: 1, age: 0, rot: L.rot || 0 }); }
  function stepFly(L, dt) { L.age += dt; L.vy += L.g * dt; L.x += L.vx * dt; L.y += L.vy * dt; L.rot += L.vr * dt; return L.age >= L.life; }
  const SCALE = X => clamp(Math.min(X.W, X.H) / 520, 1, 1.45);

  // ---------------------------------------------------------------- tornadoes
  function bolt(x0, y0, x1, y1, jit) {
    const pts = [[x0, y0]], n = 11, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    for (let i = 1; i < n; i++) { const q = i / n, j = (Math.random() - .5) * 2 * jit * (1 - q * .55); pts.push([x0 + dx * q + nx * j, y0 + dy * q + ny * j]); }
    pts.push([x1, y1]); return pts;
  }
  function fxTornado(X) {
    const items = X.items, W = X.W, H = X.H, sc = SCALE(X), Hf = Math.min(H * .85, 520), nT = X.coarse || W < 700 ? 3 : 4;
    const tors = Array.from({ length: nT }, (_, k) => {
      const bw = W / nT, cxk = bw * (k + .5), side = k % 3, st = side === 0 ? { x: -70, y: rnd(.6, 1) * H } : side === 1 ? { x: W + 70, y: rnd(.6, 1) * H } : { x: cxk, y: -40 };
      const wp = [st]; for (let i = 0; i < 3; i++) wp.push({ x: cxk + rnd(-.7, .7) * bw, y: rnd(.55, 1.05) * H }); wp.push({ x: cxk + rnd(-.4, .4) * bw, y: rnd(.7, 1) * H });
      return { wp, x: st.x, by: st.y + Hf * .5, ph: rnd(0, 6), t0: k * .18, fade: 1, alive: true };
    });
    const cr = (a, b, c2, d, f) => .5 * ((2 * b) + (-a + c2) * f + (2 * a - 5 * b + 4 * c2 - d) * f * f + (-a + 3 * b - 3 * c2 + d) * f * f * f);
    const axis = (T, h, t) => T.x + Math.sin(t * 3 + h * 4 + T.ph) * 9 * h * sc;
    const rf = h => (7 + 46 * h) * sc;
    items.forEach(L => { L.st = 0; L.dur = rnd(1.3, 2); L.fling = Math.random() < .3; L.spin = rnd(-9, 9); L.k = rnd(.5, 1.05); });
    let all = false, tEnd = 0;
    function capture(L, T, ti, t, dur) { const h = clamp((T.by - L.y) / Hf, 0, 1), dx = L.x - axis(T, h, t); L.st = 1; L.tor = ti; L.h0 = h; L.r0 = Math.abs(dx); L.a0 = dx >= 0 ? 0 : Math.PI; L.t0 = t; if (dur) L.dur = dur; L.fly = 0; }
    return {
      hide: true,
      step(dt, r, g) {
        const t = this.t, ox = r.left, oy = r.top; let left = 0;
        tors.forEach(T => {
          const age = t - T.t0; if (age < 0) return;
          const u = clamp(age / 3.0, 0, 1) * (T.wp.length - 1), k = Math.min(T.wp.length - 2, Math.floor(u)), f = u - k, w = T.wp, a = w[Math.max(0, k - 1)], b = w[k], c2 = w[k + 1], d = w[Math.min(w.length - 1, k + 2)];
          T.x = cr(a.x, b.x, c2.x, d.x, f); T.by = cr(a.y, b.y, c2.y, d.y, f) + Hf * .08; T.grow = Math.min(1, age / .5);
          if (all && T.alive && t > tEnd + .1) T.alive = false; if (!T.alive) T.fade = Math.max(0, T.fade - dt / .45);
        });
        for (const L of items) {
          if (L.st === 3) continue; left++;
          let X2, Y2, rot = 0, s = 1, al = 1;
          if (L.st === 0) {
            X2 = L.x; Y2 = L.y;
            for (let i = 0; i < tors.length; i++) { const T = tors[i]; if (T.t0 > t - .3 || !T.alive) continue; const h = (T.by - L.y) / Hf; if (h < -.05 || h > 1.05) continue; if (Math.abs(L.x - axis(T, clamp(h, 0, 1), t)) < (16 + 38 * clamp(h, 0, 1)) * sc) { capture(L, T, i, t); break; } }
            if (L.st === 0 && t > 2.4) { let bi = 0, bd = 1e9; tors.forEach((T, i) => { if (!T.alive || T.t0 > t) return; const dd = Math.abs(L.x - T.x) + Math.abs(L.y - T.by + Hf / 2) * .4; if (dd < bd) { bd = dd; bi = i; } }); capture(L, tors[bi], bi, t, rnd(.7, 1.1)); }
          }
          if (L.st === 1) {
            const T = tors[L.tor], age = t - L.t0, u = clamp(age / L.dur, 0, 1), h = L.h0 + (1.08 - L.h0) * Math.pow(u, 1.25);
            const rr = lerp(L.r0, rf(h) * L.k, clamp(age / .45, 0, 1)), a = L.a0 + 7 * age + 5 * age * age;
            X2 = axis(T, h, t) + Math.cos(a) * rr; Y2 = T.by - h * Hf + Math.sin(a) * rr * .3; rot = L.spin * age; s = 1 - .8 * clamp((h - .1) / .9, 0, 1); al = 1 - clamp((h - .72) / .36, 0, 1);
            if (L.fling && h > .62) { const sp = (rr + 40) * 8; flyL(L, { x: X2, y: Y2, vx: -Math.sin(a) * sp * .8, vy: Math.cos(a) * sp * .3 - 90, vr: L.spin, g: 360, life: .95, rot }); L.st = 2; L.fling = false; }
            else if (u >= 1) L.st = 3;
          } else if (L.st === 2) {
            if (stepFly(L, dt)) { L.st = 3; continue; }
            X2 = L.x; Y2 = L.y; rot = L.rot; s = .7; al = 1 - L.age / L.life;
            for (let i = 0; i < tors.length; i++) { const T = tors[i]; if (!T.alive || T.t0 > t - .3 || i === L.tor) continue; const h = (T.by - Y2) / Hf; if (h < 0 || h > 1) continue; if (Math.abs(X2 - axis(T, h, t)) < (40 + 40 * h) * sc) { capture(L, T, i, t, rnd(.8, 1.3)); L.x = X2; L.y = Y2; break; } }
          }
          if (L.st !== 3) put(g, L, ox + (L.st === 0 ? L.x : X2), oy + (L.st === 0 ? L.y : Y2), rot, s, s, al);
        }
        if (!all && left === 0) { all = true; tEnd = Math.max(t, 2.9); }
        tors.forEach(T => {   // three helical arms of sparkles, wide at the top, narrow at the bottom
          const age = t - T.t0; if (age < 0 || T.fade <= 0) return; const gA = (T.grow || 0) * T.fade;
          for (let arm = 0; arm < 3; arm++) {
            const col = arm === 0 ? AMBER : arm === 1 ? GOLD : VIOLET;
            for (let j = 0; j < 28; j++) {
              const h = (j + .5) / 28, ang = arm * 2.094 + h * 7 + t * 9, rad = rf(h) * (.9 + .1 * Math.sin(t * 5 + j));
              const x = ox + axis(T, h, t) + Math.cos(ang) * rad, y = oy + T.by - h * Hf + Math.sin(ang) * rad * .3;
              const a = gA * (.5 + .5 * Math.sin(ang)) * (.55 + .45 * Math.sin(t * 7 + j * 1.7)); if (j % 5 === 0) star(g, x, y, (1 + .7 * h) * (T.grow || 0) * 1.3, a, col, 0); else dot(g, x, y, (.8 + .8 * h) * (T.grow || 0), a, col);
            }
          }
          for (let j = 0; j < 18; j++) { const h = Math.random(), ang = rnd(0, 6.283), rad = rf(h) * rnd(1, 1.7); dot(g, ox + axis(T, h, t) + Math.cos(ang) * rad, oy + T.by - h * Hf + Math.sin(ang) * rad * .3, rnd(.7, 1.3), gA * .7, Math.random() < .5 ? AMBER : GOLD); }
        });
        return all && tors.every(T => T.fade <= 0) || t > 6;
      }
    };
  }

  // ---------------------------------------------------------------- black hole, a drain at the center of the screen
  function fxHole(X) {
    const items = X.items, W = X.W, H = X.H, CX = W / 2, CY = H / 2, Rmax = clamp(Math.min(W, H) * .1, 26, 62); let rmax = 1;
    items.forEach(L => { L.dx = L.x - CX; L.dy = L.y - CY; L.r0 = Math.hypot(L.dx, L.dy); L.th0 = Math.atan2(L.dy, L.dx); rmax = Math.max(rmax, L.r0); L.dir = 1; L.st = 0; });
    let tLast = 0; items.forEach(L => { L.ts = .4 + (L.r0 / rmax) * 1.1 + rnd(0, .15); L.dur = rnd(1.15, 1.45); tLast = Math.max(tLast, L.ts + L.dur); });
    const tClose = tLast + .1;
    return {
      hide: true,
      step(dt, r, g) {
        const t = this.t, X2 = r.left + CX, Y2 = r.top + CY, grow = eOut(clamp(t / .6, 0, 1)), shrink = 1 - eIn(clamp((t - tClose) / .5, 0, 1)), R = Rmax * grow * shrink;
        if (R > 1) {
          g.save(); const ga = Math.min(1, R / Rmax), SR = R * 4.5;
          const hg = g.createRadialGradient(X2, Y2, R * .6, X2, Y2, SR); hg.addColorStop(0, `rgba(15,20,45,${.3 * ga})`); hg.addColorStop(1, 'rgba(15,20,45,0)'); g.fillStyle = hg; g.beginPath(); g.arc(X2, Y2, SR, 0, 6.283); g.fill();
          g.lineCap = 'round';
          for (let k = 0; k < 6; k++) {
            g.beginPath(); for (let i = 0; i <= 22; i++) { const q = i / 22, rr = R * (1.05 + q * 3.6), th = k * 1.047 + t * 2.6 + q * 2.1; const px = X2 + Math.cos(th) * rr, py = Y2 + Math.sin(th) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); }
            g.strokeStyle = `rgba(20,25,60,${.08 * ga})`; g.lineWidth = 4; g.stroke(); g.strokeStyle = `rgba(20,25,60,${.14 * ga})`; g.lineWidth = 1.2; g.stroke();
          }
          g.restore();
        }
        let left = 0;
        for (const L of items) {
          if (L.st === 3) continue; left++;
          const age = t - L.ts; if (age < 0) { put(g, L, r.left + L.x, r.top + L.y, 0, 1, 1, 1); continue; }
          const u = clamp(age / L.dur, 0, 1); if (u >= 1) { L.st = 3; continue; }
          const rr = L.r0 * Math.pow(1 - u, 1.45), th = L.th0 + L.dir * (2.2 * u + 7 * u * u * u), e = clamp(u * 2, 0, 1), s = Math.pow(1 - u, .7);
          put(g, L, X2 + Math.cos(th) * rr, Y2 + Math.sin(th) * rr, (th + Math.PI) * e * .9, (1 + 2.6 * e * u) * s, Math.max(.12, 1 - .75 * e * u) * s, 1 - clamp((u - .8) / .2, 0, 1));
        }
        if (R > 1) { const dg = g.createRadialGradient(X2, Y2, 0, X2, Y2, R * 1.18); dg.addColorStop(0, '#000'); dg.addColorStop(.82, '#000'); dg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = dg; g.beginPath(); g.arc(X2, Y2, R * 1.18, 0, 6.283); g.fill(); }
        return t > tClose + .5;
      }
    };
  }

  // ---------------------------------------------------------------- earthquake
  function fxQuake(X) {
    const items = X.items, H = X.H, puffs = [];
    items.forEach(L => { L.brk = .6 + 1.9 * Math.pow(Math.random(), .9); L.j = rnd(.5, 1.3); L.st = 0; L.bounced = false; });
    return {
      hide: true,
      step(dt, r, g) {
        const t = this.t, A = Math.min(1, t / 2.0) * 8, gx = (Math.sin(t * 61) + Math.sin(t * 37)) * A * .35, gy = Math.sin(t * 47) * A * .25; let left = 0;
        for (const L of items) {
          if (L.st === 2) continue; left++;
          if (L.st === 0 && t >= L.brk) { flyL(L, { vx: rnd(-70, 70), vy: rnd(-60, 10), vr: rnd(-5, 5), g: 2100, life: 9 }); L.st = 1; L.rot = 0; L.x = L.x + gx; }
          if (L.st === 0) { put(g, L, r.left + L.x + gx + (Math.random() - .5) * 2 * A * L.j, r.top + L.y + gy + (Math.random() - .5) * 2 * A * L.j * .8, 0, 1, 1, 1); continue; }
          stepFly(L, dt);
          if (!L.bounced && L.y > H - 6 && L.vy > 0) { L.bounced = true; L.vy = -L.vy * .42; L.vx *= 1.4; L.y = H - 6; if (puffs.length < 60 && Math.random() < .5) puffs.push({ x: L.x, y: H - 2, vx: rnd(-30, 30), vy: -rnd(8, 28), age: 0, life: rnd(.4, .7), rr: rnd(3, 6) }); }
          const fall = clamp((L.y - H) / 200, 0, 1); if (fall >= 1) { L.st = 2; continue; }
          put(g, L, r.left + L.x, r.top + L.y, L.rot, 1, 1, 1 - fall * .9);
        }
        for (let i = puffs.length - 1; i >= 0; i--) { const p = puffs[i]; p.age += dt; if (p.age >= p.life) { puffs.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; const u = p.age / p.life; g.fillStyle = `rgba(120,105,95,${.32 * (1 - u)})`; g.beginPath(); g.arc(r.left + p.x, r.top + p.y, p.rr * (1 + u * 1.6), 0, 6.283); g.fill(); }
        return left === 0 && !puffs.length || t > 7;
      }
    };
  }

  // ---------------------------------------------------------------- lightning across the screen
  function fxLightning(X) {
    const items = X.items, W = X.W, H = X.H, nS = X.coarse || W < 700 ? 3 : 4;
    const strikes = Array.from({ length: nS }, (_, i) => ({ x: W * (i + rnd(.25, .75)) / nS, y: H * rnd(.35, .8), ts: .45 + i * .45, bolt: null, branches: [] }));
    strikes.forEach(s => { s.bolt = bolt(s.x + rnd(-50, 50), -120, s.x, s.y, 34); for (let k = 0; k < 2; k++) { const b = s.bolt[3 + k * 3]; s.branches.push(bolt(b[0], b[1], b[0] + rnd(-90, 90), b[1] + rnd(50, 110), 14)); } });
    items.forEach(L => { let bi = 0, bd = 1e9; strikes.forEach((s, i) => { const d = Math.hypot(L.x - s.x, L.y - s.y); if (d < bd) { bd = d; bi = i; } }); L.s = bi; L.d = bd; L.tb = strikes[bi].ts + bd * .0009; L.st = 0; });
    const tEnd = strikes[nS - 1].ts + 1.6;
    return {
      hide: true, strikes,
      step(dt, r, g) {
        const t = this.t, ox = r.left, oy = r.top; let left = 0;
        for (const L of items) {
          if (L.st === 2) continue; left++;
          if (L.st === 0 && t >= L.tb) { const s = strikes[L.s], dx = L.x - s.x, dy = L.y - s.y, d = Math.hypot(dx, dy) || 1, sp = rnd(260, 520) / (1 + d / 170) + 110; flyL(L, { vx: dx / d * sp + rnd(-40, 40), vy: dy / d * sp - rnd(40, 160), vr: rnd(-12, 12), g: 520, life: rnd(.7, 1.1) }); L.st = 1; }
          if (L.st === 0) put(g, L, ox + L.x, oy + L.y, 0, 1, 1, 1);
          else { if (stepFly(L, dt)) { L.st = 2; continue; } put(g, L, ox + L.x, oy + L.y, L.rot, 1 - L.age / L.life * .5, 1 - L.age / L.life * .5, 1 - L.age / L.life); }
        }
        const dark = Math.min(1, t / .5) * (1 - clamp((t - (tEnd - .6)) / .6, 0, 1)); let flash = 0;
        strikes.forEach(s => { const a = t - s.ts; if (a >= 0 && a < .3) flash = Math.max(flash, (1 - a / .3) * (a < .12 ? 1 : .6 + Math.random() * .4)); });
        g.fillStyle = `rgba(8,14,40,${.42 * dark})`; g.fillRect(ox, oy, X.W, X.H);
        if (flash > 0) { g.fillStyle = `rgba(255,255,255,${.5 * flash})`; g.fillRect(ox, oy, X.W, X.H); }
        strikes.forEach(s => {
          const a = t - s.ts; if (a < 0 || a > .42) return; const al = a < .18 ? 1 : (Math.random() < .55 ? .8 : .3) * (1 - (a - .18) / .24);
          g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
          const draw = pts => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(ox + p[0], oy + p[1]) : g.moveTo(ox + p[0], oy + p[1])); g.stroke(); };
          [[11, `rgba(90,120,255,${.3 * al})`], [5, `rgba(110,140,255,${.8 * al})`], [2, `rgba(255,255,255,${al})`]].forEach(([w, col]) => { g.lineWidth = w; g.strokeStyle = col; draw(s.bolt); g.lineWidth = w * .6; s.branches.forEach(b => draw(b)); });
          glow(g, ox + s.x, oy + s.y, 70, al, [150, 180, 255]); g.restore();
        });
        return (left === 0 && t > tEnd) || t > 6;
      },
      overlay(g, r, m) { strikes.forEach(s => { const gr = g.createRadialGradient(r.left + s.x, r.top + s.y, 0, r.left + s.x, r.top + s.y, 70); gr.addColorStop(0, `rgba(30,25,40,${.2 * m})`); gr.addColorStop(1, 'rgba(30,25,40,0)'); g.fillStyle = gr; g.beginPath(); g.arc(r.left + s.x, r.top + s.y, 70, 0, 6.283); g.fill(); }); }
    };
  }

  // ---------------------------------------------------------------- fire: comets hit, ragged flames spread over every line, letters burn and stay charred
  const CHAR = [34, 28, 24], ORG = [255, 140, 30];
  function emberSmoke(parts, X, dt) { if (Math.random() < dt * 7) { const w = X.words[(Math.random() * X.words.length) | 0]; if (w) { if (Math.random() < .6) emberAt(parts, w.x + rnd(-w.r / 4 + w.l / 4, w.r / 4 - w.l / 4), w.y, 1); else smokeAt(parts, w.x, w.y, 1); } } }
  function fxFire(X) {
    const fs = X.coarse ? .75 : 1, W = X.W, H = X.H, items = X.items, words = X.words, n = W < 600 ? 4 : 7, ys = shuffle(Array.from({ length: n }, (_, i) => i)), maxP = X.coarse ? 320 : 520, rate = X.coarse ? 240 : 380;
    const comets = Array.from({ length: n }, (_, i) => { const tx = W * (i + rnd(.1, .9)) / n, ty = H * (.15 + .7 * (ys[i] + rnd(.1, .9)) / n), delay = i * .1, dur = rnd(.5, .65); return { tx, ty, sx: i % 2 ? W + 30 : -30, sy: -60, delay, dur, hitT: delay + dur, hit: false }; });
    const arrive = (x, y) => { let b = 1e9; comets.forEach(m => { const d = clamp(Math.hypot((x - m.tx) / (W * .36), (y - m.ty) / (H * .5)), 0, 1); b = Math.min(b, m.hitT + 1.4 * Math.pow(d, .8)); }); return b + rnd(0, .22); };
    items.forEach(L => { L.bt = arrive(L.x, L.y); }); words.forEach(w => { w.bt = arrive(w.x, w.y); });
    const wsorted = words.slice().sort((a, b) => a.bt - b.bt), maxBT = wsorted.length ? wsorted[wsorted.length - 1].bt : 1.5, parts = []; let act = [], ip = 0;
    return {
      hide: true,
      step(dt, r, g) {
        const t = this.t, ox = r.left, oy = r.top;
        for (const L of items) {
          if (t < L.bt) { put(g, L, ox + L.x, oy + L.y, 0, 1, 1, 1); continue; }
          const u = clamp((t - L.bt) / .55, 0, 1), col = u < .3 ? mixc(L.fo.rgb, ORG, u / .3) : mixc(ORG, CHAR, (u - .3) / .7), j = u < 1 ? (1 - u) * 1.1 : 0;
          put(g, L, ox + L.x + rnd(-j, j), oy + L.y + rnd(-j, j), 0, 1, 1, lerp(1, .92, u), col);
        }
        comets.forEach(m => {
          const u = (t - m.delay) / m.dur; if (u < 0) return;
          const hx = ox + m.tx, hy = oy + m.ty;
          if (u < 1) {
            const e = eIn(clamp(u, 0, 1)) * .75 + u * .25, x = ox + m.sx + (m.tx - m.sx) * e, y = oy + m.sy + (m.ty - m.sy) * e;
            const dx = x - ox - m.sx, dy = y - oy - m.sy, L = Math.hypot(dx, dy) || 1, tl = Math.min(190, L);
            const gr = g.createLinearGradient(x, y, x - dx / L * tl, y - dy / L * tl); gr.addColorStop(0, 'rgba(255,230,160,.95)'); gr.addColorStop(.4, 'rgba(255,150,50,.55)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
            g.strokeStyle = gr; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x - dx / L * tl, y - dy / L * tl); g.stroke();
            glow(g, x, y, 22, 1, [255, 190, 70]); glow(g, x, y, 10, 1, [255, 245, 220]);
          } else if (!m.hit) { m.hit = true; emberAt(parts, m.tx, m.ty, 10); for (let q = 0; q < 6; q++) flameAt(parts, m.tx + rnd(-16, 16), m.ty + rnd(-4, 8), rnd(22, 36) * fs); }
        });
        while (ip < wsorted.length && wsorted[ip].bt <= t) act.push(wsorted[ip++]);
        act = act.filter(w => t < w.bt + .95);
        if (act.length && parts.length < maxP) { const cnt = Math.round(dt * rate + Math.random()); for (let k = 0; k < cnt; k++) { const w = act[(Math.random() * act.length) | 0]; const px = w.l + Math.random() * (w.r - w.l), py = w.y + rnd(2, 9); flameAt(parts, px, py, rnd(14, 30) * fs); if (Math.random() < .05) emberAt(parts, px, py, 1); if (Math.random() < .03) smokeAt(parts, px, py - 10, 1); } }
        stepParts(g, parts, dt, ox, oy);
        return t > maxBT + .6 && !parts.length && comets.every(m => m.hit) || t > 7;
      },
      look: L => ({ x: L.x0, y: L.y0, rot: 0, a: .92, col: CHAR }),
      hp: [], overlay(g, r, m, dt) { emberSmoke(this.hp, X, dt || .016); stepParts(g, this.hp, dt || .016, r.left, r.top); }
    };
  }

  // ---------------------------------------------------------------- meteor shower over the whole screen, each impact a burst of flame
  function fxMeteor(X, o) {
    o = o || {}; const items = X.items, D = [-.5, .866], TR = .34, RAD = 24, maxP = X.coarse ? 320 : 500;
    items.forEach(L => { L.st = 0; L.imp = -1; });
    const order = shuffle(items.slice()), imps = [];
    order.forEach(L => { if (L.imp >= 0) return; const k = imps.length; imps.push({ x: L.x, y: L.y }); items.forEach(M => { if (M.imp < 0 && Math.hypot(M.x - L.x, M.y - L.y) < RAD) M.imp = k; }); });
    const gap = Math.min(.09, 2.2 / Math.max(1, imps.length)); imps.forEach((p, k) => { p.t = .35 + k * gap; p.did = false; });
    const parts = [], tEnd = (imps.length ? imps[imps.length - 1].t : 0) + 1.2;
    return {
      hide: true,
      step(dt, r, g) {
        const t = this.t, ox = r.left, oy = r.top; let left = 0;
        imps.forEach((p, k) => {
          if (!p.did && t >= p.t) {
            p.did = true;
            for (let q = 0; q < 9 && parts.length < maxP; q++) flameAt(parts, p.x + rnd(-RAD * .7, RAD * .7), p.y + rnd(-4, 8), rnd(11, 22), { v0: 40, v1: 110, l0: .4, l1: .6 });
            emberAt(parts, p.x, p.y, 5); smokeAt(parts, p.x, p.y - 4, 2);
            items.forEach(L => { if (L.imp === k) { flyL(L, { vx: D[0] * rnd(170, 330) + rnd(-50, 50), vy: D[1] * rnd(60, 200) - rnd(40, 120), vr: rnd(-10, 10), g: 800, life: rnd(.6, .95) }); L.st = 1; } });
          }
          const u = (t - (p.t - TR)) / TR; if (u > 0 && u < 1) {
            const hx = ox + p.x - D[0] * 330 * (1 - u), hy = oy + p.y - D[1] * 330 * (1 - u), tl = 120;
            const gr = g.createLinearGradient(hx, hy, hx - D[0] * tl, hy - D[1] * tl); gr.addColorStop(0, 'rgba(255,235,170,.95)'); gr.addColorStop(.4, 'rgba(255,150,40,.55)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
            g.strokeStyle = gr; g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx - D[0] * tl, hy - D[1] * tl); g.stroke(); glow(g, hx, hy, 13, 1, [255, 190, 70]); glow(g, hx, hy, 6, 1, [255, 245, 220]);
          }
        });
        for (const L of items) {
          if (L.st === 2) continue; left++;
          if (L.st === 0) put(g, L, ox + L.x, oy + L.y, 0, 1, 1, 1);
          else {
            if (stepFly(L, dt)) { L.st = 2; continue; }
            const u = L.age / L.life; if (Math.random() < .3 && parts.length < maxP) flameAt(parts, L.x + rnd(-3, 3), L.y + 2, rnd(6, 11), { v0: 20, v1: 60, l0: .25, l1: .45 });
            put(g, L, ox + L.x, oy + L.y, L.rot, 1, 1, 1 - u * u, u < .35 ? mixc(L.fo.rgb, ORG, u / .35) : mixc(ORG, CHAR, clamp((u - .35) / .4, 0, 1)));
          }
        }
        stepParts(g, parts, dt, ox, oy);
        return (left === 0 && !parts.length && t > tEnd) || t > 7;
      }
    };
  }

  // ---------------------------------------------------------------- Burn it all: heavy meteors, fire everywhere, letters char and crumble to ash
  function fxBurn(X) {
    const fs = X.coarse ? .75 : 1, W = X.W, H = X.H, items = X.items, words = X.words, maxP = X.coarse ? 320 : 520, rate = X.coarse ? 170 : 400, ashMax = X.coarse ? 260 : 800;
    const nI = clamp(Math.round(items.length / 6), 16, X.coarse ? 36 : 56), imps = [];
    for (let i = 0; i < nI; i++) imps.push({ x: rnd(.03, .97) * W, y: rnd(.05, .95) * H, t: .15 + (i / nI) * 1.25 + rnd(0, .05), did: false, big: rnd(1, 1.7) });
    const arrive = (x, y) => { let b = 1e9; imps.forEach(p => { b = Math.min(b, p.t + Math.hypot(x - p.x, y - p.y) / 1100); }); return b + rnd(0, .18); };
    items.forEach(L => { L.bt = arrive(L.x, L.y); L.cr = L.bt + .35 + rnd(0, .5); L.ash = false; L.st = 0; L.jx = rnd(0, 6); });
    words.forEach(w => { w.bt = arrive(w.x, w.y); });
    const wsorted = words.slice().sort((a, b) => a.bt - b.bt), parts = [], ash = []; let act = [], ip = 0, tLast = 0;
    items.forEach(L => { tLast = Math.max(tLast, L.cr + .8); });
    const D = [-.45, .89];
    return {
      hide: true, imps,
      step(dt, r, g) {
        const t = this.t, ox = r.left, oy = r.top;
        // a brief orange glow over the whole screen
        const ga = Math.sin(Math.PI * clamp((t - .6) / 2.8, 0, 1));
        if (ga > 0) {   // cheap: a small gradient painted once and stretched over the screen
          if (!this.gc) { const c = this.gc = document.createElement('canvas'); c.width = Math.ceil(W / 8); c.height = Math.ceil(H / 8); const q = c.getContext('2d'), gr = q.createRadialGradient(c.width / 2, c.height * .6, 0, c.width / 2, c.height * .6, Math.max(c.width, c.height) * .8); gr.addColorStop(0, 'rgba(255,120,30,.22)'); gr.addColorStop(1, 'rgba(255,90,20,.09)'); q.fillStyle = gr; q.fillRect(0, 0, c.width, c.height); }
          g.globalAlpha = ga; g.drawImage(this.gc, ox, oy, W, H); g.globalAlpha = 1;
        }
        for (const L of items) {
          if (L.st === 2) continue;
          if (t < L.bt) { put(g, L, ox + L.x, oy + L.y, 0, 1, 1, 1); continue; }
          if (t < L.cr) { const u = clamp((t - L.bt) / (L.cr - L.bt), 0, 1), col = u < .35 ? mixc(L.fo.rgb, ORG, u / .35) : mixc(ORG, CHAR, (u - .35) / .65), j = (1 - u) * 1.3; put(g, L, ox + L.x + rnd(-j, j), oy + L.y + rnd(-j, j), 0, 1, 1, 1, col); continue; }
          const age = t - L.cr; if (!L.ash) { L.ash = true; for (let k = 0; k < 2 && ash.length < ashMax; k++) ash.push({ x: L.x + rnd(-4, 4), y: L.y + rnd(-3, 3), vx: rnd(-14, 14), vy: rnd(10, 40), life: rnd(.6, 1.1), age: 0, s: rnd(1, 2.2) }); }
          if (age > .8) { L.st = 2; continue; }
          const u = age / .8; put(g, L, ox + L.x + Math.sin(age * 12 + L.jx) * 2, oy + L.y + age * age * 120 + age * 14, rnd(-.1, .1), 1 - .5 * u, 1 - .5 * u, 1 - u, mixc(CHAR, [140, 132, 125], u));
        }
        for (let i = ash.length - 1; i >= 0; i--) { const p = ash[i]; p.age += dt; if (p.age >= p.life) { ash.splice(i, 1); continue; } p.x += p.vx * dt; p.vy += 120 * dt; p.y += p.vy * dt; const u = p.age / p.life; g.fillStyle = `rgba(95,88,82,${.75 * (1 - u)})`; g.fillRect(ox + p.x, oy + p.y, p.s, p.s); }
        imps.forEach(p => {
          if (!p.did && t >= p.t) { p.did = true; for (let q = 0; q < 14 && parts.length < maxP; q++) flameAt(parts, p.x + rnd(-24, 24) * p.big, p.y + rnd(-4, 10), rnd(16, 32) * p.big * fs, { v0: 50, v1: 130, l0: .45, l1: .8 }); emberAt(parts, p.x, p.y, 8); smokeAt(parts, p.x, p.y - 4, 3, 1.6 * p.big); }
          const u = (t - (p.t - .3)) / .3; if (u > 0 && u < 1) {
            const hx = ox + p.x - D[0] * 340 * (1 - u), hy = oy + p.y - D[1] * 340 * (1 - u), tl = 150;
            const gr = g.createLinearGradient(hx, hy, hx - D[0] * tl, hy - D[1] * tl); gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(.4, 'rgba(255,150,40,.6)'); gr.addColorStop(1, 'rgba(255,110,30,0)');
            g.strokeStyle = gr; g.lineWidth = 5 * p.big; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx - D[0] * tl, hy - D[1] * tl); g.stroke(); glow(g, hx, hy, 18 * p.big, 1, [255, 190, 70]); glow(g, hx, hy, 8, 1, [255, 245, 220]);
          }
        });
        while (ip < wsorted.length && wsorted[ip].bt <= t) act.push(wsorted[ip++]);
        act = act.filter(w => t < w.bt + .8);
        if (act.length && parts.length < maxP) { const cnt = Math.round(dt * rate + Math.random()); for (let k = 0; k < cnt; k++) { const w = act[(Math.random() * act.length) | 0], px = w.l + Math.random() * (w.r - w.l), py = w.y + rnd(2, 9); flameAt(parts, px, py, rnd(15, 32) * fs); if (Math.random() < .06) emberAt(parts, px, py, 1); if (Math.random() < .05) smokeAt(parts, px, py - 10, 1, 1.5); } }
        stepParts(g, parts, dt, ox, oy);
        return t > tLast + .1 && !parts.length && !ash.length || t > 8;
      },
      look: () => null,
      hp: [], overlay(g, r, m, dt) {   // scorched: dark smudges where the meteors fell, a thin gray haze, a few embers and wisps of smoke
        g.fillStyle = `rgba(60,48,40,${.05 * m})`; g.fillRect(r.left, r.top, W, H);
        imps.forEach(p => { const gr = g.createRadialGradient(r.left + p.x, r.top + p.y, 0, r.left + p.x, r.top + p.y, 46 * p.big); gr.addColorStop(0, `rgba(40,30,25,${.24 * m})`); gr.addColorStop(1, 'rgba(40,30,25,0)'); g.fillStyle = gr; g.beginPath(); g.arc(r.left + p.x, r.top + p.y, 46 * p.big, 0, 6.283); g.fill(); });
        emberSmoke(this.hp, X, dt || .016); stepParts(g, this.hp, dt || .016, r.left, r.top);
      }
    };
  }

  // ---------------------------------------------------------------- Sad: rain from gray clouds, letters run down like ink and wash off the bottom
  function fxSad(X) {
    const items = X.items, W = X.W, H = X.H, SAD = [92, 112, 150];
    items.forEach(L => { L.t0 = .4 + rnd(0, 1.5) + (L.y / H) * .35; L.st = 0; });
    const drops = Array.from({ length: Math.round(clamp(W / 6, 40, X.coarse ? 120 : 220)) }, () => ({ x: rnd(0, W), y: rnd(-H * .3, H), v: rnd(380, 560), len: rnd(8, 16) })), clouds = Array.from({ length: Math.ceil(W / 120) + 1 }, (_, i) => ({ x: i * 120 + rnd(-20, 20), r: rnd(42, 64), ph: rnd(0, 6) }));
    return {
      hide: true,
      step(dt, r, g) {
        const t = this.t, ox = r.left, oy = r.top, ci = clamp(t / .7, 0, 1); let left = 0;
        g.fillStyle = `rgba(110,130,165,${clamp((t - .3) / 2.2, 0, 1) * .13})`; g.fillRect(ox, oy, W, H);
        for (const L of items) {
          if (L.st === 1) continue; left++;
          let dy = 0, a = 1, sy = 1;
          if (t > L.t0) { const age = t - L.t0; dy = age * age * 480 + age * 30; sy = 1 + Math.min(1.4, dy / 50); a = 1 - clamp((L.y + dy - (H - 8)) / 40, 0, 1);
            if (L.y + dy > H + 30) { L.st = 1; continue; }
            g.strokeStyle = `rgba(92,112,150,${.38 * a})`; g.lineWidth = 1.3; g.beginPath(); g.moveTo(ox + L.x, oy + L.y + 2); g.lineTo(ox + L.x, oy + L.y + dy * .9); g.stroke(); }
          put(g, L, ox + L.x, oy + L.y + dy, 0, 1, sy, a, mixc(L.fo.rgb, SAD, ci));
        }
        if (t < 2.5) { g.strokeStyle = 'rgba(90,120,175,.55)'; g.lineWidth = 1.2; g.beginPath(); drops.forEach(d => { d.y += d.v * dt; if (d.y > H) d.y = rnd(-30, 0); g.moveTo(ox + d.x, oy + d.y); g.lineTo(ox + d.x - 1.5, oy + d.y - d.len); }); g.stroke(); }
        const ca = Math.min(clamp(t / .3, 0, 1), 1 - clamp((t - 2.3) / .5, 0, 1));
        if (ca > 0) clouds.forEach(c => { const cxp = ox + c.x + Math.sin(t * .8 + c.ph) * 8; glow(g, cxp - 14, oy + 6, c.r * 1.1, ca * .9, [118, 128, 146]); glow(g, cxp + 16, oy + 2, c.r * .95, ca * .9, [118, 128, 146]); });
        return left === 0 && t > 2.6;
      },
      overlay(g, r, m) { g.fillStyle = `rgba(110,130,165,${.13 * m})`; g.fillRect(r.left, r.top, X.W, X.H); }
    };
  }

  // ---------------------------------------------------------------- Worried: it trembles, dark fog rolls in from the edges, the text sinks into it
  function fxWorried(X) {
    const items = X.items, W = X.W, H = X.H, M = Math.max(W, H);
    const blobs = Array.from({ length: 18 }, (_, i) => { const a = i / 18 * 6.283 + rnd(-.2, .2), ex = W / 2 + Math.cos(a) * W * .62, ey = H / 2 + Math.sin(a) * H * .62; return { ex, ey, rad: clamp(M * rnd(.16, .3), 60, 230), ph: rnd(0, 6) }; });
    return {
      hide: true,
      step(dt, r, g) {
        const t = this.t, ox = r.left, oy = r.top, env = clamp(t / 2.0, 0, 1), sink = eIO(env);
        for (const L of items) put(g, L, ox + L.x + rnd(-1, 1) * 1.5 * (.5 + env), oy + L.y + rnd(-1, 1) * 1.5 * (.5 + env) + 3 * sink, 0, 1, 1, 1 - .88 * sink);
        g.fillStyle = `rgba(90,95,105,${.16 * env})`; g.fillRect(ox, oy, W, H);
        const fa = env * .26 * (1 - clamp((t - 2.1) / .5, 0, 1));
        blobs.forEach(b => glow(g, ox + lerp(b.ex, W / 2, env * .7) + Math.sin(t * 1.6 + b.ph) * 8, oy + lerp(b.ey, H / 2, env * .7) + Math.cos(t * 1.3 + b.ph) * 6, b.rad, fa * 3, [55, 60, 72]));
        return t > 2.6;
      },
      look: L => ({ x: L.x0, y: L.y0 + 3, rot: 0, a: .12 }),
      overlay(g, r, m) { g.fillStyle = `rgba(90,95,105,${.16 * m})`; g.fillRect(r.left, r.top, X.W, X.H); }
    };
  }

  // ---------------------------------------------------------------- Afraid: darkness closes in from the edges, the letters shiver, then scatter to the nearest edge
  function fxAfraid(X) {
    const items = X.items, W = X.W, H = X.H;
    items.forEach(L => {
      const d = [L.x, W - L.x, L.y, H - L.y], k = d.indexOf(Math.min.apply(null, d)); L.dx = k === 0 ? -1 : k === 1 ? 1 : 0; L.dy = k === 2 ? -1 : k === 3 ? 1 : 0;
      L.dx += rnd(-.25, .25); L.dy += rnd(-.25, .25); L.t0 = 1.3 + rnd(0, .7); L.dur = rnd(.8, 1.15); L.vr = rnd(-8, 8); L.st = 0;
    });
    let vc = null;   // the darkness is painted once at low resolution and stretched, which is far cheaper than a full-screen gradient every frame
    const vig = (g, ox, oy, a) => {
      if (a <= .01) return;
      if (!vc) { vc = document.createElement('canvas'); vc.width = Math.ceil(W / 6); vc.height = Math.ceil(H / 6); const c = vc.getContext('2d'), R = Math.hypot(vc.width, vc.height) / 2, gr = c.createRadialGradient(vc.width / 2, vc.height / 2, R * .22, vc.width / 2, vc.height / 2, R * 1.02); gr.addColorStop(0, 'rgba(4,6,18,0)'); gr.addColorStop(.6, 'rgba(4,6,18,.5)'); gr.addColorStop(1, 'rgba(4,6,18,1)'); c.fillStyle = gr; c.fillRect(0, 0, vc.width, vc.height); }
      g.globalAlpha = Math.min(1, a); g.drawImage(vc, ox, oy, W, H); g.globalAlpha = 1;
    };
    return {
      hide: true,
      step(dt, r, g) {
        const t = this.t, ox = r.left, oy = r.top, env = clamp(t / 1.2, 0, 1), shake = (.4 + 2.2 * clamp(t / 1.3, 0, 1)); let left = 0;
        for (const L of items) {
          if (L.st === 1) continue; left++;
          if (t < L.t0) { put(g, L, ox + L.x + rnd(-1, 1) * shake, oy + L.y + rnd(-1, 1) * shake, rnd(-.04, .04) * shake, 1, 1, 1); continue; }
          const age = t - L.t0; if (age > L.dur) { L.st = 1; continue; }
          const s = 80 * age + 1100 * age * age, al = 1 - clamp((age - L.dur * .65) / (L.dur * .35), 0, 1);
          put(g, L, ox + L.x + L.dx * s + rnd(-1, 1) * 1.5, oy + L.y + L.dy * s + rnd(-1, 1) * 1.5, L.vr * age, 1 - .2 * age, 1 - .2 * age, al);
        }
        vig(g, ox, oy, .7 * env * (1 - .4 * clamp((t - 2.0) / 1, 0, 1)));
        return left === 0 && t > 2.7;
      },
      overlay(g, r, m) { vig(g, r.left, r.top, .42 * m); }
    };
  }

  // ---------------------------------------------------------------- Confused: letters lift, swap places and settle scrambled and tilted
  function fxConfused(X) {
    const items = X.items, W = X.W, H = X.H, order = items.slice().sort((a, b) => a.bi - b.bi || a.ln - b.ln || a.x - b.x), slots = order.map(L => ({ x: L.x, y: L.y }));
    for (let i = 0; i < order.length; i += 9) { const n = Math.min(9, order.length - i), idx = shuffle(Array.from({ length: n }, (_, k) => k)); for (let j = 0; j < n; j++) { order[i + j].sx = slots[i + idx[j]].x; order[i + j].sy = slots[i + idx[j]].y; } }
    items.forEach(L => { L.tilt = rnd(-.16, .16); L.d0 = rnd(0, .4); L.arc = rnd(14, 34) * (Math.random() < .5 ? -1 : 1); });
    const qs = Array.from({ length: X.coarse ? 8 : 14 }, (_, i) => ({ x: rnd(.05, .95) * W, y: rnd(.25, .95) * H, t0: i * .12 + .2, ph: rnd(0, 6) }));
    return {
      hide: true,
      step(dt, r, g) {
        const t = this.t;
        for (const L of items) {
          const age = t - L.d0, p = eIO(clamp((age - .2) / 1.0, 0, 1)), lift = Math.sin(Math.PI * clamp(age / 1.4, 0, 1));
          put(g, L, r.left + lerp(L.x, L.sx, p), r.top + lerp(L.y, L.sy, p) + Math.sin(Math.PI * p) * L.arc - lift * 5, L.tilt * p, 1 + .35 * lift, 1 + .35 * lift, 1);
        }
        g.font = '700 24px system-ui,sans-serif'; curFo = null; g.fillStyle = 'rgb(124,92,214)';
        qs.forEach(q => { const a = t - q.t0; if (a < 0 || a > 1.5) return; g.globalAlpha = Math.sin(Math.PI * a / 1.5) * .9; g.fillText('?', r.left + q.x + Math.sin(a * 4 + q.ph) * 8, r.top + q.y - a * 46); }); g.globalAlpha = 1;
        return t > 2.0;
      },
      look: L => ({ x: L.sx, y: L.sy, rot: L.tilt, a: 1 })
    };
  }

  // ---------------------------------------------------------------- Skeptical: a scanning line, words fade to ghosts, a few are struck through
  function fxSkeptic(X) {
    const items = X.items, W = X.W, H = X.H;
    const strikes = X.words.filter(q => q.r - q.l > 18 && Math.random() < .06).slice(0, 40).map(q => ({ l: q.l, r: q.r, y: q.y, tf: (q.y / H) * 2.2 + .1 }));
    const drawStrikes = (g, ox, oy, p, a) => { g.lineCap = 'round'; g.lineWidth = 1.5; strikes.forEach(q => { const pp = p(q); if (pp <= 0) return; g.strokeStyle = `rgba(170,60,70,${a})`; g.beginPath(); for (let x = 0; x <= (q.r - q.l) * pp; x += 3) { const px = ox + q.l + x, py = oy + q.y + 1 + Math.sin(x * .9) * 1.2; x ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }); };
    return {
      hide: true,
      step(dt, r, g) {
        const t = this.t, ox = r.left, oy = r.top, ly = -8 + (H + 16) * clamp(t / 2.2, 0, 1);
        for (const L of items) put(g, L, ox + L.x, oy + L.y, 0, 1, 1, 1 - .82 * clamp((t - ((L.y / H) * 2.2 + (L.x / W) * .12)) / .35, 0, 1));
        drawStrikes(g, ox, oy, q => clamp((t - q.tf) / .3, 0, 1), .6);
        if (t < 2.4) { const gr = g.createLinearGradient(0, oy + ly - 14, 0, oy + ly + 14); gr.addColorStop(0, 'rgba(110,120,235,0)'); gr.addColorStop(.5, 'rgba(110,120,235,.3)'); gr.addColorStop(1, 'rgba(110,120,235,0)'); g.fillStyle = gr; g.fillRect(ox, oy + ly - 14, W, 28); g.fillStyle = 'rgba(110,120,235,.9)'; g.fillRect(ox, oy + ly - .8, W, 1.6); }
        return t > 2.6;
      },
      look: L => ({ x: L.x0, y: L.y0, rot: 0, a: .18 }),
      overlay(g, r, m) { drawStrikes(g, r.left, r.top, () => 1, .6 * m); }
    };
  }

  // ---------------------------------------------------------------- Disappointed: the color drains to gray, letters sag, slide down and drop off the bottom like wilted leaves
  function fxDisappointed(X) {
    const items = X.items, H = X.H, GRAY = [138, 138, 144];
    items.forEach(L => { L.t0 = .9 + rnd(0, 1.1) + (L.y / H) * .4; L.ph = rnd(0, 6); L.tw = rnd(-.3, .3); L.st = 0; });
    return {
      hide: true,
      step(dt, r, g) {
        const t = this.t, ox = r.left, oy = r.top, dr = clamp(t / .9, 0, 1), sag = clamp(t / 1.1, 0, 1); let left = 0;
        for (const L of items) {
          if (L.st === 1) continue; left++;
          const col = mixc(L.fo.rgb, GRAY, dr);
          if (t < L.t0) { put(g, L, ox + L.x, oy + L.y + 3 * sag * eOut(sag), L.tw * sag * .6, 1, 1 - .1 * sag, 1, col); continue; }
          const age = t - L.t0, dy = age * age * 520 + age * 40 + 3; if (L.y + dy > H + 24) { L.st = 1; continue; }
          put(g, L, ox + L.x + Math.sin(age * 3.2 + L.ph) * 14 * Math.min(1, age * 2), oy + L.y + dy, L.tw * .6 + Math.sin(age * 3.2 + L.ph) * .6 * Math.min(1, age * 2), 1, .95, 1 - clamp((L.y + dy - (H - 40)) / 60, 0, 1) * .6, col);
        }
        return left === 0 && t > 2.4;
      }
    };
  }

  // ---------------------------------------------------------------- Frustrated: the text jitters and reddens, then each line snaps and its letters are flung sideways with steam
  function fxFrustrated(X) {
    const items = X.items, W = X.W, H = X.H, RED = [210, 40, 30], parts = [], lines = new Map(); let nl = 0;
    items.forEach(L => { const k = L.bi + ':' + L.ln; let q = lines.get(k); if (!q) { q = { i: nl++, y: L.y, xs: [], dir: 0 }; lines.set(k, q); } q.xs.push(L.x); L.q = q; });
    const order = Array.from(lines.values()).sort((a, b) => a.y - b.y); order.forEach((q, i) => { q.dir = i % 2 ? 1 : -1; q.ts = 1.6 + i * (Math.min(.035, 1.1 / Math.max(1, order.length))); q.sx = q.dir > 0 ? Math.min.apply(null, q.xs) : Math.max.apply(null, q.xs); q.puffed = false; });
    items.forEach(L => { L.vs = rnd(750, 1100); L.vr = rnd(-6, 6); L.dl = (L.q.dir > 0 ? L.x / W : 1 - L.x / W) * .25; L.st = 0; });
    return {
      hide: true,
      step(dt, r, g) {
        const t = this.t, ox = r.left, oy = r.top, heat = clamp(t / 1.5, 0, 1), jit = .4 + 3 * heat; let left = 0;
        for (const L of items) {
          if (L.st === 1) continue; left++; const q = L.q, tf = q.ts + L.dl, col = mixc(L.fo.rgb, RED, heat * .9);
          if (t < tf) { put(g, L, ox + L.x + rnd(-1, 1) * jit, oy + L.y + rnd(-1, 1) * jit * .8, rnd(-.03, .03) * jit, 1, 1, 1, col); continue; }
          const age = t - tf, s = L.vs * age + 900 * age * age; if (s > Math.max(W, 700) + 60) { L.st = 1; continue; }
          put(g, L, ox + L.x + q.dir * s, oy + L.y + age * age * 60, L.vr * age, 1 + .3 * Math.min(1, age * 3), 1, 1, col);
        }
        order.forEach(q => { if (!q.puffed && t >= q.ts) { q.puffed = true; if (parts.length < 120) smokeAt(parts, q.sx, q.y, 2, 1.1); } });
        stepParts(g, parts, dt, ox, oy);
        if (heat > .2 && t < 1.7 && Math.random() < dt * 22) smokeAt(parts, rnd(0, W), rnd(.1, 1) * H, 1, .8);
        return left === 0 && !parts.length && t > 2.4 || t > 6;
      }
    };
  }

  // ---------------------------------------------------------------- Mind blown: a flash, a shockwave from the center, every letter blasted outward with glowing trails
  function fxBlown(X) {
    const items = X.items, W = X.W, H = X.H, CX = W / 2, CY = H / 2, M = Math.max(W, H);
    items.forEach(L => { const dx = L.x - CX, dy = L.y - CY, d = Math.hypot(dx, dy) || 1; L.dx = dx / d; L.dy = dy / d; L.t0 = .18 + d / 1600 + rnd(0, .05); L.sp = rnd(520, 900); L.vr = rnd(-14, 14); L.st = 0; if (d < 2) { const a = rnd(0, 6.283); L.dx = Math.cos(a); L.dy = Math.sin(a); } });
    return {
      hide: true,
      step(dt, r, g) {
        const t = this.t, X2 = r.left + CX, Y2 = r.top + CY; let left = 0;
        for (const L of items) {
          if (L.st === 1) continue; left++;
          const age = t - L.t0; if (age < 0) { put(g, L, r.left + L.x + rnd(-.8, .8), r.top + L.y + rnd(-.8, .8), 0, 1, 1, 1); continue; }
          if (age > 1.5) { L.st = 1; continue; }
          const al = 1 - clamp((age - .8) / .7, 0, 1);
          for (let k = 3; k >= 0; k--) { const a2 = Math.max(0, age - k * .035), s = L.sp * a2 + 700 * a2 * a2, X3 = r.left + L.x + L.dx * s, Y3 = r.top + L.y + L.dy * s;
            if (k) { if (!X.coarse || k === 2) { glow(g, X3, Y3, 9 - k * 1.5, al * .45 / k * 2, k % 2 ? [150, 110, 255] : [255, 200, 100]); } put(g, L, X3, Y3, L.vr * a2, 1 + a2, 1 + a2, al * .22 / k); } else put(g, L, X3, Y3, L.vr * a2, 1 + age * 1.1, 1 + age * 1.1, al); }
        }
        if (t < .55) { const u = t / .55; glow(g, X2, Y2, 70 + 150 * u, (1 - u) * 1.2, [255, 225, 150]); glow(g, X2, Y2, 40 + 60 * u, 1 - u, [255, 255, 255]); }
        if (t < 1.3) { const u = t / 1.3; g.strokeStyle = `rgba(120,80,240,${.8 * (1 - u)})`; g.lineWidth = 5 * (1 - u) + 1; g.beginPath(); g.arc(X2, Y2, eOut(u) * M * 1.05, 0, 6.283); g.stroke(); g.strokeStyle = `rgba(240,160,40,${.65 * (1 - u)})`; g.lineWidth = 2.5; g.beginPath(); g.arc(X2, Y2, eOut(u) * M * .93, 0, 6.283); g.stroke(); }
        return left === 0 && t > 1.4;
      }
    };
  }

  // ---------------------------------------------------------------- positive emotions: they play over the whole screen, the text never moves, nothing persists (about 2.5 s)
  function hSparkle(X) {
    const W = X.W, H = X.H, ps = [], rate = clamp(W * H / 2600, 50, X.coarse ? 120 : 220);
    return {
      step(dt, r, g) {
        const t = this.t, env = Math.sin(Math.PI * clamp(t / 2.4, 0, 1));
        const gr = g.createLinearGradient(0, r.top + H, 0, r.top + H * .35); gr.addColorStop(0, `rgba(255,190,70,${.34 * env})`); gr.addColorStop(1, 'rgba(255,215,120,0)'); g.fillStyle = gr; g.fillRect(r.left, r.top + H * .35, W, H * .65);
        if (t < 1.5) { const cnt = Math.round(dt * rate + Math.random()); for (let k = 0; k < cnt; k++) ps.push({ x: rnd(0, W), y: rnd(H * .1, H + 10), vx: rnd(-12, 12), vy: -rnd(30, 90), life: rnd(.8, 1.3), age: 0, rr: rnd(2.2, 4.2), col: SCOL[(Math.random() * 3) | 0], tw: rnd(0, 6) }); }
        for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; p.age += dt; if (p.age >= p.life) { ps.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; const u = p.age / p.life; star(g, r.left + p.x, r.top + p.y, p.rr, Math.min(1, u * 8, (1 - u) * 1.8) * (.7 + .3 * Math.sin(p.tw + p.age * 18)), p.col, p.tw); }
        return t > 1.5 && !ps.length || t > 2.6;
      }
    };
  }
  function hFireworks(X, o) {
    o = o || {}; const W = X.W, H = X.H, n = o.n || (W < 600 ? 4 : 6), BIG = (o.big || 1) * clamp(Math.min(W, H) / 380, 1, 1.9), gap = o.gap || .32, pc = X.coarse ? 52 : 72;
    const pal = [[SG, SO], [SB, SV], [SP, SG], [ST, SGR], [SV, SP], [SO, SP]];
    const bursts = Array.from({ length: n }, (_, i) => ({ x: W * (i + rnd(.15, .85)) / n, y: rnd(.12, .55) * H, t0: i * gap + rnd(0, .1), pal: pal[i % pal.length], ps: null }));
    return {
      step(dt, r, g) {
        const t = this.t;
        bursts.forEach(b => {
          const a = t - b.t0; if (a < 0) return;
          if (!b.ps) b.ps = Array.from({ length: pc }, () => { const an = rnd(0, 6.283), sp = rnd(90, 230) * BIG; return { vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, col: b.pal[Math.random() < .55 ? 0 : 1], rr: rnd(2.6, 4.2), life: rnd(1, 1.4) }; });
          if (a < .3) { const u = a / .3; g.strokeStyle = `rgba(${b.pal[0].join(',')},${.7 * (1 - u)})`; g.lineWidth = 3 * (1 - u) + 1; g.beginPath(); g.arc(r.left + b.x, r.top + b.y, 10 + 50 * BIG * u, 0, 6.283); g.stroke(); glow(g, r.left + b.x, r.top + b.y, 70 * BIG * (1 - u), 1, b.pal[0]); }
          b.ps.forEach(p => { if (a > p.life) return; const u = a / p.life; for (let q = 0; q < 3; q++) { const aa = Math.max(0, a - q * .03), kk = Math.pow(.94, aa * 60); dot(g, r.left + b.x + p.vx * (1 - kk) / 2.6, r.top + b.y + p.vy * (1 - kk) / 2.6 + 90 * aa * aa, p.rr * (1 - q * .22), (1 - u) * (q ? .4 : 1), p.col); } });
        });
        return t > (n - 1) * gap + 1.7;
      }
    };
  }
  function hShooting(X, o) {
    o = o || {}; const W = X.W, H = X.H, n = o.n || 8;
    const st = Array.from({ length: n }, (_, i) => { const lr = i % 2 === 0; return { t0: i * .2 + (o.t0 || 0), dur: .95, p0: { x: lr ? -50 : W + 50, y: rnd(-.1, .45) * H }, p1: { x: W * rnd(.25, .75), y: -rnd(.1, .4) * H - 30 }, p2: { x: lr ? W + 50 : -50, y: rnd(.4, 1) * H }, hist: [] }; });
    const q2 = (a, b, c2, u) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c2;
    return {
      step(dt, r, g) {
        const t = this.t;
        st.forEach(s => {
          const u = (t - s.t0) / s.dur;
          if (u >= 0 && u <= 1.15) {
            const uu = clamp(u, 0, 1), x = q2(s.p0.x, s.p1.x, s.p2.x, uu), y = q2(s.p0.y, s.p1.y, s.p2.y, uu);
            if (u <= 1) { s.hist.push([x, y]); if (s.hist.length > 20) s.hist.shift(); } else s.hist.shift();
            if (s.hist.length > 1) { const h0 = s.hist[s.hist.length - 1], hN = s.hist[0]; const gr = g.createLinearGradient(r.left + h0[0], r.top + h0[1], r.left + hN[0], r.top + hN[1]); gr.addColorStop(0, 'rgba(245,150,20,1)'); gr.addColorStop(1, 'rgba(245,150,20,0)'); g.strokeStyle = gr; g.lineWidth = 3.6; g.lineCap = 'round'; g.beginPath(); s.hist.forEach((p, i) => i ? g.lineTo(r.left + p[0], r.top + p[1]) : g.moveTo(r.left + p[0], r.top + p[1])); g.stroke(); }
            if (u <= 1) star(g, r.left + x, r.top + y, 4, 1, SG, 0);
          }
        });
        return t > n * .2 + (o.t0 || 0) + 1.3;
      }
    };
  }
  function hConstellation(X) {
    const W = X.W, H = X.H, n = X.coarse || W < 600 ? 10 : 15, pts = [];
    for (let tries = 0; tries < 300 && pts.length < n; tries++) { const p = { x: rnd(.06, .94) * W, y: rnd(.08, .92) * H }; if (pts.every(q => Math.hypot(q.x - p.x, q.y - p.y) > Math.min(W, H) * .17)) pts.push(p); }
    const chain = [pts.shift()]; while (pts.length) { const a = chain[chain.length - 1]; let bi = 0, bd = 1e9; pts.forEach((p, i) => { const d = Math.hypot(p.x - a.x, p.y - a.y); if (d < bd) { bd = d; bi = i; } }); chain.push(pts.splice(bi, 1)[0]); }
    chain.forEach((s, i) => { s.t = i * .1; s.col = i % 3 === 0 ? SV : i % 3 === 1 ? SG : SB; s.tw = rnd(0, 6); });
    return {
      step(dt, r, g) {
        const t = this.t, fade = 1 - clamp((t - 1.9) / .5, 0, 1); g.lineCap = 'round';
        for (let i = 0; i + 1 < chain.length; i++) { const A = chain[i], B = chain[i + 1], u = clamp((t - B.t) / .2, 0, 1); if (u <= 0) continue; g.strokeStyle = `rgba(90,100,225,${.8 * fade})`; g.lineWidth = 1.7; g.beginPath(); g.moveTo(r.left + A.x, r.top + A.y); g.lineTo(r.left + lerp(A.x, B.x, u), r.top + lerp(A.y, B.y, u)); g.stroke(); }
        chain.forEach(s => { const u = clamp((t - s.t) / .2, 0, 1); if (u > 0) star(g, r.left + s.x, r.top + s.y, 5 * eOut(u), fade * (.8 + .2 * Math.sin(s.tw + t * 9)), s.col, 0); });
        return t > 2.4;
      }
    };
  }
  function hAurora(X) {
    const W = X.W, H = X.H, cols = [[20, 175, 140], [125, 85, 230], [235, 120, 160]];
    return {
      step(dt, r, g) {
        const t = this.t, env = Math.pow(Math.sin(Math.PI * clamp(t / 2.5, 0, 1)), .7);
        cols.forEach((col, k) => {
          const y0 = H * (.3 + .17 * k), amp = H * .07, th = H * .3, yy = x => y0 + Math.sin(x / (160 + 40 * k) + t * (1.4 + .3 * k) + k * 2) * amp + Math.sin(x / 70 - t * 2) * amp * .3;
          const gr = g.createLinearGradient(0, r.top + y0 - th, 0, r.top + y0 + amp * 1.4); gr.addColorStop(0, `rgba(${col.join(',')},0)`); gr.addColorStop(.7, `rgba(${col.join(',')},${.3 * env})`); gr.addColorStop(1, `rgba(${col.join(',')},${.12 * env})`);
          g.beginPath(); const top = [], bot = []; for (let x = 0; x <= W + 12; x += 12) { const y = yy(x); top.push([x, y - th]); bot.push([x, y + amp * .6]); }
          top.forEach((p, i) => i ? g.lineTo(r.left + p[0], r.top + p[1]) : g.moveTo(r.left + p[0], r.top + p[1])); for (let i = bot.length - 1; i >= 0; i--) g.lineTo(r.left + bot[i][0], r.top + bot[i][1]); g.closePath(); g.fillStyle = gr; g.fill();
          g.strokeStyle = `rgba(${col.join(',')},${.4 * env})`; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= W + 12; x += 12) { const y = yy(x) + amp * .6; x ? g.lineTo(r.left + x, r.top + y) : g.moveTo(r.left + x, r.top + y); } g.stroke();
        });
        return t > 2.5;
      }
    };
  }

  function tCurious(X) {
    const pool = shuffle(X.words.slice()), pts = [], W = X.W, H = X.H, sp = Math.min(W, H) * .17;
    for (const w of pool) { if (pts.length >= (X.coarse ? 9 : 13)) break; if (pts.every(p => Math.hypot(p.x - w.x, p.y - w.y) > sp)) pts.push({ x: w.x, y: w.y - 2, tw: rnd(0, 6), col: pts.length % 2 ? SG : SB }); }
    pts.forEach((p, i) => { p.t = i * .13; });
    return {
      step(dt, r, g) {
        const t = this.t, fade = 1 - clamp((t - 1.9) / .5, 0, 1); g.lineCap = 'round';
        for (let i = 0; i + 1 < pts.length; i++) { const A = pts[i], B = pts[i + 1], u = clamp((t - B.t) / .22, 0, 1); if (u <= 0) continue; g.strokeStyle = `rgba(50,100,225,${.8 * fade})`; g.lineWidth = 1.8; g.beginPath(); g.moveTo(r.left + A.x, r.top + A.y); g.lineTo(r.left + lerp(A.x, B.x, u), r.top + lerp(A.y, B.y, u)); g.stroke(); }
        pts.forEach(p => { const u = clamp((t - p.t) / .25, 0, 1); if (u > 0) { star(g, r.left + p.x, r.top + p.y, 7.5 * eOut(u), fade * (.8 + .2 * Math.sin(p.tw + t * 8)), p.col, 0); g.strokeStyle = `rgba(${p.col.join(',')},${.5 * fade * (1 - u)})`; g.lineWidth = 2; g.beginPath(); g.arc(r.left + p.x, r.top + p.y, 8 + 22 * u, 0, 6.283); g.stroke(); } });
        return t > 2.5;
      }
    };
  }
  function tAmazed(X) {
    const au = hAurora(X), W = X.W, H = X.H, st = Array.from({ length: X.coarse ? 8 : 14 }, () => ({ x: rnd(-.1, 1) * W, t0: rnd(0, 1.5), v: rnd(300, 420) }));
    return {
      step(dt, r, g) {
        au.t = this.t; au.step(dt, r, g); const t = this.t;
        st.forEach(s => { const a = t - s.t0; if (a < 0 || a > 1.2) return; const x = s.x + a * 140, y = -30 + a * s.v, al = 1 - Math.pow(a / 1.2, 3); if (y < -30 || y > H + 20) return;
          const gr = g.createLinearGradient(r.left + x, r.top + y, r.left + x - 50, r.top + y - 70); gr.addColorStop(0, `rgba(245,150,20,${al})`); gr.addColorStop(1, 'rgba(245,150,20,0)'); g.strokeStyle = gr; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(r.left + x, r.top + y); g.lineTo(r.left + x - 50, r.top + y - 70); g.stroke(); star(g, r.left + x, r.top + y, 3.6, al, SG, 0); });
        return t > 2.6;
      }
    };
  }
  function tGrateful(X) {
    const W = X.W, H = X.H, ms = Array.from({ length: X.coarse ? 22 : 34 }, () => ({ x: rnd(0, W), y: H * rnd(.5, 1.05), vy: -rnd(30, 70), t0: rnd(0, .8), ph: rnd(0, 6), lan: Math.random() < .45, sz: rnd(8, 15) }));
    return {
      step(dt, r, g) {
        const t = this.t, env = Math.sin(Math.PI * clamp(t / 2.5, 0, 1));
        const gr = g.createRadialGradient(r.left + W / 2, r.top + H, 0, r.left + W / 2, r.top + H, Math.max(W, H) * .8); gr.addColorStop(0, `rgba(255,170,60,${.4 * env})`); gr.addColorStop(1, 'rgba(255,200,110,0)'); g.fillStyle = gr; g.fillRect(r.left, r.top, W, H);
        ms.forEach(m => { const a = t - m.t0; if (a < 0) return; const x = r.left + m.x + Math.sin(a * 1.6 + m.ph) * 10, y = r.top + m.y + m.vy * a, al = Math.min(1, a * 3, (2.5 - t) * 1.6); if (al <= 0) return;
          glow(g, x, y, m.sz * 2.2, al * .9, [255, 170, 60]);
          if (m.lan) { g.globalAlpha = al; g.fillStyle = 'rgb(248,160,40)'; g.strokeStyle = 'rgba(140,70,10,.7)'; g.lineWidth = 1; rrect(g, x - 5, y - 7, 10, 14, 3); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,250,200,.95)'; g.beginPath(); g.arc(x, y, 2.4, 0, 6.283); g.fill(); g.globalAlpha = 1; } else dot(g, x, y, 2.4, al, SG); });
        return t > 2.6;
      }
    };
  }
  function tHopeful(X) {
    const W = X.W, H = X.H, ps = [], R = Math.min(W, H) * .24;
    return {
      step(dt, r, g) {
        const t = this.t, env = Math.sin(Math.PI * clamp(t / 2.5, 0, 1)), rise = eOut(clamp(t / 1.5, 0, 1)), cxs = r.left + W / 2, cys = r.top + H + R * .35 - rise * R * 1.55;
        const gr = g.createLinearGradient(0, r.top + H, 0, r.top + H * (1 - .75 * rise)); gr.addColorStop(0, `rgba(255,150,50,${.5 * env})`); gr.addColorStop(.5, `rgba(255,200,110,${.25 * env})`); gr.addColorStop(1, 'rgba(255,225,150,0)'); g.fillStyle = gr; g.fillRect(r.left, r.top, W, H);
        g.save(); g.translate(cxs, cys); g.rotate(t * .25); for (let k = 0; k < 16; k++) { g.rotate(Math.PI / 8); g.fillStyle = `rgba(255,185,60,${.16 * env})`; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.max(W, H) * 1.1, -22); g.lineTo(Math.max(W, H) * 1.1, 22); g.closePath(); g.fill(); } g.restore();
        glow(g, cxs, cys, R * 2.4, env, [255, 190, 70]); g.globalAlpha = Math.min(1, env * 1.4); g.fillStyle = 'rgb(255,182,50)'; g.beginPath(); g.arc(cxs, cys, R, 0, 6.283); g.fill(); g.fillStyle = 'rgba(255,240,170,.8)'; g.beginPath(); g.arc(cxs, cys, R * .72, 0, 6.283); g.fill(); g.globalAlpha = 1;
        if (t < 1.8) for (let k = Math.round(dt * (X.coarse ? 40 : 70) + Math.random()); k > 0; k--) ps.push({ x: rnd(0, W), y: H + 4, vy: -rnd(60, 140), age: 0, life: rnd(.9, 1.5), rr: rnd(2.2, 4), tw: rnd(0, 6), col: Math.random() < .5 ? SG : SO });
        for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; p.age += dt; if (p.age >= p.life) { ps.splice(i, 1); continue; } p.y += p.vy * dt; const u = p.age / p.life; star(g, r.left + p.x, r.top + p.y, p.rr, Math.min(1, u * 8, (1 - u) * 1.8) * (.7 + .3 * Math.sin(p.tw + p.age * 16)), p.col, p.tw); }
        return t > 2.5 && !ps.length || t > 3.2;
      }
    };
  }
  function tExcited(X) {
    const f = hFireworks(X, { n: X.coarse || X.W < 600 ? 5 : 7, big: 1.25, gap: .27 }), s = hShooting(X, { n: 2, t0: .15 });
    return { step(dt, r, g) { f.t = s.t = this.t; const a = f.step(dt, r, g), b = s.step(dt, r, g); return a && b; } };
  }
  function tInspired(X) {
    const W = X.W, H = X.H, burst = []; let bursted = false;
    return {
      step(dt, r, g) {
        const t = this.t, e = eOut(clamp(t / 1.5, 0, 1)), cx0 = r.left + W / 2, rise = H * .88, bot = r.top + H - 8, fade = 1 - clamp((t - 2) / .4, 0, 1), Rw = clamp(Math.min(W, H) * .07, 22, 42);
        for (let s = 0; s < 2; s++) for (let j = 0; j < 44; j++) { const hh = j / 44 * e, an = hh * 11 + t * 5 + s * Math.PI, x = cx0 + Math.cos(an) * Rw, y = bot - hh * rise + Math.sin(an) * Rw * .25, a = fade * (.55 + .45 * j / 44);
          if (j % 4 === 0 && s === 0 && hh > 0) { const an2 = an + Math.PI; g.strokeStyle = `rgba(120,90,220,${.45 * a})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(cx0 + Math.cos(an2) * Rw, y); g.stroke(); }
          if (j % 5 === 0) star(g, x, y, 3.6 + 2.6 * (j / 44), a, s ? SG : SV, 0); else dot(g, x, y, 2.4 + 1.8 * (j / 44), a, s ? SG : SV); }
        if (t > 1.5 && !bursted) { bursted = true; for (let k = 0; k < 36; k++) { const a = rnd(0, 6.283), sp = rnd(50, 140); burst.push({ x: cx0 - r.left, y: bot - rise - r.top, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: rnd(.7, 1.1), rr: rnd(2, 3.6), col: SCOL[(Math.random() * SCOL.length) | 0] }); } }
        for (let i = burst.length - 1; i >= 0; i--) { const p = burst[i]; p.age += dt; if (p.age >= p.life) { burst.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.vy *= .97; const u = p.age / p.life; star(g, r.left + p.x, r.top + p.y, p.rr, 1 - u, p.col, 0); }
        return t > 2.4 && !burst.length || t > 3.4;
      }
    };
  }
  function tCalm(X) {
    const W = X.W, H = X.H, ss = Array.from({ length: 14 }, () => ({ x: rnd(0, W), y: rnd(0, H), ph: rnd(0, 6), col: Math.random() < .5 ? SB : SG }));
    return {
      step(dt, r, g) {
        const t = this.t, X2 = r.left + W / 2, Y2 = r.top + H / 2, M = Math.hypot(W, H) * .5, env = 1 - clamp((t - 2.1) / .4, 0, 1);
        glow(g, X2, Y2, M * .9 * eOut(clamp(t / 1.2, 0, 1)), .5 * env, [110, 190, 230]);
        for (let k = 0; k < 5; k++) { const a = t - k * .42; if (a < 0 || a > 1.9) continue; const u = a / 1.9; g.strokeStyle = `rgba(20,140,190,${.75 * (1 - u) * env})`; g.lineWidth = 4 * (1 - u) + 1; g.beginPath(); g.arc(X2, Y2, eOut(u) * M, 0, 6.283); g.stroke(); g.strokeStyle = `rgba(110,210,200,${.35 * (1 - u) * env})`; g.lineWidth = 9 * (1 - u); g.beginPath(); g.arc(X2, Y2, eOut(u) * M * .95, 0, 6.283); g.stroke(); }
        ss.forEach(s => star(g, r.left + s.x, r.top + s.y - t * 10, 3.6, env * (.55 + .35 * Math.sin(s.ph + t * 2.2)), s.col, 0));
        return t > 2.5;
      }
    };
  }

  // ---------------------------------------------------------------- repair: sparkles come and the text returns
  function repairJob(dur) {   // the letters are still where the effect left them, so they come back in place
    const X = RX.X, eff = RX.eff, items = X.items, W = X.W, H = X.H, sp = [], maxSp = X.coarse ? 200 : 360;
    items.forEach(L => { L.rt = clamp(L.x0 / W * .5 + L.y0 / H * .5, 0, 1) * dur * .6 + rnd(0, dur * .14); L.spk = false; L.lk = (eff.look && eff.look(L)) || { x: L.x0, y: L.y0, rot: 0, a: 0 }; });
    return {
      step(dt, r, g) {
        const t = this.t, m = 1 - clamp(t / (dur * .7), 0, 1);
        if (eff.overlay && m > 0) eff.overlay(g, r, m, dt);
        const k = dur * .3;
        for (const L of items) {
          const p = eIO(clamp((t - L.rt) / k, 0, 1)), lk = L.lk;
          if (p >= 1) put(g, L, r.left + L.x0, r.top + L.y0, 0, 1, 1, 1);
          else put(g, L, r.left + lerp(lk.x, L.x0, p), r.top + lerp(lk.y, L.y0, p), lerp(lk.rot || 0, 0, p), 1, 1, lerp(lk.a, 1, p), lk.col && p < 1 ? mixc(lk.col, L.fo.rgb, p) : undefined);
          if (!L.spk && t >= L.rt) { L.spk = true; if (sp.length < maxSp && Math.random() < .5) sp.push({ x: L.x0 + rnd(-4, 4), y: L.y0 + rnd(-6, 4), vy: -rnd(14, 50), vx: rnd(-12, 12), age: 0, life: rnd(.4, .7), R: rnd(2.2, 3.8), col: SCOL[(Math.random() * SCOL.length) | 0], rot: rnd(0, 1) }); }
        }
        for (let i = sp.length - 1; i >= 0; i--) { const p = sp[i]; p.age += dt; if (p.age >= p.life) { sp.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; const u = p.age / p.life; star(g, r.left + p.x, r.top + p.y, p.R, Math.sin(u * Math.PI) * 1.1, p.col, p.rot); }
        return t > dur + .15;
      },
      end() { restoreDOM(); finish(); }
    };
  }
  function sparkJob(dur) {   // the text is already back (the page moved, or Reset hit mid-effect): sparkles sweep the screen
    const X = RX.X, W = X.W, H = X.H, n = X.coarse ? 150 : 260;
    const ps = Array.from({ length: n }, () => { const x = rnd(0, W); return { x, y: rnd(.02, 1) * H, d: (x / W * .5 + rnd(0, .5)) * dur * .6, life: rnd(.22, .36), vy: -rnd(20, 60), R: rnd(2.4, 4.2), col: SCOL[(Math.random() * SCOL.length) | 0], rot: rnd(0, 1), age: 0 }; });
    return {
      step(dt, r, g) {
        const t = this.t;
        ps.forEach(p => { if (t < p.d) return; p.age += dt; if (p.age >= p.life) return; p.y += p.vy * dt; star(g, r.left + p.x, r.top + p.y, p.R, Math.sin(p.age / p.life * Math.PI) * 1.1, p.col, p.rot); });
        return t > dur * .6 + .4;
      },
      end() { finish(); }
    };
  }
  function holdJob() {
    const X = RX.X, eff = RX.eff, items = X.items;
    return {
      step(dt, r, g) {
        if (eff.look) for (const L of items) { const lk = eff.look(L); if (lk && lk.a > .01) put(g, L, r.left + lk.x, r.top + lk.y, lk.rot || 0, 1, 1, lk.a, lk.col ? rgbs(lk.col) : undefined); }
        if (eff.overlay) eff.overlay(g, r, 1, dt);
        return false;
      }
    };
  }
  function enterHold() {
    RX.phase = 'hold'; start(holdJob()); setUI();
    RX.timer = setTimeout(() => beginRepair('auto'), BLAST[RX.name] ? 1000 : 5000);
  }
  function beginRepair(mode) {
    if (!RX) return; clearTimeout(RX.timer);
    if (RX.phase === 'repair' || RX.phase === 'spark') { if (JOB) JOB.speed = Math.min(4, (JOB.speed || 1) * 1.4 + .15); return; }
    if (rm() || document.hidden) { restoreDOM(); finish(); return; }
    if (RX.phase === 'hold' && mode !== 'scroll') { RX.phase = 'repair'; start(repairJob(mode === 'reset' ? .9 : BLAST[RX.name] ? 1.0 : 1.5)); }
    else { restoreDOM(); RX.phase = 'spark'; start(sparkJob(mode === 'scroll' ? .5 : .8)); }
    setUI();
  }
  function finish() { clearTimeout(RX && RX.timer); RX = null; JOB = null; clear(); setUI(); }
  function resetNow() {   // instant, no sparkles
    if (RX) { clearTimeout(RX.timer); restoreDOM(); }
    RX = null; JOB = null; clear(); setUI();
  }
  function resetAll() {
    if (!RX) { say('Nothing to reset.'); return; }
    if (!RX.neg) { finish(); return; }
    if (RX.phase === 'hold') beginRepair('reset'); else if (RX.phase === 'play') beginRepair('scroll'); else beginRepair('reset');
    say('Everything restored.');
  }

  // ---------------------------------------------------------------- pressing an emotion
  let madN = (Math.random() * 6) | 0, hapN = (Math.random() * 5) | 0;
  const MADFX = { fire: fxFire, tornado: fxTornado, hole: fxHole, quake: fxQuake, lightning: fxLightning, meteor: fxMeteor };
  const HAPFX = { sparkle: hSparkle, fireworks: hFireworks, shooting: hShooting, constellation: hConstellation, aurora: hAurora };
  const OTHER = { 'Sad': fxSad, 'Worried': fxWorried, 'Afraid': fxAfraid, 'Confused': fxConfused, 'Skeptical': fxSkeptic, 'Disappointed': fxDisappointed, 'Frustrated': fxFrustrated, 'Burn it all': fxBurn, 'Mind blown': fxBlown,
    'Curious': tCurious, 'Amazed': tAmazed, 'Grateful': tGrateful, 'Hopeful': tHopeful, 'Excited': tExcited, 'Inspired': tInspired, 'Calm': tCalm };
  const MSG = { fire: 'Text burned.', tornado: 'Text carried away by tornadoes.', hole: 'Text pulled into a black hole.', quake: 'Text shaken loose and fallen.', lightning: 'Text shattered by lightning.', meteor: 'Text knocked off by meteors.' };
  function press(name) {
    if (name === 'Reset') { resetAll(); return; }
    if (NAMES.indexOf(name) < 0) return;
    if (RX) { say('Still reacting. Try again in a moment.'); return; }
    const X = gather(); if (!X) { say('Nothing on screen to react to.'); return; }
    let fx = name.toLowerCase();
    if (name === 'Mad') fx = MAD[madN++ % MAD.length]; else if (name === 'Happy') fx = HAPPY[hapN++ % HAPPY.length];
    RX = { name, fx, X, neg: !!(NEG[name] || BLAST[name]), phase: 'play', blocks: X.blocks, orig: new Map(), hidden: false, timer: 0, sx: scrollX, sy: scrollY, t0: performance.now() };
    if (rm()) {
      if (NEG[name]) { RX.neg = true; hideDOM(); RX.phase = 'hold'; say(name + '. The text returns in a few seconds.'); setUI(); RX.timer = setTimeout(() => beginRepair('auto'), 5000); }
      else { RX.neg = false; ensureCanvas(); cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.clearRect(0, 0, VW, VH); cx.globalAlpha = .14; cx.fillStyle = TINT[name] || '#8E7CFF'; cx.fillRect(0, X.hb, VW, VH - X.hb); cx.globalAlpha = 1; say(name + '.'); setUI(); RX.timer = setTimeout(finish, 1000); }
      return;
    }
    const eff = (name === 'Mad' ? MADFX[fx] : name === 'Happy' ? HAPFX[fx] : OTHER[name])(X); RX.eff = eff;
    eff.end = function (err) { if (!RX) return; if (!RX.neg) { finish(); return; } if (err) { restoreDOM(); finish(); return; } enterHold(); };
    start(eff); setUI(); say(name === 'Mad' ? MSG[fx] || name : name + '.');
  }
  // the visitor scrolls: the text moved, so the canvas copy is stale. Hide it cleanly, put the real text back and let sparkles run fast.
  function onScrollIntent() {
    if (!RX) return;
    if (!RX.neg) { JOB = null; finish(); return; }
    if (performance.now() - RX.t0 < 120) return;
    if (RX.phase === 'spark') { if (JOB) JOB.speed = Math.min(4, (JOB.speed || 1) * 1.3 + .1); return; }
    if (RX.phase === 'repair') { beginRepair('scroll'); return; }
    beginRepair('scroll');
  }
  addEventListener('wheel', () => { onScrollIntent(); }, { passive: true });
  addEventListener('touchmove', () => { onScrollIntent(); }, { passive: true });
  addEventListener('scroll', () => { if (RX && (Math.abs(scrollY - RX.sy) > 3 || Math.abs(scrollX - RX.sx) > 3)) onScrollIntent(); }, { passive: true });
  addEventListener('keydown', e => { if (RX && /^(PageDown|PageUp|ArrowDown|ArrowUp|Home|End| )$/.test(e.key) && !/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) onScrollIntent(); });
  addEventListener('resize', () => { if (RX) resetNow(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && RX) resetNow(); });
  addEventListener('pagehide', () => { resetNow(); });

  // ---------------------------------------------------------------- the pill and the panel
  const bar = document.createElement('div'); bar.className = 'rx-bar'; bar.setAttribute('data-hmr', ''); bar.setAttribute('data-open', '0'); bar.setAttribute('data-reset', '0');
  bar.innerHTML = '<div class="rx-panel" id="rx-panel" role="group" aria-label="Reactions"><div class="rx-hd"><span>How does this make you feel?</span><button type="button" class="rx-min" aria-label="Close reactions">×</button></div><div class="rx-grid">' +
    ROWS.map(r => [0, 2].map(k => `<button type="button" class="rx-chip ${k ? 'pos' : (r[0] === 'Burn it all' ? 'burn' : 'neg')}" data-e="${r[k]}"><span class="e" aria-hidden="true">${r[k + 1]}</span>${r[k]}</button>`).join('')).join('') +
    '<button type="button" class="rx-chip rx-reset" aria-disabled="true">Reset</button></div></div>' +
    '<div class="rx-row"><button type="button" class="rx-mini" aria-label="Reset the page text now">Reset</button><button type="button" class="rx-pill" aria-expanded="false" aria-controls="rx-panel" aria-disabled="false"><span class="e" aria-hidden="true">😊</span>React</button></div>';
  bar.appendChild(live);
  const pill = bar.querySelector('.rx-pill'), mini = bar.querySelector('.rx-mini'), min = bar.querySelector('.rx-min'), resetBtn = bar.querySelector('.rx-reset');
  let open = false;
  function setOpen(o) { open = o; bar.setAttribute('data-open', o ? '1' : '0'); pill.setAttribute('aria-expanded', o ? 'true' : 'false'); }
  function setUI() {
    pill.setAttribute('aria-disabled', RX ? 'true' : 'false'); resetBtn.setAttribute('aria-disabled', RX ? 'false' : 'true');
    bar.setAttribute('data-reset', RX && RX.neg && (RX.phase === 'play' || RX.phase === 'hold') ? '1' : '0');
  }
  pill.addEventListener('click', () => { if (RX) { say('Still reacting.'); return; } if (open) { setOpen(false); return; } setOpen(true); const f = bar.querySelector('.rx-chip'); if (f) f.focus({ preventScroll: true }); });
  min.addEventListener('click', () => { setOpen(false); pill.focus({ preventScroll: true }); });
  mini.addEventListener('click', () => resetAll());
  bar.addEventListener('click', ev => {
    const b = ev.target.closest('.rx-chip'); if (!b) return;
    if (b.classList.contains('rx-reset')) { if (RX) { setOpen(false); resetAll(); } return; }
    const name = b.getAttribute('data-e'); setOpen(false); pill.focus({ preventScroll: true }); requestAnimationFrame(() => press(name));
  });
  document.addEventListener('pointerdown', e => { if (open && !bar.contains(e.target)) setOpen(false); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) { setOpen(false); pill.focus({ preventScroll: true }); } });
  document.body.appendChild(bar);

  window.hmrReact = {
    emotions: NAMES.slice(), press, resetNow,
    target: () => { const X = gather(); return X ? Array.from(X.blocks.keys()) : null; },
    state: el => RX && RX.blocks.has(el) ? RX.phase + ':' + RX.name : 'ready',
    effect: el => RX && RX.blocks.has(el) ? RX.fx : null,
    phase: () => RX ? RX.phase : 'idle'
  };
})();
