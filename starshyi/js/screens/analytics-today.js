(function (root) {
  'use strict';
  var P = root.P, h = P.sr.h, esc = P.esc, A = P.srAn, X = P.srAnParts;
  var AUD = ['аудит', 'аудити', 'аудитів'];

  function tileTop(name, on, p) {
    return '<span class="an-tile__head"><b class="an-tile__name">' + esc(name) + '</b>' +
      (on ? '<span class="an-tile__on">' + h.ic('check', 'ui-icon--sm') + 'обрано</span>' : '') + '</span>' +
      '<span class="an-tile__hero"><b class="an-tile__pct">' + h.pct(p.pct) + '</b><span class="an-tile__cap">брак, % за ' + X.dn(p.days) + '</span></span>' +
      '<span class="an-tile__sub">' + (p.audits ? h.num(p.rejected) + ' з ' + h.num(p.checked) + ' шт · ' + A.n(p.audits, AUD[0], AUD[1], AUD[2]) : 'аудитів за період не було') + '</span>' +
      h.stack(p.levels, 6);
  }
  function todayNums(d) {
    if (!d.audits) return (d.target != null ? 'норма дня ' + h.num(d.target) + ' шт' : 'норма дня не задана') + (d.rejected ? ' · брак ' + h.num(d.rejected) + ' шт' : '');
    return '<b>' + h.num(d.checked) + '</b>' + (d.target != null ? ' / ' + h.num(d.target) : '') + ' шт · брак <b>' + h.num(d.rejected) + ' шт</b> · ' + h.pct(d.pct);
  }
  function tile(id, on, top, today, sparkLabel) {
    return '<div class="an-tile' + (on ? ' an-tile--on' : '') + '"><button class="an-tile__hit" type="button" data-act="an-dep" data-id="' + esc(id) + '" aria-pressed="' + on + '">' +
      top + '<span class="an-tile__sep"></span>' + today + '</button>' +
      '<div class="an-tile__spark" data-spark="' + esc(id) + '" aria-label="' + esc(sparkLabel) + '"></div></div>';
  }
  function tiles(view) {
    var r = view.data, all = r.todayAll, box = view.box('an-tiles');
    if (!box) return;
    var allToday = '<span class="an-tile__today"><span class="an-tile__lbl">Сьогодні</span><span class="an-st">' + A.n(all.audits, AUD[0], AUD[1], AUD[2]) + '</span></span>' +
      '<span class="an-segs" role="img" aria-label="Відділів: норму виконано — ' + all.done + ', ще не виконано — ' + all.part + ', аудитів не було — ' + all.none + '">' +
      r.todayDepts.map(function (d) { return X.scale(d, 'sm'); }).join('') + '</span>' +
      '<span class="an-tile__nums">' + (all.audits ? '<b>' + h.num(all.checked) + '</b> шт · брак <b>' + h.num(all.rejected) + ' шт</b> · ' + h.pct(all.pct) : 'аудитів сьогодні не було') + '</span>';
    box.innerHTML = tile('', !view.dep, tileTop('Усі відділи', !view.dep, all.period), allToday, 'Усі відділи: брак по днях, шт') +
      r.todayDepts.map(function (d) {
        var on = view.dep === d.id;
        return tile(d.id, on, tileTop(d.name, on, d.period),
          '<span class="an-tile__today"><span class="an-tile__lbl">Сьогодні</span>' + X.stateBadge(d) + '</span>' + X.scale(d, 'sm') +
          '<span class="an-tile__nums">' + todayNums(d) + '</span>', d.name + ': брак по днях, шт');
      }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('[data-spark]'), function (el) {
      var id = el.getAttribute('data-spark'), src = id ? r.todayDepts.filter(function (d) { return d.id === id; })[0] : all;
      P.srChart.mount(el, { mini: true, height: 30, label: el.getAttribute('aria-label'),
        items: src.spark.map(function (d) { return { key: d.day, v: d.rejected, levels: d.levels, none: !d.audits && !d.rejected, d: d }; }),
        tip: function (it) { return X.dayTip(it.d, id ? 'Норма дня' : 'Норма дня, усі відділи', id ? src.name : 'Усі відділи'); } });
    });
    var n = all.spark.length, key = view.box('an-tiles-key');
    if (key) key.innerHTML = '<div class="legend an-switch__key"><span>Плитка перемикає всю сторінку на відділ' + A.q('sr.an.tiles') + '</span>' +
      '<span class="an-key"><i class="an-scale an-scale--none an-scale--key"></i>сьогодні аудитів не було</span>' +
      '<span class="an-key"><span class="an-scale an-scale--part an-scale--key"><i class="an-scale__fill" style="width:55%"></i><i class="an-scale__miss" style="width:45%"></i></span>бракує до норми дня</span>' +
      '<span class="an-key"><span class="an-scale an-scale--done an-scale--key"><i class="an-scale__fill" style="width:100%"></i></span>норму дня виконано</span>' +
      ['fix', 'repair', 'scrap'].map(function (k) { return h.lvl(k); }).join('') +
      '<span>стовпчики — брак по днях, шт · ' + (n === 1 ? 'останній день' : 'останні ' + X.dn(n)) + ' періоду</span></div>';
  }

  var TITLE = { none: 'Аудитів сьогодні не було', part: 'Норму дня ще не виконано', done: 'Норму дня виконано', nonorm: 'Норма дня не задана' };
  function hero(d) {
    var t = d.target, over = d.state === 'done' && d.checked > t;
    var big = d.state === 'none' ? '<b class="an-hero__n an-hero__n--mute">0</b><span>шт перевірено' + (t != null ? ' · норма дня ' + h.num(t) + ' шт' : '') + '</span>'
      : '<b class="an-hero__n">' + h.num(d.checked) + '</b><span>' + (t != null ? 'шт перевірено · норма дня ' + h.num(t) + ' шт' : 'шт перевірено') + '</span>';
    var last = d.state !== 'none' ? '' : '<p class="hint">' + (d.lastDay ? 'Останній аудит у відділі — ' + esc(A.ago(d.lastDay)) + ', ' + esc(A.dshort(d.lastDay)) : 'Аудитів у цьому відділі ще не було') + '</p>';
    var top = d.state === 'part' ? '<span class="an-miss" style="width:' + (d.missing / t * 100).toFixed(1) + '%"><b>бракує ' + h.num(d.missing) + ' шт</b></span>' : '';
    var axis = '<span>0</span>' + (over ? '<span class="an-hero__tick" style="left:' + (t / d.checked * 100).toFixed(1) + '%">норма ' + h.num(t) + ' шт</span><span>' + h.num(d.checked) + ' шт</span>'
      : '<span>' + (t != null ? 'норма дня ' + h.num(t) + ' шт' : '') + '</span>');
    return '<div class="an-hero an-hero--' + d.state + '"><div class="an-hero__main"><p class="an-hero__title">' + (d.state === 'done' ? h.ic('check') : '') + TITLE[d.state] + '</p>' +
      '<p class="an-hero__big">' + big + '</p>' + last + '</div>' +
      '<div class="an-hero__scale"><div class="an-hero__top">' + top + '</div>' + X.scale(d, 'lg') + '<div class="an-hero__axis">' + axis + '</div></div></div>';
  }
  function who(workers) {
    return workers.map(function (w) {
      return esc(w.name) + ' ' + h.num(w.pieces) + ' шт' + (w.helper ? ' <span class="badge an-help">допомога</span>' : '');
    }).join(', ');
  }
  function todayDept(view) {
    var r = view.data, dep = r.department, d = r.todayDepts.filter(function (x) { return x.id === dep.id; })[0], t = r.todayDetail;
    var head = '<div class="card-head an-today__head"><div style="flex:1;min-width:220px"><h2 class="card-title">Сьогодні · ' + esc(dep.name) + A.q('sr.an.today') + '</h2>' +
      '<p class="hint">' + esc(A.dcap(r.today)) + ' · станом на ' + P.fmt.time(r.asOf) + '</p></div></div>';
    if (!t.audits.length && !t.types.length && !t.others.length) return head + hero(d);
    var lv = A.total(d.levels);
    var kpis = '<div class="kpis an-kpis4">' + h.kpi(h.num(d.audits), P.plural(d.audits, AUD[0], AUD[1], AUD[2]) + ' сьогодні') +
      A.kpi(h.num(d.rejected), 'брак відділу, шт', 'sr.an.deptRejected') +
      A.kpi(h.pct(d.pct), d.pct == null ? 'брак, % · перевіреного у відділі немає' : 'брак, % = ' + h.num(d.rejected) + ' шт ÷ ' + h.num(d.checked) + ' перевірених', 'term.rate') +
      '<div class="kpi an-kpi-lv"><span class="kpi__label" style="margin:0">рівні браку дня, шт' + A.q('term.levels') + '</span>' + (lv ? h.legend(d.levels) + h.stack(d.levels, 10) : '<span class="hint">браку немає</span>') + '</div></div>';
    var audits = '<div class="col an-list"><h3 class="an-h3">Аудити дня · ' + t.audits.length + '</h3>' + (t.audits.length ? '<p class="hint">Нові зверху · натисніть — увесь аудит збоку</p><div class="list">' +
      t.audits.map(function (a) {
        return '<button class="row-item an-arow" type="button" data-act="an-aud" data-id="' + esc(a.id) + '"><b class="an-arow__t">' + P.fmt.time(a.createdAt) + '</b>' +
          '<span class="row-item__main"><span class="row-item__title">' + esc(a.auditorName) + '</span><span class="row-item__meta">' + esc(a.products.join(', ') + (a.orders.length ? ' · ' + a.orders.join(', ') : '')) + '</span></span>' +
          '<span class="an-arow__n"><b>' + h.num(a.checked) + ' шт</b><span class="sub">брак ' + X.brak(a.rejected, a.pct) + '</span>' +
          (a.foreign ? '<span class="sub">з них ' + h.num(a.foreign) + ' шт — іншого відділу</span>' : '') + '</span></button>';
      }).join('') + '</div>' : '<p class="hint">У відділі аудитів сьогодні не було.</p>') + '</div>';
    var types = '<div class="col an-list"><h3 class="an-h3">Види браку дня · ' + h.num(d.rejected) + ' шт</h3>' + (t.types.length ? '<p class="hint">Брак цього відділу · рівень · у кого · натисніть — екран виду браку</p><div class="list">' +
      t.types.map(function (x) {
        return '<a class="row-item" href="#/analytics/defect/' + encodeURIComponent(x.id) + '?dep=' + encodeURIComponent(dep.id) + '"><span class="row-item__main"><span class="row-item__title">' + esc(x.name) + '</span>' +
          '<span class="row-item__meta an-who">' + h.lvl(x.level) + '<span>' + who(x.workers) + '</span></span></span><b class="an-arow__n">' + h.num(x.pieces) + ' шт</b></a>';
      }).join('') + '</div>' : '<p class="hint">Браку цього відділу сьогодні не знайдено.</p>') +
      (t.others.length ? '<h3 class="an-h3 an-h3--gap">Брак інших відділів, знайдений тут · ' + h.num(t.others.reduce(function (s, o) { return s + o.pieces; }, 0)) + ' шт' + A.q('term.otherDept') + '</h3>' +
        '<p class="hint">Зарахований відділу-джерелу — у брак відділу «' + esc(dep.name) + '» не входить.</p><div class="list">' +
        t.others.map(function (o) {
          return '<div class="row-item"><span class="row-item__main"><span class="row-item__title">' + esc(o.typeName) + '</span><span class="row-item__meta an-who">' + h.lvl(o.level) +
            '<span>брак відділу «' + esc(o.departmentName) + '»</span></span></span><b class="an-arow__n">' + h.num(o.pieces) + ' шт</b></div>';
        }).join('') + '</div>' : '') + '</div>';
    return head + hero(d) + kpis + '<div class="row">' + audits + types + '</div>';
  }

  function todayAll(view) {
    var r = view.data, a = r.todayAll;
    var head = '<div class="card-head an-today__head"><div style="flex:1;min-width:220px"><h2 class="card-title">Сьогодні · усі відділи' + A.q('sr.an.today') + '</h2>' +
      '<p class="hint">' + esc(A.dcap(r.today)) + ' · станом на ' + P.fmt.time(r.asOf) + ' · шкала — перевірено проти норми дня · натисніть відділ — його сторінка</p></div>' +
      '<p class="an-today__sum"><span class="an-today__line">' + (a.audits ? '<b>' + A.n(a.audits, AUD[0], AUD[1], AUD[2]) + '</b> · перевірено <b>' + h.num(a.checked) + ' шт</b> · брак <b>' + X.brak(a.rejected, a.pct) + '</b>' : '<b>Аудитів сьогодні не було</b>') + '</span>' +
      '<span>відділів: норму виконано — ' + a.done + ' · ще не виконано — ' + a.part + ' · без аудитів — ' + a.none + '</span></p></div>';
    return head + '<div class="an-drows">' + r.todayDepts.map(function (d) {
      var when = d.lastTodayAt ? 'останній аудит о ' + P.fmt.time(d.lastTodayAt) : d.lastDay ? 'останній аудит ' + A.ago(d.lastDay) : 'аудитів ще не було';
      return '<button class="an-drow" type="button" data-act="an-dep" data-id="' + esc(d.id) + '"><b class="an-drow__name">' + esc(d.name) + '</b>' + X.scale(d, 'md') +
        '<span class="an-drow__n"><b>' + h.num(d.checked) + '</b>' + (d.target != null ? ' / ' + h.num(d.target) : '') + ' шт</span>' +
        '<span class="an-drow__b">' + (d.audits || d.rejected ? 'брак ' + X.brak(d.rejected, d.pct) : 'брак, шт —') + '</span>' +
        '<span class="an-drow__st">' + X.stateBadge(d) + '<span class="an-drow__when">' + esc(when) + '</span></span>' + h.ic('chevron-right', 'ui-icon--sm') + '</button>';
    }).join('') + '</div>';
  }

  X.today = {
    tiles: tiles,
    draw: function (view) {
      tiles(view);
      var box = view.box('an-today');
      box.className = 'card an-today';
      box.innerHTML = view.data.department ? todayDept(view) : todayAll(view);
    },
    bind: function (view) {
      view.ctx.on('an-aud', function (t) { if (P.srHist) P.srHist.openAudit(t.getAttribute('data-id')); });
    }
  };
})(window);
