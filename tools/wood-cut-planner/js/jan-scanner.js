/** 木材用JANカメラスキャナー。 */
(()=>{
  'use strict';
  const api=globalThis.WoodMaterialJan,u=globalThis.WoodJanCameraUI;if(!api||!u)return;
  const C={i:180,n:5,g:700,d:600,w:1800,x:.05,y:.32,cw:.9,ch:.36,m:1280,mw:.28,mh:.07,a:1.5};
  const ctx=u.canvas.getContext('2d',{alpha:false}),K=globalThis.JanScanConsensus;
  const vote=K?new K({requiredHits:C.n,maxGapMs:C.g,minDurationMs:C.d,windowMs:C.w}):null;
  let stream=null,detector=null,on=false,timer=null;
  const feedback=text=>u.feedback.textContent=text;
  function stop(message='JANを読み取ると登録材料を自動選択します。'){
    on=false;clearTimeout(timer);vote?.reset();stream?.getTracks().forEach(t=>t.stop());stream=null;detector=null;u.video.srcObject=null;u.box.classList.remove('is-open');document.body.classList.remove('wood-camera-open');api.startButton.disabled=false;u.torch.disabled=true;u.torch.dataset.on='0';u.torch.textContent='ライト';feedback('バーコードを横向きにして枠内へ入れてください。');api.status(message);
  }
  async function cameraOptions(){try{const t=stream?.getVideoTracks()[0],c=t?.getCapabilities? t.getCapabilities():{};if(Array.isArray(c.focusMode)&&c.focusMode.includes('continuous'))await t.applyConstraints({advanced:[{focusMode:'continuous'}]});if(c.torch){u.torch.disabled=false;u.torch.dataset.on='0';}}catch{}}
  async function torch(){try{const t=stream?.getVideoTracks()[0],v=u.torch.dataset.on!=='1';if(!t)return;await t.applyConstraints({advanced:[{torch:v}]});u.torch.dataset.on=v?'1':'0';u.torch.textContent=v?'ライトOFF':'ライト';}catch{api.status('ライトを切り替えられません。');}}
  function capture(){const sw=u.video.videoWidth,sh=u.video.videoHeight;if(!sw||!sh)return false;const x=Math.round(sw*C.x),y=Math.round(sh*C.y),cw=Math.round(sw*C.cw),ch=Math.round(sh*C.ch),s=Math.min(1,C.m/cw),w=Math.max(1,Math.round(cw*s)),h=Math.max(1,Math.round(ch*s));if(u.canvas.width!==w||u.canvas.height!==h){u.canvas.width=w;u.canvas.height=h;}ctx.drawImage(u.video,x,y,cw,ch,0,0,w,h);return true;}
  function reliable(codes){const map=new Map();for(const code of codes){const jan=api.digits(code.rawValue),b=code.boundingBox;if(!['ean_13','ean_8'].includes(code.format)||!api.valid(jan)||!b)continue;const wr=b.width/u.canvas.width,hr=b.height/u.canvas.height,ar=b.width/Math.max(b.height,1);if(wr<C.mw||hr<C.mh||ar<C.a)continue;const area=b.width*b.height;if(!map.has(jan)||area>map.get(jan).area)map.set(jan,{jan,area});}return [...map.values()].sort((a,b)=>b.area-a.area);}
  const next=(delay=C.i)=>{clearTimeout(timer);if(on)timer=setTimeout(loop,delay);};
  async function loop(){if(!on||!detector)return;try{if(capture()){const found=reliable(await detector.detect(u.canvas));if(found.length>1){vote?.reset();feedback('複数のバーコードがあります。1つだけ枠内へ入れてください。');}else if(found.length){const jan=found[0].jan,r=vote?.observe(jan,Date.now())||{confirmed:true,hits:1,requiredHits:1};if(r.confirmed){stop(`${jan} を読み取りました。`);navigator.vibrate?.([100,40,100]);api.select(jan);return;}feedback(`読取確認中 ${r.hits}/${r.requiredHits}：${jan}`);}else{vote?.observe('',Date.now());feedback('バーコードを横向きにして枠内へ入れてください。');}}}catch(e){console.warn('木材JANを検出できませんでした。',e);}next();}
  async function start(){if(!('BarcodeDetector'in window)){api.status('カメラ読取に未対応です。JANを検索欄へ手入力し、Enterを押してください。');return;}try{const all=await BarcodeDetector.getSupportedFormats(),formats=['ean_13','ean_8'].filter(x=>all.includes(x));if(!formats.length)throw Error('EAN未対応');detector=new BarcodeDetector({formats});stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});u.video.srcObject=stream;await u.video.play();await cameraOptions();vote?.reset();u.box.classList.add('is-open');document.body.classList.add('wood-camera-open');api.startButton.disabled=true;on=true;api.status('木材商品のJANを読み取り中です。');next(0);}catch(e){console.error(e);stop('カメラを開始できません。HTTPS・カメラ権限・対応ブラウザを確認してください。');}}
  api.startButton.addEventListener('click',start);u.close.addEventListener('click',()=>stop());u.torch.addEventListener('click',torch);window.addEventListener('beforeunload',()=>stop());
})();
