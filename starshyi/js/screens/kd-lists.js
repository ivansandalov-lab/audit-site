(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;

  var STATES = [['new', 'Нові'], ['started', 'В роботі'], ['check', 'Перевірка'], ['done', 'Завершені'], ['all', 'Усі']];
  P.sr.screen('/kd/list', { tab: 'kd', title: 'Коригуючі дії — список', period: false, render: function (ctx) {
    var q = ctx.query, shown = 15, data = null;
    K.bindActions(ctx, function (t) { return K.finder(data ? data.items : [])(t); });
    ctx.on('state', function (t) { ctx.go('/kd/list', { state: t.getAttribute('data-v'), dept: q.dept }); });
    ctx.on('dept', function (t) { ctx.go('/kd/list', { state: data ? data.state : q.state, dept: t.value }); });
    ctx.on('more', function () { shown += 15; draw(); });
    ctx.soft = load;
    load();

    function load() {
      P.srv('srKdList', { locationId: ctx.loc.id, state: q.state || 'all', departmentId: q.dept || '' }).then(function (r) {
        if (!ctx.alive()) return;
        if (!r.ok) { ctx.el.innerHTML = K.segNav('/kd/list') + H.error(r); return; }
        data = r; draw();
      });
    }
    function draw() {
      var r = data, T = r.threshold;
      var filters = '<div class="kd-filters"><span class="pills">' + STATES.map(function (s) {
        return '<button class="pill' + (r.state === s[0] ? ' pill--on' : '') + '" type="button" data-act="state" data-v="' + s[0] + '">' + s[1] + ' · ' + r.counts[s[0]] + '</button>'; }).join('') + '</span>' +
        '<select class="input kd-select" data-change="dept" aria-label="Відділ"><option value="">Усі відділи</option>' + r.departments.map(function (d) {
          return '<option value="' + esc(d.id) + '"' + (q.dept === d.id ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('') + '</select></div>';
      var list = r.items.slice(0, shown), body;
      if (!r.items.length) body = H.empty('Дій у цьому стані немає', q.dept ? 'Обрано один відділ — у списку лише його дії.' : '');
      else body = '<div class="tbl-box"><table class="tbl"><thead><tr><th>Вид браку · відділ</th><th class="kd-hide-sm">Розбір дії</th><th>Частка виду, %</th><th class="kd-hide-sm">Хід дії</th><th>Стан</th></tr></thead><tbody>' + list.map(function (a) {
        return '<tr data-act="open"' + K.ref(a) + '><td><b>' + esc(a.name) + '</b><span class="sub">' + esc(a.departmentName) + '<span class="kd-show-sm"> · розбір ' + esc(K.rangeShort(a.periodStart, a.periodEnd)) + '</span></span></td>' +
          '<td class="kd-hide-sm kd-nowrap">' + esc(K.rangeShort(a.periodStart, a.periodEnd)) + '</td>' +
          '<td><b class="kd-nowrap">' + esc(K.rates(a)) + '</b><span class="sub">' + K.num(a.pieces) + ' шт з ' + K.num(a.checked) + (a.after != null ? ' → ' + K.num(a.afterPieces) + ' шт з ' + K.num(a.afterChecked) : '') + '</span></td>' +
          '<td class="kd-hide-sm">' + (a.status === 'new' ? '<span class="hint">рішення немає</span>' : a.status === 'not_needed' ? '<span class="hint">«' + esc(a.notNeededReason) + '»</span>' : K.steps(a)) + '</td>' +
          '<td>' + K.stateBadge(a, r.today) + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (r.items.length > shown ? '<button class="btn btn--secondary btn--sm" type="button" data-act="more" style="align-self:flex-start">Показати ще ' + Math.min(15, r.items.length - shown) + '</button>' : '');
      ctx.el.innerHTML = K.segNav('/kd/list') + filters + '<section class="card kd-narrow">' +
        K.cap('Частка виду = шт цього виду ÷ перевірено у відділі за розбір дії; після стрілки — частка в розборі перевірки (перший повний розбір після впровадження). Поріг — ' + T +
          '%. Останній повний розбір — ' + esc(K.range(r.review.start, r.review.end)) + '. Клік по рядку — картка дії.') + body + '</section>';
    }
  } });

  P.sr.screen('/kd/stats', { tab: 'kd', title: 'Коригуючі дії — чи допомагають', period: false, render: function (ctx) {
    var days = ctx.query.days === '90' ? 90 : 30, shown = 7, data = null;
    var pills = '<span class="pills">' + [30, 90].map(function (n) { return '<button class="pill' + (n === days ? ' pill--on' : '') + '" type="button" data-act="days" data-v="' + n + '">' + n + ' дн.</button>'; }).join('') + '</span>';
    ctx.on('days', function (t) { ctx.go('/kd/stats', { days: t.getAttribute('data-v') }); });
    ctx.on('more', function () { shown = data.beforeAfter.length; draw(); });
    K.bindActions(ctx, function (t) { return K.finder(data ? data.beforeAfter : [])(t); });
    ctx.soft = load;
    load();

    function load() {
      P.srv('srKdStats', { locationId: ctx.loc.id, days: days }).then(function (r) {
        if (!ctx.alive()) return;
        if (!r.ok) { ctx.el.innerHTML = K.segNav('/kd/stats', pills) + H.error(r); return; }
        data = r; draw();
      });
    }
    function scale(label, rate, text, T) {
      return '<div class="kd-ba"><span class="kd-ba__l">' + label + '</span>' + (rate == null ? '<span class="kd-ba__no"></span>' : H.threshold(rate, rate > T)) + '<span class="kd-ba__t">' + text + '</span></div>';
    }
    function draw() {
      var r = data, k = r.kpi, T = r.threshold, span = r.byReview.length ? K.spanOf(r.byReview) : '';
      var kpi = function (n, label, mod) { return H.kpi(String(n), label, n ? mod : ''); };
      var kpis = '<div class="kpis">' + kpi(k.reviews, 'розборів по 4 дні' + (span ? ' · ' + span : '')) + kpi(k.over, 'перевищень: вид браку у відділі понад ' + T + '% за розбір') + kpi(k.started, 'дій почато') +
        kpi(k.helped, 'допомогли', 'ok') + kpi(k.notHelped, 'не допомогли') + kpi(k.running, 'тривають: в роботі або на перевірці') +
        kpi(k.notNeeded, '«не потрібно»') + kpi(k.waiting, 'нові · рішення немає', 'danger') + '</div>';
      var chart = '<section class="card"><div><h2 class="card-title">Перевищення по розборах</h2>' +
        K.cap('Стовпчик — один 4-денний розбір (' + esc(span) + '); висота — скільки видів браку у відділах локації було понад ' + T + '% у цьому розборі, шт. Наведіть на стовпчик — які саме види й у яких відділах.') +
        '</div><div data-chart="kd-over"></div></section>';
      var list = r.beforeAfter.slice(0, shown);
      var table = list.length ? '<div class="tbl-box"><table class="tbl"><thead><tr><th>Вид браку · відділ</th><th style="width:62%">Частка виду: до → після</th><th>Стан</th></tr></thead><tbody>' + list.map(function (a) {
        var before = '<b>' + K.pct(a.rate) + '</b> · розбір ' + esc(K.rangeShort(a.periodStart, a.periodEnd)) + ' · ' + K.num(a.pieces) + ' шт з ' + K.num(a.checked);
        var after = a.after != null ? scale('після', a.after, '<b>' + K.pct(a.after) + '</b> · розбір ' + esc(K.rangeShort(a.afterStart, a.afterEnd)) + ' · ' + K.num(a.afterPieces) + ' шт з ' + K.num(a.afterChecked), T)
          : a.status === 'check' ? scale('після', a.interim ? a.interim.rate : null, 'перевірка — розбір ' + esc(K.rangeShort(a.checkStart, a.checkEnd)) + (a.interim ? ' · поки <b>' + K.pct(a.interim.rate) + '</b> · ' + K.num(a.interim.pieces) + ' шт з ' + K.num(a.interim.checked) : ''), T)
            : scale('після', null, 'ще не впроваджено · термін ' + H.dayShort(a.due), T);
        return '<tr data-act="open"' + K.ref(a) + '><td><b>' + esc(a.name) + '</b><span class="sub">' + esc(a.departmentName) + '</span></td>' +
          '<td>' + scale('до', a.rate, before, T) + after + '</td><td>' + K.stateBadge(a, K.todayKey()) + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (r.beforeAfter.length > shown ? '<button class="btn btn--secondary btn--sm" type="button" data-act="more" style="align-self:flex-start">Показати ще ' + K.plural(r.beforeAfter.length - shown, 'дію', 'дії', 'дій') + '</button>' : '')
        : H.empty('Дій за цей час не починали', '');
      var hb = function (label, n, max) { return '<div class="hbar kd-hbar"><span>' + label + '</span><div class="hbar__track"><i style="width:' + Math.round(n / max * 100) + '%"></i></div><span class="hbar__n">' + n + '</span></div>'; };
      var cmax = r.causes.length ? r.causes[0].n : 1, dmax = r.depts.length ? r.depts[0].n : 1;
      var causes = '<section class="card"><div><h2 class="card-title">Причини дій</h2>' + K.cap(K.plural(k.started, 'дія', 'дії', 'дій') + ' за ' + days + ' днів; для кожної враховано головну причину. Число — кількість дій.') + '</div>' +
        (r.causes.length ? '<div>' + r.causes.map(function (c) { return hb(esc(c.label), c.n, cmax); }).join('') + '</div>' : '<p class="hint">Дій за цей час не починали.</p>') + '</section>';
      var depts = '<section class="card"><div><h2 class="card-title">Перевищення по відділах</h2>' + K.cap('Скільки разів вид браку у відділі був понад ' + T + '% за розбір · ' + days + ' днів · разом ' + k.over + '.') + '</div>' +
        (r.depts.length ? '<div>' + r.depts.map(function (d) {
          return hb('<b>' + esc(d.name) + '</b>' + (d.notHelped ? '<span class="sub">дій зі станом «не допомогла»: ' + d.notHelped + '</span>' : ''), d.n, dmax); }).join('') + '</div>'
          : '<p class="hint">Перевищень за цей час не було.</p>') + '</section>';
      ctx.el.innerHTML = K.segNav('/kd/stats', pills) + kpis + chart + '<div class="row"><section class="card col--wide"><div><h2 class="card-title">Брак до і після дії</h2>' +
        K.cap('Частка виду у відділі, % від перевірених. «До» — розбір, за який почали дію; «після» — перший повний розбір після впровадження. Шкала смуг 0–10%, риска — поріг ' + T +
          '%. Стан «допомогла» — частка після не більша за ' + T + '%; «не допомогла» — більша. Клік по рядку — картка дії.') + '</div>' + table + '</section>' +
        '<div class="col kd-stack">' + causes + depts + '</div></div>';
      P.srChart.mount(ctx.el.querySelector('[data-chart="kd-over"]'), {
        items: r.byReview.map(function (x) { return { key: x.n, x: K.rangeShort(x.start, x.end), v: x.over, p: x }; }),
        height: 160, label: 'Скільки видів браку було понад ' + T + '% у кожному розборі',
        tip: function (it) {
          var x = it.p, more = x.items.length - 6;
          return P.srChart.tip({ title: 'Розбір ' + K.range(x.start, x.end),
            rows: [['Видів понад ' + T + '%', String(x.over), x.over ? 'danger' : ''], ['Дій почато за цей розбір', String(x.started)]]
              .concat(x.items.slice(0, 6).map(function (i) { return [i.departmentName + ' · ' + i.name, K.pct(i.rate)]; })),
            foot: more > 0 ? 'і ще ' + more : '' });
        } });
    }
  } });
})(window);
