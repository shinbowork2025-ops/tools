import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(join(root, 'tools/wood-cut-planner/js/model.js'), 'utf8');
const context = vm.createContext({ globalThis: {}, Date, Math, JSON });
vm.runInContext(source, context);
const M = context.globalThis.WoodCutModel;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log('OK ', message);
};

const sheet = M.createSheet({ name: 'test', width: 910, height: 1820, thickness: 12 });
let result = M.applyCut(sheet.root, sheet.root.id, { from: 'left', offset: 600, kerf: 3, order: 1 });
assert(result.ok, '最初の縦カットを追加');
sheet.root = result.root;
let layout = M.layoutTree(sheet.root, sheet.width, sheet.height);
assert(layout.leaves.length === 2, '縦カット後は2領域');
assert(layout.leaves[0].width === 600 && layout.leaves[1].width === 307, '刃厚を反対側から差し引く');

const rightPiece = layout.leaves.find(piece => piece.x > 0);
result = M.applyCut(sheet.root, rightPiece.nodeId, { from: 'top', offset: 500, kerf: 3, order: 2 });
assert(result.ok, '右側へ横カットを追加');
sheet.root = result.root;
layout = M.layoutTree(sheet.root, sheet.width, sheet.height);
assert(layout.leaves.length === 3, '二本目のカット後は3領域');
assert(layout.leaves.some(piece => piece.width === 307 && piece.height === 500), '右上の307×500部材を生成');
assert(M.validateTree(sheet.root, sheet.width, sheet.height, 5).ok, 'カット木全体が有効');

const firstCut = layout.cuts.find(cut => cut.order === 1);
result = M.updateCut(sheet.root, firstCut.cutId, { offset: 550 });
assert(result.ok && M.validateTree(result.root, sheet.width, sheet.height, 5).ok, '先行カット線を動かして後続領域も再計算');
const moved = M.layoutTree(result.root, sheet.width, sheet.height);
assert(moved.leaves.some(piece => piece.width === 357 && piece.height === 500), '移動後の子領域寸法を更新');

const invalid = M.updateCut(sheet.root, firstCut.cutId, { offset: 905 });
assert(!M.validateTree(invalid.root, sheet.width, sheet.height, 5).ok, '後続カットが収まらない移動を拒否可能');
console.log('\n木材カット図モデルの検査が完了しました。');
