(function (root) {
  'use strict';
  var P = root.P, h = P.sr.h, esc = P.esc;
  var LV = ['fix', 'repair', 'scrap'];
  var LV_NEXT = { fix: 'можна виправити одразу', repair: 'іде в ремонт', scrap: 'не ремонтується, виріб втрачено' };
  var LV_COLOR = { fix: 'var(--info)', repair: 'var(--warn)', scrap: 'var(--danger)' };

  var A = P.srAn = {
    LV_NEXT: LV_NEXT, LV_COLOR: LV_COLOR,
    today: function () { return P.fmt.dayKey(new Date()); },
    diff: function (a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); },
    ago: function (day) {
      var n = A.diff(day, A.today());
      return n <= 0 ? 'сьогодні' : n === 1 ? 'учора' : n + ' ' + P.plural(n, 'день', 'дні', 'днів') + ' тому';
    },
    dshort: function (day) {
      var d = new Date(Date.parse(day + 'T12:00:00Z'));
      return d.toLocaleDateString('uk-UA', { weekday: 'short', timeZone: 'UTC' }) + ', ' + day.slice(8, 10) + '.' + day.slice(5, 7);
    },
    dcap: function (day) { var s = h.dayLong(day); return s.charAt(0).toUpperCase() + s.slice(1); },
    span: function (from, to) {
      function f(d) { return new Date(Date.parse(d + 'T12:00:00Z')).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', timeZone: 'UTC' }); }
      return from === to ? f(from) : f(from) + ' — ' + f(to);
    },
    pct0: function (v) { return v == null ? '—' : v < 1 ? h.pct(v) : Math.round(v) + '%'; },
    n: function (n, one, few, many) { return h.num(n) + ' ' + P.plural(n, one, few, many); },
    xLabels: function (days) {
      if (!days.length) return '';
      var idx = [], k = Math.min(5, days.length);
      for (var i = 0; i < k; i++) { var j = k === 1 ? 0 : Math.round(i * (days.length - 1) / (k - 1)); if (idx.indexOf(j) < 0) idx.push(j); }
      return '<div class="chart-x">' + idx.map(function (j) { return '<span>' + esc(h.dayShort(days[j])) + '</span>'; }).join('') + '</div>';
    },
    hbar: function (o) {
      var inner = (o.rank != null ? '<span class="rank">' + o.rank + '</span>' : '') +
        '<span><b>' + esc(o.name) + '</b><span class="sub">' + (o.sub || '') + '</span></span>' +
        '<div class="hbar__track"><i style="width:' + Math.max(2, Math.round(o.share * 100)) + '%"></i></div><span class="hbar__n">' + h.num(o.n) + '</span>';
      var st = o.cols ? ' style="grid-template-columns:' + o.cols + '"' : '';
      var cls = 'hbar an-hbar' + (o.rank == null ? ' an-hbar--nr' : '');
      if (o.href) return '<a class="' + cls + '" href="' + o.href + '"' + st + '>' + inner + '</a>';
      if (o.act) return '<button class="' + cls + '" type="button" data-act="' + o.act + '"' + (o.attrs || '') + st + '>' + inner + '</button>';
      return '<div class="hbar"' + st + '>' + inner + '</div>';
    },
    levels: function (o, height) { return h.legend(o) + h.stack(o, height || 14); },
    total: function (o) { return (o.fix || 0) + (o.repair || 0) + (o.scrap || 0); },
    share: function (o, k) { var t = A.total(o); return t ? Math.round(o[k] / t * 100) : 0; },
    q: function (key) { return key && P.help ? P.help.btn(key) : ''; },
    kpi: function (val, label, key, mod) {
      return '<div class="kpi' + (mod ? ' kpi--' + mod : '') + '"><span class="kpi__val">' + esc(val) + '</span><span class="kpi__label">' + esc(label) + A.q(key) + '</span></div>';
    }
  };

  var STATE_WORD = { none: 'аудитів не було', done: 'норму виконано', nonorm: 'норма не задана' };
  var X = P.srAnParts = {
    LV: LV,
    ui: { unit: 'pcs', day: null, range: null, top: 10, oq: '', osort: null },
    pctOf: function (rejected, checked) { return checked > 0 ? Math.round(rejected / checked * 1000) / 10 : null; },
    brak: function (rejected, pct) { return h.num(rejected) + ' шт · ' + h.pct(pct); },
    dn: function (n) { return n + ' ' + P.plural(n, 'день', 'дні', 'днів'); },
    hist: function (q) {
      q = Object.assign({}, q);
      if (q.d1 && q.d2 && q.d1 !== q.d2) { q.from = q.d1; q.to = q.d2; delete q.d1; delete q.d2; }
      var p = Object.keys(q).filter(function (k) { return q[k]; }).map(function (k) { return k + '=' + encodeURIComponent(q[k]); });
      return '#/history' + (p.length ? '?' + p.join('&') : '');
    },
    stateWord: function (d) { return d.state === 'part' ? 'бракує ' + h.num(d.missing) + ' шт' : STATE_WORD[d.state]; },
    stateBadge: function (d) {
      return '<span class="an-st an-st--' + d.state + '">' + (d.state === 'done' ? h.ic('check', 'ui-icon--sm') : '') + esc(X.stateWord(d)) + '</span>';
    },
    scale: function (d, size) {
      var c = d.checked || 0, t = d.target, max = Math.max(c, t || 0, 1);
      var fill = d.state === 'none' ? 0 : c / max * 100, miss = d.state === 'part' ? 100 - fill : 0;
      var tick = d.state === 'done' && c > t ? t / max * 100 : null;
      var aria = 'Перевірено ' + c + ' шт' + (t != null ? ', норма дня ' + t + ' шт' : '') + ' — ' + X.stateWord(d);
      return '<div class="an-scale an-scale--' + d.state + ' an-scale--' + (size || 'md') + '" role="img" aria-label="' + esc(aria) + '">' +
        (fill ? '<i class="an-scale__fill" style="width:' + fill.toFixed(1) + '%"></i>' : '') +
        (miss ? '<i class="an-scale__miss" style="width:' + miss.toFixed(1) + '%"></i>' : '') +
        (tick != null ? '<b class="an-scale__tick" style="left:' + tick.toFixed(1) + '%"></b>' : '') + '</div>';
    },
    sum: function (list) {
      var o = { days: list.length, daysWithAudits: 0, audits: 0, checked: 0, rejected: 0, levels: { fix: 0, repair: 0, scrap: 0 } };
      list.forEach(function (d) {
        if (d.audits) o.daysWithAudits++;
        o.audits += d.audits || 0; o.checked += d.checked || 0; o.rejected += d.rejected || 0;
        LV.forEach(function (k) { o.levels[k] += (d.levels && d.levels[k]) || 0; });
      });
      o.pct = X.pctOf(o.rejected, o.checked);
      return o;
    },
    dayTip: function (d, normLabel, sub) {
      var title = A.dcap(d.day);
      if (!d.audits && !d.rejected) return P.srChart.tipDay({ title: title, none: (sub ? sub + ' · ' : '') + 'аудитів не було' });
      if (!d.audits) return P.srChart.tip({ title: title, sub: (sub ? sub + ' · ' : '') + 'у відділі аудитів не було', levels: d.levels, rows: [['Брак відділу, знайдений в інших відділах', h.num(d.rejected) + ' шт']] });
      return P.srChart.tipDay({ title: title, sub: sub, audits: d.audits, checked: d.checked, rejected: d.rejected, pct: d.pct, levels: d.levels,
        rows: d.target != null ? [[normLabel || 'Норма дня', h.num(d.target) + ' шт']] : [] });
    },
    legend: function (levels, extra) {
      return '<div class="legend">' + (levels ? LV.map(function (k) { return h.lvl(k); }).join('') : '') +
        (extra || []).map(function (x) { return '<span class="an-key"><i class="' + x[0] + '"></i>' + esc(x[1]) + '</span>'; }).join('') + '</div>';
    }
  };

  var PARTS = ['today', 'period', 'orders'];   // частини екрана: кожна вміє draw(view) і bind(view)
  P.sr.screen('/analytics', { tab: 'analytics', title: 'Аналітика', render: function (ctx) {
    var req = 0;
    var view = { ctx: ctx, dep: (ctx.query && ctx.query.dep) || '', data: null, pick: pick,
      box: function (id) { return ctx.el.querySelector('#' + id); },
      scope: function () { return view.data && view.data.department ? view.data.department.name : 'Усі відділи'; } };

    function frame() {
      ctx.el.innerHTML = '<section class="an-switch" aria-label="Відділ"><div id="an-tiles" class="an-tiles"></div><div id="an-tiles-key"></div></section>' +
        '<div id="an-body" class="an-body"><section class="card an-today" id="an-today"></section><section id="an-sum" class="an-sumbox"></section>' +
        '<div class="row"><section class="card col--wide" id="an-days"></section><section class="card col" id="an-levels"></section></div>' +
        '<section class="card" id="an-top"></section><section class="card" id="an-orders"></section></div>';
    }
    function load() {
      var my = ++req, body = view.box('an-body');
      if (body) body.classList.add('an-busy');   // відділ перемкнули — старі числа тьмяніють, доки не прийдуть нові
      P.srv('srAnalytics', { locationId: ctx.loc.id, from: ctx.period.from, to: ctx.period.to, departmentId: view.dep }).then(function (r) {
        if (!ctx.alive() || my !== req) return;
        if (!r.ok) {
          ctx.el.innerHTML = r.code === 'not_found' && view.dep ? h.empty('Такого відділу в цій локації немає', 'Посилання веде на відділ, якого немає в «' + ctx.loc.name + '».') +
            '<p style="text-align:center"><a class="btn btn--secondary btn--sm" href="#/analytics">Показати всі відділи</a></p>' : h.error(r);
          return;
        }
        view.data = r;
        if (!view.box('an-body')) frame();
        view.box('an-body').classList.remove('an-busy');
        PARTS.forEach(function (k) { X[k].draw(view); });
      });
    }
    function pick(id) {
      id = id || '';
      if (id === view.dep) return;
      view.dep = id;
      try { root.history.pushState(null, '', '#/analytics' + (id ? '?dep=' + encodeURIComponent(id) : '')); } catch (e) { /* без історії — вибір просто не потрапить в адресу */ }
      if (view.data) X.today.tiles(view);   // обрану плитку виділяємо одразу, числа сторінки прийдуть за мить
      load();
    }
    PARTS.forEach(function (k) { X[k].bind(view); });
    ctx.on('an-dep', function (t) { pick(t.getAttribute('data-id')); });
    load();
  } });
})(window);
