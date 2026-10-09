(function (root) {
  'use strict';
  var P = root.P, h = P.sr.h, esc = P.esc;
  var LV = ['fix', 'repair', 'scrap'];
  var LV_NEXT = { fix: 'можна виправити', repair: 'у ремонт', scrap: 'не відремонтувати' };
  var LV_COLOR = { fix: 'var(--info)', repair: 'var(--warn)', scrap: 'var(--danger)' };

  var A = P.srAn = {
    LV_NEXT: LV_NEXT, LV_COLOR: LV_COLOR,
    today: function () { return P.fmt.dayKey(new Date()); },
    diff: function (a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); },
    ago: function (day) {
      var n = A.diff(day, A.today());
      return n <= 0 ? 'сьогодні' : n === 1 ? 'учора' : n + ' ' + P.plural(n, 'день', 'дні', 'днів') + ' тому';
    },
    dshort: function (day) {
      var d = new Date(Date.parse(day + 'T12:00:00Z'));
      return d.toLocaleDateString('uk-UA', { weekday: 'short', timeZone: 'UTC' }) + ', ' + day.slice(8, 10) + '.' + day.slice(5, 7);
    },
    dcap: function (day) { var s = h.dayLong(day); return s.charAt(0).toUpperCase() + s.slice(1); },
    span: function (from, to) {
      function f(d) { return new Date(Date.parse(d + 'T12:00:00Z')).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', timeZone: 'UTC' }); }
      return from === to ? f(from) : f(from) + ' — ' + f(to);
    },
    pct0: function (v) { return v == null ? '—' : v < 1 ? h.pct(v) : Math.round(v) + '%'; },
    n: function (n, one, few, many) { return h.num(n) + ' ' + P.plural(n, one, few, many); },
    xLabels: function (days) {
      if (!days.length) return '';
      var idx = [], k = Math.min(5, days.length);
      for (var i = 0; i < k; i++) { var j = k === 1 ? 0 : Math.round(i * (days.length - 1) / (k - 1)); if (idx.indexOf(j) < 0) idx.push(j); }
      return '<div class="chart-x">' + idx.map(function (j) { return '<span>' + esc(h.dayShort(days[j])) + '</span>'; }).join('') + '</div>';
    },
    bars: function (items, o) {
      var H = o.height || 200, max = Math.max.apply(null, items.map(function (x) { return x.v || 0; }).concat([1]));
      return '<div class="chart an-chart' + (items.length > 40 ? ' an-dense' : '') + '" style="height:' + H + 'px" role="img" aria-label="' + esc(o.label || '') + '">' +
        items.map(function (x) {
          var st = x.none || !x.v ? 'height:2px;background:' + (x.none ? 'var(--line-mid)' : 'var(--text-3)') : 'height:' + Math.max(3, Math.round(x.v / max * (H - 12))) + 'px';
          return '<i' + (x.sel ? ' class="sel"' : '') + (x.act ? ' data-act="' + x.act + '" role="button" tabindex="0"' : '') + (x.attrs || '') +
            ' title="' + esc(x.title || '') + '" style="' + st + '"></i>';
        }).join('') + '</div>';
    },
    hbar: function (o) {
      var inner = (o.rank != null ? '<span class="rank">' + o.rank + '</span>' : '') +
        '<span><b>' + esc(o.name) + '</b><span class="sub">' + (o.sub || '') + '</span></span>' +
        '<div class="hbar__track"><i style="width:' + Math.max(2, Math.round(o.share * 100)) + '%"></i></div><span class="hbar__n">' + h.num(o.n) + '</span>';
      var st = o.cols ? ' style="grid-template-columns:' + o.cols + '"' : '';
      var cls = 'hbar an-hbar' + (o.rank == null ? ' an-hbar--nr' : '');
      if (o.href) return '<a class="' + cls + '" href="' + o.href + '"' + st + '>' + inner + '</a>';
      if (o.act) return '<button class="' + cls + '" type="button" data-act="' + o.act + '"' + (o.attrs || '') + st + '>' + inner + '</button>';
      return '<div class="hbar"' + st + '>' + inner + '</div>';
    },
    levels: function (o, height) { return h.legend(o) + h.stack(o, height || 14); },
    total: function (o) { return (o.fix || 0) + (o.repair || 0) + (o.scrap || 0); },
    share: function (o, k) { var t = A.total(o); return t ? Math.round(o[k] / t * 100) : 0; }
  };

  var ui = { unit: 'pcs', day: null, top: 10, defectShown: 15 };

  function tiles(r) {
    var all = r.todayAll;
    var head = '<div class="dtile dtile--all"><span class="dtile__name">Усі відділи</span>' +
      '<span class="dtile__meta">' + h.num(all.checked) + ' перевірено · брак ' + h.num(all.rejected) + ' шт · ' + h.pct(all.pct) + '</span>' +
      '<span class="dtile__meta">' + all.none + ' без аудитів · ' + all.done + ' норму виконано</span></div>';
    return '<div class="dtiles">' + head + r.todayDepts.map(function (d) {
      var done = d.target != null && d.checked >= d.target;
      var meta = d.lastTodayAt ? 'Аудит о ' + P.fmt.time(d.lastTodayAt) + (d.target == null ? ' · норма невідома' : '')
        : d.lastDay ? 'Останній аудит ' + A.ago(d.lastDay) : 'Аудитів ще не було';
      return '<button class="dtile an-tile" type="button" data-act="an-dept" data-id="' + esc(d.id) + '">' +
        '<span class="dtile__name">' + (done ? '<span style="color:var(--ok)" title="норму виконано">' + h.ic('check', 'ui-icon--sm') + '</span>' : '') + esc(d.name) + '</span>' +
        '<span class="dtile__meta">' + esc(meta) + '</span><div class="dtile__nums">' +
        '<div><b>' + h.num(d.checked) + '</b>' + (d.target != null ? ' з ' + h.num(d.target) : '') + '<span>перевірено</span></div>' +
        '<div>' + (d.checked || d.rejected ? '<b' + (d.pct > r.criticalPct ? ' style="color:var(--danger)"' : '') + '>' + h.num(d.rejected) + ' шт</b> · ' + h.pct(d.pct) : '<b>—</b>') + '<span>брак</span></div>' +
        '</div></button>';
    }).join('') + '</div>';
  }

  function daysCard(r) {
    var days = r.days, pctMode = ui.unit === 'pct';
    if (!ui.day || !days.some(function (d) { return d.day === ui.day; })) {
      var withA = days.filter(function (d) { return d.audits; }); ui.day = withA.length ? withA[withA.length - 1].day : null;
    }
    var max = Math.max.apply(null, days.map(function (d) { return pctMode ? d.pct || 0 : d.rejected; }).concat([pctMode ? 1 : 1])), H = 190;
    var bars = '<div class="sbars an-sbars' + (days.length > 40 ? ' an-dense' : '') + '" role="img" aria-label="Брак за днями">' + days.map(function (d) {
      var sel = d.day === ui.day ? ' sbar--sel' : '', tip = h.dayShort(d.day) + ' · ' + (d.audits ? 'брак ' + d.rejected + ' шт · ' + h.pct(d.pct) : 'не перевіряли');
      if (!d.audits) return '<div class="sbar sbar--none' + sel + '" data-act="an-day" data-day="' + d.day + '" role="button" tabindex="0" title="' + esc(tip) + '"><i></i></div>';
      var total = pctMode ? (d.pct || 0) / max * H : d.rejected / max * H, t = A.total(d.levels) || 1;
      return '<div class="sbar' + sel + '" data-act="an-day" data-day="' + d.day + '" role="button" tabindex="0" title="' + esc(tip) + '">' +
        (d.rejected ? ['scrap', 'repair', 'fix'].map(function (k) { return d.levels[k] ? '<i class="s-' + k + '" style="height:' + (d.levels[k] / t * total).toFixed(1) + 'px"></i>' : ''; }).join('')
          : '<i style="height:2px;background:var(--text-3)"></i>') + '</div>';
    }).join('') + '</div>';
    var sd = days.filter(function (d) { return d.day === ui.day; })[0];
    var facts = sd ? '<div class="facts" style="flex-direction:row;flex-wrap:wrap;gap:12px 24px;align-items:center">' +
      '<div style="flex:1;min-width:220px"><span class="hint">' + esc(A.dcap(sd.day)) + '</span><div style="font-weight:700">' +
      (sd.audits ? 'Перевірено ' + h.num(sd.checked) + ' шт · брак ' + h.num(sd.rejected) + ' шт · ' + h.pct(sd.pct) : 'Аудитів цього дня не було') + '</div>' +
      (sd.audits ? '<span class="hint">' + A.n(sd.audits, 'аудит', 'аудити', 'аудитів') + '</span>' : '') + '</div>' +
      (sd.rejected ? '<div class="legend">' + LV.map(function (k) { return '<span class="lvl lvl--' + k + '">' + esc(P.sr.LEVELS[k]) + ' · ' + sd.levels[k] + ' шт</span>'; }).join('') + '</div>' : '') +
      (sd.audits ? '<a class="btn btn--secondary btn--sm" href="#/history?day=' + sd.day + '">' + h.ic('audit', 'ui-icon--sm') + 'Аудити дня</a>' : '') + '</div>'
      : '<p class="hint">Натисніть на день — тут зʼявиться його підсумок.</p>';
    return '<section class="card col--wide"><div class="card-head" style="flex-wrap:wrap"><div style="flex:1;min-width:220px"><h2 class="card-title">Брак за днями, ' + (pctMode ? '%' : 'шт') + '</h2>' +
      '<p class="hint">Усі відділи · ' + esc(A.span(r.from, r.to)) + ' · колір — рівень браку · клік по дню — підсумок</p></div>' +
      '<span class="pills"><button class="pill' + (pctMode ? '' : ' pill--on') + '" type="button" data-act="an-unit" data-v="pcs">Штуки</button>' +
      '<button class="pill' + (pctMode ? ' pill--on' : '') + '" type="button" data-act="an-unit" data-v="pct">%</button></span></div>' +
      '<div class="legend">' + LV.map(function (k) { return '<span class="lvl lvl--' + k + '">' + esc(P.sr.LEVELS[k]) + '</span>'; }).join('') +
      '<span style="color:var(--text-3)">— не перевіряли</span></div>' + bars + A.xLabels(days.map(function (d) { return d.day; })) + facts + '</section>';
  }

  function compareLine(now, prev, days) {
    if (!A.total(prev)) return 'За попередні ' + days + ' дн. браку не було — порівнювати ні з чим.';
    var a = A.share(now, 'scrap'), b = A.share(prev, 'scrap');
    var lead = a === b ? 'Зламаного стільки ж, як' : 'Зламаного ' + (a < b ? 'менше' : 'більше') + ', ніж';
    return '<b>' + lead + ' за попередні ' + days + ' дн.:</b> ' + a + '% проти ' + b + '%.';
  }
  function levelsCard(r) {
    var L = r.levels, t = L.total, tot = A.total(t), days = r.days.length;
    if (!tot) return '<section class="card col"><h2 class="card-title">Рівні браку</h2>' + h.empty('Браку за період не знайшли', 'Візьміть довший період — 90 дн.') + '</section>';
    var shopScrap = A.share(t, 'scrap'), worst = null;
    L.depts.forEach(function (d) { var s = A.share(d.levels, 'scrap'); if (A.total(d.levels) && s > shopScrap && (!worst || s > worst.s)) worst = { id: d.id, s: s }; });
    return '<section class="card col"><div><h2 class="card-title">Рівні браку</h2><p class="hint">Що буде з бракованими виробами · ' + h.num(tot) + ' шт за ' + days + ' дн.</p></div>' +
      '<div class="kpis an-kpis3" style="grid-template-columns:repeat(3,minmax(0,1fr))">' + LV.map(function (k) {
        return '<div class="kpi"><span class="kpi__val" style="color:' + LV_COLOR[k] + '">' + A.share(t, k) + '%</span><span class="kpi__label">' +
          esc(P.sr.LEVELS[k]) + ' · ' + h.num(t[k]) + ' шт · ' + LV_NEXT[k] + '</span></div>'; }).join('') + '</div>' +
      h.stack(t) +
      '<p class="hint" style="font-size:16px;color:var(--text-2)">' + compareLine(t, L.prev, days) + '</p>' +
      '<p class="hint">Усього браку: ' + h.num(tot) + ' шт проти ' + h.num(A.total(L.prev)) + ' шт за ' + esc(A.span(L.prevFrom, L.prevTo)) + '.</p>' +
      '<div style="display:flex;flex-direction:column;gap:10px"><p class="group-label" style="padding:0">По відділах</p>' +
      L.depts.map(function (d) {
        var n = A.total(d.levels), s = A.share(d.levels, 'scrap'), ps = A.total(d.prev) ? A.share(d.prev, 'scrap') + '%' : '—';
        return '<div class="lvl-row an-lvl"><span>' + esc(d.name) + '</span>' + h.stack(d.levels, 16) +
          '<span class="lvl-row__n"' + (worst && worst.id === d.id ? ' style="color:var(--danger);font-weight:700"' : '') + ' title="Попередні ' + days + ' дн.: зламане ' + ps + '">' +
          (n ? h.num(n) + ' шт · зламане ' + s + '%' : 'браку немає') + '</span></div>';
      }).join('') + '</div></section>';
  }

  function topCard(r) {
    var types = r.top.types, shown = ui.top ? types.slice(0, ui.top) : types, max = types.length ? types[0].pieces : 1;
    return '<section class="card"><div class="card-head" style="flex-wrap:wrap"><div style="flex:1;min-width:220px"><h2 class="card-title">Що бракує найчастіше</h2>' +
      '<p class="hint">Усі відділи · ' + r.days.length + ' дн. · ' + A.n(types.length, 'вид', 'види', 'видів') + ' · ' + h.num(r.top.pieces) + ' шт · біля кожного виду — його рівень · клік — подробиці</p></div>' +
      '<span class="pills">' + [[10, 'Топ 10'], [30, 'Топ 30'], [0, 'Усі']].map(function (x) {
        return '<button class="pill' + (ui.top === x[0] ? ' pill--on' : '') + '" type="button" data-act="an-top" data-n="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</span></div>' +
      (types.length ? '<div>' + shown.map(function (t, i) {
        return A.hbar({ rank: i + 1, name: t.name, sub: esc(t.depts.join(', ')) + ' · ' + h.lvl(t.level), share: t.pieces / max, n: t.pieces, href: '#/analytics/defect/' + encodeURIComponent(t.id) });
      }).join('') + '</div>' : h.empty('Браку за період не знайшли', 'Візьміть довший період — 90 дн.')) + '</section>';
  }

  function ordersCard(r) {
    var head = '<div class="card-head"><div style="flex:1"><h2 class="card-title">Аналітика по замовленнях</h2><p class="hint">Як зараз · ' +
      A.n(r.orders.length, 'замовлення', 'замовлення', 'замовлень') + ' з аудитами за період · у клітинці — перевірено й % плану відділу · клік — подробиці</p></div></div>';
    if (!r.orders.length) return '<section class="card">' + head + h.empty('Аудитів по замовленнях за період не було', 'Візьміть довший період — 90 дн.') + '</section>';
    return '<section class="card">' + head + '<div class="tbl-box"><table class="tbl an-otbl"><thead><tr><th>Замовлення</th>' +
      r.departments.map(function (d) { return '<th class="n">' + esc(d.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      r.orders.map(function (o) {
        return '<tr data-act="an-order" data-no="' + esc(o.no) + '"><td><b>' + esc(o.no) + '</b><span class="sub">' + esc(o.products.join(', ')) + '</span></td>' +
          r.departments.map(function (d) {
            var c = o.cells[d.id];
            return c ? '<td class="n" title="брак ' + c.rejected + ' шт · ' + esc(h.pct(c.pct)) + ' · план ' + h.num(c.plan) + ' шт">' + h.num(c.checked) + ' · ' + A.pct0(c.planPct) + '</td>' : '<td class="n" style="color:var(--text-3)">—</td>';
          }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  function openDept(ctx, d) {
    var layer = P.sr.drawer({ title: d.name + ' сьогодні', sub: esc(h.dayLong(A.today()) + ' · станом на ' + P.fmt.time(new Date().toISOString()) + ' · ' + A.n(d.audits, 'аудит', 'аудити', 'аудитів')),
      body: h.loading(),
      foot: '<button class="btn btn--quiet btn--sm" type="button" data-ov-close>Закрити</button>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-act="hist" style="margin-left:auto">' + h.ic('audit', 'ui-icon--sm') + 'Усі аудити відділу</button>',
      on: { hist: function (t, e, l) { l.close(); ctx.go('/history', { dep: d.id }); },
        aud: function (t) { if (P.srHist) P.srHist.openAudit(t.getAttribute('data-id')); },
        retry: function () { load(); } } });
    function load() {
      layer.body(h.loading());
      P.srv('srDeptDay', { locationId: ctx.loc.id, departmentId: d.id }).then(function (r) {
        if (layer.closed) return;
        if (!r.ok) { layer.body(h.error(r)); return; }
        layer.body(deptBody(r));
      });
    }
    load();
  }
  function deptBody(r) {
    var t = r.target, done = t != null && r.checked >= t, w = t ? Math.min(100, Math.round(r.checked / t * 100)) : 0;
    var norm = '<div class="facts"><div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><b style="font-size:28px;line-height:1.1;font-variant-numeric:tabular-nums">' + h.num(r.checked) + '</b>' +
      '<span style="color:var(--text-2)">' + (t != null ? 'з ' + h.num(t) + ' шт перевірено' : 'шт перевірено') + '</span>' +
      (t == null ? '<span class="badge" style="margin-left:auto">норма невідома</span>' : done ? '<span class="badge badge--ok" style="margin-left:auto">' + h.ic('check', 'ui-icon--sm') + 'норму виконано</span>'
        : '<span class="badge badge--warn" style="margin-left:auto">ще ' + h.num(t - r.checked) + ' шт до норми</span>') + '</div>' +
      (t != null ? '<div class="stack" role="img" aria-label="Норма дня: ' + r.checked + ' з ' + t + '" style="height:14px"><i style="width:' + w + '%;background:var(--' + (done ? 'ok' : 'warn-fill') + ')"></i></div>' +
        '<p class="hint">Норма дня — ' + h.num(t) + ' шт перевіреного. ' + (done ? (r.checked > t ? 'Сьогодні на ' + h.num(r.checked - t) + ' шт більше.' : 'Рівно норма.') : 'Лишилось ' + h.num(t - r.checked) + ' шт.') + '</p>'
        : '<p class="hint">Норму вибірки для відділу можна задати в «Керуванні».</p>') + '</div>';
    var over = r.pct != null && r.pct > r.criticalPct;
    var kpis = '<div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
      h.kpi(h.num(r.rejected) + ' шт', 'брак дня · ' + h.pct(r.pct) + (r.pct == null ? '' : over ? ' — вище порогу' : ' — нижче порогу'), over ? 'danger' : '') +
      h.kpi(r.criticalPct + '%', 'критичний рівень браку відділу') + '</div>';
    var audits = '<div style="display:flex;flex-direction:column;gap:4px"><p class="group-label" style="padding:0">Аудити дня</p>' + (r.audits.length ? '<div class="list">' + r.audits.map(function (a) {
      return '<button class="row-item" type="button" data-act="aud" data-id="' + esc(a.id) + '"><b style="width:52px;font-variant-numeric:tabular-nums">' + P.fmt.time(a.createdAt) + '</b>' +
        '<span class="row-item__main"><span class="row-item__title">' + esc(a.auditorName) + '</span><span class="row-item__meta">' + esc(a.orders.concat(a.products).join(' · ')) + '</span></span>' +
        '<span style="text-align:right;font-variant-numeric:tabular-nums"><b>' + h.num(a.checked) + ' шт</b><span class="sub"' + (a.rejected ? ' style="color:var(--danger)"' : '') + '>брак ' + a.rejected + '</span></span></button>';
    }).join('') + '</div>' : '<p class="hint">Сьогодні в цьому відділі аудитів ще не було. Записати можна кнопкою «Додати» → «Новий аудит».</p>') + '</div>';
    var types = '<div style="display:flex;flex-direction:column;gap:8px"><p class="group-label" style="padding:0">Види браку дня</p>' + (r.types.length ? '<div class="list">' + r.types.map(function (t) {
      return '<button class="row-item" type="button" data-act="aud" data-id="' + esc(t.auditId) + '" style="min-height:48px"><span class="row-item__main"><span class="row-item__title">' + esc(t.name) + '</span>' +
        '<span class="row-item__meta">' + h.lvl(t.level) + ' · ' + esc(t.workers.map(function (w) { return w.code ? w.name + ' · ' + w.code : w.name; }).join(', ')) + '</span></span><b>' + t.pieces + ' шт</b></button>';
    }).join('') + '</div>' : '<p class="hint">Браку цього відділу сьогодні не знайшли.</p>') +
      r.others.map(function (o) { return '<p class="hint">Ще ' + o.pieces + ' шт знайшли тут, але це брак іншого відділу: ' + esc(o.typeName.toLowerCase()) + ' — зараховано відділу ' + esc(o.departmentName) + '.</p>'; }).join('') + '</div>';
    var m = r.month, mt = A.total(m), ms = A.share(m, 'scrap'), ss = A.share(r.shopMonth, 'scrap');
    var month = '<div class="facts"><p class="group-label" style="padding:0">Рівні браку за 30 днів · ' + h.num(mt) + ' шт</p>' + (mt ?
      h.legend() + h.stack(m) + '<div style="display:flex;justify-content:space-between;gap:8px;font-size:14px;color:var(--text-2);font-variant-numeric:tabular-nums">' +
      LV.map(function (k) { return '<span><b>' + A.share(m, k) + '%</b> · ' + h.num(m[k]) + ' шт</span>'; }).join('') + '</div>' +
      '<p class="hint">Зламаного ' + (ms < ss ? 'менше' : ms > ss ? 'більше' : 'стільки ж') + ', ніж у цеху загалом: ' + ms + '% проти ' + ss + '%.</p>'
      : '<p class="hint">За 30 днів браку цього відділу не знайшли.</p>') + '</div>';
    return norm + kpis + audits + types + month;
  }

  function openOrder(ctx, no) {
    var data = null, dep = 'all';
    var layer = P.sr.modal({ title: 'Замовлення ' + no, body: h.loading(),
      foot: '<p class="action-bar__sum an-foot-note" style="font-size:14px;flex:1;margin:0">Червона риска зліва — брак в аудиті вищий за критичний рівень 5%.</p>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-act="hist">' + h.ic('audit', 'ui-icon--sm') + 'Відкрити в історії</button>' +
        '<button class="btn btn--primary btn--sm" type="button" data-ov-close>Закрити</button>',
      on: { hist: function (t, e, l) { l.close(); ctx.go('/history', { order: no }); },
        dep: function (t) { dep = t.getAttribute('data-id'); draw(); },
        aud: function (t) { if (P.srHist) P.srHist.openAudit(t.getAttribute('data-id')); },
        retry: function () { load(); } } });
    function draw() { layer.body(orderBody(data, dep)); }
    function load() {
      layer.body(h.loading());
      P.srv('srOrder', { locationId: ctx.loc.id, orderNo: no }).then(function (r) {
        if (layer.closed) return;
        if (!r.ok) { layer.body(h.error(r)); return; }
        data = r; var o = r.order;
        layer.el.querySelector('.modal__title').textContent = 'Замовлення ' + o.no + (o.products.length ? ' · ' + o.products.join(', ') : '');
        var head = layer.el.querySelector('.modal__head > div');
        head.insertAdjacentHTML('beforeend', '<p class="hint">План ' + h.num(o.plan) + ' шт по всіх відділах · ' + esc(o.customer) + (o.blockName ? ' · ' + esc(o.blockName) : '') +
          (o.firstAuditDay ? ' · аудити з ' + esc(A.span(o.firstAuditDay, o.lastAuditDay).replace(' — ', ' по ')) : '') + '</p>');
        head.insertAdjacentHTML('afterend', '<span class="badge badge--' + (o.active ? 'info">у роботі' : 'ok">завершено') + '</span>');
        draw();
      });
    }
    load();
  }
  function orderBody(r, dep) {
    var v = r.views[dep], crit = r.criticalPct, depName = dep === 'all' ? 'Усі відділи' : r.departments.filter(function (d) { return d.id === dep; })[0].name;
    var seg = '<div class="seg an-seg" role="tablist" aria-label="Відділ" style="align-self:flex-start;flex-wrap:wrap">' +
      '<button class="seg__btn' + (dep === 'all' ? ' seg__btn--on' : '') + '" type="button" data-act="dep" data-id="all">Усі</button>' +
      r.departments.map(function (d) {
        return '<button class="seg__btn' + (dep === d.id ? ' seg__btn--on' : '') + '" type="button" data-act="dep" data-id="' + esc(d.id) + '"' + (d.audits ? '' : ' style="color:var(--text-3)"') + '>' +
          esc(d.name) + (d.audits ? '' : ' · ще не було') + '</button>'; }).join('') + '</div>';
    var over = v.pct != null && v.pct > crit;
    var kpis = '<div class="kpis an-kpis6">' + h.kpi(h.num(v.checked), 'перевірено, шт') + h.kpi(A.pct0(v.planPct), 'від плану · ' + h.num(v.plan) + ' шт') +
      h.kpi(h.num(v.rejected), 'брак, шт', v.rejected ? 'danger' : '') + h.kpi(h.pct(v.pct), 'брак · у цеху ' + h.pct(v.shopPct), over ? 'danger' : '') +
      h.kpi(h.num(v.audits), P.plural(v.audits, 'аудит', 'аудити', 'аудитів')) + h.kpi(h.num(v.daysWithAudits), 'днів з аудитами з ' + v.daysTotal) + '</div>';
    if (!v.audits) return seg + kpis + h.empty(depName + ': аудитів цього замовлення ще не було', 'Записати можна кнопкою «Додати» → «Новий аудит».');
    var max = v.types.length ? v.types[0].pieces : 1;
    var cols = '24px minmax(0, 270px) minmax(0, 1fr) 40px';
    var types = '<div class="col" style="display:flex;flex-direction:column;gap:10px"><div><h3 class="card-title">Що бракує в замовленні</h3><p class="hint">' + h.num(v.rejected) + ' шт · біля кожного виду — його рівень</p></div>' +
      (v.types.length ? '<div>' + v.types.slice(0, 8).map(function (t, i) {
        return A.hbar({ rank: i + 1, name: t.name, sub: esc(t.depts.join(', ')) + ' · ' + h.lvl(t.level), share: t.pieces / max, n: t.pieces, cols: cols, href: '#/analytics/defect/' + encodeURIComponent(t.id) });
      }).join('') + '</div>' + A.levels(v.levels) : '<p class="hint">Браку в цьому замовленні не знайшли.</p>') + '</div>';
    var few = v.days.length <= 14;
    var chart = '<div class="col" style="display:flex;flex-direction:column;gap:10px"><div><h3 class="card-title">Брак по днях, шт</h3><p class="hint">' +
      esc(A.span(v.days[0].day, v.days[v.days.length - 1].day)) + ' · у дні без аудитів — риска</p></div>' +
      A.bars(v.days.map(function (d) { return { v: d.rejected, none: !d.audited, sel: v.worstDay && d.day === v.worstDay.day, title: h.dayShort(d.day) + ' · ' + (d.audited ? d.rejected + ' шт з ' + d.checked : 'аудитів не було') }; }), { height: 200, label: 'Брак по днях' }) +
      (few ? '<div class="chart-x an-xs">' + v.days.map(function (d) { return '<span>' + (d.audited ? d.rejected : '—') + '</span>'; }).join('') + '</div>' +
        '<div class="chart-x an-xs" style="margin-top:0">' + v.days.map(function (d) { return '<span>' + esc(h.dayShort(d.day)) + '</span>'; }).join('') + '</div>'
        : A.xLabels(v.days.map(function (d) { return d.day; }))) +
      (v.worstDay ? '<p class="hint" style="font-size:16px;color:var(--text-2)"><b>Найбільше — ' + esc(A.span(v.worstDay.day, v.worstDay.day)) + ':</b> ' + v.worstDay.rejected + ' шт' +
        (dep === 'all' ? ' (найбільше в ' + esc(v.worstDay.departmentName) + ')' : '') + ' з ' + h.num(v.worstDay.checked) + ' перевірених.</p>' : '') + '</div>';
    var table = '<div style="display:flex;flex-direction:column;gap:8px"><h3 class="card-title">Аудити замовлення · ' + v.audits + '</h3><div class="tbl-box"><table class="tbl">' +
      '<thead><tr><th>Дата й час</th><th>Відділ</th><th>Аудитор</th><th class="n">Перевірено, шт</th><th class="n">Брак, шт</th></tr></thead><tbody>' +
      v.rows.map(function (a) {
        var ov = a.pct != null && a.pct > crit;
        return '<tr data-act="aud" data-id="' + esc(a.id) + '"' + (ov ? ' class="exceed"' : '') + '><td>' + esc(A.dshort(a.day)) + ' · ' + P.fmt.time(a.createdAt) + '</td><td>' + esc(a.departmentName) + '</td>' +
          '<td>' + esc(a.auditorName) + '</td><td class="n">' + h.num(a.checked) + '</td>' +
          '<td class="n"' + (ov ? ' style="color:var(--danger)"' : !a.rejected ? ' style="color:var(--ok)"' : '') + '>' + (a.rejected ? '<b>' + a.rejected + '</b> · ' + h.pct(a.pct) : '0') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    return seg + kpis + '<div class="row">' + types + chart + '</div>' + table;
  }

  P.sr.screen('/analytics', { tab: 'analytics', title: 'Аналітика', render: function (ctx) {
    var data = null;
    function draw() {
      ctx.el.innerHTML = '<section style="display:flex;flex-direction:column;gap:12px"><div><h2 class="h2">Відділи сьогодні</h2>' +
        '<p class="h2-sub">' + esc(h.dayLong(data.today)) + ' · станом на ' + P.fmt.time(data.asOf) + ' · клік по відділу — подробиці дня</p></div>' + tiles(data) + '</section>' +
        '<div class="row">' + daysCard(data) + levelsCard(data) + '</div>' + topCard(data) + ordersCard(data);
    }
    P.srv('srAnalytics', { locationId: ctx.loc.id, from: ctx.period.from, to: ctx.period.to }).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { ctx.el.innerHTML = h.error(r); return; }
      data = r; draw();
    });
    ctx.on('an-dept', function (t) { var d = data.todayDepts.filter(function (x) { return x.id === t.getAttribute('data-id'); })[0]; if (d) openDept(ctx, d); });
    ctx.on('an-unit', function (t) { ui.unit = t.getAttribute('data-v'); draw(); });
    ctx.on('an-day', function (t) { ui.day = t.getAttribute('data-day'); draw(); });
    ctx.on('an-top', function (t) { ui.top = +t.getAttribute('data-n'); draw(); });
    ctx.on('an-order', function (t) { openOrder(ctx, t.getAttribute('data-no')); });
  } });

  P.sr.screen('/analytics/defect/:id', { tab: 'analytics', title: 'Вид браку', render: function (ctx) {
    var data = null;
    function draw() {
      var r = data, t = r.type, days = r.days, N = days.length;
      var head = '<div class="card-head" style="flex-wrap:wrap"><a class="btn btn--secondary btn--sm" href="#/analytics">' + h.ic('arrow-left', 'ui-icon--sm') + 'До всіх видів</a>' +
        '<div style="flex:1;min-width:240px"><p class="hint">' + (r.rank ? 'Що бракує найчастіше · ' + r.rank + ' місце з ' + r.typesCount : 'За цей період цього браку не було') + '</p>' +
        '<h2 class="card-title" style="font-size:24px">' + esc(t.name) + ' <span class="lvl lvl--' + esc(t.level) + '" style="vertical-align:middle;margin-left:6px">' + esc(P.sr.LEVELS[t.level]) + ' · ' + LV_NEXT[t.level] + '</span></h2></div>' +
        '<div style="text-align:right"><b style="font-size:28px;line-height:1.1;font-variant-numeric:tabular-nums">' + h.num(r.pieces) + ' шт</b><span class="sub">за ' + N + ' дн. · ' + h.pct(r.share) + ' усього браку</span></div></div>';
      if (!r.pieces) {
        ctx.el.innerHTML = '<section class="card">' + head + h.empty('За період цього браку не знайшли', 'Візьміть довший період — 90 дн. — або поверніться до всіх видів.') + '</section>';
        return;
      }
      var split = N >= 21 ? N - 14 : 0, a = days.slice(0, split), b = days.slice(split);
      function sum(l) { return l.reduce(function (s, d) { return s + d.pieces; }, 0); }
      var avgA = split ? sum(a) / a.length : null, avgB = sum(b) / b.length, max = Math.max.apply(null, days.map(function (d) { return d.pieces; }).concat([1])), H = 260;
      var lines = (split ? '<span aria-hidden="true" class="an-avg" style="left:0;width:' + (split / N * 100).toFixed(1) + '%;bottom:' + Math.round(avgA / max * (H - 12) + 1) + 'px"></span>' : '') +
        '<span aria-hidden="true" class="an-avg" style="left:' + (split / N * 100).toFixed(1) + '%;right:0;bottom:' + Math.round(avgB / max * (H - 12) + 1) + 'px"></span>';
      var chart = '<div style="position:relative">' + A.bars(days.map(function (d, i) {
        return { v: d.pieces, none: !d.audited, sel: i >= split && split > 0, title: h.dayShort(d.day) + ' · ' + (d.audited ? d.pieces + ' шт' : 'аудитів не було') };
      }), { height: H, label: t.name + ' по днях' }) + lines + '</div>' + A.xLabels(days.map(function (d) { return d.day; }));
      function f1(x) { return String(Math.round(x * 10) / 10).replace('.', ','); }
      var banner = '';
      if (split) {
        var up = avgB > avgA * 1.3, down = avgB < avgA * 0.7;
        banner = '<div class="banner' + (up ? ' banner--warn' : '') + '" style="align-items:center">' + h.ic(up ? 'trend-up' : down ? 'trend-down' : 'trend-flat', 'icon') +
          '<div class="banner__body"><p class="banner__title">' + (up ? 'Частіше за останні 2 тижні' : down ? 'Рідше за останні 2 тижні' : 'Приблизно так само, як раніше') + ': ' + f1(avgA) + ' → ' + f1(avgB) + ' шт на день</p>' +
          '<p class="banner__text">До ' + esc(A.span(a[a.length - 1].day, a[a.length - 1].day)) + ' — ' + sum(a) + ' шт за ' + a.length + ' дн. З ' + esc(A.span(b[0].day, b[0].day)) + ' — ' + sum(b) + ' шт за ' + b.length + ' дн.' +
          (days[N - 1].pieces ? ' Сьогодні — ' + days[N - 1].pieces + ' шт.' : ' Сьогодні цього браку не знайдено.') + '</p></div></div>';
      }
      var legend = '<div class="legend">' + (split ? '<span class="an-key"><i style="background:#6F829B"></i>перші ' + split + ' дн.</span><span class="an-key"><i style="background:var(--brand)"></i>останні 2 тижні</span>'
        : '<span class="an-key"><i style="background:#6F829B"></i>брак за день</span>') + '<span class="an-key"><i class="an-key__dash"></i>середнє на день</span><span class="an-key"><i style="height:3px;background:var(--line-mid)"></i>аудитів не було</span></div>';
      var dmax = r.depts.length ? r.depts[0].pieces : 1, top = r.workers.slice(0, 5), rest = r.workers.slice(5);
      var side = '<div class="col" style="display:flex;flex-direction:column;gap:12px">' +
        '<div class="facts"><p class="group-label" style="padding:0">Рівень</p><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<span class="lvl lvl--' + esc(t.level) + '" style="font-size:16px">' + esc(P.sr.LEVELS[t.level]) + '</span><span class="hint">' + { fix: 'виріб можна виправити', repair: 'виріб іде в ремонт', scrap: 'виріб не відремонтувати' }[t.level] + '</span></div></div>' +
        '<div class="facts"><p class="group-label" style="padding:0">У яких відділах</p>' + r.depts.map(function (d) {
          return '<div class="lvl-row an-lvl" style="grid-template-columns:110px minmax(0,1fr) 64px"><span>' + esc(d.name) + '</span><div class="hbar__track"><i style="width:' + Math.round(d.pieces / dmax * 100) + '%"></i></div><span class="lvl-row__n"><b style="color:var(--text)">' + d.pieces + ' шт</b></span></div>';
        }).join('') + '</div>' +
        '<div class="facts"><p class="group-label" style="padding:0">У кого найбільше</p><div style="display:flex;flex-wrap:wrap;gap:8px">' + top.map(function (w, i) {
          var hot = i < 2 && w.pieces >= r.pieces * 0.2, label = (w.code ? w.name + ' · ' + w.code : w.name) + ' · ' + w.pieces + ' шт';
          return w.code ? '<button class="badge an-badge-btn' + (hot ? ' badge--danger' : '') + '" type="button" data-act="an-worker" data-code="' + esc(w.code) + '">' + esc(label) + '</button>' : '<span class="badge">' + esc(label) + '</span>';
        }).join('') + (rest.length ? '<span class="badge">ще ' + A.n(rest.length, 'людина', 'людини', 'людей') + ' · ' + rest.reduce(function (s, w) { return s + w.pieces; }, 0) + ' шт</span>' : '') + '</div></div>' +
        '<div class="facts"><p class="group-label" style="padding:0">На яких виробах</p><p class="hint" style="font-size:16px;color:var(--text-2)">' +
        esc(r.products.map(function (p) { return p.name + ' — ' + p.pieces + ' шт'; }).join(' · ')) + '</p></div></div>';
      var shown = r.rows.slice(0, ui.defectShown), left = r.rows.length - shown.length;
      var table = '<section class="card"><div class="card-head"><div style="flex:1"><h2 class="card-title">Записи: ' + esc(t.name.toLowerCase()) + '</h2><p class="hint">Нові зверху · показано ' + shown.length + ' з ' +
        A.n(r.rows.length, 'запису', 'записів', 'записів') + ' · клік — увесь аудит</p></div></div><div class="tbl-box"><table class="tbl"><thead><tr><th>Дата</th><th>Відділ</th><th>Виріб</th><th>Працівник</th><th class="n">Брак, шт</th></tr></thead><tbody>' +
        shown.map(function (x) {
          return '<tr data-act="an-aud" data-id="' + esc(x.auditId) + '"><td>' + esc(A.dshort(x.day)) + '</td><td>' + esc(x.departmentName) + (x.otherDept ? '<span class="sub">знайшли в іншому відділі</span>' : '') + '</td>' +
            '<td>' + esc(x.productName) + (x.orderNo ? '<span class="sub">' + esc(x.orderNo) + '</span>' : '') + '</td>' +
            (x.workerCode ? '<td><b>' + esc(x.workerName) + '</b><span class="sub">' + esc(x.workerCode) + '</span></td>' : '<td style="color:var(--text-3)"><b>' + esc(x.workerName) + '</b><span class="sub">аудитор не вказав код</span></td>') +
            '<td class="n"><b>' + x.qty + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' +
        (left > 0 ? '<button class="btn btn--secondary btn--sm" type="button" data-act="an-more" style="align-self:flex-start">Показати ще ' + Math.min(left, 15) + ' з ' + left + '</button>' : '') + '</section>';
      ctx.el.innerHTML = '<section class="card">' + head + '<div class="row"><div class="col--wide" style="display:flex;flex-direction:column;gap:12px">' +
        '<div><h3 class="card-title">Коли зʼявляється — по днях, шт</h3><p class="hint">' + esc(A.span(r.from, r.to)) + ' · найвищий стовпчик — ' + max + ' шт</p></div>' +
        legend + chart + banner + '</div>' + side + '</div></section>' + table;
    }
    ui.defectShown = 15;
    P.srv('srDefect', { locationId: ctx.loc.id, defectTypeId: ctx.params.id, from: ctx.period.from, to: ctx.period.to }).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) {
        ctx.el.innerHTML = r.code === 'not_found' ? h.empty('Такого виду браку немає', r.error) + '<p style="text-align:center"><a class="btn btn--secondary btn--sm" href="#/analytics">До всіх видів</a></p>' : h.error(r);
        return;
      }
      data = r; draw();
    });
    ctx.on('an-more', function () { ui.defectShown += 15; draw(); });
    ctx.on('an-aud', function (t) { if (P.srHist) P.srHist.openAudit(t.getAttribute('data-id')); });
    ctx.on('an-worker', function (t) { if (P.srPeople) P.srPeople.openWorker(ctx, t.getAttribute('data-code')); });
  } });
})(window);
