// Universe Model: mobile menu, nav dropdowns, and the tensegrity physics toy (every canvas#tg inside a .stage).
// The toy is a real simulation (extended position based dynamics): node masses, gravity, a ground with friction,
// rigid struts, and cables that pull but never push. Cutting or removing a member changes the structure and the
// physics alone decides what happens next. Nothing is animated by hand.

/* ---------- menu and dropdown groups ---------- */
(() => {
  if (typeof document === 'undefined') return;
  const btn = document.querySelector('.menu'), nav = document.querySelector('.nav');
  const setMenu = o => { nav.classList.toggle('open', o); btn.setAttribute('aria-expanded', o); };
  if (btn && nav) {
    btn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); btn.focus(); } });
  }
  const grps = [...document.querySelectorAll('.nav .grp')];
  const closeAll = except => grps.forEach(g => { if (g !== except) { g.classList.remove('open'); const b = g.querySelector('.grpbtn'); if (b) b.setAttribute('aria-expanded', 'false'); } });
  grps.forEach(g => {
    const b = g.querySelector('.grpbtn'); if (!b) return;
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', () => { const o = !g.classList.contains('open'); closeAll(g); g.classList.toggle('open', o); b.setAttribute('aria-expanded', o); });
  });
  document.addEventListener('click', e => { if (!e.target.closest || !e.target.closest('.nav .grp')) closeAll(null); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(null); });
})();

/* ---------- physics core (no DOM; also loadable in node for tests) ---------- */
const TG = (() => {
  const GRAV = -9.81;

  function builder() {
    const P = [], W = [], C = [], T = [], A = [];
    return {
      P, W, C, T, A,
      node(x, y, z, m, pin) { P.push([x, y, z]); W.push(pin ? 0 : 1 / (m || 0.05)); A.push(0); return P.length - 1; },
      lift(i, ay) { A[i] = ay; },
      // a rigid body: the listed members are drawn as bone, every other pair of its nodes is braced (hidden)
      body(nodes, drawn, grp) {
        const key = (a, c) => Math.min(a, c) + '-' + Math.max(a, c), have = new Set();
        drawn.forEach(([a, c]) => { C.push({ a, b: c, kind: 'strut', grp }); have.add(key(a, c)); });
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if (!have.has(key(nodes[i], nodes[j]))) C.push({ a: nodes[i], b: nodes[j], kind: 'brace', grp });
      },
      // kind: strut (rigid, drawn), brace (rigid, hidden), cable (tension only), fabric (tension only, thin), bend (springy, hidden)
      add(a, b, kind, o) { C.push(Object.assign({ a, b, kind }, o || {})); return C.length - 1; },
      tri(a, b, c, e1, e2, e3) { T.push([a, b, c, e1, e2, e3]); },
    };
  }
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

  // Rotate points so that unit vector n points along t (Rodrigues).
  function orient(pts, n, t) {
    const ax = [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]];
    const s = Math.hypot(...ax), c = n[0] * t[0] + n[1] * t[1] + n[2] * t[2];
    if (s < 1e-9) return pts;
    const k = ax.map(v => v / s), th = Math.atan2(s, c), cs = Math.cos(th), sn = Math.sin(th);
    return pts.map(p => {
      const kxp = [k[1] * p[2] - k[2] * p[1], k[2] * p[0] - k[0] * p[2], k[0] * p[1] - k[1] * p[0]];
      const kdp = k[0] * p[0] + k[1] * p[1] + k[2] * p[2];
      return [0, 1, 2].map(i => p[i] * cs + kxp[i] * sn + k[i] * kdp * (1 - cs));
    });
  }

  /* ----- shapes. Units: metres, kilograms, newtons. ----- */
  function sixStrut() {
    const b = builder(), s = 0.5, N = [], struts = [];
    [0, 1, 2].forEach(i => [-s, s].forEach(o => {
      const a = [0, 0, 0], c = [0, 0, 0], off = [0, 0, 0];
      off[(i + 2) % 3] = o; a[i] = -1; c[i] = 1;
      N.push(a.map((v, k) => v + off[k])); N.push(c.map((v, k) => v + off[k]));
      struts.push([N.length - 2, N.length - 1]);
    }));
    const partner = {}; struts.forEach(([a, c]) => { partner[a] = c; partner[c] = a; });
    const seen = new Set(), cables = [];
    // The 24 cables of the expanded octahedron join each strut end to the four nearest ends of the two other strut
    // pairs (distance sqrt(1.5) in these units); the parallel strut's end, at distance 1, is not joined.
    N.forEach((p, i) => N.forEach((q, j) => {
      if (j <= i || j === partner[i] || Math.abs(dist(p, q) - Math.sqrt(1.5)) > 0.01) return;
      seen.add(i + '-' + j); cables.push([i, j]);
    }));
    // Rest it on one of its all-cable triangles so it sits still on the ground.
    const has = (i, j) => seen.has(Math.min(i, j) + '-' + Math.max(i, j));
    let face = null;
    for (let i = 0; i < 12 && !face; i++) for (let j = i + 1; j < 12 && !face; j++) for (let k = j + 1; k < 12 && !face; k++) if (has(i, j) && has(j, k) && has(i, k)) face = [i, j, k];
    const [A, Bq, Cq] = face.map(i => N[i]);
    const u = [Bq[0] - A[0], Bq[1] - A[1], Bq[2] - A[2]], v = [Cq[0] - A[0], Cq[1] - A[1], Cq[2] - A[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const cen = [(A[0] + Bq[0] + Cq[0]) / 3, (A[1] + Bq[1] + Cq[1]) / 3, (A[2] + Bq[2] + Cq[2]) / 3];
    if (n[0] * cen[0] + n[1] * cen[1] + n[2] * cen[2] < 0) n = n.map(x => -x);
    const ln = Math.hypot(...n); n = n.map(x => x / ln);
    const S = 0.2, R = orient(N, n, [0, -1, 0]).map(p => p.map(x => x * S));
    const ymin = Math.min(...R.map(p => p[1]));
    R.forEach(p => b.node(p[0], p[1] - ymin + 0.001, p[2], 0.05));
    struts.forEach(([a, c]) => b.add(a, c, 'strut'));
    cables.forEach(([a, c]) => b.add(a, c, 'cable'));
    return { b, ea: 160, strain: 0.06, kick: 1.4, view: [0.55, 0.42],
      info: 'Six struts in compression never touch one another; 24 cables in tension hold them apart. A load anywhere is shared by the whole web.' };
  }

  function prism() {
    const b = builder(), r = 0.15, h = 0.27, B = [], T = [];
    for (let i = 0; i < 3; i++) { const a = 2 * Math.PI * i / 3; B.push(b.node(r * Math.cos(a), 0.001, r * Math.sin(a), 0.05)); }
    for (let i = 0; i < 3; i++) { const a = 2 * Math.PI * i / 3 + 5 * Math.PI / 6; T.push(b.node(r * Math.cos(a), h, r * Math.sin(a), 0.05)); }
    for (let i = 0; i < 3; i++) {
      b.add(B[i], T[i], 'strut');
      b.add(B[i], B[(i + 1) % 3], 'cable'); b.add(T[i], T[(i + 1) % 3], 'cable');
      b.add(B[i], T[(i + 2) % 3], 'cable');
    }
    return { b, ea: 160, strain: 0.06, kick: 1.2, view: [0.4, 0.38],
      info: 'The classic desk toy: three struts in compression float inside nine cables in tension. It is the simplest stable tensegrity.' };
  }

  function table() {
    const b = builder(), a = 0.2, H = 0.42, d = 0.08, yb = 0.31, yt = 0.13;
    const B = [[-a, -a], [a, -a], [a, a], [-a, a]].map(([x, z]) => b.node(x, 0, z, 0.2, true));
    const Bf = b.node(-d, 0, 0, 0.1, true), Bp = b.node(-d, yb, 0, 0.05), Bt = b.node(0, yb, 0, 0.05);
    for (let i = 0; i < 4; i++) b.add(B[i], B[(i + 1) % 4], 'strut', { grp: 'base' });
    b.add(Bf, Bp, 'strut', { grp: 'bpost' }); b.add(Bp, Bt, 'strut', { grp: 'bpost' });
    B.forEach(n => { b.add(n, Bp, 'brace', { grp: 'bpost' }); b.add(n, Bt, 'brace', { grp: 'bpost' }); });
    const T = [[-a, -a], [a, -a], [a, a], [-a, a]].map(([x, z]) => b.node(x, H, z, 0.08));
    const Tf = b.node(d, H, 0, 0.05), Tp = b.node(d, yt, 0, 0.05), Tt = b.node(0, yt, 0, 0.05);
    for (let i = 0; i < 4; i++) b.add(T[i], T[(i + 1) % 4], 'strut', { grp: 'plate' });
    b.add(T[0], T[2], 'brace', { grp: 'plate' }); b.add(T[1], T[3], 'brace', { grp: 'plate' });
    T.forEach(n => b.add(n, Tf, 'brace', { grp: 'plate' }));
    b.add(Tf, Tp, 'strut', { grp: 'tpost' }); b.add(Tp, Tt, 'strut', { grp: 'tpost' });
    T.forEach(n => { b.add(n, Tp, 'brace', { grp: 'tpost' }); b.add(n, Tt, 'brace', { grp: 'tpost' }); });
    b.add(Bt, Tt, 'cable', { strain: 0.02 });
    for (let i = 0; i < 4; i++) b.add(B[i], T[i], 'cable');
    return { b, ea: 400, strain: 0.04, kick: 0.8, view: [0.75, 0.32],
      info: 'The top hangs from one short cable in tension between two hooks; four corner cables in tension stop it tipping. The two frames are in compression.' };
  }

  function tent() {
    const b = builder(), nz = 7, nr = 4, L = 1.0, H = 1.15, Wd = 1.0;
    const grid = []; // grid[side][row][k]; row 0 is the ridge, shared
    const ridge = [];
    for (let k = 0; k < nz; k++) { const z = -L + 2 * L * k / (nz - 1); ridge.push(b.node(0, H, z, (k === 0 || k === nz - 1) ? 0.3 : 0.06)); }
    [-1, 1].forEach(sg => {
      const rows = [ridge];
      for (let r = 1; r <= nr; r++) {
        const row = [];
        for (let k = 0; k < nz; k++) { const z = -L + 2 * L * k / (nz - 1); row.push(b.node(sg * Wd * r / nr, H * (1 - r / nr) + (r === nr ? 0 : 0), z, 0.06, r === nr)); }
        rows.push(row);
      }
      grid.push(rows);
    });
    const fab = {};
    const F = (p, q) => { const k = Math.min(p, q) + '-' + Math.max(p, q); if (fab[k] === undefined) fab[k] = b.add(p, q, 'fabric'); return fab[k]; };
    for (let k = 0; k < nz - 1; k++) fab[Math.min(ridge[k], ridge[k + 1]) + '-' + Math.max(ridge[k], ridge[k + 1])] = b.add(ridge[k], ridge[k + 1], 'cable', { strain: 0.03 });
    grid.forEach(rows => {
      for (let r = 0; r < nr; r++) for (let k = 0; k < nz; k++) {
        const p = rows[r][k], dn = rows[r + 1][k];
        F(p, dn);
        if (r + 1 < nr && k + 1 < nz) F(rows[r + 1][k], rows[r + 1][k + 1]);
        if (k + 1 < nz) {
          const pr = rows[r][k + 1], dr = rows[r + 1][k + 1];
          const e1 = F(p, pr), e2 = F(pr, dr), e3 = F(p, dr), e4 = F(dn, dr), e5 = F(p, dn);
          F(pr, dn);
          b.tri(p, pr, dr, e1, e2, e3); b.tri(p, dr, dn, e3, e4, e5);
        }
      }
    });
    [0, nz - 1].forEach((k, i) => {
      const z = k === 0 ? -L : L, foot = b.node(0, 0, z, 0.1, true), stake = b.node(0, 0, z * 1.8, 0.1, true);
      b.add(foot, ridge[k], 'strut');
      b.add(ridge[k], stake, 'cable');
    });
    return { b, ea: 600, eaFabric: 300, strain: 0.03, strainFabric: 0.015, kick: 2.2, view: [0.85, 0.33],
      info: 'The poles are in compression; the guy lines, ridge line and fabric are in tension. Cut a guy line or take out a pole and the tent comes down.' };
  }

  // A big marquee: two king poles under a ridge, a ring of fourteen side poles, each held out by its own guy line.
  function mansionTent() {
    const b = builder(), xk = 1.0, c = 1.5, He = 1.3, Hk = 2.6, m = 3, R = 3, fan = 3;
    const ridge = [];
    for (let k = 0; k <= m; k++) { const x = xk - 2 * xk * k / m, king = k === 0 || k === m; ridge.push(b.node(x, king ? Hk : Hk - 0.05, 0, king ? 0.4 : 0.06)); }
    [0, m].forEach(k => { const foot = b.node(b.P[ridge[k]][0], 0, 0, 0.1, true); b.add(foot, ridge[k], 'strut'); });
    const fab = {}, key = (p, q) => Math.min(p, q) + '-' + Math.max(p, q);
    for (let k = 0; k < m; k++) fab[key(ridge[k], ridge[k + 1])] = b.add(ridge[k], ridge[k + 1], 'cable', { strain: 0.03 });
    const F = (p, q) => { const k = key(p, q); if (fab[k] === undefined) fab[k] = b.add(p, q, 'fabric'); return fab[k]; };
    // the eave runs round a stadium shape: two straight sides and two rounded ends. Each eave point hangs from a ridge node.
    const cols = [];
    const col = (inner, ex, ez, nx, nz) => { const ip = b.P[inner], ids = [inner];
      for (let r = 1; r <= R; r++) { const t = r / R, sag = 0.2 * Math.sin(Math.PI * t); ids.push(b.node(ip[0] + (ex - ip[0]) * t, ip[1] + (He - ip[1]) * t - sag, ip[2] + (ez - ip[2]) * t, r === R ? 0.25 : 0.05)); }
      const top = ids[R], foot = b.node(ex, 0, ez, 0.1, true), stake = b.node(ex + nx * 0.95, 0, ez + nz * 0.95, 0.1, true);
      b.add(foot, top, 'strut'); b.add(top, stake, 'cable'); ids.hem = b.node(ex + nx * 0.04, He - 0.42, ez + nz * 0.04, 0.03); cols.push(ids); };
    for (let k = 0; k <= m; k++) col(ridge[k], b.P[ridge[k]][0], c, 0, 1);
    for (let f = 1; f <= fan; f++) { const a = Math.PI / 2 + Math.PI * f / (fan + 1); col(ridge[m], -xk + c * Math.cos(a), c * Math.sin(a), Math.cos(a), Math.sin(a)); }
    for (let k = m; k >= 0; k--) col(ridge[k], b.P[ridge[k]][0], -c, 0, -1);
    for (let f = 1; f <= fan; f++) { const a = -Math.PI / 2 + Math.PI * f / (fan + 1); col(ridge[0], xk + c * Math.cos(a), c * Math.sin(a), Math.cos(a), Math.sin(a)); }
    cols.forEach((A, j) => { const B = cols[(j + 1) % cols.length];
      for (let r = 0; r < R; r++) { const p = A[r], pr = B[r], dn = A[r + 1], dr = B[r + 1], e5 = F(p, dn), e4 = F(dn, dr);
        if (p === pr) { const e3 = F(p, dr); b.tri(p, dr, dn, e3, e4, e5); }
        else { const e1 = F(p, pr), e2 = F(pr, dr), e3 = F(p, dr); F(pr, dn); b.tri(p, pr, dr, e1, e2, e3); b.tri(p, dr, dn, e3, e4, e5); } } });
    // a valance hangs from the eave all the way round
    cols.forEach((A, j) => { const B = cols[(j + 1) % cols.length], p = A[R], q = B[R], e1 = F(p, q), e2 = F(q, B.hem), e3 = F(p, B.hem), e4 = F(A.hem, B.hem), e5 = F(p, A.hem); b.tri(p, q, B.hem, e1, e2, e3); b.tri(p, B.hem, A.hem, e3, e4, e5); });
    return { b, ea: 600, eaFabric: 300, strain: 0.03, strainFabric: 0.015, kick: 2.4, view: [0.7, 0.36], thin: 0.6,
      info: 'A big marquee. Two king poles and fourteen side poles are in compression; the ridge line, the fabric and fourteen guy lines are in tension. Cut guy lines or take out poles and watch which part of the roof comes down.' };
  }

  // A neighbourhood of treehouses: each house hangs from the branches of its tree, and rope bridges join the houses.
  function treehouses() {
    const b = builder(), houses = [];
    const trees = [[-2.4, -0.5, 3.0, 0.3], [-0.8, 0.75, 3.4, 1.1], [0.85, -0.6, 3.1, 0.2], [2.4, 0.65, 3.5, 0.9]]; // x, z, height, turn
    trees.forEach(([tx, tz, H, turn], ti) => {
      const g = 'tree' + ti, roots = [[0, 0], [0.55, 0.3], [-0.45, 0.45], [0, -0.6]].map(([dx, dz]) => b.node(tx + dx, 0, tz + dz, 1, true));
      const crown = b.node(tx, H, tz, 0.6);
      b.add(roots[0], crown, 'strut', { grp: g }); roots.slice(1).forEach(r => b.add(r, crown, 'brace', { grp: g }));
      const tips = [0, 1, 2, 3].map(k => { const a = turn + Math.PI / 4 + k * Math.PI / 2, t = b.node(tx + 0.85 * Math.cos(a), H + 0.3, tz + 0.85 * Math.sin(a), 0.2);
        b.add(crown, t, 'strut', { grp: g }); roots.forEach(r => b.add(r, t, 'brace', { grp: g })); return t; });
      // the house: a floor and a pitched roof frame, one rigid piece, hung from the four branch tips
      const hy = H - 1.55 - (ti % 2) * 0.3, s = 0.6;
      const fl = [0, 1, 2, 3].map(k => { const a = turn + Math.PI / 4 + k * Math.PI / 2; return b.node(tx + s * Math.cos(a), hy, tz + s * Math.sin(a), 0.5); });
      const mid = (i, j, y) => { const p = b.P[fl[i]], q = b.P[fl[j]]; return b.node((p[0] + q[0]) / 2, y, (p[2] + q[2]) / 2, 0.2); };
      const rA = mid(0, 1, hy + 0.78), rB = mid(2, 3, hy + 0.78);
      b.body([...fl, rA, rB], [[fl[0], fl[1]], [fl[1], fl[2]], [fl[2], fl[3]], [fl[3], fl[0]], [fl[0], rA], [fl[1], rA], [fl[2], rB], [fl[3], rB], [rA, rB]], 'house' + ti);
      fl.forEach((f, k) => b.add(f, tips[k], 'cable'));
      houses.push({ fl, tips, crown });
    });
    // rope bridges: two ropes with planks between them, sagging between neighbouring houses
    const d2 = (i, j) => { const p = b.P[i], q = b.P[j]; return (p[0] - q[0]) ** 2 + (p[2] - q[2]) ** 2; };
    for (let h = 0; h + 1 < houses.length; h++) { const A = houses[h].fl, B = houses[h + 1].fl, cb = [0, 1, 2, 3].reduce((acc, k) => [acc[0] + b.P[B[k]][0] / 4, 0, acc[2] + b.P[B[k]][2] / 4], [0, 0, 0]), ca = [0, 1, 2, 3].reduce((acc, k) => [acc[0] + b.P[A[k]][0] / 4, 0, acc[2] + b.P[A[k]][2] / 4], [0, 0, 0]);
      const near = (F, c) => F.slice().sort((i, j) => ((b.P[i][0] - c[0]) ** 2 + (b.P[i][2] - c[2]) ** 2) - ((b.P[j][0] - c[0]) ** 2 + (b.P[j][2] - c[2]) ** 2)).slice(0, 2);
      let [a1, a2] = near(A, cb), [b1, b2] = near(B, ca); if (d2(a1, b1) + d2(a2, b2) > d2(a1, b2) + d2(a2, b1)) [b1, b2] = [b2, b1];
      const n = 6, rope = (p, q) => { const P0 = b.P[p], P1 = b.P[q], ids = [p]; for (let k = 1; k < n; k++) { const t = k / n; ids.push(b.node(P0[0] + (P1[0] - P0[0]) * t, P0[1] + (P1[1] - P0[1]) * t - 0.42 * 4 * t * (1 - t), P0[2] + (P1[2] - P0[2]) * t, 0.08)); } ids.push(q);
        for (let k = 0; k < n; k++) b.add(ids[k], ids[k + 1], 'cable', { strain: 0 }); return ids; };
      const r1 = rope(a1, b1), r2 = rope(a2, b2); for (let k = 1; k < n; k++) b.add(r1[k], r2[k], 'strut'); }
    // a rope ladder down from the first house, and a swing under the last tree
    { const A = houses[0].fl, p = b.P[A[2]], q = b.P[A[3]], n = 5, side = P0 => { const ids = []; let prev = null; for (let k = 0; k <= n; k++) { const t = k / n, id = k === 0 ? null : b.node(P0[0] - 0.25 * t, P0[1] * (1 - t), P0[2], 0.06, k === n); ids.push(id); } return ids; };
      const L = side(p), Rr = side(q); L[0] = A[2]; Rr[0] = A[3];
      for (let k = 0; k < n; k++) { b.add(L[k], L[k + 1], 'cable', { strain: 0 }); b.add(Rr[k], Rr[k + 1], 'cable', { strain: 0 }); } for (let k = 1; k < n; k++) b.add(L[k], Rr[k], 'strut'); }
    { const t = houses[3].tips, pa = b.P[t[0]], pb = b.P[t[3]], sA = b.node(pa[0] + 0.5, 0.55, pa[2] + 0.35, 0.5), sB = b.node(pa[0] + 0.85, 0.55, pa[2] + 0.1, 0.5), hook = b.node(pa[0] + 0.7, pa[1] + 0.05, pa[2] + 0.25, 0.2);
      b.add(t[0], hook, 'strut', { grp: 'tree3' }); b.add(t[3], hook, 'brace', { grp: 'tree3' }); b.add(houses[3].crown, hook, 'brace', { grp: 'tree3' }); void pb;
      b.add(hook, sA, 'cable', { strain: 0 }); b.add(hook, sB, 'cable', { strain: 0 }); b.add(sA, sB, 'strut'); }
    return { b, ea: 900, strain: 0.004, iters: 2, kick: 1.6, view: [0.45, 0.3], thin: 0.6,
      info: 'A neighbourhood of treehouses. The trees are in compression. Each house hangs from its branches by four ropes in tension, and rope bridges in tension tie the houses together. Cut a rope and a house tilts; take out a tree and its house hangs on its neighbours.' };
  }

  function wheel() {
    const b = builder(), n = 24, R = 0.33, y0 = R + 0.06, rh = 0.03, nh = 12;
    const fl = [-0.05, 0.05].map(z => { const ring = []; for (let k = 0; k < nh; k++) { const a = 2 * Math.PI * (k + 0.5) / nh; ring.push(b.node(rh * Math.cos(a), y0 + rh * Math.sin(a), z, 0.1, true)); } return ring; });
    for (let s = 0; s < 2; s++) for (let k = 0; k < nh; k++) b.add(fl[s][k], fl[s][(k + 1) % nh], 'strut', { grp: 'hub' });
    // the rim is a light triangular truss (two outer rings and one inner ring, braced), so it resists bending
    // in and out of its plane, as a real rim does
    const ra = [], rb = [], rc = [], zr = 0.012, ri = R - 0.022;
    for (let i = 0; i < n; i++) {
      const a = 2 * Math.PI * i / n, c = Math.cos(a), sn = Math.sin(a);
      ra.push(b.node(R * c, y0 + R * sn, -zr, 0.05)); rb.push(b.node(R * c, y0 + R * sn, zr, 0.05)); rc.push(b.node(ri * c, y0 + ri * sn, 0, 0.05));
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, g = { grp: 'r' + i };
      b.add(ra[i], ra[j], 'strut', g); b.add(rb[i], rb[j], 'strut', g); b.add(rc[i], rc[j], 'brace', g);
      b.add(ra[i], rb[j], 'brace', g); b.add(rb[i], rc[j], 'brace', g); b.add(rc[i], ra[j], 'brace', g);
      b.add(ra[i], rb[i], 'brace'); b.add(rb[i], rc[i], 'brace'); b.add(rc[i], ra[i], 'brace');
      // two-cross lacing: alternate sides, alternate leading and trailing spokes
      const side = i % 2, k = Math.floor(i / 2), lead = (k % 2) ? 2 : -2;
      b.add(rc[i], fl[side][((k + lead) % nh + nh) % nh], 'cable');
    }
    return { b, ea: 750, strain: 0.01, iters: 4, kick: 1.5, view: [0.55, 0.12],
      info: 'The thin spokes are all in tension, and the hub hangs in them; the rim is in compression, squeezed inward by every spoke at once.' };
  }

  function bridge() {
    const b = builder(), n = 10, half = 1.0, zw = 0.18, yd = 0.32, yT = 1.1, ysag = 0.58, xa = 1.75;
    const deck = [[], []], cab = [[], []];
    [-1, 1].forEach((sz, s) => {
      for (let i = 0; i <= n; i++) {
        const x = -half + 2 * half * i / n;
        deck[s].push(b.node(x, yd, sz * zw, 0.25, i === 0 || i === n));
        const yc = ysag + (yT - ysag) * x * x / (half * half);
        cab[s].push(b.node(x, yc, sz * zw, (i === 0 || i === n) ? 0.2 : 0.03));
      }
    });
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < n; i++) {
        b.add(deck[s][i], deck[s][i + 1], 'strut', { grp: 'd' + i });
        b.add(cab[s][i], cab[s][i + 1], 'cable');
      }
      for (let i = 0; i + 2 <= n; i++) b.add(deck[s][i], deck[s][i + 2], 'bend', { grp: 'd' + i, grp2: 'd' + (i + 1) });
      for (let i = 1; i < n; i++) b.add(cab[s][i], deck[s][i], 'cable');
      [0, n].forEach(i => {
        const x = cab[s][i] ? -half + 2 * half * i / n : 0, base = b.node(x, 0, (s ? 1 : -1) * zw, 0.2, true);
        b.add(base, cab[s][i], 'strut', { grp: 't' + s + i });
        const anchor = b.node(Math.sign(x) * xa, yd, (s ? 1 : -1) * zw, 0.2, true);
        b.add(cab[s][i], anchor, 'cable');
      });
    }
    for (let i = 1; i < n; i++) b.add(deck[0][i], deck[1][i], 'strut', { grp: 'x' + i });
    for (let i = 0; i < n; i++) { b.add(deck[0][i], deck[1][i + 1], 'brace', { grp: 'd' + i }); b.add(deck[1][i], deck[0][i + 1], 'brace', { grp: 'd' + i }); }
    b.add(cab[0][0], cab[1][0], 'strut'); b.add(cab[0][n], cab[1][n], 'strut');
    return { b, ea: 3000, strain: 0.006, kb: 900, kick: 1.6, view: [0.42, 0.3], deck, span: [-half, half], water: [-half * 0.86, half * 0.86],
      info: 'The towers are in compression; the main cables and the hangers are in tension, carrying the deck to the towers and the anchors in the ground.' };
  }

  // a deck of two rails, braced, with hidden bending springs, pinned at both ends; shared by the other bridges
  function deckOf(b, n, half, zw, yd, pins) {
    const deck = [[], []];
    [-1, 1].forEach((sz, s) => { for (let i = 0; i <= n; i++) deck[s].push(b.node(-half + 2 * half * i / n, yd, sz * zw, 0.25, i === 0 || i === n || (pins && pins.includes(i)))); });
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < n; i++) b.add(deck[s][i], deck[s][i + 1], 'strut', { grp: 'd' + i });
      for (let i = 0; i + 2 <= n; i++) b.add(deck[s][i], deck[s][i + 2], 'bend', { grp: 'd' + i, grp2: 'd' + (i + 1) });
    }
    for (let i = 1; i < n; i++) b.add(deck[0][i], deck[1][i], 'strut', { grp: 'x' + i });
    for (let i = 0; i < n; i++) { b.add(deck[0][i], deck[1][i + 1], 'brace', { grp: 'd' + i }); b.add(deck[1][i], deck[0][i + 1], 'brace', { grp: 'd' + i }); }
    return deck;
  }

  function cableStayed() {
    const b = builder(), n = 12, half = 1.1, zw = 0.16, yd = 0.3, yT = 1.0, ti = [3, 9];
    const deck = deckOf(b, n, half, zw, yd);
    ti.forEach((t, k) => {
      const tops = [];
      [-1, 1].forEach((sz, s) => {
        const x = -half + 2 * half * t / n, base = b.node(x, 0, sz * (zw + 0.03), 0.3, true), top = b.node(x, yT, sz * (zw + 0.03), 0.15);
        b.add(base, deck[s][t], 'strut', { grp: 'tw' + k + s }); b.add(deck[s][t], top, 'strut', { grp: 'tw' + k + s });
        b.add(base, top, 'brace', { grp: 'tw' + k + s });
        tops.push(top);
        const fan = k === 0 ? [0, 1, 2, 4, 5, 6] : [6, 7, 8, 10, 11, 12];
        fan.forEach(i => b.add(top, deck[s][i], 'cable'));
      });
      b.add(tops[0], tops[1], 'strut', { grp: 'tw' + k + 'x' });
    });
    return { b, ea: 3000, strain: 0.006, kb: 900, kick: 1.6, view: [0.42, 0.3], deck, span: [-half, half], water: [-0.42, 0.42],
      info: 'A cable-stayed bridge: straight cables in tension run from the towers to the deck, fanned out like a harp. The towers are in compression.' };
  }

  function archBridge() {
    const b = builder(), n = 12, half = 1.0, zw = 0.16, yd = 0.3, rise = 0.55;
    const deck = deckOf(b, n, half, zw, yd);
    const arch = [[], []], inners = [];
    [-1, 1].forEach((sz, s) => {
      const inner = []; inners.push(inner);
      for (let i = 0; i <= n; i++) {
        const x = -half + 2 * half * i / n, f = 1 - x * x / (half * half);
        arch[s].push(i === 0 || i === n ? deck[s][i] : b.node(x, yd + rise * f, sz * zw, 0.08));
        inner.push(i === 0 || i === n ? deck[s][i] : b.node(x * 0.97, yd + (rise - 0.11) * f, sz * zw, 0.04));
      }
      for (let i = 0; i < n; i++) {
        const g = { grp: 'a' + s + i };
        b.add(arch[s][i], arch[s][i + 1], 'strut', g); b.add(inner[i], inner[i + 1], 'brace', g);
        b.add(arch[s][i], inner[i + 1], 'brace', g); b.add(inner[i], arch[s][i + 1], 'brace', g);
        if (i > 0) b.add(arch[s][i], inner[i], 'brace', g);
      }
      for (let i = 1; i < n; i++) b.add(inner[i], deck[s][i], 'cable');
    });
    for (let i = 3; i <= n - 3; i += 2) b.add(arch[0][i], arch[1][i], 'strut', { grp: 'w' + i });
    // wind bracing between the two arches, and hidden sway frames at the ends, so the arches cannot fold sideways
    for (let i = 3; i + 2 <= n - 3; i += 2) { b.add(arch[0][i], arch[1][i + 2], 'brace', { grp: 'w' + i }); b.add(arch[1][i], arch[0][i + 2], 'brace', { grp: 'w' + i }); }
    [1, 2, n - 2, n - 1].forEach(i => { b.add(arch[0][i], deck[1][i], 'brace'); b.add(arch[1][i], deck[0][i], 'brace'); });
    for (let i = 1; i < n; i++) { b.add(inners[0][i], inners[1][i], 'brace', { grp: 'a0' + i }); b.add(arch[0][i], inners[1][i], 'brace', { grp: 'a0' + i }); b.add(arch[1][i], inners[0][i], 'brace', { grp: 'a1' + i }); }
    return { b, ea: 3000, strain: 0.006, kb: 900, iters: 6, kick: 1.6, view: [0.42, 0.3], deck, span: [-half, half], water: [-half * 0.82, half * 0.82],
      info: 'A tied arch: the arch is in compression, pushing outward at its feet; the deck ties the feet together and hangs from the arch on cables in tension.' };
  }

  function balloon() {
    const b = builder(), R = 0.3, cy = 1.0, m = 10, env = [];
    const top = b.node(0, cy + R, 0, 0.01); env.push(top);
    const rings = [];
    for (let k = 1; k <= 5; k++) {
      const th = k * Math.PI / 6, ring = [];
      for (let j = 0; j < m; j++) { const a = 2 * Math.PI * j / m; ring.push(b.node(R * Math.sin(th) * Math.cos(a), cy + R * Math.cos(th), R * Math.sin(th) * Math.sin(a), 0.01)); }
      rings.push(ring); env.push(...ring);
    }
    const cen = b.node(0, cy, 0, 0.02);
    const fab = {}, F = (p, q) => { const k = Math.min(p, q) + '-' + Math.max(p, q); if (fab[k] === undefined) fab[k] = b.add(p, q, 'fabric'); return fab[k]; };
    for (let j = 0; j < m; j++) {
      const j2 = (j + 1) % m;
      b.tri(top, rings[0][j], rings[0][j2], F(top, rings[0][j]), F(rings[0][j], rings[0][j2]), F(top, rings[0][j2]));
      for (let k = 0; k < 4; k++) {
        const a = rings[k][j], c = rings[k][j2], d = rings[k + 1][j], e = rings[k + 1][j2];
        b.tri(a, c, e, F(a, c), F(c, e), F(a, e)); b.tri(a, e, d, F(a, e), F(e, d), F(a, d));
      }
      F(rings[4][j], rings[4][j2]);
    }
    env.forEach(i => b.add(cen, i, 'bend'));
    // the basket: a small rigid box
    const bw = 0.06, yb = 0.34, bk = [];
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([x, z]) => bk.push(b.node(x * bw, yb, z * bw, 0.1)));
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([x, z]) => bk.push(b.node(x * bw * 0.85, yb - 0.08, z * bw * 0.85, 0.1)));
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].map(([p, q]) => [bk[p], bk[q]]);
    b.body(bk, edges, 'basket');
    // suspension cables from the mouth of the envelope to the basket
    for (let c = 0; c < 4; c++) { const j = Math.round(c * m / 4 + 1) % m; b.add(rings[4][j], bk[c], 'cable'); b.add(rings[4][(j + 2) % m], bk[(c + 1) % 4], 'cable'); }
    // tethers to two stakes in the ground
    const s1 = b.node(-0.5, 0, 0, 0.1, true), s2 = b.node(0.5, 0, 0, 0.1, true);
    b.add(s1, bk[4], 'cable', { strain: 0.01 }); b.add(s2, bk[5], 'cable', { strain: 0.01 });
    // buoyancy: the hot air lifts the envelope with 1.5 times the weight of everything
    const Mtot = env.length * 0.01 + 0.02 + 8 * 0.1, lift = 1.5 * Mtot * 9.81 / (env.length * 0.01);
    env.forEach(i => b.lift(i, lift));
    return { b, ea: 400, eaFabric: 200, strain: 0.02, strainFabric: 0.005, kb: 300, iters: 3, kick: 0.6, view: [0.5, 0.25], balloon: cen,
      info: 'Hot air pushes up on the envelope; the fabric and the cables are in tension, carrying the basket. Two tethers hold it down. Cut a tether and it drifts; cut the basket loose and it falls.' };
  }

  // A simplified human: bones as rigid struts, fascia as cables in tension crossing every joint. Feet are pinned.
  function human() {
    const b = builder(), N = {};
    const nd = (k, x, y, z, m, pin) => (N[k] = b.node(x, y, z, m || 0.03, pin));
    [1, -1].forEach(s => {
      const q = s > 0 ? 'L' : 'R';
      nd('heel' + q, s * .07, 0, -.03, 0, true); nd('toe' + q, s * .08, 0, .1, 0, true); nd('ank' + q, s * .07, .055, 0, 0, true);
      nd('fl' + q, s * .11, 0, .03, 0, true); nd('fm' + q, s * .035, 0, .03, 0, true);
      nd('knee' + q, s * .075, .29, .005); nd('tf' + q, s * .075, .24, .035); nd('cb' + q, s * .075, .2, -.045); nd('ls' + q, s * .105, .18, 0); nd('ms' + q, s * .045, .18, 0);
      nd('hip' + q, s * .085, .53, 0); nd('tq' + q, s * .085, .45, .05); nd('tb' + q, s * .085, .43, -.05); nd('tl' + q, s * .125, .5, 0); nd('tm' + q, s * .05, .42, 0);
      nd('asis' + q, s * .1, .6, .05); nd('isch' + q, s * .06, .5, -.045); nd('crest' + q, s * .135, .63, 0);
      nd('rib' + q, s * .11, .82, .0); nd('ac' + q, s * .16, .92, -.01); nd('sc' + q, s * .085, .84, -.075);
      nd('el' + q, s * .19, .72, -.02, .02); nd('wr' + q, s * .2, .55, .02, .02); nd('hd' + q, s * .2, .47, .035, .02);
      nd('ear' + q, s * .065, 1.0, -.005, .02);
    });
    nd('sac', 0, .6, -.065); nd('pub', 0, .52, .055); nd('l3', 0, .68, -.045);
    nd('t12', 0, .75, -.055); nd('t6', 0, .85, -.07); nd('c7', 0, .93, -.05); nd('st', 0, .91, .045); nd('xi', 0, .8, .075);
    nd('occ', 0, .97, -.045, .02); nd('top', 0, 1.08, 0, .02); nd('brow', 0, 1.02, .075, .02); nd('chin', 0, .95, .065, .02);
    const n = k => N[k], P = (a, c) => [n(a), n(c)];
    ['L', 'R'].forEach(q => {
      b.body(['heel', 'toe', 'ank', 'fl', 'fm'].map(k => n(k + q)), [P('heel' + q, 'toe' + q), P('heel' + q, 'ank' + q), P('ank' + q, 'toe' + q)], 'foot' + q);
      b.body(['ank', 'knee', 'tf', 'cb', 'ls', 'ms'].map(k => n(k + q)), [P('ank' + q, 'knee' + q)], 'shank' + q);
      b.body(['knee', 'hip', 'tq', 'tb', 'tl', 'tm'].map(k => n(k + q)), [P('knee' + q, 'hip' + q)], 'thigh' + q);
      b.add(n('ac' + q), n('el' + q), 'strut', { grp: 'arm' + q }); b.add(n('el' + q), n('wr' + q), 'strut', { grp: 'fore' + q }); b.add(n('wr' + q), n('hd' + q), 'strut', { grp: 'hand' + q });
    });
    b.body(['hipL', 'hipR', 'asisL', 'asisR', 'ischL', 'ischR', 'crestL', 'crestR', 'sac', 'pub'].map(n),
      [P('sac', 'crestL'), P('sac', 'crestR'), P('crestL', 'asisL'), P('crestR', 'asisR'), P('asisL', 'pub'), P('asisR', 'pub'), P('hipL', 'ischL'), P('hipR', 'ischR')], 'pelvis');
    // the lumbar spine: vertebrae and discs together hold the trunk on the pelvis (a stiff, springy column)
    b.body(['sac', 'pub', 'crestL', 'crestR', 'l3', 't12', 't6', 'xi'].map(n), [P('sac', 'l3'), P('l3', 't12')], 'spine');
    b.add(n('c7'), n('top'), 'bend', { grp: 'neck' });
    b.body(['t12', 't6', 'c7', 'st', 'xi', 'ribL', 'ribR', 'acL', 'acR', 'scL', 'scR'].map(n),
      [P('t12', 't6'), P('t6', 'c7'), P('st', 'xi'), P('t6', 'ribL'), P('t6', 'ribR'), P('ribL', 'xi'), P('ribR', 'xi'), P('st', 'acL'), P('st', 'acR'), P('acL', 'scL'), P('acR', 'scR'), P('t12', 'ribL'), P('t12', 'ribR')], 'thorax');
    b.add(n('c7'), n('occ'), 'strut', { grp: 'neck' });
    b.body(['occ', 'top', 'brow', 'chin', 'earL', 'earR'].map(n), [P('occ', 'top'), P('top', 'brow'), P('brow', 'chin'), P('chin', 'occ'), P('earL', 'top'), P('earR', 'top'), P('earL', 'chin'), P('earR', 'chin')], 'head');
    // fascia: cables across every joint, front, back, sides and spirals
    const cab = (a, c) => b.add(n(a), n(c), 'cable');
    ['L', 'R'].forEach(q => {
      cab('heel' + q, 'cb' + q); cab('toe' + q, 'tf' + q); cab('fl' + q, 'ls' + q); cab('fm' + q, 'ms' + q);
      cab('cb' + q, 'tb' + q); cab('tf' + q, 'tq' + q); cab('ls' + q, 'tl' + q); cab('ms' + q, 'tm' + q);
      cab('tb' + q, 'isch' + q); cab('tq' + q, 'asis' + q); cab('tl' + q, 'crest' + q); cab('tm' + q, 'pub'); cab('tl' + q, 'sac');
      cab('l3', 'tm' + q); cab('crest' + q, 'l3'); cab('crest' + q, 'rib' + q); cab('sac', 'sc' + q); cab('isch' + q, 't12');
      cab('ac' + q, 'ear' + q); cab('sc' + q, 'occ'); cab('el' + q, 'rib' + q); cab('el' + q, 'sc' + q); cab('wr' + q, 'ac' + q);
    });
    cab('pub', 'xi'); cab('asisL', 'ribR'); cab('asisR', 'ribL'); cab('st', 'chin'); cab('l3', 'scL'); cab('l3', 'scR'); cab('crestL', 'scL'); cab('crestR', 'scR'); cab('scL', 'earL'); cab('scR', 'earR'); cab('asisL', 'xi'); cab('asisR', 'xi');
    return { b, ea: 3000, strain: 0.0005, kb: 8000, iters: 6, kick: 0.9, view: [0.3, 0.1], thin: 0.55, head: ['occ', 'top', 'brow', 'chin', 'earL', 'earR'].map(n),
      info: 'A simplified human tensegrity: the bones are struts, and the fascia is a web of cables in tension crossing every joint, front, back and sides. Nothing holds it upright but tension.' };
  }

  const SHAPES = [
    ['bridge', 'Suspension bridge', bridge, 'Bridges'],
    ['stayed', 'Cable-stayed bridge', cableStayed, 'Bridges'],
    ['arch', 'Tied-arch bridge', archBridge, 'Bridges'],
    ['six', 'Six-strut tensegrity', sixStrut, 'Tensegrities'],
    ['prism', 'Three-strut prism (desk toy)', prism, 'Tensegrities'],
    ['table', 'Tensegrity table', table, 'Tensegrities'],
    ['human', 'A simplified human', human, 'The body'],
    ['balloon', 'Hot air balloon', balloon, 'Everyday tension'],
    ['tent', 'A tent', tent, 'Tents and treehouses'],
    ['mansion', 'A mansion of a tent', mansionTent, 'Tents and treehouses'],
    ['treehouse', 'Treehouse neighbourhood', treehouses, 'Tents and treehouses'],
    ['wheel', 'Bicycle wheel', wheel, 'Everyday tension'],
  ];

  function make(key) {
    const row = SHAPES.find(s => s[0] === key) || SHAPES[0];
    const sh = row[2](), { P, W, C, T } = sh.b, n = P.length;
    // spare room for one extra node per strut: a strut that is broken cracks in the middle and hinges there
    const cap = n + C.filter(c => c.kind === 'strut').length;
    const x = new Float64Array(3 * cap), w = new Float64Array(cap); w.set(W);
    P.forEach((p, i) => { x[3 * i] = p[0]; x[3 * i + 1] = p[1]; x[3 * i + 2] = p[2]; });
    C.forEach(c => {
      const L = dist(P[c.a], P[c.b]);
      const tens = c.kind === 'cable' || c.kind === 'fabric';
      const strain = c.strain !== undefined ? c.strain : c.kind === 'fabric' ? (sh.strainFabric || sh.strain) : tens ? sh.strain : 0;
      c.L0 = L * (1 - strain);
      const ea = c.kind === 'fabric' ? (sh.eaFabric || sh.ea) : sh.ea;
      c.comp = tens ? c.L0 / ea : c.kind === 'bend' ? 1 / (sh.kb || 200) : 0;
      c.uni = tens; c.draw = c.kind !== 'brace' && c.kind !== 'bend'; c.alive = true; c.T = 0; c.Tema = 0;
    });
    const ay0 = new Float64Array(cap); ay0.set(sh.b.A);
    const S = { iters: sh.iters || 1, key: row[0], name: row[1], info: sh.info, view: sh.view, kick: sh.kick, n, n0: n, cap, c0: C.length, cracks: [], x, p: new Float64Array(x), v: new Float64Array(3 * cap), w, C, T, t: 0,
      ay0, ay: new Float64Array(ay0), deck: sh.deck, span: sh.span, water: sh.water, balloon: sh.balloon, thin: sh.thin || 1, head: sh.head };
    // settle into equilibrium under gravity with strong damping, then freeze the result as time zero
    for (let k = 0; k < 150; k++) step(S, 1 / 60, 16, 14);
    S.v.fill(0);
    measure(S, 1);
    const ref = {};
    C.forEach(c => { if (c.uni && c.T > 0) (ref[c.kind] = ref[c.kind] || []).push(c.T); });
    S.ref = {};
    Object.keys(ref).forEach(k => { const a = ref[k].sort((p, q) => p - q); S.ref[k] = a[a.length >> 1] || 1; });
    S.x0 = new Float64Array(S.x);
    return S;
  }

  function step(S, dt, nsub, damp) {
    const h = dt / nsub, h2 = h * h, x = S.x, v = S.v, p = S.p, w = S.w, n = S.n, C = S.C, kd = Math.exp(-damp * h);
    for (let s = 0; s < nsub; s++) {
      for (let i = 0, j = 0; i < n; i++, j += 3) {
        p[j] = x[j]; p[j + 1] = x[j + 1]; p[j + 2] = x[j + 2];
        if (!w[i]) continue;
        v[j + 1] += (GRAV + S.ay[i]) * h;
        x[j] += v[j] * h; x[j + 1] += v[j + 1] * h; x[j + 2] += v[j + 2] * h;
      }
      if (S.iters > 1) for (let ci = 0; ci < C.length; ci++) C[ci].lam = 0;
      for (let it = 0; it < S.iters; it++) for (let ci = 0; ci < C.length; ci++) {
        const c = C[ci]; if (!c.alive) continue;
        const wa = w[c.a], wb = w[c.b], ws = wa + wb; if (!ws) continue;
        const a = 3 * c.a, b = 3 * c.b;
        let dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2];
        const L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9, e = L - c.L0;
        if (c.uni && e <= 0) continue;
        // XPBD: the multiplier accumulates over the iterations of one substep, so compliance stays exact
        const at = c.comp / h2, dl = (-e - at * (c.lam || 0)) / (ws + at);
        if (S.iters > 1) c.lam = (c.lam || 0) + dl;
        dx /= L; dy /= L; dz /= L;
        x[a] -= wa * dl * dx; x[a + 1] -= wa * dl * dy; x[a + 2] -= wa * dl * dz;
        x[b] += wb * dl * dx; x[b + 1] += wb * dl * dy; x[b + 2] += wb * dl * dz;
      }
      for (let i = 0, j = 0; i < n; i++, j += 3) {
        if (!w[i]) continue;
        if (x[j + 1] < 0) { x[j + 1] = 0; x[j] = p[j] + (x[j] - p[j]) * 0.25; x[j + 2] = p[j + 2] + (x[j + 2] - p[j + 2]) * 0.25; }
        v[j] = (x[j] - p[j]) / h * kd; v[j + 1] = (x[j + 1] - p[j + 1]) / h * kd; v[j + 2] = (x[j + 2] - p[j + 2]) / h * kd;
      }
    }
    S.t += dt;
  }

  // Cable tension from the stretch beyond rest length: T = EA * strain. A slack cable carries nothing.
  function measure(S, a) {
    const x = S.x;
    for (const c of S.C) {
      if (!c.uni) continue;
      if (!c.alive) { c.T = 0; continue; }
      const i = 3 * c.a, j = 3 * c.b, L = Math.hypot(x[j] - x[i], x[j + 1] - x[i + 1], x[j + 2] - x[i + 2]);
      c.T = Math.max(0, L - c.L0) / c.comp;
      c.Tema += (c.T - c.Tema) * a;
    }
  }

  function reset(S) { S.n = S.n0; S.C.length = S.c0; S.cracks = []; S.x.set(S.x0); S.p.set(S.x0); S.v.fill(0); S.ay.set(S.ay0); S.C.forEach(c => { c.alive = true; }); measure(S, 1); S.t = 0; }

  // A broken strut does not vanish: it cracks in the middle. The two halves stay, joined by a free hinge, so the strut
  // can no longer push its ends apart and the physics decides how the pieces fold.
  function snap(S, c) {
    c.alive = false;
    if (c.half || S.n >= S.cap) return;
    const i = S.n++, a = 3 * c.a, b = 3 * c.b, j = 3 * i, x = S.x;
    for (let k = 0; k < 3; k++) { x[j + k] = (x[a + k] + x[b + k]) / 2; S.p[j + k] = x[j + k]; S.v[j + k] = (S.v[a + k] + S.v[b + k]) / 2; }
    S.w[i] = Math.max(S.w[c.a], S.w[c.b]) || 1; S.ay[i] = 0; S.ay0[i] = 0;
    const half = (p, q) => ({ a: p, b: q, kind: 'strut', L0: c.L0 / 2, comp: 0, uni: false, draw: true, alive: true, T: 0, Tema: 0, half: true });
    S.C.push(half(c.a, i), half(i, c.b)); S.cracks.push(i);
  }

  function kill(S, ci) {
    const c = S.C[ci]; if (!c || !c.alive) return 0;
    let k = 0;
    if (c.kind === 'strut' && c.grp) S.C.slice().forEach(o => { if (o.alive && (o.grp === c.grp || o.grp2 === c.grp)) { if (o.kind === 'strut' && o.draw) snap(S, o); else o.alive = false; k++; } });
    else if (c.kind === 'strut') { snap(S, c); k = 1; }
    else { c.alive = false; k = 1; }
    return k;
  }

  function pluck(S, i, mag) {
    const x = S.x; let cx = 0, cy = 0, cz = 0, m = 0;
    for (let k = 0; k < S.n; k++) if (S.w[k]) { cx += x[3 * k]; cy += x[3 * k + 1]; cz += x[3 * k + 2]; m++; }
    cx /= m; cy /= m; cz /= m;
    let dx = x[3 * i] - cx, dy = x[3 * i + 1] - cy, dz = x[3 * i + 2] - cz; const L = Math.hypot(dx, dy, dz) || 1;
    S.v[3 * i] += dx / L * mag; S.v[3 * i + 1] += dy / L * mag; S.v[3 * i + 2] += dz / L * mag;
  }

  const ok = S => { for (let i = 0; i < S.x.length; i++) if (!isFinite(S.x[i]) || Math.abs(S.x[i]) > 50) return false; return true; };

  return { SHAPES, make, step, measure, reset, kill, pluck, ok };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = TG;

/* ---------- the widget ---------- */
(() => {
  if (typeof document === 'undefined') return;
  const stages = [...document.querySelectorAll('.stage')].filter(s => s.querySelector('canvas#tg'));
  if (!stages.length) return;

  const st = document.createElement('style');
  st.textContent = `
.stage{touch-action:pan-y;cursor:grab}
.stage.pick{cursor:crosshair}
.tgc{max-width:560px;width:100%;margin:10px auto 0;display:grid;gap:8px;font-size:.9rem}
.tgc-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.tgc label.tgc-sel{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font:600 .86rem/1.2 var(--font);color:var(--navy)}
.tgc select{font:600 .88rem/1.2 var(--font);color:var(--navy);background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px 30px 8px 10px;max-width:100%;cursor:pointer}
.tgc select:hover{border-color:var(--sky)}
.tgc .chipbtn{padding:8px 11px}
.tgc .chipbtn.on{background:var(--blue);border-color:var(--blue);color:#fff}
.tgc .chipbtn.cut.on{background:#B4232F;border-color:#B4232F}
.tgc-seg{display:inline-flex;align-items:center;gap:4px;color:var(--soft);font-size:.82rem;font-weight:600}
.tgc-info{margin:0;max-width:none;font-size:.9rem;line-height:1.5;color:var(--ink);background:var(--mist);border:1px solid var(--line);border-radius:10px;padding:9px 12px}
.tgc-key{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:6px;font-size:.8rem;color:var(--soft)}
.tgc-key i{display:inline-block;width:20px;vertical-align:middle;margin-right:5px;border-radius:3px}
.tgc-status{margin:0;max-width:none;font-size:.84rem;color:var(--soft);min-height:1.3em}
.tgc-chk{display:inline-flex;align-items:center;gap:5px;margin-left:8px;font:600 .84rem/1 var(--font);color:var(--navy);cursor:pointer}.tgc-chk input{accent-color:var(--blue)}
.nav .grp.open .drop{display:flex}
@media (max-width:1400px){
  .nav .grpbtn{padding:12px 12px 4px;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;cursor:default}
  .nav .grpbtn span{display:none}
  .nav .grp.on>.grpbtn{background:none}
  .nav .drop{display:flex;position:static;border:0;box-shadow:none;padding:0 0 0 8px;min-width:0}
}`;
  document.head.appendChild(st);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  stages.forEach(init);

  function init(stage) {
    const cv = stage.querySelector('canvas#tg'), ctx = cv.getContext('2d');
    const auto = stage.dataset.autospin === '1' && !reduce;
    const start = TG.SHAPES.some(r => r[0] === stage.dataset.start) ? stage.dataset.start : 'six';
    let S = TG.make(start), running = true, spin = auto, speed = 1, mode = 'pluck', hover = -1, cuts = 0, removed = 0, flashes = [], visible = true;
    let water = true, traffic = true, cars = [], flown = 0;
    let yaw = S.view[0], pitch = S.view[1], vyaw = 0, W = 0, H = 0, cam = null;

    // controls
    const box = document.createElement('div'); box.className = 'tgc';
    box.innerHTML = `
<div class="tgc-row"><label class="tgc-sel">Change the tensegrity <select>${[...new Set(TG.SHAPES.map(s => s[3]))].map(g => `<optgroup label="${g}">${TG.SHAPES.filter(s => s[3] === g).map(s => `<option value="${s[0]}"${s[0] === start ? ' selected' : ''}>${s[1]}</option>`).join('')}</optgroup>`).join('')}</select></label>
  <span class="tgc-seg tgc-bridge"><label class="tgc-chk"><input type="checkbox" data-o="water" checked> Water</label><label class="tgc-chk"><input type="checkbox" data-o="traffic" checked> Traffic</label></span></div>
<div class="tgc-row" role="group" aria-label="Playback">
  <button type="button" class="chipbtn" data-a="play" aria-pressed="false">Pause</button>
  <span class="tgc-seg">Speed <button type="button" class="chipbtn on" data-s="1">1x</button><button type="button" class="chipbtn" data-s="0.25">0.25x</button><button type="button" class="chipbtn" data-s="0.1">0.1x</button></span>
  <button type="button" class="spinsw" data-a="spin" aria-pressed="${spin}"><span class="sw" aria-hidden="true"></span><span class="st"></span></button>
  <button type="button" class="chipbtn" data-a="reset">Reset</button>
</div>
<div class="tgc-row" role="group" aria-label="What a tap does">
  <button type="button" class="chipbtn on" data-m="pluck">Pluck a node</button>
  <button type="button" class="chipbtn cut" data-m="cut">Cut a cable</button>
  <button type="button" class="chipbtn cut" data-m="strut">Break a strut</button>
</div>
<p class="tgc-info"><span class="tgc-text"></span>
<span class="tgc-key"><span><i style="height:6px;background:var(--deep)"></i>strut: compression</span><span><i style="height:3px;background:var(--sky)"></i>cable: tension</span><span><i style="height:0;border-top:2px dashed #A9B8CC"></i>slack cable</span><span><i style="height:4px;background:#1D5FD1;box-shadow:0 0 6px #5B9BE6"></i>tension changing</span></span></p>
<p class="tgc-status" aria-live="polite"></p>`;
    stage.insertAdjacentElement('afterend', box);
    const $ = q => box.querySelector(q), sel = $('select'), status = $('.tgc-status');
    const setInfo = () => { $('.tgc-text').textContent = S.info; $('.tgc-bridge').style.display = S.deck ? '' : 'none'; };
    box.querySelectorAll('[data-o]').forEach(c => c.addEventListener('change', () => { if (c.dataset.o === 'water') water = c.checked; else { traffic = c.checked; if (!traffic) { cars = []; S.ay.set(S.ay0); } } }));
    const setCursor = () => { stage.classList.remove('cur-pluck', 'cur-cut', 'cur-strut'); stage.classList.add('cur-' + mode); };
    setCursor();
    const say = () => {
      const parts = [];
      if (cuts) parts.push(`${cuts} cable${cuts > 1 ? 's' : ''} cut`);
      if (removed) parts.push(`${removed} strut${removed > 1 ? 's' : ''} broken`);
      let m = parts.length ? parts.join(', ') + '. The physics decides what follows.' : mode === 'cut' ? 'Tap a cable to cut it.' : mode === 'strut' ? 'Tap a strut to break it. It cracks in the middle and folds.' : 'Tap a node to send a pulse of tension; drag to turn.';
      if (!running) m = 'Paused. ' + m + ' Press Play to run the physics.';
      status.textContent = m;
    };
    const chips = (attr, val) => box.querySelectorAll(`[data-${attr}]`).forEach(b => b.classList.toggle('on', b.dataset[attr] === String(val)));
    function load(key) { S = TG.make(key); S.deckSeg = null; yaw = S.view[0]; pitch = S.view[1]; vyaw = 0; cuts = removed = 0; hover = -1; cars = []; fit(); setInfo(); say(); draw(); }
    sel.addEventListener('change', () => load(sel.value));
    box.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.s) { speed = +b.dataset.s; chips('s', b.dataset.s); }
      if (b.dataset.m) { mode = b.dataset.m; chips('m', mode); setCursor(); hover = -1; say(); }
      const a = b.dataset.a;
      if (a === 'play') { running = !running; b.textContent = running ? 'Pause' : 'Play'; b.setAttribute('aria-pressed', !running); say(); }
      if (a === 'spin') { spin = !spin; b.setAttribute('aria-pressed', spin); }
      if (a === 'reset') { TG.reset(S); cuts = removed = 0; cars = []; yaw = S.view[0]; pitch = S.view[1]; vyaw = 0; say(); }
    });

    // camera
    function fit() {
      const x = S.x0; let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      for (let i = 0; i < S.n; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], x[3 * i + k]); hi[k] = Math.max(hi[k], x[3 * i + k]); }
      const c = lo.map((v, k) => (v + hi[k]) / 2);
      let R = 0; for (let i = 0; i < S.n; i++) R = Math.max(R, Math.hypot(x[3 * i] - c[0], x[3 * i + 1] - c[1], x[3 * i + 2] - c[2]));
      cam = { c, R, D: 3.6 * R };
    }
    function size() { const dpr = Math.min(2, devicePixelRatio || 1), r = stage.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); if (cam && W) draw(); }
    new ResizeObserver(size).observe(stage); size(); fit();
    function pr(px, py, pz) {
      const sc = Math.min(W, H) * 0.43 / cam.R;
      const x = px - cam.c[0], y = py - cam.c[1], z = pz - cam.c[2];
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const X = x * cy + z * sy, Z = -x * sy + z * cy;
      const Y2 = y * cp + Z * sp, Z2 = -y * sp + Z * cp, f = cam.D / (cam.D + Z2);
      return [W / 2 + X * f * sc, H / 2 - Y2 * f * sc, Z2, f];
    }

    // drawing
    function draw() {
      const x = S.x, P = [];
      for (let i = 0; i < S.n; i++) P.push(pr(x[3 * i], x[3 * i + 1], x[3 * i + 2]));
      ctx.clearRect(0, 0, W, H);
      const sky = css('--sky') || '#5B9BE6', deep = css('--deep') || '#0E3A75', blue = css('--blue') || '#1D5FD1';
      // ground grid
      const g = cam.R * 1.25, gx = cam.c[0], gz = cam.c[2];
      ctx.strokeStyle = 'rgba(11,37,69,.08)'; ctx.lineWidth = 1;
      for (let k = -4; k <= 4; k++) {
        const t = k / 4 * g;
        let a = pr(gx + t, 0, gz - g), b = pr(gx + t, 0, gz + g); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        a = pr(gx - g, 0, gz + t); b = pr(gx + g, 0, gz + t); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      // a river flowing under a bridge
      if (S.water && water) {
        const [x0, x1] = S.water, z0 = -cam.R * 1.15, z1 = cam.R * 1.15, t = performance.now() / 1000;
        const q = [pr(x0, 0, z0), pr(x1, 0, z0), pr(x1, 0, z1), pr(x0, 0, z1)];
        ctx.fillStyle = 'rgba(91,155,230,.16)'; ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(29,95,209,.35)'; ctx.lineWidth = 1.2;
        for (let k = 0; k < 14; k++) {
          const fx = x0 + (x1 - x0) * ((k * 0.618) % 1), fz = z0 + (z1 - z0) * (((k * 0.37 + t * 0.12) % 1)), L = (z1 - z0) * 0.06;
          const a = pr(fx, 0, fz), b = pr(fx + 0.04, 0, Math.min(z1, fz + L)); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2 + 3, (a[1] + b[1]) / 2 - 2, b[0], b[1]); ctx.stroke();
        }
      }
      // shadows on the ground
      ctx.strokeStyle = 'rgba(11,37,69,.07)'; ctx.lineCap = 'round';
      S.C.forEach(c => {
        if (!c.alive || !c.draw || c.kind === 'fabric') return;
        const a = pr(x[3 * c.a], 0, x[3 * c.a + 2]), b = pr(x[3 * c.b], 0, x[3 * c.b + 2]);
        ctx.lineWidth = c.kind === 'strut' ? 5 : 1.5; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      });
      // fabric
      if (S.T.length) {
        const tris = S.T.filter(t => S.C[t[3]].alive && S.C[t[4]].alive && S.C[t[5]].alive).map(t => [t, (P[t[0]][2] + P[t[1]][2] + P[t[2]][2]) / 3]).sort((p, q) => q[1] - p[1]);
        ctx.fillStyle = 'rgba(91,155,230,.22)';
        tris.forEach(([t]) => { ctx.beginPath(); ctx.moveTo(P[t[0]][0], P[t[0]][1]); ctx.lineTo(P[t[1]][0], P[t[1]][1]); ctx.lineTo(P[t[2]][0], P[t[2]][1]); ctx.closePath(); ctx.fill(); });
      }
      // cables
      S.C.forEach((c, ci) => {
        if (!c.alive || !c.uni) return;
        const a = P[c.a], b = P[c.b], ref = S.ref[c.kind] || 1, fab = c.kind === 'fabric';
        const dev = Math.min(1, Math.abs(c.T - c.Tema) / ref * 2.2);
        ctx.setLineDash([]); ctx.shadowBlur = 0;
        if (c.T <= 0) { ctx.strokeStyle = '#A9B8CC'; ctx.lineWidth = fab ? 0.5 : 1.2; if (fab) ctx.globalAlpha = 0.5; else ctx.setLineDash([4, 4]); }
        else { ctx.strokeStyle = sky; ctx.globalAlpha = fab ? 0.55 : 0.9; ctx.lineWidth = (fab ? 0.6 : 1.2) + (fab ? 0.6 : 1.6) * Math.min(1.6, c.T / ref); }
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.globalAlpha = 1;
        if (dev > 0.06) { ctx.setLineDash([]); ctx.strokeStyle = blue; ctx.globalAlpha = dev; ctx.lineWidth = (fab ? 1.2 : 2) + 2.5 * dev; ctx.shadowColor = sky; ctx.shadowBlur = 8 * dev; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0; }
        if (ci === hover) { ctx.setLineDash([]); ctx.strokeStyle = '#D33A45'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      });
      ctx.setLineDash([]);
      // struts, far to near
      S.C.map((c, ci) => [c, ci]).filter(([c]) => c.alive && c.kind === 'strut').sort((p, q) => (P[q[0].a][2] + P[q[0].b][2]) - (P[p[0].a][2] + P[p[0].b][2])).forEach(([c, ci]) => {
        const a = P[c.a], b = P[c.b];
        ctx.strokeStyle = ci === hover ? '#D33A45' : deep; ctx.lineCap = 'round';
        ctx.lineWidth = S.thin * Math.max(3, Math.min(10, 7.5 * (a[3] + b[3]) / 2 * Math.min(1.3, Math.min(W, H) / 420)));
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      });
      // traffic on the deck
      if (S.deck && traffic) cars.forEach(c => {
        const p = c.free ? c.p : carPos(c); if (!p) return;
        const q = pr(p[0], p[1] + 0.035, p[2]), w = 9 * q[3] * Math.min(1.3, Math.min(W, H) / 420);
        ctx.save(); ctx.translate(q[0], q[1]); if (c.free) ctx.rotate(c.rot); ctx.globalAlpha = c.free && c.sunk ? Math.max(0, 1 - c.sunk / 1.6) : 1;
        ctx.fillStyle = c.col; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w, -w * 0.55, 2 * w, w * 1.1, 3) : ctx.rect(-w, -w * 0.55, 2 * w, w * 1.1); ctx.fill(); ctx.restore();
        if (c.free && c.sunk && c.sunk < 0.9) { const k = c.sunk / 0.9, wet = S.water && water && p[0] > S.water[0] && p[0] < S.water[1]; ctx.strokeStyle = wet ? `rgba(91,155,230,${1 - k})` : `rgba(120,110,90,${1 - k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(q[0], q[1], (6 + 26 * k) * q[3], (2 + 9 * k) * q[3], 0, 0, 7); ctx.stroke(); }
      });
      // a head for the human figure
      if (S.head && S.C.some(c => c.grp === 'head' && c.alive)) {
        let cx = 0, cy = 0; S.head.forEach(i => { cx += P[i][0]; cy += P[i][1]; }); cx /= S.head.length; cy /= S.head.length;
        let r = 0; S.head.forEach(i => { r = Math.max(r, Math.hypot(P[i][0] - cx, P[i][1] - cy)); });
        ctx.fillStyle = 'rgba(91,155,230,.14)'; ctx.strokeStyle = deep; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.95, r * 1.05, 0, 0, 7); ctx.fill(); ctx.stroke();
      }
      // nodes
      for (let i = 0; i < S.n; i++) {
        const p = P[i];
        if (!S.w[i]) { ctx.fillStyle = '#7C8DA6'; ctx.fillRect(p[0] - 3, p[1] - 3, 6, 6); continue; }
        if (i >= S.n0) { // the crack in a broken strut: a short red line across it
          const h = S.C.find(c => c.half && c.alive && c.b === i) || S.C.find(c => c.half && c.alive && c.a === i); if (!h) continue;
          const q = P[h.b === i ? h.a : h.b], dx = p[0] - q[0], dy = p[1] - q[1], d = Math.hypot(dx, dy) || 1, r = 7 * p[3] * Math.min(1.3, Math.min(W, H) / 420) + 3;
          ctx.strokeStyle = '#D33A45'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p[0] - dy / d * r, p[1] + dx / d * r); ctx.lineTo(p[0] + dy / d * r, p[1] - dx / d * r); ctx.stroke(); continue; }
        if (S.T.length && !S.C.some(c => c.alive && c.kind !== 'fabric' && c.draw && (c.a === i || c.b === i))) continue;
        ctx.fillStyle = blue; ctx.beginPath(); ctx.arc(p[0], p[1], 3.2 * p[3], 0, 7); ctx.fill();
      }
      // snap flashes
      const now = performance.now();
      flashes = flashes.filter(f => now - f.t0 < 500);
      flashes.forEach(f => { const q = pr(f.x, f.y, f.z), k = (now - f.t0) / 500; ctx.strokeStyle = `rgba(211,58,69,${1 - k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q[0], q[1], 4 + 18 * k, 0, 7); ctx.stroke(); });
    }

    // traffic: each car presses on the two deck nodes it sits between, so the bridge carries a real moving load
    const COLS = ['#C62828', '#F2A93B', '#2E7D5B', '#0E3A75', '#7C3AED'];
    function carPos(c) {
      const d = S.deck[c.lane], n = d.length - 1, u = (c.x - S.span[0]) / (S.span[1] - S.span[0]) * n, i = Math.floor(u);
      if (i < 0 || i >= n) return null;
      const f = u - i, a = 3 * d[i], b = 3 * d[i + 1], x = S.x;
      return [x[a] + (x[b] - x[a]) * f, x[a + 1] + (x[b + 1] - x[a + 1]) * f, x[a + 2] + (x[b + 2] - x[a + 2]) * f, i, f];
    }
    function trafficStep(dt) {
      if (!S.deck || !traffic) return;
      if (Math.random() < dt * 0.9 && cars.length < 8) { const lane = Math.random() < 0.5 ? 0 : 1, dir = lane ? 1 : -1; cars.push({ lane, dir, x: dir > 0 ? S.span[0] : S.span[1], v: 0.28 + Math.random() * 0.12, col: COLS[Math.floor(Math.random() * COLS.length)] }); }
      S.ay.set(S.ay0);
      if (!S.deckSeg) { // the strut under each stretch of road, and how long and how high it was built
        S.deckSeg = S.deck.map(d => d.slice(0, -1).map((a, i) => { const b = d[i + 1], x = S.x; return { c: S.C.find(c => c.kind === 'strut' && (c.a === a && c.b === b || c.a === b && c.b === a)), L: Math.hypot(x[3 * b] - x[3 * a], x[3 * b + 1] - x[3 * a + 1], x[3 * b + 2] - x[3 * a + 2]), y: (x[3 * a + 1] + x[3 * b + 1]) / 2 }; }));
      }
      cars = cars.filter(c => {
        if (c.free) { // off the road: a falling body
          c.vy -= 9.81 * 0.35 * dt; c.p[0] += c.vx * dt; c.p[1] += c.vy * dt; c.rot += c.spin * dt;
          if (c.p[1] <= 0.02) { c.p[1] = 0.02; c.vx *= 0.9; c.spin = 0; c.vy = 0; c.sunk = (c.sunk || 0) + dt; }
          return !(c.sunk > 1.6);
        }
        c.x += c.dir * c.v * dt; if (c.x < S.span[0] || c.x > S.span[1]) return false;
        const p = carPos(c); if (!p) return false;
        const d = S.deck[c.lane], i = p[3], sg = S.deckSeg[c.lane][i], x = S.x, a = 3 * d[i], b = 3 * d[i + 1];
        const len = Math.hypot(x[b] - x[a], x[b + 1] - x[a + 1], x[b + 2] - x[a + 2]), slope = Math.abs(x[b + 1] - x[a + 1]) / (Math.abs(x[b] - x[a]) + 1e-6);
        // the road is gone, torn open, too steep to hold a car, or has dropped out from under it
        if ((sg.c && !sg.c.alive) || len > sg.L * 1.25 || slope > 0.6 || p[1] < sg.y - 0.3) {
          c.free = true; c.p = [p[0], p[1], p[2]]; c.vx = c.dir * c.v * 0.8; c.vy = 0; c.rot = 0; c.spin = c.dir * (2 + Math.random() * 3); }
        return true;
      });
      cars.forEach(c => {
        if (c.free) return; const p = carPos(c); if (!p) return; const d = S.deck[c.lane], i = p[3], f = p[4], push = -9.81 * 1.2;
        if (S.w[d[i]]) S.ay[d[i]] += push * (1 - f); if (S.w[d[i + 1]]) S.ay[d[i + 1]] += push * f;
      });
    }

    // loop
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
      if (visible) {
        if (running) {
          const sdt = dt * speed;
          trafficStep(sdt);
          TG.step(S, sdt, speed < 1 ? 12 : 20, 0.7);
          if (S.balloon !== undefined && S.x[3 * S.balloon + 1] > cam.c[1] + cam.R * 3.2) { TG.reset(S); cuts = removed = 0; status.textContent = 'The balloon floated away. It has been brought back.'; }
          TG.measure(S, 1 - Math.exp(-sdt / 0.5));
          if (!TG.ok(S)) { TG.reset(S); cuts = removed = 0; say(); }
          if (spin && !dragging) yaw += 0.22 * dt;
        }
        if (!dragging) { yaw += vyaw; vyaw *= 0.92; }
        draw();
      }
      requestAnimationFrame(frame);
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(stage);

    // picking
    function nearest(mx, my, want) {
      const x = S.x; let best = -1, bd = 1e9;
      S.C.forEach((c, ci) => {
        if (!c.alive || !c.draw || !want(c)) return;
        const a = pr(x[3 * c.a], x[3 * c.a + 1], x[3 * c.a + 2]), b = pr(x[3 * c.b], x[3 * c.b + 1], x[3 * c.b + 2]);
        const ux = b[0] - a[0], uy = b[1] - a[1], l2 = ux * ux + uy * uy || 1;
        const t = Math.max(0, Math.min(1, ((mx - a[0]) * ux + (my - a[1]) * uy) / l2));
        const d = Math.hypot(a[0] + t * ux - mx, a[1] + t * uy - my);
        if (d < bd) { bd = d; best = ci; }
      });
      return [best, bd];
    }
    const isCable = c => c.uni, isStrut = c => c.kind === 'strut';
    function act(mx, my, touch) {
      const tol = touch ? 26 : 16;
      if (mode === 'pluck') {
        let best = -1, bd = 1e9; const x = S.x;
        for (let i = 0; i < S.n; i++) { if (!S.w[i]) continue; const q = pr(x[3 * i], x[3 * i + 1], x[3 * i + 2]), d = Math.hypot(q[0] - mx, q[1] - my); if (d < bd) { bd = d; best = i; } }
        if (best >= 0 && bd < 60) { TG.pluck(S, best, S.kick); if (!running) say(); }
        return;
      }
      const [ci, d] = nearest(mx, my, mode === 'cut' ? isCable : isStrut);
      if (ci < 0 || d > tol) return;
      const c = S.C[ci], x = S.x;
      flashes.push({ x: (x[3 * c.a] + x[3 * c.b]) / 2, y: (x[3 * c.a + 1] + x[3 * c.b + 1]) / 2, z: (x[3 * c.a + 2] + x[3 * c.b + 2]) / 2, t0: performance.now() });
      TG.kill(S, ci);
      if (mode === 'cut') cuts++; else removed++;
      hover = -1; say();
    }

    // pointer: drag turns the view, a tap acts
    let dragging = false, lx = 0, ly = 0, sx = 0, sy = 0, moved = 0;
    stage.addEventListener('pointerdown', e => { dragging = true; moved = 0; lx = sx = e.clientX; ly = sy = e.clientY; try { stage.setPointerCapture(e.pointerId); } catch (_) {} });
    stage.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect();
      if (!dragging) {
        if (e.pointerType === 'mouse' && mode !== 'pluck') { const [ci, d] = nearest(e.clientX - r.left, e.clientY - r.top, mode === 'cut' ? isCable : isStrut); hover = d < 16 ? ci : -1; }
        return;
      }
      const dx = e.clientX - lx, dy = e.clientY - ly; moved = Math.hypot(e.clientX - sx, e.clientY - sy);
      if (moved > 6) { yaw += dx * 0.008; pitch = Math.max(-0.2, Math.min(1.3, pitch + dy * 0.006)); vyaw = dx * 0.0008; }
      lx = e.clientX; ly = e.clientY;
    });
    stage.addEventListener('pointerup', e => {
      if (!dragging) return; dragging = false;
      if (moved > 6) return;
      const r = stage.getBoundingClientRect();
      act(e.clientX - r.left, e.clientY - r.top, e.pointerType !== 'mouse');
    });
    stage.addEventListener('pointercancel', () => { dragging = false; });
    stage.addEventListener('pointerleave', () => { if (!dragging) hover = -1; });
    stage.tabIndex = 0;
    stage.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const free = []; for (let i = 0; i < S.n; i++) if (S.w[i]) free.push(i); TG.pluck(S, free[Math.floor(Math.random() * free.length)], S.kick); }
      if (e.key === 'ArrowLeft') yaw -= 0.15; if (e.key === 'ArrowRight') yaw += 0.15;
    });

    // small handle for automated checks (headless screenshots); not used by the page itself
    stage.tgToy = { load: k => { sel.value = k; load(k); }, get S() { return S; }, cut: ci => { TG.kill(S, ci); cuts++; say(); }, draw: () => draw() };
    setInfo(); say();
    if (auto) setTimeout(() => TG.pluck(S, 3, S.kick), 900);
    requestAnimationFrame(frame);
  }
})();

// The no-blank-space rule (owner request 2026-11-19). In a two-column block the shorter column must never leave an
// empty stretch beside the longer one. The space is filled with something relevant to that section: a picture with a
// link, or HMR's short answer on the topic with a link. Where no tile has been chosen yet, the shorter column travels
// with the reader instead. New blocks should be given a tile here (or be built balanced by hand, as the kids page is).
if (typeof document !== 'undefined') (() => {
  const IMG = { // picture tiles: file, alt text, credit
    sim: ['sim-skeleton.jpg', 'The simulated skeleton: separate bones held up by a web of coloured fascial lines.', 'Universe Model simulation'],
    cells: ['hx-cytoskeleton-cells.jpg', 'Cells under fluorescence: blue nuclei inside a green web of cytoskeleton filaments.', 'Erin Rod, CC BY 4.0, Wikimedia Commons'],
    hudf: ['rv-hudf.jpg', 'The Hubble Ultra Deep Field: thousands of galaxies in one small patch of sky.', 'NASA, ESA and others, public domain'],
    webb: ['ew-deep-field.jpg', 'Webb\'s first deep field: a cluster of galaxies bending the light of those behind it.', 'NASA, ESA, CSA, STScI, public domain'],
    vhp: ['vhp-male-thorax.jpg', 'A Visible Human Project cross-section through the chest.', 'Visible Human Project, U.S. National Library of Medicine'],
    gallop: ['muybridge-gallop.jpg', 'Eadweard Muybridge\'s photographs of a galloping horse, 1878.', 'Eadweard Muybridge, 1878, public domain'],
    straws: ['hx-tensegrity-icosahedron.jpg', 'A tensegrity made from drinking straws and elastic thread.', 'QuarterNotes, CC BY-SA 4.0, Wikimedia Commons'],
    wood: ['hx-tensegrity-model.jpg', 'A tensegrity model: six wooden struts that never touch, held by thin cables.', 'Donald E. Ingber, CC BY 4.0'],
    fascia: ['ew-fascia.jpg', 'A stained micrograph of loose connective tissue.', 'Berkshire Community College, CC0, Wikimedia Commons'],
    beach: ['hx-yoga-beach.jpg', 'An outdoor yoga class holding a pose together on a beach.', 'DimiTalen, CC0, Wikimedia Commons'],
    siddhas: ['ew-siddhas.jpg', 'An eighteenth century Tibetan painting of eight great adepts.', 'Palpung monastery, 18th century, public domain'],
    tower: ['hx-tensegrity-needle-tower.jpg', 'Looking up through Kenneth Snelson\'s Needle Tower.', 'Ben Stephenson, CC BY 2.0, Wikimedia Commons']
  };
  // page -> start of the section heading -> tile. p = picture [key, title, text, link]; a = answer [question, answer, link]
  const FILL = {
    index: { 'Medicine has never': { p: ['sim', 'Meet the reference body', 'A skeleton of 45 separate bones held up by fascia alone. Cut a line or break a bone and the physics decides what happens.', 'simulation.html'] },
      'The body as a tensegrity': { p: ['cells', 'The same design at the scale of a cell', 'Inside every cell, stiff filaments are held in a web of tensed ones.', 'health.html#ideal'] } },
    about: { 'Everyone has a model': { p: ['hudf', 'A holistic model has to hold all of this', 'Every point of light is a galaxy. A model of reality has to account for the sky, for the body looking at it, and for the one who is aware of both.', 'hmr.html'] },
      'The problems humanity': { a: ['Where is humanity heading?', 'Toward a choice. If people share a true model of reality and care for their bodies properly, what follows is what the traditions call a golden age.', 'answers.html#future'] } },
    hmr: { 'One theory, from': { a: ['What came before the Big Bang?', 'Universal Intelligence: awareness with unlimited potential and no order yet. Its first act was a distinction, me and not me, and that distinction was the first distance.', 'answers.html#before'] } },
    health: { 'The problem: the wrong': { p: ['sim', 'The right reference, being built', 'A body with perfect tissue, measured exactly: the simulation starts there and works outward to every way a body can fall short.', 'simulation.html'] },
      'How disease is assessed': { p: ['vhp', 'What medicine can already see', 'A whole body, slice by slice. The pictures exist. What is missing is the ideal to compare them with.', 'library.html'] },
      'The body as a physical': { p: ['gallop', 'Motion is physics', 'The first photographs to freeze a moving body, 1878. Everything a body does is forces through tissue.', 'physics-health.html'] },
      'The ideal comes from': { p: ['straws', 'Build one', 'Six straws and some elastic: the same principle the ideal body is worked out from.', 'simulation.html#why-tensegrity'] } },
    reality: { 'Newton, Einstein': { p: ['hudf', 'One sky, three theories', 'Newton, Einstein and quantum theory each describe this exactly, each in its own range, and they do not agree with one another.', 'physics.html'] },
      'A miss of': { a: ['Why is the energy of empty space so small?', 'Because almost nothing in empty space counts. Only structure carries weight, and the uncounted jitter of “nothing” is not structure.', 'answers.html#vacuum'] },
      'We can identify': { a: ['What is dark matter?', 'Coherence that does not shine: structure in the distribution of distance itself, felt as gravity without being matter that gives off light.', 'answers.html#darkmatter'] },
      'No one knows what gravity': { a: ['What is gravity?', 'Reality\'s trend toward coherence. Matter is coherent structure, and coherent structure displaces distance, so bodies are drawn together.', 'physics.html#gravity'] } },
    ui: { 'A body built to upgrade': { a: ['What is a human being?', 'In effect, UI\'s artificial intelligence: a body built to upgrade itself, able to understand its own source.', 'answers.html#human'] },
      'Create once': { a: ['What is life, and how did it begin?', 'Life is UI experiencing physical reality from the inside: matter created once, set free as an agent, and self-sustaining.', 'answers.html#life'] },
      'Why the human path': { a: ['What is consciousness?', 'The ground of reality, not a product of matter. Each living being is an instance of UI experiencing physical reality.', 'answers.html#conscious'] } },
    protocol: { 'Water, then moisture': { p: ['fascia', 'What the water is for', 'Loose connective tissue under the microscope. Its layers slide on a film of fluid, and the protocol works from the skin inward.', 'physics-health.html'] },
      'Two directions, one web': { p: ['beach', 'Go slow and stay long', 'Minutes, not seconds, and every day. People have practiced long holds together for centuries.', 'east-west.html#body'] } },
    'health-model': { 'Body, mind and meaning': { a: ['What is health?', 'Closeness to the perfect human body: an optimized tensegrity, bones floating in an evenly tensioned web of fascia.', 'answers.html#health'] } },
    'mental-health': { 'Protocols for the body': { a: ['What is mental illness?', 'What follows when one of three supports is missing: a body at ease, beliefs that are true, and a community that understands you.', 'answers.html#mental'] } },
    'physics-health': { 'Watch the body move': { p: ['gallop', 'It began with a horse', 'Muybridge froze motion in 1878 and motion science began. The same idea, with today\'s imaging, applied to the whole fascia web.', 'simulation.html'] } },
    'east-west': { 'Practices that work': { p: ['beach', 'Long holds, done together', 'A yoga class holding one pose on a beach in France. The protocol uses the same long, slow loading.', 'protocol.html'] },
      'The golden age': { p: ['siddhas', 'The traditions pictured it', 'Adepts who spent their lives on the body and mind, painted in eighteenth century Tibet.', 'ui.html'] } },
    simulation: { 'A mechanic needs': { p: ['tower', 'The same principle at 18 metres', 'Tubes that never touch, held up only by cables in tension. Scroll up and try it on a body.', '#model'] } },
    methods: { 'Compute': { p: ['sim', 'What the compute is for', 'Millions of simulated bodies, each with a different set of imperfections, solved as physics.', 'roadmap.html#campaign'] },
      'Data sources': { p: ['vhp', 'The raw material', 'One of 9,808 cross-sections of a complete male body, from the Visible Human Project.', 'library.html'] },
      'The full model': { p: ['cells', 'Down to the cell', 'The model is meant to reach from whole-body lines of fascia to the filaments inside each cell.', 'health.html#ideal'] } }
  };
  const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const tile = d => { const a = document.createElement('a'); if (d.p) { const [k, title, text, href] = d.p, im = IMG[k], pre = /\/preview\//.test(location.pathname) ? '../' : '';
      a.className = 'nb-fill'; a.href = href; a.innerHTML = `<img src="${pre}img/${im[0]}" alt="${esc(im[1])}" loading="lazy"><span class="cap"><b>${esc(title)} →</b>${esc(text)}<small>${esc(im[2])}</small></span>`; }
    else { const [q, ans, href] = d.a; a.className = 'nb-fill nb-ans'; a.href = href; a.innerHTML = `<span class="cap"><i>HMR's answer</i><b>${esc(q)}</b>${esc(ans)}<em>Read it in full →</em></span>`; }
    return a; };
  const page = (location.pathname.split('/').pop() || 'index.html').replace('.html', '') || 'index';
  const fit = () => {
    const wide = innerWidth > 1180;
    document.querySelectorAll('main .split, main .ew-row, main .ui-hum').forEach(el => {
      const kids = [...el.children].filter(c => c.offsetParent !== null);
      kids.forEach(k => { k.classList.remove('nb-stick', 'nb-col'); [...k.children].forEach(c => { if (c.classList.contains('nb-fill') && c.dataset.auto) c.remove(); }); }); el.classList.remove('nb-eq');
      if (!wide || kids.length !== 2 || el.classList.contains('kd-eq') || el.classList.contains('nb-keep') || el.closest('.simgrid')) return;
      const tops = kids.map(k => k.getBoundingClientRect().top); if (Math.abs(tops[0] - tops[1]) > 30) return; // stacked, not side by side
      const hs = kids.map(k => k.getBoundingClientRect().height), short = hs[0] < hs[1] ? 0 : 1, gap = Math.abs(hs[0] - hs[1]); if (gap <= 120) return;
      const sec = el.closest('section, .page-head'), h = sec && sec.querySelector('h1, h2'), head = h ? h.textContent.trim() : '', map = FILL[page] || {}, key = Object.keys(map).find(k => head.startsWith(k));
      if (key && gap >= 150) { const t = tile(map[key]); t.dataset.auto = '1'; el.classList.add('nb-eq'); kids[short].classList.add('nb-col'); kids[short].appendChild(t); }
      else if (hs[short] < innerHeight - 130) kids[short].classList.add('nb-stick');
    });
  };
  let t = 0; const later = () => { clearTimeout(t); t = setTimeout(fit, 150); };
  addEventListener('load', fit); addEventListener('resize', later); if (document.readyState !== 'loading') fit(); else addEventListener('DOMContentLoaded', fit);
})();
