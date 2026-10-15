(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, K = P.mgr;
  var st = { month: '', loc: '' };   // обраний місяць ('' — сервер дає попередній завершений) і локація ('' — перша)

  function th(label, key, n) { return '<th' + (n ? ' class="n"' : '') + '>' + esc(label) + (key ? K.help(key) : '') + '</th>'; }
  function lvNums(l) { return K.LV.map(function (k) { return '<span class="lvl lvl--' + k + '">' + H.num(l[k]) + '</span>'; }).join(''); }

  function totalsCard(l) {
    return '<section class="card mgr-gap mgr-avoid"><h2 class="card-title">' + P.ic('location', 'ui-icon--sm') + ' ' + esc(l.name) + ' · підсумок місяця</h2><div class="kpis">' +
      K.kpi(H.num(l.audits), 'аудитів', 'term.audit') + K.kpi(H.num(l.checked), 'перевірено, шт', 'term.checked') + K.kpi(H.num(l.rejected), 'брак, шт', 'mgr.deptBrak') +
      K.kpi(H.pct(l.pct), 'брак, % від перевіреного', 'term.rate') + '</div>' +
      (K.total(l.levels) ? K.levels(l.levels, 14) : '<p class="hint">Браку за місяць не знайдено.</p>') + '</section>';
  }
  function deptsCard(l, crit) {
    var rows = l.depts;
    return '<section class="card mgr-gap"><h2 class="card-title">Якість відділів' + K.help('mgr.deptBrak') + '</h2>' +
      '<div class="tbl-box mgr-desk"><table class="tbl mgr-tbl"><thead><tr><th>Відділ</th>' + th('Аудитів', 'term.audit', 1) + th('Перевірено, шт', 'term.checked', 1) +
      th('Брак, шт', 'mgr.deptBrak', 1) + th('Брак, %', 'term.rate', 1) + th('Рівні браку, шт', 'term.levels') + th('Коригуючі дії: відкрито · впроваджено', 'mgr.monthKd') + '</tr></thead><tbody>' +
      rows.map(function (d) {
        return '<tr><td><b>' + esc(d.name) + '</b>' + (d.active ? '' : ' ' + H.badge('вимкнено')) + '</td><td class="n">' + H.num(d.audits) + '</td><td class="n">' + H.num(d.checked) + '</td>' +
          '<td class="n">' + H.num(d.rejected) + '</td><td class="n">' + K.rate(d.pct, crit) + '</td><td><span class="mgr-lvn">' + lvNums(d.levels) + '</span></td>' +
          '<td>' + (d.kd ? H.num(d.kd.opened) + ' · ' + H.num(d.kd.implemented) : '<span class="mgr-dim">—</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="mgr-cards mgr-phone">' + rows.map(function (d) {
        return '<article class="mgr-card"><div class="mgr-card__head"><b>' + esc(d.name) + '</b>' + (d.active ? '' : H.badge('вимкнено')) + '</div><dl class="mgr-card__kv">' +
          '<dt>Аудитів</dt><dd>' + H.num(d.audits) + '</dd><dt>Перевірено</dt><dd>' + H.num(d.checked) + ' шт</dd><dt>Брак, шт · брак, %</dt><dd>' + H.num(d.rejected) + ' шт · ' + K.rate(d.pct, crit) + '</dd>' +
          (d.kd ? '<dt>Коригуючі дії: відкрито · впроваджено' + K.help('mgr.monthKd') + '</dt><dd>' + H.num(d.kd.opened) + ' · ' + H.num(d.kd.implemented) + '</dd>' : '') +
          '</dl><span class="mgr-lvn">' + lvNums(d.levels) + '</span></article>';
      }).join('') + '</div></section>';
  }
  function topCard(l) {
    return '<section class="card mgr-gap"><div><h2 class="card-title">Найчастіші види браку кожного відділу · до 10' + K.help('mgr.top10') + '</h2>' +
      '<p class="hint">Частка — від усього браку, шт цього відділу за місяць</p></div><div class="mgr-top10">' + l.depts.map(function (d) {
        return '<div class="mgr-top10__d mgr-avoid"><h3 class="mgr-top10__h">' + esc(d.name) + ' <span class="mgr-dim">· брак ' + H.num(d.rejected) + ' шт</span></h3>' +
          (!d.top.length ? '<p class="hint">Браку не знайдено.</p>' : '<ol class="mgr-top10__l">' + d.top.map(function (t) {
            return '<li><span class="lvl lvl--' + esc(t.level) + '">' + esc(t.name) + '</span><b>' + H.num(t.pieces) + ' шт · ' + H.pct(t.share) + '</b>' +
              '<span class="mgr-top10__bar"><i class="s-' + esc(t.level) + '" style="width:' + (t.share || 0) + '%"></i></span></li>';
          }).join('') + '</ol>') + '</div>';
      }).join('') + '</div></section>';
  }
  function monthLabel(m, i) { return K.month(m.month) + (i === 0 ? ' (ще триває)' : '') + ' · ' + K.n(m.audits, 'аудит', 'аудити', 'аудитів'); }

  P.cab.tab({ id: 'month', label: 'Звіт за місяць', ic: 'table', path: '/month', order: 40 });
  P.cab.screen('/month', { tab: 'month', title: 'Звіт за місяць', render: function (ctx) {
    var req = 0, data = null;
    function load() {
      var my = ++req, box = ctx.el.querySelector('#mgr-mb');
      if (box) box.classList.add('mgr-busy');
      P.srv('mgrMonth', { month: st.month, locationId: st.loc }).then(function (r) {
        if (!ctx.alive() || my !== req) return;
        if (!r.ok && r.code === 'validation' && st.month) { st.month = ''; load(); return; }   // місяць випав зі списку — беремо стандартний
        if (!r.ok && r.code === 'not_found' && st.loc) { st.loc = ''; load(); return; }        // локації вже немає — перша
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        if (!r.location) { ctx.el.innerHTML = '<section class="card">' + H.empty('Локацій ще немає', 'Коли адміністратор додасть локацію, тут зʼявляться її числа.') + '</section>'; return; }   // жодної локації
        data = r; st.month = r.month; st.loc = r.location.id; draw();
      });
    }
    function draw() {
      var r = data, l = r.location, opts = r.months.map(function (m, i) { return [m.month, monthLabel(m, i)]; });
      var scope = l.name + ' · ' + K.month(r.month);
      ctx.el.innerHTML = '<section class="mgr-page mgr-month"><div><h2 class="h2">Звіт за місяць · ' + esc(scope) + '</h2><p class="h2-sub">' +
        esc(K.span(r.from, r.to)) + (r.partial ? ' · місяць ще триває — дані по ' + esc(K.day(r.to)) : '') + ' · ' + esc(K.asOf(r.asOf)) +
        ' · кожна локація — окремий звіт</p></div>' +
        '<div class="card mgr-gap mgr-gap--sm mgr-noprint"><div class="mgr-pick"><span class="mgr-pick__l">Локація' + K.help('mgr.locSwitch') + '</span>' +
        K.seg('mgr-m-loc', r.locations.map(function (x) { return [x.id, x.name]; }), l.id, 'Локація') + '</div>' +
        '<div class="mgr-bar">' + K.select('mgr-m-month', opts, r.month, 'Місяць') +
        '<button class="btn btn--primary" type="button" data-act="mgr-m-pdf">' + P.ic('export', 'ui-icon--sm') + 'Завантажити PDF</button>' + K.help('mgr.pdf') +
        '<button class="btn btn--secondary" type="button" data-act="mgr-m-csv">' + P.ic('import', 'ui-icon--sm') + 'Файл для Excel</button>' +
        '<button class="btn btn--secondary" type="button" data-act="mgr-m-copy">' + P.ic('table', 'ui-icon--sm') + 'Скопіювати таблицю</button>' + K.help('mgr.export') + '</div>' +
        '<p class="hint">PDF: відкриється вікно друку — оберіть у ньому «Зберегти як PDF».</p></div>' +
        '<div id="mgr-mb" class="mgr-page">' + (l.audits || l.rejected ? totalsCard(l) + deptsCard(l, r.criticalPct) + topCard(l)
          : '<section class="card">' + H.empty('За ' + K.month(r.month) + ' аудитів у локації немає', 'Оберіть інший місяць чи локацію вище.') + '</section>') +
        '<div><h2 class="h2">Коригуючі дії · ' + esc(scope) + K.help('mgr.kd.action') + '</h2><p class="h2-sub">Відкриваються для відділу, коли його брак, % за тиждень понад норму' +
        (r.kd ? ' ' + H.pct(r.kd.threshold) : '') + K.help('mgr.kd.threshold') + ': за підсумком тижня або достроково, посеред тижня' + K.help('mgr.kd.early') + '</p></div>' + P.mgrKd.month(r.kd, scope + ' · ' + K.span(r.from, r.to)) + '</div>' +
        '<div class="mgr-rep" aria-hidden="true">' + P.mgrReport.html(r) + '</div></section>';
    }
    ctx.on('mgr-m-month', function (t) { st.month = t.value; load(); });
    ctx.on('mgr-m-loc', function (t) { st.loc = t.getAttribute('data-v'); load(); });
    ctx.on('mgr-m-pdf', function () {
      var doc = root.document, html = doc.documentElement, was = doc.title, theme = html.getAttribute('data-theme');
      doc.title = 'Звіт за місяць · ' + data.location.name + ' · ' + K.month(data.month);
      html.setAttribute('data-theme', 'light');
      root.addEventListener('afterprint', function back() { root.removeEventListener('afterprint', back); doc.title = was; html.setAttribute('data-theme', theme || 'light'); });
      setTimeout(function () { root.print(); }, 50);
    });
    ctx.on('mgr-m-csv', function () {
      var name = 'audit-zvit-' + data.location.id.toLowerCase() + '-' + data.month + '.csv';
      try { K.download(name, K.csv(K.monthRows(data))); P.toast('ok', 'Файл завантажено · ' + name, 'Відкрийте його в Excel — числа одразу стануть по колонках.'); }
      catch (e) { if (root.console) root.console.error(e); P.toast('danger', 'Не вдалося завантажити файл', 'Спробуйте ще раз або скопіюйте таблицю.'); }
    });
    ctx.on('mgr-m-copy', function () {
      var rows = K.monthRows(data);
      K.copy(K.tsv(rows)).then(function (ok) {
        if (ok) P.toast('ok', 'Таблицю скопійовано · ' + (rows.length - 1) + ' рядків', 'Вставте в Excel чи презентацію: Ctrl+V.');
        else P.toast('warn', 'Не вдалося скопіювати', 'Браузер не дозволив копіювання. Завантажте файл для Excel — кнопка поруч.');
      });
    });
    load();
  } });
})(window);
