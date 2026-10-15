(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var SIM_KEY = 'offline:sim', PRE = 'offline:queue:';

  function withoutPhotos(p) {
    var c = JSON.parse(JSON.stringify(p));
    (Array.isArray(c.defects) ? c.defects : []).forEach(function (d) { if (d) d.photos = []; });
    return c;
  }
  function valid(x) { return !!(x && typeof x === 'object' && x.payload && typeof x.payload === 'object' && typeof x.clientId === 'string' && x.clientId); }
  function reason(r) { return (r && r.errors && r.errors[0] && r.errors[0].message) || (r && r.error) || 'Сервер не прийняв аудит.'; }

  function make(deps) {
    var busy = null;
    var Q = {
      canSimulate: function () { return !!deps.demo(); },
      simulated: function () { return Q.canSimulate() && deps.store.get(SIM_KEY, false) === true; },
      setSimulated: function (on) { if (on && Q.canSimulate()) deps.store.set(SIM_KEY, true); else deps.store.del(SIM_KEY); },
      isOff: function () { return deps.online() === false || Q.simulated(); },
      list: function (uid) { var l = deps.store.get(PRE + uid, []); return Array.isArray(l) ? l.filter(valid) : []; },
      count: function (uid) { return Q.list(uid).length; },
      running: function () { return !!busy; },
      enqueue: function (uid, payload, summary) {
        var l = Q.list(uid).filter(function (x) { return x.clientId !== payload.clientId; });
        var item = { clientId: payload.clientId, payload: payload, summary: String(summary || ''), savedAt: Date.now(), error: null };
        if (deps.store.set(PRE + uid, l.concat([item]))) return { ok: true, photosDropped: false };
        var hadPhotos = (payload.defects || []).some(function (d) { return d && Array.isArray(d.photos) && d.photos.length; });
        if (!hadPhotos) return { ok: false, photosDropped: false };
        item.payload = withoutPhotos(payload);
        return deps.store.set(PRE + uid, l.concat([item])) ? { ok: true, photosDropped: true } : { ok: false, photosDropped: false };
      },
      remove: function (uid, clientId) {
        var l = Q.list(uid), left = l.filter(function (x) { return x.clientId !== clientId; });
        if (!left.length) deps.store.del(PRE + uid); else if (left.length !== l.length) deps.store.set(PRE + uid, left);
      },
      mark: function (uid, clientId, text) {
        deps.store.set(PRE + uid, Q.list(uid).map(function (x) { return x.clientId === clientId ? Object.assign({}, x, { error: text }) : x; }));
      },
      flush: function (uid) {
        if (busy) return busy;
        var res = { sent: 0, failed: 0, left: 0, offline: false, photosDropped: 0 };
        if (Q.isOff()) { res.offline = true; res.left = Q.count(uid); return Promise.resolve(res); }
        busy = Q.list(uid).filter(function (x) { return !x.error; }).reduce(function (chain, it) {
          return chain.then(function () {
            if (res.offline || Q.isOff()) { res.offline = true; return null; }
            return deps.srv('auditSubmit', Object.assign({}, it.payload, { recordedAt: new Date(it.savedAt).toISOString() })).then(function (r) {
              if (r && r.ok) { Q.remove(uid, it.clientId); res.sent++; if (r.photosDropped) res.photosDropped++; return; }
              var code = r && r.code;
              if (code === 'offline') { res.offline = true; return; }
              if (code === 'server' || code === 'auth') return;          // тимчасове або треба увійти — спробуємо пізніше
              Q.mark(uid, it.clientId, reason(r)); res.failed++;
            });
          });
        }, Promise.resolve()).then(function () { busy = null; res.left = Q.count(uid); return res; },
          function () { busy = null; res.left = Q.count(uid); return res; });
        return busy;
      }
    };
    return Q;
  }

  var Q = P.offline = make({
    store: P.store,
    srv: function (fn, p) { return P.srv(fn, p); },
    online: function () { return !(root.navigator && root.navigator.onLine === false); },
    demo: function () { return !!(P.demo && P.backend === P.demo); }
  });
  Q.make = make;

  function report(res) {
    if (!P.toast || !res) return;
    if (res.sent) P.toast('ok', 'Надіслано: ' + res.sent + ' ' + P.plural(res.sent, 'аудит', 'аудити', 'аудитів'), 'Записані без звʼязку аудити дійшли.' + (res.photosDropped ? ' Без фото: ' + res.photosDropped + ' — памʼять телефона заповнена.' : ''));
    if (res.failed) P.toast('warn', 'Не прийнято: ' + res.failed + ' ' + P.plural(res.failed, 'аудит', 'аудити', 'аудитів'), 'Причина — на головній.');
  }
  Q.auto = function () {
    var me = P.S && P.S.me;
    if (!me || Q.running() || !Q.count(me.id) || Q.isOff()) return Promise.resolve(null);
    return Q.flush(me.id).then(function (res) {
      report(res);
      if (P.router && P.router.current().path === '/home' && P.shell && P.shell.rerender) P.shell.rerender();
      return res;
    });
  };
  Q.report = report;

  if (typeof root.addEventListener === 'function' && root.document) {
    root.addEventListener('online', function () { Q.auto(); });
    var tries = 0, timer = root.setInterval(function () {
      if (++tries > 40 || (P.S && P.S.me)) { root.clearInterval(timer); Q.auto(); }
    }, 500);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = P.offline;
})(typeof window !== 'undefined' ? window : globalThis);
