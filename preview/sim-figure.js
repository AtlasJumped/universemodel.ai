// Universe Model: the "skin and bones" person drawn over the tensegrity's computed node positions.
// Every ring of skin is anchored to nodes of the physics model, so pose, tilt, rotation, asymmetry and the
// head's position come straight from the simulation. The expression and the skin tint respond only to
// computed quantities (overall structural load and per-node strain); nothing is scripted per scenario.
(function (root) {
  'use strict';
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]), norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const ortho = (v, axis) => norm(sub(v, mul(axis, dot(v, axis))));

  // A ring: centre C, unit axes A (body left) and B (forward or up), half extents a1 (+A), a2 (-A), b1 (+B), b2 (-B).
  function ringFrom(Lp, Rp, Fp, Bp, pad, st) {
    const A = norm(sub(Lp, Rp)), Cl = mul(add(Lp, Rp), 0.5);
    const fd = sub(Fp, Cl), bd = sub(Bp, Cl), f2 = sub(fd, mul(A, dot(A, fd))), b2 = sub(bd, mul(A, dot(A, bd)));
    const B = norm(sub(f2, b2)), fo = dot(B, f2), bo = dot(B, b2), off = (fo + bo) / 2, hw = len(sub(Lp, Rp)) / 2;
    return { C: add(Cl, mul(B, off)), A, B, a1: hw + pad[0], a2: hw + pad[1], b1: fo - off + pad[2], b2: off - bo + pad[3], st: st || 0 };
  }
  function ringAxis(C, axis, ref, a1, a2, b1, b2, st) { const ax = norm(axis), A = norm(cross(ax, ref)), B = norm(cross(A, ax)); return { C, A, B, a1, a2, b1, b2, st: st || 0 }; }
  function lerpRing(r, s, t, scale) {
    const A = norm(mix(r.A, s.A, t)), B = ortho(mix(r.B, s.B, t), A), k = scale || 1;
    return { C: mix(r.C, s.C, t), A, B, a1: (r.a1 + (s.a1 - r.a1) * t) * k, a2: (r.a2 + (s.a2 - r.a2) * t) * k, b1: (r.b1 + (s.b1 - r.b1) * t) * k, b2: (r.b2 + (s.b2 - r.b2) * t) * k, st: r.st + (s.st - r.st) * t, tag: r.tag };
  }
  const SE = 2 / 2.12; // superellipse exponent: fuller than an ellipse, like a body cross-section
  function ringPts(r, n) {
    const out = [];
    for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      const x = Math.sign(c) * Math.pow(Math.abs(c), SE) * (c >= 0 ? r.a1 : r.a2), y = Math.sign(s) * Math.pow(Math.abs(s), SE) * (s >= 0 ? r.b1 : r.b2);
      out.push([r.C[0] + r.A[0] * x + r.B[0] * y, r.C[1] + r.A[1] * x + r.B[1] * y, r.C[2] + r.A[2] * x + r.B[2] * y]); }
    return out;
  }

  const SKIN = [214, 168, 132], HAIR = [74, 52, 36], BEARD = [104, 80, 60];
  const SUIT = { male: [16, 48, 98], female: [15, 112, 128] };

  function draw(ctx, o) {
    const P = o.P, I = o.IDX, female = o.sex === 'female', g = n => P[I[n]], m2 = (a, b) => mul(add(g(a), g(b)), 0.5);
    const ns = o.nodeStrain || [], sN = n => ns[I[n]] || 0, sAvg = (...n) => n.reduce((a, x) => a + sN(x), 0) / n.length;
    const sc = female ? 170 / 183 : 1, k = v => v * sc;
    const quads = [];
    // pelvis frame
    const Ap = norm(sub(g('asisL'), g('asisR'))), Fp = ortho(sub(m2('asisL', 'asisR'), g('s1')), Ap), Up = cross(Fp, Ap);
    // ---------- torso ----------
    const wF = female ? 1 : 0;
    const T = [];
    T.push(ringAxis(add(m2('hipL', 'hipR'), add(mul(Up, -k(female ? 5 : 6.5)), mul(Fp, -k(1)))), Up, Fp, k(female ? 5.5 : 7), k(female ? 5.5 : 7), k(5), k(6), sAvg('pubis', 'coccyx')));
    T.push(ringFrom(g('trochL'), g('trochR'), g('pubis'), g('coccyx'), [k(0.6 + wF * 0.6), k(0.6 + wF * 0.6), k(2.5), k(5.5 + wF * 0.5)], sAvg('trochL', 'trochR', 'glutL' in I ? 'pubis' : 'pubis')));
    T.push(ringFrom(g('crestL'), g('crestR'), m2('asisL', 'asisR'), g('tlf'), [k(0.1 + wF * 0.7), k(0.1 + wF * 0.7), k(2.4), k(1.2)], sAvg('crestL', 'crestR', 'tlf')));
    T.push(ringFrom(g('trunkL'), g('trunkR'), g('navel'), mix(m2('erectorL', 'erectorR'), m2('erectorLowL', 'erectorLowR'), 0.5), [k(-3.1 - wF * 0.4), k(-3.1 - wF * 0.4), k(-4.0), k(1.2)], sAvg('trunkL', 'trunkR', 'navel', 'tlf')));
    T.push(ringFrom(g('ribLowL'), g('ribLowR'), g('xiph'), m2('erectorL', 'erectorR'), [k(0.4 - wF * 0.6), k(0.4 - wF * 0.6), k(0.2), k(1.4)], sAvg('ribLowL', 'ribLowR', 'xiph')));
    if (female) T.push(lerpRing(T[T.length - 1], ringFrom(g('ribUpL'), g('ribUpR'), m2('pecL', 'pecR'), m2('scapInfL', 'scapInfR'), [k(0.8), k(0.8), k(6.5), k(1.6)]), 0.55));
    T.push(ringFrom(g('ribUpL'), g('ribUpR'), m2('pecL', 'pecR'), m2('scapInfL', 'scapInfR'), [k(4.4 - wF * 2.8), k(4.4 - wF * 2.8), k(female ? 4.2 : 3.8), k(2.8)], sAvg('ribUpL', 'ribUpR', 'pecL', 'pecR')));
    T.push(ringFrom(g('acromL'), g('acromR'), g('stTop'), m2('napeL', 'napeR'), [k(-0.6 - wF * 1.2), k(-0.6 - wF * 1.2), k(2.2), k(3.6 - wF)], sAvg('acromL', 'acromR', 'c7')));
    T.push(ringFrom(g('neckSideL'), g('neckSideR'), g('throat'), m2('napeL', 'napeR'), [k(-0.7 - wF * 0.7), k(-0.7 - wF * 0.7), k(-0.4), k(1.4)], sAvg('neckSideL', 'neckSideR', 'throat')));
    // head frame: the skull's own axes, re-expressed so the healthy head is upright and faces straight ahead
    const hf = Q => { const e1 = norm(sub(Q[I.top], Q[I.chin])), e2 = ortho(sub(Q[I.brow], Q[I.occ]), e1); return [e1, e2, cross(e1, e2)]; };
    const fc0 = hf(o.ref || P), fc1 = hf(P), remap = v => { const c = fc0.map(e => dot(v, e)); return norm(add(add(mul(fc1[0], c[0]), mul(fc1[1], c[1])), mul(fc1[2], c[2]))); };
    const Uh = remap([0, 1, 0]), Fh = ortho(remap([0, 0, 1]), Uh);
    T.push(ringAxis(mix(g('c1'), g('chin'), 0.35), Uh, Fh, k(4.5), k(4.5), k(4.2), k(4.6), sAvg('c1', 'scmL', 'scmR')));
    T.forEach((r, i) => r.tag = i);
    const torso = smooth(T, [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0]);
    const nT = 44;
    const chestIdx = T.length - 4; // the ribUp ring
    mesh(torso, nT, (ri, si) => {
      const tg = torso[ri].tag;
      if (female ? tg < chestIdx : tg <= 1) return 'suit';
      if (female && tg === chestIdx) { const a = si / nT * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a); return Math.abs(Math.abs(c) - 0.55) < 0.14 ? 'suit' : 'skin'; }
      return 'skin';
    }, true, false);
    // ---------- legs ----------
    for (const s of ['L', 'R']) {
      const lat = s === 'L', pl = (a, b) => lat ? [g(a + s), g(b + s)] : [g(b + s), g(a + s)];
      const fwdFoot = norm(sub(g('ball' + s), g('heel' + s)));
      const R = [];
      R.push(ringAxis(add(g('ankle' + s), [0, k(1.5), 0]), sub(g('knee' + s), g('ankle' + s)), fwdFoot, k(2.8), k(2.8), k(3.0), k(3.2), sN('ankle' + s)));
      const [cA, cB] = pl('calfL', 'calfI'), calf = ringFrom(cA, cB, g('shinF' + s), g('calfB' + s), [k(2.7), k(2.5), k(0.4), k(3.3)], sAvg('calfL' + s, 'calfI' + s, 'calfB' + s));
      R.push(lerpRing(R[0], calf, 0.5, 0.86));
      R.push(calf);
      const [kA, kB] = pl('kneeLat', 'kneeMed'), knee = ringFrom(kA, kB, g('kneeF' + s), g('knee' + s), [k(1.3), k(1.3), k(0.3), k(4.6)], sAvg('knee' + s, 'kneeF' + s));
      R.push(lerpRing(calf, knee, 0.5, 1));
      R.push(knee);
      const [tA, tB] = pl('thighL', 'thighI'), thigh = ringFrom(tA, tB, g('thighF' + s), g('thighB' + s), [k(3.2), k(2.6), k(3.2), k(3.0)], sAvg('thighL' + s, 'thighI' + s, 'thighF' + s, 'thighB' + s));
      R.push(lerpRing(knee, thigh, 0.45, 0.98));
      R.push(thigh);
      const hc = add(mix(g('hip' + s), g('troch' + s), 0.18), mul(Up, k(0.5)));
      R.push(ringAxis(hc, sub(hc, g('knee' + s)), Fp, k(lat ? 7.4 : 5.9), k(lat ? 5.9 : 7.4), k(7.0), k(8.0), sN('hip' + s)));
      const leg = smooth(R, [1, 1, 1, 1, 1, 1, 1, 0]);
      const nL = 30, top = leg.length - 1;
      mesh(leg, nL, ri => (ri >= top - (female ? 0 : 3) ? 'suit' : 'skin'), false, true, ri => ri >= top - 1 ? -40 : 0);
      // foot: rings from heel to toe, axis along the foot, second axis up
      const up = [0, 1, 0], h = g('heel' + s), b = g('ball' + s), t = g('toe' + s), an = g('ankle' + s);
      const F = [
        ringAxis(add(h, [0, k(3), 0]), fwdFoot, up, k(2.8), k(2.8), k(3), k(2.4), sN('heel' + s)),
        ringAxis(add(mix(h, b, 0.42), [0, k(4.2), 0]), fwdFoot, up, k(3.6), k(3.6), k(3.4), k(3.4), sN('ankle' + s)),
        ringAxis(add(b, [0, k(2.3), 0]), fwdFoot, up, k(4.6), k(4.6), k(1.9), k(1.6), sN('ball' + s)),
        ringAxis(add(t, [0, k(1.6), 0]), fwdFoot, up, k(3.6), k(3.6), k(1.1), k(1.1), sN('toe' + s))
      ];
      void an;
      mesh(F, 14, () => 'skin', true, true);
    }
    // ---------- arms ----------
    const Ft = ortho(sub(g('stTop'), m2('napeL', 'napeR')), norm(sub(g('acromL'), g('acromR'))));
    for (const s of ['L', 'R']) {
      const ac = g('acrom' + s), el = g('elbow' + s), wr = g('wrist' + s), ha = g('hand' + s), aw = female ? 0.86 : 1;
      const top = add(ac, mul(norm(sub(el, ac)), k(2.5)));
      const A = [
        ringAxis(mix(wr, ha, 1.05), sub(wr, ha), Ft, k(1.1), k(1.1), k(2.6), k(2), sN('hand' + s)),
        ringAxis(mix(wr, ha, 0.7), sub(wr, ha), Ft, k(1.5), k(1.5), k(4), k(3.2), sN('hand' + s)),
        ringAxis(mix(wr, ha, 0.35), sub(wr, ha), Ft, k(1.7), k(1.7), k(4.2), k(3.4), sN('hand' + s)),
        ringAxis(wr, sub(el, wr), Ft, k(1.8 * aw), k(1.8 * aw), k(2.5 * aw), k(2.5 * aw), sN('wrist' + s)),
        ringAxis(mix(el, wr, 0.3), sub(el, wr), Ft, k(4.1 * aw), k(4.1 * aw), k(3.7 * aw), k(3.7 * aw), sN('elbow' + s)),
        ringAxis(el, sub(ac, el), Ft, k(3.4 * aw), k(3.4 * aw), k(3.4 * aw), k(3.6 * aw), sN('elbow' + s)),
        ringAxis(mix(el, ac, 0.5), sub(ac, el), Ft, k(5.0 * aw), k(5.0 * aw), k(5.6 * aw), k(5.6 * aw), sN('acrom' + s)),
        ringAxis(top, sub(ac, el), Ft, k(5.2 * aw), k(5.2 * aw), k(5.2 * aw), k(5.0 * aw), sN('acrom' + s))
      ];
      mesh(smooth(A, [0, 0, 1, 1, 1, 1, 1, 0]), 24, () => 'skin', true, true);
    }
    // shoulder caps (deltoids)
    for (const s of ['L', 'R']) { const ac = g('acrom' + s), el = g('elbow' + s), dn = norm(sub(el, ac)), out = norm(sub(g('acrom' + s), g('acrom' + (s === 'L' ? 'R' : 'L'))));
      blob(add(add(ac, mul(dn, k(3.4))), mul(out, k(-0.6))), dn, Ft, k(female ? 4.5 : 5.3), k(female ? 5.6 : 6.4), k(female ? 4.7 : 5.4), sN('acrom' + s)); }
    // seat: muscle volume anchored to the computed pelvis nodes
    for (const s of ['L', 'R']) { const gl = mix(g('isch' + s), g('crest' + s), 0.35), bk = mul(Fp, -1);
      blob(add(gl, add(mul(bk, k(3.2)), mul(Up, k(-2)))), Up, bk, k(female ? 6.6 : 6), k(female ? 7.4 : 6.8), k(female ? 4.6 : 4), sAvg('isch' + s, 'crest' + s)); }
    // ---------- head ----------
    const Ah = cross(Uh, Fh), hC = add(mix(mix(g('top'), g('chin'), 0.5), mix(g('brow'), g('occ'), 0.5), 0.5), mul(Fh, -k(0.6)));
    const headPt = (phi, th, out) => { // phi: -pi/2 (chin) .. pi/2 (crown); th: 0 = left side, pi/2 = face
      const sp = Math.sin(phi), cp = Math.cos(phi), front = Math.sin(th) > 0;
      let ra = k(7.9), rf = front ? k(9.6) : k(10.4), ru = sp > 0 ? k(11.8) : k(12.2);
      if (sp < -0.25) { const j = Math.min(1, (-sp - 0.25) / 0.75); ra *= 1 - 0.2 * j; rf *= front ? 1 - 0.04 * j : 1 - 0.4 * j; }
      if (sp > 0.6) ra *= 1.02;
      const r = 1 + (out || 0) / k(9);
      return add(hC, add(mul(Uh, ru * sp * r), mul(add(mul(Ah, ra * Math.cos(th)), mul(Fh, rf * Math.sin(th))), cp * r)));
    };
    const HR = [], nh = 32, mh = 20;
    for (let i = 0; i <= mh; i++) { const phi = -Math.PI / 2 + Math.PI * i / mh, row = []; for (let j = 0; j < nh; j++) row.push(headPt(phi, j / nh * Math.PI * 2)); HR.push(row); }
    const hairAt = (phi, th) => { const s = Math.sin(th), c = Math.cos(th);
      if (phi > 0.62) return true; if (s > 0.45) return phi > (female ? 0.5 : 0.56);
      if (s < -0.15) return phi > (female ? -0.95 : -0.25); return phi > (female ? -0.35 : 0.12) + 0.25 * Math.max(0, s) && !(Math.abs(c) > 0.8 && phi < 0.25 && !female); };
    // the male figure wears a short full beard: jaw, chin and upper lip, joining the hair in front of the ears
    const beardAt = (phi, th) => { if (female) return false; const s = Math.sin(th), c = Math.abs(Math.cos(th));
      if (s < -0.05) return false; if (c > 0.82) return phi < 0.14 && phi > -1.05; if (c > 0.5) return phi < -0.16 && phi > -1.2; return phi < -0.3 && phi > -1.3; };
    for (let i = 0; i < mh; i++) for (let j = 0; j < nh; j++) {
      const j2 = (j + 1) % nh, phi = -Math.PI / 2 + Math.PI * (i + 0.5) / mh, th = (j + 0.5) / nh * Math.PI * 2;
      const qq = [HR[i][j], HR[i][j2], HR[i + 1][j2], HR[i + 1][j]];
      pushQuad(qq, hairAt(phi, th) ? 'hair' : beardAt(phi, th) ? 'beard' : 'skin', sAvg('occ', 'c1') * 0.5, hC, norm(qq.reduce((a, q) => add(a, norm(sub(q, hC))), [0, 0, 0])));
    }
    if (female) { // a low bun
      const bc = add(hC, add(mul(Fh, -k(10.8)), mul(Uh, -k(1.5)))), BR = [];
      for (let i = 0; i <= 6; i++) { const phi = -Math.PI / 2 + Math.PI * i / 6, row = []; for (let j = 0; j < 10; j++) { const th = j / 10 * Math.PI * 2;
        row.push(add(bc, add(mul(Uh, k(3.6) * Math.sin(phi)), mul(add(mul(Ah, k(4.2) * Math.cos(th)), mul(Fh, k(3.4) * Math.sin(th))), Math.cos(phi))))); } BR.push(row); }
      for (let i = 0; i < 6; i++) for (let j = 0; j < 10; j++) { const qq = [BR[i][j], BR[i][(j + 1) % 10], BR[i + 1][(j + 1) % 10], BR[i + 1][j]]; pushQuad(qq, 'hair', 0, bc, norm(qq.reduce((a, q) => add(a, norm(sub(q, bc))), [0, 0, 0]))); }
    }

    // ---------- render ----------
    const V = o.view, S = o.screen, L = norm([-0.38, 0.55, 0.74]);
    // shadow on the floor
    const fc = mul(add(g('heelL'), g('heelR')), 0.5), fs = [[-28, 0, -12], [28, 0, -12], [28, 0, 22], [-28, 0, 22]];
    const sh = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; sh.push(S(V([fc[0] + Math.cos(a) * k(24), 0, fc[2] + 4 + Math.sin(a) * k(16)]))); }
    void fs; ctx.fillStyle = 'rgba(14,58,117,.08)'; ctx.beginPath(); sh.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.fill();
    const items = [];
    for (const q of quads) {
      const v = q.p.map(V), n = norm(cross(sub(v[2], v[0]), sub(v[1], v[3])));
      let nn = n; const cv = mul(add(add(v[0], v[1]), add(v[2], v[3])), 0.25), out = sub(cv, V(q.c));
      if (dot(nn, out) < 0) nn = mul(nn, -1);
      const eye = [0, 0, 520], toEye = norm(sub(eye, cv)); if (dot(nn, toEye) < -0.12) continue;
      const sn = q.n ? norm(sub(V(add(q.c, q.n)), V(q.c))) : nn;
      items.push([cv[2] + (q.bias || 0), v, sn, q]);
    }
    items.sort((a, b) => a[0] - b[0]);
    const load = Math.max(0, Math.min(1, o.load || 0));
    for (const [, v, n, q] of items) {
      const base = q.kind === 'suit' ? SUIT[o.sex] : q.kind === 'hair' ? HAIR : q.kind === 'beard' ? BEARD : SKIN;
      let col = base;
      if (q.kind === 'skin' && o.strainTint) { const t = Math.min(1, q.st * 16) * 0.3; col = [base[0] + (205 - base[0]) * t, base[1] + (92 - base[1]) * t, base[2] + (80 - base[2]) * t]; }
      const lam = Math.max(0, dot(n, L)), rim = Math.pow(1 - Math.abs(n[2]), 3) * 0.12;
      const spec = q.kind === 'skin' ? Math.pow(Math.max(0, dot(norm(add(L, [0, 0, 1])), n)), 24) * 0.12 : q.kind === 'suit' ? Math.pow(Math.max(0, dot(norm(add(L, [0, 0, 1])), n)), 16) * 0.18 : 0;
      const sh = 0.5 + 0.55 * lam - rim;
      const c = col.map(x => Math.max(0, Math.min(255, Math.round(x * sh + 255 * spec))));
      const pts = v.map(S), st = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.fillStyle = st; ctx.strokeStyle = st; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // ---------- face: drawn on the head surface when it faces the viewer ----------
    const fn = V(add(hC, Fh)), fv = sub(fn, V(hC));
    const facing = norm(fv)[2];
    if (facing > 0.15) {
      const P2 = (phi, th, out) => S(V(headPt(phi, th, out)));
      ctx.globalAlpha = Math.min(1, (facing - 0.15) * 3);
      const ph = Math.PI / 2, eyeW = 0.22;
      for (const sgn of [-1, 1]) { // soft eye sockets, calm lids and fine brows: a sculptural face, not a cartoon
        const e0 = P2(0.05, ph + sgn * 0.4 - eyeW / 2, 0.05), e1 = P2(0.05, ph + sgn * 0.4 + eyeW / 2, 0.05), ec = P2(0.06, ph + sgn * 0.4, 0.1);
        const w = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]) / 2, rot = Math.atan2(e1[1] - e0[1], e1[0] - e0[0]);
        ctx.fillStyle = 'rgba(120,76,52,.16)'; ctx.beginPath(); ctx.ellipse(ec[0], ec[1] - w * 0.15, w * 1.35, w * 0.75, rot, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(70,44,30,.7)'; ctx.lineWidth = Math.max(0.9, w * 0.16); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.quadraticCurveTo(ec[0], ec[1] + w * (0.32 - 0.12 * load), e1[0], e1[1]); ctx.stroke();
        const bIn = P2((female ? 0.21 : 0.17) - 0.05 * load, ph + sgn * 0.2, 0.2), bOut = P2(0.2, ph + sgn * 0.6, 0.05), bMid = P2(0.25 - 0.02 * load, ph + sgn * 0.4, 0.2);
        ctx.strokeStyle = female ? 'rgba(58,40,30,.55)' : 'rgba(64,44,30,.8)'; ctx.lineWidth = Math.max(0.8, w * (female ? 0.2 : 0.34));
        ctx.beginPath(); ctx.moveTo(bIn[0], bIn[1]); ctx.quadraticCurveTo(bMid[0], bMid[1], bOut[0], bOut[1]); ctx.stroke();
      }
      const nTop = P2(0.04, ph + 0.06, 0.4), nTip = P2(-0.15, ph + 0.05, 1.2), nL = P2(-0.2, ph - 0.1, 0.5), nR = P2(-0.2, ph + 0.1, 0.5);
      ctx.strokeStyle = 'rgba(120,76,52,.28)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(nTop[0], nTop[1]); ctx.quadraticCurveTo(nTip[0] + 1, nTip[1] - 2, nTip[0], nTip[1]); ctx.stroke();
      ctx.fillStyle = 'rgba(120,76,52,.18)'; ctx.beginPath(); ctx.moveTo(nL[0], nL[1]); ctx.quadraticCurveTo(nTip[0], nTip[1] + 3, nR[0], nR[1]); ctx.quadraticCurveTo(nTip[0], nTip[1] + 1, nL[0], nL[1]); ctx.fill();
      // lips: the corners settle as the computed load rises
      const smile = 0.04 - 0.1 * load;
      const mL = P2(-0.43 + smile, ph - 0.24, 0.1), mR = P2(-0.43 + smile, ph + 0.24, 0.1), mT = P2(-0.4, ph, 0.25), mB = P2(-0.5, ph, 0.25);
      ctx.fillStyle = female ? 'rgba(176,92,88,.6)' : 'rgba(160,98,84,.45)';
      ctx.beginPath(); ctx.moveTo(mL[0], mL[1]); ctx.quadraticCurveTo(mT[0], mT[1] - 1.5, mR[0], mR[1]); ctx.quadraticCurveTo(mB[0], mB[1] + 1.5, mL[0], mL[1]); ctx.fill();
      ctx.strokeStyle = 'rgba(110,60,52,.55)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(mL[0], mL[1]); ctx.quadraticCurveTo((mT[0] + mB[0]) / 2, (mT[1] + mB[1]) / 2, mR[0], mR[1]); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // ears
    for (const sgn of [1, -1]) { const ep = headPt(0, sgn > 0 ? 0 : Math.PI, 0.4), n = sub(V(headPt(0, sgn > 0 ? 0 : Math.PI, 1)), V(ep));
      if (norm(n)[2] > 0.2 && !female) { const q = S(V(ep)); ctx.fillStyle = 'rgba(176,128,96,.55)'; ctx.beginPath(); ctx.ellipse(q[0], q[1] + q[3] * 0.4, q[3] * 1.1, q[3] * 2.4, 0, 0, 7); ctx.fill(); } }

    // helpers (hoisted)
    function smooth(R, insertAfter) { // put an interpolated ring between neighbours where asked, for smoother skin
      const out = []; for (let i = 0; i < R.length; i++) { out.push(R[i]); if (i + 1 < R.length && insertAfter[i]) { out.push(lerpRing(R[i], R[i + 1], 1 / 3)); out.push(lerpRing(R[i], R[i + 1], 2 / 3)); } } return out;
    }
    function pushQuad(p, kind, st, c, n) { quads.push({ p, kind, st, c, n }); }
    function blob(c, up, fw, ra, ru, rf, st) { // an ellipsoid: up = long axis
      const U = norm(up), F = ortho(fw, U), A = cross(U, F), rows = [];
      for (let i = 0; i <= 12; i++) { const phi = -Math.PI / 2 + Math.PI * i / 12, row = []; for (let j = 0; j < 20; j++) { const th = j / 20 * Math.PI * 2;
        row.push(add(c, add(mul(U, ru * Math.sin(phi)), mul(add(mul(A, ra * Math.cos(th)), mul(F, rf * Math.sin(th))), Math.cos(phi))))); } rows.push(row); }
      for (let i = 0; i < 12; i++) for (let j = 0; j < 20; j++) { const qq = [rows[i][j], rows[i][(j + 1) % 20], rows[i + 1][(j + 1) % 20], rows[i + 1][j]];
        pushQuad(qq, 'skin', st, c, norm(qq.reduce((a, q) => add(a, norm(sub(q, c))), [0, 0, 0]))); }
    }
    function mesh(R, n, kindOf, capStart, capEnd, biasOf) {
      const b0 = quads.length;
      const pts = R.map(r => ringPts(r, n));
      for (let i = 0; i + 1 < R.length; i++) for (let j = 0; j < n; j++) {
        const j2 = (j + 1) % n, c = mix(R[i].C, R[i + 1].C, 0.5);
        const ax = norm(sub(R[i + 1].C, R[i].C)), rad = (q, C0) => { const d = sub(q, C0); return norm(sub(d, mul(ax, dot(d, ax)))); };
        const nn = norm(add(add(rad(pts[i][j], R[i].C), rad(pts[i][j2], R[i].C)), add(rad(pts[i + 1][j2], R[i + 1].C), rad(pts[i + 1][j], R[i + 1].C))));
        pushQuad([pts[i][j], pts[i][j2], pts[i + 1][j2], pts[i + 1][j]], kindOf(i, j), (R[i].st + R[i + 1].st) / 2, c, nn);
      }
      const cap = (ri, inward) => { const r = R[ri], ax = norm(cross(r.A, r.B)), tip = add(r.C, mul(ax, inward * Math.min(r.a1, r.b1) * 0.55));
        for (let j = 0; j < n; j += 2) { const j2 = (j + 1) % n, j3 = (j + 2) % n; pushQuad([pts[ri][j], pts[ri][j2], pts[ri][j3], tip], kindOf(ri, j), r.st, add(r.C, mul(ax, -inward * 3))); } };
      if (capStart) cap(0, dot(norm(cross(R[0].A, R[0].B)), sub(R[0].C, R[1].C)) > 0 ? 1 : -1);
      if (capEnd) { const l = R.length - 1; cap(l, dot(norm(cross(R[l].A, R[l].B)), sub(R[l].C, R[l - 1].C)) > 0 ? 1 : -1); }
      if (biasOf) { const per = n; for (let qi = b0; qi < quads.length; qi++) { const ri = Math.min(R.length - 1, Math.floor((qi - b0) / per)); quads[qi].bias = biasOf(ri); } }
    }
  }
  root.UMFigure = { draw };
})(typeof window !== 'undefined' ? window : globalThis);
