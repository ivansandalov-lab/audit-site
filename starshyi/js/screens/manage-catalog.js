(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, M = P.srMg;
  var q = M.q, qa = M.qa, da = M.da, W = M.W;

  function selBar(n, words) {
    return '<div class="mg-mergebar"><b>Позначено ' + M.cnt(n, words) + '</b><span style="flex:1"></span><button class="btn btn--quiet btn--sm" type="button" data-act="mg-sel-clear">Зняти позначки</button>' +
      '<button class="btn btn--primary btn--sm" type="button" data-act="mg-merge-sel">' + P.ic('merge') + 'Обʼєднати позначені…</button>' + M.hq('sr.mg.merge') + '</div>';
  }
  function showItem(active) { return active ? { act: 'show', ic: 'power', title: 'Сховати з форми аудиту', danger: true } : { act: 'show', ic: 'power', title: 'Показати у формі аудиту' }; }

  M.section('products', 'Відділи й вироби', function (v) {
    var data = null, st = { dep: null, sel: {} };
    function load() { v.get('srMgCatalog', function (r) { data = r; if (!dep()) st.dep = r.departments[0] && r.departments[0].id; draw(); }); }
    function findD(id) { return data.departments.filter(function (d) { return d.id === id; })[0]; }
    function dep() { return findD(st.dep); }
    function prods() { var d = dep(); return d ? data.products.filter(function (x) { return x.deptTypeId === d.deptTypeId; }) : []; }
    function findP(id) { return data.products.filter(function (x) { return x.id === id; })[0]; }
    function selIds() { return Object.keys(st.sel).filter(function (id) { return st.sel[id] && findP(id); }); }
    function normText(d) { return d.sampleTarget ? 'норма ' + H.num(d.sampleTarget) + ' шт на день' : 'норму не задано'; }
    function depRow(d) {
      var on = d.id === st.dep;
      return '<div class="mg-dep' + (on ? ' mg-dep--on' : '') + (d.active ? '' : ' mg-dep--off') + '"><button class="mg-dep__pick" type="button" data-act="mg-dep"' + da('id', d.id) + (on ? ' aria-current="true"' : '') + '>' +
        '<span class="mg-dep__main"><b>' + esc(d.name) + '</b>' + (d.active ? '' : ' ' + H.badge('вимкнено')) + '<span class="sub">' + M.cnt(d.products, W.prod) + ' · ' + normText(d) + (d.name !== d.deptTypeName ? ' · тип «' + esc(d.deptTypeName) + '»' : '') + '</span></span></button>' + M.more('mg-dep-menu', da('id', d.id), 'Дії з відділом ' + d.name) + '</div>';
    }
    function prodRow(x) {
      var on = !!st.sel[x.id];
      return '<tr class="' + (on ? 'sel' : '') + (x.active ? '' : ' mg-off') + '"><td style="width:44px">' + M.ck(on, 'mg-sel', da('id', x.id), 'Позначити ' + x.name) + '</td>' +
        '<td><b>' + esc(x.name) + '</b>' + (!x.active ? '<span class="sub">приховано у формі аудиту</span>' : x.addedAt ? '<span class="sub">' + M.added(x.addedAt) + '</span>' : '') + '</td>' +
        '<td class="n">' + H.num(x.audits) + '</td><td style="width:52px">' + M.more('mg-prod-menu', da('id', x.id), 'Дії з виробом ' + x.name) + '</td></tr>';
    }
    function draw() {
      var d = dep(), list = prods(), ids = selIds(), allOn = list.length && list.every(function (x) { return st.sel[x.id]; });
      v.col.innerHTML = M.head('Відділи й вироби', 'Відділи ' + data.location.name + ' і вироби кожного — так їх бачить форма аудиту') +
        '<div class="row" style="align-items:flex-start">' +
        '<section class="card" style="flex:1 1 320px;min-width:0"><div class="card-head"><h3 class="card-title">Відділи · ' + data.departments.length + M.hq('term.sample') + '</h3>' +
        (data.canAddDept ? '<button class="btn btn--secondary btn--sm" type="button" data-act="mg-dep-new">' + P.ic('add', 'ui-icon--sm') + 'Новий відділ</button>' : '') + '</div>' +
        '<div class="mg-deps">' + data.departments.map(depRow).join('') + '</div></section>' +
        '<section class="card" style="flex:2 1 520px;min-width:0">' + (!d ? H.empty('Відділів немає', '') :
          '<div class="card-head" style="flex-wrap:wrap"><div style="flex:1;min-width:200px"><h3 class="card-title">Вироби · ' + esc(d.name) + '</h3><p class="hint">' + M.cnt(list.length, W.prod) + ' · ' + (d.active ? d.shown + ' у формі аудиту' : 'відділ вимкнено') + '</p></div>' +
          '<div class="mg-actions">' + (list.length > 1 ? '<button class="btn btn--secondary btn--sm" type="button" data-act="mg-merge">' + P.ic('merge', 'ui-icon--sm') + 'Обʼєднати…</button>' : '') +
          '<button class="btn btn--primary btn--sm" type="button" data-act="mg-new">' + P.ic('add') + 'Новий виріб</button></div></div>' +
          (d.active ? '' : M.banner('warn', 'Відділ вимкнено — його виробів у формі аудиту зараз немає.', '')) +
          (list.length ? '<div class="tbl-box"><table class="tbl"><thead><tr><th>' + M.ck(allOn, 'mg-sel-all', '', 'Позначити всі') + '</th><th>Виріб</th><th class="n">В аудитах цеху' + M.hq('sr.mg.inAudits') + '</th><th><span class="mg-vh">Дії</span></th></tr></thead><tbody>' +
            list.map(prodRow).join('') + '</tbody></table></div>' : H.empty('Виробів ще немає', '')) +
          (ids.length ? selBar(ids.length, W.prod) : '') +
          '<p class="hint">Список виробів спільний для всіх цехів.</p>') + '</section></div>';
    }

    function saveDept(p) { return v.call('srMgDeptSave', p); }
    function afterDept() { P.emit('kd:changed'); if (v.ctx.alive()) load(); }
    function rename(d) {
      M.ask({ title: 'Перейменувати відділ', sub: d.name, name: 'name', label: 'Назва відділу', value: d.name, attrs: ' autocomplete="off" maxlength="40"',
        save: function (val) { return saveDept({ id: d.id, name: val }); },
        done: function (r) { P.toast('ok', 'Відділ перейменовано · ' + d.name + ' → ' + r.name); afterDept(); } });
    }
    function norm(d) {
      M.ask({ title: 'Норма вибірки на день', sub: d.name, name: 'sampleTarget', label: 'Скільки штук перевірити за день', value: d.sampleTarget || '', help: 'term.sample',
        attrs: ' type="number" min="1" max="10000" step="1" inputmode="numeric"',
        save: function (val) { return saveDept({ id: d.id, sampleTarget: val === '' ? null : +val }); },
        done: function (r) { P.toast('ok', 'Норма вибірки · ' + r.name + ' — ' + H.num(r.sampleTarget) + ' шт на день'); afterDept(); } });
    }
    function power(d) {
      function go() {
        saveDept({ id: d.id, active: !d.active }).then(function (r) {
          if (!v.ctx.alive()) return;
          if (!r.ok) { M.failToast(r); return; }
          P.toast('ok', (r.active ? 'Відділ увімкнено · ' : 'Відділ вимкнено · ') + r.name, r.active ? 'Є у формі аудиту.' : 'У формі аудиту його немає; ' + M.cnt(d.audits, W.audit) + ' — в історії.');
          afterDept();
        });
      }
      if (!d.active) { go(); return; }
      P.confirm({ title: 'Вимкнути відділ «' + d.name + '»?', okLabel: 'Вимкнути відділ', danger: true,
        text: 'У формі аудиту відділу не буде. ' + M.cnt(d.audits, W.audit) + ' відділу ' + M.plural(d.audits, ['лишається', 'лишаються', 'лишаються']) + ' в історії й аналітиці.' })
        .then(function (ok) { if (ok) go(); });
    }
    function openNewDept() {
      M.modal({ size: 'sm', title: 'Новий відділ', sub: esc(v.ctx.loc.name),
        body: '<div class="mg-form">' + M.field('name', 'Назва відділу', M.input('name', '', ' autocomplete="off" maxlength="40" placeholder="Пошив · лінія 2"')) +
          '<label class="field" data-f="deptTypeId"><span class="label">Тип відділу</span><select class="input" name="deptTypeId">' +
          data.deptTypes.map(function (t) { return '<option value="' + esc(t.id) + '"' + (dep() && t.id === dep().deptTypeId ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('') + '</select>' +
          '<span class="hint">Від типу залежить, які вироби й види браку будуть у формі аудиту цього відділу.</span></label>' +
          M.field('sampleTarget', 'Норма вибірки — скільки штук перевірити за день', M.input('sampleTarget', 120, ' type="number" min="1" max="10000" step="1" inputmode="numeric"'), '', 'term.sample') + '</div>',
        foot: M.cancelBtn() + '<button class="btn btn--primary" type="button" data-act="mg-save">' + P.ic('add') + 'Додати відділ</button>',
        onMount: function (el) { M.enterSubmits(el, 'mg-save'); },
        on: { 'mg-save': function (t, e, layer) {
          var n = M.val(layer.el, 'sampleTarget');
          t.disabled = true;
          saveDept({ name: M.val(layer.el, 'name'), deptTypeId: M.val(layer.el, 'deptTypeId'), sampleTarget: n === '' ? null : +n }).then(function (r) {
            t.disabled = false;
            if (!r.ok) { M.showErrors(layer.el, r); return; }
            layer.close(); st.dep = r.id; st.sel = {};
            P.toast('ok', 'Відділ додано · ' + r.name, 'Є у формі аудиту · норма ' + H.num(r.sampleTarget) + ' шт на день.');
            afterDept();
          });
        } } });
    }

    function openEdit(x) {
      var d = dep(), st2 = { active: x ? x.active : true };
      M.modal({ size: 'sm', title: x ? 'Редагувати виріб' : 'Новий виріб', sub: esc(d.name),
        body: '<div class="mg-form">' + M.field('name', 'Назва виробу', M.input('name', x ? x.name : '', ' autocomplete="off" maxlength="80" placeholder="Худі базове"')) +
          M.locked('Тип відділу', d.deptTypeName) +
          (x ? '<div class="field"><span class="label">У формі аудиту' + M.hq('sr.mg.inForm') + '</span>' + M.seg('active', [[true, 'Показується'], [false, 'Приховано']], st2.active) + '</div>' : '') +
          '<p class="hint">Список виробів спільний для всіх цехів.</p></div>',
        foot: M.cancelBtn() + '<button class="btn btn--primary" type="button" data-act="mg-save">' + P.ic(x ? 'save' : 'add') + (x ? 'Зберегти' : 'Додати виріб') + '</button>',
        onMount: function (el) { M.enterSubmits(el, 'mg-save'); },
        on: {
          'mg-seg': function (t, e, layer) { st2.active = t.getAttribute('data-v') === 'true'; qa(layer.el, '[data-k="active"]').forEach(function (b) { b.classList.toggle('seg__btn--on', b === t); }); },
          'mg-save': function (t, e, layer) {
            var p = x ? { id: x.id, name: M.val(layer.el, 'name'), active: st2.active } : { name: M.val(layer.el, 'name'), deptTypeId: d.deptTypeId };
            t.disabled = true;
            v.call('srMgProductSave', p).then(function (r) {
              t.disabled = false;
              if (!r.ok) { M.showErrors(layer.el, r); return; }
              layer.close(); P.toast('ok', (r.created ? 'Виріб додано · ' : 'Зміни збережено · ') + r.name, r.created ? 'Є у формі аудиту.' : '');
              if (v.ctx.alive()) load();
            });
          }
        } });
    }
    function showProd(x) {
      v.call('srMgProductSave', { id: x.id, active: !x.active }).then(function (r) {
        if (!v.ctx.alive()) return;
        if (!r.ok) { M.failToast(r); return; }
        P.toast('ok', (r.active ? 'Знову у формі аудиту · ' : 'Сховано з форми аудиту · ') + r.name, r.active ? '' : 'Аудити з цим виробом лишились в історії.');
        load();
      });
    }
    function merge(src) {
      var d = dep();
      M.openMerge(v, { kind: 'products', src: src, scope: d.name, onDone: function () { st.sel = {}; load(); },
        items: prods().map(function (x) {
          return { id: x.id, name: x.name, type: x.deptTypeId, typeName: d.deptTypeName, meta: 'у ' + M.inAudits(x.audits) + ' цеху' + (x.active ? '' : ' · приховано у формі') };
        }) });
    }
    v.openNew = function () { if (dep()) openEdit(null); };
    v.ctx.on('mg-new', function () { openEdit(null); });
    v.ctx.on('mg-dep', function (t) { st.dep = t.getAttribute('data-id'); st.sel = {}; draw(); });
    v.ctx.on('mg-dep-new', openNewDept);
    v.ctx.on('mg-dep-menu', function (t) {
      var d = findD(t.getAttribute('data-id'));
      M.rowMenu(t, [{ act: 'rename', ic: 'edit', title: 'Перейменувати' },
        { act: 'norm', ic: 'target', title: 'Норма вибірки на день', sub: d.sampleTarget ? H.num(d.sampleTarget) + ' шт' : 'не задано' }, 'sep',
        d.active ? { act: 'power', ic: 'power', title: 'Вимкнути', sub: 'прибрати з форми аудиту', danger: true } : { act: 'power', ic: 'power', title: 'Увімкнути', sub: 'повернути у форму аудиту' }],
        { rename: function () { rename(d); }, norm: function () { norm(d); }, power: function () { power(d); } });
    });
    v.ctx.on('mg-prod-menu', function (t) {
      var x = findP(t.getAttribute('data-id'));
      M.rowMenu(t, [{ act: 'edit', ic: 'edit', title: 'Редагувати' }, prods().length > 1 ? { act: 'merge', ic: 'merge', title: 'Обʼєднати з іншим…' } : null, 'sep', showItem(x.active)],
        { edit: function () { openEdit(x); }, merge: function () { merge([x.id]); }, show: function () { showProd(x); } });
    });
    v.ctx.on('mg-sel', function (t) { var id = t.getAttribute('data-id'); st.sel[id] = !st.sel[id]; draw(); });
    v.ctx.on('mg-sel-all', function () { var list = prods(), all = list.every(function (x) { return st.sel[x.id]; }); st.sel = {}; if (!all) list.forEach(function (x) { st.sel[x.id] = true; }); draw(); });
    v.ctx.on('mg-sel-clear', function () { st.sel = {}; draw(); });
    v.ctx.on('mg-merge', function () { merge([]); });
    v.ctx.on('mg-merge-sel', function () { merge(selIds()); });
    load();
  });

  M.section('defects', 'Види браку', function (v) {
    var data = null, st = { q: '', type: '', lvl: '', sel: {} };   // lvl — фільтр за рівнем браку ('' — усі). v1.2
    function load() { v.get('srMgDefects', function (r) { data = r; draw(); }); }
    function find(id) { return data.items.filter(function (x) { return x.id === id; })[0]; }
    function selIds() { return Object.keys(st.sel).filter(function (id) { return st.sel[id] && find(id); }); }
    function typeName(id) { var t = data.deptTypes.filter(function (x) { return x.id === id; })[0]; return t ? t.name : ''; }
    function shown() {
      var s = st.q.trim().toLowerCase();
      return data.items.filter(function (x) { return (!st.type || x.deptTypeId === st.type) && (!st.lvl || x.level === st.lvl) && (!s || x.name.toLowerCase().indexOf(s) >= 0); });
    }
    function levelCount(k) { return data.items.filter(function (x) { return x.level === k && (!st.type || x.deptTypeId === st.type); }).length; }
    function levelSeg(x) {
      if (!x.level) return H.badge('рівень не задано', 'warn');
      return '<div class="seg seg--sm" role="radiogroup" aria-label="Рівень · ' + esc(x.name) + '" style="display:inline-flex">' + ['fix', 'repair', 'scrap'].map(function (k) {
        var on = k === x.level;
        return '<button class="seg__btn' + (on ? ' seg__btn--on' : '') + '" type="button" aria-pressed="' + on + '" data-act="mg-level"' + da('id', x.id) + da('v', k) + '>' + (on ? H.lvl(k, M.LV_SHORT[k]) : M.LV_SHORT[k]) + '</button>'; }).join('') + '</div>';
    }
    function row(x) {
      var on = !!st.sel[x.id];
      return '<tr class="' + (on ? 'sel' : '') + (x.active ? '' : ' mg-off') + '"><td>' + M.ck(on, 'mg-sel', da('id', x.id), 'Позначити ' + x.name) + '</td>' +
        '<td><b>' + esc(x.name) + '</b>' + (!x.active ? '<span class="sub">приховано у формі аудиту</span>' : x.addedAt ? '<span class="sub">' + M.added(x.addedAt) + '</span>' : '') + '</td>' +
        '<td>' + esc(x.departments) + '</td><td>' + levelSeg(x) + '</td><td class="n">' + H.num(x.audits) + '</td>' +
        '<td style="width:52px">' + M.more('mg-menu', da('id', x.id), 'Дії з видом браку ' + x.name) + '</td></tr>';
    }
    function tbody() {
      var list = shown();
      return list.length ? list.map(row).join('') : '<tr><td colspan="6">' + H.empty('Нічого не знайдено', '') + '</td></tr>';
    }
    function bar() { var n = selIds().length; return n ? selBar(n, W.kind) : ''; }
    function draw() {
      v.col.innerHTML = M.head('Види браку', 'У кожного виду — рівень. Список спільний для всіх цехів.',
        '<div class="mg-actions"><button class="btn btn--secondary" type="button" data-act="mg-merge">' + P.ic('merge') + 'Обʼєднати…</button>' + M.btnNew('Новий вид браку') + '</div>') +
        '<div class="kpis mg-kpis3" role="group" aria-label="Фільтр за рівнем браку">' + [['fix', 'Неправильно зроблене', 'можна виправити одразу'], ['repair', 'Пошкоджене', 'іде в ремонт'], ['scrap', 'Зламане', 'не ремонтується, виріб втрачено']].map(function (k) {
          var on = st.lvl === k[0], n = levelCount(k[0]);
          return '<button class="kpi mg-lvl' + (on ? ' mg-lvl--on' : '') + '" type="button" data-act="mg-lvl"' + da('v', k[0]) + ' aria-pressed="' + on + '">' +
            '<span class="mg-lvl__top"><span class="lvl lvl--' + k[0] + '" style="font-size:16px">' + esc(k[1]) + '</span>' + (on ? H.badge('обрано', 'brand') : '') + '</span>' +
            '<span class="kpi__label">' + esc(k[2]) + '</span><span class="mg-lvl__n">' + H.num(n) + ' ' + P.plural(n, 'вид', 'види', 'видів') + ' браку</span></button>'; }).join('') + '</div>' +
        '<section class="card"><div class="mg-tools"><div class="search" style="flex:1;min-width:240px">' + P.ic('search', 'icon') +
        '<input class="input" data-input="mg-q" value="' + esc(st.q) + '" placeholder="Пошук виду браку" aria-label="Пошук виду браку" style="padding-left:46px"></div>' +
        '<span class="pills mg-pills">' + [['', 'Усі відділи']].concat(data.deptTypes.map(function (t) { return [t.id, t.name]; })).map(function (o) {
          return '<button class="pill' + (st.type === o[0] ? ' pill--on' : '') + '" type="button" aria-pressed="' + (st.type === o[0]) + '" data-act="mg-type"' + da('id', o[0]) + '>' + esc(o[1]) + '</button>'; }).join('') + '</span></div>' +
        '<div class="tbl-box"><table class="tbl"><thead><tr><th style="width:44px"><span class="mg-vh">Позначка</span></th><th>Вид браку</th><th>Відділ' + M.hq('sr.mg.defDept') + '</th><th>Рівень' + M.hq('term.levels') + '</th><th class="n">В аудитах цеху' + M.hq('sr.mg.inAudits') + '</th><th><span class="mg-vh">Дії</span></th></tr></thead><tbody data-mg-body>' + tbody() + '</tbody></table></div>' +
        '<div data-mg-bar>' + bar() + '</div></section>';
    }
    function redrawRows() { q(v.col, '[data-mg-body]').innerHTML = tbody(); q(v.col, '[data-mg-bar]').innerHTML = bar(); }
    function openEdit(x) {
      var st2 = { level: x ? x.level || 'fix' : null, active: x ? x.active : true }, types = data.deptTypes;
      var defType = st.type || (types[0] && types[0].id);
      M.modal({ size: 'sm', title: x ? 'Редагувати вид браку' : 'Новий вид браку', sub: x ? esc(x.name) : '',
        body: '<div class="mg-form">' + M.field('name', 'Назва виду браку', M.input('name', x ? x.name : '', ' autocomplete="off" maxlength="80" placeholder="Розрив шва"')) +
          (x ? M.locked('Відділ', x.departments) : '<label class="field" data-f="deptTypeId"><span class="label">Відділ</span><select class="input" name="deptTypeId">' +
            types.map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === defType ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('') + '</select></label>') +
          '<div class="field"><span class="label">Рівень' + M.hq('term.levels') + '</span>' + M.seg('level', M.levelOpts(), st2.level) + '<span class="hint">Неправильно зроблене — можна виправити одразу · пошкоджене — іде в ремонт · зламане — не ремонтується, виріб втрачено.</span></div>' +
          (x ? '<div class="field"><span class="label">У формі аудиту' + M.hq('sr.mg.inForm') + '</span>' + M.seg('active', [[true, 'Показується'], [false, 'Приховано']], st2.active) + '</div>' : '') +
          '<p class="hint">Список видів браку спільний для всіх цехів.</p></div>',
        foot: M.cancelBtn() + '<button class="btn btn--primary" type="button" data-act="mg-save">' + P.ic(x ? 'save' : 'add') + (x ? 'Зберегти' : 'Додати вид браку') + '</button>',
        onMount: function (el) { M.enterSubmits(el, 'mg-save'); },
        on: {
          'mg-seg': function (t, e, layer) {
            var k = t.getAttribute('data-k'), raw = t.getAttribute('data-v');
            st2[k] = k === 'active' ? raw === 'true' : raw;
            qa(layer.el, '[data-k="' + k + '"]').forEach(function (b) { b.classList.toggle('seg__btn--on', b === t); b.setAttribute('aria-pressed', b === t); });
          },
          'mg-save': function (t, e, layer) {
            var p = x ? { id: x.id, name: M.val(layer.el, 'name'), level: st2.level, active: st2.active } : { name: M.val(layer.el, 'name'), deptTypeId: M.val(layer.el, 'deptTypeId'), level: st2.level };
            t.disabled = true;
            v.call('srMgDefectSave', p).then(function (r) {
              t.disabled = false;
              if (!r.ok) { M.showErrors(layer.el, r); return; }
              layer.close(); P.toast('ok', (r.created ? 'Вид браку додано · ' : 'Зміни збережено · ') + r.name, 'Рівень — ' + P.sr.LEVELS[r.level] + '.');
              P.emit('kd:changed'); if (v.ctx.alive()) load();
            });
          }
        } });
    }
    function show(x) {
      v.call('srMgDefectSave', { id: x.id, active: !x.active }).then(function (r) {
        if (!v.ctx.alive()) return;
        if (!r.ok) { M.failToast(r); return; }
        P.toast('ok', (r.active ? 'Знову у формі аудиту · ' : 'Сховано з форми аудиту · ') + r.name, r.active ? '' : 'Записи браку з цим видом лишились в історії.');
        load();
      });
    }
    function merge(src) {
      M.openMerge(v, { kind: 'defects', src: src, onDone: function () { st.sel = {}; load(); },
        items: data.items.map(function (x) {
          return { id: x.id, name: x.name, type: x.deptTypeId, typeName: typeName(x.deptTypeId), level: x.level,
            meta: H.lvl(x.level || 'fix') + ' · ' + esc(x.departments) + ' · ' + M.cnt(x.records, W.rec) + ' у цеху' + (x.active ? '' : ' · приховано у формі') };
        }) });
    }
    v.openNew = function () { openEdit(null); };
    v.ctx.on('mg-new', function () { openEdit(null); });
    v.ctx.on('mg-menu', function (t) {
      var x = find(t.getAttribute('data-id'));
      M.rowMenu(t, [{ act: 'edit', ic: 'edit', title: 'Редагувати' }, { act: 'merge', ic: 'merge', title: 'Обʼєднати з іншим…' }, 'sep', showItem(x.active)],
        { edit: function () { openEdit(x); }, merge: function () { merge([x.id]); }, show: function () { show(x); } });
    });
    v.ctx.on('mg-q', function (t) { st.q = t.value; redrawRows(); });
    v.ctx.on('mg-type', function (t) { st.type = t.getAttribute('data-id'); draw(); });
    v.ctx.on('mg-lvl', function (t) { var k = t.getAttribute('data-v'); st.lvl = st.lvl === k ? '' : k; draw(); });
    v.ctx.on('mg-sel', function (t) { var id = t.getAttribute('data-id'); st.sel[id] = !st.sel[id]; redrawRows(); });
    v.ctx.on('mg-sel-clear', function () { st.sel = {}; redrawRows(); });
    v.ctx.on('mg-level', function (t) {
      var x = find(t.getAttribute('data-id')), lv = t.getAttribute('data-v');
      if (x.level === lv) return;
      t.disabled = true;
      v.call('srMgDefectSave', { id: x.id, level: lv }).then(function (r) {
        if (!v.ctx.alive()) return;
        if (!r.ok) { t.disabled = false; M.failToast(r); return; }
        P.toast('ok', 'Рівень змінено · ' + r.name + ' → ' + P.sr.LEVELS[r.level], 'Діє для всіх аудитів із цим видом.');
        P.emit('kd:changed'); load();
      });
    });
    v.ctx.on('mg-merge', function () { merge([]); });
    v.ctx.on('mg-merge-sel', function () { merge(selIds()); });
    load();
  });
})(window);
