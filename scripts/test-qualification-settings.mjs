import {
  DAILY_NEW_LIMIT_OPTIONS,
  DEFAULT_DAILY_NEW_LIMIT,
  deleteDailyNewLimit,
  loadDailyNewLimit,
  normalizeDailyNewLimit,
  saveDailyNewLimit
} from '../tools/qualification-study/js/settings.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const values = new Map();
const storage = {
  getItem(key) {
    return values.has(key) ? values.get(key) : null;
  },
  setItem(key, value) {
    values.set(key, String(value));
  },
  removeItem(key) {
    values.delete(key);
  }
};

assert(DAILY_NEW_LIMIT_OPTIONS.join(',') === '10,20,30,40,50', '新規問題数の選択肢が不正');
assert(DEFAULT_DAILY_NEW_LIMIT === 10, '初期値が10問でない');
assert(normalizeDailyNewLimit(30) === 30, '有効な設定値を受け付けられない');
assert(normalizeDailyNewLimit(25) === 10, '無効な設定値を初期値へ戻せない');

assert(loadDailyNewLimit('deck-a', storage) === 10, '未保存資格の初期値が不正');
saveDailyNewLimit('deck-a', 40, storage);
assert(loadDailyNewLimit('deck-a', storage) === 40, '資格別の設定値を保存できない');
assert(loadDailyNewLimit('deck-b', storage) === 10, '別資格へ設定値が漏れている');

saveDailyNewLimit('deck-a', 15, storage);
assert(loadDailyNewLimit('deck-a', storage) === 10, '無効値の保存時に初期値へ補正できない');
saveDailyNewLimit('deck-a', 50, storage);
deleteDailyNewLimit('deck-a', storage);
assert(loadDailyNewLimit('deck-a', storage) === 10, '資格削除時に設定値を消去できない');

const blockedStorage = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
  removeItem() { throw new Error('blocked'); }
};
assert(loadDailyNewLimit('deck-a', blockedStorage) === 10, '保存領域エラー時に初期値へ戻せない');
assert(saveDailyNewLimit('deck-a', 30, blockedStorage) === 30, '保存領域エラー時に選択値を利用できない');
deleteDailyNewLimit('deck-a', blockedStorage);

console.log('OK  新規問題数を10〜50問から10問刻みで選択');
console.log('OK  資格ごとの設定保存、初期値、異常値補正を確認');
