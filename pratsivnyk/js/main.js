(function (root) {
  'use strict';
  function start() {
    if (!root.P || !root.P.backend) {
      root.document.getElementById('app').innerHTML = '<div class="ui-state ui-state--error" role="alert"><p class="ui-state__title">Сайт не запустився</p>' +
        '<p class="ui-state__text">Не підключено сервер даних. Оновіть сторінку.</p></div>';
      return;
    }
    root.P.shell.start();
  }
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
