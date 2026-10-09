(function (root) {
  'use strict';
  var P = root.P, doc = root.document, esc = P.esc;
  var S = P.S = P.S || { me: null, loc: null };

  P.screen = function (pattern, def) { P.router.add(pattern, def); };

  P.shell = {};
  P.shell.loc = function () {
    var me = S.me;
    S.loc = me ? (me.defaultLocationId || (me.locations[0] && me.locations[0].id) || null) : null;
    return S.loc;
  };
  P.shell.locName = function (id) {
    var l = S.me && S.me.locations.filter(function (x) { return x.id === id; })[0];
    return l ? l.name : id;
  };
  P.shell.setTheme = function (t) {
    doc.documentElement.setAttribute('data-theme', t);
    P.store.set('theme', t);
    var meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#1D1A17' : '#F8F3EC');
  };
  P.shell.home = function () { return '/home'; };

  function isDesktop() { return !!(root.matchMedia && root.matchMedia('(pointer: fine)').matches) && root.innerWidth >= 900; }
  function pcAllowed() { try { return root.sessionStorage.getItem('pw-pc-ok') === '1'; } catch (e) { return false; } }

  function strip() {
    return '<div class="app-demo" role="note">' + P.ic('info') + '<span class="app-demo__text">Тестова версія · усі імена й цифри вигадані</span></div>';
  }
  function app() { return doc.getElementById('app'); }

  function renderGate() {
    var url = root.location.href.split('#')[0];
    app().innerHTML = strip() + '<main class="gate"><span class="gate__icon">' + P.ic('audit') + '</span>' +
      '<h1 class="gate__title">Додаток працівника — для телефона</h1>' +
      '<p class="gate__text">Відкрийте цю адресу на своєму телефоні:</p><p class="gate__url">' + esc(url) + '</p>' +
      '<button class="ui-btn ui-btn--secondary" type="button" data-act="pc-ok">' + P.ic('expand') + 'Все одно відкрити тут (для перевірки)</button></main>';
  }

  function renderLogin() {
    app().innerHTML = strip() + '<main class="login"><span class="login__logo">' + P.ic('audit') + '</span>' +
      '<h1 class="login__title">Аудит якості</h1><p class="login__lead">Кабінет працівника</p>' +
      '<button class="ui-btn ui-btn--primary login__btn" type="button" data-act="login">' + P.ic('login') + 'Увійти через Google</button>' +
      '<p class="login__note">Увійдіть робочою Google-поштою. Раз на тиждень додаток попросить увійти знову.</p>' +
      '<p class="login__note">Немає доступу? Попросіть старшого аудитора додати вашу пошту.</p>' +
      '<p class="login__note login__note--test">Тестова версія: вхід без пароля, як вигаданий працівник.</p></main>';
  }
  function login(btn) {
    btn.disabled = true;
    P.srv('demoUsers').then(function (r) {
      var u = r.ok && r.users.filter(function (x) { return x.role === 'auditor'; })[0];
      if (!u) { btn.disabled = false; return P.toast('danger', 'Не вдалося увійти', (r && r.error) || 'Немає тестового працівника.'); }
      return P.srv('authDemoLogin', { userId: u.id }).then(function (res) {
        if (!res.ok) { btn.disabled = false; return P.toast('danger', 'Не вдалося увійти', res.error); }
        S.me = res.me; buildFrame(); P.router.go('/home');
      });
    });
  }

  function buildFrame() {
    app().innerHTML = strip() +
      '<header class="app-top"><button class="icon-btn" type="button" data-act="back" hidden aria-label="Назад">' + P.ic('arrow-left') + '</button>' +
      '<div class="app-top__titles"><h1 class="app-top__title" id="top-title">Аудит</h1><p class="app-top__sub" id="top-sub"></p></div>' +
      '<button class="avatar-btn" type="button" data-act="profile" aria-label="Мій профіль">' + esc(P.initials(S.me.name)) + '</button></header>' +
      '<main class="app-main" id="main" tabindex="-1"></main>';
  }
  function bindFrame(el) {
    P.delegate(el, 'click', '[data-act="pc-ok"]', function () {
      try { root.sessionStorage.setItem('pw-pc-ok', '1'); } catch (e) { /* без памʼяті — покажемо лише зараз */ }
      boot();
    });
    P.delegate(el, 'click', '[data-act="login"]', function (e, t) { login(t); });
    P.delegate(el, 'click', '[data-act="back"]', function (e, t) { P.router.go(t.getAttribute('data-to') || '/home'); });
    P.delegate(el, 'click', '[data-act="profile"]', function () { P.router.go('/profile'); });
  }

  var seq = 0;
  function render() {
    if (!S.me) return;
    var my = ++seq;                     // будь-яка відповідь попереднього показу тепер «застаріла»
    P.sheet.close();
    var main = doc.getElementById('main');
    if (!main) { buildFrame(); main = doc.getElementById('main'); }
    var cur = P.router.current(), m = P.router.match(cur.path);
    if (!m) return P.router.go('/home');
    var def = m.screen, ctx = { params: m.params, query: cur.query, me: S.me, alive: function () { return my === seq; } };
    ctx.loc = P.shell.loc();
    app().classList.toggle('is-focus', !!def.focus);
    var back = app().querySelector('[data-act="back"]');
    back.hidden = !def.back; if (def.back) back.setAttribute('data-to', typeof def.back === 'function' ? def.back(ctx) : def.back);
    setTitle(def.title ? def.title(ctx) : 'Аудит');
    var host = doc.createElement('div');
    host.className = 'screen';
    main.innerHTML = '';
    main.appendChild(host);
    host.innerHTML = P.state.loading();
    Promise.resolve().then(function () { return def.render(ctx); }).then(function (html) {
      if (!ctx.alive()) return;          // поки вантажилось, користувач уже перейшов деінде
      host.innerHTML = html;
      if (def.mount) def.mount(host, ctx);
      root.scrollTo(0, 0);
    }, function (e) {
      if (!ctx.alive()) return;
      host.innerHTML = P.state.error('Помилка на екрані', String((e && e.message) || e));
      var r = host.querySelector('[data-act="retry"]'); if (r) r.onclick = render;
    });
  }
  function setTitle(t) {
    var o = typeof t === 'string' ? { title: t } : (t || {});
    var a = doc.getElementById('top-title'), b = doc.getElementById('top-sub');
    if (a) a.textContent = o.title || 'Аудит';
    if (b) { b.textContent = o.sub || ''; b.hidden = !o.sub; }
    doc.title = (o.title || 'Аудит') + ' — Аудит якості (тест)';
  }
  P.shell.setTitle = setTitle;
  P.shell.rerender = render;

  function boot() {
    P.srv('authMe').then(function (r) {
      S.me = r.ok ? r.me : null;
      if (!S.me && P.embed) { app().innerHTML = P.state.empty('login', 'Увійдіть у кабінет старшого', 'Форма відкривається від імені того, хто увійшов у кабінет.'); return; }
      if (!S.me) return renderLogin();
      buildFrame(); render();
    });
  }

  P.shell.start = function () {
    P.mountIcons();
    bindFrame(app());
    root.addEventListener('hashchange', render);
    P.on('route', render);
    P.on('auth:required', function () { S.me = null; renderLogin(); });
    P.on('auth:forbidden', function (r) { P.toast('warn', 'Немає прав на цю дію', r && r.error); });
    if (isDesktop() && !pcAllowed() && !P.embed) return renderGate();   // у вікні старшого заставки немає
    boot();
  };
})(window);
