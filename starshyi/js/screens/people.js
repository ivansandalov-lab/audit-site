(function (root) {
  'use strict';
  var P = root.P, h = P.sr.h, esc = P.esc, A = P.srAn;
  var STEP = 30, TYPES = 8;   // TYPES — скільки видів браку показує картка працівника
  var pf = { dep: '', q: '', shown: STEP, aq: '', open: null };

  function dec(v) { return v == null ? '—' : String(v).replace('.', ','); }
  function spanShort(a, b) { return a === b || a.slice(0, 7) !== b.slice(0, 7) ? A.span(a, b) : +a.slice(8) + ' — ' + A.span(b, b); }
  function rateCell(rate, crit) {
    if (rate == null) return '<span style="color:var(--text-3)">—</span>';
    var over = rate > crit;
    return '<b' + (over ? ' class="pp-over"' : '') + '>' + h.pct(rate) + '</b>' + (over ? '<span class="pp-over-note">понад ' + crit + '%</span>' : '');
  }
  function seg(on, workers, auditors) {
    return '<div class="seg pp-seg" style="flex:none">' +
      '<a class="seg__btn' + (on === 'w' ? ' seg__btn--on' : '') + '" href="#/people" style="text-decoration:none">Виробничі працівники<span class="badge' + (on === 'w' ? ' badge--brand' : '') + '">' + workers + '</span></a>' +
      '<a class="seg__btn' + (on === 'a' ? ' seg__btn--on' : '') + '" href="#/people/auditors" style="text-decoration:none">Аудитори<span class="badge' + (on === 'a' ? ' badge--brand' : '') + '">' + auditors + '</span></a></div>';
  }
  function searchBox(act, value, placeholder) {
    return '<div class="search" style="flex:1;min-width:240px;max-width:420px">' + h.ic('search', 'icon') +
      '<input class="input" data-input="' + act + '" value="' + esc(value) + '" placeholder="' + esc(placeholder) + '" aria-label="' + esc(placeholder) + '" style="padding-left:46px"></div>';
  }

  function workersCard(r) {
    var q = pf.q.trim().toLowerCase(), crit = r.criticalPct;
    var list = r.workers.filter(function (w) {
      return (!pf.dep || w.departmentId === pf.dep) && (!q || w.name.toLowerCase().indexOf(q) >= 0 || w.code.toLowerCase().indexOf(q) >= 0);
    });
    var shown = list.slice(0, pf.shown), left = list.length - shown.length, days = A.diff(r.from, r.to) + 1;
    var dep = r.departments.filter(function (d) { return d.id === pf.dep; })[0];
    var body = list.length ? '<div class="tbl-box"><table class="tbl"><thead><tr><th>Працівник</th><th>Відділ</th><th class="n">Аудитів' + A.q('sr.pp.audits') + '</th>' +
      '<th class="n">З браком' + A.q('sr.pp.withDefects') + '</th><th class="n">Перевірено, шт' + A.q('sr.pp.checked') + '</th><th class="n">Брак, шт' + A.q('sr.pp.pieces') + '</th>' +
      '<th style="width:180px">Рівні браку' + A.q('term.levels') + '</th><th class="n">Брак, %' + A.q('sr.pp.rate') + '</th></tr></thead><tbody>' +
      shown.map(function (w) {
        return '<tr data-act="pp-worker" data-code="' + esc(w.code) + '"' + (w.active ? '' : ' style="color:var(--text-3)"') + '>' +
          '<td><b>' + esc(w.name) + '</b>' + (w.active ? '' : '<span class="sub">вимкнено в довіднику</span>') + '</td><td>' + esc(w.departmentName) + '</td>' +
          '<td class="n">' + w.audits + (w.helperAudits ? '<span class="sub">допомога: ' + w.helperAudits + '</span>' : '') + '</td><td class="n">' + w.withDefects + '</td>' +
          '<td class="n">' + h.num(w.checked) + '</td><td class="n"><b>' + h.num(w.pieces) + '</b></td>' +
          '<td>' + h.stack(w.levels, 12) + '</td><td class="n">' + rateCell(w.rate, crit) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' + (left > 0 ? '<button class="btn btn--secondary btn--sm" type="button" data-act="pp-more">Показати ще ' + Math.min(left, STEP) + '</button>' : '') +
      '<span class="hint">Показано ' + shown.length + ' з ' + list.length + '</span></div>' +
      '<p class="hint">Перевірено, шт — вибірка аудиту, поділена порівну між усіма працівниками, яких у ньому перевіряли. Брак, % = брак, шт ÷ перевірено, шт.</p>'
      : P.state.empty('search', 'Нікого не знайдено', q ? 'Пошук «' + pf.q.trim() + '»' + (dep ? ' · відділ ' + dep.name : '')
        : (dep ? 'У відділі ' + dep.name + ' виробничих працівників немає.' : 'Виробничих працівників немає.') + ' Додають їх у «Керуванні».',
        q || dep ? '<button class="btn btn--secondary btn--sm" type="button" data-act="pp-clear">Показати всіх</button>' : '');
    return '<section class="card"><div class="card-head" style="flex-wrap:wrap"><div style="flex:1;min-width:240px"><h2 class="card-title">Виробничі працівники · ' + list.length + '</h2>' +
      '<p class="hint">' + days + ' дн. · спершу ті, в кого найбільше браку в штуках · клік по рядку — картка працівника</p></div>' + h.legend() + '</div>' + body + '</section>';
  }

  function openWorker(ctx, code) {
    var period = P.sr.period(), chart = null;
    var layer = P.sr.drawer({ title: 'Працівник', sub: 'Виробничий працівник', body: h.loading(),
      foot: '<button class="btn btn--quiet btn--sm" type="button" data-ov-close>Закрити</button>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-act="hist" style="margin-left:auto">' + h.ic('audit', 'ui-icon--sm') + 'Аудити працівника</button>',
      on: { hist: function (t, e, l) { l.close(); P.router.go('/history', { worker: code }); }, retry: function () { load(); }, 'kd-retry': function () { loadKd(); } },
      onClose: function () { if (chart) chart.destroy(); } });
    function load() {
      layer.body(h.loading());
      P.srv('srPeopleWorker', { locationId: ctx.loc.id, code: code, from: period.from, to: period.to }).then(function (r) {
        if (layer.closed) return;
        if (!r.ok) { layer.body(h.error(r)); return; }
        var w = r.worker;
        layer.el.querySelector('.modal__title').textContent = w.name + ' · ' + w.departmentName;
        var sub = layer.el.querySelector('.modal__head .hint'); if (sub) sub.textContent = 'Виробничий працівник · ' + (A.diff(r.from, r.to) + 1) + ' дн., ' + h.dayShort(r.from) + ' — ' + h.dayShort(r.to);
        layer.body(workerBody(r, ctx.loc.name) + '<div class="pp-block" data-pp-kd>' + kdHead(w.departmentName, r) + h.loading() + '</div>');
        chart = mountWeeks(layer.el.querySelector('[data-chart="pp-weeks"]'), r);
        loadKd();
      });
    }
    function loadKd() {
      var slot = layer.el.querySelector('[data-pp-kd]');
      if (!slot) return;
      P.srv('srKdWorker', { locationId: ctx.loc.id, code: code, from: period.from, to: period.to }).then(function (r) {
        if (layer.closed || !slot.isConnected) return;
        slot.innerHTML = kdHead(r.ok ? r.worker.departmentName : '', r) + (r.ok ? kdBody(r)
          : '<p class="hint">Не вдалося завантажити коригуючі дії. ' + esc(r.error || '') + '</p>' +
            '<button class="btn btn--secondary btn--sm" type="button" data-act="kd-retry" style="align-self:flex-start">' + h.ic('refresh', 'ui-icon--sm') + 'Спробувати ще раз</button>');
      });
    }
    load();
  }
  function kdHead(depName, r) {
    return '<div><p class="pp-h">Коригуючі дії' + A.q('kd.action') + '</p><p class="hint">Дії відділу' + (depName ? ' ' + esc(depName) : '') + ' по видах браку, у яких працівник винний' +
      (r && r.from ? ' · ' + esc(A.span(r.from, r.to)) : '') + '</p></div>';
  }
  function kdBody(r) {
    var K = P.srKd;
    var types = r.types.length ? '<p class="hint">Види браку працівника за період: </p><div class="pp-kd-types">' + r.types.map(function (t) {
      return '<span class="chip chip--plain">' + esc(t.name) + ' · ' + h.num(t.pieces) + ' шт</span>'; }).join('') + '</div>' : '';
    if (!r.items.length) return '<p style="margin:0"><b>Коригуючих дій у цьому періоді немає.</b></p>' + types;
    return '<div class="pp-kd-list">' + r.items.map(function (a) {
      return '<a class="pp-kd-item" data-ov-close href="#/kd/dept/' + encodeURIComponent(a.departmentId) + '?p=' + a.period + '&t=' + encodeURIComponent(a.defectTypeId) + '">' +
        '<span class="pp-kd-item__head"><b>' + esc(a.name) + '</b>' + h.kdState(P.sr.kdStateOf(a.status)) + '</span>' +
        '<span class="hint">' + esc(K.actMeta(a)) + '</span>' +
        (a.after != null ? '<span class="hint">Результат: ' + esc(K.result(a, r.threshold)) + '</span>'
          : '<span class="hint">Частка виду браку у відділі за розбір: ' + esc(K.rates(a)) + '</span>') +
        (a.plan ? '<span class="hint">Що робимо: ' + esc(a.plan) + '</span>' : '') + '</a>';
    }).join('') + '</div>' + types;
  }
  function mountWeeks(slot, r) {
    if (!slot) return null;
    var crit = r.criticalPct;
    return P.srChart.mount(slot, {
      items: r.weeks.map(function (x) { return { key: x.from, x: h.dayShort(x.from), v: x.rate || 0, none: !x.audits, hot: x.rate > crit, w: x }; }),
      height: 150, label: 'Брак працівника по тижнях, %', line: { v: crit, label: crit + '%' }, xLabels: r.weeks.length > 8,
      tip: function (it) {
        var x = it.w, over = x.rate > crit;
        return P.srChart.tipDay({ title: 'Тиждень ' + spanShort(x.from, x.to), none: x.audits ? null : 'Аудитів з виробами працівника не було',
          audits: x.audits, checked: x.checked, rejected: x.pieces, pct: x.rate, over: over, rows: over ? [['Понад ' + crit + '%', 'так', 'danger']] : [] });
      } });
  }
  function workerBody(r, locName) {
    if (!r.audits) return P.state.empty('info', 'Аудитів з виробами працівника немає', 'Період: ' + A.span(r.from, r.to));
    var crit = r.criticalPct, over = r.rate != null && r.rate > crit;
    var kpis = '<div class="kpis pp-kpis">' +
      A.kpi(h.num(r.audits), 'аудитів з виробами працівника · з браком ' + r.withDefects + (r.helperAudits ? ' · допомога іншому відділу: ' + r.helperAudits : ''), 'sr.pp.audits') +
      A.kpi(h.num(r.checked), 'перевірено, шт · частка від вибірки цих аудитів', 'sr.pp.checked') +
      A.kpi(h.num(r.pieces), 'брак, шт', 'sr.pp.pieces', r.pieces ? 'danger' : '') +
      A.kpi(h.pct(r.rate), r.rate == null ? 'брак, % = брак, шт ÷ перевірено, шт' : 'брак, % · ' + h.num(r.pieces) + ' шт з ' + h.num(r.checked) + ' перевірених' + (over ? ' · понад ' + crit + '%' : ''), 'sr.pp.rate', over ? 'danger' : '') + '</div>';
    var wk = r.weeks, few = wk.length <= 8;
    var weeks = '<div class="pp-block"><div><p class="pp-h">Брак по тижнях, %' + A.q('sr.pp.weeks') + '</p>' +
      '<p class="hint">брак, шт ÷ перевірено, шт за тиждень · риска — ' + crit + '% · червоний стовпчик — понад ' + crit + '%</p></div><div data-chart="pp-weeks"></div>' +
      (few ? '<div class="pp-wx pp-wx--val">' + wk.map(function (x) { return '<span' + (x.rate > crit ? ' class="pp-over"' : '') + '>' + (x.audits ? h.pct(x.rate) : '—') + '</span>'; }).join('') + '</div>' +
        '<div class="pp-wx">' + wk.map(function (x) { return '<span>' + (x.from === x.to ? h.dayShort(x.from) : A.diff(x.from, x.to) < 6 ? h.dayShort(x.from) + '–' + h.dayShort(x.to) : 'з ' + h.dayShort(x.from)) + '</span>'; }).join('') + '</div>' : '') + '</div>';
    var max = r.types.length ? r.types[0].pieces : 1;
    var types = '<div class="pp-block"><p class="pp-h">Види браку працівника · ' + h.num(r.pieces) + ' шт' + A.q('term.levels') + '</p>' +
      (r.types.length ? A.levels(r.levels) + '<div>' + r.types.slice(0, TYPES).map(function (t) {
        return A.hbar({ name: t.name, sub: h.lvl(t.level), share: t.pieces / max, n: t.pieces, cols: 'minmax(0, 1fr) 110px 40px', href: '#/analytics/defect/' + encodeURIComponent(t.id) });
      }).join('') + '</div>' + (r.types.length > TYPES ? '<p class="hint">Показано ' + TYPES + ' найчастіших з ' + r.types.length + '.</p>' : '') : '<p class="hint">Браку немає</p>') + '</div>';
    var scale = Math.max(10, r.rate || 0, r.deptRate || 0, r.shopRate || 0);
    function line(name, kind, rate) {
      var hot = rate != null && rate > crit;
      return '<span class="pp-cmp__k">' + name + '<small>' + esc(kind) + '</small></span>' +
        '<div class="pp-cmp__bar"><i' + (hot ? ' class="pp-hot"' : '') + ' style="width:' + ((rate || 0) / scale * 100).toFixed(1) + '%"></i><b style="left:' + (crit / scale * 100).toFixed(1) + '%"></b></div>' +
        '<span class="pp-cmp__v' + (hot ? ' pp-over' : '') + '">' + h.pct(rate) + (hot ? '<small>понад ' + crit + '%</small>' : '') + '</span>';
    }
    var compare = '<div class="pp-block"><div><p class="pp-h">Брак, %: працівник, відділ, цех' + A.q('sr.pp.compare') + '</p><p class="hint">' + esc(A.span(r.from, r.to)) + ' · риска — ' + crit + '%</p></div>' +
      '<div class="pp-cmp">' + line('<b>' + esc(r.worker.name) + '</b>', 'працівник · ' + h.num(r.pieces) + ' шт з ' + h.num(r.checked), r.rate) +
      line(esc(r.worker.departmentName), 'відділ', r.deptRate) + line(esc(locName || 'Цех'), 'цех, усі відділи', r.shopRate) + '</div></div>';
    return kpis + weeks + types + compare;
  }

  P.srPeople = { openWorker: openWorker };

  P.sr.screen('/people', { tab: 'people', title: 'Люди', render: function (ctx) {
    var data = null;
    function drawList() { var box = ctx.el.querySelector('#pp-list'); if (box) box.innerHTML = workersCard(data); }
    P.srv('srPeopleWorkers', { locationId: ctx.loc.id, from: ctx.period.from, to: ctx.period.to }).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { ctx.el.innerHTML = h.error(r); return; }
      data = r;
      if (pf.dep && !r.departments.some(function (d) { return d.id === pf.dep; })) pf.dep = '';
      ctx.el.innerHTML = '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' + seg('w', r.workers.length, r.auditorsCount) +
        '<select class="input pp-select" data-change="pp-dep" aria-label="Відділ"><option value="">Відділ: усі</option>' +
        r.departments.map(function (d) { return '<option value="' + esc(d.id) + '"' + (pf.dep === d.id ? ' selected' : '') + '>' + esc(d.name) + ' · брак ' + h.pct(d.rate) + '</option>'; }).join('') + '</select>' +
        searchBox('pp-q', pf.q, 'Працівник, напр. q5') + '</div><div id="pp-list"></div>';
      drawList();
    });
    ctx.on('pp-dep', function (t) { pf.dep = t.value; pf.shown = STEP; drawList(); });
    ctx.on('pp-q', function (t) { pf.q = t.value; pf.shown = STEP; drawList(); });
    ctx.on('pp-more', function () { pf.shown += STEP; drawList(); });
    ctx.on('pp-clear', function () {
      pf.dep = ''; pf.q = ''; pf.shown = STEP;
      var s = ctx.el.querySelector('[data-change="pp-dep"]'), i = ctx.el.querySelector('[data-input="pp-q"]');
      if (s) s.value = ''; if (i) i.value = '';
      drawList();
    });
    ctx.on('pp-worker', function (t) { openWorker(ctx, t.getAttribute('data-code')); });
  } });

  function lastText(iso) {
    if (!iso) return 'ще не було';
    var d = P.fmt.dayKey(iso), n = A.diff(d, A.today());
    return n === 0 ? 'сьогодні, ' + P.fmt.time(iso) : n === 1 ? 'учора, ' + P.fmt.time(iso) : n < 14 ? A.ago(d) : h.dayShort(d);
  }
  function auditorsCard(r) {
    var q = pf.aq.trim().toLowerCase(), list = r.auditors.filter(function (a) { return !q || a.name.toLowerCase().indexOf(q) >= 0; });
    var head = '<div class="card-head"><div style="flex:1"><h2 class="card-title">Аудитори · ' + list.length + '</h2><p class="hint">' + (A.diff(r.from, r.to) + 1) + ' дн. · ' +
      A.n(r.totalAudits, 'аудит', 'аудити', 'аудитів') + ' · спершу ті, в кого найбільше аудитів · клік по рядку — розгорнути</p></div></div>';
    if (!list.length) return '<section class="card">' + head + P.state.empty('search', 'Нікого не знайдено', 'Пошук «' + pf.aq.trim() + '»') + '</section>';
    return '<section class="card">' + head + '<div class="tbl-box"><table class="tbl"><thead><tr><th>Аудитор</th><th class="n">Аудитів</th><th class="n">На робочий день' + A.q('sr.pp.perDay') + '</th>' +
      '<th class="n">За аудит, шт' + A.q('sr.pp.perAudit') + '</th><th class="n">Брак, %' + A.q('sr.pp.audRate') + '</th><th class="n">Аудити без браку' + A.q('sr.pp.clean') + '</th><th>Останній аудит</th></tr></thead><tbody>' +
      list.map(function (a) {
        var open = pf.open === a.id, mute = a.active ? '' : ' style="color:var(--text-3)"';
        var tr = '<tr data-act="pp-aud" data-id="' + esc(a.id) + '"' + (open ? ' class="sel"' : '') + ' aria-expanded="' + open + '"><td' + mute + '><span style="display:inline-flex;align-items:center;gap:6px">' +
          h.ic(open ? 'chevron-down' : 'chevron-right', 'ui-icon--sm') + '<b>' + esc(a.name) + '</b></span>' +
          (a.role === 'senior_auditor' ? '<span class="sub" style="padding-left:24px">старший аудитор</span>' : '') + (a.active ? '' : '<span class="sub" style="padding-left:24px">доступ вимкнено</span>') + '</td>' +
          '<td class="n"' + mute + '><b>' + a.audits + '</b></td><td class="n"' + mute + '>' + (a.audits ? dec(a.perDay) : '—') + '</td>' +
          '<td class="n"' + mute + '>' + (a.perAudit == null ? '—' : h.num(a.perAudit)) + (a.normPerAudit != null ? '<span class="sub">норма на аудит ' + h.num(a.normPerAudit) + '</span>' : '') + '</td>' +
          '<td class="n"' + mute + '>' + (a.audits ? '<b>' + h.pct(a.pct) + '</b>' : '—') + (a.peersPct != null ? '<span class="sub">інші аудитори ' + h.pct(a.peersPct) + '</span>' : '') + '</td>' +
          '<td class="n"' + mute + '>' + (a.cleanShare == null ? '—' : a.cleanShare + '%<span class="sub">' + a.clean + ' з ' + a.audits + '</span>') + '</td><td' + mute + '>' + esc(lastText(a.lastAt)) + '</td></tr>';
        if (!open) return tr;
        return tr + '<tr class="sel"><td colspan="7" style="padding:4px 16px 20px"><div style="display:flex;flex-direction:column;gap:12px">' +
          '<div class="kpis pp-kpis4">' +
          h.kpi(h.num(a.audits), 'аудитів · ' + dec(a.perDay) + ' на робочий день') +
          h.kpi(h.num(a.checked), 'перевірено, шт · за аудит ' + (a.perAudit == null ? '—' : h.num(a.perAudit)) + ' шт' + (a.normPerAudit != null ? ' · норма на аудит ' + h.num(a.normPerAudit) + ' шт' : '')) +
          h.kpi(h.pct(a.pct), 'брак, % · ' + h.num(a.pieces) + ' шт з ' + h.num(a.checked) + ' перевірених' + (a.peersPct != null ? ' · інші аудитори в тих самих відділах ' + h.pct(a.peersPct) : '')) +
          h.kpi(a.cleanShare == null ? '—' : a.cleanShare + '%', 'аудитів без браку' + (a.cleanShare == null ? '' : ' · ' + a.clean + ' з ' + a.audits) + (a.peersCleanShare != null ? ' · в інших аудиторів ' + a.peersCleanShare + '%' : '')) + '</div>' +
          '<a class="btn btn--secondary btn--sm" style="align-self:flex-start" href="#/history?auditor=' + encodeURIComponent(a.id) + '">' + h.ic('audit', 'ui-icon--sm') + 'Аудити: ' + esc(a.name) + '</a>' +
          '</div></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="hint">Норма на аудит = норма відділу на день ÷ скільки аудитів у відділі зазвичай буває за день. Інші аудитори — ті, хто за цей період перевіряв ті самі відділи.</p></section>';
  }

  P.sr.screen('/people/auditors', { tab: 'people', title: 'Люди · аудитори', render: function (ctx) {
    var data = null;
    function drawList() { var box = ctx.el.querySelector('#pp-list'); if (box) box.innerHTML = auditorsCard(data); }
    P.srv('srPeopleAuditors', { locationId: ctx.loc.id, from: ctx.period.from, to: ctx.period.to }).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { ctx.el.innerHTML = h.error(r); return; }
      data = r;
      ctx.el.innerHTML = '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' + seg('a', r.workersCount, r.auditors.length) +
        searchBox('pp-aq', pf.aq, 'Імʼя аудитора') + '</div><div id="pp-list"></div>';
      drawList();
    });
    ctx.on('pp-aq', function (t) { pf.aq = t.value; drawList(); });
    ctx.on('pp-aud', function (t) { var id = t.getAttribute('data-id'); pf.open = pf.open === id ? null : id; drawList(); });
  } });
})(window);
