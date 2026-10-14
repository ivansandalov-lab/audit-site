(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;
  var help = function (k) { return P.help ? P.help.btn(k) : ''; };
  var SEGS = [['over', 'понад норму, не почато'], ['work', 'в роботі'], ['watch', 'на спостереженні'], ['closed', 'термін спостереження закрито'], ['skip', 'дія не потрібна']];

  P.sr.screen('/kd/stats', { tab: 'kd', title: 'Коригуючі дії — чи допомагають', period: false, render: function (ctx) {
    var q = ctx.query, data = null, req = 0;
    var st = { days: q.days === '90' ? 90 : 30, deps: (q.deps || '').split(',').filter(Boolean), open: q.open || '' };
    var ui = {};   // стан розгорнутих відділів: {depId: {find, sort, dir}}
    ctx.soft = load;
    ctx.on('days', function (t) { st.days = +t.getAttribute('data-v') === 90 ? 90 : 30; sync(); load(); });
    ctx.on('kd-dep', function (t) {
      var id = t.getAttribute('data-id'), i = st.deps.indexOf(id);
      if (!id) st.deps = []; else if (i >= 0) st.deps.splice(i, 1); else st.deps.push(id);
      sync(); load();
    });
    ctx.on('kd-open-dept', function (t) { var id = t.getAttribute('data-id'); st.open = st.open === id ? '' : id; sync(); drawDepts(); });
    ctx.on('kd-sd-sort', function (t) {
      var u = K.sdState(ui, st.open), k = t.getAttribute('data-v');
      if (u.sort === k) u.dir = -u.dir; else { u.sort = k; u.dir = k === 'name' ? 1 : -1; }
      drawPanel();
    });
    ctx.on('kd-sd-find', function (t) { K.sdState(ui, st.open).find = t.value; drawPanel(true); });
    ctx.on('kd-route', function (t) {
      var x = typeOf(t);
      if (x) K.openRoute({ name: x.t.name, deptName: x.d.name, steps: x.t.route, T: data.threshold, today: data.today });
    });
    ctx.on('kd-tw', function (t) { K.openTypeWindow(ctx, t.getAttribute('data-dep'), t.getAttribute('data-type')); });
    load();

    function typeOf(t) {
      var d = data && data.depts.filter(function (x) { return x.id === t.getAttribute('data-dep'); })[0];
      var ty = d && d.types.filter(function (x) { return x.defectTypeId === t.getAttribute('data-type'); })[0];
      return ty ? { d: d, t: ty } : null;
    }
    function sync() {
      var parts = [];
      if (st.days === 90) parts.push('days=90');
      if (st.deps.length) parts.push('deps=' + st.deps.map(encodeURIComponent).join(','));
      if (st.open) parts.push('open=' + encodeURIComponent(st.open));
      try { root.history.replaceState(null, '', '#/kd/stats' + (parts.length ? '?' + parts.join('&') : '')); } catch (e) { /* без історії — не страшно */ }
    }
    function load() {
      var my = ++req;
      if (data) ctx.el.classList.add('kd-busy');
      P.srv('srKdStats', { locationId: ctx.loc.id, days: st.days, departmentIds: st.deps }).then(function (r) {
        if (!ctx.alive() || my !== req) return;
        ctx.el.classList.remove('kd-busy');
        if (!r.ok && r.code === 'not_found' && st.deps.length) { st.deps = []; sync(); load(); return; }   // відділ зник — показуємо всі
        if (!r.ok) { data = null; ctx.el.innerHTML = K.segNav('/kd/stats', pills()) + H.error(r); return; }
        data = r; draw();
      });
    }
    function pills() {
      return '<span class="pills">' + [30, 90].map(function (n) { return '<button class="pill' + (n === st.days ? ' pill--on' : '') + '" type="button" data-act="days" data-v="' + n + '">' + n + ' дн.</button>'; }).join('') + '</span>';
    }

    function draw() {
      var r = data, k = r.kpi, T = r.threshold, span = r.byReview.length ? K.spanOf(r.byReview) : '';
      var kpi = function (n, label, key, mod) { return K.kpiH(n, label, key, n ? mod : ''); };
      var kpis = '<div class="kpis kd-stats-kpis">' + kpi(k.reviews, 'розборів по 4 дні' + (span ? ' · ' + span : ''), 'kd.review') +
        kpi(k.over, 'разів вид браку був понад норму ' + T + '%', 'kd.stats.over') + kpi(k.started, 'дій почато', 'kd.action') +
        kpi(k.helped, 'спостереження вдале', 'kd.state.done', 'ok') + kpi(k.notHelped, 'рецидив', 'kd.state.relapse', 'danger') +
        kpi(k.running, 'в роботі або на спостереженні', 'kd.stats.running') + kpi(k.notNeeded, 'дія не потрібна', 'kd.state.skip') +
        kpi(k.waiting, 'понад норму, не почато', 'kd.state.over', 'danger') + '</div>';
      ctx.el.innerHTML = K.segNav('/kd/stats', pills()) + depChips(r) + kpis + chartHtml(r, span) +
        '<section class="card kd-sd-card"><div><h2 class="card-title">Відділи' + help('kd.stats.depts') + '</h2>' +
        K.cap('Дії за ' + st.days + ' днів (' + esc(span) + '). Клік по відділу — його види браку: частка зараз, дії, «до → після», маршрут станів.') + '</div>' +
        '<div data-kd-depts></div></section>';
      drawChart(); drawDepts();
    }
    function depChips(r) {
      var all = !st.deps.length;
      return '<div class="kd-chips kd-depchips" role="group" aria-label="Відділи"><span class="kd-depchips__l">Відділи' + help('kd.stats.filter') + '</span>' +
        '<button class="chip-pick kd-chip' + (all ? ' chip-pick--on' : '') + '" type="button" data-act="kd-dep" data-id="" aria-pressed="' + all + '">Усі</button>' +
        r.departments.map(function (d) {
          var on = st.deps.indexOf(d.id) >= 0;
          return '<button class="chip-pick kd-chip' + (on ? ' chip-pick--on' : '') + '" type="button" data-act="kd-dep" data-id="' + esc(d.id) + '" aria-pressed="' + on + '">' +
            (on ? P.ic('check', 'ui-icon--sm') : '') + esc(d.name) + '</button>';
        }).join('') + '</div>';
    }
    function chartHtml(r, span) {
      var T = r.threshold;
      var keys = '<div class="legend kd-keys">' + SEGS.map(function (s) {
        return '<span class="kd-keyw"><span class="kds kds--' + (s[0] === 'closed' ? 'done' : s[0]) + '">' + esc(s[1]) + '</span>' + help(s[0] === 'closed' ? 'kd.stats.closed' : 'kd.state.' + s[0]) + '</span>';
      }).join('') + '<span class="kd-keyw"><span class="kd-key kd-key--rel"><b>✕2</b>рецидиви: у розборі перевірки знову понад норму</span>' + help('kd.state.relapse') + '</span></div>';
      return '<section class="card"><div><h2 class="card-title">Перевищення по розборах' + help('kd.stats.chart') + '</h2>' +
        K.cap('Стовпчик — один 4-денний розбір (' + esc(span) + '); висота — скільки разів вид браку у відділі був понад норму ' + T + '%; колір — стан дії по ньому сьогодні. Під стовпчиком — дати розбору. Наведіть — які саме види браку.') +
        '</div><div data-chart="kd-over"></div>' + keys + '</section>';
    }
    function drawChart() {
      var r = data, T = r.threshold;
      P.srChart.mount(ctx.el.querySelector('[data-chart="kd-over"]'), {
        items: r.byReview.map(function (x) {
          return { key: x.n, x: K.rangeShort(x.start, x.end), v: x.over, p: x,
            segs: SEGS.map(function (s) { return { v: x.states[s[0]], cls: 'kd-sg kd-sg--' + s[0] }; }),
            mark: x.relapse ? { text: '✕' + x.relapse, cls: 'kd-relmark', title: 'рецидивів: ' + x.relapse } : null };
        }),
        height: 200, xAll: true, label: 'Скільки разів вид браку був понад норму ' + T + '% у кожному розборі, за станами дій',
        tip: function (it) {
          var x = it.p, more = x.items.length - 6;
          var rows = [['Видів браку понад ' + T + '%', String(x.over), x.over ? 'danger' : '']].concat(SEGS.filter(function (s) { return x.states[s[0]]; })
            .map(function (s) { return ['· ' + s[1], String(x.states[s[0]])]; }));
          if (x.relapse) rows.push(['✕ рецидивів', String(x.relapse), 'danger']);
          rows.push(['Дій почато за цей розбір', String(x.started)]);
          return P.srChart.tip({ title: 'Розбір ' + K.range(x.start, x.end),
            rows: rows.concat(x.items.slice(0, 6).map(function (i) { return [i.departmentName + ' · ' + i.name, K.pct(i.rate) + (i.relapse ? ' · ✕' : '')]; })),
            foot: more > 0 ? 'і ще ' + more : '' });
        } });
    }
    function drawDepts() {
      var r = data, box = ctx.el.querySelector('[data-kd-depts]');
      if (!box) return;
      if (!r.depts.length) { box.innerHTML = H.empty('Відділів немає', ''); return; }
      box.innerHTML = K.sdHead() +
        r.depts.map(function (d) { return K.sdRow(d, st.open === d.id, r) + (st.open === d.id ? '<div class="kd-sd" data-kd-panel></div>' : ''); }).join('');
      drawPanel();
    }
    function drawPanel(keepFind) {
      var el = ctx.el.querySelector('[data-kd-panel]'), d = data && data.depts.filter(function (x) { return x.id === st.open; })[0];
      if (!el || !d) return;
      K.sdPanel(el, d, K.sdState(ui, d.id), data, keepFind);
    }
  } });
})(window);
