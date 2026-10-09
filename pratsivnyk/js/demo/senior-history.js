(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, S = P.demoSenior;
  var KEY_TRASH = 'demo:sr:hist:trash';
  var TRASH_DAYS = 30, MAX_REASON = 300;
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  function nm(map, id, fb) { return map[id] ? map[id].name : fb; }
  function lvOf(env, typeId) { var t = env.ix.def[typeId]; return (t && t.level) || 'fix'; }
  function pcsOf(a) { return a.defects.reduce(function (s, d) { return s + S.pieces(d); }, 0); }
  function workerName(env, locId, code) { return code === '' ? 'Невідомий працівник' : nm(env.ix.worker, locId + ':' + code, code); }
  function trashLive(env) {
    var edge = new Date(env.now().getTime() - TRASH_DAYS * 86400000).toISOString();
    return S.get(env, KEY_TRASH, []).filter(function (t) { return t.deletedAt >= edge; });
  }

  function matches(env, a, f) {
    var ix = env.ix, crit = env.db.settings.criticalPct;
    if (f.auditorId && a.auditorId !== f.auditorId) return false;
    if (f.orderNo && a.orders.indexOf(f.orderNo) < 0) return false;
    if (f.product && !a.items.some(function (i) { return nm(ix.prod, i.productId, '') === f.product; })) return false;
    if (f.defect && !a.defects.some(function (d) { return nm(ix.def, d.defectTypeId, '') === f.defect; })) return false;
    if (f.workerCode && a.checkedWorkers.indexOf(f.workerCode) < 0 &&
      !a.defects.some(function (d) { return d.guilty.some(function (g) { return g.workerCode === f.workerCode; }); })) return false;
    var rej = C.rejectedOf(a), pct = C.pct(rej, C.checkedOf(a));
    if (f.mode === 'defects' && !rej) return false;
    if (f.mode === 'clean' && rej) return false;
    if (f.mode === 'over' && !(pct > crit)) return false;
    if (f.search) {
      var hay = [a.id].concat(a.orders, a.checkedWorkers,
        a.items.map(function (i) { return nm(ix.prod, i.productId, ''); }),
        a.checkedWorkers.map(function (c) { return workerName(env, a.locationId, c); }),
        a.defects.reduce(function (o, d) { return o.concat(d.guilty.map(function (g) { return g.workerCode; })); }, []));
      if (!hay.some(function (s) { return String(s).toLowerCase().indexOf(f.search) >= 0; })) return false;
    }
    return true;
  }

  function row(env, a) {
    var ix = env.ix, checked = C.checkedOf(a), rejected = C.rejectedOf(a), au = ix.user[a.auditorId];
    return { id: a.id, createdAt: a.createdAt, day: a.day, departmentId: a.departmentId, departmentName: nm(ix.dep, a.departmentId, a.departmentId),
      auditorName: au ? au.name : a.auditorId, auditorRole: au ? au.role : null,
      items: a.items.map(function (i) { return { productName: nm(ix.prod, i.productId, 'Невідомий виріб'), orderNo: i.orderNo || null }; }),
      checked: checked, rejected: rejected, pct: C.pct(rejected, checked), over: C.pct(rejected, checked) > env.db.settings.criticalPct,
      photos: a.defects.filter(function (d) { return !!d.photo; }).length, hasComment: !!a.comment, edited: !!a.updatedAt };
  }

  var api = {
    srHistory: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var loc = r.loc, ix = env.ix, today = env.day(), crit = env.db.settings.criticalPct;
      var to = DAY_RE.test(p.to || '') && p.to <= today ? p.to : today;
      var from = DAY_RE.test(p.from || '') && p.from <= to ? p.from : S.addDays(to, -29);
      if (DAY_RE.test(p.day || '')) { from = p.day; to = p.day; }
      var deps = env.db.departments.filter(function (d) { return d.locationId === loc.id; });
      var pick = (Array.isArray(p.departments) ? p.departments : []).filter(function (id) { return ix.dep[id] && ix.dep[id].locationId === loc.id; });
      var f = { auditorId: p.auditorId || '', orderNo: p.orderNo || '', product: p.product || '', defect: p.defect || '', workerCode: p.workerCode || '',
        mode: { defects: 1, clean: 1, over: 1 }[p.mode] ? p.mode : '', search: String(p.search || '').trim().toLowerCase().slice(0, 100) };

      var period = env.audits().filter(function (a) { return a.locationId === loc.id && a.day >= from && a.day <= to; }).sort(C.newestFirst);
      var inDeps = period.filter(function (a) { return !pick.length || pick.indexOf(a.departmentId) >= 0; });
      var found = inDeps.filter(function (a) { return matches(env, a, f); });

      var sum = { checked: 0, rejected: 0, over: 0, days: {} }, levels = { fix: 0, repair: 0, scrap: 0 }, types = {}, perDay = {};
      found.forEach(function (a) {
        var c = C.checkedOf(a), rj = C.rejectedOf(a);
        sum.checked += c; sum.rejected += rj; sum.days[a.day] = 1;
        if (C.pct(rj, c) > crit) sum.over++;
        perDay[a.day] = perDay[a.day] || { rejected: 0, audits: 0 };
        perDay[a.day].rejected += rj; perDay[a.day].audits++;
        a.defects.forEach(function (d) {
          var q = S.pieces(d), src = S.sourceDept(a, d), k = d.defectTypeId;
          levels[lvOf(env, k)] += q;
          var t = types[k] = types[k] || { id: k, name: nm(ix.def, k, 'Невідомий вид браку'), level: lvOf(env, k), pieces: 0, otherDepts: [] };
          t.pieces += q;
          if (src !== a.departmentId) { var dn = nm(ix.dep, src, src); if (t.otherDepts.indexOf(dn) < 0) t.otherDepts.push(dn); }
        });
      });
      var days = [], workDays = 0;
      for (var d = from; d <= to; d = S.addDays(d, 1)) {
        if (P.demoDates.dow(d) !== 0) workDays++;
        days.push({ day: d, audited: !!perDay[d], rejected: perDay[d] ? perDay[d].rejected : 0, audits: perDay[d] ? perDay[d].audits : 0 });
      }

      var typeIds = {}; deps.forEach(function (x) { typeIds[x.deptTypeId] = 1; });
      function names(list) { var o = []; list.forEach(function (x) { if (typeIds[x.deptTypeId] && o.indexOf(x.name) < 0) o.push(x.name); }); return o.sort(); }
      var auditorIds = {}; env.audits().forEach(function (a) { if (a.locationId === loc.id) auditorIds[a.auditorId] = 1; });
      var limit = Math.min(500, Math.max(1, parseInt(p.limit, 10) || 50));

      return { ok: true, from: from, to: to, criticalPct: crit,
        departments: deps.map(function (x) { return { id: x.id, name: x.name, count: period.filter(function (a) { return a.departmentId === x.id; }).length }; }),
        total: found.length, base: inDeps.length, over: sum.over,
        analytics: { audits: found.length, daysWithAudits: Object.keys(sum.days).length, workDays: workDays, checked: sum.checked, rejected: sum.rejected,
          pct: C.pct(sum.rejected, sum.checked), over: sum.over, levels: levels, days: days,
          types: Object.keys(types).map(function (k) { return types[k]; }).sort(function (a, b) { return b.pieces - a.pieces || (a.name < b.name ? -1 : 1); }) },
        items: found.slice(0, limit).map(function (a) { return row(env, a); }),
        options: { products: names(env.db.products), defects: names(env.db.defectTypes),
          workers: env.db.workers.filter(function (w) { return w.locationId === loc.id; }).map(function (w) { return { code: w.code, name: w.name }; })
            .sort(function (a, b) { return a.code < b.code ? -1 : 1; }),
          auditors: env.db.users.filter(function (u) { return auditorIds[u.id] || ((u.role === 'auditor' || u.role === 'senior_auditor') && u.locationIds.indexOf(loc.id) >= 0); })
            .map(function (u) { return { id: u.id, name: u.name }; }) },
        trash: trashLive(env).filter(function (t) { return t.locationId === loc.id; }).sort(function (a, b) { return a.deletedAt < b.deletedAt ? 1 : -1; })
          .map(function (t) { return { id: t.id, deletedAt: t.deletedAt, reason: t.reason, byName: nm(ix.user, t.by, t.by), audit: t.audit }; }) };
    },

    srAuditDelete: function (p, me, env) {
      if (!S.canManage(me)) return C.forbidden();
      var a = env.audits().filter(function (x) { return x.id === p.id; })[0];
      if (!a) return C.fail('not_found', 'Аудит не знайдено — можливо, його вже видалили.');
      if (!C.hasLoc(me, a.locationId)) return C.forbidden();
      var reason = String(p.reason || '').trim();
      if (reason.length > MAX_REASON) return C.fail('validation', 'Причина задовга.', [{ field: 'reason', message: 'Напишіть коротше — до ' + MAX_REASON + ' знаків.' }]);
      var names = [];
      a.items.forEach(function (i) { var n = nm(env.ix.prod, i.productId, 'Невідомий виріб'); if (names.indexOf(n) < 0) names.push(n); });
      var trash = S.get(env, KEY_TRASH, []).filter(function (t) { return t.id !== a.id; });
      var entry = { id: a.id, locationId: a.locationId, deletedAt: env.now().toISOString(), by: me.id, reason: reason,
        audit: { day: a.day, createdAt: a.createdAt, departmentName: nm(env.ix.dep, a.departmentId, a.departmentId),
          auditorName: nm(env.ix.user, a.auditorId, a.auditorId), products: names, checked: C.checkedOf(a), rejected: C.rejectedOf(a) } };
      trash.push(entry);
      S.set(env, KEY_TRASH, trash);
      env.reload();
      return { ok: true, id: a.id, deletedAt: entry.deletedAt, trashCount: trashLive(env).filter(function (t) { return t.locationId === a.locationId; }).length };
    },

    srHistReload: function (p, me, env) { env.reload(); return { ok: true }; },

    srAuditRestore: function (p, me, env) {
      if (!S.canManage(me)) return C.forbidden();
      var t = trashLive(env).filter(function (x) { return x.id === p.id; })[0];
      if (!t) return C.fail('not_found', 'Такого аудиту в корзині немає — можливо, його вже повернули або минуло 30 днів.');
      if (!C.hasLoc(me, t.locationId)) return C.forbidden();
      S.set(env, KEY_TRASH, S.get(env, KEY_TRASH, []).filter(function (x) { return x.id !== p.id; }));
      env.reload();
      return { ok: true, id: p.id };
    }
  };

  P.demoApis.push(api);
  P.demoLoadHooks.push(function (db, ctx) {
    var gone = {};
    ctx.storage.get(KEY_TRASH, []).forEach(function (t) { gone[t.id] = 1; });
    db.audits = db.audits.filter(function (a) { return !gone[a.id]; });
  });
  P.demoResetKeys.push(KEY_TRASH);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
