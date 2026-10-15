(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, S = P.demoSenior;
  var KD = S.KD, KEY = 'demo:sr:kd2:actions', OLD_KEY = 'demo:sr:kd:actions';
  var DEPT_BARS = 12, MINI_BARS = 7, MAX_BACK = 26, PERIOD_LIST = 16, ROUTE_BACK = 13;
  var GEN = { threshold: 5, wd: 5, early: 500, pareto: 70 };
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  var STATUS_LABELS = { 'new': 'понад норму, не почато', check: 'впроваджено · йде тиждень після впровадження', hold: 'під наглядом',
    helped: 'закрито: тримається', not_helped: 'рецидив', not_needed: 'дія не потрібна', none: 'дій не було' };
  var STATE_OF = { 'new': 'over', check: 'watch', hold: 'hold', helped: 'done', not_helped: 'relapse', not_needed: 'skip' };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function has(o, k) { return typeof k === 'string' && o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function mean(list) { return list.length ? list.reduce(function (s, v) { return s + v; }, 0) / list.length : 0; }
  function daysBetween(a, b) { return Math.round((S.parseDay(b) - S.parseDay(a)) / 86400000); }

  function liveRules() { return { threshold: KD.THRESHOLD, wd: KD.REVIEW_DAY, early: KD.EARLY_MIN, pareto: KD.PARETO }; }
  function rulesOut(R) {
    return { threshold: R.threshold, early: R.early, pareto: R.pareto, cycleDays: KD.CYCLE_DAYS, reviewWeekday: R.wd, reviewWeekdayName: S.WEEKDAYS[R.wd - 1] };
  }


  function makeCx(env, loc, R, stored) {
    R = R || liveRules();
    var today = env.day(), byDay = Object.create(null), first = null;
    env.audits().forEach(function (a) {
      if (a.locationId !== loc.id) return;
      (byDay[a.day] = byDay[a.day] || []).push(a);
      if (!first || a.day < first) first = a.day;
    });
    var cx = { env: env, loc: loc, R: R, T: R.threshold, today: today, byDay: byDay,
      deps: env.db.departments.filter(function (d) { return d.locationId === loc.id; }),
      start: function (n) { return S.periodStart(n, R.wd); }, end: function (n) { return S.periodEnd(n, R.wd); },
      of: function (day) { return S.periodOf(day, R.wd); } };
    cx.L = cx.of(today) - 1;
    cx.n0 = first ? Math.max(cx.of(first), cx.L - MAX_BACK) : cx.L;
    cx.stored = (stored || env.db.kdActions || []).filter(function (a) {
      return a && a.locationId === loc.id && has(env.ix.dep, a.departmentId) && DAY_RE.test(a.weekStart || '') && DAY_RE.test(a.weekEnd || '');
    });
    var dmemo = Object.create(null), rmemo = Object.create(null), kmemo = Object.create(null);
    cx.day = function (depId, day) {
      var k = depId + '|' + day;
      if (!dmemo[k]) {
        var list = byDay[day] || [], st = S.deptStats(env, list, depId);
        st.audits = list.filter(function (a) { return a.departmentId === depId; }).length;
        dmemo[k] = st;
      }
      return dmemo[k];
    };
    cx.range = function (depId, from, to) {
      var k = depId + '|' + from + '|' + to;
      if (rmemo[k]) return rmemo[k];
      var o = { checked: 0, rejected: 0, audits: 0, byType: {}, byLevel: { fix: 0, repair: 0, scrap: 0 } };
      for (var d = from, guard = 0; d <= to && guard < 400; d = S.addDays(d, 1), guard++) {
        if (!byDay[d]) continue;
        var x = cx.day(depId, d);
        o.checked += x.checked; o.rejected += x.rejected; o.audits += x.audits;
        Object.keys(x.byType).forEach(function (t) { o.byType[t] = (o.byType[t] || 0) + x.byType[t]; });
        o.byLevel.fix += x.byLevel.fix; o.byLevel.repair += x.byLevel.repair; o.byLevel.scrap += x.byLevel.scrap;
      }
      return (rmemo[k] = o);
    };
    cx.wk = function (depId, n) {
      var start = cx.start(n), end = cx.end(n), st = cx.range(depId, start, end), cur = n > cx.L;
      var rate = C.pct(st.rejected, st.checked);
      return { n: n, start: start, end: end, current: n === cx.L + 1, future: start > today, days: KD.CYCLE_DAYS,
        daysDone: cur ? Math.max(0, Math.min(KD.CYCLE_DAYS, daysBetween(start, today) + 1)) : KD.CYCLE_DAYS,
        audits: st.audits, checked: st.checked, rejected: st.rejected, rate: rate,
        levels: { fix: st.byLevel.fix, repair: st.byLevel.repair, scrap: st.byLevel.scrap }, over: rate != null && rate > R.threshold };
    };
    cx.trig = function (depId, n, noEarly) {
      var start = cx.start(n), end = cx.end(n);
      if (!noEarly) {
        var c = 0, r = 0;
        for (var d = start; d < end && d <= today; d = S.addDays(d, 1)) {
          if (!byDay[d]) continue;
          var x = cx.day(depId, d); c += x.checked; r += x.rejected;
          if (c >= R.early && C.pct(r, c) > R.threshold) return { openedAt: d, early: true };
        }
      }
      if (n <= cx.L) { var w = cx.range(depId, start, end); if (w.checked && C.pct(w.rejected, w.checked) > R.threshold) return { openedAt: cx.start(n + 1), early: false }; }
      return null;
    };
    cx.nextData = function (depId, n) {
      for (var k = n; k <= cx.L; k++) if (cx.range(depId, cx.start(k), cx.end(k)).checked > 0) return k;
      return null;
    };
    cx.kds = function (depId, decide) {
      if (!decide && kmemo[depId]) return kmemo[depId];
      var at = Object.create(null), list = [], cover = null, from = cx.n0;
      cx.stored.forEach(function (a) { if (a.departmentId !== depId) return; var n = cx.of(a.weekStart); at[n] = a; if (n < from) from = n; });
      for (var n = Math.max(from, cx.L - 60); n <= cx.L + 1; n++) {
        var rec = at[n] || null;
        if (!rec && !(cover && covers(cover, n))) {
          var tg = cx.trig(depId, n, !!cover && cover.relapseN === n);
          if (tg) {
            var v = { id: null, status: 'new', locationId: loc.id, departmentId: depId, n: n, weekStart: cx.start(n), weekEnd: cx.end(n),
              openedAt: tg.openedAt, early: tg.early, overWeeks: 1 };
            rec = decide ? decide(v, cx) : null;
            if (!rec) { list.push(v); cover = v; continue; }
          }
        }
        if (rec) {
          if (cover && !cover.id && cover.status === 'new') list.splice(list.indexOf(cover), 1);
          cover = evalAction(cx, rec); list.push(cover);
          continue;
        }
        if (cover && cover.status === 'new' && n > cover.n && n <= cx.L && cx.wk(depId, n).over) cover.overWeeks++;
      }
      if (!decide) kmemo[depId] = list;
      return list;
    };
    cx.all = function () { return cx.deps.reduce(function (out, d) { return out.concat(cx.kds(d.id)); }, []); };
    return cx;
  }

  function covers(a, n) {
    if (n <= a.n) return true;
    if (a.status === 'not_needed') return false;
    if (a.status === 'helped') return n <= a.r2n;
    if (a.status === 'not_helped') return n < a.relapseN;
    return true;   // відкрита без рішення · тиждень результату · під наглядом — тривають
  }

  function evalAction(cx, rec) {
    var o = clone(rec), dep = rec.departmentId, T = cx.T;
    o.n = cx.of(rec.weekStart); o.overWeeks = 0;
    if (rec.notNeeded) { o.status = 'not_needed'; o.finishedOn = rec.notNeeded.at; return o; }
    if (!rec.implementedAt || !DAY_RE.test(rec.implementedAt)) { o.status = 'new'; return o; }
    var k = cx.of(rec.implementedAt);
    if (cx.start(k) < rec.implementedAt) k++;   // тиждень результату — перший, що почався в день впровадження чи пізніше
    k = Math.max(k, o.n + 1);                    // …і не раніше за тиждень після тижня КД (інакше «до» й «після» — той самий тиждень)
    var a1 = cx.nextData(dep, k);
    if (a1 == null) { o.status = 'check'; o.r1n = Math.max(k, cx.L + 1); return o; }
    o.r1n = a1;
    if (cx.wk(dep, a1).rate > T) { o.status = 'not_helped'; o.relapseStage = 1; o.relapseN = a1; o.finishedOn = cx.start(a1 + 1); return o; }
    o.holdSince = cx.start(a1 + 1);
    var a2 = cx.nextData(dep, a1 + 1);
    if (a2 == null) { o.status = 'hold'; o.r2n = Math.max(a1 + 1, cx.L + 1); return o; }
    o.r2n = a2; o.finishedOn = cx.start(a2 + 1);
    if (cx.wk(dep, a2).rate > T) { o.status = 'not_helped'; o.relapseStage = 2; o.relapseN = a2; } else o.status = 'helped';
    return o;
  }

  function pareto(env, byType, rejected, pct) {
    var ids = Object.keys(byType).filter(function (t) { return has(env.ix.def, t) && byType[t] > 0; }).sort(function (a, b) {
      return byType[b] - byType[a] || (env.ix.def[a].name < env.ix.def[b].name ? -1 : 1);
    });
    var out = [], cum = 0;
    for (var i = 0; i < ids.length && cum * 100 < pct * rejected; i++) { out.push(ids[i]); cum += byType[ids[i]]; }
    return out;
  }
  function itemIds(cx, a) {
    if (Array.isArray(a.items) && a.items.length) return a.items.filter(function (t) { return has(cx.env.ix.def, t); });
    var w = cx.range(a.departmentId, a.weekStart, a.weekEnd);
    return pareto(cx.env, w.byType, w.rejected, cx.R.pareto);
  }


  function pubWeek(cx, depId, n) { var w = cx.wk(depId, n); w.pending = n > cx.L; return w; }

  function view(cx, a) {
    var ix = cx.env.ix, dep = ix.dep[a.departmentId], bw = cx.range(a.departmentId, a.weekStart, a.weekEnd), u = a.who && has(ix.user, a.who) ? ix.user[a.who] : null;
    var w1 = a.r1n != null ? pubWeek(cx, a.departmentId, a.r1n) : null, w2 = a.r2n != null ? pubWeek(cx, a.departmentId, a.r2n) : null;
    var t1 = w1 ? cx.range(a.departmentId, w1.start, w1.end).byType : {}, t2 = w2 ? cx.range(a.departmentId, w2.start, w2.end).byType : {};
    var cum = 0, ids = itemIds(cx, a);
    var items = ids.map(function (t) {
      var pcs = bw.byType[t] || 0, def = ix.def[t];
      cum += pcs;
      var it = { defectTypeId: t, name: def.name, level: def.level || 'fix', pieces: pcs, share: C.pct(pcs, bw.rejected), cumShare: C.pct(cum, bw.rejected),
        before: C.pct(pcs, bw.checked), after: null, afterPieces: null, after2: null, after2Pieces: null, delta: null };
      if (w1 && w1.checked) { it.afterPieces = t1[t] || 0; it.after = C.pct(it.afterPieces, w1.checked); }
      if (w2 && w2.checked) { it.after2Pieces = t2[t] || 0; it.after2 = C.pct(it.after2Pieces, w2.checked); }
      if (w1 && !w1.pending && it.after != null && it.before != null) it.delta = r1(it.after - it.before);
      return it;
    });
    var rate = C.pct(bw.rejected, bw.checked);
    return { id: a.id || null, key: a.departmentId + '|' + a.weekStart, status: a.status, statusLabel: STATUS_LABELS[a.status], state: STATE_OF[a.status],
      locationId: cx.loc.id, departmentId: a.departmentId, departmentName: dep ? dep.name : '', period: a.n, periodStart: a.weekStart, periodEnd: a.weekEnd,
      current: a.weekEnd >= cx.today, openedAt: a.openedAt, early: !!a.early, overWeeks: a.overWeeks || 0,
      weekRate: rate, weekDone: a.weekEnd < cx.today, earlyBelow: !!a.early && a.weekEnd < cx.today && rate != null && rate <= cx.T,
      audits: bw.audits, checked: bw.checked, rejected: bw.rejected, rate: rate, over: rate != null && rate > cx.T,
      levels: { fix: bw.byLevel.fix, repair: bw.byLevel.repair, scrap: bw.byLevel.scrap },
      items: items, itemsShare: C.pct(cum, bw.rejected), pareto: cx.R.pareto,
      name: items.length ? items.map(function (x) { return x.name; }).join(' · ') : 'брак відділу', defectTypeId: items.length ? items[0].defectTypeId : null,
      causes: a.causes || [], causeNote: a.causeNote || '', plan: a.plan || '', who: a.who || null, whoName: u ? u.name : null,
      implementedAt: a.implementedAt || null, recordedAt: a.recordedAt || null, notNeededReason: a.notNeeded ? a.notNeeded.reason : null,
      notNeededAt: a.notNeeded ? a.notNeeded.at : null, finishedOn: a.finishedOn || null, holdSince: a.holdSince || null,
      daysToImplement: a.implementedAt && a.openedAt ? daysBetween(a.openedAt, a.implementedAt) : null,
      result: w1, hold: w2, after: w1 && !w1.pending ? w1.rate : null, after2: w2 && !w2.pending ? w2.rate : null,
      relapseStage: a.relapseStage || null, relapsePeriod: a.relapseN != null ? a.relapseN : null };
  }
  function openAt(cx, depId, n) { return cx.kds(depId).filter(function (a) { return !a.id && a.status === 'new' && a.n === n; })[0] || null; }
  function coverAt(cx, depId, n) {
    var list = cx.kds(depId).filter(function (a) { return a.n <= n && covers(a, n); });
    return list[list.length - 1] || null;
  }

  function series(cx, depId, from, to) {
    var by = Object.create(null), out = [];
    cx.kds(depId).forEach(function (a) { by[a.n] = a; });
    for (var n = Math.max(from, to - MAX_BACK - DEPT_BARS); n <= to; n++) {
      var w = cx.wk(depId, n), a = by[n];
      w.kdState = a ? STATE_OF[a.status] : null; w.kdEarly = a ? !!a.early : false; w.relapse = cx.kds(depId).filter(function (x) { return x.relapseN === n; }).length;
      out.push(w);
    }
    return out;
  }
  function typeSeries(cx, depId, typeId, from, to) {
    var inKd = Object.create(null), out = [];
    cx.kds(depId).forEach(function (a) { if (itemIds(cx, a).indexOf(typeId) >= 0) inKd[a.n] = STATE_OF[a.status]; });
    for (var n = Math.max(from, to - MAX_BACK - DEPT_BARS); n <= to; n++) {
      var w = cx.wk(depId, n), st = cx.range(depId, w.start, w.end), pcs = has(st.byType, typeId) ? st.byType[typeId] : 0;
      out.push({ n: n, start: w.start, end: w.end, current: w.current, daysDone: w.daysDone, days: w.days, checked: w.checked, rejected: w.rejected,
        pieces: pcs, rate: C.pct(pcs, w.checked), share: C.pct(pcs, w.rejected), kdState: has(inKd, String(n)) ? inKd[n] : null });
    }
    return out;
  }
  function chartWindow(cx, n) {
    var from = cx.L - DEPT_BARS + 1;
    return n < from ? { from: n - 2, to: Math.min(cx.L + 1, n + DEPT_BARS - 3) } : { from: from, to: cx.L + 1 };
  }
  function periodArg(cx, v) {
    if (v == null || v === '') return cx.L;
    var n = typeof v === 'number' ? v : /^\d{1,6}$/.test(String(v)) ? Number(v) : NaN;
    return n === Math.floor(n) && n >= Math.max(0, cx.L - MAX_BACK) && n <= cx.L + 1 ? n : null;
  }
  function depOf(cx, id) { var d = has(cx.env.ix.dep, id) ? cx.env.ix.dep[id] : null; return d && d.locationId === cx.loc.id ? d : null; }
  function typeOf(cx, id) { return has(cx.env.ix.def, id) ? cx.env.ix.def[id] : null; }

  function routeOf(cx, depId, typeId, from) {
    var kds = cx.kds(depId).filter(function (a) { return itemIds(cx, a).indexOf(typeId) >= 0; }), ev = [], busy = Object.create(null);
    var lead = Math.max(cx.n0, from - 4);
    kds.forEach(function (a) {
      var add = function (day, pr, kind, n) { if (day) { ev.push({ day: day, pr: pr, kind: kind, n: n, a: a }); busy[day] = 1; } };
      add(a.openedAt, 2, 'over', a.n);
      if (a.implementedAt) add(a.implementedAt, 3, 'watch', a.n);
      if (a.notNeeded) add(a.notNeeded.at, 4, 'skip', a.n);
      if (a.r1n != null && a.r1n <= cx.L) add(cx.start(a.r1n + 1), 0, a.relapseStage === 1 ? 'relapse' : 'hold', a.r1n);
      if (a.r2n != null && a.r2n <= cx.L) add(cx.start(a.r2n + 1), 0, a.status === 'helped' ? 'done' : 'relapse', a.r2n);
    });
    var alive = function (day) { return kds.some(function (a) { return a.openedAt < day && !(a.finishedOn && a.finishedOn <= day); }); };
    for (var n = lead; n <= cx.L; n++) { var d = cx.start(n + 1); if (!busy[d] && !alive(d)) ev.push({ day: d, pr: 1, kind: 'ok', n: n }); }
    ev = ev.filter(function (e) { return e.day <= cx.today; }).sort(function (x, y) { return x.day < y.day ? -1 : x.day > y.day ? 1 : x.pr - y.pr; });
    var steps = [];
    ev.forEach(function (e) {
      var last = steps[steps.length - 1];
      if (last && last.state === e.kind) return;
      var w = cx.wk(depId, e.n), st = cx.range(depId, w.start, w.end), pcs = has(st.byType, typeId) ? st.byType[typeId] : 0;
      steps.push({ state: e.kind, day: e.day, n: e.n, start: w.start, end: w.end, rate: C.pct(pcs, w.checked), pieces: pcs, checked: w.checked, kdId: e.a ? e.a.id || null : null });
    });
    var startDay = cx.start(from + 1), firstI = 0;
    for (var i = 0; i < steps.length; i++) if (steps[i].day <= startDay) firstI = i;
    steps = steps.slice(firstI);
    if (steps.length && steps[0].day < startDay) { steps[0].asOf = true; steps[0].day = startDay; }   // стан діяв ще до початку маршруту
    return steps;
  }
  function routeFrom(cx, depId, typeId) {
    var from = cx.L - ROUTE_BACK + 1;
    cx.kds(depId).forEach(function (a) { if (a.n - 1 < from && itemIds(cx, a).indexOf(typeId) >= 0) from = a.n - 1; });
    return Math.max(cx.n0, cx.L - MAX_BACK, from);
  }
  function typeState(cx, depId, typeId) {
    var mine = cx.kds(depId).filter(function (a) { return itemIds(cx, a).indexOf(typeId) >= 0; });
    var cur = mine.filter(function (a) { return a.status === 'new' || a.status === 'check' || a.status === 'hold'; }).pop() || mine[mine.length - 1] || null;
    if (!cur) return { status: 'none', state: 'ok', label: STATUS_LABELS.none, id: null, key: null, period: null, start: null, end: null, count: 0 };
    return { status: cur.status, state: STATE_OF[cur.status], label: STATUS_LABELS[cur.status], id: cur.id || null, key: cur.departmentId + '|' + cur.weekStart,
      period: cur.n, start: cur.weekStart, end: cur.weekEnd, count: mine.length };
  }

  function details(cx, depId, typeId, from, to) {
    var ix = cx.env.ix, locId = cx.loc.id, W = Object.create(null), A = Object.create(null), prods = Object.create(null),
      orders = Object.create(null), byDay = Object.create(null), mine = Object.create(null), withType = 0, total = 0, audits = 0;
    for (var day = from, g = 0; day <= to && g < 400; day = S.addDays(day, 1), g++) (cx.byDay[day] || []).forEach(function (a) {
      var q = 0, touches = a.departmentId === depId, helpers = Array.isArray(a.helpers) ? a.helpers : [];
      a.defects.forEach(function (d) {
        if (S.sourceDept(a, d) !== depId) return;
        touches = true;
        if (typeId && d.defectTypeId !== typeId) return;
        var pcs = S.pieces(d), ord = d.orderNo || '';
        q += pcs;
        prods[d.productId] = (prods[d.productId] || 0) + pcs;
        orders[ord] = (orders[ord] || 0) + pcs;
        d.guilty.forEach(function (gg) {
          var w = W[gg.workerCode] = W[gg.workerCode] || { qty: 0, audits: {}, helperQty: 0 };
          w.qty += gg.qty || 0; w.audits[a.id] = 1;
          if (a.departmentId === depId && helpers.indexOf(gg.workerCode) >= 0) w.helperQty += gg.qty || 0;
        });
      });
      if (touches) mine[a.auditorId] = (mine[a.auditorId] || 0) + 1;
      if (a.departmentId === depId) {
        audits++;
        var x = byDay[a.day] = byDay[a.day] || { pieces: 0, checked: 0, audits: 0 };
        x.checked += C.checkedOf(a); x.audits++;
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
    var share = function (q) { return C.pct(q, total); }, days = [];
    for (var k = from, g2 = 0; k <= to && g2 < 400; k = S.addDays(k, 1), g2++) {
      var y = byDay[k] || { pieces: 0, checked: 0, audits: 0 };
      days.push({ day: k, pieces: y.pieces, checked: y.checked, audits: y.audits, future: k > cx.today });
    }
    return {
      workers: top(W, function (c, w) {
        var known = ix.worker[locId + ':' + c];
        return { code: c, name: c === '' ? 'Невідомий працівник' : known ? known.name : c, qty: w.qty, share: share(w.qty), audits: Object.keys(w.audits).length,
          helper: w.helperQty > 0, helperQty: w.helperQty };
      }),
      auditors: top(A, function (id, u) { return { id: id, name: has(ix.user, id) ? ix.user[id].name : id, qty: u.qty, share: share(u.qty), audits: u.audits, auditsAll: mine[id] || u.audits }; }),
      products: top(prods, function (id, q) { return { id: id, name: has(ix.prod, id) ? ix.prod[id].name : 'Невідомий виріб', qty: q, share: share(q) }; }),
      orders: top(orders, function (no, q) { return { no: no || null, name: no || 'Без замовлення', qty: q, share: share(q) }; }),
      days: days, auditsWith: withType, auditsTotal: audits };
  }

  function reviewOf(cx) {
    return { n: cx.L, start: cx.start(cx.L), end: cx.end(cx.L), reviewDay: cx.start(cx.L + 1), nextStart: cx.start(cx.L + 1), nextEnd: cx.end(cx.L + 1),
      readyOn: cx.start(cx.L + 2) };
  }
  function since(cx, days) { return S.addDays(cx.today, -(days - 1)); }
  function totals(cx) {
    var from = since(cx, 30), all = cx.all(), n = function (st, recent) { return all.filter(function (a) { return a.status === st && (!recent || a.finishedOn >= from); }).length; };
    return { 'new': n('new'), check: n('check'), hold: n('hold'), helped30: n('helped', true), notHelped30: n('not_helped', true), notNeeded30: n('not_needed', true) };
  }
  function stateCounts(list, from) {
    var c = { over: 0, watch: 0, hold: 0, done: 0, relapse: 0, skip: 0 };
    list.forEach(function (a) { var s = STATE_OF[a.status]; if (s === 'over' || s === 'watch' || s === 'hold' || !from || a.finishedOn >= from) c[s]++; });
    return c;
  }
  function people(cx, me) {
    var list = cx.env.db.users.filter(function (u) { return u.locationIds.indexOf(cx.loc.id) >= 0 && (u.role === 'senior_auditor' || u.role === 'location_lead') && !u.accessOff; });
    if (!list.some(function (u) { return u.id === me.id; }) && cx.env.ix.user[me.id]) list.unshift(cx.env.ix.user[me.id]);
    return list.map(function (u) { return { id: u.id, name: u.name, roleLabel: P.demoDict.roleLabels[u.role], me: u.id === me.id }; });
  }


  function genEnv(db, today) {
    var ix = { dep: {}, def: {}, user: {}, worker: {}, prod: {}, loc: {} };
    db.departments.forEach(function (d) { ix.dep[d.id] = d; });
    db.defectTypes.forEach(function (t) { ix.def[t.id] = t; });
    return { db: db, ix: ix, day: function () { return today; }, audits: function () { return db.audits; } };
  }
  function gStat(g, depId, from, to) { return S.deptStats(g.env, g.db.audits.filter(function (a) { return a.day >= from && a.day <= to; }), depId); }
  function gAudits(g, depId, from, to) { return g.db.audits.filter(function (a) { return a.departmentId === depId && a.day >= from && a.day <= to; }); }
  function addPieces(list, rnd, typeId, k, culprit) {
    for (var guard = 0; k > 0 && guard < 600; guard++) {
      var slots = [];
      list.forEach(function (a) { a.items.forEach(function (it) { if (it.qty > it.rejected) slots.push([a, it]); }); });
      if (!slots.length) return;
      var s = rnd.pick(slots), a = s[0], it = s[1];
      var q = Math.min(k, it.qty - it.rejected, rnd.int(1, 3));
      var w = culprit && a.checkedWorkers.indexOf(culprit) >= 0 && rnd.chance(0.7) ? culprit : rnd.pick(a.checkedWorkers);
      var row = a.defects.filter(function (d) { return d.productId === it.productId && d.orderNo === it.orderNo && d.defectTypeId === typeId && !d.departmentId; })[0];
      if (!row) { row = { productId: it.productId, orderNo: it.orderNo, defectTypeId: typeId, photo: null, guilty: [] }; a.defects.push(row); }
      var gg = row.guilty.filter(function (x) { return x.workerCode === w; })[0];
      if (gg) gg.qty += q; else row.guilty.push({ workerCode: w, qty: q });
      it.rejected += q; a.noDefects = false; k -= q;
    }
  }
  function push(g, dep, from, to, target, aFrom, aTo) {
    for (var round = 0; round < 6; round++) {
      var st = gStat(g, dep.id, from, to), want = Math.ceil(target / 100 * st.checked) - st.rejected;
      if (!st.checked || want <= 0) return;
      var list = gAudits(g, dep.id, aFrom || from, aTo || to);
      if (!list.length) list = gAudits(g, dep.id, from, to);
      var strict = list.filter(function (a) { return !g.lenient[a.auditorId]; });
      if (strict.length) list = strict;
      var room = 0;
      list.forEach(function (a) { a.items.forEach(function (it) { room += it.qty - it.rejected; }); });
      if (room < want * 2) list[list.length - 1].items[0].qty += want * 2 - room;
      var first = Math.ceil(want * 0.6);
      addPieces(list, g.rnd, g.types[0].id, first, g.culprit);
      addPieces(list, g.rnd, (g.types[1] || g.types[0]).id, want - first, g.culprit);
    }
  }
  function cap(g, dep, from, to, max) {
    for (var d = from; d <= to; d = S.addDays(d, 1)) {
      var st = gStat(g, dep.id, d, d), list = gAudits(g, dep.id, d, d);
      if (!st.rejected || !list.length || C.pct(st.rejected, st.checked) <= max) continue;
      var need = Math.ceil(st.rejected * 100 / max) - st.checked, items = [];
      list.forEach(function (a) { a.items.forEach(function (it) { items.push(it); }); });
      items.forEach(function (it, i) { it.qty += Math.floor(need / items.length) + (i < need % items.length ? 1 : 0); });
    }
  }
  var GEN_PLAN = { skill: 'Провели інструктаж біля робочого місця, показали правильний прийом.', discipline: 'Нагадали про перевірку виробу перед здачею; тімлід перевіряє першу партію зміни.',
    tool: 'Замінили голки й налаштували натяг нитки на двох машинах.', material: 'Замінили партію ниток на іншого постачальника.', organization: 'Переставили стіл контролю ближче до лінії.' };
  var GEN_SKIP = ['Разовий збій машини — полагодили того ж дня.', 'Партія з браком від постачальника — повернули.'];

  var BUNDLES = [['done', 'open'], ['skip', 'hold'], ['relapse1'], ['early'], ['relapse2']];
  var FIRST = { done: -4, open: 0, skip: -2, hold: -1, relapse1: -3, early: 1, relapse2: -5 };
  function shape(g, dep, kind) {
    var L = g.L, s = function (o) { return S.periodStart(L + o, GEN.wd); }, e = function (o) { return S.periodEnd(L + o, GEN.wd); };
    var j = function (a, b) { return Math.round(g.rnd.between(a, b) * 10) / 10; }, dec = g.dec, id = dep.id;
    var impl = function (o, plus, causes) { return function (v) { return seedRec(g, v, { implementedAt: S.addDays(s(o), plus), causes: causes }); }; };
    switch (kind) {
      case 'open':
        cap(g, dep, s(0), S.addDays(e(0), -1), 4); push(g, dep, s(0), e(0), j(6.2, 6.8), e(0), e(0));
        dec[id + '|' + L] = function () { return null; }; break;
      case 'done':
        push(g, dep, s(-4), e(-4), j(6.3, 6.9)); cap(g, dep, s(-3), e(-1), 4.2);
        dec[id + '|' + (L - 4)] = impl(-3, 0, ['tool']); break;
      case 'skip':
        push(g, dep, s(-2), e(-2), j(5.6, 6.0));
        dec[id + '|' + (L - 2)] = function (v) { return seedRec(g, v, { notNeeded: GEN_SKIP[0] }); }; break;
      case 'hold':
        push(g, dep, s(-1), e(-1), j(6.3, 6.9)); cap(g, dep, s(0), e(0), 4.3);
        dec[id + '|' + (L - 1)] = impl(0, 0, ['skill', 'organization']); break;
      case 'relapse1':
        push(g, dep, s(-3), e(-3), j(6.2, 6.8)); push(g, dep, s(-1), e(-1), j(5.7, 6.2));
        dec[id + '|' + (L - 3)] = impl(-2, 1, ['discipline']);
        dec[id + '|' + (L - 1)] = impl(0, 1, ['material']); break;
      case 'relapse2':
        push(g, dep, s(-5), e(-5), j(6.3, 6.8)); cap(g, dep, s(-4), e(-4), 4); push(g, dep, s(-3), e(-3), j(5.7, 6.1));
        dec[id + '|' + (L - 5)] = impl(-4, 0, ['tool']); break;
      case 'early': {
        var to = [S.addDays(g.today, -1), S.addDays(e(1), -1)].sort()[0];
        if (to < s(1) || gStat(g, id, s(1), to).checked < GEN.early) break;
        push(g, dep, s(1), to, j(6.3, 6.9));
        dec[id + '|' + (L + 1)] = function () { return null; }; break;
      }
    }
  }
  function seedRec(g, v, o) {
    var w = g.cx.range(v.departmentId, v.weekStart, v.weekEnd), rec = { id: 'KD_' + v.departmentId + '_' + v.weekStart, locationId: v.locationId,
      departmentId: v.departmentId, weekStart: v.weekStart, weekEnd: v.weekEnd, openedAt: v.openedAt, early: v.early,
      items: pareto(g.env, w.byType, w.rejected, GEN.pareto), causes: [], causeNote: '', plan: '', who: g.senior, implementedAt: null,
      recordedAt: null, recordedBy: g.senior, startedAt: null, notNeeded: null, seeded: true };
    if (o.notNeeded) { var at = [S.addDays(v.openedAt, 1), g.today].sort()[0]; rec.notNeeded = { reason: o.notNeeded, at: at, by: g.senior }; rec.recordedAt = rec.startedAt = at; }
    else {
      var day = [o.implementedAt, g.today].sort()[0];
      rec.implementedAt = day < v.openedAt ? v.openedAt : day; rec.recordedAt = rec.startedAt = rec.implementedAt;
      rec.causes = o.causes; rec.plan = GEN_PLAN[o.causes[0]];
    }
    g.db.kdSeed.push(rec);
    return rec;
  }
  function genHook(db, ctx) {
    var today = ctx.today, rnd = P.demoDates.makeRnd((ctx.seed || 0) + 4501), env = genEnv(db, today);
    var L = S.lastFullPeriod(today, GEN.wd);
    db.kdSeed = [];
    db.locations.forEach(function (loc) {
      var deps = db.departments.filter(function (d) { return d.locationId === loc.id && d.active !== false; });
      var g = { db: db, env: env, rnd: rnd, L: L, today: today, dec: {}, senior: 'u_sen_' + loc.id.slice(4).toLowerCase(), lenient: {} };
      db.users.forEach(function (u) { if (u.lenient) g.lenient[u.id] = 1; });
      var usual = function (d) { var st = gStat(g, d.id, S.periodStart(L - 8, GEN.wd), S.periodEnd(L, GEN.wd)); return C.pct(st.rejected, st.checked) || 0; };
      deps.map(function (d) { return { d: d, u: usual(d) }; }).sort(function (a, b) { return a.u - b.u || (a.d.id < b.d.id ? -1 : 1); }).forEach(function (x, i) {
        var bundle = BUNDLES[i];
        if (!bundle) return;
        var dep = x.d, types = db.defectTypes.filter(function (t) { return t.deptTypeId === dep.deptTypeId && t.active !== false; });
        var ws = db.workers.filter(function (w) { return w.departmentId === dep.id; });
        if (types.length < 2 || !ws.length) return;
        g.types = rnd.sample(types, 2); g.culprit = rnd.pick(ws).code;
        var first = Math.min.apply(null, bundle.map(function (k) { return FIRST[k]; }));
        cap(g, dep, S.periodStart(L + first - 3, GEN.wd), S.addDays(S.periodStart(L + first, GEN.wd), -1), 4.5);   // тихі 3 тижні перед сценарієм — сценарій не накладається на старі КД
        bundle.forEach(function (k) { shape(g, dep, k); });
      });
      g.cx = makeCx(env, loc, GEN, []);
      deps.forEach(function (d) {
        g.cx.kds(d.id, function (v) {
          var k = d.id + '|' + v.n;
          if (has(g.dec, k)) return g.dec[k](v);
          if (v.n > L - 1) return null;   // свіжі перевищення лишаються без рішення
          if (rnd.chance(0.15)) return seedRec(g, v, { notNeeded: rnd.pick(GEN_SKIP) });
          var cs = rnd.sample(Object.keys(GEN_PLAN), rnd.int(1, 2));
          return seedRec(g, v, { implementedAt: S.addDays(v.openedAt, rnd.int(0, 2)), causes: cs });
        });
      });
    });
  }

  function loadHook(db, ctx) {
    var saved = ctx.storage.get(KEY, {}) || {};
    if (typeof saved !== 'object' || Array.isArray(saved)) saved = {};
    db.kdActions = (db.kdSeed || []).filter(function (a) { return !has(saved, a.id); }).map(clone)
      .concat(Object.keys(saved).map(function (id) { return saved[id]; }).filter(function (a) { return a && typeof a === 'object'; }));
  }


  function periodSum(cx, list, from, to) {
    var inR = function (d) { return !!d && d >= from && d <= to; };
    var opened = list.filter(function (a) { return inR(a.openedAt); }), impl = list.filter(function (a) { return inR(a.implementedAt); });
    var d = impl.map(function (a) { return daysBetween(a.openedAt, a.implementedAt); });
    var res = { belowAfter1: 0, notBelowAfter1: 0, pending: 0 }, held = { done: 0, relapse: 0, pending: 0 }, before = [], after = [], cause = Object.create(null);
    impl.forEach(function (a) {
      if (a.status === 'check') res.pending++;
      else if (a.relapseStage === 1) res.notBelowAfter1++;
      else { res.belowAfter1++; held[a.status === 'helped' ? 'done' : a.status === 'hold' ? 'pending' : 'relapse']++; }
      if (a.status !== 'check') view(cx, a).items.forEach(function (it) { if (it.before != null && it.after != null) { before.push(it.before); after.push(it.after); } });
      (a.causes || []).forEach(function (c) { if (has(CAUSE_IX, c)) cause[c] = (cause[c] || 0) + 1; });
    });
    return { opened: opened.length, earlyOpened: opened.filter(function (a) { return a.early; }).length, implemented: impl.length,
      implementedDaysAvg: d.length ? r1(mean(d)) : null, notImplemented: opened.filter(function (a) { return a.status === 'new'; }).length,
      notNeeded: opened.filter(function (a) { return a.status === 'not_needed'; }).length, results: res, held: held,
      effect: { items: before.length, avgBefore: before.length ? r1(mean(before)) : null, avgAfter: after.length ? r1(mean(after)) : null,
        avgDeltaPp: before.length ? r1(mean(after) - mean(before)) : null },
      causes: CAUSES.filter(function (c) { return cause[c.id]; }).map(function (c) { return { id: c.id, label: c.label, n: cause[c.id] }; }) };
  }
  function rangeOf(p, env) {
    var today = env.day(), to = DAY_RE.test(p.to || '') && p.to <= today ? p.to : today;
    var from = DAY_RE.test(p.from || '') && p.from <= to ? p.from : S.addDays(to, -29);
    if (from < S.addDays(to, -365)) from = S.addDays(to, -365);
    return { from: from, to: to };
  }
  function locSummary(env, locId, from, to) {
    var loc = has(env.ix.loc, locId) ? env.ix.loc[locId] : null;
    if (!loc) return C.fail('not_found', 'Локацію не знайдено.');
    var rg = rangeOf({ from: from, to: to }, env), cx = makeCx(env, loc), all = cx.all(), ps = periodSum(cx, all, rg.from, rg.to), T = cx.T;
    var st = stateCounts(all.filter(function (a) { return !a.finishedOn || a.finishedOn <= rg.to; }), rg.from);
    st.done = all.filter(function (a) { return a.status === 'helped' && a.finishedOn >= rg.from && a.finishedOn <= rg.to; }).length;
    st.relapse = all.filter(function (a) { return a.status === 'not_helped' && a.finishedOn >= rg.from && a.finishedOn <= rg.to; }).length;
    st.skip = all.filter(function (a) { return a.status === 'not_needed' && a.finishedOn >= rg.from && a.finishedOn <= rg.to; }).length;
    var weeks = [];
    for (var n = cx.of(rg.from); n <= cx.of(rg.to); n++) {
      var c = 0, r = 0, s = cx.start(n), e = cx.end(n), inW = function (d) { return !!d && d >= s && d <= e; };
      cx.deps.forEach(function (d) { var w = cx.range(d.id, s, e); c += w.checked; r += w.rejected; });
      weeks.push({ n: n, start: s, end: e, current: n > cx.L, rate: C.pct(r, c), checked: c, rejected: r,
        opened: all.filter(function (a) { return inW(a.openedAt); }).length, implemented: all.filter(function (a) { return inW(a.implementedAt); }).length,
        belowAfter: all.filter(function (a) { return a.r1n === n && n <= cx.L && a.relapseStage !== 1; }).length,
        relapse: all.filter(function (a) { return a.relapseN === n; }).length });
    }
    var depts = cx.deps.map(function (d) {
      var mine = all.filter(function (a) { return a.departmentId === d.id; }), w = cx.wk(d.id, cx.L);
      return { id: d.id, name: d.name, weekRate: w.rate, weekChecked: w.checked, over: w.over, open: mine.filter(function (a) { return a.status === 'new'; }).length,
        watch: mine.filter(function (a) { return a.status === 'check'; }).length, hold: mine.filter(function (a) { return a.status === 'hold'; }).length,
        relapse: mine.filter(function (a) { return a.status === 'not_helped' && a.finishedOn >= rg.from && a.finishedOn <= rg.to; }).length };
    });
    var actions = all.filter(function (a) { return a.openedAt <= rg.to && !(a.finishedOn && a.finishedOn < rg.from); }).map(function (a) {
      var v = view(cx, a);
      return { id: v.id, key: v.key, departmentId: v.departmentId, departmentName: v.departmentName, weekStart: v.periodStart, weekEnd: v.periodEnd,
        openedAt: v.openedAt, early: v.early, earlyBelow: v.earlyBelow, weekRate: v.weekRate, weekDone: v.weekDone, implementedAt: v.implementedAt, daysToImplement: v.daysToImplement,
        cause: v.causes.length && has(CAUSE_IX, v.causes[0]) ? CAUSE_IX[v.causes[0]].label : null, done: v.plan || null, before: v.rate, after: v.after, after2: v.after2,
        state: v.state, items: v.items.map(function (it) { return { defectTypeId: it.defectTypeId, name: it.name, share: it.share, before: it.before, after: it.after }; }) };
    }).sort(function (a, b) { return a.openedAt < b.openedAt ? 1 : a.openedAt > b.openedAt ? -1 : 0; });
    return { ok: true, location: { id: loc.id, name: loc.name }, from: rg.from, to: rg.to, today: cx.today,
      cycle: { days: KD.CYCLE_DAYS, reviewWeekday: cx.R.wd, reviewWeekdayName: S.WEEKDAYS[cx.R.wd - 1] }, threshold: T, early: cx.R.early, pareto: cx.R.pareto,
      states: st, period: { opened: ps.opened, earlyOpened: ps.earlyOpened, implemented: ps.implemented, implementedDaysAvg: ps.implementedDaysAvg,
        notImplemented: ps.notImplemented, notNeeded: ps.notNeeded, results: ps.results, held: ps.held },
      effect: ps.effect, causes: ps.causes, depts: depts, weeks: weeks, actions: actions };
  }


  function writable(p, me, env) {
    if (!S.canManage(me)) return { err: C.forbidden() };
    var r = S.loc(p, me, env); if (r.err) return r;
    return { cx: makeCx(env, r.loc) };
  }
  function findAction(cx, id) { return typeof id === 'string' ? cx.all().filter(function (a) { return a.id === id; })[0] || null : null; }
  function openKd(cx, p) {
    var dep = depOf(cx, p.departmentId), n = periodArg(cx, p.period);
    if (!dep) return { err: C.fail('not_found', 'Відділ не знайдено. Оновіть сторінку.') };
    if (n == null) return { err: C.fail('not_found', 'Такого тижня немає. Оновіть сторінку.') };
    var kd = openAt(cx, dep.id, n);
    if (!kd) return { err: C.fail('conflict', 'Для цього тижня відділу коригуючої дії немає або рішення вже записано. Оновіть сторінку — побачите, як є зараз.') };
    return { kd: kd, dep: dep };
  }
  function planErrors(cx, me, p, kd, lockDay) {
    var errs = [], causes = Array.isArray(p.causes) ? p.causes : [];
    if (!causes.length) errs.push({ field: 'causes', message: 'Оберіть причину — хоча б одну.' });
    else if (causes.some(function (c) { return typeof c !== 'string' || !has(CAUSE_IX, c); }) || causes.length !== causes.filter(function (c, i) { return causes.indexOf(c) === i; }).length)
      errs.push({ field: 'causes', message: 'Оберіть причини зі списку, кожну один раз.' });
    if (causes.indexOf('other') >= 0 && String(p.causeNote || '').trim().length < 3) errs.push({ field: 'causeNote', message: 'Поясніть, що сталося, — ви обрали «Інше».' });
    else if (String(p.causeNote || '').trim().length > 300) errs.push({ field: 'causeNote', message: 'Коротше, будь ласка: до 300 знаків.' });
    var planText = String(p.plan || '').trim();
    if (planText.length < 3) errs.push({ field: 'plan', message: 'Напишіть, що зроблено, — хоча б кілька слів.' });
    else if (planText.length > 1000) errs.push({ field: 'plan', message: 'Коротше, будь ласка: до 1000 знаків.' });
    if (!people(cx, me).some(function (u) { return u.id === p.who; })) errs.push({ field: 'who', message: 'Оберіть, хто відповідає.' });
    var day = p.day;
    if (lockDay) { if (day != null && day !== '' && day !== kd.implementedAt) errs.push({ field: 'day', message: 'Перший тиждень після впровадження вже минув — дату впровадження змінити не можна.' }); }
    else if (!DAY_RE.test(String(day || ''))) errs.push({ field: 'day', message: 'Оберіть дату впровадження.' });
    else if (day < kd.openedAt || day > cx.today) errs.push({ field: 'day', message: 'Дата — від дня, коли відкрили коригуючу дію (' + kd.openedAt.split('-').reverse().join('.') + '), до сьогодні.' });
    return errs;
  }
  function save(env, rec) {
    var keep = ['id', 'locationId', 'departmentId', 'weekStart', 'weekEnd', 'openedAt', 'early', 'items', 'causes', 'causeNote', 'plan', 'who',
      'implementedAt', 'recordedAt', 'recordedBy', 'startedAt', 'notNeeded', 'seeded'], o = {};
    keep.forEach(function (k) { if (rec[k] !== undefined) o[k] = rec[k]; });
    var all = S.get(env, KEY, {}) || {};
    if (typeof all !== 'object' || Array.isArray(all)) all = {};
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
  function newRec(cx, kd, me) {
    return { id: 'KD_' + kd.departmentId + '_' + kd.weekStart, locationId: cx.loc.id, departmentId: kd.departmentId, weekStart: kd.weekStart, weekEnd: kd.weekEnd,
      openedAt: kd.openedAt, early: kd.early, items: itemIds(cx, kd), causes: [], causeNote: '', plan: '', who: null, implementedAt: null,
      recordedAt: cx.today, recordedBy: me.id, startedAt: cx.today, notNeeded: null };
  }

  function remapDefect(env, fromIds, toId) {
    var set = Object.create(null), all = S.get(env, KEY, {}) || {}, n = 0;
    if (typeof all !== 'object' || Array.isArray(all)) all = {};
    (fromIds || []).forEach(function (id) { if (typeof id === 'string' && id !== toId) set[id] = 1; });
    var hit = function (a) { return a && Array.isArray(a.items) && a.items.some(function (t) { return has(set, t); }); };
    (env.db.kdSeed || []).forEach(function (a) { if (hit(a) && !has(all, a.id)) all[a.id] = clone(a); });
    Object.keys(all).forEach(function (id) {
      var a = all[id];
      if (!hit(a)) return;
      var out = [];
      a.items.forEach(function (t) { var x = has(set, t) ? toId : t; if (out.indexOf(x) < 0) out.push(x); });
      a.items = out; n++;
    });
    if (n) { S.set(env, KEY, all); env.reload(); }
    return n;
  }
  P.demoKd = {
    remapDefect: remapDefect,
    locSummary: function (env, locId, from, to) { return locSummary(env, locId, from, to); },
    deptNow: function (env, locId, depId) {
      if (!has(env.ix.loc, locId)) return null;
      var cx = makeCx(env, env.ix.loc[locId]), now = coverAt(cx, depId, cx.L + 1);
      if (!now || !(now.status === 'new' || now.status === 'check' || now.status === 'hold')) return null;
      var v = view(cx, now); v.threshold = cx.T;
      return v;
    }
  };

  function canSummary(me, locId) {
    if (me.role === 'manager' || me.role === 'admin') return C.hasLoc(me, locId) || !!(me.can && me.can.viewAllLocations);
    return (me.role === 'senior_auditor' || me.role === 'location_lead') && C.hasLoc(me, locId);
  }
  var RANK = { 'new': 0, check: 1, hold: 2 };
  function byRank(a, b) {
    var ra = has(RANK, a.status) ? RANK[a.status] : 3, rb = has(RANK, b.status) ? RANK[b.status] : 3;
    return ra - rb || b.period - a.period || (a.departmentName < b.departmentName ? -1 : 1);
  }

  P.demoApis.push({
    srKdCauses: function () { return { ok: true, causes: clone(CAUSES) }; },

    srKdOverview: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), from = since(cx, 30), R = cx.R;
      var depts = cx.deps.map(function (d, order) {
        var kds = cx.kds(d.id), last = cx.wk(d.id, cx.L), cur = cx.wk(d.id, cx.L + 1), now = coverAt(cx, d.id, cx.L + 1);
        if (now && !(now.status === 'new' || now.status === 'check' || now.status === 'hold')) now = null;
        return { id: d.id, name: d.name, order: order, last: last, cur: cur, earlyLeft: Math.max(0, R.early - cur.checked),
          series: series(cx, d.id, cx.L - MINI_BARS + 1, cx.L), kd: now ? view(cx, now) : null,
          states: stateCounts(kds, from), total: kds.length };
      }).sort(function (a, b) { return (b.kd && b.kd.status === 'new') - (a.kd && a.kd.status === 'new') || !!b.kd - !!a.kd || a.order - b.order; });
      var sum = { depts: depts.length, audits: 0, checked: 0, rejected: 0, over: 0 };
      depts.forEach(function (d) { sum.audits += d.last.audits; sum.checked += d.last.checked; sum.rejected += d.last.rejected; if (d.last.over) sum.over++; });
      sum.rate = C.pct(sum.rejected, sum.checked);
      return { ok: true, review: reviewOf(cx), rules: rulesOut(R), totals: totals(cx), states: stateCounts(cx.all(), from), sum: sum, depts: depts,
        actionsTotal: cx.all().length, threshold: R.threshold, today: cx.today };
    },

    srKdDept: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), dep = depOf(cx, p.departmentId);
      if (!dep) return C.fail('not_found', 'Відділ не знайдено. Поверніться до всіх відділів.');
      var n = periodArg(cx, p.period);
      if (n == null) return C.fail('not_found', 'Такого тижня немає. Оберіть тиждень зі списку.');
      var per = cx.wk(dep.id, n), st = cx.range(dep.id, per.start, per.end), win = chartWindow(cx, n), kds = cx.kds(dep.id);
      var mine = kds.filter(function (a) { return a.n === n; })[0] || null, cov = coverAt(cx, dep.id, n);
      var par = pareto(env, st.byType, st.rejected, cx.R.pareto), ids = {};
      env.db.defectTypes.forEach(function (t) { if (t.deptTypeId === dep.deptTypeId) ids[t.id] = 1; });
      Object.keys(st.byType).forEach(function (t) { if (has(env.ix.def, t)) ids[t] = 1; });
      var types = Object.keys(ids).map(function (id) {
        var t = env.ix.def[id], pcs = st.byType[id] || 0, route = routeOf(cx, dep.id, id, routeFrom(cx, dep.id, id));
        return { defectTypeId: id, name: t.name, level: t.level || 'fix', active: t.active !== false, pieces: pcs, rate: C.pct(pcs, per.checked),
          share: C.pct(pcs, per.rejected), pareto: par.indexOf(id) >= 0, inKd: !!mine && itemIds(cx, mine).indexOf(id) >= 0,
          dyn: typeSeries(cx, dep.id, id, n - MINI_BARS + 1, n), state: typeState(cx, dep.id, id), route: route.slice(-4), routeLen: route.length };
      }).filter(function (x) { return x.active || x.state.status !== 'none' || x.dyn.some(function (y) { return y.pieces > 0; }); })
        .sort(function (a, b) { return b.pieces - a.pieces || (a.name < b.name ? -1 : 1); });
      var periods = [];
      for (var k = cx.L + 1; k > cx.L + 1 - PERIOD_LIST && k >= 0; k--) periods.push(cx.wk(dep.id, k));
      if (n < periods[periods.length - 1].n) periods.push(cx.wk(dep.id, n));
      periods = periods.map(function (x) { return { n: x.n, start: x.start, end: x.end, current: x.current, rate: x.rate, over: x.over }; });
      var uc = 0, ur = 0;
      for (var q = Math.max(0, n - 3); q <= n; q++) { var su = cx.wk(dep.id, q); uc += su.checked; ur += su.rejected; }
      var actions = kds.map(function (a) { return view(cx, a); }).sort(byRank);
      return { ok: true, review: reviewOf(cx), rules: rulesOut(cx.R), dept: { id: dep.id, name: dep.name }, threshold: cx.T, canWrite: S.canManage(me), today: cx.today,
        period: per, blur: S.blur(per.rate, C.pct(ur, uc), per.checked, null, cx.T), decide: n >= cx.L, minPeriod: Math.max(0, cx.L - MAX_BACK), maxPeriod: cx.L + 1,
        periods: periods, series: series(cx, dep.id, win.from, win.to), kd: mine ? view(cx, mine) : null,
        cover: cov && cov !== mine ? view(cx, cov) : null, pareto: par, types: types, actions: actions, states: stateCounts(kds) };
    },

    srKdType: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), dep = depOf(cx, p.departmentId), t = typeOf(cx, p.defectTypeId);
      if (!dep) return C.fail('not_found', 'Відділ не знайдено. Поверніться до всіх відділів.');
      var n = periodArg(cx, p.period);
      if (n == null) return C.fail('not_found', 'Такого тижня немає. Оберіть тиждень зі списку.');
      var per = cx.wk(dep.id, n), st = cx.range(dep.id, per.start, per.end);
      if (!t || (t.deptTypeId !== dep.deptTypeId && !has(st.byType, t.id))) return C.fail('not_found', 'Такого виду браку у відділі не знайдено. Оновіть сторінку.');
      var pcs = st.byType[t.id] || 0, prev = cx.wk(dep.id, n - 1), pst = cx.range(dep.id, prev.start, prev.end), ppcs = pst.byType[t.id] || 0;
      var d = details(cx, dep.id, t.id, per.start, per.end), win = chartWindow(cx, n), par = pareto(env, st.byType, st.rejected, cx.R.pareto);
      var withDefect = Object.keys(st.byType).filter(function (id) { return st.byType[id] > 0; });
      var history = cx.kds(dep.id).filter(function (a) { return itemIds(cx, a).indexOf(t.id) >= 0; }).map(function (a) { return view(cx, a); }).reverse();
      return { ok: true, dept: { id: dep.id, name: dep.name }, type: { id: t.id, name: t.name, level: t.level || 'fix', active: t.active !== false },
        threshold: cx.T, rules: rulesOut(cx.R), canWrite: S.canManage(me), today: cx.today, decide: n >= cx.L, period: per,
        pieces: pcs, checked: per.checked, rate: C.pct(pcs, per.checked), share: C.pct(pcs, per.rejected), pareto: par.indexOf(t.id) >= 0,
        prev: { n: prev.n, start: prev.start, end: prev.end, pieces: ppcs, checked: prev.checked, rate: C.pct(ppcs, prev.checked) },
        rank: pcs ? 1 + withDefect.filter(function (id) { return st.byType[id] > pcs; }).length : null, rankOf: withDefect.length,
        series: typeSeries(cx, dep.id, t.id, win.from, win.to),
        workers: d.workers, auditors: d.auditors, products: d.products, orders: d.orders, days: d.days, auditsWith: d.auditsWith, auditsTotal: d.auditsTotal,
        history: history, state: typeState(cx, dep.id, t.id), route: routeOf(cx, dep.id, t.id, routeFrom(cx, dep.id, t.id)) };
    },

    srKdItem: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), a;
      if (p.id) { a = findAction(cx, p.id); if (!a) return C.fail('not_found', 'Коригуючу дію не знайдено. Оновіть сторінку.'); }
      else { var o = openKd(cx, p); if (o.err) return o.err; a = o.kd; }
      var v = view(cx, a), d = details(cx, a.departmentId, null, a.weekStart, a.weekEnd);
      v.series = series(cx, a.departmentId, Math.min(cx.L - DEPT_BARS + 1, a.n - 2), cx.L + 1);
      v.workers = d.workers; v.auditors = d.auditors; v.products = d.products; v.auditsTotal = d.auditsTotal;
      v.items.forEach(function (it) { var x = details(cx, a.departmentId, it.defectTypeId, a.weekStart, a.weekEnd); it.workers = x.workers.slice(0, 5); it.products = x.products.slice(0, 3); it.auditsWith = x.auditsWith; });
      return { ok: true, item: v, review: reviewOf(cx), rules: rulesOut(cx.R), causes: clone(CAUSES), people: people(cx, me), today: cx.today,
        threshold: cx.T, canWrite: S.canManage(me) };
    },

    srKdList: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), dep = typeof p.departmentId === 'string' && p.departmentId ? p.departmentId : null;
      var all = cx.all().filter(function (a) { return !dep || a.departmentId === dep; }).map(function (a) { return view(cx, a); });
      var counts = { 'new': 0, check: 0, hold: 0, helped: 0, not_helped: 0, not_needed: 0, all: all.length };
      all.forEach(function (a) { counts[a.status]++; });
      var state = has(counts, p.state) ? p.state : 'all';
      return { ok: true, state: state, counts: counts, items: all.filter(function (a) { return state === 'all' || a.status === state; }).sort(byRank),
        review: reviewOf(cx), rules: rulesOut(cx.R), today: cx.today, threshold: cx.T,
        departments: cx.deps.map(function (d) { return { id: d.id, name: d.name }; }) };
    },

    srKdStats: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), days = Number(p.days) === 90 ? 90 : 30, from = since(cx, days), ids = p.departmentIds, set = null;
      if (!(ids == null || ids === '' || (Array.isArray(ids) && !ids.length))) {
        if (!Array.isArray(ids) || ids.length > 100 || ids.some(function (id) { return !depOf(cx, id); })) return C.fail('not_found', 'Такого відділу в локації немає. Оновіть сторінку.');
        set = Object.create(null); ids.forEach(function (id) { set[id] = 1; });
      }
      var deps = cx.deps.filter(function (d) { return !set || set[d.id]; }), all = [];
      deps.forEach(function (d) { all = all.concat(cx.kds(d.id)); });
      var weeks = [];
      for (var n = cx.of(from); n <= cx.L + 1; n++) weeks.push(n);
      var byWeek = weeks.map(function (x) {
        var o = { n: x, start: cx.start(x), end: cx.end(x), current: x > cx.L, checked: 0, rejected: 0, overDepts: 0 };
        deps.forEach(function (d) { var w = cx.wk(d.id, x); o.checked += w.checked; o.rejected += w.rejected; if (w.over && x <= cx.L) o.overDepts++; });
        o.rate = C.pct(o.rejected, o.checked);
        var mine = all.filter(function (a) { return a.n === x; });
        o.states = stateCounts(mine); o.opened = mine.length; o.early = mine.filter(function (a) { return a.early; }).length;
        o.relapse = all.filter(function (a) { return a.relapseN === x; }).length;
        o.items = mine.map(function (a) { var v = view(cx, a); return { id: v.id, key: v.key, departmentId: v.departmentId, departmentName: v.departmentName, rate: v.rate, state: v.state, early: v.early, earlyBelow: v.earlyBelow, name: v.name }; });
        o.earlyBelow = o.items.filter(function (i) { return i.earlyBelow; }).length;
        return o;
      });
      var ps = periodSum(cx, all, from, cx.today);
      ps.relapse = all.filter(function (a) { return a.status === 'not_helped' && a.finishedOn >= from; }).length;
      ps.weeks = weeks.length; ps.waiting = all.filter(function (a) { return a.status === 'new'; }).length;
      var stDepts = deps.map(function (d) {
        var kds = cx.kds(d.id), inWin = kds.filter(function (a) { return a.openedAt >= from || !a.finishedOn || a.finishedOn >= from; });
        var deltas = [];
        inWin.forEach(function (a) { if (a.status !== 'check' && a.status !== 'new' && a.status !== 'not_needed') view(cx, a).items.forEach(function (it) { if (it.delta != null) deltas.push({ d: it.delta, b: it.before }); }); });
        var tids = {};
        env.db.defectTypes.forEach(function (t) { if (t.deptTypeId === d.deptTypeId) tids[t.id] = 1; });
        kds.forEach(function (a) { itemIds(cx, a).forEach(function (t) { tids[t] = 1; }); });
        var lw = cx.wk(d.id, cx.L), lst = cx.range(d.id, lw.start, lw.end), rf = cx.of(from) - 1;
        var types = Object.keys(tids).filter(function (id) { return has(env.ix.def, id); }).map(function (id) {
          var t = env.ix.def[id], pcs = lst.byType[id] || 0, withIt = kds.filter(function (a) { return itemIds(cx, a).indexOf(id) >= 0; });
          var last = withIt[withIt.length - 1], lv = last ? view(cx, last) : null, li = lv ? lv.items.filter(function (it) { return it.defectTypeId === id; })[0] : null;
          return { defectTypeId: id, name: t.name, level: t.level || 'fix', active: t.active !== false, rate: C.pct(pcs, lw.checked), pieces: pcs, share: C.pct(pcs, lw.rejected),
            kds: withIt.filter(function (a) { return inWin.indexOf(a) >= 0; }).length,
            last: lv ? { id: lv.id, key: lv.key, period: lv.period, periodStart: lv.periodStart, periodEnd: lv.periodEnd, status: lv.status, state: lv.state,
              before: li.before, after: li.after, after2: li.after2, delta: li.delta, result: lv.result } : null,
            route: routeOf(cx, d.id, id, rf) };
        }).filter(function (x) { return x.active || x.last || x.pieces > 0; }).sort(function (a, b) { return (b.rate || 0) - (a.rate || 0) || (a.name < b.name ? -1 : 1); });
        return { id: d.id, name: d.name, weekRate: lw.rate, over: lw.over, states: stateCounts(inWin, from), total: inWin.length,
          effect: deltas.length ? { n: deltas.length, pp: r1(mean(deltas.map(function (x) { return x.d; }))),
            rel: Math.round(mean(deltas.filter(function (x) { return x.b; }).map(function (x) { return x.d / x.b * 100; }))) } : null, types: types };
      });
      return { ok: true, days: days, from: from, review: reviewOf(cx), rules: rulesOut(cx.R), today: cx.today, threshold: cx.T,
        departments: cx.deps.map(function (d) { return { id: d.id, name: d.name }; }), departmentIds: set ? Object.keys(set) : [],
        kpi: ps, byWeek: byWeek, depts: stDepts };
    },

    srKdWorker: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var w = typeof p.code === 'string' && has(env.ix.worker, r.loc.id + ':' + p.code) ? env.ix.worker[r.loc.id + ':' + p.code] : null;
      if (!w) return C.fail('not_found', 'Працівника не знайдено. Оновіть сторінку.');
      var rg = rangeOf(p, env), pieces = Object.create(null);
      S.audits(env, r.loc.id, rg.from, rg.to).forEach(function (a) {
        a.defects.forEach(function (d) { d.guilty.forEach(function (g) { if (g.workerCode === w.code && g.qty > 0) pieces[d.defectTypeId] = (pieces[d.defectTypeId] || 0) + g.qty; }); });
      });
      var cx = makeCx(env, r.loc), items = has(cx.env.ix.dep, w.departmentId) && depOf(cx, w.departmentId) ? cx.kds(w.departmentId).filter(function (a) {
        return a.openedAt <= rg.to && !(a.finishedOn && a.finishedOn < rg.from) && itemIds(cx, a).some(function (t) { return has(pieces, t); });
      }).map(function (a) {
        var v = view(cx, a), mineT = v.items.filter(function (it) { return has(pieces, it.defectTypeId); });
        v.defectTypeId = mineT[0].defectTypeId; v.workerTypes = mineT.map(function (it) { return it.name; });
        return v;
      }).sort(byRank) : [];
      var types = Object.keys(pieces).filter(function (id) { return has(env.ix.def, id); }).map(function (id) {
        return { id: id, name: env.ix.def[id].name, pieces: pieces[id], actions: items.filter(function (a) { return a.items.some(function (it) { return it.defectTypeId === id; }); }).length };
      }).sort(function (a, b) { return b.pieces - a.pieces || (a.name < b.name ? -1 : 1); });
      return { ok: true, from: rg.from, to: rg.to, today: cx.today, threshold: cx.T,
        worker: { name: w.name, departmentId: w.departmentId, departmentName: env.ix.dep[w.departmentId] ? env.ix.dep[w.departmentId].name : '' },
        types: types, items: items };
    },

    kdLocSummary: function (p, me, env) {
      var id = typeof p.locationId === 'string' ? p.locationId : '';
      if (!has(env.ix.loc, id)) return C.fail('not_found', 'Локацію не знайдено.');
      if (!canSummary(me, id)) return C.forbidden();
      return locSummary(env, id, p.from, p.to);
    },

    srKdImplement: function (p, me, env) {
      var w = writable(p, me, env); if (w.err) return w.err;
      var cx = w.cx, o = openKd(cx, p); if (o.err) return o.err;
      var errs = planErrors(cx, me, p, o.kd, false);
      if (errs.length) return C.fail('validation', 'Перевірте поля — дещо не заповнено.', errs);
      var rec = newRec(cx, o.kd, me);
      rec.causes = p.causes.slice(); rec.causeNote = String(p.causeNote || '').trim(); rec.plan = String(p.plan).trim(); rec.who = p.who; rec.implementedAt = p.day;
      save(env, rec);
      return after(env, cx.loc, rec.id);
    },

    srKdEditPlan: function (p, me, env) {
      var w = writable(p, me, env); if (w.err) return w.err;
      var cx = w.cx, a = findAction(cx, p.id);
      if (!a) return C.fail('not_found', 'Коригуючу дію не знайдено. Оновіть сторінку.');
      if (!a.implementedAt || a.status === 'not_needed') return C.fail('conflict', 'У цієї коригуючої дії немає плану: її позначено «дія не потрібна».');
      var lock = a.status !== 'check', errs = planErrors(cx, me, p, a, lock);
      if (errs.length) return C.fail('validation', 'Перевірте поля — дещо не заповнено.', errs);
      var rec = clone(a);
      rec.causes = p.causes.slice(); rec.causeNote = String(p.causeNote || '').trim(); rec.plan = String(p.plan).trim(); rec.who = p.who;
      if (!lock) rec.implementedAt = p.day;
      save(env, rec);
      return after(env, cx.loc, rec.id);
    },

    srKdNotNeeded: function (p, me, env) {
      var w = writable(p, me, env); if (w.err) return w.err;
      var cx = w.cx, reason = String(p.reason || '').trim(), rec;
      if (reason.length < 3) return C.fail('validation', 'Напишіть причину.', [{ field: 'reason', message: 'Напишіть коротко, чому дія не потрібна.' }]);
      if (reason.length > 300) return C.fail('validation', 'Причина задовга.', [{ field: 'reason', message: 'Коротше, будь ласка: до 300 знаків.' }]);
      if (p.id) {
        var a = findAction(cx, p.id);
        if (!a) return C.fail('not_found', 'Коригуючу дію не знайдено. Оновіть сторінку.');
        if (a.status !== 'not_needed') return C.fail('conflict', 'Для цієї коригуючої дії вже записано впроваджений план, тому позначити «дія не потрібна» не можна.');
        rec = clone(a); rec.notNeeded = { reason: reason, at: a.notNeeded.at, by: me.id };
      } else {
        var o = openKd(cx, p); if (o.err) return o.err;
        rec = newRec(cx, o.kd, me); rec.who = me.id; rec.notNeeded = { reason: reason, at: cx.today, by: me.id };
      }
      save(env, rec);
      return after(env, cx.loc, rec.id);
    }
  });

  P.demoGenHooks.push(genHook);
  P.demoLoadHooks.push(loadHook);
  P.demoResetKeys.push(KEY, OLD_KEY);
})(typeof window !== 'undefined' ? window : globalThis);
