/* Welcome question, shown once per browser before the first page (Leo, recording 2026-11-22f).
   Answers are kept in this browser (localStorage key "hmrWelcome") and, when the visitor presses Enter the site and filled in at least one, sent to us once through the dock's HMRDock.send (fire and forget). */
(function () {
  var KEY = "hmrWelcome";
  try {
    if (localStorage.getItem(KEY)) return;
  } catch (e) { return; }
  if (/fun\.html$/.test(location.pathname)) return;

  try { history.scrollRestoration = "manual"; } catch (e) {}
  var css = "#hmr-welcome{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:18px;background:rgba(11,27,51,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .35s ease}" +
    "#hmr-welcome.on{opacity:1}" +
    "#hmr-welcome .box{background:#fff;color:#0B1B33;max-width:560px;width:100%;border-radius:18px;box-shadow:0 30px 80px rgba(11,27,51,.35);padding:28px 28px 22px;max-height:calc(100vh - 36px);overflow:auto}" +
    "#hmr-welcome h2{margin:0 0 6px;font-size:1.55rem;line-height:1.2}" +
    "#hmr-welcome p{margin:0 0 16px;line-height:1.5}" +
    "#hmr-welcome .lbl{font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:#1F5FD6;font-weight:700;margin:16px 0 8px}" +
    "#hmr-welcome .opts{display:flex;flex-wrap:wrap;gap:8px}" +
    "#hmr-welcome .opt{border:1.5px solid #CBD6EA;background:#F5F8FD;color:#0B1B33;border-radius:999px;padding:9px 15px;font:inherit;font-size:.95rem;cursor:pointer;transition:all .15s ease}" +
    "#hmr-welcome .opt:hover{border-color:#1F5FD6}" +
    "#hmr-welcome .opt[aria-pressed=true]{background:#1F5FD6;border-color:#1F5FD6;color:#fff}" +
    "#hmr-welcome input[type=text]{width:100%;box-sizing:border-box;border:1.5px solid #CBD6EA;border-radius:10px;padding:10px 12px;font:inherit}" +
    "#hmr-welcome .row{display:flex;gap:10px;justify-content:space-between;align-items:center;margin-top:22px;flex-wrap:wrap}" +
    "#hmr-welcome .skip{background:none;border:0;color:#4A5B78;text-decoration:underline;font:inherit;cursor:pointer;padding:8px 0}" +
    "#hmr-welcome .go{background:#1F5FD6;color:#fff;border:0;border-radius:10px;padding:11px 20px;font:inherit;font-weight:600;cursor:pointer}" +
    "#hmr-welcome .note{font-size:.8rem;color:#6A7891;margin:14px 0 0}" +
    "@media (prefers-reduced-motion:reduce){#hmr-welcome{transition:none}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var w = document.createElement("div");
  w.id = "hmr-welcome";
  w.setAttribute("role", "dialog");
  w.setAttribute("aria-modal", "true");
  w.setAttribute("aria-labelledby", "hmr-welcome-t");
  w.innerHTML =
    '<div class="box">' +
      '<h2 id="hmr-welcome-t">Tell us a little about yourself</h2>' +
      '<p>Before you start, where do you stand? There are no wrong answers.</p>' +
      '<button type="button" class="skip" style="padding-top:0">No, just continue to the site</button>' +
      '<div class="lbl">A higher power</div>' +
      '<div class="opts" data-q="power">' +
        '<button type="button" class="opt" aria-pressed="false" data-v="believe">I believe in a higher power</button>' +
        '<button type="button" class="opt" aria-pressed="false" data-v="not">I don\'t believe in a higher power</button>' +
        '<button type="button" class="opt" aria-pressed="false" data-v="unsure">I\'ve never been sure</button>' +
      '</div>' +
      '<div class="lbl"><label for="hmr-welcome-rel">Religion (optional)</label></div>' +
      '<input type="text" id="hmr-welcome-rel" maxlength="80" placeholder="Any, or none" autocomplete="off">' +
      '<div class="lbl">New ideas</div>' +
      '<p style="margin:0 0 8px">I am generally receptive to new ideas about reality.</p>' +
      '<div class="opts" data-q="open">' +
        '<button type="button" class="opt" aria-pressed="false" data-v="yes">Yes</button>' +
        '<button type="button" class="opt" aria-pressed="false" data-v="no">No</button>' +
      '</div>' +
      '<div class="row" style="justify-content:flex-end">' +
        '<button type="button" class="go">Enter the site</button>' +
      '</div>' +
      '<p class="note">If you answer, we receive your answers without your name or email. Skipping sends nothing.</p>' +
    '</div>';

  function show() {
    document.body.appendChild(w);
    requestAnimationFrame(function () { w.classList.add("on"); });
    var first = w.querySelector(".opt"); if (first) first.focus({ preventScroll: true });
  }
  var ans = {};
  w.addEventListener("click", function (e) {
    var b = e.target.closest(".opt");
    if (b) {
      var grp = b.parentNode, q = grp.getAttribute("data-q");
      var was = b.getAttribute("aria-pressed") === "true";
      grp.querySelectorAll(".opt").forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      if (!was) { b.setAttribute("aria-pressed", "true"); ans[q] = b.getAttribute("data-v"); } else { delete ans[q]; }
      return;
    }
    if (e.target.closest(".skip")) return close({ skipped: true });
    if (e.target.closest(".go")) {
      var r = w.querySelector("#hmr-welcome-rel").value.trim();
      if (r) ans.religion = r;
      var has = !!(ans.power || ans.open || ans.religion);
      var snap = { power: ans.power, religion: ans.religion, open: ans.open };
      close(ans);
      if (has) sendAnswers(snap);
      return;
    }
  });
  w.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { close({ skipped: true }); return; }
    if (e.key === "Tab") {
      var f = w.querySelectorAll("button,input");
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });
  var LABELS = { power: "Higher power", religion: "Religion", open: "Receptive to new ideas" };
  function sendAnswers(a) {
    try {
      var lines = [];
      ["power", "religion", "open"].forEach(function (k) { if (a[k]) lines.push(LABELS[k] + ": " + a[k]); });
      var payload = { kind: "welcome answers", subject: "universemodel.ai welcome answers", message: "Welcome answers\n" + lines.join("\n") + "\nHost: " + location.host, details: { host: location.host, answers: a }, noMailto: true };
      var tries = 0;
      (function go() {
        if (window.HMRDock && typeof window.HMRDock.send === "function") { try { var r = window.HMRDock.send(payload); if (r && r.catch) r.catch(function () {}); } catch (e) {} return; }
        if (++tries < 40) setTimeout(go, 250);
      })();
    } catch (e) {}
  }
  function toTop() {
    try { if (location.hash) history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    try { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; } catch (e) {}
  }
  function close(data) {
    data.t = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
    w.classList.remove("on");
    setTimeout(function () {
      if (w.parentNode) w.parentNode.removeChild(w);
      toTop(); requestAnimationFrame(function () { toTop(); setTimeout(toTop, 120); });
    }, 350);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", show); else show();
})();
