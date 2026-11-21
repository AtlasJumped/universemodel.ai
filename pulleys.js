/* Exercise Today: the body as a system of pulleys.
   One rope runs from the left hand over the left shoulder, over the top of the head,
   down through the neck and the spine, up over the right shoulder and through a
   three-strand block and tackle at the right hand, where it lifts a weight. Every number
   shown is computed from this model: rope geometry (tangent lines and wrap angles), friction
   at each wheel (capstan law), force balance on the moving block, rope stretch, and joints
   that shift and tilt under the force the rope puts on them. Janky pulleys also make the
   body sag and sway while it takes up slack before the weight starts to move. */
(function () {
  'use strict';
  var cv = document.getElementById('pl-cv');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var live = document.getElementById('pl-live');
  var RMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(RMQ && RMQ.matches); }

  // ---- model constants (world units: the body is about 1.9 high; 1 unit = 95 cm)
  var CM = 95, PMAX = 1.8, LG0 = 0.10, YM0 = 0.55, NSTR = 3;
  var MU0 = 0.006, MUJ = 0.12, MUJT = 0.06;  // wheel friction: optimized, and added when fully janky (body wheels, tackle wheels)
  var TMAX = 0.18, OMAX = 0.012;     // largest tilt (rad) and shift of a janky joint
  var STRETCH = 0.035;              // rope and web give, per weight of tension
  var S = 0.13, RT = 0.04, RJ = 0.05;
  var SPEED = PMAX / 2.4;          // how fast the rope is pulled while the button is held (units per second)
  var RET = PMAX / 1.5;            // how fast the weight falls back when the button is let go
  var SAGMAX = 0.085, LEANMAX = 0.1, FLAPMAX = 0.16;  // the wobble of a janky body while it takes up slack

  var BASE = {
    sL: [-0.2, 1.5], sR: [0.2, 1.5], eL: [-0.62, 1.4], eR: [0.62, 1.4],
    hL: [-1.02, 1.5], hR: [1.02, 1.5], pel: [0, 1.0], hpL: [-0.13, 1.0], hpR: [0.13, 1.0],
    kL: [-0.27, 0.52], kR: [0.27, 0.52], aL: [-0.34, 0.07], aR: [0.34, 0.07],
    neck: [0, 1.56], head: [0, 1.79], hd: [0, 1.94], spU: [0, 1.34], spL: [0, 1.15], wU: [-0.065, 1.34], wL: [0.065, 1.15], tL: [-0.48, 0.03], tR: [0.48, 0.03]
  };
  // wheels in rope order. s: +1 rope turns clockwise round it, -1 anticlockwise. k: how much a fault here costs.
  // The rope runs from the left hand over the left shoulder, over the top of the head, down through the neck
  // and the spine, up over the right shoulder and into a three-strand block and tackle at the right hand.
  var WH = [
    { id: 'hL', node: 'hL', r: RJ, s: 1, k: 1 }, { id: 'sL', node: 'sL', r: RJ, s: -1, k: 1.1 },
    { id: 'hd', node: 'hd', r: RJ, s: 1, k: 1.4 }, { id: 'neck', node: 'neck', r: RJ, s: 1, k: 1.8 },
    { id: 'spU', node: 'wU', r: RJ, s: -1, k: 2 }, { id: 'spL', node: 'wL', r: RJ, s: -1, k: 2 },
    { id: 'sR', node: 'sR', r: RJ, s: 1, k: 1.1 },
    { id: 'FB', f: 1, lx: -S / 2, r: RT, s: 1 }, { id: 'MB', m: 1, lx: 0, r: RT, s: -1 },
    { id: 'FB', f: 1, lx: S / 2, r: RT, s: 1 }
  ];
  var N = WH.length, TK0 = 7;        // tackle wheels are indexes 7 to 9
  var PICK = [
    ['hL', 'left hand'], ['sL', 'left shoulder'], ['hd', 'head'], ['neck', 'neck'],
    ['spU', 'upper spine'], ['spL', 'lower spine'], ['sR', 'right shoulder'],
    ['FB', 'fixed block'], ['MB', 'moving block']
  ];
  var JW = { hL: 1, sL: 1, hd: 1.4, neck: 2, spU: 2, spL: 2, sR: 1, FB: 0.8, MB: 0.8 }, JWT = 0;
  PICK.forEach(function (q) { JWT += JW[q[0]]; });
  var NAME = {}; PICK.forEach(function (p) { NAME[p[0]] = p[1]; });
  var FULLNAME = { FB: 'fixed block of the tackle', MB: 'moving block of the tackle' };


  // ---- state
  var sel = {};                      // id -> true when that pulley is janky
  var sev = 0.8;                     // how janky
  var pin = 0;                       // rope pulled at the grip, world units
  var tt = 0, wa = 0;                // seconds since the pull began, and how much of the wobble still shows
  var slack = 0;                     // rope the body takes up before the weight starts to move
  var holding = false, dragging = false;
  var ZW = { sag: 0, lean: 0, flap: 0 };
  var st = freshState();
  var jit = 0, lastTs = 0, raf = 0;
  var COARSE = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  function freshState() {
    var o = [], i; for (i = 0; i < N; i++) o.push([0, 0]);
    return { t: {}, o: o, w: ZW };
  }

  // ---- geometry
  function rot(q, c, a) {
    var s = Math.sin(a), k = Math.cos(a), x = q[0] - c[0], y = q[1] - c[1];
    return [c[0] + k * x - s * y, c[1] + s * x + k * y];
  }
  function turn(P, keys, c, a) { if (!a) return; keys.forEach(function (k) { P[k] = rot(P[k], c, a); }); }
  var UPPER = ['neck', 'head', 'hd', 'sL', 'sR', 'eL', 'eR', 'hL', 'hR'];
  var LIFT = ['pel', 'hpL', 'hpR', 'spU', 'spL', 'wU', 'wL'].concat(UPPER);
  function pose(t, w) {
    w = w || ZW;
    var P = {}, k; for (k in BASE) P[k] = BASE[k].slice();
    var arm = { L: 0, R: 0 };
    ['L', 'R'].forEach(function (d) {
      var s = P['s' + d], e = P['e' + d], h = P['h' + d];
      var ah = t['h' + d] || 0, as = (t['s' + d] || 0) + (d === 'L' ? w.flap : -w.flap);
      h = rot(h, e, ah);
      e = rot(e, s, as); h = rot(h, s, as);
      P['e' + d] = e; P['h' + d] = h; arm[d] = as + ah;
    });
    // head and neck tilt about the neck; the upper spine tilts the shoulders; the lower spine leans the whole trunk
    var hA = (t.neck || 0) + 0.6 * (t.hd || 0);
    turn(P, ['head', 'hd'], P.neck, hA);
    var uA = t.spU || 0;
    turn(P, UPPER.concat(['wU']), P.spU, uA);
    var lA = (t.spL || 0) + w.lean;
    turn(P, UPPER.concat(['spU', 'spL', 'wU', 'wL']), P.pel, lA);
    P.armR = arm.R + uA + lA; P.armL = arm.L + uA + lA;
    // sag: the body sinks and the knees give
    if (w.sag) {
      LIFT.forEach(function (q) { P[q] = [P[q][0], P[q][1] - w.sag]; });
      P.kL = [P.kL[0] - w.sag * 0.9, P.kL[1] - w.sag * 0.5]; P.kR = [P.kR[0] + w.sag * 0.9, P.kR[1] - w.sag * 0.5];
    }
    return P;
  }
  function circles(P, st, ym) {
    var C = [], i, w, B, beta, H, bm, n;
    B = [P.hR[0], P.hR[1] + 0.085]; beta = P.armR + (st.t.FB || 0);
    H = [B[0] + S / 4, ym - 0.07]; bm = st.t.MB || 0;
    for (i = 0; i < N; i++) {
      w = WH[i]; var o = st.o[i], c;
      if (w.f) { c = rot([B[0] + w.lx, B[1]], B, beta); }
      else if (w.m) { c = rot([H[0] + w.lx - S / 4, H[1] + 0.07], H, bm); }
      else { n = P[w.node]; c = [n[0], n[1]]; }
      C.push({ x: c[0] + o[0], y: c[1] + o[1], r: w.r, s: w.s });
    }
    var A = rot([H[0] + S / 2 + RT - S / 4, H[1] + 0.07], H, bm);
    return { C: C, A: A, B: B, H: H, beta: beta, bm: bm };
  }
  function tangent(c1, c2) {
    var dx = c2.x - c1.x, dy = c2.y - c1.y, D = Math.hypot(dx, dy) || 1e-6;
    var k = c2.s * c2.r - c1.s * c1.r, q = Math.max(-0.999, Math.min(0.999, k / D));
    var th = Math.atan2(dy, dx), ac = Math.acos(q), best = null, sg;
    for (sg = -1; sg <= 1; sg += 2) {
      var a = th + sg * ac, rn = [Math.cos(a), Math.sin(a)], u = [-rn[1], rn[0]];
      var L = dx * u[0] + dy * u[1];
      if (L > 0 && (!best || L > best.len)) {
        best = { ux: u[0], uy: u[1], len: L,
          x1: c1.x - c1.s * c1.r * rn[0], y1: c1.y - c1.s * c1.r * rn[1],
          x2: c2.x - c2.s * c2.r * rn[0], y2: c2.y - c2.s * c2.r * rn[1] };
      }
    }
    return best || { ux: 1, uy: 0, len: 0, x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y };
  }
  function wrapAng(ain, aout, s) {
    var w = s * (ain - aout), T = Math.PI * 2;
    w = ((w % T) + T) % T; if (w > T - 1e-3) w = 0; return w;
  }
  // full evaluation of the rope at a given block height
  function chain(P, st, ym, mu) {
    var G = circles(P, st, ym), C = G.C, cs = C.concat([{ x: G.A[0], y: G.A[1], r: 0, s: C[N - 1].s }]);
    var segs = [], wrap = [], i, ain = Math.PI / 2;
    for (i = 0; i < N; i++) {
      var sg = tangent(cs[i], cs[i + 1]); segs.push(sg);
      var aout = Math.atan2(sg.uy, sg.ux); wrap.push(wrapAng(ain, aout, C[i].s)); ain = aout;
    }
    // tensions: unit at the dead end, capstan growth towards the hand
    var Tin = [], Tout = [], tk = 1;
    for (i = N - 1; i >= 0; i--) { Tout[i] = tk; tk = tk * Math.exp(mu[i] * wrap[i]); Tin[i] = tk; }
    var vsum = 0; for (i = TK0; i < N; i++) vsum += Tout[i] * Math.abs(segs[i].uy);
    var sc = 1 / Math.max(vsum, 1e-6);           // weight = 1
    for (i = 0; i < N; i++) { Tin[i] *= sc; Tout[i] *= sc; }
    var len = 0;
    for (i = 0; i < N; i++) {
      len += segs[i].len * (1 + STRETCH * Math.min(Tout[i], 1.2)) + C[i].r * wrap[i] * (1 + STRETCH * Math.min((Tin[i] + Tout[i]) / 2, 1.2));
    }
    return { G: G, C: C, segs: segs, wrap: wrap, Tin: Tin, Tout: Tout, len: len, Tgrip: Tin[0] };
  }
  var LTOT = 0;
  function evalAt(st, mu, pp) {
    var P = pose(st.t, st.w), lo = -0.005, hi = 0.8, target = LTOT - LG0 - pp, h, k, r;
    for (k = 0; k < 30; k++) {
      h = (lo + hi) / 2; r = chain(P, st, YM0 + h, mu);
      if (r.len > target) lo = h; else hi = h;
    }
    h = (lo + hi) / 2; r = chain(P, st, YM0 + h, mu);
    // forces the rope puts on each wheel
    var F = [], i, uin, ux, uy;
    for (i = 0; i < N; i++) {
      uin = i ? r.segs[i - 1] : { ux: 0, uy: 1 };
      F.push([r.Tout[i] * r.segs[i].ux - r.Tin[i] * uin.ux, r.Tout[i] * r.segs[i].uy - r.Tin[i] * uin.uy]);
    }
    r.F = F; r.h = h; r.P = P; r.ym = YM0 + h;
    r.eta = (1 / NSTR) / r.Tgrip;
    return r;
  }
  function muFor(jf) { var m = [], i; for (i = 0; i < N; i++) m.push(MU0 + (i >= TK0 ? MUJT : MUJ * (WH[i].k || 1)) * jf[i]); return m; }
  var MU_OPT = muFor(new Array(N).fill(0));
  var ST_OPT = freshState();
  LTOT = LG0 + chain(pose({}), ST_OPT, YM0, MU_OPT).len;

  // janky amounts per wheel: own value, and a share of what the neighbors on the rope have
  function jank() {
    var own = [], i, jf = [], je = [];
    for (i = 0; i < N; i++) own.push(sel[WH[i].id] ? sev : 0);
    for (i = 0; i < N; i++) {
      var lk = 0.3 * ((i > 0 && WH[i - 1].id !== WH[i].id ? own[i - 1] : 0) + (i < N - 1 && WH[i + 1].id !== WH[i].id ? own[i + 1] : 0));
      jf.push(Math.min(1, own[i] + 0.15 * lk)); je.push(Math.min(1, own[i] + lk));
    }
    return { own: own, jf: jf, je: je };
  }
  function anyJank() { for (var k in sel) if (sel[k]) return true; return false; }
  // overall jank 0..1, weighted so that the neck and the spine count most
  function jankTotal() {
    var t = 0; PICK.forEach(function (q) { if (sel[q[0]]) t += JW[q[0]] * sev; });
    return Math.min(1, t / JWT);
  }
  // seconds the body needs to take up slack before the weight starts to move, and how big the wobble is
  function delayFor() { if (!anyJank()) return 0; var J = jankTotal(); return 0.3 + 1.0 * Math.pow(J, 0.5); }
  function ampFor() { return anyJank() ? 1 - Math.exp(-6 * jankTotal()) : 0; }

  // direction and sign of how each pulley's joint gives, taken from the optimized body
  function targets(cur, ref, J, pp) {
    var tg = { t: {}, o: [] }, i, id, P = ref.P, f, mag, g, d, pf = Math.min(1, pp / (0.25 * PMAX));
    for (i = 0; i < N; i++) tg.o.push([0, 0]);
    function unit(v) { var m = Math.hypot(v[0], v[1]) || 1; return [v[0] / m, v[1] / m]; }
    function cross(a, b) { return a[0] * b[1] - a[1] * b[0]; }
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
    var rv = {
      hL: sub(P.hL, P.eL), sL: sub(P.eL, P.sL), sR: sub(P.eR, P.sR), hd: sub(P.hd, P.neck),
      neck: sub(P.head, P.neck), spU: sub(P.neck, P.spU), spL: sub(P.spU, P.pel)
    };
    for (i = 0; i < N; i++) {
      id = WH[i].id; if (WH[i].f || WH[i].m) continue;
      f = ref.F[i]; d = unit(f); g = Math.min(1, 0.35 + 3.2 * Math.hypot(cur.F[i][0], cur.F[i][1]));
      mag = J.je[i] * g * pf;
      tg.o[i] = [d[0] * OMAX * mag, d[1] * OMAX * mag];
      if (rv[id]) tg.t[id] = (cross(rv[id], f) >= 0 ? 1 : -1) * TMAX * mag;
    }
    // blocks
    var sumF = [[0, 0], [0, 0]], tq = [0, 0], jb = [0, 0], q;
    for (i = TK0; i < N; i++) {
      q = WH[i].f ? 0 : 1; var c = ref.C[i], b = q ? ref.G.H : ref.G.B;
      tq[q] += cross([c.x - b[0], c.y - b[1]], ref.F[i]);
      sumF[q][0] += cur.F[i][0]; sumF[q][1] += cur.F[i][1]; jb[q] = Math.max(jb[q], J.je[i]);
    }
    ['FB', 'MB'].forEach(function (id2, q2) {
      var gm = Math.min(1, 0.5 + 0.7 * Math.hypot(sumF[q2][0], sumF[q2][1])), m2 = jb[q2] * gm * pf;
      tg.t[id2] = (tq[q2] >= 0 ? 1 : -1) * TMAX * m2;
      var dd = unit(sumF[q2]);
      for (var k2 = TK0; k2 < N; k2++) if (WH[k2].id === id2) tg.o[k2] = [dd[0] * OMAX * m2, dd[1] * OMAX * m2];
    });
    return tg;
  }
  function wrapState(cur, tg, a) {
    var k, i;
    for (k in tg.t) cur.t[k] = (cur.t[k] || 0) + (tg.t[k] - (cur.t[k] || 0)) * a[k];
    for (i = 0; i < N; i++) {
      cur.o[i][0] += (tg.o[i][0] - cur.o[i][0]) * a[WH[i].id];
      cur.o[i][1] += (tg.o[i][1] - cur.o[i][1]) * a[WH[i].id];
    }
  }
  function allOne(v) { var a = {}; PICK.forEach(function (q) { a[q[0]] = v; }); return a; }
  // the rope the body must take up before the weight moves
  function slackNow() { return Math.min(0.55 * PMAX, SPEED * delayFor()); }

  // settled answer at a given pull, for the numbers announced in words
  function settle(pp) {
    var J = jank(), mu = muFor(J.jf), s2 = freshState(), ref = evalAt(ST_OPT, MU_OPT, pp), cur, it;
    for (it = 0; it < 14; it++) {
      cur = evalAt(s2, mu, pp);
      wrapState(s2, targets(cur, ref, J, pp), allOne(0.6));
    }
    cur = evalAt(s2, mu, pp);
    return metrics(cur, ref, s2, pp);
  }
  function metrics(cur, ref, s2, pp) {
    var m = { p: pp, h: cur.h, href: ref.h, pull: cur.Tgrip, pullref: ref.Tgrip, eta: cur.eta, etaref: ref.eta };
    m.lost = 1 - cur.eta; m.lostref = 1 - ref.eta;
    var i, best = -1e9, bi = 0, bref = 0, bcur = 0, dm = {};
    for (i = 0; i < N; i++) {
      var fc = Math.hypot(cur.F[i][0], cur.F[i][1]), fr = Math.hypot(ref.F[i][0], ref.F[i][1]);
      var id = WH[i].id;
      dm[id] = dm[id] || { fc: 0, fr: 0 }; dm[id].fc += fc; dm[id].fr += fr;
    }
    for (var k in dm) {
      var ex = dm[k].fc - dm[k].fr;
      if (ex > best) { best = ex; bi = k; bref = dm[k].fr; bcur = dm[k].fc; }
    }
    m.strainId = bi; m.strain = bcur; m.strainref = bref;
    m.shift = {};
    for (i = 0; i < N; i++) {
      var o = s2.o[i], id2 = WH[i].id, sh = Math.hypot(o[0], o[1]);
      if (!m.shift[id2] || sh > m.shift[id2].off) m.shift[id2] = { off: sh, tilt: Math.abs(s2.t[id2] || 0) };
    }
    return m;
  }
  function cmv(x) { return Math.round(x * CM * 10) / 10; }
  function fmt(x, d) { return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }
  function pct(x) { return Math.round(x * 100); }
  function deg(r) { return Math.round(Math.abs(r) * 180 / Math.PI); }
  function list(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1]; }
  function names() { var a = []; PICK.forEach(function (q) { if (sel[q[0]]) a.push(q[1]); }); return a; }

  function announce(prefix) {
    var pp = Math.max(0, PMAX - slackNow()), m = settle(pp), txt = '';
    var nm = names(), top = evalAt(ST_OPT, MU_OPT, PMAX).h;
    if (!nm.length) {
      txt = 'All pulleys are in place. Held to the end, the weight rises ' + cmv(m.h) + ' cm for ' + fmt(m.pull, 2) + ' times its weight in pull, and ' + pct(m.lost) + ' percent of the pull is lost to friction.';
    } else {
      txt = 'Janky: ' + list(nm) + '. The body takes up slack for ' + fmt(delayFor(), 1) + ' seconds before the weight moves. Held to the end, it rises ' + cmv(m.h) + ' cm instead of ' + cmv(top) +
        ', and ' + pct(m.lost) + ' percent of the pull is lost, against ' + pct(m.lostref) + '.';
    }
    if (prefix) txt = prefix + ' ' + txt;
    txt = txt.charAt(0).toUpperCase() + txt.slice(1);
    if (live) live.textContent = txt;
  }

  // ---- drawing
  var css = {}, W = 0, H = 0, K = 1, DPR = 1, OX = 0, GY = 0;
  function col(n, d) { var v = ''; try { v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); } catch (e) { } return v || d; }
  function readCss() {
    css.navy = col('--navy', '#0B1F3F'); css.blue = col('--blue', '#1F6FD1'); css.line = col('--line', '#D5DEEA');
    css.soft = col('--soft', '#51627A'); css.ink = col('--ink', '#14233B');
  }
  function X(x) { return OX + x * K; }
  function Y(y) { return GY - y * K; }
  function resize() {
    var r = cv.getBoundingClientRect(); if (!r.width) return;
    DPR = Math.min(window.devicePixelRatio || 1, 3);
    var w2 = Math.round(r.width * DPR), h2 = Math.round(r.height * DPR);
    if (r.width === W && r.height === H && cv.width === w2 && cv.height === h2) return;
    W = r.width; H = r.height;
    cv.width = w2; cv.height = h2;
    K = Math.min(W / 2.75, H / 2.12); OX = W / 2 - 0.02 * K; GY = H / 2 + 0.93 * K + 4;
    draw(lastEv);
  }
  var lastEv = null, lastRef = null, lastJ = jank();
  var ROPE = '#C9A227', ROPE_D = '#7A5F0A', BAD = '#D33A45', BONE = '#0E3A75';

  function line(a, b, w, c, dash) {
    ctx.beginPath(); ctx.moveTo(X(a[0]), Y(a[1])); ctx.lineTo(X(b[0]), Y(b[1]));
    ctx.lineWidth = w; ctx.strokeStyle = c; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
  }
  function skeleton(P, c, w, dash) {
    var a = [['neck', 'spU'], ['spU', 'spL'], ['spL', 'pel'], ['sL', 'sR'], ['hpL', 'hpR'], ['sL', 'eL'], ['eL', 'hL'], ['sR', 'eR'], ['eR', 'hR'],
      ['hpL', 'kL'], ['kL', 'aL'], ['aL', 'tL'], ['hpR', 'kR'], ['kR', 'aR'], ['aR', 'tR'], ['neck', 'head']];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    a.forEach(function (s) { line(P[s[0]], P[s[1]], w, c, dash); });
    ctx.beginPath(); ctx.arc(X(P.head[0]), Y(P.head[1]), 0.1 * K, 0, 7); ctx.lineWidth = w; ctx.strokeStyle = c;
    ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
  }
  function ropePath(ev, pg) {
    var C = ev.C, sg = ev.segs, i;
    var g0x = C[0].x - C[0].r, g0y = C[0].y;
    ctx.beginPath();
    ctx.moveTo(X(g0x), Y(g0y - LG0 - pg));
    ctx.lineTo(X(g0x), Y(g0y));
    for (i = 0; i < N; i++) {
      var inx = i ? sg[i - 1].x2 : g0x, iny = i ? sg[i - 1].y2 : g0y;
      var a1 = Math.atan2(-(iny - C[i].y), inx - C[i].x), a2 = Math.atan2(-(sg[i].y1 - C[i].y), sg[i].x1 - C[i].x);
      ctx.arc(X(C[i].x), Y(C[i].y), C[i].r * K, a1, a2, C[i].s < 0);
    }
    ctx.lineTo(X(sg[N - 1].x2), Y(sg[N - 1].y2));
  }
  function strokeRope(ev, a, w) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ropePath(ev, pin); ctx.strokeStyle = ROPE_D; ctx.lineWidth = w + 1.6; ctx.globalAlpha = a; ctx.stroke();
    ropePath(ev, pin); ctx.strokeStyle = ROPE; ctx.lineWidth = w; ctx.stroke(); ctx.globalAlpha = 1;
  }
  function rect(c, w, h, a, fill, stroke, lw) {
    ctx.save(); ctx.translate(X(c[0]), Y(c[1])); ctx.rotate(-a);
    ctx.beginPath(); var rr = 5;
    var x = -w / 2 * K, y = -h / 2 * K, ww = w * K, hh = h * K;
    ctx.moveTo(x + rr, y); ctx.arcTo(x + ww, y, x + ww, y + hh, rr); ctx.arcTo(x + ww, y + hh, x, y + hh, rr);
    ctx.arcTo(x, y + hh, x, y, rr); ctx.arcTo(x, y, x + ww, y, rr); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
    ctx.restore();
  }
  function strainColor(v) { // v 0..1.4 of the weight; blue to red
    var t = Math.max(0, Math.min(1, v / 1.1)), r = Math.round(60 + 170 * t), g = Math.round(130 - 80 * t), b = Math.round(220 - 170 * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function draw(ev) {
    if (!W) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
    if (!ev) { ev = lastEv = evalAt(st, muFor(lastJ.jf), Math.max(0, pin - slack)); }
    var ref = lastRef || evalAt(ST_OPT, MU_OPT, pin), J = lastJ, P = ev.P, i, Pr = ref.P;
    // ground
    ctx.beginPath(); ctx.moveTo(8, Y(0) + 4); ctx.lineTo(W - 8, Y(0) + 4); ctx.lineWidth = 2; ctx.strokeStyle = css.line; ctx.stroke();
    // ghost of the optimized body, rope and weight
    var showGhost = anyJank();
    if (showGhost) {
      skeleton(Pr, css.soft, 2, [5, 5]); ctx.globalAlpha = 0.5;
      ropePath(ref, pin); ctx.strokeStyle = css.soft; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      rect(rot([ref.G.H[0], ref.G.H[1] - 0.125], ref.G.H, ref.G.bm), 0.27, 0.15, ref.G.bm, null, css.soft, 1.3);
    }
    // body
    skeleton(P, BONE, Math.max(4, 0.034 * K));
    ctx.fillStyle = BONE; ['sL', 'sR', 'eL', 'eR', 'hpL', 'hpR', 'kL', 'kR'].forEach(function (a) {
      ctx.beginPath(); ctx.arc(X(P[a][0]), Y(P[a][1]), 0.026 * K, 0, 7); ctx.fill();
    });
    // tackle frames
    var G = ev.G;
    rect(G.B, S + 0.12, 0.11, G.beta, '#E8EEF7', BONE, 1.6);
    line(P.hR, [G.B[0], G.B[1] - 0.04], Math.max(3, 0.02 * K), BONE);
    // weight and moving block
    var hk = G.H, bm = G.bm;
    rect(rot([hk[0], hk[1] + 0.07], hk, bm), S + 0.12, 0.1, bm, '#E8EEF7', BONE, 1.6);
    var wc = rot([hk[0], hk[1] - 0.125], hk, bm);
    line(rot([hk[0], hk[1] + 0.02], hk, bm), wc, 2, BONE);
    rect(wc, 0.27, 0.15, bm, BONE, null);
    ctx.fillStyle = '#fff'; ctx.font = '600 ' + Math.max(8, 0.052 * K) + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('weight', X(wc[0]), Y(wc[1]));
    // start line of the weight
    var yS = YM0 - 0.07 - 0.125;
    ctx.beginPath(); ctx.moveTo(X(hk[0] - 0.22), Y(yS)); ctx.lineTo(X(hk[0] + 0.22), Y(yS)); ctx.lineWidth = 1; ctx.strokeStyle = css.soft; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);
    // rope
    strokeRope(ev, 1, Math.max(2.4, 0.013 * K));
    // wheels
    var jt = (jit && !reduced()) ? 1 : 0;
    for (i = 0; i < N; i++) {
      var c = ev.C[i], w = WH[i], jf = J.jf[i], fm = Math.hypot(ev.F[i][0], ev.F[i][1]);
      var jx = jt ? (Math.random() - 0.5) * 2.2 * jf : 0, jy = jt ? (Math.random() - 0.5) * 2.2 * jf : 0;
      var cx = X(c.x) + jx, cy = Y(c.y) + jy, rr = c.r * K;
      // strain halo
      if (!(w.f || w.m)) {
        ctx.beginPath(); ctx.arc(cx, cy, rr + 4 + fm * 14, 0, 7); ctx.fillStyle = strainColor(fm); ctx.globalAlpha = 0.22; ctx.fill(); ctx.globalAlpha = 1;
      }
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = (sel[w.id]) ? BAD : BONE; ctx.stroke();
      // spokes
      var ang = (pin / c.r) * (1 - 0.92 * jf);
      ctx.lineWidth = 1.2; ctx.strokeStyle = sel[w.id] ? BAD : css.soft;
      for (var s = 0; s < 3; s++) {
        var aa = ang + s * Math.PI * 2 / 3;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(aa) * rr * 0.85, cy - Math.sin(aa) * rr * 0.85); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(1.6, rr * 0.16), 0, 7); ctx.fillStyle = sel[w.id] ? BAD : BONE; ctx.fill();
      if (sel[w.id] && jf > 0.05) { // grinding marks
        ctx.strokeStyle = BAD; ctx.lineWidth = 1.4;
        for (var q = 0; q < 6; q++) {
          var qa = q * Math.PI / 3 + 0.3 + (jt ? Math.random() * 0.4 : 0);
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(qa) * (rr + 2), cy + Math.sin(qa) * (rr + 2));
          ctx.lineTo(cx + Math.cos(qa + 0.12) * (rr + 4 + 5 * jf), cy + Math.sin(qa + 0.12) * (rr + 4 + 5 * jf)); ctx.stroke();
        }
      }
    }
    // grip and its label
    var gx = X(ev.C[0].x - ev.C[0].r), gy = Y(ev.C[0].y - LG0 - pin);
    ctx.beginPath(); ctx.arc(gx, gy + 7, 8, 0, 7); ctx.fillStyle = ROPE; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = ROPE_D; ctx.stroke();
    ctx.fillStyle = css.ink; ctx.font = '600 12px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    if (pin < 0.02) {
      if (COARSE || W < 520) {
        ctx.font = '600 11px system-ui,sans-serif';
        ctx.fillText('Press the button', Math.max(4, gx - 8), gy + 30); ctx.fillText('below to pull', Math.max(4, gx - 8), gy + 44);
      } else ctx.fillText('pull', gx + 14, gy + 8);
    }
    // labels for janky pulleys
    ctx.font = '600 12px system-ui,sans-serif'; ctx.fillStyle = BAD;
    for (i = 0; i < N; i++) {
      if (sel[WH[i].id] && !WH[i].f && !WH[i].m) {
        var c2 = ev.C[i], left = c2.x < -0.01;
        ctx.textAlign = left ? 'right' : 'left';
        ctx.fillText(NAME[WH[i].id], X(c2.x) + (left ? -0.09 : 0.09) * K, Y(c2.y) - 0.02 * K);
      }
    }
    if (sel.FB) { ctx.textAlign = 'center'; ctx.fillText('fixed block', X(G.B[0]), Y(G.B[1] + 0.14)); }
    if (sel.MB) { ctx.textAlign = 'center'; ctx.fillText('moving block', X(hk[0]), Y(hk[1] + 0.2)); }
    if (showGhost) { ctx.fillStyle = css.soft; ctx.font = '12px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.fillText('dashed: optimized body', 10, 16); }
    meters(ev, ref);
  }
  var $ = function (id) { return document.getElementById(id); };
  function meters(ev, ref) {
    var an = anyJank();
    function put(id, a, b) { var e = $(id), h = a + '<small>' + (b && an ? '(optimized ' + b + ')' : '&nbsp;') + '</small>'; if (e && e._h !== h) { e._h = h; e.innerHTML = h; } }
    put('pl-in', fmt(pin * CM, 0) + ' cm');
    put('pl-out', fmt(ev.h * CM, 1) + ' cm', fmt(ref.h * CM, 1) + ' cm');
    put('pl-pull', fmt(ev.Tgrip, 2) + ' &times; the weight', fmt(ref.Tgrip, 2));
    put('pl-lost', pct(1 - ev.eta) + '%', pct(1 - ref.eta) + '%');
    var best = -1e9, bi = 'neck', k, dm = {}, i;
    for (i = 0; i < N; i++) { var id = WH[i].id; dm[id] = dm[id] || [0, 0]; dm[id][0] += Math.hypot(ev.F[i][0], ev.F[i][1]); dm[id][1] += Math.hypot(ref.F[i][0], ref.F[i][1]); }
    for (k in dm) { var v = an ? dm[k][0] - dm[k][1] : dm[k][0]; if (v > best) { best = v; bi = k; } }
    var e2 = $('pl-strain'), h2 = NAME[bi] + ' <small>' + fmt(dm[bi][0], 2) + ' &times; weight' + (an ? ', optimized ' + fmt(dm[bi][1], 2) : '') + '</small>'; if (e2 && e2._h !== h2) { e2._h = h2; e2.innerHTML = h2; }
  }

  // ---- updating
  // the wobble: while the body takes up slack it sags and sways, then it tightens and the weight starts to move
  function wobble() {
    var D = delayFor(), A = ampFor(), s;
    if (reduced() || A <= 0 || wa < 0.01) { return ZW; }
    var env = tt < D ? 1 : Math.exp(-(tt - D) / 0.22), u = D > 0 ? Math.min(1, tt / D) : 1;
    s = { sag: 0, lean: 0, flap: 0 };
    s.sag = A * SAGMAX * ((1 - Math.exp(-tt / 0.14)) * env + 0.3 * (1 - env) * Math.min(1, pin / PMAX * 2));
    s.lean = A * LEANMAX * Math.sin(tt * 8.4) * (0.45 + 0.55 * u) * env;
    s.flap = A * FLAPMAX * Math.sin(tt * 11.5 + 1) * (0.35 + 0.65 * u) * env;
    s.sag *= wa; s.lean *= wa; s.flap *= wa;
    return s;
  }
  function step(dt) {
    var J = lastJ = jank(), mu = muFor(J.jf), moved = false;
    var etaNow = lastEv ? lastEv.eta : 1;
    slack = slackNow();
    if (reduced()) {
      pin = (holding) ? PMAX : 0; wa = 0; tt = 0;
    } else if (dragging) {
      tt = pin / SPEED; wa = 1; moved = true;
    } else if (holding) {
      pin = Math.min(PMAX, pin + dt * SPEED); tt += dt; wa = 1; moved = true;
    } else {
      wa *= Math.exp(-dt / 0.09);
      if (pin > 0) { pin = Math.max(0, pin - dt * RET * (0.6 + 0.4 * Math.min(1, etaNow))); moved = true; }
      else { tt = 0; if (wa < 0.01) wa = 0; }
    }
    var pe = Math.max(0, pin - slack);
    st.w = wobble();
    var ref = lastRef = evalAt(ST_OPT, MU_OPT, pin), refE = pe === pin ? ref : evalAt(ST_OPT, MU_OPT, pe), cur = evalAt(st, mu, pe), tg = targets(cur, refE, J, pe), i;
    var a = {};
    PICK.forEach(function (q) {
      var id = q[0], j = 0;
      for (i = 0; i < N; i++) if (WH[i].id === id) j = Math.max(j, J.je[i]);
      a[id] = reduced() ? 1 : 1 - Math.exp(-dt / (0.05 + 0.5 * j));
    });
    var before = JSON.stringify(st.t) + st.o.join();
    wrapState(st, tg, a);
    if (reduced()) { for (var it = 0; it < 6; it++) { cur = evalAt(st, mu, pe); wrapState(st, targets(cur, refE, J, pe), a); } }
    jit = moved && anyJank() ? 1 : 0;
    lastEv = evalAt(st, mu, pe);
    draw(lastEv);
    return moved || wa > 0 || before !== (JSON.stringify(st.t) + st.o.join());
  }
  var relPending = false, relMsg = '';
  function tick(ts) {
    raf = 0; var dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016); lastTs = ts;
    var go = step(dt);
    if (go || holding || dragging) raf = requestAnimationFrame(tick);
    else { jit = 0; if (relPending) { relPending = false; announce(relMsg); } }
  }
  function kick() { if (!raf) { lastTs = performance.now(); raf = requestAnimationFrame(tick); } }

  // ---- controls
  var chips = $('pl-chips');
  PICK.forEach(function (q) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chipbtn'; b.setAttribute('data-id', q[0]); b.setAttribute('aria-pressed', 'false');
    b.textContent = q[1]; chips.appendChild(b);
  });
  function sync() {
    Array.prototype.forEach.call(chips.children, function (b) {
      var on = !!sel[b.getAttribute('data-id')]; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.className = 'chipbtn' + (on ? ' jk' : '');
    });
  }
  function toggle(id) {
    sel[id] = !sel[id]; if (!sel[id]) delete sel[id]; sync(); kick(); announce(sel[id] ? NAME[id] + ' made janky.' : NAME[id] + ' put back in place.');
  }
  chips.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) toggle(b.getAttribute('data-id')); });
  $('pl-reset').addEventListener('click', function () {
    sel = {}; sev = 0.8; $('pl-sev').value = 80; pin = 0; tt = 0; wa = 0; holding = false; dragging = false; st = freshState(); sync(); kick();
    if (reduced()) { step(0); }
    announce('Reset to the optimized body.');
  });
  $('pl-all').addEventListener('click', function () { PICK.forEach(function (q) { sel[q[0]] = true; }); sync(); kick(); announce('Every pulley made janky.'); });
  $('pl-sev').addEventListener('input', function () { sev = this.value / 100; kick(); });
  $('pl-sev').addEventListener('change', function () { announce('Jank set to ' + this.value + ' percent.'); });

  // one control: hold the button to pull, let go and the weight goes back
  var hb = $('pl-hold'), box = $('pl-box');
  function lock(on) {
    if (box) box.classList.toggle('pulling', on);
    document.documentElement.classList.toggle('pl-lock', on);
  }
  function startHold(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (holding) return;
    holding = true; lock(true);
    if (!reduced()) { tt = pin / SPEED; pin = Math.min(PMAX, pin + SPEED * 0.06); }   // a tap nudges it a little
    kick();
  }
  function endHold() {
    if (!holding) return;
    holding = false; lock(false);
    if (reduced()) { pin = 0; kick(); announce('Let go. The weight fell back to its start.'); return; }
    relPending = true; relMsg = 'Let go. The weight falls back to its start.'; kick();
  }
  hb.addEventListener('pointerdown', function (e) {
    startHold(e);
    try { hb.setPointerCapture(e.pointerId); } catch (x) { }
  });
  hb.addEventListener('pointerup', endHold);
  hb.addEventListener('pointercancel', endHold);
  hb.addEventListener('lostpointercapture', endHold);
  hb.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  hb.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
  hb.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', function (e) { if (holding || dragging) e.preventDefault(); }, { passive: false });
  hb.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) startHold(e); });
  hb.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') endHold(); });
  hb.addEventListener('blur', endHold);
  window.addEventListener('blur', endHold);

  // pointer on the canvas: with a mouse, drag the grip; with a finger, tap a pulley (the button does the pulling)
  function pos(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function gripPos() { var c = lastEv ? lastEv.C[0] : null; return c ? [X(c.x - c.r), Y(c.y - LG0 - pin) + 7] : [0, 0]; }
  var moved0 = false;
  function hitWheel(q) {
    var best = null, bd = 1e9, i;
    if (!lastEv) return null;
    for (i = 0; i < N; i++) {
      var c = lastEv.C[i], d = Math.hypot(q[0] - X(c.x), q[1] - Y(c.y)), lim = Math.max(c.r * K + 8, 20);
      if (d < lim && d < bd) { bd = d; best = WH[i].id; }
    }
    return best;
  }
  cv.addEventListener('pointerdown', function (e) {
    var q = pos(e), g = gripPos(); moved0 = false;
    if (e.pointerType !== 'touch' && Math.hypot(q[0] - g[0], q[1] - g[1]) < 26) {
      dragging = true; holding = false; lock(true); try { cv.setPointerCapture(e.pointerId); } catch (x) { } e.preventDefault(); kick();
    }
  });
  cv.addEventListener('pointermove', function (e) {
    var q = pos(e);
    if (dragging) {
      moved0 = true;
      var c = lastEv.C[0], wy = (GY - (q[1] - 7)) / K;
      pin = Math.max(0, Math.min(PMAX, c.y - LG0 - wy)); kick();
    } else if (e.pointerType !== 'touch') {
      var g = gripPos(); cv.style.cursor = (Math.hypot(q[0] - g[0], q[1] - g[1]) < 26) ? 'ns-resize' : (hitWheel(q) ? 'pointer' : 'default');
    }
  });
  function up() { if (dragging) { dragging = false; lock(false); kick(); } }
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('click', function (e) {
    if (moved0) { moved0 = false; return; }
    var id = hitWheel(pos(e)); if (id) toggle(id);
  });

  if (window.ResizeObserver) new ResizeObserver(resize).observe(cv); else window.addEventListener('resize', resize);
  if (RMQ && RMQ.addEventListener) RMQ.addEventListener('change', function () { kick(); });
  readCss(); sync(); resize(); step(0);
  window.__pulleys = {
    settle: settle, sel: sel, toggle: toggle, delay: delayFor, amp: ampFor,
    state: function () { return { pin: pin, tt: tt, wa: wa, slack: slack, h: lastEv && lastEv.h, w: st.w, eta: lastEv && lastEv.eta, wrap: lastEv && lastEv.wrap, holding: holding }; },
    hold: startHold, release: endHold
  };
})();
