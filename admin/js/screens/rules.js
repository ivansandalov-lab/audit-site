(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm, da = A.da;
  var HINT = {
    criticalPct: 'Аудит, у якому брак понад це число, позначається червоним: на головній працівника, в історії й аналітиці старшого.',
    kdThreshold: 'Вид браку у відділі понад це число за період розбору потрапляє в коригуючі дії.',
    kdMinSample: 'Відділ іде в розбір, коли за період перевірено щонайменше стільки штук.',
    kdPeriodDays: 'Змінюється разом із базою: від цього числа залежать номери вже записаних розборів і коригуючих дій.',
    editWindowMin: 'Стільки хвилин після запису аудитор може виправити свій аудит.',
    sessionDays: 'Через стільки днів додаток просить увійти знову (Google-пошта).'
  };
  var SHORT = { kdThreshold: 'Поріг виду браку', kdMinSample: 'Мінімум перевірених', kdPeriodDays: 'Розбір раз на' };
  function num(v) { return v == null ? '—' : String(v).replace('.', ','); }
  function withUnit(v, u) { return num(v) + (u === '%' ? '%' : ' ' + u); }

  P.cab.tab({ id: 'rules', label: 'Правила', ic: 'settings', path: '/rules', order: 30 });
  P.cab.screen('/rules', { tab: 'rules', title: 'Правила', render: function (ctx) {
    var data = null;
    function find(key) { return data.items.filter(function (x) { return x.key === key; })[0]; }
    function card(r) {
      var c = r.changed, isDef = r.value === r.def;
      return '<section class="card adm-rule' + (r.locked ? ' adm-rule--locked' : '') + '"><div class="adm-rule__head"><h3 class="adm-rule__title">' + esc(SHORT[r.key] || r.label) + '</h3>' +
        (r.locked ? '<span class="adm-lockic" title="Змінюється разом із базою">' + P.ic('lock', 'ui-icon--sm') + '</span>' : A.pen('ru-edit', da('key', r.key), 'Змінити · ' + r.label)) + '</div>' +
        '<p class="adm-rule__val">' + esc(withUnit(r.value, r.unit)) + '</p>' +
        '<p class="hint">' + esc(HINT[r.key] || '') + '</p>' +
        '<dl class="kv adm-rule__kv">' + (r.locked ? '' : '<dt>За замовчуванням</dt><dd>' + esc(withUnit(r.def, r.unit)) + '</dd><dt>Межі</dt><dd>' + esc(num(r.min) + ' – ' + withUnit(r.max, r.unit)) + '</dd>') +
          (c ? '<dt>Остання зміна</dt><dd>' + esc(withUnit(c.from, r.unit) + ' → ' + withUnit(c.to, r.unit)) + '<br><span class="adm-dim">' + esc(c.byName + ' · ' + P.fmt.dateTime(c.at)) + '</span></dd>' : '') + '</dl>' +
        (!r.locked && !isDef ? '<div><button class="btn btn--quiet btn--sm" type="button" data-act="ru-reset"' + da('key', r.key) + '>' + P.ic('refresh', 'ui-icon--sm') + 'Повернути як було · ' + esc(withUnit(r.def, r.unit)) + '</button></div>' : '') +
        '</section>';
    }
    function draw() {
      var groups = [['Брак', ['criticalPct']], ['Коригуючі дії', ['kdThreshold', 'kdMinSample', 'kdPeriodDays']], ['Вхід і виправлення', ['editWindowMin', 'sessionDays']]];
      ctx.el.innerHTML = '<section class="adm-col">' + A.head('Правила', 'Діють для всіх локацій одразу після збереження · ' + A.asOf()) +
        groups.map(function (g) {
          var list = g[1].map(find).filter(Boolean);
          return list.length ? '<h3 class="adm-group">' + esc(g[0]) + '</h3><div class="adm-rules">' + list.map(card).join('') + '</div>' : '';
        }).join('') + '</section>';
    }
    function load() {
      P.srv('adminRules', {}).then(function (r) {
        if (!ctx.alive()) return;
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        data = r; draw();
      });
    }
    function save(p, r, layer, btn) {
      if (btn) btn.disabled = true;
      return P.srv('adminRuleSave', p).then(function (res) {
        if (btn) btn.disabled = false;
        if (!res.ok) { if (layer) A.showErrors(layer.el, res); else A.failToast(res); return; }
        if (layer) layer.close();
        P.toast('ok', 'Збережено · ' + r.label, withUnit(res.was, r.unit) + ' → ' + withUnit(res.value, r.unit));
        if (ctx.alive()) load();
      });
    }
    ctx.on('ru-edit', function (t) {
      var r = find(t.getAttribute('data-key'));
      A.modal({ size: 'sm', title: r.label, sub: 'Зараз: ' + esc(withUnit(r.value, r.unit)),
        body: '<div class="adm-form">' + A.field('value', 'Нове значення, ' + r.unit, A.input('value', num(r.value), ' inputmode="' + (r.dec ? 'decimal' : 'numeric') + '" autocomplete="off" maxlength="8"'),
          'Від ' + num(r.min) + ' до ' + withUnit(r.max, r.unit) + (r.dec ? ', можна з одним знаком після коми.' : ', ціле число.')) +
          '<p class="hint">' + esc(HINT[r.key] || '') + '</p></div>',
        foot: A.cancelBtn() + A.saveBtn('Зберегти'),
        onMount: function (el) { A.enterSubmits(el); var i = A.q(el, 'input.input'); if (i && i.select) i.select(); },
        on: { 'adm-save': function (b, e, layer) { save({ key: r.key, value: A.val(layer.el, 'value').trim() }, r, layer, b); } } });
    });
    ctx.on('ru-reset', function (t) {
      var r = find(t.getAttribute('data-key'));
      P.confirm({ title: 'Повернути як було?', text: r.label + ': ' + withUnit(r.value, r.unit) + ' → ' + withUnit(r.def, r.unit) + '.', okLabel: 'Повернути' })
        .then(function (ok) { if (ok) save({ key: r.key, reset: true }, r, null, t); });
    });
    load();
  } });
})(window);
