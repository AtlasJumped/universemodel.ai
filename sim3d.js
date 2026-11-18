// Universe Model: a 3D human tensegrity (teaching model).
// Bones are struts (dark). Fascia is a web of tension-only cables, with the main fascial lines
// (after the myofascial chains described in anatomy) drawn in color. An imperfection densifies
// fascia (shortens its rest length) and holds it there; the posture that follows is computed by
// constraint physics, not scripted. Units are centimetres; y is up, z points forward, x to the body's left.
(() => {
  const cv = document.getElementById('body3d'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id);

  // ---------- anatomy (male, 183 cm) ----------
  // c = centre line, b = both sides (x given for the left; mirrored for the right). soft = fascial anchor, not bone.
  const BASE = [
    ['top','c',[0,183,-1]],['brow','c',[0,171,9]],['chin','c',[0,157,8]],['occ','c',[0,165,-9]],['ear','b',[7,166,0]],
    ['c1','c',[0,158,-3]],['c7','c',[0,147,-6]],['t6','c',[0,129,-10]],['t12','c',[0,110,-8]],['l3','c',[0,101,-5]],
    ['s1','c',[0,93,-8]],['coccyx','c',[0,85,-9]],['stTop','c',[0,145,6]],['xiph','c',[0,122,11]],['pubis','c',[0,86,9]],
    ['navel','c',[0,104,13],1],['throat','c',[0,151,5],1],['diaphragm','c',[0,118,1],1],
    ['scm','b',[4,152,3],1],['neckSide','b',[6,154,-2],1],['acrom','b',[18,146,-1]],['scapInf','b',[10,126,-11]],
    ['ribUp','b',[14,132,2]],['ribLow','b',[13,116,3]],['elbow','b',[21,113,-3]],['wrist','b',[23,88,1]],['hand','b',[23,70,3]],
    ['pec','b',[9,136,9],1],['lat','b',[12,118,-7],1],['abd','b',[11,104,9],1],['trunk','b',[15,110,0],1],
    ['erector','b',[4,115,-12],1],['erectorLow','b',[4,98,-10],1],['psoas','b',[4,97,1],1],
    ['asis','b',[12,96,7]],['hip','b',[9,89,0]],['glute','b',[10,84,-10],1],
    ['thighF','b',[10,68,8],1],['thighB','b',[9,68,-8],1],['thighL','b',[15,70,0],1],['thighI','b',[4,70,0],1],
    ['knee','b',[9,49,1]],['kneeF','b',[9,50,6]],['calfB','b',[9,30,-7],1],['shinF','b',[9,30,5],1],
    ['calfL','b',[12,28,-1],1],['calfI','b',[6,28,-1],1],['ankle','b',[9,8,-1]],['heel','b',[9,1,-5]],['ball','b',[9,1,11]],['toe','b',[8,0,16]]
  ];
  const STRUT_DEF = [
    'top-brow','brow-chin','top-occ','brow-occ','earL-earR','earL-top','earR-top','earL-brow','earR-brow','earL-occ','earR-occ','earL-chin','earR-chin','occ-c1',
    'c1-c7','c7-t6','t6-t12','t12-l3','l3-s1','s1-coccyx','stTop-xiph',
    '*t6-ribUp','*ribUp-stTop','*t12-ribLow','*ribLow-xiph','*ribUp-ribLow','*stTop-acrom','*acrom-scapInf','*acrom-elbow','*elbow-wrist','*wrist-hand',
    '*s1-asis','*asis-hip','*hip-pubis','*asis-pubis','*hip-knee','*knee-kneeF','*knee-ankle','*ankle-heel','*ankle-ball','*heel-ball','*ball-toe'
  ];
  // Main fascial lines. 'X' = this side, 'Y' = opposite side.
  const LINES = [
    { id:'sbl', name:'Superficial back line', color:'#2F6FD6', sides:2, path:'ballX heelX calfBX kneeX thighBX gluteX erectorLowX erectorX c7 occ top brow' },
    { id:'sfl', name:'Superficial front line', color:'#0F9C8E', sides:2, path:'toeX shinFX kneeFX thighFX asisX pubis navel xiph stTop scmX earX' },
    { id:'ll',  name:'Lateral line', color:'#7C4DD6', sides:2, path:'ballX calfLX kneeX thighLX hipX trunkX ribLowX ribUpX neckSideX earX' },
    { id:'spl', name:'Spiral line', color:'#E0861A', sides:2, path:'earX c7 scapInfY ribLowY navel asisX thighLX shinFX ballX calfLX thighBX gluteX erectorLowX erectorX occ' },
    { id:'dfl', name:'Deep front line', color:'#0B6E8F', sides:2, path:'ballX calfIX kneeX thighIX psoasX l3 diaphragm stTop throat chin' },
    { id:'arm', name:'Arm lines', color:'#5B6B82', sides:2, path:'pecX acromX elbowX wristX handX|t6 scapInfX acromX' },
    { id:'fun', name:'Functional lines', color:'#B0479E', sides:2, path:'pecX abdX pubis thighIY|latX l3 gluteY thighBY' }
  ];
  const FIXED_NAMES = ['heelL','heelR','ballL','ballR','toeL','toeR'];

  let N = [], IDX = {}, E = [], adj = [], FIXED = new Set(), P, O, OLD, level, lineOn = {}, sex = 'male', HEIGHT = 183;

  function build() {
    N = []; IDX = {};
    const sc = sex === 'male' ? 1 : 170 / 183;
    const shoulder = sex === 'male' ? 1 : 0.9, pelvis = sex === 'male' ? 1 : 1.12;
    for (const [name, kind, [x, y, z], soft] of BASE) {
      const wide = /acrom|scapInf|ribUp|elbow|wrist|hand|pec/.test(name) ? shoulder : /asis|hip|glute|thighL/.test(name) ? pelvis : 1;
      const add = (nm, xx) => { IDX[nm] = N.length; N.push({ name: nm, p0: [xx * wide * sc, y * sc, z * sc], soft: !!soft }); };
      if (kind === 'c') add(name, x); else { add(name + 'L', x); add(name + 'R', -x); }
    }
    HEIGHT = Math.round(183 * sc);
    E = []; const key = new Map();
    const addEdge = (a, b, strut, line) => {
      if (a === undefined || b === undefined || a === b) return;
      const k = Math.min(a, b) + '-' + Math.max(a, b);
      if (key.has(k)) { const e = E[key.get(k)]; if (line && !e.strut) e.lines.add(line); return; }
      key.set(k, E.length); E.push({ a, b, strut, lines: new Set(line ? [line] : []) });
    };
    for (const d of STRUT_DEF) {
      const both = d[0] === '*', [a, b] = d.replace('*', '').split('-');
      if (both) { addEdge(IDX[a + 'L'] ?? IDX[a], IDX[b + 'L'] ?? IDX[b], true); addEdge(IDX[a + 'R'] ?? IDX[a], IDX[b + 'R'] ?? IDX[b], true); }
      else addEdge(IDX[a], IDX[b], true);
    }
    for (const L of LINES) for (const side of ['L', 'R']) for (const seg of L.path.split('|')) {
      const opp = side === 'L' ? 'R' : 'L';
      const ids = seg.trim().split(/\s+/).map(t => IDX[t.replace(/X$/, side).replace(/Y$/, opp)] ?? IDX[t]);
      for (let i = 0; i + 1 < ids.length; i++) addEdge(ids[i], ids[i + 1], false, L.id);
    }
    // the general fascial web: each node to its nearest neighbours
    const d3 = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
    N.forEach((n, i) => N.map((m, j) => [j, d3(n.p0, m.p0)]).filter(([j, d]) => j !== i && d < 24 * sc)
      .sort((x, y) => x[1] - y[1]).slice(0, 5).forEach(([j]) => addEdge(i, j, false)));
    E.forEach(e => { e.rest0 = d3(N[e.a].p0, N[e.b].p0) * (e.strut ? 1 : 0.985); e.rest = e.rest0; });
    adj = N.map(() => []); E.forEach((e, k) => { if (!e.strut) { adj[e.a].push([e.b, k]); adj[e.b].push([e.a, k]); } });
    FIXED = new Set(FIXED_NAMES.map(n => IDX[n]));
    reset(true);
  }

  // ---------- state ----------
  let sel = [], mode = 'point', strength = 3, creep = false, simTime = 0, origin = null, history = [], S = null, slack0 = null;
  function reset(silent) {
    P = N.map(n => [...n.p0]); O = N.map(n => [...n.p0]); OLD = null;
    E.forEach(e => e.rest = e.rest0); level = N.map(() => 0); sel = []; simTime = 0; origin = null; history = [];
    if (!silent) status('Healthy: a perfect tensegrity at time zero.'); else status('Healthy: a perfect tensegrity at time zero.');
    settle(80); S = P.map(p => [...p]); slack0 = E.map(e => isSlack(e));
  }
  const isSlack = e => { if (e.strut) return false; const pa = P[e.a], pb = P[e.b]; return Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]) < e.rest * 0.996; };
  const densify = (k, f) => { const e = E[k]; if (!e.strut) { e.rest = Math.max(e.rest0 * 0.5, e.rest * f); e.dense = 1 - e.rest / e.rest0; } };
  const fac = () => 1 - 0.035 * strength;

  // ---------- physics: position-based dynamics ----------
  function step() {
    if (!OLD) OLD = P.map(p => [...p]);
    const nxt = P.map((p, i) => FIXED.has(i) ? [...O[i]] : [p[0] + (p[0] - OLD[i][0]) * 0.82, p[1] + (p[1] - OLD[i][1]) * 0.82, p[2] + (p[2] - OLD[i][2]) * 0.82]);
    OLD = P; P = nxt;
    for (let it = 0; it < 14; it++) {
      for (const e of E) {
        const pa = P[e.a], pb = P[e.b], dx = pb[0] - pa[0], dy = pb[1] - pa[1], dz = pb[2] - pa[2], d = Math.hypot(dx, dy, dz) || 1e-6;
        if (!e.strut && d < e.rest) continue; // cables only pull
        const k = e.strut ? 0.5 : (e.dense ? 0.16 : 0.07), c = (d - e.rest) / d * k;
        const wa = FIXED.has(e.a) ? 0 : 1, wb = FIXED.has(e.b) ? 0 : 1, w = wa + wb; if (!w) continue;
        const ca = c * 2 * wa / w, cb = c * 2 * wb / w;
        pa[0] += dx * ca; pa[1] += dy * ca; pa[2] += dz * ca; pb[0] -= dx * cb; pb[1] -= dy * cb; pb[2] -= dz * cb;
      }
      for (let i = 0; i < P.length; i++) if (!FIXED.has(i)) { const p = P[i], o = O[i]; p[0] += (o[0] - p[0]) * 0.0006; p[1] += (o[1] - p[1]) * 0.0006; p[2] += (o[2] - p[2]) * 0.0006; }
    }
    if (creep && history.length) { // densification slowly spreads along the fascial lines it sits on
      simTime += 1 / 60;
      if (Math.random() < 0.08) {
        const k = history[Math.floor(Math.random() * history.length)], e = E[k];
        for (const n of [e.a, e.b]) for (const [, j] of adj[n]) {
          const f = E[j]; if (f.strut || f === e) continue;
          const shared = [...e.lines].some(l => f.lines.has(l)) || (!e.lines.size && !f.lines.size);
          if (shared && Math.random() < 0.35) { densify(j, 0.985); if (!history.includes(j)) history.push(j); level[f.a] = Math.max(level[f.a], 0.5); level[f.b] = Math.max(level[f.b], 0.5); }
        }
      }
    }
  }
  function settle(n) { for (let i = 0; i < n; i++) step(); }

  // ---------- view ----------
  let W = 0, H = 0, yaw = reduce ? 0.5 : 0.35, pitch = -0.08, zoom = 1, spin = !reduce, showBones = true, showWeb = true, heat = false, showSkin = true;
  let CY = 0, BOT = 70;
  function size() { const dpr = Math.min(2, devicePixelRatio || 1), r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const st = document.getElementById('sim3d-status'); BOT = st && getComputedStyle(st).position === 'absolute' ? 74 : 12; CY = (56 + H - BOT) / 2; }
  new ResizeObserver(size).observe(cv); size();
  function proj(p) {
    let x = p[0], y = p[1] - HEIGHT / 2, z = p[2];
    let c = Math.cos(yaw), s = Math.sin(yaw); [x, z] = [x * c + z * s, -x * s + z * c];
    c = Math.cos(pitch); s = Math.sin(pitch); [y, z] = [y * c - z * s, y * s + z * c];
    const f = 520 / (520 - z), sc = Math.min(W / 110, (H - 70 - BOT) / 200) * zoom;
    return [W / 2 + x * f * sc, CY - y * f * sc, z, f * sc];
  }
  const lerp = (a, b, t) => a.map((v, k) => Math.round(v + (b[k] - v) * t));
  const heatCol = t => { t = Math.max(0, Math.min(1, t)); const c = t < 0.5 ? lerp([91, 155, 230], [240, 169, 64], t * 2) : lerp([240, 169, 64], [217, 59, 59], (t - 0.5) * 2); return `rgb(${c})`; };

  function draw() {
    if (!dragging && spin) yaw += 0.0035;
    step();
    ctx.clearRect(0, 0, W, H);
    const Q = P.map(proj);
    // floor
    ctx.strokeStyle = '#D6E1EE'; ctx.lineWidth = 1;
    ctx.beginPath(); for (let a = 0; a <= 64; a++) { const t = a / 64 * Math.PI * 2, q = proj([Math.cos(t) * 40, 0, Math.sin(t) * 40]); a ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke();
    // translucent body outline (flesh), drawn behind the structure
    if (showSkin) {
      const g = n => Q[IDX[n]];
      ctx.fillStyle = 'rgba(91,155,230,.10)'; ctx.strokeStyle = 'rgba(91,155,230,.12)'; ctx.lineCap = 'round';
      ctx.beginPath(); ['acromL','ribUpL','ribLowL','asisL','hipL','hipR','asisR','ribLowR','ribUpR','acromR'].forEach((n, k) => { const q = g(n); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.fill();
      const caps = [['c1','c7',11],['c7','t6',26],['t6','t12',27],['t12','s1',26],['hipL','hipR',22],
        ['hipL','kneeL',15],['hipR','kneeR',15],['kneeL','ankleL',10],['kneeR','ankleR',10],['heelL','toeL',8],['heelR','toeR',8],
        ['acromL','elbowL',9],['acromR','elbowR',9],['elbowL','wristL',7],['elbowR','wristR',7],['wristL','handL',6],['wristR','handR',6]];
      for (const [a, b, w] of caps) { const qa = g(a), qb = g(b); ctx.lineWidth = w * (qa[3] + qb[3]) / 2; ctx.beginPath(); ctx.moveTo(qa[0], qa[1]); ctx.lineTo(qb[0], qb[1]); ctx.stroke(); }
      const c = g('occ'), b = g('brow'), t = g('top'), ch = g('chin');
      ctx.beginPath(); ctx.ellipse((c[0] + b[0]) / 2, (t[1] + ch[1]) / 2, Math.max(10, Math.hypot(c[0] - b[0], c[1] - b[1]) / 2 + 4), Math.abs(ch[1] - t[1]) / 2 + 3, 0, 0, 7); ctx.fill();
    }
    // creep halos
    for (let i = 0; i < N.length; i++) if (level[i]) { const q = Q[i], r = (3 + 2.2 * Math.min(level[i], 6)) * q[3];
      const g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], r); g.addColorStop(0, 'rgba(217,59,59,.28)'); g.addColorStop(1, 'rgba(217,59,59,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 7); ctx.fill(); }
    // edges, back to front
    const order = E.map((e, k) => [k, (Q[e.a][2] + Q[e.b][2]) / 2]).sort((u, v) => u[1] - v[1]);
    ctx.lineCap = 'round';
    let slack = 0, cables = 0;
    for (const [k] of order) {
      const e = E[k], qa = Q[e.a], qb = Q[e.b], depth = 0.55 + 0.45 * Math.min(1, Math.max(0, ((qa[2] + qb[2]) / 2 + 30) / 60));
      if (e.strut) { if (!showBones) continue; ctx.setLineDash([]); ctx.strokeStyle = '#0E3A75'; ctx.globalAlpha = depth; ctx.lineWidth = 0.75 * (qa[3] + qb[3]) / 2 + 1.2; }
      else {
        cables++;
        const pa = P[e.a], pb = P[e.b], d = Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]), strain = (d - e.rest) / e.rest, isSlack = d < e.rest * 0.996;
        if (isSlack && slack0 && !slack0[k]) slack++;
        const onLine = [...e.lines].find(l => lineOn[l]);
        if (!onLine && !showWeb && !e.dense) continue;
        ctx.globalAlpha = depth * (onLine || e.dense ? 1 : 0.55);
        if (isSlack && heat) { ctx.setLineDash([3, 4]); ctx.strokeStyle = '#B9C6D6'; ctx.lineWidth = 1; }
        else {
          ctx.setLineDash([]);
          const t = heat ? Math.min(1, Math.max(0, strain / 0.08)) : 0;
          ctx.strokeStyle = e.dense ? heatCol(0.55 + e.dense * 1.2) : heat ? heatCol(t) : onLine ? LINES.find(L => L.id === onLine).color : '#9CC3F0';
          ctx.lineWidth = onLine || e.dense ? 2.4 + 2 * (e.dense || 0) * 3 : 1.1;
        }
      }
      ctx.beginPath(); ctx.moveTo(qa[0], qa[1]); ctx.lineTo(qb[0], qb[1]); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    // skull outline
    if (showBones) { const c = Q[IDX.occ], b = Q[IDX.brow], t = Q[IDX.top], ch = Q[IDX.chin];
      const cx = (c[0] + b[0]) / 2, cy = (t[1] + ch[1]) / 2, rx = Math.max(10, Math.hypot(c[0] - b[0], c[1] - b[1]) / 2 + 4), ry = Math.abs(ch[1] - t[1]) / 2 + 3;
      ctx.strokeStyle = 'rgba(14,58,117,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.stroke(); }
    // nodes
    for (let i = 0; i < N.length; i++) { const q = Q[i]; if (N[i].soft && !level[i] && !sel.includes(i)) continue;
      ctx.fillStyle = level[i] ? '#D93B3B' : sel.includes(i) ? '#F0A940' : '#1D5FD1'; ctx.beginPath(); ctx.arc(q[0], q[1], (level[i] || sel.includes(i) ? 3.4 : 2.2) * Math.max(1, q[3] / 3.2), 0, 7); ctx.fill(); }
    readout(slack, cables);
    requestAnimationFrame(draw);
  }

  // ---------- readouts ----------
  let lastR = 0;
  function readout(slack, cables) {
    const now = performance.now(); if (now - lastR < 250) return; lastR = now;
    if (!S) return; const R0 = S;
    const top = P[IDX.top][1] - R0[IDX.top][1], fwd = P[IDX.brow][2] - R0[IDX.brow][2];
    const sh = (P[IDX.acromL][1] - P[IDX.acromR][1]) - (R0[IDX.acromL][1] - R0[IDX.acromR][1]), pel = (P[IDX.asisL][1] - P[IDX.asisR][1]) - (R0[IDX.asisL][1] - R0[IDX.asisR][1]);
    let far = 0;
    if (origin) for (let i = 0; i < N.length; i++) { const d0 = Math.hypot(...[0, 1, 2].map(k => O[i][k] - origin[k])); if (d0 > 40) far = Math.max(far, Math.hypot(...[0, 1, 2].map(k => P[i][k] - R0[i][k]))); }
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    const cm = v => (Math.abs(v) < 0.05 ? '0.0' : (v > 0 ? '+' : '') + v.toFixed(1)) + ' cm';
    set('m-height', cm(top)); set('m-head', cm(fwd)); set('m-shoulders', Math.abs(sh) < 0.05 ? 'level' : `${Math.abs(sh).toFixed(1)} cm, ${sh > 0 ? 'left' : 'right'} higher`);
    set('m-pelvis', Math.abs(pel) < 0.05 ? 'level' : `${Math.abs(pel).toFixed(1)} cm, ${pel > 0 ? 'left' : 'right'} higher`);
    set('m-far', origin ? far.toFixed(1) + ' cm' : '—'); set('m-slack', slack ? slack + ' cables' : 'none');
    set('m-time', creep ? `${Math.floor(simTime)} months` : 'paused');
  }
  const statusEl = $('sim3d-status'); function status(t) { if (statusEl) statusEl.textContent = t; }

  // ---------- interaction ----------
  let dragging = false, lx = 0, ly = 0, moved = 0; const ptrs = new Map(); let pinch0 = 0, zoom0 = 1;
  function nearest(cx, cy) { const r = cv.getBoundingClientRect(), mx = cx - r.left, my = cy - r.top; let best = -1, bd = 26;
    P.forEach((p, i) => { const q = proj(p), d = Math.hypot(q[0] - mx, q[1] - my) - q[2] * 0.02; if (d < bd) { bd = d; best = i; } }); return best; }
  const pretty = nm => nm.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/ (L|R)$/, '').replace(/L$|R$/, '').toLowerCase()
    .replace('st top', 'top of breastbone').replace('xiph', 'base of breastbone').replace('acrom', 'shoulder').replace('scap inf', 'shoulder blade')
    .replace('asis', 'front of pelvis').replace('occ', 'base of skull').replace('c7', 'base of neck').replace('t6', 'mid back').replace('t12', 'lower back (upper)')
    .replace('l3', 'lower back').replace('s1', 'sacrum').replace('erector low', 'lower back muscles').replace('erector', 'back muscles').replace('scm', 'side of neck')
    .replace('thigh f', 'front of thigh').replace('thigh b', 'back of thigh').replace('thigh l', 'outer thigh').replace('thigh i', 'inner thigh')
    .replace('calf b', 'calf').replace('shin f', 'shin').replace('calf l', 'outer calf').replace('calf i', 'inner calf').replace('knee f', 'kneecap')
    .replace('rib up', 'upper ribs').replace('rib low', 'lower ribs').replace('pec', 'chest').replace('lat', 'side of back').replace('abd', 'abdomen')
    .replace('trunk', 'side of trunk').replace('neck side', 'side of neck') + (/[LR]$/.test(nm) && N[IDX[nm]].p0[0] ? (nm.endsWith('L') ? ' (left)' : ' (right)') : '');
  function path(s, t) { const prev = N.map(() => null), seen = new Set([s]), q = [s];
    while (q.length) { const u = q.shift(); if (u === t) break; for (const [v, k] of adj[u]) if (!seen.has(v)) { seen.add(v); prev[v] = [u, k]; q.push(v); } }
    const out = []; let v = t; while (prev[v]) { out.push(prev[v][1]); v = prev[v][0]; } return out; }
  function mark(edges) { edges.forEach(k => { densify(k, fac()); if (!history.includes(k)) history.push(k); }); }
  function place(i) {
    if (!origin) origin = [...O[i]];
    if (mode === 'point') { const ks = adj[i].map(([, k]) => k); mark(ks); level[i]++; status(`Point of imperfection at the ${pretty(N[i].name)}${level[i] > 1 ? ` (${level[i]} times)` : ''}: fascia densified and held there.`); }
    else if (mode === 'plane') { const c = O[i], ks = []; E.forEach((e, k) => { if (!e.strut && [e.a, e.b].every(n => Math.hypot(...[0, 1, 2].map(m => O[n][m] - c[m])) < 15)) ks.push(k); });
      mark(ks); N.forEach((n, j) => { if (Math.hypot(...[0, 1, 2].map(m => O[j][m] - c[m])) < 15) level[j]++; }); status(`Plane of imperfection across the ${pretty(N[i].name)}: a sheet of fascia densified.`); }
    else { sel.push(i); if (sel.length < 2) { status('Line of imperfection: choose the second point.'); return; }
      const ks = path(sel[0], sel[1]); mark(ks); ks.forEach(k => { level[E[k].a]++; level[E[k].b]++; });
      status(`Line of imperfection from the ${pretty(N[sel[0]].name)} to the ${pretty(N[sel[1]].name)}.`); sel = []; }
  }
  cv.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, [e.clientX, e.clientY]); cv.setPointerCapture(e.pointerId);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); zoom0 = zoom; }
    dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; });
  cv.addEventListener('pointermove', e => { if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; zoom = Math.min(2.6, Math.max(0.6, zoom0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / (pinch0 || 1))); moved = 99; return; }
    const dx = e.clientX - lx, dy = e.clientY - ly; moved += Math.abs(dx) + Math.abs(dy); yaw += dx * 0.01; pitch = Math.max(-1.2, Math.min(1.2, pitch + dy * 0.006)); lx = e.clientX; ly = e.clientY; });
  const up = e => { const wasTap = ptrs.size === 1 && moved < 6; ptrs.delete(e.pointerId); if (!ptrs.size) dragging = false;
    if (wasTap) { const i = nearest(e.clientX, e.clientY); if (i >= 0 && !FIXED.has(i)) place(i); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); dragging = false; });
  cv.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.min(2.6, Math.max(0.6, zoom * (e.deltaY < 0 ? 1.08 : 0.93))); }, { passive: false });

  // ---------- controls ----------
  const on = (sel, ev, fn) => document.querySelectorAll(sel).forEach(b => b.addEventListener(ev, () => fn(b)));
  on('[data-imode]', 'click', b => { mode = b.dataset.imode; sel = []; document.querySelectorAll('[data-imode]').forEach(x => x.classList.toggle('on', x === b));
    status(mode === 'point' ? 'Point: tap any node.' : mode === 'line' ? 'Line: tap two points.' : 'Plane: tap the centre of a patch of tissue.'); });
  on('[data-view]', 'click', b => { spin = false; $('sim-spin') && ($('sim-spin').checked = false); pitch = -0.05; yaw = { front: 0, side: Math.PI / 2, back: Math.PI }[b.dataset.view]; });
  on('[data-sex]', 'click', b => { sex = b.dataset.sex; document.querySelectorAll('[data-sex]').forEach(x => x.classList.toggle('on', x === b)); build(); status(`${sex === 'male' ? 'Male' : 'Female'} reference body, ${HEIGHT} cm: a perfect tensegrity at time zero.`); });
  const chk = (id, fn) => { const el = $(id); if (el) { el.addEventListener('change', () => fn(el.checked)); fn(el.checked); } };
  chk('sim-spin', v => spin = v); chk('sim-skin', v => showSkin = v); chk('sim-bones', v => showBones = v); chk('sim-web', v => showWeb = v); chk('sim-heat', v => heat = v);
  chk('sim-creep', v => { creep = v; });
  const sl = $('sim-strength'); if (sl) { sl.addEventListener('input', () => strength = +sl.value); strength = +sl.value; }
  const legend = $('sim-lines');
  if (legend) { legend.innerHTML = LINES.map(L => `<label class="lineopt"><input type="checkbox" data-line="${L.id}" checked><i style="background:${L.color}"></i>${L.name}</label>`).join('');
    legend.querySelectorAll('[data-line]').forEach(c => { lineOn[c.dataset.line] = c.checked; c.addEventListener('change', () => lineOn[c.dataset.line] = c.checked); }); }
  $('sim3d-reset') && $('sim3d-reset').addEventListener('click', () => reset(false));
  $('sim-zoomin') && $('sim-zoomin').addEventListener('click', () => zoom = Math.min(2.6, zoom * 1.15));
  $('sim-zoomout') && $('sim-zoomout').addEventListener('click', () => zoom = Math.max(0.6, zoom / 1.15));
  const lineEdges = (id, side) => E.map((e, k) => [e, k]).filter(([e]) => !e.strut && e.lines.has(id) && (side === undefined || [e.a, e.b].some(n => Math.sign(O[n][0]) === side))).map(([, k]) => k);
  const PRESETS = {
    desk: () => { const ks = lineEdges('sfl').filter(k => O[E[k].a][1] > 95 && O[E[k].b][1] > 95).concat(lineEdges('dfl').filter(k => O[E[k].a][1] > 115 && O[E[k].b][1] > 115)); mark(ks); mark(ks); mark(ks); mark(ks); ks.forEach(k => level[E[k].a]++); origin = [...O[IDX.stTop]]; return 'Desk posture: the upper front line (breastbone to neck) densified. Watch the head and upper back.'; },
    back: () => { place(IDX.l3); place(IDX.l3); return 'Tight lower back: a patch of fascia densified around the lumbar spine.'; },
    hip: () => { const m = mode; mode = 'point'; for (let n = 0; n < 4; n++) place(IDX.hipR); mode = m; origin = [...O[IDX.hipR]]; return 'One-sided hip: the right hip densified. Watch the shoulders and pelvis.'; },
    foot: () => { const ks = E.map((e, k) => [e, k]).filter(([e]) => !e.strut && [e.a, e.b].every(n => O[n][1] < 12 && O[n][0] < 0)).map(([, k]) => k); mark(ks); mark(ks); mark(ks); ks.forEach(k => level[E[k].a]++); origin = [...O[IDX.heelR]]; return 'Right foot: the plantar fascia densified. Look for effects far up the body.'; },
  };
  on('[data-preset]', 'click', b => { reset(true); const m = mode; mode = b.dataset.preset === 'back' ? 'plane' : mode; const msg = PRESETS[b.dataset.preset](); mode = m; status(msg); });

  build(); requestAnimationFrame(draw);
  if (location.hash === '#demo3d') setTimeout(() => document.querySelector('[data-preset="desk"]')?.click(), 400);
})();
