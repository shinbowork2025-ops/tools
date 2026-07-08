/**
 * 発注数計算ツール。
 * 現在庫、前年30日販売数、任意の今年30日販売数から推奨発注数を即時算出する。
 */
(()=>{
  const config={leadTimeDays:21,reviewDays:7,historyDays:30};

  const currentStock=document.getElementById('currentStock');
  const lastYearSales=document.getElementById('lastYearSales');
  const currentYearSales=document.getElementById('currentYearSales');
  const orderQty=document.getElementById('orderQty');
  const statusText=document.getElementById('statusText');
  const compactOrderQty=document.getElementById('compactOrderQty');
  const compactStatus=document.getElementById('compactStatus');
  const factorValue=document.getElementById('factorValue');
  const demandValue=document.getElementById('demandValue');
  const safetyValue=document.getElementById('safetyValue');
  const targetValue=document.getElementById('targetValue');
  const message=document.getElementById('message');
  const resetButton=document.getElementById('resetButton');
  const inputs=[currentStock,lastYearSales,currentYearSales];

  const protectionDays=config.leadTimeDays+config.reviewDays;
  const numberFormat=new Intl.NumberFormat('ja-JP',{maximumFractionDigits:1});
  const integerFormat=new Intl.NumberFormat('ja-JP',{maximumFractionDigits:0});

  function digitsOnly(el){
    const next=el.value.replace(/\D/g,'');
    if(el.value!==next)el.value=next;
  }

  function readCount(el){
    if(el.value==='')return null;
    const value=Number(el.value);
    return Number.isFinite(value)?value:null;
  }

  function fmt(value,digits=1){
    return new Intl.NumberFormat('ja-JP',{maximumFractionDigits:digits}).format(value);
  }

  function fmtCount(value){
    return integerFormat.format(Math.max(0,Math.ceil(value)));
  }

  function selectSafetyFactor(projected30Sales){
    if(projected30Sales<=2)return 0;
    if(projected30Sales<=9)return 0.5;
    if(projected30Sales<=29)return 0.84;
    return 1.28;
  }

  function setEmpty(reason='現在庫と去年販売実績を入力してください'){
    orderQty.textContent='―';
    compactOrderQty.textContent='―';
    statusText.textContent='入力待ち';
    compactStatus.textContent='入力待ち';
    factorValue.textContent='―';
    demandValue.textContent='―';
    safetyValue.textContent='―';
    targetValue.textContent='―';
    message.textContent=reason;
  }

  function calculate(){
    inputs.forEach(digitsOnly);
    message.textContent='';

    const stock=readCount(currentStock);
    const lastYear=readCount(lastYearSales);
    const currentYear=readCount(currentYearSales);

    if(stock===null||lastYear===null){
      setEmpty();
      return;
    }

    const hasCurrentYear=currentYear!==null;
    const canUseTrend=hasCurrentYear&&lastYear>0;
    const trendFactor=canUseTrend?currentYear/lastYear:1;
    const lastYearDaily=lastYear/config.historyDays;
    const adjustedDaily=lastYearDaily*trendFactor;
    const demand=adjustedDaily*protectionDays;
    const projected30=lastYear*trendFactor;
    const safetyFactor=selectSafetyFactor(projected30);
    const safetyStock=Math.ceil(safetyFactor*Math.sqrt(Math.max(0,demand)));
    const targetStock=Math.ceil(demand+safetyStock);
    const recommended=Math.max(0,targetStock-stock);
    const leadTimeDemand=adjustedDaily*config.leadTimeDays;
    const stockDays=adjustedDaily>0?stock/adjustedDaily:Infinity;
    const status=selectStatus({lastYear,hasCurrentYear,trendFactor,projected30,recommended,stock,leadTimeDemand,stockDays});

    orderQty.textContent=fmtCount(recommended);
    compactOrderQty.textContent=fmtCount(recommended);
    statusText.textContent=status;
    compactStatus.textContent=status;
    factorValue.textContent=fmt(trendFactor,2);
    demandValue.textContent=`${numberFormat.format(demand)}個`;
    safetyValue.textContent=`${integerFormat.format(safetyStock)}個`;
    targetValue.textContent=`${integerFormat.format(targetStock)}個`;

    if(hasCurrentYear&&!canUseTrend){
      message.textContent='去年販売実績が0のため、今年販売実績は補正に使わず計算しています。';
    }else if(!hasCurrentYear){
      message.textContent='今年販売実績が未入力のため、補正係数1.00で計算しています。';
    }
  }

  function selectStatus({lastYear,hasCurrentYear,trendFactor,projected30,recommended,stock,leadTimeDemand,stockDays}){
    if(lastYear===0)return '前年販売なし';
    if(stock<leadTimeDemand&&recommended>0)return '欠品注意';
    if(recommended===0&&stockDays>=45)return '在庫多め';
    if(recommended===0)return '在庫十分';
    if(hasCurrentYear&&trendFactor>=1.3)return '今年販売増加';
    if(hasCurrentYear&&trendFactor<=0.7)return '今年販売減少';
    if(projected30<=2)return '低回転品';
    return '標準発注';
  }

  function scrollFocusedPanel(el){
    document.body.classList.add('input-active');
    const panel=el.closest('.panel');
    if(!panel)return;
    window.setTimeout(()=>{
      panel.scrollIntoView({block:'center',behavior:'smooth'});
    },80);
  }

  inputs.forEach(el=>{
    el.addEventListener('input',calculate);
    el.addEventListener('focus',()=>scrollFocusedPanel(el));
    el.addEventListener('blur',()=>{
      window.setTimeout(()=>{
        if(!inputs.includes(document.activeElement))document.body.classList.remove('input-active');
      },50);
    });
  });

  resetButton.addEventListener('click',()=>{
    inputs.forEach(el=>{el.value='';});
    setEmpty('入力をリセットしました。');
    currentStock.focus();
  });

  setEmpty('現在庫と去年販売実績を入力してください。');
})();
