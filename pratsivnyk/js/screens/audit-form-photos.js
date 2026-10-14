(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, doc = root.document, AF = P.AF = P.AF || {};
  var MAX = 3, SIDE = 480, TARGET = 60 * 1024, LIMIT = 100 * 1024;
  var RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;

  AF.PHOTO_MAX = MAX;
  function bytes(url) { return Math.floor((url.length - url.indexOf(',') - 1) * 3 / 4); }
  AF.isPhoto = function (s) { return typeof s === 'string' && s.length < LIMIT * 2 && RE.test(s) && bytes(s) <= LIMIT; };

  AF.photoCompress = function (file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type || '')) { reject(new Error('type')); return; }
      var url = root.URL.createObjectURL(file), img = new root.Image();
      img.onload = function () {
        root.URL.revokeObjectURL(url);
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, SIDE / Math.max(w, h, 1));
        var c = doc.createElement('canvas');
        c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        var g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        var q = 0.8, out = c.toDataURL('image/jpeg', q);
        while (bytes(out) > TARGET && q > 0.35) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
        if (AF.isPhoto(out)) resolve(out); else reject(new Error('encode'));
      };
      img.onerror = function () { root.URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  };

  AF.photoAdd = function (d, files) {
    d.photos = Array.isArray(d.photos) ? d.photos : [];
    var room = Math.max(0, MAX - d.photos.length), take = files.slice(0, room), res = { added: 0, failed: 0, skipped: files.length - take.length };
    return take.reduce(function (chain, f) {
      return chain.then(function () {
        return AF.photoCompress(f).then(function (url) {
          if (d.photos.length < MAX) { d.photos.push(url); res.added++; } else res.skipped++;
        }, function () { res.failed++; });
      });
    }, Promise.resolve()).then(function () { return res; });
  };

  AF.photoThumbs = function (list, from, label) {
    return '<div class="ph-row">' + list.map(function (src, i) {
      return '<button type="button" class="ph-thumb" data-ph-i="' + (from + i) + '" aria-label="' + esc((label || 'Фото') + ' ' + (i + 1) + ' — на весь екран') + '">' +
        '<img src="' + esc(src) + '" alt="' + esc(label || 'Фото браку') + '" loading="lazy"></button>';
    }).join('') + '</div>';
  };

  AF.photoField = function (F, d) {
    var list = Array.isArray(d.photos) ? d.photos : [], k = esc(d.key);
    return '<div class="ui-field ph-field"><span class="ui-label">Фото · ' + list.length + ' з ' + MAX + ' <span class="ui-hint">можна без фото</span>' + P.help.btn('w.form.photo') + '</span>' +
      '<div class="ph-row">' + list.map(function (src, i) {
        return '<span class="ph-item"><button type="button" class="ph-thumb" data-a="photo-view" data-k="' + k + '" data-i="' + i + '" aria-label="Фото ' + (i + 1) + ' — на весь екран">' +
          '<img src="' + esc(src) + '" alt="Фото браку ' + (i + 1) + '"></button>' +
          '<button type="button" class="ph-del" data-a="photo-del" data-k="' + k + '" data-i="' + i + '" aria-label="Прибрати фото ' + (i + 1) + '">' + P.ic('close', 'ui-icon--sm') + '</button></span>';
      }).join('') +
      (d.photoBusy ? '<span class="ph-busy"><span class="ui-spinner ui-spinner--sm" aria-hidden="true"></span>Зменшую фото…</span>'
        : list.length < MAX ? '<label class="ui-btn ui-btn--secondary ui-btn--sm ph-add">' + P.ic('photo') + 'Додати фото' +
          '<input type="file" accept="image/*" capture="environment" multiple class="visually-hidden" data-photo-in data-k="' + k + '"></label>' : '') +
      '</div></div>';
  };

  AF.photoActs = {
    'photo-del': function (t, F, defByKey, changed) {
      var d = defByKey(t.getAttribute('data-k')), i = Number(t.getAttribute('data-i'));
      if (!d || !Array.isArray(d.photos) || !(i >= 0 && i < d.photos.length)) return;
      d.photos.splice(i, 1); changed(true);
      P.toast('ok', 'Фото прибрано', 'Лишилось: ' + d.photos.length + ' з ' + MAX);
    },
    'photo-view': function (t, F, defByKey) {
      var d = defByKey(t.getAttribute('data-k'));
      if (d && d.photos && d.photos.length) AF.photoView(d.photos, Number(t.getAttribute('data-i')) || 0);
    }
  };

  AF.photoView = function (list, i) {
    if (!list || !list.length) return;
    var back = doc.activeElement, el = doc.createElement('div');
    el.className = 'ph-view'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Фото браку');
    function draw() {
      el.innerHTML = '<div class="ph-view__bar"><span>Фото ' + (i + 1) + ' з ' + list.length + '</span>' +
        '<button type="button" class="ph-view__btn" data-ph="close" aria-label="Закрити">' + P.ic('close') + '</button></div>' +
        '<div class="ph-view__img"><img src="' + esc(list[i]) + '" alt="Фото браку ' + (i + 1) + '"></div>' +
        (list.length > 1 ? '<div class="ph-view__nav"><button type="button" class="ph-view__btn" data-ph="prev"' + (i ? '' : ' disabled') + ' aria-label="Попереднє фото">' + P.ic('chevron-left') + '</button>' +
          '<button type="button" class="ph-view__btn" data-ph="next"' + (i < list.length - 1 ? '' : ' disabled') + ' aria-label="Наступне фото">' + P.ic('chevron-right') + '</button></div>' : '');
      var c = el.querySelector('[data-ph="close"]'); if (c) c.focus();
    }
    function close() { doc.removeEventListener('keydown', onKey, true); el.remove(); if (back && back.focus) try { back.focus({ preventScroll: true }); } catch (e) { /* */ } }
    function go(k) { if (k >= 0 && k < list.length && k !== i) { i = k; draw(); } }
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      else if (e.key === 'ArrowLeft') go(i - 1);
      else if (e.key === 'ArrowRight') go(i + 1);
    }
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ph]');
      if (!b) { if (e.target === el || e.target.classList.contains('ph-view__img')) close(); return; }
      var a = b.getAttribute('data-ph');
      if (a === 'close') close(); else go(a === 'prev' ? i - 1 : i + 1);
    });
    doc.addEventListener('keydown', onKey, true);
    doc.body.appendChild(el);
    draw();
  };
})(window);
