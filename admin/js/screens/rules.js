(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm, da = A.da;
  var HINT = {
    criticalPct: 'Аудит, у якому брак понад це число, позначається червоним: на головній працівника, в історії й аналітиці старшого.',
    kdThreshold: 'Брак, % відділу за тиждень понад це число — відкривається коригуюча дія відділу (за будь-якої кількості перевірених штук).',
    kdReviewDay: 'Того дня зранку додаток підсумовує 7 днів перед ним (за замовчуванням пт → чт) і відкриває коригуючі дії відділам понад норму.',
    kdCycleDays: 'Тиждень розбору — завжди 7 днів: від дня розбору до дня перед наступним. Під замком, бо від тижня залежать уже записані коригуючі дії.',
    kdEarlyMin: 'У тижні, що триває, уже перевірено стільки штук і брак, % відділу понад норму — коригуюча дія відкривається одразу, не чекаючи дня розбору.',
    kdPareto: 'Пункти коригуючої дії — види браку від найбільшої частки браку відділу за тиждень, доки разом не дадуть стільки відсотків.',
    editWindowMin: 'Стільки хвилин після запису аудитор може виправити свій аудит.',
    sessionDays: 'Через стільки днів додаток просить увійти знову (Google-пошта).'
  };
  var HELP = { criticalPct: 'term.critical', kdThreshold: 'kd.threshold', kdReviewDay: 'kd.review', kdCycleDays: 'kd.review', kdEarlyMin: 'kd.minSample',
    kdPareto: 'kd.pareto', editWindowMin: 'term.editWindow', sessionDays: 'admin.rule.session' };
  var SHORT = { kdThreshold: 'Норма браку відділу', kdReviewDay: 'День розбору', kdCycleDays: 'Тиждень розбору', kdEarlyMin: 'Ранній тумблер', kdPareto: 'Пункти КД (Парето)' };
  var NAMES = { kdReviewDay: ['понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота', 'неділя'] };
  function num(v) { return v == null ? '—' : String(v).replace('.', ','); }
  function withUnit(v, u, key) {
    var n = key && NAMES[key];
    return n ? (n[v - 1] || num(v)) : num(v) + (u === '%' ? '%' : ' ' + u);
  }

  P.cab.tab({ id: 'rules', label: 'Правила', ic: 'settings', path: '/rules', order: 30 });
  P.cab.screen('/rules', { tab: 'rules', title: 'Правила', render: function (ctx) {
    var data = null;
    function find(key) { return data.items.filter(function (x) { return x.key === key; })[0]; }
    function card(r) {
      var c = r.changed, isDef = r.value === r.def;
      return '<section class="card adm-rule' + (r.locked ? ' adm-rule--locked' : '') + '"><div class="adm-rule__head"><h3 class="adm-rule__title">' + esc(SHORT[r.key] || r.label) + A.help(HELP[r.key]) + '</h3>' +
        (r.locked ? '<span class="adm-lockic" title="Змінюється разом із базою">' + P.ic('lock', 'ui-icon--sm') + '</span>' : A.pen('ru-edit', da('key', r.key), 'Змінити · ' + r.label)) + '</div>' +
        '<p class="adm-rule__val">' + esc(withUnit(r.value, r.unit, r.key)) + '</p>' +
        '<p class="hint">' + esc(HINT[r.key] || '') + '</p>' +
        '<dl class="kv adm-rule__kv">' + (r.locked ? '' : '<dt>За замовчуванням' + A.help('admin.rule.def') + '</dt><dd>' + esc(withUnit(r.def, r.unit, r.key)) + '</dd>' +
          (NAMES[r.key] ? '' : '<dt>Межі' + A.help('admin.rule.limits') + '</dt><dd>' + esc(num(r.min) + ' – ' + withUnit(r.max, r.unit)) + '</dd>')) +
          (c ? '<dt>Остання зміна' + A.help('admin.rule.last') + '</dt><dd>' + esc(withUnit(c.from, r.unit, r.key) + ' → ' + withUnit(c.to, r.unit, r.key)) + '<br><span class="adm-dim">' + esc(c.byName + ' · ' + P.fmt.dateTime(c.at)) + '</span></dd>' : '') + '</dl>' +
        (!r.locked && !isDef ? '<div><button class="btn btn--quiet btn--sm" type="button" data-act="ru-reset"' + da('key', r.key) + '>' + P.ic('refresh', 'ui-icon--sm') + 'Повернути як було · ' + esc(withUnit(r.def, r.unit, r.key)) + '</button></div>' : '') +
        '</section>';
    }
    function draw() {
      var groups = [['Брак в аудиті', ['criticalPct']], ['Коригуючі дії', ['kdThreshold', 'kdReviewDay', 'kdCycleDays', 'kdEarlyMin', 'kdPareto']], ['Вхід і виправлення', ['editWindowMin', 'sessionDays']]];
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
        P.toast('ok', 'Збережено · ' + r.label, withUnit(res.was, r.unit, r.key) + ' → ' + withUnit(res.value, r.unit, r.key));
        if (ctx.alive()) load();
      });
    }
    ctx.on('ru-edit', function (t) {
      var r = find(t.getAttribute('data-key')), names = NAMES[r.key];
      var ctl = names ? A.field('value', 'Новий день', '<select class="input" name="value">' + names.map(function (n, i) {
          return '<option value="' + (i + 1) + '"' + (i + 1 === r.value ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>', '', HELP[r.key])
        : A.field('value', 'Нове значення, ' + r.unit, A.input('value', num(r.value), ' inputmode="' + (r.dec ? 'decimal' : 'numeric') + '" autocomplete="off" maxlength="8"'),
          'Від ' + num(r.min) + ' до ' + withUnit(r.max, r.unit) + (r.dec ? ', можна з одним знаком після коми.' : ', ціле число.'), HELP[r.key]);
      A.modal({ size: 'sm', title: r.label, sub: 'Зараз: ' + esc(withUnit(r.value, r.unit, r.key)),
        body: '<div class="adm-form">' + ctl + '<p class="hint">' + esc(HINT[r.key] || '') + '</p></div>',
        foot: A.cancelBtn() + A.saveBtn('Зберегти'),
        onMount: function (el) { A.enterSubmits(el); var i = A.q(el, 'input.input') || A.q(el, 'select.input'); if (i && i.select) i.select(); else if (i) i.focus(); },
        on: { 'adm-save': function (b, e, layer) { save({ key: r.key, value: A.val(layer.el, 'value').trim() }, r, layer, b); } } });
    });
    ctx.on('ru-reset', function (t) {
      var r = find(t.getAttribute('data-key'));
      P.confirm({ title: 'Повернути як було?', text: r.label + ': ' + withUnit(r.value, r.unit, r.key) + ' → ' + withUnit(r.def, r.unit, r.key) + '.', okLabel: 'Повернути' })
        .then(function (ok) { if (ok) save({ key: r.key, reset: true }, r, null, t); });
    });
    load();
  } });
})(window);
