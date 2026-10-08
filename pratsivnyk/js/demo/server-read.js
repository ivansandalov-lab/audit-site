(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var C = P.demoCommon;

  function nm(map, id, fallback) { return map[id] ? map[id].name : fallback; }
  var NO_PROD = 'Невідомий виріб', NO_DEF = 'Невідомий вид браку', NO_WORKER = 'Невідомий працівник';

  function editableUntil(a, env) {
    var end = Date.parse(a.createdAt) + C.LIMITS.editWindowMin * 60000;
    return end > env.now().getTime() ? new Date(end).toISOString() : null;
  }

  function summary(a, env) {
    var checked = C.checkedOf(a), rejected = C.rejectedOf(a), names = [];
    a.items.forEach(function (i) { var n = nm(env.ix.prod, i.productId, NO_PROD); if (names.indexOf(n) < 0) names.push(n); });
    return {
      id: a.id, createdAt: a.createdAt, locationId: a.locationId, locationName: nm(env.ix.loc, a.locationId, a.locationId),
      departmentId: a.departmentId, departmentName: nm(env.ix.dep, a.departmentId, a.departmentId),
      auditorId: a.auditorId, auditorName: nm(env.ix.user, a.auditorId, a.auditorId),
      products: names, orders: a.orders.slice(), checked: checked, rejected: rejected, pct: C.pct(rejected, checked),
      hasPhoto: a.defects.some(function (d) { return !!d.photo; }), isTest: a.isTest !== false,
      editableUntil: editableUntil(a, env)
    };
  }

  function inPeriod(list, env, period) {
    var from = C.periodFrom(env.day(), period);
    return list.filter(function (a) { return a.day >= from; }).sort(C.newestFirst);
  }

  function page(list, p) {
    var offset = Math.max(0, parseInt(p.offset, 10) || 0), limit = Math.min(200, Math.max(1, parseInt(p.limit, 10) || 30));
    return list.slice(offset, offset + limit);
  }

  function resolveLoc(p, me, env) {
    var id = p.locationId || me.defaultLocationId, loc = env.ix.loc[id];
    if (!loc) return { err: C.fail('not_found', 'Локацію не знайдено.') };
    if (!C.hasLoc(me, id)) return { err: C.forbidden() };
    return { loc: loc };
  }

  function sumAudits(list) {
    var s = { audits: list.length, checked: 0, rejected: 0 };
    list.forEach(function (a) { s.checked += C.checkedOf(a); s.rejected += C.rejectedOf(a); });
    s.pct = C.pct(s.rejected, s.checked);
    return s;
  }

  function deptStatus(s, target, critical) {
    if (!s.audits) return 'none';
    if (s.pct != null && s.pct >= critical) return 'bad';
    if (target == null) return 'unknown';
    return s.checked < target ? 'progress' : 'ok';
  }

  var api = {
    homeAuditor: function (p, me, env) {
      var r = resolveLoc(p, me, env); if (r.err) return r.err;
      var day = env.day(), critical = env.db.settings.criticalPct;
      var today = env.audits().filter(function (a) { return a.locationId === r.loc.id && a.day === day; });
      var departments = env.db.departments.filter(function (d) { return d.locationId === r.loc.id; }).map(function (d) {
        var s = sumAudits(today.filter(function (a) { return a.departmentId === d.id; }));
        var norm = env.db.norms.filter(function (n) { return n.departmentId === d.id; })[0];
        var target = norm ? norm.sampleTarget : null;
        return { id: d.id, name: d.name, deptTypeName: env.ix.dt[d.deptTypeId].name, audits: s.audits, checked: s.checked,
          rejected: s.rejected, pct: s.pct, sampleTarget: target, status: deptStatus(s, target, critical),
          left: target == null ? null : Math.max(0, target - s.checked) };
      });
      var wishes = env.db.wishes.filter(function (w) { return w.locationId === r.loc.id && w.status === 'open'; })
        .sort(function (a, b) { return (a.priority === 'urgent' ? 0 : 1) - (b.priority === 'urgent' ? 0 : 1) || (a.due < b.due ? -1 : a.due > b.due ? 1 : 0); })
        .map(function (w) {
          return { id: w.id, title: w.title, priority: w.priority, due: w.due, departmentId: w.departmentId,
            departmentName: env.ix.dep[w.departmentId].name, productId: w.productId || null,
            productName: w.productId ? env.ix.prod[w.productId].name : null, orderNo: w.orderNo || null,
            howTo: w.howTo, checklist: w.checklist.slice() };
        });
      var myToday = today.filter(function (a) { return a.auditorId === me.id; }).sort(C.newestFirst).map(function (a) {
        var s = summary(a, env);
        return { id: s.id, createdAt: s.createdAt, departmentName: s.departmentName, checked: s.checked, rejected: s.rejected,
          pct: s.pct, editableUntil: s.editableUntil };
      });
      var t = sumAudits(today);
      return { ok: true, location: { id: r.loc.id, name: r.loc.name }, day: day, criticalPct: critical,
        totals: { audits: t.audits, checked: t.checked, rejected: t.rejected, pct: t.pct },
        departments: departments, wishes: wishes, myToday: myToday };
    },

    auditFormContext: function (p, me, env) {
      var r = resolveLoc(p, me, env); if (r.err) return r.err;
      var db = env.db, day = env.day();
      var deps = db.departments.filter(function (d) { return d.locationId === r.loc.id; });
      var types = {};
      deps.forEach(function (d) { types[d.deptTypeId] = true; });
      var orders = db.orders.filter(function (o) { return o.locationId === r.loc.id && o.firstDay <= day; })
        .sort(function (a, b) { return a.lastDay < b.lastDay ? 1 : a.lastDay > b.lastDay ? -1 : a.no < b.no ? 1 : -1; }).slice(0, 50);
      return { ok: true, location: { id: r.loc.id, name: r.loc.name }, limits: Object.assign({}, C.LIMITS),
        departments: deps.map(function (d) { return { id: d.id, name: d.name, deptTypeId: d.deptTypeId }; }),
        products: db.products.filter(function (x) { return types[x.deptTypeId]; })
          .map(function (x) { return { id: x.id, name: x.name, deptTypeId: x.deptTypeId }; }),
        defectTypes: db.defectTypes.filter(function (x) { return types[x.deptTypeId]; })
          .map(function (x) { return { id: x.id, name: x.name, deptTypeId: x.deptTypeId, severity: x.severity }; }),
        workers: db.workers.filter(function (w) { return w.locationId === r.loc.id; })
          .map(function (w) { return { code: w.code, name: w.name, departmentId: w.departmentId }; }),
        orders: orders.map(function (o) { return { no: o.no, customer: o.customer, lastDay: o.lastDay }; }),
        orderBlocks: db.orderBlocks.filter(function (b) { return b.locationId === r.loc.id; })
          .map(function (b) { return { id: b.id, name: b.name, orders: b.orders.slice() }; }),
        norms: deps.map(function (d) {
          var n = db.norms.filter(function (x) { return x.departmentId === d.id; })[0];
          var done = env.audits().filter(function (a) { return a.departmentId === d.id && a.day === day; });
          return { departmentId: d.id, sampleTarget: n ? n.sampleTarget : null, todayChecked: sumAudits(done).checked };
        }) };
    },

    auditListMine: function (p, me, env) {
      var list = inPeriod(env.audits().filter(function (a) { return a.auditorId === me.id; }), env, p.period);
      return { ok: true, total: list.length, items: page(list, p).map(function (a) { return summary(a, env); }) };
    },

    auditListLocation: function (p, me, env) {
      var r = resolveLoc(p, me, env); if (r.err) return r.err;
      var q = String(p.search || '').trim().toLowerCase();
      var list = inPeriod(env.audits().filter(function (a) {
        if (a.locationId !== r.loc.id || (p.departmentId && a.departmentId !== p.departmentId)) return false;
        if (!q) return true;
        var hay = [a.id].concat(a.orders, a.checkedWorkers, a.items.map(function (i) { return nm(env.ix.prod, i.productId, NO_PROD); }));
        return hay.some(function (s) { return String(s).toLowerCase().indexOf(q) >= 0; });
      }), env, p.period);
      var bad = list.filter(function (a) { return C.rejectedOf(a) > 0; });
      var shown = p.onlyDefects ? bad : list;
      return { ok: true, total: shown.length, counts: { all: list.length, withDefects: bad.length },
        items: page(shown, p).map(function (a) { return summary(a, env); }) };
    },

    auditGet: function (p, me, env) {
      var a = env.audits().filter(function (x) { return x.id === p.id; })[0];
      if (!a) return C.fail('not_found', 'Аудит не знайдено.');
      if (!C.hasLoc(me, a.locationId)) return C.forbidden();
      var audit = summary(a, env), ix = env.ix;
      audit.comment = a.comment || '';
      audit.noDefects = !!a.noDefects;
      audit.checkedWorkers = a.checkedWorkers.map(function (c) { return { code: c, name: c === '' ? NO_WORKER : nm(ix.worker, a.locationId + ':' + c, c) }; });
      audit.items = a.items.map(function (i) {
        return { productId: i.productId, productName: nm(ix.prod, i.productId, NO_PROD), orderNo: i.orderNo, qty: i.qty, rejected: i.rejected,
          rejectedInput: i.rejectedGiven === false ? null : i.rejected };
      });
      audit.defects = [];
      a.defects.forEach(function (d) {
        var srcId = d.departmentId || a.departmentId;
        d.guilty.forEach(function (g) {
          audit.defects.push({ productId: d.productId, productName: nm(ix.prod, d.productId, NO_PROD), orderNo: d.orderNo,
            defectTypeId: d.defectTypeId, defectTypeName: nm(ix.def, d.defectTypeId, NO_DEF), severity: ix.def[d.defectTypeId] ? ix.def[d.defectTypeId].severity : null,
            workerCode: g.workerCode, workerName: g.workerCode === '' ? NO_WORKER : nm(ix.worker, a.locationId + ':' + g.workerCode, g.workerCode),
            qty: g.qty, photo: d.photo || null,
            departmentId: srcId, departmentName: nm(ix.dep, srcId, srcId), otherDept: srcId !== a.departmentId });
        });
      });
      audit.canEdit = me.can.editOthersAudits || (a.auditorId === me.id && audit.editableUntil !== null);
      return { ok: true, audit: audit };
    }
  };

  P.demoReadApi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
