(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, f = P.fmt, AF = P.AF = P.AF || {};
  var LVL = { fix: 'неправильно зроблене', repair: 'пошкоджене', scrap: 'зламане' };

  function part(title, body) { return '<section class="br-part"><h3 class="br-part__title">' + esc(title) + '</h3>' + body + '</section>'; }
  function rows(list, num, tone) {
    return '<ol class="br-list">' + list.map(function (x) {
      return '<li class="br-row"><span class="br-row__name">' + (tone ? '<span class="lvl-dot lvl-dot--' + esc(x.level) + '" title="' + esc(LVL[x.level] || '') + '"></span>' : '') +
        esc(x.name) + '</span><span class="br-row__num">' + num(x) + '</span></li>';
    }).join('') + '</ol>';
  }
  function none(text) { return '<p class="br-none">' + esc(text) + '</p>'; }
  function pcs(x) { return f.num(x.pieces) + ' шт'; }
  function dm(day) { return day ? f.date(day + 'T12:00:00Z') : '—'; }

  function view(b) {
    var html = '';
    html += part('Сьогодні', b.today.length ? '<ul class="br-today">' + b.today.map(function (a) {
      return '<li class="br-audit"><p class="br-audit__head"><b>' + f.time(a.createdAt) + '</b> · ' + esc(a.auditorName) + '</p>' +
        '<p class="br-audit__nums">перевірено ' + f.num(a.checked) + ' шт · брак ' + f.num(a.rejected) + ' шт' + (a.pct != null ? ' (' + f.pct(a.pct) + ')' : '') + '</p>' +
        (a.comment ? '<p class="br-audit__comment">«' + esc(a.comment) + '»</p>' : '') + '</li>';
    }).join('') + '</ul>' : none('Сьогодні відділ ще не перевіряли.'));
    if (b.norm.target != null) {
      html += part('Норма на сьогодні', '<p class="br-norm"><span>' + (b.norm.left > 0 ? 'Ще перевірити: <b>' + f.num(b.norm.left) + ' шт</b>' : '<b>Норму виконано</b>') + '</span>' +
        '<span class="br-norm__sub">перевірено ' + f.num(b.norm.checked) + ' з ' + f.num(b.norm.target) + ' шт</span></p>');
    }
    var d30 = ' за ' + b.days + ' днів';
    html += part('Вироби з браком' + d30, b.products.length ? rows(b.products, pcs) : none('Браку за цей час не було.'));
    html += part('Види браку' + d30, b.defectTypes.length ? rows(b.defectTypes, pcs, true) : none('Браку за цей час не було.'));
    html += part('Кого перевірити',
      '<p class="br-sub">Найбільше браку' + d30 + '</p>' + (b.defectors.length ? rows(b.defectors, pcs) : none('Нікого: браку з відомим винним не було.')) +
      '<p class="br-sub">Давно не перевіряли (понад ' + b.lostAfter + ' днів)</p>' +
      (b.lost.length ? rows(b.lost, function (x) { return x.daysAgo + ' ' + P.plural(x.daysAgo, 'день', 'дні', 'днів') + ' тому'; }) : none('Усіх перевіряли за останні ' + b.lostAfter + ' днів.')));
    var list = b.kds || (b.kd ? [b.kd] : []);
    html += part(list.length > 1 ? 'Коригуючі дії · ' + list.length : 'Коригуюча дія', !list.length ? none('Зараз немає.') : list.map(kdHtml).join(''));
    return '<div class="br">' + html + '</div>';
  }
  function kdHtml(k) {
    return '<div class="br-kd"><p class="br-kd__state">' + esc(k.statusLabel) + '</p>' +
      '<p class="br-kd__line">Тиждень ' + dm(k.periodStart) + '–' + dm(k.periodEnd) + (k.rate != null ? ' · брак ' + f.pct(k.rate) + ' (норма ' + f.pct(k.threshold) + ')' : '') + '</p>' +
      (k.items.length ? '<p class="br-kd__line">Види браку: ' + k.items.map(function (x) { return '<span class="lvl-dot lvl-dot--' + esc(x.level) + '"></span>' + esc(x.name); }).join(', ') + '</p>' : '') +
      (k.plan ? '<p class="br-kd__line">Що зробили: ' + esc(k.plan) + '</p>' : '') +
      (k.whoName ? '<p class="br-kd__line">Відповідає: ' + esc(k.whoName) + (k.implementedAt ? ' · впроваджено ' + dm(k.implementedAt) : '') + '</p>' : '') + '</div>';
  }

  AF.openBrief = function (F) {
    var dep = AF.dept(F, F.departmentId);
    if (!dep) return;
    var sh = P.sheet.open({ title: dep.name + ' · ' + F.ctx.location.name, full: true, body: P.state.loading() });
    function load() {
      var body = sh.el.querySelector('.sheet__body');
      body.innerHTML = P.state.loading();
      P.srv('auditDeptBrief', { locationId: F.loc, departmentId: dep.id }).then(function (r) {
        if (!sh.el.isConnected) return;   // вікно вже закрили
        body.innerHTML = r.ok ? view(r) : P.state.error('Не вдалося завантажити', r.error);
        var retry = body.querySelector('[data-act="retry"]');
        if (retry) retry.onclick = load;
      });
    }
    load();
  };
})(window);
