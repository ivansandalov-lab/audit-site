(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, M = P.srMg;
  var q = M.q, da = M.da;
  var MAX = 10;   // стільки можна обʼєднати за раз в один (те саме обмеження на сервері)

  M.openMerge = function (v, o) {
    var isP = o.kind === 'products', word = isP ? M.W.prod : M.W.kind;
    var by = {}; o.items.forEach(function (x) { by[x.id] = x; });
    var st = { src: (o.src || []).filter(function (id) { return by[id]; }).slice(0, MAX), dst: o.dst && by[o.dst] ? o.dst : null,
      q: { src: '', dst: '' }, level: null, levelTouched: false, pv: null, key: '', state: 'idle', error: '' };
    var seq = 0, layer;
    if (st.src.length) st.src = st.src.filter(function (id) { return by[id].type === by[st.src[0]].type; });

    function lock() { var id = st.dst || st.src[0]; return id ? by[id].type : null; }
    function pool(side) {
      var t = lock(), s = st.q[side].trim().toLowerCase();
      return o.items.filter(function (x) { return (!t || x.type === t) && (!s || x.name.toLowerCase().indexOf(s) >= 0); });
    }
    function chip(x, side) {
      return '<span class="chip' + (side === 'src' ? ' chip--plain mg-chip-src' : ' mg-chip-dst') + '"><span class="mg-chip__t">' + esc(x.name) + '</span><button class="chip__x" type="button" data-act="mg-drop"' + da('side', side) + da('id', x.id) +
        ' aria-label="Прибрати ' + esc(x.name) + '">' + P.ic('close', 'ui-icon--sm') + '</button></span>';
    }
    function chips(side) {
      if (side === 'src') return st.src.length ? st.src.map(function (id) { return chip(by[id], 'src'); }).join('') : '<span class="mg-mrg__empty">нічого не обрано</span>';
      return st.dst ? chip(by[st.dst], 'dst') : '<span class="mg-mrg__empty">нічого не обрано</span>';
    }
    function list(side) {
      var items = pool(side), full = side === 'src' && st.src.length >= MAX;
      if (!items.length) return '<p class="hint mg-mrg__none">' + (st.q[side].trim() ? 'Не знайдено: «' + esc(st.q[side].trim()) + '»' : 'Список порожній') + '</p>';
      return items.map(function (x) {
        var on = side === 'src' ? st.src.indexOf(x.id) >= 0 : st.dst === x.id;
        var other = side === 'src' ? st.dst === x.id : st.src.indexOf(x.id) >= 0;
        var off = other || (full && !on);
        return '<button class="mg-pick' + (on ? ' mg-pick--on' : '') + (off ? ' mg-pick--off' : '') + '" type="button" role="option" aria-selected="' + on + '"' + (off ? ' disabled' : '') +
          ' data-act="mg-pick"' + da('side', side) + da('id', x.id) + '><span class="check' + (side === 'dst' ? ' mg-radio' : '') + (on ? ' check--on' : '') + '">' +
          (on ? (side === 'dst' ? '<i></i>' : P.ic('check', 'ui-icon--sm')) : '') + '</span><span class="opt__main"><span class="opt__title">' + esc(x.name) + '</span>' +
          '<span class="opt__meta">' + x.meta + '</span></span>' + (other ? '<span class="mg-pick__note">' + (side === 'src' ? 'стоїть праворуч' : 'стоїть ліворуч') + '</span>' : '') + '</button>';
      }).join('');
    }
    function scope() {
      var t = lock(), x = t && o.items.filter(function (y) { return y.type === t; })[0];
      if (isP) return '';
      return x ? H.badge('лише відділ: ' + x.typeName, 'brand') + '<span class="hint">обʼєднуються види одного типу відділу</span>'
        : H.badge('усі відділи') + '<span class="hint">після першого вибору списки звузяться до його відділу</span>';
    }
    function col(side) {
      var src = side === 'src';
      return '<section class="mg-mrg__col mg-mrg__col--' + side + '"><div class="mg-mrg__head"><div><h3 class="mg-mrg__title">' + (src ? 'Що обʼєднуємо' : 'У що') + '</h3>' +
        '<p class="hint">' + (src ? 'зникнуть зі списків' : 'лишиться в списках') + '</p></div><span class="mg-mrg__count" data-mg-count="' + side + '"></span></div>' +
        '<div class="chips mg-mrg__chips" data-mg-chips="' + side + '" aria-live="polite"></div>' +
        '<div class="search">' + P.ic('search', 'icon') + '<input class="input" data-mg-q="' + side + '" data-noenter autocomplete="off" placeholder="' + (isP ? 'Пошук виробу' : 'Пошук виду браку') +
        '" aria-label="' + (src ? 'Пошук у «Що обʼєднуємо»' : 'Пошук в «У що»') + '" style="padding-left:46px"></div>' +
        '<div class="mg-mrg__list" role="listbox" aria-multiselectable="' + src + '" data-mg-list="' + side + '"></div></section>';
    }
    function summary() {
      var n = st.src.length + (st.dst ? 1 : 0), keep = st.dst ? by[st.dst].name : '';
      var flow = '<b class="mg-mrg__big">' + (st.src.length ? M.cnt(n, word) : '…') + ' → ' + (st.dst ? '1' : '…') + '</b>';
      if (st.state === 'idle') return '<div class="mg-mrg__fact">' + flow + '<span class="hint">Числа — після вибору з обох боків.</span></div>';
      if (st.state === 'load') return '<div class="mg-mrg__fact">' + flow + '<span class="hint">Рахуємо…</span></div>';
      if (st.state === 'error') return '<div class="mg-mrg__fact">' + flow + '<span class="mg-mrg__err">' + esc(st.error) + '</span><button class="btn btn--secondary btn--sm" type="button" data-act="mg-again">Спробувати ще раз</button></div>';
      var r = st.pv, gone = r.items.filter(function (x) { return x.id !== st.dst; }).map(function (x) { return '«' + x.name + '»'; }).join(', ');
      var moved = isP ? 'На «' + esc(keep) + '» перейдуть ' + M.cnt(r.moving.audits, M.W.audit) + ' і ' + M.cnt(r.moving.orders, M.W.order) + ' — з усіх цехів.'
        : 'На «' + esc(keep) + '» ' + M.plural(r.moving.records, ['перейде', 'перейдуть', 'перейдуть']) + ' ' + M.cnt(r.moving.records, M.W.rec) + ' браку у ' + M.inAudits(r.moving.audits) + ' — з усіх цехів.';
      var after = isP ? 'у ' + M.inAudits(r.after.audits) : M.cnt(r.after.records, M.W.rec) + ' у ' + M.inAudits(r.after.audits);
      return '<div class="mg-mrg__fact">' + flow + '<span>' + moved + '</span></div>' +
        '<p class="hint">Після обʼєднання «' + esc(keep) + '» — ' + after + '. Зі списків ' + (st.src.length > 1 ? 'зникнуть' : 'зникне') + ': ' + esc(gone) + '.</p>' +
        (isP ? '' : r.levelsDiffer
          ? '<div class="field"><span class="label">Рівень після обʼєднання — в обраних він різний</span><div class="seg seg--sm" role="radiogroup" aria-label="Рівень">' + ['fix', 'repair', 'scrap'].map(function (k) {
            return '<button class="seg__btn' + (k === st.level ? ' seg__btn--on' : '') + '" type="button" aria-pressed="' + (k === st.level) + '" data-act="mg-mlevel"' + da('v', k) + '>' + (k === st.level ? H.lvl(k) : esc(P.sr.LEVELS[k])) + '</button>'; }).join('') + '</div></div>'
          : '<p class="hint">Рівень: ' + H.lvl(r.keepLevel) + ' — в усіх обраних однаковий.</p>') +
        '<p class="hint">Список спільний для всіх цехів. Скасувати обʼєднання в тестовій версії можна лише кнопкою «Скинути тестові дані» в меню профілю.</p>';
    }
    function paint() {
      ['src', 'dst'].forEach(function (side) {
        q(layer.el, '[data-mg-chips="' + side + '"]').innerHTML = chips(side);
        q(layer.el, '[data-mg-list="' + side + '"]').innerHTML = list(side);
      });
      q(layer.el, '[data-mg-count="src"]').textContent = st.src.length + ' з ' + MAX;
      q(layer.el, '[data-mg-count="dst"]').textContent = (st.dst ? 1 : 0) + ' з 1';
      q(layer.el, '[data-mg-scope]').innerHTML = scope();
      q(layer.el, '[data-mg-sum]').innerHTML = summary();
      var swap = q(layer.el, '[data-act="mg-swap"]'), go = q(layer.el, '[data-act="mg-go"]');
      swap.disabled = st.src.length > 1 || (!st.src.length && !st.dst);
      go.disabled = st.state !== 'ready';
    }
    function refresh() {
      var key = st.dst && st.src.length ? st.dst + '|' + st.src.join(',') : '';
      if (key === st.key && st.state !== 'error') { paint(); return; }
      st.key = key; st.pv = null; var my = ++seq;
      if (!key) { st.state = 'idle'; paint(); return; }
      st.state = 'load'; paint();
      v.call('srMgMergePreview', { kind: o.kind, keepId: st.dst, ids: st.src }).then(function (r) {
        if (layer.closed || my !== seq) return;
        if (!r.ok) { st.state = 'error'; st.error = r.error || 'Не вдалося порахувати.'; paint(); return; }
        st.pv = r; st.state = 'ready';
        if (!isP && !st.levelTouched) st.level = r.keepLevel;
        paint();
      });
    }
    function focusSearch(side) { var i = q(layer.el, '[data-mg-q="' + side + '"]'); if (i) i.focus({ preventScroll: true }); }

    layer = M.modal({ title: isP ? 'Обʼєднати вироби' : 'Обʼєднати види браку', sub: (o.scope ? esc(o.scope) : '') + M.hq('sr.mg.merge'),
      body: '<div class="mg-mrg__scope" data-mg-scope></div>' +
        '<div class="mg-mrg">' + col('src') +
        '<div class="mg-mrg__mid"><span class="mg-mrg__arrow" aria-hidden="true">' + P.ic('arrow-right') + '</span>' +
        '<button class="btn btn--quiet btn--sm mg-mrg__swap" type="button" data-act="mg-swap" title="Поміняти місцями: що обʼєднуємо ↔ у що">' + P.ic('sort', 'ui-icon--sm') + '<span>поміняти місцями</span></button></div>' +
        col('dst') + '</div>' +
        '<div class="mg-mrg__sum" data-mg-sum aria-live="polite"></div>',
      foot: M.cancelBtn() + '<button class="btn btn--primary" type="button" data-act="mg-go" disabled>' + P.ic('merge') + 'Обʼєднати</button>',
      onMount: function (el) {
        el.addEventListener('input', function (e) {
          var side = e.target.getAttribute && e.target.getAttribute('data-mg-q'); if (!side) return;
          st.q[side] = e.target.value; q(el, '[data-mg-list="' + side + '"]').innerHTML = list(side);
        });
        el.addEventListener('keydown', function (e) {
          var side = e.target.getAttribute && e.target.getAttribute('data-mg-q'); if (!side || e.key !== 'Enter') return;
          e.preventDefault(); var b = q(el, '[data-mg-list="' + side + '"] .mg-pick:not([disabled]):not(.mg-pick--on)'); if (b) b.click();
        });
      },
      on: {
        'mg-pick': function (t) {
          var side = t.getAttribute('data-side'), id = t.getAttribute('data-id');
          if (side === 'dst') st.dst = st.dst === id ? null : id;
          else { var i = st.src.indexOf(id); if (i >= 0) st.src.splice(i, 1); else if (st.src.length < MAX) st.src.push(id); }
          refresh(); focusSearch(side);
        },
        'mg-drop': function (t) {
          var side = t.getAttribute('data-side'), id = t.getAttribute('data-id');
          if (side === 'dst') st.dst = null; else st.src = st.src.filter(function (x) { return x !== id; });
          refresh(); focusSearch(side);
        },
        'mg-swap': function () {
          var a = st.src[0] || null; st.src = st.dst ? [st.dst] : []; st.dst = a;
          if (!st.levelTouched) st.level = null;
          refresh();
        },
        'mg-mlevel': function (t) { st.level = t.getAttribute('data-v'); st.levelTouched = true; paint(); },
        'mg-again': function () { refresh(); },
        'mg-go': function (t) {
          t.disabled = true;
          v.call('srMgMerge', { kind: o.kind, keepId: st.dst, ids: st.src, level: isP ? undefined : st.level }).then(function (r) {
            if (!r.ok) { t.disabled = false; M.failToast(r); return; }
            layer.close(); P.emit('kd:changed');
            var names = r.removed.map(function (n) { return '«' + n + '»'; }).join(', ');
            P.toast('ok', M.cnt(r.removed.length + 1, word) + ' → 1 · ' + r.keepName,
              (isP ? M.cnt(r.moved.audits, M.W.audit) + ' і ' + M.cnt(r.moved.orders, M.W.order) : M.cnt(r.moved.records, M.W.rec) + ' браку у ' + M.inAudits(r.moved.audits)) +
              ' — тепер «' + r.keepName + '». Зі списків ' + (r.removed.length > 1 ? 'зникли' : 'зник') + ': ' + names + '.');
            if (v.ctx.alive()) o.onDone(r);
          });
        }
      } }, 'mg-merge');
    refresh();
    focusSearch(st.src.length && !st.dst ? 'dst' : 'src');
    return layer;
  };
})(window);
