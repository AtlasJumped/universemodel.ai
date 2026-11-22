// reactions: a "Mad" button (comets and fire, a sparkle tornado, or a black hole, in turn) and a "Happy" button (a short sparkle burst)
// nothing here changes layout: every effect is drawn on one fixed overlay canvas under the header, and the card's own
// children are only faded, clipped or transformed (all inline styles and classes are removed again on Reset)
(function () {
  'use strict';
  if (window.hmrReact) return;
  const cards = Array.from(document.querySelectorAll('[data-react]')).filter(e => !e.closest('section.nextup,header,footer,.site-head,.site-foot'));
  if (!cards.length) { window.hmrReact = { n: 0, state: () => null }; return; }

  const rm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const eIn = u => u * u * u, eOut = u => 1 - Math.pow(1 - u, 3), eIO = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  const GOLD = [255, 208, 112], WHITE = [255, 255, 255], ICE = [200, 224, 255];
  const pick = () => { const r = Math.random(); return r < .5 ? GOLD : r < .85 ? WHITE : ICE; };

  // ---------------------------------------------------------------- styles
  const css = document.createElement('style');
  css.textContent = `
.hmr-row{display:flex;justify-content:flex-end;align-items:center;margin-top:10px;position:relative;z-index:1}
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
.hmr-gone>:not(.hmr-row){opacity:0!important}
html.hmr-clip{overflow-x:clip}`;
  document.head.appendChild(css);

  // ---------------------------------------------------------------- overlay canvas and loop
  let cv = null, cx = null, DPR = 1, VW = 0, VH = 0;
  const anims = []; let raf = 0, last = 0;
  function ensureCanvas() {
    if (!cv) {
      cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); cv.dataset.fxReact = '1';
      cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:15';
      document.body.appendChild(cv); cx = cv.getContext('2d');
    }
    const w = innerWidth, h = innerHeight, d = Math.min(2, devicePixelRatio || 1);
    if (w !== VW || h !== VH || d !== DPR) { VW = w; VH = h; DPR = d; cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
  }
  function start(a) { ensureCanvas(); a.t = 0; anims.push(a); if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
  function frame(ts) {
    raf = 0; if (!anims.length) { clear(); return; }
    const dt = last ? clamp((ts - last) / 1000, 0, 0.05) : 0.016; last = ts;
    ensureCanvas(); cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.clearRect(0, 0, VW, VH);
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i]; a.t += dt; const r = a.card.getBoundingClientRect();
      let fin = false;
      try { fin = a.step(dt, r, cx); } catch (e) { fin = true; }
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
    if (star) { // four-point star
      const L = R * 3.4; c.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${Math.min(1, a)})`; c.lineWidth = 1.1;
      c.beginPath(); c.moveTo(x - L, y); c.lineTo(x + L, y); c.moveTo(x, y - L); c.lineTo(x, y + L); c.stroke();
    }
  }
  const FIRE = { y: [255, 236, 150], o: [255, 140, 30], r: [210, 55, 20], s: [70, 60, 55] };

  // ---------------------------------------------------------------- state of a card
  const store = new Map();   // card -> {mode, fx, busy, btn, row, live, saved}
  let counter = 0;
  function nextFx() {
    let n = 0; try { n = parseInt(localStorage.getItem('hmr-react-n') || '0', 10) || 0; } catch (e) { n = counter; }
    counter = n + 1; try { localStorage.setItem('hmr-react-n', String(counter)); } catch (e) { }
    return n % 3 + 1;
  }
  const kids = c => Array.from(c.children).filter(k => !k.classList.contains('hmr-row'));
  function snap(c) { return kids(c).map(k => [k, k.getAttribute('style')]); }
  function unsnap(list) { const put = () => list.forEach(([k, s]) => { if (s === null) { if (k.hasAttribute('style')) k.removeAttribute('style'); } else if (k.getAttribute('style') !== s) k.setAttribute('style', s); }); put(); requestAnimationFrame(put); setTimeout(put, 120); setTimeout(put, 700); }
  function cleanClass(c, ...n) { c.classList.remove(...n); if (!c.getAttribute('class')) c.removeAttribute('class'); }
  function say(S, t) { S.live.textContent = ''; setTimeout(() => { S.live.textContent = t; }, 30); }
  function setBtn(S, label, cls) { S.btn.textContent = label; S.btn.className = 'hmr-btn ' + cls; }
  function busy(S, b) { S.busy = b; S.btn.setAttribute('aria-disabled', b ? 'true' : 'false'); }

  // ---------------------------------------------------------------- effect 1: comets and fire
  function fx1(S, c) {
    const W0 = c.getBoundingClientRect(), n = 3 + Math.floor(Math.random() * 3), pts = [];
    const ys = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - .5);
    for (let i = 0; i < n; i++) pts.push({ x: W0.width * (0.14 + 0.72 * (i + rnd(.1, .9)) / n), y: W0.height * (0.2 + 0.62 * (ys[i] + rnd(.1, .9)) / n) });
    const comets = pts.map((p, i) => ({ tx: p.x, ty: p.y, sx: i % 2 ? VW + 30 : -30, sy: -40, delay: i * 0.24, dur: rnd(.5, .7), hit: false, hist: [] }));
    const flames = [], bits = []; let charred = false;
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
            if (Math.random() < .8) bits.push({ x: x - r.left, y: y - r.top, vx: rnd(-20, 20), vy: rnd(-20, 20), life: rnd(.3, .6), age: 0, rr: rnd(1, 2), col: pick(), st: Math.random() < .4 });
          } else if (!m.hit) {
            m.hit = true; m.t0 = t;
            for (let k = 0; k < 16; k++) { const a = rnd(0, 6.283), s = rnd(60, 220); bits.push({ x: m.tx, y: m.ty, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(.35, .8), age: 0, rr: rnd(1, 2.4), col: pick(), st: Math.random() < .5 }); }
            if (!charred) { charred = true; setTimeout(() => { c.classList.add('hmr-fade', 'hmr-char'); }, 250); }
          }
          if (m.hit) {   // flames spread over the text from the strike point for about 2.4 s
            const a = (t - m.t0) / 2.4; if (a < 1 && flames.length < 520) {
              const rx = (28 + r.width * 0.34 * eOut(a)), ry = (22 + r.height * 0.4 * eOut(a)), cnt = Math.round(dt * 170 * (1 - a * .75) * (r.width < 400 ? .8 : 1) + Math.random());
              for (let k = 0; k < cnt; k++) {
                const ang = rnd(0, 6.283), d = Math.sqrt(Math.random());
                const px = clamp(m.tx + Math.cos(ang) * rx * d, 4, r.width - 4), py = clamp(m.ty + Math.sin(ang) * ry * d, 6, r.height - 2);
                flames.push({ x: px, y: py, vx: rnd(-14, 14), vy: -rnd(40, 105), life: rnd(.5, 1.05), age: 0, sz: rnd(13, 30) });
              }
            }
          }
        });
        for (let i = flames.length - 1; i >= 0; i--) {
          const p = flames[i]; p.age += dt; if (p.age >= p.life) { flames.splice(i, 1); continue; }
          p.x += p.vx * dt + Math.sin(p.age * 11 + p.y) * .4; p.y += p.vy * dt;
          const u = p.age / p.life, col = u < .25 ? FIRE.y : u < .65 ? FIRE.o : FIRE.r, sz = p.sz * (1 - u * .55) * (.8 + .2 * Math.sin(p.age * 30));
          glow(g, r.left + p.x, r.top + p.y, sz, Math.min(1, (1 - u) * 1.6), col);
          if (u < .5) glow(g, r.left + p.x, r.top + p.y, sz * .45, .8 * (1 - u), FIRE.y);
        }
        g.restore();
        for (let i = bits.length - 1; i >= 0; i--) {
          const p = bits[i]; p.age += dt; if (p.age >= p.life) { bits.splice(i, 1); continue; }
          p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96;
          const u = p.age / p.life; spark(g, r.left + p.x, r.top + p.y, p.rr * (1 - u * .5), 1 - u, p.col, p.st);
        }
        return t > 1.2 && comets.every(m => m.hit && t - m.t0 > 2.4) && !flames.length && !bits.length;
      },
      end() { c.classList.add('hmr-fade', 'hmr-char'); setTimeout(() => cleanClass(c, 'hmr-fade'), 1400); done(S, 'burnt', 'Text burned. Press Reset to bring it back.'); }
    };
  }

  // ---------------------------------------------------------------- effect 2: sparkle tornado
  function fx2(S, c) {
    const ks = snap(c), D = 2.5, ps = Array.from({ length: 170 }, () => ({ h: Math.pow(Math.random(), .85), a: rnd(0, 6.283), sp: rnd(6, 11), col: Math.random() < .55 ? [238, 160, 30] : Math.random() < .6 ? GOLD : [140, 120, 255], rr: rnd(1, 2.3), st: Math.random() < .3 }));
    const shed = [];
    const sweep = (r, tx) => { const kk = kids(c); kk.forEach(k => { const b = k.getBoundingClientRect(); k.style.clipPath = `inset(-40px -40px -40px ${Math.max(0, tx - b.left + 6).toFixed(1)}px)`; }); };
    return {
      card: c,
      step(dt, r, g) {
        const u = clamp(this.t / D, 0, 1), e = eIO(u), tx = r.left - 50 + (r.width + 100) * e, H = r.height + 30, bot = r.bottom + 12, top = r.top - 14;
        sweep(r, tx);
        // soft funnel glow
        g.save();
        const wob = Math.sin(this.t * 4) * 6, fw = t => 7 + t * 42; // funnel body: wide at the top, narrow at the foot
        const gr = g.createLinearGradient(0, bot, 0, top); gr.addColorStop(0, 'rgba(240,170,50,.30)'); gr.addColorStop(1, 'rgba(255,214,120,.10)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(tx + wob - fw(0), bot); g.lineTo(tx + wob + fw(0), bot);
        for (let k = 1; k <= 8; k++) { const q = k / 8; g.lineTo(tx + Math.sin(this.t * 4 + q * 5) * 6 + fw(q), bot - q * H); }
        for (let k = 8; k >= 1; k--) { const q = k / 8; g.lineTo(tx + Math.sin(this.t * 4 + q * 5) * 6 - fw(q), bot - q * H); }
        g.closePath(); g.fill();
        ps.forEach(p => {
          p.a += p.sp * dt; const rad = 6 + p.h * 40, y = bot - p.h * H, sway = Math.sin(this.t * 4 + p.h * 5) * 6;
          for (let k = 0; k < 3; k++) { const a = p.a - k * .28, x = tx + sway + Math.cos(a) * rad, yy = y + Math.sin(a) * rad * .28; spark(g, x, yy, p.rr * (1 - k * .25), (k === 0 ? 1 : .45 / k) * (.6 + .4 * Math.sin(p.a * 1.7)) * (Math.cos(a) > -.2 ? 1 : .55), p.col, k === 0 && p.st); }
          if (u < 1 && Math.random() < dt * 2.2 && shed.length < 90) shed.push({ x: tx - r.left + Math.cos(p.a) * rad, y: y - r.top, vx: rnd(-25, -4), vy: rnd(-30, 30), life: rnd(.4, .9), age: 0, rr: p.rr, col: p.col });
        });
        g.restore();
        for (let i = shed.length - 1; i >= 0; i--) { const p = shed[i]; p.age += dt; if (p.age >= p.life) { shed.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; const q = p.age / p.life; spark(g, r.left + p.x, r.top + p.y, p.rr, 1 - q, p.col, false); }
        return u >= 1 && !shed.length;
      },
      end() { c.classList.add('hmr-gone'); unsnap(ks); done(S, 'erased', 'Text removed. Press Reset to bring it back.'); }
    };
  }

  // ---------------------------------------------------------------- effect 3: black hole
  function fx3(S, c) {
    const ks = snap(c), r0 = c.getBoundingClientRect(), D = 3.1, cr = { x: r0.width / 2, y: r0.height / 2 };
    const info = kids(c).map(k => { const b = k.getBoundingClientRect(); return { k, ox: cr.x - (b.left - r0.left), oy: cr.y - (b.top - r0.top) }; });
    info.forEach(i => { i.k.style.transformOrigin = `${i.ox.toFixed(1)}px ${i.oy.toFixed(1)}px`; i.k.style.willChange = 'transform,opacity'; });
    document.documentElement.classList.add('hmr-clip');
    const Rmax = clamp(Math.min(r0.width, r0.height) * .26, 26, 78), ps = Array.from({ length: 46 }, () => ({ a: rnd(0, 6.283), d: rnd(.3, 1), sp: rnd(2, 4), col: pick(), rr: rnd(.9, 1.8) }));
    let swallowed = false;
    return {
      card: c,
      step(dt, r, g) {
        const t = this.t, X = r.left + r.width / 2, Y = r.top + r.height / 2;
        const grow = eOut(clamp(t / .7, 0, 1)), shrink = 1 - eIn(clamp((t - 2.55) / .55, 0, 1)), R = Rmax * grow * shrink;
        if (t < 2.55) {
          const p = clamp((t - .25) / 2.3, 0, 1), s = Math.max(.02, 1 - eIn(p) * .98), rot = eIn(p) * 540;
          info.forEach(i => { i.k.style.transform = `rotate(${rot.toFixed(1)}deg) scale(${s.toFixed(3)})`; i.k.style.opacity = String(clamp(1 - Math.pow(p, 4) * 1, 0, 1)); });
        } else if (!swallowed) { swallowed = true; c.classList.add('hmr-gone'); unsnap(ks); }
        if (R < 1) return t > 3;
        g.save();
        glow(g, X, Y, R * 3.2, .55 * shrink, [255, 190, 80]);
        const ring = (half) => { g.beginPath(); g.ellipse(X, Y, R * 1.9, R * .46, -.32, half ? 0 : Math.PI, half ? Math.PI : Math.PI * 2); g.stroke(); };
        g.lineCap = 'round';
        [[7, .12], [3.5, .28], [1.4, .95]].forEach(([lw, al]) => { g.strokeStyle = `rgba(255,200,95,${al})`; g.lineWidth = lw; ring(false); });
        g.fillStyle = '#000'; g.beginPath(); g.arc(X, Y, R, 0, 6.283); g.fill();
        g.strokeStyle = 'rgba(255,214,130,.9)'; g.lineWidth = 1.6; g.shadowColor = 'rgba(255,190,70,.95)'; g.shadowBlur = 14; g.beginPath(); g.arc(X, Y, R * 1.06, 0, 6.283); g.stroke(); g.shadowBlur = 0;
        [[7, .12], [3.5, .28], [1.4, .95]].forEach(([lw, al]) => { g.strokeStyle = `rgba(255,200,95,${al})`; g.lineWidth = lw; ring(true); });
        g.restore();
        ps.forEach(p => {  // sparkles spiral in
          p.a += p.sp * dt * (1 + 2 * (1 - p.d)); p.d -= dt * .22 * (1 + (1 - p.d) * 2); if (p.d < .08) { p.d = 1; p.a = rnd(0, 6.283); }
          const rad = R * (1.1 + p.d * 2.6) + 2; spark(g, X + Math.cos(p.a) * rad * 1.1, Y + Math.sin(p.a) * rad * .62, p.rr, clamp((1 - p.d) * 2, 0, 1) * Math.min(1, R / 20), p.col, false);
        });
        return t > 3.1;
      },
      end() { document.documentElement.classList.remove('hmr-clip'); info.forEach(i => { i.k.style.willChange = ''; }); unsnap(ks); if (!c.classList.contains('hmr-gone')) c.classList.add('hmr-gone'); done(S, 'swallowed', 'Text pulled into a black hole. Press Reset to bring it back.'); }
    };
  }

  // ---------------------------------------------------------------- reset: sparkles come and fix it
  function fxReset(S, c) {
    const ps = Array.from({ length: 40 }, () => ({ x: rnd(0, 1), y: rnd(.1, 1.1), d: rnd(0, .6), life: rnd(.7, 1), vy: -rnd(20, 60), vx: rnd(-20, 20), rr: rnd(1, 2.3), col: pick(), st: Math.random() < .4, age: 0 }));
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

  // ---------------------------------------------------------------- happy
  function fxHappy(S, c) {
    const cs = getComputedStyle(c), base = cs.boxShadow, rad = parseFloat(cs.borderTopLeftRadius) || 0, ps = [];
    const glowS = '0 0 26px 6px rgba(242,169,59,.55), 0 0 60px 14px rgba(255,222,140,.28)', none = '0 0 0 0 rgba(242,169,59,0)';
    const mk = s => (base && base !== 'none' ? base + ', ' : '') + s;
    try { c.animate([{ boxShadow: mk(none), borderRadius: (rad || 14) + 'px' }, { boxShadow: mk(glowS), borderRadius: (rad || 14) + 'px', offset: .45 }, { boxShadow: mk(none), borderRadius: (rad || 14) + 'px' }], { duration: 1800, easing: 'ease-in-out' }); } catch (e) { }
    return {
      card: c,
      step(dt, r, g) {
        const t = this.t;
        if (t < 1.3) { const cnt = Math.round(dt * 52 + Math.random()); for (let k = 0; k < cnt; k++) ps.push({ x: rnd(-18, r.width + 18), y: rnd(r.height * .15, r.height + 10), vx: rnd(-12, 12), vy: -rnd(30, 85), life: rnd(.7, 1.2), age: 0, rr: rnd(1, 2.6), col: Math.random() < .6 ? GOLD : pick(), st: Math.random() < .5, tw: rnd(0, 6) }); }
        for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; p.age += dt; if (p.age >= p.life) { ps.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; const u = p.age / p.life; spark(g, r.left + p.x, r.top + p.y, p.rr, Math.min(1, u * 8, (1 - u) * 1.8) * (.6 + .4 * Math.sin(p.tw + p.age * 18)), p.col, p.st); }
        return t > 1.3 && !ps.length || t > 1.8;
      },
      end() { done(S, 'ready', ''); }
    };
  }

  function done(S, mode, msg) {
    S.mode = mode; busy(S, false);
    setBtn(S, mode === 'ready' ? (S.kind === 'mad' ? 'Mad' : 'Happy') : 'Reset', mode === 'ready' ? S.kind : 'reset');
    if (msg) say(S, msg);
  }

  // ---------------------------------------------------------------- press handling
  function press(c) {
    const S = store.get(c); if (S.busy) return;
    const reduce = rm();
    if (S.kind === 'happy') {
      if (reduce) { busy(S, true); try { c.animate([{ outline: '3px solid #F2A93B', outlineOffset: '-3px' }, { outline: '3px solid #F2A93B', outlineOffset: '-3px' }], { duration: 1000 }); } catch (e) { } setTimeout(() => busy(S, false), 1000); return; }
      busy(S, true); start(fxHappy(S, c)); return;
    }
    if (S.mode !== 'ready') {   // Reset
      busy(S, true);
      if (reduce) { c.classList.remove('hmr-char', 'hmr-gone'); if (!c.getAttribute('class')) c.removeAttribute('class'); done(S, 'ready', 'Text restored.'); return; }
      start(fxReset(S, c)); return;
    }
    const fx = nextFx();
    if (reduce) {
      if (fx === 1) { c.classList.add('hmr-char'); done(S, 'burnt', 'Text burned. Press Reset to bring it back.'); }
      else { c.classList.add('hmr-gone'); done(S, fx === 2 ? 'erased' : 'swallowed', fx === 2 ? 'Text removed. Press Reset to bring it back.' : 'Text pulled into a black hole. Press Reset to bring it back.'); }
      return;
    }
    busy(S, true); start((fx === 1 ? fx1 : fx === 2 ? fx2 : fx3)(S, c));
  }

  // ---------------------------------------------------------------- build the buttons
  cards.forEach(c => {
    const kind = c.getAttribute('data-react') === 'happy' ? 'happy' : 'mad';
    const row = document.createElement('div'); row.className = 'hmr-row';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'hmr-btn ' + kind; btn.textContent = kind === 'mad' ? 'Mad' : 'Happy'; btn.setAttribute('aria-disabled', 'false');
    const live = document.createElement('span'); live.className = 'hmr-sr'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
    row.appendChild(btn); row.appendChild(live); c.appendChild(row);
    store.set(c, { kind, mode: 'ready', busy: false, btn, live });
    btn.addEventListener('click', () => press(c));
  });
  addEventListener('pagehide', () => { anims.length = 0; });

  window.hmrReact = { n: cards.length, state: el => { const S = store.get(el); return S ? (S.busy ? 'busy:' : '') + S.mode : null; } };
})();
