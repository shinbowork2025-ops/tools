/**
 * 発注数計算ツールv2のIndexedDB永続化層。
 *
 * DB名は他ツールのストレージと衝突しない「order-calculator」。
 * 業務数値(販売実績・マザー発注数など)はすべてここに保存し、
 * コードやリポジトリへは一切焼き込まない。外部送信もしない。
 */
(() => {
  'use strict';

  const DB_NAME = 'order-calculator';
  const DB_VERSION = 1;
  const STORES = Object.freeze(['settings', 'items', 'records']);

  let databasePromise = null;

  function openDatabase() {
    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings');
        }
        if (!database.objectStoreNames.contains('items')) {
          database.createObjectStore('items', { keyPath: 'jan' });
        }
        if (!database.objectStoreNames.contains('records')) {
          const records = database.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
          records.createIndex('jan', 'jan');
          records.createIndex('week', 'week');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDBを開けません'));
      request.onblocked = () => reject(new Error('別のタブがデータベースを使用中です'));
    });
    databasePromise.catch(() => { databasePromise = null; });
    return databasePromise;
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function withStore(storeName, mode, action) {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, mode);
    const result = await action(transaction.objectStore(storeName));
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('保存を中断しました'));
    });
  }

  /** 設定を1オブジェクトとして読む。未保存項目は呼び出し側で既定値と統合する。 */
  function getSettings() {
    return withStore('settings', 'readonly', store => requestToPromise(store.get('settings')));
  }

  function saveSettings(settings) {
    return withStore('settings', 'readwrite', store => requestToPromise(store.put(settings, 'settings')));
  }

  function getItem(jan) {
    return withStore('items', 'readonly', store => requestToPromise(store.get(jan)));
  }

  function putItem(item) {
    return withStore('items', 'readwrite', store => requestToPromise(store.put(item)));
  }

  function getAllItems() {
    return withStore('items', 'readonly', store => requestToPromise(store.getAll()));
  }

  function addRecord(record) {
    return withStore('records', 'readwrite', store => requestToPromise(store.add(record)));
  }

  function putRecord(record) {
    return withStore('records', 'readwrite', store => requestToPromise(store.put(record)));
  }

  function getRecord(id) {
    return withStore('records', 'readonly', store => requestToPromise(store.get(id)));
  }

  function getAllRecords() {
    return withStore('records', 'readonly', store => requestToPromise(store.getAll()));
  }

  /** 全データの一括エクスポート。呼び出し側で機密警告を表示すること。 */
  async function exportAll() {
    const [settings, items, records] = await Promise.all([
      getSettings(),
      getAllItems(),
      getAllRecords()
    ]);
    return {
      exportedAt: new Date().toISOString(),
      dbVersion: DB_VERSION,
      settings: settings || null,
      items,
      records
    };
  }

  /** エクスポートJSONの取り込み。既存データへ上書き統合する。 */
  async function importAll(data) {
    if (!data || typeof data !== 'object') throw new Error('取り込むデータの形式が不正です');
    const items = Array.isArray(data.items) ? data.items : [];
    const records = Array.isArray(data.records) ? data.records : [];

    if (data.settings) await saveSettings(data.settings);
    await withStore('items', 'readwrite', store => {
      items.forEach(item => { if (item?.jan) store.put(item); });
    });
    await withStore('records', 'readwrite', store => {
      records.forEach(record => {
        if (!record || typeof record !== 'object') return;
        // idを引き継ぐと既存レコードを上書きするため、新規採番で追加する。
        const { id, ...rest } = record;
        store.add(rest);
      });
    });
    return { items: items.length, records: records.length };
  }

  async function clearAll() {
    const database = await openDatabase();
    const transaction = database.transaction(STORES, 'readwrite');
    STORES.forEach(storeName => transaction.objectStore(storeName).clear());
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  globalThis.OrderDb = Object.freeze({
    getSettings,
    saveSettings,
    getItem,
    putItem,
    getAllItems,
    addRecord,
    putRecord,
    getRecord,
    getAllRecords,
    exportAll,
    importAll,
    clearAll
  });
})();
