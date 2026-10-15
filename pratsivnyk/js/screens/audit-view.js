(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, f = P.fmt;
  var shots = [];   // усі фото відкритого аудиту по порядку — для перегляду на весь екран

  function lvlBadge(l) { return l ? '<span class="ui-badge ui-badge--' + (l === 'scrap' ? 'danger' : l === 'repair' ? 'warn' : 'info') + '">' + esc(P.AF.lvlLabel(l)) + '</span>' : ''; }
  function stat(v, label, help) { return '<div class="total"><span class="total__val">' + v + '</span><span class="total__label">' + label + P.help.btn(help) + '</span></div>'; }

  P.screen('/audit/:id', {
    back: '/home',
    title: function (ctx) { return { title: 'Аудит', sub: ctx.params.id }; },
    render: function (ctx) {
      return P.srv('auditGet', { id: ctx.params.id }).then(function (r) {
        if (!r.ok) return r.code === 'not_found' ? P.state.empty('search', 'Аудит не знайдено', 'Можливо, посилання неправильне.') : P.state.error('Не вдалося відкрити аудит', r.error);
        var a = r.audit, left = a.canEdit && a.editableUntil ? Math.max(0, Math.ceil((Date.parse(a.editableUntil) - Date.now()) / 60000)) : 0;
        if (ctx.alive()) P.shell.setTitle({ title: f.time(a.createdAt) + ' · ' + a.departmentName, sub: (a.locationId !== ctx.loc ? a.locationName + ' · ' : '') + a.id });
        var items = '<table class="detail-table"><thead><tr><th>Виріб' + P.help.btn('w.view.items') + '</th><th class="num">Перевірено, шт</th><th class="num">Брак, шт</th></tr></thead><tbody>' +
          a.items.map(function (i) {
            return '<tr><td>' + esc(i.productName) + (i.orderNo ? '<span class="detail-sub">' + esc(i.orderNo) + '</span>' : '') + '</td>' +
              '<td class="num">' + f.num(i.qty) + '</td><td class="num">' + (i.rejected == null ? '—' : f.num(i.rejected)) + '</td></tr>';
          }).join('') + '</tbody></table>';
        shots = [];
        var defects = a.defects.length ? '<div class="mini-list">' + a.defects.map(function (d) {
          var ph = (d.photos || []).filter(P.AF.isPhoto), from = shots.length;
          shots = shots.concat(ph);
          var who = d.workerCode ? (d.workerName || d.workerCode) + (d.helper ? ' · допомога' : '') : 'Невідомий працівник';
          return '<div class="mini-item">' + P.ic('defect') + '<span class="mini-item__main"><span class="mini-item__title">' + esc(d.defectTypeName) + ' — ' + f.num(d.qty) + ' шт</span>' +
            '<span class="mini-item__meta">' + esc([d.productName, who].filter(Boolean).join(' · ')) + '</span>' +
            (d.otherDept ? '<span class="ui-badge ui-badge--info">брак відділу «' + esc(d.departmentName) + '»</span>' + P.help.btn('term.otherDept') : '') +
            (ph.length ? P.AF.photoThumbs(ph, from, 'Фото · ' + d.defectTypeName) : '') + '</span>' + lvlBadge(d.level) + '</div>';
        }).join('') + '</div>' : '<p class="card-sub">Без браку.</p>';
        var helpers = (a.checkedWorkers || []).some(function (w) { return w.helper; });
        var workers = (a.checkedWorkers || []).map(function (w) { return '<span class="ui-chip">' + esc(w.name || w.code) + (w.helper ? ' · допомога' : '') + '</span>'; }).join('');
        return '<div class="stack">' +
          '<section class="ui-card"><div class="totals">' + stat(f.num(a.checked), 'перевірено, шт', 'term.checked') + stat(f.num(a.rejected), 'брак, шт', 'term.rejected') + stat(f.pct(a.pct), 'брак, %', 'term.rate') + '</div>' + items + '</section>' +
          '<section class="ui-card"><h2 class="card-title">Види браку' + (a.defects.length ? P.help.btn('term.levels') : '') + '</h2>' + defects + '</section>' +
          '<section class="ui-card"><h2 class="card-title">Перевірені працівники' + (helpers ? P.help.btn('term.helper') : '') + '</h2>' + (workers ? '<div class="chips-input">' + workers + '</div>' : '<p class="card-sub">—</p>') + '</section>' +
          (a.comment ? '<section class="ui-card"><h2 class="card-title">Коментар</h2><p class="ui-text-sm">' + esc(a.comment) + '</p></section>' : '') +
          (left ? '<button class="ui-btn ui-btn--primary home-cta" type="button" data-act="edit">' + P.ic('edit') + 'Виправити · ще ' + left + ' хв</button>'
            : '<p class="card-sub">Записано о ' + f.time(a.createdAt) + '. Виправити можна було ' + (a.editWindowMin || 15) + ' хв після запису — цей час минув.' + P.help.btn('term.editWindow') + '</p>') + '</div>';
      });
    },
    mount: function (el, ctx) {
      P.delegate(el, 'click', '[data-act="retry"]', function () { P.shell.rerender(); });
      P.delegate(el, 'click', '[data-act="edit"]', function () { P.router.go('/audit/' + ctx.params.id + '/edit'); });
      P.delegate(el, 'click', '[data-ph-i]', function (e, t) { P.AF.photoView(shots, Number(t.getAttribute('data-ph-i')) || 0); });
    }
  });
})(window);
