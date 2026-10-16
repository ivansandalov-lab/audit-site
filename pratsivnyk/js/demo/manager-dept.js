(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, S = P.demoSenior;
  P.demoApis = P.demoApis || [];
  var KD_ORDER = ['pre', 'decide', 'over', 'work', 'watch', 'hold', 'done', 'part', 'relapse', 'skip'];

  function M() { return P.demoMgr; }

  function daysOfDept(env, list, depId, span) {
    var by = {};
    list.forEach(function (a) { (by[a.day] = by[a.day] || []).push(a); });
    return span.map(function (d) {
      var dayList = by[d] || [], st = S.deptStats(env, dayList, depId);
      return { day: d, audits: dayList.filter(function (a) { return a.departmentId === depId; }).length, checked: st.checked, rejected: st.rejected,
        pct: C.pct(st.rejected, st.checked), levels: st.byLevel };
    });
  }

  function normOfDept(env, days, depId, active) {
    var target = M().normOf(env, depId), o = { ok: 0, of: 0, target: target };
    if (target != null && active) days.forEach(function (d) { o.of++; if (d.checked >= target) o.ok++; });
    o.pct = C.pct(o.ok, o.of);
    return o;
  }

  function productsOf(env, list, depId) {
    var by = {};
    function row(id) {
      var key = id || '';
      if (!by[key]) { var p = id ? env.ix.prod[id] : null; by[key] = { id: id || null, name: p ? p.name : id ? 'Невідомий виріб' : 'Виріб не вказано', checked: 0, rejected: 0, orders: {} }; }
      return by[key];
    }
    list.forEach(function (a) {
      if (a.departmentId === depId) a.items.forEach(function (it) { var r = row(it.productId); r.checked += it.qty; if (it.orderNo) r.orders[it.orderNo] = 1; });
      a.defects.forEach(function (d) { if (S.sourceDept(a, d) === depId) row(d.productId).rejected += S.pieces(d); });
    });
    return Object.keys(by).map(function (k) {
      var r = by[k];
      return { id: r.id, name: r.name, checked: r.checked, rejected: r.rejected, pct: C.pct(r.rejected, r.checked), orders: Object.keys(r.orders).length };
    }).sort(function (a, b) { return b.checked - a.checked || b.rejected - a.rejected || (a.name < b.name ? -1 : 1); });
  }

  function auditorsOf(env, list, depId) {
    var by = {};
    list.forEach(function (a) {
      if (a.departmentId !== depId) return;
      var x = by[a.auditorId] = by[a.auditorId] || { audits: 0, checked: 0 };
      x.audits++; x.checked += C.checkedOf(a);
    });
    return Object.keys(by).map(function (id) {
      var u = env.ix.user[id];
      return { id: id, name: u ? u.name : 'Невідомий аудитор', senior: !!u && u.role === 'senior_auditor', active: !u || u.active !== false,
        audits: by[id].audits, checked: by[id].checked };
    }).sort(function (a, b) { return b.audits - a.audits || b.checked - a.checked || (a.name < b.name ? -1 : 1); });
  }

  function kdOfDept(env, locId, depId, from, to) {
    var k = M().kdSum(env, locId, from, to);
    if (!k) return null;
    var actions = (k.actions || []).filter(function (a) { return a.departmentId === depId; }), states = {};
    KD_ORDER.forEach(function (s) { states[s] = 0; });
    actions.forEach(function (a) { states[a.state] = (states[a.state] || 0) + 1; });
    function inside(v) { var d = v ? String(v).slice(0, 10) : ''; return d >= from && d <= to; }
    return { threshold: k.threshold, cycle: k.cycle || null, states: states, actions: actions,
      opened: actions.filter(function (a) { return inside(a.openedAt); }).length, implemented: actions.filter(function (a) { return inside(a.implementedAt); }).length };
  }

  var api = {
    mgrDeptDetail: function (p, me, env) {
      var X = M();
      if (!X || !X.can(me)) return C.forbidden();
      var id = p.departmentId;
      if (id == null || id === '' || typeof id !== 'string') return C.fail('validation', 'Оберіть відділ.', [{ field: 'departmentId', message: 'Оберіть відділ.' }]);
      if (!X.has(env.ix.dep, id)) return C.fail('not_found', 'Такого відділу немає — оновіть сторінку.');
      var dep = env.ix.dep[id], sel = X.locOf(p, env);
      if (sel.err) return sel.err;
      if (sel.loc && sel.loc.id !== dep.locationId) return C.fail('not_found', 'Такого відділу в цій локації немає — оновіть сторінку.');
      var rg = X.range(p, env), span = X.daysOf(rg.from, rg.to), loc = env.ix.loc[dep.locationId], dt = env.ix.dt[dep.deptTypeId];
      var list = X.auditsIn(env, dep.locationId, rg.from, rg.to), s = X.stats(env, list, [dep]), active = dep.active !== false;
      var days = daysOfDept(env, list, dep.id, span), mine = list.filter(function (a) { return a.departmentId === dep.id; });
      return { ok: true, from: rg.from, to: rg.to, asOf: env.now().toISOString(), criticalPct: env.db.settings.criticalPct,
        department: { id: dep.id, name: dep.name, active: active, deptTypeId: dep.deptTypeId, deptTypeName: dt ? dt.name : '' },
        location: loc ? X.short(loc) : null,
        totals: { audits: s.audits, checked: s.checked, rejected: s.rejected, pct: s.pct, levels: s.levels, days: span.length,
          daysWithAudits: X.dayCount(mine), norm: normOfDept(env, days, dep.id, active) },
        days: days, products: productsOf(env, list, dep.id), defects: X.top(env, s.byType, Infinity),
        auditors: auditorsOf(env, list, dep.id), kd: kdOfDept(env, dep.locationId, dep.id, rg.from, rg.to) };
    }
  };

  P.demoApis.push(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
