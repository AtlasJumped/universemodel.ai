// Universe Model: physics core of the 3D human tensegrity (teaching model).
// Runs in the browser (window.UMSim) and in Node (module.exports) so the physics can be tested headless.
//
// The skeleton is built from separate bones, jointed the way a real skeleton is: a ball joint is one shared point
// (hip, shoulder, each disc of the spine), a hinge is two shared points (knee, ankle, elbow). A bone is a rigid
// cluster of points. Nothing in the skeleton holds itself up: every joint is free to fold.
// Fascia is a web of tension-only cables. The named fascial lines follow the myofascial chains described in
// anatomy; a deep layer ties each bone to its neighbours across every joint. With the cables pre-tensioned the
// whole thing stands under real gravity, which acts on every point all the time. Cut cables or break a bone and
// whatever they were holding falls.
// An imperfection is a persistent change of tissue properties in a zone: density (shorter rest length and
// higher stiffness), friction (fascia cannot slide through the zone, motion there is damped), mass (heavier
// points), volume (a local spacer that pushes or pulls the zone) and a boundary radius. A torque imperfection
// remodels the cables that cross a joint to the lengths a twist would give them. Nothing about the resulting
// posture is scripted: it is the equilibrium the constraints find.
// Units are centimetres; y is up, z points forward, x to the body's left.
(function (root) {
  'use strict';
  // c = centre line, b = both sides (x given for the left; mirrored for the right). 1 = soft tissue anchor, not bone.
  const BASE0 = [
    // skull
    ['top','c',[0,183,-1]],['brow','c',[0,171,9]],['chin','c',[0,157,8]],['occ','c',[0,165,-9]],['ear','b',[7,166,0]],
    // the spine: the centres of the discs, top to bottom (each is a ball joint between two segments)
    ['c1','c',[0,158,-1.5]],['c3','c',[0,154.4,-1.2]],['c5','c',[0,150.7,-1.8]],['c7','c',[0,147,-3.5]],
    ['t2','c',[0,141.4,-5.2]],['t4','c',[0,135.4,-6.2]],['t6','c',[0,129,-6.5]],['t8','c',[0,122.6,-6.2]],['t10','c',[0,116.2,-5.4]],['t12','c',[0,110,-4.2]],
    ['l1','c',[0,106.6,-3]],['l2','c',[0,103.2,-2]],['l3','c',[0,99.8,-1.6]],['l4','c',[0,96.4,-2.4]],['s1','c',[0,93,-4.4]],
    // ribs (the outermost point of each pair) and breastbone
    ['ribA','b',[8.5,142.5,1.5]],['ribB','b',[12.5,137,2]],['ribUp','b',[14,132,2]],['ribC','b',[14.3,125,3]],['ribLow','b',[13,116,3]],['ribF','b',[11.5,110.5,-1.5]],
    ['stTop','c',[0,145,6]],['stMid','c',[0,133.5,9.8]],['xiph','c',[0,122,11]],
    // sacrum and the two hip bones
    ['sacA','c',[0,90.5,-2.2]],['sacMid','c',[0,88.5,-11.5]],['coccyx','c',[0,85,-9]],['si','b',[5,92,-9.5]],
    ['asis','b',[12,96,7]],['crest','b',[14,101,-3]],['psis','b',[4.5,95.5,-11.5]],['hip','b',[9,89,0]],['isch','b',[6,84,-6]],['pubis','c',[0,86,9]],
    // thigh bone, kneecap, shin bones, ankle bone, foot
    ['troch','b',[16,88,-1]],['femMid','b',[13,72,-0.2]],['knee','b',[9,49,1]],['kneeMed','b',[5,49,0]],['kneeLat','b',[13,49,0]],['condB','b',[9,50.5,-4.2]],
    ['kneeF','b',[9,50,6]],
    ['tibTub','b',[9,44,4]],['ankle','b',[9,9.5,-1]],['malMed','b',[6.2,7,-0.5]],['fibHead','b',[13.5,43.5,-2.5]],['malLat','b',[12,6.5,-2]],
    ['subF','b',[9,4.5,3.5]],['subB','b',[9,4,-3]],
    ['heel','b',[9,1,-6.5]],['ball','b',[9,1,11]],['ballLat','b',[13,1,8]],['ballMed','b',[5,1,10.5]],['toe','b',[8,0,16]],
    // shoulder blade, collarbone end, arm
    ['acrom','b',[19,146,-1]],['gh','b',[17.5,142.5,-1]],['scapInf','b',[10,126,-11]],['scapMed','b',[6.5,139.5,-10.5]],
    ['delt','b',[18.8,131,-1.2]],['elbow','b',[20.8,113.6,-1.6]],['elbowMed','b',[18.1,113.3,-1.6]],['elbowLat','b',[23.5,113.9,-1.6]],['olec','b',[20.8,115.8,-5.1]],
    ['wristU','b',[21.3,89.8,1]],['wristR','b',[24.9,89.9,2.2]],['wrist','b',[23.2,87.7,1.7]],['hand','b',[24.6,72.6,3.2]],
    // soft tissue anchors (muscle bellies and sheets the fascial lines pass through)
    ['navel','c',[0,104,13],1],['throat','c',[0,151,5],1],['diaphragm','c',[0,118,1],1],['tlf','c',[0,101,-13],1],
    ['scm','b',[4,152,3],1],['neckSide','b',[6,154,-2],1],['pec','b',[9,136,9],1],['lat','b',[12,118,-7],1],['abd','b',[11,104,9],1],['trunk','b',[15,110,0],1],
    ['psoas','b',[4.5,95,3],1],['tlfRaphe','b',[9,104,-9],1],['glute','b',[10,84,-10],1],
    ['thighF','b',[10,68,8],1],['thighB','b',[9,68,-8],1],['thighL','b',[15,70,0],1],['thighI','b',[4,70,0],1],
    ['calfB','b',[9,30,-7],1],['shinF','b',[9,30,5],1],['calfL','b',[12,28,-1],1],['calfI','b',[6,28,-1],1]
  ];
  // Spinal segments: [id, upper disc, lower disc, region, rib]. Neck and chest segments each stand for two vertebrae.
  const SPINE = [
    ['ce1','c1','c3','c'],['ce2','c3','c5','c'],['ce3','c5','c7','c'],
    ['th1','c7','t2','t','ribA'],['th2','t2','t4','t','ribB'],['th3','t4','t6','t','ribUp'],['th4','t6','t8','t','ribC'],['th5','t8','t10','t','ribLow'],['th6','t10','t12','t','ribF'],
    ['lu1','t12','l1','l'],['lu2','l1','l2','l'],['lu3','l2','l3','l'],['lu4','l3','l4','l'],['lu5','l4','s1','l']
  ];
  const LEVER = { c: { dx: 3, dz: 5, a: 2 }, t: { dx: 4, dz: 6.8 }, l: { dx: 4.5, dz: 7.5, a: 2.8 } };
  const BASE = (() => { // add each segment's processes: two at the back and side ('p'), and the front of the body ('a')
    const at = Object.fromEntries(BASE0.map(b => [b[0], b[2]])), out = BASE0.slice();
    for (const [id, up, lo, reg] of SPINE) { const u = at[up], l = at[lo], L = LEVER[reg], my = (u[1] + l[1]) / 2, mz = (u[2] + l[2]) / 2;
      out.push([id + 'p', 'b', [L.dx, my, mz - L.dz]]); if (L.a) out.push([id + 'a', 'c', [0, my, mz + L.a]]); }
    return out;
  })();
  // names the figure and the page use for places that are now part of the spine
  const ALIAS = { erector: 'th5p', erectorLow: 'lu4p', nape: 'ce3p' };

  // Bones. X = side. m = share of body mass. show = the parts drawn (and tappable) as bone: [from, to, width].
  const BONES = [
    { id:'skull', m:6, name:'skull', n:['top','brow','chin','occ','earL','earR','c1'], show:[] },
    { id:'sternum', m:1.5, name:'breastbone', n:['stTop','stMid','xiph'], show:[['stTop','stMid',1.5],['stMid','xiph',1.3]] },
    { id:'sacrum', m:3, name:'sacrum', n:['s1','sacA','sacMid','coccyx','siL','siR'], show:[['siL','siR',1.3],['siL','coccyx',1],['siR','coccyx',1],['s1','sacMid',1]] },
    { id:'hipbone', m:5.5, name:'hip bone', sided:true, n:['asisX','crestX','psisX','hipX','ischX','siX','pubis'],
      show:[['crestX','asisX',1.4],['crestX','psisX',1.4],['psisX','siX',1.1],['asisX','hipX',1.2],['siX','hipX',1.4],['hipX','ischX',1.3],['ischX','pubis',1],['hipX','pubis',1.1],['crestX','hipX',0.9]] },
    { id:'femur', m:13, name:'thigh bone', sided:true, n:['hipX','trochX','femMidX','kneeX','kneeMedX','kneeLatX','condBX'],
      show:[['hipX','trochX',1.5],['trochX','femMidX',2],['femMidX','kneeX',2],['kneeMedX','kneeLatX',2],['kneeX','condBX',1.2]] },
    { id:'patella', m:0.3, name:'kneecap', sided:true, n:['kneeFX'], show:[] },
    { id:'tibia', m:3.6, name:'shin bone', sided:true, n:['kneeMedX','kneeLatX','tibTubX','ankleX','malMedX'],
      show:[['kneeMedX','tibTubX',1.4],['kneeLatX','tibTubX',1.4],['tibTubX','ankleX',1.9],['ankleX','malMedX',1.3]] },
    { id:'fibula', m:0.6, name:'outer shin bone (fibula)', sided:true, n:['fibHeadX','malLatX'], show:[['fibHeadX','malLatX',1]] },
    { id:'talus', m:0.3, name:'ankle bone', sided:true, n:['malMedX','malLatX','subFX','subBX'], show:[['malMedX','malLatX',1.5],['malMedX','subFX',1],['malLatX','subFX',1],['malMedX','subBX',1],['malLatX','subBX',1]] },
    { id:'foot', m:1.1, name:'foot', sided:true, n:['heelX','ballX','ballLatX','ballMedX','toeX','subFX','subBX'],
      show:[['heelX','subBX',1.6],['subBX','subFX',1.5],['subFX','ballMedX',1.2],['subFX','ballX',1.2],['subFX','ballLatX',1.2],['heelX','ballLatX',1],['ballX','toeX',1],['ballMedX','toeX',1],['ballLatX','toeX',0.8]] },
    { id:'clavicle', m:0.4, name:'collarbone', sided:true, n:['stTop','acromX'], show:[['stTop','acromX',1.2]] },
    { id:'scapula', m:1.2, name:'shoulder blade', sided:true, n:['acromX','ghX','scapInfX','scapMedX'],
      show:[['acromX','ghX',1.3],['acromX','scapMedX',1],['scapMedX','scapInfX',1],['ghX','scapInfX',1]] },
    { id:'humerus', m:2.7, name:'upper arm bone', sided:true, n:['ghX','deltX','elbowX','elbowMedX','elbowLatX'],
      show:[['ghX','deltX',1.6],['deltX','elbowX',1.6],['elbowMedX','elbowLatX',1.6]] },
    { id:'ulna', m:0.9, name:'forearm bone (ulna)', sided:true, n:['elbowMedX','elbowLatX','olecX','wristUX'],
      show:[['olecX','elbowMedX',1.1],['olecX','elbowLatX',1.1],['elbowMedX','wristUX',1.2]] },
    { id:'radius', m:0.7, name:'forearm bone (radius)', sided:true, n:['elbowLatX','wristRX'], show:[['elbowLatX','wristRX',1.2]] },
    { id:'carpus', m:0.2, name:'wrist', sided:true, n:['wristRX','wristUX','wristX'], show:[['wristRX','wristX',1.3],['wristUX','wristX',1.3]] },
    { id:'handbone', m:0.5, name:'hand', sided:true, n:['wristX','handX'], show:[['wristX','handX',1.8]] }
  ];
  for (const [id, up, lo, reg, rib] of SPINE) BONES.push({ id, seg: reg, m: reg === 'c' ? 1.6 : reg === 't' ? 3.3 : 2.6, w: reg === 't' ? [0.08, 0.08, 0.14, 0.14, 0.28, 0.28] : reg === 'l' ? [0.1, 0.1, 0.2, 0.2, 0.4] : null, name: reg === 'c' ? 'neck vertebrae' : reg === 't' ? 'chest vertebrae and ribs' : 'lower back vertebra',
    n: [up, lo, id + 'pL', id + 'pR'].concat(reg === 't' ? [rib + 'L', rib + 'R'] : [id + 'a']),
    show: [[up, lo, reg === 'l' ? 2.6 : reg === 't' ? 2.2 : 1.8]],
    rib });
  // Ligaments and joint surfaces that keep bones in contact. They hold both ways, are not drawn and cannot be cut.
  const LIGS = ['*psis-sacMid','*isch-coccyx','*psis-s1','*fibHead-kneeMed','*fibHead-kneeLat','*fibHead-tibTub','*malLat-ankle','*malLat-malMed','*malLat-tibTub',
    '*kneeF-kneeMed','*kneeF-kneeLat','*wristR-wristU'];
  // Contact: the hanging arm rests against the side of the body and the shoulder blade lies on the ribs. These only push, when the two points come closer than at rest.
  const GAPS = ['*hand-thighL','*wrist-troch','*elbow-ribLow','*elbow-crest','*wrist-thighL','*hand-troch',
    '*scapInf-t6','*scapInf-t8','*scapInf-ribC','*scapInf-ribUp','*scapMed-t2','*scapMed-t4','*scapMed-ribB'];
  // Rib cartilage: springy both ways, softer than bone.
  const CART = ['*ribA-stTop','*ribB-stTop','*ribB-stMid','*ribUp-stMid','*ribC-stMid','*ribC-xiph','*ribLow-xiph'];

  // Fascial lines. 'X' = this side, 'Y' = opposite side, '|' starts a new stretch, '!' = the fascia is anchored to bone here.
  const LINES = [
    { id:'sbl', name:'Superficial back line', color:'#2F6FD6', path:'toeX ballX heelX! calfBX condBX!|calfBX fibHeadX!|fibHeadX thighBX ischX!|sacMid! lu5pX lu4pX lu3pX lu2pX lu1pX th6pX th5pX th4pX th3pX th2pX th1pX ce3pX ce2pX ce1pX occ! top brow' },
    { id:'sfl', name:'Superficial front line', color:'#0F9C8E', path:'toeX shinFX tibTubX!|tibTubX kneeFX!|kneeFX thighFX asisX!|pubis! navel xiph!|stTop! scmX earX!' },
    { id:'ll',  name:'Lateral line', color:'#7C4DD6', path:'ballLatX calfLX fibHeadX!|fibHeadX thighLX trochX crestX!|crestX trunkX ribLowX!|crestX ribFX|ribFX ribLowX ribCX ribUpX ribBX ribAX neckSideX earX!' },
    { id:'spl', name:'Spiral line', color:'#E0861A', path:'earX th1pY scapMedY!|scapInfY ribLowY navel asisX!|asisX thighLX fibHeadX!|tibTubX shinFX ballMedX|ballLatX calfLX fibHeadX|fibHeadX thighBX ischX' },
    { id:'dfl', name:'Deep front line', color:'#0B6E8F', path:'ballMedX calfIX kneeMedX!|kneeMedX thighIX pubis!|thighIX psoasX lu4a|psoasX lu2a|sacA! lu5a lu4a lu3a lu2a lu1a diaphragm xiph!|diaphragm stMid|stTop! throat chin!|stTop ce3a ce2a ce1a chin' },
    { id:'arm', name:'Arm lines', color:'#5B6B82', path:'pecX deltX!|latX deltX|occ acromX!|acromX deltX|deltX wristRX handX|ghX olecX|th1pX acromX|th2pX scapMedX|th4pX scapMedX|th5pX scapInfX|ribUpX scapInfX|pecX stMid|olecX wristUX handX' },
    { id:'fun', name:'Functional lines', color:'#B0479E', path:'pecX abdX pubis!|pubis thighIY|latX tlf gluteY thighLY kneeFY' },
    { id:'tlf', name:'Thoracolumbar fascia', color:'#C2412D', path:'latX tlfRapheX tlf|tlfRapheX abdX|lu4pX tlf|tlfRapheX crestX|tlf sacMid|tlfRapheX ribLowX|tlfRapheX ribFX|gluteX tlf|th6pX tlfRapheX|psisX tlf|lu2pX tlfRapheX' },
    { id:'rot', name:'Deep hip, thigh and knee muscles', color:'#6E8B1E', path:'sacMid trochX|crestX trochX|ischX trochX|asisX trochX|psisX gluteX femMidX!|gluteX trochX|ischX femMidX|pubis femMidX|asisX femMidX|psoasX femMidX|femMidX kneeFX|trochX kneeFX|asisX kneeMedX|ischX thighIX|condBX fibHeadX|kneeLatX calfIX' }
  ];
  const FIXED_NAMES = ['heel','ball','ballLat','ballMed','toe','subF','subB'].flatMap(n => [n + 'L', n + 'R']);
  // Joints that can be twisted. Distal points rotate about the axis pivot -> to in the tissue's rest geometry.
  const UPPER = /^(top|brow|chin|occ|ear|c[1357]|t\d+|ce\d|th\d|rib|st[TM]|xiph|acrom|gh|scap|delt|elbow|olec|wrist|hand|throat|diaphragm|scm|neckSide|pec|lat$|trunk)/;
  const JOINTS = {
    hip:   { label:'hip', sided:true, pivot:'hipX', to:'kneeX', front:'kneeFX', distal:['kneeX','kneeFX','kneeLatX','kneeMedX','condBX','trochX','femMidX','thighFX','thighBX','thighLX','thighIX'], pos:'internal', neg:'external' },
    knee:  { label:'knee (shin bone)', sided:true, pivot:'kneeX', to:'ankleX', front:'tibTubX', distal:['tibTubX','fibHeadX','shinFX','calfBX','calfLX','calfIX'], pos:'internal', neg:'external' },
    trunk: { label:'trunk', sided:false, pivot:'l3', to:'c7', front:'stTop', distal: n => UPPER.test(n.base) && n.base !== 't12', pos:'to the left', neg:'to the right' },
    neck:  { label:'head and neck', sided:false, pivot:'c7', to:'top', front:'brow', distal: n => /^(top|brow|chin|occ|ear|c[135]|ce[12])/.test(n.base), pos:'to the left', neg:'to the right' }
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

  // physics constants (overridable for tests through create({ C: {...} }))
  const DEF = {
    PRE_LINE: 0.997, PRE_DEEP: 0.997, PRE_WEB: 0.997,   // healthy pretension: cables rest shorter than their length
    K_WEB: 0.03, K_LINE: 0.3, K_DEEP: 0.1, K_STRUT: 0.25, K_CART: 0.1, K_GAP: 0.25, K_MAX: 0.4,
    SUB: 48, ITERS: 1,        // sub-steps per step, and solver passes per sub-step
    GRAV: 0.2725,             // gravity on every point: 981 cm/s2 with one step = 1/60 s
    DAMP: 0.9, DAMP_FALL: 0.97, V0: 0.05,  // slow motion is damped by the tissue; a falling part is not held back
    FLOOR: 0.4, FLOOR_FRICTION: 0.5,
    M_SOFT: 1,                // mass of a soft tissue anchor; the bones carry the body's mass in realistic shares
    WEB_K: 5, WEB_R: 24, BULK_K: 3,
    SLIDE: 0.15, SLIDE_DEAD: 1e-3,             // how fast fascia slides along a line to even out tension (healthy, low friction)
    SHORTEN: 0.015,           // rest-length shortening per unit of added relative density
    SETTLE: 240
  };
  // The healthy standing shape, found once by letting each reference body settle under gravity (regenerate with the
  // reference script whenever the model changes; if it does not match, the body is settled when the page loads).
  /*REF-BEGIN*/const REF = {"male":{"n":190,"e":1301,"P":[0,182.0427,-0.4391,0,169.9577,9.4606,0,155.9652,8.3383,0,164.1082,-8.5902,6.9993,165.0366,0.4179,-6.9993,165.0366,0.4179,0,157.0556,-1.1463,0,153.4775,-0.8551,0,149.801,-1.4822,0,146.1426,-3.2219,0,140.5875,-4.9782,0,134.6252,-6.0399,0,128.2588,-6.4045,0,121.9,-6.1671,0,115.546,-5.3818,0,109.3967,-4.1755,0,106.0733,-2.9353,0,102.7428,-1.8796,0,99.3983,-1.4297,0,96.0635,-2.2618,0,92.7231,-4.2761,8.502,141.598,1.729,-8.502,141.598,1.729,12.5049,136.126,2.1657,-12.5049,136.126,2.1657,14.0042,131.1471,2.116,-14.0042,131.1471,2.116,14.3006,124.1592,3.0498,-14.3006,124.1592,3.0498,13.0092,115.2923,2.989,-13.0092,115.2923,2.989,11.4991,109.8101,-1.5001,-11.4991,109.8101,-1.5001,0,144.0958,6.2393,0,132.5696,9.9411,0,121.0687,11.0853,0,90.2227,-2.0931,0,88.2944,-11.4091,0,84.7783,-8.9395,4.9925,91.8108,-9.3933,-4.9925,91.8108,-9.3933,11.9795,95.7927,7.1323,-11.9795,95.7927,7.1323,13.9193,100.8595,-2.8531,-13.9193,100.8595,-2.8531,4.4754,95.3162,-11.3815,-4.4754,95.3162,-11.3815,8.9555,88.8603,0.1202,-8.9555,88.8603,0.1202,5.9887,83.8177,-5.8866,-5.9887,83.8177,-5.8866,0,85.7463,9.1162,15.9506,87.8847,-0.9266,-15.9506,87.8847,-0.9266,13.024,71.8811,-0.1052,-13.024,71.8811,-0.1052,9.0424,48.8846,1.2847,-9.0424,48.8846,1.2847,5.024,48.8739,0.355,-5.024,48.8739,0.355,13.0255,48.8774,0.209,-13.0255,48.8774,0.209,8.949,50.3521,-3.9248,-8.949,50.3521,-3.9248,9.1476,49.9292,6.2524,-9.1476,49.9292,6.2524,9.1057,43.885,4.2833,-9.1057,43.885,4.2833,8.9945,9.3871,-0.8459,-8.9945,9.3871,-0.8459,6.142,6.9028,-0.4967,-6.142,6.9028,-0.4967,13.4976,43.4298,-2.3223,-13.4976,43.4298,-2.3223,11.9941,6.4452,-1.9916,-11.9941,6.4452,-1.9916,9,4.5,3.5,-9,4.5,3.5,9,4,-3,-9,4,-3,9,1,-6.5,-9,1,-6.5,9,1,11,-9,1,11,13,1,8,-13,1,8,5,1,10.5,-5,1,10.5,8,0,16,-8,0,16,18.9815,145.1298,-0.7885,-18.9815,145.1298,-0.7885,17.3881,141.6684,-0.7861,-17.3881,141.6684,-0.7861,9.9959,125.2473,-11.0027,-9.9959,125.2473,-11.0027,6.6448,138.791,-10.6131,-6.6448,138.791,-10.6131,18.7972,130.1734,-1.0288,-18.7972,130.1734,-1.0288,21.4247,112.8608,-0.3337,-21.4247,112.8608,-0.3337,18.8424,112.5172,0.4381,-18.8424,112.5172,0.4381,24.0138,113.2087,-1.0788,-24.0138,113.2087,-1.0788,20.416,115.1973,-3.5783,-20.416,115.1973,-3.5783,22.7832,88.9954,1.0471,-22.7832,88.9954,1.0471,25.2834,89.4128,3.8731,-25.2834,89.4128,3.8731,23.968,87.1018,2.9209,-23.968,87.1018,2.9209,26.8273,72.2115,4.4441,-26.8273,72.2115,4.4441,0,103.691,13.1138,0,150.0973,5.3154,0,117.3629,1.0597,0,100.645,-12.8741,4.0072,151.0573,3.3086,-4.0072,151.0573,3.3086,5.9968,153.0866,-1.6597,-5.9968,153.0866,-1.6597,8.9846,135.069,9.142,-8.9846,135.069,9.142,12.0652,117.2785,-7.0176,-12.0652,117.2785,-7.0176,10.7517,103.7217,9.221,-10.7517,103.7217,9.221,14.9724,109.2685,0.0342,-14.9724,109.2685,0.0342,4.53,94.6374,3.1067,-4.53,94.6374,3.1067,8.97,103.4656,-8.7461,-8.97,103.4656,-8.7461,10.0108,83.8356,-9.8551,-10.0108,83.8356,-9.8551,10.0285,67.9191,8.1111,-10.0285,67.9191,8.1111,8.9201,67.8227,-7.8167,-8.9201,67.8227,-7.8167,15.0457,69.8952,0.1242,-15.0457,69.8952,0.1242,4.0399,69.8194,0.1009,-4.0399,69.8194,0.1009,9.0271,29.9144,-6.7562,-9.0271,29.9144,-6.7562,9.1337,29.8874,5.1733,-9.1337,29.8874,5.1733,12.0171,27.9423,-0.896,-12.0171,27.9423,-0.896,6.0225,27.9409,-0.783,-6.0225,27.9409,-0.783,3.0017,155.3158,-6.0011,-3.0017,155.3158,-6.0011,0,155.2687,1.0067,2.9978,151.6791,-6.1737,-2.9978,151.6791,-6.1737,0,151.6276,0.8282,3.0017,148.0138,-7.3521,-3.0017,148.0138,-7.3521,0,147.9422,-0.3485,4.0023,143.4293,-10.9009,-4.0023,143.4293,-10.9009,4.0027,137.6726,-12.3116,-4.0027,137.6726,-12.3116,4.0044,131.5021,-13.0241,-4.0044,131.5021,-13.0241,4.0045,125.1308,-13.0916,-4.0045,125.1308,-13.0916,4.0035,118.7423,-12.5872,-4.0035,118.7423,-12.5872,4.0023,112.4611,-11.5878,-4.0023,112.4611,-11.5878,4.499,107.6725,-11.0644,-4.499,107.6725,-11.0644,0,107.7834,-0.7534,4.5033,104.2993,-9.9104,-4.5033,104.2993,-9.9104,0,104.4648,0.3936,4.5001,100.9495,-9.1592,-4.5001,100.9495,-9.1592,0,101.1081,1.1452,4.5026,97.7964,-9.3485,-4.5026,97.7964,-9.3485,0,97.7135,0.9589,4.4996,94.4799,-10.7714,-4.4996,94.4799,-10.7714,0,94.3842,-0.4719]},"female":{"n":190,"e":1302,"P":[0,168.8384,-3.5284,0,158.0029,6.1258,0,144.9724,5.623,0,151.8782,-10.403,6.5021,153.0871,-2.0778,-6.5021,153.0871,-2.0778,0,145.6193,-3.2223,0,142.3101,-2.8144,0,138.8751,-3.2574,0,135.4168,-4.7371,0,130.1992,-6.1618,0,124.6324,-6.9314,0,118.7178,-7.0414,0,112.8305,-6.6012,0,106.972,-5.6636,0,101.3217,-4.3226,0,98.2974,-3.0433,0,95.2558,-1.9617,0,92.189,-1.466,0,89.1351,-2.2766,0,86.0522,-4.1397,7.1084,131.3788,0.0267,-7.1084,131.3788,0.0267,10.4545,126.3131,0.6337,-10.4545,126.3131,0.6337,11.7089,121.6969,0.7655,-11.7089,121.6969,0.7655,13.2856,115.2463,1.8761,-13.2856,115.2463,1.8761,12.0799,106.9681,2.1186,-12.0799,106.9681,2.1186,10.685,101.8286,-1.8504,-10.685,101.8286,-1.8504,0,133.8604,4.1212,0,123.2948,7.9781,0,112.6548,9.424,0,83.7415,-2.1037,0,81.9275,-10.7557,0,78.6681,-8.4495,5.0995,85.2144,-8.8939,-5.0995,85.2144,-8.8939,12.2447,89.0259,6.4327,-12.2447,89.0259,6.4327,14.2121,93.6839,-2.8746,-14.2121,93.6839,-2.8746,4.5606,88.4599,-10.7582,-4.5606,88.4599,-10.7582,9.1522,82.5501,-0.0344,-9.1522,82.5501,-0.0344,6.1267,77.8133,-5.5806,-6.1267,77.8133,-5.5806,0,79.7046,8.3466,16.2998,81.6429,-1.0161,-16.2998,81.6429,-1.0161,12.082,66.7751,-0.1718,-12.082,66.7751,-0.1718,8.4189,45.4135,1.1863,-8.4189,45.4135,1.1863,4.6765,45.4018,0.3671,-4.6765,45.4018,0.3671,12.1069,45.4077,0.1437,-12.1069,45.4077,0.1437,8.2752,46.7709,-3.6534,-8.2752,46.7709,-3.6534,8.5736,46.3859,5.7994,-8.5736,46.3859,5.7994,8.5117,40.7682,3.9741,-8.5117,40.7682,3.9741,8.3612,8.7193,-0.7845,-8.3612,8.7193,-0.7845,5.7082,6.4128,-0.4616,-5.7082,6.4128,-0.4616,12.5246,40.3413,-2.2024,-12.5246,40.3413,-2.2024,11.1445,5.9837,-1.85,-11.1445,5.9837,-1.85,8.3607,4.1803,3.2514,-8.3607,4.1803,3.2514,8.3607,3.7158,-2.7869,-8.3607,3.7158,-2.7869,8.3607,0.929,-6.0383,-8.3607,0.929,-6.0383,8.3607,0.929,10.2186,-8.3607,0.929,10.2186,12.0765,0.929,7.4317,-12.0765,0.929,7.4317,4.6448,0.929,9.7541,-4.6448,0.929,9.7541,7.4317,0,14.8634,-7.4317,0,14.8634,15.8681,134.5494,-2.4398,-15.8681,134.5494,-2.4398,14.5736,131.3136,-2.3194,-14.5736,131.3136,-2.3194,8.3782,115.7148,-11.21,-8.3782,115.7148,-11.21,5.4276,128.263,-11.1088,-5.4276,128.263,-11.1088,15.9389,120.6625,-1.9127,-15.9389,120.6625,-1.9127,18.8303,104.713,-0.6315,-18.8303,104.713,-0.6315,20.1435,104.7586,-2.4901,-20.1435,104.7586,-2.4901,17.3525,104.6329,1.0982,-17.3525,104.6329,1.0982,20.6231,107.4753,1.1772,-20.6231,107.4753,1.1772,23.075,82.8798,-1.0054,-23.075,82.8798,-1.0054,19.9627,82.3418,-1.584,-19.9627,82.3418,-1.584,21.6924,80.6979,-0.7368,-21.6924,80.6979,-0.7368,22.8453,66.6093,-0.2289,-22.8453,66.6093,-0.2289,0,96.4003,11.9545,0,139.3968,3.039,0,108.8874,0.2727,0,93.5178,-12.0824,3.7224,140.2226,1.1414,-3.7224,140.2226,1.1414,5.571,141.9156,-3.5454,-5.571,141.9156,-3.5454,7.5115,125.5845,7.1504,-7.5115,125.5845,7.1504,10.9901,108.6965,-7.1015,-10.9901,108.6965,-7.1015,9.9175,96.3785,8.2209,-9.9175,96.3785,8.2209,13.8288,101.7083,-0.1756,-13.8288,101.7083,-0.1756,4.2439,87.7968,2.6732,-4.2439,87.7968,2.6732,6.6648,96.436,-5.9009,-6.6648,96.436,-5.9009,10.2306,77.8156,-9.2757,-10.2306,77.8156,-9.2757,9.3583,63.1037,7.4857,-9.3583,63.1037,7.4857,8.2874,62.9474,-7.3169,-8.2874,62.9474,-7.3169,15.3375,64.9264,0.0018,-15.3375,64.9264,0.0018,3.739,64.8528,0.0753,-3.739,64.8528,0.0753,8.323,27.7884,-6.2811,-8.323,27.7884,-6.2811,8.5425,27.7662,4.8122,-8.5425,27.7662,4.8122,11.165,25.9528,-0.8483,-11.165,25.9528,-0.8483,5.595,25.9542,-0.691,-5.595,25.9542,-0.691,2.7888,143.8176,-7.6613,-2.7888,143.8176,-7.6613,0,144.0441,-1.1551,2.7854,140.4396,-7.6829,-2.7854,140.4396,-7.6829,0,140.6573,-1.1815,2.7885,136.9989,-8.6402,-2.7885,136.9989,-8.6402,0,137.1926,-2.1359,3.718,132.6132,-11.7652,-3.718,132.6132,-11.7652,3.7191,127.2294,-12.8637,-3.7191,127.2294,-12.8637,3.7211,121.4854,-13.3038,-3.7211,121.4854,-13.3038,3.7212,115.5886,-13.1416,-3.7212,115.5886,-13.1416,3.7196,109.6833,-12.4595,-3.7196,109.6833,-12.4595,3.7174,103.8831,-11.3188,-3.7174,103.8831,-11.3188,4.1853,99.4586,-10.6468,-4.1853,99.4586,-10.6468,0,99.9631,-1.0819,4.1762,96.4258,-9.4742,-4.1762,96.4258,-9.4742,0,96.9128,0.0983,4.1951,93.4038,-8.6686,-4.1951,93.4038,-8.6686,0,93.8001,0.8903,4.1796,90.8053,-8.8484,-4.1796,90.8053,-8.8484,0,90.6395,0.7363,4.1812,87.6738,-10.1791,-4.1812,87.6738,-10.1791,0,87.5946,-0.6097]}};/*REF-END*/
  let nextId = 1;

  function create(opt) {
    const C = Object.assign({}, DEF, opt && opt.C);
    const S = { sex: (opt && opt.sex) || 'male', HEIGHT: 183, LINES, JOINTS, BASE, BONES, C, imps: [], months: 0, creep: false };
    let sliding = true, N, IDX, E, adj, FIXED, P, O, OLD, chains, bands, m0, mass, invm, dampN, spacers, base, CAB, STR, bones;

    S.build = function (sex) {
      if (sex) S.sex = sex;
      const female = S.sex === 'female', sc = female ? 170 / 183 : 1;
      const shoulder = female ? 0.9 : 1, pelvis = female ? 1.1 : 1;
      N = []; IDX = {};
      for (const [name, kind, [x, y, z], soft] of BASE) {
        const wide = /^(acrom|gh|scap|ribA|ribB|ribUp|delt|elbow|olec|wrist|hand|pec)/.test(name) ? shoulder : /^(asis|crest|psis|hip|troch|glute|thighL|isch|si)/.test(name) ? pelvis : 1;
        const add = (nm, xx) => { IDX[nm] = N.length; N.push({ name: nm, base: name, p0: [xx * wide * sc, y * sc, z * sc], soft: !!soft, side: kind === 'c' ? 0 : xx > 0 ? 1 : -1, rb: [] }); };
        if (kind === 'c') add(name, x); else { add(name + 'L', x); add(name + 'R', -x); }
      }
      for (const [a, b] of Object.entries(ALIAS)) for (const s of ['L', 'R']) IDX[a + s] = IDX[b + s];
      S.HEIGHT = Math.round(183 * sc);
      FIXED = new Set(FIXED_NAMES.map(n => IDX[n]));
      E = []; const key = new Map();
      const addEdge = (a, b, strut, line, extra) => {
        if (a === undefined || b === undefined || a === b) return -1;
        const k = Math.min(a, b) + '-' + Math.max(a, b);
        if (key.has(k)) { const e = E[key.get(k)]; if (line && !e.strut) e.lines.add(line); if (extra && !e.strut && extra.deep) e.deep = true; return key.get(k); }
        key.set(k, E.length); E.push(Object.assign({ a, b, strut, lines: new Set(line ? [line] : []) }, extra)); return E.length - 1;
      };
      // bones: every pair of points of a bone is held at a fixed distance
      bones = [];
      for (const B of BONES) for (const s of B.sided ? ['L', 'R'] : ['']) {
        const nm = t => IDX[t.replace(/X$/, s)], uid = B.id + s, ids = B.n.map(nm);
        if (ids.some(i => i === undefined)) throw new Error('unknown point in bone ' + uid);
        const rec = { uid, def: B, side: s, ids, name: B.name + (s ? (s === 'L' ? ' (left)' : ' (right)') : '') };
        bones.push(rec); ids.forEach((i, q) => { N[i].rb.push(uid); N[i].m = (N[i].m || 0) + (B.m || 1) * (B.w ? B.w[q] : 1 / ids.length); });
        for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) addEdge(ids[i], ids[j], true, null, { bone: uid, show: 0 });
        for (const [a, b, w] of B.show) { const k = key.get(Math.min(nm(a), nm(b)) + '-' + Math.max(nm(a), nm(b))); if (k !== undefined && !E[k].show) { E[k].show = w; if (E[k].bone !== uid) E[k].bone2 = uid; } }
      }
      const pairDef = (list, extra) => { for (const d of list) { const [a, b] = d.replace('*', '').split('-');
        if (d[0] === '*') { addEdge(IDX[a + 'L'] ?? IDX[a], IDX[b + 'L'] ?? IDX[b], true, null, Object.assign({}, extra)); addEdge(IDX[a + 'R'] ?? IDX[a], IDX[b + 'R'] ?? IDX[b], true, null, Object.assign({}, extra)); }
        else addEdge(IDX[a], IDX[b], true, null, Object.assign({}, extra)); } };
      pairDef(LIGS, { lig: true, show: 0 }); pairDef(CART, { cart: true, show: 0.7 }); pairDef(GAPS, { gap: true, lig: true, show: 0 });
      // fascial lines
      chains = []; bands = [];
      for (const L of LINES) for (const side of ['L', 'R']) for (const seg of L.path.split('|')) {
        const opp = side === 'L' ? 'R' : 'L', toks = seg.trim().split(/\s+/), anchor = toks.map(t => /!$/.test(t));
        const ids = toks.map(t => { const b = t.replace(/!$/, ''), n = IDX[b.replace(/X$/, side).replace(/Y$/, opp)] ?? IDX[b]; if (n === undefined) throw new Error('unknown point ' + t); return n; });
        let chain = [];
        const flush = () => { if (chain.length > 1) chains.push(chain); if (chain.length) bands.push(chain.map(c => c[0])); chain = []; };
        for (let i = 0; i + 1 < ids.length; i++) {
          const k = addEdge(ids[i], ids[i + 1], false, L.id);
          // fascia is anchored where a line meets bone along a strut, and wherever the path marks an anchor
          if (k < 0 || E[k].strut) { flush(); continue; }
          chain.push([k, ids[i + 1]]);
          if (anchor[i + 1]) flush();
        }
        flush();
      }
      // the deep layer: every joint of the spine is guyed all round, from the processes of one segment to the next
      const lev = (id, reg, rib) => reg === 't' ? [[id + 'pL', 1], [id + 'pR', -1], [rib + 'L', 1], [rib + 'R', -1]] : [[id + 'pL', 1], [id + 'pR', -1], [id + 'a', 0]];
      const sets = [[['occ', 0], ['earL', 1], ['earR', -1], ['chin', 0]]].concat(SPINE.map(([id, , , reg, rib]) => lev(id, reg, rib)), [[['sacMid', 0], ['sacA', 0], ['psisL', 1], ['psisR', -1], ['crestL', 1], ['crestR', -1]]]);
      for (let i = 0; i + 1 < sets.length; i++) for (const [a, sa] of sets[i]) for (const [b, sb] of sets[i + 1]) {
        const ra = /^rib/.test(a), rb = /^rib/.test(b); if ((ra || rb) && sa * sb < 0) continue; // nothing runs straight through the chest
        addEdge(IDX[a], IDX[b], false, null, { deep: true });
      }
      // the general fascial web: each point to its nearest neighbours on other bones
      // No strand of the web runs from one leg to the other, or from a hanging arm to the trunk: those are not joined by tissue.
      const ARM = /^(delt|elbow|olec|wrist|hand)/, LEG = /^(femMid|knee|condB|tibTub|ankle|mal|fibHead|sub|heel|ball|toe|thigh|calf|shin)/;
      const limb = n => ARM.test(n.base) ? 'arm' + n.side : LEG.test(n.base) ? 'leg' + n.side : 'core';
      const same = (i, j) => { if ((FIXED.has(i) && FIXED.has(j)) || N[i].rb.some(u => N[j].rb.includes(u))) return true;
        const a = limb(N[i]), b = limb(N[j]); return a !== b && (a[0] === 'a' || b[0] === 'a' || (a !== 'core' && b !== 'core')); };
      N.forEach((n, i) => { const c = N.map((m, j) => [j, v3.dist(n.p0, m.p0)]).filter(([j, d]) => j !== i && d < C.WEB_R * sc && !same(i, j)).sort((x, y) => x[1] - y[1]);
        const lim = c.length > C.WEB_K ? c[C.WEB_K - 1][1] + 1e-6 : 1e9; c.filter(([, d]) => d <= lim).forEach(([j]) => addEdge(i, j, false)); });
      // bulk: a muscle belly or the contents of the abdomen cannot be squeezed into the bone beneath it. Each soft
      // anchor is held off its nearest bone points by links that only push.
      N.forEach((n, i) => { if (!n.soft) return; const c = N.map((m, j) => [j, v3.dist(n.p0, m.p0)]).filter(([j]) => !N[j].soft).sort((x, y) => x[1] - y[1]);
        const lim = c[C.BULK_K - 1][1] + 1e-6; c.filter(([, d]) => d <= lim).forEach(([j]) => { const k = 'g' + Math.min(i, j) + '-' + Math.max(i, j); if (!key.has(k)) { key.set(k, E.length); E.push({ a: i, b: j, strut: true, lines: new Set(), gap: true, lig: true, bulk: true, show: 0 }); } }); });
      E.forEach(e => { e.L0 = v3.dist(N[e.a].p0, N[e.b].p0);
        e.rest0 = e.L0 * (e.strut ? 1 : e.lines.size ? C.PRE_LINE : e.deep ? C.PRE_DEEP : C.PRE_WEB);
        e.k0 = e.strut ? (e.cart ? C.K_CART : e.gap ? C.K_GAP : C.K_STRUT) : e.lines.size ? C.K_LINE : e.deep ? C.K_DEEP : C.K_WEB; e.slide = 0; });
      adj = N.map(() => []); E.forEach((e, k) => { if (!e.strut) { adj[e.a].push([e.b, k]); adj[e.b].push([e.a, k]); } });
      CAB = []; STR = []; E.forEach((e, k) => (e.strut ? STR : CAB).push(k)); X = null;
      O = N.map(n => [...n.p0]);
      m0 = N.map(n => n.soft ? C.M_SOFT : Math.max(0.05, n.m || 0.3));
      S.N = N; S.IDX = IDX; S.E = E; S.adj = adj; S.FIXED = FIXED; S.O = O; S.bones = bones; S.chains = chains; S.bands = bands;
      // settle the healthy body once under gravity and keep it as the reference
      S.imps = []; S.months = 0; applyImps();
      P = O.map(p => [...p]); OLD = null; E.forEach(e => { e.slide = 0; e.T0 = 0; e.cut = false; e.broken = false; e.released = false; });
      const ref = !C.NOREF && REF[S.sex]; S.fromRef = !!(ref && ref.n === N.length && ref.e === E.length);
      if (S.fromRef) P = N.map((_, i) => FIXED.has(i) ? [...O[i]] : [ref.P[3 * i], ref.P[3 * i + 1], ref.P[3 * i + 2]]);
      sliding = false; for (let i = 0, n = S.fromRef ? 20 : C.SETTLE; i < n; i++) step(); sliding = true;
      // the healthy pattern of tension is the one the fascia has settled into; sliding responds to changes from it
      E.forEach(e => { if (!e.strut) { const r = restOf(e), d = v3.dist(P[e.a], P[e.b]); e.T0 = e.k * Math.max(0, d - r) / r; } });
      base = { P: P.map(p => [...p]), slide: E.map(e => e.slide), energy: 0 };
      S.P = P; S.ref = base.P; base.energy = energy(); base.asym = asymmetry(); S.base = base;
      base.slack = E.map(e => isSlack(e)); base.nodeStrain = null; base.nodeStrain = S.nodeStrain();
      S.reset();
      return S;
    };

    // Cutting a cable removes it. A fascial line is one continuous band that slides over the points between its
    // anchors: cut it anywhere and the whole band between those anchors goes slack.
    S.cut = function (k) { if (!E[k] || E[k].cut || E[k].strut) return false; E[k].cut = true;
      for (const b of bands) if (b.includes(k)) for (const j of b) if (!E[j].cut) E[j].released = true;
      S.damaged = true; S.moving = 1; return true; };
    // Breaking a bone: it snaps into its two fragments. Every rigid link between the fragments goes.
    S.boneOf = k => { const e = E[k]; if (!e || !e.strut || !e.bone) return null; return bones.find(b => b.uid === e.bone) || null; };
    // The bone snaps where it was tapped (t = how far along the tapped part, 0 to 1): the points of the bone on either
    // side of the break become two fragments, and every rigid link between them goes.
    S.breakBone = function (k, t) {
      const e = E[k]; if (!e || !e.strut || e.cut || e.lig || e.cart) return 0;
      const B = S.boneOf(k); if (!B || B.ids.every(i => FIXED.has(i))) return 0; let n = 0;
      t = Math.max(0.1, Math.min(0.9, t === undefined ? 0.5 : t));
      const a = O[e.a], b = O[e.b], ax = v3.sub(b, a), c = v3.add(a, v3.mul(ax, t));
      const sideOf = i => v3.dot(v3.sub(O[i], c), ax) > 0 ? 1 : -1, sd = new Map(B.ids.map(i => [i, sideOf(i)]));
      E.forEach(f => { if (f.strut && !f.lig && !f.cart && !f.cut && f.bone === B.uid && sd.get(f.a) !== sd.get(f.b)) { f.cut = true; f.broken = true; f.breakT = f === e ? t : undefined; n++; } });
      // the muscle bellies bedded on a broken bone can no longer brace against it
      if (n) E.forEach(f => { if (f.bulk && !f.cut && (sd.has(f.a) || sd.has(f.b))) f.cut = true; });
      if (n) { S.damaged = true; S.moving = 1; }
      return n;
    };
    S.cuts = () => E.reduce((n, e) => n + (e.cut ? 1 : 0), 0);
    S.pluck = function (i, cm) { // push one point outward from the body's centre line and let the web answer
      if (FIXED.has(i)) return; const p = P[i], c = [0, p[1], 0], d = v3.sub(p, c), l = v3.len(d) || 1, k = (cm || 5) / l;
      p[0] += d[0] * k; p[2] += d[2] * k; S.moving = 1; };
    S.reset = function () {
      S.imps = []; S.months = 0;
      P = base.P.map(p => [...p]); OLD = null; E.forEach((e, k) => { e.slide = base.slide[k]; e.cut = false; e.broken = false; e.released = false; e.breakT = undefined; }); S.damaged = false; S.P = P;
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
      const J = JOINTS[im.joint], s = im.side || 'L';
      const nm = t => IDX[t.replace(/X$/, s)] ?? IDX[t];
      const c = O[nm(J.pivot)], k = v3.norm(v3.sub(O[nm(J.to)], c));
      const D = new Set(typeof J.distal === 'function' ? N.map((n, i) => J.distal(n) ? i : -1).filter(i => i >= 0) : J.distal.map(nm));
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
      mass = m0.slice(); dampN = N.map(() => 1); spacers = []; const fricN = N.map(() => 1);
      for (const im of S.imps) {
        if (im.type === 'torque') { const t = torqueFactors(im); t.out.forEach((f, k) => { E[k].fac *= f; }); im._zone = { cw: t.out, nw: new Map([[IDX[(JOINTS[im.joint].pivot).replace(/X$/, im.side || 'L')] ?? IDX[JOINTS[im.joint].pivot], 1]]), c: t.c }; continue; }
        const z = zone(im); im._zone = z;
        z.cw.forEach((w, k) => { const e = E[k];
          e.fac *= 1 - C.SHORTEN * (im.density - 1) * w;
          e.kmul *= 1 + (im.density - 1) * w;
          e.fric *= Math.pow(im.friction, w); });
        z.nw.forEach((w, j) => {
          mass[j] *= 1 + (im.mass - 1) * w;
          fricN[j] *= Math.pow(im.friction, w);
        });
        if (Math.abs(im.volume - 1) > 0.005) { const s = Math.cbrt(im.volume), nodes = [];
          let c = [0, 0, 0], ws = 0; z.nw.forEach((w, j) => { if (!FIXED.has(j)) { c = v3.add(c, v3.mul(O[j], m0[j])); ws += m0[j]; } }); c = ws ? v3.mul(c, 1 / ws) : z.c;
          z.nw.forEach((w, j) => { if (!FIXED.has(j)) nodes.push([j, v3.dist(O[j], c), w]); });
          spacers.push({ nodes, s, c0: c }); }
      }
      E.forEach(e => { e.restBase = e.strut ? e.rest0 : e.rest0 * Math.max(0.5, Math.min(1.6, e.fac)); e.k = e.strut ? e.k0 : Math.min(C.K_MAX, e.k0 * e.kmul); e.kk = Math.min(1, e.k * 2); });
      invm = mass.map((m, j) => FIXED.has(j) ? 0 : 1 / m);
      N.forEach((_, j) => { dampN[j] = C.DAMP * Math.pow(fricN[j], -0.12); });
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
    // The solver takes many small sub-steps per step: with small steps the cables and bones are stiff enough to
    // carry real weight through small lever arms, the way tendons do.
    let X = null, XO = null, W = null, fixedArr = null, cabA, cabB, cabR, cabK, cabOn, cabU, cabM, strA, strB, strR, strK, strOn, strU, strM, parity = 0;
    // Left and right are solved together: each cable or bone is paired with its mirror image and both are corrected
    // from the same state, so a symmetric body stays exactly symmetric until something makes it otherwise.
    function units(list) {
      const mir = N.map(n => n.side ? IDX[n.base + (n.side > 0 ? 'R' : 'L')] : IDX[n.name]), at = new Map();
      list.forEach((k, j) => at.set(Math.min(E[k].a, E[k].b) + '-' + Math.max(E[k].a, E[k].b), j));
      const done = new Uint8Array(list.length), U = [];
      list.forEach((k, j) => { if (done[j]) return; done[j] = 1; const ma = mir[E[k].a], mb = mir[E[k].b], m = at.get(Math.min(ma, mb) + '-' + Math.max(ma, mb));
        if (m !== undefined && m !== j && !done[m]) { done[m] = 1; U.push(j, m); } else U.push(j, -1); });
      return Int32Array.from(U);
    }
    function load() {
      const n = N.length; X = new Float64Array(3 * n); XO = new Float64Array(3 * n); W = new Float64Array(n); fixedArr = new Uint8Array(n);
      cabA = new Int32Array(CAB.length); cabB = new Int32Array(CAB.length); cabR = new Float64Array(CAB.length); cabK = new Float64Array(CAB.length); cabOn = new Uint8Array(CAB.length);
      strA = new Int32Array(STR.length); strB = new Int32Array(STR.length); strR = new Float64Array(STR.length); strK = new Float64Array(STR.length); strOn = new Uint8Array(STR.length);
      CAB.forEach((k, j) => { cabA[j] = E[k].a; cabB[j] = E[k].b; }); STR.forEach((k, j) => { strA[j] = E[k].a; strB[j] = E[k].b; strR[j] = E[k].rest0; });
      cabU = units(CAB); strU = units(STR); cabM = new Uint8Array(CAB.length).fill(1); strM = Uint8Array.from(STR, k => E[k].gap ? 2 : 0);
      for (let i = 0; i < n; i++) fixedArr[i] = FIXED.has(i) ? 1 : 0;
    }
    const D = new Float64Array(8);
    // one pass over a set of members. M = 0 holds both ways (bone, cartilage), 1 pulls only (cable), 2 pushes only (contact).
    function sweep(A, B, R, K, On, U, M, fwd) {
      const nu = U.length >> 1;
      for (let q = 0; q < nu; q++) { const u = (fwd ? q : nu - 1 - q) << 1;
        for (let h = 0; h < 2; h++) { const j = U[u + h], o = h << 2; D[o + 3] = 0; if (j < 0 || !On[j]) continue;
          const a3 = 3 * A[j], b3 = 3 * B[j], dx = X[b3] - X[a3], dy = X[b3 + 1] - X[a3 + 1], dz = X[b3 + 2] - X[a3 + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
          const md = M[j]; if (md === 1 ? d <= R[j] : md === 2 && d >= R[j]) continue;
          const w = W[A[j]] + W[B[j]]; if (!w) continue;
          const c = (d - R[j]) / d * K[j] / w; D[o] = dx * c; D[o + 1] = dy * c; D[o + 2] = dz * c; D[o + 3] = 1; }
        for (let h = 0; h < 2; h++) { const o = h << 2; if (!D[o + 3]) continue; const j = U[u + h], a = A[j], b = B[j], a3 = 3 * a, b3 = 3 * b, wa = W[a], wb = W[b];
          X[a3] += D[o] * wa; X[a3 + 1] += D[o + 1] * wa; X[a3 + 2] += D[o + 2] * wa; X[b3] -= D[o] * wb; X[b3 + 1] -= D[o + 1] * wb; X[b3 + 2] -= D[o + 2] * wb; }
      }
    }
    function step() {
      const n = N.length, SUB = C.SUB, g = C.GRAV / (SUB * SUB), fl = C.FLOOR, ff = Math.pow(C.FLOOR_FRICTION, 1 / SUB), v0 = C.V0 / SUB, dFall = Math.pow(C.DAMP_FALL, 1 / SUB);
      if (!X || X.length !== 3 * n || cabA.length !== CAB.length) { load(); OLD = null; }
      for (let i = 0; i < n; i++) { const p = P[i], q = OLD ? OLD[i] : p, j = 3 * i;
        if (!OLD) { XO[j] = p[0]; XO[j + 1] = p[1]; XO[j + 2] = p[2]; }
        else if (X[j] !== p[0] || X[j + 1] !== p[1] || X[j + 2] !== p[2]) { /* moved from outside (a pluck): keep the previous point so the move becomes a push */ }
        X[j] = p[0]; X[j + 1] = p[1]; X[j + 2] = p[2]; void q;
        W[i] = invm[i]; }
      if (!OLD) OLD = P.map(p => [p[0], p[1], p[2]]); else for (let i = 0; i < n; i++) { const o = OLD[i], p = P[i]; o[0] = p[0]; o[1] = p[1]; o[2] = p[2]; }
      for (let j = 0; j < CAB.length; j++) { const e = E[CAB[j]]; cabOn[j] = e.cut || e.released ? 0 : 1; cabR[j] = restOf(e); cabK[j] = e.kk; }
      for (let j = 0; j < STR.length; j++) { const e = E[STR[j]]; strOn[j] = e.cut ? 0 : 1; strK[j] = e.kk; }
      const dSlow = dampN.map(d => Math.pow(d, 1 / SUB)), IT = C.ITERS;
      for (let s = 0; s < SUB; s++) {
        for (let i = 0, j = 0; i < n; i++, j += 3) {
          if (fixedArr[i]) { const o = O[i]; X[j] = XO[j] = o[0]; X[j + 1] = XO[j + 1] = o[1]; X[j + 2] = XO[j + 2] = o[2]; continue; }
          const vx = X[j] - XO[j], vy = X[j + 1] - XO[j + 1], vz = X[j + 2] - XO[j + 2], sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
          const d = dSlow[i] + (dFall - dSlow[i]) * (1 - Math.exp(-sp / v0));
          XO[j] = X[j]; XO[j + 1] = X[j + 1]; XO[j + 2] = X[j + 2];
          X[j] += vx * d; X[j + 1] += vy * d - g; X[j + 2] += vz * d; }
        for (let it = 0; it < IT; it++) {
          const fwd = ((parity++) & 1) === 0;
          sweep(cabA, cabB, cabR, cabK, cabOn, cabU, cabM, fwd);
          for (const sp of spacers) { // a local spacer: the zone holds a larger (or smaller) volume. It pushes its points apart about their
            // common centre of mass and adds no net push to the body.
            let cx = 0, cy = 0, cz = 0, ws = 0; for (const [j] of sp.nodes) { const m = mass[j]; cx += X[3 * j] * m; cy += X[3 * j + 1] * m; cz += X[3 * j + 2] * m; ws += m; } if (!ws) continue; cx /= ws; cy /= ws; cz /= ws;
            let mx = 0, my = 0, mz = 0; const dl = sp.d || (sp.d = new Float64Array(3 * sp.nodes.length));
            sp.nodes.forEach(([j, d0, w], q) => { const j3 = 3 * j, vx = X[j3] - cx, vy = X[j3 + 1] - cy, vz = X[j3 + 2] - cz, d = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1e-6, target = d0 * (1 + (sp.s - 1) * w);
              const corr = d0 < 0.5 ? 0 : (target - d) / d * 0.5 / SUB * 4, m = mass[j]; dl[3 * q] = vx * corr; dl[3 * q + 1] = vy * corr; dl[3 * q + 2] = vz * corr; mx += dl[3 * q] * m; my += dl[3 * q + 1] * m; mz += dl[3 * q + 2] * m; });
            mx /= ws; my /= ws; mz /= ws;
            sp.nodes.forEach(([j], q) => { const j3 = 3 * j; X[j3] += dl[3 * q] - mx; X[j3 + 1] += dl[3 * q + 1] - my; X[j3 + 2] += dl[3 * q + 2] - mz; });
          }
          sweep(strA, strB, strR, strK, strOn, strU, strM, fwd);
          for (let i = 0, j = 0; i < n; i++, j += 3) if (X[j + 1] < fl && !fixedArr[i]) { X[j + 1] = fl; X[j] = XO[j] + (X[j] - XO[j]) * ff; X[j + 2] = XO[j + 2] + (X[j + 2] - XO[j + 2]) * ff; }
        }
      }
      let mv = 0;
      for (let i = 0, j = 0; i < n; i++, j += 3) { const p = P[i]; p[0] = X[j]; p[1] = X[j + 1]; p[2] = X[j + 2]; const o = OLD[i], m = Math.abs(p[0] - o[0]) + Math.abs(p[1] - o[1]) + Math.abs(p[2] - o[2]); if (m > mv) mv = m; }
      // fascia slides along each line toward equal tension, unless friction at the shared node holds it
      if (sliding) for (const ch of chains) for (let i = 0; i + 1 < ch.length; i++) {
        const [k1] = ch[i], [k2] = ch[i + 1], e1 = E[k1], e2 = E[k2]; if (e1.cut || e2.cut || e1.released || e2.released) continue;
        const r1 = restOf(e1), r2 = restOf(e2), d1 = v3.dist(P[e1.a], P[e1.b]), d2 = v3.dist(P[e2.a], P[e2.b]);
        const T1 = e1.k * Math.max(0, d1 - r1) / r1 - e1.T0, T2 = e2.k * Math.max(0, d2 - r2) / r2 - e2.T0; if (Math.abs(T1 - T2) < C.SLIDE_DEAD * (e1.k + e2.k)) continue; // friction: a small difference in tension does not move it
        const fr = Math.max(e1.fric, e2.fric), rate = C.SLIDE / fr;
        const dd = (T1 - T2) / (e1.k * d1 / (r1 * r1) + e2.k * d2 / (r2 * r2)) * rate;
        const lim1 = 0.2 * e1.rest0, lim2 = 0.2 * e2.rest0;
        const dl = Math.max(-lim1 - e1.slide, Math.min(lim1 - e1.slide, Math.max(e2.slide - lim2, Math.min(e2.slide + lim2, dd))));
        e1.slide += dl; e2.slide -= dl;
      }
      S.moving = mv;
      if (S.creep && S.imps.length) {
        S.months += 1 / 60;
        if (Math.floor(S.months * 2) !== Math.floor((S.months - 1 / 60) * 2)) { S.imps.forEach(im => { if (im.type !== 'torque') im.age = (im.age || 0) + 0.5; }); applyImps(); }
      }
    }
    S.step = step;
    S.calibrating = on => { sliding = !on; };
    // healthy rest lengths found by form-finding (see the note at the reference table): rest length / drawn length per member
    S.setRest = tab => { E.forEach((e, k) => { if (tab[k]) e.rest0 = e.L0 * tab[k]; }); applyImps(); if (strR) STR.forEach((k, j) => { strR[j] = E[k].rest0; }); };
    S.settle = n => { for (let i = 0; i < n; i++) step(); };

    // ---------- computed quantities ----------
    function energy() { let s = 0; for (const e of E) { if (e.strut || e.cut || e.released || (FIXED.has(e.a) && FIXED.has(e.b))) continue; const r = restOf(e), d = v3.dist(P[e.a], P[e.b]); if (d > r) { const st = (d - r) / r; s += e.k * st * st * r; } } return s; }
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
      let slack = 0; E.forEach((e, k) => { if (!e.cut && !e.strut && (e.released || isSlack(e)) && !base.slack[k]) slack++; });
      const en = energy(), asym = Math.max(0, asymmetry() - base.asym);
      const extra = Math.max(0, en / base.energy - 1);
      const head = (g('brow')[2] - r('brow')[2]);
      const load = 1 - Math.exp(-(0.04 * extra + 0.3 * asym + 0.25 * rms + 0.08 * Math.abs(head)));
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
      E.forEach(e => { if (e.strut || e.cut || e.released) return; const r = restOf(e), d = v3.dist(P[e.a], P[e.b]); const st = Math.max(0, (d - r) / r); out[e.a] += st; out[e.b] += st; cnt[e.a]++; cnt[e.b]++; });
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
    foot: { label: 'Tight calf and heel', text: 'Right calf and heel: the tissue from the heel cord up the back of the calf densified (density 3.4). Look for effects far up the body.',
      make: (S, I, y) => [{ type: 'set', node: I.heelR, edges: S.E.map((e, k) => k).filter(k => !S.E[k].strut && y(k, p => p[1] < 36 && p[0] < 0 && p[2] < 1)), density: 3.4, radius: 0 }] },
    hipIR: { label: 'Internal hip rotation', text: 'Internal hip rotation, right: the tissue that crosses the right hip was remodeled to the lengths a 20 degree inward twist would give it. The feet stay planted, so watch the kneecap, the knee and the pelvis.',
      make: (S, I) => [{ type: 'torque', joint: 'hip', side: 'R', angle: 20, node: I.hipR }] },
    trunk: { label: 'Twisted trunk', text: 'Twisted trunk: the tissue between the pelvis and the rib cage was remodeled to a 12 degree turn to the right. Watch the shoulders turn against the hips.',
      make: (S, I) => [{ type: 'torque', joint: 'trunk', angle: -12, node: I.l3 }] },
    scar: { label: 'Abdominal scar', text: 'A scar low on the right abdomen: dense (2.8) and sticky (friction 8), so fascia can no longer slide through it.',
      make: (S, I) => [{ type: 'point', node: I.abdR, radius: 7, density: 2.8, friction: 8 }] },
    belly: { label: 'Belly load', text: 'Belly load: the abdomen carries four times its mass and 80% more volume, with no change in density. Gravity and the spacer do the rest.',
      make: (S, I) => [{ type: 'point', node: I.navel, radius: 13, density: 1, mass: 4, volume: 1.8 }] },
    knee: { label: 'Knee injury', text: 'Knee injury, right: after an injury the tissue around the joint heals denser and stickier (density 3.2, friction 6), so the layers no longer slide. Watch the hip and the trunk above it.',
      make: (S, I) => [{ type: 'point', node: I.kneeR, radius: 9, density: 3.2, friction: 6 }] },
    elbow: { label: 'Tennis elbow', text: 'Tennis elbow, right: the tissue on the outside of the elbow, where the muscles that lift the wrist attach, densified (density 3.4). Watch the elbow bend and the hand lift, then the shoulder.',
      make: (S, I) => [{ type: 'point', node: I.elbowR, radius: 8, density: 3.4, friction: 3 }] },
    hams: { label: 'Tight hamstrings', text: 'Tight hamstrings: the back line between the sitting bones and the knees densified on both sides (density 3). Watch the pelvis tip back and the head follow it.',
      make: (S, I, y) => [{ type: 'set', node: I.ischL, edges: S.lineEdges('sbl', (e, k) => y(k, p => p[1] > 40 && p[1] < 90)), density: 3, radius: 0 }] }
  };

  root.UMSim = { SCENARIOS, create, LINES, JOINTS, BONES, v3 };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.UMSim;
})(typeof window !== 'undefined' ? window : globalThis);
