(function (root) {
  'use strict';
  var P = root.P, doc = root.document, esc = P.esc;
  var LV = ['fix', 'repair', 'scrap'];
  function num(n) { return P.sr.h.num(n); }
  function pct(v) { return P.sr.h.pct(v); }

  var tipEl = null, owner = null;   // owner — графік, чия плашка зараз на екрані
  var pinned = null;                // графік, у якому зараз щось зафіксовано (останній)
  function covered(chart) {
    var ov = doc.getElementById('overlay'), top = ov && ov.lastElementChild;
    return !!top && !top.contains(chart.el);
  }
  function tipBox() {
    if (!tipEl) { tipEl = doc.createElement('div'); tipEl.className = 'ctip'; tipEl.hidden = true; tipEl.setAttribute('role', 'status'); doc.body.appendChild(tipEl); }
    return tipEl;
  }
  function hideTip() { if (tipEl) { tipEl.hidden = true; tipEl.className = 'ctip'; } owner = null; }
  function place(x, y, pinned, altX) {
    var t = tipBox(), w = t.offsetWidth, hgt = t.offsetHeight, sx = root.pageXOffset, sy = root.pageYOffset;
    var vw = doc.documentElement.clientWidth, vh = root.innerHeight;
    var left = x + 14, top = y + (pinned ? 0 : 16);
    if (left + w > sx + vw - 8) left = (altX != null ? altX : x) - 14 - w;      // праворуч не влазить — ставимо ліворуч
    if (left < sx + 8) left = sx + 8;
    if (top + hgt > sy + vh - 8) top = Math.max(sy + 8, (pinned ? sy + vh - 8 : y - 12) - hgt);
    t.style.left = Math.round(left) + 'px'; t.style.top = Math.round(top) + 'px';
  }
  function showTip(chart, html, pinned) {
    var t = tipBox();
    t.innerHTML = html + (pinned ? '<div class="ctip__pin">зафіксовано</div>' : '');
    t.className = 'ctip' + (pinned ? ' ctip--pin' : ''); t.hidden = false; owner = chart;
  }
  if (root.MutationObserver) new root.MutationObserver(function () { if (owner && (!doc.contains(owner.el) || covered(owner))) hideTip(); }).observe(doc.documentElement, { childList: true, subtree: true });
  if (P.on) P.on('route', hideTip);
  var raf = 0;
  doc.addEventListener('scroll', function () { if (!owner || raf) return; raf = root.requestAnimationFrame(function () { raf = 0; if (owner) owner.anchor(); }); }, true);
  root.addEventListener('resize', function () { if (owner) owner.anchor(); });

  var TIP_WIDE = 16;   // значення довше за стільки знаків — у плашці окремим рядком (v1.4)
  function tip(o) {
    var lv = o.levels, tot = lv ? (lv.fix || 0) + (lv.repair || 0) + (lv.scrap || 0) : 0;
    return '<div class="ctip__title">' + esc(o.title || '') + '</div>' + (o.sub ? '<div class="ctip__sub">' + esc(o.sub) + '</div>' : '') +
      (o.rows && o.rows.length ? '<div class="ctip__rows">' + o.rows.map(function (r) {
        var wide = String(r[1]).length > TIP_WIDE, cls = (r[2] ? 'ctip__' + r[2] : '') + (wide ? ' ctip__wv' : '');
        return '<span' + (wide ? ' class="ctip__wl"' : '') + '>' + esc(r[0]) + '</span><b' + (cls ? ' class="' + cls.trim() + '"' : '') + '>' + esc(String(r[1])) + '</b>'; }).join('') + '</div>' : '') +
      (lv && tot ? '<div class="ctip__lv">' + LV.map(function (k) {
        return '<span class="lvl lvl--' + k + '">' + esc(P.sr.LEVELS[k]) + '</span><b>' + num(lv[k] || 0) + ' шт · ' + Math.round((lv[k] || 0) / tot * 100) + '%</b>'; }).join('') + '</div>' : '') +
      (o.foot ? '<div class="ctip__sub">' + esc(o.foot) + '</div>' : '');
  }
  function tipDay(d) {
    if (d.none) return tip({ title: d.title, sub: d.none });
    return tip({ title: d.title, sub: d.sub, levels: d.levels, rows: [['Аудитів', num(d.audits)], ['Перевірено', num(d.checked) + ' шт'],
      ['Брак', num(d.rejected) + ' шт · ' + pct(d.pct), d.over ? 'danger' : '']].concat(d.rows || []) });
  }

  function areaOf(o, H) { return H - 12 - (o.items.some(function (x) { return x.mark; }) ? 18 : 0); }
  function segsHtml(segs, total) {
    var sum = segs.reduce(function (s, g) { return s + (g.v || 0); }, 0);
    return sum ? segs.slice().reverse().map(function (g) {
      return g.v ? '<i class="' + esc(g.cls || 'c-one') + '" style="height:' + (g.v / sum * total).toFixed(1) + 'px"></i>' : ''; }).join('') : '';
  }
  function barsHtml(o, H, max) {
    var area = areaOf(o, H);
    return o.items.map(function (x, i) {
      var inner, v = x.v || 0;
      if (x.none) inner = '<i class="c-none"></i>';
      else if (!v) inner = '<i class="c-zero"></i>';
      else {
        var total = Math.max(3, v / max * area), lv = x.levels, t = lv ? (lv.fix || 0) + (lv.repair || 0) + (lv.scrap || 0) : 0;
        inner = x.segs ? segsHtml(x.segs, total)
          : t ? ['scrap', 'repair', 'fix'].map(function (k) { return lv[k] ? '<i class="s-' + k + '" style="height:' + (lv[k] / t * total).toFixed(1) + 'px"></i>' : ''; }).join('')
            : '<i class="' + (x.hot ? 'c-hot' : 'c-one') + '" style="height:' + total.toFixed(1) + 'px"></i>';
      }
      var mark = x.mark ? '<b class="cbar__mark' + (x.mark.cls ? ' ' + esc(x.mark.cls) : '') + '"' + (x.mark.title ? ' title="' + esc(x.mark.title) + '"' : '') + '>' + esc(x.mark.text) + '</b>' : '';
      return '<div class="cbar' + (x.cls ? ' ' + x.cls : '') + '" data-i="' + i + '">' + mark + inner + '</div>';
    }).join('');
  }
  function axisAllHtml(items, dens) {
    return '<div class="chart-x chart-x--all' + (dens ? ' chart-x--' + dens : '') + (items.length > 12 ? ' chart-x--many' : '') + '" aria-hidden="true">' +
      items.map(function (x) { return '<span>' + esc(x.x != null ? x.x : '') + '</span>'; }).join('') + '</div>';
  }
  function axisHtml(items) {
    var idx = [], k = Math.min(5, items.length);
    for (var i = 0; i < k; i++) { var j = k === 1 ? 0 : Math.round(i * (items.length - 1) / (k - 1)); if (idx.indexOf(j) < 0) idx.push(j); }
    return '<div class="chart-x">' + idx.map(function (j) { return '<span>' + esc(items[j].x != null ? items[j].x : '') + '</span>'; }).join('') + '</div>';
  }

  function mount(el, o) {
    if (!el) return null;
    var items = o.items || [], H = o.height || (o.mini ? 44 : 220);
    var max = o.max || Math.max.apply(null, items.map(function (x) { return x.v || 0; }).concat([o.line ? o.line.v * 1.25 : 0, 1e-9]));
    var canRange = !o.mini && typeof o.tipRange === 'function';
    var dens = items.length > 40 ? 'dense' : items.length > 20 ? 'mid' : '';
    el.classList.add('cchart-wrap');
    el.innerHTML = '<div class="cchart' + (o.mini ? ' cchart--mini' : '') + (dens ? ' cchart--' + dens : '') +
      '" style="height:' + H + 'px" tabindex="0" role="img" aria-label="' + esc(o.label || 'Графік') + '">' +
      (o.line ? '<div class="cchart__line" style="bottom:' + Math.round(o.line.v / max * areaOf(o, H)) + 'px">' + (o.line.label && !o.mini ? '<span>' + esc(o.line.label) + '</span>' : '') + '</div>' : '') +
      barsHtml(o, H, max) + '</div>' + (o.mini || o.xLabels === false || !items.length ? '' : o.xAll ? axisAllHtml(items, dens) : axisHtml(items));
    var box = el.firstChild, bars = Array.prototype.slice.call(box.querySelectorAll('.cbar'));
    var st = { hot: -1, pin: -1, a: -1, b: -1, down: -1, drag: false };
    function indexOfKey(k) { for (var i = 0; i < items.length; i++) if (items[i].key === k) return i; return -1; }
    if (o.pin != null) st.pin = indexOfKey(o.pin);
    if (o.range && o.range.length === 2) { st.a = indexOfKey(o.range[0]); st.b = indexOfKey(o.range[1]); if (st.a < 0 || st.b < 0) st.a = st.b = -1; }

    function at(clientX) {
      var best = -1, d = Infinity;
      for (var i = 0; i < bars.length; i++) { var r = bars[i].getBoundingClientRect(), c = Math.abs(clientX - (r.left + r.width / 2)); if (c < d) { d = c; best = i; } }
      return best;
    }
    function paint(liveA, liveB) {
      var a = liveA != null ? Math.min(liveA, liveB) : st.a, b = liveA != null ? Math.max(liveA, liveB) : st.b;
      var sel = st.pin >= 0 || a >= 0;
      box.classList.toggle('has-sel', sel);
      box.classList.toggle('is-hover', st.hot >= 0 && !sel);
      bars.forEach(function (n, i) {
        n.classList.toggle('is-hot', i === st.hot);
        n.classList.toggle('is-pin', i === st.pin);
        n.classList.toggle('is-range', a >= 0 && i >= a && i <= b);
      });
    }
    function rangeHtml(a, b) { return o.tipRange(items.slice(a, b + 1), items[a], items[b]); }
    function anchor() {
      if (st.pin < 0 && st.a < 0) { if (owner === api) hideTip(); return; }
      if (covered(api)) { if (owner === api) hideTip(); return; }   // поверх відкрите вікно — плашку не показуємо
      var i = st.pin >= 0 ? st.pin : st.b, j = st.pin >= 0 ? st.pin : st.a;
      var r = bars[i].getBoundingClientRect(), r0 = bars[j].getBoundingClientRect(), top = box.getBoundingClientRect().top;
      showTip(api, st.pin >= 0 ? o.tip(items[st.pin], st.pin) : rangeHtml(st.a, st.b), true);
      place(r.right + root.pageXOffset - 6, top + root.pageYOffset + 4, true, r0.left + root.pageXOffset + 6);
    }
    function follow(e, html) { showTip(api, html, false); place(e.pageX, e.pageY, false); }
    function clear(silent) {
      var had = st.pin >= 0 || st.a >= 0;
      st.pin = st.a = st.b = -1; paint(); if (owner === api) hideTip();
      if (pinned === api) pinned = null;
      if (had && !silent) { if (o.onPin) o.onPin(null); if (o.onRange) o.onRange(null, null); }
    }
    function setPin(i, silent) {
      st.pin = i; st.a = st.b = -1; pinned = api; paint(); anchor();
      if (!silent && o.onPin) o.onPin(items[i], i);
    }

    if (o.tip) {
      box.addEventListener('pointermove', function (e) {
        var i = at(e.clientX);
        if (st.down >= 0) {                                    // тягнуть із затиснутою кнопкою → діапазон
          if (canRange && i !== st.down) st.drag = true;
          if (st.drag) { st.hot = -1; paint(st.down, i); follow(e, rangeHtml(Math.min(st.down, i), Math.max(st.down, i))); }
          return;
        }
        if (e.pointerType === 'touch') return;                 // на дотик наведення немає — лише фіксація
        if (i !== st.hot) { st.hot = i; paint(); }
        if (i >= 0) follow(e, o.tip(items[i], i));
      });
      box.addEventListener('pointerleave', function () {
        if (st.down >= 0) return;
        st.hot = -1; paint();
        if (st.pin >= 0 || st.a >= 0) return anchor();
        if (owner === api) hideTip();
        if (pinned && pinned !== api && doc.contains(pinned.el)) pinned.anchor();
      });
      box.addEventListener('pointerdown', function (e) {
        if (e.button != null && e.button !== 0) return;
        st.down = at(e.clientX); st.drag = false;
        try { box.setPointerCapture(e.pointerId); } catch (err) { /* старий браузер — обійдемось */ }
      });
      box.addEventListener('pointerup', function (e) {
        if (st.down < 0) return;
        var from = st.down, i = at(e.clientX), was = st.drag; st.down = -1; st.drag = false;
        st.hot = -1;   // після кліку підсвітку «під курсором» знімаємо — її поверне наступний рух миші
        try { box.releasePointerCapture(e.pointerId); } catch (err) { /* */ }
        if (was && i !== from) {                               // відпустили на іншому стовпчику — діапазон обрано
          st.pin = -1; st.a = Math.min(from, i); st.b = Math.max(from, i); pinned = api; paint(); anchor();
          if (o.onRange) o.onRange(items[st.a], items[st.b]);
        } else if (from === st.pin || (st.a >= 0 && from >= st.a && from <= st.b)) clear();   // клік по зафіксованому — зняти
        else if (from >= 0) setPin(from);
      });
      box.addEventListener('pointercancel', function () { st.down = -1; st.drag = false; paint(); });
      box.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { if (st.pin >= 0 || st.a >= 0) { e.stopPropagation(); clear(); } return; }
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        var i = st.pin >= 0 ? st.pin + (e.key === 'ArrowLeft' ? -1 : 1) : items.length - 1;
        if (i >= 0 && i < items.length) setPin(i);
      });
    }
    var api = { el: el, anchor: anchor, clear: function () { clear(true); },
      setPin: function (k) { var i = k == null ? -1 : indexOfKey(k); if (i < 0) clear(true); else setPin(i, true); },
      setRange: function (k1, k2) { var a = indexOfKey(k1), b = indexOfKey(k2); if (a < 0 || b < 0) return clear(true); st.pin = -1; st.a = Math.min(a, b); st.b = Math.max(a, b); pinned = api; paint(); anchor(); },
      destroy: function () { if (owner === api) hideTip(); if (pinned === api) pinned = null; el.innerHTML = ''; } };
    if (st.pin >= 0 || st.a >= 0) pinned = api;
    paint();
    return api;
  }

  P.srChart = { mount: mount, tip: tip, tipDay: tipDay, hide: hideTip };
})(typeof window !== 'undefined' ? window : globalThis);
