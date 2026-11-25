// Universe Model: the 3D human tensegrity page (teaching model).
// Physics: sim-core.js (UMSim). The person beside it: sim-figure.js (UMFigure), drawn from the same computed nodes.
// This file draws the tensegrity, handles input (tap to place or select, drag to orbit, pinch or wheel to zoom)
// and runs the imperfection editor. The view is static by default and faces front; "Spin" turns it slowly.
(() => {
  const cv = document.getElementById('body3d'); if (!cv || !window.UMSim) return;
  const cv2 = document.getElementById('body3d-skin');
  const ctx = cv.getContext('2d'), ctx2 = cv2 ? cv2.getContext('2d') : null;
  const $ = id => document.getElementById(id);
  const sim = UMSim.create({ sex: 'male' });
  const C = { N: () => sim.N, E: () => sim.E, I: () => sim.IDX };

  // ---------- names ----------
  const NAMES = { top:'crown of the head', brow:'brow', chin:'chin', occ:'base of the skull', ear:'side of the head', c1:'top of the neck', c7:'base of the neck',
    t6:'mid back', t12:'upper lower back', l3:'lower back (spine)', s1:'sacrum', coccyx:'tailbone', stTop:'top of the breastbone', xiph:'base of the breastbone',
    pubis:'pubic bone', navel:'navel', throat:'throat', diaphragm:'diaphragm', tlf:'thoracolumbar fascia', scm:'side of the neck (front)', neckSide:'side of the neck',
    acrom:'shoulder', scapInf:'shoulder blade', ribUp:'upper ribs', ribLow:'lower ribs', elbow:'elbow', wrist:'wrist', hand:'hand', pec:'chest', lat:'side of the back',
    abd:'abdomen', trunk:'waist', erector:'back muscles', erectorLow:'lower back muscles', psoas:'deep hip flexor (psoas)', tlfRaphe:'lower back, side', asis:'front of the pelvis',
    crest:'top of the pelvis', hip:'hip joint', troch:'outer hip', isch:'sitting bone', glute:'buttock', thighF:'front of the thigh', thighB:'back of the thigh',
    thighL:'outer thigh', thighI:'inner thigh', knee:'knee', kneeF:'kneecap', kneeLat:'outer knee', kneeMed:'inner knee', tibTub:'top of the shin', calfB:'calf',
    shinF:'shin', calfL:'outer calf', calfI:'inner calf', ankle:'ankle', heel:'heel', ball:'ball of the foot', toe:'toes',
    c3:'upper neck', c5:'lower neck', t2:'upper back (spine)', t4:'upper back (spine)', t8:'mid back (spine)', t10:'mid back (spine)', l1:'lower back (spine)', l2:'lower back (spine)', l4:'lower back (spine)',
    ribA:'first ribs', ribB:'upper ribs', ribC:'middle ribs', ribF:'floating ribs', stMid:'breastbone', sacA:'front of the sacrum', sacMid:'back of the sacrum', si:'sacroiliac joint',
    psis:'back of the pelvis', femMid:'thigh bone', condB:'back of the knee', fibHead:'head of the fibula', malMed:'inner ankle', malLat:'outer ankle', subF:'ankle bone', subB:'ankle bone',
    ballLat:'outer ball of the foot', ballMed:'inner ball of the foot', gh:'shoulder joint', scapMed:'top of the shoulder blade', delt:'upper arm', deltUp:'top of the upper arm', elbowMed:'inner elbow', elbowLat:'outer elbow',
    olec:'point of the elbow', wristU:'wrist (little finger side)', wristR:'wrist (thumb side)' };
  const segName = b => { const m = b.match(/^(ce|th|lu)\d([pa])$/); return m ? `${{ ce: 'neck', th: 'upper back', lu: 'lower back' }[m[1]]} ${m[2] === 'p' ? '(beside the spine)' : '(front of the spine)'}` : null; };
  const pretty = i => { const n = sim.N[i]; return (NAMES[n.base] || segName(n.base) || n.base) + (n.side ? (n.side > 0 ? ' (left)' : ' (right)') : ''); };
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

  // ---------- view ----------
  let W = 0, H = 0, yaw = 0, pitch = -0.04, zoom = 1, spin = false, showBones = true, showWeb = true, heat = false, showSkin = true, strainTint = true;
  let CY = 0, BOT = 12, dirty = true, lineOn = {};
  const cam = [0, 0]; // the view follows a body that has fallen, so it stays in the frame
  function size() {
    const dpr = Math.min(2, devicePixelRatio || 1), r = cv.getBoundingClientRect(); W = r.width; H = r.height;
    for (const [c, x] of [[cv, ctx], [cv2, ctx2]]) if (c) { c.width = W * dpr; c.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0); }
    const st = $('sim3d-status'); BOT = st && getComputedStyle(st).position === 'absolute' ? 70 : 12; CY = (52 + H - BOT) / 2; dirty = true;
  }
  new ResizeObserver(size).observe(cv); size();
  const scale = () => Math.min(W / 92, (H - 64 - BOT) / 196) * zoom;
  function view(p) { // world -> view space (x right, y up, z toward the viewer)
    let x = p[0] - cam[0], y = p[1] - sim.HEIGHT / 2, z = p[2] - cam[1];
    let c = Math.cos(yaw), s = Math.sin(yaw); [x, z] = [x * c + z * s, -x * s + z * c];
    c = Math.cos(pitch); s = Math.sin(pitch); [y, z] = [y * c - z * s, y * s + z * c];
    return [x, y, z];
  }
  function screen(v) { const f = 520 / (520 - v[2]), sc = scale(); return [W / 2 + v[0] * f * sc, CY - v[1] * f * sc, v[2], f * sc]; }
  const proj = p => screen(view(p));
  const lerpc = (a, b, t) => a.map((v, k) => Math.round(v + (b[k] - v) * t));
  const heatCol = t => { t = Math.max(0, Math.min(1, t)); const c = t < 0.5 ? lerpc([91, 155, 230], [240, 169, 64], t * 2) : lerpc([240, 169, 64], [217, 59, 59], (t - 0.5) * 2); return `rgb(${c})`; };
  const LCOL = Object.fromEntries(UMSim.LINES.map(L => [L.id, L.color]));

  // ---------- state ----------
  let hoverE = -1, mode = 'point', strength = 3, sel = null, linePick = null, origin = null, metrics = null, nodeStrain = null, lastChange = performance.now();
  const changed = () => { lastChange = performance.now(); dirty = true; };

  // ---------- drawing: tensegrity ----------
  function drawTensegrity() {
    const P = sim.P, E = sim.E, N = sim.N, I = sim.IDX;
    ctx.clearRect(0, 0, W, H);
    const Q = P.map(proj);
    ctx.strokeStyle = '#D6E1EE'; ctx.lineWidth = 1;
    ctx.beginPath(); for (let a = 0; a <= 64; a++) { const t = a / 64 * Math.PI * 2, q = proj([Math.cos(t) * 40, 0, Math.sin(t) * 40]); a ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke();
    if (showSkin) {
      const g = n => Q[I[n]];
      ctx.fillStyle = 'rgba(91,155,230,.10)'; ctx.strokeStyle = 'rgba(91,155,230,.12)'; ctx.lineCap = 'round';
      ctx.beginPath(); ['acromL','ribUpL','ribLowL','crestL','trochL','trochR','crestR','ribLowR','ribUpR','acromR'].forEach((n, k) => { const q = g(n); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.fill();
      const caps = [['c1','c7',11],['c7','t6',26],['t6','t12',27],['t12','s1',26],['hipL','hipR',22],
        ['hipL','kneeL',15],['hipR','kneeR',15],['kneeL','ankleL',10],['kneeR','ankleR',10],['heelL','toeL',8],['heelR','toeR',8],
        ['acromL','elbowL',9],['acromR','elbowR',9],['elbowL','wristL',7],['elbowR','wristR',7],['wristL','handL',6],['wristR','handR',6]];
      for (const [a, b, w] of caps) { const qa = g(a), qb = g(b); ctx.lineWidth = w * (qa[3] + qb[3]) / 2; ctx.beginPath(); ctx.moveTo(qa[0], qa[1]); ctx.lineTo(qb[0], qb[1]); ctx.stroke(); }
    }
    // imperfection zones
    for (const im of sim.imps) drawZone(ctx, im, im === sel);
    // ribs, the processes of the vertebrae and the kneecaps: drawn from the computed points of each bone
    if (showBones) { const g = n => P[I[n]], mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t), mid = (a, b) => mix(a, b, 0.5);
      ctx.lineCap = 'round';
      const bone = (a, b, wd, soft) => { const q0 = proj(a), q1 = proj(b), w = wd * (q0[3] + q1[3]) / 2; for (const [col, x] of [[soft ? 'rgba(120,140,165,.5)' : 'rgba(107,91,62,.6)', w + 1.6], [soft ? 'rgba(214,226,238,.95)' : 'rgba(233,223,200,.97)', w]]) { ctx.strokeStyle = col; ctx.lineWidth = x; ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.stroke(); } };
      const th = sim.bones.filter(b => b.def.seg === 't'), front = { ribA: ['stTop', 'stTop', 0], ribB: ['stTop', 'stMid', 0.5], ribUp: ['stMid', 'stMid', 0], ribC: ['stMid', 'xiph', 0.5], ribLow: ['xiph', 'xiph', 0] };
      const ribAt = (b, s) => { const [up, lo, pL, pR] = b.ids, rb = b.def.rib, f = front[rb]; const back = mid(P[up], P[lo]), lat = g(rb + s), tip = P[s === 'L' ? pL : pR];
        return { back: mix(back, tip, 0.45), lat, fr: f ? mix(g(f[0]), g(f[1]), f[2]) : null, broken: sim.E.some(e => e.broken && e.bone === b.uid && (e.a === I[rb + s] || e.b === I[rb + s])) }; };
      for (const s of ['L', 'R']) th.forEach((b, i) => { const r0 = ribAt(b, s), r1 = th[i + 1] ? ribAt(th[i + 1], s) : null;
        for (const t of r1 ? [0, 0.5] : [0]) { const bk = t ? mix(r0.back, r1.back, t) : r0.back, lat = t ? mix(r0.lat, r1.lat, t) : r0.lat, fr = r0.fr && (!t || r1.fr) ? (t ? mix(r0.fr, r1.fr, t) : r0.fr) : null;
          // a rib runs from the spine round the side; its front part is cartilage to the breastbone. Floating ribs stop at the side.
          const end = fr ? mix(lat, fr, 0.45) : lat, ctl = [0, 1, 2].map(k => 2 * lat[k] - (bk[k] + end[k]) / 2 + (fr ? 0 : (lat[k] - bk[k]) * -0.35)), q0 = proj(bk), q1 = proj(fr ? ctl : mix(bk, lat, 0.6).map((v, k) => v + (k === 0 ? (s === 'L' ? 1.5 : -1.5) : 0))), q2 = proj(end);
          for (const [col, wd] of [['rgba(107,91,62,.55)', 3.2], ['rgba(233,223,200,.95)', 1.9]]) { ctx.strokeStyle = col; ctx.lineWidth = wd * q0[3] / 3.2; ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.quadraticCurveTo(q1[0], q1[1], q2[0], q2[1]); ctx.stroke(); }
          if (fr) bone(end, fr, 0.42, true); } });
      for (const b of sim.bones) if (b.def.seg) { const [up, lo, pL, pR] = b.ids, m = mid(P[up], P[lo]); bone(m, P[pL], 0.32); bone(m, P[pR], 0.32); }
      for (const s of ['L', 'R']) { const q = proj(g('kneeF' + s)), r = 2.1 * q[3]; ctx.fillStyle = 'rgba(233,223,200,.97)'; ctx.strokeStyle = 'rgba(92,77,51,.8)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(q[0], q[1], r * 0.85, r, 0, 0, 7); ctx.fill(); ctx.stroke(); } }
    const order = E.map((e, k) => [k, (Q[e.a][2] + Q[e.b][2]) / 2]).sort((u, v) => u[1] - v[1]);
    ctx.lineCap = 'round';
    for (const [k] of order) {
      const e = E[k], qa = Q[e.a], qb = Q[e.b], depth = 0.55 + 0.45 * Math.min(1, Math.max(0, ((qa[2] + qb[2]) / 2 + 30) / 60));
      if (e.cut && e.broken && showBones && e.show && !e.cart) { // a broken bone: two fragments, each still on its own end, with a jagged gap where it snapped
        const t = e.breakT ?? 0.5, dx = qb[0] - qa[0], dy = qb[1] - qa[1], d = Math.hypot(dx, dy) || 1, L = e.L0 * (qa[3] + qb[3]) / 2;
        const la = Math.min(d * t, L * t) - 2, lb = Math.min(d * (1 - t), L * (1 - t)) - 2, ux = dx / d, uy = dy / d, wd = 0.85 * e.show * (qa[3] + qb[3]) / 2 + 1;
        ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.lineCap = 'butt';
        for (const [x0, y0, x1, y1] of [[qa[0], qa[1], qa[0] + ux * la, qa[1] + uy * la], [qb[0], qb[1], qb[0] - ux * lb, qb[1] - uy * lb]]) {
          ctx.strokeStyle = '#5C4D33'; ctx.lineWidth = wd + 2.2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          ctx.strokeStyle = '#EDE4CF'; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          ctx.strokeStyle = '#D33A45'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x1 - uy * (wd / 2 + 2), y1 + ux * (wd / 2 + 2)); ctx.lineTo(x1 + ux * 2, y1 + uy * 2); ctx.lineTo(x1 + uy * (wd / 2 + 2), y1 - ux * (wd / 2 + 2)); ctx.stroke();
        }
        ctx.lineCap = 'round'; continue; }
      if (e.cut) continue;
      if (e.strut) { if (!showBones || !e.show || e.cart) continue; // only the bone itself is drawn: the links that keep a bone rigid, ligaments and contact are not
        ctx.setLineDash([]); ctx.globalAlpha = Math.max(0.8, depth); const wd = 0.85 * e.show * (qa[3] + qb[3]) / 2 + 1;
        // bone: a pale shaft with a dark outline
        ctx.strokeStyle = k === hoverE ? '#D33A45' : '#5C4D33'; ctx.lineWidth = wd + 2; ctx.beginPath(); ctx.moveTo(qa[0], qa[1]); ctx.lineTo(qb[0], qb[1]); ctx.stroke();
        ctx.strokeStyle = '#EDE4CF'; ctx.lineWidth = wd; }
      else {
        const cs = sim.cableState(k), onLine = [...e.lines].find(l => lineOn[l]);
        const marked = cs.dense > 0.004 || cs.longer;
        if (!onLine && !showWeb && !marked && k !== hoverE) continue;
        ctx.globalAlpha = depth * (onLine || marked ? 1 : 0.5);
        if (e.released) { ctx.setLineDash([2, 5]); ctx.strokeStyle = '#C9A0A4'; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.9; }
        else if (cs.slack && heat) { ctx.setLineDash([3, 4]); ctx.strokeStyle = '#B9C6D6'; ctx.lineWidth = 1; }
        else {
          ctx.setLineDash(cs.longer && !heat ? [6, 3] : []);
          const t = heat ? Math.min(1, Math.max(0, cs.strain / 0.08)) : 0;
          ctx.strokeStyle = heat ? heatCol(t) : cs.dense > 0.004 ? heatCol(0.55 + cs.dense * 2.4) : cs.longer ? '#E0861A' : onLine ? LCOL[onLine] : '#9CC3F0';
          ctx.lineWidth = marked ? 2.2 + 12 * Math.min(0.3, cs.dense) : onLine ? 2.2 : 1.05;
        }
      }
      if (k === hoverE && !e.strut) { ctx.setLineDash([]); ctx.strokeStyle = '#D33A45'; ctx.lineWidth = 3.4; ctx.globalAlpha = 1; }
      ctx.beginPath(); ctx.moveTo(qa[0], qa[1]); ctx.lineTo(qb[0], qb[1]); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    if (showBones) { const c = Q[I.occ], b = Q[I.brow], t = Q[I.top], ch = Q[I.chin];
      const eL = Q[I.earL], eR = Q[I.earR], sc = (t[3] + ch[3]) / 2;
      const cx = (c[0] + b[0] + eL[0] + eR[0]) / 4, cy = (t[1] + ch[1]) / 2, rx = Math.max(Math.hypot(eL[0] - eR[0], eL[1] - eR[1]) / 2 + 1.2 * sc, Math.hypot(c[0] - b[0], c[1] - b[1]) / 2 + 0.6 * sc), ry = Math.abs(ch[1] - t[1]) / 2 + 0.8 * sc;
      const tiltA = Math.atan2(t[0] - ch[0], ch[1] - t[1]);
      ctx.fillStyle = 'rgba(237,228,207,.6)'; ctx.strokeStyle = 'rgba(92,77,51,.75)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, tiltA, 0, 7); ctx.fill(); ctx.stroke(); }
    const inZone = new Set(); sim.imps.forEach(im => im._zone && im._zone.nw.forEach((w, j) => { if (w > 0.5) inZone.add(j); }));
    const joints = mode === 'torque' ? new Set(TORQUE_NODES.map(n => I[n])) : null;
    for (let i = 0; i < N.length; i++) { const q = Q[i], hot = inZone.has(i), picked = linePick === i, jt = joints && joints.has(i);
      if (!hot && !picked && !jt && (N[i].soft || N[i].rb.length < 2 || !showBones)) continue; // a blue dot is a joint: a point two bones share
      ctx.fillStyle = picked ? '#F0A940' : hot ? '#D93B3B' : jt ? '#E0861A' : '#1D5FD1';
      ctx.beginPath(); ctx.arc(q[0], q[1], (hot || picked || jt ? 3.4 : 1.9) * Math.max(1, q[3] / 3.2), 0, 7); ctx.fill(); }
  }
  function drawZone(c, im, on) {
    const z = im._zone; if (!z) return;
    c.save(); c.setLineDash(on ? [] : [4, 4]); c.lineWidth = on ? 2 : 1.2;
    c.strokeStyle = on ? 'rgba(217,59,59,.85)' : 'rgba(217,59,59,.45)'; c.fillStyle = on ? 'rgba(217,59,59,.07)' : 'rgba(217,59,59,.04)';
    const ctr = im.type === 'torque' ? z.c : z.c;
    if (im.type === 'point' || im.type === 'plane') {
      const n = im.type === 'plane' ? im.normal : view_inv_normal(), u = UMSim.v3.norm(Math.abs(n[1]) < 0.9 ? UMSim.v3.cross(n, [0, 1, 0]) : UMSim.v3.cross(n, [1, 0, 0])), w = UMSim.v3.cross(n, u);
      const r = im.radius * (1 + Math.min(0.6, 0.025 * (im.age || 0)));
      c.beginPath(); for (let a = 0; a <= 40; a++) { const t = a / 40 * Math.PI * 2, p = [0, 1, 2].map(k => sim.O[im.node][k] + (u[k] * Math.cos(t) + w[k] * Math.sin(t)) * r), q = proj(p); a ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }
      c.closePath(); c.fill(); c.stroke();
    } else if (im.type === 'torque') {
      const J = UMSim.JOINTS[im.joint], s = im.side || 'L', I = sim.IDX, nm = t => I[t.replace(/X$/, s)] ?? I[t];
      const p0 = sim.P[nm(J.pivot)], p1 = sim.P[nm(J.to)], ax = UMSim.v3.norm(UMSim.v3.sub(p1, p0)), cc = UMSim.v3.add(p0, UMSim.v3.mul(ax, 6));
      const u = UMSim.v3.norm(UMSim.v3.cross(ax, [0, 0, 1])), w = UMSim.v3.cross(ax, u), r = im.joint === 'trunk' ? 16 : im.joint === 'neck' ? 9 : 9, sweep = Math.max(0.6, Math.abs(im.angle) / 30 * 5);
      c.setLineDash([]); c.strokeStyle = on ? 'rgba(224,134,26,.95)' : 'rgba(224,134,26,.6)'; c.lineWidth = on ? 2.4 : 1.6;
      c.beginPath(); let last, prev; for (let a = 0; a <= 30; a++) { const t = -sweep / 2 + sweep * a / 30, p = [0, 1, 2].map(k => cc[k] + (u[k] * Math.cos(t) + w[k] * Math.sin(t)) * r), q = proj(p); prev = last; last = q; a ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); } c.stroke();
      if (prev) { const dx = last[0] - prev[0], dy = last[1] - prev[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l; c.fillStyle = c.strokeStyle;
        c.beginPath(); c.moveTo(last[0] + ux * 7, last[1] + uy * 7); c.lineTo(last[0] - uy * 5, last[1] + ux * 5); c.lineTo(last[0] + uy * 5, last[1] - ux * 5); c.closePath(); c.fill(); }
      void ctr;
    }
    c.restore();
  }
  function view_inv_normal() { // world direction pointing at the viewer
    const cy = Math.cos(yaw), sy = Math.sin(yaw); return [-sy, 0, cy]; }

  // ---------- drawing: the person ----------
  function drawPerson() {
    if (!ctx2) return;
    ctx2.clearRect(0, 0, W, H);
    UMFigure.draw(ctx2, { P: sim.P, ref: sim.base.P, IDX: sim.IDX, sex: sim.sex, view, screen, load: metrics ? metrics.load : 0, nodeStrain, strainTint });
    for (const im of sim.imps) if (im === sel) drawZone(ctx2, im, true);
  }

  // ---------- loop ----------
  let lastM = 0, frames = 0;
  function frame(now) {
    if (spin && !dragging) { yaw += 0.004; dirty = true; }
    const active = sim.moving > 2e-4 || sim.creep && sim.imps.length || now - lastChange < 1500;
    if (active) { sim.step(); dirty = true; } // one step is 1/60 of a second of real time
    { let tx = 0, tz = 0; if (sim.damaged) { const P = sim.P; for (const p of P) { tx += p[0]; tz += p[2]; } tx /= P.length; tz /= P.length; }
      const dx = tx - cam[0], dz = tz - cam[1]; if (Math.abs(dx) + Math.abs(dz) > 0.02) { cam[0] += dx * 0.06; cam[1] += dz * 0.06; dirty = true; } }
    if (now - lastM > 250 && (active || !metrics)) { lastM = now; metrics = sim.metrics(origin); nodeStrain = sim.skinStrain ? sim.skinStrain() : sim.nodeStrain(); readout(); }
    if (dirty) { drawTensegrity(); drawPerson(); dirty = false; frames++; }
    requestAnimationFrame(frame);
  }

  // ---------- readouts ----------
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  const cm = v => (Math.abs(v) < 0.05 ? '0.0' : (v > 0 ? '+' : '') + v.toFixed(1)) + ' cm';
  const deg = v => Math.abs(v) < 0.1 ? '0°' : Math.abs(v).toFixed(1) + '°';
  function readout() {
    const m = metrics; if (!m) return;
    set('m-height', cm(m.height)); set('m-head', cm(m.head));
    set('m-shoulders', Math.abs(m.shoulders) < 0.05 ? 'level' : `${Math.abs(m.shoulders).toFixed(1)} cm, ${m.shoulders > 0 ? 'left' : 'right'} higher`);
    set('m-pelvis', Math.abs(m.pelvis) < 0.05 ? 'level' : `${Math.abs(m.pelvis).toFixed(1)} cm, ${m.pelvis > 0 ? 'left' : 'right'} higher`);
    set('m-tilt', Math.abs(m.pelvicTilt) < 0.1 ? '0°' : `${deg(m.pelvicTilt)} ${m.pelvicTilt < 0 ? 'forward' : 'back'}`);
    set('m-twist', Math.abs(m.trunkTwist) < 0.1 ? 'none' : `${deg(m.trunkTwist)} to the ${m.trunkTwist > 0 ? 'left' : 'right'}`);
    const kn = v => Math.abs(v) < 0.2 ? 'ahead' : `${deg(v)} ${v > 0 ? 'in' : 'out'}`;
    set('m-knees', `L ${kn(m.kneeL)}, R ${kn(m.kneeR)}`);
    set('m-sym', m.asym < 0.05 ? 'symmetric' : m.asym.toFixed(1) + ' cm off');
    set('m-extra', m.extra < 0.005 ? 'none' : '+' + Math.round(m.extra * 100) + '%');
    set('m-far', origin ? m.far.toFixed(1) + ' cm' : 'none'); set('m-slack', m.slack ? m.slack + ' cables' : 'none');
    set('m-time', sim.creep ? `${Math.floor(sim.months)} months` : 'paused');
    const bar = $('sim-load'); if (bar) bar.style.width = Math.round(m.load * 100) + '%';
    set('sim-load-v', m.load < 0.03 ? 'at rest' : m.load < 0.3 ? 'mild' : m.load < 0.6 ? 'moderate' : m.load < 0.85 ? 'high' : 'very high');
  }
  const statusEl = $('sim3d-status'); const status = t => { if (statusEl) statusEl.textContent = t; };

  // ---------- placing imperfections ----------
  const TORQUE_NODES = ['hipL', 'hipR', 'kneeL', 'kneeR', 'l3', 'c7'];
  const torqueAt = n => { const nm = sim.N[n].name; if (/^hip/.test(nm)) return { joint: 'hip', side: nm.slice(-1) }; if (/^knee/.test(nm)) return { joint: 'knee', side: nm.slice(-1) };
    if (nm === 'l3') return { joint: 'trunk' }; if (nm === 'c7') return { joint: 'neck' }; return null; };
  const defaults = () => ({ density: +(1 + 0.35 * strength).toFixed(2), friction: 2, mass: 1, volume: 1 });
  function place(i) {
    if (!origin) origin = [...sim.O[i]];
    const existing = sim.imps.find(im => im.node === i && im.type === mode);
    if (mode === 'torque') {
      let best = -1, bd = 1e9; TORQUE_NODES.forEach(n => { const j = sim.IDX[n], d = UMSim.v3.dist(sim.O[j], sim.O[i]); if (d < bd) { bd = d; best = j; } });
      const t = torqueAt(best); const ex = sim.imps.find(im => im.type === 'torque' && im.joint === t.joint && (im.side || '') === (t.side || ''));
      if (ex) { select(ex); status(`Twist at the ${UMSim.JOINTS[ex.joint].label}${ex.side ? (ex.side === 'L' ? ' (left)' : ' (right)') : ''} selected: change it below.`); return; }
      const im = sim.add(Object.assign({ type: 'torque', node: best, angle: 5 * strength }, t));
      origin = [...sim.O[best]]; select(im); changed();
      status(`Twist at the ${UMSim.JOINTS[im.joint].label}${im.side ? (im.side === 'L' ? ' (left)' : ' (right)') : ''}: the tissue crossing it was remodeled to a ${im.angle}° ${UMSim.JOINTS[im.joint].pos} turn. The physics decides how much of it the body takes up.`);
      return;
    }
    if (existing && mode !== 'line') { sim.update(existing, { density: Math.min(4, +(existing.density + 0.5).toFixed(2)) }); select(existing); changed();
      status(`Imperfection at the ${pretty(i)} strengthened: density ×${existing.density.toFixed(1)}.`); return; }
    if (mode === 'point') { const im = sim.add(Object.assign({ type: 'point', node: i, radius: 9 }, defaults())); select(im); changed();
      status(`Point of imperfection at the ${pretty(i)}: tissue densified and held there. Adjust it below, or tap it again to strengthen it.`); }
    else if (mode === 'plane') { const im = sim.add(Object.assign({ type: 'plane', node: i, radius: 15, normal: view_inv_normal() }, defaults())); select(im); changed();
      status(`Plane of imperfection across the ${pretty(i)}: a sheet of fascia facing you densified.`); }
    else { if (linePick === null) { linePick = i; dirty = true; status(`Line of imperfection from the ${pretty(i)}: now tap the second point.`); return; }
      const a = linePick; linePick = null; const edges = sim.path(a, i); if (!edges.length) { status('Those two points are the same: tap two different points.'); return; }
      const im = sim.add(Object.assign({ type: 'line', node: a, end: i, edges, radius: 2 }, defaults())); select(im); changed();
      status(`Line of imperfection from the ${pretty(a)} to the ${pretty(i)}.`); }
  }

  // ---------- editor ----------
  const ed = $('sim-editor');
  const FIELDS = [
    ['density', 'Density', 1, 4, 0.05, v => '×' + v.toFixed(2), 'How densified the tissue is. Shortens the connective tissue in the zone by 11% per unit and stiffens it in proportion.'],
    ['friction', 'Friction', 1, 10, 0.1, v => '×' + v.toFixed(1), 'How much the zone resists connective tissue sliding through it. Higher friction keeps tension from spreading along the lines and damps motion there.'],
    ['mass', 'Mass', 0.5, 4, 0.05, v => '×' + v.toFixed(2), 'Relative mass of the zone. Added mass is extra weight under gravity that the web must hold up.'],
    ['volume', 'Volume', 0.5, 2.5, 0.05, v => '×' + v.toFixed(2), 'Relative volume. Above 1 the zone acts as a spacer that pushes outward (swelling, a mass); below 1 it pulls inward.'],
    ['radius', 'Boundary radius', 2, 25, 0.5, v => v.toFixed(1) + ' cm', 'The local zone. Cables inside it take the full change, fading to none at the boundary. With time passing, the change also creeps along the fascial lines that leave it.'],
    ['angle', 'Twist', -30, 30, 1, v => v === 0 ? '0°' : Math.abs(v) + '°', 'How far the tissue crossing this joint was remodeled toward a turn. Positive is inward (hips and knees) or to the left (trunk and neck).']
  ];
  function select(im) { sel = im; renderEditor(); dirty = true; }
  function label(im) {
    if (im.type === 'torque') { const J = UMSim.JOINTS[im.joint]; return `Twist: ${J.label}${im.side ? (im.side === 'L' ? ', left' : ', right') : ''}`; }
    if (im.type === 'set') return 'Scenario: ' + (im.label || 'tissue set');
    if (im.type === 'line') return `Line: ${pretty(im.node)} to ${pretty(im.end)}`;
    return `${im.type === 'plane' ? 'Plane' : 'Point'}: ${pretty(im.node)}`;
  }
  function renderEditor() {
    const list = $('sim-implist');
    if (list) list.innerHTML = sim.imps.length ? sim.imps.map((im, k) => `<button type="button" class="chipbtn${im === sel ? ' on' : ''}" data-imp="${k}">${label(im)}</button>`).join('') : '<span class="muted small">None yet. Tap the body to add one.</span>';
    list && list.querySelectorAll('[data-imp]').forEach(b => b.addEventListener('click', () => select(sim.imps[+b.dataset.imp])));
    if (!ed) return;
    if (!sel || !sim.imps.includes(sel)) { ed.hidden = true; sel = null; return; }
    ed.hidden = false;
    const im = sel, fields = im.type === 'torque' ? ['angle'] : im.type === 'set' ? ['density', 'friction', 'mass', 'volume'] : ['density', 'friction', 'mass', 'volume', 'radius'];
    $('sim-ed-title').textContent = label(im);
    $('sim-ed-fields').innerHTML = FIELDS.filter(f => fields.includes(f[0])).map(([key, name, lo, hi, st, fmt, help]) =>
      `<label class="edf" title="${help}"><span class="edn">${name} <b id="edv-${key}">${fmt(+im[key])}</b></span><input type="range" min="${lo}" max="${hi}" step="${st}" value="${im[key]}" data-ed="${key}" aria-label="${name}"><small>${help}</small></label>`).join('');
    $('sim-ed-fields').querySelectorAll('[data-ed]').forEach(inp => inp.addEventListener('input', () => {
      const key = inp.dataset.ed, f = FIELDS.find(x => x[0] === key); sim.update(im, { [key]: +inp.value }); $('edv-' + key).textContent = f[5](+inp.value);
      if (key === 'angle') $('edv-angle').textContent += +inp.value ? ' ' + (+inp.value > 0 ? UMSim.JOINTS[im.joint].pos : UMSim.JOINTS[im.joint].neg) : '';
      changed(); }));
    if (im.type === 'torque') { const v = +im.angle; $('edv-angle').textContent = (v === 0 ? '0°' : Math.abs(v) + '° ' + (v > 0 ? UMSim.JOINTS[im.joint].pos : UMSim.JOINTS[im.joint].neg)); }
  }
  $('sim-ed-remove') && $('sim-ed-remove').addEventListener('click', () => { if (sel) { sim.remove(sel); sel = null; renderEditor(); changed(); status('Imperfection removed. The physics finds the new balance.'); } });
  $('sim-ed-done') && $('sim-ed-done').addEventListener('click', () => { sel = null; renderEditor(); });

  // ---------- input: tap to place or select, drag to orbit, pinch or wheel to zoom ----------
  let dragging = false, lx = 0, ly = 0, moved = 0; const ptrs = new Map(); let pinch0 = 0, zoom0 = 1;
  function nearestEdge(c, cx, cy, strut) { const r = c.getBoundingClientRect(), mx = cx - r.left, my = cy - r.top, Q = sim.P.map(proj); let best = -1, bd = 12;
    sim.E.forEach((e, k) => { if (e.cut || e.released || !!e.strut !== strut) return; if (strut ? (!e.show || e.cart || e.lig) : (sim.FIXED.has(e.a) && sim.FIXED.has(e.b))) return;
      const a = Q[e.a], b = Q[e.b], ux = b[0] - a[0], uy = b[1] - a[1], l2 = ux * ux + uy * uy || 1, t = Math.max(0, Math.min(1, ((mx - a[0]) * ux + (my - a[1]) * uy) / l2));
      const d = Math.hypot(a[0] + t * ux - mx, a[1] + t * uy - my) - (a[2] + b[2]) * 0.01; if (d < bd) { bd = d; best = k; } }); return best; }
  const isTool = () => mode === 'cut' || mode === 'break' || mode === 'pluck';
  function operate(c, e) {
    if (mode === 'pluck') { const i = nearest(c, e.clientX, e.clientY); if (i >= 0 && !sim.FIXED.has(i)) { sim.pluck(i, 6); changed(); status(`Plucked the ${pretty(i)}: watch the pulse travel through the web and settle.`); } return; }
    if (mode === 'break') { // the skull has no shaft to tap: a tap on the head crushes it
      const r = c.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, hd = ['top', 'brow', 'chin', 'occ', 'earL', 'earR'].map(n => proj(sim.P[sim.IDX[n]]));
      const cx = hd.reduce((s, q) => s + q[0], 0) / hd.length, cy = hd.reduce((s, q) => s + q[1], 0) / hd.length, rad = Math.max(...hd.map(q => Math.hypot(q[0] - cx, q[1] - cy)));
      if (Math.hypot(mx - cx, my - cy) < rad) { const T = sim.IDX.top, Cn = sim.IDX.chin, ks = sim.E.findIndex(f => f.strut && !f.cut && f.bone === 'skull' && ((f.a === T && f.b === Cn) || (f.a === Cn && f.b === T)));
        if (ks >= 0 && sim.breakBone(ks, 0.5)) { hoverE = -1; changed(); status('Skull crushed. Every connective tissue line that runs to the head, front, back and sides, has lost its top anchor and let go along its whole length (dotted). Nothing is left to hold the column up. Press Reset to healthy to heal.'); }
        return; } }
    const k = nearestEdge(c, e.clientX, e.clientY, mode === 'break'); if (k < 0) return;
    const ed = sim.E[k];
    if (mode === 'break') {
      // where along the bone the tap landed
      const r = c.getBoundingClientRect(), Q = sim.P.map(proj), a = Q[ed.a], b = Q[ed.b], dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0.15, Math.min(0.85, ((e.clientX - r.left - a[0]) * dx + (e.clientY - r.top - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      const B = sim.boneOf(k), n = sim.breakBone(k, t); hoverE = -1;
      if (!n) { status(`The ${B ? B.def.name : 'bone'} is one fixed piece in this model and cannot be broken. Try a long bone, a vertebra, a rib-bearing segment or the collarbone.`); return; }
      changed();
      status(`${cap(B.name)} broken where you tapped. Its two ends are no longer one piece, and the muscle around it can no longer brace against it. ` + (B.def.seg ? 'The column of the spine is interrupted here: what is above now hangs on the connective tissue.' : /femur|tibia/.test(B.def.id) ? 'This bone carried the body to the ground. Watch whether the connective tissue and the other leg can hold the weight.' : 'Watch what it was holding.'));
      return; }
    sim.cut(k); hoverE = -1; changed();
    const L = sim.lastCut || {}, sd = s => s === 'L' ? 'left' : s === 'R' ? 'right' : '', n = (L.released || 0) + 1;
    const REG = { leg1: 'left leg', 'leg-1': 'right leg', coreUpL: 'left side of the chest, the shoulder and the arm', coreUpR: 'right side of the chest, the shoulder and the arm', coreLowL: 'left side of the belly and lower back', coreLowR: 'right side of the belly and lower back', coreC: 'midline of the trunk' };
    status(`Cut between the ${pretty(ed.a)} and the ${pretty(ed.b)}. ` + (L.kind === 'line' ? `That cord is part of the ${(L.names || [L.name]).map(s => s.toLowerCase()).join(' and the ')}${L.side === 'both' ? ', where both sides share it' : ' on the ' + sd(L.side) + ' side'}${(L.names || []).length > 1 ? ', which share fibers here, so both let go' : ''}. A connective tissue system is one continuous band, so a cut anywhere lets all of it go: ${n} stretches, from one end of the body to the other (dotted). Watch what it was holding, also far from the cut.`
      : L.kind === 'deep' ? `That was one of the deep guys of the spine${L.side === 'C' ? ', on the midline' : ', ' + sd(L.side) + ' side'}. They work as one system from the skull to the pelvis, so all ${n} have let go (dotted), and the guys on the other side now pull the column their way.`
      : `That was a strand of the general connective tissue web of the ${REG[L.region] || 'body'}. The web of a region is one sheet: all ${n} strands of it have let go (dotted). What it wrapped now hangs on the lines alone.`));
  }
  const setCursor = () => { for (const c of [cv, cv2].filter(Boolean)) { c.classList.remove('cur-point', 'cur-cut', 'cur-strut', 'cur-pluck'); c.classList.add(mode === 'cut' ? 'cur-cut' : mode === 'break' ? 'cur-strut' : mode === 'pluck' ? 'cur-pluck' : 'cur-point'); } };
  setCursor();
  function nearest(c, cx, cy) { const r = c.getBoundingClientRect(), mx = cx - r.left, my = cy - r.top; let best = -1, bd = 26;
    sim.P.forEach((p, i) => { const q = proj(p), d = Math.hypot(q[0] - mx, q[1] - my) - q[2] * 0.35; if (d < bd) { bd = d; best = i; } }); return best; }
  for (const c of [cv, cv2].filter(Boolean)) {
    c.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, [e.clientX, e.clientY]); try { c.setPointerCapture(e.pointerId); } catch (_) {}
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); zoom0 = zoom; }
      dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; });
    c.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) { if (e.pointerType === 'mouse' && (mode === 'cut' || mode === 'break') && c === cv) { const k = nearestEdge(c, e.clientX, e.clientY, mode === 'break'); if (k !== hoverE) { hoverE = k; dirty = true; } } return; }
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; zoom = Math.min(2.6, Math.max(0.6, zoom0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / (pinch0 || 1))); moved = 99; dirty = true; return; }
      const dx = e.clientX - lx, dy = e.clientY - ly; moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 6) { yaw += dx * 0.01; pitch = Math.max(-1.2, Math.min(1.2, pitch + dy * 0.006)); dirty = true; }
      lx = e.clientX; ly = e.clientY; });
    c.addEventListener('pointerup', e => { const wasTap = ptrs.size === 1 && moved <= 6; ptrs.delete(e.pointerId); if (!ptrs.size) dragging = false;
      if (wasTap) { if (isTool()) { operate(c, e); return; } const i = nearest(c, e.clientX, e.clientY); if (i >= 0 && !sim.FIXED.has(i)) place(i); } });
    c.addEventListener('pointerleave', () => { if (hoverE >= 0) { hoverE = -1; dirty = true; } });
    c.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); if (!ptrs.size) dragging = false; });
    c.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.min(2.6, Math.max(0.6, zoom * (e.deltaY < 0 ? 1.08 : 0.93))); dirty = true; }, { passive: false });
  }

  // ---------- controls ----------
  const on = (q, ev, fn) => document.querySelectorAll(q).forEach(b => b.addEventListener(ev, () => fn(b)));
  on('[data-imode]', 'click', b => { mode = b.dataset.imode; linePick = null; hoverE = -1; dirty = true; setCursor(); document.querySelectorAll('[data-imode]').forEach(x => x.classList.toggle('on', x === b));
    status({ pluck: 'Pluck: tap any point to push it out and watch the web answer.', cut: 'Cut a cable: hover over the connective tissue web and tap a cable to cut it.', break: 'Break a bone: tap a bone to snap it where you tap.', point: 'Point: tap any point on either figure.', line: 'Line: tap two points; the imperfection follows the connective tissue between them.', plane: 'Plane: tap the center of a sheet of tissue. The sheet faces you, so turn the body to choose its angle.',
      torque: 'Twist: tap a hip, a knee, the lower back (trunk) or the base of the neck (head). Joints you can twist are shown in orange.' }[mode]); });
  const setSpin = v => { spin = v; const c = $('sim-spin'); if (c) c.checked = v; };
  on('[data-view]', 'click', b => { setSpin(false); pitch = -0.04; yaw = { front: 0, side: -Math.PI / 2, back: Math.PI }[b.dataset.view]; dirty = true; });
  on('[data-sex]', 'click', b => { document.querySelectorAll('[data-sex]').forEach(x => x.classList.toggle('on', x === b)); sim.build(b.dataset.sex); sel = null; origin = null; linePick = null; metrics = null; renderEditor(); changed();
    status(`${sim.sex === 'male' ? 'Male' : 'Female'} reference body, ${sim.HEIGHT} cm: an ideal biotensegrity at time zero.`); });
  const chk = (id, fn) => { const el = $(id); if (el) { el.addEventListener('change', () => { fn(el.checked); dirty = true; }); fn(el.checked); } };
  chk('sim-spin', v => spin = v); chk('sim-skin', v => showSkin = v); chk('sim-bones', v => showBones = v); chk('sim-web', v => showWeb = v); chk('sim-heat', v => heat = v);
  chk('sim-tint', v => strainTint = v);
  chk('sim-creep', v => { sim.creep = v; changed(); });
  const sl = $('sim-strength'); if (sl) { sl.addEventListener('input', () => strength = +sl.value); strength = +sl.value; }
  const legend = $('sim-lines');
  if (legend) { legend.innerHTML = UMSim.LINES.map(L => `<label class="lineopt"><input type="checkbox" data-line="${L.id}" checked><i style="background:${L.color}"></i>${L.name}</label>`).join('');
    legend.querySelectorAll('[data-line]').forEach(c => { lineOn[c.dataset.line] = c.checked; c.addEventListener('change', () => { lineOn[c.dataset.line] = c.checked; dirty = true; }); }); }
  $('sim3d-reset') && $('sim3d-reset').addEventListener('click', () => { sim.reset(); sel = null; origin = null; linePick = null; renderEditor(); changed(); status('Healthy: an ideal biotensegrity at time zero.'); });
  $('sim-zoomin') && $('sim-zoomin').addEventListener('click', () => { zoom = Math.min(2.6, zoom * 1.15); dirty = true; });
  $('sim-zoomout') && $('sim-zoomout').addEventListener('click', () => { zoom = Math.max(0.6, zoom / 1.15); dirty = true; });
  const BACK_TEXT = 'Tight lower back: the thoracolumbar fascia and the lower back muscles densified (density 3.2) and made sticky (friction 4). The lower back shortens, the pelvis tips back and the head is drawn back with it. The measured amounts are under What changed.';
  const scWrap = $('sim-scenarios');
  if (scWrap) { scWrap.innerHTML = Object.entries(UMSim.SCENARIOS).map(([k, s]) => `<button class="btn ghost" data-preset="${k}" type="button">${s.label}</button>`).join('');
    scWrap.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
      scWrap.querySelectorAll('[data-preset]').forEach(x => x.classList.toggle('on', x === b));
      const r = sim.scenario(b.dataset.preset); sim.imps.forEach(im => im.label = UMSim.SCENARIOS[b.dataset.preset].label);
      origin = r.origin ? [...r.origin] : null; sel = sim.imps[0] || null; linePick = null; renderEditor(); changed();
      status(b.dataset.preset === 'back' ? BACK_TEXT : r.text); })); }

  renderEditor();
  requestAnimationFrame(frame);
  // test hook (read only): used by the headless checks
  window.UMSimPage = { sim, state: () => ({ yaw, pitch, spin, zoom, frames, imps: sim.imps.length, moving: sim.moving, metrics }) };
  if (location.hash === '#demo3d') setTimeout(() => document.querySelector('[data-preset="hip"]')?.click(), 400);
  // deep links for demos and headless checks, e.g. #sim:sex=female,sc=hipIR,view=side,settle=900
  const hm = location.hash.match(/^#sim:(.*)$/);
  if (hm) { const o = Object.fromEntries(hm[1].split(',').map(x => x.split('=')));
    if (o.sex) document.querySelector(`[data-sex="${o.sex}"]`)?.click();
    if (o.sc) document.querySelector(`[data-preset="${o.sc}"]`)?.click();
    if (o.settle) sim.settle(+o.settle);
    if (o.zoom) zoom = +o.zoom; if (o.pitch) pitch = +o.pitch; if (o.yaw) yaw = +o.yaw;
    if (o.view) document.querySelector(`[data-view="${o.view}"]`)?.click(); dirty = true; }
  if (hm && /test=1/.test(hm[1])) setTimeout(() => { // headless check: timing and state written into the page
    const t0 = performance.now(); for (let i = 0; i < 20; i++) drawTensegrity(); const t1 = performance.now(); for (let i = 0; i < 20; i++) drawPerson(); const t2 = performance.now();
    for (let i = 0; i < 60; i++) sim.step(); const t3 = performance.now();
    const pre = document.createElement('pre'); pre.id = 'sim-test-out';
    pre.textContent = JSON.stringify({ tensegrityMs: (t1 - t0) / 20, personMs: (t2 - t1) / 20, stepMs: (t3 - t2) / 60, state: { yaw, pitch, spin, spinBox: $('sim-spin') && $('sim-spin').checked, imps: sim.imps.length, metrics: sim.metrics(origin) } });
    document.body.appendChild(pre); }, 1500);
})();
