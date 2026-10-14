(function (root) {
  'use strict';
  var P = root.P = root.P || {}, doc = root.document;
  var texts = Object.create(null), pop = null, anchorEl = null;

  function esc(s) { return P.esc ? P.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

  var CSS = '.hq{display:inline-grid;place-items:center;width:24px;height:24px;margin:0 0 0 6px;padding:0;border:1px solid var(--line-strong,#c9bfb4);' +
    'border-radius:50%;background:var(--surface,#fff);color:var(--text-2,#5c5149);font:700 12px/1 var(--font,system-ui,sans-serif);cursor:pointer;vertical-align:middle;flex:none}' +
    '.hq:hover,.hq[aria-expanded="true"]{border-color:var(--brand,#c96a2c);color:var(--brand-ink,#9a4a14)}' +
    '.hq:focus-visible{outline:3px solid var(--focus,#2d6396);outline-offset:2px}' +
    '.hq-pop{position:fixed;z-index:2147482000;max-width:min(340px,calc(100vw - 24px));padding:12px 14px;border:1px solid var(--line-strong,#c9bfb4);' +
    'border-radius:12px;background:var(--surface,#fff);color:var(--text,#2b2520);box-shadow:0 8px 28px rgba(0,0,0,.18);' +
    'font:400 14px/1.45 var(--font,system-ui,sans-serif);text-align:left}' +
    '.hq-pop b{display:block;margin:0 0 4px;font-size:15px}.hq-pop p{margin:0}.hq-pop p+p{margin-top:6px}.hq-pop .hq-ex{color:var(--text-2,#5c5149)}';

  function style() {
    if (!doc || doc.getElementById('hq-style')) return;
    var s = doc.createElement('style'); s.id = 'hq-style'; s.textContent = CSS; doc.head.appendChild(s);
  }

  function close() {
    if (pop) { pop.remove(); pop = null; }
    if (anchorEl) { anchorEl.setAttribute('aria-expanded', 'false'); anchorEl = null; }
  }

  function open(key, anchor) {
    var h = texts[key];
    close();
    if (!h || !doc) return;
    style();
    pop = doc.createElement('div');
    pop.className = 'hq-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', h.t || 'Пояснення');
    pop.innerHTML = '<b>' + esc(h.t || '') + '</b>' + String(h.d || '').split('\n').map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') +
      (h.ex ? '<p class="hq-ex">' + esc(h.ex) + '</p>' : '');
    doc.body.appendChild(pop);
    var r = anchor.getBoundingClientRect(), w = pop.offsetWidth, hgt = pop.offsetHeight, vw = root.innerWidth, vh = root.innerHeight;
    var left = Math.max(12, Math.min(vw - w - 12, r.left + r.width / 2 - w / 2));
    var top = r.bottom + 8 + hgt > vh - 8 && r.top - 8 - hgt > 8 ? r.top - 8 - hgt : r.bottom + 8;
    pop.style.left = Math.round(left) + 'px'; pop.style.top = Math.round(top) + 'px';
    anchorEl = anchor; anchor.setAttribute('aria-expanded', 'true');
  }

  P.help = {
    add: function (dict) { Object.keys(dict || {}).forEach(function (k) { texts[k] = dict[k]; }); },
    btn: function (key, label) {
      var h = texts[key];
      if (!h) { if (root.console) console.warn('help: немає пояснення', key); return ''; }
      return '<button class="hq" type="button" data-help="' + esc(key) + '" aria-expanded="false" aria-label="Що це: ' + esc(label || h.t || '') + '">?</button>';
    },
    text: function (key) { var h = texts[key]; return h ? h.t + ' — ' + String(h.d || '').replace(/\n/g, ' ') : ''; },
    has: function (key) { return !!texts[key]; },
    open: open,
    close: close
  };

  if (!doc) return;
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', style); else style();
  doc.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-help]');
    if (b) {
      e.preventDefault(); e.stopPropagation();
      if (anchorEl === b) close(); else open(b.getAttribute('data-help'), b);
      return;
    }
    if (pop && !pop.contains(e.target)) close();
  }, true);
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop) { e.stopPropagation(); close(); } }, true);
  root.addEventListener('scroll', function () { if (pop) close(); }, true);
  root.addEventListener('resize', close);
  root.addEventListener('hashchange', close);
})(typeof window !== 'undefined' ? window : globalThis);
