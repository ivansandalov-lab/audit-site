(function (root) {
  'use strict';
  var P = root.P, h = P.sr.h, esc = P.esc, A = P.srAn, X = P.srAnParts, ui = X.ui;
  var LV = X.LV;
  var MODES = [['pcs', 'Брак, шт'], ['pct', 'Брак, %'], ['chk', 'Перевірено, шт']];
  var chart = null;   // контролер графіка по днях (P.srChart.mount)

  function summary(view) {
    var r = view.data, t = r.totals, p = r.prev, n = t.days;
    function cell(label, val, prev, help) {
      return '<div class="an-sum__i"><span class="an-sum__l">' + label + A.q(help) + '</span><b class="an-sum__v">' + val + '</b>' +
        '<span class="an-sum__p">попередні ' + X.dn(n) + ' — <b>' + prev + '</b></span></div>';
    }
    view.box('an-sum').innerHTML = '<div><h2 class="h2">За період · ' + esc(view.scope()) + A.q('sr.an.period') + '</h2><p class="h2-sub">' + esc(A.span(r.from, r.to)) + ' · ' + X.dn(n) +
      ' · під кожним числом — те саме за попередні ' + X.dn(n) + ': ' + esc(A.span(p.from, p.to)) + '</p></div>' +
      '<div class="an-sum">' + cell('Аудитів', h.num(t.audits), h.num(p.audits)) +
      cell('Днів з аудитами', t.daysWithAudits + ' з ' + n, p.daysWithAudits + ' з ' + n, 'sr.an.daysWith') +
      cell('Перевірено, шт', h.num(t.checked), h.num(p.checked), 'term.checked') + cell('Брак, шт', h.num(t.rejected), h.num(p.rejected), 'term.rejected') +
      cell('Брак, % · брак, шт ÷ перевірено, шт', h.pct(t.pct), h.pct(p.pct), 'term.rate') + '</div>';
  }

  function pickRow(kind, title, s, norm, href, btn) {
    var facts = [['аудитів', h.num(s.audits)], ['перевірено', h.num(s.checked) + ' шт']].concat(norm ? [norm] : [], [['брак, шт · %', X.brak(s.rejected, s.pct)]]);
    return '<div class="an-pick"><div class="an-pick__title"><span class="hint">' + kind + '</span><b>' + esc(title) + '</b></div>' +
      '<div class="an-pick__facts">' + facts.map(function (f) { return '<span><i>' + f[0] + '</i><b>' + f[1] + '</b></span>'; }).join('') + '</div>' +
      (s.rejected ? h.legend(s.levels) : '') + '<span class="an-pick__btns">' +
      (s.audits ? '<a class="btn btn--secondary btn--sm" href="' + href + '">' + h.ic('audit', 'ui-icon--sm') + btn + '</a>' : '') +
      '<button class="btn btn--quiet btn--sm" type="button" data-act="an-unpick">' + h.ic('close', 'ui-icon--sm') + 'Зняти вибір</button></span></div>';
  }
  function drawPick(view) {
    var box = view.box('an-pick');
    if (!box) return;
    var r = view.data, dep = r.department, depId = dep ? dep.id : '', normLabel = dep ? 'норма дня' : 'норма дня, усі відділи';
    if (ui.day) {
      var d = r.days.filter(function (x) { return x.day === ui.day; })[0];
      box.innerHTML = pickRow('Обраний день · ' + esc(view.scope()), A.dcap(d.day), d, d.target != null ? [normLabel, h.num(d.target) + ' шт'] : null,
        X.hist({ d1: d.day, d2: d.day, dep: depId }), 'Аудити дня');
    } else if (ui.range) {
      var list = r.days.filter(function (x) { return x.day >= ui.range[0] && x.day <= ui.range[1]; }), s = X.sum(list);
      box.innerHTML = pickRow('Обрані дні · ' + esc(view.scope()), A.span(ui.range[0], ui.range[1]), s, ['днів з аудитами', s.daysWithAudits + ' з ' + s.days],
        X.hist({ d1: ui.range[0], d2: ui.range[1], dep: depId }), 'Відкрити ці дні в історії');
    } else {
      box.innerHTML = '<p class="hint an-pick__empty">День не обрано. Клік по стовпчику — числа дня тут і кнопка «Аудити дня»; протягування — сума за кілька днів. Фільтри сторінки від цього не міняються.</p>';
    }
  }
  function daysCard(view) {
    var r = view.data, days = r.days, dep = r.department, mode = ui.unit, box = view.box('an-days');
    function has(k) { return days.some(function (d) { return d.day === k; }); }
    if (ui.day && !has(ui.day)) ui.day = null;                                   // період змінили — вибір поза ним знімаємо
    if (ui.range && !(has(ui.range[0]) && has(ui.range[1]))) ui.range = null;
    if (!r.totals.audits && !r.totals.rejected) {                                // порожній період — графіку нема що показати
      chart = null;
      box.innerHTML = '<div><h2 class="card-title">Брак і перевірене за днями</h2><p class="hint">' + esc(view.scope()) + ' · ' + esc(A.span(r.from, r.to)) + '</p></div>' +
        h.empty('Аудитів за період не було', view.scope() + ' · ' + A.span(r.from, r.to));
      return;
    }
    var target = days.length ? days[0].target : null, normLabel = dep ? 'Норма дня' : 'Норма дня, усі відділи';
    var title = mode === 'pcs' ? 'Брак за днями, шт' : mode === 'pct' ? 'Брак за днями, % від перевіреного' : 'Перевірено за днями, шт';
    var line = mode === 'chk' ? (target != null ? { v: target, label: normLabel.toLowerCase() + ' — ' + h.num(target) + ' шт' } : null)
      : mode === 'pct' ? { v: r.criticalPct, label: 'критичний рівень — ' + r.criticalPct + '%' } : null;
    var keys = mode === 'chk' ? [['an-key__one', 'перевірено, шт']].concat(line ? [['an-key__dash', line.label]] : [])
      : mode === 'pct' ? [['an-key__dash', line.label]] : [];
    box.innerHTML = '<div class="card-head" style="flex-wrap:wrap"><div style="flex:1;min-width:220px"><h2 class="card-title">' + title + A.q('sr.an.days') + '</h2>' +
      '<p class="hint">' + esc(view.scope()) + ' · ' + esc(A.span(r.from, r.to)) + (mode === 'chk' ? '' : ' · колір — рівень браку') +
      ' · наведіть на день — його числа · клік — зафіксувати · протягніть — кілька днів</p></div>' +
      '<span class="pills" role="group" aria-label="Що показує графік">' + MODES.map(function (m) {
        return '<button class="pill' + (mode === m[0] ? ' pill--on' : '') + '" type="button" data-act="an-unit" data-v="' + m[0] + '" aria-pressed="' + (mode === m[0]) + '">' + m[1] + '</button>'; }).join('') + '</span></div>' +
      X.legend(mode !== 'chk', keys.concat([['an-key__none', 'аудитів не було']])) + '<div data-chart="days"></div><div id="an-pick"></div>';
    chart = P.srChart.mount(box.querySelector('[data-chart]'), {
      items: days.map(function (d) {
        return { key: d.day, x: h.dayShort(d.day), d: d, v: mode === 'pcs' ? d.rejected : mode === 'pct' ? d.pct || 0 : d.checked,
          levels: mode === 'chk' ? null : d.levels, none: !d.audits && (mode !== 'pcs' || !d.rejected) };
      }),
      height: root.innerWidth < 900 ? 240 : dep ? 280 : 420, label: title + ' · ' + view.scope(), line: line,
      tip: function (it) { return X.dayTip(it.d, normLabel); },
      tipRange: function (list, a, b) {
        var s = X.sum(list.map(function (x) { return x.d; }));
        return P.srChart.tipDay({ title: A.span(a.key, b.key), sub: X.dn(s.days) + ' · з аудитами — ' + s.daysWithAudits, audits: s.audits, checked: s.checked, rejected: s.rejected, pct: s.pct, levels: s.levels });
      },
      pin: ui.day, range: ui.range,
      onPin: function (it) { ui.day = it ? it.key : null; if (it) ui.range = null; drawPick(view); },
      onRange: function (a, b) { ui.range = a ? [a.key, b.key] : null; if (a) ui.day = null; drawPick(view); }
    });
    drawPick(view);
  }

  function levelsCard(view) {
    var r = view.data, L = r.levels, t = L.total, tot = A.total(t), pt = A.total(L.prev), n = r.totals.days;
    var head = '<div><h2 class="card-title">Рівні браку' + A.q('term.levels') + '</h2><p class="hint">' + esc(view.scope()) + ' · ' + X.dn(n) + ' · ' + h.num(tot) + ' шт браку · частка рівня = його штуки ÷ увесь брак</p></div>';
    var box = view.box('an-levels');
    if (!tot && !pt) { box.innerHTML = head + h.empty('Браку за період не знайдено', view.scope() + ' · ' + A.span(r.from, r.to)); return; }
    function cellOf(o, k) { var s = A.total(o); return s ? '<b>' + A.share(o, k) + '%</b> · ' + h.num(o[k]) + ' шт' : '—'; }
    var cmp = '<div class="an-cmp" role="table" aria-label="Рівні браку: цей період і попередній"><div class="an-cmp__h" role="row"><span></span><span>цей період · ' + X.dn(n) + '</span><span>попередні ' + X.dn(n) + '</span></div>' +
      LV.map(function (k) { return '<div class="an-cmp__r" role="row">' + h.lvl(k) + '<span>' + cellOf(t, k) + '</span><span>' + cellOf(L.prev, k) + '</span></div>'; }).join('') +
      '<div class="an-cmp__r an-cmp__r--sum" role="row"><span>усього браку</span><span><b>' + h.num(tot) + ' шт</b></span><span><b>' + h.num(pt) + ' шт</b></span></div></div>' +
      '<p class="hint">Попередні ' + X.dn(n) + ' — це ' + esc(A.span(L.prevFrom, L.prevTo)) + '.</p>';
    var byDept = r.department ? '' : '<div class="an-bydept"><p class="group-label" style="padding:0">По відділах · клік — сторінка відділу</p>' + L.depts.map(function (d) {
      var s = A.total(d.levels);
      return '<button class="lvl-row an-lvl an-lvlbtn" type="button" data-act="an-dep" data-id="' + esc(d.id) + '"><span>' + esc(d.name) + '</span>' + h.stack(d.levels, 14) +
        '<span class="lvl-row__n">' + (s ? h.num(s) + ' шт · зламане ' + A.share(d.levels, 'scrap') + '%' : 'браку немає') + '</span></button>';
    }).join('') + '</div>';
    box.innerHTML = head + '<div class="kpis an-kpis3" style="grid-template-columns:repeat(3,minmax(0,1fr))">' + LV.map(function (k) {
      return '<div class="kpi"><span class="kpi__val" style="color:' + A.LV_COLOR[k] + '">' + (tot ? A.share(t, k) + '%' : '—') + '</span><span class="kpi__label">' +
        esc(P.sr.LEVELS[k]) + ' · ' + h.num(t[k]) + ' шт · ' + A.LV_NEXT[k] + '</span></div>'; }).join('') + '</div>' + h.stack(t) + cmp + byDept;
  }

  function topCard(view) {
    var r = view.data, dep = r.department, types = r.top.types, shown = ui.top ? types.slice(0, ui.top) : types, max = types.length ? types[0].pieces : 1;
    var q = dep ? '?dep=' + encodeURIComponent(dep.id) : '';
    view.box('an-top').innerHTML = '<div class="card-head" style="flex-wrap:wrap"><div style="flex:1;min-width:220px"><h2 class="card-title">Що бракує найчастіше · ' + esc(view.scope()) + A.q('sr.an.top') + '</h2>' +
      '<p class="hint">' + esc(A.span(r.from, r.to)) + ' · ' + A.n(types.length, 'вид', 'види', 'видів') + ' браку · ' + h.num(r.top.pieces) + ' шт' +
      (dep ? ' · брак, зарахований відділу «' + esc(dep.name) + '»' : '') + ' · біля виду — його рівень і частка від усіх цих штук · клік — екран виду браку</p></div>' +
      '<span class="pills" role="group" aria-label="Скільки видів показати">' + [[10, 'Топ 10'], [30, 'Топ 30'], [0, 'Усі']].map(function (x) {
        return '<button class="pill' + (ui.top === x[0] ? ' pill--on' : '') + '" type="button" data-act="an-top" data-n="' + x[0] + '" aria-pressed="' + (ui.top === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</span></div>' +
      (types.length ? '<div class="an-toplist">' + shown.map(function (t, i) {
        return A.hbar({ rank: i + 1, name: t.name, sub: h.lvl(t.level) + '<span>' + h.pct(X.pctOf(t.pieces, r.top.pieces)) + ' від ' + h.num(r.top.pieces) + ' шт</span>' + (dep ? '' : '<span>' + esc(t.depts.join(', ')) + '</span>'),
          share: t.pieces / max, n: t.pieces, href: '#/analytics/defect/' + encodeURIComponent(t.id) + q });
      }).join('') + '</div>' + (shown.length < types.length ? '<p class="hint">Показано ' + shown.length + ' з ' + types.length + '.</p>' : '')
        : h.empty('Браку за період не знайдено', view.scope() + ' · ' + A.span(r.from, r.to)));
  }

  X.period = {
    draw: function (view) { summary(view); daysCard(view); levelsCard(view); topCard(view); },
    bind: function (view) {
      var ctx = view.ctx;
      ctx.on('an-unit', function (t) { ui.unit = t.getAttribute('data-v'); daysCard(view); });
      ctx.on('an-unpick', function () { ui.day = ui.range = null; if (chart) chart.clear(); drawPick(view); });
      ctx.on('an-top', function (t) { ui.top = +t.getAttribute('data-n'); topCard(view); });
    }
  };
})(window);
