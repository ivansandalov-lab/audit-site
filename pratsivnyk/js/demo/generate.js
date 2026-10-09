(function (root) {
  'use strict';
  var P = root.P = root.P || {};

  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRnd(seed) {
    var f = mulberry32(seed);
    var r = {
      f: f,
      between: function (a, b) { return a + f() * (b - a); },
      int: function (a, b) { return a + Math.floor(f() * (b - a + 1)); },
      chance: function (p) { return f() < p; },
      pick: function (arr) { return arr[Math.floor(f() * arr.length)]; },
      sample: function (arr, n) {
        var c = arr.slice(), out = [];
        while (out.length < n && c.length) out.push(c.splice(Math.floor(f() * c.length), 1)[0]);
        return out;
      }
    };
    return r;
  }

  function parseDay(k) { var p = k.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function addDays(k, n) { return new Date(parseDay(k) + n * 86400000).toISOString().slice(0, 10); }
  function dow(k) { return new Date(parseDay(k)).getUTCDay(); }
  var dtf = null;
  function kyivOffsetMin(utcMs) {
    dtf = dtf || new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Kyiv', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var o = {};
    dtf.formatToParts(new Date(utcMs)).forEach(function (p) { o[p.type] = p.value; });
    var asUtc = Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute, +o.second);
    return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
  }
  function kyivToIso(dayKey, minutes) {
    var local = parseDay(dayKey) + minutes * 60000;
    var off = kyivOffsetMin(local - 3 * 3600000);
    var utc = local - off * 60000;
    var off2 = kyivOffsetMin(utc);
    if (off2 !== off) utc = local - off2 * 60000;
    return new Date(utc).toISOString();
  }
  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  P.demoDates = { parseDay: parseDay, addDays: addDays, dow: dow, kyivToIso: kyivToIso, pad: pad, makeRnd: makeRnd };

  function buildCatalogs(db, D) {
    db.locations = D.locations.map(function (l) { return { id: l.id, name: l.name }; });
    db.deptTypes = D.deptTypes.map(function (t) { return { id: t.id, name: t.name, letter: t.letter }; });
    db.locations.forEach(function (l) {
      D.deptsByLocation[l.id].forEach(function (tid) {
        var t = D.deptTypes.filter(function (x) { return x.id === tid; })[0];
        db.departments.push({ id: 'DEP_' + l.id.slice(4) + '_' + tid.slice(3), locationId: l.id, deptTypeId: tid, name: t.name });
      });
    });
    var nDef = 0;
    D.deptTypes.forEach(function (t, ti) {
      D.garments.forEach(function (g, gi) {
        db.products.push({ id: 'PRD_' + pad(ti * D.garments.length + gi + 1, 3), name: g, deptTypeId: t.id });
      });
      D.defectTypes[t.id].forEach(function (d) {
        db.defectTypes.push({ id: 'DEF_' + pad(++nDef, 3), name: d[0], deptTypeId: t.id, severity: d[1],
          level: (D.defectLevels && D.defectLevels[d[0]]) || 'fix' });   // рівень браку (09.10)
      });
    });
  }

  function translit(D, s) {
    return s.toLowerCase().split('').map(function (c) { return D.translit[c] != null ? D.translit[c] : ''; }).join('');
  }
  function buildPeople(db, D, rnd) {
    var emails = {};
    function person() { return { first: rnd.pick(D.firstNames), ini: rnd.pick(D.initials) }; }
    function addUser(id, role, locationIds, extra) {
      var p, email;
      do { p = person(); email = translit(D, p.first) + '.' + translit(D, p.ini) + '@example.com'; } while (emails[email]);
      emails[email] = 1;
      var u = { id: id, name: p.first + ' ' + p.ini + '.', role: role, email: email, locationIds: locationIds };
      if (extra) Object.keys(extra).forEach(function (k) { u[k] = extra[k]; });
      db.users.push(u);
    }
    db.locations.forEach(function (l, li) {
      var lc = l.id.slice(4), low = lc.toLowerCase(), counter = li * 100, used = {};
      db.departments.filter(function (d) { return d.locationId === l.id; }).forEach(function (d) {
        var letter = D.deptTypes.filter(function (t) { return t.id === d.deptTypeId; })[0].letter;
        for (var n = rnd.int(6, 10), i = 0; i < n; i++) {
          var p, name;
          do { p = person(); name = p.first + ' ' + p.ini + '.'; } while (used[name]);
          used[name] = 1;
          db.workers.push({ code: letter + '-' + pad(++counter, 3), name: name, departmentId: d.id, locationId: l.id });
        }
      });
      db.workers.filter(function (w) { return w.departmentId === 'DEP_' + lc + '_SEW'; })[0].name = D.longName;
      for (var a = 1, na = lc === 'A' ? 3 : 2; a <= na; a++) {
        addUser('u_aud_' + low + a, 'auditor', [l.id], a === 2 && lc === 'A' ? { lenient: true } : null);
      }
      addUser('u_sen_' + low, 'senior_auditor', [l.id]);
      addUser('u_lead_' + low, 'location_lead', [l.id]);
    });
    var all = db.locations.map(function (l) { return l.id; });
    addUser('u_manager', 'manager', all);
    addUser('u_admin', 'admin', all);
  }

  function buildOrders(db, D, rnd, today) {
    var no = 4100, N = 36;
    db.locations.forEach(function (l, li) {
      var deps = db.departments.filter(function (d) { return d.locationId === l.id; });
      var mine = [];
      for (var i = 0; i < N; i++) {
        var startAgo = Math.round((N - 1 - i) * 95 / (N - 1)) + rnd.int(0, 2);
        var len = rnd.int(8, 20);
        var garments = rnd.sample(D.garments.map(function (g, gi) { return gi; }), rnd.int(1, 2));
        var daily = {};
        deps.forEach(function (d) { daily[d.id] = rnd.int(40, 400); });
        var o = { no: 'ЗМ-' + (no++), locationId: l.id, customer: rnd.pick(D.customers), garments: garments,
          firstDay: addDays(today, -startAgo), lastDay: addDays(today, -Math.max(0, startAgo - len + 1)), daily: daily };
        db.orders.push(o); mine.push(o);
      }
      var recent = mine.slice().sort(function (a, b) { return a.lastDay < b.lastDay ? 1 : a.lastDay > b.lastDay ? -1 : 0; }).slice(0, 8);
      for (var b = 1; b <= 2; b++) {
        var take = recent.splice(0, rnd.int(2, 3));
        db.orderBlocks.push({ id: 'BLK_' + l.id.slice(4) + b, locationId: l.id, name: 'Блок ' + b,
          orders: take.map(function (o) { return o.no; }) });
      }
      deps.forEach(function (d) { db.norms.push({ departmentId: d.id, sampleTarget: rnd.pick([60, 120, 180, 240]) }); });
    });
  }

  function buildWishes(db, D, rnd, today) {
    db.locations.forEach(function (l) {
      var lc = l.id.slice(4), n = 0;
      var deps = db.departments.filter(function (d) { return d.locationId === l.id; });
      var audits = db.audits.filter(function (a) { return a.locationId === l.id; });
      var liveOrders = db.orders.filter(function (o) { return o.locationId === l.id && o.lastDay === today; });
      function base(dep, o) {
        var tpl = rnd.pick(D.wishTemplates[dep.deptTypeId]);
        var prods = db.products.filter(function (p) { return p.deptTypeId === dep.deptTypeId; });
        var prod = o ? prods[rnd.pick(o.garments)] : (rnd.chance(0.6) ? rnd.pick(prods) : null);
        return { id: 'WSH_' + lc + '_' + pad(++n, 2), locationId: l.id, departmentId: dep.id, productId: prod ? prod.id : null,
          orderNo: o ? o.no : null, title: tpl.title, howTo: tpl.howTo, checklist: tpl.checklist.slice(),
          priority: 'normal', due: null, status: 'open', createdBy: 'u_sen_' + lc.toLowerCase(), doneAuditId: null };
      }
      var urgent = rnd.int(1, 2);
      for (var i = 0; i < 4; i++) {
        var w = base(rnd.pick(deps), liveOrders.length && rnd.chance(0.5) ? rnd.pick(liveOrders) : null);
        if (i < urgent) { w.priority = 'urgent'; w.due = addDays(today, rnd.int(1, 5)); }
        else w.due = addDays(today, rnd.int(5, 14));
        db.wishes.push(w);
      }
      for (var j = 0; j < 3; j++) {
        var au = rnd.pick(audits), dep = deps.filter(function (d) { return d.id === au.departmentId; })[0];
        var done = base(dep, null);
        done.productId = au.items[0].productId; done.orderNo = au.items[0].orderNo;
        done.status = 'done'; done.doneAuditId = au.id; done.due = au.day;
        db.wishes.push(done);
      }
    });
  }

  P.demoGenerate = function (opts) {
    var D = P.demoDict, today = opts.today, rnd = makeRnd(opts.seed);
    var db = { generatedFor: today, seed: opts.seed, locations: [], deptTypes: [], departments: [], products: [],
      defectTypes: [], workers: [], users: [], orders: [], orderBlocks: [], norms: [],
      settings: { criticalPct: 5 }, audits: [], wishes: [] };
    buildCatalogs(db, D);
    buildPeople(db, D, rnd);
    buildOrders(db, D, rnd, today);
    P.demoGenerateAudits(db, rnd, today);
    buildWishes(db, D, rnd, today);
    return db;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P.demoGenerate;
})(typeof window !== 'undefined' ? window : globalThis);
