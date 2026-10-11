(function (root) {
  'use strict';
  var P = root.P, doc = root.document, esc = P.esc;
  var ROLE = (P.cabinet && P.cabinet.role) === 'manager' ? 'manager' : 'admin';
  var TXT = ROLE === 'admin'
    ? { who: 'адміністратора', title: 'Кабінет адміністратора', soon: 'Тут зʼявляться показники локацій, аудитори, рейтинги, доступи й журнал змін.' }
    : { who: 'керівника', title: 'Кабінет керівника', soon: 'Тут зʼявиться статистика по локаціях і відділах, рейтинги та вивантаження за місяць.' };
  var app, me = null, menu = null, gen = 0;

  function strip() { return '<div class="sr-demo" role="note">' + P.ic('info', 'ui-icon--sm') + 'Тестова версія · усі імена й цифри вигадані · дані живуть лише в цьому браузері</div>'; }
  function num(n) { return n == null ? '—' : P.fmt && P.fmt.num ? P.fmt.num(n) : String(n); }
  function pct(v) { return v == null ? '—' : String(Math.round(v * 10) / 10).replace('.', ',') + '%'; }
  function maskEmail(e) { e = String(e || ''); var at = e.indexOf('@'); return at > 2 ? e.slice(0, 2) + '***' + e.slice(at) : e; }
  function dayLong() { return new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' }); }

  function tile(l) {
    var t = l.today;
    return '<article class="dtile cab-loc"><span class="dtile__name">' + P.ic('location', 'ui-icon--sm') + esc(l.name) + '</span>' +
      '<span class="dtile__meta">' + num(l.departments) + ' ' + P.plural(l.departments, 'відділ', 'відділи', 'відділів') + ' · ' +
      num(l.workers) + ' ' + P.plural(l.workers, 'працівник', 'працівники', 'працівників') + '</span>' +
      '<div class="dtile__nums"><div><b>' + num(t.audits) + '</b><span>' + P.plural(t.audits, 'аудит', 'аудити', 'аудитів') + ' сьогодні</span></div>' +
      '<div>' + (t.audits ? '<b>' + num(t.rejected) + ' шт</b> · ' + pct(t.pct) : '<b>—</b>') + '<span>брак</span></div></div>' +
      (me.admin ? '<div class="cab-loc__btns">' +
        '<button class="btn btn--secondary btn--sm" type="button" data-open="senior_auditor" data-loc="' + esc(l.id) + '">' + P.ic('chart', 'ui-icon--sm') + 'Як старший</button>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-open="auditor" data-loc="' + esc(l.id) + '">' + P.ic('audit', 'ui-icon--sm') + 'Як працівник</button></div>' : '') +
      '</article>';
  }
  function render() {
    var my = ++gen;
    closeMenu();
    doc.title = TXT.title + ' (тест)';
    app.innerHTML = strip() +
      '<header class="wrap hdr"><div class="hdr__titles"><h1 class="hdr__title">Усі локації</h1><p class="hdr__sub">' + esc(TXT.title + ' · ' + dayLong()) + '</p></div>' +
      '<div class="hdr__tools"><button class="who" type="button" data-act="profile" aria-label="Мій профіль"><span class="avatar">' + esc(P.initials(me.name)) + '</span>' +
      '<span class="sr-hide-phone">' + esc(me.name) + '</span></button></div></header>' +
      '<main class="wrap content" id="cab-main" style="padding-top:20px">' + P.state.loading() + '</main>';
    var main = app.querySelector('#cab-main');
    P.srv('adminOverview', {}).then(function (r) {
      if (my !== gen) return;
      if (!r.ok) { main.innerHTML = P.state.error('Не вдалося завантажити', r.error || ''); return; }
      main.innerHTML = '<section style="display:flex;flex-direction:column;gap:12px"><div><h2 class="h2">Локації · ' + r.locations.length + '</h2>' +
        '<p class="h2-sub">' + (me.admin ? 'Відкрийте будь-яку так, як її бачить старший аудитор або працівник.' : 'Що перевірено сьогодні на кожній локації.') + '</p></div>' +
        '<div class="cab-locs">' + r.locations.map(tile).join('') + '</div></section>' +
        '<section class="card">' + P.state.empty('info', 'Решта кабінету — ще в роботі', TXT.soon +
          (me.admin ? ' Перемикач профілів — кружечок з ініціалами справа вгорі.' : '')) + '</section>';
    });
  }

  function closeMenu() { if (menu) { menu.remove(); menu = null; } }
  function openMenu(anchor) {
    closeMenu();
    var r = anchor.getBoundingClientRect(), dark = doc.documentElement.getAttribute('data-theme') === 'dark';
    menu = doc.createElement('div');
    menu.className = 'ov ov--menu';
    var top = Math.round(r.bottom + 8);   // висота — до низу екрана, решта гортається
    menu.innerHTML = '<div class="backdrop backdrop--none" data-close></div><nav class="menu" style="position:fixed;top:' + top + 'px;right:' +
      Math.max(16, Math.round(root.innerWidth - r.right)) + 'px;width:360px;max-width:calc(100vw - 32px);max-height:' + Math.max(200, root.innerHeight - top - 12) + 'px;overflow:auto">' +
      '<div style="display:flex;gap:12px;align-items:center;padding:8px 12px"><span class="avatar" style="width:48px;height:48px">' + esc(P.initials(me.name)) + '</span>' +
      '<div style="min-width:0"><b>' + esc(me.name) + '</b><p class="hint">' + esc(maskEmail(me.email)) + '</p></div></div>' +
      '<div style="padding:4px 12px 8px"><span class="badge badge--brand">' + esc(me.roleLabel) + ' · усі локації</span></div>' +
      (me.admin ? '<div class="menu__sep"></div><div style="padding:8px 12px">' + P.profileSwitch.html(me) + '</div>' : '') +
      '<div class="menu__sep"></div><div style="padding:8px 12px"><div class="seg" role="group" aria-label="Тема">' +
      '<button class="seg__btn' + (dark ? '' : ' seg__btn--on') + '" type="button" data-th="light">' + P.ic('theme-light', 'ui-icon--sm') + 'Світла</button>' +
      '<button class="seg__btn' + (dark ? ' seg__btn--on' : '') + '" type="button" data-th="dark">' + P.ic('theme-dark', 'ui-icon--sm') + 'Темна</button></div></div>' +
      '<div class="menu__sep"></div>' + item('reset', 'refresh', 'Скинути тестові дані', 'Усе, що змінили в тестовій версії, зникне') + item('out', 'logout', 'Вийти', '') + '</nav>';
    doc.getElementById('overlay').appendChild(menu);
    P.profileSwitch.bind(menu);
    menu.addEventListener('click', function (e) {
      var t = e.target.closest('[data-close], [data-th], [data-act]');
      if (!t) return;
      if (t.hasAttribute('data-th')) { var v = t.getAttribute('data-th'); doc.documentElement.setAttribute('data-theme', v); P.store.set('theme:sr', v); closeMenu(); return; }
      var act = t.getAttribute('data-act');
      closeMenu();
      if (act === 'out') P.srv('authLogout', {}).then(function () { me = null; boot(); });
      if (act === 'reset') {
        P.confirm({ title: 'Скинути тестові дані?', text: 'Записані аудити, коригуючі дії й правки довідників у цьому браузері зникнуть.', okLabel: 'Скинути', danger: true })
          .then(function (ok) { if (ok) P.srv('demoReset', {}).then(function () { P.toast('ok', 'Тестові дані скинуто'); boot(); }); });
      }
    });
  }
  function item(act, ic, title, sub) {
    return '<button class="menu__item" type="button" data-act="' + act + '" style="border:0;background:transparent;width:100%;text-align:left;font:inherit;cursor:pointer">' +
      '<span class="menu__ic">' + P.ic(ic) + '</span><span><span class="menu__t">' + esc(title) + '</span>' + (sub ? '<span class="menu__s">' + esc(sub) + '</span>' : '') + '</span></button>';
  }

  function loginScreen(users, note) {
    doc.title = TXT.title + ' — вхід (тест)';
    app.innerHTML = strip() + '<main class="wrap" style="max-width:520px;padding-top:72px;display:flex;flex-direction:column;gap:14px;text-align:center;align-items:center">' +
      '<div class="hero__logo">' + P.ic('audit') + '</div><h1 class="hero__title">Аудит якості</h1><p class="hero__lead">' + esc(TXT.title) + '</p>' +
      (note ? '<div class="banner banner--warn" style="text-align:left">' + P.ic('warning') + '<div class="banner__body"><p class="banner__text">' + esc(note) + '</p></div></div>' : '') +
      '<p class="hint">Тестова версія: вхід без пароля. У справжній — Google-пошта зі списку дозволених.</p>' +
      users.map(function (u) { return '<button class="btn btn--primary btn--block" type="button" data-login="' + esc(u.id) + '">' + P.ic('login') + 'Увійти як ' + esc(u.name) + ' · ' + esc(u.roleLabel) + '</button>'; }).join('') +
      '</main>';
  }
  function boot() {
    closeMenu();
    P.srv('authMe', {}).then(function (r) {
      var m = r && r.ok ? r.me : null;
      if (m && m.role === ROLE) { me = m; render(); return; }
      me = null;
      P.srv('demoUsers', {}).then(function (u) {
        var list = (u.users || []).filter(function (x) { return x.role === ROLE || x.role === 'admin'; });
        loginScreen(list, m ? 'Ви увійшли як «' + m.roleLabel + '». Цей кабінет — для ' + TXT.who + '.' : '');
      });
    });
  }

  function start() {
    app = doc.getElementById('app');
    if (P.mountIcons) P.mountIcons();
    app.addEventListener('click', function (e) {
      var t = e.target.closest('[data-login], [data-open], [data-act]');
      if (!t || !app.contains(t)) return;
      if (t.hasAttribute('data-login')) {
        t.disabled = true;
        P.srv('authDemoLogin', { userId: t.getAttribute('data-login') }).then(function (r) { if (r.ok) boot(); else { t.disabled = false; P.toast('danger', 'Не вдалося увійти', r.error); } });
      } else if (t.hasAttribute('data-open')) {
        t.disabled = true;
        P.profileSwitch.open(t.getAttribute('data-open'), t.getAttribute('data-loc')).then(function (ok) { if (!ok) t.disabled = false; });
      } else if (t.getAttribute('data-act') === 'profile') openMenu(t);
      else if (t.getAttribute('data-act') === 'retry') render();
    });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
    P.on('auth:required', function () { me = null; boot(); });
    P.on('auth:forbidden', function (r) { P.toast('warn', 'Немає прав на цю дію', r && r.error); });
    boot();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
