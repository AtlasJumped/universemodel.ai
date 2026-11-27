// Universe Model: a trail of cosmic sparkles behind the mouse pointer (owner request 2026-11-19a).
// The pointer itself is unchanged. Mouse only; off for reduced motion.
(() => {
  if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60';
  document.body.appendChild(cv);
  const c = cv.getContext('2d');
  const COLS = [[29, 95, 209], [91, 155, 230], [109, 74, 255], [242, 169, 59], [14, 58, 117], [214, 120, 210]];
  let w = 0, h = 0, px = null, py = null, running = false;
  const parts = [];
  function size() { const d = Math.min(2, devicePixelRatio || 1); w = innerWidth; h = innerHeight; cv.width = w * d; cv.height = h * d; c.setTransform(d, 0, 0, d, 0, 0); }
  function spawn(x, y, n) {
    for (let i = 0; i < n && parts.length < 260; i++) {
      const a = Math.random() * 6.283, s = 0.15 + Math.random() * 0.9;
      parts.push({ x: x + (Math.random() - .5) * 8, y: y + (Math.random() - .5) * 8, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 0.12,
        r: 0.8 + Math.random() * 2.6, life: 1, decay: 0.008 + Math.random() * 0.018, tw: Math.random() * 6.283, col: COLS[Math.floor(Math.random() * COLS.length)], star: Math.random() < 0.35 });
    }
  }
  function frame() {
    c.clearRect(0, 0, w, h);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vx *= 0.985; p.vy *= 0.985; p.life -= p.decay; p.tw += 0.25;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      const a = p.life * (0.55 + 0.45 * Math.sin(p.tw)), [r, g, b] = p.col, R = p.r * (0.6 + 0.4 * p.life);
      const gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * 4);
      gr.addColorStop(0, `rgba(${r},${g},${b},${0.85 * a})`); gr.addColorStop(0.35, `rgba(${r},${g},${b},${0.35 * a})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.fillStyle = gr; c.beginPath(); c.arc(p.x, p.y, R * 4, 0, 6.283); c.fill();
      if (p.star) { // a four-pointed glint
        c.strokeStyle = `rgba(${r},${g},${b},${a})`; c.lineWidth = 1.1;
        c.beginPath(); c.moveTo(p.x - R * 3.2, p.y); c.lineTo(p.x + R * 3.2, p.y); c.moveTo(p.x, p.y - R * 3.2); c.lineTo(p.x, p.y + R * 3.2); c.stroke();
      }
    }
    if (parts.length) requestAnimationFrame(frame); else { running = false; c.clearRect(0, 0, w, h); }
  }
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const x = e.clientX, y = e.clientY;
    if (px !== null) { const d = Math.hypot(x - px, y - py), n = Math.min(6, Math.ceil(d / 9)); for (let k = 0; k < n; k++) spawn(px + (x - px) * k / n, py + (y - py) * k / n, 1); }
    px = x; py = y;
    if (!running) { running = true; requestAnimationFrame(frame); }
  }, { passive: true });
  addEventListener('resize', size); size();
})();

// Universe Model: a slow cloud of the same sparkles around the name in the top bar (owner request 2026-11-19d), and the same
// cloud through the whole footer, gathered around the name there (owner request 2026-11-20f). It is always gently alive and
// stirs when the pointer moves anywhere on the page. In the top bar it fades out where the menu starts.
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLS = [[29, 95, 209], [91, 155, 230], [109, 74, 255], [242, 169, 59], [14, 58, 117], [214, 120, 210]];
  function aura(host, brand, whole) {
    const cv = document.createElement('canvas'); cv.className = whole ? 'foot-aura' : 'brand-aura'; cv.setAttribute('aria-hidden', 'true'); host.insertBefore(cv, host.firstChild);
    const c = cv.getContext('2d'), parts = []; let w = 0, h = 0, bx = 0, by = 0, bw = 0, bh = 0, want = 36, energy = 0, dx = 0, dy = 0, px = null, py = null, last = 0, seen = !whole;
    function size() { const r = brand.getBoundingClientRect(), hr = host.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
      w = whole ? hr.width : Math.max(120, Math.min(hr.width, r.right - hr.left + 110)); h = hr.height;
      bx = r.left - hr.left - 40; by = r.top - hr.top - 26; bw = r.width + 150; bh = r.height + 52;
      want = whole ? Math.max(50, Math.min(150, Math.round(w * h / 5600))) : 36;
      cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = w * d; cv.height = h * d; c.setTransform(d, 0, 0, d, 0, 0); if (still) draw(); }
    function spawn(stirred) { const a = Math.random() * 6.283, s = 0.06 + Math.random() * 0.2, near = false; // the footer's cloud is even across its whole width (owner, 2026-11-20)
      const x = whole ? (near ? bx + Math.random() * bw : Math.random() * w) : Math.random() * w * 0.94, y = near ? by + Math.random() * bh : 4 + Math.random() * (h - 8);
      parts.push({ x, y, vx: Math.cos(a) * s + (stirred ? dx * 0.35 : 0), vy: Math.sin(a) * s * 0.6 + (stirred ? dy * 0.2 : 0),
        r: 0.7 + Math.random() * 2.3, age: 0, life: stirred ? 90 + Math.random() * 90 : 190 + Math.random() * 220, tw: Math.random() * 6.283, col: COLS[Math.floor(Math.random() * COLS.length)], star: Math.random() < 0.35 }); }
    function draw() { c.clearRect(0, 0, w, h);
      for (const p of parts) { const u = Math.min(1, p.age / p.life), env = Math.min(1, u * 14, (1 - u) * 14), a = env * (0.8 + 0.14 * Math.sin(p.tw)), [r, g, b] = p.col, R = p.r;
        const gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * 4);
        gr.addColorStop(0, `rgba(${r},${g},${b},${0.8 * a})`); gr.addColorStop(0.35, `rgba(${r},${g},${b},${0.32 * a})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
        c.fillStyle = gr; c.beginPath(); c.arc(p.x, p.y, R * 4, 0, 6.283); c.fill();
        if (p.star) { c.strokeStyle = `rgba(${r},${g},${b},${a})`; c.lineWidth = 1; c.beginPath(); c.moveTo(p.x - R * 3, p.y); c.lineTo(p.x + R * 3, p.y); c.moveTo(p.x, p.y - R * 3); c.lineTo(p.x, p.y + R * 3); c.stroke(); } } }
    function frame(t) { requestAnimationFrame(frame); if (!seen || t - last < 33) return; last = t; // about 30 frames a second is plenty for something this slow
      let n = 0; while (parts.length < want && n++ < 3) spawn(energy > 0.15);
      for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vx *= 0.992; p.vy *= 0.992; p.age++; p.tw += 0.09; if (p.age >= p.life || p.x < -12 || p.x > w + 12) parts.splice(i, 1); }
      energy *= 0.95; draw(); }
    addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; if (px !== null) { const mx = e.clientX - px, my = e.clientY - py, d = Math.hypot(mx, my); if (d > 0) { energy = Math.min(1, energy + d / 500); dx = dx * 0.8 + mx / d * 0.2; dy = dy * 0.8 + my / d * 0.2; } } px = e.clientX; py = e.clientY; }, { passive: true });
    addEventListener('resize', size); addEventListener('load', size); size();
    if (whole && 'IntersectionObserver' in window) new IntersectionObserver(es => { seen = es[0].isIntersecting; if (seen) size(); }).observe(host); else seen = true;
    const seed = n => { for (let i = 0; i < n; i++) { spawn(false); parts[i].age = parts[i].life * (still ? 0.3 + Math.random() * 0.4 : Math.random() * 0.8); } };
    if (still) { seed(Math.round(want * 0.78)); draw(); return; }
    seed(want); requestAnimationFrame(frame);
  }
  const head = document.querySelector('.site-head'), hb = head && head.querySelector('.brand'); if (hb) aura(head, hb, false);
  const foot = document.querySelector('.site-foot'), fb = foot && foot.querySelector('.brand'); if (fb) aura(foot, fb, true);
})();

// Universe Model: one clock for the top bar (owner request 2026-11-20e). The letters UM turn once per cycle. Facing front, they
// flash gold and a band of colour leaves them; it reaches "Get in touch" as the letters face away, and the button lights up,
// throws a short burst of the same sparkles and winks. The CSS holds the animations; this lines their clocks up, tells the CSS
// where the monogram and the button are, and draws the burst.
(() => {
  const head = document.querySelector('.site-head'); if (!head || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const lg = head.querySelector('.brand .lg'), cta = head.querySelector('.nav .cta'); if (!lg || !cta) return;
  const CYC = 8000, NAMES = /^(headsheen|umspin|umgold)/;
  const COLS = [[242, 169, 59], [91, 155, 230], [109, 74, 255], [242, 169, 59], [214, 120, 210], [255, 255, 255]];
  const inBar = () => { const r = cta.getBoundingClientRect(), h = head.getBoundingClientRect(); return r.width > 0 && r.top >= h.top - 1 && r.bottom <= h.bottom + 1; };
  const pos = x => (75 - 50 * x / innerWidth).toFixed(2) + '%';
  // the cycle starts when the page arrives: UM facing front and gold, the band just leaving it (owner, 2026-11-20)
  const clock = () => document.timeline ? document.timeline.currentTime : performance.now(), t0 = clock();
  function place() { if (!(innerWidth > 0)) return; // a hidden window has no width yet; the CSS defaults stand until it is shown
    const a = lg.getBoundingClientRect(); head.style.setProperty('--hp0', pos(a.left + a.width / 2));
    const b = cta.getBoundingClientRect(); head.style.setProperty('--hp1', pos(inBar() ? b.left + b.width * 0.3 : innerWidth * 0.94)); }
  function sync() { if (!document.getAnimations) return;
    for (const an of document.getAnimations()) { const t = an.effect && an.effect.target; if (t && head.contains(t) && NAMES.test(an.animationName || '')) { try { an.startTime = t0; } catch (e) {} } } }
  const cv = document.createElement('canvas'); cv.className = 'cta-burst'; cv.setAttribute('aria-hidden', 'true'); head.appendChild(cv);
  const c = cv.getContext('2d'), parts = []; let w = 0, h = 0, ox = 0, oy = 0, running = false;
  function fit() { const r = cta.getBoundingClientRect(), hr = head.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1), m = 90;
    const left = Math.max(0, r.left - m), right = Math.min(innerWidth, r.right + m); w = right - left; h = hr.height + 64;
    cv.style.left = (left - hr.left) + 'px'; cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = w * d; cv.height = h * d; c.setTransform(d, 0, 0, d, 0, 0);
    ox = r.left - left; oy = r.top - hr.top; return r; }
  let passes = 0;
  function wink() { cta.classList.remove('wink'); void cta.offsetWidth; cta.classList.add('wink'); setTimeout(() => cta.classList.remove('wink'), 2000); }
  // the sparkles and the wink come together, on the first pass of the band and then on every tenth (owner, 2026-11-20)
  function burst() { if (document.hidden || !inBar()) return; if (passes++ % 10 !== 0) return; cta.classList.remove('lit'); void cta.offsetWidth; cta.classList.add('lit'); setTimeout(() => cta.classList.remove('lit'), 1800); setTimeout(wink, 240); const r = fit();
    for (let i = 0; i < 38; i++) { const u = Math.random(), side = Math.random() < 0.5, x = ox + u * r.width, y = oy + (side ? 0 : r.height), a = (side ? -1 : 1) * (0.25 + Math.random() * 2.64), s = 0.5 + Math.random() * 1.9;
      parts.push({ x, y, vx: Math.cos(a) * s * (u < 0.5 ? -1 : 1) * (Math.random() < 0.5 ? 1 : 0.4), vy: Math.sin(a) * s * 0.7, r: 0.8 + Math.random() * 2.4, age: 0, life: 34 + Math.random() * 38, tw: Math.random() * 6.283, col: COLS[Math.floor(Math.random() * COLS.length)], star: Math.random() < 0.5 }); }
    if (!running) { running = true; requestAnimationFrame(frame); } }
  function frame() { c.clearRect(0, 0, w, h);
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vx *= 0.965; p.vy = p.vy * 0.965 + 0.012; p.age++; p.tw += 0.3; if (p.age >= p.life) { parts.splice(i, 1); continue; }
      const u = p.age / p.life, a = Math.min(1, u * 8, (1 - u) * 2.2) * (0.8 + 0.2 * Math.sin(p.tw)), [r, g, b] = p.col, R = p.r;
      const gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * 4); gr.addColorStop(0, `rgba(${r},${g},${b},${0.9 * a})`); gr.addColorStop(0.35, `rgba(${r},${g},${b},${0.36 * a})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.fillStyle = gr; c.beginPath(); c.arc(p.x, p.y, R * 4, 0, 6.283); c.fill();
      if (p.star) { c.strokeStyle = `rgba(${r},${g},${b},${a})`; c.lineWidth = 1.1; c.beginPath(); c.moveTo(p.x - R * 3.4, p.y); c.lineTo(p.x + R * 3.4, p.y); c.moveTo(p.x, p.y - R * 3.4); c.lineTo(p.x, p.y + R * 3.4); c.stroke(); } }
    if (parts.length) requestAnimationFrame(frame); else { running = false; c.clearRect(0, 0, w, h); } }
  let timer = 0;
  function arm() { clearTimeout(timer); const now = clock() - t0, wait = ((0.5 * CYC - (now % CYC)) + CYC) % CYC;
    timer = setTimeout(() => { burst(); setTimeout(arm, 400); }, Math.max(30, wait)); }
  // when the button is not in the bar (the Menu panel is in use), park the burst canvas so it never widens the page (2026-11-27)
  const park = () => { if (!inBar()) { cv.style.left = '0px'; cv.style.width = '0px'; cv.width = 0; } };
  const again = () => { place(); sync(); park(); arm(); };
  addEventListener('resize', again); addEventListener('load', again); document.addEventListener('visibilitychange', () => { if (!document.hidden) again(); });
  const menu = head.querySelector('.menu'); if (menu) menu.addEventListener('click', () => setTimeout(again, 60));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
  again();
})();

// In-text markers (the small star beside an aside or a source note) are frozen instances of the header's sparkles:
// same soft dot, same colours, some with the fine cross. Static: nothing here moves. (owner, 2026-11-21)
(function () {
  const COLS = ['#1D5FD1', '#5B9BE6', '#6D4AFF', '#F2A93B', '#D678D2', '#F2A93B'];
  const svg = (col, plus) => 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><radialGradient id="g"><stop offset="0" stop-color="' + col + '" stop-opacity=".95"/><stop offset=".35" stop-color="' + col + '" stop-opacity=".4"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></radialGradient></defs><circle cx="12" cy="12" r="10" fill="url(#g)"/>' + (plus ? '<path d="M3 12H21M12 3V21" stroke="' + col + '" stroke-width="1.3" stroke-linecap="round"/>' : '') + '</svg>') + '")';
  const go = () => document.querySelectorAll('.pull, .note').forEach((el, i) => { const k = (i * 7 + 3) % 12; el.style.setProperty('--spk', svg(COLS[k % 6], k % 3 !== 1)); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
