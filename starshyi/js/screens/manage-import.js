(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, M = P.srMg;
  var q = M.q, qa = M.qa, da = M.da, W = M.W;

  function tag(mark, label, cls) { return '<span class="mg-tag mg-t' + mark + (cls ? ' ' + cls : '') + '" title="Таблиця ' + esc(label) + '">' + esc(label) + '</span>'; }
  function byId(list) { var o = {}; list.forEach(function (x) { o[x.id] = x; }); return o; }

  M.section('import', 'Виробництво: план і факт', function (v) {
    var data = null, deps = {};
    function load() { v.get('srMgImport', function (r) { data = r; deps = byId(r.departments); draw(); }); }
    function depName(id) { return deps[id] ? deps[id].name : '?'; }
    function when(iso) {
      var d = M.daysBetween(P.fmt.dayKey(iso), M.today());
      return (d <= 0 ? 'сьогодні' : d === 1 ? 'учора' : M.dateLong(iso)) + ' о ' + P.fmt.time(iso);
    }
    function colName(cols, c) { var x = cols.filter(function (y) { return y.col === c; })[0]; return x ? x.col + ' · «' + x.name + '»' : '—'; }
    function weekName(ws) { return ws === 'sun' ? 'неділі' : 'понеділка'; }
    function overlapText(list) { return list.map(function (w) { return w.name + ' (' + w.labels.join(', ') + ')'; }).join(' · '); }

    function weekRow(r) {
      var dash = '<td class="n mg-dim">—</td>', norm = '<td class="n">' + (r.sampleTarget ? H.num(r.sampleTarget) + ' шт' : '<span class="mg-dim">не задано</span>') + '</td>';
      if (!r.connected) return '<tr><td><b>' + esc(r.name) + '</b></td><td>' + H.badge('не підключено', 'warn') + '</td>' + dash + dash + '<td class="mg-dim">—</td>' + norm + '</tr>';
      var src = '<span class="mg-tags">' + r.sources.map(function (s) { return tag(s.mark, s.label); }).join('') + '</span>' + (r.sources.length > 1 ? '<span class="sub">складено з ' + r.sources.length + ' таблиць</span>' : '');
      var pct = r.planKnown ? '<div class="mg-prog"><div class="hbar__track" style="flex:1;min-width:120px"><i style="width:' + Math.min(100, r.pct || 0) + '%"></i></div><b>' + (r.pct == null ? '—' : r.pct + '%') + '</b></div>' : H.badge('немає колонки «треба»', 'warn');
      return '<tr><td><b>' + esc(r.name) + '</b></td><td>' + src + '</td><td class="n">' + H.num(r.doneYesterday) + '</td>' + (r.planKnown ? '<td class="n">' + H.num(r.planWeek) + '</td>' : dash) + '<td>' + pct + '</td>' + norm + '</tr>';
    }
    function card(t) {
      var free = data.departments.filter(function (d) { return !t.depts.some(function (x) { return x.departmentId === d.id; }); }).length;
      return '<section class="card mg-tcard mg-t' + t.mark + '"><div class="mg-tcard__head">' + tag(t.mark, t.label, 'mg-tag--lg') +
        '<div class="mg-tcard__title"><h3 class="card-title">' + esc(t.title) + '</h3><p class="hint mg-ellipsis">' + esc(t.url) + '</p></div>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-act="mg-t-edit"' + da('id', t.id) + ' aria-label="Змінити таблицю ' + esc(t.label) + '">' + P.ic('edit', 'ui-icon--sm') + 'Змінити</button></div>' +
        '<dl class="kv mg-tcard__kv"><dt>Аркуш</dt><dd>«' + esc(t.sheet) + '» · шапка — рядок ' + esc(t.headerRow) + ' · дані з рядка ' + esc(t.dataRow) + '</dd>' +
        '<dt>Спільне для відділів</dt><dd>дата — ' + esc(colName(t.columns, t.dateCol)) + ' · замовлення — ' + esc(colName(t.columns, t.orderCol)) + '</dd></dl>' +
        '<div class="tbl-box"><table class="tbl mg-tcard__tbl"><thead><tr><th>Відділ · ' + t.depts.length + '</th><th>Скільки зроблено</th><th>Скільки треба</th></tr></thead><tbody>' +
        (t.depts.length ? t.depts.map(function (x) {
          return '<tr><td><b>' + esc(depName(x.departmentId)) + '</b></td><td>' + esc(colName(t.columns, x.doneCol)) + '</td><td>' + (x.planCol ? esc(colName(t.columns, x.planCol)) : '<span class="mg-dim">немає колонки</span>') + '</td></tr>';
        }).join('') : '<tr><td colspan="3" class="mg-dim">жодного відділу</td></tr>') + '</tbody></table></div>' +
        '<div class="mg-actions">' + (free ? '<button class="btn btn--secondary btn--sm" type="button" data-act="mg-t-dept"' + da('id', t.id) + '>' + P.ic('add', 'ui-icon--sm') + 'Відділ</button>' : '') +
        '<span style="flex:1"></span><button class="btn btn--quiet btn--sm mg-danger" type="button" data-act="mg-t-del"' + da('id', t.id) + '>' + P.ic('delete', 'ui-icon--sm') + 'Прибрати таблицю</button></div></section>';
    }
    function draw() {
      var n = data.tables.length, on = data.week.rows.filter(function (r) { return r.connected; }).length, canAdd = n < data.maxTables;
      v.col.innerHTML = M.head('Виробництво: план і факт', 'Скільки зроблено й скільки треба по відділах — з таблиць цеху',
        canAdd ? '<button class="btn btn--primary" type="button" data-act="mg-t-new">' + P.ic('add') + 'Додати таблицю</button>' : '', 'sr.mg.import') +
        '<section class="card mg-status"><span class="hero__logo hero__logo--ok" style="width:48px;height:48px">' + P.ic('check') + '</span>' +
        '<div style="flex:1;min-width:240px"><b>Оновлено ' + esc(when(data.updatedAt)) + '</b><p class="hint">Наступне оновлення — завтра о ' + P.fmt.time(data.nextAt) + ' · ' + M.cnt(n, W.table) + ' · підключено ' + on + ' з ' + data.week.rows.length + ' відділів</p></div>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-act="mg-refresh">' + P.ic('refresh', 'ui-icon--sm') + 'Оновити зараз</button></section>' +
        '<section class="card"><div class="card-head" style="flex-wrap:wrap"><div style="flex:1;min-width:240px"><h2 class="card-title">Цей тиждень по відділах</h2><p class="hint">З ' + weekName(data.weekStart) + ', ' + esc(M.dateLong(data.week.from)) + ' · «зроблено» — до вчора включно · з усіх таблиць</p></div>' +
        '<div class="mg-actions"><span class="hint">Тиждень з</span><div class="seg seg--sm" role="radiogroup" aria-label="Тиждень починається">' + [['mon', 'понеділка'], ['sun', 'неділі']].map(function (o) {
          return '<button class="seg__btn' + (o[0] === data.weekStart ? ' seg__btn--on' : '') + '" type="button" aria-pressed="' + (o[0] === data.weekStart) + '" data-act="mg-week"' + da('v', o[0]) + '>' + o[1] + '</button>'; }).join('') + '</div></div></div>' +
        (data.week.rows.length ? '<div class="tbl-box"><table class="tbl"><thead><tr><th>Відділ</th><th>Таблиця</th><th class="n">Зроблено вчора, шт</th><th class="n">Треба за тиждень, шт</th><th>Зроблено за тиждень, %' + M.hq('sr.mg.weekDone') + '</th><th class="n">Норма вибірки на день' + M.hq('term.sample') + '</th></tr></thead><tbody>' +
          data.week.rows.map(weekRow).join('') + '</tbody></table></div>' : H.empty('Увімкнених відділів немає', '')) +
        (data.warnings.length ? '<p class="mg-warnline">' + P.ic('warning', 'ui-icon--sm') + 'Кількості складено з кількох таблиць: ' + esc(overlapText(data.warnings)) + '</p>' : '') + '</section>' +
        '<div class="mg-head"><div><h2 class="card-title">Таблиці-джерела · ' + n + '</h2><p class="hint">У кожної — своя літера й колір; дата й замовлення задаються раз на таблицю.</p></div></div>' +
        (n ? '<div class="mg-tcards">' + data.tables.map(card).join('') + '</div>' : '<section class="card">' + H.empty('Таблиць ще немає', '') + '</section>') +
        '<p class="hint">У тестовій версії справжні таблиці не відкриваються: колонки й числа вигадані. Доступу «Перегляд» досить — додаток у таблиці нічого не змінює.</p>';
    }

    function openWizard(opt) {
      opt = opt || {};
      var drafts = data.tables.map(function (t) {
        return { id: t.id, mark: t.mark, label: t.label, title: t.title, url: t.url, sheet: t.sheet, headerRow: t.headerRow, dataRow: t.dataRow, dateCol: t.dateCol, orderCol: t.orderCol,
          depts: t.depts.map(function (x) { return { departmentId: x.departmentId, doneCol: x.doneCol, planCol: x.planCol }; }) };
      });
      var cur = 0, errs = {}, layer;   // errs[i] = помилки вкладки i: [{field, message}]
      function cols(d) { return data.marks[d.mark].columns; }
      function freeMark() { var used = {}; drafts.forEach(function (d) { used[d.mark] = 1; }); return data.marks.filter(function (m) { return !used[m.mark]; })[0]; }
      function addDraft() {
        var m = freeMark(); if (!m) return false;
        drafts.push({ id: null, mark: m.mark, label: m.label, title: m.title, url: '', sheet: m.sheet, headerRow: m.headerRow, dataRow: m.headerRow + 1, dateCol: '', orderCol: '', depts: [] });
        cur = drafts.length - 1; return true;
      }
      function freeDepts(d) { return data.departments.filter(function (x) { return !d.depts.some(function (y) { return y.departmentId === x.id; }); }); }
      function addDept(d) { var f = freeDepts(d).filter(function (x) { return x.active; })[0] || freeDepts(d)[0]; if (f) d.depts.push({ departmentId: f.id, doneCol: '', planCol: null }); }
      function elsewhere(i, depId) {
        return drafts.filter(function (d, k) { return k !== i && d.depts.some(function (x) { return x.departmentId === depId && x.doneCol; }); }).map(function (d) { return d.label; });
      }
      function match(d) {
        var list = cols(d).map(function (c) { return { col: c.col, name: c.name.toLowerCase() }; }), found = 0, total = 2, miss = [];
        function first(test) { return list.filter(test)[0]; }
        var dc = first(function (c) { return c.name.indexOf('дата') >= 0; });
        if (dc) { d.dateCol = dc.col; found++; } else miss.push('дата');
        var oc = first(function (c) { return c.name.indexOf('замовлення') >= 0 && c.col !== d.dateCol; });
        if (oc) { d.orderCol = oc.col; found++; } else miss.push('замовлення');
        if (!d.depts.length) {
          var i = drafts.indexOf(d), on = data.departments.filter(function (x) { return x.active; });
          var spare = on.filter(function (x) { return !drafts.some(function (o, k) { return k !== i && o.depts.some(function (y) { return y.departmentId === x.id; }); }); });
          (spare.length ? spare : on).forEach(function (x) { d.depts.push({ departmentId: x.id, doneCol: '', planCol: null }); });
        }
        d.depts.forEach(function (x) {
          var name = depName(x.departmentId).toLowerCase();
          var mine = list.filter(function (c) { return c.name.indexOf(name) >= 0; }).sort(function (a, b) { return a.name.length - b.name.length; });
          var plan = mine.filter(function (c) { return /план|треба/.test(c.name); })[0], done = mine.filter(function (c) { return !/план|треба/.test(c.name); })[0];
          total += 2;
          if (done) { x.doneCol = done.col; found++; } else miss.push(depName(x.departmentId) + ' — зроблено');
          if (plan) { x.planCol = plan.col; found++; } else miss.push(depName(x.departmentId) + ' — треба');
        });
        d.matched = 'Підібрано ' + found + ' ' + M.plural(found, ['колонку', 'колонки', 'колонок']) + ' з ' + total + (miss.length ? ' · не знайдено: ' + miss.join(', ') : '');
      }
      function tabs() {
        return drafts.map(function (d, i) {
          return '<button class="mg-wz__tab mg-t' + d.mark + (i === cur ? ' mg-wz__tab--on' : '') + '" type="button" role="tab" aria-selected="' + (i === cur) + '" data-act="mg-wz-tab" data-i="' + i + '">' +
            tag(d.mark, d.label) + '<span class="mg-wz__tabname" data-mg-tabname="' + i + '">' + esc(d.title || 'Без назви') + '</span>' +
            (errs[i] && errs[i].length ? '<span class="badge badge--danger">помилки: ' + errs[i].length + '</span>' : d.id ? '' : H.badge('нова', 'info')) + '</button>';
        }).join('') + (freeMark() ? '<button class="mg-wz__add" type="button" data-act="mg-wz-new">' + P.ic('add', 'ui-icon--sm') + 'Ще таблиця</button>' : '');
      }
      function colOptions(d, curCol, emptyLabel, taken) {
        return '<option value=""' + (!curCol ? ' selected' : '') + '>' + esc(emptyLabel) + '</option>' + cols(d).map(function (x) {
          var busy = taken[x.col] && x.col !== curCol;
          return '<option value="' + x.col + '"' + (x.col === curCol ? ' selected' : '') + (busy ? ' disabled' : '') + '>' + x.col + ' · ' + esc(x.name) + (busy ? ' — зайнята' : '') + '</option>'; }).join('');
      }
      function block(n, title, sub, inner, extra) {
        return '<section class="mg-wz__block"><div class="card-head" style="flex-wrap:wrap"><span class="num-badge">' + n + '</span><div style="flex:1;min-width:180px"><h3 class="card-title">' + title + '</h3>' +
          (sub ? '<p class="hint">' + sub + '</p>' : '') + '</div>' + (extra || '') + '</div>' + inner + '</section>';
      }
      function pane() {
        var d = drafts[cur], i = cur, taken = {}, free = freeDepts(d);
        [d.dateCol, d.orderCol].forEach(function (c) { if (c) taken[c] = 1; });
        d.depts.forEach(function (x) { if (x.doneCol) taken[x.doneCol] = 1; if (x.planCol) taken[x.planCol] = 1; });
        var first = errs[i] && errs[i][0];
        return '<div class="mg-wz__band">' + tag(d.mark, d.label, 'mg-tag--lg') + '<div class="mg-wz__bandtext"><b>Таблиця ' + esc(d.label) + '</b><span class="hint" data-mg-bandname>' + esc(d.title || 'Без назви') + '</span></div>' +
          (d.id ? H.badge('збережена') : H.badge('нова', 'info') + '<button class="btn btn--quiet btn--sm" type="button" data-act="mg-wz-drop">' + P.ic('close', 'ui-icon--sm') + 'Не додавати</button>') + '</div>' +
          (first ? '<div class="banner banner--danger">' + P.ic('error', 'icon') + '<div class="banner__body"><p class="banner__title">Не збережено · таблиця ' + esc(d.label) + '</p><p class="banner__text">' + esc(first.message) +
            (errs[i].length > 1 ? ' Ще ' + (errs[i].length - 1) + ' — біля полів нижче.' : '') + '</p></div></div>' : '') +
          block(1, 'Таблиця', '', '<div class="mg-form">' +
            M.field('title', 'Назва таблиці', M.input('title', d.title, ' data-k="title" autocomplete="off" maxlength="60"')) +
            M.field('url', 'Посилання на таблицю', M.input('url', d.url, ' data-k="url" autocomplete="off" maxlength="400" placeholder="https://…"')) +
            '<div class="mg-wz__3">' + M.field('sheet', 'Аркуш', M.input('sheet', d.sheet, ' data-k="sheet" autocomplete="off" maxlength="60"')) +
            M.field('headerRow', 'Рядок шапки', M.input('headerRow', d.headerRow, ' data-k="headerRow" type="number" min="1" max="50" inputmode="numeric"'), '', 'sr.mg.headerRow') +
            M.field('dataRow', 'Перший рядок даних', M.input('dataRow', d.dataRow, ' data-k="dataRow" type="number" min="2" max="60" inputmode="numeric"'), '', 'sr.mg.dataRow') + '</div></div>') +
          block(2, 'Спільне для всіх відділів таблиці ' + esc(d.label), 'Дата й замовлення — одні на всю таблицю.', '<div class="pair">' +
            '<label class="field" data-f="dateCol"><span class="label">Колонка дати</span><select class="input" data-k="dateCol">' + colOptions(d, d.dateCol, '— оберіть —', taken) + '</select></label>' +
            '<label class="field" data-f="orderCol"><span class="label">Колонка замовлення</span><select class="input" data-k="orderCol">' + colOptions(d, d.orderCol, '— оберіть —', taken) + '</select></label></div>') +
          block(3, 'Відділи · ' + d.depts.length, 'Кожному — колонка «скільки зроблено» і, якщо є, «скільки треба».',
            (d.matched ? '<p class="mg-wz__matched">' + P.ic('check', 'ui-icon--sm') + esc(d.matched) + '</p>' : '') +
            '<div class="tbl-box" data-f="depts"><table class="tbl"><thead><tr><th>Відділ</th><th>Скільки зроблено' + M.hq('sr.mg.doneCol') + '</th><th>Скільки треба' + M.hq('sr.mg.planCol') + '</th><th><span class="mg-vh">Прибрати</span></th></tr></thead><tbody>' +
            (d.depts.length ? d.depts.map(function (x, k) {
              var f = 'depts[' + k + '].', also = elsewhere(i, x.departmentId);
              return '<tr><td data-f="' + f + 'departmentId"><select class="input mg-wz__sel" data-row="' + k + '" data-k="departmentId" aria-label="Відділ">' +
                data.departments.map(function (dp) { return (dp.id !== x.departmentId && d.depts.some(function (y) { return y.departmentId === dp.id; })) ? '' : '<option value="' + esc(dp.id) + '"' + (dp.id === x.departmentId ? ' selected' : '') + '>' + esc(dp.name) + (dp.active ? '' : ' (вимкнено)') + '</option>'; }).join('') + '</select>' +
                (also.length ? '<span class="mg-wz__also">' + P.ic('warning', 'ui-icon--sm') + 'є ще в таблиці ' + esc(also.join(', ')) + ' — кількості з таблиць додадуться</span>' : '') + '</td>' +
                '<td data-f="' + f + 'doneCol"><select class="input mg-wz__sel' + (x.doneCol ? '' : ' select--empty') + '" data-row="' + k + '" data-k="doneCol" aria-label="Скільки зроблено · ' + esc(depName(x.departmentId)) + '">' + colOptions(d, x.doneCol, '— оберіть —', taken) + '</select></td>' +
                '<td data-f="' + f + 'planCol"><select class="input mg-wz__sel' + (x.planCol ? '' : ' select--empty') + '" data-row="' + k + '" data-k="planCol" aria-label="Скільки треба · ' + esc(depName(x.departmentId)) + '">' + colOptions(d, x.planCol, 'немає такої колонки', taken) + '</select></td>' +
                '<td style="width:44px"><button class="icon-btn" type="button" data-act="mg-wz-del" data-row="' + k + '" aria-label="Прибрати ' + esc(depName(x.departmentId)) + '">' + P.ic('delete') + '</button></td></tr>';
            }).join('') : '<tr><td colspan="4" class="mg-dim">жодного відділу</td></tr>') + '</tbody></table></div>' +
            (free.length ? '<button class="btn btn--secondary btn--add" type="button" data-act="mg-wz-add">' + P.ic('add', 'ui-icon--sm') + 'Відділ</button>' : ''),
            '<button class="btn btn--secondary btn--sm" type="button" data-act="mg-wz-match">' + P.ic('search', 'ui-icon--sm') + 'Підібрати за назвами колонок</button>') +
          '<p class="hint">У тестовій версії таблицю не відкриваємо: колонки в списках вигадані.</p>';
      }
      function foot() {
        var fresh = drafts.filter(function (d) { return !d.id; }).length;
        return '<p class="action-bar__sum" style="font-size:14px">У вікні ' + M.cnt(drafts.length, W.table) + (fresh ? ' · нових: ' + fresh : '') + ' · зберігаються разом</p>' +
          '<button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button>' +
          '<button class="btn btn--primary" type="button" data-act="mg-wz-save"' + (drafts.length ? '' : ' disabled') + '>' + P.ic('save', 'ui-icon--sm') + 'Зберегти все</button>';
      }
      function redraw(keepScroll) {
        var p = q(layer.el, '[data-mg-pane]'), top = keepScroll ? p.scrollTop : 0;
        q(layer.el, '[data-mg-tabs]').innerHTML = tabs();
        p.className = 'mg-wz__pane' + (drafts.length ? ' mg-t' + drafts[cur].mark : '');
        p.innerHTML = drafts.length ? pane() : H.empty('Таблиць у вікні немає', '');
        if (drafts.length && errs[cur] && errs[cur].length) showFieldErrors(p, errs[cur]);
        p.scrollTop = top; layer.foot(foot());
      }
      function forget(i) { delete errs[i]; }
      function showFieldErrors(box, list) {
        list.forEach(function (e) {
          var f = q(box, '[data-f="' + e.field + '"]'); if (!f) return;
          var inp = f.matches('.input') ? f : q(f, '.input'); if (inp) inp.classList.add('input--invalid');
          f.insertAdjacentHTML('beforeend', '<p class="err mg-err" role="alert">' + esc(e.message) + '</p>');
        });
      }

      layer = M.modal({ title: 'Таблиці виробництва', sub: esc(v.ctx.loc.name) + ' · кожна вкладка — окрема таблиця',
        body: '<div class="mg-wz__tabs" role="tablist" data-mg-tabs></div><div class="mg-wz__pane" data-mg-pane></div>', foot: ' ',
        onMount: function (el) {
          var b = q(el, '.ov-body'); b.style.padding = '0'; b.style.gap = '0'; b.style.overflow = 'hidden';
          function bind(e) {
            var t = e.target, k = t.getAttribute && t.getAttribute('data-k'), d = drafts[cur]; if (!k || !d) return;
            var row = t.getAttribute('data-row'), value = t.type === 'number' ? (t.value === '' ? '' : +t.value) : t.value;
            if (row != null) d.depts[+row][k] = value || (k === 'planCol' ? null : '');
            else d[k] = value;
            if (k === 'title') { var a = q(el, '[data-mg-tabname="' + cur + '"]'), n = q(el, '[data-mg-bandname]'); if (a) a.textContent = value || 'Без назви'; if (n) n.textContent = value || 'Без назви'; }
            if (e.type === 'change' && t.tagName === 'SELECT') { forget(cur); redraw(true); }
          }
          el.addEventListener('input', bind); el.addEventListener('change', bind);
        },
        on: {
          'mg-wz-tab': function (t) { cur = +t.getAttribute('data-i'); redraw(); },
          'mg-wz-new': function () { if (addDraft()) redraw(); },
          'mg-wz-drop': function () { drafts.splice(cur, 1); errs = {}; cur = Math.max(0, cur - 1); redraw(); },
          'mg-wz-add': function () { addDept(drafts[cur]); forget(cur); redraw(true); },
          'mg-wz-del': function (t) { drafts[cur].depts.splice(+t.getAttribute('data-row'), 1); forget(cur); redraw(true); },
          'mg-wz-match': function () { match(drafts[cur]); forget(cur); redraw(true); },
          'mg-wz-save': function (t) {
            t.disabled = true;
            v.call('srMgImportSave', { tables: drafts.map(function (d) {
              return { id: d.id, mark: d.mark, title: d.title, url: d.url, sheet: d.sheet, headerRow: d.headerRow, dataRow: d.dataRow, dateCol: d.dateCol, orderCol: d.orderCol, depts: d.depts };
            }) }).then(function (r) {
              t.disabled = false;
              if (!r.ok) {
                if (r.code !== 'validation' || !r.errors) { M.failToast(r); return; }
                errs = {};
                r.errors.forEach(function (e) { if (e.table != null) (errs[e.table] = errs[e.table] || []).push({ field: String(e.field).replace(/^tables\[\d+\]\./, ''), message: e.message }); });
                if (!Object.keys(errs).length) { P.toast('warn', 'Не збережено', r.error); return; }
                if (!errs[cur]) cur = +Object.keys(errs)[0];
                redraw(); return;
              }
              layer.close();
              P.toast('ok', 'Збережено ' + M.cnt(r.saved.length, W.table) + ' · ' + r.saved.map(function (s) { return s.label; }).join(', '),
                r.warnings.length ? 'Відділ є в кількох таблицях — їхні кількості додаються: ' + overlapText(r.warnings) + '.' : 'Оновлено о ' + P.fmt.time(r.updatedAt) + '.');
              if (v.ctx.alive()) load();
            });
          }
        } }, 'mg-wizard');
      if (opt.add) addDraft();
      else if (opt.id) drafts.forEach(function (d, i) { if (d.id === opt.id) cur = i; });
      if (opt.addDept && drafts[cur]) addDept(drafts[cur]);
      redraw();
    }

    v.openNew = function () { openWizard({ add: true }); };
    v.ctx.on('mg-t-new', function () { openWizard({ add: true }); });
    v.ctx.on('mg-t-edit', function (t) { openWizard({ id: t.getAttribute('data-id') }); });
    v.ctx.on('mg-t-dept', function (t) { openWizard({ id: t.getAttribute('data-id'), addDept: true }); });
    v.ctx.on('mg-t-del', function (t) {
      var x = data.tables.filter(function (y) { return y.id === t.getAttribute('data-id'); })[0]; if (!x) return;
      var only = x.depts.filter(function (d) { return !data.tables.some(function (o) { return o !== x && o.depts.some(function (y) { return y.departmentId === d.departmentId; }); }); }).map(function (d) { return depName(d.departmentId); });
      P.confirm({ title: 'Прибрати таблицю ' + x.label + ' · «' + x.title + '»?', okLabel: 'Прибрати таблицю', danger: true,
        text: (only.length ? '«Не підключено» ' + (only.length > 1 ? 'стануть' : 'стане') + ': ' + only.join(', ') + '.' : 'Усі її відділи є ще в інших таблицях.') + ' Налаштування таблиці зникнуть.' })
        .then(function (ok) {
          if (!ok) return;
          v.call('srMgImportTableDelete', { id: x.id }).then(function (r) {
            if (!v.ctx.alive()) return;
            if (!r.ok) { M.failToast(r); return; }
            P.toast('ok', 'Таблицю прибрано · ' + r.label + ' · ' + r.title, 'Лишилось: ' + M.cnt(r.left, W.table) + '.'); load();
          });
        });
    });
    v.ctx.on('mg-week', function (t) {
      var ws = t.getAttribute('data-v'); if (ws === data.weekStart) return;
      v.call('srMgImportSave', { weekStart: ws }).then(function (r) {
        if (!v.ctx.alive()) return;
        if (!r.ok) { M.failToast(r); return; }
        P.toast('ok', 'Тиждень — з ' + weekName(r.weekStart)); load();
      });
    });
    v.ctx.on('mg-refresh', function (t) {
      t.disabled = true;
      v.call('srMgImportRefresh').then(function (r) {
        if (!v.ctx.alive()) return;
        t.disabled = false;
        if (!r.ok) { M.failToast(r); return; }
        P.toast('ok', 'Дані виробництва оновлено о ' + P.fmt.time(r.updatedAt), 'У тестовій версії числа ті самі — справжню таблицю не читаємо.');
        load();
      });
    });
    load();
  });
})(window);
