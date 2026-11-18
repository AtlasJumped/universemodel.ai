// Universe Model: mobile menu + the interactive tensegrity (home page only).
(() => {
  const btn = document.querySelector('.menu'), nav = document.querySelector('.nav');
  if (btn && nav) btn.addEventListener('click', () => { const o = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', o); });
})();

(() => {
  const cv = document.getElementById('tg'), stage = document.getElementById('stage');
  if (!cv || !stage) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Expanded-octahedron tensegrity: three pairs of parallel struts held only by cables.
  const s = 0.5, N = [], struts = [];
  [[1,0,0],[0,1,0],[0,0,1]].forEach((ax, i) => {
    [-s, s].forEach(o => {
      const a = [0,0,0], b = [0,0,0], off = [0,0,0];
      off[(i + 2) % 3] = o; a[i] = -1; b[i] = 1;
      N.push(a.map((v, k) => v + off[k])); N.push(b.map((v, k) => v + off[k]));
      struts.push([N.length - 2, N.length - 1]);
    });
  });
  const partner = {}; struts.forEach(([a, b]) => { partner[a] = b; partner[b] = a; });
  const d = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);
  const cset = new Set(), cables = [];
  N.forEach((p, i) => {
    N.map((q, j) => [j, d(p, q)]).filter(([j]) => j !== i && j !== partner[i])
      .sort((x, y) => x[1] - y[1]).slice(0, 4)
      .forEach(([j]) => { const k = Math.min(i,j) + '-' + Math.max(i,j); if (!cset.has(k)) { cset.add(k); cables.push([Math.min(i,j), Math.max(i,j)]); } });
  });
  const adj = N.map(() => []); cables.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
  const hops = src => { const h = N.map(() => Infinity); h[src] = 0; const q = [src]; while (q.length) { const u = q.shift(); adj[u].forEach(v => { if (h[v] === Infinity) { h[v] = h[u] + 1; q.push(v); } }); } return h; };

  let rx = -0.45, ry = 0.6, vx = 0, vy = reduce ? 0 : 0.0025, pulses = [], W = 0, H = 0;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function size() { const dpr = Math.min(2, devicePixelRatio || 1), r = stage.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  new ResizeObserver(size).observe(stage); size();
  function project(p, jig) {
    let [x, y, z] = p.map(v => v * (1 + jig));
    let c = Math.cos(ry), sn = Math.sin(ry); [x, z] = [x * c + z * sn, -x * sn + z * c];
    c = Math.cos(rx); sn = Math.sin(rx); [y, z] = [y * c - z * sn, y * sn + z * c];
    const f = 3.4 / (3.4 + z), sc = Math.min(W, H) * 0.33;
    return [W / 2 + x * f * sc, H / 2 + y * f * sc, z, f];
  }
  const intensity = (i, t) => { let v = 0; pulses.forEach(p => { const dt = (t - p.t0) / 1000 - p.h[i] * 0.16; if (dt > 0) v += Math.exp(-dt * 3.2) * Math.min(1, dt * 12); }); return Math.min(1, v); };
  let dragging = false, lx = 0, ly = 0, moved = 0;
  function draw(t) {
    if (!dragging) { rx += vx; ry += vy; vx *= 0.96; if (!reduce) vy += (0.0025 - vy) * 0.02; }
    pulses = pulses.filter(p => t - p.t0 < 4000);
    ctx.clearRect(0, 0, W, H);
    const I = N.map((_, i) => intensity(i, t));
    const P = N.map((p, i) => project(p, reduce ? 0 : I[i] * 0.05 * Math.sin(t / 60)));
    const cableC = css('--sky'), strutC = css('--deep'), nodeC = css('--blue');
    cables.forEach(([a, b]) => {
      const e = (I[a] + I[b]) / 2;
      ctx.strokeStyle = cableC; ctx.globalAlpha = 0.7 + 0.3 * e;
      ctx.lineWidth = 1.4 + 2.8 * e; ctx.beginPath(); ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); ctx.stroke();
    });
    ctx.globalAlpha = 1;
    struts.slice().sort((u, v) => (P[v[0]][2] + P[v[1]][2]) - (P[u[0]][2] + P[u[1]][2])).forEach(([a, b]) => {
      ctx.strokeStyle = strutC; ctx.lineCap = 'round'; ctx.lineWidth = 9 * (P[a][3] + P[b][3]) / 2;
      ctx.beginPath(); ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); ctx.stroke();
    });
    P.forEach((p, i) => { ctx.fillStyle = nodeC; ctx.beginPath(); ctx.arc(p[0], p[1], (3 + 4 * I[i]) * p[3], 0, 7); ctx.fill(); });
    requestAnimationFrame(draw);
  }
  stage.addEventListener('pointerdown', e => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', e => { if (!dragging) return; const dx = e.clientX - lx, dy = e.clientY - ly; moved += Math.abs(dx) + Math.abs(dy); ry += dx * 0.008; rx += dy * 0.008; vy = dx * 0.0006; vx = dy * 0.0006; lx = e.clientX; ly = e.clientY; });
  stage.addEventListener('pointerup', e => {
    dragging = false; if (moved > 6) return;
    const r = stage.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = 0, bd = 1e9; N.forEach((p, i) => { const q = project(p, 0), dd = Math.hypot(q[0] - mx, q[1] - my); if (dd < bd) { bd = dd; best = i; } });
    pulses.push({ t0: performance.now(), h: hops(best) });
  });
  stage.tabIndex = 0;
  stage.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pulses.push({ t0: performance.now(), h: hops(Math.floor(Math.random() * N.length)) }); } });
  if (!reduce) setTimeout(() => pulses.push({ t0: performance.now(), h: hops(0) }), 900);
  requestAnimationFrame(draw);
})();
