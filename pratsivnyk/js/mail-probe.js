(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var URL = 'https://zptcvjylemhwolhihukl.supabase.co/functions/v1/mail-api';
  var KEY = 'audit-mail:code';   // не під префіксом демо-даних: «Скинути тестові дані» код не стирає

  function code() { try { return root.localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  function setCode(c) { try { root.localStorage.setItem(KEY, String(c || '')); } catch (e) { /* без памʼяті — питатимемо щоразу */ } }
  function clearCode() { try { root.localStorage.removeItem(KEY); } catch (e) { /* нічого */ } }

  function call(action, payload, tryCode) {
    var c = tryCode || code();
    var ctl = root.AbortController ? new root.AbortController() : null;
    var timer = root.setTimeout(function () { if (ctl) ctl.abort(); }, 25000);
    return root.fetch(URL, {
      method: 'POST', cache: 'no-store', signal: ctl ? ctl.signal : undefined,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({}, payload || {}, { action: action, code: c }))
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, code: 'server', error: 'Сервер розсилки відповів незрозуміло (' + r.status + ').' }; });
    }, function () {
      return { ok: false, code: 'offline', error: 'Немає звʼязку з сервером розсилки. Перевірте інтернет і спробуйте ще раз.' };
    }).then(function (r) {
      root.clearTimeout(timer);
      if (r && r.code === 'auth' && !tryCode) clearCode();
      return r || { ok: false, code: 'server', error: 'Порожня відповідь сервера розсилки.' };
    });
  }

  P.mailProbe = { call: call, code: code, setCode: setCode, clearCode: clearCode, has: function () { return !!code(); } };
})(typeof window !== 'undefined' ? window : globalThis);
