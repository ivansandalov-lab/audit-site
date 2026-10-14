(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;
  var help = function (k) { return P.help ? P.help.btn(k) : ''; };

  K.STAGES = [
    { id: 'fresh', label: 'Нові', state: 'over', help: 'kd.stage.fresh' },
    { id: 'stale', label: 'Старі й закинуті', state: null, help: 'kd.stage.stale' },
    { id: 'work', label: 'В роботі', state: 'work', help: 'kd.state.work' },
    { id: 'watch', label: 'На спостереженні', state: 'watch', help: 'kd.state.watch' },
    { id: 'relapse', label: 'Рецидиви', state: 'relapse', help: 'kd.state.relapse' },
    { id: 'closed', label: 'Закриті', state: 'done', help: 'kd.stage.closed' }
  ];
  K.stageMark = function (s) { return s.state ? H.kdMark(s.state, s.label) : '<span class="kd-clock">' + P.ic('clock', 'ui-icon--sm') + '</span>'; };
  K.stageTiles = function (c, o) {
    o = o || {};
    return '<div class="kd-stg' + (o.compact ? ' kd-stg--compact' : '') + '">' + K.STAGES.map(function (s) {
      var n = c[s.id] || 0, note = o.note && o.note[s.id];
      return '<div class="kd-stg__i' + (n ? '' : ' kd-stg__i--zero') + '"><b>' + n + '</b><span class="kd-stg__l">' + K.stageMark(s) + esc(s.label) + (o.compact ? '' : help(s.help)) + '</span>' +
        (note ? '<span class="kd-stg__n">' + esc(note) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  };
  K.big = function (val, label, key) {
    return '<div class="kd-big__i"><b>' + esc(val) + '</b><span>' + esc(label) + (key ? help(key) : '') + '</span></div>';
  };
  K.kpiH = function (val, label, key, mod) {
    return '<div class="kpi' + (mod ? ' kpi--' + mod : '') + '"><span class="kpi__val">' + esc(String(val)) + '</span><span class="kpi__label">' + esc(label) + help(key) + '</span></div>';
  };

  K.change = function (before, after) {
    if (before == null || after == null) return '';
    var rel = before ? Math.round((after - before) / before * 100) : 0;
    return K.delta(before, after) + (before && rel ? ' · ' + (rel > 0 ? '+' : '−') + Math.abs(rel) + '%' : '');
  };
  K.loadBar = function (rate, T, low) {
    var w = rate == null ? 0 : Math.min(100, Math.round(rate / T * 100)), hot = rate != null && rate > T;
    return '<span class="kd-load' + (hot ? ' kd-load--hot' : '') + '" title="' + esc((rate == null ? 'перевірок не було' : K.pct(rate)) + ' з норми ' + T + '%') + '">' +
      '<span class="kd-load__bar"><i style="width:' + w + '%"></i></span><b>' + (rate == null ? '—' : K.pct(rate)) + '</b><span class="kd-load__of">з ' + T + '%' +
      (low ? ' · перевірено менше норми' : '') + '</span></span>';
  };

  function stepDays(steps, i, today) {
    var a = steps[i].day, b = i + 1 < steps.length ? steps[i + 1].day : today;
    return Math.max(0, Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000));
  }
  function stepLabel(s) { return P.sr.KD_STATES[s.state] ? P.sr.KD_STATES[s.state].label : s.state; }
  K.routeMarks = function (steps, data, show) {
    show = show || 4;
    var last = steps.slice(-show), more = steps.length - last.length;
    var title = last.map(function (s) { return stepLabel(s) + ' з ' + H.dayShort(s.day); }).join(' → ');
    return '<button class="kd-route" type="button" data-act="kd-route"' + (data || '') + ' title="' + esc('Маршрут: ' + title + '. Клік — усі стани з датами') + '">' +
      (more > 0 ? '<span class="kd-route__more">+' + more + '</span>' : '') +
      last.map(function (s) { return H.kdMark(s.state, stepLabel(s) + ' з ' + H.dayShort(s.day)); }).join('<i class="kd-route__ln"></i>') + '</button>';
  };
  K.routeTape = function (steps, T, today) {
    if (!steps.length) return '<p class="kd-text">Даних про стани немає.</p>';
    return '<ol class="kd-tape">' + steps.map(function (s, i) {
      var d = stepDays(steps, i, today), cur = i === steps.length - 1;
      var pct = s.rate == null ? 'перевірок не було' : K.pct(s.rate) + ' · ' + K.num(s.pieces) + ' шт з ' + K.num(s.checked);
      var what = s.state === 'done' || s.state === 'relapse' ? 'розбір перевірки ' : s.state === 'ok' || s.state === 'over' ? 'розбір ' : 'розбір дії ';
      return '<li class="kd-tape__i' + (cur ? ' kd-tape__i--now' : '') + '"><span class="kd-tape__d">' + (s.asOf ? 'станом на ' : '') + '<b>' + esc(H.dayShort(s.day)) + '</b></span>' +
        '<span class="kd-tape__s">' + H.kdState(s.state) + '</span>' +
        '<span class="kd-tape__t">' + (cur ? 'досі · ' : '') + K.plural(d, 'день', 'дні', 'днів') + '</span>' +
        '<span class="kd-tape__p"><b' + (s.rate != null && s.rate > T ? ' class="kd-hot"' : '') + '>' + esc(pct) + '</b> · ' + what + esc(K.rangeShort(s.start, s.end)) + '</span>' + '</li>';
    }).reverse().join('') + '</ol>';
  };
  K.openRoute = function (o) {
    P.sr.modal({ title: 'Маршрут: ' + o.name, sub: esc(o.deptName) + ' · ' + K.plural(o.steps.length, 'стан', 'стани', 'станів') + ' · зверху — найновіший',
      head: help('kd.route'), body: K.cap('Дата — день, з якого діяв стан. % виду браку — у розборі, якого стосується стан (для «понад норму» — розбір перевищення, для дії — розбір, за який її почали, для результату — розбір перевірки). Норма — ' + o.T + '%.') +
        K.routeTape(o.steps, o.T, o.today) });
  };

  K.openTypeWindow = function (ctx, depId, typeId) {
    P.srv('srKdType', { locationId: ctx.loc.id, departmentId: depId, defectTypeId: typeId }).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { P.toast('danger', 'Не вдалося відкрити вид браку', r.error); return; }
      var T = r.threshold, p = r.period, s = r.state;
      var head = K.formula({ rate: r.rate, pieces: r.pieces, checked: r.checked, start: p.start, end: p.end, over: r.over }, T) +
        '<p class="kd-tw__now"><span>Зараз:</span>' + K.stateBadge(s, r.today) + help('kd.typeState') + '</p>';
      var route = '<div class="kd-blk"><h4 class="kd-blk__t">Маршрут станів' + help('kd.route') + '</h4>' + K.routeTape(r.route, T, r.today) + '</div>';
      var chart = '<div class="kd-blk"><h4 class="kd-blk__t">Частка виду браку по розборах, %' + help('kd.typeChart') + '</h4>' +
        K.cap('Розбори ' + esc(K.spanOf(r.series)) + '. Стовпчик — один 4-денний розбір; риска — норма ' + T + '%. Наведіть на стовпчик — числа.') +
        '<div data-chart="kd-tw"></div></div>';
      var acts = r.history.filter(function (a) { return a.id; });
      var hist = '<div class="kd-blk"><h4 class="kd-blk__t">Усі дії по виду браку · ' + acts.length + help('kd.action') + '</h4>' +
        (acts.length ? acts.map(function (a) { return K.histEntry(a, T, r.today); }).join('') : '<p class="kd-text">Дій по цьому виду браку у відділі не було.</p>') + '</div>';
      var open = r.history.filter(function (a) { return a.status === 'new' || a.status === 'started' || a.status === 'check'; })[0] ||
        r.history.filter(function (a) { return a.status === 'not_helped' && a.retryable; })[0];
      var foot = '<div class="kd-btns kd-btns--foot">' + (r.canWrite && open ? K.decisionBtns(open) : '') +
        '<a class="btn btn--quiet btn--sm" href="#/kd/dept/' + encodeURIComponent(depId) + '?t=' + encodeURIComponent(typeId) + '" data-ov-close>' + P.ic('department', 'ui-icon--sm') + 'Усе про вид браку у відділі</a></div>';
      var find = function (t) { return K.finder(r.history)(t); };
      var m = P.sr.modal({ title: r.type.name + ' · ' + r.dept.name, sub: H.lvl(r.type.level) + ' · останній повний розбір ' + esc(K.range(p.start, p.end)),
        body: head + '<div class="kd-tw">' + '<div class="kd-tw__col">' + chart + route + '</div><div class="kd-tw__col">' + hist + '</div></div>', foot: foot,
        onMount: function (el) {
          K.typeChart(el.querySelector('[data-chart="kd-tw"]'), r.series, { name: r.type.name, T: T, sel: p.n, height: 140, label: 'Частка виду браку «' + r.type.name + '» по розборах, %' });
        },
        on: {
          start: function (t) { m.close(); K.openStart(ctx, K.refOf(t)); },
          nn: function (t) { m.close(); K.openNotNeeded(ctx, K.refOf(t), find(t)); },
          edit: function (t) { m.close(); K.openStart(ctx, K.refOf(t), { edit: true }); },
          impl: function (t) { var a = find(t); m.close(); if (a) K.openImplement(ctx, a); },
          'retry-kd': function (t) { var a = find(t); m.close(); if (a) K.openStart(ctx, { departmentId: a.departmentId, defectTypeId: a.defectTypeId, period: a.resultPeriod }); },
          open: function (t) { m.close(); K.openDrawer(ctx, K.refOf(t)); }
        } });
    });
  };
})(window);
