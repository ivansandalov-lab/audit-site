(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, f = P.fmt;
  var AF = P.AF = P.AF || {};
  var SEV = { 1: 'незначний', 2: 'значний', 3: 'критичний' };

  AF.dept = function (F, id) { return F.ctx.departments.filter(function (d) { return d.id === id; })[0] || null; };
  AF.product = function (F, id) { return F.ctx.products.filter(function (p) { return p.id === id; })[0] || null; };
  AF.defType = function (F, id) { return F.ctx.defectTypes.filter(function (t) { return t.id === id; })[0] || null; };
  AF.worker = function (F, code) { return F.ctx.workers.filter(function (w) { return w.code === code; })[0] || null; };
  AF.sevLabel = function (s) { return SEV[s] || ''; };
  AF.itemLabel = function (F, it) {
    var p = AF.product(F, it.productId);
    return (p ? p.name : 'Виріб не обрано') + (it.orderNo ? ' · ' + it.orderNo : '');
  };
  AF.totals = function (F) {
    var checked = 0, rejected = 0, other = 0;
    F.items.forEach(function (it) {
      var q = parseInt(it.qty, 10) || 0; checked += q;
      if (it.rejected !== '' && it.rejected != null) { rejected += Math.min(parseInt(it.rejected, 10) || 0, q); return; }
      if (F.mode !== 'defects') return;
      var sum = 0;
      F.defects.forEach(function (d) { if (d.itemKey === it.key) d.guilty.forEach(function (g) { sum += parseInt(g.qty, 10) || 0; }); });
      rejected += Math.min(sum, q);
    });
    if (F.mode === 'defects') F.defects.forEach(function (d) { if (d.other) d.guilty.forEach(function (g) { other += parseInt(g.qty, 10) || 0; }); });
    return { checked: checked, rejected: rejected, other: other, pct: checked ? Math.round(rejected / checked * 1000) / 10 : null };
  };

  function err(F, key) { var m = F.errors[key]; return m ? '<p class="err" role="alert">' + P.ic('error') + esc(m) + '</p>' : ''; }
  function selectBtn(attrs, text, placeholder, invalid) {
    return '<button type="button" class="select-btn' + (text ? '' : ' is-empty') + (invalid ? ' is-invalid' : '') + '" ' + attrs + '>' +
      '<span class="select-btn__text">' + esc(text || placeholder) + '</span></button>';
  }
  function numInput(attrs, value, label, invalid, hint) {
    return '<label class="ui-field"><span class="ui-label">' + label + '</span><input class="ui-input qty' + (invalid ? ' is-invalid' : '') +
      '" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" ' + attrs + ' value="' + esc(value) + '">' +
      (hint ? '<span class="ui-hint">' + esc(hint) + '</span>' : '') + '</label>';
  }
  function deptNorm(n) {
    var left = n.sampleTarget - n.todayChecked;
    return left > 0 ? '<span class="pick-btn__sub">Ще перевірити: <b>' + f.num(left) + ' шт</b></span>'
      : '<span class="pick-btn__sub pick-btn__sub--ok">' + P.ic('check', 'ui-icon--sm') + 'Норму виконано</span>';
  }
  AF.blockOf = function (F, no) { return (F.ctx.orderBlocks || []).filter(function (b) { return b.orders.indexOf(no) >= 0; })[0] || null; };
  function blockLine(b, mark) {
    return b.orders.map(function (o) { return o === mark ? '<mark class="hl">' + esc(o) + '</mark>' : esc(o); }).join(', ');
  }
  var SEC_FIELDS = { defects: ['defects', 'mode'] };
  function sec(F, id, num, title, hint, body, done) {
    var ids = SEC_FIELDS[id] || [id];
    var bad = Object.keys(F.errors).some(function (k) { return ids.some(function (x) { return k === x || k.indexOf(x + '[') === 0 || k.indexOf(x + '.') === 0; }); });
    var ok = done && !bad;   // секція з помилкою не показує галочку «готово»
    return '<section class="ui-card form-sec' + (ok ? ' is-done' : '') + (bad ? ' is-invalid' : '') + '" id="sec-' + id + '">' +
      '<div class="card-head"><span class="form-sec__num">' + (ok ? P.ic('check', 'ui-icon--sm') : num) + '</span>' +
      '<h2 class="card-title">' + esc(title) + '</h2></div>' + (hint ? '<p class="form-sec__hint">' + esc(hint) + '</p>' : '') + body + '</section>';
  }

  function secDept(F) {
    var norms = {};
    (F.ctx.norms || []).forEach(function (n) { norms[n.departmentId] = n; });
    var body = '<div class="pick-grid">' + F.ctx.departments.map(function (d) {
      var n = norms[d.id], locked = F.editId && d.id !== F.departmentId;
      return '<button type="button" class="pick-btn" data-a="dept" data-v="' + esc(d.id) + '" aria-pressed="' + (F.departmentId === d.id) + '"' + (locked ? ' disabled' : '') + '>' + esc(d.name) +
        (n && n.sampleTarget ? deptNorm(n) : '') + '</button>';
    }).join('') + '</div>' + err(F, 'departmentId');
    return sec(F, 'departmentId', 1, 'Відділ', F.editId ? 'Відділ лишається тим самим. Для іншого відділу запишіть новий аудит.' : 'Де перевіряєте. Під відділом видно, скільки ще перевірити сьогодні.', body, !!F.departmentId);
  }
  function secOrders(F) {
    var body = '<div class="chips-input">' + F.orders.map(function (o) {
      return '<span class="ui-chip is-selected">' + esc(o) + '<button type="button" class="ui-chip__remove" data-a="order-del" data-v="' + esc(o) + '" aria-label="Прибрати ' + esc(o) + '">' + P.ic('close', 'ui-icon--sm') + '</button></span>';
    }).join('') + (F.orders.length < Number(F.ctx.limits.maxOrders) ? '<button type="button" class="ui-btn ui-btn--secondary ui-btn--sm" data-a="order-add">' + P.ic('add') + 'Додати замовлення</button>' : '') + '</div>' + err(F, 'orders');
    body += F.orders.map(function (o) {
      var whole = (F.ctx.orderBlocks || []).filter(function (x) { return x.name === o; })[0];
      if (whole) return '<p class="form-sec__hint"><b>' + esc(whole.name) + '</b>: ' + blockLine(whole) + '.</p>';
      var b = AF.blockOf(F, o);
      return b ? '<p class="form-sec__hint">' + esc(o) + ' входить у блок <b>' + esc(b.name) + '</b>: ' + blockLine(b, o) + '.</p>' : '';
    }).join('');
    return sec(F, 'orders', 2, 'Замовлення', 'Можна пропустити. Додайте до ' + Number(F.ctx.limits.maxOrders) + ' замовлень або цілий блок.', body, F.orders.length > 0);
  }
  function secItems(F) {
    var many = F.orders.length > 1;
    var body = '<div class="stack">' + F.items.map(function (it, i) {
      var p = AF.product(F, it.productId), pre = 'items[' + i + ']';
      return '<div class="entry"><div class="entry__head"><h3 class="entry__title">Виріб ' + (i + 1) + '</h3>' +
        '<button type="button" class="icon-btn" data-a="item-del" data-k="' + esc(it.key) + '" aria-label="Прибрати виріб ' + (i + 1) + '">' + P.ic('delete') + '</button></div>' +
        '<div class="entry__grid"><div class="ui-field span-2"><span class="ui-label">Виріб</span>' +
        selectBtn('data-a="item-product" data-k="' + esc(it.key) + '"', p && p.name, 'Оберіть виріб', F.errors[pre + '.productId']) + '</div>' +
        (many ? '<div class="ui-field span-2"><span class="ui-label">Замовлення</span>' +
          selectBtn('data-a="item-order" data-k="' + esc(it.key) + '"', it.orderNo, 'Оберіть замовлення', F.errors[pre + '.orderNo']) + '</div>' : '') +
        numInput('data-in="qty" data-k="' + esc(it.key) + '"', it.qty, 'Перевірено, шт', F.errors[pre + '.qty']) +
        numInput('data-in="rejected" data-k="' + esc(it.key) + '"', it.rejected, 'Відбраковано, шт', F.errors[pre + '.rejected']) +
        '</div>' + err(F, pre + '.productId') + err(F, pre + '.orderNo') + err(F, pre + '.qty') + err(F, pre + '.rejected') + err(F, pre) + '</div>';
    }).join('') + '</div>' +
      (F.items.length < F.ctx.limits.maxProducts ? '<button type="button" class="ui-btn ui-btn--secondary" data-a="item-add">' + P.ic('add') + 'Додати виріб</button>' : '') + err(F, 'items');
    var ok = F.items.some(function (it) { return it.productId && parseInt(it.qty, 10) > 0; });
    return sec(F, 'items', 3, 'Перевірені вироби', 'Що перевірили і скільки штук.', body, ok);
  }
  function secWorkers(F) {
    var body = '<div class="chips-input">' + F.workers.map(function (c) {
      var w = AF.worker(F, c);
      return '<span class="ui-chip is-selected">' + esc(c === '' ? 'Невідомий працівник' : w ? w.name + ' · ' + c : c) + '<button type="button" class="ui-chip__remove" data-a="worker-del" data-v="' + esc(c) + '" aria-label="Прибрати ' + esc(c) + '">' + P.ic('close', 'ui-icon--sm') + '</button></span>';
    }).join('') + '<button type="button" class="ui-btn ui-btn--secondary ui-btn--sm" data-a="worker-add"' + (F.departmentId ? '' : ' disabled') + '>' + P.ic('people') + (F.workers.length ? 'Змінити' : 'Обрати працівників') + '</button></div>' +
      (F.departmentId ? '' : '<p class="form-sec__hint">Спершу оберіть відділ.</p>') + err(F, 'checkedWorkers');
    return sec(F, 'checkedWorkers', 4, 'Перевірені працівники', 'Чию роботу перевіряли. Немає людини в списку — попросіть старшого аудитора додати.', body, F.workers.length > 0);
  }
  function defectCard(F, d, i) {
    var pre = 'defects[' + i + ']', it = F.items.filter(function (x) { return x.key === d.itemKey; })[0], t = AF.defType(F, d.defectTypeId), src = AF.dept(F, d.departmentId);
    var owner = '<div class="ui-seg ui-seg--sm" role="group" aria-label="Чий брак">' +
      '<button type="button" class="ui-seg__btn" data-a="def-owner" data-v="own" data-k="' + esc(d.key) + '" aria-pressed="' + !d.other + '">Наш відділ</button>' +
      '<button type="button" class="ui-seg__btn" data-a="def-owner" data-v="other" data-k="' + esc(d.key) + '" aria-pressed="' + !!d.other + '">Інший відділ</button></div>';
    return '<div class="entry entry--defect' + (d.other ? ' entry--other' : '') + '"><div class="entry__head"><h3 class="entry__title">Брак ' + (i + 1) + '</h3>' +
      '<button type="button" class="icon-btn" data-a="def-del" data-k="' + esc(d.key) + '" aria-label="Прибрати брак ' + (i + 1) + '">' + P.ic('delete') + '</button></div>' + owner +
      '<div class="entry__grid">' +
      (d.other ? '<div class="ui-field span-2"><span class="ui-label">Звідки брак (відділ)</span>' +
        selectBtn('data-a="def-dept" data-k="' + esc(d.key) + '"', src && src.name, 'Оберіть відділ', F.errors[pre + '.departmentId']) + '</div>' : '') +
      '<div class="ui-field span-2"><span class="ui-label">На якому виробі</span>' +
      selectBtn('data-a="def-item" data-k="' + esc(d.key) + '"', it && AF.itemLabel(F, it), 'Оберіть виріб', F.errors[pre + '.productId']) + '</div>' +
      '<div class="ui-field span-2"><span class="ui-label">Вид браку' + (d.other && src ? ' — відділ «' + esc(src.name) + '»' : '') + '</span>' +
      selectBtn('data-a="def-type" data-k="' + esc(d.key) + '"', t && (t.name + ' · ' + AF.sevLabel(t.severity)), 'Оберіть вид браку', F.errors[pre + '.defectTypeId']) + '</div></div>' +
      d.guilty.map(function (g, j) {
        var w = AF.worker(F, g.workerCode), gp = pre + '.guilty[' + j + ']';
        var who = w ? w.name + ' · ' + w.code : g.workerCode === '' ? 'Невідомий працівник' : (g.workerCode || '');
        return '<div class="guilty"><div class="ui-field"><span class="ui-label">Винний</span>' +
          selectBtn('data-a="def-worker" data-k="' + esc(d.key) + '" data-j="' + j + '"', who, 'Хто', F.errors[gp]) + '</div>' +
          numInput('data-in="gqty" data-k="' + esc(d.key) + '" data-j="' + j + '"', g.qty, 'Шт', F.errors[gp + '.qty']) +
          '<button type="button" class="icon-btn" data-a="g-del" data-k="' + esc(d.key) + '" data-j="' + j + '" aria-label="Прибрати винного"' + (d.guilty.length < 2 ? ' disabled' : '') + '>' + P.ic('close') + '</button></div>' +
          err(F, gp) + err(F, gp + '.qty');
      }).join('') +
      (d.guilty.length < F.ctx.limits.maxGuiltyPerDefect ? '<div class="row"><button type="button" class="ui-btn ui-btn--quiet ui-btn--sm" data-a="g-add" data-k="' + esc(d.key) + '">' + P.ic('add') + 'Ще винний</button></div>' : '') +
      (d.other ? '<p class="form-sec__hint">Зарахуємо цей брак відділу, звідки він прийшов. В аудиті він теж залишиться.</p>' : '') +
      err(F, pre + '.departmentId') + err(F, pre + '.productId') + err(F, pre + '.defectTypeId') + err(F, pre + '.guilty') + err(F, pre) + '</div>';
  }
  function secDefects(F) {
    var body = '<div class="ui-seg" role="group" aria-label="Брак"><button type="button" class="ui-seg__btn" data-a="mode" data-v="none" aria-pressed="' + (F.mode === 'none') + '">' + P.ic('success') + 'Без браку</button>' +
      '<button type="button" class="ui-seg__btn" data-a="mode" data-v="defects" aria-pressed="' + (F.mode === 'defects') + '">' + P.ic('defect') + 'Є брак</button></div>' + err(F, 'mode') + err(F, 'defects');
    if (F.mode === 'defects') {
      body += '<div class="stack">' + F.defects.map(function (d, i) { return defectCard(F, d, i); }).join('') + '</div>' +
        (F.defects.length < F.ctx.limits.maxDefects ? '<button type="button" class="ui-btn ui-btn--secondary" data-a="def-add">' + P.ic('add') + 'Додати вид браку</button>' : '');
    }
    return sec(F, 'defects', 5, 'Брак', 'Знайшли брак — натисніть «Є брак» і додайте кожен вид. Брак зробили в іншому відділі — оберіть «Інший відділ».', body,
      F.mode === 'none' || (F.mode === 'defects' && F.defects.length > 0));
  }
  function secComment(F) {
    var body = '<label class="ui-field"><span class="visually-hidden">Коментар</span>' +
      '<textarea class="ui-textarea" rows="3" maxlength="' + Number(F.ctx.limits.maxComment) + '" data-in="comment" placeholder="Можна залишити порожнім">' + esc(F.comment) + '</textarea></label>' + err(F, 'comment');
    return sec(F, 'comment', 6, 'Коментар', '', body, !!F.comment.trim());
  }
  function actionBar(F) {
    var t = AF.totals(F);
    return '<div class="action-bar"><p class="action-bar__sum">Перевірено <b>' + f.num(t.checked) + '</b> шт · знайдено браку <b>' + f.num(t.rejected) + '</b>' +
      (t.pct != null ? ' (<b>' + f.pct(t.pct) + '</b>)' : '') + (t.other ? '<br>з них <b>' + f.num(t.other) + '</b> — брак іншого відділу (піде йому)' : '') + '</p>' +
      '<button type="button" class="ui-btn ui-btn--primary" data-a="save"' + (F.saving ? ' disabled' : '') + '>' +
      (F.saving ? '<span class="ui-spinner ui-spinner--sm" aria-hidden="true"></span>Записую…' : P.ic('save') + (F.editId ? 'Зберегти зміни' : 'Записати аудит')) + '</button></div>';
  }
  function banners(F) {
    var html = '';
    if (F.editId) html += '<div class="ui-banner ui-banner--info">' + P.ic('edit') + '<div class="ui-banner__body"><p class="ui-banner__title">Виправляєте записаний аудит</p>' +
      '<p class="ui-banner__text">Зміни замінять те, що було записано. Відділ змінити не можна.</p></div></div>';
    if (F.pendingDraft) html += '<div class="ui-banner ui-banner--warn">' + P.ic('clock') + '<div class="ui-banner__body"><p class="ui-banner__title">Є незавершений аудит</p>' +
      '<p class="ui-banner__text">' + esc(F.pendingDraft.summary || '') + ' · збережено о ' + f.time(new Date(F.pendingDraft.savedAt)) + '. Поки не оберете, новий аудит не зберігається як чернетка.</p></div>' +
      '<div class="ui-banner__actions"><button type="button" class="ui-btn ui-btn--primary ui-btn--sm" data-a="draft-continue">Продовжити</button>' +
      '<button type="button" class="ui-btn ui-btn--quiet ui-btn--sm" data-a="draft-new">Почати новий</button></div></div>';
    return html;
  }

  AF.view = function (F) {
    return '<div class="stack">' + banners(F) + secDept(F) + secOrders(F) + secItems(F) + secWorkers(F) + secDefects(F) + secComment(F) + '</div>' + actionBar(F);
  };
  AF.summaryHtml = function (F) { return actionBar(F); };

  AF.doneView = function (F, r) {
    var t = AF.totals(F);
    return '<div class="ui-card"><div class="done"><span class="done__icon">' + P.ic('success') + '</span>' +
      '<h2 class="ui-title-lg done__title">' + (F.editId ? 'Аудит виправлено' : 'Аудит записано') + '</h2>' +
      '<p class="ui-text-sm ui-soft">' + esc(r.auditId) + ' · ' + esc((AF.dept(F, F.departmentId) || {}).name || '') + '</p>' +
      '<p class="ui-text-sm">Перевірено ' + f.num(t.checked) + ' шт · знайдено браку ' + f.num(t.rejected) + ' шт' + (t.pct != null ? ' (' + f.pct(t.pct) + ')' : '') + '</p>' +
      (r.editableUntil ? '<p class="ui-caption ui-soft">Помилились? Виправити можна до ' + f.time(r.editableUntil) + '.</p>' : '') +
      '<div class="done__actions"><button type="button" class="ui-btn ui-btn--primary" data-a="again">' + P.ic('add') + 'Ще один аудит</button>' +
      '<button type="button" class="ui-btn ui-btn--secondary" data-a="view">' + P.ic('audit') + 'Переглянути аудит</button>' +
      '<button type="button" class="ui-btn ui-btn--quiet" data-a="home">' + P.ic('home') + 'На головну</button></div></div></div>';
  };
})(window);
