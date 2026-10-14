(function (root) {
  'use strict';
  var P = root.P, doc = root.document, esc = P.esc;
  var S = P.sr = P.sr || {};

  S.KD_STATES = {
    ok: { label: 'у нормі', help: 'kd.state.ok' }, over: { label: 'понад норму, не почато', help: 'kd.state.over' },
    work: { label: 'в роботі', help: 'kd.state.work' }, watch: { label: 'на спостереженні', help: 'kd.state.watch' },
    done: { label: 'спостереження вдале', help: 'kd.state.done' }, relapse: { label: 'рецидив', help: 'kd.state.relapse' },
    skip: { label: 'дія не потрібна', help: 'kd.state.skip' }
  };
  S.kdStateOf = function (status) {
    return { 'new': 'over', started: 'work', check: 'watch', helped: 'done', not_helped: 'relapse', not_needed: 'skip', none: 'ok' }[status] || 'ok';
  };


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
    empty: function (title, text) { return P.state.empty('info', title, text); },
    loading: function () { return P.state.loading(); },
    error: function (r) { return P.state.error('Не вдалося завантажити', (r && r.error) || ''); },
    dayLong: function (day) {
      var d = new Date(Date.parse(day + 'T12:00:00Z'));
      return d.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
    },
    dayShort: function (day) { var p = String(day).split('-'); return +p[2] + '.' + p[1]; },
    kdState: function (state, text) {
      var k = S.KD_STATES[state] ? state : 'ok';
      return '<span class="kds kds--' + k + '">' + esc(text || S.KD_STATES[k].label) + '</span>';
    },
    kdMark: function (state, title) {
      var k = S.KD_STATES[state] ? state : 'ok';
      return '<i class="kdm kdm--' + k + '" title="' + esc(title || S.KD_STATES[k].label) + '" aria-label="' + esc(title || S.KD_STATES[k].label) + '"></i>';
    }
  };

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
    var f = wrap.querySelector('input, select, textarea, button:not([data-ov-close]):not([data-help])');
    if (f && kind !== 'menu') try { f.focus({ preventScroll: true }); } catch (e) { /* */ }
    return layer;
  }
  S.modal = function (o) { return makeLayer('modal', o); };
  S.drawer = function (o) { return makeLayer('drawer', o); };
  S.menu = function (anchor, o) {
    var r = anchor.getBoundingClientRect();
    var top = Math.round(r.bottom + 8);   // висота — до низу екрана, решта гортається (меню адміністратора довге)
    o.style = 'position:fixed;top:' + top + 'px;right:' + Math.max(16, Math.round(root.innerWidth - r.right)) + 'px;width:' + (o.width || 360) +
      'px;max-width:calc(100vw - 32px);max-height:' + Math.max(200, root.innerHeight - top - 12) + 'px;overflow:auto';
    return makeLayer('menu', o);
  };
  S.closeAll = function () { while (stack.length) stack[stack.length - 1].close(); };
  S.openCount = function () { return stack.length; };
  if (P.profileSwitch) P.profileSwitch.busy = function () { return stack.length > 0; };
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && stack.length) { var top = stack[stack.length - 1]; if (top.kind !== 'modal' || !top.el.querySelector('[data-locked]')) closeTop(); } });

})(typeof window !== 'undefined' ? window : globalThis);
