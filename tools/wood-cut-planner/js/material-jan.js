/** 木材JANと材料マスタの連携。 */
(()=>{
  'use strict';
  const KEY='komeriWoodCustomMaterialsV1';
  const materials=Array.isArray(window.WOOD_MATERIALS)?window.WOOD_MATERIALS:[];
  let pending='';
  const digits=value=>String(value||'').replace(/\D/g,'');
  const valid=raw=>{
    const jan=digits(raw);if(jan.length!==8&&jan.length!==13)return false;
    const values=jan.split('').map(Number),check=values.pop();let sum=0;
    if(jan.length===13)values.forEach((n,i)=>sum+=n*(i%2?3:1));
    else values.forEach((n,i)=>sum+=n*(i%2?1:3));
    return (10-sum%10)%10===check;
  };
  const esc=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const load=()=>{try{const data=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(data)?data.filter(x=>x&&x.id&&x.name&&valid(x.jan)&&Number(x.width)>0&&Number(x.height)>0):[];}catch{return [];}};
  const save=item=>{const data=load(),i=data.findIndex(x=>x.jan===item.jan);if(i>=0)data[i]=item;else data.push(item);localStorage.setItem(KEY,JSON.stringify(data));};
  const known=new Set(materials.map(x=>digits(x.jan)).filter(Boolean));
  for(const item of load())if(!known.has(item.jan)){materials.push(item);known.add(item.jan);}

  const panel=document.getElementById('addSheetPanel'),heading=panel?.querySelector('.section-heading');
  if(!panel||!heading)return;
  const style=document.createElement('style');
  style.textContent='.material-scan-row{display:grid;grid-template-columns:minmax(180px,auto) minmax(0,1fr);gap:10px;align-items:center;margin-top:10px;padding:9px;border:1px solid #c8d9e7;border-radius:10px;background:#fff}.material-scan-state{margin:0;color:#40505d;font-size:.72rem;line-height:1.5}@media(max-width:680px){.material-scan-row{grid-template-columns:1fr}.material-scan-row button{width:100%}}';
  document.head.append(style);
  const row=document.createElement('div');row.className='material-scan-row';
  row.innerHTML='<button id="woodScanButton" type="button" class="primary">JANをカメラで読む</button><p id="materialScanState" class="material-scan-state" aria-live="polite">JANを読み取ると登録材料を自動選択します。未登録品は寸法入力後、この端末へ記憶できます。</p>';
  heading.insertAdjacentElement('afterend',row);
  const dom={panel,start:row.querySelector('button'),status:row.querySelector('p'),filter:document.getElementById('materialFilter'),select:document.getElementById('materialSelect'),label:document.getElementById('sheetLabelInput'),width:document.getElementById('sheetWidthInput'),height:document.getElementById('sheetHeightInput'),thickness:document.getElementById('sheetThicknessInput'),add:document.getElementById('addSheetButton')};
  const status=text=>dom.status.textContent=text;
  const find=jan=>materials.find(x=>digits(x.jan)===jan)||null;
  function populate(query,id=''){
    const q=String(query||'').trim().toLowerCase();
    const list=materials.filter(x=>!q||[x.jan,x.name,x.category,x.note].join(' ').toLowerCase().includes(q));
    dom.select.innerHTML='<option value="">手入力</option>'+list.map(x=>`<option value="${esc(x.id)}">${esc(x.jan?`${x.jan} / ${x.name}`:x.name)}</option>`).join('');
    if(list.some(x=>x.id===id))dom.select.value=id;
  }
  function select(raw){
    const jan=digits(raw);if(!valid(jan)){status('JANの桁数またはチェックデジットが一致しません。');return false;}
    const item=find(jan);dom.filter.value=jan;dom.filter.dispatchEvent(new Event('input',{bubbles:true}));
    if(item){pending='';dom.select.value=item.id;dom.select.dispatchEvent(new Event('change',{bubbles:true}));status(`JAN ${jan}：${item.name} を選択しました。`);panel.scrollIntoView({behavior:'smooth',block:'start'});return true;}
    pending=jan;dom.select.value='';status(`JAN ${jan} は未登録です。商品名と寸法を入力し「この材料を追加」を押すと、この端末へ記憶します。`);dom.label.focus();return false;
  }
  function store(){
    if(!pending||dom.select.value)return;
    const width=Number(dom.width.value),height=Number(dom.height.value),thickness=dom.thickness.value===''?'':Number(dom.thickness.value),name=dom.label.value.trim();
    if(!name||!Number.isFinite(width)||width<=0||!Number.isFinite(height)||height<=0)return;
    const item={id:`custom-${pending}`,jan:pending,name,width,height,thickness,category:'端末登録',note:'現場でJAN読取後にこの端末へ登録',verifiedAt:new Date().toISOString().slice(0,10)};
    const i=materials.findIndex(x=>digits(x.jan)===pending);if(i>=0)materials[i]=item;else materials.push(item);save(item);populate(pending,item.id);status(`JAN ${pending} と寸法をこの端末へ記憶しました。`);pending='';
  }
  dom.add.addEventListener('click',store,true);
  dom.filter.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();select(dom.filter.value);}});
  dom.filter.addEventListener('input',()=>{if(pending&&digits(dom.filter.value)!==pending)pending='';});
  globalThis.WoodMaterialJan={select,valid,digits,status,startButton:dom.start};
})();
