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
  function lead(text) { return '<p class="mgr-rep__lead">' + esc(text) + '</p>'; }

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
      ['Брак, шт', num(l.rejected)], ['Брак, %', rate(l.pct, crit)], ['Брак за рівнями, шт']].concat(LV.map(function (k) {
      return [LV_WORD[k], num(lv[k]), 1];
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
      '<th rowspan="2" class="n">Брак, шт</th><th rowspan="2" class="n">Брак, %</th><th colspan="3" class="mgr-rep__gh">Брак за рівнями, шт</th>' +
      '<th colspan="2" class="mgr-rep__gh">Коригуючі дії за місяць</th></tr>' +
      '<tr><th class="n">неправильно зроблене</th><th class="n">пошкоджене</th><th class="n">зламане</th><th class="n">відкрито</th><th class="n">впроваджено</th></tr>';
    var rows = list.length ? list.map(function (d, i) { return row(i + 1, d.name + (d.active ? '' : ' (вимкнено)'), d, d.kd); }).join('') +
      row('', 'Усього по локації', l, kdAll, 'mgr-rep__total') : '';
    return '<section class="mgr-rep__s">' + head(2, 'Якість відділів') + lead('Брак рахується відділу, який його зробив, — навіть якщо його знайшли в іншому відділі.') +
      table(h, rows, 11) + '</section>';
  }
  function tops(l) {
    var list = l.depts || [];
    var h = '<tr>' + th('№', 1) + th('Вид браку') + th('Рівень браку') + th('Брак, шт', 1) + th('Частка від усього браку відділу, %', 1) + '</tr>';
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
    return '<div class="mgr-rep__keep">' + head('4.1', 'Підсумок за місяць', true) +
      lead('Усі числа — кількість коригуючих дій. Перший і другий тиждень після впровадження — для дій, впроваджених у цьому місяці; самі ці тижні можуть припасти на наступний місяць.') +
      kv([['Відкрито коригуючих дій', num(p.opened)], ['з них достроково, посеред тижня', num(p.earlyOpened), 1],
      ['Впроваджено коригуючих дій', num(p.implemented)], ['Днів від відкриття до впровадження, у середньому', p.implementedDaysAvg == null ? '—' : d1(p.implementedDaysAvg)],
      ['Ще не впроваджено', num(p.notImplemented)],
      ['Перший тиждень після впровадження: брак, % відділу'], ['не вище норми', num(r.belowAfter1), 1],
      ['понад норму (рецидив або «її види браку нижче, ніж до дії»)', num(r.notBelowAfter1), 1], ['тиждень ще йде', num(r.pending), 1],
      ['Другий тиждень після впровадження: брак, % відділу'], ['знову не вище норми — закрито: тримається', num(hd.done), 1],
      ['понад норму, але види браку дії разом нижче, ніж до дії — закрито: її види браку нижче, ніж до дії', num(hd.part), 1], ['понад норму (рецидив)', num(hd.relapse), 1],
      ['тиждень ще йде (під наглядом)', num(hd.pending), 1]]) + '</div>';
  }
  function kdWeeks(kd) {
    var t = kd && kd.threshold, wd = kd && kd.cycle && kd.cycle.reviewWeekdayName;
    var h = '<tr>' + th('Тиждень') + th('Перевірено, шт', 1) + th('Брак, % локації', 1) + th('Відкрито дій', 1) + th('Впроваджено дій', 1) +
      th('Перший тиждень після впровадження не вище норми, дій', 1) + th('Рецидивів', 1) + '</tr>';
    var rows = ((kd && kd.weeks) || []).map(function (w) {
      return '<tr>' + td(K().span(w.start, w.end) + ' ' + w.start.slice(0, 4) + (w.current ? ' (ще триває)' : '')) + td(num(w.checked), 1) + td(rate(w.rate, t), 1, true) +
        td(num(w.opened), 1) + td(num(w.implemented), 1) + td(num(w.belowAfter), 1) + td(num(w.relapse), 1) + '</tr>';
    }).join('');
    return head('4.2', 'Тижні місяця: брак, % локації і коригуючі дії', true) +
      lead('Тиждень — 7 днів, які додаток підсумовує в день розбору' + (wd ? ' (' + wd + ')' : '') + '. Колонки дій — скільки коригуючих дій того тижня.') + table(h, rows, 7);
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
    return head('4.3', 'Що сталося з браком після коригуючих дій', true) +
      lead('Рядок — вид браку, з яким працювала коригуюча дія: частка цього браку від перевірених у відділі штук до дії і в перший повний тиждень після впровадження.') +
      table(h, list.map(function (x) {
      return '<tr>' + td(x.dept) + td(x.name) + td(d1(x.before), 1) + td(d1(x.after), 1) + td(diff(x.before, x.after), 1) + '</tr>';
    }).join(''), 5);
  }
  function kdCauses(kd) {
    var list = ((kd && kd.causes) || []).filter(function (c) { return c.n; }).sort(function (a, b) { return b.n - a.n; });
    var sum = list.reduce(function (s, c) { return s + c.n; }, 0);
    var h = '<tr>' + th('Причина браку') + th('Записано разів', 1) + th('Частка від усіх записаних причин, %', 1) + '</tr>';
    return '<div class="mgr-rep__keep">' + head('4.4', 'Причини браку (з планів коригуючих дій)', true) +
      lead('Причину браку записує старший аудитор, коли впроваджує коригуючу дію; в одній дії їх може бути кілька.') + table(h, list.map(function (c) {
      return '<tr>' + td(K().causeName(c.id, c.label)) + td(num(c.n), 1) + td(d1(c.n / sum * 100), 1) + '</tr>';
    }).join(''), 3, true) + '</div>';
  }
  function causeName(kd, c) { var x = (kd.causes || []).filter(function (o) { return o.id === c; })[0]; return x ? K().causeName(x.id, x.label) : K().causeName(c, c); }
  function skipped(a) { return a.state === 'skip' || a.state === 'not_needed'; }
  function noImpl(a) {
    if (skipped(a)) return 'дія не потрібна';
    if (a.state === 'pre') return 'відкрито достроково, тиждень ще йде';
    if (a.state === 'decide') return 'потрібне рішення старшого: тиждень у нормі';
    return 'ще не впроваджено';
  }
  function kdActions(kd) {
    var list = ((kd && kd.actions) || []).slice().sort(function (a, b) { return String(a.openedAt) < String(b.openedAt) ? -1 : String(a.openedAt) > String(b.openedAt) ? 1 : 0; });
    var h = '<tr>' + th('№', 1) + th('Відділ') + th('Відкрито') + th('Як відкрито') + th('Впроваджено') + th('Днів від відкриття до впровадження', 1) + th('Причина браку') +
      th('Брак до, %', 1) + th('Брак після, %', 1) + '</tr>';
    var early = kd && kd.early ? 'перевірено щонайменше ' + num(kd.early) + ' шт' : 'перевірено вже багато штук';
    return head('4.5', 'Перелік коригуючих дій', true) +
      lead('Зазвичай дію відкривають за підсумком тижня, у день розбору. «Достроково, посеред тижня» — у тижні вже ' + early + ', і брак, % відділу певно вищий за норму (навіть найменше можливе значення), тож дію відкрили, не чекаючи кінця тижня.') +
      table(h, list.map(function (a, i) {
      var d = a.daysToImplement != null ? a.daysToImplement : between(a.openedAt, a.implementedAt);
      return '<tr>' + td(i + 1, 1) + td(a.departmentName) + td(date(a.openedAt)) + td(a.early ? 'достроково, посеред тижня' : 'за підсумком тижня') + td(a.implementedAt ? date(a.implementedAt) : noImpl(a)) +
        td(d == null ? '—' : num(d), 1) + td(a.cause ? causeName(kd, a.cause) : 'не записано') + td(a.before == null ? '—' : d1(a.before), 1) + td(a.after == null ? '—' : d1(a.after), 1) + '</tr>';
    }).join(''), 9);
  }
  function kdSection(r) {
    var kd = r.kd, from = (kd && kd.from) || r.from, to = (kd && kd.to) || r.to;
    return '<section class="mgr-rep__s">' + head(4, 'Коригуючі дії') + kdTotals(kd) + kdWeeks(kd) + kdEffect(kd, from, to) + kdCauses(kd) + kdActions(kd) + '</section>';
  }
  function notes(r) {
    var t = r.kd && r.kd.threshold != null ? r.kd.threshold : r.criticalPct;
    return '<footer class="mgr-rep__notes"><p>Примітки</p><ol>' +
      '<li>Аудит — одна перевірка готових виробів у відділі: скільки штук перевірили і скільки з них мали брак.</li>' +
      '<li>Брак, % — яка частка перевірених штук мала брак. Брак рахується відділу, який його зробив, навіть якщо його знайшли в іншому відділі.</li>' +
      '<li>Рівні браку: неправильно зроблене — можна виправити одразу; пошкоджене — іде в ремонт; зламане — не ремонтується, виріб втрачено.</li>' +
      '<li>Норма — брак, % відділу за тиждень не вище ' + esc(t == null ? '—' : lim(t)) + '. Якщо брак, % відділу за тиждень вищий, для відділу відкривається коригуюча дія.</li>' +
      '<li>Впроваджено — старший аудитор записав причину браку, що зроблено, хто відповідає, і дату. Від цієї дати рахуються тижні після впровадження.</li>' +
      '<li>«До» — брак, % відділу за тиждень, через який відкрили дію. «Після» — брак, % відділу за перший повний тиждень після впровадження.</li>' +
      '<li>Різниця — «після» мінус «до», у відсоткових пунктах: −2,0 означає, що з кожних 100 перевірених штук браку стало менше на 2.</li>' +
      '<li>Рецидив — у першому або другому тижні після впровадження брак, % відділу понад норму, і види браку, з якими працювала дія, разом мають брак, % не нижчий, ніж до дії. Закрито: тримається — обидва ці тижні брак, % відділу не вище норми. ' +
        'Закрито: її види браку нижче, ніж до дії — два тижні без рецидиву, але відділ хоч раз понад норму через інші види браку.</li>' +
      '<li>Прочерк (—) — числа немає: не було перевірок, дію ще не впроваджено, дія не потрібна або тиждень ще не закінчився.</li>' +
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
