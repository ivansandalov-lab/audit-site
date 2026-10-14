(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, S = P.demoSenior;
  var KEY_TRASH = 'demo:sr:hist:trash';
  var TRASH_DAYS = 30, MAX_REASON = 300;
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  function nm(map, id, fb) { return map[id] ? map[id].name : fb; }
  function lv0() { return { fix: 0, repair: 0, scrap: 0 }; }
  function lvOf(env, typeId) { var t = env.ix.def[typeId]; return (t && t.level) || 'fix'; }
  function workerName(env, locId, code) { return code === '' ? 'Невідомий працівник' : nm(env.ix.worker, locId + ':' + code, code); }
  function trashLive(env) {
    var edge = new Date(env.now().getTime() - TRASH_DAYS * 86400000).toISOString();
    return S.get(env, KEY_TRASH, []).filter(function (t) { return t.deletedAt >= edge; });
  }

  function matches(env, a, f) {
    var ix = env.ix;
    if (f.auditorId && a.auditorId !== f.auditorId) return false;
    if (f.orderNo && a.orders.indexOf(f.orderNo) < 0) return false;
    if (f.product && !a.items.some(function (i) { return nm(ix.prod, i.productId, '') === f.product; })) return false;
    if (f.workerCode && a.checkedWorkers.indexOf(f.workerCode) < 0 &&
      !a.defects.some(function (d) { return d.guilty.some(function (g) { return g.workerCode === f.workerCode; }); })) return false;
    if (f.search) {
      var hay = [a.id].concat(a.orders, a.checkedWorkers,
        a.items.map(function (i) { return nm(ix.prod, i.productId, ''); }),
        a.checkedWorkers.map(function (c) { return workerName(env, a.locationId, c); }),
        a.defects.reduce(function (o, d) { return o.concat(d.guilty.map(function (g) { return g.workerCode; })); }, []));
      if (!hay.some(function (s) { return String(s).toLowerCase().indexOf(f.search) >= 0; })) return false;
    }
    return true;
  }
  function modeOk(env, a, mode) {
    if (!mode) return true;
    var rej = C.rejectedOf(a);
    if (mode === 'defects') return rej > 0;
    if (mode === 'clean') return !rej;
    return C.pct(rej, C.checkedOf(a)) > env.db.settings.criticalPct;   // 'over'
  }
  function defectPieces(env, a, name) {
    return a.defects.reduce(function (s, d) { return s + (nm(env.ix.def, d.defectTypeId, '') === name ? S.pieces(d) : 0); }, 0);
  }
  function dayRange(p, from, to) {
    var a = DAY_RE.test(p.dayFrom || '') ? p.dayFrom : '', b = DAY_RE.test(p.dayTo || '') ? p.dayTo : '';
    if (!a && !b && DAY_RE.test(p.day || '')) a = b = p.day;
    if (!a && !b) return null;
    a = a || b; b = b || a;
    if (a > b) { var t = a; a = b; b = t; }
    if (b < from || a > to) return null;
    return { from: a < from ? from : a, to: b > to ? to : b };
  }

  function row(env, a, defect) {
    var ix = env.ix, checked = C.checkedOf(a), rejected = C.rejectedOf(a), au = ix.user[a.auditorId];
    var o = { id: a.id, createdAt: a.createdAt, day: a.day, departmentId: a.departmentId, departmentName: nm(ix.dep, a.departmentId, a.departmentId),
      auditorName: au ? au.name : a.auditorId, auditorRole: au ? au.role : null,
      items: a.items.map(function (i) { return { productName: nm(ix.prod, i.productId, 'Невідомий виріб'), orderNo: i.orderNo || null }; }),
      checked: checked, rejected: rejected, pct: C.pct(rejected, checked), over: C.pct(rejected, checked) > env.db.settings.criticalPct,
      photos: a.defects.reduce(function (n, d) { return n + (Array.isArray(d.photos) && d.photos.length ? d.photos.length : d.photo ? 1 : 0); }, 0), hasComment: !!a.comment, edited: !!a.updatedAt };
    if (defect) o.defectPieces = defectPieces(env, a, defect);
    return o;
  }

  var api = {
    srHistory: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var loc = r.loc, ix = env.ix, today = env.day(), crit = env.db.settings.criticalPct;
      var to = DAY_RE.test(p.to || '') && p.to <= today ? p.to : today;
      var from = DAY_RE.test(p.from || '') && p.from <= to ? p.from : S.addDays(to, -29);
      if (from < S.addDays(to, -365)) from = S.addDays(to, -365);   // не довше року — як в аналітиці (інакше відповідь на мегабайти)
      var rng = dayRange(p, from, to);
      var deps = env.db.departments.filter(function (d) { return d.locationId === loc.id; });
      var pick = (Array.isArray(p.departments) ? p.departments : []).filter(function (id) { return ix.dep[id] && ix.dep[id].locationId === loc.id; });
      var f = { auditorId: p.auditorId || '', orderNo: p.orderNo || '', product: p.product || '', defect: p.defect || '', workerCode: p.workerCode || '',
        mode: { defects: 1, clean: 1, over: 1 }[p.mode] ? p.mode : '', search: String(p.search || '').trim().toLowerCase().slice(0, 100) };
      function inRange(a) { return !rng || (a.day >= rng.from && a.day <= rng.to); }
      function counted(a) {
        var o = { pieces: 0, levels: lv0(), has: !f.defect };
        a.defects.forEach(function (d) {
          if (f.defect && nm(ix.def, d.defectTypeId, '') !== f.defect) return;
          var q = S.pieces(d); o.pieces += q; o.levels[lvOf(env, d.defectTypeId)] += q; o.has = true;
        });
        if (!f.defect) o.pieces = C.rejectedOf(a);
        return o;
      }

      var period = env.audits().filter(function (a) { return a.locationId === loc.id && a.day >= from && a.day <= to; }).sort(C.newestFirst);
      var inDeps = period.filter(function (a) { return !pick.length || pick.indexOf(a.departmentId) >= 0; });
      var noMode = inDeps.filter(function (a) { return matches(env, a, f); });
      var base = noMode.filter(function (a) { return modeOk(env, a, f.mode); });   // «вибірка»: без виду браку й без днів
      var sel = base.filter(inRange);                                               // «вибірка в днях»
      var found = [];                                                               // «знайдені»: + вид браку

      var perDay = {};
      base.forEach(function (a) {
        var d = perDay[a.day] = perDay[a.day] || { audits: 0, matched: 0, checked: 0, rejected: 0, levels: lv0() }, c = counted(a);
        d.audits++; d.checked += C.checkedOf(a);
        if (!c.has) return;
        d.matched++; d.rejected += c.pieces;
        S.LEVELS.forEach(function (k) { d.levels[k] += c.levels[k]; });
      });
      var days = [], workDays = 0;
      for (var d = from; d <= to; d = S.addDays(d, 1)) {
        if (P.demoDates.dow(d) !== 0 && (!rng || (d >= rng.from && d <= rng.to))) workDays++;
        var x = perDay[d];
        days.push({ day: d, audited: !!x, audits: x ? x.audits : 0, matched: x ? x.matched : 0, checked: x ? x.checked : 0,
          rejected: x ? x.rejected : 0, levels: x ? x.levels : lv0() });
      }

      var sum = { checked: 0, rejected: 0, over: 0, days: {} }, levels = lv0(), allLevels = lv0(), allRejected = 0, types = {}, defLevels = {};
      sel.forEach(function (a) {
        var c = counted(a);
        sum.checked += C.checkedOf(a); allRejected += C.rejectedOf(a);
        a.defects.forEach(function (df) {
          var q = S.pieces(df), src = S.sourceDept(a, df), k = df.defectTypeId;
          allLevels[lvOf(env, k)] += q;
          var t = types[k] = types[k] || { id: k, name: nm(ix.def, k, 'Невідомий вид браку'), level: lvOf(env, k), pieces: 0, otherDepts: [] };
          t.pieces += q;
          if (src !== a.departmentId) { var dn = nm(ix.dep, src, src); if (t.otherDepts.indexOf(dn) < 0) t.otherDepts.push(dn); }
          if (f.defect && t.name === f.defect) defLevels[t.level] = 1;
        });
        if (!c.has) return;
        found.push(a);
        sum.rejected += c.pieces; sum.days[a.day] = 1;
        S.LEVELS.forEach(function (k) { levels[k] += c.levels[k]; });
        if (C.pct(C.rejectedOf(a), C.checkedOf(a)) > crit) sum.over++;
      });

      var typeIds = {}; deps.forEach(function (x) { typeIds[x.deptTypeId] = 1; });
      function names(list) { var o = []; list.forEach(function (x) { if (typeIds[x.deptTypeId] && o.indexOf(x.name) < 0) o.push(x.name); }); return o.sort(); }
      var auditorIds = {}; env.audits().forEach(function (a) { if (a.locationId === loc.id) auditorIds[a.auditorId] = 1; });
      var limit = Math.min(500, Math.max(1, parseInt(p.limit, 10) || 50));
      var lvKeys = Object.keys(defLevels);

      return { ok: true, from: from, to: to, dayFrom: rng ? rng.from : null, dayTo: rng ? rng.to : null, criticalPct: crit,
        departments: deps.map(function (x) { return { id: x.id, name: x.name, count: period.filter(function (a) { return a.departmentId === x.id; }).length }; }),
        total: found.length, base: inDeps.length, over: sum.over,
        analytics: { audits: found.length, selAudits: sel.length, modeTotal: noMode.filter(inRange).length,
          daysWithAudits: Object.keys(sum.days).length, workDays: workDays, checked: sum.checked, rejected: sum.rejected,
          pct: C.pct(sum.rejected, sum.checked), over: sum.over, levels: levels, allLevels: allLevels, allRejected: allRejected, days: days,
          defect: f.defect ? { name: f.defect, level: lvKeys.length === 1 ? lvKeys[0] : null, pieces: sum.rejected, audits: found.length } : null,
          types: Object.keys(types).map(function (k) { return types[k]; }).sort(function (a, b) { return b.pieces - a.pieces || (a.name < b.name ? -1 : 1); }) },
        items: found.slice(0, limit).map(function (a) { return row(env, a, f.defect); }),
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
      if (!a) return C.fail('not_found', 'Аудит не знайдено.');
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
      if (!t) return C.fail('not_found', 'Такого аудиту в корзині немає.');
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
