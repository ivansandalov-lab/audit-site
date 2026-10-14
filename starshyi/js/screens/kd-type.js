(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;

  function blk(title, cap, body) { return '<div class="kd-blk"><h4 class="kd-blk__t">' + title + '</h4>' + (cap ? K.cap(cap) : '') + body + '</div>'; }
  function of(pieces, checked) { return K.num(pieces) + ' шт з ' + K.num(checked) + ' перевірених'; }

  function histEntry(a, T, today) {
    var dl = '<dt>Частка в розборі</dt><dd>' + K.pct(a.rate) + ' · ' + of(a.pieces, a.checked) + '</dd>';
    if (a.status === 'new') dl += '<dt>Рішення</dt><dd>немає</dd>';
    else if (a.status === 'not_needed') {
      dl += '<dt>Чому не потрібно</dt><dd>«' + esc(a.notNeededReason) + '»' + (a.finishedOn ? ' · записано ' + H.dayShort(a.finishedOn) : '') + '</dd>' +
        (a.plan ? '<dt>План до цього</dt><dd>' + esc(a.plan) + '</dd>' : '');
    } else {
      dl += '<dt>' + (a.causes.length > 1 ? 'Причини' : 'Причина') + '</dt><dd>' + esc(K.causeText(a)) + (a.causeNote ? ' — ' + esc(a.causeNote) : '') + '</dd>' +
        '<dt>Що робили</dt><dd>' + esc(a.plan) + '</dd>' + (a.whoName ? '<dt>Хто</dt><dd>' + esc(a.whoName) + '</dd>' : '') +
        '<dt>Почато</dt><dd>' + H.dayShort(a.startedAt) + '</dd>' +
        '<dt>Впроваджено</dt><dd>' + (a.implementedAt ? H.dayShort(a.implementedAt) + (a.due ? ' · термін був ' + H.dayShort(a.due) : '') : 'ще ні · термін ' + H.dayShort(a.due) + (a.overdue ? ' (минув)' : '')) + '</dd>';
      if (a.after != null) dl += '<dt>До → після</dt><dd><b>' + esc(K.result(a, T)) + '</b> · ' + esc(K.change(a.rate, a.after)) + ' · після — розбір ' + esc(K.rangeShort(a.afterStart, a.afterEnd)) + ', ' + of(a.afterPieces, a.afterChecked) + '</dd>';
      else if (a.status === 'check') dl += '<dt>Перевірка</dt><dd>розбір ' + esc(K.rangeShort(a.checkStart, a.checkEnd)) +
        (a.interim ? ' · у розборі, що триває: ' + K.pct(a.interim.rate) + ' (' + of(a.interim.pieces, a.interim.checked) + ')' : '') + '</dd>';
    }
    return '<div class="kd-h"><div class="kd-h__head"><b>Розбір ' + esc(K.range(a.periodStart, a.periodEnd)) + '</b>' + K.stateBadge(a, today) +
      '<button class="link kd-h__open" type="button" data-act="open"' + K.ref(a) + '>картка дії</button></div><dl class="kd-dl">' + dl + '</dl></div>';
  }

  K.histEntry = histEntry;

  K.typePanel = function (r, o) {
    var p = r.period, T = r.threshold, t = r.type, per = esc(K.rangeShort(p.start, p.end));
    var top = r.days.slice().sort(function (a, b) { return b.pieces - a.pieces; })[0];
    var prevNote = ['попередній розбір ' + K.rangeShort(r.prev.start, r.prev.end) + ' → цей', K.delta(r.prev.rate, r.rate), 'тоді ' + of(r.prev.pieces, r.prev.checked)].filter(Boolean).join(' · ');
    var notes = (p.current ? '<p class="hint">Розбір триває (день ' + p.daysDone + ' з ' + p.days + ') — враховано аудити, записані до цієї хвилини.</p>' : '') +
      (p.low ? '<p class="hint">У відділі за розбір перевірено ' + K.num(p.checked) + ' шт — менше ' + r.minSample + '. Такий розбір для відділу не рахується: позначки «понад ' + T + '%» і стану «нова» в ньому немає.</p>' : '');
    var head = K.formula({ rate: r.rate, pieces: r.pieces, checked: r.checked, start: p.start, end: p.end, over: r.over }, T) + notes +
      (r.trend ? '<p class="kd-trend">' + esc(r.trend.text) + '</p>' : '') +
      '<div class="kd-tiles">' +
      K.tile(K.pct(r.share), 'усього браку відділу за розбір · ' + K.num(r.pieces) + ' з ' + K.num(p.rejected) + ' шт') +
      K.tile(String(r.auditsWith), 'аудитів із цим браком · усього аудитів відділу за розбір: ' + r.auditsTotal) +
      K.tile(top && top.pieces ? K.wd(top.day) : '—', top && top.pieces ? 'день із найбільшою кількістю · ' + top.pieces + ' шт із ' + r.pieces : 'у цьому розборі виду браку не було') +
      K.tile(K.pct(r.prev.rate) + ' → ' + K.pct(r.rate), prevNote) +
      K.tile(r.rank ? r.rank + '-й із ' + r.rankOf : '—', 'місце серед видів браку відділу за кількістю шт у розборі') + '</div>';

    var chart = blk('Частка виду браку по розборах, %',
      '«' + esc(t.name) + '» у відділі «' + esc(r.dept.name) + '», розбори ' + esc(K.spanOf(r.series)) + '. Стовпчик — один 4-денний розбір; висота — шт цього виду браку ÷ перевірено у відділі. Риска — поріг ' + T + '%. Наведіть на стовпчик — числа розбору; клік — зафіксувати.',
      '<div data-chart="kd-type"></div>' + K.chartKeys('type', T, r.minSample, 'рамка — обраний розбір') + '<div data-kd-pin="type"></div>');
    var days = blk('По днях розбору ' + per, 'Частка дня = шт цього виду браку ÷ перевірено у відділі за день.',
      '<div class="tbl-box"><table class="tbl kd-days"><thead><tr><th>День</th><th class="n">Аудитів у відділі</th><th class="n">Перевірено, шт</th><th class="n">Цього виду браку, шт</th><th class="n">Частка дня</th></tr></thead><tbody>' +
      r.days.map(function (d) {
        return '<tr><td>' + esc(K.wd(d.day)) + '</td>' + (d.future ? '<td class="n" colspan="4"><span class="hint">день ще не настав</span></td>'
          : '<td class="n">' + d.audits + '</td><td class="n">' + K.num(d.checked) + '</td><td class="n"><b>' + K.num(d.pieces) + '</b></td><td class="n">' +
            (d.checked ? K.pct(Math.round(d.pieces / d.checked * 1000) / 10) : '—') + '</td>') + '</tr>';
      }).join('') + '</tbody></table></div>');
    var hist = blk('Чи з цим уже працювали', 'Усі дії по цьому виду браку у відділі «' + esc(r.dept.name) + '» за весь час' + (r.history.length ? ': ' + r.history.length + '.' : '.'),
      r.history.length ? r.history.map(function (a) { return histEntry(a, T, o.today); }).join('') : '<p class="kd-text">Дій по цьому виду браку не було.</p>');

    var none = 'У цьому розборі виду браку не було';
    var right = blk('У кого трапляється', 'Працівники, яких записано винними за розбір ' + per + ': шт цього виду браку й частка від ' + K.num(r.pieces) + ' шт. Клік по імені — картка працівника.',
        K.who(K.workerRows(r.workers), { act: 'kd-worker', empty: none })) +
      blk('Хто записує', 'Аудитори, які записали цей вид браку за розбір ' + per + ': шт і частка від ' + K.num(r.pieces) + ' шт.', K.who(K.auditorRows(r.auditors), { empty: none })) +
      blk('На яких виробах', 'Шт цього виду браку за розбір і частка.', K.who(r.products, { all: 'Показати всі', empty: none })) +
      blk('У яких замовленнях', 'Шт цього виду браку за розбір і частка.', K.who(r.orders, { all: 'Показати всі', empty: none }));

    var open = function (a) { return a.status === 'new' || a.status === 'started' || a.status === 'check'; };
    var cur = r.history.filter(open)[0] || r.history.filter(function (a) { return a.status === 'not_helped' && a.retryable; })[0] ||
      (r.history[0] && r.history[0].status === 'not_needed' ? r.history[0] : null);
    var decide = !r.canWrite || !cur ? '' : r.decide ? K.decisionBtns(cur)
      : '<span class="hint">Обрано минулий розбір — тут лише перегляд.</span><button class="btn btn--secondary btn--sm" type="button" data-act="kd-last">До останнього розбору</button>';
    var d2 = p.end > o.today ? o.today : p.end;
    var links = '<a class="btn btn--secondary btn--sm" href="#/history?defect=' + encodeURIComponent(t.name) + '&dep=' + encodeURIComponent(r.dept.id) + '&d1=' + p.start + '&d2=' + d2 + '">' +
      P.ic('audit', 'ui-icon--sm') + 'Аудити з цим браком</a>' +
      '<a class="btn btn--quiet btn--sm" href="#/analytics/defect/' + encodeURIComponent(t.id) + '">' + P.ic('chart', 'ui-icon--sm') + 'Про вид браку загалом</a>';
    return '<div class="kd-p">' + head + '<div class="kd-p__cols"><div class="kd-p__col kd-p__col--wide">' + chart + days + hist + '</div><div class="kd-p__col">' + right + '</div></div>' +
      '<div class="kd-p__foot"><div class="kd-btns">' + decide + '</div><div class="kd-btns kd-p__links">' + links + '</div></div></div>';
  };

  K.typePanelMount = function (el, r) {
    var pin = el.querySelector('[data-kd-pin="type"]');
    return K.typeChart(el.querySelector('[data-chart="kd-type"]'), r.series, { name: r.type.name, T: r.threshold, sel: r.period.n, height: 200,
      label: 'Частка виду браку «' + r.type.name + '» по розборах, %',
      onPin: function (it) { pin.innerHTML = it ? K.pinRow(it.p, r.period.n, of(it.p.pieces, it.p.checked) + ' · ' + K.pct(it.p.rate)) : ''; } });
  };
})(window);
