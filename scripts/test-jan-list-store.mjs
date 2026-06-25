/** JAN複数リストの移行、作成上限、名前変更、削除を検査する。 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(join(root, 'tools/jan-scanner/js/list-store.js'), 'utf8');
const context = vm.createContext({ globalThis: {}, Date, Math });
vm.runInContext(source, context);
const store = context.globalThis.JanListStore;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const migrated = store.normalizeState(null, [{ jan: '4901234567894', addedAt: '2026-06-26T00:00:00Z' }]);
assert(migrated.lists.length === 1, '旧データが1リストへ移行されない');
assert(migrated.lists[0].name === 'リスト1', '移行後の既定名が違う');
assert(migrated.lists[0].items[0].memo === '', '移行項目にメモ欄がない');

for (let index = 0; index < 5; index += 1) {
  assert(store.addList(migrated), '6個までリストを作成できない');
}
assert(migrated.lists.length === 6, 'リスト数が6にならない');
assert(store.addList(migrated) === null, '7個目のリストを作成できてしまう');

const active = store.getActiveList(migrated);
assert(store.renameList(migrated, active.id, '売場確認'), 'タブ名を変更できない');
assert(store.getActiveList(migrated).name === '売場確認', '変更したタブ名が保持されない');
assert(store.deleteList(migrated, active.id), 'リストを削除できない');
assert(migrated.lists.length === 5, '削除後のリスト数が違う');

console.log('OK  旧単一リストをリスト1へ移行');
console.log('OK  最大6リスト、名前変更、削除を確認');
