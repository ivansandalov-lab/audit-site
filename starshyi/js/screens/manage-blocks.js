(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, M = P.srMg;
  var q = M.q, da = M.da;

  M.section('blocks', 'Блоки замовлень', function (v) {
    var data = null, st = { edit: null, name: '', orders: [], bq: '' };
    function load() { v.get('srMgBlocks', function (r) { data = r; draw(); }); }
    function find(id) { return data.items.filter(function (x) { return x.id === id; })[0]; }
    function card(b) {
      return '<section class="card"><div class="card-head"><h3 class="card-title">' + esc(b.name) + '</h3>' + M.pen('mg-edit', da('id', b.id), 'Редагувати ' + b.name) + '</div>' +
        '<div class="chips">' + b.orders.map(function (no) { return '<span class="chip chip--plain">' + esc(no) + '</span>'; }).join('') + '</div>' +
        '<p class="hint">' + esc(b.products.join(' · ') || '—') + '</p>' +
        '<p class="hint" style="color:var(--text-2)">' + (b.audits ? 'у ' + M.inAudits(b.audits) + ' · останній — ' + M.ago(b.lastAuditAt) : 'в аудитах ще не було') + '</p></section>';
    }
    function results() {
      var s = st.bq.trim().toLowerCase(), mine = st.edit === 'new' ? null : st.edit;
      var list = data.orders.filter(function (o) { return st.orders.indexOf(o.no) < 0 && (!s || o.no.toLowerCase().indexOf(s) >= 0 || o.customer.toLowerCase().indexOf(s) >= 0); }).slice(0, 6);
      if (!list.length) return '<p class="hint" style="padding:12px">Не знайдено.</p>';
      return list.map(function (o) {
        var busy = o.blockId && o.blockId !== mine;
        return '<div class="opt" style="min-height:52px;padding:6px 12px' + (busy ? ';color:var(--text-3)' : '') + '"><span class="opt__main"><span class="opt__title">' + esc(o.no) + '</span>' +
          '<span class="opt__meta">' + esc(o.customer) + ' · ' + esc(o.products.join(', ')) + (busy ? ' · уже в «' + esc(o.blockName) + '»' : '') + '</span></span>' +
          (busy ? '' : '<button class="btn btn--secondary btn--sm" type="button" data-act="mg-badd"' + da('no', o.no) + '>' + P.ic('add', 'ui-icon--sm') + 'Додати</button>') + '</div>';
      }).join('');
    }
    function editor() {
      var isNew = st.edit === 'new';
      return '<section class="card mg-editing" data-mg-editor><div class="card-head"><h3 class="card-title">' + esc(isNew ? 'Новий блок' : find(st.edit).name) + '</h3>' + H.badge(isNew ? 'новий' : 'редагується', 'brand') + '</div>' +
        '<label class="field" data-f="name"><span class="label">Назва блоку</span><input class="input" name="name" data-input="mg-bname" maxlength="40" value="' + esc(st.name) + '" placeholder="Блок ' + (data.items.length + 1) + '"></label>' +
        '<div class="field" data-f="orders"><span class="label">Замовлення · ' + st.orders.length + '</span><div class="chips">' + (st.orders.length ? st.orders.map(function (no) {
          return '<span class="chip">' + esc(no) + '<button class="chip__x" type="button" data-act="mg-bdel"' + da('no', no) + ' aria-label="Прибрати ' + esc(no) + '">' + P.ic('close', 'ui-icon--sm') + '</button></span>'; }).join('')
          : '<span class="hint">ще жодного</span>') + '</div></div>' +
        '<div class="field mg-addbox"><span class="label">Додати замовлення</span><div class="search">' + P.ic('search', 'icon') +
        '<input class="input input--search" data-input="mg-bq" value="' + esc(st.bq) + '" placeholder="Номер або замовник" aria-label="Пошук замовлення"></div>' +
        '<div class="mg-results" data-mg-results>' + results() + '</div></div>' +
        '<div class="mg-actions"><button class="btn btn--primary btn--sm" type="button" data-act="mg-bsave">' + P.ic('save', 'ui-icon--sm') + 'Зберегти</button>' +
        '<button class="btn btn--quiet btn--sm" type="button" data-act="mg-bcancel">Скасувати</button>' +
        (isNew ? '' : '<span style="flex:1"></span><button class="btn btn--quiet btn--sm mg-danger" type="button" data-act="mg-bremove">' + P.ic('delete', 'ui-icon--sm') + 'Видалити блок</button>') + '</div></section>';
    }
    function draw() {
      var cards = data.items.map(function (b) { return b.id === st.edit ? editor() : card(b); });
      if (st.edit === 'new') cards.unshift(editor());
      v.col.innerHTML = M.head('Блоки замовлень', 'Блок — кілька замовлень під однією назвою; у формі аудиту обирається одним натиском.', M.btnNew('Новий блок'), 'sr.mg.blocks') +
        (cards.length ? '<div class="mg-blocks">' + cards.join('') + '</div>' : '<section class="card">' + H.empty('Блоків ще немає', '') + '</section>') +
        '<p class="hint">Записані аудити зберігають ті замовлення, які були на момент запису.</p>';
    }
    function startEdit(id) {
      var b = id === 'new' ? null : find(id);
      st.edit = id; st.name = b ? b.name : ''; st.orders = b ? b.orders.slice() : []; st.bq = '';
      draw();
      var ed = q(v.col, '[data-mg-editor]');
      if (ed) { if (ed.scrollIntoView) ed.scrollIntoView({ block: 'nearest' }); var i = q(ed, 'input[name="name"]'); if (i) i.focus({ preventScroll: true }); }
    }
    v.openNew = function () { startEdit('new'); };
    v.ctx.on('mg-new', function () { startEdit('new'); });
    v.ctx.on('mg-edit', function (t) { startEdit(t.getAttribute('data-id')); });
    v.ctx.on('mg-bname', function (t) { st.name = t.value; });
    v.ctx.on('mg-bq', function (t) { st.bq = t.value; q(v.col, '[data-mg-results]').innerHTML = results(); });
    v.ctx.on('mg-badd', function (t) { st.orders.push(t.getAttribute('data-no')); draw(); var i = q(v.col, '[data-input="mg-bq"]'); if (i) i.focus({ preventScroll: true }); });
    v.ctx.on('mg-bdel', function (t) { var no = t.getAttribute('data-no'); st.orders = st.orders.filter(function (x) { return x !== no; }); draw(); });
    v.ctx.on('mg-bcancel', function () { st.edit = null; draw(); });
    v.ctx.on('mg-bsave', function (t) {
      t.disabled = true;
      v.call('srMgBlockSave', { id: st.edit === 'new' ? null : st.edit, name: st.name, orders: st.orders }).then(function (r) {
        if (!v.ctx.alive()) return;
        t.disabled = false;
        if (!r.ok) { M.showErrors(q(v.col, '[data-mg-editor]'), r); return; }
        st.edit = null;
        P.toast('ok', (r.created ? 'Блок створено · ' : 'Блок збережено · ') + r.name, M.cnt(r.orders.length, M.W.order) + ' у блоці · є у формі аудиту.');
        load();
      });
    });
    v.ctx.on('mg-bremove', function () {
      var b = find(st.edit);
      P.confirm({ title: 'Видалити «' + b.name + '»?', text: 'У формі аудиту блоку не буде. Записані аудити зберігають свої замовлення.', okLabel: 'Видалити блок', danger: true })
        .then(function (ok) {
          if (!ok) return;
          v.call('srMgBlockDelete', { id: b.id }).then(function (r) {
            if (!v.ctx.alive()) return;
            if (!r.ok) { M.failToast(r); return; }
            st.edit = null; P.toast('ok', 'Блок видалено · ' + r.name); load();
          });
        });
    });
    load();
  });
})(window);
