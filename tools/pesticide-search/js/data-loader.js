(() => {
  'use strict';

  const STORAGE_KEY = 'pesticide-search-load-all';
  const shouldLoadAll = sessionStorage.getItem(STORAGE_KEY) === '1';

  if (shouldLoadAll && !globalThis.PESTICIDE_FULL_DATA_LOADED) {
    document.write('<script src="js/all-data-extra.js" defer><\/script>');
  }

  window.addEventListener('DOMContentLoaded', () => {
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
  });
})();
