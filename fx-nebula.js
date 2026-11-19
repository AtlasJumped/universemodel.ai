// Universe Model: "nebula light" cursor effect for a light site (owner request 2026-11-18).
// A pale nebula with tiny dark stars appears around the mouse pointer and fades when the pointer stops.
// Mouse only (no effect on touch screens), off for reduced motion. Blends with multiply so text stays readable.
(() => {
  if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60;mix-blend-mode:multiply';
  document.body.appendChild(cv);
  const c = cv.getContext('2d');
  let w = 0, h = 0, neb = null, mx = -999, my = -999, sx = -999, sy = -999, alpha = 0, last = 0, running = false;
  function build() {
    const dpr = Math.min(2, devicePixelRatio || 1); w = innerWidth; h = innerHeight;
    cv.width = w * dpr; cv.height = h * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    neb = document.createElement('canvas'); neb.width = w; neb.height = h; const n = neb.getContext('2d');
    n.fillStyle = '#fff'; n.fillRect(0, 0, w, h);
    const hues = [212, 228, 262, 196];
    for (let i = 0; i < Math.max(14, (w * h) / 60000); i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 80 + Math.random() * 170, g = n.createRadialGradient(x, y, 0, x, y, r), hue = hues[i % 4];
      g.addColorStop(0, `hsla(${hue},85%,74%,.6)`); g.addColorStop(1, `hsla(${hue},85%,82%,0)`); n.fillStyle = g; n.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < (w * h) / 5000; i++) { n.fillStyle = `rgba(11,37,69,${0.25 + Math.random() * 0.55})`; n.fillRect(Math.random() * w, Math.random() * h, 1.3, 1.3); }
  }
  function frame(t) {
    const target = t - last < 900 ? 1 : 0; alpha += (target - alpha) * 0.07;
    sx += (mx - sx) * 0.14; sy += (my - sy) * 0.14;
    c.clearRect(0, 0, w, h);
    if (alpha > 0.01) {
      c.save(); c.globalAlpha = alpha * 0.85; c.drawImage(neb, 0, 0, w, h);
      const g = c.createRadialGradient(sx, sy, 0, sx, sy, 170); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalCompositeOperation = 'destination-in'; c.globalAlpha = 1; c.fillStyle = g; c.fillRect(0, 0, w, h); c.restore();
      requestAnimationFrame(frame);
    } else { running = false; c.clearRect(0, 0, w, h); }
  }
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    if (sx < -900) { sx = e.clientX; sy = e.clientY; }
    mx = e.clientX; my = e.clientY; last = performance.now();
    if (!running) { running = true; requestAnimationFrame(frame); }
  }, { passive: true });
  addEventListener('resize', build); build();
})();
