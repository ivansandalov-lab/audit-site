(function (root) {
  'use strict';
  var P = root.P = root.P || {}, doc = root.document;
  if (!doc || P.embed) return;

  var meta = doc.querySelector('meta[name="app-build"]');
  var MINE = meta ? String(meta.getAttribute('content') || '') : '';
  var EVERY_MS = 5 * 60 * 1000, QUIET_MS = 30 * 1000;   // планова перевірка; не частіше ніж раз на 30 с при поверненні на вкладку
  var TRIED = 'audit-update-tried';                     // sessionStorage: яку збірку вже пробували завантажити
  var shown = false, lastCheck = 0;

  function tried() { try { return root.sessionStorage.getItem(TRIED) || ''; } catch (e) { return ''; } }
  function setTried(v) { try { root.sessionStorage.setItem(TRIED, v); } catch (e) { /* без памʼяті — просто перезавантажимось */ } }

  var CSS = '.upd{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;' +
    'background:var(--bg,#F8F3EC);color:var(--text,#2B2520);font-family:var(--font,system-ui,sans-serif);text-align:center}' +
    '.upd__box{display:flex;flex-direction:column;align-items:center;gap:14px;max-width:440px}' +
    '.upd__ic{display:grid;place-items:center;width:84px;height:84px;border-radius:24px;background:var(--brand-soft,#FCE3D2);color:var(--brand-ink,#9A4A14)}' +
    '.upd__ic svg{width:44px;height:44px}' +
    '.upd__title{margin:6px 0 0;font-size:28px;font-weight:700;line-height:1.2}' +
    '.upd__text{margin:0;font-size:18px;line-height:1.45;color:var(--text-2,#5C5149)}' +
    '.upd__btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-width:220px;height:56px;margin-top:10px;padding:0 28px;border:0;border-radius:999px;' +
    'background:var(--brand-fill,#EF8F4E);color:var(--on-brand,#2B1A0C);font:inherit;font-size:18px;font-weight:700;cursor:pointer}' +
    '.upd__btn:focus-visible{outline:3px solid var(--focus,#2D6396);outline-offset:3px}' +
    '.upd__btn[aria-busy="true"]{opacity:.6;cursor:default}' +
    '.upd__note{margin:0;font-size:15px;line-height:1.4;color:var(--text-3,#8A7F76)}';
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20 11a8 8 0 0 0-14.3-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.5L20 16"/><path d="M20 20v-4h-4"/></svg>';

  function formOpen() {
    var fr = doc.querySelector('iframe.sr-frame');
    return /^#\/audit\/new/.test(root.location.hash || '') || !!(fr && /#\/audit\/new/.test(fr.getAttribute('src') || ''));
  }

  function show(remote) {
    if (shown) return;
    shown = true;
    var again = remote && tried() === remote;   // уже оновлювались, а сторінка прийшла стара — сервер ще не встиг
    var style = doc.createElement('style'); style.textContent = CSS; doc.head.appendChild(style);
    Array.prototype.forEach.call(doc.body.children, function (n) { n.setAttribute('inert', ''); n.setAttribute('aria-hidden', 'true'); });
    doc.documentElement.style.overflow = 'hidden';
    var box = doc.createElement('div');
    box.className = 'upd'; box.setAttribute('role', 'alertdialog'); box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'upd-title'); box.setAttribute('aria-describedby', 'upd-text');
    box.innerHTML = '<div class="upd__box"><div class="upd__ic">' + ICON + '</div>' +
      '<h1 class="upd__title" id="upd-title">Вийшло оновлення</h1>' +
      '<p class="upd__text" id="upd-text">Щоб працювати далі, оновіть додаток.' +
      (formOpen() ? ' Аудит, який ви не дописали, збережеться як чернетка — після оновлення продовжите з того ж місця.' : '') + '</p>' +
      '<button class="upd__btn" type="button">' + 'Оновити</button>' +
      (again ? '<p class="upd__note">Нова версія ще не завантажилась на цей пристрій. Натисніть «Оновити» ще раз за хвилину.</p>' : '') + '</div>';
    doc.body.appendChild(box);
    var btn = box.querySelector('.upd__btn');
    btn.onclick = function () {
      if (btn.getAttribute('aria-busy') === 'true') return;
      btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Оновлюю…';
      root.setTimeout(function () { btn.removeAttribute('aria-busy'); btn.textContent = 'Оновити'; }, 6000);
      try { if (P.AF && P.AF.draft) P.AF.draft.flush(); } catch (e) { /* чернетку допише ще й подія pagehide */ }
      if (remote) setTried(remote);
      root.location.replace(root.location.pathname + (remote ? '?u=' + remote + '-' + Date.now() : '') + root.location.hash);
    };
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') { e.preventDefault(); btn.focus(); }
      e.stopPropagation();
    }, true);
    doc.addEventListener('focusin', function (e) { if (!box.contains(e.target)) btn.focus(); }, true);
    btn.focus();
  }

  function check() {
    if (shown || !MINE || !root.fetch) return;
    lastCheck = Date.now();
    root.fetch('../version.json?t=' + lastCheck, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var v = j && typeof j.v === 'string' && /^\d{14}$/.test(j.v) ? j.v : '';
        if (v && v > MINE) show(v);
      })
      .catch(function () { /* немає звʼязку — спитаємо наступного разу */ });
  }
  function soon() { if (Date.now() - lastCheck > QUIET_MS) check(); }

  P.updateCheck = { build: MINE, check: check, show: show };

  if (/[?&]demo-update=1/.test(root.location.search || '')) {
    var start = function () { show(''); };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
    return;
  }
  if (!MINE) return;
  root.setTimeout(check, 2000);
  root.setInterval(check, EVERY_MS);
  doc.addEventListener('visibilitychange', function () { if (!doc.hidden) soon(); });
  root.addEventListener('focus', soon);
})(typeof window !== 'undefined' ? window : globalThis);
