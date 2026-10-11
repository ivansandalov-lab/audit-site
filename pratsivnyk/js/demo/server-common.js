(function (root) {
  'use strict';
  var P = root.P = root.P || {};

  var C = P.demoCommon = {
    LIMITS: { maxOrders: 5, maxProducts: 15, maxDefects: 30, maxGuiltyPerDefect: 15,
      maxQty: 100000, maxComment: 1000, editWindowMin: 15 },

    SESSION_DAYS: 7,

    fail: function (code, error, errors) {
      var r = { ok: false, code: code, error: error };
      if (errors) r.errors = errors;
      return r;
    },
    forbidden: function () { return C.fail('forbidden', 'Немає прав на цю дію.'); },
    auth: function () { return C.fail('auth', 'Потрібен вхід.'); },

    pct: function (rejected, checked) {
      return checked > 0 ? Math.round(rejected / checked * 1000) / 10 : null;
    },

    checkedOf: function (a) { return a.items.reduce(function (s, i) { return s + i.qty; }, 0); },
    rejectedOf: function (a) { return a.items.reduce(function (s, i) { return s + (i.rejected || 0); }, 0); },

    index: function (db) {
      var ix = { loc: {}, dep: {}, dt: {}, prod: {}, def: {}, user: {}, worker: {} };
      db.locations.forEach(function (x) { ix.loc[x.id] = x; });
      db.departments.forEach(function (x) { ix.dep[x.id] = x; });
      db.deptTypes.forEach(function (x) { ix.dt[x.id] = x; });
      db.products.forEach(function (x) { ix.prod[x.id] = x; });
      db.defectTypes.forEach(function (x) { ix.def[x.id] = x; });
      db.users.forEach(function (x) { ix.user[x.id] = x; });
      db.workers.forEach(function (x) { ix.worker[x.locationId + ':' + x.code] = x; });
      return ix;
    },

    canOf: function (role) {
      return {
        recordAudit: role === 'auditor' || role === 'senior_auditor' || role === 'admin',
        editCatalogs: role === 'senior_auditor' || role === 'admin',
        editOthersAudits: role === 'senior_auditor' || role === 'admin',
        viewAllLocations: role === 'manager' || role === 'admin',
        manageWhitelist: role === 'senior_auditor' || role === 'admin'
      };
    },

    buildMe: function (u, ix) {
      var role = u.role;
      return {
        id: u.id, name: u.name, role: role, roleLabel: P.demoDict.roleLabels[role], email: u.email,
        locations: u.locationIds.map(function (id) { return { id: id, name: ix.loc[id].name }; }),
        defaultLocationId: u.locationIds[0],
        can: C.canOf(role)
      };
    },

    viewAs: function (u, ix, role, locId) {
      var me = C.buildMe(u, ix), one = role === 'auditor' || role === 'senior_auditor';
      var loc = Object.prototype.hasOwnProperty.call(ix.loc, locId) ? locId : u.locationIds[0];   // лише справжня локація (не службове імʼя обʼєкта)
      me.admin = true; me.viewLocationId = loc; me.allLocations = me.locations;
      me.role = role; me.roleLabel = P.demoDict.roleLabels[role]; me.can = C.canOf(role);
      if (one) me.locations = [{ id: loc, name: ix.loc[loc].name }];
      me.defaultLocationId = one ? loc : me.locations[0].id;
      return me;
    },

    hasLoc: function (me, locationId) {
      return me.locations.some(function (l) { return l.id === locationId; });
    },

    periodFrom: function (day, period) {
      var n = { today: 1, '7d': 7, '30d': 30, '90d': 90 }[period] || 7;
      return P.demoDates.addDays(day, -(n - 1));
    },

    newestFirst: function (a, b) {
      return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
