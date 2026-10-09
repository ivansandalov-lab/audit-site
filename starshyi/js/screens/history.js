(function (root) {
  'use strict';
  var P = root.P, h = P.sr.h, esc = P.esc, A = P.srAn;
  var STEP = 50;
  var KEYS = { dep: 'deps', product: 'product', defect: 'defect', worker: 'worker', auditor: 'auditor', q: 'q', mode: 'mode', day: 'day', order: 'order' };
  var hf = blank();
  function blank() { return { deps: [], product: '', defect: '', worker: '', auditor: '', q: '', mode: '', day: '', order: '', limit: STEP }; }

  function fromQuery(q) {
    if (!Object.keys(KEYS).some(function (k) { return q[k]; })) return;
    hf = blank();
    Object.keys(KEYS).forEach(function (k) { if (q[k]) hf[KEYS[k]] = k === 'dep' ? q[k].split(',') : q[k]; });
  }
  function syncUrl() {
    var parts = [];
    Object.keys(KEYS).forEach(function (k) { var v = hf[KEYS[k]]; if (k === 'dep') v = v.join(','); if (v) parts.push(k + '=' + encodeURIComponent(v)); });
    try { root.history.replaceState(null, '', '#/history' + (parts.length ? '?' + parts.join('&') : '')); } catch (e) { /* без історії — не страшно */ }
  }
  function payload(ctx) {
    return { locationId: ctx.loc.id, from: ctx.period.from, to: ctx.period.to, departments: hf.deps, product: hf.product, defect: hf.defect,
      workerCode: hf.worker, auditorId: hf.auditor, search: hf.q, mode: hf.mode, day: hf.day, orderNo: hf.order, limit: hf.limit };
  }

  function select(k, label, all, opts) {
    return '<label class="field" style="flex:1 1 200px"><span class="label">' + label + '</span><select class="input" data-change="hs-sel" data-k="' + k + '">' +
      '<option value="">' + all + '</option>' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (hf[k] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
  }
  function filters(r) {
    var o = r.options, extra = [];
    if (hf.day) extra.push(['day', 'День: ' + A.dshort(hf.day)]);
    if (hf.order) extra.push(['order', 'Замовлення ' + hf.order]);
    return '<section class="card" aria-label="Фільтри"><div class="field"><span class="label">Відділи <span style="font-weight:400;color:var(--text-3)">(можна кілька; «Усі» знімає вибір)</span></span>' +
      '<div class="chips" role="group" aria-label="Відділи"><button class="chip-pick hs-chip' + (hf.deps.length ? '' : ' chip-pick--on') + '" type="button" data-act="hs-dep" data-id="">Усі</button>' +
      r.departments.map(function (d) {
        var on = hf.deps.indexOf(d.id) >= 0;
        return '<button class="chip-pick hs-chip' + (on ? ' chip-pick--on' : '') + '" type="button" data-act="hs-dep" data-id="' + esc(d.id) + '" aria-pressed="' + on + '">' +
          (on ? h.ic('check', 'ui-icon--sm') : '') + esc(d.name) + '<small>' + d.count + '</small></button>'; }).join('') + '</div></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">' +
      select('product', 'Виріб', 'Усі вироби', o.products.map(function (x) { return [x, x]; })) +
      select('defect', 'Вид браку', 'Усі види', o.defects.map(function (x) { return [x, x]; })) +
      select('worker', 'Працівник', 'Усі працівники', o.workers.map(function (w) { return [w.code, w.code + ' · ' + w.name]; })) +
      select('auditor', 'Аудитор', 'Усі аудитори', o.auditors.map(function (u) { return [u.id, u.name]; })) +
      '<label class="field" style="flex:1.6 1 280px"><span class="label">Пошук</span><span class="search">' + h.ic('search', 'icon') +
      '<input class="input" data-input="hs-q" value="' + esc(hf.q) + '" placeholder="AUD-…, виріб, № замовлення, код працівника" style="padding-left:46px;font-size:16px"></span></label></div>' +
      '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><div class="chips" style="flex:1">' +
      [['defects', 'З браком'], ['clean', 'Без браку'], ['over', 'Понад норму ' + r.criticalPct + '%']].map(function (m) {
        var on = hf.mode === m[0];
        return '<button class="chip-pick hs-chip' + (on ? ' chip-pick--on' : '') + '" type="button" data-act="hs-mode" data-v="' + m[0] + '" aria-pressed="' + on + '">' + (on ? h.ic('check', 'ui-icon--sm') : '') + m[1] + '</button>';
      }).join('') +
      extra.map(function (x) { return '<span class="chip">' + esc(x[1]) + '<button class="chip__x" type="button" data-act="hs-x" data-k="' + x[0] + '" aria-label="Зняти фільтр">' + h.ic('close', 'ui-icon--sm') + '</button></span>'; }).join('') +
      '<span class="hint" style="margin-left:8px">Клік по дню на графіку чи виду браку додасть його сюди фільтром.</span></div>' +
      '<button class="btn btn--quiet btn--sm" type="button" data-act="hs-reset">' + h.ic('close', 'ui-icon--sm') + 'Скинути фільтри</button></div></section>';
  }

  function filterText(r) {
    var p = [];
    if (hf.deps.length) p.push(r.departments.filter(function (d) { return hf.deps.indexOf(d.id) >= 0; }).map(function (d) { return d.name; }).join(', '));
    if (hf.product) p.push(hf.product);
    if (hf.defect) p.push(hf.defect.toLowerCase());
    if (hf.worker) p.push('працівник ' + hf.worker);
    if (hf.auditor) { var u = r.options.auditors.filter(function (x) { return x.id === hf.auditor; })[0]; p.push('аудитор ' + (u ? u.name : hf.auditor)); }
    if (hf.order) p.push(hf.order);
    if (hf.q) p.push('«' + hf.q + '»');
    if (hf.mode) p.push({ defects: 'з браком', clean: 'без браку', over: 'понад норму' }[hf.mode]);
    return p.join(' · ');
  }
  function results(r) {
    var an = r.analytics, ft = filterText(r);
    var counts = '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span><b style="font-variant-numeric:tabular-nums">' + h.num(r.total) + '</b> ' +
      P.plural(r.total, 'аудит знайдено', 'аудити знайдено', 'аудитів знайдено') + '</span>' +
      h.badge('з ' + r.base + (hf.deps.length ? ' у вибраних відділах' : '') + ' за період') +
      (r.over ? '<span class="badge badge--danger">' + h.ic('warning', 'ui-icon--sm') + 'понад норму — ' + r.over + '</span>' : '') +
      '<span class="hint" style="margin-left:auto">показано ' + r.items.length + ' · найновіші вгорі</span></div>';
    if (!r.total) {
      return counts + '<section class="card">' + P.state.empty('search', 'Нічого не знайдено', 'Спробуйте зняти частину фільтрів або взяти довший період — 90 дн.',
        '<button class="btn btn--secondary btn--sm" type="button" data-act="hs-reset">Скинути фільтри</button>') + '</section>' + trash(r);
    }
    var banner = hf.mode === 'defects' ? '<b>Увімкнено «З браком»:</b> аудити без браку не враховано, тому % вищий, ніж в «Аналітиці». Вимкніть — і числа порахуються по всіх аудитах вибірки.'
      : hf.mode === 'over' ? '<b>Увімкнено «Понад норму»:</b> лише аудити з браком понад ' + r.criticalPct + '%, тому % тут завжди високий.'
      : hf.mode === 'clean' ? '<b>Увімкнено «Без браку»:</b> тут лише чисті аудити — браку в них нуль.' : '';
    var tmax = an.types.length ? an.types[0].pieces : 1;
    var card = '<section class="card" aria-label="Аналітика відфільтрованих аудитів"><div><h2 class="card-title">Аналітика відфільтрованих аудитів</h2>' +
      '<p class="hint">Рахує все, що відібрано фільтрами: ' + A.n(an.audits, 'аудит', 'аудити', 'аудитів') + (ft ? ' · ' + esc(ft) : '') + ' · ' + esc(A.span(r.from, r.to)) + '</p></div>' +
      '<div class="kpis an-kpis3">' + h.kpi(h.num(an.audits), P.plural(an.audits, 'аудит', 'аудити', 'аудитів') + ' · у ' + an.daysWithAudits + ' ' + P.plural(an.daysWithAudits, 'дні', 'днях', 'днях')) +
      h.kpi(h.num(an.checked), 'перевірено, шт') + h.kpi(h.num(an.rejected), 'брак, шт', an.rejected ? 'danger' : '') +
      h.kpi(h.pct(an.pct), 'брак ÷ перевірено') + h.kpi(h.num(an.over), 'понад норму · ' + (an.audits ? Math.round(an.over / an.audits * 100) : 0) + '% аудитів вибірки', an.over ? 'danger' : '') +
      h.kpi(h.num(an.daysWithAudits), 'днів з аудитами · з ' + an.workDays + ' робочих') + '</div>' +
      (banner ? '<div class="banner">' + h.ic('info', 'icon') + '<div class="banner__body"><p class="banner__text">' + banner + '</p></div></div>' : '') +
      '<div class="row"><div class="col--wide" style="display:flex;flex-direction:column;gap:10px"><div><h3 class="card-title" style="font-size:18px">Брак у вибірці по днях, шт</h3>' +
      '<p class="hint">' + esc(A.span(r.from, r.to)) + (an.days.length > 1 ? ' · клік по стовпчику — фільтр «день»' : '') + '</p></div>' +
      '<div class="legend"><span class="an-key"><i style="background:#6F829B"></i>Брак за день</span><span class="an-key"><i style="height:3px;background:var(--line-mid)"></i>Аудитів у вибірці не було</span></div>' +
      A.bars(an.days.map(function (d) {
        return { v: d.rejected, none: !d.audited, sel: d.day === hf.day, act: an.days.length > 1 && d.audited ? 'hs-day' : '', attrs: ' data-day="' + d.day + '"',
          title: h.dayShort(d.day) + ' · ' + (d.audited ? d.rejected + ' шт · ' + A.n(d.audits, 'аудит', 'аудити', 'аудитів') : 'аудитів не було') };
      }), { height: 220, label: 'Брак у вибірці по днях' }) + A.xLabels(an.days.map(function (d) { return d.day; })) + '</div>' +
      '<div class="col" style="display:flex;flex-direction:column;gap:10px"><div><h3 class="card-title" style="font-size:18px">Види браку у вибірці</h3>' +
      '<p class="hint">' + h.num(an.rejected) + ' шт · клік по виду ставить фільтр «Вид браку»</p></div>' +
      (an.types.length ? A.levels(an.levels) + '<div>' + an.types.slice(0, 8).map(function (t, i) {
        return A.hbar({ rank: i + 1, name: t.name, sub: (t.otherDepts.length ? 'брак ' + esc(t.otherDepts.join(', ')) + ' · ' : '') + h.lvl(t.level), share: t.pieces / tmax, n: t.pieces,
          cols: '22px minmax(0, 1fr) minmax(0, 0.7fr) 40px', act: 'hs-defect', attrs: ' data-v="' + esc(t.name) + '"' });
      }).join('') + '</div>' : '<p class="hint">У вибірці браку немає.</p>') + '</div></div></section>';
    var perDay = {}; an.days.forEach(function (d) { perDay[d.day] = d.audits; });
    var rows = '', cur = null;
    r.items.forEach(function (a) {
      if (a.day !== cur) { cur = a.day; rows += '<tr><th colspan="6" class="hs-dayrow">' + esc(A.dcap(a.day)) + ' · ' + A.n(perDay[a.day] || 0, 'аудит', 'аудити', 'аудитів') + '</th></tr>'; }
      var it = a.items, first = it[0] || { productName: '—' };
      rows += '<tr data-act="hs-open" data-id="' + esc(a.id) + '"' + (a.over ? ' class="exceed"' : '') + '><td><b>' + P.fmt.time(a.createdAt) + '</b><span class="sub">' +
        (a.auditorRole === 'senior_auditor' ? 'старший: ' : 'аудитор: ') + esc(a.auditorName) + '</span></td><td>' + esc(a.departmentName) + '</td>' +
        '<td>' + esc(first.productName + (first.orderNo ? ' · ' + first.orderNo : '')) + it.slice(1).map(function (x) { return '<span class="sub">' + esc(x.productName + (x.orderNo ? ' · ' + x.orderNo : '')) + '</span>'; }).join('') + '</td>' +
        '<td class="n">' + h.num(a.checked) + '</td><td class="n"><b' + (a.over ? ' style="color:var(--danger)"' : '') + '>' + a.rejected + '</b><span class="sub">' + h.pct(a.pct) + (a.over ? ' · понад норму' : '') + '</span></td>' +
        '<td style="text-align:center;color:var(--text-2)">' + (a.photos || a.hasComment || a.edited ? '<span style="display:inline-flex;align-items:center;gap:10px">' +
          (a.photos ? '<span style="display:inline-flex;align-items:center;gap:4px" title="фото">' + h.ic('photo', 'ui-icon--sm') + a.photos + '</span>' : '') +
          (a.hasComment ? '<span title="є коментар">' + h.ic('feedback', 'ui-icon--sm') + '</span>' : '') +
          (a.edited ? '<span title="виправлено">' + h.ic('edit', 'ui-icon--sm') + '</span>' : '') + '</span>' : '<span style="color:var(--text-3)">—</span>') + '</td></tr>';
    });
    var left = r.total - r.items.length;
    var table = '<section class="card" style="gap:16px"><div class="tbl-box"><table class="tbl"><thead><tr><th>Дата й час</th><th>Відділ</th><th>Виріб · замовлення</th>' +
      '<th class="n">Перевірено</th><th class="n">Брак</th><th style="text-align:center">Фото, коментар</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">' + (left > 0 ? '<button class="btn btn--secondary" type="button" data-act="hs-more">' + h.ic('chevron-down') + 'Показати ще ' + Math.min(left, STEP) + '</button>' : '') +
      '<p class="hint">Клік по рядку — увесь аудит збоку: перевірка, брак, фото, правка й видалення.</p></div></section>';
    return counts + card + table + trash(r);
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

  function openAudit(id) {
    var audit = null;
    var layer = P.sr.drawer({ title: 'Аудит ' + id, sub: 'Завантаження…', body: h.loading(),
      on: { edit: function () { editAudit(audit); }, del: function () { deleteAudit(audit); }, retry: function () { load(); } } });
    function load() {
      layer.body(h.loading());
      P.srv('auditGet', { id: id }).then(function (r) {
        if (layer.closed) return;
        if (!r.ok) { layer.body(r.code === 'not_found' ? h.empty('Аудиту немає', 'Можливо, його видалили — подивіться в корзині внизу історії.') : h.error(r)); return; }
        audit = r.audit;
        var day = P.fmt.dayKey(audit.createdAt);
        layer.el.querySelector('.modal__title').textContent = 'Аудит ' + audit.id + ' · ' + P.fmt.time(audit.createdAt) + ' · ' + audit.departmentName;
        layer.el.querySelector('.modal__head .hint').textContent = A.dcap(day) + ' · аудитор: ' + audit.auditorName;
        layer.body(auditBody(audit));
        if (audit.canEdit) {
          layer.el.querySelector('.drawer').insertAdjacentHTML('beforeend', '<div class="modal__foot" style="margin-top:auto">' +
            '<button class="btn btn--secondary btn--sm" type="button" data-act="del" style="color:var(--danger);border-color:var(--danger-line)">' + h.ic('delete', 'ui-icon--sm') + 'Видалити</button>' +
            '<button class="btn btn--primary btn--sm" type="button" data-act="edit" style="margin-left:auto">' + h.ic('edit', 'ui-icon--sm') + 'Виправити</button></div>');
        }
      });
    }
    load();
  }
  function auditBody(a) {
    var over = a.pct != null && a.pct > 5;
    var kpis = '<div class="kpis an-kpis3" style="grid-template-columns:repeat(3,minmax(0,1fr))">' + h.kpi(h.num(a.checked), 'перевірено, шт') +
      h.kpi(h.num(a.rejected), 'брак, шт', a.rejected ? 'danger' : '') + h.kpi(h.pct(a.pct), over ? 'понад норму 5%' : 'брак ÷ перевірено', over ? 'danger' : '') + '</div>';
    var items = '<div style="display:flex;flex-direction:column;gap:6px"><p class="group-label" style="padding:0">Перевірка</p><table class="table"><thead><tr><th>Виріб · замовлення</th><th class="n">Перевірено</th><th class="n">Брак</th></tr></thead><tbody>' +
      a.items.map(function (i) { return '<tr><td>' + esc(i.productName) + (i.orderNo ? '<span class="sub">' + esc(i.orderNo) + '</span>' : '') + '</td><td class="n">' + h.num(i.qty) + '</td><td class="n">' + h.num(i.rejected) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
    var defects = '<div style="display:flex;flex-direction:column;gap:8px"><p class="group-label" style="padding:0">Брак · ' + h.num(a.rejected) + ' шт</p>' + (a.defects.length ? a.defects.map(function (d) {
      return '<div class="entry ' + (d.otherDept ? 'entry--other' : 'entry--defect') + '" style="gap:4px"><div class="entry__head"><p class="entry__title">' + esc(d.defectTypeName) + '</p>' +
        (d.otherDept ? h.badge('брак іншого відділу', 'info') : '') + '<b style="font-variant-numeric:tabular-nums;margin-left:auto">' + d.qty + ' шт</b></div>' + h.lvl(d.level) +
        '<span class="hint">' + esc(d.productName) + ' · ' + (d.workerCode ? 'винний працівник: ' + esc(d.workerName) + ' · ' + esc(d.workerCode) : 'працівника не вказали') + '</span>' +
        (d.otherDept ? '<b style="font-size:14px;color:var(--info)">Піде відділу ' + esc(d.departmentName) + ' — у його аналітику</b>' : '') + '</div>';
    }).join('') : '<p class="hint">Браку не знайшли — чистий аудит.</p>') + '</div>';
    var workers = '<div style="display:flex;flex-direction:column;gap:8px"><p class="group-label" style="padding:0">Перевірені працівники · ' + a.checkedWorkers.length + '</p><div class="chips">' +
      a.checkedWorkers.map(function (w) { return '<span class="chip chip--plain">' + esc(w.code ? w.name + ' · ' + w.code : w.name) + '</span>'; }).join('') + '</div></div>';
    var comment = a.comment ? '<div style="display:flex;flex-direction:column;gap:8px"><p class="group-label" style="padding:0">Коментар</p><p class="note-box" style="margin:0;font-size:16px;color:var(--text)">' + esc(a.comment) + '</p></div>' : '';
    var photos = a.defects.filter(function (d) { return d.photo; });
    var ph = photos.length ? '<div style="display:flex;flex-direction:column;gap:8px"><p class="group-label" style="padding:0">Фото браку · ' + photos.length + '</p><div class="hs-photos">' +
      photos.map(function (d) { return '<div class="hs-photo" title="' + esc(d.photo.name || '') + '">' + h.ic('photo') + '<span>фото · ' + esc(d.defectTypeName) + '</span></div>'; }).join('') +
      '</div><p class="hint">У тестовій версії замість фото — заглушки.</p></div>' : '';
    var info = a.canEdit ? '<div class="banner">' + h.ic('info', 'icon') + '<div class="banner__body"><p class="banner__text"><b>Ви можете правити цей аудит будь-коли</b> — ви старший цієї локації. ' +
      'Аудитор править свій аудит лише 15 хвилин після запису.</p></div></div>' : '';
    return kpis + items + defects + workers + comment + ph + info;
  }
  function editAudit(a) {
    if (!a) return;
    P.sr.modal({ size: 'frame', title: 'Виправити аудит · ' + a.departmentName + ' · ' + P.fmt.time(a.createdAt), sub: esc(a.id + ' · ' + h.dayLong(P.fmt.dayKey(a.createdAt))),
      body: '<iframe class="sr-frame" title="Форма виправлення аудиту" src="../pratsivnyk/index.html?embed=1#/audit/' + encodeURIComponent(a.id) + '/edit"></iframe>',
      onMount: function (el) { el.querySelector('.ov-body').style.padding = '0'; } });
  }
  function deleteAudit(a) {
    if (!a) return;
    var when = P.fmt.time(a.createdAt) + ' · ' + a.departmentName;
    P.sr.modal({ size: 'sm', title: 'Видалити аудит ' + when + '?',
      body: '<p class="dlg__text" style="font-size:18px;color:var(--text);margin:0"><b>Аудит зникне з аналітики й історії.</b> 30 днів його можна повернути з корзини.</p>' +
        '<div class="facts" style="gap:4px"><b>' + esc(a.id) + '</b><span class="hint">' + esc(A.dcap(P.fmt.dayKey(a.createdAt)) + ', ' + P.fmt.time(a.createdAt) + ' · аудитор: ' + a.auditorName) + '</span>' +
        '<span class="hint">' + esc(a.products.join(', ')) + ' · перевірено ' + h.num(a.checked) + ' шт · брак ' + h.num(a.rejected) + ' шт</span></div>' +
        '<label class="field"><span class="label">Причина <span style="font-weight:400;color:var(--text-3)">(необовʼязково)</span></span>' +
        '<input class="input" data-reason maxlength="300" placeholder="Наприклад: записали двічі"></label><p class="err" data-err hidden></p>',
      foot: '<button class="btn btn--quiet" type="button" data-ov-close style="margin-left:auto">Залишити</button>' +
        '<button class="btn btn--danger" type="button" data-act="go">' + h.ic('delete', 'ui-icon--sm') + 'Видалити</button>',
      on: { go: function (t, e, layer) {
        t.disabled = true;
        P.srv('srAuditDelete', { id: a.id, reason: layer.el.querySelector('[data-reason]').value }).then(function (r) {
          if (!r.ok) { t.disabled = false; var er = layer.el.querySelector('[data-err]'); er.hidden = false; er.textContent = (r.errors && r.errors[0] ? r.errors[0].message : r.error) || 'Не вдалося видалити.'; return; }
          P.toast('ok', 'Аудит видалено · ' + when, 'Повернути можна з «Корзини» внизу історії аудитів (' + r.trashCount + ').');
          P.emit('kd:changed'); P.sr.render();
        });
      } } });
  }

  P.srHist = { openAudit: openAudit };

  P.sr.screen('/history', { tab: 'history', title: 'Історія аудитів', render: function (ctx) {
    fromQuery(ctx.query || {});
    var timer = null, req = 0;
    function load(first, keep) {
      syncUrl();
      var my = ++req, box = ctx.el.querySelector('#hs-res');
      if (box && !first) box.style.opacity = '.55';
      P.srv('srHistory', payload(ctx)).then(function (r) {
        if (!ctx.alive() || my !== req) return;
        if (!r.ok) { ctx.el.innerHTML = h.error(r); return; }
        if (first || !ctx.el.querySelector('#hs-res')) ctx.el.innerHTML = '<div id="hs-filters"></div><div id="hs-res" style="display:flex;flex-direction:column;gap:20px"></div>';
        if (!keep || !ctx.el.querySelector('#hs-filters').innerHTML) ctx.el.querySelector('#hs-filters').innerHTML = filters(r);
        box = ctx.el.querySelector('#hs-res'); box.style.opacity = ''; box.innerHTML = results(r);
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
    ctx.on('hs-q', function (t) { clearTimeout(timer); timer = setTimeout(function () { hf.q = t.value.trim(); hf.limit = STEP; load(false, true); }, 300); });
    ctx.on('hs-mode', function (t) { var v = t.getAttribute('data-v'); hf.mode = hf.mode === v ? '' : v; change(); });
    ctx.on('hs-x', function (t) { hf[t.getAttribute('data-k')] = ''; change(); });
    ctx.on('hs-reset', function () { hf = blank(); change(); });
    ctx.on('hs-day', function (t) { hf.day = t.getAttribute('data-day'); change(); });
    ctx.on('hs-defect', function (t) { hf.defect = t.getAttribute('data-v'); change(); });
    ctx.on('hs-more', function () { hf.limit += STEP; load(false, true); });
    ctx.on('hs-open', function (t) { openAudit(t.getAttribute('data-id')); });
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
