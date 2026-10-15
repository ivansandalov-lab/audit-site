(function (root) {
  'use strict';
  var P = root.P, h = P.sr.h, esc = P.esc, A = P.srAn;

  function helperBadge(on) { return on ? h.badge('допомога', 'info') : ''; }

  function openAudit(id) {
    var audit = null;
    var layer = P.sr.drawer({ title: 'Аудит ' + id, sub: 'Завантаження…', body: h.loading(),
      on: { edit: function () { editAudit(audit); }, del: function () { deleteAudit(audit); }, retry: function () { load(); },
        'ph-open': function (t) { openPhoto(photosOf(audit), Number(t.getAttribute('data-i')) || 0); } } });
    function load() {
      layer.body(h.loading());
      P.srv('auditGet', { id: id }).then(function (r) {
        if (layer.closed) return;
        if (!r.ok) { layer.body(r.code === 'not_found' ? h.empty('Аудиту немає', 'Видалені аудити — у корзині внизу історії.') : h.error(r)); return; }
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
    var crit = a.criticalPct != null ? a.criticalPct : 5, over = a.pct != null && a.pct > crit;   // поріг — з правил адміністратора
    var kpis = '<div class="kpis hs-kpis hs-kpis--3">' + A.kpi(h.num(a.checked), 'перевірено, шт', 'term.checked') +
      A.kpi(h.num(a.rejected), 'брак, шт', 'term.rejected', a.rejected ? 'danger' : '') + A.kpi(h.pct(a.pct), over ? 'брак, % · понад норму ' + String(crit).replace('.', ',') + '%' : 'брак, % = брак, шт ÷ перевірено, шт', 'term.rate', over ? 'danger' : '') + '</div>';
    var items = '<div class="hs-block"><p class="group-label" style="padding:0">Перевірка</p><table class="table"><thead><tr><th>Виріб · замовлення</th><th class="n">Перевірено, шт</th><th class="n">Брак, шт</th></tr></thead><tbody>' +
      a.items.map(function (i) { return '<tr><td>' + esc(i.productName) + (i.orderNo ? '<span class="sub">' + esc(i.orderNo) + '</span>' : '') + '</td><td class="n">' + h.num(i.qty) + '</td><td class="n">' + h.num(i.rejected) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
    var other = a.defects.some(function (d) { return d.otherDept; }), helpers = a.defects.concat(a.checkedWorkers).some(function (x) { return x.helper; });
    var defects = '<div class="hs-block"><p class="group-label" style="padding:0">Види браку · ' + h.num(a.rejected) + ' шт' + (a.defects.length ? A.q('term.levels') : '') +
      (other ? A.q('term.otherDept') : '') + '</p>' + (a.defects.length ? a.defects.map(function (d) {
      return '<div class="entry ' + (d.otherDept ? 'entry--other' : 'entry--defect') + '" style="gap:4px"><div class="entry__head"><p class="entry__title">' + esc(d.defectTypeName) + '</p>' +
        (d.otherDept ? h.badge('брак іншого відділу', 'info') : '') + '<b style="font-variant-numeric:tabular-nums;margin-left:auto">' + d.qty + ' шт</b></div>' + h.lvl(d.level) +
        '<span class="hint hs-who">' + esc(d.productName) + ' · ' + (d.workerCode ? 'працівник: ' + esc(d.workerName) : 'працівника не вказано') + helperBadge(d.helper) + '</span>' +
        (d.otherDept ? '<b style="font-size:14px;color:var(--info)">Рахується відділу ' + esc(d.departmentName) + ' (брак зробили там)</b>' : '') + '</div>';
    }).join('') : '<p class="hint">Браку немає</p>') + '</div>';
    var workers = '<div class="hs-block"><p class="group-label" style="padding:0">Перевірені працівники · ' + a.checkedWorkers.length + (helpers ? A.q('term.helper') : '') + '</p><div class="chips">' +
      a.checkedWorkers.map(function (w) { return '<span class="chip chip--plain hs-wchip">' + esc(w.name) + helperBadge(w.helper) + '</span>'; }).join('') + '</div></div>';
    var comment = a.comment ? '<div class="hs-block"><p class="group-label" style="padding:0">Коментар</p><p class="note-box" style="margin:0;font-size:16px;color:var(--text)">' + esc(a.comment) + '</p></div>' : '';
    var shots = photosOf(a), photos = a.defects.filter(function (d) { return d.photo && !(d.photos && d.photos.length); });
    var ph = shots.length ? '<div class="hs-block"><p class="group-label" style="padding:0">Фото браку · ' + shots.length + '</p><div class="hs-ph-grid">' +
      shots.map(function (x, i) {
        return '<button class="hs-ph-btn" type="button" data-act="ph-open" data-i="' + i + '" aria-label="Фото ' + (i + 1) + ' · ' + esc(x.type) + ' — на весь екран">' +
          '<img src="' + esc(x.src) + '" alt="Фото браку · ' + esc(x.type) + '" loading="lazy"></button>';
      }).join('') + '</div><p class="hs-ph-cap">Натисніть фото — на весь екран.</p></div>' : '';
    ph += photos.length ? '<div class="hs-block"><p class="group-label" style="padding:0">Фото браку (без зображення) · ' + photos.length + '</p><div class="hs-photos">' +
      photos.map(function (d) { return '<div class="hs-photo" title="' + esc(d.photo.name || '') + '">' + h.ic('photo') + '<span>фото · ' + esc(d.defectTypeName) + '</span></div>'; }).join('') +
      '</div><p class="hint">У тестових аудитах замість фото — заглушки.</p></div>' : '';
    var info = a.canEdit ? '<div class="banner">' + h.ic('info', 'icon') + '<div class="banner__body"><p class="banner__text"><b>Ви можете виправити цей аудит будь-коли</b> — ви старший цієї локації. ' +
      'Аудитор може виправити свій аудит лише протягом ' + (a.editWindowMin || 15) + ' хв після запису.</p></div></div>' : '';
    return kpis + items + defects + workers + comment + ph + info;
  }
  function photosOf(a) {
    var out = [];
    (a ? a.defects : []).forEach(function (d) {
      (Array.isArray(d.photos) ? d.photos : []).forEach(function (src) { if (/^data:image\/jpeg;base64,/.test(src)) out.push({ src: src, type: d.defectTypeName }); });
    });
    return out;
  }
  function openPhoto(list, i) {
    if (!list.length) return;
    function body(k) { return '<div class="hs-ph-full"><img src="' + esc(list[k].src) + '" alt="Фото браку · ' + esc(list[k].type) + '"></div>'; }
    function foot(k) {
      return list.length < 2 ? '' : '<button class="btn btn--secondary btn--sm" type="button" data-act="ph-prev"' + (k ? '' : ' disabled') + '>' + h.ic('chevron-left', 'ui-icon--sm') + 'Попереднє</button>' +
        '<span class="hint" style="margin:0 auto">' + (k + 1) + ' з ' + list.length + '</span>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-act="ph-next"' + (k < list.length - 1 ? '' : ' disabled') + '>Наступне' + h.ic('chevron-right', 'ui-icon--sm') + '</button>';
    }
    function show(layer, k) { i = k; layer.body(body(k)); layer.foot(foot(k)); layer.el.querySelector('.modal__title').textContent = 'Фото браку · ' + list[k].type; }
    P.sr.modal({ title: 'Фото браку · ' + list[i].type, body: body(i), foot: foot(i) || ' ',
      on: { 'ph-prev': function (t, e, layer) { if (i > 0) show(layer, i - 1); }, 'ph-next': function (t, e, layer) { if (i < list.length - 1) show(layer, i + 1); } } });
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
})(window);
