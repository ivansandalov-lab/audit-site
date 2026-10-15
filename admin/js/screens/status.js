(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm, doc = root.document;

  function build() {
    var m = doc.querySelector('meta[name="app-build"]'), v = m ? String(m.getAttribute('content') || '') : '';
    if (!/^\d{14}$/.test(v)) return v ? { raw: v, text: v } : null;
    return { raw: v, text: v.slice(6, 8) + '.' + v.slice(4, 6) + '.' + v.slice(0, 4) + ' · ' + v.slice(8, 10) + ':' + v.slice(10, 12) };
  }
  function storageSize() {
    var n = 0, chars = 0;
    try {
      for (var i = 0; i < root.localStorage.length; i++) {
        var k = root.localStorage.key(i);
        if (k && k.indexOf('audit-demo:') === 0) { n++; chars += k.length + (root.localStorage.getItem(k) || '').length; }
      }
    } catch (e) { return null; }
    return { n: n, kb: Math.round(chars * 2 / 1024) };   // рядки в памʼяті браузера — 2 байти на знак
  }

  P.cab.tab({ id: 'status', label: 'Стан', ic: 'info', path: '/status', order: 50 });
  P.cab.screen('/status', { tab: 'status', title: 'Стан', render: function (ctx) {
    P.srv('adminStatus', {}).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
      var b = build(), sz = storageSize(), c = r.counts;
      ctx.el.innerHTML = '<section class="adm-col">' + A.head('Стан', A.asOf()) +
        '<div class="kpis">' + H.kpi(H.num(c.locations), A.plural(c.locations, ['локація', 'локації', 'локацій'])) +
          H.kpi(H.num(c.people), 'з доступом до додатку') + H.kpi(H.num(c.peopleOff), 'з вимкненим доступом') +
          H.kpi(H.num(c.audits), A.plural(c.audits, ['аудит', 'аудити', 'аудитів']) + ' у тестових даних') + '</div>' +
        '<div class="adm-status">' +
          '<section class="card"><h3 class="adm-card-t">' + P.ic('info', 'ui-icon--sm') + 'Сторінка й дані</h3><dl class="kv">' +
            '<dt>Версія сторінки' + A.help('admin.status.build') + '</dt><dd>' + (b ? esc(b.text) + (b.raw !== b.text ? ' <span class="adm-dim">(' + esc(b.raw) + ')</span>' : '') : '<span class="adm-dim">номера версії немає</span>') + '</dd>' +
            '<dt>Тестові дані в памʼяті браузера' + A.help('admin.status.storage') + '</dt><dd>' + (sz ? '≈ ' + H.num(sz.kb) + ' КБ · ' + sz.n + ' ' + A.plural(sz.n, ['запис', 'записи', 'записів']) : '<span class="adm-dim">браузер не дає прочитати</span>') + '</dd>' +
            '<dt>«Сьогодні» в тестових даних' + A.help('admin.status.day') + '</dt><dd>' + esc(H.dayLong(r.day)) + '</dd></dl></section>' +
          '<section class="card"><h3 class="adm-card-t">' + P.ic('notification', 'ui-icon--sm') + 'Розсилки</h3>' +
            '<p class="hint">Стан розсилки в Slack, черга й останні надсилання — у вкладці «Розсилки».</p>' +
            '<div><a class="btn btn--secondary btn--sm" href="#/mailing">' + P.ic('arrow-right', 'ui-icon--sm') + 'Відкрити «Розсилки»</a></div></section>' +
        '</div>' +
        '<section class="card"><h3 class="adm-card-t">' + P.ic('location', 'ui-icon--sm') + 'Локації · останній аудит' + A.help('admin.status.locs') + '</h3><div class="adm-locstat">' +
          r.locations.map(function (l) {
            return '<div class="adm-locstat__row' + (l.active ? '' : ' adm-person--off') + '"><b>' + esc(l.name) + '</b>' + (l.active ? '' : H.badge('вимкнена', '')) +
              '<span class="adm-locstat__v">' + (l.lastAuditAt ? esc(A.ago(l.lastAuditAt)) : '<span class="adm-dim">аудитів ще немає</span>') + '</span>' +
              '<span class="adm-locstat__v adm-dim">аудитів сьогодні: ' + H.num(l.today) + '</span></div>';
          }).join('') + '</div></section>' +
        '<section class="card"><h3 class="adm-card-t">' + P.ic('clock', 'ui-icon--sm') + 'Журнал змін · 30 днів' + A.help('admin.status.log') + '</h3>' +
          (r.log.length ? '<ol class="adm-log">' + r.log.map(function (x) {
            return '<li class="adm-log__item"><div class="adm-log__top"><b>' + esc(x.area) + ' · ' + esc(x.target) + '</b><span class="adm-dim">' + esc(P.fmt.dateTime(x.at)) + ' · ' + esc(x.byName) + '</span></div>' +
              '<p class="adm-log__what">' + esc(x.what) + ': <span class="adm-dim">' + esc(x.from) + '</span> → <b>' + esc(x.to) + '</b></p></li>';
          }).join('') + '</ol>' : H.empty('Змін не було', 'Тут зʼявиться кожна зміна у вкладках «Локації», «Люди й доступи» й «Правила».')) +
        '</section></section>';
    });
  } });
})(window);
