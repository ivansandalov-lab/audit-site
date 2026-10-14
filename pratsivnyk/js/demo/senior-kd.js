(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, S = P.demoSenior;
  var KD = S.KD, KEY = 'demo:sr:kd:actions';
  var DEPT_BARS = 12, MINI_BARS = 7, TREND_SPAN = 5, MAX_BACK = 60, PERIOD_LIST = 24;
  var GEN_THRESHOLD = 5;   // поріг для генерації тестової історії — сталий, незалежний від правил адміністратора

  var CAUSES = [
    { id: 'skill', label: 'Не знав / не вміє' },
    { id: 'discipline', label: 'Знав, але не зробив' },
    { id: 'tool', label: 'Інструмент чи оснастка' },
    { id: 'material', label: 'Матеріал' },
    { id: 'organization', label: 'Організація роботи' },
    { id: 'other', label: 'Інше' }
  ];
  var CAUSE_IX = Object.create(null);
  CAUSES.forEach(function (c) { CAUSE_IX[c.id] = c; });
  var STATUS_LABELS = { 'new': 'нова', started: 'в роботі', check: 'перевірка', helped: 'допомогла', not_helped: 'не допомогла', not_needed: 'не потрібно', none: 'дій не було' };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function sumPieces(d) { return S.pieces(d); }
  function has(o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k); }
  function fmt(v) { return String(Math.round(v * 10) / 10).replace('.', ','); }


  function genAudits(db, depId, n) {
    var from = S.periodStart(n), to = S.periodEnd(n);
    return db.audits.filter(function (a) { return a.departmentId === depId && a.day >= from && a.day <= to; });
  }
  function genStat(list, depId, typeId) {
    var o = { checked: 0, pieces: 0 };
    list.forEach(function (a) {
      o.checked += C.checkedOf(a);
      a.defects.forEach(function (d) { if (d.defectTypeId === typeId && S.sourceDept(a, d) === depId) o.pieces += sumPieces(d); });
    });
    return o;
  }
  function addPieces(list, rnd, typeId, k, culprit) {
    for (var guard = 0; k > 0 && guard < 400; guard++) {
      var slots = [];
      list.forEach(function (a) { a.items.forEach(function (it) { if (it.qty > it.rejected) slots.push([a, it]); }); });
      if (!slots.length) return;
      var s = rnd.pick(slots), a = s[0], it = s[1];
      var q = Math.min(k, it.qty - it.rejected, rnd.int(1, 3));
      var w = culprit && a.checkedWorkers.indexOf(culprit) >= 0 && rnd.chance(0.7) ? culprit : rnd.pick(a.checkedWorkers);
      var row = a.defects.filter(function (d) { return d.productId === it.productId && d.orderNo === it.orderNo && d.defectTypeId === typeId && !d.departmentId; })[0];
      if (!row) { row = { productId: it.productId, orderNo: it.orderNo, defectTypeId: typeId, photo: null, guilty: [] }; a.defects.push(row); }
      var g = row.guilty.filter(function (x) { return x.workerCode === w; })[0];
      if (g) g.qty += q; else row.guilty.push({ workerCode: w, qty: q });
      it.rejected += q; a.noDefects = false; k -= q;
    }
  }
  function setRate(db, rnd, depId, typeId, n, target, culprit) {
    var list = genAudits(db, depId, n), st = genStat(list, depId, typeId);
    if (!st.checked) return;
    var want = target > GEN_THRESHOLD ? Math.ceil(target / 100 * st.checked) : Math.floor(target / 100 * st.checked);
    if (want > st.pieces) addPieces(list, rnd, typeId, want - st.pieces, culprit);
  }
  function makeLowData(db, rnd, depId, n, typeId, culprit) {
    var list = genAudits(db, depId, n);
    if (!list.length) return;
    var keepIds = {}, wished = {};
    db.wishes.forEach(function (w) { if (w.doneAuditId) wished[w.doneAuditId] = 1; });
    keepIds[list[0].id] = 1;
    list.forEach(function (a) { if (wished[a.id]) keepIds[a.id] = 1; });
    db.audits = db.audits.filter(function (a) { return a.departmentId !== depId || a.day < S.periodStart(n) || a.day > S.periodEnd(n) || keepIds[a.id]; });
    var kept = list.filter(function (a) { return keepIds[a.id]; }), target = rnd.int(40, 52);
    var total = kept.reduce(function (s, a) { return s + C.checkedOf(a); }, 0);
    if (total > target) kept.forEach(function (a) { a.items.forEach(function (it) { it.qty = Math.max(it.rejected, 1, Math.floor(it.qty * target / total)); }); });
    addPieces(kept, rnd, typeId, rnd.int(3, 4), culprit);
  }
  function naturalMax(db, depId, typeId, from, to) {
    var m = 0;
    for (var n = from; n <= to; n++) {
      var st = genStat(genAudits(db, depId, n), depId, typeId);
      if (st.checked) m = Math.max(m, st.pieces / st.checked * 100);
    }
    return m;
  }

  function plan(kind, rnd) {
    var j = function (a, b) { return Math.round(rnd.between(a, b) * 10) / 10; };
    switch (kind) {
      case 'rise': return { rates: { '-4': j(1.9, 2.3), '-3': j(2.8, 3.2), '-2': j(3.6, 4.0), '-1': j(4.4, 4.8), '0': j(5.9, 6.4) } };
      case 'jump': return { rates: { '0': j(6.3, 7.0) } };
      case 'near': return { rates: { '-4': j(4.4, 4.7), '-3': j(5.3, 5.6), '-2': j(4.5, 4.8), '-1': j(4.6, 4.9), '0': j(5.2, 5.5) },
        seed: { at: -3, notNeeded: 'Разовий збій машини — полагодили того ж дня.' } };
      case 'helped': return { rates: { '-6': j(6.0, 6.6), '-5': j(4.2, 4.6), '-4': j(2.2, 2.8) },
        seed: { at: -6, causes: ['skill'], plan: 'Провели інструктаж біля робочого місця, показали правильний прийом.', impl: 1 } };
      case 'helped2': return { rates: { '-4': j(5.5, 6.0), '-2': j(2.6, 3.2), '-1': j(3.4, 3.8), '0': j(4.3, 4.7) },
        seed: { at: -4, causes: ['tool', 'skill'], plan: 'Замінили голки й налаштували натяг нитки на двох машинах.', impl: 2 } };
      case 'notHelped': return { rates: { '-3': j(3.8, 4.2), '-2': j(5.7, 6.0), '0': j(5.5, 5.8) },
        seed: { at: -2, causes: ['discipline'], plan: 'Нагадали про перевірку виробу перед здачею, старший відділу контролює.', impl: 1 } };
    }
    return { rates: {} };
  }

  function genHook(db, ctx) {
    var rnd = P.demoDates.makeRnd((ctx.seed || 0) + 4401);
    var L = S.lastFullPeriod(ctx.today);
    db.kdSeed = [];
    db.locations.forEach(function (loc) {
      var deps = db.departments.filter(function (d) { return d.locationId === loc.id; });
      if (deps.length < 2) return;
      var low = rnd.pick(deps), others = rnd.sample(deps.filter(function (d) { return d !== low; }), deps.length - 1);
      var used = {}, senior = 'u_sen_' + loc.id.slice(4).toLowerCase();
      ['rise', 'jump', 'near', 'helped', 'helped2', 'notHelped'].forEach(function (kind, i) {
        var dep = others[i % others.length];
        var types = db.defectTypes.filter(function (t) { return t.deptTypeId === dep.deptTypeId && !used[dep.id + t.id]; })
          .filter(function (t) { return naturalMax(db, dep.id, t.id, L - 9, L) <= 3.5; });
        if (!types.length) return;
        var type = rnd.pick(types), pl = plan(kind, rnd);
        used[dep.id + type.id] = 1;
        var culprit = rnd.pick(db.workers.filter(function (w) { return w.departmentId === dep.id; })).code;
        Object.keys(pl.rates).forEach(function (off) { setRate(db, rnd, dep.id, type.id, L + Number(off), pl.rates[off], culprit); });
        if (!pl.seed) return;
        var n = L + pl.seed.at, start = S.periodStart(n + 1);   // дію почали наступного дня після розбору
        var act = { id: 'KD_' + dep.id + '_' + type.id + '_' + n, locationId: loc.id, departmentId: dep.id, defectTypeId: type.id, period: n,
          causes: [], causeNote: '', plan: '', who: senior, due: S.addDays(start, 2), startedAt: start, startedBy: senior,
          implementedAt: null, notNeeded: null, seeded: true };
        if (pl.seed.notNeeded) act.notNeeded = { reason: pl.seed.notNeeded, at: start, by: senior };
        else { act.causes = pl.seed.causes; act.plan = pl.seed.plan; act.implementedAt = S.addDays(start, pl.seed.impl); }
        db.kdSeed.push(act);
      });
      var lt = rnd.pick(db.defectTypes.filter(function (t) { return t.deptTypeId === low.deptTypeId; }));
      makeLowData(db, rnd, low.id, L, lt.id, rnd.pick(db.workers.filter(function (w) { return w.departmentId === low.id; })).code);
    });
  }

  function loadHook(db, ctx) {
    var saved = ctx.storage.get(KEY, {}) || {};
    db.kdActions = (db.kdSeed || []).filter(function (a) { return !saved[a.id]; }).map(clone)
      .concat(Object.keys(saved).map(function (id) { return saved[id]; }));
  }


  function makeCx(env, loc) {
    var today = env.day(), L = S.lastFullPeriod(today), byN = {}, memo = {};
    env.audits().forEach(function (a) {
      if (a.locationId !== loc.id) return;
      var n = S.periodOf(a.day);
      (byN[n] = byN[n] || []).push(a);
    });
    var deps = env.db.departments.filter(function (d) { return d.locationId === loc.id; });
    var cx = { env: env, loc: loc, today: today, L: L, deps: deps, byN: byN };
    cx.stats = function (depId, n) {
      var k = depId + '|' + n, st = memo[k];
      if (!st) {
        st = memo[k] = S.deptStats(env, byN[n] || [], depId);
        st.audits = (byN[n] || []).filter(function (a) { return a.departmentId === depId; }).length;
      }
      return st;
    };
    cx.dates = function (n) {
      var start = S.periodStart(n), cur = n > L;
      return { n: n, start: start, end: S.periodEnd(n), current: cur, days: KD.PERIOD_DAYS, minSample: KD.MIN_SAMPLE,
        daysDone: cur ? Math.max(1, Math.min(KD.PERIOD_DAYS, Math.round((S.parseDay(today) - S.parseDay(start)) / 86400000) + 1)) : KD.PERIOD_DAYS };
    };
    cx.rate = function (depId, typeId, n) {
      var st = cx.stats(depId, n), pieces = has(st.byType, typeId) ? st.byType[typeId] : 0, rate = C.pct(pieces, st.checked), low = st.checked < KD.MIN_SAMPLE;
      var o = cx.dates(n);
      o.checked = st.checked; o.pieces = pieces; o.rate = rate; o.low = low; o.over = !low && rate != null && rate > KD.THRESHOLD;
      return o;
    };
    cx.period = function (depId, n) {
      var st = cx.stats(depId, n), o = cx.dates(n);
      o.audits = st.audits; o.checked = st.checked; o.rejected = st.rejected; o.rate = C.pct(st.rejected, st.checked);
      o.levels = { fix: st.byLevel.fix, repair: st.byLevel.repair, scrap: st.byLevel.scrap };
      o.low = st.checked < KD.MIN_SAMPLE;
      o.over = Object.keys(st.byType).filter(function (t) { return has(env.ix.def, t) && cx.rate(depId, t, n).over; }).length;
      return o;
    };
    cx.actions = (env.db.kdActions || []).filter(function (a) { return a.locationId === loc.id && env.ix.dep[a.departmentId] && env.ix.def[a.defectTypeId]; })
      .map(function (a) { return evalAction(cx, a); });
    cx.news = [];
    deps.forEach(function (d) {
      Object.keys(cx.stats(d.id, L).byType).forEach(function (typeId) {
        if (!env.ix.def[typeId] || !cx.rate(d.id, typeId, L).over || covered(cx, d.id, typeId)) return;
        cx.news.push({ status: 'new', departmentId: d.id, defectTypeId: typeId, period: L });
      });
    });
    return cx;
  }

  function covered(cx, depId, typeId) {
    return cx.actions.some(function (a) {
      return a.departmentId === depId && a.defectTypeId === typeId &&
        (a.status === 'started' || a.status === 'check' || a.period === cx.L || a.resultPeriod === cx.L);
    });
  }

  function evalAction(cx, a) {
    var o = clone(a);
    if (a.notNeeded) { o.status = 'not_needed'; o.finishedOn = a.notNeeded.at; return o; }
    if (!a.implementedAt) { o.status = 'started'; return o; }
    var cp = S.periodOf(a.implementedAt) + 1;
    for (var n = cp; n <= cx.L; n++) {
      var r = cx.rate(a.departmentId, a.defectTypeId, n);
      if (r.low) continue;
      o.status = r.rate <= KD.THRESHOLD ? 'helped' : 'not_helped';
      o.resultPeriod = n; o.finishedOn = S.addDays(S.periodEnd(n), 1);
      return o;
    }
    o.status = 'check'; o.checkPeriod = Math.max(cp, cx.L + 1);
    return o;
  }

  function trendOf(dyn) {
    var r = dyn.map(function (x) { return x.rate == null ? 0 : x.rate; }), last = r.length - 1, up = 0, T = KD.THRESHOLD;
    var seq = function (from) { return r.slice(from).map(fmt).join(' → ') + '%'; };
    for (var i = last; i > 0 && r[i] > r[i - 1]; i--) up++;
    if (r[last] > T && r[last - 1] <= 3 && r[last] - r[last - 1] >= 2.5) return { kind: 'jump', text: 'попередній розбір ' + fmt(r[last - 1]) + '% → цей ' + fmt(r[last]) + '%' };
    if (up >= 3) return { kind: 'rise', n: up, text: 'вище за попередній ' + up + ' ' + P.plural(up, 'розбір', 'розбори', 'розборів') + ' поспіль: ' + seq(last - up) };
    var near = r.filter(function (v) { return v >= 4 && v <= 6; }).length;
    if (near >= 4) return { kind: 'near', n: near, text: 'від 4 до 6% у ' + near + ' розборах із ' + r.length + ': ' + seq(0) };
    var overRun = 0;
    for (var k = last; k >= 0 && r[k] > T; k--) overRun++;
    if (overRun >= 2) return { kind: 'over', n: overRun, text: 'понад ' + T + '% — ' + overRun + '-й розбір поспіль' };
    return { kind: 'first', text: 'уперше понад ' + T + '% за ' + r.length + ' розборів' };
  }

  function series(cx, depId, typeId, from, to) {
    var out = [];
    for (var n = Math.max(from, to - MAX_BACK - DEPT_BARS); n <= to; n++) out.push(typeId ? cx.rate(depId, typeId, n) : cx.period(depId, n));
    return out;
  }
  function chartWindow(cx, n) {
    var from = cx.L - DEPT_BARS + 1;
    return n < from ? { from: n - 2, to: Math.min(cx.L + 1, n + DEPT_BARS - 3) } : { from: from, to: cx.L + 1 };
  }

  function dynOf(cx, depId, typeId, n) {
    if (n == null) n = cx.L;
    return series(cx, depId, typeId, n - TREND_SPAN + 1, n);
  }

  function periodArg(cx, v) {
    if (v == null || v === '') return cx.L;
    var n = typeof v === 'number' ? v : /^\d{1,6}$/.test(String(v)) ? Number(v) : NaN;
    return n === Math.floor(n) && n >= Math.max(0, cx.L - MAX_BACK) && n <= cx.L + 1 ? n : null;
  }
  function depOf(cx, id) {
    var d = has(cx.env.ix.dep, id) ? cx.env.ix.dep[id] : null;
    return d && d.locationId === cx.loc.id ? d : null;
  }
  function typeOf(cx, id) { return has(cx.env.ix.def, id) ? cx.env.ix.def[id] : null; }

  function interimOf(cx, depId, typeId) {
    var r = cx.rate(depId, typeId, cx.L + 1);
    return r.checked ? { rate: r.rate, checked: r.checked, pieces: r.pieces, start: r.start, end: r.end } : null;
  }

  function view(cx, a) {
    var ix = cx.env.ix, t = ix.def[a.defectTypeId], before = cx.rate(a.departmentId, a.defectTypeId, a.period), u = a.who && ix.user[a.who];
    var o = { id: a.id || null, key: a.departmentId + '|' + a.defectTypeId + '|' + a.period, status: a.status, statusLabel: STATUS_LABELS[a.status],
      departmentId: a.departmentId, departmentName: ix.dep[a.departmentId].name, defectTypeId: a.defectTypeId, name: t.name, level: t.level || 'fix',
      period: a.period, periodStart: before.start, periodEnd: before.end, rate: before.rate, checked: before.checked, pieces: before.pieces,
      causes: a.causes || [], causeNote: a.causeNote || '', plan: a.plan || '', who: a.who || null, whoName: u ? u.name : null,
      due: a.due || null, startedAt: a.startedAt || null, implementedAt: a.implementedAt || null,
      notNeededReason: a.notNeeded ? a.notNeeded.reason : null, finishedOn: a.finishedOn || null,
      after: null, afterStart: null, afterEnd: null, afterChecked: null, afterPieces: null, checkStart: null, checkEnd: null, interim: null,
      overdue: false, retryable: false };
    if (a.status === 'started') o.overdue = !!a.due && a.due < cx.today;
    if (a.status === 'check') { o.checkStart = S.periodStart(a.checkPeriod); o.checkEnd = S.periodEnd(a.checkPeriod); o.interim = interimOf(cx, a.departmentId, a.defectTypeId); }
    if (a.resultPeriod != null) {
      var r = cx.rate(a.departmentId, a.defectTypeId, a.resultPeriod);
      o.after = r.rate; o.afterStart = r.start; o.afterEnd = r.end; o.afterChecked = r.checked; o.afterPieces = r.pieces; o.resultPeriod = a.resultPeriod;
    }
    if (a.status === 'not_helped') o.retryable = !cx.actions.some(function (x) { return x.departmentId === a.departmentId && x.defectTypeId === a.defectTypeId && x.period > a.period && x.status !== 'not_needed'; });
    if (a.status === 'new') o.trend = trendOf(dynOf(cx, a.departmentId, a.defectTypeId, a.period));
    return o;
  }

  function details(cx, depId, typeId, n) {
    var ix = cx.env.ix, locId = cx.loc.id, W = Object.create(null), A = Object.create(null), prods = Object.create(null),
      orders = Object.create(null), byDay = Object.create(null), mine = Object.create(null), withType = 0, total = 0;
    (cx.byN[n] || []).forEach(function (a) {
      var q = 0, touches = a.departmentId === depId, helpers = Array.isArray(a.helpers) ? a.helpers : [];
      a.defects.forEach(function (d) {
        if (S.sourceDept(a, d) !== depId) return;
        touches = true;
        if (d.defectTypeId !== typeId) return;
        var pcs = S.pieces(d), ord = d.orderNo || '';
        q += pcs;
        prods[d.productId] = (prods[d.productId] || 0) + pcs;
        orders[ord] = (orders[ord] || 0) + pcs;
        d.guilty.forEach(function (g) {
          var w = W[g.workerCode] = W[g.workerCode] || { qty: 0, audits: {}, helperQty: 0 };
          w.qty += g.qty || 0; w.audits[a.id] = 1;
          if (a.departmentId === depId && helpers.indexOf(g.workerCode) >= 0) w.helperQty += g.qty || 0;
        });
      });
      if (touches) mine[a.auditorId] = (mine[a.auditorId] || 0) + 1;   // аудити, у яких аудитор перевіряв цей відділ або записав його брак
      if (a.departmentId === depId) {
        var day = byDay[a.day] = byDay[a.day] || { pieces: 0, checked: 0, audits: 0 };
        day.checked += C.checkedOf(a); day.audits++;
      }
      if (!q) return;
      withType++; total += q;
      var u = A[a.auditorId] = A[a.auditorId] || { qty: 0, audits: 0 };
      u.qty += q; u.audits++;
      (byDay[a.day] = byDay[a.day] || { pieces: 0, checked: 0, audits: 0 }).pieces += q;
    });
    function top(map, make) {
      return Object.keys(map).map(function (k) { return make(k, map[k]); }).sort(function (a, b) { return b.qty - a.qty || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); });
    }
    var share = function (q) { return C.pct(q, total); };
    var days = [];
    for (var k = S.periodStart(n); k <= S.periodEnd(n); k = S.addDays(k, 1)) {
      var x = byDay[k] || { pieces: 0, checked: 0, audits: 0 };
      days.push({ day: k, pieces: x.pieces, checked: x.checked, audits: x.audits, future: k > cx.today });
    }
    return {
      workers: top(W, function (c, w) {
        var known = ix.worker[locId + ':' + c];
        return { code: c, name: c === '' ? 'Невідомий працівник' : known ? known.name : c, qty: w.qty, share: share(w.qty), audits: Object.keys(w.audits).length,
          helper: w.helperQty > 0, helperQty: w.helperQty };
      }),
      auditors: top(A, function (id, u) {
        return { id: id, name: has(ix.user, id) ? ix.user[id].name : id, qty: u.qty, share: share(u.qty), audits: u.audits, auditsAll: mine[id] || u.audits };
      }),
      products: top(prods, function (id, q) { return { id: id, name: has(ix.prod, id) ? ix.prod[id].name : 'Невідомий виріб', qty: q, share: share(q) }; }),
      orders: top(orders, function (no, q) { return { no: no || null, name: no || 'Без замовлення', qty: q, share: share(q) }; }),
      days: days, auditsWith: withType, auditsTotal: cx.stats(depId, n).audits };
  }

  function typeState(cx, depId, typeId) {
    var mine = cx.actions.filter(function (a) { return a.departmentId === depId && a.defectTypeId === typeId; })
      .sort(function (a, b) { return b.period - a.period; });
    var isNew = cx.news.some(function (x) { return x.departmentId === depId && x.defectTypeId === typeId; });
    var cur = isNew ? { status: 'new', period: cx.L } : mine.filter(function (a) { return a.status === 'started' || a.status === 'check'; })[0] || mine[0] || null;
    if (!cur) return { status: 'none', label: STATUS_LABELS.none, id: null, period: null, start: null, end: null, count: 0 };
    return { status: cur.status, label: STATUS_LABELS[cur.status], id: cur.id || null, period: cur.period, start: S.periodStart(cur.period), end: S.periodEnd(cur.period),
      due: cur.due || null, overdue: cur.status === 'started' && !!cur.due && cur.due < cx.today, count: mine.length };
  }

  function deptActions(cx, depId) {
    var rank = { 'new': 0, started: 1, check: 2 };
    return cx.news.concat(cx.actions).filter(function (a) { return a.departmentId === depId; }).map(function (a) { return view(cx, a); })
      .sort(function (a, b) {
        var ra = has(rank, a.status) ? rank[a.status] : 3, rb = has(rank, b.status) ? rank[b.status] : 3;
        return ra - rb || (ra === 1 ? (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) : 0) || b.period - a.period || (a.name < b.name ? -1 : 1);
      });
  }

  function reviewOf(cx) {
    return { n: cx.L, start: S.periodStart(cx.L), end: S.periodEnd(cx.L), nextStart: S.periodStart(cx.L + 1), nextEnd: S.periodEnd(cx.L + 1),
      readyOn: S.periodStart(cx.L + 2) };
  }
  function since(cx, days) { return S.addDays(cx.today, -(days - 1)); }
  function totals(cx) {
    var from = since(cx, 30), n = function (st, recent) { return cx.actions.filter(function (a) { return a.status === st && (!recent || a.finishedOn >= from); }).length; };
    return { 'new': cx.news.length, started: n('started'), check: n('check'), helped30: n('helped', true), notHelped30: n('not_helped', true),
      notNeeded30: n('not_needed', true) };
  }

  function people(cx, me) {
    var list = cx.env.db.users.filter(function (u) { return u.locationIds.indexOf(cx.loc.id) >= 0 && (u.role === 'senior_auditor' || u.role === 'location_lead'); });
    if (!list.some(function (u) { return u.id === me.id; }) && cx.env.ix.user[me.id]) list.unshift(cx.env.ix.user[me.id]);
    return list.map(function (u) { return { id: u.id, name: u.name, roleLabel: P.demoDict.roleLabels[u.role], me: u.id === me.id }; });
  }


  function writable(p, me, env) {
    if (!S.canManage(me)) return { err: C.forbidden() };
    var r = S.loc(p, me, env); if (r.err) return r;
    return { cx: makeCx(env, r.loc) };
  }
  function findAction(cx, id) { return cx.actions.filter(function (a) { return a.id === id; })[0] || null; }

  function eligible(cx, p) {
    var dep = depOf(cx, p.departmentId), t = typeOf(cx, p.defectTypeId), n = periodArg(cx, p.period);
    if (!dep || !t || t.deptTypeId !== dep.deptTypeId) return { err: C.fail('not_found', 'Такого виду браку у відділі не знайдено. Оновіть сторінку.') };
    if (n == null) return { err: C.fail('not_found', 'Такого розбору немає. Оновіть сторінку.') };
    var isNew = cx.news.some(function (x) { return x.departmentId === dep.id && x.defectTypeId === t.id && x.period === n; });
    var retry = cx.actions.filter(function (a) { return a.departmentId === dep.id && a.defectTypeId === t.id && a.status === 'not_helped' && a.resultPeriod === n; })[0];
    if (retry && view(cx, retry).retryable === false) retry = null;
    if (!isNew && !retry) return { err: C.fail('conflict', 'Для цього виду браку рішення вже є. Оновіть сторінку — покажемо актуальний стан.') };
    if (findAction(cx, 'KD_' + dep.id + '_' + t.id + '_' + n)) return { err: C.fail('conflict', 'Дію за цей розбір уже записано. Оновіть сторінку.') };
    return { dep: dep, type: t, period: n, retryOf: retry ? retry.id : null };
  }

  function planErrors(cx, me, p, checkDue) {
    var errs = [], causes = Array.isArray(p.causes) ? p.causes : [];
    if (!causes.length) errs.push({ field: 'causes', message: 'Оберіть причину — хоча б одну.' });
    else if (causes.some(function (c) { return typeof c !== 'string' || !Object.prototype.hasOwnProperty.call(CAUSE_IX, c); }) || causes.length !== causes.filter(function (c, i) { return causes.indexOf(c) === i; }).length)
      errs.push({ field: 'causes', message: 'Причини мають бути з довідника, кожна один раз.' });
    if (causes.indexOf('other') >= 0 && String(p.causeNote || '').trim().length < 3) errs.push({ field: 'causeNote', message: 'Поясніть, що сталося, — ви обрали «Інше».' });
    var planText = String(p.plan || '').trim();
    if (planText.length < 3) errs.push({ field: 'plan', message: 'Напишіть, що зробимо, — хоча б кілька слів.' });
    else if (planText.length > 1000) errs.push({ field: 'plan', message: 'Коротше, будь ласка: до 1000 знаків.' });
    if (!people(cx, me).some(function (u) { return u.id === p.who; })) errs.push({ field: 'who', message: 'Оберіть, хто робить.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.due || ''))) errs.push({ field: 'due', message: 'Оберіть дату, до якої зробити.' });
    else if (checkDue && p.due < cx.today) errs.push({ field: 'due', message: 'Дата — не раніше сьогодні.' });
    else if (p.due > S.addDays(cx.today, 60)) errs.push({ field: 'due', message: 'Дата — не пізніше ніж через 60 днів.' });
    return errs;
  }

  function save(env, rec) {
    var keep = ['id', 'locationId', 'departmentId', 'defectTypeId', 'period', 'causes', 'causeNote', 'plan', 'who', 'due',
      'startedAt', 'startedBy', 'implementedAt', 'notNeeded', 'retryOf', 'seeded'], o = {};
    keep.forEach(function (k) { if (rec[k] !== undefined) o[k] = rec[k]; });
    var all = S.get(env, KEY, {}) || {};
    all[o.id] = o; S.set(env, KEY, all);
    var list = env.db.kdActions = env.db.kdActions || [], i;
    for (i = 0; i < list.length && list[i].id !== o.id; i++) { /* шукаємо */ }
    list[i] = o;
    return o;
  }
  function after(env, loc, id) {
    var cx = makeCx(env, loc);
    return { ok: true, action: view(cx, findAction(cx, id)), totals: totals(cx) };
  }

  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  function rangeOf(p, env) {
    var today = env.day(), to = DAY_RE.test(p.to || '') && p.to <= today ? p.to : today;
    var from = DAY_RE.test(p.from || '') && p.from <= to ? p.from : S.addDays(to, -29);
    if (from < S.addDays(to, -365)) from = S.addDays(to, -365);
    return { from: from, to: to };
  }

  function remapDefect(env, fromIds, toId) {
    var set = Object.create(null), all = S.get(env, KEY, {}) || {}, n = 0, taken = Object.create(null);
    function slot(a) { return a.departmentId + '|' + a.period; }
    (fromIds || []).forEach(function (id) { if (typeof id === 'string' && id !== toId) set[id] = 1; });
    (env.db.kdActions || []).forEach(function (a) { if (a.defectTypeId === toId) taken[slot(a)] = 1; });
    (env.db.kdSeed || []).forEach(function (a) { if (set[a.defectTypeId] && !has(all, a.id)) all[a.id] = clone(a); });
    Object.keys(all).forEach(function (id) {
      var a = all[id];
      if (!a || typeof a !== 'object' || !has(set, a.defectTypeId) || taken[slot(a)]) return;
      taken[slot(a)] = 1; a.defectTypeId = toId; n++;
    });
    if (n) { S.set(env, KEY, all); env.reload(); }
    return n;
  }
  P.demoKd = { remapDefect: remapDefect };

  P.demoApis.push({
    srKdCauses: function () { return { ok: true, causes: clone(CAUSES) }; },

    srKdOverview: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), from = since(cx, 30);
      var depts = cx.deps.map(function (d, order) {
        var mine = cx.actions.filter(function (a) { return a.departmentId === d.id; });
        var news = cx.news.filter(function (x) { return x.departmentId === d.id; }).map(function (x) { return view(cx, x); })
          .sort(function (a, b) { return b.rate - a.rate; });
        var count = function (st, recent) { return mine.filter(function (a) { return a.status === st && (!recent || a.finishedOn >= from); }); };
        var started = count('started').map(function (a) { return view(cx, a); }), check = count('check').map(function (a) { return view(cx, a); });
        var done = mine.filter(function (a) { return (a.status === 'helped' || a.status === 'not_helped') && a.finishedOn >= from; })
          .sort(function (a, b) { return a.finishedOn < b.finishedOn ? 1 : -1; }).map(function (a) { return view(cx, a); });
        var st = cx.stats(d.id, cx.L), busy = {};
        mine.concat(cx.news).forEach(function (a) { if (a.departmentId === d.id) busy[a.defectTypeId] = 1; });
        var top = Object.keys(st.byType).filter(function (t) { return has(env.ix.def, t) && !busy[t]; }).map(function (t) {
          var x = cx.rate(d.id, t, cx.L), def = env.ix.def[t];
          return { defectTypeId: t, name: def.name, level: def.level || 'fix', pieces: x.pieces, checked: x.checked, rate: x.rate };
        }).filter(function (x) { return x.pieces > 0; }).sort(function (a, b) { return b.pieces - a.pieces || (a.name < b.name ? -1 : 1); });
        var soon = started.filter(function (a) { return a.due && a.due <= S.addDays(cx.today, 1); })
          .sort(function (a, b) { return a.due < b.due ? -1 : 1; })[0] || null;
        return { id: d.id, name: d.name, order: order, checked: st.checked, lowData: st.checked < KD.MIN_SAMPLE, minSample: KD.MIN_SAMPLE,
          counts: { 'new': news.length, started: started.length, check: check.length, helped: count('helped', true).length },
          last: cx.period(d.id, cx.L), series: series(cx, d.id, null, cx.L - MINI_BARS + 1, cx.L),
          news: news, started: started, check: check, done: done, top: top.slice(0, 2), soonDue: soon ? soon.due : null };
      }).sort(function (a, b) { return (b.counts['new'] > 0) - (a.counts['new'] > 0) || (b.counts.started + b.counts.check > 0) - (a.counts.started + a.counts.check > 0) || a.order - b.order; });
      var sum = { depts: depts.length, lowDepts: 0, audits: 0, checked: 0, rejected: 0, over: 0 };
      depts.forEach(function (d) { sum.audits += d.last.audits; sum.checked += d.last.checked; sum.rejected += d.last.rejected; sum.over += d.last.over; if (d.lowData) sum.lowDepts++; });
      sum.rate = C.pct(sum.rejected, sum.checked);
      return { ok: true, review: reviewOf(cx), totals: totals(cx), sum: sum, depts: depts, actionsTotal: cx.actions.length + cx.news.length,
        threshold: KD.THRESHOLD, minSample: KD.MIN_SAMPLE };
    },

    srKdDept: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), dep = depOf(cx, p.departmentId);
      if (!dep) return C.fail('not_found', 'Відділ не знайдено. Поверніться до всіх відділів.');
      var n = periodArg(cx, p.period);
      if (n == null) return C.fail('not_found', 'Такого розбору немає. Оберіть розбір зі списку.');
      var per = cx.period(dep.id, n), st = cx.stats(dep.id, n), win = chartWindow(cx, n);
      var ids = {};
      env.db.defectTypes.forEach(function (t) { if (t.deptTypeId === dep.deptTypeId) ids[t.id] = 1; });
      Object.keys(st.byType).forEach(function (t) { if (has(env.ix.def, t)) ids[t] = 1; });
      var types = Object.keys(ids).map(function (id) {
        var t = env.ix.def[id], x = cx.rate(dep.id, id, n);
        return { defectTypeId: id, name: t.name, level: t.level || 'fix', active: t.active !== false, pieces: x.pieces, rate: x.rate, over: x.over,
          share: C.pct(x.pieces, per.rejected), dyn: series(cx, dep.id, id, n - MINI_BARS + 1, n), state: typeState(cx, dep.id, id) };
      }).filter(function (x) {   // вимкнений у довіднику вид показуємо, лише якщо по ньому щось є
        return x.active || x.state.status !== 'none' || x.dyn.some(function (y) { return y.pieces > 0; });
      }).sort(function (a, b) { return b.pieces - a.pieces || (a.name < b.name ? -1 : 1); });
      var actions = deptActions(cx, dep.id), counts = { 'new': 0, started: 0, check: 0, helped: 0, not_helped: 0, not_needed: 0 };
      actions.forEach(function (a) { counts[a.status]++; });
      var periods = [];
      for (var k = cx.L + 1; k > cx.L + 1 - PERIOD_LIST && k >= 0; k--) periods.push(cx.dates(k));
      if (n < periods[periods.length - 1].n) periods.push(cx.dates(n));
      return { ok: true, review: reviewOf(cx), dept: { id: dep.id, name: dep.name }, threshold: KD.THRESHOLD, minSample: KD.MIN_SAMPLE,
        canWrite: S.canManage(me), today: cx.today, period: per, decide: n >= cx.L, minPeriod: Math.max(0, cx.L - MAX_BACK), maxPeriod: cx.L + 1,
        periods: periods, series: series(cx, dep.id, null, win.from, win.to), types: types, actions: actions, counts: counts };
    },

    srKdType: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), dep = depOf(cx, p.departmentId), t = typeOf(cx, p.defectTypeId);
      if (!dep) return C.fail('not_found', 'Відділ не знайдено. Поверніться до всіх відділів.');
      var n = periodArg(cx, p.period);
      if (n == null) return C.fail('not_found', 'Такого розбору немає. Оберіть розбір зі списку.');
      if (!t || (t.deptTypeId !== dep.deptTypeId && !has(cx.stats(dep.id, n).byType, t.id))) return C.fail('not_found', 'Такого виду браку у відділі не знайдено. Оновіть сторінку.');
      var x = cx.rate(dep.id, t.id, n), per = cx.period(dep.id, n), d = details(cx, dep.id, t.id, n), prev = cx.rate(dep.id, t.id, n - 1), win = chartWindow(cx, n);
      var by = cx.stats(dep.id, n).byType, withDefect = Object.keys(by).filter(function (id) { return by[id] > 0; });
      var mineOf = function (a) { return a.departmentId === dep.id && a.defectTypeId === t.id; };
      var history = cx.news.filter(mineOf).concat(cx.actions.filter(mineOf).sort(function (a, b) { return b.period - a.period; }))
        .map(function (a) { return view(cx, a); });
      return { ok: true, dept: { id: dep.id, name: dep.name }, type: { id: t.id, name: t.name, level: t.level || 'fix', active: t.active !== false },
        threshold: KD.THRESHOLD, minSample: KD.MIN_SAMPLE, canWrite: S.canManage(me), today: cx.today, decide: n >= cx.L, period: per,
        pieces: x.pieces, checked: x.checked, rate: x.rate, over: x.over, low: x.low, share: C.pct(x.pieces, per.rejected),
        prev: { n: prev.n, start: prev.start, end: prev.end, pieces: prev.pieces, checked: prev.checked, rate: prev.rate },
        rank: x.pieces ? 1 + withDefect.filter(function (id) { return by[id] > x.pieces; }).length : null, rankOf: withDefect.length,
        trend: x.over ? trendOf(dynOf(cx, dep.id, t.id, n)) : null,
        series: series(cx, dep.id, t.id, win.from, win.to),
        workers: d.workers, auditors: d.auditors, products: d.products, orders: d.orders, days: d.days,
        auditsWith: d.auditsWith, auditsTotal: d.auditsTotal, history: history, state: typeState(cx, dep.id, t.id) };
    },

    srKdItem: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), a;
      if (p.id) {
        a = findAction(cx, p.id);
        if (!a) return C.fail('not_found', 'Дію не знайдено. Оновіть сторінку.');
      } else {
        var n = periodArg(cx, p.period);
        if (n == null) return C.fail('not_found', 'Такого розбору немає. Оновіть сторінку.');
        a = cx.news.filter(function (x) { return x.departmentId === p.departmentId && x.defectTypeId === p.defectTypeId && x.period === n; })[0];
        if (!a) {
          var e = eligible(cx, { departmentId: p.departmentId, defectTypeId: p.defectTypeId, period: n });
          if (e.err) return e.err;
          a = { status: 'new', departmentId: e.dep.id, defectTypeId: e.type.id, period: n };
        }
      }
      var v = view(cx, a), d = details(cx, a.departmentId, a.defectTypeId, a.period), per = cx.period(a.departmentId, a.period);
      v.series = series(cx, a.departmentId, a.defectTypeId, Math.min(cx.L - DEPT_BARS + 1, a.period - 2), cx.L + 1);
      v.trend = v.trend || (v.rate != null && v.rate > KD.THRESHOLD ? trendOf(dynOf(cx, a.departmentId, a.defectTypeId, a.period)) : null);
      v.workers = d.workers; v.auditors = d.auditors; v.products = d.products; v.orders = d.orders;
      v.auditsWith = d.auditsWith; v.auditsTotal = d.auditsTotal; v.deptRejected = per.rejected; v.share = C.pct(v.pieces, per.rejected);
      return { ok: true, item: v, review: reviewOf(cx), causes: clone(CAUSES), people: people(cx, me), today: cx.today,
        threshold: KD.THRESHOLD, minSample: KD.MIN_SAMPLE, canWrite: S.canManage(me) };
    },

    srKdList: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), dep = p.departmentId || null;
      var all = cx.news.concat(cx.actions).filter(function (a) { return !dep || a.departmentId === dep; }).map(function (a) { return view(cx, a); });
      var group = function (a) { return a.status === 'new' ? 'new' : a.status === 'started' ? 'started' : a.status === 'check' ? 'check' : 'done'; };
      var counts = { 'new': 0, started: 0, check: 0, done: 0, all: all.length };
      all.forEach(function (a) { counts[group(a)]++; });
      var state = Object.prototype.hasOwnProperty.call(counts, p.state) ? p.state : 'all', rank = { 'new': 0, started: 1, check: 2, done: 3 };
      var items = all.filter(function (a) { return state === 'all' || group(a) === state; }).sort(function (a, b) {
        return rank[group(a)] - rank[group(b)] || (group(a) === 'started' ? (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) : 0) ||
          b.period - a.period || (a.name < b.name ? -1 : 1);
      });
      return { ok: true, state: state, counts: counts, items: items, review: reviewOf(cx), today: cx.today, threshold: KD.THRESHOLD,
        departments: cx.deps.map(function (d) { return { id: d.id, name: d.name }; }) };
    },

    srKdStats: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), days = Number(p.days) === 90 ? 90 : 30, from = since(cx, days), periods = [];
      for (var n = cx.L; S.periodEnd(n) >= from; n--) periods.push(n);
      var inWin = {}; periods.forEach(function (x) { inWin[x] = 1; });
      var overBy = {}, over = 0, overAt = {};
      cx.deps.forEach(function (d) {
        overBy[d.id] = 0;
        periods.forEach(function (x) {
          Object.keys(cx.stats(d.id, x).byType).forEach(function (t) {
            var rt = cx.rate(d.id, t, x);
            if (!rt.over) return;
            over++; overBy[d.id]++;
            (overAt[x] = overAt[x] || []).push({ departmentName: d.name, name: has(env.ix.def, t) ? env.ix.def[t].name : 'Невідомий вид браку', rate: rt.rate, pieces: rt.pieces, checked: rt.checked });
          });
        });
      });
      var acts = cx.actions.filter(function (a) { return inWin[a.period]; }), real = acts.filter(function (a) { return a.status !== 'not_needed'; });
      var byReview = periods.slice().reverse().map(function (x) {
        var o = cx.dates(x), items = (overAt[x] || []).sort(function (a, b) { return b.rate - a.rate || (a.name < b.name ? -1 : 1); });
        o.over = items.length; o.items = items;
        o.started = real.filter(function (a) { return a.period === x; }).length;
        return o;
      });
      var cnt = function (st) { return acts.filter(function (a) { return st.indexOf(a.status) >= 0; }).length; };
      var causes = CAUSES.map(function (c) { return { id: c.id, label: c.label, n: real.filter(function (a) { return a.causes[0] === c.id; }).length }; })
        .filter(function (c) { return c.n; }).sort(function (a, b) { return b.n - a.n; });
      var depts = cx.deps.map(function (d) {
        return { id: d.id, name: d.name, n: overBy[d.id], notHelped: real.filter(function (a) { return a.departmentId === d.id && a.status === 'not_helped'; }).length };
      }).filter(function (d) { return d.n; }).sort(function (a, b) { return b.n - a.n; });
      return { ok: true, days: days, from: from, review: reviewOf(cx),
        kpi: { reviews: periods.length, over: over, started: real.length, helped: cnt(['helped']), notHelped: cnt(['not_helped']),
          running: cnt(['started', 'check']), notNeeded: cnt(['not_needed']), waiting: cx.news.length },
        beforeAfter: real.map(function (a) { return view(cx, a); }).sort(function (a, b) { return b.period - a.period || (a.name < b.name ? -1 : 1); }),
        byReview: byReview, causes: causes, depts: depts, threshold: KD.THRESHOLD, minSample: KD.MIN_SAMPLE };
    },

    srKdWorker: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var w = typeof p.code === 'string' && has(env.ix.worker, r.loc.id + ':' + p.code) ? env.ix.worker[r.loc.id + ':' + p.code] : null;
      if (!w) return C.fail('not_found', 'Працівника не знайдено. Оновіть сторінку.');
      var rg = rangeOf(p, env), pieces = Object.create(null);
      S.audits(env, r.loc.id, rg.from, rg.to).forEach(function (a) {
        a.defects.forEach(function (d) {
          d.guilty.forEach(function (g) { if (g.workerCode === w.code && g.qty > 0) pieces[d.defectTypeId] = (pieces[d.defectTypeId] || 0) + g.qty; });
        });
      });
      var cx = makeCx(env, r.loc), rank = { 'new': 0, started: 1, check: 2 };
      var items = cx.news.concat(cx.actions).filter(function (a) {
        return a.departmentId === w.departmentId && has(pieces, a.defectTypeId) && S.periodStart(a.period) <= rg.to && !(a.finishedOn && a.finishedOn < rg.from);
      }).map(function (a) { return view(cx, a); }).sort(function (a, b) {
        var ra = has(rank, a.status) ? rank[a.status] : 3, rb = has(rank, b.status) ? rank[b.status] : 3;
        return ra - rb || b.period - a.period || (a.name < b.name ? -1 : 1);
      });
      var types = Object.keys(pieces).filter(function (id) { return has(env.ix.def, id); }).map(function (id) {
        return { id: id, name: env.ix.def[id].name, pieces: pieces[id], actions: items.filter(function (a) { return a.defectTypeId === id; }).length };
      }).sort(function (a, b) { return b.pieces - a.pieces || (a.name < b.name ? -1 : 1); });
      return { ok: true, from: rg.from, to: rg.to, today: cx.today, threshold: KD.THRESHOLD,
        worker: { name: w.name, departmentId: w.departmentId, departmentName: env.ix.dep[w.departmentId] ? env.ix.dep[w.departmentId].name : '' },
        types: types, items: items };
    },

    srKdStart: function (p, me, env) {
      var w = writable(p, me, env); if (w.err) return w.err;
      var cx = w.cx, e = eligible(cx, p); if (e.err) return e.err;
      var errs = planErrors(cx, me, p, true);
      if (errs.length) return C.fail('validation', 'Перевірте поля — дещо не заповнено.', errs);
      var rec = save(env, { id: 'KD_' + e.dep.id + '_' + e.type.id + '_' + e.period, locationId: cx.loc.id, departmentId: e.dep.id,
        defectTypeId: e.type.id, period: e.period, causes: p.causes.slice(), causeNote: String(p.causeNote || '').trim(),
        plan: String(p.plan).trim(), who: p.who, due: p.due, startedAt: cx.today, startedBy: me.id, implementedAt: null, notNeeded: null,
        retryOf: e.retryOf });
      return after(env, cx.loc, rec.id);
    },

    srKdNotNeeded: function (p, me, env) {
      var w = writable(p, me, env); if (w.err) return w.err;
      var cx = w.cx, reason = String(p.reason || '').trim(), rec;
      if (reason.length < 3) return C.fail('validation', 'Напишіть причину.', [{ field: 'reason', message: 'Напишіть коротко, чому дія не потрібна.' }]);
      if (reason.length > 300) return C.fail('validation', 'Причина задовга.', [{ field: 'reason', message: 'Коротше, будь ласка: до 300 знаків.' }]);
      if (p.id) {
        var a = findAction(cx, p.id);
        if (!a) return C.fail('not_found', 'Дію не знайдено. Оновіть сторінку.');
        if (a.status !== 'started' && a.status !== 'not_needed') return C.fail('conflict', 'Дію вже впроваджено — результат покаже розбір.');
        rec = clone(a);
        rec.notNeeded = { reason: reason, at: a.notNeeded ? a.notNeeded.at : cx.today, by: me.id };
      } else {
        var e = eligible(cx, p); if (e.err) return e.err;
        rec = { id: 'KD_' + e.dep.id + '_' + e.type.id + '_' + e.period, locationId: cx.loc.id, departmentId: e.dep.id, defectTypeId: e.type.id,
          period: e.period, causes: [], causeNote: '', plan: '', who: me.id, due: null, startedAt: cx.today, startedBy: me.id,
          implementedAt: null, notNeeded: { reason: reason, at: cx.today, by: me.id }, retryOf: e.retryOf };
      }
      save(env, rec);
      return after(env, cx.loc, rec.id);
    },

    srKdImplement: function (p, me, env) {
      var w = writable(p, me, env); if (w.err) return w.err;
      var cx = w.cx, a = findAction(cx, p.id);
      if (!a) return C.fail('not_found', 'Дію не знайдено. Оновіть сторінку.');
      if (a.status !== 'started' && a.status !== 'check') return C.fail('conflict', a.status === 'not_needed' ? 'Дію закрито як «не потрібно».' : 'Результат дії вже виміряно — дату змінити не можна.');
      var day = p.day || cx.today;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day)) || day < a.startedAt || day > cx.today)
        return C.fail('validation', 'Перевірте дату.', [{ field: 'day', message: 'Дата — від дня початку дії до сьогодні.' }]);
      var rec = clone(a); rec.implementedAt = day;
      save(env, rec);
      return after(env, cx.loc, rec.id);
    },

    srKdEditPlan: function (p, me, env) {
      var w = writable(p, me, env); if (w.err) return w.err;
      var cx = w.cx, a = findAction(cx, p.id);
      if (!a) return C.fail('not_found', 'Дію не знайдено. Оновіть сторінку.');
      if (a.status !== 'started' && a.status !== 'check') return C.fail('conflict', 'Завершену дію не змінюють — почніть нову, якщо брак повернеться.');
      var errs = planErrors(cx, me, p, p.due !== a.due);
      if (errs.length) return C.fail('validation', 'Перевірте поля — дещо не заповнено.', errs);
      var rec = clone(a);
      rec.causes = p.causes.slice(); rec.causeNote = String(p.causeNote || '').trim(); rec.plan = String(p.plan).trim(); rec.who = p.who; rec.due = p.due;
      save(env, rec);
      return after(env, cx.loc, rec.id);
    }
  });

  P.demoGenHooks.push(genHook);
  P.demoLoadHooks.push(loadHook);
  P.demoResetKeys.push(KEY);
})(typeof window !== 'undefined' ? window : globalThis);
