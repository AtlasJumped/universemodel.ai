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
let room = false, rscale = coarse ? 0.8 : 1, flash = 0, lastFlashAt = 0;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

/* ===================== 1. core data ===================== */
const NMAX = 3400, MMAX = 3200;
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
// the world around the structures
let barrels = [], crowns = [], flam = [], water = [], pathsL = [], tufts = [], blooms = [], birds = [], drones = [], dragons = [], shells = [], ufo = null, flood = null, armed = false, props = [], seed = 1, boomT = 0, lamps = [];
const elevN = new Uint8Array(NMAX), envN = new Uint8Array(NMAX);
const E = { on: false, y: 0, lv: [], k: 0, wait: 0, dir: 1, x: 0, z: 0, y0: 0 };
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
  alive.fill(0); elevN.fill(0); envN.fill(0); barrels = []; crowns = []; flam = []; water = []; pathsL = []; tufts = []; blooms = []; birds = []; drones = []; dragons = []; shells = []; ufo = null; flood = null; armed = false; props = []; boomT = 0; lamps = []; E.on = false; E.y = 0; E.lv = []; E.k = 0; E.wait = 0; cont.fill(0); pinned.fill(0); isRider.fill(0); riderOf.fill(-1); chx.fill(0); chz.fill(0); nRN = 0; upList.length = 0; lift.fill(0); drg.fill(0); glow.fill(0); deg.fill(0);
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
  panels.push({ n: ns, ms, col, al: alpha, floor: !!(o && o.floor), glass: !!(o && o.glass), deco: !!(o && (o.deco || o.glass && o.deco)), uv: (o && o.uv) || null, tag: (o && o.tag) || '', broken: false, z: 0 });
}
const lerp = (a, b, t) => a + (b - a) * t;

/* riders: toy people and cars. Every one is made of real solver nodes, so gravity, support, wind, quakes and impacts all apply.
   A person is a hip and a head joined by a rigid link, with a soft balance that keeps them upright until they are knocked
   over (then they tumble and lie where they land). A car is a rigid triangle of two axles and a roof, so it can roll and flip. */
function person(x, y, z, s, col) {
  const r = 0.5 * s, hip = node(x, y + r, z, s * s * s + 0.12, false), head = node(x, y + r + 0.86 * s, z, 0.25 * s * s * s + 0.03, false);
  nr[hip] = r; nr[head] = 0.2 * s; isRider[hip] = isRider[head] = 1; drg[hip] = drg[head] = 0.5; fric[hip] = 0.3; fric[head] = 0.05;
  const lk = add(hip, head, LINK, { k: 1, hid: true, stub: true, pre: 1 }); mem[lk].orig = false;
  riders.push({ t: 'p', n: hip, h: head, ns: [hip, head], s, col, st: 1, air: 0, run: 0, tq: 0, tp: rnd(0.5, 2.4), lx: x, ly: y + r, lz: z, lks: [lk], fell: false, id: riders.length, hx: x, hz: z, wr: (y > 0.3 ? 0.6 : 5.5) * Math.sqrt(s), gx: x, gz: z, lim: y > 0.3 ? [x - 1.3, x + 1.3, z - 1.3, z + 1.3] : null, gt: rnd(0, 2), ph: rnd(0, 6), wk: 0, dn: 0, cr: 0, gr: 1, pt: 0, safe: false, job: null, tl: 0, sw: 0, ws: 0, spd: 0, hd: 1, lvl: -1 });
  riderOf[hip] = riderOf[head] = riders.length - 1;
  return riders[riders.length - 1];
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
  if (R.t !== 'p' || R.dead || R.safe) return;
  R.dn = 0; R.cr = 0; R.job = null; R.gr = 1;
  if (R.st && !grace) sfx('gasp', 0.6);
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

/* ---- 1b. the world around the structures: grass, trees, water, barrels, glass ---- */
function sfx(n, v, x) { if (window.funSound) window.funSound.play(n, v, x); }
const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rr = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
// a tree or bush: a free crown held on a tripod of three trunk members, so it is flammable and can be broken
function tree(x, z, h, o) {
  o = o || {}; const bush = h < 1.5, br = 0.16 * (bush ? 0.8 : 1);
  const top = node(x, h, z, bush ? 0.6 : 1.3 + 0.15 * h); nr[top] = bush ? 0.3 : 0.4; drg[top] = 0.6; envN[top] = 1;
  const ids = [];
  for (let k = 0; k < 3; k++) { const a = TAU * k / 3 + 0.4, b = node(x + br * Math.cos(a), 0.02, z + br * Math.sin(a), 1, true); envN[b] = 1; ids.push(beam(b, top, { col: bush ? '#5A4630' : '#6B4A2B', ts: bush ? 0.7 : 1.3, brk: 0.06 })); }
  ids.forEach(mi => { const m = mem[mi]; if (!m) return; m.tree = true; m.orig = false; m.burnT = bush ? 4 : 6.5; flam.push(mi); });
  crowns.push({ n: top, ms: ids, x, z, h, r: o.r || (bush ? 0.85 : 1.25 + 0.09 * h), bush, tone: rr(), fruit: o.fruit || 0 });
}
// a gasoline barrel: a single heavy body that rolls and pushes people. A spark, a hit or a blast sets it off.
function barrel(x, z, y, o) {
  const sc = (o && o.s) || 1, n = node(x, (y || 0) + 0.45 * sc, z, 1.6 * sc * sc * sc + 0.1); nr[n] = 0.42 * sc; isRider[n] = 3; drg[n] = 0.5; fric[n] = 0.55;
  riders.push({ t: 'b', n, ns: [n], s: sc, kind: (o && o.kind) || 'gas', fuse: -1, hit: false, st: 1, id: riders.length });
  riderOf[n] = riders.length - 1;
}
// a wooden crate stack: a braced frame that burns
function crates(x0, z0, nx, nz, ns, c, col) {
  const a = mem.length, G = frame({ x0, z0, nx, nz, bw: c, bd: c, y0: 0, ns, sh: c, m: 0.9, col: col || '#9A6B3F', ts: 0.55, faces: 'fblr', floorCol: '#C99A62', pre: 0.985 });
  for (let mi = a; mi < mem.length; mi++) if (mem[mi].kind <= BEAM) { mem[mi].burnT = 4.5; flam.push(mi); }
  for (let l = 0; l < ns; l++) for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { if (j === 0) panel([G[l][i][0], G[l][i + 1][0], G[l + 1][i + 1][0], G[l + 1][i][0]], '#B98450', 0.9); if (j === nz - 1) panel([G[l][i][nz], G[l][i + 1][nz], G[l + 1][i + 1][nz], G[l + 1][i][nz]], '#A9753F', 0.9); }
  return G;
}
// glass panes over a face of a frame. face: f (z0 side), b, l, r. Skips cells for which skip(i, l) is true.
function glaze(G, face, l0, l1, skip, col) {
  const nx = G[0].length - 1, nz = G[0][0].length - 1;
  const n = (l, i, j) => G[l][i][j];
  for (let l = l0; l < l1; l++) {
    if (face === 'f' || face === 'b') { const j = face === 'f' ? 0 : nz; for (let i = 0; i < nx; i++) { if (skip && skip(i, l)) continue; panel([n(l, i, j), n(l, i + 1, j), n(l + 1, i + 1, j), n(l + 1, i, j)], col || '#BFE3F2', 0.36, { glass: true }); } }
    else { const i = face === 'l' ? 0 : nx; for (let j = 0; j < nz; j++) { if (skip && skip(j, l)) continue; panel([n(l, i, j), n(l, i, j + 1), n(l + 1, i, j + 1), n(l + 1, i, j)], col || '#BFE3F2', 0.36, { glass: true }); } }
  }
}
// a flat decoration on a cell (door, sign): a rectangle inside the quad. uv = [u0, u1, v0, v1]
function decal(ns, col, uv, tag) { panel(ns, col, 0.95, { deco: true, uv, tag }); }
function lake(cx, cz, rx, rz, shape) { water.push({ x: cx, z: cz, rx, rz, sh: shape || 'oval' }); }
const inWater = (x, z, m) => { m = m || 0; for (let k = 0; k < water.length; k++) { const w = water[k]; if (w.res) continue; if (w.sh === 'rect') { if (Math.abs(x - w.x) < w.rx + m && Math.abs(z - w.z) < w.rz + m) return w; } else { const a = (x - w.x) / (w.rx + m), b = (z - w.z) / (w.rz + m); if (a * a + b * b < 1) return w; } } return null; };
function pathway(pts, w, col, dash) { pathsL.push({ pts, w, col: col || '#D8C79F', dash: !!dash }); }
const onPath = (x, z, m) => { for (const p of pathsL) for (let i = 0; i < p.pts.length - 1; i++) { const a = p.pts[i], b = p.pts[i + 1], ex = b[0] - a[0], ez = b[1] - a[1], t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez + 1e-9), 0, 1); if (Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t) < p.w / 2 + (m || 0)) return true; } return false; };
// structure bounds from the nodes placed so far
function bounds() { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y1 = 0; for (let i = 0; i < nN; i++) { if (isRider[i]) continue; x0 = Math.min(x0, px[i]); x1 = Math.max(x1, px[i]); z0 = Math.min(z0, pz[i]); z1 = Math.max(z1, pz[i]); y1 = Math.max(y1, py[i]); } return { x0, x1, z0, z1, y1 }; }
// fill in the environment: trees and bushes outside the structure, grass tufts and flowers, a flock of birds
function envFill(o) {
  o = o || {}; const B = o.box || bounds(), pad = o.pad !== undefined ? o.pad : 3, spread = o.spread !== undefined ? o.spread : 0.3 * Math.max(B.x1 - B.x0, B.z1 - B.z0) + 5;
  const X0 = B.x0 - spread, X1 = B.x1 + spread, Z0 = B.z0 - spread, Z1 = B.z1 + spread, placed = [], keep = o.keep || [];
  const free = (x, z, r) => {
    if (x > B.x0 - pad && x < B.x1 + pad && z > B.z0 - pad && z < B.z1 + pad) return false;
    if (inWater(x, z, 1.2) || onPath(x, z, 1.2)) return false;
    for (const k of keep) if (Math.hypot(x - k[0], z - k[1]) < k[2]) return false;
    for (const p of placed) if (Math.hypot(x - p[0], z - p[1]) < r + p[2]) return false;
    for (let i = 0; i < nN; i++) if (isRider[i] && Math.abs(px[i] - x) < 2.2 && Math.abs(pz[i] - z) < 2.2) return false;
    return true;
  };
  const put = (n, hmin, hmax, rad) => { for (let a = 0; a < n; a++) for (let t = 0; t < 30; t++) { const x = lerp(X0, X1, rr()), z = lerp(Z0, Z1, rr()); if (!free(x, z, rad)) continue; const h = lerp(hmin, hmax, rr()); placed.push([x, z, rad]); tree(x, z, h); break; } };
  put(o.trees !== undefined ? o.trees : 9, 3.2, 5.6, 2.6); put(o.bushes !== undefined ? o.bushes : 9, 0.8, 1.2, 1.3);
  const nt = coarse ? 70 : 150, G = Math.max(B.x1 - B.x0, B.z1 - B.z0) * 1.6 + 30;
  for (let i = 0; i < nt; i++) { const x = (rr() * 2 - 1) * G, z = (rr() * 2 - 1) * G; if (inWater(x, z, 0.5) || onPath(x, z, 0.4)) continue; tufts.push([x, z, 0.25 + rr() * 0.4, rr() * 6]); }
  for (let i = 0; i < (coarse ? 14 : 34); i++) { const x = (rr() * 2 - 1) * G * 0.6, z = (rr() * 2 - 1) * G * 0.6; if (inWater(x, z, 0.5) || onPath(x, z, 0.4)) continue; blooms.push([x, z, Math.floor(rr() * 4)]); }
  const nb = o.birds !== undefined ? o.birds : 6; for (let i = 0; i < nb; i++) birds.push({ a: rr() * TAU, r: 0.5 * Math.max(B.x1 - B.x0, B.z1 - B.z0) + 6 + rr() * 8, y: 12 + rr() * 8, w: (rr() < 0.5 ? -1 : 1) * (0.12 + rr() * 0.1), ph: rr() * 6, cx: (B.x0 + B.x1) / 2, cz: (B.z0 + B.z1) / 2, sc: 0, run: 0 });
  S.env = Object.assign({ sky: 'day', ground: 'grass' }, o.env || {});
}
// lamp post: a tripod mast with a lamp node on top that glows at dusk and night
function lamppost(x, z, h) {
  const top = node(x, h, z, 0.8); nr[top] = 0.2; glow[top] = 2; lamps.push(top); envN[top] = 1;
  for (let k = 0; k < 3; k++) { const a = TAU * k / 3 + 0.2, b = node(x + 0.2 * Math.cos(a), 0.02, z + 0.2 * Math.sin(a), 1, true); envN[b] = 1; const mi = strut(b, top, { ts: 0.55, col: '#4A5568' }); mem[mi].orig = false; }
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
      if (l >= 1 && !o.noPanels && !(o.skip && o.skip(i, j, l))) panel([G[l][i][j], G[l][i + 1][j], G[l][i + 1][j + 1], G[l][i][j + 1]], o.floorCol || '#BFD3EA', 0.55, { floor: true });
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
  ridgeTent(-9, -2, 0.2, 1.0, '#E8A33D'); ridgeTent(9, 4, -0.5, 1.15, '#3BA0A5'); ridgeTent(0, -9, 0.05, 1.9, '#D9553E');
  bellTent(-4, 6, 1.0, '#7FB069', 7); bellTent(5, -1, 1.15, '#B565A7', 8); bellTent(-12, 8, 0.9, '#E5C546', 6);
  crates(-2.2, 1.2, 1, 1, 1, 1.1, '#7A5C3E');            // the woodpile for the evening fire
  lake(13, 13, 6.5, 4.2); pathway([[-16, -5], [-6, 1], [4, 5], [11, 10]], 2.2);
  [[-6, 2], [-2, 4], [3, 7], [14, -2], [-8, -6], [-14, 2], [-1, -3], [10, -3], [-5, 10], [1, 0]].forEach(([x, z], i) => person(x, 0, z, 1, PCOL[i % 6]));
  car(14, 0, -6, 1.1, '#C23B3B', null); car(-15, 0, -8, 1.0, '#2F6DB5', null);
  barrel(11.6, -9.6); barrel(12.8, -9.2); barrel(-16.6, -10);
  envFill({ trees: 10, bushes: 10, pad: 3, keep: [[13, 13, 8]] }); S.view = [0.5, 0.4]; S.name = 'Tent camp';
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
  lake(-19, 8, 5, 3.4); pathway([[-14, 4], [-8, 10], [0, 12]], 2); barrel(14, 8); barrel(15, 7.2);
  envFill({ trees: 9, bushes: 8, pad: 3, keep: [[-19, 8, 7]] }); S.view = [0.55, 0.3]; S.name = 'Tensegrity tower';
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
  [[-28, 8], [28, -7], [30, 5], [-31, -4], [-27, -9], [27, 10]].forEach(([x, z], i) => person(x, 0, z, 1, PCOL[(i + 1) % 6])); car(-33, 0, 12, 1.1, '#2F6DB5', null);
  for (const R of riders) if (R.t === 'p' && R.hz > -2.5 && R.hz < 2.5 && R.ly > 5) { R.lim = [R.hx - 5, R.hx + 5, -1.5, 1.5]; R.wr = 4; }
  lake(0, 0, 22, 16, 'rect'); pathway([[-34, 8], [-26, 8], [-24, 2]], 2.4); pathway([[34, -6], [26, -6], [24, -2]], 2.4);
  barrel(-36, 6); barrel(35, -8);
  envFill({ trees: 8, bushes: 7, pad: 2, spread: 7 }); S.view = [0.35, 0.22]; S.name = 'Suspension bridge';
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
function balloon(bx, bz, by, cA, cB, rot) {
  // hot-air balloon, tethered: a compression ring, hot-air pressure and a basket on cables
  const nR = 8, PR = 3;
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
    const j = (i + 1) % nR, c = i % 2 ? cA : cB;
    panel([apx, A2[i], A2[j]], c, 0.9); panel([A2[i], A2[j], eq[j], eq[i]], c, 0.9); panel([eq[i], eq[j], B2[j], B2[i]], c, 0.9); panel([B2[i], B2[j], thr[Math.floor(j / 2) % 4], thr[Math.floor(i / 2)]], c, 0.9);
  }
  for (let i = 0; i < 4; i++) { cable(thr[i], thr[(i + 1) % 4], { pre: 0.98 }); cable(thr[i], bk[i], { pre: 0.995, ts: 0.8 }); cable(thr[i], bk[(i + 1) % 4], { pre: 0.995, ts: 0.6 }); cable(hub, thr[i], { pre: 0.99, ts: 0.5 }); }
  let Me = 0, Mb = 0; envNodes.forEach(n => Me += 1 / wI[n]); bk.forEach(n => Mb += 1 / wI[n]); Mb += 1;
  const up = (9.81 * (Me + Mb) + 0.4 * 9.81 * Mb) / Me;
  envNodes.forEach(n => { lift[n] = up; drg[n] = 0.9; });
  [0, 1].forEach(k => { const st = node(bx + (k ? 6 : -6) * Math.cos(rot) - (k ? 3 : -3) * Math.sin(rot), 0.02, bz + (k ? 6 : -6) * Math.sin(rot) + (k ? 3 : -3) * Math.cos(rot), 1, true); cable(bk[k ? 2 : 0], st, { pre: 1.0, ts: 0.9, k: 3 }); });
  person(bx, by + 0.04, bz, 0.5, PCOL[0]);
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
  balloon(-14, -9, 7, '#E0523F', '#F3C13A', 0);
  // road with cars
  car(-6, 0, 14, 1.1, '#2F6DB5', { ux: 1, lim: 18, zalt: 16 }); car(8, 0, 16, 1.0, '#C23B3B', { ux: -1, lim: 18, zalt: 14 }); car(0, 0, 14, 0.9, '#D98A1C', { ux: 1, lim: 18, zalt: 16 });
  [[-7, 3], [1, -4], [7, 5], [-1, 1], [0, 10], [-13, 2], [10, 4]].forEach(([x, z], i) => person(x, 0, z, 1, PCOL[i % 6]));
  lake(19, -1, 3.4, 5); pathway([[-20, 15], [20, 15]], 4.5, '#6B7280', true); pathway([[-9, 11], [-3, 7], [2, 3], [10, 3]], 1.8);
  barrel(-1, -12); barrel(0.2, -12.6);
  S.avoid = [[-12.5, -7.5, -4, 0], [-6, 0, -11, -7], [1.8, 6.2, -2, 2], [-7, -0.5, 3, 9], [8.3, 11.7, 6, 10]];
  envFill({ trees: 9, bushes: 9, pad: 3, spread: 6, keep: [[19, -1, 6]] }); S.view = [0.55, 0.38]; S.name = 'Village';
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
  [[-14, 0], [-5, 9], [4, -7], [14, 1], [-1, 0], [6, 9], [-12, -7], [11, -7], [0, -6], [-6, -6]].forEach(([x, z], i) => person(x, 0, z, 1, PCOL[(i + 3) % 6]));
  car(-12, 0, 18, 1.1, '#C23B3B', { ux: 1, lim: 20, zalt: 20 }); car(10, 0, 20, 1.0, '#2F6DB5', { ux: -1, lim: 20, zalt: 18 });
  // glass shopfronts, a glass pavilion, wooden crates and gasoline barrels
  const SF = frame({ x0: -15, z0: -11.4, nx: 5, nz: 1, bw: 6, bd: 1.4, y0: 0, ns: 2, sh: 2.6, m: 3, col: '#5E6B80', ts: 0.9, pin: true, faces: 'fblr', noPanels: true, pre: 0.98 }); glaze(SF, 'f', 0, 2); glaze(SF, 'b', 0, 2); glaze(SF, 'f', 0, 0);
  const PV = frame({ x0: 13, z0: -9.5, nx: 2, nz: 2, bw: 2.4, bd: 2.4, y0: 0, ns: 2, sh: 2.6, m: 3, col: '#5E6B80', ts: 0.9, pin: true, faces: 'fblr', noPanels: true, pre: 0.98 }); ['f', 'b', 'l', 'r'].forEach(f => glaze(PV, f, 0, 2));
  crates(-17.2, 4, 1, 2, 2, 1.2); crates(16.5, 3, 1, 1, 2, 1.2); crates(-17, -7.5, 1, 1, 1, 1.2, '#8A5A2B');
  [-15, -11, -7, 7, 11, 15].forEach(x => barrel(x, 9.6)); barrel(-3, -9.2); barrel(3.4, -9.0);
  pathway([[-26, 19], [26, 19]], 5, '#6B7280', true); lake(-23, -15, 4.5, 3.2);
  envFill({ trees: 8, bushes: 6, pad: 2.5, spread: 5, keep: [[-23, -15, 6]] }); S.view = [0.55, 0.36]; S.name = 'Market hall'; S.tool = 'strut';
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
  barrel(0.3, -1.5, 0, { s: 0.35 }); barrel(-0.7, 2.0, 0, { s: 0.35 });
  envFill({ trees: 0, bushes: 0, birds: 0, pad: 0, spread: 0.5, env: { sky: 'indoor' } }); S.view = [0.45, 0.3]; S.name = 'Smash room';
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
  lake(14, 6, 4.5, 3.4); barrel(-9, 3); barrel(-9.8, 4);
  envFill({ trees: 8, bushes: 8, pad: 3, spread: 5, keep: [[14, 6, 6]] }); S.view = [0.35, 0.18]; S.name = 'Stick-figure human';
}

// a few riders always stand along the line where the ground can split, so the rift has something to swallow
function riftRiders(sc) {
  let zm = 0; for (let i = 0; i < nN; i++) if (!isRider[i] && Math.abs(px[i]) < 3.5 * sc) zm = Math.min(zm, pz[i]);
  const z = zm - 3.4 * sc;
  person(0.05 * sc, 0, z, sc, PCOL[2]); person(-0.1 * sc, 0, z - 1.8 * sc, sc, PCOL[4]); car(0, 0, z - 4.6 * sc, 1.0 * sc, '#D98A1C', null, true);
}
// wall panels over a face of a frame (blocks people and balls like a wall)
function wallPanels(G, face, l0, l1, col, al, skip) {
  const nx = G[0].length - 1, nz = G[0][0].length - 1, n = (l, i, j) => G[l][i][j];
  for (let l = l0; l < l1; l++) {
    if (face === 'f' || face === 'b') { const j = face === 'f' ? 0 : nz; for (let i = 0; i < nx; i++) { if (skip && skip(i, l)) continue; panel([n(l, i, j), n(l, i + 1, j), n(l + 1, i + 1, j), n(l + 1, i, j)], col, al || 0.9); } }
    else { const i = face === 'l' ? 0 : nx; for (let j = 0; j < nz; j++) { if (skip && skip(j, l)) continue; panel([n(l, i, j), n(l, i, j + 1), n(l + 1, i, j + 1), n(l + 1, i, j)], col, al || 0.9); } }
  }
}
// a roof panel set over the top level of a frame
function roofOf(G, l, col, skip) { const nx = G[0].length - 1, nz = G[0][0].length - 1; for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { if (skip && skip(i, j)) continue; panel([G[l][i][j], G[l][i + 1][j], G[l][i + 1][j + 1], G[l][i][j + 1]], col, 0.96); } }
// a tripod mast with a pennant on top, held by three base nodes
function mast(a, b, c, h, col) {
  const x = (px[a] + px[b] + px[c]) / 3, y = (py[a] + py[b] + py[c]) / 3, z = (pz[a] + pz[b] + pz[c]) / 3, t = node(x, y + h, z, 0.6);
  [a, b, c].forEach(n => strut(n, t, { ts: 0.5, col: '#4A5568' }));
  const f1 = node(x + 1.4, y + h - 0.2, z, 0.2, false, { drag: 1.2 }), f2 = node(x + 1.4, y + h - 1.0, z, 0.2, false, { drag: 1.2 });
  fab(t, f1, { pre: 1.0 }); fab(f1, f2, { pre: 1.0 }); fab(f2, t, { pre: 1.0 }); panel([t, f1, f2], col || '#D9553E', 0.92); return t;
}
function walkLimit(R, x0, x1, z0, z1) { if (R) { R.lim = [x0, x1, z0, z1]; } return R; }
/* --- city street --- */
function buildCity() {
  S.m = 6; S.k = 4; S.u = 1; S.ks = 0.5;
  pathway([[-27, 0], [27, 0]], 7, '#5C6573', true); pathway([[-27, 4.9], [27, 4.9]], 3.2, '#D9D4C7'); pathway([[-27, -4.9], [27, -4.9]], 3.2, '#D9D4C7');
  // the tower: a glass front, a door, a roof and a glass elevator
  const T = frame({ x0: -10, z0: 7, nx: 3, nz: 1, bw: 4, bd: 7, y0: 0, ns: 6, sh: 3.2, m: 6, col: '#7E8BA0', ts: 1.1, pre: 0.98, faces: 'lrb', floorCol: '#CFDDEE', skip: (i, j, l) => i === 0 && j === 0 });
  glaze(T, 'f', 0, 6, (i, l) => i === 1 && l === 0);
  decal([T[0][1][0], T[0][2][0], T[1][2][0], T[1][1][0]], '#7A4B2A', [0.28, 0.72, 0, 0.74], 'door');
  decal([T[1][1][0], T[1][2][0], T[2][2][0], T[2][1][0]], '#B5533C', [0.08, 0.92, 0.02, 0.2], 'awning');
  wallPanels(T, 'b', 0, 6, '#9AA7BB', 0.85); roofOf(T, 6, '#4F5663'); mast(T[6][1][0], T[6][2][0], T[6][2][1], 4.2, '#C23B3B');
  // elevator cab: pinned nodes that ride up and down the shaft, a floor panel people stand on, glass walls on three sides, open toward +x
  const cx0 = -9.5, cx1 = -6.2, cz0 = 9.2, cz1 = 11.6, cab = [];
  for (const y of [0.04, 2.6]) for (const [x, z] of [[cx0, cz0], [cx1, cz0], [cx1, cz1], [cx0, cz1]]) { const n = node(x, y, z, 5, true); elevN[n] = 1; cab.push(n); }
  const lo = cab.slice(0, 4), hi = cab.slice(4);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; const m1 = beam(lo[i], lo[j], { col: '#5E6B80', ts: 0.8 }), m2 = beam(hi[i], hi[j], { col: '#5E6B80', ts: 0.8 }), m3 = strut(lo[i], hi[i], { ts: 0.6 }); [m1, m2, m3].forEach(m => { if (m >= 0) mem[m].orig = false; }); }
  panel(lo, '#8E9BB0', 0.95, { floor: true }); panel(hi, '#8E9BB0', 0.9);
  panel([lo[0], lo[1], hi[1], hi[0]], '#BFE3F2', 0.35, { glass: true }); panel([lo[2], lo[3], hi[3], hi[2]], '#BFE3F2', 0.35, { glass: true }); panel([lo[3], lo[0], hi[0], hi[3]], '#BFE3F2', 0.35, { glass: true });
  E.on = true; E.x = (cx0 + cx1) / 2 + 0.2; E.z = (cz0 + cz1) / 2; E.lv = [0, 3.16, 6.36, 9.56, 12.76, 15.96]; E.k = 0; E.dir = 1; E.wait = 3; E.y = 0;
  // a lower office with its own door, and a corner shop
  const B2 = frame({ x0: 4, z0: 7, nx: 2, nz: 1, bw: 4.5, bd: 7, y0: 0, ns: 3, sh: 3.2, m: 5, col: '#A58E6B', ts: 1.0, floorCol: '#E5D3B0', faces: 'lrb', pre: 0.98 });
  glaze(B2, 'f', 0, 3, (i, l) => i === 0 && l === 0); decal([B2[0][0][0], B2[0][1][0], B2[1][1][0], B2[1][0][0]], '#3F6E5B', [0.28, 0.72, 0, 0.74], 'door'); wallPanels(B2, 'b', 0, 3, '#C7B48E', 0.9); roofOf(B2, 3, '#7A5C3E');
  const B3 = frame({ x0: -20, z0: 7, nx: 2, nz: 1, bw: 4.5, bd: 6, y0: 0, ns: 2, sh: 3.2, m: 5, col: '#8FA08A', ts: 1.0, floorCol: '#DCE6D6', faces: 'lrb', pre: 0.98 });
  glaze(B3, 'f', 0, 2, (i, l) => i === 1 && l === 0); decal([B3[0][1][0], B3[0][2][0], B3[1][2][0], B3[1][1][0]], '#B5533C', [0.28, 0.72, 0, 0.74], 'door'); wallPanels(B3, 'b', 0, 2, '#B7C7B0', 0.9); roofOf(B3, 2, '#5A6B58');
  // shops across the street, glass fronts toward the road
  const B4 = frame({ x0: 2, z0: -13, nx: 3, nz: 1, bw: 4, bd: 6, y0: 0, ns: 2, sh: 3.2, m: 5, col: '#8B7FA3', ts: 1.0, floorCol: '#DDD6EA', faces: 'flr', pre: 0.98 });
  glaze(B4, 'b', 0, 2, (i, l) => i === 1 && l === 0); decal([B4[0][1][1], B4[0][2][1], B4[1][2][1], B4[1][1][1]], '#7A4B2A', [0.28, 0.72, 0, 0.74], 'door'); wallPanels(B4, 'f', 0, 2, '#B1A7C6', 0.9); roofOf(B4, 2, '#5E5570');
  // park with a pool
  lake(-14, -11, 4.6, 3.1); pathway([[-22, -5], [-18, -8], [-14, -14.5], [-8, -10]], 1.6);
  [-19, -4, 10, 22].forEach(x => lamppost(x, 3.7, 5.6)); [-14, 4, 18].forEach(x => lamppost(x, -3.7, 5.6));
  // people on the pavements and in the park
  [[-16, 5], [-6, 4.6], [6, 5.2], [16, 4.8], [-20, -5], [0, -5.2], [12, -4.6], [20, -5], [-17, -7.5], [-9, -9]].forEach(([x, z], i) => person(x, 0, z, 1, PCOL[i % 6]));
  const el = [[-4.2, 0, 8.2], [-4.2, 3.2, 10.5], [-3.6, 9.6, 10.2], [-4, 12.8, 9.4]].map(([x, y, z], i) => { const R = person(x, y + (y ? 0.04 : 0), z, 1, PCOL[(i + 2) % 6]); R.el = { s: y ? 'idle' : 'wait', here: Math.round(y / 3.2), dest: 0, t: rnd(2, 6) }; R.wr = 1.4; R.lim = null; return R; });
  [[-3, 3], [3, 1], [-16, 2]].forEach(([x, i0], i) => 0);
  car(-18, 0, -1.7, 1.1, '#2F6DB5', { ux: 1, lim: 23, zalt: 0.5 }); car(20, 0, 0.5, 1.0, '#C23B3B', { ux: -1, lim: 23, zalt: -1.7 }); car(0, 0, -1.7, 0.95, '#D98A1C', { ux: 1, lim: 23, zalt: 0.5 });
  car(-13, 0, 3.1, 1.0, '#6B7C93', null); car(9, 0, 3.1, 1.05, '#3C9D6B', null);
  S.avoid = [[-10.5, 2.5, 6.7, 14.5], [3.5, 13.5, 6.7, 14.5], [-20.5, -10.5, 6.7, 13.5], [1.5, 14.5, -13.5, -6.5]];
  envFill({ trees: 8, bushes: 8, pad: 2, spread: 7, keep: [[-14, -11, 6]] }); S.view = [2.66, 0.3]; S.name = 'City street'; S.tool = 'pluck';
}
// ride the elevator: wait at the door, board when the cab stops at this floor, ride to another, get off, wander, come back
function elevAI(R, dt) {
  const el = R.el, i = R.n, ex = E.x, ez = E.z, lv = Math.max(0, Math.round((py[i] - 0.5 * R.s - 0.04) / 3.2)), inCab = Math.abs(px[i] - ex) < 1.5 && Math.abs(pz[i] - ez) < 1.2 && Math.abs(py[i] - 0.5 * R.s - 0.04 - E.y) < 0.6;
  const wx = -4.2, wz = 10.4 + (R.id % 3 - 1) * 0.5;
  if (el.s === 'idle') { el.t -= dt; R.gt -= dt; if (R.gt <= 0) { R.gt = rnd(1.5, 3.5); R.gx = R.hx + rnd(-1, 1); R.gz = R.hz + rnd(-1, 1); R.gx = clamp(R.gx, -5.6, 1); R.gz = clamp(R.gz, 8, 13); } walk(R, R.gx, R.gz, 0.8, dt); if (el.t <= 0) { el.s = 'wait'; el.here = lv; } }
  else if (el.s === 'wait') { walk(R, wx, wz, 0.9, dt); if (E.at === el.here && E.wait > 1.4 && Math.abs(E.y - (E.lv[el.here] || 0)) < 0.2) { el.s = 'board'; do { el.dest = Math.floor(Math.random() * E.lv.length); } while (el.dest === el.here); } }
  else if (el.s === 'board') { walk(R, ex + 0.2, ez + (R.id % 3 - 1) * 0.5, 1.1, dt); if (inCab) el.s = 'ride'; if (E.at === -1 && !inCab) el.s = 'wait'; }
  else if (el.s === 'ride') { walk(R, ex + 0.1, ez + (R.id % 3 - 1) * 0.5, 0.6, dt); if (E.at === el.dest && E.wait > 0.5) { el.s = 'out'; el.here = el.dest; } }
  else if (el.s === 'out') { const tx = el.here === 0 ? -3.6 : -3.9, tz = el.here === 0 ? 8.2 : 10.5 + (R.id % 3 - 1) * 1.4; if (walk(R, tx, tz, 1.0, dt) || Math.hypot(px[i] - tx, pz[i] - tz) < 0.5) { el.s = 'idle'; el.t = rnd(6, 12); R.hx = px[i]; R.hz = pz[i]; } }
}
/* --- castle siege --- */
function buildCastle() {
  S.m = 6; S.k = 4; S.u = 1; S.ks = 0.6;
  const stone = '#8B909B', ws = 2.6, wh = 2;
  const tower = (cx, cz, flag) => { const G = frame({ x0: cx - 2, z0: cz - 2, nx: 1, nz: 1, bw: 4, bd: 4, y0: 0, ns: 4, sh: 3, m: 6, col: '#6F7684', ts: 1.2, pin: true, floorCol: '#B6BEC9', pre: 0.98 }); ['f', 'b', 'l', 'r'].forEach(f => wallPanels(G, f, 0, 4, stone, 0.9)); roofOf(G, 4, '#6B4A36'); const ap = node(cx, 16.2, cz, 1); [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([i, j]) => beam(G[4][i][j], ap, { col: '#8A3B2F', ts: 0.9 })); for (let k = 0; k < 4; k++) { const [i, j] = [[0, 0], [1, 0], [1, 1], [0, 1]][k], [i2, j2] = [[0, 0], [1, 0], [1, 1], [0, 1]][(k + 1) % 4]; panel([G[4][i][j], G[4][i2][j2], ap], '#B5533C', 0.95); } if (flag) { const t = node(cx, 19.6, cz, 0.5); beam(ap, t, { col: '#4A5568', ts: 0.5 }); const f1 = node(cx + 1.6, 19.4, cz, 0.2, false, { drag: 1.2 }), f2 = node(cx + 1.6, 18.5, cz, 0.2, false, { drag: 1.2 }); fab(t, f1, { pre: 1 }); fab(f1, f2, { pre: 1 }); fab(f2, t, { pre: 1 }); panel([t, f1, f2], flag, 0.95); } return G; };
  const wall = (x0, z0, nx, nz, bw, bd, faces) => { const G = frame({ x0, z0, nx, nz, bw, bd, y0: 0, ns: wh, sh: ws, m: 6, col: '#707887', ts: 1.1, pin: true, floorCol: '#C9CFD8', faces: faces || 'fblr', pre: 0.98 }); (nz === 1 ? ['f', 'b'] : ['l', 'r']).forEach(f => wallPanels(G, f, 0, wh, stone, 0.9)); return G; };
  tower(-10, -10, '#C23B3B'); tower(10, -10, '#2F6DB5'); tower(-10, 10, '#2F6DB5'); tower(10, 10, '#C23B3B');
  wall(-8, -11, 2, 1, 3, 2); wall(2, -11, 2, 1, 3, 2); wall(-8, 9, 5, 1, 3.2, 2); wall(-11, -8, 1, 5, 2, 3.2); wall(9, -8, 1, 5, 2, 3.2);
  // the keep
  const K = frame({ x0: -3, z0: -1.5, nx: 2, nz: 1, bw: 3, bd: 3, y0: 0, ns: 5, sh: 3, m: 6, col: '#6A7282', ts: 1.2, pin: true, floorCol: '#B6BEC9', pre: 0.98 }); ['f', 'b'].forEach(f => wallPanels(K, f, 0, 5, '#9AA0AC', 0.9)); ['l', 'r'].forEach(f => wallPanels(K, f, 0, 5, '#9AA0AC', 0.9)); roofOf(K, 5, '#6B4A36');
  const kap = node(0, 20, 0, 1); [[0, 0], [2, 0], [2, 1], [0, 1]].forEach(([i, j]) => beam(K[5][i][j], kap, { col: '#8A3B2F', ts: 0.9 }));
  panel([K[5][0][0], K[5][2][0], kap], '#B5533C', 0.95); panel([K[5][2][0], K[5][2][1], kap], '#9E4632', 0.95); panel([K[5][2][1], K[5][0][1], kap], '#B5533C', 0.95); panel([K[5][0][1], K[5][0][0], kap], '#9E4632', 0.95);
  // the moat and a lowered drawbridge on chains
  lake(0, 15.4, 17.5, 1.9, 'rect'); lake(0, -15.4, 17.5, 1.9, 'rect'); lake(15.4, 0, 1.9, 13.5, 'rect'); lake(-15.4, 0, 1.9, 13.5, 'rect');
  const g1 = node(-1.6, 0.06, -11.5, 3, true), g2 = node(1.6, 0.06, -11.5, 3, true), d1 = node(-1.6, 0.06, -18.2, 3), d2 = node(1.6, 0.06, -18.2, 3);
  beam(g1, g2, { col: '#6B4A2B', ts: 1.1 }); beam(d1, d2, { col: '#6B4A2B', ts: 1.1 }); beam(g1, d1, { col: '#6B4A2B', ts: 1.2 }); beam(g2, d2, { col: '#6B4A2B', ts: 1.2 }); beam(g1, d2, { col: '#6B4A2B', ts: 0.8 }); panel([g1, g2, d2, d1], '#9A6B3F', 0.95, { floor: true });
  pathway([[0, -19], [0, -30]], 3, '#C9B58A');
  // powder kegs in the courtyard and by the gate, siege tents outside
  [[-5, 5], [-4, 6], [4, 6], [5, 5], [6, -5], [-6, -5], [-2, -8], [2, -8]].forEach(([x, z]) => barrel(x, z));
  ridgeTent(-16, -27, 0.3, 1.0, '#C23B3B'); ridgeTent(16, -27, -0.3, 1.0, '#2F6DB5'); bellTent(0, -34, 1.1, '#E5C546', 7);
  // defenders walk the wall tops, attackers gather outside, a few folk in the courtyard
  [[-5, -10, -1], [5, -10, -1], [-5, 10, 1], [5, 10, 1]].forEach(([x, z], i) => { const R = person(x, ws * wh + 0.04, z, 0.8, PCOL[i % 6]); walkLimit(R, x - 3, x + 3, z - 0.15, z + 0.15); R.wr = 3; });
  [[-3, -26], [0, -27], [4, -25], [-8, -24], [9, -24], [12, -30]].forEach(([x, z], i) => person(x, 0, z, 1, PCOL[(i + 3) % 6]));
  [[-6, -1], [6, 0], [0, 6], [-7, -6]].forEach(([x, z], i) => person(x, 0, z, 1, PCOL[(i + 1) % 6]));
  S.avoid = [[-12.3, -7.7, -12.3, -7.7], [7.7, 12.3, -12.3, -7.7], [-12.3, -7.7, 7.7, 12.3], [7.7, 12.3, 7.7, 12.3], [-4, 4, -3.3, 3.3]];
  envFill({ trees: 10, bushes: 8, pad: 3, spread: 9, keep: [[0, -24, 4]] }); S.view = [0.5, 0.35]; S.name = 'Castle siege'; S.tool = 'cannon';
}
/* --- hot air balloons --- */
function buildBalloons() {
  S.m = 3; S.k = 2; S.u = 1; S.ks = 0.7;
  balloon(-17, -2, 7, '#E0523F', '#F3C13A', 0); balloon(0, 4, 9, '#2F6DB5', '#F2F2F2', 1); balloon(17, -3, 6.5, '#3C9D6B', '#F3C13A', 2);
  ridgeTent(-7, -12, 0.1, 0.9, '#E8A33D'); ridgeTent(10, -13, -0.2, 0.9, '#3BA0A5'); car(2, 0, -14, 1.1, '#C23B3B', null); car(-21, 0, -10, 1.0, '#2F6DB5', null);
  lake(0, 20, 12, 3.6); pathway([[-18, -10], [-4, -4], [0, 8], [0, 16]], 2.2);
  [[-8, -6], [-2, -8], [6, -8], [12, -6], [-12, 3], [8, 5], [-4, 9], [4, 11], [-20, 5], [20, 4]].forEach(([x, z], i) => person(x, 0, z, 1, PCOL[i % 6]));
  barrel(-22, -12); barrel(-23, -11);
  envFill({ trees: 9, bushes: 8, pad: 3, spread: 7, keep: [[0, 20, 8]] }); S.view = [0.42, 0.26]; S.name = 'Hot air balloons'; S.tool = 'fire';
}
/* --- shooting range --- */
function buildRange() {
  S.m = 3; S.k = 2; S.u = 1; S.ks = 0.7;
  // the firing line
  crates(-8, -9, 6, 1, 1, 1.4, '#7A5C3E');
  // a gantry with hanging target boards
  const G = frame({ x0: -9, z0: 8, nx: 4, nz: 1, bw: 4.5, bd: 1.4, y0: 0, ns: 1, sh: 6, m: 4, col: '#6B4A2B', ts: 1.0, pin: true, faces: 'fblr', noPanels: true, pre: 0.98 });
  [-6.75, -2.25, 2.25, 6.75].forEach((x, k) => {
    const z = 8.7, w = 0.9, y = 2.2, a = node(x - w, y + 2 * w, z, 1), b = node(x + w, y + 2 * w, z, 1), c = node(x + w, y, z, 1), d = node(x - w, y, z, 1);
    [[a, b], [b, c], [c, d], [d, a], [a, c]].forEach(([p, q]) => { const mi = beam(p, q, { col: '#B88A55', ts: 0.8, brk: 0.04 }); mem[mi].burnT = 3; flam.push(mi); });
    cable(a, G[1][k][0], { pre: 0.97, ts: 0.8 }); cable(b, G[1][k + 1][0], { pre: 0.97, ts: 0.8 }); panels.push({ n: [a, b, c, d], ms: [], col: '#F6F1E3', al: 0.95, floor: false, glass: false, deco: false, uv: null, tag: 'bull', broken: false, z: 0 });
  });
  // barrels in a line, a glass wall, crate stacks, a tire of fireworks
  for (let i = 0; i < 6; i++) barrel(-10 + i * 4, 4);
  const GW = frame({ x0: -16, z0: 14, nx: 3, nz: 1, bw: 3, bd: 1, y0: 0, ns: 2, sh: 2.5, m: 3, col: '#5E6B80', ts: 0.9, pin: true, faces: 'fblr', noPanels: true, pre: 0.98 }); glaze(GW, 'f', 0, 2); glaze(GW, 'b', 0, 2);
  crates(10, 12, 2, 1, 3, 1.3); crates(14, 5, 1, 1, 2, 1.3); crates(-1, 13, 2, 1, 2, 1.3, '#8A5A2B');
  const GW2 = frame({ x0: 5, z0: 17, nx: 2, nz: 1, bw: 3, bd: 1, y0: 0, ns: 2, sh: 2.5, m: 3, col: '#5E6B80', ts: 0.9, pin: true, faces: 'fblr', noPanels: true, pre: 0.98 }); glaze(GW2, 'f', 0, 2); glaze(GW2, 'b', 0, 2);
  lake(-24, 4, 4, 6); pathway([[-14, -12], [-14, -5], [-10, 2], [0, 6]], 2);
  [[-6, -11], [-3, -11], [0, -11], [3, -11], [-12, -13]].forEach(([x, z], i) => person(x, 0, z, 1, PCOL[i % 6]));
  barrel(18, 0); barrel(19, 1.2); barrel(-18, 8);
  S.avoid = [[-16.5, -6.5, 17.5, 20.5], [-9.5, 9.5, 7.5, 9.5], [4, 12.5, 16.5, 20]];
  envFill({ trees: 8, bushes: 6, pad: 3, spread: 6, keep: [[-24, 4, 7]] }); S.view = [0.4, 0.34]; S.name = 'Shooting range'; S.tool = 'cannon';
}
/* --- fireworks night --- */
function buildFireworks() {
  S.m = 3; S.k = 2; S.u = 1; S.ks = 0.7;
  const st = frame({ x0: -4, z0: -2, nx: 3, nz: 1, bw: 3, bd: 2.4, y0: 0, ns: 1, sh: 2.6, m: 3, col: '#8A5A2B', ts: 0.9, faces: 'fblr', floorCol: '#D9553E', pre: 0.98, pin: true });
  wallPanels(st, 'b', 0, 1, '#B98450', 0.95); roofOf(st, 1, '#D9553E');
  crates(5, -1.5, 2, 1, 2, 1.2, '#9A6B3F'); crates(-9, -1, 1, 1, 2, 1.2, '#9A6B3F');
  for (let i = 0; i < 5; i++) { barrelFw(-3 + i * 1.8, 3.6); } barrelFw(8, 3); barrelFw(-7, 3.3); barrelFw(7.2, 4.4);
  lake(0, 22, 11, 4); pathway([[-14, 10], [-5, 8], [5, 8], [14, 10]], 2.4);
  [-12, -4, 4, 12].forEach(x => lamppost(x, 12, 6));
  [[-6, 9], [-2, 11], [3, 10], [7, 12], [10, 9], [-10, 12], [0, 14], [-8, 7]].forEach(([x, z], i) => person(x, 0, z, 1, PCOL[i % 6]));
  car(14, 0, 7, 1.1, '#2F6DB5', null);
  S.avoid = [[-4.8, 5.2, -2.6, 0.6], [4.4, 7.6, -2.1, -0.9]];
  envFill({ trees: 9, bushes: 7, pad: 3, spread: 7, keep: [[0, 22, 7]], env: { sky: 'night' } }); S.view = [0.45, 0.3]; S.name = 'Fireworks night'; S.tool = 'fire';
}
function barrelFw(x, z) { barrel(x, z, 0, { kind: 'fw' }); }
/* --- dam and valley --- */
function buildDam() {
  S.m = 4; S.k = 4; S.u = 1; S.ks = 0.6;
  const D = frame({ x0: -12, z0: -1.2, nx: 6, nz: 1, bw: 4, bd: 2.4, y0: 0, ns: 2, sh: 3, m: 8, col: '#7C8493', ts: 1.4, pin: true, floorCol: '#C3C9D3', faces: 'fblr', pre: 0.98 });
  wallPanels(D, 'f', 0, 2, '#A9B0BC', 0.92); wallPanels(D, 'b', 0, 2, '#9AA1AD', 0.92); roofOf(D, 2, '#B6BCC7');
  const dm = []; for (let mi = 0; mi < mem.length; mi++) if (!mem[mi].tree) dm.push(mi);
  lake(0, -17, 22, 16, 'rect'); water[water.length - 1].y = 5.6; water[water.length - 1].res = true;
  S.dam = { ms: dm, tripped: false, n0: dm.length };
  house(-12, 14, 0.1, 1.0, '#F1D9B5', '#B5533C'); house(-2, 18, -0.2, 1.1, '#CFE3D0', '#4F6D8F'); house(9, 14, 0.3, 1.0, '#F4E3C2', '#8A3B2F'); house(2, 27, 0, 1.15, '#E6D3EE', '#5E4B85');
  pathway([[-18, 9], [18, 9]], 3.4, '#8C95A3', true); car(-8, 0, 8.2, 1.0, '#C23B3B', { ux: 1, lim: 18, zalt: 9.8 }); car(8, 0, 9.8, 1.0, '#2F6DB5', { ux: -1, lim: 18, zalt: 8.2 });
  [[-6, 13], [4, 12], [14, 12], [-14, 20], [6, 21], [-6, 25], [12, 24], [-1, 11]].forEach(([x, z], i) => person(x, 0, z, 1, PCOL[i % 6]));
  barrel(15, 20); barrel(16, 21);
  S.avoid = [[-14.5, -9.5, 11.5, 16.5], [-4.5, 0.5, 15.5, 20.5], [6.8, 11.2, 11.5, 16.5], [-0.5, 4.5, 24.5, 29.5]];
  S.tick = dt => {
    const Dm = S.dam; if (!Dm) return;
    if (!Dm.tripped) { let a = 0; for (const mi of Dm.ms) if (mem[mi].alive) a++; if (a < Dm.n0 * 0.9) { Dm.tripped = true; startFlood(0, 1, true, 0); say('The dam has failed. The reservoir is coming through.', 6000); } }
    else { for (const w of water) if (w.res) w.y = Math.max(0.15, w.y - 0.5 * dt); }
  };
  envFill({ trees: 9, bushes: 8, pad: 2.5, spread: 6, keep: [[0, -17, 24]] }); S.view = [0.35, 0.3]; S.name = 'Dam and valley'; S.tool = 'cannon';
}
const SCENES = [
  { id: 'tent', name: 'Tent camp', build: buildTent },
  { id: 'tower', name: 'Tensegrity tower', build: buildTower },
  { id: 'city', name: 'City street', build: buildCity },
  { id: 'bridge', name: 'Suspension bridge', build: buildBridge },
  { id: 'village', name: 'Village', build: buildVillage },
  { id: 'mall', name: 'Market hall', build: buildMall },
  { id: 'castle', name: 'Castle siege', build: buildCastle },
  { id: 'balloons', name: 'Hot air balloons', build: buildBalloons },
  { id: 'range', name: 'Shooting range', build: buildRange },
  { id: 'fireworks', name: 'Fireworks night', build: buildFireworks },
  { id: 'dam', name: 'Dam and valley', build: buildDam },
  { id: 'room', name: 'Smash room', build: buildRoom, rs: 0.2 },
  { id: 'human', name: 'Stick-figure human', build: buildHuman }];

/* ===================== 3. physics ===================== */
let grav = 9.81, simT = 0, grace = false, simClock = 0;
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
  if (how !== 'burn' && how !== 'x' && !grace) sfx(how === 'cut' || m.kind >= CABLE ? 'snap' : 'crack', 0.6);
  if (m.orig) {
    cnt.alive--;
    if (how === 'burn') cnt.burnt++; else if (m.kind >= CABLE) cnt.cut++; else cnt.broke++;
  }
  if (m.tree) deg[m.b] = how === 'burn' ? 1 : deg[m.b] + 1;
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
  m.burn = 0; m.dur = (m.burnT || KD[m.kind].burn) * rnd(0.7, 1.25); burning.push(mi); sfx('ignite'); return true;
}

/* ---- the step ---- */
function anchorStep() {
  for (let k = 0; k < pins.length; k++) {
    const i = pins[k]; if (!alive[i]) continue;
    let x = ax0[i] + Q.ox, y = ay0[i] + (Q.kind === 'up' ? Q.oy : 0) + (elevN[i] ? E.y : 0), z = az0[i] + Q.oz;
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
  for (let k = 0; k < upList.length; k++) { const R = upList[k]; if (!alive[R.n] || !alive[R.h]) continue; const bk = R.gr < 1 ? 0.02 + 0.1 * R.gr : 0.5; px[R.h] += (px[R.n] - px[R.h]) * bk; pz[R.h] += (pz[R.n] - pz[R.h]) * bk; if (R.gr < 1) { const ty = py[R.n] + 0.86 * R.s * Math.min(1, 0.25 + R.gr); py[R.h] += (ty - py[R.h]) * 0.06; } }
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
    const P = panels[pi]; if (P.floor || P.deco || !P.ok) continue;
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
    if (!B.rk) B.vy -= grav * 0.7 * h; B.x += B.vx * h; B.y += B.vy * h; B.z += B.vz * h;
    const gy = groundY(B.x);
    if (B.bomb) { B.fuse -= h; B.tk -= h; if (B.tk <= 0) { B.lit = !B.lit; B.tk = 0.06 + 0.2 * clamp(B.fuse / 1.6, 0, 1); if (B.lit) sfx('tick', 0.5); } if (B.fuse <= 0) { B.R = 0.26 * S.size + 2; boom(B, h); return; } if ((B.age = (B.age || 0) + h) > 0.3 && burning.length && bombNearFire(B)) { B.R = 0.26 * S.size + 2; boom(B, h); return; } }
    if (B.rk && B.tg) steerRocket(B, h);
    if (B.y < gy + r) { B.y = gy + r; if (B.fire) { boom(B, h); return; } if (B.vy < -3 && !B.th) { B.th = 1; sfx('thud', 1); } if (B.vy < 0) B.vy *= B.bomb ? -0.2 : -0.32; B.vx *= B.bomb ? 0.96 : 0.995; B.vz *= B.bomb ? 0.96 : 0.995; }
    B.life -= h; if (B.life <= 0 || B.y < -S.pit - 3) { B.dead = true; continue; }
    const hitV = B.bomb ? 0.5 : Math.max(sp, 1);
    if (B.rk && pc < PMAX - 6 && Math.random() < 0.8) { emit(3, B.x, B.y, B.z, rnd(-1, 1), rnd(0, 1), rnd(-1, 1), 0.7, 1.1); emit(2, B.x, B.y, B.z, rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), 0.25, 1.0); }
    if (!B.fire && glassNear(B.x, B.y, B.z, r, B.vx * 0.05, B.vy * 0.05, B.vz * 0.05)) { B.vx *= 0.9; B.vy *= 0.9; B.vz *= 0.9; }
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
      if (B.bomb) { const vn = B.vx * nx + B.vy * ny + B.vz * nz; if (vn > 0) { B.vx -= 1.2 * vn * nx; B.vy -= 1.2 * vn * ny; B.vz -= 1.2 * vn * nz; B.vx *= 0.97; B.vz *= 0.97; } }
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
        if (R && !R.dead) { if (R.t === 'p') knock(R); else if (R.t === 'c' && hitV > 0.4 * S.size) splitCar(R, B.vx * 0.15, B.vy * 0.15, B.vz * 0.15); else if (R.t === 'b') { R.hit = true; sfx('thud', 0.6); } }
        B.vx *= 0.97; B.vy *= 0.97; B.vz *= 0.97;
      }
    }
  }
}
function bombNearFire(B) {
  for (let k = 0; k < burning.length; k++) { const m = mem[burning[k]]; if (!m || !m.alive) continue; const mx = (px[m.a] + px[m.b]) * 0.5 - B.x, my = (py[m.a] + py[m.b]) * 0.5 - B.y, mz = (pz[m.a] + pz[m.b]) * 0.5 - B.z; if (mx * mx + my * my + mz * mz < (B.r * 2.5) ** 2) return true; }
  return false;
}
// missiles curve in: turn the velocity toward the target by at most 2 radians per second
function steerRocket(B, h) {
  const sp = Math.hypot(B.vx, B.vy, B.vz); if (sp < 1e-6) return;
  const dx = B.tg[0] - B.x, dy = B.tg[1] - B.y, dz = B.tg[2] - B.z, L = Math.hypot(dx, dy, dz); if (L < 1e-6) return;
  const ux = B.vx / sp, uy = B.vy / sp, uz = B.vz / sp, c = clamp((ux * dx + uy * dy + uz * dz) / L, -1, 1), ang = Math.acos(c); if (ang < 1e-4) return;
  const t = Math.min(1, 2 * h / ang); let nx = ux * (1 - t) + dx / L * t, ny = uy * (1 - t) + dy / L * t, nz = uz * (1 - t) + dz / L * t; const nl = Math.hypot(nx, ny, nz) || 1;
  B.vx = nx / nl * sp; B.vy = ny / nl * sp; B.vz = nz / nl * sp;
}
function boom(B, h) {
  B.dead = true; boomT = 2.5;
  const R = B.R || 0.3 * S.size, sp = B.sp || Math.min(VMAX, 1.4 * S.size);
  for (let i = 0; i < nN; i++) {
    if (!alive[i] || pinned[i]) continue;
    const dx = px[i] - B.x, dy = py[i] - B.y, dz = pz[i] - B.z, d = Math.hypot(dx, dy, dz);
    if (d < R && d > 1e-6) { const k = (1 - d / R) ** 1.5 * sp / d; vx[i] += dx * k; vy[i] += (dy + 0.4 * d) * k; vz[i] += dz * k; if (isRider[i]) { qx[i] = px[i] - vx[i] * h; qy[i] = py[i] - vy[i] * h; qz[i] = pz[i] - vz[i] * h; } else qx[i] = px[i]; }
  }
  for (const Rd of riders.slice()) { if (Rd.dead || Rd.t === 'h') continue; const i = Rd.n, d = Math.hypot(px[i] - B.x, py[i] - B.y, pz[i] - B.z); if (Rd.t === 'p' && d < R * 0.8) knock(Rd); else if (Rd.t === 'c' && d < R * 0.3) splitCar(Rd, 0, 0, 0); else if (Rd.t === 'b' && d < R * 1.1 && !Rd.go) Rd.hit = true; }
  glassNear(B.x, B.y, B.z, R * 0.85, 0, 2, 0);
  for (let mi = 0; mi < mem.length; mi++) {
    const m = mem[mi]; if (!m.alive || m.kind === LINK) continue;
    const cx = (px[m.a] + px[m.b]) / 2 - B.x, cy = (py[m.a] + py[m.b]) / 2 - B.y, cz = (pz[m.a] + pz[m.b]) / 2 - B.z, d = Math.hypot(cx, cy, cz);
    if (d < R * 0.22) killMem(mi, 'broke'); else if (d < R * 0.65) ignite(mi);
  }
  rings.push({ x: B.x, y: Math.max(B.y, 0.05), z: B.z, t: 0, R: R * 1.2 });
  sfx('boom', B.small ? 0.75 : 1);
  for (let q = 0, nq = B.small ? 36 : 70; q < nq; q++) { const a = rnd(0, TAU), e = rnd(-0.2, 1), s = rnd(0.2, 1) * (B.small ? R * 1.6 : S.size * 0.8); emit(q % 3 === 0 ? 3 : 0, B.x, B.y, B.z, Math.cos(a) * s * (1 - e * 0.5), e * s + 3, Math.sin(a) * s * (1 - e * 0.5), rnd(0.6, 1.6), rnd(0.6, 1.4)); }
  shake = reduce ? 0 : (B.small ? 0.9 : 1.6);
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
    else pVy[i] -= grav * (k === 0 ? 0.3 : k >= 5 ? 0.22 : 0.9) * dt;
    pX[i] += pVx[i] * dt; pY[i] += pVy[i] * dt; pZ[i] += pVz[i] * dt;
    if (pY[i] < 0 && k !== 2) { if (k >= 5) pL[i] = 0; else if ((k === 0 || k === 4) && rift.gap <= 0) { pY[i] = 0; pVy[i] *= -0.2; pVx[i] *= 0.5; pVz[i] *= 0.5; } else if (pY[i] < -S.pit) pL[i] = 0; }
  }
}
const FM = [0.8, 1.2, 1.4, 2.6, 0];
function fireStep(dt) {
  const mul = inferno > 0 ? 2.2 : 1; if (inferno > 0) inferno -= dt;
  for (let k = burning.length - 1; k >= 0; k--) {
    const mi = burning[k], m = mem[mi];
    if (!m.alive || m.burn < 0) { burning[k] = burning[burning.length - 1]; burning.pop(); continue; }
    if (water.length) { const mx = (px[m.a] + px[m.b]) / 2, my = Math.min(py[m.a], py[m.b]); if (my < 0.9 && inWater(mx, (pz[m.a] + pz[m.b]) / 2, 0.2)) { m.burn = -3; for (let q = 0; q < 2; q++) emit(3, mx, my + 0.3, (pz[m.a] + pz[m.b]) / 2, rnd(-1, 1), rnd(1, 3), rnd(-1, 1), 0.8, 1.2); continue; } }
    if (flood && (px[m.a] * flood.dx + pz[m.a] * flood.dz) < flood.s && Math.min(py[m.a], py[m.b]) < flood.H * 0.8) { m.burn = -3; continue; }
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
function fireSpread(dt) {
  if (!burning.length || !flam.length) return; const mul = inferno > 0 ? 2.2 : 1, reach = 3.4 * clamp(Math.sqrt(S.u), 0.6, 1.2), tries = Math.min(burning.length * 2, 24);
  for (let t = 0; t < tries; t++) {
    const m = mem[burning[Math.floor(Math.random() * burning.length)]]; if (!m || !m.alive || m.burn < 0) continue;
    const fi = flam[Math.floor(Math.random() * flam.length)], f = mem[fi]; if (!f.alive || f.burn >= 0) continue;
    const d = Math.hypot((px[m.a] + px[m.b]) / 2 - (px[f.a] + px[f.b]) / 2, (py[m.a] + py[m.b]) / 2 - (py[f.a] + py[f.b]) / 2, (pz[m.a] + pz[m.b]) / 2 - (pz[f.a] + pz[f.b]) / 2);
    if (d < reach && Math.random() < dt * 4 * mul * (1 - d / (reach * 1.15))) ignite(fi);
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
/* ---- barrels, glass, shells, drones, dragons, a UFO and a flood ---- */
const tracers = [], marks = [];
function barrelStep(R, dt) {
  const i = R.n; if (!alive[i]) { R.dead = true; return; }
  if (R.go) { R.fuse -= dt; if (pc < PMAX - 20 && Math.random() < dt * 14) emit(2, px[i], py[i] + 0.3, pz[i], rnd(-1, 1), rnd(1, 3), rnd(-1, 1), 0.5, 1.1); if (R.fuse <= 0) explodeBarrel(R); return; }
  let hot = R.hit;
  if (!hot && burning.length) for (let k = 0; k < burning.length; k++) { const m = mem[burning[k]]; if (!m.alive) continue; if (Math.hypot((px[m.a] + px[m.b]) / 2 - px[i], (py[m.a] + py[m.b]) / 2 - py[i], (pz[m.a] + pz[m.b]) / 2 - pz[i]) < 1.7) { hot = true; break; } }
  if (!hot && py[i] < -2) hot = false;
  if (hot) { R.go = true; R.fuse = rnd(0.2, 0.7); sfx('fuse', 0.6); }
}
function explodeBarrel(R) {
  R.dead = true; const i = R.n, x = px[i], y = py[i], z = pz[i]; alive[i] = 0;
  if (R.kind === 'fw') { burstFireworks(x, y, z); return; }
  const u = clamp(Math.sqrt(S.u), 0.5, 1.1), B = { x, y, z, R: 4.6 * u, sp: 17, small: true, dead: false };
  boom(B, 1 / 600);
}
function breakGlass(P, kx, ky, kz) {
  if (P.broken) return; P.broken = true; P.ok = false;
  let cx = 0, cy = 0, cz = 0; const n = P.n.length; for (const q of P.n) { cx += px[q] / n; cy += py[q] / n; cz += pz[q] / n; }
  const w = Math.hypot(px[P.n[0]] - px[P.n[2]], py[P.n[0]] - py[P.n[2]], pz[P.n[0]] - pz[P.n[2]]);
  const k = coarse ? 8 : 18;
  for (let q = 0; q < k; q++) emit(4, cx + rnd(-0.5, 0.5) * w * 0.6, cy + rnd(-0.5, 0.5) * w * 0.6, cz + rnd(-0.5, 0.5) * w * 0.6, rnd(-1, 1) * 2.5 + kx, rnd(0.5, 3) + ky, rnd(-1, 1) * 2.5 + kz, rnd(0.6, 1.3), rnd(0.6, 1.1));
  sfx('glass', clamp(w / 4, 0.3, 1)); cnt.glass = (cnt.glass || 0) + 1;
}
function glassNear(x, y, z, r, kx, ky, kz) {
  let n = 0;
  for (let pi = 0; pi < panels.length; pi++) { const P = panels[pi]; if (!P.glass || P.broken || !P.ok) continue; const a = P.n[0], c = P.n[2], cx = (px[a] + px[c]) / 2, cy = (py[a] + py[c]) / 2, cz = (pz[a] + pz[c]) / 2, rad = Math.hypot(px[a] - px[c], py[a] - py[c], pz[a] - pz[c]) / 2 + r; if (Math.abs(cx - x) > rad || Math.abs(cy - y) > rad || Math.abs(cz - z) > rad) continue; if (Math.hypot(cx - x, cy - y, cz - z) < rad) { breakGlass(P, kx || 0, ky || 0, kz || 0); n++; } }
  return n;
}
// a bullet or fragment hits whatever is at the point: it snaps a member, shatters glass, sets a barrel off
function strike(x, y, z, kind) {
  let best = -1, bd = 0.9 * Math.max(0.5, S.u);
  for (let mi = 0; mi < mem.length; mi++) {
    const m = mem[mi]; if (!m.alive || m.kind === LINK) continue;
    const a = m.a, b = m.b, ex = px[b] - px[a], ey = py[b] - py[a], ez = pz[b] - pz[a], L2 = ex * ex + ey * ey + ez * ez + 1e-9;
    const t = clamp(((x - px[a]) * ex + (y - py[a]) * ey + (z - pz[a]) * ez) / L2, 0, 1), d = Math.hypot(px[a] + ex * t - x, py[a] + ey * t - y, pz[a] + ez * t - z);
    if (d < bd) { bd = d; best = mi; }
  }
  if (best >= 0) killMem(best, kind === 'fire' ? 'burn' : 'broke');
  glassNear(x, y, z, 0.5);
  for (const R of riders) if (R.t === 'b' && !R.dead && Math.hypot(px[R.n] - x, py[R.n] - y, pz[R.n] - z) < 1.0) R.hit = true;
  for (let q = 0; q < 4; q++) emit(0, x, y, z, rnd(-1, 1) * 4, rnd(0, 3) * 3, rnd(-1, 1) * 4, rnd(0.2, 0.5), 0.6);
  return best >= 0;
}
// ---- cannon and rocket: a bullseye shows the strike, the shot comes in from the side ----
function aimPoint(x, y) {
  const n = pickNode(x, y, coarse ? 44 : 28); if (n >= 0 && py[n] > 0.2) return [px[n], py[n], pz[n]];
  const g = groundHit(x, y); return g ? [g[0], 0, g[2]] : null;
}
function launch(kind, tgt, home) {
  const sz = S.size, rx = cam.rx, rz = cam.rz, left = kind === 'cannon' ? -1 : 1, D = Math.max(sz * 1.5, 14);
  const o = [tgt[0] + rx * left * D, kind === 'cannon' ? 0.9 : 1.0, tgt[2] + rz * left * D];
  if (kind === 'cannon') {
    const T = clamp(D / (sz * 2.8), 0.5, 1.5), g = 0.7 * grav, dx = tgt[0] - o[0], dz = tgt[2] - o[2];
    const B = { x: o[0], y: o[1], z: o[2], vx: dx / T, vy: (tgt[1] - o[1] + 0.5 * g * T * T) / T, vz: dz / T, r: Math.max(0.32 * S.u, 0.03 * sz), fire: false, cn: true, dead: false, life: 12, spin: 0 };
    balls.push(B); if (balls.length > 8) balls.shift();
    props.push({ k: 'cannon', x: o[0], y: 0, z: o[2], dx: dx / Math.hypot(dx, dz), dz: dz / Math.hypot(dx, dz), t: 0, life: 2.2 });
    marks.push({ x: tgt[0], y: tgt[1], z: tgt[2], t: 0, life: T + 0.5, k: 'cannon' });
    for (let q = 0; q < 14; q++) emit(3, o[0], 1, o[2], rnd(-1, 1) * 2 + dx / T * 0.1, rnd(0, 2), rnd(-1, 1) * 2 + dz / T * 0.1, rnd(0.6, 1.2), 1.6);
    emit(2, o[0], 1, o[2], 0, 0, 0, 0.3, 3); sfx('cannon', 1);
  } else {
    const dx = tgt[0] - o[0], dy = tgt[1] - o[1], dz = tgt[2] - o[2], L = Math.hypot(dx, dy, dz), sp = 1.9 * sz + 10;
    balls.push({ x: o[0], y: o[1], z: o[2], vx: dx / L * sp, vy: dy / L * sp + 0.05 * sz, vz: dz / L * sp, r: Math.max(0.3 * S.u, 0.03 * sz), fire: true, rk: true, tg: home || tgt, R: 0.2 * sz + 1.6, dead: false, life: 10, spin: 0 }); if (balls.length > 8) balls.shift();
    props.push({ k: 'rocket', x: o[0], y: 0, z: o[2], dx: dx / Math.hypot(dx, dz), dz: dz / Math.hypot(dx, dz), t: 0, life: 2 });
    marks.push({ x: tgt[0], y: tgt[1], z: tgt[2], t: 0, life: L / sp + 0.5, k: 'rocket' }); sfx('rocket', 1);
  }
}
// ---- bombs: a fused ball that drops, bounces and then blows ----
function bombsLive() { let n = 0; for (let i = 0; i < balls.length; i++) if (balls[i].bomb && !balls[i].dead) n++; return n; }
function dropBomb(t) {
  if (bombsLive() >= 5) return false;
  const sz = S.size;
  balls.push({ x: t[0], y: t[1] + 0.9 * sz, z: t[2], vx: 0, vy: 0, vz: 0, r: Math.max(0.3 * S.u, 0.03 * sz), bomb: true, fuse: 1.6, tk: 0.2, lit: false, dead: false, life: 20, spin: 0 });
  if (balls.length > 9) balls.shift();
  marks.push({ x: t[0], y: t[1], z: t[2], t: 0, life: 1.6, k: 'bomb' });
  return true;
}
// ---- lightning: the bolt runs along struts and beams, and burns the cables and fabric it reaches ----
const BOLTS = []; for (let i = 0; i < 3; i++) BOLTS.push({ on: false, t: 0, x: 0, y: 0, z: 0, np: 0, path: new Int32Array(40), jit: new Float32Array(64), mp: new Float32Array(3 * 14), f1: 3, f2: 7, d1x: 0, d1z: 0, d2x: 0, d2z: 0 });
const bq = new Int32Array(48), bh = new Int8Array(48); let boltStamp = 0;
function strikeBolt(t) {
  const sz = S.size, x = t[0], y = t[1], z = t[2];
  let B = null; for (let i = 0; i < 3; i++) if (!BOLTS[i].on) { B = BOLTS[i]; break; }
  if (!B) { B = BOLTS[0]; for (let i = 1; i < 3; i++) if (BOLTS[i].t > B.t) B = BOLTS[i]; }
  let best = -1, bd = 0.9 * Math.max(0.5, S.u), bt = 0;
  for (let mi = 0; mi < mem.length; mi++) {
    const m = mem[mi]; if (!m.alive || m.kind === LINK) continue;
    const a = m.a, b = m.b, ex = px[b] - px[a], ey = py[b] - py[a], ez = pz[b] - pz[a], L2 = ex * ex + ey * ey + ez * ez + 1e-9;
    const u = clamp(((x - px[a]) * ex + (y - py[a]) * ey + (z - pz[a]) * ez) / L2, 0, 1), d = Math.hypot(px[a] + ex * u - x, py[a] + ey * u - y, pz[a] + ez * u - z);
    if (d < bd) { bd = d; best = mi; bt = u; }
  }
  B.on = true; B.t = 0; B.np = 0; B.x = x; B.y = y; B.z = z;
  for (let i = 0; i < 64; i++) B.jit[i] = Math.random() * 2 - 1;
  B.f1 = 2 + Math.floor(Math.random() * 3); B.f2 = 6 + Math.floor(Math.random() * 3);
  let a1 = rnd(0, TAU), a2 = a1 + rnd(2, 4); B.d1x = Math.cos(a1); B.d1z = Math.sin(a1); B.d2x = Math.cos(a2); B.d2z = Math.sin(a2);
  const now = performance.now(); if (!reduce && now - lastFlashAt >= 1000) { flash = 0.08; lastFlashAt = now; }
  sfx('thunder', 1);
  const kick = (n, k) => { if (!pinned[n] && alive[n]) vy[n] += 0.15 * sz * k; };
  if (best < 0) {
    boom({ x, y: Math.max(y, 0.05), z, small: true, R: 0.08 * sz + 1, dead: false }, 1 / (60 * Math.max(1, FR.sub)));
    return false;
  }
  const m0 = mem[best], ex = px[m0.b] - px[m0.a], ey = py[m0.b] - py[m0.a], ez = pz[m0.b] - pz[m0.a];
  B.x = px[m0.a] + ex * bt; B.y = py[m0.a] + ey * bt; B.z = pz[m0.a] + ez * bt;
  killMem(best, 'burn'); boltStamp++; m0.bs = boltStamp;
  let head = 0, tail = 0, cnt = 1;
  const addPath = n => { if (B.np < 40) { for (let k = 0; k < B.np; k++) if (B.path[k] === n) return; B.path[B.np++] = n; } };
  bq[tail] = m0.a; bh[tail++] = 0; bq[tail] = m0.b; bh[tail++] = 0; addPath(m0.a); addPath(m0.b); kick(m0.a, 1); kick(m0.b, 1);
  while (head < tail && cnt < 14) {
    const n = bq[head], h = bh[head]; head++; if (h >= 6) continue;
    const ad = adj[n];
    for (let k = 0; k < ad.length && cnt < 14; k++) {
      const mi = ad[k], m = mem[mi]; if (!m.alive || m.kind === LINK || m.bs === boltStamp) continue; m.bs = boltStamp;
      if (m.kind <= BEAM) {
        cnt++; const o = m.a === n ? m.b : m.a; addPath(o); kick(o, 0.5 ** (h + 1));
        if (tail < 46) { bq[tail] = o; bh[tail++] = h + 1; }
      } else { cnt++; ignite(mi); }
    }
  }
  for (const R of riders) {
    if (R.dead) continue;
    if (R.t === 'b') { for (let k = 0; k < B.np; k++) { const n = B.path[k]; if (Math.hypot(px[R.n] - px[n], py[R.n] - py[n], pz[R.n] - pz[n]) < 1.0) { R.hit = true; break; } } }
    else if (R.t === 'p' && Math.hypot(px[R.n] - B.x, py[R.n] - B.y, pz[R.n] - B.z) < 0.1 * sz) knock(R);
  }
  for (let q = 0; q < 10; q++) emit(0, B.x, B.y, B.z, rnd(-1, 1) * sz * 0.15, rnd(0, 1) * sz * 0.2, rnd(-1, 1) * sz * 0.15, rnd(0.2, 0.5), 0.7);
  rings.push({ x: B.x, y: Math.max(B.y, 0.05), z: B.z, t: 0, R: 0.12 * sz + 1 });
  return true;
}
// ---- drone swarm ----
function callDrones(tgt) {
  const n = coarse ? 5 : 7, sz = S.size, a0 = rnd(0, TAU), top = Math.max(sz * 0.8, (S.top || 8) + 5);
  for (let k = 0; k < n; k++) { const a = a0 + k * 0.35, R0 = sz * 2.6 + 12; drones.push({ x: tgt[0] + Math.cos(a) * R0, y: top + rnd(0, 3), z: tgt[2] + Math.sin(a) * R0, vx: 0, vy: 0, vz: 0, tx: tgt[0] + Math.cos(k * 2.4) * sz * 0.35 * (0.3 + (k % 3) / 3), tz: tgt[2] + Math.sin(k * 2.4) * sz * 0.35 * (0.3 + (k % 3) / 3), ty: top + (k % 3) * 1.2, t: -k * 0.12, life: 11 + rnd(0, 2), ph: rnd(0, 6), gun: rnd(0, 0.3), leave: false }); }
  sfx('drone', 1);
}
function droneStep(dt) {
  for (let i = drones.length - 1; i >= 0; i--) {
    const D = drones[i]; D.t += dt; if (D.t < 0) continue; D.ph += dt * 30;
    let gx = D.tx, gy = D.ty, gz = D.tz; if (D.t > D.life) { D.leave = true; const a = Math.atan2(D.z - S.cz, D.x - S.cx); gx = S.cx + Math.cos(a) * (S.size * 5 + 40); gz = S.cz + Math.sin(a) * (S.size * 5 + 40); gy = D.y + 8; }
    const k = Math.min(1, 1.6 * dt) * (D.leave ? 0.9 : 1); D.vx += (gx - D.x) * k * 0.6 - D.vx * 0.9 * dt * 2; D.vy += (gy + Math.sin(D.ph * 0.05) * 0.4 - D.y) * k - D.vy * 0.9 * dt * 2; D.vz += (gz - D.z) * k * 0.6 - D.vz * 0.9 * dt * 2;
    D.x += D.vx * dt; D.y += D.vy * dt; D.z += D.vz * dt;
    if (D.leave && Math.hypot(D.x - S.cx, D.z - S.cz) > S.size * 4 + 30) { drones.splice(i, 1); continue; }
    if (!D.leave && D.t > 0.8) {
      D.gun -= dt;
      if (D.gun <= 0) {
        D.gun = rnd(0.1, 0.32);
        // choose a thing to shoot: members, glass, barrels. Never a person.
        let tg = null; const u = Math.random();
        if (u < 0.18 && barrels.length) { const R = riders[barrels[Math.floor(Math.random() * barrels.length)]]; if (R && !R.dead && alive[R.n]) tg = [px[R.n], py[R.n], pz[R.n]]; }
        if (!tg) for (let t = 0; t < 14; t++) { const m = mem[Math.floor(Math.random() * mem.length)]; if (!m.alive || m.hid || m.kind === LINK) continue; const mx = (px[m.a] + px[m.b]) / 2, my = (py[m.a] + py[m.b]) / 2, mz = (pz[m.a] + pz[m.b]) / 2; if (Math.hypot(mx - D.tx, mz - D.tz) < S.size * 0.8 + 4) { tg = [mx, my, mz]; break; } }
        if (tg) { tracers.push({ x1: D.x, y1: D.y - 0.3, z1: D.z, x2: tg[0], y2: tg[1], z2: tg[2], t: 0 }); strike(tg[0], tg[1], tg[2]); if (tracers.length > 40) tracers.shift(); if (Math.random() < 0.5) sfx('shot', 0.5); }
      }
    }
  }
}
// ---- dragons: three, each with a rider, that sweep in and breathe fire ----
const DRG = [{ body: '#2F8F5B', belly: '#C9E3A8', wing: '#1F6E43', cape: '#8B2B2B' }, { body: '#B5382C', belly: '#F0C28A', wing: '#8A241B', cape: '#2A4A8C' }, { body: '#3B4FA8', belly: '#BFC8F0', wing: '#2A3A80', cape: '#B8862B' }];
function callDragons(tgt) {
  const sz = S.size, a0 = rnd(0, TAU), top = Math.max(sz * 0.75, (S.top || 8) + 6);
  for (let k = 0; k < 3; k++) {
    const a = a0 + (k - 1) * 0.55, R0 = sz * 2.4 + 22, ca = Math.cos(a), sa = Math.sin(a), lat = (k - 1) * sz * 0.35;
    dragons.push({ k, x: tgt[0] + ca * R0 - sa * lat, y: top + k * 1.5, z: tgt[2] + sa * R0 + ca * lat, dx: -ca, dz: -sa, tx: tgt[0], tz: tgt[2], t: -k * 0.5, ph: rnd(0, 6), sp: sz * 0.7 + 10, pass: 0, breath: 0, fl: 0 });
  }
  sfx('roar', 1);
}
function dragonStep(dt) {
  for (let i = dragons.length - 1; i >= 0; i--) {
    const D = dragons[i]; D.t += dt; if (D.t < 0) continue; D.ph += dt * 5.2;
    const dd = Math.hypot(D.tx - D.x, D.tz - D.z);
    // steer toward the far side of the target, then turn around for a second pass
    let gx = D.tx + D.dx * (S.size * 1.8 + 20), gz = D.tz + D.dz * (S.size * 1.8 + 20);
    const ang = Math.atan2(D.dz, D.dx), want = Math.atan2(gz - D.z, gx - D.x); let da = want - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
    const na = ang + clamp(da, -1.3 * dt, 1.3 * dt); D.dx = Math.cos(na); D.dz = Math.sin(na);
    D.x += D.dx * D.sp * dt; D.z += D.dz * D.sp * dt; D.y += (Math.max(S.size * 0.62, (S.top || 8) + 5) - D.y + Math.sin(D.ph * 0.4) * 1.2 + D.k) * dt * 0.8;
    // breathe fire as it crosses the target area
    const along = (D.x - D.tx) * D.dx + (D.z - D.tz) * D.dz, inside = Math.hypot(D.x - D.tx, D.z - D.tz) < S.size * 0.9 + 6;
    D.breath = inside && D.pass < 2 ? Math.min(1, D.breath + dt * 3) : Math.max(0, D.breath - dt * 3);
    if (D.breath > 0.2) {
      const mx = D.x + D.dx * 2.2, my = D.y - 0.4, mz = D.z + D.dz * 2.2, gx2 = D.x + D.dx * 6 + rnd(-1, 1) * 2, gz2 = D.z + D.dz * 6 + rnd(-1, 1) * 2, gy2 = 0.4;
      const n = lite ? 2 : 4; for (let q = 0; q < n && pc < PMAX - 25; q++) { const f = Math.random(); emit(2, lerp(mx, gx2, f * 0.5), lerp(my, gy2, f * 0.5), lerp(mz, gz2, f * 0.5), (gx2 - mx) * 0.9 + rnd(-1, 1) * 2, (gy2 - my) * 0.9, (gz2 - mz) * 0.9 + rnd(-1, 1) * 2, rnd(0.45, 0.9), rnd(1.6, 2.6)); }
      D.fl -= dt;
      if (D.fl <= 0) { D.fl = 0.07; const fr = 2.2 * Math.max(S.u, 0.7) + 0.02 * S.size; for (let mi = 0; mi < mem.length; mi++) { const m = mem[mi]; if (!m.alive || m.burn >= 0 || m.kind === LINK) continue; const cx = (px[m.a] + px[m.b]) / 2, cy = (py[m.a] + py[m.b]) / 2, cz = (pz[m.a] + pz[m.b]) / 2; if (Math.abs(cx - gx2) > fr + 1 || Math.abs(cz - gz2) > fr + 1) continue; if (cy < 7 + (S.top || 0) && Math.hypot(cx - gx2, cz - gz2) < fr && Math.random() < 0.55) ignite(mi); } for (const R of riders) if (R.t === 'b' && !R.dead && Math.hypot(px[R.n] - gx2, pz[R.n] - gz2) < fr) R.hit = true; }
    }
    // passes: after crossing the far side, wheel around
    if (along > S.size * 1.5 + 18 && D.pass < 2) { D.pass++; const a = rnd(0, TAU); D.dx = -D.dx; D.dz = -D.dz; D.pass < 2 ? 0 : 0; }
    if (D.pass >= 2) { const far = Math.hypot(D.x - S.cx, D.z - S.cz); if (far > S.size * 3 + 40 || D.t > 40) dragons.splice(i, 1); else { D.dx += (D.x - S.cx) / far * dt; D.dz += (D.z - S.cz) / far * dt; const l = Math.hypot(D.dx, D.dz); D.dx /= l; D.dz /= l; } }
    else if (D.t > 30) dragons.splice(i, 1);
    if (D.breath > 0.2 && Math.random() < dt * 2) sfx('breath', 0.7);
  }
}
// ---- UFO tractor beam ----
function callUfo(x, z) { ufo = { x, z, tx: x, tz: z, y: S.size * 1.6 + 14, t: 0, held: true, leave: false, beam: 0 }; sfx('ufo', 1); }
function ufoStep(dt) {
  if (!ufo) return; const U = ufo; U.t += dt;
  U.x += (U.tx - U.x) * Math.min(1, 2.2 * dt); U.z += (U.tz - U.z) * Math.min(1, 2.2 * dt);
  const hy = Math.max(S.size * 0.85, (S.top || 8) + 6);
  U.y += ((U.leave ? hy + 60 : hy) - U.y) * Math.min(1, 1.5 * dt);
  U.beam = U.leave ? Math.max(0, U.beam - dt * 2) : Math.min(1, U.beam + dt * 1.4);
  if (!U.held && U.t > 1.5 && !U.leave) U.leave = true;
  if (U.t > 16 && !U.leave) U.leave = true;
  if (U.leave && U.y > hy + 50) { ufo = null; return; }
  if (U.beam < 0.2) return;
  const Rb = 0.1 * S.size + 3.2;
  for (let i = 0; i < nN; i++) {
    if (!alive[i] || pinned[i]) continue; const dx = px[i] - U.x, dz = pz[i] - U.z, d = Math.hypot(dx, dz); if (d > Rb || py[i] > U.y) continue;
    const f = (1 - d / Rb) * U.beam, g = grav * 1.45 * f; vy[i] += (g - vy[i] * 0.5 * f) * dt * 0.8 + 0.02; vx[i] += (-dx * 1.4 - dz * 0.8 * f * 3 - vx[i] * 1.4) * f * dt; vz[i] += (-dz * 1.4 + dx * 0.8 * f * 3 - vz[i] * 1.4) * f * dt;
  }
  for (const R of riders) if (R.t === 'p' && !R.dead && R.st && !R.safe && Math.hypot(px[R.n] - U.x, pz[R.n] - U.z) < Rb * 0.8 && py[R.n] > 1) knock(R);
  if (Math.random() < dt * 20 && pc < PMAX - 10) emit(1, U.x + rnd(-1, 1) * Rb * 0.8, rnd(0, 3), U.z + rnd(-1, 1) * Rb * 0.8, 0, rnd(2, 5), 0, 0.5, 0.6);
}
// ---- flood: a wave of water crosses the scene ----
function startFlood(dx, dz, big, s0) {
  const l = Math.hypot(dx, dz) || 1, sz = S.size, H = (big ? 0.16 : 0.1) * sz + 0.6; dx /= l; dz /= l;
  const ext = 0.5 * Math.max(S.hx * 2, sz) + 20;
  flood = { dx, dz, s: s0 !== undefined ? s0 : -ext, ext, v: (big ? 0.5 : 0.36) * sz + 3, H, t: 0, dur: 0, rec: false, lvl: 0 }; sfx('flood', 1); thr.ground = 1;
}
function floodStep(dt) {
  const F = flood; if (!F) return; F.t += dt;
  if (!F.rec) { F.s += F.v * dt; if (F.s > F.ext + 8) F.rec = true; }
  else { F.lvl += dt; if (F.lvl > 6) { flood = null; return; } }
  const lvl = F.rec ? 1 - F.lvl / 6 : 1;
  for (let i = 0; i < nN; i++) {
    if (!alive[i] || pinned[i]) continue; const pj = px[i] * F.dx + pz[i] * F.dz; if (pj > F.s || py[i] > F.H * lvl) continue;
    const depth = clamp((F.s - pj) / 8, 0, 1), k = Math.min(0.5, (isRider[i] === 1 ? 4 : 2) * dt * depth * (F.rec ? 0.2 : 1));
    vx[i] += (F.dx * F.v * 0.9 - vx[i]) * k; vz[i] += (F.dz * F.v * 0.9 - vz[i]) * k; vy[i] += (grav * 0.35 * depth - vy[i] * 0.3) * dt * 2;
  }
}
// ---- fireworks ----
function burstFireworks(x, y, z) {
  const n = 7; sfx('boom', 0.6);
  for (let k = 0; k < n; k++) { const a = rnd(0, TAU), up = rnd(0.5, 1.2), v = S.size * rnd(0.9, 1.4) + 8; shells.push({ x, y: y + 0.3, z, vx: Math.cos(a) * v * 0.45, vy: v * up, vz: Math.sin(a) * v * 0.45, t: 0, fuse: rnd(0.6, 1.3), col: 5 + Math.floor(rnd(0, 5)) }); }
  for (let q = 0; q < 16; q++) emit(0, x, y + 0.3, z, rnd(-1, 1) * 5, rnd(1, 6), rnd(-1, 1) * 5, rnd(0.5, 1.2), 0.9);
  for (let q = 0; q < 6; q++) emit(3, x, y + 0.5, z, rnd(-1, 1) * 2, rnd(0.5, 2), rnd(-1, 1) * 2, rnd(0.8, 1.6), 1.6);
  boomT = Math.max(boomT, 1.5);
}
function shellStep(dt) {
  for (let i = shells.length - 1; i >= 0; i--) {
    const Sh = shells[i]; Sh.t += dt; Sh.vy -= grav * 0.5 * dt; Sh.x += Sh.vx * dt; Sh.y += Sh.vy * dt; Sh.z += Sh.vz * dt;
    if (pc < PMAX - 4) emit(0, Sh.x, Sh.y, Sh.z, rnd(-1, 1), rnd(-1, 0), rnd(-1, 1), 0.3, 0.5);
    if (Sh.t > Sh.fuse || Sh.y < 0.3) {
      shells.splice(i, 1); const n = coarse ? 14 : 26; sfx('pop', 0.7);
      for (let q = 0; q < n; q++) { const a = rnd(0, TAU), e = rnd(-1, 1), r = Math.sqrt(1 - e * e), v = rnd(3, 7); emit(Sh.col, Sh.x, Sh.y, Sh.z, Math.cos(a) * r * v, e * v, Math.sin(a) * r * v, rnd(0.9, 1.7), 1);}
      if (Sh.y < 6) { strike(Sh.x, Sh.y, Sh.z); if (Math.random() < 0.5) { for (let mi = 0; mi < mem.length; mi++) { const m = mem[mi]; if (m.alive && m.burn < 0 && m.kind !== LINK && Math.hypot((px[m.a] + px[m.b]) / 2 - Sh.x, (py[m.a] + py[m.b]) / 2 - Sh.y, (pz[m.a] + pz[m.b]) / 2 - Sh.z) < 2.2) { ignite(mi); break; } } } }
    }
  }
}

/* ---- people: they stroll when it is calm, run when there is trouble, make for water if there is any, and after a fall they
   always crawl clear and stand up again. Nobody dies. ---- */
const thr = { fire: 0, sky: 0, ground: 0, blast: 0, any: 0 };
function threats() {
  thr.fire = burning.length > 0 ? 1 : 0;
  thr.sky = (drones.length || dragons.length || shells.length || ufo || balls.some(b => b.fire)) ? 1 : 0;
  thr.ground = ((Q.kind && Q.env > 0.2) || tornadoes.length || gust || flood) ? 1 : 0;
  thr.blast = boomT > 0 ? 1 : 0; const was = thr.any; thr.any = thr.fire || thr.sky || thr.ground || thr.blast; if (thr.any && !was && !grace) sfx('crowd', 0.8);
}
function shoreOf(w, x, z) {
  if (w.sh === 'rect') { const dx = (x - w.x) / w.rx, dz = (z - w.z) / w.rz; if (Math.abs(dx) > Math.abs(dz)) return [w.x + Math.sign(dx || 1) * (w.rx + 1.1), clamp(z, w.z - w.rz, w.z + w.rz)]; return [clamp(x, w.x - w.rx, w.x + w.rx), w.z + Math.sign(dz || 1) * (w.rz + 1.1)]; }
  const a = Math.atan2((z - w.z) / w.rz, (x - w.x) / w.rx); return [w.x + (w.rx + 1.1) * Math.cos(a), w.z + (w.rz + 1.1) * Math.sin(a)];
}
function waterGoal(x, z) {
  let best = null, bd = 1e9;
  for (const w of water) {
    let q;
    if (w.sh === 'rect') q = [clamp(x, w.x - 0.7 * w.rx, w.x + 0.7 * w.rx), clamp(z, w.z - 0.7 * w.rz, w.z + 0.7 * w.rz)];
    else { const a = Math.atan2((z - w.z) / w.rz, (x - w.x) / w.rx), inside = Math.hypot((x - w.x) / w.rx, (z - w.z) / w.rz) < 0.7; q = inside ? [x, z] : [w.x + 0.7 * w.rx * Math.cos(a), w.z + 0.7 * w.rz * Math.sin(a)]; }
    const d = Math.hypot(q[0] - x, q[1] - z); if (d < bd) { bd = d; best = q; }
  }
  return best;
}
// walk toward a point on the ground; returns true on arrival
function walk(R, gx, gz, sp, dt) {
  if (R.lim) { gx = clamp(gx, R.lim[0], R.lim[1]); gz = clamp(gz, R.lim[2], R.lim[3]); }
  const i = R.n, dx = gx - px[i], dz = gz - pz[i], d = Math.hypot(dx, dz);
  if (d < 0.25 * Math.max(R.s, 0.5)) { R.wk *= 0.7; return true; }
  if (!cont[i]) return false;
  const ux = dx / d, uz = dz / d; R.run = 0.18; fric[i] = 0.03; R.hd = ux >= 0 ? 1 : -1;
  for (const n of R.ns) { vx[n] += (ux * sp - vx[n]) * 0.4; vz[n] += (uz * sp - vz[n]) * 0.4; }
  R.wk = sp / (Math.sqrt(R.s) + 0.001); R.ph += dt * (3 + 1.6 * sp / Math.max(0.5, Math.sqrt(R.s)));
  return false;
}
function pickGoal(R, rad) {
  for (let t = 0; t < 8; t++) {
    const a = rnd(0, TAU), d = rnd(0.3, 1) * rad, x = R.hx + Math.cos(a) * d, z = R.hz + Math.sin(a) * d;
    if (S.bnd && (x < S.bnd[0] || x > S.bnd[1] || z < S.bnd[2] || z > S.bnd[3])) continue;
    if (S.avoid && S.avoid.some(r => x > r[0] - 0.8 && x < r[1] + 0.8 && z > r[2] - 0.8 && z < r[3] + 0.8)) continue;
    if (inWater(x, z, 0.8)) continue; R.gx = x; R.gz = z; return;
  }
  R.gx = R.hx; R.gz = R.hz;
}
const TOOLN = ['hammer', 'axe', 'torch', 'bat'];
function jobFor(R) {
  const fy = py[R.n] - 0.5 * R.s, reach = 2.3 * Math.max(R.s, 0.4) + 0.5; let best = null, bd = 1e9;
  const x = px[R.n], z = pz[R.n];
  for (let k = 0; k < 16; k++) {
    const u = Math.random();
    if (u < 0.2 && barrels.length) { const B = riders[barrels[Math.floor(Math.random() * barrels.length)]]; if (B && !B.dead && alive[B.n] && !B.go) { const d = Math.hypot(px[B.n] - x, pz[B.n] - z); if (d < bd) { bd = d; best = { k: 'b', R: B, x: px[B.n], z: pz[B.n] }; } } continue; }
    if (u < 0.4 && panels.length) { const P = panels[Math.floor(Math.random() * panels.length)]; if (P.glass && !P.broken && P.ok) { const c = P.n.reduce((a, q) => [a[0] + px[q] / P.n.length, a[1] + py[q] / P.n.length, a[2] + pz[q] / P.n.length], [0, 0, 0]); if (c[1] - fy < reach + 1) { const d = Math.hypot(c[0] - x, c[2] - z); if (d < bd) { bd = d; best = { k: 'g', P, x: c[0], z: c[2] }; } } } continue; }
    const mi = Math.floor(Math.random() * mem.length), m = mem[mi]; if (!m.alive || m.hid || m.kind === LINK || m.stub) continue;
    if (Math.min(py[m.a], py[m.b]) - fy > reach) continue;
    const mx = (px[m.a] + px[m.b]) / 2, mz = (pz[m.a] + pz[m.b]) / 2, d = Math.hypot(mx - x, mz - z); if (d < bd) { bd = d; best = { k: 'm', mi, x: mx, z: mz }; }
  }
  return best;
}
function doJob(R) {
  const J = R.job; R.job = null; if (!J) return;
  const tx = J.x, tz = J.z, ty = py[R.n];
  if (J.k === 'b') { if (!J.R.dead) J.R.hit = true; }
  else if (J.k === 'g') { if (!J.P.broken) breakGlass(J.P, 0, 1, 0); }
  else { const m = mem[J.mi]; if (!m.alive) return; if (R.tl === 2 && (m.tree || m.kind === FAB || m.burnT)) ignite(J.mi); else { killMem(J.mi, 'broke'); } }
  sfx(R.tl === 2 ? 'ignite' : 'hit', 0.6);
  for (let q = 0; q < 5; q++) emit(1, tx, ty + 0.5, tz, rnd(-1, 1) * 3, rnd(0, 3), rnd(-1, 1) * 3, rnd(0.25, 0.5), 0.6);
}
function standUp(R) {
  R.st = 1; R.dn = 0; R.cr = 0; R.ct = null; R.gr = 0; fric[R.n] = 0.3; fric[R.h] = 0.05; R.run = 0.5; R.recovered = (R.recovered || 0) + 1;
}
function downStep(R, dt, spd) {
  R.dn += dt; const i = R.n, sq = Math.sqrt(R.s);
  if (!R.ct) {
    let tx = R.hx, tz = R.hz;
    const w = water.length && thr.any ? waterGoal(px[i], pz[i]) : null;
    if (w) { tx = w[0]; tz = w[1]; }
    else { let nr_ = 1e9, hx = 0, hz = 0; for (let k = 0; k < burning.length; k++) { const m = mem[burning[k]]; if (!m.alive) continue; const mx = (px[m.a] + px[m.b]) / 2, mz = (pz[m.a] + pz[m.b]) / 2, d = Math.hypot(mx - px[i], mz - pz[i]); if (d < nr_) { nr_ = d; hx = mx; hz = mz; } } if (nr_ < 12) { const a = Math.atan2(pz[i] - hz, px[i] - hx); tx = px[i] + Math.cos(a) * 4 * sq; tz = pz[i] + Math.sin(a) * 4 * sq; } else { const a = Math.atan2(R.hz - pz[i], R.hx - px[i]), d = Math.min(3 * sq, Math.hypot(R.hz - pz[i], R.hx - px[i])); tx = px[i] + Math.cos(a) * d; tz = pz[i] + Math.sin(a) * d; } }
    R.ct = [tx, tz];
  }
  if (R.dn > 1.1 && cont[i] && spd < 4) {
    const dx = R.ct[0] - px[i], dz = R.ct[1] - pz[i], d = Math.hypot(dx, dz);
    if (d > 0.3) { R.run = 0.2; fric[i] = 0.05; fric[R.h] = 0.05; const k = 1.1 * sq; for (const n of R.ns) { vx[n] += (dx / d * k - vx[n]) * 0.3; vz[n] += (dz / d * k - vz[n]) * 0.3; } R.wk = 0; R.crawl = true; }
    const wt = water.length ? inWater(px[i], pz[i], -0.3) : null;
    if (wt && thr.any) { standUp(R); enterWater(R); return; }
  }
  if (R.dn > 3.8 && cont[i] && spd < 3) { R.crawl = false; standUp(R); }
}
function enterWater(R) {
  R.safe = true; R.pt = 5; R.wi = [wI[R.n], wI[R.h]]; wI[R.n] = wI[R.h] = 0; vx[R.n] = vy[R.n] = vz[R.n] = vx[R.h] = vy[R.h] = vz[R.h] = 0; R.st = 1; R.crawl = false; R.job = null;
  py[R.n] = qy[R.n] = 0.5 * R.s; py[R.h] = qy[R.h] = 0.5 * R.s + 0.86 * R.s; px[R.h] = qx[R.h] = px[R.n]; pz[R.h] = qz[R.h] = pz[R.n]; R.sw = 0; sfx('splash', 0.7);
}
function safeStep(R, dt) {
  R.sw += dt; if (thr.any) R.pt = 5; else R.pt -= dt;
  if (R.pt < -5) {
    const w = inWater(px[R.n], pz[R.n], 0.5), q = w ? shoreOf(w, px[R.n], pz[R.n]) : [R.hx, R.hz];
    wI[R.n] = R.wi[0]; wI[R.h] = R.wi[1]; R.safe = false;
    for (const n of R.ns) { px[n] = qx[n] = q[0]; pz[n] = qz[n] = q[1]; }
    py[R.n] = qy[R.n] = 0.5 * R.s; py[R.h] = qy[R.h] = 1.36 * R.s; R.gx = R.hx; R.gz = R.hz; R.gt = 1; sfx('splash', 0.4);
  }
}
function aiStep(R, dt, spd) {
  const i = R.n, s = R.s, sq = Math.sqrt(s);
  if (R.run > 0) R.run -= dt; if (R.run <= 0) { fric[i] = 0.3; R.wk *= 0.85; }
  // nearest fire
  let near = 1e9, nx = 0, nz = 0;
  if (thr.fire) for (let k = 0; k < burning.length; k++) { const m = mem[burning[k]]; if (!m.alive) continue; const mx = (px[m.a] + px[m.b]) * 0.5 - px[i], my = (py[m.a] + py[m.b]) * 0.5 - py[i], mz = (pz[m.a] + pz[m.b]) * 0.5 - pz[i], d = Math.hypot(mx, my, mz); if (d < near) { near = d; nx = mx; nz = mz; } }
  if (near < 1.1 * s + 0.3) {   // right beside the flames: flung clear (and then crawls away and stands up)
    let dx = -nx, dz = -nz; const dl = Math.hypot(dx, dz); if (dl < 0.05) { const a = rnd(0, TAU); dx = Math.cos(a); dz = Math.sin(a); } else { dx /= dl; dz /= dl; }
    const sp = 3.4 * sq + 0.4; knock(R, dx * sp * 1.2, 2.6 * sq + 1, dz * sp * 1.2); return;
  }
  const hot = near < Math.max(3.5, 15 * s), danger = hot || thr.sky || thr.ground || thr.blast;
  if (danger) R.pt = 2.2; else if (R.pt > 0) R.pt -= dt;
  if (R.pt > 0 && !(armed && !danger)) {
    R.wk2 = 1; R.job = null;
    const wg = water.length && (hot || thr.sky || (thr.fire && near < 40)) ? waterGoal(px[i], pz[i]) : null;
    if (wg) {
      walk(R, wg[0], wg[1], 4.0 * sq, dt);
      if (inWater(px[i], pz[i], -0.25)) enterWater(R);
    } else {
      R.gt -= dt;
      if (R.gt <= 0 || Math.hypot(R.gx - px[i], R.gz - pz[i]) < 0.4) {
        R.gt = rnd(0.5, 1.2);
        if (hot && R.wr > 2) { const a = Math.atan2(-nz, -nx) + rnd(-0.8, 0.8), d = rnd(4, 9) * sq; R.gx = px[i] + Math.cos(a) * d; R.gz = pz[i] + Math.sin(a) * d; if (S.bnd) { R.gx = clamp(R.gx, S.bnd[0], S.bnd[1]); R.gz = clamp(R.gz, S.bnd[2], S.bnd[3]); } if (inWater(R.gx, R.gz, 0.5) && !water.length) { R.gx = R.hx; R.gz = R.hz; } }
        else pickGoal(R, Math.max(R.wr * 2.2, 2.5 * sq));
      }
      walk(R, R.gx, R.gz, 3.6 * sq, dt);
    }
    return;
  }
  R.wk2 = 0;
  if (armed) {
    if (!R.job || (R.job.k === 'm' && !mem[R.job.mi].alive) || (R.job.k === 'b' && R.job.R.dead)) { R.job = null; R.tw = (R.tw || 0) - dt; if (R.tw <= 0) { R.job = jobFor(R); R.tw = 0.4; if (R.tl < 0 || R.tl === undefined) R.tl = Math.floor(Math.random() * 4); } }
    const J = R.job;
    if (J) {
      const d = Math.hypot(J.x - px[i], J.z - pz[i]);
      if (R.sw > 0) { R.sw -= dt; R.wk *= 0.8; if (R.sw <= 0) doJob(R); }
      else if (d < 1.4 * Math.max(s, 0.5) + 0.3) R.sw = 0.9;
      else { walk(R, J.x, J.z, 2.4 * sq, dt); R.stuck = (R.stuck || 0) + (spd < 0.3 ? dt : 0); if (R.stuck > 2) { R.job = null; R.stuck = 0; } }
    }
    return;
  }
  if (R.el && E.on) { elevAI(R, dt); return; }
  // calm: stroll about and pause now and then
  R.gt -= dt;
  if (R.gt <= 0) { if (R.idle) { R.idle = false; pickGoal(R, R.wr); R.gt = rnd(4, 8); } else { R.idle = true; R.gt = rnd(1.5, 4); } }
  if (!R.idle) { const arr = walk(R, R.gx, R.gz, 0.95 * sq, dt); if (arr) { R.idle = true; R.gt = rnd(1.5, 4); } }
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
      if (R.st && R.gr < 1.5) { R.gr = Math.min(1.5, R.gr + dt * 1.0); nr[R.n] = (0.22 + 0.28 * Math.min(1, R.gr)) * R.s; }
      if (grace) continue;
      if (R.safe) { safeStep(R, dt); continue; }
      if (!R.st) { downStep(R, dt, spd); continue; }
      if (cont[i] || R.gr < 1.3) R.air = 0; else R.air += dt;
      let fall = (R.air > 0.25 && rise < -1.5) || R.air > 0.8; R.why = fall ? 'air' : '';
      if (!quakeOn && R.run <= 0 && (spd > 4.5 || rise > 5)) { fall = true; R.why = 'speed ' + spd.toFixed(1) + ' rise ' + rise.toFixed(1); }
      if (quakeOn && cont[i]) { R.tq += dt * Q.env; if (R.tq > R.tp) fall = true; }
      if (gs > 8 && Math.random() < dt * 0.8 * gs / 15) fall = true;
      if (fall) knock(R); else aiStep(R, dt, spd);
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
    } else if (R.t === 'b') { barrelStep(R, dt);
    } else {
      const u = R.up; let ux = px[R.n] - px[R.n2], uy = py[R.n] - py[R.n2], uz = pz[R.n] - pz[R.n2]; const l = Math.hypot(ux, uy, uz) || 1; ux /= l; uy /= l; uz /= l;
      let dd = u[0] * ux + u[1] * uy + u[2] * uz, ax = u[0] - dd * ux, ay = u[1] - dd * uy, az = u[2] - dd * uz, al = Math.hypot(ax, ay, az);
      if (al < 0.2) { ax = -ux * uy; ay = 1 - uy * uy; az = -uz * uy; al = Math.hypot(ax, ay, az) || 1; }
      R.up = [ax / al, ay / al, az / al]; if (py[R.n] < -1) R.fell = true;
    }
  }
  memberHits();
}

function waterStep(dt) {
  if (!water.length) return;
  for (let i = 0; i < nN; i++) {
    if (!alive[i] || pinned[i] || py[i] > 1.2) continue; const w = inWater(px[i], pz[i]); if (!w) continue;
    const k = 1 - Math.min(0.5, 3.2 * dt); if (vy[i] < -3.5 && py[i] < nr[i] + 0.4 && !isRider[i]) { sfx('splash', 0.5); for (let q = 0; q < 4; q++) emit(3, px[i], 0.2, pz[i], rnd(-1, 1) * 2, rnd(1, 4), rnd(-1, 1) * 2, 0.6, 0.8); }
    vx[i] *= k; vz[i] *= k; vy[i] *= 1 - Math.min(0.2, 1.5 * dt);
  }
}
function elevStep(dt) {
  if (!E.on) return; E.at = -1;
  if (E.wait > 0) { E.wait -= dt; E.at = E.k; return; }
  const tgt = E.lv[E.k + E.dir] === undefined ? E.k : E.k + E.dir, ty = E.lv[tgt], d = ty - E.y, sp = 1.3;
  if (Math.abs(d) <= sp * dt) { E.y = ty; E.k = tgt; E.wait = 4; E.at = E.k; if (E.k >= E.lv.length - 1) E.dir = -1; else if (E.k <= 0) E.dir = 1; } else E.y += Math.sign(d) * sp * dt;
}
function stepFrame() {
  const t0 = performance.now();
  const dt = (1 / 60) * timeScale, sub = FR.sub, h = dt / sub;
  for (let i = 0; i < nN; i++) cont[i] = 0;
  refreshRiders(); threats(); boomT = Math.max(0, boomT - dt); elevStep(dt);
  for (let pi = 0; pi < panels.length; pi++) { const P = panels[pi]; let ok = !P.broken; for (let k = 0; k < P.ms.length; k++) if (!mem[P.ms[k]].alive) { ok = false; break; } if (ok) for (let k = 0; k < P.n.length; k++) if (!alive[P.n[k]]) { ok = false; break; } P.ok = ok; }
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
  if (!grace) for (let pi = 0; pi < panels.length; pi++) { const P = panels[pi]; if (!P.glass || P.broken || !P.ok) continue; let mx = 0; for (let k = 0; k < P.ms.length; k++) { const m = mem[P.ms[k]]; if (m.alive && m.kind <= BEAM) { const a = Math.abs(m.st); if (a > mx) mx = a; } } if (mx > (P.thr || 0.009)) breakGlass(P, 0, 1, 0); }
  if (!grace && peak > cnt.peak) cnt.peak = peak;
  cnt.now = peak;
  fireStep(dt); fireSpread(dt);
  ridersStep(dt);
  droneStep(dt); dragonStep(dt); ufoStep(dt); floodStep(dt); shellStep(dt); waterStep(dt);
  for (let i = tracers.length - 1; i >= 0; i--) { tracers[i].t += dt; if (tracers[i].t > 0.12) tracers.splice(i, 1); }
  for (let i = marks.length - 1; i >= 0; i--) { marks[i].t += dt; if (marks[i].t > marks[i].life) marks.splice(i, 1); }
  for (let i = 0; i < 3; i++) { const b = BOLTS[i]; if (b.on) { b.t += dt; if (b.t > 0.4) b.on = false; } }
  if (flash > 0) flash = Math.max(0, flash - dt);
  for (let i = props.length - 1; i >= 0; i--) { props[i].t += dt; if (props[i].t > props[i].life) props.splice(i, 1); }
  simClock += dt; if (S.tick) S.tick(dt);
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
const WOOD = new Set(['#7A5C3E', '#6B4A2E', '#5B3E24', '#8A5A2B', '#8A3B2F', '#B88A55', '#9B7B52', '#9A6B3F', '#6B4A2B', '#5A4630']);
function loadScene(ix, keep) {
  sceneIx = ix; const sc = SCENES[ix];
  resetWorld(); seed = hash(sc.id) || 1;
  S = { m: 2, k: 1, ks: 0.2, u: 1, view: [0.5, 0.3], name: sc.name, id: sc.id, size: 10, pit: 6, env: { sky: 'day', ground: 'grass' }, hint: '' };
  sc.build(); riftRiders(sc.rs || 1);
  for (let mi = 0; mi < mem.length; mi++) { const m = mem[mi]; if (m.hid || m.kind === LINK) continue; if (m.kind === FAB) flam.push(mi); else if (m.kind === BEAM && WOOD.has(m.col) && !m.tree) { if (!m.burnT) m.burnT = 4.5; flam.push(mi); } }
  // bounding boxes: the structure (for scale) and everything (for the camera)
  let x0 = 1e9, x1 = -1e9, y1 = 0, z0 = 1e9, z1 = -1e9, X0 = 1e9, X1 = -1e9, Z0 = 1e9, Z1 = -1e9, Y1 = 0;
  for (let i = 0; i < nN; i++) {
    X0 = Math.min(X0, px[i]); X1 = Math.max(X1, px[i]); Y1 = Math.max(Y1, py[i]); Z0 = Math.min(Z0, pz[i]); Z1 = Math.max(Z1, pz[i]);
    if (envN[i]) continue; x0 = Math.min(x0, px[i]); x1 = Math.max(x1, px[i]); y1 = Math.max(y1, py[i]); z0 = Math.min(z0, pz[i]); z1 = Math.max(z1, pz[i]);
  }
  for (const w of water) { X0 = Math.min(X0, w.x - w.rx); X1 = Math.max(X1, w.x + w.rx); Z0 = Math.min(Z0, w.z - w.rz); Z1 = Math.max(Z1, w.z + w.rz); }
  S.size = Math.max(3, 0.5 * Math.max(x1 - x0, z1 - z0, y1 * 1.1)); S.hx = 0.5 * Math.max(x1 - x0, z1 - z0); S.hy = y1; S.top = y1;
  S.pit = clamp(0.35 * S.size, 1.5, 14);
  S.cx = (x0 + x1) / 2; S.cz = (z0 + z1) / 2; S.cy = y1 * 0.46;
  S.bb = { x0: X0, x1: X1, y0: 0, y1: Math.max(Y1, 1.5), z0: Z0, z1: Z1 };
  S.pts = []; for (let i = 0; i < nN; i++) { if (!alive[i]) continue; const r = Math.max(nr[i], 0.3); S.pts.push([px[i], py[i] + (isRider[i] === 1 ? 1.0 : 0.3), pz[i]]); if (py[i] < 0.6) S.pts.push([px[i], 0, pz[i]]); }
  for (const w of water) for (let k = 0; k < 8; k++) { const a = TAU * k / 8; S.pts.push(w.sh === 'rect' ? [w.x + (k % 4 < 2 ? -1 : 1) * w.rx, 0, w.z + (k % 2 ? -1 : 1) * w.rz] : [w.x + w.rx * Math.cos(a), 0, w.z + w.rz * Math.sin(a)]); }
  S.bnd = [X0 + 0.5, X1 - 0.5, Z0 + 0.5, Z1 - 0.5];
  cnt.cut = cnt.broke = cnt.burnt = 0; cnt.peak = 0; cnt.glass = 0; cnt.total = cnt.alive = mem.filter(m => m.orig).length;
  Q.kind = null; Q.ox = Q.oy = Q.oz = 0; rift.gap = 0; tornadoes = []; gust = null; grab = null; pc = 0; rings = []; inferno = 0; simT = 0; shake = 0; streaks.length = 0; tracers.length = 0; marks.length = 0; for (let i = 0; i < 3; i++) BOLTS[i].on = false; flash = 0;
  for (let i = 0; i < nN; i++) { vx[i] = vy[i] = vz[i] = 0; }
  // settle for a moment without any breaking
  grace = true; const ts = timeScale; timeScale = 1;
  for (let f = 0; f < 80; f++) stepFrame();
  for (let i = 0; i < nN; i++) { vx[i] *= 0.2; vy[i] *= 0.2; vz[i] *= 0.2; }
  syncRiders(); timeScale = ts; grace = false; simT = 0; cnt.peak = 0; pc = 0; rings = [];
  for (let k = 0; k < 6; k++) stepFrame();
  for (const P of panels) if (P.glass) { let mx = 0; for (const mi of P.ms) { const m = mem[mi]; if (m.alive && m.kind <= BEAM) mx = Math.max(mx, Math.abs(m.st)); } P.thr = Math.max(0.009, 3 * mx); }
  cnt.peak = 0; simT = 0; simClock = 0; boomT = 0;
  if (S.afterLoad) S.afterLoad();
  if (!keep) cam.reset(true); else { cam.panX = 0; cam.panZ = 0; }
  if (armBtn) armBtn.setAttribute('aria-pressed', 'false');
  if (window.funSound) window.funSound.stopAll();
}

/* ===================== 5. camera and drawing ===================== */
const cam = { yaw: 0.5, pitch: 0.3, dist: 30, vyaw: 0, w: 800, h: 600, dpr: 1, zoom: 1, cx: 400, cy: 300, f: 700, x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 0, rx: 1, rz: 0, ux: 0, uy: 1, uz: 0, tx: 0, ty: 0, tz: 0 };
cam.panX = 0; cam.panZ = 0;
cam.reset = function (full) { this.yaw = S.view[0]; this.pitch = S.view[1]; this.vyaw = 0; this.zoom = 1; this.panX = 0; this.panZ = 0; };
// frame the whole scene: fit its bounding box to the stage at the current angle and center it, so it also works from above
cam.update = function (shk) {
  const w = this.w, h = this.h, bb = S.bb;
  const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw), sp = Math.sin(this.pitch), cp = Math.cos(this.pitch);
  const ox = sy * cp, oy = sp, oz = cy * cp;
  this.fx = -ox; this.fy = -oy; this.fz = -oz; this.rx = cy; this.rz = -sy; this.ux = -sp * sy; this.uy = cp; this.uz = -sp * cy;
  const s0 = Math.min(w, h * 1.2); this.f = s0 * 1.25;
  const tx = (bb.x0 + bb.x1) / 2, ty = (bb.y0 + bb.y1) / 2, tz = (bb.z0 + bb.z1) / 2; this.tx0 = tx; this.tz0 = tz; this.tx = tx + this.panX; this.ty = ty; this.tz = tz + this.panZ;
  const mL = 14, mT = room ? (coarse ? 64 : 60) : coarse ? 40 : 42, mB = room ? (coarse ? 92 : 104) : coarse ? 44 : 48, aw = w - 2 * mL, ah = h - mT - mB, P = [];
  for (const q of S.pts) { const dx = q[0] - tx, dy = q[1] - ty, dz = q[2] - tz; P.push([dx * this.rx + dz * this.rz, dx * this.ux + dy * this.uy + dz * this.uz, dx * this.fx + dy * this.fy + dz * this.fz]); }
  let zmin = 1e9; for (const p of P) zmin = Math.min(zmin, p[2]);
  const ext = D => { let a = 1e9, b = -1e9, c = 1e9, e = -1e9; for (const p of P) { const k = this.f / Math.max(0.5, D + p[2]), u = p[0] * k, v = p[1] * k; if (u < a) a = u; if (u > b) b = u; if (v < c) c = v; if (v > e) e = v; } return [a, b, c, e]; };
  let d = 60; for (let it = 0; it < 6; it++) { const q = ext(d); d = Math.max(-zmin + 1, d * Math.max((q[1] - q[0]) / aw, (q[3] - q[2]) / ah)); }
  const D = d * this.zoom, q = ext(D); this.base = d; this.dist = D;
  this.x = this.tx + D * ox; this.y = ty + D * oy; this.z = this.tz + D * oz;
  this.cx = mL + aw / 2 - (q[0] + q[1]) / 2 + (shk ? rnd(-1, 1) * shk : 0); this.cy = mT + ah / 2 + (q[2] + q[3]) / 2 + (shk ? rnd(-1, 1) * shk : 0);
};
// move the view across the ground by (dx, dz), kept inside the scene box grown by 1.5 sizes
cam.shift = function (dx, dz) {
  const bb = S.bb, g = 1.5 * S.size, tx0 = this.tx0 === undefined ? (bb.x0 + bb.x1) / 2 : this.tx0, tz0 = this.tz0 === undefined ? (bb.z0 + bb.z1) / 2 : this.tz0;
  const nx = clamp(this.panX + dx, bb.x0 - g - tx0, bb.x1 + g - tx0), nz = clamp(this.panZ + dz, bb.z0 - g - tz0, bb.z1 + g - tz0), ax = nx - this.panX, az = nz - this.panZ;
  this.panX = nx; this.panZ = nz; this.x += ax; this.z += az; this.tx += ax; this.tz += az;
};
// zoom by a factor (below 1 is closer) while the ground point under (x, y) stays under it
cam.zoomAt = function (x, y, f) {
  const g0 = groundHit(x, y); this.zoom = clamp(this.zoom * f, 0.12, 3.5); if (!g0) return;
  this.update(0); const g1 = groundHit(x, y); if (g1) this.shift(g0[0] - g1[0], g0[2] - g1[2]);
};
// drag the world: the ground point that was under (x0, y0) follows the pointer to (x1, y1)
cam.dragPan = function (x0, y0, x1, y1) {
  const a = groundHit(x0, y0), b = groundHit(x1, y1); let dx, dz;
  if (a && b) { dx = a[0] - b[0]; dz = a[2] - b[2]; const L = Math.hypot(dx, dz), mx = 0.5 * S.size; if (L > mx) { dx *= mx / L; dz *= mx / L; } }
  else { const s = this.dist / this.f, fl = Math.hypot(this.fx, this.fz) || 1; dx = -this.rx * (x1 - x0) * s + this.fx / fl * (y1 - y0) * s; dz = -this.rz * (x1 - x0) * s + this.fz / fl * (y1 - y0) * s; }
  this.shift(dx, dz);
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
const SKY = { day: ['#7DB8EC', '#E6F4FF', '#CFE8C2', '#BBDDA0', '#79B866'], dusk: ['#47568F', '#F4B58B', '#C9C29A', '#92AE80', '#5A8A58'], night: ['#08102B', '#2A3C70', '#244538', '#20493A', '#173A2E'], indoor: ['#E7ECF5', '#F4F7FB', '#E3E8F1', '#DDE3EE', '#CCD4E3'] };
function horizonY() { return cam.cy - cam.f * Math.tan(cam.pitch); }
function drawSky() {
  const w = cam.w, h = cam.h, C = SKY[S.env.sky] || SKY.day, hy = horizonY();
  if (S.env.sky === 'indoor') { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, C[0]); g.addColorStop(1, C[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); return; }
  if (hy <= 0) { const g0 = ctx.createLinearGradient(0, hy, 0, h); g0.addColorStop(0, C[3]); g0.addColorStop(1, C[4]); ctx.fillStyle = g0; ctx.fillRect(0, 0, w, h); return; }
  const y0 = Math.min(hy, h), g = ctx.createLinearGradient(0, Math.min(0, hy - 420), 0, y0); g.addColorStop(0, C[0]); g.addColorStop(1, C[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, y0 + 1);
  if (hy < h) { ctx.fillStyle = C[2]; ctx.fillRect(0, hy, w, h - hy); }
  const night = S.env.sky === 'night', t = simClock;
  if (night) {
    for (let i = 0; i < 70; i++) { const x = ((i * 97.13) % 1) * w + ((i * 53.7) % 1) * 0, sx_ = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * w, sy_ = (Math.sin(i * 78.233) * 12345.678 % 1 + 1) % 1 * Math.max(10, y0 - 10), tw = 0.5 + 0.5 * Math.sin(t * 1.5 + i); ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * tw})`; ctx.fillRect(sx_, sy_, 1.8, 1.8); }
    const mx = w * 0.82, my = Math.max(34, y0 * 0.3); ctx.fillStyle = '#F3F1E4'; ctx.beginPath(); ctx.arc(mx, my, 20, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(8,16,43,.9)'; ctx.beginPath(); ctx.arc(mx + 9, my - 4, 18, 0, TAU); ctx.fill();
  } else {
    const sx0 = w * 0.84 - cam.yaw * 30, sy0 = Math.max(36, y0 * 0.32), r = 24, g2 = ctx.createRadialGradient(sx0, sy0, 2, sx0, sy0, r * 3.2);
    g2.addColorStop(0, S.env.sky === 'dusk' ? 'rgba(255,190,110,.95)' : 'rgba(255,248,200,.95)'); g2.addColorStop(0.3, S.env.sky === 'dusk' ? 'rgba(255,170,90,.5)' : 'rgba(255,240,170,.4)'); g2.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(sx0, sy0, r * 3.2, 0, TAU); ctx.fill(); ctx.fillStyle = S.env.sky === 'dusk' ? '#FFC98A' : '#FFF6C9'; ctx.beginPath(); ctx.arc(sx0, sy0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = S.env.sky === 'dusk' ? 'rgba(255,225,205,.55)' : 'rgba(255,255,255,.88)';
    for (let i = 0; i < 6; i++) {
      const sp = 6 + (i % 3) * 3, cx = ((i * 211 + t * sp - cam.yaw * 90) % (w + 260) + (w + 260)) % (w + 260) - 130, cy = Math.max(26, y0 * (0.18 + (i % 4) * 0.13)), s = 26 + (i % 3) * 12;
      ctx.beginPath(); ctx.ellipse(cx, cy, s * 1.6, s * 0.5, 0, 0, TAU); ctx.ellipse(cx - s * 0.7, cy - s * 0.2, s * 0.8, s * 0.55, 0, 0, TAU); ctx.ellipse(cx + s * 0.6, cy - s * 0.25, s * 0.9, s * 0.6, 0, 0, TAU); ctx.fill();
    }
  }
}
const FLOWER = ['#FFFFFF', '#FFE066', '#FF9EB5', '#C9A7FF'];
function ringPoly(w, n, y) { const o = []; for (let i = 0; i < n; i++) { const a = TAU * i / n; o.push([w.x + w.rx * Math.cos(a), y, w.z + w.rz * Math.sin(a)]); } return o; }
function drawGround() {
  const size = S.size, G = Math.max(140, size * 8), hg = rift.gap / 2, C = SKY[S.env.sky] || SKY.day, indoor = S.env.sky === 'indoor';
  const ox = Q.kind === 'side' ? Q.ox : 0, oz = Q.kind === 'side' ? Q.oz : 0, wave = Q.kind === 'roll' || Q.kind === 'up';
  const hy = horizonY(), gy0 = Math.min(hy, cam.h), gr = ctx.createLinearGradient(0, gy0, 0, cam.h); gr.addColorStop(0, C[3]); gr.addColorStop(1, C[4]);
  if (hg > 0) {
    ctx.fillStyle = '#1B2331'; if (polyPath([[-hg, -S.pit, -G], [hg, -S.pit, -G], [hg, -S.pit, G], [-hg, -S.pit, G]])) ctx.fill();
    ctx.fillStyle = '#4C586B'; if (polyPath([[-hg, 0, -G], [-hg, -S.pit, -G], [-hg, -S.pit, G], [-hg, 0, G]])) ctx.fill();
    ctx.fillStyle = '#3A4558'; if (polyPath([[hg, 0, -G], [hg, -S.pit, -G], [hg, -S.pit, G], [hg, 0, G]])) ctx.fill();
    ctx.fillStyle = gr; if (polyPath([[-G, 0, -G], [-hg, 0, -G], [-hg, 0, G], [-G, 0, G]])) ctx.fill(); if (polyPath([[hg, 0, -G], [G, 0, -G], [G, 0, G], [hg, 0, G]])) ctx.fill();
    ctx.strokeStyle = '#7C8AA0'; ctx.lineWidth = 2; ctx.beginPath(); lineW([-hg, 0, -G], [-hg, 0, G]); lineW([hg, 0, -G], [hg, 0, G]); ctx.stroke();
  } else { ctx.fillStyle = gr; if (polyPath([[-G, 0, -G], [G, 0, -G], [G, 0, G], [-G, 0, G]])) ctx.fill(); }
  const inRift = x => hg > 0 && Math.abs(x) < hg + 0.2;
  // paths and roads
  for (const p of pathsL) {
    ctx.fillStyle = p.col;
    for (let i = 0; i < p.pts.length - 1; i++) {
      const a = p.pts[i], b = p.pts[i + 1], ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez) || 1, nx = -ez / l * p.w / 2, nz = ex / l * p.w / 2;
      if (polyPath([[a[0] + nx + ox, 0.01, a[1] + nz + oz], [b[0] + nx + ox, 0.01, b[1] + nz + oz], [b[0] - nx + ox, 0.01, b[1] - nz + oz], [a[0] - nx + ox, 0.01, a[1] - nz + oz]])) ctx.fill();
      if (p.dash) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = Math.max(1, 0.12 * cam.f / cam.dist); ctx.beginPath(); for (let d = 0; d < l - 1; d += 3.2) lineW([a[0] + ex / l * d + ox, 0.02, a[1] + ez / l * d + oz], [a[0] + ex / l * (d + 1.5) + ox, 0.02, a[1] + ez / l * (d + 1.5) + oz]); ctx.stroke(); }
    }
  }
  // water
  for (const w of water) {
    const y = w.y || 0, poly = w.sh === 'rect' ? [[w.x - w.rx, y, w.z - w.rz], [w.x + w.rx, y, w.z - w.rz], [w.x + w.rx, y, w.z + w.rz], [w.x - w.rx, y, w.z + w.rz]] : ringPoly(w, 30, y);
    poly.forEach(p => { p[0] += ox; p[2] += oz; });
    ctx.fillStyle = S.env.sky === 'night' ? '#1F3F73' : '#5DA9DB'; if (polyPath(poly)) ctx.fill();
    ctx.strokeStyle = S.env.sky === 'night' ? '#16305A' : '#3A87BA'; ctx.lineWidth = 3; if (polyPath(poly)) ctx.stroke();
    if (!lite) { ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = 1.2; for (let r = 0; r < 3; r++) { const u = ((simClock * 0.25 + r / 3) % 1), rw = { x: w.x + ox, z: w.z + oz, rx: w.rx * (0.25 + 0.7 * u) * (w.sh === 'rect' ? 1 : 1), rz: w.rz * (0.25 + 0.7 * u) }; ctx.globalAlpha = 1 - u; if (w.sh === 'rect') { if (polyPath([[rw.x - rw.rx, y, rw.z - rw.rz], [rw.x + rw.rx, y, rw.z - rw.rz], [rw.x + rw.rx, y, rw.z + rw.rz], [rw.x - rw.rx, y, rw.z + rw.rz]])) ctx.stroke(); } else if (polyPath(ringPoly(rw, 24, y))) ctx.stroke(); ctx.globalAlpha = 1; } }
  }
  if (indoor) { ctx.strokeStyle = 'rgba(95,125,165,.18)'; ctx.lineWidth = 1; ctx.beginPath(); const gs = Math.max(1, Math.pow(10, Math.floor(Math.log10(size / 5)))), L = Math.ceil(size * 2.6 / gs) * gs; for (let v = -L; v <= L + 1e-6; v += gs) { lineW([v + ox, 0, -L + oz], [v + ox, 0, L + oz]); lineW([-L + ox, 0, v + oz], [L + ox, 0, v + oz]); } ctx.stroke(); }
  if (!indoor) {
    // grass tufts and flowers
    ctx.strokeStyle = S.env.sky === 'night' ? 'rgba(90,170,130,.55)' : 'rgba(54,120,56,.6)'; ctx.lineWidth = Math.max(1, 0.06 * cam.f / cam.dist); ctx.beginPath();
    const step = lite ? 2 : 1;
    for (let i = 0; i < tufts.length; i += step) {
      const t = tufts[i], x = t[0] + ox, z = t[1] + oz; if (inRift(x)) continue; const y = wave ? groundY(x) : 0, k = pr(x, y, z); if (PZ < NEAR || PX < -10 || PX > cam.w + 10 || PY < -10 || PY > cam.h + 10) continue;
      const h = t[2] * k * 1.2, bx = PX, by = PY; ctx.moveTo(bx, by); ctx.lineTo(bx - h * 0.35, by - h); ctx.moveTo(bx, by); ctx.lineTo(bx + h * 0.05, by - h * 1.2); ctx.moveTo(bx, by); ctx.lineTo(bx + h * 0.4, by - h * 0.9);
    }
    ctx.stroke();
    for (const b of blooms) { const x = b[0] + ox, z = b[1] + oz; if (inRift(x)) continue; const k = pr(x, wave ? groundY(x) : 0, z); if (PZ < NEAR || PX < 0 || PX > cam.w || PY < 0 || PY > cam.h) continue; ctx.fillStyle = FLOWER[b[2]]; ctx.beginPath(); ctx.arc(PX, PY - 0.15 * k, Math.max(1.2, 0.12 * k), 0, TAU); ctx.fill(); }
  }
  if (Q.kind && !indoor) { const raw = size / 5, mag = Math.pow(10, Math.floor(Math.log10(raw))), gs = raw / mag < 2 ? mag : raw / mag < 5 ? 2 * mag : 5 * mag, L = Math.ceil(size * 2.6 / gs) * gs; ctx.strokeStyle = `rgba(255,255,255,${0.35 * Math.max(Q.env, 0.4)})`; ctx.lineWidth = 1; ctx.beginPath();
    const sh = x => hg > 0 ? x + (x < 0 ? -hg : hg) : x;
    for (let v = -L; v <= L + 1e-6; v += gs) { const x = sh(v) + ox, y = wave ? groundY(x) : 0; lineW([x, y, -L + oz], [x, y, L + oz]); const z = v + oz, segs = wave ? 22 : 1; const emitRange = (xa, xb) => { for (let s = 0; s < segs; s++) { const a = xa + (xb - xa) * s / segs, b = xa + (xb - xa) * (s + 1) / segs; lineW([a, wave ? groundY(a) : 0, z], [b, wave ? groundY(b) : 0, z]); } }; if (hg > 0) { emitRange(-L - hg, -hg); emitRange(hg, L + hg); } else emitRange(-L + ox, L + ox); } ctx.stroke(); }
  // flood
  if (flood) {
    const F = flood, lvl = F.rec ? clamp(1 - F.lvl / 6, 0, 1) : 1, H = F.H * lvl * 0.92, e = F.ext + 12, px_ = -F.dz, pz_ = F.dx, s0 = F.s, sl = Math.min(6, Math.max(0, s0 + e));
    const W = (a, y, b) => [F.dx * a + px_ * b, y, F.dz * a + pz_ * b];
    ctx.globalAlpha = 0.62; ctx.fillStyle = '#4FA0D8'; if (polyPath([W(-e, H, -e), W(s0 - sl, H, -e), W(s0 - sl, H, e), W(-e, H, e)])) ctx.fill();
    ctx.fillStyle = '#7CC0EA'; if (polyPath([W(s0 - sl, H, -e), W(s0, 0.05, -e), W(s0, 0.05, e), W(s0 - sl, H, e)])) ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2.5; ctx.beginPath(); lineW(W(s0, 0.08, -e), W(s0, 0.08, e)); ctx.stroke();
  }
}
// bullseye on the ground: the pointer places it, and it stays until the shot lands
function drawBull(x, y, z, R, k, a) {
  const kk = pr(x, y + 0.03, z); if (PZ < NEAR) return; const ry = 0.14 + 0.86 * Math.sin(cam.pitch), cols = ['#E5392D', '#FFFFFF', '#E5392D', '#FFFFFF', '#E5392D'];
  ctx.globalAlpha = a === undefined ? 0.9 : a;
  for (let i = 0; i < 5; i++) { const rr = R * (1 - i * 0.2) * kk; ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.ellipse(PX, PY, rr, rr * ry, 0, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = 'rgba(40,20,20,.7)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(PX, PY, R * kk, R * kk * ry, 0, 0, TAU); ctx.stroke();
  ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(229,57,45,.8)'; ctx.lineWidth = 1.6; ctx.lineDashOffset = -simClock * 20; ctx.beginPath(); ctx.ellipse(PX, PY, R * 1.9 * kk, R * 1.9 * kk * ry, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(PX - R * 2.3 * kk, PY); ctx.lineTo(PX + R * 2.3 * kk, PY); ctx.moveTo(PX, PY - R * 2.3 * kk * ry); ctx.lineTo(PX, PY + R * 2.3 * kk * ry); ctx.stroke();
  ctx.globalAlpha = 1;
}
function bullR(kind) { return kind === 'bomb' ? 0.08 * S.size + 0.9 : kind === 'bolt' ? 0.05 * S.size + 0.6 : kind === 'rocket' ? 0.1 * S.size + 0.9 : kind === 'meteor' ? 0.12 * S.size + 1 : 0.9 * Math.max(S.u, 0.6); }
function drawCrown(c) {
  const n = c.n;
  if (!alive[n]) { const k = pr(c.x, 0, c.z); if (PZ < NEAR) return; ctx.fillStyle = '#2B2622'; ctx.beginPath(); ctx.ellipse(PX, PY, 0.5 * k * (c.bush ? 0.6 : 0.5), 0.2 * k, 0, 0, TAU); ctx.fill(); if (c.smolder > 0) { } return; }
  const k = pr(px[n], py[n], pz[n]); if (PZ < NEAR) return; const r = c.r * k; let bn = 0; for (const mi of c.ms) if (mem[mi].alive && mem[mi].burn >= 0) bn++;
  const t = c.tone, night = S.env.sky === 'night', dk = night ? 0.55 : 1, col = (a, b, cc) => `rgb(${Math.round(a * dk)},${Math.round(b * dk)},${Math.round(cc * dk)})`;
  const base = c.bush ? [70 + 20 * t, 140 + 24 * t, 64] : [52 + 26 * t, 128 + 26 * t, 62];
  const blobs = c.bush ? [[-0.45, 0.1, 0.62, 0.8], [0.45, 0.12, 0.6, 0.88], [0, -0.22, 0.7, 1.0]] : [[-0.4, 0.22, 0.7, 0.78], [0.42, 0.2, 0.68, 0.86], [-0.1, -0.35, 0.78, 0.96], [0.3, -0.5, 0.5, 1.06]];
  for (const b of blobs) { ctx.fillStyle = col(base[0] * b[3], base[1] * b[3], base[2] * b[3]); ctx.beginPath(); ctx.arc(PX + b[0] * r, PY + b[1] * r, b[2] * r, 0, TAU); ctx.fill(); }
  if (bn) { const g = ctx.createRadialGradient(PX, PY, r * 0.1, PX, PY, r * 1.5); g.addColorStop(0, `rgba(255,200,80,${0.8 + 0.15 * Math.sin(simClock * 20)})`); g.addColorStop(0.5, 'rgba(255,100,30,.5)'); g.addColorStop(1, 'rgba(255,80,20,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(PX, PY - r * 0.1, r * 1.5, 0, TAU); ctx.fill(); }
}
function drawBarrel(R) {
  const i = R.n; if (!alive[i]) return; const k = pr(px[i], py[i], pz[i]); if (PZ < NEAR) return; const rr = 0.4 * R.s * k, hh = 0.48 * R.s * k, flash = R.go && Math.sin(simClock * 40) > 0;
  ctx.fillStyle = flash ? '#FFE9B0' : R.kind === 'fw' ? '#2F5FA8' : '#C0392B'; ctx.fillRect(PX - rr, PY - hh, rr * 2, hh * 2);
  ctx.beginPath(); ctx.ellipse(PX, PY + hh, rr, rr * 0.35, 0, 0, TAU); ctx.fill(); ctx.fillStyle = flash ? '#FFF6D8' : R.kind === 'fw' ? '#4D7FCF' : '#E25B49'; ctx.beginPath(); ctx.ellipse(PX, PY - hh, rr, rr * 0.35, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = Math.max(1, 0.05 * k); ctx.beginPath(); ctx.moveTo(PX - rr, PY - hh * 0.4); ctx.lineTo(PX + rr, PY - hh * 0.4); ctx.moveTo(PX - rr, PY + hh * 0.4); ctx.lineTo(PX + rr, PY + hh * 0.4); ctx.stroke();
  ctx.fillStyle = R.kind === 'fw' ? '#FFE066' : '#FFD23F'; ctx.beginPath(); const q = R.s * k; ctx.moveTo(PX, PY - 0.28 * q); ctx.quadraticCurveTo(PX + 0.22 * q, PY - 0.02 * q, PX, PY + 0.22 * q); ctx.quadraticCurveTo(PX - 0.22 * q, PY - 0.02 * q, PX, PY - 0.28 * q); ctx.fill();
}
function drawDrone(D) {
  if (D.t < 0) return; const k = pr(D.x, D.y, D.z); if (PZ < NEAR) return; const s = Math.max(0.5, 0.6 * k * Math.max(S.u, 0.7));
  ctx.fillStyle = 'rgba(20,30,50,.18)'; const k2 = pr(D.x, 0, D.z); ctx.beginPath(); ctx.ellipse(PX, PY, s * 1.2, s * 0.4, 0, 0, TAU); ctx.fill(); pr(D.x, D.y, D.z);
  ctx.strokeStyle = '#2B3340'; ctx.lineWidth = Math.max(1.5, s * 0.22); ctx.beginPath(); ctx.moveTo(PX - s * 1.2, PY - s * 0.2); ctx.lineTo(PX + s * 1.2, PY + s * 0.2); ctx.moveTo(PX - s * 1.2, PY + s * 0.2); ctx.lineTo(PX + s * 1.2, PY - s * 0.2); ctx.stroke();
  ctx.fillStyle = '#3A4558'; ctx.beginPath(); ctx.ellipse(PX, PY, s * 0.55, s * 0.35, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = Math.sin(D.ph * 0.3) > 0 ? '#FF4D4D' : '#7A1F1F'; ctx.beginPath(); ctx.arc(PX, PY, s * 0.14, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(190,200,215,.55)'; for (const [ax, ay] of [[-1.2, -0.2], [1.2, 0.2], [-1.2, 0.2], [1.2, -0.2]]) { ctx.beginPath(); ctx.ellipse(PX + ax * s, PY + ay * s - s * 0.1, s * 0.55, s * 0.14 + Math.abs(Math.sin(D.ph)) * s * 0.1, 0, 0, TAU); ctx.fill(); }
}
function drawDragon(D) {
  if (D.t < 0) return; const L = Math.max(0.1 * S.size, 4.2), C = DRG[D.k], dx = D.dx, dz = D.dz, px_ = -dz, pz_ = dx, N = 9, seg = L / N;
  const P = []; for (let j = 0; j < N; j++) { const wig = Math.sin(D.ph * 0.9 - j * 0.75), lat = Math.sin(D.ph * 0.55 - j * 0.6) * 0.06 * L; P.push([D.x - dx * j * seg + px_ * lat, D.y + wig * 0.05 * L - j * 0.012 * L, D.z - dz * j * seg + pz_ * lat]); }
  const sp = P.map(p => { const k = pr(p[0], p[1], p[2]); return [PX, PY, k]; }); if (sp.some(p => !isFinite(p[0]))) return;
  const k0 = sp[2][2]; ctx.fillStyle = 'rgba(20,30,50,.15)'; pr(D.x, 0, D.z); ctx.beginPath(); ctx.ellipse(PX, PY, 0.5 * L * k0, 0.1 * L * k0, 0, 0, TAU); ctx.fill();
  const wing = (sgn) => { const fl = Math.sin(D.ph) * 0.8, sh = P[2], span = 0.55 * L, tipX = sh[0] + px_ * sgn * span * Math.cos(fl * 0.5) - dx * 0.15 * L, tipZ = sh[2] + pz_ * sgn * span * Math.cos(fl * 0.5) - dz * 0.15 * L, tipY = sh[1] + span * Math.sin(fl + 0.35) + 0.05 * L;
    const a = sp[2], tp = (pr(tipX, tipY, tipZ), [PX, PY]), t2 = (pr(tipX - dx * 0.45 * L, tipY - 0.1 * L, tipZ - dz * 0.45 * L), [PX, PY]), b = sp[4];
    ctx.fillStyle = C.wing; ctx.globalAlpha = 0.93; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(tp[0], tp[1]); ctx.lineTo(t2[0], t2[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = Math.max(1, 0.012 * L * a[2]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(tp[0], tp[1]); ctx.moveTo(a[0], a[1]); ctx.lineTo(t2[0], t2[1]); ctx.stroke(); };
  const far = sgn => (px_ * (cam.x - D.x) + pz_ * (cam.z - D.z)) * sgn < 0;
  wing(far(1) ? 1 : -1);
  for (let j = N - 2; j >= 0; j--) { const w = L * (j < 1 ? 0.05 : j < 5 ? 0.12 - (j - 1) * 0.004 : 0.11 - (j - 4) * 0.02); ctx.strokeStyle = C.body; ctx.lineWidth = Math.max(1.5, w * sp[j][2]); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sp[j + 1][0], sp[j + 1][1]); ctx.lineTo(sp[j][0], sp[j][1]); ctx.stroke(); if (j > 0 && j < 6) { ctx.strokeStyle = C.belly; ctx.lineWidth = Math.max(1, w * sp[j][2] * 0.35); ctx.beginPath(); ctx.moveTo(sp[j + 1][0], sp[j + 1][1] + w * sp[j][2] * 0.22); ctx.lineTo(sp[j][0], sp[j][1] + w * sp[j][2] * 0.22); ctx.stroke(); } }
  // head, horns, eye
  const H = sp[0], hr = 0.07 * L * H[2]; ctx.fillStyle = C.body; ctx.beginPath(); ctx.ellipse(H[0], H[1], hr * 1.5, hr, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = C.wing; ctx.lineWidth = Math.max(1.2, hr * 0.35); ctx.beginPath(); ctx.moveTo(H[0] - hr * 0.2, H[1] - hr * 0.6); ctx.lineTo(H[0] - hr * 1.2, H[1] - hr * 1.7); ctx.moveTo(H[0] + hr * 0.3, H[1] - hr * 0.7); ctx.lineTo(H[0] - hr * 0.6, H[1] - hr * 1.8); ctx.stroke();
  ctx.fillStyle = D.breath > 0.2 ? '#FFD23F' : '#FFF1A8'; ctx.beginPath(); ctx.arc(H[0] + hr * 0.3, H[1] - hr * 0.15, Math.max(1.2, hr * 0.22), 0, TAU); ctx.fill();
  // rider: a hooded figure in a cape, seated behind the shoulders
  const R0 = sp[3], rs = 0.045 * L * R0[2]; ctx.fillStyle = C.cape; ctx.beginPath(); ctx.moveTo(R0[0] - rs * 0.7, R0[1] - rs * 1.1); ctx.lineTo(R0[0] + rs * 0.7, R0[1] - rs * 1.1); ctx.lineTo(R0[0] + rs * 1.5, R0[1] + rs * 0.5); ctx.lineTo(R0[0] - rs * 1.5, R0[1] + rs * 0.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2B2D3A'; ctx.beginPath(); ctx.arc(R0[0], R0[1] - rs * 1.6, rs * 0.62, 0, TAU); ctx.fill(); ctx.fillStyle = '#E8B58C'; ctx.beginPath(); ctx.arc(R0[0] + rs * 0.1, R0[1] - rs * 1.5, rs * 0.32, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#6B4A2B'; ctx.lineWidth = Math.max(1, rs * 0.18); ctx.beginPath(); ctx.moveTo(R0[0] + rs * 0.8, R0[1] + rs * 0.2); ctx.lineTo(R0[0] + rs * 2.4, R0[1] - rs * 2.6); ctx.stroke();
  wing(far(1) ? -1 : 1);
}
function drawUfo(U) {
  const Rb = 0.1 * S.size + 3.2, kb = pr(U.x, 0, U.z), gx = PX, gy = PY, ry = 0.14 + 0.86 * Math.sin(cam.pitch); const kt = pr(U.x, U.y - 0.5, U.z), tx = PX, ty = PY; if (PZ < NEAR) return;
  if (U.beam > 0.05) { const g = ctx.createLinearGradient(0, ty, 0, gy); g.addColorStop(0, `rgba(210,255,190,${0.5 * U.beam})`); g.addColorStop(1, `rgba(160,255,200,${0.18 * U.beam})`); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(tx - 0.12 * Rb * kt, ty); ctx.lineTo(gx + Rb * kb, gy); ctx.ellipse(gx, gy, Rb * kb, Rb * kb * ry, 0, 0, Math.PI); ctx.lineTo(tx + 0.12 * Rb * kt, ty); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.ellipse(gx, gy, Rb * kb, Rb * kb * ry, 0, 0, TAU); ctx.fill(); }
  const r = (0.045 * S.size + 1.4) * kt; ctx.fillStyle = '#9AA6B8'; ctx.beginPath(); ctx.ellipse(tx, ty - r * 0.1, r, r * 0.3, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#6E7C92'; ctx.beginPath(); ctx.ellipse(tx, ty, r * 0.95, r * 0.18, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = 'rgba(150,215,255,.85)'; ctx.beginPath(); ctx.ellipse(tx, ty - r * 0.3, r * 0.42, r * 0.3, 0, Math.PI, TAU); ctx.fill();
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + simClock * 2; ctx.fillStyle = Math.sin(a * 2 + simClock * 6) > 0 ? '#FFE066' : '#FF8F6B'; ctx.beginPath(); ctx.arc(tx + Math.cos(a) * r * 0.78, ty - r * 0.06 + Math.sin(a) * r * 0.1, Math.max(1.4, r * 0.06), 0, TAU); ctx.fill(); }
}
function drawProps() {
  for (const p of props) {
    const k = pr(p.x, 0.5, p.z); if (PZ < NEAR) continue; const u = Math.max(S.u, 0.7), fl = clamp(1 - p.t / 0.25, 0, 1), rec = p.k === 'cannon' ? 0.3 * Math.exp(-p.t * 6) : 0;
    const bx = p.x - p.dx * rec, bz = p.z - p.dz * rec, mx = bx + p.dx * 2.2 * u, mz = bz + p.dz * 2.2 * u;
    pr(bx, 0.9 * u, bz); const x1 = PX, y1 = PY; pr(mx, 1.05 * u, mz); const x2 = PX, y2 = PY;
    ctx.globalAlpha = clamp((p.life - p.t) / 0.6, 0, 1);
    if (p.k === 'cannon') {
      ctx.fillStyle = '#6B4A2B'; pr(p.x, 0.55 * u, p.z); const wr = 0.55 * u * k; ctx.beginPath(); ctx.arc(PX, PY, wr, 0, TAU); ctx.fill(); ctx.fillStyle = '#3A2A1A'; ctx.beginPath(); ctx.arc(PX, PY, wr * 0.35, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2B3240'; ctx.lineWidth = 0.85 * u * k; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    } else { ctx.strokeStyle = '#59704A'; ctx.lineWidth = 0.55 * u * k; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); pr(bx, 0, bz); ctx.strokeStyle = '#3A3F46'; ctx.lineWidth = 0.18 * u * k; ctx.beginPath(); ctx.moveTo(PX, PY); ctx.lineTo(x1, y1); ctx.stroke(); }
    if (fl > 0) { const g = ctx.createRadialGradient(x2, y2, 0, x2, y2, 2.2 * u * k); g.addColorStop(0, `rgba(255,230,140,${fl})`); g.addColorStop(1, 'rgba(255,120,30,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x2, y2, 2.2 * u * k, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
}
function drawBirds() {
  if (!birds.length || S.env.sky === 'indoor') return; ctx.strokeStyle = S.env.sky === 'night' ? 'rgba(210,220,240,.7)' : 'rgba(40,50,70,.75)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  const fast = boomT > 0 ? 3 : 1;
  for (const b of birds) {
    b.a += b.w * 0.016 * fast; const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r, y = b.y + Math.sin(simClock * 0.6 + b.ph) * 1.2, k = pr(x, y, z); if (PZ < NEAR) continue; if (PX < -20 || PX > cam.w + 20 || PY < -20 || PY > cam.h + 20) continue;
    const s = Math.max(3, 0.5 * k), fl = Math.sin(simClock * 9 + b.ph * 3) * s * 0.55; ctx.beginPath(); ctx.moveTo(PX - s, PY - fl); ctx.quadraticCurveTo(PX - s * 0.4, PY - s * 0.2 + fl * 0.3, PX, PY); ctx.quadraticCurveTo(PX + s * 0.4, PY - s * 0.2 + fl * 0.3, PX + s, PY - fl); ctx.stroke();
  }
}
function drawTracers() {
  ctx.lineCap = 'round';
  for (const T of tracers) { pr(T.x1, T.y1, T.z1); const a = [PX, PY]; if (PZ < NEAR) continue; pr(T.x2, T.y2, T.z2); const u = 1 - T.t / 0.12; ctx.strokeStyle = `rgba(255,236,150,${0.9 * u})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(PX, PY); ctx.stroke(); ctx.fillStyle = `rgba(255,255,255,${u})`; ctx.beginPath(); ctx.arc(PX, PY, 3 * u + 1, 0, TAU); ctx.fill(); }
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
  if (P.uv) { const [u0, u1, v0, v1] = P.uv, A = n[0], B = n[1], Cc = n[2], D = n[3], bl = (u, v) => [(1 - v) * ((1 - u) * sx[A] + u * sx[B]) + v * ((1 - u) * sx[D] + u * sx[Cc]), (1 - v) * ((1 - u) * sy[A] + u * sy[B]) + v * ((1 - u) * sy[D] + u * sy[Cc])]; const q = [bl(u0, v0), bl(u1, v0), bl(u1, v1), bl(u0, v1)]; ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for (let k = 1; k < 4; k++) ctx.lineTo(q[k][0], q[k][1]); ctx.closePath(); ctx.globalAlpha = P.al; ctx.fillStyle = P.col; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke(); return; }
  if (P.glass) { ctx.beginPath(); ctx.moveTo(sx[n[0]], sy[n[0]]); for (let k = 1; k < n.length; k++) ctx.lineTo(sx[n[k]], sy[n[k]]); ctx.closePath(); ctx.globalAlpha = P.al; ctx.fillStyle = P.col; ctx.fill(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(lerp(sx[n[0]], sx[n[1]], 0.18), lerp(sy[n[0]], sy[n[1]], 0.18)); ctx.lineTo(lerp(sx[n[3]], sx[n[2]], 0.5), lerp(sy[n[3]], sy[n[2]], 0.5)); ctx.moveTo(lerp(sx[n[0]], sx[n[1]], 0.4), lerp(sy[n[0]], sy[n[1]], 0.4)); ctx.lineTo(lerp(sx[n[3]], sx[n[2]], 0.72), lerp(sy[n[3]], sy[n[2]], 0.72)); ctx.stroke(); ctx.globalAlpha = 1; return; }
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
  const down = R.st === 0, air = down && !cont[hip], panic = R.st && R.pt > 0 && !R.safe, H = P(0, 0), neck = P(0.62, 0), head = P(0.86, 0);
  const walking = R.st && R.wk > 0.25 && !R.safe, sw = walking ? Math.sin(R.ph) : 0, sw2 = walking ? Math.sin(R.ph + Math.PI) : 0;
  const sg = R.hd || 1, step = 0.2 * (panic ? 1.5 : 1);
  if (walking) { seg(H, P(-0.5 + 0.06 * Math.abs(sw), step * sw * sg), 0.13, '#27364F'); seg(H, P(-0.5 + 0.06 * Math.abs(sw2), step * sw2 * sg), 0.13, '#27364F'); }
  else { seg(H, P(-0.5, -0.15), 0.13, '#27364F'); seg(H, P(-0.5, 0.15), 0.13, '#27364F'); }
  seg(H, neck, 0.3, R.col);
  const sh = P(0.52, 0), up = air || panic, crawl = down && R.crawl;
  const hand1 = up ? P(0.98, -0.36 + 0.1 * Math.sin(R.ph * 2)) : walking ? P(0.12 + 0.05 * Math.abs(sw), -0.3 * sw * sg) : crawl ? P(0.7, -0.3) : P(0.12, -0.34);
  const hand2 = up ? P(0.98, 0.36 + 0.1 * Math.sin(R.ph * 2 + 1)) : walking ? P(0.12 + 0.05 * Math.abs(sw2), -0.3 * sw2 * sg) : crawl ? P(0.7, 0.3) : P(0.12, 0.34);
  seg(sh, hand1, 0.09, R.col); seg(sh, hand2, 0.09, R.col);
  // a tool in the hand when armed
  if (armed && R.st && !R.safe) {
    const sw_ = R.sw > 0 ? Math.sin(clamp(1 - R.sw / 0.9, 0, 1) * Math.PI) : 0, tl = R.tl >= 0 ? R.tl : 0, hnd = hand2, tip = P(0.52 + 0.75 - 1.1 * sw_, 0.34 + 0.45 * sw_);
    seg(hnd, tip, 0.06, '#6B4A2B');
    if (tl === 0) seg(P(0.52 + 0.75 - 1.1 * sw_ - 0.08, 0.34 + 0.45 * sw_ - 0.1), P(0.52 + 0.75 - 1.1 * sw_ + 0.08, 0.34 + 0.45 * sw_ + 0.1), 0.2, '#4A5568');
    else if (tl === 1) seg(tip, P(0.52 + 0.75 - 1.1 * sw_ - 0.1, 0.34 + 0.45 * sw_ + 0.25), 0.16, '#8E99AB');
    else if (tl === 2) { ctx.fillStyle = '#FFB13D'; ctx.beginPath(); ctx.arc(tip[0], tip[1] - 0.12 * u, 0.13 * u, 0, TAU); ctx.fill(); if (pc < PMAX - 8 && Math.random() < 0.1) emit(2, hx, hy + 1.3 * s, hz, rnd(-0.3, 0.3), 1, rnd(-0.3, 0.3), 0.4, 0.5); }
    else seg(tip, P(0.52 + 0.75 - 1.1 * sw_, 0.34 + 0.45 * sw_ - 0.05), 0.14, '#B88A55');
  }
  ctx.fillStyle = '#F2C9A5'; ctx.beginPath(); ctx.arc(head[0], head[1], 0.2 * u, 0, TAU); ctx.fill();
  const ang = Math.atan2(head[1] - H[1], head[0] - H[0]); ctx.fillStyle = '#3B2A22'; ctx.beginPath(); ctx.arc(head[0], head[1], 0.2 * u, ang - 1.0, ang + 1.0); ctx.fill();
  if (R.safe) { const wy = H[1] + 0.05 * u; ctx.fillStyle = 'rgba(80,160,215,.82)'; ctx.beginPath(); ctx.ellipse(H[0], wy, 0.62 * u, 0.2 * u, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2; const rp = (simClock * 0.9 + R.id * 0.3) % 1; ctx.globalAlpha = 1 - rp; ctx.beginPath(); ctx.ellipse(H[0], wy, (0.5 + 0.6 * rp) * u, (0.16 + 0.2 * rp) * u, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
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
function drawBolts() {
  for (let bi = 0; bi < 3; bi++) {
    const b = BOLTS[bi]; if (!b.on) continue;
    if (b.t < 0.4) { const a = 1 - b.t / 0.4; ctx.fillStyle = `rgba(255,240,150,${0.65 * a})`; for (let k = 0; k < b.np; k++) { const n = b.path[k]; if (alive[n] && sz[n] > NEAR) { ctx.beginPath(); ctx.arc(sx[n], sy[n], 7 + 5 * a, 0, TAU); ctx.fill(); } } }
    if (b.t >= 0.18) continue;
    const N = 10, top = 2.5 * S.size, amp = 0.05 * S.size, ji = reduce ? 0 : Math.floor(Math.random() * 40);
    ctx.beginPath();
    for (let k = 0; k <= N; k++) {
      const f = k / N, e = k > 0 && k < N ? amp * Math.sin(Math.PI * f) * 1.4 : 0;
      const X = b.x + b.jit[(k * 2 + ji) % 64] * e, Z = b.z + b.jit[(k * 2 + 1 + ji) % 64] * e, Y = top + (b.y - top) * f;
      b.mp[k * 3] = X; b.mp[k * 3 + 1] = Y; b.mp[k * 3 + 2] = Z; pr(X, Y, Z); if (PZ < NEAR) continue; k === 0 ? ctx.moveTo(PX, PY) : ctx.lineTo(PX, PY);
    }
    for (let q = 0; q < 2; q++) {
      const k0 = q ? b.f2 : b.f1, dx = q ? b.d2x : b.d1x, dz = q ? b.d2z : b.d1z; let X = b.mp[k0 * 3], Y = b.mp[k0 * 3 + 1], Z = b.mp[k0 * 3 + 2]; pr(X, Y, Z); ctx.moveTo(PX, PY);
      for (let j = 1; j <= 4; j++) { X += dx * amp * 1.1 + b.jit[(j + q * 5 + ji) % 64] * amp * 0.5; Z += dz * amp * 1.1 + b.jit[(j + q * 5 + 9 + ji) % 64] * amp * 0.5; Y -= (top - b.y) / N * 0.8; if (Y < 0) Y = 0; pr(X, Y, Z); if (PZ < NEAR) break; ctx.lineTo(PX, PY); }
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(140,185,255,0.55)'; ctx.lineWidth = 9; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
  }
}
function drawBall(B) {
  const k = pr(B.x, B.y, B.z); if (PZ < NEAR) return; const r = B.r * k;
  if (B.bomb) {
    const g = ctx.createRadialGradient(PX - r * 0.35, PY - r * 0.4, r * 0.1, PX, PY, r); g.addColorStop(0, '#6B7587'); g.addColorStop(1, '#1B2029'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(PX, PY, r, 0, TAU); ctx.fill();
    const u = clamp(B.fuse / 1.6, 0, 1), fx = PX + r * 0.55, fy = PY - r * 1.35;
    ctx.strokeStyle = '#8A6A3A'; ctx.lineWidth = Math.max(1.5, r * 0.14); ctx.beginPath(); ctx.moveTo(PX + r * 0.25, PY - r * 0.85); ctx.quadraticCurveTo(PX + r * 0.5, PY - r * 1.15, fx, fy); ctx.stroke();
    if (reduce) { ctx.strokeStyle = 'rgba(229,57,45,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(PX, PY, r * (1.15 + 1.4 * u), 0, TAU); ctx.stroke(); }
    else { ctx.fillStyle = B.lit ? '#FFE066' : '#FF8A2B'; ctx.beginPath(); ctx.arc(fx, fy, r * (B.lit ? 0.45 : 0.28), 0, TAU); ctx.fill(); if (B.lit) { ctx.fillStyle = 'rgba(229,57,45,.35)'; ctx.beginPath(); ctx.arc(PX, PY, r, 0, TAU); ctx.fill(); } }
    return;
  }
  if (B.fire) { const g = ctx.createRadialGradient(PX, PY, 0, PX, PY, r * 3); g.addColorStop(0, 'rgba(255,200,80,.9)'); g.addColorStop(0.4, 'rgba(255,110,30,.45)'); g.addColorStop(1, 'rgba(255,80,20,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(PX, PY, r * 3, 0, TAU); ctx.fill(); }
  const g = ctx.createRadialGradient(PX - r * 0.35, PY - r * 0.4, r * 0.1, PX, PY, r); if (B.fire) { g.addColorStop(0, '#FFE9A8'); g.addColorStop(1, '#C8501C'); } else { g.addColorStop(0, '#9AA5B5'); g.addColorStop(1, '#2B3240'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(PX, PY, r, 0, TAU); ctx.fill();
}
function drawLamp(i) {
  const k = pr(px[i], py[i], pz[i]); if (PZ < NEAR) return; const r = 0.42 * k;
  if (glow[i] === 2 && S.env.sky === 'day') { ctx.fillStyle = '#EDE9D6'; ctx.beginPath(); ctx.arc(PX, PY, r * 0.55, 0, TAU); ctx.fill(); return; }
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
const FWC = ['rgba(255,90,90,A)', 'rgba(255,214,70,A)', 'rgba(110,190,255,A)', 'rgba(150,255,150,A)', 'rgba(230,150,255,A)'];
function drawParticles() {
  for (let i = 0; i < pc; i++) {
    const k = pr(pX[i], pY[i], pZ[i]); if (PZ < NEAR) continue;
    const u = pL[i] / pM[i], r = Math.max(0.8, S.size * 0.0075 * pS[i] * k), K = pK[i];
    if (K === 2) { const rr = r * (0.45 + u * 0.8); ctx.fillStyle = `rgba(255,${Math.round(70 + 150 * u)},30,${0.5 * u + 0.1})`; ctx.beginPath(); ctx.ellipse(PX, PY - rr * 0.5, rr * 0.6, rr * 1.15, 0, 0, TAU); ctx.fill(); if (u > 0.45 && !lite) { ctx.fillStyle = `rgba(255,235,150,${(u - 0.45) * 1.3})`; ctx.beginPath(); ctx.ellipse(PX, PY - rr * 0.2, rr * 0.3, rr * 0.6, 0, 0, TAU); ctx.fill(); } }
    else if (K === 0) { ctx.fillStyle = `rgba(255,${Math.round(90 + 110 * u)},40,${Math.min(1, u * 1.6)})`; ctx.beginPath(); ctx.arc(PX, PY, Math.max(0.9, r * 0.55), 0, TAU); ctx.fill(); }
    else if (K === 1) { ctx.fillStyle = `rgba(255,246,200,${u})`; ctx.fillRect(PX - 1, PY - 1, 2.4, 2.4); }
    else if (K === 4) { ctx.fillStyle = `rgba(215,240,252,${0.4 + 0.5 * u})`; ctx.beginPath(); ctx.moveTo(PX, PY - r * 0.9); ctx.lineTo(PX + r * 0.6, PY + r * 0.5); ctx.lineTo(PX - r * 0.5, PY + r * 0.4); ctx.closePath(); ctx.fill(); }
    else if (K >= 5) { ctx.fillStyle = FWC[K - 5].replace('A', String(Math.min(1, u * 1.5))); ctx.beginPath(); ctx.arc(PX, PY, Math.max(1.2, r * 0.5), 0, TAU); ctx.fill(); }
    else if (K === 3) { ctx.fillStyle = `rgba(90,96,108,${0.35 * u})`; ctx.beginPath(); ctx.arc(PX, PY, r * (1.4 - u * 0.6), 0, TAU); ctx.fill(); }
  }
}

let slash = [], hoverInfo = null, ptrScr = null, aim = null;
const AIMTOOLS = new Set(['cannon', 'rocket', 'meteor', 'bomb', 'bolt']);
function render() {
  const w = cam.w, h = cam.h;
  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  cam.update(shake * 7);
  for (let i = 0; i < nN; i++) { if (!alive[i]) { sz[i] = -1; continue; } const k = pr(px[i], py[i], pz[i]); sx[i] = PX; sy[i] = PY; sz[i] = PZ; }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  drawSky(); drawGround(); if (!lite) drawShadows();
  for (const m of marks) drawBull(m.x, m.y, m.z, bullR(m.k), m.t > m.life - 0.3 ? 0.5 : 0.95);
  if (aim && aim.on && AIMTOOLS.has(tool)) drawBull(aim.x, aim.y, aim.z, bullR(tool), 0.75);
  // depth-sorted items
  const items = [];
  for (let ci = 0; ci < crowns.length; ci++) { const c = crowns[ci]; if (alive[c.n]) items.push([sz[c.n] + 0.05, 6, ci]); else { pr(c.x, 0, c.z); items.push([PZ, 6, ci]); } }
  for (let di = 0; di < drones.length; di++) { const D = drones[di]; pr(D.x, D.y, D.z); items.push([PZ, 7, di]); }
  for (let di = 0; di < dragons.length; di++) { const D = dragons[di]; pr(D.x, D.y, D.z); items.push([PZ, 8, di]); }
  if (ufo) { pr(ufo.x, ufo.y, ufo.z); items.push([PZ, 9, 0]); }
  for (let mi = 0; mi < mem.length; mi++) { const m = mem[mi]; if (!m.alive || m.hid || m.kind === LINK) continue; const d = (sz[m.a] + sz[m.b]) * 0.5; items.push([d, 0, mi]); }
  for (let pi = 0; pi < panels.length; pi++) { const P = panels[pi]; if (!P.ok) continue; let d = 0; for (let k = 0; k < P.n.length; k++) d += sz[P.n[k]]; items.push([d / P.n.length + 0.3 * S.u, 1, pi]); }
  for (let ri = 0; ri < riders.length; ri++) { const R = riders[ri]; if (R.dead) continue; items.push([R.ns.length > 1 ? (sz[R.n] + sz[R.ns[1]]) * 0.5 : sz[R.n], 2, ri]); }
  for (let bi = 0; bi < balls.length; bi++) { const B = balls[bi]; pr(B.x, B.y, B.z); items.push([PZ, 3, bi]); }
  for (let ti = 0; ti < tornadoes.length; ti++) { const T = tornadoes[ti]; pr(T.x, T.h * 0.3, T.z); items.push([PZ, 4, ti]); }
  for (let i = 0; i < nN; i++) if (glow[i] && alive[i]) items.push([sz[i], 5, i]);
  items.sort((a, b) => b[0] - a[0]);
  for (const it of items) {
    switch (it[1]) { case 0: drawMember(mem[it[2]]); break; case 1: drawPanel(panels[it[2]]); break; case 2: { const R = riders[it[2]], dp = -py[R.n]; if (dp > 0.15 * S.u && rift.gap > 0) ctx.globalAlpha = Math.max(0.12, 1 - dp / (S.pit * 0.9)); R.t === 'p' ? drawPerson(R) : R.t === 'b' ? drawBarrel(R) : drawCar(R); ctx.globalAlpha = 1; break; } case 3: drawBall(balls[it[2]]); break; case 4: drawTornado(tornadoes[it[2]]); break; case 6: drawCrown(crowns[it[2]]); break; case 7: drawDrone(drones[it[2]]); break; case 8: drawDragon(dragons[it[2]]); break; case 9: drawUfo(ufo); break; case 5: drawLamp(it[2]); break; }
  }
  drawProps(); drawBirds(); drawTracers(); drawBolts(); drawParticles();
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
  if (flash > 0 && !reduce) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, 0, w, h); }
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
  ['move', 'Move', 'Drag to move the world. Drag with Shift or the right mouse button to turn it, and scroll to zoom.', 'Move', 'Move'],
  ['cut', 'Knife', 'Poke or sweep the blade across a cable to cut it. A car is snapped in two, a person is knocked over.', 'Blades', 'Knife'],
  ['sword', 'Samurai sword', 'Drag a line across the scene. Everything it crosses is sliced in two.', 'Blades', 'Sword'],
  ['strut', 'Hammer', 'Click or sweep across struts, beams and glass to break them. Each hit shoves whatever is near.', 'Blunt', 'Hammer'],
  ['ball', 'Wrecking ball', 'Click to throw a heavy ball at that spot.', 'Blunt', 'Wrecker'],
  ['hand', 'Giant hand', 'Drag across the scene to flick and swat it.', 'Blunt', 'Hand'],
  ['pluck', 'Pluck', 'Drag a joint to pull it. Drag empty space to turn the view.', 'Blunt', 'Pluck'],
  ['cannon', 'Cannonball', 'Move the bullseye, then click: a cannonball arcs in and lands on it.', 'Shots', 'Cannon'],
  ['rocket', 'Missile', 'Move the bullseye, then click: a missile curves in and blows up on it. Press and hold for a salvo of three.', 'Shots', 'Missile'],
  ['meteor', 'Meteor', 'Move the bullseye, then click to call a meteor down on it.', 'Shots', 'Meteor'],
  ['bomb', 'Bomb', 'Click a spot to drop a bomb on it. The fuse ticks, then it blows. Hold and drag to lay a line of up to five.', 'Blasts', 'Bomb'],
  ['bolt', 'Lightning', 'Click to call a lightning strike. The bolt runs along the struts and burns the cables it reaches. Hold to keep striking.', 'Blasts', 'Lightning'],
  ['fire', 'Fire', 'Click anything to set it alight. Trees, bushes, tents, crates and barrels all burn, and fire jumps between them.', 'Blasts', 'Fire'],
  ['drones', 'Drone swarm', 'Click to send a swarm of drones. They fly in and shoot up the scenery.', 'Summons', 'Drones'],
  ['dragons', 'Dragons', 'Click to send three dragons with riders. They sweep in and breathe fire on everything.', 'Summons', 'Dragons'],
  ['ufo', 'UFO beam', 'Press and hold: a flying saucer follows the pointer and lifts things with a tractor beam.', 'Summons', 'UFO'],
  ['wind', 'Wind gust', 'Click to blow a gust across the scene.', 'Weather', 'Wind'],
  ['tornado', 'Tornado', 'Press and hold to steer a tornado with the pointer.', 'Weather', 'Tornado']];
const ACTS = [
  ['quake-side', 'Quake: side', 'Earthquake, side to side'], ['quake-up', 'Quake: up', 'Earthquake, up and down'], ['quake-rift', 'Quake: rift', 'Earthquake, the ground splits'], ['quake-roll', 'Quake: wave', 'Earthquake, a rolling wave'],
  ['tornado-across', 'Tornado across', 'A tornado crosses the scene'], ['flood', 'Flood', 'A wave of water sweeps across the scene'], ['arm', 'Arm the people', 'Give everyone a hammer, an axe, a bat or a torch. They smash the scenery, never each other.'], ['inferno', 'Set everything on fire', 'Set everything on fire']];
let armBtn = null;
let tool = 'move', msgTimer = 0;
const msgEl = $('fun-msg').firstElementChild;
function say(t, ms) { msgEl.textContent = t; clearTimeout(msgTimer); if (t) msgTimer = setTimeout(() => { msgEl.textContent = ''; }, ms || 6000); }

function svgCur(body, hx, hy, fb) { return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>${body}</svg>`)}") ${hx} ${hy},${fb || 'crosshair'}`; }
const wo = (d, c, w) => `<path d='${d}' fill='none' stroke='#fff' stroke-width='${w + 3}' stroke-linecap='round' stroke-linejoin='round'/><path d='${d}' fill='none' stroke='${c}' stroke-width='${w}' stroke-linecap='round' stroke-linejoin='round'/>`;
const CB = {
  pluck: [wo('M16 7a9 9 0 1 0 .01 0Z', '#1D5FD1', 2.6) + `<circle cx='16' cy='16' r='2.6' fill='#1D5FD1'/>`, 16, 16],
  cut: [`<path d='M3 3 L13 17 L17 14 Z' fill='#E8EEF7' stroke='#fff' stroke-width='3.4' stroke-linejoin='round'/><path d='M3 3 L13 17 L17 14 Z' fill='#E8EEF7' stroke='#5B6B82' stroke-width='1.2' stroke-linejoin='round'/><path d='M3 3 L12 15' stroke='#9FB0C8' stroke-width='1'/><path d='M15 15 L28 28' stroke='#fff' stroke-width='7' stroke-linecap='round'/><path d='M15 15 L28 28' stroke='#1D5FD1' stroke-width='4.2' stroke-linecap='round'/>`, 3, 3],
  cannon: [wo('M16 5V27M5 16H27', '#C62828', 2.4) + `<circle cx='16' cy='16' r='7' fill='none' stroke='#C62828' stroke-width='2'/><circle cx='16' cy='16' r='2' fill='#C62828'/>`, 16, 16],
  rocket: [wo('M16 4V28M4 16H28', '#8A3B0B', 2.4) + `<circle cx='16' cy='16' r='9' fill='none' stroke='#8A3B0B' stroke-width='2'/><circle cx='16' cy='16' r='3' fill='#F26B1D'/>`, 16, 16],
  drones: [`<path d='M6 9L26 23M26 9L6 23' stroke='#fff' stroke-width='6' stroke-linecap='round'/><path d='M6 9L26 23M26 9L6 23' stroke='#2B3340' stroke-width='3' stroke-linecap='round'/><circle cx='16' cy='16' r='4' fill='#3A4558' stroke='#fff' stroke-width='1.5'/><circle cx='6' cy='9' r='3.4' fill='#9AA5B5'/><circle cx='26' cy='9' r='3.4' fill='#9AA5B5'/><circle cx='6' cy='23' r='3.4' fill='#9AA5B5'/><circle cx='26' cy='23' r='3.4' fill='#9AA5B5'/>`, 16, 16],
  dragons: [`<path d='M4 22C8 10 14 8 20 12C22 9 26 8 28 9C26 12 25 13 24 15C20 20 12 24 4 22Z' fill='#2F8F5B' stroke='#fff' stroke-width='2.4' stroke-linejoin='round'/><path d='M10 14L16 4L19 13Z' fill='#1F6E43' stroke='#fff' stroke-width='1.6' stroke-linejoin='round'/><circle cx='24' cy='11' r='1.4' fill='#FFE066'/>`, 16, 16],
  ufo: [`<ellipse cx='16' cy='14' rx='12' ry='4.5' fill='#9AA6B8' stroke='#fff' stroke-width='2'/><path d='M10 12C10 5 22 5 22 12Z' fill='#9FD6F5' stroke='#fff' stroke-width='1.6'/><path d='M11 18L6 29H26L21 18Z' fill='rgba(190,255,200,.7)'/>`, 16, 16],
  strut: [`<path d='M12 12 L28 28' stroke='#fff' stroke-width='6.5' stroke-linecap='round'/><path d='M7 16 L16 7' stroke='#fff' stroke-width='12'/><path d='M12 12 L28 28' stroke='#8A5A0B' stroke-width='3.6' stroke-linecap='round'/><path d='M7.6 15.4 L15.4 7.6' stroke='#0E3A75' stroke-width='9'/>`, 5, 17],
  sword: [wo('M4 28L27 5', '#C9D3E3', 3) + wo('M7 19L13 25', '#0E3A75', 3.4) + wo('M3 29L8 24', '#8A5A0B', 4), 27, 5],
  fire: [`<path d='M16 3C18 9 24 12 24 19A8 8 0 0 1 8 19C8 15 11 13 12 9C14 11 15 8 16 3Z' fill='#F26B1D' stroke='#fff' stroke-width='2'/><path d='M16 14C17 17 20 18 20 21A4 4 0 0 1 12 21C12 19 15 18 16 14Z' fill='#FFD54A'/>`, 16, 26],
  ball: [`<circle cx='16' cy='16' r='10' fill='#3A4352' stroke='#fff' stroke-width='2'/><circle cx='12.5' cy='12.5' r='3' fill='#9AA5B5'/>`, 16, 16],
  meteor: [`<path d='M4 4L18 16' stroke='#fff' stroke-width='9' stroke-linecap='round'/><path d='M4 4L18 16' stroke='#F2A33B' stroke-width='5' stroke-linecap='round'/><circle cx='20' cy='20' r='8' fill='#6B3E26' stroke='#fff' stroke-width='2'/>`, 20, 20],
  hand: [`<ellipse cx='16' cy='19' rx='8' ry='9' fill='#F2C9A5' stroke='#fff' stroke-width='3'/><ellipse cx='16' cy='19' rx='8' ry='9' fill='#F2C9A5' stroke='#B98A66' stroke-width='1.2'/><path d='M9 14V7M13 12V4M17.5 12V4M22 14V7' stroke='#B98A66' stroke-width='3.4' stroke-linecap='round'/>`, 16, 16],
  wind: [wo('M4 11H20a3.5 3.5 0 1 0-3.5-3.5M4 17H26a3.5 3.5 0 1 1-3.5 3.5M4 23H15', '#3B6FB0', 2.6), 16, 16],
  tornado: [wo('M5 7H27M8 13H24M11 19H21M14 25H18', '#4B5668', 3), 16, 26],
  move: [wo('M10 17V9a1.6 1.6 0 0 1 3.2 0V15M13.2 14V6.8a1.6 1.6 0 0 1 3.2 0V14M16.4 14V8a1.6 1.6 0 0 1 3.2 0v7M19.6 15v-3.6a1.6 1.6 0 0 1 3.2 0V19c0 4.6-3 8-7.4 8h-1.2c-3 0-5-1.8-7-4.8L5 18.6a1.7 1.7 0 0 1 2.7-2L10 19', '#1D5FD1', 2.2), 16, 16],
  bomb: [`<path d='M17 8C18 5 21 4 23 5' fill='none' stroke='#fff' stroke-width='5' stroke-linecap='round'/><path d='M17 8C18 5 21 4 23 5' fill='none' stroke='#8A6A3A' stroke-width='2.4' stroke-linecap='round'/><circle cx='14' cy='18' r='10' fill='#2B3240' stroke='#fff' stroke-width='2.6'/><circle cx='10.5' cy='14.5' r='2.8' fill='#9AA5B5'/><circle cx='24' cy='5' r='3' fill='#FFB13D' stroke='#fff' stroke-width='1.2'/>`, 14, 18],
  bolt: [`<path d='M19 2L8 18H15L12 30L25 12H17Z' fill='#FFD43B' stroke='#fff' stroke-width='3.4' stroke-linejoin='round'/><path d='M19 2L8 18H15L12 30L25 12H17Z' fill='#FFD43B' stroke='#B8860B' stroke-width='1.2' stroke-linejoin='round'/>`, 12, 30]
};
const CUR = {}; for (const k in CB) if (k !== 'move') CUR[k] = svgCur(CB[k][0], CB[k][1], CB[k][2]);
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
  else if (tool === 'cut') { const m = pickMember(mx, my, coarse ? 22 : 11, isCab); if (m >= 0) hoverInfo = { m }; }
  else if (tool === 'strut') { const m = pickMember(mx, my, r, isStr); if (m >= 0) hoverInfo = { m }; }
  else if (tool === 'fire') { const m = pickMember(mx, my, r + 10); if (m >= 0) hoverInfo = { m }; }
}
// riders on screen: nearest toy person or car to a point, and slicing them with the sword
function riderSegs(R) {
  const o = [];
  if (R.t === 'b') o.push([R.n, R.n]); else if (R.t === 'p') o.push([R.n, R.h]); else if (R.t === 'c') o.push([R.n, R.n2], [R.n, R.n3], [R.n2, R.n3]); else o.push([R.n, R.n2]);
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
  if (R.t === 'b') { R.hit = true; return; }
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
  for (const P of panels) { if (!P.glass || P.broken || !P.ok) continue; const n = P.n; if (n.some(q => sz[q] < NEAR)) continue; if (segInter(x0, y0, x1, y1, sx[n[0]], sy[n[0]], sx[n[2]], sy[n[2]]) || segInter(x0, y0, x1, y1, sx[n[1]], sy[n[1]], sx[n[3]], sy[n[3]])) { breakGlass(P, 0, 1, 0); hit++; } }
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
let spaceDown = false, holdTimer = 0, salvoT = 0, salvoSent = false, lastBombG = null, bombsLaid = 0, lastShove = 0;
function clearHolds() { if (holdTimer) { clearInterval(holdTimer); holdTimer = 0; } if (salvoT) { clearTimeout(salvoT); salvoT = 0; } }
function tgtAt(x, y) { const t = aimPoint(x, y); if (t) return t; const g = groundHit(x, y); return g ? [g[0], 0, g[2]] : null; }
function fireMissile(x, y) { const t = aimPoint(x, y); if (t) { aim = { x: t[0], y: t[1], z: t[2], on: true }; launch('rocket', t); say('Missile away.', 2200); } }
function salvo(x, y) {
  const t = aimPoint(x, y); if (!t) return; aim = { x: t[0], y: t[1], z: t[2], on: true }; const o = 0.08 * S.size;
  for (let k = 0; k < 3; k++) setTimeout(() => { launch('rocket', k ? [t[0] + rnd(-o, o), Math.max(0, t[1] + rnd(-o, o) * 0.5), t[2] + rnd(-o, o)] : t, t); }, k * 150);
  say('Salvo of three away.', 2500);
}
function strikeAt(x, y) { const t = tgtAt(x, y); if (t) strikeBolt(t); }
function bombAt(x, y) { const t = tgtAt(x, y); if (!t) return; if (dropBomb(t)) { bombsLaid++; lastBombG = [t[0], t[2]]; } else if (bombsLaid === 0) say('Five bombs are already ticking.', 2000); }
function hammerShove(x, y, force) {
  const now = performance.now(); if (!force && now - lastShove < 110) return; lastShove = now;
  const R = coarse ? 60 : 40, mag = 0.25 * S.size, fx = cam.fx, fy = cam.fy, fz = cam.fz;
  for (let i = 0; i < nN; i++) {
    if (!alive[i] || pinned[i] || sz[i] < NEAR) continue; const d = Math.hypot(sx[i] - x, sy[i] - y); if (d > R) continue;
    const k = (1 - d / R) * mag; vx[i] += fx * k; vy[i] += fy * k; vz[i] += fz * k;
  }
}
// what each tool does when the pointer goes down (or when Enter is pressed). Sets the drag mode.
function startTool(x, y) {
  mode = 'rot';
  if (tool === 'move') { mode = 'pan'; setGrabAttr(true); }
  else if (tool === 'pluck') { const n = pickNode(x, y, coarse ? 52 : 34); if (n >= 0) { mode = 'pluck'; const ray = rayAt(x, y), c = ray.d[0] * cam.fx + ray.d[1] * cam.fy + ray.d[2] * cam.fz, t = sz[n] / c; grab = { i: n, t, x: px[n], y: py[n], z: pz[n], sx: x, sy: y }; setGrabAttr(true); } }
  else if (tool === 'cut' || tool === 'strut') { mode = 'rot'; if (tool === 'strut') hammerShove(x, y, true); paintHit(x, y, true); }
  else if (tool === 'fire') { const B = pickRider(x, y, coarse ? 22 : 14); if (B && B.t === 'b') { B.hit = true; mode = 'paint'; } else { const m = pickMember(x, y, coarse ? 46 : 36); if (m >= 0) { burnAt(m); mode = 'paint'; hoverInfo = null; } } }
  else if (tool === 'sword') { mode = 'slash'; slash = [{ x, y, age: 0 }]; }
  else if (tool === 'ball') { mode = 'none'; shoot(x, y, false); }
  else if (tool === 'meteor') { mode = 'none'; const t = aimPoint(x, y); aim = t ? { x: t[0], y: t[1], z: t[2], on: true } : aim; shoot(x, y, true); }
  else if (tool === 'cannon') { mode = 'none'; const t = aimPoint(x, y); if (t) { aim = { x: t[0], y: t[1], z: t[2], on: true }; launch('cannon', t); say('Cannonball away.', 2200); } }
  else if (tool === 'rocket') { mode = 'rocket'; salvoSent = false; clearTimeout(salvoT); salvoT = setTimeout(() => { salvoT = 0; if (mode === 'rocket' && ptrScr) { salvoSent = true; salvo(ptrScr.x, ptrScr.y); } }, 400); }
  else if (tool === 'bomb') { mode = 'bomb'; bombsLaid = 0; lastBombG = null; bombAt(x, y); }
  else if (tool === 'bolt') { mode = 'bolt'; strikeAt(x, y); clearInterval(holdTimer); holdTimer = setInterval(() => { if (mode === 'bolt' && ptrScr) strikeAt(ptrScr.x, ptrScr.y); }, 250); }
  else if (tool === 'drones') { mode = 'none'; if (drones.length) say('The swarm is still up there.', 2000); else { const t = aimPoint(x, y) || [S.cx, 0, S.cz]; callDrones(t); say('Drone swarm inbound.', 3000); } }
  else if (tool === 'dragons') { mode = 'none'; if (dragons.length) say('The dragons are still circling.', 2000); else { const t = aimPoint(x, y) || [S.cx, 0, S.cz]; callDragons(t); say('Three dragons, three riders. Here they come.', 4000); } }
  else if (tool === 'ufo') { mode = 'ufo'; const g = groundHit(x, y) || [S.cx, 0, S.cz]; if (!ufo) callUfo(g[0], g[2]); ufo.held = true; ufo.leave = false; ufo.tx = g[0]; ufo.tz = g[2]; }
  else if (tool === 'hand') { mode = 'swat'; ptrScr = { x, y, in: true, down: true, ang: 0 }; }
  else if (tool === 'wind') { mode = 'none'; const right = x > cam.w * 0.62 ? -1 : 1; startGust(cam.rx * right, cam.rz * right); say('Gust.', 2000); }
  else if (tool === 'tornado') { mode = 'tornado'; const g = groundHit(x, y) || [S.cx, 0, S.cz]; const T = startTornado(g[0], g[2], 0, 0, true); T.held = true; T.tx = g[0]; T.tz = g[2]; }
}
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); cv.focus({ preventScroll: true }); closeMore();
  const [x, y] = local(e); pts.set(e.pointerId, { x, y });
  if (pts.size === 2) {
    const a = [...pts.values()]; clearHolds(); grab = null; setGrabAttr(false); slash.length = 0;
    gest = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), ang: Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x), cx: (a[0].x + a[1].x) / 2, cy: (a[0].y + a[1].y) / 2 };
    mode = 'gesture'; const T = tornadoes.find(t => t.held); if (T) T.held = false; if (ufo) ufo.held = false; return;
  }
  if (pts.size > 2) return;
  last = { x, y, t: e.timeStamp }; vyawS = 0; cam.vyaw = 0; ptrScr = { x, y, in: true, down: false, ang: 0 };
  if (e.button === 2 || (e.button === 0 && e.shiftKey && e.pointerType === 'mouse')) { mode = 'rot'; e.preventDefault(); return; }
  if (e.button === 1 || (e.button === 0 && spaceDown)) { spaceUsed = true; mode = 'pan'; $('fun-stage').dataset.pan = '1'; e.preventDefault(); return; }
  startTool(x, y);
  e.preventDefault();
});
function pointInQuad(x, y, q) { let c = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { if ((q[i][1] > y) !== (q[j][1] > y) && x < (q[j][0] - q[i][0]) * (y - q[i][1]) / (q[j][1] - q[i][1]) + q[i][0]) c = !c; } return c; }
function glassAt(x, y) {
  let best = null, bz = 1e9;
  for (const P of panels) { if (!P.glass || P.broken || !P.ok) continue; let ok = true; const q = P.n.map(n => { if (sz[n] < NEAR) ok = false; return [sx[n], sy[n]]; }); if (!ok || !pointInQuad(x, y, q)) continue; const z = (sz[P.n[0]] + sz[P.n[2]]) / 2; if (z < bz) { bz = z; best = P; } }
  if (best) { breakGlass(best, 0, 1, 0); if (!reduce) shake = Math.max(shake, 0.2); return true; } return false;
}
function paintHit(x, y, first) {
  const R = pickRider(x, y, coarse ? 14 : 8);
  if (R) { hitRider(R, rnd(-1, 1) * S.size * 0.2, 0, rnd(-1, 1) * S.size * 0.2); mode = 'paint'; hoverInfo = null; return true; }
  if (tool === 'strut' && glassAt(x, y)) { mode = 'paint'; hoverInfo = null; return true; }
  const m = pickMember(x, y, tool === 'cut' ? (coarse ? 22 : 11) : (coarse ? 30 : 20), tool === 'cut' ? isCab : isStr);
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
    const a = [...pts.values()], d = Math.max(20, Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)), ang = Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x), cx = (a[0].x + a[1].x) / 2, cy = (a[0].y + a[1].y) / 2;
    cam.dragPan(gest.cx, gest.cy, cx, cy);
    let da = ang - gest.ang; if (da > Math.PI) da -= TAU; else if (da < -Math.PI) da += TAU; cam.yaw += da;
    cam.zoomAt(cx, cy, gest.d / d); gest.d = d; gest.ang = ang; gest.cx = cx; gest.cy = cy; return;
  }
  if (AIMTOOLS.has(tool)) { const t = aimPoint(x, y); if (t) aim = { x: t[0], y: t[1], z: t[2], on: true }; }
  if (!last || !pts.has(e.pointerId) || pts.size > 1) { if (e.pointerType === 'mouse') hoverPick(x, y); return; }
  const dx = x - last.x, dy = y - last.y, dtm = Math.max(4, e.timeStamp - last.t) / 1000;
  if (mode === 'pan') cam.dragPan(last.x, last.y, x, y);
  else if (mode === 'rot') { cam.yaw -= dx * 0.007; cam.pitch = clamp(cam.pitch + dy * 0.006, 0.03, 1.45); vyawS = -dx * 0.007 / dtm * 0.5; }
  else if (mode === 'pluck' && grab) { grab.sx = x; grab.sy = y; const r = rayAt(x, y); grab.x = r.o[0] + r.d[0] * grab.t; grab.y = Math.max(0.1, r.o[1] + r.d[1] * grab.t); grab.z = r.o[2] + r.d[2] * grab.t; }
  else if (mode === 'paint') { if (tool === 'fire') { const m = pickMember(x, y, 30); if (m >= 0) burnAt(m); } else { if (tool === 'strut') hammerShove(x, y); paintHit(x, y); } }
  else if (mode === 'bomb') { const g = groundHit(x, y); if (g && bombsLaid < 5 && (!lastBombG || Math.hypot(g[0] - lastBombG[0], g[2] - lastBombG[1]) > 0.12 * S.size)) bombAt(x, y); }
  else if (mode === 'slash') { slash.push({ x, y, age: 0 }); const n = slashSeg(last.x, last.y, x, y); if (n && !reduce) shake = Math.max(shake, 0.2); if (slash.length > 40) slash.shift(); }
  else if (mode === 'swat') {
    ptrScr.ang = Math.atan2(dy, dx) + Math.PI / 2; ptrScr.down = true;
    const R = Math.min(cam.w, cam.h) * 0.13, sp = Math.hypot(dx, dy) / dtm;
    for (const P of panels) { if (!P.glass || P.broken || !P.ok) continue; const a = P.n[0], c = P.n[2]; if (sz[a] < NEAR || sz[c] < NEAR) continue; if (Math.hypot((sx[a] + sx[c]) / 2 - x, (sy[a] + sy[c]) / 2 - y) < R * 0.7 && sp > 300) breakGlass(P, dx * 0.02, 1, dy * 0.02); }
    for (let i = 0; i < nN; i++) {
      if (!alive[i] || pinned[i] || sz[i] < NEAR) continue; const d = Math.hypot(sx[i] - x, sy[i] - y); if (d > R) continue;
      const k = (1 - d / R) * sz[i] / cam.f / dtm * 0.9, f = Math.min(1, 22 / (Math.hypot(dx, dy) * k + 1e-6));
      const wx = (cam.rx * dx - cam.ux * dy) * k * f, wy = (-cam.uy * dy) * k * f, wz = (cam.rz * dx - cam.uz * dy) * k * f;
      vx[i] += wx; vy[i] += wy + 1; vz[i] += wz;
    }
  }
  else if (mode === 'tornado') { const g = groundHit(x, y); const T = tornadoes.find(t => t.held); if (g && T) { T.tx = g[0]; T.tz = g[2]; } }
  else if (mode === 'ufo') { const g = groundHit(x, y); if (g && ufo) { ufo.tx = g[0]; ufo.tz = g[2]; } }
  last = { x, y, t: e.timeStamp };
});
function endPtr(e) {
  pts.delete(e.pointerId);
  if (pts.size < 2 && mode === 'gesture') { mode = null; gest = null; if (pts.size === 1) { const q = [...pts.values()][0]; last = { x: q.x, y: q.y, t: e.timeStamp }; mode = 'pan'; } }
  if (pts.size === 0) {
    clearHolds(); if (mode === 'rocket' && !salvoSent && e.type === 'pointerup' && ptrScr) fireMissile(ptrScr.x, ptrScr.y);
    setGrabAttr(false); $('fun-stage').dataset.pan = '0';
    if (mode === 'rot' && !reduce) cam.vyaw = clamp(vyawS, -3, 3);
    if (mode === 'pluck') { grab = null; setGrabAttr(false); }
    const T = tornadoes.find(t => t.held); if (T) T.held = false; if (ufo) ufo.held = false;
    if (ptrScr) ptrScr.down = false;
    if (mode === 'slash') { slash.push({ x: -1e4, y: -1e4, age: 9, brk: true }); }
    mode = null; last = null;
  }
}
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('pointerleave', e => { if (ptrScr) ptrScr.in = false; hoverInfo = null; if (aim && e.pointerType === 'mouse') aim.on = false; });
cv.addEventListener('wheel', e => {
  if (!room && !e.ctrlKey && document.activeElement !== cv) return; e.preventDefault();
  const [x, y] = local(e), dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 100 : e.deltaY;
  cam.zoomAt(x, y, Math.exp(clamp(dy, -240, 240) * 0.0012));
}, { passive: false });
function panKey(fwd, side) { const s = 0.06 * S.size, fl = Math.hypot(cam.fx, cam.fz) || 1; cam.shift((cam.fx / fl * fwd + cam.rx * side) * s, (cam.fz / fl * fwd + cam.rz * side) * s); }
function keyAct() {
  const x = cam.w / 2, y = cam.h * 0.45;
  if (tool === 'pluck' || tool === 'move') { const free = []; for (let i = 0; i < nN; i++) if (alive[i] && !pinned[i]) free.push(i); if (free.length) { const i = free[Math.floor(Math.random() * free.length)]; vy[i] += S.size * 0.6; vx[i] += rnd(-1, 1) * S.size * 0.3; } return; }
  ptrScr = { x, y, in: true, down: false, ang: 0 };
  if (tool === 'sword') { slashSeg(x - cam.w * 0.15, y, x + cam.w * 0.15, y); slash = [{ x: x - cam.w * 0.15, y, age: 0 }, { x: x + cam.w * 0.15, y, age: 0 }]; return; }
  if (tool === 'rocket') { fireMissile(x, y); return; }
  startTool(x, y);
  if (mode === 'paint' || mode === 'rot') { /* a poke is all a key can do */ }
  clearHolds(); grab = null; setGrabAttr(false); const T = tornadoes.find(t => t.held); if (T) T.held = false; if (ufo) ufo.held = false; mode = null;
}
const stageEl = $('fun-stage');
stageEl.addEventListener('keydown', e => {
  if (e.ctrlKey || e.altKey || e.metaKey || e.key === 'Escape') return;
  const t = e.target;
  if (t.tagName === 'SELECT' || t.tagName === 'INPUT' || (t !== cv && t.closest && t.closest('[role=toolbar],#fun-more'))) return;
  if (!room && t !== cv) return;
  const k = e.key; let used = true;
  if (k === 'ArrowLeft') panKey(0, -1); else if (k === 'ArrowRight') panKey(0, 1); else if (k === 'ArrowUp') panKey(1, 0); else if (k === 'ArrowDown') panKey(-1, 0);
  else if (k === 'q' || k === 'Q') cam.yaw -= 0.12; else if (k === 'e' || k === 'E') cam.yaw += 0.12;
  else if (k === 'PageUp') cam.pitch = clamp(cam.pitch + 0.08, 0.03, 1.45); else if (k === 'PageDown') cam.pitch = clamp(cam.pitch - 0.08, 0.03, 1.45);
  else if (k === '+' || k === '=') cam.zoomAt(cam.w / 2, cam.h / 2, 0.88); else if (k === '-' || k === '_') cam.zoomAt(cam.w / 2, cam.h / 2, 1 / 0.88);
  else if (k >= '1' && k <= '9' && room) { const T = TOOLS[+k - 1]; if (T) setTool(T[0]); }
  else if (k === '[' || k === ']') { let i = TOOLS.findIndex(q => q[0] === tool) + (k === ']' ? 1 : -1); i = (i + TOOLS.length) % TOOLS.length; setTool(TOOLS[i][0]); }
  else if (k === 'Enter' && t === cv) { keyAct(); }
  else if (k === ' ' && t === cv) { /* acts on key release, unless the key was used to drag */ }
  else if ((k === 'r' || k === 'R') && room) { $('fun-reset').click(); }
  else if ((k === 'p' || k === 'P') && room) togglePause();
  else if ((k === 'm' || k === 'M') && room) toggleSound();
  else used = false;
  if (used) e.preventDefault();
});
let spaceUsed = false;
window.addEventListener('keydown', e => { if (e.code === 'Space' && e.target === cv && !e.repeat) { spaceDown = true; spaceUsed = false; } });
window.addEventListener('keyup', e => { if (e.code === 'Space') { const was = spaceDown; spaceDown = false; if (was && !spaceUsed && e.target === cv) keyAct(); } });
window.addEventListener('blur', () => { spaceDown = false; });

/* --- interface --- */
$('fun-zin').addEventListener('click', () => { cam.zoomAt(cam.w / 2, cam.h / 2, 0.8); });
$('fun-zout').addEventListener('click', () => { cam.zoomAt(cam.w / 2, cam.h / 2, 1 / 0.8); });
$('fun-tup').addEventListener('click', () => { cam.pitch = clamp(cam.pitch + 0.1, 0.03, 1.45); });
$('fun-tdn').addEventListener('click', () => { cam.pitch = clamp(cam.pitch - 0.1, 0.03, 1.45); });
function mk(parent, cls, text, attrs) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chipbtn' + (cls ? ' ' + cls : ''); b.textContent = text; for (const k in attrs) b.setAttribute(k, attrs[k]); parent.appendChild(b); return b; }
const toolBtns = {};
const sceneSel = $('fun-scene');
SCENES.forEach((sc, i) => { const o = document.createElement('option'); o.value = i; o.textContent = sc.name; sceneSel.appendChild(o); });
sceneSel.addEventListener('change', () => chooseScene(+sceneSel.value));
TOOLS.forEach(([id, label, hint]) => { const b = mk($('fun-tools'), '', label, { title: hint, 'aria-pressed': id === tool ? 'true' : 'false' }); b.addEventListener('click', () => setTool(id)); toolBtns[id] = b; });
const armBtns = [], moonBtns = [];
ACTS.forEach(([id, label, ttl]) => { const b = mk($('fun-acts'), id === 'inferno' ? 'hot' : '', label, id === 'arm' ? { title: ttl, 'aria-pressed': 'false' } : { title: ttl }); if (id === 'arm') armBtns.push(b); b.addEventListener('click', () => act(id)); });
armBtn = { setAttribute: (k, v) => armBtns.forEach(b => b.setAttribute(k, v)) };
// the dock: the same tools, as icon buttons at the bottom of the room
const dockEl = $('fun-dock'), moreEl = $('fun-more'), dockBtns = {};
const iconOf = id => `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">${CB[id][0]}</svg>`;
let lastGroup = null;
TOOLS.forEach(([id, label, hint, grp, short]) => {
  if (lastGroup !== null && grp !== lastGroup) { const d = document.createElement('div'); d.className = 'fun-sep'; d.setAttribute('role', 'separator'); dockEl.appendChild(d); } lastGroup = grp;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'fun-tb'; b.dataset.id = id; b.setAttribute('aria-pressed', id === tool ? 'true' : 'false'); b.setAttribute('aria-label', label); b.title = label + ': ' + hint; b.tabIndex = id === tool ? 0 : -1;
  b.innerHTML = `<span class="ic">${iconOf(id)}</span><span class="lb">${short}</span>`; b.addEventListener('click', () => setTool(id)); dockEl.appendChild(b); dockBtns[id] = b;
});
{
  const d = document.createElement('div'); d.className = 'fun-sep'; d.setAttribute('role', 'separator'); dockEl.appendChild(d);
  const b = document.createElement('button'); b.type = 'button'; b.className = 'fun-tb'; b.id = 'fun-morebtn'; b.tabIndex = -1; b.setAttribute('aria-haspopup', 'true'); b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'fun-more'); b.setAttribute('aria-label', 'More: disasters and surprises'); b.title = 'More: earthquakes, floods, tornado, surprises and low gravity';
  b.innerHTML = '<span class="ic"><svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><g fill="#1D5FD1"><circle cx="7" cy="16" r="3"/><circle cx="16" cy="16" r="3"/><circle cx="25" cy="16" r="3"/></g></svg></span><span class="lb">More</span>';
  dockEl.appendChild(b); dockBtns.more = b;
  const h = document.createElement('span'); h.className = 'fun-h'; h.textContent = 'Disasters'; moreEl.appendChild(h);
  const mkm = (txt, cls, attrs, fn) => { const x = document.createElement('button'); x.type = 'button'; if (cls) x.className = cls; x.textContent = txt; for (const k in attrs) x.setAttribute(k, attrs[k]); x.addEventListener('click', fn); moreEl.appendChild(x); return x; };
  ACTS.forEach(([id, label, ttl]) => { const x = mkm(label, id === 'inferno' ? 'hot' : '', id === 'arm' ? { title: ttl, 'aria-pressed': 'false' } : { title: ttl }, () => { act(id); if (id !== 'arm') closeMore(); }); if (id === 'arm') armBtns.push(x); });
  const h2 = document.createElement('span'); h2.className = 'fun-h'; h2.textContent = 'Time and surprises'; moreEl.appendChild(h2);
  moonBtns.push(mkm('Low gravity', '', { 'aria-pressed': 'false' }, () => { toggleMoon(); }));
  mkm('Surprise me', '', {}, () => { closeMore(); surprise(); });
}
dockEl.addEventListener('keydown', e => {
  const bs = [...dockEl.querySelectorAll('.fun-tb')], i = bs.indexOf(document.activeElement); if (i < 0) return;
  let n = -1; if (e.key === 'ArrowRight') n = (i + 1) % bs.length; else if (e.key === 'ArrowLeft') n = (i - 1 + bs.length) % bs.length; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = bs.length - 1;
  if (n < 0) return; e.preventDefault(); bs.forEach(b => { b.tabIndex = -1; }); bs[n].tabIndex = 0; bs[n].focus();
});
const moreBtn = dockBtns.more;
function closeMore(focus) { if (moreEl.hidden) return false; moreEl.hidden = true; moreBtn.setAttribute('aria-expanded', 'false'); if (focus) moreBtn.focus(); return true; }
moreBtn.addEventListener('click', () => { if (moreEl.hidden) { moreEl.hidden = false; moreBtn.setAttribute('aria-expanded', 'true'); const f = moreEl.querySelector('button'); if (f && e_kb) f.focus(); } else closeMore(); });
let e_kb = false; moreBtn.addEventListener('keydown', () => { e_kb = true; }); moreBtn.addEventListener('pointerdown', () => { e_kb = false; });
function setTool(id) {
  tool = id; hoverInfo = null; for (const k in toolBtns) toolBtns[k].setAttribute('aria-pressed', k === id ? 'true' : 'false');
  for (const k in dockBtns) { if (k === 'more') continue; const on = k === id; dockBtns[k].setAttribute('aria-pressed', on ? 'true' : 'false'); dockBtns[k].tabIndex = on ? 0 : -1; }
  if (dockBtns.more) dockBtns.more.tabIndex = -1;
  $('fun-stage').dataset.tool = id; say(TOOLS.find(t => t[0] === id)[2]);
  if (dockBtns[id] && room) dockBtns[id].scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
}
function chooseScene(i) { sceneSel.value = i; loadScene(i); if (S.tool && !room) setTool(S.tool); say(SCENES[i].name + '. Pick a tool and have a go.'); }
function act(id) {
  if (id.startsWith('quake-')) { const k = id.slice(6); if (k === 'rift' && rift.gap > 0) { say('The ground is already split. Reset to close it.'); return; } startQuake(k); say({ side: 'Earthquake: the ground shakes side to side.', up: 'Earthquake: the ground jolts up and down.', rift: 'Earthquake: the ground splits down the middle.', roll: 'Earthquake: a rolling wave crosses the ground.' }[k]); }
  else if (id === 'tornado-across') { tornadoAcross(); say('A tornado is crossing the scene.'); }
  else if (id === 'inferno') { igniteAll(); say('Everything is alight.'); }
  else if (id === 'flood') { if (flood) { say('The water is already rushing in.'); return; } startFlood(cam.rx, cam.rz, S.id === 'dam'); say('A wave of water sweeps across the scene.'); }
  else if (id === 'arm') { armed = !armed; if (armBtn) armBtn.setAttribute('aria-pressed', armed ? 'true' : 'false'); say(armed ? 'Everyone has picked up a tool and is off to smash the scenery. Nobody hurts anyone.' : 'Everyone put their tools down.', 5000); if (armed) for (const R of riders) if (R.t === 'p') { R.tl = Math.floor(Math.random() * 4); R.tw = 0; } sfx('crowd', 0.6); }
}
$('fun-reset').addEventListener('click', () => { loadScene(sceneIx, true); say('Rebuilt and healthy.', 3000); });
const SLOW = [1, 0.25, 0.1], SLOWT = ['1x', '0.25x', '0.1x'];
function togglePause() {
  paused = !paused; const b = $('fun-pause'); b.setAttribute('aria-pressed', paused ? 'true' : 'false'); b.textContent = paused ? 'Paused' : 'Pause';
  const r = $('fun-rpause'); r.setAttribute('aria-pressed', paused ? 'true' : 'false'); r.setAttribute('aria-label', paused ? 'Resume' : 'Pause'); r.title = paused ? 'Resume (P)' : 'Pause (P)';
}
function cycleSlow() {
  const k = (SLOW.indexOf(timeScale) + 1) % SLOW.length; timeScale = SLOW[k]; const t = SLOWT[k];
  $('fun-slow').textContent = 'Slow: ' + t; const r = $('fun-rslow'); r.textContent = t; r.setAttribute('aria-label', 'Slow motion: ' + t); r.title = 'Slow motion: ' + t;
}
function toggleMoon() {
  const on = grav > 5; grav = on ? 1.62 : 9.81; moonBtns.forEach(b => b.setAttribute('aria-pressed', on ? 'true' : 'false')); say(on ? 'Low gravity: things fall slowly and fly far.' : 'Normal gravity.', 3000);
}
$('fun-pause').addEventListener('click', togglePause); $('fun-rpause').addEventListener('click', togglePause);
$('fun-slow').addEventListener('click', cycleSlow); $('fun-rslow').addEventListener('click', cycleSlow);
moonBtns.push($('fun-moon')); $('fun-moon').addEventListener('click', toggleMoon);
$('fun-rreset').addEventListener('click', () => { $('fun-reset').click(); });
function surprise() {
  const opts = [
    () => { tornadoAcross(); say('Surprise: a tornado.'); },
    () => { startQuake(['side', 'up', 'roll', 'rift'][Math.floor(Math.random() * 4)]); say('Surprise: an earthquake.'); },
    () => { for (let k = 0; k < 3; k++) setTimeout(() => { const a = rnd(0, TAU), r = rnd(0, 0.5) * S.size; const x = S.cx + Math.cos(a) * r, z = S.cz + Math.sin(a) * r, dir = [-0.35, 0.9, 0.22], dl = Math.hypot(...dir), far = S.size * 2.4, y = rnd(0, S.size * 0.5); throwBall([x + dir[0] / dl * far, y + dir[1] / dl * far, z + dir[2] / dl * far], [-dir[0] / dl, -dir[1] / dl, -dir[2] / dl], true); }, k * 650); say('Surprise: a meteor shower.'); },
    () => { const a = rnd(0, TAU); startGust(Math.cos(a), Math.sin(a)); for (let k = 0; k < 3; k++) { const m = Math.floor(rnd(0, mem.length)); burnAt(m); } say('Surprise: a gale, and a few sparks.'); },
    () => { for (let k = 0; k < 4; k++) setTimeout(() => { const a = rnd(0, TAU); const o = [S.cx + Math.cos(a) * S.size * 2.2, rnd(0.1, 0.5) * S.size, S.cz + Math.sin(a) * S.size * 2.2], d = [S.cx - o[0], S.cy * 0.8 - o[1], S.cz - o[2]], l = Math.hypot(...d); throwBall(o, d.map(v => v / l), false); }, k * 500); say('Surprise: wrecking balls from every side.'); },
    () => { for (let k = 0; k < 3; k++) setTimeout(() => { const a = rnd(0, TAU), r = rnd(0, 0.45) * S.size; strikeBolt([S.cx + Math.cos(a) * r, rnd(0, 0.6) * S.size, S.cz + Math.sin(a) * r]); }, k * 420); say('Surprise: a lightning storm.'); }
  ];
  opts[Math.floor(Math.random() * opts.length)]();
}
$('fun-surprise').addEventListener('click', surprise);

const sndBtn = $('fun-sound'), rSnd = $('fun-rsound');
function toggleSound() {
  const sn = window.funSound; if (!sn) { say('Sound is not available here.', 3000); return; }
  const on = sn.toggle(); sndBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); sndBtn.textContent = on ? 'Sound: on' : 'Sound: off';
  rSnd.setAttribute('aria-pressed', on ? 'true' : 'false'); rSnd.title = on ? 'Sound is on (M)' : 'Sound is off (M)'; rSnd.setAttribute('aria-label', on ? 'Sound: turn off' : 'Sound: turn on');
  say(on ? 'Sound on. Everything you hear is synthesized live.' : 'Sound off.', 2500);
}
if (sndBtn) sndBtn.addEventListener('click', toggleSound); rSnd.addEventListener('click', toggleSound); rSnd.setAttribute('aria-label', 'Sound: turn on');

/* --- room mode: the world fills the window --- */
const htmlEl = document.documentElement, bodyEl = document.body, selHome = $('fun-sel-home'), selSlot = $('fun-sel-slot'), enterBtn = $('fun-enter'), fsBtn = $('fun-fs');
const inertEls = () => [...document.querySelectorAll('.site-head, .page-head, .fun-panel, .fun-note, .site-foot')];
function placeSel() { (room ? selSlot : selHome).appendChild(sceneSel); }
function enterRoom(fromPop) {
  if (room) return; room = true;
  htmlEl.classList.add('fun-full'); bodyEl.classList.add('fun-full'); inertEls().forEach(el => el.setAttribute('inert', ''));
  placeSel(); window.scrollTo(0, 0);
  if (!fromPop) { try { history.pushState({ funRoom: 1 }, '', location.pathname + location.search); } catch (err) { /* ignore */ } }
  resize(); cv.focus({ preventScroll: true }); if (dockBtns[tool]) dockBtns[tool].scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
}
function exitRoom(fromPop) {
  if (!room) return;
  if (!fromPop && history.state && history.state.funRoom) { history.back(); return; }
  closeMore(); room = false; clearHolds();
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
  htmlEl.classList.remove('fun-full'); bodyEl.classList.remove('fun-full'); inertEls().forEach(el => el.removeAttribute('inert'));
  placeSel(); try { history.replaceState(history.state && history.state.funRoom ? null : history.state, '', location.pathname + location.search + '#page'); } catch (err) { /* ignore */ }
  window.scrollTo(0, 0); fitStage(); resize(); enterBtn.focus({ preventScroll: true });
}
$('fun-exit').addEventListener('click', () => exitRoom(false));
enterBtn.addEventListener('click', () => enterRoom(false));
window.addEventListener('popstate', e => { if (e.state && e.state.funRoom) enterRoom(true); else exitRoom(true); });
document.addEventListener('keydown', e => { if (e.key !== 'Escape' || !room) return; e.preventDefault(); if (!closeMore(true)) exitRoom(false); });
document.addEventListener('pointerdown', e => { if (room && !moreEl.hidden && !moreEl.contains(e.target) && e.target !== moreBtn && !moreBtn.contains(e.target)) closeMore(); });
if (fsBtn && $('fun-stage').requestFullscreen) { fsBtn.hidden = false; fsBtn.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else $('fun-stage').requestFullscreen().catch(() => {}); }); }
// make the stage and the controls fit one screen below the site header
function fitStage() {
  const st = $('fun-stage'), app = $('fun'); if (!st || !app || room) return; const top = st.getBoundingClientRect().top + window.scrollY, vh = window.innerHeight, narrow = window.innerWidth <= 900;
  const h = narrow ? clamp(Math.round(vh * 0.5), 300, 480) : clamp(Math.round(vh - top - 12), 380, 920);
  app.style.setProperty('--fun-h', h + 'px');
}
fitStage(); window.addEventListener('resize', fitStage); window.addEventListener('load', fitStage); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitStage);

/* --- readout, sizing, loop --- */
const readEl = $('fun-read'); let readT = 0;
const chips = ['Standing', 'Cables cut', 'Struts broken', 'Burnt', 'Peak tension'].map(l => { const s = document.createElement('span'); readEl.appendChild(s); return [s, l]; });
function readout() {
  const pk = cnt.peak >= 1000 ? (cnt.peak / 1000).toFixed(1) + ' kN' : Math.round(cnt.peak) + ' N';
  const v = [cnt.alive + ' of ' + cnt.total, cnt.cut, cnt.broke, cnt.burnt, pk];
  chips.forEach(([s, l], i) => { const t = `${l} `; if (!s.firstChild) { s.innerHTML = `${l} <b></b>`; } s.lastChild.textContent = v[i]; });
}
function resize() {
  const r = cv.getBoundingClientRect();
  const w = Math.max(200, Math.round(r.width)), h = Math.max(200, Math.round(r.height));
  let dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2) * rscale;
  dpr = coarse ? Math.min(dpr, 1280 / Math.max(w, h)) : Math.min(dpr, 2560 / w, 1440 / h); dpr = Math.max(0.4, Math.round(dpr * 100) / 100);
  if (cam.w !== w || cam.h !== h || cam.dpr !== dpr || cv.width !== Math.round(w * dpr)) { cam.w = w; cam.h = h; cam.dpr = dpr; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
}
if (window.ResizeObserver) new ResizeObserver(resize).observe(cv); window.addEventListener('resize', resize);
let visible = true; if (window.IntersectionObserver) new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 }).observe($('fun-stage'));
let lastTs = 0, acc = 0, drawMs = 0, fpsAvg = 60, msSum = 0, msN = 0, lastScaleAt = 0, lowSince = 0;
// last fallback after lite and fewer substeps: draw at a lower resolution, one step of 0.1 at most once a second
function rscaleGov(avg, ts) {
  const floor = coarse ? 0.5 : 0.6;
  if (avg > 14 && FR.sub <= 5 && lite) { lowSince = 0; if (ts - lastScaleAt > 1000 && rscale > floor) { rscale = Math.max(floor, Math.round((rscale - 0.1) * 10) / 10); lastScaleAt = ts; } }
  else if (avg < 7) { if (!lowSince) lowSince = ts; if (ts - lowSince > 3000 && ts - lastScaleAt > 1000 && rscale < 1) { rscale = Math.min(1, Math.round((rscale + 0.1) * 10) / 10); lastScaleAt = ts; lowSince = ts; } }
  else lowSince = 0;
}
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
  const total = FR.ms + drawMs;
  msSum += total; if (++msN >= 30) { rscaleGov(msSum / msN, ts); msSum = 0; msN = 0; }
  lite = total > 9 ? true : total < 4.5 ? false : lite; if (total > (coarse ? 22 : 13) && FR.sub > 5) FR.sub--; else if (total < (coarse ? 9 : 6) && FR.sub < (coarse ? 8 : 10)) FR.sub++;
  if ((readT += 1) % 15 === 0) readout();
  if (readT % 6 === 0 && window.funSound && window.funSound.on) window.funSound.ambient({ fire: Math.min(1, burning.length / 16), quake: Q.kind ? Q.env : 0, tornado: tornadoes.length ? tornadoes[0].fade : 0, wind: gust ? gust.env : 0, flood: flood ? 1 : 0, drones: drones.length, ufo: ufo ? ufo.beam : 0 });
}
function statsNow() {
  let nan = 0, maxv = 0, an = 0; for (let i = 0; i < nN; i++) { if (!alive[i]) continue; an++; if (!isFinite(px[i] + py[i] + pz[i])) nan++; maxv = Math.max(maxv, Math.hypot(vx[i], vy[i], vz[i])); }
  return { scene: S.id, nodes: an, nodesBuilt: nN, members: mem.filter(m => m.alive && !m.hid).length, total: cnt.total, standing: cnt.alive, cut: cnt.cut, broke: cnt.broke, burnt: cnt.burnt, peak: Math.round(cnt.peak), nan, maxSpeed: +maxv.toFixed(2), simMs: +FR.ms.toFixed(2), drawMs: +drawMs.toFixed(2), fps: Math.round(fpsAvg), sub: FR.sub, rscale, room, lite, bolts: BOLTS.filter(b => b.on).length, bombs: bombsLive(), panX: +cam.panX.toFixed(2), panZ: +cam.panZ.toFixed(2), tool, riders: riders.filter(r => !r.dead).length, people: riders.filter(r => r.t === 'p' && !r.dead).length, standingPeople: riders.filter(r => r.t === 'p' && !r.dead && r.st).length, peopleStanding: riders.filter(r => r.t === 'p' && !r.dead && r.st && !r.safe).length, peopleDown: riders.filter(r => r.t === 'p' && !r.dead && !r.st).length, peopleSafeInWater: riders.filter(r => r.t === 'p' && !r.dead && r.safe).length, peopleLost: riders.filter(r => r.t === 'p' && r.dead).length, glassBroken: cnt.glass || 0, barrelsLeft: riders.filter(r => r.t === 'b' && !r.dead).length, drones: drones.length, dragons: dragons.length, ufo: ufo ? 1 : 0, flood: flood ? 1 : 0, armed: armed ? 1 : 0, treesLeft: crowns.filter(c => alive[c.n] || c.ms.some(mi => mem[mi].alive)).length, carBodies: riders.filter(r => (r.t === 'c' || r.t === 'h') && !r.dead).length, fellIn: riders.filter(r => r.fell).length, particles: pc, tornadoes: tornadoes.length, rift: +rift.gap.toFixed(2), quake: Q.kind, balls: balls.length, burning: burning.length, grav, size: +S.size.toFixed(1) };
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
  enter: () => enterRoom(false), exit: () => exitRoom(false), dropBomb, strikeBolt, pan: (x, z) => cam.shift(x, z), zoomAt: (x, y, f) => cam.zoomAt(x, y, f), dragPan: (a, b, c, d) => cam.dragPan(a, b, c, d), togglePause, render, paused: p => { paused = p; }, knockP: i => knock(riders[i]), launch, callDrones, callDragons, startFlood, aimPoint, glassAt, breakGlass, panels: () => panels, barrels: () => riders.filter(r => r.t === 'b'), crowns: () => crowns, water: () => water, setArmed: v => { armed = !!v; if (armBtn) armBtn.setAttribute('aria-pressed', armed ? 'true' : 'false'); if (armed) for (const R of riders) if (R.t === 'p') { R.tl = Math.floor(Math.random() * 4); R.tw = 0; } }, state: () => ({ E, boomT, thr, armed }), callUfo: (x, z) => { callUfo(x, z); ufo.held = false; }
};
resize();
setTool('move'); loadScene(0);
say('Pick a scene and a tool, then wreck it. Reset puts everything back.', 7000);
readout();
if (location.hash !== '#page') enterRoom(false);
requestAnimationFrame(loop);
})();
