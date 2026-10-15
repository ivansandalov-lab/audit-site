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
    KD: { CYCLE_DAYS: 7, REVIEW_DAY: 5, THRESHOLD: 5, EARLY_MIN: 500, PARETO: 70 },
    WEEKDAYS: ['понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота', 'неділя'],
    addDays: addDays,
    parseDay: parseDay,
    epoch: function (wd) { var base = '2026-01-01', dow = new Date(parseDay(base)).getUTCDay() || 7; return addDays(base, ((wd || S.KD.REVIEW_DAY) - dow + 7) % 7); },
    periodOf: function (day, wd) { return Math.floor((parseDay(day) - parseDay(S.epoch(wd))) / DAY / S.KD.CYCLE_DAYS); },
    periodStart: function (n, wd) { return addDays(S.epoch(wd), n * S.KD.CYCLE_DAYS); },
    periodEnd: function (n, wd) { return addDays(S.epoch(wd), n * S.KD.CYCLE_DAYS + S.KD.CYCLE_DAYS - 1); },
    lastFullPeriod: function (today, wd) { return S.periodOf(today, wd) - 1; },
    blur: function (rate, usual, n, made, limit) {
      if (!(n > 0) || rate == null) return null;
      var p = Math.min(Math.max((usual != null ? usual : rate) / 100, 0.005), 0.5), z = 1.645;
      var fpc = made > n ? Math.sqrt((made - n) / (made - 1)) : made > 0 ? 0 : 1;
      var m = z * Math.sqrt(p * (1 - p) / n) * fpc * 100;
      var lo = Math.max(0, rate - m), hi = rate + m;
      var n0 = z * z * p * (1 - p) / 0.0001, need1 = Math.ceil(made > 0 ? n0 / (1 + (n0 - 1) / made) : n0);
      var r1 = function (x) { return Math.round(x * 10) / 10; };
      return { margin: r1(m), lo: r1(lo), hi: r1(hi), rate: rate, verdict: lo > limit ? 'over' : hi <= limit ? 'ok' : 'near', need1: need1, n: n, made: made || null };
    },
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
