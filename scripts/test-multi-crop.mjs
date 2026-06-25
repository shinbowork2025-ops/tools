/** 複数作物の共通農薬抽出と作物別グループ化を検査する。 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(join(root,'tools/pesticide-search/js/multi-crop.js'),'utf8');
const context=vm.createContext({globalThis:{}});
vm.runInContext(source,context);
const {findCommonProductNames,groupRowsByProductAndCrop}=context.globalThis.PesticideMultiCrop;

function row(crop,product,target){
  return ['1','殺虫剤','種類',product,'登録者',crop,target,'1000倍','','収穫前日まで','3回','散布','','3回'];
}
const rows=new Map([
  ['すいか',[row('すいか','ベニカA','アブラムシ'),row('すいか','オルトラン','アブラムシ'),row('すいか','ベニカA','ハダニ')]],
  ['なす',[row('なす','ベニカA','アブラムシ'),row('なす','ダニ剤','ハダニ')]],
  ['トマト',[row('トマト','ベニカA','コナジラミ'),row('トマト','オルトラン','アブラムシ')]]
]);
const getRows=crop=>rows.get(crop)||[];
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const two=findCommonProductNames(['すいか','なす'],getRows);
assert(two.length===1&&two[0]==='ベニカA','2作物の共通農薬が正しくない');
const three=findCommonProductNames(['すいか','なす','トマト'],getRows);
assert(three.length===1&&three[0]==='ベニカA','3作物の共通農薬が正しくない');
assert(findCommonProductNames(['すいか'],getRows).length===0,'1作物で共通検索が成立している');

const grouped=groupRowsByProductAndCrop(['すいか','なす'],two,getRows);
assert(grouped.get('ベニカA').get('すいか').length===2,'すいかの複数条件が保持されていない');
assert(grouped.get('ベニカA').get('なす').length===1,'なすの条件が保持されていない');

console.log('OK  同一農薬名の積集合を抽出');
console.log('OK  作物ごとの複数適用条件を保持');
