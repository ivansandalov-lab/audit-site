(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, K = P.mgr;
  var SORTS = [['pct', 'За % браку'], ['checked', 'За перевіреними, шт']];
  var st = { sort: 'pct', locs: [], many: false, type: '' };

  function sorted(list) {
    return list.slice().sort(function (a, b) {
      if (st.sort === 'checked') return b.checked - a.checked || (a.name < b.name ? -1 : 1);
      if (a.pct == null || b.pct == null) return a.pct == null ? (b.pct == null ? b.checked - a.checked : 1) : -1;
      return b.pct - a.pct || b.checked - a.checked;
    });
  }
  function name(d) { return '<b>' + esc(d.name) + '</b>' + (d.active ? '' : ' ' + H.badge('вимкнено')); }
  function th(label, key, n) { return '<th' + (n ? ' class="n"' : '') + '>' + esc(label) + (key ? K.help(key) : '') + '</th>'; }

  function table(list, crit) {
    return '<div class="tbl-box mgr-desk"><table class="tbl mgr-tbl"><thead><tr><th class="n">№</th><th>Відділ</th>' + th('Аудитів', 'term.audit', 1) +
      th('Перевірено, шт', 'term.checked', 1) + th('Брак, шт', 'mgr.deptBrak', 1) + th('Брак, %', 'term.rate', 1) + th('Рівні браку', 'term.levels') +
      th('Найчастіші види браку', 'mgr.top') + '</tr></thead><tbody>' +
      list.map(function (d, i) {
        return '<tr><td class="n mgr-dim">' + (i + 1) + '</td><td>' + name(d) + '</td><td class="n">' + H.num(d.audits) + '</td><td class="n">' + H.num(d.checked) + '</td>' +
          '<td class="n">' + H.num(d.rejected) + '</td><td class="n">' + K.rate(d.pct, crit) + '</td><td class="mgr-tbl__lv">' + H.stack(d.levels, 10) + '</td>' +
          '<td><span class="mgr-top">' + K.topLine(d.top) + '</span></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function cards(list, crit) {
    return '<div class="mgr-cards mgr-phone">' + list.map(function (d, i) {
      return '<article class="mgr-card"><div class="mgr-card__head"><span class="rank">' + (i + 1) + '</span><span>' + name(d) + '</span></div>' +
        '<dl class="mgr-card__kv"><dt>Аудитів</dt><dd>' + H.num(d.audits) + '</dd><dt>Перевірено</dt><dd>' + H.num(d.checked) + ' шт</dd>' +
        '<dt>Брак, шт · брак, %' + K.help('term.rate') + '</dt><dd>' + H.num(d.rejected) + ' шт · ' + K.rate(d.pct, crit) + '</dd></dl>' + H.stack(d.levels, 8) +
        '<div class="mgr-top">' + K.topLine(d.top) + '</div></article>';
    }).join('') + '</div>';
  }

  function compareRows(r, locs) {
    var rows = [], by = {};
    r.depts.forEach(function (d) {
      var k = d.deptTypeId + '|' + d.name;
      if (!by[k]) { by[k] = { name: d.name, type: d.deptTypeName, sub: d.deptTypeName !== d.name ? d.deptTypeName : '', cells: {} }; rows.push(by[k]); }
      by[k].cells[d.locationId] = d;
    });
    rows.sort(function (a, b) { return a.type < b.type ? -1 : a.type > b.type ? 1 : (a.name < b.name ? -1 : 1); });
    return rows.filter(function (x) { return locs.some(function (id) { return x.cells[id]; }); });
  }
  function cell(d, crit) {
    if (!d) return '<span class="mgr-dim">такого відділу в локації немає</span>';
    return '<div class="mgr-cmpcell"><span class="mgr-cmpcell__pct">' + K.rate(d.pct, crit) + '</span>' +
      '<span class="mgr-dim">брак ' + H.num(d.rejected) + ' з ' + H.num(d.checked) + ' шт · ' + K.n(d.audits, 'аудит', 'аудити', 'аудитів') + '</span>' +
      H.stack(d.levels, 6) + '<span class="mgr-top">' + K.topLine(d.top) + '</span>' + (d.active ? '' : H.badge('вимкнено')) + '</div>';
  }
  function compare(r, locs, crit) {
    var rows = compareRows(r, locs), names = {};
    r.locations.forEach(function (l) { names[l.id] = l.name; });
    if (!rows.length) return '';
    return '<div class="tbl-box mgr-desk"><table class="tbl mgr-tbl mgr-cmptbl"><thead><tr><th>Відділ</th>' + locs.map(function (id) {
      return '<th>' + P.ic('location', 'ui-icon--sm') + ' ' + esc(names[id]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (x) {
        return '<tr><td><b>' + esc(x.name) + '</b><span class="mgr-dim mgr-block">' + esc(x.sub) + '</span></td>' +
          locs.map(function (id) { return '<td>' + cell(x.cells[id], crit) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="mgr-cards mgr-phone">' + rows.map(function (x) {
        return '<article class="mgr-card"><div class="mgr-card__head"><b>' + esc(x.name) + '</b><span class="mgr-dim">' + esc(x.sub) + '</span></div>' +
          locs.map(function (id) { return '<div class="mgr-cmpline"><span class="mgr-cmpline__loc">' + P.ic('location', 'ui-icon--sm') + esc(names[id]) + '</span>' + cell(x.cells[id], crit) + '</div>'; }).join('') +
          '</article>';
      }).join('') + '</div>';
  }

  P.cab.tab({ id: 'depts', label: 'Відділи', ic: 'department', path: '/depts', order: 20 });
  P.cab.screen('/depts', { tab: 'depts', title: 'Відділи', period: true, render: function (ctx) {
    var req = 0, last = null;
    function load() {
      var my = ++req, box = ctx.el.querySelector('#mgr-dl');
      if (box) box.classList.add('mgr-busy');   // фільтр змінили — старі числа тьмяніють, доки не прийдуть нові
      var p = { from: ctx.period.from, to: ctx.period.to, deptTypeId: st.type };
      if (st.locs.length) p.locationIds = st.locs;
      P.srv('mgrDepts', p).then(function (r) {
        if (!ctx.alive() || my !== req) return;
        if (!r.ok && (r.code === 'not_found' || r.code === 'validation') && (st.locs.length || st.type)) { st.locs = []; st.type = ''; load(); return; }   // вибір на те, чого вже немає
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        if (!st.locs.length) { st.locs = r.locations.length ? [r.locations[0].id] : []; if (st.locs.length) { load(); return; } }   // перший захід — перша локація
        last = r; draw(r);
      });
    }
    function draw(r) {
      var types = [['', 'Усі відділи']].concat(r.deptTypes.map(function (t) { return [t.id, t.name]; }));
      var many = st.many && st.locs.length > 1, names = r.locations.filter(function (l) { return st.locs.indexOf(l.id) >= 0; }).map(function (l) { return l.name; });
      var tname = st.type ? types.filter(function (t) { return t[0] === st.type; })[0][1] : 'усі відділи';
      var list = sorted(r.depts), scope = names.join(' · ') + ' · ' + tname;
      var body = many ? compare(r, st.locs, r.criticalPct) : list.length ? table(list, r.criticalPct) + cards(list, r.criticalPct) : '';
      ctx.el.innerHTML = '<section class="mgr-page"><div><h2 class="h2">' + (many ? 'Порівняння локацій · ' + esc(tname) : 'Рейтинг відділів · ' + esc(names[0] || '') + ' · ' + list.length) + '</h2>' +
        '<p class="h2-sub">' + esc(K.span(r.from, r.to)) + ' · ' + esc(K.asOf(r.asOf)) + ' · брак рахується відділу, який його зробив' + K.help('mgr.deptBrak') + '</p></div>' +
        '<div class="card mgr-gap mgr-gap--sm">' + K.locBar('mgr-d', r.locations, st.locs, st.many) +
        '<div class="mgr-pick"><span class="mgr-pick__l">Відділ' + K.help('mgr.deptPick') + '</span>' + K.chips('mgr-d-type', types, st.type, 'Відділ') + '</div>' +
        (many ? '' : '<div class="mgr-pick"><span class="mgr-pick__l">Порядок</span>' + K.pills('mgr-d-sort', SORTS, st.sort, 'Сортування') + '</div>') +
        (st.many && st.locs.length < 2 ? '<p class="hint">Оберіть ще одну локацію вище — вони стануть поруч.</p>' : '') + '</div>' +
        '<div id="mgr-dl" class="card">' + (body || H.empty('Відділів не знайдено', scope + ' · спробуйте інший відділ чи локацію.')) + '</div></section>';
    }
    ctx.on('mgr-d-loc', function (t) { st.locs = K.pickLocs(st.locs, t.getAttribute('data-v'), st.many); load(); });
    ctx.on('mgr-d-many', function () {
      st.many = !st.many;
      if (!st.many && st.locs.length > 1) { st.locs = st.locs.slice(0, 1); load(); } else if (last) draw(last);
    });
    ctx.on('mgr-d-type', function (t) { st.type = t.getAttribute('data-v'); load(); });
    ctx.on('mgr-d-sort', function (t) { st.sort = t.getAttribute('data-v'); if (last) draw(last); });
    load();
  } });
})(window);
