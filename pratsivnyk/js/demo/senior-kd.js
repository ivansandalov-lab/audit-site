(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, S = P.demoSenior;
  if (!P.demoKdRules && typeof module !== 'undefined' && typeof require === 'function') require('./senior-kd-rules.js');
  var RU = P.demoKdRules;
  var KD = S.KD, KEY = 'demo:sr:kd3:actions', KD2_KEY = 'demo:sr:kd2:actions', OLD_KEY = 'demo:sr:kd:actions';
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
  var STATUS_LABELS = { pre: 'відкрито достроково · тиждень ще йде', decide: 'потрібне рішення · тиждень завершився в нормі',
    'new': 'понад норму, не почато', check: 'впроваджено · йде тиждень після впровадження', hold: 'під наглядом',
    helped: 'закрито: тримається', held_types: 'закрито: її види браку нижче, ніж до дії', not_helped: 'рецидив',
    not_needed: 'дія не потрібна', none: 'дій не було' };
  var STATE_OF = { pre: 'pre', decide: 'decide', 'new': 'over', check: 'watch', hold: 'hold', helped: 'done', held_types: 'part',
    not_helped: 'relapse', not_needed: 'skip' };
  var PHASE_OF = { pre: 'open', decide: 'open', 'new': 'open', check: 'observe', hold: 'observe', helped: 'final', held_types: 'final',
    not_helped: 'final', not_needed: 'final' };
  var ONGOING = { pre: 1, decide: 1, over: 1, watch: 1, hold: 1 };
  var NO_END = 1e9;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function has(o, k) { return typeof k === 'string' && o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function mean(list) { return list.length ? list.reduce(function (s, v) { return s + v; }, 0) / list.length : 0; }
  function daysBetween(a, b) { return Math.round((S.parseDay(b) - S.parseDay(a)) / 86400000); }

  function liveRules() { return { threshold: KD.THRESHOLD, wd: KD.REVIEW_DAY, early: KD.EARLY_MIN, pareto: KD.PARETO }; }
  function rulesOut(R) {
    return { threshold: R.threshold, early: R.early, pareto: R.pareto, cycleDays: KD.CYCLE_DAYS, reviewWeekday: R.wd, reviewWeekdayName: S.WEEKDAYS[R.wd - 1],
      earlyRates: RU.earlyRates(R.threshold, R.early), paretoOrder: RU.LEVEL_ORDER.slice() };
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
    cx.earlyDay = function (depId, n, list) {
      var start = cx.start(n), end = cx.end(n), c = 0, r = 0;
      for (var d = start; d < end && d <= today; d = S.addDays(d, 1)) {
        if (!byDay[d]) continue;
        var x = cx.day(depId, d); c += x.checked; r += x.rejected;
        if (RU.earlyOk(c, r, R.threshold, R.early) && !list.some(function (a) { return activeAt(a, d); })) return d;
      }
      return null;
    };
    cx.nextData = function (depId, n) {
      for (var k = n; k <= cx.L; k++) if (cx.range(depId, cx.start(k), cx.end(k)).checked > 0) return k;
      return null;
    };
    cx.kds = function (depId, decide) {
      if (!decide && kmemo[depId]) return kmemo[depId];
      var at = Object.create(null), list = [], from = cx.n0;
      cx.stored.forEach(function (a) { if (a.departmentId !== depId) return; var n = cx.of(a.weekStart); at[n] = a; if (n < from) from = n; });
      for (var n = Math.max(from, cx.L - 60); n <= cx.L + 1; n++) {
        var rec = at[n] || null, c, v = null;
        if (!rec) {
          var day = cx.earlyDay(depId, n, list);
          if (day) v = fresh(cx, depId, n, day, true, ctxEarly(list, day));
          else if (n <= cx.L && cx.wk(depId, n).over) { c = ctxAt(cx, list, n); if (!c.cover) v = fresh(cx, depId, n, cx.start(n + 1), false, c); }
          if (!v) continue;
          rec = decide ? decide(v, cx, list) : null;
          if (!rec) { list.push(evalAction(cx, v, list)); continue; }
          rec = Object.assign(clone(rec), { repeatOf: v.repeatOf, parallelWith: v.parallelWith });
        } else {
          c = ctxAt(cx, list, n);
          if (c.cover && !c.cover.id && PHASE_OF[c.cover.status] === 'open') list.splice(list.indexOf(c.cover), 1);
          if (rec.early && DAY_RE.test(rec.openedAt || '')) c = ctxEarly(list, rec.openedAt);
          rec = Object.assign(clone(rec), { repeatOf: c.repeatOf, parallelWith: c.parallelWith });
        }
        list.push(evalAction(cx, rec, list));
      }
      if (!decide) kmemo[depId] = list;
      return list;
    };
    cx.all = function () { return cx.deps.reduce(function (out, d) { return out.concat(cx.kds(d.id)); }, []); };
    cx.lmemo = Object.create(null);   // живі списки пунктів (live) за ключем КД
    return cx;
  }

  function fresh(cx, depId, n, day, early, c) {
    return { id: null, status: 'new', locationId: cx.loc.id, departmentId: depId, n: n, weekStart: cx.start(n), weekEnd: cx.end(n),
      key: depId + '|' + cx.start(n), openedAt: day, early: early, repeatOf: c.repeatOf, parallelWith: c.parallelWith };
  }
  function activeAt(a, d) { return a.openedAt <= d && !(a.finishedOn && a.finishedOn <= d); }
  function phaseAt(cx, a, m) {
    if (m < a.n) return null;
    if (m <= a.coverEnd) return 'cover';
    if (!a.implementedAt) return 'final';
    if (a.relapseN === m) return 'relapse';
    if (a.finishedOn && a.finishedOn <= cx.start(m + 1)) return 'final';
    return 'observe';
  }
  function ctxAt(cx, list, m) {
    var o = { cover: null, repeatOf: null, parallelWith: [] };
    list.forEach(function (a) {
      var ph = phaseAt(cx, a, m);
      if (ph === 'cover') o.cover = a; else if (ph === 'relapse') o.repeatOf = a.key; else if (ph === 'observe') o.parallelWith.push(a.key);
    });
    return o;
  }
  function ctxEarly(list, d) {
    return { cover: null, repeatOf: null, parallelWith: list.filter(function (a) { return activeAt(a, d); }).map(function (a) { return a.key; }) };
  }
  function countOver(cx, depId, from, to) {
    var n = 0;
    for (var m = from; m <= Math.min(to, cx.L); m++) if (cx.wk(depId, m).over) n++;
    return n;
  }
  function knownIds(cx, list) { return Array.isArray(list) ? list.filter(function (t) { return has(cx.env.ix.def, t); }) : null; }
  function sumOf(byType, ids) { return ids.reduce(function (s, t) { return s + (byType[t] || 0); }, 0); }

  function evalAction(cx, rec, list) {
    var o = clone(rec), dep = rec.departmentId, T = cx.T;
    o.n = cx.of(rec.weekStart); o.key = dep + '|' + rec.weekStart; o.overWeeks = 0; o.coverEnd = NO_END;
    o.repeatOf = rec.repeatOf || null; o.parallelWith = Array.isArray(rec.parallelWith) ? rec.parallelWith : [];
    var items = knownIds(cx, rec.items) || [], excl = knownIds(cx, rec.excludedTypes), fz;
    if (rec.notNeeded) {
      var at = DAY_RE.test(rec.notNeeded.at || '') ? rec.notNeeded.at : rec.openedAt;
      o.status = 'not_needed'; o.finishedOn = at;
      if (!items.length || !excl) { fz = freeze(cx, o, at < cx.today ? at : cx.today, list); if (!items.length) items = fz.ids; if (!excl) excl = fz.excl; }
      o.items = items; o.excludedTypes = excl;
      for (o.coverEnd = o.n; cx.start(o.coverEnd + 2) < at;) o.coverEnd++;   // тижні, розібрані до рішення «не потрібно»
      o.overWeeks = countOver(cx, dep, o.n, o.coverEnd);
      return o;
    }
    if (!rec.implementedAt || !DAY_RE.test(rec.implementedAt)) {
      var done = o.n <= cx.L, wr = done ? cx.wk(dep, o.n).rate : null;
      o.status = rec.early && !done ? 'pre' : rec.early && wr != null && wr <= T && !rec.keep ? 'decide' : 'new';
      o.items = null;   // живий список — live()
      o.overWeeks = countOver(cx, dep, o.n, cx.L);
      return o;
    }
    var k = cx.of(rec.implementedAt);
    if (cx.start(k) < rec.implementedAt) k++;   // тиждень 1 — перший, що почався в день впровадження чи пізніше
    k = Math.max(k, o.n + 1);                    // …і не раніше за тиждень після тижня КД (інакше «до» й «після» — той самий тиждень)
    o.coverEnd = k - 1;
    if (!items.length || !excl) { fz = freeze(cx, o, rec.implementedAt, list); if (!items.length) items = fz.ids; if (!excl) excl = fz.excl; }
    o.items = items; o.excludedTypes = excl;
    o.baseFrom = rec.weekStart; o.baseTo = [cx.end(k - 1), cx.today].sort()[0];
    var base = cx.range(dep, o.baseFrom, o.baseTo);
    o.typesBefore = C.pct(sumOf(base.byType, items), base.checked);
    o.overWeeks = countOver(cx, dep, o.n, k - 1);
    var verdict = function (m) {
      var w = cx.wk(dep, m), st = cx.range(dep, w.start, w.end);
      return RU.weekVerdict(w.rate, C.pct(sumOf(st.byType, items), w.checked), o.typesBefore, T);
    };
    var a1 = cx.nextData(dep, k);
    if (a1 == null) { o.status = 'check'; o.r1n = Math.max(k, cx.L + 1); return o; }
    o.r1n = a1; o.week1Verdict = verdict(a1);
    if (o.week1Verdict === 'relapse') { o.status = 'not_helped'; o.relapseStage = 1; o.relapseN = a1; o.finishedOn = cx.start(a1 + 1); return o; }
    o.holdSince = cx.start(a1 + 1);
    var a2 = cx.nextData(dep, a1 + 1);
    if (a2 == null) { o.status = 'hold'; o.r2n = Math.max(a1 + 1, cx.L + 1); return o; }
    o.r2n = a2; o.finishedOn = cx.start(a2 + 1); o.week2Verdict = verdict(a2);
    if (o.week2Verdict === 'relapse') { o.status = 'not_helped'; o.relapseStage = 2; o.relapseN = a2; }
    else o.status = RU.finalOf(o.week1Verdict, o.week2Verdict);
    return o;
  }

  function paretoIds(env, byType, pct, excl) {
    var skip = Object.create(null);
    (excl || []).forEach(function (t) { skip[t] = 1; });
    var list = Object.keys(byType).filter(function (t) { return has(env.ix.def, t) && !skip[t] && byType[t] > 0; }).map(function (t) {
      var d = env.ix.def[t];
      return { id: t, pieces: byType[t], level: d.level || 'fix', name: d.name };
    });
    return RU.pareto(list, pct);
  }
  function busyTypes(list, self, day) {
    var out = [];
    list.forEach(function (a) {
      if (a === self || a.key === self.key || !a.implementedAt || a.implementedAt > day || !activeAt(a, day)) return;
      (a.items || []).forEach(function (t) { if (out.indexOf(t) < 0) out.push(t); });
    });
    return out;
  }
  function freeze(cx, a, day, list) {
    var excl = busyTypes(list || [], a, day), st = cx.range(a.departmentId, a.weekStart, day);
    return { ids: paretoIds(cx.env, st.byType, cx.R.pareto, excl), excl: excl };
  }
  function live(cx, a) {
    var key = a.key || a.departmentId + '|' + a.weekStart;
    if (cx.lmemo[key]) return cx.lmemo[key];
    var env = cx.env, dep = a.departmentId, list = cx.kds(dep), from = a.weekStart, to = cx.today, pct = cx.R.pareto;
    var b = a.early ? a.openedAt : a.weekEnd;
    if (b > to) b = to;
    var st = cx.range(dep, from, b), acc = { checked: st.checked, rejected: st.rejected, byType: clone(st.byType) };
    var ex = busyTypes(list, a, b), ids = paretoIds(env, acc.byType, pct, ex), changes = [];
    var pc = function (t) { return { defectTypeId: t, name: env.ix.def[t].name, pieces: acc.byType[t] || 0 }; };
    for (var d = S.addDays(b, 1), g = 0; d <= to && g < 400; d = S.addDays(d, 1), g++) {
      var had = !!cx.byDay[d];
      if (had) {
        var x = cx.day(dep, d);
        acc.checked += x.checked; acc.rejected += x.rejected;
        Object.keys(x.byType).forEach(function (t) { acc.byType[t] = (acc.byType[t] || 0) + x.byType[t]; });
      }
      var ex2 = busyTypes(list, a, d);
      if (!had && ex2.join() === ex.join()) continue;
      ex = ex2;
      var nx = paretoIds(env, acc.byType, pct, ex);
      var add = nx.filter(function (t) { return ids.indexOf(t) < 0; }), rem = ids.filter(function (t) { return nx.indexOf(t) < 0; });
      if (add.length || rem.length) changes.push({ day: d, added: add.map(pc), removed: rem.map(pc) });
      ids = nx;
    }
    return (cx.lmemo[key] = { ids: ids, excl: ex, changes: changes, from: from, to: to, checked: acc.checked, rejected: acc.rejected });
  }
  function itemIds(cx, a) {
    if (PHASE_OF[a.status] === 'open') return live(cx, a).ids;
    return (a.items || []).filter(function (t) { return has(cx.env.ix.def, t); });
  }


  function pubWeek(cx, depId, n) { var w = cx.wk(depId, n); w.pending = n > cx.L; return w; }

  function rangeRate(cx, depId, from, to) {
    if (!from || !to || from > to) return { checked: 0, rejected: 0, rate: null };
    var st = cx.range(depId, from, to);
    return { checked: st.checked, rejected: st.rejected, rate: C.pct(st.rejected, st.checked) };
  }

  function view(cx, a) {
    var ix = cx.env.ix, depId = a.departmentId, dep = ix.dep[depId], bw = cx.range(depId, a.weekStart, a.weekEnd), u = a.who && has(ix.user, a.who) ? ix.user[a.who] : null;
    var w1 = a.r1n != null ? pubWeek(cx, depId, a.r1n) : null, w2 = a.r2n != null ? pubWeek(cx, depId, a.r2n) : null;
    var t1 = w1 ? cx.range(depId, w1.start, w1.end).byType : {}, t2 = w2 ? cx.range(depId, w2.start, w2.end).byType : {};
    var phase = PHASE_OF[a.status], lv = phase === 'open' ? live(cx, a) : null, ids = itemIds(cx, a), cum = 0;
    var lt = a.notNeeded ? [a.notNeeded.at || a.openedAt, cx.today].sort()[0] : a.implementedAt;
    var rf = lv ? lv.from : a.implementedAt ? a.baseFrom : a.weekStart, rt = lv ? lv.to : a.implementedAt ? a.baseTo : lt;
    var ir = cx.range(depId, rf, rt);
    var items = ids.map(function (t) {
      var pcs = ir.byType[t] || 0, def = ix.def[t];
      cum += pcs;
      var it = { defectTypeId: t, name: def.name, level: def.level || 'fix', pieces: pcs, share: C.pct(pcs, ir.rejected), cumShare: C.pct(cum, ir.rejected),
        before: C.pct(pcs, ir.checked), after: null, afterPieces: null, after2: null, after2Pieces: null, delta: null };
      if (w1 && w1.checked) { it.afterPieces = t1[t] || 0; it.after = C.pct(it.afterPieces, w1.checked); }
      if (w2 && w2.checked) { it.after2Pieces = t2[t] || 0; it.after2 = C.pct(it.after2Pieces, w2.checked); }
      if (w1 && !w1.pending && it.after != null && it.before != null) it.delta = r1(it.after - it.before);
      return it;
    });
    var rate = C.pct(bw.rejected, bw.checked), openTo = [a.openedAt, cx.today].sort()[0];
    var split = a.early ? { before: rangeRate(cx, depId, a.weekStart, openTo),
      after: rangeRate(cx, depId, S.addDays(a.openedAt, 1), [a.weekEnd, cx.today].sort()[0]) } : null;
    return { id: a.id || null, key: depId + '|' + a.weekStart, status: a.status, statusLabel: STATUS_LABELS[a.status], state: STATE_OF[a.status], phase: phase,
      locationId: cx.loc.id, departmentId: depId, departmentName: dep ? dep.name : '', period: a.n, periodStart: a.weekStart, periodEnd: a.weekEnd,
      current: a.weekEnd >= cx.today, openedAt: a.openedAt, early: !!a.early, overWeeks: a.overWeeks || 0,
      weekRate: rate, weekDone: a.weekEnd < cx.today, earlyBelow: !!a.early && a.weekEnd < cx.today && rate != null && rate <= cx.T,
      earlySplit: split, keptAt: a.keep && a.keep.at ? a.keep.at : null,
      audits: bw.audits, checked: bw.checked, rejected: bw.rejected, rate: rate, over: rate != null && rate > cx.T,
      levels: { fix: bw.byLevel.fix, repair: bw.byLevel.repair, scrap: bw.byLevel.scrap },
      items: items, itemsShare: C.pct(cum, ir.rejected), pareto: cx.R.pareto,
      changes: lv ? lv.changes : [], openRate: rangeRate(cx, depId, a.weekStart, openTo).rate, nowRate: lv ? C.pct(lv.rejected, lv.checked) : null,
      liveFrom: lv ? lv.from : a.weekStart, liveTo: lv ? lv.to : lt || null,
      typesBefore: a.typesBefore != null ? a.typesBefore : null, baseFrom: a.baseFrom || null, baseTo: a.baseTo || null,
      typesAfter: w1 && w1.checked ? C.pct(sumOf(t1, ids), w1.checked) : null, typesAfter2: w2 && w2.checked ? C.pct(sumOf(t2, ids), w2.checked) : null,
      week1Verdict: a.week1Verdict || null, week2Verdict: a.week2Verdict || null,
      repeatOf: a.repeatOf || null, parallelWith: (a.parallelWith || []).slice(), excludedTypes: (lv ? lv.excl : a.excludedTypes || []).slice(),
      name: items.length ? items.map(function (x) { return x.name; }).join(' · ') : 'брак відділу', defectTypeId: items.length ? items[0].defectTypeId : null,
      causes: a.causes || [], causeNote: a.causeNote || '', plan: a.plan || '', who: a.who || null, whoName: u ? u.name : null,
      implementedAt: a.implementedAt || null, recordedAt: a.recordedAt || null, notNeededReason: a.notNeeded ? a.notNeeded.reason : null,
      notNeededAt: a.notNeeded ? a.notNeeded.at : null, finishedOn: a.finishedOn || null, holdSince: a.holdSince || null,
      daysToImplement: a.implementedAt && a.openedAt ? daysBetween(a.openedAt, a.implementedAt) : null,
      result: w1, hold: w2, after: w1 && !w1.pending ? w1.rate : null, after2: w2 && !w2.pending ? w2.rate : null,
      relapseStage: a.relapseStage || null, relapsePeriod: a.relapseN != null ? a.relapseN : null };
  }
  function openAt(cx, depId, n) { return cx.kds(depId).filter(function (a) { return PHASE_OF[a.status] === 'open' && a.n === n; })[0] || null; }
  function isActive(a) { return PHASE_OF[a.status] === 'open' || PHASE_OF[a.status] === 'observe'; }
  function activeNow(cx, depId) { return cx.kds(depId).filter(isActive); }
  function coverAt(cx, depId, n, except) {
    var list = cx.kds(depId).filter(function (a) { var ph = phaseAt(cx, a, n); return a !== except && (ph === 'cover' || ph === 'observe' || ph === 'relapse'); });
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
      var s1 = cx.start(a.n + 1), before = function (d) { return !!d && d < s1; };
      add(a.openedAt, 2, a.early ? 'pre' : 'over', a.n);
      if (a.early && a.n <= cx.L && !before(a.implementedAt) && !(a.notNeeded && before(a.notNeeded.at))) {
        var wr = cx.wk(depId, a.n).rate;
        add(s1, 2, wr != null && wr > cx.T ? 'over' : 'decide', a.n);
      }
      if (a.keep && a.keep.at) add(a.keep.at, 2, 'over', a.n);
      if (a.implementedAt) add(a.implementedAt, 3, 'watch', a.n);
      if (a.notNeeded) add(a.notNeeded.at, 4, 'skip', a.n);
      if (a.r1n != null && a.r1n <= cx.L) add(cx.start(a.r1n + 1), 0, a.relapseStage === 1 ? 'relapse' : 'hold', a.r1n);
      if (a.r2n != null && a.r2n <= cx.L) add(cx.start(a.r2n + 1), 0, a.status === 'helped' ? 'done' : a.status === 'held_types' ? 'part' : 'relapse', a.r2n);
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
    var cur = mine.filter(isActive).pop() || mine[mine.length - 1] || null;
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
    return { 'new': n('new'), check: n('check'), hold: n('hold'), helped30: n('helped', true), notHelped30: n('not_helped', true), notNeeded30: n('not_needed', true),
      pre: n('pre'), decide: n('decide'), heldTypes30: n('held_types', true) };
  }
  function stateCounts(list, from) {
    var c = { over: 0, watch: 0, hold: 0, done: 0, relapse: 0, skip: 0, pre: 0, decide: 0, part: 0 };
    list.forEach(function (a) { var s = STATE_OF[a.status]; if (ONGOING[s] || !from || a.finishedOn >= from) c[s]++; });
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
  function gItems(g, depId, from, to) { return paretoIds(g.env, gStat(g, depId, from, to).byType, GEN.pareto, []); }
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
  function push(g, dep, from, to, target, aFrom, aTo, types) {
    types = types || g.types;
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
      addPieces(list, g.rnd, types[0].id, first, g.culprit);
      addPieces(list, g.rnd, (types[1] || types[0]).id, want - first, g.culprit);
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
  function thin(g, dep, from, to, aFrom, aTo, max) {
    var st = gStat(g, dep.id, from, to), items = [];
    if (!st.checked || C.pct(st.rejected, st.checked) <= max) return;
    gAudits(g, dep.id, aFrom, aTo).forEach(function (a) { a.items.forEach(function (it) { items.push(it); }); });
    if (!items.length) return;
    var need = Math.ceil(st.rejected * 100 / max) - st.checked + 1;
    items.forEach(function (it, i) { it.qty += Math.floor(need / items.length) + (i < need % items.length ? 1 : 0); });
  }
  function bulk(g, dep, from, to, min) {
    var st = gStat(g, dep.id, from, to), items = [];
    if (st.checked >= min) return;
    gAudits(g, dep.id, from, to).forEach(function (a) { a.items.forEach(function (it) { items.push(it); }); });
    var need = min - st.checked;
    items.forEach(function (it, i) { it.qty += Math.floor(need / items.length) + (i < need % items.length ? 1 : 0); });
  }
  var GEN_PLAN = { skill: 'Провели інструктаж біля робочого місця, показали правильний прийом.', discipline: 'Нагадали про перевірку виробу перед здачею; тімлід перевіряє першу партію зміни.',
    tool: 'Замінили голки й налаштували натяг нитки на двох машинах.', material: 'Замінили партію ниток на іншого постачальника.', organization: 'Переставили стіл контролю ближче до лінії.' };
  var GEN_SKIP = ['Разовий збій машини — полагодили того ж дня.', 'Партія з браком від постачальника — повернули.'];

  var PLANS = ['history', 'parallel', 'decide', 'check', 'open'];
  function shape(g, dep, kind) {
    var L = g.L, id = dep.id, dec = g.dec, s = function (o) { return S.periodStart(L + o, GEN.wd); }, e = function (o) { return S.periodEnd(L + o, GEN.wd); };
    var j = function (a, b) { return Math.round(g.rnd.between(a, b) * 10) / 10; }, at = function (o) { return id + '|' + (L + o); };
    var impl = function (o, plus, causes) { return function (v, cx, list) { return seedRec(g, v, { implementedAt: S.addDays(s(o), plus), causes: causes }, list); }; };
    var skip = function (v, cx, list) { return seedRec(g, v, { notNeeded: GEN_SKIP[0] }, list); }, open = function () { return null; };
    var quiet = function (a, b) { cap(g, dep, s(a), e(b), 4.5); };
    var over = function (o, lo, hi) { push(g, dep, s(o), e(o), j(lo, hi)); };
    var hotOthers = function (o, kdFrom) {
      var items = gItems(g, id, kdFrom, s(o)), oth = g.allTypes.filter(function (t) { return items.indexOf(t.id) < 0; });
      if (oth.length) push(g, dep, s(o), e(o), j(6.6, 7.2), S.addDays(s(o), 1), e(o), g.rnd.sample(oth, Math.min(2, oth.length)));
    };
    switch (kind) {
      case 'history': {
        quiet(-12, -10);
        over(-9, 6.4, 6.9); dec[at(-9)] = impl(-8, 0, ['tool']);
        hotOthers(-8, s(-9)); dec[at(-8)] = impl(-7, 0, ['skill']);
        cap(g, dep, s(-7), e(-6), 4.2);
        over(-5, 6.4, 6.9); dec[at(-5)] = impl(-4, 1, ['discipline']);
        cap(g, dep, s(-4), e(-4), 4);
        over(-3, 8.0, 8.6); dec[at(-3)] = impl(-2, 0, ['material']);
        cap(g, dep, s(-2), e(0), 4.2);
        var to = [S.addDays(g.today, -1), S.addDays(e(1), -1)].sort()[0];
        if (to >= s(1) && gStat(g, id, s(1), to).checked >= GEN.early) { push(g, dep, s(1), to, j(8.2, 9.0)); dec[at(1)] = open; }
        break;
      }
      case 'parallel':
        quiet(-7, -5);
        over(-4, 5.6, 6.0); dec[at(-4)] = skip;
        cap(g, dep, s(-3), e(-2), 4.2);
        over(-1, 6.4, 6.9); dec[at(-1)] = impl(0, 0, ['skill', 'organization']);
        hotOthers(0, s(-1)); dec[at(0)] = open;
        break;
      case 'decide': {
        quiet(-9, -7);
        over(-6, 6.4, 6.9); dec[at(-6)] = impl(-5, 0, ['tool']);
        cap(g, dep, s(-5), e(-1), 4.2);
        var days = [], cum = 0, d0 = null;
        gAudits(g, id, s(0), S.addDays(e(0), -1)).forEach(function (a) { if (days.indexOf(a.day) < 0) days.push(a.day); });
        days.sort();
        if (days.length < 2) break;
        for (var i = 0; i < days.length - 1 && !d0; i++) { cum += gStat(g, id, days[i], days[i]).checked; if (cum >= 550) d0 = days[i]; }
        if (!d0) { d0 = days[days.length - 2]; bulk(g, dep, s(0), d0, 550); }
        push(g, dep, s(0), d0, j(8.2, 9.0));
        cap(g, dep, S.addDays(d0, 1), e(0), 2);
        thin(g, dep, s(0), e(0), S.addDays(d0, 1), e(0), 4.5);
        dec[at(0)] = open;
        break;
      }
      case 'check':
        quiet(-9, -7);
        over(-6, 6.4, 6.9); dec[at(-6)] = impl(-5, 0, ['tool']);
        cap(g, dep, s(-5), e(-5), 4.2);
        over(-4, 8.0, 8.6); dec[at(-4)] = impl(-3, 0, ['organization']);
        cap(g, dep, s(-3), e(-2), 4.2);
        over(-1, 6.3, 6.8); dec[at(-1)] = impl(0, 1, ['material']);
        break;
      case 'open':
        quiet(-7, -5);
        over(-4, 6.3, 6.9); dec[at(-4)] = impl(-3, 0, ['tool']);
        cap(g, dep, s(-3), e(-1), 4.2);
        cap(g, dep, s(0), S.addDays(e(0), -1), 4); push(g, dep, s(0), e(0), j(6.2, 6.8), e(0), e(0));
        dec[at(0)] = open;
        break;
    }
  }
  function seedRec(g, v, o, list) {
    var rec = { id: 'KD_' + v.departmentId + '_' + v.weekStart, locationId: v.locationId,
      departmentId: v.departmentId, weekStart: v.weekStart, weekEnd: v.weekEnd, openedAt: v.openedAt, early: v.early,
      items: [], excludedTypes: [], causes: [], causeNote: '', plan: '', who: g.senior, implementedAt: null,
      recordedAt: null, recordedBy: g.senior, startedAt: null, notNeeded: null, seeded: true }, day;
    if (o.notNeeded) { day = [S.addDays(v.openedAt, 1), g.today].sort()[0]; rec.notNeeded = { reason: o.notNeeded, at: day, by: g.senior }; rec.recordedAt = rec.startedAt = day; }
    else {
      day = [o.implementedAt, g.today].sort()[0];
      if (day < v.openedAt) day = v.openedAt;
      rec.implementedAt = rec.recordedAt = rec.startedAt = day;
      rec.causes = o.causes; rec.plan = GEN_PLAN[o.causes[0]];
    }
    var fz = freeze(g.cx, v, day, list);
    rec.items = fz.ids; rec.excludedTypes = fz.excl;
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
        var kind = PLANS[i];
        if (!kind) return;
        var dep = x.d, types = db.defectTypes.filter(function (t) { return t.deptTypeId === dep.deptTypeId && t.active !== false; });
        var ws = db.workers.filter(function (w) { return w.departmentId === dep.id; });
        if (types.length < 2 || !ws.length) return;
        g.allTypes = types; g.types = rnd.sample(types, 2); g.culprit = rnd.pick(ws).code;
        shape(g, dep, kind);
      });
      g.cx = makeCx(env, loc, GEN, []);
      deps.forEach(function (d) {
        g.cx.kds(d.id, function (v, cx, list) {
          var k = d.id + '|' + v.n;
          if (has(g.dec, k)) return g.dec[k](v, cx, list);
          if (v.n > L - 1) return null;   // свіжі перевищення лишаються без рішення
          if (rnd.chance(0.15)) return seedRec(g, v, { notNeeded: rnd.pick(GEN_SKIP) }, list);
          var cs = rnd.sample(Object.keys(GEN_PLAN), rnd.int(1, 2));
          return seedRec(g, v, { implementedAt: S.addDays(v.openedAt, rnd.int(0, 2)), causes: cs }, list);
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
    var res = { belowAfter1: 0, notBelowAfter1: 0, pending: 0 }, held = { done: 0, relapse: 0, pending: 0, part: 0 }, before = [], after = [], cause = Object.create(null);
    impl.forEach(function (a) {
      if (a.status === 'check') res.pending++;
      else if (a.week1Verdict !== 'norm') res.notBelowAfter1++;
      else { res.belowAfter1++; held[a.status === 'helped' ? 'done' : a.status === 'held_types' ? 'part' : a.status === 'hold' ? 'pending' : 'relapse']++; }
      if (a.status !== 'check') view(cx, a).items.forEach(function (it) { if (it.before != null && it.after != null) { before.push(it.before); after.push(it.after); } });
      (a.causes || []).forEach(function (c) { if (has(CAUSE_IX, c)) cause[c] = (cause[c] || 0) + 1; });
    });
    return { opened: opened.length, earlyOpened: opened.filter(function (a) { return a.early; }).length, implemented: impl.length,
      implementedDaysAvg: d.length ? r1(mean(d)) : null, notImplemented: opened.filter(function (a) { return PHASE_OF[a.status] === 'open'; }).length,
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
    st.part = all.filter(function (a) { return a.status === 'held_types' && a.finishedOn >= rg.from && a.finishedOn <= rg.to; }).length;
    var weeks = [];
    for (var n = cx.of(rg.from); n <= cx.of(rg.to); n++) {
      var c = 0, r = 0, s = cx.start(n), e = cx.end(n), inW = function (d) { return !!d && d >= s && d <= e; };
      cx.deps.forEach(function (d) { var w = cx.range(d.id, s, e); c += w.checked; r += w.rejected; });
      weeks.push({ n: n, start: s, end: e, current: n > cx.L, rate: C.pct(r, c), checked: c, rejected: r,
        opened: all.filter(function (a) { return inW(a.openedAt); }).length, implemented: all.filter(function (a) { return inW(a.implementedAt); }).length,
        belowAfter: all.filter(function (a) { return a.r1n === n && n <= cx.L && a.week1Verdict === 'norm'; }).length,
        relapse: all.filter(function (a) { return a.relapseN === n; }).length });
    }
    var depts = cx.deps.map(function (d) {
      var mine = all.filter(function (a) { return a.departmentId === d.id; }), w = cx.wk(d.id, cx.L);
      return { id: d.id, name: d.name, weekRate: w.rate, weekChecked: w.checked, over: w.over, open: mine.filter(function (a) { return a.status === 'new'; }).length,
        watch: mine.filter(function (a) { return a.status === 'check'; }).length, hold: mine.filter(function (a) { return a.status === 'hold'; }).length,
        relapse: mine.filter(function (a) { return a.status === 'not_helped' && a.finishedOn >= rg.from && a.finishedOn <= rg.to; }).length,
        pre: mine.filter(function (a) { return a.status === 'pre'; }).length, decide: mine.filter(function (a) { return a.status === 'decide'; }).length,
        part: mine.filter(function (a) { return a.status === 'held_types' && a.finishedOn >= rg.from && a.finishedOn <= rg.to; }).length };
    });
    var actions = all.filter(function (a) { return a.openedAt <= rg.to && !(a.finishedOn && a.finishedOn < rg.from); }).map(function (a) {
      var v = view(cx, a);
      return { id: v.id, key: v.key, departmentId: v.departmentId, departmentName: v.departmentName, weekStart: v.periodStart, weekEnd: v.periodEnd,
        openedAt: v.openedAt, early: v.early, earlyBelow: v.earlyBelow, weekRate: v.weekRate, weekDone: v.weekDone, implementedAt: v.implementedAt, daysToImplement: v.daysToImplement,
        cause: v.causes.length && has(CAUSE_IX, v.causes[0]) ? CAUSE_IX[v.causes[0]].label : null, done: v.plan || null, before: v.rate, after: v.after, after2: v.after2,
        state: v.state, phase: v.phase, statusLabel: v.statusLabel, repeatOf: v.repeatOf, parallelWith: v.parallelWith,
        typesBefore: v.typesBefore, typesAfter: v.typesAfter, typesAfter2: v.typesAfter2, week1Verdict: v.week1Verdict, week2Verdict: v.week2Verdict,
        items: v.items.map(function (it) { return { defectTypeId: it.defectTypeId, name: it.name, level: it.level, share: it.share, before: it.before, after: it.after }; }) };
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
    var depId = p.departmentId, period = p.period;
    if (typeof p.key === 'string' && p.key) {
      var parts = p.key.split('|');
      depId = parts[0];
      period = parts.length === 2 && DAY_RE.test(parts[1]) && cx.start(cx.of(parts[1])) === parts[1] ? cx.of(parts[1]) : NaN;
    }
    var dep = depOf(cx, depId), n = periodArg(cx, period);
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
    var keep = ['id', 'locationId', 'departmentId', 'weekStart', 'weekEnd', 'openedAt', 'early', 'items', 'excludedTypes', 'causes', 'causeNote', 'plan', 'who',
      'implementedAt', 'recordedAt', 'recordedBy', 'startedAt', 'notNeeded', 'keep', 'seeded'], o = {};
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
    var was = kd.id ? cx.stored.filter(function (s) { return s.id === kd.id; })[0] : null;
    if (was) { var r = clone(was); r.recordedAt = cx.today; r.recordedBy = me.id; return r; }
    return { id: 'KD_' + kd.departmentId + '_' + kd.weekStart, locationId: cx.loc.id, departmentId: kd.departmentId, weekStart: kd.weekStart, weekEnd: kd.weekEnd,
      openedAt: kd.openedAt, early: kd.early, items: [], excludedTypes: [], causes: [], causeNote: '', plan: '', who: null, implementedAt: null,
      recordedAt: cx.today, recordedBy: me.id, startedAt: cx.today, notNeeded: null, keep: null };
  }

  function remapDefect(env, fromIds, toId) {
    var set = Object.create(null), all = S.get(env, KEY, {}) || {}, n = 0;
    if (typeof all !== 'object' || Array.isArray(all)) all = {};
    (fromIds || []).forEach(function (id) { if (typeof id === 'string' && id !== toId) set[id] = 1; });
    var hitList = function (l) { return Array.isArray(l) && l.some(function (t) { return has(set, t); }); };
    var hit = function (a) { return a && (hitList(a.items) || hitList(a.excludedTypes)); };
    var remap = function (l) { var out = []; l.forEach(function (t) { var x = has(set, t) ? toId : t; if (out.indexOf(x) < 0) out.push(x); }); return out; };
    (env.db.kdSeed || []).forEach(function (a) { if (hit(a) && !has(all, a.id)) all[a.id] = clone(a); });
    Object.keys(all).forEach(function (id) {
      var a = all[id];
      if (!hit(a)) return;
      if (Array.isArray(a.items)) a.items = remap(a.items);
      if (Array.isArray(a.excludedTypes)) a.excludedTypes = remap(a.excludedTypes);
      n++;
    });
    if (n) { S.set(env, KEY, all); env.reload(); }
    return n;
  }
  P.demoKd = {
    remapDefect: remapDefect,
    locSummary: function (env, locId, from, to) { return locSummary(env, locId, from, to); },
    deptNow: function (env, locId, depId) {
      if (!has(env.ix.loc, locId)) return null;
      var cx = makeCx(env, env.ix.loc[locId]);
      if (!depOf(cx, depId)) return null;
      var act = activeNow(cx, depId);
      if (!act.length) return null;
      var all = act.map(function (a) { var x = view(cx, a); x.threshold = cx.T; return x; }), v = clone(all[all.length - 1]);
      v.all = all;
      return v;
    }
  };

  function canSummary(me, locId) {
    if (me.role === 'manager' || me.role === 'admin') return C.hasLoc(me, locId) || !!(me.can && me.can.viewAllLocations);
    return (me.role === 'senior_auditor' || me.role === 'location_lead') && C.hasLoc(me, locId);
  }
  var RANK = { decide: 0, 'new': 1, pre: 2, check: 3, hold: 4 };
  function byRank(a, b) {
    var ra = has(RANK, a.status) ? RANK[a.status] : 5, rb = has(RANK, b.status) ? RANK[b.status] : 5;
    return ra - rb || b.period - a.period || (a.departmentName < b.departmentName ? -1 : 1);
  }

  P.demoApis.push({
    srKdCauses: function () { return { ok: true, causes: clone(CAUSES) }; },

    srKdOverview: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), from = since(cx, 30), R = cx.R;
      var depts = cx.deps.map(function (d, order) {
        var kds = cx.kds(d.id), last = cx.wk(d.id, cx.L), cur = cx.wk(d.id, cx.L + 1), act = activeNow(cx, d.id).map(function (a) { return view(cx, a); });
        return { id: d.id, name: d.name, order: order, last: last, cur: cur, earlyLeft: Math.max(0, R.early - cur.checked), earlyOff: act.length > 0,
          series: series(cx, d.id, cx.L - MINI_BARS + 1, cx.L), kd: act.length ? act[act.length - 1] : null, kds: act,
          states: stateCounts(kds, from), total: kds.length };
      }).sort(function (a, b) {
        var oa = a.kds.some(function (x) { return x.phase === 'open'; }), ob = b.kds.some(function (x) { return x.phase === 'open'; });
        return ob - oa || !!b.kd - !!a.kd || a.order - b.order;
      });
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
      var mine = kds.filter(function (a) { return a.n === n; })[0] || null, cov = coverAt(cx, dep.id, n, mine);
      var par = paretoIds(env, st.byType, cx.R.pareto, []), ids = {};
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
        cover: cov ? view(cx, cov) : null, pareto: par, types: types, actions: actions, states: stateCounts(kds) };
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
      var d = details(cx, dep.id, t.id, per.start, per.end), win = chartWindow(cx, n), par = paretoIds(env, st.byType, cx.R.pareto, []);
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
      var counts = { 'new': 0, check: 0, hold: 0, helped: 0, not_helped: 0, not_needed: 0, pre: 0, decide: 0, held_types: 0, all: all.length };
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
        inWin.forEach(function (a) { if (PHASE_OF[a.status] !== 'open' && a.status !== 'check' && a.status !== 'not_needed') view(cx, a).items.forEach(function (it) { if (it.delta != null) deltas.push({ d: it.delta, b: it.before }); }); });
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
      var rec = newRec(cx, o.kd, me), fz = freeze(cx, o.kd, p.day, cx.kds(o.kd.departmentId));
      rec.causes = p.causes.slice(); rec.causeNote = String(p.causeNote || '').trim(); rec.plan = String(p.plan).trim(); rec.who = p.who; rec.implementedAt = p.day;
      rec.items = fz.ids; rec.excludedTypes = fz.excl;
      save(env, rec);
      return after(env, cx.loc, rec.id);
    },

    srKdEditPlan: function (p, me, env) {
      var w = writable(p, me, env); if (w.err) return w.err;
      var cx = w.cx, a = findAction(cx, p.id);
      if (!a) return C.fail('not_found', 'Коригуючу дію не знайдено. Оновіть сторінку.');
      if (a.status === 'not_needed') return C.fail('conflict', 'У цієї коригуючої дії немає плану: її позначено «дія не потрібна».');
      if (!a.implementedAt) return C.fail('conflict', 'Для цієї коригуючої дії ще не записано впроваджений план.');
      var lock = a.status !== 'check', errs = planErrors(cx, me, p, a, lock);
      if (errs.length) return C.fail('validation', 'Перевірте поля — дещо не заповнено.', errs);
      var rec = clone(a);
      rec.causes = p.causes.slice(); rec.causeNote = String(p.causeNote || '').trim(); rec.plan = String(p.plan).trim(); rec.who = p.who;
      if (!lock && p.day !== a.implementedAt) {
        var fz = freeze(cx, a, p.day, cx.kds(a.departmentId));
        rec.implementedAt = p.day; rec.items = fz.ids; rec.excludedTypes = fz.excl;
      }
      save(env, rec);
      return after(env, cx.loc, rec.id);
    },

    srKdNotNeeded: function (p, me, env) {
      var w = writable(p, me, env); if (w.err) return w.err;
      var cx = w.cx, reason = String(p.reason || '').trim(), rec, kd = null;
      if (reason.length < 3) return C.fail('validation', 'Напишіть причину.', [{ field: 'reason', message: 'Напишіть коротко, чому дія не потрібна.' }]);
      if (reason.length > 300) return C.fail('validation', 'Причина задовга.', [{ field: 'reason', message: 'Коротше, будь ласка: до 300 знаків.' }]);
      if (p.id) {
        var a = findAction(cx, p.id);
        if (!a) return C.fail('not_found', 'Коригуючу дію не знайдено. Оновіть сторінку.');
        if (PHASE_OF[a.status] === 'open') kd = a;
        else if (a.status !== 'not_needed') return C.fail('conflict', 'Для цієї коригуючої дії вже записано впроваджений план, тому позначити «дія не потрібна» не можна.');
        else { rec = clone(a); rec.notNeeded = { reason: reason, at: a.notNeeded.at, by: me.id }; }
      } else {
        var o = openKd(cx, p); if (o.err) return o.err;
        kd = o.kd;
      }
      if (kd) {
        var lv = live(cx, kd);
        rec = newRec(cx, kd, me); rec.who = me.id; rec.notNeeded = { reason: reason, at: cx.today, by: me.id };
        rec.items = lv.ids.slice(); rec.excludedTypes = lv.excl.slice();
      }
      save(env, rec);
      return after(env, cx.loc, rec.id);
    },

    srKdKeep: function (p, me, env) {
      var w = writable(p, me, env); if (w.err) return w.err;
      var cx = w.cx, o = openKd(cx, p); if (o.err) return o.err;
      if (o.kd.status !== 'decide') return C.fail('conflict', 'Рішення для цієї коригуючої дії вже не потрібне: тиждень ще йде або завершився понад норму. Оновіть сторінку — побачите, як є зараз.');
      var rec = newRec(cx, o.kd, me);
      rec.keep = { at: cx.today, by: me.id };
      save(env, rec);
      return after(env, cx.loc, rec.id);
    }
  });

  P.demoGenHooks.push(genHook);
  P.demoLoadHooks.push(loadHook);
  P.demoResetKeys.push(KEY, KD2_KEY, OLD_KEY);
})(typeof window !== 'undefined' ? window : globalThis);

