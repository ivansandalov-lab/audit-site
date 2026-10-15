(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm, da = A.da;
  var HINT = {
    recordAudit: 'Форма аудиту; там же — додати виробничого працівника, якого ще немає в списку.',
    editOthersAudits: 'Може будь-коли виправити аудит іншої людини своєї локації. Свій аудит автор виправляє сам у вікні виправлення.',
    viewAllLocations: 'Огляд усіх локацій із числами за сьогодні (кабінети керівника й адміністратора).'
  };

  P.cab.screen('/people/rights', { tab: 'people', title: 'Що може роль', render: function (ctx) {
    var data = null;
    function roleCard(r) {
      return '<section class="card adm-role"><div class="adm-role__head"><h3 class="adm-role__title">' + esc(r.label) + '</h3>' +
        '<span class="hint">' + r.people + ' ' + A.plural(r.people, ['людина', 'людини', 'людей']) + '</span></div>' +
        data.rights.map(function (x) {
          var on = r.can[x.key], diff = on !== r.base[x.key];
          var ctl = r.locked ? '<span class="adm-lockic" title="Адміністратор має всі права завжди">' + P.ic('lock', 'ui-icon--sm') + '</span>'
            : A.sw(on, 'rt-set', da('role', r.id) + da('key', x.key), (on ? 'Можна' : 'Не можна') + ' · ' + r.label + ' · ' + x.label);
          return '<div class="adm-right"><div class="adm-right__main"><b>' + esc(x.label) + '</b>' +
            '<span class="hint">' + esc(HINT[x.key] || '') + '</span>' +
            (diff ? '<span class="adm-right__was">' + H.badge('змінено · було: ' + (r.base[x.key] ? 'можна' : 'не можна'), 'warn') + '</span>' : '') + '</div>' + ctl + '</div>';
        }).join('') + (r.locked ? '<p class="hint">Адміністратор має всі права завжди.</p>' : '') + '</section>';
    }
    function draw() {
      ctx.el.innerHTML = '<section class="adm-col">' +
        A.head('Люди й доступи', 'Що може кожна роль · ' + A.asOf(), data.changed ? '<button class="btn btn--secondary" type="button" data-act="rt-reset">' + P.ic('refresh') + 'Повернути як було</button>' : '', 'admin.rights.what') +
        P.admPeople.subnav('rights') +
        (data.changed ? '<div class="banner banner--warn">' + P.ic('info', 'icon') + '<div class="banner__body"><p class="banner__title">Права змінено' + A.help('admin.rights.changed') + '</p>' +
          '<p class="banner__text">' + esc((data.changedBy || '—') + (data.changedAt ? ' · ' + P.fmt.dateTime(data.changedAt) : '')) + '. Позначка «змінено» — біля кожного зміненого права.</p></div></div>' : '') +
        '<div class="adm-roles">' + data.roles.map(roleCard).join('') + '</div>' +
        '<p class="hint">Зміна діє одразу: наступна дія людини перевіряється вже за новими правами.</p></section>';
    }
    function load() {
      P.srv('adminRights', {}).then(function (r) {
        if (!ctx.alive()) return;
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        data = r; draw();
      });
    }
    function labelOf(key) { return data.rights.filter(function (x) { return x.key === key; })[0].label; }
    ctx.on('rt-set', function (t) {
      var role = t.getAttribute('data-role'), key = t.getAttribute('data-key');
      var r = data.roles.filter(function (x) { return x.id === role; })[0], on = !r.can[key];
      t.disabled = true;
      P.srv('adminRightsSave', { role: role, key: key, on: on }).then(function (res) {
        if (!ctx.alive()) return;
        t.disabled = false;
        if (!res.ok) { A.failToast(res); return; }
        P.toast('ok', 'Збережено · ' + r.label, labelOf(key) + ': ' + (res.on ? 'можна' : 'не можна') + '.');
        load();
      });
    });
    ctx.on('rt-reset', function () {
      P.confirm({ title: 'Повернути права як було?', text: 'Усі ролі отримають ті права, що були до змін. Люди й локації не зміняться.', okLabel: 'Повернути' })
        .then(function (ok) {
          if (!ok) return;
          P.srv('adminRightsSave', { reset: true }).then(function (res) {
            if (!res.ok) { A.failToast(res); return; }
            P.toast('ok', 'Права повернуто як було');
            if (ctx.alive()) load();
          });
        });
    });
    load();
  } });
})(window);
