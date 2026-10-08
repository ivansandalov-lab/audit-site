(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var doc = root.document;
  var esc = function (s) { return P.esc(s); };

  P.initials = function (name) {
    return String(name || '?').split(/[\s-]+/).filter(Boolean).slice(0, 2)
      .map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
  };

  P.delegate = function (el, type, selector, fn) {
    el.addEventListener(type, function (e) {
      var t = e.target.closest ? e.target.closest(selector) : null;
      if (t && el.contains(t)) fn(e, t);
    });
  };

  var TOAST_ICON = { ok: 'success', warn: 'warning', danger: 'error', info: 'info' };
  P.toast = function (kind, title, text) {
    var host = doc && doc.getElementById('toasts');
    if (!host) return;
    var el = doc.createElement('div');
    el.className = 'ui-toast ui-toast--' + (TOAST_ICON[kind] ? kind : 'info');
    el.setAttribute('role', kind === 'danger' ? 'alert' : 'status');
    el.innerHTML = P.ic(TOAST_ICON[kind] || 'info') +
      '<div class="ui-toast__body"><p class="ui-toast__title">' + esc(title) + '</p>' +
      (text ? '<p class="ui-toast__text">' + esc(text) + '</p>' : '') + '</div>' +
      '<button class="icon-btn" type="button" aria-label="Закрити">' + P.ic('close', 'ui-icon--sm') + '</button>';
    el.querySelector('button').onclick = function () { el.remove(); };
    host.appendChild(el);
    setTimeout(function () { el.remove(); }, kind === 'danger' ? 9000 : 5200);
  };

  P.state = {
    empty: function (icon, title, text, actionHtml) {
      return '<div class="ui-state"><span class="ui-state__icon">' + P.ic(icon || 'info') + '</span>' +
        '<p class="ui-state__title">' + esc(title) + '</p>' + (text ? '<p class="ui-state__text">' + esc(text) + '</p>' : '') +
        (actionHtml || '') + '</div>';
    },
    error: function (title, text) {
      return '<div class="ui-state ui-state--error" role="alert"><span class="ui-state__icon">' + P.ic('error') + '</span>' +
        '<p class="ui-state__title">' + esc(title || 'Не вдалося завантажити') + '</p>' +
        '<p class="ui-state__text">' + esc(text || 'Перевірте звʼязок і спробуйте ще раз.') + '</p>' +
        '<button class="ui-btn ui-btn--secondary" type="button" data-act="retry">' + P.ic('refresh') + 'Спробувати ще раз</button></div>';
    },
    loading: function (text) {
      return '<div class="ui-state" role="status"><span class="ui-spinner" aria-hidden="true"></span>' +
        '<p class="ui-state__text">' + esc(text || 'Завантаження…') + '</p></div>';
    }
  };

  var openSheet = null;
  P.sheet = {
    open: function (o) {
      P.sheet.close();
      var host = doc.getElementById('overlay');
      var wrap = doc.createElement('div');
      wrap.className = 'sheet-backdrop';
      wrap.innerHTML = '<section class="sheet' + (o.full ? ' sheet--full' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '">' +
        '<header class="sheet__head"><h2 class="sheet__title">' + esc(o.title) + '</h2>' +
        '<button class="icon-btn" type="button" data-sheet-close aria-label="Закрити">' + P.ic('close') + '</button></header>' +
        (o.search ? '<div class="sheet__search">' + o.search + '</div>' : '') +
        '<div class="sheet__body">' + (o.body || '') + '</div>' +
        (o.foot ? '<footer class="sheet__foot">' + o.foot + '</footer>' : '') + '</section>';
      var prevFocus = doc.activeElement;
      function close() {
        if (!wrap.parentNode) return;
        wrap.remove(); openSheet = null; doc.removeEventListener('keydown', onKey);
        doc.documentElement.classList.remove('is-sheet-open');
        if (o.onClose) o.onClose();
        if (prevFocus && prevFocus.focus && prevFocus.isConnected) prevFocus.focus();
      }
      function onKey(e) {
        if (e.key === 'Escape') return close();
        if (e.key !== 'Tab') return;
        var f = wrap.querySelectorAll('button:not([disabled]), input, textarea, select, [href]');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      doc.documentElement.classList.add('is-sheet-open');   // сторінка під шторкою не прокручується
      wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(); });
      wrap.querySelector('[data-sheet-close]').onclick = close;
      doc.addEventListener('keydown', onKey);
      host.appendChild(wrap);
      openSheet = { el: wrap, close: close };
      if (o.onMount) o.onMount(wrap);
      var first = wrap.querySelector('input, button:not([data-sheet-close])');
      if (first) first.focus();
      return openSheet;
    },
    close: function () { if (openSheet) openSheet.close(); }
  };
  if (root.addEventListener) root.addEventListener('hashchange', function () { P.sheet.close(); });

  function hl(text, q) {
    var s = String(text || ''), i = q ? s.toLowerCase().indexOf(q) : -1;
    if (i < 0) return esc(s);
    return esc(s.slice(0, i)) + '<mark class="hl">' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length));
  }
  P.picker = function (o) {
    return new Promise(function (resolve) {
      var picked = o.multi ? (o.values || []).slice() : null, done = false, q = '';
      function finish(v) { if (done) return; done = true; P.sheet.close(); resolve(v); }
      function list() {
        var nq = q.trim().toLowerCase(), html = '', group = null, n = 0;
        o.options.forEach(function (op) {
          var hay = (op.title + ' ' + (op.meta || '') + ' ' + op.value).toLowerCase();
          if (nq && hay.indexOf(nq) < 0) return;
          if (op.group && op.group !== group) { group = op.group; html += '<div class="opt-group">' + esc(group) + '</div>'; }
          var sel = o.multi ? picked.indexOf(op.value) >= 0 : op.value === o.value;
          html += '<button type="button" class="opt" role="option" aria-selected="' + sel + '" data-val="' + esc(op.value) + '">' +
            '<span class="opt__main"><span class="opt__title">' + hl(op.title, nq) + '</span>' +
            (op.meta ? '<span class="opt__meta">' + hl(op.meta, nq) + '</span>' : '') + '</span>' +
            (sel ? '<span class="opt__check">' + P.ic('check') + '</span>' : '') + '</button>';
          n++;
        });
        return n ? '<div role="listbox"' + (o.multi ? ' aria-multiselectable="true"' : '') + '>' + html + '</div>' :
          P.state.empty('search', nq ? 'Нічого не знайдено' : (o.emptyText || 'Список порожній'), nq ? 'Спробуйте інше слово.' : '');
      }
      P.sheet.open({
        title: o.title, full: o.options.length > 8,
        search: o.search || o.options.length > 6 ? '<label class="ui-input-wrap">' + P.ic('search') +
          '<span class="visually-hidden">Пошук</span><input class="ui-input" type="search" data-picker-q placeholder="' +
          esc(o.placeholder || 'Пошук') + '" autocomplete="off"></label>' : '',
        body: list(),
        foot: o.multi ? '<button class="ui-btn ui-btn--primary" type="button" data-picker-done>Готово</button>' : '',
        onClose: function () { if (!done) { done = true; resolve(null); } },
        onMount: function (el) {
          var body = el.querySelector('.sheet__body'), input = el.querySelector('[data-picker-q]');
          if (input) input.addEventListener('input', function () { q = input.value; body.innerHTML = list(); });
          P.delegate(body, 'click', '.opt', function (e, t) {
            var v = t.getAttribute('data-val');
            if (!o.multi) return finish(v);
            var i = picked.indexOf(v);
            if (i >= 0) picked.splice(i, 1); else picked.push(v);
            body.innerHTML = list();
          });
          var doneBtn = el.querySelector('[data-picker-done]');
          if (doneBtn) doneBtn.onclick = function () { finish(picked); };
        }
      });
    });
  };

  P.confirm = function (o) {
    return new Promise(function (resolve) {
      var answered = false;
      function answer(v) { if (answered) return; answered = true; P.sheet.close(); resolve(v); }
      P.sheet.open({
        title: o.title,
        body: '<p class="ui-text-sm" style="margin:var(--sp-2) var(--sp-2) 0">' + esc(o.text || '') + '</p>',
        foot: '<button class="ui-btn ui-btn--secondary" type="button" data-no>' + esc(o.cancelLabel || 'Скасувати') + '</button>' +
          '<button class="ui-btn ' + (o.danger ? 'ui-btn--danger' : 'ui-btn--primary') + '" type="button" data-yes>' + esc(o.okLabel || 'Так') + '</button>',
        onClose: function () { if (!answered) { answered = true; resolve(null); } },
        onMount: function (el) {
          el.querySelector('[data-no]').onclick = function () { answer(false); };
          el.querySelector('[data-yes]').onclick = function () { answer(true); };
        }
      });
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
