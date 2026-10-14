(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon;
  P.demoApis = P.demoApis || [];
  var ROLE_ORDER = { admin: 0, manager: 1, location_lead: 2, senior_auditor: 3, auditor: 4 };

  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function roleLabel(r) { return P.demoDict.roleLabels[r] || r; }
  function lastByAuditor(env) {
    var last = {};
    env.audits().forEach(function (a) { if (!last[a.auditorId] || a.createdAt > last[a.auditorId]) last[a.auditorId] = a.createdAt; });
    return last;
  }

  P.demoApis.push({
    adminOverview: function (p, me, env) {
      if (!me.can.viewAllLocations) return C.forbidden();
      var day = env.day(), audits = env.audits();
      return { ok: true, day: day, locations: env.db.locations.map(function (l) {
        var today = audits.filter(function (a) { return a.locationId === l.id && a.day === day; });
        var checked = today.reduce(function (s, a) { return s + C.checkedOf(a); }, 0);
        var rejected = today.reduce(function (s, a) { return s + C.rejectedOf(a); }, 0);
        return { id: l.id, name: l.name, active: l.active !== false, slackChannel: l.slackChannel || null, reminders: l.reminders || null,
          departments: env.db.departments.filter(function (d) { return d.locationId === l.id && d.active !== false; }).length,
          workers: env.db.workers.filter(function (w) { return w.locationId === l.id && w.active !== false; }).length,
          today: { audits: today.length, checked: checked, rejected: rejected, pct: C.pct(rejected, checked) } };
      }) };
    },

    adminPeople: function (p, me, env) {
      var A = P.demoAdmin;
      if (!A.isAdmin(me)) return C.forbidden();
      var off = A.peopleStore(env.storage).off, last = lastByAuditor(env), byRole = {};
      var items = A.allUsers(env).map(function (u) {
        var on = !has(off, u.id);
        if (on) byRole[u.role] = (byRole[u.role] || 0) + 1;
        return { id: u.id, name: u.name, email: P.demoSenior.maskEmail(u.email), role: u.role, roleLabel: roleLabel(u.role),
          locationIds: u.locationIds.slice(), allLocations: u.role === 'manager' || u.role === 'admin', active: on,
          seniorOff: u.accessOff ? !!u.seniorOff : u.active === false, lastAuditAt: last[u.id] || null, addedAt: u.addedAt || null, isMe: u.id === me.id };
      }).sort(function (a, b) {
        return (a.active ? 0 : 1) - (b.active ? 0 : 1) || (ROLE_ORDER[a.role] || 9) - (ROLE_ORDER[b.role] || 9) || a.name.localeCompare(b.name, 'uk');
      });
      var roles = Object.keys(ROLE_ORDER).filter(function (r) { return A.ROLES.indexOf(r) >= 0 || items.some(function (x) { return x.role === r; }); })
        .map(function (r) { return { id: r, label: roleLabel(r), count: byRole[r] || 0, assignable: A.ROLES.indexOf(r) >= 0 }; });
      return { ok: true, items: items, roles: roles, locations: env.db.locations.map(function (l) { return { id: l.id, name: l.name, active: l.active !== false }; }) };
    },

    adminRights: function (p, me, env) {
      var A = P.demoAdmin;
      if (!A.isAdmin(me)) return C.forbidden();
      var st = env.storage.get(A.K.rights, null) || {}, count = {};
      env.db.users.forEach(function (u) { if (!u.accessOff) count[u.role] = (count[u.role] || 0) + 1; });
      function pick(can) { var o = {}; A.RIGHTS.forEach(function (r) { o[r.key] = !!can[r.key]; }); return o; }
      var roles = A.RIGHT_ROLES.map(function (r) { return { id: r, label: roleLabel(r), people: count[r] || 0, can: pick(C.canOf(r)), base: pick(A.BASE[r]), locked: false }; });
      roles.push({ id: 'admin', label: roleLabel('admin'), people: count.admin || 0, can: pick(C.canOf('admin')), base: pick(C.canOf('admin')), locked: true });
      var changed = roles.some(function (r) { return A.RIGHTS.some(function (x) { return r.can[x.key] !== r.base[x.key]; }); });
      return { ok: true, rights: A.RIGHTS.slice(), roles: roles, changed: changed,
        changedAt: changed ? st.at || null : null, changedBy: changed ? st.byName || null : null };
    },

    adminRules: function (p, me, env) {
      var A = P.demoAdmin;
      if (!A.isAdmin(me)) return C.forbidden();
      var meta = (env.storage.get(A.K.rules, null) || {}).meta || {};
      return { ok: true, items: A.RULES.map(function (r) {
        return { key: r.key, label: r.label, unit: r.unit, min: r.min == null ? null : r.min, max: r.max == null ? null : r.max, dec: r.dec || 0,
          locked: !!r.locked, value: A.GET[r.key](env.db), def: A.DEF[r.key], changed: has(meta, r.key) ? meta[r.key] : null };
      }) };
    },

    adminStatus: function (p, me, env) {
      var A = P.demoAdmin;
      if (!A.isAdmin(me)) return C.forbidden();
      var day = env.day(), audits = env.audits(), last = {}, today = {};
      audits.forEach(function (a) {
        if (!last[a.locationId] || a.createdAt > last[a.locationId]) last[a.locationId] = a.createdAt;
        if (a.day === day) today[a.locationId] = (today[a.locationId] || 0) + 1;
      });
      return { ok: true, asOf: env.now().toISOString(), day: day,
        locations: env.db.locations.map(function (l) { return { id: l.id, name: l.name, active: l.active !== false, lastAuditAt: last[l.id] || null, today: today[l.id] || 0 }; }),
        counts: { locations: env.db.locations.length, people: env.db.users.filter(function (u) { return !u.accessOff; }).length, peopleOff: (env.db.usersOff || []).length, audits: audits.length, workers: env.db.workers.length },
        log: A.readLog(env) };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
