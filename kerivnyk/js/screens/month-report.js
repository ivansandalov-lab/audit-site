(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var LV = ['fix', 'repair', 'scrap'];
  var LV_WORD = { fix: 'неправильно зроблене', repair: 'пошкоджене', scrap: 'зламане' };   // рівні браку словами (як у mgr-kit.js)
  var EMPTY = 'За місяць даних немає';
  function esc(s) { return P.esc(s); }
  function K() { return P.mgr; }

  function num(v) { return v == null ? '—' : P.fmt && P.fmt.num ? P.fmt.num(v) : String(Math.round(v)); }
  function d1(v) { return (Math.round(v * 10) / 10).toFixed(1).replace('.', ','); }
  function pc(v) { return v == null ? '—' : d1(v) + '%'; }
  function lim(v) { return String(v).replace('.', ',') + '%'; }
  function rate(v, limit) {
    if (v == null) return '—';
    if (limit == null || !(v > limit)) return pc(v);
    return '<b>' + pc(v) + '</b><span class="mgr-rep__over">↑ понад ' + lim(limit) + '</span>';
  }
  function diff(before, after) {
    if (before == null || after == null) return '—';
    var x = Math.round((after - before) * 10) / 10;
    return x < 0 ? '−' + d1(-x) : x > 0 ? '+' + d1(x) : '0,0';
  }
  function date(v) { return v ? String(v).slice(0, 10).split('-').reverse().join('.') : '—'; }
  function between(a, b) { return a && b ? Math.round((Date.parse(String(b).slice(0, 10)) - Date.parse(String(a).slice(0, 10))) / 86400000) : null; }

  function td(v, n, html) { return '<td' + (n ? ' class="n"' : '') + '>' + (html ? v : esc(v)) + '</td>'; }
  function th(label, n) { return '<th' + (n ? ' class="n"' : '') + '>' + esc(label) + '</th>'; }
  function emptyRow(cols) { return '<tr><td class="mgr-rep__empty" colspan="' + cols + '">' + EMPTY + '</td></tr>'; }
  function table(head, rows, cols, small) {
    return '<table class="mgr-rep__t' + (small ? ' mgr-rep__t--keep' : '') + '"><thead>' + head + '</thead><tbody>' + (rows || emptyRow(cols)) + '</tbody></table>';
  }
  function kv(rows) {
    return table('<tr>' + th('Показник') + th('Значення', 1) + '</tr>', rows.map(function (x) {
      if (x.length === 1) return '<tr class="mgr-rep__grp"><td colspan="2">' + esc(x[0]) + '</td></tr>';
      return '<tr><td' + (x[2] ? ' class="mgr-rep__sub"' : '') + '>' + esc(x[0]) + '</td>' + td(x[1], 1, true) + '</tr>';
    }).join(''), 2, true);
  }
  function head(no, title, sub) { return sub ? '<h3 class="mgr-rep__h3">' + no + '. ' + esc(title) + '</h3>' : '<h2 class="mgr-rep__h2">' + no + '. ' + esc(title) + '</h2>'; }

  function header(r) {
    var M = K(), l = r.location, year = r.month.slice(0, 4);
    var period = r.partial ? M.day(r.from) + ' ' + year + ' — по ' + M.day(r.to) + ', місяць ще триває'
      : +r.from.slice(8, 10) + ' — ' + M.day(r.to) + ' ' + year;
    var made = P.fmt && P.fmt.dayKey && r.asOf ? date(P.fmt.dayKey(r.asOf)) + ', ' + P.fmt.time(r.asOf) : '—';
    return '<header class="mgr-rep__head"><h1 class="mgr-rep__title">ЗВІТ ПРО ЯКІСТЬ · ' + esc(M.month(r.month)) + '</h1><dl class="mgr-rep__meta">' +
      '<dt>Локація:</dt><dd>' + esc(l.name) + '</dd><dt>Період:</dt><dd>' + esc(period) + '</dd>' +
      '<dt>Сформовано:</dt><dd>' + esc(made) + '</dd><dt>Джерело:</dt><dd>додаток «Аудит» (тестова версія — вигадані дані)</dd></dl></header>';
  }
  function totals(l, crit) {
    var lv = l.levels || {};
    return '<section class="mgr-rep__s">' + head(1, 'Підсумок локації') + kv([['Аудитів', num(l.audits)], ['Перевірено, шт', num(l.checked)],
      ['Брак, шт', num(l.rejected)], ['Брак, %', rate(l.pct, crit)]].concat(LV.map(function (k) {
      return [LV_WORD[k].charAt(0).toUpperCase() + LV_WORD[k].slice(1) + ', шт', num(lv[k])];
    }))) + '</section>';
  }
  function depts(r, crit) {
    var l = r.location, list = l.depts || [], kdAll = r.kd && r.kd.period;
    function row(no, name, o, kd, cls) {
      var lv = o.levels || {};
      return '<tr' + (cls ? ' class="' + cls + '"' : '') + '>' + td(no, 1) + td(name) + td(num(o.audits), 1) + td(num(o.checked), 1) + td(num(o.rejected), 1) +
        td(rate(o.pct, crit), 1, true) + LV.map(function (k) { return td(num(lv[k]), 1); }).join('') +
        td(kd ? num(kd.opened) : '—', 1) + td(kd ? num(kd.implemented) : '—', 1) + '</tr>';
    }
    var h = '<tr><th rowspan="2" class="n">№</th><th rowspan="2">Відділ</th><th rowspan="2" class="n">Аудитів</th><th rowspan="2" class="n">Перевірено, шт</th>' +
      '<th rowspan="2" class="n">Брак, шт</th><th rowspan="2" class="n">Брак, %</th><th rowspan="2" class="n">Неправильно зроблене, шт</th>' +
      '<th rowspan="2" class="n">Пошкоджене, шт</th><th rowspan="2" class="n">Зламане, шт</th><th colspan="2" class="mgr-rep__gh">Коригуючі дії</th></tr>' +
      '<tr><th class="n">відкрито</th><th class="n">впроваджено</th></tr>';
    var rows = list.length ? list.map(function (d, i) { return row(i + 1, d.name + (d.active ? '' : ' (вимкнено)'), d, d.kd); }).join('') +
      row('', 'Усього по локації', l, kdAll, 'mgr-rep__total') : '';
    return '<section class="mgr-rep__s">' + head(2, 'Якість відділів') + table(h, rows, 11) + '</section>';
  }
  function tops(l) {
    var list = l.depts || [];
    var h = '<tr>' + th('№', 1) + th('Вид браку') + th('Рівень') + th('Брак, шт', 1) + th('Частка браку відділу, %', 1) + '</tr>';
    return '<section class="mgr-rep__s">' + head(3, 'Найчастіші види браку кожного відділу (до 10)') +
      (!list.length ? '<p class="mgr-rep__empty">' + EMPTY + '</p>' : list.map(function (d, i) {
        var rows = (d.top || []).map(function (t, j) {
          return '<tr>' + td(j + 1, 1) + td(t.name) + td(LV_WORD[t.level] || '—') + td(num(t.pieces), 1) + td(t.share == null ? '—' : d1(t.share), 1) + '</tr>';
        }).join('');
        return '<div class="mgr-rep__keep">' + head('3.' + (i + 1), d.name + (d.active ? '' : ' (вимкнено)') + ' · брак: ' + num(d.rejected) + ' шт', true) +
          table(h, rows || '<tr><td class="mgr-rep__empty" colspan="5">Браку не знайдено</td></tr>', 5, true) + '</div>';
      }).join('')) + '</section>';
  }

  function kdTotals(kd) {
    var p = kd && kd.period;
    if (!p) return head('4.1', 'Підсумок за місяць', true) + '<p class="mgr-rep__empty">' + EMPTY + '</p>';
    var r = p.results || {}, hd = p.held || {};
    return '<div class="mgr-rep__keep">' + head('4.1', 'Підсумок за місяць', true) + kv([['Відкрито', num(p.opened)], ['з них раннім тумблером', num(p.earlyOpened), 1],
      ['Впроваджено', num(p.implemented)], ['Днів від відкриття до впровадженого плану, у середньому', p.implementedDaysAvg == null ? '—' : d1(p.implementedDaysAvg)],
      ['Без впровадженого плану', num(p.notImplemented)],
      ['Через тиждень після впровадження'], ['брак, % не вище норми', num(r.belowAfter1), 1], ['брак, % понад норму', num(r.notBelowAfter1), 1], ['тиждень ще йде', num(r.pending), 1],
      ['Через 2 тижні після впровадження'], ['тримається', num(hd.done), 1], ['рецидив', num(hd.relapse), 1], ['ще йде', num(hd.pending), 1]]) + '</div>';
  }
  function kdWeeks(kd) {
    var t = kd && kd.threshold;
    var h = '<tr>' + th('Тиждень') + th('Перевірено, шт', 1) + th('Брак, %', 1) + th('Відкрито', 1) + th('Впроваджено', 1) + th('Через тиждень не вище норми', 1) + th('Рецидивів', 1) + '</tr>';
    var rows = ((kd && kd.weeks) || []).map(function (w) {
      return '<tr>' + td(K().span(w.start, w.end) + ' ' + w.start.slice(0, 4) + (w.current ? ' (ще триває)' : '')) + td(num(w.checked), 1) + td(rate(w.rate, t), 1, true) +
        td(num(w.opened), 1) + td(num(w.implemented), 1) + td(num(w.belowAfter), 1) + td(num(w.relapse), 1) + '</tr>';
    }).join('');
    return head('4.2', 'Тижні розбору місяця', true) + table(h, rows, 7);
  }
  function kdEffect(kd, from, to) {
    var list = [];
    ((kd && kd.actions) || []).forEach(function (a) {
      var d = a.implementedAt ? String(a.implementedAt).slice(0, 10) : '';
      if (!d || d < from || d > to || a.state === 'watch' || a.state === 'check') return;
      (a.items || []).forEach(function (it) { if (it.after != null && it.before != null) list.push({ dept: a.departmentName, name: it.name, before: it.before, after: it.after }); });
    });
    list.sort(function (a, b) { return (a.after - a.before) - (b.after - b.before); });
    var h = '<tr>' + th('Відділ') + th('Вид браку') + th('До, %', 1) + th('Після, %', 1) + th('Різниця, відсоткових пунктів', 1) + '</tr>';
    return head('4.3', 'Що сталося з браком після дій', true) + table(h, list.map(function (x) {
      return '<tr>' + td(x.dept) + td(x.name) + td(d1(x.before), 1) + td(d1(x.after), 1) + td(diff(x.before, x.after), 1) + '</tr>';
    }).join(''), 5);
  }
  function kdCauses(kd) {
    var list = ((kd && kd.causes) || []).filter(function (c) { return c.n; }).sort(function (a, b) { return b.n - a.n; });
    var sum = list.reduce(function (s, c) { return s + c.n; }, 0);
    var h = '<tr>' + th('Причина') + th('Записано разів', 1) + th('Частка від усіх причин, %', 1) + '</tr>';
    return '<div class="mgr-rep__keep">' + head('4.4', 'Причини у впроваджених планах', true) + table(h, list.map(function (c) {
      return '<tr>' + td(c.label) + td(num(c.n), 1) + td(d1(c.n / sum * 100), 1) + '</tr>';
    }).join(''), 3, true) + '</div>';
  }
  function causeName(kd, c) { var x = (kd.causes || []).filter(function (o) { return o.id === c; })[0]; return x ? x.label : c; }
  function skipped(a) { return a.state === 'skip' || a.state === 'not_needed'; }
  function kdActions(kd) {
    var list = ((kd && kd.actions) || []).slice().sort(function (a, b) { return String(a.openedAt) < String(b.openedAt) ? -1 : String(a.openedAt) > String(b.openedAt) ? 1 : 0; });
    var h = '<tr>' + th('№', 1) + th('Відділ') + th('Відкрито') + th('Як відкрито') + th('Впроваджено') + th('Днів до плану', 1) + th('Причина') + th('До, %', 1) + th('Після, %', 1) + '</tr>';
    return head('4.5', 'Перелік дій', true) + table(h, list.map(function (a, i) {
      var d = a.daysToImplement != null ? a.daysToImplement : between(a.openedAt, a.implementedAt);
      return '<tr>' + td(i + 1, 1) + td(a.departmentName) + td(date(a.openedAt)) + td(a.early ? 'раннім тумблером' : 'за тиждень') + td(a.implementedAt ? date(a.implementedAt) : skipped(a) ? 'дія не потрібна' : 'плану ще немає') +
        td(d == null ? '—' : num(d), 1) + td(a.cause ? causeName(kd, a.cause) : '—') + td(a.before == null ? '—' : d1(a.before), 1) + td(a.after == null ? '—' : d1(a.after), 1) + '</tr>';
    }).join(''), 9);
  }
  function kdSection(r) {
    var kd = r.kd, from = (kd && kd.from) || r.from, to = (kd && kd.to) || r.to;
    return '<section class="mgr-rep__s">' + head(4, 'Коригуючі дії') + kdTotals(kd) + kdWeeks(kd) + kdEffect(kd, from, to) + kdCauses(kd) + kdActions(kd) + '</section>';
  }
  function notes(r) {
    var t = r.kd && r.kd.threshold != null ? r.kd.threshold : r.criticalPct;
    return '<footer class="mgr-rep__notes"><p>Примітки</p><ol>' +
      '<li>Брак рахується відділу, який його зробив.</li>' +
      '<li>Норма — брак, % відділу за тиждень не вище ' + esc(t == null ? '—' : lim(t)) + '.</li>' +
      '<li>«До» — брак, % відділу за тиждень, через який відкрили дію. «Після» — брак, % відділу за перший повний тиждень після впровадження.</li>' +
      '<li>Різниця — «після» мінус «до»: −2,0 означає, що з кожних 100 перевірених штук браку стало менше на 2.</li>' +
      '<li>Документ містить лише числа; висновки робить керівник.</li></ol></footer>';
  }

  P.mgrReport = {
    html: function (r) {
      if (!r || !r.location) return '';
      var crit = r.criticalPct;
      return '<article class="mgr-rep__doc">' + header(r) + totals(r.location, crit) + depts(r, crit) + tops(r.location) + kdSection(r) + notes(r) + '</article>';
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P.mgrReport;
})(typeof window !== 'undefined' ? window : globalThis);
