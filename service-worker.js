/*
 * 業務補助ツール Service Worker
 *
 * APP_VERSIONを変更すると、新しいキャッシュ領域が作られる。
 * 新版のService Workerは待機状態になり、画面側で利用者が更新を選ぶまで
 * 旧版を継続する。更新後は同じ接頭辞を持つ旧キャッシュを削除する。
 */
const APP_VERSION = '1.1.3-prototype';
const CACHE_PREFIX = 'komeri-tools';
const PRECACHE_NAME = `${CACHE_PREFIX}-precache-v${APP_VERSION}`;
const DATA_CACHE_NAME = `${CACHE_PREFIX}-data-v${APP_VERSION}`;

/*
 * 初回インストール時に保存する基本ファイル。
 * 約29 MBの農薬データは初回通信量を抑えるため任意保存とする。
 */
const CORE_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './version.json',
  './assets/site.css',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './shared/js/pwa-client.js',
  './shared/js/ean13.js',
  './tools/wood-cut-planner/',
  './tools/wood-cut-planner/index.html',
  './tools/wood-cut-planner/styles.css',
  './tools/wood-cut-planner/js/materials.js',
  './tools/wood-cut-planner/js/model.js',
  './tools/wood-cut-planner/js/material-jan.js',
  './tools/wood-cut-planner/js/jan-camera-ui.js',
  './tools/wood-cut-planner/js/jan-scanner.js',
  './tools/wood-cut-planner/js/app.js',
  './tools/wood-cut-planner/MATERIAL_DATA_FORMAT.md',
  './tools/jan-scanner/',
  './tools/jan-scanner/index.html',
  './tools/jan-scanner/styles.css',
  './tools/jan-scanner/js/app.js',
  './tools/jan-scanner/js/list-store.js',
  './tools/jan-scanner/js/scan-consensus.js',
  './tools/jan-scanner/js/barcode-renderer.js',
  './tools/hose-length/',
  './tools/hose-length/index.html',
  './tools/hose-length/styles.css',
  './tools/hose-length/js/app.js',
  './tools/power-tool-blade-search/',
  './tools/power-tool-blade-search/index.html',
  './tools/power-tool-blade-search/styles.css',
  './tools/power-tool-blade-search/js/app.js',
  './tools/power-tool-blade-search/js/data.js',
  './tools/chainsaw-parts-search/',
  './tools/chainsaw-parts-search/index.html',
  './tools/chainsaw-parts-search/styles.css',
  './tools/chainsaw-parts-search/js/app.js',
  './tools/chainsaw-parts-search/js/data.js',
  './tools/pesticide-search/',
  './tools/pesticide-search/index.html',
  './tools/pesticide-search/styles.css',
  './tools/pesticide-search/js/app.js',
  './tools/pesticide-search/js/multi-crop.js',
  './tools/pesticide-search/js/multi-crop-ui.js'
];

const OPTIONAL_ASSETS = [
  './tools/pesticide-search/js/data.js'
];

function absoluteUrl(path) {
  return new URL(path, self.registration.scope).href;
}

async function precacheCoreAssets() {
  const cache = await caches.open(PRECACHE_NAME);
  const requests = CORE_ASSETS.map(path => new Request(absoluteUrl(path), { cache: 'reload' }));
  await cache.addAll(requests);
}

self.addEventListener('install', event => {
  event.waitUntil(precacheCoreAssets());
  // skipWaiting()はここでは呼ばない。利用中の画面を勝手に新版へ切り替えないため。
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([PRECACHE_NAME, DATA_CACHE_NAME]);
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(name => name.startsWith(`${CACHE_PREFIX}-`) && !keep.has(name))
        .map(name => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

async function putIfCacheable(cache, request, response) {
  if (response && response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName, fallbackUrl = null) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    return await putIfCacheable(cache, request, response);
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const anyCached = await caches.match(request, { ignoreSearch: true });
    if (anyCached) return anyCached;
    if (fallbackUrl) return caches.match(absoluteUrl(fallbackUrl));
    throw new Error('Network and cache both unavailable');
  }
}

function cacheFirstWithRefresh(request, cacheName, fetchEvent) {
  // waitUntilはfetchイベントの処理中に同期的に登録する必要があるため、
  // 更新用Promiseを先に作り、キャッシュ確認とは別にイベントへ渡す。
  const refresh = (async () => {
    const cache = await caches.open(cacheName);
    const response = await fetch(request);
    return putIfCacheable(cache, request, response);
  })();
  fetchEvent.waitUntil(refresh.catch(() => null));

  return (async () => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    try {
      return await refresh;
    } catch {
      throw new Error('Resource unavailable');
    }
  })();
}

function isOptionalData(url) {
  return OPTIONAL_ASSETS.some(path => url.href === absoluteUrl(path));
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PRECACHE_NAME, './offline.html'));
    return;
  }

  if (url.href === absoluteUrl('./version.json') || url.href === absoluteUrl('./manifest.webmanifest')) {
    event.respondWith(networkFirst(request, PRECACHE_NAME));
    return;
  }

  const cacheName = isOptionalData(url) || /\/js\/data\.js$/.test(url.pathname)
    ? DATA_CACHE_NAME
    : PRECACHE_NAME;
  event.respondWith(cacheFirstWithRefresh(request, cacheName, event));
});

async function cacheOptionalAssets(port) {
  const cache = await caches.open(DATA_CACHE_NAME);
  for (let index = 0; index < OPTIONAL_ASSETS.length; index += 1) {
    const path = OPTIONAL_ASSETS[index];
    const request = new Request(absoluteUrl(path), { cache: 'reload' });
    const response = await fetch(request);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    await cache.put(request, response);
    port?.postMessage({
      type: 'CACHE_PROGRESS',
      completed: index + 1,
      total: OPTIONAL_ASSETS.length,
      path
    });
  }
  port?.postMessage({ type: 'CACHE_COMPLETE', version: APP_VERSION });
}

async function optionalCacheStatus() {
  const cache = await caches.open(DATA_CACHE_NAME);
  const states = await Promise.all(
    OPTIONAL_ASSETS.map(async path => Boolean(await cache.match(absoluteUrl(path), { ignoreSearch: true })))
  );
  return {
    complete: states.every(Boolean),
    cached: states.filter(Boolean).length,
    total: states.length,
    version: APP_VERSION
  };
}

self.addEventListener('message', event => {
  const message = event.data || {};
  const port = event.ports && event.ports[0];

  if (message.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (message.type === 'GET_VERSION') {
    port?.postMessage({ type: 'VERSION', version: APP_VERSION });
    return;
  }

  if (message.type === 'CHECK_OPTIONAL_CACHE') {
    event.waitUntil(
      optionalCacheStatus()
        .then(status => port?.postMessage({ type: 'OPTIONAL_CACHE_STATUS', ...status }))
        .catch(error => port?.postMessage({ type: 'ERROR', message: error.message }))
    );
    return;
  }

  if (message.type === 'CACHE_OPTIONAL') {
    event.waitUntil(
      cacheOptionalAssets(port)
        .catch(error => port?.postMessage({ type: 'ERROR', message: error.message }))
    );
  }
});
