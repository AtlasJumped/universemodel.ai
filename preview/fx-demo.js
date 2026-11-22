// Universe Model PREVIEW ONLY: a demo of scroll-triggered effects (owner request 2026-11-21). Not part of the live site.
// One fixed overlay canvas (under the sticky header), one effect per section as it reaches the upper third of the window,
// the page head's effect on the first scroll. Text effects wrap a heading's letters in inline-block spans (checked against a
// layout change, restored node for node), card effects use transform and opacity only. Every effect has cleanup functions that
// run when it ends, is interrupted, the tab is hidden or the page unloads, and a hard timeout.
(() => {
  'use strict';
  if (window.fxDemo) return;
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COARSE = matchMedia('(pointer: coarse)').matches;
  const COLS = [[29, 95, 209], [91, 155, 230], [109, 74, 255], [242, 169, 59], [14, 58, 117], [214, 120, 210]];
  const GOLD = [242, 169, 59], WHITE = [255, 250, 232];
  const rnd = (a, b) => a + Math.random() * (b - a), clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, k) => a + (b - a) * k;
  const easeIO = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2, easeO = x => 1 - Math.pow(1 - x, 3), easeI = x => x * x * x;
  const pickCol = () => COLS[Math.floor(Math.random() * COLS.length)];
  const rgbStr = c => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
  const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const parseRGB = s => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return [14, 58, 117]; const p = m[1].split(',').map(parseFloat); return [p[0], p[1], p[2]]; };
  const page = (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '') || 'index';
  const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  const hdrBottom = () => { const h = document.querySelector('.site-head'); return h ? Math.max(0, h.getBoundingClientRect().bottom) : 0; };

  // ---------------------------------------------------------------- the demo pill, panel and label
  const store = { get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} } };
  let enabled = store.get('fxdemo-off') !== '1';
  const css = document.createElement('style');
  css.textContent = `.fxd-pill{position:fixed;left:12px;bottom:12px;z-index:80;font:600 12px/1 var(--font,system-ui,sans-serif);color:#0E3A75;background:rgba(255,255,255,.94);border:1px solid #cfdcf0;border-radius:999px;padding:8px 12px;cursor:pointer;box-shadow:0 2px 10px rgba(14,58,117,.14);display:flex;align-items:center;gap:7px}
.fxd-pill:hover{background:#fff;border-color:#5B9BE6}.fxd-pill i{width:8px;height:8px;border-radius:50%;background:radial-gradient(circle,#fff6d8 0,#F2A93B 45%,#6D4AFF 100%);display:inline-block}
.fxd-pill.off{cursor:default;color:#5b6b85}.fxd-pill.off i{background:#b6c2d6}
.fxd-panel{position:fixed;left:12px;bottom:52px;z-index:80;width:min(290px,calc(100vw - 24px));max-height:min(70vh,560px);overflow:auto;background:rgba(255,255,255,.97);border:1px solid #cfdcf0;border-radius:14px;box-shadow:0 8px 30px rgba(14,58,117,.22);padding:10px 12px 12px;font:13px/1.3 var(--font,system-ui,sans-serif);color:#0E3A75;display:none}
.fxd-panel.open{display:block}.fxd-panel h4{margin:2px 0 8px;font:700 13px/1.2 var(--font,system-ui,sans-serif);color:#0E3A75;letter-spacing:0}
.fxd-sw{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:12.5px;cursor:pointer}.fxd-sw input{width:16px;height:16px;accent-color:#1D5FD1}
.fxd-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 0;border-top:1px solid #eef2f9}.fxd-row span{flex:1;min-width:0}
.fxd-row button,.fxd-all{font:600 12px/1 var(--font,system-ui,sans-serif);color:#1D5FD1;background:#fff;border:1px solid #cfdcf0;border-radius:8px;padding:5px 10px;cursor:pointer}
.fxd-row button:hover,.fxd-all:hover{background:#eef4ff;border-color:#5B9BE6}.fxd-all{width:100%;margin-top:9px;padding:8px 10px}
.fxd-label{position:fixed;left:12px;bottom:52px;z-index:80;font:600 12px/1.2 var(--font,system-ui,sans-serif);color:#fff;background:rgba(14,58,117,.9);border-radius:8px;padding:6px 10px;pointer-events:none;opacity:0;transition:opacity .25s}
.fxd-label.on{opacity:1}`;
  document.head.appendChild(css);
  const pill = document.createElement('button'); pill.type = 'button'; pill.className = 'fxd-pill'; pill.setAttribute('aria-expanded', 'false');
  pill.innerHTML = '<i aria-hidden="true"></i><b style="font-weight:600">Effects demo</b>';
  const label = document.createElement('div'); label.className = 'fxd-label'; label.setAttribute('role', 'status'); label.setAttribute('aria-live', 'polite');
  const panel = document.createElement('div'); panel.className = 'fxd-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Effects demo');
  let labelTimer = 0;
  function say(txt, ms) { label.textContent = txt; label.classList.add('on'); clearTimeout(labelTimer); labelTimer = setTimeout(() => label.classList.remove('on'), ms || 2000); }

  // ---------------------------------------------------------------- engine
  let cv = null, c = null, W = innerWidth, H = innerHeight, D = 1, raf = 0, last = 0, lastDraw = 0;
  const running = [], pending = [], errors = [];
  const ptr = { x: null, y: null, t: 0 };
  addEventListener('pointermove', e => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = performance.now(); }, { passive: true });
  function fit() { D = Math.min(1.5, devicePixelRatio || 1); W = innerWidth; H = innerHeight; if (!cv) return; cv.width = Math.round(W * D); cv.height = Math.round(H * D); c.setTransform(D, 0, 0, D, 0, 0); }
  function ensureCanvas() {
    if (cv) return;
    cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); cv.dataset.fxDemo = '1';
    cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:15';
    document.body.appendChild(cv); c = cv.getContext('2d'); fit(); addEventListener('resize', fit);
  }
  function dropCanvas() { if (!cv) return; removeEventListener('resize', fit); cv.remove(); cv = null; c = null; }
  function idleCheck() { if (!running.length && !pending.length) { if (raf) cancelAnimationFrame(raf); raf = 0; dropCanvas(); } }

  function finish(fx) {
    if (fx.ended) return; fx.ended = true; clearTimeout(fx.hard);
    for (let i = fx.ends.length - 1; i >= 0; i--) { try { fx.ends[i](); } catch (e) { errors.push(String(e)); } }
    const k = running.indexOf(fx); if (k >= 0) running.splice(k, 1);
    idleCheck();
  }
  function hurry(fx) { if (fx.hurrying) return; fx.hurrying = true; try { if (fx.inst && fx.inst.hurry) fx.inst.hurry(); } catch (e) {} }
  function startFx(def, tg) {
    if (document.hidden || !cvOK()) return false;
    ensureCanvas();
    const fx = { def, tg, sec: tg.sec, t: 0, rate: 1, hurrying: false, ended: false, ends: [], sy0: scrollY, inst: null };
    const X = { sec: tg.sec, head: tg.head, fx, guard: f => { fx.ends.push(f); }, items: n => itemsOf(tg.sec, n || 8) };
    let inst = null;
    try { inst = def.make(X); } catch (e) { errors.push(def.id + ': ' + e); inst = null; }
    if (!inst) { for (let i = fx.ends.length - 1; i >= 0; i--) { try { fx.ends[i](); } catch (e) {} } idleCheck(); return false; }
    fx.inst = inst; running.push(fx);
    fx.hard = setTimeout(() => finish(fx), (def.dur + 4) * 1000);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    say(def.label);
    return true;
  }
  const cvOK = () => !document.querySelector('canvas[data-page-fire]');
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (COARSE && now - lastDraw < 32) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - (lastDraw || now - 16)) / 1000)); lastDraw = now;
    if (!c) { idleCheck(); return; }
    if (!cvOK()) { running.slice().forEach(finish); pending.length = 0; idleCheck(); return; }
    c.clearRect(0, 0, W, H);
    for (const fx of running.slice()) {
      if (fx.ended) continue;
      if (!fx.hurrying) { const r = fx.sec.getBoundingClientRect(); if (Math.abs(scrollY - fx.sy0) > H * 0.45 || r.bottom < H * 0.08 || r.top > H * 0.95) hurry(fx); }
      if (fx.hurrying) fx.rate += (6 - fx.rate) * Math.min(1, dt * 8);
      fx.t += dt * fx.rate;
      let fin = false;
      c.save();
      try { fin = fx.inst.frame(c, fx.t, dt * fx.rate, fx); } catch (e) { errors.push(fx.def.id + ': ' + (e && e.stack || e)); fin = true; }
      c.restore();
      if (fin || fx.t > fx.def.dur + 2) finish(fx);
    }
    while (pending.length && running.length < 2) { const p = pending.shift(); const r = p.tg.sec.getBoundingClientRect(); if (r.bottom > H * 0.12 && r.top < H * 0.9) launch(p.names, p.tg, true); }
    if (!running.length && !pending.length) idleCheck();
  }
  function launch(names, tg, nolimit) {
    if (running.length >= 2) {
      if (nolimit) return false;
      hurry(running[0]); pending.push({ names, tg }); if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } return true;
    }
    for (const n of names) { const d = DEF[n]; if (d && feasible(d, tg) && startFx(d, tg)) return d.id; }
    return false;
  }
  function stopAll() { running.slice().forEach(finish); pending.length = 0; idleCheck(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(); });
  addEventListener('pagehide', stopAll);

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
  function spark(c, x, y, R, a, col, star) { glow(c, x, y, R * 4, a, col); if (star) cross(c, x, y, R * 3.2, a, col); }
  function rrect(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }

  class Swarm {
    constructor(max) { this.p = []; this.max = COARSE ? Math.round(max * 0.6) : max; }
    add(o) { if (this.p.length >= this.max) return null; const p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, r: rnd(0.9, 2.4), life: 1, age: 0, col: pickCol(), star: Math.random() < 0.35, tw: Math.random() * 6.28, drag: 0.97, g: 0 }, o); this.p.push(p); return p; }
    step(dt) { const k = dt * 60; for (let i = this.p.length - 1; i >= 0; i--) { const p = this.p[i]; p.age += dt; if (p.age >= p.life) { this.p.splice(i, 1); continue; } const d = Math.pow(p.drag, k); p.vx *= d; p.vy = p.vy * d + p.g * dt; p.x += p.vx * k; p.y += p.vy * k; } }
    draw(c, mul) { for (const p of this.p) { const u = p.age / p.life, a = Math.min(1, u * 10, (1 - u) * 1.7) * (0.72 + 0.28 * Math.sin(p.tw + p.age * 14)) * (mul == null ? 1 : mul); spark(c, p.x, p.y, p.r * (0.55 + 0.45 * (1 - u)), a, p.col, p.star); } }
  }

  // ---------------------------------------------------------------- DOM helpers (never change layout)
  function holdStyle(X, el) { const was = el.getAttribute('style'); X.guard(() => { if (was === null) el.removeAttribute('style'); else el.setAttribute('style', was); }); }
  function itemsOf(sec, max) {
    let list = [...sec.querySelectorAll('.card')].filter(e => !(e.parentElement && e.parentElement.closest('.card')));
    if (list.length < 2) list = [...sec.querySelectorAll('.grid > *, .tile')];
    if (list.length < 2) list = [...sec.querySelectorAll('p, li')].filter(e => !e.closest('.card,.pull,.note,nav,.site-head') && (e.textContent || '').trim().length > 40);
    const hb = hdrBottom();
    return list.filter(e => { const r = e.getBoundingClientRect(); return r.width > 90 && r.height > 28 && r.bottom > hb + 10 && r.top < H - 10 && r.height < H * 1.2; }).slice(0, max);
  }
  const bgOpaque = el => { const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(el).backgroundColor); if (!m) return false; const p = m[1].split(','); return p.length < 4 || parseFloat(p[3]) > 0.8; };
  function tbox(el) { const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return b.width ? b : el.getBoundingClientRect(); }
  const headOk = h => { if (!h) return false; const r = h.getBoundingClientRect(); return r.width > 20 && r.height > 10 && r.bottom > hdrBottom() && r.top < H * 0.9; };

  // the heading's letters in inline-block spans, with a layout check, put back node for node
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
  // a heading's letters as canvas text (for effects drawn on the overlay: positions in document coordinates)
  let mctx = null;
  function charsInNode(n, from, to, out, limit) {
    const txt = n.nodeValue, p = n.parentElement; if (!p) return; const cs = getComputedStyle(p), sx = scrollX, sy = scrollY;
    mctx = mctx || document.createElement('canvas').getContext('2d');
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; mctx.font = font; const asc = mctx.measureText('M').fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.9;
    const up = cs.textTransform === 'uppercase', rg = document.createRange();
    for (let i = from; i < to && out.length < limit; i++) { if (/\s/.test(txt[i])) continue; rg.setStart(n, i); rg.setEnd(n, i + 1); const r = rg.getBoundingClientRect(); if (!r.width) continue;
      out.push({ ch: up ? txt[i].toUpperCase() : txt[i], x: r.left + sx, y: r.top + sy, w: r.width, h: r.height, font, color: cs.color, asc }); }
  }
  function charsOf(root, limit) { const out = [], tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode()) && out.length < (limit || 160)) charsInNode(n, 0, n.nodeValue.length, out, limit || 160); return out; }
  function drawChars(c, chars, col, alpha, box, blur) {
    const sx = scrollX, sy = scrollY; c.textBaseline = 'alphabetic'; c.globalAlpha = alpha == null ? 1 : alpha;
    if (blur) { c.shadowColor = `rgba(${GOLD[0]},${GOLD[1]},${GOLD[2]},.95)`; c.shadowBlur = blur; }
    for (const ch of chars) { const x = ch.x - sx, y = ch.y - sy; if (box && (x > box.r || x + ch.w < box.l || y > box.b || y + ch.h < box.t)) continue; c.font = ch.font; c.fillStyle = col ? rgbStr(col) : ch.color; c.fillText(ch.ch, x, y + ch.asc); }
    c.shadowBlur = 0; c.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- the effects
  const DEF = {}, ORDER = [];
  const def = (id, label, mover, needs, dur, make) => { DEF[id] = { id, label, mover, needs, dur, make }; ORDER.push(id); };
  function feasible(d, tg) { if (d.mover && !tg.safe) return false; if (d.needs === 'head' && !tg.head) return false; if (d.needs === 'cards' && tg.nitems < 2) return false; return true; }

  // ===== 1. The HMR fairy
  def('fairy', 'The HMR fairy', false, null, 8.5, X => {
    const sw = new Swarm(170), f = { x: 0, y: 0, s: 0, a: 0, hide: 0, wob: 1, occ: null, word: null, flash: 0 };
    let dt = 0, T = 0, hurried = false, finished = false, vel = 0, em = 0, px = 0, py = 0, prevOk = false;
    const head = headOk(X.head) ? X.head : null, cards = X.items(6), opaque = cards.filter(bgOpaque);
    const rp = () => ({ x: rnd(50, W - 50), y: rnd(hdrBottom() + 44, H - 50) });
    function* wait(s) { let e = 0; while (e < s) { e += dt; yield; } }
    function* tween(k, to, dur) { const a = f[k]; let e = 0; while (e < dur) { e += dt; f[k] = lerp(a, to, easeIO(clamp(e / dur, 0, 1))); yield; } f[k] = to; }
    function* pause(s) { f.wob = 3.2; yield* wait(s); f.wob = 1; }
    function* move(tg, dur, o) {
      o = o || {}; const P0 = { x: f.x, y: f.y }, T0 = tg(), dx = T0.x - P0.x, dy = T0.y - P0.y, L = Math.hypot(dx, dy) || 1, bend = (o.bend != null ? o.bend : rnd(-0.22, 0.22)) * L, nx = -dy / L, ny = dx / L; let e = 0;
      while (e < dur) { e += dt; const u = clamp(e / dur, 0, 1), k = o.out ? 1 - Math.pow(1 - u, 4) : o.lin ? u : easeIO(u), Tn = tg(), cx = (P0.x + Tn.x) / 2 + nx * bend, cy = (P0.y + Tn.y) / 2 + ny * bend, q = 1 - k;
        f.x = q * q * P0.x + 2 * q * k * cx + k * k * Tn.x; f.y = q * q * P0.y + 2 * q * k * cy + k * k * Tn.y; yield; }
      const Te = tg(); f.x = Te.x; f.y = Te.y;
    }
    const chars = () => f._chars || (f._chars = charsOf(head, 90));
    const B = {
      * zip() { const n = 4 + Math.floor(rnd(0, 3)); for (let i = 0; i < n; i++) { const p = rp(); yield* move(() => p, rnd(0.32, 0.55), { out: Math.random() < 0.5 }); if (Math.random() < 0.65) yield* pause(rnd(0.1, 0.28)); } },
      * chase() {
        const around = () => (ptr.x != null && performance.now() - ptr.t < 8000 && ptr.y > hdrBottom()) ? { x: ptr.x, y: ptr.y } : { x: W / 2, y: lerp(hdrBottom(), H, 0.5) };
        yield* move(() => { const a = around(); return { x: a.x + 80, y: a.y }; }, 0.5);
        let e = 0, ang = 0; const dur = 1.9; while (e < dur) { e += dt; const sp = 6.5 * Math.sin(Math.PI * clamp(e / dur, 0, 1)) + 2; ang += sp * dt; const a = around(); const rr = 64 + 16 * Math.sin(e * 5); f.x = a.x + Math.cos(ang) * rr; f.y = a.y + Math.sin(ang) * rr * 0.75; yield; }
        yield* move(() => { const a = around(); return { x: a.x + 110, y: a.y - 40 }; }, 0.35, { out: true });
      },
      * hideHeading() {
        const ch = chars(); if (!ch.length) return; const first = ch[0], line = ch.filter(q => Math.abs(q.y - first.y) < first.h * 0.5), last = line[line.length - 1];
        const Lp = () => ({ x: first.x - scrollX, y: first.y - scrollY + first.h * 0.5 }), Rp = () => ({ x: last.x + last.w - scrollX, y: last.y - scrollY + last.h * 0.5 });
        f.occ = { type: 'text', chars: ch };
        yield* move(() => { const p = Lp(); return { x: p.x - 50, y: p.y - 34 }; }, 0.6); yield* pause(0.2);
        yield* move(() => { const p = Lp(); return { x: p.x + 8, y: p.y + 2 }; }, 0.4); yield* tween('hide', 0.88, 0.22); yield* wait(0.45);
        yield* tween('hide', 0.15, 0.2); yield* move(() => { const p = Lp(); return { x: p.x - 7, y: p.y - 15 }; }, 0.32); yield* pause(0.45);
        yield* tween('hide', 0.88, 0.2); yield* move(() => { const p = Lp(); return { x: p.x + 8, y: p.y + 3 }; }, 0.25); yield* wait(0.2);
        yield* move(() => { const p = Rp(); return { x: p.x - 9, y: p.y + 3 }; }, Math.min(1.1, 0.35 + line.length * 0.03), { lin: true, bend: 0.02 }); yield* wait(0.35);
        yield* tween('hide', 0.15, 0.2); yield* move(() => { const p = Rp(); return { x: p.x + 8, y: p.y - 16 }; }, 0.3); yield* pause(0.5);
        yield* tween('hide', 0, 0.15); yield* move(() => { const p = Rp(); return { x: p.x + 70, y: p.y - 54 }; }, 0.4, { out: true }); f.occ = null;
      },
      * hideCard() {
        const el = opaque[Math.floor(Math.random() * opaque.length)], R = () => el.getBoundingClientRect(); f.occ = { type: 'rect', el };
        yield* move(() => { const r = R(); return { x: r.right + 40, y: r.top + r.height * 0.3 }; }, 0.6); yield* pause(0.15);
        yield* move(() => { const r = R(); return { x: r.right - 26, y: r.top + r.height * 0.3 }; }, 0.38); yield* wait(0.5);
        yield* move(() => { const r = R(); return { x: r.right + 2, y: r.top + r.height * 0.3 - 2 }; }, 0.3); yield* pause(0.45);
        yield* move(() => { const r = R(); return { x: r.right - 24, y: r.top + r.height * 0.3 }; }, 0.25);
        yield* move(() => { const r = R(); return { x: r.left + r.width * 0.55, y: r.top + 24 }; }, 0.7, { lin: true, bend: 0 }); yield* wait(0.2);
        yield* move(() => { const r = R(); return { x: r.left + r.width * 0.55 + 4, y: r.top + 3 }; }, 0.28); yield* pause(0.5);
        yield* move(() => { const r = R(); return { x: r.left + r.width * 0.55 - 70, y: r.top - 50 }; }, 0.38, { out: true }); f.occ = null;
      },
      * loop() {
        const b = clamp(W * 0.06, 36, 84), a = b * 0.68, n = clamp(Math.floor((W - 140) / (a * 6.28)), 1, 2), U = 6.283 * n, dir = Math.random() < 0.5 ? 1 : -1, yc = rnd(hdrBottom() + b + 50, H - b - 50);
        const span = a * U, x0 = dir > 0 ? Math.max(40, (W - span) / 2) : Math.min(W - 40, (W + span) / 2);
        const pt = u => ({ x: x0 + dir * (a * u - b * Math.sin(u)), y: yc - b * Math.cos(u) });
        yield* move(() => pt(0), 0.5); const dur = 1.9 + n * 0.5; let e = 0;
        while (e < dur) { e += dt; const p = pt(easeIO(clamp(e / dur, 0, 1)) * U); f.x = p.x; f.y = p.y; yield; }
        yield* move(() => ({ x: f.x + dir * 90, y: f.y - 60 }), 0.3, { out: true });
      },
      * orbit() {
        const el = cards[Math.floor(Math.random() * cards.length)], R = () => el.getBoundingClientRect(); const laps = 1.15, dur = 2.5, dir = Math.random() < 0.5 ? 1 : -1, a0 = rnd(0, 6.28);
        const pt = th => { const r = R(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, hw = r.width / 2 + 16, hh = r.height / 2 + 16, ca = Math.cos(th), sa = Math.sin(th);
          return { x: cx + hw * Math.sign(ca) * Math.pow(Math.abs(ca), 0.5), y: cy + hh * Math.sign(sa) * Math.pow(Math.abs(sa), 0.5) }; };
        yield* move(() => pt(a0), 0.55); let e = 0;
        while (e < dur) { e += dt; const p = pt(a0 + dir * easeIO(clamp(e / dur, 0, 1)) * laps * 6.283); f.x = p.x; f.y = p.y; yield; }
        yield* move(() => { const p = pt(a0 + dir * laps * 6.283); return { x: p.x + dir * 20, y: p.y - 60 }; }, 0.35, { out: true });
      },
      * land() {
        const wd = pickWord(X.sec); if (!wd) return; const ch = wd.chars, bx = () => ({ x: wd.x - scrollX + wd.w / 2, y: wd.y - scrollY });
        yield* move(() => { const p = bx(); return { x: p.x, y: p.y - 20 }; }, 0.7); f.word = { chars: ch, g: 0, wd };
        let e = 0; while (e < 1.7) { e += dt; f.word.g = Math.min(1, e / 0.35) * (e > 1.35 ? clamp(1 - (e - 1.35) / 0.35, 0, 1) : 1); const p = bx(); f.x = p.x + Math.sin(e * 3) * wd.w * 0.18; f.y = p.y - 17 + Math.sin(e * 6) * 3; if (Math.random() < dt * 30) sw.add({ x: wd.x - scrollX + Math.random() * wd.w, y: wd.y - scrollY + wd.h * rnd(0.2, 1), vy: -0.4, vx: rnd(-0.3, 0.3), life: rnd(0.4, 0.9), r: rnd(0.8, 1.8), col: Math.random() < 0.6 ? GOLD : pickCol() }); yield; }
        f.word = null; yield* move(() => { const p = bx(); return { x: p.x + 80, y: p.y - 70 }; }, 0.35, { out: true });
      }
    };
    function* wink() {
      f.occ = null; f.word = null; f.wob = 1; f.hide = 0; let e = 0;
      while (e < 0.45) { e += dt; f.s = 1 + 0.3 * Math.sin(e * 28) * (e / 0.45) + 0.2 * e; yield; }
      f.flash = 1; for (let i = 0; i < 22; i++) { const a = rnd(0, 6.28), s = rnd(0.6, 3.2); sw.add({ x: f.x, y: f.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.5, 1.1), r: rnd(1, 2.8), star: Math.random() < 0.5, drag: 0.93 }); }
      f.a = 0; f.s = 0; yield* wait(0.1); while (sw.p.length) yield; finished = true;
    }
    function* script() {
      const names = []; const pool = ['zip', 'loop']; if (ptr.x != null && performance.now() - ptr.t < 6000) pool.push('chase', 'chase'); if (head) pool.push('hideHeading', 'hideHeading', 'hideHeading'); if (opaque.length) pool.push('hideCard', 'hideCard'); if (cards.length) pool.push('orbit'); if (pickWord(X.sec, true)) pool.push('land', 'land');
      while (names.length < 3 && pool.length) { const k = pool[Math.floor(Math.random() * pool.length)]; if (!names.includes(k)) names.push(k); for (let i = pool.length - 1; i >= 0; i--) if (pool[i] === k) pool.splice(i, 1); }
      // ignite: a spark swells into the fairy
      const from = head ? (() => { const b = tbox(head); return { x: b.right - 10, y: b.top + b.height / 2 }; })() : rp();
      f.x = clamp(from.x, 30, W - 30); f.y = clamp(from.y, hdrBottom() + 30, H - 30); f.a = 1; f.s = 0.05;
      for (let i = 0; i < 12; i++) { const a = rnd(0, 6.28), s = rnd(0.4, 2); sw.add({ x: f.x, y: f.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.4, 0.9), drag: 0.93 }); }
      yield* tween('s', 1, 0.45);
      for (const n of names) { if (T > 5.6) break; yield* B[n](); if (Math.random() < 0.5) yield* pause(rnd(0.1, 0.3)); }
      yield* wink();
    }
    let gen = script();
    function drawFairy(c, x, y, s, a, t) {
      if (a <= 0.01 || s <= 0.01) return;
      glow(c, x, y, 26 * s, a * 0.6, [109, 74, 255]); glow(c, x, y, 19 * s, a * 0.85, [91, 155, 230]); glow(c, x, y, 15 * s, a, GOLD); glow(c, x, y, 9.5 * s, a, [255, 214, 120]);
      for (let k = 0; k < 11; k++) { const an = t * (2.2 + k * 0.41) + k * 2.1, rr = (3 + ((k * 5) % 9)) * s * (0.85 + 0.15 * Math.sin(t * 5 + k)); const col = k % 3 === 0 ? WHITE : COLS[k % 6]; spark(c, x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.9, (0.9 + (k % 3) * 0.35) * s, a * (0.7 + 0.3 * Math.sin(t * 9 + k * 1.7)), col, k % 4 === 0); }
      glow(c, x, y, 8 * s, a, WHITE); glow(c, x, y, 5 * s, a, WHITE); glow(c, x, y, 3 * s, a, [255, 255, 255]);
      const gl = (0.6 + 0.4 * Math.sin(t * 8.3)) * a; cross(c, x, y, 17 * s, gl * 0.9, [255, 235, 170], 1.2);
      c.save(); c.translate(x, y); c.rotate(0.785 + Math.sin(t * 2) * 0.3); cross(c, 0, 0, 10 * s, gl * 0.6, WHITE, 1); c.restore();
    }
    return {
      hurry() { if (!hurried) { hurried = true; f.occ = null; f.word = null; gen = wink(); } },
      frame(c, t, d) {
        dt = d; T = t; f.wob = f.wob || 1;
        if (!finished) { const r = gen.next(); if (r.done) finished = true; }
        const ox = (Math.sin(t * 6.3) * 1.8 + Math.sin(t * 2.1) * 2.6) * f.wob, oy = (Math.cos(t * 5.1) * 1.8 + Math.sin(t * 3.3) * 2.2) * f.wob;
        const X0 = f.x + ox, Y0 = f.y + oy + Math.sin(t * 3.2) * 1.5;
        vel = prevOk ? Math.hypot(X0 - px, Y0 - py) / Math.max(d, 0.001) : 0; prevOk = true;
        // trail
        const vis = (1 - f.hide) * f.a; em += (16 + vel * 0.2) * d * (0.3 + 0.7 * (1 - f.hide)) * (f.a ? 1 : 0);
        while (em >= 1 && f.a) { em--; const j = 3 * f.s, vx = (px - X0) * 0.02; sw.add({ x: X0 + rnd(-j, j), y: Y0 + rnd(-j, j), vx: vx + rnd(-0.25, 0.25), vy: (py - Y0) * 0.02 + rnd(-0.25, 0.25) + 0.05, life: rnd(0.5, 1.15), r: rnd(0.8, 2.5), col: Math.random() < 0.4 ? GOLD : pickCol(), drag: 0.96 }); }
        px = X0; py = Y0; sw.step(d);
        // draw: behind a card is a clip outside its rectangle
        c.save();
        if (f.occ && f.occ.type === 'rect') { const r = f.occ.el.getBoundingClientRect(); c.beginPath(); c.rect(-10, -10, W + 20, H + 20); const rr = parseFloat(getComputedStyle(f.occ.el).borderTopLeftRadius) || 0; if (c.roundRect) c.roundRect(r.left, r.top, r.width, r.height, rr); else c.rect(r.left, r.top, r.width, r.height); c.clip('evenodd'); }
        sw.draw(c, 1 - f.hide * 0.7);
        if (f.word) { const g = f.word.g, wd = f.word.wd; const bxs = { l: -1e4, r: 1e4, t: -1e4, b: 1e4 }; const gx = wd.x - scrollX + wd.w / 2, gy = wd.y - scrollY + wd.h / 2; glow(c, gx, gy, wd.w * 0.9 + 14, g * 0.55, GOLD); drawChars(c, f.word.chars, GOLD, g * 0.95, bxs, 12 * g); }
        const sc = f.s * (1 - f.hide * 0.25); drawFairy(c, X0, Y0, sc, vis > 0 ? (1 - f.hide * 0.72) * f.a : 0, t);
        if (f.flash > 0) { glow(c, X0, Y0, 44 * f.flash + 10, f.flash, [255, 240, 200]); f.flash = Math.max(0, f.flash - d * 4); }
        c.restore();
        if (f.occ && f.occ.type === 'text' && f.a > 0) drawChars(c, f.occ.chars, null, 1, { l: X0 - 60, r: X0 + 60, t: Y0 - 60, b: Y0 + 60 });
        return finished && !sw.p.length;
      }
    };
  });
  function pickWord(sec, probe) {
    const tw = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT), hb = hdrBottom() + 30, cand = []; let n, seen = 0;
    while ((n = tw.nextNode()) && seen++ < 400) {
      const p = n.parentElement; if (!p || p.closest('h1,h2,h3,button,a,nav,.site-head,script,style,canvas,textarea,select,input') || !/\S/.test(n.nodeValue)) continue;
      const re = /[A-Za-z]{5,12}/g; let m;
      while ((m = re.exec(n.nodeValue)) && cand.length < 60) {
        const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length); const r = rg.getBoundingClientRect();
        if (r.width > 20 && r.top > hb && r.bottom < H - 40 && r.left > 20 && r.right < W - 20) { if (probe) return true; cand.push({ n, i: m.index, l: m[0].length, r }); }
      }
      if (cand.length >= 40) break;
    }
    if (probe) return false; if (!cand.length) return null;
    const k = cand[Math.floor(Math.random() * cand.length)], chars = []; charsInNode(k.n, k.i, k.i + k.l, chars, 20);
    if (!chars.length) return null; const x = Math.min(...chars.map(q => q.x)), xr = Math.max(...chars.map(q => q.x + q.w));
    return { chars, x, y: chars[0].y, w: xr - x, h: chars[0].h };
  }

  // ===== 2. Burning heading
  def('burn', 'Burning heading', true, 'head', 6.3, X => {
    const w = wrapLetters(X, X.head); if (!w) return null; const L = w.L, n = L.length, org = Math.floor(rnd(0, n)), EMB = [226, 92, 24], sw = new Swarm(60);
    L.forEach(l => { l.ts = 0.4 + Math.abs(l.i - org) * 0.08 + rnd(0, 0.12); l.arr = rnd(3.7, 5.1); l.ph = rnd(0, 6.28); l.hh = Math.random() < 0.25 ? rnd(1.3, 1.8) : rnd(0.6, 1.1); l.sx = rnd(-W, W * 2); l.sy = Math.random() < 0.5 ? -60 : H + 60; });
    function tongue(c, x, y, w, h, lean, a) {
      c.fillStyle = `rgba(255,86,22,${0.82 * a})`; c.beginPath(); c.moveTo(x - w / 2, y); c.quadraticCurveTo(x - w * 0.6, y - h * 0.55, x + lean, y - h); c.quadraticCurveTo(x + w * 0.6, y - h * 0.5, x + w / 2, y); c.closePath(); c.fill();
      c.fillStyle = `rgba(255,170,44,${0.92 * a})`; c.beginPath(); c.moveTo(x - w * 0.32, y); c.quadraticCurveTo(x - w * 0.36, y - h * 0.4, x + lean * 0.7, y - h * 0.72); c.quadraticCurveTo(x + w * 0.36, y - h * 0.35, x + w * 0.32, y); c.closePath(); c.fill();
      c.fillStyle = `rgba(255,238,160,${0.95 * a})`; c.beginPath(); c.moveTo(x - w * 0.15, y); c.quadraticCurveTo(x - w * 0.16, y - h * 0.2, x + lean * 0.4, y - h * 0.38); c.quadraticCurveTo(x + w * 0.16, y - h * 0.18, x + w * 0.15, y); c.closePath(); c.fill();
    }
    return { frame(c, t, dt) {
      const sx = scrollX, sy = scrollY;
      for (const l of L) {
        const burn = clamp((t - l.ts) / 0.5, 0, 1) * (1 - clamp((t - l.arr) / 0.5, 0, 1)), fl = burn * (1 - clamp((t - l.arr + 0.15) / 0.3, 0, 1));
        l.el.style.color = burn > 0.01 ? rgbStr(mix(w.col, EMB, burn)) : ''; l.el.style.textShadow = burn > 0.03 ? `0 0 ${5 + 7 * burn}px rgba(255,120,30,${0.85 * burn})` : '';
        const x = l.x - sx, y = l.y - sy;
        if (fl > 0.03) { const f = 0.7 + 0.3 * Math.sin(t * 13 + l.ph) * Math.sin(t * 7.3 + l.ph * 2), h = Math.min(l.h * 0.9 + 6, 40) * l.hh * fl * f, ww = Math.max(6, l.w * 1.1);
          tongue(c, x + l.w / 2 + Math.sin(t * 5 + l.ph) * 2, y + l.h * 0.86, ww, h, Math.sin(t * 6 + l.ph) * ww * 0.5, Math.min(1, fl * 1.3));
          if (Math.random() < dt * 4) sw.add({ x: x + l.w / 2, y: y + l.h * 0.3, vx: rnd(-0.3, 0.3), vy: rnd(-1.4, -0.6), life: rnd(0.6, 1.2), r: rnd(0.8, 1.6), col: [255, 150, 40], star: false, drag: 0.98 }); }
        // the sparkles that put it out
        const u = (t - (l.arr - 0.8)) / 0.8;
        if (u > 0 && u < 1.6) { const m = easeO(clamp(u, 0, 1)), px = lerp(l.sx - sx, x + l.w / 2, m), py = lerp(l.sy, y + l.h / 2, m), a = u < 1 ? 0.4 + 0.6 * m : Math.max(0, 1 - (u - 1) / 0.6); spark(c, px, py, 2.4, a, COLS[l.i % 6], l.i % 3 === 0);
          if (u > 0.95 && !l.pop) { l.pop = 1; for (let k = 0; k < 4; k++) { const an = rnd(0, 6.28), sp = rnd(0.4, 1.6); sw.add({ x: x + l.w / 2, y: y + l.h / 2, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, life: rnd(0.4, 0.8), drag: 0.93 }); } } }
      }
      sw.step(dt); sw.draw(c); return t > 6.1;
    } };
  });

  // ===== 3. Letter wave (spin in place, one after another)
  def('spinwave', 'Spinning letter wave', true, 'head', 4, X => {
    const w = wrapLetters(X, X.head); if (!w) return null; const L = w.L, stag = Math.min(0.075, 2.3 / L.length), sw = new Swarm(40), GL = [242, 169, 59];
    return { frame(c, t, dt) {
      const sx = scrollX, sy = scrollY;
      for (const l of L) { const u = (t - 0.2 - l.i * stag) / 1.0;
        if (u > 0 && u < 1) { const k = Math.sin(Math.PI * u); l.el.style.transform = `perspective(420px) translateY(${-9 * k}px) rotateY(${easeIO(u) * 360}deg) scale(${1 + 0.14 * k})`; l.el.style.color = rgbStr(mix(w.col, GL, k * 0.9));
          if (!l.g && u > 0.45) { l.g = 1; sw.add({ x: l.cx - sx, y: l.y - sy - 4, vy: -0.6, vx: rnd(-0.3, 0.3), life: 0.7, r: 1.8, col: GL, star: true }); sw.add({ x: l.cx - sx + rnd(-6, 6), y: l.y - sy, vy: -0.4, life: 0.6, r: 1.1 }); } }
        else if (u >= 1 && !l.done) { l.done = 1; l.el.style.transform = ''; l.el.style.color = ''; } }
      sw.step(dt); sw.draw(c); return t > 0.2 + L.length * stag + 1.1;
    } };
  });

  // ===== 4. Tornado
  def('tornado', 'Tornado', true, 'head', 5.8, X => {
    const w = wrapLetters(X, X.head); if (!w) return null; const L = w.L, n = L.length, sw = new Swarm(90);
    const cx0 = w.box.x + w.box.w / 2, base = w.box.y + w.box.h + 18, Hf = clamp(H * 0.34, 130, 270), Rm = clamp(W * 0.1, 60, 130);
    const order = L.map((_, i) => i).sort(() => Math.random() - 0.5); L.forEach((l, i) => { l.h = (order[i] + 0.5) / n; l.ph = rnd(0, 6.28); });
    const wgt = t => t < 0.45 ? 0 : t < 1.9 ? easeIO((t - 0.45) / 1.45) : t < 3.7 ? 1 : t < 5.1 ? 1 - easeIO((t - 3.7) / 1.4) : 0;
    const fp = (l, t) => { const th = t * 6.3 + l.ph + l.i * 2.4, rr = 12 + (0.15 + l.h) * Rm * (0.5 + 0.5 * l.h), hh = Math.pow(l.h, 0.8) * Hf; return { x: cx0 + Math.cos(th) * rr, y: base - hh + Math.sin(th) * rr * 0.28, th, depth: Math.sin(th) }; };
    return { frame(c, t, dt) {
      const sx = scrollX, sy = scrollY, k = wgt(t);
      if (t < 0.45) { const sh = Math.sin(t * 60) * 1.6 * (t / 0.45); for (const l of L) l.el.style.transform = `translateX(${sh * (l.i % 2 ? 1 : -1)}px)`; }
      else for (const l of L) { const p = fp(l, t), dx = (p.x - l.cx) * k, dy = (p.y - l.cy) * k, sc = 1 + 0.25 * p.depth * k; l.el.style.transform = k > 0.001 ? `translate(${dx}px,${dy}px) rotate(${k * (p.th * 57.3 + 40)}deg) scale(${sc})` : ''; }
      if (k > 0.02) { c.lineWidth = 1; for (let j = 0; j < 7; j++) { const h = j / 6, rr = (12 + (0.15 + h) * Rm * (0.5 + 0.5 * h)) * 1.15; c.strokeStyle = `rgba(91,155,230,${0.22 * k * (1 - h * 0.4)})`; c.beginPath(); c.ellipse(cx0 - sx, base - Math.pow(h, 0.8) * Hf - sy, rr, rr * 0.28, 0, 0, 6.283); c.stroke(); }
        if (Math.random() < dt * 55 * k) { const l = L[Math.floor(Math.random() * n)], p = fp(l, t + 0.05); sw.add({ x: p.x - sx, y: p.y - sy, vx: rnd(-0.4, 0.4), vy: rnd(-0.6, 0.2), life: rnd(0.4, 0.9), r: rnd(0.8, 2), drag: 0.95 }); } }
      sw.step(dt); sw.draw(c); return t > 5.4;
    } };
  });

  // ===== 5. Tensegrity text
  def('tensegrity', 'Tensegrity text', true, 'head', 5.4, X => {
    const w = wrapLetters(X, X.head); if (!w) return null; const L = w.L, sw = new Swarm(70), top = w.box.y - 64, tc = [29, 95, 209];
    L.forEach(l => { l.cutA = Math.random() < 0.42; l.cutB = Math.random() < 0.42; l.sag = (l.cutA ? 1 : 0) + (l.cutB ? 1 : 0); l.depth = (l.cutA ? 1 : 0) + (l.cutB ? 1 : 0); l.rot = rnd(-9, 9) * (l.cutA ? 1 : -1); l.dly = rnd(0, 0.35); l.size = rnd(10, 20); });
    const tC = 1.8, tR = 3.0;
    return { frame(c, t, dt) {
      const sx = scrollX, sy = scrollY, fadeIn = clamp(t / 0.8, 0, 1), fadeOut = 1 - clamp((t - 4.5) / 0.7, 0, 1), A = fadeIn * fadeOut;
      for (const l of L) {
        let dy = 0, rot = 0; if (t >= tC + l.dly && t < tR + l.dly) { const u = clamp((t - tC - l.dly) / 0.35, 0, 1); dy = l.sag * l.size * (1 - Math.pow(1 - u, 2)) ; rot = l.rot * l.sag * u; }
        else if (t >= tR + l.dly) { const u = t - tR - l.dly, e = Math.exp(-4.5 * u) * Math.cos(12 * u); dy = l.sag * l.size * e; rot = l.rot * l.sag * e; }
        else if (t > 0.8) dy = -1.8 * clamp((t - 0.8) / 0.5, 0, 1) * (1 - clamp((t - tC) / 0.2, 0, 1)); // taut: a little lift
        if (t >= tC + l.dly && !l.snap) { l.snap = 1; if (l.sag) { const xx = l.cx - sx, yy = l.y - sy; for (let k = 0; k < 4; k++) sw.add({ x: xx + rnd(-8, 8), y: yy - rnd(6, 30), vx: rnd(-1, 1), vy: rnd(-1.2, 0.2), life: rnd(0.4, 0.8), r: rnd(0.8, 1.6), col: [242, 169, 59], drag: 0.93 }); } }
        l.el.style.transformOrigin = '50% 0'; l.el.style.transform = (dy || rot) ? `translateY(${dy}px) rotate(${rot}deg)` : '';
        // cables from two points on the rail above down to the letter's top
        const x = l.cx - sx, y = l.y - sy + dy, ty = top - sy; if (A <= 0.01) continue;
        const prog = easeO(clamp((t - 0.1 - l.i * 0.02) / 0.7, 0, 1)); c.lineWidth = 1;
        for (const sd of [-1, 1]) { const cut = (sd < 0 ? l.cutA : l.cutB), cutNow = cut && t >= tC + l.dly && t < tR + l.dly + 0.05, ax = x + sd * 26, ay = ty;
          c.strokeStyle = `rgba(${tc[0]},${tc[1]},${tc[2]},${0.55 * A})`; c.beginPath();
          if (cutNow) { const my = lerp(ay, y, 0.4); c.moveTo(ax, ay); c.lineTo(lerp(ax, x, 0.4) + sd * 3, my); c.moveTo(x + sd * 4, y + dy * 0); c.lineTo(x, y); }
          else { c.moveTo(ax, ay); c.lineTo(lerp(ax, x, prog), lerp(ay, y, prog)); }
          c.stroke(); }
      }
      // the rail (a strut) and its end caps
      if (A > 0.01) { const x0 = w.box.x - sx - 14, x1 = w.box.x + w.box.w - sx + 14, ty = top - sy; c.strokeStyle = `rgba(14,58,117,${0.6 * A})`; c.lineWidth = 2.2; c.beginPath(); c.moveTo(x0, ty); c.lineTo(lerp(x0, x1, easeO(clamp(t / 0.6, 0, 1))), ty); c.stroke(); glow(c, x0, ty, 6, A, GOLD); glow(c, lerp(x0, x1, easeO(clamp(t / 0.6, 0, 1))), ty, 6, A, GOLD); }
      sw.step(dt); sw.draw(c); return t > 5.2;
    } };
  });

  // ===== 6. Big Bang
  def('bigbang', 'Big Bang', true, 'head', 5.6, X => {
    const w = wrapLetters(X, X.head); if (!w) return null; const L = w.L, n = L.length, sw = new Swarm(150), cx = w.box.x + w.box.w / 2, cy = w.box.y + w.box.h / 2, tr = clamp(w.box.w * 0.35, 120, 420);
    const order = L.map((_, i) => i).sort(() => Math.random() - 0.5); L.forEach((l, i) => { l.arr = 2.7 + (order[i] / n) * 1.5; l.ph = rnd(0, 6.28); l.fx = rnd(0, 6.28); l.sr = rnd(0.35, 1) * tr; });
    let burst = false;
    return { frame(c, t, dt) {
      const sx = scrollX, sy = scrollY, X0 = cx - sx, Y0 = cy - sy;
      for (const l of L) {
        let op, tx = 0, ty = 0, sc = 1;
        if (t < 0.9) { const k = easeI(t / 0.9); tx = (cx - l.cx) * k; ty = (cy - l.cy) * k; sc = 1 - 0.95 * k; op = 1 - k; }
        else if (t < l.arr) { op = 0; sc = 0.05; tx = cx - l.cx; ty = cy - l.cy; }
        else { const u = clamp((t - l.arr) / 0.5, 0, 1), k = easeO(u); tx = (cx - l.cx) * (1 - k); ty = (cy - l.cy) * (1 - k) ; sc = lerp(0.2, 1, k); op = k; if (u >= 1) { tx = ty = 0; sc = 1; op = 1; } }
        l.el.style.opacity = op >= 1 ? '' : String(op); l.el.style.transform = (tx || ty || sc !== 1) ? `translate(${tx}px,${ty}px) scale(${sc})` : '';
      }
      // the point of light, the flash, the burst
      if (t < 1.1) { const k = t / 1.1; glow(c, X0, Y0, 8 + 30 * k * k, 0.5 + 0.5 * k, GOLD); glow(c, X0, Y0, 5 + 10 * k, 1, WHITE); cross(c, X0, Y0, 6 + 24 * k, k, WHITE); }
      if (t >= 1.05 && !burst) { burst = true; for (let i = 0; i < (COARSE ? 70 : 130); i++) { const a = rnd(0, 6.28), s = Math.pow(Math.random(), 0.6) * 7.5 + 0.5; sw.add({ x: X0, y: Y0, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, life: rnd(1.4, 2.4), r: rnd(1, 3), drag: 0.955, star: Math.random() < 0.4, col: Math.random() < 0.3 ? GOLD : pickCol() }); } }
      if (t >= 1.05 && t < 1.6) { const u = (t - 1.05) / 0.55; glow(c, X0, Y0, 30 + 260 * easeO(u), (1 - u) * 0.9, [255, 235, 190]); c.strokeStyle = `rgba(242,169,59,${0.7 * (1 - u)})`; c.lineWidth = 2; c.beginPath(); c.ellipse(X0, Y0, 10 + w.box.w * 0.6 * easeO(u), 6 + w.box.h * 1.5 * easeO(u), 0, 0, 6.283); c.stroke(); }
      // sparkles settle onto the letters as they appear
      for (const l of L) { const u = (t - (l.arr - 0.7)) / 0.7; if (u > 0 && u < 1.2) { const m = easeO(clamp(u, 0, 1)), a = u < 1 ? 1 : 1 - (u - 1) / 0.2, ang = l.fx + u * 2; spark(c, lerp(X0 + Math.cos(ang) * l.sr, l.cx - sx, m), lerp(Y0 + Math.sin(ang) * l.sr * 0.5, l.cy - sy, m), 2.6, a, COLS[l.i % 6], l.i % 2 === 0); } }
      sw.step(dt); sw.draw(c); return t > 5.3;
    } };
  });

  // ===== 7. Wave of fascia
  def('fascia', 'Wave of fascia', true, 'cards', 4.6, X => {
    const items = X.items(8); if (items.length < 2) return null; items.forEach(e => holdStyle(X, e)); const sw = new Swarm(60);
    const rs = items.map(e => { const r = e.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; });
    const minX = Math.min(...rs.map(r => r.cx)), maxX = Math.max(...rs.map(r => r.cx)), minY = Math.min(...rs.map(r => r.cy)), maxY = Math.max(...rs.map(r => r.cy));
    const horiz = maxX - minX > maxY - minY, pos = rs.map(r => horiz ? (r.cx - minX) / Math.max(1, maxX - minX) : (r.cy - minY) / Math.max(1, maxY - minY)), travel = 2.4, wd = 0.7;
    return { frame(c, t, dt) {
      items.forEach((e, i) => { const u = (t - 0.2 - pos[i] * travel) / wd;
        if (u > 0 && u < 1) { const k = Math.sin(Math.PI * u); e.style.transform = `translateY(${-9 * k}px) scale(${1 + 0.014 * k})`; const r = e.getBoundingClientRect();
          if (Math.random() < dt * 40) sw.add({ x: r.left + Math.random() * r.width, y: r.top - 2, vy: -0.5, vx: rnd(-0.2, 0.2), life: rnd(0.5, 0.9), r: rnd(0.9, 1.9) }); }
        else if (u >= 1) e.style.transform = ''; });
      // a faint band travelling with the wave
      const q = clamp((t - 0.2) / travel, 0, 1); if (q > 0 && q < 1) { const x = horiz ? lerp(minX, maxX, q) : (minX + maxX) / 2, y = horiz ? (minY + maxY) / 2 : lerp(minY, maxY, q); glow(c, x, y, 70, 0.3 * Math.sin(Math.PI * q), [91, 155, 230]); }
      sw.step(dt); sw.draw(c); return t > 0.2 + travel + wd + 0.1;
    } };
  });

  // ===== 8. Constellation
  def('constellation', 'Constellation', false, null, 5.4, X => {
    const items = X.items(COARSE ? 5 : 7), nodes = [];
    const add = (el, u, v) => nodes.push({ el, u, v, t0: rnd(0.1, 1.5), col: pickCol(), star: Math.random() < 0.5 });
    items.forEach(e => { add(e, 0, 0); add(e, 1, 0); add(e, 0, 1); add(e, 1, 1); });
    if (X.head && headOk(X.head)) { add(X.head, 0, 0); add(X.head, 0.6, 1); }
    if (nodes.length < 3) { add(X.sec, 0.1, 0.1); add(X.sec, 0.9, 0.15); add(X.sec, 0.5, 0.4); add(X.sec, 0.15, 0.6); add(X.sec, 0.85, 0.7); }
    const P = nd => { const r = nd.el.getBoundingClientRect(); return { x: r.left + nd.u * r.width, y: r.top + nd.v * Math.min(r.height, H * 0.9) }; };
    const p0 = nodes.map(P), edges = [], seen = new Set();
    nodes.forEach((a, i) => { const ds = nodes.map((b, j) => ({ j, d: i === j ? 1e9 : Math.hypot(p0[i].x - p0[j].x, p0[i].y - p0[j].y) })).sort((x, y) => x.d - y.d); for (let k = 0; k < 2; k++) { const j = ds[k].j, key = Math.min(i, j) + '-' + Math.max(i, j); if (!seen.has(key)) { seen.add(key); edges.push({ a: i, b: j, t0: Math.max(a.t0, nodes[j].t0) + 0.2, ph: rnd(0, 6.28) }); } } });
    return { frame(c, t, dt) {
      const out = 1 - clamp((t - 4.3) / 1, 0, 1), hb = hdrBottom(), pts = nodes.map(P);
      c.lineWidth = 1;
      for (const e of edges) { const u = easeO(clamp((t - e.t0) / 0.9, 0, 1)); if (u <= 0) continue; const A = pts[e.a], B = pts[e.b], g = c.createLinearGradient(A.x, A.y, B.x, B.y); const ca = nodes[e.a].col, cb = nodes[e.b].col, al = 0.5 * out;
        g.addColorStop(0, `rgba(${ca[0]},${ca[1]},${ca[2]},${al})`); g.addColorStop(1, `rgba(${cb[0]},${cb[1]},${cb[2]},${al})`); c.strokeStyle = g; c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(lerp(A.x, B.x, u), lerp(A.y, B.y, u)); c.stroke();
        const q = ((t * 0.5 + e.ph) % 1.6); if (u >= 1 && q < 1) spark(c, lerp(A.x, B.x, q), lerp(A.y, B.y, q), 1.6, 0.9 * out, WHITE, false); }
      nodes.forEach((nd, i) => { const u = clamp((t - nd.t0) / 0.5, 0, 1); if (u <= 0 || pts[i].y < hb) return; const pop = 1 + 0.7 * Math.sin(Math.PI * Math.min(1, u * 1.2)); spark(c, pts[i].x, pts[i].y, 3 * pop, out * (0.75 + 0.25 * Math.sin(t * 6 + i)), nd.col, nd.star); });
      return t > 5.3;
    } };
  });

  // ===== 9. Gold shimmer
  def('shimmer', 'Gold shimmer', true, 'head', 3.8, X => {
    const w = wrapLetters(X, X.head); if (!w) return null; const L = w.L, sw = new Swarm(60), x0 = w.box.x - 90, x1 = w.box.x + w.box.w + 90, bw = Math.max(70, w.box.w * 0.12), G = [255, 196, 70];
    return { frame(c, t, dt) {
      const sx = scrollX, sy = scrollY, bx = lerp(x0, x1, easeIO(clamp((t - 0.25) / 2.6, 0, 1)));
      for (const l of L) { const k = Math.exp(-Math.pow((l.cx - bx) / bw, 2) * 1.6); l.el.style.color = k > 0.02 ? rgbStr(mix(w.col, G, Math.min(1, k * 1.1))) : ''; l.el.style.textShadow = k > 0.1 ? `0 0 ${4 + 10 * k}px rgba(242,169,59,${0.8 * k})` : ''; }
      if (t > 0.25 && t < 2.85) { for (let i = 0; i < 2; i++) sw.add({ x: bx - sx + rnd(-bw * 0.4, bw * 0.4), y: w.box.y - sy + rnd(0, w.box.h), vx: rnd(-0.2, 0.5), vy: rnd(-0.6, 0.1), life: rnd(0.5, 1), r: rnd(0.9, 2.2), col: Math.random() < 0.6 ? GOLD : WHITE }); glow(c, bx - sx, w.box.y - sy + w.box.h / 2, bw * 1.1, 0.35, [255, 214, 120]); }
      sw.step(dt); sw.draw(c); return t > 3.6;
    } };
  });

  // ===== 10. Pulley
  def('pulley', 'Pulley', true, 'head', 4.6, X => {
    const h = X.head; if (!headOk(h)) return null; holdStyle(X, h); const r0 = h.getBoundingClientRect(), tb = tbox(h), lift = clamp(r0.top - hdrBottom() - 30, 28, 92), sy0 = scrollY;
    const xl = tb.left + Math.min(26, tb.width * 0.1), xr = tb.right - Math.min(26, tb.width * 0.1), wy = tb.top + scrollY - lift - 46;
    const off = t => t < 1.4 ? -lift * easeIO(t / 1.4) : t < 1.9 ? -lift : t < 3.7 ? -lift * (1 - easeIO((t - 1.9) / 1.8)) : (() => { const u = t - 3.7; return 7 * Math.exp(-6 * u) * Math.sin(15 * u); })();
    return { frame(c, t, dt) {
      const o = off(t), A = clamp(t / 0.3, 0, 1) * (1 - clamp((t - 4.2) / 0.35, 0, 1)); h.style.transform = Math.abs(o) > 0.01 ? `translateY(${o}px)` : '';
      const y0 = wy - scrollY, ty = tb.top + o - 2, spin = -o * 0.09; c.globalAlpha = A;
      c.strokeStyle = 'rgba(14,58,117,.75)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(xl - 24, y0 - 12); c.lineTo(xr + 24, y0 - 12); c.stroke();
      for (const [x, tx] of [[xl, xl], [xr, xr]]) {
        c.beginPath(); c.moveTo(x, y0 - 12); c.lineTo(x, y0 - 8); c.stroke();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y0, 8, 0, 6.283); c.fill(); c.stroke();
        c.beginPath(); for (let k = 0; k < 3; k++) { const a = spin + k * 1.047; c.moveTo(x + Math.cos(a) * 8, y0 + Math.sin(a) * 8); c.lineTo(x - Math.cos(a) * 8, y0 - Math.sin(a) * 8); } c.stroke();
        glow(c, x, y0, 6, 1, GOLD);
        c.strokeStyle = 'rgba(120,84,40,.9)'; c.lineWidth = 1.7; c.beginPath(); c.moveTo(x - 8, y0); c.lineTo(x - 8, y0 + 4); c.moveTo(tx - 8, y0 + 4); c.lineTo(tx - 8, ty); c.moveTo(x + 8, y0); c.lineTo(x + 8, ty - 24); c.stroke();
        c.strokeStyle = 'rgba(14,58,117,.75)'; c.lineWidth = 1.5; c.fillStyle = 'rgba(120,84,40,1)'; c.beginPath(); c.arc(tx - 8, ty, 2.5, 0, 6.283); c.fill(); }
      c.globalAlpha = 1; return t > 4.5;
    } };
  });

  // ===== 11. Sparkle rain
  def('rain', 'Sparkle rain', false, null, 5.4, X => {
    let items = X.items(COARSE ? 4 : 6).filter(e => e.getBoundingClientRect().top > hdrBottom() + 14);
    if (!items.length && headOk(X.head)) items = [X.head]; if (!items.length) return null;
    const drops = []; const per = COARSE ? 8 : 14;
    items.forEach(e => { const r = e.getBoundingClientRect(), n = Math.min(per, Math.max(5, Math.round(r.width / 28))); for (let i = 0; i < n; i++) drops.push({ el: e, u: (i + rnd(0.1, 0.9)) / n, t0: rnd(0.1, 2.2), fall: rnd(0.7, 1.1), out: rnd(3.5, 4.8), col: pickCol(), star: Math.random() < 0.4, r: rnd(1.4, 2.7), dx: rnd(-14, 14), h: rnd(120, 300), bumped: false }); });
    const sw = new Swarm(60);
    return { frame(c, t, dt) {
      const hb = hdrBottom();
      for (const d of drops) { const r = d.el.getBoundingClientRect(), x = r.left + d.u * r.width, yEnd = r.top - 2; if (yEnd < hb) continue; const u = (t - d.t0) / d.fall;
        if (u < 0) continue; let y, a = 1, rr = d.r;
        if (u < 1) { y = lerp(yEnd - d.h, yEnd, u * u); a = Math.min(1, u * 4) * 0.9; spark(c, x + d.dx * (1 - u), y, rr, a, d.col, d.star); if (Math.random() < dt * 8) sw.add({ x: x + d.dx * (1 - u), y, vy: 0.2, life: 0.4, r: 0.9, col: d.col, star: false }); }
        else { if (!d.bumped) { d.bumped = true; for (let k = 0; k < 2; k++) sw.add({ x, y: yEnd, vx: rnd(-1, 1), vy: rnd(-1.6, -0.5), g: 3, life: 0.5, r: 1, col: d.col, drag: 0.96 }); }
          const bob = u < 1.4 ? Math.abs(Math.sin((u - 1) * 7)) * 5 * (1.4 - u) : 0; y = yEnd - 1 - bob; const tw = t > d.out ? clamp(1 - (t - d.out) / 0.7, 0, 1) : 1, flare = t > d.out ? 1 + 1.8 * Math.sin(Math.PI * clamp((t - d.out) / 0.7, 0, 1)) : 1; spark(c, x, y, rr * flare, tw * (0.8 + 0.2 * Math.sin(t * 8 + d.u * 20)), d.col, d.star || t > d.out); } }
      sw.step(dt); sw.draw(c); return t > 5.3;
    } };
  });

  // ===== 12. Heartbeat
  def('heartbeat', 'Heartbeat', true, 'cards', 3.6, X => {
    const items = X.items(8); if (items.length < 2) return null; items.forEach(e => holdStyle(X, e));
    const rs = items.map(e => { const r = e.getBoundingClientRect(); return r.left + r.width / 2 + r.top * 0.6; }), mn = Math.min(...rs), mxv = Math.max(...rs), delay = rs.map(v => (v - mn) / Math.max(1, mxv - mn) * 0.5);
    const beat = u => u < 0 || u > 0.8 ? 0 : u < 0.22 ? Math.sin(Math.PI * u / 0.22) : u < 0.34 ? 0 : 0.6 * Math.sin(Math.PI * clamp((u - 0.34) / 0.42, 0, 1));
    return { frame(c, t, dt) {
      items.forEach((e, i) => { let k = 0; for (const b0 of [0.2, 1.7]) k = Math.max(k, beat((t - b0 - delay[i]) / 0.95)); e.style.transform = k > 0.001 ? `scale(${1 + 0.022 * k})` : '';
        for (const b0 of [0.2, 1.7]) { const u = (t - b0 - delay[i]) / 1.1; if (u > 0 && u < 1) { const r = e.getBoundingClientRect(), g = easeO(u) * 16; c.strokeStyle = `rgba(109,74,255,${0.45 * (1 - u)})`; c.lineWidth = 1.5; rrect(c, r.left - g, r.top - g, r.width + 2 * g, r.height + 2 * g, 14 + g); c.stroke(); } } });
      return t > 3.4;
    } };
  });

  // ===== 13. Thought forming
  def('typewriter', 'Thought forming', true, 'head', 5.2, X => {
    const w = wrapLetters(X, X.head); if (!w) return null; const L = w.L, n = L.length, sw = new Swarm(80), stag = Math.min(0.075, 2.6 / n), t1 = 1.3;
    L.forEach(l => { l.sx = rnd(-0.2, 1.2) * W; l.sy = Math.random() < 0.5 ? rnd(-60, 0) : rnd(H, H + 60); l.ph = rnd(0, 6.28); });
    return { frame(c, t, dt) {
      const sx = scrollX, sy = scrollY;
      for (const l of L) { let op; const x = l.cx - sx, y = l.cy - sy;
        if (t < 0.7) { op = 1 - clamp((t - l.i / n * 0.35) / 0.35, 0, 1); if (op < 1 && !l.dis) { l.dis = 1; for (let k = 0; k < 2; k++) sw.add({ x, y: y + rnd(-6, 6), vx: rnd(-0.6, 0.6), vy: rnd(-0.9, -0.2), life: rnd(0.7, 1.2), r: rnd(0.9, 1.9), drag: 0.97 }); } }
        else { const ta = t1 + l.i * stag, u = (t - ta) / 0.45; op = u >= 1 ? 1 : u > 0 ? easeO(u) : 0;
          const fu = (t - (ta - 0.6)) / 0.6; if (fu > 0 && fu < 1) { const m = easeIO(fu); spark(c, lerp(l.sx, x, m), lerp(l.sy, y, m) + Math.sin(fu * 9 + l.ph) * 12 * (1 - fu), 2.3, 0.4 + 0.6 * m, COLS[l.i % 6], l.i % 2 === 0); }
          if (u > 0 && u < 0.3 && !l.pop) { l.pop = 1; glow(c, x, y, 26, 0.8, GOLD); for (let k = 0; k < 3; k++) { const a = rnd(0, 6.28); sw.add({ x, y, vx: Math.cos(a), vy: Math.sin(a), life: 0.5, r: 1.2, col: GOLD, drag: 0.9 }); } }
          if (u > 0 && u < 0.5) glow(c, x, y, 24 * (1 - u * 2), 0.7 * (1 - u * 2), GOLD); }
        l.el.style.opacity = op >= 1 ? '' : String(op); }
      // a blinking caret of light at the next letter
      const nx = clamp(Math.floor((t - t1) / stag), -1, n - 1) + 1; if (t > t1 - 0.3 && nx <= n && t < t1 + n * stag + 0.9) { const l = L[Math.min(nx, n - 1)], cx = nx >= n ? l.x + l.w : l.x; if (Math.floor(t * 4) % 2 === 0) { c.fillStyle = 'rgba(242,169,59,.9)'; c.fillRect(cx - sx - 1, l.y - sy + l.h * 0.12, 2, l.h * 0.76); glow(c, cx - sx, l.cy - sy, 10, 0.5, GOLD); } }
      sw.step(dt); sw.draw(c); return t > t1 + n * stag + 0.9;
    } };
  });

  // ===== 14. Magnet
  def('magnet', 'Magnet', false, null, 5.4, X => {
    const sw = new Swarm(COARSE ? 60 : 100), N = COARSE ? 44 : 80, parts = [];
    for (let i = 0; i < N; i++) { const e = Math.floor(rnd(0, 4)); parts.push({ x: e < 2 ? rnd(0, W) : e === 2 ? -20 : W + 20, y: e === 0 ? -20 : e === 1 ? H + 20 : rnd(hdrBottom(), H), vx: 0, vy: 0, r: rnd(1.2, 2.8), col: pickCol(), star: Math.random() < 0.4, d: rnd(0, 0.9), tw: rnd(0, 6.28) }); }
    const target = t => (ptr.x != null && performance.now() - ptr.t < 7000) ? { x: ptr.x, y: ptr.y, live: 1 } : { x: W / 2 + Math.sin(t * 0.9) * W * 0.22, y: lerp(hdrBottom(), H, 0.5) + Math.cos(t * 1.3) * H * 0.15, live: 0 };
    return { frame(c, t, dt) {
      const tg = target(t), k = dt * 60, rel = t > 4.3, A = clamp(t / 0.5, 0, 1) * (1 - clamp((t - 4.6) / 0.7, 0, 1));
      for (const p of parts) { if (t < p.d) continue; const dx = tg.x - p.x, dy = tg.y - p.y, d = Math.hypot(dx, dy) + 1, f = rel ? -0.05 : 0.9 / (1 + d / 60) + 0.12;
        p.vx += (dx / d * f + (-dy / d) * 0.5 * Math.min(1, 160 / d) * (rel ? 0 : 1)) * 0.1 * k; p.vy += (dy / d * f + (dx / d) * 0.5 * Math.min(1, 160 / d) * (rel ? 0 : 1)) * 0.1 * k;
        const sp = Math.hypot(p.vx, p.vy), mx = 9; if (sp > mx) { p.vx *= mx / sp; p.vy *= mx / sp; } const dr = Math.pow(0.975, k); p.vx *= dr; p.vy *= dr; p.x += p.vx * k; p.y += p.vy * k;
        spark(c, p.x, p.y, p.r, A * (0.75 + 0.25 * Math.sin(t * 9 + p.tw)), p.col, p.star); if (Math.random() < dt * 1.5) sw.add({ x: p.x, y: p.y, life: 0.4, r: 0.9, col: p.col, star: false, vx: -p.vx * 0.2, vy: -p.vy * 0.2 }); }
      glow(c, tg.x, tg.y, 26 * A, 0.28 * A, GOLD); sw.step(dt); sw.draw(c); return t > 5.3;
    } };
  });

  // ===== 15. Comet
  def('comet', 'Comet', false, null, 4.4, X => {
    const h = headOk(X.head) ? X.head : null, tb = h ? tbox(h) : { left: W * 0.3, right: W * 0.7, top: H * 0.3, bottom: H * 0.4, width: W * 0.4, height: H * 0.1 }; const chars = h ? charsOf(h, 90) : [];
    const dir = Math.random() < 0.5 ? 1 : -1, hx = (tb.left + tb.right) / 2, hy = tb.top + tb.height / 2, sx0 = scrollX, sy0 = scrollY;
    const P0 = { x: dir > 0 ? -70 : W + 70, y: hy - rnd(160, 230) }, P2 = { x: dir > 0 ? W + 70 : -70, y: hy + rnd(90, 160) };
    const P1 = { x: (hx - 0.25 * P0.x - 0.25 * P2.x) / 0.5, y: (hy - 0.25 * P0.y - 0.25 * P2.y) / 0.5 }, hist = [], sw = new Swarm(120), dur = 1.9, tPass = 0.2 + dur * 0.5;
    const pos = u => { const q = 1 - u; return { x: q * q * P0.x + 2 * q * u * P1.x + u * u * P2.x, y: q * q * P0.y + 2 * q * u * P1.y + u * u * P2.y }; };
    return { frame(c, t, dt) {
      const u = clamp((t - 0.2) / dur, 0, 1), m = Math.pow(u, 0.85), p = pos(m), ox = scrollX - sx0, oy = scrollY - sy0; const ppx = p.x, ppy = p.y - 0;
      if (u > 0 && u < 1) { hist.push({ x: ppx, y: ppy }); if (hist.length > 26) hist.shift(); for (let i = 0; i < 3; i++) sw.add({ x: ppx + rnd(-4, 4), y: ppy + rnd(-4, 4), vx: rnd(-0.4, 0.4), vy: rnd(-0.4, 0.5), life: rnd(0.5, 1.2), r: rnd(0.9, 2.6), col: Math.random() < 0.5 ? GOLD : pickCol(), drag: 0.96 }); }
      else if (hist.length) hist.shift();
      // tapered tail
      for (let i = 1; i < hist.length; i++) { const a = i / hist.length; c.strokeStyle = `rgba(255,${Math.round(150 + 80 * a)},${Math.round(60 + 90 * a)},${0.55 * a * a})`; c.lineWidth = 1 + 7 * a * a; c.lineCap = 'round'; c.beginPath(); c.moveTo(hist[i - 1].x, hist[i - 1].y); c.lineTo(hist[i].x, hist[i].y); c.stroke(); }
      if (u > 0 && u < 1) { glow(c, ppx, ppy, 30, 0.8, [109, 74, 255]); glow(c, ppx, ppy, 20, 1, GOLD); glow(c, ppx, ppy, 11, 1, WHITE); glow(c, ppx, ppy, 5, 1, [255, 255, 255]); cross(c, ppx, ppy, 18, 0.8, WHITE, 1.2); }
      // the heading glows for a moment after the comet passes
      const g = t > tPass ? Math.exp(-(t - tPass) * 1.1) * clamp((t - tPass) / 0.25, 0, 1) : 0;
      if (g > 0.02 && h) { const sx = -ox, sy = -oy; glow(c, hx + sx, hy + sy, Math.max(tb.width * 0.6, 90), g * 0.35, GOLD); drawChars(c, chars.map(q => q), [255, 190, 60], g, null, 14 * g); }
      sw.step(dt); sw.draw(c); return t > 4.2;
    } };
  });

  // ===== 16. Mirror: me / not me
  def('mirror', 'Mirror: me and not me', false, 'head', 4.4, X => {
    const h = headOk(X.head) ? X.head : null; if (!h) return null; const chars = charsOf(h, 100); if (!chars.length) return null; const base = parseRGB(getComputedStyle(h).color), light = base[0] + base[1] + base[2] > 540, gc = light ? [170, 205, 255] : [109, 74, 255], sw = new Swarm(60);
    const cx = chars.reduce((s, q) => s + q.x + q.w / 2, 0) / chars.length, cy = chars[0].y + chars[0].h / 2;
    const off = t => { const sep = easeIO(clamp((t - 0.2) / 0.9, 0, 1)) * (1 - easeIO(clamp((t - 3.0) / 0.9, 0, 1))); return { x: sep * (26 + 10 * Math.sin(t * 1.7)), y: sep * (-22 + 7 * Math.sin(t * 2.3)), s: 1 + 0.05 * sep, k: sep }; };
    return { frame(c, t, dt) {
      const o = off(t), sx = scrollX, sy = scrollY; if (o.k > 0.005) {
        c.save(); c.translate(cx - sx + o.x, cy - sy + o.y); c.scale(o.s, o.s); c.translate(-(cx - sx), -(cy - sy)); const fl = 0.8 + 0.2 * Math.sin(t * 17) * Math.sin(t * 5);
        c.shadowColor = `rgba(${gc[0]},${gc[1]},${gc[2]},.9)`; c.shadowBlur = 10; drawChars(c, chars, gc, 0.5 * o.k * fl); c.restore();
        c.lineWidth = 1; for (let i = 0; i < chars.length; i += 3) { const q = chars[i]; c.strokeStyle = `rgba(${gc[0]},${gc[1]},${gc[2]},${0.3 * o.k})`; c.beginPath(); c.moveTo(q.x - sx + q.w / 2, q.y - sy + q.h * 0.5); c.lineTo(q.x - sx + q.w / 2 + o.x, q.y - sy + q.h * 0.5 + o.y); c.stroke(); if (Math.random() < dt * 4) sw.add({ x: q.x - sx + q.w / 2 + o.x * Math.random(), y: q.y - sy + q.h / 2 + o.y * Math.random(), life: 0.6, r: 1.2, col: [gc[0], gc[1], gc[2]], vy: -0.3 }); } }
      if (t > 3.8 && t < 4.3) { const u = (t - 3.8) / 0.5; for (let i = 0; i < chars.length; i += 2) { const q = chars[i]; cross(c, q.x - sx + q.w / 2, q.y - sy + q.h * 0.4, 8 * Math.sin(Math.PI * u), 0.9, WHITE, 1); } }
      sw.step(dt); sw.draw(c); return t > 4.3;
    } };
  });

  // ===== 17. Galaxy
  def('galaxy', 'Galaxy', false, null, 5.6, X => {
    const h = headOk(X.head) ? X.head : null, tb = h ? tbox(h) : null, ccx = tb ? tb.left + tb.width / 2 : W / 2, ccy = tb ? tb.top + tb.height / 2 : H / 2, R0 = Math.min(W * 0.46, H * 0.42, 340), arms = 3, per = COARSE ? 24 : 42, pts = [];
    for (let a = 0; a < arms; a++) for (let i = 0; i < per; i++) pts.push({ a, s: (i + rnd(0, 1)) / per, j: rnd(-0.18, 0.18), r: rnd(0.9, 2.4), tw: rnd(0, 6.28), star: Math.random() < 0.3 });
    const cs = scrollY;
    return { frame(c, t, dt) {
      const grow = easeO(clamp(t / 1.5, 0, 1)), A = clamp(t / 0.5, 0, 1) * (1 - clamp((t - 4.5) / 1, 0, 1)), rot = t * 0.7, out = 1 + 0.25 * clamp((t - 4.5) / 1, 0, 1), cx = ccx, cy = ccy - (scrollY - cs);
      glow(c, cx, cy, 50 * grow * out, 0.55 * A, [255, 214, 120]); glow(c, cx, cy, 22 * grow, 0.9 * A, WHITE);
      for (const p of pts) { const rr = R0 * grow * out * Math.pow(p.s, 0.85) + 4, an = p.a * 6.283 / arms + 3.4 * p.s + p.j + rot * (1.1 - p.s * 0.6), x = cx + Math.cos(an) * rr, y = cy + Math.sin(an) * rr * 0.5; const col = p.s < 0.25 ? GOLD : p.s < 0.6 ? [91, 155, 230] : [109, 74, 255];
        spark(c, x, y, p.r * (1.2 - p.s * 0.4), A * (0.5 + 0.5 * Math.sin(t * 5 + p.tw)) * (1 - p.s * 0.2), col, p.star); }
      return t > 5.5;
    } };
  });

  // ===== 18. Helix (DNA)
  def('helix', 'Helix', false, null, 5.4, X => {
    const h = headOk(X.head) ? X.head : null, tb = h ? tbox(h) : null, Am = clamp(H * 0.08, 30, 58), cy0 = tb ? tb.top - Am - 16 : H * 0.4, cyb = clamp(cy0, hdrBottom() + Am + 14, H - Am - 30), cs = scrollY, step = Math.max(11, W / (COARSE ? 36 : 64));
    return { frame(c, t, dt) {
      const cy = (tb && Math.abs(cy0 - cyb) < 1) ? cy0 - (scrollY - cs) : cyb, front = lerp(-40, W + 60, easeIO(clamp(t / 1.9, 0, 1))), back = lerp(-40, W + 60, easeIO(clamp((t - 3.4) / 1.8, 0, 1))), ph = t * 2.4;
      for (let x = Math.ceil(back / step) * step; x < front; x += step) {
        const an = x * 0.032 + ph, y1 = cy + Math.sin(an) * Am, y2 = cy - Math.sin(an) * Am, d1 = Math.cos(an), edge = Math.min(1, (front - x) / 80, (x - back) / 80), a = edge;
        if (Math.round(x / step) % 3 === 0) { c.strokeStyle = `rgba(109,74,255,${0.28 * a})`; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y1); c.lineTo(x, y2); c.stroke(); const m = (y1 + y2) / 2; spark(c, x, m, 1.2, 0.7 * a, [214, 120, 210], false); }
        spark(c, x, y1, 2 + 0.9 * d1, a * (0.8 + 0.2 * d1), [29, 95, 209], d1 > 0.85); spark(c, x, y2, 2 - 0.9 * d1, a * (0.8 - 0.2 * d1), GOLD, d1 < -0.85);
      }
      return t > 5.3;
    } };
  });

  // ---------------------------------------------------------------- targets, assignment, triggers
  const targets = [];
  function collect() {
    const secs = [...document.querySelectorAll('.page-head, section')].filter(s => !s.closest('.site-head,.site-foot') && !(s.parentElement && s.parentElement.closest('section,.page-head')));
    secs.forEach((sec, i) => {
      const hd = [...sec.querySelectorAll('h1,h2')].find(h => !h.closest('.card,.site-head')) || null;
      targets.push({ sec, head: hd, safe: !sec.querySelector('canvas,input,textarea,select,form'), nitems: sec.querySelectorAll('.card, .grid > *, .tile, p').length, isHead: sec.classList.contains('page-head') || i === 0 && sec.classList.contains('page-head'), fired: false, i, name: null });
    });
    const off = hash(page) % ORDER.length;
    targets.forEach((tg, i) => {
      let name = null;
      for (let k = 0; k < ORDER.length; k++) { const n = ORDER[(off + i + k) % ORDER.length], d = DEF[n]; if (!feasible(d, tg) || n === (targets[i - 1] && targets[i - 1].name)) continue; name = n; break; }
      tg.name = name || 'fairy';
    });
    if (targets.length && !targets.some(t => t.name === 'fairy')) { const k = targets.length > 1 ? 1 + hash(page) % (targets.length - 1) : 0; targets[k].name = 'fairy'; }
  }
  const alts = name => { const i = ORDER.indexOf(name), r = []; for (let k = 0; k < ORDER.length; k++) r.push(ORDER[(i + k) % ORDER.length]); return r; };
  let lastName = '';
  function fire(tg) {
    tg.fired = true; if (!enabled || REDUCE || document.hidden || !cvOK()) return;
    const names = alts(tg.name).filter((n, i) => i === 0 || n !== lastName); const r = launch(names, tg, false); if (r) lastName = typeof r === 'string' ? r : tg.name;
  }
  function check() {
    if (!targets.length || REDUCE) return;
    for (let i = 0; i < targets.length; i++) {
      const tg = targets[i]; if (tg.fired) continue; const r = tg.sec.getBoundingClientRect();
      if (tg.isHead) { if (scrollY > 6 || performance.now() - t0 > 1500) { if (r.bottom > H * 0.2 && r.top < H) { fire(tg); } else tg.fired = true; } continue; }
      if (r.top <= H * 0.34 && r.bottom > H * 0.14) { for (let j = 0; j < i; j++) targets[j].fired = true; fire(tg); }
    }
    if (targets.every(t => t.fired)) { clearInterval(iv); iv = 0; }
  }
  const t0 = performance.now(); let iv = 0, tick2 = 0;
  const start = () => { if (!iv) iv = setInterval(check, 500); };

  // ---------------------------------------------------------------- the control
  function currentTarget() {
    let best = null, bd = 1e9; for (const tg of targets) { const r = tg.sec.getBoundingClientRect(); if (r.bottom < H * 0.2 || r.top > H * 0.8) continue; const d = Math.abs(r.top - H * 0.25); if (d < bd && r.top <= H * 0.5) { bd = d; best = tg; } }
    return best || targets.find(tg => { const r = tg.sec.getBoundingClientRect(); return r.bottom > H * 0.2 && r.top < H * 0.8; }) || targets[0];
  }
  function resolveTarget(sec) {
    if (!sec && sec !== 0) return currentTarget(); if (typeof sec === 'number') return targets[sec]; if (sec.nodeType) return targets.find(t => t.sec === sec || t.sec.contains(sec)) || currentTarget(); return currentTarget();
  }
  function play(name, sec) {
    if (REDUCE) return false; const d = DEF[name] || Object.values(DEF).find(x => x.label === name); if (!d) return false; const tg = resolveTarget(sec); if (!tg) return false;
    if (!cvOK()) { say('The page fire is running. Try again in a moment.', 2200); return false; }
    if (!feasible(d, tg)) { say(!tg.safe && d.mover ? 'This section holds a toy, so this effect is skipped here.' : 'This section has nothing for that effect.', 2200); return false; }
    if (running.length >= 2) { hurry(running[0]); stopOldest(); }
    return !!startFx(d, tg);
  }
  function stopOldest() { if (running.length >= 2) finish(running[0]); }
  function replayAll() { stopAll(); targets.forEach(t => { t.fired = false; }); try { scrollTo({ top: 0, behavior: 'auto' }); } catch (e) { scrollTo(0, 0); } say('Replaying. Scroll down to see each one.', 2500); setStart(); }
  function setStart() { tStart = performance.now(); start(); }
  let tStart = t0;

  function buildUI() {
    document.body.appendChild(pill); document.body.appendChild(label);
    if (REDUCE) { pill.classList.add('off'); pill.innerHTML = '<i aria-hidden="true"></i><b style="font-weight:600">Effects are off (reduced motion setting)</b>'; pill.setAttribute('aria-disabled', 'true'); return; }
    panel.innerHTML = '<h4>Effects demo</h4><label class="fxd-sw"><input type="checkbox" class="fxd-on"> <span>Effects on as I scroll</span></label>';
    ORDER.forEach(id => { const row = document.createElement('div'); row.className = 'fxd-row'; row.innerHTML = '<span></span><button type="button">play</button>'; row.firstChild.textContent = DEF[id].label; row.lastChild.setAttribute('aria-label', 'Play ' + DEF[id].label); row.lastChild.addEventListener('click', () => play(id)); panel.appendChild(row); });
    const all = document.createElement('button'); all.type = 'button'; all.className = 'fxd-all'; all.textContent = 'Replay all on this page'; all.addEventListener('click', replayAll); panel.appendChild(all);
    document.body.appendChild(panel);
    const sw = panel.querySelector('.fxd-on'); sw.checked = enabled; sw.addEventListener('change', () => { enabled = sw.checked; store.set('fxdemo-off', enabled ? '0' : '1'); if (!enabled) stopAll(); say(enabled ? 'Effects on' : 'Effects off'); });
    pill.addEventListener('click', () => { const o = !panel.classList.contains('open'); panel.classList.toggle('open', o); pill.setAttribute('aria-expanded', String(o)); label.classList.remove('on'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('open')) { panel.classList.remove('open'); pill.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('click', e => { if (panel.classList.contains('open') && !panel.contains(e.target) && !pill.contains(e.target)) { panel.classList.remove('open'); pill.setAttribute('aria-expanded', 'false'); } });
  }

  window.fxDemo = { list: () => ORDER.map(id => DEF[id].label), ids: () => ORDER.slice(), play, running: () => running.map(f => f.def.id), errors: () => errors.slice(), plan: () => targets.map(t => ({ name: t.name, head: t.head ? t.head.textContent.trim().slice(0, 40) : null, safe: t.safe })), stop: stopAll };
  function init() {
    buildUI(); if (REDUCE) return; collect();
    let ticking = false; addEventListener('scroll', () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; check(); }); }, { passive: true });
    start(); setTimeout(check, 1600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
