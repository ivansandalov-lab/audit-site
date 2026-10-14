(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, K = P.mgr;
  var st = { month: '' };   // обраний місяць ('' — сервер дає попередній завершений)

  function kd(o) { return K.kd(o); }
  function th(label, key, n) { return '<th' + (n ? ' class="n"' : '') + '>' + esc(label) + K.help(key) + '</th>'; }
  function lvNums(l) { return K.LV.map(function (k) { return '<span class="lvl lvl--' + k + '">' + H.num(l[k]) + '</span>'; }).join(''); }

  function totalsCard(r) {
    var t = r.totals;
    return '<section class="card mgr-gap"><h2 class="card-title">Усі локації</h2><div class="kpis">' +
      K.kpi(H.num(t.audits), 'аудитів', 'term.audit') + K.kpi(H.num(t.checked), 'перевірено, шт', 'term.checked') + K.kpi(H.num(t.rejected), 'брак, шт', 'mgr.deptBrak') +
      K.kpi(H.pct(t.pct), 'брак, % від перевіреного', 'term.rate') + '</div>' +
      (K.total(t.levels) ? K.levels(t.levels, 14) : '<p class="hint">Браку за місяць не знайдено.</p>') +
      '<dl class="kv mgr-kv"><dt>Найчастіші види браку' + K.help('mgr.top') + '</dt><dd><span class="mgr-top">' + K.topLine(t.top) + '</span></dd>' +
      (r.hasKd ? '<dt>Коригуючі дії' + K.help('mgr.monthKd') + '</dt><dd>' + kd(t.kd) + '</dd>' : '') +
      '</dl></section>';
  }
  function locCard(l, r) {
    var rows = l.depts;
    return '<section class="card mgr-gap"><div class="card-head" style="flex-wrap:wrap"><h2 class="card-title" style="flex:1">' + P.ic('location', 'ui-icon--sm') + ' ' + esc(l.name) + '</h2>' +
      '<span class="hint">' + K.n(l.audits, 'аудит', 'аудити', 'аудитів') + ' · перевірено ' + H.num(l.checked) + ' шт · брак, шт: ' + H.num(l.rejected) + ' · брак, %: ' + H.pct(l.pct) + '</span>' +
      (r.hasKd ? '<span class="hint mgr-kdline">коригуючі дії: ' + kd(l.kd) + '</span>' : '') + '</div>' + H.stack(l.levels, 8) +
      '<div class="tbl-box mgr-desk"><table class="tbl mgr-tbl"><thead><tr><th>Відділ</th>' + th('Аудитів', 'term.audit', 1) + th('Перевірено, шт', 'term.checked', 1) +
      th('Брак, шт', 'mgr.deptBrak', 1) + th('Брак, %', 'term.rate', 1) + th('Рівні браку, шт', 'term.levels') + th('Найчастіші види браку', 'mgr.top') +
      (r.hasKd ? th('Коригуючі дії', 'mgr.monthKd') : '') + '</tr></thead><tbody>' +
      rows.map(function (d) {
        return '<tr><td><b>' + esc(d.name) + '</b>' + (d.active ? '' : ' ' + H.badge('вимкнено')) + '</td><td class="n">' + H.num(d.audits) + '</td><td class="n">' + H.num(d.checked) + '</td>' +
          '<td class="n">' + H.num(d.rejected) + '</td><td class="n">' + H.pct(d.pct) + '</td><td><span class="mgr-lvn">' + lvNums(d.levels) + '</span></td>' +
          '<td><span class="mgr-top">' + K.topLine(d.top) + '</span></td>' + (r.hasKd ? '<td>' + kd(d.kd) + '</td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="mgr-cards mgr-phone">' + rows.map(function (d) {
        return '<article class="mgr-card"><div class="mgr-card__head"><b>' + esc(d.name) + '</b>' + (d.active ? '' : H.badge('вимкнено')) + '</div><dl class="mgr-card__kv">' +
          '<dt>Аудитів</dt><dd>' + H.num(d.audits) + '</dd><dt>Перевірено</dt><dd>' + H.num(d.checked) + ' шт</dd><dt>Брак, шт · брак, %</dt><dd>' + K.brak(d.rejected, d.pct) + '</dd>' +
          (r.hasKd ? '<dt>Коригуючі дії' + K.help('mgr.monthKd') + '</dt><dd>' + kd(d.kd) + '</dd>' : '') + '</dl><span class="mgr-lvn">' + lvNums(d.levels) + '</span>' +
          '<div class="mgr-top">' + K.topLine(d.top) + '</div></article>';
      }).join('') + '</div></section>';
  }
  function monthLabel(m, i) { return K.month(m.month) + (i === 0 ? ' (по сьогодні)' : '') + ' · ' + K.n(m.audits, 'аудит', 'аудити', 'аудитів'); }

  P.cab.tab({ id: 'month', label: 'Звіт за місяць', ic: 'table', path: '/month', order: 40 });
  P.cab.screen('/month', { tab: 'month', title: 'Звіт за місяць', render: function (ctx) {
    var req = 0, data = null;
    function load() {
      var my = ++req, box = ctx.el.querySelector('#mgr-mb');
      if (box) box.classList.add('mgr-busy');
      P.srv('mgrMonth', { month: st.month }).then(function (r) {
        if (!ctx.alive() || my !== req) return;
        if (!r.ok && r.code === 'validation' && st.month) { st.month = ''; load(); return; }   // місяць випав зі списку — беремо стандартний
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        data = r; st.month = r.month; draw();
      });
    }
    function draw() {
      var r = data, opts = r.months.map(function (m, i) { return [m.month, monthLabel(m, i)]; });
      ctx.el.innerHTML = '<section class="mgr-page"><div><h2 class="h2">Звіт за місяць · ' + esc(K.month(r.month)) + '</h2><p class="h2-sub">' +
        esc(K.span(r.from, r.to)) + (r.partial ? ' · місяць ще триває — дані по ' + esc(K.day(r.to)) : '') + ' · ' + esc(K.asOf(r.asOf)) +
        ' · брак, шт — штуки, зараховані відділу, який його зробив' + K.help('mgr.deptBrak') + '</p></div>' +
        '<div class="mgr-bar">' + K.select('mgr-m-month', opts, r.month, 'Місяць') +
        '<button class="btn btn--primary" type="button" data-act="mgr-m-csv">' + P.ic('import', 'ui-icon--sm') + 'Завантажити для Excel (CSV)</button>' +
        '<button class="btn btn--secondary" type="button" data-act="mgr-m-copy">' + P.ic('table', 'ui-icon--sm') + 'Скопіювати таблицю</button>' + K.help('mgr.export') + '</div>' +
        '<div id="mgr-mb" class="mgr-page">' + (r.totals.audits || r.totals.rejected ? totalsCard(r) + r.locations.map(function (l) { return locCard(l, r); }).join('')
          : '<section class="card">' + H.empty('За ' + K.month(r.month) + ' аудитів немає', 'Оберіть інший місяць у списку вище.') + '</section>') + '</div></section>';
    }
    ctx.on('mgr-m-month', function (t) { st.month = t.value; load(); });
    ctx.on('mgr-m-csv', function () {
      var name = 'audit-zvit-' + data.month + '.csv';
      try { K.download(name, K.csv(K.monthRows(data))); P.toast('ok', 'Файл завантажено · ' + name, 'Відкривається в Excel: роздільник «;», кома в дробах.'); }
      catch (e) { P.toast('danger', 'Не вдалося завантажити файл', String((e && e.message) || e)); }
    });
    ctx.on('mgr-m-copy', function () {
      var rows = K.monthRows(data);
      K.copy(K.tsv(rows)).then(function (ok) {
        if (ok) P.toast('ok', 'Таблицю скопійовано · ' + (rows.length - 1) + ' рядків', 'Вставте в Excel чи презентацію: Ctrl+V.');
        else P.toast('warn', 'Не вдалося скопіювати', 'Браузер не дав доступу до буфера обміну. Можна завантажити CSV.');
      });
    });
    load();
  } });
})(window);
