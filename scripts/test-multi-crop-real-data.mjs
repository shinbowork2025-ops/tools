/** 実際の農薬データで「すいか × なす」の共通農薬検索を検査する。 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const dataSource=await readFile(join(root,'tools/pesticide-search/js/data.js'),'utf8');
const helperSource=await readFile(join(root,'tools/pesticide-search/js/multi-crop.js'),'utf8');
const context=vm.createContext({globalThis:{}});
vm.runInContext(`${dataSource}\nglobalThis.__DATA=DATA;globalThis.__GARDEN_PRODUCTS=GARDEN_PRODUCTS;`,context,{timeout:120000});
vm.runInContext(helperSource,context);

const DATA=context.globalThis.__DATA;
const gardenKeys=new Set(context.globalThis.__GARDEN_PRODUCTS.map(value=>String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'')));
const baseCrop=value=>String(value||'').split(/[（(]/)[0].trim();
const byCrop=new Map();
for(const row of DATA){
  const crop=baseCrop(row[5]);
  if(!byCrop.has(crop))byCrop.set(crop,[]);
  byCrop.get(crop).push(row);
}
const rowsForCrop=crop=>(byCrop.get(crop)||[]).filter(row=>gardenKeys.has(String(row[3]||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'')));
const {findCommonProductNames,groupRowsByProductAndCrop}=context.globalThis.PesticideMultiCrop;
const crops=['すいか','なす'];
const names=findCommonProductNames(crops,rowsForCrop);
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

assert(names.length>0,'すいかとなすの共通農薬が0件');
assert(names.includes('ベニカAスプレー'),'期待するベニカAスプレーが共通農薬に含まれない');
const grouped=groupRowsByProductAndCrop(crops,names,rowsForCrop);
for(const name of names){
  assert(grouped.get(name)?.get('すいか')?.length>0,`${name}のすいか条件がない`);
  assert(grouped.get(name)?.get('なす')?.length>0,`${name}のなす条件がない`);
}

console.log(`OK  すいか × なす：園芸グループ共通農薬 ${names.length}品`);
console.log('OK  ベニカAスプレーを含み、全製品に両作物の条件あり');
