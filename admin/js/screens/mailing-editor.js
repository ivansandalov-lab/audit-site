(function (root) {
  'use strict';
  var P = root.P, esc = P.esc;
  var DAYS = [[1, 'пн'], [2, 'вт'], [3, 'ср'], [4, 'чт'], [5, 'пт'], [6, 'сб'], [0, 'нд']];
  var WEEKDAYS = [[1, 'понеділок'], [2, 'вівторок'], [3, 'середа'], [4, 'четвер'], [5, 'пʼятниця'], [6, 'субота'], [0, 'неділя']];
  var KINDS = [['every', 'Кожні N хв'], ['daily', 'Щодня'], ['weekly', 'Щотижня'], ['event', 'Подія']];
  var EVENTS = [['audit', 'Новий аудит'], ['over', 'Брак понад поріг'], ['kd', 'Новий розбір КД']];
  var CONDS = [['always', 'Завжди'], ['audits', 'Лише якщо були аудити'], ['over', 'Лише якщо брак понад X%']];
  var HELP = 'Натисніть кнопку — підстановка стане там, де курсор. У повідомленні замість неї буде число чи назва на момент надсилання ' +
    '(для кожної локації — свої). *так* — жирний текст у Slack.';

  function da(k, v) { return ' data-' + k + '="' + esc(v) + '"'; }
  function q(el, sel) { return el.querySelector(sel); }
  function qa(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function field(name, label, inner, extra) { return '<div class="field" data-f="' + name + '"><span class="label">' + esc(label) + (extra || '') + '</span>' + inner + '</div>'; }
  function seg(k, opts, cur) {
    return '<div class="seg rz-seg" role="radiogroup">' + opts.map(function (o) {
      return '<button class="seg__btn' + (o[0] === cur ? ' seg__btn--on' : '') + '" type="button" aria-pressed="' + (o[0] === cur) + '" data-act="rz-seg"' + da('k', k) + da('v', o[0]) + '>' + esc(o[1]) + '</button>';
    }).join('') + '</div>';
  }
  function chipPick(on, act, attrs, text) {
    return '<button class="chip-pick rz-pick' + (on ? ' chip-pick--on' : '') + '" type="button" aria-pressed="' + on + '" data-act="' + act + '"' + attrs + '>' + esc(text) + '</button>';
  }
  function select(name, opts, cur) {
    return '<select class="input rz-sel" data-rz="' + name + '">' + opts.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  }
  function hours() { var a = []; for (var i = 0; i < 24; i++) a.push([i, pad(i) + ':00']); return a; }
  function everyText(n) { return n === 60 ? 'щогодини' : 'кожні ' + (n < 60 ? n + ' хв' : n / 60 + ' год'); }
  function f(name, inner) { return '<div class="rz-f" data-f="' + name + '">' + inner + '</div>'; }
  function days(cur) { return f('days', '<div class="chips">' + DAYS.map(function (x) { return chipPick(cur.indexOf(x[0]) >= 0, 'rz-day', da('d', x[0]), x[1]); }).join('') + '</div>'); }
  function timeInput(v) { return '<input class="input rz-time" type="time" data-rz="at_time" value="' + esc(v) + '" aria-label="Час (Київ)">'; }
  function pctInput(name, v) { return '<span class="rz-pct"><input class="input" inputmode="decimal" data-rz="' + name + '" value="' + esc(v) + '" maxlength="5" aria-label="Поріг у відсотках"><b>%</b></span>'; }

  function draft(r) {
    r = JSON.parse(JSON.stringify(r || {}));
    var w = Object.assign({ kind: 'daily', every_min: 60, hour_from: 9, hour_to: 18, days: [1, 2, 3, 4, 5], at_time: '18:00', weekday: 1, event: 'audit', pct: 5 }, r.when || {});
    return { title: r.title || '', enabled: r.enabled !== false, locations: r.locations === 'all' || !Array.isArray(r.locations) ? 'all' : r.locations,
      when: w, to: Array.isArray(r.to) ? r.to : [], condition: Object.assign({ kind: 'always', pct: 5 }, r.condition || {}), template: r.template || '' };
  }

  function open(o) {
    var data = o.data, id = o.id || null, d = draft(o.rule), layer, pv;
    var users = {}; data.users.forEach(function (u) { users[u.id] = u; });

    function whenHtml() {
      var w = d.when, h = seg('kind', KINDS, w.kind);
      if (w.kind === 'every') {
        h += '<div class="rz-grid">' + f('every_min', '<label class="field"><span class="label">Як часто</span>' + select('every_min', data.options.every.map(function (n) { return [n, everyText(n)]; }), w.every_min) + '</label>') +
          f('hours', '<div class="rz-grid rz-grid--2"><label class="field"><span class="label">З</span>' + select('hour_from', hours(), w.hour_from) + '</label>' +
          '<label class="field"><span class="label">До (включно)</span>' + select('hour_to', hours(), w.hour_to) + '</label></div>') + '</div>' + days(w.days);
      } else if (w.kind === 'daily') {
        h += f('at_time', '<div class="rz-row"><span>о</span>' + timeInput(w.at_time) + '<span class="hint">за Києвом</span></div>') + days(w.days);
      } else if (w.kind === 'weekly') {
        h += f('weekday', select('weekday', WEEKDAYS, w.weekday)) + f('at_time', '<div class="rz-row"><span>о</span>' + timeInput(w.at_time) + '<span class="hint">за Києвом</span></div>');
      } else {
        h += f('event', seg('event', EVENTS, w.event)) +
          (w.event === 'over' ? f('event_pct', '<div class="rz-row"><span>брак за сьогодні понад</span>' + pctInput('pct', w.pct) + '</div>') : '');
      }
      return field('kind', 'Коли', h);
    }
    function toHtml() {
      var chips = d.to.map(function (t, i) {
        var u = t.type === 'user' ? users[t.id] : null, label = t.type === 'channel' ? '#' + String(t.name).replace(/^#+/, '') : (u ? u.name : 'Немає в списку') + ' · особисто';
        return '<span class="chip">' + P.ic(t.type === 'channel' ? 'slack' : 'user', 'ui-icon--sm') + esc(label) +
          '<button class="chip__x" type="button" data-act="rz-to-rm"' + da('i', i) + ' aria-label="Прибрати ' + esc(label) + '">' + P.ic('close', 'ui-icon--sm') + '</button></span>';
      }).join('');
      var picked = {}; d.to.forEach(function (t) { if (t.type === 'user') picked[t.id] = 1; });
      return field('to', 'Кому', '<div class="chips">' + (chips || '<span class="hint">Ще нікого — додайте канал або людину.</span>') + '</div>' +
        '<div class="rz-addrow"><input class="input" data-rz-chan placeholder="#канал" aria-label="Канал Slack" maxlength="81">' +
        '<button class="btn btn--secondary" type="button" data-act="rz-to-chan">' + P.ic('add', 'ui-icon--sm') + 'Канал</button></div>' +
        '<select class="input" data-rz-user aria-label="Додати людину"><option value="">+ Людина особисто…</option>' + data.users.filter(function (u) { return !picked[u.id]; }).map(function (u) {
          return '<option value="' + esc(u.id) + '">' + esc(u.name + ' · ' + u.roleLabel + ' · ' + u.locations.join(', ')) + '</option>'; }).join('') + '</select>');
    }
    function phHtml() {
      return '<div class="rz-phs">' + data.options.groups.map(function (g) {
        return '<div class="rz-ph"><span class="rz-ph__t">' + esc(g.title) + '</span><div class="chips">' + g.items.map(function (x) {
          return '<button class="chip-pick rz-chip" type="button" data-act="rz-ph"' + da('v', x[0]) + ' title="{' + esc(x[0]) + '}">' + esc(x[1]) + '</button>'; }).join('') + '</div></div>';
      }).join('') + '</div>';
    }
    function formHtml() {
      var some = d.locations !== 'all';
      return field('title', 'Назва', '<input class="input" data-rz="title" value="' + esc(d.title) + '" maxlength="80" placeholder="Напр. Денний звіт цеху">') +
        field('locations', 'Локації', seg('loc', [['all', 'Усі локації'], ['some', 'Вибрані']], some ? 'some' : 'all') +
          (some ? '<div class="chips">' + data.locations.map(function (l) { return chipPick(d.locations.indexOf(l.id) >= 0, 'rz-loc', da('id', l.id), l.name); }).join('') + '</div>' : '')) +
        whenHtml() + toHtml() +
        field('condition', 'Умова', seg('cond', CONDS, d.condition.kind) +
          (d.condition.kind === 'over' ? f('cond_pct', '<div class="rz-row"><span>' + (d.when.kind === 'event' && d.when.event === 'audit' ? 'брак в аудиті понад' : 'брак за сьогодні понад') + '</span>' + pctInput('cond_pct', d.condition.pct) + '</div>') : '')) +
        field('template', 'Текст повідомлення', '<p class="hint" data-rz-help hidden>' + esc(HELP) + '</p>' +
          '<textarea class="textarea rz-ta" data-rz="template" rows="7" maxlength="1500" placeholder="Напр. Перевірено {перевірено} шт · брак {брак_%}">' + esc(d.template) + '</textarea>' + phHtml(),
          ' <button class="icon-btn rz-help" type="button" data-act="rz-help" aria-label="Як працюють підстановки" title="Як працюють підстановки">' + P.ic('help', 'ui-icon--sm') + '</button>');
    }
    function drawForm() { q(layer.el, '[data-rz-form]').innerHTML = formHtml(); pv.locations(d.locations); }

    function onField(t) {
      var k = t.getAttribute('data-rz'), v = t.value;
      if (k === 'title') d.title = v;
      else if (k === 'template') { d.template = v; pv.update(d); }
      else if (k === 'cond_pct') d.condition.pct = v;
      else if (k === 'every_min' || k === 'hour_from' || k === 'hour_to' || k === 'weekday') d.when[k] = +v;
      else if (k) d.when[k] = v;   // at_time, pct
    }
    function addChannel() {
      var i = q(layer.el, '[data-rz-chan]'), n = String(i.value || '').trim().replace(/^#+/, '');
      if (!n) { i.focus(); return; }
      if (!d.to.some(function (t) { return t.type === 'channel' && String(t.name).toLowerCase() === n.toLowerCase(); })) d.to.push({ type: 'channel', name: n });
      drawForm(); q(layer.el, '[data-rz-chan]').focus();
    }
    function insert(name) {
      var ta = q(layer.el, '[data-rz="template"]'), ins = '{' + name + '}';
      var a = ta.selectionStart == null ? ta.value.length : ta.selectionStart, b = ta.selectionEnd == null ? a : ta.selectionEnd;
      ta.value = ta.value.slice(0, a) + ins + ta.value.slice(b); ta.focus(); ta.selectionStart = ta.selectionEnd = a + ins.length;
      onField(ta);
    }
    function showErrors(r) {
      qa(layer.el, '.rz-err').forEach(function (e) { e.remove(); });
      if (r.code !== 'validation') { if (r.code !== 'forbidden') P.toast('danger', 'Не вдалося зберегти', r.error); return; }
      var first = null, lost = [];
      (r.errors || []).forEach(function (e) {
        var f = q(layer.el, '[data-rz-form] [data-f="' + e.field + '"]');
        if (!f) { lost.push(e.message); return; }
        f.insertAdjacentHTML('beforeend', '<p class="err rz-err" role="alert">' + P.ic('error', 'ui-icon--sm') + esc(e.message) + '</p>');
        if (!first) first = f;
      });
      if (first && first.scrollIntoView) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (lost.length) P.toast('warn', 'Не збережено', lost[0]);
    }
    function save(t) {
      t.disabled = true;
      P.srv('mlRuleSave', { id: id, rule: d }).then(function (r) {
        t.disabled = false;
        if (!r.ok) { showErrors(r); return; }
        layer.close();
        P.toast('ok', (r.created ? 'Створено · ' : 'Збережено · ') + r.item.title, r.item.whenLabel + (r.item.enabled ? '' : ' · вимкнено'));
        if (o.onSaved) o.onSaved(r);
      });
    }
    function headHtml() { return '<span class="hint" data-rz-onlabel>' + (d.enabled ? 'увімкнено' : 'вимкнено') + '</span>' +
      '<button class="toggle' + (d.enabled ? ' toggle--on' : '') + '" type="button" role="switch" aria-checked="' + d.enabled + '" aria-label="Розсилка увімкнена" data-act="rz-on"></button>'; }

    layer = P.sr.modal({ title: id ? 'Розсилка' : 'Нова розсилка', sub: 'Повідомлення в Slack · налаштування на вигаданих даних', head: headHtml(),
      body: '<div class="rz-ed"><div class="rz-ed__form" data-rz-form></div><div class="rz-ed__prev" data-rz-prev></div></div>',
      foot: '<span style="flex:1"></span><button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button>' +
        '<button class="btn btn--primary" type="button" data-act="rz-save">' + P.ic('save', 'ui-icon--sm') + 'Зберегти</button>',
      onMount: function (el) {
        q(el, '.modal').className += ' rz-modal';
        el.addEventListener('input', function (e) { if (e.target.hasAttribute('data-rz')) onField(e.target); });
        el.addEventListener('change', function (e) {
          var t = e.target;
          if (t.hasAttribute('data-rz')) onField(t);
          else if (t.hasAttribute('data-rz-user') && t.value) { d.to.push({ type: 'user', id: t.value }); drawForm(); }
        });
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.hasAttribute('data-rz-chan')) { e.preventDefault(); addChannel(); } });
      },
      on: {
        'rz-on': function (t) { d.enabled = !d.enabled; t.classList.toggle('toggle--on', d.enabled); t.setAttribute('aria-checked', d.enabled); q(layer.el, '[data-rz-onlabel]').textContent = d.enabled ? 'увімкнено' : 'вимкнено'; },
        'rz-seg': function (t) {
          var k = t.getAttribute('data-k'), v = t.getAttribute('data-v');
          if (k === 'kind' || k === 'event') d.when[k] = v;
          else if (k === 'cond') d.condition.kind = v;
          else if (k === 'loc') d.locations = v === 'all' ? 'all' : (d.locations !== 'all' ? d.locations : [data.locations[0].id]);
          drawForm();
        },
        'rz-loc': function (t) { var x = t.getAttribute('data-id'), i = d.locations.indexOf(x); if (i >= 0) d.locations.splice(i, 1); else d.locations.push(x); drawForm(); },
        'rz-day': function (t) { var x = +t.getAttribute('data-d'), i = d.when.days.indexOf(x); if (i >= 0) d.when.days.splice(i, 1); else d.when.days.push(x); drawForm(); },
        'rz-to-chan': addChannel,
        'rz-to-rm': function (t) { d.to.splice(+t.getAttribute('data-i'), 1); drawForm(); },
        'rz-ph': function (t) { insert(t.getAttribute('data-v')); },
        'rz-help': function () { var h = q(layer.el, '[data-rz-help]'); h.hidden = !h.hidden; },
        'rz-test': function (t) { pv.send(t, d, showErrors); },
        'rz-save': save
      } });
    pv = P.mlPreview.mount(q(layer.el, '[data-rz-prev]'), data);
    drawForm();
    pv.update(d);
    return layer;
  }

  P.mlEditor = { open: open };
})(window);
