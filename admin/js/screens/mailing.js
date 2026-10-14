(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h;
  var filter = 'all';   // фільтр за локацією — памʼятається, поки відкрита сторінка

  function da(k, v) { return ' data-' + k + '="' + esc(v) + '"'; }
  function forLoc(r, id) { return id === 'all' || r.locations === 'all' || r.locations.indexOf(id) >= 0; }

  function card(r, links) {
    var off = !r.enabled;
    return '<article class="card rz-card' + (off ? ' rz-card--off' : '') + '"><div class="card-head"><h3 class="card-title">' + esc(r.title) +
      (off ? ' <span class="badge">вимкнено</span>' : '') + '</h3>' +
      '<button class="toggle' + (off ? '' : ' toggle--on') + '" type="button" role="switch" aria-checked="' + !off + '" aria-label="' + (off ? 'Вимкнено' : 'Увімкнено') + ' · ' + esc(r.title) + '" data-act="rz-on"' + da('id', r.id) + '></button>' +
      '<button class="icon-btn" type="button" data-act="rz-edit"' + da('id', r.id) + ' aria-label="Редагувати · ' + esc(r.title) + '" title="Редагувати">' + P.ic('edit') + '</button>' +
      '<button class="icon-btn" type="button" aria-haspopup="menu" data-act="rz-more"' + da('id', r.id) + ' aria-label="Дії · ' + esc(r.title) + '" title="Дії">' + P.ic('more') + '</button></div>' +
      '<dl class="kv rz-kv"><dt>Кому</dt><dd>' + r.toLabels.map(function (t) { return esc(t.label); }).join(' · ') + '</dd>' +
      '<dt>Коли</dt><dd>' + esc(r.whenLabel) + '</dd><dt>Умова</dt><dd>' + esc(r.condLabel) + '</dd><dt>Локації</dt><dd>' + esc(r.locLabel) + '</dd></dl>' +
      '<div class="rz-tpl"><div class="rz-tpl__in">' + P.mlPreview.slackHtml(r.template, links) + '</div></div></article>';
  }

  function menu(anchor, items, on) {
    var h = {};
    Object.keys(on).forEach(function (k) { h[k] = function (t, e, layer) { layer.close(); on[k](t); }; });
    return P.sr.menu(anchor, { width: 340, on: h, body: items.map(function (i) {
      return '<button class="menu__item rz-mi' + (i.danger ? ' rz-mi--danger' : '') + '" type="button" role="menuitem" data-act="' + i.act + '"' + (i.key ? da('key', i.key) : '') + '>' +
        '<span class="menu__ic">' + P.ic(i.ic) + '</span><span><span class="menu__t">' + esc(i.title) + '</span>' + (i.sub ? '<span class="menu__s">' + esc(i.sub) + '</span>' : '') + '</span></button>';
    }).join('') });
  }

  P.cab.tab({ id: 'mailing', label: 'Розсилки', ic: 'notification', path: '/mailing', order: 40 });
  P.cab.screen('/mailing', { tab: 'mailing', title: 'Розсилки', render: function (ctx) {
    var data = null, open = !(P.mailProbe && P.mailProbe.has());
    ctx.el.innerHTML = '<div class="rz"><div class="rz" data-rz-list>' + H.loading() + '</div>' +
      '<details class="rz-probe"' + (open ? ' open' : '') + '><summary class="rz-probe__sum">' + P.ic('settings', 'ui-icon--sm') + 'Тестовий канал і стан проби</summary>' +
      '<section id="cab-mail" aria-label="Розсилка в Slack"></section></details></div>';
    var list = ctx.el.querySelector('[data-rz-list]');
    P.mailPanel.mount(ctx.el.querySelector('#cab-mail'));

    function find(id) { return data.items.filter(function (x) { return x.id === id; })[0]; }
    function load() {
      P.srv('mlRules', {}).then(function (r) {
        if (!ctx.alive()) return;
        if (!r.ok) { list.innerHTML = H.error(r); return; }
        data = r; draw();
      });
    }
    function draw() {
      if (filter !== 'all' && !data.locations.some(function (l) { return l.id === filter; })) filter = 'all';
      var shown = data.items.filter(function (r) { return forLoc(r, filter); }), loc = data.locations.filter(function (l) { return l.id === filter; })[0];
      var body;
      if (!data.items.length) body = P.state.empty('notification', 'Ще жодної розсилки', 'Створіть першу — порожню або з готового шаблону.',
        '<button class="btn btn--primary" type="button" data-act="rz-new">' + P.ic('add') + 'Нова розсилка</button>');
      else if (!shown.length) body = P.state.empty('filter', 'Для «' + loc.name + '» розсилок немає', 'Розсилки на «усі локації» показуються в кожній.');
      else body = '<div class="rz-list">' + shown.map(function (r) { return card(r, data.options.links); }).join('') + '</div>';
      list.innerHTML = '<div class="rz-head"><div><h2 class="h2">Розсилки · ' + data.items.length + '</h2>' +
        '<p class="h2-sub">Повідомлення в Slack для будь-яких локацій · станом на ' + esc(P.fmt.time(data.now)) + '</p></div>' +
        '<button class="btn btn--primary" type="button" data-act="rz-new">' + P.ic('add') + 'Нова розсилка</button></div>' +
        '<p class="hint rz-note">' + P.ic('info', 'ui-icon--sm') + '<span>Тут налаштування на вигаданих даних. За цими правилами розсилки потім надсилатиме будильник Supabase; зараз у Slack іде лише «Надіслати пробне».</span></p>' +
        '<label class="field rz-filter"><span class="label">Локація</span><select class="input rz-sel" data-change="rz-filter">' +
          [['all', 'Усі локації · ' + data.items.length]].concat(data.locations.map(function (l) {
            return [l.id, l.name + ' · ' + data.items.filter(function (r) { return forLoc(r, l.id); }).length]; })).map(function (o) {
            return '<option value="' + esc(o[0]) + '"' + (o[0] === filter ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>' + body;
    }
    function edit(id, rule) { P.mlEditor.open({ data: data, id: id, rule: rule, onSaved: function () { if (ctx.alive()) load(); } }); }

    ctx.on('rz-filter', function (t) { filter = t.value; draw(); });
    ctx.on('rz-new', function (t) {
      if (!data) return;
      var items = [{ act: 'rz-tpl', key: '', ic: 'add', title: 'Порожня', sub: 'усе з нуля' }].concat(data.presets.map(function (x) {
        return { act: 'rz-tpl', key: x.key, ic: 'notification', title: x.title, sub: x.whenLabel }; }));
      menu(t, items, { 'rz-tpl': function (b) {
        var key = b.getAttribute('data-key'), p = data.presets.filter(function (x) { return x.key === key; })[0];
        edit(null, p ? p.rule : { locations: filter === 'all' ? 'all' : [filter], when: { kind: 'daily' }, condition: { kind: 'always' } });
      } });
    });
    ctx.on('rz-edit', function (t) { var r = find(t.getAttribute('data-id')); if (r) edit(r.id, r); });
    ctx.on('rz-on', function (t) {
      var r = find(t.getAttribute('data-id')); if (!r) return;
      t.disabled = true;
      P.srv('mlRuleOn', { id: r.id, enabled: !r.enabled }).then(function (x) {
        if (!ctx.alive()) return;
        if (!x.ok) { t.disabled = false; if (x.code !== 'forbidden') P.toast('danger', 'Не вдалося зберегти', x.error); return; }
        P.toast('ok', (x.enabled ? 'Увімкнено · ' : 'Вимкнено · ') + x.title); load();
      });
    });
    ctx.on('rz-more', function (t) {
      var r = find(t.getAttribute('data-id')); if (!r) return;
      menu(t, [{ act: 'rz-copy', ic: 'add', title: 'Дублювати', sub: 'копія зʼявиться вимкненою — поруч' },
        { act: 'rz-del', ic: 'delete', title: 'Видалити', sub: 'назавжди', danger: true }], {
        'rz-copy': function () {
          P.srv('mlRuleCopy', { id: r.id }).then(function (x) {
            if (!ctx.alive()) return;
            if (!x.ok) { P.toast('danger', 'Не вдалося', x.error); return; }
            P.toast('ok', 'Створено копію · ' + x.item.title, 'Вона вимкнена — увімкніть, коли налаштуєте.'); load();
          });
        },
        'rz-del': function () {
          P.confirm({ title: 'Видалити розсилку?', text: '«' + r.title + '» зникне назавжди. Щоб лише призупинити — вимкніть її вмикачем.', okLabel: 'Видалити', danger: true })
            .then(function (ok) {
              if (!ok) return;
              P.srv('mlRuleDelete', { id: r.id }).then(function (x) {
                if (!ctx.alive()) return;
                if (!x.ok) { P.toast('danger', 'Не вдалося видалити', x.error); return; }
                P.toast('ok', 'Видалено · ' + x.title); load();
              });
            });
        }
      });
    });
    load();
  } });
})(window);
