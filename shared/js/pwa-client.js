(() => {
  'use strict';

  const scriptUrl = document.currentScript?.src;
  if (!scriptUrl) return;

  const rootUrl = new URL('../../', scriptUrl);
  const serviceWorkerUrl = new URL('service-worker.js', rootUrl);
  const versionUrl = new URL('version.json', rootUrl);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  const elements = {
    panel: document.querySelector('.pwa-panel'),
    actions: document.querySelector('.pwa-panel .pwa-actions'),
    installButton: document.getElementById('pwaInstallButton'),
    offlineButton: document.getElementById('pwaOfflineButton'),
    status: document.getElementById('pwaStatus'),
    version: document.getElementById('pwaVersion')
  };

  const TERMINAL_MESSAGE_TYPES = new Set([
    'TOOL_CACHE_STATUS',
    'TOOL_CACHE_COMPLETE',
    'OPTIONAL_CACHE_STATUS',
    'OPTIONAL_CACHE_COMPLETE'
  ]);

  let installPrompt = null;
  let registration = null;
  let reloadingForUpdate = false;
  let updateRequested = false;

  function setStatus(message, kind = '') {
    if (!elements.status) return;
    elements.status.textContent = message;
    elements.status.dataset.kind = kind;
  }

  function setButtonBusy(button, busy, label) {
    if (!button) return;
    button.disabled = busy;
    if (label) button.textContent = label;
  }

  function loadHomeEnhancements() {
    if (!document.querySelector('.tool-grid') || document.querySelector('script[data-home-enhancements]')) return;
    const script = document.createElement('script');
    script.src = new URL('assets/site.js', rootUrl).href;
    script.defer = true;
    script.dataset.homeEnhancements = '1';
    document.head.appendChild(script);
  }

  function loadToolGuidance() {
    if (!/\/tools\/[^/]+\/?(?:index\.html)?$/.test(location.pathname)) return;

    if (!document.querySelector('link[data-tool-guidance]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = new URL('shared/css/tool-guide.css', rootUrl).href;
      link.dataset.toolGuidance = '1';
      document.head.appendChild(link);
    }

    if (!document.querySelector('script[data-tool-guidance]')) {
      const script = document.createElement('script');
      script.src = new URL('shared/js/tool-guide.js', rootUrl).href;
      script.dataset.toolGuidance = '1';
      document.head.appendChild(script);
    }
  }

  function prepareStandalonePanel() {
    if (!isStandalone || !elements.panel) return;
    elements.panel.classList.add('is-standalone');
    if (elements.offlineButton) elements.offlineButton.textContent = '農薬全件データを追加保存';
    if (elements.actions) elements.actions.hidden = true;
    if (elements.version?.parentElement?.firstChild) {
      elements.version.parentElement.firstChild.textContent = 'バージョン情報：';
    }
    elements.panel.parentElement?.append(elements.panel);
  }

  function setOptionalDownloadVisibility(complete) {
    if (!isStandalone || !elements.offlineButton) return;
    elements.offlineButton.hidden = complete;
    if (elements.actions) elements.actions.hidden = complete;
  }

  async function loadVersion() {
    try {
      const response = await fetch(versionUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      const metadata = await response.json();
      if (elements.version) elements.version.textContent = metadata.version;
      return metadata.version;
    } catch {
      if (elements.version) elements.version.textContent = '不明';
      return null;
    }
  }

  function createUpdateBanner(worker, version) {
    if (document.getElementById('pwaUpdateNotice')) return;

    const notice = document.createElement('aside');
    notice.id = 'pwaUpdateNotice';
    notice.setAttribute('role', 'status');
    notice.innerHTML = `
      <div class="pwa-update-message">
        <strong>新版${version ? ` ${version}` : ''}を利用できます</strong>
        <span>更新後、オフラインで使うツールは一覧から再保存してください。</span>
      </div>
      <button type="button" class="pwa-update-button">更新する</button>
      <button type="button" class="pwa-update-close" aria-label="後で更新する">×</button>
    `;

    const style = document.createElement('style');
    style.id = 'pwaUpdateStyle';
    style.textContent = `
      #pwaUpdateNotice{position:fixed;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));z-index:10000;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:10px;width:min(calc(100% - 24px),720px);margin:auto;padding:12px 12px 12px 14px;border:1px solid #9bb7cf;border-radius:12px;background:#fff;color:#17202a;box-shadow:0 8px 28px rgba(23,32,42,.22);font-family:"BIZ UDPGothic","Yu Gothic UI",Meiryo,sans-serif}.pwa-update-message{display:grid;gap:2px;min-width:0}.pwa-update-message strong{font-size:.9rem}.pwa-update-message span{font-size:.74rem;color:#5f6b76}.pwa-update-button,.pwa-update-close{min-height:40px;border-radius:8px;font:inherit;font-weight:700;cursor:pointer}.pwa-update-button{padding:7px 12px;border:1px solid #1f5f95;background:#1f5f95;color:#fff}.pwa-update-close{width:40px;padding:0;border:1px solid #d8e0e7;background:#fff;color:#5f6b76}@media(max-width:520px){#pwaUpdateNotice{grid-template-columns:1fr auto}.pwa-update-button{grid-row:2;grid-column:1/-1}.pwa-update-close{grid-row:1;grid-column:2}.pwa-update-message{grid-row:1;grid-column:1}}
    `;
    document.head.appendChild(style);
    document.body.appendChild(notice);

    notice.querySelector('.pwa-update-button').addEventListener('click', () => {
      const button = notice.querySelector('.pwa-update-button');
      setButtonBusy(button, true, '更新中…');
      updateRequested = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
    notice.querySelector('.pwa-update-close').addEventListener('click', () => notice.remove());
  }

  function requestWorkerVersion(worker) {
    return new Promise(resolve => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 1500);
      channel.port1.onmessage = event => {
        clearTimeout(timer);
        resolve(event.data?.version || null);
      };
      worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    });
  }

  async function offerUpdate(worker) {
    const version = await requestWorkerVersion(worker);
    createUpdateBanner(worker, version);
  }

  function watchRegistration(reg) {
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);

    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          offerUpdate(installing);
        }
      });
    });

    window.setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }

  function sendWorkerMessage(message, onMessage) {
    return navigator.serviceWorker.ready.then(reg => new Promise((resolve, reject) => {
      const worker = reg.active || navigator.serviceWorker.controller;
      if (!worker) {
        reject(new Error('Service Workerが有効ではありません。ページを再読み込みしてください。'));
        return;
      }

      const channel = new MessageChannel();
      channel.port1.onmessage = event => {
        const response = event.data || {};
        onMessage?.(response);
        if (response.type === 'ERROR') {
          reject(new Error(response.message || '処理に失敗しました。'));
          return;
        }
        if (TERMINAL_MESSAGE_TYPES.has(response.type)) resolve(response);
      };
      worker.postMessage(message, [channel.port2]);
    }));
  }

  async function persistStorage() {
    if (!navigator.storage?.persist) return false;
    return navigator.storage.persist().catch(() => false);
  }

  const pwaApi = Object.freeze({
    getToolCacheStatus(toolId) {
      return sendWorkerMessage({ type: 'CHECK_TOOL_CACHE', toolId });
    },
    async cacheTool(toolId, onProgress) {
      const result = await sendWorkerMessage({ type: 'CACHE_TOOL', toolId }, onProgress);
      await persistStorage();
      return result;
    }
  });

  globalThis.KomeriPwa = pwaApi;
  document.dispatchEvent(new CustomEvent('komeri-pwa-api-ready'));

  async function refreshOptionalStatus() {
    if (!elements.offlineButton) return;
    try {
      const result = await sendWorkerMessage({
        type: 'CHECK_OPTIONAL_CACHE',
        groupId: 'pesticide-all-data'
      });
      if (result.complete) {
        elements.offlineButton.textContent = '農薬全件データ保存済み';
        elements.offlineButton.disabled = true;
        setOptionalDownloadVisibility(true);
        setStatus('農薬の全件データを保存済みです。各ツールの保存状態は一覧で確認できます。', 'success');
      } else {
        elements.offlineButton.textContent = isStandalone
          ? '農薬全件データを追加保存'
          : '農薬全件データを保存';
        elements.offlineButton.disabled = false;
        setOptionalDownloadVisibility(false);
        setStatus('利用するツールは一覧の「オフライン保存」から個別に保存できます。');
      }
    } catch {
      // 初回登録直後など、まだ制御が始まっていない場合は次回表示時に再判定する。
    }
  }

  async function cacheOptionalData() {
    if (!elements.offlineButton) return;
    setButtonBusy(elements.offlineButton, true, '保存中…');
    setStatus('農薬の全件データを保存しています。通信を切らずにこの画面を開いてください。');

    try {
      await sendWorkerMessage({
        type: 'CACHE_OPTIONAL',
        groupId: 'pesticide-all-data'
      }, message => {
        if (message.type === 'OPTIONAL_CACHE_PROGRESS') {
          elements.offlineButton.textContent = `保存中（${message.completed}/${message.total}）`;
          setStatus(`農薬の全件データを保存中（${message.completed}/${message.total}）`);
        }
      });

      await persistStorage();
      elements.offlineButton.textContent = '農薬全件データ保存済み';
      elements.offlineButton.disabled = true;
      setOptionalDownloadVisibility(true);
      setStatus('約29 MBの農薬全件データを保存しました。農薬検索本体も一覧から保存してください。', 'success');
    } catch (error) {
      elements.offlineButton.textContent = isStandalone
        ? '農薬全件データを追加保存'
        : '農薬全件データを保存';
      elements.offlineButton.disabled = false;
      setOptionalDownloadVisibility(false);
      setStatus(`保存できませんでした：${error.message}`, 'error');
    }
  }

  function setupInstallPrompt() {
    if (isStandalone) {
      if (elements.installButton) elements.installButton.hidden = true;
      setStatus('アプリとしてインストール済みです。利用するツールは一覧から個別に保存できます。');
    }

    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      installPrompt = event;
      if (elements.installButton && !isStandalone) elements.installButton.hidden = false;
    });

    window.addEventListener('appinstalled', () => {
      installPrompt = null;
      if (elements.installButton) elements.installButton.hidden = true;
      setStatus('端末へのインストールが完了しました。利用するツールを一覧から保存してください。', 'success');
    });

    elements.installButton?.addEventListener('click', async () => {
      if (!installPrompt) {
        setStatus('ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選んでください。');
        return;
      }
      await installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      elements.installButton.hidden = true;
    });
  }

  function setupConnectionStatus() {
    const update = () => {
      document.documentElement.dataset.connection = navigator.onLine ? 'online' : 'offline';
      if (!navigator.onLine) setStatus('現在オフラインです。保存済みのツールを利用できます。');
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      setStatus('このブラウザはPWAのオフライン機能に対応していません。', 'error');
      return;
    }

    try {
      registration = await navigator.serviceWorker.register(serviceWorkerUrl, {
        scope: rootUrl.pathname,
        updateViaCache: 'none'
      });
      watchRegistration(registration);
      await navigator.serviceWorker.ready;
      await refreshOptionalStatus();
      document.dispatchEvent(new CustomEvent('komeri-pwa-worker-ready'));
    } catch (error) {
      setStatus(`PWA機能を開始できませんでした：${error.message}`, 'error');
    }
  }

  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (!updateRequested || reloadingForUpdate) return;
    reloadingForUpdate = true;
    window.location.reload();
  });

  loadHomeEnhancements();
  loadToolGuidance();
  prepareStandalonePanel();
  elements.offlineButton?.addEventListener('click', cacheOptionalData);
  setupInstallPrompt();
  setupConnectionStatus();
  loadVersion();
  registerServiceWorker();
})();

(() => {
  'use strict';

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (!isStandalone || typeof screen.orientation?.lock !== 'function') return;

  const lockPortrait = () => screen.orientation.lock('portrait-primary').catch(() => {
    // 非対応端末ではmanifest.webmanifestのorientation指定に任せる。
  });

  lockPortrait();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') lockPortrait();
  });
})();
