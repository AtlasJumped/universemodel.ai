// reactions: a floating emotion bar (bottom right). Pressing an emotion makes the content block nearest the center of the screen react.
// Nothing here changes layout: every effect is drawn on one fixed overlay canvas under the header. For the effects that move letters,
// the block's text is measured with ranges (never wrapped or split in the DOM), hidden with a class, and drawn on the canvas.
// Everything added to a block (classes, and for two effects one inline background image) is removed again on Reset.
(function () {
  'use strict';
  if (window.hmrReact) return;

  const rm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const eIn = u => u * u * u, eOut = u => 1 - Math.pow(1 - u, 3), eIO = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  const GOLD = [255, 208, 112], WHITE = [255, 255, 255], ICE = [200, 224, 255], AMBER = [238, 160, 30], VIOLET = [140, 120, 255], BLUE = [90, 160, 255];
  const pick = () => { const r = Math.random(); return r < .5 ? GOLD : r < .85 ? WHITE : ICE; };
  const MAD = ['fire', 'tornado', 'hole', 'quake', 'lightning', 'meteor'], HAPPY = ['sparkle', 'fireworks', 'shooting', 'constellation', 'aurora'];
  const MODE = { fire: 'burnt', tornado: 'erased', hole: 'swallowed', quake: 'shaken', lightning: 'struck', meteor: 'bombarded' };
  const MSG = {
    fire: 'Text burned.', tornado: 'Text carried away by tornadoes.', hole: 'Text pulled into a black hole.',
    quake: 'Text shaken loose and fallen.', lightning: 'Text shattered by lightning.', meteor: 'Text knocked off by meteors.'
  };
  const EMO = [['Mad', '😡'], ['Sad', '😢'], ['Worried', '😟'], ['Confused', '😕'], ['Skeptical', '🤨'], ['Mind blown', '🤯'], ['Curious', '🤔'], ['Amazed', '😮'], ['Happy', '😊'], ['Grateful', '🥰'], ['Hopeful', '🥹'], ['Excited', '🤩'], ['Inspired', '😇'], ['Calm', '😌']];
  const PERSIST = { 'Mad': 1, 'Sad': 1, 'Worried': 1, 'Confused': 1, 'Skeptical': 1, 'Mind blown': 1 };
  const STATE_CLS = ['rx-gone', 'rx-char', 'rx-wash', 'rx-faint', 'rx-haze', 'rx-ghost', 'rx-k', 'rx-l', 'rx-fade'];

  // ---------------------------------------------------------------- styles
  const css = document.createElement('style');
  css.textContent = `
.rx-bar{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:18;font:13px/1.2 var(--font,system-ui,sans-serif);color:#0E2A55;max-width:calc(100vw - 24px);display:flex;flex-direction:column;align-items:flex-end}
.rx-panel{width:250px;max-width:calc(100vw - 24px);box-sizing:border-box;background:#fff;border:1px solid #cfdcf0;border-radius:14px;box-shadow:0 6px 24px rgba(14,58,117,.2);padding:8px;max-height:60vh;overflow:auto;overscroll-behavior:contain}
.rx-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 7px;padding:0 2px;font-weight:600;font-size:12px;line-height:1.25}
.rx-min,.rx-pill,.rx-chip{font:600 13px/1 var(--font,system-ui,sans-serif);color:#0E2A55;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.rx-min{min-width:32px;min-height:30px;border:1px solid #d9e3f3;background:#f7faff;border-radius:8px;padding:0 8px}
.rx-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
.rx-chip{min-height:32px;display:flex;align-items:center;gap:6px;padding:0 9px;border:1px solid #d9e3f3;background:#f7faff;border-radius:10px;text-align:left;white-space:nowrap}
.rx-chip .e{font-size:16px;line-height:1}
.rx-chip:hover,.rx-min:hover{background:#e8f1ff;border-color:#b8cdee}
.rx-reset{grid-column:1/-1;justify-content:center;background:#fff;border-color:#C62828;color:#C62828}
.rx-reset:hover{background:#fdeeee}
.rx-reset[aria-disabled="true"]{opacity:.45;border-color:#d9e3f3;color:#53657E;cursor:default}
.rx-pill{display:none;align-items:center;gap:6px;min-height:36px;padding:0 14px;border:1px solid #cfdcf0;background:#fff;border-radius:999px;box-shadow:0 4px 16px rgba(14,58,117,.2)}
.rx-pill .e{font-size:16px}
.rx-bar[data-open="0"] .rx-panel{display:none}
.rx-bar[data-open="0"] .rx-pill{display:flex}
.rx-min:focus-visible,.rx-pill:focus-visible,.rx-chip:focus-visible{outline:2px solid #0E3A75;outline-offset:2px;box-shadow:0 0 0 4px #fff}
.rx-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.rx-fade,.rx-fade *{transition:background-color 1.2s ease,border-color 1.2s ease,color 1.2s ease,opacity 1.2s ease,text-shadow 1.2s ease,box-shadow 1.2s ease}
.rx-char{background-color:#2a2420!important;border-color:#1a1613!important}
.rx-char.rx-k>*:not(:has(button)){opacity:.55;text-shadow:0 0 2px #000,1px 1px 3px rgba(0,0,0,.85)}
.rx-char.rx-l{text-shadow:0 0 2px #000,1px 1px 3px rgba(0,0,0,.85)}
.rx-char,.rx-char *:not(button):not(button *){color:#0b0b0b!important;border-color:#0b0b0b!important}
.rx-char *:not(button):not(button *){background-color:transparent!important}
.rx-gone.rx-l,.rx-gone.rx-l *:not(button):not(button *){color:transparent!important;-webkit-text-fill-color:transparent!important;text-decoration-color:transparent!important;text-shadow:none!important}
.rx-gone.rx-k{color:transparent!important;-webkit-text-fill-color:transparent!important}
.rx-gone.rx-k>*:not(:has(button)){opacity:0!important}
.rx-faint.rx-l{opacity:.12!important}.rx-faint.rx-k>*:not(:has(button)){opacity:.12!important}
.rx-ghost.rx-l{opacity:.18!important}.rx-ghost.rx-k>*:not(:has(button)){opacity:.18!important}
.rx-wash{background-image:linear-gradient(rgba(110,130,165,.13),rgba(110,130,165,.13))!important}
.rx-haze{background-image:linear-gradient(rgba(90,95,105,.16),rgba(90,95,105,.16))!important}`;
  document.head.appendChild(css);

  // ---------------------------------------------------------------- overlay canvas and the one loop
  let cv = null, cx = null, DPR = 1, VW = 0, VH = 0, curFo = null;
  const anims = []; let raf = 0, last = 0;
  const store = new Map();   // block -> {el, kind, mode, fx, name, busy, cardStyle, gen}
  function ensureCanvas() {
    if (!cv) {
      cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); cv.dataset.fxReact = '1';
      cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:15';
      document.body.appendChild(cv); cx = cv.getContext('2d'); cx.textAlign = 'center';
    }
    const w = innerWidth, h = innerHeight, d = Math.min(2, devicePixelRatio || 1);
    if (w !== VW || h !== VH || d !== DPR) { VW = w; VH = h; DPR = d; cv.width = Math.round(w * d); cv.height = Math.round(h * d); cx.textAlign = 'center'; curFo = null; }
  }
  function start(a) { ensureCanvas(); a.t = 0; anims.push(a); if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
  function frame(ts) {
    raf = 0; if (!anims.length) { clear(); return; }
    const dt = last ? clamp((ts - last) / 1000, 0, 0.05) : 0.016; last = ts;
    ensureCanvas(); cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.clearRect(0, 0, VW, VH); cx.globalAlpha = 1;
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i]; a.t += dt; const r = a.card.getBoundingClientRect(); let fin = false;
      try { fin = a.step(dt, r, cx); } catch (e) { fin = true; }
      cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
      if (a.hide && !a.hid) { a.hid = 1; const S = store.get(a.card); a.card.classList.add('rx-gone', S ? S.kind : 'rx-k'); }   // the real text goes the moment its canvas copy is drawn
      if (fin) { anims.splice(i, 1); try { a.end(); } catch (e) { } }
    }
    if (anims.length) raf = requestAnimationFrame(frame); else { clear(); last = 0; }
  }
  function clear() { if (cx) { cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); } }

  // ---------------------------------------------------------------- drawing helpers (the look of fx-sky.js)
  const SP = {};
  function sprite(col) {
    const k = col.join(','); if (SP[k]) return SP[k];
    const s = document.createElement('canvas'); s.width = s.height = 64; const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${k},0.9)`); gr.addColorStop(0.35, `rgba(${k},0.38)`); gr.addColorStop(1, `rgba(${k},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (SP[k] = s);
  }
  function glow(c, x, y, rad, a, col) { if (a <= 0.01 || rad < 0.5) return; c.globalAlpha = Math.min(1, a); c.drawImage(sprite(col), x - rad, y - rad, rad * 2, rad * 2); c.globalAlpha = 1; }
  function spark(c, x, y, R, a, col, star) {
    if (a <= 0.02) return; glow(c, x, y, R * 4, a, col);
    c.fillStyle = `rgba(255,255,255,${Math.min(1, a) * 0.9})`; c.beginPath(); c.arc(x, y, Math.max(0.6, R * 0.42), 0, 6.283); c.fill();
    if (star) { const L = R * 3.4; c.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${Math.min(1, a)})`; c.lineWidth = 1.1; c.beginPath(); c.moveTo(x - L, y); c.lineTo(x + L, y); c.moveTo(x, y - L); c.lineTo(x, y + L); c.stroke(); }
  }
  function rrect(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  const rgbOf = s => { const m = /(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)/.exec(s || ''); return m ? [+m[1], +m[2], +m[3]] : [20, 30, 50]; };
  const mixc = (a, b, u) => `rgb(${Math.round(lerp(a[0], b[0], u))},${Math.round(lerp(a[1], b[1], u))},${Math.round(lerp(a[2], b[2], u))})`;

  // ---------------------------------------------------------------- real fire: tongue-shaped flames, round embers, smoke (no stars anywhere)
  const FS = [];
  (function () {
    const stops = [[[255, 170, 40, 0], [255, 150, 30, .85], [255, 226, 120, 1], [255, 250, 215, 1]], [[255, 120, 20, 0], [255, 110, 20, .85], [255, 168, 40, .95], [255, 205, 90, 1]], [[200, 50, 20, 0], [205, 55, 20, .6], [225, 85, 20, .8], [240, 120, 30, .8]]];
    stops.forEach(st => {
      const s = document.createElement('canvas'); s.width = 40; s.height = 72; const g = s.getContext('2d'), gr = g.createLinearGradient(0, 2, 0, 70);
      [0, .4, .75, 1].forEach((p, i) => gr.addColorStop(p, `rgba(${st[i][0]},${st[i][1]},${st[i][2]},${st[i][3]})`));
      g.fillStyle = gr; g.beginPath(); g.moveTo(20, 70); g.bezierCurveTo(2, 70, 4, 45, 14, 30); g.bezierCurveTo(18, 22, 17, 10, 20, 2); g.bezierCurveTo(23, 10, 22, 22, 26, 30); g.bezierCurveTo(36, 45, 38, 70, 20, 70); g.fill();
      FS.push(s);
    });
  })();
  // parts: {k:'f' flame | 'e' ember | 's' smoke, x, y (block-relative), vx, vy, life, age, sz}
  function flameAt(arr, x, y, sz, o) { o = o || {}; arr.push({ k: 'f', x, y, vx: rnd(-16, 16), vy: -rnd(o.v0 || 45, o.v1 || 115), life: rnd(o.l0 || .55, o.l1 || 1.15), age: 0, sz, ph: rnd(0, 6) }); }
  function emberAt(arr, x, y, n) { for (let i = 0; i < n; i++) arr.push({ k: 'e', x: x + rnd(-8, 8), y, vx: rnd(-40, 40), vy: -rnd(40, 130), life: rnd(.6, 1.3), age: 0, sz: rnd(1.4, 2.6) }); }
  function smokeAt(arr, x, y, n) { for (let i = 0; i < n; i++) arr.push({ k: 's', x: x + rnd(-8, 8), y: y - 6, vx: rnd(-12, 12), vy: -rnd(18, 40), life: rnd(.8, 1.4), age: 0, sz: rnd(7, 13) }); }
  function stepParts(g, arr, dt, ox, oy) {
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i]; p.age += dt; if (p.age >= p.life) { arr.splice(i, 1); continue; }
      const u = p.age / p.life; p.x += p.vx * dt + (p.k === 'f' ? Math.sin(p.age * 11 + p.ph) * .5 : 0); p.y += p.vy * dt; if (p.k === 'e') p.vy += 20 * dt;
      const X = ox + p.x, Y = oy + p.y;
      if (p.k === 'f') {
        const st = u < .3 ? 0 : u < .66 ? 1 : 2, w = p.sz * (.6 + .5 * (p.ph % 1)) * (1 + .14 * Math.sin(p.age * 28 + p.ph)), h = p.sz * (1.7 + .8 * ((p.ph * 7) % 1)) * (1 - u * .35);
        g.globalAlpha = Math.min(1, (1 - u) * 1.7); g.save(); g.translate(X, Y); g.rotate(Math.sin(p.age * 9 + p.ph) * .2); g.drawImage(FS[st], -w / 2, -h, w, h); g.restore(); g.globalAlpha = 1;
      } else if (p.k === 'e') glow(g, X, Y, p.sz * 3.2, (1 - u) * (.75 + .25 * Math.sin(p.age * 30)), [255, 140, 40]);
      else glow(g, X, Y, p.sz * (1 + u * 1.8), .2 * (1 - u), [70, 62, 56]);
    }
  }

  // ---------------------------------------------------------------- measuring a block's text (nothing in the DOM changes)
  // returns letters, or words broken at line ends when there would be more than `cap` letters
  function collect(c, cap) {
    ensureCanvas();
    const cr = c.getBoundingClientRect(), out = [], fos = new Map(), rg = document.createRange();
    const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT, { acceptNode: n => (!/\S/.test(n.nodeValue) || !n.parentElement || n.parentElement.closest('.rx-bar,script,style,svg,noscript,button')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let n, wid = 0;
    while ((n = w.nextNode())) {
      const p = n.parentElement; let fo = fos.get(p);
      if (!fo) {
        const cs = getComputedStyle(p); fo = { font: cs.font || `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, color: cs.color, rgb: rgbOf(cs.color), up: cs.textTransform === 'uppercase', by: 0 };
        cx.font = fo.font; const m = cx.measureText('Hg'); fo.by = m.fontBoundingBoxAscent != null ? (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2 : parseFloat(cs.fontSize) * .33; fos.set(p, fo);
      }
      const t = n.nodeValue; wid++;
      for (let i = 0; i < t.length; i++) {
        if (/\s/.test(t[i])) { wid++; continue; }
        rg.setStart(n, i); rg.setEnd(n, i + 1); const rc = rg.getClientRects(); if (!rc.length) continue; const b = rc[0]; if (b.width < .5 || b.height < 2) continue;
        out.push({ ch: fo.up ? t[i].toUpperCase() : t[i], fo, l: b.left - cr.left, r: b.right - cr.left, x: b.left - cr.left + b.width / 2, y: b.top - cr.top + b.height / 2, wid, ln: Math.round(b.top) });
      }
    }
    if (out.length <= (cap == null ? 560 : cap)) return out;
    const m = [], key = new Map();
    out.forEach(L => { const k = L.wid + ':' + L.ln; let q = key.get(k); if (!q) { q = { ch: '', fo: L.fo, l: L.l, r: L.r, y: L.y, wid: L.wid, ln: L.ln }; key.set(k, q); m.push(q); } q.ch += L.ch; q.l = Math.min(q.l, L.l); q.r = Math.max(q.r, L.r); });
    m.forEach(q => { q.x = (q.l + q.r) / 2; });
    return m;
  }
  function put(g, L, X, Y, rot, sx, sy, a, col) {   // X, Y: center on screen
    if (a <= .01) return;
    if (curFo !== L.fo) { g.font = L.fo.font; curFo = L.fo; }
    g.globalAlpha = Math.min(1, a); g.fillStyle = col || L.fo.color;
    if (!rot && sx === 1 && sy === 1) g.fillText(L.ch, X, Y + L.fo.by);
    else { g.save(); g.translate(X, Y); g.rotate(rot); g.scale(sx, sy); g.fillText(L.ch, 0, L.fo.by); g.restore(); }
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- state of a block
  const live = document.createElement('span'); live.className = 'rx-sr'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
  function say(t) { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); }
  function putStyle(list) { const f = () => list.forEach(([k, s]) => { if (s === null) { if (k.hasAttribute('style')) k.removeAttribute('style'); } else if (k.getAttribute('style') !== s) k.setAttribute('style', s); }); f(); requestAnimationFrame(f); setTimeout(f, 120); setTimeout(f, 700); }
  function cleanClass(c, ...n) { c.classList.remove(...n); if (!c.getAttribute('class')) c.removeAttribute('class'); }
  function gone(S, el) { el.classList.add('rx-gone', S.kind); }
  function done(S, mode, msg) { S.mode = mode; S.busy = false; if (msg) say(S.name + '. ' + msg + ' Press Reset to restore.'); refreshReset(); }
  function isLeaf(el) { return !Array.from(el.children).some(k => { const d = getComputedStyle(k).display; return d !== 'inline' && d !== 'none' && d !== 'contents' && d.indexOf('inline') !== 0; }); }
  // a letter that has been knocked loose and flies free: {x,y,vx,vy,rot,vr,age,life,g}
  function flyL(L, o) { Object.assign(L, o, { fly: 1, age: 0, rot: L.rot || 0 }); }
  function stepFly(L, dt) { L.age += dt; L.vy += L.g * dt; L.x += L.vx * dt; L.y += L.vy * dt; L.rot += L.vr * dt; return L.age >= L.life; }

  // ---------------------------------------------------------------- 2. sparkle tornadoes
  function fxTornado(S, c) {
    const items = collect(c), r0 = c.getBoundingClientRect(), W = r0.width, H = r0.height, Hf = H * .95 + 40, nT = W * H > 90000 ? 3 : 2;
    const tors = Array.from({ length: nT }, (_, k) => {
      const side = k % 3, st = side === 0 ? { x: -70, y: rnd(.6, 1) * H } : side === 1 ? { x: W + 70, y: rnd(.6, 1) * H } : { x: rnd(.2, .8) * W, y: -40 };
      const wp = [st]; for (let i = 0; i < 3; i++) wp.push({ x: rnd(.08, .92) * W, y: rnd(.55, 1.05) * H }); wp.push({ x: rnd(.2, .8) * W, y: rnd(.7, 1) * H });
      return { wp, x: st.x, by: st.y + Hf * .5, ph: rnd(0, 6), t0: k * .22, fade: 1, alive: true, dir: 1 };
    });
    const cr = (a, b, c2, d, f) => .5 * ((2 * b) + (-a + c2) * f + (2 * a - 5 * b + 4 * c2 - d) * f * f + (-a + 3 * b - 3 * c2 + d) * f * f * f);
    const axis = (T, h, t) => T.x + Math.sin(t * 3 + h * 4 + T.ph) * 9 * h;
    const rf = h => 7 + 46 * h;
    items.forEach(L => { L.st = 0; L.dur = rnd(1.5, 2.3); L.fling = Math.random() < .3; L.spin = rnd(-9, 9); L.k = rnd(.5, 1.05); });
    let all = false, tEnd = 0;
    function capture(L, T, ti, t, dur) {
      const h = clamp((T.by - L.y) / Hf, 0, 1), dx = L.x - axis(T, h, t);
      L.st = 1; L.tor = ti; L.h0 = h; L.r0 = Math.abs(dx); L.a0 = dx >= 0 ? 0 : Math.PI; L.t0 = t; if (dur) L.dur = dur; L.fly = 0;
    }
    return {
      card: c, hide: true,
      step(dt, r, g) {
        const t = this.t, ox = r.left, oy = r.top; let left = 0;
        tors.forEach((T, i) => {
          const age = t - T.t0; if (age < 0) return;
          const u = clamp(age / 3.6, 0, 1) * (T.wp.length - 1), k = Math.min(T.wp.length - 2, Math.floor(u)), f = u - k, w = T.wp, a = w[Math.max(0, k - 1)], b = w[k], c2 = w[k + 1], d = w[Math.min(w.length - 1, k + 2)];
          T.x = cr(a.x, b.x, c2.x, d.x, f); T.by = cr(a.y, b.y, c2.y, d.y, f) + Hf * .08; T.grow = Math.min(1, age / .5);
          if (all && T.alive && t > tEnd + .1) T.alive = false; if (!T.alive) T.fade = Math.max(0, T.fade - dt / .45);
        });
        for (const L of items) {
          if (L.st === 3) continue; left++;
          let X, Y, rot = 0, s = 1, al = 1;
          if (L.st === 0) {
            X = L.x; Y = L.y;
            for (let i = 0; i < tors.length; i++) { const T = tors[i]; if (T.t0 > t - .3 || !T.alive) continue; const h = (T.by - L.y) / Hf; if (h < -.05 || h > 1.05) continue; if (Math.abs(L.x - axis(T, clamp(h, 0, 1), t)) < 16 + 38 * clamp(h, 0, 1)) { capture(L, T, i, t); break; } }
            if (L.st === 0 && t > 3.0) { let bi = 0, bd = 1e9; tors.forEach((T, i) => { if (!T.alive || T.t0 > t) return; const dd = Math.abs(L.x - T.x) + Math.abs(L.y - T.by + Hf / 2) * .4; if (dd < bd) { bd = dd; bi = i; } }); capture(L, tors[bi], bi, t, rnd(.8, 1.2)); }
          }
          if (L.st === 1) {
            const T = tors[L.tor], age = t - L.t0, u = clamp(age / L.dur, 0, 1), h = L.h0 + (1.08 - L.h0) * Math.pow(u, 1.25);
            const rr = lerp(L.r0, rf(h) * L.k, clamp(age / .45, 0, 1)), a = L.a0 + 7 * age + 5 * age * age;
            X = axis(T, h, t) + Math.cos(a) * rr; Y = T.by - h * Hf + Math.sin(a) * rr * .3; rot = L.spin * age; s = 1 - .8 * clamp((h - .1) / .9, 0, 1); al = 1 - clamp((h - .72) / .36, 0, 1);
            L.cx = X; L.cy = Y; L.ca = a; L.cr = rr;
            if (L.fling && h > .62) { const sp = (rr + 40) * 8; flyL(L, { x: X, y: Y, vx: -Math.sin(a) * sp * .8, vy: Math.cos(a) * sp * .3 - 90, vr: L.spin, g: 360, life: .95, rot }); L.st = 2; L.fling = false; }
            else if (u >= 1) L.st = 3;
          } else if (L.st === 2) {
            if (stepFly(L, dt)) { L.st = 3; continue; }
            X = L.x; Y = L.y; rot = L.rot; s = .7; al = 1 - L.age / L.life;
            for (let i = 0; i < tors.length; i++) { const T = tors[i]; if (!T.alive || T.t0 > t - .3 || i === L.tor) continue; const h = (T.by - Y) / Hf; if (h < 0 || h > 1) continue; if (Math.abs(X - axis(T, h, t)) < 40 + 40 * h) { capture(L, T, i, t, rnd(.8, 1.3)); L.x = X; L.y = Y; break; } }
          }
          if (L.st !== 3) put(g, L, ox + (L.st === 0 ? L.x : X), oy + (L.st === 0 ? L.y : Y), rot, s, s, al);
        }
        if (!all && left === 0) { all = true; tEnd = Math.max(t, 3.4); }
        // the tornadoes: three helical arms of four-point sparkles, wide at the top, narrow at the bottom
        tors.forEach(T => {
          const age = t - T.t0; if (age < 0 || T.fade <= 0) return; const gA = (T.grow || 0) * T.fade;
          for (let arm = 0; arm < 3; arm++) {
            const col = arm === 0 ? AMBER : arm === 1 ? GOLD : VIOLET;
            for (let j = 0; j < 28; j++) {
              const h = (j + .5) / 28, ang = arm * 2.094 + h * 7 + t * 9, rad = rf(h) * (.9 + .1 * Math.sin(t * 5 + j));
              const x = ox + axis(T, h, t) + Math.cos(ang) * rad, y = oy + T.by - h * Hf + Math.sin(ang) * rad * .3;
              spark(g, x, y, (1 + .9 * h) * (T.grow || 0), gA * (.5 + .5 * Math.sin(ang)) * (.55 + .45 * Math.sin(t * 7 + j * 1.7)), col, j % 5 === 0);
            }
          }
          for (let j = 0; j < 22; j++) { const h = Math.random(), ang = rnd(0, 6.283), rad = rf(h) * rnd(1, 1.7); spark(g, ox + axis(T, h, t) + Math.cos(ang) * rad, oy + T.by - h * Hf + Math.sin(ang) * rad * .3, rnd(.7, 1.4), gA * .7, Math.random() < .5 ? GOLD : WHITE, false); }
        });
        return all && tors.every(T => T.fade <= 0) || t > 7;
      },
      end() { gone(S, c); done(S, MODE.tornado, MSG.tornado); }
    };
  }

  // ---------------------------------------------------------------- 3. black hole, a drain
  function fxHole(S, c) {
    const items = collect(c), r0 = c.getBoundingClientRect(), W = r0.width, H = r0.height, CX = W / 2, CY = H / 2;
    const Rmax = clamp(Math.min(W, H) * .16, 18, 46); let rmax = 1;
    items.forEach(L => { L.dx = L.x - CX; L.dy = L.y - CY; L.r0 = Math.hypot(L.dx, L.dy); L.th0 = Math.atan2(L.dy, L.dx); rmax = Math.max(rmax, L.r0); L.dir = 1; });
    let tLast = 0; items.forEach(L => { L.ts = .45 + (L.r0 / rmax) * 1.25 + rnd(0, .15); L.dur = rnd(1.25, 1.6); tLast = Math.max(tLast, L.ts + L.dur); });
    const tClose = tLast + .1;
    return {
      card: c, hide: true,
      step(dt, r, g) {
        const t = this.t, X = r.left + CX, Y = r.top + CY, grow = eOut(clamp(t / .6, 0, 1)), shrink = 1 - eIn(clamp((t - tClose) / .5, 0, 1)), R = Rmax * grow * shrink;
        // a faint dark swirl, like water around a drain
        if (R > 1) {
          g.save(); const ga = Math.min(1, R / Rmax);
          const hg = g.createRadialGradient(X, Y, R * .6, X, Y, R * 3.6); hg.addColorStop(0, `rgba(15,20,45,${.28 * ga})`); hg.addColorStop(1, 'rgba(15,20,45,0)'); g.fillStyle = hg; g.beginPath(); g.arc(X, Y, R * 3.6, 0, 6.283); g.fill();
          g.lineCap = 'round';
          for (let k = 0; k < 6; k++) {
            g.beginPath(); for (let i = 0; i <= 22; i++) { const q = i / 22, rr = R * (1.05 + q * 2.7), th = k * 1.047 + t * 2.6 + q * 2.1; const px = X + Math.cos(th) * rr, py = Y + Math.sin(th) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); }
            g.strokeStyle = `rgba(20,25,60,${.07 * ga})`; g.lineWidth = 3; g.stroke(); g.strokeStyle = `rgba(20,25,60,${.12 * ga})`; g.lineWidth = 1; g.stroke();
          }
          g.restore();
        }
        let left = 0;
        for (const L of items) {
          if (L.st === 3) continue; left++;
          const age = t - L.ts; if (age < 0) { put(g, L, r.left + L.x, r.top + L.y, 0, 1, 1, 1); continue; }
          const u = clamp(age / L.dur, 0, 1); if (u >= 1) { L.st = 3; continue; }
          const rr = L.r0 * Math.pow(1 - u, 1.45), th = L.th0 + L.dir * (2.2 * u + 7 * u * u * u), e = clamp(u * 2, 0, 1), s = Math.pow(1 - u, .7);
          put(g, L, X + Math.cos(th) * rr, Y + Math.sin(th) * rr, (th + Math.PI) * e * .9, (1 + 2.6 * e * u) * s, Math.max(.12, 1 - .75 * e * u) * s, 1 - clamp((u - .8) / .2, 0, 1));
        }
        if (R > 1) {   // the disc, over the letters
          const dg = g.createRadialGradient(X, Y, 0, X, Y, R * 1.18); dg.addColorStop(0, '#000'); dg.addColorStop(.82, '#000'); dg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = dg; g.beginPath(); g.arc(X, Y, R * 1.18, 0, 6.283); g.fill();
        }
        return t > tClose + .5;
      },
      end() { gone(S, c); done(S, MODE.hole, MSG.hole); }
    };
  }

  // ---------------------------------------------------------------- 4. earthquake
  function fxQuake(S, c) {
    const items = collect(c), r0 = c.getBoundingClientRect(), H = r0.height, puffs = [];
    items.forEach(L => { L.brk = .7 + 2.1 * Math.pow(Math.random(), .9); L.j = rnd(.5, 1.3); L.st = 0; L.bounced = false; });
    return {
      card: c, hide: true,
      step(dt, r, g) {
        const t = this.t, A = Math.min(1, t / 2.4) * 7, gx = (Math.sin(t * 61) + Math.sin(t * 37)) * A * .35, gy = Math.sin(t * 47) * A * .25; let left = 0;
        for (const L of items) {
          if (L.st === 2) continue; left++;
          if (L.st === 0 && t >= L.brk) { flyL(L, { vx: rnd(-70, 70), vy: rnd(-60, 10), vr: rnd(-5, 5), g: 2100, life: 9 }); L.st = 1; L.rot = 0; L.ox = L.x + gx; L.oy = L.y; L.x = L.ox; }
          if (L.st === 0) { put(g, L, r.left + L.x + gx + (Math.random() - .5) * 2 * A * L.j, r.top + L.y + gy + (Math.random() - .5) * 2 * A * L.j * .8, 0, 1, 1, 1); continue; }
          stepFly(L, dt);
          if (!L.bounced && L.y > H - 6 && L.vy > 0) { L.bounced = true; L.vy = -L.vy * .42; L.vx *= 1.4; L.y = H - 6; for (let k = 0; k < 2 && puffs.length < 60; k++) puffs.push({ x: L.x, y: H - 2, vx: rnd(-30, 30), vy: -rnd(8, 28), age: 0, life: rnd(.4, .7), rr: rnd(3, 6) }); }
          const fall = clamp((L.y - H) / 240, 0, 1); if (fall >= 1) { L.st = 2; continue; }
          put(g, L, r.left + L.x, r.top + L.y, L.rot, 1, 1, 1 - fall * .9);
        }
        for (let i = puffs.length - 1; i >= 0; i--) { const p = puffs[i]; p.age += dt; if (p.age >= p.life) { puffs.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; const u = p.age / p.life; g.fillStyle = `rgba(120,105,95,${.32 * (1 - u)})`; g.beginPath(); g.arc(r.left + p.x, r.top + p.y, p.rr * (1 + u * 1.6), 0, 6.283); g.fill(); }
        return left === 0 && !puffs.length || t > 9;
      },
      end() { gone(S, c); done(S, MODE.quake, MSG.quake); }
    };
  }

  // ---------------------------------------------------------------- 5. lightning
  function bolt(x0, y0, x1, y1, jit) {
    const pts = [[x0, y0]], n = 11, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    for (let i = 1; i < n; i++) { const q = i / n, j = (Math.random() - .5) * 2 * jit * (1 - q * .55); pts.push([x0 + dx * q + nx * j, y0 + dy * q + ny * j]); }
    pts.push([x1, y1]); return pts;
  }
  function fxLightning(S, c) {
    const items = collect(c), r0 = c.getBoundingClientRect(), W = r0.width, H = r0.height, nS = W * H > 60000 ? 3 : 2, radius = parseFloat(getComputedStyle(c).borderTopLeftRadius) || 0;
    const strikes = Array.from({ length: nS }, (_, i) => ({ x: W * (i + rnd(.25, .75)) / nS, y: H * rnd(.3, .75), ts: .6 + i * .6, bolt: null, branches: [] }));
    strikes.forEach(s => { s.bolt = bolt(s.x + rnd(-50, 50), -Math.min(260, r0.top - 70 > 0 ? r0.top - 70 : 120), s.x, s.y, 34); for (let k = 0; k < 2; k++) { const b = s.bolt[3 + k * 3]; s.branches.push(bolt(b[0], b[1], b[0] + rnd(-90, 90), b[1] + rnd(50, 110), 14)); } });
    items.forEach(L => {   // each letter belongs to its nearest strike
      let bi = 0, bd = 1e9; strikes.forEach((s, i) => { const d = Math.hypot(L.x - s.x, L.y - s.y); if (d < bd) { bd = d; bi = i; } });
      L.s = bi; L.d = bd; L.tb = strikes[bi].ts + bd * .0009; L.st = 0;
    });
    const tEnd = strikes[nS - 1].ts + 1.9;
    return {
      card: c, hide: true,
      step(dt, r, g) {
        const t = this.t, ox = r.left, oy = r.top; let left = 0;
        for (const L of items) {
          if (L.st === 2) continue; left++;
          if (L.st === 0 && t >= L.tb) { const s = strikes[L.s], dx = L.x - s.x, dy = L.y - s.y, d = Math.hypot(dx, dy) || 1, sp = rnd(260, 520) / (1 + d / 170) + 110; flyL(L, { vx: dx / d * sp + rnd(-40, 40), vy: dy / d * sp - rnd(40, 160), vr: rnd(-12, 12), g: 520, life: rnd(.7, 1.1) }); L.st = 1; }
          if (L.st === 0) put(g, L, ox + L.x, oy + L.y, 0, 1, 1, 1);
          else { if (stepFly(L, dt)) { L.st = 2; continue; } put(g, L, ox + L.x, oy + L.y, L.rot, 1 - L.age / L.life * .5, 1 - L.age / L.life * .5, 1 - L.age / L.life); }
        }
        // a storm-dark card, a white flash and a blue-white bolt for each strike
        const dark = Math.min(1, t / .5) * (1 - clamp((t - (tEnd - .6)) / .6, 0, 1));
        let flash = 0; strikes.forEach(s => { const a = t - s.ts; if (a >= 0 && a < .3) flash = Math.max(flash, (1 - a / .3) * (a < .12 ? 1 : .6 + Math.random() * .4)); });
        g.save(); rrect(g, ox, oy, W, H, radius); g.clip();
        g.fillStyle = `rgba(8,14,40,${.5 * dark})`; g.fillRect(ox, oy, W, H);
        if (flash > 0) { g.fillStyle = `rgba(255,255,255,${.85 * flash})`; g.fillRect(ox, oy, W, H); }
        g.restore();
        strikes.forEach(s => {
          const a = t - s.ts; if (a < 0 || a > .42) return; const al = a < .18 ? 1 : (Math.random() < .55 ? .8 : .3) * (1 - (a - .18) / .24);
          g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
          const draw = (pts, k) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(ox + p[0], oy + p[1]) : g.moveTo(ox + p[0], oy + p[1])); g.stroke(); };
          [[11 * 1, `rgba(90,120,255,${.22 * al})`], [5, `rgba(130,160,255,${.7 * al})`], [2, `rgba(255,255,255,${al})`]].forEach(([w, col]) => { g.lineWidth = w; g.strokeStyle = col; draw(s.bolt); g.lineWidth = w * .6; s.branches.forEach(b => draw(b)); });
          glow(g, ox + s.x, oy + s.y, 60, al, [150, 180, 255]); g.restore();
        });
        return (left === 0 && t > tEnd) || t > 8;
      },
      end() {   // faint scorch marks stay on the card until Reset
        gone(S, c); S.cardStyle = c.getAttribute('style');
        c.style.backgroundImage = strikes.map(s => `radial-gradient(circle at ${s.x.toFixed(0)}px ${s.y.toFixed(0)}px, rgba(30,25,40,.3) 0, rgba(30,25,40,.14) 12px, rgba(30,25,40,0) 48px)`).join(',');
        done(S, MODE.lightning, MSG.lightning);
      }
    };
  }

  // ---------------------------------------------------------------- 1. comets and fire (ends charred). No stars: glowing streaks, tongue flames, round embers, smoke
  function fxFire(S, c) {
    const W0 = c.getBoundingClientRect(), n = 3 + Math.floor(Math.random() * 3), pts = [];
    const ys = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - .5);
    for (let i = 0; i < n; i++) pts.push({ x: W0.width * (0.14 + 0.72 * (i + rnd(.1, .9)) / n), y: W0.height * (0.2 + 0.62 * (ys[i] + rnd(.1, .9)) / n) });
    const words = collect(c, 0);
    const comets = pts.map((p, i) => ({ tx: p.x, ty: p.y, sx: i % 2 ? VW + 30 : -30, sy: -40, delay: i * 0.24, dur: rnd(.5, .7), hit: false }));
    const parts = []; let charred = false; const gen = S.gen = (S.gen || 0) + 1;
    return {
      card: c,
      step(dt, r, g) {
        const t = this.t;
        comets.forEach(m => {
          const u = (t - m.delay) / m.dur; if (u < 0) return;
          const hx = r.left + m.tx, hy = r.top + m.ty;
          if (u < 1) {
            const e = eIn(clamp(u, 0, 1)) * .75 + u * .25, x = m.sx + (hx - m.sx) * e, y = m.sy + (hy - m.sy) * e;
            const dx = x - m.sx, dy = y - m.sy, L = Math.hypot(dx, dy) || 1, tl = Math.min(190, L);
            const gr = g.createLinearGradient(x, y, x - dx / L * tl, y - dy / L * tl);
            gr.addColorStop(0, 'rgba(255,230,160,.95)'); gr.addColorStop(.4, 'rgba(255,150,50,.5)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
            g.strokeStyle = gr; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x - dx / L * tl, y - dy / L * tl); g.stroke();
            glow(g, x, y, 22, 1, [255, 190, 70]); glow(g, x, y, 10, 1, [255, 245, 220]);
          } else if (!m.hit) {
            m.hit = true; m.t0 = t; emberAt(parts, m.tx, m.ty, 8);
            if (!charred) { charred = true; setTimeout(() => { if (S.gen === gen && S.busy) c.classList.add('rx-fade', 'rx-char', S.kind); }, 250); }
          }
          if (m.hit) {   // flames spread over the text lines from the strike point for about 2.4 s
            const a = (t - m.t0) / 2.4;
            if (a < 1 && parts.length < 700) {
              const rx = 34 + r.width * 0.42 * eOut(a), ry = 26 + r.height * 0.5 * eOut(a), cnt = Math.round(dt * 240 * (1 - a * .7) * (r.width < 400 ? .75 : 1) + Math.random());
              const near = words.filter(w => Math.abs(w.x - m.tx) < rx && Math.abs(w.y - m.ty) < ry);
              for (let k = 0; k < cnt; k++) {
                let px, py;
                if (near.length && Math.random() < .85) { const w = near[(Math.random() * near.length) | 0]; px = w.l + Math.random() * (w.r - w.l); py = w.y + rnd(-4, 10); }
                else { const ang = rnd(0, 6.283), d = Math.sqrt(Math.random()); px = clamp(m.tx + Math.cos(ang) * rx * d, 4, r.width - 4); py = clamp(m.ty + Math.sin(ang) * ry * d, 6, r.height - 2); }
                flameAt(parts, px, py, rnd(16, 34));
                if (Math.random() < .05) emberAt(parts, px, py, 1); if (Math.random() < .03) smokeAt(parts, px, py - 10, 1);
              }
            }
          }
        });
        stepParts(g, parts, dt, r.left, r.top);
        return t > 1.2 && comets.every(m => m.hit && t - m.t0 > 2.4) && !parts.length;
      },
      end() { c.classList.add('rx-fade', 'rx-char', S.kind); setTimeout(() => cleanClass(c, 'rx-fade'), 1400); done(S, MODE.fire, MSG.fire); }
    };
  }

  // ---------------------------------------------------------------- 6. meteor shower: each impact is a small burst of real flame, and letters burn as they are knocked off
  function fxMeteor(S, c) {
    const items = collect(c), r0 = c.getBoundingClientRect(), D = [-.5, .866], TR = .34, RAD = 24;
    items.forEach(L => { L.st = 0; L.imp = -1; });
    const order = items.slice().sort(() => Math.random() - .5), imps = [];
    order.forEach(L => { if (L.imp >= 0) return; const k = imps.length; imps.push({ x: L.x, y: L.y }); items.forEach(M => { if (M.imp < 0 && Math.hypot(M.x - L.x, M.y - L.y) < RAD) M.imp = k; }); });
    const gap = Math.min(.09, 3.2 / Math.max(1, imps.length)); imps.forEach((p, k) => { p.t = .35 + k * gap; p.did = false; });
    const parts = []; const tEnd = (imps.length ? imps[imps.length - 1].t : 0) + 1.3, ORG = [255, 140, 30], CHAR = [38, 30, 26];
    return {
      card: c, hide: true,
      step(dt, r, g) {
        const t = this.t, ox = r.left, oy = r.top; let left = 0;
        imps.forEach((p, k) => {
          if (!p.did && t >= p.t) {
            p.did = true;
            for (let q = 0; q < 12 && parts.length < 600; q++) flameAt(parts, p.x + rnd(-RAD * .7, RAD * .7), p.y + rnd(-4, 8), rnd(11, 22), { v0: 40, v1: 110, l0: .4, l1: .6 });
            emberAt(parts, p.x, p.y, 6); smokeAt(parts, p.x, p.y - 4, 3);
            items.forEach(L => { if (L.imp === k) { flyL(L, { vx: D[0] * rnd(170, 330) + rnd(-50, 50), vy: D[1] * rnd(60, 200) - rnd(40, 120), vr: rnd(-10, 10), g: 800, life: rnd(.6, .95) }); L.st = 1; } });
          }
          const u = (t - (p.t - TR)) / TR; if (u > 0 && u < 1) {   // the meteor: a glowing streak with a long tail
            const hx = ox + p.x - D[0] * 330 * (1 - u), hy = oy + p.y - D[1] * 330 * (1 - u), tl = 120;
            const gr = g.createLinearGradient(hx, hy, hx - D[0] * tl, hy - D[1] * tl); gr.addColorStop(0, 'rgba(255,235,170,.95)'); gr.addColorStop(.4, 'rgba(255,150,40,.5)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
            g.strokeStyle = gr; g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx - D[0] * tl, hy - D[1] * tl); g.stroke(); glow(g, hx, hy, 13, 1, [255, 190, 70]); glow(g, hx, hy, 6, 1, [255, 245, 220]);
          }
        });
        for (const L of items) {
          if (L.st === 2) continue; left++;
          if (L.st === 0) put(g, L, ox + L.x, oy + L.y, 0, 1, 1, 1);
          else {
            if (stepFly(L, dt)) { L.st = 2; continue; }
            const u = L.age / L.life; if (Math.random() < .55 && parts.length < 600) flameAt(parts, L.x + rnd(-3, 3), L.y + 2, rnd(6, 11), { v0: 20, v1: 60, l0: .25, l1: .45 });
            put(g, L, ox + L.x, oy + L.y, L.rot, 1, 1, 1 - u * u, u < .35 ? mixc(L.fo.rgb, ORG, u / .35) : mixc(ORG, CHAR, clamp((u - .35) / .4, 0, 1)));
          }
        }
        stepParts(g, parts, dt, ox, oy);
        return (left === 0 && !parts.length && t > tEnd) || t > 9;
      },
      end() { gone(S, c); done(S, MODE.meteor, MSG.meteor); }
    };
  }

  // ---------------------------------------------------------------- happy effects (temporary, the text never moves)
  function hSparkle(S, c) {
    const cs = getComputedStyle(c), base = cs.boxShadow, rad = parseFloat(cs.borderTopLeftRadius) || 0, ps = [];
    const glowS = '0 0 26px 6px rgba(242,169,59,.55), 0 0 60px 14px rgba(255,222,140,.28)', none = '0 0 0 0 rgba(242,169,59,0)', mk = s => (base && base !== 'none' ? base + ', ' : '') + s;
    try { c.animate([{ boxShadow: mk(none), borderRadius: (rad || 14) + 'px' }, { boxShadow: mk(glowS), borderRadius: (rad || 14) + 'px', offset: .45 }, { boxShadow: mk(none), borderRadius: (rad || 14) + 'px' }], { duration: 1800, easing: 'ease-in-out' }); } catch (e) { }
    return {
      card: c,
      step(dt, r, g) {
        const t = this.t;
        if (t < 1.3) { const cnt = Math.round(dt * 52 + Math.random()); for (let k = 0; k < cnt; k++) ps.push({ x: rnd(-18, r.width + 18), y: rnd(r.height * .15, r.height + 10), vx: rnd(-12, 12), vy: -rnd(30, 85), life: rnd(.7, 1.2), age: 0, rr: rnd(1, 2.6), col: Math.random() < .6 ? GOLD : pick(), st: Math.random() < .5, tw: rnd(0, 6) }); }
        for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; p.age += dt; if (p.age >= p.life) { ps.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; const u = p.age / p.life; spark(g, r.left + p.x, r.top + p.y, p.rr, Math.min(1, u * 8, (1 - u) * 1.8) * (.6 + .4 * Math.sin(p.tw + p.age * 18)), p.col, p.st); }
        return (t > 1.3 && !ps.length) || t > 1.8;
      }
    };
  }
  function hFireworks(S, c, o) {
    o = o || {}; const r0 = c.getBoundingClientRect(), W = r0.width, H = r0.height, n = o.n || (W < 400 ? 3 : 4), BIG = o.big || 1, pal = [[GOLD, WHITE], [BLUE, WHITE], [VIOLET, GOLD], [WHITE, [255, 150, 200]]];
    const bursts = Array.from({ length: n }, (_, i) => ({ x: W * (i + rnd(.1, .9)) / n, y: rnd(-.28, .6) * H - 10, t0: i * (o.gap || .38) + rnd(0, .1), pal: pal[i % 4], ps: null }));
    return {
      card: c,
      step(dt, r, g) {
        const t = this.t;
        bursts.forEach(b => {
          const a = t - b.t0; if (a < 0) return;
          if (!b.ps) b.ps = Array.from({ length: 64 }, () => { const an = rnd(0, 6.283), sp = rnd(90, 230) * BIG; return { x: b.x, y: b.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, col: b.pal[Math.random() < .6 ? 0 : 1], rr: rnd(1.1, 2.1), life: rnd(.9, 1.35) }; });
          glow(g, r.left + b.x, r.top + b.y, 60 * Math.max(0, 1 - a * 4), 1, b.pal[0]);
          b.ps.forEach(p => { if (a > p.life) return; const u = a / p.life; for (let q = 0; q < 3; q++) { const aa = Math.max(0, a - q * .03), kk = Math.pow(.94, aa * 60); spark(g, r.left + b.x + p.vx * (1 - kk) / 3.6, r.top + b.y + p.vy * (1 - kk) / 3.6 + 90 * aa * aa, p.rr * (1 - q * .25), (1 - u) * (q ? .35 : 1) * (.7 + .3 * Math.sin(a * 40 + p.rr * 9)), p.col, q === 0 && p.rr > 1.8); } });
        });
        return t > (n - 1) * (o.gap || .38) + 1.5;
      }
    };
  }
  function hShooting(S, c, o) {
    o = o || {}; const r0 = c.getBoundingClientRect(), W = r0.width, H = r0.height, n = o.n || 5;
    const st = Array.from({ length: n }, (_, i) => { const lr = i % 2 === 0; return { t0: i * .26 + (o.t0 || 0), dur: .95, p0: { x: lr ? -50 : W + 50, y: rnd(-.15, .45) * H }, p1: { x: W * rnd(.3, .7), y: -rnd(.15, .5) * H - 30 }, p2: { x: lr ? W + 50 : -50, y: rnd(.4, 1) * H }, hist: [], trail: [] }; });
    const q = (a, b, c2, u) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c2;
    return {
      card: c,
      step(dt, r, g) {
        const t = this.t;
        st.forEach(s => {
          const u = (t - s.t0) / s.dur;
          if (u >= 0 && u <= 1.15) {
            const uu = clamp(u, 0, 1), x = q(s.p0.x, s.p1.x, s.p2.x, uu), y = q(s.p0.y, s.p1.y, s.p2.y, uu);
            if (u <= 1) { s.hist.push([x, y]); if (s.hist.length > 16) s.hist.shift(); if (Math.random() < .7) s.trail.push({ x: x + rnd(-3, 3), y: y + rnd(-3, 3), age: 0, life: rnd(.5, .9), rr: rnd(.8, 1.7), tw: rnd(0, 6) }); }
            else s.hist.shift();
            if (s.hist.length > 1) { const h0 = s.hist[s.hist.length - 1], hN = s.hist[0]; const gr = g.createLinearGradient(r.left + h0[0], r.top + h0[1], r.left + hN[0], r.top + hN[1]); gr.addColorStop(0, 'rgba(255,225,140,.95)'); gr.addColorStop(1, 'rgba(255,200,90,0)'); g.strokeStyle = gr; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); s.hist.forEach((p, i) => i ? g.lineTo(r.left + p[0], r.top + p[1]) : g.moveTo(r.left + p[0], r.top + p[1])); g.stroke(); }
            if (u <= 1) spark(g, r.left + x, r.top + y, 2.6, 1, WHITE, true);
          }
          for (let i = s.trail.length - 1; i >= 0; i--) { const p = s.trail[i]; p.age += dt; if (p.age >= p.life) { s.trail.splice(i, 1); continue; } const k = p.age / p.life; spark(g, r.left + p.x, r.top + p.y, p.rr, (1 - k) * (.5 + .5 * Math.sin(p.tw + p.age * 22)), Math.random() < .5 ? GOLD : AMBER, false); }
        });
        return t > n * .26 + (o.t0 || 0) + 1.5;
      }
    };
  }
  function hConstellation(S, c) {
    const r0 = c.getBoundingClientRect(), W = r0.width, H = r0.height, P = 2 * (W + H), n = W < 400 ? 7 : 9, stars = [];
    for (let i = 0; i < n; i++) { let s = (i + rnd(.15, .85)) / n * P, x, y; const off = rnd(6, 18);
      if (s < W) { x = s; y = -off; } else if ((s -= W) < H) { x = W + off; y = s; } else if ((s -= H) < W) { x = W - s; y = H + off; } else { s -= W; x = -off; y = H - s; }
      stars.push({ x, y, t: i * .13, col: i % 3 === 0 ? VIOLET : i % 3 === 1 ? GOLD : [120, 160, 255], tw: rnd(0, 6) }); }
    return {
      card: c,
      step(dt, r, g) {
        const t = this.t, fade = 1 - clamp((t - 1.65) / .55, 0, 1);
        g.save(); g.lineCap = 'round';
        for (let i = 0; i < n; i++) { const A = stars[i], B = stars[(i + 1) % n]; if (i === n - 1 && t < n * .13 + .35) continue; const u = clamp((t - A.t - .1) / .2, 0, 1); if (u <= 0) continue; g.strokeStyle = `rgba(110,130,225,${.75 * fade})`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(r.left + A.x, r.top + A.y); g.lineTo(r.left + lerp(A.x, B.x, u), r.top + lerp(A.y, B.y, u)); g.stroke(); }
        g.restore();
        stars.forEach(s => { const u = clamp((t - s.t) / .2, 0, 1); if (u > 0) spark(g, r.left + s.x, r.top + s.y, 2.4 * eOut(u), fade * (.75 + .25 * Math.sin(s.tw + t * 9)), s.col, true); });
        return t > 2.2;
      }
    };
  }
  function hAurora(S, c) {
    const r0 = c.getBoundingClientRect(), radius = parseFloat(getComputedStyle(c).borderTopLeftRadius) || 0, cols = [[70, 220, 150], [150, 110, 255], [255, 205, 110]];
    return {
      card: c,
      step(dt, r, g) {
        const t = this.t, u = clamp(t / 2.5, 0, 1), env = Math.pow(Math.sin(u * Math.PI), .7), W = r.width, H = r.height;
        g.save(); rrect(g, r.left, r.top, W, H, radius); g.clip();
        cols.forEach((col, k) => {
          const y0 = H * (.28 + .24 * k), amp = H * .12, th = H * (.26 + .06 * k);
          for (let layer = 0; layer < 3; layer++) {
            g.beginPath(); const top = [], bot = [];
            for (let x = 0; x <= W + 8; x += 8) { const y = y0 + Math.sin(x / (70 + 24 * k) + t * (1.5 + .35 * k) + k * 2) * amp + Math.sin(x / 33 - t * 2) * amp * .25; top.push([x, y - th * (.3 + layer * .35) * .5]); bot.push([x, y + th * (.3 + layer * .35) * .5]); }
            top.forEach((p, i) => i ? g.lineTo(r.left + p[0], r.top + p[1]) : g.moveTo(r.left + p[0], r.top + p[1])); for (let i = bot.length - 1; i >= 0; i--) g.lineTo(r.left + bot[i][0], r.top + bot[i][1]); g.closePath();
            g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${.085 * env})`; g.fill();
          }
        });
        g.restore();
        return t > 2.5;
      }
    };
  }

  // ---------------------------------------------------------------- Sad: rain from a small cloud, letters run down like ink and wash off the bottom
  function fxSad(S, c) {
    const items = collect(c), r0 = c.getBoundingClientRect(), W = r0.width, H = r0.height, SAD = [92, 112, 150], radius = parseFloat(getComputedStyle(c).borderTopLeftRadius) || 0;
    items.forEach(L => { L.t0 = .5 + rnd(0, 1.9) + (L.y / H) * .25; L.st = 0; });
    const drops = Array.from({ length: Math.round(clamp(W / 7, 24, 80)) }, () => ({ x: rnd(0, W), y: rnd(-H * .3, H), v: rnd(380, 560), len: rnd(8, 16) })), cloudX = W * rnd(.3, .7);
    return {
      card: c, hide: true,
      step(dt, r, g) {
        const t = this.t, ox = r.left, oy = r.top, ci = clamp(t / .7, 0, 1); let left = 0;
        g.save(); rrect(g, ox, oy, W, H, radius); g.clip();
        g.fillStyle = `rgba(110,130,165,${clamp((t - .3) / 2.4, 0, 1) * .13})`; g.fillRect(ox, oy, W, H);
        for (const L of items) {
          if (L.st === 1) continue; left++;
          let dy = 0, a = 1, sy = 1;
          if (t > L.t0) { const age = t - L.t0; dy = age * age * 420 + age * 30; sy = 1 + Math.min(1.4, dy / 50); a = 1 - clamp((L.y + dy - (H - 8)) / 40, 0, 1);
            if (L.y + dy > H + 30) { L.st = 1; continue; }
            g.strokeStyle = `rgba(92,112,150,${.38 * a})`; g.lineWidth = 1.3; g.beginPath(); g.moveTo(ox + L.x, oy + L.y + 2); g.lineTo(ox + L.x, oy + L.y + dy * .9); g.stroke(); }
          put(g, L, ox + L.x, oy + L.y + dy, 0, 1, sy, a, mixc(L.fo.rgb, SAD, ci));
        }
        if (t < 2.8) { g.strokeStyle = 'rgba(100,130,180,.5)'; g.lineWidth = 1.2; g.beginPath(); drops.forEach(d => { d.y += d.v * dt; if (d.y > H) d.y = rnd(-30, 0); g.moveTo(ox + d.x, oy + d.y); g.lineTo(ox + d.x - 1.5, oy + d.y - d.len); }); g.stroke(); }
        g.restore();
        const ca = Math.min(clamp(t / .3, 0, 1), 1 - clamp((t - 2.5) / .5, 0, 1)), cxp = ox + cloudX + Math.sin(t * .8) * 8, cyp = oy - 2;
        if (ca > 0) [[-22, 4, 17], [-6, -4, 22], [12, 0, 20], [28, 6, 14], [0, 8, 18]].forEach(b => glow(g, cxp + b[0], cyp + b[1], b[2] * 1.7, ca * .9, [120, 130, 148]));
        return left === 0 && t > 2.6;
      },
      end() { gone(S, c); c.classList.add('rx-wash'); done(S, 'sad', 'Text washed away by rain.'); }
    };
  }

  // ---------------------------------------------------------------- Worried: it trembles, dark fog rolls in from the edges, the text sinks into it
  function fxWorried(S, c) {
    const items = collect(c), r0 = c.getBoundingClientRect(), W = r0.width, H = r0.height, radius = parseFloat(getComputedStyle(c).borderTopLeftRadius) || 0, M = Math.max(W, H);
    const blobs = Array.from({ length: 16 }, (_, i) => { const a = i / 16 * 6.283 + rnd(-.2, .2), ex = W / 2 + Math.cos(a) * W * .62, ey = H / 2 + Math.sin(a) * H * .62; return { ex, ey, rad: clamp(M * rnd(.2, .36), 50, 130), ph: rnd(0, 6) }; });
    return {
      card: c, hide: true,
      step(dt, r, g) {
        const t = this.t, ox = r.left, oy = r.top, env = clamp(t / 2.2, 0, 1), sink = eIO(env);
        g.save(); rrect(g, ox, oy, W, H, radius); g.clip();
        for (const L of items) put(g, L, ox + L.x + rnd(-1, 1) * 1.5 * (.5 + env), oy + L.y + rnd(-1, 1) * 1.5 * (.5 + env) + 3 * sink, 0, 1, 1, 1 - .88 * sink);
        g.fillStyle = `rgba(90,95,105,${.16 * env})`; g.fillRect(ox, oy, W, H);
        const fa = env * .26 * (1 - clamp((t - 2.3) / .5, 0, 1));
        blobs.forEach(b => glow(g, ox + lerp(b.ex, W / 2, env * .7) + Math.sin(t * 1.6 + b.ph) * 8, oy + lerp(b.ey, H / 2, env * .7) + Math.cos(t * 1.3 + b.ph) * 6, b.rad, fa * 3, [55, 60, 72]));
        g.restore(); return t > 2.8;
      },
      end() { cleanClass(c, 'rx-gone'); c.classList.add('rx-faint', 'rx-haze', S.kind); done(S, 'worried', 'Text sank into fog.'); }
    };
  }

  // ---------------------------------------------------------------- Confused: letters lift, swap places and settle scrambled and tilted
  function confusedPlan(c) {
    const items = collect(c), r0 = c.getBoundingClientRect(), W = r0.width, H = r0.height, order = items.slice().sort((a, b) => a.ln - b.ln || a.x - b.x), slots = order.map(L => ({ x: L.x, y: L.y }));
    for (let i = 0; i < order.length; i += 9) { const n = Math.min(9, order.length - i), idx = Array.from({ length: n }, (_, k) => k).sort(() => Math.random() - .5); for (let j = 0; j < n; j++) { order[i + j].sx = slots[i + idx[j]].x; order[i + j].sy = slots[i + idx[j]].y; } }
    items.forEach(L => { L.tilt = rnd(-.16, .16); L.d0 = rnd(0, .45); L.arc = rnd(14, 34) * (Math.random() < .5 ? -1 : 1); });
    // the end state must survive scrolling with no running loop: the scrambled letters are painted once into a transparent image used as the block's background
    const d = Math.min(2, devicePixelRatio || 1), cvs = document.createElement('canvas'); cvs.width = Math.max(1, Math.ceil(W * d)); cvs.height = Math.max(1, Math.ceil(H * d));
    const g = cvs.getContext('2d'); g.scale(d, d); g.textAlign = 'center';
    items.forEach(L => { g.font = L.fo.font; g.fillStyle = L.fo.color; g.save(); g.translate(L.sx, L.sy); g.rotate(L.tilt); g.fillText(L.ch, 0, L.fo.by); g.restore(); });
    const url = cvs.toDataURL(); const img = new Image(); img.src = url;
    return { items, url, img, W, H };
  }
  function setBg(S, c, url) {
    if (S.cardStyle === undefined) S.cardStyle = c.getAttribute('style');
    c.style.backgroundImage = `url("${url}")`; c.style.backgroundSize = '100% 100%'; c.style.backgroundRepeat = 'no-repeat'; c.style.backgroundOrigin = 'border-box';
  }
  function fxConfused(S, c) {
    const P = confusedPlan(c), items = P.items, W = P.W, H = P.H, qs = Array.from({ length: 6 }, (_, i) => ({ x: rnd(.1, .9) * W, y: rnd(.3, .9) * H, t0: i * .25 + .2, ph: rnd(0, 6) }));
    return {
      card: c, hide: true,
      step(dt, r, g) {
        const t = this.t;
        for (const L of items) {
          const age = t - L.d0, p = eIO(clamp((age - .2) / 1.1, 0, 1)), lift = Math.sin(Math.PI * clamp(age / 1.5, 0, 1));
          put(g, L, r.left + lerp(L.x, L.sx, p), r.top + lerp(L.y, L.sy, p) + Math.sin(Math.PI * p) * L.arc - lift * 5, L.tilt * p, 1 + .35 * lift, 1 + .35 * lift, 1);
        }
        g.font = '700 22px system-ui,sans-serif'; curFo = null; g.fillStyle = 'rgb(124,92,214)';
        qs.forEach(q => { const a = t - q.t0; if (a < 0 || a > 1.5) return; g.globalAlpha = Math.sin(Math.PI * a / 1.5) * .85; g.fillText('?', r.left + q.x + Math.sin(a * 4 + q.ph) * 8, r.top + q.y - a * 46); }); g.globalAlpha = 1;
        return t > 2.1;
      },
      end() { setBg(S, c, P.url); gone(S, c); done(S, 'confused', 'Text scrambled.'); }
    };
  }

  // ---------------------------------------------------------------- Skeptical: a scanning line, words fade to ghosts, a few are struck through
  function fxSkeptic(S, c) {
    const items = collect(c), r0 = c.getBoundingClientRect(), W = r0.width, H = r0.height, radius = parseFloat(getComputedStyle(c).borderTopLeftRadius) || 0, groups = new Map();
    items.forEach(L => { const k = L.wid + ':' + L.ln; let q = groups.get(k); if (!q) { q = { l: L.l, r: L.r, y: L.y, n: 0 }; groups.set(k, q); } q.l = Math.min(q.l, L.l); q.r = Math.max(q.r, L.r); q.n++; });
    const strikes = Array.from(groups.values()).filter(q => q.r - q.l > 18 && Math.random() < .08).map(q => { q.tf = (q.y / H) * 2.4 + .1; return q; });
    return {
      card: c, hide: true,
      step(dt, r, g) {
        const t = this.t, ox = r.left, oy = r.top, ly = -8 + (H + 16) * clamp(t / 2.4, 0, 1), fadeOut = 1 - clamp((t - 2.6) / .4, 0, 1);
        g.save(); rrect(g, ox, oy, W, H, radius); g.clip();
        for (const L of items) put(g, L, ox + L.x, oy + L.y, 0, 1, 1, 1 - .82 * clamp((t - ((L.y / H) * 2.4 + (L.x / W) * .12)) / .35, 0, 1));
        g.lineCap = 'round'; strikes.forEach(q => { const p = clamp((t - q.tf) / .3, 0, 1); if (p <= 0) return; g.strokeStyle = `rgba(170,60,70,${.75 * fadeOut})`; g.lineWidth = 1.5; g.beginPath(); for (let x = 0; x <= (q.r - q.l) * p; x += 3) { const px = ox + q.l + x, py = oy + q.y + 1 + Math.sin(x * .9) * 1.2; x ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); });
        if (t < 2.6) { const gr = g.createLinearGradient(0, oy + ly - 14, 0, oy + ly + 14); gr.addColorStop(0, 'rgba(110,120,235,0)'); gr.addColorStop(.5, 'rgba(110,120,235,.28)'); gr.addColorStop(1, 'rgba(110,120,235,0)'); g.fillStyle = gr; g.fillRect(ox, oy + ly - 14, W, 28); g.fillStyle = 'rgba(110,120,235,.85)'; g.fillRect(ox, oy + ly - .8, W, 1.6); }
        g.restore(); return t > 3.0;
      },
      end() { cleanClass(c, 'rx-gone'); c.classList.add('rx-ghost', S.kind); done(S, 'skeptical', 'Text faded to a ghost.'); }
    };
  }

  // ---------------------------------------------------------------- Mind blown: a flash, a shockwave, every letter blasted outward with glowing trails
  function fxBlown(S, c) {
    const items = collect(c), r0 = c.getBoundingClientRect(), W = r0.width, H = r0.height, CX = W / 2, CY = H / 2, M = Math.max(W, H);
    items.forEach(L => { const dx = L.x - CX, dy = L.y - CY, d = Math.hypot(dx, dy) || 1; L.dx = dx / d; L.dy = dy / d; L.t0 = .18 + d / 1600 + rnd(0, .05); L.sp = rnd(520, 900); L.vr = rnd(-14, 14); L.st = 0; if (d < 2) { const a = rnd(0, 6.283); L.dx = Math.cos(a); L.dy = Math.sin(a); } });
    return {
      card: c, hide: true,
      step(dt, r, g) {
        const t = this.t, X = r.left + CX, Y = r.top + CY; let left = 0;
        for (const L of items) {
          if (L.st === 1) continue; left++;
          const age = t - L.t0; if (age < 0) { put(g, L, r.left + L.x + rnd(-.8, .8), r.top + L.y + rnd(-.8, .8), 0, 1, 1, 1); continue; }
          if (age > 1.7) { L.st = 1; continue; }
          const al = 1 - clamp((age - .9) / .7, 0, 1);
          for (let k = 3; k >= 0; k--) { const a2 = Math.max(0, age - k * .035), s = L.sp * a2 + 700 * a2 * a2, X2 = r.left + L.x + L.dx * s, Y2 = r.top + L.y + L.dy * s;
            if (k) { glow(g, X2, Y2, 9 - k * 1.5, al * .35 / k * 2, k % 2 ? [150, 110, 255] : [255, 200, 100]); put(g, L, X2, Y2, L.vr * a2, 1 + a2, 1 + a2, al * .22 / k); } else put(g, L, X2, Y2, L.vr * a2, 1 + age * 1.1, 1 + age * 1.1, al); }
        }
        if (t < .55) { const u = t / .55; glow(g, X, Y, 70 + 150 * u, (1 - u) * 1.2, [255, 225, 150]); glow(g, X, Y, 40 + 60 * u, 1 - u, [255, 255, 255]); }
        if (t < 1.3) { const u = t / 1.3; g.strokeStyle = `rgba(140,100,255,${.7 * (1 - u)})`; g.lineWidth = 4 * (1 - u) + 1; g.beginPath(); g.arc(X, Y, eOut(u) * M * 1.05, 0, 6.283); g.stroke(); g.strokeStyle = `rgba(255,190,80,${.55 * (1 - u)})`; g.lineWidth = 2; g.beginPath(); g.arc(X, Y, eOut(u) * M * .93, 0, 6.283); g.stroke(); }
        return left === 0 && t > 1.4;
      },
      end() { gone(S, c); done(S, 'mind blown', 'Text blasted away.'); }
    };
  }

  // ---------------------------------------------------------------- temporary emotions (about 2 to 2.5 s, the text never moves, nothing persists)
  function tCurious(S, c) {
    const words = collect(c, 0), r0 = c.getBoundingClientRect(), pool = words.slice().sort(() => Math.random() - .5), pts = [];
    for (const w of pool) { if (pts.length >= 8) break; if (pts.every(p => Math.hypot(p.x - w.x, p.y - w.y) > 55)) pts.push({ x: w.x, y: w.y - 3, t: pts.length * .17, tw: rnd(0, 6), col: pts.length % 2 ? GOLD : [120, 160, 255] }); }
    return {
      card: c,
      step(dt, r, g) {
        const t = this.t, fade = 1 - clamp((t - 1.8) / .5, 0, 1); g.lineCap = 'round';
        for (let i = 0; i + 1 < pts.length; i++) { const A = pts[i], B = pts[i + 1], u = clamp((t - B.t) / .22, 0, 1); if (u <= 0) continue; g.strokeStyle = `rgba(110,140,225,${.7 * fade})`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(r.left + A.x, r.top + A.y); g.lineTo(r.left + lerp(A.x, B.x, u), r.top + lerp(A.y, B.y, u)); g.stroke(); }
        pts.forEach(p => { const u = clamp((t - p.t) / .25, 0, 1); if (u > 0) spark(g, r.left + p.x, r.top + p.y, 3.6 * eOut(u), fade * (.75 + .25 * Math.sin(p.tw + t * 8)), p.col, true); });
        return t > 2.4;
      }
    };
  }
  function tAmazed(S, c) {
    const au = hAurora(S, c), r0 = c.getBoundingClientRect(), W = r0.width, H = r0.height, st = Array.from({ length: 12 }, () => ({ x: rnd(-.1, 1) * W, t0: rnd(0, 1.5), v: rnd(260, 380), hist: [] }));
    return {
      card: c,
      step(dt, r, g) {
        au.t = this.t; au.step.call(au, dt, r, g); const t = this.t;
        st.forEach(s => { const a = t - s.t0; if (a < 0 || a > 1.1) return; const x = s.x + a * 120, y = -30 + a * s.v, al = 1 - Math.pow(a / 1.1, 3); if (y < -30 || y > H + 20) return;
          const gr = g.createLinearGradient(r.left + x, r.top + y, r.left + x - 40, r.top + y - 60); gr.addColorStop(0, `rgba(255,225,140,${al})`); gr.addColorStop(1, 'rgba(255,200,90,0)'); g.strokeStyle = gr; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(r.left + x, r.top + y); g.lineTo(r.left + x - 40, r.top + y - 60); g.stroke(); spark(g, r.left + x, r.top + y, 2.2, al, WHITE, true); });
        return t > 2.5;
      }
    };
  }
  function tGrateful(S, c) {
    const r0 = c.getBoundingClientRect(), W = r0.width, H = r0.height, radius = parseFloat(getComputedStyle(c).borderTopLeftRadius) || 0;
    const ms = Array.from({ length: 28 }, () => ({ x: rnd(0, W), y: H * rnd(.55, 1.05), vy: -rnd(22, 55), t0: rnd(0, .8), ph: rnd(0, 6), lan: Math.random() < .35, sz: rnd(9, 16) }));
    return {
      card: c,
      step(dt, r, g) {
        const t = this.t, env = Math.sin(Math.PI * clamp(t / 2.5, 0, 1));
        g.save(); rrect(g, r.left, r.top, r.width, r.height, radius); g.clip(); const gr = g.createRadialGradient(r.left + r.width / 2, r.top + r.height, 0, r.left + r.width / 2, r.top + r.height, Math.max(r.width, r.height) * .9); gr.addColorStop(0, `rgba(255,190,100,${.3 * env})`); gr.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gr; g.fillRect(r.left, r.top, r.width, r.height); g.restore();
        ms.forEach(m => { const a = t - m.t0; if (a < 0) return; const x = r.left + m.x + Math.sin(a * 1.6 + m.ph) * 10, y = r.top + m.y + m.vy * a, al = Math.min(1, a * 3, (2.5 - t) * 1.6); if (al <= 0) return;
          glow(g, x, y, m.sz * 1.8, al * .8, [255, 180, 80]); if (m.lan) { g.globalAlpha = al; g.fillStyle = 'rgba(255,190,90,.95)'; rrect(g, x - 3, y - 4, 6, 8, 2); g.fill(); g.globalAlpha = 1; } glow(g, x, y, 4, al, [255, 240, 190]); });
        return t > 2.5;
      }
    };
  }
  function tHopeful(S, c) {
    const r0 = c.getBoundingClientRect(), W = r0.width, H = r0.height, radius = parseFloat(getComputedStyle(c).borderTopLeftRadius) || 0, ps = [];
    return {
      card: c,
      step(dt, r, g) {
        const t = this.t, env = Math.sin(Math.PI * clamp(t / 2.5, 0, 1)), h = r.height * eOut(clamp(t / 1.5, 0, 1));
        g.save(); rrect(g, r.left, r.top, r.width, r.height, radius); g.clip();
        const gr = g.createLinearGradient(0, r.bottom, 0, r.bottom - h * 1.1); gr.addColorStop(0, `rgba(255,176,70,${.55 * env})`); gr.addColorStop(.5, `rgba(255,214,140,${.25 * env})`); gr.addColorStop(1, 'rgba(255,230,170,0)'); g.fillStyle = gr; g.fillRect(r.left, r.bottom - h * 1.1, r.width, h * 1.1);
        glow(g, r.left + r.width / 2, r.bottom - h * .35, Math.max(r.width, r.height) * .45 * eOut(clamp(t / 1.2, 0, 1)), env * 1.3, [255, 200, 100]); g.restore();
        if (t < 1.8) for (let k = Math.round(dt * 40 + Math.random()); k > 0; k--) ps.push({ x: rnd(0, W), y: H + 4, vy: -rnd(50, 120), age: 0, life: rnd(.8, 1.4), rr: rnd(1, 2.4), tw: rnd(0, 6), st: Math.random() < .5 });
        for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; p.age += dt; if (p.age >= p.life) { ps.splice(i, 1); continue; } p.y += p.vy * dt; const u = p.age / p.life; spark(g, r.left + p.x, r.top + p.y, p.rr, Math.min(1, u * 8, (1 - u) * 1.8) * (.6 + .4 * Math.sin(p.tw + p.age * 16)), GOLD, p.st); }
        return t > 2.5 && !ps.length || t > 3;
      }
    };
  }
  function tExcited(S, c) {
    const f = hFireworks(S, c, { n: 6, big: 1.3, gap: .28 }), s = hShooting(S, c, { n: 2, t0: .15 });
    return { card: c, step(dt, r, g) { f.t = s.t = this.t; const a = f.step.call(f, dt, r, g), b = s.step.call(s, dt, r, g); return a && b; } };
  }
  function tInspired(S, c) {
    const r0 = c.getBoundingClientRect(), W = r0.width, H = r0.height, burst = [];
    return {
      card: c,
      step(dt, r, g) {
        const t = this.t, e = eOut(clamp(t / 1.5, 0, 1)), cx0 = r.left + r.width / 2, cy0 = r.top + r.height / 2, rise = r.height * .5 + 70, fade = 1 - clamp((t - 2) / .4, 0, 1);
        for (let s = 0; s < 2; s++) for (let j = 0; j < 36; j++) { const hh = j / 36 * e, an = hh * 10 + t * 5 + s * Math.PI, R = 14 + 12 * hh, x = cx0 + Math.cos(an) * R, y = cy0 - hh * rise + Math.sin(an) * R * .25; spark(g, x, y, 1 + 1.2 * (j / 36), fade * (.25 + .75 * j / 36) * (.7 + .3 * Math.sin(t * 9 + j)), s ? GOLD : [170, 140, 255], j % 9 === 0); }
        if (t > 1.5 && !burst.length && !this.b) { this.b = 1; for (let k = 0; k < 30; k++) { const a = rnd(0, 6.283), sp = rnd(30, 90); burst.push({ x: cx0 - r.left, y: cy0 - rise - r.top, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: rnd(.6, 1), rr: rnd(1, 2.2), col: pick() }); } }
        for (let i = burst.length - 1; i >= 0; i--) { const p = burst[i]; p.age += dt; if (p.age >= p.life) { burst.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.vy *= .97; const u = p.age / p.life; spark(g, r.left + p.x, r.top + p.y, p.rr, 1 - u, p.col, true); }
        return t > 2.4 && !burst.length || t > 3.2;
      }
    };
  }
  function tCalm(S, c) {
    const r0 = c.getBoundingClientRect(), W = r0.width, H = r0.height, ss = Array.from({ length: 8 }, () => ({ x: rnd(0, W), y: rnd(0, H), ph: rnd(0, 6), col: Math.random() < .5 ? GOLD : ICE }));
    return {
      card: c,
      step(dt, r, g) {
        const t = this.t, X = r.left + r.width / 2, Y = r.top + r.height / 2, M = Math.max(r.width, r.height) * .55, env = 1 - clamp((t - 2.1) / .4, 0, 1);
        for (let k = 0; k < 4; k++) { const a = t - k * .5; if (a < 0 || a > 1.8) continue; const u = a / 1.8; g.strokeStyle = `rgba(110,170,235,${.6 * (1 - u) * env})`; g.lineWidth = 3 * (1 - u) + .8; g.beginPath(); g.arc(X, Y, eOut(u) * M, 0, 6.283); g.stroke(); g.strokeStyle = `rgba(255,214,150,${.2 * (1 - u) * env})`; g.lineWidth = 6 * (1 - u); g.beginPath(); g.arc(X, Y, eOut(u) * M * .96, 0, 6.283); g.stroke(); }
        glow(g, X, Y, M * .7 * eOut(clamp(t / 1.2, 0, 1)), .35 * env, [150, 200, 240]);
        ss.forEach(s => spark(g, r.left + s.x, r.top + s.y - t * 8, 2.4, env * (.35 + .35 * Math.sin(s.ph + t * 2.2)), s.col, true));
        return t > 2.5;
      }
    };
  }

  // ---------------------------------------------------------------- reset: sparkles come and fix every affected block
  function fxResetMulti(els, per) {
    const ps = els.map(el => ({ el, list: Array.from({ length: per }, () => ({ x: rnd(0, 1), y: rnd(.1, 1.1), d: rnd(0, .6), life: rnd(.7, 1), vy: -rnd(20, 60), vx: rnd(-20, 20), rr: rnd(1, 2.3), col: pick(), st: Math.random() < .4, age: 0 })) }));
    return {
      card: els[0],
      step(dt, r0, g) {
        const t = this.t;
        ps.forEach(b => { const r = b.el.getBoundingClientRect(); b.list.forEach(p => { if (t < p.d) return; p.age += dt; p.x += p.vx * dt / Math.max(1, r.width); p.y += p.vy * dt / Math.max(1, r.height); const u = clamp(p.age / p.life, 0, 1); spark(g, r.left + p.x * r.width, r.top + p.y * r.height, p.rr * 1.1, Math.sin(u * Math.PI) * (.75 + .25 * Math.sin(p.age * 16)), p.col, p.st); }); });
        return t > 1.5;
      },
      end() { setTimeout(() => els.forEach(el => cleanClass(el, 'rx-fade')), 0); }
    };
  }
  function restoreInstant(el) {
    const S = store.get(el), ai = anims.findIndex(a => a.card === el); if (ai >= 0) anims.splice(ai, 1);
    if (S) { S.gen = (S.gen || 0) + 1; if (S.cardStyle !== undefined) putStyle([[el, S.cardStyle]]); store.delete(el); }
    cleanClass(el, ...STATE_CLS);
  }
  function resetNow(el) { if (el) restoreInstant(el); else Array.from(store.keys()).forEach(restoreInstant); refreshReset(); }
  const inView = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  function resetAll() {
    if (!store.size) { say('Nothing to reset.'); return; }
    Array.from(store.entries()).forEach(([el, S]) => { if (S.busy) restoreInstant(el); });
    const vis = [], reduce = rm();
    Array.from(store.entries()).forEach(([el, S]) => { if (reduce || !inView(el)) restoreInstant(el); else vis.push([el, S]); });
    if (vis.length) {
      const per = Math.min(40, Math.floor(160 / vis.length));
      vis.forEach(([el, S]) => { el.classList.add('rx-fade'); cleanClass(el, ...STATE_CLS.filter(x => x !== 'rx-fade')); if (S.cardStyle !== undefined) putStyle([[el, S.cardStyle]]); store.delete(el); });
      const a = fxResetMulti(vis.map(v => v[0]), per); start(a);
    }
    say('Everything restored.'); refreshReset();
  }

  // ---------------------------------------------------------------- choosing the block that reacts
  const CARDSEL = '.card,[data-react]', TEXTSEL = 'p,li,h2,h3,blockquote';
  const EXC = 'header,footer,nav,section.nextup,form,.site-head,.site-foot,.rx-bar,.hmr-track,.hmr-pop,[data-hmr],button,[hidden],.fxd-pill,.fxd-panel', BLOCKED = 'canvas,input,select,textarea,video,iframe';
  function pickTarget() {
    const h = document.querySelector('.site-head'), hb = h ? Math.max(0, h.getBoundingClientRect().bottom) : 0, vh = innerHeight, vw = innerWidth, cyS = (hb + vh) / 2;
    const cards = Array.from(document.querySelectorAll(CARDSEL)), texts = Array.from(document.querySelectorAll(TEXTSEL)).filter(e => !e.closest(CARDSEL)), keys = Array.from(store.keys());
    const test = (el, isCard) => {
      if (el.closest(EXC) || el.querySelector(BLOCKED)) return null;
      const r = el.getBoundingClientRect(); if (r.width < 60 || r.height < 18 || r.height > 1.3 * vh || r.right < 0 || r.left > vw) return null;
      if (Math.min(r.bottom, vh) - Math.max(r.top, hb) < Math.min(60, r.height * .6)) return null;
      if ((el.textContent || '').replace(/\s+/g, ' ').trim().length < 12) return null;
      if (keys.some(k => k === el || k.contains(el) || el.contains(k))) return null;
      if (isCard ? el.querySelector(CARDSEL) : el.querySelector(TEXTSEL)) return null;
      return Math.abs((Math.max(r.top, hb) + Math.min(r.bottom, vh)) / 2 - cyS) + .35 * Math.abs((r.left + r.right) / 2 - vw / 2);
    };
    let best = null;
    cards.forEach((el, i) => { const d = test(el, true); if (d != null && (!best || d < best.d)) best = { el, d, idx: i }; });
    if (!best) texts.forEach((el, i) => { const d = test(el, false); if (d != null && (!best || d < best.d)) best = { el, d, idx: i }; });
    return best;
  }

  // ---------------------------------------------------------------- pressing an emotion
  const MADFX = { fire: fxFire, tornado: fxTornado, hole: fxHole, quake: fxQuake, lightning: fxLightning, meteor: fxMeteor };
  const HAPFX = { sparkle: hSparkle, fireworks: hFireworks, shooting: hShooting, constellation: hConstellation, aurora: hAurora };
  const PFX = { 'Sad': fxSad, 'Worried': fxWorried, 'Confused': fxConfused, 'Skeptical': fxSkeptic, 'Mind blown': fxBlown };
  const TFX = { 'Curious': tCurious, 'Amazed': tAmazed, 'Grateful': tGrateful, 'Hopeful': tHopeful, 'Excited': tExcited, 'Inspired': tInspired, 'Calm': tCalm };
  const OUTLINE = { Happy: '#F2A93B', Curious: '#5B9BE6', Amazed: '#8E7CFF', Grateful: '#F2A93B', Hopeful: '#FFB347', Excited: '#E8499A', Inspired: '#9B7BFF', Calm: '#6FC7C0' };
  function instant(S, el, name, fx) {
    if (!PERSIST[name]) { try { const o = '3px solid ' + OUTLINE[name]; el.animate([{ outline: o, outlineOffset: '-3px' }, { outline: o, outlineOffset: '-3px' }], { duration: 1000 }); } catch (e) { } store.delete(el); S.busy = false; say(name + '.'); refreshReset(); return; }
    const k = S.kind;
    if (name === 'Mad') { if (fx === 'fire') el.classList.add('rx-char', k); else el.classList.add('rx-gone', k); S.mode = MODE[fx]; }
    else if (name === 'Sad') { el.classList.add('rx-gone', 'rx-wash', k); S.mode = 'sad'; }
    else if (name === 'Worried') { el.classList.add('rx-faint', 'rx-haze', k); S.mode = 'worried'; }
    else if (name === 'Skeptical') { el.classList.add('rx-ghost', k); S.mode = 'skeptical'; }
    else if (name === 'Confused') { setBg(S, el, confusedPlan(el).url); el.classList.add('rx-gone', k); S.mode = 'confused'; }
    else { el.classList.add('rx-gone', k); S.mode = 'mind blown'; }
    S.busy = false; say(name + '. Press Reset to restore.'); refreshReset();
  }
  function press(name) {
    if (name === 'Reset') { resetAll(); return; }
    if (!EMO.some(e => e[0] === name)) return;
    if (anims.filter(a => a.emo).length >= 3) { say('Still reacting. Try again in a moment.'); return; }
    const tg = pickTarget(); if (!tg) { say('Nothing on screen to react to.'); return; }
    const el = tg.el, S = { el, kind: isLeaf(el) ? 'rx-l' : 'rx-k', mode: null, busy: true, name, idx: tg.idx, gen: 0 };
    const fx = name === 'Mad' ? MAD[tg.idx % MAD.length] : name === 'Happy' ? HAPPY[tg.idx % HAPPY.length] : name.toLowerCase();
    S.fx = fx; store.set(el, S); refreshReset();
    if (rm()) { instant(S, el, name, fx); return; }
    const a = (name === 'Mad' ? MADFX[fx] : name === 'Happy' ? HAPFX[fx] : (PFX[name] || TFX[name]))(S, el); a.emo = true;
    if (!PERSIST[name]) a.end = () => { store.delete(el); S.busy = false; refreshReset(); };
    start(a); say(name + '.');
  }

  // ---------------------------------------------------------------- the floating bar
  const bar = document.createElement('div'); bar.className = 'rx-bar'; bar.setAttribute('data-hmr', '');
  const narrow = innerWidth < 900, key = 'hmr-react-open-' + (narrow ? 'n' : 'w');
  let open = !(narrow || /(^|\/)(fun|simulation)(\.html)?$/.test(location.pathname));
  try { const v = localStorage.getItem(key); if (v === '1' || v === '0') open = v === '1'; } catch (e) { }
  bar.innerHTML = '<button type="button" class="rx-pill" aria-expanded="false" aria-controls="rx-panel"><span class="e" aria-hidden="true">😊</span>React</button>' +
    '<div class="rx-panel" id="rx-panel" role="group" aria-label="Reactions"><div class="rx-hd"><span>How does this make you feel?</span><button type="button" class="rx-min" aria-expanded="true" aria-controls="rx-panel" aria-label="Collapse reactions">▾</button></div><div class="rx-grid">' +
    EMO.map(e => `<button type="button" class="rx-chip" data-e="${e[0]}"><span class="e" aria-hidden="true">${e[1]}</span>${e[0]}</button>`).join('') +
    '<button type="button" class="rx-chip rx-reset" aria-disabled="true">Reset</button></div></div>';
  bar.appendChild(live);
  const pill = bar.querySelector('.rx-pill'), min = bar.querySelector('.rx-min'), resetBtn = bar.querySelector('.rx-reset');
  function setOpen(o, save) { open = o; bar.setAttribute('data-open', o ? '1' : '0'); pill.setAttribute('aria-expanded', o ? 'true' : 'false'); min.setAttribute('aria-expanded', o ? 'true' : 'false'); if (save) { try { localStorage.setItem(key, o ? '1' : '0'); } catch (e) { } } }
  function refreshReset() { resetBtn.setAttribute('aria-disabled', store.size ? 'false' : 'true'); }
  setOpen(open, false);
  pill.addEventListener('click', () => { setOpen(true, true); const f = bar.querySelector('.rx-chip'); if (f) f.focus({ preventScroll: true }); });
  min.addEventListener('click', () => { setOpen(false, true); pill.focus({ preventScroll: true }); });
  bar.addEventListener('click', ev => { const b = ev.target.closest('.rx-chip'); if (!b) return; press(b.classList.contains('rx-reset') ? 'Reset' : b.getAttribute('data-e')); });
  document.body.appendChild(bar);
  addEventListener('pagehide', () => { anims.length = 0; });

  window.hmrReact = {
    emotions: EMO.map(e => e[0]), target: () => { const t = pickTarget(); return t ? t.el : null; }, press, resetNow,
    state: el => { const S = store.get(el); return S ? (S.busy ? 'busy:' : '') + (S.mode || 'running') : 'ready'; },
    effect: el => { const S = store.get(el); return S ? S.fx : null; }
  };
})();
