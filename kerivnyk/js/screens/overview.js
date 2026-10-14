(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, K = P.mgr;
  var AUD = ['аудит', 'аудити', 'аудитів'];

  function tile(id, name, o, prev, on, days) {
    return '<button class="mgr-tile' + (on ? ' mgr-tile--on' : '') + '" type="button" data-act="mgr-loc" data-id="' + esc(id) + '" aria-pressed="' + on + '">' +
      '<span class="mgr-tile__head"><b class="mgr-tile__name">' + P.ic(id ? 'location' : 'chart', 'ui-icon--sm') + esc(name) + '</b>' +
      (on ? '<span class="mgr-tile__on">' + P.ic('check', 'ui-icon--sm') + 'обрано</span>' : '') + '</span>' +
      '<span class="mgr-tile__hero"><b class="mgr-tile__pct">' + H.pct(o.pct) + '</b><span class="mgr-dim">брак, % за ' + K.dn(days) + '</span></span>' +
      '<span class="mgr-tile__sub">' + (o.audits ? H.num(o.rejected) + ' з ' + H.num(o.checked) + ' шт · ' + K.n(o.audits, AUD[0], AUD[1], AUD[2]) : 'аудитів за період не було') + '</span>' +
      H.stack(o.levels, 6) +
      '<span class="mgr-tile__was">попередні ' + K.dn(days) + ': ' + K.was(H.pct(prev.pct), H.pct(o.pct)) + '</span></button>';
  }

  function tiles(r, sel) {
    var n = r.totals.days;
    return '<section class="mgr-tiles" aria-label="Локація">' +
      tile('', 'Усі локації', sumLocs(r.locations), sumLocs(r.locations.map(function (l) { return l.prev; })), !sel, n) +
      r.locations.map(function (l) { return tile(l.id, l.name, l, l.prev, sel === l.id, n); }).join('') + '</section>' +
      '<p class="hint mgr-tiles__key">Плитка перемикає всю сторінку на локацію' + K.help('mgr.tiles') + ' · смужка — рівні браку' + K.help('term.levels') + ': ' +
      K.LV.map(function (k) { return H.lvl(k); }).join(' ') + ' · «було → стало»' + K.help('mgr.was') + '</p>';
  }
  function sumLocs(list) {
    var o = { audits: 0, checked: 0, rejected: 0, levels: { fix: 0, repair: 0, scrap: 0 } };
    list.forEach(function (l) {
      o.audits += l.audits; o.checked += l.checked; o.rejected += l.rejected;
      if (l.levels) K.LV.forEach(function (k) { o.levels[k] += l.levels[k]; });
    });
    o.pct = o.checked > 0 ? Math.round(o.rejected / o.checked * 1000) / 10 : null;
    return o;
  }

  function summary(r, scope) {
    var t = r.totals, p = r.prev, n = t.days;
    function cell(label, key, val, prev) {
      return '<div class="mgr-sum__i"><span class="mgr-sum__l">' + esc(label) + K.help(key) + '</span><b class="mgr-sum__v">' + val + '</b>' +
        '<span class="mgr-sum__p">попередні ' + K.dn(n) + ' — <b>' + prev + '</b></span></div>';
    }
    var lv = K.total(t.levels);
    return '<section class="card mgr-gap"><div><h2 class="h2">За період · ' + esc(scope) + '</h2><p class="h2-sub">' + esc(K.span(r.from, r.to)) + ' · ' + K.dn(n) +
      ' · ' + esc(K.asOf(r.asOf)) + ' · під кожним числом — те саме за ' + esc(K.span(p.from, p.to)) + K.help('mgr.prev') + '</p></div>' +
      '<div class="mgr-sum">' + cell('Аудитів', 'term.audit', H.num(t.audits), H.num(p.audits)) +
      cell('Днів з аудитами', 'mgr.daysWithAudits', t.daysWithAudits + ' з ' + n, p.daysWithAudits + ' з ' + n) +
      cell('Перевірено, шт', 'term.checked', H.num(t.checked), H.num(p.checked)) + cell('Брак, шт', 'term.rejected', H.num(t.rejected), H.num(p.rejected)) +
      cell('Брак, %', 'term.rate', K.rate(t.pct, r.criticalPct), H.pct(p.pct)) + '</div>' +
      '<div class="mgr-gap mgr-gap--sm"><p class="group-label" style="padding:0">Рівні браку · ' + H.num(lv) + ' шт' + K.help('term.levels') + '</p>' +
      (lv ? K.levels(t.levels, 14) : '<p class="hint">Браку за період не знайдено.</p>') + '</div></section>';
  }

  function daysCard(r, scope) {
    var head = '<div><h2 class="card-title">Брак за днями, % від перевіреного' + K.help('mgr.daysChart') + '</h2><p class="hint">' + esc(scope) + ' · ' + esc(K.span(r.from, r.to)) +
      ' · колір — рівень браку · наведіть на день — його числа · протягніть — кілька днів</p></div>';
    if (!r.totals.audits) return head + H.empty('Аудитів за період не було', scope + ' · ' + K.span(r.from, r.to));
    return head + '<div class="legend">' + K.LV.map(function (k) { return H.lvl(k); }).join('') +
      '<span class="mgr-key"><i class="mgr-key__dash"></i>критичний рівень — ' + r.criticalPct + '%' + K.help('term.critical') + '</span>' +
      '<span class="mgr-key"><i class="mgr-key__none"></i>аудитів не було</span></div><div data-chart="days"></div>';
  }
  function mountChart(el, r, scope) {
    var box = el.querySelector('[data-chart="days"]');
    if (!box) return;
    P.srChart.mount(box, {
      items: r.days.map(function (d) { return { key: d.day, x: H.dayShort(d.day), v: d.pct || 0, levels: d.levels, none: !d.audits, d: d }; }),
      height: root.innerWidth < 900 ? 220 : 300, label: 'Брак за днями, % · ' + scope,
      line: { v: r.criticalPct, label: 'критичний рівень — ' + r.criticalPct + '%' },
      tip: function (it) {
        var d = it.d;
        if (!d.audits) return P.srChart.tipDay({ title: K.dcap(d.day), none: scope + ' · аудитів не було' });
        return P.srChart.tipDay({ title: K.dcap(d.day), sub: scope, audits: d.audits, checked: d.checked, rejected: d.rejected, pct: d.pct, levels: d.levels, over: d.pct > r.criticalPct });
      },
      tipRange: function (list, a, b) {
        var s = sumLocs(list.map(function (x) { return x.d; })), withA = list.filter(function (x) { return x.d.audits; }).length;
        return P.srChart.tipDay({ title: K.span(a.key, b.key), sub: K.dn(list.length) + ' · з аудитами — ' + withA, audits: s.audits, checked: s.checked, rejected: s.rejected, pct: s.pct, levels: s.levels });
      }
    });
  }

  function compareCard(r, scope) {
    var t = r.totals, p = r.prev, n = t.days;
    function row(label, prev, cur) { return '<div class="mgr-cmp__r"><span>' + label + '</span><span>' + K.was(prev, cur) + '</span></div>'; }
    return '<div><h2 class="card-title">Порівняння з попередніми ' + K.dn(n) + K.help('mgr.was') + '</h2><p class="hint">' + esc(scope) + ' · було — ' + esc(K.span(p.from, p.to)) +
      ' · стало — ' + esc(K.span(r.from, r.to)) + '</p></div><div class="mgr-cmp">' +
      row('Брак, %', H.pct(p.pct), H.pct(t.pct)) + row('Брак, шт', H.num(p.rejected), H.num(t.rejected)) +
      row('Перевірено, шт', H.num(p.checked), H.num(t.checked)) + row('Аудитів', H.num(p.audits), H.num(t.audits)) +
      row('Днів з аудитами', p.daysWithAudits + ' з ' + n, t.daysWithAudits + ' з ' + n) +
      K.LV.map(function (k) { return row(H.lvl(k) + ', шт', H.num(p.levels[k]), H.num(t.levels[k])); }).join('') + '</div>';
  }

  P.cab.tab({ id: 'overview', label: 'Огляд', ic: 'chart', path: '/overview', order: 10 });
  P.cab.screen('/overview', { tab: 'overview', title: 'Огляд', period: true, render: function (ctx) {
    var sel = (ctx.query && ctx.query.loc) || '';
    P.srv('mgrOverview', { from: ctx.period.from, to: ctx.period.to, locationId: sel }).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) {
        ctx.el.innerHTML = r.code === 'not_found' ? H.empty('Такої локації немає', 'Адреса веде на локацію, якої немає в списку.') +
          '<p style="text-align:center"><a class="btn btn--secondary btn--sm" href="#/overview">Показати всі локації</a></p>' : H.error(r);
        return;
      }
      var scope = r.location ? r.location.name : 'Усі локації';
      ctx.el.innerHTML = '<div class="mgr-page">' + tiles(r, sel) + summary(r, scope) +
        '<div class="row"><section class="card col--wide mgr-gap">' + daysCard(r, scope) + '</section>' +
        '<section class="card col mgr-gap">' + compareCard(r, scope) + '</section></div></div>';
      mountChart(ctx.el, r, scope);
    });
    ctx.on('mgr-loc', function (t) { var id = t.getAttribute('data-id'); if (id !== sel) ctx.go('/overview', id ? { loc: id } : null); });
  } });
})(window);
