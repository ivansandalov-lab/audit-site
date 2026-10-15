(function (root) {
  'use strict';
  var P = root.P, h = P.sr.h, esc = P.esc, A = P.srAn, X = P.srAnParts, ui = X.ui;
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function hl(text, q) {
    text = String(text == null ? '' : text);
    var i = q ? text.toLowerCase().indexOf(q) : -1;
    return i < 0 ? esc(text) : esc(text.slice(0, i)) + '<mark class="hl">' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }
  function pickRows(r) {
    var q = ui.oq.trim().toLowerCase(), s = ui.osort;
    var list = r.orders.filter(function (o) {
      return !q || o.no.toLowerCase().indexOf(q) >= 0 || (o.customer || '').toLowerCase().indexOf(q) >= 0 || o.products.some(function (p) { return p.toLowerCase().indexOf(q) >= 0; });
    });
    if (s && s.k !== 'no' && !r.departments.some(function (d) { return d.id === s.k; })) s = ui.osort = null;   // відділ з іншої локації — сортування знімаємо
    if (!s) return list;                                                                                            // «без сортування»: останній аудит зверху
    var sign = s.dir === 'asc' ? 1 : -1;
    return list.slice().sort(function (a, b) {
      if (s.k === 'no') return (a.no < b.no ? -1 : a.no > b.no ? 1 : 0) * sign;
      var x = a.cells[s.k], y = b.cells[s.k];
      if (!x || !y) return x ? -1 : y ? 1 : 0;
      return (x.checked - y.checked) * sign;
    });
  }
  function sortBtn(k, label) {
    var dir = ui.osort && ui.osort.k === k ? ui.osort.dir : '';
    var word = dir === 'desc' ? 'від більшого до меншого' : dir === 'asc' ? 'від меншого до більшого' : 'без сортування';
    return '<button class="an-osort' + (dir ? ' an-osort--on' : '') + '" type="button" data-act="an-osort" data-k="' + esc(k) + '" aria-label="' +
      esc(label + ' — сортування за ' + (k === 'no' ? 'номером замовлення' : 'кількістю перевірених виробів') + ': ' + word) + '">' + esc(label) +
      h.ic(dir === 'desc' ? 'arrow-down' : dir === 'asc' ? 'arrow-up' : 'sort', 'ui-icon--sm') + '</button>';
  }
  function drawTable(view) {
    var r = view.data, box = view.box('an-otbl'), count = view.box('an-ocount');
    if (!box) return;
    var list = pickRows(r), q = ui.oq.trim().toLowerCase(), sel = r.department ? r.department.id : '';
    function sortAttr(k) { var s = ui.osort; return s && s.k === k ? ' aria-sort="' + (s.dir === 'asc' ? 'ascending' : 'descending') + '"' : ''; }
    count.textContent = q ? 'знайдено ' + list.length + ' з ' + r.orders.length : A.n(r.orders.length, 'замовлення', 'замовлення', 'замовлень');
    box.innerHTML = '<table class="tbl an-otbl"><thead><tr><th' + sortAttr('no') + '>' + sortBtn('no', 'Замовлення') + '</th>' +
      r.departments.map(function (d) { return '<th class="n' + (sel === d.id ? ' an-ocol--on' : '') + '"' + sortAttr(d.id) + '>' + sortBtn(d.id, d.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (list.length ? list.map(function (o) {
        return '<tr data-act="an-order" data-no="' + esc(o.no) + '"><td><b>' + hl(o.no, q) + '</b><span class="sub">' + hl(o.products.join(', '), q) + (o.customer ? ' · ' + hl(o.customer, q) : '') + '</span></td>' +
          r.departments.map(function (d) {
            var c = o.cells[d.id], on = sel === d.id ? ' an-ocol--on' : '';
            return c ? '<td class="n an-oc' + on + '"><span class="an-oc__k">перевірено</span> <b>' + h.num(c.checked) + ' шт</b> · ' + A.pct0(c.planPct) + ' плану' +
              '<span class="sub">брак ' + X.brak(c.rejected, c.pct) + '</span></td>' : '<td class="n an-oc an-oc--none' + on + '">—</td>';
          }).join('') + '</tr>';
      }).join('') : '<tr><td colspan="' + (r.departments.length + 1) + '" class="an-oc--none" style="padding:28px 12px;text-align:center">За запитом «' + esc(ui.oq.trim()) + '» замовлень немає · у списку ' +
        A.n(r.orders.length, 'замовлення', 'замовлення', 'замовлень') + '</td></tr>') + '</tbody></table>';
  }
  function draw(view) {
    var r = view.data, box = view.box('an-orders');
    var head = '<div class="card-head"><div style="flex:1"><h2 class="card-title">Аналітика по замовленнях' + A.q('sr.an.orders') + '</h2><p class="hint">Замовлення з аудитами за ' + esc(A.span(r.from, r.to)) + '. ' +
      'Числа — стан замовлення на зараз. % плану = перевірено у відділі ÷ план відділу на замовлення. «—» — у відділі аудитів цього замовлення не було. Натисніть рядок — вікно замовлення.</p></div></div>';
    if (!r.orders.length) { box.innerHTML = head + h.empty('Аудитів по замовленнях за період не було', A.span(r.from, r.to)); return; }
    if (!view.box('an-oq')) {
      box.innerHTML = '<div id="an-ohead"></div><div class="an-obar"><div class="search an-osearch">' + h.ic('search', 'icon') +
        '<input class="input" id="an-oq" type="search" data-input="an-oq" value="' + esc(ui.oq) + '" placeholder="Номер замовлення, виріб або замовник" aria-label="Пошук замовлення: номер, виріб або замовник" autocomplete="off" spellcheck="false"></div>' +
        '<span class="an-ocount" id="an-ocount" aria-live="polite"></span>' +
        '<span class="hint an-obar__note">Натисніть назву колонки — сортування за «перевірено»: від більшого → від меншого → без сортування</span></div>' +
        '<div class="tbl-box" id="an-otbl"></div>';
    }
    view.box('an-ohead').innerHTML = head;
    drawTable(view);
  }

  function openOrder(view, no) {
    var ctx = view.ctx, data = null, dep = 'all', pin = { day: null, range: null }, chart = null;
    var layer = P.sr.modal({ title: 'Замовлення ' + no, body: h.loading(),
      foot: '<p class="action-bar__sum an-foot-note" data-an="crit" style="font-size:14px;flex:1;margin:0"></p>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-act="hist">' + h.ic('audit', 'ui-icon--sm') + 'Відкрити в історії</button>' +
        '<button class="btn btn--primary btn--sm" type="button" data-ov-close>Закрити</button>',
      on: { hist: function (t, e, l) { l.close(); ctx.go('/history', { order: no }); },
        days: function (t, e, l) { l.close(); root.location.hash = t.getAttribute('data-href'); },
        dep: function (t) { dep = t.getAttribute('data-id'); pin = { day: null, range: null }; draw(); },
        unpick: function () { pin = { day: null, range: null }; if (chart) chart.clear(); drawPick(); },
        aud: function (t) { if (P.srHist) P.srHist.openAudit(t.getAttribute('data-id')); },
        retry: function () { load(); } } });
    function drawPick() {
      var box = layer.el.querySelector('[data-an="opick"]'), v = data.views[dep];
      if (!box) return;
      var list = pin.day ? v.days.filter(function (d) { return d.day === pin.day; }) : pin.range ? v.days.filter(function (d) { return d.day >= pin.range[0] && d.day <= pin.range[1]; }) : [];
      if (!list.length) { box.innerHTML = '<p class="hint an-pick__empty">Натисніть стовпчик — тут будуть числа дня. Проведіть по кількох — сума за ці дні.</p>'; return; }
      var s = X.sum(list), a = list[0].day, b = list[list.length - 1].day;
      var href = X.hist({ order: no, d1: a, d2: b, dep: dep === 'all' ? '' : dep });
      box.innerHTML = '<div class="an-pick"><div class="an-pick__title"><span class="hint">' + (pin.day ? 'Обраний день' : 'Обрані дні · ' + X.dn(s.days)) + '</span><b>' + esc(pin.day ? A.dcap(a) : A.span(a, b)) + '</b></div>' +
        '<div class="an-pick__facts">' + [['аудитів', h.num(s.audits)], ['перевірено', h.num(s.checked) + ' шт'], ['брак, шт · %', X.brak(s.rejected, s.pct)]].map(function (f) { return '<span><i>' + f[0] + '</i><b>' + f[1] + '</b></span>'; }).join('') + '</div>' +
        '<span class="an-pick__btns">' + (s.audits ? '<button class="btn btn--secondary btn--sm" type="button" data-act="days" data-href="' + esc(href) + '">' + h.ic('audit', 'ui-icon--sm') + (pin.day ? 'Аудити дня' : 'Ці дні в історії') + '</button>' : '') +
        '<button class="btn btn--quiet btn--sm" type="button" data-act="unpick">' + h.ic('close', 'ui-icon--sm') + 'Зняти вибір</button></span></div>';
    }
    function draw() {
      layer.body(orderBody(data, dep));
      var v = data.views[dep], slot = layer.el.querySelector('[data-chart="oday"]');
      chart = null;
      if (!slot) return;
      chart = P.srChart.mount(slot, {
        items: v.days.map(function (d) { return { key: d.day, x: h.dayShort(d.day), v: d.rejected, levels: d.levels, none: !d.audited, d: d }; }),
        height: 200, label: 'Брак у замовленні ' + no + ' по днях, шт',
        tip: function (it) {
          var d = it.d;
          return P.srChart.tipDay(d.audited ? { title: A.dcap(d.day), sub: 'замовлення ' + no, audits: d.audits, checked: d.checked, rejected: d.rejected, pct: d.pct, levels: d.levels }
            : { title: A.dcap(d.day), none: 'Аудитів замовлення не було' });
        },
        tipRange: function (list, a, b) {
          var s = X.sum(list.map(function (x) { return x.d; }));
          return P.srChart.tipDay({ title: A.span(a.key, b.key), sub: X.dn(s.days) + ' · з аудитами — ' + s.daysWithAudits, audits: s.audits, checked: s.checked, rejected: s.rejected, pct: s.pct, levels: s.levels });
        },
        pin: pin.day, range: pin.range,
        onPin: function (it) { pin = { day: it ? it.key : null, range: null }; drawPick(); },
        onRange: function (a, b) { pin = { day: null, range: a ? [a.key, b.key] : null }; drawPick(); }
      });
      drawPick();
    }
    function load() {
      layer.body(h.loading());
      P.srv('srOrder', { locationId: ctx.loc.id, orderNo: no }).then(function (r) {
        if (layer.closed) return;
        if (!r.ok) { layer.body(h.error(r)); return; }
        data = r; var o = r.order;
        if (view.dep && own(r.views, view.dep) && r.views[view.dep].audits) dep = view.dep;
        layer.el.querySelector('.modal__title').textContent = 'Замовлення ' + o.no + (o.products.length ? ' · ' + o.products.join(', ') : '');
        var head = layer.el.querySelector('.modal__head > div');
        head.insertAdjacentHTML('beforeend', '<p class="hint">План ' + h.num(o.plan) + ' шт по всіх відділах · ' + esc(o.customer) + (o.blockName ? ' · ' + esc(o.blockName) : '') +
          (o.firstAuditDay ? ' · аудити з ' + esc(A.span(o.firstAuditDay, o.lastAuditDay).replace(' — ', ' по ')) : '') + '</p>');
        head.insertAdjacentHTML('afterend', '<span class="badge badge--' + (o.active ? 'info">у роботі' : 'ok">завершено') + '</span>');
        layer.el.querySelector('[data-an="crit"]').textContent = 'Червона риска зліва в таблиці аудитів — брак в аудиті понад ' + r.criticalPct + '% (критичний рівень).';
        draw();
      });
    }
    load();
  }
  function orderBody(r, dep) {
    var v = r.views[dep], crit = r.criticalPct, depName = dep === 'all' ? 'Усі відділи' : r.departments.filter(function (d) { return d.id === dep; })[0].name;
    var seg = '<div class="seg an-seg" role="tablist" aria-label="Відділ" style="align-self:flex-start;flex-wrap:wrap">' +
      '<button class="seg__btn' + (dep === 'all' ? ' seg__btn--on' : '') + '" type="button" data-act="dep" data-id="all">Усі відділи</button>' +
      r.departments.map(function (d) {
        return '<button class="seg__btn' + (dep === d.id ? ' seg__btn--on' : '') + '" type="button" data-act="dep" data-id="' + esc(d.id) + '"' + (d.audits ? '' : ' style="color:var(--text-3)"') + '>' +
          esc(d.name) + ' · ' + d.audits + '</button>'; }).join('') + '</div><p class="hint" style="margin-top:-8px">Число біля відділу — скільки в ньому аудитів цього замовлення.</p>';
    var kpis = '<div class="kpis an-kpis6">' + A.kpi(h.num(v.checked), 'перевірено, шт', 'term.checked') + A.kpi(A.pct0(v.planPct), 'плану · план ' + h.num(v.plan) + ' шт', 'sr.an.planPct') +
      A.kpi(h.num(v.rejected), 'брак, шт', 'term.rejected') + A.kpi(h.pct(v.pct), 'брак, % · у цеху за ці дні ' + h.pct(v.shopPct), 'term.rate') +
      h.kpi(h.num(v.audits), P.plural(v.audits, 'аудит', 'аудити', 'аудитів')) + h.kpi(h.num(v.daysWithAudits), 'днів з аудитами · з ' + v.daysTotal) + '</div>';
    if (!v.audits) return seg + kpis + h.empty(depName + ': аудитів цього замовлення не було', '');
    var max = v.types.length ? v.types[0].pieces : 1;
    var cols = '24px minmax(0, 270px) minmax(0, 1fr) 40px';
    var types = '<div class="col" style="display:flex;flex-direction:column;gap:10px"><div><h3 class="card-title">Що бракує в замовленні' + A.q('term.defectType') + '</h3><p class="hint">' + esc(depName) + ' · ' + h.num(v.rejected) + ' шт · біля кожного виду — його рівень</p></div>' +
      (v.types.length ? '<div>' + v.types.slice(0, 8).map(function (t, i) {
        return A.hbar({ rank: i + 1, name: t.name, sub: esc(t.depts.join(', ')) + ' · ' + h.lvl(t.level), share: t.pieces / max, n: t.pieces, cols: cols, href: '#/analytics/defect/' + encodeURIComponent(t.id) });
      }).join('') + '</div>' + (v.types.length > 8 ? '<p class="hint">Показано 8 з ' + v.types.length + ' видів браку.</p>' : '') + A.levels(v.levels) : '<p class="hint">Браку в цьому замовленні не знайдено.</p>') + '</div>';
    var w = v.worstDay;
    var chart = '<div class="col" style="display:flex;flex-direction:column;gap:10px"><div><h3 class="card-title">Брак по днях, шт</h3><p class="hint">' + esc(depName) + ' · ' +
      esc(A.span(v.days[0].day, v.days[v.days.length - 1].day)) + ' · колір — рівень браку · наведіть або торкніться стовпчика — числа дня</p></div>' +
      X.legend(true, [['an-key__none', 'аудитів замовлення не було']]) + '<div data-chart="oday"></div>' +
      (w ? '<p class="hint">Найбільше за день — ' + h.num(w.rejected) + ' шт з ' + h.num(w.checked) + ' перевірених · ' + esc(A.span(w.day, w.day)) +
        (dep === 'all' ? ' · з них найбільше знайдено у відділі «' + esc(w.departmentName) + '»' : '') + '</p>' : '') + '<div data-an="opick"></div></div>';
    var table = '<div style="display:flex;flex-direction:column;gap:8px"><h3 class="card-title">Аудити замовлення · ' + v.audits + '</h3><div class="tbl-box"><table class="tbl">' +
      '<thead><tr><th>Дата й час</th><th>Відділ</th><th>Аудитор</th><th class="n">Перевірено, шт</th><th class="n">Брак, шт · брак, %</th></tr></thead><tbody>' +
      v.rows.map(function (a) {
        var ov = a.pct != null && a.pct > crit;
        return '<tr data-act="aud" data-id="' + esc(a.id) + '"' + (ov ? ' class="exceed"' : '') + '><td>' + esc(A.dshort(a.day)) + ' · ' + P.fmt.time(a.createdAt) + '</td><td>' + esc(a.departmentName) + '</td>' +
          '<td>' + esc(a.auditorName) + '</td><td class="n">' + h.num(a.checked) + '</td>' +
          '<td class="n"><b>' + h.num(a.rejected) + '</b> · ' + h.pct(a.pct) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    return seg + kpis + '<div class="row">' + types + chart + '</div>' + table;
  }

  X.orders = {
    draw: draw,
    bind: function (view) {
      var ctx = view.ctx;
      ctx.on('an-oq', function (t) { ui.oq = t.value; drawTable(view); });
      ctx.on('an-osort', function (t) {
        var k = t.getAttribute('data-k'), s = ui.osort;
        ui.osort = !s || s.k !== k ? { k: k, dir: 'desc' } : s.dir === 'desc' ? { k: k, dir: 'asc' } : null;
        drawTable(view);
        var again = Array.prototype.filter.call(view.box('an-otbl').querySelectorAll('.an-osort'), function (b) { return b.getAttribute('data-k') === k; })[0];
        if (again) again.focus();
      });
      ctx.on('an-order', function (t) { openOrder(view, t.getAttribute('data-no')); });
    }
  };
})(window);
