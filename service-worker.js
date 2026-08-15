importScripts('./sw-assets.js');

const APP_VERSION = '1.8.1';
const CACHE_PREFIX = 'komeri-tools';
const PRECACHE_NAME = `${CACHE_PREFIX}-precache-v${APP_VERSION}`;
const DATA_CACHE_NAME = `${CACHE_PREFIX}-data-v${APP_VERSION}`;
const TOOL_CACHE_PREFIX = `${CACHE_PREFIX}-tool-`;

const CORE_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './feedback/',
  './feedback/index.html',
  './manifest.webmanifest',
  './version.json',
  './sw-assets.js',
  './assets/site.css',
  './assets/site.js',
  './assets/share.js',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './shared/css/tool-guide.css',
  './shared/js/jan-code.js',
  './shared/js/ean13.js',
  './shared/js/pwa-client.js',
  './shared/js/tool-guide.js'
];

const TOOL_ASSETS = self.KOMERI_TOOL_ASSETS || {};
const OPTIONAL_ASSETS = self.KOMERI_OPTIONAL_ASSETS || {};
const absoluteUrl = path => new URL(path, self.registration.scope).href;
const coreUrls = new Set(CORE_ASSETS.map(path => {
  const url = new URL(absoluteUrl(path));
  return `${url.origin}${url.pathname}`;
}));

function toolCacheName(toolId) {
  return `${TOOL_CACHE_PREFIX}${toolId}-v${APP_VERSION}`;
}

function getToolAssets(toolId) {
  const assets = TOOL_ASSETS[toolId];
  if (!Array.isArray(assets)) throw new Error(`未登録のツールです: ${toolId}`);
  return assets;
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PRECACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS.map(path => new Request(absoluteUrl(path), { cache: 'reload' }))))
  );
});

self.addEventListener('activate', event => {
  const currentCaches = new Set([
    PRECACHE_NAME,
    DATA_CACHE_NAME,
    ...Object.keys(TOOL_ASSETS).map(toolCacheName)
  ]);

  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names
          .filter(name => name.startsWith(`${CACHE_PREFIX}-`) && !currentCaches.has(name))
          .map(name => caches.delete(name))
      ))
      .then(() => self.registration.navigationPreload?.enable().catch(() => {}))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const found = await cache.match(request, { ignoreSearch: true });
  if (found) return found;

  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
  }
  return response;
}

async function savedOrNetwork(request) {
  const found = await caches.match(request, { ignoreSearch: true });
  if (found) return found;
  return fetch(request);
}

async function networkFirstNavigation(request, fallback, preloadResponse) {
  try {
    const preloaded = await Promise.resolve(preloadResponse).catch(() => undefined);
    return preloaded || await fetch(request);
  } catch {
    return await caches.match(request, { ignoreSearch: true })
      || caches.match(absoluteUrl(fallback));
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request, './offline.html', event.preloadResponse));
    return;
  }

  const resourceKey = `${url.origin}${url.pathname}`;
  if (coreUrls.has(resourceKey)) {
    event.respondWith(cacheFirst(request, PRECACHE_NAME));
    return;
  }

  // ツール本体と大型データは、明示保存済みならキャッシュを使い、
  // 未保存ならオンライン取得だけを行って自動保存しない。
  event.respondWith(savedOrNetwork(request));
});

async function cacheStatus(cacheName, paths) {
  const cache = await caches.open(cacheName);
  const states = await Promise.all(
    paths.map(path => cache.match(absoluteUrl(path), { ignoreSearch: true }).then(Boolean))
  );
  return {
    complete: paths.length > 0 && states.every(Boolean),
    cached: states.filter(Boolean).length,
    total: paths.length,
    version: APP_VERSION
  };
}

async function toolStatus(toolId) {
  const assets = getToolAssets(toolId);
  return {
    toolId,
    ...await cacheStatus(toolCacheName(toolId), assets)
  };
}

async function cachePaths(cacheName, paths, port, progressType) {
  const cache = await caches.open(cacheName);
  let cursor = 0;
  let completed = 0;

  async function cacheNext() {
    while (cursor < paths.length) {
      const index = cursor++;
      const path = paths[index];
      const response = await fetch(new Request(absoluteUrl(path), { cache: 'reload' }));
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
      await cache.put(absoluteUrl(path), response);
      completed += 1;
      port?.postMessage({
        type: progressType,
        completed,
        total: paths.length,
        path
      });
    }
  }

  const concurrency = Math.min(4, paths.length);
  await Promise.all(Array.from({ length: concurrency }, cacheNext));
}

async function cacheTool(toolId, port) {
  const assets = getToolAssets(toolId);
  const cacheName = toolCacheName(toolId);
  const previous = await cacheStatus(cacheName, assets);

  try {
    await cachePaths(cacheName, assets, port, 'TOOL_CACHE_PROGRESS');
  } catch (error) {
    if (!previous.complete) await caches.delete(cacheName);
    throw error;
  }

  port?.postMessage({
    type: 'TOOL_CACHE_COMPLETE',
    toolId,
    version: APP_VERSION,
    total: assets.length
  });
}

function getOptionalPaths(groupId) {
  const paths = OPTIONAL_ASSETS[groupId];
  if (!Array.isArray(paths)) throw new Error(`未登録の追加データです: ${groupId}`);
  return paths;
}

async function optionalStatus(groupId) {
  const paths = getOptionalPaths(groupId);
  return {
    groupId,
    ...await cacheStatus(DATA_CACHE_NAME, paths)
  };
}

async function cacheOptional(groupId, port) {
  const paths = getOptionalPaths(groupId);
  await cachePaths(DATA_CACHE_NAME, paths, port, 'OPTIONAL_CACHE_PROGRESS');
  port?.postMessage({
    type: 'OPTIONAL_CACHE_COMPLETE',
    groupId,
    version: APP_VERSION,
    total: paths.length
  });
}

self.addEventListener('message', event => {
  const message = event.data || {};
  const port = event.ports?.[0];

  if (message.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (message.type === 'GET_VERSION') {
    port?.postMessage({ type: 'VERSION', version: APP_VERSION });
    return;
  }

  if (message.type === 'CHECK_TOOL_CACHE') {
    event.waitUntil(
      toolStatus(message.toolId)
        .then(value => port?.postMessage({ type: 'TOOL_CACHE_STATUS', ...value }))
        .catch(error => port?.postMessage({ type: 'ERROR', message: error.message }))
    );
    return;
  }

  if (message.type === 'CACHE_TOOL') {
    event.waitUntil(
      cacheTool(message.toolId, port)
        .catch(error => port?.postMessage({ type: 'ERROR', message: error.message }))
    );
    return;
  }

  const groupId = message.groupId || 'pesticide-all-data';
  if (message.type === 'CHECK_OPTIONAL_CACHE') {
    event.waitUntil(
      optionalStatus(groupId)
        .then(value => port?.postMessage({ type: 'OPTIONAL_CACHE_STATUS', ...value }))
        .catch(error => port?.postMessage({ type: 'ERROR', message: error.message }))
    );
    return;
  }

  if (message.type === 'CACHE_OPTIONAL') {
    event.waitUntil(
      cacheOptional(groupId, port)
        .catch(error => port?.postMessage({ type: 'ERROR', message: error.message }))
    );
  }
});
