(function (root) {
  'use strict';
  var P = root.P, esc = P.esc;

  function slackHtml(text, links) {
    var h = esc(text).replace(/\{([^{}\s]{1,20})\}/g, function (all, n) {
      return Object.prototype.hasOwnProperty.call(links, n) ? '<span class="rz-link">' + esc(links[n]) + '</span>' : all;
    });
    return h.replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,!?])/gm, '$1<i>$2</i>').replace(/\n/g, '<br>');
  }

  function mount(el, data) {
    var cur = data.locations[0].id, draft = null, timer = null, seq = 0, last = null;

    el.innerHTML = '<div class="rz-prev__head"><span class="label">Як виглядатиме в Slack' + P.help.btn('admin.ml.preview') + '</span><select class="input rz-sel" data-rz-ploc aria-label="Цифри якої локації показати"></select></div>' +
      '<div data-rz-pv>' + P.state.loading('Рахую цифри…') + '</div><p class="hint" data-rz-pvnote></p>' +
      '<div class="rz-prev__send"><button class="btn btn--secondary" type="button" data-act="rz-test">' + P.ic('slack', 'ui-icon--sm') + 'Надіслати пробне в тестовий канал</button>' +
      '<p class="hint" data-rz-sendnote></p></div>';
    var box = el.querySelector('[data-rz-pv]'), note = el.querySelector('[data-rz-pvnote]'), sel = el.querySelector('[data-rz-ploc]');
    sel.addEventListener('change', function () { cur = sel.value; run(); });
    sendNote();

    function sendNote() {
      el.querySelector('[data-rz-sendnote]').textContent = P.mailProbe && P.mailProbe.has()
        ? 'Піде лише в тестовий канал, з позначкою «цифри вигадані». Не частіше разу на хвилину.'
        : 'Щоб надіслати в Slack, введіть код розсилки внизу сторінки — блок «Тестовий канал і пробна розсилка».';
    }
    function setLocations(l) {
      var list = data.locations.filter(function (x) { return l === 'all' || !l.length || l.indexOf(x.id) >= 0; });
      if (!list.some(function (x) { return x.id === cur; })) { cur = list[0].id; if (draft) run(); }
      sel.innerHTML = list.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === cur ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('');
    }
    function fetchNow() {
      var my = ++seq;
      return P.srv('mlRulePreview', { locationId: cur, template: draft.template }).then(function (r) { return my === seq ? r : null; });
    }
    function run() {
      clearTimeout(timer);
      fetchNow().then(function (r) {
        if (!r || !root.document.body.contains(el)) return;
        if (!r.ok) { box.innerHTML = '<p class="err" role="alert">' + P.ic('error', 'ui-icon--sm') + esc(r.error || 'Не вдалося порахувати цифри.') + '</p>'; note.textContent = ''; return; }
        last = r;
        box.innerHTML = '<div class="rz-slack"><span class="rz-slack__ava" aria-hidden="true">А</span><div class="rz-slack__msg">' +
          '<p class="rz-slack__who"><b>Аудит</b> <span class="hint">додаток · ' + esc(P.fmt.time(r.at)) + '</span></p>' +
          (String(r.text).trim() ? '<div class="rz-slack__text">' + slackHtml(r.text, data.options.links) + '</div>' : '<p class="hint">Тут зʼявиться текст повідомлення.</p>') + '</div></div>';
        note.textContent = 'Цифри — вигадані дані «' + r.location.name + '» за сьогодні, станом на ' + P.fmt.time(r.at) + '.';
      });
    }
    function update(d) { draft = d; clearTimeout(timer); timer = setTimeout(run, last ? 250 : 0); }

    function send(btn, d, showErrors) {
      draft = d;
      if (!P.mailProbe || !P.mailProbe.has()) {
        var probe = root.document.querySelector('.rz-probe'); if (probe) probe.open = true;
        P.toast('info', 'Спершу введіть код розсилки', 'Внизу сторінки — блок «Тестовий канал і пробна розсилка».');
        return;
      }
      if (!String(d.template).trim()) { showErrors({ code: 'validation', errors: [{ field: 'template', message: 'Напишіть текст повідомлення.' }] }); return; }
      btn.disabled = true;
      fetchNow().then(function (r) {
        if (!r || !r.ok) return r || { ok: false, code: 'server', error: 'Не вдалося порахувати цифри — спробуйте ще раз.' };
        return P.mailProbe.call('sendPreview', { title: d.title, text: r.text });
      }).then(function (r) {
        btn.disabled = false; sendNote();
        if (r.ok && r.sent) P.toast('ok', 'Пробне — надіслано' + (r.channelName ? ' в #' + r.channelName : ''), 'Перевірте тестовий канал у Slack.');
        else if (r.ok) P.toast('warn', 'Пробне — у черзі', (r.warning ? r.warning + ' ' : '') + 'Надішлеться автоматично — натискати ще раз не треба.');
        else if (r.code === 'validation' && r.errors) showErrors(r);
        else P.toast('danger', 'Пробне не надіслано', r.error);
      });
    }

    return { locations: setLocations, update: update, send: send };
  }

  P.mlPreview = { mount: mount, slackHtml: slackHtml };
})(window);
