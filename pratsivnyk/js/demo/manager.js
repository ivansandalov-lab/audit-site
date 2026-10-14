(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, S = P.demoSenior;
  P.demoApis = P.demoApis || []; P.demoResetKeys = P.demoResetKeys || [];
  var LV = ['fix', 'repair', 'scrap'], KEY = 'demo:mgr:reports';
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/, MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/, TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  var MONTHS_BACK = 12;   // за скільки місяців (разом з поточним) можна взяти звіт
  var ALERT_MIN = 0.5, ALERT_MAX = 50;
  var DEFAULTS = { daily: { on: true, time: '18:00' }, weekly: { on: true, day: 1, time: '09:00' }, monthly: { on: false, time: '09:00' }, alert: { on: false, pct: 5 } };

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
  function depsIn(env, locId) { return env.db.departments.filter(function (d) { return !locId || d.locationId === locId; }); }
  function auditsIn(env, locId, from, to) {
    return env.audits().filter(function (a) { return (!locId || a.locationId === locId) && a.day >= from && a.day <= to; });
  }
  function short(l) { return { id: l.id, name: l.name }; }

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
    return Object.keys(byType).map(function (id) {
      var t = env.ix.def[id];
      return { id: id, name: t ? t.name : 'Невідомий вид браку', level: (t && t.level) || 'fix', pieces: byType[id] };
    }).sort(function (a, b) { return b.pieces - a.pieces || (a.name < b.name ? -1 : 1); }).slice(0, n);
  }
  function pub(env, o, n) { return { audits: o.audits, checked: o.checked, rejected: o.rejected, pct: o.pct, levels: o.levels, top: top(env, o.byType, n) }; }
  function dayCount(list) { var m = {}; list.forEach(function (a) { m[a.day] = 1; }); return Object.keys(m).length; }

  function monthEnd(m) { return new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString().slice(0, 10); }
  function prevMonth(m) { return new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 2, 1)).toISOString().slice(0, 7); }
  function monthsOf(today) { var out = [today.slice(0, 7)]; while (out.length < MONTHS_BACK) out.push(prevMonth(out[out.length - 1])); return out; }
  function kdOf(actions, ids, from, to) {
    var o = { started: 0, implemented: 0, notNeeded: 0 };
    function inside(v) { var d = v ? String(v).slice(0, 10) : ''; return d >= from && d <= to; }
    actions.forEach(function (a) {
      if (ids.indexOf(a.departmentId) < 0) return;
      if (a.notNeeded) { if (inside(a.notNeeded.at)) o.notNeeded++; return; }
      if (inside(a.startedAt)) o.started++;
      if (inside(a.implementedAt)) o.implemented++;
    });
    return o;
  }

  function reportsOf(env, userId) {
    var all = env.storage.get(KEY, {}) || {}, mine = has(all, userId) ? all[userId] : {}, o = clone(DEFAULTS);
    ['daily', 'weekly', 'monthly', 'alert'].forEach(function (k) { if (mine[k]) Object.assign(o[k], mine[k]); });
    var locs = (mine.locations || []).filter(function (id) { return has(env.ix.loc, id); });
    o.locations = locs.length ? locs : env.db.locations.map(function (l) { return l.id; });
    o.updatedAt = mine.updatedAt || null;
    return o;
  }
  function checkReports(p, env) {
    var errors = [], o = {};
    function err(field, message) { errors.push({ field: field, message: message }); }
    ['daily', 'weekly', 'monthly', 'alert'].forEach(function (k) {
      var x = p[k];
      if (!x || typeof x !== 'object') { err(k, 'Не вистачає налаштувань цього звіту.'); return; }
      if (typeof x.on !== 'boolean') err(k + '.on', 'Увімкніть або вимкніть звіт.');
      o[k] = { on: x.on === true };
      if (k === 'alert') {
        var v = typeof x.pct === 'string' ? Number(x.pct.replace(',', '.')) : x.pct;
        if (typeof v !== 'number' || !isFinite(v) || v < ALERT_MIN || v > ALERT_MAX) err('alert.pct', 'Поріг — число від 0,5 до 50.');
        else o.alert.pct = Math.round(v * 10) / 10;
        return;
      }
      if (typeof x.time !== 'string' || !TIME_RE.test(x.time)) err(k + '.time', 'Час — у вигляді 09:00.');
      else o[k].time = x.time;
      if (k === 'weekly') {
        if (typeof x.day !== 'number' || x.day % 1 !== 0 || x.day < 0 || x.day > 6) err('weekly.day', 'Оберіть день тижня.');
        else o.weekly.day = x.day;
      }
    });
    var locs = Array.isArray(p.locations) ? p.locations : null;
    if (!locs || !locs.length) err('locations', 'Оберіть хоча б одну локацію.');
    else if (locs.some(function (id) { return !has(env.ix.loc, id); })) err('locations', 'Такої локації немає — оновіть сторінку.');
    else o.locations = locs.filter(function (id, i) { return locs.indexOf(id) === i; });
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
      var locations = env.db.locations.map(function (l) {
        var deps = depsIn(env, l.id), s = stats(env, at(cur, l.id), deps), ps = stats(env, at(prev, l.id), deps);
        return Object.assign(short(l), pub(env, s, 3), { departments: deps.filter(function (d) { return d.active !== false; }).length,
          prev: { audits: ps.audits, checked: ps.checked, rejected: ps.rejected, pct: ps.pct } });
      });
      var locId = sel.loc ? sel.loc.id : null, deps = depsIn(env, locId), scope = at(cur, locId), pscope = at(prev, locId), byDay = {};
      scope.forEach(function (a) { (byDay[a.day] = byDay[a.day] || []).push(a); });
      var days = span.map(function (d) {
        var s = stats(env, byDay[d] || [], deps);
        return { day: d, audits: s.audits, checked: s.checked, rejected: s.rejected, pct: s.pct, levels: s.levels };
      });
      var pv = stats(env, pscope, deps);
      return { ok: true, from: rg.from, to: rg.to, today: env.day(), asOf: env.now().toISOString(), criticalPct: env.db.settings.criticalPct,
        location: sel.loc ? short(sel.loc) : null, locations: locations, days: days,
        totals: Object.assign(pub(env, stats(env, scope, deps), 5), { days: span.length, daysWithAudits: dayCount(scope) }),
        prev: { from: pFrom, to: pTo, days: span.length, daysWithAudits: dayCount(pscope), audits: pv.audits, checked: pv.checked, rejected: pv.rejected, pct: pv.pct, levels: pv.levels } };
    },

    mgrDepts: function (p, me, env) {
      if (!can(me)) return C.forbidden();
      var sel = locOf(p, env); if (sel.err) return sel.err;
      var tid = p.deptTypeId == null || p.deptTypeId === '' ? null : p.deptTypeId;
      if (tid !== null && !has(env.ix.dt, tid)) return C.fail('not_found', 'Такого типу відділу немає.');
      var rg = range(p, env), list = auditsIn(env, sel.loc ? sel.loc.id : null, rg.from, rg.to);
      var depts = depsIn(env, sel.loc ? sel.loc.id : null).filter(function (d) { return !tid || d.deptTypeId === tid; }).map(function (d) {
        var s = stats(env, list, [d]), loc = env.ix.loc[d.locationId], dt = env.ix.dt[d.deptTypeId];
        return Object.assign({ id: d.id, name: d.name, locationId: d.locationId, locationName: loc ? loc.name : '', deptTypeId: d.deptTypeId,
          deptTypeName: dt ? dt.name : '', active: d.active !== false }, pub(env, s, 3));
      }).filter(function (d) { return d.active || d.audits || d.rejected; });
      return { ok: true, from: rg.from, to: rg.to, asOf: env.now().toISOString(), criticalPct: env.db.settings.criticalPct,
        location: sel.loc ? short(sel.loc) : null, deptTypeId: tid, locations: env.db.locations.map(short),
        deptTypes: env.db.deptTypes.map(short), depts: depts };
    },

    mgrAuditors: function (p, me, env) {
      if (!can(me)) return C.forbidden();
      var sel = locOf(p, env); if (sel.err) return sel.err;
      var locId = sel.loc ? sel.loc.id : null, rg = range(p, env), list = auditsIn(env, locId, rg.from, rg.to), by = {}, total = 0;
      list.forEach(function (a) {
        var q = a.defects.reduce(function (s, d) { return s + S.pieces(d); }, 0);
        var x = by[a.auditorId] = by[a.auditorId] || { audits: 0, checked: 0, pieces: 0, days: {}, lastAt: null };
        x.audits++; x.checked += C.checkedOf(a); x.pieces += q; x.days[a.day] = 1; total += q;
        if (!x.lastAt || a.createdAt > x.lastAt) x.lastAt = a.createdAt;
      });
      var auditors = env.db.users.filter(function (u) {
        return has(by, u.id) || ((u.role === 'auditor' || u.role === 'senior_auditor') && u.active !== false && (!locId || u.locationIds.indexOf(locId) >= 0));
      }).map(function (u) {
        var x = has(by, u.id) ? by[u.id] : { audits: 0, checked: 0, pieces: 0, days: {}, lastAt: null };
        return { id: u.id, name: u.name, role: u.role, roleLabel: P.demoDict.roleLabels[u.role], active: u.active !== false,
          locations: u.locationIds.map(function (id) { return env.ix.loc[id] ? env.ix.loc[id].name : ''; }).filter(Boolean),
          audits: x.audits, checked: x.checked, pieces: x.pieces, pct: C.pct(x.pieces, x.checked), share: C.pct(x.pieces, total),
          days: Object.keys(x.days).length, lastAt: x.lastAt };
      }).sort(function (a, b) { return b.audits - a.audits || (a.name < b.name ? -1 : 1); });
      return { ok: true, from: rg.from, to: rg.to, asOf: env.now().toISOString(), location: sel.loc ? short(sel.loc) : null,
        locations: env.db.locations.map(short), totalAudits: list.length, totalPieces: total, auditors: auditors };
    },

    mgrMonth: function (p, me, env) {
      if (!can(me)) return C.forbidden();
      var today = env.day(), months = monthsOf(today), m = p.month == null || p.month === '' ? months[1] : p.month;
      function bad(msg) { return C.fail('validation', msg, [{ field: 'month', message: msg }]); }
      if (typeof m !== 'string' || !MONTH_RE.test(m)) return bad('Оберіть місяць зі списку.');
      if (m > months[0]) return bad('Цей місяць ще не настав.');
      if (months.indexOf(m) < 0) return bad('Звіт можна взяти за останні ' + MONTHS_BACK + ' місяців.');
      var from = m + '-01', end = monthEnd(m), to = end < today ? end : today, list = auditsIn(env, null, from, to);
      var kd = env.db.kdActions || null, count = {};
      env.audits().forEach(function (a) { var k = a.day.slice(0, 7); count[k] = (count[k] || 0) + 1; });
      function withKd(o, ids) { if (kd) o.kd = kdOf(kd, ids, from, to); return o; }
      var locations = env.db.locations.map(function (l) {
        var deps = depsIn(env, l.id), mine = list.filter(function (a) { return a.locationId === l.id; });
        var depts = deps.map(function (d) { return withKd(Object.assign({ id: d.id, name: d.name, active: d.active !== false }, pub(env, stats(env, mine, [d]), 3)), [d.id]); })
          .filter(function (d) { return d.active || d.audits || d.rejected; });
        return withKd(Object.assign(short(l), pub(env, stats(env, mine, deps), 3), { depts: depts }), deps.map(function (d) { return d.id; }));
      });
      var all = depsIn(env, null);
      return { ok: true, month: m, from: from, to: to, partial: end > today, asOf: env.now().toISOString(), hasKd: !!kd,
        months: months.map(function (k) { return { month: k, audits: count[k] || 0 }; }), locations: locations,
        totals: withKd(pub(env, stats(env, list, all), 5), all.map(function (d) { return d.id; })) };
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
