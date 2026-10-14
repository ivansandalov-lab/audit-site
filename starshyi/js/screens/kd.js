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
  K.perNote = function (p, lastN) {
    return p.current ? 'триває · день ' + p.daysDone + ' з ' + p.days : p.n === lastN ? 'останній повний' : '';
  };

  K.segNav = function (on, extra) {
    return '<div class="kd-top"><div class="seg" style="flex:none">' + [['/kd', 'По відділах'], ['/kd/list', 'Список дій'], ['/kd/stats', 'Чи допомагають']].map(function (x) {
      return '<a class="seg__btn' + (x[0] === on ? ' seg__btn--on' : '') + '" href="#' + x[0] + '" style="text-decoration:none">' + x[1] + '</a>';
    }).join('') + '</div>' + (extra || '') + '</div>';
  };
  K.cap = function (html) { return '<p class="kd-cap">' + html + '</p>'; };
  K.stateBadge = function (a, today) {
    var st = P.sr.kdStateOf(a.status);
    if (a.status === 'none') return H.kdState('ok', 'дій не було');
    if (a.status === 'started') {
      if (a.overdue) return H.kdState(st, 'в роботі · термін минув ' + H.dayShort(a.due));
      if (a.due && a.due <= K.addDays(today, 1)) return H.kdState(st, 'в роботі · термін ' + (a.due === today ? 'сьогодні' : 'завтра') + ', ' + H.dayShort(a.due));
    }
    return H.kdState(st);
  };
  K.rates = function (a) {
    if (a.after != null) return K.pct(a.rate) + ' → ' + K.pct(a.after);
    if (a.interim) return K.pct(a.rate) + ' → поки ' + K.pct(a.interim.rate);
    return K.pct(a.rate);
  };
  K.result = function (a, T) { return K.rates(a) + (a.after != null ? ' · поріг ' + T + '%' : ''); };
  K.actMeta = function (a) {
    var per = 'розбір ' + K.rangeShort(a.periodStart, a.periodEnd);
    if (a.status === 'new') return per + ' · ' + K.num(a.pieces) + ' шт з ' + K.num(a.checked) + ' · рішення немає' +
      (a.overRun >= 2 ? ' · понад норму ' + K.plural(a.overRun, 'розбір', 'розбори', 'розборів') + ' поспіль, з ' + H.dayShort(a.overSince) : '');
    if (a.status === 'started') return per + ' · впровадити до ' + H.dayShort(a.due) + (a.whoName ? ' · ' + a.whoName : '');
    if (a.status === 'check') return per + ' · впроваджено ' + H.dayShort(a.implementedAt) + ' · перевірка — розбір ' + K.rangeShort(a.checkStart, a.checkEnd);
    if (a.status === 'not_needed') return per + ' · «' + a.notNeededReason + '»';
    return per + ' → перевірка в розборі ' + K.rangeShort(a.afterStart, a.afterEnd);
  };
  K.steps = function (a) {
    var s1 = a.status === 'new' ? 'now' : 'done', s2 = a.implementedAt ? 'done' : a.status === 'started' ? 'now' : '',
      s3 = a.status === 'check' ? 'now' : a.status === 'helped' || a.status === 'not_helped' ? 'done' : '';
    var dot = function (k, t) { return '<span><i class="dotd' + (k ? ' dotd--' + k : '') + '"></i>' + t + '</span>'; };
    return '<div class="steps">' + dot(s1, 'Почато' + (a.startedAt && a.status !== 'new' ? ' ' + H.dayShort(a.startedAt) : '')) + '<i class="ln"></i>' +
      dot(s2, 'Впроваджено' + (a.implementedAt ? ' ' + H.dayShort(a.implementedAt) : '')) + '<i class="ln"></i>' +
      dot(s3, 'Перевірка' + (a.checkStart ? ' ' + K.rangeShort(a.checkStart, a.checkEnd) : a.afterStart ? ' ' + K.rangeShort(a.afterStart, a.afterEnd) : '')) + '</div>';
  };
  K.CAUSE_LABELS = { skill: 'Не знав / не вміє', discipline: 'Знав, але не зробив', tool: 'Інструмент чи оснастка', material: 'Матеріал', organization: 'Організація роботи', other: 'Інше' };
  K.causeText = function (a) {
    return a.causes.map(function (c, i) { return (K.CAUSE_LABELS[c] || c) + (i === 0 && a.causes.length > 1 ? ' (головна)' : ''); }).join(' · ');
  };
  K.ref = function (a) {
    return a.id ? ' data-id="' + esc(a.id) + '"' : ' data-dep="' + esc(a.departmentId) + '" data-type="' + esc(a.defectTypeId) + '" data-period="' + a.period + '"';
  };
  K.refOf = function (t) {
    var id = t.getAttribute('data-id');
    return id ? { id: id } : { departmentId: t.getAttribute('data-dep'), defectTypeId: t.getAttribute('data-type'), period: +t.getAttribute('data-period') };
  };
  K.formula = function (x, T) {
    return '<p class="kd-formula"><b' + (x.over ? ' class="kd-hot"' : '') + '>' + K.pct(x.rate) + '</b><span>= ' + K.num(x.pieces) + ' шт цього виду браку ÷ ' +
      K.num(x.checked) + ' перевірених у відділі за ' + K.rangeShort(x.start, x.end) + '</span>' + H.badge('поріг ' + T + '%') + '</p>';
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
  function barCls(x, sel) { return (x.low || x.current ? 'kd-dim' : '') + (selected(sel, x.n) ? ' kd-sel' : ''); }
  K.spanOf = function (series) { return series.length ? H.dayShort(series[0].start) + ' – ' + H.dayShort(series[series.length - 1].end) : ''; };
  K.deptItems = function (series, unit, sel) {
    return series.map(function (x) {
      return { key: x.n, x: K.rangeShort(x.start, x.end), v: unit === 'pcs' ? x.rejected : x.rate || 0, levels: x.levels, none: !x.checked && !x.rejected, cls: barCls(x, sel), p: x };
    });
  };
  K.deptTip = function (x, T) {
    var sub = x.current ? 'розбір триває · день ' + x.daysDone + ' з ' + x.days : x.low ? 'перевірено менше ' + x.minSample + ' шт' : '';
    return P.srChart.tipDay({ title: 'Розбір ' + K.range(x.start, x.end), sub: sub, none: !x.checked && !x.rejected ? 'Аудитів у відділі не було' : '',
      audits: x.audits, checked: x.checked, rejected: x.rejected, pct: x.rate, levels: x.levels,
      rows: [['Видів браку понад ' + T + '%', x.low ? 'не рахується' : String(x.over), x.over ? 'danger' : '']] });
  };
  K.deptChart = function (el, series, o) {
    return P.srChart.mount(el, { items: K.deptItems(series, o.unit || 'pct', o.sel), height: o.height || (o.mini ? 48 : 280), mini: !!o.mini, max: o.max,
      label: o.label || 'Брак відділу по розборах', tip: function (it) { return K.deptTip(it.p, o.T); }, onPin: o.onPin });
  };
  K.typeItems = function (series, sel) {
    return series.map(function (x) {
      return { key: x.n, x: K.rangeShort(x.start, x.end), v: x.rate || 0, hot: x.over, none: !x.checked, cls: barCls(x, sel), p: x };
    });
  };
  K.typeTip = function (x, name, T, marks) {
    var sub = name + (x.current ? ' · розбір триває, день ' + x.daysDone + ' з ' + x.days : x.low && x.checked ? ' · перевірено менше ' + x.minSample + ' шт' : '');
    var foot = marks && Object.prototype.hasOwnProperty.call(marks, x.n) ? marks[x.n] : '';
    if (!x.checked) return P.srChart.tip({ title: 'Розбір ' + K.range(x.start, x.end), sub: name, foot: 'Аудитів у відділі не було' });
    return P.srChart.tip({ title: 'Розбір ' + K.range(x.start, x.end), sub: sub, foot: foot,
      rows: [['Цього виду браку', K.num(x.pieces) + ' шт'], ['Перевірено у відділі', K.num(x.checked) + ' шт'], ['Частка', K.pct(x.rate), x.over ? 'danger' : ''], ['Поріг', T + '%']] });
  };
  K.typeChart = function (el, series, o) {
    var marks = o.sel != null && typeof o.sel === 'object' ? o.sel : null;
    return P.srChart.mount(el, { items: K.typeItems(series, o.sel), height: o.height || (o.mini ? 36 : 200), mini: !!o.mini,
      label: o.label || 'Частка виду браку по розборах', line: { v: o.T, label: 'поріг ' + o.T + '%' },
      tip: function (it) { return K.typeTip(it.p, o.name, o.T, marks); }, onPin: o.onPin });
  };
  K.pinRow = function (x, selN, facts) {
    return '<div class="kd-pin"><span><b>Зафіксовано: розбір ' + esc(K.range(x.start, x.end)) + '</b> · ' + facts + '</span>' +
      (x.n === selN ? '<span class="hint">це обраний розбір</span>'
        : '<button class="btn btn--secondary btn--sm" type="button" data-act="kd-show" data-n="' + x.n + '">Показати цей розбір</button>') + '</div>';
  };
  K.chartKeys = function (kind, T, min, selText) {
    return '<div class="legend kd-keys">' + (kind === 'dept' ? ['fix', 'repair', 'scrap'].map(function (k) { return H.lvl(k); }).join('')
      : '<span class="kd-key kd-key--hot">понад ' + T + '%</span><span class="kd-key kd-key--one">до ' + T + '% включно</span>') +
      '<span class="kd-key kd-key--dim">блідий — перевірено менше ' + min + ' шт або розбір триває</span>' +
      (selText ? '<span class="kd-key kd-key--sel">' + esc(selText) + '</span>' : '') + '</div>';
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
    if (a.status === 'new') return b('btn--primary', 'start', 'Почати дію') + b('btn--quiet', 'nn', 'Не потрібно');
    if (a.status === 'started') return b('btn--primary', 'impl', 'Впроваджено', 'check') + b('btn--secondary', 'edit', 'Змінити план', 'edit') + b('btn--quiet', 'nn', 'Не потрібно');
    if (a.status === 'check') return b('btn--secondary', 'edit', 'Змінити план', 'edit') + b('btn--secondary', 'impl', 'Змінити дату впровадження', 'calendar');
    if (a.status === 'not_helped' && a.retryable) return b('btn--primary', 'retry-kd', 'Почати нову дію');
    if (a.status === 'not_needed') return b('btn--secondary', 'nn', 'Змінити причину', 'edit');
    return '';
  };
  K.bindActions = function (ctx, find) {
    ctx.on('start', function (t) { K.openStart(ctx, K.refOf(t)); });
    ctx.on('nn', function (t) { K.openNotNeeded(ctx, K.refOf(t), find(t)); });   // без знайденої дії вікно відкриється з порожнім заголовком — сервер усе одно перевірить
    ctx.on('edit', function (t) { K.openStart(ctx, K.refOf(t), { edit: true }); });
    ctx.on('impl', function (t) { var a = find(t); if (a) K.openImplement(ctx, a); });
    ctx.on('retry-kd', function (t) { var a = find(t); if (a) K.openStart(ctx, { departmentId: a.departmentId, defectTypeId: a.defectTypeId, period: a.resultPeriod }); });
    ctx.on('open', function (t) { K.openDrawer(ctx, K.refOf(t)); });
    ctx.on('kd-all', K.toggleMore);
  };
  K.finder = function (list) {
    return function (t) {
      var r = K.refOf(t);
      return list.filter(function (a) { return r.id ? a.id === r.id : !a.id && a.departmentId === r.departmentId && a.defectTypeId === r.defectTypeId && a.period === r.period; })[0];
    };
  };
})(window);
