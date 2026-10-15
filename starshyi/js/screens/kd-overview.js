(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;
  var help = function (k) { return P.help ? P.help.btn(k) : ''; };

  P.sr.screen('/kd', { tab: 'kd', title: 'Коригуючі дії', period: false, render: function (ctx) {
    K.bindActions(ctx, function () { return null; });
    P.srv('srKdOverview', { locationId: ctx.loc.id }).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { ctx.el.innerHTML = K.segNav('/kd') + H.error(r); return; }
      var rv = r.review, s = r.sum, T = r.threshold, c = r.states;
      var kpi = function (n, label, key, mod) { return K.kpiH(n, label, key, n ? mod : ''); };
      var html = K.segNav('/kd', K.ruleLine(r.rules)) +
        '<section class="card kd-sum"><div class="kd-sum__text"><h2 class="h2">Розбір ' + esc(K.wd(rv.reviewDay)) + ' · тиждень ' + esc(K.range(rv.start, rv.end)) + help('kd.review') + '</h2>' +
        '<p class="kd-text">' + K.plural(s.depts, 'відділ', 'відділи', 'відділів') + ' · ' + K.plural(s.audits, 'аудит', 'аудити', 'аудитів') + ' · перевірено ' + K.num(s.checked) +
        ' шт · брак ' + K.num(s.rejected) + ' шт (' + K.pct(s.rate) + ') · відділів понад норму ' + T + '%: ' + s.over + '</p>' +
        '<p class="hint">Тиждень, що триває, — ' + esc(K.range(rv.nextStart, rv.nextEnd)) + ' · його розбір — ' + esc(K.wd(rv.readyOn)) + ' зранку.</p></div>' +
        '<div class="kpis kd-sum__kpis">' + kpi(c.over, 'понад норму, не почато', 'kd.state.over', 'danger') + kpi(c.watch, 'тиждень результату', 'kd.state.watch', 'info') +
        kpi(c.hold, 'під наглядом', 'kd.state.hold', 'ok') + kpi(c.done, 'закрито: тримається · за 30 днів', 'kd.state.done', 'ok') +
        kpi(c.relapse, 'рецидив · за 30 днів', 'kd.state.relapse', 'danger') + kpi(c.skip, 'дія не потрібна · за 30 днів', 'kd.state.skip') + '</div></section>';
      if (!r.depts.length) { ctx.el.innerHTML = html + H.empty('Відділів у цій локації немає', 'Відділи додаються в розділі «Керування».'); return; }
      var max = T * 1.3;
      r.depts.forEach(function (d) { d.series.forEach(function (x) { if (x.rate > max) max = x.rate; }); });
      max = Math.ceil(max);
      html += '<div class="kd-boxes-head"><h3 class="card-title">Відділи' + help('kd.overview.depts') + '</h3>' +
        K.cap('На кожному боксі — графік «брак відділу, % від перевірених» за 7 останніх завершених тижнів (' + esc(K.spanOf(r.depts[0].series)) + '); дати — під стовпчиками; шкала спільна: 0–' + max + '%. Наведіть на стовпчик — числа тижня.') +
        K.chartKeys('dept', T) + '</div>' +
        '<div class="kd-boxes">' + r.depts.map(function (d, i) { return box(d, i, r); }).join('') + '</div>' +
        '<a class="btn btn--secondary" href="#/kd/list" style="align-self:flex-start">' + P.ic('list') + 'Усі КД списком · ' + r.actionsTotal + '</a>';
      ctx.el.innerHTML = html;
      r.depts.forEach(function (d, i) {
        var el = ctx.el.querySelector('[data-kd-mini="' + i + '"]');
        P.srChart.mount(el, { items: K.deptItems(d.series, 'pct'), height: 96, max: max, xAll: true, line: { v: T, label: '' },
          label: 'Брак відділу «' + d.name + '», % · 7 тижнів', tip: function (it) { return K.deptTip(it.p, T); } });
      });
    });
    ctx.on('retry', function () { ctx.reload(); });
  } });

  function box(d, i, r) {
    var L = d.last, cur = d.cur, T = r.threshold, kd = d.kd, hot = kd && kd.status === 'new';
    var curTxt = cur.checked ? 'Тиждень, що триває (день ' + cur.daysDone + ' з 7): перевірено ' + K.num(cur.checked) + ' шт · брак ' + K.num(cur.rejected) + ' шт (' + K.pct(cur.rate) + ')'
      : 'Тиждень, що триває: аудитів у відділі ще немає';
    var early = d.earlyLeft > 0 ? ' · до раннього тумблера ще ' + K.num(d.earlyLeft) + ' шт' : '';
    var kdHtml = kd ? '<div class="kd-box__kd"><div class="kd-box__kdh">' + K.stateBadge(kd) + K.earlyBadge(kd) + '</div>' +
      '<p class="kd-box__kdt"><b>КД · ' + esc(K.week(kd.periodStart, kd.periodEnd)) + '</b> · ' + esc(K.rates(kd)) + '</p>' +
      '<p class="hint">Пункти: ' + esc(kd.items.map(function (x) { return x.name + ' ' + K.pct(x.share); }).join(' · ') || '—') + '</p>' +
      '<div class="kd-btns">' + (kd.status === 'new' ? '<button class="btn btn--primary btn--sm" type="button" data-act="impl"' + K.ref(kd) + '>' + P.ic('check', 'ui-icon--sm') + 'Впроваджений план</button>' : '') +
      '<button class="btn btn--quiet btn--sm" type="button" data-act="open"' + K.ref(kd) + '>Картка КД</button></div></div>'
      : '<p class="kd-box__none">КД, що тривають, у відділі немає' + help('kd.action') + '</p>';
    return '<article class="card kd-box"' + (hot ? ' style="border-color:var(--danger-line)"' : '') + '><div class="card-head kd-box__head"><h3 class="card-title">' + esc(d.name) + '</h3>' +
      H.badge(L.over ? 'понад норму ' + T + '%' : 'не вище норми ' + T + '%', L.over ? 'danger' : '') + '</div>' +
      '<div class="kd-big kd-big--box">' + K.big(K.plural(L.audits, 'аудит', 'аудити', 'аудитів'), 'за ' + K.rangeShort(L.start, L.end)) +
      K.big(K.num(L.rejected) + ' шт', 'брак, шт · з ' + K.num(L.checked)) + K.big(K.pct(L.rate), 'брак, % · ' + K.rangeShort(L.start, L.end), '', L.over) + '</div>' +
      '<p class="hint kd-box__cur">' + esc(curTxt + early) + '</p>' + kdHtml +
      '<div class="kd-box__chart" data-kd-mini="' + i + '"></div>' +
      '<p class="kd-box__lbl">КД відділу' + help('kd.states') + '</p>' + K.stateTiles(d.states, { compact: true, note: { done: 'за 30 днів', relapse: 'за 30 днів', skip: 'за 30 днів' } }) +
      '<a class="btn ' + (hot ? 'btn--primary' : 'btn--secondary') + ' btn--sm" href="#/kd/dept/' + encodeURIComponent(d.id) + '" style="align-self:flex-start;margin-top:auto">Відкрити ' + esc(d.name) + '</a></article>';
  }
})(window);
