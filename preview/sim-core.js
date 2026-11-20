// Universe Model: physics core of the 3D human tensegrity (teaching model).
// Runs in the browser (window.UMSim) and in Node (module.exports) so the physics can be tested headless.
// Bones are struts (near rigid). Fascia is a web of tension-only cables; the main fascial lines follow the
// myofascial chains described in anatomy, plus the thoracolumbar fascia and the deep hip and knee rotators.
// An imperfection is a persistent change of tissue properties in a zone: density (shorter rest length and
// higher stiffness), friction (fascia cannot slide through the zone, motion there is damped), mass (heavier
// nodes, with the added weight under gravity), volume (a local spacer that pushes or pulls the zone) and a
// boundary radius. A torque imperfection remodels the cables that cross a joint to the lengths a twist would
// give them. Nothing about the resulting posture is scripted: it is the equilibrium the constraints find.
// Units are centimetres; y is up, z points forward, x to the body's left.
(function (root) {
  'use strict';
  // c = centre line, b = both sides (x given for the left; mirrored for the right). 1 = soft tissue anchor, not bone.
  const BASE = [
    ['top','c',[0,183,-1]],['brow','c',[0,171,9]],['chin','c',[0,157,8]],['occ','c',[0,165,-9]],['ear','b',[7,166,0]],
    ['c1','c',[0,158,-3]],['c7','c',[0,147,-6]],['t6','c',[0,129,-10]],['t12','c',[0,110,-8]],['l3','c',[0,101,-5]],
    ['s1','c',[0,93,-8]],['coccyx','c',[0,85,-9]],['stTop','c',[0,145,6]],['xiph','c',[0,122,11]],['pubis','c',[0,86,9]],
    ['navel','c',[0,104,13],1],['throat','c',[0,151,5],1],['diaphragm','c',[0,118,1],1],['tlf','c',[0,101,-13],1],
    ['scm','b',[4,152,3],1],['neckSide','b',[6,154,-2],1],['acrom','b',[19,146,-1]],['scapInf','b',[10,126,-11]],
    ['ribUp','b',[14,132,2]],['ribLow','b',[13,116,3]],['elbow','b',[26,114,-3]],['wrist','b',[31,90,1]],['hand','b',[34,73,3]],
    ['pec','b',[9,136,9],1],['lat','b',[12,118,-7],1],['abd','b',[11,104,9],1],['trunk','b',[15,110,0],1],
    ['erector','b',[4,115,-12],1],['erectorLow','b',[4,98,-10],1],['psoas','b',[4,97,1],1],['tlfRaphe','b',[9,104,-9],1],
    ['asis','b',[12,96,7]],['crest','b',[14,101,-3]],['hip','b',[9,89,0]],['troch','b',[16,88,-1]],['isch','b',[6,84,-6]],
    ['glute','b',[10,84,-10],1],
    ['thighF','b',[10,68,8],1],['thighB','b',[9,68,-8],1],['thighL','b',[15,70,0],1],['thighI','b',[4,70,0],1],
    ['knee','b',[9,49,1]],['kneeF','b',[9,50,6]],['kneeLat','b',[13,49,0]],['kneeMed','b',[5,49,0]],['tibTub','b',[9,44,4]],
    ['calfB','b',[9,30,-7],1],['shinF','b',[9,30,5],1],['calfL','b',[12,28,-1],1],['calfI','b',[6,28,-1],1],
    ['ankle','b',[9,8,-1]],['heel','b',[9,1,-5]],['ball','b',[9,1,11]],['toe','b',[8,0,16]]
  ];
  const STRUT_DEF = [
    // skull and spine
    'top-brow','brow-chin','top-occ','brow-occ','earL-earR','earL-top','earR-top','earL-brow','earR-brow','earL-occ','earR-occ','earL-chin','earR-chin','occ-c1',
    'c1-c7','c7-t6','t6-t12','t12-l3','l3-s1','s1-coccyx','stTop-xiph',
    // rib cage, shoulder girdle, arms
    '*t6-ribUp','*ribUp-stTop','*t12-ribLow','*ribLow-xiph','*ribUp-ribLow','*stTop-acrom','*acrom-scapInf','*acrom-elbow','*elbow-wrist','*wrist-hand',
    // pelvis: one near rigid ring (sacrum, both hip bones)
    '*s1-asis','*s1-hip','*s1-crest','*asis-hip','*asis-pubis','*asis-crest','*hip-pubis','*hip-crest','*hip-isch','*isch-pubis','*isch-s1','asisL-asisR',
    // femur (head, greater trochanter, condyles, kneecap)
    '*hip-knee','*hip-troch','*troch-knee','*hip-kneeLat','*hip-kneeMed','*troch-kneeLat','*kneeLat-kneeMed','*knee-kneeLat','*knee-kneeMed',
    '*kneeF-knee','*kneeF-kneeLat','*kneeF-kneeMed',
    // tibia and foot
    '*knee-ankle','*knee-tibTub','*tibTub-ankle','*ankle-heel','*ankle-ball','*heel-ball','*ball-toe'
  ];
  // Fascial lines. 'X' = this side, 'Y' = opposite side, '|' starts a new segment.
  const LINES = [
    { id:'sbl', name:'Superficial back line', color:'#2F6FD6', path:'toeX ballX heelX calfBX kneeX thighBX ischX s1 erectorLowX erectorX occ top brow' },
    { id:'sfl', name:'Superficial front line', color:'#0F9C8E', path:'toeX shinFX tibTubX kneeFX thighFX asisX pubis navel xiph stTop scmX earX' },
    { id:'ll',  name:'Lateral line', color:'#7C4DD6', path:'ballX calfLX kneeLatX thighLX trochX crestX trunkX ribLowX ribUpX neckSideX earX' },
    { id:'spl', name:'Spiral line', color:'#E0861A', path:'earX c7 scapInfY ribLowY navel asisX thighLX kneeLatX shinFX ballX calfLX thighBX ischX s1 erectorLowX erectorX occ' },
    { id:'dfl', name:'Deep front line', color:'#0B6E8F', path:'ballX calfIX kneeMedX thighIX psoasX l3 diaphragm stTop throat chin|thighIX pubis' },
    { id:'arm', name:'Arm lines', color:'#5B6B82', path:'pecX acromX elbowX wristX handX|t6 scapInfX acromX|occ acromX|c7 acromX' },
    { id:'fun', name:'Functional lines', color:'#B0479E', path:'pecX abdX pubis thighIY|latX tlf gluteY thighLY kneeFY' },
    { id:'tlf', name:'Thoracolumbar fascia', color:'#C2412D', path:'latX tlfRapheX tlf|tlfRapheX abdX|erectorLowX tlf|tlfRapheX crestX|tlf s1|tlfRapheX ribLowX|gluteX tlf|t12 tlf|erectorX tlfRapheX' },
    { id:'rot', name:'Deep hip and knee rotators', color:'#6E8B1E', path:'s1 trochX|crestX trochX|ischX trochX|asisX trochX|gluteX trochX|asisX kneeMedX|ischX kneeMedX|kneeLatX calfIX' }
  ];
  const FIXED_NAMES = ['heelL','heelR','ballL','ballR','toeL','toeR'];
  // Joints that can be twisted. Distal nodes rotate about the axis pivot -> axisTo in the tissue's rest geometry.
  const JOINTS = {
    hip:   { label:'hip', sided:true, pivot:'hipX', to:'kneeX', front:'kneeFX', distal:['kneeX','kneeFX','kneeLatX','kneeMedX','trochX','thighFX','thighBX','thighLX','thighIX'], pos:'internal', neg:'external' },
    knee:  { label:'knee (shin bone)', sided:true, pivot:'kneeX', to:'ankleX', front:'tibTubX', distal:['tibTubX','shinFX','calfBX','calfLX','calfIX'], pos:'internal', neg:'external' },
    trunk: { label:'trunk', sided:false, pivot:'l3', to:'c7', front:'stTop', distal:['t6','c7','stTop','xiph','ribUpL','ribUpR','ribLowL','ribLowR','acromL','acromR','scapInfL','scapInfR','pecL','pecR','latL','latR','erectorL','erectorR','trunkL','trunkR','diaphragm','elbowL','elbowR','wristL','wristR','handL','handR','c1','top','brow','chin','occ','earL','earR','scmL','scmR','neckSideL','neckSideR','throat'], pos:'to the left', neg:'to the right' },
    neck:  { label:'head and neck', sided:false, pivot:'c7', to:'top', front:'brow', distal:['c1','top','brow','chin','occ','earL','earR'], pos:'to the left', neg:'to the right' }
  };

  const v3 = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]), dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  };
  // Rodrigues rotation of point p about the axis through c with unit direction k
  const rotAbout = (p, c, k, th) => { const v = v3.sub(p, c), cs = Math.cos(th), sn = Math.sin(th), kv = v3.cross(k, v), kd = v3.dot(k, v);
    return v3.add(c, [v[0] * cs + kv[0] * sn + k[0] * kd * (1 - cs), v[1] * cs + kv[1] * sn + k[1] * kd * (1 - cs), v[2] * cs + kv[2] * sn + k[2] * kd * (1 - cs)]); };

  // physics constants
  const PRE = 0.985;          // healthy pretension: cables rest 1.5% shorter than their length
  const K_WEB = 0.07, K_LINE = 0.09, K_STRUT = 0.5, K_MAX = 0.26;
  const DAMP = 0.82;          // velocity kept per step
  const ITERS = 14;
  const TONE = 0.0006;        // postural tone: a weak pull toward the healthy shape (stands in for muscle tone and balance control)
  // Weight. In the healthy body every node's weight is carried: by the bone column down to both feet, and by the
  // fascia that meets at the node. Damage takes that carrying away. A node that has lost its bone path to the
  // ground, or some of its cables, feels that share of gravity and loses that share of tone.
  const GRAV = 0.02;          // gravity on unsupported weight, cm per step squared
  const CUT_GAIN = 5;         // share of a node's support lost per share of its cables cut
  const DAMP_FALL = 0.965;    // falling parts are not held back by tissue damping
  // long bones are drawn with several struts; a break severs every strut that spans the fracture
  const LONG_BONES = [[['hip','troch'],['knee','kneeLat','kneeMed','kneeF']], [['knee','tibTub'],['ankle']]];
  const SLIDE = 0.15;         // how fast fascia slides along a line to even out tension (healthy, low friction)
  const G = 0.012;            // gravity on added mass, cm per step squared
  const SHORTEN = 0.11;       // rest-length shortening per unit of added relative density
  let nextId = 1;

  function create(opt) {
    const S = { sex: (opt && opt.sex) || 'male', HEIGHT: 183, LINES, JOINTS, BASE, imps: [], months: 0, creep: false };
    let sliding = true, N, IDX, E, adj, FIXED, P, O, OLD, chains, m0, mass, invm, dampN, extF, spacers, base, unsup = null, damaged = false;

    S.build = function (sex) {
      if (sex) S.sex = sex;
      const female = S.sex === 'female', sc = female ? 170 / 183 : 1;
      const shoulder = female ? 0.9 : 1, pelvis = female ? 1.1 : 1;
      N = []; IDX = {};
      for (const [name, kind, [x, y, z], soft] of BASE) {
        const wide = /acrom|scapInf|ribUp|elbow|wrist|hand|pec/.test(name) ? shoulder : /asis|crest|hip|troch|glute|thighL|isch/.test(name) ? pelvis : 1;
        const add = (nm, xx) => { IDX[nm] = N.length; N.push({ name: nm, base: name, p0: [xx * wide * sc, y * sc, z * sc], soft: !!soft, side: kind === 'c' ? 0 : xx > 0 ? 1 : -1 }); };
        if (kind === 'c') add(name, x); else { add(name + 'L', x); add(name + 'R', -x); }
      }
      S.HEIGHT = Math.round(183 * sc);
      E = []; const key = new Map();
      const addEdge = (a, b, strut, line) => {
        if (a === undefined || b === undefined || a === b) return -1;
        const k = Math.min(a, b) + '-' + Math.max(a, b);
        if (key.has(k)) { const e = E[key.get(k)]; if (line && !e.strut) e.lines.add(line); return key.get(k); }
        key.set(k, E.length); E.push({ a, b, strut, lines: new Set(line ? [line] : []) }); return E.length - 1;
      };
      for (const d of STRUT_DEF) {
        const both = d[0] === '*', [a, b] = d.replace('*', '').split('-');
        if (both) { addEdge(IDX[a + 'L'] ?? IDX[a], IDX[b + 'L'] ?? IDX[b], true); addEdge(IDX[a + 'R'] ?? IDX[a], IDX[b + 'R'] ?? IDX[b], true); }
        else addEdge(IDX[a], IDX[b], true);
      }
      chains = [];
      for (const L of LINES) for (const side of ['L', 'R']) for (const seg of L.path.split('|')) {
        const opp = side === 'L' ? 'R' : 'L';
        const ids = seg.trim().split(/\s+/).map(t => { const n = IDX[t.replace(/X$/, side).replace(/Y$/, opp)] ?? IDX[t]; if (n === undefined) throw new Error('unknown node ' + t); return n; });
        let chain = [];
        for (let i = 0; i + 1 < ids.length; i++) {
          const k = addEdge(ids[i], ids[i + 1], false, L.id);
          // fascia is anchored where a line meets bone along a strut; a chain of sliding segments breaks there
          if (k < 0 || E[k].strut) { if (chain.length > 1) chains.push(chain); chain = []; continue; }
          chain.push([k, ids[i + 1]]);
        }
        if (chain.length > 1) chains.push(chain);
      }
      // the general fascial web: each node to its nearest neighbours
      N.forEach((n, i) => N.map((m, j) => [j, v3.dist(n.p0, m.p0)]).filter(([j, d]) => j !== i && d < 24 * sc)
        .sort((x, y) => x[1] - y[1]).slice(0, 5).forEach(([j]) => addEdge(i, j, false)));
      E.forEach(e => { e.L0 = v3.dist(N[e.a].p0, N[e.b].p0); e.rest0 = e.L0 * (e.strut ? 1 : PRE); e.k0 = e.strut ? K_STRUT : e.lines.size ? K_LINE : K_WEB; e.slide = 0; });
      adj = N.map(() => []); E.forEach((e, k) => { if (!e.strut) { adj[e.a].push([e.b, k]); adj[e.b].push([e.a, k]); } });
      FIXED = new Set(FIXED_NAMES.map(n => IDX[n]));
      O = N.map(n => [...n.p0]);
      m0 = N.map(() => 1);
      S.N = N; S.IDX = IDX; S.E = E; S.adj = adj; S.FIXED = FIXED; S.O = O;
      // settle the healthy body once and keep it as the reference
      S.imps = []; S.months = 0; applyImps();
      P = O.map(p => [...p]); OLD = null; E.forEach(e => { e.slide = 0; e.T0 = 0; });
      sliding = false; for (let i = 0; i < 500; i++) step(); sliding = true;
      // the healthy pattern of tension is the one the fascia has settled into; sliding responds to changes from it
      E.forEach(e => { if (!e.strut) { const r = restOf(e), d = v3.dist(P[e.a], P[e.b]); e.T0 = e.k * Math.max(0, d - r) / r; } });
      base = { P: P.map(p => [...p]), slide: E.map(e => e.slide), energy: 0 };
      S.P = P; S.ref = base.P; base.energy = energy(); base.asym = asymmetry(); S.base = base;
      base.slack = E.map(e => isSlack(e)); base.nodeStrain = null; base.nodeStrain = S.nodeStrain();
      S.reset();
      return S;
    };

    // cutting a cable or breaking a bone removes that member; the rest of the structure finds a new balance
    // a fascial line is one continuous band that slides over the points between its anchors: cut it anywhere and
    // the whole band between those anchors goes slack
    S.cut = function (k) { if (!E[k] || E[k].cut) return false; E[k].cut = true;
      if (!E[k].strut) for (const ch of chains) if (ch.some(([j]) => j === k)) for (const [j] of ch) if (!E[j].cut) E[j].released = true;
      support(); S.moving = 1; return true; };
    // breaking a bone: the clicked strut snaps; in a long bone every strut that spans the fracture goes with it
    S.breakBone = function (k) {
      const e = E[k]; if (!e || !e.strut || e.cut) return 0;
      const na = N[e.a], nb = N[e.b]; let n = 0;
      const snap = j => { if (!E[j].cut) { E[j].cut = true; E[j].broken = true; n++; } };
      snap(k);
      if (na.side && na.side === nb.side) for (const [prox, dist] of LONG_BONES) {
        const span = (x, y) => prox.includes(x.base) && dist.includes(y.base);
        if (!(span(na, nb) || span(nb, na))) continue;
        E.forEach((f, j) => { if (!f.strut) return; const fa = N[f.a], fb = N[f.b]; if (fa.side !== na.side || fb.side !== na.side) return; if (span(fa, fb) || span(fb, fa)) snap(j); });
      }
      support(); S.moving = 1; return n;
    };
    // which share of each node's weight is no longer carried
    function support() {
      const bone = N.map(() => []), cab = N.map(() => [0, 0]);
      E.forEach(e => { if (e.strut) { if (!e.cut) { bone[e.a].push(e.b); bone[e.b].push(e.a); } } else { cab[e.a][1]++; cab[e.b][1]++; const w = e.cut ? 0 : e.released ? 0.5 : 1; cab[e.a][0] += w; cab[e.b][0] += w; } });
      const reach = side => { const seen = new Set(), q = []; FIXED.forEach(i => { if (N[i].side === side) { seen.add(i); q.push(i); } });
        while (q.length) { const u = q.pop(); for (const v of bone[u]) if (!seen.has(v)) { seen.add(v); q.push(v); } } return seen; };
      const L = reach(1), R = reach(-1);
      const hasBone = N.map((_, i) => E.some(e => e.strut && (e.a === i || e.b === i)));
      const u = N.map((_, i) => hasBone[i] ? (L.has(i) && R.has(i) ? 0 : 1) : -1);
      // soft tissue anchors hang from what they are tied to
      for (let pass = 0; pass < 3; pass++) N.forEach((_, i) => { if (hasBone[i]) return; let s = 0, n = 0; for (const [j, k] of adj[i]) if (!E[k].cut && u[j] >= 0) { s += u[j]; n++; } u[i] = n ? s / n : 1; });
      damaged = false;
      unsup = u.map((x, i) => { const lost = cab[i][1] ? 1 - cab[i][0] / cab[i][1] : 0; const v = FIXED.has(i) ? 0 : Math.min(1, Math.max(0, x) + CUT_GAIN * lost); if (v > 0) damaged = true; return v; });
      S.unsupported = unsup; S.damaged = damaged;
      if (!damaged) unsup = null;
    }
    S.cuts = () => E.reduce((n, e) => n + (e.cut ? 1 : 0), 0);
    S.pluck = function (i, cm) { // push one node outward from the body's centre line and let the web answer
      if (FIXED.has(i)) return; const p = P[i], c = [0, p[1], 0], d = v3.sub(p, c), l = v3.len(d) || 1, k = (cm || 5) / l;
      p[0] += d[0] * k; p[2] += d[2] * k; S.moving = 1; };
    S.reset = function () {
      S.imps = []; S.months = 0;
      P = base.P.map(p => [...p]); OLD = null; E.forEach((e, k) => { e.slide = base.slide[k]; e.cut = false; e.broken = false; e.released = false; e.breakT = undefined; }); unsup = null; damaged = false; S.damaged = false; S.P = P;
      applyImps(); S.moving = 1;
    };

    // ---------- imperfections ----------
    const falloff = x => x <= 0.55 ? 1 : x >= 1 ? 0 : (1 - x) / 0.45;
    const mid = e => v3.mul(v3.add(O[e.a], O[e.b]), 0.5);
    function zone(im) {
      // returns { cw: Map(cable -> weight), nw: Map(node -> weight), c: centre }
      const cw = new Map(), nw = new Map();
      const r = im.radius * (S.creep || im.age ? 1 + Math.min(0.6, 0.025 * (im.age || 0)) : 1);
      if (im.type === 'point' || im.type === 'plane') {
        const c = O[im.node], n = im.normal;
        const inside = p => { const d = v3.sub(p, c); if (im.type === 'point') return falloff(v3.len(d) / r);
          const h = v3.dot(d, n); if (Math.abs(h) > 3.5) return 0; return falloff(Math.sqrt(Math.max(0, v3.dot(d, d) - h * h)) / r); };
        E.forEach((e, k) => { if (e.strut) return; const w = inside(mid(e)); if (w > 0) cw.set(k, w); });
        N.forEach((_, j) => { const w = inside(O[j]); if (w > 0) nw.set(j, w); });
      } else if (im.type === 'line' || im.type === 'set') {
        const ks = im.edges; ks.forEach(k => cw.set(k, 1));
        const pn = new Set(); ks.forEach(k => { pn.add(E[k].a); pn.add(E[k].b); });
        pn.forEach(j => nw.set(j, 1));
        if (im.type === 'line' && im.radius > 2) E.forEach((e, k) => { if (e.strut || cw.has(k)) return; const m = mid(e);
          let best = 1e9; pn.forEach(j => best = Math.min(best, v3.dist(m, O[j]))); const w = falloff(best / im.radius); if (w > 0) cw.set(k, w); });
      }
      // creep: with time the change spreads along the fascial lines that pass through the zone
      if (im.age > 0 && cw.size) {
        const hops = Math.min(4, Math.floor(im.age / 6));
        let front = [...cw.entries()].filter(([, w]) => w > 0.5);
        for (let h = 1; h <= hops; h++) {
          const nxt = [];
          for (const [k, w] of front) { const e = E[k]; if (!e.lines.size) continue;
            for (const n of [e.a, e.b]) for (const [, j] of adj[n]) { if (cw.has(j)) continue; const f = E[j];
              if ([...e.lines].some(l => f.lines.has(l))) { const ww = w * 0.6; cw.set(j, ww); nxt.push([j, ww]); } } }
          front = nxt;
        }
      }
      let c = [0, 0, 0], ws = 0; nw.forEach((w, j) => { c = v3.add(c, v3.mul(O[j], w)); ws += w; });
      return { cw, nw, c: ws ? v3.mul(c, 1 / ws) : O[im.node ?? 0] };
    }
    S.zone = zone;
    function torqueFactors(im) {
      const J = JOINTS[im.joint], s = im.side || 'L', opp = s === 'L' ? 'R' : 'L';
      const nm = t => IDX[t.replace(/X$/, s)] ?? IDX[t];
      const c = O[nm(J.pivot)], k = v3.norm(v3.sub(O[nm(J.to)], c));
      const D = new Set(J.distal.map(nm));
      // sign so that a positive angle turns the front marker medially (sided joints) or to the body's left (trunk, neck)
      const fr = O[nm(J.front)], test = rotAbout(fr, c, k, 0.1);
      let sign = 1;
      if (J.sided) { const medial = s === 'L' ? -1 : 1; sign = (test[0] - fr[0]) * medial > 0 ? 1 : -1; }
      else sign = test[0] - fr[0] > 0 ? 1 : -1;
      const th = sign * im.angle * Math.PI / 180;
      const R = new Map(); D.forEach(j => R.set(j, rotAbout(O[j], c, k, th)));
      const out = new Map();
      E.forEach((e, kk) => { if (e.strut) return; const ia = D.has(e.a), ib = D.has(e.b); if (ia === ib) return;
        const pa = ia ? R.get(e.a) : O[e.a], pb = ib ? R.get(e.b) : O[e.b]; out.set(kk, v3.dist(pa, pb) / e.L0); });
      return { out, D, c, k };
    }
    S.torqueFactors = torqueFactors;

    function applyImps() {
      E.forEach(e => { e.fac = 1; e.kmul = 1; e.fric = 1; });
      mass = m0.slice(); dampN = N.map(() => 1); extF = N.map(() => [0, 0, 0]); spacers = []; const fricN = N.map(() => 1);
      for (const im of S.imps) {
        if (im.type === 'torque') { const t = torqueFactors(im); t.out.forEach((f, k) => { E[k].fac *= f; }); im._zone = { cw: t.out, nw: new Map([[IDX[(JOINTS[im.joint].pivot).replace(/X$/, im.side || 'L')] ?? IDX[JOINTS[im.joint].pivot], 1]]), c: t.c }; continue; }
        const z = zone(im); im._zone = z;
        z.cw.forEach((w, k) => { const e = E[k];
          e.fac *= 1 - SHORTEN * (im.density - 1) * w;
          e.kmul *= 1 + (im.density - 1) * w;
          e.fric *= Math.pow(im.friction, w); });
        z.nw.forEach((w, j) => {
          mass[j] *= 1 + (im.mass - 1) * w;
          fricN[j] *= Math.pow(im.friction, w);
        });
        if (Math.abs(im.volume - 1) > 0.005) { const s = Math.cbrt(im.volume), nodes = [];
          z.nw.forEach((w, j) => { if (!FIXED.has(j)) nodes.push([j, v3.dist(O[j], z.c), w]); });
          spacers.push({ nodes, s, c0: z.c }); }
      }
      E.forEach(e => { e.restBase = e.strut ? e.rest0 : e.rest0 * Math.max(0.5, Math.min(1.6, e.fac)); e.k = e.strut ? K_STRUT : Math.min(K_MAX, e.k0 * e.kmul); });
      invm = mass.map((m, j) => FIXED.has(j) ? 0 : 1 / m);
      N.forEach((_, j) => { dampN[j] = DAMP * Math.pow(fricN[j], -0.12); extF[j] = [0, -G * (mass[j] - m0[j]), 0]; });
      S.mass = mass; S.moving = 1;
    }
    S.apply = applyImps;

    S.add = function (im) {
      const d = Object.assign({ id: nextId++, density: 1.9, friction: 1, mass: 1, volume: 1, radius: 9, age: 0 }, im);
      S.imps.push(d); applyImps(); return d;
    };
    S.update = function (im, patch) { Object.assign(im, patch); applyImps(); };
    S.remove = function (im) { S.imps = S.imps.filter(x => x !== im); applyImps(); };
    S.path = function (s, t) { // shortest cable path through the web, by hop count
      const prev = N.map(() => null), seen = new Set([s]), q = [s];
      while (q.length) { const u = q.shift(); if (u === t) break; for (const [v, k] of adj[u]) if (!seen.has(v)) { seen.add(v); prev[v] = [u, k]; q.push(v); } }
      const out = []; let v = t; while (prev[v]) { out.push(prev[v][1]); v = prev[v][0]; } return out;
    };
    S.lineEdges = (id, filt) => E.map((e, k) => [e, k]).filter(([e, k]) => !e.strut && e.lines.has(id) && (!filt || filt(e, k))).map(([, k]) => k);

    // ---------- physics: position-based dynamics ----------
    const restOf = e => e.strut ? e.rest0 : Math.max(e.rest0 * 0.45, e.restBase + e.slide);
    const isSlack = e => !e.strut && v3.dist(P[e.a], P[e.b]) < restOf(e) * 0.996;
    function step() {
      if (!OLD) OLD = P.map(p => [...p]);
      let mv = 0;
      const nxt = P.map((p, i) => { if (FIXED.has(i)) return [...O[i]]; const u = unsup ? unsup[i] : 0, d = dampN[i] + (DAMP_FALL - dampN[i]) * u, f = extF[i];
        return [p[0] + (p[0] - OLD[i][0]) * d + f[0], p[1] + (p[1] - OLD[i][1]) * d + f[1] - GRAV * u, p[2] + (p[2] - OLD[i][2]) * d + f[2]]; });
      OLD = P; P = nxt; S.P = P;
      for (let it = 0; it < ITERS; it++) {
        for (let k = 0; k < E.length; k++) {
          const e = E[k]; if (e.cut || e.released) continue;
          const pa = P[e.a], pb = P[e.b], dx = pb[0] - pa[0], dy = pb[1] - pa[1], dz = pb[2] - pa[2], d = Math.hypot(dx, dy, dz) || 1e-6;
          const rest = restOf(e);
          if (!e.strut && d < rest) continue; // cables only pull
          const wa = invm[e.a], wb = invm[e.b], w = wa + wb; if (!w) continue;
          const c = (d - rest) / d * e.k * 2, ca = c * wa / w, cb = c * wb / w;
          pa[0] += dx * ca; pa[1] += dy * ca; pa[2] += dz * ca; pb[0] -= dx * cb; pb[1] -= dy * cb; pb[2] -= dz * cb;
        }
        for (const sp of spacers) { // a local spacer: the zone holds a larger (or smaller) volume
          let c = [0, 0, 0], ws = 0; for (const [j, , w] of sp.nodes) { c = v3.add(c, v3.mul(P[j], w)); ws += w; } if (!ws) continue; c = v3.mul(c, 1 / ws);
          for (const [j, d0, w] of sp.nodes) { if (d0 < 0.5) continue; const p = P[j], v = v3.sub(p, c), d = v3.len(v) || 1e-6, target = d0 * (1 + (sp.s - 1) * w);
            const corr = (target - d) / d * 0.12; p[0] += v[0] * corr; p[1] += v[1] * corr; p[2] += v[2] * corr; }
        }
        for (let i = 0; i < P.length; i++) if (!FIXED.has(i)) { const p = P[i], o = O[i], t = unsup ? TONE * (1 - unsup[i]) : TONE; p[0] += (o[0] - p[0]) * t; p[1] += (o[1] - p[1]) * t; p[2] += (o[2] - p[2]) * t;
          if (unsup && p[1] < 0.6) { p[1] = 0.6; const q = OLD[i]; p[0] = q[0] + (p[0] - q[0]) * 0.4; p[2] = q[2] + (p[2] - q[2]) * 0.4; } }
      }
      // fascia slides along each line toward equal tension, unless friction at the shared node holds it
      if (sliding) for (const ch of chains) for (let i = 0; i + 1 < ch.length; i++) {
        const [k1, n] = ch[i], [k2] = ch[i + 1], e1 = E[k1], e2 = E[k2]; if (e1.cut || e2.cut || e1.released || e2.released) continue;
        const r1 = restOf(e1), r2 = restOf(e2), d1 = v3.dist(P[e1.a], P[e1.b]), d2 = v3.dist(P[e2.a], P[e2.b]);
        const T1 = e1.k * Math.max(0, d1 - r1) / r1 - e1.T0, T2 = e2.k * Math.max(0, d2 - r2) / r2 - e2.T0; if (Math.abs(T1 - T2) < 1e-7) continue;
        const fr = Math.max(e1.fric, e2.fric), rate = SLIDE / fr;
        const dd = (T1 - T2) / (e1.k * d1 / (r1 * r1) + e2.k * d2 / (r2 * r2)) * rate;
        const lim1 = 0.2 * e1.rest0, lim2 = 0.2 * e2.rest0;
        const dl = Math.max(-lim1 - e1.slide, Math.min(lim1 - e1.slide, Math.max(e2.slide - lim2, Math.min(e2.slide + lim2, dd))));
        e1.slide += dl; e2.slide -= dl;
      }
      for (let i = 0; i < P.length; i++) { const a = P[i], b = OLD[i]; const m = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]); if (m > mv) mv = m; }
      S.moving = mv;
      if (S.creep && S.imps.length) {
        S.months += 1 / 60;
        if (Math.floor(S.months * 2) !== Math.floor((S.months - 1 / 60) * 2)) { S.imps.forEach(im => { if (im.type !== 'torque') im.age = (im.age || 0) + 0.5; }); applyImps(); }
      }
    }
    S.step = step;
    S.settle = n => { for (let i = 0; i < n; i++) step(); };

    // ---------- computed quantities ----------
    function energy() { let s = 0; for (const e of E) { if (e.strut || e.cut || (FIXED.has(e.a) && FIXED.has(e.b))) continue; const r = restOf(e), d = v3.dist(P[e.a], P[e.b]); if (d > r) { const st = (d - r) / r; s += e.k * st * st * r; } } return s; }
    function asymmetry() { // RMS distance between each left node and the mirror image of its right partner
      let s = 0, n = 0; for (const nd of N) if (nd.side === 1) { const r = IDX[nd.base + 'R'], a = P[IDX[nd.name]], b = P[r]; s += (a[0] + b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; n++; }
      return Math.sqrt(s / n);
    }
    const ang = (a, b) => Math.atan2(a, b) * 180 / Math.PI;
    S.metrics = function (origin) {
      const R0 = base.P, g = n => P[IDX[n]], r = n => R0[IDX[n]];
      const pelvicTilt = p => { const asis = v3.mul(v3.add(p[IDX.asisL], p[IDX.asisR]), 0.5), s1 = p[IDX.s1]; return ang(asis[1] - s1[1], asis[2] - s1[2]); };
      const yawOf = (p, a, b) => ang(p[IDX[a]][2] - p[IDX[b]][2], p[IDX[a]][0] - p[IDX[b]][0]);
      const knee = (p, s) => { const f = p[IDX['kneeF' + s]], c = p[IDX['knee' + s]]; return ang(f[0] - c[0], f[2] - c[2]) * (s === 'L' ? -1 : 1); }; // + = kneecap turned inward
      let far = 0, rms = 0;
      for (let i = 0; i < N.length; i++) { const d = v3.dist(P[i], R0[i]); rms += d * d; if (origin && v3.dist(O[i], origin) > 40) far = Math.max(far, d); }
      rms = Math.sqrt(rms / N.length);
      let slack = 0; E.forEach((e, k) => { if (!e.cut && isSlack(e) && !base.slack[k]) slack++; });
      const en = energy(), asym = Math.max(0, asymmetry() - base.asym);
      const extra = Math.max(0, en / base.energy - 1);
      const head = (g('brow')[2] - r('brow')[2]);
      const load = 1 - Math.exp(-(0.35 * extra + 0.45 * asym + 0.35 * rms + 0.12 * Math.max(0, head)));
      return {
        height: g('top')[1] - r('top')[1], head,
        shoulders: (g('acromL')[1] - g('acromR')[1]) - (r('acromL')[1] - r('acromR')[1]),
        pelvis: (g('asisL')[1] - g('asisR')[1]) - (r('asisL')[1] - r('asisR')[1]),
        pelvicTilt: pelvicTilt(P) - pelvicTilt(R0),
        trunkTwist: (yawOf(P, 'acromL', 'acromR') - yawOf(P, 'asisL', 'asisR')) - (yawOf(R0, 'acromL', 'acromR') - yawOf(R0, 'asisL', 'asisR')),
        kneeL: knee(P, 'L') - knee(R0, 'L'), kneeR: knee(P, 'R') - knee(R0, 'R'),
        asym, rms, extra, far, slack, load, months: S.months
      };
    };
    S.nodeStrain = function () { // per node: mean positive strain of its cables above the healthy reference
      const out = N.map(() => 0), cnt = N.map(() => 0);
      E.forEach(e => { if (e.strut || e.cut) return; const r = restOf(e), d = v3.dist(P[e.a], P[e.b]); const st = Math.max(0, (d - r) / r - (1 - PRE) ); out[e.a] += st; out[e.b] += st; cnt[e.a]++; cnt[e.b]++; });
      const r = out.map((s, i) => cnt[i] ? s / cnt[i] : 0);
      if (!base.nodeStrain) return r;
      return r.map((v, i) => Math.max(0, v - base.nodeStrain[i]));
    };
    S.cableState = k => { const e = E[k], r = restOf(e), d = v3.dist(P[e.a], P[e.b]); return { strain: (d - r) / r, slack: !e.strut && d < r * 0.996, dense: e.strut ? 0 : Math.max(0, 1 - e.restBase / e.rest0), longer: e.restBase > e.rest0 * 1.002 }; };

    // ---------- scenarios: each is only a set of imperfections; the physics decides the rest ----------
    S.scenario = function (name) {
      S.reset(); const I = IDX, y = (k, f) => f(O[E[k].a]) && f(O[E[k].b]);
      const sc = SCENARIOS[name]; if (!sc) return null;
      const list = sc.make(S, I, y); list.forEach(im => S.add(im));
      return { text: sc.text, origin: list[0] && (list[0].node !== undefined ? O[list[0].node] : list[0].edges ? O[E[list[0].edges[0]].a] : O[I.hipR]) };
    };
    S.build();
    return S;
  }

  const SCENARIOS = {
    desk: { label: 'Desk posture', text: 'Desk posture: the upper front line, from the breastbone to the neck, densified (density 3.5). Watch the head and upper back.',
      make: (S, I, y) => [{ type: 'set', edges: S.lineEdges('sfl', (e, k) => y(k, p => p[1] > 95)).concat(S.lineEdges('dfl', (e, k) => y(k, p => p[1] > 115))), density: 3.5, radius: 0, node: I.stTop }] },
    back: { label: 'Tight lower back', text: '',
      make: (S, I) => [{ type: 'plane', node: I.tlf, normal: [0, 0, 1], radius: 15, density: 3.2, friction: 4 }] },
    hip: { label: 'One-sided hip', text: 'One-sided hip: the tissue around the right hip joint densified (density 3.5). Watch the shoulders and pelvis.',
      make: (S, I) => [{ type: 'point', node: I.hipR, radius: 11, density: 3.5 }] },
    foot: { label: 'Tight foot', text: 'Right foot: the plantar fascia densified (density 3.4). Look for effects far up the body.',
      make: (S, I, y) => [{ type: 'set', node: I.heelR, edges: S.E.map((e, k) => k).filter(k => !S.E[k].strut && y(k, p => p[1] < 12 && p[0] < 0)), density: 3.4, radius: 0 }] },
    hipIR: { label: 'Internal hip rotation', text: 'Internal hip rotation, right: the tissue that crosses the right hip was remodeled to the lengths a 20 degree inward twist would give it. The feet stay planted, so watch the kneecap, the knee and the pelvis.',
      make: (S, I) => [{ type: 'torque', joint: 'hip', side: 'R', angle: 20, node: I.hipR }] },
    trunk: { label: 'Twisted trunk', text: 'Twisted trunk: the tissue between the pelvis and the rib cage was remodeled to a 12 degree turn to the right. Watch the shoulders turn against the hips.',
      make: (S, I) => [{ type: 'torque', joint: 'trunk', angle: -12, node: I.l3 }] },
    scar: { label: 'Abdominal scar', text: 'A scar low on the right abdomen: dense (2.8) and sticky (friction 8), so fascia can no longer slide through it.',
      make: (S, I) => [{ type: 'point', node: I.abdR, radius: 7, density: 2.8, friction: 8 }] },
    belly: { label: 'Belly load', text: 'Belly load: the abdomen carries four times its mass and 80% more volume, with no change in density. Gravity and the spacer do the rest.',
      make: (S, I) => [{ type: 'point', node: I.navel, radius: 13, density: 1, mass: 4, volume: 1.8 }] },
    knee: { label: 'Knee injury', text: 'Knee injury, right: after an injury the tissue around the joint heals denser and stickier (density 3.2, friction 6), so the layers no longer slide. Watch the hip above it and the foot below.',
      make: (S, I) => [{ type: 'point', node: I.kneeR, radius: 9, density: 3.2, friction: 6 }] },
    elbow: { label: 'Tennis elbow', text: 'Tennis elbow, right: the tissue on the outside of the elbow, where the muscles that lift the wrist attach, densified (density 3.4). Watch the hand, the shoulder and the neck.',
      make: (S, I) => [{ type: 'point', node: I.elbowR, radius: 8, density: 3.4, friction: 3 }] },
    hams: { label: 'Tight hamstrings', text: 'Tight hamstrings: the back line between the sitting bones and the knees densified on both sides (density 3).',
      make: (S, I, y) => [{ type: 'set', node: I.ischL, edges: S.lineEdges('sbl', (e, k) => y(k, p => p[1] > 45 && p[1] < 90)), density: 3, radius: 0 }] }
  };

  root.UMSim = { SCENARIOS, create, LINES, JOINTS, v3 };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.UMSim;
})(typeof window !== 'undefined' ? window : globalThis);
