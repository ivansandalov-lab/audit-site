(function (root) {
  'use strict';
  var P = root.P, h = P.sr.h, esc = P.esc, A = P.srAn, X = P.srAnParts;
  var LEVEL_MEANS = { fix: 'можна виправити одразу', repair: 'іде в ремонт', scrap: 'не ремонтується, виріб втрачено' };
  var STEP = 15;

  P.sr.screen('/analytics/defect/:id', { tab: 'analytics', title: 'Вид браку', render: function (ctx) {
    var data = null, shown = STEP, pin = { day: null, range: null }, chart = null;
    var back = '#/analytics' + (ctx.query && ctx.query.dep ? '?dep=' + encodeURIComponent(ctx.query.dep) : '');

    function drawPick() {
      var box = ctx.el.querySelector('#an-dpick'), r = data;
      if (!box) return;
      var list = pin.day ? r.days.filter(function (d) { return d.day === pin.day; }) : pin.range ? r.days.filter(function (d) { return d.day >= pin.range[0] && d.day <= pin.range[1]; }) : [];
      if (!list.length) { box.innerHTML = '<p class="hint an-pick__empty">Натисніть стовпчик — тут будуть числа дня і кнопка в історію. Проведіть по кількох — сума за ці дні.</p>'; return; }
      var a = list[0].day, b = list[list.length - 1].day, pcs = 0, audits = 0, checked = 0, withIt = 0;
      list.forEach(function (d) { pcs += d.pieces; audits += d.audits; checked += d.checked; if (d.pieces) withIt++; });
      var facts = [['цього браку', h.num(pcs) + ' шт'], ['аудитів у локації', h.num(audits)], ['перевірено в локації', h.num(checked) + ' шт']];
      if (!pin.day) facts.splice(1, 0, ['днів із цим браком', withIt + ' з ' + list.length]);
      box.innerHTML = '<div class="an-pick"><div class="an-pick__title"><span class="hint">' + (pin.day ? 'Обраний день' : 'Обрані дні') + '</span><b>' + esc(pin.day ? A.dcap(a) : A.span(a, b)) + '</b></div>' +
        '<div class="an-pick__facts">' + facts.map(function (f) { return '<span><i>' + f[0] + '</i><b>' + f[1] + '</b></span>'; }).join('') + '</div><span class="an-pick__btns">' +
        (pcs ? '<a class="btn btn--secondary btn--sm" href="' + X.hist({ d1: a, d2: b, defect: r.type.name }) + '">' + h.ic('audit', 'ui-icon--sm') + (pin.day ? 'Аудити дня з цим браком' : 'Ці дні в історії') + '</a>' : '') +
        '<button class="btn btn--quiet btn--sm" type="button" data-act="an-unpick">' + h.ic('close', 'ui-icon--sm') + 'Зняти вибір</button></span></div>';
    }
    function draw() {
      var r = data, t = r.type, days = r.days, N = days.length;
      var head = '<div class="card-head" style="flex-wrap:wrap"><a class="btn btn--secondary btn--sm" href="' + back + '">' + h.ic('arrow-left', 'ui-icon--sm') + 'До аналітики</a>' +
        '<div style="flex:1;min-width:240px"><p class="hint">Вид браку · ' + (r.rank ? r.rank + ' місце з ' + r.typesCount + ' за кількістю штук' : 'за період не знайдено') + ' · ' + esc(A.span(r.from, r.to)) + '</p>' +
        '<h2 class="card-title" style="font-size:24px">' + esc(t.name) + '</h2><span class="lvl lvl--' + esc(t.level) + ' an-lvlwrap">' + esc(P.sr.LEVELS[t.level]) + ' · ' + A.LV_NEXT[t.level] + '</span></div>' +
        '<div class="an-dnum"><b>' + h.num(r.pieces) + ' шт</b><span class="sub">за ' + X.dn(N) + ' · ' + h.pct(r.share) + ' усього браку (' + h.num(r.pieces) + ' ÷ ' + h.num(r.allPieces) + ' шт)' + A.q('sr.an.defShare') + '</span>' +
        '<span class="sub">попередні ' + X.dn(N) + ' — ' + h.num(r.prev.pieces) + ' шт</span></div></div>';
      if (!r.pieces) {
        ctx.el.innerHTML = '<section class="card">' + head + h.empty('За період цього браку не знайдено', A.span(r.from, r.to) + ' · за попередні ' + X.dn(N) + ' — ' + h.num(r.prev.pieces) + ' шт') + '</section>';
        return;
      }
      var audited = days.filter(function (d) { return d.audited; }).length, withIt = days.filter(function (d) { return d.pieces; });
      var top = withIt.slice().sort(function (a, b) { return b.pieces - a.pieces; })[0];
      var facts = '<div class="an-sum an-sum--3"><div class="an-sum__i"><span class="an-sum__l">Днів із цим браком' + A.q('sr.an.daysWithDefect') + '</span><b class="an-sum__v">' + withIt.length + ' з ' + audited + '</b><span class="an-sum__p">днів з аудитами в локації</span></div>' +
        '<div class="an-sum__i"><span class="an-sum__l">Найбільше за день</span><b class="an-sum__v">' + h.num(top.pieces) + ' шт</b><span class="an-sum__p">' + esc(A.dshort(top.day)) + '</span></div>' +
        '<div class="an-sum__i"><span class="an-sum__l">За період і попередній</span><b class="an-sum__v">' + h.num(r.pieces) + ' шт</b><span class="an-sum__p">попередні ' + X.dn(N) + ' (' + esc(A.span(r.prev.from, r.prev.to)) + ') — <b>' + h.num(r.prev.pieces) + ' шт</b></span></div></div>';
      var dmax = r.depts.length ? r.depts[0].pieces : 1, wmax = r.workers.length ? r.workers[0].pieces : 1, wTop = r.workers.slice(0, 8), rest = r.workers.slice(8);
      var cols = 'minmax(0, 1fr) minmax(0, 0.7fr) 44px';
      var side = '<div class="col" style="display:flex;flex-direction:column;gap:12px">' +
        '<div class="facts"><p class="group-label" style="padding:0">Рівень браку' + A.q('term.levels') + '</p><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<span class="lvl lvl--' + esc(t.level) + '" style="font-size:16px">' + esc(P.sr.LEVELS[t.level]) + '</span><span class="hint">' + LEVEL_MEANS[t.level] + '</span></div></div>' +
        '<div class="facts"><p class="group-label" style="padding:0">У яких відділах, шт</p>' + r.depts.map(function (d) {
          return '<div class="lvl-row an-lvl" style="grid-template-columns:110px minmax(0,1fr) 64px"><span>' + esc(d.name) + '</span><div class="hbar__track"><i style="width:' + Math.round(d.pieces / dmax * 100) + '%"></i></div><span class="lvl-row__n"><b style="color:var(--text)">' + h.num(d.pieces) + ' шт</b></span></div>';
        }).join('') + '</div>' +
        '<div class="facts"><p class="group-label" style="padding:0">У кого цей брак, шт · натисніть — картка працівника' + A.q('sr.an.defWorkers') + '</p><div>' + wTop.map(function (w) {
          var sub = w.helperPieces ? '<span class="badge an-help">допомога</span> ' + (w.helperPieces === w.pieces ? 'усі штуки' : h.num(w.helperPieces) + ' шт із ' + h.num(w.pieces)) + ' — в іншому відділі' : '';
          return A.hbar({ name: w.name, sub: sub, share: w.pieces / wmax, n: w.pieces, cols: cols, act: w.code ? 'an-worker' : '', attrs: ' data-code="' + esc(w.code) + '"' });
        }).join('') + '</div>' + (rest.length ? '<p class="hint">Ще ' + A.n(rest.length, 'людина', 'людини', 'людей') + ' — ' + h.num(rest.reduce(function (s, w) { return s + w.pieces; }, 0)) + ' шт.</p>' : '') + '</div></div>';
      var products = '<div class="facts"><p class="group-label" style="padding:0">На яких виробах, шт</p><p class="hint" style="font-size:16px;color:var(--text-2)">' +
        esc(r.products.map(function (p) { return p.name + ' — ' + p.pieces; }).join(' · ')) + '</p></div>';
      var rows = r.rows.slice(0, shown), left = r.rows.length - rows.length;
      var table = '<section class="card"><div class="card-head"><div style="flex:1"><h2 class="card-title">Записи: ' + esc(t.name.toLowerCase()) + '</h2><p class="hint">Нові зверху · показано ' + rows.length + ' з ' +
        A.n(r.rows.length, 'запису', 'записів', 'записів') + ' · натисніть рядок — увесь аудит</p></div></div><div class="tbl-box"><table class="tbl"><thead><tr><th>Дата</th><th>Відділ</th><th>Виріб</th><th>Працівник</th><th class="n">Брак, шт</th></tr></thead><tbody>' +
        rows.map(function (x) {
          return '<tr data-act="an-aud" data-id="' + esc(x.auditId) + '"><td>' + esc(A.dshort(x.day)) + '</td><td>' + esc(x.departmentName) + (x.otherDept ? '<span class="sub">знайдено в іншому відділі</span>' : '') + '</td>' +
            '<td>' + esc(x.productName) + (x.orderNo ? '<span class="sub">' + esc(x.orderNo) + '</span>' : '') + '</td>' +
            (x.workerCode ? '<td><b>' + esc(x.workerName) + '</b>' + (x.helper ? ' <span class="badge an-help">допомога</span>' : '') + '</td>' : '<td style="color:var(--text-3)">працівника не вказано</td>') +
            '<td class="n"><b>' + h.num(x.qty) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' +
        (left > 0 ? '<button class="btn btn--secondary btn--sm" type="button" data-act="an-more" style="align-self:flex-start">Показати ще ' + Math.min(left, STEP) + ' з ' + left + '</button>' : '') + '</section>';
      ctx.el.innerHTML = '<section class="card">' + head + '<div class="row"><div class="col--wide" style="display:flex;flex-direction:column;gap:12px">' +
        '<div><h3 class="card-title">' + esc(t.name) + ' по днях, шт</h3><p class="hint">' + esc(A.span(r.from, r.to)) + ' · уся локація · наведіть або торкніться стовпчика — числа дня · натисніть — закріпити · проведіть по кількох — сума за ці дні</p></div>' +
        '<div class="legend">' + h.lvl(t.level, P.sr.LEVELS[t.level] + ' — цей вид браку, шт') + '<span class="an-key"><i class="an-key__none"></i>аудитів не було</span></div>' +
        '<div data-chart="defect"></div><div id="an-dpick"></div>' + facts + products + '</div>' + side + '</div></section>' + table;
      chart = P.srChart.mount(ctx.el.querySelector('[data-chart="defect"]'), {
        items: days.map(function (d) { var lv = { fix: 0, repair: 0, scrap: 0 }; lv[t.level] = d.pieces; return { key: d.day, x: h.dayShort(d.day), v: d.pieces, levels: lv, none: !d.audited, d: d }; }),
        height: root.innerWidth < 900 ? 220 : 320, label: t.name + ' по днях, шт',
        tip: function (it) {
          var d = it.d;
          return d.audited ? P.srChart.tip({ title: A.dcap(d.day), sub: t.name, rows: [['Цього браку', h.num(d.pieces) + ' шт'], ['Аудитів у локації', h.num(d.audits)], ['Перевірено в локації', h.num(d.checked) + ' шт']] })
            : P.srChart.tipDay({ title: A.dcap(d.day), none: 'Аудитів не було' });
        },
        tipRange: function (list, a, b) {
          var pcs = 0, audits = 0, withIt = 0;
          list.forEach(function (x) { pcs += x.d.pieces; audits += x.d.audits; if (x.d.pieces) withIt++; });
          return P.srChart.tip({ title: A.span(a.key, b.key), sub: t.name, rows: [['Цього браку', h.num(pcs) + ' шт'], ['Днів із цим браком', withIt + ' з ' + list.length], ['Аудитів у локації', h.num(audits)]] });
        },
        pin: pin.day, range: pin.range,
        onPin: function (it) { pin = { day: it ? it.key : null, range: null }; drawPick(); },
        onRange: function (a, b) { pin = { day: null, range: a ? [a.key, b.key] : null }; drawPick(); }
      });
      drawPick();
    }
    P.srv('srDefect', { locationId: ctx.loc.id, defectTypeId: ctx.params.id, from: ctx.period.from, to: ctx.period.to }).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) {
        ctx.el.innerHTML = r.code === 'not_found' ? h.empty('Такого виду браку немає', r.error) + '<p style="text-align:center"><a class="btn btn--secondary btn--sm" href="' + back + '">До аналітики</a></p>' : h.error(r);
        return;
      }
      data = r; draw();
    });
    ctx.on('an-more', function () { shown += STEP; draw(); });
    ctx.on('an-unpick', function () { pin = { day: null, range: null }; if (chart) chart.clear(); drawPick(); });
    ctx.on('an-aud', function (t) { if (P.srHist) P.srHist.openAudit(t.getAttribute('data-id')); });
    ctx.on('an-worker', function (t) { if (P.srPeople) P.srPeople.openWorker(ctx, t.getAttribute('data-code')); });
  } });
})(window);
