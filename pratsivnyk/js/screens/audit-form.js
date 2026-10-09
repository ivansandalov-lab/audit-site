(function (root) {
  'use strict';
  var P = root.P, AF = P.AF = P.AF || {};
  var F = null, el = null;
  var MSG_QTY = 'Кількість — ціле число від 1 до 100 000.';
  var NONE = '__none';   // пункт «Невідомий працівник» у списках (у даних — порожній код '')
  var UNKNOWN_OPT = { value: NONE, title: 'Невідомий працівник', meta: 'коли не знаєте, хто саме' };

  function itemByKey(k) { return F.items.filter(function (x) { return x.key === k; })[0]; }
  function defByKey(k) { return F.defects.filter(function (x) { return x.key === k; })[0]; }
  function newItem() { return { key: P.uid('it'), productId: null, orderNo: F && F.orders.length === 1 ? F.orders[0] : null, qty: '', rejected: '' }; }
  function newDefect() {
    var ready = F.items.filter(function (i) { return i.productId; });
    return { key: P.uid('df'), itemKey: ready.length === 1 ? ready[0].key : null, defectTypeId: null, other: false, departmentId: null,
      guilty: [{ workerCode: F.workers.length === 1 ? F.workers[0] : null, qty: '' }] };
  }
  function typeFor(d) { var dep = AF.dept(F, d && d.other ? d.departmentId : F.departmentId); return dep && dep.deptTypeId; }
  function active(form) { return F && F === form && F.alive && F.alive() && el && el.isConnected; }
  function draw() { el.innerHTML = F.done ? AF.doneView(F, F.done) : AF.view(F); }
  function drawSummary() { var bar = el.querySelector('.action-bar'); if (bar) bar.outerHTML = AF.summaryHtml(F); }
  function changed(redraw) { F.errors = {}; if (redraw) draw(); else drawSummary(); AF.draft.save(F); }

  function clientCheck() {
    var e = {}, lim = F.ctx.limits;
    if (!F.departmentId) e.departmentId = 'Оберіть локацію і відділ.';
    F.items.forEach(function (it, i) {
      if (!it.productId) e['items[' + i + '].productId'] = 'Оберіть виріб.';
      var q = Number(it.qty);
      if (!/^\d+$/.test(String(it.qty)) || q < 1 || q > lim.maxQty) e['items[' + i + '].qty'] = MSG_QTY;
    });
    if (!F.items.length) e.items = 'Вкажіть хоча б один перевірений виріб і скільки штук перевірено.';
    if (!F.mode) e.mode = 'Позначте: без браку чи є брак.';
    if (F.mode === 'defects') {
      if (!F.defects.length) e.defects = 'Додайте хоча б один вид браку або позначте «Без браку».';
      F.defects.forEach(function (d, i) {
        var pre = 'defects[' + i + ']';
        if (!d.itemKey || !itemByKey(d.itemKey)) e[pre + '.productId'] = 'Оберіть виріб.';
        if (d.other && !d.departmentId) e[pre + '.departmentId'] = 'Оберіть відділ, звідки брак.';
        if (!d.defectTypeId) e[pre + '.defectTypeId'] = 'Оберіть тип браку зі списку. Немає потрібного — попросіть старшого аудитора додати його на сайті.';
        d.guilty.forEach(function (g, j) {
          if (g.workerCode == null) e[pre + '.guilty[' + j + ']'] = 'Оберіть винного або «Невідомий працівник».';
          if (!/^\d+$/.test(String(g.qty)) || Number(g.qty) < 1) e[pre + '.guilty[' + j + '].qty'] = MSG_QTY;
        });
      });
    }
    return e;
  }
  function payload() {
    var p = {
      clientId: F.clientId, locationId: F.loc, departmentId: F.departmentId, orders: F.orders.slice(),
      items: F.items.map(function (it) {
        return { productId: it.productId, orderNo: it.orderNo || null, qty: Number(it.qty), rejected: it.rejected === '' ? null : Number(it.rejected) };
      }),
      checkedWorkers: F.workers.slice(), comment: F.comment.trim(), noDefects: F.mode === 'none',
      defects: F.mode !== 'defects' ? [] : F.defects.map(function (d) {
        var it = itemByKey(d.itemKey) || {};
        return { productId: it.productId || null, orderNo: it.orderNo || null, defectTypeId: d.defectTypeId,
          departmentId: d.other ? d.departmentId : null,
          guilty: d.guilty.map(function (g) { return { workerCode: g.workerCode, qty: Number(g.qty) }; }) };
      })
    };
    if (F.editId) p.id = F.editId;
    return p;
  }
  function showErrors(map, text) {
    F.errors = map; draw();
    var bad = el.querySelector('.form-sec.is-invalid');
    if (bad) bad.scrollIntoView({ behavior: 'smooth', block: 'start' });
    P.toast('warn', 'Перевірте позначені поля', text || '');
  }
  function submit() {
    var e = clientCheck();
    if (Object.keys(e).length) return showErrors(e);
    var form = F, key = AF.draft.key(F.uid, F.loc), editing = !!F.editId;
    F.saving = true; drawSummary();
    var sent = payload();
    P.srv(editing ? 'auditUpdate' : 'auditSubmit', sent).then(function (r) {
      form.saving = false;
      if (r.ok) {
        form.done = r;   // відкладений запис чернетки цієї форми тепер нічого не запише
        if (!form.lockDraft && !editing) P.store.del(key);
        P.toast('ok', editing ? 'Аудит виправлено' : 'Аудит записано', r.auditId);
        if (P.embed && root.parent && root.parent !== root) {
          var chk = sent.items.reduce(function (s, i) { return s + (Number(i.qty) || 0); }, 0);
          var bad = sent.defects.reduce(function (s, d) { return s + d.guilty.reduce(function (a, g) { return a + (Number(g.qty) || 0); }, 0); }, 0);
          root.parent.postMessage({ type: 'audit:saved', id: r.auditId, edited: editing, time: P.fmt.time(r.createdAt || new Date().toISOString()),
            summary: 'перевірено ' + chk + ' шт · брак ' + bad + ' шт' }, root.location.origin);
        }
        if (active(form)) { draw(); root.scrollTo(0, 0); }   // якщо вже пішли з екрана — лише повідомлення
        return;
      }
      if (!active(form)) return;
      if (r.code === 'validation') {
        var map = {};
        (r.errors || []).forEach(function (x) { if (!map[x.field]) map[x.field] = x.message; });
        return showErrors(map, (r.errors && r.errors.length > 1) ? 'Помилок: ' + r.errors.length : '');
      }
      drawSummary();
      if (r.code !== 'forbidden') P.toast('danger', editing ? 'Не вдалося виправити аудит' : 'Не вдалося записати аудит', (r.error || '') + (editing ? '' : ' Чернетку збережено — спробуйте ще раз.'));
    });
  }

  function pick(opts, apply) { var form = F; return P.picker(opts).then(function (v) { if (v && active(form)) apply(v); }); }
  function ask(o, apply) { var form = F; return P.confirm(o).then(function (ok) { if (ok && active(form)) apply(); }); }
  function pickProduct(it) {
    var t = typeFor(null);
    if (!t) return P.toast('warn', 'Спершу оберіть відділ');
    return pick({ title: 'Виріб', value: it.productId, placeholder: 'Пошук виробу',
      options: F.ctx.products.filter(function (p) { return p.deptTypeId === t; }).map(function (p) { return { value: p.id, title: p.name }; }) },
      function (v) { it.productId = v; changed(true); });
  }
  var ACT = {
    dept: function (t) {
      var v = t.getAttribute('data-v');
      if (v === F.departmentId) return;
      if (F.editId) return P.toast('warn', 'Відділ змінити не можна', 'Запишіть новий аудит в іншому відділі.');
      var dirty = F.items.some(function (i) { return i.productId; }) || F.workers.length || F.defects.length;
      var go = function () { F.departmentId = v; F.items = [newItem()]; F.workers = []; F.defects = []; F.mode = null; changed(true); };
      if (!dirty || !F.departmentId) return go();
      ask({ title: 'Змінити відділ?', text: 'Вироби, працівники й брак цього аудиту буде очищено.', okLabel: 'Змінити' }, go);
    },
    'order-add': function () {
      var used = F.orders, opts = [];
      F.ctx.orderBlocks.forEach(function (b) { if (used.indexOf(b.name) < 0) opts.push({ value: b.name, title: b.name, meta: b.orders.join(', '), group: 'Блоки замовлень' }); });
      F.ctx.orders.forEach(function (o) {
        if (used.indexOf(o.no) >= 0) return;
        var b = AF.blockOf(F, o.no);   // замовлення з блоку — підказуємо, що є цілий блок
        opts.push({ value: o.no, title: o.no, group: 'Замовлення',
          meta: [b ? 'входить у ' + b.name : '', o.customer, o.lastDay ? 'останнє ' + P.fmt.date(o.lastDay + 'T12:00:00Z') : ''].filter(Boolean).join(' · ') });
      });
      pick({ title: 'Замовлення', options: opts, placeholder: 'Номер замовлення, блоку чи замовник', emptyText: 'Замовлень поки немає' }, function (v) {
        if (F.orders.length >= F.ctx.limits.maxOrders || F.orders.indexOf(v) >= 0) return;
        F.orders.push(v);
        if (F.orders.length === 1) F.items.forEach(function (i) { if (!i.orderNo) i.orderNo = v; });
        changed(true);
      });
    },
    'order-del': function (t) {
      var v = t.getAttribute('data-v');
      F.orders = F.orders.filter(function (o) { return o !== v; });
      F.items.forEach(function (i) { if (i.orderNo === v || F.orders.length === 0) i.orderNo = F.orders.length === 1 ? F.orders[0] : null; });
      changed(true);
    },
    'item-add': function () { var it = newItem(); F.items.push(it); changed(true); pickProduct(it); },
    'item-product': function (t) { var it = itemByKey(t.getAttribute('data-k')); if (it) pickProduct(it); },
    'item-order': function (t) {
      var it = itemByKey(t.getAttribute('data-k'));
      if (it) pick({ title: 'Замовлення виробу', value: it.orderNo, options: F.orders.map(function (o) { return { value: o, title: o }; }) },
        function (v) { it.orderNo = v; changed(true); });
    },
    'item-del': function (t) {
      var k = t.getAttribute('data-k'), linked = F.defects.some(function (d) { return d.itemKey === k; });
      var go = function () { F.items = F.items.filter(function (i) { return i.key !== k; }); F.defects = F.defects.filter(function (d) { return d.itemKey !== k; }); changed(true); };
      if (!linked) return go();
      ask({ title: 'Прибрати виріб?', text: 'Брак, записаний на цей виріб, теж буде прибрано.', okLabel: 'Прибрати', danger: true }, go);
    },
    'worker-add': function () {
      pick({ title: 'Перевірені працівники', multi: true, search: true, values: F.workers.map(function (c) { return c === '' ? NONE : c; }), placeholder: 'Імʼя або код',
        emptyText: 'У відділі немає працівників. Попросіть старшого аудитора додати.',
        options: [UNKNOWN_OPT].concat(F.ctx.workers.filter(function (w) { return w.departmentId === F.departmentId; }).map(function (w) { return { value: w.code, title: w.name, meta: w.code }; })) },
        function (v) {
          v = v.map(function (c) { return c === NONE ? '' : c; });
          F.workers = v;
          F.defects.forEach(function (d) { if (!d.other) d.guilty.forEach(function (g) { if (g.workerCode && v.indexOf(g.workerCode) < 0) g.workerCode = null; }); });
          changed(true);
        });
    },
    'worker-del': function (t) {
      var c = t.getAttribute('data-v');
      F.workers = F.workers.filter(function (x) { return x !== c; });
      F.defects.forEach(function (d) { if (!d.other) d.guilty.forEach(function (g) { if (c && g.workerCode === c) g.workerCode = null; }); });
      changed(true);
    },
    mode: function (t) {
      F.mode = t.getAttribute('data-v');
      if (F.mode === 'defects' && !F.defects.length) F.defects.push(newDefect());
      changed(true);
    },
    'def-add': function () { F.defects.push(newDefect()); changed(true); },
    'def-del': function (t) { var k = t.getAttribute('data-k'); F.defects = F.defects.filter(function (d) { return d.key !== k; }); changed(true); },
    'def-owner': function (t) {
      var d = defByKey(t.getAttribute('data-k')), other = t.getAttribute('data-v') === 'other';
      if (!d || d.other === other) return;
      d.other = other; d.departmentId = null; d.defectTypeId = null;
      d.guilty = [{ workerCode: other ? '' : (F.workers.length === 1 ? F.workers[0] : null), qty: d.guilty[0] ? d.guilty[0].qty : '' }];
      changed(true);
      if (other) ACT['def-dept'](t);
    },
    'def-dept': function (t) {
      var d = defByKey(t.getAttribute('data-k'));
      if (!d) return;
      pick({ title: 'Звідки брак', value: d.departmentId,
        options: F.ctx.departments.filter(function (x) { return x.id !== F.departmentId; }).map(function (x) { return { value: x.id, title: x.name }; }) },
        function (v) {
          if (v === d.departmentId) return;
          d.departmentId = v; d.defectTypeId = null;
          d.guilty.forEach(function (g) { var w = AF.worker(F, g.workerCode); if (g.workerCode && (!w || w.departmentId !== v)) g.workerCode = ''; });
          changed(true);
        });
    },
    'def-item': function (t) {
      var d = defByKey(t.getAttribute('data-k')), ready = F.items.filter(function (i) { return i.productId; });
      if (!d) return;
      if (!ready.length) return P.toast('warn', 'Спершу додайте перевірений виріб');
      pick({ title: 'На якому виробі брак', value: d.itemKey, options: ready.map(function (i) { return { value: i.key, title: AF.itemLabel(F, i), meta: 'перевірено ' + (i.qty || '?') + ' шт' }; }) },
        function (v) { d.itemKey = v; changed(true); });
    },
    'def-type': function (t) {
      var d = defByKey(t.getAttribute('data-k'));
      if (!d) return;
      if (d.other && !d.departmentId) return P.toast('warn', 'Спершу оберіть, звідки брак');
      var dt = typeFor(d);
      pick({ title: 'Вид браку', value: d.defectTypeId, placeholder: 'Пошук виду браку',
        emptyText: 'Немає видів браку для цього відділу. Попросіть старшого аудитора додати.',
        options: F.ctx.defectTypes.filter(function (x) { return x.deptTypeId === dt; }).map(function (x) { return { value: x.id, title: x.name, meta: AF.lvlLabel(x.level) }; }) },
        function (v) { d.defectTypeId = v; changed(true); });
    },
    'def-worker': function (t) {
      var d = defByKey(t.getAttribute('data-k')), g = d && d.guilty[Number(t.getAttribute('data-j'))];
      if (!g) return;
      if (d.other) {
        if (!d.departmentId) return P.toast('warn', 'Спершу оберіть, звідки брак');
        return pick({ title: 'Винний', search: true, value: g.workerCode || NONE, placeholder: 'Імʼя або код',
          options: [UNKNOWN_OPT].concat(F.ctx.workers.filter(function (w) { return w.departmentId === d.departmentId; })
            .map(function (w) { return { value: w.code, title: w.name, meta: w.code }; })) },
          function (v) { g.workerCode = v === NONE ? '' : v; changed(true); });
      }
      var known = F.workers.filter(function (c) { return c; });
      pick({ title: 'Винний', search: true, value: g.workerCode === '' ? NONE : g.workerCode, placeholder: 'Імʼя або код',
        emptyText: 'Немає перевірених працівників — оберіть їх у кроці 4.',
        options: [UNKNOWN_OPT].concat(known.map(function (c) { var w = AF.worker(F, c); return { value: c, title: w ? w.name : c, meta: c }; })) },
        function (v) { g.workerCode = v === NONE ? '' : v; changed(true); });
    },
    'g-add': function (t) { var d = defByKey(t.getAttribute('data-k')); if (d) { d.guilty.push({ workerCode: d.other ? '' : null, qty: '' }); changed(true); } },
    'g-del': function (t) { var d = defByKey(t.getAttribute('data-k')); if (d && d.guilty.length > 1) { d.guilty.splice(Number(t.getAttribute('data-j')), 1); changed(true); } },
    'draft-continue': function () { AF.restore(F, F.pendingDraft, newItem); F.pendingDraft = null; F.lockDraft = false; draw(); },
    'draft-new': function () { AF.draft.del(F.uid, F.loc); F.pendingDraft = null; F.lockDraft = false; draw(); },
    save: function () { submit(); },
    again: function () { P.router.go('/audit/new', { loc: F.loc, dep: F.departmentId, n: Date.now() }); },
    view: function () { P.router.go('/audit/' + F.done.auditId); },
    home: function () { P.router.go('/home'); }
  };
  function onInput(e) {
    var t = e.target, kind = t.getAttribute('data-in');
    if (!kind) return;
    if (kind === 'comment') { F.comment = t.value; return changed(false); }
    var clean = t.value.replace(/\D+/g, ''), k = t.getAttribute('data-k');
    if (clean !== t.value) t.value = clean;
    if ((kind === 'qty' || kind === 'rejected') && itemByKey(k)) itemByKey(k)[kind] = clean;
    if (kind === 'gqty') { var dd = defByKey(k), gg = dd && dd.guilty[Number(t.getAttribute('data-j'))]; if (gg) gg.qty = clean; }
    changed(false);
  }
  function blank(ctx, fc) {
    return { clientId: P.uid('aud'), uid: ctx.me.id, loc: fc.location ? fc.location.id : ctx.loc, ctx: fc, alive: ctx.alive, departmentId: null,
      orders: [], items: [], workers: [], comment: '', mode: null, defects: [], errors: {}, saving: false, done: null,
      pendingDraft: null, lockDraft: false, editId: null };
  }
  function mount(host) {
    el = host;
    if (!F) return P.delegate(el, 'click', '[data-act="retry"]', function () { P.shell.rerender(); });
    P.delegate(el, 'click', '[data-a]', function (e, t) { var fn = ACT[t.getAttribute('data-a')]; if (fn && !t.disabled) fn(t); });
    el.addEventListener('input', onInput);
    if (F.pendingDraft) {
      var form = F, d = F.pendingDraft;
      P.confirm({ title: 'Є незавершений аудит', text: d.summary + ' · збережено о ' + P.fmt.time(new Date(d.savedAt)) + '. Продовжити його чи почати новий?',
        okLabel: 'Продовжити', cancelLabel: 'Почати новий' }).then(function (ok) {
        if (!active(form) || ok === null) return;          // закрили без вибору — лишається банер у формі
        (ok ? ACT['draft-continue'] : ACT['draft-new'])();
      });
    }
  }

  P.screen('/audit/new', {
    focus: true, back: '/home',
    title: function (ctx) { return { title: 'Новий аудит', sub: P.shell.locName(ctx.loc) }; },
    render: function (ctx) {
      AF.draft.flush();   // відкладена чернетка попередньої форми — записати до того, як читаємо памʼять
      var q = ctx.query;
      return P.srv('auditFormContext', { locationId: ctx.loc }).then(function (fc) {
        if (!ctx.alive()) return '';   // поки чекали, людина пішла на інший екран — чужий стан не чіпаємо
        if (!fc.ok) { F = null; return P.state.error('Не вдалося відкрити форму', fc.error); }
        F = blank(ctx, fc);
        var draft = AF.draft.fresh(F.uid, F.loc);
        if (draft && q.draft) { AF.restore(F, draft, newItem); return AF.view(F); }
        if (draft) { F.pendingDraft = draft; F.lockDraft = true; }
        if (q.dep && AF.dept(F, q.dep)) F.departmentId = q.dep;
        F.items = [newItem()];
        return AF.view(F);
      });
    },
    mount: mount
  });

  P.screen('/audit/:id/edit', {
    focus: true,
    back: function (ctx) { return '/audit/' + ctx.params.id; },
    title: function (ctx) { return { title: 'Виправити аудит', sub: ctx.params.id }; },
    render: function (ctx) {
      AF.draft.flush();
      return P.srv('auditGet', { id: ctx.params.id }).then(function (r) {
        if (!ctx.alive()) return '';
        if (!r.ok) { F = null; return r.code === 'not_found' ? P.state.empty('search', 'Аудит не знайдено', '') : P.state.error('Не вдалося відкрити аудит', r.error); }
        var a = r.audit;
        if (!a.canEdit) { F = null; return P.state.empty('lock', 'Виправити вже не можна', 'Свій аудит можна виправити лише протягом 15 хвилин після запису.'); }
        return P.srv('auditFormContext', { locationId: a.locationId }).then(function (fc) {
          if (!ctx.alive()) return '';
          if (!fc.ok) { F = null; return P.state.error('Не вдалося відкрити форму', fc.error); }
          F = blank(ctx, fc);
          F.lockDraft = true;   // виправлення не пишемо в чернетку
          AF.fromAudit(F, a);
          if (!F.items.length) F.items = [newItem()];
          return AF.view(F);
        });
      });
    },
    mount: mount
  });
})(window);
