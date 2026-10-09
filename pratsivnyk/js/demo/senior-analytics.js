(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, S = P.demoSenior;
  var LV = ['fix', 'repair', 'scrap'];
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  function nm(map, id, fb) { return map[id] ? map[id].name : fb; }
  function lv0() { return { fix: 0, repair: 0, scrap: 0 }; }
  function lvOf(env, typeId) { var t = env.ix.def[typeId]; return (t && t.level) || 'fix'; }
  function pcsOf(a) { return a.defects.reduce(function (s, d) { return s + S.pieces(d); }, 0); }
  function share(o, k) { var t = o.fix + o.repair + o.scrap; return t ? Math.round(o[k] / t * 100) : 0; }
  function daysOf(from, to) { var out = []; for (var d = from; d <= to; d = S.addDays(d, 1)) out.push(d); return out; }
  function byPiecesDesc(a, b) { return b.pieces - a.pieces || (a.name < b.name ? -1 : 1); }
  function locAudits(env, locId, from, to) {
    return S.audits(env, locId, from, to).sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0; });
  }

  function range(p, env) {
    var today = env.day(), to = DAY_RE.test(p.to || '') && p.to <= today ? p.to : today;
    var from = DAY_RE.test(p.from || '') && p.from <= to ? p.from : S.addDays(to, -29);
    if (from < S.addDays(to, -365)) from = S.addDays(to, -365);
    return { from: from, to: to };
  }
  function depsOf(env, locId) { return env.db.departments.filter(function (d) { return d.locationId === locId; }); }
  function normOf(env, depId) { var n = env.db.norms.filter(function (x) { return x.departmentId === depId; })[0]; return n ? n.sampleTarget : null; }
  function levelsOf(env, list, depId) {
    var o = lv0();
    list.forEach(function (a) { a.defects.forEach(function (d) { if (!depId || S.sourceDept(a, d) === depId) o[lvOf(env, d.defectTypeId)] += S.pieces(d); }); });
    return o;
  }
  function totalsOf(list) {
    var c = 0, r = 0;
    list.forEach(function (a) { c += C.checkedOf(a); r += pcsOf(a); });
    return { checked: c, rejected: r, pct: C.pct(r, c) };
  }
  function auditRow(env, a) {
    var names = [];
    a.items.forEach(function (i) { var n = nm(env.ix.prod, i.productId, 'Невідомий виріб'); if (names.indexOf(n) < 0) names.push(n); });
    return { id: a.id, createdAt: a.createdAt, day: a.day, departmentId: a.departmentId, departmentName: nm(env.ix.dep, a.departmentId, a.departmentId),
      auditorName: nm(env.ix.user, a.auditorId, a.auditorId), orders: a.orders.slice(), products: names,
      checked: C.checkedOf(a), rejected: pcsOf(a), pct: C.pct(pcsOf(a), C.checkedOf(a)) };
  }
  function workerName(env, locId, code) { return code === '' ? 'Невідомий працівник' : nm(env.ix.worker, locId + ':' + code, code); }

  var api = {
    srAnalytics: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var loc = r.loc, rg = range(p, env), today = env.day(), crit = env.db.settings.criticalPct;
      var deps = depsOf(env, loc.id), all = locAudits(env, loc.id);
      var list = all.filter(function (a) { return a.day >= rg.from && a.day <= rg.to; });

      var tday = all.filter(function (a) { return a.day === today; }), sum = { checked: 0, rejected: 0, none: 0, done: 0 };
      var tdeps = deps.map(function (d) {
        var st = S.deptStats(env, tday, d.id), mine = tday.filter(function (a) { return a.departmentId === d.id; });
        var before = all.filter(function (a) { return a.departmentId === d.id && a.day < today; });
        var target = normOf(env, d.id);
        sum.checked += st.checked; sum.rejected += st.rejected;
        if (!mine.length) sum.none++;
        if (target != null && st.checked >= target) sum.done++;
        return { id: d.id, name: d.name, audits: mine.length, checked: st.checked, target: target, rejected: st.rejected, pct: C.pct(st.rejected, st.checked),
          lastTodayAt: mine.length ? mine[mine.length - 1].createdAt : null, lastDay: before.length ? before[before.length - 1].day : null };
      });

      var days = daysOf(rg.from, rg.to).map(function (day) {
        var dl = list.filter(function (a) { return a.day === day; }), t = totalsOf(dl);
        return { day: day, audits: dl.length, checked: t.checked, rejected: t.rejected, pct: t.pct, levels: levelsOf(env, dl) };
      });

      var span = days.length, pFrom = S.addDays(rg.from, -span), pTo = S.addDays(rg.from, -1);
      var prev = all.filter(function (a) { return a.day >= pFrom && a.day <= pTo; });
      var levels = { total: levelsOf(env, list), prev: levelsOf(env, prev), prevFrom: pFrom, prevTo: pTo,
        depts: deps.map(function (d) { return { id: d.id, name: d.name, levels: levelsOf(env, list, d.id), prev: levelsOf(env, prev, d.id) }; }) };

      var types = {};
      list.forEach(function (a) {
        a.defects.forEach(function (d) {
          var t = types[d.defectTypeId] = types[d.defectTypeId] || { id: d.defectTypeId, name: nm(env.ix.def, d.defectTypeId, 'Невідомий вид браку'),
            level: lvOf(env, d.defectTypeId), pieces: 0, dep: {} };
          var q = S.pieces(d), src = S.sourceDept(a, d);
          t.pieces += q; t.dep[src] = (t.dep[src] || 0) + q;
        });
      });
      var top = Object.keys(types).map(function (k) {
        var t = types[k];
        t.depts = Object.keys(t.dep).sort(function (x, y) { return t.dep[y] - t.dep[x]; }).map(function (id) { return nm(env.ix.dep, id, id); });
        delete t.dep; return t;
      }).sort(byPiecesDesc);

      var nos = {};
      list.forEach(function (a) { a.orders.forEach(function (no) { if (no) nos[no] = nos[no] && nos[no] > a.day ? nos[no] : a.day; }); });
      var orders = env.db.orders.filter(function (o) { return o.locationId === loc.id && nos[o.no]; }).map(function (o) {
        var v = orderViews(env, loc, o, all, deps), cells = {};
        deps.forEach(function (d) { var x = v.views[d.id]; cells[d.id] = x.audits ? { checked: x.checked, plan: x.plan, planPct: x.planPct, rejected: x.rejected, pct: x.pct } : null; });
        return { no: o.no, customer: o.customer, products: v.products, lastAuditDay: nos[o.no], cells: cells };
      }).sort(function (a, b) { return a.lastAuditDay < b.lastAuditDay ? 1 : a.lastAuditDay > b.lastAuditDay ? -1 : a.no < b.no ? 1 : -1; });

      return { ok: true, location: { id: loc.id, name: loc.name }, from: rg.from, to: rg.to, today: today, asOf: env.now().toISOString(), criticalPct: crit,
        departments: deps.map(function (d) { return { id: d.id, name: d.name }; }),
        todayDepts: tdeps, todayAll: { checked: sum.checked, rejected: sum.rejected, pct: C.pct(sum.rejected, sum.checked), none: sum.none, done: sum.done },
        days: days, levels: levels, top: { pieces: top.reduce(function (s, t) { return s + t.pieces; }, 0), types: top }, orders: orders };
    },

    srDeptDay: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var dep = env.ix.dep[p.departmentId];
      if (!dep || dep.locationId !== r.loc.id) return C.fail('not_found', 'Відділ не знайдено.');
      var today = env.day(), all = locAudits(env, r.loc.id), tday = all.filter(function (a) { return a.day === today; });
      var st = S.deptStats(env, tday, dep.id), types = {}, others = {};
      tday.forEach(function (a) {
        a.defects.forEach(function (d) {
          var src = S.sourceDept(a, d), q = S.pieces(d);
          if (src === dep.id) {
            var t = types[d.defectTypeId] = types[d.defectTypeId] || { id: d.defectTypeId, name: nm(env.ix.def, d.defectTypeId, 'Невідомий вид браку'), level: lvOf(env, d.defectTypeId), pieces: 0, workers: [], auditId: a.id };
            t.pieces += q;
            d.guilty.forEach(function (g) { var w = { code: g.workerCode, name: workerName(env, a.locationId, g.workerCode) }; if (!t.workers.some(function (x) { return x.code === w.code; })) t.workers.push(w); });
          } else if (a.departmentId === dep.id) {
            var k = src + '|' + d.defectTypeId;
            others[k] = others[k] || { departmentName: nm(env.ix.dep, src, src), typeName: nm(env.ix.def, d.defectTypeId, 'Невідомий вид браку'), pieces: 0 };
            others[k].pieces += q;
          }
        });
      });
      var m30 = all.filter(function (a) { return a.day >= S.addDays(today, -29); });
      return { ok: true, department: { id: dep.id, name: dep.name }, day: today, asOf: env.now().toISOString(), criticalPct: env.db.settings.criticalPct,
        target: normOf(env, dep.id), checked: st.checked, rejected: st.rejected, pct: C.pct(st.rejected, st.checked),
        audits: tday.filter(function (a) { return a.departmentId === dep.id; }).sort(C.newestFirst).map(function (a) { return auditRow(env, a); }),
        types: Object.keys(types).map(function (k) { return types[k]; }).sort(byPiecesDesc),
        others: Object.keys(others).map(function (k) { return others[k]; }),
        month: levelsOf(env, m30, dep.id), shopMonth: levelsOf(env, m30) };
    },

    srDefect: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var type = env.ix.def[p.defectTypeId], deps = depsOf(env, r.loc.id);
      if (!type || !deps.some(function (d) { return d.deptTypeId === type.deptTypeId; })) return C.fail('not_found', 'Такого виду браку в цій локації немає.');
      var rg = range(p, env), list = locAudits(env, r.loc.id, rg.from, rg.to);
      var perType = {}, perDay = {}, audited = {}, dep = {}, wk = {}, prod = {}, rows = [];
      list.forEach(function (a) {
        audited[a.day] = true;
        a.defects.forEach(function (d) {
          var q = S.pieces(d);
          perType[d.defectTypeId] = (perType[d.defectTypeId] || 0) + q;
          if (d.defectTypeId !== type.id) return;
          var src = S.sourceDept(a, d), pn = nm(env.ix.prod, d.productId, 'Невідомий виріб');
          perDay[a.day] = (perDay[a.day] || 0) + q;
          dep[src] = (dep[src] || 0) + q;
          prod[pn] = (prod[pn] || 0) + q;
          d.guilty.forEach(function (g) {
            wk[g.workerCode] = wk[g.workerCode] || { code: g.workerCode, name: workerName(env, a.locationId, g.workerCode), pieces: 0 };
            wk[g.workerCode].pieces += g.qty || 0;
            rows.push({ auditId: a.id, createdAt: a.createdAt, day: a.day, departmentName: nm(env.ix.dep, src, src), otherDept: src !== a.departmentId,
              productName: pn, orderNo: d.orderNo || null, workerCode: g.workerCode, workerName: workerName(env, a.locationId, g.workerCode), qty: g.qty || 0 });
          });
        });
      });
      var ranked = Object.keys(perType).sort(function (x, y) { return perType[y] - perType[x]; });
      var pieces = perType[type.id] || 0, allPieces = Object.keys(perType).reduce(function (s, k) { return s + perType[k]; }, 0);
      rows.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0; });
      return { ok: true, from: rg.from, to: rg.to, type: { id: type.id, name: type.name, level: type.level || 'fix' },
        rank: pieces ? ranked.indexOf(type.id) + 1 : null, typesCount: ranked.length, pieces: pieces, allPieces: allPieces, share: C.pct(pieces, allPieces),
        days: daysOf(rg.from, rg.to).map(function (d) { return { day: d, pieces: perDay[d] || 0, audited: !!audited[d] }; }),
        depts: Object.keys(dep).map(function (id) { return { id: id, name: nm(env.ix.dep, id, id), pieces: dep[id] }; }).sort(byPiecesDesc),
        workers: Object.keys(wk).map(function (k) { return wk[k]; }).sort(byPiecesDesc),
        products: Object.keys(prod).map(function (n) { return { name: n, pieces: prod[n] }; }).sort(byPiecesDesc),
        rows: rows };
    },

    srOrder: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var o = env.db.orders.filter(function (x) { return x.no === p.orderNo && x.locationId === r.loc.id; })[0];
      if (!o) return C.fail('not_found', 'Замовлення не знайдено.');
      var deps = depsOf(env, r.loc.id), v = orderViews(env, r.loc, o, locAudits(env, r.loc.id), deps);
      var block = env.db.orderBlocks.filter(function (b) { return b.locationId === r.loc.id && b.orders.indexOf(o.no) >= 0; })[0];
      return { ok: true, order: { no: o.no, customer: o.customer, products: v.products, firstDay: o.firstDay, lastDay: o.lastDay,
        active: o.lastDay >= env.day(), blockName: block ? block.name : null, plan: v.views.all.plan, firstAuditDay: v.firstDay, lastAuditDay: v.lastDay },
        departments: deps.map(function (d) { return { id: d.id, name: d.name, audits: v.views[d.id].audits }; }), views: v.views, criticalPct: env.db.settings.criticalPct };
    },

    srPeopleWorkers: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var rg = range(p, env), list = locAudits(env, r.loc.id, rg.from, rg.to), deps = depsOf(env, r.loc.id), rates = {};
      deps.forEach(function (d) { var st = S.deptStats(env, list, d.id); rates[d.id] = C.pct(st.rejected, st.checked); });
      var workers = env.db.workers.filter(function (w) { return w.locationId === r.loc.id; }).map(function (w) {
        var s = workerStats(env, list, w);
        return { code: w.code, name: w.name, departmentId: w.departmentId, departmentName: nm(env.ix.dep, w.departmentId, ''), active: w.active !== false,
          audits: s.audits, withDefects: s.withDefects, checked: s.checked, pieces: s.pieces, rate: s.rate, levels: s.levels, grade: grade(s, rates[w.departmentId]) };
      }).sort(function (a, b) { return b.pieces - a.pieces || b.audits - a.audits || (a.code < b.code ? -1 : 1); });
      return { ok: true, from: rg.from, to: rg.to, criticalPct: env.db.settings.criticalPct, shopRate: totalsOf(list).pct,
        departments: deps.map(function (d) { return { id: d.id, name: d.name, rate: rates[d.id] }; }), workers: workers,
        auditorsCount: auditorsOf(env, r.loc.id, list).length };
    },

    srPeopleWorker: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var w = env.ix.worker[r.loc.id + ':' + p.code];
      if (!w) return C.fail('not_found', 'Працівника з таким кодом немає.');
      var rg = range(p, env), list = locAudits(env, r.loc.id, rg.from, rg.to), s = workerStats(env, list, w);
      var dst = S.deptStats(env, list, w.departmentId), deptRate = C.pct(dst.rejected, dst.checked);
      var weeks = [];
      for (var d = rg.from; d <= rg.to; d = S.addDays(d, 7)) {
        var end = S.addDays(d, 6) < rg.to ? S.addDays(d, 6) : rg.to, ws = workerStats(env, list.filter(function (a) { return a.day >= d && a.day <= end; }), w);
        weeks.push({ from: d, to: end, checked: ws.checked, pieces: ws.pieces, rate: ws.rate, audits: ws.audits });
      }
      return { ok: true, from: rg.from, to: rg.to, criticalPct: env.db.settings.criticalPct,
        worker: { code: w.code, name: w.name, departmentId: w.departmentId, departmentName: nm(env.ix.dep, w.departmentId, '') },
        audits: s.audits, withDefects: s.withDefects, checked: s.checked, pieces: s.pieces, rate: s.rate, levels: s.levels, grade: grade(s, deptRate),
        deptRate: deptRate, shopRate: totalsOf(list).pct, weeks: weeks, types: s.types };
    },

    srPeopleAuditors: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var rg = range(p, env), list = locAudits(env, r.loc.id, rg.from, rg.to), all = locAudits(env, r.loc.id);
      var workDays = daysOf(rg.from, rg.to).filter(function (d) { return P.demoDates.dow(d) !== 0; }).length;
      var perAuditNorm = {}, dep = {};
      list.forEach(function (a) {
        var x = dep[a.departmentId] = dep[a.departmentId] || { audits: 0, days: {}, by: {} };
        x.audits++; x.days[a.day] = 1;
        var b = x.by[a.auditorId] = x.by[a.auditorId] || { checked: 0, pieces: 0 };
        b.checked += C.checkedOf(a); b.pieces += pcsOf(a);
      });
      Object.keys(dep).forEach(function (id) {
        var n = normOf(env, id), perDay = dep[id].audits / Object.keys(dep[id].days).length;
        perAuditNorm[id] = n == null ? null : n / perDay;
      });
      var auditors = auditorsOf(env, r.loc.id, list).map(function (u) {
        var mine = list.filter(function (a) { return a.auditorId === u.id; }), others = list.filter(function (a) { return a.auditorId !== u.id; });
        var checked = 0, pieces = 0, norm = 0, normKnown = true, expected = 0, clean = 0;
        mine.forEach(function (a) {
          var c = C.checkedOf(a), x = dep[a.departmentId], peers = { checked: 0, pieces: 0 };
          checked += c; pieces += pcsOf(a); if (!pcsOf(a)) clean++;
          if (perAuditNorm[a.departmentId] == null) normKnown = false; else norm += perAuditNorm[a.departmentId];
          Object.keys(x.by).forEach(function (id) { if (id !== u.id) { peers.checked += x.by[id].checked; peers.pieces += x.by[id].pieces; } });
          if (peers.checked) expected += c * peers.pieces / peers.checked;
        });
        var ratio = expected > 0 ? pieces / expected : null;
        var last = all.filter(function (a) { return a.auditorId === u.id; }).pop();
        var peersClean = others.length ? Math.round(others.filter(function (a) { return !pcsOf(a); }).length / others.length * 100) : null;
        return { id: u.id, name: u.name, role: u.role, roleLabel: P.demoDict.roleLabels[u.role], active: u.active !== false,
          audits: mine.length, perDay: workDays ? Math.round(mine.length / workDays * 10) / 10 : null,
          checked: checked, perAudit: mine.length ? Math.round(checked / mine.length) : null,
          normPerAudit: mine.length && normKnown ? Math.round(norm / mine.length) : null,
          sampleRatio: mine.length && normKnown && norm ? Math.round(checked / norm * 10) / 10 : null,
          pieces: pieces, pct: C.pct(pieces, checked), peersPct: checked && expected ? C.pct(expected, checked) : null,
          strict: mine.length < 5 ? 'few' : ratio == null ? 'same' : ratio < 0.75 ? 'low' : ratio > 1.25 ? 'high' : 'same',
          strictRatio: ratio == null ? null : Math.round(ratio * 100) / 100,
          clean: clean, cleanShare: mine.length ? Math.round(clean / mine.length * 100) : null, peersCleanShare: peersClean,
          lastAt: last ? last.createdAt : null };
      }).sort(function (a, b) { return b.audits - a.audits || (a.name < b.name ? -1 : 1); });
      return { ok: true, from: rg.from, to: rg.to, workDays: workDays, totalAudits: list.length, auditors: auditors,
        workersCount: env.db.workers.filter(function (w) { return w.locationId === r.loc.id; }).length };
    }
  };

  function workerStats(env, list, w) {
    var s = { audits: 0, withDefects: 0, checked: 0, pieces: 0, levels: lv0(), types: [] }, types = {};
    list.forEach(function (a) {
      var inChecked = a.checkedWorkers.indexOf(w.code) >= 0, mine = 0;
      a.defects.forEach(function (d) {
        d.guilty.forEach(function (g) {
          if (g.workerCode !== w.code || !g.qty) return;
          mine += g.qty; s.levels[lvOf(env, d.defectTypeId)] += g.qty;
          var t = types[d.defectTypeId] = types[d.defectTypeId] || { id: d.defectTypeId, name: nm(env.ix.def, d.defectTypeId, 'Невідомий вид браку'), level: lvOf(env, d.defectTypeId), pieces: 0 };
          t.pieces += g.qty;
        });
      });
      if (!inChecked && !mine) return;
      s.audits++; if (mine) s.withDefects++;
      s.pieces += mine;
      if (inChecked) s.checked += C.checkedOf(a) / a.checkedWorkers.length;
    });
    s.checked = Math.round(s.checked);
    s.rate = C.pct(s.pieces, s.checked);
    s.types = Object.keys(types).map(function (k) { return types[k]; }).sort(byPiecesDesc);
    return s;
  }

  function grade(s, deptRate) {
    if (s.audits < 3 || s.rate == null) return 'few';
    if (s.rate > S.KD.THRESHOLD) return 'weak';
    if (deptRate != null && s.rate < deptRate) return 'good';
    return 'mid';
  }

  function auditorsOf(env, locId, list) {
    var ids = {};
    list.forEach(function (a) { ids[a.auditorId] = 1; });
    return env.db.users.filter(function (u) {
      return ids[u.id] || ((u.role === 'auditor' || u.role === 'senior_auditor') && u.locationIds.indexOf(locId) >= 0);
    });
  }

  function orderViews(env, loc, o, all, deps) {
    var len = daysOf(o.firstDay, o.lastDay).length, today = env.day(), lastDay = o.lastDay < today ? o.lastDay : today;
    var mine = all.filter(function (a) { return a.orders.indexOf(o.no) >= 0; });
    var products = (o.garments || []).map(function (gi) { return P.demoDict.garments[gi]; });
    var shop = totalsOf(all.filter(function (a) { return a.day >= o.firstDay && a.day <= lastDay; }));
    function view(depId) {
      var v = { audits: 0, checked: 0, rejected: 0, plan: 0, levels: lv0(), days: {}, types: {}, rows: [] };
      deps.forEach(function (d) { if (!depId || d.id === depId) v.plan += (o.daily[d.id] || 0) * len; });
      mine.forEach(function (a) {
        var c = a.departmentId === depId || !depId ? a.items.reduce(function (s, i) { return s + (i.orderNo === o.no ? i.qty : 0); }, 0) : 0, q = 0;
        a.defects.forEach(function (d) {
          if (d.orderNo !== o.no || (depId && S.sourceDept(a, d) !== depId)) return;
          var n = S.pieces(d), k = d.defectTypeId, src = S.sourceDept(a, d);
          q += n; v.levels[lvOf(env, k)] += n;
          var t = v.types[k] = v.types[k] || { id: k, name: nm(env.ix.def, k, 'Невідомий вид браку'), level: lvOf(env, k), pieces: 0, depts: [] };
          t.pieces += n; var dn = nm(env.ix.dep, src, src); if (t.depts.indexOf(dn) < 0) t.depts.push(dn);
        });
        if (!c && !q && depId && a.departmentId !== depId) return;
        var day = v.days[a.day] = v.days[a.day] || { checked: 0, rejected: 0, byDep: {} };
        day.checked += c; day.rejected += q;
        if (q) day.byDep[a.departmentId] = (day.byDep[a.departmentId] || 0) + q;
        v.audits++; v.checked += c; v.rejected += q;
        v.rows.push({ id: a.id, createdAt: a.createdAt, day: a.day, departmentName: nm(env.ix.dep, a.departmentId, a.departmentId),
          auditorName: nm(env.ix.user, a.auditorId, a.auditorId), checked: c, rejected: q, pct: C.pct(q, c) });
      });
      var daysList = daysOf(o.firstDay, lastDay).map(function (d) { var x = v.days[d]; return { day: d, audited: !!x, checked: x ? x.checked : 0, rejected: x ? x.rejected : 0 }; });
      var worst = daysList.filter(function (d) { return d.rejected; }).sort(function (a, b) { return b.rejected - a.rejected; })[0] || null;
      if (worst) { var bd = v.days[worst.day].byDep, top = Object.keys(bd).sort(function (x, y) { return bd[y] - bd[x]; })[0]; worst = Object.assign({ departmentName: nm(env.ix.dep, top, top) }, worst); }
      return { audits: v.audits, checked: v.checked, rejected: v.rejected, pct: C.pct(v.rejected, v.checked), plan: v.plan,
        planPct: v.plan ? Math.round(v.checked / v.plan * 1000) / 10 : null, shopPct: shop.pct, levels: v.levels,
        daysWithAudits: Object.keys(v.days).length, daysTotal: daysList.length, days: daysList, worstDay: worst,
        types: Object.keys(v.types).map(function (k) { return v.types[k]; }).sort(byPiecesDesc), rows: v.rows.sort(C.newestFirst) };
    }
    var views = { all: view(null) };
    deps.forEach(function (d) { views[d.id] = view(d.id); });
    return { products: products, views: views, firstDay: mine.length ? mine[0].day : null, lastDay: mine.length ? mine[mine.length - 1].day : null };
  }

  P.demoApis.push(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
