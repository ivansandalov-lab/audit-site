(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, M = P.srMg;
  var q = M.q, qa = M.qa, da = M.da;

  M.section('team', 'Працівники', function (v) {
    var data = null;
    function load() { v.get('srMgTeam', function (r) { data = r; draw(); }); }
    function find(id) { return data.items.filter(function (x) { return x.id === id; })[0]; }
    function row(u) {
      var login = !u.login ? '—' : u.login.kind === 'never' ? H.badge('ще не входив', 'info') : u.login.kind === 'expired' ? H.badge('треба увійти знову', 'warn') : 'до ' + H.dayShort(u.login.until);
      return '<tr' + (u.active ? '' : ' class="mg-off"') + '><td><b>' + esc(u.name) + '</b>' +
        (!u.active ? '<span class="sub">доступ вимкнено</span>' : u.addedAt ? '<span class="sub">' + M.added(u.addedAt) + '</span>' : '') + '</td>' +
        '<td>' + esc(u.email) + '</td><td class="mg-nowrap">' + M.ago(u.lastAuditAt) + '</td><td>' + login + '</td>' +
        '<td>' + M.sw(u.active, 'mg-access', da('id', u.id), (u.active ? 'Доступ увімкнено' : 'Доступ вимкнено') + ' · ' + u.name) + '</td>' +
        '<td>' + M.pen('mg-edit', da('id', u.id), 'Редагувати ' + u.name) + '</td></tr>';
    }
    function draw() {
      v.col.innerHTML = M.head('Працівники', 'Аудитори · ' + data.location.name + ' · вхід через Google робочою поштою', M.btnNew('Новий працівник')) +
        '<section class="card">' + (data.items.length ? '<div class="tbl-box"><table class="tbl"><thead><tr><th>Працівник</th><th>Робоча пошта</th><th>Останній аудит</th><th>Вхід діє</th><th>Доступ</th><th><span class="mg-vh">Дії</span></th></tr></thead><tbody>' +
          data.items.map(row).join('') + '</tbody></table></div>'
          : H.empty('Аудиторів ще немає', '')) +
        '<p class="hint">Вимкнений доступ: вхід закрито, аудити людини лишаються в історії.</p></section>';
    }
    function openEdit(u) {
      var st = { active: u ? u.active : true };
      M.modal({ size: 'sm', title: u ? 'Редагувати працівника' : 'Новий працівник', sub: u ? esc(u.name) : '',
        body: '<div class="mg-form">' +
          M.field('name', 'Імʼя та перша літера прізвища', M.input('name', u ? u.name : '', ' autocomplete="off" maxlength="60" placeholder="Петро Л."')) +
          M.field('email', 'Робоча Google-пошта', M.input('email', '', ' type="email" autocomplete="off" maxlength="120" placeholder="' + (u ? esc(u.email) : 'petro.l@example.com') + '"'),
            u ? 'Зараз: ' + u.email + '. Порожнє поле — пошта без змін.' : '') +
          '<div class="pair">' + M.locked('Роль', 'Працівник (аудитор)') + M.locked('Локація', v.ctx.loc.name) + '</div>' +
          (u ? '<div class="field"><span class="label">Доступ</span>' + M.seg('active', [[true, 'Увімкнено'], [false, 'Вимкнено']], st.active) + '</div>' : '') +
          '<p class="hint">Вхід — через Google, раз на тиждень. Старших і керівників додає адмін.</p></div>',
        foot: M.cancelBtn() + '<button class="btn btn--primary" type="button" data-act="mg-save">' + P.ic(u ? 'save' : 'add') + (u ? 'Зберегти' : 'Додати працівника') + '</button>',
        onMount: function (el) { M.enterSubmits(el, 'mg-save'); },
        on: {
          'mg-seg': function (t, e, layer) { st.active = t.getAttribute('data-v') === 'true'; qa(layer.el, '[data-k="active"]').forEach(function (b) { b.classList.toggle('seg__btn--on', b === t); }); },
          'mg-save': function (t, e, layer) {
            var p = { name: M.val(layer.el, 'name'), email: M.val(layer.el, 'email') };
            if (u) { p.id = u.id; p.active = st.active; }
            t.disabled = true;
            v.call('srMgUserSave', p).then(function (r) {
              t.disabled = false;
              if (!r.ok) { M.showErrors(layer.el, r); return; }
              layer.close();
              P.toast('ok', (r.created ? 'Працівника додано · ' : 'Зміни збережено · ') + r.name, r.active ? '' : 'Доступ вимкнено.');
              if (v.ctx.alive()) load();
            });
          }
        } });
    }
    v.openNew = function () { openEdit(null); };
    v.ctx.on('mg-new', function () { openEdit(null); });
    v.ctx.on('mg-edit', function (t) { openEdit(find(t.getAttribute('data-id'))); });
    v.ctx.on('mg-access', function (t) {
      var u = find(t.getAttribute('data-id'));
      function go() {
        t.disabled = true;
        v.call('srMgUserSave', { id: u.id, active: !u.active }).then(function (r) {
          if (!v.ctx.alive()) return;
          if (!r.ok) { t.disabled = false; M.failToast(r); return; }
          P.toast('ok', (r.active ? 'Доступ увімкнено · ' : 'Доступ вимкнено · ') + r.name, r.active ? '' : 'Записані аудити лишились в історії.');
          load();
        });
      }
      if (!u.active) { go(); return; }
      P.confirm({ title: 'Вимкнути доступ · ' + u.name + '?', text: 'Вхід у додаток буде закрито. Записані аудити лишаються в історії.', okLabel: 'Вимкнути доступ', danger: true })
        .then(function (ok) { if (ok) go(); });
    });
    load();
  });

  var NEW = '@new';   // значення фільтра «Додані аудиторами»
  M.section('workers', 'Виробничі працівники', function (v) {
    var data = null, st = { q: '', dep: '', edit: null };
    function load() { v.get('srMgWorkers', function (r) { data = r; if (st.dep === NEW && !r.pending) st.dep = ''; draw(); }); }
    function find(code) { return data.items.filter(function (x) { return x.code === code; })[0]; }
    function deps() { return data.departments; }
    function depOptions(cur) { return deps().map(function (d) { return '<option value="' + esc(d.id) + '"' + (d.id === cur ? ' selected' : '') + '>' + esc(d.name) + (d.active ? '' : ' (вимкнено)') + '</option>'; }).join(''); }
    function shown() {
      var s = st.q.trim().toLowerCase();
      return data.items.filter(function (w) { return (st.dep === NEW ? w.pending : !st.dep || w.departmentId === st.dep) && (!s || w.name.toLowerCase().indexOf(s) >= 0); });
    }
    function toggle(w) { return M.sw(w.active, 'mg-on', da('code', w.code), (w.active ? 'Є у формі аудиту' : 'Немає у формі аудиту') + ' · ' + w.name); }
    function row(w) {
      if (st.edit === w.code) {
        return '<tr class="sel" data-mg-editrow>' +
          '<td data-f="name"><input class="input" name="name" value="' + esc(w.name) + '" aria-label="Працівник, як підписаний у цеху" maxlength="40" style="min-width:170px;height:44px"></td>' +
          '<td data-f="departmentId"><select class="input" name="departmentId" aria-label="Відділ" style="min-width:150px;height:44px">' + depOptions(w.departmentId) + '</select></td>' +
          '<td class="n">' + H.num(w.audits30) + '</td><td>' + toggle(w) + '</td>' +
          '<td><div class="mg-rowacts"><button class="btn btn--primary btn--sm" type="button" data-act="mg-row-save">' + P.ic('check', 'ui-icon--sm') + 'Зберегти</button>' +
          '<button class="btn btn--quiet btn--sm" type="button" data-act="mg-row-cancel">Скасувати</button></div></td></tr>';
      }
      var sub = w.pending ? '<span class="sub"><span class="badge badge--info mg-flag">додав аудитор' + (w.addedByName ? ' ' + esc(w.addedByName) : '') + (w.addedAt ? ' · ' + H.dayShort(P.fmt.dayKey(w.addedAt)) : '') + '</span></span>'
        : !w.active ? '<span class="sub">немає у формі аудиту</span>' : w.addedAt ? '<span class="sub">' + M.added(w.addedAt) + '</span>' : '';
      return '<tr' + (w.active ? '' : ' class="mg-off"') + '><td><b>' + esc(w.name) + '</b>' + sub + '</td>' +
        '<td>' + esc(w.departmentName) + '</td><td class="n">' + H.num(w.audits30) + '</td><td>' + toggle(w) + '</td>' +
        '<td><div class="mg-rowacts">' + (w.pending ? '<button class="btn btn--secondary btn--sm" type="button" data-act="mg-confirm"' + da('code', w.code) + '>' + P.ic('check', 'ui-icon--sm') + 'Підтверджено</button>' : '') +
        M.pen('mg-edit', da('code', w.code), 'Редагувати ' + w.name) + '</div></td></tr>';
    }
    function tbody() {
      var list = shown();
      return list.length ? list.map(row).join('') : '<tr><td colspan="5">' + H.empty(data.items.length ? 'Нікого не знайдено' : 'Працівників ще немає', '') + '</td></tr>';
    }
    function countHint() { return 'Показано ' + shown().length + ' з ' + data.items.length; }
    function draw() {
      var pills = [['', 'Усі']].concat(deps().map(function (d) { return [d.id, d.name]; }));
      if (data.pending) pills.push([NEW, 'Додані аудиторами · ' + data.pending]);
      v.col.innerHTML = M.head('Виробничі працівники', 'Кого обирають в аудиті · ' + data.location.name + ' · ' + M.cnt(data.items.length, ['людина', 'людини', 'людей']), M.btnNew('Новий виробничий працівник')) +
        '<section class="card"><div class="mg-tools"><div class="search" style="flex:1;min-width:220px">' + P.ic('search', 'icon') +
        '<input class="input" data-input="mg-q" value="' + esc(st.q) + '" placeholder="Працівник, напр. q5" aria-label="Пошук працівника за назвою" style="padding-left:46px"></div>' +
        '<span class="pills mg-pills">' + pills.map(function (o) {
          return '<button class="pill' + (st.dep === o[0] ? ' pill--on' : '') + (o[0] === NEW ? ' mg-pill-new' : '') + '" type="button" aria-pressed="' + (st.dep === o[0]) + '" data-act="mg-dep"' + da('id', o[0]) + '>' + esc(o[1]) + '</button>'; }).join('') + '</span></div>' +
        '<div class="tbl-box"><table class="tbl"><thead><tr><th>Працівник</th><th>Відділ</th><th class="n">Аудитів за 30 дн</th><th>У формі аудиту</th><th><span class="mg-vh">Дії</span></th></tr></thead><tbody data-mg-body>' + tbody() + '</tbody></table></div>' +
        '<p class="hint" data-mg-hint>' + countHint() + '</p></section>';
    }
    function redrawRows() { var b = q(v.col, '[data-mg-body]'); if (b) b.innerHTML = tbody(); var h = q(v.col, '[data-mg-hint]'); if (h) h.textContent = countHint(); }
    function save(code, p, done) {
      return v.call('srMgWorkerSave', Object.assign({ code: code }, p)).then(function (r) { if (v.ctx.alive()) done(r); return r; });
    }
    function openNew() {
      var first = deps().filter(function (d) { return d.active; })[0] || deps()[0];
      M.modal({ size: 'sm', title: 'Новий виробничий працівник', sub: esc(v.ctx.loc.name),
        body: '<div class="mg-form">' + M.field('name', 'Працівник (як підписаний у цеху, напр. q5)', M.input('name', '', ' autocomplete="off" maxlength="40" placeholder="q5"')) +
          '<label class="field" data-f="departmentId"><span class="label">Відділ</span><select class="input" name="departmentId">' + depOptions(first && first.id) + '</select></label></div>',
        foot: M.cancelBtn() + '<button class="btn btn--primary" type="button" data-act="mg-save">' + P.ic('add') + 'Додати працівника</button>',
        onMount: function (el) { M.enterSubmits(el, 'mg-save'); },
        on: { 'mg-save': function (t, e, layer) {
          t.disabled = true;
          v.call('srMgWorkerSave', { name: M.val(layer.el, 'name'), departmentId: M.val(layer.el, 'departmentId') }).then(function (r) {
            t.disabled = false;
            if (!r.ok) { M.showErrors(layer.el, r); return; }
            layer.close(); P.toast('ok', 'Працівника додано · ' + r.name, 'Є у формі аудиту.');
            if (v.ctx.alive()) load();
          });
        } } });
    }
    v.openNew = openNew;
    v.ctx.on('mg-new', openNew);
    v.ctx.on('mg-q', function (t) { st.q = t.value; redrawRows(); });
    v.ctx.on('mg-dep', function (t) { st.dep = t.getAttribute('data-id'); st.edit = null; draw(); });
    v.ctx.on('mg-edit', function (t) { st.edit = t.getAttribute('data-code'); redrawRows(); var i = q(v.col, '[data-mg-editrow] input'); if (i) i.focus(); });
    v.ctx.on('mg-row-cancel', function () { st.edit = null; redrawRows(); });
    v.ctx.on('mg-row-save', function (t) {
      var tr = q(v.col, '[data-mg-editrow]'), w = find(st.edit);
      t.disabled = true;
      save(w.code, { name: M.val(tr, 'name'), departmentId: M.val(tr, 'departmentId') }, function (r) {
        t.disabled = false;
        if (!r.ok) { M.showErrors(tr, r); return; }
        st.edit = null; P.toast('ok', 'Зміни збережено · ' + r.name); load();
      });
    });
    v.ctx.on('mg-confirm', function (t) {
      var w = find(t.getAttribute('data-code')); t.disabled = true;
      save(w.code, { confirmed: true }, function (r) {
        if (!r.ok) { t.disabled = false; M.failToast(r); return; }
        P.toast('ok', 'Підтверджено · ' + r.name); load();
      });
    });
    v.ctx.on('mg-on', function (t) {
      var w = find(t.getAttribute('data-code')); t.disabled = true;
      save(w.code, { active: !w.active }, function (r) {
        if (!r.ok) { t.disabled = false; M.failToast(r); return; }
        P.toast('ok', (r.active ? 'Знову у формі аудиту · ' : 'Прибрано з форми аудиту · ') + r.name, r.active ? '' : 'Аудити з цим працівником лишились в історії.');
        load();
      });
    });
    load();
  });
})(window);
