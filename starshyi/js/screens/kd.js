(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc;

  var MON = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  function dd(day) { var p = String(day).split('-'); return { d: +p[2], m: +p[1] }; }
  function range(a, b) { var x = dd(a), y = dd(b); return x.m === y.m ? x.d + '–' + y.d + ' ' + MON[y.m - 1] : x.d + ' ' + MON[x.m - 1] + ' – ' + y.d + ' ' + MON[y.m - 1]; }
  function rangeShort(a, b) { var x = dd(a), y = dd(b); return x.m === y.m ? x.d + '–' + H.dayShort(b) : H.dayShort(a) + '–' + H.dayShort(b); }
  function wd(day) {
    return new Date(Date.parse(day + 'T12:00:00Z')).toLocaleDateString('uk-UA', { weekday: 'short', timeZone: 'UTC' }) + ', ' + H.dayShort(day);
  }
  function plural(n, a, b, c) { return n + ' ' + P.plural(n, a, b, c); }
  var pct = H.pct;

  function segNav(on, extra) {
    return '<div class="kd-top"><div class="seg" style="flex:none">' + [['/kd', 'По відділах'], ['/kd/list', 'Список дій'], ['/kd/stats', 'Чи допомагають']].map(function (x) {
      return '<a class="seg__btn' + (x[0] === on ? ' seg__btn--on' : '') + '" href="#' + x[0] + '" style="text-decoration:none">' + x[1] + '</a>';
    }).join('') + '</div>' + (extra || '') + '</div>';
  }
  function stateBadge(a, today) {
    if (a.status === 'new') return H.badge('нова', 'danger');
    if (a.status === 'started') {
      if (a.overdue) return H.badge('термін минув, ' + H.dayShort(a.due), 'danger');
      if (a.due && a.due <= addDays(today, 1)) return H.badge((a.due === today ? 'термін сьогодні, ' : 'термін завтра, ') + H.dayShort(a.due), 'warn');
      return H.badge('в роботі');
    }
    if (a.status === 'check') return H.badge('перевірка', 'info');
    if (a.status === 'helped') return H.badge('допомогла', 'ok');
    if (a.status === 'not_helped') return H.badge('не допомогла', 'warn');
    return H.badge('не потрібно');
  }
  function addDays(k, n) { var p = k.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * 86400000).toISOString().slice(0, 10); }
  function todayKey() { return P.fmt.dayKey(new Date()); }
  function rates(a) {
    if (a.after != null) return pct(a.rate) + ' → ' + pct(a.after);
    if (a.interim) return pct(a.rate) + ' → поки ' + pct(a.interim.rate);
    return pct(a.rate);
  }
  function steps(a) {
    var s1 = a.status === 'new' ? 'now' : 'done', s2 = a.implementedAt ? 'done' : a.status === 'started' ? 'now' : '',
      s3 = a.status === 'check' ? 'now' : a.status === 'helped' || a.status === 'not_helped' ? 'done' : '';
    var dot = function (k, t) { return '<span><i class="dotd' + (k ? ' dotd--' + k : '') + '"></i>' + t + '</span>'; };
    return '<div class="steps">' + dot(s1, 'Почато' + (a.startedAt && a.status !== 'new' ? ' ' + H.dayShort(a.startedAt) : '')) + '<i class="ln"></i>' +
      dot(s2, 'Впроваджено' + (a.implementedAt ? ' ' + H.dayShort(a.implementedAt) : '')) + '<i class="ln"></i>' +
      dot(s3, 'Перевірка' + (a.checkStart ? ' ' + rangeShort(a.checkStart, a.checkEnd) : a.afterStart ? ' ' + rangeShort(a.afterStart, a.afterEnd) : '')) + '</div>';
  }
  function causeLine(a, causes) {
    var c = causes && a.causes.length ? (causes.filter(function (x) { return x.id === a.causes[0]; })[0] || {}).label : null;
    return '<p class="hint kd-plan">' + (c ? '<b>' + esc(c) + '.</b> ' : '') + esc(a.plan) + '</p>';
  }
  var CAUSE_LABELS = { skill: 'Не знав / не вміє', discipline: 'Знав, але не зробив', tool: 'Інструмент чи оснастка', material: 'Матеріал', organization: 'Організація роботи', other: 'Інше' };
  var CAUSES = Object.keys(CAUSE_LABELS).map(function (k) { return { id: k, label: CAUSE_LABELS[k] }; });
  function ref(a) {
    return a.id ? ' data-id="' + esc(a.id) + '"' : ' data-dep="' + esc(a.departmentId) + '" data-type="' + esc(a.defectTypeId) + '" data-period="' + a.period + '"';
  }
  function refOf(t) {
    var id = t.getAttribute('data-id');
    return id ? { id: id } : { departmentId: t.getAttribute('data-dep'), defectTypeId: t.getAttribute('data-type'), period: +t.getAttribute('data-period') };
  }
  function dynBlock(dyn, labels) {
    return H.dyn(dyn.map(function (x) { return x.rate; }), labels === 'pct' ? dyn.map(function (x) { return x.rate == null ? '—' : pct(x.rate); }) : dyn.map(function (x) { return H.dayShort(x.start); }));
  }
  function topLine(a) {
    var w = a.workers && a.workers[0], p = a.products && a.products[0];
    if (!w && !p) return '';
    return 'Найбільше: ' + (w ? esc(w.name) + (w.code ? ' · ' + esc(w.code) : '') + ' — ' + w.qty + ' шт' : '') + (w && p ? ' · ' : '') + (p ? esc(p.name) + ' — ' + p.qty + ' шт' : '');
  }

  function done(ctx, kind, title, text) {
    P.toast(kind || 'ok', title, text);
    ctx.reload();
    P.emit('kd:changed');
  }
  function showErrors(el, r) {
    Array.prototype.forEach.call(el.querySelectorAll('[data-err]'), function (x) { x.style.display = 'none'; x.textContent = ''; });
    Array.prototype.forEach.call(el.querySelectorAll('.input--invalid'), function (x) { x.classList.remove('input--invalid'); });
    var shown = false;
    (r.errors || []).forEach(function (e) {
      var slot = el.querySelector('[data-err="' + e.field + '"]'), f = el.querySelector('[data-f="' + e.field + '"]');
      if (slot) { slot.style.display = ''; slot.textContent = e.message; shown = true; }
      if (f) f.classList.add('input--invalid');
    });
    return shown;
  }
  function errSlot(f) { return '<p class="err" data-err="' + f + '" style="display:none"></p>'; }

  function openStart(ctx, r0, opts) {
    opts = opts || {};
    P.srv('srKdItem', Object.assign({ locationId: ctx.loc.id }, r0)).then(function (r) {
      if (!r.ok) { P.toast('danger', 'Не вдалося відкрити дію', r.error); return; }
      var it = r.item, edit = !!opts.edit, picked = edit ? it.causes.slice() : [];
      var others = it.workers.slice(3), restQty = others.reduce(function (s, w) { return s + w.qty; }, 0);
      var left = '<div class="col" style="flex-basis:400px"><h3 class="card-title">Що показав розбір</h3>' +
        '<div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">' + H.kpi(H.num(it.checked), 'перевірено у відділі, шт') +
        H.kpi(H.num(it.pieces), 'шт · ' + it.name.toLowerCase(), 'danger') + H.kpi(pct(it.rate), 'від перевірених', 'danger') + '</div>' +
        '<div class="facts"><p class="group-label" style="padding:0">Динаміка — 5 останніх розборів по 4 дні</p>' + dynBlock(it.dyn, 'pct') +
        (it.trend ? '<p style="margin:0;font-weight:700">' + esc(it.trend.long) + '</p>' : '') + '</div>' +
        '<div class="facts"><p class="group-label" style="padding:0">У кого цей брак</p><div class="kd-chips">' +
        (it.workers.length ? it.workers.slice(0, 3).map(function (w, i) { return H.badge(w.name + (w.code ? ' · ' + w.code : '') + ' · ' + w.qty + ' шт', i < 2 && w.code ? 'danger' : ''); }).join('') +
          (others.length ? H.badge('ще ' + plural(others.length, 'людина', 'людини', 'людей') + ' · ' + restQty + ' шт') : '') : '<span class="hint">Винних не вказано.</span>') + '</div>' +
        '<p class="group-label" style="padding:6px 0 0">На яких виробах</p><p class="hint kd-text">' +
        (it.products.length ? it.products.slice(0, 3).map(function (p) { return esc(p.name) + ' — ' + p.qty + ' шт'; }).join(' · ') : '—') + '</p></div></div>';
      var right = '<div class="col" style="flex-basis:520px">' +
        '<div class="field"><span class="label"><span class="num-badge" style="margin-right:8px">1</span>Чому так сталося?</span>' +
        '<p class="hint">Можна кілька — першою оберіть головну.</p><div class="kd-chips" data-causes></div>' + errSlot('causes') + '</div>' +
        '<label class="field" data-note-wrap style="display:none"><span class="label">Поясніть причину «Інше»</span><input class="input" data-f="causeNote" maxlength="300" value="' + esc(it.causeNote) + '" placeholder="Що саме сталося">' + errSlot('causeNote') + '</label>' +
        '<label class="field"><span class="label"><span class="num-badge" style="margin-right:8px">2</span>Що зробимо</span>' +
        '<textarea class="textarea" data-f="plan" maxlength="1000" style="min-height:96px" placeholder="Наприклад: замінити голки на машинах 3 і 5, показати працівникові, як закріплювати шов.">' + esc(it.plan) + '</textarea>' + errSlot('plan') + '</label>' +
        '<div class="pair"><label class="field"><span class="label">Хто робить</span><select class="input" data-f="who">' + r.people.map(function (u) {
          var sel = edit ? u.id === it.who : u.me;
          return '<option value="' + esc(u.id) + '"' + (sel ? ' selected' : '') + '>' + esc(u.name) + (u.me ? ' (я)' : ' · ' + u.roleLabel.toLowerCase()) + '</option>'; }).join('') +
        '</select>' + errSlot('who') + '</label>' +
        '<label class="field"><span class="label">Зробити до</span><input class="input" type="date" data-f="due" min="' + r.today + '" value="' + esc(edit && it.due ? it.due : addDays(r.today, 2)) + '">' + errSlot('due') + '</label></div>' +
        '<div class="banner" style="align-items:center">' + P.ic('info') + '<div class="banner__body"><p class="banner__title"><span class="num-badge" style="width:24px;height:24px;margin-right:6px">3</span>Результат покажуть наступні розбори</p>' +
        '<p class="banner__text">' + esc(it.name) + ' у відділі «' + esc(it.departmentName) + '» має опуститися нижче ' + r.threshold + '%. Додаток порівняє сам — у першому повному розборі після впровадження.</p></div></div></div>';
      var m = P.sr.modal({
        title: (edit ? 'Змінити план · ' : 'Коригуюча дія · ') + it.name,
        sub: esc(it.departmentName) + ' · розбір за ' + esc(range(it.periodStart, it.periodEnd)) + ' · ' + H.lvl(it.level),
        head: '<span class="kd-head-badge">' + H.badge(pct(it.rate) + ' — поріг ' + r.threshold + '%', 'danger') + '</span>',
        body: '<div class="row kd-cols">' + left + right + '</div>',
        foot: '<p class="action-bar__sum kd-foot-note">Інші види браку з цього розбору — окремими діями.</p>' +
          '<button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button>' +
          '<button class="btn btn--primary" type="button" data-act="save">' + P.ic(edit ? 'save' : 'check') + (edit ? 'Зберегти план' : 'Почати дію') + '</button>',
        on: {
          cause: function (t) {
            var id = t.getAttribute('data-id'), i = picked.indexOf(id);
            if (i >= 0) picked.splice(i, 1); else picked.push(id);
            drawCauses(m.el);
          },
          save: function (t) {
            var el = m.el, val = function (f) { return el.querySelector('[data-f="' + f + '"]').value; };
            var payload = { locationId: ctx.loc.id, causes: picked.slice(), causeNote: val('causeNote'), plan: val('plan'), who: val('who'), due: val('due') };
            Object.assign(payload, edit ? { id: it.id } : { departmentId: it.departmentId, defectTypeId: it.defectTypeId, period: it.period });
            t.disabled = true;
            P.srv(edit ? 'srKdEditPlan' : 'srKdStart', payload).then(function (res) {
              t.disabled = false;
              if (!res.ok) { if (!showErrors(el, res)) P.toast('danger', 'Не вдалося зберегти', res.error); return; }
              m.close();
              var a = res.action;
              done(ctx, 'ok', (edit ? 'План змінено · ' : 'Дію почато · ') + a.name + ' · ' + a.departmentName,
                'Впровадити до ' + wd(a.due) + (a.whoName ? ' · ' + a.whoName : ''));
            });
          }
        },
        onMount: function (el) { drawCauses(el); }
      });
      function drawCauses(el) {
        el.querySelector('[data-causes]').innerHTML = r.causes.map(function (c) {
          var i = picked.indexOf(c.id);
          return '<button type="button" class="chip-pick kd-pick' + (i >= 0 ? ' chip-pick--on' : '') + '" data-act="cause" data-id="' + c.id + '" aria-pressed="' + (i >= 0) + '">' +
            esc(c.label) + '<small>' + (i === 0 ? 'головна' : i > 0 ? 'також' : esc(c.hint)) + '</small></button>';
        }).join('');
        el.querySelector('[data-note-wrap]').style.display = picked.indexOf('other') < 0 ? 'none' : '';
      }
    });
  }

  function openNotNeeded(ctx, r0, a) {
    var editing = a && a.status === 'not_needed';
    var m = P.sr.modal({ size: 'sm', title: (editing ? 'Змінити причину · ' : 'Не потрібно · ') + (a ? a.name : ''),
      sub: a ? esc(a.departmentName) + ' · ' + esc(rates(a)) : '',
      body: '<p class="kd-text">' + (editing ? 'Причина видна в завершених діях відділу.' : '<b>Дію не почнемо.</b> Якщо брак повториться в наступному розборі, він знову покаже перевищення.') + '</p>' +
        '<label class="field"><span class="label">Чому дія не потрібна</span><textarea class="textarea" data-f="reason" maxlength="300" style="min-height:80px" placeholder="Наприклад: разовий збій машини — полагодили того ж дня.">' + esc(editing ? a.notNeededReason : '') + '</textarea>' + errSlot('reason') + '</label>',
      foot: '<button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button><button class="btn btn--primary" type="button" data-act="ok" style="margin-left:auto">' + (editing ? 'Зберегти причину' : 'Позначити «не потрібно»') + '</button>',
      on: { ok: function (t) {
        t.disabled = true;
        P.srv('srKdNotNeeded', Object.assign({ locationId: ctx.loc.id, reason: m.el.querySelector('[data-f="reason"]').value }, r0)).then(function (res) {
          t.disabled = false;
          if (!res.ok) { if (!showErrors(m.el, res)) P.toast('danger', 'Не вдалося зберегти', res.error); return; }
          m.close();
          done(ctx, 'ok', (editing ? 'Причину змінено · ' : 'Позначено «не потрібно» · ') + res.action.name + ' · ' + res.action.departmentName, '«' + res.action.notNeededReason + '»');
        });
      } } });
  }

  function openImplement(ctx, a) {
    var today = todayKey(), fix = a.status === 'check';
    var m = P.sr.modal({ size: 'sm', title: (fix ? 'Дата впровадження · ' : 'Впроваджено · ') + a.name, sub: esc(a.departmentName) + ' · ' + esc(rates(a)),
      body: '<p class="kd-text"><b>Зробили, що в плані?</b> Перевірку зробимо самі — у першому повному розборі після цього дня.</p>' +
        '<label class="field"><span class="label">Коли впровадили</span><input class="input" type="date" data-f="day" min="' + esc(a.startedAt) + '" max="' + today + '" value="' + esc(a.implementedAt || today) + '">' + errSlot('day') + '</label>',
      foot: '<button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button><button class="btn btn--primary" type="button" data-act="ok" style="margin-left:auto">' + P.ic('check') + (fix ? 'Зберегти дату' : 'Впроваджено') + '</button>',
      on: { ok: function (t) {
        t.disabled = true;
        P.srv('srKdImplement', { locationId: ctx.loc.id, id: a.id, day: m.el.querySelector('[data-f="day"]').value }).then(function (res) {
          t.disabled = false;
          if (!res.ok) { if (!showErrors(m.el, res)) P.toast('danger', 'Не вдалося зберегти', res.error); return; }
          m.close();
          var x = res.action;
          done(ctx, 'ok', 'Впроваджено ' + H.dayShort(x.implementedAt) + ' · ' + x.name + ' · ' + x.departmentName,
            x.checkStart ? 'Перевірка — розбір ' + range(x.checkStart, x.checkEnd) : 'Результат уже порахували — дивіться картку дії');
        });
      } } });
  }

  function openDrawer(ctx, r0) {
    P.srv('srKdItem', Object.assign({ locationId: ctx.loc.id }, r0)).then(function (r) {
      if (!r.ok) { P.toast('danger', 'Не вдалося відкрити дію', r.error); return; }
      var a = r.item, last = a.dyn[a.dyn.length - 1], body = '';
      if (a.status === 'helped' || a.status === 'not_helped') {
        var ok = a.status === 'helped';
        body += '<div class="kd-result"><div class="hero__logo' + (ok ? ' hero__logo--ok' : '') + '" style="width:56px;height:56px">' + P.ic(ok ? 'success' : 'warning') + '</div>' +
          '<h3 class="hero__title">' + (ok ? 'Допомогло' : 'Не допомогло') + '</h3><p class="hero__lead">У першому повному розборі після впровадження (' + esc(range(a.afterStart, a.afterEnd)) + ') — <b>' + pct(a.after) + '</b>. Було <b>' + pct(a.rate) + '</b>.</p></div>';
      }
      body += '<div class="facts"><p class="group-label" style="padding:0">Динаміка · має стати нижче риски ' + r.threshold + '%</p>' + dynBlock(a.dyn, 'pct') +
        '<p class="hint">' + (a.status === 'new' && a.trend ? esc(a.trend.long) : 'Останній розбір (' + esc(rangeShort(last.start, last.end)) + ') — ' + pct(last.rate) + (a.status === 'started' ? ': дію ще не впроваджено.' : '.')) + '</p></div>';
      if (a.status === 'new') {
        body += '<div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">' + H.kpi(H.num(a.checked), 'перевірено, шт') + H.kpi(H.num(a.pieces), 'шт браку', 'danger') + H.kpi(pct(a.rate), 'від перевірених', 'danger') + '</div>';
        if (topLine(a)) body += '<p class="hint kd-text">' + topLine(a) + '</p>';
      } else if (a.status === 'not_needed') {
        body += '<div class="facts"><p class="group-label" style="padding:0">Чому не потрібно</p><p style="margin:0">«' + esc(a.notNeededReason) + '»</p></div>';
      } else {
        body += '<div class="facts"><p class="group-label" style="padding:0">' + (a.causes.length > 1 ? 'Причини' : 'Причина') + '</p><p style="margin:0;font-weight:600">' +
          a.causes.map(function (c, i) { return esc(CAUSE_LABELS[c] || c) + (i === 0 && a.causes.length > 1 ? ' (головна)' : ''); }).join(' · ') + '</p>' +
          (a.causeNote ? '<p class="hint">' + esc(a.causeNote) + '</p>' : '') +
          '<p class="group-label" style="padding:6px 0 0">Що робимо</p><p style="margin:0">' + esc(a.plan) + '</p>' +
          (a.whoName ? '<p class="hint">Робить: ' + esc(a.whoName) + '</p>' : '') + '</div>';
        var st1 = 'num-badge num-badge--done', grey = ' style="background:var(--surface-3);color:var(--text-3)"';
        body += '<div class="kd-steps">' +
          '<div><span class="' + st1 + '">1</span><div><b>Почато</b><p class="hint">' + H.dayShort(a.startedAt) + ' · план записано</p></div></div>' +
          (a.implementedAt ? '<div><span class="' + st1 + '">2</span><div><b>Впроваджено ' + H.dayShort(a.implementedAt) + '</b></div></div>'
            : '<div><span class="num-badge">2</span><div><b>Впровадити до ' + esc(wd(a.due)) + '</b><p class="hint">' + (a.overdue ? 'Термін минув. ' : '') + 'Зробили, що в плані? Позначте «Впроваджено».</p></div></div>') +
          (a.status === 'check' ? '<div><span class="num-badge">3</span><div><b>Перевірка — розбір ' + esc(range(a.checkStart, a.checkEnd)) + '</b><p class="hint">' + (a.interim ? 'Поки що ' + pct(a.interim.rate) + '. ' : '') + 'Порівняємо самі після розбору.</p></div></div>'
            : a.after != null ? '<div><span class="' + st1 + '">3</span><div><b>Перевірено — розбір ' + esc(range(a.afterStart, a.afterEnd)) + '</b><p class="hint">' + pct(a.after) + '</p></div></div>'
              : '<div><span class="num-badge"' + grey + '>3</span><div><b style="color:var(--text-2)">Перевірка — наступний повний розбір</b><p class="hint">Після впровадження порівняємо самі</p></div></div>') + '</div>';
      }
      var foot = '', W = r.canWrite;
      if (W && a.status === 'new') foot = '<button class="btn btn--quiet btn--sm" type="button" data-act="nn">Не потрібно</button><button class="btn btn--primary btn--sm" type="button" data-act="start" style="margin-left:auto">Почати дію</button>';
      if (W && a.status === 'started') foot = '<button class="btn btn--quiet btn--sm" type="button" data-act="nn">Не потрібно</button><button class="btn btn--secondary btn--sm" type="button" data-act="edit">' + P.ic('edit', 'ui-icon--sm') + 'Змінити план</button><button class="btn btn--primary btn--sm" type="button" data-act="impl" style="margin-left:auto">' + P.ic('check', 'ui-icon--sm') + 'Впроваджено</button>';
      if (W && a.status === 'check') foot = '<button class="btn btn--secondary btn--sm" type="button" data-act="edit">' + P.ic('edit', 'ui-icon--sm') + 'Змінити план</button><button class="btn btn--secondary btn--sm" type="button" data-act="impl">' + P.ic('calendar', 'ui-icon--sm') + 'Змінити дату</button>';
      if (W && a.status === 'not_helped' && a.retryable) foot = '<button class="btn btn--primary btn--sm" type="button" data-act="retry-kd" style="margin-left:auto">Спробувати інше</button>';
      if (W && a.status === 'not_needed') foot = '<button class="btn btn--secondary btn--sm" type="button" data-act="nn">' + P.ic('edit', 'ui-icon--sm') + 'Змінити причину</button>';
      var d = P.sr.drawer({ title: a.name + ' · ' + a.departmentName,
        sub: 'Розбір ' + esc(range(a.periodStart, a.periodEnd)) + (a.startedAt && a.status !== 'new' ? ' · почато ' + H.dayShort(a.startedAt) : '') + (a.whoName && a.status !== 'not_needed' ? ' · ' + esc(a.whoName) : '') + ' · ' + H.lvl(a.level),
        head: stateBadge(a, r.today), body: body, foot: foot,
        on: {
          start: function () { d.close(); openStart(ctx, r0); },
          nn: function () { d.close(); openNotNeeded(ctx, r0, a); },
          edit: function () { d.close(); openStart(ctx, r0, { edit: true }); },
          impl: function () { d.close(); openImplement(ctx, a); },
          'retry-kd': function () { d.close(); openStart(ctx, { departmentId: a.departmentId, defectTypeId: a.defectTypeId, period: a.resultPeriod }); }
        } });
    });
  }

  function bindActions(ctx, find) {
    ctx.on('start', function (t) { openStart(ctx, refOf(t)); });
    ctx.on('nn', function (t) { openNotNeeded(ctx, refOf(t), find(t)); });
    ctx.on('edit', function (t) { openStart(ctx, refOf(t), { edit: true }); });
    ctx.on('impl', function (t) { openImplement(ctx, find(t)); });
    ctx.on('retry-kd', function (t) { var a = find(t); openStart(ctx, { departmentId: a.departmentId, defectTypeId: a.defectTypeId, period: a.resultPeriod }); });
    ctx.on('open', function (t) { openDrawer(ctx, refOf(t)); });
  }
  function finder(list) {
    return function (t) { var r = refOf(t); return list.filter(function (a) { return r.id ? a.id === r.id : a.departmentId === r.departmentId && a.defectTypeId === r.defectTypeId && a.period === r.period; })[0]; };
  }

  P.sr.screen('/kd', { tab: 'kd', title: 'Коригуючі дії', period: false, render: function (ctx) {
    P.srv('srKdOverview', { locationId: ctx.loc.id }).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
      var t = r.totals, rv = r.review, today = todayKey(), withNew = r.depts.filter(function (d) { return d.counts['new']; });
      var lead = t['new'] ? '<b style="color:var(--danger)">' + plural(t['new'], 'нова дія чекає', 'нові дії чекають', 'нових дій чекають') + ' рішення</b> — ' +
        esc(withNew.map(function (d) { return d.name; }).join(', ')) + '.' : '<b>Нових перевищень немає</b> — усі види браку в межах ' + r.threshold + '% або вже в роботі.';
      var html = segNav('/kd', '<p class="hint" style="flex:1;min-width:260px">Розбір раз на 4 дні · кожен вид браку окремо · понад ' + r.threshold + '% — коригуюча дія · одна дія = один вид браку</p>') +
        '<section class="card kd-sum"' + (t['new'] ? ' style="border-color:var(--danger-line)"' : '') + '><div class="kd-sum__text"><h2 class="h2">Розбір за ' + esc(range(rv.start, rv.end)) + ' готовий</h2>' +
        '<p class="h2-sub kd-text">' + lead + ' Наступний розбір — ' + esc(wd(rv.readyOn)) + '.</p></div>' +
        '<div class="kpis kd-sum__kpis">' + H.kpi(String(t['new']), 'нові — чекають рішення', t['new'] ? 'danger' : '') + H.kpi(String(t.started), 'в роботі') +
        '<div class="kpi"><span class="kpi__val" style="color:var(--info)">' + t.check + '</span><span class="kpi__label">на перевірці</span></div>' +
        H.kpi(String(t.helped30), 'допомогли за 30 днів', 'ok') + '</div></section>';
      if (!r.depts.length) { ctx.el.innerHTML = html + H.empty('Відділів поки немає', 'Додайте відділи в «Керування» — розбір зʼявиться після перших аудитів.'); return; }
      html += '<div class="kd-boxes">' + r.depts.map(function (d) { return box(d, r, today); }).join('') + '</div>' +
        '<a class="btn btn--secondary" href="#/kd/list" style="align-self:flex-start">' + P.ic('list') + 'Показати всі дії списком · ' + r.actionsTotal + '</a>';
      ctx.el.innerHTML = html;
    });
  } });

  function box(d, r, today) {
    var c = d.counts, rows = [], hot = c['new'] > 0;
    var row = function (title, meta, badge) { return '<div class="row-item" style="min-height:48px"><span class="row-item__main"><span class="row-item__title">' + title + '</span><span class="row-item__meta">' + meta + '</span></span>' + badge + '</div>'; };
    d.news.forEach(function (a) { rows.push(row(esc(a.name) + ' · ' + pct(a.rate), H.lvl(a.level) + ' · ' + esc(a.trend ? a.trend.text : ''), H.badge('нова', 'danger'))); });
    d.check.forEach(function (a) { rows.push(row(esc(a.name) + ' · ' + esc(rates(a)), 'перевірка в розборі ' + esc(rangeShort(a.checkStart, a.checkEnd)), H.badge('перевірка', 'info'))); });
    d.started.forEach(function (a) { rows.push(row(esc(a.name) + ' · ' + pct(a.rate), H.lvl(a.level) + ' · впровадити до ' + H.dayShort(a.due), stateBadge(a, today))); });
    d.done.forEach(function (a) {
      rows.push(a.status === 'helped' ? row(esc(a.name) + ' · ' + esc(rates(a)), 'розбір ' + esc(rangeShort(a.periodStart, a.periodEnd)), H.badge('допомогла', 'ok'))
        : row(esc(a.name), esc(rates(a)) + (a.retryable ? ' · варто спробувати інше' : ''), H.badge('не допомогла', 'warn')));
    });
    d.near.forEach(function (x) { rows.push(row(esc(x.name) + ' · ' + pct(x.rate), H.lvl(x.level) + ' · ще не поріг', H.badge('близько до порогу', 'warn'))); });
    var badge = hot ? H.badge(plural(c['new'], 'нова', 'нові', 'нових'), 'danger')
      : d.soonDue ? H.badge(d.soonDue < today ? 'термін минув' : d.soonDue === today ? 'термін сьогодні' : 'термін завтра', d.soonDue < today ? 'danger' : 'warn')
        : d.lowData ? H.badge('мало даних', 'warn') : c.started + c.check ? H.badge('дії тривають', 'info') : H.badge('спокійно', 'ok');
    var mini = function (n, label, color) { return '<div class="kpi" style="padding:8px"><span class="kpi__val" style="font-size:22px' + (n && color ? ';color:var(--' + color + ')' : '') + '">' + n + '</span><span class="kpi__label">' + label + '</span></div>'; };
    var low = d.lowData ? '<p class="hint kd-text">У цьому розборі мало даних: ' + d.checked + ' з ' + d.minSample + ' шт — частки не рахуємо.</p>' : '';
    return '<article class="card kd-box"' + (hot ? ' style="border-color:var(--danger-line)"' : '') + '><div class="card-head"><h3 class="card-title">' + esc(d.name) + '</h3>' + badge + '</div>' +
      '<div class="kd-mini">' + mini(c['new'], 'нова', 'danger') + mini(c.started, 'в роботі') + mini(c.check, 'перевірка', 'info') + mini(c.helped, 'допомогли', 'ok') + '</div>' +
      (rows.length ? '<div class="list">' + rows.slice(0, 4).join('') + '</div>' + (rows.length > 4 ? '<p class="hint">і ще ' + (rows.length - 4) + ' — у відділі</p>' : '') : (d.lowData ? '' : '<p class="hint kd-text">Усі види браку нижче ' + r.threshold + '%.</p>')) + low +
      '<a class="btn ' + (hot ? 'btn--primary' : 'btn--secondary') + ' btn--sm" href="#/kd/dept/' + encodeURIComponent(d.id) + '" style="align-self:flex-start;margin-top:auto">Відкрити ' + esc(d.name) + '</a></article>';
  }

  P.sr.screen('/kd/dept/:id', { tab: 'kd', title: 'Коригуючі дії', period: false, render: function (ctx) {
    P.srv('srKdDept', { locationId: ctx.loc.id, departmentId: ctx.params.id }).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { ctx.el.innerHTML = '<a class="btn btn--quiet btn--sm" href="#/kd" style="align-self:flex-start">' + P.ic('arrow-left') + 'Усі відділи</a>' + H.error(r); return; }
      var today = todayKey(), rv = r.review, notHelped = r.done30.filter(function (a) { return a.status === 'not_helped'; }).length;
      bindActions(ctx, finder(r.newItems.concat(r.check, r.started, r.done30)));
      var head = '<div class="kd-head"><a class="btn btn--quiet btn--sm" href="#/kd">' + P.ic('arrow-left') + 'Усі відділи</a><h2 class="h2" style="flex:1;min-width:200px">' + esc(r.dept.name) + ' · коригуючі дії</h2>' +
        (r.newItems.length ? H.badge(plural(r.newItems.length, 'нова', 'нові', 'нових'), 'danger') : '') + (r.started.length ? H.badge(r.started.length + ' в роботі') : '') +
        (r.check.length ? H.badge(r.check.length + ' на перевірці', 'info') : '') + (notHelped ? H.badge(plural(notHelped, 'не допомогла', 'не допомогли', 'не допомогли'), 'warn') : '') + '</div>';
      var W = ctx.me.can.editCatalogs;
      var news = '<section class="kd-sec"><h3 class="card-title">Нова — потрібне рішення</h3>' + (r.newItems.length ? r.newItems.map(function (a) {
        return '<article class="kd-card"><div class="card-head" style="align-items:flex-start"><div style="flex:1;min-width:0"><h3 class="card-title">' + esc(a.name) + '</h3>' +
          '<p class="hint">Розбір ' + esc(range(a.periodStart, a.periodEnd)) + ' · ' + a.pieces + ' шт з ' + H.num(a.checked) + ' перевірених · ' + H.lvl(a.level) + '</p></div><span class="kd-card__rate">' + pct(a.rate) + '</span></div>' +
          '<div class="kd-card__body"><div class="kd-card__dyn">' + dynBlock(a.dyn) + '</div><div class="kd-card__why"><b>' + esc(a.trend.long) + '</b><span class="hint">' + topLine(a) + '</span></div></div>' +
          (W ? '<div class="kd-btns"><button class="btn btn--primary btn--sm" type="button" data-act="start"' + ref(a) + '>Почати дію</button><button class="btn btn--quiet btn--sm" type="button" data-act="nn"' + ref(a) + '>Не потрібно</button>' +
            '<button class="btn btn--quiet btn--sm" type="button" data-act="open"' + ref(a) + '>Докладніше</button></div>' : '') + '</article>';
      }).join('') : '<div class="card"><p class="kd-text"><b>Нових перевищень немає.</b> ' + (r.lowData ? 'У цьому розборі мало даних — частки не рахуємо.' : 'Усі види браку відділу в межах ' + r.threshold + '% або вже в роботі.') + '</p></div>') + '</section>';
      var entry = function (a, btns) {
        return '<div class="entry" style="background:var(--surface)"><div class="entry__head"><h4 class="entry__title" style="font-size:18px"><button class="link" type="button" data-act="open"' + ref(a) + '>' + esc(a.name) + '</button> · ' + esc(rates(a)) + '</h4>' + H.lvl(a.level) + '</div>' +
          steps(a) + causeLine(a, CAUSES) + (a.status === 'started' ? '<p class="hint">' + (a.overdue ? '<b style="color:var(--danger)">Термін минув ' + H.dayShort(a.due) + '.</b>' : 'Впровадити до ' + esc(wd(a.due))) + (a.whoName ? ' · ' + esc(a.whoName) : '') + '</p>' : '') +
          (W ? '<div class="kd-btns">' + btns + '</div>' : '') + '</div>';
      };
      var check = r.check.length ? '<section class="card"><div class="card-head"><h3 class="card-title">На перевірці</h3>' + H.badge('розбір ' + rangeShort(r.check[0].checkStart, r.check[0].checkEnd), 'info') + '</div>' +
        r.check.map(function (a) { return entry(a, '<button class="btn btn--quiet btn--sm" type="button" data-act="edit"' + ref(a) + '>' + P.ic('edit', 'ui-icon--sm') + 'Змінити план</button><button class="btn btn--quiet btn--sm" type="button" data-act="impl"' + ref(a) + '>' + P.ic('calendar', 'ui-icon--sm') + 'Змінити дату</button>'); }).join('') + '</section>' : '';
      var started = r.started.length ? '<section class="card"><h3 class="card-title">В роботі</h3>' + r.started.map(function (a) {
        return entry(a, '<button class="btn btn--primary btn--sm" type="button" data-act="impl"' + ref(a) + '>' + P.ic('check', 'ui-icon--sm') + 'Впроваджено</button><button class="btn btn--secondary btn--sm" type="button" data-act="edit"' + ref(a) + '>' + P.ic('edit', 'ui-icon--sm') + 'Змінити план</button><button class="btn btn--quiet btn--sm" type="button" data-act="nn"' + ref(a) + '>Не потрібно</button>');
      }).join('') + '</section>' : '';
      var fin = '<section class="card"><h3 class="card-title">Завершені за 30 днів</h3>' + (r.done30.length ? '<div class="list">' + r.done30.map(function (a) {
        var meta = 'Розбір ' + esc(rangeShort(a.periodStart, a.periodEnd)) + ' · ' + (a.status === 'not_needed' ? '«' + esc(a.notNeededReason) + '»' : esc(CAUSE_LABELS[a.causes[0]] || '') + (a.status === 'not_helped' ? ' · брак майже не змінився' : ''));
        var btn = !W ? '' : a.status === 'not_helped' && a.retryable ? '<button class="btn btn--secondary btn--sm" type="button" data-act="retry-kd"' + ref(a) + '>Спробувати інше</button>'
          : a.status === 'not_needed' ? '<button class="icon-btn" type="button" data-act="nn"' + ref(a) + ' aria-label="Змінити причину" title="Змінити причину">' + P.ic('edit') + '</button>' : '';
        return '<div class="row-item"><span class="row-item__main"><span class="row-item__title"><button class="link" type="button" data-act="open"' + ref(a) + '>' + esc(a.name) + '</button> · ' + esc(rates(a)) + '</span><span class="row-item__meta">' + meta + '</span></span>' + stateBadge(a, today) + btn + '</div>';
      }).join('') + '</div>' : '<p class="hint kd-text">За 30 днів завершених дій немає.</p>') + '</section>';
      var types = '<section class="card"><div><h3 class="card-title">Усі види браку · ' + esc(range(rv.start, rv.end)) + '</h3><p class="hint">' + H.num(r.checked) + ' шт перевірено · риска — поріг ' + r.threshold + '%</p></div>' +
        (r.lowData ? '<div class="banner banner--warn">' + P.ic('warning') + '<div class="banner__body"><p class="banner__title">Мало даних: ' + r.checked + ' з ' + r.minSample + ' шт</p><p class="banner__text">Цей розбір для відділу не рахуємо — перевірте більше виробів у наступні 4 дні.</p></div></div>' : '') +
        (r.types.length ? '<div class="kd-types">' + r.types.map(function (x) {
          return '<div><div class="kd-types__row"><span>' + esc(x.name) + '</span><b' + (x.over ? ' style="color:var(--danger)"' : '') + '>' + pct(x.rate) + (x.over ? ' · понад поріг' : '') + '</b></div>' + H.threshold(x.rate, x.over) + '</div>';
        }).join('') + '</div>' : '<p class="hint kd-text">Браку в цьому розборі не знайшли.</p>') + '</section>';
      var lt = r.levelsTotal, lv = r.levels;
      var levels = '<section class="card"><div><h3 class="card-title">Рівні браку відділу</h3><p class="hint">' + H.num(lt) + ' шт за 30 днів</p></div>' +
        (lt ? H.stack(lv) + '<div class="legend">' + ['fix', 'repair', 'scrap'].map(function (k) { return H.lvl(k, Math.round(lv[k] / lt * 100) + '% ' + P.sr.LEVELS[k]); }).join('') + '</div>' : '<p class="hint">Браку за 30 днів немає.</p>') + '</section>';
      ctx.el.innerHTML = head + '<div class="row"><div class="col--wide kd-stack">' + news + check + started + fin + '</div><div class="col kd-stack">' + types + levels + '</div></div>';
    });
  } });

  var STATES = [['new', 'Нові'], ['started', 'В роботі'], ['check', 'Перевірка'], ['done', 'Завершені'], ['all', 'Усі']];
  P.sr.screen('/kd/list', { tab: 'kd', title: 'Коригуючі дії — список', period: false, render: function (ctx) {
    var q = ctx.query, shown = 15;
    P.srv('srKdList', { locationId: ctx.loc.id, state: q.state || 'all', departmentId: q.dept || '' }).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { ctx.el.innerHTML = segNav('/kd/list') + H.error(r); return; }
      var today = todayKey();
      bindActions(ctx, finder(r.items));
      ctx.on('state', function (t) { ctx.go('/kd/list', { state: t.getAttribute('data-v'), dept: q.dept }); });
      ctx.on('dept', function (t) { ctx.go('/kd/list', { state: r.state, dept: t.value }); });
      ctx.on('more', function () { shown += 15; draw(); });
      function draw() {
        var filters = '<div class="kd-filters"><span class="pills">' + STATES.map(function (s) {
          return '<button class="pill' + (r.state === s[0] ? ' pill--on' : '') + '" type="button" data-act="state" data-v="' + s[0] + '">' + s[1] + (s[0] === 'all' ? '' : ' · ' + r.counts[s[0]]) + '</button>'; }).join('') + '</span>' +
          '<select class="input kd-select" data-change="dept" aria-label="Відділ"><option value="">Усі відділи</option>' + r.departments.map(function (d) {
            return '<option value="' + esc(d.id) + '"' + (q.dept === d.id ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('') + '</select></div>';
        var list = r.items.slice(0, shown), body;
        if (!r.items.length) body = H.empty('Тут порожньо', r.state === 'new' ? 'Нових перевищень немає — розбір показав, що все в межах порогу.' : 'Дій із таким станом немає. Оберіть «Усі» або інший відділ.');
        else body = '<div class="tbl-box"><table class="tbl"><thead><tr><th>Вид браку · відділ</th><th class="kd-hide-sm">Розбір</th><th class="kd-hide-sm">Хід дії</th><th>Зараз</th></tr></thead><tbody>' + list.map(function (a) {
          return '<tr data-act="open"' + ref(a) + '><td><b>' + esc(a.name) + '</b><span class="sub">' + esc(a.departmentName) + ' · ' + esc(rates(a)) + '<span class="kd-show-sm"> · розбір ' + esc(rangeShort(a.periodStart, a.periodEnd)) + '</span></span></td><td class="kd-hide-sm kd-nowrap">' + esc(rangeShort(a.periodStart, a.periodEnd)) + '</td>' +
            '<td class="kd-hide-sm">' + (a.status === 'new' || a.status === 'not_needed' ? '<span class="hint">' + (a.status === 'new' ? 'чекає рішення' : '«' + esc(a.notNeededReason) + '»') + '</span>' : steps(a)) + '</td><td>' + stateBadge(a, today) + '</td></tr>';
        }).join('') + '</tbody></table></div>' + (r.items.length > shown ? '<button class="btn btn--secondary btn--sm" type="button" data-act="more" style="align-self:flex-start">Показати ще ' + Math.min(15, r.items.length - shown) + '</button>' : '');
        ctx.el.innerHTML = segNav('/kd/list') + filters + '<section class="card kd-narrow">' + body +
          '<p class="hint">Натисніть рядок — відкриється картка дії з кнопками. Розбір ' + esc(range(r.review.start, r.review.end)) + '.</p></section>';
      }
      draw();
    });
  } });

  P.sr.screen('/kd/stats', { tab: 'kd', title: 'Коригуючі дії — чи допомагають', period: false, render: function (ctx) {
    var days = ctx.query.days === '90' ? 90 : 30, shown = 7;
    P.srv('srKdStats', { locationId: ctx.loc.id, days: days }).then(function (r) {
      if (!ctx.alive()) return;
      var pills = '<span class="pills">' + [30, 90].map(function (n) { return '<button class="pill' + (n === days ? ' pill--on' : '') + '" type="button" data-act="days" data-v="' + n + '">' + n + ' дн.</button>'; }).join('') + '</span>';
      if (!r.ok) { ctx.el.innerHTML = segNav('/kd/stats', pills) + H.error(r); return; }
      ctx.on('days', function (t) { ctx.go('/kd/stats', { days: t.getAttribute('data-v') }); });
      ctx.on('more', function () { shown = r.beforeAfter.length; draw(); });
      bindActions(ctx, finder(r.beforeAfter));
      function draw() {
        var k = r.kpi;
        var kpis = '<div class="kpis">' + H.kpi(String(k.reviews), 'розборів по 4 дні') + H.kpi(String(k.over), 'видів браку понад ' + r.threshold + '%') + H.kpi(String(k.started), 'дій почато') +
          H.kpi(String(k.helped), 'допомогли', 'ok') + H.kpi(String(k.notHelped), k.notHelped === 1 ? 'не допомогла' : 'не допомогли', k.notHelped ? 'danger' : '') + H.kpi(String(k.running), 'ще тривають') +
          H.kpi(String(k.notNeeded), '«не потрібно»') + '<div class="kpi"><span class="kpi__val"' + (k.waiting ? ' style="color:var(--warn)"' : '') + '>' + k.waiting + '</span><span class="kpi__label">чекають рішення</span></div></div>';
        var bar = function (v, after) { return '<div class="threshold"><i class="' + (v > r.threshold ? 'hot' : '') + '" style="width:' + Math.max(0, Math.min(100, (v || 0) * 10)) + '%' + (after && v <= r.threshold ? ';background:var(--info)' : '') + '"></i><b style="left:50%"></b></div>'; };
        var res = function (a) {
          return a.status === 'helped' ? H.badge('допомогло', 'ok') : a.status === 'not_helped' ? H.badge('не допомогло', 'danger')
            : a.status === 'check' ? H.badge('перевірка ' + rangeShort(a.checkStart, a.checkEnd), 'info') : H.badge('триває', 'info');
        };
        var list = r.beforeAfter.slice(0, shown);
        var table = list.length ? '<div class="tbl-box"><table class="tbl"><thead><tr><th>Вид браку · відділ</th><th style="width:44%">Брак, %</th><th>Результат</th></tr></thead><tbody>' + list.map(function (a) {
          var aft = a.after != null ? a.after : a.interim ? a.interim.rate : null;
          var txt = pct(a.rate) + ' → ' + (a.after != null ? pct(a.after) : a.interim && a.status === 'check' ? 'поки ' + pct(a.interim.rate) : 'ще не впроваджено');
          return '<tr data-act="open"' + ref(a) + '><td><b>' + esc(a.name) + '</b><span class="sub">' + esc(a.departmentName) + ' · розбір ' + esc(rangeShort(a.periodStart, a.periodEnd)) + '</span></td>' +
            '<td><div class="kd-bars">' + bar(a.rate) + (aft != null && a.status !== 'started' ? bar(aft, true) : '') + '<span class="hint">' + esc(txt) + '</span></div></td><td>' + res(a) + '</td></tr>';
        }).join('') + '</tbody></table></div>' + (r.beforeAfter.length > shown ? '<button class="btn btn--secondary btn--sm" type="button" data-act="more" style="align-self:flex-start">Ще ' + plural(r.beforeAfter.length - shown, 'дія', 'дії', 'дій') + '</button>' : '')
          : H.empty('Дій за цей час ще не було', 'Почніть першу в боксі відділу — тут зʼявиться брак до і після.');
        var hb = function (label, n, max, color) { return '<div class="hbar kd-hbar"><span>' + label + '</span><div class="hbar__track"><i style="width:' + Math.round(n / max * 100) + '%' + (color ? ';background:' + color : '') + '"></i></div><span class="hbar__n">' + n + '</span></div>'; };
        var cmax = r.causes.length ? r.causes[0].n : 1, dmax = r.depts.length ? r.depts[0].n : 1;
        var causes = '<section class="card"><div><h2 class="card-title">Причини</h2><p class="hint">' + plural(k.started, 'дія', 'дії', 'дій') + ' за ' + days + ' днів · рахуємо головну</p></div>' +
          (r.causes.length ? '<div>' + r.causes.map(function (c) { return hb(esc(c.label), c.n, cmax); }).join('') + '</div>' : '<p class="hint">Причин ще немає — за цей час дій не починали.</p>') + '</section>';
        var depts = '<section class="card"><div><h2 class="card-title">Де найчастіше перевищення</h2><p class="hint">' + plural(k.over, 'вид', 'види', 'видів') + ' браку понад ' + r.threshold + '% за ' + days + ' днів</p></div>' +
          (r.depts.length ? '<div>' + r.depts.map(function (d) { return hb(d.notHelped ? '<b>' + esc(d.name) + '</b><span class="sub">' + plural(d.notHelped, 'дія не допомогла', 'дії не допомогли', 'дій не допомогли') + '</span>' : esc(d.name), d.n, dmax, d.notHelped ? 'var(--danger-fill)' : ''); }).join('') + '</div>' : '<p class="hint">Перевищень не було — усе в межах порогу.</p>') + '</section>';
        ctx.el.innerHTML = segNav('/kd/stats', pills) + kpis + '<div class="row"><section class="card col--wide"><div><h2 class="card-title">Брак до і після дії</h2><p class="hint">Вид браку в розборі, де почали дію → перший повний розбір після впровадження · риска — поріг ' + r.threshold + '%</p></div>' +
          '<div class="legend"><span class="lvl lvl--scrap">до дії</span><span class="lvl lvl--fix">після дії</span></div>' + table + '</section>' +
          '<div class="col kd-stack">' + causes + depts + '</div></div>';
      }
      draw();
    });
  } });
})(window);
