/**
 * JANスキャンメモの複数リスト保存形式と移行処理。
 * DOMやカメラに依存しないため、Node.jsでも検査できる。
 */
(() => {
  'use strict';

  const MAX_LISTS = 6;

  function makeId(prefix = 'id') {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function normalizeItem(item) {
    if (!item || !item.jan) return null;
    return {
      id: String(item.id || makeId('item')),
      jan: String(item.jan).replace(/\D/g, ''),
      addedAt: item.addedAt || new Date().toISOString(),
      memo: String(item.memo || '')
    };
  }

  function normalizeList(list, index) {
    const items = Array.isArray(list?.items) ? list.items.map(normalizeItem).filter(Boolean) : [];
    return {
      id: String(list?.id || makeId('list')),
      name: String(list?.name || `リスト${index + 1}`).trim().slice(0, 24) || `リスト${index + 1}`,
      items
    };
  }

  function createDefaultState(legacyItems = []) {
    return {
      version: 2,
      activeListId: 'list-1',
      nextListNumber: 2,
      lists: [{
        id: 'list-1',
        name: 'リスト1',
        items: Array.isArray(legacyItems) ? legacyItems.map(normalizeItem).filter(Boolean) : []
      }]
    };
  }

  function normalizeState(raw, legacyItems = []) {
    if (!raw || !Array.isArray(raw.lists) || raw.lists.length === 0) {
      return createDefaultState(legacyItems);
    }

    const lists = raw.lists.slice(0, MAX_LISTS).map(normalizeList);
    const activeListId = lists.some(list => list.id === raw.activeListId)
      ? raw.activeListId
      : lists[0].id;
    const nextListNumber = Math.max(
      Number(raw.nextListNumber) || lists.length + 1,
      lists.length + 1
    );

    return { version: 2, activeListId, nextListNumber, lists };
  }

  function getActiveList(state) {
    return state.lists.find(list => list.id === state.activeListId) || state.lists[0];
  }

  function addList(state) {
    if (state.lists.length >= MAX_LISTS) return null;
    const list = {
      id: makeId('list'),
      name: `リスト${state.nextListNumber}`,
      items: []
    };
    state.nextListNumber += 1;
    state.lists.push(list);
    state.activeListId = list.id;
    return list;
  }

  function renameList(state, listId, name) {
    const list = state.lists.find(item => item.id === listId);
    if (!list) return false;
    const normalized = String(name || '').trim().slice(0, 24);
    if (!normalized) return false;
    list.name = normalized;
    return true;
  }

  function deleteList(state, listId) {
    if (state.lists.length <= 1) return false;
    const index = state.lists.findIndex(list => list.id === listId);
    if (index < 0) return false;
    state.lists.splice(index, 1);
    if (state.activeListId === listId) {
      state.activeListId = state.lists[Math.min(index, state.lists.length - 1)].id;
    }
    return true;
  }

  globalThis.JanListStore = Object.freeze({
    MAX_LISTS,
    createDefaultState,
    normalizeState,
    getActiveList,
    addList,
    renameList,
    deleteList
  });
})();
