(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, K = P.mgr;
  var DAYS = [[1, 'пн'], [2, 'вт'], [3, 'ср'], [4, 'чт'], [5, 'пт'], [6, 'сб'], [0, 'нд']];
  var DAY_ON = { 0: 'щонеділі', 1: 'щопонеділка', 2: 'щовівторка', 3: 'щосереди', 4: 'щочетверга', 5: 'щопʼятниці', 6: 'щосуботи' };
  var KINDS = [
    { id: 'seniorsWeekly', title: 'Тижневий підсумок роботи старших', what: 'По кожному старшому аудитору за тиждень: відкрито коригуючих дій · впроваджено · днів від відкриття до впровадження, у середньому · брак, % відділу за перший тиждень після впровадження.' },
    { id: 'kdStale', title: 'Коригуюча дія ще не впроваджена', what: 'Повідомлення, коли коригуюча дія відкрита вже N днів, а старший аудитор ще не записав, що її впроваджено.', max: 60 },
    { id: 'deptNoAudits', title: 'Відділ без аудитів', what: 'Повідомлення, коли у відділі N днів поспіль не записали жодного аудиту.', max: 30 },
    { id: 'normMiss', title: 'Норма вибірки не виконується', what: 'Повідомлення, коли відділ N днів поспіль перевіряє менше штук, ніж його норма вибірки.', max: 30 },
    { id: 'relapse', title: 'Рецидив коригуючої дії', what: 'Повідомлення, щойно після впровадженої коригуючої дії брак, % відділу знову понад норму — у першому або другому тижні після впровадження.' },
    { id: 'monthly', title: 'Місячний звіт (PDF)', what: 'Звіт за минулий місяць — по кожній обраній локації окремо, як у вкладці «Звіт за місяць».' }
  ];
  function kindOf(id) { return KINDS.filter(function (x) { return x.id === id; })[0]; }

  function when(id, x) {
    if (id === 'seniorsWeekly') return DAY_ON[x.day] + ' о ' + x.time;
    if (id === 'monthly') return '1-го числа о ' + x.time;
    if (id === 'kdStale') return 'коли коригуюча дія відкрита ' + K.n(x.days, 'день', 'дні', 'днів') + ' і ще не впроваджена';
    if (id === 'deptNoAudits') return 'коли відділ ' + K.n(x.days, 'день', 'дні', 'днів') + ' поспіль без аудитів';
    if (id === 'normMiss') return 'коли норма вибірки не виконується ' + K.n(x.days, 'день', 'дні', 'днів') + ' поспіль';
    return 'щойно зафіксовано рецидив';
  }
  function sw(on, id, title) {
    var label = (on ? 'Увімкнено' : 'Вимкнено') + ' · ' + title;
    return '<button class="toggle mgr-sw' + (on ? ' toggle--on' : '') + '" type="button" role="switch" aria-checked="' + on + '" aria-label="' + esc(label) +
      '" title="' + esc(label) + '" data-act="mgr-r-on" data-id="' + id + '"></button>';
  }
  function pen(id, label) { return '<button class="icon-btn" type="button" data-act="mgr-r-edit" data-id="' + id + '" aria-label="' + esc(label) + '" title="Редагувати">' + P.ic('edit') + '</button>'; }
  function locNames(data, ids) { return data.locations.filter(function (l) { return ids.indexOf(l.id) >= 0; }).map(function (l) { return l.name; }); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function field(f, label, inner, key) { return '<div class="field" data-f="' + f + '"><span class="label">' + esc(label) + (key ? K.help(key) : '') + '</span>' + inner + '</div>'; }
  function showErrors(el, r) {
    Array.prototype.forEach.call(el.querySelectorAll('.mgr-err'), function (e) { e.remove(); });
    var shown = 0;
    (r.errors || []).forEach(function (e) {
      var f = el.querySelector('[data-f="' + e.field + '"]');
      if (f) { f.insertAdjacentHTML('beforeend', '<p class="err mgr-err" role="alert">' + esc(e.message) + '</p>'); shown++; }
    });
    if (!shown) P.toast('danger', 'Не збережено', (r.errors && r.errors[0] ? r.errors[0].message : r.error) || '');
  }

  P.cab.tab({ id: 'reports', label: 'Мої звіти', ic: 'notification', path: '/reports', order: 50 });
  P.cab.screen('/reports', { tab: 'reports', title: 'Мої звіти', render: function (ctx) {
    var data = null;
    function load() {
      P.srv('mgrReports', {}).then(function (r) {
        if (!ctx.alive()) return;
        if (!r.ok) { ctx.el.innerHTML = P.sr.h.error(r); return; }
        data = r; draw();
      });
    }
    function draw() {
      var s = data.settings;
      ctx.el.innerHTML = '<section class="mgr-page mgr-narrow"><div><h2 class="h2">Мої сповіщення в Slack</h2><p class="h2-sub">Про роботу людей і коригуючі дії — що надсилати вам особисто' +
        (s.updatedAt ? ' · збережено ' + esc(P.fmt.dateTime(s.updatedAt)) : '') + '</p></div>' +
        '<div class="banner">' + P.ic('info', 'icon') + '<div class="banner__body"><p class="banner__text"><b>У тестовій версії сповіщення ще не надсилаються</b> — налаштування зберігаються й діятимуть у справжньому додатку.</p></div></div>' +
        '<section class="card">' + KINDS.map(function (k) {
          var x = s[k.id], on = x.on, names = locNames(data, x.locations);
          return '<div class="entry mgr-entry"><div class="entry__head"><h3 class="entry__title' + (on ? '' : ' mgr-off') + '">' + esc(k.title) + K.help('mgr.rep.' + k.id) + '</h3>' +
            sw(on, k.id, k.title) + pen(k.id, 'Редагувати: ' + k.title) + '</div>' +
            '<dl class="kv"><dt>Коли</dt><dd>' + esc(when(k.id, x)) + (on ? '' : ' · вимкнено') + '</dd><dt>Що</dt><dd>' + esc(k.what) + '</dd>' +
            '<dt>Локації' + K.help('mgr.rep.locs') + '</dt><dd>' + esc(names.length === data.locations.length ? 'усі (' + names.join(', ') + ')' : names.join(', ')) + '</dd></dl></div>';
        }).join('') + '</section></section>';
    }
    function save(next, fact, layer, btn) {
      if (btn) btn.disabled = true;
      delete next.updatedAt;
      return P.srv('mgrReportsSave', next).then(function (r) {
        if (btn) btn.disabled = false;
        if (!r.ok) {
          if (r.code === 'validation' && layer) showErrors(layer.el, r);
          else if (r.code !== 'forbidden') P.toast('danger', 'Не вдалося зберегти', (r.errors && r.errors[0] ? r.errors[0].message : r.error) || '');
          return;
        }
        data.settings = r.settings;
        if (layer) layer.close();
        if (ctx.alive()) draw();
        P.toast('ok', 'Збережено · ' + fact);
      });
    }
    function openEdit(id) {
      var k = kindOf(id), next = copy(data.settings), x = next[id];
      function body() {
        var h = '';
        if (id === 'seniorsWeekly') {
          h += field(id + '.day', 'День тижня', '<div class="chips">' + DAYS.map(function (d) {
            var on = x.day === d[0];
            return '<button class="chip-pick' + (on ? ' chip-pick--on' : '') + '" type="button" aria-pressed="' + on + '" data-act="mgr-r-day" data-d="' + d[0] + '">' + d[1] + '</button>'; }).join('') + '</div>');
        }
        if ('time' in x) h += field(id + '.time', 'Час', '<input class="input" type="time" data-r-time value="' + esc(x.time) + '" style="max-width:160px" aria-label="Час">');
        if (id === 'monthly') h += '<p class="hint">Звіт за минулий місяць надходить 1-го числа.</p>';
        if ('days' in x) {
          h += field(id + '.days', 'Скільки днів (N)', '<input class="input" data-r-days inputmode="numeric" value="' + esc(String(x.days)) + '" style="max-width:120px" aria-label="Скільки днів">', 'mgr.rep.days') +
            '<p class="hint">Ціле число від 1 до ' + k.max + '.</p>';
        }
        h += field(id + '.locations', 'Для яких локацій', '<div class="chips">' + data.locations.map(function (l) {
          var on = x.locations.indexOf(l.id) >= 0;
          return '<button class="chip-pick' + (on ? ' chip-pick--on' : '') + '" type="button" aria-pressed="' + on + '" data-act="mgr-r-loc" data-id="' + esc(l.id) + '">' +
            (on ? P.ic('check', 'ui-icon--sm') : '') + esc(l.name) + '</button>'; }).join('') + '</div>', 'mgr.rep.locs') +
          '<p class="hint">Обрано ' + x.locations.length + ' з ' + data.locations.length + '.</p>';
        return '<div class="mgr-form">' + h + '</div>';
      }
      function grab(ly) {
        var time = ly.el.querySelector('[data-r-time]'), days = ly.el.querySelector('[data-r-days]');
        if (time) x.time = time.value;
        if (days) x.days = days.value.trim() === '' ? null : Number(days.value.trim());
      }
      P.sr.modal({ size: 'sm', title: k.title, sub: esc(k.what), body: body(),
        foot: '<span style="flex:1"></span><button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button>' +
          '<button class="btn btn--primary" type="button" data-act="mgr-r-save">' + P.ic('save', 'ui-icon--sm') + 'Зберегти</button>',
        on: {
          'mgr-r-day': function (t, e, ly) { grab(ly); x.day = +t.getAttribute('data-d'); ly.body(body()); },
          'mgr-r-loc': function (t, e, ly) {
            grab(ly);
            var lid = t.getAttribute('data-id'), i = x.locations.indexOf(lid);
            if (i >= 0) x.locations.splice(i, 1); else x.locations.push(lid);
            ly.body(body());
          },
          'mgr-r-save': function (t, e, ly) { grab(ly); save(next, k.title + ': ' + when(id, x) + ' · ' + (locNames(data, x.locations).join(', ') || '—'), ly, t); }
        } });
    }
    ctx.on('mgr-r-on', function (t) {
      var id = t.getAttribute('data-id'), next = copy(data.settings), k = kindOf(id);
      next[id].on = !next[id].on;
      save(next, k.title + (next[id].on ? ' увімкнено' : ' вимкнено'), null, t);
    });
    ctx.on('mgr-r-edit', function (t) { openEdit(t.getAttribute('data-id')); });
    load();
  } });
})(window);
