(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;

  function blk(title, cap, body) { return '<div class="kd-blk"><h4 class="kd-blk__t">' + title + '</h4>' + (cap ? K.cap(cap) : '') + body + '</div>'; }
  function of(pieces, checked) { return K.num(pieces) + ' шт з ' + K.num(checked) + ' перевірених'; }

  K.typePanel = function (r, o) {
    var p = r.period, t = r.type, per = esc(K.rangeShort(p.start, p.end));
    var top = r.days.slice().sort(function (a, b) { return b.pieces - a.pieces; })[0];
    var prevNote = ['попередній тиждень ' + K.rangeShort(r.prev.start, r.prev.end) + ' → цей', K.delta(r.prev.rate, r.rate), 'тоді ' + of(r.prev.pieces, r.prev.checked)].filter(Boolean).join(' · ');
    var head = '<p class="kd-formula"><b>' + K.pct(r.rate) + '</b><span>= ' + K.num(r.pieces) + ' шт цього виду браку ÷ ' + K.num(r.checked) + ' перевірених у відділі за ' + esc(K.week(p.start, p.end)) + '</span>' +
      (r.pareto ? H.badge('у Парето ' + r.rules.pareto + '%', 'brand') : '') + '</p>' +
      (p.current ? '<p class="hint">Тиждень триває (день ' + p.daysDone + ' з ' + p.days + ') — враховано аудити, записані до цієї хвилини.</p>' : '') +
      '<div class="kd-tiles">' +
      K.tile(K.pct(r.share), 'усього браку відділу за тиждень · ' + K.num(r.pieces) + ' з ' + K.num(p.rejected) + ' шт') +
      K.tile(String(r.auditsWith), 'аудитів із цим браком · усього аудитів відділу за тиждень: ' + r.auditsTotal) +
      K.tile(top && top.pieces ? K.wd(top.day) : '—', top && top.pieces ? 'день із найбільшою кількістю · ' + top.pieces + ' шт із ' + r.pieces : 'у цьому тижні виду браку не було') +
      K.tile(K.pct(r.prev.rate) + ' → ' + K.pct(r.rate), prevNote) +
      K.tile(r.rank ? r.rank + '-й із ' + r.rankOf : '—', 'місце серед видів браку відділу за кількістю шт у тижні') + '</div>';

    var chart = blk('Вид браку по тижнях, % від перевірених',
      '«' + esc(t.name) + '» у відділі «' + esc(r.dept.name) + '», тижні ' + esc(K.spanOf(r.series)) + '. Висота — шт цього виду браку ÷ перевірено у відділі; колір — стан КД, де вид був пунктом; дати — під стовпчиками. Натисніть стовпчик — закріпити його числа.',
      '<div data-chart="kd-type"></div>' + K.chartKeys('type', r.threshold, 'рамка — обраний тиждень') + '<div data-kd-pin="type"></div>');
    var days = blk('По днях тижня ' + per, 'Частка дня = шт цього виду браку ÷ перевірено у відділі за день.',
      '<div class="tbl-box"><table class="tbl kd-days"><thead><tr><th>День</th><th class="n">Аудитів у відділі</th><th class="n">Перевірено, шт</th><th class="n">Цього виду браку, шт</th><th class="n">Частка дня</th></tr></thead><tbody>' +
      r.days.map(function (d) {
        return '<tr><td>' + esc(K.wd(d.day)) + '</td>' + (d.future ? '<td class="n" colspan="4"><span class="hint">день ще не настав</span></td>'
          : '<td class="n">' + d.audits + '</td><td class="n">' + K.num(d.checked) + '</td><td class="n"><b>' + K.num(d.pieces) + '</b></td><td class="n">' +
            (d.checked ? K.pct(Math.round(d.pieces / d.checked * 1000) / 10) : '—') + '</td>') + '</tr>';
      }).join('') + '</tbody></table></div>');
    var hist = blk('КД, де цей вид браку був пунктом', 'КД відділу «' + esc(r.dept.name) + '» за весь час' + (r.history.length ? ': ' + r.history.length + '.' : '.'),
      r.history.length ? r.history.map(function (a) { return K.histEntry(a, t.id); }).join('') : '<p class="kd-text">Пунктом КД цей вид браку у відділі ще не був.</p>');

    var none = 'У цьому тижні виду браку не було';
    var right = blk('У кого трапляється', 'Працівники, яких записано винними за тиждень ' + per + ': шт цього виду браку й частка від ' + K.num(r.pieces) + ' шт. Натисніть імʼя — картка працівника.',
        K.who(K.workerRows(r.workers), { act: 'kd-worker', empty: none })) +
      blk('Хто записує', 'Аудитори, які записали цей вид браку за тиждень ' + per + ': шт і частка від ' + K.num(r.pieces) + ' шт.', K.who(K.auditorRows(r.auditors), { empty: none })) +
      blk('На яких виробах', 'Шт цього виду браку за тиждень і частка.', K.who(r.products, { all: 'Показати всі', empty: none })) +
      blk('У яких замовленнях', 'Шт цього виду браку за тиждень і частка.', K.who(r.orders, { all: 'Показати всі', empty: none }));

    var cur = r.history.filter(function (a) { return a.status === 'new' || a.status === 'check' || a.status === 'hold'; })[0];
    var decide = r.canWrite && cur ? K.decisionBtns(cur) + '<button class="btn btn--quiet btn--sm" type="button" data-act="open"' + K.ref(cur) + '>Картка КД</button>' : '';
    var d2 = p.end > o.today ? o.today : p.end;
    var links = '<a class="btn btn--secondary btn--sm" href="#/history?defect=' + encodeURIComponent(t.name) + '&dep=' + encodeURIComponent(r.dept.id) + '&d1=' + p.start + '&d2=' + d2 + '">' +
      P.ic('audit', 'ui-icon--sm') + 'Аудити з цим браком</a>' +
      '<a class="btn btn--quiet btn--sm" href="#/analytics/defect/' + encodeURIComponent(t.id) + '">' + P.ic('chart', 'ui-icon--sm') + 'Про вид браку загалом</a>';
    return '<div class="kd-p">' + head + '<div class="kd-p__cols"><div class="kd-p__col kd-p__col--wide">' + chart + days + hist + '</div><div class="kd-p__col">' + right + '</div></div>' +
      '<div class="kd-p__foot"><div class="kd-btns">' + decide + '</div><div class="kd-btns kd-p__links">' + links + '</div></div></div>';
  };

  K.typePanelMount = function (el, r) {
    var pin = el.querySelector('[data-kd-pin="type"]');
    return K.typeChart(el.querySelector('[data-chart="kd-type"]'), r.series, { name: r.type.name, sel: r.period.n, height: 200,
      label: 'Вид браку «' + r.type.name + '» по тижнях, %',
      onPin: function (it) { pin.innerHTML = it ? K.pinRow(it.p, r.period.n, of(it.p.pieces, it.p.checked) + ' · ' + K.pct(it.p.rate) + ' · ' + K.pct(it.p.share) + ' браку відділу') : ''; } });
  };
})(window);
