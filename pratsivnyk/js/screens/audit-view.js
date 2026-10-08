(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, f = P.fmt;

  function sevBadge(s) { return '<span class="ui-badge ui-badge--' + (s >= 3 ? 'danger' : s === 2 ? 'warn' : 'outline') + '">' + esc(P.AF.sevLabel(s)) + '</span>'; }
  function stat(v, label) { return '<div class="total"><span class="total__val">' + v + '</span><span class="total__label">' + label + '</span></div>'; }

  P.screen('/audit/:id', {
    back: '/home',
    title: function (ctx) { return { title: 'Аудит', sub: ctx.params.id }; },
    render: function (ctx) {
      return P.srv('auditGet', { id: ctx.params.id }).then(function (r) {
        if (!r.ok) return r.code === 'not_found' ? P.state.empty('search', 'Аудит не знайдено', 'Можливо, посилання неправильне.') : P.state.error('Не вдалося відкрити аудит', r.error);
        var a = r.audit, left = a.canEdit && a.editableUntil ? Math.max(0, Math.ceil((Date.parse(a.editableUntil) - Date.now()) / 60000)) : 0;
        if (ctx.alive()) P.shell.setTitle({ title: f.time(a.createdAt) + ' · ' + a.departmentName, sub: a.id });
        var items = '<table class="detail-table"><thead><tr><th>Виріб</th><th class="num">Перевірено</th><th class="num">Брак</th></tr></thead><tbody>' +
          a.items.map(function (i) {
            return '<tr><td>' + esc(i.productName) + (i.orderNo ? '<span class="detail-sub">' + esc(i.orderNo) + '</span>' : '') + '</td>' +
              '<td class="num">' + f.num(i.qty) + '</td><td class="num">' + (i.rejected == null ? '—' : f.num(i.rejected)) + '</td></tr>';
          }).join('') + '</tbody></table>';
        var defects = a.defects.length ? '<div class="mini-list">' + a.defects.map(function (d) {
          var who = d.workerCode ? (d.workerName ? d.workerName + ' · ' + d.workerCode : d.workerCode) : 'винний невідомий';
          return '<div class="mini-item">' + P.ic('defect') + '<span class="mini-item__main"><span class="mini-item__title">' + esc(d.defectTypeName) + ' — ' + f.num(d.qty) + ' шт</span>' +
            '<span class="mini-item__meta">' + esc([d.productName, who].filter(Boolean).join(' · ')) + '</span>' +
            (d.otherDept ? '<span class="ui-badge ui-badge--info">брак відділу «' + esc(d.departmentName) + '»</span>' : '') + '</span>' + sevBadge(d.severity) + '</div>';
        }).join('') + '</div>' : '<p class="card-sub">Без браку.</p>';
        var workers = (a.checkedWorkers || []).map(function (w) { return '<span class="ui-chip">' + esc(w.name ? w.name + ' · ' + w.code : w.code) + '</span>'; }).join('');
        return '<div class="stack">' +
          '<section class="ui-card"><div class="totals">' + stat(f.num(a.checked), 'перевірено, шт') + stat(f.num(a.rejected), 'брак, шт') + stat(f.pct(a.pct), 'брак') + '</div>' + items + '</section>' +
          '<section class="ui-card"><h2 class="card-title">Брак</h2>' + defects + '</section>' +
          '<section class="ui-card"><h2 class="card-title">Перевірені працівники</h2>' + (workers ? '<div class="chips-input">' + workers + '</div>' : '<p class="card-sub">—</p>') + '</section>' +
          (a.comment ? '<section class="ui-card"><h2 class="card-title">Коментар</h2><p class="ui-text-sm">' + esc(a.comment) + '</p></section>' : '') +
          (left ? '<button class="ui-btn ui-btn--primary home-cta" type="button" data-act="edit">' + P.ic('edit') + 'Виправити · ще ' + left + ' хв</button>'
            : '<p class="card-sub">Записано о ' + f.time(a.createdAt) + '. Виправити можна лише протягом 15 хвилин після запису.</p>') + '</div>';
      });
    },
    mount: function (el, ctx) {
      P.delegate(el, 'click', '[data-act="retry"]', function () { P.shell.rerender(); });
      P.delegate(el, 'click', '[data-act="edit"]', function () { P.router.go('/audit/' + ctx.params.id + '/edit'); });
    }
  });
})(window);
