(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;
  var help = function (k) { return P.help ? P.help.btn(k) : ''; };
  var SORTS = [['pct', 'за %'], ['pcs', 'за шт'], ['name', 'за назвою']];
  var SORT_FN = {
    pct: function (a, b) { return (b.rate || 0) - (a.rate || 0) || b.pieces - a.pieces || a.name.localeCompare(b.name, 'uk'); },
    pcs: function (a, b) { return b.pieces - a.pieces || a.name.localeCompare(b.name, 'uk'); },
    name: function (a, b) { return a.name.localeCompare(b.name, 'uk'); }
  };
  var ACT_SHOW = 4;   // скільки дій у групі етапу видно без «Показати всі»

  P.sr.screen('/kd/dept/:id', { tab: 'kd', title: 'Коригуючі дії', period: false, render: function (ctx) {
    var q = ctx.query, depId = ctx.params.id;
    var st = { p: /^\d{1,6}$/.test(q.p || '') ? +q.p : null, t: q.t || '', s: SORTS.some(function (x) { return x[0] === q.s; }) ? q.s : 'pct', find: '', unit: 'pct' };
    var data = null, tdata = null, req = 0, treq = 0, panelH = 0;
    var back = '<a class="btn btn--quiet btn--sm" href="#/kd">' + P.ic('arrow-left') + 'Усі відділи</a>';

    ctx.soft = load;   // після запису дії K.done перечитує екран цим, а не повним перемальовуванням
    K.bindActions(ctx, function (t) { return K.finder((data ? data.actions : []).concat(tdata ? tdata.r.history : []))(t); });
    ctx.on('kd-prev', function () { setPeriod(data.period.n - 1); });
    ctx.on('kd-next', function () { setPeriod(data.period.n + 1); });
    ctx.on('kd-period', function (t) { setPeriod(+t.value); });
    ctx.on('kd-show', function (t) { setPeriod(+t.getAttribute('data-n')); });
    ctx.on('kd-last', function () { setPeriod(null); });
    ctx.on('kd-blur-how', function () { blurHow(data ? data.threshold : 5); });
    ctx.on('kd-unit', function (t) { st.unit = t.getAttribute('data-v') === 'pcs' ? 'pcs' : 'pct'; drawChart(); });
    ctx.on('kd-sort', function (t) { var v = t.getAttribute('data-v'); if (SORT_FN.hasOwnProperty(v)) { st.s = v; sync(); drawRows(); } });
    ctx.on('kd-find', function (t) { st.find = t.value; drawRows(); });
    ctx.on('kd-type', function (t) { var id = t.getAttribute('data-id'); st.t = st.t === id ? '' : id; tdata = null; panelH = 0; sync(); drawRows(); });
    ctx.on('kd-worker', function (t) { if (P.srPeople) P.srPeople.openWorker(ctx, t.getAttribute('data-code')); });
    load();

    function sync() {
      var parts = [];
      if (st.p != null) parts.push('p=' + st.p);
      if (st.t) parts.push('t=' + encodeURIComponent(st.t));
      if (st.s !== 'pct') parts.push('s=' + st.s);
      try { root.history.replaceState(null, '', '#/kd/dept/' + encodeURIComponent(depId) + (parts.length ? '?' + parts.join('&') : '')); } catch (e) { /* без історії — не страшно */ }
    }
    function setPeriod(n) {
      if (n != null && (isNaN(n) || (data && (n < data.minPeriod || n > data.maxPeriod)))) return;
      st.p = n != null && data && n === data.review.n ? null : n;
      sync(); load();
    }
    function load() {
      var my = ++req, old = ctx.el.querySelector('[data-kd-panel]');
      panelH = old ? old.offsetHeight : 0;
      if (data) ctx.el.classList.add('kd-busy');
      P.srv('srKdDept', { locationId: ctx.loc.id, departmentId: depId, period: st.p }).then(function (r) {
        if (!ctx.alive() || my !== req) return;
        ctx.el.classList.remove('kd-busy');
        if (!r.ok) {
          data = null;
          ctx.el.innerHTML = '<div class="kd-head">' + back + '</div>' + H.error(r) +
            (st.p != null ? '<button class="btn btn--secondary btn--sm" type="button" data-act="kd-last" style="align-self:center">Показати останній повний розбір</button>' : '');
          return;
        }
        data = r; drawAll();
      });
    }

    function headHtml(r) {
      var p = r.period;
      var opts = r.periods.map(function (x) {
        var note = x.current ? 'триває' : x.n === r.review.n ? 'останній повний' : '';
        return '<option value="' + x.n + '"' + (x.n === p.n ? ' selected' : '') + '>' + esc(K.range(x.start, x.end)) + (note ? ' · ' + note : '') + '</option>';
      }).join('');
      return '<div class="kd-head kd-head--stick" data-kd-head>' + back + '<h2 class="h2 kd-head__t">' + esc(r.dept.name) + ' · коригуючі дії</h2>' +
        '<div class="kd-per" role="group" aria-label="Розбір"><button class="btn btn--secondary btn--sm" type="button" data-act="kd-prev"' + (p.n <= r.minPeriod ? ' disabled' : '') + '>' +
        P.ic('arrow-left', 'ui-icon--sm') + '<span class="kd-per__w">попередній</span></button>' +
        '<select class="input kd-per__sel" data-change="kd-period" aria-label="Розбір">' + opts + '</select>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-act="kd-next"' + (p.n >= r.maxPeriod ? ' disabled' : '') + '><span class="kd-per__w">наступний</span>' +
        P.ic('arrow-right', 'ui-icon--sm') + '</button></div></div>';
    }
    function factsHtml(r) {
      var p = r.period, T = r.threshold, lv = p.levels, lt = (lv.fix || 0) + (lv.repair || 0) + (lv.scrap || 0), per = K.rangeShort(p.start, p.end);
      var kind = p.current ? H.badge('розбір триває · день ' + p.daysDone + ' з ' + p.days, 'info') : p.n === r.review.n ? H.badge('останній повний розбір', 'brand') : H.badge('минулий розбір · лише перегляд');
      var levels = lt ? H.stack(lv, 14) + '<div class="legend">' + ['fix', 'repair', 'scrap'].map(function (k) {
        return H.lvl(k, P.sr.LEVELS[k] + ' · ' + K.num(lv[k]) + ' шт · ' + Math.round(lv[k] / lt * 100) + '%'); }).join('') + '</div>' : '<p class="kd-text">Браку у відділі за розбір не записано.</p>';
      return '<section class="card kd-facts"><div class="kd-facts__top"><h3 class="card-title">Розбір ' + esc(K.range(p.start, p.end)) + help('kd.review') + '</h3>' + kind +
        (r.decide ? '' : '<button class="btn btn--quiet btn--sm" type="button" data-act="kd-last">До останнього розбору</button>') + '</div>' +
        '<div class="kd-big">' + K.big(K.num(p.audits), 'аудитів за ' + per, 'term.audit') +
        K.big(K.num(p.rejected) + ' шт', 'брак, шт · з ' + K.num(p.checked) + ' перевірених', 'term.rejected') +
        K.big(K.pct(p.rate), 'брак, % · ' + per, 'term.rate') +
        K.big(p.low ? '—' : String(p.over), p.low ? 'видів браку понад норму — не рахується: перевірено менше ' + r.minSample + ' шт' : 'видів браку понад норму ' + T + '% · з ' + r.types.length, 'kd.threshold') + '</div>' +
        blurHtml(r) +
        '<div class="kd-facts__row"><div class="kd-facts__col"><p class="kd-sec">Рівні браку відділу · ' + K.num(p.rejected) + ' шт' + help('term.levels') + '</p>' + levels + '</div>' +
        '<div class="kd-facts__col"><p class="kd-sec">Дії відділу за етапами · стан на сьогодні' + help('kd.stages') + '</p>' + K.stageTiles(r.stages, { note: { relapse: 'за весь час', closed: 'за весь час' } }) + '</div></div></section>';
    }
    function blurHtml(r) {
      var b = r.blur, T = r.threshold;
      if (!b || r.period.low) return '';
      var V = { over: ['Точно понад норму', 'навіть з урахуванням випадковості брак, % вище ' + T + '%.'],
        near: ['Близько до межі', 'справжній брак, % може бути і трохи нижче, і трохи вище ' + T + '% — дивимось наступний розбір.'],
        ok: ['Точно в нормі', 'навіть з урахуванням випадковості брак, % нижче ' + T + '%.'] }[b.verdict];
      return '<div class="kd-blur"><div class="kd-blur__head"><p class="kd-sec">Наскільки точне число' + help('kd.blur') + '</p>' +
        '<button class="btn btn--quiet btn--sm" type="button" data-act="kd-blur-how">' + P.ic('info', 'ui-icon--sm') + 'Як це читати</button></div>' +
        '<p class="kd-blur__verdict kd-blur__verdict--' + b.verdict + '"><b>' + V[0] + '</b> — ' + V[1] + '</p>' + H.blurBar(b, T) +
        '<p class="hint">Перевірено ' + K.num(b.n) + ' шт → число може «гуляти» на ±' + K.pct(b.margin).replace('%', '') + ' в. п.: справжній брак найімовірніше від ' +
        K.pct(b.lo) + ' до ' + K.pct(b.hi) + ' (сіра смуга). Щоб смуга була ±1 в. п., перевірте ≈ ' + K.num(b.need1) + ' шт за розбір.</p></div>';
    }
    function blurHow(T) {
      var ex = function (rate, m, v, title, text) {
        return '<div class="kd-blur__ex"><p class="kd-blur__verdict kd-blur__verdict--' + v + '"><b>' + title + '</b></p>' +
          H.blurBar({ rate: rate, lo: Math.max(0, rate - m), hi: rate + m, verdict: v }, T, true) + '<p class="hint">' + text + '</p></div>';
      };
      P.sr.modal({ title: 'Наскільки точне число браку', size: 'sm', body:
        '<p><b>Ми перевіряємо не всі вироби, а частину.</b> Як із супом: щоб дізнатися, чи пересолений казан, куштують ложку. ' +
        'Ложка буває трохи солоніша чи прісніша за весь суп — так і брак, % у перевірених штуках трохи «гуляє» навколо справжнього.</p>' +
        '<p><b>Сіра смуга</b> — де справжній брак усього, що зробив відділ, найімовірніше (9 разів з 10). <b>Крапка</b> — те, що намірили. ' +
        '<b>Пунктир</b> — межа ' + T + '%. Що більше штук перевірили, то вужча смуга — як більше ложок.</p>' +
        ex(8, 1.5, 'over', 'Точно понад норму', 'Уся смуга праворуч від межі — навіть «найкращий» варіант гірший за норму. Тут точно є що робити.') +
        ex(5.4, 1.6, 'near', 'Близько до межі', 'Смуга перетинає межу — справжній брак може бути і 4%, і 7%. Один розбір не вирішує: дивимось наступний.') +
        ex(2.5, 1.2, 'ok', 'Точно в нормі', 'Уся смуга ліворуч від межі — навіть «найгірший» варіант у нормі.'),
        foot: '<span style="flex:1"></span><button class="btn btn--primary" type="button" data-ov-close>Зрозуміло</button>' });
    }
    function chartHtml(r) {
      return '<section class="card col--wide"><div class="card-head kd-chart-head"><h3 class="card-title">Брак відділу по розборах' + help('kd.dept.chart') + '</h3>' +
        '<div class="seg seg--sm kd-unit" role="group" aria-label="Одиниці графіка">' + [['pct', '%'], ['pcs', 'шт']].map(function (u) {
          return '<button class="seg__btn" type="button" data-act="kd-unit" data-v="' + u[0] + '">' + u[1] + '</button>'; }).join('') + '</div></div>' +
        '<div data-kd-chartcap></div><div data-chart="kd-dept"></div>' + K.chartKeys('dept', r.threshold, r.minSample, 'рамка — обраний розбір') + '<div data-kd-pin="dept"></div></section>';
    }
    function actRow(a, r, hide) {
      return '<div class="row-item kd-act' + (hide ? ' kd-x' : '') + '" data-act="open"' + K.ref(a) + '><span class="row-item__main"><span class="row-item__title">' +
        '<button class="link" type="button" data-act="open"' + K.ref(a) + '>' + esc(a.name) + '</button> · ' + esc(K.result(a, r.threshold)) + '</span>' +
        '<span class="row-item__meta">' + esc(K.actMeta(a)) + '</span></span>' + K.stateBadge(a, r.today) + '</div>';
    }
    function actionsHtml(r) {
      var acts = r.actions;
      var groups = K.STAGES.map(function (s) { return { s: s, list: acts.filter(function (a) { return a.stage === s.id; }) }; }).filter(function (g) { return g.list.length; });
      return '<section class="card col"><div><h3 class="card-title">Дії відділу · ' + acts.length + help('kd.stages') + '</h3>' +
        K.cap('За весь час, згруповано за етапом на сьогодні. Число біля назви — частка виду браку в розборі дії (після стрілки — у розборі перевірки). Клік по рядку — картка дії.') + '</div>' +
        (acts.length ? groups.map(function (g) {
          return '<div class="kd-grp" data-kd-more><p class="kd-grp__t">' + K.stageMark(g.s) + esc(g.s.label) + ' · ' + g.list.length + help(g.s.help) + '</p><div class="list">' +
            g.list.map(function (a, i) { return actRow(a, r, i >= ACT_SHOW); }).join('') + '</div>' + K.moreBtn(g.list.length, ACT_SHOW, 'Показати всі') + '</div>';
        }).join('') : '<p class="kd-text">Дій у відділі не було.</p>') + '</section>';
    }
    function typesHtml(r) {
      var p = r.period, T = r.threshold, withDefect = r.types.filter(function (x) { return x.pieces > 0; }).length;
      return '<section class="card kd-types"><div class="kd-types__head"><div class="kd-types__title"><h3 class="card-title">Види браку відділу · розбір ' + esc(K.range(p.start, p.end)) + '</h3>' +
        K.cap('У переліку ' + K.plural(r.types.length, 'вид браку', 'види браку', 'видів браку') + ' із довідника відділу; у цьому розборі з браком — ' + withDefect + (p.low ? '' : ', понад ' + T + '% — ' + p.over) +
          '. % = шт виду браку ÷ ' + K.num(p.checked) + ' перевірених у відділі за розбір. Клік по рядку — усе про вид.') + '</div>' +
        '<div class="kd-types__tools"><div class="seg seg--sm" role="group" aria-label="Сортування">' + SORTS.map(function (s) {
          return '<button class="seg__btn" type="button" data-act="kd-sort" data-v="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>' +
        '<label class="kd-find">' + P.ic('search', 'ui-icon--sm') + '<input class="input" type="search" data-input="kd-find" value="' + esc(st.find) + '" placeholder="Назва виду браку" aria-label="Пошук виду браку за назвою"></label></div></div>' +
        '<div class="kd-thead"><span>Вид браку · рівень' + help('term.defectType') + '</span><span>% від перевірених' + help('kd.dept.typePct') + '</span><span>шт</span><span>шкала 0–10% · риска — норма ' + T + '%</span>' +
        '<span>7 розборів до обраного, %' + help('kd.typeChart') + '</span><span>стан дії на сьогодні' + help('kd.typeState') + '</span><span></span></div><div data-kd-rows></div></section>';
    }
    function rowHtml(x, i, r) {
      var open = st.t === x.defectTypeId, T = r.threshold, id = esc(x.defectTypeId), s = x.state;
      return '<div class="kd-t' + (open ? ' kd-t--open' : '') + (x.over ? ' kd-t--over' : '') + (x.pieces ? '' : ' kd-t--zero') + '">' +
        '<div class="kd-t__row" data-act="kd-type" data-id="' + id + '">' +
        '<div class="kd-t__name"><button class="kd-t__btn" type="button" data-act="kd-type" data-id="' + id + '" aria-expanded="' + open + '">' + esc(x.name) + '</button>' +
        '<span class="kd-t__sub">' + H.lvl(x.level) + (x.active ? '' : '<span class="hint">вимкнений у довіднику</span>') + '</span></div>' +
        '<div class="kd-t__pct"><b>' + K.pct(x.rate) + '</b>' + (x.over ? '<span>понад ' + T + '%</span>' : '') + '</div>' +
        '<div class="kd-t__n"><b>' + K.num(x.pieces) + '</b> шт</div>' +
        '<div class="kd-t__scale">' + H.threshold(x.rate, x.over) + '</div>' +
        '<div class="kd-t__mini" data-act="kd-noop" data-kd-mini="' + i + '"></div>' +
        '<div class="kd-t__state">' + K.stateBadge(s, r.today) + (s.period != null && s.period !== r.period.n ? '<span class="sub">розбір ' + esc(K.rangeShort(s.start, s.end)) + '</span>' : '') + '</div>' +
        '<span class="kd-t__chev">' + P.ic(open ? 'chevron-up' : 'chevron-down') + '</span></div>' +
        (open ? '<div class="kd-t__panel" data-kd-panel></div>' : '') + '</div>';
    }

    function drawAll() {
      var r = data;
      ctx.el.innerHTML = headHtml(r) + factsHtml(r) + '<div class="row">' + chartHtml(r) + actionsHtml(r) + '</div>' + typesHtml(r);
      var head = ctx.el.querySelector('[data-kd-head]'), bar = root.document.querySelector('.sr-tabsbar');
      if (head && bar) head.style.top = bar.offsetHeight + 'px';
      drawChart(); drawRows();
    }
    function markSeg(act, v) {
      Array.prototype.forEach.call(ctx.el.querySelectorAll('[data-act="' + act + '"]'), function (b) { b.classList.toggle('seg__btn--on', b.getAttribute('data-v') === v); });
    }
    function pinFacts(x, T) {
      return K.plural(x.audits, 'аудит', 'аудити', 'аудитів') + ' · перевірено ' + K.num(x.checked) + ' шт · брак ' + K.num(x.rejected) + ' шт · ' + K.pct(x.rate) +
        ' · видів браку понад ' + T + '%: ' + (x.low ? 'не рахується' : x.over);
    }
    function drawChart() {
      var r = data, el = ctx.el.querySelector('[data-chart="kd-dept"]'), pin = ctx.el.querySelector('[data-kd-pin="dept"]');
      if (!el) return;
      markSeg('kd-unit', st.unit);
      ctx.el.querySelector('[data-kd-chartcap]').innerHTML = K.cap('Відділ «' + esc(r.dept.name) + '», розбори ' + esc(K.spanOf(r.series)) + '. Стовпчик — один 4-денний розбір; висота — ' +
        (st.unit === 'pcs' ? 'брак відділу, шт' : 'брак відділу, % від перевірених у відділі') + '; кольори — рівні браку. Наведіть на стовпчик — числа розбору; клік — зафіксувати.');
      pin.innerHTML = '';
      K.deptChart(el, r.series, { unit: st.unit, sel: r.period.n, T: r.threshold, height: 280,
        label: 'Брак відділу «' + r.dept.name + '» по розборах, ' + (st.unit === 'pcs' ? 'шт' : '%'),
        onPin: function (it) { pin.innerHTML = it ? K.pinRow(it.p, r.period.n, pinFacts(it.p, r.threshold)) : ''; } });
    }
    function drawRows() {
      var r = data, box = ctx.el.querySelector('[data-kd-rows]');
      if (!box) return;
      markSeg('kd-sort', st.s);
      var f = st.find.trim().toLowerCase();
      var list = r.types.filter(function (x) { return !f || x.name.toLowerCase().indexOf(f) >= 0; }).sort(SORT_FN[st.s]);
      box.innerHTML = list.length ? list.map(function (x, i) { return rowHtml(x, i, r); }).join('')
        : '<p class="kd-text kd-types__none">' + (r.types.length ? 'Видів браку з такою назвою у відділі немає.' : 'У довіднику відділу немає видів браку.') + '</p>';
      list.forEach(function (x, i) {
        K.typeChart(box.querySelector('[data-kd-mini="' + i + '"]'), x.dyn, { name: x.name, T: r.threshold, mini: true, height: 36, label: 'Частка виду браку «' + x.name + '», % · 7 розборів до обраного' });
      });
      if (st.t && box.querySelector('[data-kd-panel]')) showType();
    }
    function showType() {
      var my = ++treq, key = st.t + '|' + data.period.n, panel = ctx.el.querySelector('[data-kd-panel]');
      var paint = function (r) { var el = ctx.el.querySelector('[data-kd-panel]'); el.style.minHeight = ''; el.innerHTML = K.typePanel(r, { today: data.today }); K.typePanelMount(el, r); };
      if (tdata && tdata.key === key) paint(tdata.r);
      else { panel.style.minHeight = panelH ? panelH + 'px' : ''; panel.innerHTML = H.loading(); }
      P.srv('srKdType', { locationId: ctx.loc.id, departmentId: depId, defectTypeId: st.t, period: data.period.n }).then(function (r) {
        if (!ctx.alive() || my !== treq || !ctx.el.querySelector('[data-kd-panel]')) return;
        if (!r.ok) { tdata = null; var el = ctx.el.querySelector('[data-kd-panel]'); el.style.minHeight = ''; el.innerHTML = H.error(r); return; }
        var json = JSON.stringify(r);
        if (tdata && tdata.key === key && tdata.json === json) return;   // нічого не змінилось — не перемальовуємо (не згортаємо розгорнуте)
        tdata = { key: key, r: r, json: json }; paint(r);
      });
    }
  } });
})(window);
