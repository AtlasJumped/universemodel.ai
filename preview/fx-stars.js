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

// Universe Model: a slow cloud of the same sparkles around the name in the top bar (owner request 2026-11-19d).
// It is always gently alive, stirs when the pointer moves anywhere on the page, and fades out where the menu starts.
(() => {
  const head = document.querySelector('.site-head'), brand = head && head.querySelector('.brand'); if (!brand) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.createElement('canvas'); cv.className = 'brand-aura'; cv.setAttribute('aria-hidden', 'true'); head.insertBefore(cv, head.firstChild);
  const c = cv.getContext('2d');
  const COLS = [[29, 95, 209], [91, 155, 230], [109, 74, 255], [242, 169, 59], [14, 58, 117], [214, 120, 210]];
  const parts = []; let w = 0, h = 0, energy = 0, dx = 0, dy = 0, px = null, py = null, last = 0;
  function size() { const r = brand.getBoundingClientRect(), hr = head.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    w = Math.max(120, Math.min(hr.width, r.right - hr.left + 110)); h = hr.height; cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = w * d; cv.height = h * d; c.setTransform(d, 0, 0, d, 0, 0); if (still) draw(); }
  function spawn(stirred) { const a = Math.random() * 6.283, s = 0.03 + Math.random() * 0.1;
    parts.push({ x: Math.random() * w * 0.94, y: 4 + Math.random() * (h - 8), vx: Math.cos(a) * s + (stirred ? dx * 0.35 : 0), vy: Math.sin(a) * s * 0.6 + (stirred ? dy * 0.2 : 0),
      r: 0.7 + Math.random() * 2.3, age: 0, life: stirred ? 110 + Math.random() * 110 : 360 + Math.random() * 420, tw: Math.random() * 6.283, col: COLS[Math.floor(Math.random() * COLS.length)], star: Math.random() < 0.35 }); }
  function draw() { c.clearRect(0, 0, w, h);
    for (const p of parts) { const env = Math.sin(Math.PI * Math.min(1, p.age / p.life)), a = env * (0.5 + 0.4 * Math.sin(p.tw)) * 0.9, [r, g, b] = p.col, R = p.r;
      const gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * 4);
      gr.addColorStop(0, `rgba(${r},${g},${b},${0.8 * a})`); gr.addColorStop(0.35, `rgba(${r},${g},${b},${0.32 * a})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.fillStyle = gr; c.beginPath(); c.arc(p.x, p.y, R * 4, 0, 6.283); c.fill();
      if (p.star) { c.strokeStyle = `rgba(${r},${g},${b},${a})`; c.lineWidth = 1; c.beginPath(); c.moveTo(p.x - R * 3, p.y); c.lineTo(p.x + R * 3, p.y); c.moveTo(p.x, p.y - R * 3); c.lineTo(p.x, p.y + R * 3); c.stroke(); } } }
  function frame(t) { requestAnimationFrame(frame); if (t - last < 33) return; last = t; // about 30 frames a second is plenty for something this slow
    const want = 13 + Math.round(energy * 22); if (parts.length < want && Math.random() < 0.25 + energy) spawn(energy > 0.15);
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vx *= 0.992; p.vy *= 0.992; p.age++; p.tw += 0.045; if (p.age >= p.life || p.x < -12 || p.x > w + 12) parts.splice(i, 1); }
    energy *= 0.95; draw(); }
  addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; if (px !== null) { const mx = e.clientX - px, my = e.clientY - py, d = Math.hypot(mx, my); if (d > 0) { energy = Math.min(1, energy + d / 500); dx = dx * 0.8 + mx / d * 0.2; dy = dy * 0.8 + my / d * 0.2; } } px = e.clientX; py = e.clientY; }, { passive: true });
  addEventListener('resize', size); size();
  if (still) { for (let i = 0; i < 13; i++) { spawn(false); parts[i].age = parts[i].life * (0.3 + Math.random() * 0.4); } draw(); return; }
  for (let i = 0; i < 9; i++) { spawn(false); parts[i].age = parts[i].life * Math.random() * 0.6; }
  requestAnimationFrame(frame);
})();
