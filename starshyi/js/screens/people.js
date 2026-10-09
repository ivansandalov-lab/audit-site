(function (root) {
  'use strict';
  var P = root.P, h = P.sr.h, esc = P.esc, A = P.srAn;
  var STEP = 30;
  var pf = { dep: '', q: '', shown: STEP, aq: '', open: null };

  var GRADE = { good: ['ok', 'Добра'], mid: ['warn', 'Середня'], weak: ['danger', 'Слабка'] };
  var RULE = '<b>Оцінка якості — брак на 100 перевірених виробів, порівняно з відділом.</b> Добра — нижче, ніж у відділі загалом; ' +
    'середня — на рівні відділу або вище, але не понад 5%; слабка — понад критичний рівень 5%. Менше 3 аудитів — мало даних для оцінки. ' +
    '«Перевірено» в людини — частка аудиту порівну між усіма, кого в ньому перевіряли.';

  function gradeBadge(w) {
    if (w.grade === 'few') return h.badge('Мало даних · ' + A.n(w.audits, 'аудит', 'аудити', 'аудитів'));
    return h.badge(GRADE[w.grade][1] + ' · ' + h.pct(w.rate), GRADE[w.grade][0]);
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
    var q = pf.q.trim().toLowerCase();
    var list = r.workers.filter(function (w) {
      return (!pf.dep || w.departmentId === pf.dep) && (!q || w.name.toLowerCase().indexOf(q) >= 0 || w.code.toLowerCase().indexOf(q) >= 0);
    });
    var shown = list.slice(0, pf.shown), left = list.length - shown.length, days = A.diff(r.from, r.to) + 1;
    var body = list.length ? '<div class="tbl-box"><table class="tbl"><thead><tr><th>Код</th><th>Працівник</th><th>Відділ</th><th class="n">Аудитів</th><th class="n">З браком</th>' +
      '<th class="n">Брак, шт</th><th style="width:180px">Рівні браку</th><th>Оцінка якості</th></tr></thead><tbody>' +
      shown.map(function (w) {
        return '<tr data-act="pp-worker" data-code="' + esc(w.code) + '"' + (w.active ? '' : ' style="color:var(--text-3)"') + '><td>' + esc(w.code) + '</td>' +
          '<td><b>' + esc(w.name) + '</b>' + (w.active ? '' : '<span class="sub">вимкнено в довіднику</span>') + '</td><td>' + esc(w.departmentName) + '</td>' +
          '<td class="n">' + w.audits + '</td><td class="n">' + w.withDefects + '</td><td class="n"><b>' + w.pieces + '</b></td>' +
          '<td>' + h.stack(w.levels, 12) + '</td><td>' + gradeBadge(w) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' + (left > 0 ? '<button class="btn btn--secondary btn--sm" type="button" data-act="pp-more">Показати ще ' + Math.min(left, STEP) + '</button>' : '') +
      '<span class="hint">Показано ' + shown.length + ' з ' + list.length + '</span></div>'
      : h.empty('Нікого не знайшли', q ? 'Перевірте імʼя чи код — напр. Ш-014 — або зніміть фільтр відділу.' : 'У цьому відділі немає виробничих працівників. Додати можна в «Керуванні».');
    return '<section class="card"><div class="card-head" style="flex-wrap:wrap"><div style="flex:1;min-width:240px"><h2 class="card-title">Виробничі працівники · ' + list.length + '</h2>' +
      '<p class="hint">' + days + ' дн. · спершу ті, в кого найбільше браку · клік по рядку — картка працівника</p></div>' + h.legend() + '</div>' +
      body + '<div class="note-box">' + RULE + '</div></section>';
  }

  function openWorker(ctx, code) {
    var period = P.sr.period();
    var layer = P.sr.drawer({ title: 'Працівник ' + code, sub: 'Виробничий працівник', body: h.loading(),
      foot: '<button class="btn btn--quiet btn--sm" type="button" data-ov-close>Закрити</button>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-act="hist" style="margin-left:auto">' + h.ic('audit', 'ui-icon--sm') + 'Аудити працівника</button>',
      on: { hist: function (t, e, l) { l.close(); P.router.go('/history', { worker: code }); }, retry: function () { load(); } } });
    function load() {
      layer.body(h.loading());
      P.srv('srPeopleWorker', { locationId: ctx.loc.id, code: code, from: period.from, to: period.to }).then(function (r) {
        if (layer.closed) return;
        if (!r.ok) { layer.body(h.error(r)); return; }
        var w = r.worker;
        layer.el.querySelector('.modal__title').textContent = w.name + ' · ' + w.code + ' · ' + w.departmentName;
        var sub = layer.el.querySelector('.modal__head .hint'); if (sub) sub.textContent = 'Виробничий працівник · ' + (A.diff(r.from, r.to) + 1) + ' дн., ' + h.dayShort(r.from) + ' — ' + h.dayShort(r.to);
        layer.body(workerBody(r, ctx.loc.name));
      });
    }
    load();
  }
  function workerBody(r, locName) {
    if (!r.audits) return h.empty('За цей період аудитів з виробами працівника не було', 'Візьміть довший період — 90 дн.');
    var over = r.rate != null && r.rate > r.criticalPct;
    var kpis = '<div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
      h.kpi(r.audits, 'аудитів з виробами працівника · ' + r.withDefects + ' з браком') + h.kpi(h.num(r.checked), 'перевірено, шт (частка аудитів)') +
      h.kpi(h.num(r.pieces), 'брак, шт', r.pieces ? 'danger' : '') +
      h.kpi(h.pct(r.rate), 'брак · ' + (r.rate == null ? 'нема з чим порівняти' : over ? 'вище критичного рівня 5%' : 'нижче критичного рівня 5%'), over ? 'danger' : '') + '</div>';
    var wk = r.weeks, rates = wk.map(function (x) { return x.rate; });
    var known = rates.filter(function (x) { return x != null; }), first = known[0], last = known[known.length - 1], trend;
    if (known.length < 2) trend = 'Замало тижнів з аудитами, щоб побачити зміну.';
    else if (known.every(function (x, i) { return !i || x > known[i - 1]; })) trend = 'Брак росте щотижня' + (last > 5 ? ', тепер вище 5%.' : '.');
    else if (last > first + 1) trend = 'Брак зростає: з ' + h.pct(first) + ' до ' + h.pct(last) + (last > 5 ? ' — вище 5%.' : '.');
    else if (last < first - 1) trend = 'Брак зменшується: з ' + h.pct(first) + ' до ' + h.pct(last) + '.';
    else trend = 'Брак тримається на одному рівні — близько ' + h.pct(last) + '.';
    var weeks = '<div class="facts"><p class="group-label" style="padding:0">Динаміка браку по тижнях · риска — 5%</p>' + h.dyn(rates) +
      '<div class="dyn-x">' + rates.map(function (x) { return '<span' + (x > 5 ? ' style="color:var(--danger);font-weight:700"' : '') + '>' + (x == null ? '—' : h.pct(x)) + '</span>'; }).join('') + '</div>' +
      '<div class="dyn-x">' + wk.map(function (x) { return '<span>' + (x.from === x.to ? h.dayShort(x.from) : A.diff(x.from, x.to) < 6 ? h.dayShort(x.from) + '–' + h.dayShort(x.to) : 'з ' + h.dayShort(x.from)) + '</span>'; }).join('') + '</div>' +
      '<p style="margin:0;font-weight:700">' + esc(trend) + '</p></div>';
    var max = r.types.length ? r.types[0].pieces : 1;
    var types = '<div style="display:flex;flex-direction:column;gap:8px"><p class="group-label" style="padding:0">Види браку · ' + h.num(r.pieces) + ' шт</p>' +
      (r.types.length ? A.levels(r.levels) + '<div>' + r.types.slice(0, 8).map(function (t) {
        return A.hbar({ name: t.name, sub: h.lvl(t.level), share: t.pieces / max, n: t.pieces, cols: 'minmax(0, 1fr) 110px 40px', href: '#/analytics/defect/' + encodeURIComponent(t.id) });
      }).join('') + '</div>' : '<p class="hint">Браку з виробами цього працівника не знайшли.</p>') + '</div>';
    function line(name, rate, bold) {
      return '<div class="lvl-row an-lvl" style="grid-template-columns:120px minmax(0,1fr) 56px">' + (bold ? '<b>' + esc(name) + '</b>' : '<span>' + esc(name) + '</span>') +
        h.threshold(rate, rate > 5) + '<span class="lvl-row__n"' + (rate > 5 ? ' style="color:var(--danger);font-weight:700"' : '') + '>' + h.pct(rate) + '</span></div>';
    }
    var cmp = r.rate == null || r.deptRate == null ? '' : r.rate > r.deptRate ? '<b>Частіше за відділ:</b> ' : r.rate < r.deptRate ? '<b>Рідше за відділ:</b> ' : '<b>Як у відділі:</b> ';
    var compare = '<div class="facts"><p class="group-label" style="padding:0">Порівняння з відділом · риска — 5%</p>' + line(r.worker.name, r.rate, true) +
      line(r.worker.departmentName, r.deptRate) + line(locName || 'Цех', r.shopRate) +
      (cmp ? '<p class="hint">' + cmp + h.pct(r.rate) + ' проти ' + h.pct(r.deptRate) + '.' + (r.types.length ? ' Головне — ' + esc(r.types[0].name.toLowerCase()) + '.' : '') + '</p>' : '') + '</div>';
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
        searchBox('pp-q', pf.q, 'Імʼя або код, напр. Ш-014') + '</div><div id="pp-list"></div>';
      drawList();
    });
    ctx.on('pp-dep', function (t) { pf.dep = t.value; pf.shown = STEP; drawList(); });
    ctx.on('pp-q', function (t) { pf.q = t.value; pf.shown = STEP; drawList(); });
    ctx.on('pp-more', function () { pf.shown += STEP; drawList(); });
    ctx.on('pp-worker', function (t) { openWorker(ctx, t.getAttribute('data-code')); });
  } });

  var STRICT = { same: ['ok', 'На рівні колег'], high: ['info', 'Вище колег'], low: ['warn', 'Нижче колег'], few: ['', 'Мало даних'] };
  function lastText(iso) {
    if (!iso) return 'ще не було';
    var d = P.fmt.dayKey(iso), n = A.diff(d, A.today());
    return n === 0 ? 'сьогодні, ' + P.fmt.time(iso) : n === 1 ? 'учора, ' + P.fmt.time(iso) : n < 14 ? A.ago(d) : h.dayShort(d);
  }
  function auditorsCard(r) {
    var q = pf.aq.trim().toLowerCase(), list = r.auditors.filter(function (a) { return !q || a.name.toLowerCase().indexOf(q) >= 0; });
    var head = '<div class="card-head"><div style="flex:1"><h2 class="card-title">Аудитори · ' + list.length + '</h2><p class="hint">' + (A.diff(r.from, r.to) + 1) + ' дн. · ' +
      A.n(r.totalAudits, 'аудит', 'аудити', 'аудитів') + ' · клік по рядку — розгорнути</p></div></div>';
    var note = '<div class="note-box"><b>Як читати.</b> Вибірка ×1,0 — аудитор перевіряє за аудит стільки виробів, скільки треба, щоб відділ закрив норму дня ' +
      '(норма дня ÷ скільки аудитів у відділі зазвичай за день). Суворість — скільки браку знаходить порівняно з колегами в тих самих відділах: ' +
      'нижче — менше ніж ¾ від колег, вище — більше ніж на чверть. Менше 5 аудитів — мало даних. Чисті аудити — без жодного браку.</div>';
    if (!list.length) return '<section class="card">' + head + h.empty('Нікого не знайшли', 'Перевірте імʼя аудитора.') + note + '</section>';
    return '<section class="card">' + head + '<div class="tbl-box"><table class="tbl"><thead><tr><th>Аудитор</th><th class="n">Аудитів</th><th class="n">На день</th>' +
      '<th class="n">Вибірка проти норми</th><th>Суворість</th><th class="n">Чисті аудити</th><th>Останній аудит</th></tr></thead><tbody>' +
      list.map(function (a) {
        var open = pf.open === a.id, mute = a.active ? '' : ' style="color:var(--text-3)"', st = STRICT[a.strict];
        var lowSample = a.sampleRatio != null && a.sampleRatio < 0.9;
        var tr = '<tr data-act="pp-aud" data-id="' + esc(a.id) + '"' + (open ? ' class="sel"' : '') + ' aria-expanded="' + open + '"><td' + mute + '><span style="display:inline-flex;align-items:center;gap:6px">' +
          h.ic(open ? 'chevron-down' : 'chevron-right', 'ui-icon--sm') + '<b>' + esc(a.name) + '</b></span>' +
          (a.role === 'senior_auditor' ? '<span class="sub" style="padding-left:24px">старший аудитор</span>' : '') + (a.active ? '' : '<span class="sub" style="padding-left:24px">доступ вимкнено</span>') + '</td>' +
          '<td class="n"' + mute + '><b>' + a.audits + '</b></td><td class="n"' + mute + '>' + (a.perDay == null || !a.audits ? '—' : String(a.perDay).replace('.', ',')) + '</td>' +
          '<td class="n"' + (lowSample ? ' style="color:var(--warn);font-weight:700"' : mute) + '>' + (a.sampleRatio == null ? '—' : '×' + String(a.sampleRatio).replace('.', ',')) + '</td>' +
          '<td>' + h.badge(st[1], st[0]) + '</td><td class="n"' + mute + '>' + (a.cleanShare == null ? '—' : a.cleanShare + '%') + '</td><td' + mute + '>' + esc(lastText(a.lastAt)) + '</td></tr>';
        if (!open) return tr;
        var warn = a.strict === 'low' || lowSample, title = a.strict === 'low' && lowSample ? 'Перевіряє менше виробів і рідше знаходить брак' : a.strict === 'low' ? 'Знаходить помітно менше браку, ніж колеги' :
          lowSample ? 'Перевіряє менше виробів, ніж треба для норми' : a.strict === 'high' ? 'Знаходить більше браку, ніж колеги' : '';
        var text = warn ? 'Можна сходити разом на один аудит і порівняти, що знайде кожен.' : 'Варто подивитися його записи: можливо, він помічає те, що пропускають інші.';
        return tr + '<tr class="sel"><td colspan="7" style="padding:4px 16px 20px"><div style="display:flex;flex-direction:column;gap:12px">' +
          '<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">' +
          '<div class="kpi" style="background:var(--surface)"><span class="kpi__val">' + a.audits + '</span><span class="kpi__label">аудитів · ' + (a.perDay == null ? '—' : String(a.perDay).replace('.', ',')) + ' на день</span></div>' +
          '<div class="kpi" style="background:var(--surface)"><span class="kpi__val">' + h.num(a.checked) + '</span><span class="kpi__label">перевірено, шт · ' + (a.perAudit == null ? '—' : a.perAudit) + ' на аудит' + (a.normPerAudit != null ? ' при нормі ' + a.normPerAudit : '') + '</span></div>' +
          '<div class="kpi" style="background:var(--surface)"><span class="kpi__val"' + (a.strict === 'low' ? ' style="color:var(--warn)"' : '') + '>' + h.pct(a.pct) + '</span><span class="kpi__label">знайдено браку · ' + h.num(a.pieces) + ' шт · у колег ' + h.pct(a.peersPct) + '</span></div>' +
          '<div class="kpi" style="background:var(--surface)"><span class="kpi__val">' + (a.cleanShare == null ? '—' : a.cleanShare + '%') + '</span><span class="kpi__label">чистих аудитів · у колег ' + (a.peersCleanShare == null ? '—' : a.peersCleanShare + '%') + '</span></div></div>' +
          (title ? '<div class="banner' + (warn ? ' banner--warn' : '') + '" style="align-items:center">' + h.ic(warn ? 'warning' : 'info', 'icon') +
            '<div class="banner__body"><p class="banner__title">' + esc(title) + '</p><p class="banner__text">' + esc(text) + '</p></div>' +
            '<a class="btn btn--secondary btn--sm" href="#/history?auditor=' + encodeURIComponent(a.id) + '">Аудити: ' + esc(a.name) + '</a></div>'
            : '<a class="btn btn--secondary btn--sm" style="align-self:flex-start" href="#/history?auditor=' + encodeURIComponent(a.id) + '">' + h.ic('audit', 'ui-icon--sm') + 'Аудити: ' + esc(a.name) + '</a>') +
          '</div></td></tr>';
      }).join('') + '</tbody></table></div>' + note + '</section>';
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
