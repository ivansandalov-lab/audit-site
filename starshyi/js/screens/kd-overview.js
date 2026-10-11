(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;

  P.sr.screen('/kd', { tab: 'kd', title: 'Коригуючі дії', period: false, render: function (ctx) {
    P.srv('srKdOverview', { locationId: ctx.loc.id }).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { ctx.el.innerHTML = K.segNav('/kd') + H.error(r); return; }
      var t = r.totals, rv = r.review, s = r.sum, T = r.threshold, today = K.todayKey();
      var rule = '<p class="hint kd-rule">Розбір — кожні 4 дні, кожен вид браку окремо. Частка виду = шт цього виду ÷ перевірено у відділі за розбір. Поріг — ' + T +
        '%. У розбір іде відділ, де перевірено від ' + r.minSample + ' шт.</p>';
      var kpi = function (n, label, mod) { return H.kpi(String(n), label, n ? mod : ''); };
      var html = K.segNav('/kd', rule) +
        '<section class="card kd-sum"><div class="kd-sum__text"><h2 class="h2">Розбір ' + esc(K.range(rv.start, rv.end)) + '</h2>' +
        '<p class="kd-text">' + K.plural(s.depts, 'відділ', 'відділи', 'відділів') + ' · ' + K.plural(s.audits, 'аудит', 'аудити', 'аудитів') + ' · перевірено ' + K.num(s.checked) +
        ' шт · брак ' + K.num(s.rejected) + ' шт (' + K.pct(s.rate) + ')' + (s.lowDepts ? ' · відділів, де перевірено менше ' + r.minSample + ' шт: ' + s.lowDepts : '') + '</p>' +
        '<p class="hint">Наступний розбір — ' + esc(K.range(rv.nextStart, rv.nextEnd)) + ' · його числа зʼявляться ' + esc(K.wd(rv.readyOn)) + '.</p></div>' +
        '<div class="kpis kd-sum__kpis">' + kpi(s.over, 'видів браку понад ' + T + '%', 'danger') + kpi(t['new'], 'нові · рішення немає', 'danger') + kpi(t.started, 'в роботі') +
        '<div class="kpi"><span class="kpi__val"' + (t.check ? ' style="color:var(--info)"' : '') + '>' + t.check + '</span><span class="kpi__label">на перевірці</span></div>' +
        kpi(t.helped30, 'допомогли · за 30 днів', 'ok') + kpi(t.notHelped30, 'не допомогли · за 30 днів') + kpi(t.notNeeded30, '«не потрібно» · за 30 днів') + '</div></section>';
      if (!r.depts.length) { ctx.el.innerHTML = html + H.empty('Відділів у цій локації немає', 'Відділи додаються в розділі «Керування».'); return; }
      var max = 1;
      r.depts.forEach(function (d) { d.series.forEach(function (x) { if (x.rate > max) max = x.rate; }); });
      max = Math.ceil(max);
      html += '<div class="kd-boxes-head"><h3 class="card-title">Відділи</h3>' +
        K.cap('На кожному боксі — графік «брак відділу, % від перевірених» за 7 останніх розборів (' + esc(K.spanOf(r.depts[0].series)) + '). Стовпчик — один розбір; шкала спільна для всіх відділів: 0–' + max + '%. Наведіть на стовпчик — числа розбору.') +
        K.chartKeys('dept', T, r.minSample) + '</div>' +
        '<div class="kd-boxes">' + r.depts.map(function (d, i) { return box(d, i, r, today); }).join('') + '</div>' +
        '<a class="btn btn--secondary" href="#/kd/list" style="align-self:flex-start">' + P.ic('list') + 'Усі дії списком · ' + r.actionsTotal + '</a>';
      ctx.el.innerHTML = html;
      r.depts.forEach(function (d, i) {
        K.deptChart(ctx.el.querySelector('[data-kd-mini="' + i + '"]'), d.series, { mini: true, height: 64, max: max, T: T, label: 'Брак відділу «' + d.name + '», % · 7 останніх розборів' });
      });
    });
  } });

  function box(d, i, r, today) {
    var c = d.counts, L = d.last, T = r.threshold, rows = [], hot = c['new'] > 0;
    var row = function (title, meta, badge) {
      return '<div class="row-item kd-box__row"><span class="row-item__main"><span class="row-item__title">' + title + '</span><span class="row-item__meta">' + meta + '</span></span>' + badge + '</div>';
    };
    d.news.forEach(function (a) { rows.push(row(esc(a.name) + ' · ' + K.pct(a.rate), H.lvl(a.level) + (a.trend ? ' · ' + esc(a.trend.text) : ''), K.stateBadge(a, today))); });
    d.check.concat(d.started).forEach(function (a) { rows.push(row(esc(a.name) + ' · ' + esc(K.rates(a)), esc(K.actMeta(a)), K.stateBadge(a, today))); });
    d.done.forEach(function (a) { rows.push(row(esc(a.name) + ' · ' + esc(K.result(a, T)), esc(K.actMeta(a)), K.stateBadge(a, today))); });
    d.top.forEach(function (x) { rows.push(row(esc(x.name) + ' · ' + K.pct(x.rate), H.lvl(x.level) + ' · ' + K.num(x.pieces) + ' шт з ' + K.num(x.checked) + ' · дій не було', '')); });
    var badge = d.lowData ? H.badge('перевірено ' + K.num(d.checked) + ' шт · для розбору треба ' + d.minSample, 'warn')
      : H.badge(K.plural(L.over, 'вид', 'види', 'видів') + ' понад ' + T + '%', L.over ? 'danger' : '');
    var mini = function (n, label, color) { return '<div class="kpi kd-mini__kpi"><span class="kpi__val"' + (n && color ? ' style="color:var(--' + color + ')"' : '') + '>' + n + '</span><span class="kpi__label">' + label + '</span></div>'; };
    return '<article class="card kd-box"' + (hot ? ' style="border-color:var(--danger-line)"' : '') + '><div class="card-head kd-box__head"><h3 class="card-title">' + esc(d.name) + '</h3>' + badge + '</div>' +
      '<p class="kd-box__facts"><b>' + K.pct(L.rate) + '</b><span>брак відділу за ' + esc(K.rangeShort(L.start, L.end)) + ' · ' + K.num(L.rejected) + ' шт з ' + K.num(L.checked) + ' перевірених · ' +
      K.plural(L.audits, 'аудит', 'аудити', 'аудитів') + '</span></p>' +
      '<div class="kd-box__chart" data-kd-mini="' + i + '"></div>' +
      '<div class="kd-mini">' + mini(c['new'], 'нові', 'danger') + mini(c.started, 'в роботі') + mini(c.check, 'перевірка', 'info') + mini(c.helped, 'допомогли · 30 дн.', 'ok') + '</div>' +
      (rows.length ? '<div class="list">' + rows.slice(0, 4).join('') + '</div>' + (rows.length > 4 ? '<p class="hint">і ще ' + (rows.length - 4) + ' — у відділі</p>' : '') : '') +
      '<a class="btn ' + (hot ? 'btn--primary' : 'btn--secondary') + ' btn--sm" href="#/kd/dept/' + encodeURIComponent(d.id) + '" style="align-self:flex-start;margin-top:auto">Відкрити ' + esc(d.name) + '</a></article>';
  }
})(window);
