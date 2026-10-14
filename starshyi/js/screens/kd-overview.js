(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;
  var help = function (k) { return P.help ? P.help.btn(k) : ''; };

  P.sr.screen('/kd', { tab: 'kd', title: 'Коригуючі дії', period: false, render: function (ctx) {
    P.srv('srKdOverview', { locationId: ctx.loc.id }).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { ctx.el.innerHTML = K.segNav('/kd') + H.error(r); return; }
      var t = r.totals, rv = r.review, s = r.sum, T = r.threshold;
      var rule = '<p class="hint kd-rule">Розбір — кожні 4 дні, кожен вид браку окремо' + help('kd.review') + '. Частка виду браку = шт цього виду браку ÷ перевірено у відділі за розбір. Норма — ' + T +
        '%' + help('kd.threshold') + '. У розбір іде відділ, де перевірено від ' + r.minSample + ' шт' + help('kd.minSample') + '.</p>';
      var kpi = function (n, label, key, mod) { return K.kpiH(n, label, key, n ? mod : ''); };
      var html = K.segNav('/kd', rule) +
        '<section class="card kd-sum"><div class="kd-sum__text"><h2 class="h2">Розбір ' + esc(K.range(rv.start, rv.end)) + '</h2>' +
        '<p class="kd-text">' + K.plural(s.depts, 'відділ', 'відділи', 'відділів') + ' · ' + K.plural(s.audits, 'аудит', 'аудити', 'аудитів') + ' · перевірено ' + K.num(s.checked) +
        ' шт · брак ' + K.num(s.rejected) + ' шт (' + K.pct(s.rate) + ')' + (s.lowDepts ? ' · відділів, де перевірено менше ' + r.minSample + ' шт: ' + s.lowDepts : '') + '</p>' +
        '<p class="hint">Наступний розбір — ' + esc(K.range(rv.nextStart, rv.nextEnd)) + ' · його числа зʼявляться ' + esc(K.wd(rv.readyOn)) + '.</p></div>' +
        '<div class="kpis kd-sum__kpis">' + kpi(s.over, 'видів браку понад норму ' + T + '%', 'kd.threshold', 'danger') + kpi(t['new'], 'понад норму, не почато', 'kd.state.over', 'danger') +
        kpi(t.started, 'в роботі', 'kd.state.work') + kpi(t.check, 'на спостереженні', 'kd.state.watch', 'info') +
        kpi(t.helped30, 'спостереження вдале · за 30 днів', 'kd.state.done', 'ok') + kpi(t.notHelped30, 'рецидив · за 30 днів', 'kd.state.relapse', 'danger') +
        kpi(t.notNeeded30, 'дія не потрібна · за 30 днів', 'kd.state.skip') + '</div></section>';
      if (!r.depts.length) { ctx.el.innerHTML = html + H.empty('Відділів у цій локації немає', 'Відділи додаються в розділі «Керування».'); return; }
      var max = 1;
      r.depts.forEach(function (d) { d.series.forEach(function (x) { if (x.rate > max) max = x.rate; }); });
      max = Math.ceil(max);
      html += '<div class="kd-boxes-head"><h3 class="card-title">Відділи' + help('kd.overview.depts') + '</h3>' +
        K.cap('На кожному боксі — графік «брак відділу, % від перевірених» за 7 останніх розборів (' + esc(K.spanOf(r.depts[0].series)) + '). Стовпчик — один розбір; шкала спільна для всіх відділів: 0–' + max + '%. Наведіть на стовпчик — числа розбору.') +
        K.chartKeys('dept', T, r.minSample) + '</div>' +
        '<div class="kd-boxes">' + r.depts.map(function (d, i) { return box(d, i, r); }).join('') + '</div>' +
        '<a class="btn btn--secondary" href="#/kd/list" style="align-self:flex-start">' + P.ic('list') + 'Усі дії списком · ' + r.actionsTotal + '</a>';
      ctx.el.innerHTML = html;
      r.depts.forEach(function (d, i) {
        K.deptChart(ctx.el.querySelector('[data-kd-mini="' + i + '"]'), d.series, { mini: true, height: 64, max: max, T: T, label: 'Брак відділу «' + d.name + '», % · 7 останніх розборів' });
      });
    });
  } });

  function box(d, i, r) {
    var L = d.last, T = r.threshold, hot = d.counts['new'] > 0;
    var badge = d.lowData ? H.badge('перевірено ' + K.num(d.checked) + ' шт · для розбору треба ' + d.minSample, 'warn')
      : H.badge(K.plural(L.over, 'вид браку', 'види браку', 'видів браку') + ' понад норму', L.over ? 'danger' : '');
    return '<article class="card kd-box"' + (hot ? ' style="border-color:var(--danger-line)"' : '') + '><div class="card-head kd-box__head"><h3 class="card-title">' + esc(d.name) + '</h3>' + badge + '</div>' +
      '<div class="kd-big kd-big--box">' + K.big(K.plural(L.audits, 'аудит', 'аудити', 'аудитів'), 'за ' + K.rangeShort(L.start, L.end)) +
      K.big(K.num(L.rejected) + ' шт', 'брак, шт · з ' + K.num(L.checked)) + K.big(K.pct(L.rate), 'брак, % · ' + K.rangeShort(L.start, L.end)) + '</div>' +
      '<div class="kd-box__chart" data-kd-mini="' + i + '"></div>' +
      '<p class="kd-box__lbl">Дії відділу' + help('kd.stages') + '</p>' + K.stageTiles(d.stages, { compact: true, note: { relapse: 'за 30 днів', closed: 'за 30 днів' } }) +
      '<a class="btn ' + (hot ? 'btn--primary' : 'btn--secondary') + ' btn--sm" href="#/kd/dept/' + encodeURIComponent(d.id) + '" style="align-self:flex-start;margin-top:auto">Відкрити ' + esc(d.name) + '</a></article>';
  }
})(window);
