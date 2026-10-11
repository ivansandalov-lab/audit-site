(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon;
  P.demoApis = P.demoApis || [];

  P.demoApis.push({
    adminOverview: function (p, me, env) {
      if (!me.can.viewAllLocations) return C.forbidden();
      var day = env.day(), audits = env.audits();
      return { ok: true, day: day, locations: env.db.locations.map(function (l) {
        var today = audits.filter(function (a) { return a.locationId === l.id && a.day === day; });
        var checked = today.reduce(function (s, a) { return s + C.checkedOf(a); }, 0);
        var rejected = today.reduce(function (s, a) { return s + C.rejectedOf(a); }, 0);
        return { id: l.id, name: l.name,
          departments: env.db.departments.filter(function (d) { return d.locationId === l.id && d.active !== false; }).length,
          workers: env.db.workers.filter(function (w) { return w.locationId === l.id && w.active !== false; }).length,
          today: { audits: today.length, checked: checked, rejected: rejected, pct: C.pct(rejected, checked) } };
      }) };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
