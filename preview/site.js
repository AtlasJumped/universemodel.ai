// Universe Model: mobile menu, nav dropdowns, and the tensegrity physics toy (every canvas#tg inside a .stage).
// The toy is a real simulation (extended position based dynamics): node masses, gravity, a ground with friction,
// rigid struts, and cables that pull but never push. Cutting or removing a member changes the structure and the
// physics alone decides what happens next. Nothing is animated by hand.

/* ---------- menu and dropdown groups ---------- */
(() => {
  if (typeof document === 'undefined') return;
  const btn = document.querySelector('.menu'), nav = document.querySelector('.nav');
  // the small-screen menu: one scrolling panel with every page in it; the page behind does not scroll while it is open
  const setMenu = o => { nav.classList.toggle('open', o); btn.setAttribute('aria-expanded', o); document.documentElement.classList.toggle('menu-open', o); if (o) nav.scrollTop = 0; };
  if (btn && nav) {
    btn.addEventListener('click', e => { e.stopPropagation(); setMenu(!nav.classList.contains('open')); });
    nav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('click', e => { if (nav.classList.contains('open') && !e.target.closest('.nav')) setMenu(false); });
    addEventListener('resize', () => { if (innerWidth > 1180 && nav.classList.contains('open')) setMenu(false); });
    addEventListener('pageshow', () => setMenu(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); btn.focus(); } });
  }
  const grps = [...document.querySelectorAll('.nav .grp')];
  const closeAll = except => grps.forEach(g => { if (g !== except) { g.classList.remove('open'); const b = g.querySelector('.grpbtn'); if (b) b.setAttribute('aria-expanded', 'false'); } });
  grps.forEach(g => {
    const b = g.querySelector('.grpbtn'); if (!b) return;
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', () => { if (innerWidth <= 1180) return; const o = !g.classList.contains('open'); closeAll(g); g.classList.toggle('open', o); b.setAttribute('aria-expanded', o); });
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
    const b = builder(), houses = [], people = [], grips = [];
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
      // a resident stands on the floor, held by their footing
      const P = person(b, tx, hy, tz, 0.64, 'hp' + ti, false, true, { m: 0.4 }); people.push(P);
      grips.push({ cs: footing(b, P, fl), pairs: [[fl[0], fl[1]], [fl[1], fl[2]]], max: 0.6 });
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
    return { b, ea: 900, strain: 0.004, iters: 4, kick: 1.6, view: [0.45, 0.3], thin: 0.6, people, grips,
      info: 'A neighbourhood of treehouses. The trees are in compression. Each house hangs from its branches by four ropes in tension, and rope bridges in tension tie the houses together. Cut a rope and a house tilts; take out a tree and its house hangs on its neighbours. Someone lives in each house. If what holds a house gives way, they fall.' };
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
    // Each edge is its own strut (no shared group, so breaking one does not break the rest). Only the six face diagonals brace the
    // box: with them it is just rigid, so a broken edge leaves a loose corner and nothing more.
    edges.forEach(([p, q]) => b.add(p, q, 'strut'));
    [[0, 2], [4, 6], [0, 5], [1, 6], [2, 7], [3, 4]].forEach(([p, q]) => b.add(bk[p], bk[q], 'brace'));
    // two small people stand in the basket
    const people = [-0.035, 0.035].map((z, i) => person(b, 0, yb - 0.08, z, 0.3, 'bp' + i, false, true, { m: 0.06 }));
    const grips = people.map(P => ({ cs: footing(b, P, bk.slice(4)), pairs: [[bk[4], bk[5]], [bk[4], bk[7]]], max: 0.6 }));
    // suspension cables from the mouth of the envelope to the basket
    for (let c = 0; c < 4; c++) { const j = Math.round(c * m / 4 + 1) % m; b.add(rings[4][j], bk[c], 'cable'); b.add(rings[4][(j + 2) % m], bk[(c + 1) % 4], 'cable'); }
    // tethers to two stakes in the ground
    const s1 = b.node(-0.5, 0, 0, 0.1, true), s2 = b.node(0.5, 0, 0, 0.1, true);
    b.add(s1, bk[4], 'cable', { strain: 0.01 }); b.add(s2, bk[5], 'cable', { strain: 0.01 });
    // buoyancy: the hot air lifts the envelope with 1.5 times the weight of everything
    const Mtot = env.length * 0.01 + 0.02 + 8 * 0.1 + 2 * 3.9 * 0.06, lift = 1.5 * Mtot * 9.81 / (env.length * 0.01);
    env.forEach(i => b.lift(i, lift));
    return { b, ea: 400, eaFabric: 200, strain: 0.02, strainFabric: 0.005, kb: 300, iters: 3, kick: 0.6, view: [0.5, 0.25], balloon: cen, people, grips,
      info: 'Hot air pushes up on the envelope; the fabric and the cables are in tension, carrying the basket. Two small people ride in the basket. Two tethers hold it down. Cut a tether and it drifts; break one strut of the basket and only that corner gives way.' };
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
    nd('nape', 0, 1.0, -.105, .02); // the back of the skull, behind the pivot, where the neck's extensors attach
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
    b.body(['occ', 'top', 'brow', 'chin', 'earL', 'earR', 'nape'].map(n), [P('occ', 'top'), P('top', 'brow'), P('brow', 'chin'), P('chin', 'occ'), P('earL', 'top'), P('earR', 'top'), P('earL', 'chin'), P('earR', 'chin'), P('top', 'nape'), P('nape', 'occ')], 'head');
    // fascia: cables across every joint, front, back, sides and spirals
    const cab = (a, c) => b.add(n(a), n(c), 'cable');
    ['L', 'R'].forEach(q => {
      cab('heel' + q, 'cb' + q); cab('toe' + q, 'tf' + q); cab('fl' + q, 'ls' + q); cab('fm' + q, 'ms' + q);
      cab('cb' + q, 'tb' + q); cab('tf' + q, 'tq' + q); cab('ls' + q, 'tl' + q); cab('ms' + q, 'tm' + q);
      cab('tb' + q, 'isch' + q); cab('tq' + q, 'asis' + q); cab('tl' + q, 'crest' + q); cab('tm' + q, 'pub'); cab('tl' + q, 'sac');
      cab('l3', 'tm' + q); cab('crest' + q, 'l3'); cab('crest' + q, 'rib' + q); cab('sac', 'sc' + q); cab('isch' + q, 't12');
      cab('ac' + q, 'ear' + q); cab('sc' + q, 'occ'); cab('el' + q, 'rib' + q); cab('el' + q, 'sc' + q); cab('wr' + q, 'ac' + q);
    });
    cab('nape', 't6'); cab('nape', 'scL'); cab('nape', 'scR'); // the nuchal line: holds the head up against its own forward weight
    cab('pub', 'xi'); cab('asisL', 'ribR'); cab('asisR', 'ribL'); cab('st', 'chin'); cab('l3', 'scL'); cab('l3', 'scR'); cab('crestL', 'scL'); cab('crestR', 'scR'); cab('scL', 'earL'); cab('scR', 'earR'); cab('asisL', 'xi'); cab('asisR', 'xi');
    return { b, ea: 3000, strain: 0.0005, kb: 8000, iters: 6, kick: 0.9, view: [0.3, 0.1], thin: 0.55, head: ['occ', 'top', 'brow', 'chin', 'earL', 'earR', 'nape'].map(n),
      info: 'A simplified human tensegrity: the bones are struts, and the fascia is a web of cables in tension crossing every joint, front, back and sides. Nothing holds it upright but tension.' };
  }


  /* ----- a life on the line: five scenes with someone in them. The people are rigid stick figures. Someone standing on
     a deck is held to it by their footing, and the footing lets go when the deck tilts past about 37 degrees. ----- */
  // turn = true puts the figure's left-right axis along z (so it faces along x). o.stance: half the gap between the feet. o.hands: [out, up, forward].
  function person(b, x, y, z, s, grp, pin, turn, o) {
    o = o || {}; const st = o.stance === undefined ? 0.09 : o.stance, hd = o.hands || [0.22, 0.52, 0.05], mk = o.m || 1;
    const nd = (dl, dy, df, m, p) => turn ? b.node(x + df * s, y + dy * s, z + dl * s, m * mk, p) : b.node(x + dl * s, y + dy * s, z + df * s, m * mk, p);
    const fL = nd(-st, 0, 0, 0.5, pin), fR = nd(st, 0, 0, 0.5, pin), hip = nd(0, 0.48, 0, 1.2), neck = nd(0, 0.8, 0, 0.8), head = nd(0, 0.93, 0, 0.5), hL = nd(-hd[0], hd[1], hd[2], 0.2), hR = nd(hd[0], hd[1], hd[2], 0.2);
    const c0 = b.C.length, all = [fL, fR, hip, neck, head, hL, hR];
    if (pin) all.push(nd(0, 0, 0.16, 0.5, true));
    b.body(all, [[fL, hip], [fR, hip], [hip, neck], [neck, head], [neck, hL], [neck, hR]], grp);
    for (let i = c0; i < b.C.length; i++) if (b.C[i].kind === 'strut') { b.C[i].col = '#D9661F'; b.C[i].thin = 0.62; }
    return { fL, fR, hip, neck, head, hL, hR, grp, strut: c0, y0: y + 0.93 * s };
  }
  // footing: hidden rigid ties from both feet and the hips to what the person stands on. Returns the tie indexes.
  function footing(b, P, deck) { const cs = []; [P.fL, P.fR, P.hip].forEach(i => deck.forEach(d => cs.push(b.add(i, d, 'brace')))); return cs; }
  const spikes = (b, x0, x1, z, n) => { for (let k = 0; k < n; k++) { const x = x0 + (x1 - x0) * k / (n - 1), a = b.node(x - 0.07, 0, z, 1, true), c = b.node(x + 0.07, 0, z, 1, true), tip = b.node(x, 0.3, z, 1, true); const i = b.add(a, tip, 'strut'), j = b.add(c, tip, 'strut'); b.C[i].col = b.C[j].col = '#B4232F'; b.C[i].thin = b.C[j].thin = 0.45; } };
  const sagRope = (b, p, q, n, sag, m) => { const P0 = b.P[p], P1 = b.P[q], ids = [p]; for (let k = 1; k < n; k++) { const u = k / n; ids.push(b.node(P0[0] + (P1[0] - P0[0]) * u, P0[1] + (P1[1] - P0[1]) * u - sag * 4 * u * (1 - u), P0[2] + (P1[2] - P0[2]) * u, m)); } ids.push(q);
    for (let k = 0; k < n; k++) b.add(ids[k], ids[k + 1], 'cable', { strain: 0 }); return ids; };

  function piano() {
    const b = builder(), H = 3.4, X = 1.3;
    const baseL = b.node(-X, 0, 0, 1, true), baseR = b.node(X, 0, 0, 1, true), topL = b.node(-X, H, 0, 0.6), topR = b.node(X, H, 0, 0.6), hkL = b.node(-0.45, H, 0, 0.3), hkR = b.node(0.45, H, 0, 0.3), apex = b.node(0, H + 0.55, 0, 0.3);
    b.add(baseL, topL, 'strut'); b.add(baseR, topR, 'strut');
    b.body([topL, topR, hkL, hkR, apex], [[topL, hkL], [hkL, hkR], [hkR, topR], [topL, apex], [apex, topR], [apex, hkL], [apex, hkR]]);
    [[topL, -1], [topR, 1]].forEach(([tp, s]) => [[s * (X + 1.5), 0], [s * X, 1.8], [s * X, -1.8]].forEach(([ax, az]) => b.add(tp, b.node(ax, 0, az, 1, true), 'cable')));
    // the piano: one rigid box
    const bx = [], w = 0.45, d = 0.22, y0 = 2.25, y1 = 2.75;
    [y0, y1].forEach(y => [-w, w].forEach(x => [-d, d].forEach(z => bx.push(b.node(x, y, z, 3)))));
    const keel = b.node(0, y0, 0, 1), eyeL = b.node(-w, y1, 0, 0.5), eyeR = b.node(w, y1, 0, 0.5), E = (i, j) => [bx[i], bx[j]];
    b.body([...bx, keel, eyeL, eyeR], [E(0, 1), E(2, 3), E(0, 2), E(1, 3), E(4, 5), E(6, 7), E(4, 6), E(5, 7), E(0, 4), E(1, 5), E(2, 6), E(3, 7)], 'piano');
    b.add(hkL, eyeL, 'cable'); b.add(hkR, eyeR, 'cable');
    const P = person(b, 0, 0, 0, 1.7, 'p0', true);
    return { b, ea: 5000, strain: 0.002, iters: 4, kick: 1.2, view: [0.5, 0.16], thin: 0.7, people: [P], crush: { by: [keel, bx[0], bx[1], bx[2], bx[3]], r: 0.3 },
      info: 'A piano hangs from a gantry by two ropes, and someone is standing under it. The posts are in compression and stand only because six guy lines hold them. Cut a rope, or a guy line, and the physics decides where the piano goes.' };
  }

  function gorge() {
    const b = builder(), Hh = 2.4, half = 2.2, w = 0.3, n = 8, k = 4, s = 0.95;
    const side = q => [-w, w].map(z => { const top = b.node(q * half, Hh, z, 1, true), rail = b.node(q * half, Hh + 0.5, z, 1, true), foot = b.node(q * (half + 0.3), 0, z, 1, true); b.add(foot, top, 'strut'); b.add(top, rail, 'strut'); return { top, rail }; });
    const A = side(-1), B = side(1);
    const d1 = sagRope(b, A[0].top, B[0].top, n, 0.32, 0.3), d2 = sagRope(b, A[1].top, B[1].top, n, 0.32, 0.3);
    for (let i = 1; i < n; i++) b.add(d1[i], d2[i], 'strut');
    const h1 = sagRope(b, A[0].rail, B[0].rail, n, 0.3, 0.1), h2 = sagRope(b, A[1].rail, B[1].rail, n, 0.3, 0.1);
    // short hangers tie each handrail down to the deck. At the walker's plank the walker is the tie: feet on the plank, a hand on each rail.
    for (let i = 1; i < n; i++) if (i !== k) { b.add(h1[i], d1[i], 'cable', { strain: 0 }); b.add(h2[i], d2[i], 'cable', { strain: 0 }); }
    const p = b.P[d1[k]], up = (b.P[h1[k]][1] - p[1]) / s, P = person(b, p[0], p[1], 0, s, 'p0', false, true, { hands: [w / s, up, 0] });
    const cs = footing(b, P, [d1[k], d2[k]]); [[P.hL, h1[k]], [P.hR, h2[k]], [P.hip, h1[k]], [P.hip, h2[k]]].forEach(([i, r]) => cs.push(b.add(i, r, 'brace')));
    spikes(b, -1.2, 1.2, 0, 7);
    return { b, ea: 2500, strain: 0.004, iters: 4, kick: 1.4, view: [0.42, 0.2], thin: 0.6, people: [P], grips: [{ cs, pairs: [[d1[k], d2[k]], [d1[k - 1], d1[k + 1]], [d2[k - 1], d2[k + 1]]], max: 0.6 }],
      info: 'A rope bridge over a gorge, with someone halfway across, feet on a plank and a hand on each rail. Two ropes carry the planks and two more are the handrails, tied down to the deck by short hangers. Everything is in tension between the two cliffs. One cut rope can be survived, because the others take the load. Try two.' };
  }

  function highSwing() {
    const b = builder(), H = 3.2, zf = 0.7;
    const apex = [zf, -zf].map(z => { const a = b.node(0, H, z, 0.5); [-1.15, 1.15].forEach(x => b.add(b.node(x, 0, z, 1, true), a, 'strut')); b.add(a, b.node(0, 0, z + Math.sign(z) * 1.7, 1, true), 'cable'); return a; });
    b.add(apex[0], apex[1], 'strut');
    const sy = 1.65, sz = 0.36, sx = 0.13, c = [[-sx, sz], [sx, sz], [-sx, -sz], [sx, -sz]].map(([x, z]) => b.node(x, sy, z, 0.4)), eA = b.node(0, sy, sz, 0.2), eB = b.node(0, sy, -sz, 0.2);
    b.body([...c, eA, eB], [[c[0], c[1]], [c[2], c[3]], [c[0], c[2]], [c[1], c[3]]], 'seat');
    // a bridle of two ropes to each end of the seat, so the seat cannot roll over under the rider
    b.add(apex[0], c[0], 'cable'); b.add(apex[0], c[1], 'cable'); b.add(apex[1], c[2], 'cable'); b.add(apex[1], c[3], 'cable');
    const P = person(b, 0, sy, 0, 0.95, 'p0', false, true), grips = [{ cs: footing(b, P, c), pairs: [[eA, eB], [c[0], c[1]]], max: 0.6 }];
    spikes(b, -0.9, 0.9, 0, 6);
    return { b, ea: 3000, strain: 0.003, iters: 4, kick: 2.2, view: [0.9, 0.18], thin: 0.65, people: [P], grips,
      info: 'Someone is standing on a swing, well above the ground. Two A-frames in compression carry a top bar, two guy lines keep the frames from folding flat, and four ropes hold the seat, two to each end. Pluck the seat to set it swinging. Cut a rope and the seat tips. Cut a guy line and the whole frame goes.' };
  }

  function cleaners() {
    const b = builder(), H = 4.2, zf = 1.0, xa = 0.62, xb = 1.18, col = [[-0.2, zf], [-0.2, -zf], [-1.3, zf], [-1.3, -zf]];
    const base = col.map(([x, z]) => b.node(x, 0, z, 1, true)), top = col.map(([x, z]) => b.node(x, H, z, 1)), o1 = [zf, -zf].map(z => b.node(xa, H, z, 0.4)), o2 = [zf, -zf].map(z => b.node(xb, H, z, 0.4));
    b.body([...base, ...top, ...o1, ...o2], [[base[0], top[0]], [base[1], top[1]], [base[2], top[2]], [base[3], top[3]], [top[0], top[1]], [top[2], top[3]], [top[0], top[2]], [top[1], top[3]], [top[0], o1[0]], [o1[0], o2[0]], [top[1], o1[1]], [o1[1], o2[1]], [base[0], base[1]]], 'building');
    const py = 2.5, c = [[xa, zf], [xb, zf], [xa, -zf], [xb, -zf]].map(([x, z]) => b.node(x, py, z, 0.6)), eA = b.node(0.9, py, zf, 0.2), eB = b.node(0.9, py, -zf, 0.2);
    b.body([...c, eA, eB], [[c[0], c[1]], [c[2], c[3]], [c[0], c[2]], [c[1], c[3]]], 'platform');
    b.add(o1[0], c[0], 'cable'); b.add(o2[0], c[1], 'cable'); b.add(o1[1], c[2], 'cable'); b.add(o2[1], c[3], 'cable');
    const people = [0.45, -0.45].map((z, i) => person(b, 0.9, py, z, 0.95, 'p' + i, false, true));
    const grips = people.map(P => ({ cs: footing(b, P, c), pairs: [[eA, eB], [c[0], c[1]]], max: 0.6 }));
    // one of the two is clipped to a safety line, which hangs slack until it is needed
    b.add(people[1].neck, o2[1], 'cable', { strain: -0.12 });
    return { b, ea: 3500, strain: 0.003, iters: 4, kick: 1.6, view: [0.95, 0.2], thin: 0.65, people, grips,
      info: 'Two window cleaners on a platform, four storeys up. The building and its roof beams are in compression. The platform hangs from the beams by four ropes, one at each corner. One cleaner is clipped to a safety line, the dashed one, which hangs slack until it is needed. The other is not. Cut ropes and see what a second line of support is worth.' };
  }

  function tightrope() {
    const b = builder(), X = 2.3, H = 2.7, n = 10, k = 5, s = 0.95;
    const top = [-1, 1].map(q => { const tp = b.node(q * X, H, 0, 0.6); b.add(b.node(q * X, 0, 0, 1, true), tp, 'strut'); [-1, 1].forEach(u => b.add(tp, b.node(q * (X + 1.6), 0, u * 1.0, 1, true), 'cable')); return tp; });
    const r = sagRope(b, top[0], top[1], n, 0.12, 0.06), at = b.P[r[k]], x = at[0], y = at[1];
    const P = person(b, x, y, 0, s, 'p0', false, true, { stance: 0.02, m: 0.5 }), poleL = b.node(x, y - 0.55, -1.35, 1.6), poleR = b.node(x, y - 0.55, 1.35, 1.6), c0 = b.C.length;
    b.body([P.fL, P.fR, P.hip, P.neck, P.head, P.hL, P.hR, poleL, poleR], [[P.hL, poleL], [P.hR, poleR], [P.hL, P.hR]], 'p0');
    for (let i = c0; i < b.C.length; i++) if (b.C[i].kind === 'strut') { b.C[i].col = '#8A5A0B'; b.C[i].thin = 0.4; }
    spikes(b, -1.4, 1.4, 0, 8);
    // the walker touches the rope at one point only, and stays upright because the heavy drooping pole puts the centre of mass below it
    return { b, ea: 60000, strain: 0.002, iters: 10, kick: 1.2, view: [0.3, 0.18], thin: 0.65, people: [P], grips: [{ cs: footing(b, P, [r[k]]), pairs: [[r[k - 1], r[k + 1]]], max: 0.6 }],
      info: 'A tightrope walker between two masts. Each mast is in compression and leans on two guy lines. The rope is in tension. The walker touches it at one point only, and stays upright because the long drooping pole puts the centre of their weight below the rope. Cut a guy line and a mast goes over, and the rope sinks toward the spikes. Cut the rope and there is nothing else.' };
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
    ['piano', 'Under a hanging piano', piano, 'A life on the line'],
    ['gorge', 'Crossing a rope bridge', gorge, 'A life on the line'],
    ['highswing', 'Standing on a high swing', highSwing, 'A life on the line'],
    ['cleaners', 'Window cleaners', cleaners, 'A life on the line'],
    ['tightrope', 'The tightrope walker', tightrope, 'A life on the line'],
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
      c.Lg = L; c.L0 = L * (1 - strain);
      const ea = c.kind === 'fabric' ? (sh.eaFabric || sh.ea) : sh.ea;
      c.comp = tens ? c.L0 / ea : c.kind === 'bend' ? 1 / (sh.kb || 200) : 0;
      c.uni = tens; c.draw = c.kind !== 'brace' && c.kind !== 'bend'; c.alive = true; c.T = 0; c.Tema = 0;
    });
    const ay0 = new Float64Array(cap); ay0.set(sh.b.A);
    const S = { ash: [], fire: null, iters: sh.iters || 1, key: row[0], name: row[1], info: sh.info, view: sh.view, kick: sh.kick, n, n0: n, cap, c0: C.length, cracks: [], x, p: new Float64Array(x), v: new Float64Array(3 * cap), w, C, T, t: 0,
      ay0, ay: new Float64Array(ay0), deck: sh.deck, span: sh.span, water: sh.water, balloon: sh.balloon, thin: sh.thin || 1, head: sh.head, people: sh.people, grips: sh.grips, crush: sh.crush };
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

  function reset(S) { S.n = S.n0; S.C.length = S.c0; S.cracks = []; S.x.set(S.x0); S.p.set(S.x0); S.v.fill(0); S.ay.set(S.ay0); S.C.forEach(c => { c.alive = true; c.fs = undefined; c.su = undefined; }); S.fire = null; S.ash = []; if (S.grips) S.grips.forEach(g => { g.done = false; }); if (S.people) S.people.forEach(p => { p.hit = false; p.down = false; }); measure(S, 1); S.t = 0; }

  // A broken strut does not vanish: it cracks in the middle. The two halves stay, joined by a free hinge, so the strut
  // can no longer push its ends apart and the physics decides how the pieces fold.
  function snap(S, c) {
    c.alive = false;
    if (c.half || S.n >= S.cap) return;
    const i = S.n++, a = 3 * c.a, b = 3 * c.b, j = 3 * i, x = S.x;
    for (let k = 0; k < 3; k++) { x[j + k] = (x[a + k] + x[b + k]) / 2; S.p[j + k] = x[j + k]; S.v[j + k] = (S.v[a + k] + S.v[b + k]) / 2; }
    S.w[i] = Math.max(S.w[c.a], S.w[c.b]) || 1; S.ay[i] = 0; S.ay0[i] = 0;
    const half = (p, q) => ({ a: p, b: q, kind: 'strut', L0: c.L0 / 2, comp: 0, uni: false, draw: true, alive: true, T: 0, Tema: 0, half: true, col: c.col, thin: c.thin });
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


  /* ----- fire: lit at a point, it runs along every member at a steady pace. A cable that has burned for a moment snaps,
     a strut that has burned longer breaks (and its halves crumble to ash later), and what is left settles as ash. ----- */
  const FIRE = { cable: 0.8, fabric: 0.5, strut: 2.0, hidden: 2.6, crumble: 1.7 };
  function ignite(S, ci, u) {
    const c = S.C[ci]; if (!c || c.Lg === undefined || !c.alive) return false;
    if (!S.fire) {
      const n0 = S.n0, adj = Array.from({ length: n0 }, () => []), lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      for (let i = 0; i < S.c0; i++) { const m = S.C[i]; if (m.kind === 'bend') continue; adj[m.a].push([m.b, m.Lg]); adj[m.b].push([m.a, m.Lg]); }
      for (let i = 0; i < n0; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], S.x0[3 * i + k]); hi[k] = Math.max(hi[k], S.x0[3 * i + k]); }
      const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 0.3);
      const fabN = new Float64Array(S.cap), fabA = new Float64Array(S.cap);
      for (let i = 0; i < S.c0; i++) { const m = S.C[i]; if (m.kind === 'fabric') { fabN[m.a]++; fabN[m.b]++; fabA[m.a]++; fabA[m.b]++; } }
      S.fire = { fabN, fabA, F: 0, F0: 0, acc: 0, v: span / 4.5, ign: new Float64Array(S.cap).fill(Infinity), adj, snapped: 0, broke: 0, last: 0 };
    }
    const f = S.fire, n0 = S.n0, d = new Float64Array(n0).fill(Infinity), done = new Uint8Array(n0);
    d[c.a] = f.F + u * c.Lg / f.v; d[c.b] = Math.min(d[c.b], f.F + (1 - u) * c.Lg / f.v);
    for (let it = 0; it < n0; it++) {
      let k = -1, m = Infinity; for (let i = 0; i < n0; i++) if (!done[i] && d[i] < m) { m = d[i]; k = i; }
      if (k < 0) break; done[k] = 1;
      for (const [j, L] of f.adj[k]) { const t = m + L / f.v; if (t < d[j]) d[j] = t; }
    }
    for (let i = 0; i < n0; i++) { if (d[i] < f.ign[i]) f.ign[i] = d[i]; if (f.ign[i] < Infinity && f.ign[i] > f.last) f.last = f.ign[i]; }
    if (c.fs === undefined) { c.fs = f.F; c.su = u; c.st0 = f.F; loseLift(S, c); }
    return true;
  }
  // a burning envelope lets its hot air out: the lift on each node falls with the fabric around it that has caught fire
  function loseLift(S, c) {
    if (c.kind !== 'fabric') return; const f = S.fire;
    [c.a, c.b].forEach(i => { f.fabA[i]--; });
  }
  function spawnAsh(S, c, k) {
    const x = S.x, a = 3 * c.a, b = 3 * c.b, ash = S.ash;
    for (let i = 0; i < k; i++) {
      const u = Math.random(); if (ash.length >= 900) ash.shift();
      ash.push({ x: x[a] + (x[b] - x[a]) * u, y: x[a + 1] + (x[b + 1] - x[a + 1]) * u, z: x[a + 2] + (x[b + 2] - x[a + 2]) * u, vx: (Math.random() - 0.5) * 0.12, vy: 0, vz: (Math.random() - 0.5) * 0.12, s: 0.6 + Math.random() * 0.9, on: 0 });
    }
  }
  function ashStep(S, dt) {
    for (const p of S.ash) {
      if (p.on) continue;
      p.vy = Math.max(-1.1, p.vy - 9.81 * 0.3 * dt); p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y <= 0) { p.y = 0; p.on = 1; }
    }
  }
  // quant > 0: the fire advances in steps of that many seconds (for people who ask for less motion)
  function fireStep(S, dt, quant) {
    const f = S.fire; ashStep(S, dt); if (!f) return;
    if (quant) { f.acc += dt; if (f.acc < quant) return; dt = f.acc; f.acc = 0; }
    f.F += dt; const F = f.F;
    // the hot air cools and leaks while anything burns, and leaves with the fabric that has caught fire
    for (let i = 0; i < S.n0; i++) if (S.ay0[i] > 0 && f.fabN[i]) S.ay[i] = S.ay0[i] * Math.max(0, f.fabA[i]) / f.fabN[i] * Math.max(0, 1 - (F - f.F0) / 3);
    for (let ci = 0; ci < S.C.length; ci++) {
      const c = S.C[ci]; if (!c.alive) continue;
      if (c.half) { if (F >= c.crumble) { c.alive = false; spawnAsh(S, c, 4); } continue; }
      if (ci >= S.c0) continue;
      if (c.fs === undefined) { const t = Math.min(f.ign[c.a], f.ign[c.b]); if (t <= F) { c.fs = t; loseLift(S, c); } else continue; }
      const life = c.kind === 'strut' ? FIRE.strut : c.kind === 'cable' ? FIRE.cable : c.kind === 'fabric' ? FIRE.fabric : FIRE.hidden;
      if (F - c.fs < life) continue;
      if (c.kind === 'strut') {
        const before = S.C.length; snap(S, c); f.broke++;
        for (let k = before; k < S.C.length; k++) { S.C[k].burnt = true; S.C[k].fb = F; S.C[k].crumble = F + FIRE.crumble * (0.7 + 0.6 * Math.random()); }
        if (S.C.length === before) spawnAsh(S, c, 4);
      } else { c.alive = false; if (c.kind === 'cable') { f.snapped++; spawnAsh(S, c, 2); } else if (c.kind === 'fabric') {
          f.snapped++; if (Math.random() < 0.5) spawnAsh(S, c, 1);
        } }
    }
    f.over = F > f.last + FIRE.strut + FIRE.crumble * 1.4 + 0.3;
  }

  function pluck(S, i, mag) {
    const x = S.x; let cx = 0, cy = 0, cz = 0, m = 0;
    for (let k = 0; k < S.n; k++) if (S.w[k]) { cx += x[3 * k]; cy += x[3 * k + 1]; cz += x[3 * k + 2]; m++; }
    cx /= m; cy /= m; cz /= m;
    let dx = x[3 * i] - cx, dy = x[3 * i + 1] - cy, dz = x[3 * i + 2] - cz; const L = Math.hypot(dx, dy, dz) || 1;
    S.v[3 * i] += dx / L * mag; S.v[3 * i + 1] += dy / L * mag; S.v[3 * i + 2] += dz / L * mag;
  }

  function hazards(S) {
    const x = S.x; let ev = null;
    if (S.grips) S.grips.forEach(g => { if (g.done) return; for (const [a, c] of g.pairs) { const i = 3 * a, j = 3 * c, L = Math.hypot(x[j] - x[i], x[j + 1] - x[i + 1], x[j + 2] - x[i + 2]) || 1;
      if (Math.abs(x[j + 1] - x[i + 1]) / L > g.max) { g.cs.forEach(ci => { S.C[ci].alive = false; }); g.done = true; ev = ev || 'slip'; break; } } });
    if (S.crush && S.people) S.people.forEach(p => { if (p.hit) return; const h = 3 * p.head; for (const i of S.crush.by) { if (Math.hypot(x[3 * i] - x[h], x[3 * i + 1] - x[h + 1], x[3 * i + 2] - x[h + 2]) < S.crush.r) { p.hit = true; kill(S, p.strut); ev = { hit: [x[h], x[h + 1], x[h + 2]] }; break; } } });
    if (S.people) S.people.forEach(p => { if (!p.down && x[3 * p.head + 1] < p.y0 * 0.4) { p.down = true; if (!p.hit) ev = ev || 'down'; } });
    return ev;
  }

  const ok = S => { for (let i = 0; i < S.x.length; i++) if (!isFinite(S.x[i]) || Math.abs(S.x[i]) > 50) return false; return true; };

  return { SHAPES, make, step, measure, reset, kill, pluck, ok, hazards, ignite, fireStep };
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
.cur-hammer,.cur-hammer canvas{cursor:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath d='M12 12 L28 28' stroke='%23fff' stroke-width='6.5' stroke-linecap='round'/%3E%3Cpath d='M7 16 L16 7' stroke='%23fff' stroke-width='12' stroke-linecap='butt'/%3E%3Cpath d='M12 12 L28 28' stroke='%238A5A0B' stroke-width='3.6' stroke-linecap='round'/%3E%3Cpath d='M7.6 15.4 L15.4 7.6' stroke='%230E3A75' stroke-width='9' stroke-linecap='butt'/%3E%3Cpath d='M4.6 17.4 L8.4 13.6' stroke='%23EEF3F9' stroke-width='3' stroke-linecap='butt'/%3E%3C/svg%3E") 5 17,crosshair!important}
.cur-fire,.cur-fire canvas{cursor:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath d='M16 2 C18 8 25 11 25 20 C25 26 21 30 16 30 C11 30 7 26 7 20 C7 16 9 14 11 12 C11 15 13 16 14 16 C13 10 14 6 16 2 Z' fill='%23E8761C' stroke='%23fff' stroke-width='2.4' stroke-linejoin='round' paint-order='stroke'/%3E%3Cpath d='M16 14 C17 18 21 19 21 23 C21 26 19 28 16 28 C13 28 11 26 11 23 C11 20 15 18 16 14 Z' fill='%23F7C62F'/%3E%3C/svg%3E") 16 28,crosshair!important}
.tgc{width:100%;margin:10px auto 0;display:grid;gap:8px;font-size:.9rem}
.tgc-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.tgc-two{gap:6px}
.tgc-two .tgc-grp{flex-wrap:nowrap}
.tgc-two .tgc-grp+.tgc-grp{margin-left:auto;padding-left:10px;border-left:1px solid var(--line)}
.tgc-two .chipbtn{white-space:nowrap}
@media (max-width:560px){.tgc-two .tgc-grp+.tgc-grp{margin-left:0;padding-left:0;border-left:0}}
.tgc-grp{display:inline-flex;flex-wrap:wrap;gap:6px}
.stage .tg-spin{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:2;font-size:.98rem;padding:9px 18px 9px 11px;box-shadow:0 2px 10px rgba(11,37,69,.12)}
.stage .tg-spin .sw{width:42px;height:22px}
.stage .tg-spin .sw::after{width:18px;height:18px}
.stage .tg-spin[aria-pressed="true"] .sw::after{transform:translateX(20px)}
.tgc label.tgc-sel{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font:600 .86rem/1.2 var(--font);color:var(--navy)}
.tgc select{font:600 .88rem/1.2 var(--font);color:var(--navy);background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px 30px 8px 10px;max-width:100%;cursor:pointer}
.tgc select:hover{border-color:var(--sky)}
.tgc .chipbtn{padding:8px 10px}
.tgc .chipbtn.on{background:var(--blue);border-color:var(--blue);color:#fff}
.tgc .chipbtn.cut.on{background:#B4232F;border-color:#B4232F}
.tgc .chipbtn.fire.on{background:#D9661F;border-color:#D9661F}
.tgc-two .chipbtn{padding:8px 6px;font-size:.82rem}
.tgc-two .tgc-grp+.tgc-grp{padding-left:6px}
.tgc-two .tgc-grp{gap:5px}
.tgc [data-a=speed]{min-width:5.7em;text-align:center}
.tgc [data-a=speed] small{font-size:.74em;font-weight:600;opacity:.85;margin-left:.2em}
.tgc-seg{display:inline-flex;align-items:center;gap:4px;color:var(--soft);font-size:.82rem;font-weight:600}
.tgc-info{margin:0;max-width:none;font-size:.9rem;line-height:1.5;color:var(--ink);background:var(--mist);border:1px solid var(--line);border-radius:10px;padding:9px 12px}
.tgc-key{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:6px;font-size:.8rem;color:var(--soft)}
.tgc-key i{display:inline-block;width:20px;vertical-align:middle;margin-right:5px;border-radius:3px}
.tgc-status{margin:0;max-width:none;font-size:.84rem;color:var(--soft);min-height:1.3em}
.tgc-chk{display:inline-flex;align-items:center;gap:5px;margin-left:8px;font:600 .84rem/1 var(--font);color:var(--navy);cursor:pointer}.tgc-chk input{accent-color:var(--blue)}
`;
  document.head.appendChild(st);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* ----- page fire (owner requests 2026-11-21): every time a structure is burned down, the fire seems to catch the page. The "Spin" control
     lights first, the fire hops to the "Change the tensegrity" label (a few embers arc across), spreads to nearby words and lines, some of which char and
     crumble, and last the Fire button burns and a small burn hole with glowing edges opens right there. About seven seconds of burning, then the site's
     sparkles sweep in and repair it. Everything is drawn on one fixed overlay canvas that ignores the pointer, so no layout moves and no text changes;
     word positions are read from the real elements and text ranges once and tracked through scrolling. The overlay is removed when it ends, on
     pagehide, and by a hard timeout. One sequence at a time: a new burn restarts it. Never with reduced motion. ----- */
  let pf = null;
  function pageFire(stage, box, spinBtn) {
    if (reduce) return; if (pf) pf.end(); pf = null;
    const fireBtn = box.querySelector('[data-m="fire"]'), lab = box.querySelector('.tgc-sel');
    if (!fireBtn || !lab || !spinBtn || !spinBtn.isConnected) return;
    const COLS = [[29, 95, 209], [91, 155, 230], [109, 74, 255], [242, 169, 59], [14, 58, 117], [214, 120, 210]];
    const coarse = matchMedia('(pointer: coarse)').matches, I = Math.random();          // I: how big a fire this time (0 small, 1 big)
    const vw = innerWidth, vh = innerHeight, d = Math.min(coarse ? 1.25 : 1.5, devicePixelRatio || 1), sx = scrollX, sy = scrollY;
    const rnd = (a, b) => a + Math.random() * (b - a), clamp = (x, a, b) => Math.max(a, Math.min(b, x)), ease = x => 1 - Math.pow(1 - x, 3);
    const pg = r => ({ x: r.left + sx, y: r.top + sy, w: r.width, h: r.height });
    const sr = spinBtn.getBoundingClientRect(), fr = fireBtn.getBoundingClientRect();
    if (sr.width < 10 || fr.width < 10) return;
    // the text of the label: its own text node, so the flames sit on the letters and not on the drop-down
    let labRect = null; { const w = document.createTreeWalker(lab, NodeFilter.SHOW_TEXT); const n = w.nextNode(); if (n) { const g = document.createRange(); g.selectNodeContents(n); const r = g.getBoundingClientRect(); if (r.width > 10) labRect = r; } }
    if (!labRect) labRect = lab.getBoundingClientRect();
    // nearby words: line boxes of the text close to the label, read once
    const skip = new Set([lab, fireBtn, spinBtn]), cand = [], lc = { x: labRect.left + labRect.width / 2, y: labRect.top + labRect.height / 2 };
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n => {
      const p = n.parentElement; if (!p || !/\S/.test(n.nodeValue) || stage.contains(p) || lab.contains(p) || fireBtn.contains(p) || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|OPTION|SELECT)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT; } });
    const rg = document.createRange(); let node, seen = 0;
    while ((node = tw.nextNode()) && seen++ < 3000) {
      rg.selectNodeContents(node);
      for (const r of rg.getClientRects()) {
        if (r.width < 24 || r.height < 8 || r.height > 60 || r.bottom < 8 || r.top > vh - 8 || r.right < 0 || r.left > vw) continue;
        const dist = Math.hypot(r.left + r.width / 2 - lc.x, (r.top + r.height / 2 - lc.y) * 1.3);
        if (dist < (coarse ? 380 : 560)) cand.push({ r, dist });
      }
    }
    cand.sort((a, b) => a.dist - b.dist);
    const nOther = Math.min(cand.length, Math.round((4 + 9 * I) * (coarse ? 0.7 : 1))), pool = cand.slice(0, Math.min(cand.length, nOther * 2 + 3));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const picks = pool.slice(0, nOther).sort((a, b) => a.dist - b.dist);
    // targets, in the order the fire reaches them: spin, label, nearby words, the Fire button
    const T_FIRE = 7, spd = 60 + 60 * I;
    const T = [];
    const add = (r, arr, crumble, win) => {
      let x = r.left + sx, w = r.width; if (win && w > 150) { const ww = rnd(70, 150); x += rnd(0, w - ww); w = ww; }
      const o = { x, y: r.top + sy, w, h: r.height, arr, crumble, org: rnd(0.2, 0.8) * w, sl: [], lit: false };
      const ns = Math.max(3, Math.ceil(w / 6)), sw = w / ns;
      for (let j = 0; j < ns; j++) { const cx = (j + 0.5) * sw, ts = arr + Math.abs(cx - o.org) / spd + Math.random() * 0.15, L = crumble ? rnd(1.5, 2.9) : rnd(0.8, 1.6);
        o.sl.push({ x: j * sw, w: sw, ts, L, ph: Math.random() * 6.283, hh: rnd(0.75, 1.3), cr: false }); }
      T.push(o); return o;
    };
    add(sr, 0.3, true, false);
    add(labRect, 2.1, true, false);
    const t1 = 2.9, t2 = 5.0;
    picks.forEach((p, i) => add(p.r, t1 + (picks.length > 1 ? i / (picks.length - 1) : 0) * (t2 - t1) + rnd(-0.12, 0.12), Math.random() < 0.55, true));
    const lastArr = T[T.length - 1].arr, fArr = Math.max(5.3, lastArr + 0.7);
    const FB = add(fr, fArr, true, false);
    const hc = { x: fr.left + fr.width / 2 + sx, y: fr.top + fr.height / 2 + sy }, HR = clamp(Math.max(fr.height * 0.85, 20) * (1 + 0.45 * I), 20, coarse ? 30 : 40);
    const T_HOLE = fArr + 0.6, ph = [0, 1, 2, 3, 4].map(() => Math.random() * 6.283), N = 28;
    const rad = a => 1 + 0.18 * Math.sin(3 * a + ph[0]) + 0.1 * Math.sin(5 * a + ph[1]) + 0.07 * Math.sin(9 * a + ph[2]);
    // embers that arc from one burning place to the next
    const hops = [];
    const pt = (o, top) => ({ x: o.x + rnd(0.1, 0.9) * o.w, y: o.y + o.h * (top ? 0.3 : 0.6) });
    for (let i = 1; i < T.length; i++) {
      const dst = T[i], src = T[Math.max(0, i - 1 - (Math.random() < 0.3 ? 1 : 0))], cnt = (i === 1 ? 4 : i === T.length - 1 ? 3 : 2) + (I > 0.6 && i > 1 ? 1 : 0);
      for (let k = 0; k < cnt; k++) { const a = pt(src, true), b = k === 0 ? { x: dst.x + dst.org, y: dst.y + dst.h * 0.5 } : pt(dst, false), du = rnd(0.5, 0.7) + (i === 1 ? 0.15 : 0);
        hops.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, t: dst.arr - du + (k ? rnd(-0.25, 0.1) : 0), du, up: rnd(35, 75) * (i === 1 ? 1.3 : 1) * (Math.random() < 0.5 ? 1 : 0.8) }); }
    }
    const crumbs = [], rise = [];
    const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); cv.dataset.pageFire = '1';
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:70';
    const c = cv.getContext('2d'); let W = 0, H = 0;
    const size = () => { W = innerWidth; H = innerHeight; cv.width = Math.round(W * d); cv.height = Math.round(H * d); c.setTransform(d, 0, 0, d, 0, 0); };
    size(); document.body.appendChild(cv); addEventListener('resize', size);
    // the sparkles that repair it: the same look as the pointer trail (soft glow, sometimes a four-pointed glint), same colours
    const nsp = Math.round((28 + 150 * I) * (coarse ? 0.55 : 1)), T_REP = 2.2 + 1.6 * I, T_END = T_FIRE + T_REP + 0.7, spark = [];
    for (let i = 0; i < nsp; i++) { const a = Math.random() * 6.283, e = Math.random() < 0.6, tr = Math.random() < 0.3 ? null : T[Math.floor(Math.random() * T.length)];
      spark.push({ sx: W / 2 + Math.cos(a) * W * 0.7, sy: H / 2 + Math.sin(a) * H * 0.7, a: Math.random() * 6.283, rr: Math.sqrt(Math.random()), tr, tx: Math.random(), ty: Math.random(),
        r: 1.2 + Math.random() * 2.8 + (e ? 0.8 : 0), d0: Math.random() * (T_REP - 1.1), dur: 0.7 + Math.random() * 0.5, tw: Math.random() * 6.283, col: COLS[Math.floor(Math.random() * COLS.length)], star: Math.random() < 0.4 }); }
    const t0 = performance.now(); let raf = 0, over = false, last = 0, prev = 0;
    function glow(x, y, R, a, col) { const gr = c.createRadialGradient(x, y, 0, x, y, R * 4);
      gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${0.85 * a})`); gr.addColorStop(0.35, `rgba(${col[0]},${col[1]},${col[2]},${0.35 * a})`); gr.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, R * 4, 0, 6.283); c.fill(); }
    function tongue(x, y, w, h, lean, a) {
      c.fillStyle = `rgba(255,86,22,${0.82 * a})`; c.beginPath(); c.moveTo(x - w / 2, y); c.quadraticCurveTo(x - w * 0.6, y - h * 0.55, x + lean, y - h); c.quadraticCurveTo(x + w * 0.6, y - h * 0.5, x + w / 2, y); c.closePath(); c.fill();
      c.fillStyle = `rgba(255,170,44,${0.92 * a})`; c.beginPath(); c.moveTo(x - w * 0.32, y); c.quadraticCurveTo(x - w * 0.36, y - h * 0.4, x + lean * 0.7, y - h * 0.72); c.quadraticCurveTo(x + w * 0.36, y - h * 0.35, x + w * 0.32, y); c.closePath(); c.fill();
      c.fillStyle = `rgba(255,238,160,${0.95 * a})`; c.beginPath(); c.moveTo(x - w * 0.15, y); c.quadraticCurveTo(x - w * 0.16, y - h * 0.2, x + lean * 0.4, y - h * 0.38); c.quadraticCurveTo(x + w * 0.16, y - h * 0.18, x + w * 0.15, y); c.closePath(); c.fill(); }
    function end() { if (over) return; over = true; cancelAnimationFrame(raf); clearTimeout(hard); removeEventListener('resize', size); removeEventListener('pagehide', end); cv.remove(); if (pf && pf.end === end) pf = null; }
    function frame(now) {
      if (over) return; raf = requestAnimationFrame(frame);
      if (coarse && now - last < 32) return; last = now;
      const t = (now - t0) / 1000, dt = Math.min(0.1, t - prev); prev = t; if (t > T_END) { end(); return; }
      c.clearRect(0, 0, W, H);
      const ox = scrollX, oy = scrollY;
      const rep = clamp((t - T_FIRE) / T_REP, 0, 1), heal = ease(clamp((rep - 0.12) / 0.8, 0, 1)), fl = 1 - clamp(rep / 0.3, 0, 1), keep = 1 - heal;
      // char on the letters: a dark overlay that creeps along from where the fire caught, ragged at the top, with bits crumbling off
      for (const o of T) { const X = o.x - ox, Y = o.y - oy; if (Y > H + 40 || Y + o.h < -40) continue;
        for (const s of o.sl) { const a = clamp((t - s.ts - 0.2) / 0.7, 0, 1); if (a <= 0) continue;
          const k = (o.crumble ? 0.86 : 0.3) * a * keep, jag = o.crumble ? (0.12 + 0.2 * Math.abs(Math.sin(s.ph * 3))) * o.h : 0.1 * o.h;
          c.fillStyle = o.crumble ? `rgba(24,16,14,${k})` : `rgba(80,44,20,${k})`; c.fillRect(X + s.x, Y + jag * (1 - a * 0.5), s.w + 0.6, o.h - jag * (1 - a * 0.5) + 1);
          if (o.crumble && !s.cr && t > s.ts + s.L * 0.8 && crumbs.length < (coarse ? 36 : 80)) { s.cr = true; for (let q = 0; q < 2; q++) crumbs.push({ x: o.x + s.x + Math.random() * s.w, y: o.y + o.h * rnd(0.4, 0.9), vx: rnd(-8, 8), vy: rnd(-10, 6), z: rnd(1.4, 3), l: 1 }); } } }
      for (let i = crumbs.length - 1; i >= 0; i--) { const b = crumbs[i]; b.vy += 120 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.l -= dt * 0.9; if (b.l <= 0) { crumbs.splice(i, 1); continue; }
        c.fillStyle = `rgba(30,20,16,${0.85 * b.l * keep})`; c.fillRect(b.x - ox, b.y - oy, b.z, b.z); }
      // flames dancing along the letters
      for (const o of T) { const X = o.x - ox, Y = o.y - oy; if (Y > H + 40 || Y + o.h < -60) continue; let act = 0;
        for (const s of o.sl) { const u0 = t - s.ts; if (u0 < 0 || u0 > s.L) continue;
          const u = clamp(u0 / 0.3, 0, 1) * (u0 > s.L * 0.6 ? clamp((s.L - u0) / (s.L * 0.4), 0, 1) : 1) * fl; if (u <= 0.02) continue; act += u;
          const f = 0.7 + 0.3 * Math.sin(t * 13 + s.ph) * Math.sin(t * 7.3 + s.ph * 2), h = (o.h * 0.85 + 7) * (0.8 + 0.6 * I) * s.hh * u * f, w = Math.max(6, s.w * 1.7) * (0.8 + 0.3 * I);
          tongue(X + s.x + s.w / 2 + Math.sin(t * 5 + s.ph) * 2, Y + o.h * 0.88, w, h, Math.sin(t * 6 + s.ph) * w * 0.55, Math.min(1, u * 1.3));
          if (rise.length < (coarse ? 14 : 34) && Math.random() < dt * 5) rise.push({ x: o.x + s.x, y: o.y + o.h * 0.3, vx: rnd(-10, 10), vy: rnd(-40, -90), l: 1, r: rnd(0.8, 1.6) }); }
        if (act > 0.5 && !coarse) { const g = c.createRadialGradient(X + o.w / 2, Y + o.h * 0.6, 0, X + o.w / 2, Y + o.h * 0.6, o.w * 0.6 + 14); const q = Math.min(0.3, act / o.sl.length * 0.3);
          g.addColorStop(0, `rgba(255,130,40,${q})`); g.addColorStop(1, 'rgba(255,130,40,0)'); c.fillStyle = g; c.fillRect(X - 14, Y - o.h * 1.2, o.w + 28, o.h * 2.6); } }
      // the burn hole where the Fire button was: dark, ragged, with a glowing edge
      const hs = ease(clamp((t - T_HOLE) / 1.0, 0, 1)) * keep, heat = clamp((t - T_HOLE) / 0.6, 0, 1) * keep;
      if (hs > 0.02) { const cx = hc.x - ox, cy = hc.y - oy, pts = [];
        for (let i = 0; i < N; i++) { const a = i / N * 6.283, rr = HR * hs * rad(a); pts.push([cx + Math.cos(a) * rr * 1.5, cy + Math.sin(a) * rr]); }
        const path = () => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); };
        const gr = c.createRadialGradient(cx, cy, 0, cx, cy, HR * 1.5 * hs + 1); gr.addColorStop(0, 'rgba(14,10,18,.95)'); gr.addColorStop(0.75, 'rgba(26,16,14,.9)'); gr.addColorStop(1, 'rgba(60,30,14,.8)');
        path(); c.fillStyle = gr; c.fill(); c.lineJoin = 'round'; path(); c.strokeStyle = `rgba(50,26,12,${0.7 * hs})`; c.lineWidth = 8 * hs + 2; c.stroke(); c.lineCap = 'round';
        for (let i = 0; i < N; i++) { const a = pts[i], b = pts[(i + 1) % N], h = heat * (0.55 + 0.45 * Math.sin(t * 9 + i * 1.7 + ph[3]) * Math.sin(t * 5.3 + i));
          c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
          c.strokeStyle = `rgba(255,96,24,${0.75 * h})`; c.lineWidth = 6; c.stroke(); c.strokeStyle = `rgba(255,170,50,${0.85 * h})`; c.lineWidth = 3.4; c.stroke(); c.strokeStyle = `rgba(255,236,150,${0.9 * h})`; c.lineWidth = 1.4; c.stroke(); }
        if (rise.length < (coarse ? 14 : 34) && Math.random() < dt * 20 * heat) { const a = Math.random() * 6.283; rise.push({ x: hc.x + Math.cos(a) * HR * hs * 1.5, y: hc.y + Math.sin(a) * HR * hs, vx: rnd(-10, 10), vy: rnd(-50, -100), l: 1, r: rnd(0.9, 1.8) }); } }
      for (let i = rise.length - 1; i >= 0; i--) { const e = rise[i]; e.x += e.vx * dt; e.y += e.vy * dt; e.l -= dt * 1.1; if (e.l <= 0) { rise.splice(i, 1); continue; } glow(e.x - ox, e.y - oy, e.r * e.l + 0.4, e.l * Math.max(fl, 0.2) * 0.9, [255, 150, 40]); }
      // embers hopping from place to place
      for (const h of hops) { const u = (t - h.t) / h.du; if (u < 0 || u > 1.15 || fl <= 0) continue;
        const pos = v => ({ x: h.ax + (h.bx - h.ax) * v - ox, y: h.ay + (h.by - h.ay) * v - 4 * h.up * v * (1 - v) - oy });
        for (let k = 5; k >= 0; k--) { const v = clamp(u - k * 0.04, 0, 1), p = pos(v), a = (1 - k / 6) * (u > 1 ? 1 - (u - 1) / 0.15 : 1); glow(p.x, p.y, (k ? 1.1 : 2) * (1 - k * 0.1), a * 0.9, k ? [255, 120, 30] : [255, 214, 110]); } }
      // the sparkles come in and mend it
      if (t > T_FIRE - 0.2) for (const s of spark) {
        const u = (t - T_FIRE - s.d0) / s.dur; if (u < 0 || u > 1.7) continue;
        let tx, ty; if (s.tr) { tx = s.tr.x - ox + s.tx * s.tr.w; ty = s.tr.y - oy + s.ty * s.tr.h; } else { tx = hc.x - ox + Math.cos(s.a) * HR * 1.4 * s.rr; ty = hc.y - oy + Math.sin(s.a) * HR * s.rr; }
        const m = ease(clamp(u, 0, 1)), x = s.sx + (tx - s.sx) * m, y = s.sy + (ty - s.sy) * m, a = (u < 1 ? 0.35 + 0.65 * m : Math.max(0, 1 - (u - 1) / 0.7)) * (0.7 + 0.3 * Math.sin(t * 14 + s.tw)), [r, g, b] = s.col, Rr = s.r;
        glow(x, y, Rr, a, s.col);
        if (s.star) { c.strokeStyle = `rgba(${r},${g},${b},${a})`; c.lineWidth = 1.1; c.beginPath(); c.moveTo(x - Rr * 3.2, y); c.lineTo(x + Rr * 3.2, y); c.moveTo(x, y - Rr * 3.2); c.lineTo(x, y + Rr * 3.2); c.stroke(); }
      }
    }
    let hard = 0;
    try { raf = requestAnimationFrame(frame); hard = setTimeout(end, (T_END + 2) * 1000); addEventListener('pagehide', end, { once: true }); pf = { end }; } catch (_) { end(); }
  }
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  stages.forEach(init);

  function init(stage) {
    const cv = stage.querySelector('canvas#tg'), ctx = cv.getContext('2d');
    const auto = stage.dataset.autospin === '1' && !reduce;
    const start = TG.SHAPES.some(r => r[0] === stage.dataset.start) ? stage.dataset.start : 'six';
    let S = TG.make(start), running = true, spin = auto, speed = 1, mode = 'pluck', hover = -1, cuts = 0, removed = 0, flashes = [], visible = true, smoke = [];
    let water = true, traffic = true, cars = [], flown = 0, burningList = [], fireKey = '';
    let yaw = S.view[0], pitch = S.view[1], vyaw = 0, W = 0, H = 0, cam = null;

    // controls
    const box = document.createElement('div'); box.className = 'tgc';
    box.innerHTML = `
<div class="tgc-row"><label class="tgc-sel">Change the tensegrity <select>${[...new Set(TG.SHAPES.map(s => s[3]))].map(g => `<optgroup label="${g}">${TG.SHAPES.filter(s => s[3] === g).map(s => `<option value="${s[0]}"${s[0] === start ? ' selected' : ''}>${s[1]}</option>`).join('')}</optgroup>`).join('')}</select></label>
  <span class="tgc-seg tgc-bridge"><label class="tgc-chk"><input type="checkbox" data-o="water" checked> Water</label><label class="tgc-chk"><input type="checkbox" data-o="traffic" checked> Traffic</label></span></div>
<div class="tgc-row tgc-two">
  <span class="tgc-grp" role="group" aria-label="What a tap does"><button type="button" class="chipbtn on" data-m="pluck">Pluck a node</button><button type="button" class="chipbtn cut" data-m="cut">Cut a cable</button><button type="button" class="chipbtn cut" data-m="strut">Break a strut</button><button type="button" class="chipbtn fire" data-m="fire">Fire</button></span>
  <span class="tgc-grp" role="group" aria-label="Playback"><button type="button" class="chipbtn" data-a="play" aria-pressed="false">Pause</button><button type="button" class="chipbtn" data-a="speed" aria-label="Slow motion, tap to change the speed">Slow <small>1x</small></button><button type="button" class="chipbtn" data-a="reset">Reset</button></span>
</div>
<p class="tgc-info"><span class="tgc-text"></span>
<span class="tgc-key"><span><i style="height:6px;background:var(--deep)"></i>strut: compression</span><span><i style="height:3px;background:var(--sky)"></i>cable: tension</span><span><i style="height:0;border-top:2px dashed #A9B8CC"></i>slack cable</span><span><i style="height:4px;background:#1D5FD1;box-shadow:0 0 6px #5B9BE6"></i>tension changing</span></span></p>
<p class="tgc-status" aria-live="polite"></p>`;
    stage.insertAdjacentElement('afterend', box);
    const spinBtn = document.createElement('button'); spinBtn.type = 'button'; spinBtn.className = 'spinsw tg-spin'; spinBtn.setAttribute('aria-pressed', spin); spinBtn.innerHTML = '<span class="sw" aria-hidden="true"></span><span class="st"></span>';
    stage.appendChild(spinBtn);
    ['pointerdown', 'pointerup', 'pointermove'].forEach(ev => spinBtn.addEventListener(ev, e => e.stopPropagation()));
    spinBtn.addEventListener('click', e => { e.stopPropagation(); spin = !spin; spinBtn.setAttribute('aria-pressed', spin); });
    const $ = q => box.querySelector(q), sel = $('select'), status = $('.tgc-status');
    const setInfo = () => { $('.tgc-text').textContent = S.info; $('.tgc-bridge').style.display = S.deck ? '' : 'none'; };
    box.querySelectorAll('[data-o]').forEach(c => c.addEventListener('change', () => { if (c.dataset.o === 'water') water = c.checked; else { traffic = c.checked; if (!traffic) { cars = []; S.ay.set(S.ay0); } } }));
    const setCursor = () => { stage.classList.remove('cur-pluck', 'cur-cut', 'cur-strut', 'cur-hammer', 'cur-fire'); stage.classList.add(mode === 'strut' ? 'cur-hammer' : 'cur-' + mode); };
    setCursor();
    const fireLine = () => { const f = S.fire; return f.over ? 'Everything has burned. Only ash is left. Press Reset to start again.' : `Burning. ${f.snapped} cable${f.snapped === 1 ? '' : 's'} snapped, ${f.broke} strut${f.broke === 1 ? '' : 's'} broken. Tap to light another spot.`; };
    const say = () => {
      const parts = [];
      if (cuts) parts.push(`${cuts} cable${cuts > 1 ? 's' : ''} cut`);
      if (removed) parts.push(`${removed} strut${removed > 1 ? 's' : ''} broken`);
      if (S.fire) parts.length = 0;
      let m = S.fire ? fireLine() : parts.length ? parts.join(', ') + '. The physics decides what follows.' : mode === 'cut' ? 'Tap a cable to cut it.' : mode === 'strut' ? 'Tap a strut to break it. It cracks in the middle and folds.' : mode === 'fire' ? 'Tap a point on the structure to light a fire there. It spreads along the cables and struts.' : 'Tap a node to send a pulse of tension; drag to turn.';
      if (!running) m = 'Paused. ' + m + ' Press Play to run the physics.';
      status.textContent = m;
    };
    const chips = (attr, val) => box.querySelectorAll(`[data-${attr}]`).forEach(b => b.classList.toggle('on', b.dataset[attr] === String(val)));
    function load(key) { S = TG.make(key); S.deckSeg = null; yaw = S.view[0]; pitch = S.view[1]; vyaw = 0; cuts = removed = 0; hover = -1; cars = []; smoke = []; fit(); setInfo(); say(); draw(); }
    sel.addEventListener('change', () => load(sel.value));
    stage.tg = { state: () => S, cut: ci => { cuts += TG.kill(S, ci) ? 1 : 0; say(); }, load };
    box.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.m) { mode = b.dataset.m; chips('m', mode); setCursor(); hover = -1; say(); }
      const a = b.dataset.a;
      if (a === 'play') { running = !running; b.textContent = running ? 'Pause' : 'Play'; b.setAttribute('aria-pressed', !running); say(); }
      if (a === 'speed') { speed = speed === 1 ? 0.25 : speed === 0.25 ? 0.1 : 1; b.innerHTML = 'Slow <small>' + speed + 'x</small>'; b.classList.toggle('on', speed !== 1); }
      if (a === 'reset') { TG.reset(S); cuts = removed = 0; cars = []; smoke = []; yaw = S.view[0]; pitch = S.view[1]; vyaw = 0; say(); }
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
      // ash: grey flecks, falling and settled
      if (S.ash.length) {
        const sc = Math.min(1.3, Math.min(W, H) / 420);
        S.ash.forEach(a => { const q = pr(a.x, a.y, a.z), z = Math.max(1.3, 2.3 * a.s * q[3] * sc); ctx.fillStyle = a.on ? (a.s > 1 ? '#8E9298' : '#A7ABB1') : '#5E6269'; ctx.fillRect(q[0] - z / 2, q[1] - z / 3, z, z * 0.66); });
      }
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
        ctx.strokeStyle = ci === hover ? '#D33A45' : c.burnt ? '#4B4541' : c.col || deep; ctx.lineCap = 'round';
        ctx.lineWidth = S.thin * (c.thin || 1) * Math.max(3, Math.min(10, 7.5 * (a[3] + b[3]) / 2 * Math.min(1.3, Math.min(W, H) / 420)));
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
      if (S.people) S.people.forEach(p => { if (S.fire && !S.C.some(c => c.alive && c.grp === p.grp && c.kind === 'strut')) return; const h = P[p.head], nk = P[p.neck], r = Math.max(3, Math.hypot(h[0] - nk[0], h[1] - nk[1]) * 0.62);
        ctx.fillStyle = p.hit ? '#F6D9CC' : '#FBE7D6'; ctx.strokeStyle = '#D9661F'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h[0], h[1] - r * 0.25, r, 0, 7); ctx.fill(); ctx.stroke(); });
      if (S.fire) drawFire(P);
      // nodes
      let held = null;
      if (S.fire) { held = new Uint8Array(S.n); S.C.forEach(c => { if (c.alive && c.draw) { held[c.a] = 1; held[c.b] = 1; } }); }
      for (let i = 0; i < S.n; i++) {
        const p = P[i];
        if (held && S.w[i] && !held[i]) continue;
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


    // fire: charred overlay on what has burned, flickering flames along it, and a little smoke
    function drawFire(P) {
      const f = S.fire, F = f.F, k = Math.min(1.3, Math.min(W, H) / 420), tm = reduce ? 0 : performance.now() / 1000, burning = [];
      S.C.forEach((c, ci) => {
        if (!c.alive) return;
        if (c.half) { if (c.burnt && F - c.fb < 1.4) burning.push([ci, [[0.2, 0.8]], 1 - (F - c.fb) / 1.4, 0]); return; }
        if (c.fs === undefined || ci >= S.c0) return;
        const L = c.Lg || 1e-6, fa = Math.min(1, Math.max(0, (F - f.ign[c.a]) * f.v / L)), fb = Math.min(1, Math.max(0, (F - f.ign[c.b]) * f.v / L)), segs = [];
        if (fa + fb >= 1) segs.push([0, 1]); else { if (fa > 0) segs.push([0, fa]); if (fb > 0) segs.push([1 - fb, 1]); }
        if (c.su !== undefined) { const g = Math.max(0.02, (F - c.st0) * f.v / L); segs.push([Math.max(0, c.su - g), Math.min(1, c.su + g)]); }
        if (!segs.length) segs.push([c.su === undefined ? 0 : c.su, c.su === undefined ? 0 : c.su]);
        const life = c.kind === 'strut' ? 2.0 : c.kind === 'cable' ? 0.8 : c.kind === 'fabric' ? 0.5 : 2.6;
        burning.push([ci, segs, Math.max(0.25, 1 - (F - c.fs) / life * 0.6), Math.min(1, (F - c.fs) / life)]);
      });
      const stride = Math.ceil(burning.length / 150);
      ctx.lineCap = 'round';
      burning.forEach(([ci, segs, vig, age], bi) => {
        const c = S.C[ci], a = P[c.a], b = P[c.b], fab = c.kind === 'fabric', show = c.draw && !c.half;
        if (show && (!fab || bi % stride === 0)) {
          const w = c.kind === 'strut' ? S.thin * (c.thin || 1) * Math.max(3, Math.min(10, 7.5 * (a[3] + b[3]) / 2 * k)) : fab ? 1.4 : 2.4;
          ctx.strokeStyle = `rgb(${Math.round(232 - 174 * age)},${Math.round(118 - 72 * age)},${Math.round(28 + 12 * age)})`; ctx.lineWidth = w;
          segs.forEach(([u0, u1]) => { if (u1 - u0 < 0.002) return; ctx.beginPath(); ctx.moveTo(a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0); ctx.lineTo(a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1); ctx.stroke(); });
        }
        if (fab && bi % (stride * 3) !== 0) return;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        segs.forEach(([u0, u1], si) => {
          const cnt = Math.max(1, Math.min(4, Math.round((u1 - u0) * len / 18)));
          for (let j = 0; j < cnt; j++) {
            const u = u0 + (u1 - u0) * (j + 0.5) / cnt, ph = ci * 1.7 + j * 2.3 + si, x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u, q = (a[3] + b[3]) / 2;
            const h = (13 + 5 * ((ci * 7 + j * 3) % 5) / 4) * q * k * vig * (0.8 + 0.22 * Math.sin(tm * 9 + ph) + 0.1 * Math.sin(tm * 17 + ph * 1.9)), w = h * 0.34, sw = 3 * k * Math.sin(tm * 6 + ph);
            ctx.fillStyle = '#E8761C'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.7, y - h * 0.55, x + sw, y - h); ctx.quadraticCurveTo(x + w * 0.7, y - h * 0.5, x + w, y); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#F7C62F'; ctx.beginPath(); ctx.moveTo(x - w * 0.5, y); ctx.quadraticCurveTo(x - w * 0.35, y - h * 0.4, x + sw * 0.6, y - h * 0.68); ctx.quadraticCurveTo(x + w * 0.35, y - h * 0.35, x + w * 0.5, y); ctx.closePath(); ctx.fill();
          }
        });
      });
      // smoke
      smoke.forEach(m => { const q = pr(m.x, m.y, m.z), t = (performance.now() - m.t0) / 1700; if (t >= 1) return; ctx.fillStyle = `rgba(70,72,78,${(0.2 * (1 - t)).toFixed(3)})`; ctx.beginPath(); ctx.arc(q[0] + 6 * k * t * m.d, q[1], (3 + 10 * t) * q[3] * k, 0, 7); ctx.fill(); });
      burningList = burning;
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
          if (S.balloon !== undefined && !S.fire && S.x[3 * S.balloon + 1] > cam.c[1] + cam.R * 3.2) { TG.reset(S); cuts = removed = 0; status.textContent = 'The balloon floated away. It has been brought back.'; }
          TG.fireStep(S, sdt, reduce ? 0.5 : 0);
          if (S.fire && !S.fire.pf && !reduce && (S.fire.over || S.fire.F > S.fire.last + 2)) { S.fire.pf = 1; pageFire(stage, box, spinBtn); }
          if (!S.fire) burningList = [];
          if (S.fire && !reduce && burningList.length) {
            smoke = smoke.filter(m => now - m.t0 < 1700); smoke.forEach(m => { m.y += cam.R * 0.22 * sdt; m.x += m.vx * sdt; });
            const want = Math.min(2, Math.ceil(burningList.length / 30)) * (Math.random() < Math.min(1, dt * 40) ? 1 : 0);
            for (let i = 0; i < want && smoke.length < 60; i++) { const e = burningList[Math.floor(Math.random() * burningList.length)], c = S.C[e[0]], sg = e[1][Math.floor(Math.random() * e[1].length)]; if (!c) continue; const u = sg[0] + (sg[1] - sg[0]) * Math.random(), A = 3 * c.a, B = 3 * c.b, X = S.x;
              smoke.push({ x: X[A] + (X[B] - X[A]) * u, y: X[A + 1] + (X[B + 1] - X[A + 1]) * u + cam.R * 0.03, z: X[A + 2] + (X[B + 2] - X[A + 2]) * u, t0: now, vx: (Math.random() - 0.5) * cam.R * 0.08, d: Math.random() * 2 - 1 }); }
          }
          if (S.fire) { const key = S.fire.snapped + ',' + S.fire.broke + ',' + (S.fire.over ? 1 : 0); if (key !== fireKey) { fireKey = key; say(); } }
          TG.measure(S, 1 - Math.exp(-sdt / 0.5));
          if (!TG.ok(S)) { TG.reset(S); cuts = removed = 0; say(); }
          const ev = TG.hazards(S);
          if (ev) { if (ev.hit) { flashes.push({ x: ev.hit[0], y: ev.hit[1], z: ev.hit[2], t0: performance.now() }); status.textContent = 'It landed on them. Press Reset to try again.'; }
            else if (ev === 'slip') status.textContent = 'What they stand on tilted past what feet can hold. They have lost their footing.';
            else status.textContent = 'They fell. Press Reset to put them back.'; }
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
      const x = S.x; let best = -1, bd = 1e9, bt = 0;
      S.C.forEach((c, ci) => {
        if (!c.alive || !c.draw || !want(c)) return;
        const a = pr(x[3 * c.a], x[3 * c.a + 1], x[3 * c.a + 2]), b = pr(x[3 * c.b], x[3 * c.b + 1], x[3 * c.b + 2]);
        const ux = b[0] - a[0], uy = b[1] - a[1], l2 = ux * ux + uy * uy || 1;
        const t = Math.max(0, Math.min(1, ((mx - a[0]) * ux + (my - a[1]) * uy) / l2));
        const d = Math.hypot(a[0] + t * ux - mx, a[1] + t * uy - my);
        if (d < bd) { bd = d; best = ci; bt = t; }
      });
      return [best, bd, bt];
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
      if (mode === 'fire') {
        const [fi, fd, ft] = nearest(mx, my, c => c.Lg !== undefined && !c.half);
        if (fi < 0 || fd > tol + 8) return;
        if (TG.ignite(S, fi, ft)) { smoke = []; say(); }
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
        if (e.pointerType === 'mouse' && (mode === 'cut' || mode === 'strut')) { const [ci, d] = nearest(e.clientX - r.left, e.clientY - r.top, mode === 'cut' ? isCable : isStrut); hover = d < 16 ? ci : -1; }
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
    stage.tgToy = { load: k => { sel.value = k; load(k); }, get S() { return S; }, cut: ci => { TG.kill(S, ci); cuts++; say(); }, draw: () => draw(), mid: ci => { const c = S.C[ci], x = S.x, q = pr((x[3 * c.a] + x[3 * c.b]) / 2, (x[3 * c.a + 1] + x[3 * c.b + 1]) / 2, (x[3 * c.a + 2] + x[3 * c.b + 2]) / 2); return [q[0], q[1]]; } };
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
    hmr: { 'One theory, from': { a: ['What came before the Big Bang?', 'Universal Intelligence: awareness with unlimited potential and no order yet. Its first act was a distinction, me and not me, and that distinction was the first distance.', 'answers.html#before'] } },
    health: { 'The problem: the wrong': { p: ['sim', 'The right reference, being built', 'A body with perfect tissue, measured exactly: the simulation starts there and works outward to every way a body can fall short.', 'simulation.html'] },
      'How disease is assessed': { p: ['vhp', 'What medicine can already see', 'A whole body, slice by slice. The pictures exist. What is missing is the ideal to compare them with.', 'library.html'] },
      'The body as a physical': { p: ['gallop', 'Motion is physics', 'The first photographs to freeze a moving body, 1878. Everything a body does is forces through tissue.', 'physics-health.html'] },
      'The ideal comes from': { p: ['straws', 'Build one', 'Six straws and some elastic: the same principle the ideal body is worked out from.', 'simulation.html#why-tensegrity'] } },
    reality: { 'Newton, Einstein': { p: ['hudf', 'One sky, three theories', 'Newton, Einstein and quantum theory each describe this exactly, each in its own range, and they do not agree with one another.', 'physics.html'] },
      'A miss of': { a: ['Why does the calculation miss by 120 zeros?', 'HMR\'s reading: the calculation counts every possible tremble of empty space as if each one had weight. HMR has no formula for the measured amount yet, and says so.', 'answers.html#vacuum'] },
      'We can identify': { a: ['What is dark matter?', 'HMR has no mechanism yet. Its hypothesis is that the extra gravity comes from the pattern of distance itself and not from an unseen particle, and it stays a hypothesis until the mathematics produces how a galaxy turns.', 'answers.html#darkmatter'] },
      'No one knows what gravity': { a: ['What is gravity?', 'HMR\'s first hypothesis is a trend toward coherence. It is weighing others beside it: an inward flow of space, momentum through time, and a draw back to source.', 'physics.html#pull'] } },
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
  // Two columns side by side should end together. Where a picture tile exists for the section it fills the short column.
  // Otherwise text flows between the columns in reading order: the end of a long left column moves to the top of the right
  // one, or the start of a long right column moves to the foot of the left one (owner, recordings 2026-11-19 and 2026-11-20e).
  const TITLE = /^(H1|H2)$/, isTitle = n => TITLE.test(n.tagName) || n.classList.contains('eyebrow');
  const undo = el => { el.classList.remove('nb-prose'); [...el.querySelectorAll('img[data-nb-fit]')].forEach(i => { i.removeAttribute('data-nb-fit'); i.style.maxHeight = i.style.width = i.style.marginInline = ''; }); [...el.querySelectorAll('[data-nb-moved]')].forEach(n => n.removeAttribute('data-nb-moved'));
    if (el._nbHome) { el._nbHome.forEach((list, i) => list.forEach(n => el._nbCols[i].appendChild(n))); } };
  const flow = (el, kids) => {
    // two columns of plain paragraphs: let the browser balance them as one running text
    if (kids.every(k => k.children.length && [...k.children].every(c => c.tagName === 'P'))) { el.classList.add('nb-prose'); return; }
    if (!el._nbHome) { el._nbCols = kids; el._nbHome = kids.map(k => [...k.children]); }
    const H = () => kids.map(k => k.getBoundingClientRect().height);
    for (let guard = 0; guard < 12; guard++) {
      const hs = H(), gap = Math.abs(hs[0] - hs[1]); if (gap <= 90) break;
      const fromLeft = hs[0] > hs[1], src = kids[fromLeft ? 0 : 1], dst = kids[fromLeft ? 1 : 0], list = [...src.children]; if (list.length < 2) break;
      let take;
      if (fromLeft) { take = [list[list.length - 1]]; const prev = list[list.length - 2]; if (prev && /^H[3-6]$/.test(prev.tagName)) take.unshift(prev); }
      else { take = [list[0]]; if (/^H[3-6]$/.test(list[0].tagName) && list[1]) take.push(list[1]); }
      if (take.some(isTitle) || take.length >= list.length) break;
      const mark = fromLeft ? dst.firstChild : null; take.forEach(n => { n.dataset.nbMoved = '1'; dst.insertBefore(n, mark); });
      const h2 = H(), gap2 = Math.abs(h2[0] - h2[1]);
      if (gap2 >= gap - 8) { const back = fromLeft ? null : src.firstChild; take.forEach(n => { n.removeAttribute('data-nb-moved'); src.insertBefore(n, back); }); break; }
    }
  };
  const fit = () => {
    const wide = innerWidth > 1180;
    document.querySelectorAll('main .split, main .ew-row, main .ui-hum').forEach(el => {
      if (el.classList.contains('nb-keep') || el.classList.contains('kd-eq')) return; // balanced by hand
      undo(el);
      const kids = [...el.children].filter(c => c.offsetParent !== null);
      kids.forEach(k => { k.classList.remove('nb-stick', 'nb-col'); [...k.children].forEach(c => { if (c.classList.contains('nb-fill') && c.dataset.auto) c.remove(); }); }); el.classList.remove('nb-eq');
      if (!wide || kids.length !== 2 || el.classList.contains('kd-eq') || el.classList.contains('nb-keep') || el.closest('.simgrid')) return;
      const tops = kids.map(k => k.getBoundingClientRect().top); if (Math.abs(tops[0] - tops[1]) > 30) return; // stacked, not side by side
      const hs = kids.map(k => k.getBoundingClientRect().height), short = hs[0] < hs[1] ? 0 : 1, gap = Math.abs(hs[0] - hs[1]); if (gap <= 120) return;
      const sec = el.closest('section, .page-head'), h = sec && sec.querySelector('h1, h2'), head = h ? h.textContent.trim() : '', map = FILL[page] || {}, key = Object.keys(map).find(k => head.startsWith(k));
      if (key && gap >= 150) { const t = tile(map[key]); t.dataset.auto = '1'; el.classList.add('nb-eq'); kids[short].classList.add('nb-col'); kids[short].appendChild(t); }
      else if (!el.closest('.page-head, .hero') && el.matches('.split')) flow(el, kids);
      // still uneven because one column is mostly a picture: show the picture smaller, so the two columns end together
      const h2 = kids.map(k => k.getBoundingClientRect().height), g2 = Math.abs(h2[0] - h2[1]);
      if (g2 > 120 && !el.classList.contains('nb-eq') && !el.classList.contains('nb-prose') && !el.closest('.page-head, .hero')) {
        const tall = kids[h2[0] > h2[1] ? 0 : 1], img = [...tall.querySelectorAll('img')].filter(i => !i.closest('.nb-fill')).sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
        if (img) { const ih = img.getBoundingClientRect().height; if (ih > 300) { img.dataset.nbFit = '1'; img.style.maxHeight = Math.max(260, Math.round(ih - g2)) + 'px'; img.style.width = 'auto'; img.style.marginInline = 'auto'; } } }
    });
  };
  let t = 0; const later = () => { clearTimeout(t); t = setTimeout(fit, 150); };
  addEventListener('load', fit); addEventListener('resize', later); if (document.readyState !== 'loading') fit(); else addEventListener('DOMContentLoaded', fit);
})();
