(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, K = P.mgr;
  var NOW = ['pre', 'decide', 'over', 'watch', 'hold'], DONE = ['done', 'part', 'relapse', 'skip'];   // зараз (як іде дія) і завершені за період
  var WORD = { ok: 'у нормі', pre: 'відкрито достроково, тиждень ще йде', decide: 'потрібне рішення старшого: тиждень у нормі', over: 'відкрито, ще не впроваджено',
    work: 'в роботі (старий запис)', watch: 'впроваджено · йде тиждень після впровадження', hold: 'під наглядом', done: 'закрито: тримається',
    part: 'закрито: її види браку нижче, ніж до дії', relapse: 'рецидив', skip: 'дія не потрібна' };

  function n(v) { return v == null ? '—' : H.num(v); }
  function dd(v) {
    if (v == null) return '—';
    var r = Math.round(v * 10) / 10;
    return String(r).replace('.', ',') + ' ' + (r % 1 ? 'дня' : P.plural(r, 'день', 'дні', 'днів'));
  }
  function word(s) { return WORD[s] || (P.sr.KD_STATES[s] ? P.sr.KD_STATES[s].label : s); }
  function stHelp(s) { return WORD[s] ? K.help('mgr.kd.state.' + s) : ''; }
  function day(v) { return v ? K.day(String(v).slice(0, 10)) : '—'; }
  function between(a, b) { return a && b ? Math.round((Date.parse(String(b).slice(0, 10)) - Date.parse(String(a).slice(0, 10))) / 86400000) : null; }
  function canon(s) { return P.sr.KD_STATES[s] ? s : P.sr.kdStateOf(s); }
  function causeName(kd, c) { var x = (kd.causes || []).filter(function (o) { return o.id === c; })[0]; return x ? K.causeName(x.id, x.label) : K.causeName(c, c); }

  function split(parts, label) {
    var sum = parts.reduce(function (s, x) { return s + (x[0] || 0); }, 0);
    return '<div class="mgr-split" role="img" aria-label="' + esc(label + ': ' + parts.map(function (x) { return x[2] + ' ' + (x[0] || 0); }).join(', ')) + '">' +
      (sum ? parts.map(function (x) { return x[0] ? '<i style="flex-grow:' + x[0] + ';background:var(--kd-' + x[1] + ')" title="' + esc(x[2] + ': ' + x[0]) + '"></i>' : ''; }).join('') : '') + '</div>' +
      '<div class="mgr-split__key">' + parts.map(function (x) { return '<span class="mgr-split__i">' + H.kdState(x[1], x[2] + ' · ' + (x[0] || 0)) + stHelp(x[1]) + '</span>'; }).join('') + '</div>';
  }
  function big(val, label, key, sub) {
    return '<div class="mgr-kdbig"><span class="mgr-kdbig__l">' + esc(label) + (key ? K.help(key) : '') + '</span><b class="mgr-kdbig__v">' + val + '</b>' +
      (sub ? '<span class="mgr-kdbig__s">' + sub + '</span>' : '') + '</div>';
  }

  function nowCard(kd) {
    var s = kd.states || {}, active = NOW.reduce(function (sum, k) { return sum + (s[k] || 0); }, 0);
    return '<section class="card mgr-gap"><div><h2 class="card-title">Коригуючі дії зараз · ' + n(active) + K.help('mgr.kd.now') + '</h2>' +
      '<p class="hint">Ще не завершені: відкрито достроково, тиждень ще йде · потрібне рішення старшого (дію відкрито достроково, а тиждень завершився в нормі) · відкрито, але не впроваджено · ' +
      'впроваджено, йде тиждень після впровадження · під наглядом (перший тиждень після впровадження минув без рецидиву, дивимось другий)</p></div>' +
      split(NOW.map(function (k) { return [s[k] || 0, k, WORD[k]]; }), 'Коригуючі дії зараз') +
      '<div class="mgr-gap mgr-gap--sm"><p class="group-label" style="padding:0">Завершились за період' + K.help('mgr.kd.finished') + '</p>' +
      '<p class="hint">Закрито: тримається — два тижні після впровадження брак, % відділу не вище норми · закрито: її види браку нижче, ніж до дії — два тижні без рецидиву, але відділ хоч раз понад норму через інші види браку · ' +
      'рецидив — після впровадження брак, % відділу понад норму, а види браку цієї дії разом не нижче, ніж до дії · дія не потрібна — так вирішив старший</p>' +
      split(DONE.map(function (k) { return [s[k] || 0, k, WORD[k]]; }), 'Завершились за період') + '</div></section>';
  }
  function periodCard(kd, scope) {
    var p = kd.period || {}, r = p.results || {}, hd = p.held || {};
    return '<section class="card mgr-gap"><div><h2 class="card-title">Коригуючі дії за період' + K.help('mgr.kd.period') + '</h2><p class="hint">' + esc(scope) + '</p></div>' +
      '<div class="mgr-kdbigs">' + big(n(p.opened), 'Відкрито', 'mgr.kd.action', p.earlyOpened ? 'з них достроково, посеред тижня — ' + n(p.earlyOpened) + K.help('mgr.kd.early') : '') +
      big(n(p.implemented), 'Впроваджено', 'mgr.kd.implemented') + big(dd(p.implementedDaysAvg), 'Від відкриття до впровадження', 'mgr.kd.days', 'у середньому') +
      big(n(p.notImplemented), 'Ще не впроваджено', 'mgr.kd.notImpl') + '</div>' +
      '<div class="mgr-gap mgr-gap--sm"><p class="group-label" style="padding:0">Перший тиждень після впровадження: брак, % відділу' + K.help('mgr.kd.after1') + '</p>' +
      split([[r.belowAfter1, 'hold', 'не вище норми'], [r.notBelowAfter1, 'over', 'понад норму (рецидив або «її види браку нижче, ніж до дії»)'], [r.pending, 'watch', 'тиждень ще йде']], 'Перший тиждень після впровадження') + '</div>' +
      '<div class="mgr-gap mgr-gap--sm"><p class="group-label" style="padding:0">Другий тиждень після впровадження: брак, % відділу' + K.help('mgr.kd.after2') + '</p>' +
      split([[hd.done, 'done', 'знову не вище норми — закрито: тримається'], [hd.part, 'part', 'понад норму, але види браку дії разом нижче, ніж до дії — закрито'],
        [hd.relapse, 'relapse', 'понад норму (рецидив)'], [hd.pending, 'hold', 'тиждень ще йде (під наглядом)']], 'Другий тиждень після впровадження') + '</div></section>';
  }
  function effectCard(kd) {
    var e = kd.effect || {}, rows = [];
    (kd.actions || []).forEach(function (a) {
      var d = a.implementedAt ? String(a.implementedAt).slice(0, 10) : '';
      if (!d || d < kd.from || d > kd.to || canon(a.state) === 'watch') return;
      (a.items || []).forEach(function (it) { if (it.after != null && it.before != null) rows.push({ dept: a.departmentName, name: it.name, before: it.before, after: it.after }); });
    });
    rows.sort(function (a, b) { return (a.after - a.before) - (b.after - b.before); });
    var max = Math.max(5, kd.threshold || 5, Math.max.apply(null, rows.map(function (x) { return Math.max(x.before, x.after); }).concat([0])));
    function w(v) { return Math.max(0, Math.min(100, v / max * 100)).toFixed(1) + '%'; }
    return '<section class="card mgr-gap"><div><h2 class="card-title">Що сталося з браком після коригуючих дій' + K.help('mgr.kd.beforeAfter') + '</h2>' +
      '<p class="hint">Рядок — вид браку, з яким працювала коригуюча дія: його брак, % у відділі до дії і в перший повний тиждень після впровадження' +
      (e.items ? ' · рядків: <b>' + n(e.items) + '</b> · у середньому: ' + H.ba(e.avgBefore, e.avgAfter) : '') + '</p></div>' +
      (!rows.length ? '<p class="hint">За період ще немає видів браку з числом «після». «Після» зʼявляється, коли мине перший повний тиждень після впровадження.</p>'
        : '<div class="mgr-ba"><div class="mgr-ba__key"><span><i class="mgr-ba__b"></i>до коригуючої дії</span><span><i class="mgr-ba__a"></i>після впровадження</span><span><i class="mgr-key__dash"></i>норма — ' + H.pct(kd.threshold) + '</span>' +
          '<span>в. п. — відсоткові пункти: різниця «після» мінус «до»</span></div>' +
          rows.map(function (x) {
            return '<div class="mgr-ba__r"><span class="mgr-ba__n"><b>' + esc(x.name) + '</b> <span class="mgr-dim">' + esc(x.dept) + '</span></span>' +
              '<span class="mgr-ba__v">' + H.ba(x.before, x.after) + '</span>' +
              '<span class="mgr-ba__bars"><i class="mgr-ba__b" style="width:' + w(x.before) + '"></i><i class="mgr-ba__a" style="width:' + w(x.after) + '"></i>' +
              '<i class="mgr-ba__lim" style="left:' + w(kd.threshold || 5) + '"></i></span></div>';
          }).join('') + '</div>') + '</section>';
  }
  function causesCard(kd) {
    var list = (kd.causes || []).filter(function (c) { return c.n; }).sort(function (a, b) { return b.n - a.n; }), sum = list.reduce(function (s, c) { return s + c.n; }, 0);
    return '<section class="card mgr-gap"><div><h2 class="card-title">Причини браку (з планів коригуючих дій)' + K.help('mgr.kd.causes') + '</h2>' +
      '<p class="hint">Що старші аудитори записали причиною браку, коли впроваджували дію · записано причин: <b>' + n(sum) + '</b> (в одній дії їх буває кілька)</p></div>' +
      (!sum ? '<p class="hint">За період жодної коригуючої дії не впроваджено — причин браку не записано.</p>' : '<div class="mgr-causes">' + list.map(function (c) {
        var pc = Math.round(c.n / sum * 1000) / 10;
        return '<div class="mgr-causes__r"><span>' + esc(K.causeName(c.id, c.label)) + '</span><b>' + n(c.n) + ' · ' + H.pct(pc) + '</b><span class="mgr-causes__bar"><i style="width:' + pc + '%"></i></span></div>';
      }).join('') + '</div>') + '</section>';
  }
  function deptsCard(kd) {
    var list = kd.depts || [];
    function th(label, st) { return '<th class="n mgr-wrap">' + H.kdMark(st, label) + ' ' + esc(label) + stHelp(st) + '</th>'; }
    return '<section class="card mgr-gap"><div><h2 class="card-title">Відділи: брак за тиждень і коригуючі дії' + K.help('mgr.kd.depts') + '</h2>' +
      '<p class="hint">Брак, % і перевірено — за останній завершений тиждень (' + esc(weekSpan(kd)) + '); коригуючі дії — скільки зараз у кожному стані</p></div>' +
      (!list.length ? '<p class="hint">Відділів немає.</p>' :
      '<div class="tbl-box"><table class="tbl mgr-tbl"><thead><tr><th>Відділ</th><th class="n">Брак, % за тиждень' + K.help('term.rate') + '</th><th class="n mgr-wrap">Перевірено за тиждень, шт</th>' +
      th(WORD.pre, 'pre') + th(WORD.decide, 'decide') + th(WORD.over, 'over') + th(WORD.watch, 'watch') + th(WORD.hold, 'hold') +
      th('закрито: її види браку нижче, ніж до дії — за період', 'part') + th('рецидивів за період', 'relapse') + '</tr></thead><tbody>' + list.map(function (d) {
        return '<tr><td><b>' + esc(d.name) + '</b></td><td class="n">' + K.rate(d.weekRate, kd.threshold) + '</td><td class="n">' + n(d.weekChecked) + '</td>' +
          '<td class="n">' + n(d.pre || 0) + '</td><td class="n">' + n(d.decide || 0) + '</td><td class="n">' + n(d.open) + '</td>' +
          '<td class="n">' + n(d.watch) + '</td><td class="n">' + n(d.hold) + '</td><td class="n">' + n(d.part || 0) + '</td><td class="n">' + n(d.relapse) + '</td></tr>';
      }).join('') + '</tbody></table></div>') + '</section>';
  }
  function howOpened(a) {
    if (!a.early) return '';
    return ' <span class="badge">достроково, посеред тижня</span>' + K.help('mgr.kd.early') +
      (a.earlyBelow ? '<span class="mgr-dim mgr-block">брак, % за весь тиждень: ' + H.pct(a.weekRate) + '</span>' : '');
  }
  function actionsCard(kd, state) {
    var list = (kd.actions || []).slice().sort(function (a, b) { return String(b.openedAt) < String(a.openedAt) ? -1 : 1; });
    return '<section class="card mgr-gap"><div><h2 class="card-title">Перелік коригуючих дій · ' + list.length + K.help('mgr.kd.actions') + '</h2>' +
      '<p class="hint">Рядок — одна коригуюча дія відділу, де брак, % за тиждень вищий за норму; відкрито за підсумком тижня або достроково, посеред тижня' +
      (state ? ' · стан — на сьогодні' : '') + '</p></div>' +
      (!list.length ? '<p class="hint">Коригуючих дій за період немає.</p>' : '<div class="tbl-box"><table class="tbl mgr-tbl mgr-acts"><thead><tr><th>Відділ</th><th>Відкрито</th><th>Впроваджено</th>' +
        '<th class="n mgr-wrap">Днів від відкриття до впровадження' + K.help('mgr.kd.days') + '</th><th>Причина браку' + K.help('mgr.kd.causes') + '</th>' + (state ? '<th>Стан на сьогодні</th>' : '') +
        '<th class="n mgr-wrap">Брак, % відділу: до → після' + K.help('mgr.kd.beforeAfter') + '</th></tr></thead><tbody>' +
        list.map(function (a) {
          var st = canon(a.state), d = a.daysToImplement != null ? a.daysToImplement : between(a.openedAt, a.implementedAt);
          return '<tr><td><b>' + esc(a.departmentName) + '</b></td><td>' + esc(day(a.openedAt)) + howOpened(a) + '</td>' +
            '<td>' + (a.implementedAt ? esc(day(a.implementedAt)) : '<span class="mgr-dim">' + (st === 'skip' ? 'дія не потрібна' : 'ще не впроваджено') + '</span>') + '</td>' +
            '<td class="n">' + (d == null ? '—' : n(d)) + '</td><td>' + (a.cause ? esc(causeName(kd, a.cause)) : '<span class="mgr-dim">не записано</span>') + '</td>' +
            (state ? '<td>' + H.kdState(st, word(st)) + '</td>' : '') + '<td class="n">' + H.ba(a.before, a.after, st === 'skip' || st === 'over' || st === 'pre' || st === 'decide') + '</td></tr>';
        }).join('') + '</tbody></table></div>') + '</section>';
  }
  function weeksTable(kd) {
    return '<div class="tbl-box"><table class="tbl mgr-tbl"><thead><tr><th>Тиждень</th><th class="n">Перевірено, шт</th><th class="n">Брак, % локації</th><th class="n">Відкрито дій</th>' +
      '<th class="n">Впроваджено дій</th><th class="n mgr-wrap">' + AFTER1 + '</th><th class="n">Рецидивів</th></tr></thead><tbody>' +
      (kd.weeks || []).map(function (w) {
        return '<tr><td>' + esc(K.span(w.start, w.end)) + (w.current ? ' <span class="mgr-dim">· ще триває</span>' : '') + '</td><td class="n">' + n(w.checked) + '</td><td class="n">' + K.rate(w.rate, kd.threshold) + '</td><td class="n">' + n(w.opened) + '</td>' +
          '<td class="n">' + n(w.implemented) + '</td><td class="n">' + n(w.belowAfter) + '</td><td class="n">' + n(w.relapse) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function weekSpan(kd) {
    var w = (kd.weeks || [])[0], D = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    function wd(d) { return D[new Date(Date.parse(d + 'T12:00:00Z')).getUTCDay()]; }
    return w ? wd(w.start) + ' → ' + wd(w.end) : '';
  }
  function reviewDay(kd) { return kd.cycle && kd.cycle.reviewWeekdayName ? 'день розбору — ' + kd.cycle.reviewWeekdayName : 'день розбору — за правилом адміністратора'; }
  var AFTER1 = 'Перший тиждень після впровадження не вище норми, дій';

  var KD = P.mgrKd = {
    word: word,
    help: stHelp,
    tile: function (t) {
      if (!t) return '<span class="mgr-tile__kd mgr-dim">коригуючі дії: даних немає</span>';
      function list(keys) { return keys.map(function (k) { return '<span class="' + (t.states[k] ? '' : 'mgr-zero') + '">' + H.kdState(k, WORD[k] + ' · ' + t.states[k]) + '</span>'; }).join(''); }
      return '<span class="mgr-tile__kd"><span class="mgr-tile__kdh">Коригуючі дії зараз: <b>' + n(t.active) + '</b></span><span class="mgr-tile__kds">' + list(NOW) + '</span>' +
        '<span class="mgr-tile__kdh">За період: відкрито <b>' + n(t.opened) + '</b> · впроваджено <b>' + n(t.implemented) + '</b></span><span class="mgr-tile__kds">' + list(['done', 'part', 'relapse']) + '</span></span>';
    },
    page: function (kd, scope) {
      if (!kd) return '<section class="card">' + H.empty('Даних про коригуючі дії немає', 'Для цієї локації їх ще не підраховано.') + '</section>';
      return '<div class="mgr-kdpage"><div><h2 class="h2">Коригуючі дії' + K.help('mgr.kd.action') + '</h2><p class="h2-sub">' + esc(scope) +
        ' · брак підсумовується щотижня, за ' + K.dn(kd.cycle ? kd.cycle.days : 7) + ' (' + esc(weekSpan(kd)) + '), ' + esc(reviewDay(kd)) + K.help('mgr.kd.review') +
        ' · норма — брак, % відділу за тиждень не вище ' + H.pct(kd.threshold) + K.help('mgr.kd.threshold') + '</p></div>' +
        '<div class="row"><div class="col">' + nowCard(kd) + '</div><div class="col--wide">' + periodCard(kd, scope) + '</div></div>' +
        '<section class="card mgr-gap"><div><h2 class="card-title">По тижнях: брак, % локації і коригуючі дії' + K.help('mgr.kd.weeks') + '</h2>' +
        '<p class="hint">Стовпчик — тиждень (' + esc(weekSpan(kd)) + ') · червоний — брак, % понад норму · ✕ з числом — скільки рецидивів того тижня · наведіть на тиждень або торкніться — усі його числа</p></div>' +
        ((kd.weeks || []).length ? '<div data-chart="kdweeks"></div>' + weeksTable(kd) : '<p class="hint">Тижнів у періоді немає.</p>') + '</section>' +
        '<div class="row"><div class="col--wide">' + effectCard(kd) + '</div><div class="col">' + causesCard(kd) + '</div></div>' +
        deptsCard(kd) + actionsCard(kd, true) + '</div>';
    },
    mount: function (el, kd, scope) {
      var box = el.querySelector('[data-chart="kdweeks"]');
      if (!box || !kd) return;
      P.srChart.mount(box, {
        items: kd.weeks.map(function (w) {
          return { key: w.start, x: H.dayShort(w.start) + '–' + H.dayShort(w.end), v: w.rate || 0, none: !w.checked, hot: w.rate > kd.threshold, w: w,
            mark: w.relapse ? { text: '✕' + w.relapse, cls: 'mgr-relmark', title: 'рецидивів: ' + w.relapse } : null };
        }),
        height: root.innerWidth < 900 ? 220 : 280, label: 'Брак, % по тижнях · ' + scope, xAll: true,
        line: { v: kd.threshold, label: 'норма — ' + H.pct(kd.threshold) },
        tip: function (it) {
          var w = it.w;
          return P.srChart.tip({ title: K.span(w.start, w.end), sub: scope + (w.current ? ' · тиждень ще триває' : ''), rows: [['Брак, %', H.pct(w.rate), w.rate > kd.threshold ? 'danger' : ''], ['Перевірено', n(w.checked) + ' шт'],
            ['Відкрито коригуючих дій', n(w.opened)], ['Впроваджено дій', n(w.implemented)], [AFTER1, n(w.belowAfter)], ['Рецидивів', n(w.relapse), w.relapse ? 'danger' : '']] });
        }
      });
    },
    month: function (kd, scope) {
      if (!kd) return '<section class="card">' + H.empty('Даних про коригуючі дії немає', 'Для цієї локації їх ще не підраховано.') + '</section>';
      return periodCard(kd, scope) + '<p class="hint">Перший і другий тиждень після впровадження — лише для коригуючих дій, впроваджених у цьому місяці. Самі ці тижні можуть припасти на наступний місяць.</p>' +
        '<section class="card mgr-gap mgr-avoid"><div><h2 class="card-title">Тижні місяця: брак, % локації і коригуючі дії' + K.help('mgr.kd.weeks') + '</h2><p class="hint">Тиждень — ' + esc(weekSpan(kd)) + ' · ' + esc(reviewDay(kd)) + K.help('mgr.kd.review') + '</p></div>' +
        ((kd.weeks || []).length ? weeksTable(kd) : '<p class="hint">Тижнів у місяці немає.</p>') + '</section>' +
        '<div class="row mgr-print-stack"><div class="col--wide">' + effectCard(kd) + '</div><div class="col">' + causesCard(kd) + '</div></div>' + actionsCard(kd, false);
    }
  };
})(window);
