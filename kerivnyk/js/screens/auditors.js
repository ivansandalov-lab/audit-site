(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, K = P.mgr;
  var SORTS = [['audits', 'Більше аудитів'], ['days', 'Більше днів з аудитами'], ['checked', 'Більше перевірено'], ['norm', 'Більша частка днів з нормою вибірки'], ['name', 'За іменем']];
  var st = { sort: 'audits', q: '', locs: [], many: false, type: '' };   // вибір живе між перемальовуваннями; type '' — усі відділи

  function sorted(list) {
    var k = st.sort;
    function v(a) { return k === 'norm' ? (a.norm.pct == null ? -1 : a.norm.pct) : a[k] == null ? -1 : a[k]; }
    return list.slice().sort(function (a, b) {
      if (a.senior !== b.senior) return a.senior ? -1 : 1;
      if (k === 'name') return a.name < b.name ? -1 : 1;
      return v(b) - v(a) || (a.name < b.name ? -1 : 1);
    });
  }
  function who(a) {
    return '<b>' + esc(a.name) + '</b>' + (a.senior ? ' <span class="badge mgr-senior">старший</span>' : '') + (a.active ? '' : ' ' + H.badge('вимкнено')) +
      '<span class="mgr-dim mgr-block">' + esc(a.roleLabel) + ' · ' + esc(a.locations.join(', ')) + '</span>';
  }
  function last(a) { return a.lastAt ? P.fmt.dateTime(a.lastAt) : '—'; }
  function one(v) { return String(Math.round(v * 10) / 10).replace('.', ','); }
  function daysWord(v) { var r = Math.round(v * 10) / 10; return one(v) + ' ' + (r % 1 ? 'дня' : P.plural(r, 'день', 'дні', 'днів')); }
  function kdLabel() { return st.type ? 'Коригуючі дії цих відділів' : 'Коригуючі дії локації'; }
  function norm(o) { return o.of ? H.num(o.ok) + ' з ' + H.num(o.of) + ' · <b>' + H.pct(o.pct) + '</b>' : '<span class="mgr-dim">—</span>'; }
  function kd(a) {
    if (!a.senior) return '<span class="mgr-dim">—</span>';
    if (!a.kd) return '<span class="mgr-dim">немає даних</span>';
    return '<span class="mgr-kdnums"><span>відкрито <b>' + H.num(a.kd.opened) + '</b></span><span>впроваджено <b>' + H.num(a.kd.implemented) + '</b></span>' +
      '<span>від відкриття до впровадження, у середньому <b>' + (a.kd.daysAvg == null ? '—' : daysWord(a.kd.daysAvg)) + '</b></span></span>';
  }
  function th(label, key, cls) { return '<th class="' + (cls || 'n') + '">' + esc(label) + (key ? K.help(key) : '') + '</th>'; }
  function table(list) {
    return '<div class="tbl-box mgr-desk"><table class="tbl mgr-tbl"><thead><tr><th>Аудитор' + K.help('term.auditor') + '</th>' + th('Аудитів', 'term.audit') +
      th('Днів з аудитами', 'mgr.daysWithAudits') + th('Перевірено, шт', 'term.checked') + th('Днів з виконаною нормою вибірки', 'mgr.normDays') +
      th(kdLabel() + ' (старші)', 'mgr.seniorKd', ' ') + th('Останній аудит') + '</tr></thead><tbody>' + list.map(function (a) {
        return '<tr' + (a.senior ? ' class="mgr-row--senior"' : '') + '><td>' + who(a) + '</td><td class="n">' + H.num(a.audits) + '</td><td class="n">' + H.num(a.days) + '</td>' +
          '<td class="n">' + H.num(a.checked) + '</td><td class="n">' + norm(a.norm) + '</td><td>' + kd(a) + '</td><td class="n mgr-dim">' + esc(last(a)) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function cards(list) {
    return '<div class="mgr-cards mgr-phone">' + list.map(function (a) {
      return '<article class="mgr-card' + (a.senior ? ' mgr-card--senior' : '') + '"><div class="mgr-card__head"><span>' + who(a) + '</span></div><dl class="mgr-card__kv">' +
        '<dt>Аудитів · днів з аудитами</dt><dd>' + H.num(a.audits) + ' · ' + H.num(a.days) + '</dd><dt>Перевірено</dt><dd>' + H.num(a.checked) + ' шт</dd>' +
        '<dt>Днів з виконаною нормою вибірки' + K.help('mgr.normDays') + '</dt><dd>' + norm(a.norm) + '</dd>' +
        (a.senior ? '<dt>' + kdLabel() + K.help('mgr.seniorKd') + '</dt><dd>' + kd(a) + '</dd>' : '') +
        '<dt>Останній аудит</dt><dd>' + esc(last(a)) + '</dd></dl></article>';
    }).join('') + '</div>';
  }
  function sideBySide(groups) {
    function row(label, key, f) { return '<tr><th scope="row">' + esc(label) + (key ? K.help(key) : '') + '</th>' + groups.map(function (g) { return '<td class="n">' + f(g) + '</td>'; }).join('') + '</tr>'; }
    function kdv(g, f) { return g.kd ? f(g.kd) : '—'; }
    return '<section class="card mgr-gap"><h2 class="card-title">Локації поруч' + K.help('mgr.side') + '</h2><div class="tbl-box"><table class="tbl mgr-tbl mgr-side"><thead><tr><th></th>' +
      groups.map(function (g) { return '<th class="n">' + P.ic('location', 'ui-icon--sm') + ' ' + esc(g.location.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      row('Людей з аудитами', '', function (g) { return H.num(g.auditors.filter(function (a) { return a.audits; }).length) + ' з ' + H.num(g.auditors.length); }) +
      row('Аудитів', 'term.audit', function (g) { return H.num(g.audits); }) +
      row('Днів з аудитами', 'mgr.daysWithAudits', function (g) { return g.daysWithAudits + ' з ' + g.days; }) +
      row('Перевірено, шт', 'term.checked', function (g) { return H.num(g.checked); }) +
      row('Норма вибірки виконана', 'mgr.locNorm', function (g) { return norm(g.norm); }) +
      row('Коригуючі дії: відкрито', 'mgr.kd.action', function (g) { return kdv(g, function (k) { return H.num(k.opened); }); }) +
      row('Коригуючі дії: впроваджено', '', function (g) { return kdv(g, function (k) { return H.num(k.implemented); }); }) +
      row('Днів від відкриття до впровадження, у середньому', 'mgr.kd.days', function (g) { return kdv(g, function (k) { return k.daysAvg == null ? '—' : one(k.daysAvg); }); }) +
      '</tbody></table></div></section>';
  }

  P.cab.tab({ id: 'auditors', label: 'Аудитори', ic: 'people', path: '/auditors', order: 30 });
  P.cab.screen('/auditors', { tab: 'auditors', title: 'Аудитори', period: true, render: function (ctx) {
    var req = 0, data = null;
    function load() {
      var my = ++req, box = ctx.el.querySelector('#mgr-al');
      if (box) box.classList.add('mgr-busy');
      var p = { from: ctx.period.from, to: ctx.period.to, deptTypeId: st.type };
      if (st.locs.length) p.locationIds = st.locs;
      P.srv('mgrAuditors', p).then(function (r) {
        if (!ctx.alive() || my !== req) return;
        if (!r.ok && (r.code === 'not_found' || r.code === 'validation') && (st.locs.length || st.type)) { st.locs = []; st.type = ''; load(); return; }   // вибір на те, чого вже немає
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        if (!st.locs.length) { st.locs = r.locations.length ? [r.locations[0].id] : []; if (st.locs.length) { load(); return; } }   // перший захід — перша локація
        data = r; frame(); list();
      });
    }
    function frame() {
      var r = data, types = [['', 'Усі відділи']].concat(r.deptTypes.map(function (t) { return [t.id, t.name]; }));
      var tname = st.type ? (types.filter(function (t) { return t[0] === st.type; })[0] || ['', ''])[1] : 'усі відділи';
      ctx.el.innerHTML = '<section class="mgr-page"><div><h2 class="h2">Аудитори й старші аудитори · ' + esc(tname) + '</h2><p class="h2-sub">' + esc(K.span(r.from, r.to)) + ' · ' + esc(K.asOf(r.asOf)) +
        (st.type ? ' · лише аудити у відділах «' + esc(tname) + '»' : ' · аудити в усіх відділах') + ' · лише показники роботи — числа, без оцінок</p></div>' +
        '<div class="card mgr-gap mgr-gap--sm">' + K.locBar('mgr-a', r.locations, st.locs, st.many) +
        '<div class="mgr-pick"><span class="mgr-pick__l">Відділ' + K.help('mgr.audDept') + '</span>' + K.chips('mgr-a-type', types, st.type, 'Відділ') + '</div>' +
        (st.many && st.locs.length < 2 ? '<p class="hint">Оберіть ще одну локацію вище — вони стануть поруч.</p>' : '') +
        '<div class="mgr-bar">' + K.search('mgr-a-q', st.q, 'Пошук за іменем') + K.select('mgr-a-sort', SORTS, st.sort, 'Сортування') + '</div></div>' +
        '<div id="mgr-al" class="mgr-page"></div></section>';
    }
    function list() {
      var box = ctx.el.querySelector('#mgr-al'), q = st.q.trim().toLowerCase();
      if (!box) return;
      var groups = data.groups;
      if (!groups.length) { box.innerHTML = '<section class="card">' + H.empty('Локацій ще немає', 'Коли адміністратор додасть локацію, тут зʼявляться її люди.') + '</section>'; return; }
      box.innerHTML = (groups.length > 1 ? sideBySide(groups) : '') + groups.map(function (g) {
        var shown = sorted(g.auditors.filter(function (a) { return !q || a.name.toLowerCase().indexOf(q) >= 0; }));
        return '<section class="card mgr-gap"><div><h2 class="card-title">' + P.ic('location', 'ui-icon--sm') + ' ' + esc(g.location.name) + ' · людей: ' + g.auditors.length + '</h2>' +
          '<p class="hint">' + K.n(g.audits, 'аудит', 'аудити', 'аудитів') + ' · днів з аудитами ' + g.daysWithAudits + ' з ' + g.days + ' · перевірено ' + H.num(g.checked) + ' шт' +
          ' · норма вибірки виконана: ' + norm(g.norm) + K.help('mgr.locNorm') + '</p></div>' +
          (!g.auditors.length ? H.empty('Аудиторів немає', 'За цей період у локації ніхто не записував аудитів.')
            : !shown.length ? H.empty('Нікого не знайдено', 'За запитом «' + st.q.trim() + '» — 0 людей. Спробуйте коротший запит.')
              : (q ? '<p class="hint">Знайдено ' + shown.length + ' з ' + g.auditors.length + '</p>' : '') + table(shown) + cards(shown)) + '</section>';
      }).join('');
    }
    ctx.on('mgr-a-q', function (t) { st.q = t.value; list(); });
    ctx.on('mgr-a-loc', function (t) { st.locs = K.pickLocs(st.locs, t.getAttribute('data-v'), st.many); load(); });
    ctx.on('mgr-a-many', function () {
      st.many = !st.many;
      if (!st.many && st.locs.length > 1) { st.locs = st.locs.slice(0, 1); load(); } else { frame(); list(); }
    });
    ctx.on('mgr-a-sort', function (t) { st.sort = t.value; list(); });
    ctx.on('mgr-a-type', function (t) { st.type = t.getAttribute('data-v'); load(); });

    load();
  } });
})(window);
