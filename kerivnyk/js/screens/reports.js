(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, K = P.mgr;
  var DAYS = [[1, 'пн'], [2, 'вт'], [3, 'ср'], [4, 'чт'], [5, 'пт'], [6, 'сб'], [0, 'нд']];
  var DAY_ON = { 0: 'щонеділі', 1: 'щопонеділка', 2: 'щовівторка', 3: 'щосереди', 4: 'щочетверга', 5: 'щопʼятниці', 6: 'щосуботи' };
  var KINDS = [
    { id: 'daily', title: 'Денний звіт по локаціях', what: 'Перевірено, брак шт і %, рівні браку — по кожній обраній локації за день.' },
    { id: 'weekly', title: 'Тижневий підсумок', what: 'Підсумок тижня по локаціях і відділах: перевірено, брак шт і %, найчастіші види браку.' },
    { id: 'monthly', title: 'Місячний звіт', what: 'Зведення за минулий місяць — те саме, що у вкладці «Звіт за місяць».' },
    { id: 'alert', title: 'Сигнал «брак понад поріг»', what: 'Повідомлення, щойно брак локації за день стане понад поріг.' }
  ];

  function when(id, s) {
    var x = s[id];
    if (id === 'daily') return 'щодня о ' + x.time;
    if (id === 'weekly') return DAY_ON[x.day] + ' о ' + x.time;
    if (id === 'monthly') return '1-го числа о ' + x.time;
    return 'брак локації за день понад ' + H.pct(x.pct);
  }
  function sw(on, id, title) {
    var label = (on ? 'Увімкнено' : 'Вимкнено') + ' · ' + title;
    return '<button class="toggle mgr-sw' + (on ? ' toggle--on' : '') + '" type="button" role="switch" aria-checked="' + on + '" aria-label="' + esc(label) +
      '" title="' + esc(label) + '" data-act="mgr-r-on" data-id="' + id + '"></button>';
  }
  function pen(act, id, label) { return '<button class="icon-btn" type="button" data-act="' + act + '" data-id="' + id + '" aria-label="' + esc(label) + '" title="Редагувати">' + P.ic('edit') + '</button>'; }
  function locNames(data, ids) { return data.locations.filter(function (l) { return ids.indexOf(l.id) >= 0; }).map(function (l) { return l.name; }); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function field(f, label, inner) { return '<div class="field" data-f="' + f + '"><span class="label">' + esc(label) + '</span>' + inner + '</div>'; }
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
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        data = r; draw();
      });
    }
    function draw() {
      var s = data.settings, names = locNames(data, s.locations);
      ctx.el.innerHTML = '<section class="mgr-page mgr-narrow"><div><h2 class="h2">Мої звіти в Slack</h2><p class="h2-sub">Що надсилати вам особисто · ' +
        esc(names.length === data.locations.length ? 'усі локації' : names.join(', ')) + (s.updatedAt ? ' · збережено ' + esc(P.fmt.dateTime(s.updatedAt)) : '') + '</p></div>' +
        '<div class="banner">' + P.ic('info', 'icon') + '<div class="banner__body"><p class="banner__text"><b>У тестовій версії звіти ще не надсилаються</b> — налаштування зберігаються й діятимуть у справжній.</p></div></div>' +
        '<section class="card">' + KINDS.map(function (k) {
          var on = s[k.id].on;
          return '<div class="entry mgr-entry"><div class="entry__head"><h3 class="entry__title' + (on ? '' : ' mgr-off') + '">' + esc(k.title) + '</h3>' +
            sw(on, k.id, k.title) + pen('mgr-r-edit', k.id, 'Редагувати: ' + k.title) + '</div>' +
            '<dl class="kv"><dt>Коли</dt><dd>' + esc(when(k.id, s)) + (on ? '' : ' · вимкнено') + '</dd><dt>Що</dt><dd>' + esc(k.what) + '</dd></dl></div>';
        }).join('') + '</section>' +
        '<section class="card"><div class="entry mgr-entry"><div class="entry__head"><h3 class="entry__title">Для яких локацій</h3>' + pen('mgr-r-locs', 'locations', 'Змінити локації') + '</div>' +
        '<p class="hint">Усі звіти й сигнал — лише про ці локації.</p><div class="chips">' + names.map(function (n) {
          return '<span class="chip chip--plain">' + P.ic('location', 'ui-icon--sm') + esc(n) + '</span>'; }).join('') + '</div></div></section></section>';
    }
    function save(next, fact, layer, btn) {
      if (btn) btn.disabled = true;
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
      var k = KINDS.filter(function (x) { return x.id === id; })[0], next = copy(data.settings), x = next[id];
      function body() {
        if (id === 'alert') {
          return field('alert.pct', 'Поріг браку, %', '<input class="input" data-r-pct inputmode="decimal" value="' + esc(String(x.pct).replace('.', ',')) + '" style="max-width:160px" aria-label="Поріг браку, %">') +
            '<p class="hint">Брак локації за день = штуки браку ÷ перевірені штуки. Від 0,5 до 50.</p>';
        }
        return (id === 'weekly' ? field('weekly.day', 'День тижня', '<div class="chips">' + DAYS.map(function (d) {
          var on = x.day === d[0];
          return '<button class="chip-pick' + (on ? ' chip-pick--on' : '') + '" type="button" aria-pressed="' + on + '" data-act="mgr-r-day" data-d="' + d[0] + '">' + d[1] + '</button>'; }).join('') + '</div>') : '') +
          field(id + '.time', 'Час', '<input class="input" type="time" data-r-time value="' + esc(x.time) + '" style="max-width:160px" aria-label="Час">') +
          (id === 'monthly' ? '<p class="hint">Звіт за минулий місяць надходить 1-го числа.</p>' : '');
      }
      var layer = P.sr.modal({ size: 'sm', title: k.title, sub: esc(k.what), body: '<div class="mgr-form">' + body() + '</div>',
        foot: '<span style="flex:1"></span><button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button>' +
          '<button class="btn btn--primary" type="button" data-act="mgr-r-save">' + P.ic('save', 'ui-icon--sm') + 'Зберегти</button>',
        on: {
          'mgr-r-day': function (t, e, ly) { x.day = +t.getAttribute('data-d'); ly.body('<div class="mgr-form">' + body() + '</div>'); },
          'mgr-r-save': function (t, e, ly) {
            var time = ly.el.querySelector('[data-r-time]'), pct = ly.el.querySelector('[data-r-pct]');
            if (time) x.time = time.value;
            if (pct) x.pct = pct.value.trim().replace(',', '.') === '' ? null : Number(pct.value.trim().replace(',', '.'));
            save(next, k.title + ': ' + when(id, next), ly, t);
          }
        } });
      return layer;
    }
    function openLocs() {
      var next = copy(data.settings);
      function body() {
        return field('locations', 'Локації', '<div class="chips">' + data.locations.map(function (l) {
          var on = next.locations.indexOf(l.id) >= 0;
          return '<button class="chip-pick' + (on ? ' chip-pick--on' : '') + '" type="button" aria-pressed="' + on + '" data-act="mgr-r-loc" data-id="' + esc(l.id) + '">' +
            (on ? P.ic('check', 'ui-icon--sm') : '') + esc(l.name) + '</button>'; }).join('') + '</div>') +
          '<p class="hint">Обрано ' + next.locations.length + ' з ' + data.locations.length + '.</p>';
      }
      P.sr.modal({ size: 'sm', title: 'Для яких локацій', sub: 'Усі мої звіти й сигнал', body: '<div class="mgr-form">' + body() + '</div>',
        foot: '<span style="flex:1"></span><button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button>' +
          '<button class="btn btn--primary" type="button" data-act="mgr-r-save">' + P.ic('save', 'ui-icon--sm') + 'Зберегти</button>',
        on: {
          'mgr-r-loc': function (t, e, ly) {
            var id = t.getAttribute('data-id'), i = next.locations.indexOf(id);
            if (i >= 0) next.locations.splice(i, 1); else next.locations.push(id);
            ly.body('<div class="mgr-form">' + body() + '</div>');
          },
          'mgr-r-save': function (t, e, ly) { save(next, 'локації: ' + (locNames(data, next.locations).join(', ') || '—'), ly, t); }
        } });
    }
    ctx.on('mgr-r-on', function (t) {
      var id = t.getAttribute('data-id'), next = copy(data.settings), k = KINDS.filter(function (x) { return x.id === id; })[0];
      next[id].on = !next[id].on;
      save(next, k.title + (next[id].on ? ' увімкнено' : ' вимкнено'), null, t);
    });
    ctx.on('mgr-r-edit', function (t) { openEdit(t.getAttribute('data-id')); });
    ctx.on('mgr-r-locs', function () { openLocs(); });
    load();
  } });
})(window);
