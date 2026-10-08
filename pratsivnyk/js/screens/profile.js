(function (root) {
  'use strict';
  var P = root.P, esc = P.esc;

  function maskEmail(e) {
    var s = String(e || ''), at = s.indexOf('@');
    return at > 2 ? s.slice(0, 2) + '***' + s.slice(at) : (s || '—');
  }

  P.screen('/profile', {
    back: '/home',
    title: function () { return 'Мій профіль'; },
    render: function (ctx) {
      var me = ctx.me, dark = root.document.documentElement.getAttribute('data-theme') === 'dark';
      return '<div class="stack">' +
        '<section class="ui-card"><div class="card-head"><span class="avatar">' + esc(P.initials(me.name)) + '</span>' +
        '<div class="grow"><h2 class="card-title">' + esc(me.name) + '</h2><p class="card-sub">' + esc(maskEmail(me.email)) + '</p></div></div>' +
        '<dl class="kv"><dt>Роль</dt><dd>Працівник (аудитор)</dd><dt>Локація</dt><dd>' + esc(P.shell.locName(ctx.loc)) + '</dd>' +
        '<dt>Вхід</dt><dd>Google · раз на тиждень</dd></dl></section>' +
        '<section class="ui-card"><h2 class="card-title">Тема</h2><div class="ui-seg" role="group" aria-label="Тема">' +
        '<button class="ui-seg__btn" type="button" data-theme-set="dark" aria-pressed="' + dark + '">' + P.ic('theme-dark') + 'Темна</button>' +
        '<button class="ui-seg__btn" type="button" data-theme-set="light" aria-pressed="' + !dark + '">' + P.ic('theme-light') + 'Світла</button></div></section>' +
        '<button class="ui-btn ui-btn--secondary home-cta" type="button" data-act="logout">' + P.ic('logout') + 'Вийти</button>' +
        '<section class="ui-card"><h2 class="card-title">Тестова версія</h2><p class="card-sub">Записані аудити лежать лише в цьому браузері.</p>' +
        '<button class="ui-btn ui-btn--quiet" type="button" data-act="reset">' + P.ic('refresh') + 'Скинути тестові дані</button></section></div>';
    },
    mount: function (el) {
      P.delegate(el, 'click', '[data-theme-set]', function (e, t) { P.shell.setTheme(t.getAttribute('data-theme-set')); P.shell.rerender(); });
      P.delegate(el, 'click', '[data-act="logout"]', function () {
        P.srv('authLogout').then(function () { root.location.hash = ''; root.location.reload(); });
      });
      P.delegate(el, 'click', '[data-act="reset"]', function () {
        P.confirm({ title: 'Скинути тестові дані?', text: 'Усі аудити, записані вами в тестовій версії, зникнуть.', okLabel: 'Скинути', danger: true })
          .then(function (ok) {
            if (!ok) return;
            P.srv('demoReset').then(function (r) {
              if (!r.ok) return P.toast('danger', 'Не вдалося скинути', r.error);
              Object.keys(root.localStorage || {}).forEach(function (k) { if (k.indexOf('audit-demo:draft:') === 0) P.store.del(k.slice('audit-demo:'.length)); });
              root.location.hash = ''; root.location.reload();
            });
          });
      });
    }
  });
})(window);
