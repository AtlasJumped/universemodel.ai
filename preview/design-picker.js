/* Design picker, preview copy only. Four looks, a four-level rating each, notes, saved in localStorage. */
(function () {
  'use strict';
  var DESIGNS = [
    { id: 0, name: 'Original', css: '' },
    { id: 1, name: 'Warm paper', css:
      ':root{--white:#FBF6EC;--mist:#F4ECDC;--ice:#EFE3CC;--line:#DDCDB0;--navy:#2B2118;--ink:#2B2118;--soft:#6E5F4C;--blue:#9A4A1E;--blue-d:#7A3815;--sky:#C47A44;--deep:#6B3A1A;--font:Georgia,"Iowan Old Style","Times New Roman",serif;--shadow:0 1px 2px rgba(60,40,10,.08),0 8px 24px rgba(60,40,10,.06)}' +
      '.card,.compare .now,.road li,.fig,.tbl,.pgroup,.btn.ghost,.nav .drop,.lg-tab{background:#FFFBF2!important}.site-head{background:rgba(251,246,236,.94)!important}' },
    { id: 2, name: 'Night', css:
      ':root{--white:#0E1522;--mist:#131C2C;--ice:#182338;--line:#2A3852;--navy:#EAF1FB;--ink:#DCE6F5;--soft:#9DB0CC;--blue:#7DB1FF;--blue-d:#A6C9FF;--sky:#7DB1FF;--deep:#9CC3F5;--shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.3)}' +
      '.card,.compare .now,.road li,.fig,.tbl,.pgroup,.btn.ghost,.nav .drop,.lg-tab,.va-q div{background:#162033!important;color:var(--ink)}.site-head{background:rgba(14,21,34,.94)!important}' +
      '#hmr-welcome .box{background:#162033!important;color:#DCE6F5!important}#hmr-welcome h2{color:#EAF1FB!important}.compare .new{background:#1B2A45!important}.lg-tab th{background:#131C2C!important}' },
    { id: 3, name: 'High contrast clean', css:
      ':root{--white:#FFFFFF;--mist:#FFFFFF;--ice:#F0F0F0;--line:#111111;--navy:#000000;--ink:#000000;--soft:#222222;--blue:#0036B3;--blue-d:#002580;--sky:#0036B3;--deep:#000000;--shadow:none}' +
      'body{font-size:1.125rem}.card,.compare,.tbl,.pgroup,.fig,.lg-tab{border-width:2px!important;box-shadow:none!important}a{text-decoration:underline}.muted,.small{color:#222!important}' }
  ];
  var LEVELS = [['strong dislike', 'Strong dislike'], ['dislike', 'Dislike'], ['like', 'Like'], ['strong like', 'Strong like']];
  var KEY = 'um-design-ratings-v1', KEYD = 'um-design-current';
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var ratings = {};
  try { ratings = JSON.parse(store.get(KEY) || '{}') || {}; } catch (e) { ratings = {}; }
  function save() { store.set(KEY, JSON.stringify(ratings)); }

  var styleEl = document.createElement('style'); styleEl.id = 'dp-design'; document.head.appendChild(styleEl);
  var cur = 0;
  function apply(n) {
    n = Math.max(0, Math.min(DESIGNS.length - 1, n | 0)); cur = n;
    styleEl.textContent = DESIGNS[n].css;
    document.documentElement.setAttribute('data-design', String(n));
    document.body.className = document.body.className.replace(/\bdesign-\d\b/g, '').trim() + ' design-' + n;
    store.set(KEYD, String(n));
    try { var u = new URL(location.href); u.searchParams.set('design', String(n)); history.replaceState(null, '', u); } catch (e) {}
    if (panel) render();
  }

  var ui = document.createElement('style');
  ui.textContent =
    '#dp-btn{position:fixed;right:14px;bottom:66px;z-index:99998;font:600 14px/1 system-ui,sans-serif;background:#111;color:#fff;border:2px solid #fff;border-radius:999px;padding:11px 16px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.35)}' +
    '#dp-panel{position:fixed;right:14px;bottom:114px;z-index:99999;width:min(340px,calc(100vw - 28px));max-height:calc(100vh - 130px);overflow:auto;background:#fff;color:#111;border:2px solid #111;border-radius:14px;padding:14px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 10px 36px rgba(0,0,0,.4)}' +
    '#dp-panel *{box-sizing:border-box;font-family:inherit;letter-spacing:normal;text-transform:none}' +
    '#dp-panel h2{font:700 15px/1.2 system-ui,sans-serif;margin:0 0 10px;color:#111}' +
    '#dp-x{position:absolute;top:8px;right:8px;width:30px;height:30px;border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:#111}' +
    '#dp-panel .dp-row{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}' +
    '#dp-panel button.dp-b{border:1.5px solid #111;background:#fff;color:#111;border-radius:8px;padding:7px 10px;font:600 13px/1.1 system-ui,sans-serif;cursor:pointer}' +
    '#dp-panel button.dp-b[aria-pressed="true"]{background:#111;color:#fff}' +
    '#dp-panel label{display:block;font-weight:600;margin:8px 0 4px;color:#111}' +
    '#dp-panel textarea{width:100%;min-height:54px;border:1.5px solid #111;border-radius:8px;padding:7px;font:13px/1.4 system-ui,sans-serif;color:#111;background:#fff;resize:vertical}' +
    '#dp-panel .dp-s{font-size:12px;color:#444;margin:8px 0 0}';
  document.head.appendChild(ui);

  var btn = document.createElement('button'); btn.id = 'dp-btn'; btn.type = 'button'; btn.textContent = 'Design';
  btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false');
  var panel = null;

  function el(tag, attrs, text) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (text) e.textContent = text; return e; }

  function render() {
    panel.innerHTML = '';
    var x = el('button', { id: 'dp-x', type: 'button', 'aria-label': 'Close design picker' }, '×'); x.onclick = close; panel.appendChild(x);
    panel.appendChild(el('h2', { id: 'dp-h' }, 'Design: ' + DESIGNS[cur].name));
    var row = el('div', { 'class': 'dp-row', role: 'group', 'aria-label': 'Choose a design' });
    DESIGNS.forEach(function (d) {
      var b = el('button', { 'class': 'dp-b', type: 'button', 'aria-pressed': String(d.id === cur) }, (d.id + 1) + '. ' + d.name);
      b.onclick = function () { apply(d.id); }; row.appendChild(b);
    });
    panel.appendChild(row);
    panel.appendChild(el('label', {}, 'How is this design?'));
    var r = ratings[cur] || {};
    var lv = el('div', { 'class': 'dp-row', role: 'group', 'aria-label': 'Rating' });
    LEVELS.forEach(function (L) {
      var b = el('button', { 'class': 'dp-b', type: 'button', 'aria-pressed': String(r.rating === L[0]) }, L[1]);
      b.onclick = function () { var o = ratings[cur] || {}; o.rating = (o.rating === L[0]) ? '' : L[0]; ratings[cur] = o; save(); render(); };
      lv.appendChild(b);
    });
    panel.appendChild(lv);
    panel.appendChild(el('label', { 'for': 'dp-note' }, 'Note (optional)'));
    var ta = el('textarea', { id: 'dp-note' }); ta.value = r.note || '';
    ta.oninput = function () { var o = ratings[cur] || {}; o.note = ta.value; ratings[cur] = o; save(); };
    panel.appendChild(ta);
    var cp = el('button', { 'class': 'dp-b', type: 'button', style: 'margin-top:10px' }, 'Copy all ratings'); 
    cp.onclick = function () {
      var t = 'Design ratings (' + location.pathname + ')\n' + DESIGNS.map(function (d) { var o = ratings[d.id] || {}; return (d.id + 1) + '. ' + d.name + ': ' + (o.rating || 'not rated') + (o.note ? ' | ' + o.note : ''); }).join('\n');
      function done(ok) { cp.textContent = ok ? 'Copied' : 'Copy failed: select the text below'; if (!ok) { var pre = el('textarea', { 'aria-label': 'Ratings text' }); pre.value = t; panel.appendChild(pre); pre.select(); } setTimeout(function () { if (ok) cp.textContent = 'Copy all ratings'; }, 1500); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { done(true); }, function () { done(false); }); else done(false);
    };
    panel.appendChild(cp);
    panel.appendChild(el('p', { 'class': 'dp-s' }, 'Add ?design=1 to 4 to the address to open a look directly. Ratings stay in this browser.'));
  }
  function open() {
    if (panel) return;
    panel = el('div', { id: 'dp-panel', role: 'dialog', 'aria-labelledby': 'dp-h' });
    document.body.appendChild(panel); render(); btn.setAttribute('aria-expanded', 'true');
    var f = panel.querySelector('button.dp-b'); if (f) f.focus();
  }
  function close() { if (!panel) return; panel.remove(); panel = null; btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
  btn.onclick = function () { panel ? close() : open(); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel) close(); });

  function init() {
    document.body.appendChild(btn);
    var q = null; try { q = new URLSearchParams(location.search).get('design'); } catch (e) {}
    var n = q !== null && /^[1-9]\d*$/.test(q) ? parseInt(q, 10) - 1 : parseInt(store.get(KEYD) || '0', 10);
    apply(isNaN(n) ? 0 : n);
  }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
