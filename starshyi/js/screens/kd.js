(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc;
  var K = P.srKd = {};

  var MON = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  function dd(day) { var p = String(day).split('-'); return { d: +p[2], m: +p[1] }; }
  K.range = function (a, b) { var x = dd(a), y = dd(b); return x.m === y.m ? x.d + '–' + y.d + ' ' + MON[y.m - 1] : x.d + ' ' + MON[x.m - 1] + ' – ' + y.d + ' ' + MON[y.m - 1]; };
  K.rangeShort = function (a, b) { var x = dd(a), y = dd(b); return x.m === y.m ? x.d + '–' + H.dayShort(b) : H.dayShort(a) + '–' + H.dayShort(b); };
  K.wd = function (day) {
    return new Date(Date.parse(day + 'T12:00:00Z')).toLocaleDateString('uk-UA', { weekday: 'short', timeZone: 'UTC' }) + ', ' + H.dayShort(day);
  };
  K.plural = function (n, a, b, c) { return n + ' ' + P.plural(n, a, b, c); };
  K.pct = H.pct;
  K.num = H.num;
  K.addDays = function (k, n) { var p = k.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * 86400000).toISOString().slice(0, 10); };
  K.todayKey = function () { return P.fmt.dayKey(new Date()); };
  K.delta = function (from, to) {
    if (from == null || to == null) return '';
    var d = Math.round((to - from) * 10) / 10;
    return d === 0 ? 'без змін' : (d > 0 ? '+' : '−') + String(Math.abs(d)).replace('.', ',') + ' в. п.';
  };
  K.wdAcc = function (wd) { return ['понеділок', 'вівторок', 'середу', 'четвер', 'пʼятницю', 'суботу', 'неділю'][(wd || 5) - 1]; };
  K.week = function (a, b) { return 'тиждень ' + K.rangeShort(a, b); };
  K.weekNote = function (p, lastN) { return p.current ? 'триває · день ' + p.daysDone + ' з ' + p.days : p.n === lastN ? 'останній завершений' : ''; };

  K.segNav = function (on, extra) {
    return '<div class="kd-top"><div class="seg" style="flex:none">' + [['/kd', 'По відділах'], ['/kd/list', 'Список КД'], ['/kd/stats', 'Що після дій']].map(function (x) {
      return '<a class="seg__btn' + (x[0] === on ? ' seg__btn--on' : '') + '" href="#' + x[0] + '" style="text-decoration:none">' + x[1] + '</a>';
    }).join('') + '</div>' + (extra || '') + '</div>';
  };
  K.earlyRatesText = function (R, max) {
    var list = (R && R.earlyRates) || [];
    return list.slice(0, max || list.length).map(function (x) { return 'на ' + K.num(x.n) + ' шт — від ' + K.pct(x.rate); }).join(', ');
  };
  K.paretoOrderText = function (R) {
    return ((R && R.paretoOrder) || ['scrap', 'repair', 'fix']).map(function (l) { return P.sr.LEVELS[l] || l; }).join(' → ');
  };
  K.ruleLine = function (R) {
    var q = function (k) { return P.help ? P.help.btn(k) : ''; }, er = K.earlyRatesText(R, 2);
    return '<p class="hint kd-rule">Розбір — щотижня в ' + esc(K.wdAcc(R.reviewWeekday)) + ' зранку: підсумок 7 попередніх днів' + q('kd.review') + '. Коригуюча дія (КД) відділу відкривається, коли брак, % відділу за тиждень понад норму ' +
      R.threshold + '%' + q('kd.threshold') + '. Ранній тумблер — КД посеред тижня, лише якщо вже перевірено від ' + K.num(R.early) + ' шт і брак певно понад норму' + (er ? ' (' + esc(er) + ')' : '') +
      '; поки у відділу є КД, що триває, він вимкнений' + q('kd.minSample') + '. Пункти — види браку в порядку ' + esc(K.paretoOrderText(R)) + ', що повністю вміщаються в ' + R.pareto + '% браку' + q('kd.pareto') + '.</p>';
  };
  K.cap = function (html) { return '<p class="kd-cap">' + html + '</p>'; };
  K.stateBadge = function (a) {
    if (!a || a.status === 'none') return H.kdState('ok', 'дій не було');
    var st = P.sr.kdStateOf(a.status);
    if (a.status === 'new' && a.earlyBelow) return H.kdState(st, 'відкрито раннім тумблером · тиждень завершився: ' + K.pct(a.weekRate) + ' (не вище норми)');
    if (a.status === 'new' && a.overWeeks >= 2) return H.kdState(st, 'понад норму, не почато · ' + K.plural(a.overWeeks, 'тиждень', 'тижні', 'тижнів'));
    return H.kdState(st);
  };
  K.stateLabel = function (s) { return P.sr.KD_STATES[s] ? P.sr.KD_STATES[s].label : String(s || ''); };
  K.isOpen = function (a) { return a.phase ? a.phase === 'open' : !a.implementedAt && a.status !== 'not_needed'; };
  K.earlyBadge = function (a) { return a && a.early ? H.badge('ранній тумблер · ' + H.dayShort(a.openedAt), 'warn') : ''; };
  K.rates = function (a) {
    if (a.after != null) return K.pct(a.rate) + ' → ' + K.pct(a.after) + (a.after2 != null ? ' → ' + K.pct(a.after2) : '');
    if (a.result && a.result.pending && a.result.checked) return K.pct(a.rate) + ' → поки ' + K.pct(a.result.rate);
    return K.pct(a.rate);
  };
  K.result = function (a, T) { return K.rates(a) + (a.after != null ? ' · норма ' + T + '%' : ''); };
  K.actMeta = function (a) {
    var per = K.week(a.periodStart, a.periodEnd), r = a.result, h = a.hold;
    if (a.status === 'pre') return per + ' · відкрито достроково ' + H.dayShort(a.openedAt) + ' · тиждень ще йде · ' + K.num(a.rejected) + ' шт з ' + K.num(a.checked) + ' · плану немає';
    if (a.status === 'decide') return per + ' · відкрито достроково ' + H.dayShort(a.openedAt) + ' · тиждень завершився: ' + K.pct(a.weekRate) + ', не вище норми · потрібне рішення';
    if (K.isOpen(a)) return per + ' · відкрито ' + H.dayShort(a.openedAt) + (a.early ? ' (ранній тумблер)' : '') + ' · ' + K.num(a.rejected) + ' шт з ' + K.num(a.checked) +
      (a.earlyBelow ? ' · тиждень завершився: ' + K.pct(a.weekRate) + ', не вище норми' : '') + ' · плану немає';
    if (a.status === 'not_needed') return per + ' · «' + a.notNeededReason + '»';
    var impl = per + ' · впроваджено ' + H.dayShort(a.implementedAt);
    if (a.status === 'check') return impl + ' · 1-й тиждень після: ' + K.rangeShort(r.start, r.end);
    if (a.status === 'hold') return impl + ' · під наглядом з ' + H.dayShort(a.holdSince) + ' · 2-й тиждень після: ' + K.rangeShort(h.start, h.end);
    return impl + ' · 1-й тиждень після: ' + K.rangeShort(r.start, r.end) + (h ? ' · 2-й тиждень після: ' + K.rangeShort(h.start, h.end) : '');
  };
  K.CAUSE_LABELS = { skill: 'Не знав / не вміє', discipline: 'Знав, але не зробив', tool: 'Інструмент чи оснастка', material: 'Матеріал', organization: 'Організація роботи', other: 'Інше' };
  K.causeText = function (a) {
    return a.causes.map(function (c, i) { return (K.CAUSE_LABELS[c] || c) + (i === 0 && a.causes.length > 1 ? ' (головна)' : ''); }).join(' · ');
  };
  K.ref = function (a) {
    return a.id ? ' data-id="' + esc(a.id) + '"' : ' data-dep="' + esc(a.departmentId) + '" data-period="' + a.period + '"';
  };
  K.refOf = function (t) {
    var id = t.getAttribute('data-id');
    return id ? { id: id } : { departmentId: t.getAttribute('data-dep'), period: +t.getAttribute('data-period') };
  };
  K.tile = function (val, label, hot) {
    return '<div class="kd-tile"><b' + (hot ? ' class="kd-hot"' : '') + '>' + esc(val) + '</b><span>' + esc(label) + '</span></div>';
  };
  K.who = function (rows, o) {
    o = o || {};
    var show = o.show || 3, max = rows.length ? rows[0].qty || 1 : 1, word = o.all || 'Показати всіх';
    if (!rows.length) return '<p class="hint">' + esc(o.empty || 'Немає записів') + '</p>';
    if (rows.length === show + 1) show = rows.length;   // заради одного рядка кнопку не показуємо
    return '<div class="kd-who" data-kd-more>' + rows.map(function (w, i) {
      var name = o.act && w.code ? '<button class="link" type="button" data-act="' + o.act + '" data-code="' + esc(w.code) + '">' + esc(w.name) + '</button>' : esc(w.name);
      return '<div class="kd-who__row' + (i >= show ? ' kd-x' : '') + '"><span class="kd-who__name">' + name + (w.helper ? ' ' + H.badge('допомога', 'info') : '') +
        (w.note ? '<span class="sub">' + esc(w.note) + '</span>' : '') + '</span>' +
        '<span class="kd-who__bar"><i style="width:' + Math.max(3, Math.round(w.qty / max * 100)) + '%"></i></span>' +
        '<b class="kd-who__n">' + K.num(w.qty) + ' шт</b><span class="kd-who__p">' + K.pct(w.share) + '</span></div>';
    }).join('') + K.moreBtn(rows.length, show, word) + '</div>';
  };
  K.moreBtn = function (total, show, word) {
    if (total <= show) return '';
    var all = (word || 'Показати всі') + ' ' + total;
    return '<button class="btn btn--quiet btn--sm kd-more-btn" type="button" data-act="kd-all" data-all="' + esc(all) + '" data-less="Згорнути до ' + show + '">' + esc(all) + '</button>';
  };
  K.toggleMore = function (t) {
    var box = t.closest('[data-kd-more]');
    if (!box) return;
    var on = box.classList.toggle('kd-open');
    t.textContent = t.getAttribute(on ? 'data-less' : 'data-all');
  };
  K.workerRows = function (list) {
    return list.map(function (w) {
      return { name: w.name, code: w.code, qty: w.qty, share: w.share, helper: w.helper,
        note: 'у ' + w.audits + ' ' + P.plural(w.audits, 'аудиті', 'аудитах', 'аудитах') + (w.helper && w.helperQty < w.qty ? ' · як допомога — ' + w.helperQty + ' шт' : '') };
    });
  };
  K.auditorRows = function (list) {
    return list.map(function (u) {
      return { name: u.name, qty: u.qty, share: u.share, note: 'записано в ' + u.audits + ' з ' + u.auditsAll + ' ' + P.plural(u.auditsAll, 'аудиту', 'аудитів', 'аудитів') + ' відділу' };
    });
  };

  function selected(sel, n) { return sel != null && (typeof sel === 'object' ? Object.prototype.hasOwnProperty.call(sel, n) : sel === n); }
  function barCls(x, sel) { return (x.current ? 'kd-dim' : '') + (selected(sel, x.n) ? ' kd-sel' : ''); }
  K.spanOf = function (series) { return series.length ? H.dayShort(series[0].start) + ' – ' + H.dayShort(series[series.length - 1].end) : ''; };
  function kdMark(x) {
    if (x.relapse) return { text: '✕' + (x.relapse > 1 ? x.relapse : ''), cls: 'kd-relmark', title: 'рецидив виміряно в цьому тижні' };
    if (!x.kdState) return null;
    return { text: '●', cls: 'kd-wmk kd-wmk--' + x.kdState, title: 'КД за цей тиждень: ' + K.stateLabel(x.kdState) };
  }
  K.deptItems = function (series, unit, sel) {
    return series.map(function (x) {
      return { key: x.n, x: K.rangeShort(x.start, x.end), v: unit === 'pcs' ? x.rejected : x.rate || 0, levels: x.levels, none: !x.checked && !x.rejected,
        cls: barCls(x, sel), mark: kdMark(x), p: x };
    });
  };
  K.deptTip = function (x, T) {
    var rows = [['Норма', T + '%']];
    if (x.kdState) rows.push(['КД за цей тиждень', K.stateLabel(x.kdState) + (x.kdEarly ? ' · ранній тумблер' : '')]);
    if (x.relapse) rows.push(['Рецидив виміряно', 'так', 'danger']);
    return P.srChart.tipDay({ title: 'Тиждень ' + K.range(x.start, x.end), sub: x.current ? 'тиждень триває · день ' + x.daysDone + ' з ' + x.days : '',
      none: !x.checked && !x.rejected ? 'Аудитів у відділі не було' : '', audits: x.audits, checked: x.checked, rejected: x.rejected, pct: x.rate, levels: x.levels,
      over: x.over, rows: rows });
  };
  K.deptChart = function (el, series, o) {
    return P.srChart.mount(el, { items: K.deptItems(series, o.unit || 'pct', o.sel), height: o.height || (o.mini ? 48 : 280), mini: !!o.mini, max: o.max,
      xAll: !o.mini, line: o.unit === 'pcs' || !o.T ? null : { v: o.T, label: 'норма ' + o.T + '%' },
      label: o.label || 'Брак відділу по тижнях', tip: function (it) { return K.deptTip(it.p, o.T); }, onPin: o.onPin });
  };
  K.typeItems = function (series, sel) {
    return series.map(function (x) {
      var v = x.rate || 0;
      return { key: x.n, x: K.rangeShort(x.start, x.end), v: v, none: !x.checked, cls: barCls(x, sel), p: x,
        segs: x.kdState && v ? [{ v: v, cls: 'kd-sg kd-sg--' + x.kdState }] : null };
    });
  };
  K.typeTip = function (x, name, marks) {
    var foot = marks && Object.prototype.hasOwnProperty.call(marks, x.n) ? marks[x.n] : '';
    if (!x.checked) return P.srChart.tip({ title: 'Тиждень ' + K.range(x.start, x.end), sub: name, foot: 'Аудитів у відділі не було' });
    return P.srChart.tip({ title: 'Тиждень ' + K.range(x.start, x.end), sub: name + (x.current ? ' · тиждень триває, день ' + x.daysDone + ' з ' + x.days : ''), foot: foot,
      rows: [['Цього виду браку', K.num(x.pieces) + ' шт'], ['Перевірено у відділі', K.num(x.checked) + ' шт'], ['% від перевірених', K.pct(x.rate)],
        ['Частка браку відділу', K.pct(x.share)], ['Пункт КД', x.kdState ? K.stateLabel(x.kdState) : 'ні']] });
  };
  K.typeChart = function (el, series, o) {
    var marks = o.sel != null && typeof o.sel === 'object' ? o.sel : null;
    return P.srChart.mount(el, { items: K.typeItems(series, o.sel), height: o.height || (o.mini ? 36 : 200), mini: !!o.mini, xAll: !o.mini,
      label: o.label || 'Вид браку по тижнях, % від перевірених', tip: function (it) { return K.typeTip(it.p, o.name, marks); }, onPin: o.onPin });
  };
  K.pinRow = function (x, selN, facts) {
    return '<div class="kd-pin"><span><b>Зафіксовано: тиждень ' + esc(K.range(x.start, x.end)) + '</b> · ' + facts + '</span>' +
      (x.n === selN ? '<span class="hint">це обраний тиждень</span>'
        : '<button class="btn btn--secondary btn--sm" type="button" data-act="kd-show" data-n="' + x.n + '">Показати цей тиждень</button>') + '</div>';
  };
  K.chartKeys = function (kind, T, selText) {
    return '<div class="legend kd-keys">' + (kind === 'dept' ? ['fix', 'repair', 'scrap'].map(function (k) { return H.lvl(k); }).join('') +
        '<span class="kd-key kd-key--line">риска — норма ' + T + '%</span><span class="kd-key kd-key--mk"><b>●</b>КД за тиждень (колір — її стан)</span><span class="kd-key kd-key--rel"><b>✕</b>рецидив виміряно</span>'
      : '<span class="kd-key">тиждень без КД з цим видом браку</span><span class="kd-key kd-key--in">тиждень, коли вид браку був пунктом КД (колір — стан КД)</span>') +
      '<span class="kd-key kd-key--dim">блідий — тиждень триває</span>' + (selText ? '<span class="kd-key kd-key--sel">' + esc(selText) + '</span>' : '') + '</div>';
  };

  K.done = function (ctx, kind, title, text) {
    P.toast(kind || 'ok', title, text);
    (ctx.soft || ctx.reload)();
    P.emit('kd:changed');
  };
  K.showErrors = function (el, r) {
    Array.prototype.forEach.call(el.querySelectorAll('[data-err]'), function (x) { x.style.display = 'none'; x.textContent = ''; });
    Array.prototype.forEach.call(el.querySelectorAll('.input--invalid'), function (x) { x.classList.remove('input--invalid'); });
    var shown = false;
    (r.errors || []).forEach(function (e) {
      var slot = el.querySelector('[data-err="' + e.field + '"]'), f = el.querySelector('[data-f="' + e.field + '"]');
      if (slot) { slot.style.display = ''; slot.textContent = e.message; shown = true; }
      if (f) f.classList.add('input--invalid');
    });
    return shown;
  };
  K.errSlot = function (f) { return '<p class="err" data-err="' + f + '" style="display:none"></p>'; };
  K.decisionBtns = function (a) {
    var b = function (cls, act, label, ic) { return '<button class="btn ' + cls + ' btn--sm" type="button" data-act="' + act + '"' + K.ref(a) + '>' + (ic ? P.ic(ic, 'ui-icon--sm') : '') + label + '</button>'; };
    if (a.status === 'decide') return b('btn--secondary', 'nn', 'Дія не потрібна — разовий випадок') +
      '<button class="btn btn--primary btn--sm" type="button" data-act="keep" data-key="' + esc(a.key) + '">' + P.ic('check', 'ui-icon--sm') + 'Робимо дію</button>';
    if (a.status === 'not_needed') return b('btn--secondary', 'nn', 'Змінити причину', 'edit');
    if (K.isOpen(a)) return b('btn--primary', 'impl', 'Впроваджений план', 'check') + b('btn--quiet', 'nn', 'Не потрібно');
    return b('btn--secondary', 'edit', 'Змінити план', 'edit');
  };
  K.bindActions = function (ctx, find) {
    ctx.on('impl', function (t) { K.openPlan(ctx, K.refOf(t)); });
    ctx.on('edit', function (t) { K.openPlan(ctx, K.refOf(t), { edit: true }); });
    ctx.on('nn', function (t) { K.openNotNeeded(ctx, K.refOf(t), find(t)); });
    ctx.on('open', function (t) { K.openDrawer(ctx, K.refOf(t)); });
    ctx.on('keep', function (t) { K.keep(ctx, t); });
    ctx.on('kd-all', K.toggleMore);
  };
  K.finder = function (list) {
    return function (t) {
      var r = K.refOf(t);
      return list.filter(function (a) { return a && (r.id ? a.id === r.id : !a.id && a.departmentId === r.departmentId && a.period === r.period); })[0];
    };
  };
})(window);
