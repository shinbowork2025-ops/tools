(() => {
  'use strict';

  const STORAGE_KEY = 'pesticide-search-load-all';
  const shouldLoadAll = sessionStorage.getItem(STORAGE_KEY) === '1';

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`${src} の読み込みに失敗しました`));
      document.head.appendChild(script);
    });
  }

  async function start() {
    try {
      if (shouldLoadAll) await loadScript('js/all-data-extra.js');
      await loadScript('js/app.js');
      await loadScript('js/multi-crop-ui.js');
      await loadScript('../../shared/js/pwa-client.js');

      const toggle = document.getElementById('showAllPesticides');
      if (!toggle) return;
      const originalOnChange = toggle.onchange;

      toggle.onchange = event => {
        if (toggle.checked && !globalThis.PESTICIDE_FULL_DATA_LOADED) {
          sessionStorage.setItem(STORAGE_KEY, '1');
          toggle.disabled = true;
          const label = document.querySelector('.garden-toggle-label');
          if (label) label.textContent = '全農薬データを読み込んでいます…';
          location.reload();
          return;
        }
        if (!toggle.checked) sessionStorage.removeItem(STORAGE_KEY);
        originalOnChange?.call(toggle, event);
      };

      if (shouldLoadAll && globalThis.PESTICIDE_FULL_DATA_LOADED) {
        toggle.checked = true;
        originalOnChange?.call(toggle, new Event('change'));
      }
    } catch (error) {
      console.error(error);
      const status = document.getElementById('directProductStatus');
      if (status) status.textContent = '農薬データを読み込めませんでした。通信状態を確認して再読み込みしてください。';
    }
  }

  start();
})();
