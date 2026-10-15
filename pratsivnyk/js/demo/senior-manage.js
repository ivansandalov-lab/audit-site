(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, S = P.demoSenior;
  P.demoApis = P.demoApis || []; P.demoLoadHooks = P.demoLoadHooks || []; P.demoResetKeys = P.demoResetKeys || [];

  var K = { users: 'demo:sr:mg:users', workers: 'demo:sr:mg:workers', depts: 'demo:sr:mg:depts', products: 'demo:sr:mg:products',
    defects: 'demo:sr:mg:defects', blocks: 'demo:sr:mg:blocks', imp: 'demo:sr:mg:import', mail: 'demo:sr:mg:mailing', journal: 'demo:sr:mg:journal' };
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
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function pick(ix, id) { return typeof id === 'string' && has(ix, id) ? ix[id] : null; }
  function squash(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function isInt(n, min, max) { return typeof n === 'number' && Math.floor(n) === n && n >= min && n <= max; }

  var NORM_MAX = 10000, DEPTS_MAX = 12, WORKER_NAME_MAX = 40;
  var WORKER_NAME_MSG = 'Впишіть, як працівник підписаний у цеху — наприклад, q5.';

  function guard(p, me, env) {
    var r = S.loc(p || {}, me, env); if (r.err) return r;
    if (!r.loc) return { err: C.fail('not_found', 'Локацію не знайдено.') };
    if (!S.canManage(me)) return { err: C.forbidden() };
    return r;
  }
  function guardW(p, me, env) {
    var r = guard(p, me, env); if (r.err) return r;
    env.reload();
    return { loc: env.ix.loc[r.loc.id] };
  }
  function save(env, key, val) { env.storage.set(key, val); env.reload(); }
  function locDeps(env, locId) { return env.db.departments.filter(function (d) { return d.locationId === locId; }); }
  function locTypes(env, locId) { var t = {}; locDeps(env, locId).forEach(function (d) { t[d.deptTypeId] = true; }); return t; }
  function auditors(env, locId) { return env.db.users.filter(function (u) { return u.role === 'auditor' && u.locationIds.indexOf(locId) >= 0; }); }
  function locAudits(env, locId) { return env.audits().filter(function (a) { return a.locationId === locId; }); }
  function locWorkers(env, locId) { return env.db.workers.filter(function (w) { return w.locationId === locId; }); }
  function depName(env, id) { var d = pick(env.ix.dep, id); return d ? d.name : '—'; }
  function workerStore(env) { var st = env.storage.get(K.workers, null) || {}; return { add: arr(st.add), edit: st.edit || {} }; }
  function workerByName(env, locId, name) { return locWorkers(env, locId).filter(function (w) { return same(w.name, name); })[0] || null; }
  function nextWorkerCode(env, locId, depId) {
    var n = 0; locWorkers(env, locId).forEach(function (x) { n = Math.max(n, numOf(x.code)); });
    return env.ix.dt[env.ix.dep[depId].deptTypeId].letter + '-' + pad3(n + 1);
  }

  var J_SECTIONS = { team: 'Аудитори', workers: 'Виробничі працівники', depts: 'Відділи', products: 'Вироби', defects: 'Види браку',
    merge: 'Обʼєднання', blocks: 'Блоки замовлень', import: 'Виробництво', mailing: 'Розсилки' };
  var JOURNAL_DAYS = 30, JOURNAL_MAX = 1500, JOURNAL_SHOW = 300;
  var DAY_NAMES = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var DAILY_LABELS = { all: 'усе', defects: 'тільки з браком', over5: 'тільки понад 5%' };
  function jv(v) { return v === true ? 'увімкнено' : v === false ? 'вимкнено' : v == null || v === '' ? '—' : String(v); }
  function diff(rows) {
    return rows.map(function (x) { return { label: x[0], from: jv(x[1]), to: jv(x[2]) }; }).filter(function (c) { return c.from !== c.to; });
  }
  function journalFrom(env) { return new Date(env.now().getTime() - JOURNAL_DAYS * 86400000).toISOString(); }
  function journal(env, me, locId, section, action, what, changes) {
    if (action === 'edit' && !changes.length) return;
    var from = journalFrom(env), n = 0;
    var list = arr(env.storage.get(K.journal, [])).filter(function (x) { return x && typeof x.at === 'string' && x.at >= from; });
    list.forEach(function (x) { n = Math.max(n, numOf(x.id)); });
    list.push({ id: 'J' + (n + 1), at: env.now().toISOString(), locationId: locId, section: section, action: action, what: String(what == null ? '' : what),
      by: me.id, byName: me.name, changes: changes });
    env.storage.set(K.journal, list.slice(-JOURNAL_MAX));
  }
  function tableFacts(env, t) {
    return { title: t.title, sheet: t.sheet, rows: 'заголовки в рядку ' + t.headerRow + ', дані з рядка ' + t.dataRow, cols: 'дата ' + t.dateCol + ' · замовлення ' + t.orderCol,
      depts: arr(t.depts).map(function (x) { return depName(env, x.departmentId) + ' ' + x.doneCol + (x.planCol ? '/' + x.planCol : ''); }).join(', ') };
  }
  function dailyFacts(d) {
    return { to: d.to.join(', '), time: d.time, days: d.days.slice().sort().map(function (x) { return DAY_NAMES[x]; }).join(', '),
      include: INCLUDE.filter(function (k) { return d.include[k]; }).length + ' з ' + INCLUDE.length };
  }

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
      if (Array.isArray(d.photos) && d.photos.length) t.photos = arr(t.photos).concat(d.photos).slice(0, 3);   // фото обох рядків — до 3 (межа форми) v1.2
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
  function deptStore(st) {
    var raw = st.get(K.depts, null) || {};
    if (has(raw, 'edit') || has(raw, 'add') || has(raw, 'norms')) return { edit: raw.edit || {}, add: arr(raw.add), norms: raw.norms || {} };
    return { edit: raw, add: [], norms: {} };
  }
  function applyOverlay(db, st) {
    var u = st.get(K.users, null), w = st.get(K.workers, null), d = deptStore(st);
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
    d.add.forEach(function (x) { db.departments.push(Object.assign({}, x)); });
    var di = byId(db.departments, 'id');
    each(d.edit, function (id, e) { if (has(di, id)) Object.assign(di[id], e); });
    each(d.norms, function (id, n) {
      if (!has(di, id)) return;
      var row = db.norms.filter(function (x) { return x.departmentId === id; })[0];
      if (row) row.sampleTarget = n; else db.norms.push({ departmentId: id, sampleTarget: n });
    });
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

  var MARKS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];
  var SHEETS = [
    { title: 'Виробіток', sheet: 'Тиждень', headerRow: 2, lead: ['Дата', 'Замовлення'], done: '{d}, шт', plan: '{d}, план' },
    { title: 'Змінний звіт', sheet: 'Зміни', headerRow: 1, lead: ['№ рядка', 'Дата зміни', 'Номер замовлення'], done: 'Зроблено · {d}', plan: 'Треба · {d}' },
    { title: 'План і факт', sheet: 'Факт-план', headerRow: 3, lead: ['Дата', 'Замовник', 'Замовлення', 'Примітка'], done: '{d} факт', plan: '{d} план' }
  ];
  function colLetter(i) { return i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(39 + i); }
  function sheetOf(mark) { return SHEETS[(mark || 0) % SHEETS.length]; }
  function sheetColumns(env, locId, mark) {
    var v = sheetOf(mark), cols = v.lead.map(function (n, i) { return { col: colLetter(i), name: n }; });
    locDeps(env, locId).forEach(function (d) {
      cols.push({ col: colLetter(cols.length), name: v.done.replace('{d}', d.name) });
      cols.push({ col: colLetter(cols.length), name: v.plan.replace('{d}', d.name) });
    });
    return cols;
  }
  function defaultTable(env, loc) {
    return { id: 'T1', mark: 0, title: 'Виробіток ' + loc.name, url: 'https://example.com/demo-vyrobnytstvo-' + loc.id.toLowerCase(),
      sheet: 'Тиждень', headerRow: 2, dataRow: 3, dateCol: 'A', orderCol: 'B',
      depts: locDeps(env, loc.id).map(function (d, i) { return { departmentId: d.id, doneCol: colLetter(2 + i * 2), planCol: colLetter(3 + i * 2) }; }) };
  }
  function tableOf(t, i, loc) {
    t = t || {};
    return { id: typeof t.id === 'string' && t.id ? t.id : 'T' + (i + 1), mark: isInt(t.mark, 0, MARKS.length - 1) ? t.mark : i % MARKS.length,
      title: t.title || 'Виробіток ' + loc.name, url: t.url || '', sheet: t.sheet || '', headerRow: +t.headerRow || 1, dataRow: +t.dataRow || 2,
      dateCol: t.dateCol || '', orderCol: t.orderCol || '',
      depts: arr(t.depts).filter(Boolean).map(function (x) { return { departmentId: x.departmentId, doneCol: x.doneCol, planCol: x.planCol || null }; }) };
  }
  function importState(env, loc) {
    var all = env.storage.get(K.imp, {}) || {}, s = all[loc.id] || {};
    var raw = Array.isArray(s.tables) ? s.tables : s.config ? [s.config] : [defaultTable(env, loc)];
    var ws = s.weekStart || (s.config && s.config.weekStart);
    return { tables: raw.map(function (t, i) { return tableOf(t, i, loc); }), weekStart: ws === 'sun' ? 'sun' : 'mon',
      updatedAt: s.updatedAt || P.demoDates.kyivToIso(env.day(), 6 * 60 + 2) };
  }
  function saveImport(env, loc, st) {
    var all = env.storage.get(K.imp, {}) || {};
    all[loc.id] = { tables: st.tables, weekStart: st.weekStart, updatedAt: st.updatedAt };
    env.storage.set(K.imp, all);
  }
  function tableView(env, loc, t) { return Object.assign({}, t, { label: MARKS[t.mark], columns: sheetColumns(env, loc.id, t.mark) }); }
  function overlaps(env, loc, tables) {
    var out = [];
    locDeps(env, loc.id).forEach(function (d) {
      var labels = tables.filter(function (t) { return t.depts.some(function (x) { return x.departmentId === d.id && x.doneCol; }); }).map(function (t) { return MARKS[t.mark]; });
      if (labels.length > 1) out.push({ departmentId: d.id, name: d.name, labels: labels, message: d.name + ' — у таблицях ' + labels.join(' і ') + ': кількості з цих таблиць додаються.' });
    });
    return out;
  }
  function dayPlan(orders, depId, day) {
    return orders.reduce(function (s, o) { return s + (o.firstDay <= day && day <= o.lastDay ? (o.daily[depId] || 0) : 0); }, 0);
  }
  function weekRows(env, loc, st) {
    var today = env.day(), dow = P.demoDates.dow(today);
    var back = st.weekStart === 'sun' ? dow : (dow + 6) % 7, from = S.addDays(today, -back), yest = S.addDays(today, -1);
    var orders = env.db.orders.filter(function (o) { return o.locationId === loc.id; });
    var days = []; for (var i = 0; i < 7; i++) { var k = S.addDays(from, i); if (P.demoDates.dow(k) !== 0) days.push(k); }
    var rows = locDeps(env, loc.id).filter(function (d) { return d.active !== false; }).map(function (d) {
      var src = [], nPlan = 0;
      st.tables.forEach(function (t) {
        var x = t.depts.filter(function (y) { return y.departmentId === d.id && y.doneCol; })[0];
        if (x) { src.push({ id: t.id, mark: t.mark, label: MARKS[t.mark] }); if (x.planCol) nPlan++; }
      });
      var norm = env.db.norms.filter(function (n) { return n.departmentId === d.id; })[0];
      var row = { departmentId: d.id, name: d.name, connected: src.length > 0, planKnown: nPlan > 0, sources: src,
        doneYesterday: null, planWeek: null, doneWeek: null, pct: null, sampleTarget: norm ? norm.sampleTarget : null };
      if (!row.connected) return row;
      row.doneYesterday = (P.demoDates.dow(yest) === 0 ? 0 : dayPlan(orders, d.id, yest)) * src.length;
      row.doneWeek = days.filter(function (k) { return k < today; }).reduce(function (s, k) { return s + dayPlan(orders, d.id, k); }, 0) * src.length;
      if (row.planKnown) {
        row.planWeek = days.reduce(function (s, k) { return s + dayPlan(orders, d.id, k); }, 0) * nPlan;
        row.pct = row.planWeek ? Math.round(row.doneWeek / row.planWeek * 100) : null;
      }
      return row;
    });
    return { from: from, rows: rows };
  }
  function checkTable(env, loc, c, i, mark) {
    var errs = [], cols = {}, used = {}, pre = 'tables[' + i + '].';
    sheetColumns(env, loc.id, mark).forEach(function (x) { cols[x.col] = x.name; });
    function add(f, m) { errs.push({ field: pre + f, message: m, table: i, label: MARKS[mark] }); }
    var title = squash(c.title), url = squash(c.url), sheet = squash(c.sheet);
    if (!title || title.length > 60) add('title', 'Назва таблиці — від 1 до 60 знаків.');
    if (!/^https:\/\/\S+$/.test(url) || url.length > 400) add('url', 'Посилання має починатися з https://');
    if (!sheet || sheet.length > 60) add('sheet', 'Впишіть назву аркуша.');
    var h = +c.headerRow, r = +c.dataRow;
    if (!isInt(h, 1, 50)) add('headerRow', 'Рядок із заголовками колонок — число від 1 до 50.');
    else if (!(isInt(r, 1, 60) && r > h)) add('dataRow', 'Дані — нижче рядка із заголовками: з рядка ' + (h + 1) + '.');
    if (!has(cols, c.dateCol)) add('dateCol', 'Оберіть колонку дати.'); else used[c.dateCol] = 'дати';
    if (!has(cols, c.orderCol)) add('orderCol', 'Оберіть колонку замовлення.');
    else if (c.dateCol === c.orderCol) add('orderCol', 'Дата й замовлення — у різних колонках.');
    else used[c.orderCol] = 'замовлення';
    var deps = byId(locDeps(env, loc.id), 'id'), seen = {};
    if (!arr(c.depts).length) add('depts', 'Додайте хоча б один відділ.');
    arr(c.depts).forEach(function (x, k) {
      var f = 'depts[' + k + '].', d = x ? pick(deps, x.departmentId) : null;
      if (!d) { add(f + 'departmentId', 'Оберіть відділ у рядку ' + (k + 1) + '.'); return; }
      if (seen[d.id]) add(f + 'departmentId', 'Відділ «' + d.name + '» уже є в цій таблиці.');
      seen[d.id] = 1;
      var who = 'відділу «' + d.name + '»';
      if (!has(cols, x.doneCol)) add(f + 'doneCol', 'Оберіть колонку «зроблено» для відділу «' + d.name + '».');
      else if (used[x.doneCol]) add(f + 'doneCol', 'Колонку ' + x.doneCol + ' уже вибрано для ' + used[x.doneCol] + '.');
      else used[x.doneCol] = who;
      if (x.planCol) {
        if (!has(cols, x.planCol)) add(f + 'planCol', 'Колонки ' + x.planCol + ' немає в таблиці.');
        else if (used[x.planCol]) add(f + 'planCol', 'Колонку ' + x.planCol + ' уже вибрано для ' + used[x.planCol] + '.');
        else used[x.planCol] = who;
      }
    });
    return errs;
  }

  var MAILS = [
    { id: 'audit_seniors', title: 'Старшим — про кожен аудит', when: 'одразу після запису аудиту', hasLevel: true, on: true, level: 'defects' },
    { id: 'over_seniors', title: 'Старшим — брак за сьогодні понад критичний рівень', when: 'щойно брак, % локації за сьогодні перевищить критичний рівень (раз на день)', on: true },
    { id: 'audit_leads', title: 'Тімлідам відділів — їхні аудити', when: 'одразу після запису аудиту', hasLevel: true, on: true, level: 'defects' },
    { id: 'daily', title: 'Денний звіт цеху', on: true },
    { id: 'kd', title: 'Сигнал коригуючих дій', to: 'старшим цеху; керівникам — лише брак, % після дії', when: 'щойно готовий новий розбір коригуючих дій (раз на тиждень)', on: true },
    { id: 'weekly', title: 'Тижневий підсумок керівникам', to: 'канал #керівники', when: 'понеділок о 09:00', on: false }
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
    if (ids.length < 2) return { err: verr([{ field: 'ids', message: 'Оберіть записи для обʼєднання — щонайменше два.' }]) };
    if (ids.length > 11) return { err: verr([{ field: 'ids', message: 'За один раз можна обʼєднати до 10 записів в один.' }]) };
    var list = ids.map(function (id) { return pick(ix, id); });
    if (list.some(function (x) { return !x; })) return { err: C.fail('not_found', 'Когось із обраних уже немає в списку — оновіть сторінку.') };
    var types = locTypes(env, loc.id);
    if (list.some(function (x) { return x.deptTypeId !== list[0].deptTypeId; })) return { err: verr([{ field: 'ids', message: 'Обʼєднуються лише ' + word + ' одного типу відділу.' }]) };
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
    srMgJournal: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var from = journalFrom(env), seen = {}, people = [];
      var all = arr(env.storage.get(K.journal, [])).filter(function (x) {
        return x && x.locationId === r.loc.id && typeof x.at === 'string' && x.at >= from && has(J_SECTIONS, x.section);
      });
      all.forEach(function (x) {
        if (!has(seen, x.by)) { seen[x.by] = { id: String(x.by), name: String(x.byName || x.by), n: 0 }; people.push(seen[x.by]); }
        seen[x.by].n++;
      });
      var sec = typeof p.section === 'string' && has(J_SECTIONS, p.section) ? p.section : '';
      var by = typeof p.by === 'string' && has(seen, p.by) ? p.by : '';
      var list = all.filter(function (x) { return (!sec || x.section === sec) && (!by || x.by === by); })
        .sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : numOf(b.id) - numOf(a.id); });
      return { ok: true, location: { id: r.loc.id, name: r.loc.name }, counts: counts(env, r.loc.id), days: JOURNAL_DAYS, from: from,
        section: sec, by: by, total: list.length, shown: Math.min(list.length, JOURNAL_SHOW),
        sections: Object.keys(J_SECTIONS).map(function (k) { return { id: k, label: J_SECTIONS[k], n: all.filter(function (x) { return x.section === k; }).length }; }),
        people: people.sort(function (a, b) { return b.n - a.n || a.name.localeCompare(b.name, 'uk'); }),
        items: list.slice(0, JOURNAL_SHOW).map(function (x) {
          return { id: x.id, at: x.at, section: x.section, sectionLabel: J_SECTIONS[x.section], action: x.action, what: String(x.what || ''),
            by: String(x.by), byName: String(x.byName || x.by),
            changes: arr(x.changes).filter(Boolean).map(function (c) { return { label: String(c.label), from: String(c.from), to: String(c.to) }; }) };
        }) };
    },

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
        return { id: u.id, name: u.name, email: S.maskEmail(u.email), active: u.active !== false && !u.accessOff, byAdmin: !!u.accessOff, lastAuditAt: last, login: login, addedAt: u.addedAt || null };
      }).sort(function (a, b) { return (a.active ? 0 : 1) - (b.active ? 0 : 1) || a.name.localeCompare(b.name, 'uk'); });
      return { ok: true, location: { id: r.loc.id, name: r.loc.name }, counts: counts(env, r.loc.id), items: items };
    },

    srMgUserSave: function (p, me, env) {
      var r = guardW(p, me, env); if (r.err) return r.err;
      var st = env.storage.get(K.users, null) || { add: [], edit: {} }, u = null, errs = [], patch = {};
      if (p.id) {
        u = pick(env.ix.user, p.id);
        if (!u || u.role !== 'auditor' || u.locationIds.indexOf(r.loc.id) < 0) return C.fail('not_found', 'Цього працівника немає в списку цеху — оновіть сторінку.');
      }
      if (!p.id || p.name !== undefined) {
        var name = clean(p.name, 60);
        if (name.length < 2) errs.push({ field: 'name', message: 'Імʼя — від 2 знаків, наприклад «Петро Л.».' }); else patch.name = name;
      }
      if (!p.id || (p.email !== undefined && clean(p.email) !== '')) {
        var email = clean(p.email, 120).toLowerCase();
        if (!EMAIL.test(email)) errs.push({ field: 'email', message: 'Робоча пошта — повністю, наприклад petro.l@example.com.' });
        else if (env.db.users.some(function (x) { return x.id !== p.id && same(x.email, email); })) errs.push({ field: 'email', message: 'Ця пошта вже є в списку.' });
        else patch.email = email;
      }
      if (p.active !== undefined) patch.active = !!p.active;
      if (p.active === true && p.id && env.ix.user[p.id] && env.ix.user[p.id].accessOff) return C.fail('forbidden', 'Доступ цій людині вимкнув адміністратор — увімкнути може лише він.');
      if (errs.length) return verr(errs);
      var was = u ? { name: u.name, email: S.maskEmail(u.email), active: u.active !== false } : {}, id = p.id;
      if (!id) {
        var pre = 'u_aud_' + r.loc.id.slice(4).toLowerCase(), n = 0;
        env.db.users.forEach(function (x) { if (x.id.indexOf(pre) === 0 && /^\d+$/.test(x.id.slice(pre.length))) n = Math.max(n, +x.id.slice(pre.length)); });
        id = pre + (n + 1);
        st.add.push({ id: id, name: patch.name, role: 'auditor', email: patch.email, locationIds: [r.loc.id], active: patch.active !== false,
          addedAt: env.now().toISOString(), addedBy: me.id });
      } else st.edit[id] = Object.assign(st.edit[id] || {}, patch);
      save(env, K.users, st);
      var x = env.ix.user[id];
      journal(env, me, r.loc.id, 'team', p.id ? 'edit' : 'add', x.name,
        diff([['Імʼя', was.name, x.name], ['Пошта', was.email, S.maskEmail(x.email)], ['Доступ', was.active, x.active !== false]]));
      return { ok: true, id: id, name: x.name, active: x.active !== false, created: !p.id };
    },

    srMgWorkers: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var from = S.addDays(env.day(), -29), n30 = {};
      locAudits(env, r.loc.id).forEach(function (a) { if (a.day >= from) a.checkedWorkers.forEach(function (c) { n30[c] = (n30[c] || 0) + 1; }); });
      var deps = locDeps(env, r.loc.id);
      var items = locWorkers(env, r.loc.id).map(function (w) {
        return { code: w.code, name: w.name, departmentId: w.departmentId, departmentName: depName(env, w.departmentId),
          active: w.active !== false, audits30: n30[w.code] || 0, addedAt: w.addedAt || null,
          pending: w.pending === true, addedByName: w.pending === true ? (w.addedByName || '') : '' };
      }).sort(function (a, b) { return (a.pending ? 0 : 1) - (b.pending ? 0 : 1) || a.name.localeCompare(b.name, 'uk', { numeric: true }) || (a.code < b.code ? -1 : 1); });
      return { ok: true, location: { id: r.loc.id, name: r.loc.name }, counts: counts(env, r.loc.id), items: items,
        pending: items.filter(function (w) { return w.pending; }).length,
        departments: deps.map(function (d) { return { id: d.id, name: d.name, active: d.active !== false }; }) };
    },

    srMgWorkerSave: function (p, me, env) {
      var r = guardW(p, me, env); if (r.err) return r.err;
      var st = workerStore(env), errs = [], patch = {}, w = null;
      if (p.code) {
        w = pick(env.ix.worker, r.loc.id + ':' + p.code);
        if (!w) return C.fail('not_found', 'Цього працівника немає в цеху — оновіть сторінку.');
      }
      if (!w || p.name !== undefined) {
        var name = squash(p.name), twin = name ? workerByName(env, r.loc.id, name) : null;
        if (!name || name.length > WORKER_NAME_MAX) errs.push({ field: 'name', message: WORKER_NAME_MSG });
        else if (twin && twin !== w) errs.push({ field: 'name', message: 'Працівник «' + twin.name + '» уже є в цьому цеху · ' + depName(env, twin.departmentId) + '.' });
        else patch.name = name;
      }
      if (!w || p.departmentId !== undefined) {
        var d = pick(env.ix.dep, p.departmentId);
        if (!d || d.locationId !== r.loc.id) errs.push({ field: 'departmentId', message: 'Оберіть відділ зі списку.' }); else patch.departmentId = d.id;
      }
      if (p.active !== undefined) patch.active = !!p.active;
      if (errs.length) return verr(errs);
      var was = w ? { name: w.name, dep: depName(env, w.departmentId), active: w.active !== false, pending: w.pending === true } : {};
      var code = w ? w.code : null;
      if (!w) {
        code = nextWorkerCode(env, r.loc.id, patch.departmentId);
        st.add.push({ code: code, name: patch.name, departmentId: patch.departmentId, locationId: r.loc.id, active: patch.active !== false,
          addedAt: env.now().toISOString(), addedBy: me.id, addedByName: me.name });
      } else {
        if (p.name !== undefined || p.departmentId !== undefined || p.confirmed === true) patch.pending = false;
        var k = r.loc.id + ':' + code; st.edit[k] = Object.assign(st.edit[k] || {}, patch);
      }
      save(env, K.workers, st);
      var x = env.ix.worker[r.loc.id + ':' + code];
      journal(env, me, r.loc.id, 'workers', w ? 'edit' : 'add', x.name, diff([['Підпис', was.name, x.name], ['Відділ', was.dep, depName(env, x.departmentId)],
        ['Стан', was.active, x.active !== false], ['Підтверджено старшим', was.pending ? 'ні' : null, was.pending ? (x.pending === true ? 'ні' : 'так') : null]]));
      return { ok: true, code: code, name: x.name, active: x.active !== false, pending: x.pending === true, created: !w };
    },

    workerQuickAdd: function (p, me, env) {
      var lid = p && p.locationId, r = lid && C.canRecordAt(me, lid, env.ix) ? { loc: env.ix.loc[lid] } : S.loc(p || {}, me, env);
      if (r.err) return r.err;
      if (!r.loc) return C.fail('not_found', 'Локацію не знайдено.');
      if (!me.can || !me.can.recordAudit) return C.forbidden();
      env.reload(); r = { loc: env.ix.loc[r.loc.id] };   // свіжий стан: працівника могли щойно додати в іншій вкладці
      var d = pick(env.ix.dep, p.departmentId), name = squash(p.name), errs = [];
      if (!d || d.locationId !== r.loc.id || d.active === false) errs.push({ field: 'departmentId', message: 'Оберіть відділ зі списку.' });
      if (!name || name.length > WORKER_NAME_MAX) errs.push({ field: 'name', message: WORKER_NAME_MSG });
      if (errs.length) return verr(errs);
      function out(w, existed) {
        return { ok: true, existed: existed, worker: { code: w.code, name: w.name, departmentId: w.departmentId, departmentName: depName(env, w.departmentId) } };
      }
      var st = workerStore(env), twin = workerByName(env, r.loc.id, name);
      if (twin) {
        if (twin.active === false) {
          var k = r.loc.id + ':' + twin.code;
          st.edit[k] = Object.assign(st.edit[k] || {}, { active: true }, S.canManage(me) ? {} : { pending: true, addedBy: me.id, addedByName: me.name, addedAt: env.now().toISOString() });
          save(env, K.workers, st);
          twin = env.ix.worker[k];
          journal(env, me, r.loc.id, 'workers', 'edit', twin.name, diff([['Стан', false, true], ['Звідки', null, 'форма аудиту']]));
        }
        return out(twin, true);
      }
      var code = nextWorkerCode(env, r.loc.id, d.id);
      st.add.push({ code: code, name: name, departmentId: d.id, locationId: r.loc.id, active: true, addedAt: env.now().toISOString(),
        addedBy: me.id, addedByName: me.name, pending: !S.canManage(me) });   // доданого старшим підтверджувати нема кому
      save(env, K.workers, st);
      journal(env, me, r.loc.id, 'workers', 'add', name, diff([['Підпис', null, name], ['Відділ', null, d.name], ['Звідки', null, 'форма аудиту']]));
      return out(env.ix.worker[r.loc.id + ':' + code], false);
    },

    srMgCatalog: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var t = locTypes(env, r.loc.id), use = {}, byDep = {}, people = {};
      locAudits(env, r.loc.id).forEach(function (a) {
        byDep[a.departmentId] = (byDep[a.departmentId] || 0) + 1;
        var seen = {}; a.items.forEach(function (i) { if (!seen[i.productId]) { seen[i.productId] = 1; use[i.productId] = (use[i.productId] || 0) + 1; } });
      });
      locWorkers(env, r.loc.id).forEach(function (w) { if (w.active !== false) people[w.departmentId] = (people[w.departmentId] || 0) + 1; });
      var products = env.db.products.filter(function (x) { return t[x.deptTypeId]; }).map(function (x) {
        return { id: x.id, name: x.name, deptTypeId: x.deptTypeId, active: x.active !== false, audits: use[x.id] || 0, addedAt: x.addedAt || null };
      });
      var deps = locDeps(env, r.loc.id);
      return { ok: true, location: { id: r.loc.id, name: r.loc.name }, counts: counts(env, r.loc.id), products: products,
        deptTypes: env.db.deptTypes.map(function (x) { return { id: x.id, name: x.name }; }), canAddDept: deps.length < DEPTS_MAX,
        departments: deps.map(function (d) {
          var norm = env.db.norms.filter(function (n) { return n.departmentId === d.id; })[0];
          return { id: d.id, name: d.name, deptTypeId: d.deptTypeId, deptTypeName: env.ix.dt[d.deptTypeId].name, active: d.active !== false,
            sampleTarget: norm ? norm.sampleTarget : null, audits: byDep[d.id] || 0, workers: people[d.id] || 0, addedAt: d.addedAt || null,
            products: products.filter(function (x) { return x.deptTypeId === d.deptTypeId; }).length,
            shown: products.filter(function (x) { return x.deptTypeId === d.deptTypeId && x.active; }).length };
        }) };
    },

    srMgDeptSave: function (p, me, env) {
      var r = guardW(p, me, env); if (r.err) return r.err;
      var deps = locDeps(env, r.loc.id), d = null, errs = [], patch = {}, norm;
      if (p.id != null) {
        d = pick(env.ix.dep, p.id);
        if (!d || d.locationId !== r.loc.id) return C.fail('not_found', 'Такого відділу немає в цьому цеху — оновіть сторінку.');
      } else if (deps.length >= DEPTS_MAX) return verr([{ field: 'name', message: 'У цеху — до ' + DEPTS_MAX + ' відділів.' }]);
      if (!d || p.name !== undefined) {
        var name = squash(p.name);
        if (name.length < 2 || name.length > 40) errs.push({ field: 'name', message: 'Назва відділу — від 2 до 40 знаків.' });
        else if (deps.some(function (x) { return x !== d && same(x.name, name); })) errs.push({ field: 'name', message: 'Відділ «' + name + '» уже є в цьому цеху.' });
        else patch.name = name;
      }
      if (!d && !pick(env.ix.dt, p.deptTypeId)) errs.push({ field: 'deptTypeId', message: 'Оберіть тип відділу.' });
      if (!d || p.sampleTarget !== undefined) {
        norm = typeof p.sampleTarget === 'string' && p.sampleTarget.trim() !== '' ? +p.sampleTarget : p.sampleTarget;
        if (!isInt(norm, 1, NORM_MAX)) errs.push({ field: 'sampleTarget', message: 'Норма вибірки — ціле число від 1 до ' + NORM_MAX + ' шт.' });
      }
      if (p.active !== undefined) { if (typeof p.active !== 'boolean') errs.push({ field: 'active', message: 'Оберіть: відділ працює чи вимкнений.' }); else patch.active = p.active; }
      if (d && !errs.length && norm === undefined && !Object.keys(patch).length) errs.push({ field: 'name', message: 'Немає змін.' });
      if (errs.length) return verr(errs);
      var st = deptStore(env.storage), id = d ? d.id : null, old = d ? env.db.norms.filter(function (q) { return q.departmentId === d.id; })[0] : null;
      var was = d ? { name: d.name, active: d.active !== false, norm: old ? old.sampleTarget + ' шт' : null } : {};
      if (!d) {
        var n = 0; env.db.departments.forEach(function (x) { var m = /_N(\d+)$/.exec(x.id); if (m) n = Math.max(n, +m[1]); });
        id = 'DEP_' + r.loc.id.slice(4) + '_N' + (n + 1);
        st.add.push({ id: id, locationId: r.loc.id, deptTypeId: p.deptTypeId, name: patch.name, active: patch.active !== false, addedAt: env.now().toISOString() });
      } else if (Object.keys(patch).length) st.edit[id] = Object.assign(st.edit[id] || {}, patch);
      if (norm !== undefined) st.norms[id] = norm;
      save(env, K.depts, st);
      var x = env.ix.dep[id], row = env.db.norms.filter(function (q) { return q.departmentId === id; })[0];
      journal(env, me, r.loc.id, 'depts', d ? 'edit' : 'add', x.name, diff([['Назва', was.name, x.name], ['Тип відділу', null, d ? null : env.ix.dt[x.deptTypeId].name],
        ['Норма вибірки на день', was.norm, row ? row.sampleTarget + ' шт' : null], ['Стан', was.active, x.active !== false]]));
      return { ok: true, id: id, name: x.name, active: x.active !== false, sampleTarget: row ? row.sampleTarget : null, created: !d };
    },

    srMgProductSave: function (p, me, env) {
      var r = guardW(p, me, env); if (r.err) return r.err;
      var st = env.storage.get(K.products, null) || { add: [], edit: {}, merge: {} }, x = null, errs = [], patch = {};
      var t = locTypes(env, r.loc.id);
      if (p.id) { x = pick(env.ix.prod, p.id); if (!x || !t[x.deptTypeId]) return C.fail('not_found', 'Такого виробу вже немає — оновіть сторінку.'); }
      var dt = x ? x.deptTypeId : p.deptTypeId;
      if (!x && !pick(t, dt)) errs.push({ field: 'deptTypeId', message: 'Оберіть тип відділу.' });   // власним ключем: 'constructor' — не тип відділу
      if (!x || p.name !== undefined) {
        var name = clean(p.name, 80);
        if (name.length < 2) errs.push({ field: 'name', message: 'Назва виробу — від 2 знаків.' });
        else if (env.db.products.some(function (y) { return y.id !== p.id && y.deptTypeId === dt && same(y.name, name); })) errs.push({ field: 'name', message: 'Виріб «' + name + '» уже є в цьому відділі.' });
        else patch.name = name;
      }
      if (p.active !== undefined) patch.active = !!p.active;
      if (errs.length) return verr(errs);
      var id = p.id, was = x ? { name: x.name, active: x.active !== false } : {};
      if (!id) {
        var n = 0; env.db.products.concat(arr(st.add)).forEach(function (y) { n = Math.max(n, numOf(y.id)); });
        Object.keys(st.merge || {}).forEach(function (k) { n = Math.max(n, numOf(k)); });
        id = 'PRD_' + pad3(n + 1);
        st.add.push({ id: id, name: patch.name, deptTypeId: dt, active: patch.active !== false, addedAt: env.now().toISOString() });
      } else st.edit[id] = Object.assign(st.edit[id] || {}, patch);
      save(env, K.products, st);
      var y = env.ix.prod[id];
      journal(env, me, r.loc.id, 'products', x ? 'edit' : 'add', y.name, diff([['Назва', was.name, y.name], ['Тип відділу', null, x ? null : env.ix.dt[dt].name],
        ['Стан', was.active, y.active !== false]]));
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
      var r = guardW(p, me, env); if (r.err) return r.err;
      var st = env.storage.get(K.defects, null) || { add: [], edit: {}, merge: {} }, x = null, errs = [], patch = {};
      var t = locTypes(env, r.loc.id);
      if (p.id) { x = pick(env.ix.def, p.id); if (!x || !t[x.deptTypeId]) return C.fail('not_found', 'Такого виду браку вже немає — оновіть сторінку.'); }
      var dt = x ? x.deptTypeId : p.deptTypeId;
      if (!x && !pick(t, dt)) errs.push({ field: 'deptTypeId', message: 'Оберіть відділ.' });
      if (!x || p.name !== undefined) {
        var name = clean(p.name, 80);
        if (name.length < 2) errs.push({ field: 'name', message: 'Назва виду браку — від 2 знаків.' });
        else if (env.db.defectTypes.some(function (y) { return y.id !== p.id && y.deptTypeId === dt && same(y.name, name); })) errs.push({ field: 'name', message: 'Вид «' + name + '» уже є в цьому відділі.' });
        else patch.name = name;
      }
      if (!x || p.level !== undefined) {
        if (!pick(LEVELS, p.level)) errs.push({ field: 'level', message: 'Оберіть рівень: неправильно зроблене, пошкоджене чи зламане.' }); else patch.level = p.level;
      }
      if (p.active !== undefined) patch.active = !!p.active;
      if (errs.length) return verr(errs);
      var id = p.id, was = x ? { name: x.name, level: S.LEVEL_LABELS[x.level] || null, active: x.active !== false } : {};
      if (!id) {
        var n = 0; env.db.defectTypes.concat(arr(st.add)).forEach(function (y) { n = Math.max(n, numOf(y.id)); });
        Object.keys(st.merge || {}).forEach(function (k) { n = Math.max(n, numOf(k)); });
        id = 'DEF_' + pad3(n + 1);
        st.add.push({ id: id, name: patch.name, deptTypeId: dt, severity: 2, level: patch.level, active: patch.active !== false, addedAt: env.now().toISOString() });
      } else st.edit[id] = Object.assign(st.edit[id] || {}, patch);
      save(env, K.defects, st);
      var y = env.ix.def[id];
      journal(env, me, r.loc.id, 'defects', x ? 'edit' : 'add', y.name, diff([['Назва', was.name, y.name], ['Тип відділу', null, x ? null : env.ix.dt[dt].name],
        ['Рівень', was.level, S.LEVEL_LABELS[y.level] || null], ['Стан', was.active, y.active !== false]]));
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
      var r = guardW(p, me, env); if (r.err) return r.err;
      var kind = p.kind === 'defects' ? 'defects' : 'products', m = mergeSet(p, env, r.loc, kind); if (m.err) return m.err;
      if (kind === 'defects' && p.level !== undefined && !pick(LEVELS, p.level)) return verr([{ field: 'level', message: 'Оберіть рівень.' }]);
      var otherIds = m.others.map(function (x) { return x.id; });
      var moved = kind === 'products' ? productUse(env, otherIds) : defectUse(env, otherIds);
      var key = kind === 'products' ? K.products : K.defects;
      var st = env.storage.get(key, null) || { add: [], edit: {}, merge: {} };
      st.merge = st.merge || {}; st.edit = st.edit || {};
      otherIds.forEach(function (id) { st.merge[id] = m.keep.id; });
      if (kind === 'defects' && p.level) st.edit[m.keep.id] = Object.assign(st.edit[m.keep.id] || {}, { level: p.level });
      var oldLevel = S.LEVEL_LABELS[m.keep.level] || null;
      save(env, key, st);
      if (kind === 'defects' && P.demoKd) P.demoKd.remapDefect(env, otherIds, m.keep.id);
      journal(env, me, r.loc.id, 'merge', 'merge', m.keep.name, [{ label: kind === 'products' ? 'Вироби' : 'Види браку',
        from: m.list.map(function (x) { return x.name; }).join(' · '), to: m.keep.name }]
        .concat(kind === 'defects' ? diff([['Рівень', oldLevel, S.LEVEL_LABELS[env.ix.def[m.keep.id].level] || null]]) : []));
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
      var r = guardW(p, me, env); if (r.err) return r.err;
      var list = env.db.orderBlocks.filter(function (b) { return b.locationId === r.loc.id; }).map(function (b) { return { id: b.id, locationId: b.locationId, name: b.name, orders: b.orders.slice() }; });
      var cur = p.id ? list.filter(function (b) { return b.id === p.id; })[0] : null;
      if (p.id && !cur) return C.fail('not_found', 'Такого блоку вже немає — оновіть сторінку.');
      var errs = [], name = clean(p.name, 40), on = {};
      env.db.orders.forEach(function (o) { if (o.locationId === r.loc.id) on[o.no] = 1; });
      if (!name) errs.push({ field: 'name', message: 'Впишіть назву блоку.' });
      else if (list.some(function (b) { return b.id !== p.id && same(b.name, name); })) errs.push({ field: 'name', message: 'Блок «' + name + '» уже є.' });
      var orders = arr(p.orders).map(function (x) { return clean(x, 20); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
      if (!orders.length) errs.push({ field: 'orders', message: 'Додайте хоча б одне замовлення.' });
      else if (orders.length > 20) errs.push({ field: 'orders', message: 'У блоці — до 20 замовлень.' });
      orders.forEach(function (no) {
        if (!on[no]) errs.push({ field: 'orders', message: 'Замовлення ' + no + ' немає в цьому цеху.' });
        var other = list.filter(function (b) { return b.id !== p.id && b.orders.indexOf(no) >= 0; })[0];
        if (other) errs.push({ field: 'orders', message: 'Замовлення ' + no + ' уже в «' + other.name + '».' });
      });
      if (errs.length) return verr(errs);
      var id = p.id, was = cur ? { name: cur.name, orders: cur.orders.join(', ') } : {};
      if (cur) { cur.name = name; cur.orders = orders; }
      else {
        var pre = 'BLK_' + r.loc.id.slice(4), n = 0;
        list.forEach(function (b) { n = Math.max(n, numOf(b.id)); });
        id = pre + (n + 1);
        list.push({ id: id, locationId: r.loc.id, name: name, orders: orders });
      }
      var all = env.storage.get(K.blocks, {}); all[r.loc.id] = list;
      save(env, K.blocks, all);
      journal(env, me, r.loc.id, 'blocks', cur ? 'edit' : 'add', name, diff([['Назва', was.name, name], ['Замовлення', was.orders, orders.join(', ')]]));
      return { ok: true, id: id, name: name, orders: orders, created: !p.id };
    },

    srMgBlockDelete: function (p, me, env) {
      var r = guardW(p, me, env); if (r.err) return r.err;
      var list = env.db.orderBlocks.filter(function (b) { return b.locationId === r.loc.id; });
      var b = list.filter(function (x) { return x.id === p.id; })[0];
      if (!b) return C.fail('not_found', 'Такого блоку вже немає — оновіть сторінку.');
      var all = env.storage.get(K.blocks, {});
      all[r.loc.id] = list.filter(function (x) { return x.id !== p.id; }).map(function (x) { return { id: x.id, locationId: x.locationId, name: x.name, orders: x.orders.slice() }; });
      save(env, K.blocks, all);
      journal(env, me, r.loc.id, 'blocks', 'delete', b.name, diff([['Замовлення', b.orders.join(', '), null]]));
      return { ok: true, id: b.id, name: b.name };
    },

    srMgImport: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var s = importState(env, r.loc), busy = {};
      s.tables.forEach(function (t) { busy[t.mark] = 1; });
      return { ok: true, location: { id: r.loc.id, name: r.loc.name }, counts: counts(env, r.loc.id), updatedAt: s.updatedAt,
        nextAt: P.demoDates.kyivToIso(S.addDays(env.day(), 1), 6 * 60), weekStart: s.weekStart,
        tables: s.tables.map(function (t) { return tableView(env, r.loc, t); }), week: weekRows(env, r.loc, s), warnings: overlaps(env, r.loc, s.tables),
        maxTables: MARKS.length, freeMarks: MARKS.map(function (l, m) { return m; }).filter(function (m) { return !busy[m]; }),
        marks: MARKS.map(function (l, m) {
          var v = sheetOf(m);
          return { mark: m, label: l, columns: sheetColumns(env, r.loc.id, m), title: v.title + ' ' + r.loc.name, sheet: v.sheet, headerRow: v.headerRow };
        }),
        departments: locDeps(env, r.loc.id).map(function (d) { return { id: d.id, name: d.name, active: d.active !== false }; }) };
    },

    srMgImportRefresh: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var s = importState(env, r.loc);
      s.updatedAt = env.now().toISOString(); saveImport(env, r.loc, s);
      return { ok: true, updatedAt: s.updatedAt };
    },

    srMgImportSave: function (p, me, env) {
      var r = guardW(p, me, env); if (r.err) return r.err;
      var s = importState(env, r.loc), list = arr(p.tables), errs = [], busy = {}, saved = [], before = {}, oldWeek = s.weekStart;
      s.tables.forEach(function (t) { before[t.id] = tableFacts(env, t); });
      if (p.weekStart !== undefined) {
        if (p.weekStart !== 'mon' && p.weekStart !== 'sun') errs.push({ field: 'weekStart', message: 'Тиждень — з понеділка або з неділі.' }); else s.weekStart = p.weekStart;
      }
      if (!list.length && p.weekStart === undefined) return verr([{ field: 'tables', message: 'Немає таблиць для збереження.' }]);
      s.tables.forEach(function (t) { busy[t.mark] = 1; });
      var fresh = list.filter(function (c) { return !(c && c.id); }).length;
      if (s.tables.length + fresh > MARKS.length) return verr([{ field: 'tables', message: 'На локацію — до ' + MARKS.length + ' таблиць.' }]);
      list.forEach(function (c, i) {
        c = c || {};
        var cur = c.id ? s.tables.filter(function (t) { return t.id === c.id; })[0] : null, mark;
        if (c.id && !cur) { errs.push({ field: 'tables[' + i + '].id', message: 'Цієї таблиці вже немає — оновіть сторінку.', table: i }); return; }
        if (cur) mark = cur.mark;
        else {
          mark = isInt(c.mark, 0, MARKS.length - 1) && !busy[c.mark] ? c.mark : MARKS.map(function (l, m) { return m; }).filter(function (m) { return !busy[m]; })[0];
          busy[mark] = 1;
        }
        var e = checkTable(env, r.loc, c, i, mark);
        if (e.length) { errs = errs.concat(e); return; }
        var t = { id: cur ? cur.id : null, mark: mark, title: squash(c.title), url: squash(c.url), sheet: squash(c.sheet), headerRow: +c.headerRow, dataRow: +c.dataRow,
          dateCol: c.dateCol, orderCol: c.orderCol,
          depts: arr(c.depts).map(function (x) { return { departmentId: x.departmentId, doneCol: x.doneCol, planCol: x.planCol || null }; }) };
        saved.push(t);
      });
      if (errs.length) return C.fail('validation', (errs[0].label ? 'Таблиця ' + errs[0].label + ': ' : '') + errs[0].message, errs);
      var n = 0; s.tables.forEach(function (t) { n = Math.max(n, numOf(t.id)); });
      saved.forEach(function (t) {
        if (t.id) { s.tables = s.tables.map(function (x) { return x.id === t.id ? t : x; }); return; }
        t.id = 'T' + (++n); s.tables.push(t);
      });
      s.tables.sort(function (a, b) { return a.mark - b.mark; });
      if (saved.length) s.updatedAt = env.now().toISOString();   // сама зміна «тиждень з…» часу оновлення не чіпає
      saveImport(env, r.loc, s);
      saved.forEach(function (t) {
        var a = has(before, t.id) ? before[t.id] : {}, b = tableFacts(env, t);
        journal(env, me, r.loc.id, 'import', has(before, t.id) ? 'edit' : 'add', 'Таблиця ' + MARKS[t.mark] + ' · ' + t.title, diff([['Назва', a.title, b.title],
          ['Аркуш', a.sheet, b.sheet], ['Рядки', a.rows, b.rows], ['Колонки', a.cols, b.cols], ['Відділи й колонки', a.depts, b.depts]]));
      });
      var wk = { mon: 'з понеділка', sun: 'з неділі' };
      journal(env, me, r.loc.id, 'import', 'edit', 'Тиждень', diff([['Тиждень починається', wk[oldWeek], wk[s.weekStart]]]));
      return { ok: true, updatedAt: s.updatedAt, weekStart: s.weekStart, warnings: overlaps(env, r.loc, s.tables),
        saved: saved.map(function (t) { return { id: t.id, mark: t.mark, label: MARKS[t.mark], title: t.title, departments: t.depts.length }; }) };
    },

    srMgImportTableDelete: function (p, me, env) {
      var r = guard(p, me, env); if (r.err) return r.err;
      var s = importState(env, r.loc), t = s.tables.filter(function (x) { return x.id === p.id; })[0];
      if (!t) return C.fail('not_found', 'Цієї таблиці вже немає — оновіть сторінку.');
      s.tables = s.tables.filter(function (x) { return x !== t; });
      saveImport(env, r.loc, s);
      journal(env, me, r.loc.id, 'import', 'delete', 'Таблиця ' + MARKS[t.mark] + ' · ' + t.title, diff([['Відділи й колонки', tableFacts(env, t).depts, null]]));
      return { ok: true, id: t.id, label: MARKS[t.mark], title: t.title, left: s.tables.length };
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
          if (m.id === 'audit_seniors' || m.id === 'over_seniors') it.to = (seniors.join(', ') || 'старші цеху') + ' — особисто';
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
      var was = { on: o.on !== undefined ? o.on : m.on, level: m.hasLevel ? DAILY_LABELS[o.level || m.level] : null, daily: m.id === 'daily' ? dailyFacts(s.daily) : {} };
      if (p.on !== undefined) o.on = !!p.on;
      if (p.level !== undefined) { if (!m.hasLevel || !pick(DAILY_LEVELS, p.level)) errs.push({ field: 'level', message: 'Оберіть: усе, тільки з браком чи тільки понад 5%.' }); else o.level = p.level; }
      if (p.daily !== undefined) {
        if (m.id !== 'daily') return C.fail('validation', 'Ці налаштування — лише для денного звіту.');
        var d = p.daily || {}, to = arr(d.to).map(function (x) { return clean(x, 60); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
        var days = arr(d.days).filter(function (x, i, a) { return x >= 0 && x <= 6 && Math.floor(x) === x && a.indexOf(x) === i; });
        if (!to.length) errs.push({ field: 'to', message: 'Додайте отримувача: канал (#якість-цех) чи людину.' });
        if (to.length > 10) errs.push({ field: 'to', message: 'До 10 отримувачів.' });
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(d.time || ''))) errs.push({ field: 'time', message: 'Час — у форматі 18:00.' });
        if (!days.length) errs.push({ field: 'days', message: 'Оберіть хоча б один день.' });
        var inc = {}; INCLUDE.forEach(function (k) { inc[k] = !!(d.include && d.include[k]); });
        if (!INCLUDE.some(function (k) { return inc[k]; })) errs.push({ field: 'include', message: 'Оберіть хоча б один показник.' });
        if (!errs.length) s.daily = { to: to, time: d.time, days: days.sort(), include: inc };
      }
      if (errs.length) return verr(errs);
      saveMail(env, r.loc, s);
      var now = m.id === 'daily' ? dailyFacts(s.daily) : {};
      journal(env, me, r.loc.id, 'mailing', 'edit', m.title, diff([['Розсилка', was.on, o.on !== undefined ? o.on : m.on],
        ['Що надсилати', was.level, m.hasLevel ? DAILY_LABELS[o.level || m.level] : null], ['Кому', was.daily.to, now.to], ['Час', was.daily.time, now.time],
        ['Дні', was.daily.days, now.days], ['Показників', was.daily.include, now.include]]));
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
