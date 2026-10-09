(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc;

  var SECTIONS = [
    { id: 'team', label: 'Працівники', count: 'team' },
    { id: 'workers', label: 'Виробничі працівники', count: 'workers' },
    { id: 'products', label: 'Відділи й вироби' },
    { id: 'defects', label: 'Види браку', count: 'defects' },
    { id: 'blocks', label: 'Блоки замовлень', count: 'blocks' },
    { id: 'import', label: 'Виробництво: план і факт' },
    { id: 'mailing', label: 'Розсилки', count: 'mailing' }
  ];
  var LV_SHORT = { fix: 'неправильно', repair: 'пошкоджене', scrap: 'зламане' };
  var counts = {};   // останні лічильники меню зліва (щоб не блимали між розділами)

  function plural(n, f) { var a = n % 10, b = n % 100; return f[a === 1 && b !== 11 ? 0 : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 1 : 2]; }
  function cnt(n, f) { return H.num(n) + ' ' + plural(n, f); }
  function inAudits(n) { return H.num(n) + ' ' + (n % 10 === 1 && n % 100 !== 11 ? 'аудиті' : 'аудитах'); }
  var W_AUDIT = ['аудит', 'аудити', 'аудитів'], W_ORDER = ['замовлення', 'замовлення', 'замовлень'], W_REC = ['запис', 'записи', 'записів'];
  function today() { return P.fmt.dayKey(new Date()); }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000); }
  function dateLong(iso) { var k = String(iso).length > 10 ? P.fmt.dayKey(iso) : iso; return new Date(Date.parse(k + 'T12:00:00Z')).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', timeZone: 'UTC' }); }
  function ago(iso) {
    if (!iso) return '—';
    var d = daysBetween(P.fmt.dayKey(iso), today());
    if (d <= 0) return 'сьогодні, ' + P.fmt.time(iso);
    if (d === 1) return 'учора, ' + P.fmt.time(iso);
    return d < 14 ? d + ' ' + plural(d, ['день', 'дні', 'днів']) + ' тому' : dateLong(iso);
  }
  function added(iso) { if (!iso) return ''; var d = daysBetween(P.fmt.dayKey(iso), today()); return d <= 0 ? 'додано сьогодні' : d === 1 ? 'додано вчора' : 'додано ' + dateLong(iso); }
  function gone(names) { return names.map(function (n) { return '«' + n + '»'; }).join(', ') + (names.length > 1 ? ' — зникли' : ' — зник') + ' зі списків.'; }
  function da(k, v) { return ' data-' + k + '="' + esc(v) + '"'; }
  function q(el, sel) { return el.querySelector(sel); }
  function qa(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }

  function sw(on, act, data, label) {
    return '<button class="toggle mg-sw' + (on ? ' toggle--on' : '') + '" type="button" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="' + esc(label) +
      '" title="' + esc(label) + '" data-act="' + act + '"' + data + '></button>';
  }
  function ck(on, act, data, label) {
    return '<button class="check mg-ck' + (on ? ' check--on' : '') + '" type="button" role="checkbox" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="' + esc(label) + '" data-act="' + act + '"' + data + '>' +
      (on ? P.ic('check', 'ui-icon--sm') : '') + '</button>';
  }
  function pen(act, data, label) { return '<button class="icon-btn" type="button" data-act="' + act + '"' + data + ' aria-label="' + esc(label) + '" title="Редагувати">' + P.ic('edit') + '</button>'; }
  function head(title, sub, btn) { return '<div class="mg-head"><div><h2 class="h2">' + esc(title) + '</h2><p class="h2-sub">' + esc(sub) + '</p></div>' + (btn || '') + '</div>'; }
  function btnNew(label) { return '<button class="btn btn--primary" type="button" data-act="mg-new">' + P.ic('add') + esc(label) + '</button>'; }
  function note(b, rest) { return '<div class="note-box"><b>' + esc(b) + '</b> ' + esc(rest) + '</div>'; }
  function banner(kind, title, text) {
    return '<div class="banner' + (kind ? ' banner--' + kind : '') + '">' + P.ic(kind === 'warn' ? 'warning' : 'info', 'icon') +
      '<div class="banner__body"><p class="banner__title">' + esc(title) + '</p>' + (text ? '<p class="banner__text">' + esc(text) + '</p>' : '') + '</div></div>';
  }
  function field(name, label, inner, hint) { return '<label class="field" data-f="' + name + '"><span class="label">' + esc(label) + '</span>' + inner + (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + '</label>'; }
  function input(name, value, attrs) { return '<input class="input" name="' + name + '" value="' + esc(value == null ? '' : value) + '"' + (attrs || '') + '>'; }
  function locked(label, text) { return '<div class="field"><span class="label">' + esc(label) + '</span><span class="select" style="color:var(--text-2);cursor:default">' + esc(text) + P.ic('lock', 'icon icon--sm') + '</span></div>'; }
  function seg(name, opts, cur, act) {
    return '<div class="seg" role="radiogroup" data-f="' + name + '">' + opts.map(function (o) {
      return '<button class="seg__btn' + (o[0] === cur ? ' seg__btn--on' : '') + '" type="button" aria-pressed="' + (o[0] === cur) + '" data-act="' + (act || 'mg-seg') + '"' + da('k', name) + da('v', o[0]) + '>' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function levelOpts() { return ['fix', 'repair', 'scrap'].map(function (k) { return [k, H.lvl(k)]; }); }
  function val(el, name) { var i = q(el, '[name="' + name + '"]'); return i ? i.value : ''; }
  function modal(o, wide) {
    var mount = o.onMount;
    o.onMount = function (el, layer) { var m = q(el, '.modal'); m.classList.add('mg-modal'); if (wide) m.classList.add('mg-wide'); if (mount) mount(el, layer); };
    return P.sr.modal(o);
  }
  function cancelBtn() { return '<span style="flex:1"></span><button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button>'; }

  function showErrors(box, r) {
    qa(box, '.mg-err').forEach(function (e) { e.remove(); });
    qa(box, '.input--invalid').forEach(function (e) { e.classList.remove('input--invalid'); });
    if (!r || r.ok) return;
    if (r.code !== 'validation') { failToast(r); return; }
    var shown = 0;
    (r.errors || []).forEach(function (e) {
      var f = q(box, '[data-f="' + e.field + '"]'); if (!f) return;
      var i = f.matches('.input') ? f : q(f, '.input'); if (i) i.classList.add('input--invalid');
      f.insertAdjacentHTML('beforeend', '<p class="err mg-err" role="alert">' + esc(e.message) + '</p>');
      shown++;
    });
    if (!shown) P.toast('warn', 'Перевірте дані', r.error);
  }
  function failToast(r) { if (r && r.code !== 'forbidden') P.toast('danger', 'Не вдалося зберегти', (r && r.error) || 'Спробуйте ще раз.'); }
  function enterSubmits(el, act) {
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !e.target.matches('input.input') || e.target.hasAttribute('data-noenter')) return;
      e.preventDefault(); var b = q(el, '[data-act="' + act + '"]'); if (b && !b.disabled) b.click();
    });
  }

  function frame(ctx, sec) {
    ctx.el.innerHTML = '<div class="split mg-split"><nav class="side" aria-label="Керування локацією">' + SECTIONS.map(function (s) {
      return '<a href="#/manage/' + s.id + '"' + (s.id === sec ? ' class="on" aria-current="page"' : '') + '>' + esc(s.label) +
        (s.count ? '<span class="count" data-mg-count="' + s.count + '">' + (counts[s.count] != null ? counts[s.count] : '') + '</span>' : '') + '</a>';
    }).join('') + '</nav><div class="main-col" data-mg-col>' + H.loading() + '</div></div>';
    return q(ctx.el, '[data-mg-col]');
  }
  function setCounts(ctx, c) {
    if (!c) return; counts = c;
    qa(ctx.el, '[data-mg-count]').forEach(function (e) { var x = c[e.getAttribute('data-mg-count')]; e.textContent = x == null ? '' : x; });
  }
  function section(id, title, mount) {
    P.sr.screen('/manage/' + id, { tab: 'manage', title: 'Керування · ' + title, period: false, render: function (ctx) {
      var v = { ctx: ctx, col: frame(ctx, id), loc: ctx.loc.id, wantNew: ctx.query && ctx.query.new === '1' };
      if (v.wantNew && root.history && root.history.replaceState) root.history.replaceState(null, '', '#/manage/' + id);
      v.call = function (fn, p) { return P.srv(fn, Object.assign({ locationId: v.loc }, p || {})); };
      v.get = function (fn, draw) {
        v.call(fn).then(function (r) {
          if (!ctx.alive()) return;
          if (!r.ok) { v.col.innerHTML = H.error(r); return; }
          setCounts(ctx, r.counts); draw(r);
          if (v.wantNew && v.openNew) { v.wantNew = false; v.openNew(); }
        });
      };
      mount(v);
    } });
  }
  P.sr.screen('/manage', { tab: 'manage', title: 'Керування', period: false, render: function (ctx) { ctx.go('/manage/team'); } });

  section('team', 'Працівники', function (v) {
    var data = null;
    function load() { v.get('srMgTeam', function (r) { data = r; draw(); }); }
    function find(id) { return data.items.filter(function (x) { return x.id === id; })[0]; }
    function row(u) {
      var login = !u.login ? '—' : u.login.kind === 'never' ? H.badge('ще не входив', 'info') : u.login.kind === 'expired' ? H.badge('треба увійти знову', 'warn') : 'до ' + H.dayShort(u.login.until);
      return '<tr' + (u.active ? '' : ' class="mg-off"') + '><td><b>' + esc(u.name) + '</b>' +
        (!u.active ? '<span class="sub">доступ вимкнено</span>' : u.addedAt ? '<span class="sub">' + added(u.addedAt) + '</span>' : '') + '</td>' +
        '<td>' + esc(u.email) + '</td><td class="mg-nowrap">' + ago(u.lastAuditAt) + '</td><td>' + login + '</td>' +
        '<td>' + sw(u.active, 'mg-access', da('id', u.id), (u.active ? 'Доступ увімкнено' : 'Доступ вимкнено') + ' · ' + u.name) + '</td>' +
        '<td>' + pen('mg-edit', da('id', u.id), 'Редагувати ' + u.name) + '</td></tr>';
    }
    function draw() {
      v.col.innerHTML = head('Працівники', 'Хто записує аудити в ' + data.location.name + '. Вхід — через Google робочою поштою, пароль не потрібен.', btnNew('Новий працівник')) +
        '<section class="card">' + (data.items.length ? '<div class="tbl-box"><table class="tbl"><thead><tr><th>Працівник</th><th>Робоча пошта</th><th>Останній аудит</th><th>Вхід</th><th>Доступ</th><th><span class="mg-vh">Дії</span></th></tr></thead><tbody>' +
          data.items.map(row).join('') + '</tbody></table></div>'
          : H.empty('Аудиторів ще немає', 'Додайте першого кнопкою «Новий працівник» — він увійде своєю робочою поштою.')) +
        note('Вимкнули доступ — зникає одразу:', 'людина більше нічого не бачить, а її аудити лишаються в історії. Увімкнути знову можна тим самим перемикачем.') + '</section>';
    }
    function openEdit(u) {
      var st = { active: u ? u.active : true };
      modal({ size: 'sm', title: u ? 'Редагувати працівника' : 'Новий працівник', sub: u ? esc(u.name) : '',
        body: '<div class="mg-form">' +
          field('name', 'Імʼя та перша літера прізвища', input('name', u ? u.name : '', ' autocomplete="off" maxlength="60" placeholder="Петро Л."')) +
          field('email', 'Робоча Google-пошта', input('email', '', ' type="email" autocomplete="off" maxlength="120" placeholder="' + (u ? esc(u.email) : 'petro.l@example.com') + '"'),
            u ? 'Зараз: ' + u.email + '. Залиште порожнім — пошта не зміниться.' : 'Саме цією поштою він увійде в додаток.') +
          '<div class="pair">' + locked('Роль', 'Працівник (аудитор)') + locked('Локація', v.ctx.loc.name) + '</div>' +
          (u ? '<div class="field"><span class="label">Доступ</span>' + seg('active', [[true, 'Увімкнено'], [false, 'Вимкнено']], st.active) + '</div>'
            : banner('', 'Пароль не потрібен', 'Працівник відкриє додаток на телефоні й натисне «Увійти через Google». Раз на тиждень додаток попросить увійти знову.')) +
          '<p class="hint">Старших і керівників додає адмін. Імʼя, пошту й доступ можна змінити пізніше — кнопкою-олівцем у списку.</p></div>',
        foot: cancelBtn() + '<button class="btn btn--primary" type="button" data-act="mg-save">' + P.ic(u ? 'save' : 'add') + (u ? 'Зберегти' : 'Додати працівника') + '</button>',
        onMount: function (el) { enterSubmits(el, 'mg-save'); },
        on: {
          'mg-seg': function (t, e, layer) { st.active = t.getAttribute('data-v') === 'true'; qa(layer.el, '[data-k="active"]').forEach(function (b) { b.classList.toggle('seg__btn--on', b === t); }); },
          'mg-save': function (t, e, layer) {
            var p = { name: val(layer.el, 'name'), email: val(layer.el, 'email') };
            if (u) { p.id = u.id; p.active = st.active; }
            t.disabled = true;
            v.call('srMgUserSave', p).then(function (r) {
              t.disabled = false;
              if (!r.ok) { showErrors(layer.el, r); return; }
              layer.close();
              P.toast('ok', (r.created ? 'Працівника додано · ' : 'Зміни збережено · ') + r.name, r.created ? 'Може входити своєю робочою поштою.' : (r.active ? '' : 'Доступ вимкнено.'));
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
          if (!r.ok) { t.disabled = false; failToast(r); return; }
          P.toast('ok', (r.active ? 'Доступ увімкнено · ' : 'Доступ вимкнено · ') + r.name, r.active ? 'Може знову записувати аудити.' : 'Записані аудити лишились в історії.');
          load();
        });
      }
      if (!u.active) { go(); return; }
      P.confirm({ title: 'Вимкнути доступ · ' + u.name + '?', text: 'Людина більше не зможе увійти й записувати аудити. Записані аудити лишаться в історії.', okLabel: 'Вимкнути доступ', danger: true })
        .then(function (ok) { if (ok) go(); });
    });
    load();
  });

  section('workers', 'Виробничі працівники', function (v) {
    var data = null, st = { q: '', dep: '', edit: null };
    function load() { v.get('srMgWorkers', function (r) { data = r; draw(); }); }
    function find(code) { return data.items.filter(function (x) { return x.code === code; })[0]; }
    function deps() { return data.departments; }
    function depOptions(cur) { return deps().map(function (d) { return '<option value="' + esc(d.id) + '"' + (d.id === cur ? ' selected' : '') + '>' + esc(d.name) + (d.active ? '' : ' (вимкнено)') + '</option>'; }).join(''); }
    function shown() {
      var s = st.q.trim().toLowerCase();
      return data.items.filter(function (w) { return (!st.dep || w.departmentId === st.dep) && (!s || w.name.toLowerCase().indexOf(s) >= 0 || w.code.toLowerCase().indexOf(s) >= 0); });
    }
    function row(w) {
      if (st.edit === w.code) {
        return '<tr class="sel" data-mg-editrow><td><b>' + esc(w.code) + '</b></td>' +
          '<td data-f="name"><input class="input" name="name" value="' + esc(w.name) + '" aria-label="Імʼя" maxlength="60" style="min-width:170px;height:44px"></td>' +
          '<td data-f="departmentId"><select class="input" name="departmentId" aria-label="Відділ" style="min-width:150px;height:44px">' + depOptions(w.departmentId) + '</select></td>' +
          '<td class="n">' + H.num(w.audits30) + '</td><td>' + sw(w.active, 'mg-on', da('code', w.code), (w.active ? 'Показується в аудитах' : 'Не показується') + ' · ' + w.name) + '</td>' +
          '<td><div style="display:flex;gap:6px"><button class="btn btn--primary btn--sm" type="button" data-act="mg-row-save">' + P.ic('check', 'ui-icon--sm') + 'Зберегти</button>' +
          '<button class="btn btn--quiet btn--sm" type="button" data-act="mg-row-cancel">Скасувати</button></div></td></tr>';
      }
      return '<tr' + (w.active ? '' : ' class="mg-off"') + '><td><b>' + esc(w.code) + '</b></td><td><b>' + esc(w.name) + '</b>' +
        (!w.active ? '<span class="sub">не показується в нових аудитах</span>' : w.addedAt ? '<span class="sub">' + added(w.addedAt) + '</span>' : '') + '</td>' +
        '<td>' + esc(w.departmentName) + '</td><td class="n">' + H.num(w.audits30) + '</td>' +
        '<td>' + sw(w.active, 'mg-on', da('code', w.code), (w.active ? 'Показується в аудитах' : 'Не показується') + ' · ' + w.name) + '</td>' +
        '<td>' + pen('mg-edit', da('code', w.code), 'Редагувати ' + w.name) + '</td></tr>';
    }
    function tbody() {
      var list = shown();
      return list.length ? list.map(row).join('') : '<tr><td colspan="6">' + H.empty('Нікого не знайдено', st.q ? 'Перевірте імʼя чи код або оберіть «Усі».' : 'У цьому відділі ще немає працівників — додайте кнопкою вгорі.') + '</td></tr>';
    }
    function countHint() { return 'Показано ' + shown().length + ' з ' + data.items.length + ' · за кодом'; }
    function draw() {
      v.col.innerHTML = head('Виробничі працівники', 'Ті, кого перевіряють: їх обирають в аудиті, коли записують брак. У ' + data.location.name + ' — ' + cnt(data.items.length, ['людина', 'людини', 'людей']) + '.', btnNew('Новий виробничий працівник')) +
        '<section class="card"><div class="mg-tools"><div class="search" style="flex:1;min-width:220px">' + P.ic('search', 'icon') +
        '<input class="input" data-input="mg-q" value="' + esc(st.q) + '" placeholder="Імʼя або код" aria-label="Пошук за імʼям або кодом" style="padding-left:46px"></div>' +
        '<span class="pills mg-pills">' + [['', 'Усі']].concat(deps().map(function (d) { return [d.id, d.name]; })).map(function (o) {
          return '<button class="pill' + (st.dep === o[0] ? ' pill--on' : '') + '" type="button" data-act="mg-dep"' + da('id', o[0]) + '>' + esc(o[1]) + '</button>'; }).join('') + '</span></div>' +
        '<div class="tbl-box"><table class="tbl"><thead><tr><th>Код</th><th>Імʼя</th><th>Відділ</th><th class="n">Аудитів за 30 дн</th><th>Показувати в аудитах</th><th><span class="mg-vh">Дії</span></th></tr></thead><tbody data-mg-body>' + tbody() + '</tbody></table></div>' +
        '<p class="hint" data-mg-hint>' + countHint() + '</p>' +
        note('Код — літера відділу й номер (Ш-034).', 'Звільнився — вимкніть: історія лишиться, а в нових аудитах людини вже не буде.') + '</section>';
    }
    function redrawRows() { var b = q(v.col, '[data-mg-body]'); if (b) b.innerHTML = tbody(); var h = q(v.col, '[data-mg-hint]'); if (h) h.textContent = countHint(); }
    function save(code, p, done) {
      return v.call('srMgWorkerSave', Object.assign({ code: code }, p)).then(function (r) { if (v.ctx.alive()) done(r); return r; });
    }
    function openNew() {
      var first = deps().filter(function (d) { return d.active; })[0] || deps()[0];
      function code(depId) { var d = deps().filter(function (x) { return x.id === depId; })[0]; return d ? d.letter + '-' + String(data.nextNo).padStart(3, '0') : '—'; }
      modal({ size: 'sm', title: 'Новий виробничий працівник', sub: esc(v.ctx.loc.name),
        body: '<div class="mg-form">' + field('name', 'Імʼя та перша літера прізвища', input('name', '', ' autocomplete="off" maxlength="60" placeholder="Ірина П."')) +
          '<label class="field" data-f="departmentId"><span class="label">Відділ</span><select class="input" name="departmentId">' + depOptions(first && first.id) + '</select></label>' +
          '<div class="facts"><span class="hint">Код у списках і в аудитах</span><b class="mg-code" data-mg-code>' + esc(code(first && first.id)) + '</b><span class="hint">Літера відділу й наступний номер — додаток ставить сам.</span></div></div>',
        foot: cancelBtn() + '<button class="btn btn--primary" type="button" data-act="mg-save">' + P.ic('add') + 'Додати працівника</button>',
        onMount: function (el) {
          enterSubmits(el, 'mg-save');
          q(el, 'select[name="departmentId"]').addEventListener('change', function (e) { q(el, '[data-mg-code]').textContent = code(e.target.value); });
        },
        on: { 'mg-save': function (t, e, layer) {
          t.disabled = true;
          v.call('srMgWorkerSave', { name: val(layer.el, 'name'), departmentId: val(layer.el, 'departmentId') }).then(function (r) {
            t.disabled = false;
            if (!r.ok) { showErrors(layer.el, r); return; }
            layer.close(); P.toast('ok', 'Працівника додано · ' + r.code + ' ' + r.name, 'Уже є у формі аудиту — у списку винних і перевірених.');
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
      save(w.code, { name: val(tr, 'name'), departmentId: val(tr, 'departmentId') }, function (r) {
        t.disabled = false;
        if (!r.ok) { showErrors(tr, r); return; }
        st.edit = null; P.toast('ok', 'Зміни збережено · ' + r.code + ' ' + r.name); load();
      });
    });
    v.ctx.on('mg-on', function (t) {
      var w = find(t.getAttribute('data-code')); t.disabled = true;
      save(w.code, { active: !w.active }, function (r) {
        if (!r.ok) { t.disabled = false; failToast(r); return; }
        P.toast('ok', (r.active ? 'Знову в аудитах · ' : 'Прибрано з нових аудитів · ') + r.code + ' ' + r.name, r.active ? '' : 'Старі аудити з цією людиною лишились в історії.');
        load();
      });
    });
    load();
  });

  section('products', 'Відділи й вироби', function (v) {
    var data = null, st = { dep: null, sel: {} };
    function load() { v.get('srMgCatalog', function (r) { data = r; if (!dep()) st.dep = r.departments[0] && r.departments[0].id; draw(); }); }
    function dep() { return data.departments.filter(function (d) { return d.id === st.dep; })[0]; }
    function prods() { var d = dep(); return d ? data.products.filter(function (x) { return x.deptTypeId === d.deptTypeId; }) : []; }
    function findP(id) { return data.products.filter(function (x) { return x.id === id; })[0]; }
    function selIds() { return Object.keys(st.sel).filter(function (id) { return st.sel[id] && findP(id); }); }
    function depRow(d) {
      return '<div class="mg-dep' + (d.id === st.dep ? ' mg-dep--on' : '') + '"><button class="mg-dep__pick" type="button" data-act="mg-dep"' + da('id', d.id) + (d.id === st.dep ? ' aria-current="true"' : '') + '>' +
        '<span style="flex:1;min-width:0"><b' + (d.active ? '' : ' style="color:var(--text-3)"') + '>' + esc(d.name) + '</b><span class="sub">' + cnt(d.products, ['виріб', 'вироби', 'виробів']) + ' · ' + d.shown + ' у формі</span></span>' +
        (d.active ? '<span class="hint" style="color:var(--ok);font-weight:600">працює</span>' : '<span class="hint">вимкнено</span>') + '</button>' +
        sw(d.active, 'mg-dep-on', da('id', d.id), (d.active ? 'Відділ працює' : 'Відділ вимкнено') + ' · ' + d.name) + '</div>';
    }
    function prodRow(x) {
      var on = !!st.sel[x.id];
      return '<tr class="' + (on ? 'sel' : '') + (x.active ? '' : ' mg-off') + '"><td style="width:44px">' + ck(on, 'mg-sel', da('id', x.id), 'Позначити ' + x.name) + '</td>' +
        '<td><b>' + esc(x.name) + '</b>' + (!x.active ? '<span class="sub">прихований у формі</span>' : x.addedAt ? '<span class="sub">' + added(x.addedAt) + '</span>' : '') + '</td>' +
        '<td class="n">' + H.num(x.audits) + '</td><td>' + sw(x.active, 'mg-prod-on', da('id', x.id), (x.active ? 'Показується у формі' : 'Приховано') + ' · ' + x.name) + '</td>' +
        '<td>' + pen('mg-prod-edit', da('id', x.id), 'Редагувати ' + x.name) + '</td></tr>';
    }
    function draw() {
      var d = dep(), list = prods(), ids = selIds(), allOn = list.length && list.every(function (x) { return st.sel[x.id]; });
      v.col.innerHTML = '<div><h2 class="h2">Відділи й вироби</h2><p class="h2-sub mg-sub">Що бачить аудитор у формі: які відділи працюють і які вироби в кожному.</p></div>' +
        '<div class="row" style="align-items:flex-start">' +
        '<section class="card" style="flex:1 1 300px;min-width:0"><div><h3 class="card-title">Відділи ' + esc(data.location.name) + '</h3><p class="hint">Оберіть відділ, щоб побачити його вироби</p></div>' +
        '<div style="display:flex;flex-direction:column;gap:2px">' + data.departments.map(depRow).join('') + '</div>' +
        note('Вимкнений відділ не видно у формі аудиту.', 'Його старі аудити лишаються в історії й аналітиці.') + '</section>' +
        '<section class="card" style="flex:2 1 520px;min-width:0">' + (!d ? H.empty('Відділів немає', 'У цьому цеху ще немає відділів.') :
          '<div class="card-head" style="flex-wrap:wrap"><div style="flex:1;min-width:200px"><h3 class="card-title">Вироби · ' + esc(d.name) + '</h3><p class="hint">' + cnt(list.length, ['виріб', 'вироби', 'виробів']) + ' · ' + d.shown + ' показуються у формі</p></div>' +
          '<button class="btn btn--primary btn--sm" type="button" data-act="mg-new">' + P.ic('add') + 'Новий виріб</button></div>' +
          (d.active ? '' : banner('warn', 'Відділ вимкнено — його вироби у формі зараз не видно.', 'Увімкніть відділ перемикачем зліва, коли він знову працюватиме.')) +
          (list.length ? '<div class="tbl-box"><table class="tbl"><thead><tr><th>' + ck(allOn, 'mg-sel-all', '', 'Обрати всі') + '</th><th>Виріб</th><th class="n">В аудитах</th><th>У формі</th><th><span class="mg-vh">Дії</span></th></tr></thead><tbody>' +
            list.map(prodRow).join('') + '</tbody></table></div>' : H.empty('Виробів ще немає', 'Додайте перший кнопкою «Новий виріб».')) +
          (ids.length >= 2 ? '<div class="mg-mergebar"><b>Обрано ' + cnt(ids.length, ['виріб', 'вироби', 'виробів']) + '</b><span style="flex:1"></span><button class="btn btn--quiet btn--sm" type="button" data-act="mg-sel-clear">Зняти позначки</button>' +
            '<button class="btn btn--primary btn--sm" type="button" data-act="mg-merge">' + P.ic('merge') + 'Обʼєднати</button></div>'
            : '<p class="hint">Позначте 2 або більше схожих виробів — і обʼєднайте їх в один. Аудити й замовлення перейдуть самі.</p>') +
          note('Вироби спільні для всіх цехів.', 'Нову назву чи обʼєднання побачать усі локації. Вимкнений виріб зникає лише з форми аудиту — історія лишається.')) + '</section></div>';
    }
    function openEdit(x) {
      var d = dep(), st2 = { active: x ? x.active : true };
      modal({ size: 'sm', title: x ? 'Редагувати виріб' : 'Новий виріб', sub: esc(d.name) + ' · спільний для всіх цехів',
        body: '<div class="mg-form">' + field('name', 'Назва виробу', input('name', x ? x.name : '', ' autocomplete="off" maxlength="80" placeholder="Худі базове"')) +
          locked('Тип відділу', d.name) +
          (x ? '<div class="field"><span class="label">У формі аудиту</span>' + seg('active', [[true, 'Показується'], [false, 'Приховано']], st2.active) + '</div>' : '') +
          banner('', 'Довідник виробів спільний для всіх цехів.', x ? 'Нову назву побачать усі локації — і в нових, і в старих аудитах.' : 'Новий виріб зʼявиться у формі аудиту в усіх цехах, де є такий відділ.') + '</div>',
        foot: cancelBtn() + '<button class="btn btn--primary" type="button" data-act="mg-save">' + P.ic(x ? 'save' : 'add') + (x ? 'Зберегти' : 'Додати виріб') + '</button>',
        onMount: function (el) { enterSubmits(el, 'mg-save'); },
        on: {
          'mg-seg': function (t, e, layer) { st2.active = t.getAttribute('data-v') === 'true'; qa(layer.el, '[data-k="active"]').forEach(function (b) { b.classList.toggle('seg__btn--on', b === t); }); },
          'mg-save': function (t, e, layer) {
            var p = x ? { id: x.id, name: val(layer.el, 'name'), active: st2.active } : { name: val(layer.el, 'name'), deptTypeId: d.deptTypeId };
            t.disabled = true;
            v.call('srMgProductSave', p).then(function (r) {
              t.disabled = false;
              if (!r.ok) { showErrors(layer.el, r); return; }
              layer.close(); P.toast('ok', (r.created ? 'Виріб додано · ' : 'Зміни збережено · ') + r.name, r.created ? 'Уже є у формі аудиту.' : '');
              if (v.ctx.alive()) load();
            });
          }
        } });
    }
    v.openNew = function () { if (dep()) openEdit(null); };
    v.ctx.on('mg-new', function () { openEdit(null); });
    v.ctx.on('mg-prod-edit', function (t) { openEdit(findP(t.getAttribute('data-id'))); });
    v.ctx.on('mg-dep', function (t) { st.dep = t.getAttribute('data-id'); st.sel = {}; draw(); });
    v.ctx.on('mg-sel', function (t) { var id = t.getAttribute('data-id'); st.sel[id] = !st.sel[id]; draw(); });
    v.ctx.on('mg-sel-all', function () { var list = prods(), all = list.every(function (x) { return st.sel[x.id]; }); st.sel = {}; if (!all) list.forEach(function (x) { st.sel[x.id] = true; }); draw(); });
    v.ctx.on('mg-sel-clear', function () { st.sel = {}; draw(); });
    v.ctx.on('mg-dep-on', function (t) {
      var d = data.departments.filter(function (x) { return x.id === t.getAttribute('data-id'); })[0];
      function go() {
        t.disabled = true;
        v.call('srMgDeptSave', { id: d.id, active: !d.active }).then(function (r) {
          if (!v.ctx.alive()) return;
          if (!r.ok) { t.disabled = false; failToast(r); return; }
          P.toast('ok', (r.active ? 'Відділ працює · ' : 'Відділ вимкнено · ') + r.name, r.active ? 'Знову є у формі аудиту.' : 'У формі аудиту його більше немає; історія лишилась.');
          P.emit('kd:changed'); load();
        });
      }
      if (!d.active) { go(); return; }
      P.confirm({ title: 'Вимкнути відділ «' + d.name + '»?', text: 'Його не буде у формі аудиту, тож нові аудити туди не запишуть. Старі аудити лишаться в історії й аналітиці.', okLabel: 'Вимкнути відділ', danger: true })
        .then(function (ok) { if (ok) go(); });
    });
    v.ctx.on('mg-prod-on', function (t) {
      var x = findP(t.getAttribute('data-id')); t.disabled = true;
      v.call('srMgProductSave', { id: x.id, active: !x.active }).then(function (r) {
        if (!v.ctx.alive()) return;
        if (!r.ok) { t.disabled = false; failToast(r); return; }
        P.toast('ok', (r.active ? 'Знову у формі · ' : 'Приховано з форми · ') + r.name, r.active ? '' : 'Старі аудити з цим виробом лишились в історії.');
        load();
      });
    });
    v.ctx.on('mg-merge', function () {
      openMerge(v, 'products', selIds(), dep().name, function (r) {
        st.sel = {}; P.toast('ok', 'Вироби обʼєднано · ' + r.keepName, cnt(r.moved.audits, W_AUDIT) + ' тепер з «' + r.keepName + '»; ' + gone(r.removed));
        load();
      });
    });
    load();
  });

  function openMerge(v, kind, ids, sub, onDone) {
    var st = { keep: ids[0], level: null, levelTouched: false, pv: null }, isP = kind === 'products';
    var layer = modal({ size: 'sm', title: isP ? 'Обʼєднати вироби' : 'Обʼєднати види браку', sub: esc(sub) + ' · обрано ' + ids.length,
      body: H.loading(),
      foot: cancelBtn() + '<button class="btn btn--primary" type="button" data-act="mg-go" disabled>' + P.ic('merge') + 'Обʼєднати</button>',
      on: {
        'mg-keep': function (t) { st.keep = t.getAttribute('data-id'); if (!st.levelTouched) st.level = null; preview(); },
        'mg-mlevel': function (t) { st.level = t.getAttribute('data-v'); st.levelTouched = true; draw(); },
        retry: function () { preview(); },
        'mg-go': function (t) {
          t.disabled = true;
          v.call('srMgMerge', { kind: kind, keepId: st.keep, ids: ids, level: isP ? undefined : st.level }).then(function (r) {
            if (!r.ok) { t.disabled = false; failToast(r); return; }
            layer.close(); P.emit('kd:changed');
            if (v.ctx.alive()) onDone(r);
          });
        }
      } }, true);
    function preview() {
      var go = q(layer.el, '[data-act="mg-go"]'); if (go) go.disabled = true;
      v.call('srMgMergePreview', { kind: kind, keepId: st.keep, ids: ids }).then(function (r) {
        if (layer.closed) return;
        if (!r.ok) { layer.body(r.code === 'validation' ? banner('warn', r.error, 'Закрийте вікно й змініть позначки.') : P.state.error('Не вдалося порахувати наслідки', r.error)); return; }
        st.pv = r; if (!isP && !st.level) st.level = r.keepLevel;
        draw(); if (go) go.disabled = false;
      });
    }
    function opt(x) {
      var on = x.id === st.keep;
      var meta = isP ? cnt(x.audits, W_AUDIT) + ' · ' + cnt(x.orders, W_ORDER) : H.lvl(x.level) + ' · ' + cnt(x.records, W_REC) + ' у ' + inAudits(x.audits);
      return '<button class="mg-opt' + (on ? ' mg-opt--on' : '') + '" type="button" role="radio" aria-checked="' + on + '" data-act="mg-keep"' + da('id', x.id) + '>' +
        '<span class="check mg-radio' + (on ? ' check--on' : '') + '">' + (on ? '<i></i>' : '') + '</span><span class="opt__main"><span class="opt__title">' + esc(x.name) + '</span>' +
        '<span class="opt__meta">' + meta + (x.addedAt ? ' · ' + added(x.addedAt) : '') + '</span></span>' + (on ? H.badge('лишиться', 'brand') : '') + '</button>';
    }
    function draw() {
      var r = st.pv, others = r.items.filter(function (x) { return x.id !== st.keep; }), keepName = r.keepName;
      var names = others.map(function (x) { return '«' + x.name + '»'; }).join(', ');
      var flow = '<div class="mg-flow">' + others.map(function (x) { return H.badge(x.name); }).join('') + P.ic('arrow-right', 'ui-icon--sm') + H.badge(keepName, 'brand') + '</div>';
      var facts = isP
        ? '<p style="margin:0"><b>' + cnt(r.moving.audits, W_AUDIT) + ' й ' + cnt(r.moving.orders, W_ORDER) + ' перейдуть на «' + esc(keepName) + '».</b> ' + esc(names) + ' ' + (others.length > 1 ? 'зникнуть' : 'зникне') + ' зі списків.</p>' +
          '<p class="hint">Після обʼєднання «' + esc(keepName) + '» — у ' + inAudits(r.after.audits) + ' (рахуємо по всіх цехах).</p>'
        : '<p style="margin:0"><b>' + cnt(r.after.records, W_REC) + ' браку в ' + inAudits(r.after.audits) + ' стануть «' + esc(keepName) + '»</b> з рівнем ' + H.lvl(st.level) + '; аналітика й коригуючі дії перерахуються.</p>' +
          '<p class="hint">З них ' + cnt(r.moving.records, W_REC) + ' у ' + inAudits(r.moving.audits) + ' були ' + esc(names) + '. Відділи: ' + esc(r.departments.join(', ') || '—') + '.</p>';
      layer.body('<div class="field"><span class="label">Яку назву лишити</span><div class="mg-opts" role="radiogroup">' + r.items.map(opt).join('') + '</div></div>' +
        (isP ? '' : '<div class="field"><span class="label">Який рівень</span><div class="seg seg--sm" role="radiogroup" aria-label="Рівень">' + ['fix', 'repair', 'scrap'].map(function (k) {
          return '<button class="seg__btn' + (k === st.level ? ' seg__btn--on' : '') + '" type="button" aria-pressed="' + (k === st.level) + '" data-act="mg-mlevel"' + da('v', k) + '>' + (k === st.level ? H.lvl(k) : esc(P.sr.LEVELS[k])) + '</button>'; }).join('') + '</div>' +
          '<p class="hint">' + (r.levelsDiffer ? 'У обраних видів різні рівні — оберіть, який лишити.' : 'В обраних видів рівень однаковий — ' + esc(P.sr.LEVELS[r.keepLevel]) + '.') + '</p></div>') +
        '<div class="facts"><p class="group-label" style="padding:0">Що станеться</p>' + flow + facts + '</div>' +
        banner('warn', 'Довідник спільний для всіх цехів — зміну побачать усі локації.', 'Скасувати обʼєднання в тестовій версії можна лише через «Скинути тестові дані» в меню профілю.'));
    }
    preview();
  }

  section('defects', 'Види браку', function (v) {
    var data = null, st = { q: '', type: '', sel: {} };
    function load() { v.get('srMgDefects', function (r) { data = r; draw(); }); }
    function find(id) { return data.items.filter(function (x) { return x.id === id; })[0]; }
    function selIds() { return Object.keys(st.sel).filter(function (id) { return st.sel[id] && find(id); }); }
    function shown() {
      var s = st.q.trim().toLowerCase();
      return data.items.filter(function (x) { return (!st.type || x.deptTypeId === st.type) && (!s || x.name.toLowerCase().indexOf(s) >= 0); });
    }
    function levelSeg(x) {
      if (!x.level) return H.badge('рівень не задано', 'warn');
      return '<div class="seg seg--sm" role="radiogroup" aria-label="Рівень · ' + esc(x.name) + '" style="display:inline-flex">' + ['fix', 'repair', 'scrap'].map(function (k) {
        var on = k === x.level;
        return '<button class="seg__btn' + (on ? ' seg__btn--on' : '') + '" type="button" aria-pressed="' + on + '" data-act="mg-level"' + da('id', x.id) + da('v', k) + '>' + (on ? H.lvl(k, LV_SHORT[k]) : LV_SHORT[k]) + '</button>'; }).join('') + '</div>';
    }
    function row(x) {
      var on = !!st.sel[x.id];
      return '<tr class="' + (on ? 'sel' : '') + (x.active ? '' : ' mg-off') + '"><td>' + ck(on, 'mg-sel', da('id', x.id), 'Позначити ' + x.name) + '</td>' +
        '<td><b>' + esc(x.name) + '</b>' + (!x.active ? '<span class="sub">прихований у формі</span>' : x.addedAt ? '<span class="sub">' + added(x.addedAt) + '</span>' : '') + '</td>' +
        '<td>' + esc(x.departments) + '</td><td>' + levelSeg(x) + '</td><td class="n">' + H.num(x.audits) + '</td>' +
        '<td>' + sw(x.active, 'mg-on', da('id', x.id), (x.active ? 'Показується у формі' : 'Приховано') + ' · ' + x.name) + '</td>' +
        '<td>' + pen('mg-edit', da('id', x.id), 'Редагувати ' + x.name) + '</td></tr>';
    }
    function tbody() {
      var list = shown();
      return list.length ? list.map(row).join('') : '<tr><td colspan="7">' + H.empty('Нічого не знайдено', 'Перевірте назву або оберіть «Усі відділи».') + '</td></tr>';
    }
    function mergeBar() {
      var ids = selIds();
      return ids.length >= 2 ? '<div class="mg-mergebar"><b>Обрано ' + cnt(ids.length, ['вид', 'види', 'видів']) + '</b><span style="flex:1"></span><button class="btn btn--quiet btn--sm" type="button" data-act="mg-sel-clear">Зняти позначки</button>' +
        '<button class="btn btn--primary btn--sm" type="button" data-act="mg-merge">' + P.ic('merge') + 'Обʼєднати</button></div>'
        : '<p class="hint">Позначте 2 або більше видів одного відділу — і обʼєднайте їх в один. Записи браку в аудитах перейдуть самі.</p>';
    }
    function draw() {
      v.col.innerHTML = head('Види браку', 'У кожного виду — рівень. З нього аналітика рахує, скільки браку можна виправити, скільки піде в ремонт і скільки втрачено.', btnNew('Новий вид браку')) +
        '<div class="kpis mg-kpis3">' + [['fix', 'Неправильно зроблене', 'можна виправити одразу — переробити'], ['repair', 'Пошкоджене', 'піде в ремонт'], ['scrap', 'Зламане', 'не відремонтувати — втрачено']].map(function (k) {
          return '<div class="kpi"><span class="lvl lvl--' + k[0] + '" style="font-size:16px">' + esc(k[1]) + '</span><span class="kpi__label">' + esc(k[2]) + '</span></div>'; }).join('') + '</div>' +
        '<section class="card"><div class="mg-tools"><div class="search" style="flex:1;min-width:240px">' + P.ic('search', 'icon') +
        '<input class="input" data-input="mg-q" value="' + esc(st.q) + '" placeholder="Пошук виду браку" aria-label="Пошук виду браку" style="padding-left:46px"></div>' +
        '<span class="pills mg-pills">' + [['', 'Усі відділи']].concat(data.deptTypes.map(function (t) { return [t.id, t.name]; })).map(function (o) {
          return '<button class="pill' + (st.type === o[0] ? ' pill--on' : '') + '" type="button" data-act="mg-type"' + da('id', o[0]) + '>' + esc(o[1]) + '</button>'; }).join('') + '</span></div>' +
        '<div class="tbl-box"><table class="tbl"><thead><tr><th style="width:44px"><span class="mg-vh">Позначка</span></th><th>Вид браку</th><th>Відділ</th><th>Рівень</th><th class="n">В аудитах</th><th>У формі</th><th><span class="mg-vh">Дії</span></th></tr></thead><tbody data-mg-body>' + tbody() + '</tbody></table></div>' +
        '<div data-mg-bar>' + mergeBar() + '</div>' +
        note('Види браку спільні для всіх цехів.', 'Зміну рівня побачать усі локації — і нова аналітика, і старі аудити з цим видом.') + '</section>';
    }
    function redrawRows() { q(v.col, '[data-mg-body]').innerHTML = tbody(); q(v.col, '[data-mg-bar]').innerHTML = mergeBar(); }
    function openEdit(x) {
      var st2 = { level: x ? x.level || 'fix' : null, active: x ? x.active : true }, types = data.deptTypes;
      var defType = st.type || (types[0] && types[0].id);
      modal({ size: 'sm', title: x ? 'Редагувати вид браку' : 'Новий вид браку', sub: 'Спільний для всіх цехів',
        body: '<div class="mg-form">' + field('name', 'Назва виду браку', input('name', x ? x.name : '', ' autocomplete="off" maxlength="80" placeholder="Розрив шва"')) +
          (x ? locked('Відділ', x.departments) : '<label class="field" data-f="deptTypeId"><span class="label">Відділ</span><select class="input" name="deptTypeId">' +
            types.map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === defType ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('') + '</select></label>') +
          '<div class="field"><span class="label">Рівень</span>' + seg('level', levelOpts(), st2.level) + '<span class="hint">Неправильно зроблене — переробити одразу · пошкоджене — у ремонт · зламане — втрачено.</span></div>' +
          (x ? '<div class="field"><span class="label">У формі аудиту</span>' + seg('active', [[true, 'Показується'], [false, 'Приховано']], st2.active) + '</div>' : '') +
          banner('', 'Довідник видів браку спільний для всіх цехів.', x ? 'Нову назву й рівень побачать усі локації — і нова аналітика, і старі аудити.' : 'Новий вид зʼявиться у формі аудиту в усіх цехах, де є такий відділ.') + '</div>',
        foot: cancelBtn() + '<button class="btn btn--primary" type="button" data-act="mg-save">' + P.ic(x ? 'save' : 'add') + (x ? 'Зберегти' : 'Додати вид браку') + '</button>',
        onMount: function (el) { enterSubmits(el, 'mg-save'); },
        on: {
          'mg-seg': function (t, e, layer) {
            var k = t.getAttribute('data-k'), raw = t.getAttribute('data-v');
            st2[k] = k === 'active' ? raw === 'true' : raw;
            qa(layer.el, '[data-k="' + k + '"]').forEach(function (b) { b.classList.toggle('seg__btn--on', b === t); b.setAttribute('aria-pressed', b === t); });
          },
          'mg-save': function (t, e, layer) {
            var p = x ? { id: x.id, name: val(layer.el, 'name'), level: st2.level, active: st2.active } : { name: val(layer.el, 'name'), deptTypeId: val(layer.el, 'deptTypeId'), level: st2.level };
            t.disabled = true;
            v.call('srMgDefectSave', p).then(function (r) {
              t.disabled = false;
              if (!r.ok) { showErrors(layer.el, r); return; }
              layer.close(); P.toast('ok', (r.created ? 'Вид браку додано · ' : 'Зміни збережено · ') + r.name, 'Рівень — ' + P.sr.LEVELS[r.level] + '.');
              P.emit('kd:changed'); if (v.ctx.alive()) load();
            });
          }
        } });
    }
    v.openNew = function () { openEdit(null); };
    v.ctx.on('mg-new', function () { openEdit(null); });
    v.ctx.on('mg-edit', function (t) { openEdit(find(t.getAttribute('data-id'))); });
    v.ctx.on('mg-q', function (t) { st.q = t.value; redrawRows(); });
    v.ctx.on('mg-type', function (t) { st.type = t.getAttribute('data-id'); draw(); });
    v.ctx.on('mg-sel', function (t) { var id = t.getAttribute('data-id'); st.sel[id] = !st.sel[id]; redrawRows(); });
    v.ctx.on('mg-sel-clear', function () { st.sel = {}; redrawRows(); });
    v.ctx.on('mg-level', function (t) {
      var x = find(t.getAttribute('data-id')), lv = t.getAttribute('data-v');
      if (x.level === lv) return;
      t.disabled = true;
      v.call('srMgDefectSave', { id: x.id, level: lv }).then(function (r) {
        if (!v.ctx.alive()) return;
        if (!r.ok) { t.disabled = false; failToast(r); return; }
        P.toast('ok', 'Рівень змінено · ' + r.name + ' → ' + P.sr.LEVELS[r.level], 'Аналітика й старі аудити з цим видом уже рахують по-новому.');
        P.emit('kd:changed'); load();
      });
    });
    v.ctx.on('mg-on', function (t) {
      var x = find(t.getAttribute('data-id')); t.disabled = true;
      v.call('srMgDefectSave', { id: x.id, active: !x.active }).then(function (r) {
        if (!v.ctx.alive()) return;
        if (!r.ok) { t.disabled = false; failToast(r); return; }
        P.toast('ok', (r.active ? 'Знову у формі · ' : 'Приховано з форми · ') + r.name, r.active ? '' : 'Старі записи браку з цим видом лишились в історії.');
        load();
      });
    });
    v.ctx.on('mg-merge', function () {
      var ids = selIds(), types = {};
      ids.forEach(function (id) { types[find(id).deptTypeId] = 1; });
      if (Object.keys(types).length > 1) { P.toast('warn', 'Обʼєднати можна види одного відділу', 'Залиште позначки лише в одному відділі — фільтр угорі допоможе.'); return; }
      openMerge(v, 'defects', ids, find(ids[0]).departments, function (r) {
        st.sel = {}; P.toast('ok', 'Види браку обʼєднано · ' + r.keepName, cnt(r.moved.records, W_REC) + ' браку тепер «' + r.keepName + '»; ' + gone(r.removed));
        load();
      });
    });
    load();
  });

  section('blocks', 'Блоки замовлень', function (v) {
    var data = null, st = { edit: null, name: '', orders: [], bq: '' };
    function load() { v.get('srMgBlocks', function (r) { data = r; draw(); }); }
    function find(id) { return data.items.filter(function (x) { return x.id === id; })[0]; }
    function order(no) { return data.orders.filter(function (o) { return o.no === no; })[0]; }
    function card(b) {
      return '<section class="card"><div class="card-head"><h3 class="card-title">' + esc(b.name) + '</h3>' + pen('mg-edit', da('id', b.id), 'Редагувати ' + b.name) + '</div>' +
        '<div class="chips">' + b.orders.map(function (no) { return '<span class="chip chip--plain">' + esc(no) + '</span>'; }).join('') + '</div>' +
        '<p class="hint">' + esc(b.products.join(' · ') || '—') + '</p>' +
        '<p class="hint" style="color:var(--text-2)">' + (b.audits ? 'у ' + inAudits(b.audits) + ' · останній — ' + ago(b.lastAuditAt) : 'ще не траплявся в аудитах') + '</p></section>';
    }
    function results() {
      var s = st.bq.trim().toLowerCase(), mine = st.edit === 'new' ? null : st.edit;
      var list = data.orders.filter(function (o) { return st.orders.indexOf(o.no) < 0 && (!s || o.no.toLowerCase().indexOf(s) >= 0 || o.customer.toLowerCase().indexOf(s) >= 0); }).slice(0, 6);
      if (!list.length) return '<p class="hint" style="padding:12px">Не знайдено. Спробуйте інший номер чи замовника.</p>';
      return list.map(function (o) {
        var busy = o.blockId && o.blockId !== mine;
        return '<div class="opt" style="min-height:52px;padding:6px 12px' + (busy ? ';color:var(--text-3)' : '') + '"><span class="opt__main"><span class="opt__title">' + esc(o.no) + '</span>' +
          '<span class="opt__meta">' + esc(o.customer) + ' · ' + esc(o.products.join(', ')) + (busy ? ' · уже в «' + esc(o.blockName) + '»' : '') + '</span></span>' +
          (busy ? '' : '<button class="btn btn--secondary btn--sm" type="button" data-act="mg-badd"' + da('no', o.no) + '>' + P.ic('add', 'ui-icon--sm') + 'Додати</button>') + '</div>';
      }).join('');
    }
    function editor() {
      var isNew = st.edit === 'new';
      return '<section class="card mg-editing" data-mg-editor><div class="card-head"><h3 class="card-title">' + esc(isNew ? 'Новий блок' : find(st.edit).name) + '</h3>' + H.badge(isNew ? 'новий' : 'редагується', 'brand') + '</div>' +
        '<label class="field" data-f="name"><span class="label">Назва блоку</span><input class="input" name="name" data-input="mg-bname" maxlength="40" value="' + esc(st.name) + '" placeholder="Блок ' + (data.items.length + 1) + '"></label>' +
        '<div class="field" data-f="orders"><span class="label">Замовлення</span><div class="chips">' + (st.orders.length ? st.orders.map(function (no) {
          return '<span class="chip">' + esc(no) + '<button class="chip__x" type="button" data-act="mg-bdel"' + da('no', no) + ' aria-label="Прибрати ' + esc(no) + '">' + P.ic('close', 'ui-icon--sm') + '</button></span>'; }).join('')
          : '<span class="hint">Ще жодного — додайте нижче.</span>') + '</div></div>' +
        '<div class="field mg-addbox"><span class="label">Додати замовлення</span><div class="search">' + P.ic('search', 'icon') +
        '<input class="input input--search" data-input="mg-bq" value="' + esc(st.bq) + '" placeholder="Номер або замовник" aria-label="Пошук замовлення"></div>' +
        '<div class="mg-results" data-mg-results>' + results() + '</div></div>' +
        '<div class="mg-actions"><button class="btn btn--primary btn--sm" type="button" data-act="mg-bsave">' + P.ic('save', 'ui-icon--sm') + 'Зберегти</button>' +
        '<button class="btn btn--quiet btn--sm" type="button" data-act="mg-bcancel">Скасувати</button>' +
        (isNew ? '' : '<span style="flex:1"></span><button class="btn btn--quiet btn--sm mg-danger" type="button" data-act="mg-bremove">' + P.ic('delete', 'ui-icon--sm') + 'Видалити блок</button>') + '</div></section>';
    }
    function draw() {
      var cards = data.items.map(function (b) { return b.id === st.edit ? editor() : card(b); });
      if (st.edit === 'new') cards.unshift(editor());
      v.col.innerHTML = head('Блоки замовлень', 'Блок — кілька замовлень, які йдуть разом. В аудиті його обирають одним натиском, і всі замовлення блоку підставляються самі.', btnNew('Новий блок')) +
        (cards.length ? '<div class="mg-blocks">' + cards.join('') + '</div>' : '<section class="card">' + H.empty('Блоків ще немає', 'Створіть блок — і в аудиті кілька замовлень обиратимуться одним натиском.') + '</section>') +
        note('Замовлення в блоці можна міняти будь-коли.', 'Старі аудити лишаються з тими замовленнями, які були на момент запису.');
    }
    function startEdit(id) {
      var b = id === 'new' ? null : find(id);
      st.edit = id; st.name = b ? b.name : ''; st.orders = b ? b.orders.slice() : []; st.bq = '';
      draw();
      var ed = q(v.col, '[data-mg-editor]');
      if (ed) { if (ed.scrollIntoView) ed.scrollIntoView({ block: 'nearest' }); var i = q(ed, 'input[name="name"]'); if (i) i.focus({ preventScroll: true }); }
    }
    v.openNew = function () { startEdit('new'); };
    v.ctx.on('mg-new', function () { startEdit('new'); });
    v.ctx.on('mg-edit', function (t) { startEdit(t.getAttribute('data-id')); });
    v.ctx.on('mg-bname', function (t) { st.name = t.value; });
    v.ctx.on('mg-bq', function (t) { st.bq = t.value; q(v.col, '[data-mg-results]').innerHTML = results(); });
    v.ctx.on('mg-badd', function (t) { st.orders.push(t.getAttribute('data-no')); draw(); var i = q(v.col, '[data-input="mg-bq"]'); if (i) i.focus({ preventScroll: true }); });
    v.ctx.on('mg-bdel', function (t) { var no = t.getAttribute('data-no'); st.orders = st.orders.filter(function (x) { return x !== no; }); draw(); });
    v.ctx.on('mg-bcancel', function () { st.edit = null; draw(); });
    v.ctx.on('mg-bsave', function (t) {
      t.disabled = true;
      v.call('srMgBlockSave', { id: st.edit === 'new' ? null : st.edit, name: st.name, orders: st.orders }).then(function (r) {
        if (!v.ctx.alive()) return;
        t.disabled = false;
        if (!r.ok) { showErrors(q(v.col, '[data-mg-editor]'), r); return; }
        st.edit = null;
        P.toast('ok', (r.created ? 'Блок створено · ' : 'Блок збережено · ') + r.name, cnt(r.orders.length, W_ORDER) + ' — у формі аудиту обираються одним натиском.');
        load();
      });
    });
    v.ctx.on('mg-bremove', function () {
      var b = find(st.edit);
      P.confirm({ title: 'Видалити «' + b.name + '»?', text: 'Блок зникне з форми аудиту. Старі аудити лишаться з тими замовленнями, які були на момент запису.', okLabel: 'Видалити блок', danger: true })
        .then(function (ok) {
          if (!ok) return;
          v.call('srMgBlockDelete', { id: b.id }).then(function (r) {
            if (!v.ctx.alive()) return;
            if (!r.ok) { failToast(r); return; }
            st.edit = null; P.toast('ok', 'Блок видалено · ' + r.name); load();
          });
        });
    });
    load();
  });

  section('import', 'Виробництво: план і факт', function (v) {
    var data = null;
    function load() { v.get('srMgImport', function (r) { data = r; draw(); }); }
    function when(iso) {
      var d = daysBetween(P.fmt.dayKey(iso), today());
      return (d <= 0 ? 'сьогодні' : d === 1 ? 'учора' : dateLong(iso)) + ' о ' + P.fmt.time(iso);
    }
    function colName(c) { var x = data.columns.filter(function (y) { return y.col === c; })[0]; return x ? x.col + ' · «' + x.name + '»' : '—'; }
    function row(r) {
      var dash = '<td class="n" style="color:var(--text-3)">—</td>';
      if (!r.connected) return '<tr><td><b>' + esc(r.name) + '</b></td>' + dash + dash + '<td>' + H.badge('не підключено', 'warn') + '</td><td class="n">' + (r.sampleTarget ? H.num(r.sampleTarget) + ' шт' : '—') + '</td></tr>';
      var pct = r.planKnown ? '<div class="mg-prog"><div class="hbar__track" style="flex:1;min-width:120px"><i style="width:' + Math.min(100, r.pct || 0) + '%"></i></div><b>' + (r.pct == null ? '—' : r.pct + '%') + '</b></div>' : H.badge('не вказано, скільки треба', 'warn');
      return '<tr><td><b>' + esc(r.name) + '</b></td><td class="n">' + H.num(r.doneYesterday) + '</td>' + (r.planKnown ? '<td class="n">' + H.num(r.planWeek) + '</td>' : dash) +
        '<td>' + pct + '</td>' + (r.planKnown && r.sampleTarget ? '<td class="n">' + H.num(r.sampleTarget) + ' шт</td>' : '<td class="n" style="color:var(--text-3)">невідома</td>') + '</tr>';
    }
    function draw() {
      var c = data.config, deps = byIdList(data.departments);
      var noPlan = c.depts.filter(function (x) { return !x.planCol; }).map(function (x) { return deps[x.departmentId] ? deps[x.departmentId].name : '?'; });
      v.col.innerHTML = head('Виробництво: план і факт', 'Скільки зроблено й скільки треба — з Google-таблиці цеху. Звідси рахуємо норму вибірки дня, «≈ проскочило браку» і список замовлень у формі аудиту.') +
        '<section class="card mg-status"><span class="hero__logo hero__logo--ok" style="width:48px;height:48px">' + P.ic('check') + '</span>' +
        '<div style="flex:1;min-width:240px"><b>Оновлено ' + esc(when(data.updatedAt)) + '</b><p class="hint">Наступне оновлення — завтра о ' + P.fmt.time(data.nextAt) + ' · ' + cnt(c.depts.length, ['відділ', 'відділи', 'відділів']) + ' · 1 таблиця</p></div>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-act="mg-refresh">' + P.ic('refresh', 'ui-icon--sm') + 'Оновити зараз</button></section>' +
        '<section class="card"><div><h2 class="card-title">Цей тиждень по відділах</h2><p class="hint">Тиждень з ' + (c.weekStart === 'sun' ? 'неділі' : 'понеділка') + ', ' + esc(dateLong(data.week.from)) + ' · «зроблено» — до вчора включно</p></div>' +
        (data.week.rows.length ? '<div class="tbl-box"><table class="tbl"><thead><tr><th>Відділ</th><th class="n">Зроблено вчора, шт</th><th class="n">Треба за тиждень, шт</th><th>Виконано тижня</th><th class="n">Норма вибірки сьогодні</th></tr></thead><tbody>' +
          data.week.rows.map(row).join('') + '</tbody></table></div>' : H.empty('Немає відділів, що працюють', 'Увімкніть відділ у розділі «Відділи й вироби».')) + '</section>' +
        '<section class="card"><div class="card-head"><h2 class="card-title">Як підключено</h2></div>' +
        '<div class="entry" style="background:var(--surface-2)"><div class="entry__head"><h3 class="entry__title">Таблиця «' + esc(c.title) + '»</h3>' + pen('mg-wizard', '', 'Змінити підключення таблиці') + '</div>' +
        '<div class="mg-3">' +
        '<div class="facts" style="background:var(--surface)"><span class="num-badge num-badge--done">1</span><b>Таблиця</b><span class="hint">Аркуш «' + esc(c.sheet) + '» · назви колонок у рядку ' + c.headerRow + ' · дані з рядка ' + c.dataRow + '</span></div>' +
        '<div class="facts" style="background:var(--surface)"><span class="num-badge num-badge--done">2</span><b>Спільне для відділів</b><span class="hint">Дата — колонка ' + esc(c.dateCol) + ' · замовлення — колонка ' + esc(c.orderCol) + ' · тиждень з ' + (c.weekStart === 'sun' ? 'неділі' : 'понеділка') + '</span></div>' +
        '<div class="facts" style="background:var(--surface)"><span class="num-badge num-badge--done">3</span><b>Відділи</b><span class="hint">' + esc(c.depts.map(function (x) { return deps[x.departmentId] ? deps[x.departmentId].name : '?'; }).join(', ') || 'жодного') + ' — «зроблено» і «треба»' +
          (noPlan.length ? '; без «треба»: ' + esc(noPlan.join(', ')) : '') + '</span></div></div></div>' +
        '<p class="hint">Таблицю читає сам додаток раз на добу — доступу «Перегляд» досить. Нічого в ній не змінює. У тестовій версії справжню таблицю не відкриваємо.</p></section>';
    }
    function byIdList(list) { var o = {}; list.forEach(function (x) { o[x.id] = x; }); return o; }

    function openWizard() {
      var cfg = JSON.parse(JSON.stringify(data.config)), step = 1, matched = null, deps = byIdList(data.departments);
      var STEP_OF = { url: 1, sheet: 1, headerRow: 1, dataRow: 1, dateCol: 2, orderCol: 2, weekStart: 2 };
      function colOptions(cur, emptyLabel) {
        return (emptyLabel ? '<option value=""' + (!cur ? ' selected' : '') + '>' + esc(emptyLabel) + '</option>' : '') + data.columns.map(function (x) {
          return '<option value="' + x.col + '"' + (x.col === cur ? ' selected' : '') + '>' + x.col + ' · ' + esc(x.name) + '</option>'; }).join('');
      }
      function steps() {
        var names = ['Таблиця', 'Спільне для відділів', 'Відділи'];
        return '<div class="mg-stepsbar"><div class="steps" style="font-size:16px;gap:10px">' + names.map(function (n, i) {
          var k = i + 1, cls = k < step ? 'dotd--done' : k === step ? 'dotd--now' : '';
          return (i ? '<span class="ln" style="width:40px"></span>' : '') + '<span' + (k === step ? ' style="color:var(--text);font-weight:700"' : '') + '><span class="dotd ' + cls + '"></span>' + k + ' · ' + n + '</span>'; }).join('') +
          '</div><span class="hint" style="margin-left:auto">Крок ' + step + ' з 3</span></div>';
      }
      function summary() {
        return '<div class="col" style="flex:1 1 300px">' +
          '<div class="facts"><div class="card-head"><span class="num-badge num-badge--done">1</span><h3 class="card-title" style="font-size:18px">Таблиця</h3><button class="icon-btn" type="button" data-act="mg-wz-go" data-step="1" aria-label="Змінити крок 1">' + P.ic('edit') + '</button></div>' +
          '<dl class="kv"><dt>Посилання</dt><dd style="overflow-wrap:anywhere">' + esc(cfg.url) + '</dd><dt>Аркуш</dt><dd>' + esc(cfg.sheet) + '</dd><dt>Назви колонок</dt><dd>рядок ' + esc(cfg.headerRow) + '</dd><dt>Дані</dt><dd>з рядка ' + esc(cfg.dataRow) + '</dd></dl></div>' +
          '<div class="facts"><div class="card-head"><span class="num-badge num-badge--done">2</span><h3 class="card-title" style="font-size:18px">Спільне для відділів</h3><button class="icon-btn" type="button" data-act="mg-wz-go" data-step="2" aria-label="Змінити крок 2">' + P.ic('edit') + '</button></div>' +
          '<dl class="kv"><dt>Дата</dt><dd>' + esc(colName(cfg.dateCol)) + '</dd><dt>Замовлення</dt><dd>' + esc(colName(cfg.orderCol)) + '</dd><dt>Тиждень</dt><dd>з ' + (cfg.weekStart === 'sun' ? 'неділі' : 'понеділка') + '</dd></dl></div></div>';
      }
      function body() {
        if (step === 1) {
          return steps() + '<div class="mg-form">' + field('url', 'Посилання на таблицю', input('url', cfg.url, ' data-k="url" autocomplete="off" placeholder="https://…"'), 'Скопіюйте з адресного рядка, коли таблиця відкрита.') +
            field('sheet', 'Аркуш', input('sheet', cfg.sheet, ' data-k="sheet" autocomplete="off" placeholder="Тиждень"')) +
            '<div class="pair">' + field('headerRow', 'Назви колонок — у рядку', input('headerRow', cfg.headerRow, ' data-k="headerRow" type="number" min="1" max="50" inputmode="numeric"')) +
            field('dataRow', 'Дані — з рядка', input('dataRow', cfg.dataRow, ' data-k="dataRow" type="number" min="2" max="60" inputmode="numeric"')) + '</div>' +
            banner('', 'У тестовій версії таблицю не відкриваємо.', 'Колонки на наступних кроках вигадані за назвами відділів цеху — щоб можна було пройти всі кроки.') + '</div>';
        }
        if (step === 2) {
          return steps() + '<div class="mg-form">' +
            '<label class="field" data-f="dateCol"><span class="label">Дата — колонка</span><select class="input" data-k="dateCol">' + colOptions(cfg.dateCol, '— оберіть —') + '</select></label>' +
            '<label class="field" data-f="orderCol"><span class="label">Номер замовлення — колонка</span><select class="input" data-k="orderCol">' + colOptions(cfg.orderCol, '— оберіть —') + '</select></label>' +
            '<div class="field"><span class="label">Тиждень починається</span>' + seg('weekStart', [['mon', 'з понеділка'], ['sun', 'з неділі']], cfg.weekStart, 'mg-wz-week') + '</div></div>';
        }
        var used = {}; cfg.depts.forEach(function (x) { used[x.departmentId] = 1; });
        var free = data.departments.filter(function (d) { return !used[d.id]; });
        var noPlan = cfg.depts.filter(function (x) { return x.departmentId && !x.planCol; }).map(function (x) { return deps[x.departmentId] ? deps[x.departmentId].name : '?'; });
        return steps() + '<div class="modal__body mg-flat">' + summary() +
          '<div class="col" style="flex:2 1 520px"><div class="card-head" style="flex-wrap:wrap"><span class="num-badge">3</span><div style="flex:1;min-width:200px"><h3 class="card-title">Відділи</h3><p class="hint">Для кожного відділу оберіть дві колонки з таблиці</p></div>' +
          '<button class="btn btn--secondary btn--sm" type="button" data-act="mg-wz-match">' + P.ic('search', 'ui-icon--sm') + 'Підібрати за назвами</button></div>' +
          (matched ? '<p class="hint" style="color:var(--text-2)"><b>' + esc(matched) + '</b></p>' : '') +
          '<div class="tbl-box" data-f="depts"><table class="tbl"><thead><tr><th>Відділ</th><th>Скільки зроблено</th><th>Скільки треба</th><th><span class="mg-vh">Прибрати</span></th></tr></thead><tbody>' +
          (cfg.depts.length ? cfg.depts.map(function (x, i) {
            var f = 'depts[' + i + ']';
            return '<tr><td data-f="' + f + '.departmentId"><select class="input" data-row="' + i + '" data-k="departmentId" aria-label="Відділ" style="min-width:140px;height:44px">' +
              data.departments.map(function (d) { return (used[d.id] && d.id !== x.departmentId) ? '' : '<option value="' + esc(d.id) + '"' + (d.id === x.departmentId ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('') + '</select></td>' +
              '<td data-f="' + f + '.doneCol"><select class="input" data-row="' + i + '" data-k="doneCol" aria-label="Скільки зроблено" style="min-width:160px;height:44px">' + colOptions(x.doneCol, '— оберіть —') + '</select></td>' +
              '<td data-f="' + f + '.planCol"><select class="input' + (x.planCol ? '' : ' select--empty') + '" data-row="' + i + '" data-k="planCol" aria-label="Скільки треба" style="min-width:160px;height:44px">' + colOptions(x.planCol, 'немає такої колонки') + '</select></td>' +
              '<td style="width:44px"><button class="icon-btn" type="button" data-act="mg-wz-del" data-row="' + i + '" aria-label="Прибрати ' + esc(deps[x.departmentId] ? deps[x.departmentId].name : '') + '">' + P.ic('delete') + '</button></td></tr>';
          }).join('') : '<tr><td colspan="4"><span class="hint">Жодного відділу — додайте кнопкою нижче.</span></td></tr>') + '</tbody></table></div>' +
          (free.length ? '<button class="btn btn--secondary btn--add" type="button" data-act="mg-wz-add">' + P.ic('add', 'ui-icon--sm') + 'Ще відділ</button>' : '') +
          (noPlan.length ? banner('', 'Без «скільки треба» норму вибірки ' + noPlan.join(', ') + ' не порахуємо.', 'Можна зберегти й так — «зроблено» додаток однаково візьме. Колонку можна додати пізніше.') : '') + '</div></div>';
      }
      function foot() {
        return '<p class="action-bar__sum" style="font-size:14px">Доступу «Перегляд» досить — додаток нічого в таблиці не змінює.</p>' +
          (step > 1 ? '<button class="btn btn--secondary" type="button" data-act="mg-wz-back">' + P.ic('arrow-left', 'ui-icon--sm') + 'Назад</button>' : '<button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button>') +
          (step < 3 ? '<button class="btn btn--primary" type="button" data-act="mg-wz-next">Далі' + P.ic('arrow-right', 'ui-icon--sm') + '</button>'
            : '<button class="btn btn--primary" type="button" data-act="mg-wz-save">' + P.ic('save', 'ui-icon--sm') + 'Зберегти й оновити</button>');
      }
      function redraw() { layer.body(body()); layer.foot(foot()); }
      function localCheck() {
        var errs = [];
        if (step === 1) {
          if (!/^https:\/\/\S+$/.test(String(cfg.url).trim())) errs.push({ field: 'url', message: 'Вставте посилання на таблицю — скопіюйте його з адресного рядка, воно починається з https://' });
          if (!String(cfg.sheet).trim()) errs.push({ field: 'sheet', message: 'Впишіть назву аркуша — наприклад, «Тиждень».' });
          if (!(+cfg.headerRow >= 1 && +cfg.headerRow <= 50)) errs.push({ field: 'headerRow', message: 'Рядок з назвами колонок — число від 1 до 50.' });
          else if (!(+cfg.dataRow > +cfg.headerRow)) errs.push({ field: 'dataRow', message: 'Дані починаються нижче рядка з назвами — наприклад, з рядка ' + (+cfg.headerRow + 1) + '.' });
        }
        if (step === 2) {
          if (!cfg.dateCol) errs.push({ field: 'dateCol', message: 'Оберіть колонку з датою.' });
          if (!cfg.orderCol) errs.push({ field: 'orderCol', message: 'Оберіть колонку з номером замовлення.' });
          else if (cfg.orderCol === cfg.dateCol) errs.push({ field: 'orderCol', message: 'Дата й замовлення — у різних колонках.' });
        }
        return errs.length ? { ok: false, code: 'validation', error: errs[0].message, errors: errs } : null;
      }
      var layer = modal({ title: 'Підключити таблицю виробітку', sub: 'Звідси додаток бере, скільки зроблено й скільки треба по відділах', body: body(), foot: foot(),
        onMount: function (el) {
          function bind(e) {
            var t = e.target, k = t.getAttribute && t.getAttribute('data-k'); if (!k) return;
            var row = t.getAttribute('data-row'), value = t.type === 'number' ? (t.value === '' ? '' : +t.value) : t.value;
            if (row != null) { cfg.depts[+row][k] = value || (k === 'planCol' ? null : ''); if (e.type === 'change') redraw(); }
            else cfg[k] = value;
          }
          el.addEventListener('input', bind); el.addEventListener('change', bind);
        },
        on: {
          'mg-wz-next': function () { var e = localCheck(); if (e) { showErrors(layer.el, e); return; } step++; redraw(); },
          'mg-wz-back': function () { step--; redraw(); },
          'mg-wz-go': function (t) { step = +t.getAttribute('data-step'); redraw(); },
          'mg-wz-week': function (t) { cfg.weekStart = t.getAttribute('data-v'); redraw(); },
          'mg-wz-add': function () {
            var used = {}; cfg.depts.forEach(function (x) { used[x.departmentId] = 1; });
            var d = data.departments.filter(function (x) { return !used[x.id]; })[0]; if (!d) return;
            cfg.depts.push({ departmentId: d.id, doneCol: '', planCol: null }); redraw();
          },
          'mg-wz-del': function (t) { cfg.depts.splice(+t.getAttribute('data-row'), 1); redraw(); },
          'mg-wz-match': function () {
            var found = 0, total = cfg.depts.length * 2, miss = [];
            cfg.depts.forEach(function (x) {
              var d = deps[x.departmentId]; if (!d) return;
              ['шт', 'план'].forEach(function (w) {
                var c = data.columns.filter(function (y) { return y.name.toLowerCase() === (d.name + ', ' + w).toLowerCase(); })[0];
                if (c) { x[w === 'шт' ? 'doneCol' : 'planCol'] = c.col; found++; } else miss.push(d.name + ' — ' + (w === 'шт' ? 'скільки зроблено' : 'скільки треба'));
              });
            });
            matched = 'Підібрано за назвами ' + found + ' ' + plural(found, ['колонку', 'колонки', 'колонок']) + ' з ' + total + '.' + (miss.length ? ' Не знайшлося: ' + miss.join(', ') + '.' : '');
            redraw();
          },
          'mg-wz-save': function (t) {
            t.disabled = true;
            v.call('srMgImportSave', { config: cfg }).then(function (r) {
              t.disabled = false;
              if (!r.ok) {
                if (r.code === 'validation' && r.errors) { var s = STEP_OF[r.errors[0].field]; if (s && s !== step) { step = s; redraw(); } }
                showErrors(layer.el, r); return;
              }
              layer.close(); P.toast('ok', 'Налаштування збережено · оновлено о ' + P.fmt.time(r.updatedAt), 'Підключено ' + cnt(r.departments, ['відділ', 'відділи', 'відділів']) + '. У тестовій версії цифри — вигадані.');
              if (v.ctx.alive()) load();
            });
          }
        } });
    }
    v.ctx.on('mg-wizard', openWizard);
    v.ctx.on('mg-refresh', function (t) {
      t.disabled = true;
      v.call('srMgImportRefresh').then(function (r) {
        if (!v.ctx.alive()) return;
        t.disabled = false;
        if (!r.ok) { failToast(r); return; }
        P.toast('ok', 'Дані виробництва оновлено о ' + P.fmt.time(r.updatedAt), 'У тестовій версії цифри ті самі — справжню таблицю не читаємо.');
        load();
      });
    });
    load();
  });

  var INCLUDE_LABELS = { checked: 'Перевірено й брак', levels: 'Рівні браку', norms: 'Норма вибірки по відділах', noAudits: 'Відділи без аудитів',
    worst: 'Найгірший відділ дня', topDefects: 'Топ видів браку', kd: 'Коригуючі дії розбору', auditors: 'Аудитори дня', orders: 'Замовлення дня',
    compare: 'Порівняння з учора', link: 'Посилання на кабінет' };
  var MAIL_LEVELS = [['all', 'Усе'], ['defects', 'Тільки з браком'], ['over5', 'Тільки понад 5%']];
  var DAYS = [[1, 'пн'], [2, 'вт'], [3, 'ср'], [4, 'чт'], [5, 'пт'], [6, 'сб'], [0, 'нд']];

  section('mailing', 'Розсилки', function (v) {
    var data = null;
    function load() { v.get('srMgMailing', function (r) { data = r; draw(); }); }
    function find(id) { return data.items.filter(function (x) { return x.id === id; })[0]; }
    function entry(m) {
      var off = !m.on;
      return '<div class="entry mg-entry"><div class="entry__head"><h3 class="entry__title" style="font-size:18px' + (off ? ';color:var(--text-3)' : '') + '">' + esc(m.title) + '</h3>' +
        sw(m.on, 'mg-mail-on', da('id', m.id), (m.on ? 'Увімкнено' : 'Вимкнено') + ' · ' + m.title) +
        (m.id === 'daily' ? pen('mg-mail-edit', da('id', m.id), 'Редагувати денний звіт') : '') + '</div>' +
        '<dl class="kv"><dt>Кому</dt><dd>' + esc(m.to) + '</dd><dt>Коли</dt><dd>' + esc(m.when) + (off ? ' · вимкнено' : '') + '</dd>' +
        (m.hasLevel ? '<dt>Що</dt><dd><span class="pills mg-pills">' + MAIL_LEVELS.map(function (l) {
          return '<button class="pill' + (m.level === l[0] ? ' pill--on' : '') + '" type="button" aria-pressed="' + (m.level === l[0]) + '" data-act="mg-mail-lvl"' + da('id', m.id) + da('v', l[0]) + '>' + esc(l[1]) + '</button>'; }).join('') + '</span></dd>' : '') +
        (m.id === 'daily' ? '<dt>Що</dt><dd>' + esc(m.what) + '</dd>' : '') + '</dl>' +
        (m.id === 'daily' ? '<div class="mg-actions"><button class="btn btn--secondary btn--sm" type="button" data-act="mg-mail-send">' + P.ic('notification', 'ui-icon--sm') + 'Надіслати зараз</button>' +
          '<span class="hint">Востаннє — ' + esc(ago(data.lastSent)) + ' · у тестовій версії — нікуди</span></div>' : '') + '</div>';
    }
    function draw() {
      v.col.innerHTML = head('Розсилки', 'Повідомлення в Slack надсилає сам додаток — ноутбук із ботом більше не потрібен.') +
        '<section class="card">' + data.items.map(entry).join('') +
        '<p class="hint">Не дійшло повідомлення? Додаток спробує ще раз сам, а збій видно тут, біля розсилки. У тестовій версії повідомлення нікуди не йдуть.</p></section>';
    }
    function previewHtml(d) {
      var p = data.preview, inc = d.include, lines = [];
      function li(html) { lines.push('<p style="margin:0">' + html + '</p>'); }
      if (inc.checked) li(p.audits ? '<b>Перевірено ' + H.num(p.checked) + ' шт · брак ' + H.num(p.rejected) + ' шт (' + H.pct(p.pct) + ')</b>' : '<b>Сьогодні ще жодного аудиту</b>');
      if (inc.levels) li('Рівні: неправильно зроблене ' + H.num(p.byLevel.fix) + ' · пошкоджене ' + H.num(p.byLevel.repair) + ' · зламане ' + H.num(p.byLevel.scrap));
      if (inc.norms) li('Норма вибірки: виконана в ' + p.normsOk + ' ' + plural(p.normsOk, ['відділі', 'відділах', 'відділах']) + ' з ' + p.depts);
      if (inc.noAudits) li('Без аудитів сьогодні: ' + esc(p.noAudits.join(', ') || 'таких немає'));
      if (inc.worst) li(p.worst ? 'Найгірший відділ: ' + esc(p.worst.name) + ' — ' + H.pct(p.worst.pct) : 'Найгірший відділ: ще немає даних');
      if (inc.topDefects) li('Топ браку: ' + (p.topDefects.length ? p.topDefects.map(function (x) { return esc(x.name) + ' ' + H.num(x.qty); }).join(' · ') : 'браку не знайдено'));
      if (inc.kd) li(p.kd ? 'Коригуючі дії: ' + p.kd.new + ' ' + plural(p.kd.new, ['нова', 'нові', 'нових']) + ' з розбору, ' + p.kd.review + ' на перевірці' : 'Коригуючі дії: зведення з вкладки «Коригуючі дії»');
      if (inc.auditors) li('Аудитори: ' + (p.auditors.length ? p.auditors.map(function (x) { return esc(x.name) + ' ' + x.n; }).join(' · ') : 'ще нікого'));
      if (inc.orders) li('Замовлення: ' + esc(p.orders.join(', ') || '—'));
      if (inc.compare) li('Порівняно з учора: брак ' + H.pct(p.pct) + ' (учора ' + H.pct(p.yesterdayPct) + ')');
      if (inc.link) li('<span style="color:var(--info);text-decoration:underline">Відкрити кабінет цеху</span>');
      return '<div class="mg-slack"><span class="avatar" style="border-radius:10px;width:40px;height:40px">А</span><div class="mg-slack__msg">' +
        '<p style="margin:0"><b>Аудит</b> <span class="hint" style="display:inline">додаток · ' + esc(d.time) + '</span></p>' +
        '<p style="margin:0 0 4px;font-weight:700">Денний звіт · ' + esc(data.location.name) + ' · ' + esc(H.dayLong(p.day)) + '</p>' +
        (lines.length ? lines.join('') : '<p class="hint" style="margin:0">Жодного показника не обрано — звіт буде порожній.</p>') + '</div></div>' +
        '<p class="hint">Цифри в прикладі — за сьогодні, станом на ' + P.fmt.time(new Date().toISOString()) + '.</p>';
    }
    function openDaily() {
      var m = find('daily'), d = JSON.parse(JSON.stringify(data.daily)), on = m.on, newTo = '';
      function left() {
        var n = data.includeKeys.filter(function (k) { return d.include[k]; }).length;
        return '<div class="col" style="flex:1 1 440px">' +
          '<div class="field" data-f="to"><span class="label">Кому</span><div class="chips">' + d.to.map(function (x, i) {
            return '<span class="chip">' + P.ic('slack', 'ui-icon--sm') + esc(x) + '<button class="chip__x" type="button" data-act="mg-d-rm" data-i="' + i + '" aria-label="Прибрати ' + esc(x) + '">' + P.ic('close', 'ui-icon--sm') + '</button></span>'; }).join('') + '</div>' +
            '<div class="mg-addrow"><input class="input" data-d-new data-noenter value="' + esc(newTo) + '" placeholder="#канал або імʼя людини" aria-label="Додати людину чи канал" maxlength="60">' +
            '<button class="btn btn--secondary btn--add" type="button" data-act="mg-d-add">' + P.ic('add', 'ui-icon--sm') + 'Додати</button></div></div>' +
          '<div class="field"><span class="label">Коли</span><div class="mg-actions" data-f="time"><span style="font-size:16px">о</span>' +
            '<input class="input" type="time" data-d-time value="' + esc(d.time) + '" aria-label="Час" style="width:140px;height:44px"></div>' +
            '<div class="chips" data-f="days">' + DAYS.map(function (x) { var o = d.days.indexOf(x[0]) >= 0;
              return '<button class="chip-pick mg-day' + (o ? ' chip-pick--on' : '') + '" type="button" aria-pressed="' + o + '" data-act="mg-d-day" data-d="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
          '<div class="field" data-f="include"><div class="card-head"><span class="label" style="flex:1">Що включити</span><span class="hint">обрано ' + n + ' з ' + data.includeKeys.length + '</span></div>' +
            '<div class="mg-checks">' + data.includeKeys.map(function (k) { var o = !!d.include[k];
              return '<button class="mg-checkrow" type="button" role="checkbox" aria-checked="' + o + '" data-act="mg-d-inc"' + da('k', k) + '><span class="check' + (o ? ' check--on' : '') + '">' + (o ? P.ic('check', 'ui-icon--sm') : '') + '</span>' + esc(INCLUDE_LABELS[k] || k) + '</button>'; }).join('') + '</div></div></div>';
      }
      function right() { return '<div class="col" style="flex:1 1 380px"><span class="label">Як виглядатиме в Slack</span><div data-d-preview>' + previewHtml(d) + '</div></div>'; }
      function redraw() { layer.body('<div class="modal__body mg-flat">' + left() + right() + '</div>'); }
      function headHtml() { return '<span class="hint" data-d-onlabel>' + (on ? 'увімкнено' : 'вимкнено') + '</span>' + sw(on, 'mg-d-on', '', on ? 'Розсилку увімкнено' : 'Розсилку вимкнено'); }
      function addTo() {
        var x = String(newTo).trim(); if (!x) return;
        if (d.to.indexOf(x) < 0) d.to.push(x);
        newTo = ''; redraw(); var i = q(layer.el, '[data-d-new]'); if (i) i.focus();
      }
      var layer = modal({ title: 'Денний звіт цеху', sub: 'Розсилка в Slack · ' + esc(data.location.name), head: headHtml(),
        body: '', foot: '<p class="action-bar__sum" style="font-size:14px">Надсилає сам додаток — бот на ноутбуці не потрібен.</p>' +
          '<button class="btn btn--secondary" type="button" data-act="mg-d-test">' + P.ic('notification', 'ui-icon--sm') + 'Надіслати пробне мені</button>' +
          '<button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button><button class="btn btn--primary" type="button" data-act="mg-d-save">' + P.ic('save', 'ui-icon--sm') + 'Зберегти</button>',
        onMount: function (el) {
          el.addEventListener('input', function (e) {
            if (e.target.hasAttribute('data-d-new')) newTo = e.target.value;
            if (e.target.hasAttribute('data-d-time')) { d.time = e.target.value; var pv = q(el, '[data-d-preview]'); if (pv) pv.innerHTML = previewHtml(d); }
          });
          el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.hasAttribute('data-d-new')) { e.preventDefault(); addTo(); } });
        },
        on: {
          'mg-d-on': function (t, e, ly) { on = !on; t.classList.toggle('toggle--on', on); t.setAttribute('aria-checked', on); q(ly.el, '[data-d-onlabel]').textContent = on ? 'увімкнено' : 'вимкнено'; },
          'mg-d-add': addTo,
          'mg-d-rm': function (t) { d.to.splice(+t.getAttribute('data-i'), 1); redraw(); },
          'mg-d-day': function (t) { var x = +t.getAttribute('data-d'), i = d.days.indexOf(x); if (i >= 0) d.days.splice(i, 1); else d.days.push(x); redraw(); },
          'mg-d-inc': function (t) { var k = t.getAttribute('data-k'); d.include[k] = !d.include[k]; redraw(); },
          'mg-d-test': function (t) {
            t.disabled = true;
            v.call('srMgMailingSend', { id: 'daily', test: true }).then(function (r) {
              t.disabled = false;
              if (!r.ok) { failToast(r); return; }
              P.toast('ok', 'Пробне повідомлення відправлено (у тестовій версії — нікуди)');
            });
          },
          'mg-d-save': function (t) {
            if (String(newTo).trim()) addTo();
            t.disabled = true;
            v.call('srMgMailingSave', { id: 'daily', on: on, daily: d }).then(function (r) {
              t.disabled = false;
              if (!r.ok) { showErrors(layer.el, r); return; }
              layer.close(); P.toast('ok', 'Денний звіт збережено', (on ? 'Увімкнено' : 'Вимкнено') + ' · о ' + d.time + ' · ' + d.to.join(', '));
              if (v.ctx.alive()) load();
            });
          }
        } });
      redraw();
    }
    v.ctx.on('mg-mail-edit', openDaily);
    v.ctx.on('mg-mail-on', function (t) {
      var m = find(t.getAttribute('data-id')); t.disabled = true;
      v.call('srMgMailingSave', { id: m.id, on: !m.on }).then(function (r) {
        if (!v.ctx.alive()) return;
        if (!r.ok) { t.disabled = false; failToast(r); return; }
        P.toast('ok', (r.on ? 'Розсилку увімкнено · ' : 'Розсилку вимкнено · ') + r.title); load();
      });
    });
    v.ctx.on('mg-mail-lvl', function (t) {
      var m = find(t.getAttribute('data-id')), lv = t.getAttribute('data-v');
      if (m.level === lv) return;
      v.call('srMgMailingSave', { id: m.id, level: lv }).then(function (r) {
        if (!v.ctx.alive()) return;
        if (!r.ok) { failToast(r); return; }
        P.toast('ok', 'Збережено · ' + r.title, 'Тепер: ' + MAIL_LEVELS.filter(function (l) { return l[0] === r.level; })[0][1].toLowerCase() + '.'); load();
      });
    });
    v.ctx.on('mg-mail-send', function (t) {
      t.disabled = true;
      v.call('srMgMailingSend', { id: 'daily' }).then(function (r) {
        if (!v.ctx.alive()) return;
        t.disabled = false;
        if (!r.ok) { failToast(r); return; }
        P.toast('ok', 'Денний звіт відправлено о ' + P.fmt.time(r.sentAt), 'У тестовій версії — нікуди.'); load();
      });
    });
    load();
  });
})(window);
