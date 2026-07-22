(() => {
  'use strict';

  const STORAGE_KEY = 'pesticide-search-load-all';
  const restoreFullData = sessionStorage.getItem(STORAGE_KEY) === '1';
  let worker;
  let readyPromise;
  let requestId = 0;
  const pending = new Map();

  function startFullDataWorker() {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise((resolve, reject) => {
      worker = new Worker('js/full-data-worker.js');
      worker.addEventListener('message', event => {
        const message = event.data || {};
        if (message.type === 'READY') {
          resolve(message);
          return;
        }
        const task = pending.get(message.id);
        if (!task) return;
        pending.delete(message.id);
        if (message.error) task.reject(new Error(message.error));
        else task.resolve(message);
      });
      worker.addEventListener('error', event => {
        for (const task of pending.values()) task.reject(new Error(event.message || '全農薬データの処理を継続できませんでした'));
        pending.clear();
        worker?.terminate();
        worker = undefined;
        readyPromise = undefined;
        reject(new Error(event.message || '全農薬データの処理を開始できませんでした'));
      }, { once: true });
    });
    return readyPromise;
  }

  async function query(type, name) {
    await startFullDataWorker();
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, type, name });
    });
  }

  globalThis.PesticideFullData = Object.freeze({
    load: startFullDataWorker,
    product: name => query('PRODUCT', name),
    crop: name => query('CROP', name)
  });

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
      await loadScript('js/app.js');
      await loadScript('js/multi-crop-ui.js');
      await loadScript('../../shared/js/pwa-client.js');

      const toggle = document.getElementById('showAllPesticides');
      if (!toggle) return;
      const originalOnChange = toggle.onchange;

      toggle.onchange = async event => {
        if (toggle.checked && !globalThis.PESTICIDE_FULL_DATA_LOADED) {
          sessionStorage.setItem(STORAGE_KEY, '1');
          toggle.disabled = true;
          const label = document.querySelector('.garden-toggle-label');
          if (label) label.textContent = '全農薬データを読み込んでいます…';
          try {
            const metadata = await startFullDataWorker();
            globalThis.PESTICIDE_FULL_DATA_LOADED = true;
            globalThis.PesticideApp?.activateFullData(metadata);
            if (label) label.textContent = 'すべての農薬を表示';
          } catch (error) {
            console.error(error);
            sessionStorage.removeItem(STORAGE_KEY);
            toggle.checked = false;
            if (label) label.textContent = '読み込み失敗（再試行）';
            const status = document.getElementById('directProductStatus');
            if (status) status.textContent = '全農薬データを読み込めませんでした。通信状態を確認して再試行してください。';
            return;
          } finally {
            toggle.disabled = false;
          }
        }

        if (!toggle.checked) sessionStorage.removeItem(STORAGE_KEY);
        await originalOnChange?.call(toggle, event);
      };

      if (restoreFullData) {
        toggle.checked = true;
        await toggle.onchange(new Event('change'));
      }
    } catch (error) {
      console.error(error);
      const status = document.getElementById('directProductStatus');
      if (status) status.textContent = '農薬データを読み込めませんでした。通信状態を確認して再読み込みしてください。';
    }
  }

  start();
})();
