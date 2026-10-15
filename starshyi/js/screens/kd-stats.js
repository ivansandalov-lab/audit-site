(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;
  var help = function (k) { return P.help ? P.help.btn(k) : ''; };

  P.sr.screen('/kd/stats', { tab: 'kd', title: 'Коригуючі дії — чи допомагають', period: false, render: function (ctx) {
    var q = ctx.query, data = null, req = 0;
    var st = { days: q.days === '90' ? 90 : 30, deps: (q.deps || '').split(',').filter(Boolean), open: q.open || '' };
    var ui = {};   // стан розгорнутих відділів: {depId: {find, sort, dir}}
    ctx.soft = load;
    K.bindActions(ctx, function () { return null; });
    ctx.on('retry', function () { load(); });
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
      if (x) K.openRoute({ name: x.t.name, deptName: x.d.name, steps: x.t.route, today: data.today });
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
      else ctx.el.innerHTML = H.loading();
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
      var r = data, k = r.kpi, T = r.threshold, span = r.byWeek.length ? K.spanOf(r.byWeek) : '';
      var kpi = function (n, label, key, mod) { return K.kpiH(n == null ? '—' : n, label, key, n ? mod : ''); };
      var kpis = '<div class="kpis kd-stats-kpis">' + kpi(k.opened, 'КД відкрито · з них раннім тумблером ' + k.earlyOpened, 'kd.stats.opened', 'danger') +
        kpi(k.implemented, 'впроваджено' + (k.implementedDaysAvg != null ? ' · у середньому через ' + String(k.implementedDaysAvg).replace('.', ',') + ' дн. після відкриття' : ''), 'kd.stats.implemented') +
        kpi(k.results.belowAfter1, 'тиждень результату не вище норми ' + T + '%', 'kd.stats.below', 'ok') + kpi(k.results.notBelowAfter1, 'тиждень результату понад норму', 'kd.state.relapse', 'danger') +
        kpi(k.held.done, 'утримання не вище норми (закрито)', 'kd.state.done', 'ok') + kpi(k.held.relapse, 'утримання понад норму (рецидив)', 'kd.state.relapse', 'danger') +
        kpi(k.results.pending + k.held.pending, 'ще спостерігаємо', 'kd.stats.pending', 'info') + kpi(k.waiting, 'понад норму, не почато · зараз', 'kd.state.over', 'danger') + '</div>';
      var e = k.effect;
      var facts = '<section class="card kd-sfacts"><div class="kd-sfacts__i"><p class="kd-sec">Пункти КД: до → після' + help('kd.stats.effect') + '</p>' +
        (e.items ? '<p class="kd-sfacts__big"><b>' + K.pct(e.avgBefore) + ' → ' + K.pct(e.avgAfter) + '</b> · ' + esc(K.delta(e.avgBefore, e.avgAfter)) + '</p><p class="hint">Середнє по ' +
          K.plural(e.items, 'пункту', 'пунктах', 'пунктах') + ' КД, впроваджених за ' + st.days + ' днів, де тиждень результату вже завершився: % виду браку від перевірених у відділі.</p>'
          : '<p class="hint">Пунктів із завершеним тижнем результату за ' + st.days + ' днів немає.</p>') + '</div>' +
        '<div class="kd-sfacts__i"><p class="kd-sec">Причини у впроваджених планах' + help('kd.stats.causes') + '</p>' +
        (k.causes.length ? '<div class="kd-chips">' + k.causes.map(function (c) { return '<span class="chip chip--plain">' + esc(c.label) + ' · ' + c.n + '</span>'; }).join('') + '</div>'
          : '<p class="hint">Впроваджених планів за ' + st.days + ' днів немає.</p>') + '<p class="hint">«Не потрібно» за цей час: ' + k.notNeeded + '.</p></div></section>';
      ctx.el.innerHTML = K.segNav('/kd/stats', pills()) + depChips(r) + kpis + chartHtml(r, span) + facts +
        '<section class="card kd-sd-card"><div><h2 class="card-title">Відділи' + help('kd.stats.depts') + '</h2>' +
        K.cap('КД за ' + st.days + ' днів (' + esc(span) + '). Клік по відділу — його види браку: % зараз, у скількох КД були пунктом, «до → після» в останній такій КД, маршрут станів.') + '</div>' +
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
      var keys = '<div class="legend kd-keys">' + K.STATES.filter(function (s) { return s.id !== 'relapse'; }).map(function (s) {
        return '<span class="kd-keyw">' + H.kdState(s.id) + help(s.help) + '</span>';
      }).join('') + '<span class="kd-keyw">' + H.kdState('relapse', 'рецидив (стан КД)') + '</span><span class="kd-keyw"><span class="kd-key kd-key--rel"><b>✕2</b>рецидив виміряно в цьому тижні</span>' + help('kd.state.relapse') + '</span></div>';
      return '<section class="card"><div><h2 class="card-title">КД по тижнях' + help('kd.stats.chart') + '</h2>' +
        K.cap('Стовпчик — один тиждень розбору (' + esc(span) + '), дати — під ним; висота — скільки КД відкрито за цей тиждень; колір — стан кожної з них сьогодні. Наведіть — які саме відділи.') +
        '</div><div data-chart="kd-over"></div>' + keys + '</section>';
    }
    function drawChart() {
      var r = data, T = r.threshold;
      P.srChart.mount(ctx.el.querySelector('[data-chart="kd-over"]'), {
        items: r.byWeek.map(function (x) {
          return { key: x.n, x: K.rangeShort(x.start, x.end), v: x.opened, p: x, cls: x.current ? 'kd-dim' : '', none: !x.checked,
            segs: K.STATES.map(function (s) { return { v: x.states[s.id], cls: 'kd-sg kd-sg--' + s.id }; }),
            mark: x.relapse ? { text: '✕' + x.relapse, cls: 'kd-relmark', title: 'рецидивів виміряно: ' + x.relapse } : null };
        }),
        height: 200, xAll: true, label: 'Скільки КД відкрито за кожен тиждень і в якому вони стані сьогодні',
        tip: function (it) {
          var x = it.p, more = x.items.length - 6;
          var rows = [['Брак, % відділів разом', K.pct(x.rate)], ['Відділів понад норму ' + T + '%', String(x.overDepts)], ['КД відкрито', String(x.opened)]]
            .concat(x.early ? [['· з них раннім тумблером', String(x.early)]] : [])
            .concat(K.STATES.filter(function (s) { return x.states[s.id]; }).map(function (s) { return ['· ' + P.sr.KD_STATES[s.id].label, String(x.states[s.id])]; }));
          if (x.relapse) rows.push(['✕ рецидив виміряно', String(x.relapse), 'danger']);
          return P.srChart.tip({ title: 'Тиждень ' + K.range(x.start, x.end), sub: x.current ? 'тиждень триває' : '',
            rows: rows.concat(x.items.slice(0, 6).map(function (i) { return [i.departmentName, K.pct(i.rate) + ' · ' + P.sr.KD_STATES[i.state].label + (i.earlyBelow ? ' (раннім тумблером; тиждень не вище норми)' : '')]; })),
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
