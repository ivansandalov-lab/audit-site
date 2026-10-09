(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  P.demoGenHooks = P.demoGenHooks || []; P.demoLoadHooks = P.demoLoadHooks || [];
  P.demoApis = P.demoApis || []; P.demoResetKeys = P.demoResetKeys || [];
  var C = P.demoCommon;

  var DAY = 86400000;
  function parseDay(k) { var p = String(k).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function addDays(k, n) { return new Date(parseDay(k) + n * DAY).toISOString().slice(0, 10); }

  var S = {
    LEVELS: ['fix', 'repair', 'scrap'],
    LEVEL_LABELS: { fix: 'неправильно зроблене', repair: 'пошкоджене', scrap: 'зламане' },
    KD: { PERIOD_DAYS: 4, EPOCH: '2026-01-05', THRESHOLD: 5, MIN_SAMPLE: 60 },
    addDays: addDays,
    parseDay: parseDay,
    periodOf: function (day) { return Math.floor((parseDay(day) - parseDay(S.KD.EPOCH)) / DAY / S.KD.PERIOD_DAYS); },
    periodStart: function (n) { return addDays(S.KD.EPOCH, n * S.KD.PERIOD_DAYS); },
    periodEnd: function (n) { return addDays(S.KD.EPOCH, n * S.KD.PERIOD_DAYS + S.KD.PERIOD_DAYS - 1); },
    lastFullPeriod: function (today) { return S.periodOf(today) - 1; },
    pieces: function (d) { return d.guilty.reduce(function (s, g) { return s + (g.qty || 0); }, 0); },
    sourceDept: function (a, d) { return d.departmentId || a.departmentId; },
    audits: function (env, locId, from, to) {
      return env.audits().filter(function (a) { return a.locationId === locId && (!from || a.day >= from) && (!to || a.day <= to); });
    },
    deptStats: function (env, list, deptId) {
      var o = { checked: 0, rejected: 0, byType: {}, byLevel: { fix: 0, repair: 0, scrap: 0 } };
      list.forEach(function (a) {
        if (a.departmentId === deptId) o.checked += C.checkedOf(a);
        a.defects.forEach(function (d) {
          if (S.sourceDept(a, d) !== deptId) return;
          var q = S.pieces(d), t = env.ix.def[d.defectTypeId];
          o.rejected += q;
          o.byType[d.defectTypeId] = (o.byType[d.defectTypeId] || 0) + q;
          o.byLevel[(t && t.level) || 'fix'] += q;
        });
      });
      return o;
    },
    loc: function (p, me, env) {
      var id = p.locationId || (me.locations[0] && me.locations[0].id);
      if (!id || !C.hasLoc(me, id)) return { err: C.forbidden() };
      return { loc: env.ix.loc[id] };
    },
    canManage: function (me) { return me.role === 'senior_auditor' || me.role === 'admin'; },
    get: function (env, key, def) { return env.storage.get(key, def); },
    set: function (env, key, val) { env.storage.set(key, val); },
    maskEmail: function (e) { e = String(e || ''); var at = e.indexOf('@'); return at > 2 ? e.slice(0, 2) + '***' + e.slice(at) : e; }
  };

  P.demoSenior = S;
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
