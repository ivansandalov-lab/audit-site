(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, f = P.fmt;

  function todayLabel() {
    return new Intl.DateTimeFormat('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv' }).format(new Date());
  }
  function draftOf(me, loc) {
    var d = P.store.get('draft:' + me.id + ':' + loc, null);
    return d && d.savedAt && Date.now() - d.savedAt < 24 * 3600 * 1000 ? d : null;
  }
  function minutesLeft(iso) { return iso ? Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 60000)) : 0; }
  function stat(v, label, help) { return '<div class="total"><span class="total__val">' + v + '</span><span class="total__label">' + label + (help ? P.help.btn(help) : '') + '</span></div>'; }
  function audits(n) { return n + ' ' + P.plural(n, 'аудит', 'аудити', 'аудитів'); }
  function queueBanners(me) {
    if (!P.offline) return '';
    var list = P.offline.list(me.id), wait = list.filter(function (x) { return !x.error; }), bad = list.filter(function (x) { return x.error; }), html = '';
    if (wait.length) {
      html += '<div class="ui-banner ui-banner--info q-banner">' + P.ic('clock') + '<div class="ui-banner__body"><p class="ui-banner__title">' + audits(wait.length) + ' ' +
        P.plural(wait.length, 'чекає', 'чекають', 'чекають') + ' звʼязку' + P.help.btn('w.queue.wait') + '</p><p class="ui-banner__text">Збережено на телефоні · надішлеться саме, щойно зʼявиться звʼязок.' +
        (P.offline.simulated() ? ' У профілі ввімкнено «Тест: ніби немає звʼязку».' : '') + '</p></div>' +
        '<div class="ui-banner__actions"><button class="ui-btn ui-btn--primary ui-btn--sm" type="button" data-act="q-send">' + P.ic('refresh') + 'Надіслати зараз</button></div></div>';
    }
    bad.forEach(function (x) {
      html += '<div class="ui-banner ui-banner--warn q-banner">' + P.ic('warning') + '<div class="ui-banner__body"><p class="ui-banner__title">Аудит не прийнято' + P.help.btn('w.queue.bad') + '</p>' +
        '<p class="ui-banner__text">' + esc(x.summary) + ' · збережено ' + f.time(new Date(x.savedAt)) + '. Причина: ' + esc(x.error) + '</p></div>' +
        '<div class="ui-banner__actions"><button class="ui-btn ui-btn--secondary ui-btn--sm" type="button" data-act="q-retry" data-id="' + esc(x.clientId) + '">' + P.ic('refresh') + 'Спробувати ще раз</button>' +
        '<button class="ui-btn ui-btn--quiet ui-btn--sm" type="button" data-act="q-drop" data-id="' + esc(x.clientId) + '">' + P.ic('delete') + 'Видалити</button></div></div>';
    });
    return html;
  }

  function view(r, ctx) {
    var draft = draftOf(ctx.me, ctx.loc), mine = r.myToday || [], checked = 0, rejected = 0;
    mine.forEach(function (a) { checked += a.checked || 0; rejected += a.rejected || 0; });
    var html = '<div class="stack">' + queueBanners(ctx.me);
    if (draft) {
      html += '<div class="ui-banner ui-banner--warn">' + P.ic('clock') + '<div class="ui-banner__body"><p class="ui-banner__title">Чернетка аудиту' + P.help.btn('w.draft') + '</p>' +
        '<p class="ui-banner__text">' + esc(draft.summary || 'Чернетка') + ' · ' + f.time(new Date(draft.savedAt)) + '</p></div>' +
        '<div class="ui-banner__actions"><button class="ui-btn ui-btn--primary ui-btn--sm" type="button" data-act="draft-go">Продовжити</button>' +
        '<button class="ui-btn ui-btn--quiet ui-btn--sm" type="button" data-act="draft-drop">Видалити</button></div></div>';
    }
    html += '<button class="ui-btn ui-btn--primary home-cta" type="button" data-act="new">' + P.ic('add') + 'Новий аудит</button>';
    html += '<section class="ui-card" aria-labelledby="h-mine"><div class="card-head"><h2 class="card-title" id="h-mine">Мої аудити сьогодні' + P.help.btn('w.home.mine') + '</h2></div>';
    if (!mine.length) return html + '<p class="card-sub">Тут зʼявляться аудити, які ви запишете сьогодні.</p></section></div>';
    html += '<div class="totals">' + stat(f.num(mine.length), 'аудити') + stat(f.num(checked), 'перевірено, шт', 'term.checked') +
      stat(f.num(rejected) + (checked ? ' · ' + f.pct(Math.round(rejected / checked * 1000) / 10) : ''), checked ? 'брак, шт · брак, %' : 'брак, шт', checked ? 'term.rate' : 'term.rejected') + '</div>';
    html += '<div class="mini-list">' + mine.map(function (a) {
      var left = minutesLeft(a.editableUntil);
      return '<button class="mini-item' + (left ? ' mini-item--edit' : '') + '" type="button" data-audit="' + esc(a.id) + '">' + P.ic('audit') +
        '<span class="mini-item__main"><span class="mini-item__title">' + f.time(a.createdAt) + ' · ' + esc(a.departmentName) +
          (a.locationId && a.locationId !== ctx.loc ? ' · ' + esc(a.locationName) : '') + '</span>' +   // аудит в іншій локації — з її назвою (v2.4)
        '<span class="mini-item__meta">перевірено ' + f.num(a.checked) + ' шт · брак ' + f.num(a.rejected) + ' шт (' + f.pct(a.pct) + ')</span></span>' +
        (left ? '<span class="ui-badge ui-badge--info">ще ' + left + ' хв, щоб виправити</span>' : P.ic('chevron-right')) + '</button>';
    }).join('') + '</div></section></div>';
    return html;
  }

  P.screen('/home', {
    title: function (ctx) { return { title: 'Добрий день, ' + ctx.me.name, sub: P.shell.locName(ctx.loc) + ' · ' + todayLabel() }; },
    render: function (ctx) {
      return P.srv('homeAuditor', { locationId: ctx.loc }).then(function (r) {
        if (!r.ok) return '<div class="stack">' + queueBanners(ctx.me) + P.state.error('Не вдалося завантажити головну', r.error) + '</div>';
        return view(r, ctx);
      });
    },
    mount: function (el, ctx) {
      P.delegate(el, 'click', '[data-act="retry"]', function () { P.shell.rerender(); });
      P.delegate(el, 'click', '[data-act="q-send"]', function (e, t) {
        if (P.offline.isOff()) return P.toast('warn', 'Звʼязку поки немає', 'Аудити надішлються самі, щойно він зʼявиться.');
        t.disabled = true;
        P.offline.flush(ctx.me.id).then(function (res) {
          P.offline.report(res);
          if (res.offline) P.toast('warn', 'Звʼязок зник', 'Не надіслані аудити лишились на телефоні.');
          else if (!res.sent && !res.failed) P.toast('warn', 'Поки не вдалося надіслати', 'Аудити лишились на телефоні — спробуйте трохи згодом.');
          if (ctx.alive()) P.shell.rerender();
        });
      });
      P.delegate(el, 'click', '[data-act="q-retry"]', function (e, t) {
        if (P.offline.isOff()) return P.toast('warn', 'Звʼязку поки немає', 'Аудит надішлеться сам, щойно він зʼявиться.');
        t.disabled = true;
        P.offline.mark(ctx.me.id, t.getAttribute('data-id'), null);
        P.offline.flush(ctx.me.id).then(function (res) { P.offline.report(res); if (ctx.alive()) P.shell.rerender(); });
      });
      P.delegate(el, 'click', '[data-act="q-drop"]', function (e, t) {
        var id = t.getAttribute('data-id');
        P.confirm({ title: 'Видалити аудит, який не прийнято?', text: 'Він зникне з телефона. Запишіть його знову, якщо потрібно.', okLabel: 'Видалити', danger: true }).then(function (ok) {
          if (!ok) return;
          P.offline.remove(ctx.me.id, id);
          P.toast('ok', 'Аудит видалено з телефона');
          if (ctx.alive()) P.shell.rerender();
        });
      });
      P.delegate(el, 'click', '[data-act="new"]', function () { P.router.go('/audit/new', { loc: ctx.loc }); });
      P.delegate(el, 'click', '[data-audit]', function (e, t) { P.router.go('/audit/' + t.getAttribute('data-audit')); });
      P.delegate(el, 'click', '[data-act="draft-go"]', function () { P.router.go('/audit/new', { loc: ctx.loc, draft: '1' }); });
      P.delegate(el, 'click', '[data-act="draft-drop"]', function () {
        P.confirm({ title: 'Видалити чернетку?', text: 'Усе, що ви вписали в цю чернетку, зникне.', okLabel: 'Видалити', danger: true }).then(function (ok) {
          if (ok && ctx.alive()) { P.store.del('draft:' + ctx.me.id + ':' + ctx.loc); P.shell.rerender(); }
        });
      });
    }
  });
})(window);
