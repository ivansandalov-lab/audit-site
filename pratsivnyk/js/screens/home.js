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
  function stat(v, label) { return '<div class="total"><span class="total__val">' + v + '</span><span class="total__label">' + label + '</span></div>'; }

  function view(r, ctx) {
    var draft = draftOf(ctx.me, ctx.loc), mine = r.myToday || [], checked = 0, rejected = 0;
    mine.forEach(function (a) { checked += a.checked || 0; rejected += a.rejected || 0; });
    var html = '<div class="stack">';
    if (draft) {
      html += '<div class="ui-banner ui-banner--warn">' + P.ic('clock') + '<div class="ui-banner__body"><p class="ui-banner__title">Чернетка аудиту</p>' +
        '<p class="ui-banner__text">' + esc(draft.summary || 'Чернетка') + ' · ' + f.time(new Date(draft.savedAt)) + '</p></div>' +
        '<div class="ui-banner__actions"><button class="ui-btn ui-btn--primary ui-btn--sm" type="button" data-act="draft-go">Продовжити</button>' +
        '<button class="ui-btn ui-btn--quiet ui-btn--sm" type="button" data-act="draft-drop">Видалити</button></div></div>';
    }
    html += '<button class="ui-btn ui-btn--primary home-cta" type="button" data-act="new">' + P.ic('add') + 'Новий аудит</button>';
    html += '<section class="ui-card" aria-labelledby="h-mine"><div class="card-head"><h2 class="card-title" id="h-mine">Мої аудити сьогодні</h2></div>';
    if (!mine.length) return html + '<p class="card-sub">Тут зʼявляться аудити, які ви запишете сьогодні.</p></section></div>';
    html += '<div class="totals">' + stat(f.num(mine.length), 'аудити') + stat(f.num(checked), 'перевірено, шт') +
      stat(f.num(rejected) + (checked ? ' · ' + f.pct(Math.round(rejected / checked * 1000) / 10) : ''), 'брак, шт') + '</div>';
    html += '<div class="mini-list">' + mine.map(function (a) {
      var left = minutesLeft(a.editableUntil);
      return '<button class="mini-item" type="button" data-audit="' + esc(a.id) + '">' + P.ic('audit') +
        '<span class="mini-item__main"><span class="mini-item__title">' + f.time(a.createdAt) + ' · ' + esc(a.departmentName) + '</span>' +
        '<span class="mini-item__meta">перевірено ' + f.num(a.checked) + ' · брак ' + f.num(a.rejected) + ' (' + f.pct(a.pct) + ')</span></span>' +
        (left ? '<span class="ui-badge ui-badge--info">ще ' + left + ' хв, щоб виправити</span>' : P.ic('chevron-right')) + '</button>';
    }).join('') + '</div></section></div>';
    return html;
  }

  P.screen('/home', {
    title: function (ctx) { return { title: 'Добрий день, ' + ctx.me.name, sub: P.shell.locName(ctx.loc) + ' · ' + todayLabel() }; },
    render: function (ctx) {
      return P.srv('homeAuditor', { locationId: ctx.loc }).then(function (r) {
        if (!r.ok) return P.state.error('Не вдалося завантажити головну', r.error);
        return view(r, ctx);
      });
    },
    mount: function (el, ctx) {
      P.delegate(el, 'click', '[data-act="retry"]', function () { P.shell.rerender(); });
      P.delegate(el, 'click', '[data-act="new"]', function () { P.router.go('/audit/new', { loc: ctx.loc }); });
      P.delegate(el, 'click', '[data-audit]', function (e, t) { P.router.go('/audit/' + t.getAttribute('data-audit')); });
      P.delegate(el, 'click', '[data-act="draft-go"]', function () { P.router.go('/audit/new', { loc: ctx.loc, draft: '1' }); });
      P.delegate(el, 'click', '[data-act="draft-drop"]', function () {
        P.confirm({ title: 'Видалити чернетку?', text: 'Незавершений аудит буде втрачено.', okLabel: 'Видалити', danger: true }).then(function (ok) {
          if (ok && ctx.alive()) { P.store.del('draft:' + ctx.me.id + ':' + ctx.loc); P.shell.rerender(); }
        });
      });
    }
  });
})(window);
