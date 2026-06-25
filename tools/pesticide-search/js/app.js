/**
 * 農薬適用検索の画面制御。
 * 大容量の登録データは data.js に分離し、このファイルでは索引作成と表示を担当する。
 */
// 商品名の正規化と商品情報の組み立て
function normProductKey(s){return (s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');}
const GARDEN_PRODUCT_KEYS=new Set(GARDEN_PRODUCTS.map(normProductKey));

function komeriSearchUrl(keyword){return `https://www.komeri.com/shop/goods/search.aspx?display=D&keyword=${encodeURIComponent(keyword||'')}&search=x&x=0&y=0`;}


const PESTICIDE_PRODUCTS=new Map(Object.entries(PESTICIDE_PRODUCTS_RAW).map(([k,v])=>[normProductKey(k),v]));
function pesticideVariants(name){return PESTICIDE_PRODUCTS.get(normProductKey(name))||[];}
function pesticideCommerceHtml(name){
  const variants=pesticideVariants(name);
  if(!variants.length){
    const u=komeriSearchUrl(name);
    return `<div class="commerce-box"><div class="commerce-title">コメリ商品情報</div><div class="variant-row"><div class="variant-name">${esc(name)}</div><div class="jan-code">JANコード：未確認</div><a class="product-link search" href="${esc(u)}" target="_blank" rel="noopener noreferrer">コメリで商品名を検索</a><div class="unverified">登録名に一致するコメリ商品ページを確認できていません。</div></div></div>`;
  }
  return `<div class="commerce-box"><div class="commerce-title">コメリ商品情報（容量・包装別）</div><div class="variant-list">${variants.map(v=>{const u=v.url||komeriSearchUrl(`${name} ${v.size}`);return `<div class="variant-row"><div class="variant-name">${esc(name)} ${esc(v.size)}</div>${v.note?`<div class="variant-note">${esc(v.note)}</div>`:''}<div class="jan-code">JANコード：${esc(v.jan||'未確認')}</div>${janBarcodeToggleHtml(v.jan)}<a class="product-link${v.url?'':' search'}" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${v.url?'コメリ商品ページを開く':'コメリで容量を検索'}</a>${!v.url||v.jan==='未確認'?'<div class="unverified">直販ページまたはJANコードの一部を確認できていません。</div>':''}</div>`;}).join('')}</div></div>`;
}




// 選択状態とDOM参照
let selectedCrop=null, selectedPest=null, selectedProduct=null, visibleLimit=200, showAllPesticides=false;
const directProductSearch=document.getElementById('directProductSearch');
const directProductChips=document.getElementById('directProductChips');
const directProductStatus=document.getElementById('directProductStatus');
const cropSearch=document.getElementById('cropSearch');
const pestSearch=document.getElementById('pestSearch');
const productSearch=document.getElementById('productSearch');
const showAllPesticidesInput=document.getElementById('showAllPesticides');
const cropChips=document.getElementById('cropChips');
const pestChips=document.getElementById('pestChips');
const byCrop=new Map();
const byProduct=new Map();
const productCounts=new Map();
function baseCrop(s){ return (s||'').split(/[（(]/)[0].trim(); }
function norm(s){ return (s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,''); }
function kanaFold(s){
  return String(s||'').replace(/[ぁ-ゖ]/g,ch=>String.fromCharCode(ch.charCodeAt(0)+0x60));
}
function productSearchKey(s){
  return kanaFold(String(s||'').normalize('NFKC').toLowerCase())
    .replace(/[\s・･_＿\-‐‑–—―ー()（）［］【】「」『』\[\]{}]/g,'')
    .replace(/[®™]/g,'');
}
function isGardenRow(r){return GARDEN_PRODUCT_KEYS.has(normProductKey(r[3]));}
function allowedRows(rows){return showAllPesticides?rows:rows.filter(isGardenRow);}
function rowsForCrop(c){return allowedRows(byCrop.get(c)||[]);}
function rowsForProduct(name){return allowedRows(byProduct.get(name)||[]);}
function activeCrops(){return allCrops.filter(c=>rowsForCrop(c).length);}
function activeProducts(){return showAllPesticides?allProducts:gardenProducts;}
function productRowCount(name){
  const counts=productCounts.get(name);
  return counts?(showAllPesticides?counts.all:counts.garden):0;
}
function esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
DATA.forEach(r=>{
  const c=baseCrop(r[5]);
  if(!byCrop.has(c))byCrop.set(c,[]);
  byCrop.get(c).push(r);
  const p=r[3];
  if(!byProduct.has(p))byProduct.set(p,[]);
  byProduct.get(p).push(r);
  const counts=productCounts.get(p)||{all:0,garden:0};
  counts.all++;
  if(isGardenRow(r))counts.garden++;
  productCounts.set(p,counts);
});
const allCrops=[...byCrop.keys()].sort((a,b)=>byCrop.get(b).length-byCrop.get(a).length||a.localeCompare(b,'ja'));
const allProducts=[...byProduct.keys()].sort((a,b)=>productCounts.get(b).all-productCounts.get(a).all||a.localeCompare(b,'ja'));
const gardenProducts=allProducts.filter(name=>productCounts.get(name).garden>0);
const productSearchKeys=new Map(allProducts.map(name=>[name,productSearchKey(name)]));
let directProductMatches=[];

/*
  同等品候補は、同じ作物・対象について、農薬の種類と適用条件が全て一致する別登録だけを結ぶ。
  現データには製剤中の含有濃度列がないため、「種類だけが同じ」製品は対象にしない。
*/
function equivalentSignature(r){
  return JSON.stringify([r[2],baseCrop(r[5]),r[6],r[7],r[8],r[9],r[10],r[11],r[12],r[13]]);
}
const equivalentRowsBySignature=new Map();
DATA.forEach(r=>{
  const key=equivalentSignature(r);
  if(!equivalentRowsBySignature.has(key))equivalentRowsBySignature.set(key,[]);
  equivalentRowsBySignature.get(key).push(r);
});
function equivalentProducts(r){
  const source=equivalentRowsBySignature.get(equivalentSignature(r))||[];
  const seen=new Set(), list=[];
  for(const x of source){
    const key=`${x[0]}\u0000${normProductKey(x[3])}`;
    if(x[0]===r[0]||normProductKey(x[3])===normProductKey(r[3])||seen.has(key))continue;
    seen.add(key); list.push(x);
  }
  return list.sort((a,b)=>Number(isGardenRow(b))-Number(isGardenRow(a))||a[3].localeCompare(b[3],'ja'));
}
function equivalentProductsHtml(r){
  const matches=equivalentProducts(r);
  if(!matches.length)return '';
  const shown=matches.slice(0,24);
  return `<details class="equivalent-box"><summary>同じ成分・濃度の可能性が高い別商品（${matches.length}件）</summary><div class="equivalent-note">登録データ内で、農薬の種類、作物、対象、希釈・使用量、使用時期、回数、方法、総使用回数が一致する別登録です。製品ラベルも確認してください。</div><div class="equivalent-links">${shown.map(x=>`<button type="button" class="equivalent-link" data-product-name="${esc(x[3])}" onclick="showEquivalentProduct(this.dataset.productName)">${esc(x[3])}${isGardenRow(x)?'（園芸）':''}</button>`).join('')}</div>${matches.length>shown.length?`<div class="equivalent-note">ほか ${matches.length-shown.length}件</div>`:''}</details>`;
}
function showEquivalentProduct(name){
  showAllPesticides=true;
  showAllPesticidesInput.checked=true;
  selectedProduct=name||null;
  selectedCrop=null;
  selectedPest=null;
  directProductSearch.value=name||'';
  cropSearch.value='';
  pestSearch.value='';
  productSearch.value='';
  visibleLimit=200;
  renderAll();
  scrollToSearchResults();
}
// 農薬名から直接検索
function findDirectProductMatches(filter=''){
  const source=activeProducts();
  const q=productSearchKey(filter);
  if(!q)return source.slice(0,showAllPesticides?40:80);
  const matches=[];
  for(const name of source){
    const key=productSearchKeys.get(name)||'';
    const pos=key.indexOf(q);
    if(pos<0)continue;
    const score=key===q?0:key.startsWith(q)?1:2+Math.min(pos,99)/100;
    matches.push({name,score,count:productRowCount(name)});
  }
  matches.sort((a,b)=>a.score-b.score||b.count-a.count||a.name.localeCompare(b.name,'ja'));
  return matches.map(x=>x.name);
}
function scrollToSection(target){
  const active=document.activeElement;
  if(active&&typeof active.blur==='function')active.blur();
  if(!target)return;
  const reduceMotion=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  requestAnimationFrame(()=>requestAnimationFrame(()=>target.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'})));
}
function scrollToSearchResults(){
  const target=document.getElementById('summary');
  if(!target||!target.textContent.trim())return;
  scrollToSection(target);
}
function selectDirectProduct(name){
  selectedProduct=name;
  selectedCrop=null;
  selectedPest=null;
  visibleLimit=200;
  directProductSearch.value=name;
  cropSearch.value='';
  pestSearch.value='';
  productSearch.value='';
  renderAll();
  scrollToSearchResults();
}
function renderDirectProductChips(filter=''){
  directProductChips.innerHTML='';
  const raw=String(filter||'').trim();
  const fullList=findDirectProductMatches(raw);
  directProductMatches=fullList;
  const limit=raw?80:(showAllPesticides?40:80);
  const list=fullList.slice(0,limit);
  list.forEach(name=>{
    const el=document.createElement('button');
    el.type='button';
    el.className='chip'+(name===selectedProduct?' selected':'');
    el.setAttribute('role','option');
    el.setAttribute('aria-selected',name===selectedProduct?'true':'false');
    const label=document.createElement('span');
    label.className='direct-product-name';
    label.textContent=name;
    const count=document.createElement('span');
    count.className='direct-product-rows';
    count.textContent=`適用 ${productRowCount(name).toLocaleString()}件`;
    el.append(label,count);
    el.onclick=()=>selectDirectProduct(name);
    directProductChips.appendChild(el);
  });
  if(!fullList.length){
    directProductChips.innerHTML='<div class="empty" style="padding:10px">一致する農薬名がありません</div>';
    directProductStatus.textContent=showAllPesticides?'全登録農薬から該当なし':'園芸グループ掲載品から該当なし。「すべての農薬を表示」をオンにすると検索範囲が広がります。';
  }else if(raw){
    directProductStatus.textContent=`候補 ${fullList.length.toLocaleString()}品${fullList.length>limit?`（上位${limit}品を表示）`:''}`;
  }else{
    directProductStatus.textContent=`${showAllPesticides?'全登録農薬':'園芸グループ掲載品'} ${activeProducts().length.toLocaleString()}品から検索できます。入力すると候補を絞り込みます。`;
  }
}
function refreshDirectProductSearch(){
  const value=directProductSearch.value;
  if(selectedProduct&&productSearchKey(value)!==productSearchKey(selectedProduct)){
    selectedProduct=null;
    visibleLimit=200;
    renderResults();
  }
  renderDirectProductChips(value);
  document.getElementById('directProductClear').style.display=(selectedProduct||value.trim())?'inline':'none';
}
// 作物・病害虫の段階選択
function renderCropChips(filter=''){
  cropChips.innerHTML=''; const q=norm(filter); const crops=activeCrops();
  const list=crops.filter(c=>norm(c).includes(q));
  list.slice(0,100).forEach(c=>{
    const el=document.createElement('div');
    el.className='chip'+(c===selectedCrop?' selected':'');
    el.textContent=`${c} (${rowsForCrop(c).length})`;
    el.onclick=()=>{
      selectedProduct=null;
      selectedCrop=c;
      selectedPest=null;
      visibleLimit=200;
      directProductSearch.value='';
      cropSearch.value='';
      productSearch.value='';
      renderAll();
      scrollToSection(document.getElementById('pestStep'));
    };
    cropChips.appendChild(el);
  });
  if(!list.length) cropChips.innerHTML='<div class="empty" style="padding:10px">該当なし</div>';
}
function pestsForCrop(crop){ const m=new Map(); rowsForCrop(crop).forEach(r=>m.set(r[6],(m.get(r[6])||0)+1)); return [...m].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ja')); }
function renderPestChips(filter=''){
  if(!selectedCrop)return; pestChips.innerHTML=''; const q=norm(filter); const list=pestsForCrop(selectedCrop).filter(([p])=>norm(p).includes(q));
  list.slice(0,150).forEach(([p,n])=>{ const el=document.createElement('div'); el.className='chip'+(p===selectedPest?' selected':''); el.textContent=`${p} (${n})`; el.onclick=()=>{selectedPest=p;visibleLimit=200;pestSearch.value='';renderAll();scrollToSearchResults();}; pestChips.appendChild(el); });
  if(!list.length) pestChips.innerHTML='<div class="empty" style="padding:10px">該当なし</div>';
}
// 結果一覧の描画
function renderResults(){
  const box=document.getElementById('results'), summary=document.getElementById('summary');
  if(!selectedProduct&&!selectedCrop){box.innerHTML='';summary.textContent='';return;}
  let rows;
  if(selectedProduct){
    rows=rowsForProduct(selectedProduct);
  }else{
    rows=rowsForCrop(selectedCrop);
    if(selectedPest)rows=rows.filter(r=>r[6]===selectedPest);
    const pq=norm(productSearch.value);
    if(pq)rows=rows.filter(r=>norm(r[3]).includes(pq));
  }
  summary.textContent=selectedProduct
    ?`該当 ${rows.length.toLocaleString()} 件：${selectedProduct}${showAllPesticides?' / すべての農薬':' / 園芸グループのみ'}`
    :`該当 ${rows.length.toLocaleString()} 件：${selectedCrop}${selectedPest?' / '+selectedPest:''}${showAllPesticides?' / すべての農薬':' / 園芸グループのみ'}`;
  if(!rows.length){box.innerHTML='<div class="empty">該当する登録が見つかりません</div>';return;}
  const shown=rows.slice(0,visibleLimit);
  box.innerHTML=shown.map(r=>{
    const cropAndTarget=selectedProduct
      ?`<dt>作物</dt><dd>${esc(r[5])}</dd><dt>対象</dt><dd>${esc(r[6])}</dd>`
      :`${selectedPest?'':`<dt>対象</dt><dd>${esc(r[6])}</dd>`}`;
    const cond=!selectedProduct&&r[5]!==selectedCrop?`<div class="crop-cond">適用作物の条件: ${esc(r[5])}</div>`:'';
    return `<div class="result-card"><div class="product">${esc(r[3])}${isGardenRow(r)?'<span class="garden-badge">園芸</span>':''}</div><dl class="meta">`+
      `${cropAndTarget}<dt>登録番号</dt><dd>${esc(r[0])}</dd>`+
      `<dt>用途・種類</dt><dd>${esc(r[1])} / ${esc(r[2])}</dd><dt>登録者</dt><dd>${esc(r[4])||'—'}</dd>`+
      `<dt>希釈・使用量</dt><dd>${esc(r[7])||'—'}</dd><dt>散布液量</dt><dd>${esc(r[8])||'—'}</dd>`+
      `<dt>使用時期</dt><dd>${esc(r[9])||'—'}</dd><dt>本剤の回数</dt><dd>${esc(r[10])||'—'}</dd>`+
      `<dt>使用方法</dt><dd>${esc(r[11])||'—'}</dd>${r[12]?`<dt>適用場所</dt><dd>${esc(r[12])}</dd>`:''}`+
      `${r[13]?`<dt>有効成分の総使用回数</dt><dd>${esc(r[13])}</dd>`:''}</dl>${cond}${equivalentProductsHtml(r)}${pesticideCommerceHtml(r[3])}</div>`;
  }).join('');
  if(rows.length>visibleLimit){ const b=document.createElement('button'); b.className='more'; b.textContent=`さらに表示（残り ${(rows.length-visibleLimit).toLocaleString()} 件）`; b.onclick=()=>{visibleLimit+=200;renderResults();}; box.appendChild(b); }
}
function renderAll(){
  document.getElementById('directProductCount').textContent=`全${activeProducts().length.toLocaleString()}品`;
  renderDirectProductChips(directProductSearch.value);
  document.getElementById('directProductClear').style.display=(selectedProduct||directProductSearch.value.trim())?'inline':'none';
  document.getElementById('cropCount').textContent=`全${activeCrops().length.toLocaleString()}種`;
  renderCropChips(cropSearch.value);
  const step=document.getElementById('pestStep'),cc=document.getElementById('cropClear'),pc=document.getElementById('pestClear');
  if(selectedCrop){
    step.style.display='block';
    cc.style.display='inline';
    renderPestChips(pestSearch.value);
    document.getElementById('pestCount').textContent=`全${pestsForCrop(selectedCrop).length.toLocaleString()}種`;
    pc.style.display=selectedPest?'inline':'none';
  }else{
    step.style.display='none';
    cc.style.display='none';
    pc.style.display='none';
  }
  renderResults();
}
let directSearchFrame=0;
function scheduleDirectProductSearch(){
  cancelAnimationFrame(directSearchFrame);
  directSearchFrame=requestAnimationFrame(refreshDirectProductSearch);
}
directProductSearch.addEventListener('input',scheduleDirectProductSearch);
directProductSearch.addEventListener('keyup',e=>{if(e.key!=='Enter')scheduleDirectProductSearch();});
directProductSearch.addEventListener('compositionend',scheduleDirectProductSearch);
directProductSearch.addEventListener('focus',scheduleDirectProductSearch);
directProductSearch.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&directProductMatches.length){
    e.preventDefault();
    selectDirectProduct(directProductMatches[0]);
  }
});
cropSearch.oninput=()=>renderCropChips(cropSearch.value);
pestSearch.oninput=()=>renderPestChips(pestSearch.value);
productSearch.oninput=()=>{visibleLimit=200;renderResults();};
showAllPesticidesInput.onchange=()=>{
  showAllPesticides=showAllPesticidesInput.checked;
  visibleLimit=200;
  if(selectedProduct&&!rowsForProduct(selectedProduct).length)selectedProduct=null;
  if(selectedCrop&&!rowsForCrop(selectedCrop).length){selectedCrop=null;selectedPest=null;}
  else if(selectedCrop&&selectedPest&&!pestsForCrop(selectedCrop).some(([p])=>p===selectedPest))selectedPest=null;
  renderAll();
};
document.getElementById('directProductClear').onclick=()=>{selectedProduct=null;directProductSearch.value='';visibleLimit=200;renderAll();directProductSearch.focus();};
document.getElementById('cropClear').onclick=()=>{selectedCrop=null;selectedPest=null;productSearch.value='';visibleLimit=200;renderAll();};
document.getElementById('pestClear').onclick=()=>{selectedPest=null;visibleLimit=200;renderAll();};
renderAll();
