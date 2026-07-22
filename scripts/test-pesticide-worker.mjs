import fs from 'node:fs';
import vm from 'node:vm';

const workerPath = 'tools/pesticide-search/js/full-data-worker.js';
const dataPath = 'tools/pesticide-search/js/data.js';
const workerSource = fs.readFileSync(workerPath, 'utf8');
const dataSource = fs.readFileSync(dataPath, 'utf8');
const posted = [];
let messageHandler;

const context = {
  console,
  addEventListener(type, handler) {
    if (type === 'message') messageHandler = handler;
  },
  postMessage(message) {
    posted.push(message);
  }
};
context.self = context;
context.importScripts = source => {
  if (source !== 'data.js') throw new Error(`予期しないWorker依存: ${source}`);
  vm.runInContext(dataSource, context, { filename: dataPath, timeout: 120000 });
};
vm.createContext(context);
vm.runInContext(workerSource, context, { filename: workerPath, timeout: 120000 });

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`OK  ${message}`);
}

const ready = posted.shift();
assert(ready?.type === 'READY', 'Workerが索引準備完了を通知');
assert(ready.productCounts.length > 100, '全農薬の商品索引を作成');
assert(ready.cropCounts.length > 100, '全農薬の作物索引を作成');
assert(typeof messageHandler === 'function', 'Workerの検索受付を登録');

const [productName, productCount] = ready.productCounts.find(([, count]) => count > 1);
messageHandler({ data: { id: 1, type: 'PRODUCT', name: productName } });
const productResult = posted.shift();
assert(productResult.id === 1 && productResult.rows.length === productCount, '農薬名検索が該当行だけを返す');
assert(productResult.rows.every(row => row[3] === productName), '農薬名検索結果を分離');

const [cropName, cropCount] = ready.cropCounts.find(([, count]) => count > 1);
messageHandler({ data: { id: 2, type: 'CROP', name: cropName } });
const cropResult = posted.shift();
assert(cropResult.id === 2 && cropResult.rows.length === cropCount, '作物検索が該当行だけを返す');

console.log('全農薬Workerの分離索引・検索検査に成功');
