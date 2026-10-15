(function (root) {
  'use strict';
  var P = root.P, h = P.sr.h, esc = P.esc, A = P.srAn;
  var STEP = 50, TOP = 5;   // TOP — скільки видів браку видно без гортання
  var LV = ['fix', 'repair', 'scrap'];
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  var KEYS = { dep: 'deps', product: 'product', defect: 'defect', worker: 'worker', auditor: 'auditor', q: 'q', mode: 'mode', order: 'order', d1: 'd1', d2: 'd2' };
  var hf = blank();
  var pin = null;   // день, зафіксований кліком на графіку: це НЕ фільтр, лише «тримати числа цього дня на екрані»
  function blank() { return { deps: [], product: '', defect: '', worker: '', auditor: '', q: '', mode: '', order: '', d1: '', d2: '', limit: STEP }; }

  function fromQuery(q) {
    if (!q.day && !q.from && !q.to && !Object.keys(KEYS).some(function (k) { return q[k]; })) return;
    hf = blank(); pin = null;
    Object.keys(KEYS).forEach(function (k) { if (q[k]) hf[KEYS[k]] = k === 'dep' ? q[k].split(',') : q[k]; });
    if (q.day && !hf.d1 && !hf.d2) hf.d1 = hf.d2 = q.day;
    hf.d1 = hf.d1 || hf.d2; hf.d2 = hf.d2 || hf.d1;
    if (hf.d1 > hf.d2) { var t = hf.d1; hf.d1 = hf.d2; hf.d2 = t; }
  }
  function syncUrl() {
    var parts = [];
    Object.keys(KEYS).forEach(function (k) { var v = hf[KEYS[k]]; if (k === 'dep') v = v.join(','); if (v) parts.push(k + '=' + encodeURIComponent(v)); });
    try { root.history.replaceState(null, '', '#/history' + (parts.length ? '?' + parts.join('&') : '')); } catch (e) { /* без історії — не страшно */ }
  }
  function payload(ctx) {
    return { locationId: ctx.loc.id, from: ctx.period.from, to: ctx.period.to, departments: hf.deps, product: hf.product, defect: hf.defect,
      workerCode: hf.worker, auditorId: hf.auditor, search: hf.q, mode: hf.mode, dayFrom: hf.d1, dayTo: hf.d2, orderNo: hf.order, limit: hf.limit };
  }

  function spanShort(a, b) { return a === b || a.slice(0, 7) !== b.slice(0, 7) ? A.span(a, b) : +a.slice(8) + ' — ' + A.span(b, b); }
  function daysChip(a, b) { return a === b ? A.dshort(a) : (a.slice(0, 7) === b.slice(0, 7) ? String(+a.slice(8)) : h.dayShort(a)) + '–' + h.dayShort(b); }
  function share(part, whole) { return whole ? Math.round(part / whole * 1000) / 10 : null; }
  function modeText(r) { return { defects: 'з браком', clean: 'без браку', over: 'понад норму ' + r.criticalPct + '%' }[hf.mode] || ''; }
  function sumDays(list) {
    var s = { audits: 0, matched: 0, checked: 0, rejected: 0, levels: { fix: 0, repair: 0, scrap: 0 } };
    list.forEach(function (d) {
      s.audits += d.audits; s.matched += d.matched; s.checked += d.checked; s.rejected += d.rejected;
      LV.forEach(function (k) { s.levels[k] += d.levels[k] || 0; });
    });
    return s;
  }
  function dayFacts(s, df) {
    if (!s.audits) return 'аудитів у вибірці не було';
    return A.n(s.audits, 'аудит', 'аудити', 'аудитів') + (df ? ', із них з цим видом браку — ' + h.num(s.matched) : '') + ' · перевірено ' + h.num(s.checked) + ' шт · ' +
      (df ? '«' + df.name + '»' : 'брак') + ' ' + h.num(s.rejected) + ' шт · ' + h.pct(share(s.rejected, s.checked));
  }

  var MARK = '<span class="hs-mark">обрано</span>';   // видно лише в зміненого фільтра (.hs-f--on)
  function select(k, label, all, opts) {
    return '<label class="field hs-f' + (hf[k] ? ' hs-f--on' : '') + '"><span class="label">' + label + MARK + '</span><select class="input" data-change="hs-sel" data-k="' + k + '">' +
      '<option value="">' + all + '</option>' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (hf[k] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
  }
  function pickedList(r) {
    var p = [], o = r.options;
    function name(list, key, id, fb) { var x = list.filter(function (i) { return i[key] === id; })[0]; return x ? x.name : fb; }
    if (hf.deps.length) p.push(['deps', hf.deps.length > 1 ? 'Відділи' : 'Відділ', r.departments.filter(function (d) { return hf.deps.indexOf(d.id) >= 0; }).map(function (d) { return d.name; }).join(', ')]);
    if (hf.product) p.push(['product', 'Виріб', hf.product]);
    if (hf.defect) p.push(['defect', 'Вид браку', hf.defect]);
    if (hf.worker) p.push(['worker', 'Працівник', name(o.workers, 'code', hf.worker, 'невідомий')]);
    if (hf.auditor) p.push(['auditor', 'Аудитор', name(o.auditors, 'id', hf.auditor, 'невідомий')]);
    if (hf.order) p.push(['order', 'Замовлення', hf.order]);
    if (hf.q) p.push(['q', 'Пошук', '«' + hf.q + '»']);
    if (hf.mode) p.push(['mode', 'Лише аудити', modeText(r)]);
    if (hf.d1) p.push(['days', hf.d1 === hf.d2 ? 'День' : 'Дні', daysChip(hf.d1, hf.d2)]);
    return p;
  }
  function pickedHtml(r) {
    var p = pickedList(r);
    if (!p.length) return '';
    return '<div class="hs-picked"><span class="hs-picked__t">Обрано:</span>' + p.map(function (x) {
      return '<span class="chip hs-pchip"><span><span class="hs-pchip__k">' + x[1] + ' — </span>' + esc(x[2]) + '</span>' +
        '<button class="chip__x" type="button" data-act="hs-x" data-k="' + x[0] + '" aria-label="Зняти фільтр «' + x[1] + '»">' + h.ic('close', 'ui-icon--sm') + '</button></span>';
    }).join('') + '<button class="btn btn--secondary btn--sm hs-reset" type="button" data-act="hs-reset">' + h.ic('close', 'ui-icon--sm') +
      'Скинути ' + A.n(p.length, 'фільтр', 'фільтри', 'фільтрів') + '</button></div>';
  }
  function filters(r) {
    var o = r.options;
    return '<section class="card" aria-label="Фільтри"><div class="field hs-f' + (hf.deps.length ? ' hs-f--on' : '') + '"><span class="label">Відділи' + MARK +
      ' <span class="hs-note">(можна кілька)</span></span>' +
      '<div class="chips" role="group" aria-label="Відділи"><button class="chip-pick hs-chip hs-chip--all' + (hf.deps.length ? '' : ' chip-pick--on') + '" type="button" data-act="hs-dep" data-id="">Усі</button>' +
      r.departments.map(function (d) {
        var on = hf.deps.indexOf(d.id) >= 0;
        return '<button class="chip-pick hs-chip' + (on ? ' chip-pick--on' : '') + '" type="button" data-act="hs-dep" data-id="' + esc(d.id) + '" aria-pressed="' + on + '">' +
          (on ? h.ic('check', 'ui-icon--sm') : '') + esc(d.name) + '<small>' + d.count + '</small></button>'; }).join('') + '</div></div>' +
      '<div class="hs-frow">' +
      select('product', 'Виріб', 'Усі вироби', o.products.map(function (x) { return [x, x]; })) +
      select('defect', 'Вид браку', 'Усі види браку', o.defects.map(function (x) { return [x, x]; })) +
      select('worker', 'Працівник', 'Усі працівники', o.workers.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'uk'); }).map(function (w) { return [w.code, w.name]; })) +
      select('auditor', 'Аудитор', 'Усі аудитори', o.auditors.map(function (u) { return [u.id, u.name]; })) +
      '<label class="field hs-f hs-f--q' + (hf.q ? ' hs-f--on' : '') + '"><span class="label">Пошук' + MARK + '</span><span class="search">' + h.ic('search', 'icon') +
      '<input class="input" data-input="hs-q" value="' + esc(hf.q) + '" placeholder="AUD-…, виріб, № замовлення, працівник"></span></label></div>' +
      '<div class="hs-modes" role="group" aria-label="Лише аудити"><span class="label">Лише аудити:' + A.q('sr.hs.modes') + '</span>' +
      [['defects', 'з браком'], ['clean', 'без браку'], ['over', 'понад норму ' + r.criticalPct + '%']].map(function (m) {
        var on = hf.mode === m[0];
        return '<button class="chip-pick hs-chip' + (on ? ' chip-pick--on' : '') + '" type="button" data-act="hs-mode" data-v="' + m[0] + '" aria-pressed="' + on + '">' + (on ? h.ic('check', 'ui-icon--sm') : '') + m[1] + '</button>';
      }).join('') + '</div><div id="hs-picked">' + pickedHtml(r) + '</div></section>';
  }

  function summary(r) {
    var an = r.analytics, df = an.defect, rng = !!r.dayFrom;
    var when = rng ? (r.dayFrom === r.dayTo ? A.dcap(r.dayFrom) : spanShort(r.dayFrom, r.dayTo) + ' · ' + A.n(A.diff(r.dayFrom, r.dayTo) + 1, 'день', 'дні', 'днів')) + ' · обрано на графіку'
      : A.span(r.from, r.to) + ' · увесь період';
    var facts = (hf.mode ? '<span class="hs-fact">Лише аудити ' + esc(modeText(r)) + ': <b>' + h.num(an.selAudits) + ' з ' + h.num(an.modeTotal) + '</b></span>' : '') +
      (df ? '<span class="hs-fact">Брак рахується лише за видом <b>«' + esc(df.name) + '»</b></span>' : '');
    var div = h.num(an.rejected) + ' шт ÷ ' + h.num(an.checked) + ' перевірених';
    var kpis = df
      ? '<div class="kpis hs-kpis hs-kpis--4">' +
        h.kpi(h.num(an.audits), P.plural(an.audits, 'аудит', 'аудити', 'аудитів') + ' з цим видом браку · з ' + h.num(an.selAudits) + ' у вибірці') +
        A.kpi(h.num(an.checked), 'перевірено, шт · в усій вибірці (' + A.n(an.selAudits, 'аудит', 'аудити', 'аудитів') + ')', 'term.checked') +
        A.kpi(h.num(an.rejected), '«' + df.name + '», шт', 'term.rejected', an.rejected ? 'danger' : '') +
        A.kpi(h.pct(an.pct), 'брак, % = ' + div, 'term.rate') + '</div>'
      : '<div class="kpis hs-kpis">' +
        A.kpi(h.num(an.audits), P.plural(an.audits, 'аудит', 'аудити', 'аудитів') + ' · у ' + an.daysWithAudits + ' ' + P.plural(an.daysWithAudits, 'дні', 'днях', 'днях') + ' з ' + an.workDays + ' робочих', 'sr.hs.audits') +
        A.kpi(h.num(an.checked), 'перевірено, шт', 'term.checked') + A.kpi(h.num(an.rejected), 'брак, шт', 'term.rejected', an.rejected ? 'danger' : '') +
        A.kpi(h.pct(an.pct), 'брак, % = ' + div, 'term.rate') +
        A.kpi(h.num(an.over), P.plural(an.over, 'аудит', 'аудити', 'аудитів') + ' понад норму ' + r.criticalPct + '% · ' + (an.audits ? Math.round(an.over / an.audits * 100) : 0) + '% аудитів вибірки', 'sr.hs.over', an.over ? 'danger' : '') + '</div>';
    var chart = '<div class="col--wide hs-chartcol"><div><h3 class="card-title hs-h3">' + (df ? '«' + esc(df.name) + '»' : 'Брак у вибірці') + ' по днях, шт' + A.q('sr.hs.chart') + '</h3>' +
      '<p class="hint">' + esc(A.span(r.from, r.to)) + ' · колір — рівень браку</p></div>' +
      '<div class="legend">' + LV.map(function (k) { return h.lvl(k); }).join('') + '<span class="hs-key-none">аудитів у вибірці не було</span></div>' +
      '<div data-chart="days"></div><div id="hs-sel" class="hs-sel"></div></div>';
    var tmax = an.types.length ? an.types[0].pieces : 1, pickedType = df && an.types.some(function (t) { return t.name === df.name; });
    var types = '<div class="col hs-typescol"><div><h3 class="card-title hs-h3">Види браку у вибірці' + A.q('sr.hs.types') + '</h3>' +
      '<p class="hint">' + h.num(an.allRejected) + ' шт · ' + A.n(an.types.length, 'вид', 'види', 'видів') + ' браку · натисніть вид — числа й графік лише для нього, ще раз — зняти</p></div>' +
      (an.types.length ? A.levels(an.allLevels) + '<div class="hs-types' + (pickedType ? ' hs-types--picked' : '') + '"' + (an.types.length > TOP ? ' tabindex="0"' : '') + ' role="group" aria-label="Види браку у вибірці, від найчастішого">' +
        an.types.map(function (t, i) {
          var on = !!df && t.name === df.name;
          return A.hbar({ rank: i + 1, name: t.name, sub: (t.otherDepts.length ? 'рахується відділу: ' + esc(t.otherDepts.join(', ')) + ' · ' : '') + h.lvl(t.level), share: t.pieces / tmax, n: t.pieces,
            cols: '20px minmax(0, 1fr) minmax(0, 0.55fr) 36px', act: 'hs-defect', attrs: ' data-v="' + esc(t.name) + '" aria-pressed="' + on + '"' });
        }).join('') + '</div>' +
        (an.types.length > TOP ? '<p class="hint">Видно ' + TOP + ' найчастіших — ще ' + (an.types.length - TOP) + ' гортаються в цьому списку.</p>' : '')
        : '<p class="hint">У вибірці браку немає.</p>') + '</div>';
    return '<section class="card" aria-label="Числа вибірки"><div class="hs-head"><div><h2 class="card-title">Числа вибірки</h2><p class="hint">' + esc(when) + '</p></div>' +
      (facts ? '<div class="hs-facts">' + facts + '</div>' : '') + '</div>' + kpis + '<div class="row">' + chart + types + '</div></section>';
  }
  function table(r) {
    var df = r.analytics.defect, perDay = {}, rows = '', cur = null, cols = df ? 7 : 6;
    r.analytics.days.forEach(function (d) { perDay[d.day] = d.matched; });
    r.items.forEach(function (a) {
      if (a.day !== cur) {
        cur = a.day;
        rows += '<tr><th colspan="' + cols + '" class="hs-dayrow">' + esc(A.dcap(a.day)) + ' · ' + A.n(perDay[a.day] || 0, 'аудит', 'аудити', 'аудитів') + (df ? ' з цим видом браку' : '') + '</th></tr>';
      }
      var it = a.items, first = it[0] || { productName: '—' };
      rows += '<tr data-act="hs-open" data-id="' + esc(a.id) + '"' + (a.over ? ' class="exceed"' : '') + '><td><b>' + P.fmt.time(a.createdAt) + '</b><span class="sub">' +
        (a.auditorRole === 'senior_auditor' ? 'старший: ' : a.auditorRole === 'admin' ? 'адміністратор: ' : 'аудитор: ') + esc(a.auditorName) + '</span></td><td>' + esc(a.departmentName) + '</td>' +
        '<td>' + esc(first.productName + (first.orderNo ? ' · ' + first.orderNo : '')) + it.slice(1).map(function (x) { return '<span class="sub">' + esc(x.productName + (x.orderNo ? ' · ' + x.orderNo : '')) + '</span>'; }).join('') + '</td>' +
        '<td class="n">' + h.num(a.checked) + '</td>' + (df ? '<td class="n"><b>' + h.num(a.defectPieces) + '</b></td>' : '') +
        '<td class="n"><' + (df ? 'span' : 'b') + (a.over ? ' style="color:var(--danger)"' : '') + '>' + a.rejected + '</' + (df ? 'span' : 'b') + '><span class="sub">' + h.pct(a.pct) + (a.over ? ' · понад норму' : '') + '</span></td>' +
        '<td style="text-align:center;color:var(--text-2)">' + (a.photos || a.hasComment || a.edited ? '<span style="display:inline-flex;align-items:center;gap:10px">' +
          (a.photos ? '<span style="display:inline-flex;align-items:center;gap:4px" title="фото">' + h.ic('photo', 'ui-icon--sm') + a.photos + '</span>' : '') +
          (a.hasComment ? '<span title="є коментар">' + h.ic('feedback', 'ui-icon--sm') + '</span>' : '') +
          (a.edited ? '<span title="виправлено">' + h.ic('edit', 'ui-icon--sm') + '</span>' : '') + '</span>' : '<span style="color:var(--text-3)">—</span>') + '</td></tr>';
    });
    var left = r.total - r.items.length;
    return '<section class="card" style="gap:16px"><div class="tbl-box"><table class="tbl"><thead><tr><th>Дата й час</th><th>Відділ</th><th>Виріб · замовлення</th>' +
      '<th class="n">Перевірено, шт</th>' + (df ? '<th class="n">Цей вид браку, шт</th><th class="n">Увесь брак, шт' + A.q('sr.hs.rowRejected') + '</th>' : '<th class="n">Брак, шт' + A.q('sr.hs.rowRejected') + '</th>') +
      '<th style="text-align:center">Фото, коментар' + A.q('sr.hs.icons') + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">' + (left > 0 ? '<button class="btn btn--secondary" type="button" data-act="hs-more">' + h.ic('chevron-down') + 'Показати ще ' + Math.min(left, STEP) + '</button>' : '') +
      '<p class="hint">Натисніть рядок — аудит збоку: перевірка, брак, фото, виправлення й видалення.</p></div></section>';
  }
  function results(r) {
    var counts = '<div class="hs-counts"><span><b style="font-variant-numeric:tabular-nums">' + h.num(r.total) + '</b> ' +
      P.plural(r.total, 'аудит знайдено', 'аудити знайдено', 'аудитів знайдено') + '</span>' +
      h.badge('з ' + r.base + (hf.deps.length ? ' у вибраних відділах' : '') + ' за період') + A.q('sr.hs.found') +
      (r.over ? '<span class="badge badge--danger">' + h.ic('warning', 'ui-icon--sm') + 'понад норму ' + r.criticalPct + '% — ' + r.over + '</span>' : '') +
      (r.total ? '<span class="hint" style="margin-left:auto">показано ' + r.items.length + ' · найновіші вгорі</span>' : '') + '</div>';
    if (!r.total) {
      var n = pickedList(r).length;
      return counts + '<section class="card">' + P.state.empty('search', 'Аудитів не знайдено', (n ? 'Обрано ' + A.n(n, 'фільтр', 'фільтри', 'фільтрів') + ' · ' : '') + 'період ' + A.span(r.from, r.to),
        n ? '<button class="btn btn--secondary btn--sm" type="button" data-act="hs-reset">Скинути фільтри</button>' : '') + '</section>' + trash(r);
    }
    return counts + summary(r) + table(r) + trash(r);
  }
  function trash(r) {
    if (!r.trash.length) return '';
    return '<section class="card"><div class="card-head"><div style="flex:1"><h2 class="card-title">' + h.ic('delete', 'ui-icon--sm') + ' Корзина · ' + r.trash.length + '</h2>' +
      '<p class="hint">Видалені аудити ніде не рахуються. Повернути можна 30 днів після видалення — потім вони зникають назавжди.</p></div></div><div class="list">' +
      r.trash.map(function (t) {
        var a = t.audit;
        return '<div class="row-item"><span class="row-item__main"><span class="row-item__title">' + esc(A.dshort(a.day)) + ' · ' + P.fmt.time(a.createdAt) + ' · ' + esc(a.departmentName) + ' · ' + esc(a.products.join(', ')) + '</span>' +
          '<span class="row-item__meta">' + esc(t.id) + ' · перевірено ' + h.num(a.checked) + ' шт · брак ' + a.rejected + ' шт · видалив(ла) ' + esc(t.byName) + ' ' + esc(P.fmt.dateTime(t.deletedAt)) +
          (t.reason ? ' · причина: ' + esc(t.reason) : '') + '</span></span>' +
          '<button class="btn btn--secondary btn--sm" type="button" data-act="hs-restore" data-id="' + esc(t.id) + '">' + h.ic('refresh', 'ui-icon--sm') + 'Повернути</button></div>';
      }).join('') + '</div></section>';
  }

  function fitTypes(box) {
    var list = box.querySelector('.hs-types'), rows = list ? list.children : [];
    if (rows.length <= TOP) return;
    var hgt = Math.round(rows[TOP].getBoundingClientRect().top - rows[0].getBoundingClientRect().top);
    list.style.maxHeight = (hgt > 60 ? hgt : 290) + 'px';   // не виміряли (екран схований) — запасна висота
    var on = list.querySelector('[aria-pressed="true"]');
    if (on && on.offsetTop + on.offsetHeight > list.offsetTop + list.clientHeight) list.scrollTop = on.offsetTop - list.offsetTop;
  }

  P.sr.screen('/history', { tab: 'history', title: 'Історія аудитів', render: function (ctx) {
    fromQuery(ctx.query || {});
    var timer = null, req = 0;
    var data = null;    // остання відповідь сервера
    var chart = null;   // контролер графіка (P.srChart.mount)
    var sig = '';       // «відбиток» даних графіка: не змінився — графік не перемальовуємо (обраний діапазон і плашка не блимають)

    function tipHtml(an, list, title, sub) {
      var s = sumDays(list), df = an.defect;
      return P.srChart.tipDay({ title: title, sub: [sub, df ? '«' + df.name + '»' : ''].filter(Boolean).join(' · '), none: s.audits ? null : 'Аудитів у вибірці не було',
        audits: s.audits, checked: s.checked, rejected: s.rejected, pct: share(s.rejected, s.checked),
        levels: df && df.level ? null : s.levels,   // один вид браку має один рівень — замість трьох рядків пишемо його словом
        rows: df ? [['Аудитів із цим видом', h.num(s.matched)]].concat(df.level ? [['Рівень', P.sr.LEVELS[df.level]]] : []) : [] });
    }
    function mountChart(slot, r) {
      var an = r.analytics;
      return P.srChart.mount(slot, {
        items: an.days.map(function (d) { return { key: d.day, x: h.dayShort(d.day), v: d.rejected, levels: d.levels, none: !d.audited, d: d }; }),
        height: 300, label: (an.defect ? '«' + an.defect.name + '»' : 'Брак у вибірці') + ' по днях, шт, за рівнями браку',
        tip: function (it) { return tipHtml(an, [it.d], A.dcap(it.key)); },
        tipRange: function (list, a, b) { return tipHtml(an, list.map(function (x) { return x.d; }), spanShort(a.key, b.key), A.n(list.length, 'день', 'дні', 'днів')); },
        pin: hf.d1 ? null : pin, range: hf.d1 ? [hf.d1, hf.d2] : null,
        onPin: function (it) {
          pin = it ? it.key : null;
          if (it && hf.d1) { hf.d1 = hf.d2 = ''; change(); return; }   // клік по іншому дню зняв діапазон на графіку — знімаємо й фільтр «Дні»
          drawSel();
        },
        onRange: function (a, b) {
          if (a) { pin = null; hf.d1 = a.key; hf.d2 = b.key; change(); }
          else if (hf.d1) { hf.d1 = hf.d2 = ''; change(); }
        } });
    }
    function drawSel() {
      var el = ctx.el.querySelector('#hs-sel');
      if (!el || !data) return;
      var days = data.analytics.days, df = data.analytics.defect, html, s;
      if (pin && !days.some(function (d) { return d.day === pin; })) pin = null;   // період змінили — того дня на графіку вже немає
      if (hf.d1) {
        s = sumDays(days.filter(function (d) { return d.day >= hf.d1 && d.day <= hf.d2; }));
        var one = hf.d1 === hf.d2;
        html = '<p class="hs-sel__t"><b>' + esc(one ? A.dcap(hf.d1) : spanShort(hf.d1, hf.d2)) + '</b>' + (one ? '' : ' · ' + A.n(A.diff(hf.d1, hf.d2) + 1, 'день', 'дні', 'днів')) + ' · ' + esc(dayFacts(s, df)) + '</p>' +
          '<button class="btn btn--secondary btn--sm" type="button" data-act="hs-unrange">' + h.ic('close', 'ui-icon--sm') + (one ? 'Зняти день' : 'Зняти діапазон') + '</button>';
      } else if (pin) {
        s = sumDays(days.filter(function (d) { return d.day === pin; }));
        html = '<p class="hs-sel__t"><b>' + esc(A.dcap(pin)) + '</b> · ' + esc(dayFacts(s, df)) + '</p>' +
          (s.matched ? '<button class="btn btn--primary btn--sm" type="button" data-act="hs-showday">Показати аудити цього дня</button>' : '') +
          '<button class="btn btn--quiet btn--sm" type="button" data-act="hs-unpin">Зняти</button>';
      } else html = '<p class="hint">Наведіть або торкніться стовпчика — числа дня · натисніть — закріпити · проведіть по кількох — ці дні стануть фільтром «Дні»</p>';
      el.className = 'hs-sel' + (hf.d1 || pin ? ' hs-sel--on' : '');
      el.innerHTML = html;
    }
    function paint(r) {
      data = r;
      var box = ctx.el.querySelector('#hs-res');
      var next = r.total ? JSON.stringify([r.analytics.days, r.analytics.defect && r.analytics.defect.name]) : '';
      var keep = chart && next && next === sig ? chart.el : null;
      if (keep && keep.parentNode) keep.parentNode.removeChild(keep);
      box.style.opacity = ''; box.innerHTML = results(r);
      var slot = box.querySelector('[data-chart="days"]');
      if (slot && keep) {
        slot.parentNode.replaceChild(keep, slot);
        if (hf.d1) chart.setRange(hf.d1, hf.d2); else if (pin) chart.setPin(pin); else chart.clear();   // вибір могли зняти кнопкою чи хрестиком
      } else chart = slot ? mountChart(slot, r) : null;
      sig = next;
      drawSel(); fitTypes(box);
    }
    function load(first, keep) {
      syncUrl();
      var my = ++req, box = ctx.el.querySelector('#hs-res');
      if (box && !first) box.style.opacity = '.55';
      P.srv('srHistory', payload(ctx)).then(function (r) {
        if (!ctx.alive() || my !== req) return;
        if (!r.ok) { ctx.el.innerHTML = h.error(r); chart = null; sig = ''; return; }
        var known = hf.deps.filter(function (id) { return r.departments.some(function (d) { return d.id === id; }); });
        if (known.length !== hf.deps.length) { hf.deps = known; syncUrl(); }
        if (hf.d1 && !r.dayFrom && DAY_RE.test(hf.d1) && DAY_RE.test(hf.d2)) P.toast('info', 'Фільтр «Дні» знято', 'Обрані дні — поза періодом ' + A.span(r.from, r.to) + '.');
        if ((hf.d1 || '') !== (r.dayFrom || '') || (hf.d2 || '') !== (r.dayTo || '')) { hf.d1 = r.dayFrom || ''; hf.d2 = r.dayTo || ''; syncUrl(); }
        if (first || !ctx.el.querySelector('#hs-res')) { ctx.el.innerHTML = '<div id="hs-filters"></div><div id="hs-res" class="hs-res"></div>'; chart = null; sig = ''; }
        var fbox = ctx.el.querySelector('#hs-filters');
        if (!keep || !fbox.innerHTML) fbox.innerHTML = filters(r);
        else fbox.querySelector('#hs-picked').innerHTML = pickedHtml(r);   // рядок «Обрано» оновлюємо завжди
        paint(r);
      });
    }
    function change() { hf.limit = STEP; load(); }
    load(true);
    ctx.on('hs-dep', function (t) {
      var id = t.getAttribute('data-id');
      if (!id) hf.deps = []; else if (hf.deps.indexOf(id) >= 0) hf.deps = hf.deps.filter(function (x) { return x !== id; }); else hf.deps.push(id);
      change();
    });
    ctx.on('hs-sel', function (t) { hf[t.getAttribute('data-k')] = t.value; change(); });
    ctx.on('hs-q', function (t) {
      t.closest('.hs-f').classList.toggle('hs-f--on', !!t.value.trim());
      clearTimeout(timer); timer = setTimeout(function () { hf.q = t.value.trim(); hf.limit = STEP; load(false, true); }, 300);
    });
    ctx.on('hs-mode', function (t) { var v = t.getAttribute('data-v'); hf.mode = hf.mode === v ? '' : v; change(); });
    ctx.on('hs-x', function (t) {
      var k = t.getAttribute('data-k');
      if (k === 'deps') hf.deps = []; else if (k === 'days') hf.d1 = hf.d2 = ''; else hf[k] = '';
      change();
    });
    ctx.on('hs-reset', function () { hf = blank(); pin = null; change(); });
    ctx.on('hs-defect', function (t) { var v = t.getAttribute('data-v'); hf.defect = hf.defect === v ? '' : v; change(); });
    ctx.on('hs-showday', function () { if (!pin) return; hf.d1 = hf.d2 = pin; pin = null; change(); });
    ctx.on('hs-unpin', function () { pin = null; if (chart) chart.clear(); drawSel(); });
    ctx.on('hs-unrange', function () { hf.d1 = hf.d2 = ''; change(); });
    ctx.on('hs-more', function () { hf.limit += STEP; load(false, true); });
    ctx.on('hs-open', function (t) { P.srChart.hide(); P.srHist.openAudit(t.getAttribute('data-id')); });
    ctx.on('hs-restore', function (t) {
      t.disabled = true;
      P.srv('srAuditRestore', { id: t.getAttribute('data-id') }).then(function (r) {
        if (!r.ok) { t.disabled = false; P.toast('danger', 'Не вдалося повернути', r.error); return; }
        P.toast('ok', 'Аудит повернуто · ' + r.id, 'Він знову рахується в аналітиці й історії.');
        P.emit('kd:changed'); load(false, true);
      });
    });
  } });
})(window);
