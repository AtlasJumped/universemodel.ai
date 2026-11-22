// HMR progress tracker (preview only). A thin bar on the bottom edge of the sticky header showing how much of the site a
// visitor has explored on this device. It measures exploration (pages reached the end of, with a little time spent), not
// knowledge. Stored only in localStorage; nothing is sent anywhere. Celebrations escalate: page, 25%, 50%, 75%, 100%. Every page arrival opens with sparkle icicles under the header.
// There is no way to hide the bar (owner, 2026-11-21): the popover has Reset and Close, and Close only closes the popover.
(() => {
  'use strict';
  const head = document.querySelector('.site-head');
  if (!head || window.hmrProgress) return;

  const PAGES = [
    ['index.html', 'Home'], ['about.html', 'About'], ['reality.html', 'Science Today'], ['fixing-exercise.html', 'Exercise Today'],
    ['mental-health.html', 'Mental Health Today'], ['hmr.html', 'The HMR'], ['ui.html', 'Universal Intelligence'],
    ['health-model.html', 'HMR Holistic Health Model'], ['physics-health.html', 'HMR Physical Health Model'], ['health.html', 'The Perfect Body'],
    ['protocol.html', 'HMR Fascia Health Protocol'], ['mental-model.html', 'HMR Mental Health Model'], ['math.html', 'HMR Math Paradigm'], ['physics.html', 'HMR Physics Paradigm'],
    ['values.html', 'HMR Values'], ['answers.html', 'The Answers'], ['east-west.html', 'East and West'], ['kids.html', 'Do you have kids?'],
    ['simulation.html', 'Simulation'], ['fun.html', 'For fun'], ['roadmap.html', 'Road Ahead'], ['collaborators.html', 'Collaborators'],
    ['influencers.html', 'Influencers'], ['methods.html', 'Methods'], ['library.html', 'Library']
  ];
  const N = PAGES.length, KEY = 'hmr-progress-v1', MILES = [25, 50, 75];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dwellMs = 20000;

  const norm = f => { f = String(f || '').split('#')[0].split('?')[0].split('/').pop(); if (!f) f = 'index.html'; else if (f.indexOf('.') < 0) f += '.html'; return f; };
  const here = norm(location.pathname), tracked = PAGES.some(p => p[0] === here);

  // ---- storage (always guarded) ----
  let mem = null;
  const blank = () => ({ v: 1, read: {}, part: {}, shown: {} });
  function load() {
    if (mem) return mem;
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!s || typeof s !== 'object') s = blank();
    s.read = s.read && typeof s.read === 'object' ? s.read : {}; s.part = s.part && typeof s.part === 'object' ? s.part : {}; s.shown = s.shown && typeof s.shown === 'object' ? s.shown : {};
    delete s.hidden; delete s.greet; // a stored 'hidden' state from an earlier build is ignored
    return (mem = s);
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} }
  const S = load();

  // ---- model ----
  let cur = 0; // fraction of the current page, from scrolling (max 0.8 until it counts as read)
  const readCount = () => PAGES.filter(p => S.read[p[0]]).length;
  function total() {
    let t = readCount();
    for (const p of PAGES) { if (S.read[p[0]]) continue; t += p[0] === here ? Math.max(cur, S.part[p[0]] || 0) : (S.part[p[0]] || 0); }
    return Math.min(N, t);
  }
  const pct = () => { const r = Math.round(total() / N * 100); return readCount() < N ? Math.min(99, r) : 100; };

  // ---- DOM ----
  const css = document.createElement('style');
  css.textContent = `
.hmr-track{position:absolute;left:0;right:0;top:62px;height:4px;z-index:3;pointer-events:none}
.hmr-rail{position:absolute;inset:0;background:rgba(11,37,69,.07)}
.hmr-fill{position:absolute;left:0;top:0;bottom:0;width:0;overflow:hidden;transition:width .9s cubic-bezier(.22,.8,.3,1);border-radius:0 2px 2px 0}
.hmr-fill i{position:absolute;left:0;top:0;bottom:0;display:block;background:linear-gradient(90deg,#F2A93B 0%,#E9B955 22%,#5B9BE6 70%,#1D5FD1 100%)}
.hmr-fill::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.95) 50%,transparent 70%) no-repeat;background-size:60% 100%;background-position:-80% 0;opacity:0}
.hmr-fill.shim::after{animation:hmrshim .9s ease-out both}
@keyframes hmrshim{0%{opacity:1;background-position:-80% 0}100%{opacity:1;background-position:180% 0}}
.hmr-done .hmr-fill i{background:linear-gradient(90deg,#F2A93B,#F7C566 50%,#F2A93B)}
.hmr-track.pulse{animation:hmrpulse .9s ease-out 1}
@keyframes hmrpulse{0%{transform:scaleY(1);filter:none}40%{transform:scaleY(2);filter:drop-shadow(0 0 6px rgba(242,169,59,.9))}100%{transform:scaleY(1);filter:none}}
.hmr-lead{position:absolute;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;opacity:0;transition:left .9s cubic-bezier(.22,.8,.3,1),opacity .3s;
  background:radial-gradient(circle,rgba(255,255,255,1) 0,rgba(255,226,160,.95) 22%,rgba(242,169,59,.45) 50%,rgba(242,169,59,0) 72%)}
.hmr-lead::before,.hmr-lead::after{content:"";position:absolute;left:50%;top:50%;background:#F2A93B;border-radius:1px;opacity:.85}
.hmr-lead::before{width:13px;height:1px;margin:-.5px 0 0 -6.5px}.hmr-lead::after{width:1px;height:13px;margin:-6.5px 0 0 -.5px}
.hmr-on .hmr-lead{opacity:1}
.hmr-hit{position:absolute;left:0;right:0;top:-6px;height:10px;padding:0;margin:0;border:0;background:transparent;cursor:pointer;pointer-events:auto;z-index:2}
.hmr-hit:focus-visible{outline:2px solid #1D5FD1;outline-offset:1px;border-radius:2px}
.hmr-label{position:absolute;right:max(16px,calc((100vw - 1440px)/2 + 16px));top:72px;z-index:4;padding:4px 10px;border-radius:999px;background:#fff;border:1px solid rgba(11,37,69,.12);
  box-shadow:0 2px 10px rgba(11,37,69,.1);font-family:inherit;font-size:12px;font-weight:500;line-height:1.3;color:#0B2545;letter-spacing:.01em;opacity:0;transform:translateY(-3px);transition:opacity .25s,transform .25s;pointer-events:none;white-space:nowrap}
.hmr-label.on{opacity:1;transform:none}
.hmr-label b{font-weight:700;color:#1D5FD1}
.hmr-pop{position:absolute;right:max(12px,calc((100vw - 1440px)/2 + 12px));top:72px;z-index:5;width:min(344px,calc(100vw - 24px));max-height:calc(100vh - 100px);overflow:auto;background:#fff;color:#0B2545;border:1px solid rgba(11,37,69,.12);
  border-radius:12px;box-shadow:0 14px 40px rgba(11,37,69,.18);padding:14px 14px 12px;font-family:inherit;font-size:13px;line-height:1.4;text-align:left}
.hmr-pop[hidden]{display:none}
.hmr-pop h2{margin:0;padding:0;font-family:inherit;font-size:14px;font-weight:700;line-height:1.2;color:#0B2545;letter-spacing:0;text-transform:none}
.hmr-pop .sub{margin:2px 0 10px;color:#4A5C75;font-size:12.5px}
.hmr-pop ol{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:1px 10px}
.hmr-pop li a{display:flex;align-items:center;gap:8px;padding:3px 4px;border-radius:6px;color:#4A5C75;text-decoration:none;font-size:12.5px}
.hmr-pop li a:hover{background:#EEF3FB;color:#0B2545;text-decoration:none}
.hmr-pop li a::before{content:"";flex:none;width:8px;height:8px;border-radius:50%;border:1.5px solid #B8C4D6;box-sizing:border-box}
.hmr-pop li.rd a{color:#0B2545}
.hmr-pop li.rd a::before{border-color:#F2A93B;background:radial-gradient(circle,#fff 0,#FFE3A6 35%,#F2A93B 100%);box-shadow:0 0 5px rgba(242,169,59,.7)}
.hmr-pop li.cu a{font-weight:700;color:#1D5FD1}
.hmr-pop li.cu a::before{border-color:#1D5FD1;box-shadow:0 0 0 2px rgba(29,95,209,.2)}
.hmr-pop li.rd.cu a::before{border-color:#1D5FD1}
.hmr-pop .done{margin:10px 0 0;padding:8px 10px;border-radius:8px;background:#FFF6E3;color:#0B2545}
.hmr-pop .done a{color:#1D5FD1;font-weight:600}
.hmr-pop .ctl{display:flex;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(11,37,69,.1)}
.hmr-pop .ctl button{font-family:inherit;font-size:12px;font-weight:500;line-height:1;padding:6px 10px;border-radius:7px;border:1px solid rgba(11,37,69,.18);background:#fff;color:#0B2545;cursor:pointer}
.hmr-pop .ctl button:hover{background:#EEF3FB}
.hmr-pop .ctl .sp{flex:1}
.hmr-pop a:focus-visible,.hmr-pop button:focus-visible{outline:2px solid #1D5FD1;outline-offset:1px}
.hmr-cv{position:fixed;left:0;top:0;width:100%;height:160px;pointer-events:none;z-index:70}
.hmr-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (prefers-reduced-motion:reduce){.hmr-fill,.hmr-lead,.hmr-label{transition:none}.hmr-fill.shim::after,.hmr-track.pulse{animation:none}}
`;
  document.head.appendChild(css);

  const track = document.createElement('div'); track.className = 'hmr-track'; track.setAttribute('data-hmr', '');
  track.innerHTML = '<div class="hmr-rail"></div><div class="hmr-fill"><i></i></div><span class="hmr-lead"></span>';
  const hit = document.createElement('button'); hit.type = 'button'; hit.className = 'hmr-hit'; hit.setAttribute('aria-haspopup', 'dialog'); hit.setAttribute('aria-expanded', 'false');
  track.appendChild(hit);
  const label = document.createElement('div'); label.className = 'hmr-label'; label.setAttribute('role', 'status'); label.setAttribute('aria-live', 'polite');
  const pop = document.createElement('div'); pop.className = 'hmr-pop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'HMR pages explored'); pop.id = 'hmr-pop';
  hit.setAttribute('aria-controls', 'hmr-pop');
  head.appendChild(track); head.appendChild(label); head.appendChild(pop);
  const fill = track.querySelector('.hmr-fill'), fillI = fill.firstElementChild, lead = track.querySelector('.hmr-lead');


  const W = () => head.getBoundingClientRect().width || innerWidth;
  const text = () => 'HMR explored: ' + pct() + '%';

  // ---- render ----
  let lastW = -1;
  function render() {
    const p = Math.max(0, Math.min(1, total() / N));
    const w = W(); fillI.style.width = w + 'px';
    fill.style.width = (p * w) + 'px'; lead.style.left = (p * w) + 'px'; lastW = p;
    track.classList.toggle('hmr-on', p > 0.001);
    track.classList.toggle('hmr-done', readCount() >= N);
    const t = text(); label.innerHTML = 'HMR explored: <b>' + pct() + '%</b>';
    hit.setAttribute('aria-label', t + '. ' + readCount() + ' of ' + N + ' pages. Open the page list.');
    hit.setAttribute('aria-valuenow', String(pct())); hit.setAttribute('aria-valuetext', t);
    if (!pop.hidden) renderPop();
  }
  function renderPop() {
    const rc = readCount(), all = rc >= N;
    let h = '<h2>HMR explored: ' + pct() + '%</h2><p class="sub">' + rc + ' of ' + N + ' pages read to the end. This measures how much of the site you have explored on this device.</p><ol>';
    for (const p of PAGES) { const r = !!S.read[p[0]], c = p[0] === here; h += '<li class="' + (r ? 'rd ' : '') + (c ? 'cu' : '') + '"><a href="' + p[0] + '"' + (c ? ' aria-current="page"' : '') + '>' + p[1] + '<span class="hmr-sr">' + (r ? ' (explored)' : '') + '</span></a></li>'; }
    h += '</ol>';
    if (all) h += '<p class="done"><strong>You have explored all of HMR.</strong> If this resonates with you, <a href="collaborators.html">engage with us here</a>.</p>';
    h += '<div class="ctl"><button type="button" data-a="reset">' + (confirming ? 'Confirm reset' : 'Reset') + '</button><span class="sp"></span><button type="button" data-a="close">Close</button></div>';
    pop.innerHTML = h;
  }
  let confirming = false, popOpener = null;
  function openPop() { confirming = false; renderPop(); pop.hidden = false; hit.setAttribute('aria-expanded', 'true'); label.classList.remove('on'); clearTimeout(lt); }
  function closePop(back) { if (pop.hidden) return; pop.hidden = true; confirming = false; hit.setAttribute('aria-expanded', 'false'); if (back) hit.focus(); }
  hit.addEventListener('click', e => { e.stopPropagation(); pop.hidden ? openPop() : closePop(); });
  label.style.pointerEvents = 'auto'; label.style.cursor = 'pointer';
  label.addEventListener('click', e => { e.stopPropagation(); if (pop.hidden) openPop(); });
  pop.addEventListener('click', e => {
    e.stopPropagation(); const b = e.target.closest('button[data-a]'); if (!b) return;
    if (b.dataset.a === 'close') closePop(true);
    else if (b.dataset.a === 'reset') { if (!confirming) { confirming = true; renderPop(); } else api.reset(); }
  });
  document.addEventListener('click', e => { if (!pop.hidden && !pop.contains(e.target) && e.target !== hit) closePop(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) { closePop(true); } });
  // label on hover / focus of the bar
  let lt = 0;
  function showLabel(ms) { if (!pop.hidden) return; label.classList.add('on'); clearTimeout(lt); if (ms) lt = setTimeout(() => label.classList.remove('on'), ms); }
  const hideLabel = () => { clearTimeout(lt); lt = setTimeout(() => label.classList.remove('on'), 150); };
  hit.addEventListener('pointerenter', () => showLabel(0)); hit.addEventListener('pointerleave', hideLabel);
  hit.addEventListener('focus', () => showLabel(0)); hit.addEventListener('blur', hideLabel);

  // ---- celebrations (one fixed overlay canvas, created on demand, top 160 px only) ----
  const COLS = [[29, 95, 209], [91, 155, 230], [109, 74, 255], [242, 169, 59], [14, 58, 117], [214, 120, 210]];
  const GOLDS = [[242, 169, 59], [247, 197, 102], [255, 226, 160], [242, 169, 59], [91, 155, 230], [255, 255, 255]];
  let BAR_Y = 64, MAXY = 160; // measured from the header at the start of each celebration (about 100 px below the bar)
  let busy = false, queued = null;
  const LEVEL = { read: 0, 25: 1, 50: 2, 75: 3, 100: 4, icicles: -1 };

  function celebrate(kind) {
    kind = String(kind);
    if (!(kind in LEVEL)) return false;
    if (document.querySelector('canvas[data-page-fire]')) return false; // never over the site's page fire
    if (still) { // reduced motion: no particles; the bar has already updated, so just show the label
      if (kind !== 'icicles') { showLabel(kind === '100' ? 3000 : 2000); if (kind === '100') { track.classList.remove('pulse'); } } return true; }
    if (busy) { if (kind !== 'icicles' && kind !== 'read') queued = kind; return false; }
    busy = true; if (kind !== 'icicles') showLabel(kind === '100' ? 3200 : 2000);
    run(kind); return true;
  }

  let stopper = null; // ends the running celebration at once (tab hidden, page leaving)
  document.addEventListener('visibilitychange', () => { if (document.hidden && stopper) stopper(); });
  addEventListener('pagehide', () => { if (stopper) stopper(); });

  // Page arrival (every page load): along the header's lower edge, side by side in steps of about 1 cm (38 px), each a downward
  // triangle filled with falling sparkles (the soft dots and fine crosses of the pointer trail): dense and bright at the top, thinning
  // to single sparkles at the tip. It forms left to right in about 0.4 s, rains for about 2 s, then fades. No lines, never more than
  // 110 px below the header.
  function icicles() {
    const w = innerWidth, dpr = Math.min(1.5, devicePixelRatio || 1), coarse = matchMedia('(pointer: coarse)').matches;
    BAR_Y = Math.round(head.getBoundingClientRect().bottom); MAXY = Math.min(innerHeight, BAR_Y + 110);
    const cv = document.createElement('canvas'); cv.className = 'hmr-cv'; cv.setAttribute('aria-hidden', 'true');
    cv.style.height = MAXY + 'px'; cv.width = Math.round(w * dpr); cv.height = Math.round(MAXY * dpr); document.body.appendChild(cv);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const PAL = [[91, 155, 230], [242, 169, 59], [109, 74, 255], [29, 95, 209], [255, 190, 70], [214, 120, 210], [91, 155, 230]], SP = {};
    const sprite = col => { const k = col.join(','); if (SP[k]) return SP[k]; const s = document.createElement('canvas'); s.width = s.height = 32; const g = s.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, `rgba(${k},0.95)`); gr.addColorStop(0.35, `rgba(${k},0.4)`); gr.addColorStop(1, `rgba(${k},0)`); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return (SP[k] = s); };
    const SW = 38, n = Math.ceil(w / SW), MAX = coarse ? 280 : 640, DUR = 2.45, RAIN = 2.0, ice = [], parts = [];
    for (let i = 0; i < n; i++) { const L = 50 + Math.random() * 50 + (i % 5 === 2 ? 4 : 0); ice.push({ cx: i * SW + SW / 2, L: Math.min(100, L), t0: (i / n) * 0.4, acc: Math.random() }); }
    let t0 = performance.now(), last = t0, lastDraw = 0, ended = false, rid = 0;
    function frame(now) {
      if (ended) return; rid = requestAnimationFrame(frame);
      if (coarse && now - lastDraw < 32) return; lastDraw = now;
      const dt = Math.min(0.05, (now - last) / 1000), t = (now - t0) / 1000; last = now;
      if (t > DUR) return finish();
      const fade = t < RAIN ? 1 : Math.max(0, 1 - (t - RAIN) / (DUR - RAIN));
      c.clearRect(0, 0, w, MAXY);
      // emit: more at the top of each triangle, each particle falls inside the cone and ends somewhere along it (few reach the tip)
      if (t < RAIN) for (const q of ice) { if (t < q.t0) continue; const grow = Math.min(1, (t - q.t0) / 0.3), L = q.L * (1 - Math.pow(1 - grow, 3)); q.acc += dt * (coarse ? 13 : 16) * (L / 75); 
        while (q.acc >= 1 && parts.length < MAX) { q.acc--; parts.push({ cx: q.cx, u: Math.random() + Math.random() - 1, d: Math.random() * 6, dEnd: L * (0.4 + 0.6 * Math.pow(Math.random(), 0.9)), L: q.L, v: 70 + Math.random() * 55, col: PAL[Math.floor(Math.random() * PAL.length)], r: 0.8 + Math.random() * 1.5, cross: Math.random() < 0.3, ph: Math.random() * 6.28, age: 0 }); } q.acc = Math.min(q.acc, 1.5); }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.d += p.v * dt; p.age += dt; if (p.d >= p.dEnd || BAR_Y + p.d > MAXY - 3) { parts.splice(i, 1); continue; }
        const f = p.d / p.L, half = (SW / 2) * (1 - f) * 0.92, x = p.cx + p.u * half + Math.sin(p.age * 5 + p.ph) * 0.8, y = BAR_Y + p.d;
        const a = Math.min(1, p.age * 8) * (1 - Math.pow(f, 1.3) * 0.55) * (0.7 + 0.3 * Math.sin(p.age * 14 + p.ph)) * fade * (1 - Math.max(0, (p.d - p.dEnd * 0.8) / (p.dEnd * 0.2 + 1)));
        if (a <= 0.02) continue; const R = p.r * (1.1 - 0.5 * f);
        c.globalAlpha = Math.min(1, a); c.drawImage(sprite(p.col), x - R * 4, y - R * 4, R * 8, R * 8); c.globalAlpha = 1;
        if (p.cross) { c.strokeStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${Math.min(1, a)})`; c.lineWidth = 1; c.beginPath(); c.moveTo(x - R * 3, y); c.lineTo(x + R * 3, y); c.moveTo(x, y - R * 3); c.lineTo(x, y + R * 3); c.stroke(); }
      }
    }
    function finish() { if (ended) return; ended = true; cancelAnimationFrame(rid); clearTimeout(hard); if (stopper === finish) stopper = null; cv.remove(); busy = false; }
    const hard = setTimeout(finish, (DUR + 2.5) * 1000); stopper = finish;
    rid = requestAnimationFrame(frame);
  }

  function run(kind) {
    if (kind === 'icicles') return icicles();
    const lv = LEVEL[kind], w = innerWidth, dpr = Math.min(2, devicePixelRatio || 1);
    BAR_Y = Math.round(head.getBoundingClientRect().bottom - 2); MAXY = Math.min(innerHeight, BAR_Y + 100);
    const cv = document.createElement('canvas'); cv.className = 'hmr-cv'; cv.setAttribute('aria-hidden', 'true');
    cv.style.height = MAXY + 'px'; cv.width = w * dpr; cv.height = MAXY * dpr; document.body.appendChild(cv);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const hw = W(), ex = Math.max(4, Math.min(hw, total() / N * hw)), parts = [];
    const pal = lv >= 1 ? GOLDS : COLS;
    const DUR = { read: 1300, 25: 1900, 50: 2300, 75: 2700, 100: 3300 }[kind];
    const t0 = performance.now(); let last = t0, acc = 0, ended = false;
    fill.classList.remove('shim'); void fill.offsetWidth; fill.classList.add('shim');
    function add(x, y, ang, sp, o) {
      if (parts.length > 420) return; o = o || {};
      parts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: (o.r || 0.9) + Math.random() * (o.rr || 2.2), age: 0, life: (o.life || 700) * (0.7 + Math.random() * 0.6), g: o.g || 0.012, tw: Math.random() * 6.28,
        col: pal[Math.floor(Math.random() * pal.length)], star: Math.random() < (o.star == null ? 0.45 : o.star) });
    }
    function burst(x, n, power, up) { for (let i = 0; i < n; i++) { const a = up ? -Math.PI * (0.05 + Math.random() * 0.9) : (Math.random() - 0.5) * 2 * Math.PI * 0.5 + Math.PI * 0.5 + (Math.random() < 0.35 ? Math.PI : 0); add(x + (Math.random() - .5) * 8, BAR_Y, a, (0.5 + Math.random()) * power, { life: 500 + power * 160 }); } }
    if (kind === 'read') { burst(ex, 12, 1.6, false); burst(ex, 14, 2.1, true); }
    if (lv >= 1 && lv <= 3) { const n = [34, 52, 78][lv - 1], pw = [2.4, 3.1, 3.9][lv - 1]; burst(ex, n, pw, true); burst(ex, Math.round(n / 2), pw * 0.8, false); }
    if (kind === '100') { burst(ex, 70, 4.4, true); burst(ex, 40, 3, false); }
    const sweepDur = lv >= 1 && lv <= 3 ? 1100 + lv * 150 : 0;

    function draw(p) {
      const u = Math.min(1, p.age / p.life), env = Math.min(1, u * 10, (1 - u) * 2.4), fade = Math.max(0, Math.min(1, (MAXY - 4 - p.y) / 30));
      const a = env * fade * (0.8 + 0.2 * Math.sin(p.tw)); if (a <= 0.01) return;
      const [r, g, b] = p.col, R = p.r, gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * 4);
      gr.addColorStop(0, `rgba(${r},${g},${b},${0.95 * a})`); gr.addColorStop(0.35, `rgba(${r},${g},${b},${0.38 * a})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.fillStyle = gr; c.beginPath(); c.arc(p.x, p.y, R * 4, 0, 6.283); c.fill();
      if (p.star) { c.strokeStyle = `rgba(${r},${g},${b},${a})`; c.lineWidth = 1.1; c.beginPath(); c.moveTo(p.x - R * 3.4, p.y); c.lineTo(p.x + R * 3.4, p.y); c.moveTo(p.x, p.y - R * 3.4); c.lineTo(p.x, p.y + R * 3.4); c.stroke(); }
    }
    function frame(now) {
      const dt = Math.min(50, now - last), k = dt / 16.67, t = now - t0; last = now;
      c.clearRect(0, 0, w, MAXY);
      // gold sweep along the header's lower edge, widening with the milestone
      if (sweepDur && t < sweepDur + 300) {
        const q = Math.min(1, t / sweepDur), e = 1 - Math.pow(1 - q, 2), cx = -120 + (hw + 240) * e, fa = Math.max(0, 1 - Math.max(0, t - sweepDur) / 300), bw = 140 + lv * 60, h = 10 + lv * 6;
        let g = c.createLinearGradient(cx - bw, 0, cx + bw, 0);
        g.addColorStop(0, 'rgba(242,169,59,0)'); g.addColorStop(0.7, `rgba(242,169,59,${0.55 * fa})`); g.addColorStop(0.9, `rgba(255,235,185,${0.95 * fa})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(cx - bw, BAR_Y - 1.5, bw * 2, 3.5);
        g = c.createRadialGradient(cx, BAR_Y, 0, cx, BAR_Y, bw); g.addColorStop(0, `rgba(242,169,59,${0.26 * fa})`); g.addColorStop(1, 'rgba(242,169,59,0)');
        c.save(); c.translate(0, BAR_Y); c.scale(1, h / bw); c.translate(0, -BAR_Y); c.fillStyle = g; c.fillRect(cx - bw, BAR_Y - bw, bw * 2, bw * 2); c.restore();
        acc += dt; while (acc > 22) { acc -= 22; const x = cx + (Math.random() - .3) * 30; add(x, BAR_Y, -Math.PI * (0.1 + Math.random() * 0.8), (0.6 + Math.random() * (1.2 + lv * 0.6)), { life: 500 + lv * 120 }); }
      }
      if (kind === '100') {
        if (t < 3000) { acc += dt; while (acc > 9) { acc -= 9; const x = Math.random() * hw; add(x, BAR_Y + 2, Math.PI * (0.35 + Math.random() * 0.3), 0.8 + Math.random() * 1.8, { life: 800, g: 0.02 }); if (Math.random() < 0.3) add(x, BAR_Y, -Math.PI * (0.2 + Math.random() * 0.6), 1 + Math.random() * 2.2, { life: 600 }); } }
        const gl = Math.max(0, 1 - Math.abs(t - 600) / 700) * 0.4 + (t < 3000 ? 0.08 : 0); if (gl > 0) { const g = c.createLinearGradient(0, BAR_Y - 4, 0, BAR_Y + 28); g.addColorStop(0, `rgba(242,169,59,${gl})`); g.addColorStop(1, 'rgba(242,169,59,0)'); c.fillStyle = g; c.fillRect(0, BAR_Y - 4, hw, 32); }
        if (t > 150 && !track.dataset.pl) { track.dataset.pl = 1; track.classList.remove('pulse'); void track.offsetWidth; track.classList.add('pulse'); setTimeout(() => { track.classList.remove('pulse'); delete track.dataset.pl; }, 1000); }
      }
      for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx * k; p.y += p.vy * k; p.vx *= Math.pow(0.97, k); p.vy = p.vy * Math.pow(0.97, k) + p.g * k; p.age += dt; p.tw += 0.28 * k; if (p.age >= p.life || p.y > MAXY || p.y < -10) { parts.splice(i, 1); continue; } draw(p); }
      const total_t = DUR + (kind === '100' ? 700 : 500);
      if (t < DUR || (parts.length && t < total_t + 600)) requestAnimationFrame(frame); else finish();
    }
    function finish() { if (ended) return; ended = true; clearTimeout(hard); if (stopper === finish) stopper = null; cv.remove(); fill.classList.remove('shim'); busy = false; if (queued) { const q = queued; queued = null; setTimeout(() => celebrate(q), 250); } }
    const hard = setTimeout(finish, DUR + 3000); stopper = finish;
    requestAnimationFrame(frame);
  }

  // ---- progress events ----
  function markRead(file) {
    file = norm(file); if (!PAGES.some(p => p[0] === file) || S.read[file]) return false;
    const before = readCount();
    S.read[file] = Date.now(); delete S.part[file];
    const rc = before + 1; let kind = 'read';
    if (rc >= N && !S.shown[100]) { kind = '100'; S.shown[100] = 1; }
    else { for (let i = MILES.length - 1; i >= 0; i--) { const m = MILES[i]; if (rc / N * 100 >= m && !S.shown[m]) { kind = String(m); for (const mm of MILES) if (mm <= m) S.shown[mm] = 1; break; } } }
    save(); render();
    if (!celebrate(kind) && kind === 'read') showLabel(2000);
    else if (still) showLabel(2000);
    return true;
  }
  function reset() { mem = blank(); for (const k in mem) S[k] = mem[k]; mem = S; try { localStorage.removeItem(KEY); } catch (e) {} confirming = false; cur = 0; scrollCalc(); render(); if (!pop.hidden) renderPop(); }

  // ---- reading the current page: scroll fraction, end-of-page, dwell time ----
  let dwell = 0, since = document.hidden ? 0 : performance.now(), atEnd = false, readTimer = 0, raf = 0, saveT = 0;
  const dwelled = () => dwell + (since ? performance.now() - since : 0);
  function checkRead() {
    if (!tracked || S.read[here] || !atEnd) return;
    const left = dwellMs - dwelled();
    clearTimeout(readTimer);
    if (left <= 0) markRead(here); else if (!document.hidden) readTimer = setTimeout(checkRead, left + 20);
  }
  function scrollCalc() {
    if (!tracked || S.read[here]) { cur = 0; return; }
    const d = document.documentElement, max = Math.max(1, d.scrollHeight - innerHeight), f = Math.max(0, Math.min(1, (window.scrollY || d.scrollTop) / max));
    cur = Math.min(0.8, f * 0.8);
  }
  function onScroll() {
    if (raf) return; raf = requestAnimationFrame(() => {
      raf = 0; if (!tracked || S.read[here]) return;
      const before = cur; scrollCalc(); const mp = S.part[here] || 0;
      if (cur > before + 0.003 || cur > mp) { render(); if (cur - mp > 0.04) { S.part[here] = cur; clearTimeout(saveT); saveT = setTimeout(save, 600); } }
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { render(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (since) { dwell += performance.now() - since; since = 0; } clearTimeout(readTimer); if (cur > (S.part[here] || 0) && tracked && !S.read[here]) S.part[here] = cur; save(); }
    else { since = performance.now(); checkRead(); }
  });
  addEventListener('pagehide', () => { if (tracked && !S.read[here] && cur > (S.part[here] || 0)) S.part[here] = cur; save(); });
  const nu = document.querySelector('section.nextup');
  if (tracked && nu && 'IntersectionObserver' in window) {
    new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting && !atEnd) { atEnd = true; checkRead(); } }).observe(nu);
  } else if (tracked) { // no marker: treat reaching the bottom as the end
    addEventListener('scroll', () => { if (!atEnd && innerHeight + scrollY >= document.documentElement.scrollHeight - 40) { atEnd = true; checkRead(); } }, { passive: true });
  }

  // ---- public handle for review ----
  const api = window.hmrProgress = {
    state() { return { percent: pct(), pagesRead: readCount(), total: N, current: here, tracked, partial: +cur.toFixed(3), read: Object.assign({}, S.read), part: Object.assign({}, S.part), shown: Object.assign({}, S.shown), dwellMs, label: text() }; },
    markRead, reset, celebrate(kind) { return celebrate(kind); },
    setDwell(ms) { dwellMs = +ms; checkRead(); }
  };

  // ---- start ----
  scrollCalc(); render();
  // every page load: icicles under the header (skipped for reduced motion, a hidden tab, or while the page fire runs)
  const arrive = () => { if (document.hidden) { const once = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', once); celebrate('icicles'); } }; document.addEventListener('visibilitychange', once); } else celebrate('icicles'); };
  setTimeout(arrive, 250);
})();
