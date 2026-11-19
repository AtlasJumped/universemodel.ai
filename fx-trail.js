// Universe Model: a small tensegrity trail that follows the mouse pointer (owner request 2026-11-18j).
// The pointer stays an ordinary pointer. Behind it, a short chain of struts and cables swings and settles with
// simple rope physics, then fades when the mouse stops. Mouse only (no effect on touch screens), off for reduced motion.
(() => {
  if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60';
  document.body.appendChild(cv);
  const c = cv.getContext('2d');
  const N = 16, SEG = 11, pts = [], old = [];
  let w = 0, h = 0, mx = 0, my = 0, alpha = 0, last = -1e9, running = false, started = false;
  function size() { const d = Math.min(2, devicePixelRatio || 1); w = innerWidth; h = innerHeight; cv.width = w * d; cv.height = h * d; c.setTransform(d, 0, 0, d, 0, 0); }
  function seed(x, y) { pts.length = old.length = 0; for (let i = 0; i < N; i++) { pts.push([x, y + i * 2]); old.push([x, y + i * 2]); } }
  function physics() {
    pts[0][0] = mx + 7; pts[0][1] = my + 7;
    for (let i = 1; i < N; i++) {
      const p = pts[i], o = old[i], vx = (p[0] - o[0]) * 0.9, vy = (p[1] - o[1]) * 0.9;
      o[0] = p[0]; o[1] = p[1]; p[0] += vx; p[1] += vy + 0.35;
    }
    for (let k = 0; k < 6; k++) for (let i = 1; i < N; i++) {
      const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-6, d = (L - SEG) / L;
      if (i === 1) { b[0] -= dx * d; b[1] -= dy * d; } else { a[0] += dx * d * 0.5; a[1] += dy * d * 0.5; b[0] -= dx * d * 0.5; b[1] -= dy * d * 0.5; }
    }
  }
  function frame(t) {
    const target = t - last < 1100 ? 1 : 0; alpha += (target - alpha) * 0.06;
    physics();
    c.clearRect(0, 0, w, h);
    if (alpha > 0.01) {
      // two rails offset either side of the chain; cables run along the rails, struts cross between them
      const A = [], B = [];
      for (let i = 0; i < N; i++) {
        const p = pts[i], q = pts[Math.min(N - 1, i + 1)], r = pts[Math.max(0, i - 1)];
        let tx = q[0] - r[0], ty = q[1] - r[1]; const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
        const wd = 7 * (1 - i / N) + 1.5;
        A.push([p[0] - ty * wd, p[1] + tx * wd]); B.push([p[0] + ty * wd, p[1] - tx * wd]);
      }
      c.lineCap = 'round';
      for (let i = 0; i < N - 1; i++) {
        const f = alpha * (1 - i / N);
        c.strokeStyle = `rgba(91,155,230,${0.75 * f})`; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(A[i][0], A[i][1]); c.lineTo(A[i + 1][0], A[i + 1][1]); c.moveTo(B[i][0], B[i][1]); c.lineTo(B[i + 1][0], B[i + 1][1]); c.stroke();
        c.strokeStyle = `rgba(14,58,117,${0.8 * f})`; c.lineWidth = 2.6 * (1 - i / N) + 0.8;
        const s0 = i % 2 ? A : B, s1 = i % 2 ? B : A;
        c.beginPath(); c.moveTo(s0[i][0], s0[i][1]); c.lineTo(s1[i + 1][0], s1[i + 1][1]); c.stroke();
        c.fillStyle = `rgba(29,95,209,${0.85 * f})`;
        c.beginPath(); c.arc(A[i][0], A[i][1], 1.6, 0, 7); c.arc(B[i][0], B[i][1], 1.6, 0, 7); c.fill();
      }
      requestAnimationFrame(frame);
    } else { running = false; c.clearRect(0, 0, w, h); }
  }
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY; last = performance.now();
    if (!started) { seed(mx, my); started = true; }
    if (!running) { running = true; requestAnimationFrame(frame); }
  }, { passive: true });
  addEventListener('resize', size); size();
})();
