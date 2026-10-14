(function (root) {
  'use strict';
  var P = root.P, doc = root.document, esc = P.esc;
  var DAYS = [[1, 'пн'], [2, 'вт'], [3, 'ср'], [4, 'чт'], [5, 'пт'], [6, 'сб'], [0, 'нд']];
  var SOURCE = { 'rule:probe': 'За розкладом', test: 'Пробне з кабінету адміна', daily: 'Денний звіт · надіслати зараз', 'daily-test': 'Денний звіт · пробне', preview: 'Пробне з конструктора розсилок' };
  var STATUS = { pending: ['warn', 'у черзі'], sending: ['info', 'надсилається'], sent: ['ok', 'надіслано'], failed: ['danger', 'не надіслано'], expired: ['', 'застаріло'] };
  var el = null, data = null, editChannel = false, editRule = null, busy = false, timer = null, gen = 0;

  function badge(kind, text) { return '<span class="badge' + (kind ? ' badge--' + kind : '') + '">' + esc(text) + '</span>'; }
  function err(text) { return text ? '<p class="err" role="alert">' + P.ic('error', 'ui-icon--sm') + esc(text) + '</p>' : ''; }
  function minsAgo(iso) { return Math.max(0, Math.floor((Date.parse(data.now) - Date.parse(iso)) / 60000)); }
  function when(iso) { return P.fmt.dayKey(iso) === P.fmt.dayKey(data.now) ? 'сьогодні о ' + P.fmt.time(iso) : P.fmt.dateTime(iso); }
  function everyLabel(n) { return n < 60 ? n + ' хв' : (n / 60) + ' год'; }
  function hourOpts(cur) { var h = ''; for (var i = 0; i < 24; i++) h += '<option value="' + i + '"' + (i === cur ? ' selected' : '') + '>' + (i < 10 ? '0' : '') + i + ':00</option>'; return h; }
  function q(sel) { return el.querySelector(sel); }
  function hb(key) { return P.help ? P.help.btn(key) : ''; }
  function plain(s) { return String(s || '').replace(/\*/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }

  function drawLogin(message) {
    el.innerHTML = head() + '<section class="card cab-mail"><div class="card-head"><h3 class="card-title">Відкрити розсилку</h3></div>' +
      '<p class="hint">Код розсилки — секрет <b>MAIL_ADMIN_CODE</b>, який ви задали в Supabase. Памʼятається лише в цьому браузері.</p>' +
      '<form class="cab-mail__row" data-mail-form="login"><input class="input" type="password" name="code" autocomplete="off" placeholder="Код розсилки" aria-label="Код розсилки" required>' +
      '<button class="btn btn--primary" type="submit">' + P.ic('login', 'ui-icon--sm') + 'Відкрити</button></form>' + err(message) + '</section>';
  }
  function head() {
    return '<div><h2 class="h2">Розсилка в Slack · проба</h2><p class="h2-sub">Повідомлення справді йдуть у Slack — лише в один тестовий канал. ' +
      'Решта тестового сайту — на вигаданих даних.</p></div>';
  }

  function load(quiet) {
    var my = ++gen;
    if (!quiet) el.innerHTML = head() + '<section class="card">' + P.state.loading('Питаю Supabase…') + '</section>';
    return P.mailProbe.call('status').then(function (r) {
      if (my !== gen || !el) return;
      if (!r.ok) {
        if (r.code === 'auth' || r.code === 'setup') { P.mailProbe.clearCode(); drawLogin(r.code === 'auth' ? 'Код не підходить — введіть ще раз.' : r.error); return; }
        if (!quiet) el.innerHTML = head() + '<section class="card">' + P.state.error('Не вдалося отримати стан розсилки', r.error) + '</section>';
        return;
      }
      data = r;
      draw();
    });
  }

  function draw() {
    el.innerHTML = head() + stateCard() + rulesCard() + logCard();
  }
  function stateCard() {
    var s = data.settings, hb = data.heartbeat, beat;
    if (!hb || !hb.lastRunAt) beat = badge('warn', 'ще не спрацьовував') + ' <span class="hint cab-mail__inl">перший запуск — протягом хвилини після встановлення</span>';
    else {
      var m = minsAgo(hb.lastRunAt);
      beat = (m <= 2 ? badge('ok', 'працює') : badge('danger', 'мовчить ' + m + ' хв')) +
        ' <span class="cab-mail__inl">востаннє ' + esc(when(hb.lastRunAt)) + ' · запусків: ' + P.fmt.num(hb.runs) + '</span>';
    }
    var token = data.hasToken ? badge('ok', 'додано') : badge('danger', 'не додано') + ' <span class="hint cab-mail__inl">секрет SLACK_BOT_TOKEN у Supabase</span>';
    var channel;
    if (editChannel || !s.channelId) {
      channel = '<div class="cab-mail__col"><form class="cab-mail__row" data-mail-form="channel"><input class="input" name="channelId" value="' + esc(s.channelId || '') + '" placeholder="ID каналу" aria-label="ID каналу Slack" autocomplete="off" maxlength="20">' +
        '<button class="btn btn--primary btn--sm" type="submit">' + P.ic('save', 'ui-icon--sm') + 'Зберегти</button>' +
        (s.channelId ? '<button class="btn btn--quiet btn--sm" type="button" data-mail-act="channel-cancel">Скасувати</button>' : '') + '</form>' +
        '<span class="hint">ID — у Slack: назва каналу → внизу вкладки About. Бота спершу запросіть у канал: /invite і назва бота.</span><div data-mail-err="channelId"></div></div>';
    } else {
      channel = '<span class="cab-mail__chan"><b>#' + esc(s.channelName || '?') + '</b> <span class="hint cab-mail__inl">' + esc(s.channelId) + '</span>' +
        '<button class="icon-btn" type="button" data-mail-act="channel-edit" aria-label="Змінити канал" title="Змінити канал">' + P.ic('edit') + '</button></span>';
    }
    var on = !s.paused;
    return '<section class="card cab-mail"><div class="card-head"><h3 class="card-title">Стан</h3>' +
      '<button class="btn btn--quiet btn--sm" type="button" data-mail-act="refresh">' + P.ic('refresh', 'ui-icon--sm') + 'Оновити</button></div>' +
      '<dl class="kv cab-mail__kv"><dt>Будильник' + hb('admin.probe.beat') + '</dt><dd>' + beat + '</dd><dt>Ключ бота' + hb('admin.probe.token') + '</dt><dd>' + token + '</dd>' +
      '<dt>Тестовий канал' + hb('admin.probe.channel') + '</dt><dd>' + channel + '</dd>' +
      '<dt>Розсилки' + hb('admin.probe.pause') + '</dt><dd class="cab-mail__chan"><button class="toggle' + (on ? ' toggle--on' : '') + '" type="button" role="switch" aria-checked="' + on + '" aria-label="Розсилки" data-mail-act="pause"></button>' +
      (on ? 'працюють' : badge('warn', 'зупинено') + ' <span class="hint cab-mail__inl">нічого не надсилається</span>') + '</dd></dl>' +
      '<div class="cab-mail__btns"><button class="btn btn--primary" type="button" data-mail-act="test"' + (s.channelId && on ? '' : ' disabled') + '>' + P.ic('notification', 'ui-icon--sm') + 'Надіслати пробне зараз</button>' +
      '<button class="btn btn--quiet" type="button" data-mail-act="forget">' + P.ic('logout', 'ui-icon--sm') + 'Забути код у цьому браузері</button></div>' +
      (!s.channelId ? '<p class="hint">Пробне можна надіслати, щойно задано тестовий канал.</p>' : !on ? '<p class="hint">Пробне можна надіслати, коли розсилки працюють.</p>' : '') +
      '<p class="hint">Станом на ' + esc(P.fmt.time(data.now)) + ' · оновлюється саме раз на 30 секунд.</p></section>';
  }

  function rulesCard() {
    return '<section class="card cab-mail"><div class="card-head"><h3 class="card-title">За розкладом' + hb('admin.probe.rule') + '</h3></div>' +
      '<p class="hint">Підстановки в тексті: ' + data.options.placeholders.map(function (x) { return '{' + esc(x) + '}'; }).join(' ') + ' — київські день, дата й час надсилання.</p>' +
      data.rules.map(function (r) { return editRule === r.id ? ruleForm(r) : ruleView(r); }).join('') + '</section>';
  }
  function ruleView(r) {
    return '<div class="entry"><div class="entry__head"><h4 class="entry__title" style="font-size:17px">' + esc(r.title) + '</h4>' +
      '<button class="toggle' + (r.enabled ? ' toggle--on' : '') + '" type="button" role="switch" aria-checked="' + r.enabled + '" aria-label="' + (r.enabled ? 'Увімкнено' : 'Вимкнено') + ' · ' + esc(r.title) + '" data-mail-act="rule-on" data-id="' + esc(r.id) + '"></button>' +
      '<button class="icon-btn" type="button" data-mail-act="rule-edit" data-id="' + esc(r.id) + '" aria-label="Редагувати правило" title="Редагувати">' + P.ic('edit') + '</button></div>' +
      '<dl class="kv"><dt>Коли</dt><dd>' + esc(r.label) + (r.enabled ? '' : ' · <b>вимкнено</b>') + '</dd>' +
      '<dt>Текст</dt><dd class="cab-mail__tpl">' + esc(r.template) + '</dd>' +
      '<dt>Кнопка</dt><dd>' + (r.link_label ? esc(r.link_label) + ' <span class="hint cab-mail__inl">→ /' + esc(r.link_path || '') + '</span>' : 'без кнопки') + '</dd></dl></div>';
  }
  function ruleForm(r) {
    var every = r.kind !== 'at';
    return '<form class="entry cab-mail__form" data-mail-form="rule" data-id="' + esc(r.id) + '">' +
      '<div class="entry__head"><h4 class="entry__title" style="font-size:17px">' + esc(r.title) + '</h4></div>' +
      '<div class="seg" role="radiogroup" data-f="kind">' +
        '<button class="seg__btn' + (every ? ' seg__btn--on' : '') + '" type="button" aria-pressed="' + every + '" data-mail-act="kind" data-v="every">Кожні N хвилин</button>' +
        '<button class="seg__btn' + (every ? '' : ' seg__btn--on') + '" type="button" aria-pressed="' + !every + '" data-mail-act="kind" data-v="at">Щодня о…</button></div>' +
      '<input type="hidden" name="kind" value="' + (every ? 'every' : 'at') + '">' +
      '<div class="cab-mail__grid"' + (every ? '' : ' hidden') + ' data-kind="every">' +
        '<label class="field"><span class="label">Як часто</span><select class="input" name="every_min">' + data.options.every.map(function (n) {
          return '<option value="' + n + '"' + (n === r.every_min ? ' selected' : '') + '>кожні ' + everyLabel(n) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field" data-f="hours"><span class="label">З</span><select class="input" name="hour_from">' + hourOpts(r.hour_from) + '</select></label>' +
        '<label class="field"><span class="label">До (включно)</span><select class="input" name="hour_to">' + hourOpts(r.hour_to) + '</select></label></div>' +
      '<div class="cab-mail__grid"' + (every ? ' hidden' : '') + ' data-kind="at">' +
        '<label class="field" data-f="at_time"><span class="label">О котрій (Київ)</span><input class="input" type="time" name="at_time" value="' + esc(r.at_time || '18:00') + '"></label></div>' +
      '<div class="field" data-f="days"><span class="label">Дні</span><div class="chips">' + DAYS.map(function (d) {
        var o = (r.days || []).indexOf(d[0]) >= 0;
        return '<button class="chip-pick' + (o ? ' chip-pick--on' : '') + '" type="button" aria-pressed="' + o + '" data-mail-act="day" data-d="' + d[0] + '">' + d[1] + '</button>'; }).join('') + '</div></div>' +
      '<label class="field" data-f="template"><span class="label">Текст повідомлення</span><textarea class="textarea cab-mail__ta" name="template" rows="4" maxlength="1500">' + esc(r.template) + '</textarea></label>' +
      '<div class="chips"><span class="hint">Вставити:</span>' + data.options.placeholders.map(function (x) {
        return '<button class="chip-pick" type="button" data-mail-act="ph" data-v="' + esc(x) + '">{' + esc(x) + '}</button>'; }).join('') + '</div>' +
      '<div class="cab-mail__grid"><label class="field"><span class="label">Кнопка в повідомленні' + hb('admin.probe.link') + '</span><input class="input" name="link_label" value="' + esc(r.link_label || '') + '" maxlength="60" placeholder="порожньо — без кнопки"></label>' +
        '<label class="field" data-f="link_path"><span class="label">Веде на сторінку сайту</span><input class="input" name="link_path" value="' + esc(r.link_path || '') + '" maxlength="200" placeholder="напр. starshyi/ (порожньо — головна)"></label></div>' +
      '<div data-mail-err="form"></div>' +
      '<div class="cab-mail__btns"><button class="btn btn--primary" type="submit">' + P.ic('save', 'ui-icon--sm') + 'Зберегти</button>' +
      '<button class="btn btn--quiet" type="button" data-mail-act="rule-cancel">Скасувати</button></div></form>';
  }

  function logCard() {
    var rows = data.log || [];
    return '<section class="card cab-mail"><div class="card-head"><h3 class="card-title">Журнал · останні ' + rows.length + hb('admin.probe.log') + '</h3></div>' +
      (rows.length ? '<div class="cab-mail__log">' + rows.map(logRow).join('') + '</div>' :
        P.state.empty('notification', 'Ще жодного повідомлення', 'Тут зʼявиться кожне повідомлення: коли поставлено в чергу, чи надіслано, і що відповів Slack.')) + '</section>';
  }
  function logRow(m) {
    var st = STATUS[m.status] || ['', m.status], first = String(m.preview || '').split('\n')[0];
    var info = m.status === 'sent' && m.sent_at ? 'надіслано ' + when(m.sent_at)
      : m.status === 'pending' && m.attempts > 0 ? 'спроба ' + m.attempts + ' з 6 не вдалась · наступна о ' + P.fmt.time(m.next_try_at) : '';
    return '<div class="cab-mail__item"><div class="cab-mail__top"><b>' + esc(P.fmt.dateTime(m.created_at)) + '</b>' +
      '<span class="cab-mail__src">' + esc(SOURCE[m.source] || m.source) + '</span>' + badge(st[0], st[1]) + '</div>' +
      '<p class="cab-mail__prev">' + esc(plain(first)) + '</p>' + (info ? '<p class="hint">' + esc(info) + '</p>' : '') +
      (m.last_error && m.status !== 'sent' ? err(m.last_error) : '') +
      (m.status === 'failed' || m.status === 'expired' ? '<div><button class="btn btn--secondary btn--sm" type="button" data-mail-act="retry" data-id="' + esc(m.id) + '">' + P.ic('refresh', 'ui-icon--sm') + 'Надіслати ще раз</button></div>' : '') + '</div>';
  }

  function showErrors(box, r) {
    if (!box) { P.toast('danger', 'Не вийшло', r.error); return; }
    var list = r.errors && r.errors.length ? r.errors : [{ message: r.error }];
    box.innerHTML = list.map(function (e) { return err(e.message); }).join('');
  }
  function sentToast(r, what) {
    if (r.ok && r.sent) P.toast('ok', what + ' — надіслано в #' + (r.channelName || 'канал'), 'Перевірте тестовий канал у Slack.');
    else if (r.ok) P.toast('warn', what + ' — у черзі', (r.warning ? r.warning + ' ' : '') + 'Надішлеться автоматично — натискати ще раз не треба.');
    else P.toast('danger', what + ' не надіслано', r.error);
  }
  function act(t, fn) {
    if (busy) return;
    busy = true; t.disabled = true;
    return fn().then(function (x) { busy = false; if (doc.body.contains(t)) t.disabled = false; return x; });
  }
  function ruleData(form) {
    var g = function (n) { var i = form.querySelector('[name="' + n + '"]'); return i ? i.value : ''; };
    var days = Array.prototype.map.call(form.querySelectorAll('[data-mail-act="day"][aria-pressed="true"]'), function (b) { return +b.getAttribute('data-d'); });
    var cur = data.rules.filter(function (r) { return r.id === form.getAttribute('data-id'); })[0];
    return { enabled: cur.enabled, kind: g('kind'), every_min: +g('every_min'), at_time: g('at_time'), days: days,
      hour_from: +g('hour_from'), hour_to: +g('hour_to'), template: g('template'), link_label: g('link_label'), link_path: g('link_path') };
  }
  function saveRule(id, rule, t, okText) {
    return act(t, function () {
      return P.mailProbe.call('saveRule', { id: id, rule: rule }).then(function (r) {
        if (!r.ok) { showErrors(editRule ? q('[data-mail-err="form"]') : null, r); return; }
        editRule = null;
        P.toast('ok', okText || 'Правило збережено', r.label + (r.enabled ? '' : ' · вимкнено'));
        load(true);
      });
    });
  }

  function onClick(e) {
    var t = e.target.closest('[data-mail-act]');
    if (!t || !el.contains(t)) return;
    var a = t.getAttribute('data-mail-act');
    if (a === 'refresh') { load(); return; }
    if (a === 'forget') { P.mailProbe.clearCode(); data = null; drawLogin(''); P.toast('ok', 'Код розсилки забуто в цьому браузері'); return; }
    if (a === 'channel-edit') { editChannel = true; draw(); var i = q('[name="channelId"]'); if (i) i.focus(); return; }
    if (a === 'channel-cancel') { editChannel = false; draw(); return; }
    if (a === 'rule-edit') { editRule = t.getAttribute('data-id'); draw(); return; }
    if (a === 'rule-cancel') { editRule = null; draw(); return; }
    if (a === 'day') { var on = t.getAttribute('aria-pressed') !== 'true'; t.setAttribute('aria-pressed', on); t.classList.toggle('chip-pick--on', on); return; }
    if (a === 'kind') {
      var form = t.closest('form'), v = t.getAttribute('data-v');
      form.querySelector('[name="kind"]').value = v;
      Array.prototype.forEach.call(form.querySelectorAll('[data-mail-act="kind"]'), function (b) { var o = b === t; b.classList.toggle('seg__btn--on', o); b.setAttribute('aria-pressed', o); });
      Array.prototype.forEach.call(form.querySelectorAll('[data-kind]'), function (g) { g.hidden = g.getAttribute('data-kind') !== v; });
      return;
    }
    if (a === 'ph') {
      var ta = t.closest('form').querySelector('[name="template"]'), ins = '{' + t.getAttribute('data-v') + '}';
      var s0 = ta.selectionStart == null ? ta.value.length : ta.selectionStart, s1 = ta.selectionEnd == null ? s0 : ta.selectionEnd;
      ta.value = ta.value.slice(0, s0) + ins + ta.value.slice(s1); ta.focus(); ta.selectionStart = ta.selectionEnd = s0 + ins.length;
      return;
    }
    if (a === 'rule-on') {
      var r = data.rules.filter(function (x) { return x.id === t.getAttribute('data-id'); })[0];
      var rule = { enabled: !r.enabled, kind: r.kind, every_min: r.every_min, at_time: r.at_time, days: r.days, hour_from: r.hour_from, hour_to: r.hour_to,
        template: r.template, link_label: r.link_label, link_path: r.link_path };
      saveRule(r.id, rule, t, rule.enabled ? 'Правило увімкнено' : 'Правило вимкнено');
      return;
    }
    if (a === 'pause') {
      var pause = !data.settings.paused;
      var go = function () {
        act(t, function () {
          return P.mailProbe.call('setPaused', { paused: pause }).then(function (r) {
            if (!r.ok) { P.toast('danger', 'Не вийшло', r.error); return; }
            P.toast('ok', pause ? 'Усі розсилки зупинено' : 'Розсилки знову працюють'); load(true);
          });
        });
      };
      if (!pause) { go(); return; }
      P.confirm({ title: 'Зупинити всі розсилки?', text: 'Будильник працюватиме далі, але нічого не надсилатиме, доки не ввімкнете знову.', okLabel: 'Зупинити', danger: true })
        .then(function (ok) { if (ok) go(); });
      return;
    }
    if (a === 'test') {
      act(t, function () {
        return P.mailProbe.call('sendTest').then(function (r) {
          sentToast(r, 'Пробне');
          load(true);
        });
      });
      return;
    }
    if (a === 'retry') {
      act(t, function () {
        return P.mailProbe.call('retry', { id: +t.getAttribute('data-id') }).then(function (r) {
          sentToast(r, 'Повідомлення');
          load(true);
        });
      });
    }
  }

  function onSubmit(e) {
    var form = e.target.closest('[data-mail-form]');
    if (!form || !el.contains(form)) return;
    e.preventDefault();
    var kind = form.getAttribute('data-mail-form'), btn = form.querySelector('[type="submit"]');
    if (kind === 'login') {
      var c = String(form.querySelector('[name="code"]').value || '');
      act(btn, function () {
        return P.mailProbe.call('status', {}, c).then(function (r) {
          if (!r.ok) { drawLogin(r.code === 'auth' ? 'Код не підходить.' : r.error); return; }
          P.mailProbe.setCode(c); data = r; draw();
        });
      });
    } else if (kind === 'channel') {
      act(btn, function () {
        return P.mailProbe.call('saveChannel', { channelId: form.querySelector('[name="channelId"]').value }).then(function (r) {
          if (!r.ok) { showErrors(q('[data-mail-err="channelId"]'), r); return; }
          editChannel = false; P.toast('ok', 'Тестовий канал: #' + (r.channelName || r.channelId)); load(true);
        });
      });
    } else if (kind === 'rule') {
      saveRule(form.getAttribute('data-id'), ruleData(form), btn);
    }
  }

  function mount(target) {
    el = target; data = null; editChannel = false; editRule = null; busy = false;
    el.addEventListener('click', onClick);
    el.addEventListener('submit', onSubmit);
    if (timer) root.clearInterval(timer);
    timer = root.setInterval(function () {
      if (!el || !doc.body.contains(el)) { root.clearInterval(timer); timer = null; return; }
      if (doc.hidden || busy || editChannel || editRule || !data) return;
      var f = doc.activeElement, typed = el.querySelector('[data-mail-form] input:not([type="hidden"])');
      if ((f && el.contains(f) && /^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName)) || (typed && typed.value !== typed.defaultValue)) return;
      load(true);
    }, 30000);
    if (P.mailProbe.has()) load(); else drawLogin('');
  }

  P.mailPanel = { mount: mount };
})(window);
