(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function binom(rnd, n, p) {
    var c = 0;
    for (var i = 0; i < n; i++) if (rnd.f() < p) c++;
    return c;
  }

  function auditId(rnd, day, seen) {
    var id;
    do {
      var s = '';
      for (var i = 0; i < 6; i++) s += ID_ALPHABET.charAt(rnd.int(0, ID_ALPHABET.length - 1));
      id = 'AUD-' + day.replace(/-/g, '') + '-' + s;
    } while (seen[id]);
    seen[id] = 1;
    return id;
  }

  function defectRows(rnd, item, rejected, types, checked, problem, hasPhoto) {
    var kinds = rnd.sample(types, rejected >= 2 && rnd.chance(0.4) ? 2 : 1);
    var qtys = kinds.length === 2 ? (function () { var a = rnd.int(1, rejected - 1); return [a, rejected - a]; })() : [rejected];
    return kinds.map(function (t, k) {
      var bad = checked.filter(function (c) { return problem[c]; });
      var first = bad.length && rnd.chance(0.7) ? rnd.pick(bad) : rnd.pick(checked);
      var guilty = [{ workerCode: first, qty: qtys[k] }];
      var others = checked.filter(function (c) { return c !== first; });
      if (qtys[k] >= 2 && others.length && rnd.chance(0.25)) {
        var second = rnd.int(1, qtys[k] - 1);
        guilty = [{ workerCode: first, qty: qtys[k] - second }, { workerCode: rnd.pick(others), qty: second }];
      }
      return { productId: item.productId, orderNo: item.orderNo, defectTypeId: t.id,
        photo: hasPhoto && k === 0 ? { name: 'photo-' + rnd.int(100, 999) + '.jpg', size: rnd.int(80000, 900000) } : null,
        guilty: guilty };
    });
  }

  function makeAudit(db, rnd, ctx, dep, day, spike, seen) {
    var D = P.demoDict, DT = P.demoDates;
    var auditor = rnd.pick(ctx.auditors);
    var det = auditor.lenient ? 0.3 : Math.min(1, rnd.between(0.9, 1.1));
    var prods = db.products.filter(function (p) { return p.deptTypeId === dep.deptTypeId; });
    var types = db.defectTypes.filter(function (t) { return t.deptTypeId === dep.deptTypeId; });
    var workers = db.workers.filter(function (w) { return w.departmentId === dep.id; });
    var checked = rnd.sample(workers, rnd.int(1, 4)).map(function (w) { return w.code; });
    var rate = checked.reduce(function (s, c) { return s + (ctx.problem[c] ? rnd.between(8, 12) : rnd.between(1.5, 5)); }, 0)
      / checked.length / 100 * (spike ? 2.5 : 1);
    var items = [], pairs = {};
    for (var i = 0, n = rnd.int(1, 2); i < n; i++) {
      var o = rnd.pick(ctx.active), p = prods[rnd.pick(o.garments)];
      if (pairs[p.id + o.no]) continue;
      pairs[p.id + o.no] = 1;
      items.push({ productId: p.id, orderNo: o.no, qty: rnd.int(20, 150), rejected: 0 });
    }
    var hasPhoto = rnd.chance(0.12), defects = [];
    items.forEach(function (it) {
      it.rejected = Math.min(it.qty, binom(rnd, binom(rnd, it.qty, rate), det));
      if (it.rejected > 0) defects = defects.concat(defectRows(rnd, it, it.rejected, types, checked, ctx.problem, hasPhoto));
    });
    return { id: auditId(rnd, day, seen), day: day, createdAt: DT.kyivToIso(day, rnd.int(8 * 60, 17 * 60 + 30)),
      locationId: dep.locationId, departmentId: dep.id, auditorId: auditor.id,
      orders: items.reduce(function (a, it) { if (a.indexOf(it.orderNo) < 0) a.push(it.orderNo); return a; }, []),
      items: items, checkedWorkers: checked, comment: rnd.chance(0.12) ? rnd.pick(D.comments) : '',
      noDefects: defects.length === 0, defects: defects, isTest: true };
  }

  P.demoGenerateAudits = function (db, rnd, today) {
    var DT = P.demoDates, seen = {};
    db.locations.forEach(function (l) {
      var deps = db.departments.filter(function (d) { return d.locationId === l.id; });
      var ctx = { auditors: db.users.filter(function (u) {
        return u.locationIds.length === 1 && u.locationIds[0] === l.id && (u.role === 'auditor' || u.role === 'senior_auditor'); }),
        problem: {}, active: [] };
      rnd.sample(db.workers.filter(function (w) { return w.departmentId === deps.filter(function (d) { return d.deptTypeId === 'DT_SEW'; })[0].id; }), 2)
        .forEach(function (w) { ctx.problem[w.code] = true; });
      var spikes = {};
      rnd.sample([5, 12, 20, 28, 35, 43, 51, 60, 68, 77, 85], 3).forEach(function (off) { spikes[DT.addDays(today, -off)] = true; });
      var orders = db.orders.filter(function (o) { return o.locationId === l.id; });
      for (var ago = 89; ago >= 0; ago--) {
        var day = DT.addDays(today, -ago), wd = DT.dow(day);
        if (wd === 0) continue;
        ctx.active = orders.filter(function (o) { return o.firstDay <= day && day <= o.lastDay; });
        if (!ctx.active.length) continue;
        deps.forEach(function (dep) {
          for (var k = 0, n = wd === 6 ? 1 : rnd.int(1, 3); k < n; k++) db.audits.push(makeAudit(db, rnd, ctx, dep, day, !!spikes[day], seen));
        });
      }
    });
    db.audits.sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0; });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P.demoGenerateAudits;
})(typeof window !== 'undefined' ? window : globalThis);
