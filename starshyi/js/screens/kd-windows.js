(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;
  var help = function (k) { return P.help ? P.help.btn(k) : ''; };

  function of(pcs, checked) { return K.num(pcs) + ' шт з ' + K.num(checked) + ' перевірених'; }
  K.formula = function (a, T) {
    return '<p class="kd-formula"><b' + (a.rate != null && a.rate > T ? ' class="kd-hot"' : '') + '>' + K.pct(a.rate) + '</b><span>= ' + K.num(a.rejected) + ' шт браку ÷ ' +
      K.num(a.checked) + ' перевірених у відділі за ' + esc(K.week(a.periodStart, a.periodEnd)) + (a.current ? ' (тиждень триває)' : '') + '</span>' + H.badge('норма ' + T + '%') + '</p>';
  };
  K.itemsTable = function (a, R) {
    if (!a.items.length) return '<p class="kd-text">Браку у відділі за тиждень не записано — пунктів немає.</p>' + openNote(a);
    var hasAfter = a.result != null, hasHold = a.hold != null;
    var res = a.result, ho = a.hold;
    var th = '<tr><th>Вид браку' + help('term.defectType') + '</th><th class="n">частка браку' + help('kd.pareto') + '</th>' +
      '<th class="n">до, %' + help('kd.beforeAfter') + '</th>' + (hasAfter ? '<th class="n">після, %<span class="sub">1-й тиждень · ' + esc(K.rangeShort(res.start, res.end)) + (res.pending ? ' · триває' : '') + '</span></th>' : '') +
      (hasHold ? '<th class="n">після, %<span class="sub">2-й тиждень · ' + esc(K.rangeShort(ho.start, ho.end)) + (ho.pending ? ' · триває' : '') + '</span></th>' : '') + '</tr>';
    var rows = a.items.map(function (it) {
      return '<tr><td><b>' + esc(it.name) + '</b><span class="sub">' + H.lvl(it.level) + '</span></td>' +
        '<td class="n">' + K.pct(it.share) + '<span class="sub">' + K.num(it.pieces) + ' шт · разом ' + K.pct(it.cumShare) + '</span></td><td class="n"><b>' + K.pct(it.before) + '</b></td>' +
        (hasAfter ? '<td class="n"><b>' + (it.after == null ? '—' : (res.pending ? 'поки ' : '') + K.pct(it.after)) + '</b>' +
          (it.delta != null ? '<span class="sub kd-nowrap">' + esc(K.delta(it.before, it.after)) + '</span>' : it.afterPieces != null ? '<span class="sub">' + K.num(it.afterPieces) + ' шт</span>' : '') + '</td>' : '') +
        (hasHold ? '<td class="n">' + (it.after2 == null ? '—' : (ho.pending ? 'поки ' : '') + K.pct(it.after2)) + '</td>' : '') + '</tr>';
    }).join('');
    var sum = a.implementedAt && a.typesBefore != null ? '<tr><td><b>Види дії разом</b><span class="sub">усі пункти разом</span></td><td class="n">' + K.pct(a.itemsShare) + '</td>' +
      '<td class="n"><b>' + K.pct(a.typesBefore) + '</b></td>' +
      (hasAfter ? '<td class="n"><b>' + (a.typesAfter == null ? '—' : (res.pending ? 'поки ' : '') + K.pct(a.typesAfter)) + '</b>' +
        (a.typesAfter != null && !res.pending ? '<span class="sub kd-nowrap">' + esc(K.delta(a.typesBefore, a.typesAfter)) + '</span>' : '') + '</td>' : '') +
      (hasHold ? '<td class="n">' + (a.typesAfter2 == null ? '—' : (ho.pending ? 'поки ' : '') + K.pct(a.typesAfter2)) + '</td>' : '') + '</tr>' : '';
    var from = (a.implementedAt ? a.baseFrom : a.liveFrom) || a.periodStart, to = (a.implementedAt ? a.baseTo : a.liveTo) || a.periodEnd;
    return '<div class="tbl-box"><table class="tbl kd-items">' + '<thead>' + th + '</thead><tbody>' + rows + sum + '</tbody></table></div>' +
      K.cap('Пункти — Парето за ' + esc(K.range(from, to)) + (a.implementedAt ? ' (база «до»)' : '') + ': види браку в порядку ' + esc(K.paretoOrderText(R)) +
        ' (усередині — від більшої кількості шт); вид заходить, лише якщо повністю вміщається в ' + a.pareto + '% браку відділу (тут — ' + K.pct(a.itemsShare) +
        '). % — шт виду браку ÷ перевірено у відділі за ці дні.') + openNote(a);
  };
  function openNote(a) {
    return K.isOpen(a) ? '<p class="hint">Список видів браку ще може змінитися до запису плану.</p>' + K.changesLog(a) : '';
  }
  K.changesLog = function (a) {
    var ch = (a.changes || []).slice().reverse(), pc = function (x) { return esc(x.name) + ' (' + K.num(x.pieces) + ' шт)'; };
    if (!ch.length) return '';
    return '<div class="kd-chg" data-kd-more><p class="kd-sec">Зміни списку видів браку' + help('kd.changes') + '</p><ul class="kd-chg__l">' + ch.map(function (c, i) {
      var what = [(c.added || []).length ? 'додано: ' + c.added.map(pc).join(', ') : '', (c.removed || []).length ? 'вибуло: ' + c.removed.map(pc).join(', ') : ''].filter(Boolean).join('; ');
      return '<li' + (i >= 3 ? ' class="kd-x"' : '') + '><b>' + esc(K.wd(c.day)) + '</b> — ' + what + '</li>';
    }).join('') + '</ul>' + K.moreBtn(ch.length, 3, 'Показати всі') + '</div>';
  };
  var VERDICT = { norm: 'відділ у нормі', types_lower: 'відділ понад норму, але види дії разом нижче, ніж до дії', relapse: 'рецидив' };
  K.decideFacts = function (a, T) {
    if (a.status !== 'decide') return '';
    var s = a.earlySplit, part = function (x) { return x ? '<b>' + K.pct(x.rate) + '</b> (' + K.num(x.rejected) + ' шт з ' + K.num(x.checked) + ')' : '—'; };
    return '<div class="kd-dec"><p class="kd-dec__t">' + H.kdState('decide') + help('kd.state.decide') + '</p>' +
      '<p class="kd-dec__nums">З початку тижня до дня відкриття (' + esc(K.wd(a.openedAt)) + '): ' + part(s && s.before) + ' → після: ' + part(s && s.after) +
      ' → тиждень: <b>' + K.pct(a.weekRate) + '</b> (' + K.num(a.rejected) + ' шт з ' + K.num(a.checked) + ') · норма ' + T + '%</p>' +
      '<p class="hint">Оберіть: «Дія не потрібна — разовий випадок» (з причиною) або «Робимо дію» — далі як звичайна КД «понад норму, не почато».</p></div>';
  };
  K.keep = function (ctx, t) {
    t.disabled = true;
    P.srv('srKdKeep', { locationId: ctx.loc.id, key: t.getAttribute('data-key') }).then(function (res) {
      t.disabled = false;
      if (!res.ok) { P.toast('danger', 'Не вдалося записати рішення', res.error); return; }
      var x = res.action;
      K.done(ctx, 'ok', 'Рішення записано: робимо дію · ' + x.departmentName + ' · ' + K.week(x.periodStart, x.periodEnd), 'Стан — ' + K.stateLabel(x.state) + '. Далі — впроваджений план.');
    });
  };
  K.obsSteps = function (a, T) {
    var done = 'num-badge num-badge--done', grey = ' style="background:var(--surface-3);color:var(--text-3)"';
    var step = function (n, on, title, text) {
      return '<div><span class="' + (on === 'done' ? done : 'num-badge') + '"' + (on === 'wait' ? grey : '') + '>' + n + '</span><div><b' + (on === 'wait' ? ' style="color:var(--text-2)"' : '') + '>' + title + '</b>' +
        (text ? '<p class="hint">' + text + '</p>' : '') + '</div></div>';
    };
    var wk = function (w, label, verdict, types) {
      if (!w) return '';
      if (w.future) return label + ' почнеться ' + esc(K.wd(w.start)) + '.';
      if (w.pending) return 'Тиждень триває (день ' + w.daysDone + ' з ' + w.days + '): поки ' + K.pct(w.rate) + ' · ' + of(w.rejected, w.checked) + '.';
      return 'Брак, % відділу ' + K.pct(w.rate) + ' · ' + of(w.rejected, w.checked) + ' — ' + (w.rate > T ? 'понад норму ' : 'не вище норми ') + T + '%.' +
        (types != null && a.typesBefore != null ? ' Види дії разом: ' + K.pct(a.typesBefore) + ' до дії → ' + K.pct(types) + '.' : '') +
        (VERDICT[verdict] ? ' <b>Тиждень: ' + VERDICT[verdict] + '.</b>' : '');
    };
    var html = step(1, 'done', 'Відкрито ' + esc(K.wd(a.openedAt)) + (a.early ? ' · ранній тумблер' : ' · розбір'),
      'Брак, % відділу за ' + esc(K.week(a.periodStart, a.periodEnd)) + (a.current ? ' (тиждень триває)' : '') + ': ' + K.pct(a.rate) + ' · ' + of(a.rejected, a.checked) +
      (a.earlyBelow ? ' — тиждень завершився не вище норми ' + T + '%' : '') + '.');
    if (a.status === 'not_needed') return '<div class="kd-steps">' + html + step(2, 'done', 'Дія не потрібна · ' + esc(H.dayShort(a.notNeededAt)), '«' + esc(a.notNeededReason) + '»') + '</div>';
    if (!a.implementedAt) {
      var grow = a.openRate != null || a.nowRate != null ? 'Брак, % відділу від початку тижня відкриття: до дня відкриття ' + K.pct(a.openRate) +
        (a.nowRate != null ? ' → до сьогодні ' + K.pct(a.nowRate) : '') + '.' : '';
      var sp = a.earlySplit;
      if (a.status === 'pre') html += step(2, 'now', 'Тиждень ще йде', (sp ? 'Після дня відкриття, поки: ' + K.pct(sp.after.rate) + ' · ' + of(sp.after.rejected, sp.after.checked) + '. ' : '') +
        'Коли тиждень закінчиться: брак, % відділу за тиждень понад норму ' + T + '% — звичайна КД; не вище — «потрібне рішення».');
      if (a.status === 'decide') html += step(2, 'now', 'Потрібне рішення: тиждень завершився в нормі', 'Брак, % відділу за тиждень — ' + K.pct(a.weekRate) + ', норма ' + T + '%.');
      var n = a.status === 'pre' || a.status === 'decide' ? 3 : 2;
      return '<div class="kd-steps">' + html + step(n, a.status === 'decide' ? 'wait' : 'now', 'Впроваджений план — ще не записано',
        [grow, a.overWeeks >= 2 ? 'Понад норму ' + K.plural(a.overWeeks, 'тиждень', 'тижні', 'тижнів') + ' поспіль.' : ''].filter(Boolean).join(' ')) +
        step(n + 1, 'wait', 'Перший тиждень після впровадження', 'Перший повний тиждень, що почнеться в день впровадження або пізніше.') + '</div>';
    }
    html += step(2, 'done', 'Впроваджено ' + esc(K.wd(a.implementedAt)), 'Через ' + K.plural(a.daysToImplement, 'день', 'дні', 'днів') + ' після відкриття.');
    var r = a.result, h = a.hold;
    html += step(3, r.pending ? 'now' : 'done', 'Перший тиждень після впровадження · ' + esc(K.range(r.start, r.end)), wk(r, 'Перший тиждень після впровадження', a.week1Verdict, a.typesAfter));
    if (a.relapseStage === 1) return '<div class="kd-steps">' + html + '</div>';
    html += h ? step(4, h.pending ? 'now' : 'done', 'Другий тиждень після впровадження · ' + esc(K.range(h.start, h.end)), wk(h, 'Другий тиждень після впровадження', a.week2Verdict, a.typesAfter2))
      : step(4, 'wait', 'Другий тиждень після впровадження', 'Наступний тиждень після першого.');
    return '<div class="kd-steps">' + html + '</div>';
  };
  function chartBlock(a, T) {
    return '<div class="facts"><p class="group-label" style="padding:0">Брак відділу по тижнях, %</p>' +
      K.cap('Відділ «' + esc(a.departmentName) + '», тижні ' + esc(K.spanOf(a.series)) + '. Рамка — тиждень КД; ● — тиждень, за який відкрито КД (колір — стан); риска — норма ' + T + '%.') +
      '<div data-chart="kd-item"></div></div>';
  }
  function mountChart(el, a, T) {
    var sel = {}; sel[a.period] = 'тиждень КД';
    if (a.result && !a.result.future) sel[a.result.n] = '1-й тиждень після впровадження';
    if (a.hold && !a.hold.future) sel[a.hold.n] = '2-й тиждень після впровадження';
    K.deptChart(el.querySelector('[data-chart="kd-item"]'), a.series, { sel: sel, T: T, height: 150, label: 'Брак відділу «' + a.departmentName + '» по тижнях, %' });
  }
  function whoBlock(a) {
    var per = esc(K.rangeShort(a.periodStart, a.periodEnd));
    return '<div class="facts"><p class="group-label" style="padding:0">У кого брак · тиждень ' + per + '</p>' + K.who(K.workerRows(a.workers), { empty: 'Винних у записах не вказано' }) +
      '<p class="group-label" style="padding:6px 0 0">Хто записує · тиждень ' + per + '</p>' + K.who(K.auditorRows(a.auditors), { empty: 'Записів немає' }) + '</div>';
  }

  K.openPlan = function (ctx, r0, opts) {
    opts = opts || {};
    P.srv('srKdItem', Object.assign({ locationId: ctx.loc.id }, r0)).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { P.toast('danger', 'Не вдалося відкрити КД', r.error); return; }
      var a = r.item, T = r.threshold, edit = !!opts.edit, picked = edit ? a.causes.slice() : [], lockDay = edit && a.status !== 'check';
      var left = '<div class="col" style="flex-basis:440px"><h3 class="card-title">' + esc(a.departmentName) + ' · ' + esc(K.week(a.periodStart, a.periodEnd)) + '</h3>' +
        K.formula(a, T) + '<p class="hint">Відкрито ' + esc(K.wd(a.openedAt)) + (a.early ? ' за раннім тумблером' : ' на розборі') + '.</p>' +
        '<p class="group-label" style="padding:0">Пункти КД' + help('kd.pareto') + '</p>' + K.itemsTable(a, r.rules) + chartBlock(a, T) + whoBlock(a) + '</div>';
      var right = '<div class="col" style="flex-basis:480px">' +
        '<div class="field"><span class="label"><span class="num-badge" style="margin-right:8px">1</span>Причина</span>' +
        '<p class="hint">Можна кілька — перша обрана записується як головна.</p><div class="kd-chips" data-causes></div>' + K.errSlot('causes') + '</div>' +
        '<label class="field" data-note-wrap style="display:none"><span class="label">Пояснення до причини «Інше»</span><input class="input" data-f="causeNote" maxlength="300" value="' + esc(a.causeNote) + '" placeholder="Що саме сталося">' + K.errSlot('causeNote') + '</label>' +
        '<label class="field"><span class="label"><span class="num-badge" style="margin-right:8px">2</span>Що зроблено</span>' +
        '<textarea class="textarea" data-f="plan" maxlength="1000" style="min-height:96px" placeholder="Наприклад: замінили голки на машинах 3 і 5, показали працівникові, як закріплювати шов.">' + esc(a.plan) + '</textarea>' + K.errSlot('plan') + '</label>' +
        '<div class="pair"><label class="field"><span class="label">Хто відповідає</span><select class="input" data-f="who">' + r.people.map(function (u) {
          var sel = edit ? u.id === a.who : u.me;
          return '<option value="' + esc(u.id) + '"' + (sel ? ' selected' : '') + '>' + esc(u.name) + (u.me ? ' (я)' : ' · ' + u.roleLabel.toLowerCase()) + '</option>'; }).join('') +
        '</select>' + K.errSlot('who') + '</label>' +
        '<label class="field"><span class="label">Дата впровадження' + help('kd.implDay') + '</span><input class="input" type="date" data-f="day" min="' + esc(a.openedAt) + '" max="' + esc(r.today) + '" value="' +
          esc(edit ? a.implementedAt : r.today) + '"' + (lockDay ? ' disabled' : '') + '>' + (lockDay ? '<span class="hint">Перший тиждень після впровадження вже закінчився — дату не змінити.</span>' : '') + K.errSlot('day') + '</label></div>' +
        '<div class="banner" style="align-items:center">' + P.ic('info') + '<div class="banner__body"><p class="banner__title"><span class="num-badge" style="width:24px;height:24px;margin-right:6px">3</span>Далі — два тижні спостереження</p>' +
        '<p class="banner__text">Перший тиждень після впровадження — перший повний тиждень, що почнеться в день впровадження або пізніше.<br>' +
        'Брак, % відділу до ' + T + '% включно → тиждень «у нормі»; понад ' + T + '%, а види дії разом нижче, ніж до дії, → «її види нижче, ніж до дії»; понад ' + T + '% і види дії разом не нижче, ніж до дії, → рецидив ✕.<br>' +
        'Два тижні без рецидиву: обидва в нормі → «закрито: тримається»; інакше → «закрито: її види браку нижче, ніж до дії».<br>' +
        'Пункти зафіксуються на дату впровадження.</p></div></div></div>';
      var m = P.sr.modal({
        title: (edit ? 'Змінити план · ' : 'Впроваджений план · ') + a.departmentName,
        sub: esc(K.week(a.periodStart, a.periodEnd)) + ' · брак ' + K.pct(a.rate) + ' (' + of(a.rejected, a.checked) + ') · ' + K.plural(a.items.length, 'пункт', 'пункти', 'пунктів'),
        head: '<span class="kd-head-badge">' + H.badge(K.pct(a.rate) + ' · норма ' + T + '%', a.rate > T ? 'danger' : '') + '</span>',
        body: '<div class="row kd-cols">' + left + right + '</div>',
        foot: '<p class="action-bar__sum kd-foot-note">Одна КД — відділ за тиждень; пункти — види браку з таблиці.</p>' +
          '<button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button>' +
          '<button class="btn btn--primary" type="button" data-act="save">' + P.ic(edit ? 'save' : 'check') + (edit ? 'Зберегти план' : 'Записати впроваджений план') + '</button>',
        on: {
          'kd-all': K.toggleMore,
          cause: function (t) {
            var id = t.getAttribute('data-id'), i = picked.indexOf(id);
            if (i >= 0) picked.splice(i, 1); else picked.push(id);
            drawCauses(m.el);
          },
          save: function (t) {
            var el = m.el, val = function (f) { return el.querySelector('[data-f="' + f + '"]').value; };
            var payload = { locationId: ctx.loc.id, causes: picked.slice(), causeNote: val('causeNote'), plan: val('plan'), who: val('who'), day: lockDay ? null : val('day') };
            Object.assign(payload, edit ? { id: a.id } : { departmentId: a.departmentId, period: a.period });
            t.disabled = true;
            P.srv(edit ? 'srKdEditPlan' : 'srKdImplement', payload).then(function (res) {
              t.disabled = false;
              if (!res.ok) { if (!K.showErrors(el, res)) P.toast('danger', 'Не вдалося зберегти', res.error); return; }
              m.close();
              var x = res.action;
              K.done(ctx, 'ok', (edit ? 'План змінено · ' : 'Впроваджений план записано · ') + x.departmentName + ' · ' + K.week(x.periodStart, x.periodEnd),
                'Впроваджено ' + H.dayShort(x.implementedAt) + (x.result ? ' · 1-й тиждень після: ' + K.rangeShort(x.result.start, x.result.end) : '') + (x.whoName ? ' · ' + x.whoName : ''));
            });
          }
        },
        onMount: function (el) { drawCauses(el); mountChart(el, a, T); }
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
    var m = P.sr.modal({ size: 'sm', title: (editing ? 'Змінити причину · ' : 'Дія не потрібна · ') + (a ? a.departmentName : ''),
      sub: a ? esc(K.week(a.periodStart, a.periodEnd)) + ' · брак ' + esc(K.pct(a.rate)) : '',
      body: '<p class="kd-text">' + (editing ? 'Причину видно в картці КД та в списку КД.'
        : 'КД отримає стан «дія не потрібна», поруч — ця причина. Якщо наступного тижня брак, % відділу знову буде понад норму, відкриється нова КД.') + '</p>' +
        '<label class="field"><span class="label">Чому дія не потрібна</span><textarea class="textarea" data-f="reason" maxlength="300" style="min-height:80px" placeholder="Наприклад: разовий збій машини — полагодили того ж дня.">' +
          esc(editing ? a.notNeededReason : a && a.status === 'decide' ? 'Разовий випадок' : '') + '</textarea>' + K.errSlot('reason') + '</label>',
      foot: '<button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button><button class="btn btn--primary" type="button" data-act="ok" style="margin-left:auto">' + (editing ? 'Зберегти причину' : 'Позначити «не потрібно»') + '</button>',
      on: { ok: function (t) {
        t.disabled = true;
        P.srv('srKdNotNeeded', Object.assign({ locationId: ctx.loc.id, reason: m.el.querySelector('[data-f="reason"]').value }, r0)).then(function (res) {
          t.disabled = false;
          if (!res.ok) { if (!K.showErrors(m.el, res)) P.toast('danger', 'Не вдалося зберегти', res.error); return; }
          m.close();
          var x = res.action;
          K.done(ctx, 'ok', (editing ? 'Причину змінено · ' : 'Позначено «дія не потрібна» · ') + x.departmentName + ' · ' + K.week(x.periodStart, x.periodEnd), '«' + x.notNeededReason + '»');
        });
      } } });
  };

  K.openDrawer = function (ctx, r0) {
    P.srv('srKdItem', Object.assign({ locationId: ctx.loc.id }, r0)).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { P.toast('danger', 'Не вдалося відкрити КД', r.error); return; }
      var a = r.item, T = r.threshold, body = '';
      if (a.after != null) {
        var st = P.sr.kdStateOf(a.status);
        body += '<div class="kd-res kd-res--' + (a.relapseStage ? 'relapse' : 'ok') + '"><span class="kd-res__state">' + H.kdState(st) + '</span>' +
          '<b class="kd-res__nums">' + esc(K.rates(a)) + '</b><span class="kd-res__thr">брак, % відділу: тиждень КД → 1-й тиждень після впровадження' + (a.after2 != null ? ' → 2-й тиждень після' : '') + ' · норма ' + T + '%</span></div>';
      } else body += K.formula(a, T) + K.decideFacts(a, T);
      body += '<div class="facts"><p class="group-label" style="padding:0">Хід КД' + help('kd.steps') + '</p>' + K.obsSteps(a, T) + '</div>';
      body += '<div class="facts"><p class="group-label" style="padding:0">Пункти КД · до → після' + help('kd.beforeAfter') + '</p>' + K.itemsTable(a, r.rules) + '</div>';
      if (a.implementedAt) body += '<div class="facts"><p class="group-label" style="padding:0">' + (a.causes.length > 1 ? 'Причини' : 'Причина') + '</p><p style="margin:0;font-weight:600">' + esc(K.causeText(a)) + '</p>' +
        (a.causeNote ? '<p class="hint">' + esc(a.causeNote) + '</p>' : '') + '<p class="group-label" style="padding:6px 0 0">Що зроблено</p><p style="margin:0">' + esc(a.plan) + '</p>' +
        (a.whoName ? '<p class="hint">Відповідає: ' + esc(a.whoName) + '</p>' : '') + '</div>';
      body += chartBlock(a, T) + whoBlock(a);
      var foot = '<div class="kd-btns kd-btns--foot">' + (r.canWrite ? K.decisionBtns(a) : '') +
        '<a class="btn btn--quiet btn--sm" href="#/kd/dept/' + encodeURIComponent(a.departmentId) + '?p=' + a.period + '" data-ov-close>' + P.ic('department', 'ui-icon--sm') + 'Відділ за цей тиждень</a></div>';
      var d = P.sr.drawer({ title: 'КД · ' + a.departmentName, sub: esc(K.range(a.periodStart, a.periodEnd)) + ' · відкрито ' + H.dayShort(a.openedAt) + (a.whoName && a.implementedAt ? ' · ' + esc(a.whoName) : ''),
        head: '<span class="kd-dhead">' + K.stateBadge(a) + K.earlyBadge(a) + '</span>', body: body, foot: foot,   // v2.2: довгий стан не стискає назву
        onMount: function (el) { mountChart(el, a, T); },
        on: {
          'kd-all': K.toggleMore,
          impl: function () { d.close(); K.openPlan(ctx, r0); },
          edit: function () { d.close(); K.openPlan(ctx, r0, { edit: true }); },
          nn: function () { d.close(); K.openNotNeeded(ctx, r0, a); },
          keep: function (t) { d.close(); K.keep(ctx, t); }
        } });
    });
  };
})(window);
