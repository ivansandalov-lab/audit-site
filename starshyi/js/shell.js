(function (root) {
  'use strict';
  var P = root.P, doc = root.document, esc = P.esc;
  var S = P.sr = {};
  var app, main, me = null, loc = null, cur = null, kdNew = 0;

  var LV = { fix: 'неправильно зроблене', repair: 'пошкоджене', scrap: 'зламане' };
  function num(n) { return n == null ? '—' : P.fmt && P.fmt.num ? P.fmt.num(n) : String(n); }
  function pct(v) { return v == null ? '—' : String(Math.round(v * 10) / 10).replace('.', ',') + '%'; }
  S.LEVELS = LV;
  S.h = {
    esc: esc, num: num, pct: pct,
    ic: function (n, cls) { return P.ic(n, cls); },
    lvl: function (level, text) { level = LV[level] ? level : 'fix'; return '<span class="lvl lvl--' + level + '">' + esc(text || LV[level]) + '</span>'; },
    badge: function (text, kind) { return '<span class="badge' + (kind ? ' badge--' + kind : '') + '">' + esc(text) + '</span>'; },
    kpi: function (val, label, mod) { return '<div class="kpi' + (mod ? ' kpi--' + mod : '') + '"><span class="kpi__val">' + esc(val) + '</span><span class="kpi__label">' + esc(label) + '</span></div>'; },
    stack: function (o, height) {
      var t = (o.fix || 0) + (o.repair || 0) + (o.scrap || 0);
      if (!t) return '<div class="stack"' + (height ? ' style="height:' + height + 'px"' : '') + '></div>';
      return '<div class="stack" role="img" aria-label="Рівні браку"' + (height ? ' style="height:' + height + 'px"' : '') + '>' +
        ['fix', 'repair', 'scrap'].map(function (k) { return o[k] ? '<i class="s-' + k + '" style="width:' + (o[k] / t * 100).toFixed(1) + '%"></i>' : ''; }).join('') + '</div>';
    },
    legend: function (o) {
      return '<div class="legend">' + ['fix', 'repair', 'scrap'].map(function (k) {
        return '<span class="lvl lvl--' + k + '">' + esc(LV[k]) + (o ? ' · ' + num(o[k] || 0) : '') + '</span>'; }).join('') + '</div>';
    },
    threshold: function (rate, over) {
      var w = Math.max(0, Math.min(100, (rate || 0) * 10));
      return '<div class="threshold"><i class="' + (over ? 'hot' : '') + '" style="width:' + w + '%"></i><b style="left:50%"></b></div>';
    },
    dyn: function (rates, labels, height) {
      var h = height || 64, k = h / 8;
      return '<div class="dyn" style="height:' + h + 'px" role="img" aria-label="' + esc(rates.map(pct).join(' · ')) + '"><b style="bottom:' + Math.round(5 * k) + 'px"></b>' +
        rates.map(function (r) { return r == null ? '<i style="height:2px;background:var(--line-mid)"></i>' : '<i' + (r > 5 ? ' class="hot"' : '') + ' style="height:' + Math.max(2, Math.round(Math.min(r, 8) * k)) + 'px"></i>'; }).join('') + '</div>' +
        (labels ? '<div class="dyn-x">' + labels.map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') + '</div>' : '');
    },
    empty: function (title, text) { return P.state.empty('info', title, text); },
    loading: function () { return P.state.loading(); },
    error: function (r) { return P.state.error('Не вдалося завантажити', (r && r.error) || ''); },
    dayLong: function (day) {
      var d = new Date(Date.parse(day + 'T12:00:00Z'));
      return d.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
    },
    dayShort: function (day) { var p = String(day).split('-'); return +p[2] + '.' + p[1]; }
  };

  function today() { return P.fmt.dayKey(new Date()); }
  function addDays(k, n) { var p = k.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * 86400000).toISOString().slice(0, 10); }
  var period = (function () { var v = P.store.get('sr:period', null); return v && v.from && v.to ? v : { from: addDays(today(), -29), to: today(), preset: 30 }; })();
  S.period = function () { return { from: period.from, to: period.to, preset: period.preset || null }; };
  function setPeriod(p) { period = p; P.store.set('sr:period', p); render(); }
  function periodBar() {
    return '<div class="wrap bar"><span class="hint">Період</span>' +
      '<label class="date">' + P.ic('calendar', 'ui-icon--sm') + '<input type="date" data-period="from" value="' + period.from + '" max="' + period.to + '" style="border:0;background:transparent;font:inherit;color:inherit"></label>' +
      '<span class="hint">—</span>' +
      '<label class="date">' + P.ic('calendar', 'ui-icon--sm') + '<input type="date" data-period="to" value="' + period.to + '" max="' + today() + '" style="border:0;background:transparent;font:inherit;color:inherit"></label>' +
      '<span class="pills">' + [7, 30, 90].map(function (n) {
        return '<button class="pill' + (period.preset === n ? ' pill--on' : '') + '" type="button" data-act="sr-preset" data-n="' + n + '">' + n + ' дн.</button>'; }).join('') + '</span></div>';
  }

  var stack = [];
  function overlayHost() { return doc.getElementById('overlay'); }
  function closeTop() { var o = stack[stack.length - 1]; if (o) o.close(); }
  function makeLayer(kind, o) {
    var host = overlayHost(), wrap = doc.createElement('div');
    wrap.className = 'ov ov--' + kind;
    var head = '<div class="modal__head"><div style="flex:1;min-width:0"><h2 class="modal__title">' + esc(o.title || '') + '</h2>' +
      (o.sub ? '<p class="hint">' + o.sub + '</p>' : '') + '</div>' + (o.head || '') +
      (o.closable === false ? '' : '<button class="icon-btn" type="button" data-ov-close aria-label="Закрити">' + P.ic('close') + '</button>') + '</div>';
    var body = kind === 'drawer' ? '<div class="ov-body" style="display:flex;flex-direction:column;gap:16px;padding:20px 24px;overflow:auto;flex:1">' + (o.body || '') + '</div>'
      : '<div class="ov-body" style="display:flex;flex-direction:column;gap:16px;padding:20px 24px;overflow:auto">' + (o.body || '') + '</div>';
    var foot = o.foot ? '<div class="modal__foot">' + o.foot + '</div>' : '';
    if (kind === 'modal') wrap.innerHTML = '<div class="backdrop" data-ov-close></div><section class="modal' + (o.size === 'sm' ? ' modal--sm' : '') + (o.size === 'frame' ? ' modal--frame' : '') + '" role="dialog" aria-modal="true">' + (o.raw || (head + body + foot)) + '</section>';
    else if (kind === 'drawer') wrap.innerHTML = '<div class="backdrop backdrop--light" data-ov-close></div><aside class="drawer" role="dialog" aria-modal="true">' + head + body + foot + '</aside>';
    else wrap.innerHTML = '<div class="backdrop backdrop--none" data-ov-close></div><nav class="menu" style="' + (o.style || '') + '">' + (o.body || '') + '</nav>';
    host.appendChild(wrap);
    var layer = { el: wrap, kind: kind, closed: false,
      close: function () {
        if (layer.closed) return; layer.closed = true; wrap.remove();
        stack.splice(stack.indexOf(layer), 1);
        if (o.onClose) o.onClose();
      },
      body: function (html) { var b = wrap.querySelector('.ov-body'); if (b) b.innerHTML = html; },
      foot: function (html) { var f = wrap.querySelector('.modal__foot'); if (f) f.innerHTML = html; } };
    wrap.addEventListener('click', function (e) {
      var c = e.target.closest('[data-ov-close]');
      if (c && wrap.contains(c) && o.closable !== false) { layer.close(); return; }
      var t = e.target.closest('[data-act]');
      if (t && wrap.contains(t) && o.on && o.on[t.getAttribute('data-act')]) { e.preventDefault(); o.on[t.getAttribute('data-act')](t, e, layer); }
    });
    stack.push(layer);
    if (o.onMount) o.onMount(wrap, layer);
    var f = wrap.querySelector('input, select, textarea, button:not([data-ov-close])'); if (f && kind !== 'menu') try { f.focus({ preventScroll: true }); } catch (e) { /* */ }
    return layer;
  }
  S.modal = function (o) { return makeLayer('modal', o); };
  S.drawer = function (o) { return makeLayer('drawer', o); };
  S.menu = function (anchor, o) {
    var r = anchor.getBoundingClientRect();
    o.style = 'position:fixed;top:' + Math.round(r.bottom + 8) + 'px;right:' + Math.max(16, Math.round(root.innerWidth - r.right)) + 'px;width:' + (o.width || 360) + 'px;max-width:calc(100vw - 32px)';
    return makeLayer('menu', o);
  };
  S.closeAll = function () { while (stack.length) stack[stack.length - 1].close(); };
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && stack.length) { var top = stack[stack.length - 1]; if (top.kind !== 'modal' || !top.el.querySelector('[data-locked]')) closeTop(); } });

  var TABS = [
    { id: 'analytics', label: 'Аналітика', ic: 'chart', path: '/analytics' },
    { id: 'people', label: 'Люди', ic: 'people', path: '/people' },
    { id: 'kd', label: 'Коригуючі дії', ic: 'corrective', path: '/kd' },
    { id: 'history', label: 'Історія аудитів', ic: 'audit', path: '/history' },
    { id: 'manage', label: 'Керування', ic: 'settings', path: '/manage/team' }
  ];
  function frame(tab, showPeriod) {
    var now = new Date(), hhmm = (now.getHours() < 10 ? '0' : '') + now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
    return '<div class="sr-demo" role="note">' + P.ic('info', 'ui-icon--sm') + 'Тестова версія · усі імена й цифри вигадані · дані живуть лише в цьому браузері</div>' +
      '<header class="wrap hdr"><div class="hdr__titles"><h1 class="hdr__title">' + esc(loc ? loc.name : '') + '</h1>' +
      '<p class="hdr__sub">Сторінка старшого аудитора · ' + esc(S.h.dayLong(today())) + '</p></div>' +
      '<div class="hdr__tools"><button class="plus" type="button" data-act="sr-plus" aria-label="Додати">' + P.ic('add') + '<span class="sr-hide-phone">Додати</span></button>' +
      '<button class="tool" type="button" data-act="sr-refresh" title="Перечитати дані" aria-label="Оновлено о ' + hhmm + ' — перечитати"><span class="sr-hide-phone">Оновлено о ' + hhmm + '</span>' + P.ic('refresh', 'ui-icon--sm') + '</button>' +
      '<button class="who" type="button" data-act="sr-profile" aria-label="Мій профіль"><span class="avatar" style="width:40px;height:40px">' + esc(P.initials ? P.initials(me.name) : '') + '</span><span class="sr-hide-phone">' + esc(me.name) + '</span></button></div></header>' +
      '<nav class="wrap tabs" aria-label="Розділи">' + TABS.map(function (t) {
        return '<a class="tab' + (t.id === tab ? ' tab--on' : '') + '" href="#' + t.path + '">' + P.ic(t.ic) + esc(t.label) +
          (t.id === 'kd' && kdNew ? '<span class="count count--danger">' + kdNew + '</span>' : '') + '</a>'; }).join('') + '</nav>' +
      (showPeriod ? periodBar() : '') + '<main class="wrap content" id="sr-main" style="padding-top:' + (showPeriod ? 0 : 20) + 'px"></main>';
  }

  var screens = [], gen = 0;
  S.screen = function (pattern, def) { P.router.add(pattern, def); screens.push(pattern); };
  function refreshKdCount() {
    P.srv('srKdOverview', { locationId: loc.id }).then(function (r) {
      var n = r && r.ok && r.totals ? r.totals.new || 0 : 0;
      if (n !== kdNew) { kdNew = n; var t = app.querySelector('.tab[href="#/kd"]'); if (t) { var c = t.querySelector('.count'); if (c) c.remove(); if (n) t.insertAdjacentHTML('beforeend', '<span class="count count--danger">' + n + '</span>'); } }
    });
  }
  P.on('kd:changed', function () { if (loc) refreshKdCount(); });

  function render() {
    if (!me) return;
    var r = P.router.current(), m = P.router.match(r.path);
    if (!m) { P.router.go('/analytics'); return; }
    var def = m.screen, my = ++gen, handlers = {};
    S.closeAll();
    app.innerHTML = frame(def.tab, def.period !== false);
    main = app.querySelector('#sr-main');
    doc.title = (def.title || 'Кабінет') + ' — ' + (loc ? loc.name : '') + ' · старший (тест)';
    cur = { el: main, me: me, loc: loc, params: m.params, query: r.query, period: S.period(),
      alive: function () { return my === gen; },
      on: function (act, fn) { handlers[act] = fn; },
      go: function (path, query) { P.router.go(path, query); },
      reload: function () { render(); },
      handlers: handlers };
    main.innerHTML = S.h.loading();
    try { def.render(cur); } catch (e) { main.innerHTML = P.state.error('Помилка на екрані', String((e && e.message) || e)); if (root.console) console.error(e); }
  }
  S.render = render;

  function menuItem(act, ic, title, sub, extra) {
    return '<button class="menu__item" type="button" data-act="' + act + '"' + (extra || '') + ' style="border:0;background:transparent;width:100%;text-align:left;font:inherit;cursor:pointer">' +
      '<span class="menu__ic">' + P.ic(ic) + '</span><span><span class="menu__t">' + esc(title) + '</span>' + (sub ? '<span class="menu__s">' + esc(sub) + '</span>' : '') + '</span></button>';
  }
  function openPlus(anchor) {
    var go = function (sec) { return function (t, e, layer) { layer.close(); P.router.go('/manage/' + sec, { new: '1' }); }; };
    S.menu(anchor, { width: 380, body:
      '<p class="group-label" style="padding:6px 12px 4px">Записати</p>' +
      menuItem('p-audit', 'audit', 'Новий аудит', 'Та сама форма, що в працівника, — у вікні') +
      '<div class="menu__sep"></div><p class="group-label" style="padding:6px 12px 4px">Додати в довідник</p>' +
      menuItem('p-team', 'user', 'Аудитор', 'Доступ до додатку за робочою поштою') +
      menuItem('p-workers', 'people', 'Виробничий працівник', 'Код і відділ — щоб обирати в аудитах') +
      menuItem('p-products', 'department', 'Виріб', 'Для типу відділу') +
      menuItem('p-defects', 'defect', 'Вид браку', 'З рівнем: неправильно зроблене · пошкоджене · зламане') +
      menuItem('p-blocks', 'order', 'Блок замовлень', 'Кілька замовлень під однією назвою'),
      on: { 'p-audit': function (t, e, layer) { layer.close(); S.newAudit(); }, 'p-team': go('team'), 'p-workers': go('workers'),
        'p-products': go('products'), 'p-defects': go('defects'), 'p-blocks': go('blocks') } });
  }
  function openProfile(anchor) {
    var dark = doc.documentElement.getAttribute('data-theme') === 'dark';
    S.menu(anchor, { width: 340, body:
      '<div style="display:flex;gap:12px;align-items:center;padding:8px 12px"><span class="avatar" style="width:48px;height:48px">' + esc(P.initials(me.name)) + '</span>' +
      '<div style="min-width:0"><b>' + esc(me.name) + '</b><p class="hint">' + esc(maskEmail(me.email)) + '</p></div></div>' +
      '<div style="padding:4px 12px 8px;display:flex;flex-direction:column;gap:6px"><span class="badge badge--brand" style="align-self:flex-start">' + esc(me.roleLabel) + ' · ' + esc(loc ? loc.name : '') + '</span>' +
      '<span class="hint">Вхід через Google · пароль не потрібен</span></div>' +
      '<div class="menu__sep"></div><div style="padding:8px 12px"><div class="seg" role="group" aria-label="Тема">' +
      '<button class="seg__btn' + (dark ? '' : ' seg__btn--on') + '" type="button" data-act="th" data-v="light">' + P.ic('theme-light', 'ui-icon--sm') + 'Світла</button>' +
      '<button class="seg__btn' + (dark ? ' seg__btn--on' : '') + '" type="button" data-act="th" data-v="dark">' + P.ic('theme-dark', 'ui-icon--sm') + 'Темна</button></div></div>' +
      '<div class="menu__sep"></div>' +
      menuItem('pf-reset', 'refresh', 'Скинути тестові дані', 'Усе, що ви змінили в тестовій версії, зникне') +
      menuItem('pf-out', 'logout', 'Вийти', ''),
      on: {
        th: function (t, e, layer) { var v = t.getAttribute('data-v'); doc.documentElement.setAttribute('data-theme', v); P.store.set('theme:sr', v); layer.close(); },
        'pf-reset': function (t, e, layer) { layer.close(); P.confirm({ title: 'Скинути тестові дані?', text: 'Записані аудити, коригуючі дії й правки довідників у цьому браузері зникнуть.', okLabel: 'Скинути', danger: true })
          .then(function (ok) { if (!ok) return; P.srv('demoReset', {}).then(function () { P.toast('ok', 'Тестові дані скинуто'); boot(); }); }); },
        'pf-out': function (t, e, layer) { layer.close(); P.srv('authLogout', {}).then(function () { me = null; boot(); }); }
      } });
  }
  function maskEmail(e) { e = String(e || ''); var at = e.indexOf('@'); return at > 2 ? e.slice(0, 2) + '***' + e.slice(at) : e; }

  S.newAudit = function (opts) {
    var src = '../pratsivnyk/index.html?embed=1#/audit/new';
    S.modal({ size: 'frame', title: 'Новий аудит · ' + (loc ? loc.name : ''), head: '<span class="badge badge--brand">записуєте як старший аудитор</span>',
      body: '<iframe class="sr-frame" title="Форма аудиту" src="' + src + '"></iframe>',
      onMount: function (el) { el.querySelector('.ov-body').style.padding = '0'; } });
  };
  root.addEventListener('message', function (e) {
    var d = e.data || {};
    if (e.origin !== root.location.origin || d.type !== 'audit:saved') return;
    S.closeAll();
    P.toast('ok', (d.edited ? 'Аудит виправлено' : 'Аудит записано о ' + (d.time || '')), (d.summary || ''));
    reloadData();
  });

  function reloadData() { return P.srv('demoReload', {}).then(function () { P.emit('kd:changed'); render(); }); }
  S.reloadData = reloadData;
  var pending = null;
  root.addEventListener('storage', function (e) {
    if (!me || !e.key || e.key.indexOf('audit-demo:demo:') !== 0 || e.key.indexOf('audit-demo:demo:me') === 0 || e.key.indexOf('audit-demo:demo:loggedAt') === 0) return;
    clearTimeout(pending);
    pending = setTimeout(function () {
      if (stack.length) { P.toast('info', 'Зʼявились нові дані', 'Натисніть «Оновлено», щоб побачити.'); return; }
      reloadData().then(function () { P.toast('info', 'Нові дані', 'Кабінет оновився сам — наприклад, хтось записав аудит.'); });
    }, 600);
  });

  function loginScreen(users, note) {
    app.innerHTML = '<div class="sr-demo" role="note">' + P.ic('info', 'ui-icon--sm') + 'Тестова версія · усі імена й цифри вигадані</div>' +
      '<main class="wrap" style="max-width:520px;padding-top:72px;display:flex;flex-direction:column;gap:14px;text-align:center;align-items:center">' +
      '<div class="hero__logo">' + P.ic('audit') + '</div><h1 class="hero__title">Аудит якості</h1><p class="hero__lead">Кабінет старшого аудитора</p>' +
      (note ? '<div class="banner banner--warn" style="text-align:left">' + P.ic('warning') + '<div class="banner__body"><p class="banner__text">' + esc(note) + '</p></div></div>' : '') +
      '<p class="hint">Тестова версія: вхід без пароля. У справжній — Google-пошта зі списку дозволених.</p>' +
      users.map(function (u) { return '<button class="btn btn--primary btn--block" type="button" data-login="' + esc(u.id) + '">' + P.ic('login') + 'Увійти як ' + esc(u.name) + ' · ' + esc(u.locations.map(function (l) { return l.name; }).join(', ') || u.roleLabel) + '</button>'; }).join('') +
      '</main>';
    Array.prototype.forEach.call(app.querySelectorAll('[data-login]'), function (b) {
      b.onclick = function () { b.disabled = true; P.srv('authDemoLogin', { userId: b.getAttribute('data-login') }).then(function (r) { if (r.ok) boot(); else { b.disabled = false; P.toast('danger', 'Не вдалося увійти', r.error); } }); };
    });
  }
  function boot() {
    S.closeAll();
    var as = /[?&]as=([^&#]+)/.exec(root.location.search || '');
    if (as && !boot.tried) { boot.tried = true; P.srv('authDemoLogin', { userId: decodeURIComponent(as[1]) }).then(boot); return; }
    P.srv('authMe', {}).then(function (r) {
      var m = r && r.ok ? r.me : null;
      if (m && (m.role === 'senior_auditor' || m.role === 'admin')) {
        me = m; loc = me.locations.filter(function (l) { return l.id === me.defaultLocationId; })[0] || me.locations[0];
        render(); refreshKdCount(); return;
      }
      P.srv('demoUsers', {}).then(function (u) {
        var list = (u.users || []).filter(function (x) { return x.role === 'senior_auditor'; });
        loginScreen(list, m ? 'Ви увійшли як «' + m.roleLabel + '». Кабінет старшого — для старших аудиторів.' : '');
      });
    });
  }
  S.boot = boot;
  P.on('auth:required', function () { me = null; boot(); });
  P.on('auth:forbidden', function (r) { P.toast('warn', 'Немає прав на цю дію', r && r.error); });

  S.start = function () {
    app = doc.getElementById('app');
    if (P.mountIcons) P.mountIcons();
    app.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act]');
      if (!t || !app.contains(t)) return;
      var act = t.getAttribute('data-act');
      if (act === 'sr-plus') { e.preventDefault(); openPlus(t); return; }
      if (act === 'sr-profile') { e.preventDefault(); openProfile(t); return; }
      if (act === 'sr-refresh') { e.preventDefault(); reloadData().then(function () { P.toast('ok', 'Дані перечитано'); }); return; }
      if (act === 'sr-preset') { var n = +t.getAttribute('data-n'); setPeriod({ from: addDays(today(), -(n - 1)), to: today(), preset: n }); return; }
      if (act === 'retry') { render(); return; }
      if (cur && cur.handlers[act]) { e.preventDefault(); cur.handlers[act](t, e); }
    });
    app.addEventListener('change', function (e) {
      var t = e.target;
      if (t.getAttribute && t.getAttribute('data-period')) {
        var p = { from: period.from, to: period.to, preset: null }; p[t.getAttribute('data-period')] = t.value;
        if (p.from && p.to && p.from <= p.to) setPeriod(p);
        return;
      }
      var a = t.getAttribute && t.getAttribute('data-change');
      if (a && cur && cur.handlers[a]) cur.handlers[a](t, e);
    });
    app.addEventListener('input', function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-input');
      if (a && cur && cur.handlers[a]) cur.handlers[a](e.target, e);
    });
    root.addEventListener('hashchange', render);
    P.on('route', render);   // P.router.go на ту саму адресу не дає hashchange — малюємо за подією роутера
    boot();
  };
})(typeof window !== 'undefined' ? window : globalThis);
