(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var MONTHS = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
  var MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  var LV = ['fix', 'repair', 'scrap'];
  var LV_WORD = { fix: 'неправильно зроблене', repair: 'пошкоджене', scrap: 'зламане' };
  var CAUSE_NAMES = { tool: 'Проблеми з інструментом чи оснасткою', material: 'Проблеми з матеріалом', organization: 'Проблеми в організації роботи',
    skill: 'Працівник не знав, як зробити правильно', discipline: 'Працівник знав, як правильно, але не зробив', other: 'Інша причина' };
  var CAUSE_IDS = { 'Інструмент чи оснастка': 'tool', 'Матеріал': 'material', 'Організація роботи': 'organization',
    'Не знав / не вміє': 'skill', 'Знав, але не зробив': 'discipline', 'Інше': 'other' };
  function h() { return P.sr.h; }
  function esc(s) { return P.esc(s); }

  var K = P.mgr = {
    LV: LV,
    n: function (n, one, few, many) { return h().num(n) + ' ' + P.plural(n, one, few, many); },
    dn: function (n) { return n + ' ' + P.plural(n, 'день', 'дні', 'днів'); },
    day: function (d) { return +d.slice(8, 10) + ' ' + MONTHS_GEN[+d.slice(5, 7) - 1]; },
    span: function (from, to) { return from === to ? K.day(from) : K.day(from) + ' — ' + K.day(to); },
    dcap: function (d) { var s = h().dayLong(d); return s.charAt(0).toUpperCase() + s.slice(1); },
    month: function (m) { return MONTHS[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4); },
    brak: function (rejected, pct) { return h().num(rejected) + ' шт · ' + h().pct(pct); },
    was: function (prev, cur) { return 'було <b>' + prev + '</b> → стало <b>' + cur + '</b>'; },
    causeName: function (id, label) {
      var k = CAUSE_NAMES[id] ? id : CAUSE_IDS[label] || CAUSE_IDS[id];
      return k ? CAUSE_NAMES[k] : (label || id || '—');
    },
    total: function (o) { return (o.fix || 0) + (o.repair || 0) + (o.scrap || 0); },
    levels: function (o, height) { return h().legend(o) + h().stack(o, height || 12); },
    rate: function (pct, crit) {
      if (pct == null) return '<span class="mgr-dim">—</span>';
      return pct > crit ? '<b class="mgr-over">' + h().pct(pct) + '</b><span class="mgr-over-note">понад ' + crit + '%</span>' : '<b>' + h().pct(pct) + '</b>';
    },
    topLine: function (list) {
      if (!list || !list.length) return '<span class="mgr-dim">браку немає</span>';
      return list.map(function (t) { return '<span class="lvl lvl--' + esc(t.level) + '">' + esc(t.name) + ' · ' + h().num(t.pieces) + ' шт</span>'; }).join('');
    },
    search: function (act, value, placeholder) {
      return '<div class="search mgr-search">' + P.ic('search', 'icon') + '<input class="input" data-input="' + act + '" value="' + esc(value) +
        '" placeholder="' + esc(placeholder) + '" aria-label="' + esc(placeholder) + '" style="padding-left:46px"></div>';
    },
    pills: function (act, opts, cur, label) {
      return '<span class="pills" role="group" aria-label="' + esc(label) + '">' + opts.map(function (o) {
        var on = o[0] === cur;
        return '<button class="pill' + (on ? ' pill--on' : '') + '" type="button" data-act="' + act + '" data-v="' + esc(o[0]) + '" aria-pressed="' + on + '">' + esc(o[1]) + '</button>';
      }).join('') + '</span>';
    },
    select: function (act, opts, cur, label) {
      return '<select class="input mgr-select" data-change="' + act + '" aria-label="' + esc(label) + '">' + opts.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (o[0] === cur ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
    },
    asOf: function (iso) { return 'станом на ' + P.fmt.time(iso); },
    help: function (key) { return P.help ? P.help.btn(key) : ''; },
    kpi: function (val, label, key) {
      return '<div class="kpi"><span class="kpi__val">' + esc(val) + '</span><span class="kpi__label">' + esc(label) + (key ? K.help(key) : '') + '</span></div>';
    },
    seg: function (act, opts, cur, label) {
      var multi = Array.isArray(cur);
      return '<div class="seg seg--sm mgr-seg" role="group" aria-label="' + esc(label) + '">' + opts.map(function (o) {
        var on = multi ? cur.indexOf(o[0]) >= 0 : o[0] === cur;
        return '<button class="seg__btn' + (on ? ' seg__btn--on' : '') + '" type="button" data-act="' + act + '" data-v="' + esc(o[0]) + '" aria-pressed="' + on + '">' +
          (multi && on ? P.ic('check', 'ui-icon--sm') : '') + esc(o[1]) + '</button>';
      }).join('') + '</div>';
    },
    chips: function (act, opts, cur, label) {
      return '<div class="chips mgr-chips" role="group" aria-label="' + esc(label) + '">' + opts.map(function (o) {
        var on = o[0] === cur;
        return '<button class="chip-pick' + (on ? ' chip-pick--on' : '') + '" type="button" data-act="' + act + '" data-v="' + esc(o[0]) + '" aria-pressed="' + on + '">' + esc(o[1]) + '</button>';
      }).join('') + '</div>';
    },
    pickLocs: function (cur, id, many) {
      if (!many) return [id];
      var i = cur.indexOf(id), next = cur.slice();
      if (i < 0) next.push(id); else if (next.length > 1) next.splice(i, 1);
      return next;
    },
    locBar: function (prefix, locations, sel, many) {
      return '<div class="mgr-pick"><span class="mgr-pick__l">' + (many ? 'Локації для порівняння' : 'Локація') + K.help('mgr.locSwitch') + '</span>' +
        K.seg(prefix + '-loc', locations.map(function (l) { return [l.id, l.name]; }), many ? sel : sel[0], 'Локація') +
        '<button class="chip-pick mgr-cmpbtn' + (many ? ' chip-pick--on' : '') + '" type="button" data-act="' + prefix + '-many" aria-pressed="' + many + '">' +
        P.ic(many ? 'check' : 'add', 'ui-icon--sm') + 'Порівняти кілька</button></div>';
    },

    cell: function (v) {
      if (v == null) return '';
      if (typeof v === 'number') return String(v).replace('.', ',');
      return String(v);
    },
    monthRows: function (r) {
      var l = r.location, withKd = !!(r.hasKd && r.kd);
      var head = ['Локація', 'Відділ', 'Аудитів', 'Перевірено, шт', 'Брак, шт', 'Брак, %'].concat(LV.map(function (k) { return LV_WORD[k] + ', шт'; }),
        ['Найчастіші види браку']);
      if (withKd) head = head.concat(['Коригуючі дії: відкрито', 'Коригуючі дії: впроваджено']);
      function row(dep, o, kd) {
        var x = [l.name, dep, o.audits, o.checked, o.rejected, o.pct].concat(LV.map(function (k) { return o.levels[k]; }),
          [(o.top || []).map(function (t) { return t.name + ' (' + t.pieces + ' шт)'; }).join(', ')]);
        if (withKd) x = x.concat(kd ? [kd.opened, kd.implemented] : ['', '']);
        return x;
      }
      var rows = [head, row('Усі відділи', l, r.kd && r.kd.period)];
      l.depts.forEach(function (d) { rows.push(row(d.name + (d.active ? '' : ' (вимкнено)'), d, d.kd)); });
      return rows;
    },
    csv: function (rows) {
      return '﻿' + rows.map(function (r) {
        return r.map(function (v) {
          var s = K.cell(v);
          return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(';');
      }).join('\r\n') + '\r\n';
    },
    tsv: function (rows) {
      return rows.map(function (r) { return r.map(function (v) { return K.cell(v).replace(/[\t\r\n]+/g, ' '); }).join('\t'); }).join('\n');
    },
    download: function (name, text, type) {
      var doc = root.document, blob = new root.Blob([text], { type: type || 'text/csv;charset=utf-8' });
      var url = root.URL.createObjectURL(blob), a = doc.createElement('a');
      a.href = url; a.download = name; doc.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { root.URL.revokeObjectURL(url); }, 1000);
    },
    copy: function (text) {
      function fallback() {
        var doc = root.document, t = doc.createElement('textarea'), ok = false;
        t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
        doc.body.appendChild(t); t.select();
        try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
        t.remove();
        return ok;
      }
      var nav = root.navigator;
      if (nav && nav.clipboard && nav.clipboard.writeText) return nav.clipboard.writeText(text).then(function () { return true; }, fallback);
      return Promise.resolve(fallback());
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = K;
})(typeof window !== 'undefined' ? window : globalThis);
