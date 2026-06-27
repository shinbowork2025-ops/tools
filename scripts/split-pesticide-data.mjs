import fs from 'node:fs';
import vm from 'node:vm';

const sourcePath = 'tools/pesticide-search/js/data.js';
const gardenPath = 'tools/pesticide-search/js/garden-data.js';
const extraPath = 'tools/pesticide-search/js/all-data-extra.js';

const source = fs.readFileSync(sourcePath, 'utf8');
const rewritten = source.replace(/\b(?:const|let|var)\s+(DATA|GARDEN_PRODUCTS|PESTICIDE_PRODUCTS_RAW)\s*=/g, 'globalThis.$1 =');
const context = { globalThis: {} };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(rewritten, context, { filename: sourcePath, timeout: 120000 });

const { DATA, GARDEN_PRODUCTS, PESTICIDE_PRODUCTS_RAW } = context;
if (!Array.isArray(DATA) || !Array.isArray(GARDEN_PRODUCTS) || !PESTICIDE_PRODUCTS_RAW) {
  throw new Error('data.js から必要な定数を取得できませんでした');
}

const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
const gardenKeys = new Set(GARDEN_PRODUCTS.map(normalize));
const gardenRows = [];
const extraRows = [];
for (const row of DATA) {
  (gardenKeys.has(normalize(row?.[3])) ? gardenRows : extraRows).push(row);
}

const header = '/* scripts/split-pesticide-data.mjs により data.js から自動生成。直接編集しないこと。 */\n';
const gardenSource = `${header}const GARDEN_PRODUCTS=${JSON.stringify(GARDEN_PRODUCTS)};\nconst PESTICIDE_PRODUCTS_RAW=${JSON.stringify(PESTICIDE_PRODUCTS_RAW)};\nconst DATA=${JSON.stringify(gardenRows)};\n`;
const extraSource = `${header}DATA.push(...${JSON.stringify(extraRows)});\nglobalThis.PESTICIDE_FULL_DATA_LOADED=true;\n`;

fs.writeFileSync(gardenPath, gardenSource);
fs.writeFileSync(extraPath, extraSource);
console.log(`garden rows: ${gardenRows.length}`);
console.log(`extra rows: ${extraRows.length}`);
console.log(`garden bytes: ${Buffer.byteLength(gardenSource)}`);
console.log(`extra bytes: ${Buffer.byteLength(extraSource)}`);
