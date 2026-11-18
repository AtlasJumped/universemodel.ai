// Universe Model: an illustrative human tensegrity (side view). Bones are struts, fascia are cables.
// Pressing creates a point, line or plane of imperfection: the fascia there is densified (its rest length
// shortened) and held. Nothing about the resulting posture is scripted; it comes from the constraint physics.
(() => {
  const cv = document.getElementById('body'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // nodes: [x, y] in body units (y down), facing right
  const P0 = [
    [2,-10],[12,0],[-6,2],[-4,18],[6,16],[0,26],[-7,34],[9,32],[-8,50],[11,52],
    [-6,66],[12,74],[-4,86],[-6,98],[10,98],[2,104],[6,144],[2,182],[-4,188],[16,188],[0,58],[4,86]
  ];
  const NAMES = ['top of head','face','base of skull','base of neck','throat','shoulder','upper back','upper chest',
    'mid back','lower chest','lower back (upper)','belly','lower back','sacrum','pubis','hip','knee','ankle','heel','toe','elbow','wrist'];
  const STRUTS = [[0,1],[1,2],[2,0],[2,3],[3,6],[6,8],[8,10],[10,12],[12,13],[6,7],[8,9],[7,9],
    [13,14],[13,15],[14,15],[15,16],[16,17],[17,18],[17,19],[18,19],[5,20],[20,21],[5,7],[5,3]];
  const CABLES = [[1,4],[4,7],[7,9],[9,11],[11,14],[14,16],[16,19],
    [2,6],[3,8],[6,10],[8,12],[10,13],[13,16],[16,18],[12,15],
    [3,4],[3,7],[6,9],[8,11],[10,11],[12,11],[12,14],[4,5],[5,6],[9,10],[11,15],[2,4],[7,8],[1,3],[14,12],
    [5,21],[3,20],[7,20],[20,9],[21,11]];
  const FIXED = new Set([18,19]);
  const E = [...STRUTS.map(([a,b]) => ({a,b,strut:true})), ...CABLES.map(([a,b]) => ({a,b,strut:false}))];
  let P, O, R, level;
  function reset() {
    P = P0.map(p => [...p]); O = P0.map(p => [...p]);
    E.forEach(e => { e.rest0 = Math.hypot(P0[e.a][0]-P0[e.b][0], P0[e.a][1]-P0[e.b][1]); e.rest = e.rest0; });
    level = P0.map(() => 0); sel = []; status('Healthy: a perfect tensegrity at time zero.');
  }
  const adj = P0.map(() => []); E.forEach((e,i) => { if (!e.strut) { adj[e.a].push([e.b,i]); adj[e.b].push([e.a,i]); } });
  function path(s, t) { // shortest cable path, as list of edge indices
    const prev = P0.map(() => null), seen = new Set([s]), q = [s];
    while (q.length) { const u = q.shift(); if (u === t) break; for (const [v,i] of adj[u]) if (!seen.has(v)) { seen.add(v); prev[v] = [u,i]; q.push(v); } }
    const out = []; let v = t; while (prev[v]) { out.push(prev[v][1]); v = prev[v][0]; } return out;
  }
  const densify = (i, f) => { const e = E[i]; if (!e.strut) e.rest = Math.max(e.rest0 * 0.55, e.rest * f); };

  // physics: position-based dynamics with gravity, weak memory of the ideal posture, and length constraints
  const prevP = () => P.map(p => [...p]); let old = null;
  function step() {
    if (!old) old = prevP();
    const nxt = P.map((p, i) => FIXED.has(i) ? [...O[i]] : [p[0] + (p[0]-old[i][0]) * 0.86, p[1] + (p[1]-old[i][1]) * 0.86 + 0.012]);
    old = P; P = nxt;
    for (let it = 0; it < 24; it++) {
      for (const e of E) {
        const pa = P[e.a], pb = P[e.b], dx = pb[0]-pa[0], dy = pb[1]-pa[1], d = Math.hypot(dx,dy) || 1e-6;
        const k = e.strut ? 0.5 : 0.13, c = (d - e.rest) / d * k;
        const wa = FIXED.has(e.a) ? 0 : 1, wb = FIXED.has(e.b) ? 0 : 1, w = wa + wb; if (!w) continue;
        pa[0] += dx*c*wa/w*2; pa[1] += dy*c*wa/w*2; pb[0] -= dx*c*wb/w*2; pb[1] -= dy*c*wb/w*2;
      }
      P.forEach((p, i) => { if (!FIXED.has(i)) { p[0] += (O[i][0]-p[0]) * 0.0009; p[1] += (O[i][1]-p[1]) * 0.0009; } });
    }
  }

  // view
  let W = 0, H = 0, S = 1, OX = 0, OY = 0; const XS = 2.2; // drawn wider than life so the shape reads clearly
  function size() { const dpr = Math.min(2, devicePixelRatio || 1), r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W*dpr; cv.height = H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    S = Math.min(W / 150, H / 215); OX = W/2 - 3*S*XS; OY = H/2 - 89*S; }
  new ResizeObserver(size).observe(cv); size();
  const X = p => [OX + p[0]*S*XS, OY + p[1]*S];
  const mix = t => { t = Math.max(0, Math.min(1, t)); const a=[91,155,230], b=[217,59,59]; return `rgb(${a.map((v,k)=>Math.round(v+(b[k]-v)*t)).join(',')})`; };
  let sel = [], mode = 'point';
  function draw() {
    step();
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle = '#D6E1EE'; ctx.lineWidth = 2; ctx.beginPath(); const g = X([-30,190]), g2 = X([40,190]); ctx.moveTo(g[0],g[1]); ctx.lineTo(g2[0],g2[1]); ctx.stroke();
    // creep halos
    P.forEach((p,i) => { if (!level[i]) return; const [x,y] = X(p), r = (5 + 4*Math.min(level[i],6)) * S;
      const gr = ctx.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba(217,59,59,.32)'); gr.addColorStop(1,'rgba(217,59,59,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); });
    for (const e of E) { if (e.strut) continue; const t = (1 - e.rest/e.rest0) / 0.45, [x1,y1] = X(P[e.a]), [x2,y2] = X(P[e.b]);
      ctx.strokeStyle = mix(t); ctx.lineWidth = (1.3 + 2.4*Math.min(1,t)) * Math.max(1, S/4); ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
    ctx.lineCap = 'round';
    for (const e of E) { if (!e.strut) continue; const [x1,y1] = X(P[e.a]), [x2,y2] = X(P[e.b]); ctx.strokeStyle = '#0E3A75'; ctx.lineWidth = 2.2*Math.max(1,S/3.2); ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
    P.forEach((p,i) => { const [x,y] = X(p); ctx.fillStyle = level[i] ? '#D93B3B' : (sel.includes(i) ? '#F0A940' : '#1D5FD1'); ctx.beginPath(); ctx.arc(x,y,(level[i]||sel.includes(i) ? 4.2 : 3)*Math.max(1,S/3.4),0,7); ctx.fill(); });
    requestAnimationFrame(draw);
  }
  const statusEl = document.getElementById('simstatus'); function status(t) { if (statusEl) statusEl.textContent = t; }
  function nearest(e) { const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; let best = -1, bd = 22;
    P.forEach((p,i) => { const [x,y] = X(p), d = Math.hypot(x-mx, y-my); if (d < bd) { bd = d; best = i; } }); return best; }
  cv.addEventListener('pointerdown', e => {
    const i = nearest(e); if (i < 0) return;
    if (mode === 'point') {
      adj[i].forEach(([,k]) => densify(k, 0.8)); level[i]++;
      status(`Point of imperfection at the ${NAMES[i]}${level[i] > 1 ? ' (pressed ' + level[i] + ' times)' : ''}: fascia densified and held there.`);
    } else {
      sel.push(i); const need = mode === 'line' ? 2 : 3;
      if (sel.length < need) { status(`${mode === 'line' ? 'Line' : 'Plane'} of imperfection: choose ${need - sel.length} more point${need - sel.length > 1 ? 's' : ''}.`); return; }
      const edges = new Set(); for (let a = 0; a < sel.length; a++) for (let b = a+1; b < sel.length; b++) path(sel[a], sel[b]).forEach(k => edges.add(k));
      const nodes = new Set(sel); edges.forEach(k => { nodes.add(E[k].a); nodes.add(E[k].b); });
      if (mode === 'plane') E.forEach((ed,k) => { if (!ed.strut && nodes.has(ed.a) && nodes.has(ed.b)) edges.add(k); });
      edges.forEach(k => densify(k, mode === 'line' ? 0.84 : 0.88)); nodes.forEach(n => level[n]++);
      status(`${mode === 'line' ? 'Line' : 'Plane'} of imperfection from the ${NAMES[sel[0]]} to the ${NAMES[sel[sel.length-1]]}.`); sel = [];
    }
  });
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; sel = [];
    document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x === b));
    status(mode === 'point' ? 'Point: press any node.' : mode === 'line' ? 'Line: press two nodes.' : 'Plane: press three nodes.'); }));
  const rb = document.getElementById('simreset'); if (rb) rb.addEventListener('click', reset);
  reset(); requestAnimationFrame(draw);
  // #demo: press the upper chest five times, to show the effect without interaction
  if (location.hash === '#demo') { let n = 0; const t = setInterval(() => { adj[7].forEach(([,k]) => densify(k, 0.8)); level[7]++; if (++n >= 5) clearInterval(t); }, 300); }
})();
