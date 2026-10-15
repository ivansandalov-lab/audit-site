(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;
  var help = function (k) { return P.help ? P.help.btn(k) : ''; };

  K.STATES = [
    { id: 'over', label: 'Понад норму, не почато', help: 'kd.state.over' },
    { id: 'watch', label: 'Впроваджено', help: 'kd.state.watch' },
    { id: 'hold', label: 'Під наглядом', help: 'kd.state.hold' },
    { id: 'done', label: 'Закрито: тримається', help: 'kd.state.done' },
    { id: 'relapse', label: 'Рецидив', help: 'kd.state.relapse' },
    { id: 'skip', label: 'Дія не потрібна', help: 'kd.state.skip' }
  ];
  K.stateTiles = function (c, o) {
    o = o || {};
    return '<div class="kd-stg' + (o.compact ? ' kd-stg--compact' : '') + '">' + K.STATES.map(function (s) {
      var n = c[s.id] || 0, note = o.note && o.note[s.id];
      return '<div class="kd-stg__i' + (n ? '' : ' kd-stg__i--zero') + '"><b>' + n + '</b><span class="kd-stg__l">' + H.kdMark(s.id, s.label) + esc(s.label) + (o.compact ? '' : help(s.help)) + '</span>' +
        (note ? '<span class="kd-stg__n">' + esc(note) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  };
  K.big = function (val, label, key, hot) {
    return '<div class="kd-big__i"><b' + (hot ? ' class="kd-hot"' : '') + '>' + esc(val) + '</b><span>' + esc(label) + (key ? help(key) : '') + '</span></div>';
  };
  K.kpiH = function (val, label, key, mod) {
    return '<div class="kpi' + (mod ? ' kpi--' + mod : '') + '"><span class="kpi__val">' + esc(String(val)) + '</span><span class="kpi__label">' + esc(label) + help(key) + '</span></div>';
  };

  K.change = function (before, after) {
    if (before == null || after == null) return '';
    var rel = before ? Math.round((after - before) / before * 100) : 0;
    return K.delta(before, after) + (before && rel ? ' · ' + (rel > 0 ? '+' : '−') + Math.abs(rel) + '%' : '');
  };
  K.loadBar = function (rate, T) {
    var w = rate == null ? 0 : Math.min(100, Math.round(rate / T * 100)), hot = rate != null && rate > T;
    return '<span class="kd-load' + (hot ? ' kd-load--hot' : '') + '" title="' + esc((rate == null ? 'перевірок не було' : K.pct(rate)) + ' · норма ' + T + '%') + '">' +
      '<span class="kd-load__bar"><i style="width:' + w + '%"></i></span><b>' + (rate == null ? '—' : K.pct(rate)) + '</b><span class="kd-load__of">· норма ' + T + '%</span></span>';
  };

  function stepDays(steps, i, today) {
    var a = steps[i].day, b = i + 1 < steps.length ? steps[i + 1].day : today;
    return Math.max(0, Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000));
  }
  function stepLabel(s) { return s.state === 'ok' ? 'без коригуючої дії' : P.sr.KD_STATES[s.state] ? P.sr.KD_STATES[s.state].label : s.state; }
  K.routeMarks = function (steps, data, more) {
    var last = steps.slice(-4);
    more = more != null ? more : steps.length - last.length;
    var title = last.map(function (s) { return stepLabel(s) + ' з ' + H.dayShort(s.day); }).join(' → ');
    return '<button class="kd-route" type="button" data-act="kd-route"' + (data || '') + ' title="' + esc('Маршрут: ' + title + '. Натисніть — усі стани з датами') + '">' +
      (more > 0 ? '<span class="kd-route__more">+' + more + '</span>' : '') +
      last.map(function (s) { return H.kdMark(s.state, stepLabel(s) + ' з ' + H.dayShort(s.day)); }).join('<i class="kd-route__ln"></i>') + '</button>';
  };
  K.routeTape = function (steps, today) {
    if (!steps.length) return '<p class="kd-text">Даних про стани немає.</p>';
    return '<ol class="kd-tape">' + steps.map(function (s, i) {
      var d = stepDays(steps, i, today), cur = i === steps.length - 1;
      var pct = s.rate == null ? 'перевірок не було' : K.pct(s.rate) + ' · ' + K.num(s.pieces) + ' шт з ' + K.num(s.checked);
      var what = s.state === 'hold' || s.state === 'relapse' || s.state === 'done' ? 'тиждень після впровадження ' : s.state === 'ok' ? 'тиждень ' : 'тиждень КД ';
      return '<li class="kd-tape__i' + (cur ? ' kd-tape__i--now' : '') + '"><span class="kd-tape__d">' + (s.asOf ? 'станом на ' : '') + '<b>' + esc(H.dayShort(s.day)) + '</b></span>' +
        '<span class="kd-tape__s">' + H.kdState(s.state, s.state === 'ok' ? stepLabel(s) : '') + '</span>' +
        '<span class="kd-tape__t">' + (cur ? 'досі · ' : '') + K.plural(d, 'день', 'дні', 'днів') + '</span>' +
        '<span class="kd-tape__p"><b>' + esc(pct) + '</b> · ' + what + esc(K.rangeShort(s.start, s.end)) + '</span></li>';
    }).reverse().join('') + '</ol>';
  };
  K.openRoute = function (o) {
    P.sr.modal({ title: 'Маршрут: ' + o.name, sub: esc(o.deptName) + ' · ' + K.plural(o.steps.length, 'стан', 'стани', 'станів') + ' · зверху — найновіший',
      head: help('kd.route'), body: K.cap('Дата — день, з якого діяв стан. % виду браку — від перевірених у відділі: для «понад норму» й «впроваджено» — за тиждень КД, для решти станів — за тиждень після впровадження.') +
        K.routeTape(o.steps, o.today) });
  };
  K.openRouteOf = function (ctx, depId, typeId) {
    P.srv('srKdType', { locationId: ctx.loc.id, departmentId: depId, defectTypeId: typeId }).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { P.toast('danger', 'Не вдалося відкрити маршрут', r.error); return; }
      K.openRoute({ name: r.type.name, deptName: r.dept.name, steps: r.route, today: r.today });
    });
  };

  K.histEntry = function (a, typeId) {
    var it = a.items.filter(function (x) { return x.defectTypeId === typeId; })[0], dl = '';
    if (it) dl += '<dt>Цей вид браку</dt><dd>' + K.pct(it.before) + ' від перевірених · ' + K.num(it.pieces) + ' шт · ' + K.pct(it.share) + ' браку відділу' +
      (it.after != null ? '<br><b>1-й тиждень після: ' + K.pct(it.after) + '</b> (' + esc(K.change(it.before, it.after)) + ')' + (it.after2 != null ? ' · 2-й тиждень після: ' + K.pct(it.after2) : '') : '') + '</dd>';
    dl += '<dt>Брак, % відділу</dt><dd>' + esc(K.rates(a)) + (a.result ? ' · 1-й тиждень після впровадження: ' + esc(K.rangeShort(a.result.start, a.result.end)) : '') + '</dd>';
    if (a.status === 'not_needed') dl += '<dt>Чому дія не потрібна</dt><dd>«' + esc(a.notNeededReason) + '»</dd>';
    else if (a.implementedAt) dl += '<dt>' + (a.causes.length > 1 ? 'Причини' : 'Причина') + '</dt><dd>' + esc(K.causeText(a)) + (a.causeNote ? ' — ' + esc(a.causeNote) : '') + '</dd>' +
      '<dt>Що зроблено</dt><dd>' + esc(a.plan) + '</dd>' + (a.whoName ? '<dt>Хто відповідає</dt><dd>' + esc(a.whoName) + '</dd>' : '') +
      '<dt>Впроваджено</dt><dd>' + H.dayShort(a.implementedAt) + ' · через ' + K.plural(a.daysToImplement, 'день', 'дні', 'днів') + ' після відкриття</dd>';
    else dl += '<dt>План</dt><dd>не записано · відкрито ' + H.dayShort(a.openedAt) + '</dd>';
    return '<div class="kd-h"><div class="kd-h__head"><b>КД · ' + esc(K.week(a.periodStart, a.periodEnd)) + '</b>' + K.stateBadge(a) + K.earlyBadge(a) +
      '<button class="link kd-h__open" type="button" data-act="open"' + K.ref(a) + '>картка КД</button></div><dl class="kd-dl">' + dl + '</dl></div>';
  };
  K.openTypeWindow = function (ctx, depId, typeId) {
    P.srv('srKdType', { locationId: ctx.loc.id, departmentId: depId, defectTypeId: typeId }).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { P.toast('danger', 'Не вдалося відкрити вид браку', r.error); return; }
      var p = r.period, s = r.state;
      var head = '<p class="kd-formula"><b>' + K.pct(r.rate) + '</b><span>= ' + K.num(r.pieces) + ' шт ÷ ' + K.num(r.checked) + ' перевірених у відділі за ' + esc(K.week(p.start, p.end)) +
        ' · ' + K.pct(r.share) + ' браку відділу</span>' + (r.pareto ? H.badge('у Парето ' + r.rules.pareto + '%', 'brand') : '') + '</p>' +
        '<p class="kd-tw__now"><span>Зараз:</span>' + K.stateBadge(s) + help('kd.typeState') + '</p>';
      var route = '<div class="kd-blk"><h4 class="kd-blk__t">Маршрут станів' + help('kd.route') + '</h4>' + K.routeTape(r.route, r.today) + '</div>';
      var chart = '<div class="kd-blk"><h4 class="kd-blk__t">Вид браку по тижнях, % від перевірених' + help('kd.typeChart') + '</h4>' +
        K.cap('Тижні ' + esc(K.spanOf(r.series)) + '. Колір стовпчика — стан КД, у якій вид браку був пунктом; сірий — тиждень без такої КД.') + '<div data-chart="kd-tw"></div></div>';
      var hist = '<div class="kd-blk"><h4 class="kd-blk__t">КД, де цей вид браку був пунктом · ' + r.history.length + help('kd.action') + '</h4>' +
        (r.history.length ? r.history.map(function (a) { return K.histEntry(a, typeId); }).join('') : '<p class="kd-text">Пунктом КД цей вид браку у відділі ще не був.</p>') + '</div>';
      var open = r.history.filter(function (a) { return a.status === 'new' || a.status === 'not_needed' || a.status === 'check' || a.status === 'hold'; })[0];
      var foot = '<div class="kd-btns kd-btns--foot">' + (r.canWrite && open ? K.decisionBtns(open) : '') +
        '<a class="btn btn--quiet btn--sm" href="#/kd/dept/' + encodeURIComponent(depId) + '?t=' + encodeURIComponent(typeId) + '" data-ov-close>' + P.ic('department', 'ui-icon--sm') + 'Усе про вид браку у відділі</a></div>';
      var find = function (t) { return K.finder(r.history)(t); };
      var m = P.sr.modal({ title: r.type.name + ' · ' + r.dept.name, sub: H.lvl(r.type.level) + ' · останній завершений ' + esc(K.week(p.start, p.end)),
        body: head + '<div class="kd-tw"><div class="kd-tw__col">' + chart + route + '</div><div class="kd-tw__col">' + hist + '</div></div>', foot: foot,
        onMount: function (el) { K.typeChart(el.querySelector('[data-chart="kd-tw"]'), r.series, { name: r.type.name, sel: p.n, height: 150, label: 'Вид браку «' + r.type.name + '» по тижнях, %' }); },
        on: {
          impl: function (t) { m.close(); K.openPlan(ctx, K.refOf(t)); },
          edit: function (t) { m.close(); K.openPlan(ctx, K.refOf(t), { edit: true }); },
          nn: function (t) { m.close(); K.openNotNeeded(ctx, K.refOf(t), find(t)); },
          open: function (t) { m.close(); K.openDrawer(ctx, K.refOf(t)); }
        } });
    });
  };
})(window);
