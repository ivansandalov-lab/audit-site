(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc;

  var SECTIONS = [
    { id: 'team', label: 'Аудитори', count: 'team' },
    { id: 'workers', label: 'Виробничі працівники', count: 'workers' },
    { id: 'products', label: 'Відділи й вироби' },
    { id: 'defects', label: 'Види браку', count: 'defects' },
    { id: 'blocks', label: 'Блоки замовлень', count: 'blocks' },
    { id: 'import', label: 'Виробництво: план і факт' },
    { id: 'mailing', label: 'Розсилки', count: 'mailing' },
    { id: 'journal', label: 'Журнал змін' }
  ];
  var counts = {};   // останні лічильники меню зліва (щоб не блимали між розділами)

  function plural(n, f) { var a = n % 10, b = n % 100; return f[a === 1 && b !== 11 ? 0 : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 1 : 2]; }
  function cnt(n, f) { return H.num(n) + ' ' + plural(n, f); }
  function inAudits(n) { return H.num(n) + ' ' + (n % 10 === 1 && n % 100 !== 11 ? 'аудиті' : 'аудитах'); }
  var W = { audit: ['аудит', 'аудити', 'аудитів'], order: ['замовлення', 'замовлення', 'замовлень'], rec: ['запис', 'записи', 'записів'],
    dept: ['відділ', 'відділи', 'відділів'], prod: ['виріб', 'вироби', 'виробів'], kind: ['вид браку', 'види браку', 'видів браку'], table: ['таблиця', 'таблиці', 'таблиць'] };
  function today() { return P.fmt.dayKey(new Date()); }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000); }
  function dateLong(iso) { var k = String(iso).length > 10 ? P.fmt.dayKey(iso) : iso; return new Date(Date.parse(k + 'T12:00:00Z')).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', timeZone: 'UTC' }); }
  function ago(iso) {
    if (!iso) return '—';
    var d = daysBetween(P.fmt.dayKey(iso), today());
    if (d <= 0) return 'сьогодні, ' + P.fmt.time(iso);
    if (d === 1) return 'учора, ' + P.fmt.time(iso);
    return d < 14 ? d + ' ' + plural(d, ['день', 'дні', 'днів']) + ' тому' : dateLong(iso);
  }
  function added(iso) { if (!iso) return ''; var d = daysBetween(P.fmt.dayKey(iso), today()); return d <= 0 ? 'додано сьогодні' : d === 1 ? 'додано вчора' : 'додано ' + dateLong(iso); }
  function da(k, v) { return ' data-' + k + '="' + esc(v) + '"'; }
  function q(el, sel) { return el.querySelector(sel); }
  function qa(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }

  function sw(on, act, data, label) {
    return '<button class="toggle mg-sw' + (on ? ' toggle--on' : '') + '" type="button" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="' + esc(label) +
      '" title="' + esc(label) + '" data-act="' + act + '"' + data + '></button>';
  }
  function ck(on, act, data, label) {
    return '<button class="check mg-ck' + (on ? ' check--on' : '') + '" type="button" role="checkbox" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="' + esc(label) + '" data-act="' + act + '"' + data + '>' +
      (on ? P.ic('check', 'ui-icon--sm') : '') + '</button>';
  }
  function pen(act, data, label) { return '<button class="icon-btn" type="button" data-act="' + act + '"' + data + ' aria-label="' + esc(label) + '" title="Редагувати">' + P.ic('edit') + '</button>'; }
  function more(act, data, label) { return '<button class="icon-btn mg-more" type="button" aria-haspopup="menu" data-act="' + act + '"' + data + ' aria-label="' + esc(label) + '" title="Дії">' + P.ic('more') + '</button>'; }
  function rowMenu(anchor, items, on) {
    var h = {};
    Object.keys(on).forEach(function (k) { h[k] = function (t, e, layer) { layer.close(); on[k](t); }; });
    return P.sr.menu(anchor, { width: 320, on: h, body: items.filter(Boolean).map(function (i) {
      if (i === 'sep') return '<div class="menu__sep"></div>';
      return '<button class="menu__item mg-mi' + (i.danger ? ' mg-mi--danger' : '') + '" type="button" role="menuitem" data-act="' + i.act + '">' +
        '<span class="menu__ic">' + P.ic(i.ic) + '</span><span><span class="menu__t">' + esc(i.title) + '</span>' + (i.sub ? '<span class="menu__s">' + esc(i.sub) + '</span>' : '') + '</span></button>';
    }).join('') });
  }
  function hq(key) { return key && P.help ? P.help.btn(key) : ''; }
  function head(title, sub, btn, help) { return '<div class="mg-head"><div><h2 class="h2">' + esc(title) + hq(help) + '</h2>' + (sub ? '<p class="h2-sub">' + esc(sub) + '</p>' : '') + '</div>' + (btn || '') + '</div>'; }
  function btnNew(label) { return '<button class="btn btn--primary" type="button" data-act="mg-new">' + P.ic('add') + esc(label) + '</button>'; }
  function banner(kind, title, text) {
    return '<div class="banner' + (kind ? ' banner--' + kind : '') + '">' + P.ic(kind === 'warn' ? 'warning' : 'info', 'icon') +
      '<div class="banner__body"><p class="banner__title">' + esc(title) + '</p>' + (text ? '<p class="banner__text">' + esc(text) + '</p>' : '') + '</div></div>';
  }
  function field(name, label, inner, hint, help) {
    var tail = (hint ? '<span class="hint">' + esc(hint) + '</span>' : '');
    if (help) return '<div class="field" data-f="' + name + '"><span class="label">' + esc(label) + hq(help) + '</span>' +
      inner.replace(/^<(input|select|textarea)\b/, '<$1 aria-label="' + esc(label) + '"') + tail + '</div>';
    return '<label class="field" data-f="' + name + '"><span class="label">' + esc(label) + '</span>' + inner + tail + '</label>';
  }
  function input(name, value, attrs) { return '<input class="input" name="' + name + '" value="' + esc(value == null ? '' : value) + '"' + (attrs || '') + '>'; }
  function locked(label, text) { return '<div class="field"><span class="label">' + esc(label) + '</span><span class="select" style="color:var(--text-2);cursor:default">' + esc(text) + P.ic('lock', 'icon icon--sm') + '</span></div>'; }
  function seg(name, opts, cur, act) {
    return '<div class="seg" role="radiogroup" data-f="' + name + '">' + opts.map(function (o) {
      return '<button class="seg__btn' + (o[0] === cur ? ' seg__btn--on' : '') + '" type="button" aria-pressed="' + (o[0] === cur) + '" data-act="' + (act || 'mg-seg') + '"' + da('k', name) + da('v', o[0]) + '>' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function levelOpts() { return ['fix', 'repair', 'scrap'].map(function (k) { return [k, H.lvl(k)]; }); }
  function val(el, name) { var i = q(el, '[name="' + name + '"]'); return i ? i.value : ''; }
  function modal(o, cls) {
    var mount = o.onMount;
    o.onMount = function (el, layer) { var m = q(el, '.modal'); m.className += ' mg-modal' + (cls ? ' ' + cls : ''); if (mount) mount(el, layer); };
    return P.sr.modal(o);
  }
  function cancelBtn() { return '<span style="flex:1"></span><button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button>'; }

  function showErrors(box, r) {
    qa(box, '.mg-err').forEach(function (e) { e.remove(); });
    qa(box, '.input--invalid').forEach(function (e) { e.classList.remove('input--invalid'); });
    if (!r || r.ok) return;
    if (r.code !== 'validation') { failToast(r); return; }
    var shown = 0;
    (r.errors || []).forEach(function (e) {
      var f = q(box, '[data-f="' + e.field + '"]'); if (!f) return;
      var i = f.matches('.input') ? f : q(f, '.input'); if (i) i.classList.add('input--invalid');
      f.insertAdjacentHTML('beforeend', '<p class="err mg-err" role="alert">' + esc(e.message) + '</p>');
      shown++;
    });
    if (!shown) P.toast('warn', 'Не збережено', r.error);
  }
  function failToast(r) { if (r && r.code !== 'forbidden') P.toast('danger', 'Не вдалося зберегти', (r && r.error) || ''); }
  function enterSubmits(el, act) {
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !e.target.matches('input.input') || e.target.hasAttribute('data-noenter')) return;
      e.preventDefault(); var b = q(el, '[data-act="' + act + '"]'); if (b && !b.disabled) b.click();
    });
  }
  function ask(o) {
    return modal({ size: 'sm', title: o.title, sub: o.sub ? esc(o.sub) : '',
      body: '<div class="mg-form">' + field(o.name, o.label, input(o.name, o.value, o.attrs), o.hint, o.help) + '</div>',
      foot: cancelBtn() + '<button class="btn btn--primary" type="button" data-act="mg-save">' + P.ic('save') + 'Зберегти</button>',
      onMount: function (el) { enterSubmits(el, 'mg-save'); var i = q(el, 'input.input'); if (i && i.select) i.select(); },
      on: { 'mg-save': function (t, e, layer) {
        t.disabled = true;
        o.save(val(layer.el, o.name)).then(function (r) {
          t.disabled = false;
          if (!r.ok) { showErrors(layer.el, r); return; }
          layer.close(); o.done(r);
        });
      } } });
  }

  function frame(ctx, sec) {
    ctx.el.innerHTML = '<div class="split mg-split"><nav class="side" aria-label="Керування локацією">' + SECTIONS.map(function (s) {
      return '<a href="#/manage/' + s.id + '"' + (s.id === sec ? ' class="on" aria-current="page"' : '') + '>' + esc(s.label) +
        (s.count ? '<span class="count" data-mg-count="' + s.count + '">' + (counts[s.count] != null ? counts[s.count] : '') + '</span>' : '') + '</a>';
    }).join('') + '</nav><div class="main-col" data-mg-col>' + H.loading() + '</div></div>';
    return q(ctx.el, '[data-mg-col]');
  }
  function setCounts(ctx, c) {
    if (!c) return; counts = c;
    qa(ctx.el, '[data-mg-count]').forEach(function (e) { var x = c[e.getAttribute('data-mg-count')]; e.textContent = x == null ? '' : x; });
  }
  function section(id, title, mount) {
    P.sr.screen('/manage/' + id, { tab: 'manage', title: 'Керування · ' + title, period: false, render: function (ctx) {
      var v = { ctx: ctx, col: frame(ctx, id), loc: ctx.loc.id, wantNew: ctx.query && ctx.query.new === '1' };
      if (v.wantNew && root.history && root.history.replaceState) root.history.replaceState(null, '', '#/manage/' + id);
      v.call = function (fn, p) { return P.srv(fn, Object.assign({ locationId: v.loc }, p || {})); };
      v.get = function (fn, draw) {
        v.call(fn).then(function (r) {
          if (!ctx.alive()) return;
          if (!r.ok) { v.col.innerHTML = H.error(r); return; }
          setCounts(ctx, r.counts); draw(r);
          if (v.wantNew && v.openNew) { v.wantNew = false; v.openNew(); }
        });
      };
      mount(v);
    } });
  }
  P.sr.screen('/manage', { tab: 'manage', title: 'Керування', period: false, render: function (ctx) { ctx.go('/manage/team'); } });

  P.srMg = { section: section, plural: plural, cnt: cnt, inAudits: inAudits, W: W, today: today, daysBetween: daysBetween, dateLong: dateLong, ago: ago, added: added,
    da: da, q: q, qa: qa, hq: hq, sw: sw, ck: ck, pen: pen, more: more, rowMenu: rowMenu, head: head, btnNew: btnNew, banner: banner, field: field, input: input,
    locked: locked, seg: seg, levelOpts: levelOpts, val: val, modal: modal, cancelBtn: cancelBtn, showErrors: showErrors, failToast: failToast,
    enterSubmits: enterSubmits, ask: ask, LV_SHORT: { fix: 'неправильно зроблене', repair: 'пошкоджене', scrap: 'зламане' } };
})(window);
