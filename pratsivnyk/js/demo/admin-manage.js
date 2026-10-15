(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, S = P.demoSenior;
  P.demoApis = P.demoApis || []; P.demoLoadHooks = P.demoLoadHooks || []; P.demoResetKeys = P.demoResetKeys || [];

  var K = { locs: 'demo:adm:locs', people: 'demo:adm:people', rights: 'demo:adm:rights', rules: 'demo:adm:rules', log: 'demo:adm:log' };
  var K_SR_USERS = 'demo:sr:mg:users';    // правки людей старшого (senior-manage.js): { add: [...], edit: { id: {name, email, active} } }
  var ROLES = ['auditor', 'senior_auditor', 'manager', 'admin'];   // ролі, які адміністратор може дати людині
  var ALL_LOC = { manager: 1, admin: 1 };                           // ці ролі завжди мають усі локації
  var LOC_MAX = 30, LOG_DAYS = 30, LOG_MAX = 300;
  var EMAIL = /^[^\s@]+@example\.com$/;                             // тестова версія: лише вигадана пошта @example.com

  var RIGHTS = [
    { key: 'recordAudit', label: 'Записувати аудити' },
    { key: 'editOthersAudits', label: 'Виправляти чужі аудити' },
    { key: 'viewAllLocations', label: 'Бачити всі локації' }
  ];
  var RIGHT_ROLES = ['auditor', 'senior_auditor', 'location_lead', 'manager'];
  var BASE = {};
  RIGHT_ROLES.forEach(function (r) { BASE[r] = C.canOf(r); });
  function rightOf(key) { return RIGHTS.filter(function (x) { return x.key === key; })[0] || null; }

  var RULES = [
    { key: 'criticalPct', label: 'Критичний брак в аудиті', unit: '%', min: 0.5, max: 50, dec: 1 },
    { key: 'kdThreshold', label: 'Коригуючі дії: норма браку відділу', unit: '%', min: 0.5, max: 50, dec: 1 },
    { key: 'kdReviewDay', label: 'Коригуючі дії: день розбору', unit: '', min: 1, max: 7, dec: 0, names: S.WEEKDAYS },
    { key: 'kdCycleDays', label: 'Коригуючі дії: тиждень розбору', unit: 'днів', locked: true },
    { key: 'kdEarlyMin', label: 'Коригуючі дії: ранній тумблер', unit: 'шт', min: 50, max: 10000, dec: 0 },
    { key: 'kdPareto', label: 'Коригуючі дії: пункти (Парето)', unit: '%', min: 50, max: 100, dec: 0 },
    { key: 'editWindowMin', label: 'Виправити свій аудит протягом', unit: 'хв', min: 1, max: 240, dec: 0 },
    { key: 'sessionDays', label: 'Повторний вхід раз на', unit: 'дн.', min: 1, max: 60, dec: 0 }
  ];
  var DEF = { criticalPct: 5, kdThreshold: S.KD.THRESHOLD, kdReviewDay: S.KD.REVIEW_DAY, kdCycleDays: S.KD.CYCLE_DAYS, kdEarlyMin: S.KD.EARLY_MIN,
    kdPareto: S.KD.PARETO, editWindowMin: C.LIMITS.editWindowMin, sessionDays: C.SESSION_DAYS };
  var GET = { criticalPct: function (db) { return db.settings.criticalPct; }, kdThreshold: function () { return S.KD.THRESHOLD; },
    kdReviewDay: function () { return S.KD.REVIEW_DAY; }, kdCycleDays: function () { return S.KD.CYCLE_DAYS; },
    kdEarlyMin: function () { return S.KD.EARLY_MIN; }, kdPareto: function () { return S.KD.PARETO; },
    editWindowMin: function () { return C.LIMITS.editWindowMin; }, sessionDays: function () { return C.SESSION_DAYS; } };
  var SET = { criticalPct: function (db, v) { db.settings.criticalPct = v; }, kdThreshold: function (db, v) { S.KD.THRESHOLD = v; },
    kdReviewDay: function (db, v) { S.KD.REVIEW_DAY = v; }, kdEarlyMin: function (db, v) { S.KD.EARLY_MIN = v; }, kdPareto: function (db, v) { S.KD.PARETO = v; },
    editWindowMin: function (db, v) { C.LIMITS.editWindowMin = v; }, sessionDays: function (db, v) { C.SESSION_DAYS = v; } };

  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function squash(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function verr(errs) { return C.fail('validation', errs[0].message, errs); }
  function isAdmin(me) { return !!me && me.role === 'admin'; }
  function hh(n) { return (n < 10 ? '0' : '') + n + ':00'; }
  function remText(r) { return r && r.on ? 'з ' + hh(r.from) + ' до ' + hh(r.to) + ', кожні ' + r.every + ' год' : 'вимкнено'; }
  function numText(v) { return String(v).replace('.', ','); }
  function withUnit(v, u, names) { return names ? (names[v - 1] || String(v)) : numText(v) + (u === '%' ? '%' : ' ' + u); }
  function locStore(st) { var s = obj(st.get(K.locs, null)); return { add: arr(s.add), edit: obj(s.edit) }; }
  function peopleStore(st) { var s = obj(st.get(K.people, null)); return { add: arr(s.add), edit: obj(s.edit), off: obj(s.off) }; }
  P.demoAccessOff = function (st, id) { return has(peopleStore(st).off, id); };
  function allUsers(env) { return env.db.users; }
  function locNames(env, ids) { return ids.map(function (id) { return env.ix.loc[id] ? env.ix.loc[id].name : id; }).join(', '); }

  function readLog(env) {
    var cut = new Date(env.now().getTime() - LOG_DAYS * 86400000).toISOString();
    return arr(env.storage.get(K.log, [])).filter(function (x) { return x && x.at >= cut; });
  }
  function log(env, me, area, target, rows) {
    if (!rows.length) return;
    var at = env.now().toISOString();
    var add = rows.map(function (r) { return { at: at, by: me.id, byName: me.name, area: area, target: target, what: r[0],
      from: r[1] == null || r[1] === '' ? '—' : String(r[1]), to: r[2] == null || r[2] === '' ? '—' : String(r[2]) }; });
    env.storage.set(K.log, add.concat(readLog(env)).slice(0, LOG_MAX));
  }

  function earlyHook(db, ctx) {
    var L = locStore(ctx.storage), U = peopleStore(ctx.storage);
    L.add.forEach(function (l) { if (l && typeof l.id === 'string' && !db.locations.some(function (x) { return x.id === l.id; })) db.locations.push({ id: l.id, name: l.name }); });
    U.add.forEach(function (u) { if (u && typeof u.id === 'string' && !db.users.some(function (x) { return x.id === u.id; })) db.users.push(clone(u)); });
  }
  function okVal(r, v) {
    var f = Math.pow(10, r.dec);
    return typeof v === 'number' && isFinite(v) && v >= r.min && v <= r.max && Math.abs(Math.round(v * f) - v * f) < 1e-9;
  }
  function lateHook(db, ctx) {
    var L = locStore(ctx.storage), U = peopleStore(ctx.storage), isLoc = {};
    db.locations.forEach(function (l) {
      var e = obj(L.edit[l.id]); isLoc[l.id] = 1;
      if (typeof e.name === 'string' && e.name) l.name = e.name;
      if (has(e, 'slackChannel')) l.slackChannel = e.slackChannel || null;
      if (has(e, 'reminders')) l.reminders = e.reminders ? clone(e.reminders) : null;
      if (e.active === false) l.active = false;
    });
    var all = db.locations.map(function (l) { return l.id; });
    db.users.forEach(function (u) {
      var e = has(U.edit, u.id) ? obj(U.edit[u.id]) : {};
      if (typeof e.role === 'string') u.role = e.role;
      var ids = arr(e.locationIds).filter(function (id) { return has(isLoc, id); });
      if (ids.length) u.locationIds = ids;
      if (has(ALL_LOC, u.role)) u.locationIds = all.slice();
    });
    db.usersOff = db.users.filter(function (u) { return has(U.off, u.id); });
    db.usersOff.forEach(function (u) { u.seniorOff = u.active === false; u.accessOff = true; u.active = false; });
    var m = obj(obj(ctx.storage.get(K.rights, null)).matrix), ov = null;
    RIGHT_ROLES.forEach(function (role) {
      var x = obj(m[role]);
      RIGHTS.forEach(function (r) { if (typeof x[r.key] === 'boolean') { ov = ov || {}; ov[role] = ov[role] || {}; ov[role][r.key] = x[r.key]; } });
    });
    C.roleOverrides = ov;
    DEF.criticalPct = db.settings.criticalPct;
    var vals = obj(obj(ctx.storage.get(K.rules, null)).values);
    RULES.forEach(function (r) { if (!r.locked) SET[r.key](db, okVal(r, vals[r.key]) ? vals[r.key] : DEF[r.key]); });
  }
  P.demoLoadHooks.unshift(earlyHook);
  P.demoLoadHooks.push(lateHook);
  Object.keys(K).forEach(function (k) { P.demoResetKeys.push(K[k]); });

  function channel(v) {
    var s = squash(v);
    if (!s) return { v: null };
    if (/^[A-Z][A-Z0-9]{6,}$/.test(s)) return { err: 'Впишіть назву каналу, як її видно в Slack, — наприклад, #якість-цех-а.' };
    s = s.toLowerCase(); if (s.charAt(0) !== '#') s = '#' + s;
    if (!/^#[a-z0-9а-яєіїґ_-]{1,79}$/.test(s)) return { err: 'Назва каналу — літери, цифри, дефіс чи «_», без пробілів: #якість-цех-а.' };
    return { v: s };
  }
  function isInt(n, min, max) { return typeof n === 'number' && Math.floor(n) === n && n >= min && n <= max; }
  function reminders(r) {
    r = obj(r); var errs = [];
    if (typeof r.on !== 'boolean') errs.push({ field: 'remOn', message: 'Оберіть: нагадування увімкнено чи вимкнено.' });
    if (!isInt(r.from, 0, 23)) errs.push({ field: 'remFrom', message: 'Початок — година від 0 до 23.' });
    if (!isInt(r.to, 1, 24)) errs.push({ field: 'remTo', message: 'Кінець — година від 1 до 24.' });
    else if (isInt(r.from, 0, 23) && r.to <= r.from) errs.push({ field: 'remTo', message: 'Кінець — пізніше за початок.' });
    if (!isInt(r.every, 1, 12)) errs.push({ field: 'remEvery', message: 'Кожні 1–12 годин.' });
    return errs.length ? { errs: errs } : { v: { on: r.on, from: r.from, to: r.to, every: r.every } };
  }

  P.demoApis.push({
    adminLocationSave: function (p, me, env) {
      if (!isAdmin(me)) return C.forbidden();
      env.reload();   // інша вкладка могла щось змінити — рахуємо від свіжого стану
      var st = locStore(env.storage), loc = null, errs = [], patch = {};
      if (p.id !== undefined) {
        loc = typeof p.id === 'string' && has(env.ix.loc, p.id) ? env.ix.loc[p.id] : null;
        if (!loc) return C.fail('not_found', 'Такої локації немає — оновіть сторінку.');
      } else if (env.db.locations.length >= LOC_MAX) return verr([{ field: 'name', message: 'Локацій уже ' + LOC_MAX + ' — це найбільше в тестовій версії.' }]);
      if (!loc || p.name !== undefined) {
        var name = squash(p.name);
        if (name.length < 2 || name.length > 40) errs.push({ field: 'name', message: 'Назва — від 2 до 40 знаків, наприклад «Цех Г».' });
        else if (env.db.locations.some(function (x) { return x !== loc && x.name.toLowerCase() === name.toLowerCase(); })) errs.push({ field: 'name', message: 'Локація з такою назвою вже є.' });
        else patch.name = name;
      }
      if (p.slackChannel !== undefined) { var ch = channel(p.slackChannel); if (ch.err) errs.push({ field: 'slackChannel', message: ch.err }); else patch.slackChannel = ch.v; }
      if (p.reminders !== undefined) { var rm = reminders(p.reminders); if (rm.errs) errs = errs.concat(rm.errs); else patch.reminders = rm.v; }
      if (p.active !== undefined) { if (typeof p.active !== 'boolean') errs.push({ field: 'active', message: 'Оберіть: увімкнена чи вимкнена.' }); else patch.active = p.active; }
      if (errs.length) return verr(errs);
      var rows = [], id = loc ? loc.id : null, title = loc ? loc.name : patch.name;
      if (!loc) {
        var n = 0;
        env.db.locations.concat(st.add).forEach(function (x) { var m = /^LOC_N(\d+)$/.exec(x.id); if (m) n = Math.max(n, +m[1]); });
        id = 'LOC_N' + (n + 1);
        st.add.push({ id: id, name: patch.name, addedAt: env.now().toISOString(), addedBy: me.id });
        rows.push(['Нова локація', null, patch.name]); delete patch.name;
      } else {
        if (has(patch, 'name') && patch.name !== loc.name) rows.push(['Назва', loc.name, patch.name]);
        if (has(patch, 'slackChannel') && patch.slackChannel !== (loc.slackChannel || null)) rows.push(['Slack-канал', loc.slackChannel, patch.slackChannel]);
        if (has(patch, 'reminders') && remText(patch.reminders) !== remText(loc.reminders)) rows.push(['Нагадування «запишіть аудит»', remText(loc.reminders), remText(patch.reminders)]);
        if (has(patch, 'active') && patch.active !== (loc.active !== false)) rows.push(['Стан', loc.active !== false ? 'увімкнена' : 'вимкнена', patch.active ? 'увімкнена' : 'вимкнена']);
      }
      if (has(patch, 'reminders') && !loc) rows.push(['Нагадування «запишіть аудит»', null, remText(patch.reminders)]);
      if (has(patch, 'slackChannel') && !loc && patch.slackChannel) rows.push(['Slack-канал', null, patch.slackChannel]);
      st.edit[id] = Object.assign(obj(st.edit[id]), patch);
      env.storage.set(K.locs, st);
      log(env, me, 'Локації', title, rows);
      env.reload();
      var x = env.ix.loc[id];
      return { ok: true, id: id, name: x.name, active: x.active !== false, created: !loc };
    },

    adminPersonSave: function (p, me, env) {
      if (!isAdmin(me)) return C.forbidden();
      env.reload();
      var st = peopleStore(env.storage), all = allUsers(env), u = null, errs = [], v = {};
      if (p.id !== undefined) {
        u = typeof p.id === 'string' ? all.filter(function (x) { return x.id === p.id; })[0] : null;
        if (!u) return C.fail('not_found', 'Цієї людини немає в списку — оновіть сторінку.');
      }
      var wasOn = !u || !has(st.off, u.id);
      if (!u || p.name !== undefined) {
        var name = squash(p.name);
        if (name.length < 2 || name.length > 60) errs.push({ field: 'name', message: 'Імʼя — від 2 до 60 знаків, наприклад «Олена К.».' }); else v.name = name;
      }
      if (!u || (p.email !== undefined && squash(p.email) !== '')) {
        var email = squash(p.email).toLowerCase();
        if (!EMAIL.test(email)) errs.push({ field: 'email', message: 'Пошта — повністю, у тестовій версії лише @example.com: olena.k@example.com.' });
        else if (all.some(function (x) { return x !== u && String(x.email).toLowerCase() === email; })) errs.push({ field: 'email', message: 'Ця пошта вже є в списку.' });
        else v.email = email;
      }
      var role = u ? u.role : null;
      if (!u || p.role !== undefined) {
        if (ROLES.indexOf(p.role) >= 0 || (u && p.role === u.role)) role = p.role;
        else errs.push({ field: 'role', message: 'Оберіть роль зі списку.' });
      }
      var locIds = u ? u.locationIds.slice() : [];
      if (role && has(ALL_LOC, role)) locIds = env.db.locations.map(function (l) { return l.id; });
      else if (!u || p.locationIds !== undefined || (u && has(ALL_LOC, u.role))) {
        var seen = {};
        locIds = arr(p.locationIds).filter(function (id) { if (typeof id !== 'string' || !has(env.ix.loc, id) || seen[id]) return false; seen[id] = 1; return true; });
        if (!locIds.length) errs.push({ field: 'locationIds', message: 'Оберіть хоча б одну локацію.' });
      }
      var on = wasOn;
      if (p.active !== undefined) { if (typeof p.active !== 'boolean') errs.push({ field: 'active', message: 'Оберіть: доступ увімкнено чи вимкнено.' }); else on = p.active; }
      if (u && u.id === me.id && (!on || role !== 'admin')) errs.push({ field: !on ? 'active' : 'role', message: 'Свою роль і доступ змінює інший адміністратор.' });
      else if (u && u.role === 'admin' && wasOn && (!on || role !== 'admin') &&
        !all.some(function (x) { return x !== u && x.role === 'admin' && !has(st.off, x.id); })) {
        errs.push({ field: !on ? 'active' : 'role', message: 'Це єдиний адміністратор із доступом. Спершу додайте ще одного адміністратора.' });
      }
      if (errs.length) return verr(errs);
      var rows = [], L = P.demoDict.roleLabels, id = u ? u.id : null;
      if (!u) {
        var n = 0;
        all.concat(st.add).forEach(function (x) { var m = /^u_new(\d+)$/.exec(x.id); if (m) n = Math.max(n, +m[1]); });
        id = 'u_new' + (n + 1);
        st.add.push({ id: id, name: v.name, role: role, email: v.email, locationIds: locIds, addedAt: env.now().toISOString(), addedBy: me.id });
        rows.push(['Нова людина', null, L[role] + ' · ' + locNames(env, locIds)]);
      } else {
        var prof = {};
        if (has(v, 'name') && v.name !== u.name) { prof.name = v.name; rows.push(['Імʼя', u.name, v.name]); }
        if (has(v, 'email') && v.email !== u.email) { prof.email = v.email; rows.push(['Пошта', S.maskEmail(u.email), S.maskEmail(v.email)]); }
        if (Object.keys(prof).length) {
          var sr = obj(env.storage.get(K_SR_USERS, null)); sr.add = arr(sr.add); sr.edit = obj(sr.edit);
          sr.edit[id] = Object.assign(obj(sr.edit[id]), prof); env.storage.set(K_SR_USERS, sr);
        }
        var e = obj(st.edit[id]);
        if (role !== u.role) { e.role = role; rows.push(['Роль', L[u.role], L[role]]); }
        if (locIds.join() !== u.locationIds.join()) { e.locationIds = locIds; rows.push(['Локації', locNames(env, u.locationIds), locNames(env, locIds)]); }
        st.edit[id] = e;
        if (on !== wasOn) rows.push(['Доступ', wasOn ? 'увімкнено' : 'вимкнено', on ? 'увімкнено' : 'вимкнено']);
      }
      if (on) delete st.off[id]; else st.off[id] = { at: env.now().toISOString(), by: me.id };
      env.storage.set(K.people, st);
      log(env, me, 'Люди й доступи', u ? u.name : v.name, rows);
      env.reload();
      var x = allUsers(env).filter(function (y) { return y.id === id; })[0];
      return { ok: true, id: id, name: x.name, active: on, created: !u };
    },

    adminRightsSave: function (p, me, env) {
      if (!isAdmin(me)) return C.forbidden();
      env.reload();
      var st = obj(env.storage.get(K.rights, null)), m = obj(st.matrix), L = P.demoDict.roleLabels;
      if (p.reset === true) {
        env.storage.del(K.rights);
        log(env, me, 'Права ролей', 'Усі ролі', [['Права', 'змінені', 'як було']]);
        env.reload(); return { ok: true, reset: true };
      }
      if (RIGHT_ROLES.indexOf(p.role) < 0) return verr([{ field: 'role', message: 'Права адміністратора не змінюються; інші ролі — зі списку.' }]);
      var right = rightOf(p.key);
      if (!right) return verr([{ field: 'key', message: 'Такого права немає — оновіть сторінку.' }]);
      if (typeof p.on !== 'boolean') return verr([{ field: 'on', message: 'Оберіть: можна чи не можна.' }]);
      var before = C.canOf(p.role)[p.key], x = obj(m[p.role]);
      if (p.on === BASE[p.role][p.key]) delete x[p.key]; else x[p.key] = p.on;   // зберігаємо лише відмінності від «як було»
      if (Object.keys(x).length) m[p.role] = x; else delete m[p.role];
      env.storage.set(K.rights, { matrix: m, at: env.now().toISOString(), by: me.id, byName: me.name });
      if (before !== p.on) log(env, me, 'Права ролей', L[p.role], [[right.label, before ? 'можна' : 'не можна', p.on ? 'можна' : 'не можна']]);
      env.reload();
      return { ok: true, role: p.role, key: p.key, on: C.canOf(p.role)[p.key] };
    },

    adminRuleSave: function (p, me, env) {
      if (!isAdmin(me)) return C.forbidden();
      env.reload();
      var r = RULES.filter(function (x) { return x.key === p.key; })[0];
      if (!r) return verr([{ field: 'value', message: 'Такого правила немає — оновіть сторінку.' }]);
      if (r.locked) return C.fail('locked', 'Це правило змінити не можна: тиждень розбору — завжди 7 днів.');
      var v = p.reset === true ? DEF[r.key] : typeof p.value === 'string' ? Number(p.value.replace(',', '.')) : p.value;
      if (!okVal(r, v)) {
        if (r.names) return verr([{ field: 'value', message: 'Оберіть день тижня зі списку.' }]);
        return verr([{ field: 'value', message: 'Число від ' + numText(r.min) + ' до ' + numText(r.max) + ' ' + r.unit + (r.dec ? ', до одного знака після коми.' : ', ціле.') }]);
      }
      var st = obj(env.storage.get(K.rules, null)), vals = obj(st.values), meta = obj(st.meta), was = GET[r.key](env.db);
      if (v === DEF[r.key]) delete vals[r.key]; else vals[r.key] = v;
      if (v !== was) meta[r.key] = { at: env.now().toISOString(), by: me.id, byName: me.name, from: was, to: v };
      env.storage.set(K.rules, { values: vals, meta: meta });
      if (v !== was) log(env, me, 'Правила', r.label, [['Значення', withUnit(was, r.unit, r.names), withUnit(v, r.unit, r.names)]]);
      env.reload();
      return { ok: true, key: r.key, value: GET[r.key](env.db), was: was };
    }
  });

  P.demoAdmin = { K: K, ROLES: ROLES, RIGHTS: RIGHTS, RIGHT_ROLES: RIGHT_ROLES, BASE: BASE, RULES: RULES, DEF: DEF, GET: GET,
    isAdmin: isAdmin, allUsers: allUsers, peopleStore: peopleStore, readLog: readLog, remText: remText };
})(typeof window !== 'undefined' ? window : globalThis);
