(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;
  var help = function (k) { return P.help ? P.help.btn(k) : ''; };
  var SORT = {
    name: function (x) { return x.name; },
    rate: function (x) { return x.rate; },
    acts: function (x) { return x.actions; },
    before: function (x) { return x.last ? x.last.rate : null; },
    after: function (x) { var a = x.last; return !a ? null : a.after != null ? a.after : a.interim ? a.interim.rate : null; },
    diff: function (x) { var a = x.last; return a && a.after != null ? Math.round((a.after - a.rate) * 10) / 10 : null; }
  };

  K.sdState = function (ui, id) { return ui[id] || (ui[id] = { find: '', sort: 'rate', dir: -1 }); };

  K.sdHead = function () {
    return '<div class="kd-dl-head"><span>Відділ</span><span>Дій усього' + help('kd.stats.total') + '</span><span>Активні' + help('kd.stats.active') + '</span>' +
      '<span>На спостереженні' + help('kd.state.watch') + '</span><span>Рецидиви' + help('kd.state.relapse') + '</span><span>Зміна після дії' + help('kd.stats.effect') + '</span><span></span></div>';
  };
  K.sdRow = function (d, open, r) {
    var c = d.counts, e = d.effect;
    var n = function (v, label, state) {
      return '<span class="kd-dr__n' + (v ? '' : ' kd-dr__n--zero') + '" data-l="' + esc(label) + '">' + (state && v ? H.kdMark(state, label) : '') + '<b>' + v + '</b></span>';
    };
    var eff = e ? '<b>' + esc(signed(e.pp) + ' в. п. · ' + signed(e.rel) + '%') + '</b><span>' + esc('середнє з ' + K.plural(e.n, 'дії', 'дій', 'дій') + ' з результатом') + '</span>'
      : '<span>дій із результатом немає</span>';
    return '<div class="kd-dr' + (open ? ' kd-dr--open' : '') + '"><button class="kd-dr__btn" type="button" data-act="kd-open-dept" data-id="' + esc(d.id) + '" aria-expanded="' + open + '">' +
      '<span class="kd-dr__name">' + esc(d.name) + '</span>' + n(c.total, 'Дій усього') + n(c.active, 'Активні', 'work') + n(c.watch, 'На спостереженні', 'watch') +
      n(c.relapse, 'Рецидиви', 'relapse') + '<span class="kd-dr__eff" data-l="Зміна після дії">' + eff + '</span>' +
      '<span class="kd-dr__chev">' + P.ic(open ? 'chevron-up' : 'chevron-down') + '</span></button></div>';
  };
  function signed(v) { return v === 0 ? '0' : (v > 0 ? '+' : '−') + String(Math.abs(v)).replace('.', ','); }

  function baCell(x, T, today) {
    var a = x.last;
    if (!a) return '<span class="kd-sr__nob">' + K.loadBar(x.rate, T, x.low) + '<span class="kd-sr__hint">дій не було</span></span>';
    if (a.after != null) return '<b class="kd-nowrap">' + K.pct(a.rate) + ' → ' + K.pct(a.after) + '</b><span class="kd-sr__diff">' + esc(K.change(a.rate, a.after)) + '</span>' + K.stateBadge(a, today);
    if (a.status === 'check') return '<b class="kd-nowrap">' + K.pct(a.rate) + ' → ' + (a.interim ? 'поки ' + K.pct(a.interim.rate) : '…') + '</b>' + K.stateBadge(a, today);
    if (a.status === 'started') return '<b class="kd-nowrap">' + K.pct(a.rate) + ' → …</b>' + K.stateBadge(a, today);
    return '<b class="kd-nowrap">' + K.pct(a.rate) + '</b>' + K.stateBadge(a, today);
  }
  function rowHtml(d, x, r) {
    var ref = ' data-dep="' + esc(d.id) + '" data-type="' + esc(x.defectTypeId) + '"', T = r.threshold;
    return '<div class="kd-sr' + (x.over ? ' kd-sr--over' : '') + '" data-act="kd-tw"' + ref + '>' +
      '<span class="kd-sr__name"><button class="kd-t__btn" type="button" data-act="kd-tw"' + ref + '>' + esc(x.name) + '</button>' +
      '<span class="kd-t__sub">' + H.lvl(x.level) + (x.active ? '' : '<span class="hint">вимкнений у довіднику</span>') + '</span></span>' +
      '<span class="kd-sr__now" data-l="Зараз"><b' + (x.over ? ' class="kd-hot"' : '') + '>' + K.pct(x.rate) + '</b></span>' +
      '<span class="kd-sr__acts" data-l="Дій"><b>' + x.actions + '</b></span>' +
      '<span class="kd-sr__ba">' + baCell(x, T, r.today) + '</span>' +
      '<span class="kd-sr__route" data-l="Маршрут">' + K.routeMarks(x.route, ref) + '</span></div>';
  }
  function sortBtn(u, k, label) {
    var on = u.sort === k;
    return '<button class="kd-sort' + (on ? ' kd-sort--on' : '') + '" type="button" data-act="kd-sd-sort" data-v="' + k + '" aria-pressed="' + on + '">' + esc(label) +
      (on ? P.ic(u.dir < 0 ? 'arrow-down' : 'arrow-up', 'ui-icon--sm') : '') + '</button>';
  }
  function listOf(d, u) {
    var f = u.find.trim().toLowerCase(), get = SORT[u.sort] || SORT.rate;
    return d.types.filter(function (x) { return !f || x.name.toLowerCase().indexOf(f) >= 0; }).sort(function (a, b) {
      var va = get(a), vb = get(b);
      if (va == null || vb == null) return va == null && vb == null ? 0 : va == null ? 1 : -1;   // без числа — завжди внизу
      var c = typeof va === 'string' ? va.localeCompare(vb, 'uk') : va - vb;
      return c * u.dir || a.name.localeCompare(b.name, 'uk');
    });
  }
  K.sdPanel = function (el, d, u, r, keepFind) {
    var list = listOf(d, u);
    var rows = list.length ? list.map(function (x) { return rowHtml(d, x, r); }).join('')
      : '<p class="kd-text kd-types__none">' + (d.types.length ? 'Видів браку з такою назвою у відділі немає.' : 'У довіднику відділу немає видів браку.') + '</p>';
    var box = el.querySelector('[data-kd-sd-list]');
    if (keepFind && box) { box.innerHTML = rows; return; }
    var T = r.threshold, rv = r.review;
    el.innerHTML = '<div class="kd-sd__tools"><label class="kd-find">' + P.ic('search', 'ui-icon--sm') + '<input class="input" type="search" data-input="kd-sd-find" value="' + esc(u.find) +
      '" placeholder="Назва виду браку" aria-label="Пошук виду браку за назвою"></label>' + sortBtn(u, 'name', 'За назвою') +
      K.cap('«Зараз» — частка виду браку в останньому повному розборі (' + esc(K.rangeShort(rv.start, rv.end)) + '). «Дій» — за ' + r.days + ' днів. «До → після» — остання дія за весь час. Норма — ' + T + '%.') + '</div>' +
      '<div class="kd-sd__scroll"><div class="kd-sr kd-sr--head"><span>Вид браку' + help('term.defectType') + '</span>' +
      '<span>' + sortBtn(u, 'rate', 'Зараз, %') + help('kd.stats.now') + '</span><span>' + sortBtn(u, 'acts', 'Дій') + help('kd.stats.acts') + '</span>' +
      '<span class="kd-sr__bahead">' + sortBtn(u, 'before', 'До') + sortBtn(u, 'after', 'Після') + sortBtn(u, 'diff', 'Різниця') + help('kd.beforeAfter') + '</span>' +
      '<span>Маршрут' + help('kd.route') + '</span></div><div data-kd-sd-list>' + rows + '</div></div>';
  };
})(window);
