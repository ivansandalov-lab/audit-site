(function (root) {
  'use strict';
  var P = root.P, AF = P.AF = P.AF || {};
  var DAY = 24 * 3600 * 1000, KEY_RE = /^(it|df)_[a-z0-9]+$/;
  var timer = null, pending = null;

  function str(v) { return typeof v === 'string' ? v : ''; }
  function num(v) { return String(v == null ? '' : v).replace(/\D+/g, ''); }

  function key(uid, loc) { return 'draft:' + uid + ':' + loc; }
  function fresh(uid, loc) {
    var d = P.store.get(key(uid, loc), null);
    if (d && d.savedAt && Date.now() - d.savedAt < DAY && d.state) return d;
    if (d) P.store.del(key(uid, loc));
    return null;
  }
  function productsText(n) { return n + ' ' + P.plural(n, 'виріб', 'вироби', 'виробів'); }
  function write(form) {
    if (!form || form.done || form.lockDraft || form.editId) return;
    var d = AF.dept(form, form.departmentId);
    P.store.set(key(form.uid, form.home), {
      savedAt: Date.now(), summary: (form.loc !== form.home ? form.ctx.location.name + ' · ' : '') + (d ? d.name : 'Відділ не обрано') + ' · ' + productsText(form.items.filter(function (i) { return i.productId; }).length),
      state: { loc: form.loc, clientId: form.clientId, departmentId: form.departmentId, orders: form.orders, items: form.items,
        workers: form.workers, helpers: form.helpers, comment: form.comment, mode: form.mode,
        defects: form.defects.map(function (x) { return { key: x.key, itemKey: x.itemKey, defectTypeId: x.defectTypeId, other: x.other, departmentId: x.departmentId, guilty: x.guilty, photos: x.photos || [] }; }) }
    });
  }
  function flush() { clearTimeout(timer); var fn = pending; pending = null; if (fn) fn(); }
  root.addEventListener('hashchange', flush);
  root.addEventListener('pagehide', flush);

  AF.draft = {
    key: key, fresh: fresh, flush: flush,
    locOf: function (d, home) { var l = d && d.state && d.state.loc; return typeof l === 'string' && l ? l : home; },
    save: function (form) { clearTimeout(timer); pending = function () { write(form); }; timer = setTimeout(flush, 300); },
    del: function (uid, loc) { P.store.del(key(uid, loc)); }
  };

  AF.restore = function (F, d, newItem) {
    var s = d.state || {}, L = F.ctx.limits;
    var items = (Array.isArray(s.items) ? s.items : []).filter(function (i) { return i && KEY_RE.test(i.key); }).slice(0, L.maxProducts);
    var defs = (Array.isArray(s.defects) ? s.defects : []).filter(function (x) { return x && KEY_RE.test(x.key) && Array.isArray(x.guilty); }).slice(0, L.maxDefects);
    F.clientId = /^aud_[a-z0-9]+$/.test(str(s.clientId)) ? s.clientId : F.clientId;
    F.departmentId = AF.dept(F, s.departmentId) ? s.departmentId : null;
    F.orders = (Array.isArray(s.orders) ? s.orders : []).filter(function (o) { return typeof o === 'string' && o; }).slice(0, L.maxOrders);
    F.items = items.map(function (i) { return { key: i.key, productId: str(i.productId) || null, orderNo: str(i.orderNo) || null, qty: num(i.qty), rejected: num(i.rejected) }; });
    F.workers = (Array.isArray(s.workers) ? s.workers : []).filter(function (c) { return typeof c === 'string'; });   // '' — невідомий працівник
    F.helpers = (Array.isArray(s.helpers) ? s.helpers : []).filter(function (c) { return typeof c === 'string' && c && F.workers.indexOf(c) >= 0; });
    F.comment = str(s.comment).slice(0, L.maxComment);
    F.mode = s.mode === 'none' || s.mode === 'defects' ? s.mode : null;
    F.defects = defs.map(function (x) {
      var other = x.other === true, dep = other && AF.dept(F, str(x.departmentId)) ? x.departmentId : null;
      return { key: x.key, itemKey: str(x.itemKey) || null, defectTypeId: str(x.defectTypeId) || null, other: other, departmentId: dep,
        photos: (Array.isArray(x.photos) ? x.photos : []).filter(AF.isPhoto).slice(0, AF.PHOTO_MAX),
        guilty: x.guilty.slice(0, L.maxGuiltyPerDefect).map(function (g) { return { workerCode: g && g.workerCode == null ? null : str(g && g.workerCode), qty: num(g && g.qty) }; })
          .filter(function (g, j, all) {
            if (other) return true;
            return g.workerCode !== null && (g.workerCode === '' || F.workers.indexOf(g.workerCode) >= 0) &&
              all.findIndex(function (x) { return x && x.workerCode === g.workerCode; }) === j;
          }) };
    });
    if (!F.items.length) F.items = [newItem()];
  };

  AF.fromAudit = function (F, a) {
    F.editId = a.id;
    F.departmentId = a.departmentId;
    F.orders = (a.orders || []).slice(0, F.ctx.limits.maxOrders);
    F.items = (a.items || []).map(function (i) {
      var r = i.rejectedInput !== undefined ? i.rejectedInput : i.rejected;   // показуємо лише те, що людина вписала сама
      return { key: P.uid('it'), productId: i.productId, orderNo: i.orderNo || null, qty: String(i.qty), rejected: r == null ? '' : String(r) };
    });
    F.workers = (a.checkedWorkers || []).map(function (w) { return w.code; });
    F.helpers = (a.checkedWorkers || []).filter(function (w) { return w.helper && w.code; }).map(function (w) { return w.code; });
    F.comment = a.comment || '';
    F.mode = (a.defects || []).length ? 'defects' : 'none';
    var groups = {};
    F.defects = [];
    (a.defects || []).forEach(function (d) {
      var dep = d.otherDept ? d.departmentId : '', k = [d.productId, d.orderNo || '', d.defectTypeId, dep].join('|');
      if (!groups[k]) {
        var it = F.items.filter(function (i) { return i.productId === d.productId && (i.orderNo || null) === (d.orderNo || null); })[0];
        groups[k] = { key: P.uid('df'), itemKey: it ? it.key : null, defectTypeId: d.defectTypeId, other: !!d.otherDept, departmentId: dep || null, guilty: [], photos: [] };
        F.defects.push(groups[k]);
      }
      (Array.isArray(d.photos) ? d.photos : []).forEach(function (src) {   // фото зберігаються при виправленні
        if (AF.isPhoto(src) && groups[k].photos.length < AF.PHOTO_MAX && groups[k].photos.indexOf(src) < 0) groups[k].photos.push(src);
      });
      groups[k].guilty.push({ workerCode: d.workerCode || '', qty: String(d.qty) });
    });
  };
})(window);
