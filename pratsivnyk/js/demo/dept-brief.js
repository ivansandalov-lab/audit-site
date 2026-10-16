(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, S = P.demoSenior;
  var DAYS = 30, TOP = 5, LOST_AFTER = 7;   // вікно історії, скільки рядків у кожному списку, «давно» — понад 7 днів
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function daysBetween(a, b) { return Math.round((P.demoDates.parseDay(b) - P.demoDates.parseDay(a)) / 86400000); }
  function top(map, n) {
    return Object.keys(map).filter(function (k) { return map[k] > 0; }).sort(function (a, b) { return map[b] - map[a] || (a < b ? -1 : 1); }).slice(0, n);
  }

  function kdOut(k) {
    return { statusLabel: k.statusLabel, state: k.state, items: (k.items || []).map(function (x) { return { name: x.name, level: x.level }; }),
      periodStart: k.periodStart, periodEnd: k.periodEnd, rate: k.rate, threshold: k.threshold,
      plan: k.plan, whoName: k.whoName, implementedAt: k.implementedAt };
  }
  P.demoApis = P.demoApis || [];
  P.demoApis.push({
    auditDeptBrief: function (p, me, env) {
      p = p || {};
      var ix = env.ix, locId = p.locationId;
      if (!locId || !has(ix.loc, locId)) return C.fail('not_found', 'Локацію не знайдено.');
      if (!C.hasLoc(me, locId) && !C.canRecordAt(me, locId, ix)) return C.forbidden();
      var dep = has(ix.dep, p.departmentId) ? ix.dep[p.departmentId] : null;
      if (!dep || dep.locationId !== locId || dep.active === false) return C.fail('not_found', 'Відділ не знайдено.');
      var day = env.day(), from = P.demoDates.addDays(day, -(DAYS - 1));
      var all = env.audits().filter(function (a) { return a.locationId === locId; });

      var today = all.filter(function (a) { return a.departmentId === dep.id && a.day === day; })
        .sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : 1; }).map(function (a) {
          var c = C.checkedOf(a), r = C.rejectedOf(a);
          return { id: a.id, createdAt: a.createdAt, auditorName: has(ix.user, a.auditorId) ? ix.user[a.auditorId].name : '—',
            checked: c, rejected: r, pct: C.pct(r, c), comment: a.comment || '' };
        });
      var norm = env.db.norms.filter(function (n) { return n.departmentId === dep.id; })[0], target = norm ? norm.sampleTarget : null;
      var todayChecked = today.reduce(function (s, a) { return s + a.checked; }, 0);

      var byProd = {}, byType = {}, byWorker = {}, checked30 = 0;
      all.forEach(function (a) {
        if (a.day < from) return;
        if (a.departmentId === dep.id) checked30 += C.checkedOf(a);
        a.defects.forEach(function (d) {
          if (S.sourceDept(a, d) !== dep.id) return;
          var q = S.pieces(d);
          byProd[d.productId] = (byProd[d.productId] || 0) + q;
          byType[d.defectTypeId] = (byType[d.defectTypeId] || 0) + q;
          d.guilty.forEach(function (g) { if (g.workerCode) byWorker[g.workerCode] = (byWorker[g.workerCode] || 0) + (g.qty || 0); });
        });
      });
      var people = env.db.workers.filter(function (w) { return w.locationId === locId && w.departmentId === dep.id && w.active !== false; });
      var mine = {}, last = {};
      people.forEach(function (w) { mine[w.code] = w; });
      all.forEach(function (a) { a.checkedWorkers.forEach(function (c) { if (has(mine, c) && (!last[c] || a.day > last[c])) last[c] = a.day; }); });
      var defectMap = {};
      Object.keys(byWorker).forEach(function (c) { if (has(mine, c)) defectMap[c] = byWorker[c]; });
      var lost = people.filter(function (w) { return last[w.code] && daysBetween(last[w.code], day) > LOST_AFTER; })
        .map(function (w) { return { name: w.name, lastDay: last[w.code], daysAgo: daysBetween(last[w.code], day) }; })
        .sort(function (a, b) { return b.daysAgo - a.daysAgo || (a.name < b.name ? -1 : 1); }).slice(0, TOP);

      var kd = P.demoKd && P.demoKd.deptNow ? P.demoKd.deptNow(env, locId, dep.id) : null;
      return { ok: true, location: { id: locId, name: ix.loc[locId].name }, department: { id: dep.id, name: dep.name }, day: day, days: DAYS,
        today: today,
        norm: { target: target, checked: todayChecked, left: target == null ? null : Math.max(0, target - todayChecked) },
        checked30: checked30,
        products: top(byProd, TOP).map(function (id) { return { name: has(ix.prod, id) ? ix.prod[id].name : 'Невідомий виріб', pieces: byProd[id] }; }),
        defectTypes: top(byType, TOP).map(function (id) {
          var t = has(ix.def, id) ? ix.def[id] : null;
          return { name: t ? t.name : 'Невідомий вид браку', level: t ? (t.level || 'fix') : 'fix', pieces: byType[id] };
        }),
        defectors: top(defectMap, TOP).map(function (c) { return { name: mine[c].name, pieces: defectMap[c] }; }),
        lost: lost, lostAfter: LOST_AFTER,
        kds: kd ? (kd.all || [kd]).map(kdOut) : [], kd: kd ? kdOut(kd) : null };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
