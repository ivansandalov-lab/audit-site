(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, K = P.mgr;
  var SORTS = [['pct', 'За % браку'], ['checked', 'За перевіреними, шт']];
  var WEEKLY_FROM = 46;   // з такої довжини періоду (днів) графік панелі — по тижнях, а не по днях
  var FIRST_PRODUCTS = 8, FIRST_DEFECTS = 10;   // скільки рядків панелі видно до «Показати всі»
  var KD_ORDER = ['pre', 'decide', 'over', 'work', 'watch', 'hold', 'done', 'part', 'relapse', 'skip'];
  var st = { sort: 'pct', locs: [], many: false, type: '' };

  function sorted(list) {
    return list.slice().sort(function (a, b) {
      if (st.sort === 'checked') return b.checked - a.checked || (a.name < b.name ? -1 : 1);
      if (a.pct == null || b.pct == null) return a.pct == null ? (b.pct == null ? b.checked - a.checked : 1) : -1;
      return b.pct - a.pct || b.checked - a.checked;
    });
  }
  function name(d) { return '<b>' + esc(d.name) + '</b>' + (d.active ? '' : ' ' + H.badge('вимкнено')); }
  function th(label, key, n) { return '<th' + (n ? ' class="n"' : '') + '>' + esc(label) + (key ? K.help(key) : '') + '</th>'; }
  function chev() { return P.ic('chevron-right', 'ui-icon--sm mgr-chev'); }
  function opener(d, open, inner, ph) {
    return '<button class="mgr-open" type="button" data-act="mgr-d-open" data-id="' + esc(d.id) + '" aria-expanded="' + open + '"' + (open ? ' aria-controls="' + slotId(d, ph) + '"' : '') +
      ' aria-label="' + esc((open ? 'Згорнути: ' : 'Розгорнути: ') + d.name + (d.locationName ? ' · ' + d.locationName : '')) + '">' + chev() + inner + '</button>';
  }

  function table(list, crit, open) {
    return '<div class="tbl-box mgr-desk"><table class="tbl mgr-tbl mgr-dtbl"><thead><tr><th class="n">№</th><th>Відділ</th>' + th('Аудитів', 'term.audit', 1) +
      th('Перевірено, шт', 'term.checked', 1) + th('Брак, шт', 'mgr.deptBrak', 1) + th('Брак, %', 'term.rate', 1) + th('Рівні браку', 'term.levels') +
      th('Найчастіші види браку', 'mgr.top') + '</tr></thead><tbody>' +
      list.map(function (d, i) {
        var on = open === d.id;
        return '<tr class="mgr-drow' + (on ? ' sel' : '') + '" data-act="mgr-d-open" data-id="' + esc(d.id) + '" data-row="' + esc(d.id) + '"><td class="n mgr-dim">' + (i + 1) + '</td>' +
          '<td>' + opener(d, on, '<b>' + esc(d.name) + '</b>', false) + (d.active ? '' : ' ' + H.badge('вимкнено')) + '</td><td class="n">' + H.num(d.audits) + '</td><td class="n">' + H.num(d.checked) + '</td>' +
          '<td class="n">' + H.num(d.rejected) + '</td><td class="n">' + K.rate(d.pct, crit) + '</td><td class="mgr-tbl__lv">' + H.stack(d.levels, 10) + '</td>' +
          '<td><span class="mgr-top">' + K.topLine(d.top) + '</span></td></tr>' +
          (on ? '<tr class="mgr-dprow"><td colspan="8">' + slot(d, false) + '</td></tr>' : '');
      }).join('') + '</tbody></table></div>';
  }
  function cards(list, crit, open) {
    return '<div class="mgr-cards mgr-phone">' + list.map(function (d, i) {
      var on = open === d.id;
      return '<article class="mgr-card mgr-dcard' + (on ? ' mgr-dcard--on' : '') + '" data-act="mgr-d-open" data-id="' + esc(d.id) + '" data-row="' + esc(d.id) + '">' +
        '<div class="mgr-card__head"><span class="rank">' + (i + 1) + '</span>' + opener(d, on, '<b>' + esc(d.name) + '</b>', true) + (d.active ? '' : H.badge('вимкнено')) + '</div>' +
        '<dl class="mgr-card__kv"><dt>Аудитів</dt><dd>' + H.num(d.audits) + '</dd><dt>Перевірено</dt><dd>' + H.num(d.checked) + ' шт</dd>' +
        '<dt>Брак, шт · брак, %' + K.help('term.rate') + '</dt><dd>' + H.num(d.rejected) + ' шт · ' + K.rate(d.pct, crit) + '</dd></dl>' + H.stack(d.levels, 8) +
        '<div class="mgr-top">' + K.topLine(d.top) + '</div></article>' + (on ? slot(d, true) : '');
    }).join('') + '</div>';
  }

  function compareRows(r, locs) {
    var rows = [], by = {};
    r.depts.forEach(function (d) {
      var k = d.deptTypeId + '|' + d.name;
      if (!by[k]) { by[k] = { name: d.name, type: d.deptTypeName, sub: d.deptTypeName !== d.name ? d.deptTypeName : '', cells: {} }; rows.push(by[k]); }
      by[k].cells[d.locationId] = d;
    });
    rows.sort(function (a, b) { return a.type < b.type ? -1 : a.type > b.type ? 1 : (a.name < b.name ? -1 : 1); });
    return rows.filter(function (x) { return locs.some(function (id) { return x.cells[id]; }); });
  }
  function cell(d, crit, open, ph) {
    if (!d) return '<span class="mgr-dim">такого відділу в локації немає</span>';
    return '<div class="mgr-cmpcell">' + opener(d, open === d.id, '<span class="mgr-cmpcell__pct">' + K.rate(d.pct, crit) + '</span>', ph) +
      '<span class="mgr-dim">брак ' + H.num(d.rejected) + ' з ' + H.num(d.checked) + ' шт · ' + K.n(d.audits, 'аудит', 'аудити', 'аудитів') + '</span>' +
      H.stack(d.levels, 6) + '<span class="mgr-top">' + K.topLine(d.top) + '</span>' + (d.active ? '' : H.badge('вимкнено')) + '</div>';
  }
  function openIn(x, locs, open) { var id = locs.filter(function (l) { return x.cells[l] && x.cells[l].id === open; })[0]; return id ? x.cells[id] : null; }
  function compare(r, locs, crit, open) {
    var rows = compareRows(r, locs), names = {};
    r.locations.forEach(function (l) { names[l.id] = l.name; });
    if (!rows.length) return '';
    function td(d) { return d ? '<td class="mgr-cmptd' + (open === d.id ? ' mgr-cmptd--on' : '') + '" data-act="mgr-d-open" data-id="' + esc(d.id) + '" data-row="' + esc(d.id) + '">' + cell(d, crit, open, false) + '</td>' : '<td>' + cell(null) + '</td>'; }
    return '<div class="tbl-box mgr-desk"><table class="tbl mgr-tbl mgr-cmptbl"><thead><tr><th>Відділ</th>' + locs.map(function (id) {
      return '<th>' + P.ic('location', 'ui-icon--sm') + ' ' + esc(names[id]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (x) {
        var od = openIn(x, locs, open);
        return '<tr><td><b>' + esc(x.name) + '</b><span class="mgr-dim mgr-block">' + esc(x.sub) + '</span></td>' +
          locs.map(function (id) { return td(x.cells[id]); }).join('') + '</tr>' +
          (od ? '<tr class="mgr-dprow"><td colspan="' + (locs.length + 1) + '">' + slot(od, false) + '</td></tr>' : '');
      }).join('') + '</tbody></table></div>' +
      '<div class="mgr-cards mgr-phone">' + rows.map(function (x) {
        var od = openIn(x, locs, open);
        return '<article class="mgr-card"><div class="mgr-card__head"><b>' + esc(x.name) + '</b><span class="mgr-dim">' + esc(x.sub) + '</span></div>' +
          locs.map(function (id) {
            var d = x.cells[id];
            return '<div class="mgr-cmpline' + (d ? ' mgr-dcard' + (open === d.id ? ' mgr-dcard--on' : '') : '') + '"' + (d ? ' data-act="mgr-d-open" data-id="' + esc(d.id) + '" data-row="' + esc(d.id) + '"' : '') + '>' +
              '<span class="mgr-cmpline__loc">' + P.ic('location', 'ui-icon--sm') + esc(names[id]) + '</span>' + cell(d, crit, open, true) + '</div>';
          }).join('') + '</article>' + (od ? slot(od, true) : '');
      }).join('') + '</div>';
  }

  function slotId(d, ph) { return (ph ? 'mgr-dpm-' : 'mgr-dp-') + esc(d.id); }
  function slot(d, ph) { return '<div class="mgr-dp" id="' + slotId(d, ph) + '" data-dpanel="' + esc(d.id) + '" role="region" aria-label="' + esc('Відділ ' + d.name + (d.locationName ? ' · ' + d.locationName : '')) + '"></div>'; }
  function days(n) { return K.n(n, 'день', 'дні', 'днів'); }
  function big(val, label, key, sub) {
    return '<div class="mgr-kdbig"><span class="mgr-kdbig__l">' + esc(label) + (key ? K.help(key) : '') + '</span><b class="mgr-kdbig__v">' + val + '</b>' +
      (sub ? '<span class="mgr-kdbig__s">' + sub + '</span>' : '') + '</div>';
  }
  function more(act, all, n) {
    return '<button class="btn btn--secondary btn--sm mgr-dp__more" type="button" data-act="' + act + '" aria-expanded="' + all + '">' + (all ? 'Згорнути список' : 'Показати всі ' + H.num(n)) + '</button>';
  }
  function head(dep, locName, sub) {
    return '<div class="mgr-dp__head"><div class="mgr-dp__ht"><h3 class="mgr-dp__t">' + esc(dep.name) + (locName ? ' <span class="mgr-dp__loc">' + P.ic('location', 'ui-icon--sm') + esc(locName) + '</span>' : '') + '</h3>' +
      (sub ? '<p class="hint">' + sub + '</p>' : '') + '</div>' +
      '<button class="btn btn--secondary btn--sm" type="button" data-act="mgr-d-open" data-id="' + esc(dep.id) + '">' + P.ic('chevron-up', 'ui-icon--sm') + 'Згорнути</button></div>';
  }
  function bigs(r) {
    var t = r.totals, n = t.norm, crit = r.criticalPct;
    return '<div class="mgr-dp__bigs">' + big(H.num(t.audits), 'Аудитів', 'term.audit') + big(H.num(t.checked), 'Перевірено, шт', 'term.checked') +
      big(H.num(t.rejected), 'Брак, шт', 'mgr.deptBrak') + big(K.rate(t.pct, crit), 'Брак, %', 'term.rate') +
      big(H.num(t.daysWithAudits) + ' <small>з ' + H.num(t.days) + '</small>', 'Днів з аудитами', 'mgr.daysWithAudits') +
      big(n.of ? H.num(n.ok) + ' <small>з ' + H.num(n.of) + '</small>' : '—', 'Днів з виконаною нормою вибірки', 'mgr.dept.normDays',
        n.target != null ? (n.of ? H.pct(n.pct) + ' · ' : '') + 'норма — ' + H.num(n.target) + ' шт на день' : 'норму вибірки не задано') + '</div>';
  }
  function chartItems(r) {
    var crit = r.criticalPct;
    if (r.days.length < WEEKLY_FROM) {
      return r.days.map(function (d) { return { key: d.day, x: H.dayShort(d.day), v: d.pct || 0, hot: d.pct > crit, none: !d.audits, d: d, title: K.dcap(d.day) }; });
    }
    var out = [];
    for (var i = 0; i < r.days.length; i += 7) {
      var part = r.days.slice(i, i + 7), o = { audits: 0, checked: 0, rejected: 0 };
      part.forEach(function (d) { o.audits += d.audits; o.checked += d.checked; o.rejected += d.rejected; });
      o.pct = o.checked > 0 ? Math.round(o.rejected / o.checked * 1000) / 10 : null;
      var a = part[0].day, b = part[part.length - 1].day;
      out.push({ key: a, x: H.dayShort(a), v: o.pct || 0, hot: o.pct > crit, none: !o.audits, d: o, title: K.span(a, b) });
    }
    return out;
  }
  function chartSec(r) {
    var weekly = r.days.length >= WEEKLY_FROM;
    return '<section class="mgr-dp__sec mgr-dp__sec--wide"><div><h4 class="mgr-dp__st">Брак, % ' + (weekly ? 'по тижнях' : 'по днях') + K.help('mgr.dept.chart') + '</h4>' +
      '<p class="hint">' + (weekly ? 'Стовпчик — 7 днів від ' + esc(K.day(r.from)) + ' (останній може бути коротшим) · ' : '') + 'наведіть на стовпчик або торкніться — його числа</p></div>' +
      '<div class="legend"><span class="mgr-key"><i class="mgr-key__hot"></i>червоний — понад ' + r.criticalPct + '%</span>' +
      '<span class="mgr-key"><i class="mgr-key__dash"></i>норма — ' + r.criticalPct + '%' + K.help('mgr.kd.threshold') + '</span><span class="mgr-key"><i class="mgr-key__none"></i>аудитів у відділі не було</span></div>' +
      (r.totals.audits || r.totals.rejected ? '<div data-chart="dept"></div>' : '<p class="hint">Аудитів у відділі за період не було.</p>') + '</section>';
  }
  function mountChart(el, r, scope) {
    var box = el.querySelector('[data-chart="dept"]');
    if (!box) return;
    P.srChart.mount(box, {
      items: chartItems(r), height: root.innerWidth < 900 ? 180 : 220, label: 'Брак, % · ' + scope,
      line: { v: r.criticalPct, label: 'норма — ' + r.criticalPct + '%' },
      tip: function (it) {
        var d = it.d;
        return P.srChart.tip({ title: it.title, sub: scope, rows: [['Перевірено', H.num(d.checked) + ' шт'], ['Брак', H.num(d.rejected) + ' шт'],
          ['Брак, %', H.pct(d.pct), d.pct > r.criticalPct ? 'danger' : ''], ['Аудитів', H.num(d.audits)]] });
      }
    });
  }
  function productsSec(r, all) {
    var list = r.products, shown = all ? list : list.slice(0, FIRST_PRODUCTS), crit = r.criticalPct;
    var top = '<div><h4 class="mgr-dp__st">Вироби, які перевіряли · ' + H.num(list.length) + K.help('mgr.dept.products') + '</h4>' +
      '<p class="hint">Перевірено — штуки виробу в аудитах цього відділу; брак — штуки виробу з браком, який зробив цей відділ, хоч би де їх знайшли.</p></div>';
    if (!list.length) return '<section class="mgr-dp__sec">' + top + '<p class="hint">Виробів за період немає.</p></section>';
    return '<section class="mgr-dp__sec">' + top +
      '<div class="tbl-box mgr-desk"><table class="tbl mgr-tbl mgr-dp__tbl"><thead><tr><th>Виріб</th><th class="n">Перевірено, шт</th><th class="n">Брак, шт</th><th class="n">Брак, %</th>' +
      '<th class="n">Замовлень' + K.help('term.order') + '</th></tr></thead><tbody>' + shown.map(function (p) {
        return '<tr><td>' + esc(p.name) + '</td><td class="n">' + H.num(p.checked) + '</td><td class="n">' + H.num(p.rejected) + '</td><td class="n">' + K.rate(p.pct, crit) + '</td><td class="n">' + H.num(p.orders) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<ul class="mgr-dp__list mgr-phone">' + shown.map(function (p) {
        return '<li><b>' + esc(p.name) + '</b><span class="mgr-dp__nums">перевірено ' + H.num(p.checked) + ' шт · брак ' + H.num(p.rejected) + ' шт · ' + K.rate(p.pct, crit) +
          ' · замовлень ' + H.num(p.orders) + '</span></li>';
      }).join('') + '</ul>' + (list.length > FIRST_PRODUCTS ? more('mgr-d-allp', all, list.length) : '') + '</section>';
  }
  function defectsSec(r, all) {
    var list = r.defects, shown = all ? list : list.slice(0, FIRST_DEFECTS), lv = r.totals.levels;
    var top = '<div><h4 class="mgr-dp__st">Знайдені види браку · ' + H.num(list.length) + K.help('term.defectType') + '</h4>' +
      '<p class="hint">Частка — від усього браку, шт цього відділу за період (' + H.num(r.totals.rejected) + ' шт)</p></div>';
    if (!list.length) return '<section class="mgr-dp__sec">' + top + '<p class="hint">Браку за період не знайдено.</p></section>';
    return '<section class="mgr-dp__sec">' + top + '<div class="mgr-gap mgr-gap--sm"><p class="group-label" style="padding:0">Рівні браку · ' + H.num(K.total(lv)) + ' шт' + K.help('term.levels') + '</p>' + K.levels(lv, 12) + '</div>' +
      '<ol class="mgr-top10__l mgr-dp__defs">' + shown.map(function (t) {
        return '<li><span class="lvl lvl--' + esc(t.level) + '">' + esc(t.name) + '</span><b>' + H.num(t.pieces) + ' шт · ' + H.pct(t.share) + '</b>' +
          '<span class="mgr-top10__bar"><i class="s-' + esc(t.level) + '" style="width:' + (t.share || 0) + '%"></i></span></li>';
      }).join('') + '</ol>' + (list.length > FIRST_DEFECTS ? more('mgr-d-alld', all, list.length) : '') + '</section>';
  }
  function canon(s) { return P.sr.KD_STATES[s] ? s : P.sr.kdStateOf(s); }
  function day(v) { return v ? K.day(String(v).slice(0, 10)) : '—'; }
  function action(a) {
    var s = canon(a.state), d = a.daysToImplement;
    var noAfter = s === 'skip' || s === 'over' || s === 'pre' || s === 'decide';   // «після» не буде (дія не потрібна) або ще не впроваджено — лише «до»
    return '<article class="mgr-dact"><div class="mgr-dact__top">' + H.kdState(s, P.mgrKd.word(s)) + P.mgrKd.help(s) +
      (a.weekStart ? '<span class="mgr-dim">тиждень, через який відкрито: ' + esc(K.span(a.weekStart, a.weekEnd)) + '</span>' : '') + '</div>' +
      '<dl class="mgr-dact__kv"><dt>Відкрито</dt><dd>' + esc(day(a.openedAt)) + (a.early ? ' <span class="badge">достроково, посеред тижня</span>' + K.help('mgr.kd.early') +
        (a.earlyBelow ? '<span class="mgr-dim mgr-block">брак, % за весь тиждень: ' + H.pct(a.weekRate) + '</span>' : '') : '') + '</dd>' +
      '<dt>Впроваджено</dt><dd>' + (a.implementedAt ? esc(day(a.implementedAt)) + (d != null ? ' <span class="mgr-dim">· ' + (d ? 'через ' + days(d) + ' після відкриття' : 'того ж дня') + '</span>' : '') : '<span class="mgr-dim">' + (s === 'skip' ? 'дія не потрібна' : 'ще не впроваджено') + '</span>') + '</dd>' +
      '<dt>Причина браку' + K.help('mgr.kd.causes') + '</dt><dd>' + (a.cause ? esc(K.causeName(a.cause, a.cause)) : '<span class="mgr-dim">не записано</span>') + '</dd>' +
      '<dt>Брак, % відділу: до → після' + K.help('mgr.kd.beforeAfter') + '</dt><dd>' + H.ba(a.before, a.after, noAfter) + '</dd></dl>' +
      ((a.items || []).length ? '<div class="mgr-dact__items"><span class="mgr-dact__il">Види браку, з якими працює дія' + K.help('mgr.kd.items') + '</span>' + a.items.map(function (it) {
        return '<span class="mgr-dact__it"><span>' + esc(it.name) + '</span>' + H.ba(it.before, s === 'watch' ? null : it.after, noAfter) + '</span>';
      }).join('') + '</div>' : '') + '</article>';
  }
  function kdSec(r) {
    var k = r.kd, top = '<div><h4 class="mgr-dp__st">Коригуючі дії відділу' + (k ? ' · ' + H.num(k.actions.length) : '') + K.help('mgr.kd.action') + '</h4>';
    if (!k) return '<section class="mgr-dp__sec">' + top + '</div><p class="hint">Даних про коригуючі дії немає.</p></section>';
    var states = KD_ORDER.filter(function (s) { return k.states[s]; });
    var list = k.actions.slice().sort(function (a, b) { return String(b.openedAt) < String(a.openedAt) ? -1 : 1; });
    return '<section class="mgr-dp__sec">' + top + '<p class="hint">Коригуючі дії, які тривали хоча б частину цього періоду · стан — на сьогодні' +
      ' · за період: відкрито <b>' + H.num(k.opened) + '</b>, впроваджено <b>' + H.num(k.implemented) + '</b></p></div>' +
      (!list.length ? '<p class="hint">Коригуючих дій відділу за цей період не було.</p>'
        : '<div class="mgr-split__key">' + states.map(function (s) { return '<span class="mgr-split__i">' + H.kdState(s, P.mgrKd.word(s) + ' · ' + k.states[s]) + P.mgrKd.help(s) + '</span>'; }).join('') + '</div>' +
          '<div class="mgr-dacts">' + list.map(action).join('') + '</div>') + '</section>';
  }
  function peopleSec(r) {
    var top = '<div><h4 class="mgr-dp__st">Хто перевіряв · ' + H.num(r.auditors.length) + K.help('term.auditor') + '</h4><p class="hint">Аудитів і перевірено, шт — лише в цьому відділі за період</p></div>';
    if (!r.auditors.length) return '<section class="mgr-dp__sec">' + top + '<p class="hint">За період у відділі ніхто не записував аудитів.</p></section>';
    return '<section class="mgr-dp__sec">' + top + '<ul class="mgr-dp__list">' + r.auditors.map(function (a) {
      return '<li><span><b>' + esc(a.name) + '</b>' + (a.senior ? ' <span class="badge mgr-senior">старший</span>' : '') + (a.active ? '' : ' ' + H.badge('вимкнено')) + '</span>' +
        '<span class="mgr-dp__nums">' + K.n(a.audits, 'аудит', 'аудити', 'аудитів') + ' · ' + H.num(a.checked) + ' шт</span></li>';
    }).join('') + '</ul></section>';
  }
  function panel(r, many, allP, allD) {
    var sub = '<b>' + esc(K.span(r.from, r.to)) + '</b> · ' + K.dn(r.totals.days) + ' · ' + esc(K.asOf(r.asOf)) + (r.department.deptTypeName && r.department.deptTypeName !== r.department.name ? ' · ' + esc(r.department.deptTypeName) : '');
    return head(r.department, r.location ? r.location.name : '', sub) + bigs(r) +
      '<div class="mgr-dp__grid">' + chartSec(r) + productsSec(r, allP) + defectsSec(r, allD) + kdSec(r) + peopleSec(r) + '</div>';
  }

  P.cab.tab({ id: 'depts', label: 'Відділи', ic: 'department', path: '/depts', order: 20 });
  P.cab.screen('/depts', { tab: 'depts', title: 'Відділи', period: true, render: function (ctx) {
    var req = 0, last = null;
    var dp = { id: null, row: null, data: null, err: null, req: 0, allP: false, allD: false };
    function load() {
      var my = ++req, box = ctx.el.querySelector('#mgr-dl');
      if (box) box.classList.add('mgr-busy');   // фільтр змінили — старі числа тьмяніють, доки не прийдуть нові
      var p = { from: ctx.period.from, to: ctx.period.to, deptTypeId: st.type };
      if (st.locs.length) p.locationIds = st.locs;
      P.srv('mgrDepts', p).then(function (r) {
        if (!ctx.alive() || my !== req) return;
        if (!r.ok && (r.code === 'not_found' || r.code === 'validation') && (st.locs.length || st.type)) { st.locs = []; st.type = ''; load(); return; }   // вибір на те, чого вже немає
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        if (!st.locs.length) { st.locs = r.locations.length ? [r.locations[0].id] : []; if (st.locs.length) { load(); return; } }   // перший захід — перша локація
        last = r;
        if (dp.id && !r.depts.some(function (d) { return d.id === dp.id; })) close();   // відкритого відділу в новому списку немає
        draw(r);
      });
    }
    function draw(r) {
      var types = [['', 'Усі відділи']].concat(r.deptTypes.map(function (t) { return [t.id, t.name]; }));
      var many = st.many && st.locs.length > 1, names = r.locations.filter(function (l) { return st.locs.indexOf(l.id) >= 0; }).map(function (l) { return l.name; });
      var tname = st.type ? types.filter(function (t) { return t[0] === st.type; })[0][1] : 'усі відділи';
      var list = sorted(r.depts), scope = names.join(' · ') + ' · ' + tname;
      var body = many ? compare(r, st.locs, r.criticalPct, dp.id) : list.length ? table(list, r.criticalPct, dp.id) + cards(list, r.criticalPct, dp.id) : '';
      ctx.el.innerHTML = '<section class="mgr-page"><div><h2 class="h2">' + (many ? 'Порівняння локацій · ' + esc(tname) : 'Рейтинг відділів · ' + esc(names[0] || '') + ' · відділів: ' + list.length) + '</h2>' +
        '<p class="h2-sub">' + esc(K.span(r.from, r.to)) + ' · ' + esc(K.asOf(r.asOf)) + ' · брак рахується відділу, який його зробив, хоч би де його знайшли' + K.help('mgr.deptBrak') +
        ' · натисніть на відділ — розгорнеться все про нього' + K.help('mgr.dept.open') + '</p></div>' +
        '<div class="card mgr-gap mgr-gap--sm">' + K.locBar('mgr-d', r.locations, st.locs, st.many) +
        '<div class="mgr-pick"><span class="mgr-pick__l">Відділ' + K.help('mgr.deptPick') + '</span>' + K.chips('mgr-d-type', types, st.type, 'Відділ') + '</div>' +
        (many ? '' : '<div class="mgr-pick"><span class="mgr-pick__l">Порядок</span>' + K.pills('mgr-d-sort', SORTS, st.sort, 'Сортування') + '</div>') +
        (st.many && st.locs.length < 2 ? '<p class="hint">Оберіть ще одну локацію вище — вони стануть поруч.</p>' : '') + '</div>' +
        '<div id="mgr-dl" class="card">' + (body || H.empty('Відділів не знайдено', scope + ' · спробуйте інший відділ чи локацію.')) + '</div></section>';
      fill();
    }
    function fill() {
      var slots = ctx.el.querySelectorAll('[data-dpanel]');
      if (!slots.length || !dp.id) return;
      var row = dp.row || { id: dp.id, name: '' }, many = st.many && st.locs.length > 1;

      Array.prototype.forEach.call(slots, function (el) {
        if (dp.data) {
          el.innerHTML = panel(dp.data, many, dp.allP, dp.allD);
          mountChart(el, dp.data, dp.data.department.name + (dp.data.location ? ' · ' + dp.data.location.name : '') + ' · ' + K.span(dp.data.from, dp.data.to));
        } else if (dp.err) {
          el.innerHTML = head(row, many ? row.locationName : '', '') + '<div class="mgr-dp__msg"><p><b>Не вдалося завантажити відділ.</b> ' + esc(dp.err.error || '') + '</p>' +
            '<button class="btn btn--secondary btn--sm" type="button" data-act="mgr-d-retry">' + P.ic('refresh', 'ui-icon--sm') + 'Спробувати ще раз</button></div>';
        } else {
          el.innerHTML = head(row, many ? row.locationName : '', esc(K.span(ctx.period.from, ctx.period.to))) + '<div class="mgr-dp__msg">' + H.loading() + '</div>';
        }
      });
    }
    function request() {
      var my = ++dp.req, id = dp.id, p = { departmentId: id, from: ctx.period.from, to: ctx.period.to };
      if (dp.row && dp.row.locationId) p.locationId = dp.row.locationId;
      P.srv('mgrDeptDetail', p).then(function (r) {
        if (!ctx.alive() || my !== dp.req || dp.id !== id) return;
        if (r.ok) dp.data = r; else dp.err = r;
        fill();
      });
    }
    function close() { dp.id = null; dp.row = null; dp.data = null; dp.err = null; dp.req++; }
    function reveal(id) {
      var els = ctx.el.querySelectorAll('[data-row="' + (root.CSS && root.CSS.escape ? root.CSS.escape(id) : id) + '"]');
      Array.prototype.forEach.call(els, function (el) {
        if (!el.offsetParent) return;   // прихована версія (таблиця на телефоні чи картки на ПК)
        var top = el.getBoundingClientRect().top;
        if (top < 60 || top > root.innerHeight - 120) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    }
    ctx.on('mgr-d-open', function (t) {
      var id = t.getAttribute('data-id');
      if (!last) return;
      if (dp.id === id) { close(); draw(last); reveal(id); return; }   // повторний клік — закрити
      close();
      dp.id = id; dp.row = last.depts.filter(function (d) { return d.id === id; })[0] || null; dp.allP = dp.allD = false;
      draw(last); reveal(id); request();
    });
    ctx.on('mgr-d-retry', function () { dp.err = null; fill(); request(); });
    ctx.on('mgr-d-allp', function () { dp.allP = !dp.allP; fill(); });
    ctx.on('mgr-d-alld', function () { dp.allD = !dp.allD; fill(); });
    ctx.on('mgr-d-loc', function (t) { st.locs = K.pickLocs(st.locs, t.getAttribute('data-v'), st.many); close(); load(); });
    ctx.on('mgr-d-many', function () {
      st.many = !st.many; close();
      if (!st.many && st.locs.length > 1) { st.locs = st.locs.slice(0, 1); load(); } else if (last) draw(last);
    });
    ctx.on('mgr-d-type', function (t) { st.type = t.getAttribute('data-v'); close(); load(); });
    ctx.on('mgr-d-sort', function (t) { st.sort = t.getAttribute('data-v'); if (last) draw(last); });
    load();
  } });
})(window);
