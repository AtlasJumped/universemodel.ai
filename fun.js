/* For fun: a tensegrity smash room.
   Self-contained. Nodes, struts (rigid), beams (rigid), cables (tension only) and fabric (tension only) are solved with
   small-step XPBD, with a ground, gravity, riders (little people and cars) and a handful of ways to ruin things.
   Sections: 1 core and builders, 2 scenes, 3 physics, 4 effects, 5 drawing, 6 input and interface. */
(() => {
'use strict';
const cv = document.getElementById('fun-cv');
if (!cv) return;
const ctx = cv.getContext('2d');
const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

/* ===================== 1. core data ===================== */
const NMAX = 1700, MMAX = 1500;
const px = new Float64Array(NMAX), py = new Float64Array(NMAX), pz = new Float64Array(NMAX);
const qx = new Float64Array(NMAX), qy = new Float64Array(NMAX), qz = new Float64Array(NMAX);
const vx = new Float64Array(NMAX), vy = new Float64Array(NMAX), vz = new Float64Array(NMAX);
const wI = new Float64Array(NMAX), nr = new Float64Array(NMAX), lift = new Float32Array(NMAX), drg = new Float32Array(NMAX);
const ax0 = new Float64Array(NMAX), ay0 = new Float64Array(NMAX), az0 = new Float64Array(NMAX);
const alive = new Uint8Array(NMAX), cont = new Uint8Array(NMAX), pinned = new Uint8Array(NMAX), isRider = new Uint8Array(NMAX), glow = new Uint8Array(NMAX);
const deg = new Int16Array(NMAX), fric = new Float32Array(NMAX), infl = new Float32Array(NMAX), axX = new Float64Array(NMAX), axZ = new Float64Array(NMAX);
const sx = new Float64Array(NMAX), sy = new Float64Array(NMAX), sz = new Float64Array(NMAX);
const riderOf = new Int16Array(NMAX).fill(-1), chx = new Float32Array(NMAX), chz = new Float32Array(NMAX), RN = new Int16Array(NMAX);
let nRN = 0; const upList = [];
let nN = 0, mem = [], adj = [], pins = [], panels = [], riders = [], balls = [], burning = [];
let S = null; // current scene info
const STRUT = 0, BEAM = 1, CABLE = 2, FAB = 3, LINK = 4;
const KD = [
  { ea: 4e5, brk: 0.02, th: 0.10, burn: 4.2, name: 'strut' },
  { ea: 2.5e5, brk: 0.025, th: 0.07, burn: 3.2, name: 'beam' },
  { ea: 9000, brk: 0.12, th: 0.032, burn: 2.2, name: 'cable' },
  { ea: 3500, brk: 0.14, th: 0.018, burn: 1.4, name: 'fabric' },
  { ea: 1e6, brk: 99, th: 0, burn: 99, name: 'link' }];

function resetWorld() {
  nN = 0; mem = []; adj = []; pins = []; panels = []; riders = []; balls = []; burning = [];
  alive.fill(0); cont.fill(0); pinned.fill(0); isRider.fill(0); riderOf.fill(-1); chx.fill(0); chz.fill(0); nRN = 0; upList.length = 0; lift.fill(0); drg.fill(0); glow.fill(0); deg.fill(0);
}
function node(x, y, z, m, pin, o) {
  if (nN >= NMAX) return nN - 1;
  const i = nN++;
  px[i] = qx[i] = x; py[i] = qy[i] = y; pz[i] = qz[i] = z; vx[i] = vy[i] = vz[i] = 0;
  wI[i] = pin ? 0 : 1 / (m || S.m); nr[i] = 0.03 * S.u; lift[i] = 0; drg[i] = 0.25; alive[i] = 1; cont[i] = 0; isRider[i] = 0; glow[i] = 0; deg[i] = 0; fric[i] = 0.22; infl[i] = 0;
  pinned[i] = pin ? 1 : 0; ax0[i] = x; ay0[i] = y; az0[i] = z; adj[i] = [];
  if (pin) pins.push(i);
  if (o) { if (o.lift) lift[i] = o.lift; if (o.drag) drg[i] = o.drag; if (o.glow) glow[i] = 1; if (o.infl) { infl[i] = o.infl; axX[i] = o.ax; axZ[i] = o.az; } }
  return i;
}
function dist(a, b) { return Math.hypot(px[a] - px[b], py[a] - py[b], pz[a] - pz[b]); }
function add(a, b, kind, o) {
  o = o || {};
  if (mem.length >= MMAX || a === b) return -1;
  const L = dist(a, b), K = KD[kind], cab = kind >= CABLE && kind !== LINK;
  const pre = o.pre !== undefined ? o.pre : (cab ? 0.965 : 1);
  const rest = L * pre;
  const ea = K.ea * (o.k || (cab ? S.k : S.ks));
  const m = { a, b, kind, L0: L, rest, al: rest / ea, brk: o.brk || K.brk, alive: true, burn: -1, dur: 0, lam: 0, T: 0, st: 0, col: o.col || null, th: (o.th || K.th) * S.u * (o.ts || 1), orig: !o.stub, stub: !!o.stub, hid: !!o.hid };
  mem.push(m); const id = mem.length - 1;
  adj[a].push(id); adj[b].push(id); deg[a]++; deg[b]++;
  return id;
}
const strut = (a, b, o) => add(a, b, STRUT, o), beam = (a, b, o) => add(a, b, BEAM, o), cable = (a, b, o) => add(a, b, CABLE, o), fab = (a, b, o) => add(a, b, FAB, o);
function memBetween(a, b) { const ad = adj[a]; for (let k = 0; k < ad.length; k++) { const m = mem[ad[k]]; if ((m.a === a && m.b === b) || (m.a === b && m.b === a)) return ad[k]; } return -1; }
// a fabric or floor panel over 3 or 4 nodes; hides when any listed member dies. Collides with riders if floor.
function panel(ns, col, alpha, o) {
  const ms = []; for (let k = 0; k < ns.length; k++) { const id = memBetween(ns[k], ns[(k + 1) % ns.length]); if (id >= 0) ms.push(id); }
  panels.push({ n: ns, ms, col, al: alpha, floor: !!(o && o.floor), z: 0 });
}
const lerp = (a, b, t) => a + (b - a) * t;

/* riders: toy people and cars. Every one is made of real solver nodes, so gravity, support, wind, quakes and impacts all apply.
   A person is a hip and a head joined by a rigid link, with a soft balance that keeps them upright until they are knocked
   over (then they tumble and lie where they land). A car is a rigid triangle of two axles and a roof, so it can roll and flip. */
function person(x, y, z, s, col) {
  const r = 0.5 * s, hip = node(x, y + r, z, s * s * s + 0.12, false), head = node(x, y + r + 0.86 * s, z, 0.25 * s * s * s + 0.03, false);
  nr[hip] = r; nr[head] = 0.2 * s; isRider[hip] = isRider[head] = 1; drg[hip] = drg[head] = 0.5; fric[hip] = 0.3; fric[head] = 0.05;
  const lk = add(hip, head, LINK, { k: 1, hid: true, stub: true, pre: 1 }); mem[lk].orig = false;
  riders.push({ t: 'p', n: hip, h: head, ns: [hip, head], s, col, st: 1, air: 0, run: 0, tq: 0, tp: rnd(0.5, 2.4), lx: x, ly: y + r, lz: z, lks: [lk], fell: false, id: riders.length });
  riderOf[hip] = riderOf[head] = riders.length - 1;
}
function car(x, y, z, s, col, drive, rot) {
  const L = 2.3 * s, r = 0.3 * s, ax = rot ? 0 : 1, az = rot ? 1 : 0;
  const a = node(x + ax * L / 2, y + r, z + az * L / 2, 3 * s * s, false), b = node(x - ax * L / 2, y + r, z - az * L / 2, 3 * s * s, false), c = node(x, y + r + 0.85 * s, z, 1.2 * s * s, false);
  nr[a] = nr[b] = r; nr[c] = 0.12 * s; for (const n of [a, b, c]) { isRider[n] = 2; drg[n] = 0.5; fric[n] = 0.25; } fric[a] = fric[b] = 0.004;
  const lks = [[a, b], [a, c], [b, c]].map(([p, q]) => { const l = add(p, q, LINK, { k: 1, hid: true, stub: true, pre: 1 }); mem[l].orig = false; return l; });
  riders.push({ t: 'c', n: a, n2: b, n3: c, ns: [a, b, c], s, col, drive: drive || null, lks, z0: z, ux: drive ? drive.ux : 1, upy: 1, fell: false, id: riders.length });
  const k = riders.length - 1; riderOf[a] = riderOf[b] = riderOf[c] = k;
}
// knock a person over: the balance stops, the body gets thinner so it can lie down, and it tumbles from whatever it was doing
function knock(R, kx, ky, kz) {
  if (R.t !== 'p' || R.dead) return;
  if (R.st) { R.st = 0; nr[R.n] = 0.22 * R.s; fric[R.n] = 0.3; fric[R.h] = 0.3; R.air = 0; const q = 1.2 * Math.sqrt(R.s), a = rnd(0, TAU); vx[R.h] += Math.cos(a) * q; vz[R.h] += Math.sin(a) * q; }
  if (kx || ky || kz) for (let k = 0; k < 2; k++) { const i = R.ns[k]; vx[i] += kx; vy[i] += ky; vz[i] += kz; }
}
// break a car into two halves that tumble apart
function splitCar(R, kx, ky, kz) {
  if (R.dead || R.t !== 'c' || nN + 3 >= NMAX || mem.length + 3 >= MMAX) return;
  R.dead = true;
  for (const id of R.lks) killMem(id, 'x');
  const A = R.n, B = R.n2, C = R.n3, s = R.s;
  let ux = px[A] - px[B], uy = py[A] - py[B], uz = pz[A] - pz[B]; const L = Math.hypot(ux, uy, uz) || 1; ux /= L; uy /= L; uz /= L;
  let rx = px[C] - (px[A] + px[B]) / 2, ry = py[C] - (py[A] + py[B]) / 2, rz = pz[C] - (pz[A] + pz[B]) / 2; const dd = rx * ux + ry * uy + rz * uz; rx -= dd * ux; ry -= dd * uy; rz -= dd * uz; const rl = Math.hypot(rx, ry, rz) || 1;
  const up = [rx / rl, ry / rl, rz / rl], mx = (px[A] + px[B]) / 2, my = (py[A] + py[B]) / 2, mz = (pz[A] + pz[B]) / 2, gap = 0.05 * s, sp = 0.35 * Math.sqrt(S.size);
  const mk2 = (sg, src) => { const n = node(mx + sg * ux * gap, my + sg * uy * gap, mz + sg * uz * gap, 1.5 * s * s, false); nr[n] = 0.24 * s; isRider[n] = 2; drg[n] = 0.5; fric[n] = 0.2; vx[n] = vx[src]; vy[n] = vy[src]; vz[n] = vz[src]; return n; };
  const M1 = mk2(1, A), M2 = mk2(-1, B);
  alive[C] = 0; riderOf[C] = -1; fric[A] = fric[B] = 0.2;
  const vC = [vx[C], vy[C], vz[C]];
  for (const [n, sg] of [[A, 1], [M1, 1], [B, -1], [M2, -1]]) { vx[n] += kx + sg * ux * sp; vy[n] += ky + 0.5 * sp + (n === A || n === B ? 0 : 0.3 * sp); vz[n] += kz + sg * uz * sp; }
  const base = riders.length, hs = [[A, M1, 1], [B, M2, -1]];
  hs.forEach(([n, n2, end], k) => {
    const l = add(n, n2, LINK, { k: 1, hid: true, stub: true, pre: 1 }); mem[l].orig = false;
    riders.push({ t: 'h', n, n2, ns: [n, n2], s, col: R.col, rgb: R.rgb, up: up.slice(), end, lks: [l], fell: R.fell, id: R.id });
    riderOf[n] = riderOf[n2] = base + k;
  });
  for (let q = 0; q < 14; q++) emit(1, mx, my + 0.3 * s, mz, rnd(-1, 1) * S.size * 0.1, rnd(0, 1) * S.size * 0.12, rnd(-1, 1) * S.size * 0.1, rnd(0.25, 0.6), 0.6);
  if (!reduce) shake = Math.max(shake, 0.4);
}

/* ===================== 2. scenes ===================== */
const P3 = Math.PI;
const PCOL = ['#C23B3B', '#2F6DB5', '#3C9D6B', '#D98A1C', '#8A55B8', '#1E8E99'];
// A box frame of columns (struts), floor beams, one diagonal beam per cell and X cables on the chosen faces.
function frame(o) {
  const nx = o.nx, nz = o.nz, bw = o.bw, bd = o.bd, ns = o.ns, sh = o.sh, G = [];
  for (let l = 0; l <= ns; l++) { G[l] = []; for (let i = 0; i <= nx; i++) { G[l][i] = []; for (let j = 0; j <= nz; j++) G[l][i][j] = node(o.x0 + i * bw, o.y0 + l * sh + (l === 0 ? 0.02 * S.u : 0), o.z0 + j * bd, o.m, !!o.pin && l === 0); } }
  const col = o.col, ts = o.ts || 1, pre = o.pre || 0.975, F = o.faces || 'fblr';
  for (let l = 0; l < ns; l++) for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) strut(G[l][i][j], G[l + 1][i][j], { ts });
  for (let l = 0; l <= ns; l++) {
    for (let i = 0; i < nx; i++) for (let j = 0; j <= nz; j++) beam(G[l][i][j], G[l][i + 1][j], { col, ts });
    for (let i = 0; i <= nx; i++) for (let j = 0; j < nz; j++) beam(G[l][i][j], G[l][i][j + 1], { col, ts });
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if ((i + j) % 2 === 0) beam(G[l][i][j], G[l][i + 1][j + 1], { col, ts: ts * 0.8 }); else beam(G[l][i + 1][j], G[l][i][j + 1], { col, ts: ts * 0.8 });
      if (l >= 1 && !o.noPanels) panel([G[l][i][j], G[l][i + 1][j], G[l][i + 1][j + 1], G[l][i][j + 1]], o.floorCol || '#BFD3EA', 0.55, { floor: true });
    }
  }
  for (let l = 0; l < ns; l++) {
    for (let i = 0; i < nx; i++) {
      if (F.includes('f')) { cable(G[l][i][0], G[l + 1][i + 1][0], { pre, ts }); cable(G[l][i + 1][0], G[l + 1][i][0], { pre, ts }); }
      if (F.includes('b')) { cable(G[l][i][nz], G[l + 1][i + 1][nz], { pre, ts }); cable(G[l][i + 1][nz], G[l + 1][i][nz], { pre, ts }); }
    }
    for (let j = 0; j < nz; j++) {
      if (F.includes('l')) { cable(G[l][0][j], G[l + 1][0][j + 1], { pre, ts }); cable(G[l][0][j + 1], G[l + 1][0][j], { pre, ts }); }
      if (F.includes('r')) { cable(G[l][nx][j], G[l + 1][nx][j + 1], { pre, ts }); cable(G[l][nx][j + 1], G[l + 1][nx][j], { pre, ts }); }
    }
  }
  return G;
}
function ring(cx, cz, y, r, n, a0, m) { const R = []; for (let i = 0; i < n; i++) { const a = a0 + TAU * i / n; R.push(node(cx + r * Math.cos(a), y, cz + r * Math.sin(a), m)); } return R; }
// stacked tensegrity prisms (n struts per level, shared rings)
function prismStack(cx, cz, y0, n, levels, r, h, o) {
  o = o || {};
  const tw = P3 / 2 + P3 / n, rings = [], a0 = o.a0 || 0;
  for (let k = 0; k <= levels; k++) rings.push(ring(cx, cz, y0 + k * h + (k === 0 ? 0.02 * S.u : 0), r * (o.taper ? 1 - o.taper * k / levels : 1), n, a0 + k * tw, o.m));
  for (let k = 0; k < levels; k++) for (let i = 0; i < n; i++) {
    strut(rings[k][i], rings[k + 1][i], { ts: o.ts });
    cable(rings[k + 1][i], rings[k + 1][(i + 1) % n], { pre: o.pre, ts: o.ts });
    cable(rings[k][i], rings[k + 1][(i + n - 1) % n], { pre: o.pre, ts: o.ts });
  }
  for (let i = 0; i < n; i++) cable(rings[0][i], rings[0][(i + 1) % n], { pre: o.pre, ts: o.ts });
  return rings;
}
function orient(pts, n, t) {
  const ax = [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]];
  const s = Math.hypot(...ax), c = n[0] * t[0] + n[1] * t[1] + n[2] * t[2];
  if (s < 1e-9) return pts;
  const k = ax.map(v => v / s), th = Math.atan2(s, c), cs = Math.cos(th), sn = Math.sin(th);
  return pts.map(p => {
    const kxp = [k[1] * p[2] - k[2] * p[1], k[2] * p[0] - k[0] * p[2], k[0] * p[1] - k[1] * p[0]], kdp = k[0] * p[0] + k[1] * p[1] + k[2] * p[2];
    return [0, 1, 2].map(i => p[i] * cs + kxp[i] * sn + k[i] * kdp * (1 - cs));
  });
}
// six-strut expanded octahedron resting on a triangle of cables; returns node ids
function sixStrut(cx, cz, sc, o) {
  o = o || {};
  const s = 0.5, N = [], st = [];
  [0, 1, 2].forEach(i => [-s, s].forEach(off => { const a = [0, 0, 0], c = [0, 0, 0], of = [0, 0, 0]; of[(i + 2) % 3] = off; a[i] = -1; c[i] = 1; N.push(a.map((v, k) => v + of[k])); N.push(c.map((v, k) => v + of[k])); st.push([N.length - 2, N.length - 1]); }));
  const partner = {}; st.forEach(([a, c]) => { partner[a] = c; partner[c] = a; });
  const seen = new Set(), cab = [], d3 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  N.forEach((p, i) => N.forEach((q, j) => { if (j <= i || j === partner[i] || Math.abs(d3(p, q) - Math.sqrt(1.5)) > 0.01) return; seen.add(i + '-' + j); cab.push([i, j]); }));
  const has = (i, j) => seen.has(Math.min(i, j) + '-' + Math.max(i, j));
  let face = null;
  for (let i = 0; i < 12 && !face; i++) for (let j = i + 1; j < 12 && !face; j++) for (let k = j + 1; k < 12 && !face; k++) if (has(i, j) && has(j, k) && has(i, k)) face = [i, j, k];
  const [A, B, C] = face.map(i => N[i]);
  const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const cen = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3];
  if (n[0] * cen[0] + n[1] * cen[1] + n[2] * cen[2] < 0) n = n.map(x => -x);
  const ln = Math.hypot(...n); n = n.map(x => x / ln);
  const R = orient(N, n, [0, -1, 0]).map(p => p.map(x => x * sc)), ymin = Math.min(...R.map(p => p[1])), y0 = (o.y || 0) + 0.02 * S.u;
  const id = R.map(p => node(cx + p[0], y0 + p[1] - ymin, cz + p[2], o.m));
  st.forEach(([a, c]) => strut(id[a], id[c], { ts: o.ts }));
  cab.forEach(([a, c]) => cable(id[a], id[c], { pre: o.pre, ts: o.ts }));
  return id;
}
// ridge tent: two poles, ridge, side ropes and guys
function ridgeTent(cx, cz, ang, sc, col) {
  const ca = Math.cos(ang), sa = Math.sin(ang), Lh = 2.4 * sc, H = 2.3 * sc, Wd = 2.1 * sc;
  const P = (u, v, y, pin, m) => node(cx + u * ca - v * sa, y, cz + u * sa + v * ca, m || 3, pin);
  const b1 = P(-Lh, 0, 0.02, false, 4), b2 = P(Lh, 0, 0.02, false, 4), t1 = P(-Lh, 0, H, false, 3), t2 = P(Lh, 0, H, false, 3);
  strut(b1, t1); strut(b2, t2); cable(t1, t2, { pre: 0.97 });
  const s1a = P(-Lh * 0.92, -Wd, 0.02, true), s1b = P(-Lh * 0.92, Wd, 0.02, true), s2a = P(Lh * 0.92, -Wd, 0.02, true), s2b = P(Lh * 0.92, Wd, 0.02, true);
  const g1 = P(-Lh - 2.3 * sc, 0, 0.02, true), g2 = P(Lh + 2.3 * sc, 0, 0.02, true);
  fab(t1, s1a, { pre: 0.96 }); fab(t1, s1b, { pre: 0.96 }); fab(t2, s2a, { pre: 0.96 }); fab(t2, s2b, { pre: 0.96 });
  cable(t1, g1, { pre: 0.95 }); cable(t2, g2, { pre: 0.95 });
  panel([t1, t2, s2a, s1a], col, 0.78); panel([t1, t2, s2b, s1b], col, 0.7);
  return { t1, t2 };
}
function bellTent(cx, cz, sc, col, n) {
  const H = 2.8 * sc, R = 2.6 * sc, b = node(cx, 0.02, cz, 4), t = node(cx, H, cz, 3);
  strut(b, t);
  const st = []; for (let i = 0; i < n; i++) { const a = TAU * i / n; st.push(node(cx + R * Math.cos(a), 0.02, cz + R * Math.sin(a), 1, true)); }
  st.forEach(s => fab(t, s, { pre: 0.955 }));
  for (let i = 0; i < n; i++) panel([t, st[i], st[(i + 1) % n]], col, 0.8);
  return t;
}

/* --- tent camp --- */
function buildTent() {
  S.m = 2; S.k = 1; S.u = 1; S.ks = 0.5;
  ridgeTent(-9, -2, 0.2, 1.0, '#E8A33D'); ridgeTent(9, 4, -0.5, 1.15, '#3BA0A5');
  const big = ridgeTent(0, -9, 0.05, 1.9, '#D9553E');
  const b1 = bellTent(-4, 6, 1.0, '#7FB069', 7), b2 = bellTent(5, -1, 1.15, '#B565A7', 8); bellTent(-12, 8, 0.9, '#E5C546', 6);
  // a flag pole in the middle, guyed, with slack bunting to three tents
  const fb = node(0, 0.02, 2, 3, true), ft = node(0, 8.5, 2, 3); strut(fb, ft, { ts: 0.7 });
  for (let i = 0; i < 4; i++) { const a = TAU * i / 4 + 0.4, st = node(5.2 * Math.cos(a), 0.02, 2 + 5.2 * Math.sin(a), 1, true); cable(ft, st, { pre: 0.96 }); }
  [b1, b2, big.t1].forEach(t => cable(ft, t, { pre: 1.05, ts: 0.5 }));
  const f1 = node(1.7, 8.1, 2, 0.4, false, { drag: 1.2 }), f2 = node(1.7, 7.2, 2, 0.4, false, { drag: 1.2 });
  fab(ft, f1, { pre: 1.0 }); fab(f1, f2, { pre: 1.0 }); fab(f2, ft, { pre: 1.0 }); panel([ft, f1, f2], '#D9553E', 0.9);
  [[-6, 2], [-2, 4], [3, 7], [14, -2], [-8, -6], [-14, 2], [-1, -3], [10, -3], [-5, 10], [1, 0]].forEach(([x, z], i) => person(x, 0, z, 1, PCOL[i % 6]));
  car(14, 0, -6, 1.1, '#C23B3B', null); car(-15, 0, -8, 1.0, '#2F6DB5', null);
  S.view = [0.5, 0.4]; S.name = 'Tent camp';
}

/* --- tensegrity tower --- */
function buildTower() {
  S.m = 3; S.k = 3; S.u = 1; S.ks = 0.6;
  const rings = prismStack(0, 0, 0, 3, 9, 1.9, 3.1, { pre: 0.97, ts: 1.3, m: 3 });
  for (let i = 0; i < 3; i++) { const a = TAU * i / 3 + 0.5, st = node(11 * Math.cos(a), 0.02, 11 * Math.sin(a), 1, true); cable(rings[7][i], st, { pre: 0.975 }); }
  const r2 = prismStack(-10, -3, 0, 3, 4, 1.3, 2.7, { pre: 0.97, ts: 1.1, m: 2.5, a0: 0.3 });
  const r3 = prismStack(10, -4, 0, 4, 5, 1.2, 2.6, { pre: 0.97, ts: 1.1, m: 2.5, a0: 0.1 });
  cable(r2[4][0], rings[4][0], { pre: 1.02, ts: 0.6 }); cable(r3[5][0], rings[5][1], { pre: 1.02, ts: 0.6 });
  for (let i = 0; i < 9; i++) { const a = TAU * i / 9, rr = 5 + (i % 3) * 1.3; person(rr * Math.cos(a), 0, rr * Math.sin(a), 1, PCOL[i % 6]); }
  car(-8, 0, 8, 1.1, '#2F6DB5', null); car(9, 0, 7, 1.0, '#D98A1C', null);
  S.view = [0.55, 0.3]; S.name = 'Tensegrity tower';
}

/* --- office building --- */
function buildOffice() {
  S.m = 6; S.k = 4; S.u = 1; S.ks = 0.5;
  frame({ x0: -5, z0: -5, nx: 2, nz: 2, bw: 5, bd: 5, y0: 0, ns: 9, sh: 3.2, m: 6, col: '#8794A8', ts: 1.1, pre: 0.98 });
  frame({ x0: 8, z0: -3, nx: 1, nz: 1, bw: 6, bd: 6, y0: 0, ns: 3, sh: 3.2, m: 5, col: '#A58E6B', ts: 1.0, floorCol: '#E5D3B0' });
  for (let l = 1; l <= 9; l++) person(-3 + (l % 3) * 3, l * 3.2 + 0.04, -3 + (l % 2) * 6, 1, PCOL[l % 6]);
  person(10, 3.24, 0, 1, PCOL[1]); person(12, 6.44, -1, 1, PCOL[3]); person(11, 9.64, 1, 1, PCOL[4]);
  person(-10, 0, 6, 1, PCOL[2]); person(2, 0, 9, 1, PCOL[5]);
  car(-4, 0, 12, 1.1, '#2F6DB5', { lim: 16, zalt: 14, ux: 1 }); car(8, 0, 14, 1.0, '#C23B3B', null);
  S.view = [0.7, 0.28]; S.name = 'Office tower';
}

/* --- suspension bridge --- */
function buildBridge() {
  S.m = 40; S.k = 1; S.u = 1.2; S.ks = 1;
  const dy = 8, hw = 2.2, xs = [], TX = 24, TH = 26;
  for (let x = -32; x <= 32; x += 4) xs.push(x);
  const D = { l: [], r: [] };
  xs.forEach(x => { const end = Math.abs(x) === 32; D.l.push(node(x, dy, -hw, 45, end)); D.r.push(node(x, dy, hw, 45, end)); });
  for (let i = 0; i < xs.length; i++) {
    beam(D.l[i], D.r[i], { col: '#6F7B8E', ts: 1.2, brk: 0.08 });
    if (i < xs.length - 1) {
      beam(D.l[i], D.l[i + 1], { col: '#6F7B8E', ts: 1.4, brk: 0.08 }); beam(D.r[i], D.r[i + 1], { col: '#6F7B8E', ts: 1.4, brk: 0.08 });
      if (i % 2) beam(D.l[i], D.r[i + 1], { col: '#6F7B8E', ts: 0.9, brk: 0.08 }); else beam(D.r[i], D.l[i + 1], { col: '#6F7B8E', ts: 0.9, brk: 0.08 });
      panel([D.l[i], D.l[i + 1], D.r[i + 1], D.r[i]], '#9AA7BB', 0.85, { floor: true });
    }
  }
  const tops = {};
  [-TX, TX].forEach(x => {
    const bl = node(x, 0.02, -hw - 1.4, 30, true), br = node(x, 0.02, hw + 1.4, 30, true), tl = node(x, TH, -hw - 0.3, 30), tr = node(x, TH, hw + 0.3, 30);
    strut(bl, tl, { ts: 2.6, k: 30 }); strut(br, tr, { ts: 2.6, k: 30 }); strut(tl, tr, { ts: 2, k: 30 });
    cable(bl, tr, { ts: 1.4, k: 20 }); cable(br, tl, { ts: 1.4, k: 20 });
    tops[x] = [tl, tr];
  });
  [0, 1].forEach(sd => {
    const z = (sd ? 1 : -1) * hw, tl = tops[-TX][sd], tr = tops[TX][sd];
    const topY = x => { const u = x / TX; return TH - (TH - (dy + 3.2)) * (1 - u * u); };
    const st = []; for (let x = -TX + 4; x <= TX - 4; x += 4) st.push(node(x, topY(x), z, 8));
    const chain = [tl, ...st, tr];
    for (let i = 0; i < chain.length - 1; i++) cable(chain[i], chain[i + 1], { pre: 0.998, k: 120, ts: 1.7 });
    st.forEach(n => { const i = xs.indexOf(Math.round(px[n])); cable(n, sd ? D.r[i] : D.l[i], { pre: 0.992, k: 40, ts: 0.8 }); });
    [-1, 1].forEach(tsd => {
      const tn = tsd < 0 ? tl : tr, y0 = py[tn], anc = node(tsd * 40, 0.5, z * 1.7, 1, true);
      const stn = [4, 8, 12].map(d => node(tsd * (TX + d), y0 + (0.5 - y0) * d / 16, z * (1 + 0.04 * d), 8));
      const ch = [tn, ...stn, anc];
      for (let i = 0; i < ch.length - 1; i++) cable(ch[i], ch[i + 1], { pre: 0.998, k: 120, ts: 1.7 });
      [4, 8].forEach((d, k) => { const i = xs.indexOf(tsd * (TX + d)); cable(stn[k], sd ? D.r[i] : D.l[i], { pre: 0.992, k: 40, ts: 0.8 }); });
    });
  });
  for (let i = 0; i < xs.length - 1; i++) { cable(D.l[i], D.r[i + 1], { pre: 0.985, k: 3, ts: 0.5 }); cable(D.r[i], D.l[i + 1], { pre: 0.985, k: 3, ts: 0.5 }); }
  [[-18, 1], [-4, 1], [12, 1], [-24, -1], [6, -1], [20, -1]].forEach(([x, dir], i) => car(x, dy + 0.1, dir * 0.9, 1.0, PCOL[i % 6], { ux: dir, lim: 27, zalt: -dir * 0.9 }));
  [-10, -2, 8, 16, -26, 14].forEach((x, i) => person(x, dy + 0.1, (i % 2 ? -1 : 1) * 1.9, 0.8, PCOL[(i + 2) % 6]));
  person(-12, 0, 9, 1, PCOL[1]); person(10, 0, -8, 1, PCOL[4]); car(-14, 0, 12, 1.1, '#2F6DB5', null);
  S.view = [0.35, 0.22]; S.name = 'Suspension bridge';
}

/* --- village --- */
function house(cx, cz, ang, sc, wall, roof) {
  const ca = Math.cos(ang), sa = Math.sin(ang), w = 4.2 * sc, d = 3.4 * sc, h = 2.6 * sc, rh = 1.5 * sc;
  const P = (u, v, y, m) => node(cx + u * ca - v * sa, y, cz + u * sa + v * ca, m || 3);
  const base = [P(-w / 2, -d / 2, 0.02), P(w / 2, -d / 2, 0.02), P(w / 2, d / 2, 0.02), P(-w / 2, d / 2, 0.02)];
  const eave = [P(-w / 2, -d / 2, h), P(w / 2, -d / 2, h), P(w / 2, d / 2, h), P(-w / 2, d / 2, h)];
  const r1 = P(-w / 2, 0, h + rh, 2), r2 = P(w / 2, 0, h + rh, 2);
  for (let i = 0; i < 4; i++) { strut(base[i], eave[i], { ts: 0.8 }); beam(base[i], base[(i + 1) % 4], { col: '#7A5C3E', ts: 0.8 }); beam(eave[i], eave[(i + 1) % 4], { col: '#7A5C3E', ts: 0.8 }); }
  beam(base[0], base[2], { col: '#7A5C3E', ts: 0.6 }); beam(eave[0], eave[2], { col: '#7A5C3E', ts: 0.6 });
  beam(r1, eave[0], { col: '#6B4A2E', ts: 0.8 }); beam(r1, eave[3], { col: '#6B4A2E', ts: 0.8 }); beam(r2, eave[1], { col: '#6B4A2E', ts: 0.8 }); beam(r2, eave[2], { col: '#6B4A2E', ts: 0.8 });
  beam(r1, r2, { col: '#6B4A2E', ts: 0.9 });
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; cable(base[i], eave[j], { pre: 0.98, ts: 0.6 }); cable(base[j], eave[i], { pre: 0.98, ts: 0.6 }); panel([base[i], base[j], eave[j], eave[i]], wall, 0.55); }
  panel([eave[0], eave[1], r2, r1], roof, 0.9); panel([eave[3], eave[2], r2, r1], roof, 0.9);
  panel([eave[0], eave[3], r1], wall, 0.7); panel([eave[1], eave[2], r2], wall, 0.7);
}
function buildVillage() {
  S.m = 3; S.k = 2; S.u = 1; S.ks = 0.7;
  house(-10, -2, 0.1, 1.0, '#F1D9B5', '#B5533C'); house(-3, -9, -0.2, 1.2, '#CFE3D0', '#4F6D8F');
  house(4, 0, 0.35, 1.05, '#F4E3C2', '#8A3B2F'); house(-4, 6, 0.0, 1.35, '#E6D3EE', '#5E4B85'); house(10, 8, -0.4, 0.9, '#D8E8F2', '#3F6E5B');
  // treehouse
  const tx = 13, tz = -7, tr = [], T = 1.4;
  for (let l = 0; l < 4; l++) { const r = (1.1 - l * 0.14) * T; tr.push(ring(tx, tz, l * 2 * T + (l ? 0 : 0.02), r, 3, l * 0.5, 4)); }
  tr[0].forEach(n => { pinned[n] = 1; wI[n] = 0; pins.push(n); });
  for (let l = 0; l < 3; l++) for (let i = 0; i < 3; i++) {
    beam(tr[l][i], tr[l + 1][i], { col: '#5B3E24', ts: 1.9, k: 4 }); beam(tr[l + 1][i], tr[l + 1][(i + 1) % 3], { col: '#5B3E24', ts: 1.5, k: 4 }); beam(tr[l][i], tr[l + 1][(i + 1) % 3], { col: '#5B3E24', ts: 1.2, k: 4 });
  }
  const top = tr[3], tips = [];
  for (let i = 0; i < 3; i++) { const a = TAU * i / 3 + 1.0; tips.push(node(tx + 3.6 * T * Math.cos(a), 8.4 * T, tz + 3.6 * T * Math.sin(a), 2.5)); }
  tips.forEach((t, i) => { beam(top[i], t, { col: '#5B3E24', ts: 1.4, k: 4 }); cable(t, top[(i + 1) % 3], { pre: 0.99 }); cable(t, top[(i + 2) % 3], { pre: 0.99 }); fab(t, tips[(i + 1) % 3], { pre: 1.0 }); });
  panel(tips, '#5FA05B', 0.55);
  for (let i = 0; i < 3; i++) panel([tips[i], tips[(i + 1) % 3], top[(i + 1) % 3], top[i]], '#6DB36A', 0.45);
  const pl = [0, 1, 2].map(i => { const a = TAU * i / 3 + 1; return node(tx + 1.7 * T * Math.cos(a), 4.6 * T, tz + 1.7 * T * Math.sin(a), 3); });
  pl.forEach((p, i) => { beam(p, pl[(i + 1) % 3], { col: '#8A5A2B', ts: 1.2 }); cable(p, tips[i], { pre: 1.0, ts: 0.9 }); cable(p, tips[(i + 1) % 3], { pre: 1.01, ts: 0.7 }); });
  panel(pl, '#C9A36A', 0.85, { floor: true });
  const rf = pl.map(p => node(px[p], 6.4 * T, pz[p], 2));
  pl.forEach((p, i) => { strut(p, rf[i], { ts: 0.6 }); beam(rf[i], rf[(i + 1) % 3], { col: '#8A5A2B', ts: 1 }); cable(p, rf[(i + 1) % 3], { pre: 0.995, ts: 0.5 }); cable(pl[(i + 1) % 3], rf[i], { pre: 0.995, ts: 0.5 }); });
  const apex = node(tx, 7.4 * T, tz, 1.5); rf.forEach(r => beam(r, apex, { col: '#8A3B2F', ts: 0.8 })); for (let i = 0; i < 3; i++) panel([rf[i], rf[(i + 1) % 3], apex], '#B5533C', 0.9);
  person(tx + 0.3, 4.62 * T, tz, 0.5, PCOL[3]);
  // hot-air balloon, tethered: a compression ring, hot-air pressure and a basket on cables
  const bx = -14, bz = -9, by = 7, nR = 8, PR = 3;
  const bk = [[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7]].map(([x, z]) => node(bx + x, by, bz + z, 3));
  for (let i = 0; i < 4; i++) beam(bk[i], bk[(i + 1) % 4], { col: '#8A5A2B', ts: 1 }); beam(bk[0], bk[2], { col: '#8A5A2B', ts: 0.8 });
  panel(bk, '#C9A36A', 0.9, { floor: true });
  const E = { infl: PR, ax: bx, az: bz }, mk2 = (y, r, n, a0, m, inf) => { const R = []; for (let i = 0; i < n; i++) { const a = a0 + TAU * i / n; R.push(node(bx + r * Math.cos(a), y, bz + r * Math.sin(a), m, false, inf ? E : null)); } return R; };
  const thr = mk2(by + 2.8, 0.9, 4, 0.78, 0.4, false), B2 = mk2(by + 5.8, 2.7, nR, 0, 0.5, true), eq = mk2(by + 8.6, 3.8, nR, 0, 0.5, false), A2 = mk2(by + 11.2, 2.6, nR, 0, 0.5, true);
  const hub = node(bx, by + 8.6, bz, 0.4), apx = node(bx, by + 13.2, bz, 0.4);
  const envNodes = [...thr, ...B2, ...eq, ...A2, hub, apx];
  for (let i = 0; i < nR; i++) {
    const j = (i + 1) % nR;
    strut(eq[i], eq[j], { ts: 0.8 }); cable(hub, eq[i], { pre: 0.99, ts: 0.5 }); cable(apx, A2[i], { pre: 0.99, ts: 0.7 }); cable(A2[i], eq[i], { pre: 0.99, ts: 0.7 }); cable(eq[i], B2[i], { pre: 0.99, ts: 0.7 }); cable(B2[i], thr[Math.floor(i / 2)], { pre: 0.99, ts: 0.7 });
    cable(A2[i], A2[j], { pre: 0.99, ts: 0.5 }); cable(B2[i], B2[j], { pre: 0.99, ts: 0.5 });
  }
  for (let i = 0; i < nR; i++) {
    const j = (i + 1) % nR, c = i % 2 ? '#E0523F' : '#F3C13A';
    panel([apx, A2[i], A2[j]], c, 0.9); panel([A2[i], A2[j], eq[j], eq[i]], c, 0.9); panel([eq[i], eq[j], B2[j], B2[i]], c, 0.9); panel([B2[i], B2[j], thr[Math.floor(j / 2) % 4], thr[Math.floor(i / 2)]], c, 0.9);
  }
  for (let i = 0; i < 4; i++) { cable(thr[i], thr[(i + 1) % 4], { pre: 0.98 }); cable(thr[i], bk[i], { pre: 0.995, ts: 0.8 }); cable(thr[i], bk[(i + 1) % 4], { pre: 0.995, ts: 0.6 }); cable(hub, thr[i], { pre: 0.99, ts: 0.5 }); }
  let Me = 0, Mb = 0; envNodes.forEach(n => Me += 1 / wI[n]); bk.forEach(n => Mb += 1 / wI[n]); Mb += 1;
  const up = (9.81 * (Me + Mb) + 0.4 * 9.81 * Mb) / Me;
  envNodes.forEach(n => { lift[n] = up; drg[n] = 0.9; });
  [0, 1].forEach(k => { const st = node(bx + (k ? 6 : -6), 0.02, bz + (k ? 3 : -3), 1, true); cable(bk[k ? 2 : 0], st, { pre: 1.0, ts: 0.9, k: 3 }); });
  person(bx, by + 0.04, bz, 0.5, PCOL[0]);
  // road with cars
  car(-6, 0, 14, 1.1, '#2F6DB5', { ux: 1, lim: 18, zalt: 16 }); car(8, 0, 16, 1.0, '#C23B3B', { ux: -1, lim: 18, zalt: 14 }); car(0, 0, 14, 0.9, '#D98A1C', { ux: 1, lim: 18, zalt: 16 });
  [[-7, 3], [1, -4], [7, 5], [-1, 1], [0, 10], [-13, 2], [14, 2]].forEach(([x, z], i) => person(x, 0, z, 1, PCOL[i % 6]));
  S.view = [0.55, 0.38]; S.name = 'Village';
}

/* --- market hall with a cable-net roof --- */
function buildMall() {
  S.m = 4; S.k = 3; S.u = 1; S.ks = 1;
  const nx = 6, nz = 4, bw = 6, bd = 6, hi = 10, lo = 5.2, G = [];
  for (let i = 0; i <= nx; i++) { G[i] = []; for (let j = 0; j <= nz; j++) {
    const high = (i + j) % 2 === 0, x = -nx * bw / 2 + i * bw, z = -nz * bd / 2 + j * bd;
    G[i][j] = node(x, high ? hi : lo, z, 6);
    if (high) { const b = node(x, 0.02, z, 6, true); strut(b, G[i][j], { ts: 1.5 }); }
    else { const st = node(x, 0.02, z, 1, true); cable(G[i][j], st, { pre: 0.96, ts: 1.1 }); }
  } }
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
    if (i < nx) cable(G[i][j], G[i + 1][j], { pre: 0.97, ts: 0.9 }); if (j < nz) cable(G[i][j], G[i][j + 1], { pre: 0.97, ts: 0.9 });
    const edge = i === 0 || i === nx || j === 0 || j === nz;
    if (edge && (i + j) % 2 === 0) {
      const dx = i === 0 ? -1 : i === nx ? 1 : 0, dz = j === 0 ? -1 : j === nz ? 1 : 0;
      const st = node(px[G[i][j]] + dx * 5, 0.02, pz[G[i][j]] + dz * 5, 1, true); cable(G[i][j], st, { pre: 0.96, ts: 1.0 });
      if (dx && dz) { const s2 = node(px[G[i][j]] + dx * 6, 0.02, pz[G[i][j]], 1, true), s3 = node(px[G[i][j]], 0.02, pz[G[i][j]] + dz * 6, 1, true); cable(G[i][j], s2, { pre: 0.96 }); cable(G[i][j], s3, { pre: 0.96 }); }
    }
  }
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) panel([G[i][j], G[i + 1][j], G[i + 1][j + 1], G[i][j + 1]], (i + j) % 2 ? '#F5F1E6' : '#8FC3C7', 0.62);
  [[-9, -3], [0, -3], [9, -3], [-9, 3.5], [0, 3.5], [9, 3.5]].forEach(([x, z], i) => {
    const t = frame({ x0: x - 1.4, z0: z - 0.7, nx: 1, nz: 1, bw: 2.8, bd: 1.4, ns: 1, sh: 1.1, y0: 0, m: 2, col: ['#B5533C', '#3F6E5B', '#C79A3A'][i % 3], ts: 0.7, faces: 'fblr', floorCol: ['#E3A18F', '#9CC4B2', '#E6CB86'][i % 3] });
    person(x - 0.6, 1.12, z, 0.5, PCOL[i % 6]);
  });
  [[-14, 0], [-5, 9], [4, -9], [14, 1], [-1, 0], [6, 9], [-12, -9], [11, -8], [0, -7], [-6, -6]].forEach(([x, z], i) => person(x, 0, z, 1, PCOL[(i + 3) % 6]));
  car(-12, 0, 18, 1.1, '#C23B3B', { ux: 1, lim: 20, zalt: 20 }); car(10, 0, 20, 1.0, '#2F6DB5', { ux: -1, lim: 20, zalt: 18 });
  S.view = [0.55, 0.36]; S.name = 'Market hall';
}

/* --- smash room --- */
function buildRoom() {
  S.m = 2; S.k = 0.5; S.u = 0.25; S.ks = 0.6;
  const G = frame({ x0: -4.5, z0: -2.6, nx: 3, nz: 1, bw: 3, bd: 5.2, y0: 0, ns: 1, sh: 3.6, m: 4, col: '#7C8CA3', ts: 0.8, noPanels: true, pre: 0.985, faces: 'blr' });
  S.k = 0.35;
  [0, 1, 2].forEach(i => {
    const lx = -3 + i * 3, lamp = node(lx, 2.2, 0, 1.2, false, { glow: 1 });
    [[i, 0], [i + 1, 0], [i, 1], [i + 1, 1]].forEach(([a, b]) => cable(lamp, G[1][a][b], { pre: 0.985, ts: 0.5 }));
  });
  frame({ x0: -1.5, z0: -0.7, nx: 1, nz: 1, bw: 3, bd: 1.4, ns: 1, sh: 1.0, y0: 0, m: 1.5, col: '#B88A55', ts: 0.55, faces: 'fblr', floorCol: '#E0C79C', pre: 0.985 });
  S.k = 0.5;
  sixStrut(-0.6, 0, 0.2, { y: 1.0, m: 0.4 }); prismStack(0.8, 0, 1.0, 3, 1, 0.2, 0.34, { m: 0.25, pre: 0.97 });
  person(-1.1, 1.02, -0.2, 0.17, PCOL[2]); car(0.1, 1.02, 0.35, 0.12, '#D98A1C', null);
  const shelf = (x0, a, b) => {
    frame({ x0, z0: -2.4, nx: 1, nz: 1, bw: 1.8, bd: 0.8, ns: 3, sh: 0.75, y0: 0, m: 1.2, col: '#9B7B52', ts: 0.5, faces: 'blr', floorCol: '#D9C09A', pre: 0.985 });
    sixStrut(x0 + 0.9, -2.0, 0.14, { y: 0.75, m: 0.3 }); prismStack(x0 + 0.9, -2.0, 1.5, a, 1, 0.22, 0.4, { m: 0.2, pre: 0.97 }); person(x0 + 1.2, 2.27, -2.0, 0.17, PCOL[b]);
  };
  shelf(-4.4, 3, 1); shelf(2.6, 4, 4);
  sixStrut(-3.0, 1.1, 0.75, { m: 2 }); sixStrut(3.4, 1.0, 0.6, { m: 1.5 });
  prismStack(-1.6, -1.5, 0, 4, 3, 0.5, 0.8, { m: 1, pre: 0.97 }); prismStack(1.8, 1.4, 0, 5, 2, 0.4, 0.6, { m: 0.8, pre: 0.97 });
  [[-4, 1.9], [-2, 2.0], [2.5, -1.4], [4, 0.2], [-4.1, -0.4]].forEach(([x, z], i) => person(x, 0, z, 0.22, PCOL[(i + 1) % 6]));
  car(-0.5, 0, -2.0, 0.2, '#C23B3B', null); car(1.0, 0, 2.1, 0.18, '#2F6DB5', { ux: 1, lim: 4, zalt: 1.6 });
  S.view = [0.45, 0.3]; S.name = 'Smash room';
}

/* --- stick-figure human: stacked tensegrity prisms for legs, torso, neck, head and arms --- */
function buildHuman() {
  S.m = 3; S.k = 16; S.u = 1; S.ks = 1; const K = 4.2, n = 3, tw = P3 / 2 + P3 / n;
  const rg = (c, y, r, a) => { const R = []; for (let i = 0; i < n; i++) { const t = a + TAU * i / n; R.push(node(c[0] * K + r * K * Math.cos(t), y * K, c[1] * K + r * K * Math.sin(t), 3)); } return R; };
  const link = (r0, r1, first, o) => {
    for (let i = 0; i < n; i++) {
      strut(r0[i], r1[i], { ts: 1.4 });
      const e = [r1[i], r1[(i + 1) % n]]; if (memBetween(e[0], e[1]) < 0) cable(e[0], e[1], { pre: 0.97, ts: 0.9 });
      const d = [r0[i], r1[(i + n - 1) % n]]; if (memBetween(d[0], d[1]) < 0) cable(d[0], d[1], { pre: 0.97, ts: 0.9 });
    }
    if (first) for (let i = 0; i < n; i++) if (memBetween(r0[i], r0[(i + 1) % n]) < 0) cable(r0[i], r0[(i + 1) % n], { pre: 0.97, ts: 0.9 });
  };
  const hipY = 0.92, a0 = 0.3, hip = rg([0, 0], hipY, 0.16, a0 + 2 * tw);
  [-1, 1].forEach(sd => {
    let prev = null;
    for (let k = 0; k <= 2; k++) {
      const t = k / 2, cx = sd * 0.2 * (1 - t), y = k === 2 ? hipY : 0.01 + hipY * t;
      const rr = k === 2 ? hip : rg([cx, 0], y, 0.16, a0 + k * tw);
      if (prev) link(prev, rr, k === 1); prev = rr;
    }
  });
  let prev = hip; const ys = [0.92, 1.19, 1.46, 1.62, 1.84], rs = [0.16, 0.17, 0.2, 0.09, 0.12];
  for (let k = 1; k < ys.length; k++) { const rr = rg([0, 0], ys[k], rs[k], a0 + 2 * tw + k * tw); link(prev, rr, false); prev = rr; }
  [-1, 1].forEach(sd => {
    let ap = null;
    for (let k = 0; k <= 2; k++) { const rr = rg([sd * 0.42, 0], 1.4 - k * 0.3, 0.075, a0 + k * tw); if (ap) link(ap, rr, k === 1); ap = rr; }
  });
  const chest = [];
  for (let mi = 0; mi < nN; mi++) if (Math.abs(py[mi] - 1.46 * K) < 1e-6 && Math.abs(px[mi]) < 0.3 * K) chest.push(mi);
  for (let mi = 0; mi < nN; mi++) if (Math.abs(py[mi] - 1.4 * K) < 1e-6 && Math.abs(px[mi]) > 0.3 * K) { chest.slice().sort((a, b) => dist(a, mi) - dist(b, mi)).slice(0, 2).forEach(c => cable(mi, c, { pre: 1.0, ts: 0.8 })); }
  [[-4, 2], [5, 4], [-5, -3], [4, -4]].forEach(([x, z], i) => person(x, 0, z, 1, PCOL[i + 1]));
  car(-7, 0, 5, 1.1, '#C23B3B', null);
  S.view = [0.35, 0.18]; S.name = 'Stick-figure human';
}

// a few riders always stand along the line where the ground can split, so the rift has something to swallow
function riftRiders(sc) {
  let zm = 0; for (let i = 0; i < nN; i++) if (!isRider[i] && Math.abs(px[i]) < 3.5 * sc) zm = Math.min(zm, pz[i]);
  const z = zm - 3.4 * sc;
  person(0.05 * sc, 0, z, sc, PCOL[2]); person(-0.1 * sc, 0, z - 1.8 * sc, sc, PCOL[4]); car(0, 0, z - 4.6 * sc, 1.0 * sc, '#D98A1C', null, true);
}
const SCENES = [
  { id: 'tent', name: 'Tent camp', build: buildTent },
  { id: 'tower', name: 'Tensegrity tower', build: buildTower },
  { id: 'office', name: 'Office tower', build: buildOffice },
  { id: 'bridge', name: 'Suspension bridge', build: buildBridge },
  { id: 'village', name: 'Village', build: buildVillage },
  { id: 'mall', name: 'Market hall', build: buildMall },
  { id: 'room', name: 'Smash room', build: buildRoom, rs: 0.2 },
  { id: 'human', name: 'Stick-figure human', build: buildHuman }];

/* ===================== 3. physics ===================== */
let grav = 9.81, simT = 0, grace = false;
const VMAX = 38;
const Q = { kind: null, t: 0, dur: 0, amp: 0, env: 0, ox: 0, oy: 0, oz: 0 };
const rift = { gap: 0, speed: 0, max: 0 };
let tornadoes = [], gust = null, grab = null;
const cnt = { cut: 0, broke: 0, burnt: 0, alive: 0, total: 0, peak: 0 };
const FR = { sub: 10, ms: 0 };

function groundY(x, r) {
  if (rift.gap > 0 && Math.abs(x) < rift.gap / 2 - 0.35 * (r || 0)) return -S.pit;
  if (Q.kind === 'up') return Q.oy;
  if (Q.kind === 'roll') return Q.amp * 0.8 * Q.env * Math.sin(Q.k * x - Q.w * Q.t);
  return 0;
}
function quakeStep(h) {
  if (!Q.kind) return;
  Q.t += h;
  if (Q.t > Q.dur) { Q.kind = null; Q.ox = Q.oy = Q.oz = 0; Q.env = 0; return; }
  Q.env = Math.min(1, Q.t / 0.5) * Math.min(1, (Q.dur - Q.t) / 1.2);
  Q.px = Q.ox; Q.pz = Q.oz;
  if (Q.kind === 'side') { Q.ox = Q.amp * Q.env * Math.sin(TAU * 1.9 * Q.t); Q.oz = 0.4 * Q.amp * Q.env * Math.sin(TAU * 2.1 * Q.t + 1); }
  else if (Q.kind === 'up') Q.oy = 0.85 * Q.amp * Q.env * Math.sin(TAU * 2.3 * Q.t);
  else if (Q.kind === 'rift') { if (rift.gap < rift.max) rift.gap = Math.min(rift.max, rift.gap + rift.speed * h * Math.min(1, Q.t / 0.8)); }
}
function startQuake(kind) {
  const size = S.size, amp = clamp(0.032 * size, 0.16, 0.75);
  if (kind === 'rift') { if (rift.gap > 0) return; Q.kind = 'rift'; Q.t = 0; Q.dur = 6; Q.amp = amp; rift.max = clamp(0.2 * size, 1.2, 9); rift.speed = rift.max / 3.2; }
  else { Q.kind = kind; Q.t = 0; Q.dur = kind === 'roll' ? 7 : 5.5; Q.amp = amp * (kind === 'roll' ? 1.2 : 1); Q.k = TAU / (0.55 * size + 1); Q.w = TAU * 0.9; }
  Q.ox = Q.oy = Q.oz = Q.px = Q.pz = 0; Q.env = 0;
  shake = reduce ? 0 : 1;
}
function windVel(i) { return 0; }

function killMem(mi, how) {
  const m = mem[mi]; if (!m.alive) return;
  m.alive = false; m.burn = -2;
  if (m.orig) {
    cnt.alive--;
    if (how === 'burn') cnt.burnt++; else if (m.kind >= CABLE) cnt.cut++; else cnt.broke++;
  }
  [m.a, m.b].forEach(n => { if (--deg[n] <= 0 && !pinned[n] && !isRider[n]) alive[n] = 0; });
}
function killNode(i) { alive[i] = 0; adj[i].forEach(mi => { if (mem[mi].alive) { const was = mem[mi].orig; mem[mi].orig = false; if (was) cnt.alive--; killMem(mi, 'x'); } }); if (isRider[i]) { const k = riderOf[i]; if (k >= 0) riders[k].dead = true; } }
// slice a member at fraction t: both halves remain as free-ended stubs
function sliceMem(mi, t, dirx, diry, dirz) {
  const m = mem[mi]; if (!m.alive || m.kind === LINK) return;
  const a = m.a, b = m.b, ex = px[a] + (px[b] - px[a]) * t, ey = py[a] + (py[b] - py[a]) * t, ez = pz[a] + (pz[b] - pz[a]) * t;
  killMem(mi, 'cut');
  if (nN + 2 < NMAX && mem.length + 2 < MMAX) {
    const mm = 0.5 / ((wI[a] || 0.4) + (wI[b] || 0.4)) + 0.1, n1 = node(ex, ey, ez, mm), n2 = node(ex, ey, ez, mm), s = S.size * 0.01;
    for (const n of [n1, n2]) { vx[n] = lerp(vx[a], vx[b], t); vy[n] = lerp(vy[a], vy[b], t); vz[n] = lerp(vz[a], vz[b], t); }
    vx[n1] += dirx * s; vy[n1] += diry * s; vz[n1] += dirz * s; vx[n2] -= dirx * s; vy[n2] -= diry * s; vz[n2] -= dirz * s;
    const ea = m.rest / m.al;
    [[a, n1, t], [n2, b, 1 - t]].forEach(([p, q, f]) => {
      const L = dist(p, q), o = { kind: m.kind, a: p, b: q, L0: L, rest: m.rest * f, al: m.rest * f / ea, brk: m.brk * 1.6, alive: true, burn: -1, dur: 0, lam: 0, T: 0, st: 0, col: m.col, th: m.th, orig: false, stub: true, hid: false };
      mem.push(o); const id = mem.length - 1; adj[p].push(id); adj[q].push(id); deg[p]++; deg[q]++;
    });
  }
  for (let q = 0; q < 5; q++) emit(1, ex, ey, ez, rnd(-1, 1) * S.size * 0.1, rnd(0, 1) * S.size * 0.12, rnd(-1, 1) * S.size * 0.1, rnd(0.25, 0.5), 0.5);
}
function ignite(mi) {
  const m = mem[mi]; if (!m.alive || m.burn >= 0 || m.kind === LINK) return false;
  m.burn = 0; m.dur = KD[m.kind].burn * rnd(0.7, 1.25); burning.push(mi); return true;
}

/* ---- the step ---- */
function anchorStep() {
  for (let k = 0; k < pins.length; k++) {
    const i = pins[k]; if (!alive[i]) continue;
    let x = ax0[i] + Q.ox, y = ay0[i] + (Q.kind === 'up' ? Q.oy : 0), z = az0[i] + Q.oz;
    if (Q.kind === 'roll') y += Q.amp * 0.8 * Q.env * Math.sin(Q.k * ax0[i] - Q.w * Q.t);
    if (rift.gap > 0) x += (ax0[i] < 0 ? -1 : 1) * rift.gap / 2;
    px[i] = x; py[i] = y; pz[i] = z;
  }
}
function substep(h) {
  quakeStep(h);
  const g = grav, dmp = 1 - (grace ? 5 : 0.28) * h, ih = 1 / h, groundMove = Q.kind === 'side' ? Q.ox - (Q.px || 0) : 0, groundMoveZ = Q.kind === 'side' ? Q.oz - (Q.pz || 0) : 0;
  const riftDrag = rift.gap > 0 && rift.gap < rift.max && Q.kind === 'rift' ? rift.speed * h * Math.min(1, Q.t / 0.8) / 2 : 0;
  const gs = gust ? gust.env * gust.peak : 0;
  for (let i = 0; i < nN; i++) {
    if (!alive[i] || pinned[i]) continue;
    qx[i] = px[i]; qy[i] = py[i]; qz[i] = pz[i];
    let ay = -g + lift[i], ax = 0, az = 0;
    if (grab && grab.i === i) {
      const kx = 420, c = 41; ax = kx * (grab.x - px[i]) - c * vx[i]; ay += kx * (grab.y - py[i]) - c * vy[i]; az = kx * (grab.z - pz[i]) - c * vz[i];
      const am = Math.hypot(ax, ay, az), lim = 900; if (am > lim) { ax *= lim / am; ay *= lim / am; az *= lim / am; }
    }
    vx[i] += ax * h; vy[i] += ay * h; vz[i] += az * h;
    if (infl[i]) { const rx = px[i] - axX[i], rz = pz[i] - axZ[i], rl = Math.hypot(rx, rz) + 1e-6; vx[i] += rx / rl * infl[i] * h; vz[i] += rz / rl * infl[i] * h; }
    if (gs) { const k = Math.min(1, drg[i] * 2.4 * h * (1 + 0.5 * Math.sin(simT * 7 + i))); vx[i] += (gust.dx * gs - vx[i]) * k; vz[i] += (gust.dz * gs - vz[i]) * k; vy[i] += (gust.dy * gs - vy[i]) * k * 0.3; }
    for (let t = 0; t < tornadoes.length; t++) {
      const T = tornadoes[t], dx = px[i] - T.x - Math.sin(py[i] * 0.07 + T.ph) * T.r * 0.35 * Math.min(1, py[i] / T.h), dz = pz[i] - T.z, d = Math.hypot(dx, dz), Rf = T.r * (1 + py[i] / T.h * 1.4), Rm = Rf * 2.6;
      if (d > Rm || py[i] > T.h * 1.6) continue;
      const inf = (1 - d / Rm) * T.fade, dd = d + 1e-6, tx = -dz / dd, tz = dx / dd, k = Math.min(1, 4 * h * (0.3 + inf) * (isRider[i] === 1 ? 2.8 : isRider[i] === 2 ? 1.9 : 1));
      const tx0 = tx * T.v * Math.min(1, d / Rf + 0.35) - dx / dd * T.v * 0.45 * inf, tz0 = tz * T.v * Math.min(1, d / Rf + 0.35) - dz / dd * T.v * 0.45 * inf;
      vx[i] += (tx0 * inf - vx[i] * inf) * k; vz[i] += (tz0 * inf - vz[i] * inf) * k; vy[i] += (T.up * inf * (isRider[i] ? 1.1 : 1) - vy[i] * inf * 0.5) * k + T.up * 0.12 * inf * h;
    }
    vx[i] *= dmp; vy[i] *= dmp; vz[i] *= dmp;
    const sp = Math.hypot(vx[i], vy[i], vz[i]); if (sp > VMAX) { const f = VMAX / sp; vx[i] *= f; vy[i] *= f; vz[i] *= f; }
    px[i] += vx[i] * h; py[i] += vy[i] * h; pz[i] += vz[i] * h;
  }
  anchorStep();
  for (let mi = 0; mi < mem.length; mi++) mem[mi].lam = 0;
  for (let it = 0; it < 2; it++) {
    for (let mi = 0; mi < mem.length; mi++) {
      const m = mem[mi]; if (!m.alive) continue;
      const a = m.a, b = m.b;
      let dx = px[a] - px[b], dy = py[a] - py[b], dz = pz[a] - pz[b];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz); if (len < 1e-9) continue;
      const C = len - m.rest, cabl = m.kind >= CABLE && m.kind !== LINK;
      if (cabl && C <= 0 && m.lam === 0) continue;
      const ws = wI[a] + wI[b]; if (ws === 0) continue;
      const at = m.al / (h * h);
      let dl = (-C - at * m.lam) / (ws + at);
      if (cabl && m.lam + dl > 0) dl = -m.lam;
      m.lam += dl;
      const s = dl / len;
      px[a] += wI[a] * s * dx; py[a] += wI[a] * s * dy; pz[a] += wI[a] * s * dz;
      px[b] -= wI[b] * s * dx; py[b] -= wI[b] * s * dy; pz[b] -= wI[b] * s * dz;
    }
  }
  for (let k = 0; k < upList.length; k++) { const R = upList[k]; if (!alive[R.n] || !alive[R.h]) continue; px[R.h] += (px[R.n] - px[R.h]) * 0.5; pz[R.h] += (pz[R.n] - pz[R.h]) * 0.5; }
  if (riders.length) { collidePanels(h); collideRiders(h); }
  if (balls.length) collideBalls(h);
  // ground
  for (let i = 0; i < nN; i++) {
    if (!alive[i] || pinned[i]) { continue; }
    const r = nr[i]; let gy = groundY(px[i], r), c = 0;
    if (rift.gap > 0) {
      const hg = rift.gap / 2 - 0.35 * r, x = px[i];
      if (Math.abs(x) >= hg && py[i] < gy - 0.05 * S.u && py[i] > -S.pit - 2) { px[i] = x < 0 ? -Math.max(0, hg - 0.02) : Math.max(0, hg - 0.02); gy = -S.pit; }
    }
    if (py[i] < gy + r) { py[i] = gy + r; c = 1; if (groundMove) { px[i] += groundMove * 0.85; pz[i] += groundMoveZ * 0.85; } if (riftDrag) px[i] += (px[i] < 0 ? -1 : 1) * riftDrag * (isRider[i] ? 0 : 0.9); }
    if (c && Math.abs(px[i]) < rift.gap / 2 + 1 && rift.gap > 0 && py[i] > -1) { /* standing near the lip */ }
    cont[i] = c || cont[i];
  }
  // velocity from positions, friction, clamps and sanity
  const damp = 1;
  for (let i = 0; i < nN; i++) {
    if (!alive[i] || pinned[i]) continue;
    let x = px[i], y = py[i], z = pz[i];
    if (x !== x || y !== y || z !== z || y < -S.pit - 6 || y > 900 + S.size * 8 || Math.abs(x) > 400 + S.size * 8 || Math.abs(z) > 400 + S.size * 8) { killNode(i); continue; }
    vx[i] = (x - qx[i]) * ih; vy[i] = (y - qy[i]) * ih; vz[i] = (z - qz[i]) * ih;
    if (cont[i]) {
      if (chx[i] !== 0 || chz[i] !== 0) { const hx = chx[i], hz = chz[i], vf = vx[i] * hx + vz[i] * hz, lx = vx[i] - vf * hx, lz = vz[i] - vf * hz; vx[i] = vf * 0.9994 * hx + lx * 0.996; vz[i] = vf * 0.9994 * hz + lz * 0.996; }
      else { const f = 1 - fric[i]; vx[i] *= f; vz[i] *= f; }
    }
  }
  dampMembers(h);
}
function dampMembers(h) {
  for (let mi = 0; mi < mem.length; mi++) {
    const m = mem[mi]; if (!m.alive || m.kind === LINK) continue;
    const a = m.a, b = m.b, ws = wI[a] + wI[b]; if (ws === 0) continue;
    let dx = px[a] - px[b], dy = py[a] - py[b], dz = pz[a] - pz[b]; const l = Math.sqrt(dx * dx + dy * dy + dz * dz); if (l < 1e-9) continue; dx /= l; dy /= l; dz /= l;
    const u = (vx[a] - vx[b]) * dx + (vy[a] - vy[b]) * dy + (vz[a] - vz[b]) * dz;
    const dv = -u * Math.min(0.9, (m.kind >= CABLE ? 4 : 2.5) * h), ra = wI[a] / ws, rb = wI[b] / ws;
    vx[a] += ra * dv * dx; vy[a] += ra * dv * dy; vz[a] += ra * dv * dz; vx[b] -= rb * dv * dx; vy[b] -= rb * dv * dy; vz[b] -= rb * dv * dz;
  }
}
function collidePanels(h) {
  for (let ri = 0; ri < riders.length; ri++) {
    const R = riders[ri]; if (R.dead) continue;
    const ns = R.ns;
    for (let k = 0; k < ns.length; k++) {
      const i = ns[k]; if (!alive[i]) continue;
      const x = px[i], z = pz[i], r = nr[i];
      for (let pi = 0; pi < panels.length; pi++) {
        const P = panels[pi]; if (!P.floor || !P.ok) continue;
        const n = P.n, a = n[0], c = n[2];
        const cx = (px[a] + px[c]) * 0.5, cz = (pz[a] + pz[c]) * 0.5, rad = Math.hypot(px[a] - px[c], pz[a] - pz[c]) * 0.55 + 0.1;
        if (Math.abs(x - cx) > rad || Math.abs(z - cz) > rad) continue;
        for (let t = 0; t < n.length - 2; t++) {
          const A = n[0], B = n[t + 1], Cc = n[t + 2];
          const x1 = px[A], z1 = pz[A], x2 = px[B], z2 = pz[B], x3 = px[Cc], z3 = pz[Cc];
          const d = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3); if (Math.abs(d) < 1e-9) continue;
          const l1 = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / d, l2 = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / d, l3 = 1 - l1 - l2;
          const mg = -0.04; if (l1 < mg || l2 < mg || l3 < mg) continue;
          const yt = l1 * py[A] + l2 * py[B] + l3 * py[Cc], C = py[i] - r - yt;
          if (C > 0.01 * S.u || C < -0.55 * Math.max(r, 0.2)) continue;
          const wa = wI[A] * l1 * l1 + wI[B] * l2 * l2 + wI[Cc] * l3 * l3, ws = wI[i] + wa; if (ws === 0) continue;
          const dl = -C / ws;
          py[i] += wI[i] * dl; { const dA = wI[A] * l1 * dl, dB = wI[B] * l2 * dl, dC = wI[Cc] * l3 * dl; py[A] -= dA; py[B] -= dB; py[Cc] -= dC; qy[A] -= dA; qy[B] -= dB; qy[Cc] -= dC; }
          if (dl > 0) qy[i] = py[i] - clamp(l1 * vy[A] + l2 * vy[B] + l3 * vy[Cc], -VMAX, VMAX) * h;
          cont[i] = 1;
        }
      }
    }
  }
}
// riders push each other (spheres) and bounce off wall and roof fabric (two-sided triangles)
function collideRiders(h) {
  for (let a = 0; a < nRN; a++) {
    const i = RN[a]; if (!alive[i]) continue; const ri = riderOf[i];
    for (let b = a + 1; b < nRN; b++) {
      const j = RN[b]; if (!alive[j] || riderOf[j] === ri) continue;
      const rr = nr[i] + nr[j], dx = px[i] - px[j]; if (dx > rr || dx < -rr) continue;
      const dy = py[i] - py[j]; if (dy > rr || dy < -rr) continue;
      const dz = pz[i] - pz[j]; if (dz > rr || dz < -rr) continue;
      const d2 = dx * dx + dy * dy + dz * dz; if (d2 >= rr * rr || d2 < 1e-12) continue;
      const d = Math.sqrt(d2), w = wI[i] + wI[j]; if (!w) continue; const k = (rr - d) / (d * w);
      px[i] += dx * k * wI[i]; py[i] += dy * k * wI[i]; pz[i] += dz * k * wI[i]; px[j] -= dx * k * wI[j]; py[j] -= dy * k * wI[j]; pz[j] -= dz * k * wI[j];
    }
  }
  for (let pi = 0; pi < panels.length; pi++) {
    const P = panels[pi]; if (P.floor || !P.ok) continue;
    const n = P.n, A = n[0], c2 = n[2 % n.length], cx = (px[A] + px[c2]) * 0.5, cy = (py[A] + py[c2]) * 0.5, cz = (pz[A] + pz[c2]) * 0.5, rad = Math.hypot(px[A] - px[c2], py[A] - py[c2], pz[A] - pz[c2]) * 0.6 + 0.2;
    for (let a = 0; a < nRN; a++) {
      const i = RN[a]; if (!alive[i]) continue; const r = nr[i];
      if (Math.abs(px[i] - cx) > rad + r || Math.abs(py[i] - cy) > rad + r || Math.abs(pz[i] - cz) > rad + r) continue;
      for (let t = 0; t < n.length - 2; t++) {
        const B = n[t + 1], C = n[t + 2];
        const e1x = px[B] - px[A], e1y = py[B] - py[A], e1z = pz[B] - pz[A], e2x = px[C] - px[A], e2y = py[C] - py[A], e2z = pz[C] - pz[A];
        let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x; const nl = Math.hypot(nx, ny, nz); if (nl < 1e-9) continue; nx /= nl; ny /= nl; nz /= nl;
        const rx = px[i] - px[A], ry = py[i] - py[A], rz = pz[i] - pz[A], dist = rx * nx + ry * ny + rz * nz; if (dist >= r || dist <= -r) continue;
        const qx0 = rx - dist * nx, qy0 = ry - dist * ny, qz0 = rz - dist * nz;
        const d00 = e1x * e1x + e1y * e1y + e1z * e1z, d01 = e1x * e2x + e1y * e2y + e1z * e2z, d11 = e2x * e2x + e2y * e2y + e2z * e2z, d20 = qx0 * e1x + qy0 * e1y + qz0 * e1z, d21 = qx0 * e2x + qy0 * e2y + qz0 * e2z;
        const den = d00 * d11 - d01 * d01; if (Math.abs(den) < 1e-12) continue;
        const l2 = (d11 * d20 - d01 * d21) / den, l3 = (d00 * d21 - d01 * d20) / den, l1 = 1 - l2 - l3, mg = -0.12;
        if (l1 < mg || l2 < mg || l3 < mg) continue;
        const pd = (qx[i] - px[A]) * nx + (qy[i] - py[A]) * ny + (qz[i] - pz[A]) * nz, sg = pd >= 0 ? 1 : -1, pen = r - sg * dist;
        const wa = wI[A] * l1 * l1 + wI[B] * l2 * l2 + wI[C] * l3 * l3, ws = wI[i] + wa; if (ws === 0) continue;
        const dl = clamp(pen * sg / ws, -0.25 * r / (wI[i] || 1), 0.25 * r / (wI[i] || 1));
        px[i] += wI[i] * dl * nx; py[i] += wI[i] * dl * ny; pz[i] += wI[i] * dl * nz;
        px[A] -= wI[A] * l1 * dl * nx; py[A] -= wI[A] * l1 * dl * ny; pz[A] -= wI[A] * l1 * dl * nz;
        px[B] -= wI[B] * l2 * dl * nx; py[B] -= wI[B] * l2 * dl * ny; pz[B] -= wI[B] * l2 * dl * nz;
        px[C] -= wI[C] * l3 * dl * nx; py[C] -= wI[C] * l3 * dl * ny; pz[C] -= wI[C] * l3 * dl * nz;
      }
    }
  }
}
function collideBalls(h) {
  for (let bi = 0; bi < balls.length; bi++) {
    const B = balls[bi]; if (B.dead) continue;
    const r = B.r, sp = Math.hypot(B.vx, B.vy, B.vz);
    B.vy -= grav * 0.7 * h; B.x += B.vx * h; B.y += B.vy * h; B.z += B.vz * h;
    const gy = groundY(B.x);
    if (B.y < gy + r) { B.y = gy + r; if (B.fire) { boom(B, h); return; } if (B.vy < 0) B.vy *= -0.32; B.vx *= 0.995; B.vz *= 0.995; }
    B.life -= h; if (B.life <= 0 || B.y < -S.pit - 3) { B.dead = true; continue; }
    const hitV = Math.max(sp, 1);
    for (let mi = 0; mi < mem.length; mi++) {
      const m = mem[mi]; if (!m.alive || m.kind === LINK) continue;
      const a = m.a, b = m.b, ex = px[b] - px[a], ey = py[b] - py[a], ez = pz[b] - pz[a], L2 = ex * ex + ey * ey + ez * ez + 1e-9;
      let t = ((B.x - px[a]) * ex + (B.y - py[a]) * ey + (B.z - pz[a]) * ez) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx_ = px[a] + ex * t, qy_ = py[a] + ey * t, qz_ = pz[a] + ez * t, dx = qx_ - B.x, dy = qy_ - B.y, dz = qz_ - B.z, d = Math.hypot(dx, dy, dz);
      if (d >= r) continue;
      if (B.fire) { boom(B, h); return; }
      const thr = m.kind >= CABLE ? 0.03 * S.size : 0.14 * S.size;
      if (hitV > thr) { killMem(mi, 'broke'); if (m.kind <= BEAM) shake = reduce ? 0 : Math.max(shake, 0.5); for (let q = 0; q < 4; q++) emit(1, qx_, qy_, qz_, rnd(-1, 1) * S.u * 4, rnd(0, 3) * S.u * 3, rnd(-1, 1) * S.u * 4, rnd(0.25, 0.5), 0.5); B.vx *= 0.985; B.vy *= 0.985; B.vz *= 0.985; continue; }
      const nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : 1, nz = d > 1e-6 ? dz / d : 0, pen = r - d;
      const wa = wI[a] * (1 - t) * (1 - t) + wI[b] * t * t; if (wa === 0) continue;
      const dl = pen / wa;
      px[a] += wI[a] * (1 - t) * dl * nx; py[a] += wI[a] * (1 - t) * dl * ny; pz[a] += wI[a] * (1 - t) * dl * nz;
      px[b] += wI[b] * t * dl * nx; py[b] += wI[b] * t * dl * ny; pz[b] += wI[b] * t * dl * nz;
    }
    for (let i = 0, n0 = nN; i < n0; i++) {
      if (!alive[i] || pinned[i] || !isRider[i]) continue;
      const dx = px[i] - B.x, dy = py[i] - B.y, dz = pz[i] - B.z, d = Math.hypot(dx, dy, dz), rr = r + nr[i];
      if (d < rr && d > 1e-6) {
        const k = (rr - d) / d; px[i] += dx * k; py[i] += dy * k; pz[i] += dz * k;
        const f = Math.min(hitV, VMAX * 0.8) * 0.45 * h; qx[i] -= dx / d * f; qy[i] -= (dy / d + 0.5) * f; qz[i] -= dz / d * f;
        if (B.fire) { boom(B, h); return; }
        const R = riders[riderOf[i]];
        if (R && !R.dead) { if (R.t === 'p') knock(R); else if (R.t === 'c' && hitV > 0.4 * S.size) splitCar(R, B.vx * 0.15, B.vy * 0.15, B.vz * 0.15); }
        B.vx *= 0.97; B.vy *= 0.97; B.vz *= 0.97;
      }
    }
  }
}
function boom(B, h) {
  B.dead = true;
  const R = 0.3 * S.size, sp = Math.min(VMAX, 1.4 * S.size);
  for (let i = 0; i < nN; i++) {
    if (!alive[i] || pinned[i]) continue;
    const dx = px[i] - B.x, dy = py[i] - B.y, dz = pz[i] - B.z, d = Math.hypot(dx, dy, dz);
    if (d < R && d > 1e-6) { const k = (1 - d / R) ** 1.5 * sp / d; vx[i] += dx * k; vy[i] += (dy + 0.4 * d) * k; vz[i] += dz * k; if (isRider[i]) { qx[i] = px[i] - vx[i] * h; qy[i] = py[i] - vy[i] * h; qz[i] = pz[i] - vz[i] * h; } else qx[i] = px[i]; }
  }
  for (const Rd of riders.slice()) { if (Rd.dead || Rd.t === 'h') continue; const i = Rd.n, d = Math.hypot(px[i] - B.x, py[i] - B.y, pz[i] - B.z); if (Rd.t === 'p' && d < R * 0.8) knock(Rd); else if (Rd.t === 'c' && d < R * 0.3) splitCar(Rd, 0, 0, 0); }
  for (let mi = 0; mi < mem.length; mi++) {
    const m = mem[mi]; if (!m.alive || m.kind === LINK) continue;
    const cx = (px[m.a] + px[m.b]) / 2 - B.x, cy = (py[m.a] + py[m.b]) / 2 - B.y, cz = (pz[m.a] + pz[m.b]) / 2 - B.z, d = Math.hypot(cx, cy, cz);
    if (d < R * 0.22) killMem(mi, 'broke'); else if (d < R * 0.65) ignite(mi);
  }
  rings.push({ x: B.x, y: Math.max(B.y, 0.05), z: B.z, t: 0, R: R * 1.2 });
  for (let q = 0; q < 70; q++) { const a = rnd(0, TAU), e = rnd(-0.2, 1), s = rnd(0.2, 1) * S.size * 0.8; emit(q % 3 === 0 ? 3 : 0, B.x, B.y, B.z, Math.cos(a) * s * (1 - e * 0.5), e * s + 3, Math.sin(a) * s * (1 - e * 0.5), rnd(0.6, 1.6), rnd(0.6, 1.4)); }
  shake = reduce ? 0 : 1.6;
}

/* ===================== 4. effects and the frame ===================== */
let shake = 0, rings = [], inferno = 0, timeScale = 1, paused = false;
const PMAX = coarse ? 300 : 520;
let lite = false;
const pX = new Float32Array(PMAX), pY = new Float32Array(PMAX), pZ = new Float32Array(PMAX), pVx = new Float32Array(PMAX), pVy = new Float32Array(PMAX), pVz = new Float32Array(PMAX), pL = new Float32Array(PMAX), pM = new Float32Array(PMAX), pK = new Uint8Array(PMAX), pS = new Float32Array(PMAX);
let pc = 0;
function emit(k, x, y, z, a, b, c, life, size) {
  if (pc >= PMAX) return;
  const i = pc++; pX[i] = x; pY[i] = y; pZ[i] = z; pVx[i] = a; pVy[i] = b; pVz[i] = c; pL[i] = pM[i] = life; pK[i] = k; pS[i] = size;
}
function updateParticles(dt) {
  for (let i = pc - 1; i >= 0; i--) {
    pL[i] -= dt;
    if (pL[i] <= 0) { pc--; if (i !== pc) { for (const A of [pX, pY, pZ, pVx, pVy, pVz, pL, pM, pK, pS]) A[i] = A[pc]; } continue; }
    const k = pK[i];
    if (k === 2) { pVy[i] += S.size * 0.12 * dt; pVx[i] *= 0.97; pVz[i] *= 0.97; }
    else if (k === 3) { pVy[i] += S.size * 0.02 * dt; pVx[i] *= 0.985; pVz[i] *= 0.985; }
    else pVy[i] -= grav * (k === 0 ? 0.3 : 0.9) * dt;
    pX[i] += pVx[i] * dt; pY[i] += pVy[i] * dt; pZ[i] += pVz[i] * dt;
    if (pY[i] < 0 && k !== 2) { if (k === 0 && rift.gap <= 0) { pY[i] = 0; pVy[i] *= -0.2; pVx[i] *= 0.5; pVz[i] *= 0.5; } else if (pY[i] < -S.pit) pL[i] = 0; }
  }
}
const FM = [0.8, 1.2, 1.4, 2.6, 0];
function fireStep(dt) {
  const mul = inferno > 0 ? 2.2 : 1; if (inferno > 0) inferno -= dt;
  for (let k = burning.length - 1; k >= 0; k--) {
    const mi = burning[k], m = mem[mi];
    if (!m.alive) { burning[k] = burning[burning.length - 1]; burning.pop(); continue; }
    m.burn += dt;
    for (let e = 0; e < 2; e++) {
      const ad = adj[e ? m.b : m.a];
      for (let q = 0; q < ad.length; q++) { const nm = mem[ad[q]]; if (nm.burn < 0 && nm.alive && Math.random() < 0.7 * dt * FM[nm.kind] * mul) ignite(ad[q]); }
    }
    const f = Math.random();
    if (pc < PMAX - 30 && Math.random() < dt * (lite ? 3 : coarse ? 5 : 9)) emit(2, lerp(px[m.a], px[m.b], f), lerp(py[m.a], py[m.b], f), lerp(pz[m.a], pz[m.b], f), rnd(-1, 1) * S.u * 0.4, S.size * 0.05 * rnd(0.6, 1.3), rnd(-1, 1) * S.u * 0.4, rnd(0.5, 0.95), rnd(0.7, 1.3));
    if (m.burn > m.dur) {
      killMem(mi, 'burn'); burning[k] = burning[burning.length - 1]; burning.pop();
      for (let q = 0; q < 3; q++) emit(0, lerp(px[m.a], px[m.b], Math.random()), lerp(py[m.a], py[m.b], Math.random()), lerp(pz[m.a], pz[m.b], Math.random()), rnd(-1, 1) * S.u * 2, rnd(0, 2) * S.u * 2, rnd(-1, 1) * S.u * 2, rnd(0.8, 1.8), rnd(0.6, 1.2));
    }
  }
}
function igniteAll() {
  inferno = 4;
  for (let mi = 0; mi < mem.length; mi++) { const m = mem[mi]; if (ignite(mi)) { m.dur *= rnd(0.45, 1.0); m.burn = -rnd(0, 1.3) * 0; } }
}
function burnAt(mi) { return ignite(mi); }

function startTornado(x, z, vxn, vzn, follow) {
  const sz = S.size, T = { x, z, vx: vxn, vz: vzn, t: 0, life: follow ? 60 : 11, r: 0.09 * sz + 0.6, h: sz * 1.0, v: Math.min(VMAX * 0.7, 0.9 * sz + 6), up: Math.min(26, 0.5 * sz + 4), fade: 0, ph: rnd(0, 6), follow: !!follow, tx: x, tz: z };
  tornadoes.push(T); if (tornadoes.length > 2) tornadoes.shift(); return T;
}
function tornadoAcross() {
  const sz = S.size, a = rnd(0, TAU), dx = Math.cos(a), dz = Math.sin(a), d = sz * 1.5;
  startTornado(-dx * d + rnd(-0.2, 0.2) * sz, -dz * d + rnd(-0.2, 0.2) * sz, dx * sz * 0.28, dz * sz * 0.28, false);
}
function startGust(dx, dz) { const l = Math.hypot(dx, dz) || 1; gust = { dx: dx / l, dz: dz / l, dy: 0.15, t: 0, dur: 4, env: 0, peak: clamp(0.55 * S.size, 9, 30) }; streaks.length = 0; }
function throwBall(o, d, fire) {
  const sz = S.size, sp = fire ? 1.9 * sz : 0.9 * sz;
  balls.push({ x: o[0], y: o[1], z: o[2], vx: d[0] * sp, vy: d[1] * sp + (fire ? 0 : 0.12 * sz), vz: d[2] * sp, r: Math.max(0.3 * S.u, 0.035 * sz) * (fire ? 0.9 : 1), fire: !!fire, dead: false, life: 14, spin: 0 });
  if (balls.length > 6) balls.shift();
}

function refreshRiders() {
  nRN = 0; upList.length = 0;
  for (let ri = 0; ri < riders.length; ri++) { const R = riders[ri]; if (R.dead) continue; for (let k = 0; k < R.ns.length; k++) if (alive[R.ns[k]]) RN[nRN++] = R.ns[k]; if (R.t === 'p' && R.st) upList.push(R); }
}
function syncRiders() { for (const R of riders) if (R.t === 'p') { R.lx = px[R.n]; R.ly = py[R.n]; R.lz = pz[R.n]; R.air = 0; } }
// fast members (falling struts and beams) hit riders: the rider is carried along and people are knocked over
const spdN = new Float32Array(NMAX);
function memberHits() {
  if (!nRN) return;
  for (let i = 0; i < nN; i++) spdN[i] = alive[i] ? Math.abs(vx[i]) + Math.abs(vy[i]) + Math.abs(vz[i]) : 0;
  const thr = 4 + 0.15 * S.size;
  for (let mi = 0; mi < mem.length; mi++) {
    const m = mem[mi]; if (!m.alive || m.kind > BEAM || m.hid) continue;
    const a = m.a, b = m.b; if (spdN[a] < thr && spdN[b] < thr) continue;
    const ex = px[b] - px[a], ey = py[b] - py[a], ez = pz[b] - pz[a], L2 = ex * ex + ey * ey + ez * ez + 1e-9;
    for (let k = 0; k < nRN; k++) {
      const i = RN[k]; if (!alive[i] || i === a || i === b) continue;
      let t = ((px[i] - px[a]) * ex + (py[i] - py[a]) * ey + (pz[i] - pz[a]) * ez) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = px[i] - (px[a] + ex * t), dy = py[i] - (py[a] + ey * t), dz = pz[i] - (pz[a] + ez * t), rr = nr[i] * 0.6 + m.th * 0.5;
      if (dx * dx + dy * dy + dz * dz > rr * rr) continue;
      const mvx = vx[a] * (1 - t) + vx[b] * t, mvy = vy[a] * (1 - t) + vy[b] * t, mvz = vz[a] * (1 - t) + vz[b] * t;
      if (Math.abs(mvx - vx[i]) + Math.abs(mvy - vy[i]) + Math.abs(mvz - vz[i]) < thr) continue;
      const R = riders[riderOf[i]]; if (!R || R.dead) continue;
      for (const n of R.ns) { vx[n] += (mvx - vx[n]) * 0.6; vy[n] += (mvy - vy[n]) * 0.6 + 1; vz[n] += (mvz - vz[n]) * 0.6; }
      vx[a] *= 0.92; vy[a] *= 0.92; vz[a] *= 0.92; vx[b] *= 0.92; vy[b] *= 0.92; vz[b] *= 0.92;
      if (R.t === 'p') knock(R);
    }
  }
}
function ridersStep(dt) {
  const quakeOn = Q.kind && Q.kind !== 'rift' && Q.env > 0.3, gs = gust ? gust.env * gust.peak : 0;
  for (let ri = 0; ri < riders.length; ri++) {
    const R = riders[ri]; if (R.dead) continue;
    let ok = true; for (let k = 0; k < R.ns.length; k++) if (!alive[R.ns[k]]) ok = false;
    if (!ok) { R.dead = true; continue; }
    if (R.t === 'p') {
      const i = R.n, spd = Math.hypot(px[i] - R.lx, pz[i] - R.lz) / dt, rise = (py[i] - R.ly) / dt; R.lx = px[i]; R.ly = py[i]; R.lz = pz[i];
      if (py[i] < -1) R.fell = true;
      if (!R.st || grace) continue;
      if (cont[i]) R.air = 0; else R.air += dt;
      let fall = (R.air > 0.25 && rise < -1.5) || R.air > 0.8; R.why = fall ? 'air' : '';
      if (!quakeOn && R.run <= 0 && (spd > 4.5 || rise > 5)) { fall = true; R.why = 'speed ' + spd.toFixed(1) + ' rise ' + rise.toFixed(1); }
      if (quakeOn && cont[i]) { R.tq += dt * Q.env; if (R.tq > R.tp) fall = true; }
      if (gs > 8 && Math.random() < dt * 0.8 * gs / 15) fall = true;
      // fire nearby: run away, or get flung clear when it is right beside them
      let near = 1e9, nx = 0, nz = 0, ny = 0;
      for (let k = 0; k < burning.length; k++) { const m = mem[burning[k]]; if (!m.alive) continue; const mx = (px[m.a] + px[m.b]) * 0.5 - px[i], my = (py[m.a] + py[m.b]) * 0.5 - py[i], mz = (pz[m.a] + pz[m.b]) * 0.5 - pz[i], d = Math.hypot(mx, my, mz); if (d < near) { near = d; nx = mx; ny = my; nz = mz; } }
      const rad = 3.6 * R.s + 1;
      if (near < rad && !fall) {
        let dx = -nx, dz = -nz; const dl = Math.hypot(dx, dz); if (dl < 0.05) { const a = rnd(0, TAU); dx = Math.cos(a); dz = Math.sin(a); } else { dx /= dl; dz /= dl; }
        R.run = 0.5; fric[R.n] = 0.03;
        const sp = 3.4 * Math.sqrt(R.s) + 0.4;
        for (const n of R.ns) { vx[n] += (dx * sp - vx[n]) * 0.4; vz[n] += (dz * sp - vz[n]) * 0.4; }
        if (near < 1.3 * R.s + 0.3) knock(R, dx * sp * 1.4, 3.2 * Math.sqrt(R.s) + 1, dz * sp * 1.4);
      } else if (R.run > 0) { R.run -= dt; if (R.run <= 0 && R.st) fric[R.n] = 0.3; }
      if (fall) knock(R);
    } else if (R.t === 'c') {
      const A = R.n, B = R.n2, C = R.n3;
      let ux = px[A] - px[B], uy = py[A] - py[B], uz = pz[A] - pz[B]; const l = Math.hypot(ux, uy, uz) || 1; ux /= l; uy /= l; uz /= l;
      let rx = px[C] - (px[A] + px[B]) / 2, ry = py[C] - (py[A] + py[B]) / 2, rz = pz[C] - (pz[A] + pz[B]) / 2; const dd = rx * ux + ry * uy + rz * uz; rx -= dd * ux; ry -= dd * uy; rz -= dd * uz;
      R.upy = ry / (Math.hypot(rx, ry, rz) || 1); const upright = R.upy > 0.55;
      if (py[A] < -1) R.fell = true;
      if (upright && cont[A] && cont[B]) { const hl = Math.hypot(ux, uz) || 1; chx[A] = chx[B] = ux / hl; chz[A] = chz[B] = uz / hl; } else { chx[A] = chx[B] = chz[A] = chz[B] = 0; }
      fric[A] = fric[B] = upright ? 0.004 : 0.25;
      if (!upright) R.drive = null;
      const d = R.drive;
      if (d && upright && cont[A] && cont[B] && !grace) {
        const v0 = 3.2 * Math.sqrt(R.s);
        for (const n of [A, B]) { vx[n] += (R.ux * v0 - vx[n]) * 0.25; vz[n] += (R.z0 - pz[n]) * 6 * dt; }
        const x = (px[A] + px[B]) / 2;
        if ((R.ux > 0 && x > d.lim) || (R.ux < 0 && x < -d.lim)) {
          R.ux = -R.ux; const z = d.zalt; d.zalt = R.z0; R.z0 = z;
          for (const n of R.ns) { pz[n] = qz[n] = z; vx[n] *= 0.2; }
        }
      }
    } else {
      const u = R.up; let ux = px[R.n] - px[R.n2], uy = py[R.n] - py[R.n2], uz = pz[R.n] - pz[R.n2]; const l = Math.hypot(ux, uy, uz) || 1; ux /= l; uy /= l; uz /= l;
      let dd = u[0] * ux + u[1] * uy + u[2] * uz, ax = u[0] - dd * ux, ay = u[1] - dd * uy, az = u[2] - dd * uz, al = Math.hypot(ax, ay, az);
      if (al < 0.2) { ax = -ux * uy; ay = 1 - uy * uy; az = -uz * uy; al = Math.hypot(ax, ay, az) || 1; }
      R.up = [ax / al, ay / al, az / al]; if (py[R.n] < -1) R.fell = true;
    }
  }
  memberHits();
}

function stepFrame() {
  const t0 = performance.now();
  const dt = (1 / 60) * timeScale, sub = FR.sub, h = dt / sub;
  for (let i = 0; i < nN; i++) cont[i] = 0;
  refreshRiders();
  for (let pi = 0; pi < panels.length; pi++) { const P = panels[pi]; let ok = true; for (let k = 0; k < P.ms.length; k++) if (!mem[P.ms[k]].alive) { ok = false; break; } if (ok) for (let k = 0; k < P.n.length; k++) if (!alive[P.n[k]]) { ok = false; break; } P.ok = ok; }
  for (let s = 0; s < sub; s++) { substep(h); simT += h; }
  // tension, strain and breaking
  let peak = 0;
  for (let mi = 0; mi < mem.length; mi++) {
    const m = mem[mi]; if (!m.alive || m.kind === LINK) continue;
    const len = Math.hypot(px[m.a] - px[m.b], py[m.a] - py[m.b], pz[m.a] - pz[m.b]), st = (len - m.rest) / m.rest;
    m.st = st;
    if (m.kind >= CABLE) { m.T = Math.max(0, -m.lam / (h * h)); if (m.T > peak) peak = m.T; if (!grace && st > m.brk) killMem(mi, 'snap'); }
    else if (!grace && Math.abs(st) > m.brk) killMem(mi, 'snap');
  }
  if (!grace && peak > cnt.peak) cnt.peak = peak;
  cnt.now = peak;
  fireStep(dt);
  ridersStep(dt);
  for (let i = tornadoes.length - 1; i >= 0; i--) {
    const T = tornadoes[i]; T.t += dt; T.ph += dt * 1.3;
    if (T.follow && T.held) { T.x += (T.tx - T.x) * Math.min(1, 2.6 * dt); T.z += (T.tz - T.z) * Math.min(1, 2.6 * dt); T.vx = (T.tx - T.x) * 0.8; T.vz = (T.tz - T.z) * 0.8; }
    else { T.x += T.vx * dt; T.z += T.vz * dt; if (T.follow && !T.held && T.life > T.t + 5) T.life = T.t + 5; }
    T.fade = Math.min(1, T.t / 0.9) * clamp((T.life - T.t) / 1.2, 0, 1);
    if (T.t > T.life) tornadoes.splice(i, 1);
  }
  if (gust) { gust.t += dt; gust.env = Math.sin(Math.PI * gust.t / gust.dur) ** 0.8; if (gust.t > gust.dur) gust = null; }
  for (let i = balls.length - 1; i >= 0; i--) {
    const B = balls[i]; if (B.dead) { balls.splice(i, 1); continue; }
    if (B.fire && pc < PMAX - 5) { emit(2, B.x, B.y, B.z, rnd(-1, 1), rnd(0, 2), rnd(-1, 1), 0.5, 1.4); emit(3, B.x, B.y, B.z, rnd(-1, 1), rnd(0, 1), rnd(-1, 1), 0.9, 1.5); }
  }
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > 0.8) rings.splice(i, 1); }
  updateParticles(dt);
  shake = Math.max(0, shake - dt * 2.4);
  if (Q.kind && !reduce) shake = Math.max(shake, 0.18 * Q.env);
  // keep the cost in check on slow machines
  FR.ms = FR.ms * 0.9 + (performance.now() - t0) * 0.1;
}

/* ---- loading ---- */
let sceneIx = 0;
function loadScene(ix, keep) {
  sceneIx = ix; const sc = SCENES[ix];
  resetWorld();
  S = { m: 2, k: 1, ks: 0.2, u: 1, view: [0.5, 0.3], name: sc.name, id: sc.id, size: 10, pit: 6 };
  sc.build(); riftRiders(sc.rs || 1);
  // bounding box of live nodes
  let x0 = 1e9, x1 = -1e9, y1 = 0, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < nN; i++) { x0 = Math.min(x0, px[i]); x1 = Math.max(x1, px[i]); y1 = Math.max(y1, py[i]); z0 = Math.min(z0, pz[i]); z1 = Math.max(z1, pz[i]); }
  S.size = Math.max(3, 0.5 * Math.max(x1 - x0, z1 - z0, y1 * 1.1)); S.hx = 0.5 * Math.max(x1 - x0, z1 - z0); S.hy = y1;
  S.pit = clamp(0.35 * S.size, 1.5, 14);
  S.cx = (x0 + x1) / 2; S.cz = (z0 + z1) / 2; S.cy = y1 * 0.46;
  cnt.cut = cnt.broke = cnt.burnt = 0; cnt.peak = 0; cnt.total = cnt.alive = mem.filter(m => m.orig).length;
  Q.kind = null; Q.ox = Q.oy = Q.oz = 0; rift.gap = 0; tornadoes = []; gust = null; grab = null; pc = 0; rings = []; inferno = 0; simT = 0; shake = 0; streaks.length = 0;
  for (let i = 0; i < nN; i++) { vx[i] = vy[i] = vz[i] = 0; }
  // settle for a moment without any breaking
  grace = true; const ts = timeScale; timeScale = 1;
  for (let f = 0; f < 80; f++) stepFrame();
  for (let i = 0; i < nN; i++) { vx[i] *= 0.2; vy[i] *= 0.2; vz[i] *= 0.2; }
  syncRiders(); timeScale = ts; grace = false; simT = 0; cnt.peak = 0; pc = 0; rings = [];
  for (let k = 0; k < 6; k++) stepFrame();
  cnt.peak = 0; simT = 0;
  if (!keep) cam.reset(true);
}

/* ===================== 5. camera and drawing ===================== */
const cam = { yaw: 0.5, pitch: 0.3, dist: 30, vyaw: 0, w: 800, h: 600, dpr: 1, zoom: 1, cx: 400, cy: 300, f: 700, x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 0, rx: 1, rz: 0, ux: 0, uy: 1, uz: 0, tx: 0, ty: 0, tz: 0 };
cam.reset = function (full) {
  this.yaw = S.view[0]; this.pitch = S.view[1]; this.vyaw = 0; this.zoom = 1;
  this.tx = S.cx; this.ty = S.cy; this.tz = S.cz; this.dist = this.base = 1;
};
cam.update = function (shk) {
  const s0 = Math.min(this.w, this.h * 1.2); this.f = s0 * 1.25;
  this.base = this.f * Math.max(2.1 * S.hx / this.w, 1.3 * S.hy / this.h, 1.35 * S.size / s0);
  this.dist = clamp(this.base * this.zoom, S.size * 0.25, S.size * 9);
  const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw), sp = Math.sin(this.pitch), cp = Math.cos(this.pitch);
  const ox = sy * cp, oy = sp, oz = cy * cp;
  this.x = this.tx + this.dist * ox; this.y = this.ty + this.dist * oy; this.z = this.tz + this.dist * oz;
  this.fx = -ox; this.fy = -oy; this.fz = -oz; this.rx = cy; this.rz = -sy; this.ux = -sp * sy; this.uy = cp; this.uz = -sp * cy;
  this.cx = this.w / 2 + (shk ? rnd(-1, 1) * shk : 0); this.cy = this.h * 0.54 + (shk ? rnd(-1, 1) * shk : 0);
};
let PX = 0, PY = 0, PZ = 0;
function pr(x, y, z) {
  const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z, zf = dx * cam.fx + dy * cam.fy + dz * cam.fz, k = cam.f / (zf > 0.02 ? zf : 0.02);
  PX = cam.cx + (dx * cam.rx + dz * cam.rz) * k; PY = cam.cy - (dx * cam.ux + dy * cam.uy + dz * cam.uz) * k; PZ = zf; return k;
}
// unproject a screen point to a ray (origin, direction) in the world
function rayAt(mx, my) {
  const a = (mx - cam.cx) / cam.f, b = -(my - cam.cy) / cam.f;
  const d = [cam.fx + cam.rx * a + cam.ux * b, cam.fy + cam.uy * b, cam.fz + cam.rz * a + cam.uz * b], l = Math.hypot(...d);
  return { o: [cam.x, cam.y, cam.z], d: [d[0] / l, d[1] / l, d[2] / l] };
}
function groundHit(mx, my) {
  const r = rayAt(mx, my); if (r.d[1] > -0.02) return null; const t = -r.o[1] / r.d[1];
  return [r.o[0] + r.d[0] * t, 0, r.o[2] + r.d[2] * t];
}
const TL = []; (() => { const st = [[0, [91, 155, 230]], [0.5, [230, 162, 60]], [1, [224, 55, 45]]]; for (let i = 0; i <= 32; i++) { const t = i / 32; let k = t <= 0.5 ? 0 : 1; const a = st[k], b = st[k + 1], u = (t - a[0]) / (b[0] - a[0]); TL.push(`rgb(${Math.round(lerp(a[1][0], b[1][0], u))},${Math.round(lerp(a[1][1], b[1][1], u))},${Math.round(lerp(a[1][2], b[1][2], u))})`); } })();
const streaks = [];
const hex = c => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgb = (c, k, a) => `rgba(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)},${a === undefined ? 1 : a})`;

function camSpace(x, y, z) { const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z; return [dx * cam.rx + dz * cam.rz, dx * cam.ux + dy * cam.uy + dz * cam.uz, dx * cam.fx + dy * cam.fy + dz * cam.fz]; }
function scr(c) { const k = cam.f / c[2]; return [cam.cx + c[0] * k, cam.cy - c[1] * k]; }
const NEAR = 0.3;
function clipPoly(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ain = a[2] >= NEAR, bin = b[2] >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
  }
  return out;
}
function polyPath(wp) { const c = clipPoly(wp.map(p => camSpace(p[0], p[1], p[2]))); if (c.length < 3) return false; ctx.beginPath(); c.forEach((p, i) => { const q = scr(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); return true; }
function lineW(a, b) { // world line, near-clipped, as a moveTo/lineTo pair
  let p = camSpace(a[0], a[1], a[2]), q = camSpace(b[0], b[1], b[2]);
  if (p[2] < NEAR && q[2] < NEAR) return false;
  if (p[2] < NEAR) { const t = (NEAR - p[2]) / (q[2] - p[2]); p = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, NEAR]; }
  else if (q[2] < NEAR) { const t = (NEAR - q[2]) / (p[2] - q[2]); q = [q[0] + (p[0] - q[0]) * t, q[1] + (p[1] - q[1]) * t, NEAR]; }
  const s = scr(p), e = scr(q); ctx.moveTo(s[0], s[1]); ctx.lineTo(e[0], e[1]); return true;
}
function drawGround() {
  const size = S.size, G = Math.max(70, size * 5), hg = rift.gap / 2;
  const ox = Q.kind === 'side' ? Q.ox : 0, oz = Q.kind === 'side' ? Q.oz : 0;
  // flat ground
  const gr = ctx.createLinearGradient(0, 0, 0, cam.h);
  gr.addColorStop(0, '#EEF4FB'); gr.addColorStop(0.35, '#E4ECF6'); gr.addColorStop(1, '#D0DCEC');
  if (hg > 0) {
    ctx.fillStyle = '#1B2331'; if (polyPath([[-hg, -S.pit, -G], [hg, -S.pit, -G], [hg, -S.pit, G], [-hg, -S.pit, G]])) ctx.fill();
    ctx.fillStyle = '#4C586B'; if (polyPath([[-hg, 0, -G], [-hg, -S.pit, -G], [-hg, -S.pit, G], [-hg, 0, G]])) ctx.fill();
    ctx.fillStyle = '#3A4558'; if (polyPath([[hg, 0, -G], [hg, -S.pit, -G], [hg, -S.pit, G], [hg, 0, G]])) ctx.fill();
    ctx.fillStyle = gr; if (polyPath([[-G, 0, -G], [-hg, 0, -G], [-hg, 0, G], [-G, 0, G]])) ctx.fill(); if (polyPath([[hg, 0, -G], [G, 0, -G], [G, 0, G], [hg, 0, G]])) ctx.fill();
    ctx.strokeStyle = '#7C8AA0'; ctx.lineWidth = 2; ctx.beginPath(); lineW([-hg, 0, -G], [-hg, 0, G]); lineW([hg, 0, -G], [hg, 0, G]); ctx.stroke();
  } else { ctx.fillStyle = gr; if (polyPath([[-G, 0, -G], [G, 0, -G], [G, 0, G], [-G, 0, G]])) ctx.fill(); }
  // grid
  const raw = size / 5, mag = Math.pow(10, Math.floor(Math.log10(raw))), gs = raw / mag < 2 ? mag : raw / mag < 5 ? 2 * mag : 5 * mag, L = Math.ceil(size * 2.6 / gs) * gs;
  ctx.strokeStyle = 'rgba(95,125,165,.28)'; ctx.lineWidth = 1; ctx.beginPath();
  const wave = Q.kind === 'roll' || Q.kind === 'up', sh = x => hg > 0 ? x + (x < 0 ? -hg : hg) : x;
  for (let v = -L; v <= L + 1e-6; v += gs) {
    const x = sh(v) + ox, y = wave ? groundY(x) : 0;
    lineW([x, y, -L + oz], [x, y, L + oz]);
    const z = v + oz;
    const segs = wave ? 22 : 1;
    const emitRange = (xa, xb) => { for (let s = 0; s < segs; s++) { const a = xa + (xb - xa) * s / segs, b = xa + (xb - xa) * (s + 1) / segs; lineW([a, wave ? groundY(a) : 0, z], [b, wave ? groundY(b) : 0, z]); } };
    if (hg > 0) { emitRange(-L - hg, -hg); emitRange(hg, L + hg); } else emitRange(-L + ox, L + ox);
  }
  ctx.stroke();
}
function drawShadows() {
  ctx.strokeStyle = 'rgba(20,40,80,.12)'; ctx.lineCap = 'round';
  for (let pass = 0; pass < 1; pass++) {
    ctx.beginPath();
    for (let mi = 0; mi < mem.length; mi++) {
      const m = mem[mi]; if (!m.alive || m.hid || m.kind === FAB || (pass === 0) !== (m.kind <= BEAM)) continue;
      const a = m.a, b = m.b; if (py[a] < -1 || py[b] < -1) continue;
      lineW([px[a] + py[a] * 0.32, 0, pz[a] + py[a] * 0.18], [px[b] + py[b] * 0.32, 0, pz[b] + py[b] * 0.18]);
    }
    ctx.lineWidth = pass === 0 ? Math.max(1.5, 0.1 * S.u * cam.f / cam.dist) : 1; ctx.stroke();
  }
  ctx.fillStyle = 'rgba(20,40,80,.14)';
  for (const R of riders) { if (R.dead) continue; const i = R.n; const k = pr(px[i] + py[i] * 0.32, 0, pz[i] + py[i] * 0.18); if (PZ < NEAR) continue; ctx.beginPath(); ctx.ellipse(PX, PY, R.s * (R.t === 'c' ? 1.5 : R.t === 'h' ? 0.9 : 0.35) * k, R.s * (R.t === 'c' ? 0.6 : R.t === 'h' ? 0.45 : 0.14) * k, 0, 0, TAU); ctx.fill(); }
}
function drawMember(m) {
  const a = m.a, b = m.b, az = sz[a], bz = sz[b]; if (az < NEAR || bz < NEAR) return;
  const x1 = sx[a], y1 = sy[a], x2 = sx[b], y2 = sy[b], w = Math.max(1, m.th * cam.f / ((az + bz) * 0.5));
  const bn = m.burn >= 0, K = m.kind;
  if (bn) { const f = clamp(m.burn / (m.dur || 1), 0, 1); ctx.strokeStyle = `rgba(255,${Math.round(150 - 80 * f)},30,${0.5 - 0.15 * f})`; ctx.lineWidth = w + (lite ? 5 : 7 + 3 * Math.sin(simT * 18 + a)); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  if (K === CABLE || K === FAB) {
    const slack = m.st < -0.012, tn = clamp((m.st - 0.03) / (m.brk - 0.03), 0, 1);
    ctx.lineWidth = K === FAB ? Math.max(0.8, w * 0.8) : Math.max(1.1, w);
    ctx.strokeStyle = bn ? '#5a3a2a' : slack ? (K === FAB ? 'rgba(120,160,210,.7)' : 'rgba(110,150,205,.75)') : K === FAB ? TL[Math.round(tn * 32)] : TL[Math.round(tn * 32)];
    ctx.beginPath(); ctx.moveTo(x1, y1);
    if (slack) { const L = Math.hypot(px[a] - px[b], py[a] - py[b], pz[a] - pz[b]), sag = Math.min(0.45 * L, Math.sqrt(3 * L * Math.max(0, m.rest - L) / 8)); pr((px[a] + px[b]) / 2, (py[a] + py[b]) / 2 - sag, (pz[a] + pz[b]) / 2); ctx.quadraticCurveTo(PX * 2 - (x1 + x2) / 2, PY * 2 - (y1 + y2) / 2, x2, y2); } else ctx.lineTo(x2, y2);
    ctx.stroke();
  } else {
    const col = m.col || (K === STRUT ? '#0E3A75' : '#8A5A0B');
    ctx.lineWidth = w; ctx.strokeStyle = bn ? '#3b2a22' : col; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    if (w > 3 && !bn && !lite) { ctx.lineWidth = w * 0.3; ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.stroke(); }
  }
}
function drawPanel(P) {
  const n = P.n; for (let k = 0; k < n.length; k++) if (sz[n[k]] < NEAR) return;
  let bn = 0; for (let k = 0; k < P.ms.length; k++) if (mem[P.ms[k]].burn >= 0) bn++;
  ctx.beginPath(); ctx.moveTo(sx[n[0]], sy[n[0]]); for (let k = 1; k < n.length; k++) ctx.lineTo(sx[n[k]], sy[n[k]]); ctx.closePath();
  ctx.globalAlpha = P.al * (bn ? 0.7 : 1); ctx.fillStyle = bn ? '#5a3a2a' : P.col; ctx.fill(); ctx.globalAlpha = 1;
  if (bn) { ctx.fillStyle = `rgba(255,120,30,${0.25 + 0.15 * Math.sin(simT * 14)})`; ctx.fill(); }
}
function drawPerson(R) {
  const hip = R.n, hd = R.h; if (!alive[hip] || !alive[hd]) return;
  const s = R.s; let dx = px[hd] - px[hip], dy = py[hd] - py[hip], dz = pz[hd] - pz[hip]; const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
  let ex = dy * cam.fz - dz * cam.fy, ey = dz * cam.fx - dx * cam.fz, ez = dx * cam.fy - dy * cam.fx; const el = Math.hypot(ex, ey, ez);
  if (el < 1e-3) { ex = cam.rx; ey = 0; ez = cam.rz; } else { ex /= el; ey /= el; ez /= el; }
  const hx = px[hip], hy = py[hip], hz = pz[hip], u = s * pr(hx, hy, hz); if (PZ < NEAR) return;
  const P = (a, c) => { pr(hx + (dx * a + ex * c) * s, hy + (dy * a + ey * c) * s, hz + (dz * a + ez * c) * s); return [PX, PY]; };
  const seg = (p, q, w, c) => { ctx.strokeStyle = c; ctx.lineWidth = Math.max(1, w * u); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); };
  const air = R.st === 0 && !cont[hip], H = P(0, 0), neck = P(0.62, 0), head = P(0.86, 0);
  seg(H, P(-0.5, -0.15), 0.13, '#27364F'); seg(H, P(-0.5, 0.15), 0.13, '#27364F');
  seg(H, neck, 0.3, R.col);
  const sh = P(0.52, 0); seg(sh, air ? P(0.95, -0.34) : P(0.12, -0.34), 0.09, R.col); seg(sh, air ? P(0.95, 0.34) : P(0.12, 0.34), 0.09, R.col);
  ctx.fillStyle = '#F2C9A5'; ctx.beginPath(); ctx.arc(head[0], head[1], 0.2 * u, 0, TAU); ctx.fill();
  const ang = Math.atan2(head[1] - H[1], head[0] - H[0]); ctx.fillStyle = '#3B2A22'; ctx.beginPath(); ctx.arc(head[0], head[1], 0.2 * u, ang - 1.0, ang + 1.0); ctx.fill();
}
const LDIR = (() => { const v = [0.4, 0.8, 0.45], l = Math.hypot(...v); return v.map(a => a / l); })();
function drawCar(R) {
  let cx, cy, cz, ux, uy, uz, up, parts, wheels;
  if (R.t === 'c') {
    const a = R.n, b = R.n2, c = R.n3; if (!alive[a] || !alive[b] || !alive[c]) return;
    ux = px[a] - px[b]; uy = py[a] - py[b]; uz = pz[a] - pz[b]; const L = Math.hypot(ux, uy, uz) || 1; ux /= L; uy /= L; uz /= L;
    cx = (px[a] + px[b]) / 2; cy = (py[a] + py[b]) / 2; cz = (pz[a] + pz[b]) / 2;
    let rx = px[c] - cx, ry = py[c] - cy, rz = pz[c] - cz; const dd = rx * ux + ry * uy + rz * uz; rx -= dd * ux; ry -= dd * uy; rz -= dd * uz; const rl = Math.hypot(rx, ry, rz) || 1; up = [rx / rl, ry / rl, rz / rl];
    parts = [[-1.6, 1.6, -0.1, 0.42, false], [-0.95, 0.55, 0.42, 0.85, true]]; wheels = [1.15, -1.15];
  } else {
    if (!alive[R.n] || !alive[R.n2]) return;
    ux = px[R.n] - px[R.n2]; uy = py[R.n] - py[R.n2]; uz = pz[R.n] - pz[R.n2]; const L = Math.hypot(ux, uy, uz) || 1; ux /= L; uy /= L; uz /= L; up = R.up;
    cx = px[R.n]; cy = py[R.n]; cz = pz[R.n];
    parts = R.end > 0 ? [[-1.15, 0.45, -0.1, 0.42, false], [-1.15, -0.6, 0.42, 0.85, true]] : [[-1.15, 0.45, -0.1, 0.42, false], [-1.15, -0.2, 0.42, 0.85, true]]; wheels = [0];
  }
  let sxv = uy * up[2] - uz * up[1], syv = uz * up[0] - ux * up[2], szv = ux * up[1] - uy * up[0]; const sl = Math.hypot(sxv, syv, szv) || 1; sxv /= sl; syv /= sl; szv /= sl;
  const uvx = up[0], uvy = up[1], uvz = up[2], s = R.s;
  if (!R.rgb) R.rgb = hex(R.col);
  const box = (ul, ur, vb, vt, win) => {
    const sl_ = -0.62, sr = 0.62, C = [], col = R.rgb;
    for (const A of [ul, ur]) for (const B of [sl_, sr]) for (const Cc of [vb, vt]) C.push([cx + ux * A * s + sxv * B * s + uvx * Cc * s, cy + uy * A * s + syv * B * s + uvy * Cc * s, cz + uz * A * s + szv * B * s + uvz * Cc * s]);
    const faces = [[[0, 1, 3, 2], [-ux, -uy, -uz]], [[4, 6, 7, 5], [ux, uy, uz]], [[0, 4, 5, 1], [-sxv, -syv, -szv]], [[2, 3, 7, 6], [sxv, syv, szv]], [[0, 2, 6, 4], [-uvx, -uvy, -uvz]], [[1, 5, 7, 3], [uvx, uvy, uvz]]];
    for (const [idx, nrm] of faces) {
      const c0 = C[idx[0]], c2 = C[idx[2]], mx = (c0[0] + c2[0]) / 2 - cam.x, my = (c0[1] + c2[1]) / 2 - cam.y, mz = (c0[2] + c2[2]) / 2 - cam.z;
      if (mx * nrm[0] + my * nrm[1] + mz * nrm[2] > 0) continue;
      const lit = 0.55 + 0.45 * Math.max(0, nrm[0] * LDIR[0] + nrm[1] * LDIR[1] + nrm[2] * LDIR[2]);
      let ok = true; const pts = idx.map(q => { pr(C[q][0], C[q][1], C[q][2]); if (PZ < NEAR) ok = false; return [PX, PY]; });
      if (!ok) continue;
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
      ctx.fillStyle = win && Math.abs(nrm[1]) < 0.5 ? rgb([207, 227, 247], lit) : rgb(col, lit); ctx.fill();
    }
  };
  ctx.lineJoin = 'round';
  for (const A of wheels) for (const B of [-0.72, 0.72]) {
    const k = pr(cx + ux * A * s + sxv * B * s - uvx * 0.1 * s, cy + uy * A * s + syv * B * s - uvy * 0.1 * s, cz + uz * A * s + szv * B * s - uvz * 0.1 * s);
    if (PZ < NEAR) continue; ctx.fillStyle = '#1F2937'; ctx.beginPath(); ctx.arc(PX, PY, 0.3 * s * k, 0, TAU); ctx.fill();
  }
  for (const p of parts) box(p[0], p[1], p[2], p[3], p[4]);
}
function drawBall(B) {
  const k = pr(B.x, B.y, B.z); if (PZ < NEAR) return; const r = B.r * k;
  if (B.fire) { const g = ctx.createRadialGradient(PX, PY, 0, PX, PY, r * 3); g.addColorStop(0, 'rgba(255,200,80,.9)'); g.addColorStop(0.4, 'rgba(255,110,30,.45)'); g.addColorStop(1, 'rgba(255,80,20,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(PX, PY, r * 3, 0, TAU); ctx.fill(); }
  const g = ctx.createRadialGradient(PX - r * 0.35, PY - r * 0.4, r * 0.1, PX, PY, r); if (B.fire) { g.addColorStop(0, '#FFE9A8'); g.addColorStop(1, '#C8501C'); } else { g.addColorStop(0, '#9AA5B5'); g.addColorStop(1, '#2B3240'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(PX, PY, r, 0, TAU); ctx.fill();
}
function drawLamp(i) {
  const k = pr(px[i], py[i], pz[i]); if (PZ < NEAR) return; const r = 0.42 * k;
  const g = ctx.createRadialGradient(PX, PY, 0, PX, PY, r * 2.4); g.addColorStop(0, 'rgba(255,236,170,.95)'); g.addColorStop(0.3, 'rgba(255,214,120,.5)'); g.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(PX, PY, r * 2.4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#FFF4C8'; ctx.beginPath(); ctx.arc(PX, PY, r * 0.5, 0, TAU); ctx.fill();
}
function drawTornado(T) {
  const N = 16, fade = T.fade;
  for (let k = 0; k <= N; k++) {
    const y = T.h * k / N, Rf = T.r * (1 + y / T.h * 1.4) * 1.1, cx = T.x + Math.sin(y * 0.07 + T.ph) * T.r * 0.35 * Math.min(1, y / T.h);
    const kk = pr(cx, y, T.z); if (PZ < NEAR) continue; const rx = Rf * kk, ry = rx * (0.22 + 0.5 * Math.sin(cam.pitch));
    ctx.fillStyle = `rgba(110,118,130,${0.1 * fade})`; ctx.beginPath(); ctx.ellipse(PX, PY, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(70,78,92,${0.32 * fade})`; ctx.lineWidth = Math.max(1, rx * 0.05);
    for (let s = 0; s < 2; s++) { const a0 = T.ph * 3 + k * 0.9 + s * 3.14; ctx.beginPath(); ctx.ellipse(PX, PY, rx, ry, 0, a0, a0 + 2.3); ctx.stroke(); }
  }
}
function drawParticles() {
  for (let i = 0; i < pc; i++) {
    const k = pr(pX[i], pY[i], pZ[i]); if (PZ < NEAR) continue;
    const u = pL[i] / pM[i], r = Math.max(0.8, S.size * 0.0075 * pS[i] * k), K = pK[i];
    if (K === 2) { const rr = r * (0.45 + u * 0.8); ctx.fillStyle = `rgba(255,${Math.round(70 + 150 * u)},30,${0.5 * u + 0.1})`; ctx.beginPath(); ctx.ellipse(PX, PY - rr * 0.5, rr * 0.6, rr * 1.15, 0, 0, TAU); ctx.fill(); if (u > 0.45 && !lite) { ctx.fillStyle = `rgba(255,235,150,${(u - 0.45) * 1.3})`; ctx.beginPath(); ctx.ellipse(PX, PY - rr * 0.2, rr * 0.3, rr * 0.6, 0, 0, TAU); ctx.fill(); } }
    else if (K === 0) { ctx.fillStyle = `rgba(255,${Math.round(90 + 110 * u)},40,${Math.min(1, u * 1.6)})`; ctx.beginPath(); ctx.arc(PX, PY, Math.max(0.9, r * 0.55), 0, TAU); ctx.fill(); }
    else if (K === 1) { ctx.fillStyle = `rgba(255,246,200,${u})`; ctx.fillRect(PX - 1, PY - 1, 2.4, 2.4); }
    else if (K === 3) { ctx.fillStyle = `rgba(90,96,108,${0.35 * u})`; ctx.beginPath(); ctx.arc(PX, PY, r * (1.4 - u * 0.6), 0, TAU); ctx.fill(); }
  }
}

let slash = [], hoverInfo = null, ptrScr = null;
function render() {
  const w = cam.w, h = cam.h;
  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  cam.update(shake * 7);
  for (let i = 0; i < nN; i++) { if (!alive[i]) { sz[i] = -1; continue; } const k = pr(px[i], py[i], pz[i]); sx[i] = PX; sy[i] = PY; sz[i] = PZ; }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  drawGround(); if (!lite) drawShadows();
  // depth-sorted items
  const items = [];
  for (let mi = 0; mi < mem.length; mi++) { const m = mem[mi]; if (!m.alive || m.hid || m.kind === LINK) continue; const d = (sz[m.a] + sz[m.b]) * 0.5; items.push([d, 0, mi]); }
  for (let pi = 0; pi < panels.length; pi++) { const P = panels[pi]; if (!P.ok) continue; let d = 0; for (let k = 0; k < P.n.length; k++) d += sz[P.n[k]]; items.push([d / P.n.length + 0.3 * S.u, 1, pi]); }
  for (let ri = 0; ri < riders.length; ri++) { const R = riders[ri]; if (R.dead) continue; items.push([(sz[R.n] + sz[R.ns[1]]) * 0.5, 2, ri]); }
  for (let bi = 0; bi < balls.length; bi++) { const B = balls[bi]; pr(B.x, B.y, B.z); items.push([PZ, 3, bi]); }
  for (let ti = 0; ti < tornadoes.length; ti++) { const T = tornadoes[ti]; pr(T.x, T.h * 0.3, T.z); items.push([PZ, 4, ti]); }
  for (let i = 0; i < nN; i++) if (glow[i] && alive[i]) items.push([sz[i], 5, i]);
  items.sort((a, b) => b[0] - a[0]);
  for (const it of items) {
    switch (it[1]) { case 0: drawMember(mem[it[2]]); break; case 1: drawPanel(panels[it[2]]); break; case 2: { const R = riders[it[2]], dp = -py[R.n]; if (dp > 0.15 * S.u && rift.gap > 0) ctx.globalAlpha = Math.max(0.12, 1 - dp / (S.pit * 0.9)); R.t === 'p' ? drawPerson(R) : drawCar(R); ctx.globalAlpha = 1; break; } case 3: drawBall(balls[it[2]]); break; case 4: drawTornado(tornadoes[it[2]]); break; case 5: drawLamp(it[2]); break; }
  }
  drawParticles();
  // shock rings
  for (const r of rings) { const u = r.t / 0.8, rr = r.R * (0.15 + u), k = pr(r.x, r.y, r.z); if (PZ < NEAR) continue; ctx.strokeStyle = `rgba(255,170,70,${0.7 * (1 - u)})`; ctx.lineWidth = Math.max(1.5, 5 * (1 - u)); ctx.beginPath(); ctx.ellipse(PX, PY, rr * k, rr * k * (0.2 + 0.6 * Math.sin(cam.pitch)), 0, 0, TAU); ctx.stroke(); }
  // wind streaks
  if (gust) {
    const dxs = gust.dx * cam.rx + gust.dz * cam.rz, dys = -(gust.dx * cam.ux + gust.dz * cam.uz), l = Math.hypot(dxs, dys) || 1, ux = dxs / l, uy = dys / l;
    if (streaks.length < 46 && Math.random() < 0.8) streaks.push({ x: rnd(0, w), y: rnd(0, h * 0.9), l: rnd(40, 130), v: rnd(700, 1300), t: 0 });
    ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let i = streaks.length - 1; i >= 0; i--) { const s = streaks[i]; s.x += ux * s.v / 60; s.y += uy * s.v / 60; s.t += 1 / 60; if (s.x < -200 || s.x > w + 200 || s.y < -200 || s.y > h + 200 || s.t > 1.2) { streaks.splice(i, 1); continue; } ctx.strokeStyle = `rgba(255,255,255,${0.55 * gust.env})`; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - ux * s.l, s.y - uy * s.l); ctx.stroke(); ctx.strokeStyle = `rgba(110,150,200,${0.3 * gust.env})`; ctx.beginPath(); ctx.moveTo(s.x - ux * 3, s.y - uy * 3 + 2); ctx.lineTo(s.x - ux * s.l, s.y - uy * s.l + 2); ctx.stroke(); }
  }
  // grabbing line and hover marks
  if (grab && alive[grab.i]) { ctx.strokeStyle = 'rgba(29,95,209,.8)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx[grab.i], sy[grab.i]); ctx.lineTo(grab.sx, grab.sy); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(29,95,209,.9)'; ctx.beginPath(); ctx.arc(sx[grab.i], sy[grab.i], 6, 0, TAU); ctx.fill(); }
  else if (hoverInfo) {
    ctx.lineWidth = 3; ctx.strokeStyle = tool === 'fire' ? 'rgba(255,120,30,.9)' : 'rgba(29,95,209,.85)';
    if (hoverInfo.n !== undefined && alive[hoverInfo.n]) { ctx.beginPath(); ctx.arc(sx[hoverInfo.n], sy[hoverInfo.n], 9, 0, TAU); ctx.stroke(); }
    else if (hoverInfo.m !== undefined && mem[hoverInfo.m].alive) { const m = mem[hoverInfo.m]; ctx.lineWidth = 10; ctx.strokeStyle = tool === 'fire' ? 'rgba(255,140,40,.5)' : 'rgba(29,95,209,.4)'; ctx.beginPath(); ctx.moveTo(sx[m.a], sy[m.a]); ctx.lineTo(sx[m.b], sy[m.b]); ctx.stroke(); }
  }
  // sword trail
  ctx.lineCap = 'round';
  for (let i = slash.length - 1; i >= 0; i--) {
    const s = slash[i]; s.age += 1 / 60; if (s.age > 0.5) { slash.splice(i, 1); continue; }
    if (i === 0) continue; const p = slash[i - 1]; if (p.brk) continue;
    const u = 1 - s.age / 0.5;
    ctx.strokeStyle = `rgba(120,175,255,${0.6 * u})`; ctx.lineWidth = 16 * u; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(s.x, s.y); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${u})`; ctx.lineWidth = 4.5 * u; ctx.stroke();
  }
  if (tool === 'hand' && ptrScr && ptrScr.in) drawHand(ptrScr.x, ptrScr.y, ptrScr.down);
}
function drawHand(x, y, down) {
  const s = Math.min(cam.w, cam.h) * 0.07 * (down ? 1.1 : 1), ang = ptrScr.ang || 0;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = down ? 0.85 : 0.5; ctx.fillStyle = '#F2C9A5'; ctx.strokeStyle = '#B98A66'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.8, s * 0.95, 0, 0, TAU); ctx.fill(); ctx.stroke();
  for (let f = 0; f < 4; f++) { const a = (-0.5 + f * 0.33), fx = Math.sin(a) * s * 0.7, fy = -Math.cos(a) * s * 0.75; ctx.beginPath(); ctx.ellipse(fx, fy - s * 0.35, s * 0.17, s * 0.5, a, 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(-s * 0.85, -s * 0.05, s * 0.2, s * 0.45, -1.1, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore(); ctx.globalAlpha = 1;
}

/* ===================== 6. input and interface ===================== */
const TOOLS = [
  ['pluck', 'Pluck', 'Drag a joint to pull it. Drag empty space to turn the view.'],
  ['cut', 'Cut cable', 'Click or sweep across cables to cut them. A car is snapped in two, a person is knocked over.'],
  ['strut', 'Break strut', 'Click or sweep across struts and beams to break them.'],
  ['sword', 'Samurai sword', 'Drag a line across the scene. Everything it crosses is sliced in two.'],
  ['fire', 'Fire', 'Click a member to set it alight. Fire spreads along the structure.'],
  ['ball', 'Wrecking ball', 'Click to throw a heavy ball at that spot.'],
  ['meteor', 'Meteor', 'Click to call a meteor down on that spot.'],
  ['hand', 'Giant hand', 'Drag across the scene to flick and swat it.'],
  ['wind', 'Wind gust', 'Click to blow a gust across the scene.'],
  ['tornado', 'Tornado', 'Press and hold to steer a tornado with the pointer.']];
const ACTS = [
  ['quake-side', 'Quake: side', 'Earthquake, side to side'], ['quake-up', 'Quake: up', 'Earthquake, up and down'], ['quake-rift', 'Quake: rift', 'Earthquake, the ground splits'], ['quake-roll', 'Quake: wave', 'Earthquake, a rolling wave'],
  ['tornado-across', 'Tornado across', 'A tornado crosses the scene'], ['inferno', 'Set everything on fire', 'Set everything on fire']];
let tool = 'pluck', msgTimer = 0;
const msgEl = $('fun-msg').firstElementChild;
function say(t, ms) { msgEl.textContent = t; clearTimeout(msgTimer); if (t) msgTimer = setTimeout(() => { msgEl.textContent = ''; }, ms || 6000); }

function svgCur(body, hx, hy, fb) { return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>${body}</svg>`)}") ${hx} ${hy},${fb || 'crosshair'}`; }
const wo = (d, c, w) => `<path d='${d}' fill='none' stroke='#fff' stroke-width='${w + 3}' stroke-linecap='round' stroke-linejoin='round'/><path d='${d}' fill='none' stroke='${c}' stroke-width='${w}' stroke-linecap='round' stroke-linejoin='round'/>`;
const CUR = {
  pluck: svgCur(wo('M16 7a9 9 0 1 0 .01 0Z', '#1D5FD1', 2.6) + `<circle cx='16' cy='16' r='2.6' fill='#1D5FD1'/>`, 16, 16),
  cut: svgCur(wo('M7 7L25 25M25 7L7 25', '#C62828', 3.2) + `<circle cx='7' cy='25' r='3' fill='none' stroke='#C62828' stroke-width='2'/><circle cx='25' cy='25' r='3' fill='none' stroke='#C62828' stroke-width='2'/>`, 16, 16),
  strut: svgCur(`<path d='M12 12 L28 28' stroke='#fff' stroke-width='6.5' stroke-linecap='round'/><path d='M7 16 L16 7' stroke='#fff' stroke-width='12'/><path d='M12 12 L28 28' stroke='#8A5A0B' stroke-width='3.6' stroke-linecap='round'/><path d='M7.6 15.4 L15.4 7.6' stroke='#0E3A75' stroke-width='9'/>`, 5, 17),
  sword: svgCur(wo('M4 28L27 5', '#C9D3E3', 3) + wo('M7 19L13 25', '#0E3A75', 3.4) + wo('M3 29L8 24', '#8A5A0B', 4), 27, 5),
  fire: svgCur(`<path d='M16 3C18 9 24 12 24 19A8 8 0 0 1 8 19C8 15 11 13 12 9C14 11 15 8 16 3Z' fill='#F26B1D' stroke='#fff' stroke-width='2'/><path d='M16 14C17 17 20 18 20 21A4 4 0 0 1 12 21C12 19 15 18 16 14Z' fill='#FFD54A'/>`, 16, 26),
  ball: svgCur(`<circle cx='16' cy='16' r='10' fill='#3A4352' stroke='#fff' stroke-width='2'/><circle cx='12.5' cy='12.5' r='3' fill='#9AA5B5'/>`, 16, 16),
  meteor: svgCur(`<path d='M4 4L18 16' stroke='#fff' stroke-width='9' stroke-linecap='round'/><path d='M4 4L18 16' stroke='#F2A33B' stroke-width='5' stroke-linecap='round'/><circle cx='20' cy='20' r='8' fill='#6B3E26' stroke='#fff' stroke-width='2'/>`, 20, 20),
  hand: svgCur(`<ellipse cx='16' cy='19' rx='8' ry='9' fill='#F2C9A5' stroke='#fff' stroke-width='3'/><ellipse cx='16' cy='19' rx='8' ry='9' fill='#F2C9A5' stroke='#B98A66' stroke-width='1.2'/><path d='M9 14V7M13 12V4M17.5 12V4M22 14V7' stroke='#B98A66' stroke-width='3.4' stroke-linecap='round'/>`, 16, 16),
  wind: svgCur(wo('M4 11H20a3.5 3.5 0 1 0-3.5-3.5M4 17H26a3.5 3.5 0 1 1-3.5 3.5M4 23H15', '#3B6FB0', 2.6), 16, 16),
  tornado: svgCur(wo('M5 7H27M8 13H24M11 19H21M14 25H18', '#4B5668', 3), 16, 26)
};
(() => {
  const st = document.createElement('style');
  st.textContent = Object.keys(CUR).map(k => `.fun-stage[data-tool="${k}"] canvas{cursor:${CUR[k]}}`).join('') + '.fun-stage[data-grab="1"] canvas{cursor:grabbing}';
  document.head.appendChild(st);
})();

/* --- picking --- */
function pickNode(mx, my, maxd) {
  let best = -1, bd = maxd * maxd;
  for (let i = 0; i < nN; i++) { if (!alive[i] || pinned[i] || sz[i] < NEAR) continue; const d = (sx[i] - mx) ** 2 + (sy[i] - my) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}
function segDist(mx, my, x1, y1, x2, y2) { const ex = x2 - x1, ey = y2 - y1, L2 = ex * ex + ey * ey + 1e-9; let t = ((mx - x1) * ex + (my - y1) * ey) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(mx - x1 - ex * t, my - y1 - ey * t); }
function pickMember(mx, my, maxd, filt) {
  let best = -1, bd = maxd;
  for (let mi = 0; mi < mem.length; mi++) {
    const m = mem[mi]; if (!m.alive || m.hid || m.kind === LINK || (filt && !filt(m))) continue;
    if (sz[m.a] < NEAR || sz[m.b] < NEAR) continue;
    const d = segDist(mx, my, sx[m.a], sy[m.a], sx[m.b], sy[m.b]) - Math.max(0, m.th * cam.f / sz[m.a] * 0.5);
    if (d < bd) { bd = d; best = mi; }
  }
  return best;
}
const isCab = m => m.kind >= CABLE, isStr = m => m.kind <= BEAM;
function hoverPick(mx, my) {
  hoverInfo = null; const r = coarse ? 30 : 18;
  if (tool === 'pluck') { const n = pickNode(mx, my, coarse ? 48 : 30); if (n >= 0) hoverInfo = { n }; }
  else if (tool === 'cut') { const m = pickMember(mx, my, r, isCab); if (m >= 0) hoverInfo = { m }; }
  else if (tool === 'strut') { const m = pickMember(mx, my, r, isStr); if (m >= 0) hoverInfo = { m }; }
  else if (tool === 'fire') { const m = pickMember(mx, my, r + 10); if (m >= 0) hoverInfo = { m }; }
}
// riders on screen: nearest toy person or car to a point, and slicing them with the sword
function riderSegs(R) {
  const o = [];
  if (R.t === 'p') o.push([R.n, R.h]); else if (R.t === 'c') o.push([R.n, R.n2], [R.n, R.n3], [R.n2, R.n3]); else o.push([R.n, R.n2]);
  return o;
}
function pickRider(mx, my, maxd) {
  let best = null, bd = maxd;
  for (const R of riders) {
    if (R.dead) continue;
    for (const [a, b] of riderSegs(R)) { if (!alive[a] || !alive[b] || sz[a] < NEAR || sz[b] < NEAR) continue; const d = segDist(mx, my, sx[a], sy[a], sx[b], sy[b]) - R.s * 0.3 * cam.f / sz[a]; if (d < bd) { bd = d; best = R; } }
  }
  return best;
}
function hitRider(R, dx, dy, dz) {
  if (R.t === 'p') knock(R, dx * 0.6, 2.5 * Math.sqrt(R.s) + 1, dz * 0.6); else if (R.t === 'c') splitCar(R, dx * 0.2, dy * 0.2, dz * 0.2);
  else for (const n of R.ns) { vx[n] += dx * 0.4; vy[n] += 2; vz[n] += dz * 0.4; }
}
function segInter(ax, ay, bx, by, cx, cy, dx, dy) { // returns [t along ab, s along cd] or null
  const r = [bx - ax, by - ay], s = [dx - cx, dy - cy], den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * s[1] - (cy - ay) * s[0]) / den, u = ((cx - ax) * r[1] - (cy - ay) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null;
}
function slashSeg(x0, y0, x1, y1) {
  const n = mem.length; let hit = 0;
  for (let mi = 0; mi < n; mi++) {
    const m = mem[mi]; if (!m.alive || m.hid || m.kind === LINK) continue;
    const a = m.a, b = m.b, za = sz[a], zb = sz[b]; if (za < NEAR || zb < NEAR) continue;
    const I = segInter(x0, y0, x1, y1, sx[a], sy[a], sx[b], sy[b]); if (!I) continue;
    const s = I[1], zi = 1 / ((1 - s) / za + s / zb), t = clamp((zi - za) / (zb - za), 0.03, 0.97);
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
    sliceMem(mi, t, (cam.rx * dx - cam.ux * dy) / l, -(cam.uy * dy) / l, (cam.rz * dx - cam.uz * dy) / l); hit++;
  }
  const sdx = x1 - x0, sdy = y1 - y0, sl = Math.hypot(sdx, sdy) || 1, wx = (cam.rx * sdx - cam.ux * sdy) / sl, wy = -(cam.uy * sdy) / sl, wz = (cam.rz * sdx - cam.uz * sdy) / sl, kk = 0.25 * S.size;
  for (const R of riders.slice()) {
    if (R.dead) continue;
    for (const [a, b] of riderSegs(R)) { if (!alive[a] || !alive[b] || sz[a] < NEAR || sz[b] < NEAR) continue; if (segInter(x0, y0, x1, y1, sx[a], sy[a], sx[b], sy[b])) { hitRider(R, wx * kk, wy * kk, wz * kk); hit++; break; } }
  }
  return hit;
}
function shoot(x, y, fire) {
  const r = rayAt(x, y);
  if (!fire) { const o = [r.o[0] + r.d[0] * cam.dist * 0.15, r.o[1] + r.d[1] * cam.dist * 0.15, r.o[2] + r.d[2] * cam.dist * 0.15]; throwBall(o, r.d, false); say('Wrecking ball away.', 2500); return; }
  let tgt = groundHit(x, y);
  if (!tgt) { const t = (cam.dist) ; tgt = [r.o[0] + r.d[0] * t, Math.max(0, r.o[1] + r.d[1] * t), r.o[2] + r.d[2] * t]; }
  // aim at the first thing along the ray if the pointer is over the structure
  const nid = pickNode(x, y, 40); if (nid >= 0) tgt = [px[nid], py[nid], pz[nid]];
  const dir = [-0.35, 0.9, 0.22], dl = Math.hypot(...dir), far = S.size * 2.4;
  const start = [tgt[0] + dir[0] / dl * far, tgt[1] + dir[1] / dl * far, tgt[2] + dir[2] / dl * far];
  throwBall(start, [-dir[0] / dl, -dir[1] / dl, -dir[2] / dl], true); say('Meteor incoming.', 2500);
}

/* --- pointers --- */
const pts = new Map(); let mode = null, last = null, gest = null, vyawS = 0;
function local(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function setGrabAttr(v) { $('fun-stage').dataset.grab = v ? '1' : '0'; }
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); cv.focus({ preventScroll: true });
  const [x, y] = local(e); pts.set(e.pointerId, { x, y });
  if (pts.size === 2) { const a = [...pts.values()]; gest = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), z: cam.zoom, cx: (a[0].x + a[1].x) / 2, cy: (a[0].y + a[1].y) / 2 }; grab = null; setGrabAttr(false); mode = 'gesture'; const T = tornadoes.find(t => t.held); if (T) T.held = false; return; }
  if (pts.size > 2) return;
  last = { x, y, t: e.timeStamp }; vyawS = 0; cam.vyaw = 0;
  if (e.button === 1 || e.button === 2) { mode = 'rot'; return; }
  mode = 'rot';
  if (tool === 'pluck') { const n = pickNode(x, y, coarse ? 52 : 34); if (n >= 0) { mode = 'pluck'; const ray = rayAt(x, y), c = ray.d[0] * cam.fx + ray.d[1] * cam.fy + ray.d[2] * cam.fz, t = sz[n] / c; grab = { i: n, t, x: px[n], y: py[n], z: pz[n], sx: x, sy: y }; setGrabAttr(true); } }
  else if (tool === 'cut' || tool === 'strut') { mode = 'rot'; paintHit(x, y, true); if (mode === 'paint') return; }
  else if (tool === 'fire') { const m = pickMember(x, y, coarse ? 46 : 36); if (m >= 0) { burnAt(m); mode = 'paint'; hoverInfo = null; } }
  else if (tool === 'sword') { mode = 'slash'; slash = [{ x, y, age: 0 }]; }
  else if (tool === 'ball') { mode = 'none'; shoot(x, y, false); }
  else if (tool === 'meteor') { mode = 'none'; shoot(x, y, true); }
  else if (tool === 'hand') { mode = 'swat'; ptrScr = { x, y, in: true, down: true, ang: 0 }; }
  else if (tool === 'wind') { mode = 'none'; const right = x > cam.w * 0.62 ? -1 : 1; startGust(cam.rx * right, cam.rz * right); say('Gust.', 2000); }
  else if (tool === 'tornado') {
    mode = 'tornado'; const g = groundHit(x, y) || [S.cx, 0, S.cz]; const T = startTornado(g[0], g[2], 0, 0, true); T.held = true; T.tx = g[0]; T.tz = g[2];
  }
  e.preventDefault();
});
function paintHit(x, y, first) {
  const R = pickRider(x, y, coarse ? 14 : 8);
  if (R) { hitRider(R, rnd(-1, 1) * S.size * 0.2, 0, rnd(-1, 1) * S.size * 0.2); mode = 'paint'; hoverInfo = null; return true; }
  const m = pickMember(x, y, coarse ? 30 : 20, tool === 'cut' ? isCab : isStr);
  if (m >= 0) {
    const mm = mem[m]; killMem(m, 'cut'); mode = 'paint';
    const mx = lerp(px[mm.a], px[mm.b], 0.5), my = lerp(py[mm.a], py[mm.b], 0.5), mz = lerp(pz[mm.a], pz[mm.b], 0.5);
    for (let q = 0; q < (tool === 'strut' ? 8 : 4); q++) emit(1, mx, my, mz, rnd(-1, 1) * S.size * 0.1, rnd(0, 1) * S.size * 0.12, rnd(-1, 1) * S.size * 0.1, rnd(0.25, 0.5), 0.6);
    if (tool === 'strut' && !reduce) shake = Math.max(shake, 0.35);
    hoverInfo = null; return true;
  }
  return false;
}
cv.addEventListener('pointermove', e => {
  const [x, y] = local(e); if (pts.has(e.pointerId)) pts.set(e.pointerId, { x, y });
  ptrScr = ptrScr || {}; const pang = ptrScr; ptrScr = { x, y, in: true, down: mode === 'swat', ang: pang.ang || 0 };
  if (mode === 'gesture' && pts.size >= 2) {
    const a = [...pts.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), cx = (a[0].x + a[1].x) / 2, cy = (a[0].y + a[1].y) / 2;
    cam.zoom = clamp(gest.z * gest.d / Math.max(20, d), 0.12, 3.5); cam.yaw -= (cx - gest.cx) * 0.007; cam.pitch = clamp(cam.pitch + (cy - gest.cy) * 0.006, 0.03, 1.45); gest.cx = cx; gest.cy = cy; return;
  }
  if (!last || !pts.has(e.pointerId) || pts.size > 1) { if (e.pointerType === 'mouse') hoverPick(x, y); return; }
  const dx = x - last.x, dy = y - last.y, dtm = Math.max(4, e.timeStamp - last.t) / 1000;
  if (mode === 'rot') { cam.yaw -= dx * 0.007; cam.pitch = clamp(cam.pitch + dy * 0.006, 0.03, 1.45); vyawS = -dx * 0.007 / dtm * 0.5; }
  else if (mode === 'pluck' && grab) { grab.sx = x; grab.sy = y; const r = rayAt(x, y); grab.x = r.o[0] + r.d[0] * grab.t; grab.y = Math.max(0.1, r.o[1] + r.d[1] * grab.t); grab.z = r.o[2] + r.d[2] * grab.t; }
  else if (mode === 'paint') { if (tool === 'fire') { const m = pickMember(x, y, 30); if (m >= 0) burnAt(m); } else paintHit(x, y); }
  else if (mode === 'slash') { slash.push({ x, y, age: 0 }); const n = slashSeg(last.x, last.y, x, y); if (n && !reduce) shake = Math.max(shake, 0.2); if (slash.length > 40) slash.shift(); }
  else if (mode === 'swat') {
    ptrScr.ang = Math.atan2(dy, dx) + Math.PI / 2; ptrScr.down = true;
    const R = Math.min(cam.w, cam.h) * 0.13, sp = Math.hypot(dx, dy) / dtm;
    for (let i = 0; i < nN; i++) {
      if (!alive[i] || pinned[i] || sz[i] < NEAR) continue; const d = Math.hypot(sx[i] - x, sy[i] - y); if (d > R) continue;
      const k = (1 - d / R) * sz[i] / cam.f / dtm * 0.9, f = Math.min(1, 22 / (Math.hypot(dx, dy) * k + 1e-6));
      const wx = (cam.rx * dx - cam.ux * dy) * k * f, wy = (-cam.uy * dy) * k * f, wz = (cam.rz * dx - cam.uz * dy) * k * f;
      vx[i] += wx; vy[i] += wy + 1; vz[i] += wz;
    }
  }
  else if (mode === 'tornado') { const g = groundHit(x, y); const T = tornadoes.find(t => t.held); if (g && T) { T.tx = g[0]; T.tz = g[2]; } }
  last = { x, y, t: e.timeStamp };
});
function endPtr(e) {
  pts.delete(e.pointerId);
  if (pts.size < 2 && mode === 'gesture') { mode = null; gest = null; }
  if (pts.size === 0) {
    if (mode === 'rot' && !reduce) cam.vyaw = clamp(vyawS, -3, 3);
    if (mode === 'pluck') { grab = null; setGrabAttr(false); }
    const T = tornadoes.find(t => t.held); if (T) T.held = false;
    if (ptrScr) ptrScr.down = false;
    if (mode === 'slash') { slash.push({ x: -1e4, y: -1e4, age: 9, brk: true }); }
    mode = null; last = null;
  }
}
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('pointerleave', e => { if (ptrScr) ptrScr.in = false; hoverInfo = null; });
cv.addEventListener('wheel', e => { if (!e.ctrlKey && document.activeElement !== cv) return; e.preventDefault(); cam.zoom = clamp(cam.zoom * Math.exp(e.deltaY * 0.0012), 0.12, 3.5); }, { passive: false });
cv.addEventListener('keydown', e => {
  const k = e.key; let used = true;
  if (k === 'ArrowLeft') cam.yaw -= 0.12; else if (k === 'ArrowRight') cam.yaw += 0.12; else if (k === 'ArrowUp') cam.pitch = clamp(cam.pitch + 0.08, 0.03, 1.45); else if (k === 'ArrowDown') cam.pitch = clamp(cam.pitch - 0.08, 0.03, 1.45);
  else if (k === '+' || k === '=') cam.zoom = clamp(cam.zoom * 0.88, 0.12, 3.5); else if (k === '-') cam.zoom = clamp(cam.zoom / 0.88, 0.12, 3.5);
  else if (k === 'Enter' || k === ' ') { const free = []; for (let i = 0; i < nN; i++) if (alive[i] && !pinned[i]) free.push(i); if (free.length) { const i = free[Math.floor(Math.random() * free.length)]; vy[i] += S.size * 0.6; vx[i] += rnd(-1, 1) * S.size * 0.3; } }
  else used = false;
  if (used) e.preventDefault();
});

/* --- interface --- */
$('fun-zin').addEventListener('click', () => { cam.zoom = clamp(cam.zoom * 0.8, 0.12, 3.5); });
$('fun-zout').addEventListener('click', () => { cam.zoom = clamp(cam.zoom / 0.8, 0.12, 3.5); });
function mk(parent, cls, text, attrs) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chipbtn' + (cls ? ' ' + cls : ''); b.textContent = text; for (const k in attrs) b.setAttribute(k, attrs[k]); parent.appendChild(b); return b; }
const toolBtns = {};
const sceneSel = $('fun-scene');
SCENES.forEach((sc, i) => { const o = document.createElement('option'); o.value = i; o.textContent = sc.name; sceneSel.appendChild(o); });
sceneSel.addEventListener('change', () => chooseScene(+sceneSel.value));
TOOLS.forEach(([id, label, hint]) => { const b = mk($('fun-tools'), '', label, { title: hint,  'aria-pressed': id === tool ? 'true' : 'false' }); b.addEventListener('click', () => setTool(id)); toolBtns[id] = b; });
ACTS.forEach(([id, label, ttl]) => { const b = mk($('fun-acts'), id === 'inferno' ? 'hot' : '', label, { title: ttl }); b.addEventListener('click', () => act(id)); });
function setTool(id) { tool = id; hoverInfo = null; for (const k in toolBtns) toolBtns[k].setAttribute('aria-pressed', k === id ? 'true' : 'false'); $('fun-stage').dataset.tool = id; say(TOOLS.find(t => t[0] === id)[2]); }
function chooseScene(i) { sceneSel.value = i; loadScene(i); say(SCENES[i].name + '. Pick a tool and have a go.'); }
function act(id) {
  if (id.startsWith('quake-')) { const k = id.slice(6); if (k === 'rift' && rift.gap > 0) { say('The ground is already split. Reset to close it.'); return; } startQuake(k); say({ side: 'Earthquake: the ground shakes side to side.', up: 'Earthquake: the ground jolts up and down.', rift: 'Earthquake: the ground splits down the middle.', roll: 'Earthquake: a rolling wave crosses the ground.' }[k]); }
  else if (id === 'tornado-across') { tornadoAcross(); say('A tornado is crossing the scene.'); }
  else if (id === 'inferno') { igniteAll(); say('Everything is alight.'); }
}
$('fun-reset').addEventListener('click', () => { loadScene(sceneIx, true); say('Rebuilt and healthy.', 3000); });
$('fun-pause').addEventListener('click', e => { paused = !paused; e.currentTarget.setAttribute('aria-pressed', paused ? 'true' : 'false'); e.currentTarget.textContent = paused ? 'Paused' : 'Pause'; });
const SLOW = [1, 0.25, 0.1];
$('fun-slow').addEventListener('click', e => { const k = (SLOW.indexOf(timeScale) + 1) % SLOW.length; timeScale = SLOW[k]; e.currentTarget.textContent = 'Slow: ' + (timeScale === 1 ? '1x' : timeScale === 0.25 ? '0.25x' : '0.1x'); });
$('fun-moon').addEventListener('click', e => { const on = grav > 5; grav = on ? 1.62 : 9.81; e.currentTarget.setAttribute('aria-pressed', on ? 'true' : 'false'); say(on ? 'Low gravity: things fall slowly and fly far.' : 'Normal gravity.', 3000); });
$('fun-surprise').addEventListener('click', () => {
  const opts = [
    () => { tornadoAcross(); say('Surprise: a tornado.'); },
    () => { startQuake(['side', 'up', 'roll', 'rift'][Math.floor(Math.random() * 4)]); say('Surprise: an earthquake.'); },
    () => { for (let k = 0; k < 3; k++) setTimeout(() => { const a = rnd(0, TAU), r = rnd(0, 0.5) * S.size; const x = S.cx + Math.cos(a) * r, z = S.cz + Math.sin(a) * r, dir = [-0.35, 0.9, 0.22], dl = Math.hypot(...dir), far = S.size * 2.4, y = rnd(0, S.size * 0.5); throwBall([x + dir[0] / dl * far, y + dir[1] / dl * far, z + dir[2] / dl * far], [-dir[0] / dl, -dir[1] / dl, -dir[2] / dl], true); }, k * 650); say('Surprise: a meteor shower.'); },
    () => { const a = rnd(0, TAU); startGust(Math.cos(a), Math.sin(a)); for (let k = 0; k < 3; k++) { const m = Math.floor(rnd(0, mem.length)); burnAt(m); } say('Surprise: a gale, and a few sparks.'); },
    () => { for (let k = 0; k < 4; k++) setTimeout(() => { const a = rnd(0, TAU); const o = [S.cx + Math.cos(a) * S.size * 2.2, rnd(0.1, 0.5) * S.size, S.cz + Math.sin(a) * S.size * 2.2], d = [S.cx - o[0], S.cy * 0.8 - o[1], S.cz - o[2]], l = Math.hypot(...d); throwBall(o, d.map(v => v / l), false); }, k * 500); say('Surprise: wrecking balls from every side.'); }
  ];
  opts[Math.floor(Math.random() * opts.length)]();
});

/* --- readout, sizing, loop --- */
const readEl = $('fun-read'); let readT = 0;
const chips = ['Standing', 'Cables cut', 'Struts broken', 'Burnt', 'Peak tension'].map(l => { const s = document.createElement('span'); readEl.appendChild(s); return [s, l]; });
function readout() {
  const pk = cnt.peak >= 1000 ? (cnt.peak / 1000).toFixed(1) + ' kN' : Math.round(cnt.peak) + ' N';
  const v = [cnt.alive + ' of ' + cnt.total, cnt.cut, cnt.broke, cnt.burnt, pk];
  chips.forEach(([s, l], i) => { const t = `${l} `; if (!s.firstChild) { s.innerHTML = `${l} <b></b>`; } s.lastChild.textContent = v[i]; });
}
function resize() {
  const r = cv.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
  const w = Math.max(200, Math.round(r.width)), h = Math.max(200, Math.round(r.height));
  if (cam.w !== w || cam.h !== h || cam.dpr !== dpr || cv.width !== Math.round(w * dpr)) { cam.w = w; cam.h = h; cam.dpr = dpr; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
}
if (window.ResizeObserver) new ResizeObserver(resize).observe(cv); window.addEventListener('resize', resize);
let visible = true; if (window.IntersectionObserver) new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 }).observe($('fun-stage'));
let lastTs = 0, acc = 0, drawMs = 0, fpsAvg = 60;
function loop(ts) {
  requestAnimationFrame(loop);
  if (document.hidden || !visible) { lastTs = ts; return; }
  const el = Math.min(100, ts - (lastTs || ts)); lastTs = ts; acc += el / 1000; fpsAvg = fpsAvg * 0.95 + (1000 / Math.max(1, el)) * 0.05;
  let steps = 0;
  while (acc >= 1 / 60 && steps < 2) { if (!paused) stepFrame(); acc -= 1 / 60; steps++; }
  if (acc > 0.1) acc = 0;
  if (!steps) return;
  const t0 = performance.now(); resize(); render(); drawMs = drawMs * 0.9 + (performance.now() - t0) * 0.1;
  if (cam.vyaw && !reduce) { cam.yaw += cam.vyaw / 60; cam.vyaw *= 0.94; if (Math.abs(cam.vyaw) < 0.01) cam.vyaw = 0; }
  const total = FR.ms + drawMs; lite = total > 9 ? true : total < 4.5 ? false : lite; if (total > (coarse ? 22 : 13) && FR.sub > 5) FR.sub--; else if (total < (coarse ? 9 : 6) && FR.sub < (coarse ? 8 : 10)) FR.sub++;
  if ((readT += 1) % 15 === 0) readout();
}
function statsNow() {
  let nan = 0, maxv = 0, an = 0; for (let i = 0; i < nN; i++) { if (!alive[i]) continue; an++; if (!isFinite(px[i] + py[i] + pz[i])) nan++; maxv = Math.max(maxv, Math.hypot(vx[i], vy[i], vz[i])); }
  return { scene: S.id, nodes: an, nodesBuilt: nN, members: mem.filter(m => m.alive && !m.hid).length, total: cnt.total, standing: cnt.alive, cut: cnt.cut, broke: cnt.broke, burnt: cnt.burnt, peak: Math.round(cnt.peak), nan, maxSpeed: +maxv.toFixed(2), simMs: +FR.ms.toFixed(2), drawMs: +drawMs.toFixed(2), fps: Math.round(fpsAvg), sub: FR.sub, riders: riders.filter(r => !r.dead).length, people: riders.filter(r => r.t === 'p' && !r.dead).length, standingPeople: riders.filter(r => r.t === 'p' && !r.dead && r.st).length, carBodies: riders.filter(r => r.t !== 'p' && !r.dead).length, fellIn: riders.filter(r => r.fell).length, particles: pc, tornadoes: tornadoes.length, rift: +rift.gap.toFixed(2), quake: Q.kind, balls: balls.length, burning: burning.length, grav, size: +S.size.toFixed(1) };
}
window.funRoom = {
  scenes: SCENES.map(s => s.id), tools: TOOLS.map(t => t[0]),
  load: id => { const i = typeof id === 'number' ? id : SCENES.findIndex(s => s.id === id); chooseScene(i); }, stats: statsNow,
  step: n => { for (let k = 0; k < n; k++) stepFrame(); render(); }, act, setTool, cam, shoot, startQuake,
  node: i => ({ x: sx[i], y: sy[i], z: sz[i], px: px[i], py: py[i], pz: pz[i], vx: vx[i], vy: vy[i], vz: vz[i], cont: cont[i], w: wI[i] }), pickNode, pickMember, members: () => mem, kill: mi => killMem(mi, 'cut'), ignite: mi => burnAt(mi),
  deadMem: () => mem.map((m, i) => [i, m.alive, m.kind, +m.st.toFixed(3), +m.L0.toFixed(1), m.orig]).filter(a => !a[1] && a[5]),
  fast: v => { const r = []; for (let i = 0; i < nN; i++) if (alive[i] && Math.hypot(vx[i], vy[i], vz[i]) > v) r.push([i, isRider[i], +px[i].toFixed(1), +py[i].toFixed(1), +pz[i].toFixed(1), +Math.hypot(vx[i], vy[i], vz[i]).toFixed(1)]); return r; },
  dead: () => { const r = []; for (let i = 0; i < nN; i++) if (!alive[i]) r.push([i, +px[i].toFixed(1), +py[i].toFixed(1), +pz[i].toFixed(1), deg[i]]); return r; },
  riders: () => riders.map(R => ({ n: R.n, id: R.id, t: R.t, dead: !!R.dead, st: R.st, x: px[R.n], y: py[R.n], z: pz[R.n], fell: !!R.fell, air: R.air, why: R.why, tq: R.tq, ok: R.ns.every(i => isFinite(px[i] + py[i] + pz[i])), upy: R.upy })),
  render, paused: p => { paused = p; }
};
resize();
setTool('pluck'); loadScene(0);
say('Pick a scene and a tool, then wreck it. Reset puts everything back.', 7000);
readout();
requestAnimationFrame(loop);
})();
