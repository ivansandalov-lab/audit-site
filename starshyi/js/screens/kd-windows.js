(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;

  function formulaOf(it, T) { return { rate: it.rate, pieces: it.pieces, checked: it.checked, start: it.periodStart, end: it.periodEnd, over: it.rate != null && it.rate > T }; }
  function chartBlock(it, r, selText) {
    var T = r.threshold, last = it.series.filter(function (x) { return x.n === r.review.n; })[0], cur = it.series[it.series.length - 1];
    var line = function (label, x) { return '<p class="hint">' + label + ' (' + esc(K.rangeShort(x.start, x.end)) + '): <b>' + K.pct(x.rate) + '</b> · ' + K.num(x.pieces) + ' шт з ' + K.num(x.checked) + ' перевірених</p>'; };
    return '<div class="facts"><p class="group-label" style="padding:0">Частка виду браку по розборах, %</p>' +
      K.cap('«' + esc(it.name) + '» у відділі «' + esc(it.departmentName) + '», розбори ' + esc(K.spanOf(it.series)) + '. Стовпчик — один 4-денний розбір; висота — шт цього виду браку ÷ перевірено у відділі. Риска — поріг ' + T + '%.') +
      '<div data-chart="kd-item"></div>' + K.chartKeys('type', T, r.minSample, selText) +
      (last ? line('Останній повний розбір', last) : '') + (cur && cur.current && cur.checked ? line('Розбір, що триває · день ' + cur.daysDone + ' з ' + cur.days, cur) : '') + '</div>';
  }
  function whoBlock(it) {
    var per = esc(K.rangeShort(it.periodStart, it.periodEnd));
    return '<div class="facts"><p class="group-label" style="padding:0">У кого трапляється · розбір ' + per + '</p>' + K.who(K.workerRows(it.workers), { empty: 'Винних у записах не вказано' }) +
      '<p class="group-label" style="padding:6px 0 0">Хто записує · розбір ' + per + '</p>' + K.who(K.auditorRows(it.auditors), { empty: 'Записів немає' }) +
      '<p class="group-label" style="padding:6px 0 0">На яких виробах</p>' + K.who(it.products, { all: 'Показати всі', empty: 'Записів немає' }) + '</div>';
  }
  function mountChart(el, it, r, marks) {
    K.typeChart(el.querySelector('[data-chart="kd-item"]'), it.series, { name: it.name, T: r.threshold, sel: marks, height: 140, label: 'Частка виду браку «' + it.name + '» по розборах, %' });
  }

  K.openStart = function (ctx, r0, opts) {
    opts = opts || {};
    P.srv('srKdItem', Object.assign({ locationId: ctx.loc.id }, r0)).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { P.toast('danger', 'Не вдалося відкрити дію', r.error); return; }
      var it = r.item, T = r.threshold, edit = !!opts.edit, picked = edit ? it.causes.slice() : [], marks = {};
      marks[it.period] = 'розбір дії';
      var left = '<div class="col" style="flex-basis:420px"><h3 class="card-title">Розбір ' + esc(K.range(it.periodStart, it.periodEnd)) + ' · ' + esc(it.departmentName) + '</h3>' +
        K.formula(formulaOf(it, T), T) +
        '<div class="kd-tiles kd-tiles--2">' + K.tile(K.pct(it.share), 'усього браку відділу за розбір · ' + K.num(it.pieces) + ' з ' + K.num(it.deptRejected) + ' шт') +
        K.tile(String(it.auditsWith), 'аудитів із цим браком · усього аудитів відділу за розбір: ' + it.auditsTotal) + '</div>' +
        (it.trend ? '<p class="kd-trend">' + esc(it.trend.text) + '</p>' : '') +
        chartBlock(it, r, 'рамка — розбір дії') + whoBlock(it) + '</div>';
      var right = '<div class="col" style="flex-basis:500px">' +
        '<div class="field"><span class="label"><span class="num-badge" style="margin-right:8px">1</span>Причина</span>' +
        '<p class="hint">Можна кілька — перша обрана записується як головна.</p><div class="kd-chips" data-causes></div>' + K.errSlot('causes') + '</div>' +
        '<label class="field" data-note-wrap style="display:none"><span class="label">Пояснення до причини «Інше»</span><input class="input" data-f="causeNote" maxlength="300" value="' + esc(it.causeNote) + '" placeholder="Що саме сталося">' + K.errSlot('causeNote') + '</label>' +
        '<label class="field"><span class="label"><span class="num-badge" style="margin-right:8px">2</span>Що зробимо</span>' +
        '<textarea class="textarea" data-f="plan" maxlength="1000" style="min-height:96px" placeholder="Наприклад: замінити голки на машинах 3 і 5, показати працівникові, як закріплювати шов.">' + esc(it.plan) + '</textarea>' + K.errSlot('plan') + '</label>' +
        '<div class="pair"><label class="field"><span class="label">Хто робить</span><select class="input" data-f="who">' + r.people.map(function (u) {
          var sel = edit ? u.id === it.who : u.me;
          return '<option value="' + esc(u.id) + '"' + (sel ? ' selected' : '') + '>' + esc(u.name) + (u.me ? ' (я)' : ' · ' + u.roleLabel.toLowerCase()) + '</option>'; }).join('') +
        '</select>' + K.errSlot('who') + '</label>' +
        '<label class="field"><span class="label">Зробити до</span><input class="input" type="date" data-f="due" min="' + r.today + '" value="' + esc(edit && it.due ? it.due : K.addDays(r.today, 2)) + '">' + K.errSlot('due') + '</label></div>' +
        '<div class="banner" style="align-items:center">' + P.ic('info') + '<div class="banner__body"><p class="banner__title"><span class="num-badge" style="width:24px;height:24px;margin-right:6px">3</span>Перевірка — перший повний розбір після впровадження</p>' +
        '<p class="banner__text">Стан дії визначає частка цього виду браку в тому розборі (якщо у відділі перевірено від ' + r.minSample + ' шт): до ' + T + '% включно — «допомогла», понад ' + T + '% — «не допомогла».</p></div></div></div>';
      var m = P.sr.modal({
        title: (edit ? 'Змінити план · ' : 'Коригуюча дія · ') + it.name,
        sub: esc(it.departmentName) + ' · розбір ' + esc(K.range(it.periodStart, it.periodEnd)) + ' · ' + K.pct(it.rate) + ' (' + K.num(it.pieces) + ' шт з ' + K.num(it.checked) + ') · ' + H.lvl(it.level),
        head: '<span class="kd-head-badge">' + H.badge(K.pct(it.rate) + ' · поріг ' + T + '%', it.rate > T ? 'danger' : '') + '</span>',
        body: '<div class="row kd-cols">' + left + right + '</div>',
        foot: '<p class="action-bar__sum kd-foot-note">Одна дія — один вид браку у відділі.</p>' +
          '<button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button>' +
          '<button class="btn btn--primary" type="button" data-act="save">' + P.ic(edit ? 'save' : 'check') + (edit ? 'Зберегти план' : 'Почати дію') + '</button>',
        on: {
          'kd-all': K.toggleMore,
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
              if (!res.ok) { if (!K.showErrors(el, res)) P.toast('danger', 'Не вдалося зберегти', res.error); return; }
              m.close();
              var a = res.action;
              K.done(ctx, 'ok', (edit ? 'План змінено · ' : 'Дію почато · ') + a.name + ' · ' + a.departmentName,
                'Термін — ' + K.wd(a.due) + (a.whoName ? ' · ' + a.whoName : ''));
            });
          }
        },
        onMount: function (el) { drawCauses(el); mountChart(el, it, r, marks); }
      });
      function drawCauses(el) {
        el.querySelector('[data-causes]').innerHTML = r.causes.map(function (c) {
          var i = picked.indexOf(c.id);
          return '<button type="button" class="chip-pick kd-pick' + (i >= 0 ? ' chip-pick--on' : '') + '" data-act="cause" data-id="' + c.id + '" aria-pressed="' + (i >= 0) + '">' +
            esc(c.label) + (i >= 0 ? '<small>' + (i === 0 ? 'головна' : 'також') + '</small>' : '') + '</button>';
        }).join('');
        el.querySelector('[data-note-wrap]').style.display = picked.indexOf('other') < 0 ? 'none' : '';
      }
    });
  };

  K.openNotNeeded = function (ctx, r0, a) {
    var editing = a && a.status === 'not_needed';
    var m = P.sr.modal({ size: 'sm', title: (editing ? 'Змінити причину · ' : 'Не потрібно · ') + (a ? a.name : ''),
      sub: a ? esc(a.departmentName) + ' · розбір ' + esc(K.rangeShort(a.periodStart, a.periodEnd)) + ' · ' + esc(K.rates(a)) : '',
      body: '<p class="kd-text">' + (editing ? 'Причину видно в картці дії та в списку дій.'
        : 'Вид отримає стан «не потрібно» з цією причиною. Якщо в наступному розборі його частка знову буде понад поріг, він знову стане «новою».') + '</p>' +
        '<label class="field"><span class="label">Чому дія не потрібна</span><textarea class="textarea" data-f="reason" maxlength="300" style="min-height:80px" placeholder="Наприклад: разовий збій машини — полагодили того ж дня.">' + esc(editing ? a.notNeededReason : '') + '</textarea>' + K.errSlot('reason') + '</label>',
      foot: '<button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button><button class="btn btn--primary" type="button" data-act="ok" style="margin-left:auto">' + (editing ? 'Зберегти причину' : 'Позначити «не потрібно»') + '</button>',
      on: { ok: function (t) {
        t.disabled = true;
        P.srv('srKdNotNeeded', Object.assign({ locationId: ctx.loc.id, reason: m.el.querySelector('[data-f="reason"]').value }, r0)).then(function (res) {
          t.disabled = false;
          if (!res.ok) { if (!K.showErrors(m.el, res)) P.toast('danger', 'Не вдалося зберегти', res.error); return; }
          m.close();
          K.done(ctx, 'ok', (editing ? 'Причину змінено · ' : 'Позначено «не потрібно» · ') + res.action.name + ' · ' + res.action.departmentName, '«' + res.action.notNeededReason + '»');
        });
      } } });
  };

  K.openImplement = function (ctx, a) {
    var today = K.todayKey(), fix = a.status === 'check';
    var m = P.sr.modal({ size: 'sm', title: (fix ? 'Дата впровадження · ' : 'Впроваджено · ') + a.name,
      sub: esc(a.departmentName) + ' · розбір ' + esc(K.rangeShort(a.periodStart, a.periodEnd)) + ' · ' + esc(K.rates(a)),
      body: '<p class="kd-text">Перевірка — перший повний розбір після цього дня.</p>' +
        '<label class="field"><span class="label">День впровадження</span><input class="input" type="date" data-f="day" min="' + esc(a.startedAt) + '" max="' + today + '" value="' + esc(a.implementedAt || today) + '">' + K.errSlot('day') + '</label>',
      foot: '<button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button><button class="btn btn--primary" type="button" data-act="ok" style="margin-left:auto">' + P.ic('check') + (fix ? 'Зберегти дату' : 'Впроваджено') + '</button>',
      on: { ok: function (t) {
        t.disabled = true;
        P.srv('srKdImplement', { locationId: ctx.loc.id, id: a.id, day: m.el.querySelector('[data-f="day"]').value }).then(function (res) {
          t.disabled = false;
          if (!res.ok) { if (!K.showErrors(m.el, res)) P.toast('danger', 'Не вдалося зберегти', res.error); return; }
          m.close();
          var x = res.action;
          K.done(ctx, 'ok', 'Впроваджено ' + H.dayShort(x.implementedAt) + ' · ' + x.name + ' · ' + x.departmentName,
            x.checkStart ? 'Перевірка — розбір ' + K.range(x.checkStart, x.checkEnd) : 'Стан: ' + x.statusLabel + ' · ' + K.rates(x));
        });
      } } });
  };

  K.openDrawer = function (ctx, r0) {
    P.srv('srKdItem', Object.assign({ locationId: ctx.loc.id }, r0)).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { P.toast('danger', 'Не вдалося відкрити дію', r.error); return; }
      var a = r.item, T = r.threshold, body = '', marks = {};
      marks[a.period] = a.status === 'new' ? 'розбір, у якому частка понад ' + T + '%' : 'розбір дії';
      if (a.resultPeriod != null) marks[a.resultPeriod] = 'перевірка дії — перший повний розбір після впровадження';
      if (a.after != null) {
        var ok = a.status === 'helped';
        body += '<div class="kd-res kd-res--' + (ok ? 'ok' : 'relapse') + '"><span class="kd-res__state">' + H.kdState(ok ? 'done' : 'relapse') + '</span>' +
          '<b class="kd-res__nums">' + K.pct(a.rate) + ' → ' + K.pct(a.after) + '</b>' +
          '<span class="kd-res__thr">після: ' + K.pct(a.after) + (ok ? ' ≤ ' : ' > ') + T + '% (поріг)</span>' +
          '<dl class="kd-dl"><dt>До</dt><dd>розбір ' + esc(K.range(a.periodStart, a.periodEnd)) + ' — ' + K.num(a.pieces) + ' шт з ' + K.num(a.checked) + ' перевірених</dd>' +
          '<dt>Після</dt><dd>розбір ' + esc(K.range(a.afterStart, a.afterEnd)) + ' — ' + K.num(a.afterPieces) + ' шт з ' + K.num(a.afterChecked) + ' перевірених</dd></dl></div>';
      } else body += K.formula(formulaOf(a, T), T);
      body += chartBlock(a, r, 'рамка — ' + (a.resultPeriod != null ? 'розбір дії й розбір перевірки' : 'розбір дії'));
      if (a.status === 'new') {
        body += '<div class="kd-tiles kd-tiles--2">' + K.tile(K.pct(a.share), 'усього браку відділу за розбір · ' + K.num(a.pieces) + ' з ' + K.num(a.deptRejected) + ' шт') +
          K.tile(String(a.auditsWith), 'аудитів із цим браком · усього аудитів відділу за розбір: ' + a.auditsTotal) + '</div>' +
          (a.trend ? '<p class="kd-trend">' + esc(a.trend.text) + '</p>' : '');
      } else if (a.status === 'not_needed') {
        body += '<div class="facts"><p class="group-label" style="padding:0">Чому не потрібно · записано ' + H.dayShort(a.finishedOn || a.startedAt) + '</p><p style="margin:0">«' + esc(a.notNeededReason) + '»</p></div>';
      } else {
        body += '<div class="facts"><p class="group-label" style="padding:0">' + (a.causes.length > 1 ? 'Причини' : 'Причина') + '</p><p style="margin:0;font-weight:600">' + esc(K.causeText(a)) + '</p>' +
          (a.causeNote ? '<p class="hint">' + esc(a.causeNote) + '</p>' : '') +
          '<p class="group-label" style="padding:6px 0 0">Що робимо</p><p style="margin:0">' + esc(a.plan) + '</p>' +
          (a.whoName ? '<p class="hint">Робить: ' + esc(a.whoName) + '</p>' : '') + '</div>';
        var st1 = 'num-badge num-badge--done', grey = ' style="background:var(--surface-3);color:var(--text-3)"';
        body += '<div class="kd-steps">' +
          '<div><span class="' + st1 + '">1</span><div><b>Почато ' + H.dayShort(a.startedAt) + '</b></div></div>' +
          (a.implementedAt ? '<div><span class="' + st1 + '">2</span><div><b>Впроваджено ' + H.dayShort(a.implementedAt) + '</b></div></div>'
            : '<div><span class="num-badge">2</span><div><b>Термін впровадження — ' + esc(K.wd(a.due)) + '</b>' + (a.overdue ? '<p class="hint">Термін минув ' + H.dayShort(a.due) + '.</p>' : '') + '</div></div>') +
          (a.status === 'check' ? '<div><span class="num-badge">3</span><div><b>Перевірка — розбір ' + esc(K.range(a.checkStart, a.checkEnd)) + '</b>' +
            (a.interim ? '<p class="hint">У розборі, що триває: ' + K.pct(a.interim.rate) + ' · ' + K.num(a.interim.pieces) + ' шт з ' + K.num(a.interim.checked) + ' перевірених.</p>' : '') + '</div></div>'
            : a.after != null ? '<div><span class="' + st1 + '">3</span><div><b>Перевірено — розбір ' + esc(K.range(a.afterStart, a.afterEnd)) + '</b><p class="hint">' + K.pct(a.after) + ' · ' + K.num(a.afterPieces) + ' шт з ' + K.num(a.afterChecked) + ' перевірених</p></div></div>'
              : '<div><span class="num-badge"' + grey + '>3</span><div><b style="color:var(--text-2)">Перевірка — перший повний розбір після впровадження</b></div></div>') + '</div>';
      }
      body += whoBlock(a);
      var foot = '<div class="kd-btns kd-btns--foot">' + (r.canWrite ? K.decisionBtns(a) : '') +
        '<a class="btn btn--quiet btn--sm" href="#/kd/dept/' + encodeURIComponent(a.departmentId) + '?p=' + a.period + '&t=' + encodeURIComponent(a.defectTypeId) + '" data-ov-close>' + P.ic('department', 'ui-icon--sm') + 'Цей вид браку у відділі</a></div>';
      var d = P.sr.drawer({ title: a.name + ' · ' + a.departmentName,
        sub: 'Розбір ' + esc(K.range(a.periodStart, a.periodEnd)) + (a.startedAt && a.status !== 'new' ? ' · почато ' + H.dayShort(a.startedAt) : '') + (a.whoName && a.status !== 'not_needed' ? ' · ' + esc(a.whoName) : '') + ' · ' + H.lvl(a.level),
        head: K.stateBadge(a, r.today), body: body, foot: foot,
        onMount: function (el) { mountChart(el, a, r, marks); },
        on: {
          'kd-all': K.toggleMore,
          start: function () { d.close(); K.openStart(ctx, r0); },
          nn: function () { d.close(); K.openNotNeeded(ctx, r0, a); },
          edit: function () { d.close(); K.openStart(ctx, r0, { edit: true }); },
          impl: function () { d.close(); K.openImplement(ctx, a); },
          'retry-kd': function () { d.close(); K.openStart(ctx, { departmentId: a.departmentId, defectTypeId: a.defectTypeId, period: a.resultPeriod }); }
        } });
    });
  };
})(window);
