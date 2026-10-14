(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;
  var help = function (k) { return P.help ? P.help.btn(k) : ''; };

  var STATES = [['new', 'Нові'], ['started', 'В роботі'], ['check', 'На спостереженні'], ['done', 'Завершені'], ['all', 'Усі']];
  P.sr.screen('/kd/list', { tab: 'kd', title: 'Коригуючі дії — список', period: false, render: function (ctx) {
    var q = ctx.query, shown = 15, data = null;
    K.bindActions(ctx, function (t) { return K.finder(data ? data.items : [])(t); });
    ctx.on('state', function (t) { ctx.go('/kd/list', { state: t.getAttribute('data-v'), dept: q.dept }); });
    ctx.on('dept', function (t) { ctx.go('/kd/list', { state: data ? data.state : q.state, dept: t.value }); });
    ctx.on('more', function () { shown += 15; draw(); });
    ctx.soft = load;
    load();

    function load() {
      P.srv('srKdList', { locationId: ctx.loc.id, state: q.state || 'all', departmentId: q.dept || '' }).then(function (r) {
        if (!ctx.alive()) return;
        if (!r.ok) { ctx.el.innerHTML = K.segNav('/kd/list') + H.error(r); return; }
        data = r; draw();
      });
    }
    function draw() {
      var r = data, T = r.threshold;
      var filters = '<div class="kd-filters"><span class="pills">' + STATES.map(function (s) {
        return '<button class="pill' + (r.state === s[0] ? ' pill--on' : '') + '" type="button" data-act="state" data-v="' + s[0] + '">' + s[1] + ' · ' + r.counts[s[0]] + '</button>'; }).join('') + '</span>' + help('kd.list.states') +
        '<select class="input kd-select" data-change="dept" aria-label="Відділ"><option value="">Усі відділи</option>' + r.departments.map(function (d) {
          return '<option value="' + esc(d.id) + '"' + (q.dept === d.id ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('') + '</select></div>';
      var list = r.items.slice(0, shown), body;
      if (!r.items.length) body = H.empty('Дій у цьому стані немає', q.dept ? 'Обрано один відділ — у списку лише його дії.' : '');
      else body = '<div class="tbl-box"><table class="tbl"><thead><tr><th>Вид браку · відділ' + help('term.defectType') + '</th><th class="kd-hide-sm">Розбір дії' + help('kd.review') + '</th><th>Частка виду браку, %' + help('kd.beforeAfter') + '</th><th class="kd-hide-sm">Хід дії' + help('kd.steps') + '</th><th>Стан' + help('kd.typeState') + '</th></tr></thead><tbody>' + list.map(function (a) {
        return '<tr data-act="open"' + K.ref(a) + '><td><b>' + esc(a.name) + '</b><span class="sub">' + esc(a.departmentName) + '<span class="kd-show-sm"> · розбір ' + esc(K.rangeShort(a.periodStart, a.periodEnd)) + '</span></span></td>' +
          '<td class="kd-hide-sm kd-nowrap">' + esc(K.rangeShort(a.periodStart, a.periodEnd)) + '</td>' +
          '<td><b class="kd-nowrap">' + esc(K.rates(a)) + '</b><span class="sub">' + K.num(a.pieces) + ' шт з ' + K.num(a.checked) + (a.after != null ? ' → ' + K.num(a.afterPieces) + ' шт з ' + K.num(a.afterChecked) : '') + '</span></td>' +
          '<td class="kd-hide-sm">' + (a.status === 'new' ? '<span class="hint">рішення немає</span>' : a.status === 'not_needed' ? '<span class="hint">«' + esc(a.notNeededReason) + '»</span>' : K.steps(a)) + '</td>' +
          '<td>' + K.stateBadge(a, r.today) + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (r.items.length > shown ? '<button class="btn btn--secondary btn--sm" type="button" data-act="more" style="align-self:flex-start">Показати ще ' + Math.min(15, r.items.length - shown) + '</button>' : '');
      ctx.el.innerHTML = K.segNav('/kd/list') + filters + '<section class="card kd-narrow">' +
        K.cap('Частка виду браку = шт цього виду браку ÷ перевірено у відділі за розбір дії; після стрілки — частка в розборі перевірки (перший повний розбір після впровадження). Поріг — ' + T +
          '%. Останній повний розбір — ' + esc(K.range(r.review.start, r.review.end)) + '. Клік по рядку — картка дії.') + body + '</section>';
    }
  } });
})(window);
