(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, S = P.demoSenior;
  P.demoApis = P.demoApis || []; P.demoLoadHooks = P.demoLoadHooks || []; P.demoResetKeys = P.demoResetKeys || [];

  var K = { users: 'demo:sr:mg:users', workers: 'demo:sr:mg:workers', depts: 'demo:sr:mg:depts', products: 'demo:sr:mg:products',
    defects: 'demo:sr:mg:defects', blocks: 'demo:sr:mg:blocks', imp: 'demo:sr:mg:import', mail: 'demo:sr:mg:mailing' };
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var LEVELS = { fix: 1, repair: 1, scrap: 1 };
  var INCLUDE = ['checked', 'levels', 'norms', 'noAudits', 'worst', 'topDefects', 'kd', 'auditors', 'orders', 'compare', 'link'];
  var DAILY_LEVELS = { all: 1, defects: 1, over5: 1 };

  function pad3(n) { var s = String(n); while (s.length < 3) s = '0' + s; return s; }
  function clean(s, max) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max || 80); }
  function same(a, b) { return clean(a).toLowerCase() === clean(b).toLowerCase(); }
  function each(o, fn) { if (o) Object.keys(o).forEach(function (k) { fn(k, o[k]); }); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function verr(errs) { return C.fail('validation', errs[0].message, errs); }
  function numOf(s) { var m = /(\d+)$/.exec(String(s)); return m ? +m[1] : 0; }
  function resolve(map, id) { var seen = {}; while (map && map[id] && !seen[id]) { seen[id] = 1; id = map[id]; } return id; }
  function plural(n, f) { var a = n % 10, b = n % 100; return f[a === 1 && b !== 11 ? 0 : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 1 : 2]; }

  function guard(p, me, env) {
    var r = S.loc(p || {}, me, env); if (r.err) return r;
    if (!r.loc) return { err: C.fail('not_found', 'Локацію не знайдено.') };
    if (!S.canManage(me)) return { err: C.forbidden() };
    return r;
  }
  function save(env, key, val) { env.storage.set(key, val); env.reload(); }
  function locDeps(env, locId) { return env.db.departments.filter(function (d) { return d.locationId === locId; }); }
  function locTypes(env, locId) { var t = {}; locDeps(env, locId).forEach(function (d) { t[d.deptTypeId] = true; }); return t; }
  function auditors(env, locId) { return env.db.users.filter(function (u) { return u.role === 'auditor' && u.locationIds.indexOf(locId) >= 0; }); }
  function locAudits(env, locId) { return env.audits().filter(function (a) { return a.locationId === locId; }); }

  function joinItems(items) {
    var out = [], at = {};
    items.forEach(function (i) {
      var k = i.productId + '|' + (i.orderNo || '');
      if (at[k] == null) { at[k] = out.length; out.push(i); return; }
      var t = out[at[k]]; t.qty += i.qty; t.rejected = (t.rejected || 0) + (i.rejected || 0);
    });
    return out;
  }
  function joinDefects(defects) {
    var out = [], at = {};
    defects.forEach(function (d) {
      var k = [d.productId, d.orderNo || '', d.defectTypeId, d.departmentId || ''].join('|');
      if (at[k] == null) { at[k] = out.length; out.push(d); return; }
      var t = out[at[k]];
      d.guilty.forEach(function (g) {
        var same = t.guilty.filter(function (x) { return x.workerCode === g.workerCode; })[0];
        if (same) same.qty += g.qty; else t.guilty.push(g);
      });
      if (!t.photo && d.photo) t.photo = d.photo;
    });
    return out;
  }
  function mergeProducts(db, map) {
    if (!map || !Object.keys(map).length) return;
    db.audits.forEach(function (a) {
      var hit = false;
      a.items.forEach(function (i) { var n = resolve(map, i.productId); if (n !== i.productId) { i.productId = n; hit = true; } });
      a.defects.forEach(function (d) { var n = resolve(map, d.productId); if (n !== d.productId) { d.productId = n; hit = true; } });
      if (hit) { a.items = joinItems(a.items); a.defects = joinDefects(a.defects); }
    });
    (db.wishes || []).forEach(function (w) { if (w.productId) w.productId = resolve(map, w.productId); });
    db.products = db.products.filter(function (x) { return !map[x.id]; });
  }
  function mergeDefects(db, map) {
    if (!map || !Object.keys(map).length) return;
    db.audits.forEach(function (a) {
      var hit = false;
      a.defects.forEach(function (d) { var n = resolve(map, d.defectTypeId); if (n !== d.defectTypeId) { d.defectTypeId = n; hit = true; } });
      if (hit) a.defects = joinDefects(a.defects);
    });
    db.defectTypes = db.defectTypes.filter(function (x) { return !map[x.id]; });
  }
  function byId(list, key) { var o = {}; list.forEach(function (x) { o[x[key]] = x; }); return o; }
  function applyOverlay(db, st) {
    var u = st.get(K.users, null), w = st.get(K.workers, null), d = st.get(K.depts, null);
    var pr = st.get(K.products, null), df = st.get(K.defects, null), bl = st.get(K.blocks, null);
    if (u) {
      arr(u.add).forEach(function (x) { db.users.push(x); });
      var ui = byId(db.users, 'id'); each(u.edit, function (id, e) { if (ui[id]) Object.assign(ui[id], e); });
    }
    if (w) {
      arr(w.add).forEach(function (x) { db.workers.push(x); });
      var wi = {}; db.workers.forEach(function (x) { wi[x.locationId + ':' + x.code] = x; });
      each(w.edit, function (k, e) { if (wi[k]) Object.assign(wi[k], e); });
    }
    if (d) { var di = byId(db.departments, 'id'); each(d, function (id, e) { if (di[id]) Object.assign(di[id], e); }); }
    if (pr) {
      arr(pr.add).forEach(function (x) { db.products.push(x); });
      var pi = byId(db.products, 'id'); each(pr.edit, function (id, e) { if (pi[id]) Object.assign(pi[id], e); });
      mergeProducts(db, pr.merge);
    }
    if (df) {
      arr(df.add).forEach(function (x) { db.defectTypes.push(x); });
      var fi = byId(db.defectTypes, 'id'); each(df.edit, function (id, e) { if (fi[id]) Object.assign(fi[id], e); });
      mergeDefects(db, df.merge);
    }
    each(bl, function (locId, list) { db.orderBlocks = db.orderBlocks.filter(function (b) { return b.locationId !== locId; }).concat(list); });
    db.catalogMerges = { products: (pr && pr.merge) || {}, defectTypes: (df && df.merge) || {} };
  }
  P.demoLoadHooks.push(function (db, ctx) { applyOverlay(db, ctx.storage); });
  Object.keys(K).forEach(function (k) { P.demoResetKeys.push(K[k]); });

  function counts(env, locId) {
    var t = locTypes(env, locId);
    return { team: auditors(env, locId).length, workers: env.db.workers.filter(function (w) { return w.locationId === locId; }).length,
      defects: env.db.defectTypes.filter(function (x) { return t[x.deptTypeId]; }).length,
      blocks: env.db.orderBlocks.filter(function (b) { return b.locationId === locId; }).length, mailing: MAILS.length };
  }

  function colLetter(i) { return String.fromCharCode(65 + i); }
  function sheetColumns(env, locId) {
    var cols = [{ col: 'A', name: 'Дата' }, { col: 'B', name: 'Замовлення' }];
    locDeps(env, locId).forEach(function (d, i) {
      cols.push({ col: colLetter(2 + i * 2), name: d.name + ', шт' }, { col: colLetter(3 + i * 2), name: d.name + ', план' });
    });
    return cols;
  }
  function importState(env, loc) {
    var all = env.storage.get(K.imp, {}), s = all[loc.id] || {};
    var cfg = s.config || { url: 'https://example.com/demo-vyrobnytstvo-' + loc.id.toLowerCase(), title: 'Виробіток ' + loc.name,
      sheet: 'Тиждень', headerRow: 2, dataRow: 3, dateCol: 'A', orderCol: 'B', weekStart: 'mon',
      depts: locDeps(env, loc.id).map(function (d, i) { return { departmentId: d.id, doneCol: colLetter(2 + i * 2), planCol: colLetter(3 + i * 2) }; }) };
    return { config: cfg, updatedAt: s.updatedAt || P.demoDates.kyivToIso(env.day(), 6 * 60 + 2) };
  }
  function dayPlan(orders, depId, day) {
    return orders.reduce(function (s, o) { return s + (o.firstDay <= day && day <= o.lastDay ? (o.daily[depId] || 0) : 0); }, 0);
  }
  function weekRows(env, loc, cfg) {
    var today = env.day(), dow = P.demoDates.dow(today);
    var back = cfg.weekStart === 'sun' ? dow : (dow + 6) % 7, from = S.addDays(today, -back), yest = S.addDays(today, -1);
    var orders = env.db.orders.filter(function (o) { return o.locationId === loc.id; });
    var days = []; for (var i = 0; i < 7; i++) { var k = S.addDays(from, i); if (P.demoDates.dow(k) !== 0) days.push(k); }
    var rows = locDeps(env, loc.id).filter(function (d) { return d.active !== false; }).map(function (d) {
      var c = cfg.depts.filter(function (x) { return x.departmentId === d.id; })[0];
      var norm = env.db.norms.filter(function (n) { return n.departmentId === d.id; })[0];
      var row = { departmentId: d.id, name: d.name, connected: !!(c && c.doneCol), planKnown: !!(c && c.planCol),
        doneYesterday: null, planWeek: null, doneWeek: null, pct: null, sampleTarget: norm ? norm.sampleTarget : null };
      if (!row.connected) return row;
      row.doneYesterday = P.demoDates.dow(yest) === 0 ? 0 : dayPlan(orders, d.id, yest);
      row.doneWeek = days.filter(function (k) { return k < today; }).reduce(function (s, k) { return s + dayPlan(orders, d.id, k); }, 0);
      if (row.planKnown) {
        row.planWeek = days.reduce(function (s, k) { return s + dayPlan(orders, d.id, k); }, 0);
        row.pct = row.planWeek ? Math.round(row.doneWeek / row.planWeek * 100) : null;
      }
      return row;
    });
    return { from: from, rows: rows };
  }
  function checkImport(env, loc, c) {
    var errs = [], cols = {}, used = {};
    sheetColumns(env, loc.id).forEach(function (x) { cols[x.col] = x.name; });
    function add(f, m) { errs.push({ field: f, message: m }); }
    if (!/^https:\/\/\S+$/.test(clean(c.url, 400))) add('url', 'Вставте посилання на таблицю — скопіюйте його з адресного рядка, воно починається з https://');
    if (!clean(c.sheet, 60)) add('sheet', 'Впишіть назву аркуша — наприклад, «Тиждень».');
    var h = +c.headerRow, r = +c.dataRow;
    if (!(h >= 1 && h <= 50 && Math.floor(h) === h)) add('headerRow', 'Рядок з назвами колонок — число від 1 до 50.');
    else if (!(r > h && r <= 60 && Math.floor(r) === r)) add('dataRow', 'Дані починаються нижче рядка з назвами — наприклад, з рядка ' + (h + 1) + '.');
    if (!cols[c.dateCol]) add('dateCol', 'Оберіть колонку з датою.');
    if (!cols[c.orderCol]) add('orderCol', 'Оберіть колонку з номером замовлення.');
    if (c.dateCol && c.dateCol === c.orderCol) add('orderCol', 'Дата й замовлення — у різних колонках.');
    if (c.weekStart !== 'mon' && c.weekStart !== 'sun') add('weekStart', 'Оберіть, з якого дня починається тиждень.');
    used[c.dateCol] = 1; used[c.orderCol] = 1;
    var deps = byId(locDeps(env, loc.id), 'id'), seen = {};
    if (!arr(c.depts).length) add('depts', 'Додайте хоча б один відділ — інакше нема звідки брати виробіток.');
    arr(c.depts).forEach(function (x, i) {
      var f = 'depts[' + i + ']';
      if (!x || !deps[x.departmentId]) { add(f + '.departmentId', 'Оберіть відділ у рядку ' + (i + 1) + '.'); return; }
      if (seen[x.departmentId]) add(f + '.departmentId', 'Відділ «' + deps[x.departmentId].name + '» уже є вище — кожен відділ один раз.');
      seen[x.departmentId] = 1;
      if (!cols[x.doneCol]) add(f + '.doneCol', 'Оберіть колонку «скільки зроблено» для відділу «' + deps[x.departmentId].name + '».');
      else if (used[x.doneCol]) add(f + '.doneCol', 'Колонка ' + x.doneCol + ' уже зайнята — оберіть іншу.');
      used[x.doneCol] = 1;
      if (x.planCol) {
        if (!cols[x.planCol]) add(f + '.planCol', 'Колонки ' + x.planCol + ' немає в таблиці.');
        else if (used[x.planCol]) add(f + '.planCol', 'Колонка ' + x.planCol + ' уже зайнята — оберіть іншу.');
        used[x.planCol] = 1;
      }
    });
    return errs;
  }

  var MAILS = [
    { id: 'audit_seniors', title: 'Старшим — про кожен аудит', when: 'одразу після запису аудиту', hasLevel: true, on: true, level: 'defects' },
    { id: 'audit_leads', title: 'Тімлідам відділів — їхні аудити', when: 'одразу після запису аудиту', hasLevel: true, on: true, level: 'defects' },
    { id: 'daily', title: 'Денний звіт цеху', on: true },
    { id: 'kd', title: 'Коригуючі дії', to: 'старшим цеху; керівникам — лише результат дії', when: 'розбір готовий (раз на 4 дні) · термін дії завтра · результат перевірки', on: true },
    { id: 'weekly', title: 'Тижневий звіт керівникам', to: 'канал #керівники', when: 'понеділок о 09:00', on: false }
  ];
  function slug(s) { return String(s).toLowerCase().replace(/\s+/g, '-'); }
  function mailState(env, loc) {
    var all = env.storage.get(K.mail, {}), s = all[loc.id] || {};
    var inc = {}; INCLUDE.forEach(function (k) { inc[k] = true; });
    return { items: s.items || {}, daily: s.daily || { to: ['#якість-' + slug(loc.name)], time: '18:00', days: [1, 2, 3, 4, 5, 6], include: inc },
      lastSent: s.lastSent || P.demoDates.kyivToIso(S.addDays(env.day(), -1), 18 * 60) };
  }
  function saveMail(env, loc, s) { var all = env.storage.get(K.mail, {}); all[loc.id] = s; env.storage.set(K.mail, all); }
  function dailyPreview(env, loc, me) {
    var today = env.day(), yest = S.addDays(today, -1), list = S.audits(env, loc.id, today, today);
    var deps = locDeps(env, loc.id).filter(function (d) { return d.active !== false; });
    var total = { checked: 0, rejected: 0, byLevel: { fix: 0, repair: 0, scrap: 0 } }, types = {}, worst = null, normsOk = 0, none = [];
    deps.forEach(function (d) {
      var st = S.deptStats(env, list, d.id);
      total.checked += st.checked; total.rejected += st.rejected;
      ['fix', 'repair', 'scrap'].forEach(function (k) { total.byLevel[k] += st.byLevel[k]; });
      each(st.byType, function (id, q) { types[id] = (types[id] || 0) + q; });
      var norm = env.db.norms.filter(function (n) { return n.departmentId === d.id; })[0];
      if (norm && st.checked >= norm.sampleTarget) normsOk++;
      if (!list.some(function (a) { return a.departmentId === d.id; })) none.push(d.name);
      var pct = C.pct(st.rejected, st.checked);
      if (pct != null && (!worst || pct > worst.pct)) worst = { name: d.name, pct: pct };
    });
    var top = Object.keys(types).sort(function (a, b) { return types[b] - types[a]; }).slice(0, 3)
      .map(function (id) { return { name: env.ix.def[id] ? env.ix.def[id].name : 'Невідомий вид браку', qty: types[id] }; });
    var by = {}; list.forEach(function (a) { by[a.auditorId] = (by[a.auditorId] || 0) + 1; });
    var aud = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).slice(0, 3)
      .map(function (id) { return { name: env.ix.user[id] ? env.ix.user[id].name : id, n: by[id] }; });
    var ord = []; list.slice().sort(C.newestFirst).forEach(function (a) { a.orders.forEach(function (o) { if (ord.indexOf(o) < 0) ord.push(o); }); });
    var y = S.audits(env, loc.id, yest, yest), yc = 0, yr = 0;
    y.forEach(function (a) { yc += C.checkedOf(a); yr += C.rejectedOf(a); });
    var kd = null;
    P.demoApis.forEach(function (api) {
      if (kd || !Object.prototype.hasOwnProperty.call(api, 'srKdOverview')) return;
      try { var r = api.srKdOverview({ locationId: loc.id }, me, env); if (r && r.ok && r.totals) kd = r.totals; } catch (e) { kd = null; }
    });
    return { day: today, audits: list.length, checked: total.checked, rejected: total.rejected, pct: C.pct(total.rejected, total.checked),
      byLevel: total.byLevel, normsOk: normsOk, depts: deps.length, noAudits: none, worst: worst, topDefects: top,
      kd: kd ? { new: kd.new || 0, review: kd.review || kd.check || 0 } : null, auditors: aud, orders: ord.slice(0, 3),
      yesterdayPct: C.pct(yr, yc) };
  }

  function mergeSet(p, env, loc, kind) {
    var cat = kind === 'products' ? env.db.products : env.db.defectTypes, ix = byId(cat, 'id');
    var ids = arr(p.ids).filter(function (id, i, a) { return a.indexOf(id) === i; });
    if (ids.indexOf(p.keepId) < 0) ids.unshift(p.keepId);
    var word = kind === 'products' ? 'вироби' : 'види браку';
    if (ids.length < 2) return { err: verr([{ field: 'ids', message: 'Позначте 2 або більше — тоді буде що обʼєднувати.' }]) };
    if (ids.length > 10) return { err: verr([{ field: 'ids', message: 'За раз можна обʼєднати до 10 — решту окремим кроком.' }]) };
    var list = ids.map(function (id) { return ix[id]; });
    if (list.some(function (x) { return !x; })) return { err: C.fail('not_found', 'Когось із обраних уже немає в довіднику — оновіть сторінку.') };
    var types = locTypes(env, loc.id);
    if (list.some(function (x) { return x.deptTypeId !== list[0].deptTypeId; })) return { err: verr([{ field: 'ids', message: 'Обʼєднати можна ' + word + ' одного типу відділу — оберіть їх в одному відділі.' }]) };
    if (!types[list[0].deptTypeId]) return { err: C.forbidden() };
    return { list: list, keep: ix[p.keepId], others: list.filter(function (x) { return x.id !== p.keepId; }) };
  }
  function productUse(env, ids) {
    var set = {}; ids.forEach(function (id) { set[id] = 1; });
    var audits = 0, orders = {};
    env.audits().forEach(function (a) {
      var hit = false;
      a.items.forEach(function (i) { if (set[i.productId]) { hit = true; if (i.orderNo) orders[i.orderNo] = 1; } });
      if (hit) audits++;
    });
    return { audits: audits, orders: Object.keys(orders).length };
  }
  function defectUse(env, ids) {
    var set = {}; ids.forEach(function (id) { set[id] = 1; });
    var audits = 0, records = 0, deps = {};
    env.audits().forEach(function (a) {
      var n = 0;
      a.defects.forEach(function (d) { if (set[d.defectTypeId]) { n++; deps[S.sourceDept(a, d)] = 1; } });
      if (n) { audits++; records += n; }
    });
    return { audits: audits, records: records, deptIds: Object.keys(deps) };
  }

  var api = {
    srMgTeam: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var list = locAudits(env, r.loc.id), today = env.day();
      var items = auditors(env, r.loc.id).map(function (u) {
        var last = null; list.forEach(function (a) { if (a.auditorId === u.id && (!last || a.createdAt > last)) last = a.createdAt; });
        var login = null;
        if (u.active !== false) {
          if (!last) login = { kind: 'never' };
          else { var until = S.addDays(P.fmt.dayKey(last), C.SESSION_DAYS); login = until >= today ? { kind: 'ok', until: until } : { kind: 'expired' }; }
        }
        return { id: u.id, name: u.name, email: S.maskEmail(u.email), active: u.active !== false, lastAuditAt: last, login: login, addedAt: u.addedAt || null };
      }).sort(function (a, b) { return (a.active ? 0 : 1) - (b.active ? 0 : 1) || a.name.localeCompare(b.name, 'uk'); });
      return { ok: true, location: { id: r.loc.id, name: r.loc.name }, counts: counts(env, r.loc.id), items: items };
    },

    srMgUserSave: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var st = env.storage.get(K.users, null) || { add: [], edit: {} }, u = null, errs = [], patch = {};
      if (p.id) {
        u = env.ix.user[p.id];
        if (!u || u.role !== 'auditor' || u.locationIds.indexOf(r.loc.id) < 0) return C.fail('not_found', 'Цього працівника немає в списку цеху — оновіть сторінку.');
      }
      if (!p.id || p.name !== undefined) {
        var name = clean(p.name, 60);
        if (name.length < 2) errs.push({ field: 'name', message: 'Впишіть імʼя та першу літеру прізвища — наприклад, «Петро Л.».' }); else patch.name = name;
      }
      if (!p.id || (p.email !== undefined && clean(p.email) !== '')) {
        var email = clean(p.email, 120).toLowerCase();
        if (!EMAIL.test(email)) errs.push({ field: 'email', message: 'Впишіть робочу пошту повністю — наприклад, petro.l@example.com.' });
        else if (env.db.users.some(function (x) { return x.id !== p.id && same(x.email, email); })) errs.push({ field: 'email', message: 'Ця пошта вже є в списку — у кожної людини своя.' });
        else patch.email = email;
      }
      if (p.active !== undefined) patch.active = !!p.active;
      if (errs.length) return verr(errs);
      var id = p.id;
      if (!id) {
        var pre = 'u_aud_' + r.loc.id.slice(4).toLowerCase(), n = 0;
        env.db.users.forEach(function (x) { if (x.id.indexOf(pre) === 0 && /^\d+$/.test(x.id.slice(pre.length))) n = Math.max(n, +x.id.slice(pre.length)); });
        id = pre + (n + 1);
        st.add.push({ id: id, name: patch.name, role: 'auditor', email: patch.email, locationIds: [r.loc.id], active: patch.active !== false,
          addedAt: env.now().toISOString(), addedBy: me.id });
      } else st.edit[id] = Object.assign(st.edit[id] || {}, patch);
      save(env, K.users, st);
      var x = env.ix.user[id];
      return { ok: true, id: id, name: x.name, active: x.active !== false, created: !p.id };
    },

    srMgWorkers: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var from = S.addDays(env.day(), -29), n30 = {}, max = 0;
      locAudits(env, r.loc.id).forEach(function (a) { if (a.day >= from) a.checkedWorkers.forEach(function (c) { n30[c] = (n30[c] || 0) + 1; }); });
      var deps = locDeps(env, r.loc.id);
      var items = env.db.workers.filter(function (w) { return w.locationId === r.loc.id; }).map(function (w) {
        max = Math.max(max, numOf(w.code));
        return { code: w.code, name: w.name, departmentId: w.departmentId, departmentName: env.ix.dep[w.departmentId] ? env.ix.dep[w.departmentId].name : '—',
          active: w.active !== false, audits30: n30[w.code] || 0, addedAt: w.addedAt || null };
      }).sort(function (a, b) { return numOf(a.code) - numOf(b.code) || (a.code < b.code ? -1 : 1); });
      return { ok: true, location: { id: r.loc.id, name: r.loc.name }, counts: counts(env, r.loc.id), items: items, nextNo: max + 1,
        departments: deps.map(function (d) { return { id: d.id, name: d.name, letter: env.ix.dt[d.deptTypeId].letter, active: d.active !== false }; }) };
    },

    srMgWorkerSave: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var st = env.storage.get(K.workers, null) || { add: [], edit: {} }, errs = [], patch = {}, w = null;
      if (p.code) {
        w = env.ix.worker[r.loc.id + ':' + p.code];
        if (!w) return C.fail('not_found', 'Працівника з кодом ' + p.code + ' немає в цьому цеху — оновіть сторінку.');
      }
      if (!p.code || p.name !== undefined) {
        var name = clean(p.name, 60);
        if (name.length < 2) errs.push({ field: 'name', message: 'Впишіть імʼя та першу літеру прізвища — наприклад, «Ірина П.».' }); else patch.name = name;
      }
      if (!p.code || p.departmentId !== undefined) {
        var d = env.ix.dep[p.departmentId];
        if (!d || d.locationId !== r.loc.id) errs.push({ field: 'departmentId', message: 'Оберіть відділ зі списку.' }); else patch.departmentId = d.id;
      }
      if (p.active !== undefined) patch.active = !!p.active;
      if (errs.length) return verr(errs);
      var code = p.code;
      if (!code) {
        var n = 0; env.db.workers.forEach(function (x) { if (x.locationId === r.loc.id) n = Math.max(n, numOf(x.code)); });
        code = env.ix.dt[env.ix.dep[patch.departmentId].deptTypeId].letter + '-' + pad3(n + 1);
        st.add.push({ code: code, name: patch.name, departmentId: patch.departmentId, locationId: r.loc.id, active: patch.active !== false, addedAt: env.now().toISOString() });
      } else { var k = r.loc.id + ':' + code; st.edit[k] = Object.assign(st.edit[k] || {}, patch); }
      save(env, K.workers, st);
      var x = env.ix.worker[r.loc.id + ':' + code];
      return { ok: true, code: code, name: x.name, active: x.active !== false, created: !p.code };
    },

    srMgCatalog: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var t = locTypes(env, r.loc.id), use = {};
      locAudits(env, r.loc.id).forEach(function (a) {
        var seen = {}; a.items.forEach(function (i) { if (!seen[i.productId]) { seen[i.productId] = 1; use[i.productId] = (use[i.productId] || 0) + 1; } });
      });
      var products = env.db.products.filter(function (x) { return t[x.deptTypeId]; }).map(function (x) {
        return { id: x.id, name: x.name, deptTypeId: x.deptTypeId, active: x.active !== false, audits: use[x.id] || 0, addedAt: x.addedAt || null };
      });
      return { ok: true, location: { id: r.loc.id, name: r.loc.name }, counts: counts(env, r.loc.id), products: products,
        departments: locDeps(env, r.loc.id).map(function (d) {
          return { id: d.id, name: d.name, deptTypeId: d.deptTypeId, active: d.active !== false,
            products: products.filter(function (x) { return x.deptTypeId === d.deptTypeId; }).length,
            shown: products.filter(function (x) { return x.deptTypeId === d.deptTypeId && x.active; }).length };
        }) };
    },

    srMgDeptSave: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var d = env.ix.dep[p.id];
      if (!d || d.locationId !== r.loc.id) return C.fail('not_found', 'Такого відділу немає в цьому цеху — оновіть сторінку.');
      if (typeof p.active !== 'boolean') return verr([{ field: 'active', message: 'Оберіть: відділ працює чи вимкнений.' }]);
      var st = env.storage.get(K.depts, null) || {};
      st[d.id] = Object.assign(st[d.id] || {}, { active: p.active });
      save(env, K.depts, st);
      return { ok: true, id: d.id, name: d.name, active: p.active };
    },

    srMgProductSave: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var st = env.storage.get(K.products, null) || { add: [], edit: {}, merge: {} }, x = null, errs = [], patch = {};
      var t = locTypes(env, r.loc.id);
      if (p.id) { x = env.ix.prod[p.id]; if (!x || !t[x.deptTypeId]) return C.fail('not_found', 'Такого виробу вже немає — можливо, його обʼєднали. Оновіть сторінку.'); }
      var dt = x ? x.deptTypeId : p.deptTypeId;
      if (!x && !t[dt]) errs.push({ field: 'deptTypeId', message: 'Оберіть відділ, для якого цей виріб.' });
      if (!x || p.name !== undefined) {
        var name = clean(p.name, 80);
        if (name.length < 2) errs.push({ field: 'name', message: 'Впишіть назву виробу — наприклад, «Худі базове».' });
        else if (env.db.products.some(function (y) { return y.id !== p.id && y.deptTypeId === dt && same(y.name, name); })) errs.push({ field: 'name', message: 'Виріб «' + name + '» уже є в цьому відділі — оберіть іншу назву або обʼєднайте їх.' });
        else patch.name = name;
      }
      if (p.active !== undefined) patch.active = !!p.active;
      if (errs.length) return verr(errs);
      var id = p.id;
      if (!id) {
        var n = 0; env.db.products.concat(arr(st.add)).forEach(function (y) { n = Math.max(n, numOf(y.id)); });
        Object.keys(st.merge || {}).forEach(function (k) { n = Math.max(n, numOf(k)); });
        id = 'PRD_' + pad3(n + 1);
        st.add.push({ id: id, name: patch.name, deptTypeId: dt, active: patch.active !== false, addedAt: env.now().toISOString() });
      } else st.edit[id] = Object.assign(st.edit[id] || {}, patch);
      save(env, K.products, st);
      var y = env.ix.prod[id];
      return { ok: true, id: id, name: y.name, active: y.active !== false, created: !p.id };
    },

    srMgDefects: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var t = locTypes(env, r.loc.id), use = {};
      locAudits(env, r.loc.id).forEach(function (a) {
        var seen = {};
        a.defects.forEach(function (d) {
          var u = use[d.defectTypeId] = use[d.defectTypeId] || { audits: 0, records: 0 };
          u.records++; if (!seen[d.defectTypeId]) { seen[d.defectTypeId] = 1; u.audits++; }
        });
      });
      var deps = locDeps(env, r.loc.id);
      var types = env.db.deptTypes.filter(function (x) { return t[x.id]; }).map(function (x) {
        return { id: x.id, name: x.name, departments: deps.filter(function (d) { return d.deptTypeId === x.id; }).map(function (d) { return d.name; }) };
      });
      var tn = byId(types, 'id');
      return { ok: true, location: { id: r.loc.id, name: r.loc.name }, counts: counts(env, r.loc.id), deptTypes: types,
        items: env.db.defectTypes.filter(function (x) { return t[x.deptTypeId]; }).map(function (x) {
          var u = use[x.id] || { audits: 0, records: 0 };
          return { id: x.id, name: x.name, deptTypeId: x.deptTypeId, departments: tn[x.deptTypeId].departments.join(', '),
            level: LEVELS[x.level] ? x.level : null, active: x.active !== false, audits: u.audits, records: u.records, addedAt: x.addedAt || null };
        }) };
    },

    srMgDefectSave: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var st = env.storage.get(K.defects, null) || { add: [], edit: {}, merge: {} }, x = null, errs = [], patch = {};
      var t = locTypes(env, r.loc.id);
      if (p.id) { x = env.ix.def[p.id]; if (!x || !t[x.deptTypeId]) return C.fail('not_found', 'Такого виду браку вже немає — можливо, його обʼєднали. Оновіть сторінку.'); }
      var dt = x ? x.deptTypeId : p.deptTypeId;
      if (!x && !t[dt]) errs.push({ field: 'deptTypeId', message: 'Оберіть відділ, де трапляється цей брак.' });
      if (!x || p.name !== undefined) {
        var name = clean(p.name, 80);
        if (name.length < 2) errs.push({ field: 'name', message: 'Впишіть назву виду браку — наприклад, «Розрив шва».' });
        else if (env.db.defectTypes.some(function (y) { return y.id !== p.id && y.deptTypeId === dt && same(y.name, name); })) errs.push({ field: 'name', message: 'Вид «' + name + '» уже є в цьому відділі — оберіть іншу назву або обʼєднайте їх.' });
        else patch.name = name;
      }
      if (!x || p.level !== undefined) {
        if (!LEVELS[p.level]) errs.push({ field: 'level', message: 'Оберіть рівень: неправильно зроблене, пошкоджене чи зламане.' }); else patch.level = p.level;
      }
      if (p.active !== undefined) patch.active = !!p.active;
      if (errs.length) return verr(errs);
      var id = p.id;
      if (!id) {
        var n = 0; env.db.defectTypes.concat(arr(st.add)).forEach(function (y) { n = Math.max(n, numOf(y.id)); });
        Object.keys(st.merge || {}).forEach(function (k) { n = Math.max(n, numOf(k)); });
        id = 'DEF_' + pad3(n + 1);
        st.add.push({ id: id, name: patch.name, deptTypeId: dt, severity: 2, level: patch.level, active: patch.active !== false, addedAt: env.now().toISOString() });
      } else st.edit[id] = Object.assign(st.edit[id] || {}, patch);
      save(env, K.defects, st);
      var y = env.ix.def[id];
      return { ok: true, id: id, name: y.name, level: y.level, active: y.active !== false, created: !p.id };
    },

    srMgMergePreview: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var kind = p.kind === 'defects' ? 'defects' : 'products', m = mergeSet(p, env, r.loc, kind); if (m.err) return m.err;
      var otherIds = m.others.map(function (x) { return x.id; }), allIds = m.list.map(function (x) { return x.id; });
      if (kind === 'products') {
        return { ok: true, kind: kind, keepId: m.keep.id, keepName: m.keep.name,
          items: m.list.map(function (x) { var u = productUse(env, [x.id]); return { id: x.id, name: x.name, audits: u.audits, orders: u.orders, addedAt: x.addedAt || null }; }),
          moving: productUse(env, otherIds), after: productUse(env, allIds) };
      }
      var mv = defectUse(env, otherIds), af = defectUse(env, allIds), lv = {};
      m.list.forEach(function (x) { lv[x.level || 'fix'] = 1; });
      return { ok: true, kind: kind, keepId: m.keep.id, keepName: m.keep.name, keepLevel: m.keep.level || 'fix', levelsDiffer: Object.keys(lv).length > 1,
        deptTypeName: env.ix.dt[m.keep.deptTypeId].name,
        items: m.list.map(function (x) { var u = defectUse(env, [x.id]); return { id: x.id, name: x.name, level: x.level || 'fix', audits: u.audits, records: u.records, addedAt: x.addedAt || null }; }),
        moving: { audits: mv.audits, records: mv.records }, after: { audits: af.audits, records: af.records },
        departments: af.deptIds.map(function (id) { return env.ix.dep[id] ? env.ix.dep[id].name + ' (' + env.ix.loc[env.ix.dep[id].locationId].name + ')' : id; }) };
    },

    srMgMerge: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var kind = p.kind === 'defects' ? 'defects' : 'products', m = mergeSet(p, env, r.loc, kind); if (m.err) return m.err;
      if (kind === 'defects' && p.level !== undefined && !LEVELS[p.level]) return verr([{ field: 'level', message: 'Оберіть рівень для обʼєднаного виду.' }]);
      var otherIds = m.others.map(function (x) { return x.id; });
      var moved = kind === 'products' ? productUse(env, otherIds) : defectUse(env, otherIds);
      var key = kind === 'products' ? K.products : K.defects;
      var st = env.storage.get(key, null) || { add: [], edit: {}, merge: {} };
      st.merge = st.merge || {}; st.edit = st.edit || {};
      otherIds.forEach(function (id) { st.merge[id] = m.keep.id; });
      if (kind === 'defects' && p.level) st.edit[m.keep.id] = Object.assign(st.edit[m.keep.id] || {}, { level: p.level });
      save(env, key, st);
      return { ok: true, keepId: m.keep.id, keepName: m.keep.name, removed: m.others.map(function (x) { return x.name; }),
        moved: kind === 'products' ? { audits: moved.audits, orders: moved.orders } : { audits: moved.audits, records: moved.records } };
    },

    srMgBlocks: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var G = P.demoDict.garments, orders = env.db.orders.filter(function (o) { return o.locationId === r.loc.id; });
      var blocks = env.db.orderBlocks.filter(function (b) { return b.locationId === r.loc.id; }), inBlock = {};
      blocks.forEach(function (b) { b.orders.forEach(function (no) { inBlock[no] = b; }); });
      var on = byId(orders, 'no'), audits = locAudits(env, r.loc.id);
      function prods(o) { return o ? o.garments.map(function (g) { return G[g]; }) : []; }
      return { ok: true, location: { id: r.loc.id, name: r.loc.name }, counts: counts(env, r.loc.id),
        items: blocks.map(function (b) {
          var n = 0, last = null, set = {}; b.orders.forEach(function (no) { set[no] = 1; });
          audits.forEach(function (a) { if (a.orders.some(function (o) { return set[o]; })) { n++; if (!last || a.createdAt > last) last = a.createdAt; } });
          var names = []; b.orders.forEach(function (no) { prods(on[no]).forEach(function (x) { if (names.indexOf(x) < 0) names.push(x); }); });
          return { id: b.id, name: b.name, orders: b.orders.slice(), products: names, audits: n, lastAuditAt: last };
        }),
        orders: orders.slice().sort(function (a, b) { return a.lastDay < b.lastDay ? 1 : a.lastDay > b.lastDay ? -1 : a.no < b.no ? 1 : -1; })
          .map(function (o) { return { no: o.no, customer: o.customer, products: prods(o), lastDay: o.lastDay, blockId: inBlock[o.no] ? inBlock[o.no].id : null, blockName: inBlock[o.no] ? inBlock[o.no].name : null }; }) };
    },

    srMgBlockSave: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var list = env.db.orderBlocks.filter(function (b) { return b.locationId === r.loc.id; }).map(function (b) { return { id: b.id, locationId: b.locationId, name: b.name, orders: b.orders.slice() }; });
      var cur = p.id ? list.filter(function (b) { return b.id === p.id; })[0] : null;
      if (p.id && !cur) return C.fail('not_found', 'Такого блоку вже немає — оновіть сторінку.');
      var errs = [], name = clean(p.name, 40), on = {};
      env.db.orders.forEach(function (o) { if (o.locationId === r.loc.id) on[o.no] = 1; });
      if (!name) errs.push({ field: 'name', message: 'Дайте блоку назву — наприклад, «Блок 3».' });
      else if (list.some(function (b) { return b.id !== p.id && same(b.name, name); })) errs.push({ field: 'name', message: 'Блок «' + name + '» уже є — оберіть іншу назву.' });
      var orders = arr(p.orders).map(function (x) { return clean(x, 20); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
      if (!orders.length) errs.push({ field: 'orders', message: 'Додайте хоча б одне замовлення.' });
      else if (orders.length > 20) errs.push({ field: 'orders', message: 'У блоці — до 20 замовлень.' });
      orders.forEach(function (no) {
        if (!on[no]) errs.push({ field: 'orders', message: 'Замовлення ' + no + ' немає в цьому цеху.' });
        var other = list.filter(function (b) { return b.id !== p.id && b.orders.indexOf(no) >= 0; })[0];
        if (other) errs.push({ field: 'orders', message: 'Замовлення ' + no + ' уже в «' + other.name + '» — приберіть його звідти або оберіть інше.' });
      });
      if (errs.length) return verr(errs);
      var id = p.id;
      if (cur) { cur.name = name; cur.orders = orders; }
      else {
        var pre = 'BLK_' + r.loc.id.slice(4), n = 0;
        list.forEach(function (b) { n = Math.max(n, numOf(b.id)); });
        id = pre + (n + 1);
        list.push({ id: id, locationId: r.loc.id, name: name, orders: orders });
      }
      var all = env.storage.get(K.blocks, {}); all[r.loc.id] = list;
      save(env, K.blocks, all);
      return { ok: true, id: id, name: name, orders: orders, created: !p.id };
    },

    srMgBlockDelete: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var list = env.db.orderBlocks.filter(function (b) { return b.locationId === r.loc.id; });
      var b = list.filter(function (x) { return x.id === p.id; })[0];
      if (!b) return C.fail('not_found', 'Такого блоку вже немає — оновіть сторінку.');
      var all = env.storage.get(K.blocks, {});
      all[r.loc.id] = list.filter(function (x) { return x.id !== p.id; }).map(function (x) { return { id: x.id, locationId: x.locationId, name: x.name, orders: x.orders.slice() }; });
      save(env, K.blocks, all);
      return { ok: true, id: b.id, name: b.name };
    },

    srMgImport: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var s = importState(env, r.loc);
      return { ok: true, location: { id: r.loc.id, name: r.loc.name }, counts: counts(env, r.loc.id), updatedAt: s.updatedAt,
        nextAt: P.demoDates.kyivToIso(S.addDays(env.day(), 1), 6 * 60), config: s.config, week: weekRows(env, r.loc, s.config),
        columns: sheetColumns(env, r.loc.id), departments: locDeps(env, r.loc.id).map(function (d) { return { id: d.id, name: d.name, active: d.active !== false }; }) };
    },

    srMgImportRefresh: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var all = env.storage.get(K.imp, {}), s = importState(env, r.loc);
      s.updatedAt = env.now().toISOString(); all[r.loc.id] = s; env.storage.set(K.imp, all);
      return { ok: true, updatedAt: s.updatedAt };
    },

    srMgImportSave: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var c = p.config || {}, errs = checkImport(env, r.loc, c);
      if (errs.length) return verr(errs);
      var cfg = { url: clean(c.url, 400), title: 'Виробіток ' + r.loc.name, sheet: clean(c.sheet, 60), headerRow: +c.headerRow, dataRow: +c.dataRow,
        dateCol: c.dateCol, orderCol: c.orderCol, weekStart: c.weekStart,
        depts: arr(c.depts).map(function (x) { return { departmentId: x.departmentId, doneCol: x.doneCol, planCol: x.planCol || null }; }) };
      var all = env.storage.get(K.imp, {}); all[r.loc.id] = { config: cfg, updatedAt: env.now().toISOString() };
      env.storage.set(K.imp, all);
      return { ok: true, updatedAt: all[r.loc.id].updatedAt, departments: cfg.depts.length };
    },

    srMgMailing: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var s = mailState(env, r.loc), deps = locDeps(env, r.loc.id).filter(function (d) { return d.active !== false; });
      var seniors = env.db.users.filter(function (u) { return u.role === 'senior_auditor' && u.locationIds.indexOf(r.loc.id) >= 0 && u.active !== false; })
        .map(function (u) { return u.name; });
      var days = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
      return { ok: true, location: { id: r.loc.id, name: r.loc.name }, counts: counts(env, r.loc.id), lastSent: s.lastSent, daily: s.daily,
        preview: dailyPreview(env, r.loc, me), includeKeys: INCLUDE.slice(),
        items: MAILS.map(function (m) {
          var o = s.items[m.id] || {}, it = { id: m.id, title: m.title, on: o.on !== undefined ? o.on : m.on, hasLevel: !!m.hasLevel,
            level: m.hasLevel ? (o.level || m.level) : null, to: m.to || '', when: m.when || '' };
          if (m.id === 'audit_seniors') it.to = (seniors.join(', ') || 'старші цеху') + ' — особисто';
          if (m.id === 'audit_leads') it.to = deps.length + ' ' + plural(deps.length, ['тімлід', 'тімліди', 'тімлідів']) + ' — кожен лише про свій відділ';
          if (m.id === 'daily') {
            var n = INCLUDE.filter(function (k) { return s.daily.include[k]; }).length;
            it.to = s.daily.to.join(', ') || 'нікому';
            it.when = (s.daily.days.length === 7 ? 'щодня' : s.daily.days.length === 6 && s.daily.days.indexOf(0) < 0 ? 'щодня, крім неділі,' : s.daily.days.slice().sort().map(function (d) { return days[d]; }).join(', ')) + ' о ' + s.daily.time;
            it.what = n + ' ' + plural(n, ['показник', 'показники', 'показників']) + ' з ' + INCLUDE.length;
          }
          return it;
        }) };
    },

    srMgMailingSave: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var m = MAILS.filter(function (x) { return x.id === p.id; })[0];
      if (!m) return C.fail('not_found', 'Такої розсилки немає — оновіть сторінку.');
      var s = mailState(env, r.loc), o = s.items[m.id] = Object.assign({}, s.items[m.id] || {}), errs = [];
      if (p.on !== undefined) o.on = !!p.on;
      if (p.level !== undefined) { if (!m.hasLevel || !DAILY_LEVELS[p.level]) errs.push({ field: 'level', message: 'Оберіть: усе, тільки з браком чи тільки понад 5%.' }); else o.level = p.level; }
      if (p.daily !== undefined) {
        if (m.id !== 'daily') return C.fail('validation', 'Ці налаштування — лише для денного звіту.');
        var d = p.daily || {}, to = arr(d.to).map(function (x) { return clean(x, 60); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
        var days = arr(d.days).filter(function (x, i, a) { return x >= 0 && x <= 6 && Math.floor(x) === x && a.indexOf(x) === i; });
        if (!to.length) errs.push({ field: 'to', message: 'Додайте, кому надсилати: канал (#якість-цех) чи людину.' });
        if (to.length > 10) errs.push({ field: 'to', message: 'До 10 отримувачів — для більшого кола краще канал.' });
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(d.time || ''))) errs.push({ field: 'time', message: 'Вкажіть час у форматі 18:00.' });
        if (!days.length) errs.push({ field: 'days', message: 'Оберіть хоча б один день.' });
        var inc = {}; INCLUDE.forEach(function (k) { inc[k] = !!(d.include && d.include[k]); });
        if (!INCLUDE.some(function (k) { return inc[k]; })) errs.push({ field: 'include', message: 'Оберіть хоча б один показник — інакше звіт буде порожній.' });
        if (!errs.length) s.daily = { to: to, time: d.time, days: days.sort(), include: inc };
      }
      if (errs.length) return verr(errs);
      saveMail(env, r.loc, s);
      return { ok: true, id: m.id, title: m.title, on: o.on !== undefined ? o.on : m.on, level: m.hasLevel ? (o.level || m.level) : null };
    },

    srMgMailingSend: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      if (p.id !== 'daily') return C.fail('not_found', 'Надіслати вручну можна лише денний звіт.');
      var at = env.now().toISOString();
      if (!p.test) { var s = mailState(env, r.loc); s.lastSent = at; saveMail(env, r.loc, s); }
      return { ok: true, sentAt: at, test: !!p.test };
    }
  };

  P.demoApis.push(api);
  P.demoManage = { KEYS: K, INCLUDE: INCLUDE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
