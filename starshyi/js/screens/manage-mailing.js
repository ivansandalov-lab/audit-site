(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, M = P.srMg;
  var q = M.q, da = M.da;

  var INCLUDE_LABELS = { checked: 'Перевірено й брак', levels: 'Рівні браку', norms: 'Норма вибірки по відділах', noAudits: 'Відділи без аудитів',
    worst: 'Відділ з найбільшим % браку', topDefects: 'Топ видів браку', kd: 'Коригуючі дії розбору', auditors: 'Аудитори дня', orders: 'Замовлення дня',
    compare: 'Порівняння з учора', link: 'Посилання на кабінет' };
  var MAIL_LEVELS = [['all', 'Усе'], ['defects', 'Тільки з браком'], ['over5', 'Тільки понад 5%']];
  var DAYS = [[1, 'пн'], [2, 'вт'], [3, 'ср'], [4, 'чт'], [5, 'пт'], [6, 'сб'], [0, 'нд']];

  M.section('mailing', 'Розсилки', function (v) {
    var data = null;
    function load() { v.get('srMgMailing', function (r) { data = r; draw(); }); }
    function find(id) { return data.items.filter(function (x) { return x.id === id; })[0]; }
    function entry(m) {
      var off = !m.on;
      return '<div class="entry mg-entry"><div class="entry__head"><h3 class="entry__title" style="font-size:18px' + (off ? ';color:var(--text-3)' : '') + '">' + esc(m.title) + '</h3>' +
        M.sw(m.on, 'mg-mail-on', da('id', m.id), (m.on ? 'Увімкнено' : 'Вимкнено') + ' · ' + m.title) +
        (m.id === 'daily' ? M.pen('mg-mail-edit', da('id', m.id), 'Редагувати денний звіт') : '') + '</div>' +
        '<dl class="kv"><dt>Кому</dt><dd>' + esc(m.to) + '</dd><dt>Коли</dt><dd>' + esc(m.when) + (off ? ' · вимкнено' : '') + '</dd>' +
        (m.hasLevel ? '<dt>Що</dt><dd><span class="pills mg-pills">' + MAIL_LEVELS.map(function (l) {
          return '<button class="pill' + (m.level === l[0] ? ' pill--on' : '') + '" type="button" aria-pressed="' + (m.level === l[0]) + '" data-act="mg-mail-lvl"' + da('id', m.id) + da('v', l[0]) + '>' + esc(l[1]) + '</button>'; }).join('') + '</span></dd>' : '') +
        (m.id === 'daily' ? '<dt>Що</dt><dd>' + esc(m.what) + '</dd>' : '') + '</dl>' +
        (m.id === 'daily' ? '<div class="mg-actions"><button class="btn btn--secondary btn--sm" type="button" data-act="mg-mail-send">' + P.ic('notification', 'ui-icon--sm') + 'Надіслати зараз</button>' +
          '<span class="hint">Востаннє — ' + esc(M.ago(data.lastSent)) + '</span></div>' : '') + '</div>';
    }
    function draw() {
      v.col.innerHTML = M.head('Розсилки', 'Повідомлення в Slack · ' + data.location.name + ' · ' + (real()
        ? 'денний звіт («Надіслати зараз», «Надіслати пробне») справді йде в тестовий канал Slack'
        : 'у тестовій версії нікуди не надсилаються (у Slack — після коду розсилки в кабінеті адміна)')) +
        '<section class="card">' + data.items.map(entry).join('') + '</section>';
    }
    function real() { return !!(P.mailProbe && P.mailProbe.has()); }
    function sendReal(d, test) {
      return P.mailProbe.call('sendDaily', { test: !!test, report: { location: data.location.name, day: data.preview.day, include: d.include, preview: data.preview, to: d.to } });
    }
    function realToast(r, what) {
      if (r.ok && r.sent) P.toast('ok', what + ' — у Slack' + (r.channelName ? ' · #' + r.channelName : ''), 'Тестовий канал. У справжній роботі — ' + data.daily.to.join(', ') + '.');
      else if (r.ok) P.toast('warn', what + ' — у черзі', (r.warning ? r.warning + ' ' : '') + 'Надішлеться автоматично — натискати ще раз не треба.');
      else P.toast('danger', what + ' не надіслано', r.error);
    }
    function previewHtml(d) {
      var p = data.preview, inc = d.include, lines = [];
      function li(html) { lines.push('<p style="margin:0">' + html + '</p>'); }
      if (inc.checked) li(p.audits ? '<b>Перевірено ' + H.num(p.checked) + ' шт · брак ' + H.num(p.rejected) + ' шт (' + H.pct(p.pct) + ')</b>' : '<b>Сьогодні ще жодного аудиту</b>');
      if (inc.levels) li('Рівні: неправильно зроблене ' + H.num(p.byLevel.fix) + ' · пошкоджене ' + H.num(p.byLevel.repair) + ' · зламане ' + H.num(p.byLevel.scrap));
      if (inc.norms) li('Норма вибірки: виконана в ' + p.normsOk + ' ' + M.plural(p.normsOk, ['відділі', 'відділах', 'відділах']) + ' з ' + p.depts);
      if (inc.noAudits) li('Без аудитів сьогодні: ' + esc(p.noAudits.join(', ') || 'таких немає'));
      if (inc.worst) li('Найбільший % браку: ' + (p.worst ? esc(p.worst.name) + ' — ' + H.pct(p.worst.pct) : '—'));
      if (inc.topDefects) li('Топ браку: ' + (p.topDefects.length ? p.topDefects.map(function (x) { return esc(x.name) + ' ' + H.num(x.qty); }).join(' · ') : 'браку не знайдено'));
      if (inc.kd) li(p.kd ? 'Коригуючі дії: ' + p.kd.new + ' ' + M.plural(p.kd.new, ['нова', 'нові', 'нових']) + ' з розбору, ' + p.kd.review + ' на перевірці' : 'Коригуючі дії: зведення з вкладки «Коригуючі дії»');
      if (inc.auditors) li('Аудитори: ' + (p.auditors.length ? p.auditors.map(function (x) { return esc(x.name) + ' ' + x.n; }).join(' · ') : 'ще нікого'));
      if (inc.orders) li('Замовлення: ' + esc(p.orders.join(', ') || '—'));
      if (inc.compare) li('Порівняно з учора: брак ' + H.pct(p.pct) + ' (учора ' + H.pct(p.yesterdayPct) + ')');
      if (inc.link) li('<span style="color:var(--info);text-decoration:underline">Відкрити кабінет цеху</span>');
      return '<div class="mg-slack"><span class="avatar" style="border-radius:10px;width:40px;height:40px">А</span><div class="mg-slack__msg">' +
        '<p style="margin:0"><b>Аудит</b> <span class="hint" style="display:inline">додаток · ' + esc(d.time) + '</span></p>' +
        '<p style="margin:0 0 4px;font-weight:700">Денний звіт · ' + esc(data.location.name) + ' · ' + esc(H.dayLong(p.day)) + '</p>' +
        (lines.length ? lines.join('') : '<p class="hint" style="margin:0">Жодного показника не обрано.</p>') + '</div></div>' +
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
      function headHtml() { return '<span class="hint" data-d-onlabel>' + (on ? 'увімкнено' : 'вимкнено') + '</span>' + M.sw(on, 'mg-d-on', '', on ? 'Розсилку увімкнено' : 'Розсилку вимкнено'); }
      function addTo() {
        var x = String(newTo).trim(); if (!x) return;
        if (d.to.indexOf(x) < 0) d.to.push(x);
        newTo = ''; redraw(); var i = q(layer.el, '[data-d-new]'); if (i) i.focus();
      }
      var layer = M.modal({ title: 'Денний звіт цеху', sub: 'Розсилка в Slack · ' + esc(data.location.name), head: headHtml(),
        body: '', foot: '<span style="flex:1"></span>' +
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
            if (real()) { sendReal(d, true).then(function (r) { t.disabled = false; realToast(r, 'Пробний звіт'); }); return; }
            v.call('srMgMailingSend', { id: 'daily', test: true }).then(function (r) {
              t.disabled = false;
              if (!r.ok) { M.failToast(r); return; }
              P.toast('ok', 'Пробне повідомлення відправлено', 'У тестовій версії — нікуди.');
            });
          },
          'mg-d-save': function (t) {
            if (String(newTo).trim()) addTo();
            t.disabled = true;
            v.call('srMgMailingSave', { id: 'daily', on: on, daily: d }).then(function (r) {
              t.disabled = false;
              if (!r.ok) { M.showErrors(layer.el, r); return; }
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
        if (!r.ok) { t.disabled = false; M.failToast(r); return; }
        P.toast('ok', (r.on ? 'Розсилку увімкнено · ' : 'Розсилку вимкнено · ') + r.title); load();
      });
    });
    v.ctx.on('mg-mail-lvl', function (t) {
      var m = find(t.getAttribute('data-id')), lv = t.getAttribute('data-v');
      if (m.level === lv) return;
      v.call('srMgMailingSave', { id: m.id, level: lv }).then(function (r) {
        if (!v.ctx.alive()) return;
        if (!r.ok) { M.failToast(r); return; }
        P.toast('ok', 'Збережено · ' + r.title, 'Тепер: ' + MAIL_LEVELS.filter(function (l) { return l[0] === r.level; })[0][1].toLowerCase() + '.'); load();
      });
    });
    v.ctx.on('mg-mail-send', function (t) {
      t.disabled = true;
      if (real()) {
        sendReal(data.daily, false).then(function (r) {
          if (!v.ctx.alive()) return;
          t.disabled = false; realToast(r, 'Денний звіт');
          if (r.ok) v.call('srMgMailingSend', { id: 'daily' }).then(function () { if (v.ctx.alive()) load(); });
        });
        return;
      }
      v.call('srMgMailingSend', { id: 'daily' }).then(function (r) {
        if (!v.ctx.alive()) return;
        t.disabled = false;
        if (!r.ok) { M.failToast(r); return; }
        P.toast('ok', 'Денний звіт відправлено о ' + P.fmt.time(r.sentAt), 'У тестовій версії — нікуди.'); load();
      });
    });
    load();
  });
})(window);
