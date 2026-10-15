(function (root) {
  'use strict';
  var P = root.P, AF = P.AF = P.AF || {};
  var F = null, el = null;
  var MSG_QTY = 'Кількість — ціле число від 1 до 100 000.';
  var NONE = '__none';   // пункт «Невідомий працівник» у списках (у даних — порожній код '')
  var UNKNOWN_OPT = { value: NONE, title: 'Невідомий працівник', meta: 'коли не знаєте, хто саме' };
  var WORKER_PH = 'Працівник, наприклад q5';   // підказка пошуку: у цеху людей знають за підписом, не за службовим кодом

  function itemByKey(k) { return F.items.filter(function (x) { return x.key === k; })[0]; }
  function defByKey(k) { return F.defects.filter(function (x) { return x.key === k; })[0]; }
  function newItem() { return { key: P.uid('it'), productId: null, orderNo: F && F.orders.length === 1 ? F.orders[0] : null, qty: '', rejected: '' }; }
  function newDefect() {
    var ready = F.items.filter(function (i) { return i.productId; });
    return { key: P.uid('df'), itemKey: ready.length === 1 ? ready[0].key : null, defectTypeId: null, other: false, departmentId: null,
      guilty: ownGuilty(), photos: [] };
  }
  function ownGuilty() { return F.workers.length === 1 ? [{ workerCode: F.workers[0], qty: '' }] : []; }
  function typeFor(d) { var dep = AF.dept(F, d && d.other ? d.departmentId : F.departmentId); return dep && dep.deptTypeId; }
  function active(form) { return F && F === form && F.alive && F.alive() && el && el.isConnected; }
  function draw() { el.innerHTML = F.done ? AF.doneView(F, F.done) : AF.view(F); locHead(); }
  function drawSummary() { var bar = el.querySelector('.action-bar'); if (bar) bar.outerHTML = AF.summaryHtml(F); }
  function changed(redraw) { F.errors = {}; if (redraw) draw(); else drawSummary(); AF.draft.save(F); }

  function clientCheck() {
    var e = {}, lim = F.ctx.limits;
    if (!F.departmentId) e.departmentId = 'Оберіть відділ.';
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
        if (!d.defectTypeId) e[pre + '.defectTypeId'] = 'Оберіть вид браку зі списку. Немає потрібного — попросіть старшого аудитора додати його на сайті.';
        if (!d.guilty.length) e[pre + '.guilty'] = 'Позначте, хто винний, або «Невідомий працівник».';
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
      checkedWorkers: F.workers.slice(), helpers: F.workers.filter(function (c) { return AF.isHelper(F, c); }),
      comment: F.comment.trim(), noDefects: F.mode === 'none',
      defects: F.mode !== 'defects' ? [] : F.defects.map(function (d) {
        var it = itemByKey(d.itemKey) || {};
        return { productId: it.productId || null, orderNo: it.orderNo || null, defectTypeId: d.defectTypeId,
          departmentId: d.other ? d.departmentId : null, photos: (d.photos || []).slice(0, AF.PHOTO_MAX),
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
  function queue(form, sent, key) {
    var t = AF.totals(form), dep = AF.dept(form, form.departmentId);
    var q = P.offline.enqueue(form.uid, sent, (dep ? dep.name : '') + ' · перевірено ' + t.checked + ' шт · брак ' + t.rejected + ' шт');
    form.saving = false;
    if (!q.ok) {
      if (active(form)) drawSummary();
      return P.toast('danger', 'Не вдалося зберегти на телефоні', 'Памʼять телефона заповнена. Чернетку збережено — запишіть аудит, коли зʼявиться звʼязок.');
    }
    form.done = { queued: true, photosDropped: q.photosDropped };
    if (!form.lockDraft) P.store.del(key);
    P.toast('ok', 'Збережено на телефоні', 'Надішлеться саме, щойно зʼявиться звʼязок.' + (q.photosDropped ? ' Фото не вмістились у памʼять — аудит без фото.' : ''));
    if (active(form)) { draw(); root.scrollTo(0, 0); }
  }
  function submit() {
    var e = clientCheck();
    if (Object.keys(e).length) return showErrors(e);
    var form = F, key = AF.draft.key(F.uid, F.home), editing = !!F.editId, off = !!(P.offline && P.offline.isOff());
    if (off && editing) return P.toast('warn', 'Немає звʼязку', 'Зміни ще не збережено. Натисніть «Зберегти зміни», щойно звʼязок повернеться.');
    F.saving = true; drawSummary();
    var sent = payload();
    if (off) return queue(form, sent, key);
    P.srv(editing ? 'auditUpdate' : 'auditSubmit', sent).then(function (r) {
      form.saving = false;
      if (!r.ok && r.code === 'offline' && !editing && P.offline) return queue(form, sent, key);
      if (r.ok) {
        form.done = r;   // відкладений запис чернетки цієї форми тепер нічого не запише
        if (!form.lockDraft && !editing) P.store.del(key);
        P.toast('ok', editing ? 'Аудит виправлено' : 'Аудит записано', r.auditId);
        if (r.photosDropped) P.toast('warn', 'Фото не збережено', 'Памʼять телефона заповнена — аудит записано без фото.');
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
  function depName(id) { var d = AF.dept(F, id); return d ? d.name : ''; }
  function workerOptions() {
    var own = [], other = [];
    F.ctx.workers.forEach(function (w) {
      if (w.departmentId === F.departmentId) own.push({ value: w.code, title: w.name, group: depName(F.departmentId) });
      else if (depName(w.departmentId)) other.push({ value: w.code, title: w.name, meta: depName(w.departmentId), group: 'Інші відділи — допомога' });
    });
    other.sort(function (a, b) { return a.meta < b.meta ? -1 : a.meta > b.meta ? 1 : 0; });
    return [UNKNOWN_OPT].concat(own, other);
  }
  function setWorkers(v) {
    F.workers = v;
    F.helpers = F.helpers.filter(function (c) { return v.indexOf(c) >= 0; });
    F.defects.forEach(function (d) { if (!d.other) d.guilty = d.guilty.filter(function (g) { return g.workerCode === '' || v.indexOf(g.workerCode) >= 0; }); });
  }
  function quickAdd(name, departmentId) {
    var form = F;
    return P.srv('workerQuickAdd', { locationId: F.loc, departmentId: departmentId, name: name }).then(function (r) {
      if (!active(form)) return null;
      if (!r.ok) {
        if (r.code !== 'forbidden') P.toast('danger', 'Не вдалося додати працівника', (r.errors && r.errors[0] ? r.errors[0].message : r.error) || '');
        return null;
      }
      var w = r.worker;
      if (!AF.worker(form, w.code)) form.ctx.workers.push({ code: w.code, name: w.name, departmentId: w.departmentId });
      P.toast('ok', r.existed ? 'Такий працівник уже є · ' + w.name : 'Працівника додано · ' + w.name, depName(w.departmentId));
      return w;
    });
  }
  function createChecked(name, help) {
    var add = function (departmentId) {
      quickAdd(name, departmentId).then(function (w) {
        if (!w) return;
        if (F.workers.indexOf(w.code) < 0) F.workers.push(w.code);
        changed(true);
      });
    };
    if (!help) return add(F.departmentId);
    pick({ title: 'З якого відділу «' + name + '»', options: F.ctx.departments.filter(function (x) { return x.id !== F.departmentId; }).map(function (x) { return { value: x.id, title: x.name }; }),
      emptyText: 'У локації немає інших відділів' }, add);
  }

  function dirty() {
    return !!(F.departmentId || F.orders.length || F.workers.length || F.defects.length || F.comment.trim() ||
      F.items.some(function (i) { return i.productId || i.qty || i.rejected; }));
  }
  function locHead() {
    var sub = root.document.getElementById('top-sub');
    if (!sub || !F) return;
    sub.hidden = false;
    if (F.done) { sub.textContent = F.ctx.location.name; return; }   // аудит записано — локація вже лише підпис
    sub.innerHTML = '<button type="button" class="top-loc" aria-haspopup="dialog" aria-label="Локація: ' + P.esc(F.ctx.location.name) + '. Змінити">' +
      '<span class="top-loc__name">' + P.esc(F.ctx.location.name) + '</span>' + P.ic('chevron-down', 'ui-icon--sm') + '</button>' +
      (F.editId ? '<span class="top-loc__id">' + P.esc(F.editId) + '</span>' : '');   // у «Виправити» — і номер аудиту, як було
    sub.firstChild.onclick = function () { if (F && !F.done && !F.saving) pickLoc(); };
  }
  function pickLoc() {
    var list = F.ctx.locations || [F.ctx.location];
    pick({ title: 'Локація аудиту', value: F.loc, options: list.map(function (l) { return { value: l.id, title: l.name, meta: l.id === F.home ? 'ваша локація' : '' }; }) },
      function (v) {
        if (v === F.loc) return;
        var name = (list.filter(function (l) { return l.id === v; })[0] || {}).name || '';
        if (!dirty()) return switchLoc(v);
        ask({ title: 'Змінити локацію на «' + name + '»?', danger: true, okLabel: 'Змінити й очистити',
          text: 'Усе, що ви вже записали в цьому аудиті, зникне: відділ, замовлення, вироби, працівники, брак і коментар. У кожної локації свої відділи й люди.' },
          function () { switchLoc(v); });
      });
  }
  var locSeq = 0;   // номер останнього вибору локації: відповідь на старіший вибір не застосовуємо
  function switchLoc(v) {
    var old = F, my = ++locSeq;
    if (old.editId && v === old.editLoc) return P.shell.rerender();
    P.srv('auditFormContext', { locationId: v }).then(function (fc) {
      if (my !== locSeq || !active(old)) return;
      if (!fc.ok) { if (fc.code !== 'forbidden') P.toast('danger', 'Не вдалося відкрити локацію', fc.error || ''); return; }
      var n = blank(old.shell, fc);
      n.editId = old.editId; n.editLoc = old.editLoc; n.lockDraft = old.lockDraft; n.pendingDraft = old.pendingDraft;
      if (old.editId) n.clientId = old.clientId;
      n.items = [{ key: P.uid('it'), productId: null, orderNo: null, qty: '', rejected: '' }];
      F = n;
      if (!n.editId && !n.lockDraft) { AF.draft.flush(); AF.draft.del(n.uid, n.home); }   // спершу дописати відкладене, інакше воно поверне стару
      F.errors = {}; draw();
      root.scrollTo(0, 0);
      P.toast('ok', 'Локація: ' + fc.location.name, old.editId ? 'Оберіть відділ — аудит переїде сюди, коли збережете зміни.' : 'Оберіть відділ.');
    });
  }

  var ACT = {
    dept: function (t) {
      var v = t.getAttribute('data-v');
      if (v === F.departmentId) return;
      if (F.editId && !AF.moved(F)) return P.toast('warn', 'Відділ змінити не можна', 'Запишіть новий аудит в іншому відділі.');
      var dirty = F.items.some(function (i) { return i.productId; }) || F.workers.length || F.defects.length;
      var go = function () { F.departmentId = v; F.items = [newItem()]; F.workers = []; F.helpers = []; F.defects = []; F.mode = null; changed(true); };
      if (!dirty || !F.departmentId) return go();
      ask({ title: 'Змінити відділ?', text: 'Вироби, працівники й брак цього аудиту буде очищено.', okLabel: 'Змінити' }, go);
    },
    'order-add': function () {
      var used = F.orders, opts = [];
      F.ctx.orderBlocks.forEach(function (b) { if (used.indexOf(b.name) < 0) opts.push({ value: b.name, title: b.name, list: b.orders, group: 'Блоки замовлень' }); });
      F.ctx.orders.forEach(function (o) { if (used.indexOf(o.no) < 0) opts.push({ value: o.no, title: o.no, group: 'Замовлення' }); });
      pick({ title: 'Замовлення', cols: 2, options: opts, placeholder: 'Номер замовлення або блоку', emptyText: 'Замовлень поки немає' }, function (v) {
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
      var dn = depName(F.departmentId);
      pick({ title: 'Перевірені працівники', multi: true, search: true, cols: 2, values: F.workers.map(function (c) { return c === '' ? NONE : c; }), placeholder: WORKER_PH,
        emptyText: 'У відділі ще немає працівників', hint: F.ctx.canAddWorker ? 'Немає в списку — впишіть у пошук і додайте.' : '',
        create: !F.ctx.canAddWorker ? null : [{ id: 'own', label: function (q) { return 'Додати «' + q + '» у відділ «' + dn + '»'; } },
          { id: 'help', label: function (q) { return 'Додати «' + q + '» — допомога з іншого відділу'; } }],
        options: workerOptions() },
        function (v) {
          var made = v && v.create ? v : null;
          setWorkers((made ? made.picked : v).map(function (c) { return c === NONE ? '' : c; }));
          changed(true);
          if (made) createChecked(made.q, made.create === 'help');
        });
    },
    'worker-help': function (t) {
      var c = t.getAttribute('data-v'), i = F.helpers.indexOf(c);
      if (t.checked && i < 0) F.helpers.push(c);
      if (!t.checked && i >= 0) F.helpers.splice(i, 1);
      changed(true);   // перемальовуємо все: підпис «· допомога» є ще й біля винного в картці браку
    },
    'worker-del': function (t) {
      var c = t.getAttribute('data-v');
      F.workers = F.workers.filter(function (x) { return x !== c; });
      F.helpers = F.helpers.filter(function (x) { return x !== c; });
      F.defects.forEach(function (d) { if (!d.other && c) d.guilty = d.guilty.filter(function (g) { return g.workerCode !== c; }); });
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
      d.guilty = other ? [{ workerCode: '', qty: d.guilty[0] ? d.guilty[0].qty : '' }] : ownGuilty();
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
        options: F.ctx.defectTypes.filter(function (x) { return x.deptTypeId === dt; }).map(function (x) { return { value: x.id, title: x.name, meta: AF.lvlLabel(x.level), tone: x.level || 'fix' }; }) },
        function (v) { d.defectTypeId = v; changed(true); });
    },
    'def-worker': function (t) {
      var d = defByKey(t.getAttribute('data-k')), g = d && d.guilty[Number(t.getAttribute('data-j'))];
      if (!g || !d.other) return;
      if (!d.departmentId) return P.toast('warn', 'Спершу оберіть, звідки брак');
      var src = d.departmentId, sn = depName(src);
      pick({ title: 'Винний', search: true, cols: 2, value: g.workerCode || NONE, placeholder: WORKER_PH, hint: F.ctx.canAddWorker ? 'Немає в списку — впишіть у пошук і додайте.' : '',
        create: !F.ctx.canAddWorker ? null : [{ id: 'own', label: function (q) { return 'Додати «' + q + '» у відділ «' + sn + '»'; } }],
        options: [UNKNOWN_OPT].concat(F.ctx.workers.filter(function (w) { return w.departmentId === src; })
          .map(function (w) { return { value: w.code, title: w.name }; })) },
        function (v) {
          if (v && v.create) return quickAdd(v.q, src).then(function (w) {
            if (!w) return;
            if (w.departmentId !== src) return P.toast('warn', 'Працівник «' + w.name + '» — з відділу «' + depName(w.departmentId) + '»', 'Брак записано на відділ «' + sn + '».');
            g.workerCode = w.code; changed(true);
          });
          g.workerCode = v === NONE ? '' : v; changed(true);
        });
    },
    'g-pick': function (t) {
      var d = defByKey(t.getAttribute('data-k')), c = t.getAttribute('data-v');
      if (!d || d.other) return;
      if (c === NONE) c = '';
      var at = -1;
      d.guilty.forEach(function (g, j) { if (g.workerCode === c) at = j; });
      if (at >= 0) { d.guilty.splice(at, 1); return changed(true); }
      if (d.guilty.length >= F.ctx.limits.maxGuiltyPerDefect) return P.toast('warn', 'Не більше ' + F.ctx.limits.maxGuiltyPerDefect + ' винних на один вид браку');
      d.guilty.push({ workerCode: c, qty: '' });
      changed(true);
      var inp = el.querySelector('[data-in="gqty"][data-k="' + d.key + '"][data-j="' + (d.guilty.length - 1) + '"]');
      if (inp) inp.focus();
    },
    brief: function () { if (F.departmentId) AF.openBrief(F); },
    'g-add': function (t) { var d = defByKey(t.getAttribute('data-k')); if (d && d.other) { d.guilty.push({ workerCode: '', qty: '' }); changed(true); } },
    'g-del': function (t) { var d = defByKey(t.getAttribute('data-k')); if (d && d.guilty.length > 1) { d.guilty.splice(Number(t.getAttribute('data-j')), 1); changed(true); } },
    'draft-continue': function () {
      if (AF.draft.locOf(F.pendingDraft, F.home) !== F.loc) return P.router.go('/audit/new', { draft: '1', n: Date.now() });
      AF.restore(F, F.pendingDraft, newItem); F.pendingDraft = null; F.lockDraft = false; draw();
    },
    'draft-new': function () { AF.draft.del(F.uid, F.home); F.pendingDraft = null; F.lockDraft = false; draw(); },
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
  function onPhotoFile(e) {
    var t = e.target;
    if (!t.hasAttribute || !t.hasAttribute('data-photo-in')) return;
    var form = F, d = defByKey(t.getAttribute('data-k')), files = Array.prototype.slice.call(t.files || []);
    t.value = '';
    if (!d || !files.length) return;
    d.photoBusy = true; changed(true);
    AF.photoAdd(d, files).then(function (res) {
      d.photoBusy = false;
      if (!active(form)) return;
      changed(true);
      if (res.added) P.toast('ok', res.added > 1 ? 'Фото додано: ' + res.added : 'Фото додано', 'У цьому браку: ' + d.photos.length + ' з ' + AF.PHOTO_MAX);
      if (res.failed) P.toast('warn', 'Фото не вдалося додати', 'Зробіть знімок ще раз або оберіть інше фото.');
      if (res.skipped) P.toast('info', 'До ' + AF.PHOTO_MAX + ' фото на один брак', 'Зайві знімки не додано.');
    });
  }
  function blank(ctx, fc) {
    return { clientId: P.uid('aud'), uid: ctx.me.id, home: ctx.loc, shell: ctx, loc: fc.location ? fc.location.id : ctx.loc, ctx: fc, alive: ctx.alive, departmentId: null,
      orders: [], items: [], workers: [], helpers: [], comment: '', mode: null, defects: [], errors: {}, saving: false, done: null,
      pendingDraft: null, lockDraft: false, editId: null };
  }
  function mount(host) {
    el = host;
    if (!F) return P.delegate(el, 'click', '[data-act="retry"]', function () { P.shell.rerender(); });
    P.delegate(el, 'click', '[data-a]', function (e, t) {   // галочки теж (data-a на самому полі)
      var a = t.getAttribute('data-a'), fn = ACT[a], ph = AF.photoActs[a];
      if (t.disabled) return;
      if (fn) fn(t); else if (ph) ph(t, F, defByKey, changed);
    });
    el.addEventListener('input', onInput);
    el.addEventListener('change', onPhotoFile);
    locHead();
  }

  P.screen('/audit/new', {
    focus: true, back: '/home',
    title: function (ctx) { return { title: 'Новий аудит', sub: P.shell.locName(ctx.loc) }; },
    render: function (ctx) {
      AF.draft.flush();   // відкладена чернетка попередньої форми — записати до того, як читаємо памʼять
      var q = ctx.query, saved = AF.draft.fresh(ctx.me.id, ctx.loc);
      var at = q.draft && saved ? AF.draft.locOf(saved, ctx.loc) : (q.loc || ctx.loc);
      return P.srv('auditFormContext', { locationId: at }).then(function (fc) {
        if (!ctx.alive()) return '';   // поки чекали, людина пішла на інший екран — чужий стан не чіпаємо
        if (!fc.ok) { F = null; return P.state.error('Не вдалося відкрити форму', fc.error); }
        F = blank(ctx, fc);
        var draft = saved;
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
        if (!a.canEdit) { F = null; return P.state.empty('lock', 'Виправити вже не можна', 'Свій аудит можна виправити лише протягом ' + (a.editWindowMin || 15) + ' хв після запису.'); }
        return P.srv('auditFormContext', { locationId: a.locationId }).then(function (fc) {
          if (!ctx.alive()) return '';
          if (!fc.ok) { F = null; return P.state.error('Не вдалося відкрити форму', fc.error); }
          F = blank(ctx, fc);
          F.lockDraft = true;   // виправлення не пишемо в чернетку
          F.editLoc = a.locationId;   // де аудит записано: інша локація = перенесення (тоді й відділ новий)
          AF.fromAudit(F, a);
          if (!F.items.length) F.items = [newItem()];
          return AF.view(F);
        });
      });
    },
    mount: mount
  });
})(window);
