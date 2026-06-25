/**
 * ホースリールの重量からホース長を計算する画面制御。
 * 入力値の単位変換と検証を一か所に集約する。
 */
(()=>{
  // DOM参照
const totalHundreds=document.getElementById('totalHundreds');
  const drumTens=document.getElementById('drumTens');
  const weightPerMeter=document.getElementById('weightPerMeter');
  const lengthResult=document.getElementById('lengthResult');
  const resultDetail=document.getElementById('resultDetail');
  const message=document.getElementById('message');
  const resetButton=document.getElementById('resetButton');
  // 入力補助
function digitsOnly(el){el.value=el.value.replace(/\D/g,'')}
  function fmt(v,d=2){return new Intl.NumberFormat('ja-JP',{maximumFractionDigits:d}).format(v)}
  function clearResult(t='3項目を入力してください'){lengthResult.textContent='―';resultDetail.textContent=t}
  // 単位をグラムへ換算して長さを算出
function calculate(){
    message.textContent='';
    if(totalHundreds.value===''||drumTens.value===''||weightPerMeter.value===''){clearResult();return}
    const totalG=Number(totalHundreds.value)*100;
    const drumG=Number(drumTens.value)*10;
    const perMeter=Number(weightPerMeter.value);
    if(!Number.isFinite(totalG)||!Number.isFinite(drumG)||!Number.isFinite(perMeter)||perMeter<=0){clearResult('入力値を確認してください');message.textContent='1m重量は0より大きい数値を入力してください。';return}
    if(totalG<drumG){clearResult('重量を確認してください');message.textContent='全重量はドラム重量以上にしてください。';return}
    const hoseWeightG=totalG-drumG;
    const lengthM=hoseWeightG/perMeter;
    lengthResult.textContent=fmt(lengthM);
    resultDetail.textContent=`ホース重量 ${fmt(hoseWeightG,1)} g`;
  }
  // イベント登録
const inputs=[totalHundreds,drumTens,weightPerMeter];

  function clearSelectedInput(el){
    if(el.value!==''){
      el.value='';
      calculate();
    }
  }

  inputs.forEach(el=>{
    el.addEventListener('pointerdown',()=>clearSelectedInput(el));
    el.addEventListener('focus',()=>clearSelectedInput(el));
  });

  [totalHundreds,drumTens].forEach(el=>el.addEventListener('input',()=>{digitsOnly(el);calculate()}));
  weightPerMeter.addEventListener('input',calculate);
  resetButton.addEventListener('click',()=>{totalHundreds.value='';drumTens.value='';weightPerMeter.value='';message.textContent='';clearResult();totalHundreds.focus()});
})();
