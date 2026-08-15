export const DAILY_NEW_LIMIT_OPTIONS = Object.freeze([10, 20, 30, 40, 50]);
export const DEFAULT_DAILY_NEW_LIMIT = DAILY_NEW_LIMIT_OPTIONS[0];

const STORAGE_PREFIX = 'komeri-qualification-study:daily-new-limit:';

function getStorage(storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function storageKey(deckId) {
  return `${STORAGE_PREFIX}${encodeURIComponent(String(deckId || ''))}`;
}

export function normalizeDailyNewLimit(value) {
  const parsed = Number(value);
  return DAILY_NEW_LIMIT_OPTIONS.includes(parsed) ? parsed : DEFAULT_DAILY_NEW_LIMIT;
}

export function loadDailyNewLimit(deckId, storage = null) {
  if (!deckId) return DEFAULT_DAILY_NEW_LIMIT;
  const target = getStorage(storage);
  if (!target) return DEFAULT_DAILY_NEW_LIMIT;
  try {
    return normalizeDailyNewLimit(target.getItem(storageKey(deckId)));
  } catch {
    return DEFAULT_DAILY_NEW_LIMIT;
  }
}

export function saveDailyNewLimit(deckId, value, storage = null) {
  const normalized = normalizeDailyNewLimit(value);
  if (!deckId) return normalized;
  const target = getStorage(storage);
  if (!target) return normalized;
  try {
    target.setItem(storageKey(deckId), String(normalized));
  } catch {
    // 保存不可でも現在の画面では選択値を利用する。
  }
  return normalized;
}

export function deleteDailyNewLimit(deckId, storage = null) {
  if (!deckId) return;
  const target = getStorage(storage);
  if (!target) return;
  try {
    target.removeItem(storageKey(deckId));
  } catch {
    // 保存領域へアクセスできない場合は何もしない。
  }
}
