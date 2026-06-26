/** 木材カット図 試作品 */
(()=>{
  'use strict';

  const M=window.WoodCutModel;
  const materials=Array.isArray(window.WOOD_MATERIALS)?window.WOOD_MATERIALS:[];
  const STORAGE_KEY='komeriWoodCutProjectsV1';
  const DRAFT_KEY='komeriWoodCutDraftV1';
  const SVG_NS='http://www.w3.org/2000/svg';

  const $=id=>document.getElementById(id);
  const dom={
    saveState:$('saveState'),projectName:$('projectName'),newProjectButton:$('newProjectButton'),savedProjectSelect:$('savedProjectSelect'),
    openProjectButton:$('openProjectButton'),saveProjectButton:$('saveProjectButton'),deleteProjectButton:$('deleteProjectButton'),
    sheetTabs:$('sheetTabs'),showAddSheetButton:$('showAddSheetButton'),addSheetPanel:$('addSheetPanel'),closeAddSheetButton:$('closeAddSheetButton'),
    materialFilter:$('materialFilter'),materialSelect:$('materialSelect'),sheetLabelInput:$('sheetLabelInput'),sheetWidthInput:$('sheetWidthInput'),
    sheetHeightInput:$('sheetHeightInput'),sheetThicknessInput:$('sheetThicknessInput'),addSheetButton:$('addSheetButton'),materialNote:$('materialNote'),
    selectionBadge:$('selectionBadge'),selectionDetail:$('selectionDetail'),edgeFieldset:$('edgeFieldset'),cutOffsetInput:$('cutOffsetInput'),
    kerfInput:$('kerfInput'),applyCutButton:$('applyCutButton'),deleteCutButton:$('deleteCutButton'),undoButton:$('undoButton'),redoButton:$('redoButton'),
    fitButton:$('fitButton'),printButton:$('printButton'),resetSheetButton:$('resetSheetButton'),deleteSheetButton:$('deleteSheetButton'),
    activeSheetTitle:$('activeSheetTitle'),activeSheetMeta:$('activeSheetMeta'),zoomOutButton:$('zoomOutButton'),zoomInButton:$('zoomInButton'),
    drawingViewport:$('drawingViewport'),cutSvg:$('cutSvg'),drawingEmpty:$('drawingEmpty'),message:$('message'),instructionList:$('instructionList'),
    cutCountBadge:$('cutCountBadge'),pieceCountBadge:$('pieceCountBadge'),pieceTableBody:$('pieceTableBody'),printArea:$('printArea')
  };

  const state={
    project:null,activeSheetId:'',selectedPieceId:'',selectedCutId:'',history:[],future:[],views:new Map(),dirty:true,
    currentLayout:{leaves:[],cuts:[]},interaction:{pointers:new Map(),pan:null,pinch:null,drag:null,moved:false,suppressClick:false}
  };

  function freshProject(){
    const material=materials[0]||{id:'manual',name:'合板',width:910,height:1820,thickness:12};
    const sheet=M.createSheet(material);
    return {id:M.uid('project'),schema:1,name:'木材カット図',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),sheets:[sheet]};
  }

  function loadJson(key,fallback){
    try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch{return fallback;}
  }

  function storeJson(key,value){
    try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(error){setMessage(`端末への保存に失敗しました: ${error.message}`);return false;}
  }

  function loadInitialProject(){
    const draft=loadJson(DRAFT_KEY,null);
    if(draft?.project?.sheets&&Array.isArray(draft.project.sheets)){
      state.project=draft.project;
      state.activeSheetId=draft.activeSheetId||draft.project.sheets[0]?.id||'';
      state.dirty=true;
      return;
    }
    state.project=freshProject();
    state.activeSheetId=state.project.sheets[0]?.id||'';
  }

  function activeSheet(){
    return state.project.sheets.find(sheet=>sheet.id===state.activeSheetId)||state.project.sheets[0]||null;
  }

  function snapshot(){
    return JSON.stringify({project:state.project,activeSheetId:state.activeSheetId});
  }

  function restore(serialized){
    const data=JSON.parse(serialized);
    state.project=data.project;
    state.activeSheetId=data.activeSheetId||state.project.sheets[0]?.id||'';
    state.selectedPieceId='';state.selectedCutId='';
  }

  function pushHistory(){
    state.history.push(snapshot());
    if(state.history.length>60)state.history.shift();
    state.future=[];
  }

  function commit(mutator,{resetSelection=true}={}){
    pushHistory();
    mutator();
    state.project.updatedAt=new Date().toISOString();
    if(resetSelection){state.selectedPieceId='';state.selectedCutId='';}
    markDirty();
    renderAll();
  }

  function markDirty(){
    state.dirty=true;
    updateSaveState();
    storeJson(DRAFT_KEY,{project:state.project,activeSheetId:state.activeSheetId});
  }

  function updateSaveState(text){
    dom.saveState.className='save-state';
    if(text){dom.saveState.textContent=text;return;}
    if(state.dirty){dom.saveState.textContent='作業中';dom.saveState.classList.add('dirty');}
    else{dom.saveState.textContent='保存済み';dom.saveState.classList.add('saved');}
  }

  function setMessage(text='',kind='error'){
    dom.message.textContent=text;
    dom.message.style.color=kind==='ok'?'#17633a':'';
  }

  function format(value){return M.formatMm(value);}
  function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}

  function getView(sheet){
    if(!sheet)return {x:0,y:0,width:1,height:1};
    if(!state.views.has(sheet.id))state.views.set(sheet.id,fitViewFor(sheet));
    return state.views.get(sheet.id);
  }

  function fitViewFor(sheet){
    const base=Math.max(sheet.width,sheet.height);
    const margin=Math.max(60,base*.11);
    return {x:-margin,y:-margin,width:sheet.width+margin*2,height:sheet.height+margin*2};
  }

  function setFitView(){
    const sheet=activeSheet();if(!sheet)return;
    state.views.set(sheet.id,fitViewFor(sheet));renderSvg();
  }

  function renderAll(){
    dom.projectName.value=state.project.name||'';
    renderSheetTabs();
    renderActiveMeta();
    renderSvg();
    renderSelection();
    renderResults();
    renderHistoryButtons();
    renderPrintArea();
    updateSaveState();
  }

  function renderSheetTabs(){
    dom.sheetTabs.innerHTML='';
    state.project.sheets.forEach((sheet,index)=>{
      const button=document.createElement('button');
      button.type='button';button.className='sheet-tab'+(sheet.id===state.activeSheetId?' active':'');
      button.role='tab';button.setAttribute('aria-selected',sheet.id===state.activeSheetId?'true':'false');
      button.dataset.sheetId=sheet.id;
      button.textContent=`${index+1}. ${sheet.label}`;
      dom.sheetTabs.append(button);
    });
  }

  function renderActiveMeta(){
    const sheet=activeSheet();
    if(!sheet){
      dom.activeSheetTitle.textContent='材料なし';dom.activeSheetMeta.textContent='';dom.drawingEmpty.hidden=false;dom.cutSvg.hidden=true;
      dom.deleteSheetButton.disabled=true;dom.resetSheetButton.disabled=true;return;
    }
    dom.drawingEmpty.hidden=true;dom.cutSvg.hidden=false;
    dom.activeSheetTitle.textContent=sheet.label;
    const thick=sheet.thickness!==''&&sheet.thickness!=null?` × 厚さ ${format(sheet.thickness)} mm`:'';
    dom.activeSheetMeta.textContent=`${format(sheet.width)} × ${format(sheet.height)} mm${thick}${sheet.jan?` / JAN ${sheet.jan}`:''}`;
    dom.deleteSheetButton.disabled=false;dom.resetSheetButton.disabled=false;
  }

  function buildSvgMarkup(sheet,{interactive=false,view=null}={}){
    const layout=M.layoutTree(sheet.root,sheet.width,sheet.height);
    const vb=view||fitViewFor(sheet);
    const base=Math.max(sheet.width,sheet.height);
    const dimGap=Math.max(28,base*.035);
    const tick=Math.max(8,base*.009);
    const overallFont=Math.max(14,base*.018);
    const badgeRadius=Math.max(10,Math.min(sheet.width,sheet.height)*.018);
    let html=`<rect class="canvas-background" x="${vb.x}" y="${vb.y}" width="${vb.width}" height="${vb.height}"></rect>`;
    html+=`<rect class="sheet-outline" x="0" y="0" width="${sheet.width}" height="${sheet.height}" rx="2"></rect>`;

    for(const leaf of layout.leaves){
      const selected=interactive&&leaf.nodeId===state.selectedPieceId?' selected':'';
      const minDim=Math.min(leaf.width,leaf.height);
      const font=Math.max(8,Math.min(30,minDim*.13));
      const sizeFont=Math.max(7,font*.58);
      const centerX=leaf.x+leaf.width/2,centerY=leaf.y+leaf.height/2;
      const showSize=leaf.width>font*3.8&&leaf.height>font*2.4;
      html+=`<g class="piece${selected}" data-piece-id="${leaf.nodeId}"><rect class="piece-rect" x="${leaf.x}" y="${leaf.y}" width="${leaf.width}" height="${leaf.height}"></rect><text class="piece-label" x="${centerX}" y="${showSize?centerY-font*.15:centerY}" font-size="${font}" dominant-baseline="central">${leaf.label}</text>${showSize?`<text class="piece-size" x="${centerX}" y="${centerY+font*.78}" font-size="${sizeFont}">${format(leaf.width)} × ${format(leaf.height)}</text>`:''}</g>`;
    }

    for(const cut of layout.cuts){
      const selected=interactive&&cut.cutId===state.selectedCutId?' selected':'';
      const centerX=cut.axis==='x'?cut.x+cut.kerf/2:cut.x+cut.width/2;
      const centerY=cut.axis==='x'?cut.y+cut.height/2:cut.y+cut.kerf/2;
      const bandW=cut.axis==='x'?Math.max(cut.kerf,.7):cut.width;
      const bandH=cut.axis==='y'?Math.max(cut.kerf,.7):cut.height;
      const bandX=cut.axis==='x'?cut.x+(cut.kerf-bandW)/2:cut.x;
      const bandY=cut.axis==='y'?cut.y+(cut.kerf-bandH)/2:cut.y;
      let line,hit,badgeX,badgeY;
      if(cut.axis==='x'){
        line=`<line class="cut-center" x1="${centerX}" y1="${cut.y}" x2="${centerX}" y2="${cut.y+cut.height}"></line>`;
        hit=interactive?`<line class="cut-hit" data-cut-id="${cut.cutId}" x1="${centerX}" y1="${cut.y}" x2="${centerX}" y2="${cut.y+cut.height}"></line>`:'';
        badgeX=centerX;badgeY=cut.parentY+Math.min(Math.max(badgeRadius*1.5,cut.parentHeight*.08),cut.parentHeight/2);
      }else{
        line=`<line class="cut-center" x1="${cut.x}" y1="${centerY}" x2="${cut.x+cut.width}" y2="${centerY}"></line>`;
        hit=interactive?`<line class="cut-hit horizontal" data-cut-id="${cut.cutId}" x1="${cut.x}" y1="${centerY}" x2="${cut.x+cut.width}" y2="${centerY}"></line>`:'';
        badgeX=cut.parentX+Math.min(Math.max(badgeRadius*1.5,cut.parentWidth*.08),cut.parentWidth/2);badgeY=centerY;
      }
      html+=`<g class="cut-group${selected}" data-cut-id="${cut.cutId}"><rect class="cut-band" x="${bandX}" y="${bandY}" width="${bandW}" height="${bandH}"></rect>${line}${hit}<circle class="cut-number" cx="${badgeX}" cy="${badgeY}" r="${badgeRadius}"></circle><text class="cut-number-text" x="${badgeX}" y="${badgeY}" font-size="${badgeRadius*1.05}">${cut.order}</text></g>`;
    }

    const widthY=-dimGap;
    html+=`<g class="overall-dimensions"><line class="dimension-line" x1="0" y1="${widthY}" x2="${sheet.width}" y2="${widthY}"></line><line class="dimension-tick" x1="0" y1="${widthY-tick}" x2="0" y2="${widthY+tick}"></line><line class="dimension-tick" x1="${sheet.width}" y1="${widthY-tick}" x2="${sheet.width}" y2="${widthY+tick}"></line><text class="dimension-text" x="${sheet.width/2}" y="${widthY-tick*.75}" font-size="${overallFont}">${format(sheet.width)} mm</text>`;
    const heightX=-dimGap;
    html+=`<line class="dimension-line" x1="${heightX}" y1="0" x2="${heightX}" y2="${sheet.height}"></line><line class="dimension-tick" x1="${heightX-tick}" y1="0" x2="${heightX+tick}" y2="0"></line><line class="dimension-tick" x1="${heightX-tick}" y1="${sheet.height}" x2="${heightX+tick}" y2="${sheet.height}"></line><text class="dimension-text" x="${heightX}" y="${sheet.height/2}" font-size="${overallFont}" transform="rotate(-90 ${heightX} ${sheet.height/2})">${format(sheet.height)} mm</text></g>`;
    return {html,layout,viewBox:`${vb.x} ${vb.y} ${vb.width} ${vb.height}`};
  }

  function renderSvg(){
    const sheet=activeSheet();
    if(!sheet){dom.cutSvg.innerHTML='';state.currentLayout={leaves:[],cuts:[]};return;}
    const view=getView(sheet);
    const built=buildSvgMarkup(sheet,{interactive:true,view});
    dom.cutSvg.setAttribute('viewBox',built.viewBox);
    dom.cutSvg.setAttribute('preserveAspectRatio','xMidYMid meet');
    dom.cutSvg.innerHTML=built.html;
    state.currentLayout=built.layout;
  }

  function renderSelection(){
    const sheet=activeSheet();
    const edgeInputs=[...document.querySelectorAll('input[name="cutEdge"]')];
    if(!sheet){
      dom.selectionBadge.textContent='材料なし';dom.selectionDetail.textContent='材料を追加してください。';dom.applyCutButton.disabled=true;dom.deleteCutButton.disabled=true;
      edgeInputs.forEach(input=>input.disabled=true);return;
    }
    const leaf=state.currentLayout.leaves.find(item=>item.nodeId===state.selectedPieceId);
    const cut=state.currentLayout.cuts.find(item=>item.cutId===state.selectedCutId);
    if(leaf){
      dom.selectionBadge.textContent=`部材 ${leaf.label}`;
      dom.selectionDetail.textContent=`横 ${format(leaf.width)} mm × 縦 ${format(leaf.height)} mm`;
      edgeInputs.forEach(input=>input.disabled=false);
      dom.applyCutButton.disabled=false;dom.applyCutButton.textContent='カットを追加';dom.deleteCutButton.disabled=true;
      if(!dom.cutOffsetInput.value)suggestOffset();
      return;
    }
    if(cut){
      dom.selectionBadge.textContent=`カット ${cut.order}`;
      dom.selectionDetail.textContent=M.instructionText(cut);
      edgeInputs.forEach(input=>{input.disabled=true;input.checked=input.value===cut.from;});
      dom.cutOffsetInput.value=format(cut.offset);dom.kerfInput.value=format(cut.kerf);
      dom.applyCutButton.disabled=false;dom.applyCutButton.textContent='寸法を更新';dom.deleteCutButton.disabled=false;
      return;
    }
    state.selectedPieceId='';state.selectedCutId='';
    dom.selectionBadge.textContent='領域を選択';dom.selectionDetail.textContent='図面内の領域をタップしてください。';
    edgeInputs.forEach(input=>input.disabled=false);
    dom.applyCutButton.disabled=true;dom.applyCutButton.textContent='カットを追加';dom.deleteCutButton.disabled=true;
  }

  function suggestOffset(){
    const leaf=state.currentLayout.leaves.find(item=>item.nodeId===state.selectedPieceId);if(!leaf)return;
    const edge=document.querySelector('input[name="cutEdge"]:checked')?.value||'left';
    const extent=edge==='left'||edge==='right'?leaf.width:leaf.height;
    const kerf=Number(dom.kerfInput.value)||0;
    dom.cutOffsetInput.value=format(Math.max(.1,(extent-kerf)/2));
  }

  function renderResults(){
    const sheet=activeSheet();
    if(!sheet){dom.instructionList.innerHTML='<li class="instruction-empty">材料がありません。</li>';dom.pieceTableBody.innerHTML='';return;}
    const instructions=M.collectInstructions(sheet.root,sheet.width,sheet.height);
    dom.cutCountBadge.textContent=`${instructions.length}本`;
    dom.pieceCountBadge.textContent=`${state.currentLayout.leaves.length}枚`;
    dom.instructionList.innerHTML=instructions.length?instructions.map(item=>`<li data-cut-id="${item.cutId}" class="${item.cutId===state.selectedCutId?'selected':''}"><strong>${item.order}.</strong> ${escapeHtml(item.text)}${item.kerf?`<br><small>刃厚 ${format(item.kerf)} mm</small>`:''}</li>`).join(''):'<li class="instruction-empty">まだカット線がありません。</li>';
    dom.pieceTableBody.innerHTML=state.currentLayout.leaves.map(leaf=>`<tr data-piece-id="${leaf.nodeId}"><td>${leaf.label}</td><td>${format(leaf.width)} mm</td><td>${format(leaf.height)} mm</td></tr>`).join('');
  }

  function renderHistoryButtons(){
    dom.undoButton.disabled=state.history.length===0;dom.redoButton.disabled=state.future.length===0;
  }

  function renderPrintArea(){
    dom.printArea.innerHTML=state.project.sheets.map((sheet,index)=>{
      const built=buildSvgMarkup(sheet,{interactive:false,view:fitViewFor(sheet)});
      const instructions=M.collectInstructions(sheet.root,sheet.width,sheet.height);
      const pieces=built.layout.leaves;
      return `<section class="print-sheet"><h1>${escapeHtml(state.project.name)} — ${index+1}. ${escapeHtml(sheet.label)}</h1><p class="print-meta">材料 ${format(sheet.width)} × ${format(sheet.height)} mm${sheet.thickness!==''?` / 厚さ ${format(sheet.thickness)} mm`:''}${sheet.jan?` / JAN ${escapeHtml(sheet.jan)}`:''}</p><svg class="print-svg" viewBox="${built.viewBox}" preserveAspectRatio="xMidYMid meet">${built.html}</svg><div class="print-columns"><div><h2>カット順</h2><ol>${instructions.length?instructions.map(item=>`<li>${escapeHtml(item.text)} / 刃厚 ${format(item.kerf)} mm</li>`).join(''):'<li>カットなし</li>'}</ol></div><div><h2>部材寸法</h2><table><thead><tr><th>記号</th><th>横</th><th>縦</th></tr></thead><tbody>${pieces.map(piece=>`<tr><td>${piece.label}</td><td>${format(piece.width)}</td><td>${format(piece.height)}</td></tr>`).join('')}</tbody></table></div></div></section>`;
    }).join('');
  }

  function selectPiece(pieceId){
    state.selectedPieceId=pieceId;state.selectedCutId='';dom.cutOffsetInput.value='';
    renderSvg();renderSelection();renderResults();suggestOffset();setMessage('');
  }

  function selectCut(cutId){
    state.selectedCutId=cutId;state.selectedPieceId='';
    renderSvg();renderSelection();renderResults();setMessage('');
  }

  function applyCut(){
    const sheet=activeSheet();if(!sheet)return;
    const offset=Number(dom.cutOffsetInput.value),kerf=Number(dom.kerfInput.value);
    if(!Number.isFinite(offset)||offset<=0){setMessage('残す寸法を0より大きい数値で入力してください。');return;}
    if(!Number.isFinite(kerf)||kerf<0){setMessage('刃厚は0以上で入力してください。');return;}
    if(state.selectedCutId){
      const result=M.updateCut(sheet.root,state.selectedCutId,{offset,kerf});
      const check=M.validateTree(result.root,sheet.width,sheet.height,5);
      if(!result.ok||!check.ok){setMessage(result.error||check.error);return;}
      const cutId=state.selectedCutId;
      commit(()=>{sheet.root=result.root;},{resetSelection:false});
      state.selectedCutId=cutId;renderAll();setMessage('カット寸法を更新しました。','ok');return;
    }
    if(!state.selectedPieceId){setMessage('カットする領域を選択してください。');return;}
    const from=document.querySelector('input[name="cutEdge"]:checked')?.value||'left';
    const result=M.applyCut(sheet.root,state.selectedPieceId,{from,offset,kerf,order:M.maxOrder(sheet.root)+1});
    const check=M.validateTree(result.root,sheet.width,sheet.height,5);
    if(!result.ok||!check.ok){setMessage(result.error||check.error);return;}
    commit(()=>{sheet.root=result.root;},{resetSelection:false});
    state.selectedPieceId='';state.selectedCutId=result.cutId;renderAll();setMessage('カット線を追加しました。','ok');
  }

  function deleteSelectedCut(){
    const sheet=activeSheet();if(!sheet||!state.selectedCutId)return;
    const found=M.findNode(sheet.root,node=>node.type==='cut'&&node.cutId===state.selectedCutId);
    if(!found)return;
    const nested=M.maxOrder(found.node)>found.node.order;
    if(nested&&!confirm('このカットより後に追加した線も、対象領域内から削除されます。続けますか？'))return;
    const result=M.removeCut(sheet.root,state.selectedCutId);
    commit(()=>{sheet.root=result.root;});setMessage('選択したカット線を削除しました。','ok');
  }

  function resetCurrentSheet(){
    const sheet=activeSheet();if(!sheet)return;
    if(M.maxOrder(sheet.root)>0&&!confirm('この材料のカット線をすべて消しますか？'))return;
    commit(()=>{sheet.root=M.createLeaf();});setFitView();setMessage('カット線をすべて消しました。','ok');
  }

  function deleteCurrentSheet(){
    const sheet=activeSheet();if(!sheet)return;
    if(!confirm(`「${sheet.label}」を図面から削除しますか？`))return;
    commit(()=>{
      const index=state.project.sheets.findIndex(item=>item.id===sheet.id);
      state.project.sheets.splice(index,1);
      state.views.delete(sheet.id);
      state.activeSheetId=state.project.sheets[Math.max(0,index-1)]?.id||state.project.sheets[0]?.id||'';
    });
    if(!activeSheet())dom.addSheetPanel.hidden=false;
  }

  function undo(){
    if(!state.history.length)return;
    state.future.push(snapshot());restore(state.history.pop());markDirty();renderAll();setMessage('一つ前の状態に戻しました。','ok');
  }

  function redo(){
    if(!state.future.length)return;
    state.history.push(snapshot());restore(state.future.pop());markDirty();renderAll();setMessage('操作をやり直しました。','ok');
  }

  function savedProjects(){
    const list=loadJson(STORAGE_KEY,[]);return Array.isArray(list)?list:[];
  }

  function renderSavedProjects(){
    const selected=dom.savedProjectSelect.value;
    const list=savedProjects().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
    dom.savedProjectSelect.innerHTML='<option value="">保存済み図面</option>'+list.map(project=>`<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}（${project.sheets?.length||0}枚）</option>`).join('');
    if(list.some(project=>project.id===selected))dom.savedProjectSelect.value=selected;
  }

  function saveProject(){
    state.project.name=dom.projectName.value.trim()||'木材カット図';
    state.project.updatedAt=new Date().toISOString();
    const list=savedProjects();
    const index=list.findIndex(project=>project.id===state.project.id);
    const copy=M.clone(state.project);
    if(index>=0)list[index]=copy;else list.push(copy);
    if(storeJson(STORAGE_KEY,list)){
      state.dirty=false;storeJson(DRAFT_KEY,{project:state.project,activeSheetId:state.activeSheetId});renderSavedProjects();dom.savedProjectSelect.value=state.project.id;updateSaveState();setMessage('図面を端末内に保存しました。','ok');
    }
  }

  function openSavedProject(){
    const id=dom.savedProjectSelect.value;if(!id){setMessage('開く図面を選択してください。');return;}
    if(state.dirty&&!confirm('現在の作業を保存せずに、選択した図面を開きますか？'))return;
    const project=savedProjects().find(item=>item.id===id);if(!project){setMessage('保存データが見つかりません。');return;}
    state.project=M.clone(project);state.activeSheetId=state.project.sheets[0]?.id||'';state.history=[];state.future=[];state.views.clear();state.dirty=false;state.selectedPieceId='';state.selectedCutId='';
    storeJson(DRAFT_KEY,{project:state.project,activeSheetId:state.activeSheetId});renderAll();setMessage('保存済み図面を開きました。','ok');
  }

  function deleteSavedProject(){
    const id=dom.savedProjectSelect.value;if(!id){setMessage('削除する保存データを選択してください。');return;}
    const list=savedProjects();const project=list.find(item=>item.id===id);if(!project)return;
    if(!confirm(`保存データ「${project.name}」を削除しますか？`))return;
    storeJson(STORAGE_KEY,list.filter(item=>item.id!==id));renderSavedProjects();setMessage('保存データを削除しました。','ok');
  }

  function newProject(){
    if(state.dirty&&!confirm('現在の作業を保存せずに、新しい図面を作りますか？'))return;
    state.project=freshProject();state.activeSheetId=state.project.sheets[0]?.id||'';state.history=[];state.future=[];state.views.clear();state.selectedPieceId='';state.selectedCutId='';state.dirty=true;markDirty();renderAll();setMessage('新しい図面を作成しました。','ok');
  }

  function populateMaterialSelect(){
    const query=dom.materialFilter.value.trim().toLowerCase();
    const current=dom.materialSelect.value;
    const filtered=materials.filter(item=>!query||[item.jan,item.name,item.category,item.note].join(' ').toLowerCase().includes(query));
    dom.materialSelect.innerHTML='<option value="">手入力</option>'+filtered.map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.jan?`${item.jan} / ${item.name}`:item.name)}</option>`).join('');
    if(filtered.some(item=>item.id===current))dom.materialSelect.value=current;
  }

  function fillMaterialForm(){
    const item=materials.find(material=>material.id===dom.materialSelect.value);
    if(!item){dom.materialNote.textContent='寸法を直接入力して追加できます。';return;}
    dom.sheetLabelInput.value=item.name;dom.sheetWidthInput.value=item.width;dom.sheetHeightInput.value=item.height;dom.sheetThicknessInput.value=item.thickness??'';
    dom.materialNote.textContent=[item.category,item.note].filter(Boolean).join(' / ');
  }

  function addSheet(){
    const width=Number(dom.sheetWidthInput.value),height=Number(dom.sheetHeightInput.value),thickness=dom.sheetThicknessInput.value===''?'':Number(dom.sheetThicknessInput.value);
    if(!Number.isFinite(width)||width<=0||!Number.isFinite(height)||height<=0){setMessage('材料の横寸法と縦寸法を入力してください。');return;}
    if(thickness!==''&&(!Number.isFinite(thickness)||thickness<0)){setMessage('厚さを確認してください。');return;}
    const source=materials.find(material=>material.id===dom.materialSelect.value)||{};
    const sheet=M.createSheet({...source,label:dom.sheetLabelInput.value.trim()||source.name||'材料',name:source.name||dom.sheetLabelInput.value.trim()||'手入力材料',width,height,thickness});
    commit(()=>{state.project.sheets.push(sheet);state.activeSheetId=sheet.id;});
    dom.addSheetPanel.hidden=true;setFitView();setMessage('材料を追加しました。','ok');
  }

  function zoom(factor,screenPoint=null){
    const sheet=activeSheet();if(!sheet)return;
    const view=getView(sheet),rect=dom.cutSvg.getBoundingClientRect();
    const px=screenPoint?.x??rect.left+rect.width/2,py=screenPoint?.y??rect.top+rect.height/2;
    const rx=(px-rect.left)/Math.max(1,rect.width),ry=(py-rect.top)/Math.max(1,rect.height);
    const newWidth=Math.min(sheet.width*8,Math.max(sheet.width*.12,view.width*factor));
    const newHeight=view.height*(newWidth/view.width);
    const anchorX=view.x+rx*view.width,anchorY=view.y+ry*view.height;
    state.views.set(sheet.id,{x:anchorX-rx*newWidth,y:anchorY-ry*newHeight,width:newWidth,height:newHeight});renderSvg();
  }

  function screenToSheet(clientX,clientY,view=getView(activeSheet())){
    const rect=dom.cutSvg.getBoundingClientRect();
    return {x:view.x+(clientX-rect.left)/Math.max(1,rect.width)*view.width,y:view.y+(clientY-rect.top)/Math.max(1,rect.height)*view.height};
  }

  function startDragCut(pointerId,cutId,event){
    const sheet=activeSheet();const cut=state.currentLayout.cuts.find(item=>item.cutId===cutId);if(!sheet||!cut)return;
    state.interaction.drag={pointerId,cutId,cut,baseRoot:M.clone(sheet.root),historyPushed:false,changed:false};
    state.selectedCutId=cutId;state.selectedPieceId='';
    dom.cutSvg.setPointerCapture?.(pointerId);event.preventDefault();
  }

  function updateDrag(event){
    const drag=state.interaction.drag,sheet=activeSheet();if(!drag||drag.pointerId!==event.pointerId||!sheet)return;
    const point=screenToSheet(event.clientX,event.clientY);
    const cut=drag.cut,kerf=Number(cut.kerf)||0;
    let offset;
    if(cut.axis==='x'){
      const start=point.x-kerf/2;
      offset=cut.from==='left'?start-cut.parentX:cut.parentX+cut.parentWidth-(start+kerf);
    }else{
      const start=point.y-kerf/2;
      offset=cut.from==='top'?start-cut.parentY:cut.parentY+cut.parentHeight-(start+kerf);
    }
    offset=Math.round(offset);
    const result=M.updateCut(drag.baseRoot,drag.cutId,{offset});
    const check=M.validateTree(result.root,sheet.width,sheet.height,5);
    if(!result.ok||!check.ok)return;
    if(!drag.historyPushed){pushHistory();drag.historyPushed=true;}
    sheet.root=result.root;drag.changed=true;state.interaction.moved=true;
    renderSvg();renderSelection();renderResults();
  }

  function beginPinch(){
    const points=[...state.interaction.pointers.values()];if(points.length<2)return;
    const sheet=activeSheet();if(!sheet)return;
    const [a,b]=points;const rect=dom.cutSvg.getBoundingClientRect();const view={...getView(sheet)};
    const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    const distance=Math.hypot(a.x-b.x,a.y-b.y)||1;
    const anchor={x:view.x+(mid.x-rect.left)/rect.width*view.width,y:view.y+(mid.y-rect.top)/rect.height*view.height};
    state.interaction.pinch={distance,view,anchor};state.interaction.pan=null;
  }

  function updatePinch(){
    const points=[...state.interaction.pointers.values()];const pinch=state.interaction.pinch,sheet=activeSheet();if(!pinch||points.length<2||!sheet)return;
    const [a,b]=points;const rect=dom.cutSvg.getBoundingClientRect();const distance=Math.hypot(a.x-b.x,a.y-b.y)||1;const scale=pinch.distance/distance;
    const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    const width=Math.min(sheet.width*8,Math.max(sheet.width*.12,pinch.view.width*scale));const height=pinch.view.height*(width/pinch.view.width);
    const rx=(mid.x-rect.left)/rect.width,ry=(mid.y-rect.top)/rect.height;
    state.views.set(sheet.id,{x:pinch.anchor.x-rx*width,y:pinch.anchor.y-ry*height,width,height});state.interaction.moved=true;renderSvg();
  }

  function pointerDown(event){
    state.interaction.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const cutEl=event.target.closest?.('.cut-hit');
    if(cutEl&&state.interaction.pointers.size===1){startDragCut(event.pointerId,cutEl.dataset.cutId,event);return;}
    if(state.interaction.pointers.size===2){beginPinch();return;}
    if(state.interaction.pointers.size===1&&(event.target.classList.contains('canvas-background')||event.target.classList.contains('sheet-outline'))){
      state.interaction.pan={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastY:event.clientY};
      dom.cutSvg.setPointerCapture?.(event.pointerId);
    }
  }

  function pointerMove(event){
    if(state.interaction.pointers.has(event.pointerId))state.interaction.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(state.interaction.drag){updateDrag(event);return;}
    if(state.interaction.pointers.size>=2){if(!state.interaction.pinch)beginPinch();updatePinch();return;}
    const pan=state.interaction.pan,sheet=activeSheet();if(!pan||pan.pointerId!==event.pointerId||!sheet)return;
    const rect=dom.cutSvg.getBoundingClientRect(),view=getView(sheet);const dx=event.clientX-pan.lastX,dy=event.clientY-pan.lastY;
    if(Math.hypot(event.clientX-pan.startX,event.clientY-pan.startY)>3)state.interaction.moved=true;
    pan.lastX=event.clientX;pan.lastY=event.clientY;
    state.views.set(sheet.id,{x:view.x-dx/rect.width*view.width,y:view.y-dy/rect.height*view.height,width:view.width,height:view.height});renderSvg();
  }

  function pointerEnd(event){
    const drag=state.interaction.drag;
    if(drag?.pointerId===event.pointerId){
      if(drag.changed){state.project.updatedAt=new Date().toISOString();markDirty();renderAll();setMessage('カット線の位置を更新しました。','ok');}
      state.interaction.drag=null;
    }
    state.interaction.pointers.delete(event.pointerId);
    if(state.interaction.pointers.size<2)state.interaction.pinch=null;
    if(state.interaction.pan?.pointerId===event.pointerId)state.interaction.pan=null;
    if(state.interaction.moved){state.interaction.suppressClick=true;setTimeout(()=>{state.interaction.suppressClick=false;},0);}
    state.interaction.moved=false;
  }

  function bindEvents(){
    dom.projectName.addEventListener('input',()=>{state.project.name=dom.projectName.value;markDirty();renderPrintArea();});
    dom.newProjectButton.addEventListener('click',newProject);dom.saveProjectButton.addEventListener('click',saveProject);dom.openProjectButton.addEventListener('click',openSavedProject);dom.deleteProjectButton.addEventListener('click',deleteSavedProject);
    dom.sheetTabs.addEventListener('click',event=>{const button=event.target.closest('.sheet-tab');if(!button)return;state.activeSheetId=button.dataset.sheetId;state.selectedPieceId='';state.selectedCutId='';renderAll();});
    dom.showAddSheetButton.addEventListener('click',()=>{dom.addSheetPanel.hidden=false;dom.materialFilter.focus();});dom.closeAddSheetButton.addEventListener('click',()=>{dom.addSheetPanel.hidden=true;});
    dom.materialFilter.addEventListener('input',populateMaterialSelect);dom.materialSelect.addEventListener('change',fillMaterialForm);dom.addSheetButton.addEventListener('click',addSheet);
    document.querySelectorAll('input[name="cutEdge"]').forEach(input=>input.addEventListener('change',suggestOffset));
    dom.applyCutButton.addEventListener('click',applyCut);dom.deleteCutButton.addEventListener('click',deleteSelectedCut);dom.undoButton.addEventListener('click',undo);dom.redoButton.addEventListener('click',redo);
    dom.fitButton.addEventListener('click',setFitView);dom.zoomInButton.addEventListener('click',()=>zoom(.8));dom.zoomOutButton.addEventListener('click',()=>zoom(1.25));dom.printButton.addEventListener('click',()=>{renderPrintArea();window.print();});
    dom.resetSheetButton.addEventListener('click',resetCurrentSheet);dom.deleteSheetButton.addEventListener('click',deleteCurrentSheet);
    dom.instructionList.addEventListener('click',event=>{const item=event.target.closest('[data-cut-id]');if(item)selectCut(item.dataset.cutId);});
    dom.pieceTableBody.addEventListener('click',event=>{const row=event.target.closest('[data-piece-id]');if(row)selectPiece(row.dataset.pieceId);});
    dom.cutSvg.addEventListener('click',event=>{
      if(state.interaction.suppressClick)return;
      const cut=event.target.closest?.('.cut-hit');if(cut){selectCut(cut.dataset.cutId);return;}
      const piece=event.target.closest?.('.piece');if(piece){selectPiece(piece.dataset.pieceId);return;}
      if(event.target.classList.contains('canvas-background')){state.selectedPieceId='';state.selectedCutId='';renderAll();}
    });
    dom.cutSvg.addEventListener('pointerdown',pointerDown);dom.cutSvg.addEventListener('pointermove',pointerMove);dom.cutSvg.addEventListener('pointerup',pointerEnd);dom.cutSvg.addEventListener('pointercancel',pointerEnd);
    dom.cutSvg.addEventListener('wheel',event=>{event.preventDefault();zoom(event.deltaY<0?.88:1.14,{x:event.clientX,y:event.clientY});},{passive:false});
    window.addEventListener('beforeunload',()=>storeJson(DRAFT_KEY,{project:state.project,activeSheetId:state.activeSheetId}));
  }

  loadInitialProject();
  populateMaterialSelect();fillMaterialForm();renderSavedProjects();bindEvents();renderAll();
  if(loadJson(DRAFT_KEY,null))setMessage('前回の作業状態を復元しました。','ok');
})();
