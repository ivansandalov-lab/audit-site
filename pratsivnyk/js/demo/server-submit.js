(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var C = P.demoCommon;
  var ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  var MSG_QTY = 'Кількість — ціле число від 1 до 100 000.';
  var MSG_REJ = 'Відбраковано — ціле число від 0.';
  var MSG_DEF_TYPE = 'Оберіть тип браку зі списку. Немає потрібного — попросіть старшого аудитора додати його на сайті.';
  var MSG_SRC_DEP = 'Оберіть відділ, звідки брак.';
  var MSG_NO_CHANGE = 'Відділ аудиту змінити не можна — запишіть новий аудит.';
  var MSG_UPD_DENIED = 'Виправити можна лише свій аудит протягом 15 хвилин.';

  function toNum(v) {
    if (typeof v === 'number') return v;
    return typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  }
  function isInt(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }
  function arr(v) { return Array.isArray(v) ? v : []; }

  function rowQty(d) {
    return arr(d && d.guilty).reduce(function (s, g) { var q = toNum(g && g.qty); return s + (isInt(q) && q >= 1 ? q : 0); }, 0);
  }

  P.demoValidateAudit = function (payload, ctx) {
    var L = C.LIMITS, db = ctx.db, p = payload || {}, errs = [];
    function add(field, message) { errs.push({ field: field, message: message }); }

    var dep = db.departments.filter(function (d) { return d.id === p.departmentId && d.locationId === p.locationId; })[0];
    if (!p.locationId || !p.departmentId || !dep) { add('departmentId', 'Оберіть локацію і відділ.'); return errs; }
    var items = arr(p.items), orders = arr(p.orders), defects = arr(p.defects), workers = arr(p.checkedWorkers);
    var deptWorkers = db.workers.filter(function (w) { return w.departmentId === dep.id; }).map(function (w) { return w.code; });

    if (items.length > L.maxProducts) add('items', 'Забагато виробів: не більше ' + L.maxProducts + '.');
    if (orders.length > L.maxOrders) add('orders', 'Забагато замовлень: не більше ' + L.maxOrders + '.');
    if (defects.length > L.maxDefects) add('defects', 'Забагато видів браку: не більше ' + L.maxDefects + '.');
    defects.forEach(function (d, j) {
      if (arr(d && d.guilty).length > L.maxGuiltyPerDefect) add('defects[' + j + '].guilty', 'Забагато винних: не більше ' + L.maxGuiltyPerDefect + '.');
    });

    var qty = items.map(function (it) { return toNum(it && it.qty); });
    var rej = items.map(function (it) {
      var r = it ? it.rejected : null;
      return r == null || r === '' ? null : toNum(r);
    });
    var qtyOk = qty.map(function (q) { return isInt(q) && q >= 1 && q <= L.maxQty; });
    if (!qty.some(function (q) { return q > 0; })) add('items', 'Вкажіть хоча б один перевірений виріб і скільки штук перевірено.');
    else qtyOk.forEach(function (ok, i) { if (!ok) add('items[' + i + '].qty', MSG_QTY); });
    var rejOk = rej.map(function (r) { return r === null || (isInt(r) && r >= 0); });
    rejOk.forEach(function (ok, i) { if (!ok) add('items[' + i + '].rejected', MSG_REJ); });

    rej.forEach(function (r, i) {
      if (r !== null && rejOk[i] && qtyOk[i] && r > qty[i]) add('items[' + i + '].rejected', 'Відбраковано (' + r + ') більше, ніж перевірено (' + qty[i] + ')');
    });

    var pairs = {};
    items.forEach(function (it, i) {
      var prod = db.products.filter(function (x) { return it && x.id === it.productId; })[0];
      if (!prod || prod.deptTypeId !== dep.deptTypeId) add('items[' + i + '].productId', 'Оберіть виріб зі списку для цього відділу.');
      var key = (it && it.productId) + '|' + (it && it.orderNo || '');
      if (pairs[key]) add('items[' + i + '].productId', 'Цей виріб уже є в списку.');
      pairs[key] = true;
      if (orders.length > 1 && !(it && it.orderNo && orders.indexOf(it.orderNo) >= 0)) add('items[' + i + '].orderNo', 'Оберіть замовлення для виробу.');
    });

    var anyRej = rej.some(function (r) { return r > 0; });
    if (p.noDefects && (defects.length > 0 || anyRej)) add('defects', 'Ви позначили „Без браку“, але вказали брак.');

    var perItem = items.map(function () { return 0; });
    var rowItem = defects.map(function (d, j) {
      var srcId = d && d.departmentId, other = !!srcId && srcId !== dep.id, src = dep, srcBad = false;
      if (other) {
        src = db.departments.filter(function (x) { return x.id === srcId && x.locationId === p.locationId; })[0];
        if (!src) { srcBad = true; add('defects[' + j + '].departmentId', MSG_SRC_DEP); }
      }
      if (!srcBad) {
        var types = db.defectTypes.filter(function (t) { return t.deptTypeId === src.deptTypeId; }).map(function (t) { return t.id; });
        if (types.indexOf(d && d.defectTypeId) < 0) add('defects[' + j + '].defectTypeId', MSG_DEF_TYPE);
      }
      var idx = -1;
      items.forEach(function (it, i) { if (idx < 0 && d && it && it.productId === d.productId && (it.orderNo || null) === (d.orderNo || null)) idx = i; });
      if (idx < 0) add('defects[' + j + '].productId', 'Брак можна вказати лише для перевіреного виробу.');
      var guilty = arr(d && d.guilty);
      if (!guilty.length) add('defects[' + j + '].guilty', 'Винний має бути серед перевірених працівників.');
      guilty.forEach(function (g, k) {
        if (other) {
          var code = g ? g.workerCode : null;
          var inSrc = !srcBad && db.workers.some(function (w) { return w.departmentId === src.id && w.code === code; });
          if (!g || (code !== '' && !srcBad && !inSrc)) add('defects[' + j + '].guilty[' + k + ']', 'Працівника з кодом ' + code + ' немає у відділі, звідки брак.');
        } else if (!g || (g.workerCode !== '' && workers.indexOf(g.workerCode) < 0)) add('defects[' + j + '].guilty[' + k + ']', 'Винний має бути серед перевірених працівників.');
        var q = toNum(g && g.qty);
        if (!(isInt(q) && q >= 1 && q <= L.maxQty)) add('defects[' + j + '].guilty[' + k + '].qty', MSG_QTY);
      });
      if (idx >= 0) perItem[idx] += rowQty(d);
      return idx;
    });

    if (!p.noDefects) {
      defects.forEach(function (d, j) {
        var i = rowItem[j];
        if (i >= 0 && rej[i] !== null && rejOk[i] && rowQty(d) > rej[i]) add('defects[' + j + ']', 'Цей вид на ' + rowQty(d) + ' виробах, а відбраковано всього ' + rej[i]);
      });
      items.forEach(function (it, i) {
        if (!qtyOk[i]) return;
        if (rej[i] !== null && rejOk[i] && perItem[i] < rej[i]) {
          add('items[' + i + '].rejected', 'Відбраковано ' + rej[i] + ' шт, а видів браку вписано лише на ' + perItem[i] + '. Кожен поганий виріб має мати хоч один вид.');
        } else if (rej[i] === null && perItem[i] > qty[i]) {
          add('items[' + i + ']', 'Браку (' + perItem[i] + ') більше, ніж перевірено (' + qty[i] + ') для цього виробу');
        }
      });
    }

    workers.forEach(function (code) {
      if (code !== '' && deptWorkers.indexOf(code) < 0) add('checkedWorkers', 'Працівника з кодом ' + code + ' немає в довіднику. Попросіть старшого аудитора додати.');
    });

    if (typeof p.comment === 'string' && p.comment.length > L.maxComment) add('comment', 'Коментар задовгий: не більше ' + L.maxComment + ' знаків.');
    return errs;
  };

  function newId(day, db) {
    var id, taken = {};
    db.audits.forEach(function (a) { taken[a.id] = 1; });
    do {
      var s = '';
      for (var i = 0; i < 6; i++) s += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
      id = 'AUD-' + day.replace(/-/g, '') + '-' + s;
    } while (taken[id]);
    return id;
  }

  function buildBody(p) {
    var items = p.items.map(function (it) {
      var rejected = it.rejected == null || it.rejected === '' ? null : toNum(it.rejected);
      return { productId: it.productId, orderNo: it.orderNo || null, qty: toNum(it.qty), rejected: rejected, rejectedGiven: rejected !== null };
    });
    var defects = arr(p.defects).map(function (d) {
      return { productId: d.productId, orderNo: d.orderNo || null, defectTypeId: d.defectTypeId, departmentId: d.departmentId || p.departmentId,
        photo: d.photo ? { name: String(d.photo.name), size: Number(d.photo.size) || 0 } : null,
        guilty: d.guilty.map(function (g) { return { workerCode: g.workerCode, qty: toNum(g.qty) }; }) };
    });
    items.forEach(function (it) {
      if (it.rejected !== null) return;
      var sum = defects.filter(function (d) { return d.productId === it.productId && d.orderNo === it.orderNo; })
        .reduce(function (s, d) { return s + rowQty(d); }, 0);
      it.rejected = Math.min(sum, it.qty);
    });
    var usedOrders = arr(p.orders).slice();
    items.forEach(function (it) { if (it.orderNo && usedOrders.indexOf(it.orderNo) < 0) usedOrders.push(it.orderNo); });
    return { orders: usedOrders, items: items, defects: defects };
  }

  function windowEnd(createdAt) { return new Date(Date.parse(createdAt) + C.LIMITS.editWindowMin * 60000).toISOString(); }

  P.demoSubmitApi = {
    auditSubmit: function (p, me, env) {
      if (!me.can.recordAudit) return C.forbidden();
      if (p.locationId && env.ix.loc[p.locationId] && !C.hasLoc(me, p.locationId)) return C.forbidden();
      var nowMs = env.now().getTime(), db = env.db;
      if (p.clientId) {
        var same = db.audits.filter(function (a) { return a.clientId === p.clientId && a.auditorId === me.id && nowMs - Date.parse(a.createdAt) < 86400000; })[0];
        if (same) return { ok: true, auditId: same.id, createdAt: same.createdAt, editableUntil: new Date(Date.parse(same.createdAt) + C.LIMITS.editWindowMin * 60000).toISOString() };
      }
      var errors = P.demoValidateAudit(p, { db: db });
      if (errors.length) return C.fail('validation', 'Перевірте поля форми.', errors);

      var body = buildBody(p);
      var createdAt = env.now().toISOString(), day = P.fmt.dayKey(createdAt);
      var rec = { id: newId(day, db), day: day, createdAt: createdAt, clientId: p.clientId || null, locationId: p.locationId,
        departmentId: p.departmentId, auditorId: me.id, orders: body.orders, items: body.items, checkedWorkers: arr(p.checkedWorkers).slice(),
        comment: p.comment || '', noDefects: !!p.noDefects || body.defects.length === 0, defects: body.defects, isTest: true };
      db.audits.push(rec);
      var fresh = env.storage.get('demo:audits:new', []);
      fresh.push(rec);
      env.storage.set('demo:audits:new', fresh);
      var wish = p.wishId ? db.wishes.filter(function (w) { return w.id === p.wishId && w.locationId === p.locationId && w.status === 'open'; })[0] : null;
      if (wish) {
        wish.status = 'done'; wish.doneAuditId = rec.id;
        var doneMap = env.storage.get('demo:wishes:done', {});
        doneMap[wish.id] = rec.id;
        env.storage.set('demo:wishes:done', doneMap);
      }
      return { ok: true, auditId: rec.id, createdAt: createdAt,
        editableUntil: new Date(nowMs + C.LIMITS.editWindowMin * 60000).toISOString() };
    },

    auditUpdate: function (p, me, env) {
      if (!me.can.recordAudit) return C.forbidden();
      var db = env.db;
      var rec = env.audits().filter(function (x) { return x.id === p.id; })[0];
      if (!rec) return C.fail('not_found', 'Аудит не знайдено.');
      var senior = me.can.editOthersAudits && C.hasLoc(me, rec.locationId);
      if (!senior && (rec.auditorId !== me.id || !C.hasLoc(me, rec.locationId) || env.now().getTime() >= Date.parse(rec.createdAt) + C.LIMITS.editWindowMin * 60000)) {
        return C.fail('forbidden', MSG_UPD_DENIED);
      }
      if (p.locationId !== rec.locationId || p.departmentId !== rec.departmentId) {
        return C.fail('validation', 'Перевірте поля форми.', [{ field: 'departmentId', message: MSG_NO_CHANGE }]);
      }
      var errors = P.demoValidateAudit(p, { db: db });
      if (errors.length) return C.fail('validation', 'Перевірте поля форми.', errors);
      var body = buildBody(p);
      rec.orders = body.orders; rec.items = body.items; rec.defects = body.defects;
      rec.checkedWorkers = arr(p.checkedWorkers).slice(); rec.comment = p.comment || '';
      rec.noDefects = !!p.noDefects || body.defects.length === 0;
      rec.updatedAt = env.now().toISOString(); if (rec.auditorId !== me.id) rec.updatedBy = me.id;
      var fresh = env.storage.get('demo:audits:new', []), at = -1;
      fresh.forEach(function (a, i) { if (a.id === rec.id) at = i; });
      if (at >= 0) fresh[at] = rec; else fresh.push(rec);
      env.storage.set('demo:audits:new', fresh);
      return { ok: true, auditId: rec.id, editableUntil: windowEnd(rec.createdAt) };
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P.demoValidateAudit;
})(typeof window !== 'undefined' ? window : globalThis);
