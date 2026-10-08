(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var C = P.demoCommon;
  var OPEN_FNS = { demoUsers: 1, authDemoLogin: 1, authMe: 1, demoMeta: 1, demoReset: 1 };
  var SCHEMA = '1';
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function memoryStore() {
    var m = {};
    return {
      get: function (k, def) { return k in m ? JSON.parse(m[k]) : def; },
      set: function (k, v) { m[k] = JSON.stringify(v); return true; },
      del: function (k) { delete m[k]; }
    };
  }

  P.createDemoServer = function (opts) {
    opts = opts || {};
    var storage = opts.storage || (typeof window !== 'undefined' ? P.store : memoryStore());
    var now = opts.now || function () { return new Date(); };
    var lat = opts.latencyMs || [120, 320];
    var seed = opts.seed == null ? 20261007 : opts.seed;
    var today = opts.today || P.fmt.dayKey(now());
    var failQueue = Object.create(null);
    var env = { db: null, ix: null, storage: storage, now: now, day: function () { return P.fmt.dayKey(now()); },
      audits: function () { var t = now().toISOString(); return env.db.audits.filter(function (a) { return a.createdAt <= t; }); } };
    var meId = null, loggedAt = null; // loggedAt — ISO-час входу; сесія старша за SESSION_DAYS = вихід

    function load() {
      if (storage.get('demo:schema', null) !== SCHEMA) {
        storage.del('demo:audits:new'); storage.del('demo:wishes:done');
        storage.set('demo:schema', SCHEMA);
      }
      var db = P.demoGenerate({ today: today, seed: seed });
      var fresh = storage.get('demo:audits:new', []), freshIds = {};
      fresh.forEach(function (a) { freshIds[a.id] = 1; });
      db.audits = db.audits.filter(function (a) { return !freshIds[a.id]; }).concat(fresh);
      var done = storage.get('demo:wishes:done', {});
      db.wishes.forEach(function (w) { if (done[w.id]) { w.status = 'done'; w.doneAuditId = done[w.id]; } });
      env.db = db; env.ix = C.index(db);
      meId = storage.get('demo:me', null);
      if (meId && !env.ix.user[meId]) meId = null;
      loggedAt = storage.get('demo:loggedAt', null);
      if (meId && !loggedAt) { loggedAt = now().toISOString(); storage.set('demo:loggedAt', loggedAt); }
    }
    load();

    function dropSession() { meId = null; loggedAt = null; storage.del('demo:me'); storage.del('demo:loggedAt'); }

    function currentMe() {
      if (meId && now().getTime() - Date.parse(loggedAt) > C.SESSION_DAYS * 86400000) dropSession();
      return meId ? C.buildMe(env.ix.user[meId], env.ix) : null;
    }

    var own = {
      demoUsers: function () {
        return { ok: true, users: env.db.users.map(function (u) {
          var m = C.buildMe(u, env.ix);
          return { id: m.id, name: m.name, role: m.role, roleLabel: m.roleLabel, locations: m.locations };
        }) };
      },
      authDemoLogin: function (p) {
        if (!p.userId || !env.ix.user[p.userId]) return C.fail('not_found', 'Користувача не знайдено.');
        meId = p.userId; storage.set('demo:me', meId);
        loggedAt = now().toISOString(); storage.set('demo:loggedAt', loggedAt);
        return { ok: true, me: currentMe() };
      },
      authMe: function () { return { ok: true, me: currentMe() }; },
      authLogout: function () { dropSession(); return { ok: true }; },
      demoReset: function () { reset(); return { ok: true }; },
      demoMeta: function () {
        var d = env.db;
        return { ok: true, generatedFor: today, counts: { locations: d.locations.length, departments: d.departments.length,
          workers: d.workers.length, audits: d.audits.length, wishes: d.wishes.length } };
      }
    };

    function reset() {
      storage.del('demo:me'); storage.del('demo:loggedAt'); storage.del('demo:audits:new'); storage.del('demo:wishes:done');
      load();
    }

    function handle(fn, payload) {
      if (typeof fn !== 'string') return C.fail('not_found', 'Невідома функція.');
      if (failQueue[fn]) { delete failQueue[fn]; return C.fail('server', 'Демо: імітація збою сервера.'); }
      var me = currentMe();
      if (!has(OPEN_FNS, fn) && !me) return C.auth();
      if (has(own, fn)) return own[fn](payload || {});
      var h = has(P.demoReadApi, fn) ? P.demoReadApi[fn] : has(P.demoSubmitApi, fn) ? P.demoSubmitApi[fn] : null;
      if (!h) return C.fail('not_found', 'Невідома функція.');
      return h(payload || {}, me, env);
    }

    return {
      call: function (fn, payload) {
        var res;
        try { res = JSON.parse(JSON.stringify(handle(fn, payload))); }
        catch (e) { res = C.fail('server', String((e && e.message) || e)); }
        var ms = lat[1] > 0 ? lat[0] + Math.random() * (lat[1] - lat[0]) : 0;
        if (ms <= 0) return Promise.resolve(res);
        return new Promise(function (resolve) { setTimeout(function () { resolve(res); }, ms); });
      },
      reset: reset,
      failNext: function (fn) { failQueue[fn] = true; }
    };
  };

  if (typeof window !== 'undefined' && !P.backend) {
    P.demo = P.createDemoServer({ seed: 20261007, today: P.fmt.dayKey(new Date()) });
    P.backend = P.demo;
    var m = /[?&]fail=([^&]+)/.exec((root.location && root.location.search) || '');
    if (m) P.demo.failNext(decodeURIComponent(m[1]));
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = P.createDemoServer;
})(typeof window !== 'undefined' ? window : globalThis);
