/**
 * チェーンソー替刃・ガイドバー検索の画面制御。
 * 機種・部品データは data.js、共通のJAN描画処理は shared/js/ean13.js に分離している。
 */
// 部品番号の整形と商品情報の組み立て
function komeriSearchUrl(keyword){return `https://www.komeri.com/shop/goods/search.aspx?display=D&keyword=${encodeURIComponent(keyword||'')}&search=x&x=0&y=0`;}
function cleanPartCode(s){return String(s||'').trim().replace(/\s+/g,'');}
function splitPartCodes(s){return String(s||'').split(/\s*\/\s*/).map(cleanPartCode).filter(Boolean);}
function chainProductInfo(code){
  const key=cleanPartCode(code);
  const exact=CHAIN_KOMERI_PRODUCTS[key];
  if(exact)return {...exact,code:key};
  const base=key.replace(/EC$/,'E');
  if(CHAIN_KOMERI_PRODUCTS[base])return {...CHAIN_KOMERI_PRODUCTS[base],code:key};
  const ecKey=key.endsWith('EC')?key:(key.endsWith('E')?`${key.slice(0,-1)}EC`:key);
  const jan=CHAIN_JAN_CODES[key]||CHAIN_JAN_CODES[ecKey]||'未確認';
  return {name:`OREGON ${key}`,code:key,jan,url:komeriSearchUrl(`OREGON ${key}`),searchOnly:true};
}
function guideBarProductInfo(code){
  const key=cleanPartCode(code);
  return {name:`OREGON ガイドバー ${key}`,code:key,jan:'未確認',url:komeriSearchUrl(`OREGON ガイドバー ${key}`),searchOnly:true};
}
function commerceItemHtml(info){
  return `<div class="commerce-item"><div class="commerce-name">${esc(info.name)}</div><div class="jan-code">JANコード：${esc(info.jan||'未確認')}</div>${janBarcodeToggleHtml(info.jan)}<a class="link-button${info.searchOnly?'':' primary'}" href="${esc(info.url)}" target="_blank" rel="noopener noreferrer">${info.searchOnly?'コメリで品番検索':'コメリ商品ページを開く'}</a>${info.searchOnly?'<div class="status-note">直販ページまたはJANコードを確認できなかった品番です。</div>':''}</div>`;
}
function partCommerceHtml(bar,chainDisplay){
  const bars=bar?[guideBarProductInfo(bar)]:[];
  const chains=splitPartCodes(chainDisplay).map(chainProductInfo);
  return `<div class="commerce-grid"><div class="commerce-box"><div class="commerce-title">ガイドバーのコメリ商品情報</div>${bars.length?bars.map(commerceItemHtml).join(''):'<div class="not-listed">品番の掲載なし</div>'}</div><div class="commerce-box"><div class="commerce-title">ソーチェーンのコメリ商品情報</div>${chains.length?chains.map(commerceItemHtml).join(''):'<div class="not-listed">品番の掲載なし</div>'}</div></div>`;
}

// データ列の位置を名前で参照する
const IDX={power:0,maker:1,model:2,key:3,inch:4,cm:5,links:6,pitch:7,gaugeIn:8,gaugeMm:9,bar:10,barNote:11,chain:12,chainExpanded:13,psKit:14,psRefill:15,page:16,url:17};
// 選択状態とDOM参照
let selectedMaker=null, selectedModel=null, selectedSpec=null;

const makerSearch=document.getElementById('makerSearch');
const modelSearch=document.getElementById('modelSearch');
const powerFilter=document.getElementById('powerFilter');
const availabilityFilter=document.getElementById('availabilityFilter');
const makerChips=document.getElementById('makerChips');
const modelChips=document.getElementById('modelChips');
const specChips=document.getElementById('specChips');
const modelStep=document.getElementById('modelStep');
const specStep=document.getElementById('specStep');
const makerClear=document.getElementById('makerClear');
const modelClear=document.getElementById('modelClear');
const specClear=document.getElementById('specClear');
const resetAll=document.getElementById('resetAll');
const results=document.getElementById('results');
const summary=document.getElementById('summary');

function normText(v){return String(v??'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');}
function normModel(v){return normText(v).replace(/[‐‑‒–—―ー−ｰ_,，、.・\/\()（）\[\]［］-]/g,'');}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function uniqueSorted(values){return [...new Set(values)].sort((a,b)=>a.localeCompare(b,'ja',{numeric:true,sensitivity:'base'}));}
function displayModel(v){return String(v??'').replace(/\n+/g,' / ');}
function rowsForMaker(m){return DATA.filter(r=>r[IDX.maker]===m);}
function rowsForModel(){return selectedMaker&&selectedModel?DATA.filter(r=>r[IDX.maker]===selectedMaker&&r[IDX.model]===selectedModel):[];}
function specKey(r){return [r[IDX.inch],r[IDX.cm],r[IDX.links],r[IDX.pitch],r[IDX.gaugeIn],r[IDX.gaugeMm],r[IDX.bar],r[IDX.chain],r[IDX.barNote]].join('|');}
function specLabel(r){
  const length=r[IDX.cm]?`${r[IDX.cm]} cm${r[IDX.inch]?`（${r[IDX.inch]}インチ）`:''}`:(r[IDX.inch]?`${r[IDX.inch]}インチ`:'バー長不明');
  const gauge=r[IDX.gaugeMm]?`${r[IDX.gaugeMm]} mm（${r[IDX.gaugeIn]}インチ）`:`${r[IDX.gaugeIn]||'不明'}`;
  return {main:length,sub:`${r[IDX.links]||'―'}コマ｜ピッチ ${r[IDX.pitch]||'―'}｜ゲージ ${gauge}`};
}
function makeChip(label,selected,onClick,ariaLabel,sub=''){
  const b=document.createElement('button'); b.type='button'; b.className='chip'+(sub?' spec-chip':'')+(selected?' selected':'');
  if(sub) b.innerHTML=`<span class="chip-main">${esc(label)}</span><span class="chip-sub">${esc(sub)}</span>`; else b.textContent=label;
  b.setAttribute('aria-pressed',selected?'true':'false'); if(ariaLabel)b.setAttribute('aria-label',ariaLabel); b.addEventListener('click',onClick); return b;
}
function setSelectOptions(select,values,current){
  select.innerHTML='<option value="">すべて</option>'; values.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;select.appendChild(o);}); select.value=values.includes(current)?current:'';
}
function availabilityMatch(rows){
  const f=availabilityFilter.value; if(!f)return true;
  const hasChain=rows.some(r=>r[IDX.chain]); const hasBar=rows.some(r=>r[IDX.bar]);
  return f==='chain'?hasChain:f==='bar'?hasBar:hasChain&&hasBar;
}
function getModelGroups(){
  if(!selectedMaker)return [];
  const q=normModel(modelSearch.value), groups=new Map();
  rowsForMaker(selectedMaker).forEach(r=>{if(!groups.has(r[IDX.model]))groups.set(r[IDX.model],[]);groups.get(r[IDX.model]).push(r);});
  return [...groups.entries()].filter(([model,rs])=>(!q||normModel(model).includes(q)||normModel(rs[0][IDX.key]).includes(q))&&(!powerFilter.value||rs.some(r=>r[IDX.power]===powerFilter.value))&&availabilityMatch(rs)).sort((a,b)=>displayModel(a[0]).localeCompare(displayModel(b[0]),'ja',{numeric:true,sensitivity:'base'}));
}
// メーカー・型番・仕様候補の描画
function renderMakerChips(){
  const q=normText(makerSearch.value), map=new Map();
  DATA.forEach(r=>{if(!map.has(r[IDX.maker]))map.set(r[IDX.maker],new Set());map.get(r[IDX.maker]).add(r[IDX.model]);});
  const makers=[...map.keys()].sort((a,b)=>map.get(b).size-map.get(a).size||a.localeCompare(b,'ja'));
  const shown=makers.filter(m=>normText(m).includes(q)); makerChips.innerHTML='';
  shown.forEach(m=>makerChips.appendChild(makeChip(`${m} (${map.get(m).size})`,m===selectedMaker,()=>selectMaker(m),`${m}、型式表記${map.get(m).size}件`)));
  if(!shown.length)makerChips.innerHTML='<div class="empty" style="padding:10px">該当するメーカーがありません</div>';
  document.getElementById('makerCount').textContent=`全${makers.length}社`;
}
function refreshPowerFilter(){
  if(!selectedMaker)return; const old=powerFilter.value; setSelectOptions(powerFilter,uniqueSorted(rowsForMaker(selectedMaker).map(r=>r[IDX.power])),old);
}
function renderModelChips(){
  if(!selectedMaker)return; const groups=getModelGroups(); modelChips.innerHTML='';
  groups.forEach(([model,rs])=>{
    const lengths=new Set(rs.map(r=>r[IDX.cm]||r[IDX.inch]).filter(Boolean));
    modelChips.appendChild(makeChip(displayModel(model),model===selectedModel,()=>selectModel(model),`${displayModel(model)}、仕様${rs.length}件、バー長${lengths.size}種類`));
  });
  if(!groups.length)modelChips.innerHTML='<div class="empty" style="padding:10px">条件に一致する型式がありません</div>';
  const total=new Set(rowsForMaker(selectedMaker).map(r=>r[IDX.model])).size;
  document.getElementById('modelCount').textContent=groups.length===total?`全${total}型式`:`${groups.length} / ${total}型式`;
}
function renderSpecChips(){
  if(!selectedModel)return; const rows=rowsForModel().sort((a,b)=>(Number(a[IDX.cm])||999)-(Number(b[IDX.cm])||999)||(Number(a[IDX.links])||999)-(Number(b[IDX.links])||999)||String(a[IDX.gaugeIn]).localeCompare(String(b[IDX.gaugeIn])));
  specChips.innerHTML=''; rows.forEach(r=>{const lab=specLabel(r),key=specKey(r); specChips.appendChild(makeChip(lab.main,key===selectedSpec,()=>selectSpec(key),`${lab.main}、${lab.sub}`,lab.sub));});
  document.getElementById('specCount').textContent=`全${rows.length}仕様`;
}
function copyText(text,button){
  if(!text)return; const done=()=>{const old=button.textContent;button.textContent='コピー済み';setTimeout(()=>button.textContent=old,1000);};
  if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(done).catch(()=>fallback()); else fallback();
  function fallback(){const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(_ ){}document.body.removeChild(ta);}
}
function compatibleModels(row){
  const chain=row[IDX.chainExpanded]||row[IDX.chain]; if(!chain)return [];
  const targetParts=chain.split('/').map(x=>x.trim()).filter(Boolean), found=new Set();
  DATA.forEach(r=>{const parts=(r[IDX.chainExpanded]||r[IDX.chain]||'').split('/').map(x=>x.trim());if(parts.some(p=>targetParts.includes(p))&&!(r[IDX.maker]===row[IDX.maker]&&r[IDX.model]===row[IDX.model]))found.add(`${r[IDX.maker]}：${displayModel(r[IDX.model])}`);});
  return [...found].sort((a,b)=>a.localeCompare(b,'ja',{numeric:true}));
}
// 選択した仕様の結果表示
function renderResult(){
  results.innerHTML=''; if(!selectedSpec){summary.textContent=selectedModel?'仕様を選ぶと、ガイドバー・チェーン品番を表示します。':selectedMaker?'本体型式を選んでください。':'メーカーから順に選んでください。';return;}
  const row=rowsForModel().find(r=>specKey(r)===selectedSpec); if(!row)return;
  const bar=row[IDX.bar],chain=row[IDX.chain],expanded=row[IDX.chainExpanded],lab=specLabel(row),others=compatibleModels(row);
  const gauge=row[IDX.gaugeMm]?`${row[IDX.gaugeMm]} mm（${row[IDX.gaugeIn]}インチ）`:(row[IDX.gaugeIn]||'―');
  const source=row[IDX.url]?(row[IDX.page]?`${row[IDX.url]}#page=${row[IDX.page]}`:row[IDX.url]):'';
  const chainDisplay=expanded&&expanded!==chain?expanded:chain;
  const card=document.createElement('article'); card.className='result-card';
  card.innerHTML=`
    <div class="product">${esc(displayModel(row[IDX.model]))}</div>
    <div class="manufacturer">${esc(row[IDX.maker])}</div>
    <div class="badges"><span class="badge">${esc(row[IDX.power])}</span><span class="badge">バー ${esc(lab.main)}</span></div>
    <div class="section-title">チェーン仕様</div>
    <dl class="meta">
      <dt>コマ数</dt><dd><strong>${esc(row[IDX.links]||'―')}${row[IDX.links]?'コマ':''}</strong></dd>
      <dt>ピッチ</dt><dd><strong>${esc(row[IDX.pitch]||'―')}</strong></dd>
      <dt>ゲージ</dt><dd><strong>${esc(gauge)}</strong></dd>
      <dt>バー長</dt><dd>${esc(lab.main)}</dd>
    </dl>
    <div class="part-grid">
      <div class="part-box bar"><div class="part-label">OREGON ガイドバー品番</div>${bar?`<div class="part-number">${esc(bar)}</div><div class="part-actions"><button type="button" class="copy-button" data-copy="${esc(bar)}">品番をコピー</button></div>`:`<div class="not-listed">公式適合表に掲載なし</div>`}</div>
      <div class="part-box"><div class="part-label">OREGON チェーン品番</div>${chainDisplay?`<div class="part-number">${esc(chainDisplay)}</div><div class="part-actions"><button type="button" class="copy-button" data-copy="${esc(chainDisplay)}">品番をコピー</button></div>`:`<div class="not-listed">公式適合表に掲載なし</div>`}</div>
    </div>
    ${partCommerceHtml(bar,chainDisplay)}
    ${row[IDX.barNote]?`<div class="note-box"><strong>ガイドバー注記：</strong>${esc(row[IDX.barNote])}</div>`:''}
    ${row[IDX.psKit]||row[IDX.psRefill]?`<div class="power-box"><strong>PowerSharp：</strong>${row[IDX.psKit]?`スターターキット ${esc(row[IDX.psKit])}`:''}${row[IDX.psKit]&&row[IDX.psRefill]?' ／ ':''}${row[IDX.psRefill]?`替刃 ${esc(row[IDX.psRefill])}`:''}</div>`:''}
    <div class="links">${source?`<a class="link-button primary" href="${esc(source)}" target="_blank" rel="noopener noreferrer">公式適合表を確認</a>`:''}<button type="button" class="link-button" onclick="window.print()">この結果を印刷</button></div>
    ${others.length?`<details class="compatible"><summary>同じチェーン品番が掲載されている他機種（${others.length}件）</summary><div class="compatible-list">${esc(others.slice(0,80).join('\n'))}${others.length>80?'\nほか '+(others.length-80)+'件':''}</div></details>`:''}
  `;
  card.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',()=>copyText(b.dataset.copy,b)));
  results.appendChild(card);
  summary.textContent=`${row[IDX.maker]}「${displayModel(row[IDX.model])}」の選択仕様を表示中`;
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
function selectMaker(m){selectedMaker=m;selectedModel=null;selectedSpec=null;makerSearch.value='';modelSearch.value='';powerFilter.value='';availabilityFilter.value='';modelStep.hidden=false;specStep.hidden=true;makerClear.hidden=false;modelClear.hidden=true;specClear.hidden=true;resetAll.hidden=false;refreshPowerFilter();renderMakerChips();renderModelChips();renderResult();scrollToSection(modelStep);}
function selectModel(m){selectedModel=m;selectedSpec=null;modelSearch.value='';specStep.hidden=false;modelClear.hidden=false;specClear.hidden=true;renderModelChips();renderSpecChips();renderResult();scrollToSection(specStep);}
function selectSpec(k){selectedSpec=k;specClear.hidden=false;renderSpecChips();renderResult();scrollToSearchResults();}
function clearSpec(){selectedSpec=null;specClear.hidden=true;renderSpecChips();renderResult();}
function clearModel(){selectedModel=null;selectedSpec=null;modelSearch.value='';specStep.hidden=true;modelClear.hidden=true;specClear.hidden=true;renderModelChips();renderResult();}
function clearMaker(){selectedMaker=null;selectedModel=null;selectedSpec=null;makerSearch.value='';modelSearch.value='';powerFilter.value='';availabilityFilter.value='';modelStep.hidden=true;specStep.hidden=true;makerClear.hidden=true;modelClear.hidden=true;specClear.hidden=true;resetAll.hidden=true;renderMakerChips();renderResult();}
makerSearch.addEventListener('input',renderMakerChips); modelSearch.addEventListener('input',()=>{selectedModel=null;selectedSpec=null;specStep.hidden=true;modelClear.hidden=true;specClear.hidden=true;renderModelChips();renderResult();});
powerFilter.addEventListener('change',()=>{selectedModel=null;selectedSpec=null;specStep.hidden=true;modelClear.hidden=true;specClear.hidden=true;renderModelChips();renderResult();});
availabilityFilter.addEventListener('change',()=>{selectedModel=null;selectedSpec=null;specStep.hidden=true;modelClear.hidden=true;specClear.hidden=true;renderModelChips();renderResult();});
makerClear.addEventListener('click',clearMaker); modelClear.addEventListener('click',clearModel); specClear.addEventListener('click',clearSpec); resetAll.addEventListener('click',clearMaker);
renderMakerChips(); renderResult();
