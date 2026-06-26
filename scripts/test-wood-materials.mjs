import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(join(root,'tools/wood-cut-planner/js/materials.js'),'utf8');
const context={window:{}};
vm.createContext(context);
vm.runInContext(source,context);
const materials=context.window.WOOD_MATERIALS;

function assert(condition,message){
  if(!condition)throw new Error(message);
  console.log(`OK  ${message}`);
}

function validJan(jan){
  const value=String(jan||'').replace(/\D/g,'');
  if(value.length!==8&&value.length!==13)return false;
  const digits=value.split('').map(Number);
  const check=digits.pop();
  let sum=0;
  if(value.length===13)digits.forEach((digit,index)=>sum+=digit*(index%2===0?1:3));
  else digits.forEach((digit,index)=>sum+=digit*(index%2===0?3:1));
  return (10-(sum%10))%10===check;
}

assert(Array.isArray(materials),'材料マスタを配列として読める');
const withJan=materials.filter(item=>item.jan);
assert(withJan.length>=7,'確認済みJAN材料を7件以上収録');
assert(new Set(withJan.map(item=>item.jan)).size===withJan.length,'JANに重複がない');
for(const item of withJan){
  assert(validJan(item.jan),`${item.jan} のチェックデジットが有効`);
  assert(Number(item.width)>0&&Number(item.height)>0,`${item.name} の寸法が有効`);
}
const known=materials.find(item=>item.jan==='0400115001938');
assert(known?.width===45&&known?.height===1820&&known?.thickness===18,'杉胴縁のJANから45×1820・厚さ18 mmを取得');

const html=await readFile(join(root,'tools/wood-cut-planner/index.html'),'utf8');
const materialJan=await readFile(join(root,'tools/wood-cut-planner/js/material-jan.js'),'utf8');
const cameraUi=await readFile(join(root,'tools/wood-cut-planner/js/jan-camera-ui.js'),'utf8');
const scanner=await readFile(join(root,'tools/wood-cut-planner/js/jan-scanner.js'),'utf8');
assert(html.includes('../jan-scanner/js/scan-consensus.js'),'既存の連続読取判定を再利用');
assert(html.includes('js/material-jan.js'),'木材JANと材料マスタの連携処理を読込');
assert(html.includes('js/jan-camera-ui.js'),'木材JANカメラUIを読込');
assert(html.includes('js/jan-scanner.js'),'木材専用スキャナーを読込');
for(const id of ['woodScanButton','woodCameraBox','woodVideo','woodScanCanvas','materialScanState']){
  assert((materialJan+cameraUi+scanner).includes(id),`木材JAN拡張が ${id} を生成`);
}
assert(materialJan.includes('komeriWoodCustomMaterialsV1'),'未登録JANを端末内へ保存');
console.log('\n木材JANマスタ・画面検査が完了しました。');
