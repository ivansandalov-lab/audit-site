(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, K = P.mgr;
  var SORTS = [['audits', 'Більше аудитів'], ['checked', 'Більше перевірено'], ['pieces', 'Більше знайдено браку'], ['pct', 'Більший % браку'],
    ['days', 'Більше днів з аудитами'], ['name', 'За іменем']];
  var st = { sort: 'audits', q: '', loc: '' };   // вибір живе між перемальовуваннями

  function sorted(list) {
    var k = st.sort;
    return list.slice().sort(function (a, b) {
      if (k === 'name') return a.name < b.name ? -1 : 1;
      var x = a[k] == null ? -1 : a[k], y = b[k] == null ? -1 : b[k];
      return y - x || (a.name < b.name ? -1 : 1);
    });
  }
  function who(a) {
    return '<b>' + esc(a.name) + '</b>' + (a.active ? '' : ' ' + H.badge('вимкнено')) +
      '<span class="mgr-dim mgr-block">' + esc(a.roleLabel) + ' · ' + esc(a.locations.join(', ')) + '</span>';
  }
  function last(a) { return a.lastAt ? P.fmt.dateTime(a.lastAt) : '—'; }
  function table(list) {
    return '<div class="tbl-box mgr-desk"><table class="tbl mgr-tbl"><thead><tr><th>Аудитор</th><th class="n">Аудитів</th><th class="n">Перевірено, шт</th>' +
      '<th class="n">Знайдено браку, шт</th><th class="n">Брак, % від перевіреного</th><th class="n">Частка від усього браку</th><th class="n">Днів з аудитами</th>' +
      '<th class="n">Останній аудит</th></tr></thead><tbody>' + list.map(function (a) {
        return '<tr><td>' + who(a) + '</td><td class="n">' + H.num(a.audits) + '</td><td class="n">' + H.num(a.checked) + '</td><td class="n">' + H.num(a.pieces) + '</td>' +
          '<td class="n">' + H.pct(a.pct) + '</td><td class="n">' + H.pct(a.share) + '</td><td class="n">' + H.num(a.days) + '</td><td class="n mgr-dim">' + esc(last(a)) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function cards(list) {
    return '<div class="mgr-cards mgr-phone">' + list.map(function (a) {
      return '<article class="mgr-card"><div class="mgr-card__head"><span>' + who(a) + '</span></div><dl class="mgr-card__kv">' +
        '<dt>Аудитів</dt><dd>' + H.num(a.audits) + ' · днів ' + H.num(a.days) + '</dd><dt>Перевірено</dt><dd>' + H.num(a.checked) + ' шт</dd>' +
        '<dt>Знайдено браку</dt><dd>' + H.num(a.pieces) + ' шт · ' + H.pct(a.pct) + '</dd><dt>Частка від усього браку</dt><dd>' + H.pct(a.share) + '</dd>' +
        '<dt>Останній аудит</dt><dd>' + esc(last(a)) + '</dd></dl></article>';
    }).join('') + '</div>';
  }

  P.cab.tab({ id: 'auditors', label: 'Аудитори', ic: 'people', path: '/auditors', order: 30 });
  P.cab.screen('/auditors', { tab: 'auditors', title: 'Аудитори', period: true, render: function (ctx) {
    var req = 0, data = null;
    function load() {
      var my = ++req, box = ctx.el.querySelector('#mgr-al');
      if (box) box.classList.add('mgr-busy');
      P.srv('mgrAuditors', { from: ctx.period.from, to: ctx.period.to, locationId: st.loc }).then(function (r) {
        if (!ctx.alive() || my !== req) return;
        if (!r.ok && r.code === 'not_found' && st.loc) { st.loc = ''; load(); return; }
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        data = r; frame(); list();
      });
    }
    function frame() {
      var r = data, locs = [['', 'Усі локації']].concat(r.locations.map(function (l) { return [l.id, l.name]; }));
      ctx.el.innerHTML = '<section class="mgr-page"><div><h2 class="h2">Аудитори · ' + r.auditors.length + '</h2><p class="h2-sub">' +
        esc(r.location ? r.location.name : 'Усі локації') + ' · ' + esc(K.span(r.from, r.to)) + ' · ' + esc(K.asOf(r.asOf)) + ' · ' +
        K.n(r.totalAudits, 'аудит', 'аудити', 'аудитів') + ' · знайдено ' + H.num(r.totalPieces) + ' шт браку ' +
        K.help('Частка від усього браку = штуки браку в аудитах людини ÷ усі знайдені штуки браку за період. Брак, % = її штуки браку ÷ перевірені нею штуки.') + '</p></div>' +
        '<div class="mgr-bar">' + K.search('mgr-a-q', st.q, 'Пошук за іменем') + K.select('mgr-a-loc', locs, st.loc, 'Локація') +
        K.select('mgr-a-sort', SORTS, st.sort, 'Сортування') + '</div><div id="mgr-al" class="card"></div></section>';
    }
    function list() {
      var box = ctx.el.querySelector('#mgr-al'), q = st.q.trim().toLowerCase();
      if (!box) return;
      var shown = sorted(data.auditors.filter(function (a) { return !q || a.name.toLowerCase().indexOf(q) >= 0; }));
      box.innerHTML = !data.auditors.length ? H.empty('Аудиторів немає', 'За цей період і локацію ніхто не записував аудитів.')
        : !shown.length ? H.empty('Нікого не знайдено', 'За запитом «' + st.q.trim() + '» — 0 людей. Спробуйте коротший запит.')
        : (q ? '<p class="hint">Знайдено ' + shown.length + ' з ' + data.auditors.length + '</p>' : '') + table(shown) + cards(shown);
    }
    ctx.on('mgr-a-q', function (t) { st.q = t.value; list(); });
    ctx.on('mgr-a-loc', function (t) { st.loc = t.value; load(); });
    ctx.on('mgr-a-sort', function (t) { st.sort = t.value; list(); });
    load();
  } });
})(window);
