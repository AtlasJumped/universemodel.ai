// reactions: a "Mad" button (six effects, one fixed effect per card) and a "Happy" button (five short effects, one fixed per card)
// nothing here changes layout: every effect is drawn on one fixed overlay canvas under the header. For the mad effects that move
// letters, the card's text is measured (never wrapped or split in the DOM), hidden with a class, and drawn on the canvas.
// Everything added to a card (classes, one inline style for the lightning scorch) is removed again on Reset.
(function () {
  'use strict';
  if (window.hmrReact) return;
  const cards = Array.from(document.querySelectorAll('[data-react]')).filter(e => !e.closest('section.nextup,header,footer,.site-head,.site-foot,form'));
  if (!cards.length) { window.hmrReact = { n: 0, state: () => null, effect: () => null }; return; }

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
    fire: 'Text burned. Press Reset to bring it back.', tornado: 'Text carried away by tornadoes. Press Reset to bring it back.',
    hole: 'Text pulled into a black hole. Press Reset to bring it back.', quake: 'Text shaken loose and fallen. Press Reset to bring it back.',
    lightning: 'Text shattered by lightning. Press Reset to bring it back.', meteor: 'Text knocked off by meteors. Press Reset to bring it back.'
  };

  // ---------------------------------------------------------------- styles
  const css = document.createElement('style');
  css.textContent = `
.hmr-row{display:flex;justify-content:flex-end;align-items:center;margin-top:auto;padding-top:10px;grid-column:1/-1;flex:0 0 auto;width:100%;box-sizing:border-box;position:relative;z-index:1}
.hmr-btn{font:600 13px/1 var(--font,system-ui,sans-serif);min-height:32px;min-width:64px;padding:0 16px;border:0;border-radius:999px;cursor:pointer;box-shadow:0 1px 4px rgba(14,58,117,.22);-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.hmr-btn.mad{background:#C62828;color:#fff}
.hmr-btn.happy{background:#F2A93B;color:#0E2A55}
.hmr-btn.reset{background:#fff;color:#C62828;box-shadow:0 0 0 2px #C62828}
.hmr-btn:hover{filter:brightness(1.07)}
.hmr-btn:focus-visible{outline:2px solid #fff;outline-offset:0;box-shadow:0 0 0 4px #0E3A75}
.hmr-btn[aria-disabled="true"]{opacity:.6;cursor:default;filter:none}
.hmr-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.hmr-fade,.hmr-fade *{transition:background-color 1.2s ease,border-color 1.2s ease,color 1.2s ease,opacity 1.2s ease,text-shadow 1.2s ease}
.hmr-char{background-color:#2a2420!important;border-color:#1a1613!important}
.hmr-char>:not(.hmr-row){opacity:.55;text-shadow:0 0 2px #000,1px 1px 3px rgba(0,0,0,.85)}
.hmr-char>:not(.hmr-row),.hmr-char>:not(.hmr-row) *{color:#0b0b0b!important;background-color:transparent!important;border-color:#0b0b0b!important}
.hmr-char>.hmr-row .hmr-btn.reset{background:#fff;color:#C62828}
.hmr-gone>:not(.hmr-row){opacity:0!important}`;
  document.head.appendChild(css);

  // ---------------------------------------------------------------- overlay canvas and the one loop
  let cv = null, cx = null, DPR = 1, VW = 0, VH = 0, curFo = null;
  const anims = []; let raf = 0, last = 0;
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
      cx.globalAlpha = 1;
      if (a.hide && !a.hid) { a.hid = 1; a.card.classList.add('hmr-gone'); }   // the real text goes the moment its canvas copy is drawn
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
  const FIRE = { y: [255, 236, 150], o: [255, 140, 30], r: [210, 55, 20] };
  function rrect(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }

  // ---------------------------------------------------------------- measuring the card's text (nothing in the DOM changes)
  // returns letters, or words broken at line ends when there would be more than `cap` letters
  function collect(c, cap) {
    ensureCanvas();
    const cr = c.getBoundingClientRect(), out = [], fos = new Map(), rg = document.createRange();
    const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT, { acceptNode: n => (!/\S/.test(n.nodeValue) || !n.parentElement || n.parentElement.closest('.hmr-row,script,style,svg,noscript')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let n, wid = 0;
    while ((n = w.nextNode())) {
      const p = n.parentElement; let fo = fos.get(p);
      if (!fo) {
        const cs = getComputedStyle(p); fo = { font: cs.font || `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, color: cs.color, up: cs.textTransform === 'uppercase', by: 0 };
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
  function put(g, L, X, Y, rot, sx, sy, a) {   // X, Y: center on screen
    if (a <= .01) return;
    if (curFo !== L.fo) { g.font = L.fo.font; curFo = L.fo; }
    g.globalAlpha = Math.min(1, a); g.fillStyle = L.fo.color;
    if (!rot && sx === 1 && sy === 1) g.fillText(L.ch, X, Y + L.fo.by);
    else { g.save(); g.translate(X, Y); g.rotate(rot); g.scale(sx, sy); g.fillText(L.ch, 0, L.fo.by); g.restore(); }
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- state of a card
  const store = new Map();   // card -> {kind, fx, mode, busy, btn, live, cardStyle}
  const kids = c => Array.from(c.children).filter(k => !k.classList.contains('hmr-row'));
  function putStyle(list) { const f = () => list.forEach(([k, s]) => { if (s === null) { if (k.hasAttribute('style')) k.removeAttribute('style'); } else if (k.getAttribute('style') !== s) k.setAttribute('style', s); }); f(); requestAnimationFrame(f); setTimeout(f, 120); setTimeout(f, 700); }
  function cleanClass(c, ...n) { c.classList.remove(...n); if (!c.getAttribute('class')) c.removeAttribute('class'); }
  function say(S, t) { S.live.textContent = ''; setTimeout(() => { S.live.textContent = t; }, 30); }
  function setBtn(S, label, cls) { S.btn.textContent = label; S.btn.className = 'hmr-btn ' + cls; }
  function busy(S, b) { S.busy = b; S.btn.setAttribute('aria-disabled', b ? 'true' : 'false'); }
  function done(S, mode, msg) {
    S.mode = mode; busy(S, false);
    setBtn(S, mode === 'ready' ? (S.kind === 'mad' ? 'Mad' : 'Happy') : 'Reset', mode === 'ready' ? S.kind : 'reset');
    if (msg) say(S, msg);
  }
  // a letter that has been knocked loose and flies free: {x,y,vx,vy,rot,vr,age,life,g}
  function flyL(L, o) { Object.assign(L, o, { fly: 1, age: 0, rot: L.rot || 0 }); }
  function stepFly(L, dt) { L.age += dt; L.vy += L.g * dt; L.x += L.vx * dt; L.y += L.vy * dt; L.rot += L.vr * dt; return L.age >= L.life; }

  // ---------------------------------------------------------------- 1. comets and fire (ends charred)
  function fxFire(S, c) {
    const W0 = c.getBoundingClientRect(), n = 3 + Math.floor(Math.random() * 3), pts = [];
    const ys = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - .5);
    for (let i = 0; i < n; i++) pts.push({ x: W0.width * (0.14 + 0.72 * (i + rnd(.1, .9)) / n), y: W0.height * (0.2 + 0.62 * (ys[i] + rnd(.1, .9)) / n) });
    const words = collect(c, 0);   // cap 0: always words; flames start on the text lines
    const comets = pts.map((p, i) => ({ tx: p.x, ty: p.y, sx: i % 2 ? VW + 30 : -30, sy: -40, delay: i * 0.24, dur: rnd(.5, .7), hit: false }));
    const flames = []; let charred = false; const gen = S.gen = (S.gen || 0) + 1;
    return {
      card: c,
      step(dt, r, g) {
        const t = this.t;
        g.save(); g.globalCompositeOperation = 'lighter';
        comets.forEach(m => {
          const u = (t - m.delay) / m.dur; if (u < 0) return;
          const hx = r.left + m.tx, hy = r.top + m.ty;
          if (u < 1) {
            const e = eIn(clamp(u, 0, 1)) * .75 + u * .25, x = m.sx + (hx - m.sx) * e, y = m.sy + (hy - m.sy) * e;
            const dx = x - m.sx, dy = y - m.sy, L = Math.hypot(dx, dy) || 1, tl = Math.min(190, L);
            const gr = g.createLinearGradient(x, y, x - dx / L * tl, y - dy / L * tl);
            gr.addColorStop(0, 'rgba(255,230,160,.95)'); gr.addColorStop(.4, 'rgba(255,170,60,.45)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
            g.strokeStyle = gr; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x - dx / L * tl, y - dy / L * tl); g.stroke();
            glow(g, x, y, 26, 1, GOLD); glow(g, x, y, 11, 1, WHITE);
          } else if (!m.hit) {
            m.hit = true; m.t0 = t;
            if (!charred) { charred = true; setTimeout(() => { if (S.gen === gen && S.busy) c.classList.add('hmr-fade', 'hmr-char'); }, 250); }
          }
          if (m.hit) {   // flames spread over the text lines from the strike point for about 2.4 s
            const a = (t - m.t0) / 2.4;
            if (a < 1 && flames.length < 760) {
              const rx = 34 + r.width * 0.42 * eOut(a), ry = 26 + r.height * 0.5 * eOut(a), cnt = Math.round(dt * 260 * (1 - a * .7) * (r.width < 400 ? .75 : 1) + Math.random());
              const near = words.filter(w => Math.abs(w.x - m.tx) < rx && Math.abs(w.y - m.ty) < ry);
              for (let k = 0; k < cnt; k++) {
                let px, py;
                if (near.length && Math.random() < .85) { const w = near[(Math.random() * near.length) | 0]; px = w.l + Math.random() * (w.r - w.l); py = w.y + rnd(-6, 8); }
                else { const ang = rnd(0, 6.283), d = Math.sqrt(Math.random()); px = clamp(m.tx + Math.cos(ang) * rx * d, 4, r.width - 4); py = clamp(m.ty + Math.sin(ang) * ry * d, 6, r.height - 2); }
                flames.push({ x: px, y: py, vx: rnd(-16, 16), vy: -rnd(45, 115), life: rnd(.55, 1.15), age: 0, sz: rnd(17, 38) });
              }
            }
          }
        });
        for (let i = flames.length - 1; i >= 0; i--) {
          const p = flames[i]; p.age += dt; if (p.age >= p.life) { flames.splice(i, 1); continue; }
          p.x += p.vx * dt + Math.sin(p.age * 11 + p.y) * .4; p.y += p.vy * dt;
          const u = p.age / p.life, col = u < .25 ? FIRE.y : u < .65 ? FIRE.o : FIRE.r, sz = p.sz * (1 - u * .5) * (.85 + .15 * Math.sin(p.age * 30));
          glow(g, r.left + p.x, r.top + p.y, sz, Math.min(1, (1 - u) * 1.7), col);
          if (u < .5) glow(g, r.left + p.x, r.top + p.y, sz * .45, .8 * (1 - u), FIRE.y);
        }
        g.restore();
        return t > 1.2 && comets.every(m => m.hit && t - m.t0 > 2.4) && !flames.length;
      },
      end() { c.classList.add('hmr-fade', 'hmr-char'); setTimeout(() => cleanClass(c, 'hmr-fade'), 1400); done(S, MODE.fire, MSG.fire); }
    };
  }

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
      end() { c.classList.add('hmr-gone'); done(S, MODE.tornado, MSG.tornado); }
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
      end() { c.classList.add('hmr-gone'); done(S, MODE.hole, MSG.hole); }
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
      end() { c.classList.add('hmr-gone'); done(S, MODE.quake, MSG.quake); }
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
        c.classList.add('hmr-gone'); S.cardStyle = c.getAttribute('style');
        c.style.backgroundImage = strikes.map(s => `radial-gradient(circle at ${s.x.toFixed(0)}px ${s.y.toFixed(0)}px, rgba(30,25,40,.3) 0, rgba(30,25,40,.14) 12px, rgba(30,25,40,0) 48px)`).join(',');
        done(S, MODE.lightning, MSG.lightning);
      }
    };
  }

  // ---------------------------------------------------------------- 6. meteor shower
  function fxMeteor(S, c) {
    const items = collect(c), r0 = c.getBoundingClientRect(), D = [-.5, .866], TR = .34, RAD = 24;
    items.forEach(L => { L.st = 0; L.imp = -1; });
    const order = items.slice().sort(() => Math.random() - .5), imps = [];
    order.forEach(L => { if (L.imp >= 0) return; const k = imps.length; imps.push({ x: L.x, y: L.y }); items.forEach(M => { if (M.imp < 0 && Math.hypot(M.x - L.x, M.y - L.y) < RAD) M.imp = k; }); });
    const gap = Math.min(.09, 3.2 / Math.max(1, imps.length)); imps.forEach((p, k) => { p.t = .35 + k * gap; p.did = false; });
    const dust = []; const tEnd = (imps.length ? imps[imps.length - 1].t : 0) + 1.2;
    return {
      card: c, hide: true,
      step(dt, r, g) {
        const t = this.t, ox = r.left, oy = r.top; let left = 0;
        imps.forEach((p, k) => {
          if (!p.did && t >= p.t) { p.did = true; for (let q = 0; q < 6; q++) { const a = rnd(0, 6.283), s = rnd(20, 80); dust.push({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * .6 - 20, age: 0, life: rnd(.4, .8), rr: rnd(3, 7), sp: q < 2 }); } items.forEach(L => { if (L.imp === k) { flyL(L, { vx: D[0] * rnd(170, 330) + rnd(-50, 50), vy: D[1] * rnd(60, 200) - rnd(40, 120), vr: rnd(-10, 10), g: 800, life: rnd(.6, .95) }); L.st = 1; } }); }
          const u = (t - (p.t - TR)) / TR; if (u > 0 && u < 1) {   // the meteor: bright head, long tail
            const hx = ox + p.x - D[0] * 330 * (1 - u), hy = oy + p.y - D[1] * 330 * (1 - u), tl = 120;
            const gr = g.createLinearGradient(hx, hy, hx - D[0] * tl, hy - D[1] * tl); gr.addColorStop(0, 'rgba(255,235,170,.95)'); gr.addColorStop(.4, 'rgba(255,160,50,.5)'); gr.addColorStop(1, 'rgba(255,130,40,0)');
            g.strokeStyle = gr; g.lineWidth = 3.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx - D[0] * tl, hy - D[1] * tl); g.stroke(); glow(g, hx, hy, 14, 1, GOLD); glow(g, hx, hy, 6, 1, WHITE);
          }
        });
        for (const L of items) {
          if (L.st === 2) continue; left++;
          if (L.st === 0) put(g, L, ox + L.x, oy + L.y, 0, 1, 1, 1);
          else { if (stepFly(L, dt)) { L.st = 2; continue; } put(g, L, ox + L.x, oy + L.y, L.rot, 1, 1, 1 - L.age / L.life); }
        }
        for (let i = dust.length - 1; i >= 0; i--) { const p = dust[i]; p.age += dt; if (p.age >= p.life) { dust.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .95; const u = p.age / p.life; if (p.sp) spark(g, ox + p.x, oy + p.y, 1.6, 1 - u, GOLD, true); else { g.fillStyle = `rgba(140,120,100,${.3 * (1 - u)})`; g.beginPath(); g.arc(ox + p.x, oy + p.y, p.rr * (1 + u * 1.5), 0, 6.283); g.fill(); } }
        return (left === 0 && !dust.length && t > tEnd) || t > 9;
      },
      end() { c.classList.add('hmr-gone'); done(S, MODE.meteor, MSG.meteor); }
    };
  }

  // ---------------------------------------------------------------- reset: sparkles come and fix it
  function fxReset(S, c) {
    const ps = Array.from({ length: 40 }, () => ({ x: rnd(0, 1), y: rnd(.1, 1.1), d: rnd(0, .6), life: rnd(.7, 1), vy: -rnd(20, 60), vx: rnd(-20, 20), rr: rnd(1, 2.3), col: pick(), st: Math.random() < .4, age: 0 }));
    if (S.cardStyle !== undefined) { putStyle([[c, S.cardStyle]]); S.cardStyle = undefined; }
    c.classList.add('hmr-fade'); cleanClass(c, 'hmr-char', 'hmr-gone');
    return {
      card: c,
      step(dt, r, g) {
        const t = this.t; ps.forEach(p => { if (t < p.d) return; p.age += dt; p.x += p.vx * dt / r.width; p.y += p.vy * dt / r.height; const u = clamp(p.age / p.life, 0, 1); spark(g, r.left + p.x * r.width, r.top + p.y * r.height, p.rr * 1.1, Math.sin(u * Math.PI) * (.75 + .25 * Math.sin(p.age * 16)), p.col, p.st); });
        return t > 1.5;
      },
      end() { setTimeout(() => cleanClass(c, 'hmr-fade'), 0); done(S, 'ready', 'Text restored.'); }
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
  function hFireworks(S, c) {
    const r0 = c.getBoundingClientRect(), W = r0.width, H = r0.height, n = W < 400 ? 3 : 4, pal = [[GOLD, WHITE], [BLUE, WHITE], [VIOLET, GOLD], [WHITE, [255, 150, 200]]];
    const bursts = Array.from({ length: n }, (_, i) => ({ x: W * (i + rnd(.1, .9)) / n, y: rnd(-.28, .6) * H - 10, t0: i * .38 + rnd(0, .1), pal: pal[i % 4], ps: null }));
    return {
      card: c,
      step(dt, r, g) {
        const t = this.t;
        bursts.forEach(b => {
          const a = t - b.t0; if (a < 0) return;
          if (!b.ps) b.ps = Array.from({ length: 64 }, () => { const an = rnd(0, 6.283), sp = rnd(90, 230); return { x: b.x, y: b.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, col: b.pal[Math.random() < .6 ? 0 : 1], rr: rnd(1.1, 2.1), life: rnd(.9, 1.35) }; });
          glow(g, r.left + b.x, r.top + b.y, 60 * Math.max(0, 1 - a * 4), 1, b.pal[0]);
          b.ps.forEach(p => { if (a > p.life) return; const u = a / p.life; for (let q = 0; q < 3; q++) { const aa = Math.max(0, a - q * .03), kk = Math.pow(.94, aa * 60); spark(g, r.left + b.x + p.vx * (1 - kk) / 3.6, r.top + b.y + p.vy * (1 - kk) / 3.6 + 90 * aa * aa, p.rr * (1 - q * .25), (1 - u) * (q ? .35 : 1) * (.7 + .3 * Math.sin(a * 40 + p.rr * 9)), p.col, q === 0 && p.rr > 1.8); } });
        });
        return t > 2.3;
      }
    };
  }
  function hShooting(S, c) {
    const r0 = c.getBoundingClientRect(), W = r0.width, H = r0.height, n = 5;
    const st = Array.from({ length: n }, (_, i) => { const lr = i % 2 === 0; return { t0: i * .26, dur: .95, p0: { x: lr ? -50 : W + 50, y: rnd(-.15, .45) * H }, p1: { x: W * rnd(.3, .7), y: -rnd(.15, .5) * H - 30 }, p2: { x: lr ? W + 50 : -50, y: rnd(.4, 1) * H }, hist: [], trail: [] }; });
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
        return t > 2.4;
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

  // ---------------------------------------------------------------- press handling
  const MADFX = { fire: fxFire, tornado: fxTornado, hole: fxHole, quake: fxQuake, lightning: fxLightning, meteor: fxMeteor };
  const HAPFX = { sparkle: hSparkle, fireworks: hFireworks, shooting: hShooting, constellation: hConstellation, aurora: hAurora };
  function fxFor(c, S) { if (c.hasAttribute('data-case')) S.fx = MAD[(parseInt(c.getAttribute('data-case'), 10) || 0) % MAD.length]; return S.fx; }   // a card whose content changes (about page) picks its effect from the case number
  function resetNow(c) {   // instant, clean: used when the card's content is about to change
    const S = store.get(c); if (!S) return; S.gen = (S.gen || 0) + 1; const k = anims.findIndex(a => a.card === c); if (k >= 0) anims.splice(k, 1);
    if (S.cardStyle !== undefined) { putStyle([[c, S.cardStyle]]); S.cardStyle = undefined; }
    cleanClass(c, 'hmr-char', 'hmr-gone', 'hmr-fade'); done(S, 'ready', '');
  }
  function press(c) {
    const S = store.get(c); if (S.busy) return; fxFor(c, S);
    const reduce = rm();
    if (S.kind === 'happy') {
      busy(S, true);
      if (reduce) { try { c.animate([{ outline: '3px solid #F2A93B', outlineOffset: '-3px' }, { outline: '3px solid #F2A93B', outlineOffset: '-3px' }], { duration: 1000 }); } catch (e) { } setTimeout(() => busy(S, false), 1000); return; }
      const a = HAPFX[S.fx](S, c); a.end = () => done(S, 'ready', ''); start(a); return;
    }
    if (S.mode !== 'ready') {   // Reset
      busy(S, true);
      if (reduce) { if (S.cardStyle !== undefined) { putStyle([[c, S.cardStyle]]); S.cardStyle = undefined; } cleanClass(c, 'hmr-char', 'hmr-gone'); done(S, 'ready', 'Text restored.'); return; }
      start(fxReset(S, c)); return;
    }
    if (reduce) { c.classList.add(S.fx === 'fire' ? 'hmr-char' : 'hmr-gone'); done(S, MODE[S.fx], MSG[S.fx]); return; }
    busy(S, true); start(MADFX[S.fx](S, c));
  }

  // ---------------------------------------------------------------- build the buttons (the effect is fixed per card: its index among the page's cards of that kind)
  const idx = { mad: 0, happy: 0 };
  cards.forEach(c => {
    const kind = c.getAttribute('data-react') === 'happy' ? 'happy' : 'mad', i = idx[kind]++, fx = kind === 'mad' ? MAD[i % MAD.length] : HAPPY[i % HAPPY.length];
    const row = document.createElement('div'); row.className = 'hmr-row';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'hmr-btn ' + kind; btn.textContent = kind === 'mad' ? 'Mad' : 'Happy'; btn.setAttribute('aria-disabled', 'false');
    const live = document.createElement('span'); live.className = 'hmr-sr'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
    row.appendChild(btn); row.appendChild(live); c.appendChild(row);
    store.set(c, { kind, fx, mode: 'ready', busy: false, btn, live });
    btn.addEventListener('click', () => press(c));
  });
  addEventListener('pagehide', () => { anims.length = 0; });

  window.hmrReact = { n: cards.length, state: el => { const S = store.get(el); return S ? (S.busy ? 'busy:' : '') + S.mode : null; }, effect: el => { const S = store.get(el); return S ? fxFor(el, S) : null; }, resetNow };
})();
