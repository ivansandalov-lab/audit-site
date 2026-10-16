(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;
  var help = function (k) { return P.help ? P.help.btn(k) : ''; };
  var SORT = {
    name: function (x) { return x.name; },
    rate: function (x) { return x.rate; },
    acts: function (x) { return x.kds; },
    before: function (x) { return x.last ? x.last.before : null; },
    after: function (x) { return x.last ? x.last.after : null; },
    diff: function (x) { return x.last ? x.last.delta : null; }
  };

  K.sdState = function (ui, id) { return ui[id] || (ui[id] = { find: '', sort: 'rate', dir: -1 }); };

  K.sdHead = function () {
    return '<div class="kd-dl-head"><span>Відділ</span><span>КД усього' + help('kd.stats.total') + '</span><span>Без плану' + help('kd.state.over') + '</span>' +
      '<span>Спостерігаємо' + help('kd.stats.pending') + '</span><span>Рецидиви' + help('kd.state.relapse') + '</span><span>Пункти після дії' + help('kd.stats.effect') + '</span><span></span></div>';
  };
  K.sdRow = function (d, open) {
    var c = d.states, e = d.effect;
    var n = function (v, label, state) {
      return '<span class="kd-dr__n' + (v ? '' : ' kd-dr__n--zero') + '" data-l="' + esc(label) + '">' + (state && v ? H.kdMark(state, label) : '') + '<b>' + v + '</b></span>';
    };
    var eff = e ? '<b>' + esc(signed(e.pp) + ' в. п.' + (e.rel ? ' · ' + signed(e.rel) + '%' : '')) + '</b><span>' + esc('середнє по ' + K.plural(e.n, 'пункту', 'пунктах', 'пунктах') + ' · 1-й тиждень після впровадження') + '</span>'
      : '<span>ще немає пунктів, де 1-й тиждень після впровадження закінчився</span>';
    return '<div class="kd-dr' + (open ? ' kd-dr--open' : '') + '"><button class="kd-dr__btn" type="button" data-act="kd-open-dept" data-id="' + esc(d.id) + '" aria-expanded="' + open + '">' +
      '<span class="kd-dr__name">' + esc(d.name) + '<span class="kd-dr__sub">останній тиждень: ' + K.pct(d.weekRate) + '</span></span>' + n(d.total, 'КД усього') + n((c.over || 0) + (c.pre || 0) + (c.decide || 0), 'Без плану (понад норму, не почато · відкрито достроково · потрібне рішення)', 'over') +
      n(c.watch + c.hold, 'Спостерігаємо', 'hold') + n(c.relapse, 'Рецидиви', 'relapse') + '<span class="kd-dr__eff" data-l="Пункти після дії">' + eff + '</span>' +
      '<span class="kd-dr__chev">' + P.ic(open ? 'chevron-up' : 'chevron-down') + '</span></button></div>';
  };
  function signed(v) { return v === 0 ? '0' : (v > 0 ? '+' : '−') + String(Math.abs(v)).replace('.', ','); }

  function baCell(x) {
    var a = x.last;
    if (!a) return '<span class="kd-sr__nob"><span class="kd-sr__hint">пунктом КД не був</span></span>';
    var head = '<span class="kd-sr__hint">' + esc(K.week(a.periodStart, a.periodEnd)) + '</span>';
    if (a.after != null && a.result && !a.result.pending) return head + '<b class="kd-nowrap">' + K.pct(a.before) + ' → ' + K.pct(a.after) + '</b><span class="kd-sr__diff">' + esc(K.change(a.before, a.after)) + '</span>' + K.stateBadge(a);
    if (a.result && a.result.pending) return head + '<b class="kd-nowrap">' + K.pct(a.before) + ' → ' + (a.after != null ? 'поки ' + K.pct(a.after) : '…') + '</b>' + K.stateBadge(a);
    return head + '<b class="kd-nowrap">' + K.pct(a.before) + '</b>' + K.stateBadge(a);
  }
  function rowHtml(d, x) {
    var ref = ' data-dep="' + esc(d.id) + '" data-type="' + esc(x.defectTypeId) + '"';
    return '<div class="kd-sr' + (x.last && ['pre', 'decide', 'over', 'watch', 'hold'].indexOf(x.last.state) >= 0 ? ' kd-sr--over' : '') + '" data-act="kd-tw"' + ref + '>' +
      '<span class="kd-sr__name"><button class="kd-t__btn" type="button" data-act="kd-tw"' + ref + '>' + esc(x.name) + '</button>' +
      '<span class="kd-t__sub">' + H.lvl(x.level) + (x.active ? '' : '<span class="hint">вимкнений у довіднику</span>') + '</span></span>' +
      '<span class="kd-sr__now" data-l="Зараз"><b>' + K.pct(x.rate) + '</b><span class="kd-sr__hint">' + K.pct(x.share) + ' браку</span></span>' +
      '<span class="kd-sr__acts" data-l="У КД"><b>' + x.kds + '</b></span>' +
      '<span class="kd-sr__ba">' + baCell(x) + '</span>' +
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
    var rows = list.length ? list.map(function (x) { return rowHtml(d, x); }).join('')
      : '<p class="kd-text kd-types__none">' + (d.types.length ? 'Видів браку з такою назвою у відділі немає.' : 'У довіднику відділу немає видів браку.') + '</p>';
    var box = el.querySelector('[data-kd-sd-list]');
    if (keepFind && box) { box.innerHTML = rows; return; }
    var rv = r.review;
    el.innerHTML = '<div class="kd-sd__tools"><label class="kd-find">' + P.ic('search', 'ui-icon--sm') + '<input class="input" type="search" data-input="kd-sd-find" value="' + esc(u.find) +
      '" placeholder="Назва виду браку" aria-label="Пошук виду браку за назвою"></label>' + sortBtn(u, 'name', 'За назвою') +
      K.cap('«Зараз» — % виду браку від перевірених у відділі за останній завершений тиждень (' + esc(K.rangeShort(rv.start, rv.end)) + ') і його частка браку відділу. «У КД» — у скількох КД за ' + r.days +
        ' днів вид був пунктом. «До → після» — % виду браку в останній такій КД: за тиждень КД і за перший тиждень після впровадження.') + '</div>' +
      '<div class="kd-sd__scroll"><div class="kd-sr kd-sr--head"><span>Вид браку' + help('term.defectType') + '</span>' +
      '<span>' + sortBtn(u, 'rate', 'Зараз, %') + help('kd.stats.now') + '</span><span>' + sortBtn(u, 'acts', 'У КД') + help('kd.stats.acts') + '</span>' +
      '<span class="kd-sr__bahead">' + sortBtn(u, 'before', 'До') + sortBtn(u, 'after', 'Після') + sortBtn(u, 'diff', 'Різниця') + help('kd.beforeAfter') + '</span>' +
      '<span>Маршрут' + help('kd.route') + '</span></div><div data-kd-sd-list>' + rows + '</div></div>';
  };
})(window);
