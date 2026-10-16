(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;
  var help = function (k) { return P.help ? P.help.btn(k) : ''; };

  var STATES = [['pre', 'Відкрито достроково'], ['decide', 'Потрібне рішення'], ['new', 'Понад норму, не почато'], ['check', 'Впроваджено'], ['hold', 'Під наглядом'],
    ['helped', 'Закрито: тримається'], ['held_types', 'Закрито: її види браку нижче, ніж до дії'], ['not_helped', 'Рецидив'], ['not_needed', 'Дія не потрібна'], ['all', 'Усі']];
  P.sr.screen('/kd/list', { tab: 'kd', title: 'Коригуючі дії — список', period: false, render: function (ctx) {
    var q = ctx.query, shown = 15, data = null;
    K.bindActions(ctx, function (t) { return K.finder(data ? data.items : [])(t); });
    ctx.on('state', function (t) { ctx.go('/kd/list', { state: t.getAttribute('data-v'), dept: q.dept }); });
    ctx.on('dept', function (t) { ctx.go('/kd/list', { state: data ? data.state : q.state, dept: t.value }); });
    ctx.on('more', function () { shown += 15; draw(); });
    ctx.on('retry', function () { load(); });
    ctx.soft = load;
    load();

    function load() {
      P.srv('srKdList', { locationId: ctx.loc.id, state: q.state || 'all', departmentId: q.dept || '' }).then(function (r) {
        if (!ctx.alive()) return;
        if (!r.ok) { ctx.el.innerHTML = K.segNav('/kd/list') + H.error(r); return; }
        data = r; draw();
      });
    }
    function steps(a) {
      if (a.status === 'pre') return '<span class="hint">відкрито ' + H.dayShort(a.openedAt) + ' · ранній тумблер · тиждень ще йде · плану немає</span>';
      if (a.status === 'decide') return '<span class="hint">відкрито ' + H.dayShort(a.openedAt) + ' · ранній тумблер · тиждень завершився: ' + K.pct(a.weekRate) + ', не вище норми · потрібне рішення</span>';
      if (K.isOpen(a)) return '<span class="hint">відкрито ' + H.dayShort(a.openedAt) + (a.early ? ' · ранній тумблер' : '') + ' · плану немає</span>';
      if (a.status === 'not_needed') return '<span class="hint">«' + esc(a.notNeededReason) + '»</span>';
      return '<span class="kd-flow">відкрито ' + H.dayShort(a.openedAt) + ' → впроваджено ' + H.dayShort(a.implementedAt) + ' → 1-й тиждень після: ' + esc(K.rangeShort(a.result.start, a.result.end)) +
        (a.hold ? ' → 2-й тиждень після: ' + esc(K.rangeShort(a.hold.start, a.hold.end)) : '') + '</span>';
    }
    function draw() {
      var r = data, T = r.threshold;
      var filters = '<div class="kd-filters"><span class="pills">' + STATES.map(function (s) {
        return '<button class="pill' + (r.state === s[0] ? ' pill--on' : '') + '" type="button" data-act="state" data-v="' + s[0] + '">' + s[1] + ' · ' + (r.counts[s[0]] || 0) + '</button>'; }).join('') + '</span>' + help('kd.list.states') +
        '<select class="input kd-select" data-change="dept" aria-label="Відділ"><option value="">Усі відділи</option>' + r.departments.map(function (d) {
          return '<option value="' + esc(d.id) + '"' + (q.dept === d.id ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('') + '</select></div>';
      var list = r.items.slice(0, shown), body;
      if (!r.items.length) body = H.empty('КД у цьому стані немає', q.dept ? 'Обрано один відділ — у списку лише його КД.' : '');
      else body = '<div class="tbl-box"><table class="tbl"><thead><tr><th>Відділ · тиждень' + help('kd.review') + '</th><th class="kd-hide-sm">Пункти' + help('kd.pareto') + '</th><th>Брак, % відділу' + help('kd.beforeAfter') +
        '</th><th class="kd-hide-sm">Хід' + help('kd.steps') + '</th><th>Стан' + help('kd.states') + '</th></tr></thead><tbody>' + list.map(function (a) {
        return '<tr data-act="open"' + K.ref(a) + '><td><b>' + esc(a.departmentName) + '</b><span class="sub">' + esc(K.week(a.periodStart, a.periodEnd)) + '</span></td>' +
          '<td class="kd-hide-sm">' + esc(a.items.map(function (x) { return x.name + ' ' + K.pct(x.share); }).join(' · ') || '—') + '</td>' +
          '<td><b class="kd-nowrap">' + esc(K.rates(a)) + '</b><span class="sub">' + K.num(a.rejected) + ' шт з ' + K.num(a.checked) + (a.result && !a.result.pending ? ' → ' + K.num(a.result.rejected) + ' шт з ' + K.num(a.result.checked) : '') + '</span></td>' +
          '<td class="kd-hide-sm">' + steps(a) + '</td><td>' + K.stateBadge(a) + K.earlyBadge(a) + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (r.items.length > shown ? '<button class="btn btn--secondary btn--sm" type="button" data-act="more" style="align-self:flex-start">Показати ще ' + Math.min(15, r.items.length - shown) + '</button>' : '');
      ctx.el.innerHTML = K.segNav('/kd/list') + filters + '<section class="card kd-narrow">' +
        K.cap('Одна КД — відділ за тиждень. Брак, % відділу = брак, шт ÷ перевірено у відділі. Числа: тиждень КД → перший тиждень після впровадження → другий. Норма — ' + T +
          '%. Останній завершений тиждень — ' + esc(K.range(r.review.start, r.review.end)) + '. Натисніть рядок — картка КД.') + body + '</section>';
    }
  } });
})(window);
