(function (root) {
  'use strict';
  var P = root.P, doc = root.document, esc = P.esc, S = P.sr;
  var CFG = P.cabinet || {}, ROLE = CFG.role === 'manager' ? 'manager' : 'admin';
  var TITLE = CFG.title || (ROLE === 'admin' ? 'Кабінет адміністратора' : 'Кабінет керівника');
  var HOME = CFG.home || '/overview';
  var C = P.cab = {};
  var app, main, me = null, cur = null, tabs = [], gen = 0, lastPath = null;

  C.tab = function (t) { tabs.push(t); tabs.sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); };
  C.screen = function (pattern, def) { P.router.add(pattern, def); };
  C.me = function () { return me; };

  function today() { return P.fmt.dayKey(new Date()); }
  function addDays(k, n) { var p = k.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * 86400000).toISOString().slice(0, 10); }
  var period = (function () { var v = P.store.get('cab:period', null); return v && v.from && v.to ? v : { from: addDays(today(), -29), to: today(), preset: 30 }; })();
  C.period = function () { return { from: period.from, to: period.to, preset: period.preset || null }; };
  C.addDays = addDays;
  C.today = today;
  function setPeriod(p) { period = p; P.store.set('cab:period', p); render(); }
  function periodBar() {
    return '<div class="wrap bar"><span class="hint">Період</span>' +
      '<label class="date">' + P.ic('calendar', 'ui-icon--sm') + '<input type="date" data-period="from" value="' + period.from + '" max="' + period.to + '" style="border:0;background:transparent;font:inherit;color:inherit"></label>' +
      '<span class="hint">—</span>' +
      '<label class="date">' + P.ic('calendar', 'ui-icon--sm') + '<input type="date" data-period="to" value="' + period.to + '" max="' + today() + '" style="border:0;background:transparent;font:inherit;color:inherit"></label>' +
      '<span class="pills">' + [7, 30, 90].map(function (n) {
        return '<button class="pill' + (period.preset === n ? ' pill--on' : '') + '" type="button" data-act="cab-preset" data-n="' + n + '">' + n + ' дн.</button>'; }).join('') + '</span></div>';
  }

  function strip() { return '<div class="sr-demo" role="note">' + P.ic('info', 'ui-icon--sm') + 'Тестова версія · усі імена й цифри вигадані · дані живуть лише в цьому браузері</div>'; }
  function frame(tab, showPeriod) {
    var now = new Date(), hhmm = (now.getHours() < 10 ? '0' : '') + now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
    return strip() +
      '<header class="wrap hdr"><div class="hdr__titles"><h1 class="hdr__title">' + esc(TITLE) + '</h1>' +
      '<p class="hdr__sub">Усі локації · ' + esc(S.h.dayLong(today())) + '</p></div>' +
      '<div class="hdr__tools"><button class="tool" type="button" data-act="cab-refresh" title="Перечитати дані" aria-label="Оновлено о ' + hhmm + ' — перечитати"><span class="sr-hide-phone">Оновлено о ' + hhmm + '</span>' + P.ic('refresh', 'ui-icon--sm') + '</button>' +
      '<button class="who" type="button" data-act="cab-profile" aria-label="Мій профіль"><span class="avatar">' + esc(P.initials(me.name)) + '</span><span class="sr-hide-phone">' + esc(me.name) + '</span></button></div></header>' +
      '<div class="sr-tabsbar"><nav class="wrap tabs" aria-label="Розділи">' + tabs.map(function (t) {
        return '<a class="tab' + (t.id === tab ? ' tab--on' : '') + '" href="#' + t.path + '">' + P.ic(t.ic) + esc(t.label) + '</a>'; }).join('') + '</nav></div>' +
      (showPeriod ? periodBar() : '') + '<main class="wrap content" id="cab-main" style="padding-top:' + (showPeriod ? 0 : 20) + 'px"></main>';
  }

  function render() {
    if (!me) return;
    var r = P.router.current(), m = P.router.match(r.path);
    if (!m) { P.router.go(HOME); return; }
    var def = m.screen, my = ++gen, handlers = {};
    S.closeAll();
    app.innerHTML = frame(def.tab, !!def.period);
    main = app.querySelector('#cab-main');
    if (r.path !== lastPath) { lastPath = r.path; root.scrollTo(0, 0); }
    var onTab = app.querySelector('.tab--on'), tabsEl = onTab && onTab.parentNode;
    if (tabsEl) tabsEl.scrollLeft = Math.max(0, onTab.offsetLeft - (tabsEl.clientWidth - onTab.offsetWidth) / 2);
    doc.title = (def.title || TITLE) + ' — ' + (ROLE === 'admin' ? 'адміністратор' : 'керівник') + ' (тест)';
    cur = { el: main, me: me, params: m.params, query: r.query, period: C.period(),
      alive: function () { return my === gen; },
      on: function (act, fn) { handlers[act] = fn; },
      go: function (path, query) { P.router.go(path, query); },
      reload: function () { render(); },
      handlers: handlers };
    main.innerHTML = S.h.loading();
    try { def.render(cur); } catch (e) { main.innerHTML = P.state.error('Помилка на екрані', String((e && e.message) || e)); if (root.console) console.error(e); }
  }
  C.render = render;

  function reloadData() { return P.srv('demoReload', {}).then(function () { render(); }); }
  C.reloadData = reloadData;
  var pending = null;
  root.addEventListener('storage', function (e) {
    if (e.key === 'audit-demo:demo:admin') return;   // сесію адміністратора обробляє profile-switch.js
    if (!me || !e.key || e.key.indexOf('audit-demo:demo:') !== 0 || e.key.indexOf('audit-demo:demo:me') === 0 || e.key.indexOf('audit-demo:demo:loggedAt') === 0) return;
    clearTimeout(pending);
    pending = setTimeout(function () {
      if (S.openCount()) { P.toast('info', 'Зʼявились нові дані', 'Натисніть «Оновлено», щоб побачити.'); return; }
      reloadData().then(function () { P.toast('info', 'Нові дані', 'Кабінет оновився сам — наприклад, хтось записав аудит.'); });
    }, 600);
  });

  function menuItem(act, ic, title, sub) {
    return '<button class="menu__item" type="button" data-act="' + act + '" style="border:0;background:transparent;width:100%;text-align:left;font:inherit;cursor:pointer">' +
      '<span class="menu__ic">' + P.ic(ic) + '</span><span><span class="menu__t">' + esc(title) + '</span>' + (sub ? '<span class="menu__s">' + esc(sub) + '</span>' : '') + '</span></button>';
  }
  function maskEmail(e) { e = String(e || ''); var at = e.indexOf('@'); return at > 2 ? e.slice(0, 2) + '***' + e.slice(at) : e; }
  function openProfile(anchor) {
    var dark = doc.documentElement.getAttribute('data-theme') === 'dark';
    S.menu(anchor, { width: 360, onMount: function (el) { P.profileSwitch.bind(el); }, body:
      '<div style="display:flex;gap:12px;align-items:center;padding:8px 12px"><span class="avatar" style="width:48px;height:48px">' + esc(P.initials(me.name)) + '</span>' +
      '<div style="min-width:0"><b>' + esc(me.name) + '</b><p class="hint">' + esc(maskEmail(me.email)) + '</p></div></div>' +
      '<div style="padding:4px 12px 8px"><span class="badge badge--brand">' + esc(me.roleLabel) + ' · усі локації</span></div>' +
      (me.admin ? '<div class="menu__sep"></div><div style="padding:8px 12px">' + P.profileSwitch.html(me) + '</div>' : '') +
      '<div class="menu__sep"></div><div style="padding:8px 12px"><div class="seg" role="group" aria-label="Тема">' +
      '<button class="seg__btn' + (dark ? '' : ' seg__btn--on') + '" type="button" data-act="th" data-v="light">' + P.ic('theme-light', 'ui-icon--sm') + 'Світла</button>' +
      '<button class="seg__btn' + (dark ? ' seg__btn--on' : '') + '" type="button" data-act="th" data-v="dark">' + P.ic('theme-dark', 'ui-icon--sm') + 'Темна</button></div></div>' +
      '<div class="menu__sep"></div>' +
      menuItem('pf-reset', 'refresh', 'Скинути тестові дані', 'Усе, що ви змінили в тестовій версії, зникне') +
      menuItem('pf-out', 'logout', 'Вийти', ''),
      on: {
        th: function (t, e, layer) { var v = t.getAttribute('data-v'); doc.documentElement.setAttribute('data-theme', v); P.store.set('theme:sr', v); layer.close(); },
        'pf-reset': function (t, e, layer) { layer.close(); P.confirm({ title: 'Скинути тестові дані?', text: 'Записані аудити, коригуючі дії й правки довідників у цьому браузері зникнуть.', okLabel: 'Скинути', danger: true })
          .then(function (ok) { if (!ok) return; P.srv('demoReset', {}).then(function () { P.toast('ok', 'Тестові дані скинуто'); boot(); }); }); },
        'pf-out': function (t, e, layer) { layer.close(); P.srv('authLogout', {}).then(function () { me = null; boot(); }); }
      } });
  }

  function loginScreen(users, note) {
    doc.title = TITLE + ' — вхід (тест)';
    app.innerHTML = strip() + '<main class="wrap" style="max-width:520px;padding-top:72px;display:flex;flex-direction:column;gap:14px;text-align:center;align-items:center">' +
      '<div class="hero__logo">' + P.ic('audit') + '</div><h1 class="hero__title">Аудит якості</h1><p class="hero__lead">' + esc(TITLE) + '</p>' +
      (note ? '<div class="banner banner--warn" style="text-align:left">' + P.ic('warning') + '<div class="banner__body"><p class="banner__text">' + esc(note) + '</p></div></div>' : '') +
      '<p class="hint">Тестова версія: вхід без пароля. У справжній — Google-пошта зі списку дозволених.</p>' +
      users.map(function (u) { return '<button class="btn btn--primary btn--block" type="button" data-login="' + esc(u.id) + '">' + P.ic('login') + 'Увійти як ' + esc(u.name) + ' · ' + esc(u.roleLabel) + '</button>'; }).join('') +
      '</main>';
  }
  function boot() {
    S.closeAll();
    P.srv('authMe', {}).then(function (r) {
      var m = r && r.ok ? r.me : null;
      if (m && m.role === ROLE) { me = m; render(); return; }
      me = null;
      P.srv('demoUsers', {}).then(function (u) {
        var list = (u.users || []).filter(function (x) { return x.role === ROLE || x.role === 'admin'; });
        loginScreen(list, m ? 'Ви увійшли як «' + m.roleLabel + '». Цей кабінет — для ' + (ROLE === 'admin' ? 'адміністратора' : 'керівника') + '.' : '');
      });
    });
  }
  C.boot = boot;

  function start() {
    app = doc.getElementById('app');
    if (P.mountIcons) P.mountIcons();
    app.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act], [data-login]');
      if (!t || !app.contains(t)) return;
      if (t.hasAttribute('data-login')) {
        t.disabled = true;
        P.srv('authDemoLogin', { userId: t.getAttribute('data-login') }).then(function (r) { if (r.ok) boot(); else { t.disabled = false; P.toast('danger', 'Не вдалося увійти', r.error); } });
        return;
      }
      var act = t.getAttribute('data-act');
      if (act === 'cab-profile') { e.preventDefault(); openProfile(t); return; }
      if (act === 'cab-refresh') { e.preventDefault(); reloadData().then(function () { P.toast('ok', 'Дані перечитано'); }); return; }
      if (act === 'cab-preset') { var n = +t.getAttribute('data-n'); setPeriod({ from: addDays(today(), -(n - 1)), to: today(), preset: n }); return; }
      if (act === 'retry') { render(); return; }
      if (cur && cur.handlers[act]) { e.preventDefault(); cur.handlers[act](t, e); }
    });
    app.addEventListener('change', function (e) {
      var t = e.target;
      if (t.getAttribute && t.getAttribute('data-period')) {
        var p = { from: period.from, to: period.to, preset: null }; p[t.getAttribute('data-period')] = t.value;
        if (p.from && p.to && p.from <= p.to) setPeriod(p);
        return;
      }
      var a = t.getAttribute && t.getAttribute('data-change');
      if (a && cur && cur.handlers[a]) cur.handlers[a](t, e);
    });
    app.addEventListener('input', function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-input');
      if (a && cur && cur.handlers[a]) cur.handlers[a](e.target, e);
    });
    root.addEventListener('hashchange', render);
    P.on('route', render);
    P.on('auth:required', function () { me = null; boot(); });
    P.on('auth:forbidden', function (r) { P.toast('warn', 'Немає прав на цю дію', r && r.error); });
    boot();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
