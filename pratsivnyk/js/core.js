(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  P.VERSION = 'A0-1';

  P.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  P.plural = function (n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  };

  var TZ = 'Europe/Kyiv';
  function parts(iso, opts) {
    var d = iso instanceof Date ? iso : new Date(iso);
    if (isNaN(d)) return null;
    return new Intl.DateTimeFormat('uk-UA', Object.assign({ timeZone: TZ }, opts)).formatToParts(d)
      .reduce(function (o, p) { o[p.type] = p.value; return o; }, {});
  }
  P.fmt = {
    num: function (n) { return n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('uk-UA'); },
    pct: function (x, digits) {
      if (x == null || isNaN(x)) return '—';
      return (Math.round(x * Math.pow(10, digits == null ? 1 : digits)) / Math.pow(10, digits == null ? 1 : digits))
        .toLocaleString('uk-UA') + '%';
    },
    date: function (iso) { var p = parts(iso, { day: '2-digit', month: '2-digit' }); return p ? p.day + '.' + p.month : '—'; },
    time: function (iso) { var p = parts(iso, { hour: '2-digit', minute: '2-digit', hour12: false }); return p ? p.hour + ':' + p.minute : '—'; },
    dateTime: function (iso) { return P.fmt.date(iso) + ' · ' + P.fmt.time(iso); },
    dayKey: function (iso) {
      var p = parts(iso, { year: 'numeric', month: '2-digit', day: '2-digit' });
      return p ? p.year + '-' + p.month + '-' + p.day : '';
    }
  };

  var PREFIX = 'audit-demo:';
  P.store = {
    get: function (key, def) {
      try { var v = root.localStorage.getItem(PREFIX + key); return v == null ? def : JSON.parse(v); }
      catch (e) { return def; }
    },
    set: function (key, val) {
      try { root.localStorage.setItem(PREFIX + key, JSON.stringify(val)); return true; } catch (e) { return false; }
    },
    del: function (key) { try { root.localStorage.removeItem(PREFIX + key); } catch (e) { /* немає памʼяті — нічого */ } }
  };

  var handlers = {};
  P.on = function (evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); };
  P.emit = function (evt, data) { (handlers[evt] || []).slice().forEach(function (fn) { fn(data); }); };

  P.uid = function (prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };

  P.srv = function (fn, payload) {
    if (!P.backend || typeof P.backend.call !== 'function') {
      return Promise.resolve({ ok: false, code: 'server', error: 'Сервер не підключено.' });
    }
    return Promise.resolve()
      .then(function () { return P.backend.call(fn, payload || {}); })
      .then(function (r) {
        r = r || { ok: false, code: 'server', error: 'Порожня відповідь.' };
        if (r.ok === false && r.code === 'auth') P.emit('auth:required', r);
        if (r.ok === false && r.code === 'forbidden') P.emit('auth:forbidden', r);
        return r;
      }, function (e) {
        return { ok: false, code: 'server', error: String((e && e.message) || e) };
      });
  };

  var routes = [];
  function dec(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
  function parseHash(hash) {
    var h = String(hash || '').replace(/^#/, '') || '/';
    var q = h.indexOf('?');
    var path = q >= 0 ? h.slice(0, q) : h, query = {};
    if (q >= 0) h.slice(q + 1).split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = dec(i >= 0 ? kv.slice(0, i) : kv);
      query[k] = i >= 0 ? dec(kv.slice(i + 1)) : '';
    });
    return { path: path.charAt(0) === '/' ? path : '/' + path, query: query };
  }
  P.router = {
    parse: parseHash,
    add: function (pattern, screen) { routes.push({ parts: pattern.split('/').filter(Boolean), screen: screen, pattern: pattern }); },
    match: function (path) {
      var segs = path.split('/').filter(Boolean);
      for (var i = 0; i < routes.length; i++) {
        var r = routes[i], params = {};
        if (r.parts.length !== segs.length) continue;
        var ok = r.parts.every(function (p, j) {
          if (p.charAt(0) === ':') { params[p.slice(1)] = dec(segs[j]); return true; }
          return p === segs[j];
        });
        if (ok) return { screen: r.screen, params: params, pattern: r.pattern };
      }
      return null;
    },
    go: function (path, query) {
      var qs = query ? Object.keys(query).filter(function (k) { return query[k] != null && query[k] !== ''; })
        .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]); }).join('&') : '';
      var target = '#' + path + (qs ? '?' + qs : '');
      if (root.location && root.location.hash !== target) root.location.hash = target;
      else P.emit('route', P.router.current());
    },
    current: function () { return parseHash(root.location ? root.location.hash : ''); }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
