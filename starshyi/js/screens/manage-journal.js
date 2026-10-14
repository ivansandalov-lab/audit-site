(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, M = P.srMg;
  var q = M.q;
  var ACTIONS = { add: ['додано', 'ok'], edit: ['змінено', ''], merge: ['обʼєднано', 'info'], 'delete': ['видалено', 'danger'] };
  var jf = { section: '', by: '' };

  function dayTitle(iso) {
    var d = M.daysBetween(P.fmt.dayKey(iso), M.today());
    return d <= 0 ? 'Сьогодні' : d === 1 ? 'Учора' : M.dateLong(iso);
  }
  function change(c) {
    return '<li class="mg-jr-ch"><span class="mg-jr-ch__l">' + esc(c.label) + '</span><span class="mg-jr-ch__v">' +
      (c.from === '—' ? '' : '<span class="mg-jr-from">' + esc(c.from) + '</span>' + P.ic('arrow-right', 'ui-icon--sm')) +
      '<b>' + esc(c.to) + '</b></span></li>';
  }
  function entry(x) {
    var a = ACTIONS[x.action] || ['змінено', ''];
    return '<article class="mg-jr-item"><div class="mg-jr-item__head"><span class="mg-jr-time">' + P.fmt.time(x.at) + '</span>' +
      H.badge(x.sectionLabel, 'brand') + H.badge(a[0], a[1]) + '<b class="mg-jr-what">' + esc(x.what) + '</b>' +
      '<span class="mg-jr-by">' + P.ic('user', 'ui-icon--sm') + esc(x.byName) + '</span></div>' +
      (x.changes.length ? '<ul class="mg-jr-chs">' + x.changes.map(change).join('') + '</ul>' : '') + '</article>';
  }
  function list(r) {
    if (!r.items.length) {
      var filtered = r.section || r.by;
      return '<section class="card">' + P.state.empty('info', filtered ? 'За цим фільтром змін немає' : 'Змін ще не було',
        filtered ? 'За 30 днів.' : 'За 30 днів довідники цеху ніхто не змінював.',
        filtered ? '<button class="btn btn--secondary btn--sm" type="button" data-act="mg-jr-all">Показати всі зміни</button>' : '') + '</section>';
    }
    var html = '', day = null;
    r.items.forEach(function (x) {
      var d = P.fmt.dayKey(x.at);
      if (d !== day) { html += (day ? '</div></section>' : '') + '<section class="card mg-jr-day"><h3 class="card-title">' + esc(dayTitle(x.at)) + '</h3><div class="mg-jr-list">'; day = d; }
      html += entry(x);
    });
    return html + '</div></section>' + (r.shown < r.total ? '<p class="hint">Показано ' + r.shown + ' найсвіжіших з ' + r.total + '. Звузьте фільтр, щоб побачити старіші.</p>' : '');
  }
  function filters(r) {
    return '<div class="mg-tools"><select class="input mg-jr-select" data-change="mg-jr-section" aria-label="Розділ">' +
      '<option value="">Розділ: усі</option>' + r.sections.filter(function (s) { return s.n || s.id === r.section; }).map(function (s) {
        return '<option value="' + esc(s.id) + '"' + (s.id === r.section ? ' selected' : '') + '>' + esc(s.label) + ' · ' + s.n + '</option>';
      }).join('') + '</select>' +
      '<select class="input mg-jr-select" data-change="mg-jr-by" aria-label="Хто змінив"><option value="">Хто: усі</option>' + r.people.map(function (u) {
        return '<option value="' + esc(u.id) + '"' + (u.id === r.by ? ' selected' : '') + '>' + esc(u.name) + ' · ' + u.n + '</option>';
      }).join('') + '</select></div>';
  }

  M.section('journal', 'Журнал змін', function (v) {
    function draw(r) {
      v.col.innerHTML = M.head('Журнал змін', 'Хто що змінив у довідниках цеху · за ' + r.days + ' днів · станом на ' + P.fmt.time(new Date().toISOString())) +
        filters(r) + '<div data-mg-jr>' + list(r) + '</div>' +
        '<p class="hint">Записи, старші за ' + r.days + ' днів, зникають самі. Аудити тут не показуються — їхні зміни видно в історії аудитів.</p>';
    }
    function load() {
      if (!jf.section && !jf.by) { v.get('srMgJournal', draw); return; }
      v.call('srMgJournal', { section: jf.section, by: jf.by }).then(function (r) {
        if (!v.ctx.alive()) return;
        if (!r.ok) { v.col.innerHTML = H.error(r); return; }
        jf.section = r.section; jf.by = r.by;   // невідомий фільтр сервер скидає — і ми теж
        draw(r);
      });
    }
    function refilter() { var box = q(v.col, '[data-mg-jr]'); if (box) box.innerHTML = H.loading(); load(); }
    v.ctx.on('mg-jr-section', function (t) { jf.section = t.value; refilter(); });
    v.ctx.on('mg-jr-by', function (t) { jf.by = t.value; refilter(); });
    v.ctx.on('mg-jr-all', function () { jf.section = ''; jf.by = ''; refilter(); });
    load();
  });
})(window);
