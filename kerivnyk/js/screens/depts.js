(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, K = P.mgr;
  var SORTS = [['pct', 'За % браку'], ['checked', 'За перевіреними, шт']];
  var st = { sort: 'pct', loc: '', type: '' };

  function sorted(list) {
    return list.slice().sort(function (a, b) {
      if (st.sort === 'checked') return b.checked - a.checked || (a.name < b.name ? -1 : 1);
      if (a.pct == null || b.pct == null) return a.pct == null ? (b.pct == null ? b.checked - a.checked : 1) : -1;
      return b.pct - a.pct || b.checked - a.checked;
    });
  }
  function name(d) {
    return '<b>' + esc(d.name) + '</b>' + (d.active ? '' : ' ' + H.badge('вимкнено')) + '<span class="mgr-dim mgr-block">' + esc(d.locationName) + '</span>';
  }
  function table(list, crit) {
    return '<div class="tbl-box mgr-desk"><table class="tbl mgr-tbl"><thead><tr><th class="n">№</th><th>Відділ</th><th class="n">Аудитів</th>' +
      '<th class="n">Перевірено, шт</th><th class="n">Брак, шт</th><th class="n">Брак, %</th><th>Рівні браку</th><th>Найчастіші види браку</th></tr></thead><tbody>' +
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
        '<dt>Брак</dt><dd>' + H.num(d.rejected) + ' шт · ' + K.rate(d.pct, crit) + '</dd></dl>' + H.stack(d.levels, 8) +
        '<div class="mgr-top">' + K.topLine(d.top) + '</div></article>';
    }).join('') + '</div>';
  }

  P.cab.tab({ id: 'depts', label: 'Відділи', ic: 'department', path: '/depts', order: 20 });
  P.cab.screen('/depts', { tab: 'depts', title: 'Відділи', period: true, render: function (ctx) {
    var req = 0, last = null;
    function load() {
      var my = ++req, box = ctx.el.querySelector('#mgr-dl');
      if (box) box.classList.add('mgr-busy');   // фільтр змінили — старі числа тьмяніють, доки не прийдуть нові
      P.srv('mgrDepts', { from: ctx.period.from, to: ctx.period.to, locationId: st.loc, deptTypeId: st.type }).then(function (r) {
        if (!ctx.alive() || my !== req) return;
        if (!r.ok && r.code === 'not_found' && (st.loc || st.type)) { st.loc = st.type = ''; load(); return; }   // фільтр на те, чого вже немає
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        last = r; draw(r);
      });
    }
    function draw(r) {
      var list = sorted(r.depts), types = [['', 'Усі типи відділів']].concat(r.deptTypes.map(function (t) { return [t.id, t.name]; }));
      var locs = [['', 'Усі локації']].concat(r.locations.map(function (l) { return [l.id, l.name]; }));
      var scope = (r.location ? r.location.name : 'Усі локації') + (st.type ? ' · ' + types.filter(function (t) { return t[0] === st.type; })[0][1] : '');
      ctx.el.innerHTML = '<section class="mgr-page"><div><h2 class="h2">Рейтинг відділів · ' + list.length + '</h2><p class="h2-sub">' + esc(scope) + ' · ' +
        esc(K.span(r.from, r.to)) + ' · ' + esc(K.asOf(r.asOf)) + ' · брак рахується відділу, який його зробив ' +
        K.help('Брак відділу — штуки, де винний цей відділ (хоч би де їх знайшли). Перевірено — штуки, перевірені в аудитах цього відділу.') + '</p></div>' +
        '<div class="mgr-bar">' + K.select('mgr-d-loc', locs, st.loc, 'Локація') + K.select('mgr-d-type', types, st.type, 'Тип відділу') +
        K.pills('mgr-d-sort', SORTS, st.sort, 'Сортування') + '</div>' +
        '<div id="mgr-dl" class="card">' + (list.length ? table(list, r.criticalPct) + cards(list, r.criticalPct)
          : H.empty('Відділів не знайдено', scope + ' · спробуйте інший тип відділу чи локацію.')) + '</div></section>';
    }
    ctx.on('mgr-d-loc', function (t) { st.loc = t.value; load(); });
    ctx.on('mgr-d-type', function (t) { st.type = t.value; load(); });
    ctx.on('mgr-d-sort', function (t) { st.sort = t.getAttribute('data-v'); if (last) draw(last); });
    load();
  } });
})(window);
