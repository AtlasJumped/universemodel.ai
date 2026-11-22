// Video player: any <button data-yt="VIDEO_ID" data-yt-title="..."> (or data-yt-list="PLAYLIST_ID" for a channel's uploads) opens the video in a window over the page. Nothing loads from YouTube until the button is pressed.
(function () {
  'use strict';
  let box = null, last = null;
  const css = document.createElement('style');
  css.textContent = '.ytb{display:inline-flex;align-items:center;gap:8px;font:650 .9rem/1 var(--font,inherit);color:#fff;background:#0B2545;border:0;border-radius:999px;padding:10px 16px 10px 12px;cursor:pointer;margin-top:10px}.ytb::before{content:"";width:0;height:0;border-left:11px solid #F2A93B;border-top:7px solid transparent;border-bottom:7px solid transparent}.ytb:hover{background:#1D5FD1}.ytb:focus-visible{outline:2px solid #1D5FD1;outline-offset:2px}' +
    '.ytm{position:fixed;inset:0;z-index:200;background:rgba(6,16,34,.82);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .2s}.ytm.on{opacity:1}.ytm-in{width:min(960px,100%);transform:scale(.96);transition:transform .2s}.ytm.on .ytm-in{transform:none}.ytm-top{display:flex;justify-content:space-between;align-items:center;gap:12px;color:#fff;font:650 .95rem/1.3 var(--font,inherit);margin-bottom:10px}.ytm-x{flex:none;font:650 .9rem/1 var(--font,inherit);color:#0B2545;background:#fff;border:0;border-radius:999px;padding:9px 14px;cursor:pointer}.ytm-x:focus-visible{outline:2px solid #F2A93B;outline-offset:2px}.ytm-f{position:relative;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.5)}.ytm-f iframe{position:absolute;inset:0;width:100%;height:100%;border:0}@media (prefers-reduced-motion:reduce){.ytm,.ytm-in{transition:none}}';
  document.head.appendChild(css);
  function close() { if (!box) return; box.remove(); box = null; document.documentElement.style.overflow = ''; if (last && last.focus) last.focus(); }
  function open(id, title, btn) {
    const list = btn && btn.getAttribute('data-yt-list'); if (list ? !/^[\w-]{12,40}$/.test(list) : !/^[\w-]{11}$/.test(id || '')) return; close(); last = btn;
    box = document.createElement('div'); box.className = 'ytm'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title || 'Video');
    const inn = document.createElement('div'); inn.className = 'ytm-in';
    const top = document.createElement('div'); top.className = 'ytm-top'; const tt = document.createElement('span'); tt.textContent = title || ''; const x = document.createElement('button'); x.type = 'button'; x.className = 'ytm-x'; x.textContent = 'Close';
    top.appendChild(tt); top.appendChild(x);
    const f = document.createElement('div'); f.className = 'ytm-f'; const fr = document.createElement('iframe');
    fr.src = list ? 'https://www.youtube-nocookie.com/embed/videoseries?list=' + list + '&autoplay=1&rel=0' : 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0'; fr.title = title || 'Video'; fr.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; fr.allowFullscreen = true; fr.referrerPolicy = 'strict-origin-when-cross-origin';
    f.appendChild(fr); inn.appendChild(top); inn.appendChild(f); box.appendChild(inn); document.body.appendChild(box);
    document.documentElement.style.overflow = 'hidden';
    x.addEventListener('click', close); box.addEventListener('click', e => { if (e.target === box) close(); });
    requestAnimationFrame(() => { if (box) box.classList.add('on'); }); x.focus();
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-yt],[data-yt-list]'); if (!b) return; e.preventDefault(); open(b.getAttribute('data-yt'), b.getAttribute('data-yt-title'), b); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && box) close(); });
})();
