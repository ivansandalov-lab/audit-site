(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h;

  function plural(n, f) { var a = n % 10, b = n % 100; return f[a === 1 && b !== 11 ? 0 : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 1 : 2]; }
  function da(k, v) { return ' data-' + k + '="' + esc(v) + '"'; }
  function q(el, sel) { return el.querySelector(sel); }
  function qa(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000); }
  function ago(iso) {
    if (!iso) return '—';
    var d = daysBetween(P.fmt.dayKey(iso), P.fmt.dayKey(new Date()));
    if (d <= 0) return 'сьогодні, ' + P.fmt.time(iso);
    if (d === 1) return 'учора, ' + P.fmt.time(iso);
    if (d < 14) return d + ' ' + plural(d, ['день', 'дні', 'днів']) + ' тому';
    return new Date(Date.parse(P.fmt.dayKey(iso) + 'T12:00:00Z')).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  }
  function sw(on, act, data, label) {
    return '<button class="toggle adm-sw' + (on ? ' toggle--on' : '') + '" type="button" role="switch" aria-checked="' + (on ? 'true' : 'false') +
      '" aria-label="' + esc(label) + '" title="' + esc(label) + '" data-act="' + act + '"' + data + '></button>';
  }
  function pen(act, data, label) { return '<button class="icon-btn" type="button" data-act="' + act + '"' + data + ' aria-label="' + esc(label) + '" title="Редагувати">' + P.ic('edit') + '</button>'; }
  function more(act, data, label) { return '<button class="icon-btn" type="button" aria-haspopup="menu" data-act="' + act + '"' + data + ' aria-label="' + esc(label) + '" title="Дії">' + P.ic('more') + '</button>'; }
  function rowMenu(anchor, items, on) {
    var h = {};
    Object.keys(on).forEach(function (k) { h[k] = function (t, e, layer) { layer.close(); on[k](anchor); }; });
    return P.sr.menu(anchor, { width: 320, on: h, body: items.filter(Boolean).map(function (i) {
      return '<button class="menu__item adm-mi" type="button" role="menuitem" data-act="' + i.act + '"><span class="menu__ic">' + P.ic(i.ic) + '</span>' +
        '<span><span class="menu__t">' + esc(i.title) + '</span>' + (i.sub ? '<span class="menu__s">' + esc(i.sub) + '</span>' : '') + '</span></button>';
    }).join('') });
  }
  function help(key) { return key && P.help ? P.help.btn(key) : ''; }
  function head(title, sub, btn, key) { return '<div class="adm-head"><div><h2 class="h2">' + esc(title) + help(key) + '</h2>' + (sub ? '<p class="h2-sub">' + esc(sub) + '</p>' : '') + '</div>' + (btn || '') + '</div>'; }
  function kpi(val, label, key) { return '<div class="kpi"><span class="kpi__val">' + esc(val) + '</span><span class="kpi__label">' + esc(label) + help(key) + '</span></div>'; }
  function btnNew(act, label) { return '<button class="btn btn--primary" type="button" data-act="' + act + '">' + P.ic('add') + esc(label) + '</button>'; }
  function field(name, label, inner, hint, key) { return '<label class="field" data-f="' + name + '"><span class="label">' + esc(label) + help(key) + '</span>' + inner + (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + '</label>'; }
  function input(name, value, attrs) { return '<input class="input" name="' + name + '" value="' + esc(value == null ? '' : value) + '"' + (attrs || '') + '>'; }
  function seg(name, opts, cur) {
    return '<div class="seg" role="radiogroup" data-f="' + name + '">' + opts.map(function (o) {
      return '<button class="seg__btn' + (o[0] === cur ? ' seg__btn--on' : '') + '" type="button" aria-pressed="' + (o[0] === cur) + '" data-act="adm-seg"' + da('k', name) + da('v', o[0]) + '>' + esc(o[1]) + '</button>';
    }).join('') + '</div>';
  }
  function segPick(layer, t) {
    qa(layer.el, '[data-k="' + t.getAttribute('data-k') + '"]').forEach(function (b) { b.classList.toggle('seg__btn--on', b === t); b.setAttribute('aria-pressed', b === t ? 'true' : 'false'); });
    return t.getAttribute('data-v');
  }
  function val(el, name) { var i = q(el, '[name="' + name + '"]'); return i ? i.value : ''; }
  function modal(o) {
    var mount = o.onMount;
    o.onMount = function (el, layer) { q(el, '.modal').className += ' adm-modal'; if (mount) mount(el, layer); };
    return P.sr.modal(o);
  }
  function cancelBtn() { return '<span style="flex:1"></span><button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button>'; }
  function saveBtn(label, ic) { return '<button class="btn btn--primary" type="button" data-act="adm-save">' + P.ic(ic || 'save') + esc(label || 'Зберегти') + '</button>'; }
  function failToast(r) { if (r && r.code !== 'forbidden') P.toast('danger', 'Не вдалося зберегти', (r && r.error) || ''); }
  function showErrors(box, r) {
    qa(box, '.adm-err').forEach(function (e) { e.remove(); });
    qa(box, '.input--invalid').forEach(function (e) { e.classList.remove('input--invalid'); });
    if (!r || r.ok) return;
    if (r.code !== 'validation') { failToast(r); return; }
    var shown = 0;
    (r.errors || []).forEach(function (e) {
      var f = q(box, '[data-f="' + e.field + '"]'); if (!f) return;
      var i = f.matches('.input') ? f : q(f, '.input'); if (i) i.classList.add('input--invalid');
      f.insertAdjacentHTML('beforeend', '<p class="err adm-err" role="alert">' + esc(e.message) + '</p>');
      shown++;
    });
    if (!shown) P.toast('warn', 'Не збережено', r.error);
  }
  function enterSubmits(el) {
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !e.target.matches('input.input')) return;
      e.preventDefault(); var b = q(el, '[data-act="adm-save"]'); if (b && !b.disabled) b.click();
    });
  }
  function asOf() { return 'станом на ' + P.fmt.time(new Date().toISOString()); }
  P.adm = { plural: plural, da: da, q: q, qa: qa, ago: ago, sw: sw, pen: pen, more: more, rowMenu: rowMenu, head: head, btnNew: btnNew, help: help, kpi: kpi,
    field: field, input: input, seg: seg, segPick: segPick, val: val, modal: modal, cancelBtn: cancelBtn, saveBtn: saveBtn,
    failToast: failToast, showErrors: showErrors, enterSubmits: enterSubmits, asOf: asOf };

  function hh(n) { return (n < 10 ? '0' : '') + n + ':00'; }
  function remText(r) { return r && r.on ? 'з ' + hh(r.from) + ' до ' + hh(r.to) + ', кожні ' + r.every + ' год' : 'вимкнено'; }
  function hours(name, from, to, cur) {
    var o = ''; for (var h = from; h <= to; h++) o += '<option value="' + h + '"' + (h === cur ? ' selected' : '') + '>' + hh(h) + '</option>';
    return '<select class="input" name="' + name + '">' + o + '</select>';
  }

  function tile(l) {
    var t = l.today, off = !l.active;
    return '<article class="dtile cab-loc adm-loc' + (off ? ' adm-loc--off' : '') + '">' +
      '<div class="adm-loc__top"><span class="dtile__name">' + P.ic('location', 'ui-icon--sm') + esc(l.name) + '</span>' +
        '<span class="adm-loc__acts">' + pen('loc-edit', da('id', l.id), 'Редагувати · ' + l.name) + more('loc-more', da('id', l.id), 'Дії · ' + l.name) + '</span></div>' +
      (off ? '<span class="adm-loc__off"><span class="badge adm-badge-off">' + P.ic('power', 'ui-icon--sm') + 'вимкнена</span>' + help('admin.loc.off') + '</span>' : '') +
      '<span class="dtile__meta">' + H.num(l.departments) + ' ' + plural(l.departments, ['відділ', 'відділи', 'відділів']) + ' · ' +
        H.num(l.workers) + ' ' + plural(l.workers, ['працівник', 'працівники', 'працівників']) + '</span>' +
      '<div class="adm-loc__set"><p>' + P.ic('slack', 'ui-icon--sm') + '<span><span class="adm-dim">Slack-канал:</span> ' + (l.slackChannel ? esc(l.slackChannel) : 'не задано') + help('admin.loc.slack') + '</span></p>' +
        '<p>' + P.ic('clock', 'ui-icon--sm') + '<span><span class="adm-dim">Нагадування:</span> ' + esc(remText(l.reminders)) + help('admin.loc.remind') + '</span></p></div>' +
      '<div class="dtile__nums"><div><b>' + H.num(t.audits) + '</b><span>' + plural(t.audits, ['аудит', 'аудити', 'аудитів']) + ' сьогодні</span></div>' +
        '<div>' + (t.audits ? '<b>' + H.num(t.rejected) + ' шт</b> · ' + H.pct(t.pct) : '<b>—</b>') + '<span>брак, шт · брак, %' + help('admin.loc.today') + '</span></div></div>' +
      '<div class="cab-loc__btns">' +
        '<button class="btn btn--secondary btn--sm" type="button" data-act="open-as" data-role="senior_auditor"' + da('loc', l.id) + '>' + P.ic('chart', 'ui-icon--sm') + 'Відкрити як старший</button>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-act="open-as" data-role="auditor"' + da('loc', l.id) + '>' + P.ic('audit', 'ui-icon--sm') + 'Відкрити як працівник</button>' + help('admin.loc.openAs') + '</div>' +
      '</article>';
  }

  P.cab.tab({ id: 'locations', label: 'Локації', ic: 'location', path: '/locations', order: 10 });
  P.cab.screen('/locations', { tab: 'locations', title: 'Локації', render: function (ctx) {
    var data = null;
    function find(id) { return data.locations.filter(function (l) { return l.id === id; })[0]; }
    function load() {
      P.srv('adminOverview', {}).then(function (r) {
        if (!ctx.alive()) return;
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        data = r;
        var on = r.locations.filter(function (l) { return l.active; }).length;
        ctx.el.innerHTML = '<section class="adm-col">' +
          head('Локації · ' + r.locations.length, (on < r.locations.length ? on + ' увімкнено · ' : '') + 'числа за сьогодні, ' + asOf() + '. Відкрийте будь-яку так, як її бачить старший або працівник.', btnNew('loc-new', 'Нова локація')) +
          (r.locations.length ? '<div class="cab-locs">' + r.locations.map(tile).join('') + '</div>' : H.empty('Локацій ще немає', 'Додайте першу кнопкою «Нова локація».')) + '</section>';
      });
    }
    function openEdit(l, part) {
      var all = !part, rem = (l && l.reminders) || { on: false, from: 8, to: 17, every: 2 }, st = { on: rem.on };
      var titles = { name: 'Перейменувати локацію', channel: 'Slack-канал локації', remind: 'Нагадування «запишіть аудит»' };
      var body = '<div class="adm-form">' +
        (all || part === 'name' ? field('name', 'Назва', input('name', l ? l.name : '', ' autocomplete="off" maxlength="40" placeholder="Цех Г"')) : '') +
        (all || part === 'channel' ? field('slackChannel', 'Slack-канал', input('slackChannel', l ? l.slackChannel : '', ' autocomplete="off" maxlength="80" placeholder="#якість-цех-г"'),
          'Назва каналу, як її видно в Slack. Порожнє поле — без каналу.', 'admin.loc.slack') : '') +
        (all || part === 'remind' ? '<div class="field" data-f="remOn"><span class="label">' + (all ? 'Нагадування «запишіть аудит»' : 'Нагадування') + help('admin.loc.remind') + '</span>' + seg('remOn', [['true', 'Увімкнено'], ['false', 'Вимкнено']], String(st.on)) + '</div>' +
          '<div class="adm-rem" data-rem' + (st.on ? '' : ' hidden') + '>' + field('remFrom', 'З', hours('remFrom', 0, 23, rem.from)) + field('remTo', 'До', hours('remTo', 1, 24, rem.to)) +
            field('remEvery', 'Кожні', '<select class="input" name="remEvery">' + [1, 2, 3, 4, 6, 8, 12].map(function (n) { return '<option value="' + n + '"' + (n === rem.every ? ' selected' : '') + '>' + n + ' год</option>'; }).join('') + '</select>') + '</div>' : '') +
        '</div>';
      modal({ size: 'sm', title: !l ? 'Нова локація' : all ? 'Редагувати локацію' : titles[part], sub: l ? esc(l.name) : '', body: body,
        foot: cancelBtn() + saveBtn(l ? 'Зберегти' : 'Додати локацію', l ? 'save' : 'add'),
        onMount: function (el) { enterSubmits(el); },
        on: {
          'adm-seg': function (t, e, layer) { st.on = segPick(layer, t) === 'true'; q(layer.el, '[data-rem]').hidden = !st.on; },
          'adm-save': function (t, e, layer) {
            var p = l ? { id: l.id } : {}, el = layer.el;
            if (all || part === 'name') p.name = val(el, 'name');
            if (all || part === 'channel') p.slackChannel = val(el, 'slackChannel');
            if ((all || part === 'remind') && (l || st.on)) p.reminders = { on: st.on, from: +val(el, 'remFrom'), to: +val(el, 'remTo'), every: +val(el, 'remEvery') };
            t.disabled = true;
            P.srv('adminLocationSave', p).then(function (r) {
              t.disabled = false;
              if (!r.ok) { showErrors(el, r); return; }
              layer.close();
              P.toast('ok', (r.created ? 'Локацію додано · ' : 'Збережено · ') + r.name, part === 'remind' ? 'Нагадування: ' + remText(p.reminders) + '.' : '');
              if (ctx.alive()) load();
            });
          }
        } });
    }
    function toggle(l) {
      function go() {
        P.srv('adminLocationSave', { id: l.id, active: !l.active }).then(function (r) {
          if (!r.ok) { failToast(r); return; }
          P.toast('ok', (r.active ? 'Локацію увімкнено · ' : 'Локацію вимкнено · ') + r.name, r.active ? '' : 'Аудити й налаштування лишились.');
          if (ctx.alive()) load();
        });
      }
      if (!l.active) { go(); return; }
      P.confirm({ title: 'Вимкнути локацію · ' + l.name + '?', text: 'Локація лишиться в списку сірою. Аудити, люди й налаштування зберігаються; увімкнути можна будь-коли.', okLabel: 'Вимкнути', danger: true })
        .then(function (ok) { if (ok) go(); });
    }
    ctx.on('loc-new', function () { openEdit(null, null); });
    ctx.on('loc-edit', function (t) { openEdit(find(t.getAttribute('data-id')), null); });
    ctx.on('loc-more', function (t) {
      var l = find(t.getAttribute('data-id'));
      rowMenu(t, [
        { act: 'm-name', ic: 'edit', title: 'Перейменувати' },
        { act: 'm-channel', ic: 'slack', title: 'Slack-канал', sub: l.slackChannel || 'не задано' },
        { act: 'm-remind', ic: 'clock', title: 'Нагадування «запишіть аудит»', sub: remText(l.reminders) },
        { act: 'm-toggle', ic: 'power', title: l.active ? 'Вимкнути локацію' : 'Увімкнути локацію' }
      ], { 'm-name': function () { openEdit(l, 'name'); }, 'm-channel': function () { openEdit(l, 'channel'); },
        'm-remind': function () { openEdit(l, 'remind'); }, 'm-toggle': function () { toggle(l); } });
    });
    ctx.on('open-as', function (t) {
      t.disabled = true;
      P.profileSwitch.open(t.getAttribute('data-role'), t.getAttribute('data-loc')).then(function (ok) { if (!ok) t.disabled = false; });
    });
    load();
  } });
})(window);
