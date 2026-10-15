(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var C = P.demoCommon;
  var OPEN_FNS = { demoUsers: 1, authDemoLogin: 1, authMe: 1, demoMeta: 1, demoReset: 1 };
  var KEY_ADMIN = 'demo:admin';
  var SITE_SESSIONS = ['demo:me', 'demo:loggedAt', 'demo:me:sr', 'demo:me:sr:at', 'demo:me:adm', 'demo:me:adm:at', 'demo:me:mgr', 'demo:me:mgr:at'];
  var SCHEMA = '1';
  P.demoGenHooks = P.demoGenHooks || []; P.demoLoadHooks = P.demoLoadHooks || [];
  P.demoApis = P.demoApis || []; P.demoResetKeys = P.demoResetKeys || [];
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function memoryStore() {
    var m = {};
    return {
      get: function (k, def) { return k in m ? JSON.parse(m[k]) : def; },
      set: function (k, v) { m[k] = JSON.stringify(v); return true; },
      del: function (k) { delete m[k]; }
    };
  }

  function storageReachable(opts) {
    if (opts.storage || typeof window === 'undefined') return true;
    try { window.localStorage.getItem('audit-demo:probe'); return true; } catch (e) { return false; }
  }
  function accessOffNow(storage, u) { return P.demoAccessOff ? P.demoAccessOff(storage, u.id) : !!u.accessOff; }

  P.createDemoServer = function (opts) {
    opts = opts || {};
    var baseStore = opts.storage || (typeof window !== 'undefined' ? P.store : memoryStore());
    var failedKeys = Object.create(null), track = storageReachable(opts);
    var storage = {
      get: function (k, def) { return baseStore.get(k, def); },
      set: function (k, v) { var ok = baseStore.set(k, v) !== false; if (ok || !track) delete failedKeys[k]; else failedKeys[k] = 1; return ok; },
      del: function (k) { delete failedKeys[k]; return baseStore.del(k); }
    };
    var now = opts.now || function () { return new Date(); };
    var lat = opts.latencyMs || [120, 320];
    var seed = opts.seed == null ? 20261007 : opts.seed;
    var today = opts.today || P.fmt.dayKey(now());
    var failQueue = Object.create(null);
    var env = { db: null, ix: null, storage: storage, now: now, today: today, reload: function () { load(); }, day: function () { return P.fmt.dayKey(now()); },
      audits: function () { var t = now().toISOString(); return env.db.audits.filter(function (a) { return a.createdAt <= t; }); } };
    var meId = null, loggedAt = null; // loggedAt — ISO-час входу; сесія старша за SESSION_DAYS = вихід
    var KEY_ME = opts.sessionKey || P.demoSessionKey || 'demo:me';
    var KEY_AT = KEY_ME === 'demo:me' ? 'demo:loggedAt' : KEY_ME + ':at';
    var VIEW_ROLE = opts.viewRole || P.demoViewRole || null;
    var adminS = null;

    function load() {
      if (storage.get('demo:schema', null) !== SCHEMA) {
        storage.del('demo:audits:new'); storage.del('demo:wishes:done');
        storage.set('demo:schema', SCHEMA);
      }
      var db = P.demoGenerate({ today: today, seed: seed });
      P.demoGenHooks.forEach(function (h) { h(db, { today: today, seed: seed }); });
      var fresh = storage.get('demo:audits:new', []), freshIds = {};
      fresh.forEach(function (a) { freshIds[a.id] = 1; });
      db.audits = db.audits.filter(function (a) { return !freshIds[a.id]; }).concat(fresh);
      var done = storage.get('demo:wishes:done', {});
      db.wishes.forEach(function (w) { if (done[w.id]) { w.status = 'done'; w.doneAuditId = done[w.id]; } });
      P.demoLoadHooks.forEach(function (h) { h(db, { storage: storage, today: today, now: now }); });
      env.db = db; env.ix = C.index(db);
      meId = storage.get(KEY_ME, null);
      if (meId && (!has(env.ix.user, meId) || env.ix.user[meId].accessOff)) meId = null;
      loggedAt = storage.get(KEY_AT, null);
      if (meId && !loggedAt) { loggedAt = now().toISOString(); storage.set(KEY_AT, loggedAt); }
      syncAdmin();
    }
    function syncAdmin() {
      var a = VIEW_ROLE ? storage.get(KEY_ADMIN, null) : null;
      var ok = a && typeof a === 'object' && typeof a.userId === 'string' && has(env.ix.user, a.userId) && env.ix.user[a.userId].role === 'admin' &&
        !env.ix.user[a.userId].accessOff && !(P.demoAccessOff && P.demoAccessOff(storage, a.userId));
      adminS = ok ? { userId: a.userId, locationId: a.locationId } : null;
    }
    load();

    function dropSession() { meId = null; loggedAt = null; storage.del(KEY_ME); storage.del(KEY_AT); }

    function currentMe() {
      if (adminS) return C.viewAs(env.ix.user[adminS.userId], env.ix, VIEW_ROLE, adminS.locationId);
      if (meId && now().getTime() - Date.parse(loggedAt) > C.SESSION_DAYS * 86400000) dropSession();
      return meId ? C.buildMe(env.ix.user[meId], env.ix) : null;
    }

    var own = {
      demoUsers: function () {
        return { ok: true, users: env.db.users.filter(function (u) { return !accessOffNow(storage, u); }).map(function (u) {
          var m = C.buildMe(u, env.ix);
          return { id: m.id, name: m.name, role: m.role, roleLabel: m.roleLabel, locations: m.locations };
        }) };
      },
      authDemoLogin: function (p) {
        if (typeof p.userId !== 'string' || !has(env.ix.user, p.userId)) return C.fail('not_found', 'Користувача не знайдено.');
        var u = env.ix.user[p.userId];
        if (accessOffNow(storage, u)) return C.fail('forbidden', 'Доступ вимкнено адміністратором.');
        if (VIEW_ROLE && u.role === 'admin') {
          adminS = { userId: u.id, locationId: has(env.ix.loc, p.locationId) ? p.locationId : u.locationIds[0] };
          storage.set(KEY_ADMIN, adminS);
          return { ok: true, me: currentMe() };
        }
        adminS = null; storage.del(KEY_ADMIN);
        meId = p.userId; storage.set(KEY_ME, meId);
        loggedAt = now().toISOString(); storage.set(KEY_AT, loggedAt);
        return { ok: true, me: currentMe() };
      },
      authMe: function () { return { ok: true, me: currentMe() }; },
      authAdminView: function (p) {
        if (!adminS) return C.forbidden();
        if (typeof p.locationId !== 'string' || !has(env.ix.loc, p.locationId)) return C.fail('not_found', 'Такої локації немає — оновіть сторінку.');
        adminS = { userId: adminS.userId, locationId: p.locationId };
        storage.set(KEY_ADMIN, adminS);
        return { ok: true, me: currentMe() };
      },
      authLogout: function () {
        if (adminS) { adminS = null; storage.del(KEY_ADMIN); SITE_SESSIONS.forEach(function (k) { storage.del(k); }); }
        dropSession();
        return { ok: true };
      },
      demoReset: function () { var m = currentMe(); reset(!(m && (m.admin || m.role === 'admin'))); return { ok: true }; },
      demoReload: function () { load(); return { ok: true }; },
      demoMeta: function () {
        var d = env.db;
        return { ok: true, generatedFor: today, counts: { locations: d.locations.length, departments: d.departments.length,
          workers: d.workers.length, audits: d.audits.length, wishes: d.wishes.length } };
      }
    };

    function reset(keepAdmin) {
      storage.del(KEY_ME); storage.del(KEY_AT); storage.del('demo:audits:new'); storage.del('demo:wishes:done');
      P.demoResetKeys.forEach(function (k) { if (!(keepAdmin && k.indexOf('demo:adm:') === 0)) storage.del(k); });
      load();
    }

    function handle(fn, payload) {
      if (typeof fn !== 'string') return C.fail('not_found', 'Цієї дії немає. Оновіть сторінку.');
      if (failQueue[fn]) { delete failQueue[fn]; return C.fail('server', 'Демо: імітація збою сервера.'); }
      syncAdmin();
      if (meId && P.demoAccessOff && P.demoAccessOff(storage, meId)) dropSession();
      var me = currentMe();
      if (!has(OPEN_FNS, fn) && !me) return C.auth();
      if (has(own, fn)) return own[fn](payload || {});
      var h = has(P.demoReadApi, fn) ? P.demoReadApi[fn] : has(P.demoSubmitApi, fn) ? P.demoSubmitApi[fn] : null;
      for (var i = 0; !h && i < P.demoApis.length; i++) if (has(P.demoApis[i], fn)) h = P.demoApis[i][fn];
      if (!h) return C.fail('not_found', 'Цієї дії немає. Оновіть сторінку.');
      return h(payload || {}, me, env);
    }

    return {
      call: function (fn, payload) {
        var res;
        failedKeys = Object.create(null);
        try { res = JSON.parse(JSON.stringify(handle(fn, payload))); }
        catch (e) {   // людині — проста фраза; технічна причина — лише в console
          if (root.console) root.console.error(e);
          res = C.fail('server', 'Щось пішло не так. Оновіть сторінку й спробуйте ще раз.');
        }
        if (Object.keys(failedKeys).length) {
          failedKeys = Object.create(null);
          try { load(); } catch (e) { /* лишаємо як є */ }
          res = C.fail('quota', 'Місце для тестових даних у браузері закінчилось — зміни не збережено. Звільніть місце: меню профілю → «Скинути тестові дані».');
        }
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
