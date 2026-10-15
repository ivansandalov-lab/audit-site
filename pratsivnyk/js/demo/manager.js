(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, S = P.demoSenior;
  P.demoApis = P.demoApis || []; P.demoResetKeys = P.demoResetKeys || [];
  var LV = ['fix', 'repair', 'scrap'], KEY = 'demo:mgr:reports';
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/, MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/, TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  var MONTHS_BACK = 12;   // за скільки місяців (разом з поточним) можна взяти звіт
  var MONTH_TOP = 10;     // скільки видів браку відділу у звіті за місяць
  var KINDS = ['seniorsWeekly', 'kdStale', 'deptNoAudits', 'normMiss', 'relapse', 'monthly'];
  var DEFAULTS = { seniorsWeekly: { on: true, day: 5, time: '12:00' }, kdStale: { on: true, days: 7 }, deptNoAudits: { on: true, days: 2 },
    normMiss: { on: false, days: 3 }, relapse: { on: true }, monthly: { on: false, time: '09:00' } };
  var DAYS_MAX = { kdStale: 60, deptNoAudits: 30, normMiss: 30 };

  function has(o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k); }
  function can(me) { return (me.role === 'manager' || me.role === 'admin') && !!(me.can && me.can.viewAllLocations); }
  function lv0() { return { fix: 0, repair: 0, scrap: 0 }; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function daysOf(from, to) { var out = []; for (var d = from; d <= to; d = S.addDays(d, 1)) out.push(d); return out; }
  function range(p, env) {
    var today = env.day(), to = DAY_RE.test(p.to || '') && p.to <= today ? p.to : today;
    var from = DAY_RE.test(p.from || '') && p.from <= to ? p.from : S.addDays(to, -29);
    if (from < S.addDays(to, -365)) from = S.addDays(to, -365);
    return { from: from, to: to };
  }
  function locOf(p, env) {
    var id = p.locationId;
    if (id == null || id === '') return { loc: null };
    if (!has(env.ix.loc, id)) return { err: C.fail('not_found', 'Такої локації немає.') };
    return { loc: env.ix.loc[id] };
  }
  function locsOf(p, env) {
    if (p.locationIds == null) return { ids: null };
    if (!Array.isArray(p.locationIds) || !p.locationIds.length) return { err: C.fail('validation', 'Оберіть хоча б одну локацію.', [{ field: 'locationIds', message: 'Оберіть хоча б одну локацію.' }]) };
    if (p.locationIds.some(function (id) { return !has(env.ix.loc, id); })) return { err: C.fail('not_found', 'Такої локації немає.') };
    return { ids: p.locationIds.filter(function (id, i) { return p.locationIds.indexOf(id) === i; }) };
  }
  function depsIn(env, locId) { return env.db.departments.filter(function (d) { return !locId || d.locationId === locId; }); }
  function auditsIn(env, locId, from, to) {
    return env.audits().filter(function (a) { return (!locId || a.locationId === locId) && a.day >= from && a.day <= to; });
  }
  function short(l) { return { id: l.id, name: l.name }; }
  function normOf(env, depId) { var n = env.db.norms.filter(function (x) { return x.departmentId === depId; })[0]; return n ? n.sampleTarget : null; }

  function kdSum(env, locId, from, to) {
    if (!P.demoKd || typeof P.demoKd.locSummary !== 'function') return null;
    try { var r = P.demoKd.locSummary(env, locId, from, to); return r && r.ok !== false ? r : null; } catch (e) { return null; }
  }
  function kdTile(k) {
    if (!k) return null;
    var s = k.states || {};
    return { states: { over: s.over || 0, watch: s.watch || 0, hold: s.hold || 0, done: s.done || 0, relapse: s.relapse || 0, skip: s.skip || 0 },
      active: (s.over || 0) + (s.watch || 0) + (s.hold || 0), opened: k.period ? k.period.opened : 0, implemented: k.period ? k.period.implemented : 0 };
  }

  function stats(env, list, deps) {
    var o = { audits: 0, checked: 0, rejected: 0, pct: null, levels: lv0(), byType: {} }, ids = {};
    deps.forEach(function (d) {
      var st = S.deptStats(env, list, d.id);
      ids[d.id] = 1;
      o.checked += st.checked; o.rejected += st.rejected;
      LV.forEach(function (k) { o.levels[k] += st.byLevel[k]; });
      Object.keys(st.byType).forEach(function (t) { o.byType[t] = (o.byType[t] || 0) + st.byType[t]; });
    });
    list.forEach(function (a) { if (ids[a.departmentId]) o.audits++; });
    o.pct = C.pct(o.rejected, o.checked);
    return o;
  }
  function top(env, byType, n) {
    var all = Object.keys(byType).reduce(function (s, id) { return s + byType[id]; }, 0);
    return Object.keys(byType).map(function (id) {
      var t = env.ix.def[id];
      return { id: id, name: t ? t.name : 'Невідомий вид браку', level: (t && t.level) || 'fix', pieces: byType[id], share: C.pct(byType[id], all) };
    }).sort(function (a, b) { return b.pieces - a.pieces || (a.name < b.name ? -1 : 1); }).slice(0, n);
  }
  function pub(env, o, n) { return { audits: o.audits, checked: o.checked, rejected: o.rejected, pct: o.pct, levels: o.levels, top: top(env, o.byType, n) }; }
  function dayCount(list) { var m = {}; list.forEach(function (a) { m[a.day] = 1; }); return Object.keys(m).length; }

  function checkedByDay(list) { var m = {}; list.forEach(function (a) { var k = a.day + '|' + a.departmentId; m[k] = (m[k] || 0) + C.checkedOf(a); }); return m; }
  function people(env, list, locId) {
    var by = {}, total = 0, perDay = checkedByDay(list);
    list.forEach(function (a) {
      var q = a.defects.reduce(function (s, d) { return s + S.pieces(d); }, 0);
      var x = by[a.auditorId] = by[a.auditorId] || { audits: 0, checked: 0, pieces: 0, days: {}, lastAt: null };
      x.audits++; x.checked += C.checkedOf(a); x.pieces += q; total += q;
      (x.days[a.day] = x.days[a.day] || {})[a.departmentId] = 1;
      if (!x.lastAt || a.createdAt > x.lastAt) x.lastAt = a.createdAt;
    });
    function norm(days) {
      var o = { ok: 0, of: 0 };
      Object.keys(days).forEach(function (d) {
        var deps = Object.keys(days[d]).filter(function (id) { return normOf(env, id) != null; });
        if (!deps.length) return;
        o.of++;
        if (deps.every(function (id) { return (perDay[d + '|' + id] || 0) >= normOf(env, id); })) o.ok++;
      });
      o.pct = C.pct(o.ok, o.of);
      return o;
    }
    var list2 = env.db.users.filter(function (u) {
      return has(by, u.id) || ((u.role === 'auditor' || u.role === 'senior_auditor') && u.active !== false && (!locId || u.locationIds.indexOf(locId) >= 0));
    }).map(function (u) {
      var x = has(by, u.id) ? by[u.id] : { audits: 0, checked: 0, pieces: 0, days: {}, lastAt: null };
      return { id: u.id, name: u.name, role: u.role, roleLabel: P.demoDict.roleLabels[u.role], active: u.active !== false, senior: u.role === 'senior_auditor',
        locations: u.locationIds.map(function (id) { return env.ix.loc[id] ? env.ix.loc[id].name : ''; }).filter(Boolean),
        audits: x.audits, checked: x.checked, pieces: x.pieces, pct: C.pct(x.pieces, x.checked), share: C.pct(x.pieces, total),
        days: Object.keys(x.days).length, norm: norm(x.days), lastAt: x.lastAt };
    }).sort(function (a, b) { return b.audits - a.audits || (a.name < b.name ? -1 : 1); });
    return { list: list2, total: total };
  }
  function locNorm(env, list, locId, days) {
    var perDay = checkedByDay(list), o = { ok: 0, of: 0 };
    depsIn(env, locId).filter(function (d) { return d.active !== false && normOf(env, d.id) != null; }).forEach(function (d) {
      var n = normOf(env, d.id);
      days.forEach(function (day) { o.of++; if ((perDay[day + '|' + d.id] || 0) >= n) o.ok++; });
    });
    o.pct = C.pct(o.ok, o.of);
    return o;
  }

  function monthEnd(m) { return new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString().slice(0, 10); }
  function prevMonth(m) { return new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 2, 1)).toISOString().slice(0, 7); }
  function monthsOf(today) { var out = [today.slice(0, 7)]; while (out.length < MONTHS_BACK) out.push(prevMonth(out[out.length - 1])); return out; }
  function kdDept(k, depId, from, to) {
    if (!k) return null;
    function inside(v) { var d = v ? String(v).slice(0, 10) : ''; return d >= from && d <= to; }
    var o = { opened: 0, implemented: 0 };
    (k.actions || []).forEach(function (a) {
      if (a.departmentId !== depId) return;
      if (inside(a.openedAt)) o.opened++;
      if (inside(a.implementedAt)) o.implemented++;
    });
    return o;
  }

  function reportsOf(env, userId) {
    var all = env.storage.get(KEY, {}) || {}, mine = has(all, userId) ? all[userId] : {}, o = clone(DEFAULTS);
    var every = env.db.locations.map(function (l) { return l.id; });
    KINDS.forEach(function (k) {
      if (mine[k] && typeof mine[k] === 'object') Object.assign(o[k], mine[k]);
      var locs = (o[k].locations || []).filter(function (id) { return has(env.ix.loc, id); });
      o[k].locations = locs.length ? locs : every.slice();
    });
    o.updatedAt = mine.updatedAt || null;
    return o;
  }
  function checkReports(p, env) {
    var errors = [], o = {};
    function err(field, message) { errors.push({ field: field, message: message }); }
    KINDS.forEach(function (k) {
      var x = p[k], def = DEFAULTS[k];
      if (!x || typeof x !== 'object') { err(k, 'Не вистачає налаштувань цього звіту.'); return; }
      if (typeof x.on !== 'boolean') err(k + '.on', 'Увімкніть або вимкніть звіт.');
      o[k] = { on: x.on === true };
      if ('days' in def) {
        var n = typeof x.days === 'string' && x.days.trim() !== '' ? Number(x.days) : x.days;
        if (typeof n !== 'number' || n % 1 !== 0 || n < 1 || n > DAYS_MAX[k]) err(k + '.days', 'Кількість днів — ціле число від 1 до ' + DAYS_MAX[k] + '.');
        else o[k].days = n;
      }
      if ('time' in def) {
        if (typeof x.time !== 'string' || !TIME_RE.test(x.time)) err(k + '.time', 'Час — у вигляді 09:00.');
        else o[k].time = x.time;
      }
      if ('day' in def) {
        if (typeof x.day !== 'number' || x.day % 1 !== 0 || x.day < 0 || x.day > 6) err(k + '.day', 'Оберіть день тижня.');
        else o[k].day = x.day;
      }
      var locs = Array.isArray(x.locations) ? x.locations : null;
      if (!locs || !locs.length) err(k + '.locations', 'Оберіть хоча б одну локацію.');
      else if (locs.some(function (id) { return !has(env.ix.loc, id); })) err(k + '.locations', 'Такої локації немає — оновіть сторінку.');
      else o[k].locations = locs.filter(function (id, i) { return locs.indexOf(id) === i; });
    });
    return errors.length ? { errors: errors } : { clean: o };
  }

  var api = {
    mgrOverview: function (p, me, env) {
      if (!can(me)) return C.forbidden();
      var sel = locOf(p, env); if (sel.err) return sel.err;
      var rg = range(p, env), span = daysOf(rg.from, rg.to), pFrom = S.addDays(rg.from, -span.length), pTo = S.addDays(rg.from, -1);
      var both = auditsIn(env, null, pFrom, rg.to);
      var cur = both.filter(function (a) { return a.day >= rg.from; }), prev = both.filter(function (a) { return a.day < rg.from; });
      function at(list, locId) { return list.filter(function (a) { return !locId || a.locationId === locId; }); }
      var kdSel = sel.loc ? kdSum(env, sel.loc.id, rg.from, rg.to) : null;
      var locations = env.db.locations.map(function (l) {
        var deps = depsIn(env, l.id), s = stats(env, at(cur, l.id), deps), ps = stats(env, at(prev, l.id), deps);
        return Object.assign(short(l), pub(env, s, 3), { departments: deps.filter(function (d) { return d.active !== false; }).length,
          prev: { audits: ps.audits, checked: ps.checked, rejected: ps.rejected, pct: ps.pct },
          kd: kdTile(sel.loc && sel.loc.id === l.id ? kdSel : kdSum(env, l.id, rg.from, rg.to)) });
      });
      var locId = sel.loc ? sel.loc.id : null, deps = depsIn(env, locId), scope = at(cur, locId), pscope = at(prev, locId), byDay = {};
      scope.forEach(function (a) { (byDay[a.day] = byDay[a.day] || []).push(a); });
      var days = span.map(function (d) {
        var s = stats(env, byDay[d] || [], deps);
        return { day: d, audits: s.audits, checked: s.checked, rejected: s.rejected, pct: s.pct, levels: s.levels };
      });
      var pv = stats(env, pscope, deps);
      return { ok: true, from: rg.from, to: rg.to, today: env.day(), asOf: env.now().toISOString(), criticalPct: env.db.settings.criticalPct,
        location: sel.loc ? short(sel.loc) : null, locations: locations, days: days, kd: kdSel,
        totals: Object.assign(pub(env, stats(env, scope, deps), 5), { days: span.length, daysWithAudits: dayCount(scope) }),
        prev: { from: pFrom, to: pTo, days: span.length, daysWithAudits: dayCount(pscope), audits: pv.audits, checked: pv.checked, rejected: pv.rejected, pct: pv.pct, levels: pv.levels } };
    },

    mgrDepts: function (p, me, env) {
      if (!can(me)) return C.forbidden();
      var sel = locOf(p, env); if (sel.err) return sel.err;
      var many = locsOf(p, env); if (many.err) return many.err;
      var tid = p.deptTypeId == null || p.deptTypeId === '' ? null : p.deptTypeId;
      if (tid !== null && !has(env.ix.dt, tid)) return C.fail('not_found', 'Такого типу відділу немає.');
      var ids = many.ids || (sel.loc ? [sel.loc.id] : null);
      function mine(locId) { return !ids || ids.indexOf(locId) >= 0; }
      var rg = range(p, env), list = auditsIn(env, null, rg.from, rg.to).filter(function (a) { return mine(a.locationId); });
      var depts = env.db.departments.filter(function (d) { return mine(d.locationId) && (!tid || d.deptTypeId === tid); }).map(function (d) {
        var s = stats(env, list, [d]), loc = env.ix.loc[d.locationId], dt = env.ix.dt[d.deptTypeId];
        return Object.assign({ id: d.id, name: d.name, locationId: d.locationId, locationName: loc ? loc.name : '', deptTypeId: d.deptTypeId,
          deptTypeName: dt ? dt.name : '', active: d.active !== false }, pub(env, s, 3));
      }).filter(function (d) { return d.active || d.audits || d.rejected; });
      return { ok: true, from: rg.from, to: rg.to, asOf: env.now().toISOString(), criticalPct: env.db.settings.criticalPct,
        location: sel.loc ? short(sel.loc) : null, locationIds: ids, deptTypeId: tid, locations: env.db.locations.map(short),
        deptTypes: env.db.deptTypes.map(short), depts: depts };
    },

    mgrAuditors: function (p, me, env) {
      if (!can(me)) return C.forbidden();
      var sel = locOf(p, env); if (sel.err) return sel.err;
      var many = locsOf(p, env); if (many.err) return many.err;
      var locId = sel.loc ? sel.loc.id : null, rg = range(p, env), span = daysOf(rg.from, rg.to);
      var list = auditsIn(env, locId, rg.from, rg.to), flat = people(env, list, locId);
      var ids = many.ids || (locId ? [locId] : env.db.locations.map(function (l) { return l.id; }));
      var groups = ids.map(function (id) {
        var la = auditsIn(env, id, rg.from, rg.to), pp = people(env, la, id), k = kdSum(env, id, rg.from, rg.to);
        var kd = k && k.period ? { opened: k.period.opened, implemented: k.period.implemented, daysAvg: k.period.implementedDaysAvg,
          belowAfter1: k.period.results ? k.period.results.belowAfter1 : 0, notBelowAfter1: k.period.results ? k.period.results.notBelowAfter1 : 0 } : null;
        pp.list.forEach(function (a) { if (a.senior) a.kd = kd; });
        return { location: short(env.ix.loc[id]), audits: la.length, checked: la.reduce(function (s, a) { return s + C.checkedOf(a); }, 0),
          daysWithAudits: dayCount(la), days: span.length, norm: locNorm(env, la, id, span), kd: kd, auditors: pp.list };
      });
      return { ok: true, from: rg.from, to: rg.to, asOf: env.now().toISOString(), location: sel.loc ? short(sel.loc) : null,
        locations: env.db.locations.map(short), totalAudits: list.length, totalPieces: flat.total, auditors: flat.list, groups: groups };
    },

    mgrMonth: function (p, me, env) {
      if (!can(me)) return C.forbidden();
      var sel = locOf(p, env); if (sel.err) return sel.err;
      var loc = sel.loc || env.db.locations[0];
      if (!loc) return { ok: true, month: null, months: [], locations: [], location: null, kd: null, hasKd: false, asOf: env.now().toISOString() };   // локацій ще немає
      var today = env.day(), months = monthsOf(today), m = p.month == null || p.month === '' ? months[1] : p.month;
      function bad(msg) { return C.fail('validation', msg, [{ field: 'month', message: msg }]); }
      if (typeof m !== 'string' || !MONTH_RE.test(m)) return bad('Оберіть місяць зі списку.');
      if (m > months[0]) return bad('Цей місяць ще не настав.');
      if (months.indexOf(m) < 0) return bad('Звіт можна взяти за останні ' + MONTHS_BACK + ' місяців.');
      var from = m + '-01', end = monthEnd(m), to = end < today ? end : today, mine = auditsIn(env, loc.id, from, to), count = {};
      env.audits().forEach(function (a) { if (a.locationId === loc.id) { var k = a.day.slice(0, 7); count[k] = (count[k] || 0) + 1; } });
      var deps = depsIn(env, loc.id), kd = kdSum(env, loc.id, from, to);
      var depts = deps.map(function (d) {
        return Object.assign({ id: d.id, name: d.name, active: d.active !== false }, pub(env, stats(env, mine, [d]), MONTH_TOP), { kd: kdDept(kd, d.id, from, to) });
      }).filter(function (d) { return d.active || d.audits || d.rejected; });
      return { ok: true, month: m, from: from, to: to, partial: end > today, asOf: env.now().toISOString(), hasKd: !!kd, criticalPct: env.db.settings.criticalPct,
        months: months.map(function (k) { return { month: k, audits: count[k] || 0 }; }), locations: env.db.locations.map(short),
        location: Object.assign(short(loc), pub(env, stats(env, mine, deps), MONTH_TOP), { depts: depts }), kd: kd };
    },

    mgrReports: function (p, me, env) {
      if (!can(me)) return C.forbidden();
      return { ok: true, settings: reportsOf(env, me.id), locations: env.db.locations.map(short), sending: false };
    },

    mgrReportsSave: function (p, me, env) {
      if (!can(me)) return C.forbidden();
      var r = checkReports(p, env);
      if (r.errors) return C.fail('validation', 'Перевірте налаштування.', r.errors);
      var all = env.storage.get(KEY, {}) || {};
      r.clean.updatedAt = env.now().toISOString();
      all[me.id] = r.clean;
      env.storage.set(KEY, all);
      return { ok: true, settings: reportsOf(env, me.id) };
    }
  };

  P.demoApis.push(api);
  P.demoResetKeys.push(KEY);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
